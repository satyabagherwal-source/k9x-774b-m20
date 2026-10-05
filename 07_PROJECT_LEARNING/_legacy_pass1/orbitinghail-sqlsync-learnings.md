# Forensic Learning Record (Deep Inspection): orbitinghail/sqlsync

> **Canonical Artifact**: `07_PROJECT_LEARNING/orbitinghail-sqlsync-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/orbitinghail/sqlsync](https://github.com/orbitinghail/sqlsync))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:15:05.221Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `orbitinghail/sqlsync`
- **Description**: SQLSync is a collaborative offline-first wrapper around SQLite. It is designed to synchronize web application state between users, devices, and the edge.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 2915 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/cloudflare-backend/src/coordinator.rs`
```
use std::{
    collections::BTreeMap,
    io::{self, Cursor},
};

use anyhow::{anyhow, bail};
use futures::{
    channel::mpsc::{self},
    select_biased,
    stream::{repeat, SelectAll, SplitSink, SplitStream},
    FutureExt, SinkExt, StreamExt,
};
use gloo::net::websocket::{futures::WebSocket, Message, WebSocketError};
use gloo::timers::future::TimeoutFuture;
use sqlsync::{
    coordinator::CoordinatorDocument,
    replication::{ReplicationMsg, ReplicationProtocol, ReplicationSource},
    MemoryJournal, MemoryJournalFactory, WasmReducer,
};
use worker::{console_error, console_log, Error, State};

use crate::{object_id_to_journal_id, persistence::Persistence};

type Document = CoordinatorDocument<MemoryJournal, WasmReducer>;

pub struct Coordinator {
    accept_queue: mpsc::Sender<WebSocket>,
}

impl Coordinator {
    pub async fn init(
        state: &State,
        reducer_bytes: Vec<u8>,
    ) -> worker::Result<(Coordinator, CoordinatorTask)> {
        let id = object_id_to_journal_id(state.id())?;
        let (accept_queue_tx, accept_queue_rx) = mpsc::channel(10);

        console_log!("creating new document with id {}", id);

        let mut storage = MemoryJournal::open(id).map_err(|e| Error::RustError(e.to_string()))?;

        // load the persistence layer
        let persistence = Persistence::init(state.storage()).await?;
        // replay any persisted frames into storage
        persistence.replay(id, &mut storage).await?;

        let doc = CoordinatorDocument::open(
            storage,
            MemoryJournalFactory,
            WasmReducer::new(reducer_bytes.as_slice())
                .map_err(|e| Error::RustError(e.to_string()))?,
        )
        .map_err(|e| Error::RustError(e.to_string()))?;

        Ok((
            Self { accept_queue: accept_queue_tx },
            CoordinatorTask {
                accept_queue: accept_queue_rx,
                persistence,
                doc,
            },
        ))
    }

    pub async fn accept(&mut self, socket: WebSocket) -> anyhow::Result<()> {
        Ok(self.accept_queue.send(socket).await?)
    }
}

pub struct CoordinatorTask {
    accept_queue: mpsc::Receiver<WebSocket>,
    persistence: Persistence,
    doc: Document,
}

impl CoordinatorTask {
    // into_task consumes the Coordinator and runs it as a task
    pub async fn into_task(mut self) {
        let mut clients: BTreeMap<usize, Client> = BTreeMap::new();
        let mut messages = SelectAll::new();
        let mut next_client_idx = 0;

        const STEP_MIN_MS: u32 = 100;
        let mut step_trigger = TimeoutFuture::new(STEP_MIN_MS).fuse();

        // NOTE TO CODE REVIEWERS:
        // `select_biased!` is full of foot guns (see: [1] and [2])
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
            select_biased! {
                // handle steps
                _ = step_trigger => {
                    // apply any pending changes to the document
                    if let Err(e) = self.step().await {
                        console_error!("error stepping: {:?}", e);
                        continue;
                    }

                    // persist document state to storage
                    if let Err(e) = self.persist().await {
                        console_error!("error persisting: {:?}", e);
                        continue;
                    }

                    // sync all clients
                    for (_, client) in clients.iter_mut() {
                        if let Err(e) = client.sync(&self.doc).await {
                            console_error!("error syncing: {:?}", e);
                            continue;
                        }
                    }
                },

                // handle new clients
                socket = self.accept_queue.select_next_some() => {
                    let (mut client, reader) = Client::init(socket);
                    if let Err(e) = client.start_replication(&self.doc).await {
                        console_error!("error starting replication: {:?}", e);
                        continue;
                    }
                    next_client_idx += 1;
                    let client_idx = next_client_idx;
                    clients.insert(client_idx, client);
                    messages.push(repeat(client_idx).zip(reader));
                },

                // handle messages from clients
                (client_idx, msg) = messages.select_next_some() => {
                    let client = match clients.get_mut(&client_idx) {
                        Some(client ) => client,
                        None => {
                            console_error!("received message from unknown client {}", client_idx);
                            continue;
                        }
                    };
                    if let Err(e) = client.handle_message(&mut self.doc, msg).await {
                        console_error!("error handling message from client {}: {:?}", client_idx, e);
                        // remove client; note, we don't have to remove the
                        // reader from messages because SelectAll handles that
                        // automatically
                        clients.remove(&client_idx);
                    } else {
                        // schedule a step whenever we receive messages from a client
                        step_trigger = TimeoutFuture::new(STEP_MIN_MS).fuse();
                    }
                },
            }
        }
    }

    async fn step(&mut self) -> anyhow::Result<()> {
        while self.doc.has_pending_work() {
            self.doc.step()?;
        }

        Ok(())
    }

    async fn persist(&mut self) -> anyhow::Result<()> {
        let mut next_lsn = self.persistence.expected_lsn();
        while let Some(frame) = self.doc.read_lsn(next_lsn)? {
            self.persistence
                .write_lsn(next_lsn, frame.to_owned())
                .await
                .map_err(|e| anyhow!(e.to_string()))?;
            next_lsn = self.persistence.expected_lsn();
        }

        Ok(())
    }
}

struct Client {
    protocol: ReplicationProtocol,
    writer: SplitSink<WebSocket, Message>,
}

impl Client {
    fn init(socket: WebSocket) -> (Self, SplitStream<WebSocket>) {
        let (writer, reader) = socket.split();
        let protocol = ReplicationProtocol::new();
        (Self { protocol, writer }, reader)
    }

    async fn start_replication(&mut self, doc: &Document) -> anyhow::Result<()> {
        let msg = self.protocol.start(doc);
        self.send_msg(msg).await
    }

    async fn sync(&mut self, doc: &Document) -> anyhow::Result<()> {
        while let Some((msg, mut frame)) = self.protocol.sync(doc)? {
            console_log!("sending message {:?}", msg);
            let mut buf = Cursor::new(vec![]);
            bincode::serialize_into(&mut buf, &msg)?;
            io::copy(&mut frame, &mut buf)?;
            self.writer.send(Message::Bytes(buf.into_inner())).await?;
        }

        Ok(())
    }

    async fn send_msg(&mut self, msg: ReplicationMsg) -> anyhow::Result<()> {
        let data = bincode::serialize(&msg)?;
        console_log!("sending message {:?}", msg);
        Ok(self.writer.send(Message::Bytes(data)).await?)
    }

    async fn handle_message(
        &mut self,
        doc: &mut Document,
        msg: Result<Message, WebSocketError>,
    ) -> anyhow::Result<()> {
        match msg {
            Ok(Messag
```

