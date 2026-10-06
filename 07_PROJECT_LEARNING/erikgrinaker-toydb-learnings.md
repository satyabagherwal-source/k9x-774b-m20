# Forensic Learning Record (Deep Inspection): erikgrinaker/toydb

> **Canonical Artifact**: `07_PROJECT_LEARNING/erikgrinaker-toydb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/erikgrinaker/toydb](https://github.com/erikgrinaker/toydb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:22.868Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `erikgrinaker/toydb`
- **Description**: Distributed SQL database in Rust, written as an educational project
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/raft/state.rs`
```
use super::{Entry, Index};
use crate::error::Result;

/// A Raft-managed state machine. Raft itself does not care what the state
/// machine is, nor what the commands and results do -- it will simply apply
/// arbitrary binary commands sequentially from the Raft log, returning an
/// arbitrary binary result to the client.
///
/// Since commands are applied identically across all nodes, they must be
/// deterministic and yield the same state and result across all nodes too.
/// Otherwise, the nodes will diverge, such that different nodes will produce
/// different results.
///
/// Write commands (`Request::Write`) are replicated and applied on all nodes
/// via `State::apply`. The state machine must keep track of the last applied
/// index and return it via `State::get_applied_index`. Read commands
/// (`Request::Read`) are only executed on a single node via `State::read` and
/// must not make any state changes.
pub trait State: Send {
    /// Returns the last applied log index from the state machine.
    ///
    /// This must correspond to the current state of the state machine, since it
    /// determines which command to apply next. In particular, a node crash may
    /// result in partial command application or data loss, which must be
    /// handled appropriately.
    fn get_applied_index(&self) -> Index;

    /// Applies a log entry to the state machine, returning a client result.
    /// Errors are considered applied and propagated back to the client.
    ///
    /// This is executed on all nodes, so the result must be deterministic: it
    /// must yield the same state and result on all nodes, even if the command
    /// is reapplied following a node crash.
    ///
    /// Any non-deterministic apply error (e.g. an IO error) must panic and
    /// crash the node -- if it instead returns an error to the client, the
    /// command is considered applied and node states will diverge. The state
    /// machine is responsible for panicing when appropriate.
    ///
    /// The entry may contain a noop command, which is committed by Raft during
    /// leader changes. This still needs to be applied to the state machine to
    /// properly update the applied index, and should return an empty result.
    fn apply(&mut self, entry: Entry) -> Result<Vec<u8>>;

    /// Executes a read command in the state machine, returning a client result.
    /// Errors are also propagated back to the client.
    ///
    /// This is only executed on a single node, so it must not result in any
    /// state changes (i.e. it must not write).
    fn read(&self, command: Vec<u8>) -> Result<Vec<u8>>;
}

/// Test helper state machines.
#[cfg(test)]
pub mod test {
    use std::collections::BTreeMap;
    use std::fmt::Display;

    use crossbeam::channel::Sender;
    use itertools::Itertools as _;
    use serde::{Deserialize, Serialize};

    use super::*;
    use crate::encoding::{self, Value as _};

    /// Wraps a state machine and emits applied entries to the provided channel.
    pub struct Emit {
        inner: Box<dyn State>,
        tx: Sender<Entry>,
    }

    impl Emit {
        pub fn new(inner: Box<dyn State>, tx: Sender<Entry>) -> Box<Self> {
            Box::new(Self { inner, tx })
        }
    }

    impl State for Emit {
        fn get_applied_index(&self) -> Index {
            self.inner.get_applied_index()
        }

        fn apply(&mut self, entry: Entry) -> Result<Vec<u8>> {
            let response = self.inner.apply(entry.clone())?;
            self.tx.send(entry)?;
            Ok(response)
        }

        fn read(&self, command: Vec<u8>) -> Result<Vec<u8>> {
            self.inner.read(command)
        }
    }

    /// A simple string key/value store. Takes KVCommands.
    pub struct KV {
        applied_index: Index,
        data: BTreeMap<String, String>,
    }

    impl KV {
        pub fn new() -> Box<Self> {
            Box::new(Self { applied_index: 0, data: BTreeMap::new() })
        }
    }

    impl State for KV {
        fn get_applied_index(&self) -> Index {
            self.applied_index
        }

        fn apply(&mut self, entry: Entry) -> Result<Vec<u8>> {
            let command = entry.command.as_deref().map(KVCommand::decode).transpose()?;
            let response = match command {
                Some(KVCommand::Put { key, value }) => {
                    self.data.insert(key, value);
                    KVResponse::Put(entry.index).encode()
                }
                Some(c @ (KVCommand::Get { .. } | KVCommand::Scan)) => {
                    panic!("{c} submitted as write command")
                }
                None => Vec::new(),
            };
            self.applied_index = entry.index;
            Ok(response)
        }

        fn read(&self, command: Vec<u8>) -> Result<Vec<u8>> {
            match KVCommand::decode(&command)? {
                KVCommand::Get { key } => {
                    Ok(KVResponse::Get(self.data.get(&key).cloned()).encode())
                }
                KVCommand::Scan => Ok(KVResponse::Scan(self.data.clone()).encode()),
                c @ KVCommand::Put { .. } => panic!("{c} submitted as read command"),
            }
        }
    }

    /// A KV command. Returns the corresponding KVResponse.
    #[derive(Serialize, Deserialize)]
    pub enum KVCommand {
        /// Fetches the value of the given key.
        Get { key: String },
        /// Stores the given key/value pair, returning the applied index.
        Put { key: String, value: String },
        /// Returns all key/value pairs.
        Scan,
    }

    impl encoding::Value for KVCommand {}

    impl Display for KVCommand {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                Self::Get { key } => write!(f, "get {key}"),
                Self::Put { key, value } => write!(f, "put {key}={value}"),
                Self::Scan => write!(f, "scan"),
            }
        }
    }

    /// A KVCommand response.
    #[derive(Serialize, Deserialize)]
    pub enum KVResponse {
        /// Get returns the key's value, or None if it does not exist.
        Get(Option<String>),
        /// Put returns the applied index of the command.
        Put(Index),
        /// Scan returns the key/value pairs.
        Scan(BTreeMap<String, String>),
    }

    impl encoding::Value for KVResponse {}

    impl Display for KVResponse {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                Self::Get(Some(value)) => write!(f, "{value}"),
                Self::Get(None) => write!(f, "None"),
                Self::Put(applied_index) => write!(f, "{applied_index}"),
                Self::Scan(kvs) => {
                    write!(f, "{}", kvs.iter().map(|(k, v)| format!("{k}={v}")).join(","))
                }
            }
        }
    }

    /// A state machine which does nothing. All commands are ignored.
    pub struct Noop {
        applied_index: Index,
    }

    impl Noop {
        pub fn new() -> Box<Self> {
            Box::new(Self { applied_index: 0 })
        }
    }

    impl State for Noop {
        fn get_applied_index(&self) -> Index {
            self.applied_index
        }

        fn apply(&mut self, entry: Entry) -> Result<Vec<u8>> {
            self.applied_index = entry.index;
            Ok(Vec::new())
        }

        fn read(&self, _: Vec<u8>) -> Result<Vec<u8>> {
            Ok(Vec::new())
        }
    }
}

```

### Core Architecture Module: `src/sql/engine/engine.rs`
```
use std::collections::{BTreeMap, BTreeSet};

use crate::errinput;
use crate::error::Result;
use crate::sql::execution::Session;
use crate::sql::types::{Expression, Row, Rows, Table, Value};
use crate::storage::mvcc;

/// A SQL engine. This provides low-level CRUD (create, read, update, delete)
/// operations for table rows, a schema catalog for accessing and modifying
/// table schemas, and interactive SQL sessions that execute client SQL
/// statements. All engine access is transactional with snapshot isolation.
pub trait Engine<'a>: Sized {
    /// The engine's transaction type. This provides both row-level CRUD operations and
    /// transactional access to the schema catalog.
    type Transaction: Transaction + 'a;

    /// Begins a read-write transaction.
    fn begin(&'a self) -> Result<Self::Transaction>;
    /// Begins a read-only transaction.
    fn begin_read_only(&'a self) -> Result<Self::Transaction>;
    /// Begins a read-only transaction as of a historical version.
    fn begin_as_of(&'a self, version: mvcc::Version) -> Result<Self::Transaction>;

    /// Creates a client session for executing SQL statements.
    fn session(&'a self) -> Session<'a, Self> {
        Session::new(self)
    }
}

/// A SQL transaction. Executes transactional CRUD operations on table rows.
/// Provides snapshot isolation (see `storage::mvcc` module for details).
///
/// All methods operate on row batches rather than single rows to amortize the
/// cost. With the Raft engine, each call results in a Raft roundtrip, and we'd
/// rather not have to do that for every single row that's modified.
pub trait Transaction: Catalog {
    /// The transaction's internal MVCC state.
    fn state(&self) -> &mvcc::TransactionState;

    /// Commits the transaction.
    fn commit(self) -> Result<()>;
    /// Rolls back the transaction.
    fn rollback(self) -> Result<()>;

    /// Deletes table rows by primary key, if they exist.
    fn delete(&self, table: &str, ids: &[Value]) -> Result<()>;
    /// Fetches table rows by primary key, if they exist.
    fn get(&self, table: &str, ids: &[Value]) -> Result<Vec<Row>>;
    /// Inserts new table rows.
    fn insert(&self, table: &str, rows: Vec<Row>) -> Result<()>;
    /// Looks up a set of primary keys by index values. BTreeSet for testing.
    fn lookup_index(&self, table: &str, column: &str, values: &[Value]) -> Result<BTreeSet<Value>>;
    /// Scans a table's rows, optionally applying the given filter.
    fn scan(&self, table: &str, filter: Option<Expression>) -> Result<Rows>;
    /// Updates table rows by primary key. BTreeMap for testing.
    fn update(&self, table: &str, rows: BTreeMap<Value, Row>) -> Result<()>;
}

/// The catalog stores table schema information. It must be implemented for
/// Transaction, and is thus fully transactional. For simplicity, it only
/// supports creating and dropping tables -- there are no ALTER TABLE schema
/// changes, nor CREATE INDEX.
pub trait Catalog {
    /// Creates a new table. Errors if it already exists.
    fn create_table(&self, table: Table) -> Result<()>;
    /// Drops a table. Errors if it does not exist, unless if_exists is true.
    /// Returns true if the table existed and was deleted.
    fn drop_table(&self, table: &str, if_exists: bool) -> Result<bool>;
    /// Fetches a table schema, or None if it doesn't exist.
    fn get_table(&self, table: &str) -> Result<Option<Table>>;
    /// Returns a list of all table schemas.
    fn list_tables(&self) -> Result<Vec<Table>>;

    /// Fetches a table schema, or errors if it does not exist.
    fn must_get_table(&self, table: &str) -> Result<Table> {
        self.get_table(table)?.ok_or_else(|| errinput!("table {table} does not exist"))
    }
}

```

### Core Architecture Module: `src/sql/engine/local.rs`
```
use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet};
use std::slice;

use itertools::Itertools as _;
use serde::{Deserialize, Serialize};

use super::Catalog;
use crate::encoding::{self, Key as _, Value as _};
use crate::errinput;
use crate::error::Result;
use crate::sql::types::{Expression, Row, Rows, Table, Value};
use crate::storage::{self, mvcc};

/// SQL engine keys, using the Keycode order-preserving encoding. For
/// simplicity, table and column names are used directly as identifiers, instead
/// of e.g. numeric IDs. It is not possible to change table/column names, so
/// this is fine, if somewhat inefficient.
///
/// Uses Cow to allow encoding borrowed values but decoding owned values.
#[derive(Debug, Deserialize, Serialize)]
pub enum Key<'a> {
    /// A table schema, keyed by table name. The value is a `sql::types::Table`.
    Table(Cow<'a, str>),
    /// A column index entry, keyed by table name, column name, and index value.
    /// The value is a `BTreeSet` of `sql::types::Value` primary key values.
    Index(Cow<'a, str>, Cow<'a, str>, Cow<'a, Value>),
    /// A table row, keyed by table name and primary key value. The value is a
    /// `sql::types::Row`.
    Row(Cow<'a, str>, Cow<'a, Value>),
}

impl<'a> encoding::Key<'a> for Key<'a> {}

/// Key prefixes, allowing prefix scans of specific parts of the keyspace. These
/// must match the keys -- in particular, the enum variant indexes must match,
/// since it's part of the encoded key.
#[derive(Deserialize, Serialize)]
enum KeyPrefix<'a> {
    /// All table schemas.
    Table,
    /// All column index entries, keyed by table and column name.
    Index(Cow<'a, str>, Cow<'a, str>),
    /// All table rows, keyed by table name.
    Row(Cow<'a, str>),
}

impl<'a> encoding::Key<'a> for KeyPrefix<'a> {}

/// A SQL engine using local storage. This provides the main SQL storage logic.
/// The Raft SQL engine dispatches to this for node-local SQL storage, executing
/// the same writes across each nodes' instance of `Local`.
pub struct Local<E: storage::Engine + 'static> {
    /// The local MVCC storage engine.
    pub mvcc: mvcc::MVCC<E>,
}

impl<E: storage::Engine> Local<E> {
    /// Creates a new local SQL engine using the given storage engine.
    pub fn new(engine: E) -> Self {
        Self { mvcc: mvcc::MVCC::new(engine) }
    }

    /// Resumes a transaction from the given state. This is usually kept within
    /// `mvcc::Transaction`, but the Raft-based engine can't retain the MVCC
    /// transaction across requests since it may be executed on different leader
    /// nodes, so it instead keeps the state client-side in the session.
    pub fn resume(&self, state: mvcc::TransactionState) -> Result<Transaction<E>> {
        Ok(Transaction::new(self.mvcc.resume(state)?))
    }

    /// Gets an unversioned key, or None if it doesn't exist.
    pub fn get_unversioned(&self, key: &[u8]) -> Result<Option<Vec<u8>>> {
        self.mvcc.get_unversioned(key)
    }

    /// Sets an unversioned key.
    pub fn set_unversioned(&self, key: &[u8], value: Vec<u8>) -> Result<()> {
        self.mvcc.set_unversioned(key, value)
    }
}

impl<E: storage::Engine> super::Engine<'_> for Local<E> {
    type Transaction = Transaction<E>;

    fn begin(&self) -> Result<Self::Transaction> {
        Ok(Self::Transaction::new(self.mvcc.begin()?))
    }

    fn begin_read_only(&self) -> Result<Self::Transaction> {
        Ok(Self::Transaction::new(self.mvcc.begin_read_only()?))
    }

    fn begin_as_of(&self, version: mvcc::Version) -> Result<Self::Transaction> {
        Ok(Self::Transaction::new(self.mvcc.begin_as_of(version)?))
    }
}

/// A SQL transaction, wrapping an MVCC transaction.
pub struct Transaction<E: storage::Engine + 'static> {
    txn: mvcc::Transaction<E>,
}

impl<E: storage::Engine> Transaction<E> {
    /// Creates a new SQL transaction using the given MVCC transaction.
    fn new(txn: mvcc::Transaction<E>) -> Self {
        Self { txn }
    }

    /// Returns the transaction's internal state.
    pub fn state(&self) -> &mvcc::TransactionState {
        self.txn.state()
    }

    /// Fetches the matching primary keys for the given secondary index value,
    /// or an empty set if there is none.
    fn get_index(&self, table: &str, column: &str, value: &Value) -> Result<BTreeSet<Value>> {
        debug_assert!(self.has_index(table, column)?, "no index on {table}.{column}");
        Ok(self
            .txn
            .get(&Key::Index(table.into(), column.into(), value.into()).encode())?
            .map(|v| BTreeSet::decode(&v))
            .transpose()?
            .unwrap_or_default())
    }

    /// Fetches a single row by primary key, or None if it doesn't exist.
    fn get_row(&self, table: &str, id: &Value) -> Result<Option<Row>> {
        self.txn
            .get(&Key::Row(table.into(), id.into()).encode())?
            .map(|v| Row::decode(&v))
            .transpose()
    }

    /// Returns true if a secondary index exists for the given column.
    fn has_index(&self, table: &str, column: &str) -> Result<bool> {
        let table = self.must_get_table(table)?;
        Ok(table.columns.iter().find(|c| c.name == column).map(|c| c.index).unwrap_or(false))
    }

    /// Stores a secondary index entry for the given column value, replacing the
    /// existing entry if any.
    fn set_index(
        &self,
        table: &str,
        column: &str,
        value: &Value,
        ids: BTreeSet<Value>,
    ) -> Result<()> {
        debug_assert!(self.has_index(table, column)?, "no index on {table}.{column}");
        let key = Key::Index(table.into(), column.into(), value.into()).encode();
        if ids.is_empty() {
            self.txn.delete(&key)?;
        } else {
            self.txn.set(&key, ids.encode())?;
        }
        Ok(())
    }

    /// Returns all tables referencing a table, as (table, column index) pairs.
    /// This includes any references from the table itself.
    fn table_references(&self, table: &str) -> Result<Vec<(Table, Vec<usize>)>> {
        Ok(self
            .list_tables()?
            .into_iter()
            .map(|t| {
                let references = t
                    .columns
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| c.references.as_deref() == Some(table))
                    .map(|(i, _)| i)
                    .collect_vec();
                (t, references)
            })
            .filter(|(_, references)| !references.is_empty())
            .collect())
    }
}

impl<E: storage::Engine> super::Transaction for Transaction<E> {
    fn state(&self) -> &mvcc::TransactionState {
        self.txn.state()
    }

    fn commit(self) -> Result<()> {
        self.txn.commit()
    }

    fn rollback(self) -> Result<()> {
        self.txn.rollback()
    }

    fn delete(&self, table: &str, ids: &[Value]) -> Result<()> {
        let table = self.must_get_table(table)?;
        let indexes = table.columns.iter().enumerate().filter(|(_, c)| c.index).collect_vec();

        // Check for foreign key references to the deleted rows.
        for (source, refs) in self.table_references(&table.name)? {
            let self_reference = source.name == table.name;
            for i in refs {
                let column = &source.columns[i];
                let mut source_ids = if i == source.primary_key {
                    // If the reference is from a primary key column, do a lookup.
                    self.get(&source.name, ids)?
                        .into_iter()
                        .map(|row| row.into_iter().nth(i).expect("short row"))
                        .collect()
                } else {
                    // Otherwise (commonly), do a secondary index lookup.
                    // All foreign keys have a secondary index.
                    self.lookup_index(&source.name, &column.name, ids)?
                };
                // We can ignore any references between the deleted rows,
                // including a row referencing itself.
                if self_reference {
                    for id in ids {
                        source_ids.remove(id);
                    }
                }
                // Error if the delete would violate referential integrity.
                if let Some(source_id) = source_ids.first() {
                    let table = source.name;
                    let column = &source.columns[source.primary_key].name;
                    return errinput!("row referenced by {table}.{column}={source_id}");
                }
            }
        }

        for id in ids {
            // Update any secondary index entries.
            if !indexes.is_empty()
                && let Some(row) = self.get_row(&table.name, id)?
            {
                for (i, column) in indexes.iter().copied() {
                    let mut ids = self.get_index(&table.name, &column.name, &row[i])?;
                    ids.remove(id);
                    self.set_index(&table.name, &column.name, &row[i], ids)?;
                }
            }

            // Delete the row.
            self.txn.delete(&Key::Row((&table.name).into(), id.into()).encode())?;
        }
        Ok(())
    }

    fn get(&self, table: &str, ids: &[Value]) -> Result<Vec<Row>> {
        ids.iter().filter_map(|id| self.get_row(table, id).transpose()).collect()
    }

    fn insert(&self, table: &str, rows: Vec<Row>) -> Result<()> {
        let table = self.must_get_table(table)?;
        for row in rows {
            // Insert the row.
            table.validate_row(&row, false, self)?;
            let id = &row[table.primary_key];
            self.txn.set(&Key::Row((&table.name).into(), id.into()).encode(), row.encode())?;

            // Update any secondary index entries.
            for (i, column) in table.columns.iter().enumerate().filter(|(_, c)| c.index) {
                let mut ids = self.get_index(&table.name, &column.name, &row[i])?;
                ids
```

### Core Architecture Module: `src/sql/engine/mod.rs`
```
//! The SQL engine provides SQL data storage and access, as well as session and
//! transaction management. The `Local` engine provides node-local on-disk
//! storage, while the `Raft` engine submits commands through Raft consensus
//! before dispatching to the `Local` engine on each node.

mod engine;
mod local;
mod raft;

pub use engine::{Catalog, Engine, Transaction};
pub use local::{Key, Local};
pub use raft::{Raft, Status, Write};

```

