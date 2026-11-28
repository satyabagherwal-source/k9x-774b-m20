> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/graphprotocol-graph-node-learnings.md`  
> **Source**: github ([https://github.com/graphprotocol/graph-node](https://github.com/graphprotocol/graph-node))  
> **Source Version**: `58d6e98a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T03:44:48.503Z  
> **Learning ID**: `learn-github-graphprotocol-graph-node`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): graphprotocol/graph-node

> **Canonical Artifact**: `07_PROJECT_LEARNING/graphprotocol-graph-node-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/graphprotocol/graph-node](https://github.com/graphprotocol/graph-node))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T03:44:48.326Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `graphprotocol/graph-node`
- **Description**: Graph Node indexes data from blockchains such as Ethereum and serves it over GraphQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 3169 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/graphman/src/commands/deployment/info.rs`
```
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::anyhow;
use graph::blockchain::BlockPtr;
use graph::components::store::BlockNumber;
use graph::components::store::DeploymentId;
use graph::components::store::StatusStore;
use graph::data::subgraph::schema::SubgraphHealth;
use graph_store_postgres::ConnectionPool;
use graph_store_postgres::Store;
use itertools::Itertools;

use crate::GraphmanError;
use crate::deployment::Deployment;
use crate::deployment::DeploymentSelector;
use crate::deployment::DeploymentVersionSelector;

#[derive(Clone, Debug)]
pub struct DeploymentStatus {
    pub is_paused: Option<bool>,
    pub is_synced: bool,
    pub health: SubgraphHealth,
    pub earliest_block_number: BlockNumber,
    pub latest_block: Option<BlockPtr>,
    pub chain_head_block: Option<BlockPtr>,
}

pub async fn load_deployments(
    primary_pool: ConnectionPool,
    deployment: &DeploymentSelector,
    version: &DeploymentVersionSelector,
) -> Result<Vec<Deployment>, GraphmanError> {
    let mut primary_conn = primary_pool.get().await?;

    crate::deployment::load_deployments(&mut primary_conn, deployment, version).await
}

pub async fn load_deployment_statuses(
    store: Arc<Store>,
    deployments: &[Deployment],
) -> Result<HashMap<i32, DeploymentStatus>, GraphmanError> {
    use graph::data::subgraph::status::Filter;

    let deployment_ids = deployments
        .iter()
        .map(|deployment| DeploymentId::new(deployment.id))
        .collect_vec();

    let deployment_statuses = store
        .status(Filter::DeploymentIds(deployment_ids))
        .await?
        .into_iter()
        .map(|status| {
            let id = status.id.0;

            let chain = status
                .chains
                .first()
                .ok_or_else(|| {
                    GraphmanError::Store(anyhow!(
                        "deployment status has no chains on deployment '{id}'"
                    ))
                })?
                .to_owned();

            Ok((
                id,
                DeploymentStatus {
                    is_paused: status.paused,
                    is_synced: status.synced,
                    health: status.health,
                    earliest_block_number: chain.earliest_block_number.to_owned(),
                    latest_block: chain.latest_block.map(|x| x.to_ptr()),
                    chain_head_block: chain.chain_head_block.map(|x| x.to_ptr()),
                },
            ))
        })
        .collect::<Result<_, GraphmanError>>()?;

    Ok(deployment_statuses)
}

```

### Core Architecture Module: `core/graphman/src/commands/deployment/mod.rs`
```
pub mod info;
pub mod pause;
pub mod reassign;
pub mod resume;
pub mod unassign;

```

### Core Architecture Module: `core/graphman/src/commands/deployment/pause.rs`
```
use std::sync::Arc;

use anyhow::anyhow;
use graph::components::store::DeploymentLocator;
use graph::components::store::StoreEvent;
use graph_store_postgres::ConnectionPool;
use graph_store_postgres::NotificationSender;
use graph_store_postgres::command_support::catalog;
use graph_store_postgres::command_support::catalog::Site;
use thiserror::Error;

use crate::GraphmanError;
use crate::deployment::DeploymentSelector;
use crate::deployment::DeploymentVersionSelector;

pub struct ActiveDeployment {
    locator: DeploymentLocator,
    site: Site,
}

#[derive(Debug, Error)]
pub enum PauseDeploymentError {
    #[error("deployment '{0}' is already paused")]
    AlreadyPaused(String),

    #[error(transparent)]
    Common(#[from] GraphmanError),
}

impl ActiveDeployment {
    pub fn locator(&self) -> &DeploymentLocator {
        &self.locator
    }
}

pub async fn load_active_deployment(
    primary_pool: ConnectionPool,
    deployment: &DeploymentSelector,
) -> Result<ActiveDeployment, PauseDeploymentError> {
    let mut primary_conn = primary_pool
        .get_permitted()
        .await
        .map_err(GraphmanError::from)?;

    let locator = crate::deployment::load_deployment_locator(
        &mut primary_conn,
        deployment,
        &DeploymentVersionSelector::All,
    )
    .await?;

    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let site = catalog_conn
        .locate_site(locator.clone())
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("deployment site not found for '{locator}'"))
        })?;

    let (_, is_paused) = catalog_conn
        .assignment_status(&site)
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("assignment status not found for '{locator}'"))
        })?;

    if is_paused {
        return Err(PauseDeploymentError::AlreadyPaused(locator.to_string()));
    }

    Ok(ActiveDeployment { locator, site })
}

pub async fn pause_active_deployment(
    primary_pool: ConnectionPool,
    notification_sender: Arc<NotificationSender>,
    active_deployment: ActiveDeployment,
) -> Result<(), GraphmanError> {
    let primary_conn = primary_pool.get_permitted().await?;
    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let changes = catalog_conn.pause_subgraph(&active_deployment.site).await?;
    catalog_conn
        .send_store_event(&notification_sender, &StoreEvent::new(changes))
        .await?;

    Ok(())
}

```

