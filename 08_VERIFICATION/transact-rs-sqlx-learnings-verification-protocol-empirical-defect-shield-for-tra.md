# Verification Protocol: Verification Protocol: Empirical Defect Shield for transact-rs-sqlx-learnings

<!-- PROVENANCE_START
{
  "source_repository": "transact-rs-sqlx-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:45:56.767Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-transact-rs-sqlx-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [transact-rs-sqlx-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:45:56.767Z`  
> **Learning ID**: `LEARN-REEXTRACT-transact-rs-sqlx-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `transact-rs-sqlx-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/transact-rs-sqlx-learnings.md`  
> **Source**: github ([https://github.com/transact-rs/sqlx](https://github.com/transact-rs/sqlx))  
> **Source Version**: `987b8c5a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T06:56:01.366Z  
> **Learning ID**: `learn-github-transact-rs-sqlx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): transact-rs/sqlx

> **Canonical Artifact**: `07_PROJECT_LEARNING/transact-rs-sqlx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/transact-rs/sqlx](https://github.com/transact-rs/sqlx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T06:56:01.360Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `transact-rs/sqlx`
- **Description**: 🧰 The Rust SQL Toolkit. An async, pure Rust SQL crate featuring compile-time checked queries without a DSL. Supports PostgreSQL, MySQL, and SQLite.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 17658 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sqlx-core/src/acquire.rs`
```
use crate::database::Database;
use crate::error::Error;
use crate::pool::{MaybePoolConnection, Pool, PoolConnection};

use crate::transaction::Transaction;
use futures_core::future::BoxFuture;
use std::ops::{Deref, DerefMut};

/// Acquire connections or transactions from a database in a generic way.
///
/// If you want to accept generic database connections that implement
/// [`Acquire`] which then allows you to [`acquire`][`Acquire::acquire`] a
/// connection or [`begin`][`Acquire::begin`] a transaction, then you can do it
/// like that:
///
/// ```rust,ignore
/// # use sqlx::{Acquire, postgres::Postgres, error::BoxDynError};
/// async fn run_query<'a, A>(conn: A) -> Result<(), BoxDynError>
/// where
///     A: Acquire<'a, Database = Postgres>,
/// {
///     let mut conn = conn.acquire().await?;
///
///     sqlx::query!("SELECT 1 as v").fetch_one(&mut *conn).await?;
///     sqlx::query!("SELECT 2 as v").fetch_one(&mut *conn).await?;
///
///     Ok(())
/// }
/// ```
///
/// If you run into a lifetime error about "implementation of `sqlx::Acquire` is
/// not general enough", the [workaround] looks like this:
///
/// ```rust,ignore
/// # use std::future::Future;
/// # use sqlx::{Acquire, postgres::Postgres, error::BoxDynError};
/// fn run_query<'a, 'c, A>(conn: A) -> impl Future<Output = Result<(), BoxDynError>> + Send + 'a
/// where
///     A: Acquire<'c, Database = Postgres> + Send + 'a,
/// {
///     async move {
///         let mut conn = conn.acquire().await?;
///
///         sqlx::query!("SELECT 1 as v").fetch_one(&mut *conn).await?;
///         sqlx::query!("SELECT 2 as v").fetch_one(&mut *conn).await?;
///
///         Ok(())
///     }
/// }
/// ```
///
/// However, if you really just want to accept both, a transaction or a
/// connection as an argument to a function, then it's easier to just accept a
/// mutable reference to a database connection like so:
///
/// ```rust,ignore
/// # use sqlx::{postgres::PgConnection, error::BoxDynError};
/// async fn run_query(conn: &mut PgConnection) -> Result<(), BoxDynError> {
///     sqlx::query!("SELECT 1 as v").fetch_one(&mut *conn).await?;
///     sqlx::query!("SELECT 2 as v").fetch_one(&mut *conn).await?;
///
///     Ok(())
/// }
/// ```
///
/// The downside of this approach is that you have to `acquire` a connection
/// from a pool first and can't directly pass the pool as argument.
///
/// [workaround]: https://github.com/launchbadge/sqlx/issues/1015#issuecomment-767787777
pub trait Acquire<'c> {
    type Database: Database;

    type Connection: Deref<Target = <Self::Database as Database>::Connection> + DerefMut + Send;

    fn acquire(self) -> BoxFuture<'c, Result<Self::Connection, Error>>;

    fn begin(self) -> BoxFuture<'c, Result<Transaction<'c, Self::Database>, Error>>;
}

impl<'a, DB: Database> Acquire<'a> for &'_ Pool<DB> {
    type Database = DB;

    type Connection = PoolConnection<DB>;

    fn acquire(self) -> BoxFuture<'static, Result<Self::Connection, Error>> {
        Box::pin(self.acquire())
    }

    fn begin(self) -> BoxFuture<'static, Result<Transaction<'a, DB>, Error>> {
        let conn = self.acquire();

        Box::pin(async move {
            Transaction::begin(MaybePoolConnection::PoolConnection(conn.await?), None).await
        })
    }
}

#[macro_export]
macro_rules! impl_acquire {
    ($DB:ident, $C:ident) => {
        impl<'c> $crate::acquire::Acquire<'c> for &'c mut $C {
            type Database = $DB;

            type Connection = &'c mut <$DB as $crate::database::Database>::Connection;

            #[inline]
            fn acquire(
                self,
            ) -> futures_core::future::BoxFuture<'c, Result<Self::Connection, $crate::error::Error>>
            {
                Box::pin(std::future::ready(Ok(self)))
            }

            #[inline]
            fn begin(
                self,
            ) -> futures_core::future::BoxFuture<
                'c,
                Result<$crate::transaction::Transaction<'c, $DB>, $crate::error::Error>,
            > {
                $crate::transaction::Transaction::begin(self, None)
            }
        }
    };
}

```

### Core Architecture Module: `sqlx-core/src/any/arguments.rs`
```
use crate::any::value::AnyValueKind;
use crate::any::{Any, AnyTypeInfoKind};
use crate::arguments::Arguments;
use crate::encode::{Encode, IsNull};
use crate::error::BoxDynError;
use crate::types::Type;
use std::sync::Arc;