### Core Architecture Module: `src/sql/engine/raft.rs`
```
use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet};

use crossbeam::channel::Sender;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use super::{Catalog, Engine as _, Transaction as _};
use crate::encoding::{self, Value as _, bincode};
use crate::errdata;
use crate::error::Result;
use crate::raft;
use crate::sql::types::{Expression, Row, Rows, Table, Value};
use crate::storage::{self, mvcc};

/// A read command, submitted via Raft and executed on the leader. Each command
/// corresponds to a SQL engine method and parameters. Uses Cows to allow
/// borrowed encoding and owned decoding.
#[derive(Debug, Serialize, Deserialize)]
pub enum Read<'a> {
    BeginReadOnly {
        as_of: Option<mvcc::Version>,
    },
    Status,

    Get {
        txn: Cow<'a, mvcc::TransactionState>,
        table: Cow<'a, str>,
        ids: Cow<'a, [Value]>,
    },
    LookupIndex {
        txn: Cow<'a, mvcc::TransactionState>,
        table: Cow<'a, str>,
        column: Cow<'a, str>,
        values: Cow<'a, [Value]>,
    },
    Scan {
        txn: Cow<'a, mvcc::TransactionState>,
        table: Cow<'a, str>,
        filter: Option<Expression>,
    },

    GetTable {
        txn: Cow<'a, mvcc::TransactionState>,
        table: Cow<'a, str>,
    },
    ListTables {
        txn: Cow<'a, mvcc::TransactionState>,
    },
}

impl encoding::Value for Read<'_> {}

/// A write command, submitted via Raft and executed on all nodes. Each command
/// corresponds to a SQL engine method and parameters. Uses Cows to allow
/// borrowed encoding and owned decoding.
#[derive(Debug, Serialize, Deserialize)]
pub enum Write<'a> {
    Begin,
    Commit(Cow<'a, mvcc::TransactionState>),
    Rollback(Cow<'a, mvcc::TransactionState>),

    Delete { txn: Cow<'a, mvcc::TransactionState>, table: Cow<'a, str>, ids: Cow<'a, [Value]> },
    Insert { txn: Cow<'a, mvcc::TransactionState>, table: Cow<'a, str>, rows: Vec<Row> },
    Update { txn: Cow<'a, mvcc::TransactionState>, table: Cow<'a, str>, rows: BTreeMap<Value, Row> },

    CreateTable { txn: Cow<'a, mvcc::TransactionState>, schema: Table },
    DropTable { txn: Cow<'a, mvcc::TransactionState>, table: Cow<'a, str>, if_exists: bool },
}

impl encoding::Value for Write<'_> {}

/// Raft SQL engine status.
#[derive(Serialize, Deserialize)]
pub struct Status {
    pub raft: raft::Status,
    pub mvcc: mvcc::Status,
}

/// A Raft-based SQL engine. This dispatches to the `Local` engine for local
/// storage and processing on each node, but sends read and write commands
/// through Raft for distributed consensus.
///
/// The `Raft` engine itself is simply a Raft client which sends `raft::Request`
/// to the local Raft node for processing. These requests are applied to the
/// Raft SQL engine's `State` state machine running below Raft on each node,
/// which executes the commands on a `Local` SQL engine using a
/// `storage::Engine` for local storage.
///
/// For more details on how SQL statements flow through the engine, see the
/// `sql` module documentation.
pub struct Raft {
    /// Sends requests to the local Raft node, along with a response channel.
    tx: Sender<(raft::Request, Sender<Result<raft::Response>>)>,
}

impl Raft {
    /// The unversioned key used to store the applied index. Just uses a string
    /// for simplicity.
    pub const APPLIED_INDEX_KEY: &'static [u8] = b"applied_index";

    /// Creates a new Raft-based SQL engine, with a channel to send requests to
    /// the local Raft node.
    pub fn new(tx: Sender<(raft::Request, Sender<Result<raft::Response>>)>) -> Self {
        Self { tx }
    }

    /// Creates the Raft-managed state machine for the Raft engine. Receives
    /// commands from the Raft engine and executes them on a `Local` engine.
    pub fn new_state<E: storage::Engine>(engine: E) -> Result<State<E>> {
        State::new(engine)
    }

    /// Executes a request against the Raft cluster, waiting for the response.
    fn request(&self, request: raft::Request) -> Result<raft::Response> {
        let (response_tx, response_rx) = crossbeam::channel::bounded(1);
        self.tx.send((request, response_tx))?;
        response_rx.recv()?
    }

    /// Writes through Raft, deserializing the response into the return type.
    fn write<V: DeserializeOwned>(&self, write: Write) -> Result<V> {
        match self.request(raft::Request::Write(write.encode()))? {
            raft::Response::Write(response) => bincode::deserialize(&response),
            response => errdata!("unexpected Raft write response {response:?}"),
        }
    }

    /// Reads from Raft, deserializing the response into the return type.
    fn read<V: DeserializeOwned>(&self, read: Read) -> Result<V> {
        match self.request(raft::Request::Read(read.encode()))? {
            raft::Response::Read(response) => bincode::deserialize(&response),
            response => errdata!("unexpected Raft read response {response:?}"),
        }
    }

    /// Raft SQL engine status.
    pub fn status(&self) -> Result<Status> {
        let raft = match self.request(raft::Request::Status)? {
            raft::Response::Status(status) => status,
            response => return errdata!("unexpected Raft status response {response:?}"),
        };
        let mvcc = self.read(Read::Status)?;
        Ok(Status { raft, mvcc })
    }
}

impl<'a> super::Engine<'a> for Raft {
    type Transaction = Transaction<'a>;

    fn begin(&'a self) -> Result<Self::Transaction> {
        Transaction::begin(self, false, None)
    }

    fn begin_read_only(&'a self) -> Result<Self::Transaction> {
        Transaction::begin(self, true, None)
    }

    fn begin_as_of(&'a self, version: mvcc::Version) -> Result<Self::Transaction> {
        Transaction::begin(self, true, Some(version))
    }
}

/// A Raft SQL engine transaction.
///
/// This keeps track of the transaction state in memory. An `mvcc::Transaction`
/// normally manages this, but since `mvcc::Transaction` runs below Raft, it
/// can't maintain this state between individual requests (which could execute
/// on different leaders). Instead, it uses `mvcc::Transaction::resume` to
/// resume the transaction from the provided transaction state for each request.
pub struct Transaction<'a> {
    /// The Raft SQL engine client, used to communicate with Raft.
    raft: &'a Raft,
    /// The MVCC transaction state.
    state: mvcc::TransactionState,
}

impl<'a> Transaction<'a> {
    /// Starts a transaction in the given mode.
    fn begin(raft: &'a Raft, read_only: bool, as_of: Option<mvcc::Version>) -> Result<Self> {
        assert!(as_of.is_none() || read_only, "can't use as_of without read_only");
        // Read-only transactions don't allocate a new MVCC version, so they
        // don't write anything -- they just grab the current transaction state.
        // Submit them as reads to avoid a replication roundtrip.
        let state = if read_only || as_of.is_some() {
            raft.read(Read::BeginReadOnly { as_of })?
        } else {
            raft.write(Write::Begin)?
        };
        Ok(Self { raft, state })
    }
}

impl super::Transaction for Transaction<'_> {
    fn state(&self) -> &mvcc::TransactionState {
        &self.state
    }

    fn commit(self) -> Result<()> {
        if self.state.read_only {
            return Ok(()); // noop
        }
        self.raft.write(Write::Commit(self.state.into()))
    }

    fn rollback(self) -> Result<()> {
        if self.state.read_only {
            return Ok(()); // noop
        }
        self.raft.write(Write::Rollback(self.state.into()))
    }

    fn delete(&self, table: &str, ids: &[Value]) -> Result<()> {
        self.raft.write(Write::Delete {
            txn: (&self.state).into(),
            table: table.into(),
            ids: ids.into(),
        })
    }

    fn get(&self, table: &str, ids: &[Value]) -> Result<Vec<Row>> {
        self.raft.read(Read::Get {
            txn: (&self.state).into(),
            table: table.into(),
            ids: ids.into(),
        })
    }

    fn insert(&self, table: &str, rows: Vec<Row>) -> Result<()> {
        self.raft.write(Write::Insert { txn: (&self.state).into(), table: table.into(), rows })
    }

    fn lookup_index(&self, table: &str, column: &str, values: &[Value]) -> Result<BTreeSet<Value>> {
        self.raft.read(Read::LookupIndex {
            txn: (&self.state).into(),
            table: table.into(),
            column: column.into(),
            values: values.into(),
        })
    }

    fn scan(&self, table: &str, filter: Option<Expression>) -> Result<Rows> {
        let scan: Vec<Row> = self.raft.read(Read::Scan {
            txn: (&self.state).into(),
            table: table.into(),
            filter,
        })?;
        Ok(Box::new(scan.into_iter().map(Ok)))
    }

    fn update(&self, table: &str, rows: BTreeMap<Value, Row>) -> Result<()> {
        self.raft.write(Write::Update { txn: (&self.state).into(), table: table.into(), rows })
    }
}

impl Catalog for Transaction<'_> {
    fn create_table(&self, schema: Table) -> Result<()> {
        self.raft.write(Write::CreateTable { txn: (&self.state).into(), schema })
    }

    fn drop_table(&self, table: &str, if_exists: bool) -> Result<bool> {
        self.raft.write(Write::DropTable {
            txn: (&self.state).into(),
            table: table.into(),
            if_exists,
        })
    }

    fn get_table(&self, table: &str) -> Result<Option<Table>> {
        self.raft.read(Read::GetTable { txn: (&self.state).into(), table: table.into() })
    }

    fn list_tables(&self) -> Result<Vec<Table>> {
        self.raft.read(Read::ListTables { txn: (&self.state).into() })
    }
}

/// The state machine for the Raft SQL engine. Receives commands via Raft and
/// dispatches to a `Local` SQL engine which does the actual work, using a
/// `storage::Engine` for storage.
///
/// For simplicity, we don't attempt to stream large requests or responses,
/// instead just delivering them as on
```

### Core Architecture Module: `src/storage/engine.rs`
```
use std::ops::{Bound, RangeBounds};

use serde::{Deserialize, Serialize};

use crate::encoding::keycode;
use crate::error::Result;

/// A key/value storage engine, which stores arbitrary byte strings. Keys are
/// maintained in lexicographical order, which allows for range scans. This is
/// needed e.g. to scan all rows in a specific SQL table (where all table rows
/// have a common key prefix), or to scan the tail of the Raft log (after a
/// given log entry index).
///
/// Keys should use the Keycode order-preserving encoding, see
/// [`crate::encoding::keycode`].
///
/// Writes are only guaranteed durable after calling [`Engine::flush()`].
///
/// For simplicity, this only supports a single user at a time, so all methods
/// (including reads) take a mutable reference. This isn't that big of a deal
/// since Raft execution is serial anyway.
pub trait Engine: Send {
    /// The iterator returned by [`Engine::scan`].
    type ScanIterator<'a>: ScanIterator + 'a
    where
        Self: Sized + 'a; // omit in trait objects, for dyn compatibility

    /// Deletes a key, or does nothing if it does not exist.
    fn delete(&mut self, key: &[u8]) -> Result<()>;

    /// Flushes any buffered data to disk.
    fn flush(&mut self) -> Result<()>;

    /// Gets a value for a key, if it exists.
    fn get(&mut self, key: &[u8]) -> Result<Option<Vec<u8>>>;

    /// Iterates over an ordered range of key/value pairs.
    fn scan(&mut self, range: impl RangeBounds<Vec<u8>>) -> Self::ScanIterator<'_>
    where
        Self: Sized; // omit in trait objects, for dyn compatibility

    /// Like scan, but can be used from trait objects (with dynamic dispatch).
    fn scan_dyn(&mut self, range: (Bound<Vec<u8>>, Bound<Vec<u8>>)) -> Box<dyn ScanIterator + '_>;

    /// Iterates over all key/value pairs starting with the given prefix.
    fn scan_prefix(&mut self, prefix: &[u8]) -> Self::ScanIterator<'_>
    where
        Self: Sized, // omit in trait objects, for dyn compatibility
    {
        self.scan(keycode::prefix_range(prefix))
    }

    /// Sets a value for a key, replacing the existing value if any.
    fn set(&mut self, key: &[u8], value: Vec<u8>) -> Result<()>;

    /// Returns the engine status.
    fn status(&mut self) -> Result<Status>;
}

/// A scan iterator over key/value pairs, returned by [`Engine::scan()`].
pub trait ScanIterator: DoubleEndedIterator<Item = Result<(Vec<u8>, Vec<u8>)>> {}

/// Blanket implementation for all iterators that can act as a scan iterator.
impl<I: DoubleEndedIterator<Item = Result<(Vec<u8>, Vec<u8>)>>> ScanIterator for I {}

/// Engine status.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Status {
    /// The name of the storage engine.
    pub name: String,
    /// The number of live keys in the engine.
    pub keys: u64,
    /// The logical size of live key/value pairs.
    pub size: u64,
    /// The on-disk size of all data, live and garbage.
    pub disk_size: u64,
    /// The on-disk size of live data, excluding garbage.
    pub live_disk_size: u64,
}

impl Status {
    /// The on-disk size of garbage data.
    pub fn garbage_disk_size(&self) -> u64 {
        self.disk_size - self.live_disk_size
    }

    /// The ratio of on-disk garbage to total size.
    pub fn garbage_disk_percent(&self) -> f64 {
        if self.disk_size == 0 {
            return 0.0;
        }
        self.garbage_disk_size() as f64 / self.disk_size as f64 * 100.0
    }
}

/// Test helpers for engines.
#[cfg(test)]
pub mod test {
    use std::convert::Infallible;
    use std::error::Error as StdError;
    use std::fmt::Write as _;
    use std::ops::{Bound, Deref, RangeBounds};
    use std::result::Result as StdResult;
    use std::str::FromStr;

    use crossbeam::channel::Sender;
    use itertools::Itertools as _;
    use regex::Regex;

    use super::*;
    use crate::encoding::format::{self, Formatter as _};

    /// Goldenscript runner for engines. All engines use a common set of
    /// goldenscripts in src/storage/testscripts/engine, as well as their own
    /// engine-specific tests.
    pub struct Runner<E: Engine> {
        pub engine: E,
    }

    /// Commands accepted by the engine Goldenscript runner.
    #[derive(goldenscript::Command)]
    pub enum Command {
        /// Deletes a key.
        Delete(BinaryString),
        /// Fetches a key.
        Get(BinaryString),
        /// Scans a key range.
        Scan {
            /// The key range in Rust range syntax, or the full range if omitted.
            #[arg(optional)]
            range: KeyRange,
            /// Whether to scan in reverse.
            #[arg(key, optional)]
            reverse: bool,
        },
        /// Scans all keys with the given prefix.
        ScanPrefix(BinaryString),
        /// Sets a key/value pair.
        Set(
            /// The single key/value pair to set.
            Vec<(BinaryString, BinaryString)>,
        ),
        /// Displays engine status.
        Status,
    }

    /// A string parsed into its binary byte representation.
    ///
    /// Code points U+0080 through U+00FF are converted directly to bytes 0x80
    /// through 0xff. This allows using e.g. `\xff` in an input string literal
    /// to represent the byte 0xff rather than its UTF-8 encoding 0xc3bf.
    pub struct BinaryString(Vec<u8>);

    impl FromStr for BinaryString {
        type Err = Infallible;

        fn from_str(value: &str) -> StdResult<Self, Self::Err> {
            let mut buf = [0; 4];
            let mut bytes = Vec::new();
            for c in value.chars() {
                // u32 is the Unicode code point, not the UTF-8 encoding.
                match c as u32 {
                    b @ 0x80..=0xff => bytes.push(b as u8),
                    _ => bytes.extend(c.encode_utf8(&mut buf).as_bytes()),
                }
            }
            Ok(Self(bytes))
        }
    }

    impl Deref for BinaryString {
        type Target = [u8];

        fn deref(&self) -> &Self::Target {
            &self.0
        }
    }

    impl From<BinaryString> for Vec<u8> {
        fn from(value: BinaryString) -> Self {
            value.0
        }
    }

    /// A binary key range parsed from Rust range syntax and BinaryString.
    pub struct KeyRange(Bound<Vec<u8>>, Bound<Vec<u8>>);

    impl Default for KeyRange {
        fn default() -> Self {
            Self(Bound::Unbounded, Bound::Unbounded)
        }
    }

    impl FromStr for KeyRange {
        type Err = Box<dyn StdError>;

        fn from_str(value: &str) -> StdResult<Self, Self::Err> {
            let mut range = Self::default();
            let re = Regex::new(r"^(\S+)?\.\.(=)?(\S+)?").expect("invalid regex");
            let groups = re.captures(value).ok_or_else(|| format!("invalid range {value}"))?;
            if let Some(start) = groups.get(1) {
                range.0 = Bound::Included(start.as_str().parse::<BinaryString>()?.into());
            }
            if let Some(end) = groups.get(3) {
                let end = end.as_str().parse::<BinaryString>()?.into();
                range.1 = match groups.get(2) {
                    Some(_) => Bound::Included(end),
                    None => Bound::Excluded(end),
                };
            }
            Ok(range)
        }
    }

    impl RangeBounds<Vec<u8>> for KeyRange {
        fn start_bound(&self) -> Bound<&Vec<u8>> {
            self.0.as_ref()
        }

        fn end_bound(&self) -> Bound<&Vec<u8>> {
            self.1.as_ref()
        }
    }

    impl RangeBounds<Vec<u8>> for &KeyRange {
        fn start_bound(&self) -> Bound<&Vec<u8>> {
            self.0.as_ref()
        }

        fn end_bound(&self) -> Bound<&Vec<u8>> {
            self.1.as_ref()
        }
    }

    impl<E: Engine> Runner<E> {
        pub fn new(engine: E) -> Self {
            Self { engine }
        }
    }

    impl<E: Engine> goldenscript::Runner for Runner<E> {
        type Command = Command;

        fn run(
            &mut self,
            command: &Command,
            _: &goldenscript::Context,
        ) -> StdResult<String, Box<dyn StdError>> {
            let mut output = String::new();
            match command {
                Command::Delete(key) => {
                    self.engine.delete(key)?;
                }

                Command::Get(key) => {
                    let value = self.engine.get(key)?;
                    writeln!(output, "{}", format::Raw::key_maybe_value(key, value.as_deref()))?;
                }

                &Command::Scan { ref range, reverse } => {
                    let items: Vec<_> = if reverse {
                        self.engine.scan(range).rev().try_collect()?
                    } else {
                        self.engine.scan(range).try_collect()?
                    };
                    for (key, value) in items {
                        let fmtkv = format::Raw::key_value(&key, &value);
                        writeln!(output, "{fmtkv}")?;
                    }
                }

                Command::ScanPrefix(prefix) => {
                    let mut scan = self.engine.scan_prefix(prefix);
                    while let Some((key, value)) = scan.next().transpose()? {
                        let fmtkv = format::Raw::key_value(&key, &value);
                        writeln!(output, "{fmtkv}")?;
                    }
                }

                Command::Set(entries) => {
                    let [(key, value)] = entries.as_slice() else {
                        return Err("must specify one key=value pair".into());
                    };
                    self.engine.set(key, value.to_vec())?;
                }

                Command::Status => {
                    writeln!(output, "{:#?}", self.engine.status()?)?;
                }
            }
            Ok(output)
        }
    }

    /// Wraps another engine and emits write events to the given channel.
    pub struct Emit<E: Engine> {
        /// The wrapped engine.
        inner: E,
 
```

### Core Architecture Module: `src/bin/toydb.rs`
```
//! The toyDB server. Takes configuration from a config file (default
//! config/toydb.yaml) or corresponding TOYDB_ environment variables. Listens
//! for SQL clients (default port 9601) and Raft connections from other toyDB
//! peers (default port 9701). The Raft log and SQL database are stored at
//! data/raft and data/sql by default.
//!
//! Use the toysql command-line client to connect to the server.

#![warn(clippy::all)]

use std::collections::HashMap;
use std::path::Path;

use clap::Parser as _;
use serde::Deserialize;

use toydb::Server;
use toydb::errinput;
use toydb::error::Result;
use toydb::raft;
use toydb::sql;
use toydb::storage;

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}")
    }
}

/// The toyDB server configuration. Can be provided via config file (default
/// config/toydb.yaml) or TOYDB_ environment variables.
#[derive(Debug, Deserialize)]
struct Config {
    /// The node ID. Must be unique in the cluster.
    id: raft::NodeID,
    /// The other nodes in the cluster, and their Raft TCP addresses.
    peers: HashMap<raft::NodeID, String>,
    /// The Raft listen address.
    listen_raft: String,
    /// The SQL listen address.
    listen_sql: String,
    /// The log level.
    log_level: String,
    /// The path to this node's data directory. The Raft log is stored in
    /// the file "raft", and the SQL state machine in "sql".
    data_dir: String,
    /// The Raft storage engine: bitcask or memory.
    storage_raft: String,
    /// The SQL storage engine: bitcask or memory.
    storage_sql: String,
    /// If false, don't fsync Raft log writes to disk. Disabling this
    /// will yield much better write performance, but may lose data on
    /// host crashes which compromises Raft safety guarantees.
    fsync: bool,
    /// The garbage fraction threshold at which to trigger compaction.
    compact_threshold: f64,
    /// The minimum bytes of garbage before triggering compaction.
    compact_min_bytes: u64,
}

impl Config {
    /// Loads the configuration from the given file.
    fn load(file: &str) -> Result<Self> {
        Ok(config::Config::builder()
            .set_default("id", "1")?
            .set_default("listen_sql", "localhost:9601")?
            .set_default("listen_raft", "localhost:9701")?
            .set_default("log_level", "info")?
            .set_default("data_dir", "data")?
            .set_default("storage_raft", "bitcask")?
            .set_default("storage_sql", "bitcask")?
            .set_default("fsync", true)?
            .set_default("compact_threshold", 0.2)?
            .set_default("compact_min_bytes", 1_000_000)?
            .add_source(config::File::with_name(file))
            .add_source(config::Environment::with_prefix("TOYDB"))
            .build()?
            .try_deserialize()?)
    }
}

/// The toyDB server command.
#[derive(clap::Parser)]
#[command(about = "Starts a toyDB server.", version, propagate_version = true)]
struct Command {
    /// The configuration file path.
    #[arg(short = 'c', long, default_value = "config/toydb.yaml")]
    config: String,
}

impl Command {
    /// Runs the toyDB server.
    fn run(self) -> Result<()> {
        // Load the configuration.
        let cfg = Config::load(&self.config)?;

        // Initialize logging.
        let loglevel = cfg.log_level.parse()?;
        let mut logconfig = simplelog::ConfigBuilder::new();
        if loglevel != simplelog::LevelFilter::Debug {
            logconfig.add_filter_allow_str("toydb");
        }
        simplelog::SimpleLogger::init(loglevel, logconfig.build())?;

        // Initialize the Raft log storage engine.
        let datadir = Path::new(&cfg.data_dir);
        let mut raft_log = match cfg.storage_raft.as_str() {
            "bitcask" | "" => {
                let engine = storage::BitCask::new_maybe_compact(
                    datadir.join("raft"),
                    cfg.compact_threshold,
                    cfg.compact_min_bytes,
                )?;
                raft::Log::new(Box::new(engine))?
            }
            "memory" => raft::Log::new(Box::new(storage::Memory::new()))?,
            name => return errinput!("invalid Raft storage engine {name}"),
        };
        raft_log.enable_fsync(cfg.fsync);

        // Initialize the SQL storage engine.
        let raft_state: Box<dyn raft::State> = match cfg.storage_sql.as_str() {
            "bitcask" | "" => {
                let engine = storage::BitCask::new_maybe_compact(
                    datadir.join("sql"),
                    cfg.compact_threshold,
                    cfg.compact_min_bytes,
                )?;
                Box::new(sql::engine::Raft::new_state(engine)?)
            }
            "memory" => Box::new(sql::engine::Raft::new_state(storage::Memory::new())?),
            name => return errinput!("invalid SQL storage engine {name}"),
        };

        // Start the server.
        Server::new(cfg.id, cfg.peers, raft_log, raft_state)?
            .serve(&cfg.listen_raft, &cfg.listen_sql)
    }
}

```

### Core Architecture Module: `src/bin/toydump.rs`
```
//! toydump is a debug tool that prints a toyDB BitCask database in
//! human-readable form. It can print both the SQL database and the Raft log
//! (via --raft). It only outputs live BitCask data, not garbage entries.

#![warn(clippy::all)]

use clap::Parser as _;

use toydb::encoding::format::{self, Formatter as _};
use toydb::error::Result;
use toydb::storage::{BitCask, Engine as _};

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}")
    }
}

/// The toydump command.
#[derive(clap::Parser)]
#[command(about = "Prints toyDB file contents.", version, propagate_version = true)]
struct Command {
    /// The BitCask file to dump (SQL database unless --raft).
    file: String,
    /// The file is a Raft log, not SQL database.
    #[arg(long)]
    raft: bool,
    /// Also show raw key and value.
    #[arg(long)]
    raw: bool,
}

impl Command {
    /// Runs the command.
    fn run(self) -> Result<()> {
        let mut engine = BitCask::new(self.file.into())?;
        let mut scan = engine.scan(..);
        while let Some((key, value)) = scan.next().transpose()? {
            let mut string = match self.raft {
                true => format::Raft::<format::SQLCommand>::key_value(&key, &value),
                false => format::MVCC::<format::SQL>::key_value(&key, &value),
            };
            if self.raw {
                string = format!("{string} [{}]", format::Raw::key_value(&key, &value))
            }
            println!("{string}");
        }
        Ok(())
    }
}

```

