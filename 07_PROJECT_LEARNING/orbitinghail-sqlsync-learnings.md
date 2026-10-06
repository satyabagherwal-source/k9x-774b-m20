# Forensic Learning Record (Deep Inspection): orbitinghail/sqlsync

> **Canonical Artifact**: `07_PROJECT_LEARNING/orbitinghail-sqlsync-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/orbitinghail/sqlsync](https://github.com/orbitinghail/sqlsync))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:39.465Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `orbitinghail/sqlsync`
- **Description**: SQLSync is a collaborative offline-first wrapper around SQLite. It is designed to synchronize web application state between users, devices, and the edge.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 2917 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/sqlsync-react/src/hooks.ts`
```
import {
  ConnectionStatus,
  DocId,
  DocType,
  ParameterizedQuery,
  QuerySubscription,
  Row,
  SQLSync,
  normalizeQuery,
  pendingPromise,
} from "@orbitinghail/sqlsync-worker";

import { deepEqual } from "fast-equals";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { SQLSyncContext } from "./context";

export function useSQLSync(): SQLSync {
  const value = useContext(SQLSyncContext);
  if (!value) {
    throw new Error(
      "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>",
    );
  }
  return value;
}

type MutateFn<M> = (mutation: M) => Promise<void>;
type UseMutateFn<M> = (docId: DocId) => MutateFn<M>;

type UseQueryFn = <R = Row>(docId: DocId, query: ParameterizedQuery | string) => QueryState<R>;

type SetConnectionEnabledFn = (enabled: boolean) => Promise<void>;
type UseSetConnectionEnabledFn = (docId: DocId) => SetConnectionEnabledFn;

export interface DocHooks<M> {
  useMutate: UseMutateFn<M>;
  useQuery: UseQueryFn;
  useSetConnectionEnabled: UseSetConnectionEnabledFn;
}

export function createDocHooks<M>(docType: DocType<M>): DocHooks<M> {
  const useMutate = (docId: DocId): MutateFn<M> => {
    const sqlsync = useSQLSync();
    return useCallback(
      (mutation: M) => sqlsync.mutate(docId, docType, mutation),
      [sqlsync, docId, docType],
    );
  };

  const useQueryWrapper = <R = Row>(docId: DocId, query: ParameterizedQuery | string) => {
    return useQuery<M, R>(docType, docId, query);
  };

  const useSetConnectionEnabledWrapper = (docId: DocId) => {
    const sqlsync = useSQLSync();
    return useCallback(
      (enabled: boolean) => sqlsync.setConnectionEnabled(docId, docType, enabled),
      [sqlsync, docId, docType],
    );
  };

  return {
    useMutate,
    useQuery: useQueryWrapper,
    useSetConnectionEnabled: useSetConnectionEnabledWrapper,
  };
}

export type QueryState<R> =
  | { state: "pending"; rows?: R[] }
  | { state: "success"; rows: R[] }
  | { state: "error"; error: Error; rows?: R[] };

export function useQuery<M, R = Row>(
  docType: DocType<M>,
  docId: DocId,
  rawQuery: ParameterizedQuery | string,
): QueryState<R> {
  const sqlsync = useSQLSync();
  const [state, setState] = useState<QueryState<R>>({ state: "pending" });

  // memoize query based on deep equality
  let query = normalizeQuery(rawQuery);
  const queryRef = useRef<ParameterizedQuery>(query);
  if (!deepEqual(queryRef.current, query)) {
    queryRef.current = query;
  }
  query = queryRef.current;

  useEffect(() => {
    const [unsubPromise, unsubResolve] = pendingPromise<() => void>();

    const subscription: QuerySubscription = {
      handleRows: (rows: Row[]) => setState({ state: "success", rows: rows as R[] }),
      handleErr: (err: string) =>
        setState((s) => ({
          state: "error",
          error: new Error(err),
          rows: s.rows,
        })),
    };

    sqlsync
      .subscribe(docId, docType, query, subscription)
      .then(unsubResolve)
      .catch((err: Error) => {
        console.error("sqlsync: error subscribing", err);
        setState({ state: "error", error: err });
      });

    return () => {
      unsubPromise
        .then((unsub) => unsub())
        .catch((err) => {
          console.error("sqlsync: error unsubscribing", err);
        });
    };
  }, [sqlsync, docId, docType, query]);

  return state;
}

export const useConnectionStatus = (): ConnectionStatus => {
  const sqlsync = useSQLSync();
  const [status, setStatus] = useState<ConnectionStatus>(sqlsync.connectionStatus);
  useEffect(() => sqlsync.addConnectionStatusListener(setStatus), [sqlsync]);
  return status;
};

```

### Core Architecture Module: `lib/sqlsync-solid-js/src/hooks.ts`
```
import {
  ConnectionStatus,
  DocId,
  DocType,
  ParameterizedQuery,
  QuerySubscription,
  Row,
  SQLSync,
  normalizeQuery,
  pendingPromise,
} from "@orbitinghail/sqlsync-worker";
import { Accessor, createEffect, createSignal, onCleanup, useContext } from "solid-js";
import { SQLSyncContext } from "./context";

export function useSQLSync(): Accessor<SQLSync> {
  const [sqlSync] = useContext(SQLSyncContext);
  return () => {
    const value = sqlSync();
    if (!value) {
      throw new Error(
        "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>",
      );
    }
    return value;
  };
}

type MutateFn<M> = (mutation: M) => Promise<void>;
type UseMutateFn<M> = (docId: DocId) => MutateFn<M>;

type UseQueryFn = <R = Row>(
  docId: Accessor<DocId>,
  query: Accessor<ParameterizedQuery | string>,
) => Accessor<QueryState<R>>;

type SetConnectionEnabledFn = (enabled: boolean) => Promise<void>;
type UseSetConnectionEnabledFn = (docId: DocId) => SetConnectionEnabledFn;

export interface DocHooks<M> {
  useMutate: UseMutateFn<M>;
  useQuery: UseQueryFn;
  useSetConnectionEnabled: UseSetConnectionEnabledFn;
}

export function createDocHooks<M>(docType: Accessor<DocType<M>>): DocHooks<M> {
  const useMutate = (docId: DocId): MutateFn<M> => {
    const sqlsync = useSQLSync();
    return (mutation: M) => sqlsync().mutate(docId, docType(), mutation);
  };

  const useQueryWrapper = <R = Row>(
    docId: Accessor<DocId>,
    query: Accessor<ParameterizedQuery | string>,
  ) => {
    return useQuery<M, R>(docType, docId, query);
  };

  const useSetConnectionEnabledWrapper = (docId: DocId) => {
    const sqlsync = useSQLSync();
    return (enabled: boolean) => sqlsync().setConnectionEnabled(docId, docType(), enabled);
  };

  return {
    useMutate,
    useQuery: useQueryWrapper,
    useSetConnectionEnabled: useSetConnectionEnabledWrapper,
  };
}

export type QueryState<R> =
  | { state: "pending"; rows?: R[] }
  | { state: "success"; rows: R[] }
  | { state: "error"; error: Error; rows?: R[] };

export function useQuery<M, R = Row>(
  docType: Accessor<DocType<M>>,
  docId: Accessor<DocId>,
  rawQuery: Accessor<ParameterizedQuery | string>,
): Accessor<QueryState<R>> {
  const sqlsync = useSQLSync();
  const [state, setState] = createSignal<QueryState<R>>({ state: "pending" });

  createEffect(() => {
    const query = normalizeQuery(rawQuery());

    const [unsubPromise, unsubResolve] = pendingPromise<() => void>();

    const subscription: QuerySubscription = {
      handleRows: (rows: Row[]) => setState({ state: "success", rows: rows as R[] }),
      handleErr: (err: string) =>
        setState((s) => ({
          state: "error",
          error: new Error(err),
          rows: s.rows,
        })),
    };

    sqlsync()
      .subscribe(docId(), docType(), query, subscription)
      .then(unsubResolve)
      .catch((err: Error) => {
        console.error("sqlsync: error subscribing", err);
        setState({ state: "error", error: err });
      });

    onCleanup(() => {
      unsubPromise
        .then((unsub) => unsub())
        .catch((err) => {
          console.error("sqlsync: error unsubscribing", err);
        });
    });
  });

  return state;
}

export const useConnectionStatus = (): Accessor<ConnectionStatus> => {
  const sqlsync = useSQLSync();
  const [status, setStatus] = createSignal<ConnectionStatus>(sqlsync().connectionStatus);
  createEffect(() => {
    const cleanup = sqlsync().addConnectionStatusListener(setStatus);
    onCleanup(cleanup);
  });
  return status;
};

```