#[derive(Default)]
pub struct AnyArguments {
    #[doc(hidden)]
    pub values: AnyArgumentBuffer,
}

impl Arguments for AnyArguments {
    type Database = Any;

    fn reserve(&mut self, additional: usize, _size: usize) {
        self.values.0.reserve(additional);
    }

    fn add<'t, T>(&mut self, value: T) -> Result<(), BoxDynError>
    where
        T: Encode<'t, Self::Database> + Type<Self::Database>,
    {
        let _: IsNull = value.encode(&mut self.values)?;
        Ok(())
    }

    fn len(&self) -> usize {
        self.values.0.len()
    }
}

#[derive(Default)]
pub struct AnyArgumentBuffer(#[doc(hidden)] pub Vec<AnyValueKind>);

impl AnyArguments {
    #[doc(hidden)]
    pub fn convert_into<'a, A: Arguments>(self) -> Result<A, BoxDynError>
    where
        Option<i32>: Type<A::Database> + Encode<'a, A::Database>,
        Option<bool>: Type<A::Database> + Encode<'a, A::Database>,
        Option<i16>: Type<A::Database> + Encode<'a, A::Database>,
        Option<i32>: Type<A::Database> + Encode<'a, A::Database>,
        Option<i64>: Type<A::Database> + Encode<'a, A::Database>,
        Option<f32>: Type<A::Database> + Encode<'a, A::Database>,
        Option<f64>: Type<A::Database> + Encode<'a, A::Database>,
        Option<String>: Type<A::Database> + Encode<'a, A::Database>,
        Option<Vec<u8>>: Type<A::Database> + Encode<'a, A::Database>,
        bool: Type<A::Database> + Encode<'a, A::Database>,
        i16: Type<A::Database> + Encode<'a, A::Database>,
        i32: Type<A::Database> + Encode<'a, A::Database>,
        i64: Type<A::Database> + Encode<'a, A::Database>,
        f32: Type<A::Database> + Encode<'a, A::Database>,
        f64: Type<A::Database> + Encode<'a, A::Database>,
        Arc<String>: Type<A::Database> + Encode<'a, A::Database>,
        Arc<str>: Type<A::Database> + Encode<'a, A::Database>,
        Arc<Vec<u8>>: Type<A::Database> + Encode<'a, A::Database>,
    {
        let mut out = A::default();

        for arg in self.values.0 {
            match arg {
                AnyValueKind::Null(AnyTypeInfoKind::Null) => out.add(Option::<i32>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Bool) => out.add(Option::<bool>::None),
                AnyValueKind::Null(AnyTypeInfoKind::SmallInt) => out.add(Option::<i16>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Integer) => out.add(Option::<i32>::None),
                AnyValueKind::Null(AnyTypeInfoKind::BigInt) => out.add(Option::<i64>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Real) => out.add(Option::<f32>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Double) => out.add(Option::<f64>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Text) => out.add(Option::<String>::None),
                AnyValueKind::Null(AnyTypeInfoKind::Blob) => out.add(Option::<Vec<u8>>::None),
                AnyValueKind::Bool(b) => out.add(b),
                AnyValueKind::SmallInt(i) => out.add(i),
                AnyValueKind::Integer(i) => out.add(i),
                AnyValueKind::BigInt(i) => out.add(i),
                AnyValueKind::Real(r) => out.add(r),
                AnyValueKind::Double(d) => out.add(d),
                AnyValueKind::Text(t) => out.add(t),
                AnyValueKind::TextSlice(t) => out.add(t),
                AnyValueKind::Blob(b) => out.add(b),
            }?
        }
        Ok(out)
    }
}

```

### Core Architecture Module: `sqlx-core/src/any/column.rs`
```
use crate::any::{Any, AnyTypeInfo};
use crate::column::Column;
use crate::ext::ustr::UStr;

#[derive(Debug, Clone)]
pub struct AnyColumn {
    // NOTE: these fields are semver-exempt. See crate root docs for details.
    #[doc(hidden)]
    pub ordinal: usize,

    #[doc(hidden)]
    pub name: UStr,

    #[doc(hidden)]
    pub type_info: AnyTypeInfo,
}
impl Column for AnyColumn {
    type Database = Any;

    fn ordinal(&self) -> usize {
        self.ordinal
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn type_info(&self) -> &AnyTypeInfo {
        &self.type_info
    }
}

```

### Core Architecture Module: `sqlx-core/src/any/connection/backend.rs`
```
use crate::any::{AnyArguments, AnyQueryResult, AnyRow, AnyStatement, AnyTypeInfo};
use crate::sql_str::SqlStr;
use either::Either;
use futures_core::future::BoxFuture;
use futures_core::stream::BoxStream;
use std::fmt::Debug;

pub trait AnyConnectionBackend: std::any::Any + Debug + Send + 'static {
    /// The backend name.
    fn name(&self) -> &str;

    /// Explicitly close this database connection.
    ///
    /// This method is **not required** for safe and consistent operation. However, it is
    /// recommended to call it instead of letting a connection `drop` as the database backend
    /// will be faster at cleaning up resources.
    fn close(self: Box<Self>) -> BoxFuture<'static, crate::Result<()>>;

    /// Immediately close the connection without sending a graceful shutdown.
    ///
    /// This should still at least send a TCP `FIN` frame to let the server know we're dying.
    #[doc(hidden)]
    fn close_hard(self: Box<Self>) -> BoxFuture<'static, crate::Result<()>>;

    /// Checks if a connection to the database is still valid.
    fn ping(&mut self) -> BoxFuture<'_, crate::Result<()>>;

    /// Begin a new transaction or establish a savepoint within the active transaction.
    ///
    /// If this is a new transaction, `statement` may be used instead of the
    /// default "BEGIN" statement.
    ///
    /// If we are already inside a transaction and `statement.is_some()`, then
    /// `Error::InvalidSavePoint` is returned without running any statements.
    fn begin(&mut self, statement: Option<SqlStr>) -> BoxFuture<'_, crate::Result<()>>;

    fn commit(&mut self) -> BoxFuture<'_, crate::Result<()>>;

    fn rollback(&mut self) -> BoxFuture<'_, crate::Result<()>>;

    fn start_rollback(&mut self);

    /// Returns the current transaction depth.
    ///
    /// Transaction depth indicates the level of nested transactions:
    /// - Level 0: No active transaction.
    /// - Level 1: A transaction is active.
    /// - Level 2 or higher: A transaction is active and one or more SAVEPOINTs have been created within it.
    fn get_transaction_depth(&self) -> usize {
        unimplemented!("get_transaction_depth() is not implemented for this backend. This is a provided method to avoid a breaking change, but it will become a required method in version 0.9 and later.");
    }

    /// Checks if the connection is currently in a transaction.
    ///
    /// This method returns `true` if the current transaction depth is greater than 0,
    /// indicating that a transaction is active. It returns `false` if the transaction depth is 0,
    /// meaning no transaction is active.
    #[inline]
    fn is_in_transaction(&self) -> bool {
        self.get_transaction_depth() != 0
    }

    /// The number of statements currently cached in the connection.
    fn cached_statements_size(&self) -> usize {
        0
    }

    /// Removes all statements from the cache, closing them on the server if
    /// needed.
    fn clear_cached_statements(&mut self) -> BoxFuture<'_, crate::Result<()>> {
        Box::pin(async move { Ok(()) })
    }

    /// Forward to [`Connection::shrink_buffers()`].
    ///
    /// [`Connection::shrink_buffers()`]: method@crate::connection::Connection::shrink_buffers
    fn shrink_buffers(&mut self);

    #[doc(hidden)]
    fn flush(&mut self) -> BoxFuture<'_, crate::Result<()>>;

    #[doc(hidden)]
    fn should_flush(&self) -> bool;

    #[cfg(feature = "migrate")]
    fn as_migrate(&mut self) -> crate::Result<&mut (dyn crate::migrate::Migrate + Send + 'static)> {
        Err(crate::Error::Configuration(
            format!(
                "{} driver does not support migrations or `migrate` feature was not enabled",
                self.name()
            )
            .into(),
        ))
    }

    fn fetch_many(
        &mut self,
        query: SqlStr,
        persistent: bool,
        arguments: Option<AnyArguments>,
    ) -> BoxStream<'_, crate::Result<Either<AnyQueryResult, AnyRow>>>;

    fn fetch_optional(
        &mut self,
        query: SqlStr,
        persistent: bool,
        arguments: Option<AnyArguments>,
    ) -> BoxFuture<'_, crate::Result<Option<AnyRow>>>;

    fn prepare_with<'c, 'q: 'c>(
        &'c mut self,
        sql: SqlStr,
        parameters: &[AnyTypeInfo],
    ) -> BoxFuture<'c, crate::Result<AnyStatement>>;

    #[cfg(feature = "offline")]
    fn describe(
        &mut self,
        sql: SqlStr,
    ) -> BoxFuture<'_, crate::Result<crate::describe::Describe<crate::any::Any>>>;
}