### Core Architecture Module: `src/bin/toysql.rs`
```
//! toySQL is a command-line client for toyDB. It connects to a toyDB node
//! (default localhost:9601) and executes SQL statements against it via an
//! interactive shell interface. Command history is stored in .toysql.history.

#![warn(clippy::all)]

use std::path::PathBuf;

use clap::Parser as _;
use itertools::Itertools as _;
use rustyline::error::ReadlineError;
use rustyline::history::DefaultHistory;
use rustyline::validate::{ValidationContext, ValidationResult, Validator};
use rustyline::{Editor, Modifiers};
use rustyline_derive::{Completer, Helper, Highlighter, Hinter};

use toydb::Client;
use toydb::errinput;
use toydb::error::Result;
use toydb::sql::execution::StatementResult;
use toydb::sql::parser::{Lexer, Token};

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}");
    }
}

/// The toySQL command.
#[derive(clap::Parser)]
#[command(about = "A toyDB client.", version, propagate_version = true)]
struct Command {
    /// A SQL statement to execute, then exit.
    #[arg()]
    statement: Option<String>,
    /// Host to connect to.
    #[arg(short = 'H', long, default_value = "localhost")]
    host: String,
    /// Port number to connect to.
    #[arg(short = 'p', long, default_value = "9601")]
    port: u16,
}

impl Command {
    /// Runs the command.
    fn run(self) -> Result<()> {
        let mut shell = Shell::new(&self.host, self.port)?;
        match self.statement {
            Some(statement) => shell.execute(&statement),
            None => shell.run(),
        }
    }
}

/// An interactive toySQL shell.
struct Shell {
    /// The toyDB client.
    client: Client,
    /// The Rustyline command editor.
    editor: Editor<InputValidator, DefaultHistory>,
    /// The path to the history file, if any.
    history_path: Option<PathBuf>,
    /// If true, SELECT column headers will be displayed.
    show_headers: bool,
}

impl Shell {
    /// Creates a new shell connected to the given server.
    fn new(host: &str, port: u16) -> Result<Self> {
        let client = Client::connect((host, port))?;
        // Set up Rustyline. Make sure multiline pastes are handled normally.
        let mut editor = Editor::new()?;
        editor.set_helper(Some(InputValidator));
        editor.bind_sequence(
            rustyline::KeyEvent(rustyline::KeyCode::BracketedPasteStart, Modifiers::NONE),
            rustyline::Cmd::Noop,
        );
        let history_path =
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".toysql.history"));
        Ok(Self { client, editor, history_path, show_headers: false })
    }

    /// Executes a SQL statement or ! command.
    fn execute(&mut self, input: &str) -> Result<()> {
        if input.starts_with('!') {
            self.execute_command(input)
        } else if !input.is_empty() {
            self.execute_sql(input)
        } else {
            Ok(())
        }
    }

    /// Executes a toySQL ! command (e.g. !help)
    fn execute_command(&mut self, input: &str) -> Result<()> {
        let mut input = input.split_ascii_whitespace();
        let Some(command) = input.next() else {
            return errinput!("expected command");
        };
        let args = input.collect_vec();

        match (command, args.as_slice()) {
            // Toggles column headers.
            ("!headers", []) => {
                self.show_headers = !self.show_headers;
                match self.show_headers {
                    true => println!("Headers enabled"),
                    false => println!("Headers disabled"),
                }
            }
            ("!headers", _) => return errinput!("!headers takes no arguments"),

            // Displays help.
            ("!help", []) => println!(
                r#"
Enter a SQL statement terminated by a semicolon (;) to execute it, or Ctrl-D to
exit. The following commands are also available:

    !headers           Toggles column headers
    !help              This help message
    !status            Display server status
    !table NAME        Display a table schema
    !tables            List tables
"#
            ),
            ("!help", _) => return errinput!("!help takes no arguments"),

            // Displays server status.
            ("!status", []) => {
                let status = self.client.status()?;
                println!(
                    r#"
Server:       n{server} with Raft leader n{leader} in term {term} for {nodes} nodes
Raft log:     {committed} committed, {applied} applied, {raft_size} MB, {raft_garbage}% garbage ({raft_storage} engine)
Replication:  {raft_match}
SQL storage:  {sql_keys} keys, {sql_size} MB logical, {nodes}x {sql_disk_size} MB disk, {sql_garbage}% garbage ({sql_storage} engine)
Transactions: {active_txns} active, {versions} total
"#,
                    server = status.server,
                    leader = status.raft.leader,
                    term = status.raft.term,
                    nodes = status.raft.match_index.len(),
                    committed = status.raft.commit_index,
                    applied = status.raft.applied_index,
                    raft_size =
                        format_args!("{:.3}", status.raft.storage.size as f64 / 1_000_000.0),
                    raft_garbage =
                        format_args!("{:.0}", status.raft.storage.garbage_disk_percent()),
                    raft_storage = status.raft.storage.name,
                    raft_match =
                        status.raft.match_index.iter().map(|(n, m)| format!("n{n}:{m}")).join(" "),
                    sql_keys = status.mvcc.storage.keys,
                    sql_size = format_args!("{:.3}", status.mvcc.storage.size as f64 / 1_000_000.0),
                    sql_disk_size =
                        format_args!("{:.3}", status.mvcc.storage.disk_size as f64 / 1_000_000.0),
                    sql_garbage = format_args!("{:.0}", status.mvcc.storage.garbage_disk_percent()),
                    sql_storage = status.mvcc.storage.name,
                    active_txns = status.mvcc.active_txns,
                    versions = status.mvcc.versions,
                )
            }
            ("!status", _) => return errinput!("!status takes no arguments"),

            ("!table", [name]) => println!("{}", self.client.get_table(name)?),
            ("!table", _) => return errinput!("!table takes 1 argument"),

            ("!tables", []) => self.client.list_tables()?.iter().for_each(|t| println!("{t}")),
            ("!tables", _) => return errinput!("!tables takes no arguments"),

            (command, _) => return errinput!("unknown command {command}"),
        }
        Ok(())
    }

    /// Executes a SQL statement and displays the results.
    fn execute_sql(&mut self, statement: &str) -> Result<()> {
        use StatementResult::*;
        match self.client.execute(statement)? {
            Begin(state) => match state.read_only {
                true => println!("Began read-only transaction at version {}", state.version),
                false => println!("Began transaction {}", state.version),
            },
            Commit { version } => println!("Committed transaction {version}"),
            Rollback { version } => println!("Rolled back transaction {version}"),
            Insert { count } => println!("Inserted {count} rows"),
            Delete { count } => println!("Deleted {count} rows"),
            Update { count } => println!("Updated {count} rows"),
            CreateTable { name } => println!("Created table {name}"),
            DropTable { name, existed } => match existed {
                true => println!("Dropped table {name}"),
                false => println!("Table {name} does not exist"),
            },
            Explain(plan) => println!("{plan}"),
            Select { columns, rows } => {
                if self.show_headers {
                    println!("{}", columns.iter().map(|c| c.as_header()).join(", "));
                }
                for row in rows {
                    println!("{}", row.iter().join(", "));
                }
            }
        }
        Ok(())
    }

    /// Prompts the user for input. Returns None if the shell should close.
    fn prompt(&mut self) -> rustyline::Result<String> {
        let prompt = match self.client.txn() {
            Some(txn) if txn.read_only => format!("toydb@{}> ", txn.version),
            Some(txn) => format!("toydb:{}> ", txn.version),
            None => "toydb> ".to_string(),
        };
        self.editor.readline(&prompt)
    }

    /// Runs the interactive shell.
    fn run(&mut self) -> Result<()> {
        // Load the history file, if any.
        if let Some(history_path) = &self.history_path {
            match self.editor.load_history(history_path) {
                Ok(()) => {}
                Err(ReadlineError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }

        // Print welcome message.
        let server = self.client.status()?.server;
        println!("Connected to toyDB node n{server}. Enter !help for instructions.");

        // Prompt for commands and execute them.
        loop {
            let input = match self.prompt() {
                Ok(input) => input.trim().to_string(),
                Err(ReadlineError::Interrupted) => continue,
                Err(ReadlineError::Eof) => break,
                Err(error) => return Err(error.into()),
            };
            self.editor.add_history_entry(&input)?;
            if let Err(error) = self.execute(&input) {
                eprintln!("Error: {error}");
            };
        }

        // Save the history file.
        if let Some(history_path) = &self.history_path {
            self.editor.save_history(history_path)?;
        }
        Ok(())
    }
}

/// A Rustyline helper for multiline editing. After a new line is entered, it
/// determines whether the input makes up a complete 
```

### Core Architecture Module: `src/bin/workload.rs`
```
//! Runs toyDB workload benchmarks. By default, it assumes a running 5-node
//! cluster as launched via cluster/run.sh, but this can be modified via -H.
//! For example, a read-only workload can be run as:
//!
//! cargo run --release --bin workload -- read
//!
//! See --help for a list of available workloads and arguments.

#![warn(clippy::all)]

use std::cmp::min;
use std::collections::HashSet;
use std::io::Write as _;
use std::time::{Duration, Instant};

use clap::Parser;
use hdrhistogram::Histogram;
use itertools::Itertools as _;
use rand::SeedableRng as _;
use rand::distr::Distribution as _;
use rand::rngs::StdRng;
use rand::seq::IndexedRandom as _;

use toydb::error::Result;
use toydb::sql::types::{Row, Rows};
use toydb::{Client, StatementResult};

fn main() {
    let Command { runner, subcommand } = Command::parse();
    let result = match subcommand {
        Subcommand::Read(read) => runner.run(read),
        Subcommand::Write(write) => runner.run(write),
        Subcommand::Bank(bank) => runner.run(bank),
    };
    if let Err(error) = result {
        eprintln!("Error: {error}")
    }
}

/// Handles command-line parsing.
#[derive(clap::Parser)]
#[command(about = "Runs toyDB workload benchmarks.", version, propagate_version = true)]
struct Command {
    #[command(flatten)]
    runner: Runner,

    #[command(subcommand)]
    subcommand: Subcommand,
}

#[derive(clap::Subcommand)]
enum Subcommand {
    Read(Read),
    Write(Write),
    Bank(Bank),
}

/// Runs a workload benchmark.
#[derive(clap::Args)]
struct Runner {
    /// Hosts to connect to (optionally with port number).
    #[arg(
        short = 'H',
        long,
        value_delimiter = ',',
        default_value = "localhost:9601,localhost:9602,localhost:9603,localhost:9604,localhost:9605"
    )]
    hosts: Vec<String>,

    /// Number of concurrent workers to spawn.
    #[arg(short, long, default_value = "16")]
    concurrency: usize,

    /// Number of transactions to execute.
    #[arg(short = 'n', long, default_value = "100000")]
    count: usize,

    /// Seed to use for random number generation.
    #[arg(short, long, default_value = "16791084677885396490")]
    seed: u64,
}

impl Runner {
    /// Runs the specified workload.
    fn run<W: Workload>(self, workload: W) -> Result<()> {
        let mut rng = StdRng::seed_from_u64(self.seed);
        let mut client = Client::connect(&self.hosts[0])?;

        // Set up a histogram recording txn latencies as nanoseconds. The
        // buckets range from 0.001s to 10s.
        let mut hist = Histogram::<u32>::new_with_bounds(1_000, 10_000_000_000, 3)?.into_sync();

        // Prepare the dataset.
        print!("Preparing initial dataset... ");
        std::io::stdout().flush()?;
        let start = Instant::now();
        workload.prepare(&mut client, &mut rng)?;
        println!("done ({:.3}s)", start.elapsed().as_secs_f64());

        // Spawn workers, round robin across hosts.
        std::thread::scope(|s| -> Result<()> {
            print!("Spawning {} workers... ", self.concurrency);
            std::io::stdout().flush()?;
            let start = Instant::now();

            let (work_tx, work_rx) = crossbeam::channel::bounded(self.concurrency);
            let (done_tx, done_rx) = crossbeam::channel::bounded::<()>(0);

            for addr in self.hosts.iter().cycle().take(self.concurrency) {
                let mut client = Client::connect(addr)?;
                let mut recorder = hist.recorder();
                let work_rx = work_rx.clone();
                let done_tx = done_tx.clone();
                s.spawn(move || -> Result<()> {
                    while let Ok(item) = work_rx.recv() {
                        let start = Instant::now();
                        client.with_retry(|client| W::execute(client, &item))?;
                        recorder.record(start.elapsed().as_nanos() as u64)?;
                    }
                    drop(done_tx); // disconnects done_rx once all workers exit
                    Ok(())
                });
            }
            drop(done_tx); // drop local copy

            println!("done ({:.3}s)", start.elapsed().as_secs_f64());

            // Spawn work generator.
            {
                println!("Running workload {}...", workload);
                let generator = workload.generate(rng)?.take(self.count);
                s.spawn(move || -> Result<()> {
                    for item in generator {
                        work_tx.send(item)?;
                    }
                    Ok(())
                });
            }

            // Periodically print stats until all workers are done.
            let start = Instant::now();
            let ticker = crossbeam::channel::tick(Duration::from_secs(1));

            println!();
            println!("Time   Progress     Txns      Rate       p50       p90       p99      pMax");

            while let Err(crossbeam::channel::TryRecvError::Empty) = done_rx.try_recv() {
                crossbeam::select! {
                    recv(ticker) -> _ => {},
                    recv(done_rx) -> _ => {},
                }

                let duration = start.elapsed().as_secs_f64();
                hist.refresh_timeout(Duration::from_secs(1));

                println!(
                    "{:<8} {:>5.1}%  {:>7}  {:>6.0}/s  {:>6.1}ms  {:>6.1}ms  {:>6.1}ms  {:>6.1}ms",
                    format!("{:.1}s", duration),
                    hist.len() as f64 / self.count as f64 * 100.0,
                    hist.len(),
                    hist.len() as f64 / duration,
                    Duration::from_nanos(hist.value_at_quantile(0.5)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.value_at_quantile(0.9)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.value_at_quantile(0.99)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.max()).as_secs_f64() * 1000.0,
                );
            }
            Ok(())
        })?;

        // Verify the final dataset.
        println!();
        print!("Verifying dataset... ");
        std::io::stdout().flush()?;
        let start = Instant::now();
        workload.verify(&mut client, self.count)?;
        println!("done ({:.3}s)", start.elapsed().as_secs_f64());

        Ok(())
    }
}

/// A workload.
trait Workload: std::fmt::Display {
    /// A work item.
    type Item: Send;

    /// Prepares the workload by creating initial tables and data.
    fn prepare(&self, client: &mut Client, rng: &mut StdRng) -> Result<()>;

    /// Generates work items as an iterator.
    fn generate(&self, rng: StdRng) -> Result<impl Iterator<Item = Self::Item> + Send + 'static>;

    /// Executes a single work item. This will automatically be retried on
    /// certain errors, and must use a transaction where appropriate.
    fn execute(client: &mut Client, item: &Self::Item) -> Result<()>;

    /// Verifies the dataset after the workload has completed.
    fn verify(&self, _client: &mut Client, _txns: usize) -> Result<()> {
        Ok(())
    }
}

/// A read-only workload. Creates an id,value table and populates it with the
/// given row count and value size. Then runs batches of random primary key
/// lookups (SELECT * FROM read WHERE id = 1 OR id = 2 ...).
#[derive(clap::Args, Clone)]
#[command(about = "A read-only workload using primary key lookups")]
struct Read {
    /// Total number of rows in data set.
    #[arg(short, long, default_value = "1000")]
    rows: u64,

    /// Row value size (excluding primary key).
    #[arg(short, long, default_value = "64")]
    size: usize,

    /// Number of rows to fetch in a single select.
    #[arg(short, long, default_value = "1")]
    batch: usize,
}

impl std::fmt::Display for Read {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "read (rows={} size={} batch={})", self.rows, self.size, self.batch)
    }
}

impl Workload for Read {
    type Item = HashSet<u64>;

    fn prepare(&self, client: &mut Client, rng: &mut StdRng) -> Result<()> {
        client.execute("BEGIN")?;
        client.execute(r#"DROP TABLE IF EXISTS "read""#)?;
        client.execute(r#"CREATE TABLE "read" (id INT PRIMARY KEY, value STRING NOT NULL)"#)?;

        let chars = &mut rand::distr::Alphanumeric.sample_iter(rng).map(|b| b as char);
        let rows = (1..=self.rows).map(|id| (id, chars.take(self.size).collect::<String>()));
        let chunks = rows.chunks(100);
        let queries = chunks.into_iter().map(|chunk| {
            format!(
                r#"INSERT INTO "read" (id, value) VALUES ({})"#,
                chunk.map(|(id, value)| format!("{}, '{}'", id, value)).join("), (")
            )
        });
        for query in queries {
            client.execute(&query)?;
        }
        client.execute("COMMIT")?;
        Ok(())
    }

    fn generate(&self, rng: StdRng) -> Result<impl Iterator<Item = Self::Item> + 'static> {
        Ok(ReadGenerator {
            batch: self.batch,
            dist: rand::distr::Uniform::new(1, self.rows + 1)?,
            rng,
        })
    }

    fn execute(client: &mut Client, item: &Self::Item) -> Result<()> {
        let batch_size = item.len();
        let query = format!(
            r#"SELECT * FROM "read" WHERE {}"#,
            item.iter().map(|id| format!("id = {}", id)).join(" OR ")
        );
        let rows: Rows = client.execute(&query)?.try_into()?;
        assert_eq!(rows.count(), batch_size, "Unexpected row count");
        Ok(())
    }

    fn verify(&self, client: &mut Client, _: usize) -> Result<()> {
        let count: i64 = client.execute(r#"SELECT COUNT(*) FROM "read""#)?.try_into()?;
        assert_eq!(count, self.rows as i64, "Unexpected row count");
        Ok(())
    }
}

/// A Read workload generator, yielding batches of random, unique primary keys.
struct ReadGenerator {
    batch: usize,
    rng: StdRng,
    dist: rand::distr::Uniform<u64>,
}

impl Iterator for ReadGenerat
```

### Core Architecture Module: `src/client.rs`
```
use std::io::{BufReader, BufWriter, Write as _};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use rand::RngExt as _;

use crate::encoding::Value as _;
use crate::errdata;
use crate::error::{Error, Result};
use crate::server::{Request, Response, Status};
use crate::sql::execution::StatementResult;
use crate::sql::types::Table;
use crate::storage::mvcc;

/// A toyDB client. Connects to a server via TCP and submits SQL statements and
/// other requests.
pub struct Client {
    /// Inbound response stream.
    reader: BufReader<TcpStream>,
    /// Outbound request stream.
    writer: BufWriter<TcpStream>,
    /// The current transaction, if any.
    txn: Option<mvcc::TransactionState>,
}

impl Client {
    /// Connects to a toyDB server, creating a new client.
    pub fn connect(addr: impl ToSocketAddrs) -> Result<Self> {
        let socket = TcpStream::connect(addr)?;
        let reader = BufReader::new(socket.try_clone()?);
        let writer = BufWriter::new(socket);
        Ok(Self { reader, writer, txn: None })
    }

    /// Sends a request to the server, returning the response.
    fn request(&mut self, request: Request) -> Result<Response> {
        request.encode_into(&mut self.writer)?;
        self.writer.flush()?;
        Result::decode_from(&mut self.reader)?
    }

    /// Executes a SQL statement.
    pub fn execute(&mut self, statement: &str) -> Result<StatementResult> {
        let result = match self.request(Request::Execute(statement.to_string()))? {
            Response::Execute(result) => result,
            response => return errdata!("unexpected response {response:?}"),
        };
        // Update the transaction state.
        match &result {
            StatementResult::Begin(state) => self.txn = Some(state.clone()),
            StatementResult::Commit { .. } => self.txn = None,
            StatementResult::Rollback { .. } => self.txn = None,
            _ => {}
        }
        Ok(result)
    }

    /// Fetches a table schema.
    pub fn get_table(&mut self, table: &str) -> Result<Table> {
        match self.request(Request::GetTable(table.to_string()))? {
            Response::GetTable(table) => Ok(table),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Lists database tables.
    pub fn list_tables(&mut self) -> Result<Vec<String>> {
        match self.request(Request::ListTables)? {
            Response::ListTables(tables) => Ok(tables),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Returns server status.
    pub fn status(&mut self) -> Result<Status> {
        match self.request(Request::Status)? {
            Response::Status(status) => Ok(status),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Returns the transaction state.
    pub fn txn(&self) -> Option<&mvcc::TransactionState> {
        self.txn.as_ref()
    }

    /// Runs the given closure, automatically retrying serialization and abort
    /// errors. If a transaction is open following an error, it is automatically
    /// rolled back. It is the caller's responsibility to use a transaction in
    /// the closure where appropriate (i.e. when it is not idempotent).
    pub fn with_retry<T>(&mut self, f: impl Fn(&mut Client) -> Result<T>) -> Result<T> {
        const MAX_RETRIES: u32 = 10;
        const MIN_WAIT: u64 = 10;
        const MAX_WAIT: u64 = 2_000;
        let mut retries: u32 = 0;
        loop {
            match f(self) {
                Ok(result) => return Ok(result),
                Err(Error::Serialization | Error::Abort) if retries < MAX_RETRIES => {
                    if self.txn().is_some() {
                        self.execute("ROLLBACK")?;
                    }
                    // Use exponential backoff starting at MIN_WAIT doubling up
                    // to MAX_WAIT, but randomize the wait time in this interval
                    // to reduce the chance of collisions.
                    let mut wait = MAX_WAIT.min(MIN_WAIT * 2_u64.pow(retries));
                    wait = rand::rng().random_range(MIN_WAIT..=wait);
                    std::thread::sleep(Duration::from_millis(wait));
                    retries += 1;
                }
                Err(error) => {
                    if self.txn().is_some() {
                        self.execute("ROLLBACK").ok(); // ignore rollback error
                    }
                    return Err(error);
                }
            }
        }
    }
}

```