### Core Architecture Module: `lib/sqlsync-worker/rollup.config.mjs`
```
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const output = (entry) => ({
  input: entry,
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [commonjs(), typescript(), nodeResolve()],
});

export default [output("src/index.ts"), output("src/worker.ts")];

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/api.rs`
```
// this is needed due to an issue with Tsify emitting non-snake_case names without the correct annotations
#![allow(non_snake_case)]

use std::{collections::HashMap, fmt::Debug};

use anyhow::anyhow;
use futures::{
    channel::mpsc::{self, UnboundedSender},
    SinkExt,
};
use serde::{Deserialize, Serialize};
use sqlsync::JournalId;
use tsify::{declare, Tsify};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    doc_task::DocTask,
    net::ConnectionStatus,
    reactive::QueryKey,
    sql::SqlValue,
    utils::{fetch_reducer, WasmError, WasmResult},
};

#[wasm_bindgen(typescript_custom_section)]
const TYPESCRIPT_INTERFACE: &'static str = r#"
import { JournalId } from "../../src/journal-id.ts";
import { PortRouter, PortId } from "../../src/port.ts";

export type HandlerId = number;
export type PageIdx = number;
export type QueryKey = string;

interface WorkerApi {
    handle(msg: HostToWorkerMsg): Promise<void>;
}
"#;

pub type PortId = u32;
pub type HandlerId = u32;

#[declare]
type DocId = JournalId;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "SendError", extends = js_sys::Error)]
    pub type PortSendErr;

    #[wasm_bindgen(method, js_name = "missingPorts")]
    pub fn missing_ports(this: &PortSendErr) -> Vec<PortId>;

    #[wasm_bindgen(typescript_type = "PortRouter")]
    #[derive(Debug, Clone)]
    pub type PortRouter;

    #[wasm_bindgen(method, js_name = "sendOne", catch)]
    pub fn send_one(
        this: &PortRouter,
        port: PortId,
        msg: WorkerToHostMsg,
    ) -> Result<(), PortSendErr>;

    #[wasm_bindgen(method, js_name = "sendMany", catch)]
    pub fn send_many(
        this: &PortRouter,
        port: Vec<PortId>,
        msg: WorkerToHostMsg,
    ) -> Result<(), PortSendErr>;

    #[wasm_bindgen(method, js_name = "sendAll")]
    pub fn send_all(this: &PortRouter, msg: WorkerToHostMsg);
}

#[derive(Debug, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
#[tsify(from_wasm_abi)]
pub struct HostToWorkerMsg {
    pub port_id: PortId,
    pub handler_id: HandlerId,
    pub doc_id: DocId,
    pub req: DocRequest,
}

impl HostToWorkerMsg {
    pub fn reply(&self, reply: DocReply) -> WorkerToHostMsg {
        WorkerToHostMsg::Reply { handler_id: self.handler_id, reply }
    }

    pub fn reply_err<E: Debug>(&self, err: E) -> WorkerToHostMsg {
        WorkerToHostMsg::Reply {
            handler_id: self.handler_id,
            reply: DocReply::Err { err: format!("{:?}", err) },
        }
    }
}

#[derive(Debug, Deserialize, Tsify)]
#[serde(tag = "tag", rename_all_fields = "camelCase")]
#[tsify(from_wasm_abi)]
pub enum DocRequest {
    Open {
        reducer_url: String,
    },
    Query {
        sql: String,
        params: Vec<SqlValue>,
    },
    QuerySubscribe {
        key: QueryKey,
        sql: String,
        params: Vec<SqlValue>,
    },
    QueryUnsubscribe {
        key: QueryKey,
    },
    Mutate {
        #[serde(with = "serde_bytes")]
        #[tsify(type = "Uint8Array")]
        mutation: Vec<u8>,
    },
    RefreshConnectionStatus,
    SetConnectionEnabled {
        enabled: bool,
    },
}

#[derive(Debug, Serialize, Tsify)]
#[serde(tag = "tag", rename_all_fields = "camelCase")]
#[tsify(into_wasm_abi)]
pub enum WorkerToHostMsg {
    Reply {
        handler_id: HandlerId,
        reply: DocReply,
    },
    Event {
        doc_id: DocId,
        evt: DocEvent,
    },
}

#[derive(Debug, Serialize, Tsify)]
#[serde(tag = "tag", rename_all_fields = "camelCase")]
#[tsify(into_wasm_abi)]
pub enum DocReply {
    Ack,
    RecordSet {
        columns: Vec<String>,
        rows: Vec<Vec<SqlValue>>,
    },
    Err {
        err: String,
    },
}

#[derive(Debug, Serialize, Tsify, Clone)]
#[serde(tag = "tag", rename_all_fields = "camelCase")]
#[tsify(into_wasm_abi)]
pub enum DocEvent {
    ConnectionStatus {
        status: ConnectionStatus,
    },
    SubscriptionChanged {
        key: QueryKey,
        columns: Vec<String>,
        rows: Vec<Vec<SqlValue>>,
    },
    SubscriptionErr {
        key: QueryKey,
        err: String,
    },
}

#[wasm_bindgen]
pub struct WorkerApi {
    coordinator_url: Option<String>,
    ports: PortRouter,
    inboxes: HashMap<DocId, UnboundedSender<HostToWorkerMsg>>,
}

#[wasm_bindgen]
impl WorkerApi {
    #[wasm_bindgen(constructor)]
    pub fn new(ports: PortRouter, coordinator_url: Option<String>) -> WorkerApi {
        WorkerApi {
            coordinator_url,
            ports,
            inboxes: HashMap::new(),
        }
    }

    #[wasm_bindgen(skip_typescript)]
    pub async fn handle(&mut self, msg: JsValue) -> WasmResult<()> {
        let mut msg: HostToWorkerMsg = serde_wasm_bindgen::from_value(msg)?;
        log::info!("handle: {:?}", msg);

        match &msg.req {
            DocRequest::Open { reducer_url } => {
                if let Some(inbox) = self.inboxes.get_mut(&msg.doc_id) {
                    // doc is already open
                    // request a connection status update from the doc
                    msg.req = DocRequest::RefreshConnectionStatus;
                    inbox.send(msg).await?;
                } else {
                    // open the doc
                    self.spawn_doc_task(msg.doc_id, reducer_url).await?;
                    let _ = self.ports.send_one(msg.port_id, msg.reply(DocReply::Ack));
                }
            }

            _ => match self.inboxes.get_mut(&msg.doc_id) {
                Some(inbox) => inbox.send(msg).await?,
                None => {
                    let _ = self.ports.send_one(
                        msg.port_id,
                        msg.reply_err(WasmError(anyhow!("no document with id {}", msg.doc_id))),
                    );
                }
            },
        }

        Ok(())
    }

    async fn spawn_doc_task(
        &mut self,
        doc_id: JournalId,
        reducer_url: &str,
    ) -> Result<(), WasmError> {
        let (reducer, digest) = fetch_reducer(reducer_url).await?;

        let doc_url = self.coordinator_url.as_ref().map(|url| {
            format!(
                "{}/doc/{}?reducer={}",
                url,
                doc_id.to_base58(),
                bs58::encode(&digest).into_string()
            )
        });

        let (tx, rx) = mpsc::unbounded();

        let task = DocTask::new(doc_id, doc_url, reducer, rx, self.ports.clone())?;

        wasm_bindgen_futures::spawn_local(task.into_task());

        self.inboxes.insert(doc_id, tx);

        Ok(())
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/doc_task.rs`
```
use anyhow::anyhow;
use futures::{channel::mpsc, select, FutureExt, StreamExt};
use rand::thread_rng;
use sqlsync::{
    local::LocalDocument, sqlite::params_from_iter, JournalId, MemoryJournal, WasmReducer,
};

use crate::{
    api::{DocEvent, DocReply, DocRequest, HostToWorkerMsg, PortRouter, WorkerToHostMsg},
    net::{ConnectionTask, CoordinatorClient},
    reactive::ReactiveQueries,
    signal::{SignalEmitter, SignalRouter},
    sql::SqlValue,
    utils::{WasmError, WasmResult},
};

#[derive(Clone, Copy, Hash, PartialEq, Eq)]
enum Signal {
    StorageChanged,
    TimelineChanged,
    CanRebase,
    HasDirtyQueries,
    ConnectionStateChanged,
}

pub struct DocTask {
    doc: LocalDocument<MemoryJournal, SignalEmitter<Signal>>,
    inbox: mpsc::UnboundedReceiver<HostToWorkerMsg>,
    signals: SignalRouter<Signal>,
    ports: PortRouter,
    queries: ReactiveQueries<SignalEmitter<Signal>>,
    coordinator_client: CoordinatorClient<SignalEmitter<Signal>>,
}

impl DocTask {
    pub fn new(
        doc_id: JournalId,
        doc_url: Option<String>,
        reducer: WasmReducer,
        inbox: mpsc::UnboundedReceiver<HostToWorkerMsg>,
        ports: PortRouter,
    ) -> WasmResult<Self> {
        // TODO: use persisted timeline id when we start persisting the journal to OPFS
        let timeline_id = JournalId::new128(&mut thread_rng());

        let signals = SignalRouter::new();

        let storage = MemoryJournal::open(doc_id)?;
        let timeline = MemoryJournal::open(timeline_id)?;
        let doc = LocalDocument::open(
            storage,
            timeline,
            reducer,
            signals.emitter(Signal::StorageChanged),
            signals.emitter(Signal::TimelineChanged),
            signals.emitter(Signal::CanRebase),
        )?;

        let queries = ReactiveQueries::new(signals.emitter(Signal::HasDirtyQueries));
        let coordinator_client =
            CoordinatorClient::new(doc_url, signals.emitter(Signal::ConnectionStateChanged));

        Ok(Self {
            doc,
            inbox,
            signals,
            ports,
            queries,
            coordinator_client,
        })
    }

    pub async fn into_task(mut self) {
        // NOTE TO CODE REVIEWERS:
        // `select!` is full of foot guns (see: [1] and [2])
        // It's only safe if each branch follows these rules:
        //  - if ready, return value without awaiting
        //  - if not ready, await precisely once and then return value
        //
        // Critically: if it's possible to await twice during the execution of a
        // single future handled by select! - then it's possible for the future
        // to be dropped in an intermediate state.
        //
        // [1]: https://tomaka.medium.com/a-look-back-at-asynchronous-rust-d54d63934a1c
        // [2]: https://blog.yoshuawuyts.com/futures-concurrency-3/

        loop {
            select! {
                signals = self.signals.listen().fuse() => {
                    self.handle_signals(signals).await;
                },
                task = self.coordinator_client.poll().fuse() => {
                    self.coordinator_client.handle(&mut self.doc, task).await;
                },
                msg = self.inbox.select_next_some() => {
                    self.handle_message(msg).await;
                },
            }
        }
    }

    async fn handle_signals(&mut self, signals: Vec<Signal>) {
        for signal in signals {
            match signal {
                Signal::ConnectionStateChanged => self.handle_connection_state_changed(),
                Signal::TimelineChanged => self.handle_timeline_changed().await,
                Signal::HasDirtyQueries => self.handle_dirty_queries(),

                Signal::StorageChanged => {
                    if let Err(e) = self.handle_storage_changed() {
                        panic!("failed to handle storage changes, the database is probably corrupted: {:?}", e);
                    }
                }

                Signal::CanRebase => {
                    if let Err(e) = self.doc.rebase() {
                        panic!("failed to rebase the document; this may mean that a mutation is failing to apply: {:?}", e);
                    }
                }
            }
        }
    }

    fn handle_connection_state_changed(&mut self) {
        self.ports.send_all(WorkerToHostMsg::Event {
            doc_id: self.doc.doc_id(),
            evt: DocEvent::ConnectionStatus { status: self.coordinator_client.status() },
        });
    }

    fn handle_storage_changed(&mut self) -> anyhow::Result<()> {
        let changes = self.doc.storage_changes()?;
        log::debug!("storage changed: {:?}", changes);
        self.queries.handle_storage_change(&changes);
        Ok(())
    }

    async fn handle_timeline_changed(&mut self) {
        self.coordinator_client
            .handle(&mut self.doc, ConnectionTask::Sync)
            .await;
    }

    fn handle_dirty_queries(&mut self) {
        if let Some(query) = self.queries.next_dirty_query() {
            let result = query.refresh(self.doc.sqlite_readonly(), |columns, row| {
                let mut out = Vec::with_capacity(columns.len());
                for i in 0..columns.len() {
                    let val: SqlValue = row.get_ref(i)?.into();
                    out.push(val);
                }
                Ok::<_, WasmError>(out)
            });

            let msg = match result {
                Ok((columns, rows)) => WorkerToHostMsg::Event {
                    doc_id: self.doc.doc_id(),
                    evt: DocEvent::SubscriptionChanged {
                        key: query.query_key().clone(),
                        columns,
                        rows,
                    },
                },
                Err(err) => {
                    query.mark_error();
                    WorkerToHostMsg::Event {
                        doc_id: self.doc.doc_id(),
                        evt: DocEvent::SubscriptionErr {
                            key: query.query_key().clone(),
                            err: err.to_string(),
                        },
                    }
                }
            };

            if let Err(err) = self.ports.send_many(query.ports().clone(), msg) {
                self.queries.unsubscribe_all(&err.missing_ports());
            }
        }
    }

    async fn handle_message(&mut self, msg: HostToWorkerMsg) {
        match self.process_request(&msg).await {
            Ok(reply) => {
                log::info!("doc task reply: {:?}", reply);
                let _ = self.ports.send_one(msg.port_id, msg.reply(reply));
            }
            Err(err) => {
                log::info!("doc task error: {:?}", err);
                let _ = self.ports.send_one(msg.port_id, msg.reply_err(err));
            }
        }
    }

    async fn process_request(&mut self, msg: &HostToWorkerMsg) -> WasmResult<DocReply> {
        log::info!("DocTask::process_request: {:?}", msg.req);
        match &msg.req {
            DocRequest::Open { .. } => Err(WasmError(anyhow!("doc is already open"))),

            DocRequest::Query { sql, params } => self.doc.query(|conn| {
                let params = params_from_iter(params.iter());
                let mut stmt = conn.prepare(sql)?;

                let columns: Vec<_> = stmt.column_names().iter().map(|&s| s.to_owned()).collect();

                let rows = stmt
                    .query_and_then(params, |row| {
                        let mut out = Vec::with_capacity(columns.len());
                        for i in 0..columns.len() {
                            let val: SqlValue = row.get_ref(i)?.into();
                            out.push(val);
                        }
                        Ok::<_, WasmError>(out)
                    })?
                    .collect::<Result<Vec<_>, _>>()?;

                Ok::<_, WasmError>(DocReply::RecordSet { columns, rows })
            }),

            DocRequest::QuerySubscribe { key, sql, params } => {
                self.queries
                    .subscribe(msg.port_id, key, sql, params.to_vec());
                Ok(DocReply::Ack)
            }

            DocRequest::QueryUnsubscribe { key } => {
                self.queries.unsubscribe(msg.port_id, key);
                Ok(DocReply::Ack)
            }

            DocRequest::Mutate { mutation } => {
                self.doc.mutate(&mutation.to_vec())?;
                Ok(DocReply::Ack)
            }

            DocRequest::RefreshConnectionStatus => {
                let _ = self.ports.send_one(
                    msg.port_id,
                    WorkerToHostMsg::Event {
                        doc_id: self.doc.doc_id(),
                        evt: DocEvent::ConnectionStatus {
                            status: self.coordinator_client.status(),
                        },
                    },
                );

                Ok(DocReply::Ack)
            }

            DocRequest::SetConnectionEnabled { enabled } => {
                let task = match enabled {
                    false => ConnectionTask::Disable,
                    true => {
                        if self.coordinator_client.can_enable() {
                            ConnectionTask::Connect
                        } else {
                            return Err(WasmError(anyhow!(
                                "cannot enable connection without coordinator url"
                            )));
                        }
                    }
                };
                self.coordinator_client.handle(&mut self.doc, task).await;

                Ok(DocReply::Ack)
            }
        }
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/lib.rs`
```
mod api;
mod doc_task;
mod net;
mod reactive;
mod signal;
mod sql;
mod utils;

use utils::ConsoleLogger;
use wasm_bindgen::prelude::wasm_bindgen;

static LOGGER: ConsoleLogger = ConsoleLogger;

#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
    log::set_logger(&LOGGER).unwrap();
    log::set_max_level(log::LevelFilter::Info);
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/net.rs`
```
// this is needed due to an issue with Tsify emitting non-snake_case names without the correct annotations
#![allow(non_snake_case)]

use std::{
    fmt::Debug,
    io::{self, Cursor},
};

use anyhow::bail;
use futures::{
    stream::{Fuse, SplitSink, SplitStream},
    SinkExt, StreamExt,
};
use gloo::net::websocket::{futures::WebSocket, Message};
use serde::Serialize;
use sqlsync::{
    local::Signal,
    replication::{ReplicationDestination, ReplicationMsg, ReplicationProtocol, ReplicationSource},
};
use tsify::Tsify;

use crate::utils::Backoff;

// reconnect backoff starts at 10ms and doubles each time, up to 5s
const MIN_BACKOFF_MS: u32 = 10;
const MAX_BACKOFF_MS: u32 = 5000;

pub struct CoordinatorClient<S: Signal> {
    // while url is none, the state will always be disabled
    url: Option<String>,

    // we use an option here to work around rust ownership rules when we are
    // transitioning the state
    state: Option<ConnectionState>,

    state_changed: S,
}

impl<S: Signal> CoordinatorClient<S> {
    pub fn new(doc_url: Option<String>, state_changed: S) -> Self {
        let state = Some(doc_url.as_ref().map_or_else(
            || ConnectionState::Disabled,
            |_| ConnectionState::Disconnected {
                backoff: Backoff::new(MIN_BACKOFF_MS, MAX_BACKOFF_MS),
            },
        ));

        Self { url: doc_url, state, state_changed }
    }

    pub fn can_enable(&self) -> bool {
        self.url.is_some()
    }

    // SAFETY: poll, status, and handle can not be called concurrently on the same CoordinatorClient
    pub async fn poll(&mut self) -> ConnectionTask {
        match self.state {
            Some(ref mut state) => state.poll().await,
            None => unreachable!("CoordinatorClient: invalid concurrent call to poll"),
        }
    }

    // SAFETY: poll, status, and handle can not be called concurrently on the same CoordinatorClient
    pub fn status(&self) -> ConnectionStatus {
        match self.state {
            Some(ref state) => state.status(),
            None => unreachable!("CoordinatorClient: invalid concurrent call to status"),
        }
    }

    // SAFETY: poll, status, and handle can not be called concurrently on the same CoordinatorClient
    pub async fn handle<'a, R, D>(&mut self, doc: &'a mut D, task: ConnectionTask)
    where
        R: io::Read,
        D: ReplicationDestination + ReplicationSource<Reader<'a> = R>,
    {
        // load the current state and status
        let state = self
            .state
            .take()
            .expect("CoordinatorClient: invalid concurrent call to handle");
        let status = state.status();

        log::info!(
            "coordinator client: state {:?} is handling task {:?}",
            status,
            task,
        );

        // handle the task
        let state = state.handle(&self.url, doc, task).await;

        // get the new status and save the new state
        let new_status = state.status();
        self.state.replace(state);

        // if status changed, emit a signal
        if status != new_status {
            self.state_changed.emit();
        }
    }
}

pub enum ConnectionTask {
    Disable,
    Connect,
    Recv(ReplicationMsg, Cursor<Vec<u8>>),
    Sync,
    Error(anyhow::Error),
}

impl Debug for ConnectionTask {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConnectionTask::Disable => write!(f, "Disable"),
            ConnectionTask::Connect => write!(f, "Connect"),
            ConnectionTask::Recv(_, _) => write!(f, "Recv"),
            ConnectionTask::Sync => write!(f, "Sync"),
            ConnectionTask::Error(e) => write!(f, "Error({:?})", e),
        }
    }
}

enum ConnectionState {
    Disabled,
    Disconnected {
        backoff: Backoff,
    },
    Connecting {
        conn: CoordinatorConnection,
        backoff: Backoff,
    },
    Connected {
        conn: CoordinatorConnection,
    },
}

#[derive(Debug, Serialize, Tsify, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[tsify(into_wasm_abi)]
pub enum ConnectionStatus {
    Disabled,
    Disconnected,
    Connecting,
    Connected,
}

impl ConnectionState {
    fn status(&self) -> ConnectionStatus {
        match self {
            Self::Disabled => ConnectionStatus::Disabled,
            Self::Disconnected { .. } => ConnectionStatus::Disconnected,
            Self::Connecting { .. } => ConnectionStatus::Connecting,
            Self::Connected { .. } => ConnectionStatus::Connected,
        }
    }
}

impl ConnectionState {
    async fn poll(&mut self) -> ConnectionTask {
        match self {
            ConnectionState::Disabled => {
                // block forever, someone else will need to transition us to a different state
                futures::future::pending::<()>().await;
                unreachable!("ConnectionState should never be disabled")
            }
            ConnectionState::Disconnected { backoff } => {
                backoff.wait().await;
                ConnectionTask::Connect
            }
            ConnectionState::Connecting { conn, .. } => conn
                .recv()
                .await
                .map_or_else(ConnectionTask::Error, |(msg, buf)| {
                    ConnectionTask::Recv(msg, buf)
                }),
            ConnectionState::Connected { conn } => conn
                .recv()
                .await
                .map_or_else(ConnectionTask::Error, |(msg, buf)| {
                    ConnectionTask::Recv(msg, buf)
                }),
        }
    }

    async fn handle<'a, R, D>(
        self,
        url: &Option<String>,
        doc: &'a mut D,
        task: ConnectionTask,
    ) -> ConnectionState
    where
        R: io::Read,
        D: ReplicationDestination + ReplicationSource<Reader<'a> = R>,
    {
        use ConnectionState::*;
        use ConnectionTask::*;

        let url = if url.is_some() {
            url.as_ref().unwrap()
        } else {
            return Disabled;
        };

        macro_rules! handle_err {
            ($backoff:ident, $err:ident) => {{
                log::error!("connection error: {:?}", $err);
                $backoff.step();
                ConnectionState::Disconnected { $backoff }
            }};
            ($err:ident) => {{
                log::error!("connection error: {:?}", $err);
                ConnectionState::Disconnected {
                    backoff: Backoff::new(MIN_BACKOFF_MS, MAX_BACKOFF_MS),
                }
            }};
        }

        match (self, task) {
            // disabled ignores all tasks except for Connect
            (Disabled, Connect) => match CoordinatorConnection::open(url, doc).await {
                Ok(conn) => ConnectionState::Connecting {
                    conn,
                    backoff: Backoff::new(MIN_BACKOFF_MS, MAX_BACKOFF_MS),
                },
                Err(e) => handle_err!(e),
            },
            (s @ Disabled, _) => s,

            // the disable task universally disables
            (_, Disable) => Disabled,

            (Disconnected { mut backoff }, Connect) => {
                match CoordinatorConnection::open(url, doc).await {
                    Ok(conn) => ConnectionState::Connecting { conn, backoff },
                    Err(e) => handle_err!(backoff, e),
                }
            }

            (Disconnected { mut backoff }, Error(e)) => handle_err!(backoff, e),

            // ignore sync/recv
            (s @ Disconnected { .. }, Sync) => s,
            (s @ Disconnected { .. }, Recv(_, _)) => s,

            (s @ Connecting { .. }, Connect) => s,

            (Connecting { mut conn, mut backoff }, Recv(msg, buf)) => {
                if let Err(e) = conn.handle(doc, msg, buf).await {
                    return handle_err!(backoff, e);
                }

                if conn.initialized() {
                    // we have connected! need to perform an initial sync
                    match conn.sync(doc).await {
                        Ok(()) => Connected { conn },
                        Err(e) => handle_err!(backoff, e),
                    }
                } else {
                    Connecting { conn, backoff }
                }
            }

            // can't sync until we have completed the connection
            (s @ Connecting { .. }, Sync) => s,

            (Connecting { mut backoff, .. }, Error(e)) => {
                handle_err!(backoff, e)
            }

            (s @ Connected { .. }, Connect) => s,

            (Connected { mut conn }, Recv(msg, buf)) => match conn.handle(doc, msg, buf).await {
                Ok(()) => Connected { conn },
                Err(e) => handle_err!(e),
            },

            (Connected { mut conn }, Sync) => match conn.sync(doc).await {
                Ok(()) => Connected { conn },
                Err(e) => handle_err!(e),
            },

            (Connected { .. }, Error(e)) => handle_err!(e),
        }
    }
}

struct CoordinatorConnection {
    reader: Fuse<SplitStream<WebSocket>>,
    writer: SplitSink<WebSocket, Message>,
    protocol: ReplicationProtocol,
}

impl CoordinatorConnection {
    async fn open<D>(url: &str, doc: &D) -> anyhow::Result<CoordinatorConnection>
    where
        D: ReplicationSource,
    {
        log::info!("connecting to {}", url);
        let (mut writer, reader) = WebSocket::open(url)?.split();
        let reader = reader.fuse();
        let protocol = ReplicationProtocol::new();

        let start_msg = protocol.start(doc);
        log::info!("sending start message: {:?}", start_msg);
        let start_msg = bincode::serialize(&start_msg)?;
        writer.send(Message::Bytes(start_msg)).await?;

        Ok(CoordinatorConnection { reader, writer, protocol })
    }

    fn initialized(&self) -> bool {
        self.protocol.initialized()
    }

    async fn send(&mut self, msg: ReplicationMsg) -> anyhow::Result<()> {
        let msg = bincode::seriali
```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/reactive.rs`
```
use std::{
    collections::BTreeMap,
    ops::{Deref, DerefMut},
};