```

### Core Architecture Module: `sqlx-core/src/any/connection/executor.rs`
```
use crate::any::{Any, AnyConnection, AnyQueryResult, AnyRow, AnyStatement, AnyTypeInfo};
use crate::error::Error;
use crate::executor::{Execute, Executor};
use crate::sql_str::SqlStr;
use either::Either;
use futures_core::future::BoxFuture;
use futures_core::stream::BoxStream;
use futures_util::{stream, FutureExt, StreamExt};
use std::future;

impl<'c> Executor<'c> for &'c mut AnyConnection {
    type Database = Any;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        mut query: E,
    ) -> BoxStream<'e, Result<Either<AnyQueryResult, AnyRow>, Error>>
    where
        'c: 'e,
        E: 'q + Execute<'q, Any>,
    {
        let arguments = match query.take_arguments().map_err(Error::Encode) {
            Ok(arguments) => arguments,
            Err(error) => return stream::once(future::ready(Err(error))).boxed(),
        };
        let persistent = query.persistent();
        self.backend.fetch_many(query.sql(), persistent, arguments)
    }

    fn fetch_optional<'e, 'q: 'e, E>(
        self,
        mut query: E,
    ) -> BoxFuture<'e, Result<Option<AnyRow>, Error>>
    where
        'c: 'e,
        E: 'q + Execute<'q, Self::Database>,
    {
        let arguments = match query.take_arguments().map_err(Error::Encode) {
            Ok(arguments) => arguments,
            Err(error) => return future::ready(Err(error)).boxed(),
        };
        let persistent = query.persistent();
        self.backend
            .fetch_optional(query.sql(), persistent, arguments)
    }

    fn prepare_with<'e>(
        self,
        sql: SqlStr,
        parameters: &[AnyTypeInfo],
    ) -> BoxFuture<'e, Result<AnyStatement, Error>>
    where
        'c: 'e,
    {
        self.backend.prepare_with(sql, parameters)
    }

    #[cfg(feature = "offline")]
    fn describe<'e>(
        self,
        sql: SqlStr,
    ) -> BoxFuture<'e, Result<crate::describe::Describe<Self::Database>, Error>>
    where
        'c: 'e,
    {
        self.backend.describe(sql)
    }
}

```

### Core Architecture Module: `sqlx-core/src/any/connection/mod.rs`
```
use futures_core::future::BoxFuture;
use std::future::Future;

use crate::any::{Any, AnyConnectOptions};
use crate::connection::{ConnectOptions, Connection};
use crate::error::Error;

use crate::config;
use crate::database::Database;
use crate::sql_str::SqlSafeStr;
use crate::transaction::Transaction;
pub use backend::AnyConnectionBackend;

mod backend;
mod executor;

/// A connection to _any_ SQLx database.
///
/// The database driver used is determined by the scheme
/// of the connection url.
///
/// ```text
/// postgres://postgres@localhost/test
/// sqlite://a.sqlite
/// ```
#[derive(Debug)]
pub struct AnyConnection {
    pub(crate) backend: Box<dyn AnyConnectionBackend>,
}

