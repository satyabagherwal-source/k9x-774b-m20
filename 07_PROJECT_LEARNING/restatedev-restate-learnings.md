# Forensic Learning Record (Deep Inspection): restatedev/restate

> **Canonical Artifact**: `07_PROJECT_LEARNING/restatedev-restate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/restatedev/restate](https://github.com/restatedev/restate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:21:58.116Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `restatedev/restate`
- **Description**: Restate is the platform for building resilient applications that tolerate all infrastructure faults w/o the need for a PhD.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/benches/throughput_parallel.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! This benchmark requires the [counter.Counter service](https://github.com/restatedev/e2e/blob/a500164a31d58c0ee65ae77a7f99a8a2ef1825cb/services/node-services/src/counter.ts)
//! running on localhost:9080 in order to run.

use criterion::{Criterion, Throughput, criterion_group, criterion_main};
use futures_util::StreamExt;
use futures_util::stream::FuturesUnordered;
use http::Uri;
use http::header::CONTENT_TYPE;
use rand::distr::{Alphanumeric, SampleString};
use restate_benchmarks::{BenchmarkSettings, parse_benchmark_settings};
use restate_rocksdb::RocksDbManager;
use tokio::runtime::Builder;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

fn throughput_benchmark(criterion: &mut Criterion) {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env())
        .init();
    let _clock = restate_clock::ClockUpkeep::start();

    let config = restate_benchmarks::restate_configuration();
    let tc = restate_benchmarks::spawn_restate(config);
    restate_benchmarks::spawn_mock_service_endpoint(&tc);

    let BenchmarkSettings {
        num_requests,
        num_parallel_requests,
        sample_size,
    } = parse_benchmark_settings();

    let current_thread_rt = Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("current thread runtime must build");

    restate_benchmarks::discover_deployment(
        &current_thread_rt,
        Uri::from_static("http://localhost:9080"),
    );

    let client = reqwest::Client::builder()
        .build()
        .expect("build reqwest client");

    let mut group = criterion.benchmark_group("throughput");
    group
        .sample_size(sample_size)
        .throughput(Throughput::Elements(u64::from(num_requests)))
        .bench_function("parallel", |bencher| {
            bencher.to_async(&current_thread_rt).iter(|| {
                send_parallel_counter_requests(client.clone(), num_requests, num_parallel_requests)
            })
        });

    group.finish();
    current_thread_rt.block_on(tc.shutdown_node("completed", 0));
    current_thread_rt.block_on(RocksDbManager::get().shutdown());
}

async fn send_parallel_counter_requests(
    client: reqwest::Client,
    num_requests: u32,
    num_parallel_requests: usize,
) {
    let mut pending_requests = FuturesUnordered::new();
    let mut completed_requests = 0;

    while completed_requests < num_requests {
        if pending_requests.len() < num_parallel_requests
            && completed_requests as usize + pending_requests.len() < num_requests as usize
        {
            let client = client.clone();
            let counter_name = Alphanumeric.sample_string(&mut rand::rng(), 8);
            pending_requests.push(async move {
                client
                    .post(format!("http://localhost:8080/Counter/{counter_name}/add"))
                    .header(CONTENT_TYPE, "application/json")
                    .body("10")
                    .send()
                    .await
            });
        } else {
            let result = pending_requests
                .next()
                .await
                .expect("pending requests should not be empty");

            match result {
                Ok(response) => {
                    if response.status().is_success() {
                        completed_requests += 1;
                    } else {
                        panic!("request failed: {response:?}");
                    }
                }
                Err(err) => {
                    panic!("request failed: {err}")
                }
            }
        }
    }
}

criterion_group!(benches, throughput_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `benchmarks/benches/throughput_sequential.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! This benchmark requires the [counter.Counter service](https://github.com/restatedev/e2e/blob/a500164a31d58c0ee65ae77a7f99a8a2ef1825cb/services/node-services/src/counter.ts)
//! running on localhost:9080 in order to run.

use criterion::{Criterion, Throughput, criterion_group, criterion_main};
use http::Uri;
use http::header::CONTENT_TYPE;
use restate_rocksdb::RocksDbManager;
use tokio::runtime::Builder;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

fn throughput_benchmark(criterion: &mut Criterion) {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env())
        .init();
    let _clock = restate_clock::ClockUpkeep::start();

    let config = restate_benchmarks::restate_configuration();
    let tc = restate_benchmarks::spawn_restate(config);
    restate_benchmarks::spawn_mock_service_endpoint(&tc);

    let current_thread_rt = Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("current thread runtime must build");

    restate_benchmarks::discover_deployment(
        &current_thread_rt,
        Uri::from_static("http://localhost:9080"),
    );

    let client = reqwest::Client::builder()
        .build()
        .expect("reqwest client should build");

    let num_requests = 1;
    let mut group = criterion.benchmark_group("throughput");
    group
        .throughput(Throughput::Elements(num_requests))
        .bench_function("sequential", |bencher| {
            bencher
                .to_async(&current_thread_rt)
                .iter(|| send_sequential_counter_requests(&client, num_requests))
        });
    group.finish();
    current_thread_rt.block_on(tc.shutdown_node("completed", 0));
    current_thread_rt.block_on(RocksDbManager::get().shutdown());
}

async fn send_sequential_counter_requests(client: &reqwest::Client, num_requests: u64) {
    for _ in 0..num_requests {
        let response = client
            .post("http://localhost:8080/Counter/1/add")
            .header(CONTENT_TYPE, "application/json")
            .body("10")
            .send()
            .await
            .expect("Counter/1/add should not fail");

        assert!(response.status().is_success());
    }
}