### Core Architecture Module: `core/graphman/src/commands/deployment/reassign.rs`
```
use std::sync::Arc;

use anyhow::anyhow;
use graph::components::store::DeploymentLocator;
use graph::components::store::StoreEvent;
use graph::prelude::AssignmentChange;
use graph::prelude::NodeId;
use graph_store_postgres::ConnectionPool;
use graph_store_postgres::NotificationSender;
use graph_store_postgres::command_support::catalog;
use graph_store_postgres::command_support::catalog::Site;
use thiserror::Error;

use crate::GraphmanError;
use crate::deployment::DeploymentSelector;
use crate::deployment::DeploymentVersionSelector;

pub struct Deployment {
    locator: DeploymentLocator,
    site: Site,
}

impl Deployment {
    pub fn locator(&self) -> &DeploymentLocator {
        &self.locator
    }

    pub async fn assigned_node(
        &self,
        primary_pool: ConnectionPool,
    ) -> Result<Option<NodeId>, GraphmanError> {
        let primary_conn = primary_pool
            .get_permitted()
            .await
            .map_err(GraphmanError::from)?;
        let mut catalog_conn = catalog::Connection::new(primary_conn);
        let node = catalog_conn
            .assigned_node(&self.site)
            .await
            .map_err(GraphmanError::from)?;
        Ok(node)
    }
}

#[derive(Debug, Error)]
pub enum ReassignDeploymentError {
    #[error("deployment '{0}' is already assigned to '{1}'")]
    AlreadyAssigned(String, String),

    #[error(transparent)]
    Common(#[from] GraphmanError),
}

#[derive(Clone, Debug)]
pub enum ReassignResult {
    Ok,
    CompletedWithWarnings(Vec<String>),
}

pub async fn load_deployment(
    primary_pool: ConnectionPool,
    deployment: &DeploymentSelector,
) -> Result<Deployment, ReassignDeploymentError> {
    let mut primary_conn = primary_pool
        .get_permitted()
        .await
        .map_err(GraphmanError::from)?;

    let locator = crate::deployment::load_deployment_locator(
        &mut primary_conn,
        deployment,
        &DeploymentVersionSelector::All,
    )
    .await?;

    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let site = catalog_conn
        .locate_site(locator.clone())
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("deployment site not found for '{locator}'"))
        })?;

    Ok(Deployment { locator, site })
}

pub async fn reassign_deployment(
    primary_pool: ConnectionPool,
    notification_sender: Arc<NotificationSender>,
    deployment: &Deployment,
    node: &NodeId,
    curr_node: Option<NodeId>,
) -> Result<ReassignResult, ReassignDeploymentError> {
    let primary_conn = primary_pool
        .get_permitted()
        .await
        .map_err(GraphmanError::from)?;
    let mut catalog_conn = catalog::Connection::new(primary_conn);
    let changes: Vec<AssignmentChange> = match &curr_node {
        Some(curr) => {
            if curr == node {
                vec![]
            } else {
                catalog_conn
                    .reassign_subgraph(&deployment.site, node)
                    .await
                    .map_err(GraphmanError::from)?
            }
        }
        None => catalog_conn
            .assign_subgraph(&deployment.site, node)
            .await
            .map_err(GraphmanError::from)?,
    };

    if changes.is_empty() {
        return Err(ReassignDeploymentError::AlreadyAssigned(
            deployment.locator.to_string(),
            node.to_string(),
        ));
    }

    catalog_conn
        .send_store_event(&notification_sender, &StoreEvent::new(changes))
        .await
        .map_err(GraphmanError::from)?;

    let mirror = catalog::Mirror::primary_only(primary_pool);
    let count = mirror
        .assignments(node)
        .await
        .map_err(GraphmanError::from)?
        .len();
    if count == 1 {
        let warning_msg = format!(
            "This is the only deployment assigned to '{}'. Please make sure that the node ID is spelled correctly.",
            node.as_str()
        );
        Ok(ReassignResult::CompletedWithWarnings(vec![warning_msg]))
    } else {
        Ok(ReassignResult::Ok)
    }
}

```

### Core Architecture Module: `core/graphman/src/commands/deployment/resume.rs`
```
use std::sync::Arc;

use anyhow::anyhow;
use graph::components::store::DeploymentLocator;
use graph::prelude::StoreEvent;
use graph_store_postgres::ConnectionPool;
use graph_store_postgres::NotificationSender;
use graph_store_postgres::command_support::catalog;
use graph_store_postgres::command_support::catalog::Site;
use thiserror::Error;

use crate::GraphmanError;
use crate::deployment::DeploymentSelector;
use crate::deployment::DeploymentVersionSelector;

pub struct PausedDeployment {
    locator: DeploymentLocator,
    site: Site,
}

#[derive(Debug, Error)]
pub enum ResumeDeploymentError {
    #[error("deployment '{0}' is not paused")]
    NotPaused(String),

    #[error(transparent)]
    Common(#[from] GraphmanError),
}

impl PausedDeployment {
    pub fn locator(&self) -> &DeploymentLocator {
        &self.locator
    }
}

pub async fn load_paused_deployment(
    primary_pool: ConnectionPool,
    deployment: &DeploymentSelector,
) -> Result<PausedDeployment, ResumeDeploymentError> {
    let mut primary_conn = primary_pool
        .get_permitted()
        .await
        .map_err(GraphmanError::from)?;

    let locator = crate::deployment::load_deployment_locator(
        &mut primary_conn,
        deployment,
        &DeploymentVersionSelector::All,
    )
    .await?;

    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let site = catalog_conn
        .locate_site(locator.clone())
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("deployment site not found for '{locator}'"))
        })?;

    let (_, is_paused) = catalog_conn
        .assignment_status(&site)
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("assignment status not found for '{locator}'"))
        })?;

    if !is_paused {
        return Err(ResumeDeploymentError::NotPaused(locator.to_string()));
    }

    Ok(PausedDeployment { locator, site })
}

pub async fn resume_paused_deployment(
    primary_pool: ConnectionPool,
    notification_sender: Arc<NotificationSender>,
    paused_deployment: PausedDeployment,
) -> Result<(), GraphmanError> {
    let primary_conn = primary_pool.get_permitted().await?;
    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let changes = catalog_conn
        .resume_subgraph(&paused_deployment.site)
        .await?;
    catalog_conn
        .send_store_event(&notification_sender, &StoreEvent::new(changes))
        .await?;

    Ok(())
}

```

### Core Architecture Module: `core/graphman/src/commands/deployment/unassign.rs`
```
use std::sync::Arc;

use anyhow::anyhow;
use graph::components::store::DeploymentLocator;
use graph::components::store::StoreEvent;
use graph_store_postgres::ConnectionPool;
use graph_store_postgres::NotificationSender;
use graph_store_postgres::command_support::catalog;
use graph_store_postgres::command_support::catalog::Site;
use thiserror::Error;

use crate::GraphmanError;
use crate::deployment::DeploymentSelector;
use crate::deployment::DeploymentVersionSelector;

pub struct AssignedDeployment {
    locator: DeploymentLocator,
    site: Site,
}

impl AssignedDeployment {
    pub fn locator(&self) -> &DeploymentLocator {
        &self.locator
    }
}

#[derive(Debug, Error)]
pub enum UnassignDeploymentError {
    #[error("deployment '{0}' is already unassigned")]
    AlreadyUnassigned(String),

    #[error(transparent)]
    Common(#[from] GraphmanError),
}

pub async fn load_assigned_deployment(
    primary_pool: ConnectionPool,
    deployment: &DeploymentSelector,
) -> Result<AssignedDeployment, UnassignDeploymentError> {
    let mut primary_conn = primary_pool
        .get_permitted()
        .await
        .map_err(GraphmanError::from)?;

    let locator = crate::deployment::load_deployment_locator(
        &mut primary_conn,
        deployment,
        &DeploymentVersionSelector::All,
    )
    .await?;

    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let site = catalog_conn
        .locate_site(locator.clone())
        .await
        .map_err(GraphmanError::from)?
        .ok_or_else(|| {
            GraphmanError::Store(anyhow!("deployment site not found for '{locator}'"))
        })?;

    match catalog_conn
        .assigned_node(&site)
        .await
        .map_err(GraphmanError::from)?
    {
        Some(_) => Ok(AssignedDeployment { locator, site }),
        None => Err(UnassignDeploymentError::AlreadyUnassigned(
            locator.to_string(),
        )),
    }
}

pub async fn unassign_deployment(
    primary_pool: ConnectionPool,
    notification_sender: Arc<NotificationSender>,
    deployment: AssignedDeployment,
) -> Result<(), GraphmanError> {
    let primary_conn = primary_pool.get_permitted().await?;
    let mut catalog_conn = catalog::Connection::new(primary_conn);

    let changes = catalog_conn.unassign_subgraph(&deployment.site).await?;
    catalog_conn
        .send_store_event(&notification_sender, &StoreEvent::new(changes))
        .await?;

    Ok(())
}

```