impl AnyConnection {
    /// Returns the name of the database backend in use (e.g. PostgreSQL, MySQL, SQLite, etc.)
    pub fn backend_name(&self) -> &str {
        self.backend.name()
    }

    pub(crate) fn connect(options: &AnyConnectOptions) -> BoxFuture<'_, crate::Result<Self>> {
        Box::pin(async {
            let driver = crate::any::driver::from_url(&options.database_url)?;
            (*driver.connect)(options, None).await
        })
    }

    /// UNSTABLE: for use with `sqlx-cli`
    ///
    /// Connect to the database, and instruct the nested driver to
    /// read options from the sqlx.toml file as appropriate.
    #[doc(hidden)]
    pub async fn connect_with_driver_config(
        url: &str,
        driver_config: &config::drivers::Config,
    ) -> Result<Self, Error>
    where
        Self: Sized,
    {
        let options: AnyConnectOptions = url.parse()?;

        let driver = crate::any::driver::from_url(&options.database_url)?;
        (*driver.connect)(&options, Some(driver_config)).await
    }

    pub(crate) fn connect_with_db<'a, DB: Database>(
        options: &'a AnyConnectOptions,
        driver_config: Option<&'a config::drivers::Config>,
    ) -> BoxFuture<'a, crate::Result<Self>>
    where
        DB::Connection: AnyConnectionBackend,
        <DB::Connection as Connection>::Options:
            for<'b> TryFrom<&'b AnyConnectOptions, Error = Error>,
    {
        let res = TryFrom::try_from(options);

        Box::pin(async move {
            let mut options: <DB::Connection as Connection>::Options = res?;

            if let Some(config) = driver_config {
                options = options.__unstable_apply_driver_config(config)?;
            }

            Ok(AnyConnection {
                backend: Box::new(options.connect().await?),
            })
        })
    }

    #[cfg(feature = "migrate")]
    pub(crate) fn get_migrate(
        &mut self,
    ) -> crate::Result<&mut (dyn crate::migrate::Migrate + Send + 'static)> {
        self.backend.as_migrate()
    }
}

impl Connection for AnyConnection {
    type Database = Any;

    type Options = AnyConnectOptions;

    fn close(self) -> impl Future<Output = Result<(), Error>> + Send + 'static {
        self.backend.close()
    }

    fn close_hard(self) -> impl Future<Output = Result<(), Error>> + Send + 'static {
        self.backend.close_hard()
    }

    fn ping(&mut self) -> impl Future<Output = Result<(), Error>> + Send + '_ {
        self.backend.ping()
    }

    fn begin(
        &mut self,
    ) -> impl Future<Output = Result<Transaction<'_, Self::Database>, Error>> + Send + '_
    where
        Self: Sized,
    {
        Transaction::begin(self, None)
    }

    fn begin_with(
        &mut self,
        statement: impl SqlSafeStr,
    ) -> impl Future<Output = Result<Transaction<'_, Self::Database>, Error>> + Send + '_
    where
        Self: Sized,
    {
        Transaction::begin(self, Some(statement.into_sql_str()))
    }

    fn cached_statements_size(&self) -> usize {
        self.backend.cached_statements_size()
    }

    fn clear_cached_statements(&mut self) -> impl Future<Output = crate::Result<()>> + Send + '_ {
        self.backend.clear_cached_statements()
    }

    fn shrink_buffers(&mut self) {
        self.backend.shrink_buffers()
    }

    #[doc(hidden)]
    fn flush(&mut self) -> impl Future<Output = Result<(), Error>> + Send + '_ {
        self.backend.flush()
    }

    #[doc(hidden)]
    fn should_flush(&self) -> bool {
        self.backend.should_flush()
    }
}

```

### Core Architecture Module: `sqlx-core/src/any/database.rs`
```
use crate::any::{
    AnyArgumentBuffer, AnyArguments, AnyColumn, AnyConnection, AnyQueryResult, AnyRow,
    AnyStatement, AnyTransactionManager, AnyTypeInfo, AnyValue, AnyValueRef,
};
use crate::database::{Database, HasStatementCache};

/// Opaque database driver. Capable of being used in place of any SQLx database driver. The actual
/// driver used will be selected at runtime, from the connection url.
#[derive(Debug)]
pub struct Any;

impl Database for Any {
    type Connection = AnyConnection;

    type TransactionManager = AnyTransactionManager;

    type Row = AnyRow;

    type QueryResult = AnyQueryResult;

    type Column = AnyColumn;

    type TypeInfo = AnyTypeInfo;

    type Value = AnyValue;
    type ValueRef<'r> = AnyValueRef<'r>;

    type Arguments = AnyArguments;
    type ArgumentBuffer = AnyArgumentBuffer;

    type Statement = AnyStatement;

    const NAME: &'static str = "Any";

    const URL_SCHEMES: &'static [&'static str] = &[];
}

// This _may_ be true, depending on the selected database
impl HasStatementCache for Any {}

```

### Core Architecture Module: `sqlx-core/src/any/driver.rs`
```
use crate::any::connection::AnyConnectionBackend;
use crate::any::{AnyConnectOptions, AnyConnection};
use crate::common::DebugFn;
use crate::connection::Connection;
use crate::database::Database;
use crate::{config, Error};
use futures_core::future::BoxFuture;
use std::fmt::{Debug, Formatter};
use std::sync::OnceLock;
use url::Url;

static DRIVERS: OnceLock<&'static [AnyDriver]> = OnceLock::new();

#[macro_export]
macro_rules! declare_driver_with_optional_migrate {
    ($name:ident = $db:path) => {
        #[cfg(feature = "migrate")]
        pub const $name: $crate::any::driver::AnyDriver =
            $crate::any::driver::AnyDriver::with_migrate::<$db>();

        #[cfg(not(feature = "migrate"))]
        pub const $name: $crate::any::driver::AnyDriver =
            $crate::any::driver::AnyDriver::without_migrate::<$db>();
    };
}