### Core Architecture Module: `demo/cloudflare-backend/src/lib.rs`
```
#![allow(clippy::await_holding_refcell_ref)]

use std::cell::RefCell;

use coordinator::Coordinator;
use js_sys::{ArrayBuffer, Reflect, Uint8Array};
use sqlsync::JournalId;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::{spawn_local, JsFuture};
use worker::*;

mod coordinator;
mod persistence;

pub const DURABLE_OBJECT_NAME: &str = "COORDINATOR";
pub const REDUCER_BUCKET: &str = "SQLSYNC_REDUCERS";

#[durable_object]
pub struct DocumentCoordinator {
    state: State,
    env: Env,
    coordinator: RefCell<Option<Coordinator>>,
}

impl DurableObject for DocumentCoordinator {
    fn new(state: State, env: Env) -> Self {
        console_error_panic_hook::set_once();
        Self {
            state,
            env,
            coordinator: RefCell::new(None),
        }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        // check that the Upgrade header is set and == "websocket"
        let is_upgrade_req = req.headers().get("Upgrade")?.unwrap_or("".into()) == "websocket";
        if !is_upgrade_req {
            return Response::error("Bad Request", 400);
        }

        // initialize the coordinator if it hasn't been initialized yet
        if self.coordinator.borrow().is_none() {
            // retrieve the reducer digest from the request url
            let url = req.url()?;
            let reducer_digest = match url.query_pairs().find(|(k, _)| k == "reducer") {
                Some((_, v)) => v,
                None => return Response::error("Bad Request", 400),
            };
            let bucket = self.env.bucket(REDUCER_BUCKET)?;
            let object = bucket
                .get(format!("{}.wasm", reducer_digest))
                .execute()
                .await?;
            let reducer_bytes = match object {
                Some(object) => {
                    object
                        .body()
                        .ok_or_else(|| Error::RustError("reducer not found in bucket".to_string()))?
                        .bytes()
                        .await?
                }
                None => {
                    return Response::error(
                        format!("reducer {} not found in bucket", reducer_digest),
                        404,
                    )
                }
            };

            let (coordinator, task) = Coordinator::init(&self.state, reducer_bytes).await?;
            spawn_local(task.into_task());
            *self.coordinator.borrow_mut() = Some(coordinator);
        }

        let mut borrow = self.coordinator.borrow_mut();
        let coordinator = borrow.as_mut().unwrap();

        let pair = WebSocketPair::new()?;
        let ws = pair.server;
        ws.accept()?;

        if let Err(e) = coordinator
            .accept(ws.as_ref().clone().try_into().unwrap())
            .await
        {
            // the only case we get an error here is if the coordinator task has
            // somehow crashed and thus the Sender is disconnected
            panic!("failed to accept websocket: {:?}", e);
        }

        Response::from_websocket(pair.client)
    }
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();
    let cors = Cors::default().with_origins(vec!["*"]);

    let router = Router::new();

    router
        .put_async("/reducer", |req, ctx| async move {
            // upload a reducer to the bucket
            let bucket = ctx.bucket(REDUCER_BUCKET)?;

            let data_len: u64 = match req.headers().get("Content-Length")?.map(|s| s.parse()) {
                Some(Ok(len)) => len,
                _ => return Response::error("Bad Request", 400),
            };
            if data_len > 10 * 1024 * 1024 {
                return Response::error("Payload Too Large", 413);
            }

            // let mut data = req.bytes().await?;
            let data = JsFuture::from(req.inner().array_buffer()?)
                .await?
                .dyn_into::<ArrayBuffer>()
                .expect("expected ArrayBuffer");

            let actual_data_len = data.byte_length() as u64;
            if actual_data_len != data_len {
                return Response::error("Bad Request", 400);
            }

            let global = js_sys::global()
                .dyn_into::<js_sys::Object>()
                .expect("global not found");
            let subtle = Reflect::get(&global, &"crypto".into())?
                .dyn_into::<web_sys::Crypto>()
                .expect("crypto not found")
                .subtle();

            // sha256 sum the data and convert to bs58
            let digest =
                JsFuture::from(subtle.digest_with_str_and_buffer_source("SHA-256", &data)?).await?;

            // convert digest to base58
            let digest = bs58::encode(Uint8Array::new(&digest).to_vec())
                .with_alphabet(bs58::Alphabet::BITCOIN)
                .into_string();
            let name = format!("{}.wasm", digest);

            console_log!(
                "uploading reducer (size: {} MB) to {}",
                (actual_data_len as f64) / 1024. / 1024.,
                name
            );

            // read data into Vec<u8>
            let data = Uint8Array::new(&data).to_vec();

            bucket.put(&name, data).execute().await?;
            Response::ok(name)
        })
        .on_async("/new", |_req, ctx| async move {
            let namespace = ctx.durable_object(DURABLE_OBJECT_NAME)?;
            let id = namespace.unique_id()?;
            let id = object_id_to_journal_id(id)?;
            console_log!("creating new document with id {}", id);
            Response::ok(id.to_base58())
        })
        .on_async("/new/:name", |_req, ctx| async move {
            if let Some(name) = ctx.param("name") {
                let namespace = ctx.durable_object(DURABLE_OBJECT_NAME)?;
                // until SQLSync is stable, named doc resolution will periodically break when we increment this counter
                let id = namespace.id_from_name(&format!("sqlsync-1-{}", name))?;
                let id = object_id_to_journal_id(id)?;
                Response::ok(id.to_base58())
            } else {
                Response::error("Bad Request", 400)
            }
        })
        .on_async("/doc/:id", |req, ctx| async move {
            if let Some(id) = ctx.param("id") {
                console_log!("forwarding request to document with id: {}", id);
                let namespace = ctx.durable_object(DURABLE_OBJECT_NAME)?;
                let id = JournalId::from_base58(id).map_err(|e| Error::RustError(e.to_string()))?;
                let id = match namespace.id_from_string(&id.to_hex()) {
                    Ok(id) => id,
                    Err(e) => {
                        return Response::error(format!("Invalid Durable Object ID: {}", e), 400)
                    }
                };
                let stub = id.get_stub()?;
                stub.fetch_with_request(req).await
            } else {
                Response::error("Bad Request", 400)
            }
        })
        .run(req, env)
        .await?
        .with_cors(&cors)
}

pub fn object_id_to_journal_id(id: ObjectId) -> Result<JournalId> {
    JournalId::from_hex(&id.to_string()).map_err(|e| e.to_string().into())
}

```