criterion_group!(benches, throughput_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `benchmarks/src/lib.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

#![allow(clippy::async_yields_async)]
//! Utilities for benchmarking the Restate runtime

use std::net::SocketAddr;
use std::time::Duration;

use anyhow::anyhow;
use futures_util::{TryFutureExt, future};
use http::Uri;
use http::header::CONTENT_TYPE;
use tokio::net::TcpListener;
use tokio::runtime::Runtime;
use tokio::sync::oneshot;
use tracing::warn;

use restate_core::{TaskCenter, TaskCenterBuilder, TaskKind, cancellation_token, task_center};
use restate_node::Node;
use restate_rocksdb::RocksDbManager;
use restate_tracing_instrumentation::prometheus_metrics::Prometheus;
use restate_types::config::{
    BifrostOptionsBuilder, CommonOptionsBuilder, Configuration, ConfigurationBuilder,
    MetadataServerOptionsBuilder, WorkerOptionsBuilder,
};
use restate_types::config_loader::ConfigLoaderBuilder;
use restate_types::logs::metadata::ProviderKind;
use restate_types::net::listener::AddressBook;
use restate_types::retries::RetryPolicy;

pub fn discover_deployment(current_thread_rt: &Runtime, address: Uri) {
    let client = reqwest::Client::builder()
        .build()
        .expect("client should build");
    let discovery_payload = serde_json::json!({"uri": address.to_string()}).to_string();
    let discovery_result = current_thread_rt.block_on(async {
        RetryPolicy::fixed_delay(Duration::from_millis(200), Some(50))
            .retry(|| {
                client
                    .post("http://localhost:9070/deployments")
                    .header(CONTENT_TYPE, "application/json")
                    .body(discovery_payload.clone())
                    .send()
                    .map_err(anyhow::Error::from)
                    .and_then(|response| {
                        if response.status().is_success() {
                            future::ready(Ok(response))
                        } else {
                            future::ready(Err(anyhow::anyhow!("Discovery was unsuccessful.")))
                        }
                    })
            })
            .await
    });

    assert!(
        discovery_result
            .expect("Discovery must be successful")
            .status()
            .is_success(),
    );

    // wait for ingress being available
    // todo replace with node get_ident/status once it signals that the node is fully up and running
    let health_response = current_thread_rt.block_on(async {
        RetryPolicy::fixed_delay(Duration::from_millis(200), Some(50))
            .retry(|| {
                client
                    .get("http://localhost:8080/restate/health")
                    .send()
                    .map_err(anyhow::Error::from)
                    .and_then(|response| {
                        if response.status().is_success() {
                            future::ready(Ok(response))
                        } else {
                            future::ready(Err(anyhow::anyhow!("health request was unsuccessful.")))
                        }
                    })
            })
            .await
    });

    assert!(
        health_response
            .expect("health check must be successful")
            .status()
            .is_success(),
    );
}

pub fn spawn_restate(config: Configuration) -> task_center::Handle {
    if rlimit::increase_nofile_limit(u64::MAX).is_err() {
        warn!("Failed to increase the number of open file descriptors limit.");
    }

    let tc = TaskCenterBuilder::default()
        .options(config.common.clone())
        .build()
        .expect("task_center builds")
        .into_handle();

    let mut prometheus = Prometheus::install(&config.common);

    restate_types::config::set_current_config(config);

    let mut address_book = AddressBook::new(restate_types::config::node_filepath(""));
    let live_config = Configuration::live();

    tc.block_on(async {
        RocksDbManager::init();
        prometheus.start_upkeep_task();

        if let Err(err) = address_book.bind_from_config(&live_config.pinned()).await {
            panic!("Failed to bind address book: {err}");
        }

        TaskCenter::spawn(TaskKind::SystemBoot, "restate", async move {
            let node = Node::create(live_config, prometheus, address_book)
                .await
                .expect("Restate node must build");
            node.start().await
        })
        .unwrap();
    });

    tc
}

pub fn spawn_mock_service_endpoint(task_center_handle: &task_center::Handle) {
    task_center_handle.block_on(async {
        let (running_tx, running_rx) = oneshot::channel();
        TaskCenter::spawn(TaskKind::TestRunner, "mock-service-endpoint", async move {
            let addr: SocketAddr = ([127, 0, 0, 1], 9080).into();
            let listener = TcpListener::bind(addr).await?;

            cancellation_token()
                .run_until_cancelled(mock_service_endpoint::listener::run_listener(
                    listener,
                    || {
                        let _ = running_tx.send(());
                    },
                ))
                .await
                .map(|result| result.map_err(|err| anyhow!("mock service endpoint failed: {err}")))
                .unwrap_or(Ok(()))
        })
        .expect("spawn mock service endpoint task");

        running_rx
            .await
            .expect("mock service endpoint should start");
    });
}

pub fn restate_configuration() -> Configuration {
    let common_options = CommonOptionsBuilder::default()
        .base_dir(tempfile::tempdir().expect("tempdir failed").keep())
        .default_num_partitions(10)
        .build()
        .expect("building common options should work");

    let worker_options = WorkerOptionsBuilder::default()
        .build()
        .expect("building worker options should work");

    let metadata_server_options = MetadataServerOptionsBuilder::default()
        .build()
        .expect("building metadata server options should work");

    let bifrost_options = BifrostOptionsBuilder::default()
        .default_provider(ProviderKind::Replicated)
        .build()
        .expect("building bifrost options should work");

    let config = ConfigurationBuilder::default()
        .common(common_options)
        .worker(worker_options)
        .metadata_server(metadata_server_options)
        .bifrost(bifrost_options)
        .build()
        .expect("building the configuration should work");

    ConfigLoaderBuilder::default()
        .load_env(true)
        .custom_default(config)
        .build()
        .expect("builder should build")
        .load_once()
        .expect("configuration loading should not fail")
}

pub struct BenchmarkSettings {
    pub num_requests: u32,
    pub num_parallel_requests: usize,
    pub sample_size: usize,
}

pub fn parse_benchmark_settings() -> BenchmarkSettings {
    let num_requests = std::env::var("BENCHMARK_REQUESTS")
        .ok()
        .and_then(|requests| requests.parse().ok())
        .unwrap_or(4000);
    let num_parallel_requests = std::env::var("BENCHMARK_PARALLEL_REQUESTS")
        .ok()
        .and_then(|parallel_requests| parallel_requests.parse().ok())
        .unwrap_or(1000);
    let sample_size = std::env::var("BENCHMARK_SAMPLE_SIZE")
        .ok()
        .and_then(|parallel_requests| parallel_requests.parse().ok())
        .unwrap_or(20);

    BenchmarkSettings {
        num_requests,
        num_parallel_requests,
        sample_size,
    }
}

```

### Core Architecture Module: `cli/src/app.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::Result;
use clap::CommandFactory;
use cling::prelude::*;
use figment::Profile;
use tracing::info;

use restate_cli_util::{CliContext, CommonOpts};

use crate::cli_env::{CliEnv, EnvironmentSource};
use crate::commands::completions::Completions;
use crate::commands::*;

/// Restate command-line interface
///
/// Manage and inspect a Restate server: register service deployments, look into and act on
/// invocations, read and edit state, and query the server's internals with SQL.
///
/// Docs: https://docs.restate.dev
#[derive(Run, Parser, Clone)]
#[command(author, version = crate::build_info::version(), infer_subcommands = true)]
#[command(after_help = ROOT_HELP, after_long_help = ROOT_LONG_HELP)]
#[cling(run = "init")]
pub struct CliApp {
    #[clap(flatten)]
    pub common_opts: CommonOpts,
    #[clap(flatten)]
    pub global_opts: GlobalOpts,
    #[clap(subcommand)]
    pub cmd: Command,
}

/// `restate --help` and `restate -h`, with the notes for agents and scripts before the commands.
const ROOT_HELP_TEMPLATE: &str = concat!(
    "{before-help}{about-with-newline}\n{usage-heading} {usage}\n\n",
    heading!("For AI agents and scripts:"),
    "
  - Add --json to any command for a single JSON document on stdout, errors included.
    Logs and diagnostics go to stderr.
  - Not sure which command to use? Run `restate search <what you want to do>`.
    `restate sql --help` lists the SQL tables, `restate openapi` prints the admin API spec.
  - Commands that change something show the planned changes and ask for confirmation. They
    accept --dry-run to only preview the changes, and --yes to apply them without asking.
  - On failure the exit code is non-zero, and with --json the error document has a `kind`.
  - Commands never prompt with --json, with --non-interactive, when stdin is not a terminal,
    or when $CI is set (to anything but `false` or `0`). $CI also implies --yes.

{all-args}{after-help}",
);

const ROOT_HELP: &str = after_help!(learn_more: "https://docs.restate.dev/");

const ROOT_LONG_HELP: &str = concat!(
    heading!("Connecting to a server:"),
    "
  By default the CLI talks to a server on this machine (admin API at http://localhost:9070).
  To target another one, set $RESTATE_ADMIN_URL, plus $RESTATE_AUTH_TOKEN for a bearer token:
    RESTATE_ADMIN_URL=https://restate.example.com:9070 RESTATE_AUTH_TOKEN=... restate whoami
  or add an environment to the CLI config file (see `restate config --help`) and select it
  with -e/--environment or `restate config use-environment`. The variables take precedence
  over the config file.

",
    after_help!(learn_more: "https://docs.restate.dev/"),
);

/// Global options also listed in subcommand help, the ones agents and scripts need most.
/// `restate --help` lists all of them.
const SUBCOMMAND_HELP_GLOBALS: [&str; 3] = ["json", "yes", "environment"];

const SUBCOMMAND_HELP_TEMPLATE: &str = "\
{before-help}{about-with-newline}
{usage-heading} {usage}

{all-args}

More global options (verbosity, colors, timeouts, ...): `restate --help`.{after-help}";

/// The clap command of [`CliApp`], with subcommand help trimmed to the most used global
/// options (see [`SUBCOMMAND_HELP_GLOBALS`]). Use it instead of `CliApp::command()`.
pub fn command() -> clap::Command {
    let cmd = CliApp::command();
    // Subcommands get the other global options as copies hidden from help: clap then
    // propagates these instead of the visible ones, and parsing is unchanged.
    let hidden: Vec<clap::Arg> = cmd
        .get_arguments()
        .filter(|arg| {
            arg.is_global_set() && !SUBCOMMAND_HELP_GLOBALS.contains(&arg.get_id().as_str())
        })
        .map(|arg| arg.clone().hide_short_help(true).hide_long_help(true))
        .collect();
    cmd.help_template(ROOT_HELP_TEMPLATE)
        .mut_subcommands(|sub| trim_global_help(sub, &hidden))
}

fn trim_global_help(cmd: clap::Command, hidden: &[clap::Arg]) -> clap::Command {
    hidden
        .iter()
        .fold(cmd, |cmd, arg| cmd.arg(arg.clone()))
        .help_template(SUBCOMMAND_HELP_TEMPLATE)
        .mut_subcommands(|sub| trim_global_help(sub, hidden))
}

#[derive(Args, Collect, Clone, Default)]
#[command(next_help_heading = "Global options")]
pub struct GlobalOpts {
    /// Environment (a section of the CLI config file) to use. When omitted: $RESTATE_ENVIRONMENT,
    /// else the one selected with `restate config use-environment`, else `local` (a server on
    /// this machine). List them with `restate config list-environments`.
    #[arg(long, short, global = true, display_order = 0)]
    pub environment: Option<Profile>,
}

#[derive(Run, Subcommand, Clone)]
pub enum Command {
    #[cfg(feature = "dev-cmd")]
    #[clap(name = "dev", visible_alias = "up")]
    Dev(dev::Dev),

    #[clap(name = "whoami")]
    WhoAmI(whoami::WhoAmI),
    /// Inspect registered services and change their configuration
    ///
    /// Your business logic lives in services: regular applications that embed the Restate SDK.
    /// Services contain handlers (durable functions) that process requests and execute business logic.
    #[clap(subcommand)]
    #[command(after_help = after_help!(
        learn_more: "https://docs.restate.dev/foundations/services",
    ))]
    Services(services::Services),
    /// Register, inspect and remove service deployments
    ///
    /// A deployment is a version of your service(s) code that Restate calls.
    /// Registering it makes Restate discover its services and route new invocations to them,
    /// while invocations keep running on the deployment they started on.
    #[clap(subcommand)]
    #[command(after_help = after_help!(
        learn_more: "https://docs.restate.dev/services/versioning",
    ))]
    Deployments(deployments::Deployments),
    /// Manage Kafka clusters
    #[clap(subcommand)]
    KafkaClusters(kafkaclusters::KafkaClusters),
    /// Manage Kafka subscriptions
    #[clap(subcommand)]
    Subscriptions(subscriptions::Subscriptions),
    /// Inspect and manage invocations: list, describe, cancel, kill, pause, resume, ...
    ///
    /// An invocation is one request to a handler, with an `inv_...` id.
    #[clap(subcommand)]
    #[command(after_help = after_help!(
        learn_more: "https://docs.restate.dev/services/invocation/managing-invocations#lifecycle",
    ))]
    Invocations(invocations::Invocations),
    /// Inspect virtual queues, where invocations wait for their turn to run
    ///
    /// Each virtual queue holds the invocations of one service that share the same scope, limit
    /// key and, for virtual objects, object key. Useful to see what's waiting on a concurrency
    /// limit (see `restate rules`) or on a busy virtual object key.
    #[clap(name = "vqueues", subcommand)]
    #[command(after_help = after_help!(
        learn_more: "https://docs.restate.dev/services/flow-control",
    ))]
    VQueues(vqueues::VQueues),
    /// Manage concurrency-limit rules (flow control)
    ///
    /// A rule caps how many invocations can run at the same time in a scope. Invocations get a
    /// scope, and optionally a limit key, when sent through a scoped ingress endpoint
    /// (`/restate/scope/<scope>/...`); rules don't match service names. A pattern is `scope`,
    /// `scope/l1` or `scope/l1/l2`, where each part is an exact value or `*`, and the most
    /// specific matching rule applies. The limit applies to each matching scope separately:
    /// `*` gives every scope its own budget, it's not a global limit.
    #[clap(subcommand)]
    #[command(after_help = after_help!(
        learn_more: "https://docs.restate.dev/serv
```

### Core Architecture Module: `cli/src/cli_env.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! Resolves restate's CLI default data/config directory paths

use std::fmt::Display;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use figment::providers::{Format, Serialized, Toml};
use figment::{Figment, Profile};
use serde::{Deserialize, Serialize};
use url::Url;

use restate_cli_util::OsEnv;
use restate_types::net::address::{AdminPort, AdvertisedAddress, HttpIngressPort};

use crate::app::GlobalOpts;

pub const CONFIG_FILENAME: &str = "config.toml";

pub const ENVIRONMENT_FILENAME: &str = "environment";
pub const ENVIRONMENT_ENV: &str = "RESTATE_ENVIRONMENT";

pub const RESTATE_HOST_ENV: &str = "RESTATE_HOST";
pub const RESTATE_HOST_SCHEME_ENV: &str = "RESTATE_HOST_SCHEME";
pub const RESTATE_HOST_SCHEME_DEFAULT: &str = "http";

/// Environment variable to override the default config dir path
pub const CLI_CONFIG_HOME_ENV: &str = "RESTATE_CLI_CONFIG_HOME";
// This is CONFIG and not CONFIG_FILE to be consistent with RESTATE_CONFIG (server)
pub const CLI_CONFIG_FILE_ENV: &str = "RESTATE_CLI_CONFIG";

pub const RESTATE_AUTH_TOKEN_ENV: &str = "RESTATE_AUTH_TOKEN";
// TODO: Deprecated, will be removed once this is provided by the admin server
pub const INGRESS_URL_ENV: &str = "RESTATE_INGRESS_URL";
pub const ADMIN_URL_ENV: &str = "RESTATE_ADMIN_URL";
pub const EDITOR_ENV: &str = "RESTATE_EDITOR";

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    pub environment_type: EnvironmentType,

    pub ingress_base_url: Option<AdvertisedAddress<HttpIngressPort>>,
    pub admin_base_url: Option<AdvertisedAddress<AdminPort>>,
    pub bearer_token: Option<String>,

    #[cfg(feature = "cloud")]
    pub cloud: crate::commands::cloud::CloudConfig,
}

pub const LOCAL_PROFILE: Profile = Profile::const_new("local");

impl CliConfig {
    pub fn local() -> Self {
        Self {
            environment_type: EnvironmentType::Default,

            ingress_base_url: Some(AdvertisedAddress::default()),
            admin_base_url: Some(AdvertisedAddress::default()),
            bearer_token: None,

            #[cfg(feature = "cloud")]
            cloud: crate::commands::cloud::CloudConfig::default(),
        }
    }
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnvironmentType {
    #[default]
    Default,
    #[cfg(feature = "cloud")]
    Cloud,
}

#[derive(Clone)]
pub struct CliEnv {
    pub config_home: PathBuf,
    pub config_file: PathBuf,
    pub environment_file: PathBuf,