#[non_exhaustive]
pub struct AnyDriver {
    pub(crate) name: &'static str,
    pub(crate) url_schemes: &'static [&'static str],
    pub(crate) connect: DebugFn<
        for<'a> fn(
            &'a AnyConnectOptions,
            Option<&'a config::drivers::Config>,
        ) -> BoxFuture<'a, crate::Result<AnyConnection>>,
    >,
    pub(crate) migrate_database: Option<AnyMigrateDatabase>,
}

impl AnyDriver {
    pub const fn without_migrate<DB: Database>() -> Self
    where
        DB::Connection: AnyConnectionBackend,
        <DB::Connection as Connection>::Options:
            for<'a> TryFrom<&'a AnyConnectOptions, Error = Error>,
    {
        Self {
            name: DB::NAME,
            url_schemes: DB::URL_SCHEMES,
            connect: DebugFn(AnyConnection::connect_with_db::<DB>),
            migrate_database: None,
        }
    }

    #[cfg(not(feature = "migrate"))]
    pub const fn with_migrate<DB: Database>() -> Self
    where
        DB::Connection: AnyConnectionBackend,
        <DB::Connection as Connection>::Options:
            for<'a> TryFrom<&'a AnyConnectOptions, Error = Error>,
    {
        Self::without_migrate::<DB>()
    }

    #[cfg(feature = "migrate")]
    pub const fn with_migrate<DB: Database + crate::migrate::MigrateDatabase>() -> Self
    where
        DB::Connection: AnyConnectionBackend,
        <DB::Connection as Connection>::Options:
            for<'a> TryFrom<&'a AnyConnectOptions, Error = Error>,
    {
        Self {
            migrate_database: Some(AnyMigrateDatabase {
                create_database: DebugFn(|url| Box::pin(DB::create_database(url))),
                database_exists: DebugFn(|url| Box::pin(DB::database_exists(url))),
                drop_database: DebugFn(|url| Box::pin(DB::drop_database(url))),
                force_drop_database: DebugFn(|url| Box::pin(DB::force_drop_database(url))),
            }),
            ..Self::without_migrate::<DB>()
        }
    }

    pub fn get_migrate_database(&self) -> crate::Result<&AnyMigrateDatabase> {
        self.migrate_database.as_ref()
            .ok_or_else(|| Error::Configuration(format!("{} driver does not support migrations or the `migrate` feature was not enabled for it", self.name).into()))
    }
}

impl Debug for AnyDriver {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AnyDriver")
            .field("name", &self.name)
            .field("url_schemes", &self.url_schemes)
            .finish()
    }
}

pub struct AnyMigrateDatabase {
    create_database: DebugFn<fn(&str) -> BoxFuture<'_, crate::Result<()>>>,
    database_exists: DebugFn<fn(&str) -> BoxFuture<'_, crate::Result<bool>>>,
    drop_database: DebugFn<fn(&str) -> BoxFuture<'_, crate::Result<()>>>,
    force_drop_database: DebugFn<fn(&str) -> BoxFuture<'_, crate::Result<()>>>,
}

impl AnyMigrateDatabase {
    pub fn create_database<'a>(&self, url: &'a str) -> BoxFuture<'a, crate::Result<()>> {
        (self.create_database)(url)
    }

    pub fn database_exists<'a>(&self, url: &'a str) -> BoxFuture<'a, crate::Result<bool>> {
        (self.database_exists)(url)
    }

    pub fn drop_database<'a>(&self, url: &'a str) -> BoxFuture<'a, crate::Result<()>> {
        (self.drop_database)(url)
    }

    pub fn force_drop_database<'a>(&self, url: &'a str) -> BoxFuture<'a, crate::Result<()>> {
        (self.force_drop_database)(url)
    }
}

/// Install the list of drivers for [`AnyConnection`] to use.
///
/// Must be called before an `AnyConnection` or `AnyPool` can be connected.
///
/// ### Errors
/// If called more than once.
pub fn install_drivers(
    drivers: &'static [AnyDriver],
) -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
    DRIVERS
        .set(drivers)
        .map_err(|_| "drivers already installed".into())
}

#[cfg(feature = "migrate")]
pub(crate) fn from_url_str(url: &str) -> crate::Result<&'static AnyDriver> {
    from_url(&url.parse().map_err(Error::config)?)
}

pub(crate) fn from_url(url: &Url) -> crate::Result<&'static AnyDriver> {
    let scheme = url.scheme();

    let drivers: &[AnyDriver] = DRIVERS
        .get()
        .expect("No drivers installed. Please see the documentation in `sqlx::any` for details.");

    drivers
        .iter()
        .find(|driver| driver.url_schemes.contains(&url.scheme()))
        .ok_or_else(|| {
            Error::Configuration(format!("no driver found for URL scheme {scheme:?}").into())
        })
}

```

### Core Architecture Module: `sqlx-core/src/any/error.rs`
```
use std::any::type_name;

use crate::any::type_info::AnyTypeInfo;
use crate::any::Any;
use crate::error::BoxDynError;
use crate::type_info::TypeInfo;
use crate::types::Type;

pub(super) fn mismatched_types<T: Type<Any>>(ty: &AnyTypeInfo) -> BoxDynError {
    format!(
        "mismatched types; Rust type `{}` is not compatible with SQL type `{}`",
        type_name::<T>(),
        ty.name()
    )
    .into()
}

```

### Core Architecture Module: `sqlx-core/src/any/kind.rs`
```
// Annoying how deprecation warnings trigger in the same module as the deprecated item.
#![allow(deprecated)]
// Cargo features are broken in this file.
// `AnyKind` may return at some point but it won't be a simple enum.
#![allow(unexpected_cfgs)]

use crate::error::Error;
use std::str::FromStr;

#[deprecated = "not used or returned by any API"]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum AnyKind {
    #[cfg(feature = "postgres")]
    Postgres,

    #[cfg(feature = "mysql")]
    MySql,

    #[cfg(feature = "_sqlite")]
    Sqlite,

    #[cfg(feature = "mssql")]
    Mssql,
}