### Core Architecture Module: `demo/cloudflare-backend/src/persistence.rs`
```
use std::io::Cursor;

use js_sys::Uint8Array;
use sqlsync::{replication::ReplicationDestination, JournalId, Lsn, LsnRange};
use wasm_bindgen::JsValue;
use worker::*;

const RANGE_KEY: &str = "RANGE";

pub struct Persistence {
    /// The range of lsns that have been written to storage
    range: LsnRange,
    storage: Storage,
}

impl Persistence {
    pub async fn init(storage: Storage) -> Result<Self> {
        let range = match storage.get::<LsnRange>(RANGE_KEY).await {
            Ok(range) => range,
            Err(_) => {
                let range = LsnRange::empty();
                storage.put(RANGE_KEY, &range).await?;
                range
            }
        };
        Ok(Self { range, storage })
    }

    /// the next lsn that should be written to storage
    pub fn expected_lsn(&self) -> Lsn {
        self.range.next()
    }

    pub async fn write_lsn(&mut self, lsn: Lsn, frame: Vec<u8>) -> Result<()> {
        let obj = js_sys::Object::new();

        // get the new range, assuming the write goes through
        let new_range = self.range.append(lsn);

        // convert our range into a jsvalue
        let range = serde_wasm_bindgen::to_value(&new_range)
            .map_err(|e| Error::RustError(e.to_string()))?;

        js_sys::Reflect::set(&obj, &JsValue::from_str(RANGE_KEY), &range)?;

        // convert frame into a uint8array
        let uint8_array = Uint8Array::from(frame.as_slice());
        let key = format!("lsn-{}", lsn);
        js_sys::Reflect::set(&obj, &JsValue::from_str(&key), &uint8_array)?;

        // write to storage
        self.storage.put_multiple_raw(obj).await?;

        // update our in-memory range
        self.range = new_range;
        Ok(())
    }

    pub async fn replay<T: ReplicationDestination>(
        &self,
        id: JournalId,
        dest: &mut T,
    ) -> Result<()> {
        for lsn in 0..self.range.next() {
            console_log!("replaying lsn {}", lsn);
            let key = format!("lsn-{}", lsn);
            let mut frame = Cursor::new(self.storage.get::<serde_bytes::ByteBuf>(&key).await?);
            dest.write_lsn(id, lsn, &mut frame)
                .map_err(|e| Error::RustError(e.to_string()))?;
        }
        Ok(())
    }
}

```