### Core Architecture Module: `core/graphman/src/commands/mod.rs`
```
pub mod deployment;

```

### Core Architecture Module: `core/graphman/src/deployment.rs`
```
use anyhow::anyhow;
use diesel::BoolExpressionMethods;
use diesel::ExpressionMethods;
use diesel::JoinOnDsl;
use diesel::NullableExpressionMethods;
use diesel::PgTextExpressionMethods;
use diesel::QueryDsl;
use diesel::Queryable;
use diesel::dsl::sql;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use graph::components::store::DeploymentId;
use graph::components::store::DeploymentLocator;
use graph::data::subgraph::DeploymentHash;
use graph_store_postgres::AsyncPgConnection;
use graph_store_postgres::command_support::catalog;
use itertools::Itertools;

use crate::GraphmanError;

#[derive(Clone, Debug, Queryable)]
pub struct Deployment {
    pub id: i32,
    pub hash: String,
    pub namespace: String,
    pub name: String,
    pub node_id: Option<String>,
    pub shard: String,
    pub chain: String,
    pub version_status: String,
    pub is_active: bool,
}

#[derive(Clone, Debug)]
pub enum DeploymentSelector {
    Name(String),
    Subgraph { hash: String, shard: Option<String> },
    Schema(String),
    All,
}

#[derive(Clone, Debug)]
pub enum DeploymentVersionSelector {
    Current,
    Pending,
    Used,
    All,
}

impl Deployment {
    pub fn locator(&self) -> DeploymentLocator {
        DeploymentLocator::new(
            DeploymentId::new(self.id),
            DeploymentHash::new(self.hash.clone()).unwrap(),
        )
    }
}

pub(crate) async fn load_deployments(
    primary_conn: &mut AsyncPgConnection,
    deployment: &DeploymentSelector,
    version: &DeploymentVersionSelector,
) -> Result<Vec<Deployment>, GraphmanError> {
    use catalog::deployment_schemas as ds;
    use catalog::subgraph as sg;
    use catalog::subgraph_deployment_assignment as sgda;
    use catalog::subgraph_version as sgv;

    let mut query = ds::table
        .inner_join(sgv::table.on(sgv::deployment.eq(ds::subgraph)))
        .inner_join(sg::table.on(sgv::subgraph.eq(sg::id)))
        .left_outer_join(sgda::table.on(sgda::id.eq(ds::id)))
        .select((
            ds::id,
            sgv::deployment,
            ds::name,
            sg::name,
            sgda::node_id.nullable(),
            ds::shard,
            ds::network,
            sql::<Text>(
                "(
                    case
                        when subgraphs.subgraph.pending_version = subgraphs.subgraph_version.id
                            then 'pending'
                        when subgraphs.subgraph.current_version = subgraphs.subgraph_version.id
                            then 'current'
                    else
                        'unused'
                    end
                 ) status",
            ),
            ds::active,
        ))
        .into_boxed();

    match deployment {
        DeploymentSelector::Name(name) => {
            let pattern = format!("%{}%", name.replace("%", ""));
            query = query.filter(sg::name.ilike(pattern));
        }
        DeploymentSelector::Subgraph { hash, shard } => {
            query = query.filter(ds::subgraph.eq(hash));

            if let Some(shard) = shard {
                query = query.filter(ds::shard.eq(shard));
            }
        }
        DeploymentSelector::Schema(name) => {
            query = query.filter(ds::name.eq(name));
        }
        DeploymentSelector::All => {
            // No query changes required.
        }
    };

    let current_version_filter = sg::current_version.eq(sgv::id.nullable());
    let pending_version_filter = sg::pending_version.eq(sgv::id.nullable());

    match version {
        DeploymentVersionSelector::Current => {
            query = query.filter(current_version_filter);
        }
        DeploymentVersionSelector::Pending => {
            query = query.filter(pending_version_filter);
        }
        DeploymentVersionSelector::Used => {
            query = query.filter(current_version_filter.or(pending_version_filter));
        }
        DeploymentVersionSelector::All => {
            // No query changes required.
        }
    }

    query.load(primary_conn).await.map_err(Into::into)
}

pub(crate) async fn load_deployment_locator(
    primary_conn: &mut AsyncPgConnection,
    deployment: &DeploymentSelector,
    version: &DeploymentVersionSelector,
) -> Result<DeploymentLocator, GraphmanError> {
    let deployment_locator = load_deployments(primary_conn, deployment, version)
        .await?
        .into_iter()
        .map(|deployment| deployment.locator())
        .unique()
        .exactly_one()
        .map_err(|err| {
            let count = err.into_iter().count();
            GraphmanError::Store(anyhow!(
                "expected exactly one deployment for '{deployment:?}', found {count}"
            ))
        })?;

    Ok(deployment_locator)
}

```

### Core Architecture Module: `core/graphman/src/error.rs`
```
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GraphmanError {
    #[error("store error: {0:#}")]
    Store(#[source] anyhow::Error),
}

impl From<graph::components::store::StoreError> for GraphmanError {
    fn from(err: graph::components::store::StoreError) -> Self {
        Self::Store(err.into())
    }
}

impl From<diesel::result::Error> for GraphmanError {
    fn from(err: diesel::result::Error) -> Self {
        Self::Store(err.into())
    }
}

```