### Core Architecture Module: `src/encoding/bincode.rs`
```
//! Bincode is used to encode values, both in key/value stores and the toyDB
//! network protocol. It is a Rust-specific encoding that depends on the
//! internal data structures being stable, but it's sufficient for toyDB. See:
//! <https://github.com/bincode-org/bincode>
//!
//! This module wraps the [`bincode`] crate and uses the standard config.

use std::io::{Read, Write};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// Use the standard Bincode configuration.
const CONFIG: bincode::config::Configuration = bincode::config::standard();

/// Serializes a value using Bincode.
pub fn serialize<T: Serialize>(value: &T) -> Vec<u8> {
    // Panic on failure, as this is a problem with the data structure.
    bincode::serde::encode_to_vec(value, CONFIG).expect("value must be serializable")
}

/// Deserializes a value using Bincode.
pub fn deserialize<'de, T: Deserialize<'de>>(bytes: &'de [u8]) -> Result<T> {
    Ok(bincode::serde::borrow_decode_from_slice(bytes, CONFIG)?.0)
}

/// Serializes a value to a writer using Bincode.
pub fn serialize_into<W: Write, T: Serialize>(mut writer: W, value: &T) -> Result<()> {
    bincode::serde::encode_into_std_write(value, &mut writer, CONFIG)?;
    Ok(())
}

/// Deserializes a value from a reader using Bincode.
pub fn deserialize_from<R: Read, T: DeserializeOwned>(mut reader: R) -> Result<T> {
    Ok(bincode::serde::decode_from_std_read(&mut reader, CONFIG)?)
}

/// Deserializes a value from a reader using Bincode, or returns None if the
/// reader is closed.
pub fn maybe_deserialize_from<R: Read, T: DeserializeOwned>(mut reader: R) -> Result<Option<T>> {
    match bincode::serde::decode_from_std_read(&mut reader, CONFIG) {
        Ok(t) => Ok(Some(t)),
        Err(bincode::error::DecodeError::Io { inner, .. })
            if inner.kind() == std::io::ErrorKind::UnexpectedEof
                || inner.kind() == std::io::ErrorKind::ConnectionReset =>
        {
            Ok(None)
        }
        Err(err) => Err(Error::from(err)),
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #35** (2020-06-09): **Raft: wait for initial leader commit before processing queries**
  *Symptoms*: https://stackoverflow.com/questions/37207682/raft-some-questions-about-read-only-queries

- **Issue #27** (2020-04-30): **Client pool must revert any transactions on return**
  *Symptoms*: 

- **Issue #19** (2020-05-03): **Raft panic on call during startup**
  *Symptoms*: Submitting a call immediately after starting a cluster causes a panic:  ``` Error: Internal("Unexpected Raft mutate response MutateState { call_id: [250, 91, 73, 148, 245, 202, 77, 21, 184, 190, 68, 192, 45, 3, 88, 140], command: [129, 0, 129, 0, 192] }") ```  Seems like the node returns the message we submitted, or something. Probably only applies to candidates, since it works fine once the cluster settles.

- **Issue #16** (2020-04-11): **Errors should roll back automatic transactions**
  *Symptoms*: Errors in single-statement transactions currently leave the transaction open, giving serialization errors when other txns try to modify a record.

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

### Incident Patch 1: `2d7cd32e` (2026-10-02)
**Commit Message**: Fix typo in MVCC documentation

Corrected a typo in the documentation regarding value encoding.

**File**: `docs/architecture/mvcc.md` (modified, +2/-2)
```diff
@@ -163,7 +163,7 @@ version of the key that's invisible to us -- if it is, we conflicted with a conc
 We use a range scan for this, like we did in `Transaction::get()`.
 
 If there are no conflicts, we go on to write `Key::Version(b"foo", self.version)` and encode the
-value as an `Option<value>` to accomodate the `None` tombstone marker. We also write a
+value as an `Option<value>` to accommodate the `None` tombstone marker. We also write a
 `Key::TxnWrite(version, key)` to keep track of the keys we've written in case we have to roll back.
 
 https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L524-L562
@@ -179,4 +179,4 @@ https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075
 
 <p align="center">
 ← <a href="encoding.md">Key/Value Encoding</a> &nbsp; | &nbsp; <a href="raft.md">Raft Consensus</a> →