### Core Architecture Module: `demo/demo-reducer/src/lib.rs`
```
// build: "cargo build --target wasm32-unknown-unknown -p demo-reducer --release"

use serde::Deserialize;
use sqlsync_reducer::{execute, init_reducer, types::ReducerError};

#[derive(Deserialize, Debug)]
#[serde(tag = "tag")]
enum Mutation {
    InitSchema,

    CreateTask { id: String, description: String },

    DeleteTask { id: String },

    ToggleCompleted { id: String },
}

init_reducer!(reducer);
async fn reducer(mutation: Vec<u8>) -> Result<(), ReducerError> {
    let mutation: Mutation = serde_json::from_slice(&mutation[..])?;

    match mutation {
        Mutation::InitSchema => {
            execute!(
                "CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    description TEXT NOT NULL,
                    completed BOOLEAN NOT NULL,
                    created_at TEXT NOT NULL
                )"
            )
            .await?;
        }

        Mutation::CreateTask { id, description } => {
            log::debug!("appending task({}): {}", id, description);
            execute!(
                "insert into tasks (id, description, completed, created_at)
                    values (?, ?, false, datetime('now'))",
                id,
                description
            )
            .await?;
        }

        Mutation::DeleteTask { id } => {
            execute!("delete from tasks where id = ?", id).await?;
        }

        Mutation::ToggleCompleted { id } => {
            execute!(
                "update tasks set completed = not completed where id = ?",
                id
            )
            .await?;
        }
    }

    Ok(())
}

```