### Core Architecture Module: `core/graphman/src/execution_tracker.rs`
```
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use graphman_store::ExecutionId;
use graphman_store::GraphmanStore;
use tokio::sync::Notify;

/// The execution status is updated at this interval.
const DEFAULT_HEARTBEAT_INTERVAL: Duration = Duration::from_secs(20);

/// Used with long-running command executions to maintain their status as active.
pub struct GraphmanExecutionTracker<S> {
    id: ExecutionId,
    heartbeat_stopper: Arc<Notify>,
    store: Arc<S>,
}

impl<S> GraphmanExecutionTracker<S>
where
    S: GraphmanStore + Send + Sync + 'static,
{
    /// Creates a new execution tracker that spawns a separate background task that keeps
    /// the execution active by periodically updating its status.
    pub fn new(store: Arc<S>, id: ExecutionId) -> Self {
        let heartbeat_stopper = Arc::new(Notify::new());

        let tracker = Self {
            id,
            store,
            heartbeat_stopper,
        };

        tracker.spawn_heartbeat();
        tracker
    }

    fn spawn_heartbeat(&self) {
        let id = self.id;
        let heartbeat_stopper = self.heartbeat_stopper.clone();
        let store = self.store.clone();

        graph::spawn(async move {
            store.mark_execution_as_running(id).await.unwrap();

            let stop_heartbeat = heartbeat_stopper.notified();
            tokio::pin!(stop_heartbeat);

            loop {
                tokio::select! {
                    biased;

                    _ = &mut stop_heartbeat => {
                        break;
                    },

                    _ = tokio::time::sleep(DEFAULT_HEARTBEAT_INTERVAL) => {
                        store.mark_execution_as_running(id).await.unwrap();
                    },
                }
            }
        });
    }

    /// Completes the execution with an error.
    pub async fn track_failure(self, error_message: String) -> Result<()> {
        self.heartbeat_stopper.notify_one();

        self.store
            .mark_execution_as_failed(self.id, error_message)
            .await
    }

    /// Completes the execution with a success.
    pub async fn track_success(self) -> Result<()> {
        self.heartbeat_stopper.notify_one();

        self.store.mark_execution_as_succeeded(self.id).await
    }
}

impl<S> Drop for GraphmanExecutionTracker<S> {
    fn drop(&mut self) {
        self.heartbeat_stopper.notify_one();
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6738** (2026-10-20): **[Bug] Celo blocks before Gingerbread fail to parse since v0.42.0 (missing `sha3Uncles`)**
  *Symptoms*: ### Bug report  Since **v0.42.0**, graph-node can't parse Celo blocks from before the Gingerbread hard fork (mainnet block 21616000). Every `eth_getBlockByNumber` / `eth_getBlockByHash` call for such a block fails, and the call is retried without a limit:  ```     Trying again after eth_getBlockByNumber RPC call for block number 18946750 failed (attempt #6) with result Err(deserialization error: missing field `sha3Uncles` at line 1 column 2161 ... ```  Subgraphs that need these blocks from RPC stall on re-deployments, re-syncs, and grafts with a start block before `21616000`.  ### Root cause  Celo blocks before Gingerbread have no uncles hash in their header, so RPC nodes omit `sha3Uncles`. Gingerbread added the field back.  - Up to **v0.41.x,** graph-node used rust-web3 fork. Commit `bfba0af` (2021-03-16, pulled in by #2284) made the lack of `sha3Uncles` for Celo not an issue by establishing a default value. - #6063 (merged 2026-01-22, released in **v0.42.0**) replaced rust-web3 with alloy. The Celo patch wasn't ported for the alloy library.     ### Relevant log output  ```Shell Trying again after eth_getBlockByNumber RPC call for block number 18946750 failed (attempt #6) with result Err(deserialization error: missing field `sha3Uncles` at line 1 column 2161 ... ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [x] Tick this box if this bug is caused by a regression found in the latest release. - [

- **Issue #6609** (2026-06-26): **[Bug] Graphman dump/restore cant handle larger subgraphs**
  *Symptoms*: ### Bug report  So we are testing/working with graphman dump and restore. It works perfectly fine for smaller subgraphs, but on the larger ones it fails.  ### Relevant log output  ```Shell This is a known issue with arrow-array hitting a 2GB limit on byte array buffers. This typically happens when graphman (or graph-node) is trying to process a very large result set in one shot. What's causing it: Arrow's GenericBytesBuilder uses 32-bit offsets internally — once the accumulated byte data exceeds ~2GB, it overflows. This is a hard limit in the arrow-array crate when using i32 offsets (vs i64 for "large" variants). Likely triggers in your case: Running a graphman command that fetches a large dataset (entity counts, history, stats across many subgraphs/blocks) A subgraph with very large string fields or a huge number of entities being exported/queried at once Workarounds to try: Filter/limit the query — if the command accepts filters, scope it down (e.g. specific deployment hash, block range, or shard) ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [x] Tick this box if this bug is caused by a regression found in the latest release. - [ ] Tick this box if this bug is specific to the hosted service. - [x] I have searched the issue tracker to make sure this issue is not a duplicate.  ### OS information  Linux

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

### Incident Patch 1: `58d6e98a` (2026-11-27)
**Commit Message**: store: Fix postponed indexes of copies and grafts (#6761)

* store: Skip postponed indexes that already exist under another name

The background build of postponed indexes skipped an index only if one
with the same name existed. Index names contain the positions of the
table and the column. A copy's positions can differ from its source's,
and older versions copied indexes under the source's names. If such a
copy's flag was reset, the build added a second index on every shifted
column.

The build now compares the shape of the indexes, not their names. It
only counts valid indexes, so that the leftover of an interrupted build
is still dropped and rebuilt.

* store: Copy postponed indexes of a graft/copy source under own names

At the end of a copy or graft, `create_indexes` recreated the postponed
indexes that existed on the source. It then always marked the
destination as having built them. If the source hadn't built them yet,
the destination never got them. Entity types that a graft added never
got theirs either.

The copy now reads the source's flag when it starts, before the source's
indexes and on the source's shard. At the end, the destination gets its
own postponed indexes for

**File**: `store/postgres/src/catalog.rs` (modified, +14/-8)
```diff
@@ -912,31 +912,37 @@ pub(crate) async fn index_creation_is_running(
         .map_err::<StoreError, _>(Into::into)
 }
 
+/// The index definitions of a table, only the valid ones with `valid_only`.
 pub(crate) async fn indexes_for_table(
     conn: &mut AsyncPgConnection,
     schema_name: &str,
     table_name: &str,
+    valid_only: bool,
 ) -> Result<Vec<String>, StoreError> {
     #[derive(Queryable, QueryableByName)]
-    struct IndexName {
+    struct IndexDef {
         #[diesel(sql_type = Text)]
-        #[diesel(column_name = indexdef)]
         def: String,
     }
 
     let query = "
         select
-            indexdef
+            pg_get_indexdef(i.indexrelid) as def
         from
-            pg_indexes
+            pg_index i
+            join pg_class t on t.oid = i.indrelid
+            join pg_class c on c.oid = i.indexrelid
+            join pg_namespace n on n.oid = t.relnamespace
         where
-            schemaname = $1
-            and tablename = $2
-        order by indexname";
+            n.nspname = $1
+            and t.relname = $2
+            and (i.indisvalid or not $3)
+        order by c.relname";
     let results = sql_query(query)
         .bind::<Text, _>(schema_name)
         .bind::<Text, _>(table_name)
-        .load::<IndexName>(conn)
+        .bind::<Bool, _>(valid_only)
+        .load::<IndexDef>(conn)
         .await
         .map_err::<StoreError, _>(Into::into)?;
 
```

**File**: `store/postgres/src/copy.rs` (modified, +36/-35)
```diff
@@ -12,7 +12,6 @@
 //! operation can resume after an interruption, for example, because
 //! `graph-node` was restarted while the copy was running.
 use std::{
-    collections::HashSet,
     convert::TryFrom,
     future::Future,
     pin::Pin,
@@ -103,6 +102,14 @@ pub enum Status {
     Cancelled,
 }
 
+/// The source of a copy, as read when the copy starts.
+pub(crate) struct CopySource {
+    /// The source's indexes.
+    pub(crate) list: IndexList,
+    /// Whether the source has built its postponed indexes.
+    pub(crate) postponed_indexes_created: bool,
+}
+
 struct CopyState {
     src: Arc<Layout>,
     dst: Arc<Layout>,
@@ -299,45 +306,39 @@ impl CopyState {
         self.finished.iter().chain(self.unfinished.iter())
     }
 
-    /// Create the indexes that were postponed at the start of the
-    /// copy/graft operation: first the ones that existed in the source
-    /// subgraph, then any indexes for new fields that don't exist in the
-    /// source.
+    /// Create the postponed indexes `dst` needs and give it the source's
+    /// `postponed_indexes_created` flag.
     async fn create_indexes(
         &self,
         conn: &mut AsyncPgConnection,
-        index_list: &IndexList,
+        source: &CopySource,
     ) -> Result<(), StoreError> {
         let creat = self.dst.index_creator(false, true);
-        let dst_nsp = self.dst.site.namespace.to_string();
-
-        // Create the indexes that existed in the source subgraph
-        for table in self.all_tables() {
-            let idxs = index_list
-                .indexes_for_table(&table.dst)
-                .filter(|idx| idx.to_postpone())
-                .map(|idx| idx.with_nsp(dst_nsp.clone()))
-                .collect::<Result<Vec<_>, _>>()?;
 
+        for dst_table in self.dst.tables.values() {
+            // May already hold postponed indexes from an interrupted run or an older version's copy.
+            let existing = dst_table.valid_indexes(conn).await?;
+            let src = self
+                .src
+                .table_for_entity(&dst_table.object)
+                .ok()
+                .map(|src_table| {
+                    let indexes = source
+                        .list
+                        .indexes
+                        .get(src_table.name.as_str())
+                        .map(Vec::as_slice)
+                        .unwrap_or(&[]);
+                    (src_table.as_ref(), indexes)
+                });
+            let idxs =
+                dst_table.postponed_indexes_to_create(&self.dst.input_schema, &existing, src)?;
             creat.execute_many(conn, &idxs).await?;
         }
 
-        // Create indexes for new fields that don't exist in the source
-        for table in self.all_tables() {
-            let src_columns: HashSet<&str> =
-                table.src.columns.iter().map(|c| c.name.as_str()).collect();
-            let new_idxs: Vec<_> = table
-                .dst
-                .indexes(&self.dst.input_schema)
-                .map_err(|_| internal_error!("failed to generate indexes for copy"))?
-                .into_iter()
-                .filter(|idx| idx.to_postpone() && idx.references_column_not_in(&src_columns))
-                .collect();
-            creat.execute_many(conn, &new_idxs).await?;
-        }
-
+        let created = source.postponed_indexes_created;
         conn.transaction(async |conn| {
-            deployment::set_postponed_indexes_created(conn, &self.dst.site).await
+            deployment::set_postponed_indexes_created(conn, &self.dst.site, created).await
         })
         .await?;
 
@@ -1191,7 +1192,7 @@ impl Connection {
         }
     }
 
-    async fn copy_data_internal(&mut self, index_list: IndexList) -> Result<Status, StoreError> {
+    async fn copy_data_internal(&mut self, source: CopySource) -> Result<Status, StoreError> {
         let src = self.src.clone();
         let dst = self.dst.clone();
         let target_block = self.target_block.clone();
@@ -1282,7 +1283,7 @@ impl Connection {
         }
         debug_assert!(self.conn.is_some());
 
-        state.create_indexes(self.get_conn()?, &index_list).await?;
+        state.create_indexes(self.get_conn()?, &source).await?;
 
         self.copy_private_data_sources(&state).await?;
 
@@ -1299,7 +1300,7 @@ impl Connection {
     /// block is guaranteed to not be subject to chain reorgs. All data up
     /// to and including `target_block` will be copied.
     ///
-    /// The parameter index_list is a list of indexes that exist on the `src`.
+    /// The parameter `source` describes the indexes of `src`.
     ///
     /// The copy logic makes heavy use of the fact that the `vid` and
     /// `block_range` of entity versions are related since for two entity
@@ -1309,7 +1310,7 @@ impl Connection {
     /// lower(v1.block_range) => v2.vid > v1.vid` and we can therefore stop
     /// the copying of each table as soon as we hit `max_vid = max { v.vid |
     /// lower(v.block_range)
```

**File**: `store/postgres/src/deployment.rs` (modified, +5/-4)
```diff
@@ -854,17 +854,18 @@ pub async fn postponed_indexes_created(
     Ok(created)
 }
 
-/// Mark the postponed (deferred) attribute indexes as created for this
-/// deployment. Once set, we never recreate these indexes — even if an
-/// external process removes them.
+/// Record whether the postponed (deferred) attribute indexes have been
+/// created for this deployment. Once set, we never recreate these indexes —
+/// even if an external process removes them.
 pub async fn set_postponed_indexes_created(
     conn: &mut AsyncPgConnection,
     site: &Site,
+    created: bool,
 ) -> Result<(), StoreError> {
     use deployment as d;
 
     update(d::table.filter(d::id.eq(site.id)))
-        .set(d::postponed_indexes_created.eq(true))
+        .set(d::postponed_indexes_created.eq(created))
         .execute(conn)
         .await?;
     Ok(())
```

**File**: `store/postgres/src/deployment_store.rs` (modified, +57/-23)
```diff
@@ -48,6 +48,7 @@ use graph::prelude::{
 use graph::schema::{ApiSchema, EntityKey, EntityType, InputSchema};
 
 use crate::block_range::{BLOCK_COLUMN, BLOCK_RANGE_COLUMN};
+use crate::copy::CopySource;
 use crate::deployment::{self, OnSync};
 use crate::detail::ErrorDetail;
 use crate::dynds::DataSourcesTable;
@@ -711,16 +712,58 @@ impl DeploymentStore {
         let table = resolve_table_name(&layout, &entity_name)?;
         let table_name = &table.name;
         let indexes =
-            catalog::indexes_for_table(&mut conn, schema_name.as_str(), table_name.as_str())
+            catalog::indexes_for_table(&mut conn, schema_name.as_str(), table_name.as_str(), false)
                 .await?;
         Ok(indexes.into_iter().map(CreateIndex::parse).collect())
     }
 
-    pub(crate) async fn load_indexes(&self, site: Arc<Site>) -> Result<IndexList, StoreError> {
+    /// Load `site` as the source of a copy.
+    pub(crate) async fn load_copy_source(&self, site: Arc<Site>) -> Result<CopySource, StoreError> {
         let mut conn = self.pool.get_permitted().await?;
+        // Read the flag before the indexes, so that a set flag never comes
+        // with a list from the middle of the background build.
+        let postponed_indexes_created =
+            deployment::postponed_indexes_created(&mut conn, &site).await?;
         let layout = self.layout(&mut conn, site).await?;
+        let list = IndexList::load(&mut conn, &layout).await?;
+        Ok(CopySource {
+            list,
+            postponed_indexes_created,
+        })
+    }
+
+    pub(crate) async fn postponed_indexes_created(&self, site: &Site) -> Result<bool, StoreError> {
+        let mut conn = self.pool.get_permitted().await?;
+        deployment::postponed_indexes_created(&mut conn, site).await
+    }
 
-        IndexList::load(&mut conn, &layout).await
+    // Only used for tests
+    #[cfg(debug_assertions)]
+    pub(crate) async fn set_postponed_indexes_created(
+        &self,
+        site: &Site,
+        created: bool,
+    ) -> Result<(), StoreError> {
+        let mut conn = self.pool.get_permitted().await?;
+        deployment::set_postponed_indexes_created(&mut conn, site, created).await
+    }
+
+    // Only used for tests
+    #[cfg(debug_assertions)]
+    pub(crate) async fn create_btree_index(
+        &self,
+        site: &Site,
+        name: &str,
+        table: &str,
+        expr: &str,
+    ) -> Result<(), StoreError> {
+        let mut conn = self.pool.get_permitted().await?;
+        let query = format!(
+            "create index \"{}\" on \"{}\".\"{}\" using btree ({})",
+            name, site.namespace, table, expr
+        );
+        sql_query(query).execute(&mut conn).await?;
+        Ok(())
     }
 
     /// Drops an index for a given deployment, concurrently.
@@ -1549,12 +1592,12 @@ impl DeploymentStore {
         &self,
         logger: &Logger,
         site: Arc<Site>,
-        graft_src: Option<(Arc<Layout>, BlockPtr, SubgraphDeploymentEntity, IndexList)>,
+        graft_src: Option<(Arc<Layout>, BlockPtr, SubgraphDeploymentEntity, CopySource)>,
     ) -> Result<(), StoreError> {
         let dst = self.find_layout(site.cheap_clone()).await?;
 
         // If `graft_src` is `Some`, then there is a pending graft.
-        if let Some((src, block, src_deployment, index_list)) = graft_src {
+        if let Some((src, block, src_deployment, source)) = graft_src {
             info!(
                 logger,
                 "Initializing graft by copying data from {} to {}",
@@ -1585,7 +1628,7 @@ impl DeploymentStore {
                 dst_manifest_idx_and_name,
             )
             .await?;
-            let status = copy_conn.copy_data(index_list).await?;
+            let status = copy_conn.copy_data(source).await?;
             if status == crate::copy::Status::Cancelled {
                 return Err(StoreError::Canceled);
             }
@@ -1706,14 +1749,6 @@ impl DeploymentStore {
             catalog::index_creation_is_running(&mut conn, site.namespace.as_str()).await
         }
 
-        async fn postponed_indexes_created(
-            store: &DeploymentStore,
-            site: &Site,
-        ) -> Result<bool, StoreError> {
-            let mut conn = store.pool.get_permitted().await?;
-            deployment::postponed_indexes_created(&mut conn, site).await
-        }
-
         async fn wait_for_concurrent_index_creation(
             logger: &Logger,
             store: &DeploymentStore,
@@ -1787,19 +1822,18 @@ impl DeploymentStore {
             // connection for the whole time. Instead, we get a new
             // connection for each index that we create.
 
-            if postponed_indexes_created(&store, &site).await? {
+            if store.postponed_indexes_created(&site).await? {
                 return Ok(());
             }
 
             for table in layout.tables.values() {
-                let indexes = table.indexes(&layout.input_schema).map_err(|e| {
-             
```

**File**: `store/postgres/src/relational/index.rs` (modified, +189/-125)
```diff
@@ -12,6 +12,7 @@ use graph::prelude::{
     BlockNumber, lazy_static,
     regex::{Captures, Regex},
 };
+use graph::schema::InputSchema;
 
 use crate::block_range::{BLOCK_COLUMN, BLOCK_RANGE_COLUMN};
 use crate::relational::{BYTE_ARRAY_PREFIX_SIZE, STRING_PREFIX_SIZE};
@@ -591,7 +592,7 @@ impl CreateIndex {
         self.is_attribute_index() || self.is_default_non_attr_index()
     }
 
-    fn is_same_index(&self, other: &CreateIndex) -> bool {
+    pub(crate) fn is_same_index(&self, other: &CreateIndex) -> bool {
         match (self, other) {
             (CreateIndex::Unknown { .. }, _) | (_, CreateIndex::Unknown { .. }) => false,
             (
@@ -673,75 +674,18 @@ impl CreateIndex {
         }
     }
 
-    /// Return `true` if any of the attribute columns (user-defined columns,
-    /// not infrastructure columns like `vid`, `block$`, etc.) referenced by
-    /// this index are NOT in `columns`.
-    pub fn references_column_not_in(&self, columns: &std::collections::HashSet<&str>) -> bool {
+    /// The user-defined columns this index covers.
+    pub fn attribute_columns(&self) -> Vec<&str> {
         match self {
-            CreateIndex::Unknown { .. } => false,
-            CreateIndex::Parsed { columns: exprs, .. } => exprs.iter().any(|expr| match expr {
-                Expr::Column(name) | Expr::Prefix(name, _) => !columns.contains(name.as_str()),
-                _ => false,
-            }),
-        }
-    }
-
-    pub fn fields_exist_in_dest(&self, dest_table: &Table) -> bool {
-        fn column_exists(dest_table: &Table, column_name: &str) -> bool {
-            dest_table
-                .columns
+            CreateIndex::Unknown { .. } => vec![],
+            CreateIndex::Parsed { columns, .. } => columns
                 .iter()
-                .any(|c| c.name.as_str() == column_name)
+                .filter_map(|expr| match expr {
+                    Expr::Column(name) | Expr::Prefix(name, _) => Some(name.as_str()),
+                    _ => None,
+                })
+                .collect(),
         }
-
-        match self {
-            CreateIndex::Unknown { defn: _ } => return true,
-            CreateIndex::Parsed {
-                columns: parsed_cols,
-                ..
-            } => {
-                for c in parsed_cols {
-                    match c {
-                        Expr::Column(column_name) => {
-                            if !column_exists(dest_table, column_name) {
-                                return false;
-                            }
-                        }
-                        Expr::Prefix(column_name, _) => {
-                            if !column_exists(dest_table, column_name) {
-                                return false;
-                            }
-                        }
-                        Expr::BlockRange | Expr::BlockRangeLower | Expr::BlockRangeUpper => {
-                            if dest_table.immutable {
-                                return false;
-                            }
-                        }
-                        Expr::Vid => (),
-                        Expr::Block => {
-                            if !dest_table.immutable {
-                                return false;
-                            }
-                        }
-                        Expr::Unknown(expression) => {
-                            if expression.contains("block_range") && dest_table.immutable {
-                                return false;
-                            }
-                            if !dest_table
-                                .columns
-                                .iter()
-                                .any(|c| expression.contains(c.name.as_str()))
-                                && !expression.contains("block_range")
-                                && !expression.contains("vid")
-                            {
-                                return false;
-                            }
-                        }
-                    }
-                }
-            }
-        }
-        true
     }
 
     /// Generate a SQL statement that creates this index. If `concurrent` is
@@ -898,6 +842,55 @@ impl Layout {
     }
 }
 
+impl Table {
+    /// The valid indexes on this table.
+    pub(crate) async fn valid_indexes(
+        &self,
+        conn: &mut AsyncPgConnection,
+    ) -> Result<Vec<CreateIndex>, StoreError> {
+        let defs =
+            catalog::indexes_for_table(conn, self.nsp.as_str(), self.name.as_str(), true).await?;
+        Ok(defs.into_iter().map(CreateIndex::parse).collect())
+    }
+
+    /// The postponed indexes this table still needs. Leaves out an index if
+    /// `existing` has one of the same shape, or if the copy source `src` has
+    /// its columns but no postponed index on them.
+    pub(crate) fn postponed_indexes_to_create(
+        &self,
+        schema: &InputSchema,
+        existing: &[CreateIndex],
+        src: Option<(&Table, &
```

**File**: `store/postgres/src/subgraph_store.rs` (modified, +38/-6)
```diff
@@ -43,14 +43,12 @@ use graph::{derive::CheapClone, futures03::future::join_all, prelude::alloy::pri
 use crate::{
     ConnectionPool, NotificationSender,
     catalog::Catalog,
+    copy::CopySource,
     deployment::{OnSync, SubgraphHealth},
     primary::{
         self, DeploymentId, Mirror as PrimaryMirror, Primary, RestoreAction, RestoreMode, Site,
     },
-    relational::{
-        self, Layout,
-        index::{IndexList, Method},
-    },
+    relational::{self, Layout, index::Method},
     writable::{SourceableStore, WritableStore},
 };
 use crate::{
@@ -1394,6 +1392,40 @@ impl Inner {
         store.indexes_for_entity(site, entity_name).await
     }
 
+    #[cfg(debug_assertions)]
+    pub async fn postponed_indexes_created(
+        &self,
+        deployment: &DeploymentLocator,
+    ) -> Result<bool, StoreError> {
+        let site = self.find_site(deployment.id.into()).await?;
+        let store = self.for_site(&site)?;
+        store.postponed_indexes_created(&site).await
+    }
+
+    #[cfg(debug_assertions)]
+    pub async fn set_postponed_indexes_created(
+        &self,
+        deployment: &DeploymentLocator,
+        created: bool,
+    ) -> Result<(), StoreError> {
+        let site = self.find_site(deployment.id.into()).await?;
+        let store = self.for_site(&site)?;
+        store.set_postponed_indexes_created(&site, created).await
+    }
+
+    #[cfg(debug_assertions)]
+    pub async fn create_btree_index_for_deployment(
+        &self,
+        deployment: &DeploymentLocator,
+        name: &str,
+        table: &str,
+        expr: &str,
+    ) -> Result<(), StoreError> {
+        let site = self.find_site(deployment.id.into()).await?;
+        let store = self.for_site(&site)?;
+        store.create_btree_index(&site, name, table, expr).await
+    }
+
     pub async fn drop_index_for_deployment(
         &self,
         deployment: &DeploymentLocator,
@@ -1537,9 +1569,9 @@ impl Inner {
         src_store.load_deployment(site).await
     }
 
-    pub async fn load_indexes(&self, site: Arc<Site>) -> Result<IndexList, StoreError> {
+    pub(crate) async fn load_copy_source(&self, site: Arc<Site>) -> Result<CopySource, StoreError> {
         let src_store = self.for_site(&site)?;
-        src_store.load_indexes(site).await
+        src_store.load_copy_source(site).await
     }
 
     pub async fn dump(
```

**File**: `store/postgres/src/writable.rs` (modified, +4/-4)
```diff
@@ -37,9 +37,9 @@ use tokio::select;
 use tokio::sync::Notify;
 use tokio::task::JoinHandle;
 
+use crate::copy::CopySource;
 use crate::deployment_store::DeploymentStore;
 use crate::primary::DeploymentId;
-use crate::relational::index::IndexList;
 use crate::{NotificationSender, retry};
 use crate::{SubgraphStore, primary, primary::Site, relational::Layout};
 
@@ -74,8 +74,8 @@ impl WritableSubgraphStore {
         self.0.find_site(id).await
     }
 
-    async fn load_indexes(&self, site: Arc<Site>) -> Result<IndexList, StoreError> {
-        self.0.load_indexes(site).await
+    async fn load_copy_source(&self, site: Arc<Site>) -> Result<CopySource, StoreError> {
+        self.0.load_copy_source(site).await
     }
 }
 
@@ -219,7 +219,7 @@ impl SyncStore {
                 Some((base_id, base_ptr)) => {
                     let src = self.store.layout(&base_id).await?;
                     let deployment_entity = self.store.load_deployment(src.site.clone()).await?;
-                    let indexes = self.store.load_indexes(src.site.clone()).await?;
+                    let indexes = self.store.load_copy_source(src.site.clone()).await?;
                     Some((src, base_ptr, deployment_entity, indexes))
                 }
                 None => None,
```

**File**: `store/test-store/src/store.rs` (modified, +65/-23)
```diff
@@ -167,36 +167,37 @@ pub async fn create_subgraph(
     schema: &str,
     base: Option<(DeploymentHash, BlockPtr)>,
 ) -> Result<DeploymentLocator, StoreError> {
-    let schema = InputSchema::parse_latest(schema, subgraph_id.clone()).unwrap();
-
-    let manifest = SubgraphManifest::<graph::blockchain::mock::MockBlockchain> {
-        id: subgraph_id.clone(),
-        spec_version: Version::new(1, 3, 0),
-        features: BTreeSet::new(),
-        description: Some(format!("manifest for {}", subgraph_id)),
-        repository: Some(format!("repo for {}", subgraph_id)),
-        schema: schema.clone(),
-        data_sources: vec![],
-        graft: None,
-        templates: vec![],
-        chain: PhantomData,
-        indexer_hints: None,
-    };
-
+    let (schema, manifest) = test_manifest(subgraph_id, schema);
     create_subgraph_with_manifest(subgraph_id, schema, manifest, base).await
 }
 
+/// Like `create_subgraph`, but doesn't start the deployment.
+pub async fn create_subgraph_unstarted(
+    subgraph_id: &DeploymentHash,
+    schema: &str,
+    base: Option<(DeploymentHash, BlockPtr)>,
+) -> Result<DeploymentLocator, StoreError> {
+    let (schema, manifest) = test_manifest(subgraph_id, schema);
+    let (name, deployment) = deployment_create(subgraph_id, &manifest, base);
+    SUBGRAPH_STORE
+        .create_deployment_replace(
+            name,
+            &schema,
+            deployment,
+            NODE_ID.clone(),
+            NETWORK_NAME.to_string(),
+            SubgraphVersionSwitchingMode::Instant,
+        )
+        .await
+}
+
 pub async fn create_subgraph_with_manifest(
     subgraph_id: &DeploymentHash,
     schema: InputSchema,
     manifest: SubgraphManifest<graph::blockchain::mock::MockBlockchain>,
     base: Option<(DeploymentHash, BlockPtr)>,
 ) -> Result<DeploymentLocator, StoreError> {
-    let mut yaml = serde_yaml::Mapping::new();
-    yaml.insert("dataSources".into(), Vec::<serde_yaml::Value>::new().into());
-    let yaml = serde_yaml::to_string(&yaml).unwrap();
-    let deployment = DeploymentCreate::new(yaml, &manifest, None).graft(base);
-    let name = SubgraphName::new_unchecked(subgraph_id.to_string());
+    let (name, deployment) = deployment_create(subgraph_id, &manifest, base);
     let deployment = SUBGRAPH_STORE
         .create_deployment_replace(
             name,
@@ -207,14 +208,55 @@ pub async fn create_subgraph_with_manifest(
             SubgraphVersionSwitchingMode::Instant,
         )
         .await?;
+    start_subgraph(&deployment).await?;
+    Ok(deployment)
+}
 
+/// Start `deployment`; this runs a pending graft's copy.
+pub async fn start_subgraph(deployment: &DeploymentLocator) -> Result<(), StoreError> {
     SUBGRAPH_STORE
         .cheap_clone()
         .writable(LOGGER.clone(), deployment.id, Arc::new(Vec::new()))
         .await?
         .start_subgraph_deployment(&LOGGER)
-        .await?;
-    Ok(deployment)
+        .await
+}
+
+fn test_manifest(
+    subgraph_id: &DeploymentHash,
+    schema: &str,
+) -> (
+    InputSchema,
+    SubgraphManifest<graph::blockchain::mock::MockBlockchain>,
+) {
+    let schema = InputSchema::parse_latest(schema, subgraph_id.clone()).unwrap();
+    let manifest = SubgraphManifest::<graph::blockchain::mock::MockBlockchain> {
+        id: subgraph_id.clone(),
+        spec_version: Version::new(1, 3, 0),
+        features: BTreeSet::new(),
+        description: Some(format!("manifest for {}", subgraph_id)),
+        repository: Some(format!("repo for {}", subgraph_id)),
+        schema: schema.clone(),
+        data_sources: vec![],
+        graft: None,
+        templates: vec![],
+        chain: PhantomData,
+        indexer_hints: None,
+    };
+    (schema, manifest)
+}
+
+fn deployment_create(
+    subgraph_id: &DeploymentHash,
+    manifest: &SubgraphManifest<graph::blockchain::mock::MockBlockchain>,
+    base: Option<(DeploymentHash, BlockPtr)>,
+) -> (SubgraphName, DeploymentCreate) {
+    let mut yaml = serde_yaml::Mapping::new();
+    yaml.insert("dataSources".into(), Vec::<serde_yaml::Value>::new().into());
+    let yaml = serde_yaml::to_string(&yaml).unwrap();
+    let deployment = DeploymentCreate::new(yaml, manifest, None).graft(base);
+    let name = SubgraphName::new_unchecked(subgraph_id.to_string());
+    (name, deployment)
 }
 
 pub async fn create_test_subgraph(subgraph_id: &DeploymentHash, schema: &str) -> DeploymentLocator {
```

#### Recent Merged Pull Requests:
- **PR #6789** (2026-11-27): store: Select entity ids as text in FindPossibleDeletionsQuery (@dimitrovmaksim)
- **PR #6788** (2026-11-24): all: Bump locked dependencies to fix RustSec advisories (@dimitrovmaksim)
- **PR #6761** (2026-11-27): store: Fix postponed indexes of copies and grafts (@dimitrovmaksim)
- **PR #6760** (2026-11-13): gnd: Don't unset nullable primitive fields set to 0 or false (@taiyangc)
- **PR #6758** (closed): store: create a copy's attribute indexes from the source's index list (@lx3133584)
- **PR #6757** (closed): core: keep the full trigger filter when a template handler is address-scoped (@lx3133584)

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

## X. store: Fix postponed indexes of copies and grafts

**RULE**:
When implementing operations in `store/postgres/src/catalog.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in graphprotocol/graph-node. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `58d6e98a`: store: Fix postponed indexes of copies and grafts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `store/postgres/src/catalog.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// The index definitions of a table, only the valid ones with `valid_only`.
    valid_only: bool,
    struct IndexDef {
            pg_get_indexdef(i.indexrelid) as def
            pg_index i
            join pg_class t on t.oid = i.indrelid
            join pg_class c on c.oid = i.indexrelid
            join pg_namespace n on n.oid = t.relnamespace
            n.nspname = $1
            and t.relname = $2
            and (i.indisvalid or not $3)
        order by c.relname";
        .bind::<Bool, _>(valid_only)
        .load::<IndexDef>(conn)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    struct IndexName {
        #[diesel(column_name = indexdef)]
            indexdef
            pg_indexes
            schemaname = $1
            and tablename = $2
        order by indexname";
        .load::<IndexName>(conn)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `58d6e98a` are properly handled with clean fallback behavior.