    /// Default text editor for state editing
    pub editor: Option<String>,

    /// Current environment
    pub environment: Profile,
    pub environment_source: EnvironmentSource,
    /// Environment-specific config
    pub config: CliConfig,
}

#[derive(Clone)]
pub enum EnvironmentSource {
    Argument,
    Environment,
    File,
    None,
}

impl Display for EnvironmentSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Argument => write!(f, "argument"),
            Self::Environment => write!(f, "${ENVIRONMENT_ENV}"),
            Self::File => write!(f, "file"),
            Self::None => write!(f, "default"),
        }
    }
}

impl CliEnv {
    /// Uses GlobalOpts to override some options and to set others that are
    /// not accessible through the config/env.
    pub fn load(global_opts: &GlobalOpts) -> Result<Self> {
        let os_env = OsEnv::default();
        Self::load_from_env(&os_env, global_opts)
    }

    /// Loading CliEnv with a custom OsEnv. OsEnv can be customised in cfg(test)
    pub fn load_from_env(os_env: &OsEnv, global_opts: &GlobalOpts) -> Result<Self> {
        let config_home = os_env
            .get(CLI_CONFIG_HOME_ENV)
            .map(|x| Ok(PathBuf::from(x)))
            .unwrap_or_else(default_config_home)?;

        let config_file = os_env
            .get(CLI_CONFIG_FILE_ENV)
            .map(PathBuf::from)
            .unwrap_or_else(|| config_home.join(CONFIG_FILENAME));

        let environment_file = config_home.join(ENVIRONMENT_FILENAME);

        let (environment, environment_source) = if let Some(environment) = &global_opts.environment
        {
            // 1. command line argument
            (environment.clone(), EnvironmentSource::Argument)
        } else if let Some(environment) = os_env.get(ENVIRONMENT_ENV) {
            // 2. RESTATE_ENVIRONMENT env
            (Profile::new(&environment), EnvironmentSource::Environment)
        } else if environment_file.is_file() {
            // 3. environment file
            (
                Profile::new(std::fs::read_to_string(&environment_file)?.trim()),
                EnvironmentSource::File,
            )
        } else {
            // 4. default to 'local'
            (LOCAL_PROFILE, EnvironmentSource::None)
        };

        let default_editor = os_env
            .get(EDITOR_ENV)
            .or_else(|| os_env.get("VISUAL"))
            .or_else(|| os_env.get("EDITOR"));

        let defaults = CliConfig::default();
        let local = CliConfig::local();

        let mut figment = Figment::from(Serialized::defaults(defaults))
            .merge(Serialized::from(local, LOCAL_PROFILE))
            .select(environment.clone());

        // Load configuration file
        if config_file.as_path().is_file() {
            figment = figment.merge(Toml::file_exact(config_file.as_path()).nested());
        };
        figment = Self::merge_with_env(os_env, figment)?;

        Ok(Self {
            config_home,
            config_file,
            environment_file,
            editor: default_editor,
            environment,
            environment_source,
            config: figment.extract()?,
        })
    }

    fn merge_with_env(os_env: &OsEnv, figment: Figment) -> Result<Figment> {
        let figment = if let Some(restate_host) = os_env.get(RESTATE_HOST_ENV) {
            let restate_host_scheme = os_env
                .get(RESTATE_HOST_SCHEME_ENV)
                .as_deref()
                .unwrap_or(RESTATE_HOST_SCHEME_DEFAULT)
                .to_owned();

            figment
                .merge((
                    "ingress_base_url",
                    Url::parse(&format!("{restate_host_scheme}://{restate_host}:8080/"))?,
                ))
                .merge((
                    "admin_base_url",
                    Url::parse(&format!("{restate_host_scheme}://{restate_host}:9070/"))?,
                ))
        } else {
            figment
        };

        let figment = if let Some(ingress_url) = os_env.get(INGRESS_URL_ENV) {
            figment.merge(("ingress_base_url", Url::parse(&ingress_url)?))
        } else {
            figment
        };

        let figment = if let Some(admin_url) = os_env.get(ADMIN_URL_ENV) {
            figment.merge(("admin_base_url", Url::parse(&admin_url)?))
        } else {
            figment
        };

        let figment = if let Some(bearer_token) = os_env.get(RESTATE_AUTH_TOKEN_ENV) {
            figment.merge(("bearer_token", bearer_token))
        } else {
            figment
        };

        Ok(figment)
    }

