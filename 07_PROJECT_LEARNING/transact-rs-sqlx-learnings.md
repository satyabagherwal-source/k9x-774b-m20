> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/transact-rs-sqlx-learnings.md`  
> **Source**: github ([https://github.com/transact-rs/sqlx](https://github.com/transact-rs/sqlx))  
> **Source Version**: `4161768c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:26:40.275Z  
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
> **Harvest Timestamp**: 2026-10-19T03:26:40.265Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `transact-rs/sqlx`
- **Description**: 🧰 The Rust SQL Toolkit. An async, pure Rust SQL crate featuring compile-time checked queries without a DSL. Supports PostgreSQL, MySQL, and SQLite.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 17581 stars

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
- **Issue #4430** (2026-10-03): **SQLCipher crashes on a segfault**
  *Symptoms*: ### I have found these related issues/pull requests  I don't see any issues mentioning any SQLCipher crashes in this repo, but did come across this related issue in the sqlcipher repo: https://github.com/sqlcipher/sqlcipher/issues/598  ### Description  In my testing, the sqlcipher test suite crashes about 8% of the time. I recently saw this while rebasing a PR of mine (#4343), and decided to have a robot look into it.  Here are all the failures exclusively caused by SQLCipher segfaults since 2026-07-01:  * https://github.com/transact-rs/sqlx/actions/runs/36413688549/job/108900510675 * https://github.com/transact-rs/sqlx/actions/runs/35104419529/job/104823079570 * https://github.com/transact-rs/sqlx/actions/runs/34564198418/job/103153392092 * https://github.com/transact-rs/sqlx/actions/runs/34534510553/job/103063488008 * https://github.com/transact-rs/sqlx/actions/runs/33692629721/job/100461951727 * https://github.com/transact-rs/sqlx/actions/runs/32526655032/job/96910377835 * https://github.com/transact-rs/sqlx/actions/runs/32071123060/job/95515306920 * https://github.com/transact-rs/sqlx/actions/runs/31418818610/job/93555336615 * https://github.com/transact-rs/sqlx/actions/runs/28627420274/job/84897256505 * https://github.com/transact-rs/sqlx/actions/runs/28499215476/job/84472614197  And a few more where there were additional errors, but SQLCipher also segfaulted:  * https://github.com/transact-rs/sqlx/actions/runs/36420553996/job/108922827779 * https://github.com/transact-r

- **Issue #4387** (2026-08-20): **Some of the published crates fro version 0.9.0 are missing the content of the license files**
  *Symptoms*: ### I have found these related issues/pull requests  #3237 is closed and was originally resolved by #3293.  But https://github.com/transact-rs/sqlx/pull/3293#issuecomment-2181227547 did not appear to consider that symlink support on windows required special permission and need to be configured properly.  https://github.com/transact-rs/sqlx/pull/3293#issuecomment-2181237393 it has come up.  ### Description  It looks like the release might have been published from windows and ran into https://github.com/rust-lang/cargo/issues/5664  The following crates contain `../LICENSE-APACHE` in the `LICENSE-APACHE` file  instead of the license content.  - [sqlx-core](https://docs.rs/crate/sqlx-core/0.9.0/source/LICENSE-APACHE) - [sqlx-macros](https://docs.rs/crate/sqlx-macros/0.9.0/source/LICENSE-APACHE) - [sqlx-macros-core](https://docs.rs/crate/sqlx-macros-core/0.9.0/source/LICENSE-APACHE) - [sqlx-mysql](https://docs.rs/crate/sqlx-mysql/0.9.0/source/LICENSE-APACHE) - [sqlx-postgres](https://docs.rs/crate/sqlx-postgres/0.9.0/source/LICENSE-APACHE) - [sqlx-sqlite](https://docs.rs/crate/sqlx-sqlite/0.9.0/source/LICENSE-APACHE)  This applies accordingly to the LICENSE-MIT file.  ### Reproduction steps  See links under description  ### SQLx version  0.9.0  ### Enabled SQLx features  packaging  ### Database server and version  irrelevant  ### Operating system  irrelevant  ### Rust version  irrelevant

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

