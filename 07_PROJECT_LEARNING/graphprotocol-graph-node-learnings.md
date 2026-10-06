# Forensic Learning Record (Deep Inspection): graphprotocol/graph-node

> **Canonical Artifact**: `07_PROJECT_LEARNING/graphprotocol-graph-node-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/graphprotocol/graph-node](https://github.com/graphprotocol/graph-node))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:43.972Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `graphprotocol/graph-node`
- **Description**: Graph Node indexes data from blockchains such as Ethereum and serves it over GraphQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 3152 stars

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

### Core Architecture Module: `core/graphman/src/lib.rs`
```
//! This crate contains graphman commands that can be executed via
//! the GraphQL API as well as via the CLI.
//!
//! Each command is broken into small execution steps to allow different interfaces to perform
//! some additional interface-specific operations between steps. An example of this is printing
//! intermediate information to the user in the CLI, or prompting for additional input.

mod error;

pub mod commands;
pub mod deployment;
pub mod execution_tracker;

pub use self::error::GraphmanError;
pub use self::execution_tracker::GraphmanExecutionTracker;

```

### Core Architecture Module: `core/graphman_store/src/lib.rs`
```
//! This crate allows graphman commands to store data in a persistent storage.
//!
//! Note: The trait is extracted as a separate crate to avoid cyclic dependencies between graphman
//!       commands and store implementations.

use anyhow::Result;
use async_trait::async_trait;
use chrono::DateTime;
use chrono::Utc;
use diesel::AsExpression;
use diesel::FromSqlRow;
use diesel::Queryable;
use diesel::deserialize::FromSql;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize::Output;
use diesel::serialize::ToSql;
use diesel::sql_types::BigSerial;
use diesel::sql_types::Varchar;
use strum::Display;
use strum::EnumString;
use strum::IntoStaticStr;

/// Describes all the capabilities that graphman commands need from a persistent storage.
///
/// The primary use case for this is background execution of commands.
#[async_trait]
pub trait GraphmanStore {
    /// Creates a new pending execution of the specified type.
    /// The implementation is expected to manage execution IDs and return unique IDs on each call.
    ///
    /// Creating a new execution does not mean that a command is actually running or will run.
    async fn new_execution(&self, kind: CommandKind) -> Result<ExecutionId>;

    /// Returns all stored execution data.
    async fn load_execution(&self, id: ExecutionId) -> Result<Execution>;

    /// When an execution begins to make progress, this method is used to update its status.
    ///
    /// For long-running commands, it is expected that this method will be called at some interval
    /// to show that the execution is still making progress.
    ///
    /// The implementation is expected to not allow updating the status of completed executions.
    async fn mark_execution_as_running(&self, id: ExecutionId) -> Result<()>;

    /// This is a finalizing operation and is expected to be called only once,
    /// when an execution fails.
    ///
    /// The implementation is not expected to prevent overriding the final state of an execution.
    async fn mark_execution_as_failed(&self, id: ExecutionId, error_message: String) -> Result<()>;

    /// This is a finalizing operation and is expected to be called only once,
    /// when an execution succeeds.
    ///
    /// The implementation is not expected to prevent overriding the final state of an execution.
    async fn mark_execution_as_succeeded(&self, id: ExecutionId) -> Result<()>;
}

/// Data stored about a command execution.
#[derive(Clone, Debug, Queryable)]
pub struct Execution {
    pub id: ExecutionId,
    pub kind: CommandKind,
    pub status: ExecutionStatus,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// A unique ID of a command execution.
#[derive(Clone, Copy, Debug, AsExpression, FromSqlRow)]
#[diesel(sql_type = BigSerial)]
pub struct ExecutionId(pub i64);

/// Types of commands that can store data about their execution.
#[derive(Clone, Copy, Debug, AsExpression, FromSqlRow, Display, IntoStaticStr, EnumString)]
#[diesel(sql_type = Varchar)]
#[strum(serialize_all = "snake_case")]
pub enum CommandKind {
    RestartDeployment,
}

/// All possible states of a command execution.
#[derive(Clone, Copy, Debug, AsExpression, FromSqlRow, Display, IntoStaticStr, EnumString)]
#[diesel(sql_type = Varchar)]
#[strum(serialize_all = "snake_case")]
pub enum ExecutionStatus {
    Initializing,
    Running,
    Failed,
    Succeeded,
}

impl FromSql<BigSerial, Pg> for ExecutionId {
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        Ok(ExecutionId(i64::from_sql(bytes)?))
    }
}

impl ToSql<BigSerial, Pg> for ExecutionId {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        <i64 as ToSql<BigSerial, Pg>>::to_sql(&self.0, &mut out.reborrow())
    }
}

impl FromSql<Varchar, Pg> for CommandKind {
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        Ok(std::str::from_utf8(bytes.as_bytes())?.parse()?)
    }
}

impl ToSql<Varchar, Pg> for CommandKind {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        <str as ToSql<Varchar, Pg>>::to_sql(self.into(), &mut out.reborrow())
    }
}

impl FromSql<Varchar, Pg> for ExecutionStatus {
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        Ok(std::str::from_utf8(bytes.as_bytes())?.parse()?)
    }
}

impl ToSql<Varchar, Pg> for ExecutionStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        <str as ToSql<Varchar, Pg>>::to_sql(self.into(), &mut out.reborrow())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6609** (2026-06-26): **[Bug] Graphman dump/restore cant handle larger subgraphs**
  *Symptoms*: ### Bug report  So we are testing/working with graphman dump and restore. It works perfectly fine for smaller subgraphs, but on the larger ones it fails.  ### Relevant log output  ```Shell This is a known issue with arrow-array hitting a 2GB limit on byte array buffers. This typically happens when graphman (or graph-node) is trying to process a very large result set in one shot. What's causing it: Arrow's GenericBytesBuilder uses 32-bit offsets internally — once the accumulated byte data exceeds ~2GB, it overflows. This is a hard limit in the arrow-array crate when using i32 offsets (vs i64 for "large" variants). Likely triggers in your case: Running a graphman command that fetches a large dataset (entity counts, history, stats across many subgraphs/blocks) A subgraph with very large string fields or a huge number of entities being exported/queried at once Workarounds to try: Filter/limit the query — if the command accepts filters, scope it down (e.g. specific deployment hash, block range, or shard) ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [x] Tick this box if this bug is caused by a regression found in the latest release. - [ ] Tick this box if this bug is specific to the hosted service. - [x] I have searched the issue tracker to make sure this issue is not a duplicate.  ### OS information  Linux
  **Post-Mortem & Fix Analysis**:
  > if this is a trivial fix, please do lmk when a PR for it is open so we can try it (we want to move a large subgraph and test it)

- **Issue #6582** (2026-06-24): **[Bug] Handle Reth StackUnderflow as deterministic**
  *Symptoms*: ### Bug report  Add another check here: https://github.com/graphprotocol/graph-node/blob/ffc58a76d1f0c01f677a81c3c2f5adb8db407a49/chain/ethereum/src/call_helper.rs#L56  See PR on Firehose: https://github.com/streamingfast/eth-go/pull/10  ### Relevant log output  ```Shell  ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [ ] Tick this box if this bug is caused by a regression found in the latest release. - [ ] Tick this box if this bug is specific to the hosted service. - [x] I have searched the issue tracker to make sure this issue is not a duplicate.  ### OS information  None
  **Post-Mortem & Fix Analysis**:
  > wow opened a month ago and still nothing

- **Issue #6571** (2026-06-23): **[Bug] Graphnode can no longer process blocks with `base_fee_per_gas` over u64 limit**
  *Symptoms*: ### Bug report  When encountering a block with `base_fee_per_gas` being higher than 2^64, it fails to parse the block  In previous graphnode versions, the `base_fee_per_gas` field of the block header was U256  https://github.com/graphprotocol/rust-web3/blob/585c9db21576fd9aace40607b764ec870a5faebb/src/types/block.rs#L38-L39  In v0.42, graphnode switched to the alloy instead, which has the `base_fee_per_gas` as an u64  https://github.com/alloy-rs/alloy/blob/76aa416c661c370e588b9632d34d8e5062ab00f5/crates/consensus-any/src/block/header.rs#L60-L69  example block (Stable chain): ```json {   "baseFeePerGas": "0x3635c9adc5dea00000",   "blobGasUsed": "0x0",   "difficulty": "0x0",   "excessBlobGas": "0x0",   "extraData": "0x",   "gasLimit": "0x5f5e100",   "gasUsed": "0x0",   "hash": "0x4c2bdd9b606eaee018d298d05f5f87e515cda8a50de3a61707e0cafcc79d88a5",   "logsBloom": "0x000", // truncated for readability   "miner": "0x940d1df160e775dd10ae4d2a0e8f6b31b93e469d",   "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",   "nonce": "0x0000000000000000",   "number": "0x24f946",   "parentBeaconBlockRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",   "parentHash": "0xb6e0b620c568296ad79c8f9c018916be70bc73dde41e88685d2a107e1fb46281",   "receiptsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",   "requestsHash": "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",   "sha3Uncles": "0x1dcc4de8dec75d7a
  **Post-Mortem & Fix Analysis**:
  > An Issue regarding this has been opened to Alloy by @incrypto32 https://github.com/alloy-rs/alloy/issues/3741 and it seems a fix has been merged https://github.com/alloy-rs/alloy/pull/3976
  > @dimitrovmaksim if that's the case please feel free to close the issue. Any timeline on release of the new version?
  > @LeonDolinar depends when alloy releases a new version with the fix. Will keep the issue open for visibility

- **Issue #6561** (2026-05-13): **"Found no transaction for event" on Base (OP Stack) — reproducible across deploys**
  *Symptoms*: ### Bug report  ## "Found no transaction for event" on Base (OP Stack) — reproducible across deploys  <img width="1728" height="1086" alt="Image" src="https://github.com/user-attachments/assets/381465f1-8cc9-4131-9dbb-6530b97acc39" />  ### Environment - **Subgraph Studio** (hosted) - **Network:** Base (chainId 8453) - **specVersion:** 1.2.0 - **apiVersion:** 0.0.9  ### Description  Deploying a Uniswap V4 subgraph on Base consistently fails with `Found no transaction for event` within ~77K blocks of startBlock. The same subgraph (identical schema + mappings) indexes successfully on **Ethereum** and **Arbitrum**.  ### Error (v0.0.1)  Error: failed to process trigger: block #25428006 (0x7d2ea361cee849c46ba41ab4f7dc3909342bbc78415e794a46979c14dc695ea9), transaction 9efd7044a2e5da263b970a55c859e2b7eee84f5c97be753f0c55d9bcca134510: Found no transaction for event   ### Error (v0.0.2 — after removing `receipt: true`)  Error: failed to process trigger: block #25427983 (0x5e09922a07f7c4e8a3df2781a7c47521652l030bd73eb1f1b20d8dcfd1a6l4c5), transaction b676b941fe70cca65b976256071a82ee03fa5e3011cae29111416f6c3f03d6b9: Found no transaction for event   ### Key observations  1. **Fails at different blocks on each deploy** — not a single corrupt block, appears systemic 2. **Transactions exist on-chain** — verified on [BaseScan](https://basescan.org/tx/0xb676b941fe70cca65b976256071a82ee03fa5e3011cae29111416f6c3f03d6b9): normal user swap through Uniswap V4, not an L1 deposit/system tx 3. **Remov
  **Post-Mortem & Fix Analysis**:
  > Can confirm. I get this type of error only for base chain subgraphs. Currently I have 8 subgraphs with this error. ```  failed to process trigger: block #38980095 (0x0a61d0221e6fd4108fd4421249902439d1a3b9350b5b15e6797b9c94f3e7f567), transaction   23c18709e935cb12b9c4d8c01e66b2c663d7c3128e6501b560593893c9ea4608: Found no transaction for event   failed to process trigger: block #38719205 (0x26f5b789b35f69af702fcfe77fc840cbb789e923de50f5fa025e0339c8d97c0f), transaction   4aab6beed5234f15e77329a6af417b425204d0efca454fc8f3a2826bdb9ba2c3: Found no transaction for event ```
  > @0xkaranchauhan do you use any load balancer rpc, or 3rd party providers or running local archive node?
  > This is an RPC provider issue. RPC provider is returning blocks with zero transactions in it. For subgraphs hosted by The Graph's upgrade indexer we have notified our provider about this. Closing this as its not a graph-node bug