use sqlsync::{local::Signal, ReactiveQuery, StorageChange};

use crate::{api::PortId, sql::SqlValue};

pub type QueryKey = String;

#[derive(Debug)]
pub struct QueryTracker {
    query_key: QueryKey,
    query: ReactiveQuery<SqlValue>,
    ports: Vec<PortId>,
}

impl QueryTracker {
    pub fn query_key(&self) -> &QueryKey {
        &self.query_key
    }

    pub fn ports(&self) -> &Vec<PortId> {
        &self.ports
    }
}

impl Deref for QueryTracker {
    type Target = ReactiveQuery<SqlValue>;

    fn deref(&self) -> &Self::Target {
        &self.query
    }
}

impl DerefMut for QueryTracker {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.query
    }
}

pub struct ReactiveQueries<S: Signal> {
    queries: BTreeMap<QueryKey, QueryTracker>,
    has_dirty_queries: S,
}

impl<S: Signal> ReactiveQueries<S> {
    pub fn new(has_dirty_queries: S) -> Self {
        Self {
            queries: BTreeMap::new(),
            has_dirty_queries,
        }
    }

    pub fn handle_storage_change(&mut self, change: &StorageChange) {
        let mut dirty = false;
        for tracker in self.queries.values_mut() {
            let d = tracker.query.handle_storage_change(change);
            dirty = dirty || d;
        }
        if dirty {
            self.has_dirty_queries.emit();
        }
    }

    pub fn subscribe(&mut self, port: PortId, key: &QueryKey, sql: &str, params: Vec<SqlValue>) {
        let tracker = self
            .queries
            .entry(key.clone())
            .or_insert_with(|| QueryTracker {
                query_key: key.clone(),
                query: ReactiveQuery::new(sql.to_owned(), params),
                ports: Vec::new(),
            });

        // store the port, if it's not already subscribed
        if !tracker.ports.contains(&port) {
            tracker.ports.push(port);
        }

        // for now, we always mark the query as dirty when we subscribe
        // TODO: only refresh the query for the new subscriber
        tracker.query.mark_dirty();
        self.has_dirty_queries.emit();
    }

    pub fn unsubscribe(&mut self, port: PortId, query_key: &QueryKey) {
        if let Some(tracker) = self.queries.get_mut(query_key) {
            tracker.ports.retain(|p| p != &port);
            if tracker.ports.is_empty() {
                self.queries.remove(query_key);
            }
        }
    }

    pub fn unsubscribe_all(&mut self, ports: &[PortId]) {
        for tracker in self.queries.values_mut() {
            tracker.ports.retain(|p| !ports.contains(p));
        }
        self.queries.retain(|_, tracker| !tracker.ports.is_empty());
    }

    /// next_dirty_query returns the first dirty query, and sets
    /// self.has_dirty_queries if there are more
    pub fn next_dirty_query(&mut self) -> Option<&mut QueryTracker> {
        let mut iter = self
            .queries
            .values_mut()
            .filter(|tracker| tracker.query.is_dirty());
        let first = iter.next();
        let has_more = iter.next().is_some();
        if has_more {
            self.has_dirty_queries.emit();
        }
        first
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/signal.rs`
```
use std::hash::Hash;
use std::{cell::RefCell, collections::HashSet, rc::Rc};

use event_listener::Event;
use sqlsync::local::Signal;

pub struct SignalRouter<S: Copy + Hash + Eq> {
    shared: Rc<RefCell<Shared<S>>>,
}

impl<S: Copy + Hash + Eq> SignalRouter<S> {
    pub fn new() -> Self {
        Self {
            shared: Rc::new(RefCell::new(Shared::new())),
        }
    }

    pub fn emitter(&self, signal: S) -> SignalEmitter<S> {
        SignalEmitter { signal, shared: self.shared.clone() }
    }

    pub async fn listen(&self) -> Vec<S> {
        let listener = {
            let mut shared = self.shared.borrow_mut();

            // grab a listener before checking signals
            // this ensures that we don't miss a signal
            let listener = shared.event.listen();

            let signals = shared.pop_all();
            if !signals.is_empty() {
                // we already have signals to return
                return signals;
            }
            listener
        };

        // wait for a signal emitter to emit
        listener.await;

        // after the listener fires, we should have signals to return
        self.shared.borrow_mut().pop_all()
    }
}

struct Shared<S: Copy + Hash + Eq> {
    signals: HashSet<S>,
    event: Event,
}

impl<S: Copy + Hash + Eq> Shared<S> {
    fn new() -> Self {
        Self {
            signals: HashSet::new(),
            event: Event::new(),
        }
    }

    fn emit(&mut self, signal: S) {
        if self.signals.insert(signal) {
            // only wake up a listener if we added a new signal
            self.event.notify(usize::MAX);
        }
    }

    fn pop_all(&mut self) -> Vec<S> {
        self.signals.drain().collect()
    }
}

pub struct SignalEmitter<S: Copy + Hash + Eq> {
    signal: S,
    shared: Rc<RefCell<Shared<S>>>,
}

impl<S: Copy + Hash + Eq> Signal for SignalEmitter<S> {
    fn emit(&mut self) {
        self.shared.borrow_mut().emit(self.signal)
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/sql.rs`
```
use serde::{de::Visitor, Deserialize, Serialize};
use sqlsync::sqlite::{
    self,
    types::{ToSqlOutput, ValueRef},
    ToSql,
};
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Debug, Clone)]
pub enum SqlValue {
    /// The value is a `NULL` value.
    Null,
    /// The value is a signed integer.
    Integer(i64),
    /// The value is a floating point number.
    Real(f64),
    /// The value is a text string.
    Text(String),
    /// The value is a blob of data
    Blob(Vec<u8>),
}

#[wasm_bindgen(typescript_custom_section)]
const JS_SQL_VALUE_TYPESCRIPT: &'static str = r#"
export type SqlValue =
    | undefined
    | null
    | boolean
    | number
    | string
    | bigint
    | Uint8Array;
"#;

impl ToSql for SqlValue {
    fn to_sql(&self) -> sqlite::Result<ToSqlOutput<'_>> {
        match self {
            SqlValue::Null => Ok(ToSqlOutput::Borrowed(ValueRef::Null)),
            SqlValue::Integer(v) => Ok(ToSqlOutput::Borrowed(ValueRef::Integer(*v))),
            SqlValue::Real(v) => Ok(ToSqlOutput::Borrowed(ValueRef::Real(*v))),
            SqlValue::Text(v) => Ok(ToSqlOutput::Borrowed(ValueRef::Text(v.as_bytes()))),
            SqlValue::Blob(v) => Ok(ToSqlOutput::Borrowed(ValueRef::Blob(v.as_slice()))),
        }
    }
}

impl From<ValueRef<'_>> for SqlValue {
    fn from(value: ValueRef<'_>) -> Self {
        match value {
            ValueRef::Null => SqlValue::Null,
            ValueRef::Integer(v) => SqlValue::Integer(v),
            ValueRef::Real(v) => SqlValue::Real(v),
            r @ ValueRef::Text(_) => SqlValue::Text(r.as_str().unwrap().into()),
            ValueRef::Blob(v) => SqlValue::Blob(v.to_vec()),
        }
    }
}

impl Serialize for SqlValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match *self {
            SqlValue::Null => serializer.serialize_none(),
            SqlValue::Integer(i) => serializer.serialize_i64(i),
            SqlValue::Real(f) => serializer.serialize_f64(f),
            SqlValue::Text(ref s) => serializer.serialize_str(s),
            SqlValue::Blob(ref b) => serializer.serialize_bytes(b),
        }
    }
}