    /// Opens `path` in the user's editor. In non-interactive mode it fails instead,
    /// suggesting `alternative` (e.g. the matching `patch` command).
    pub fn open_default_editor(&self, path: &Path, alternative: &str) -> anyhow::Result<()> {
        if !restate_cli_util::CliContext::get().is_interactive() {
            return Err(crate::error::RestateCliError::bad_input(format!(
                "cannot open an editor in non-interactive mode; {alternative}"
            ))

```

### Core Architecture Module: `cli/src/clients/admin_client.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! A wrapper client for admin HTTP service.

use std::borrow::Cow;
use std::collections::HashMap;
use std::time::Duration;

use anyhow::bail;
use http::StatusCode;
use serde::{Serialize, de::DeserializeOwned};
use tracing::{debug, info};
use url::Url;

use restate_admin_rest_model::version::{AdminApiVersion, VersionInformation};
use restate_cli_util::{CliContext, c_warn};
use restate_types::SemanticRestateVersion;
use restate_types::net::address::PeerNetAddress;

use crate::build_info;
use crate::cli_env::CliEnv;
use crate::clients::AdminClientInterface;

use super::errors::{ApiError, ApiErrorBody, ClientError};

/// Min/max supported admin API versions
pub const MIN_ADMIN_API_VERSION: AdminApiVersion = AdminApiVersion::V2;
pub const MAX_ADMIN_API_VERSION: AdminApiVersion = AdminApiVersion::V5;

/// A lazy wrapper around a reqwest response that deserializes the body on
/// demand and decodes our custom error body on non-2xx responses.
pub struct Envelope<T> {
    inner: reqwest::Response,

    _phantom: std::marker::PhantomData<T>,
}

impl<T> Envelope<T>
where
    T: DeserializeOwned,
{
    pub fn status_code(&self) -> StatusCode {
        self.inner.status()
    }

    pub fn url(&self) -> &Url {
        self.inner.url()
    }

    pub async fn into_body(self) -> Result<T, ClientError> {
        let http_status_code = self.inner.status();
        let url = self.inner.url().clone();
        if !self.status_code().is_success() {
            let body = self.inner.text().await?;
            info!("Response from {} ({})", url, http_status_code);
            info!("  {}", body);
            // Wrap the error into ApiError
            return Err(ClientError::Api(ApiError {
                http_status_code,
                url: url.into(),
                body: ApiErrorBody::parse(body),
            }));
        }

        debug!("Response from {} ({})", url, http_status_code);
        let body = self.inner.text().await?;
        debug!("  {}", body);
        Ok(serde_json::from_str(&body)?)
    }

    pub async fn into_api_error(self) -> Result<ApiError, ClientError> {
        let http_status_code = self.inner.status();
        let url = self.inner.url().clone();

        debug!("Response from {} ({})", url, http_status_code);
        let body = self.inner.text().await?;
        debug!("  {}", body);
        Ok(ApiError {
            http_status_code,
            url: url.into(),
            body: ApiErrorBody::parse(body),
        })
    }

    pub async fn into_text(self) -> Result<String, ClientError> {
        Ok(self.inner.text().await?)
    }
    pub fn success_or_error(self) -> Result<StatusCode, ClientError> {
        let http_status_code = self.inner.status();
        let url = self.inner.url().clone();
        info!("Response from {} ({})", url, http_status_code);
        match self.inner.error_for_status() {
            Ok(_) => Ok(http_status_code),
            Err(e) => Err(ClientError::Network(e)),
        }
    }
}

impl<T> From<reqwest::Response> for Envelope<T> {
    fn from(value: reqwest::Response) -> Self {
        Self {
            inner: value,
            _phantom: Default::default(),
        }
    }
}

/// A handy client for the admin HTTP service.
#[derive(Clone)]
pub struct AdminClient {
    pub(crate) inner: reqwest::Client,
    pub(crate) base_url: Url,
    pub(crate) bearer_token: Option<String>,
    pub(crate) request_timeout: Duration,
    pub(crate) admin_api_version: AdminApiVersion,
    pub(crate) restate_server_version: SemanticRestateVersion,
    pub(crate) advertised_ingress_address: Option<String>,
    pub(crate) experimental_features: HashMap<Cow<'static, str>, bool>,
}

impl AdminClient {
    pub async fn new(env: &CliEnv) -> anyhow::Result<Self> {
        let advertised_address = env.admin_base_url()?.clone();

        let builder = reqwest::Client::builder()
            .user_agent(format!(
                "{}/{} {}-{}",
                env!("CARGO_PKG_NAME"),
                build_info::RESTATE_CLI_VERSION,
                std::env::consts::OS,
                std::env::consts::ARCH,
            ))
            .connect_timeout(CliContext::get().connect_timeout())
            .danger_accept_invalid_certs(CliContext::get().insecure_skip_tls_verify());

        let (raw_client, base_url) = match advertised_address.into_address()? {
            PeerNetAddress::Uds(path_buf) => {
                let client = builder.unix_socket(path_buf).build()?;
                (client, "http://localhost/".parse().unwrap())
            }
            PeerNetAddress::Http(uri) => {
                let client = builder.build()?;
                // forced to go to string and back because those are two types (Uri vs. Url)
                (client, uri.to_string().parse()?)
            }
        };

        let bearer_token = env.bearer_token()?.map(str::to_string);

        let client = Self {
            inner: raw_client,
            base_url,
            bearer_token,
            request_timeout: CliContext::get().request_timeout(),
            admin_api_version: AdminApiVersion::Unknown,
            restate_server_version: SemanticRestateVersion::unknown(),
            advertised_ingress_address: None,
            experimental_features: HashMap::new(),
        };

        if let Ok(envelope) = client.version().await {
            match envelope.into_body().await {
                Ok(version_information) => {
                    return Self::choose_api_version(client, version_information);
                }
                Err(err) => debug!("Failed parsing the version information: {err}"),
            }
        }

        // we couldn't validate the admin API. This could mean that the server is not running or
        // runs an old version which does not support version information. Query the health endpoint
        // to see whether the server is reachable and fail if not.
        // Keep the cause so the failure is classified (network vs. auth) for exit codes.
        if let Err(err) = client
            .health()
            .await
            .map_err(ClientError::from)
            .and_then(|r| r.success_or_error())
        {
            return Err(anyhow::Error::new(err).context(format!(
                "Unable to connect to the Restate server '{}'; make sure that it is running and reachable",
                client.base_url
            )));
        }

        c_warn!(
            "Could not verify the admin API version. Please make sure that your CLI is compatible with the Restate server '{}'.",
            client.base_url
        );
        Ok(client)
    }

    pub fn versioned_url(&self, path: impl IntoIterator<Item = impl AsRef<str>>) -> Url {
        let mut url = self.base_url.clone();

        {
            let mut segments = url.path_segments_mut().expect("Bad url!");
            segments.pop_if_empty();

            match self.admin_api_version {
                AdminApiVersion::Unknown => segments.extend(path),
                // v1 clusters didn't support versioned urls
                AdminApiVersion::V1 => segments.extend(path),
                AdminApiVersion::V2 => segments.push("v2").extend(path),
                AdminApiVersion::V3 => segments.push("v3").extend(path),
                AdminApiVersion::V4 => segments.push("v4").extend(path),
                AdminApiVersion::V5 => segments.push("v5").extend(path),
            };
        }

        url
    }

    pub(crate) fn is_experimental_feature_enabled(&self, feature: &str) -> bool {
        self.experimental_features
            .get(feature)
            .copied()
            .unwrap_or(
```

### Core Architecture Module: `cli/src/clients/admin_interface.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use super::AdminClient;
use super::admin_client::Envelope;
use futures::StreamExt;
use futures::stream;
use http::{Uri, Version};
use indicatif::ProgressBar;
use restate_admin_rest_model::deployments::*;
use restate_admin_rest_model::invocations::RestartAsNewInvocationResponse;
use restate_admin_rest_model::kafka_clusters::*;
use restate_admin_rest_model::rules::*;
use restate_admin_rest_model::services::*;
use restate_admin_rest_model::subscriptions::*;
use restate_admin_rest_model::version::VersionInformation;
use restate_futures_util::streams::StreamExt as RestateStreamExt;
use restate_serde_util::SerdeableHeaderHashMap;
use restate_types::identifiers::{DeploymentId, LambdaARN};
use restate_types::schema::deployment::ProtocolType;
use restate_types::schema::service::ServiceMetadata;
use std::collections::HashMap;

const MAX_PARALLEL_REQUESTS: usize = 500;

pub trait AdminClientInterface {
    /// Check if the admin service is healthy by invoking /health
    fn health(&self) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;
    fn get_services(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListServicesResponse>>> + Send + 'static;
    fn get_service(
        &self,
        name: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<ServiceMetadata>>> + Send + 'static;
    fn patch_service(
        &self,
        name: &str,
        modify_service_request: ModifyServiceRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<ServiceMetadata>>> + Send + 'static;
    fn get_deployments(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListDeploymentsResponse>>> + Send + 'static;
    fn get_deployment<D: AsRef<str>>(
        &self,
        id: D,
    ) -> impl Future<Output = reqwest::Result<Envelope<DetailedDeploymentResponse>>> + Send + 'static;
    fn remove_deployment(
        &self,
        id: &str,
        force: bool,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn discover_deployment(
        &self,
        body: RegisterDeploymentRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<RegisterDeploymentResponse>>> + Send + 'static;

    fn cancel_invocation(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn resume_invocation(
        &self,
        id: &str,
        deployment: Option<&str>,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn kill_invocation(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn purge_invocation(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn restart_invocation(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<RestartAsNewInvocationResponse>>> + Send + 'static;

    fn pause_invocation(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn pause_vqueue(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn resume_vqueue(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn patch_state(
        &self,
        service: &str,
        req: ModifyServiceStateRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    fn version(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<VersionInformation>>> + Send + 'static;

    // --- Kafka clusters ----------------------------------------------------

    fn list_kafka_clusters(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListKafkaClustersResponse>>> + Send + 'static;

    fn get_kafka_cluster(
        &self,
        name: &str,
        include_subscriptions: bool,
    ) -> impl Future<Output = reqwest::Result<Envelope<KafkaClusterResponse>>> + Send + 'static;

    fn create_kafka_cluster(
        &self,
        body: CreateKafkaClusterRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<SimpleKafkaClusterResponse>>> + Send + 'static;

    fn update_kafka_cluster(
        &self,
        name: &str,
        body: UpdateKafkaClusterRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<SimpleKafkaClusterResponse>>> + Send + 'static;

    fn delete_kafka_cluster(
        &self,
        name: &str,
        force: bool,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    // --- Subscriptions -----------------------------------------------------

    fn list_subscriptions(
        &self,
        sink: Option<&str>,
        source: Option<&str>,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListSubscriptionsResponse>>> + Send + 'static;

    fn get_subscription(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<SubscriptionResponse>>> + Send + 'static;

    fn create_subscription(
        &self,
        body: CreateSubscriptionRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<SubscriptionResponse>>> + Send + 'static;

    fn delete_subscription(
        &self,
        id: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static;

    // --- Rules -------------------------------------------------------------

    fn upsert_rules(
        &self,
        body: Vec<UpsertRuleRequest>,
    ) -> impl Future<Output = reqwest::Result<Envelope<Vec<RuleResponse>>>> + Send + 'static;

    fn delete_rules(
        &self,
        body: Vec<DeleteRuleRequest>,
    ) -> impl Future<Output = reqwest::Result<Envelope<Vec<String>>>> + Send + 'static;
}

impl AdminClientInterface for AdminClient {
    fn health(&self) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static {
        let url = self.versioned_url(["health"]);
        self.run(reqwest::Method::GET, url)
    }

    fn get_services(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListServicesResponse>>> + Send + 'static
    {
        let url = self.versioned_url(["services"]);
        self.run(reqwest::Method::GET, url)
    }

    fn get_service(
        &self,
        name: &str,
    ) -> impl Future<Output = reqwest::Result<Envelope<ServiceMetadata>>> + Send + 'static {
        let url = self.versioned_url(["services", name]);
        self.run(reqwest::Method::GET, url)
    }

    fn patch_service(
        &self,
        name: &str,
        modify_service_request: ModifyServiceRequest,
    ) -> impl Future<Output = reqwest::Result<Envelope<ServiceMetadata>>> + Send + 'static {
        let url = self.versioned_url(["services", name]);
        self.run_with_body(reqwest::Method::PATCH, url, modify_service_request)
    }

    fn get_deployments(
        &self,
    ) -> impl Future<Output = reqwest::Result<Envelope<ListDeploymentsResponse>>> + Send + 'static
    {
        let url = self.versioned_url(["deployments"]);
        self.run(reqwest::Method::GET, url)
    }

    fn get_deployment<D: AsRef<str>>(
        &self,
        id: D,
    ) -> impl Future<Output = reqwest::Result<Envelope<DetailedDeploymentResponse>>> + Send + 'static
    {
        let url = self.versioned_url(["deployments", id.as_ref()]);
        self.run(reqwest::Method::GET, url)
    }

    fn remove_deployment(
        &self,
        id: &str,
        force: bool,
    ) -> impl Future<Output = reqwest::Result<Envelope<()>>> + Send + 'static {
```

### Core Architecture Module: `cli/src/clients/cloud/client.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! A wrapper client for Restate Cloud HTTP service.

use std::time::Duration;

use http::StatusCode;
use serde::{Serialize, de::DeserializeOwned};
use tracing::{debug, info};
use url::Url;

use restate_cli_util::CliContext;

use crate::build_info;
use crate::cli_env::CliEnv;

use super::super::errors::{ApiError, ApiErrorBody, ClientError};

/// A lazy wrapper around a reqwest response that deserializes the body on
/// demand and decodes our custom error body on non-2xx responses.
pub struct Envelope<T> {
    inner: reqwest::Response,

    _phantom: std::marker::PhantomData<T>,
}

impl<T> Envelope<T>
where
    T: DeserializeOwned,
{
    pub fn status_code(&self) -> StatusCode {
        self.inner.status()
    }

    pub async fn into_body(self) -> Result<T, ClientError> {
        let http_status_code = self.inner.status();
        let url = self.inner.url().clone();
        if !self.status_code().is_success() {
            let body = self.inner.text().await?;
            info!("Response from {} ({})", url, http_status_code);
            info!("  {}", body);
            // Wrap the error into ApiError
            return Err(ClientError::Api(ApiError {
                http_status_code,
                url: url.into(),
                body: ApiErrorBody::parse(body),
            }));
        }

        debug!("Response from {} ({})", url, http_status_code);
        let body = self.inner.text().await?;
        debug!("  {}", body);
        Ok(serde_json::from_str(&body)?)
    }
}

impl<T> From<reqwest::Response> for Envelope<T> {
    fn from(value: reqwest::Response) -> Self {
        Self {
            inner: value,
            _phantom: Default::default(),
        }
    }
}

/// A handy client for the Cloud HTTP service.
#[derive(Clone)]
pub struct CloudClient {
    pub(crate) inner: reqwest::Client,
    pub(crate) base_url: Url,
    pub(crate) access_token: String,
    pub(crate) request_timeout: Duration,
}

impl CloudClient {
    pub fn new(env: &CliEnv) -> anyhow::Result<Self> {
        let access_token = if let Some(credentials) = &env.config.cloud.credentials {
            credentials.access_token()?.to_string()
        } else {
            return Err(anyhow::anyhow!(
                "Restate Cloud credentials have not been provided; first run `restate cloud login`"
            ));
        };

        let raw_client = reqwest::Client::builder()
            .user_agent(format!(
                "{}/{} {}-{}",
                env!("CARGO_PKG_NAME"),
                build_info::RESTATE_CLI_VERSION,
                std::env::consts::OS,
                std::env::consts::ARCH,
            ))
            .connect_timeout(CliContext::get().connect_timeout())
            .build()?;

        Ok(Self {
            inner: raw_client,
            base_url: env.config.cloud.api_base_url(),
            access_token,
            request_timeout: CliContext::get().request_timeout(),
        })
    }

    /// Prepare a request builder for the given method and path.
    fn prepare(&self, method: reqwest::Method, path: Url) -> reqwest::RequestBuilder {
        self.inner
            .request(method, path)
            .timeout(self.request_timeout)
            .header(
                http::header::CONTENT_TYPE,
                http::HeaderValue::from_static("application/json"),
            )
            .bearer_auth(&self.access_token)
    }

    /// Prepare a request builder that encodes the body as JSON.
    fn prepare_with_body<B>(
        &self,
        method: reqwest::Method,
        path: Url,
        body: B,
    ) -> reqwest::RequestBuilder
    where
        B: Serialize,
    {
        self.prepare(method, path).json(&body)
    }

    /// Execute a request and return the response as a lazy Envelope.
    pub(crate) async fn run<T>(
        &self,
        method: reqwest::Method,
        path: Url,
    ) -> reqwest::Result<Envelope<T>>
    where
        T: DeserializeOwned + Send,
    {
        debug!("Sending request {} ({})", method, path);
        let request = self.prepare(method, path.clone());
        let resp = request.send().await?;
        debug!("Response from {} ({})", path, resp.status());
        Ok(resp.into())
    }

    pub(crate) async fn run_with_body<T, B>(
        &self,
        method: reqwest::Method,
        path: Url,
        body: B,
    ) -> reqwest::Result<Envelope<T>>
    where
        T: DeserializeOwned + Send,
        B: Serialize + std::fmt::Debug + Send,
    {
        debug!("Sending request {} ({}): {:?}", method, path, body);
        let request = self.prepare_with_body(method, path.clone(), body);
        let resp = request.send().await?;
        debug!("Response from {} ({})", path, resp.status());
        Ok(resp.into())
    }
}

// Ensure that CloudClient is Send + Sync. Compiler will fail if it's not.
const _: () = {
    const fn assert_send<T: Send + Sync>() {}
    assert_send::<CloudClient>();
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5416** (2026-09-28): **StateMutation EntryId is not consistent across replicas**
  *Symptoms*: `ExternalStateMutations` don't have an id associated with them. That's why we are generating one when enqueuing them in a vqueue (https://github.com/restatedev/restate/blob/092b2e06306b2392b194d142a8dce1de1bc1997e/crates/worker/src/partition/state_machine/mod.rs#L5309). The problem is that every replica does this independently and therefore might end up with the same state mutation being stored under different ids. If now the leader makes a decision to apply a given state mutation, the other replicas might not find it under the specified id. The result is that the replicas' state diverges.
  **Post-Mortem & Fix Analysis**:
  > ## Proposed course of action  ### Background  When vqueues are enabled, every replica generates its own random `StateMutationId` when enqueuing an `ExternalStateMutation`. Scheduler decisions reference entries by the leader's id, so a follower may not find the entry, skips the decision and never applies the mutation. This only affects partitions with more than one replica on which the state API (`POST /services/{service}/state`, e.g. via `restate state edit|patch|clear`) was used while vqueues were enabled.  All other parts of the vqueue entry key (`has_lock`, `run_at` and `seq`, which is the LSN of the command) are identical across replicas. Only the entry id differs.  We propose to split the work into two steps.  ### Step 1: Make the state mutation id consistent (the fix)  1. **Deterministic id.** Derive the id from the command's position in the log, e.g. `StateMutationId::from_parts(partition_key, record_created_at, lsn)`, instead of generating a random one. 2. **Id set by the admin

- **Issue #5401** (2026-09-24): **[UI][Virtual Objects] No instances are shown for my service.**
  *Symptoms*: I am sure I have a VO instance under my service (Counter) but navigating to the VO page doesn't show it initially.   <img width="3608" height="2932" alt="Image" src="https://github.com/user-attachments/assets/9df44af5-5c26-4371-882b-2827aee9ea43" />  Running the query `select * from sys_vqueue_meta where service_name='Counter' limit 10;` shows one row with my key.  The page however runs this query ``` SELECT DISTINCT       CAST(partition_key AS VARCHAR) AS partition_key,       lock_name,       scope     FROM sys_vqueue_meta     WHERE service_name = 'Counter'       AND lock_name IS NOT NULL       AND (         num_inbox > 0         OR num_running > 0         OR num_suspended > 0         OR num_paused > 0       )     LIMIT 51 ```  The query shows that we only shows VOs with "active" entries (invocation is inboxed, running, suspended or paused) which is fine.   But this is not clear when I clicked the page. Is this intentionally ?  What makes this even weirder, is that when I searched for my key, and it found the object, now going to the `Counter` VO page lists the instance.  <img width="3612" height="1790" alt="Image" src="https://github.com/user-attachments/assets/2df48994-9809-4caa-8cb0-ced92f35b6a0" />  I assume it's now cached in local storage.  Suggestions: - Make it clear in the page that this is showing only "active" instances. - Or drop the `where` clause that filters out "inactive" instances.
  **Post-Mortem & Fix Analysis**:
  > cc @nikrooz 
  > This was intentional as querying the `state` or completed invocations made the page quite slow. This is being addressed with the addition of `sys_virtual_object_stats` table I have already updated the text to make sure it's clear you are only looking at the VOs with active invocations. 

- **Issue #5375** (2026-09-21): **Race: a notification appended while an attempt is starting can be delivered twice (replay + forward)**
  *Symptoms*: ## Summary  A journal notification can be sent to the SDK **twice** — once as part of the journal replay, and once as a live forwarded notification — if it is appended to the journal in the short window while an attempt is starting up.  The SDK then sees the same notification two times. For a cancel signal this means a `cancellation()` promise that should still be pending resolves immediately.  ## The race  There are two independent paths that carry a journal entry to the SDK:  * **Replay** — the invocation task reads the journal itself and streams entries `0..journal_size` to the deployment. * **Forward** — the partition processor pushes `Action::ForwardNotification { entry_index }` whenever it appends a notification, and the invoker writes that entry to the wire.  Nothing correlates the two. The problem is the ordering in [`start_invocation_task`](https://github.com/restatedev/restate/blob/1f6d9c63dba12cc1cc9fcaae05e3495d2c924124/crates/invoker-impl/src/lib.rs#L1513-L1532):  ```rust // crates/invoker-impl/src/lib.rs let abort_handle = self.invocation_task_runner.start_invocation_task(/* … */);  // L1515 — task spawned // … ism.start(abort_handle, completions_tx);                                        // L1532 — ISM -> InFlight ```  `ism.start()` puts the state machine into `InFlight`, which is what makes it start forwarding notifications. But the spawned task has **not read the journal yet** — it does that later, asynchronously, from its own transaction:  ```rust // crates
  **Post-Mortem & Fix Analysis**:
  > @slinkydeveloper I would appreciate your input on this one. I am thinking the InvocationTask can filter out notifications that has already been replayed. But would help to understand how double delivery like this is handled in the sdk or the shared-core.
  > @muhamadazmy the runtime must definitely make sure it doesnt send the same notification twice. This one sounds like an important correctness bug to address.

- **Issue #5274** (2026-09-14): **[vqueue] Bug repro: vqueues re-ingesting stale entries from inbox after entry confirmation **
  *Symptoms*: A bug that is causing vqueue invocations to go orphaned and ignored by the scheduler. I put out two (AI generated) repros, one is minimal and one shows how the bug can cause an invocation to get stuck in Yielded state.   Rough explanation is as below.  It happens during an async refill of the vqueue. 1. There is an unconfirmed invocation (scheduler proposed, pending state machine) when async refill starts. 2. The invocation gets confirmed, hence scheduler removes the invocation from its memory. 3. The async refill finishes, and because it was started when the call was unconfirmed, it puts the invocation back in memory. [This step is the bug; rest is the repro on how this causes stuck invocations.] 4. The invocation that was sent then legitimately yields and goes back into the durable inbox. 5. During the next refill when the scheduler encounters this (legitimately re-yielded invocation), it ignores it, because it thinks that the call is still unconfirmed.  I didn't add the solution, but maybe one of the below could solve this? - During async refill, if you get a confirmation, put in a corresponding Tombstone into your overlay. - Have some sort of a feedback mechanism if the scheduler's proposed invocation is rejected.
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > Can you confirm which version you are testing against?
  > This was tested against both 1.7.7 and on today's main.

- **Issue #5238** (2026-08-31): **Run orphaned jc cleanup synchronously behind an opt-in**
  *Symptoms*: ## Context  The orphaned `jc` cleanup currently runs in the background while the partition processor can apply new work. Its orphan decision and subsequent point deletions are not atomic.  Idempotent invocations and workflows can reuse deterministic invocation IDs. If an old invocation has been classified as orphaned while the partition processor creates a new journal for the same invocation ID, cleanup can delete newly legitimate `jc` entries.  The cleanup must therefore not overlap partition processing. Because it scans the complete `jc` table and may delay partition availability, operators need to opt in until its cost has been measured on representative databases.  Depends on #5237.  ## Scope  - Add a false-by-default experimental opt-in for the one-time orphaned `jc` cleanup. - When disabled, do not run cleanup and leave its completion marker unset so it can be enabled later. - Continue marking fresh stores complete without scanning because they cannot contain historical orphaned entries. - When enabled, run cleanup after storage migrations and before the partition processor starts reading or applying Bifrost records. - Execute the blocking RocksDB scan off the async runtime but await its completion before processing work. - On cancellation or failure, leave the marker unset and retry on the next opted-in startup. - On cleanup failure, fail partition startup rather than processing work concurrently. - Instrument cleanup so its startup cost can be measured on real stores.
  **Post-Mortem & Fix Analysis**:
  > One of the underlying problems is that we are reusing invocations ids across different invocations (e.g. in case of idempotent invocations). With the canonical id which includes the sequence number, this problem wouldn't exist. Unfortunately, we don't have that yet.

- **Issue #5237** (2026-08-27): **Make orphaned jc cleanup fail closed**
  *Symptoms*: ## Context  The one-time cleanup of orphaned `JournalCompletionIdToCommandIndex` (`jc`) entries currently determines whether an invocation still owns a journal through a RocksDB iterator. There are two unsafe failure modes:  - The journal-existence check treats `iterator.item() == None` as absence without checking `iterator.status()`. A read failure can therefore classify a live journal as absent and delete `jc` entries that are still in use. - The outer `jc` iterator also treats iterator failure as normal exhaustion. Cleanup can stop part-way, return success, and persist its completion marker even though part of the table was not inspected.  A V2 journal entry at index `0` is the ownership sentinel: while it exists, the invocation owns the journal and is responsible for cleaning up the journal together with its indexes.  ## Scope  - Replace the per-invocation journal prefix iterator with one point lookup of `j2[0]`. - Cache that ownership decision for all contiguous `jc` entries belonging to the invocation, preserving one lookup per invocation rather than one lookup per `jc` entry. - Propagate point-read errors instead of interpreting them as absence. - Make the outer `jc` scan distinguish verified exhaustion from iterator failure. - Persist the cleanup completion marker only after an uncancelled scan reaches verified exhaustion. - Report how many `jc` entries and invocations were scanned, in addition to the existing deletion counts.  Concurrent changes by a running partitio

- **Issue #5235** (2026-08-27): **SIGUSR2 task dump can abort a server on `current_thread` runtimes**
  *Symptoms*: Sending `SIGUSR2` to `restate-server` caused an unplanned node restart while it was serving invocation traffic.  The panic occurred on `rt:pp-0`, a partition-processor `current_thread` runtime. Tokio task dumping re-polls live task futures to collect backtraces. In this case, re-polling an in-flight `h2` connection woke a task while the `current_thread` scheduler's `RefCell` was already borrowed, causing the initial panic. A subsequent `h2` panic while unwinding turned that panic into a process abort.  `SIGUSR2` is a documented diagnostic mechanism, so it should degrade to a partial dump rather than terminate the server.  ## Observed sequence  The initial panic occurred within roughly 7 ms of receiving the signal, thread `rt:pp-0`.  1. `Received SIGUSR2, dumping tokio task backtraces` 2. Initial panic in Tokio's `current_thread` scheduler: `tokio-1.53.1/src/runtime/scheduler/current_thread/mod.rs:723`, `RefCell already borrowed`, via `trace::Root::poll` → `pool::conn::Connection::drive_handshake` → `h2 Connection::poll` → `h2 Stream::send_data` → `wake_by_val` → `current_thread::schedule` 3. Panic while unwinding in `h2`: `h2-0.4.18/src/proto/streams/streams.rs:1571`, `unwrap()` on `PoisonError`, via `trace::Root::poll` → `InvocationTask::run` → `ServiceProtocolRunner::run` 4. Fatal destructor panic during cleanup, again at the same `h2` site: `drop_in_place<h2::share::RecvStream>` → `drop_in_place<restate_service_client::http::ResponseBody>` → `DecoderStream` / `ThrottledStr
  **Post-Mortem & Fix Analysis**:
  > We might be looking at a problem in Tokio here. Based on some superficial investigation it seems that dumping the tasks follows a slightly different path then normal task polling. One difference is that a borrow to the `context.core` is kept across polling tasks which can lead to the described problem if the tasks wants to synchronously schedule another task. Note that Tokio's task dump feature is still unstable so this might not be unexpected.  If it is indeed a Tokio problem, then I'd suggest to disable this feature until it gets properly fixed upstream and we can rely on it again.
  > As a temporary solution to prevent us from shooting ourselves in the foot, I'll disable the task dump feature.
  > I've created https://github.com/tokio-rs/tokio/issues/8391 for tracking the problem on Tokio's side. Once it's resolved and we update our Tokio dependency, we can re-enable the task dump feature.

- **Issue #5151** (2026-09-22): **GCP ID-token mint failures can exhaust process threads and crash the server**
  *Symptoms*: ## Summary  Failures while minting Google ID tokens through the GCP metadata server can cause rapid growth in SDK refresh tasks, blocking DNS operations, and Tokio worker threads.  I ran into repeated token-mint timeouts followed by process-wide thread exhaustion when doing unrelated tests where the GCP minting endpoint was not reachable and I had many in-flight invocations.   Unrelated RocksDB workers subsequently failed to create threads, and the process terminated.  ## Observed behavior  Immediately before the reported failure, the server logged many retries for the same audience:  ```text Invocation error, retrying ... error minting GCP ID token ...: token mint timed out after 5s ```  Thread creation eventually failed with `EAGAIN` / `Resource temporarily unavailable`. The RocksDB failure appears to have been a secondary consequence of process-wide resource exhaustion rather than the originating storage problem.  ## Suspected problem  Restate caches successfully minted token strings, but it does not retain credential providers or coalesce an in-progress mint.  Concurrent cache misses for the same authentication key can therefore:  1. Construct separate Google credential providers. 2. Start separate token acquisitions. 3. Start separate SDK refresh tasks for metadata credentials.  The SDK refresh task is detached from the credential object. When Restate's five-second timeout drops the minting future and credential object, the refresh task does not stop when its token-cache
  **Post-Mortem & Fix Analysis**:
  > @pcholakov and @slinkydeveloper can you help me validate this problem? From briefly looking over the code it seems that the GCP token minting does not properly manage the lifecycle of tasks and resources it creates in the presence of retries (see the `TokenCache::new` where it spawns Tokio tasks whose lifecycle might be unbounded).
  > I'll take a look, @tillrohrmann! This sounds nasty.
  > The root cause is pretty clear; `google-cloud-auth` starts a background token-refresh task when it builds an ID-token credential :-( On any transient failures the task retries indefinitely. Dropping the credential doesn't stop it the task - it owns the `watch` sender and doesn't observe that its receivers have gone away.  In Restate, this escalates because service clients for partition leaders and repeated timeouts can request yet more credentials for the same GCP target. Each constructed credential leaves another refresh task running, eventual exhausting resources.  I opened #5154 with a quick containment fix:  - Share credential providers process-wide, keyed by `(audience, impersonated service account)`, and single-flight their construction. - Retain successful providers rather than evicting them, because eviction doesn't stop the upstream refresh task. - Cap provider entries, including in-flight construction, at 128 by default. The limit is configurable with `worker.invoker.gcp-id-t

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

### Incident Patch 1: `4af7ee74` (2026-09-22)
**Commit Message**: [config] Fix default config value serde for rocksdb_max_successive_merges (#5382)

**File**: `crates/types/src/config/worker.rs` (modified, +8/-1)
```diff
@@ -952,7 +952,10 @@ pub struct StorageOptions {
     ///
     /// Since v1.7.8
     #[cfg_attr(feature = "schemars", schemars(skip))]
-    #[serde(default, skip_serializing_if = "is_default_max_successive_merges")]
+    #[serde(
+        default = "default_max_successive_merges",
+        skip_serializing_if = "is_default_max_successive_merges"
+    )]
     pub rocksdb_max_successive_merges: u16,
 }
 
@@ -1054,6 +1057,10 @@ impl Default for StorageOptions {
     }
 }
 
+fn default_max_successive_merges() -> u16 {
+    DEFAULT_MAX_SUCCESSIVE_MERGES
+}
+
 fn is_default_max_successive_merges(i: &u16) -> bool {
     *i == DEFAULT_MAX_SUCCESSIVE_MERGES
 }
```

---

### Incident Patch 2: `1ecb4147` (2026-09-22)
**Commit Message**: Cache GCP ID-token credentials process-wide, fixing leaked refresh tasks (#5154)

* Bump google-cloud-auth to 1.15 and add moka to service-client

Needed for the GCP credential-registry rework: eviction soundness for
cached credentials depends on 1.15's receiver_count() check in the
refresh-task loop, and moka backs the new process-global credential
cache. Requirement bump, not lockfile-only. Regenerated
workspace-hack for the moka future feature.

* Cache GCP ID-token credential objects in a process-global registry

google-cloud-auth credentials are actors: every build() spawns a
background refresh task that lives as long as anything holds a clone
of the credential. gcp.rs used credentials as one-shot token
factories (build -> id_token() -> drop), stranding a refresh task on
every mint attempt -- one to two per hour in steady state, or
unbounded during an outage with per-attempt retries (restatedev/restate#5151).

Replace the token-string cache with a process-global registry, keyed
by (impersonate_service_account, audience), that caches the
credential objects themselves. Every GcpTokenClient is a cheap handle
to the same registry, so each distinct GCP identity owns at most one
ref

**File**: `Cargo.lock` (modified, +72/-33)
```diff
@@ -270,7 +270,7 @@ dependencies = [
  "arrow-schema",
  "arrow-select",
  "atoi",
- "base64",
+ "base64 0.22.1",
  "chrono",
  "comfy-table",
  "half",
@@ -501,6 +501,17 @@ dependencies = [
  "tokio",
 ]
 
+[[package]]
+name = "async-lock"
+version = "3.4.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "290f7f2596bd5b78a9fec8088ccd89180d7f9f55b94b0576823bbbdc72ee8311"
+dependencies = [
+ "event-listener",
+ "event-listener-strategy",
+ "pin-project-lite",
+]
+
 [[package]]
 name = "async-stream"
 version = "0.3.6"
@@ -651,7 +662,7 @@ dependencies = [
  "aws-sdk-sts",
  "aws-sigv4",
  "aws-types",
- "base64",
+ "base64 0.22.1",
  "chrono",
  "futures",
  "thiserror 1.0.69",
@@ -1137,6 +1148,12 @@ version = "0.22.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
+[[package]]
+name = "base64"
+version = "0.23.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ac07cdecf99051d9a5238b80f35af32cdeba5b336e55d957b318b50137e18da5"
+
 [[package]]
 name = "base64-simd"
 version = "0.8.0"
@@ -2658,7 +2675,7 @@ checksum = "5f64c983bbbdcb729d921a2b2ac3375598719b5cc0c30345ad664936f3176fc7"
 dependencies = [
  "arrow",
  "arrow-buffer",
- "base64",
+ "base64 0.22.1",
  "blake2",
  "blake3",
  "chrono",
@@ -3925,20 +3942,20 @@ checksum = "e4eba85ea1d0a966a983acd07deee566e67395d2d96b6fb39e62b5a833f1eb0b"
 
 [[package]]
 name = "google-cloud-auth"
-version = "1.15.0"
+version = "1.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f54aab44c16b8463ae11b165a87c3d484780231f157bb1ed65843d591beb5abd"
+checksum = "ff461519b1a948200f163574be072753bcfb462a323f0eb426629d89872dd685"
 dependencies = [
  "async-trait",
  "aws-lc-rs",
- "base64",
+ "base64 0.23.1",
  "bytes",
- "chrono",
  "google-cloud-gax",
  "hex",
  "hmac",
  "http 1.5.0",
- "jsonwebtoken 10.4.0",
+ "jiff",
+ "jsonwebtoken 11.1.0",
  "reqwest 0.13.4",
  "rustc_version",
  "rustls",
@@ -3954,9 +3971,9 @@ dependencies = [
 
 [[package]]
 name = "google-cloud-gax"
-version = "1.13.0"
+version = "1.14.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b9a46dd0fd026bbc4a5d84e6ab0c941cee6e3b057976a0bb107fdb5238ce598f"
+checksum = "c5615cff28ee59cfe52fbb4c11b8b1e77f650296e2ea4f4c2b7757ac6b19e752"
 dependencies = [
  "bytes",
  "futures",
@@ -3969,6 +3986,7 @@ dependencies = [
  "serde_json",
  "thiserror 2.0.20",
  "tokio",
+ "tokio-stream",
 ]
 
 [[package]]
@@ -3990,7 +4008,7 @@ version = "1.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7fccf98cfd5481a5f5a285181ab0c62123d7d47cd2bb7299448440649349e4e7"
 dependencies = [
- "base64",
+ "base64 0.22.1",
  "bytes",
  "serde",
  "serde_json",
@@ -4109,7 +4127,7 @@ version = "7.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f49d1053f4708f0af3cf9fc5bffc7e68a914a3c45becb231c80068c9c3f78bea"
 dependencies = [
- "base64",
+ "base64 0.22.1",
  "byteorder",
  "crossbeam-channel",
  "flate2",
@@ -4385,7 +4403,7 @@ version = "0.1.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "96547c2556ec9d12fb1578c4eaf448b04993e7fb79cbaad930a656880a6bdfa0"
 dependencies = [
- "base64",
+ "base64 0.22.1",
  "bytes",
  "futures-channel",
  "futures-util",
@@ -5017,7 +5035,7 @@ version = "9.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5a87cc7a48537badeae96744432de36f4be2b4a34a05a5ef32e9dd8a1c169dde"
 dependencies = [
- "base64",
+ "base64 0.22.1",
  "js-sys",
  "pem",
  "ring",
@@ -5033,7 +5051,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "eba32bfb4ffdeaca3e34431072faf01745c9b26d25504aa7a6cf5684334fc4fc"
 dependencies = [
  "aws-lc-rs",
- "base64",
+ "base64 0.22.1",
  "getrandom 0.2.17",
  "js-sys",
  "pem",
@@ -5044,6 +5062,22 @@ dependencies = [
  "zeroize",
 ]
 
+
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ futures-sink = "0.3.31"
 futures-util = "0.3.31"
 gardal = { version = "0.0.1-alpha.9" }
 generic-array = { version = "1.4.1" }
-google-cloud-auth = { version = "1.10", features = ["idtoken"] }
+google-cloud-auth = { version = "1.16", features = ["idtoken"] }
 googletest = { version = "0.10", features = ["anyhow"] }
 hashbrown = { version = "0.16" }
 slotmap = { version = "1" }
```

**File**: `crates/core/src/lib.rs` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ pub use metadata::{
     TargetVersion, migrate_metadata, spawn_metadata_manager,
 };
 pub use task_center::{
-    AsyncRuntime, MetadataFutureExt, RuntimeError, RuntimeTaskHandle, TaskCenter,
+    AsyncRuntime, Handle, MetadataFutureExt, RuntimeError, RuntimeTaskHandle, TaskCenter,
     TaskCenterBuildError, TaskCenterBuilder, TaskCenterFutureExt, TaskContext, TaskHandle, TaskId,
     TaskKind, cancellation_token, cancellation_watcher, is_cancellation_requested, my_node_id,
 };
```

**File**: `crates/core/src/task_center/task_kind.rs` (modified, +4/-0)
```diff
@@ -118,6 +118,10 @@ pub enum TaskKind {
     LogTrimmer,
     MetadataServer,
     Background,
+    /// Credential construction and cache maintenance. Failures surface through token minting and
+    /// are retried or rebuilt on later requests; housekeeping failure only delays cache cleanup.
+    #[strum(props(OnCancel = "abort", runtime = "default", OnError = "log"))]
+    Credentials,
     // -- Bifrost Tasks
     #[strum(props(runtime = "default"))]
     BifrostWatchdog,
```

**File**: `crates/invoker-impl/src/lib.rs` (modified, +64/-31)
```diff
@@ -31,6 +31,7 @@ use tokio_util::time::delay_queue::Key as RetryTimerKey;
 use tracing::instrument;
 use tracing::{debug, trace, warn};
 
+use restate_core::TaskCenterFutureExt;
 use restate_core::cancellation_token;
 use restate_errors::warn_it;
 use restate_memory::{ByteCount, LocalMemoryPool, MemoryLease, OutOfMemoryKind};
@@ -123,6 +124,23 @@ trait InvocationTaskRunner<SR> {
     ) -> AbortHandle;
 }
 
+/// `JoinSet` does not propagate TaskCenter task-locals; preserve the spawner's context for
+/// invocation code that needs it, including GCP credential construction.
+fn spawn_invocation_task<F>(
+    task_pool: &mut JoinSet<()>,
+    name: &'static str,
+    future: F,
+) -> AbortHandle
+where
+    F: Future<Output = ()> + Send + 'static,
+{
+    task_pool
+        .build_task()
+        .name(name)
+        .spawn(future.in_current_tc())
+        .expect("to spawn invocation task")
+}
+
 struct DefaultInvocationTaskRunner<Schemas> {
     client: ServiceClient,
     schemas: Live<Schemas>,
@@ -149,32 +167,30 @@ where
         task_pool: &mut JoinSet<()>,
         budget: LocalMemoryPool,
     ) -> AbortHandle {
-        task_pool
-            .build_task()
-            .name("invocation-task")
-            .spawn(
-                InvocationTask::new(
-                    self.client.clone(),
-                    invocation_id,
-                    fencing_token,
-                    invocation_target,
-                    opts.inactivity_timeout.into(),
-                    opts.abort_timeout.into(),
-                    opts.eager_state_size_limit(),
-                    opts.message_size_warning.as_non_zero_usize(),
-                    opts.message_size_limit(),
-                    retry_count_since_last_stored_entry,
-                    self.schemas.clone(),
-                    invoker_tx,
-                    invoker_rx,
-                    self.action_token_bucket.clone(),
-                    limit_key,
-                    idempotency_key,
-                    opts.max_awaited_future_depth,
-                )
-                .run(storage_reader, budget),
+        spawn_invocation_task(
+            task_pool,
+            "invocation-task",
+            InvocationTask::new(
+                self.client.clone(),
+                invocation_id,
+                fencing_token,
+                invocation_target,
+                opts.inactivity_timeout.into(),
+                opts.abort_timeout.into(),
+                opts.eager_state_size_limit(),
+                opts.message_size_warning.as_non_zero_usize(),
+                opts.message_size_limit(),
+                retry_count_since_last_stored_entry,
+                self.schemas.clone(),
+                invoker_tx,
+                invoker_rx,
+                self.action_token_bucket.clone(),
+                limit_key,
+                idempotency_key,
+                opts.max_awaited_future_depth,
             )
-            .expect("to spawn invocation task")
+            .run(storage_reader, budget),
+        )
     }
 }
 
@@ -1752,17 +1768,17 @@ mod tests {
             task_pool: &mut JoinSet<()>,
             _budget: LocalMemoryPool,
         ) -> AbortHandle {
-            task_pool
-                .build_task()
-                .name("invocation-task-fn")
-                .spawn((*self)(
+            spawn_invocation_task(
+                task_pool,
+                "invocation-task-fn",
+                (*self)(
                     invocation_id,
                     invocation_target,
                     storage_reader,
                     invoker_tx,
                     invoker_rx,
-                ))
-                .expect("to spawn invocation task")
+                ),
+            )
         }
     }
 
@@ -1886,6 +1902,23 @@ mod tests {
         }
     }
 
+    #[test(restate_core::test)]
+    async fn spawn_invocation_task_carries_task_center_context() {
+        let mut task_pool: JoinSet<()> = JoinSet::new();
+        le
```

---

### Incident Patch 3: `df920500` (2026-09-21)
**Commit Message**: Fix missing feature flag in ingress-http

**File**: `crates/ingress-http/Cargo.toml` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ thiserror = { workspace = true }
 tracing = { workspace = true }
 tracing-opentelemetry = { workspace = true }
 tokio = { workspace = true }
-tokio-util = { workspace = true, features = ["rt"] }
+tokio-util = { workspace = true, features = ["rt", "time"] }
 tonic = { workspace = true, features = ["codegen", "server"] }
 tonic-prost = { workspace = true }
 tower = { workspace = true, features = ["util"] }
```

---

### Incident Patch 4: `0df4caab` (2026-09-17)
**Commit Message**: fix(service-client): preserve active streams during graceful GOAWAY (#5311)

**File**: `crates/service-client/src/pool/README.md` (modified, +6/-2)
```diff
@@ -93,8 +93,12 @@ WaitingConnection ─┘
 - **InFlight**: Request sent; waiting for response headers.
 
 Errors during `Driving` or `PreFlight/poll_ready` are connection-level (close
-the connection). Errors during `send_request()` or `InFlight` are stream-level
-(only the individual request fails).
+the connection), except graceful GOAWAY (`NO_ERROR`) during `PreFlight`.
+That retires the connection from admission without cancelling active streams,
+and the pool retries the unsent request on another connection. Callers that
+reserved capacity before draining began also return their unsent requests.
+Errors during `send_request()` or `InFlight` remain stream-level (only the
+individual request fails); the pool does not replay these requests.
 
 ## TLS
 
```

**File**: `crates/service-client/src/pool/authority.rs` (modified, +3/-3)
```diff
@@ -226,7 +226,7 @@ where
                     let mut i = 0;
                     while i < candidates.len() {
                         let candidate = &mut candidates[i];
-                        if candidate.is_closed() {
+                        if candidate.is_retired() {
                             candidates.swap_remove_back(i);
                             continue;
                         }
@@ -279,7 +279,7 @@ where
                     let mut total_connections = 0usize;
 
                     for candidate in &inner.connections {
-                        if candidate.is_closed() {
+                        if candidate.is_retired() {
                             continue;
                         }
 
@@ -407,7 +407,7 @@ where
     ) -> Option<Connection<C>> {
         let epoch = inner.epoch;
         inner.with_upgraded(|inner| {
-            inner.connections.retain(|c| !c.is_closed());
+            inner.connections.retain(|c| !c.is_retired());
 
             if epoch != inner.epoch {
                 // List of connections has been updated by a different thread.
```

**File**: `crates/service-client/src/pool/conn.rs` (modified, +199/-19)
```diff
@@ -55,17 +55,17 @@ fn next_connection_id() -> usize {
 pub enum ConnectionError<R> {
     #[error(transparent)]
     Error(#[from] Error),
-    /// The connection's concurrency limit was reduced and this request's permit
-    /// was reclaimed before the request could be sent. The caller should retry
-    /// on a different connection. The original request is returned inside.
-    #[error("permit to use the connection was reclaimed")]
-    PermitReclaimed(R),
+    /// The request was not sent and can be retried on another connection.
+    /// Returns the original request and the reason admission was rejected.
+    #[error("request must be retried: {1}")]
+    Retry(R, &'static str),
 }
 
 const STATE_NEW: u8 = 0;
 const STATE_CONNECTING: u8 = 1;
 const STATE_CONNECTED: u8 = 2;
 const STATE_CLOSED: u8 = 3;
+const STATE_DRAINING: u8 = 4;
 
 /// The H2 handle obtained after a successful handshake. Set exactly once.
 #[derive(Debug)]
@@ -76,7 +76,8 @@ struct H2Handle {
 
 /// Lock-free shared state for an H2 connection.
 ///
-/// State transitions: `New → Connecting → Connected → Closed`.
+/// State transitions: `New → Connecting → Connected → Draining → Closed`.
+/// Fatal errors can transition directly to `Closed`.
 /// The `state` field tracks the discriminant atomically. The `h2` handle is set
 /// once via `OnceLock` when transitioning to `Connected`. Only the waiter list
 /// requires a brief lock during the `Connecting` phase.
@@ -117,9 +118,26 @@ impl ConnectionShared {
         }
     }
 
+    /// Stop admission while the connection task finishes accepted streams.
+    fn drain(&self) {
+        if self
+            .state
+            .compare_exchange(
+                STATE_CONNECTED,
+                STATE_DRAINING,
+                Ordering::Relaxed,
+                Ordering::Relaxed,
+            )
+            .is_ok()
+        {
+            self.concurrency.close();
+        }
+    }
+
     /// Mark the connection as closed and wake any pending waiters.
     fn close(&self) {
         self.state.store(STATE_CLOSED, Ordering::Relaxed);
+        self.concurrency.close();
         if let Some(h2) = self.h2.get() {
             h2.cancel.cancel();
         }
@@ -285,9 +303,12 @@ where
         self.shared.concurrency.size()
     }
 
-    /// Returns `true` if the connection has been closed or encountered a fatal error.
-    pub fn is_closed(&self) -> bool {
-        self.shared.state.load(Ordering::Relaxed) == STATE_CLOSED
+    /// Returns `true` if the connection no longer accepts new requests.
+    pub fn is_retired(&self) -> bool {
+        matches!(
+            self.shared.state.load(Ordering::Relaxed),
+            STATE_CLOSED | STATE_DRAINING
+        )
     }
 
     /// Must be polled before each request. This makes sure we acquire the permit
@@ -305,7 +326,7 @@ where
                     return Poll::Ready(Err(err));
                 }
             }
-            STATE_CLOSED => {
+            STATE_CLOSED | STATE_DRAINING => {
                 return Poll::Ready(Err(Error::Closed));
             }
             STATE_CONNECTED => {
@@ -339,8 +360,9 @@ where
 
         let acquire = self.acquire.as_mut().unwrap();
 
-        self.permit = Some(ready!(acquire.poll_unpin(cx)));
+        let permit = ready!(acquire.poll_unpin(cx));
         self.acquire = None;
+        self.permit = Some(permit.map_err(|_| Error::Closed)?);
 
         Poll::Ready(Ok(()))
     }
@@ -415,6 +437,7 @@ where
                             .clone(),
                     };
                 }
+                STATE_DRAINING => return ResponseFutureState::Draining,
                 STATE_CLOSED => return ResponseFutureState::error(Error::Closed),
                 _ => unreachable!(),
             }
@@ -542,8 +565,10 @@ where
 /// - **WaitingConnection** – another request is driving the handshake; we wait for notification.
 /// - **PreFlight** – we have a `SendRequest` handle and are waiting for H2 stream capacity.
 /// - **InFlight** 
```

**File**: `crates/service-client/src/pool/conn/concurrency.rs` (modified, +118/-29)
```diff
@@ -13,7 +13,7 @@ use std::{
     pin::Pin,
     sync::{
         Arc,
-        atomic::{AtomicUsize, Ordering},
+        atomic::{AtomicBool, AtomicUsize, Ordering},
     },
     task::{Context, Poll, ready},
 };
@@ -24,6 +24,7 @@ use tokio::sync::{Notify, futures::OwnedNotified};
 /// Shared state for the concurrency limiter.
 #[derive(Debug)]
 struct ConcurrencyInner {
+    closed: AtomicBool,
     size: AtomicUsize,
     inflight: AtomicUsize,
     capacity: Arc<Notify>,
@@ -44,6 +45,7 @@ impl Concurrency {
     pub fn new(size: usize) -> Self {
         Self {
             inner: Arc::new(ConcurrencyInner {
+                closed: AtomicBool::new(false),
                 size: AtomicUsize::new(size),
                 inflight: AtomicUsize::new(0),
                 capacity: Arc::new(Notify::new()),
@@ -52,7 +54,7 @@ impl Concurrency {
         }
     }
 
-    /// Returns a future that resolves to a [`Permit`] once capacity is available.
+    /// Acquire a permit once capacity is available, or fail if closed.
     pub fn acquire(&self) -> PermitFuture {
         PermitFuture::new(self.clone())
     }
@@ -76,6 +78,19 @@ impl Concurrency {
         }
     }
 
+    /// Permanently stop admission and signal waiters and reserved permit holders.
+    /// Existing permits remain held until their owners drop them.
+    pub fn close(&self) {
+        if !self.inner.closed.swap(true, Ordering::AcqRel) {
+            self.inner.capacity.notify_waiters();
+            self.inner.reclaim.notify_waiters();
+        }
+    }
+
+    fn is_closed(&self) -> bool {
+        self.inner.closed.load(Ordering::Acquire)
+    }
+
     /// Returns the current concurrency limit.
     pub fn size(&self) -> usize {
         self.inner.size.load(Ordering::Relaxed)
@@ -91,7 +106,11 @@ impl Concurrency {
     /// This is a best-effort snapshot since `size` and `inflight` are read
     /// as two separate atomic loads and may be inconsistent under contention.
     pub fn available(&self) -> usize {
-        self.size().saturating_sub(self.acquired())
+        if self.is_closed() {
+            0
+        } else {
+            self.size().saturating_sub(self.acquired())
+        }
     }
 }
 
@@ -118,13 +137,18 @@ impl Drop for Permit {
 impl Permit {
     /// Polls whether the concurrency limit has been reduced and this permit
     /// should be returned. Returns [`Poll::Ready`] when a reclaim has been
-    /// requested (via [`Concurrency::resize`] to a smaller limit).
+    /// requested by shrinking or closing the limiter.
     ///
     /// Dropping the permit is voluntary — callers should only do so when
     /// they can safely give up the resource (e.g. the resource is idle or
     /// the caller is not waiting on additional work).
     pub fn poll_reclaimed(&mut self, cx: &mut Context<'_>) -> Poll<()> {
-        Pin::new(&mut self.reclaimed).poll(cx)
+        let reclaimed = Pin::new(&mut self.reclaimed).poll(cx);
+        if self.concurrency.is_closed() {
+            Poll::Ready(())
+        } else {
+            reclaimed
+        }
     }
 }
 
@@ -137,7 +161,12 @@ enum PermitFutureState {
     },
 }
 
-/// A future that resolves to a [`Permit`] when concurrency capacity becomes available.
+/// The limiter no longer accepts new acquisitions.
+#[derive(Debug, Clone, Copy, thiserror::Error)]
+#[error("concurrency limiter is closed")]
+pub struct Closed;
+
+/// A future that acquires a permit or returns [`Closed`] after shutdown.
 #[pin_project::pin_project]
 pub struct PermitFuture {
     concurrency: Concurrency,
@@ -155,7 +184,7 @@ impl PermitFuture {
 }
 
 impl Future for PermitFuture {
-    type Output = Permit;
+    type Output = Result<Permit, Closed>;
 
     fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
         let mut this = self.project();
@@ -181,6 +210,12 @@ impl Future for PermitFuture {
                     // enabled or polled yet.
                     let reclaimed = this.concurrency.inner.reclaim.clon
```

**File**: `crates/service-client/src/pool/mod.rs` (modified, +2/-2)
```diff
@@ -143,8 +143,8 @@ where
                 match authority_pool.call(request).await {
                     Ok(result) => return Ok(result),
                     Err(conn::ConnectionError::Error(err)) => return Err(err),
-                    Err(conn::ConnectionError::PermitReclaimed(req)) => {
-                        debug!("H2 request lost stream permit, retrying");
+                    Err(conn::ConnectionError::Retry(req, reason)) => {
+                        debug!(reason, "H2 retrying unsent request");
                         request = req;
                     }
                 }
```

---

### Incident Patch 5: `e751eb85` (2026-08-28)
**Commit Message**: Fix restatectl warning for zero-partition clusters

**File**: `tools/restatectl/src/commands/log/list_logs.rs` (modified, +21/-11)
```diff
@@ -10,19 +10,19 @@
 
 use std::collections::BTreeMap;
 
-use anyhow::bail;
 use cling::prelude::*;
 
 use restate_cli_util::_comfy_table::{Cell, Table};
 use restate_cli_util::c_println;
 use restate_cli_util::ui::console::StyledTable;
 use restate_cli_util::ui::output::Console;
 use restate_types::Versioned;
+use restate_types::health::MetadataServerStatus;
 use restate_types::logs::LogId;
 use restate_types::logs::metadata::Chain;
 
 use crate::commands::log::{deserialize_replicated_log_params, render_loglet_params};
-use crate::connection::ConnectionInfo;
+use crate::connection::{ConnectionInfo, ConnectionInfoError};
 use crate::util::write_default_provider;
 
 #[derive(Run, Parser, Collect, Clone, Debug)]
@@ -47,16 +47,26 @@ pub async fn list_logs(connection: &ConnectionInfo, _opts: &ListLogsOpts) -> any
     let log_chains: BTreeMap<LogId, &Chain> = logs.iter().map(|(id, chain)| (*id, chain)).collect();
 
     if log_chains.is_empty() {
-        c_println!(
-            "No logs were found. Check if the cluster has been provisioned and partition processors have started on a worker node. `restatectl provision`."
-        );
-        c_println!();
-        c_println!("Use `restatectl provision` if you have not provisioned this cluster yet.");
+        c_println!("No logs were found.");
 
-        // short-circuits `restatectl status` to avoid trying to list partitions
-        bail!(
-            "The cluster appears to not be provisioned. You can do so with `restatectl provision`"
-        );
+        // A provisioned cluster with zero partitions legitimately has no logs.
+        match connection.get_nodes_configuration().await {
+            Ok(_) => {}
+            Err(ConnectionInfoError::MetadataValueNotAvailable { contacted_nodes })
+                if contacted_nodes.values().any(|ident| {
+                    ident.metadata_server_status() == MetadataServerStatus::AwaitingProvisioning
+                }) =>
+            {
+                c_println!();
+                c_println!(
+                    "Use `restatectl provision` if you have not provisioned this cluster yet."
+                );
+
+                // short-circuits `restatectl status` to avoid trying to list partitions
+                return Err(ConnectionInfoError::ClusterNotProvisioned.into());
+            }
+            Err(err) => return Err(err.into()),
+        }
     } else {
         for (log_id, chain) in log_chains {
             let params = deserialize_replicated_log_params(&chain.tail());
```

**File**: `tools/restatectl/src/main.rs` (modified, +3/-21)
```diff
@@ -52,8 +52,6 @@ mod tests {
     use std::{ffi::OsString, num::NonZeroU8};
 
     use cling::Cling;
-    use futures::StreamExt;
-
     use restate_futures_util::overdue::OverdueLoggingExt;
     use restate_local_cluster_runner::{
         cluster::Cluster,
@@ -65,9 +63,9 @@ mod tests {
     use tracing::info;
 
     #[test_log::test(tokio::test)]
-    async fn restatectl_smoke_test() -> googletest::Result<()> {
+    async fn restatectl_status_with_zero_partitions() -> googletest::Result<()> {
         let mut config = Configuration::new_unix_sockets();
-        config.common.default_num_partitions = 1.try_into()?;
+        config.common.default_num_partitions = 0;
         config.common.auto_provision = true;
         config.bifrost.default_provider = ProviderKind::Replicated;
         config.common.default_replication =
@@ -76,7 +74,7 @@ mod tests {
         let roles = *config.roles();
 
         let mut cluster = Cluster::builder()
-            .temp_base_dir("restatectl_smoke_test")
+            .temp_base_dir("restatectl_status_with_zero_partitions")
             .nodes(NodeSpec::new_test_nodes(
                 config,
                 BinarySource::CargoTest,
@@ -87,9 +85,6 @@ mod tests {
             .build()
             .start()
             .await?;
-        // registering the search pattern as early as possible since we might miss it if it was
-        // logged too quickly.
-        let mut node = cluster.nodes[0].lines("Partition [0-9]+ started".parse()?);
 
         cluster
             .wait_healthy(Duration::from_secs(30))
@@ -100,19 +95,6 @@ mod tests {
             )
             .with_overdue(Duration::from_secs(20), tracing::Level::WARN)
             .await?;
-        {
-            // wait for the node to report that the partition has started
-            node.next()
-                .log_slow_after(
-                    Duration::from_secs(10),
-                    tracing::Level::INFO,
-                    "Node didn't start PPs yet",
-                )
-                .with_overdue(Duration::from_secs(20), tracing::Level::WARN)
-                .await;
-
-            drop(node);
-        }
 
         let node_address = cluster.nodes[0].advertised_address().to_string();
 
```

---

### Incident Patch 6: `69ed67b9` (2026-09-06)
**Commit Message**: chore(docs): fix link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ Run via npx:
 npx @restatedev/restate
 ```
 
-You can also download the binaries from the [release page](https://github.com/restatedev/restate/releases) or our [download page](https://restate.dev/get-restate/).
+You can also download the binaries from the [release page](https://github.com/restatedev/restate/releases) or our [download page](https://docs.restate.dev/installation#download-binaries).
 
 ## Community
 
```

#### Recent Merged Pull Requests:
- **PR #5454** (2026-09-30): Update yoke-derive to 0.8.4 (@pcholakov)
- **PR #5451** (2026-09-30): [Restate UI] Update to v1.0.32 (@restatedev-ci)
- **PR #5450** (2026-09-30): [cleaner] Report gap in between completion and purge (@MohamedBassem)
- **PR #5446** (2026-09-30): [CLI] Revamp follow-ups: search, openapi, error model, formatter for rules and vqueues (@slinkydeveloper)
- **PR #5444** (2026-09-30): [cleaner] periodically refresh iterators (@MohamedBassem)
- **PR #5443** (2026-09-30): [cleaner] Bound the cleaner's in-flight purges (@MohamedBassem)
- **PR #5442** (2026-09-30): Back out "[cleaner] Time slice the cleanup interval into smaller key range slices (#5284)" (@MohamedBassem)
- **PR #5440** (2026-09-29): Bump utoipa 6 and fix various shortcomings for generators (@tillrohrmann)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