- **Issue #6559** (2026-06-26): **[Bug] Heap corruption when host calls execute at AssemblyScript module-init time**
  *Symptoms*: ### Bug report  ### Summary  When a subgraph's AssemblyScript code invokes graph-ts host-call helpers (e.g. `Address.fromString`, `Bytes.fromHexString`) at module-initialization time via top-level `const` declarations, the graph-node wasm runtime ends up in a corrupted heap state. The corruption is silent until some unrelated handler later in the same `subgraph.yaml` reads an `AscString`, at which point graph-node throws: ``` Attempted to read past end of string content bytes chunk ``` (thrown from                                                                                                                                             [`runtime/wasm/src/asc_abi/v0_0_5.rs#L234`](https://github.com/graphprotocol/graph-node/blob/master/runtime/wasm/src/asc_abi/v0_0_5.rs#L234))               After retries this also surfaces as the related cascade error in `InputSchema::entity_type` with an empty/garbled name (`internal error: unknown name   when looking up entity type`), because subsequent host calls receive corrupted `AscString` pointers.                                                       ### Reproducer                                                                                                                                                                                                                    Minimal handler module:  ```typescript import { Address, Bytes } from "@graphprotocol/graph-ts" import { Pool } from "../generated/schema"                             
  **Post-Mortem & Fix Analysis**:
  > Hey @nkuba I believe this is the same issue as https://github.com/graphprotocol/graph-tooling/issues/2003 and has been addressed here https://github.com/graphprotocol/graph-tooling/pull/2006. Updating to graph-ts >= `0.38.1` should resolve it and compile the WASM correctly.
  > Closing, based on comment from @dimitrovmaksim. Please reopen if you still face the issue @nkuba 

- **Issue #6489** (2026-06-26): **[Bug] Graphnode can no longer parse traces with results missing `output` field**
  *Symptoms*: ### Bug report  When encountering a trace with callresult having missing `output` field, graphnode fails to parse it.  In previous graphnode versions, an `output` field of call trace result was specifically made optional (`#[serde(default)]`)  https://github.com/graphprotocol/rust-web3/blob/585c9db21576fd9aace40607b764ec870a5faebb/src/types/trace_filtering.rs#L158-L165  In v0.42, graphnode switched to the `alloy` instead, which has the `output` field as a non-optional, which causes this issue  https://github.com/alloy-rs/alloy/blob/76aa416c661c370e588b9632d34d8e5062ab00f5/crates/rpc-types-trace/src/parity.rs#L444-L450  example trace (sonic chain): ```json {   "action": {     "from": "0xf7cf0d9398d06d5cb7e4d37dc1e18a829bfff934",     "value": "0x0",     "gas": "0x0",     "init": "0x",     "address": "0xf7cf0d9398d06d5cb7e4d37dc1e18a829bfff934",     "refund_address": "0x4c3ccc98c01103be72bcfd29e1d2454c98d1a6e3",     "balance": "0x0"   },   "blockHash": "0x6b747793a61c3ce4e5f3355cf80edcb6aa465913ed43f4b0136d93803cf330f3",   "blockNumber": 66762070,   "result": {     "gasUsed": "0x0"   },   "subtraces": 0,   "traceAddress": [     1,     1   ],   "transactionHash": "0x5b3dc50c4c7bd9b0e80469b21febbc5d1b54b364a01b22b1e9c426e4632e0b8f",   "transactionPosition": 0,   "type": "suicide" } ```  ### Relevant log output  ```Shell Apr 07 09:43:20.816 WARN Trying again after trace_filter RPC call for block range: [66762070..66762070] failed (attempt #10) with result Err(deserialization error:
  **Post-Mortem & Fix Analysis**:
  > @isum have you had a chance to look at this?
  > This looks resolved on current `master` (v0.44.0) via the `alloy` upgrade.  In `alloy-rpc-types-trace` 2.0.5 (the pinned version), `TraceOutput` now has a custom `Deserialize` impl, and `CallOutput.output` carries `#[serde(default, deserialize_with = "alloy_serde::null_as_default")]`. A trace whose `result` is present but missing `output` (e.g. the `suicide` trace `result: {"gasUsed": "0x0"}` from this report) deserializes into `Call { output: <empty> }` instead of failing the whole batch.  Verified by deserializing the exact trace from this issue into `LocalizedTransactionTrace` against the pinned `alloy` — it now parses, and `graph-node` correctly ignores it as a non-CALL trace.  @Isarafanikov would you be able to confirm on a recent `graph-node` build? If it's no longer reproducing, this can be closed. 
  > Closing, Fixed as mentioned in above comment by @cargopete. @Isarafanikov  Feel free to reopen if you still encounter it.

- **Issue #6404** (2026-04-03): **[Bug] Null value resolved for non-null field `isDeprecated`**
  *Symptoms*: ### Bug report  I'm trying to make a query with introspection using python's gql.client ([fetch_schema_from_transport=True](https://gql.readthedocs.io/en/latest/modules/client.html)), but I returns an error because the intronspection queries don't respect the GraphQL schema.  This is the query being generated by gql.client: ```gql query IntrospectionQuery {   __schema {     queryType {       name     }     mutationType {       name     }     subscriptionType {       name     }     types {       ...FullType     }     directives {       name       description       locations       args(includeDeprecated: true) {         ...InputValue       }     }   } }  fragment FullType on __Type {   kind   name   description   fields(includeDeprecated: true) {     name     description     args(includeDeprecated: true) {       ...InputValue     }     type {       ...TypeRef     }     isDeprecated     deprecationReason   }   inputFields(includeDeprecated: true) {     ...InputValue   }   interfaces {     ...TypeRef   }   enumValues(includeDeprecated: true) {     name     description     isDeprecated     deprecationReason   }   possibleTypes {     ...TypeRef   } }  fragment InputValue on __InputValue {   name   description   type {     ...TypeRef   }   defaultValue   isDeprecated   deprecationReason }  fragment TypeRef on __Type {   kind   name   ofType {     kind     name     ofType {       kind       name       ofType {         kind         name         ofType {           kind           name  

- **Issue #6366** (2026-02-19): **graphman copy copies pruned earliest_block_number from source, resulting in invalid destination**
  *Symptoms*: ## Bug report  When using `graphman copy create` with a large offset on a pruned source, the destination deployment ends up with an `earliest_block_number` higher than its head block, resulting in an invalid/corrupted state.  ## Root cause  At the end of a copy operation, `copy_earliest_block()` (`store/postgres/src/deployment.rs:1336`) unconditionally copies the `earliest_block_number` from source to destination:  ```rust update(d::table.filter(d::id.eq(dst.id)))     .set(d::earliest_block_number.eq(sql(&query)))     .execute(conn)?; ```  This is called from `deployment_store.rs:1619`, after the copy is finalized.  When the source has been **pruned** (e.g. `earliest_block_number = 38545619`) and the copy uses a **large offset** that results in a destination head below that value (e.g. head at `35583707`), the destination inherits the source's pruned `earliest_block_number`.  ## Consequences  The destination deployment ends up in an inconsistent state: - `head = 35583707` - `earliest_block_number = 38545619` (from the pruned source)  This blocks `graphman rewind` with: ``` The block number 35522000 is not safe to rewind to for deployment QmXXX[6103]. The earliest block number of this deployment is 38545619. ```  ## Steps to reproduce  1. Have a subgraph `sgd2027` that has been pruned (`earliest_block_number` advanced to e.g. 38545619) 2. Run `graphman copy create` with a large offset, so the copy is taken at a block below the source's `earliest_block_number` 3. Observe that t
  **Post-Mortem & Fix Analysis**:
  > Hey @madumas is this a scenario that is expected to be used? If so, instead of restricting it maybe we should adjust the earliest_block logic to support it?
  > I've done that just a few days ago and stumbled upon it.  I'm using the offset logic to rewind a subgraph in a separate copy and keep the original one intact.  I'm not sure how changing earliest_block logic would help? My understanding is that if the subgraph is pruned the data is gone.
  > Yeah, i was thinking about something, but you're right, it won't work (at least not correctly) for pruned subgraphs.

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

### Incident Patch 1: `44719a6b` (2026-07-13)
**Commit Message**: build(deps): bump prost-types from 0.14.3 to 0.14.4