impl<'de> Deserialize<'de> for SqlValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct SqlValueVisitor;

        impl<'de> Visitor<'de> for SqlValueVisitor {
            type Value = SqlValue;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("SqlValue")
            }

            fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Integer(if v { 1 } else { 0 }))
            }

            fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Integer(v))
            }

            fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Real(v))
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Text(v.to_string()))
            }

            fn visit_bytes<E>(self, v: &[u8]) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Blob(v.to_vec()))
            }

            fn visit_byte_buf<E>(self, v: Vec<u8>) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Blob(v))
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Null)
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SqlValue::Null)
            }
        }

        deserializer.deserialize_any(SqlValueVisitor)
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/sqlsync-wasm/src/utils.rs`
```
use std::{convert::TryFrom, fmt::Display, io};

use anyhow::anyhow;
use gloo::{net::http::Request, timers::future::TimeoutFuture, utils::errors::JsError};
use js_sys::{Reflect, Uint8Array};
use log::Level;
use sha2::{Digest, Sha256};
use sqlsync::WasmReducer;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::console;

pub fn set_panic_hook() {
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    console_error_panic_hook::set_once();
}

pub struct ConsoleLogger;

impl log::Log for ConsoleLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record) {
        let console_log = match record.level() {
            Level::Error => console::error_1,
            Level::Warn => console::warn_1,
            Level::Info => console::info_1,
            Level::Debug => console::log_1,
            Level::Trace => console::debug_1,
        };

        console_log(&format!("sqlsync: {}", record.args()).into());
    }

    fn flush(&self) {}
}

pub type WasmResult<T> = Result<T, WasmError>;

#[derive(Debug)]
pub struct WasmError(pub anyhow::Error);

impl Display for WasmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        Display::fmt(&self.0, f)
    }
}

impl From<JsValue> for WasmError {
    fn from(value: JsValue) -> Self {
        match JsError::try_from(value) {
            Ok(js_error) => WasmError(js_error.into()),
            Err(not_js_error) => WasmError(anyhow!(not_js_error.to_string())),
        }
    }
}

impl From<WasmError> for JsValue {
    fn from(value: WasmError) -> Self {
        JsValue::from_str(&format!("{}", value))
    }
}

impl From<anyhow::Error> for WasmError {
    fn from(value: anyhow::Error) -> Self {
        WasmError(value)
    }
}

impl From<serde_wasm_bindgen::Error> for WasmError {
    fn from(value: serde_wasm_bindgen::Error) -> Self {
        WasmError(anyhow!(value.to_string()))
    }
}

macro_rules! impl_from_error {
    ($($error:ty, )+) => {
        $(
            impl From<$error> for WasmError {
                fn from(value: $error) -> Self {
                    WasmError(anyhow::anyhow!(value))
                }
            }
        )+
    };
}

impl_from_error!(
    bincode::Error,
    io::Error,
    sqlsync::error::Error,
    sqlsync::sqlite::Error,
    sqlsync::replication::ReplicationError,
    sqlsync::JournalIdParseError,
    sqlsync::ReducerError,
    gloo::utils::errors::JsError,
    gloo::net::Error,
    gloo::net::websocket::WebSocketError,
    futures::channel::mpsc::SendError,
);

pub async fn fetch_reducer(reducer_url: &str) -> Result<(WasmReducer, Vec<u8>), WasmError> {
    let resp = Request::get(reducer_url).send().await?;
    if !resp.ok() {
        return Err(WasmError(anyhow!(
            "failed to load reducer; response has status: {} {}",
            resp.status(),
            resp.status_text()
        )));
    }

    let reducer_wasm_bytes = resp.binary().await?;

    let global = js_sys::global()
        .dyn_into::<js_sys::Object>()
        .expect("global not found");
    let subtle = Reflect::get(&global, &"crypto".into())?
        .dyn_into::<web_sys::Crypto>()
        .expect("crypto not found")
        .subtle();

    let digest: Vec<u8> = if subtle.is_undefined() {
        let mut hasher = Sha256::new();
        hasher.update(&reducer_wasm_bytes);
        hasher.finalize().to_vec()
    } else {
        // sha256 sum the data
        // TODO: it would be much better to stream the data through the hash function
        // but afaik that's not doable with the crypto.subtle api
        let digest =
            JsFuture::from(subtle.digest_with_str_and_u8_array("SHA-256", &reducer_wasm_bytes)?)
                .await?;
        Uint8Array::new(&digest).to_vec()
    };

    let reducer = WasmReducer::new(reducer_wasm_bytes.as_slice())
        .map_err(|err| anyhow!("failed to instantiate reducer from wasm: {}", err))?;

    Ok((reducer, digest))
}

pub struct Backoff {
    current_ms: u32,
    max_ms: u32,
    future: Option<TimeoutFuture>,
}

impl Backoff {
    pub fn new(start_ms: u32, max_ms: u32) -> Self {
        Self {
            current_ms: start_ms,
            max_ms,
            future: None,
        }
    }

    /// increase the backoff time if needed
    pub fn step(&mut self) {
        self.current_ms *= 2;
        self.current_ms = self.current_ms.min(self.max_ms);
        self.future = None;
    }

    /// block until the current backoff time has elapsed
    pub async fn wait(&mut self) {
        let current_ms = self.current_ms;
        self.future
            .get_or_insert_with(|| TimeoutFuture::new(current_ms))
            .await;
    }
}

```

### Core Architecture Module: `lib/sqlsync-worker/src/index.ts`
```
export {
  journalIdFromString,
  journalIdToString,
  randomJournalId,
  randomJournalId256,
} from "./journal-id";
export { normalizeQuery, sql } from "./sql";
export { SQLSync } from "./sqlsync";
export { pendingPromise, serializeMutationAsJSON } from "./util";

import type {
  ConnectionStatus,
  DocId,
  DocRequest,
  HandlerId,
  SqlValue,
} from "../sqlsync-wasm/pkg/sqlsync_wasm";
import type { JournalId } from "./journal-id";
import type { ParameterizedQuery } from "./sql";
import type { DocType, QuerySubscription } from "./sqlsync";
import type { Row } from "./types";