-</p>
\ No newline at end of file
+</p>
```

---

### Incident Patch 2: `1c7dcea9` (2026-01-13)
**Commit Message**: docs: fix typo in example

**File**: `docs/examples.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ To start a five-node cluster on the local machine (requires a working
 [Rust compiler](https://www.rust-lang.org/tools/install)), run:
 
 ```
-$ ./cluster/run.rs
+$ ./cluster/run.sh
 toydb2 19:06:28 [ INFO] Listening on 0.0.0.0:9602 (SQL) and 0.0.0.0:9702 (Raft)
 toydb2 19:06:28 [ERROR] Failed connecting to Raft peer 127.0.0.1:9705: Connection refused
 toydb5 19:06:28 [ INFO] Listening on 0.0.0.0:9605 (SQL) and 0.0.0.0:9705 (Raft)
```

---

### Incident Patch 3: `8f48b078` (2025-09-25)
**Commit Message**: fix(docs): update outdated Bincode specification link

**File**: `docs/architecture/encoding.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ encoding scheme for Rust. Bincode is convenient because it can easily encode any
 data type. But we could also have chosen e.g. [JSON](https://en.wikipedia.org/wiki/JSON),
 [Protobuf](https://protobuf.dev), [MessagePack](https://msgpack.org/), or any other encoding.
 
-We won't dwell on the actual binary format here, see the [Bincode specification](https://github.com/bincode-org/bincode/blob/trunk/docs/spec.md)
+We won't dwell on the actual binary format here, see the [Bincode specification](https://git.sr.ht/~stygianentity/bincode/tree/trunk/item/docs/spec.md)
 for details.
 
 To use a consistent configuration for all encoding and decoding, we provide helper functions in
```

---

### Incident Patch 4: `8f5dedd6` (2025-08-16)
**Commit Message**: cluster/run.sh: fix ctrl-c handling

**File**: `cluster/run.sh` (modified, +2/-2)
```diff
@@ -25,5 +25,5 @@ done
 
 # Wait for the background processes to exit. Kill all toyDB processes when the
 # script exits (e.g. via Ctrl-C).
-trap 'kill $(jobs -p)' EXIT
-wait < <(jobs -p)
\ No newline at end of file
+trap 'kill -TERM -- -$$ 2>/dev/null' INT TERM EXIT
+wait
\ No newline at end of file
```

---

### Incident Patch 5: `e18fe81a` (2025-06-01)
**Commit Message**: docs/crate: fix README typos

**File**: `docs/crate/README.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ features:
 
 * ACID transactions with MVCC-based snapshot isolation.
 
-* Pluggable storage engine with [BitCask][bitcask] and [in-memory][memory] backends.
+* Pluggable storage engine with BitCask and in-memory backends.
 
 * Iterator-based query engine with heuristic optimization and time-travel  support.
 
```

---

### Incident Patch 6: `6c2c1772` (2025-05-11)
**Commit Message**: README.md: fix parser link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ been taken where possible.
 [memory]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/memory.rs
 [query]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/execution/executor.rs
 [optimizer]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/planner/optimizer.rs
-[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/parser.rs
+[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/parser/parser.rs
 
 ## Documentation
 
```

---

### Incident Patch 7: `b7234c59` (2025-05-11)
**Commit Message**: docs: more architecture guide cleanups

**File**: `docs/architecture/client.md` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@ module. It uses the same Bincode-based protocol that we saw in the server sectio
 
 ## Client Library
 
-The main client library `toydb::Client` is used to connect to a toyDB server:
+The main client library `toydb::Client` is used to communicate with a toyDB server:
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/client.rs#L15-L24
 
-When initialized, it connects to a toyDB server over TCP:
+When initialized, it connects to a toyDB server over TCP, which establishes a SQL session for it:
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/client.rs#L27-L33
 
@@ -36,7 +36,7 @@ toyDB server address to connect to and starts an interactive shell:
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/bin/toysql.rs#L29-L53
 
-This first attempts to connect to the toyDB server using the `toydb::Client` client, and then starts
+It first attempts to connect to the toyDB server using the `toydb::Client` client, and then starts
 an interactive shell using the [Rustyline](https://docs.rs/rustyline/latest/rustyline/) library.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/bin/toysql.rs#L55-L81
```

**File**: `docs/architecture/server.md` (modified, +22/-20)
```diff
@@ -1,4 +1,4 @@
-# Server and Client
+# Server
 
 Now that we've gone over the individual components, we'll tie them all together in the toyDB
 server `toydb::Server`, located in the [`server`](https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs) module.
@@ -12,50 +12,51 @@ For network protocol, the server uses the Bincode encoding that we've discussed
 section, sent over a TCP connection. There's no need for any further framing, since Bincode knows
 how many bytes to expect for each message depending on the type it's decoding into.
 
-The server does not use async Rust and e.g. [Tokio](https://tokio.rs), instead opting for regular OS
-threads. Async Rust can significantly complicate the code, which would obscure the main concepts,
-and any efficiency gains would be entirely irrelevant for toyDB.
+The server does not use [async Rust](https://rust-lang.github.io/async-book/) and e.g.
+[Tokio](https://tokio.rs), instead opting for regular OS threads. Async Rust can significantly
+complicate the code, which would obscure the main concepts, and any efficiency gains would be
+entirely irrelevant for toyDB.
 
 Internally in the server, messages are passed around between threads using
 [Crossbeam channels](https://docs.rs/crossbeam/latest/crossbeam/channel/index.html).
 
-The main server loop `Server::serve` listens for inbound TCP connections on port 9705 for Raft peers
-and 9605 for SQL clients, and spawns threads to process them. We'll look at Raft and SQL services
-separately.
+The main server loop `Server::serve()` listens for inbound TCP connections on port 9705 for Raft
+peers and 9605 for SQL clients, and spawns threads to process them. We'll look at Raft and SQL
+services separately.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L66-L110
 
 ## Raft Routing
 
-The heart of the server is the Raft processing thread `Server::raft_route`. This is responsible
-for periodically ticking the Raft node via `raft::Node::tick`, stepping inbound messages from
-Raft peers into the node via `raft::Node::step`, and sending outbound messages to peers.
+The heart of the server is the Raft processing thread `Server::raft_route()`. This is responsible
+for periodically ticking the Raft node via `raft::Node::tick()`, stepping inbound messages from
+Raft peers into the node via `raft::Node::step()`, and sending outbound messages to peers.
 
 It also takes inbound Raft client requests from the `sql::engine::Raft` SQL engine, steps them
-into the Raft node via `raft::Node::step`, and passes responses back to the appropriate client
+into the Raft node via `raft::Node::step()`, and passes responses back to the appropriate client
 as the node emits them.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L169-L249
 
-When the node starts up, it spawns a `Server::raft_send_peer` thread for each Raft peer to send
+When the node starts up, it spawns a `Server::raft_send_peer()` thread for each Raft peer to send
 outbound messages to them.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L84-L91
 
 These threads continually attempt to connect to the peer via TCP, and then read any outbound
-`raft::Envelope(raft::Message)` messages from `Server::raft_route` via a channel and writes the
+`raft::Envelope(raft::Message)` messages from `Server::raft_route()` via a channel and writes the
 messages into the TCP connection using Bincode:
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L146-L167
 
 The server also continually listens for inbound Raft TCP connections from peers in
-`Server::raft_accept`:
+`Server::raft_accept()`:
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L112-L134
 
-When an inbound connection is accepted, a `Server::raft_receive_peer` thread is spawned that reads
+When an inbound connection is accepted, a `Server::raft_receive_peer()` thread is spawned that reads
 Bincode-encoded `raft::Envelope(raft::Message)` messages from the TCP connection and sends them to
-`Server::raft_route` via a channel.
+`Server::raft_route()` via a channel.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L136-L144
 
@@ -72,13 +73,14 @@ The primary request type is `Request::Execute` which executes a SQL statement ag
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L312-L337
 
 The server sets up a `sql::engine::Raft` SQL engine, with a Crossbeam channel that's used to send
-`raft::Request` Raft client requests to `Server::raft_route` and onwards to the local `raft::Node`.
-It then spawns a `Server::sql_accept` thread to listen for inbound SQL client connections:
+`raft::Request` Raft client requests to `Server::raft_route()` and onwards to 
```

**File**: `docs/architecture/sql-data.md` (modified, +40/-34)
```diff
@@ -1,38 +1,45 @@
 # SQL Data Model
 
-The SQL data model is toyDB's representation of user data. It is made up of data types and schemas.
+The SQL data model represents user data in tables and rows. It is made up of data types and schemas,
+in the [`sql::types`](https://github.com/erikgrinaker/toydb/tree/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/types)
+module.
 
 ## Data Types
 
-toyDB supports four basic scalar data types as `sql::types::DataType`: booleans, floats, integers,
+toyDB supports four basic scalar data types as `sql::types::DataType`: booleans, integers, floats,
 and strings.
 
 https://github.com/erikgrinaker/toydb/blob/b2fe7b76ee634ca6ad31616becabfddb1c03d34b/src/sql/types/value.rs#L15-L27
 
-Concrete values are represented as `sql::types::Value`, using corresponding Rust types. toyDB also
-supports SQL `NULL` values, i.e. unknown values, following the rules of
+Specific values are represented as `sql::types::Value`, using the corresponding Rust types. toyDB
+also supports SQL `NULL` values, i.e. unknown values, following the rules of
 [three-valued logic](https://en.wikipedia.org/wiki/Three-valued_logic).
 
 https://github.com/erikgrinaker/toydb/blob/b2fe7b76ee634ca6ad31616becabfddb1c03d34b/src/sql/types/value.rs#L40-L64
 
-The `Value` type provides basic formatting, conversion, and mathematical operations. It also
-specifies comparison and ordering semantics, but these are subtly different from the SQL semantics.
-For example, in Rust code `Value::Null == Value::Null` yields `true`, while in SQL `NULL = NULL`
-yields `NULL`.  This mismatch is necessary for the Rust code to properly detect and process `Null`
-values, and the desired SQL semantics are implemented higher up in the SQL execution engine (we'll
-get back to this later).
+The `Value` type provides basic formatting, conversion, and mathematical operations.
+
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/types/value.rs#L68-L79
+
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/types/value.rs#L164-L370
+
+It also specifies comparison and ordering semantics, but these are subtly different from the SQL
+semantics. For example, in Rust code `Value::Null == Value::Null` yields `true`, while in SQL
+`NULL = NULL` yields `NULL`.  This mismatch is necessary for the Rust code to properly detect and
+process `Null` values, and the desired SQL semantics are implemented during expression evaluation
+which we'll cover below.
 
 https://github.com/erikgrinaker/toydb/blob/b2fe7b76ee634ca6ad31616becabfddb1c03d34b/src/sql/types/value.rs#L91-L162
 
-During execution, a row of values will be represented as `sql::types::Row`, with multiple rows
-emitted as `sql::types::Rows` row iterators:
+During execution, a row of values is represented as `sql::types::Row`, with multiple rows emitted
+via `sql::types::Rows` row iterators:
 
 https://github.com/erikgrinaker/toydb/blob/b2fe7b76ee634ca6ad31616becabfddb1c03d34b/src/sql/types/value.rs#L378-L388
 
 ## Schemas
 
-toyDB schemas support a single object: a table. There's only a single, unnamed database, and no
-named indexes, constraints, or other schema objects.
+toyDB schemas only support tables. There are no named indexes or constraints, and there's only a
+single unnamed database.
 
 Tables are represented by `sql::types::Table`:
 
@@ -47,42 +54,41 @@ The table name serves as a unique identifier, and can't be changed later. In fac
 are entirely static: they can only be created or dropped (there are no schema changes).
 
 Table schemas are stored in the catalog, represented by the `sql::engine::Catalog` trait. We'll
-revisit the implementation of this trait in the storage section below.
+revisit the implementation of this trait in the SQL storage section.
 
 https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/sql/engine/engine.rs#L60-L79
 
-Table schemas are validated (e.g. during creation) via the `Table::validate()` method, which
-enforces invariants and internal consistency. It uses the catalog to look up information about other
-tables, e.g. that foreign key references point to a valid target column.
+Table schemas are validated when created via `Table::validate()`, which enforces invariants and
+internal consistency. It uses the catalog to look up information about other tables, e.g. that
+foreign key references point to a valid target column in a different table.
 
 https://github.com/erikgrinaker/toydb/blob/c2b0f7f1d6cbf6e2cdc09fc0aec7b050e840ec21/src/sql/types/schema.rs#L98-L170
 
-It also has a `Table::validate_row()` method which is used to validate that a given
-`sql::types::Row` conforms to the schema (e.g. that the value data types match the column data
-types). It uses a `sql::engine::Transaction` to look up other rows in the database, e.g. to check
-for primary key conflicts (we'll get back to this below).
+Table rows are validated via `Table::validate_row()
```

**File**: `docs/architecture/sql-execution.md` (modified, +33/-32)
```diff
@@ -1,46 +1,47 @@
 # SQL Execution
 
-Ok, now that the planner and optimizer has done all the hard work of figuring out how to execute a
+Now that the planner and optimizer have done all the hard work of figuring out how to execute a
 query, it's time to actually execute it.
 
 ## Plan Executor
 
 Plan execution is done by `sql::execution::Executor` in the
 [`sql::execution`](https://github.com/erikgrinaker/toydb/tree/9419bcf6aededf0e20b4e7485e2a5fa3e975d79f/src/sql/execution)
-module, using a `sql::engine::Transaction` to perform read/write operations on the SQL engine.
+module, using a `sql::engine::Transaction` to access the SQL storage engine.
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L14-L49
 
 The executor takes a `sql::planner::Plan` as input, and will return an `ExecutionResult` depending
 on the statement type.
 
-https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L330-L338
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/execution/executor.rs#L331-L339
 
 When executing the plan, the executor will branch off depending on the statement type:
 
-https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L56-L100
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/execution/executor.rs#L57-L101
 
-We'll focus on `SELECT` queries here, which is the most interesting.
+We'll focus on `SELECT` queries here, which are the most interesting.
 
-toyDB uses the iterator model (also known as the volcano model) for query execution. In the case
-of a `SELECT` query, the result is a result row iterator, and pulling from this iterator by calling
-`next()` will drive the entire execution pipeline. This maps very naturally onto Rust's iterators,
-and we leverage these to construct the execution pipeline as nested iterators.
+toyDB uses the iterator model (also known as the volcano model) for query execution. In the case of
+a `SELECT` query, the result is a row iterator, and pulling from this iterator by calling `next()`
+will drive the entire execution pipeline by recursively calling `next()` on the child nodes' row
+iterators. This maps very naturally onto Rust's iterators, and we leverage these to construct the
+execution pipeline as nested iterators.
 
 Execution itself is fairly straightforward, since we're just doing exactly what the planner tells us
 to do in the plan. We call `Executor::execute_node` recursively on each `sql::planner:Node`,
 starting with the root node. Each node returns a result row iterator that the parent node can pull
 its input rows from, process them, and output the resulting rows via its own row iterator (with the
 root node's iterator being returned to the caller):
 
-https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L102-L103
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/execution/executor.rs#L103-L104
 
-`Executor::execute_node` will simply look at the type of `Node`, recursively call
-`Executor::execute_node` on any child nodes, and then process the rows accordingly.
+`Executor::execute_node()` will simply look at the type of `Node`, recursively call
+`Executor::execute_node()` on any child nodes, and then process the rows accordingly.
 
-https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L102-L211
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/execution/executor.rs#L103-L212
 
-We won't discuss every plan node in details, but let's consider the movie plan we've looked at
+We won't discuss every plan node in detail, but let's consider the movie plan we've looked at
 previously:
 
 ```
@@ -52,62 +53,62 @@ Select
          └─ Scan: genres
 ```
 
-We'll recursively call `execute_node` until we end up in the two `Scan` nodes. These simply
-call through to the SQL engine (either using Raft or local disk) via `Transaction::scan`, passing
+We'll recursively call `execute_node()` until we end up in the two `Scan` nodes. These simply
+call through to the SQL engine (either using Raft or local disk) via `Transaction::scan()`, passing
 in the scan predicate if any, and return the resulting row iterator:
 
-https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/execution/executor.rs#L202-L203
+https://github.com/erikgrinaker/toydb/blob/686d3971a253bfc9facc2ba1b0e716cff5c109fb/src/sql/execution/executor.rs#L203-L204
 
 `HashJoin` will then join the output rows from the `movies` and `genres` iterators by using a
 hash join. This builds an in-memory table for `genres` and then iterates over `movies`, joining
 the rows:
 
-https://github.com/erikgrinaker/toydb/blob/213e5c
```

**File**: `docs/architecture/sql-optimizer.md` (modified, +22/-25)
```diff
@@ -93,15 +93,14 @@ Additionally, `ConstantFolding` also short-circuits logical expressions. For exa
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/planner/optimizer.rs#L58-L84
 
-As the code comment mentions though, this doesn't fold as far as possible. It doesn't attempt to
-rearrange expressions, which would require knowledge of precedence rules. For example,
-`(1 + foo) - 2` could be folded into `foo - 1` by first rearranging it as `foo + (1 - 2)`, but we
-don't do this currently.
+As the code comment mentions though, this doesn't fold optimally: it doesn't attempt to rearrange
+expressions, which would require knowledge of precedence rules. For example, `(1 + foo) - 2` could
+be folded into `foo - 1` by first rearranging it as `foo + (1 - 2)`, but we don't do this currently.
 
 ## Filter Pushdown
 
 The `FilterPushdown` optimizer attempts to push filter predicates as far down into the plan as
-possible, to reduce the amount of work we do.
+possible, to reduce the number of rows each node has to process.
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/planner/optimizer.rs#L90-L95
 
@@ -117,10 +116,10 @@ Select
             └─ Scan: genres
 ```
 
-Even though we're filtering on `release >= 2000`, the `Scan` node still has to read all of them
-from disk and send them via Raft, and the `NestedLoopJoin` node still has to join all of them.
-It would be nice if we could push this filtering into into the `NestedLoopJoin` and `Scan` nodes
-and avoid this work, which is exactly what `FilterPushdown` does.
+Even though we're filtering on `release >= 2000`, the `Scan` node still has to read all of them from
+disk and send them via Raft, and the `NestedLoopJoin` node still has to join all of them. It would
+be nice if we could push this filtering into the `NestedLoopJoin` and `Scan` nodes and avoid this
+extra work, and this is exactly what `FilterPushdown` does.
 
 The only plan nodes that have predicates that can be pushed down are `Filter` nodes and
 `NestedLoopJoin` nodes, so we recurse through the plan tree and look for these nodes, attempting
@@ -159,10 +158,9 @@ discussed previously. This allows us to examine and push down each AND part in i
 has the same effect regardless of whether it is evaluated in the `NestedLoopJoin` node or one of
 the source nodes. Our expression is already in conjunctive normal form, though.
 
-We then look at each AND part, and check which side of the join they have column references for.
-If they only reference one of the sides, then the expression can be pushed down into it. We also
-make some effort here to move primary/foreign key constants across to both sides, but we'll gloss
-over that.
+We then look at each AND part, and check which side of the join it has column references for.  If it
+only references one of the sides, then the expression can be pushed down into it. We also make some
+effort here to move primary/foreign key constants across to both sides, but we'll gloss over that.
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/planner/optimizer.rs#L155-L247
 
@@ -213,7 +211,7 @@ The code is as outlined above:
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/planner/optimizer.rs#L254-L303
 
-Helped by `Expression::is_column_lookup` and `Expression::into_column_values`:
+Helped by `Expression::is_column_lookup()` and `Expression::into_column_values()`:
 
 https://github.com/erikgrinaker/toydb/blob/9419bcf6aededf0e20b4e7485e2a5fa3e975d79f/src/sql/types/expression.rs#L363-L421
 
@@ -227,14 +225,13 @@ A [nested loop join](https://en.wikipedia.org/wiki/Nested_loop_join) is a very i
 algorithm, which iterates over all rows in the right source for each row in the left source to see
 if they match. However, it is completely general, and can join on arbitraily complex predicates.
 
-In the common case where the join predicate is an equality check (i.e. an
-[equijoin](https://en.wikipedia.org/wiki/Relational_algebra#θ-join_and_equijoin)), such as
-`movies.genre_id = genres.id`, then we can instead use a
-[hash join](https://en.wikipedia.org/wiki/Hash_join). This scans the right table once, builds an
-in-memory hash table from it, and for each left row it looks up any right rows in the hash table.
-This is a much more efficient O(n) algorithm.
+In the common case where the join predicate is an equality comparison such as
+`movies.genre_id = genres.id` (i.e. an [equijoin](https://en.wikipedia.org/wiki/Relational_algebra#θ-join_and_equijoin)),
+then we can instead use a [hash join](https://en.wikipedia.org/wiki/Hash_join). This scans the right
+table once, builds an in-memory hash table from it, and for each left row it looks up any right rows
+in the hash table. This is a much more efficient O(n) algorithm.
 
-In our previous movie example, we are in fact doing an equijoin, and so our `NestedLoopJoi
```

**File**: `docs/architecture/sql-parser.md` (modified, +11/-9)
```diff
@@ -1,7 +1,7 @@
 # SQL Parsing
 
-And so we finally arrive at SQL. The SQL parser is the first stage in processing SQL
-queries and statements, located in the [`src/sql/parser`](https://github.com/erikgrinaker/toydb/tree/39c6b60afc4c235f19113dc98087176748fa091d/src/sql/parser)
+We finally arrive at SQL. The SQL parser is the first stage in processing SQL queries and
+statements, located in the [`sql::parser`](https://github.com/erikgrinaker/toydb/tree/39c6b60afc4c235f19113dc98087176748fa091d/src/sql/parser)
 module.
 
 The SQL parser's job is to take a raw SQL string and turn it into a structured form that's more
@@ -99,7 +99,7 @@ string are well-formed. For example, the following input string:
 Will result in these tokens:
 
 ```
-String("foo"), CloseParen, Number("3.14"), Keyword(Select), Plus, Ident("x")
+String("foo") CloseParen Number("3.14") Keyword(Select) Plus Ident("x")
 ```
 
 Tokens and keywords are represented by the `sql::parser::Token` and `sql::parser::Keyword` enums
@@ -137,12 +137,14 @@ kinds of SQL statements that we support, along with their contents:
 
 https://github.com/erikgrinaker/toydb/blob/39c6b60afc4c235f19113dc98087176748fa091d/src/sql/parser/ast.rs#L6-L145
 
-The nested tree structure is particularly apparent with _expressions_ -- these represent values and
-operations which will eventually _evaluate_ to a single value. For example, the expression
-`2 * 3 - 4 / 2`, which evaluates to the value `4`.
+The nested tree structure is particularly apparent with expressions, which represent values and
+operations on them. For example, the expression `2 * 3 - 4 / 2`, which evaluates to the value `4`.
 
-These expressions are represented as `sql::parser::ast::Expression`, and can be nested indefinitely
-into a tree structure.
+We've seen in the data model section how such expressions are represented as
+`sql::types::Expression`, but before we get there we have to parse them. The parser has its own
+representation `sql::parser::ast::Expression` -- this is necessary e.g. because in the AST, we
+represent columns as names rather than numeric indexes (we don't know yet which columns exist or
+what their names are, we'll get to that during planning).
 
 https://github.com/erikgrinaker/toydb/blob/39c6b60afc4c235f19113dc98087176748fa091d/src/sql/parser/ast.rs#L147-L170
 
@@ -215,7 +217,7 @@ than that of the operators preceding them (hence "precedence climbing"). For exa
 2 * 3 - 4 / 2
 ```
 
-The algorithm is documented in more detail on `Parser::parse_expression`:
+The algorithm is documented in more detail on `Parser::parse_expression()`:
 
 https://github.com/erikgrinaker/toydb/blob/39c6b60afc4c235f19113dc98087176748fa091d/src/sql/parser/parser.rs#L501-L696
 
```

**File**: `docs/architecture/sql-planner.md` (modified, +18/-16)
```diff
@@ -1,8 +1,8 @@
 # SQL Planning
 
-The SQL planner in [`sql/planner`](https://github.com/erikgrinaker/toydb/tree/c64012e29c5712d6fe028d3d5375a98b8faea266/src/sql/planner)
-takes a SQL statement AST from the parser and generates an execution plan for it. We won't actually
-execute it just yet though, only figure out how to execute it.
+The SQL planner in the [`sql::planner`](https://github.com/erikgrinaker/toydb/tree/c64012e29c5712d6fe028d3d5375a98b8faea266/src/sql/planner)
+module takes a SQL statement AST from the parser and generates an execution plan for it. We won't
+actually execute it just yet though, only figure out how to execute it.
 
 ## Execution Plan
 
@@ -16,7 +16,7 @@ emits a stream of SQL rows as output, and may take streams of input rows from ch
 
 https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/sql/planner/plan.rs#L106-L175
 
-Here is an example (taken from the `Plan` code comment above):
+Here is an example, taken from the `Plan` code comment above:
 
 ```sql
 SELECT title, released, genres.name AS genre
@@ -63,12 +63,13 @@ the `Order` node still needs access to the column data to sort by it).
 
 The planner uses a `sql::planner::Scope` to keep track of which column names are currently visible,
 and which column indexes they refer to. For each node the planner builds, starting from the leaves,
-it creates a new `Scope` that tracks how columns are modified and rearranged by the node.
+it creates a new `Scope` that contains the currently visible columns, tracking how they are modified
+and rearranged by each node.
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L577-L610
 
-When an expression refers to a column name, the planner can use `Scope::lookup_column` to find out
-which column number the expression should take its input value from.
+When an AST expression refers to a column name, the planner can use `Scope::lookup_column()` to find
+out which column number the expression should take its input value from.
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L660-L686
 
@@ -154,24 +155,24 @@ https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L283-L289
 
-`Planner::build_from` first encounters the `ast::From::Join` item, which joins `movies` and
+`Planner::build_from()` first encounters the `ast::From::Join` item, which joins `movies` and
 `genres`. This will build a `Node::NestedLoopJoin` plan node for the join, which is the simplest and
 most straightforward join algorithm -- it simply iterates over all rows in the `genres` table for
 every row in the `movies` table and emits the joined rows (we'll see how to optimize it with a
 better join algorithm later).
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L319-L344
 
-It first recurses into `Planner::build_from` to build each of the `ast::From::Table` nodes for each
-table.  This will look up the table schemas in the catalog, add them to the current scope, and build
-a `Node::Scan` node which will emit all rows from each table. The `Node::Scan` nodes are placed into
-the `Node::NestedLoopJoin` above.
+It first recurses into `Planner::build_from()` to build each of the `ast::From::Table` nodes for
+each table.  This will look up the table schemas in the catalog, add them to the current scope, and
+build a `Node::Scan` node which will emit all rows from each table. The `Node::Scan` nodes are
+placed into the `Node::NestedLoopJoin` above.
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L312-L317
 
 While building the `Node::NestedLoopJoin`, it also needs to convert the join expression
 `movies.genre_id = genres.id` into a proper `sql::types::Expression`. This is done by
-`Planner::build_expression`:
+`Planner::build_expression()`:
 
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L493-L568
 
@@ -228,9 +229,6 @@ sorts them by the order expression.
 https://github.com/erikgrinaker/toydb/blob/6f6cec4db10bc015a37ee47ff6c7dae383147dd5/src/sql/planner/planner.rs#L245-L252
 
 And that's it. The `Node::Order` is placed into the root `Plan::Select`, and we have our final plan.
-We'll see how to execute it soon, but first we should optimize it to see if we can make it run
-faster -- in particular, to see if we can avoid reading all movies from storage, and if we can do
-better than the very slow nested loop join.
 
 ```
 Select
@@ -242,6 +240,10 @@ Select
             └─ Scan: genres
 ```
 
+We'll see how to execute it soon, but first we should optimize it to see if we can make it run
+faster -- in particular, to see if we can avoid reading all movie
```

**File**: `docs/architecture/sql-raft.md` (modified, +26/-7)
```diff
@@ -1,8 +1,8 @@
 # SQL Raft Replication
 
-toyDB uses Raft to replicate SQL storage across a cluster of nodes (see the Raft section above for
-details). All nodes will store a copy of the SQL database, and the Raft leader will replicate writes
-across nodes and execute reads.
+toyDB uses Raft to replicate SQL storage across a cluster of nodes (see the Raft section for
+details). All nodes will store a full copy of the SQL database, and the Raft leader will replicate
+writes across nodes and execute reads.
 
 Recall the Raft state machine interface `raft::State`:
 
@@ -44,20 +44,39 @@ send requests to the local Raft node (we'll see how this plumbing works in the s
 
 https://github.com/erikgrinaker/toydb/blob/c2b0f7f1d6cbf6e2cdc09fc0aec7b050e840ec21/src/sql/engine/raft.rs#L80-L95
 
-The channel takes a `raft::Request` containing binary Raft client requests, and also a return
-channel where the Raft node can send back a `raft::Response`. The Raft engine has a few convenience
-methods to send requests and receive responses, for both read and write requests:
+The channel takes a `raft::Request` containing binary Raft client requests and a return channel
+where the Raft node can send back a `raft::Response`. The Raft engine has a few convenience methods
+to send requests and receive responses, for both read and write requests:
 
 https://github.com/erikgrinaker/toydb/blob/c2b0f7f1d6cbf6e2cdc09fc0aec7b050e840ec21/src/sql/engine/raft.rs#L114-L135
 
-And the implementation of the `Engine` and `Transaction` traits simply send requests via Raft:
+And the implementation of the `sql::engine::Engine` and `sql::engine::Transaction` traits simply
+send these requests via Raft:
 
 https://github.com/erikgrinaker/toydb/blob/c2b0f7f1d6cbf6e2cdc09fc0aec7b050e840ec21/src/sql/engine/raft.rs#L194-L276
 
 One thing to note here is that we don't support streaming data via Raft, so e.g. the
 `Transaction::scan` method will buffer the entire result in a `Vec`. With a full table scan, this
 will load the entire table into memory -- that's unfortunate, but we keep it simple.
 
+To summarize, this is what happens when `Transaction::insert()` is called to insert a row via Raft:
+
+1. `sql::engine::raft::Transaction::insert()`: called to insert a row.
+2. `sql::engine::raft::Write::Insert`: enum representation of the insert command.
+3. `raft::Request::Write`: raft request containing the Bincode-encoded `Write::Insert` command.
+4. `sql::engine::raft::Engine::tx`: sends the `Request::Write` and response channel to Raft.
+5. `raft::Node::step()`: the `Request::Write` is given to Raft in a `Message::ClientRequest`.
+6. Raft does its replication thing, and commits the command's log entry.
+7. `raft::State::apply()`: the Bincode-encoded `Write::Insert` is passed to the state machine.
+8. `sql::engine::raft::State::apply()`: decodes the command to a `Write::Insert`.
+9. `sql::engine::raft::State::local`: contains the `Local` engine on each node.
+10. `sql::engine::local::Engine::resume()`: called to obtain the SQL/MVCC transaction.
+11. `sql::engine::local::Transaction::insert()`: the row is inserted to the local engine.
+12. `raft::RawNode::tx`: the `Ok(())` result is sent as a Bincode-encoded `Message::ClientResponse`.
+13. `sql::engine::raft::Transaction::insert()`: receives the result and returns it to the caller.
+
+The plumbing here will be covered in more details in the server section.
+
 ---
 
 <p align="center">
```

---

### Incident Patch 8: `686d3971` (2025-05-11)
**Commit Message**: docs: clean up architecture guide

**File**: `README.md` (modified, +10/-9)
```diff
@@ -2,9 +2,9 @@
 
 Distributed SQL database in Rust, built from scratch as an educational project. Main features:
 
-* [Raft distributed consensus engine][raft] for linearizable state machine replication.
+* [Raft distributed consensus][raft] for linearizable state machine replication.
 
-* [ACID transaction engine][txn] with MVCC-based snapshot isolation.
+* [ACID transactions][txn] with MVCC-based snapshot isolation.
 
 * [Pluggable storage engine][storage] with [BitCask][bitcask] and [in-memory][memory] backends.
 
@@ -31,17 +31,17 @@ been taken where possible.
 [memory]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/memory.rs
 [query]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/execution/executor.rs
 [optimizer]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/planner/optimizer.rs
-[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/mod.rs
+[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/parser.rs
 
 ## Documentation
 
 * [Architecture guide](docs/architecture/index.md): a guided tour of toyDB's code and architecture.
 
 * [SQL examples](docs/examples.md): walkthrough of toyDB's SQL features.
 
-* [SQL reference](docs/sql.md): toyDB's SQL reference documentation.
+* [SQL reference](docs/sql.md): reference documentation for toyDB's SQL dialect.
 
-* [References](docs/references.md): research material used while building toyDB.
+* [References](docs/references.md): research materials used while building toyDB.
 
 ## Usage
 
@@ -161,9 +161,10 @@ The available workloads are:
 
 For more information about workloads and parameters, run `cargo run --bin workload -- --help`.
 
-Example workload results are listed below. Write performance is pretty atrocious, due to fsyncs 
-and a lack of write batching at the Raft level. Disabling fsyncs, or using the in-memory engine, 
-significantly improves write performance.
+Example workload results are listed below. Write performance is atrocious, due to
+[fsync](https://en.wikipedia.org/wiki/Sync_(Unix)) and a lack of write batching in the Raft layer.
+Disabling fsync, or using the in-memory engine, significantly improves write performance (at the
+expense of durability).
 
 | Workload | BitCask     | BitCask w/o fsync | Memory      |
 |----------|-------------|-------------------|-------------|
@@ -181,4 +182,4 @@ library 'toydb'".
 
 ## Credits
 
-toyDB logo is courtesy of [@jonasmerlin](https://github.com/jonasmerlin).
\ No newline at end of file
+The toyDB logo is courtesy of [@jonasmerlin](https://github.com/jonasmerlin).
\ No newline at end of file
```

**File**: `docs/architecture/encoding.md` (modified, +34/-35)
```diff
@@ -1,7 +1,7 @@
 # Key/Value Encoding
 
 The key/value store uses binary `Vec<u8>` keys and values, so we need an encoding scheme to 
-translate between Rust in-memory data structures and the on-disk binary data. This is provided by
+translate between in-memory Rust data structures and the on-disk binary data. This is provided by
 the [`encoding`](https://github.com/erikgrinaker/toydb/tree/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding)
 module, with separate schemes for key and value encoding.
 
@@ -15,18 +15,19 @@ data type. But we could also have chosen e.g. [JSON](https://en.wikipedia.org/wi
 We won't dwell on the actual binary format here, see the [Bincode specification](https://github.com/bincode-org/bincode/blob/trunk/docs/spec.md)
 for details.
 
-To use a consistent configuration for all encoding and decoding, we provide helper functions using
-`bincode::config::standard()` in the [`encoding::bincode`](https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding/bincode.rs)
-module:
+To use a consistent configuration for all encoding and decoding, we provide helper functions in
+the [`encoding::bincode`](https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding/bincode.rs)
+module which use `bincode::config::standard()`.
 
 https://github.com/erikgrinaker/toydb/blob/0ce1fb34349fda043cb9905135f103bceb4395b4/src/encoding/bincode.rs#L15-L27
 
-Bincode uses the very common [Serde](https://serde.rs) framework for its API. toyDB also provides
-an `encoding::Value` helper trait for value types with automatic `encode()` and `decode()` methods:
+Bincode uses the very common [Serde](https://serde.rs) framework for its API. toyDB also provides an
+`encoding::Value` helper trait for value types which adds automatic `encode()` and `decode()`
+methods:
 
 https://github.com/erikgrinaker/toydb/blob/b57ae6502e93ea06df00d94946a7304b7d60b977/src/encoding/mod.rs#L39-L68
 
-Here's an example of how this is used to encode and decode an arbitrary `Dog` data type:
+Here's an example of how this can be used to encode and decode an arbitrary `Dog` data type:
 
 ```rust
 #[derive(serde::Serialize, serde::Deserialize)]
@@ -42,7 +43,7 @@ let pluto = Dog { name: "Pluto".into(), age: 4, good_boy: true };
 let bytes = pluto.encode();
 println!("{bytes:02x?}");
 
-// Outputs [05, 50, 6c, 75, 74, 6f, 04, 01].
+// Outputs [05, 50, 6c, 75, 74, 6f, 04, 01]:
 //
 // * Length of string "Pluto": 05.
 // * String "Pluto": 50 6c 75 74 6f.
@@ -54,37 +55,37 @@ let pluto = Dog::decode(&bytes)?; // gives us back Pluto
 
 ## `Keycode` Key Encoding
 
-Unlike values, keys can't just use any binary encoding like Bincode. As mentioned before, the
-storage engine sorts data by key to enable range scans, which will be used e.g. for SQL table scans,
-limited SQL index scans, Raft log scans, etc. Because of this, the encoding needs to preserve the
-[lexicographical order](https://en.wikipedia.org/wiki/Lexicographic_order) of the encoded values:
-the binary byte slices must sort in the same order as the original values.
+Unlike values, keys can't just use any binary encoding like Bincode. As mentioned in the storage
+section, the storage engine sorts data by key to enable range scans. The key encoding must therefore
+preserve the [lexicographical order](https://en.wikipedia.org/wiki/Lexicographic_order) of the
+encoded values: the binary byte slices must sort in the same order as the original values.
 
-As an example of why we can't just use Bincode, let's consider two strings: "house" should be
-sorted before "key", alphabetically. However, Bincode encodes strings prefixed by their length, so
-"key" would be sorted before "house" in binary form:
+As an example of why we can't just use Bincode, consider the strings "house" and "key". These should
+be sorted in alphabetical order: "house" before "key". However, Bincode encodes strings prefixed by
+their length, so "key" would be sorted before "house" in binary form:
 
 ```
-03 6b 65 79       ← 3 bytes: key
-05 68 6f 75 73 65 ← 5 bytes: house
+03 6b 65 79        ← 3 bytes: key
+05 68 6f 75 73 65  ← 5 bytes: house
 ```
 
-For similar reasons, we can't just encode numbers in their native binary form, because the
-[little-endian](https://en.wikipedia.org/wiki/Endianness) representation will sometimes order very
-large numbers before small numbers, and the [sign bit](https://en.wikipedia.org/wiki/Sign_bit)
-will order positive numbers before negative numbers.
+For similar reasons, we can't just encode numbers in their native binary form: the
+[little-endian](https://en.wikipedia.org/wiki/Endianness) representation will order very large
+numbers before small numbers, and the [sign bit](https://en.wikipedia.org/wiki/Sign_bit) will order
+positive numbers before negative numbers. This would violate the ordering of natural numbers.
 
 We also have to be careful with value sequences, which should be ordered element-wise. For example
```

**File**: `docs/architecture/mvcc.md` (modified, +86/-70)
```diff
@@ -1,94 +1,113 @@
 # MVCC Transactions
 
-Transactions provide _atomicity_: a user can submit multiple writes which will take effect as a
-single group, at the same instant, when they are _committed_. Other users should never see some of
-the writes without the others. And they provide _durability_: committed writes should never be lost
-(even if the system crashes), and should remain visible.
-
-Transactions also provide _isolation_: they should appear to have the entire database to themselves,
-unaffected by what other users may be doing at the same time. Two transactions may conflict, in
-which case one has to retry, but if a transaction succeeds then the user can rest easy that the
-operations were executed correctly without interference. This is a very powerful guarantee, since
-it basically eliminates the risk of [race conditions](https://en.wikipedia.org/wiki/Race_condition)
-(a class of bugs that are notoriously hard to fix). 
-
-To illustrate how transactions work, here's an example test script for the MVCC code (there's a
-bunch of [other test scripts](https://github.com/erikgrinaker/toydb/tree/aa14deb71f650249ce1cab8828ed7bcae2c9206e/src/storage/testscripts/mvcc)
+Transactions are groups of reads and writes (e.g. to different keys) that are submitted together as
+a single unit. For example, a bank transaction that transfers $100 from account A to account B might
+consist of this group of reads and writes:
+
+```
+a = get(A)
+b = get(B)
+if a < 100:
+    error("insufficient balance")
+set(A, a - 100)
+set(B, b + 100)
+```
+
+toyDB provides [ACID](https://en.wikipedia.org/wiki/ACID) transactions, a set of very strong
+guarantees:
+
+* **Atomicity:** all of the writes take effect as an single, atomic unit, at the same instant, when
+  they are _committed_. Other users will never see some of the writes without the others.
+
+* **Consistency:** database constraints are never violated (e.g. referential integrity or uniqueness
+  contraints). We'll see how this is implemented later in the SQL execution layer.
+
+* **Isolation:** users should appear to have the entire database to themselves, unaffected by other
+  simultaneous users. Two transactions may conflict, in which case one has to retry, but if a
+  transaction succeeds then the user knows with certainty that the operations were executed without
+  interference by anyone else. This eliminates the risk of [race conditions](https://en.wikipedia.org/wiki/Race_condition).
+  
+* **Durability:** committed writes are never lost (even if the system crashes).
+
+To illustrate how transactions work, here's an example MVCC test script where two concurrent users
+modify a set of bank accounts (there's many [other test scripts](https://github.com/erikgrinaker/toydb/tree/aa14deb71f650249ce1cab8828ed7bcae2c9206e/src/storage/testscripts/mvcc)
 there too):
 
 https://github.com/erikgrinaker/toydb/blob/a73e24b7e77671b9f466e0146323cd69c3e27bdf/src/storage/testscripts/mvcc/bank#L1-L69
 
-To provide such [ACID transactions](https://en.wikipedia.org/wiki/ACID), toyDB uses a common
-technique called [Multi-Version Concurrency Control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)
-(MVCC). It is implemented at the key/value storage level, in the
-[`storage::mvcc`](https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs)
-module. It sits on top of any `storage::Engine` implementation, which it uses for actual data
-storage.
+To provide these guarantees, toyDB uses a common technique called
+[Multi-Version Concurrency Control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)
+(MVCC). It is implemented at the key/value storage level, in the [`storage::mvcc`](https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs)
+module. It uses a `storage::Engine` for actual data storage.
 
 https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L220-L231
 
-MVCC provides a guarantee called [snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation):
-a transaction sees a snapshot of the database as it was when the transaction began. Any later
-changes will be invisible to it.
+MVCC provides an [isolation level](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Isolation_levels)
+called [snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation): a transaction sees a
+snapshot of the database as it was when the transaction began. Any later changes are invisible to
+it.
 
-It does this by storing several historical versions of key/value pairs. The version number is simply
-a number that's incremented for every new transaction:
+It does this by storing historical versions of key/value pairs. The version number is simply a
+number that's incremented for every new transaction:
 
 https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L
```

**File**: `docs/architecture/overview.md` (modified, +10/-8)
```diff
@@ -1,27 +1,29 @@
 # Overview
 
 toyDB consists of a cluster of nodes that execute [SQL](https://en.wikipedia.org/wiki/SQL)
-transactions against a replicated state machine. Clients can connect to any node in the cluster
-and submit SQL statements.
+transactions against a replicated state machine. Clients can connect to any node in the cluster and
+submit SQL statements. The cluster remains available if a minority of nodes crash or disconnect,
+but halts if a majority of nodes fail.
 
 ## Properties
 
 * **Distributed:** runs across a cluster of nodes.
-* **Highly available:** tolerates loss of a minority of nodes.
-* **SQL compliant:** correctly supports most common SQL features.
+* **Highly available:** tolerates failure of a minority of nodes.
+* **SQL compliant:** correctly supports most common [SQL](https://en.wikipedia.org/wiki/SQL)
+  features.
 * **Strongly consistent:** committed writes are immediately visible to all readers ([linearizability](https://en.wikipedia.org/wiki/Linearizability)).
-* **Transactional:** provides ACID transactions:
+* **Transactional:** provides [ACID](https://en.wikipedia.org/wiki/ACID) transactions
   * **Atomic:** groups of writes are applied as a single, atomic unit.
   * **Consistent:** database constraints and referential integrity are always enforced.
   * **Isolated:** concurrent transactions don't affect each other ([snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation)).
   * **Durable:** committed writes are never lost.
 
 For simplicity, toyDB is:
 
-* **Not scalable:** every node stores the full dataset, and all reads/writes happen on one node.
+* **Not scalable:** every node stores the full dataset, and reads/writes execute on one node.
 * **Not reliable:** only handles crash failures, not e.g. partial network partitions or node stalls.
 * **Not performant:** data processing is slow, and not optimized at all.
-* **Not efficient:** no compression or garbage collection, can load entire tables into memory.
+* **Not efficient:** loads entire tables into memory, no compression or garbage collection, etc.
 * **Not full-featured:** only basic SQL functionality is implemented.
 * **Not backwards compatible:** changes to data formats and protocols will break databases.
 * **Not flexible:** nodes can't be added or removed while running, and take a long time to join.
@@ -34,7 +36,7 @@ Internally, toyDB is made up of a few main components:
 * **Storage engine:** stores data on disk and manages transactions.
 * **Raft consensus engine:** replicates data and coordinates cluster nodes.
 * **SQL engine:** organizes SQL data, manages SQL sessions, and executes SQL statements.
-* **Server:** manages network connections, both with SQL clients and Raft nodes.
+* **Server:** manages network communication, both with SQL clients and Raft nodes.
 * **Client:** provides a SQL user interface and communicates with the server.
 
 This diagram illustrates the internal structure of a single toyDB node:
```

**File**: `docs/architecture/raft.md` (modified, +48/-37)
```diff
@@ -2,7 +2,7 @@
 
 [Raft](https://raft.github.io) is a distributed consensus protocol which replicates data across a
 cluster of nodes in a consistent and durable manner. It is described in the very readable
-[Raft paper](https://raft.github.io/raft.pdf), and the more comprehensive
+[Raft paper](https://raft.github.io/raft.pdf), and in the more comprehensive
 [Raft thesis](https://web.stanford.edu/~ouster/cgi-bin/papers/OngaroPhD.pdf).
 
 The toyDB Raft implementation is in the [`raft`](https://github.com/erikgrinaker/toydb/tree/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/raft)
@@ -13,7 +13,8 @@ https://github.com/erikgrinaker/toydb/blob/d96c6dd5ae7c0af55ee609760dcd958c289a4
 Raft is fundamentally the same protocol as [Paxos](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
 and [Viewstamped Replication](https://pmg.csail.mit.edu/papers/vr-revisited.pdf), but an
 opinionated variant designed to be simple, understandable, and practical. It is widely used in the
-industry.
+industry: [CockroachDB](https://www.cockroachlabs.com), [TiDB](https://www.pingcap.com),
+[etcd](https://etcd.io), [Consul](https://developer.hashicorp.com/consul), and many others.
 
 Briefly, Raft elects a leader node which coordinates writes and replicates them to followers. Once a
 majority (>50%) of nodes have acknowledged a write, it is considered durably committed. It is common
@@ -31,16 +32,16 @@ The Raft leader appends writes to an ordered command log, which is then replicat
 Once a majority has replicated the log up to a given entry, that log prefix is committed and then
 applied to a state machine. This ensures that all nodes will apply the same commands in the same
 order and eventually reach the same state (assuming the commands are deterministic). Raft itself
-doesn't care what the state machine and commands are, but in toyDB's case it is a key/value store
-with put/delete commands.
+doesn't care what the state machine and commands are, but in toyDB's case it's SQL tables and rows
+stored in an MVCC key/value store.
 
 This diagram from the Raft paper illustrates how a Raft node receives a command from a client (1),
 adds it to its log and reaches consensus with other nodes (2), then applies it to its state machine
 (3) before returning a result to the client (4):
 
 <img src="./images/raft.svg" alt="Raft node" width="400" style="display: block; margin: 30px auto;">
 
-You may notice that Raft is not very scalable, since all writes and reads go via the leader node,
+You may notice that Raft is not very scalable, since all reads and writes go via the leader node,
 and every node must store the entire dataset. Raft solves replication and availability, but not
 scalability. Real-world systems typically provide horizontal scalability by splitting a large
 dataset across many separate Raft clusters (i.e. sharding), but this is out of scope for toyDB.
@@ -57,14 +58,14 @@ which illustrate the protocol in a wide variety of scenarios.
 
 Raft replicates an ordered command log consisting of `raft::Entry`:
 
-https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L13-L26
+https://github.com/erikgrinaker/toydb/blob/90a6cae47ac20481ac4eb2f20eea50f02e6c2b33/src/raft/log.rs#L10-L28
 
 `index` specifies the position in the log, and `command` contains the binary command to apply to the
 state machine. The `term` identifies the leadership term in which the command was proposed: a new
 term begins when a new leader election is held (we'll get back to this later).
 
 Entries are appended to the log by the leader and replicated to followers. Once acknowledged by a
-quorum, the log up to that index is committed, and will never change. Entries that are not yet
+quorum, the log up to that index is committed and will never change. Entries that are not yet
 committed may be replaced or removed if the leader changes.
 
 The Raft log enforces the following invariants:
@@ -95,8 +96,8 @@ application:
 
 https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L205-L222
 
-It also has methods to read entries from the log, either individually as `Log::get` or by iterating
-over a range with `Log::scan`:
+The log also has methods to read entries from the log, either individually as `Log::get` or by
+iterating over a range with `Log::scan`:
 
 https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L224-L267
 
@@ -109,6 +110,8 @@ The Raft state machine is represented by the `raft::State` trait. Raft will ask
 applied entry via `State::get_applied_index`, and feed it newly committed entries via
 `State::apply`. It also allows reads via `State::read`, but we'll get back to that later.
 
+https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/state.rs#L4-L51
+
 The state machine does not have to flush its state to durable storage after each transition; on node
 crashes, the state machin
```

**File**: `docs/architecture/storage.md` (modified, +40/-24)
```diff
@@ -2,33 +2,33 @@
 
 toyDB uses an embedded [key/value store](https://en.wikipedia.org/wiki/Key–value_database) for data
 storage, located in the [`storage`](https://github.com/erikgrinaker/toydb/tree/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/storage)
-module. This stores arbitrary keys and values as binary byte strings, and doesn't care what they
-contain. We'll see later how the SQL data model, with tables and rows, is mapped onto this key/value
-structure.
+module. This stores arbitrary keys and values as binary byte strings. The storage engine doesn't
+know or care what the keys and values contain -- we'll see later how the SQL data model, with tables
+and rows, is mapped onto this key/value structure.
 
 The storage engine supports simple set/get/delete operations on individual keys. It does not itself
 support transactions -- this is built on top, and we'll get back to it shortly.
 
 Keys are stored in sorted order. This allows range scans, where we can iterate over all key/value
-pairs between two specific keys, or with a specific key prefix. As we'll see later, this is needed
-e.g. to scan all rows in a specific SQL table, to do limited SQL index scans, to scan the tail of
-the Raft log, etc.
+pairs between two specific keys, or with a specific key prefix. This will be needed by other
+components in the system, e.g. to scan all rows in a specific SQL table, to scan all versions of an
+MVCC key, to scan the tail of the Raft log, etc.
 
 The storage engine is pluggable: there are multiple implementations, and the user can choose which
 one to use in the config file. These implement the `storage::Engine` trait:
 
 https://github.com/erikgrinaker/toydb/blob/4804df254034c51f367d1380d389d80695cd7054/src/storage/engine.rs#L8-L58
 
-We'll discuss the two existing storage engine implementations next.
+Let's look at the existing storage engine implementations.
 
 ## `Memory` Storage Engine
 
 The simplest storage engine is the `storage::Memory` engine. This is a trivial implementation which
-stores all data in memory using the Rust standard library's
+stores data in memory using the Rust standard library's
 [`BTreeMap`](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html), without persisting
-data to disk. It is primarily used for testing.
+it to disk. It is primarily used for testing.
 
-This implementation is so simple that we can include it in its entirety here:
+Since this is just a wrapper around the `BTreeMap` we can include it in its entirety here:
 
 https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/memory.rs#L8-L77
 
@@ -42,10 +42,8 @@ baby cousin.
 https://github.com/erikgrinaker/toydb/blob/3e467512dca55843f0b071b3e239f14724f59a41/src/storage/bitcask.rs#L15-L55
 
 toyDB's BitCask implementation uses a single append-only log file for storage. To write a key/value
-pair, we simply append it to the file. To replace the key, we append a new key/value entry, and to
-delete it, we append a special tombstone value. The last value in the file for a given key is used.
-This also means that we don't need a separate [write-ahead log](https://en.wikipedia.org/wiki/Write-ahead_logging),
-since the data file _is_ the write-ahead log.
+pair, we simply append it to the file. To delete a key, we append a special tombstone value. When
+reading a key, the last entry for that key in the file is used.
 
 The file format for a key/value pair is simply:
 
@@ -61,26 +59,44 @@ keylen   valuelen key    value
 00000003 00000003 666f6f 626172
 ```
 
-https://github.com/erikgrinaker/toydb/blob/3e467512dca55843f0b071b3e239f14724f59a41/src/storage/bitcask.rs#L342-L366
+Because the data file is a simple log, we don't need a separate [write-ahead log](https://en.wikipedia.org/wiki/Write-ahead_logging)
+for crash recovery -- the data file _is_ the write-ahead log.
 
-To find key/value pairs, we maintain a `KeyDir` index which maps a key to the latest value's
-position in the file. All keys must therefore fit in memory.
+To quickly look up key/value pairs when reading, we maintain an in-memory `KeyDir` index which maps
+a key to the latest value's position in the file. All keys must therefore fit in memory.
 
 https://github.com/erikgrinaker/toydb/blob/3e467512dca55843f0b071b3e239f14724f59a41/src/storage/bitcask.rs#L57-L65
 
-We generate this index by scanning through the entire file when it is opened, and then update it on
-every subsequent write.
+We initially generate this index by scanning through the entire file when it is opened:
 
 https://github.com/erikgrinaker/toydb/blob/3e467512dca55843f0b071b3e239f14724f59a41/src/storage/bitcask.rs#L267-L332
 
-To read a value for a key, we simply look up the key's file location in the `KeyDir` index (if the
-key exists), and then read it from the file:
+To write a key, we append it to the file and update the `KeyDir`:
+
+https://github.com/erikgrinaker/toydb/blob/3e467512dca55843f0b071b3e239f14724f59a41/src/storage/bitcask.rs#L1
```

---

### Incident Patch 9: `c90dbfd5` (2025-05-11)
**Commit Message**: docs: split up architecture guide

**File**: `README.md` (modified, +6/-7)
```diff
@@ -1,4 +1,4 @@
-# <a><img src="./docs/images/toydb.svg" height="40" valign="top" /></a> toyDB
+# <a><img src="./docs/architecture/images/toydb.svg" height="40" valign="top" /></a> toyDB
 
 Distributed SQL database in Rust, built from scratch as an educational project. Main features:
 
@@ -16,9 +16,8 @@ Distributed SQL database in Rust, built from scratch as an educational project.
 I originally wrote toyDB in 2020 to learn more about database internals. Since then, I've spent
 several years building real distributed SQL databases at
 [CockroachDB](https://github.com/cockroachdb/cockroach) and
-[Neon](https://github.com/neondatabase/neon), where I learnt a lot more. Based on this experience,
-I've rewritten toyDB as a simple illustration of the architecture and concepts behind distributed
-SQL databases.
+[Neon](https://github.com/neondatabase/neon). Based on this experience, I've rewritten toyDB as a
+simple illustration of the architecture and concepts behind distributed SQL databases.
 
 toyDB is intended to be simple and understandable, and also functional and correct. Other aspects
 like performance, scalability, and availability are non-goals -- these are major sources of
@@ -36,7 +35,7 @@ been taken where possible.
 
 ## Documentation
 
-* [Architecture guide](docs/architecture.md): a guided tour of toyDB's code and architecture.
+* [Architecture guide](docs/architecture/index.md): a guided tour of toyDB's code and architecture.
 
 * [SQL examples](docs/examples.md): walkthrough of toyDB's SQL features.
 
@@ -106,9 +105,9 @@ Remap: m.title, genre, studio, m.rating (dropped: m.released)
 
 toyDB's architecture is fairly typical for a distributed SQL database: a transactional
 key/value store managed by a Raft cluster with a SQL query engine on top. See the
-[architecture guide](./docs/architecture.md) for more details.
+[architecture guide](./docs/architecture/index.md) for more details.
 
-[![toyDB architecture](./docs/images/architecture.svg)](./docs/architecture.md)
+[![toyDB architecture](./docs/architecture/images/architecture.svg)](./docs/architecture/index.md)
 
 ## Tests
 
```

**File**: `docs/architecture/README.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+See [`index.md`](index.md).
\ No newline at end of file
```

**File**: `docs/architecture/encoding.md` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+# Key/Value Encoding
+
+The key/value store uses binary `Vec<u8>` keys and values, so we need an encoding scheme to 
+translate between Rust in-memory data structures and the on-disk binary data. This is provided by
+the [`encoding`](https://github.com/erikgrinaker/toydb/tree/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding)
+module, with separate schemes for key and value encoding.
+
+## `Bincode` Value Encoding
+
+Values are encoded using [Bincode](https://github.com/bincode-org/bincode), a third-party binary
+encoding scheme for Rust. Bincode is convenient because it can easily encode any arbitrary Rust
+data type. But we could also have chosen e.g. [JSON](https://en.wikipedia.org/wiki/JSON),
+[Protobuf](https://protobuf.dev), [MessagePack](https://msgpack.org/), or any other encoding.
+
+We won't dwell on the actual binary format here, see the [Bincode specification](https://github.com/bincode-org/bincode/blob/trunk/docs/spec.md)
+for details.
+
+To use a consistent configuration for all encoding and decoding, we provide helper functions using
+`bincode::config::standard()` in the [`encoding::bincode`](https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding/bincode.rs)
+module:
+
+https://github.com/erikgrinaker/toydb/blob/0ce1fb34349fda043cb9905135f103bceb4395b4/src/encoding/bincode.rs#L15-L27
+
+Bincode uses the very common [Serde](https://serde.rs) framework for its API. toyDB also provides
+an `encoding::Value` helper trait for value types with automatic `encode()` and `decode()` methods:
+
+https://github.com/erikgrinaker/toydb/blob/b57ae6502e93ea06df00d94946a7304b7d60b977/src/encoding/mod.rs#L39-L68
+
+Here's an example of how this is used to encode and decode an arbitrary `Dog` data type:
+
+```rust
+#[derive(serde::Serialize, serde::Deserialize)]
+struct Dog {
+    name: String,
+    age: u8,
+    good_boy: bool,
+}
+
+impl encoding::Value for Dog {}
+
+let pluto = Dog { name: "Pluto".into(), age: 4, good_boy: true };
+let bytes = pluto.encode();
+println!("{bytes:02x?}");
+
+// Outputs [05, 50, 6c, 75, 74, 6f, 04, 01].
+//
+// * Length of string "Pluto": 05.
+// * String "Pluto": 50 6c 75 74 6f.
+// * Age 4: 04.
+// * Good boy: 01 (true).
+
+let pluto = Dog::decode(&bytes)?; // gives us back Pluto
+```
+
+## `Keycode` Key Encoding
+
+Unlike values, keys can't just use any binary encoding like Bincode. As mentioned before, the
+storage engine sorts data by key to enable range scans, which will be used e.g. for SQL table scans,
+limited SQL index scans, Raft log scans, etc. Because of this, the encoding needs to preserve the
+[lexicographical order](https://en.wikipedia.org/wiki/Lexicographic_order) of the encoded values:
+the binary byte slices must sort in the same order as the original values.
+
+As an example of why we can't just use Bincode, let's consider two strings: "house" should be
+sorted before "key", alphabetically. However, Bincode encodes strings prefixed by their length, so
+"key" would be sorted before "house" in binary form:
+
+```
+03 6b 65 79       ← 3 bytes: key
+05 68 6f 75 73 65 ← 5 bytes: house
+```
+
+For similar reasons, we can't just encode numbers in their native binary form, because the
+[little-endian](https://en.wikipedia.org/wiki/Endianness) representation will sometimes order very
+large numbers before small numbers, and the [sign bit](https://en.wikipedia.org/wiki/Sign_bit)
+will order positive numbers before negative numbers.
+
+We also have to be careful with value sequences, which should be ordered element-wise. For example,
+the pair ("a", "xyz") should be ordered before ("ab", "cd"), so we can't just encode the strings
+one after the other like "axyz" and "abcd" since that would sort "abcd" first.
+
+toyDB provides an encoding called "Keycode" which provides these properties, in the
+[`encoding::keycode`](https://github.com/erikgrinaker/toydb/blob/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/encoding/keycode.rs)
+module. It is implemented as a [Serde](https://serde.rs) (de)serializer, which
+requires a lot of boilerplate code, but we'll just focus on the actual encoding.
+
+Keycode only supports a handful of primary data types, and just needs to order values of the same
+type:
+
+* `bool`: `00` for `false` and `01` for `true`.
+
+    https://github.com/erikgrinaker/toydb/blob/2027641004989355c2162bbd9eeefcc991d6b29b/src/encoding/keycode.rs#L113-L117
+
+* `u64`: the [big-endian](https://en.wikipedia.org/wiki/Endianness) binary encoding.
+
+    https://github.com/erikgrinaker/toydb/blob/2027641004989355c2162bbd9eeefcc991d6b29b/src/encoding/keycode.rs#L157-L161
+
+* `i64`: the [big-endian](https://en.wikipedia.org/wiki/Endianness) binary encoding, but with the
+   sign bit flipped to order negative numbers before positive ones.
+
+    https://github.com/erikgrinaker/toydb/blob/2027641004989355c2162bbd9eeefcc991d6b29b/src/encoding/keycode.rs#L131-L143
+
+* `f64`: the [big-endian IEEE 754](https://e
```

**File**: `docs/architecture/index.md` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# toyDB Architecture
+
+toyDB is a simple distributed SQL database, intended to illustrate how such systems are built. The
+overall structure is similar to real-world distributed databases, but the design and implementation
+has been kept as simple as possible for understandability. Performance and scalability are explicit
+non-goals, as these are major sources of complexity in real-world systems.
+
+This guide will walk through toyDB's architecture and code from the bottom up, with plenty of links
+to the actual source code.
+
+> ℹ️ View on GitHub with a desktop browser for inline code listings.
+
+* [Overview](overview.md)
+  * [Properties](overview.md#properties)
+  * [Components](overview.md#components)
+* [Storage Engine](storage.md)
+  * [`Memory` Storage Engine](storage.md#memory-storage-engine)
+  * [`BitCask` Storage Engine](storage.md#bitcask-storage-engine)
+* [Key/Value Encoding](encoding.md)
+  * [`Bincode` Value Encoding](encoding.md#bincode-value-encoding)
+  * [`Keycode` Key Encoding](encoding.md#keycode-key-encoding)
+* [MVCC Transactions](mvcc.md)
+* [Raft Consensus](raft.md)
+  * [Log Storage](raft.md#log-storage)
+  * [State Machine Interface](raft.md#state-machine-interface)
+  * [Node Roles](raft.md#node-roles)
+  * [Node Interface and Communication](raft.md#node-interface-and-communication)
+  * [Leader Election and Terms](raft.md#leader-election-and-terms)
+  * [Client Requests and Forwarding](raft.md#client-requests-and-forwarding)
+  * [Write Replication and Application](raft.md#write-replication-and-application)
+  * [Read Processing](raft.md#read-processing)
+* [SQL Engine](sql.md)
+  * [Data Model](sql-data.md)
+    * [Data Types](sql-data.md#data-types)
+    * [Schemas](sql-data.md#schemas)
+    * [Expressions](sql-data.md#expressions)
+  * [Storage](sql-storage.md)
+    * [Key/Value Representation](sql-storage.md#keyvalue-representation)
+    * [Schema Catalog](sql-storage.md#schema-catalog)
+    * [Row Storage and Transactions](sql-storage.md#row-storage-and-transactions)
+  * [Raft Replication](sql-raft.md)
+  * [Parsing](sql-parser.md)
+    * [Lexer](sql-parser.md#lexer)
+    * [Abstract Syntax Tree](sql-parser.md#abstract-syntax-tree)
+    * [Parser](sql-parser.md#parser)
+  * [Planning](sql-planner.md)
+    * [Execution Plan](sql-planner.md#execution-plan)
+    * [Scope and Name Resolution](sql-planner.md#scope-and-name-resolution)
+    * [Planner](sql-planner.md#planner)
+  * [Optimization](sql-optimizer.md)
+    * [Constant Folding](sql-optimizer.md#constant-folding)
+    * [Filter Pushdown](sql-optimizer.md#filter-pushdown)
+    * [Index Lookups](sql-optimizer.md#index-lookups)
+    * [Hash Join](sql-optimizer.md#hash-join)
+    * [Short Circuiting](sql-optimizer.md#short-circuiting)
+  * [Execution](sql-execution.md)
+    * [Plan Executor](sql-execution.md#plan-executor)
+    * [Session Management](sql-execution.md#session-management)
+* [Server and Client](server.md)
+  * [Server](server.md#server)
+  * [Raft Routing](server.md#raft-routing)
+  * [SQL Service](server.md#sql-service)
+  * [`toydb` Binary](server.md#toydb-binary)
+  * [Client Library](server.md#client-library)
+  * [`toysql` Binary](server.md#toysql-binary)
+
+---
+
+<p align="center">
+<a href="overview.md">Overview</a> →
+</p>
\ No newline at end of file
```

**File**: `docs/architecture/mvcc.md` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+# MVCC Transactions
+
+Transactions provide _atomicity_: a user can submit multiple writes which will take effect as a
+single group, at the same instant, when they are _committed_. Other users should never see some of
+the writes without the others. And they provide _durability_: committed writes should never be lost
+(even if the system crashes), and should remain visible.
+
+Transactions also provide _isolation_: they should appear to have the entire database to themselves,
+unaffected by what other users may be doing at the same time. Two transactions may conflict, in
+which case one has to retry, but if a transaction succeeds then the user can rest easy that the
+operations were executed correctly without interference. This is a very powerful guarantee, since
+it basically eliminates the risk of [race conditions](https://en.wikipedia.org/wiki/Race_condition)
+(a class of bugs that are notoriously hard to fix). 
+
+To illustrate how transactions work, here's an example test script for the MVCC code (there's a
+bunch of [other test scripts](https://github.com/erikgrinaker/toydb/tree/aa14deb71f650249ce1cab8828ed7bcae2c9206e/src/storage/testscripts/mvcc)
+there too):
+
+https://github.com/erikgrinaker/toydb/blob/a73e24b7e77671b9f466e0146323cd69c3e27bdf/src/storage/testscripts/mvcc/bank#L1-L69
+
+To provide such [ACID transactions](https://en.wikipedia.org/wiki/ACID), toyDB uses a common
+technique called [Multi-Version Concurrency Control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)
+(MVCC). It is implemented at the key/value storage level, in the
+[`storage::mvcc`](https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs)
+module. It sits on top of any `storage::Engine` implementation, which it uses for actual data
+storage.
+
+https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L220-L231
+
+MVCC provides a guarantee called [snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation):
+a transaction sees a snapshot of the database as it was when the transaction began. Any later
+changes will be invisible to it.
+
+It does this by storing several historical versions of key/value pairs. The version number is simply
+a number that's incremented for every new transaction:
+
+https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L155-L158
+
+Each transaction has its own unique version number. When it writes a key/value pair it appends its
+version number to the key as `Key::Version(&[u8], Version)`, via the Keycode encoding we saw above.
+If an old version of the key already exists, it will have a different version number and therefore
+be stored as a separate key/value in the storage engine, so it will be left intact. To delete a key,
+it writes a special tombstone value.
+
+https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L183-L189
+
+Here's a simple diagram of what a history of versions 1 to 5 of keys `a` to `d` might look like:
+
+https://github.com/erikgrinaker/toydb/blob/8f8eae0dcf70b1a0df2e853b1f6600e0c7075340/src/storage/mvcc.rs#L11-L26
+
+Given this versioning scheme, we can summarize the MVCC protocol with a few simple rules:
+
+1. When a new transaction begins, it:
+    * Obtains the next available version number.
+    * Adds its version number to the set of active transactions (the "active set").
+    * Takes a snapshot of other uncommitted transaction versions from the active set.
+
+2. When the transaction reads a key, it:
+    * Ignores versions above its own version.
+    * Ignores versions in its active set (uncommitted transactions).
+    * Returns the latest version of the key at or below its own version.
+
+3. When the transaction writes a key, it:
+    * Looks for a key version above its own version; errors if found.
+    * Looks for a key version in its active set (uncommitted transactions); errors if found.
+    * Writes a key/value pair with its own version.
+
+4. When the transaction commits, it:
+    * Flushes all writes to disk.
+    * Removes itself from the active set.
+
+And that's basically it! The transaction's writes all become visible atomically at the instant it
+commits and removes itself from the active set, since new transactions no longer ignore its version.
+The transaction saw a stable snapshot of the database, since it ignored newer versions and versions
+that were uncommitted when it began. The transaction can read its own writes, even though noone else
+can. And if any of its writes conflict with another transaction it would get an error and have to
+retry.
+
+Not only that, this also allows us to do time-travel queries, where we can query the database as it
+was at any time in the past: we simply pick a version number to read at.
+
+There are a few more details that we've left out here. To roll back the transaction, i
```

**File**: `docs/architecture/overview.md` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# Overview
+
+toyDB consists of a cluster of nodes that execute [SQL](https://en.wikipedia.org/wiki/SQL)
+transactions against a replicated state machine. Clients can connect to any node in the cluster
+and submit SQL statements.
+
+## Properties
+
+* **Distributed:** runs across a cluster of nodes.
+* **Highly available:** tolerates loss of a minority of nodes.
+* **SQL compliant:** correctly supports most common SQL features.
+* **Strongly consistent:** committed writes are immediately visible to all readers ([linearizability](https://en.wikipedia.org/wiki/Linearizability)).
+* **Transactional:** provides ACID transactions:
+  * **Atomic:** groups of writes are applied as a single, atomic unit.
+  * **Consistent:** database constraints and referential integrity are always enforced.
+  * **Isolated:** concurrent transactions don't affect each other ([snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation)).
+  * **Durable:** committed writes are never lost.
+
+For simplicity, toyDB is:
+
+* **Not scalable:** every node stores the full dataset, and all reads/writes happen on one node.
+* **Not reliable:** only handles crash failures, not e.g. partial network partitions or node stalls.
+* **Not performant:** data processing is slow, and not optimized at all.
+* **Not efficient:** no compression or garbage collection, can load entire tables into memory.
+* **Not full-featured:** only basic SQL functionality is implemented.
+* **Not backwards compatible:** changes to data formats and protocols will break databases.
+* **Not flexible:** nodes can't be added or removed while running, and take a long time to join.
+* **Not secure:** there is no authentication, authorization, nor encryption.
+
+## Components
+
+Internally, toyDB is made up of a few main components:
+
+* **Storage engine:** stores data on disk and manages transactions.
+* **Raft consensus engine:** replicates data and coordinates cluster nodes.
+* **SQL engine:** organizes SQL data, manages SQL sessions, and executes SQL statements.
+* **Server:** manages network connections, both with SQL clients and Raft nodes.
+* **Client:** provides a SQL user interface and communicates with the server.
+
+This diagram illustrates the internal structure of a single toyDB node:
+
+![toyDB architecture](./images/architecture.svg)
+
+We will go through each of these components from the bottom up.
+
+---
+
+<p align="center">
+← <a href="index.md">toyDB Architecture</a> &nbsp; | &nbsp; <a href="storage.md">Storage Engine</a> →
+</p>
\ No newline at end of file
```

**File**: `docs/architecture/raft.md` (added, +429/-0)
```diff
@@ -0,0 +1,429 @@
+# Raft Consensus
+
+[Raft](https://raft.github.io) is a distributed consensus protocol which replicates data across a
+cluster of nodes in a consistent and durable manner. It is described in the very readable
+[Raft paper](https://raft.github.io/raft.pdf), and the more comprehensive
+[Raft thesis](https://web.stanford.edu/~ouster/cgi-bin/papers/OngaroPhD.pdf).
+
+The toyDB Raft implementation is in the [`raft`](https://github.com/erikgrinaker/toydb/tree/213e5c02b09f1a3cac6a8bbd0a81773462f367f5/src/raft)
+module, and is described in the module documentation:
+
+https://github.com/erikgrinaker/toydb/blob/d96c6dd5ae7c0af55ee609760dcd958c289a44f2/src/raft/mod.rs#L1-L240
+
+Raft is fundamentally the same protocol as [Paxos](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
+and [Viewstamped Replication](https://pmg.csail.mit.edu/papers/vr-revisited.pdf), but an
+opinionated variant designed to be simple, understandable, and practical. It is widely used in the
+industry.
+
+Briefly, Raft elects a leader node which coordinates writes and replicates them to followers. Once a
+majority (>50%) of nodes have acknowledged a write, it is considered durably committed. It is common
+for the leader to also serve reads, since it always has the most recent data and is thus strongly
+consistent.
+
+A cluster must have a majority of nodes (known as a [quorum](https://en.wikipedia.org/wiki/Quorum_(distributed_computing)))
+live and connected to remain available, otherwise it will not commit writes in order to guarantee
+data consistency and durability. Since there can only be one majority in the cluster, this prevents
+a [split brain](https://en.wikipedia.org/wiki/Split-brain_(computing)) scenario where two active
+leaders can exist concurrently (e.g. during a [network partition](https://en.wikipedia.org/wiki/Network_partition))
+and store conflicting values.
+
+The Raft leader appends writes to an ordered command log, which is then replicated to followers.
+Once a majority has replicated the log up to a given entry, that log prefix is committed and then
+applied to a state machine. This ensures that all nodes will apply the same commands in the same
+order and eventually reach the same state (assuming the commands are deterministic). Raft itself
+doesn't care what the state machine and commands are, but in toyDB's case it is a key/value store
+with put/delete commands.
+
+This diagram from the Raft paper illustrates how a Raft node receives a command from a client (1),
+adds it to its log and reaches consensus with other nodes (2), then applies it to its state machine
+(3) before returning a result to the client (4):
+
+<img src="./images/raft.svg" alt="Raft node" width="400" style="display: block; margin: 30px auto;">
+
+You may notice that Raft is not very scalable, since all writes and reads go via the leader node,
+and every node must store the entire dataset. Raft solves replication and availability, but not
+scalability. Real-world systems typically provide horizontal scalability by splitting a large
+dataset across many separate Raft clusters (i.e. sharding), but this is out of scope for toyDB.
+
+For simplicitly, toyDB implements the bare minimum of Raft, and omits optimizations described in
+the paper such as state snapshots, log truncation, leader leases, and more. The implementation is
+in the [`raft`](https://github.com/erikgrinaker/toydb/blob/d96c6dd5ae7c0af55ee609760dcd958c289a44f2/src/raft/mod.rs)
+module, and we'll walk through the main components next.
+
+There is a comprehensive set of Raft test scripts in [`src/raft/testscripts/node`](https://github.com/erikgrinaker/toydb/blob/386153f5c00cb1a88b1ac8489ae132674d96f68a/src/raft/testscripts/node),
+which illustrate the protocol in a wide variety of scenarios.
+
+## Log Storage
+
+Raft replicates an ordered command log consisting of `raft::Entry`:
+
+https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L13-L26
+
+`index` specifies the position in the log, and `command` contains the binary command to apply to the
+state machine. The `term` identifies the leadership term in which the command was proposed: a new
+term begins when a new leader election is held (we'll get back to this later).
+
+Entries are appended to the log by the leader and replicated to followers. Once acknowledged by a
+quorum, the log up to that index is committed, and will never change. Entries that are not yet
+committed may be replaced or removed if the leader changes.
+
+The Raft log enforces the following invariants:
+
+https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L80-L91
+
+`raft::Log` implements a Raft log, and stores log entries in a `storage::Engine` key/value store:
+
+https://github.com/erikgrinaker/toydb/blob/8782c2b05f11333c1586ef248f1a13dc1c8dec4a/src/raft/log.rs#L43-L116
+
+It also stores some additional metadata that we'll need later: the current term,
```

**File**: `docs/architecture/server.md` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+# Server and Client
+
+Now that we've gone over the individual components, we'll tie them all together with the server and
+client.
+
+## Server
+
+in the toyDB
+server `toydb::Server`, located in the [`server`](https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs) module.
+
+The server wraps an inner Raft node `raft::Node`, which manages the SQL state machine, and is
+responsible for routing network traffic between the Raft node, its Raft peers, and SQL clients.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L27-L44
+
+For network protocol, the server uses the Bincode encoding that we've discussed in the encoding
+section, sent over a TCP connection. There's no need for any further framing, since Bincode knows
+how many bytes to expect for each message depending on the type it's decoding into.
+
+The server does not use async Rust and e.g. [Tokio](https://tokio.rs), instead opting for regular OS
+threads. Async Rust can significantly complicate the code, which would obscure the main concepts,
+and any efficiency gains would be entirely irrelevant for toyDB.
+
+Internally in the server, messages are passed around between threads using
+[Crossbeam channels](https://docs.rs/crossbeam/latest/crossbeam/channel/index.html).
+
+The main server loop `Server::serve` listens for inbound TCP connections on port 9705 for Raft peers
+and 9605 for SQL clients, and spawns threads to process them. We'll look at Raft and SQL services
+separately.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L66-L110
+
+## Raft Routing
+
+The heart of the server is the Raft processing thread `Server::raft_route`. This is responsible
+for periodically ticking the Raft node via `raft::Node::tick`, stepping inbound messages from
+Raft peers into the node via `raft::Node::step`, and sending outbound messages to peers.
+
+It also takes inbound Raft client requests from the `sql::engine::Raft` SQL engine, steps them
+into the Raft node via `raft::Node::step`, and passes responses back to the appropriate client
+as the node emits them.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L169-L249
+
+When the node starts up, it spawns a `Server::raft_send_peer` thread for each Raft peer to send
+outbound messages to them.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L84-L91
+
+These threads continually attempt to connect to the peer via TCP, and then read any outbound
+`raft::Envelope(raft::Message)` messages from `Server::raft_route` via a channel and writes the
+messages into the TCP connection using Bincode:
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L146-L167
+
+The server also continually listens for inbound Raft TCP connections from peers in
+`Server::raft_accept`:
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L112-L134
+
+When an inbound connection is accepted, a `Server::raft_receive_peer` thread is spawned that reads
+Bincode-encoded `raft::Envelope(raft::Message)` messages from the TCP connection and sends them to
+`Server::raft_route` via a channel.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L136-L144
+
+The Raft cluster is now fully connected, and the nodes can all talk to each other.
+
+## SQL Service
+
+Next, let's serve some SQL clients. The SQL service uses the enums `toydb::Request` and
+`toydb::Response` as a client protocol, again Bincode-encoded over TCP.
+
+The primary request type is `Request::Execute` which executes a SQL statement against a
+`sql::execution::Session` and returns a `sql::execution::StatementResult`, as we've seen previously.
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L312-L337
+
+The server sets up a `sql::engine::Raft` SQL engine, with a Crossbeam channel that's used to send
+`raft::Request` Raft client requests to `Server::raft_route` and onwards to the local `raft::Node`.
+It then spawns a `Server::sql_accept` thread to listen for inbound SQL client connections:
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L104-L106
+
+When a SQL client connection is accepted, a new client session `sql::execution::Session` is set up
+for the client, and we spawn a `Server::sql_session` thread to serve the connection:
+
+https://github.com/erikgrinaker/toydb/blob/0839215770e31f1e693d5cccf20a68210deaaa3f/src/server.rs#L251-L272
+
+These session threads continually read `Request` messages from the client, execute them against the
+SQL session (and ultimately the Raft node), before sending a `Response` back to the client.
+
+https://github.com/erikgrinaker/toydb/blob/083921
```

---

### Incident Patch 10: `da562126` (2025-02-06)
**Commit Message**: docs: rewrite architecture guide

**File**: `README.md` (modified, +11/-17)
```diff
@@ -1,7 +1,5 @@
 # <a><img src="./docs/images/toydb.svg" height="40" valign="top" /></a> toyDB
 
-[![CI](https://github.com/erikgrinaker/toydb/actions/workflows/ci.yml/badge.svg)](https://github.com/erikgrinaker/toydb/actions/workflows/ci.yml)
-
 Distributed SQL database in Rust, built from scratch as an educational project. Main features:
 
 * [Raft distributed consensus engine][raft] for linearizable state machine replication.
@@ -18,9 +16,9 @@ Distributed SQL database in Rust, built from scratch as an educational project.
 I originally wrote toyDB in 2020 to learn more about database internals. Since then, I've spent
 several years building real distributed SQL databases at
 [CockroachDB](https://github.com/cockroachdb/cockroach) and
-[Neon](https://github.com/neondatabase/neon), and learnt a lot more. With this experience, I've
-rewritten toyDB as a simple illustration of the concepts and architecture behind distributed SQL
-databases.
+[Neon](https://github.com/neondatabase/neon), where I learnt a lot more. Based on this experience,
+I've rewritten toyDB as a simple illustration of the architecture and concepts behind distributed
+SQL databases.
 
 toyDB is intended to be simple and understandable, and also functional and correct. Other aspects
 like performance, scalability, and availability are non-goals -- these are major sources of
@@ -32,19 +30,19 @@ been taken where possible.
 [storage]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/engine.rs
 [bitcask]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/bitcask.rs
 [memory]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/memory.rs
-[query]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/execution/execute.rs
+[query]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/execution/executor.rs
 [optimizer]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/planner/optimizer.rs
 [sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/mod.rs
 
 ## Documentation
 
-* [Architecture guide](docs/architecture.md): overview of toyDB's architecture and implementation.
+* [Architecture guide](docs/architecture.md): a guided tour of toyDB's code and architecture.
 
 * [SQL examples](docs/examples.md): walkthrough of toyDB's SQL features.
 
-* [SQL reference](docs/sql.md): toyDB SQL reference documentation.
+* [SQL reference](docs/sql.md): toyDB's SQL reference documentation.
 
-* [References](docs/references.md): books and other materials used while building toyDB.
+* [References](docs/references.md): research material used while building toyDB.
 
 ## Usage
 
@@ -176,15 +174,11 @@ significantly improves write performance.
 
 ## Debugging
 
-[VSCode](https://code.visualstudio.com) provides an intuitive environment for debugging toyDB.
-The debug configuration is included under `.vscode/launch.json`, to use it:
-
-1. Install the [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
-   extension.
-
-2. Go to the "Run and Debug" tab and select e.g. "Debug unit tests in library 'toydb'".
+[VSCode](https://code.visualstudio.com) and the [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
+extension can be used to debug toyDB, with the debug configuration under `.vscode/launch.json`.
 
-3. To debug the binary, select "Debug executable 'toydb'" under "Run and Debug".
+Under the "Run and Debug" tag, select e.g. "Debug executable 'toydb'" or "Debug unit tests in
+library 'toydb'".
 
 ## Credits
 
```

**File**: `docs/examples.md` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@ To start a five-node cluster on the local machine (requires a working
 [Rust compiler](https://www.rust-lang.org/tools/install)), run:
 
 ```
-$ (cd clusters && ./run.sh)
+$ ./cluster/run.rs
 toydb2 19:06:28 [ INFO] Listening on 0.0.0.0:9602 (SQL) and 0.0.0.0:9702 (Raft)
 toydb2 19:06:28 [ERROR] Failed connecting to Raft peer 127.0.0.1:9705: Connection refused
 toydb5 19:06:28 [ INFO] Listening on 0.0.0.0:9605 (SQL) and 0.0.0.0:9705 (Raft)
@@ -34,7 +34,7 @@ In a separate terminal, start a `toysql` client and check the server status:
 
 ```
 $ cargo run --release --bin toysql
-Connected to toyDB node "toydb-e". Enter !help for instructions.
+Connected to toyDB node "toydb-a". Enter !help for instructions.
 toydb> !status
 
 Server:    5 (leader 4 in term 1 with 5 nodes)
```

**File**: `docs/images/raft-states.svg` (added, +325/-0)
```diff
@@ -0,0 +1,325 @@
+<?xml version="1.0" encoding="UTF-8" standalone="no"?>
+<svg
+   width="208.30859pt"
+   height="86.355461pt"
+   viewBox="0 0 208.30859 86.355461"
+   version="1.1"
+   id="svg4230"
+   xmlns="http://www.w3.org/2000/svg"
+   xmlns:svg="http://www.w3.org/2000/svg">
+  <defs
+     id="defs172">
+    <clipPath
+       id="clip-0">
+      <path
+         clip-rule="nonzero"
+         d="M 328.67969,95 H 358 v 7 h -29.32031 z m 0,0"
+         id="path165" />
+    </clipPath>
+    <clipPath
+       id="clip-1">
+      <path
+         clip-rule="nonzero"
+         d="m 432,163 h 55 v 7.76172 h -55 z m 0,0"
+         id="path166" />
+    </clipPath>
+  </defs>
+  <path
+     fill-rule="nonzero"
+     fill="#cef2ce"
+     fill-opacity="1"
+     d="m 97.785162,35.093752 h 25.429698 c 5.94922,0 10.74218,3.07812 10.74218,6.90234 0,3.82422 -4.79296,6.89844 -10.74218,6.89844 H 97.785162 c -5.94922,0 -10.74219,-3.07422 -10.74219,-6.89844 0,-3.82422 4.79297,-6.90234 10.74219,-6.90234"
+     id="path2352" />
+  <path
+     fill="none"
+     stroke-width="0.96"
+     stroke-linecap="round"
+     stroke-linejoin="miter"
+     stroke="#000000"
+     stroke-opacity="1"
+     stroke-miterlimit="4"
+     d="m 97.785162,35.093752 h 25.429698 c 5.94922,0 10.74218,3.07812 10.74218,6.90234 0,3.82422 -4.79296,6.89844 -10.74218,6.89844 H 97.785162 c -5.94922,0 -10.74219,-3.07422 -10.74219,-6.89844 0,-3.82422 4.79297,-6.90234 10.74219,-6.90234 z m 0,0"
+     id="path2353" />
+  <path
+     fill-rule="nonzero"
+     fill="#000000"
+     fill-opacity="1"
+     d="m 98.523442,40.890622 c -0.0195,-0.45703 -0.10156,-0.74609 -0.24219,-1.00781 -0.3164,-0.53906 -0.86328,-0.82422 -1.58203,-0.82422 -0.90234,0 -1.64453,0.36328 -2.24609,1.08594 -0.60547,0.72656 -0.98047,1.78906 -0.98047,2.75 0,0.53906 0.14844,1.01953 0.4375,1.38281 0.35156,0.44141 0.83984,0.64844 1.51953,0.64844 0.8125,0 1.51953,-0.29688 2.01953,-0.84375 0.30078,-0.33203 0.55078,-0.75 0.80469,-1.375 h -0.75 c -0.19531,0.4375 -0.32031,0.67187 -0.45703,0.85547 -0.31641,0.45703 -0.90625,0.74609 -1.51172,0.74609 -0.80078,0 -1.32422,-0.625 -1.32422,-1.55859 0,-0.69141 0.23047,-1.46094 0.61719,-2.05078 0.46875,-0.6836 1.03125,-1.01563 1.73828,-1.01563 0.77344,0 1.16406,0.375 1.21875,1.20703 z m 3.875008,3.46875 c -0.0703,0.0195 -0.10156,0.0195 -0.125,0.0195 -0.19922,0 -0.29297,-0.0703 -0.29297,-0.22656 0,-0.0312 0,-0.0508 0.004,-0.0742 l 0.49609,-2.3125 c 0.043,-0.20703 0.043,-0.20703 0.043,-0.28906 0,-0.51953 -0.53125,-0.86328 -1.33984,-0.86328 -1.06641,0 -1.718758,0.44922 -1.859388,1.30078 h 0.64063 c 0.0703,-0.21484 0.121098,-0.32031 0.234378,-0.42578 0.16797,-0.16797 0.48438,-0.28906 0.81641,-0.28906 0.46484,0 0.8125,0.20703 0.8125,0.49609 0,0.0312 -0.004,0.082 -0.0117,0.14453 l -0.0234,0.13672 c -0.0703,0.32031 -0.21484,0.40234 -0.77734,0.45703 -1.023448,0.0937 -1.347668,0.16797 -1.722668,0.40625 -0.40234,0.25391 -0.63281,0.66016 -0.63281,1.10547 0,0.61328 0.41406,0.98047 1.10547,0.98047 0.269538,0 0.589848,-0.0469 0.871098,-0.14844 0.24219,-0.0898 0.36328,-0.16406 0.67188,-0.4375 v 0.082 c 0,0.31641 0.21484,0.50391 0.58203,0.50391 0.0898,0 0.11328,0 0.30078,-0.043 0.0195,-0.004 0.0625,-0.0195 0.10547,-0.0234 z m -0.92578,-0.87109 c -0.10156,0.48047 -0.77344,0.89062 -1.45703,0.89062 -0.437508,0 -0.679698,-0.1914 -0.679698,-0.50781 0,-0.25781 0.14453,-0.50781 0.375,-0.65234 0.1875,-0.10938 0.417978,-0.17188 0.792978,-0.22266 0.71875,-0.10156 0.78125,-0.11328 1.11719,-0.22656 z m 2.35156,-2.76172 -0.85156,4.02344 h 0.64453 l 0.46875,-2.21875 c 0.1875,-0.84375 0.72266,-1.36719 1.41406,-1.36719 0.38672,0 0.66797,0.26953 0.66797,0.625 0,0.043 -0.0117,0.15625 -0.0469,0.28125 l -0.56641,2.67969 h 0.64453 l 0.61722,-2.88672 c 0.0195,-0.0977 0.0234,-0.19141 0.0234,-0.29297 0,-0.58203 -0.40625,-0.95703 -1.04297,-0.95703 -0.58203,0 -1.08594,0.20703 -1.48828,0.61328 l 0.10156,-0.5 z m 7.87891,-1.57422 h -0.64453 l -0.46094,2.15625 c -0.24219,-0.49609 -0.55469,-0.69531 -1.09766,-0.69531 -1.27734,0 -2.22656,1.21484 -2.22656,2.83203 0,0.89844 0.51172,1.48047 1.3125,1.48047 0.33203,0 0.67969,-0.10547 0.98828,-0.28516 0.23047,-0.14453 0.33203,-0.25781 0.4375,-0.46875 l -0.12109,0.57813 h 0.62109 z m -2.26953,2.04688 c 0.57031,0 0.90625,0.39062 0.90625,1.03906 0,0.45703 -0.11719,0.92578 -0.34766,1.32422 -0.30078,0.51562 -0.67578,0.77734 -1.14453,0.77734 -0.56641,0 -0.89844,-0.39062 -0.89844,-1.05078 0,-0.42578 0.12891,-0.91797 0.33594,-1.3125 0.29297,-0.52734 0.66406,-0.77734 1.14844,-0.77734 z m 3.55859,-0.47266 h -0.64453 l -0.85547,4.02344 h 0.64453 z m 0.33594,-1.57422 h -0.64453 l -0.16797,0.79297 h 0.64453 z m 4.35937,0 h -0.64062 l -0.46094,2.15625 c -0.24609,-0.49609 -0.55859,-0.69531 -1.10156,-0.69531 -1.27735,0 -2.22656,1.21484 -2.22656,2.83203 0,0.89844 0.51171,1.48047 1.3125,1.48047 0.33203,0 0.68359,-0.10547 0.98828,-0.28516 0.23047,-0.14453 0.33203,-0.25781 0.4375,-0.46875 l -0.11719,0.57813 h 0.61719 z m -2.26562,2.04688 c 0.5664,0 0.90625,0.39062 0.90625,1.03906 0,
```

**File**: `docs/images/raft.svg` (added, +887/-0)
```diff
@@ -0,0 +1,887 @@
+<?xml version="1.0" encoding="UTF-8" standalone="no"?>
+<svg
+   width="185.03963"
+   height="112.0609"
+   viewBox="0 0 185.03963 112.0609"
+   version="1.1"
+   id="svg4632"
+   xmlns="http://www.w3.org/2000/svg"
+   xmlns:svg="http://www.w3.org/2000/svg">
+  <defs
+     id="defs151">
+    <clipPath
+       id="clip-0">
+      <path
+         clip-rule="nonzero"
+         d="m 154,102 h 124.92187 v 93 H 154 Z m 0,0"
+         id="path138" />
+    </clipPath>
+    <clipPath
+       id="clip-1">
+      <path
+         clip-rule="nonzero"
+         d="M 148,96 H 278.92187 V 196.80078 H 148 Z m 0,0"
+         id="path139" />
+    </clipPath>
+    <clipPath
+       id="clip-2">
+      <path
+         clip-rule="nonzero"
+         d="M 146,94 H 278.92187 V 196.80078 H 146 Z m 0,0"
+         id="path140" />
+    </clipPath>
+    <clipPath
+       id="clip-3">
+      <path
+         clip-rule="nonzero"
+         d="M 144,93 H 278.92187 V 196.80078 H 144 Z m 0,0"
+         id="path141" />
+    </clipPath>
+    <clipPath
+       id="clip-4">
+      <path
+         clip-rule="nonzero"
+         d="M 93.71875,109 H 136 v 33 H 93.71875 Z m 0,0"
+         id="path142" />
+    </clipPath>
+    <clipPath
+       id="clip-5">
+      <path
+         clip-rule="nonzero"
+         d="M 93.71875,107 H 134 v 33 H 93.71875 Z m 0,0"
+         id="path143" />
+    </clipPath>
+    <clipPath
+       id="clip-6">
+      <path
+         clip-rule="nonzero"
+         d="M 93.71875,105 H 131 v 33 H 93.71875 Z m 0,0"
+         id="path144" />
+    </clipPath>
+    <clipPath
+       id="clip-7">
+      <path
+         clip-rule="nonzero"
+         d="m 122,173 h 33 v 23.80078 h -33 z m 0,0"
+         id="path145" />
+    </clipPath>
+    <clipPath
+       id="clip-8">
+      <path
+         clip-rule="nonzero"
+         d="m 122,173 h 36 v 23.80078 h -36 z m 0,0"
+         id="path146" />
+    </clipPath>
+    <clipPath
+       id="clip-9">
+      <path
+         clip-rule="nonzero"
+         d="m 122,173 h 38 v 23.80078 h -38 z m 0,0"
+         id="path147" />
+    </clipPath>
+    <clipPath
+       id="clip-10">
+      <path
+         clip-rule="nonzero"
+         d="m 153,194 h 3 v 2.80078 h -3 z m 0,0"
+         id="path148" />
+    </clipPath>
+    <clipPath
+       id="clip-11">
+      <path
+         clip-rule="nonzero"
+         d="m 151,192 h 6 v 4.80078 h -6 z m 0,0"
+         id="path149" />
+    </clipPath>
+    <clipPath
+       id="clip-12">
+      <path
+         clip-rule="nonzero"
+         d="m 101,84 h 143 v 30 H 101 Z m 0,0"
+         id="path150" />
+    </clipPath>
+    <clipPath
+       id="clip-13">
+      <path
+         clip-rule="nonzero"
+         d="m 100,84 h 22 v 17 h -22 z m 0,0"
+         id="path151" />
+    </clipPath>
+  </defs>
+  <g
+     clip-path="url(#clip-0)"
+     id="g152"
+     transform="translate(-93.721625,-84.335554)">
+    <path
+       fill-rule="nonzero"
+       fill="#ffffbf"
+       fill-opacity="1"
+       d="m 159.21875,102.10547 h 114.26172 c 2.66015,0 4.80078,2.14062 4.80078,4.79687 v 82.5 c 0,2.66016 -2.14063,4.79688 -4.80078,4.79688 H 159.21875 c -2.66016,0 -4.80078,-2.13672 -4.80078,-4.79688 v -82.5 c 0,-2.65625 2.14062,-4.79687 4.80078,-4.79687"
+       id="path152" />
+  </g>
+  <g
+     clip-path="url(#clip-1)"
+     id="g153"
+     transform="translate(-93.721625,-84.335554)">
+    <path
+       fill="none"
+       stroke-width="9.6"
+       stroke-linecap="butt"
+       stroke-linejoin="miter"
+       stroke="#000000"
+       stroke-opacity="1"
+       stroke-miterlimit="4"
+       d="m 1592.1875,6898.9453 h 1142.6172 c 26.6016,0 48.0078,-21.4062 48.0078,-48.0078 v -824.9609 c 0,-26.6016 -21.4062,-48.0079 -48.0078,-48.0079 H 1592.1875 c -26.6016,0 -48.0078,21.4063 -48.0078,48.0079 v 824.9609 c 0,26.6016 21.4062,48.0078 48.0078,48.0078 z m 0,0"
+       transform="matrix(0.1,0,0,-0.1,0,792)"
+       id="path153" />
+  </g>
+  <path
+     fill-rule="nonzero"
+     fill="#ffffbf"
+     fill-opacity="1"
+     d="M 63.063535,16.066786 H 177.32915 c 2.66016,0 4.80078,2.14454 4.80078,4.80079 v 82.496084 c 0,2.66015 -2.14062,4.80078 -4.80078,4.80078 H 63.063535 c -2.65625,0 -4.79688,-2.14063 -4.79688,-4.80078 V 20.867576 c 0,-2.65625 2.14063,-4.80079 4.79688,-4.80079"
+     id="path154" />
+  <g
+     clip-path="url(#clip-2)"
+     id="g155"
+     transform="translate(-93.721625,-84.335554)">
+    <path
+       fill="none"
+       stroke-width="9.6"
+       stroke-linecap="butt"
+       stroke-linejoin="miter"
+       stroke="#000000"
+       stroke-opacity="1"
+       stroke-miterlimit="4"
+       d="m 1567.8516,6915.9375 h 1142.6562 c 26.6016,0 48.0078,-21.4063 48.0078,-47.9688 v -825 c 0,-26.5625 -21.4062,-48.0078 -48.0078,-48.0078 H 1567.8516 c -26.5625,0 -47.9688,21.4453 -47.9688,48.0078 v 825 c 0,26.5625 21.4063,47.9688 47.9688,47.9688 z m 0,0"
+       transform="matrix(0.1,0,0,-0.1,0,792)"
+       id="path155" />
+  </g>
+  <path
+     fill-rule="nonzero
```

**File**: `docs/tools/update-links.py` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+#!/usr/bin/env python3
+#
+# Updates GitHub code links to the latest commit SHA.
+
+import os, re, sys, argparse
+import requests
+
+GITHUB_API = "https://api.github.com"
+
+def get_latest_sha(owner, repo, path, token):
+    url = f"{GITHUB_API}/repos/{owner}/{repo}/commits"
+    headers = {}
+    if token:
+        headers["Authorization"] = f"token {token}"
+    params = {"path": path, "sha": "main", "per_page": 1}
+    resp = requests.get(url, headers=headers, params=params)
+    resp.raise_for_status()
+    data = resp.json()
+    return data[0]["sha"] if data else None
+
+def process_markdown(text, token):
+    pattern = re.compile(
+        r"https://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/blob/"
+        r"(?P<oldsha>[0-9a-f]{7,40})/(?P<path>[^#)\s]+)"
+    )
+    cache = {}
+    def replacer(m):
+        print(f"Checking {m.group(0)}")
+        owner, repo, oldsha, path = m.group("owner","repo","oldsha","path")
+        key = (owner, repo, path)
+        print(f"Key: {key}")
+        if key not in cache:
+            cache[key] = get_latest_sha(owner, repo, path, token)
+        newsha = cache[key]
+        if newsha and newsha != oldsha:
+            print(f"Updating {m.group(0)} to {newsha}")
+            return m.group(0).replace(oldsha, newsha)
+        return m.group(0)
+    return pattern.sub(replacer, text)
+
+def main():
+    p = argparse.ArgumentParser(description="Update GitHub blob links to latest SHAs")
+    p.add_argument("file", nargs="?", help="Markdown file to update (defaults to stdin/stdout)")
+    args = p.parse_args()
+    token = os.getenv("GITHUB_TOKEN")
+    if args.file:
+        text = open(args.file, encoding="utf-8").read()
+        updated = process_markdown(text, token)
+        with open(args.file, "w", encoding="utf-8") as f:
+            f.write(updated)
+    else:
+        text = sys.stdin.read()
+        sys.stdout.write(process_markdown(text, token))
+
+if __name__ == "__main__":
+    main()
```

---

### Incident Patch 11: `809c26bf` (2025-05-01)
**Commit Message**: sql: clean up `ShortCircuit` optimizer

**File**: `src/sql/planner/optimizer.rs` (modified, +42/-45)
```diff
@@ -364,18 +364,13 @@ impl Optimizer for ShortCircuit {
 }
 
 impl ShortCircuit {
-    /// Creates a Nothing node with the columns of the original node.
-    fn nothing(node: &Node) -> Node {
-        let columns = (0..node.columns()).map(|i| node.column_label(i)).collect();
-        Node::Nothing { columns }
-    }
-
-    /// Short-circuits useless nodes.
-    fn short_circuit(node: Node) -> Node {
+    /// Short-circuits useless nodes. Assumes the node has already been
+    /// optimized by ConstantFolding.
+    fn short_circuit(mut node: Node) -> Node {
         use Expression::*;
         use Value::*;
 
-        match node {
+        node = match node {
             // Filter nodes that always yield true are unnecessary: remove them.
             Node::Filter { source, predicate: Constant(Boolean(true)) } => *source,
 
@@ -390,42 +385,6 @@ impl ShortCircuit {
                 outer,
             } => Node::NestedLoopJoin { left, right, predicate: None, outer },
 
-            // Short-circuit nodes that can't produce anything by replacing them
-            // with a Nothing node, retaining the columns.
-            ref node @ Node::Filter { predicate: Constant(Boolean(false) | Null), .. } => {
-                Self::nothing(node)
-            }
-            ref node @ Node::IndexLookup { ref values, .. } if values.is_empty() => {
-                Self::nothing(node)
-            }
-            ref node @ Node::KeyLookup { ref keys, .. } if keys.is_empty() => Self::nothing(node),
-            ref node @ Node::Limit { limit: 0, .. } => Self::nothing(node),
-            ref node @ Node::NestedLoopJoin {
-                predicate: Some(Constant(Boolean(false) | Null)),
-                ..
-            } => Self::nothing(node),
-            ref node @ Node::Scan { filter: Some(Constant(Boolean(false) | Null)), .. } => {
-                Self::nothing(node)
-            }
-            ref node @ Node::Values { ref rows } if rows.is_empty() => Self::nothing(node),
-
-            // Short-circuit nodes that pull from a Nothing node.
-            //
-            // NB: does not short-circuit aggregation, since an aggregation over 0
-            // rows should produce a result.
-            ref node @ (Node::Filter { ref source, .. }
-            | Node::HashJoin { left: ref source, .. }
-            | Node::HashJoin { right: ref source, .. }
-            | Node::NestedLoopJoin { left: ref source, .. }
-            | Node::NestedLoopJoin { right: ref source, .. }
-            | Node::Offset { ref source, .. }
-            | Node::Order { ref source, .. }
-            | Node::Projection { ref source, .. })
-                if matches!(**source, Node::Nothing { .. }) =>
-            {
-                Self::nothing(node)
-            }
-
             // Remove noop projections that simply pass through the source columns.
             Node::Projection { source, expressions, aliases }
                 if source.columns() == expressions.len()
@@ -439,6 +398,44 @@ impl ShortCircuit {
             }
 
             node => node,
+        };
+
+        // Short-circuit nodes that don't produce anything by replacing them
+        // with a Nothing node.
+        let is_empty = match &node {
+            Node::Filter { predicate: Constant(Boolean(false) | Null), .. } => true,
+            Node::IndexLookup { values, .. } if values.is_empty() => true,
+            Node::KeyLookup { keys, .. } if keys.is_empty() => true,
+            Node::Limit { limit: 0, .. } => true,
+            Node::NestedLoopJoin { predicate: Some(Constant(Boolean(false) | Null)), .. } => true,
+            Node::Scan { filter: Some(Constant(Boolean(false) | Null)), .. } => true,
+            Node::Values { rows } if rows.is_empty() => true,
+
+            // Nodes that pull from a Nothing node can't produce anything.
+            //
+            // NB: does not short-circuit aggregation, since an aggregation over 0
+            // rows should produce a result.
+            Node::Filter { source, .. }
+            | Node::HashJoin { left: source, .. }
+            | Node::HashJoin { right: source, .. }
+            | Node::NestedLoopJoin { left: source, .. }
+            | Node::NestedLoopJoin { right: source, .. }
+            | Node::Offset { source, .. }
+            | Node::Order { source, .. }
+            | Node::Projection { source, .. }
+                if matches!(**source, Node::Nothing { .. }) =>
+            {
+                true
+            }
+
+            _ => false,
+        };
+
+        if is_empty {
+            let columns = (0..node.columns()).map(|i| node.column_label(i)).collect();
+            return Node::Nothing { columns };
         }
+
+        node
     }
 }
```

---

### Incident Patch 12: `a73e24b7` (2025-02-09)
**Commit Message**: Revert "storage: rename test to `bank.txt` for GitHub links"

This reverts commit 2b593e79eeb125d148d8a80ec44ef815e52e742f.



---

### Incident Patch 13: `000fe3af` (2025-02-06)
**Commit Message**: storage: clean up `Memory` engine

**File**: `src/storage/memory.rs` (modified, +15/-25)
```diff
@@ -1,15 +1,14 @@
+use std::collections::btree_map::Range;
 use std::collections::BTreeMap;
 use std::ops::{Bound, RangeBounds};
 
 use super::{Engine, Status};
 use crate::error::Result;
 
-/// An in-memory key/value storage engine using the Rust standard library B-tree
-/// implementation. Data is not persisted.
+/// An in-memory key-value storage engine using the Rust standard library's
+/// B-tree implementation. Data is not persisted. Primarily for testing.
 #[derive(Default)]
-pub struct Memory {
-    data: BTreeMap<Vec<u8>, Vec<u8>>,
-}
+pub struct Memory(BTreeMap<Vec<u8>, Vec<u8>>);
 
 impl Memory {
     /// Creates a new Memory key-value storage engine.
@@ -21,21 +20,21 @@ impl Memory {
 impl Engine for Memory {
     type ScanIterator<'a> = ScanIterator<'a>;
 
-    fn flush(&mut self) -> Result<()> {
+    fn delete(&mut self, key: &[u8]) -> Result<()> {
+        self.0.remove(key);
         Ok(())
     }
 
-    fn delete(&mut self, key: &[u8]) -> Result<()> {
-        self.data.remove(key);
+    fn flush(&mut self) -> Result<()> {
         Ok(())
     }
 
     fn get(&mut self, key: &[u8]) -> Result<Option<Vec<u8>>> {
-        Ok(self.data.get(key).cloned())
+        Ok(self.0.get(key).cloned())
     }
 
     fn scan(&mut self, range: impl RangeBounds<Vec<u8>>) -> Self::ScanIterator<'_> {
-        ScanIterator { inner: self.data.range(range) }
+        ScanIterator(self.0.range(range))
     }
 
     fn scan_dyn(
@@ -46,43 +45,34 @@ impl Engine for Memory {
     }
 
     fn set(&mut self, key: &[u8], value: Vec<u8>) -> Result<()> {
-        self.data.insert(key.to_vec(), value);
+        self.0.insert(key.to_vec(), value);
         Ok(())
     }
 
     fn status(&mut self) -> Result<Status> {
         Ok(Status {
             name: "memory".to_string(),
-            keys: self.data.len() as u64,
-            size: self.data.iter().fold(0, |size, (k, v)| size + k.len() as u64 + v.len() as u64),
+            keys: self.0.len() as u64,
+            size: self.0.iter().map(|(k, v)| (k.len() + v.len()) as u64).sum(),
             disk_size: 0,
             live_disk_size: 0,
         })
     }
 }
 
-pub struct ScanIterator<'a> {
-    inner: std::collections::btree_map::Range<'a, Vec<u8>, Vec<u8>>,
-}
-
-impl ScanIterator<'_> {
-    fn map(item: (&Vec<u8>, &Vec<u8>)) -> <Self as Iterator>::Item {
-        let (key, value) = item;
-        Ok((key.clone(), value.clone()))
-    }
-}
+pub struct ScanIterator<'a>(Range<'a, Vec<u8>, Vec<u8>>);
 
 impl Iterator for ScanIterator<'_> {
     type Item = Result<(Vec<u8>, Vec<u8>)>;
 
     fn next(&mut self) -> Option<Self::Item> {
-        self.inner.next().map(Self::map)
+        self.0.next().map(|(k, v)| Ok((k.clone(), v.clone())))
     }
 }
 
 impl DoubleEndedIterator for ScanIterator<'_> {
     fn next_back(&mut self) -> Option<Self::Item> {
-        self.inner.next_back().map(Self::map)
+        self.0.next_back().map(|(k, v)| Ok((k.clone(), v.clone())))
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #78** (2026-10-02): docs: fix typo "accomodate" in MVCC architecture doc (@Rohit-Singh-01)
- **PR #76** (2025-09-25): fix(docs): update outdated Bincode specification link (@guuzaa)
- **PR #75** (2025-07-08): MVCC: using first() to get the range start (@Daniel-Xu)
- **PR #71** (2024-08-13): docs: tweak (@qujihan)
- **PR #68** (2024-05-03): Fix test comment for step_solicitvote_last_index_outdated. (@Light-City)
- **PR #66** (2024-04-08): fix anomaly_read_skew test (@Light-City)
- **PR #64** (closed): optimize planner inject hidden logic (@SGZW)
- **PR #62** (closed): Add Nix shell for development (@kosumic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