Bumps [prost-types](https://github.com/tokio-rs/prost) from 0.14.3 to 0.14.4.
- [Release notes](https://github.com/tokio-rs/prost/releases)
- [Changelog](https://github.com/tokio-rs/prost/blob/master/CHANGELOG.md)
- [Commits](https://github.com/tokio-rs/prost/compare/v0.14.3...v0.14.4)

---
updated-dependencies:
- dependency-name: prost-types
  dependency-version: 0.14.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -6461,7 +6461,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "343d3bd7056eda839b03204e68deff7d1b13aba7af2b2fd16890697274262ee7"
 dependencies = [
  "heck 0.5.0",
- "itertools 0.10.5",
+ "itertools 0.13.0",
  "log",
  "multimap",
  "petgraph 0.8.3",
@@ -6482,17 +6482,17 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b570b25f7617e43d59005d0990ccb79e950a423952cea19671b7a876da390adf"
 dependencies = [
  "anyhow",
- "itertools 0.10.5",
+ "itertools 0.13.0",
  "proc-macro2",
  "quote",
  "syn 2.0.118",
 ]
 
 [[package]]
 name = "prost-types"
-version = "0.14.3"
+version = "0.14.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8991c4cbdb8bc5b11f0b074ffe286c30e523de90fee5ba8132f1399f23cb3dd7"
+checksum = "f94967dc7688f3054c7fac87473ffae4cc4c3904800e2d9f5b857246d8963b0a"
 dependencies = [
  "prost",
 ]
```

---

### Incident Patch 2: `f76eef99` (2026-07-17)
**Commit Message**: build(deps): bump serde_with from 3.12.0 to 3.21.0

Bumps [serde_with](https://github.com/jonasbb/serde_with) from 3.12.0 to 3.21.0.
- [Release notes](https://github.com/jonasbb/serde_with/releases)
- [Commits](https://github.com/jonasbb/serde_with/compare/v3.12.0...v3.21.0)

---
updated-dependencies:
- dependency-name: serde_with
  dependency-version: 3.21.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +64/-10)
```diff
@@ -6889,6 +6889,26 @@ dependencies = [
  "thiserror 1.0.61",
 ]
 
+[[package]]
+name = "ref-cast"
+version = "1.0.25"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f354300ae66f76f1c85c5f84693f0ce81d747e2c3f21a45fef496d89c960bf7d"
+dependencies = [
+ "ref-cast-impl",
+]
+
+[[package]]
+name = "ref-cast-impl"
+version = "1.0.25"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b7186006dcb21920990093f30e3dea63b7d6e977bf1256be20c3563a5db070da"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 2.0.118",
+]
+
 [[package]]
 name = "regalloc2"
 version = "0.15.1"
@@ -7278,6 +7298,30 @@ dependencies = [
  "parking_lot",
 ]
 
+[[package]]
+name = "schemars"
+version = "0.9.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4cd191f9397d57d581cddd31014772520aa448f65ef991055d7f61582c65165f"
+dependencies = [
+ "dyn-clone",
+ "ref-cast",
+ "serde",
+ "serde_json",
+]
+
+[[package]]
+name = "schemars"
+version = "1.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a2b42f36aa1cd011945615b92222f6bf73c599a102a300334cd7f8dbeec726cc"
+dependencies = [
+ "dyn-clone",
+ "ref-cast",
+ "serde",
+ "serde_json",
+]
+
 [[package]]
 name = "scopeguard"
 version = "1.2.0"
@@ -7448,13 +7492,15 @@ dependencies = [
 
 [[package]]
 name = "serde_json"
-version = "1.0.120"
+version = "1.0.150"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e0d21c9a8cae1235ad58a00c11cb40d4b1e5c784f1ef2c537876ed6ffd8b7c5"
+checksum = "e8014e44b4736ed0538adeecded0fce2a272f22dc9578a7eb6b2d9993c74cfb9"
 dependencies = [
  "itoa",
- "ryu",
+ "memchr",
  "serde",
+ "serde_core",
+ "zmij",
 ]
 
 [[package]]
@@ -7509,29 +7555,31 @@ dependencies = [
 
 [[package]]
 name = "serde_with"
-version = "3.12.0"
+version = "3.21.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d6b6f7f2fcb69f747921f79f3926bd1e203fce4fef62c268dd3abfb6d86029aa"
+checksum = "76a5c54c7310e7b8b9577c286d7e399ddd876c3e12b3ed917a8aabc4b96e9e8c"
 dependencies = [
  "base64",
+ "bs58 0.5.1",
  "chrono",
  "hex",
  "indexmap 1.9.3",
  "indexmap 2.14.0",
- "serde",
- "serde_derive",
+ "schemars 0.9.0",
+ "schemars 1.2.1",
+ "serde_core",
  "serde_json",
  "serde_with_macros",
  "time",
 ]
 
 [[package]]
 name = "serde_with_macros"
-version = "3.12.0"
+version = "3.21.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8d00caa5193a3c8362ac2b73be6b9e768aa5a4b2f721d8f4b339600c3cb51f8e"
+checksum = "84d57bc0c8b9a17920c178daa6bb924850d54a9c97ab45194bb8c17ad66bb660"
 dependencies = [
- "darling 0.20.10",
+ "darling 0.23.0",
  "proc-macro2",
  "quote",
  "syn 2.0.118",
@@ -10298,6 +10346,12 @@ version = "0.6.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c745c48e1007337ed136dc99df34128b9faa6ed542d80a1c673cf55a6d7236c8"
 
+[[package]]
+name = "zmij"
+version = "1.0.23"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "29666d0abbfad1e3dc4dcf6144730dd3a3ab225bbbdac83319345b1b44ccfc1b"
+
 [[package]]
 name = "zstd"
 version = "0.13.3"
```

---

### Incident Patch 3: `c6016c22` (2026-07-13)
**Commit Message**: build(deps): bump base64 from 0.21.7 to 0.22.1

Bumps [base64](https://github.com/marshallpierce/rust-base64) from 0.21.7 to 0.22.1.
- [Changelog](https://github.com/marshallpierce/rust-base64/blob/master/RELEASE-NOTES.md)
- [Commits](https://github.com/marshallpierce/rust-base64/compare/v0.21.7...v0.22.1)

---
updated-dependencies:
- dependency-name: base64
  dependency-version: 0.22.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +17/-23)
```diff
@@ -763,7 +763,7 @@ checksum = "86052fdcec72d37ca4aa4b66254601e7453c45a6e1c70aa4561033d002fb80cc"
 dependencies = [
  "alloy-json-rpc",
  "auto_impl",
- "base64 0.22.1",
+ "base64",
  "derive_more",
  "futures 0.3.31",
  "futures-utils-wasm",
@@ -1266,7 +1266,7 @@ dependencies = [
  "arrow-schema",
  "arrow-select",
  "atoi",
- "base64 0.22.1",
+ "base64",
  "chrono",
  "half",
  "lexical-core",
@@ -1319,7 +1319,7 @@ dependencies = [
  "arrow-schema",
  "arrow-select",
  "arrow-string",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "futures 0.3.31",
  "once_cell",
@@ -1474,7 +1474,7 @@ dependencies = [
  "async-io",
  "async-trait",
  "asynk-strim",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "chrono",
  "fast_chemail",
@@ -1715,7 +1715,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "31b698c5f9a010f6573133b09e0de5408834d0c82f8d7475a89fc1867a71cd90"
 dependencies = [
  "axum-core",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "form_urlencoded",
  "futures-util",
@@ -1784,12 +1784,6 @@ version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"
 
-[[package]]
-name = "base64"
-version = "0.21.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9d297deb1925b89f2ccc13d7635fa0714f12c87adce1c75356b39ca9b7178567"
-
 [[package]]
 name = "base64"
 version = "0.22.1"
@@ -3896,7 +3890,7 @@ dependencies = [
  "async-stream",
  "async-trait",
  "atomic_refcell",
- "base64 0.21.7",
+ "base64",
  "bigdecimal",
  "bs58 0.5.1",
  "bytes",
@@ -3991,7 +3985,7 @@ version = "0.44.0"
 dependencies = [
  "anyhow",
  "async-trait",
- "base64 0.22.1",
+ "base64",
  "envconfig",
  "futures 0.3.31",
  "graph",
@@ -4661,7 +4655,7 @@ version = "0.1.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "96547c2556ec9d12fb1578c4eaf448b04993e7fb79cbaad930a656880a6bdfa0"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "bytes",
  "futures-channel",
  "futures-util",
@@ -5796,7 +5790,7 @@ checksum = "765784b4390c6bcf80316e5a22f4e3661b639c9d8c83246856643c27d8ce9dbe"
 dependencies = [
  "async-trait",
  "aws-lc-rs",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "chrono",
  "form_urlencoded",
@@ -5983,7 +5977,7 @@ dependencies = [
  "arrow-ipc",
  "arrow-schema",
  "arrow-select",
- "base64 0.22.1",
+ "base64",
  "brotli",
  "bytes",
  "chrono",
@@ -6242,7 +6236,7 @@ version = "0.6.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fbef655056b916eb868048276cfd5d6a7dea4f81560dfd047f97c8c6fe3fcfd4"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "byteorder",
  "bytes",
  "fallible-iterator 0.2.0",
@@ -6946,7 +6940,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d429f34c8092b2d42c7c93cec323bb4adeb7c67698f70839adec842ec10c7ceb"
 dependencies = [
  "async-compression",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "encoding_rs",
  "futures-channel",
@@ -6991,7 +6985,7 @@ version = "0.13.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ab3f43e3283ab1488b624b44b0e988d0acea0b3214e694730a055cb6b2efa801"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "bytes",
  "futures-core",
  "futures-util",
@@ -7519,7 +7513,7 @@ version = "3.12.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d6b6f7f2fcb69f747921f79f3926bd1e203fce4fef62c268dd3abfb6d86029aa"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "chrono",
  "hex",
  "indexmap 1.9.3",
@@ -8544,7 +8538,7 @@ checksum = "ac2a5518c70fa84342385732db33fb3f44bc4cc748936eb5833d2df34d6445ef"
 dependencies = [
  "async-trait",
  "axum",
- "base64 0.22.1",
+ "base64",
  "bytes",
  "flate2",
  "h2",
@@ -9336,7 +9330,7 @@ version = "46.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "438bc7dc45fb75297d75f79a9a0ce852345d13ebc6a6863f6f688f013836a9dd"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "directories-next",
  "log",
  "postcard",
@@ -10007,7 +10001,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "08db1edfb05d9b3c1542e521aea074442088292f00b5f28e435c714a98f85031"
 dependencies = [
  "assert-json-diff",
- "base64 0.22.1",
+ "base64",
  "deadpool 0.12.3",
  "futures 0.3.31",
  "http 1.4.2",
```

**File**: `graph/Cargo.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ edition.workspace = true
 
 [dependencies]
 alloy = { workspace = true }
-base64 = "=0.21.7"
+base64 = "=0.22.1"
 anyhow = "1.0"
 async-trait = { workspace = true }
 async-stream = "0.3"
```

---

### Incident Patch 4: `e1295f83` (2026-07-15)
**Commit Message**: gnd: Fix `add` and unify subgraph scaffolding generators (#6660)

* gnd: Unify subgraph scaffolding generators

Collapse the duplicated code generation so init and add share one path,
removing the forked add mapping generator that had drifted from the
scaffold one:

- a single sanitize_field_name in scaffold/naming.rs (three copies removed)
- a single generate_event_handlers driven by a new ResolvedEvent model
  (passthrough for now); add's copy is deleted
- shared SPEC_VERSION / MAPPING_API_VERSION constants and one to_kebab_case

No behavior change: init output is byte-identical and add is unchanged.

* gnd: Write schema entities and add guards in `add`

`gnd add` generated mappings and manifest entries that referenced entity
types it never declared, so codegen and build failed. Declare them, and
tighten two edges:

- append an entity type per new event to schema.graphql
- error when the data source name already exists
- only update networks.json when the file is present

* gnd: Resolve event-name collisions and merges in `add`

Decide each event's entity name once in a resolution pass, then feed the
schema, mapping and manifest generators from it:

- disambiguate events overload

**File**: `gnd/src/commands/add.rs` (modified, +309/-193)
```diff
@@ -3,19 +3,23 @@
 //! This command adds a new data source to an existing subgraph, generating
 //! the necessary manifest entries, schema types, and mapping stubs.
 
+use std::collections::HashSet;
 use std::fs;
 use std::path::{Path, PathBuf};
 
 use anyhow::{Context, Result, anyhow};
 use clap::Parser;
-use inflector::Inflector;
+use graphql_tools::parser::schema as gql;
 use serde_json::Value as JsonValue;
 
 use crate::config::networks::update_networks_file;
 use crate::formatter::format_typescript;
 use crate::output::{Step, step};
-use crate::scaffold::ScaffoldOptions;
 use crate::scaffold::manifest::{EventInfo, extract_events_from_abi};
+use crate::scaffold::{
+    MAPPING_API_VERSION, ResolvedEvent, ScaffoldOptions, disambiguate_events,
+    generate_event_entity, generate_event_handlers, to_kebab_case,
+};
 use crate::services::ContractService;
 
 #[derive(Clone, Debug, Parser)]
@@ -97,6 +101,14 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
     // Fetch or load ABI
     let (abi, contract_name, start_block) = get_contract_info(&opt, &network).await?;
 
+    // A data source / template name must be unique within the subgraph.
+    if existing_source_names(&manifest).contains(&contract_name) {
+        return Err(anyhow!(
+            "Data source or template named '{}' already exists. Choose a different name with --contract-name.",
+            contract_name
+        ));
+    }
+
     // Get project directory
     let project_dir = crate::manifest::manifest_dir(&opt.manifest);
 
@@ -111,14 +123,20 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
         index_events: true, // Always index events for add command
     };
 
-    // Extract events from ABI
+    // Extract events from the ABI and resolve their names against the entities
+    // already present in the subgraph (handles overloads and collisions). Both
+    // the manifest's entity lists and the types declared in schema.graphql count
+    // as existing, since either can be the source of a name collision.
     let events = extract_events_from_abi(&scaffold_options);
+    let mut existing = existing_entities(&manifest);
+    existing.extend(schema_entity_types(project_dir, &manifest));
+    let resolved = resolve_events(events, &existing, &contract_name, opt.merge_entities)?;
 
     // Add ABI file
     add_abi_file(project_dir, &contract_name, &abi)?;
 
     // Add mapping file
-    add_mapping_file(project_dir, &contract_name, &events)?;
+    add_mapping_file(project_dir, &contract_name, &resolved)?;
 
     // Update manifest
     update_manifest(
@@ -127,22 +145,27 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
         &contract_name,
         &network,
         start_block,
-        &events,
+        &resolved,
     )?;
 
-    // Update networks.json
+    // Declare the new event entities in the schema so codegen/build succeed.
+    add_schema_entities(project_dir, &manifest, &resolved)?;
+
+    // Update networks.json if the subgraph uses one.
     let networks_path = project_dir.join(&opt.network_file);
-    update_networks_file(
-        &networks_path,
-        &network,
-        &contract_name,
-        &opt.address,
-        start_block,
-    )?;
-    step(
-        Step::Write,
-        &format!("Updated {}", opt.network_file.display()),
-    );
+    if networks_path.exists() {
+        update_networks_file(
+            &networks_path,
+            &network,
+            &contract_name,
+            &opt.address,
+            start_block,
+        )?;
+        step(
+            Step::Write,
+            &format!("Updated {}", opt.network_file.display()),
+        );
+    }
 
     step(Step::Done, &format!("Added data source: {}", contract_name));
 
@@ -232,41 +255,16 @@ fn add_abi_file(project_dir: &Path, contract_name: &str, abi: &JsonValue) -> Res
     Ok(())
 }
 
-/// Sanitize a field name for GraphQL.
-fn sanitize_field_name(name: &str) -> String {
-    if name.is_empty() {
-        return "value".to_string();
-    }
-
-    let mut result = name.to_string();
-
-    // Convert to camelCase if starts with uppercase
-    if result
-        .chars()
-        .next()
-        .map(|c| c.is_uppercase())
-        .unwrap_or(false)
-    {
-        let mut chars = result.chars();
-        if let Some(first) = chars.next() {
-            result = first.to_lowercase().collect::<String>() + chars.as_str();
-        }
-    }
-
-    // Avoid reserved words
-    match result.as_str() {
-        "id" => "eventId".to_string(),
-        "type" => "eventType".to_string(),
-        _ => result,
-    }
-}
-
 /// Add mapping file for the new data source.
-fn add_mapping_file(project_dir: &Path, contract_name: &str, events: &[EventInfo]) -> Result<()> {
+fn add_mapping_file(
+    project_dir: &Path,
+    contract_name: &str,
+    events: &[ResolvedEvent],
+) -> Result<()> {
     let src_dir = project_dir.join("src");
     fs::create_dir_all(&src_dir).context("Failed to create src directory")?;
 
-    let mapping_file = src_dir
```

**File**: `gnd/src/scaffold/manifest.rs` (modified, +109/-20)
```diff
@@ -1,6 +1,9 @@
 //! Manifest (subgraph.yaml) generation for scaffold.
 
+use std::collections::HashMap;
+
 use super::ScaffoldOptions;
+use crate::shared::handle_reserved_word;
 
 /// Generate the subgraph.yaml manifest content.
 pub fn generate_manifest(options: &ScaffoldOptions) -> String {
@@ -21,11 +24,13 @@ pub fn generate_manifest(options: &ScaffoldOptions) -> String {
         source.push_str(&format!("      startBlock: {}\n", start_block));
     }
 
-    // Get event handlers from ABI
-    let event_handlers = get_event_handlers(options);
+    // Resolve events once (disambiguating overloaded names) so the handlers and
+    // entities lists stay consistent.
+    let events = disambiguate_events(extract_events_from_abi(options));
+    let event_handlers = get_event_handlers(contract_name, &events);
 
     format!(
-        r#"specVersion: 1.3.0
+        r#"specVersion: {spec_version}
 indexerHints:
   prune: auto
 schema:
@@ -37,7 +42,7 @@ dataSources:
     source:
 {source}    mapping:
       kind: ethereum/events
-      apiVersion: 0.0.9
+      apiVersion: {api_version}
       language: wasm/assemblyscript
       entities:{entities}
       abis:
@@ -46,15 +51,14 @@ dataSources:
       eventHandlers:{event_handlers}
       file: {mapping_file}
 "#,
-        entities = get_entities(options),
+        spec_version = super::SPEC_VERSION,
+        api_version = super::MAPPING_API_VERSION,
+        entities = get_entities(&events),
     )
 }
 
-/// Get event handlers from ABI.
-fn get_event_handlers(options: &ScaffoldOptions) -> String {
-    let contract_name = &options.contract_name;
-    let events = extract_events_from_abi(options);
-
+/// Get event handlers for the manifest.
+fn get_event_handlers(contract_name: &str, events: &[ResolvedEvent]) -> String {
     if events.is_empty() {
         // Default placeholder handler
         return format!(
@@ -66,40 +70,108 @@ fn get_event_handlers(options: &ScaffoldOptions) -> String {
 
     let mut handlers = String::new();
     for event in events {
-        let handler_name = format!("handle{}", event.name);
         handlers.push_str(&format!(
-            "\n        - event: {}\n          handler: {}",
-            event.signature, handler_name
+            "\n        - event: {}\n          handler: handle{}",
+            event.event.signature, event.alias
         ));
     }
 
     handlers
 }
 
-/// Get entities list for manifest.
-fn get_entities(options: &ScaffoldOptions) -> String {
-    let events = extract_events_from_abi(options);
-
+/// Get entities list for the manifest.
+fn get_entities(events: &[ResolvedEvent]) -> String {
     if events.is_empty() {
         return "\n        - ExampleEntity".to_string();
     }
 
-    // Always use event names from ABI, regardless of index_events
     let mut entities = String::new();
     for event in events {
-        entities.push_str(&format!("\n        - {}", event.name));
+        entities.push_str(&format!("\n        - {}", event.entity_name));
     }
     entities
 }
 
 /// Event info extracted from ABI.
-#[derive(Debug)]
+#[derive(Debug, Clone)]
 pub struct EventInfo {
     pub name: String,
     pub signature: String,
     pub inputs: Vec<EventInput>,
 }
 
+/// An event resolved to the concrete names the generators render.
+///
+/// Decided once (here / by collision resolution) so the schema, mapping and
+/// manifest generators never derive names independently:
+/// - `alias` names the handler function and the ABI event-type import; it is
+///   disambiguated for events overloaded within a single ABI.
+/// - `entity_name` names the GraphQL entity type, the `new` expression and the
+///   schema import; it gains a contract prefix when it collides with an entity
+///   that already exists in the subgraph.
+/// - `declare_in_schema` is false when the event reuses an entity that already
+///   exists (a merge), so the type must not be redeclared.
+#[derive(Debug, Clone)]
+pub struct ResolvedEvent {
+    pub event: EventInfo,
+    pub alias: String,
+    pub entity_name: String,
+    pub declare_in_schema: bool,
+}
+
+/// Resolve events for a fresh scaffold, disambiguating names that are overloaded
+/// within one ABI by suffixing repeats (`Transfer`, `Transfer1`, ...). There are
+/// no existing entities to collide with, so each entity is declared as-is.
+pub fn disambiguate_events(events: Vec<EventInfo>) -> Vec<ResolvedEvent> {
+    let mut seen: HashMap<String, usize> = HashMap::new();
+    events
+        .into_iter()
+        .map(|event| {
+            let count = seen.entry(event.name.clone()).or_insert(0);
+            let alias = if *count == 0 {
+                event.name.clone()
+            } else {
+                format!("{}{}", event.name, count)
+            };
+            *count += 1;
+            let entity_name = alias.clone();
+            ResolvedEvent {
+                event,
+                alias,
+                entity_name,
+                declare_in_schema: true,

```

**File**: `gnd/src/scaffold/mapping.rs` (modified, +77/-75)
```diff
@@ -1,7 +1,8 @@
 //! Mapping (AssemblyScript) generation for scaffold.
 
 use super::ScaffoldOptions;
-use super::manifest::{EventInfo, extract_events_from_abi};
+use super::manifest::{EventInfo, ResolvedEvent, extract_events_from_abi};
+use super::sanitize_field_name;
 
 /// Generate the mapping.ts content.
 pub fn generate_mapping(options: &ScaffoldOptions) -> String {
@@ -16,7 +17,8 @@ pub fn generate_mapping(options: &ScaffoldOptions) -> String {
         return generate_placeholder_mapping(contract_name, &events, options);
     }
 
-    generate_event_handlers(contract_name, &events, options)
+    let resolved = super::disambiguate_events(events);
+    generate_event_handlers(contract_name, &resolved)
 }
 
 /// Generate a fallback mapping when no events are found in ABI.
@@ -51,18 +53,20 @@ fn generate_placeholder_mapping(
     events: &[EventInfo],
     options: &ScaffoldOptions,
 ) -> String {
+    let resolved = super::disambiguate_events(events.to_vec());
+
     let mut output = String::new();
 
     // Import graph-ts types
     output.push_str("import {\n  BigInt,\n  Bytes\n} from \"@graphprotocol/graph-ts\"\n");
 
-    // Import contract class and all events
+    // Import contract class and all events (by disambiguated alias).
     output.push_str(&format!("import {{\n  {contract_name},\n"));
-    for (i, event) in events.iter().enumerate() {
-        let suffix = if i < events.len() - 1 { ",\n" } else { "\n" };
+    for (i, event) in resolved.iter().enumerate() {
+        let suffix = if i < resolved.len() - 1 { ",\n" } else { "\n" };
         output.push_str(&format!(
             "  {} as {}Event{}",
-            event.name, event.name, suffix
+            event.alias, event.alias, suffix
         ));
     }
     output.push_str(&format!(
@@ -73,18 +77,17 @@ fn generate_placeholder_mapping(
     output.push_str("import { ExampleEntity } from \"../generated/schema\"\n");
 
     // Generate first handler with full example code
-    let first_event = &events[0];
     output.push_str(&generate_first_placeholder_handler(
-        first_event,
+        &resolved[0],
         contract_name,
         options,
     ));
 
     // Generate empty stub handlers for remaining events
-    for event in events.iter().skip(1) {
+    for event in resolved.iter().skip(1) {
         output.push_str(&format!(
             "\nexport function handle{}(event: {}Event): void {{}}\n",
-            event.name, event.name
+            event.alias, event.alias
         ));
     }
 
@@ -93,19 +96,20 @@ fn generate_placeholder_mapping(
 
 /// Generate the first handler with full example code.
 fn generate_first_placeholder_handler(
-    event: &EventInfo,
+    event: &ResolvedEvent,
     contract_name: &str,
     options: &ScaffoldOptions,
 ) -> String {
-    let event_name = &event.name;
+    let event_name = &event.alias;
 
     // Generate field assignments for first 2 event params
     let mut field_assignments = String::new();
-    for input in event.inputs.iter().take(2) {
-        let field_name = sanitize_param_name(&input.name);
+    let accessors = super::event_param_accessors(&event.event.inputs);
+    for (input, accessor) in event.event.inputs.iter().zip(&accessors).take(2) {
+        let field_name = sanitize_field_name(&input.name);
         field_assignments.push_str(&format!(
             "  entity.{} = event.params.{}\n",
-            field_name, input.name
+            field_name, accessor
         ));
     }
 
@@ -153,22 +157,18 @@ export function handle{event_name}(event: {event_name}Event): void {{
     )
 }
 
-/// Generate event handlers for all events in the ABI.
-fn generate_event_handlers(
-    contract_name: &str,
-    events: &[super::manifest::EventInfo],
-    _options: &ScaffoldOptions,
-) -> String {
-    let mut imports = String::new();
-    let mut handlers = String::new();
+/// Generate event handlers for all resolved events.
+pub fn generate_event_handlers(contract_name: &str, events: &[ResolvedEvent]) -> String {
+    let mut imports = String::from("import { BigInt, Bytes } from \"@graphprotocol/graph-ts\"\n");
 
-    // Import graph-ts types
-    imports.push_str("import { BigInt, Bytes } from \"@graphprotocol/graph-ts\"\n");
+    if events.is_empty() {
+        return imports;
+    }
 
-    // Import event types
+    // Import event types (by ABI alias).
     let event_imports: Vec<String> = events
         .iter()
-        .map(|e| format!("{} as {}Event", e.name, e.name))
+        .map(|e| format!("{} as {}Event", e.alias, e.alias))
         .collect();
 
     imports.push_str(&format!(
@@ -178,15 +178,16 @@ fn generate_event_handlers(
         contract_name
     ));
 
-    // Import entity types
-    let entity_imports: Vec<String> = events.iter().map(|e| e.name.clone()).collect();
+    // Import entity types.
+    let entity_imports: Vec<String> = events.iter().map(|e| e.entity_name.clone()).collect();
 
     imports.push_str(&format!(
         "import {{ {} }} from \"../generated/
```

**File**: `gnd/src/scaffold/mod.rs` (modified, +12/-3)
```diff
@@ -5,11 +5,16 @@
 
 pub mod manifest;
 mod mapping;
+mod naming;
 mod schema;
 
-pub use manifest::{EventInfo, EventInput, extract_events_from_abi, generate_manifest};
-pub use mapping::generate_mapping;
-pub use schema::generate_schema;
+pub use manifest::{
+    EventInfo, EventInput, ResolvedEvent, disambiguate_events, event_param_accessors,
+    extract_events_from_abi, generate_manifest,
+};
+pub use mapping::{generate_event_handlers, generate_mapping};
+pub(crate) use naming::sanitize_field_name;
+pub use schema::{generate_event_entity, generate_schema};
 
 use std::fs;
 use std::path::Path;
@@ -60,6 +65,10 @@ const GRAPH_CLI_VERSION: &str = "0.98.0";
 const GRAPH_TS_VERSION: &str = "0.37.0";
 const MATCHSTICK_VERSION: &str = "0.6.0";
 
+/// Manifest format versions emitted by the scaffolder.
+pub(crate) const SPEC_VERSION: &str = "1.3.0";
+pub(crate) const MAPPING_API_VERSION: &str = "0.0.9";
+
 /// Generate all scaffold files and write to directory.
 pub fn generate_scaffold(dir: &Path, options: &ScaffoldOptions) -> Result<()> {
     step(Step::Generate, "Generating scaffold files");
```

**File**: `gnd/src/scaffold/naming.rs` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+//! Shared name sanitization for scaffold code generation.
+//!
+//! A single source of truth for turning ABI parameter names into valid GraphQL
+//! field / AssemblyScript identifiers, used by both the schema and mapping
+//! generators so the two never disagree.
+
+/// Sanitize a parameter name into a valid GraphQL/AssemblyScript field identifier.
+pub(crate) fn sanitize_field_name(name: &str) -> String {
+    if name.is_empty() {
+        return "value".to_string();
+    }
+
+    // Identifiers must start with a letter or underscore; replace anything else.
+    let mut result = String::new();
+    for (i, c) in name.chars().enumerate() {
+        if i == 0 && c.is_ascii_digit() {
+            result.push('_');
+        }
+        if c.is_alphanumeric() || c == '_' {
+            result.push(c);
+        } else {
+            result.push('_');
+        }
+    }
+
+    // Convert a leading uppercase to camelCase.
+    if result
+        .chars()
+        .next()
+        .map(|c| c.is_uppercase())
+        .unwrap_or(false)
+    {
+        let mut chars = result.chars();
+        if let Some(first) = chars.next() {
+            result = first.to_lowercase().collect::<String>() + chars.as_str();
+        }
+    }
+
+    // Avoid clashing with the entity `id` field and the GraphQL `type` keyword.
+    let result = match result.as_str() {
+        "id" => "eventId".to_string(),
+        "type" => "eventType".to_string(),
+        _ => result,
+    };
+
+    // Escape reserved words via the shared list, so the entity field name
+    // matches the member the schema/ABI codegen generates from the same list.
+    crate::shared::handle_reserved_word(&result)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_sanitize_field_name() {
+        // Normal names pass through.
+        assert_eq!(sanitize_field_name("owner"), "owner");
+        assert_eq!(sanitize_field_name("from"), "from");
+        // Empty -> placeholder.
+        assert_eq!(sanitize_field_name(""), "value");
+        // Leading uppercase -> camelCase.
+        assert_eq!(sanitize_field_name("Owner"), "owner");
+        assert_eq!(sanitize_field_name("TokenId"), "tokenId");
+        // Names that clash with the entity id / GraphQL keyword.
+        assert_eq!(sanitize_field_name("id"), "eventId");
+        assert_eq!(sanitize_field_name("type"), "eventType");
+        // Reserved words are suffixed so the generated code compiles. These use
+        // the shared list, so words only in it (for/default/null/void/instanceof)
+        // are covered too — and stay consistent with the schema/ABI codegen.
+        assert_eq!(sanitize_field_name("new"), "new_");
+        assert_eq!(sanitize_field_name("class"), "class_");
+        assert_eq!(sanitize_field_name("return"), "return_");
+        assert_eq!(sanitize_field_name("for"), "for_");
+        assert_eq!(sanitize_field_name("default"), "default_");
+        assert_eq!(sanitize_field_name("null"), "null_");
+        assert_eq!(sanitize_field_name("void"), "void_");
+        assert_eq!(sanitize_field_name("instanceof"), "instanceof_");
+        // Leading uppercase reserved word still resolves after camelCasing.
+        assert_eq!(sanitize_field_name("New"), "new_");
+        // Leading digit -> underscore prefix.
+        assert_eq!(sanitize_field_name("0value"), "_0value");
+        // Non-alphanumeric -> underscore.
+        assert_eq!(sanitize_field_name("a-b"), "a_b");
+    }
+}
```

**File**: `gnd/src/scaffold/schema.rs` (modified, +45/-55)
```diff
@@ -2,6 +2,7 @@
 
 use super::ScaffoldOptions;
 use super::manifest::{EventInput, extract_events_from_abi};
+use super::sanitize_field_name;
 
 /// Generate the schema.graphql content.
 pub fn generate_schema(options: &ScaffoldOptions) -> String {
@@ -17,11 +18,11 @@ pub fn generate_schema(options: &ScaffoldOptions) -> String {
         return generate_example_entity(&events[0].inputs);
     }
 
-    // Generate entity for each event
+    // Generate an entity for each event, disambiguating overloaded names.
     let mut schema = String::new();
 
-    for event in events {
-        let entity = generate_event_entity(&event.name, &event.inputs);
+    for resolved in super::disambiguate_events(events) {
+        let entity = generate_event_entity(&resolved.entity_name, &resolved.event.inputs);
         schema.push_str(&entity);
         schema.push_str("\n\n");
     }
@@ -55,7 +56,7 @@ fn generate_example_entity(inputs: &[EventInput]) -> String {
 }
 
 /// Generate an entity type for an event.
-fn generate_event_entity(event_name: &str, inputs: &[EventInput]) -> String {
+pub fn generate_event_entity(entity_name: &str, inputs: &[EventInput]) -> String {
     let mut fields = String::new();
 
     // ID field
@@ -76,7 +77,7 @@ fn generate_event_entity(event_name: &str, inputs: &[EventInput]) -> String {
     format!(
         "# Declare entity types as immutable when possible for better performance\n\
          type {} @entity(immutable: true) {{\n{}\n}}",
-        event_name, fields
+        entity_name, fields
     )
 }
 
@@ -88,6 +89,7 @@ fn solidity_to_graphql(solidity_type: &str) -> &'static str {
         return match solidity_to_graphql(inner) {
             "Bytes" => "[Bytes!]",
             "BigInt" => "[BigInt!]",
+            "Int" => "[Int!]",
             "String" => "[String!]",
             "Boolean" => "[Boolean!]",
             _ => "[Bytes!]",
@@ -112,53 +114,35 @@ fn solidity_to_graphql(solidity_type: &str) -> &'static str {
         | "bytes23" | "bytes24" | "bytes25" | "bytes26" | "bytes27" | "bytes28" | "bytes29"
         | "bytes30" | "bytes31" | "bytes32" => "Bytes",
 
-        // Integer types - all map to BigInt for simplicity
-        t if t.starts_with("uint") || t.starts_with("int") => "BigInt",
+        // Integers: small widths fit in an i32 (GraphQL Int), the rest need BigInt.
+        t if t.starts_with("uint") || t.starts_with("int") => int_to_graphql(t),
 
         // Default to Bytes for unknown types
         _ => "Bytes",
     }
 }
 
-/// Sanitize a field name to be a valid GraphQL identifier.
-fn sanitize_field_name(name: &str) -> String {
-    if name.is_empty() {
-        return "value".to_string();
-    }
-
-    // GraphQL field names must start with a letter or underscore
-    let mut result = String::new();
-
-    for (i, c) in name.chars().enumerate() {
-        if i == 0 && c.is_ascii_digit() {
-            result.push('_');
-        }
-        if c.is_alphanumeric() || c == '_' {
-            result.push(c);
-        } else {
-            result.push('_');
-        }
-    }
-
-    // Convert to camelCase if starts with uppercase
-    if result
-        .chars()
-        .next()
-        .map(|c| c.is_uppercase())
-        .unwrap_or(false)
-    {
-        let mut chars = result.chars();
-        if let Some(first) = chars.next() {
-            result = first.to_lowercase().collect::<String>() + chars.as_str();
-        }
-    }
-
-    // Avoid reserved words
-    match result.as_str() {
-        "id" => "eventId".to_string(),
-        "type" => "eventType".to_string(),
-        _ => result,
-    }
+/// Map a Solidity integer type to GraphQL `Int` when it fits in an i32, else
+/// `BigInt`. An i32 holds signed ints up to 32 bits and unsigned ints up to 24
+/// bits, matching graph-cli's AssemblyScript type conversion.
+fn int_to_graphql(solidity_type: &str) -> &'static str {
+    let (signed, width) = match solidity_type.strip_prefix("uint") {
+        Some(rest) => (false, rest),
+        None => match solidity_type.strip_prefix("int") {
+            Some(rest) => (true, rest),
+            None => return "BigInt",
+        },
+    };
+
+    // A bare `int` / `uint` is 256 bits.
+    let bits: u32 = if width.is_empty() {
+        256
+    } else {
+        width.parse().unwrap_or(256)
+    };
+
+    let fits_i32 = if signed { bits <= 32 } else { bits <= 24 };
+    if fits_i32 { "Int" } else { "BigInt" }
 }
 
 #[cfg(test)]
@@ -270,21 +254,27 @@ mod tests {
         assert_eq!(solidity_to_graphql("address"), "Bytes");
         assert_eq!(solidity_to_graphql("bool"), "Boolean");
         assert_eq!(solidity_to_graphql("string"), "String");
-        assert_eq!(solidity_to_graphql("uint256"), "BigInt");
-        assert_eq!(solidity_to_graphql("int8"), "BigInt");
         assert_eq!(solidity_to_graphql("bytes32"), "Bytes");
         assert_eq!(solidity_to_graphql("bytes"), "Bytes");
         assert_eq!(solidity_to_graphql("address[]"), "[Bytes!]");
         assert_eq!(
```

**File**: `gnd/tests/cli_commands.rs` (modified, +232/-0)
```diff
@@ -431,6 +431,13 @@ fn test_add_datasource() {
         "Initial manifest should not have SecondContract"
     );
 
+    // The added contract's event entity should not exist in the schema yet.
+    let schema_before = fs::read_to_string(subgraph_dir.join("schema.graphql")).unwrap();
+    assert!(
+        !schema_before.contains("type Trigger"),
+        "Initial schema should not have the Trigger entity"
+    );
+
     // Now add another datasource
     let second_abi_path = test_abis_path().join("LimitedContract.json");
     let output = run_gnd(
@@ -465,6 +472,231 @@ fn test_add_datasource() {
         manifest_after.contains("0x2222222222222222222222222222222222222222"),
         "Updated manifest should have second contract address"
     );
+
+    // The added Trigger event collides with the first contract's Trigger entity;
+    // without --merge-entities it is renamed with the contract prefix so both
+    // can coexist, and declared in the schema.
+    let schema_after = fs::read_to_string(subgraph_dir.join("schema.graphql")).unwrap();
+    assert!(
+        schema_after.contains("type SecondContractTrigger @entity"),
+        "Updated schema should declare the renamed entity, got:\n{}",
+        schema_after
+    );
+}
+
+#[test]
+fn test_add_merge_entities_reuses_existing() {
+    let temp_dir = TempDir::new().unwrap();
+    let subgraph_dir = temp_dir.path().join("merge-test");
+
+    // Init with --index-events so the schema actually declares the event entities.
+    let abi_path = test_abis_path().join("SimpleContract.json");
+    run_gnd_success(
+        &[
+            "init",
+            "--from-contract",
+            "0x1111111111111111111111111111111111111111",
+            "--abi",
+            abi_path.to_str().unwrap(),
+            "--network",
+            "mainnet",
+            "--contract-name",
+            "FirstContract",
+            "--index-events",
+            "merge-test",
+        ],
+        temp_dir.path(),
+    );
+
+    // Add a contract whose Trigger event collides, with --merge-entities.
+    let second_abi_path = test_abis_path().join("LimitedContract.json");
+    run_gnd_success(
+        &[
+            "add",
+            "0x2222222222222222222222222222222222222222",
+            "--abi",
+            second_abi_path.to_str().unwrap(),
+            "--contract-name",
+            "SecondContract",
+            "--merge-entities",
+        ],
+        &subgraph_dir,
+    );
+
+    // Merge reuses the existing Trigger entity: no renamed type is declared...
+    let schema_after = fs::read_to_string(subgraph_dir.join("schema.graphql")).unwrap();
+    assert!(
+        !schema_after.contains("SecondContractTrigger"),
+        "merge should reuse Trigger, not declare a renamed entity, got:\n{}",
+        schema_after
+    );
+
+    // ...but the handler is still generated, writing into the shared entity.
+    let mapping = fs::read_to_string(subgraph_dir.join("src").join("second-contract.ts")).unwrap();
+    assert!(
+        mapping.contains("new Trigger("),
+        "merged handler should write into the existing Trigger entity, got:\n{}",
+        mapping
+    );
+}
+
+#[test]
+fn test_add_overloaded_events_disambiguate() {
+    let temp_dir = TempDir::new().unwrap();
+    let subgraph_dir = temp_dir.path().join("over-test");
+
+    // A base subgraph without overloaded events.
+    let abi_path = test_abis_path().join("LimitedContract.json");
+    run_gnd_success(
+        &[
+            "init",
+            "--from-contract",
+            "0x1111111111111111111111111111111111111111",
+            "--abi",
+            abi_path.to_str().unwrap(),
+            "--network",
+            "mainnet",
+            "--contract-name",
+            "Base",
+            "over-test",
+        ],
+        temp_dir.path(),
+    );
+
+    // An ABI with two events of the same name (a Solidity overload).
+    let overloaded_abi = temp_dir.path().join("Overloaded.json");
+    fs::write(
+        &overloaded_abi,
+        r#"[
+          {"type":"event","name":"Ping","inputs":[{"name":"account","type":"address","indexed":true}]},
+          {"type":"event","name":"Ping","inputs":[{"name":"amount","type":"uint256","indexed":false}]}
+        ]"#,
+    )
+    .unwrap();
+
+    run_gnd_success(
+        &[
+            "add",
+            "0x2222222222222222222222222222222222222222",
+            "--abi",
+            overloaded_abi.to_str().unwrap(),
+            "--contract-name",
+            "Over",
+        ],
+        &subgraph_dir,
+    );
+
+    // The two Ping events get distinct entities and handlers.
+    let schema = fs::read_to_string(subgraph_dir.join("schema.graphql")).unwrap();
+    assert!(
+        schema.contains("type Ping @entity") && schema.contains("type Ping1 @entity"),
+        "overloaded events should produce Ping and Ping1 entities, got:\n{}",
+        schema
+    );
+
+    let mapping = fs::read_to_string(subgraph_dir.join("src").join("over.ts")).un
```

---

### Incident Patch 5: `b3bc39c3` (2026-07-06)
**Commit Message**: build(deps): bump prost from 0.14.3 to 0.14.4

Bumps [prost](https://github.com/tokio-rs/prost) from 0.14.3 to 0.14.4.
- [Release notes](https://github.com/tokio-rs/prost/releases)
- [Changelog](https://github.com/tokio-rs/prost/blob/master/CHANGELOG.md)
- [Commits](https://github.com/tokio-rs/prost/compare/v0.14.3...v0.14.4)

---
updated-dependencies:
- dependency-name: prost
  dependency-version: 0.14.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -6452,9 +6452,9 @@ dependencies = [
 
 [[package]]
 name = "prost"
-version = "0.14.3"
+version = "0.14.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d2ea70524a2f82d518bce41317d0fae74151505651af45faf1ffbd6fd33f0568"
+checksum = "528ac67416ff8646872a3c02cad9cc4ee5dc9f9540c9b10771855c95cb2e5ae1"
 dependencies = [
  "bytes",
  "prost-derive",
@@ -6483,9 +6483,9 @@ dependencies = [
 
 [[package]]
 name = "prost-derive"
-version = "0.14.3"
+version = "0.14.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "27c6023962132f4b30eb4c172c91ce92d933da334c59c23cddee82358ddafb0b"
+checksum = "b570b25f7617e43d59005d0990ccb79e950a423952cea19671b7a876da390adf"
 dependencies = [
  "anyhow",
  "itertools 0.10.5",
```

---

### Incident Patch 6: `cdd2ed27` (2026-07-06)
**Commit Message**: build(deps): bump itertools from 0.14.0 to 0.15.0

Bumps [itertools](https://github.com/rust-itertools/itertools) from 0.14.0 to 0.15.0.
- [Changelog](https://github.com/rust-itertools/itertools/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-itertools/itertools/compare/v0.14.0...v0.15.0)

---
updated-dependencies:
- dependency-name: itertools
  dependency-version: 0.15.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +10/-10)
```diff
@@ -606,7 +606,7 @@ dependencies = [
  "alloy-serde",
  "alloy-sol-types",
  "arbitrary",
- "itertools 0.14.0",
+ "itertools 0.13.0",
  "serde",
  "serde_json",
  "serde_with",
@@ -786,7 +786,7 @@ checksum = "b273587487921274f4f5d0ef2c7ef36944dcbb75a4e2318e69eae822bd263f91"
 dependencies = [
  "alloy-json-rpc",
  "alloy-transport",
- "itertools 0.14.0",
+ "itertools 0.13.0",
  "reqwest 0.13.2",
  "serde_json",
  "tower 0.5.2",
@@ -3922,7 +3922,7 @@ dependencies = [
  "hyper",
  "hyper-util",
  "indoc",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "lazy-regex",
  "lazy_static",
  "lru_time_cache",
@@ -3998,7 +3998,7 @@ dependencies = [
  "graph-runtime-derive",
  "graph-runtime-wasm",
  "hex",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "jsonrpc-core",
  "prost",
  "prost-types",
@@ -4044,7 +4044,7 @@ dependencies = [
  "graph-chain-near",
  "graph-runtime-wasm",
  "indoc",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "parking_lot",
  "prometheus",
  "serde_yaml",
@@ -4099,7 +4099,7 @@ dependencies = [
  "graphman",
  "graphman-server",
  "indicatif",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "json-structural-diff",
  "lazy_static",
  "prometheus",
@@ -4219,7 +4219,7 @@ dependencies = [
  "graph",
  "graphman-store",
  "hex",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "lazy_static",
  "lru_time_cache",
  "openssl",
@@ -4284,7 +4284,7 @@ dependencies = [
  "graph",
  "graph-store-postgres",
  "graphman-store",
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "thiserror 2.0.18",
  "tokio",
 ]
@@ -6467,7 +6467,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "343d3bd7056eda839b03204e68deff7d1b13aba7af2b2fd16890697274262ee7"
 dependencies = [
  "heck 0.5.0",
- "itertools 0.14.0",
+ "itertools 0.10.5",
  "log",
  "multimap",
  "petgraph 0.8.3",
@@ -6488,7 +6488,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "27c6023962132f4b30eb4c172c91ce92d933da334c59c23cddee82358ddafb0b"
 dependencies = [
  "anyhow",
- "itertools 0.14.0",
+ "itertools 0.10.5",
  "proc-macro2",
  "quote",
  "syn 2.0.118",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ graphman-store = { path = "./core/graphman_store" }
 graphql-tools = "0.5.1"
 indicatif = "0.18"
 Inflector = "0.11.3"
-itertools = "0.14.0"
+itertools = "0.15.0"
 lazy_static = "1.5.0"
 prost = "0.14"
 prost-types = "0.14"
```

**File**: `chain/ethereum/Cargo.toml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ tokio = { workspace = true }
 tokio-stream = { workspace = true }
 tower = { workspace = true }
 
-itertools = "0.14.0"
+itertools = "0.15.0"
 
 graph-runtime-wasm = { path = "../../runtime/wasm" }
 graph-runtime-derive = { path = "../../runtime/derive" }
```

**File**: `graph/Cargo.toml` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ wasmparser = "0.118.1"
 thiserror = { workspace = true }
 parking_lot = "0.12.5"
 portable-atomic = { version = "1.13", features = ["fallback"] }
-itertools = "0.14.0"
+itertools = "0.15.0"
 defer = "0.2"
 
 serde_plain = "1.0.2"
```

**File**: `store/postgres/Cargo.toml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ tokio = { workspace = true }
 tokio-stream = { workspace = true }
 anyhow = "1.0.102"
 git-testament = { workspace = true }
-itertools = "0.14.0"
+itertools = "0.15.0"
 hex = "0.4.3"
 pretty_assertions = "1.4.1"
 sqlparser = { workspace = true }
```

---

### Incident Patch 7: `f26a0ab8` (2026-07-06)
**Commit Message**: build(deps): bump console from 0.16.3 to 0.16.4

Bumps [console](https://github.com/console-rs/console) from 0.16.3 to 0.16.4.
- [Release notes](https://github.com/console-rs/console/releases)
- [Changelog](https://github.com/console-rs/console/blob/main/CHANGELOG.md)
- [Commits](https://github.com/console-rs/console/compare/0.16.3...0.16.4)

---
updated-dependencies:
- dependency-name: console
  dependency-version: 0.16.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +9/-9)
```diff
@@ -945,7 +945,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -2233,9 +2233,9 @@ dependencies = [
 
 [[package]]
 name = "console"
-version = "0.16.3"
+version = "0.16.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d64e8af5551369d19cf50138de61f1c42074ab970f74e99be916646777f8fc87"
+checksum = "4fe5f465a4f6fee88fad41b85d990f84c835335e85b5d9e6e63e0d06d28cba7c"
 dependencies = [
  "encode_unicode",
  "libc",
@@ -3846,7 +3846,7 @@ dependencies = [
  "async-trait",
  "clap",
  "clap_complete",
- "console 0.16.3",
+ "console 0.16.4",
  "env_logger",
  "git-testament",
  "globset",
@@ -4081,7 +4081,7 @@ version = "0.44.0"
 dependencies = [
  "anyhow",
  "clap",
- "console 0.16.3",
+ "console 0.16.4",
  "diesel",
  "diesel-async",
  "env_logger",
@@ -4917,7 +4917,7 @@ version = "0.18.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "993f007684f2e9727160da8b960ec161264703bfd1af084fd2e34d040c9a0dd4"
 dependencies = [
- "console 0.16.3",
+ "console 0.16.4",
  "portable-atomic",
  "unicode-width",
  "unit-prefix",
@@ -7154,7 +7154,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.61.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -7212,7 +7212,7 @@ dependencies = [
  "security-framework 3.7.0",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.61.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -8114,7 +8114,7 @@ dependencies = [
  "getrandom 0.4.2",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.61.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
```

---

### Incident Patch 8: `2e925ca6` (2026-06-30)
**Commit Message**: firehose: fix optimism check in extended blocks check

**File**: `graph/src/firehose/endpoints.rs` (modified, +6/-7)
```diff
@@ -89,13 +89,12 @@ impl NetworkDetails for Arc<FirehoseEndpoint> {
 
     async fn provides_extended_blocks(&self) -> anyhow::Result<bool> {
         let info = self.clone().info().await?;
-        let pred = if info.chain_name.contains("arbitrum-one")
-            || info.chain_name.contains("optimism-mainnet")
-        {
-            |x: &String| x.starts_with("extended") || x == "hybrid"
-        } else {
-            |x: &String| x == "extended"
-        };
+        let pred =
+            if info.chain_name.contains("arbitrum-one") || info.chain_name.contains("optimism") {
+                |x: &String| x.starts_with("extended") || x == "hybrid"
+            } else {
+                |x: &String| x == "extended"
+            };
 
         Ok(info.block_features.iter().any(pred))
     }
```

---

### Incident Patch 9: `972a550a` (2026-06-25)
**Commit Message**: store: skip chains in pool_size = 0 shards instead of panicking at startup

**File**: `store/postgres/src/block_store.rs` (modified, +23/-0)
```diff
@@ -275,6 +275,18 @@ impl BlockStore {
                 .iter()
                 .find(|chain| chain.name == chain_name)
             {
+                // A shard configured with `pool_size = 0` is intentionally
+                // ignored and has no connection pool. Skip chains that live in
+                // such a shard rather than failing startup. See issue #6195.
+                if !block_store.pools.contains_key(&chain.shard) {
+                    warn!(
+                        &block_store.logger,
+                        "Skipping chain `{}`: its shard `{}` has no connection pool (pool_size = 0)",
+                        chain.name,
+                        chain.shard,
+                    );
+                    continue;
+                }
                 if chain.shard != shard {
                     warn!(
                         &block_store.logger,
@@ -300,6 +312,17 @@ impl BlockStore {
             .iter()
             .filter(|chain| !configured_chains.contains(&chain.name))
         {
+            // Skip chains whose shard has no connection pool (pool_size = 0)
+            // instead of failing startup. See issue #6195.
+            if !block_store.pools.contains_key(&chain.shard) {
+                warn!(
+                    &block_store.logger,
+                    "Skipping chain `{}`: its shard `{}` has no connection pool (pool_size = 0)",
+                    chain.name,
+                    chain.shard,
+                );
+                continue;
+            }
             block_store.add_chain_store(chain, false).await?;
         }
         Ok(block_store)
```

---

### Incident Patch 10: `3bdc21ed` (2026-06-30)
**Commit Message**: build(deps): bump diesel-async from 0.9.0 to 0.9.2

Bumps [diesel-async](https://github.com/weiznich/diesel_async) from 0.9.0 to 0.9.2.
- [Release notes](https://github.com/weiznich/diesel_async/releases)
- [Changelog](https://github.com/diesel-rs/diesel_async/blob/main/CHANGELOG.md)
- [Commits](https://github.com/weiznich/diesel_async/compare/v0.9.0...v0.9.2)

---
updated-dependencies:
- dependency-name: diesel-async
  dependency-version: 0.9.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +5/-16)
```diff
@@ -1814,17 +1814,6 @@ dependencies = [
  "serde",
 ]
 
-[[package]]
-name = "bigdecimal"
-version = "0.3.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a6773ddc0eafc0e509fb60e48dff7f450f8e674a0686ae8605e8d9901bd5eefa"
-dependencies = [
- "num-bigint 0.4.6",
- "num-integer",
- "num-traits",
-]
-
 [[package]]
 name = "bimap"
 version = "0.6.3"
@@ -2993,14 +2982,14 @@ version = "2.3.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9940fb8467a0a06312218ed384185cb8536aa10d8ec017d0ce7fad2c1bd882d5"
 dependencies = [
- "bigdecimal 0.3.1",
+ "bigdecimal",
  "bitflags 2.11.1",
  "byteorder",
  "chrono",
  "diesel_derives",
  "downcast-rs",
  "itoa",
- "num-bigint 0.4.6",
+ "num-bigint 0.2.6",
  "num-integer",
  "num-traits",
  "pq-sys",
@@ -3010,9 +2999,9 @@ dependencies = [
 
 [[package]]
 name = "diesel-async"
-version = "0.9.0"
+version = "0.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9c20ddcc6737cecdaef3dfecb2796bdfe3002456521189d30be8e4c5a1bc821d"
+checksum = "dd39af30158d444884f166fe4c58f35dc40ad71ad017bb59408a3448526ff4bd"
 dependencies = [
  "deadpool 0.13.0",
  "diesel",
@@ -3908,7 +3897,7 @@ dependencies = [
  "async-trait",
  "atomic_refcell",
  "base64 0.21.7",
- "bigdecimal 0.1.2",
+ "bigdecimal",
  "bs58 0.5.1",
  "bytes",
  "chrono",
```

---

### Incident Patch 11: `8b143999` (2026-06-29)
**Commit Message**: build(deps): bump open from 5.3.5 to 5.3.6

Bumps [open](https://github.com/Byron/open-rs) from 5.3.5 to 5.3.6.
- [Release notes](https://github.com/Byron/open-rs/releases)
- [Changelog](https://github.com/Byron/open-rs/blob/main/changelog.md)
- [Commits](https://github.com/Byron/open-rs/compare/v5.3.5...v5.3.6)

---
updated-dependencies:
- dependency-name: open
  dependency-version: 5.3.6
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-9)
```diff
@@ -5853,13 +5853,12 @@ checksum = "384b8ab6d37215f3c5301a95a4accb5d64aa607f1fcb26a11b5303878451b4fe"
 
 [[package]]
 name = "open"
-version = "5.3.5"
+version = "5.3.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2fbaa89d2ddc8473c78a3adf69eea8cffa28c483b8e02a971ef31527cd0fc92c"
+checksum = "cd8d3b65c44123a56e0133d2cd06ce4361bd3ca99d41198b2f25e3c3db9b8b4a"
 dependencies = [
  "is-wsl",
  "libc",
- "pathdiff",
 ]
 
 [[package]]
@@ -6020,12 +6019,6 @@ version = "1.0.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "57c0d7b74b563b49d38dae00a0c37d4d6de9b432382b2892f0574ddcae73fd0a"
 
-[[package]]
-name = "pathdiff"
-version = "0.2.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df94ce210e5bc13cb6651479fa48d14f601d9858cfe0467f43ae157023b938d3"
-
 [[package]]
 name = "percent-encoding"
 version = "2.3.2"
```

---

### Incident Patch 12: `f1c0fca1` (2026-06-29)
**Commit Message**: build(deps): bump rustls from 0.23.40 to 0.23.41

Bumps [rustls](https://github.com/rustls/rustls) from 0.23.40 to 0.23.41.
- [Release notes](https://github.com/rustls/rustls/releases)
- [Changelog](https://github.com/rustls/rustls/blob/main/CHANGELOG.md)
- [Commits](https://github.com/rustls/rustls/compare/v/0.23.40...v/0.23.41)

---
updated-dependencies:
- dependency-name: rustls
  dependency-version: 0.23.41
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -7177,9 +7177,9 @@ dependencies = [
 
 [[package]]
 name = "rustls"
-version = "0.23.40"
+version = "0.23.41"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ef86cd5876211988985292b91c96a8f2d298df24e75989a43a3c73f2d4d8168b"
+checksum = "6b92b125634d9b795e7beca796cc790df15a7fb38323bf3196fda83292d06b1f"
 dependencies = [
  "aws-lc-rs",
  "log",
```

---

### Incident Patch 13: `25e970ae` (2026-06-30)
**Commit Message**: build(deps): bump quote from 1.0.45 to 1.0.46

Bumps [quote](https://github.com/dtolnay/quote) from 1.0.45 to 1.0.46.
- [Release notes](https://github.com/dtolnay/quote/releases)
- [Commits](https://github.com/dtolnay/quote/compare/1.0.45...1.0.46)

---
updated-dependencies:
- dependency-name: quote
  dependency-version: 1.0.46
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +13/-13)
```diff
@@ -606,7 +606,7 @@ dependencies = [
  "alloy-serde",
  "alloy-sol-types",
  "arbitrary",
- "itertools 0.13.0",
+ "itertools 0.14.0",
  "serde",
  "serde_json",
  "serde_with",
@@ -786,7 +786,7 @@ checksum = "b273587487921274f4f5d0ef2c7ef36944dcbb75a4e2318e69eae822bd263f91"
 dependencies = [
  "alloy-json-rpc",
  "alloy-transport",
- "itertools 0.13.0",
+ "itertools 0.14.0",
  "reqwest 0.13.2",
  "serde_json",
  "tower 0.5.2",
@@ -945,7 +945,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -4002,7 +4002,7 @@ version = "0.44.0"
 dependencies = [
  "anyhow",
  "async-trait",
- "base64 0.21.7",
+ "base64 0.22.1",
  "envconfig",
  "futures 0.3.31",
  "graph",
@@ -6484,8 +6484,8 @@ version = "0.14.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "343d3bd7056eda839b03204e68deff7d1b13aba7af2b2fd16890697274262ee7"
 dependencies = [
- "heck 0.4.1",
- "itertools 0.10.5",
+ "heck 0.5.0",
+ "itertools 0.14.0",
  "log",
  "multimap",
  "petgraph 0.8.3",
@@ -6506,7 +6506,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "27c6023962132f4b30eb4c172c91ce92d933da334c59c23cddee82358ddafb0b"
 dependencies = [
  "anyhow",
- "itertools 0.10.5",
+ "itertools 0.14.0",
  "proc-macro2",
  "quote",
  "syn 2.0.118",
@@ -6683,9 +6683,9 @@ dependencies = [
 
 [[package]]
 name = "quote"
-version = "1.0.45"
+version = "1.0.46"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "41f2619966050689382d2b44f664f4bc593e129785a36d6ee376ddf37259b924"
+checksum = "dfbc457d0c7a0759a614551b11a6409e5951f6c7537be1f1b7682b9ae9230368"
 dependencies = [
  "proc-macro2",
 ]
@@ -7172,7 +7172,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -7230,7 +7230,7 @@ dependencies = [
  "security-framework 3.7.0",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -8129,10 +8129,10 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.3.1",
+ "getrandom 0.4.2",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
```

---

### Incident Patch 14: `2faa26e9` (2026-06-30)
**Commit Message**: build(deps): bump indicatif from 0.18.4 to 0.18.5

Bumps [indicatif](https://github.com/console-rs/indicatif) from 0.18.4 to 0.18.5.
- [Release notes](https://github.com/console-rs/indicatif/releases)
- [Commits](https://github.com/console-rs/indicatif/compare/0.18.4...0.18.5)

---
updated-dependencies:
- dependency-name: indicatif
  dependency-version: 0.18.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -4924,9 +4924,9 @@ dependencies = [
 
 [[package]]
 name = "indicatif"
-version = "0.18.4"
+version = "0.18.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "25470f23803092da7d239834776d653104d551bc4d7eacaf31e6837854b8e9eb"
+checksum = "993f007684f2e9727160da8b960ec161264703bfd1af084fd2e34d040c9a0dd4"
 dependencies = [
  "console 0.16.3",
  "portable-atomic",
```

---

### Incident Patch 15: `34195810` (2026-06-30)
**Commit Message**: build(deps): bump wasmtime from 46.0.0 to 46.0.1

Bumps [wasmtime](https://github.com/bytecodealliance/wasmtime) from 46.0.0 to 46.0.1.
- [Release notes](https://github.com/bytecodealliance/wasmtime/releases)
- [Changelog](https://github.com/bytecodealliance/wasmtime/blob/v46.0.1/RELEASES.md)
- [Commits](https://github.com/bytecodealliance/wasmtime/compare/v46.0.0...v46.0.1)

---
updated-dependencies:
- dependency-name: wasmtime
  dependency-version: 46.0.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +66/-66)
```diff
@@ -606,7 +606,7 @@ dependencies = [
  "alloy-serde",
  "alloy-sol-types",
  "arbitrary",
- "itertools 0.14.0",
+ "itertools 0.13.0",
  "serde",
  "serde_json",
  "serde_with",
@@ -786,7 +786,7 @@ checksum = "b273587487921274f4f5d0ef2c7ef36944dcbb75a4e2318e69eae822bd263f91"
 dependencies = [
  "alloy-json-rpc",
  "alloy-transport",
- "itertools 0.14.0",
+ "itertools 0.13.0",
  "reqwest 0.13.2",
  "serde_json",
  "tower 0.5.2",
@@ -2374,37 +2374,37 @@ dependencies = [
 
 [[package]]
 name = "cranelift-assembler-x64"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "715783c05f20985a5dfe6bfdccbfcb146cb44bfd8f6ff1d09526c3bf442fdac5"
+checksum = "e06aeba2c965fc446d13c56a6ccb2631b78445d7544543dd9a25289977630914"
 dependencies = [
  "cranelift-assembler-x64-meta",
 ]
 
 [[package]]
 name = "cranelift-assembler-x64-meta"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c3da5a783f2b72af39ab98c1bf3157e081511e1febeafe550d71a4d0ba75f66"
+checksum = "ee2d2dde4ec1352715595b5cfa6fe2e5b8ebb9da3457b3ee8db0aa2808c069aa"
 dependencies = [
  "cranelift-srcgen",
 ]
 
 [[package]]
 name = "cranelift-bforest"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8e2e9b7adf77fa02204d4d523ae4f171b6591c2632b030865336335c7d7b420e"
+checksum = "03b4982ef9fa54ec9eee841e891e7ddc5434be1250e88de31572e000c888f30b"
 dependencies = [
  "cranelift-entity",
  "wasmtime-internal-core",
 ]
 
 [[package]]
 name = "cranelift-bitset"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "90f09d9f397eae612ac15becf0e0b2165d2232003f4f2a1549572a724d1c48c5"
+checksum = "529143118c4eeb58c39ecb02319557d512be6c61348486422974ab8e3906b8a8"
 dependencies = [
  "serde",
  "serde_derive",
@@ -2413,9 +2413,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5e004cf1270abc82f7b9fb32d1a9d73a1cc0d5a0215b97db8c32658748e78b01"
+checksum = "b7780677247ad3577e3a6a3ebf43f39b325a11d6393db72b2c9968a910d4d13d"
 dependencies = [
  "bumpalo",
  "cranelift-assembler-x64",
@@ -2444,9 +2444,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-meta"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "04f32034641f96b123e4fdb5666e726d9f252e222638fc8fdd905b4ff18c3c4e"
+checksum = "ac9645250416cbf92454fe61160e17e026e0ce405906a54500b114f923ddffc9"
 dependencies = [
  "cranelift-assembler-x64-meta",
  "cranelift-codegen-shared",
@@ -2457,24 +2457,24 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-shared"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "746566ae868b0e87a89206b3856350886a4fc2e078ce6485bec2ea6727c31685"
+checksum = "20ee8d222ff0fd3681791979afbf88586ac9f49010d3db96b3cbe4c96759aee3"
 
 [[package]]
 name = "cranelift-control"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "def01ab5cd08a1be551d4bc96adc6af91f89138c4f81d0a60fdf3b9f82272703"
+checksum = "591abe6f5312bd2c4220f1b3bead56c2ad00257c52668015ba013b85dcf2a17a"
 dependencies = [
  "arbitrary",
 ]
 
 [[package]]
 name = "cranelift-entity"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "341d5e1e071320505ebbc8194a8eb61fa94394b1ed93ba3cbec3be5fa1c3c1ce"
+checksum = "a5300c49cf940526fe771517b3b3eabd5d0ff164ee61698579cf403fe8d3af3c"
 dependencies = [
  "cranelift-bitset",
  "serde",
@@ -2484,9 +2484,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-frontend"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "97c6f3e2419ecb54a5503994d35421554c5e487d0493bc86ea96907bab51fd29"
+checksum = "da4adbf760207fdbbe130f1191cce01cdef66831a9f648b1f39ff2800d126d45"
 dependencies = [
  "cranelift-codegen",
  "hashbrown 0.17.0",
@@ -2497,15 +2497,15 @@ dependencies = [
 
 [[package]]
 name = "cranelift-isle"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "21aa47a5e0b1e9fb2c9348459088d5dbb872ebe17781ada1270d8364c7e73257"
+checksum = "8315b21ff018226a42a60a4702c2dd75f6447cac26e9bca622e14c22088c2ff5"
 
 [[package]]
 name = "cranelift-native"
-version = "0.133.0"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c3054a03ac285b170662ec9530602b01cd394a7428cd753b48d9cae51f05249a"
+checksum = "d506ef23a60715bde451b06620b14402166ded3b648454fccbf04f3e46a4aa70"
 dependencies = [
  "cranelift-codegen",
  "libc",
@@ -2514,9 +2514,9 @@ dependencies = [
```

#### Recent Merged Pull Requests:
- **PR #6723** (closed): chain/ethereum: Restore eth_getLogs block range reduction under alloy (@datanexus-vincent)
- **PR #6715** (2026-08-25): all: Drop arrayref by bumping blake3 and stable-hash (@incrypto32)
- **PR #6703** (2026-08-03): v0.45.0 release (@incrypto32)
- **PR #6688** (2026-07-20): store: Modernize layout example to use clap derive API (@lutter)
- **PR #6687** (2026-07-20): store: Populate fulltext columns when copying a subgraph (@lutter)
- **PR #6685** (2026-07-17): build(deps): bump serde_with from 3.12.0 to 3.21.0 (@dependabot[bot])
- **PR #6682** (2026-07-17): build(deps): bump prost-types from 0.14.3 to 0.14.4 (@dependabot[bot])
- **PR #6681** (2026-07-17): build(deps): bump base64 from 0.21.7 to 0.22.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