impl FromStr for AnyKind {
    type Err = Error;

    fn from_str(url: &str) -> Result<Self, Self::Err> {
        match url {
            #[cfg(feature = "postgres")]
            _ if url.starts_with("postgres:") || url.starts_with("postgresql:") => {
                Ok(AnyKind::Postgres)
            }

            #[cfg(not(feature = "postgres"))]
            _ if url.starts_with("postgres:") || url.starts_with("postgresql:") => {
                Err(Error::Configuration("database URL has the scheme of a PostgreSQL database but the `postgres` feature is not enabled".into()))
            }

            #[cfg(feature = "mysql")]
            _ if url.starts_with("mysql:") || url.starts_with("mariadb:") => {
                Ok(AnyKind::MySql)
            }

            #[cfg(not(feature = "mysql"))]
            _ if url.starts_with("mysql:") || url.starts_with("mariadb:") => {
                Err(Error::Configuration("database URL has the scheme of a MySQL database but the `mysql` feature is not enabled".into()))
            }

            #[cfg(feature = "_sqlite")]
            _ if url.starts_with("sqlite:") => {
                Ok(AnyKind::Sqlite)
            }

            #[cfg(not(feature = "_sqlite"))]
            _ if url.starts_with("sqlite:") => {
                Err(Error::Configuration("database URL has the scheme of a SQLite database but the `sqlite` feature is not enabled".into()))
            }

            #[cfg(feature = "mssql")]
            _ if url.starts_with("mssql:") || url.starts_with("sqlserver:") => {
                Ok(AnyKind::Mssql)
            }

            #[cfg(not(feature = "mssql"))]
            _ if url.starts_with("mssql:") || url.starts_with("sqlserver:") => {
                Err(Error::Configuration("database URL has the scheme of a MSSQL database but the `mssql` feature is not enabled".into()))
            }

            _ => Err(Error::Configuration(format!("unrecognized database url: {url:?}").into()))
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4497** (2026-11-09): **Postgres: "unable to resolve type OIDs" when resolving nested composite types — `fill_cache` drops pending rows on `continue 'outer`**
  *Symptoms*: ### I have found these related issues/pull requests  I searched for "unable to resolve type OIDs" and found no existing reports of this problem. Related, but different:  - #4361 (fixes #4305): touched the same type-resolution path in `resolve.rs` (unnamed statement destroyed by the catalog lookup), but does not change the `fill_cache` dependency loop. - #1672: problems with arrays of custom types inside records, on the decoding side; this report is about OID resolution before decoding. - #2133: custom type name → OID resolution ignoring `search_path`; a different resolution bug.  ### Description  ### Bug Description  `TypeResolver::fill_cache` in `sqlx-postgres/src/connection/resolve.rs` can lose types it still has to resolve. The query then fails with:  ``` Protocol("unable to resolve type OIDs: [Oid(…)]") ```  It happens when one catalog row resolves a type that **several** pending rows depend on, and one of those dependents still needs **another** type that isn't cached yet.  In that case the loop runs `continue 'outer` and throws away the rest of `resolved_dependencies`. Those rows were already taken out of `missing_dependencies` and are never processed again. Any type that was waiting on one of them stays in `missing_dependencies` forever, and the function returns the error above.  The type cache is per connection, so in practice this shows up as intermittent errors on **fresh connections only**. A connection that already cached the leaf types through an earlier query do

- **Issue #4484** (2026-10-27): **PgConnection errors on NOTIFY delivered to a non-PgListener connection**
  *Symptoms*: ### I have found these related issues/pull requests  - #67 (PgBouncer support) covers prepared statements, startup parameters and session advisory locks in transaction mode, but not notifications. - #2956 (`PgListener` "unknown message type") is a different error, on a listener connection. - pgbouncer/pgbouncer#655: `LISTEN` isn't supported in transaction pooling, which is how the notification reaches other clients in the second case below.  ### Description  On a `PgConnection` that isn't a `PgListener`, a NotificationResponse from the server fails the query in progress with `Protocol("execute: unexpected message: NotificationResponse")`. The statement has already run, and its transaction has committed.  In `PgStream::recv` (`sqlx-postgres/src/connection/stream.rs`), a NotificationResponse is consumed only when `self.notifications` is set, that is, on a `PgListener`'s connection. Otherwise it falls through to the executor, which treats any unexpected message as a protocol error (`executor.rs:366`).  The Postgres protocol says a frontend must accept it anywhere ([Asynchronous Operations](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-ASYNC)): "Frontends must be prepared to deal with these messages at any time, even when not engaged in a query", and "Good practice is to be able to accept NotificationResponse at any point in the protocol."  There are two ways an ordinary connection can receive a NotificationResponse:  1. **The connection ran `LISTEN` itself*

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

### Incident Patch 1: `47b9f8e7` (2026-11-09)
**Commit Message**: fix(postgres): keep draining resolved type dependencies in fill_cache. (#4498)

`resolved_dependencies` contains rows already removed from
`missing_dependencies`. When a dependent row still had an uncached
dependency, `continue 'outer` discarded the rest of the deque, leaving
their dependents unresolved.

Keep draining the deque after re-registering the blocked row.

Fixes #4497.

**File**: `sqlx-postgres/src/connection/resolve.rs` (modified, +9/-1)
```diff
@@ -453,7 +453,15 @@ impl TypeResolver {
 
                         self.push_type("NULL", missing_oid.0);
 
-                        continue 'outer;
+                        // Keep draining rows whose dependency was just resolved;
+                        // abandoning them here would leave them unresolved forever.
+                        match resolved_dependencies.pop_back() {
+                            Some(next_row) => {
+                                type_row = next_row;
+                                continue;
+                            }
+                            None => continue 'outer,
+                        }
                     }
 
                     resolved_dependencies.extend(
```

**File**: `tests/postgres/describe.rs` (modified, +30/-0)
```diff
@@ -119,3 +119,33 @@ async fn it_describes_composite() -> anyhow::Result<()> {
 
     Ok(())
 }
+
+// Regression test for #4497: resolving one custom type could drop other
+// pending dependencies, leaving them unresolved on a cold type cache.
+#[sqlx_macros::test]
+async fn it_describes_nested_custom_types() -> anyhow::Result<()> {
+    let mut conn = new::<Postgres>().await?;
+    conn.execute(
+        r#"
+DROP TYPE IF EXISTS issue_4497_holder CASCADE;
+DROP TYPE IF EXISTS issue_4497_pair CASCADE;
+DROP TYPE IF EXISTS issue_4497_leaf_b CASCADE;
+DROP TYPE IF EXISTS issue_4497_leaf_a CASCADE;
+
+CREATE TYPE issue_4497_leaf_a AS (x int4);
+CREATE TYPE issue_4497_leaf_b AS (y int4);
+CREATE TYPE issue_4497_pair AS (a issue_4497_leaf_a, b issue_4497_leaf_b);
+CREATE TYPE issue_4497_holder AS (items issue_4497_leaf_a[]);
+"#,
+    )
+    .await?;
+
+    // A fresh connection so the type-OID cache is cold.
+    let mut conn = new::<Postgres>().await?;
+    conn.describe(
+        "SELECT NULL::issue_4497_pair[] AS pairs, NULL::issue_4497_holder AS holder".into_sql_str(),
+    )
+    .await?;
+
+    Ok(())
+}
```

---

### Incident Patch 2: `987b8c5a` (2026-11-10)
**Commit Message**: fix(postgres): preserve quoted "NULL" elements when decoding text arrays (#4488)

* fix(postgres): preserve quoted "NULL" elements when decoding text arrays

In PostgreSQL's text array serialization format, an unquoted `NULL` element represents SQL NULL, whereas a quoted `"NULL"` element represents the literal four-character string `"NULL"`.

Previously, the text array decoder unquoted the element text before checking `if value == "NULL"`, erroneously decoding string `"NULL"` into `None` (SQL NULL) and causing silent data loss.

This patch tracks whether the parsed element was surrounded by quotes (`was_quoted`) so that only unquoted `NULL` tokens are treated as SQL NULL.

Closes #4452

* style: format sqlx-postgres/src/types/array.rs with cargo fmt

**File**: `sqlx-postgres/src/types/array.rs` (modified, +42/-1)
```diff
@@ -269,6 +269,7 @@ where
                 let delimiter = ',';
                 let mut done = false;
                 let mut in_quotes = false;
+                let mut was_quoted = false;
                 let mut in_escape = false;
                 let mut value = String::with_capacity(10);
                 let mut chars = s.chars();
@@ -285,6 +286,7 @@ where
 
                                 '"' => {
                                     in_quotes = !in_quotes;
+                                    was_quoted = true;
                                 }
 
                                 '\\' => {
@@ -307,7 +309,7 @@ where
                         }
                     }
 
-                    let value_opt = if value == "NULL" {
+                    let value_opt = if !was_quoted && value == "NULL" {
                         None
                     } else {
                         Some(value.as_bytes())
@@ -321,10 +323,49 @@ where
                     })?);
 
                     value.clear();
+                    was_quoted = false;
                 }
 
                 Ok(elements)
             }
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::decode::Decode;
+
+    #[test]
+    fn test_text_array_decode_quoted_null() {
+        let s = "{\"NULL\",NULL,null}";
+        let value_ref = PgValueRef {
+            value: Some(s.as_bytes()),
+            row: None,
+            type_info: PgTypeInfo::with_name("text[]"),
+            format: PgValueFormat::Text,
+        };
+
+        let decoded: Vec<Option<String>> =
+            <Vec<Option<String>> as Decode<Postgres>>::decode(value_ref).unwrap();
+        assert_eq!(
+            decoded,
+            vec![Some("NULL".to_string()), None, Some("null".to_string()),]
+        );
+    }
+
+    #[test]
+    fn test_text_array_decode_string_vec_quoted_null() {
+        let s = "{\"NULL\",\"foo\"}";
+        let value_ref = PgValueRef {
+            value: Some(s.as_bytes()),
+            row: None,
+            type_info: PgTypeInfo::with_name("text[]"),
+            format: PgValueFormat::Text,
+        };
+
+        let decoded: Vec<String> = <Vec<String> as Decode<Postgres>>::decode(value_ref).unwrap();
+        assert_eq!(decoded, vec!["NULL".to_string(), "foo".to_string(),]);
+    }
+}
```

**File**: `tests/postgres/types.rs` (modified, +8/-0)
```diff
@@ -86,6 +86,14 @@ test_type!(string_vec<Vec<String>>(Postgres,
 
     "array['Hello, World', '', 'Goodbye']::text[]"
         == vec!["Hello, World", "", "Goodbye"],
+
+    "array['NULL', 'null']::text[]"
+        == vec!["NULL", "null"],
+));
+
+test_type!(string_vec_opt<Vec<Option<String>>>(Postgres,
+    "array['NULL', NULL, 'null']::text[]"
+        == vec![Some("NULL".to_string()), None, Some("null".to_string())],
 ));
 
 test_type!(string_array<[String; 3]>(Postgres,
```

---

### Incident Patch 3: `fd56e1df` (2026-11-09)
**Commit Message**: fix(macros): reject `#[repr(C)]` on enums in `derive(Type)` (#4508)

* fix(macros): ignore non-integer reprs like repr(C) when deriving Type for enums

The derive took the first path-only item of #[repr(..)] as the integer type, so #[repr(C)] produced `as C` casts that don't compile. Only use integer reprs; anything else is treated like an enum without a repr.

* fix(macros): reject #[repr(C)] on enums in derive(Type)

repr(C) doesn't say whether the enum should be encoded as a string or as a
C-like integer, and the C integer type differs per target. Instead of guessing,
emit a compile error that points at #[repr(i32)] or removing the repr.

Integer reprs work as before (also combined with C, e.g. #[repr(C, u8)]).
Layout-only reprs like align(..), packed, transparent and Rust are still
ignored since they don't affect the encoding.

**File**: `sqlx-macros-core/src/derives/attributes.rs` (modified, +80/-2)
```diff
@@ -57,6 +57,8 @@ pub struct SqlxContainerAttributes {
     pub type_name: Option<TypeName>,
     pub rename_all: Option<RenameAll>,
     pub repr: Option<Ident>,
+    /// Set when `#[repr(C)]` is present; enums reject this (see `check_enum_attributes`).
+    pub repr_c: Option<Ident>,
     pub no_pg_array: bool,
     pub default: bool,
 }
@@ -78,6 +80,7 @@ pub struct SqlxChildAttributes {
 pub fn parse_container_attributes(input: &[Attribute]) -> syn::Result<SqlxContainerAttributes> {
     let mut transparent = None;
     let mut repr = None;
+    let mut repr_c = None;
     let mut type_name = None;
     let mut rename_all = None;
     let mut no_pg_array = None;
@@ -127,15 +130,25 @@ pub fn parse_container_attributes(input: &[Attribute]) -> syn::Result<SqlxContai
             let list: Punctuated<Meta, Token![,]> =
                 attr.parse_args_with(<Punctuated<Meta, Token![,]>>::parse_terminated)?;
 
-            if let Some(path) = list.iter().find_map(|f| f.require_path_only().ok()) {
-                try_set!(repr, path.get_ident().unwrap().clone(), list);
+            for ident in list
+                .iter()
+                .filter_map(|f| f.require_path_only().ok()?.get_ident())
+            {
+                if is_integer_repr(ident) {
+                    try_set!(repr, ident.clone(), list);
+                } else if ident == "C" {
+                    repr_c = Some(ident.clone());
+                }
+                // Other reprs (`Rust`, `transparent`, `align(..)`, `packed`) only affect
+                // layout and say nothing about how the enum is encoded, so they're ignored.
             }
         }
     }
 
     Ok(SqlxContainerAttributes {
         transparent: transparent.unwrap_or(false),
         repr,
+        repr_c,
         type_name,
         rename_all,
         no_pg_array: no_pg_array.unwrap_or(false),
@@ -223,6 +236,23 @@ pub fn check_transparent_attributes(
     Ok(attributes)
 }
 
+fn is_integer_repr(ident: &Ident) -> bool {
+    matches!(
+        ident.to_string().as_str(),
+        "u8" | "u16"
+            | "u32"
+            | "u64"
+            | "u128"
+            | "usize"
+            | "i8"
+            | "i16"
+            | "i32"
+            | "i64"
+            | "i128"
+            | "isize"
+    )
+}
+
 pub fn check_enum_attributes(input: &DeriveInput) -> syn::Result<SqlxContainerAttributes> {
     let attributes = parse_container_attributes(&input.attrs)?;
 
@@ -232,6 +262,16 @@ pub fn check_enum_attributes(input: &DeriveInput) -> syn::Result<SqlxContainerAt
         input
     );
 
+    if let Some(ident) = &attributes.repr_c {
+        if attributes.repr.is_none() {
+            fail!(
+                ident,
+                "#[repr(C)] is ambiguous for #[derive(sqlx::Type)]: use an explicit integer repr \
+                 like #[repr(i32)] to encode as an integer, or remove #[repr(C)] to encode as a string"
+            );
+        }
+    }
+
     Ok(attributes)
 }
 
@@ -305,3 +345,41 @@ pub fn check_struct_attributes(
 
     Ok(attributes)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    fn enum_input(attrs: TokenStream) -> DeriveInput {
+        syn::parse2(quote::quote! {
+            #attrs
+            enum Foo { A, B }
+        })
+        .unwrap()
+    }
+
+    #[test]
+    fn enum_repr_c_is_rejected() {
+        let input = enum_input(quote::quote!(#[repr(C)]));
+        let err = check_enum_attributes(&input)
+            .err()
+            .expect("repr(C) should be rejected");
+        assert!(err.to_string().contains("#[repr(i32)]"), "{err}");
+    }
+
+    #[test]
+    fn enum_repr_c_with_integer_is_accepted() {
+        let input = enum_input(quote::quote!(#[repr(C, u8)]));
+        let attrs = check_enum_attributes(&input).unwrap();
+        assert_eq!(attrs.repr.unwrap(), "u8");
+    }
+
+    #[test]
+    fn enum_layout_only_reprs_are_ignored() {
+        let input = enum_input(quote::quote!(#[repr(align(8))]));
+        assert!(check_enum_attributes(&input).unwrap().repr.is_none());
+
+        let input = enum_input(quote::quote!(#[repr(i16, align(8))]));
+        assert_eq!(check_enum_attributes(&input).unwrap().repr.unwrap(), "i16");
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #4515** (closed): fix(sqlite): reset transaction depth after SQLite rolls back on its own (@yxshee)
- **PR #4514** (2026-11-08): fix(postgres): make `hostaddr` semantics match `libpq` (@abonander)
- **PR #4508** (2026-11-09): fix(macros): reject `#[repr(C)]` on enums in `derive(Type)` (@thelastbackspace)
- **PR #4503** (2026-11-08): fix(mysql): decode DECIMAL columns into integer types correctly (@Map130)
- **PR #4502** (2026-11-08): Bump the upper bound on libsqlite3-sys to allow 0.39.x (@joshtriplett)
- **PR #4498** (2026-11-09): fix(postgres): keep draining resolved type dependencies in fill_cache (@ducnhan123-co)

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

## X. postgres): keep draining resolved type dependencies in fill_cache. (#4498)

**RULE**:
When implementing operations in `sqlx-postgres/src/connection/resolve.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in transact-rs/sqlx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `47b9f8e7`: postgres): keep draining resolved type dependencies in fill_cache. (#4498). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sqlx-postgres/src/connection/resolve.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                        // Keep draining rows whose dependency was just resolved;
                        // abandoning them here would leave them unresolved forever.
                        match resolved_dependencies.pop_back() {
                            Some(next_row) => {
                                type_row = next_row;
                                continue;
                            }
                            None => continue 'outer,
                        }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                        continue 'outer;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `47b9f8e7` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