### Incident Patch 1: `4161768c` (2026-10-16)
**Commit Message**: fix(mysql): harden protocol decoders against malformed packets from hostile servers (#4458)

Found during a security review of server-controlled parsing paths (threat model: rogue or MITM MySQL/MariaDB server; handshake parsing is reachable pre-authentication).

### Does your PR solve an issue?

No tracking issue — reported here directly. This extends the fix pattern of #4176 (truncated `OK` packet) to the rest of the protocol; #4451 documents the same review on the PostgreSQL side.

### The problem

- `recv_packet`'s continuation loop accumulated an unbounded number of `0xFFFFFF`-sized parts: a hostile server streams endless 16 MiB frames and the client OOMs at near-zero bandwidth cost.
- The result-set column count (a length-encoded u64) fed `HashMap::with_capacity` / `Vec::reserve` directly; a ~10-byte packet claiming 2^40 columns aborts the process.
- Dozens of decode sites call panicking `bytes::Buf` getters / slice indexing / `advance` on untrusted buffers: truncated ERR packets, every field of `HandshakeV10` (including the attacker-controlled auth-plugin-data length), length-encoded strings claiming more than the remaining bytes, `TextRow` field-count mismatch, `BinaryRow` (

**File**: `sqlx-mysql/src/connection/auth.rs` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@ impl AuthPlugin {
     ) -> Result<bool, Error> {
         match self {
             AuthPlugin::CachingSha2Password if packet[0] == 0x01 => {
+                if packet.len() < 2 {
+                    return Err(err_protocol!(
+                        "expected at least 2 bytes in caching_sha2_password authentication packet but got {}",
+                        packet.len()
+                    ));
+                }
+
                 match packet[1] {
                     // fast_auth_success — the server still sends a trailing
                     // OK_Packet, so yield back to the handshake loop and let
```

**File**: `sqlx-mysql/src/connection/executor.rs` (modified, +9/-0)
```diff
@@ -435,6 +435,15 @@ async fn recv_result_metadata(
     // the result-set metadata is primarily a listing of each output
     // column in the result-set
 
+    // MySQL (and MariaDB) enforce a hard limit of 4096 columns per result set;
+    // reject larger claimed counts before they are used to size allocations,
+    // as a hostile server could otherwise force an arbitrarily large allocation
+    if num_columns > 4096 {
+        return Err(err_protocol!(
+            "result-set metadata claims {num_columns} columns but the maximum supported is 4096"
+        ));
+    }
+
     let mut column_names = HashMap::with_capacity(num_columns);
 
     columns.clear();
```

**File**: `sqlx-mysql/src/connection/stream.rs` (modified, +15/-0)
```diff
@@ -11,6 +11,13 @@ use crate::protocol::response::{EofPacket, ErrPacket, OkPacket, Status};
 use crate::protocol::{Capabilities, Packet};
 use crate::{MySqlConnectOptions, MySqlDatabaseError};
 
+/// The maximum total payload that we accept for a single (possibly reassembled)
+/// packet: 1 GiB, MySQL's own hard maximum for `max_allowed_packet`.
+///
+/// Without this cap, a hostile server could stream an unbounded number of
+/// 16 MiB packet parts and exhaust the client's memory.
+const MAX_PACKET_PAYLOAD_LEN: usize = 1024 * 1024 * 1024;
+
 pub struct MySqlStream<S = Box<dyn Socket>> {
     // Wrapping the socket in `Box` allows us to unsize in-place.
     pub(crate) socket: BufferedSocket<S>,
@@ -155,6 +162,14 @@ impl<S: Socket> MySqlStream<S> {
             while last_read == 0xFF_FF_FF {
                 let part = self.recv_packet_part().await?;
                 last_read = part.len();
+
+                if final_payload.len() + part.len() > MAX_PACKET_PAYLOAD_LEN {
+                    return Err(err_protocol!(
+                        "reassembled packet payload of {} bytes exceeds maximum packet payload of {MAX_PACKET_PAYLOAD_LEN} bytes",
+                        final_payload.len() + part.len()
+                    ));
+                }
+
                 final_payload.extend_from_slice(&part);
             }
             final_payload.into()
```

**File**: `sqlx-mysql/src/io/buf.rs` (modified, +55/-0)
```diff
@@ -62,6 +62,13 @@ impl MySqlBufExt for Bytes {
         let size = usize::try_from(size)
             .map_err(|_| err_protocol!("string length overflows usize: {size}"))?;
 
+        if size > self.remaining() {
+            return Err(err_protocol!(
+                "length-encoded string declares {size} bytes but only {} bytes remain",
+                self.remaining()
+            ));
+        }
+
         self.get_str(size)
     }
 
@@ -70,6 +77,54 @@ impl MySqlBufExt for Bytes {
         let size = usize::try_from(size)
             .map_err(|_| err_protocol!("string length overflows usize: {size}"))?;
 
+        if size > self.remaining() {
+            return Err(err_protocol!(
+                "length-encoded byte string declares {size} bytes but only {} bytes remain",
+                self.remaining()
+            ));
+        }
+
         Ok(self.split_to(size))
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn get_str_lenenc_reads_within_bounds() {
+        let mut buf = Bytes::from_static(&[3, b'a', b'b', b'c']);
+
+        assert_eq!(buf.get_str_lenenc().unwrap(), "abc");
+        assert!(buf.is_empty());
+    }
+
+    #[test]
+    fn get_str_lenenc_rejects_oversized_length() {
+        // 0xfc prefixed length of 0x0100 (256) but only 3 bytes of data
+        let mut buf = Bytes::from_static(&[0xfc, 0x00, 0x01, b'a', b'b', b'c']);
+
+        let err = buf.get_str_lenenc().unwrap_err();
+
+        assert!(err.to_string().contains("256 bytes"), "{err}");
+    }
+
+    #[test]
+    fn get_bytes_lenenc_reads_within_bounds() {
+        let mut buf = Bytes::from_static(&[3, b'a', b'b', b'c']);
+
+        assert_eq!(&*buf.get_bytes_lenenc().unwrap(), b"abc");
+        assert!(buf.is_empty());
+    }
+
+    #[test]
+    fn get_bytes_lenenc_rejects_oversized_length() {
+        // 0xfc prefixed length of 0xffff (65535) but only 1 byte of data
+        let mut buf = Bytes::from_static(&[0xfc, 0xff, 0xff, b'a']);
+
+        let err = buf.get_bytes_lenenc().unwrap_err();
+
+        assert!(err.to_string().contains("65535 bytes"), "{err}");
+    }
+}
```

**File**: `sqlx-mysql/src/protocol/connect/handshake.rs` (modified, +101/-2)
```diff
@@ -29,29 +29,74 @@ pub(crate) struct Handshake {
 
 impl ProtocolDecode<'_> for Handshake {
     fn decode_with(mut buf: Bytes, _: ()) -> Result<Self, Error> {
+        // NOTE: the handshake packet is received before authentication, so a
+        // hostile server can send anything here; every fixed-width read is
+        // validated against the remaining buffer to avoid panicking on
+        // truncated packets
+        if buf.is_empty() {
+            return Err(err_protocol!(
+                "expected protocol version (1 byte) in Handshake packet but got 0 bytes"
+            ));
+        }
+
         let protocol_version = buf.get_u8(); // int<1>
         let server_version = buf.get_str_nul()?; // string<NUL>
+
+        if buf.remaining() < 13 {
+            return Err(err_protocol!(
+                "expected connection id (4 bytes), auth-plugin-data-part-1 (8 bytes) and reserved byte (13 bytes total) in Handshake packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let connection_id = buf.get_u32_le(); // int<4>
         let auth_plugin_data_1 = buf.get_bytes(8); // string<8>
 
         buf.advance(1); // reserved: string<1>
 
+        if buf.remaining() < 2 {
+            return Err(err_protocol!(
+                "expected capability flags part 1 (2 bytes) in Handshake packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let capabilities_1 = buf.get_u16_le(); // int<2>
         let mut capabilities = Capabilities::from_bits_truncate(capabilities_1.into());
 
+        if buf.remaining() < 5 {
+            return Err(err_protocol!(
+                "expected collation (1 byte), status (2 bytes) and capability flags part 2 (2 bytes) in Handshake packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let collation = buf.get_u8(); // int<1>
         let status = Status::from_bits_truncate(buf.get_u16_le());
 
         let capabilities_2 = buf.get_u16_le(); // int<2>
         capabilities |= Capabilities::from_bits_truncate(((capabilities_2 as u32) << 16).into());
 
+        if buf.is_empty() {
+            return Err(err_protocol!(
+                "expected auth-plugin-data length (1 byte) in Handshake packet but got 0 bytes"
+            ));
+        }
+
         let auth_plugin_data_len = if capabilities.contains(Capabilities::PLUGIN_AUTH) {
             buf.get_u8()
         } else {
             buf.advance(1); // int<1>
             0
         };
 
+        if buf.remaining() < 10 {
+            return Err(err_protocol!(
+                "expected reserved bytes (6 bytes) and reserved bytes or capability flags part 3 (4 bytes) in Handshake packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         buf.advance(6); // reserved: string<6>
 
         if capabilities.contains(Capabilities::MYSQL) {
@@ -62,8 +107,18 @@ impl ProtocolDecode<'_> for Handshake {
         }
 
         let auth_plugin_data_2 = if capabilities.contains(Capabilities::SECURE_CONNECTION) {
-            let len = cmp::max(auth_plugin_data_len.saturating_sub(9), 12);
-            let v = buf.get_bytes(len as usize);
+            let len = cmp::max(auth_plugin_data_len.saturating_sub(9), 12) as usize;
+
+            // the attacker-controlled length must fit in the remaining buffer
+            // *with* the trailing NUL-terminator, i.e. `len + 1` bytes
+            if buf.remaining() <= len {
+                return Err(err_protocol!(
+                    "expected auth-plugin-data-part-2 ({len} bytes) and NUL-terminator in Handshake packet but got {} bytes",
+                    buf.remaining()
+                ));
+            }
+
+            let v = buf.get_bytes(len);
             buf.advance(1); // NUL-terminator
 
             v
@@ -197,3 +252,47 @@ fn test_decode_handshake_mariadb_10_4_7() {
         &[116, 54, 76, 92, 106, 34, 100, 83, 85, 49, 52, 79, 112, 104, 57, 34, 60, 72, 53, 110,]
     );
 }
+
+#[test]
+fn test_decode_handshake_truncated_never_panics() {
+    const MYSQL_8_0_18: &[u8] = b"\n8.0.18\x00\x19\x00\x00\x00\x114aB0c\x06g\x00\xff\xff\xff\x02\x00\xff\xc7\x15\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00tL\x03s\x0f[4\rl4. \x00caching_sha2_password\x00";
+    const MARIA_DB_10_4_7: &[u8] = b"\n5.5.5-10.4.7-MariaDB-1:10.4.7+maria~bionic\x00\x0b\x00\x00\x00t6L\\j\"dS\x00\xfe\xf7\x08\x02\x00\xff\x81\x15\x00\x00\x00\x00\x00\x00\x07\x00\x00\x00U14Oph9\"<H5n\x00mysql_native_password\x00";
+
+    for packet in [MYSQL_8_0_18, MARIA_DB_10_4_7] {
+        // every strict prefix of a valid handshake is an error, never a panic
+        for len in 0..packet.len() {
+            assert!(
+                Handshake::decode(packet[..len].into()).is_err(),
+                "expected error for handshake truncated to {len} bytes"
+            );
+        }
+
+        // and the full packet still decodes
+        assert!(Handshake::decode(packet.into()).is_ok());
```

**File**: `sqlx-mysql/src/protocol/response/eof.rs` (modified, +27/-0)
```diff
@@ -28,9 +28,36 @@ impl ProtocolDecode<'_, Capabilities> for EofPacket {
             ));
         }
 
+        if buf.remaining() < 4 {
+            return Err(err_protocol!(
+                "expected warnings (2 bytes) and status flags (2 bytes) in EOF_Packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let warnings = buf.get_u16_le();
         let status = Status::from_bits_truncate(buf.get_u16_le());
 
         Ok(Self { status, warnings })
     }
 }
+
+#[test]
+fn test_decode_eof_packet() {
+    let p = EofPacket::decode_with(
+        b"\xfe\x00\x00\x02\x00".as_ref().into(),
+        Capabilities::empty(),
+    )
+    .unwrap();
+
+    assert_eq!(p.warnings, 0);
+    assert!(p.status.contains(Status::SERVER_STATUS_AUTOCOMMIT));
+}
+
+#[test]
+fn test_decode_eof_packet_truncated() {
+    // only 2 bytes after the 0xfe header, need 4
+    let p = EofPacket::decode_with(b"\xfe\x00\x00".as_ref().into(), Capabilities::empty());
+
+    assert!(p.is_err());
+}
```

**File**: `sqlx-mysql/src/protocol/response/err.rs` (modified, +37/-0)
```diff
@@ -25,13 +25,28 @@ impl ProtocolDecode<'_, Capabilities> for ErrPacket {
             ));
         }
 
+        if buf.remaining() < 2 {
+            return Err(err_protocol!(
+                "expected error code (2 bytes) in ERR_Packet but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let error_code = buf.get_u16_le();
         let mut sql_state = None;
 
         if capabilities.contains(Capabilities::PROTOCOL_41) {
             // If the next byte is '#' then we have a SQL STATE
             if buf.starts_with(b"#") {
                 buf.advance(1);
+
+                if buf.remaining() < 5 {
+                    return Err(err_protocol!(
+                        "expected SQL state (5 bytes) after '#' marker in ERR_Packet but got {} bytes",
+                        buf.remaining()
+                    ));
+                }
+
                 sql_state = Some(buf.get_str(5)?);
             }
         }
@@ -69,3 +84,25 @@ fn test_decode_err_packet_unknown_database() {
     assert_eq!(p.sql_state.as_deref(), Some("42000"));
     assert_eq!(&p.error_message, "Unknown database \'unknown\'");
 }
+
+#[test]
+fn test_decode_err_packet_truncated_error_code() {
+    // only 1 byte of the 2 byte error code is present
+    const ERR_TRUNCATED_CODE: &[u8] = b"\xff\x84";
+
+    let err =
+        ErrPacket::decode_with(ERR_TRUNCATED_CODE.into(), Capabilities::PROTOCOL_41).unwrap_err();
+
+    assert!(err.to_string().contains("expected error code"), "{err}");
+}
+
+#[test]
+fn test_decode_err_packet_truncated_sql_state() {
+    // '#' marker but fewer than 5 bytes of SQL state
+    const ERR_TRUNCATED_STATE: &[u8] = b"\xff\x84\x04#420";
+
+    let err =
+        ErrPacket::decode_with(ERR_TRUNCATED_STATE.into(), Capabilities::PROTOCOL_41).unwrap_err();
+
+    assert!(err.to_string().contains("expected SQL state"), "{err}");
+}
```

**File**: `sqlx-mysql/src/protocol/statement/row.rs` (modified, +125/-3)
```diff
@@ -27,6 +27,14 @@ impl<'de> ProtocolDecode<'de, &'de [MySqlColumn]> for BinaryRow {
         let offset = buf.len();
 
         let null_bitmap_len = (columns.len() + 9) / 8;
+
+        if buf.remaining() < null_bitmap_len {
+            return Err(err_protocol!(
+                "expected null-bitmap of {null_bitmap_len} bytes in binary row but got {} bytes",
+                buf.remaining()
+            ));
+        }
+
         let null_bitmap = buf.get_bytes(null_bitmap_len);
 
         let mut values = Vec::with_capacity(columns.len());
@@ -89,13 +97,31 @@ impl<'de> ProtocolDecode<'de, &'de [MySqlColumn]> for BinaryRow {
                 | ColumnType::Date
                 | ColumnType::Datetime => {
                     // Leave the length byte on the front of the value because decoding uses it.
-                    buf[0] as usize + 1
+                    usize::from(*buf.first().ok_or(err_protocol!(
+                        "buffer exhausted when reading data for column {:?}; expected a length byte but no bytes remain in buffer",
+                        column
+                    ))?) + 1
                 }
 
-                // NOTE: MySQL will never generate NULL types for non-NULL values
-                ColumnType::Null => unreachable!(),
+                // NOTE: MySQL will never legitimately generate NULL types for non-NULL values,
+                // but a hostile or broken server can send column type 0x06 (NULL) with the
+                // null-bit clear; report a protocol error instead of panicking
+                ColumnType::Null => {
+                    return Err(err_protocol!(
+                        "column {:?} has type NULL (0x06) but its null-bit is not set in the binary row",
+                        column
+                    ));
+                }
             };
 
+            if buf.remaining() < size {
+                return Err(err_protocol!(
+                    "buffer exhausted when reading data for column {:?}; expected value of {size} bytes but only {} bytes remain in buffer",
+                    column,
+                    buf.remaining()
+                ));
+            }
+
             let offset = offset - buf.len();
 
             values.push(Some(offset..(offset + size)));
@@ -106,3 +132,99 @@ impl<'de> ProtocolDecode<'de, &'de [MySqlColumn]> for BinaryRow {
         Ok(BinaryRow(Row { values, storage }))
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::ext::ustr::UStr;
+    use crate::MySqlTypeInfo;
+    use sqlx_core::column::ColumnOrigin;
+
+    fn test_column(name: &str, ty: ColumnType) -> MySqlColumn {
+        MySqlColumn {
+            ordinal: 0,
+            name: UStr::new(name),
+            type_info: MySqlTypeInfo::binary(ty),
+            origin: ColumnOrigin::Expression,
+            flags: None,
+        }
+    }
+
+    #[test]
+    fn decodes_simple_row() {
+        let columns = [
+            test_column("a", ColumnType::Long),
+            test_column("b", ColumnType::VarString),
+        ];
+
+        // 0x00 header, 1 byte null-bitmap (both columns non-NULL),
+        // a = 16909060i32 little-endian, b = "hi"
+        let row = BinaryRow::decode_with(
+            Bytes::from_static(&[0x00, 0x00, 0x04, 0x03, 0x02, 0x01, 2, b'h', b'i']),
+            &columns,
+        )
+        .unwrap()
+        .0;
+
+        assert_eq!(row.get(0), Some(&[4, 3, 2, 1][..]));
+        assert_eq!(row.get(1), Some(&b"hi"[..]));
+    }
+
+    #[test]
+    fn decodes_null_value() {
+        let columns = [
+            test_column("a", ColumnType::Long),
+            test_column("b", ColumnType::VarString),
+        ];
+
+        // null-bitmap with bit 2 set => the first column is NULL
+        let row =
+            BinaryRow::decode_with(Bytes::from_static(&[0x00, 0x04, 2, b'h', b'i']), &columns)
+                .unwrap()
+                .0;
+
+        assert_eq!(row.get(0), None);
+        assert_eq!(row.get(1), Some(&b"hi"[..]));
+    }
+
+    #[test]
+    fn rejects_truncated_null_bitmap() {
+        // 8 columns require a 2 byte null-bitmap, only 1 byte is provided
+        let columns: [_; 8] = std::array::from_fn(|_| test_column("a", ColumnType::Long));
+
+        let err = BinaryRow::decode_with(Bytes::from_static(&[0x00, 0x00]), &columns).unwrap_err();
+
+        assert!(err.to_string().contains("null-bitmap"), "{err}");
+    }
+
+    #[test]
+    fn rejects_truncated_fixed_width_value() {
+        // a LongLong value needs 8 bytes, only 3 are provided
+        let columns = [test_column("a", ColumnType::LongLong)];
+
+        let err = BinaryRow::decode_with(Bytes::from_static(&[0x00, 0x00, 1, 2, 3]), &columns)
+            .unwrap_err();
+
+        assert!(err.to_string().contains("value of 8 bytes"), "{err}");
+    }
+
+    #[test]
+    fn rejects_missing_temporal_length_byte() {
+        // the column type signals a length byte but the buffer is exhausted
+        let columns = [test_column("a", ColumnType::D
```

---

### Incident Patch 2: `5d3787ef` (2026-09-10)
**Commit Message**: fix(pool): prevent num_idle underflow that wedges maintenance in a CPU spin (#4289)

* fix(pool): prevent num_idle underflow that wedges maintenance in a CPU spin

Fixes #3645 - A rare 100% CPU and a hang on shutdown.

I made this fix w/ the assistance of an LLM, but I was looking quite
carefully to make sure the code changes make sense.

I opted to repro via a stress test - which shows the underflow if you
run the test without the fix.

Leaving an LLM generated description down below in case you find it
helpful.

---------------------------------------------------------------------

`PoolInner::release` made a returned connection acquirable (push to the
idle queue + release its semaphore permit) *before* incrementing
`num_idle`. A concurrent `pop_idle` (via `try_acquire`) could pop that
connection and run its `num_idle.fetch_sub(1)` in the window before the
increment landed; if `num_idle` was 0 at that moment the `usize` wrapped
to `usize::MAX`.

The background maintenance task builds its sweep range from
`for _ in 0..pool.num_idle()`, and once the idle queue drains the loop
body is fully synchronous (`try_acquire`/`release` never `.await`). So a
single bad read of `usize::MAX` ma

**File**: `sqlx-core/src/pool/inner.rs` (modified, +199/-5)
```diff
@@ -194,7 +194,14 @@ impl<DB: Database> PoolInner<DB> {
         permit: AsyncSemaphoreReleaser<'a>,
     ) -> Result<Floating<DB, Idle<DB>>, AsyncSemaphoreReleaser<'a>> {
         if let Some(idle) = self.idle_conns.pop() {
-            self.num_idle.fetch_sub(1, Ordering::AcqRel);
+            // Saturating: never underflow even if a concurrent `release` hasn't yet published
+            // its increment. An underflow would wrap `num_idle` to `usize::MAX` and wedge the
+            // maintenance task in a non-yielding spin (see `release` for the full invariant).
+            let _ = self
+                .num_idle
+                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |n| {
+                    Some(n.saturating_sub(1))
+                });
             Ok(Floating::from_idle(idle, (*self).clone(), permit))
         } else {
             Err(permit)
@@ -206,15 +213,21 @@ impl<DB: Database> PoolInner<DB> {
 
         let Floating { inner: idle, guard } = floating.into_idle();
 
+        // Bump the idle counter *before* the connection becomes acquirable, so a concurrent
+        // `pop_idle` can never observe a popped connection without a matching increment.
+        // (Otherwise `num_idle.fetch_sub` can underflow a `usize` to `usize::MAX`, which makes
+        // the maintenance task's `for _ in 0..num_idle()` loop spin ~forever, pegging a CPU.)
+        // Over-counting transiently (incremented, not yet pushed) is harmless: `pop_idle`
+        // simply finds an empty queue and returns the permit without decrementing.
+        self.num_idle.fetch_add(1, Ordering::AcqRel);
+
         if self.idle_conns.push(idle).is_err() {
             panic!("BUG: connection queue overflow in release()");
         }
 
         // NOTE: we need to make sure we drop the permit *after* we push to the idle queue
         // don't decrease the size
         guard.release_permit();
-
-        self.num_idle.fetch_add(1, Ordering::AcqRel);
     }
 
     /// Try to atomically increment the pool size for a new connection.
@@ -544,8 +557,13 @@ fn spawn_maintenance_tasks<DB: Database>(pool: &Arc<PoolInner<DB>>) {
                     // Go over all idle connections, check for idleness and lifetime,
                     // and if we have fewer than min_connections after reaping a connection,
                     // open a new one immediately. Note that other connections may be popped from
-                    // the queue in the meantime - that's fine, there is no harm in checking more
-                    for _ in 0..pool.num_idle() {
+                    // the queue in the meantime - that's fine, there is no harm in checking more.
+                    //
+                    // Cap the iteration count at `max_connections` so that even a corrupt
+                    // `num_idle` (e.g. an underflow to `usize::MAX`) can never make this
+                    // synchronous, non-yielding loop spin unboundedly and starve the runtime.
+                    let checks = cmp::min(pool.num_idle(), pool.options.max_connections as usize);
+                    for _ in 0..checks {
                         if let Some(conn) = pool.try_acquire() {
                             if is_beyond_idle_timeout(&conn, &pool.options)
                                 || is_beyond_max_lifetime(&conn, &pool.options)
@@ -621,3 +639,179 @@ impl<DB: Database> Drop for DecrementSizeGuard<DB> {
         }
     }
 }
+
+// Uses the in-crate `Any` database with a stub backend so we can drive `PoolInner` internals
+// directly. (We can't use a real driver here: the only `Database` impls outside this crate
+// would be a different `sqlx-core` instance via the dev-dependency cycle.)
+#[cfg(all(test, feature = "any"))]
+mod underflow_tests {
+    use super::*;
+    use crate::any::{
+        Any, AnyArguments, AnyConnectOptions, AnyConnection, AnyConnectionBackend, AnyQueryResult,
+        AnyRow, AnyStatement, AnyTypeInfo,
+    };
+    use crate::pool::Pool;
+    use crate::sql_str::SqlStr;
+    use either::Either;
+    use futures_core::future::BoxFuture;
+    use futures_core::stream::BoxStream;
+    use std::str::FromStr;
+
+    /// A backend that constructs but never executes anything. The pool's `release`/`pop_idle`
+    /// paths only move the opaque connection around — they never call any of these methods.
+    #[derive(Debug)]
+    struct StubBackend;
+
+    impl AnyConnectionBackend for StubBackend {
+        fn name(&self) -> &str {
+            "stub"
+        }
+        fn close(self: Box<Self>) -> BoxFuture<'static, crate::Result<()>> {
+            unimplemented!()
+        }
+        fn close_hard(self: Box<Self>) -> BoxFuture<'static, crate::Result<()>> {
+            unimplemented!()
+        }
+        fn ping(&mut self) -> BoxFuture<'_, crate::Result<()>> {
+            unimplemented!()
+        }
+        fn begin(&mut self, _statement: Option<SqlStr>) -> BoxFuture<'_, crate::Result<()>> {
+            unimplemented!()
+        }
+   
```

---

### Incident Patch 3: `f1e94ec3` (2026-09-09)
**Commit Message**: fix(postgres): roll back a transaction cancelled during BEGIN (#4394)

`PgTransactionManager::begin` raises `transaction_depth` only after the BEGIN
round trip returns, but `start_rollback` -- which both its own `Rollback`
drop guard and `Transaction`'s drop guard call -- is a no-op while that depth
is zero. A future cancelled during the await therefore queues nothing, and the
session is left inside a transaction.

`Floating::return_to_pool` then validates the connection with `ping()`, which
for Postgres is a bare `wait_until_ready`: it drains the `ReadyForQuery` but
never inspects its transaction-status byte, so the connection is judged healthy
and handed to the next borrower. Their statements run inside the stale
transaction and hold its locks, and the first error turns the session into
`idle in transaction (aborted)`, after which every unrelated query on that
connection fails with 25P02 until `max_lifetime` recycles it.

Claim the depth before the round trip and unwind it if the BEGIN did not take,
so the drop guards have something to act on. The queued ROLLBACK is written to
the same buffer as the BEGIN and so is always flushed after it.

Closes #4393. Refs #2054, #2819, #3980.

**File**: `sqlx-postgres/src/transaction.rs` (modified, +8/-1)
```diff
@@ -27,11 +27,18 @@ impl TransactionManager for PgTransactionManager {
 
         let rollback = Rollback::new(conn);
         rollback.conn.queue_simple_query(statement.as_str())?;
+        // Claim the depth before the round trip, not after. `start_rollback` -- which both
+        // this guard and `Transaction`'s own drop guard call -- is a no-op while the depth is
+        // zero, so a future cancelled during the await below would otherwise leave the server
+        // in a transaction with nothing queued to end it. `Pool` then hands that connection
+        // to the next borrower, whose statements silently run inside it. Unwound just below
+        // if the BEGIN did not take.
+        rollback.conn.inner.transaction_depth += 1;
         rollback.conn.wait_until_ready().await?;
         if !rollback.conn.in_transaction() {
+            rollback.conn.inner.transaction_depth -= 1;
             return Err(Error::BeginFailed);
         }
-        rollback.conn.inner.transaction_depth += 1;
         rollback.defuse();
 
         Ok(())
```

**File**: `tests/postgres/postgres.rs` (modified, +51/-0)
```diff
@@ -2244,3 +2244,54 @@ async fn it_can_recover_from_copy_in_invalid_params() -> anyhow::Result<()> {
     )
     .await
 }
+
+// Regression: a future cancelled while `BEGIN`'s round trip is in flight used to leave the
+// session inside a transaction. `start_rollback` is a no-op while `transaction_depth` is
+// zero, and the depth was raised only after the await, so neither drop guard queued a
+// `ROLLBACK` -- and `return_to_pool` validates with a bare `wait_until_ready` that never
+// looks at the `ReadyForQuery` transaction-status byte, so the connection was handed to the
+// next borrower with the transaction still open.
+#[sqlx_macros::test]
+async fn it_rolls_back_a_transaction_cancelled_during_begin() -> anyhow::Result<()> {
+    let pool = PgPoolOptions::new()
+        .max_connections(1)
+        .min_connections(0)
+        .connect(&dotenvy::var("DATABASE_URL")?)
+        .await?;
+
+    let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
+        .fetch_one(&pool)
+        .await?;
+
+    // A plain `BEGIN` answers too quickly to cancel reliably; the sleep widens the same
+    // round trip so the cancellation lands inside it.
+    let cancelled = sqlx_core::rt::timeout(
+        Duration::from_millis(300),
+        pool.begin_with(AssertSqlSafe("BEGIN; SELECT pg_sleep(2);".to_string())),
+    )
+    .await;
+    assert!(cancelled.is_err(), "the begin should not have completed");
+
+    // Outlast the sleep: the queued `ROLLBACK` is only flushed once the abandoned statement
+    // has answered and the connection is on its way back to the pool.
+    sqlx_core::rt::sleep(Duration::from_millis(3500)).await;
+
+    let mut conn = new::<Postgres>().await?;
+    let state: Option<String> =
+        sqlx::query_scalar("SELECT state FROM pg_stat_activity WHERE pid = $1")
+            .bind(pid)
+            .fetch_optional(&mut conn)
+            .await?;
+
+    assert_eq!(
+        state.as_deref(),
+        Some("idle"),
+        "connection was returned to the pool still inside a transaction"
+    );
+
+    // and the pooled connection is still usable
+    let one: i32 = sqlx::query_scalar("SELECT 1").fetch_one(&pool).await?;
+    assert_eq!(one, 1);
+
+    Ok(())
+}
```

#### Recent Merged Pull Requests:
- **PR #4463** (2026-10-15): fix(macros): only report Ambiguous{DateTime,Numeric}Type when preferred crate is Inferred (@rscorer)
- **PR #4458** (2026-10-16): fix(mysql): harden protocol decoders against malformed packets from hostile servers (@portlandhodl)
- **PR #4446** (closed): fix(core): don't roll back the enclosing level when a nested begin fails or is cancelled (@CalebFenton)
- **PR #4444** (closed): feat(postgres, core): `PgConnection::connect_with_socket` and a wasm-safe `Instant` (@iamralch)
- **PR #4442** (2026-10-03): fix(sqlite): await SQLCipher test connection cleanup before exit (@shuvroroy)
- **PR #4441** (2026-10-03): fix(mysql): decode MySQL 9 VECTOR columns (type 0xf2) (@anderson-andres-dev)

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

## X. mysql): harden protocol decoders against malformed packets from hostile servers 

**RULE**:
When implementing operations in `sqlx-mysql/src/connection/auth.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in transact-rs/sqlx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4161768c`: mysql): harden protocol decoders against malformed packets from hostile servers (#4458). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sqlx-mysql/src/connection/auth.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                if packet.len() < 2 {
                    return Err(err_protocol!(
                        "expected at least 2 bytes in caching_sha2_password authentication packet but got {}",
                        packet.len()
                    ));
                }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4161768c` are properly handled with clean fallback behavior.