export type {
  ConnectionStatus,
  DocId,
  DocRequest,
  DocType,
  HandlerId,
  JournalId,
  ParameterizedQuery,
  QuerySubscription,
  Row,
  SqlValue,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54** (2024-03-11): **[BUG] JournalId type error**
  *Symptoms*: Running into a type incompat error in the SQLSync npm packages. Issue is related to the folder remapping I'm doing during build between src and dist.

- **Issue #30** (2023-12-01): **[BUG] Cannot compile reducer**
  *Symptoms*: **Describe the bug** Cannot build the reducer (on MacOS).  **To Reproduce** Follow the guide. When running `cargo build --target wasm32-unknown-unknown --release`, get many errors such as `error[E0425]: cannot find function `v128_and` in this scope`. See full error log here: https://gist.github.com/steveruizok/7e2ef31bddaeaedfe738237eeb3d7048 
  **Post-Mortem & Fix Analysis**:
  > (fwiw `rustup target add wasm32-unknown-unknown` returns `info: component 'rust-std' for target 'wasm32-unknown-unknown' is up to date`, so that doesn't seem to be it)
  > It looks like you are using Rust nightly. I'll update the guide to specify that stable is required, as rust nightly is adding some new f128 features which are not supported in Wasm yet.  To fix this you can either change your default toolchain: ``` rustup default stable ```  Or use a specific toolchain for this build: ``` rustup run stable cargo build --target wasm32-unknown-unknown --release ```  Thanks for the report! Please let me know if this addresses the issue.

- **Issue #27** (2023-12-04): **reducer error handling**
  *Symptoms*: Currently, if a query fails in the reducer it can leave the reactor in a half-open state. Solutions:  1. Make error handling the responsibility of the reducer - this is probably the right choice     - requires updating the guest/host ffi to support returning errors (ideally using result semantics)     - fbm already supports serializing/deserializing results - so this should be pretty easy 2. reset the reactor (or entire reducer) on error if we want handle errors in the host     - the danger here is that user state could also be half-open, so the only safe thing to do is a full reset  Probably 1 is better as it gives the user more flexibility and allows reducers to handle errors. If a reducer doesn't want to do so - it can forward the error to SQLSync, thus also clearing the half-open state.
  **Post-Mortem & Fix Analysis**:
  > This bug was hit by kakashi443 (discord) and reproduced here: ![image](https://github.com/orbitinghail/sqlsync/assets/82591/8689b85e-4bd4-4911-8d5e-ac9acd7f725c) 

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

### Incident Patch 1: `9712616f` (2025-11-19)
**Commit Message**: fix buffersource error

**File**: `lib/sqlsync-worker/src/util.ts` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ export const pendingPromise = <T = undefined>(): [Promise<T>, (v: T) => void] =>
 
 export const sha256Digest = async (data: Uint8Array): Promise<Uint8Array> => {
   if (crypto?.subtle?.digest) {
-    const hash = await crypto.subtle.digest("SHA-256", data);
+    const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
     return new Uint8Array(hash);
   }
 
```

---

### Incident Patch 2: `95c21822` (2024-03-11)
**Commit Message**: fixing sourcemaps and import bugs

closes #54

**File**: `Cargo.lock` (modified, +3/-16)
```diff
@@ -257,7 +257,7 @@ dependencies = [
  "log",
  "serde",
  "serde_json",
- "sqlsync-reducer 0.3.1",
+ "sqlsync-reducer",
 ]
 
 [[package]]
@@ -984,7 +984,7 @@ dependencies = [
  "log",
  "serde",
  "serde_json",
- "sqlsync-reducer 0.2.0",
+ "sqlsync-reducer",
 ]
 
 [[package]]
@@ -1211,7 +1211,7 @@ dependencies = [
  "serde",
  "simple_logger",
  "sqlite-vfs",
- "sqlsync-reducer 0.3.1",
+ "sqlsync-reducer",
  "testutil",
  "thiserror",
  "time",
@@ -1237,19 +1237,6 @@ dependencies = [
  "worker",
 ]
 
-[[package]]
-name = "sqlsync-reducer"
-version = "0.2.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c88981b831c525276b86f1a97e75ebc79f054159035c629d44a724f84613b199"
-dependencies = [
- "bincode",
- "futures",
- "log",
- "serde",
- "thiserror",
-]
-
 [[package]]
 name = "sqlsync-reducer"
 version = "0.3.1"
```

**File**: `README.md` (modified, +14/-0)
```diff
@@ -44,10 +44,24 @@ By default SQLSync runs in a shared web worker. This allows the database to auto
 
 The easiest way is to use Google Chrome, and go to the special URL: [chrome://inspect/#workers](chrome://inspect/#workers). On that page you'll find a list of all the running shared workers in other tabs. Assuming another tab is running SQLSync, you'll see the shared worker listed. Click `inspect` to open up dev-tools for the worker.
 
+### My table is missing, or multiple statements aren't executing
+SQLSync uses [rusqlite] under the hood to run and query SQLite. Unfortunately, the `execute` method only supports single statements and silently ignores trailing statements. Thus, if you are using `execute!(...)` in your reducer, make sure that each call only runs a single SQL statement.
+
+For example:
+```rust
+// DON'T DO THIS:
+execute!("create table foo (id int); create table bar (id int);").await?;
+
+// DO THIS:
+execute!("create table foo (id int)").await?;
+execute!("create table bar (id int)").await?;
+```
+
 ## Community & Contributing
 
 If you are interested in contributing to SQLSync, please [join the Discord community][discord] and let us know what you want to build. All contributions will be held to a high standard, and are more likely to be accepted if they are tied to an existing task and agreed upon specification.
 
 [![Join the SQLSync Community](https://discordapp.com/api/guilds/1149205110262595634/widget.png?style=banner2)][discord]
 
 [discord]: https://discord.gg/etFk2N9nzC
+[rusqlite]: https://github.com/rusqlite/rusqlite
```

**File**: `examples/guestbook-react/src/vite-env.d.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+/// <reference types="vite/client" />
```

**File**: `examples/guestbook-react/tsconfig.json` (modified, +0/-1)
```diff
@@ -5,7 +5,6 @@
     "lib": ["ES2020", "ES2021.WeakRef", "DOM", "DOM.Iterable"],
     "module": "ESNext",
     "skipLibCheck": true,
-    "types": ["vite/client"],
 
     /* Bundler mode */
     "moduleResolution": "bundler",
```

**File**: `examples/reducer-guestbook/Cargo.toml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ version.workspace = true
 crate-type = ["cdylib"]
 
 [dependencies]
-sqlsync-reducer = "0.2"
+sqlsync-reducer = { path = "../../lib/sqlsync-reducer" }
 serde = { version = "1.0", features = ["derive"] }
 serde_json = "1.0"
 log = "0.4"
```

**File**: `lib/sqlsync-react/package.json` (modified, +1/-5)
```diff
@@ -24,11 +24,7 @@
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "exports": {
-    ".": {
-      "import": "./src/index.ts",
-      "default": "./src/index.ts",
-      "types": "./src/index.ts"
-    }
+    ".": "./src/index.ts"
   },
   "publishConfig": {
     "main": "./dist/index.js",
```

**File**: `lib/sqlsync-solid-js/package.json` (modified, +1/-5)
```diff
@@ -25,11 +25,7 @@
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "exports": {
-    ".": {
-      "import": "./src/index.ts",
-      "default": "./src/index.ts",
-      "types": "./src/index.ts"
-    }
+    ".": "./src/index.ts"
   },
   "publishConfig": {
     "main": "./dist/index.js",
```

**File**: `lib/sqlsync-worker/package.json` (modified, +1/-5)
```diff
@@ -26,11 +26,7 @@
   ],
   "main": "./src/index.ts",
   "exports": {
-    ".": {
-      "default": "./src/index.ts",
-      "import": "./src/index.ts",
-      "types": "./src/index.ts"
-    },
+    ".": "./src/index.ts",
     "./worker.ts": "./src/worker.ts",
     "./sqlsync.wasm": "./sqlsync-wasm/pkg/sqlsync_wasm_bg.wasm"
   },
```

---

### Incident Patch 3: `bf18947b` (2024-03-10)
**Commit Message**: fix solid-js

**File**: `lib/sqlsync-solid-js/package.json` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@
     "build": "rollup --config"
   },
   "devDependencies": {
+    "@babel/preset-typescript": "^7.23.3",
     "@orbitinghail/sqlsync-worker": "workspace:^",
     "@rollup/plugin-babel": "^6.0.4",
     "@rollup/plugin-node-resolve": "^15.2.3",
```

**File**: `pnpm-lock.yaml` (modified, +110/-0)
```diff
@@ -208,6 +208,9 @@ importers:
         specifier: ^1.8.7
         version: 1.8.15
     devDependencies:
+      '@babel/preset-typescript':
+        specifier: ^7.23.3
+        version: 7.23.3(@babel/core@7.24.0)
       '@orbitinghail/sqlsync-worker':
         specifier: workspace:^
         version: link:../sqlsync-worker
@@ -317,6 +320,13 @@ packages:
       jsesc: 2.5.2
     dev: true
 
+  /@babel/helper-annotate-as-pure@7.22.5:
+    resolution: {integrity: sha512-LvBTxu8bQSQkcyKOU+a1btnNFQ1dMAd0R6PyW3arXes06F6QLWLIrd681bxRPIXlrMGR3XYnW9JyML7dP3qgxg==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.24.0
+    dev: true
+
   /@babel/helper-compilation-targets@7.23.6:
     resolution: {integrity: sha512-9JB548GZoQVmzrFgp8o7KxdgkTGm6xs9DW0o/Pim72UDjzr5ObUQ6ZzYPqA+g9OTS2bBQoctLJrky0RDCAWRgQ==}
     engines: {node: '>=6.9.0'}
@@ -328,6 +338,24 @@ packages:
       semver: 6.3.1
     dev: true
 
+  /@babel/helper-create-class-features-plugin@7.24.0(@babel/core@7.24.0):
+    resolution: {integrity: sha512-QAH+vfvts51BCsNZ2PhY6HAggnlS6omLLFTsIpeqZk/MmJ6cW7tgz5yRv0fMJThcr6FmbMrENh1RgrWPTYA76g==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0
+    dependencies:
+      '@babel/core': 7.24.0
+      '@babel/helper-annotate-as-pure': 7.22.5
+      '@babel/helper-environment-visitor': 7.22.20
+      '@babel/helper-function-name': 7.23.0
+      '@babel/helper-member-expression-to-functions': 7.23.0
+      '@babel/helper-optimise-call-expression': 7.22.5
+      '@babel/helper-replace-supers': 7.22.20(@babel/core@7.24.0)
+      '@babel/helper-skip-transparent-expression-wrappers': 7.22.5
+      '@babel/helper-split-export-declaration': 7.22.6
+      semver: 6.3.1
+    dev: true
+
   /@babel/helper-environment-visitor@7.22.20:
     resolution: {integrity: sha512-zfedSIzFhat/gFhWfHtgWvlec0nqB9YEIVrpuwjruLlXfUSnA8cJB0miHKwqDnQ7d32aKo2xt88/xZptwxbfhA==}
     engines: {node: '>=6.9.0'}
@@ -348,6 +376,13 @@ packages:
       '@babel/types': 7.23.6
     dev: true
 
+  /@babel/helper-member-expression-to-functions@7.23.0:
+    resolution: {integrity: sha512-6gfrPwh7OuT6gZyJZvd6WbTfrqAo7vm4xCzAXOusKqq/vWdKXphTpj5klHKNmRUU6/QRGlBsyU9mAIPaWHlqJA==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.24.0
+    dev: true
+
   /@babel/helper-module-imports@7.18.6:
     resolution: {integrity: sha512-0NFvs3VkuSYbFi1x2Vd6tKrywq+z/cLeYC/RJNFrIX/30Bf5aiGYbtvGXolEktzJH8o5E5KJ3tT+nkxuuZFVlA==}
     engines: {node: '>=6.9.0'}
@@ -376,6 +411,13 @@ packages:
       '@babel/helper-validator-identifier': 7.22.20
     dev: true
 
+  /@babel/helper-optimise-call-expression@7.22.5:
+    resolution: {integrity: sha512-HBwaojN0xFRx4yIvpwGqxiV2tUfl7401jlok564NgB9EHS1y6QT17FmKWm4ztqjeVdXLuC4fSvHc5ePpQjoTbw==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.24.0
+    dev: true
+
   /@babel/helper-plugin-utils@7.22.5:
     resolution: {integrity: sha512-uLls06UVKgFG9QD4OeFYLEGteMIAa5kpTPcFL28yuCIIzsf6ZyKZMllKVOCZFhiZ5ptnwX4mtKdWCBE/uT4amg==}
     engines: {node: '>=6.9.0'}
@@ -386,13 +428,32 @@ packages:
     engines: {node: '>=6.9.0'}
     dev: true
 
+  /@babel/helper-replace-supers@7.22.20(@babel/core@7.24.0):
+    resolution: {integrity: sha512-qsW0In3dbwQUbK8kejJ4R7IHVGwHJlV6lpG6UA7a9hSa2YEiAib+N1T2kr6PEeUT+Fl7najmSOS6SmAwCHK6Tw==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0
+    dependencies:
+      '@babel/core': 7.24.0
+      '@babel/helper-environment-visitor': 7.22.20
+      '@babel/helper-member-expression-to-functions': 7.23.0
+      '@babel/helper-optimise-call-expression': 7.22.5
+    dev: true
+
   /@babel/helper-simple-access@7.22.5:
     resolution: {integrity: sha512-n0H99E/K+Bika3++WNL17POvo4rKWZ7lZEp1Q+fStVbUi8nxPQEBOlTmCOxW/0JsS56SKKQ+ojAe2pHKJHN35w==}
     engines: {node: '>=6.9.0'}
     dependencies:
       '@babel/types': 7.23.6
     dev: true
 
+  /@babel/helper-skip-transparent-expression-wrappers@7.22.5:
+    resolution: {integrity: sha512-tK14r66JZKiC43p8Ki33yLBVJKlQDFoA8GYN67lWCDCqoL6EMMSuM9b+Iff2jHaM/RRFYl7K+iiru7hbRqNx8Q==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.24.0
+    dev: true
+
   /@babel/helper-split-export-declaration@7.22.6:
     resolution: {integrity: sha512-AsUnxuLhRYsisFiaJwvp1QF+I3KjD5FOxut14q/GzovUe6orHLesW2C7d754kRm53h5gqrz6sFl6sxc4BVtE/g==}
     engines: {node: '>=6.9.0'}
@@ -461,6 +522,28 @@ packages:
       '@babel/helper-plugin-utils': 7.24.0
     dev: true
 
+  /@babel/plugin-syntax-typescript@7.23.3(@babel/core@7.24.0):
+    resolution: {integrity: sha512-9EiNjVJOMwCO+43TqoTrgQ8jMwcAd0sWyXi9RPfIsLTj4R2MADDDQXELhffaUx/uJv2AYcxBgPwH6j4TIA4ytQ==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0-0
+    dependencies:
+      '@babel/core': 7.24.0
+      '@babel/helper-plugin-utils': 7.24.0
+    dev: true
+
+  /@babel/plugin-transform-modules-commonjs@7.23.3(@babel/core@7.24.0):
+    res
```

---

### Incident Patch 4: `888a9ceb` (2024-03-10)
**Commit Message**: fixed async queue swallowing errors

**File**: `README.md` (modified, +7/-0)
```diff
@@ -37,6 +37,13 @@ If you are interested in using or contributing to SQLSync, please [join the Disc
 
 Please refer to [the guide](./GUIDE.md) to learn how to add SQLSync to your application.
 
+## Tips & Tricks
+
+### How to debug SQLSync in the browser
+By default SQLSync runs in a shared web worker. This allows the database to automatically be shared between different tabs, however results in making SQLSync a bit harder to debug.
+
+The easiest way is to use Google Chrome, and go to the special URL: [chrome://inspect/#workers](chrome://inspect/#workers). On that page you'll find a list of all the running shared workers in other tabs. Assuming another tab is running SQLSync, you'll see the shared worker listed. Click `inspect` to open up dev-tools for the worker.
+
 ## Community & Contributing
 
 If you are interested in contributing to SQLSync, please [join the Discord community][discord] and let us know what you want to build. All contributions will be held to a high standard, and are more likely to be accepted if they are tied to an existing task and agreed upon specification.
```

**File**: `lib/sqlsync-worker/sqlsync-wasm/src/utils.rs` (modified, +2/-1)
```diff
@@ -137,7 +137,8 @@ pub async fn fetch_reducer(reducer_url: &str) -> Result<(WasmReducer, Vec<u8>),
         Uint8Array::new(&digest).to_vec()
     };
 
-    let reducer = WasmReducer::new(reducer_wasm_bytes.as_slice())?;
+    let reducer = WasmReducer::new(reducer_wasm_bytes.as_slice())
+        .map_err(|err| anyhow!("failed to instantiate reducer from wasm: {}", err))?;
 
     Ok((reducer, digest))
 }
```

**File**: `lib/sqlsync-worker/src/worker.ts` (modified, +6/-5)
```diff
@@ -19,13 +19,14 @@ const MessageQueue = (() => {
   let queue = Promise.resolve();
   return {
     push: (m: Message) => {
-      queue = queue.then(
-        () => handleMessage(m),
-        (e) => {
+      queue = queue.then(async () => {
+        try {
+          await handleMessage(m);
+        } catch (e) {
           const err = e instanceof Error ? e.message : `error: ${JSON.stringify(e)}`;
           reply(m.portId, m.req.handlerId, { tag: "Err", err });
-        },
-      );
+        }
+      });
     },
   };
 })();
```

---

### Incident Patch 5: `29ee7e02` (2024-01-07)
**Commit Message**: wip: more fixes

**File**: `lib/sqlsync-solid-js/package.json` (modified, +4/-5)
```diff
@@ -52,16 +52,15 @@
     "@rollup/plugin-typescript": "^11.1.5",
     "@types/node": "^20.8.8",
     "babel-preset-solid": "^1.8.8",
+    "@orbitinghail/sqlsync-worker": "workspace:^",
     "rollup": "^3.29.4",
     "typescript": "^5.2.2"
   },
   "dependencies": {
-    "@orbitinghail/sqlsync-worker": "0.2.0",
-    "@scure/base": "^1.1.3",
-    "fast-equals": "^5.0.1",
-    "fast-sha256": "^1.3.0"
+    "fast-equals": "^5.0.1"
   },
   "peerDependencies": {
-    "solid-js": "^1.8.7"
+    "solid-js": "^1.8.7",
+    "@orbitinghail/sqlsync-worker": "workspace:^"
   }
 }
```

---

### Incident Patch 6: `46462353` (2024-01-07)
**Commit Message**: fix exports

**File**: `lib/sqlsync-solid-js/package.json` (modified, +14/-3)
```diff
@@ -22,15 +22,26 @@
     "src"
   ],
   "type": "module",
-  "main": "./dist/sqlsync-solid-js.js",
   "types": "./src/index.ts",
+  "main": "./src/index.ts",
   "exports": {
     ".": {
-      "import": "./dist/sqlsync-solid-js.js",
-      "require": "./dist/sqlsync-solid-js.umd.cjs",
+      "import": "./src/index.ts",
+      "default": "./src/index.ts",
       "types": "./src/index.ts"
     }
   },
+  "publishConfig": {
+    "main": "./dist/index.js",
+    "types": "./dist/index.d.ts",
+    "exports": {
+      ".": {
+        "import": "./dist/index.js",
+        "default": "./dist/index.js",
+        "types": "./dist/index.d.ts"
+      }
+    }
+  },
   "scripts": {
     "dev": "vite",
     "build": "rollup --config"
```

**File**: `lib/sqlsync-solid-js/rollup.config.js` (modified, +2/-2)
```diff
@@ -9,15 +9,15 @@ export default {
     format: "es",
     sourcemap: true,
   },
-  external: ["react", "@orbitinghail/sqlsync-worker"],
+  external: ["solid-js", "@orbitinghail/sqlsync-worker"],
   plugins: [
     typescript(),
     nodeResolve(),
     babel({
       extensions: [".ts", ".tsx"],
       babelHelpers: "bundled",
       presets: ["solid", "@babel/preset-typescript"],
-      exclude: /node_modules\//,
+      exclude: [/node_modules\//],
     }),
   ],
 };
```

---

### Incident Patch 7: `dbf37dc0` (2024-01-06)
**Commit Message**: fixing github actions

**File**: `.github/workflows/actions.yaml` (modified, +2/-2)
```diff
@@ -38,10 +38,10 @@ jobs:
           version: "8"
           run_install: true
       # build, test, and package sqlsync
-      - name: Lint & Fmt
-        run: just lint
       - name: Build all
         run: just build
+      - name: Lint & Format
+        run: just lint
       - name: Unit tests
         run: just unit-test
       - name: end-to-end-local
```

---

### Incident Patch 8: `fa45edc4` (2024-01-06)
**Commit Message**: minor fixes

**File**: `lib/sqlsync/examples/end-to-end-local-net.rs` (modified, +2/-2)
```diff
@@ -80,7 +80,7 @@ fn start_server<'a>(
     let coordinator = CoordinatorDocument::open(
         storage_journal,
         MemoryJournalFactory,
-        &wasm_bytes[..],
+        WasmReducer::new(wasm_bytes.as_slice())?,
     )?;
     let coordinator = Arc::new(Mutex::new(coordinator));
 
@@ -112,7 +112,7 @@ fn start_server<'a>(
 }
 
 fn handle_client(
-    doc: Arc<Mutex<CoordinatorDocument<MemoryJournal>>>,
+    doc: Arc<Mutex<CoordinatorDocument<MemoryJournal, WasmReducer>>>,
     socket: TcpStream,
 ) -> anyhow::Result<()> {
     log::info!("server: received client connection");
```

**File**: `lib/sqlsync/src/coordinator.rs` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@ use rusqlite::Transaction;
 
 use crate::db::{open_with_vfs, run_in_tx, ConnectionPair};
 use crate::error::Result;
-use crate::reducer::{Reducer, WasmReducer};
+use crate::reducer::Reducer;
 use crate::replication::{
     ReplicationDestination, ReplicationError, ReplicationSource,
 };
@@ -47,7 +47,7 @@ impl<J: Journal, R: Reducer> CoordinatorDocument<J, R> {
     pub fn open(
         storage: J,
         timeline_factory: J::Factory,
-        reducer: R, // reducer_wasm_bytes: &[u8],
+        reducer: R,
     ) -> Result<Self> {
         let (mut sqlite, mut storage) = open_with_vfs(storage)?;
 
@@ -141,7 +141,7 @@ impl<J: Journal, R: Reducer> CoordinatorDocument<J, R> {
 }
 
 /// CoordinatorDocument knows how to replicate it's storage journal
-impl<J: Journal + ReplicationSource, R: Reducer> ReplicationSource
+impl<J: Journal + ReplicationSource, R> ReplicationSource
     for CoordinatorDocument<J, R>
 {
     type Reader<'a> = <J as ReplicationSource>::Reader<'a>
```

**File**: `lib/sqlsync/src/timeline.rs` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@ use crate::{
     lsn::{Lsn, LsnRange},
     positioned_io::PositionedReader,
     reducer::{Reducer, ReducerError, WasmReducer},
-    JournalError,
 };
 
 const TIMELINES_TABLE_SQL: &str = "
```

---

### Incident Patch 9: `c336448f` (2024-01-06)
**Commit Message**: revert react changes

**File**: `lib/sqlsync-react/src/hooks.ts` (modified, +4/-4)
```diff
@@ -18,7 +18,7 @@ export function useSQLSync(): SQLSync {
   const value = useContext(SQLSyncContext);
   if (!value) {
     throw new Error(
-      "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>"
+      "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>",
     );
   }
   return value;
@@ -43,7 +43,7 @@ export function createDocHooks<M>(docType: DocType<M>): DocHooks<M> {
     const sqlsync = useSQLSync();
     return useCallback(
       (mutation: M) => sqlsync.mutate(docId, docType, mutation),
-      [sqlsync, docId, docType]
+      [sqlsync, docId, docType],
     );
   };
 
@@ -55,7 +55,7 @@ export function createDocHooks<M>(docType: DocType<M>): DocHooks<M> {
     const sqlsync = useSQLSync();
     return useCallback(
       (enabled: boolean) => sqlsync.setConnectionEnabled(docId, docType, enabled),
-      [sqlsync, docId, docType]
+      [sqlsync, docId, docType],
     );
   };
 
@@ -74,7 +74,7 @@ export type QueryState<R> =
 export function useQuery<M, R = Row>(
   docType: DocType<M>,
   docId: DocId,
-  rawQuery: ParameterizedQuery | string
+  rawQuery: ParameterizedQuery | string,
 ): QueryState<R> {
   const sqlsync = useSQLSync();
   const [state, setState] = useState<QueryState<R>>({ state: "pending" });
```

---

### Incident Patch 10: `a72e0c57` (2024-01-05)
**Commit Message**: more cleanups and fixes

**File**: `lib/sqlsync-solid-js/index.html` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-<!doctype html>
-<html lang="en">
-
-<head>
-    <meta charset="UTF-8" />
-    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>sqlsync-react tests index</title>
-</head>
-
-<body>
-    <ul>
-        <li><a href="/test/react-sanity.html">react-sanity.html</a></li>
-    </ul>
-</body>
-
-</html>
\ No newline at end of file
```

**File**: `lib/sqlsync-solid-js/src/context.tsx` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
+import { SQLSync } from "@orbitinghail/sqlsync-worker";
 import { ParentComponent, createContext, createSignal, onCleanup } from "solid-js";
-import { SQLSync } from "./sqlsync";
 
 export const SQLSyncContext = createContext<[() => SQLSync | null, (sqlSync: SQLSync) => void]>([
   () => null,
```

**File**: `lib/sqlsync-solid-js/test/solid-sanity.html` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-<!DOCTYPE html>
-<html lang="en">
-  <head>
-    <meta charset="UTF-8" />
-    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>sqlsync-solid-js tests</title>
-  </head>
-  <body>
-    <div id="root">if nothing renders, open the console</div>
-    <script type="module" src="./solid-sanity.tsx"></script>
-  </body>
-</html>
```

**File**: `lib/sqlsync-solid-js/test/solid-sanity.tsx` (removed, +0/-107)
```diff
@@ -1,107 +0,0 @@
-import { JournalId, journalIdFromString } from "@orbitinghail/sqlsync-worker";
-import sqlSyncWasmUrl from "@orbitinghail/sqlsync-worker/sqlsync.wasm?url";
-import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?url";
-import { Match, Switch, createEffect } from "solid-js";
-import { createSignal } from "solid-js/types/server/reactive.js";
-import { render } from "solid-js/web";
-import { SQLSyncProvider } from "../src";
-import { createDocHooks } from "../src/hooks";
-import { sql } from "../src/sql";
-import { DocType } from "../src/sqlsync";
-import { serializeMutationAsJSON } from "../src/util";
-
-const DEMO_REDUCER_URL = new URL(
-  "../../../target/wasm32-unknown-unknown/debug/sqlsync_react_test_reducer.wasm",
-  import.meta.url
-);
-
-const DOC_ID = journalIdFromString("VM7fC4gKxa52pbdtrgd9G9");
-
-type CounterOps =
-  | {
-      tag: "InitSchema";
-    }
-  | {
-      tag: "Incr";
-      value: number;
-    }
-  | {
-      tag: "Decr";
-      value: number;
-    };
-
-const CounterDocType: DocType<CounterOps> = {
-  reducerUrl: DEMO_REDUCER_URL,
-  serializeMutation: serializeMutationAsJSON,
-};
-
-const [counterDocType, _setCounterDocType] = createSignal(CounterDocType);
-
-const { useMutate, useQuery } = createDocHooks(counterDocType);
-
-render(
-  () => (
-    <SQLSyncProvider wasmUrl={sqlSyncWasmUrl} workerUrl={workerUrl}>
-      <App docId={DOC_ID} />
-    </SQLSyncProvider>
-  ),
-  document.getElementById("root")!
-);
-
-// @ts-ignore
-function App({ docId }: { docId: JournalId }) {
-  const mutate = useMutate(docId);
-
-  createEffect(() => {
-    mutate({ tag: "InitSchema" }).catch((err) => {
-      console.error("Failed to init schema", err);
-    });
-  });
-
-  const handleIncr = () => {
-    mutate({ tag: "Incr", value: 1 }).catch((err) => {
-      console.error("Failed to incr", err);
-    });
-  };
-
-  const handleDecr = () => {
-    mutate({ tag: "Decr", value: 1 }).catch((err) => {
-      console.error("Failed to decr", err);
-    });
-  };
-
-  const query = useQuery<{ value: number }>(
-    () => docId,
-    () => sql`select value, 'hi', 1.23, ${"foo"} as s from counter`
-  );
-
-  return (
-    <>
-      <h1>sqlsync-react sanity test</h1>
-      <p>
-        This is a sanity test for sqlsync-react. It should display a counter that can be incremented
-        and decremented.
-      </p>
-      <p>The counter is stored in a SQL database, and the state is managed by sqlsync-react.</p>
-      <p>
-        <button type="button" onClick={handleIncr}>
-          Incr
-        </button>
-        <button type="button" onClick={handleDecr}>
-          Decr
-        </button>
-      </p>
-      <Switch>
-        <Match when={query().state === "pending"}>
-          <pre>Loading...</pre>
-        </Match>
-        <Match when={query().state === "error"}>
-          <pre style={{ color: "red" }}>{(query() as any).error.message}</pre>
-        </Match>
-        <Match when={query().state === "success"}>
-          <pre>{query().rows?.[0]?.value.toString()}</pre>
-        </Match>
-      </Switch>
-    </>
-  );
-}
```

**File**: `pnpm-lock.yaml` (modified, +1569/-68)
```diff
@@ -132,38 +132,7 @@ importers:
         version: 5.2.2
       vite:
         specifier: ^5.0.8
-        version: 5.0.10
-
-  examples/simple-counter-react:
-    dependencies:
-      '@orbitinghail/sqlsync-react':
-        specifier: workspace:*
-        version: link:../../lib/sqlsync-react
-      '@orbitinghail/sqlsync-worker':
-        specifier: workspace:*
-        version: link:../../lib/sqlsync-worker
-      react:
-        specifier: ^18.2.0
-        version: 18.2.0
-      react-dom:
-        specifier: ^18.2.0
-        version: 18.2.0(react@18.2.0)
-    devDependencies:
-      '@types/react':
-        specifier: ^18.2.43
-        version: 18.2.46
-      '@types/react-dom':
-        specifier: ^18.2.17
-        version: 18.2.18
-      '@vitejs/plugin-react':
-        specifier: ^4.2.1
-        version: 4.2.1(vite@5.0.10)
-      typescript:
-        specifier: ^5.2.2
-        version: 5.2.2
-      vite:
-        specifier: ^5.0.8
-        version: 5.0.10
+        version: 5.0.10(@types/node@20.8.8)
 
   lib/sqlsync-react:
     dependencies:
@@ -202,6 +171,52 @@ importers:
         specifier: ^5.2.2
         version: 5.2.2
 
+  lib/sqlsync-solid-js:
+    dependencies:
+      '@orbitinghail/sqlsync-worker':
+        specifier: 0.2.0
+        version: link:../sqlsync-worker
+      '@scure/base':
+        specifier: ^1.1.3
+        version: 1.1.3
+      fast-equals:
+        specifier: ^5.0.1
+        version: 5.0.1
+      fast-sha256:
+        specifier: ^1.3.0
+        version: 1.3.0
+      solid-js:
+        specifier: ^1.8.7
+        version: 1.8.8
+    devDependencies:
+      '@solidjs/testing-library':
+        specifier: ^0.8.4
+        version: 0.8.5(@solidjs/router@0.10.6)(solid-js@1.8.8)
+      '@testing-library/jest-dom':
+        specifier: ^6.1.3
+        version: 6.2.0(vitest@0.34.6)
+      '@types/node':
+        specifier: ^20.8.8
+        version: 20.8.8
+      typescript:
+        specifier: ^5.2.2
+        version: 5.2.2
+      vite:
+        specifier: ^4.5.0
+        version: 4.5.0(@types/node@20.8.8)
+      vite-plugin-dts:
+        specifier: ^3.6.1
+        version: 3.7.0(@types/node@20.8.8)(typescript@5.2.2)(vite@4.5.0)
+      vite-plugin-solid:
+        specifier: ^2.7.0
+        version: 2.8.0(solid-js@1.8.8)(vite@4.5.0)
+      vite-tsconfig-paths:
+        specifier: ^4.2.1
+        version: 4.2.3(typescript@5.2.2)(vite@4.5.0)
+      vitest:
+        specifier: ^0.34.6
+        version: 0.34.6
+
   lib/sqlsync-worker:
     dependencies:
       '@scure/base':
@@ -232,6 +247,10 @@ importers:
 
 packages:
 
+  /@adobe/css-tools@4.3.2:
+    resolution: {integrity: sha512-DA5a1C0gD/pLOvhv33YMrbf2FK3oUzwNl9oOJqE4XVjuEtt6XIakRcsd7eLiOSPkp1kTRQGICTA8cKra/vFbjw==}
+    dev: true
+
   /@ampproject/remapping@2.2.1:
     resolution: {integrity: sha512-lFMjJTrFL3j7L9yBxwYfCq2k6qqwHyzuUl/XBnif78PWTJYyL/dfowQHWE3sp6U6ZzqWiiIZnpTMO96zhkjwtg==}
     engines: {node: '>=6.0.0'}
@@ -332,6 +351,13 @@ packages:
       jsesc: 2.5.2
     dev: true
 
+  /@babel/helper-annotate-as-pure@7.22.5:
+    resolution: {integrity: sha512-LvBTxu8bQSQkcyKOU+a1btnNFQ1dMAd0R6PyW3arXes06F6QLWLIrd681bxRPIXlrMGR3XYnW9JyML7dP3qgxg==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.23.6
+    dev: true
+
   /@babel/helper-compilation-targets@7.22.15:
     resolution: {integrity: sha512-y6EEzULok0Qvz8yyLkCvVX+02ic+By2UdOhylwUOvOn9dvYc9mKICJuuU1n1XBI02YWsNsnrY1kc6DVbjcXbtw==}
     engines: {node: '>=6.9.0'}
@@ -354,6 +380,24 @@ packages:
       semver: 6.3.1
     dev: true
 
+  /@babel/helper-create-class-features-plugin@7.23.7(@babel/core@7.23.7):
+    resolution: {integrity: sha512-xCoqR/8+BoNnXOY7RVSgv6X+o7pmT5q1d+gGcRlXYkI+9B31glE4jeejhKVpA04O1AtzOt7OSQ6VYKP5FcRl9g==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0
+    dependencies:
+      '@babel/core': 7.23.7
+      '@babel/helper-annotate-as-pure': 7.22.5
+      '@babel/helper-environment-visitor': 7.22.20
+      '@babel/helper-function-name': 7.23.0
+      '@babel/helper-member-expression-to-functions': 7.23.0
+      '@babel/helper-optimise-call-expression': 7.22.5
+      '@babel/helper-replace-supers': 7.22.20(@babel/core@7.23.7)
+      '@babel/helper-skip-transparent-expression-wrappers': 7.22.5
+      '@babel/helper-split-export-declaration': 7.22.6
+      semver: 6.3.1
+    dev: true
+
   /@babel/helper-environment-visitor@7.22.20:
     resolution: {integrity: sha512-zfedSIzFhat/gFhWfHtgWvlec0nqB9YEIVrpuwjruLlXfUSnA8cJB0miHKwqDnQ7d32aKo2xt88/xZptwxbfhA==}
     engines: {node: '>=6.9.0'}
@@ -374,6 +418,20 @@ packages:
       '@babel/types': 7.23.4
     dev: true
 
+  /@babel/helper-member-expression-to-functions@7.23.0:
+    resolution: {integrity: sha512-6gfrPwh7OuT6gZyJZvd6WbTfrqAo7vm4xCzAXOusKqq/vWdKXphTpj5klHKNmRUU6/QRGlBsyU9mAIPaWHlqJA==}
+    engines: {node: '>=6.9.0'}
+    dependencies:
+      '@babel/types': 7.23.6
+    dev: true
+
+  /@babel/helper-module-imports@7.18.6:
+    resolution: {
```

---

### Incident Patch 11: `3c2b58d0` (2024-01-04)
**Commit Message**: fix

**File**: `lib/sqlsync-solid-js/src/context.tsx` (modified, +6/-8)
```diff
@@ -1,5 +1,4 @@
-// import { ReactNode, createContext, useEffect, useState } from "react";
-import { ParentComponent, createContext, createEffect, createSignal, onCleanup } from "solid-js";
+import { ParentComponent, createContext, createSignal, onCleanup } from "solid-js";
 import { SQLSync } from "./sqlsync";
 
 export const SQLSyncContext = createContext<[() => SQLSync | null, (sqlSync: SQLSync) => void]>([
@@ -20,12 +19,11 @@ export const createSqlSync = (props: Props): SQLSync => {
 export const SQLSyncProvider: ParentComponent<Props> = (props) => {
   const [sqlSync, setSQLSync] = createSignal<SQLSync>(createSqlSync(props));
 
-  createEffect(() => {
-    const sqlSync = createSqlSync(props);
-    setSQLSync(sqlSync);
-    onCleanup(() => {
-      sqlSync.close();
-    });
+  onCleanup(() => {
+    const s = sqlSync();
+    if (s) {
+      s.close();
+    }
   });
 
   return (
```

---

### Incident Patch 12: `8eb21881` (2023-12-30)
**Commit Message**: more changes. just have to fix the test

**File**: `lib/sqlsync-solid-js/src/context.tsx` (modified, +11/-13)
```diff
@@ -1,38 +1,36 @@
 // import { ReactNode, createContext, useEffect, useState } from "react";
 import {
+  Accessor,
   ParentComponent,
-  Show,
   createContext,
   createEffect,
   createSignal,
   onCleanup,
 } from "solid-js";
 import { SQLSync } from "./sqlsync";
 
-export const SQLSyncContext = createContext<SQLSync | null>(null);
+export const SQLSyncContext = createContext<[Accessor<SQLSync | null>]>([() => null]);
 
 interface Props {
   workerUrl: string | URL;
   wasmUrl: string | URL;
   coordinatorUrl?: string | URL;
 }
 
+const createSqlSync = (props: Props): SQLSync => {
+  return new SQLSync(props.workerUrl, props.wasmUrl, props.coordinatorUrl);
+};
+
 export const SQLSyncProvider: ParentComponent<Props> = (props) => {
-  const [sqlsync, setSQLSync] = createSignal<SQLSync | null>(null);
+  const [sqlSync, setSQLSync] = createSignal<SQLSync | null>(null);
 
   createEffect(() => {
-    const sqlsync = new SQLSync(props.workerUrl, props.wasmUrl, props.coordinatorUrl);
-    setSQLSync(sqlsync);
+    const sqlSync = createSqlSync(props);
+    setSQLSync(sqlSync);
     onCleanup(() => {
-      sqlsync.close();
+      sqlSync.close();
     });
   });
 
-  return (
-    <Show when={sqlsync()} keyed>
-      {(sqlSync) => {
-        return <SQLSyncContext.Provider value={sqlSync}>{props.children}</SQLSyncContext.Provider>;
-      }}
-    </Show>
-  );
+  return <SQLSyncContext.Provider value={[sqlSync]}>{props.children}</SQLSyncContext.Provider>;
 };
```

**File**: `lib/sqlsync-solid-js/src/hooks.ts` (modified, +47/-35)
```diff
@@ -1,27 +1,42 @@
 import { ConnectionStatus, DocId } from "@orbitinghail/sqlsync-worker";
-import { deepEqual } from "fast-equals";
 // import { useCallback, useContext, useEffect, useRef, useState } from "react";
-import { createContext, createMemo } from "solid-js";
+import { Accessor, createEffect, createSignal, onCleanup, useContext } from "solid-js";
 import { SQLSyncContext } from "./context";
 import { ParameterizedQuery, normalizeQuery } from "./sql";
 import { DocType, QuerySubscription, Row, SQLSync } from "./sqlsync";
 import { pendingPromise } from "./util";
 
-export function useSQLSync(): SQLSync {
-  const value = createContext(SQLSyncContext);
-  if (import.meta.env.DEV && !value) {
+export function useSQLSync(): Accessor<SQLSync> {
+  const [value] = useContext(SQLSyncContext);
+  if (import.meta.env.DEV && !value()) {
     throw new Error(
       "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>"
     );
   }
+
   // biome-ignore lint/style/noNonNullAssertion: asserts in dev
-  return value!;
+  return () => {
+    const sqlsync = value();
+    if (import.meta.env.DEV && !sqlsync) {
+      throw new Error(
+        "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>"
+      );
+    } else if (!sqlsync) {
+      console.error(
+        "could not find sqlsync context value; please ensure the component is wrapped in a <SqlSyncProvider>"
+      );
+    }
+    return sqlsync!;
+  };
 }
 
 type MutateFn<M> = (mutation: M) => Promise<void>;
 type UseMutateFn<M> = (docId: DocId) => MutateFn<M>;
 
-type UseQueryFn = <R = Row>(docId: DocId, query: ParameterizedQuery | string) => QueryState<R>;
+type UseQueryFn = <R = Row>(
+  docId: Accessor<DocId>,
+  query: Accessor<ParameterizedQuery | string>
+) => Accessor<QueryState<R>>;
 
 type SetConnectionEnabledFn = (enabled: boolean) => Promise<void>;
 type UseSetConnectionEnabledFn = (docId: DocId) => SetConnectionEnabledFn;
@@ -32,22 +47,22 @@ export interface DocHooks<M> {
   useSetConnectionEnabled: UseSetConnectionEnabledFn;
 }
 
-export function createDocHooks<M>(docType: DocType<M>): DocHooks<M> {
+export function createDocHooks<M>(docType: Accessor<DocType<M>>): DocHooks<M> {
   const useMutate = (docId: DocId): MutateFn<M> => {
     const sqlsync = useSQLSync();
-    return createMemo((mutation: M) => sqlsync.mutate(docId, docType, mutation));
+    return (mutation: M) => sqlsync().mutate(docId, docType(), mutation);
   };
 
-  const useQueryWrapper = <R = Row>(docId: DocId, query: ParameterizedQuery | string) => {
+  const useQueryWrapper = <R = Row>(
+    docId: Accessor<DocId>,
+    query: Accessor<ParameterizedQuery | string>
+  ) => {
     return useQuery<M, R>(docType, docId, query);
   };
 
   const useSetConnectionEnabledWrapper = (docId: DocId) => {
     const sqlsync = useSQLSync();
-    return useCallback(
-      (enabled: boolean) => sqlsync.setConnectionEnabled(docId, docType, enabled),
-      [sqlsync, docId, docType]
-    );
+    return (enabled: boolean) => sqlsync().setConnectionEnabled(docId, docType(), enabled);
   };
 
   return {
@@ -63,22 +78,16 @@ export type QueryState<R> =
   | { state: "error"; error: Error; rows?: R[] };
 
 export function useQuery<M, R = Row>(
-  docType: DocType<M>,
-  docId: DocId,
-  rawQuery: ParameterizedQuery | string
-): QueryState<R> {
+  docType: Accessor<DocType<M>>,
+  docId: Accessor<DocId>,
+  rawQuery: Accessor<ParameterizedQuery | string>
+): Accessor<QueryState<R>> {
   const sqlsync = useSQLSync();
-  const [state, setState] = useState<QueryState<R>>({ state: "pending" });
+  const [state, setState] = createSignal<QueryState<R>>({ state: "pending" });
 
-  // memoize query based on deep equality
-  let query = normalizeQuery(rawQuery);
-  const queryRef = useRef<ParameterizedQuery>(query);
-  if (!deepEqual(queryRef.current, query)) {
-    queryRef.current = query;
-  }
-  query = queryRef.current;
+  createEffect(() => {
+    let query = normalizeQuery(rawQuery());
 
-  useEffect(() => {
     const [unsubPromise, unsubResolve] = pendingPromise<() => void>();
 
     const subscription: QuerySubscription = {
@@ -91,29 +100,32 @@ export function useQuery<M, R = Row>(
         })),
     };
 
-    sqlsync
-      .subscribe(docId, docType, query, subscription)
+    sqlsync()
+      .subscribe(docId(), docType(), query, subscription)
       .then(unsubResolve)
       .catch((err: Error) => {
         console.error("sqlsync: error subscribing", err);
         setState({ state: "error", error: err });
       });
 
-    return () => {
+    onCleanup(() => {
       unsubPromise
         .then((unsub) => unsub())
         .catch((err) => {
           console.error("sqlsync: error unsubscribing", err);
         });
-    };
-  }, [sqlsync, docId, docType, query]);
+    });
+  });
 
   return state;
 }
 
-export const useConnectionStatus = (): ConnectionStatus => {
+export const useConnectionStatus 
```

**File**: `lib/sqlsync-solid-js/src/sqlsync.ts` (modified, +7/-7)
```diff
@@ -57,7 +57,7 @@ export class SQLSync {
       } else {
         console.log(
           "sqlsync: dropping message; sqlsync object has been garbage collected",
-          msg.data,
+          msg.data
         );
         // clean up the port
         port.postMessage({ tag: "Close", handlerId: 0 });
@@ -94,7 +94,7 @@ export class SQLSync {
     } else if (msg.tag === "Event") {
       this.#handleDocEvent(msg.docId, msg.evt);
     } else {
-      assertUnreachable("unknown message", msg);
+      assertUnreachable("unknown message", msg as never);
     }
   }
 
@@ -120,13 +120,13 @@ export class SQLSync {
         }
       }
     } else {
-      assertUnreachable("unknown event", evt);
+      assertUnreachable("unknown event", evt as never);
     }
   }
 
   #send<T extends Exclude<DocReplyTag, "Err">>(
     expectedReplyTag: T,
-    msg: OmitUnion<WorkerRequest, "handlerId">,
+    msg: OmitUnion<WorkerRequest, "handlerId">
   ): Promise<SelectDocReply<T>> {
     return new Promise((resolve, reject) => {
       const handlerId = nextHandlerId();
@@ -181,7 +181,7 @@ export class SQLSync {
     docId: DocId,
     docType: DocType<M>,
     sql: string,
-    params: SqlValue[],
+    params: SqlValue[]
   ): Promise<T[]> {
     if (!this.#openDocs.has(docId)) {
       await this.#open(docId, docType);
@@ -200,7 +200,7 @@ export class SQLSync {
     docId: DocId,
     docType: DocType<M>,
     query: ParameterizedQuery,
-    subscription: QuerySubscription,
+    subscription: QuerySubscription
   ): Promise<() => void> {
     if (!this.#openDocs.has(docId)) {
       await this.#open(docId, docType);
@@ -292,7 +292,7 @@ export class SQLSync {
   async setConnectionEnabled<M>(
     docId: DocId,
     docType: DocType<M>,
-    enabled: boolean,
+    enabled: boolean
   ): Promise<void> {
     if (!this.#openDocs.has(docId)) {
       await this.#open(docId, docType);
```

**File**: `lib/sqlsync-solid-js/test/react-sanity.tsx` (modified, +36/-22)
```diff
@@ -1,6 +1,9 @@
-import React, { useEffect } from "react";
+// import React, { useEffect } from "react";
 
 import { JournalId, journalIdFromString } from "@orbitinghail/sqlsync-worker";
+import { Match, Switch, createEffect } from "solid-js";
+import { createSignal } from "solid-js/types/server/reactive.js";
+import { SQLSyncProvider } from "../src";
 import { createDocHooks } from "../src/hooks";
 import { sql } from "../src/sql";
 import { DocType } from "../src/sqlsync";
@@ -31,42 +34,43 @@ const CounterDocType: DocType<CounterOps> = {
   serializeMutation: serializeMutationAsJSON,
 };
 
-const { useMutate, useQuery } = createDocHooks(CounterDocType);
+const [counterDocType, _setCounterDocType] = createSignal(CounterDocType);
+
+const { useMutate, useQuery } = createDocHooks(counterDocType);
 
 // biome-ignore lint/style/noNonNullAssertion: root is defined
-// ReactDOM.createRoot(document.getElementById("root")!).render(
-//   <React.StrictMode>
-//     <SQLSyncProvider wasmUrl={sqlSyncWasmUrl} workerUrl={workerUrl}>
-//       <App docId={DOC_ID} />
-//     </SQLSyncProvider>
-//   </React.StrictMode>,
-// );
+ReactDOM.createRoot(document.getElementById("root")!).render(
+  <React.StrictMode>
+    <SQLSyncProvider wasmUrl={sqlSyncWasmUrl} workerUrl={workerUrl}>
+      <App docId={DOC_ID} />
+    </SQLSyncProvider>
+  </React.StrictMode>
+);
 
 function App({ docId }: { docId: JournalId }) {
   const mutate = useMutate(docId);
 
-  useEffect(() => {
+  createEffect(() => {
     mutate({ tag: "InitSchema" }).catch((err) => {
       console.error("Failed to init schema", err);
     });
-  }, [mutate]);
+  });
 
-  const handleIncr = React.useCallback(() => {
+  const handleIncr = () => {
     mutate({ tag: "Incr", value: 1 }).catch((err) => {
       console.error("Failed to incr", err);
     });
-  }, [mutate]);
+  };
 
-  const handleDecr = React.useCallback(() => {
+  const handleDecr = () => {
     mutate({ tag: "Decr", value: 1 }).catch((err) => {
       console.error("Failed to decr", err);
     });
-  }, [mutate]);
+  };
 
-  const query = useQuery<{ value: number }>(
-    docId,
-    sql`select value, 'hi', 1.23, ${"foo"} as s from counter`
-  );
+
+  const query = useQuery<{ value: number }>(() => docId, () =>
+    sql`select value, 'hi', 1.23, ${"foo"} as s from counter`);
 
   return (
     <>
@@ -84,12 +88,22 @@ function App({ docId }: { docId: JournalId }) {
           Decr
         </button>
       </p>
-      {query.state === "pending" ? (
+      <Switch >
+        <Match when={query().state === "pending"}>
+
+        <pre>Loading...</pre>
+          </Match>
+        <Match when={query().state === "pending"}>
+
         <pre>Loading...</pre>
+          </Match>
+
+      </Switch>
+      {query().state === "pending" ? (
       ) : query.state === "error" ? (
-        <pre style={{ color: "red" }}>{query.error.message}</pre>
+        <pre style={{ color: "red" }}>{query().error.message}</pre>
       ) : (
-        <pre>{query.rows[0]?.value.toString()}</pre>
+        <pre>{query().rows?.[0]?.value.toString()}</pre>
       )}
     </>
   );
```

---

### Incident Patch 13: `a64ded75` (2024-01-04)
**Commit Message**: fixing deps

**File**: `pnpm-lock.yaml` (modified, +7/-7)
```diff
@@ -97,7 +97,7 @@ importers:
         specifier: ^3.14.0
         version: 3.14.0
 
-  examples/react:
+  examples/simple-counter-react:
     dependencies:
       '@orbitinghail/sqlsync-react':
         specifier: workspace:*
@@ -1889,8 +1889,8 @@ packages:
     engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
     hasBin: true
     dependencies:
-      caniuse-lite: 1.0.30001572
-      electron-to-chromium: 1.4.619
+      caniuse-lite: 1.0.30001574
+      electron-to-chromium: 1.4.620
       node-releases: 2.0.14
       update-browserslist-db: 1.0.13(browserslist@4.22.2)
     dev: true
@@ -1913,8 +1913,8 @@ packages:
     resolution: {integrity: sha512-N0ttd6TrFfuqKNi+pMgWJTb9qrdJu4JSpgPFLe/lrD19ugC6fZgF0pUewRowDwzdDnb9V41mFcdlYgl/PyKf4A==}
     dev: true
 
-  /caniuse-lite@1.0.30001572:
-    resolution: {integrity: sha512-1Pbh5FLmn5y4+QhNyJE9j3/7dK44dGB83/ZMjv/qJk86TvDbjk0LosiZo0i0WB0Vx607qMX9jYrn1VLHCkN4rw==}
+  /caniuse-lite@1.0.30001574:
+    resolution: {integrity: sha512-BtYEK4r/iHt/txm81KBudCUcTy7t+s9emrIaHqjYurQ10x71zJ5VQ9x1dYPcz/b+pKSp4y/v1xSI67A+LzpNyg==}
     dev: true
 
   /capnp-ts@0.7.0:
@@ -2016,8 +2016,8 @@ packages:
     resolution: {integrity: sha512-XbMoT6yIvg2xzcbs5hCADi0dXBh4//En3oFXmtPX+jiyyiCTiM9DGFT2SLottjpEs9Z8Mh8SqahbR96MaHfuSg==}
     dev: true
 
-  /electron-to-chromium@1.4.619:
-    resolution: {integrity: sha512-gW4qlnHxa49kp9kXlLdvnwdYEUlQRio30QOR61YfOQU8MaC/NGHWiJhyMMUl1EwFHbbzQTxvP1Dypdw95DjIow==}
+  /electron-to-chromium@1.4.620:
+    resolution: {integrity: sha512-a2fcSHOHrqBJsPNXtf6ZCEZpXrFCcbK1FBxfX3txoqWzNgtEDG1f3M59M98iwxhRW4iMKESnSjbJ310/rkrp0g==}
     dev: true
 
   /esbuild@0.17.19:
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -3,4 +3,4 @@ packages:
   - "demo/frontend"
   - "lib/sqlsync-react"
   - "lib/sqlsync-worker"
-  - "examples/react"
+  - "examples/simple-counter-react"
```

---

### Incident Patch 14: `0e8c7de7` (2024-01-04)
**Commit Message**: more testing and fixes

**File**: `CHANGELOG.md` (modified, +8/-1)
```diff
@@ -1,9 +1,16 @@
 This changelog documents changes across multiple projects contained in this monorepo. Each project is released for every SQLSync version, even if the project has not changed. The reason for this decision is to simplify testing and debugging. Lockstep versioning will be relaxed as SQLSync matures.
 
+# Pending Changes
+
+- Moved the majority of functionality from `sqlsync-react` to `sqlsync-worker` to make it easier to add additional JS framework support. ([#38])
+
 # 0.2.0 - Dec 1 2023
 
-- Reducer can now handle query errors (#29)
+- Reducer can now handle query errors ([#29])
 
 # 0.1.0 - Oct 23 2023
 
 - Initial release
+
+[#38]: https://github.com/orbitinghail/sqlsync/pull/38
+[#29]: https://github.com/orbitinghail/sqlsync/pull/29
```

**File**: `demo/frontend/src/main.tsx` (modified, +33/-2)
```diff
@@ -1,19 +1,27 @@
 import React from "react";
 import ReactDOM from "react-dom/client";
 
-import { RouterProvider, createBrowserRouter, redirect, useParams } from "react-router-dom";
+import {
+  RouterProvider,
+  createBrowserRouter,
+  redirect,
+  useParams,
+  useRouteError,
+} from "react-router-dom";
 
 import sqlSyncWasmUrl from "@orbitinghail/sqlsync-worker/sqlsync.wasm?url";
 import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?worker&url";
 
-import { MantineProvider } from "@mantine/core";
+import { Alert, Container, MantineProvider, Stack } from "@mantine/core";
 import { SQLSyncProvider } from "@orbitinghail/sqlsync-react";
 import { journalIdFromString, journalIdToString } from "@orbitinghail/sqlsync-worker";
 import { App } from "./App";
 
 import "@mantine/code-highlight/styles.css";
 // import stylesheets
 import "@mantine/core/styles.css";
+import { IconInfoCircle } from "@tabler/icons-react";
+import { Header } from "./components/Header";
 import { MANTINE_THEME } from "./theme";
 
 const isLocalhost = location.hostname === "localhost" || location.hostname.startsWith("192.168");
@@ -31,6 +39,9 @@ const newDocumentId = async (name = "") => {
   const response = await fetch(url, {
     method: "POST",
   });
+  if (!response.ok) {
+    throw new Error(`Failed to create new document: ${response.status}`);
+  }
   return journalIdFromString(await response.text());
 };
 
@@ -45,16 +56,35 @@ export const DocRoute = () => {
   return <App docId={journalIdFromString(docId)} />;
 };
 
+const ErrorBoundary = () => {
+  // biome-ignore lint/suspicious/noExplicitAny: could be thrown from anywhere
+  const error = useRouteError() as any;
+  console.error(error);
+  return (
+    <Container size="xs" py="sm">
+      <Stack>
+        <Header />
+        <Alert variant="light" color="red" title="Error" icon={<IconInfoCircle />}>
+          Failed to load document
+          {Object.prototype.hasOwnProperty.call(error, "message") ? `: ${error.message}` : ""}
+        </Alert>
+      </Stack>
+    </Container>
+  );
+};
+
 const router = createBrowserRouter([
   {
     path: "/",
+    errorElement: <ErrorBoundary />,
     loader: async () => {
       const docId = await newDocumentId();
       return redirect(`/${journalIdToString(docId)}`);
     },
   },
   {
     path: "/named/:name",
+    errorElement: <ErrorBoundary />,
     loader: async ({ params }) => {
       const docId = await newDocumentId(params.name);
       return redirect(`/${journalIdToString(docId)}`);
@@ -63,6 +93,7 @@ const router = createBrowserRouter([
   {
     path: "/:docId",
     element: <DocRoute />,
+    errorElement: <ErrorBoundary />,
   },
 ]);
 
```

**File**: `demo/frontend/tailwind.config.js` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-/** @type {import('tailwindcss').Config} */
-export default {
-  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
-  theme: {
-    extend: {},
-  },
-  plugins: [],
-};
```

**File**: `demo/frontend/tsconfig.json` (modified, +4/-2)
```diff
@@ -1,18 +1,20 @@
 {
   "compilerOptions": {
-    "target": "ESNext",
+    "target": "ES2020",
     "useDefineForClassFields": true,
-    "lib": ["ESNext", "DOM", "DOM.Iterable"],
+    "lib": ["ES2020", "ES2021.WeakRef", "DOM", "DOM.Iterable"],
     "module": "ESNext",
     "skipLibCheck": true,
     "types": ["vite/client"],
+
     /* Bundler mode */
     "moduleResolution": "bundler",
     "allowImportingTsExtensions": true,
     "resolveJsonModule": true,
     "isolatedModules": true,
     "noEmit": true,
     "jsx": "react-jsx",
+
     /* Linting */
     "strict": true,
     "noUnusedLocals": true,
```

**File**: `demo/frontend/tsconfig.node.json` (modified, +1/-1)
```diff
@@ -8,5 +8,5 @@
     "strict": true,
     "types": ["node"]
   },
-  "include": ["vite.config.ts", "tailwind.config.js", "vite-plugin-wasm.d.ts", "postcss.config.js"]
+  "include": ["vite.config.ts", "vite-plugin-wasm.d.ts", "postcss.config.js"]
 }
```

**File**: `demo/frontend/vite.config.ts` (modified, +1/-10)
```diff
@@ -1,16 +1,7 @@
 import react from "@vitejs/plugin-react";
-import { defineConfig, searchForWorkspaceRoot } from "vite";
+import { defineConfig } from "vite";
 
 // https://vitejs.dev/config/
 export default defineConfig({
   plugins: [react()],
-  server: {
-    fs: {
-      allow: [
-        searchForWorkspaceRoot(process.cwd()),
-        "../../target/wasm32-unknown-unknown/debug/demo_reducer.wasm",
-        "../../target/wasm32-unknown-unknown/release/demo_reducer.wasm",
-      ],
-    },
-  },
 });
```

**File**: `examples/simple-counter-react/package.json` (renamed, +4/-2)
```diff
@@ -1,10 +1,12 @@
 {
-  "name": "react",
+  "name": "simple-counter-react",
   "private": true,
   "version": "0.0.0",
   "type": "module",
   "scripts": {
-    "dev": "vite"
+    "dev": "vite",
+    "build": "tsc && vite build",
+    "preview": "vite preview"
   },
   "dependencies": {
     "react": "^18.2.0",
```

**File**: `examples/simple-counter-react/src/main.tsx` (renamed, +1/-1)
```diff
@@ -9,7 +9,7 @@ import {
   sql,
 } from "@orbitinghail/sqlsync-worker";
 import sqlSyncWasmUrl from "@orbitinghail/sqlsync-worker/sqlsync.wasm?url";
-import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?url";
+import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?worker&url";
 
 import { SQLSyncProvider, createDocHooks } from "@orbitinghail/sqlsync-react";
 
```

---

### Incident Patch 15: `f544d1c7` (2024-01-04)
**Commit Message**: fix demo frontend

**File**: `demo/frontend/src/components/TaskList.tsx` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 import { Center, Flex, Paper, Stack, Title } from "@mantine/core";
-import { sql } from "@orbitinghail/sqlsync-react";
-import { JournalId } from "@orbitinghail/sqlsync-worker";
+import { JournalId, sql } from "@orbitinghail/sqlsync-worker";
 import { useMutate, useQuery } from "../doctype";
 import { ConnectionStatus } from "./ConnectionStatus";
 import { TaskForm } from "./TaskForm";
```

**File**: `demo/frontend/src/doctype.ts` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
-import { DocType, createDocHooks, serializeMutationAsJSON } from "@orbitinghail/sqlsync-react";
+import { createDocHooks } from "@orbitinghail/sqlsync-react";
+import { DocType, serializeMutationAsJSON } from "@orbitinghail/sqlsync-worker";
 
 const REDUCER_URL = new URL(
   "../../../target/wasm32-unknown-unknown/release/demo_reducer.wasm",
```

**File**: `demo/frontend/src/main.tsx` (modified, +2/-4)
```diff
@@ -3,14 +3,12 @@ import ReactDOM from "react-dom/client";
 
 import { RouterProvider, createBrowserRouter, redirect, useParams } from "react-router-dom";
 
-// HACK: switch to the .ts version for nicer local dev
-// import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?url";
-import workerUrl from "@orbitinghail/sqlsync-worker/worker.js?url";
+import sqlSyncWasmUrl from "@orbitinghail/sqlsync-worker/sqlsync.wasm?url";
+import workerUrl from "@orbitinghail/sqlsync-worker/worker.ts?worker&url";
 
 import { MantineProvider } from "@mantine/core";
 import { SQLSyncProvider } from "@orbitinghail/sqlsync-react";
 import { journalIdFromString, journalIdToString } from "@orbitinghail/sqlsync-worker";
-import sqlSyncWasmUrl from "@orbitinghail/sqlsync-worker/sqlsync.wasm?url";
 import { App } from "./App";
 
 import "@mantine/code-highlight/styles.css";
```

#### Recent Merged Pull Requests:
- **PR #63** (2025-11-19): Updating dependencies, working build on rust 1.91 (@carlsverre)
- **PR #62** (closed): Update to rustc 1.91.1 (ed61e7d7e 2025-11-07) (@robotjsorg)
- **PR #61** (closed): Configure Renovate (@renovate[bot])
- **PR #60** (closed): Updating deps (@carlsverre)
- **PR #48** (2024-01-24): update npm & cargo deps (@carlsverre)
- **PR #43** (2024-01-06): Server-initiated mutations (@carlsverre)
- **PR #40** (2024-01-06): Introduce Reducer Trait (@matthewgapp)
- **PR #38** (2024-01-05): Refactor sqlsync react (@carlsverre)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