### Core Architecture Module: `demo/frontend/postcss.config.js`
```
export default {
  plugins: {
    "postcss-preset-mantine": {},
  },
};

```

### Core Architecture Module: `demo/frontend/src/App.tsx`
```
import { Container, Stack } from "@mantine/core";
import { JournalId } from "@orbitinghail/sqlsync-worker";
import { useEffect } from "react";
import { Header } from "./components/Header";
import { QueryViewer } from "./components/QueryViewer";
import { TaskList } from "./components/TaskList";
import { useMutate } from "./doctype";

export const App = ({ docId }: { docId: JournalId }) => {
  const mutate = useMutate(docId);

  useEffect(() => {
    mutate({ tag: "InitSchema" }).catch((err) => {
      console.error("Failed to init schema", err);
    });
  }, [mutate]);

  return (
    <Container size="xs" py="sm">
      <Stack>
        <Header />
        <TaskList docId={docId} />
        <QueryViewer docId={docId} />
      </Stack>
    </Container>
  );
};

```

### Core Architecture Module: `demo/frontend/src/components/ConnectionStatus.tsx`
```
import { Button, rem } from "@mantine/core";
import { useConnectionStatus } from "@orbitinghail/sqlsync-react";
import { JournalId } from "@orbitinghail/sqlsync-worker";
import { IconWifi, IconWifiOff } from "@tabler/icons-react";
import { ReactElement, useCallback } from "react";
import { useSetConnectionEnabled } from "../doctype";

export const ConnectionStatus = ({ docId }: { docId: JournalId }) => {
  const status = useConnectionStatus();
  const setConnectionEnabled = useSetConnectionEnabled(docId);

  const handleClick = useCallback(() => {
    if (status === "disabled") {
      setConnectionEnabled(true).catch((err) => {
        console.error("Failed to enable connection", err);
      });
    } else {
      setConnectionEnabled(false).catch((err) => {
        console.error("Failed to disable connection", err);
      });
    }
  }, [status, setConnectionEnabled]);

  let color: string,
    icon: ReactElement | undefined,
    loading = false;
  switch (status) {
    case "disabled":
      color = "gray";
      icon = <IconWifiOff style={{ width: rem(16), height: rem(16) }} />;
      break;
    case "disconnected":
      color = "gray";
      icon = <IconWifiOff style={{ width: rem(16), height: rem(16) }} />;
      break;
    case "connecting":
      color = "yellow";
      loading = true;
      break;
    case "connected":
      color = "green";
      icon = <IconWifi style={{ width: rem(16), height: rem(16) }} />;
      break;
  }

  return (
    <Button
      variant="light"
      color={color}
      rightSection={icon}
      loading={loading}
      onClick={handleClick}
      size="compact-md"
    >
      {status}
    </Button>
  );
};

```

### Core Architecture Module: `demo/frontend/src/components/Header.tsx`
```
import {
  ActionIcon,
  Anchor,
  Center,
  Flex,
  Paper,
  Popover,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconQrcode } from "@tabler/icons-react";
import GitHubButton from "react-github-btn";
import QRCode from "react-qr-code";

const SQLSYNC_URL = "https://sqlsync.dev";

export const Header = () => {
  return (
    <>
      <Paper component={Stack} shadow="xs" p="xs" gap="sm">
        <Flex gap="sm">
          <Center component={Title} style={{ flex: 1, justifyContent: "left" }} order={4}>
            SQLSync Demo
          </Center>
          <GitHubButton
            href="https://github.com/orbitinghail/sqlsync"
            data-show-count="true"
            data-size="large"
            aria-label="Star orbitinghail/sqlsync on GitHub"
          >
            Star
          </GitHubButton>
          <Popover withArrow position="bottom">
            <Popover.Target>
              <ActionIcon>
                <IconQrcode />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <QRCode value={document.location.href} />
            </Popover.Dropdown>
          </Popover>
        </Flex>
        <Text>
          <Anchor href={SQLSYNC_URL}>SQLSync</Anchor> is a collaborative offline-first wrapper
          around SQLite. It is designed to synchronize web application state between users, devices,
          and the edge.
        </Text>
      </Paper>
    </>
  );
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
 
+  /@babel/helper-skip-transparent-expression-wrappers
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
+      '@babel/
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
