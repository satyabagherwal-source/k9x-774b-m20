# Forensic Learning Record (Deep Inspection): transact-rs/sqlx

> **Canonical Artifact**: `07_PROJECT_LEARNING/transact-rs-sqlx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/transact-rs/sqlx](https://github.com/transact-rs/sqlx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:11.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `transact-rs/sqlx`
- **Description**: 🧰 The Rust SQL Toolkit. An async, pure Rust SQL crate featuring compile-time checked queries without a DSL. Supports PostgreSQL, MySQL, and SQLite.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 17541 stars

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

### Core Architecture Module: `sqlx-core/src/any/migrate.rs`
```
use crate::any::driver;
use crate::any::{Any, AnyConnection};
use crate::error::Error;
use crate::migrate::{AppliedMigration, Migrate, MigrateDatabase, MigrateError, Migration};
use futures_core::future::BoxFuture;
use std::time::Duration;

impl MigrateDatabase for Any {
    async fn create_database(url: &str) -> Result<(), Error> {
        driver::from_url_str(url)?
            .get_migrate_database()?
            .create_database(url)
            .await
    }

    async fn database_exists(url: &str) -> Result<bool, Error> {
        driver::from_url_str(url)?
            .get_migrate_database()?
            .database_exists(url)
            .await
    }

    async fn drop_database(url: &str) -> Result<(), Error> {
        driver::from_url_str(url)?
            .get_migrate_database()?
            .drop_database(url)
            .await
    }

    async fn force_drop_database(url: &str) -> Result<(), Error> {
        driver::from_url_str(url)?
            .get_migrate_database()?
            .force_drop_database(url)
            .await
    }
}

impl Migrate for AnyConnection {
    fn create_schema_if_not_exists<'e>(
        &'e mut self,
        schema_name: &'e str,
    ) -> BoxFuture<'e, Result<(), MigrateError>> {
        Box::pin(async {
            self.get_migrate()?
                .create_schema_if_not_exists(schema_name)
                .await
        })
    }

    fn ensure_migrations_table<'e>(
        &'e mut self,
        table_name: &'e str,
    ) -> BoxFuture<'e, Result<(), MigrateError>> {
        Box::pin(async {
            self.get_migrate()?
                .ensure_migrations_table(table_name)
                .await
        })
    }

    fn dirty_version<'e>(
        &'e mut self,
        table_name: &'e str,
    ) -> BoxFuture<'e, Result<Option<i64>, MigrateError>> {
        Box::pin(async { self.get_migrate()?.dirty_version(table_name).await })
    }

    fn list_applied_migrations<'e>(
        &'e mut self,
        table_name: &'e str,
    ) -> BoxFuture<'e, Result<Vec<AppliedMigration>, MigrateError>> {
        Box::pin(async {
            self.get_migrate()?
                .list_applied_migrations(table_name)
                .await
        })
    }

    fn lock(&mut self) -> BoxFuture<'_, Result<(), MigrateError>> {
        Box::pin(async { self.get_migrate()?.lock().await })
    }

    fn unlock(&mut self) -> BoxFuture<'_, Result<(), MigrateError>> {
        Box::pin(async { self.get_migrate()?.unlock().await })
    }

    fn apply<'e>(
        &'e mut self,
        table_name: &'e str,
        migration: &'e Migration,
    ) -> BoxFuture<'e, Result<Duration, MigrateError>> {
        Box::pin(async { self.get_migrate()?.apply(table_name, migration).await })
    }

    fn revert<'e>(
        &'e mut self,
        table_name: &'e str,
        migration: &'e Migration,
    ) -> BoxFuture<'e, Result<Duration, MigrateError>> {
        Box::pin(async { self.get_migrate()?.revert(table_name, migration).await })
    }

    fn skip<'e>(
        &'e mut self,
        table_name: &'e str,
        migration: &'e Migration,
    ) -> BoxFuture<'e, Result<(), MigrateError>> {
        Box::pin(async { self.get_migrate()?.skip(table_name, migration).await })
    }
}

```

### Core Architecture Module: `sqlx-core/src/any/mod.rs`
```
//! **SEE DOCUMENTATION BEFORE USE**. Generic database driver with the specific driver selected at runtime.
//!
//! The underlying database drivers are chosen at runtime from the list set via
//! [`install_drivers`][self::driver::install_drivers]. Any use of `AnyConnection` or `AnyPool`
//! without this will panic.
use crate::executor::Executor;

mod arguments;
pub(crate) mod column;
mod connection;
mod database;
mod error;
mod kind;
mod options;
mod query_result;
pub(crate) mod row;
mod statement;
mod transaction;
pub(crate) mod type_info;
pub mod types;
pub(crate) mod value;

pub mod driver;

#[cfg(feature = "migrate")]
mod migrate;

pub use arguments::{AnyArgumentBuffer, AnyArguments};
pub use column::AnyColumn;
pub use connection::AnyConnection;
// Used internally in `sqlx-macros`

use crate::encode::Encode;
pub use connection::AnyConnectionBackend;
pub use database::Any;
#[allow(deprecated)]
pub use kind::AnyKind;
pub use options::AnyConnectOptions;
pub use query_result::AnyQueryResult;
pub use row::AnyRow;
pub use statement::AnyStatement;
pub use transaction::AnyTransactionManager;
pub use type_info::{AnyTypeInfo, AnyTypeInfoKind};
pub use value::{AnyValue, AnyValueRef};

use crate::types::Type;
#[doc(hidden)]
pub use value::AnyValueKind;

pub type AnyPool = crate::pool::Pool<Any>;

pub type AnyPoolOptions = crate::pool::PoolOptions<Any>;

/// An alias for [`Executor<'_, Database = Any>`][Executor].
pub trait AnyExecutor<'c>: Executor<'c, Database = Any> {}
impl<'c, T: Executor<'c, Database = Any>> AnyExecutor<'c> for T {}

// NOTE: required due to the lack of lazy normalization
impl_into_arguments_for_arguments!(AnyArguments);
// impl_executor_for_pool_connection!(Any, AnyConnection, AnyRow);
// impl_executor_for_transaction!(Any, AnyRow);
impl_acquire!(Any, AnyConnection);
impl_column_index_for_row!(AnyRow);
impl_column_index_for_statement!(AnyStatement);
// impl_into_maybe_pool!(Any, AnyConnection);

// required because some databases have a different handling of NULL
impl<'q, T> Encode<'q, Any> for Option<T>
where
    T: Encode<'q, Any> + 'q + Type<Any>,
{
    fn encode_by_ref(
        &self,
        buf: &mut AnyArgumentBuffer,
    ) -> Result<crate::encode::IsNull, crate::error::BoxDynError> {
        if let Some(value) = self {
            value.encode_by_ref(buf)
        } else {
            buf.0.push(AnyValueKind::Null(T::type_info().kind));
            Ok(crate::encode::IsNull::Yes)
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
  **Post-Mortem & Fix Analysis**:
  > I knew using symlinks was a bad idea. I'd feel vindicated but I'm tired of dealing with problems with packaging systems that I'm not involved in.  Enabling symlinks on Windows is still too much of a pain and it's clearly too easy to forget. I don't know why Git for Windows doesn't just create copies instead (I mainly use it from inside RustRover, so it might actually be a bug in their implementation, I don't know).  I'd accept a PR to just replace the symlinks with copies of the files.

- **Issue #4383** (2026-09-02): **[sqlx-cli] ux bug with sqlx prepare**
  *Symptoms*: ### I have found these related issues/pull requests  I've do some search in issues by `sqlx prepare failed CARGO` and just `sqlx prepare` and didn't find any relations with existing prepare command in just `sqlx` and always proposing error with redirecting to `cargo sqlx` invocation  ### Description  **Title**: `sqlx prepare` listed in help but fails with unclear error  **Description**: `prepare` subcommand is listed in `sqlx --help`, but running it directly fails: ``` $ sqlx prepare error: failed to get value of CARGO; prepare subcommand may only be invoked as cargo sqlx prepare ```   This is confusing because: 1. The command is advertised in help output 2. The error message is unclear — it mentions internal `CARGO` variable instead of telling the user what to do  **Suggested fixes** (any one of): - Remove `prepare` from `sqlx --help` if it only works via `cargo sqlx` - Improve error message: suggest using `cargo sqlx prepare` explicitly - Make `sqlx prepare` work standalone by locating `Cargo.toml` automatically  **Workaround**: Use `cargo sqlx prepare` instead of `sqlx prepare`.  ### Reproduction steps  ``` $ sqlx prepare error: failed to get value of CARGO; prepare subcommand may only be invoked as cargo sqlx prepare ```  ### SQLx version  0.9.0  ### Enabled SQLx features  "postgres", "runtime-tokio", "tls-native-tls"   ### Database server and version  Postgres  ### Operating system  Ubuntu 24.04.4 LTS  ### Rust version  1.94.1

- **Issue #4381** (2026-09-09): **Cannot revert.**
  *Symptoms*: ### I have found these related issues/pull requests  #3439  ### Description  In PostgreSQL, when using `options[search_path]=data,public`, revert is not possible.  ### Reproduction steps  ``` PS E:\tmp> Get-ComputerInfo | Select-Object WindowsVersion, WindowsBuildLabEx  WindowsVersion WindowsBuildLabEx -------------- ----------------- 2009           26100.1.amd64fre.ge_release.240331-1435 PS E:\tmp> cat .env DATABASE_URL="postgres://rust:123456@192.168.31.200/rust?options[search_path]=data,public" PS E:\tmp> sqlx migrate add -r init Creating migrations\20260815075646_init.up.sql Creating migrations\20260815075646_init.down.sql PS E:\tmp> cat migrations\20260815075646_init.up.sql -- Add up migration script here CREATE SCHEMA IF NOT EXISTS data; PS E:\tmp> cat migrations\20260815075646_init.down.sql -- Add down migration script here DROP SCHEMA IF EXISTS data CASCADE; PS E:\tmp> sqlx migrate run Applied 20260815075646/migrate init (39.7574ms) PS E:\tmp> sqlx migrate revert No migrations available to revert PS E:\tmp> cat .\.env DATABASE_URL="postgres://rust:123456@192.168.31.200/rust?options[search_path]=public" PS E:\tmp> sqlx migrate revert Applied 20260815075646/revert init (32.6879ms) PS E:\tmp ```  ### SQLx version  sqlx-cli 0.9.0  ### Enabled SQLx features  default  ### Database server and version  PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit  ### Operating system  docker.io/library/postgres:18  ### Rus
  **Post-Mortem & Fix Analysis**:
  > Not a bug. Please read and understand how setting `search_path` affects unqualified table references like `_sqlx_migrations`: https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH  With 0.9.0, it's now possible to override the path of the migrations table and also automatically create schemas: https://github.com/transact-rs/sqlx/tree/main/examples/postgres/multi-tenant

- **Issue #4373** (2026-09-14): **`SQLite: query!()` segfaults rustc when a column has no declared type**
  *Symptoms*: ### I have found these related issues/pull requests  - **#4088**:  *(Fix) Handle nullability of SQLite rowid alias columns*. This PR introduced the crash. It started requesting the declared-type out-param from `sqlite3_table_column_metadata()` and dereferencing it unconditionally. - **#4323** / **#4322**: another regression from #4088 (`INTEGER PRIMARY KEY` in `RETURNING` going back to `Option`). Different symptom. - **#1979** and **#3546**: both report `unsupported type NULL of column #N`. That's the error you *should* get for a column with no declared type. Right now you get a SIGSEGV before the error can be produced.  ### Description  `StatementHandle::column_nullable` asks `sqlite3_table_column_metadata()` for a column's declared type and then calls `CStr::from_ptr()` on the result without checking for null:  ```rust let datatype = CStr::from_ptr(datatype); ```  SQLite sets that out-param to **NULL** when the column was declared with no type at all, which is legal:  ```sql CREATE TABLE users (device_id PRIMARY KEY, name TEXT); ```  So describing that table dereferences a null pointer and the process dies with SIGSEGV. Because the `query!()` family describes a live database during macro expansion, the process that dies is `rustc` itself:  ``` error: rustc interrupted by SIGSEGV, printing backtrace   2  core::ffi::c_str::CStr::from_ptr   3  sqlx_sqlite::statement::handle::StatementHandle::column_nullable   4  sqlx_sqlite::connection::describe::describe   5  sqlx_sqlite::des

- **Issue #4364** (2026-08-07): **Using sqlx turns tokio runtime singlethreaded**
  *Symptoms*: ### I have found these related issues/pull requests  I have checked for a while, but I can't find any issue discussing this.  ### Description  I run some CPU intensive code in asynchronous context. I know it's not ideal, but it shouldn't be an issue, since tokio is multithreaded, and hogging one worker for a few minutes is acceptable.   However, occasionally results are pushed to postgres. However, it seems that after the first sqlx runs, all other tasks can't run on other worker threads anymore and get a time slice when the next database query is causing the runtime to yield.  Closing the pool "unlocks" the other workers again.  I'm not sure, if this is intended, a bug or a necessary restriction. However, I'd at least love to know, why and how that is happening, as I don't want to accidentally turn all my servers single-threaded.   Thank you for your help!  ### Reproduction steps  This is an example code to demonstrate the issue.  ```rust use std::time::Duration;  use sqlx::PgPool;  const DB_URL: &str = "postgres://devuser:devpassword@localhost:5432/devdb";  async fn db_then_compute(pool: PgPool) {     let num: (i32,) = sqlx::query_as("SELECT 1").fetch_one(&pool).await.unwrap();     println!(         "The num was returned: {}, but now, the CPU block will kill multithreading",         num.0     );     println!("Start compute...");     // This would "fix" the issue:     // pool.close().await;     loop {} }  /// This doesn't cause the issue async fn http_then_compute() {     le
  **Post-Mortem & Fix Analysis**:
  > I just tested the same example with an SqlitePool, the issue doesn't appear there. So this seems to be related to Postgres.  I also tested this with a Postgres Connection instead of a pool, here the issue occurs again. However, while closing the postgres Pool seems to free other workers again, closing the postgres connection, doesn't fix it.
  > I just replicated this with deadpool-postgres, so this doesn't seem to be an SQLX issue after all. I'm closing the issue again and investigate further.

- **Issue #4362** (2026-09-10): **`migrate!` silently ignores `*.sql` files with no prefix**
  *Symptoms*: ### I have found these related issues/pull requests  I was unable to find any related issues  ### Description  If a migration file has a non-numeric prefix (e.g., `a_schema.sql`), SQLx produces an error. However, if there is no prefix at all (e.g., `schema.sql`), no error is produced, and `migrate!` silently ignores the file. I believe this should either: produce an error (or warning) message like above, for any `*.sql` file that doesn't follow the required format; or, begin supporting no-prefix migrations.   ### Reproduction steps  1. Write a function to create the SQLite database and run migrations, e.g. ```rs let connect_options = SqliteConnectOptions::new()     .filename("foo.db")     .create_if_missing(true);  let pool = SqlitePoolOptions::new()     .connect_with(connect_options)     .await?;  dbg!(sqlx::migrate!("./migrations/")).run(&pool).await?; ``` 2. Create a no-prefix sql file, e.g. `./migrations/schema.sql`. Make it create any sort of table or whatever 3. Run 4. The database file, `foo.db`, will be created and initialized, but it will not contain the new table defined in `schema.sql`. The evaluation of `migrate!` as shown by `dbg!` will have an empty `migrations` field. Additionally, running something like `.tables` in `sqlite3` will only show the `_sqlx_migrations` table. In other words, the `schema.sql` file was ignored, silently.  ### SQLx version  0.9.0  ### Enabled SQLx features  runtime-tokio, sqlite  ### Database server and version  SQLite  ### Operating s

- **Issue #4335** (2026-08-17): **Missing TCP_NODELAY on TCP sockets**
  *Symptoms*: ### I have found these related issues/pull requests  https://github.com/transact-rs/sqlx/pull/3055  ### Description  Hi, after upgrade to sqlx 0.9.0 I've noticed that some queries started executing ~41-43ms when running locally (with sqlx 0.8.2 they used to be ~2ms).  Here's a reproduction example: https://gist.github.com/dmitryvk/c7c5ff1578ae1525d9197bce1ca597a7 (the real code is much more complicated).  40ms delay is caused by Nagle's algorithm, and sqlx previously used to disable it (https://github.com/transact-rs/sqlx/pull/3055), but it was removed recently (https://github.com/transact-rs/sqlx/pull/4022).  ### Reproduction steps  Compile and run code from https://gist.github.com/dmitryvk/c7c5ff1578ae1525d9197bce1ca597a7 against a local MariaDB/MySQL instance.  ### SQLx version  0.9.0  ### Enabled SQLx features  "mysql", "runtime-tokio", "tls-rustls"  ### Database server and version  MariaDB 11.8.5  ### Operating system  Ubuntu 26.04  ### Rust version  rustc 1.97.0 (2d8144b78 2026-07-07)

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

### Incident Patch 1: `8b65c2fb` (2026-10-04)
**Commit Message**: fix(mysql): use the AuthSwitchRequest nonce for the follow-up auth exchange (#4436)

After an AuthSwitchRequest (0xfe) the new nonce was bound with a `let`
inside the match arm, so it only lived for the immediate scramble. On the
next loop iteration `plugin.handle(..)` still received the nonce from the
initial handshake.

For caching_sha2_password this breaks full authentication over a non-TLS
connection: the password is XORed with the stale nonce before the RSA
encryption, and the server rejects it with
`1045 (28000): Access denied for user ... (using password: YES)`.

This happens whenever the server's default_authentication_plugin is
mysql_native_password but the account uses caching_sha2_password (e.g.
Cloud SQL for MySQL 8.0 reached through the local Cloud SQL Auth Proxy),
so the server switches plugins mid-handshake.

Keep a single mutable `nonce` and reassign it on AuthSwitchRequest so
every later step of the plugin uses the nonce the server is verifying
against.

**File**: `sqlx-mysql/src/connection/establish.rs` (modified, +4/-2)
```diff
@@ -63,7 +63,9 @@ impl<'a> DoHandshake<'a> {
         let handshake: Handshake = stream.recv_packet().await?.decode()?;
 
         let mut plugin = handshake.auth_plugin;
-        let nonce = handshake.auth_plugin_data;
+        // `mut`: an AuthSwitchRequest carries a fresh nonce, and the plugin's follow-up
+        // exchange (e.g. caching_sha2_password full authentication) must use it.
+        let mut nonce = handshake.auth_plugin_data;
 
         // FIXME: server version parse is a bit ugly
         // expecting MAJOR.MINOR.PATCH
@@ -130,7 +132,7 @@ impl<'a> DoHandshake<'a> {
                         packet.decode_with(self.options.enable_cleartext_plugin)?;
 
                     plugin = Some(switch.plugin);
-                    let nonce = switch.data.chain(Bytes::new());
+                    nonce = switch.data.chain(Bytes::new());
 
                     let response = switch
                         .plugin
```

---

### Incident Patch 2: `df46b41a` (2026-10-03)
**Commit Message**: fix(macros-core): only track paths rustc can checksum (#4439)

**File**: `sqlx-macros-core/src/query/cache.rs` (modified, +5/-1)
```diff
@@ -69,8 +69,12 @@ impl MtimeCacheBuilder {
     pub fn add_path(&mut self, path: PathBuf) {
         let mtime = get_mtime(&path);
 
+        // Only hand rustc paths it can fingerprint. A directory, or a file that
+        // does not exist, has no content to checksum, and under cargo's
+        // `-Z checksum-freshness` such a dep-info entry leaves the crate
+        // permanently dirty. The mtime check below still covers them.
         #[cfg(any(sqlx_macros_unstable, procmacro2_semver_exempt))]
-        {
+        if path.is_file() {
             proc_macro::tracked::path(&path);
         }
 
```

---

### Incident Patch 3: `aefa4208` (2026-10-03)
**Commit Message**: fix(mysql): decode MySQL 9 VECTOR columns (type 0xf2) (#4441)

**File**: `sqlx-mysql/src/protocol/statement/row.rs` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ impl<'de> ProtocolDecode<'de, &'de [MySqlColumn]> for BinaryRow {
                 | ColumnType::Blob
                 | ColumnType::TinyBlob
                 | ColumnType::Geometry
+                | ColumnType::Vector
                 | ColumnType::Bit
                 | ColumnType::Decimal
                 | ColumnType::Json
```

**File**: `sqlx-mysql/src/protocol/text/column.rs` (modified, +30/-0)
```diff
@@ -83,6 +83,7 @@ pub enum ColumnType {
     Year = 0x0d,
     VarChar = 0x0f,
     Bit = 0x10,
+    Vector = 0xf2,
     Json = 0xf5,
     NewDecimal = 0xf6,
     Enum = 0xf7,
@@ -202,6 +203,7 @@ impl ColumnType {
             ColumnType::Decimal | ColumnType::NewDecimal => "DECIMAL",
             ColumnType::Geometry => "GEOMETRY",
             ColumnType::Json => "JSON",
+            ColumnType::Vector => "VECTOR",
 
             ColumnType::String if is_binary => "BINARY",
             ColumnType::String if is_enum => "ENUM",
@@ -246,6 +248,7 @@ impl ColumnType {
             // [internal] 0x11 => ColumnType::Timestamp2,
             // [internal] 0x12 => ColumnType::Datetime2,
             // [internal] 0x13 => ColumnType::Time2,
+            0xf2 => ColumnType::Vector,
             0xf5 => ColumnType::Json,
             0xf6 => ColumnType::NewDecimal,
             0xf7 => ColumnType::Enum,
@@ -264,3 +267,30 @@ impl ColumnType {
         })
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn decodes_a_mysql_9_vector_column() {
+        // catalog "def", empty schema/table, alias and name "v", then the
+        // fixed-length fields: collation 63 (binary), max size 12, type 0xf2
+        // (VECTOR), flags BINARY, 0 decimals and two filler bytes.
+        let mut packet = vec![3, b'd', b'e', b'f', 0, 0, 0, 1, b'v', 1, b'v', 0x0c];
+        packet.extend_from_slice(&63u16.to_le_bytes());
+        packet.extend_from_slice(&12u32.to_le_bytes());
+        packet.push(0xf2);
+        packet.extend_from_slice(&ColumnFlags::BINARY.bits().to_le_bytes());
+        packet.extend_from_slice(&[0, 0, 0]);
+
+        let column =
+            ColumnDefinition::decode_with(Bytes::from(packet), Capabilities::empty()).unwrap();
+
+        assert_eq!(column.r#type, ColumnType::Vector);
+        assert_eq!(
+            column.r#type.name(column.flags, Some(column.max_size)),
+            "VECTOR"
+        );
+    }
+}
```

**File**: `sqlx-mysql/src/types/bytes.rs` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ impl Type<MySql> for [u8] {
                 | ColumnType::String
                 | ColumnType::VarString
                 | ColumnType::Enum
+                | ColumnType::Vector
         )
     }
 }
```

---

### Incident Patch 4: `9236fb08` (2026-10-03)
**Commit Message**: fix(sqlite): await SQLCipher test connection cleanup before exit (#4442)

**File**: `sqlx-sqlite/src/connection/mod.rs` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ mod worker;
 ///
 /// You can explicitly call [`.close()`][Self::close] to ensure the database is closed successfully
 /// or get an error otherwise.
+///
+/// When using SQLCipher, call [`.close()`][Self::close] and await it before exiting the process.
+/// Otherwise, the worker thread may still be closing the database when SQLCipher frees its global
+/// resources during process exit, which can cause a segmentation fault.
 pub struct SqliteConnection {
     optimize_on_close: OptimizeOnClose,
     pub(crate) worker: ConnectionWorker,
```

**File**: `tests/sqlite/sqlcipher.rs` (modified, +49/-6)
```diff
@@ -1,6 +1,11 @@
 #![cfg(sqlite_test_sqlcipher)]
 
+// Explicitly close every connection before opening the next one or returning from a test.
+// Dropping a connection only signals its worker to stop; its cleanup can otherwise race
+// SQLCipher's process-exit cleanup and cause a segfault.
+
 use std::str::FromStr;
+use std::sync::Arc;
 
 use sqlx::sqlite::SqliteQueryResult;
 use sqlx::{query, Connection, SqliteConnection};
@@ -56,16 +61,19 @@ async fn it_encrypts() -> anyhow::Result<()> {
         .await?;
 
     fill_db(&mut conn).await?;
+    conn.close().await?;
 
     // Create another connection without key, query should fail
     let mut conn = SqliteConnectOptions::from_str(&url)?.connect().await?;
 
-    assert!(conn
+    let result = conn
         .transaction(|tx| {
             Box::pin(async move { query("SELECT * FROM Company;").fetch_all(&mut **tx).await })
         })
-        .await
-        .is_err());
+        .await;
+    conn.close().await?;
+
+    assert!(result.is_err());
 
     Ok(())
 }
@@ -81,6 +89,7 @@ async fn it_can_store_and_read_encrypted_data() -> anyhow::Result<()> {
         .await?;
 
     fill_db(&mut conn).await?;
+    conn.close().await?;
 
     // Create another connection with valid key
     let mut conn = SqliteConnectOptions::from_str(&url)?
@@ -93,6 +102,7 @@ async fn it_can_store_and_read_encrypted_data() -> anyhow::Result<()> {
             Box::pin(async move { query("SELECT * FROM Company;").fetch_all(&mut **tx).await })
         })
         .await?;
+    conn.close().await?;
 
     assert!(result.len() > 0);
 
@@ -110,19 +120,22 @@ async fn it_fails_if_password_is_incorrect() -> anyhow::Result<()> {
         .await?;
 
     fill_db(&mut conn).await?;
+    conn.close().await?;
 
     // Connection with invalid key should not allow to execute queries
     let mut conn = SqliteConnectOptions::from_str(&url)?
         .pragma("key", "BADBADBAD")
         .connect()
         .await?;
 
-    assert!(conn
+    let result = conn
         .transaction(|tx| {
             Box::pin(async move { query("SELECT * FROM Company;").fetch_all(&mut **tx).await })
         })
-        .await
-        .is_err());
+        .await;
+    conn.close().await?;
+
+    assert!(result.is_err());
 
     Ok(())
 }
@@ -148,6 +161,7 @@ async fn it_honors_order_of_encryption_pragmas() -> anyhow::Result<()> {
         .await?;
 
     fill_db(&mut conn).await?;
+    conn.close().await?;
 
     let mut conn = SqliteConnectOptions::from_str(&url)?
         .pragma("dummy", "pragma")
@@ -164,6 +178,7 @@ async fn it_honors_order_of_encryption_pragmas() -> anyhow::Result<()> {
             Box::pin(async move { query("SELECT * FROM COMPANY;").fetch_all(&mut **tx).await })
         })
         .await?;
+    conn.close().await?;
 
     assert!(result.len() > 0);
 
@@ -186,6 +201,7 @@ async fn it_allows_to_rekey_the_db() -> anyhow::Result<()> {
     query("PRAGMA rekey = new_password;")
         .execute(&mut conn)
         .await?;
+    conn.close().await?;
 
     let mut conn = SqliteConnectOptions::from_str(&url)?
         .pragma("dummy", "pragma")
@@ -198,8 +214,35 @@ async fn it_allows_to_rekey_the_db() -> anyhow::Result<()> {
             Box::pin(async move { query("SELECT * FROM COMPANY;").fetch_all(&mut **tx).await })
         })
         .await?;
+    conn.close().await?;
 
     assert!(result.len() > 0);
 
     Ok(())
 }
+
+#[sqlx_macros::test]
+async fn it_closes_the_encrypted_database() -> anyhow::Result<()> {
+    let (url, _dir) = new_db_url().await?;
+    let mut conn = SqliteConnectOptions::from_str(&url)?
+        .pragma("key", "the_password")
+        .create_if_missing(true)
+        .connect()
+        .await?;
+
+    // SQLite destroys collations during sqlite3_close(), so this detects whether
+    // close().await has actually released the database handle.
+    let drop_check = Arc::new(std::cmp::Ordering::Equal);
+    let weak = Arc::downgrade(&drop_check);
+    conn.lock_handle()
+        .await?
+        .create_collation("close_check", move |_, _| *drop_check)?;
+
+    fill_db(&mut conn).await?;
+    assert!(weak.upgrade().is_some());
+
+    conn.close().await?;
+    assert!(weak.upgrade().is_none());
+
+    Ok(())
+}
```

---

### Incident Patch 5: `1be995b7` (2026-09-14)
**Commit Message**: fix(sqlite): don't dereference a NULL declared type in column_nullable (#4374)

* fix(sqlite): don't dereference a NULL declared type in column_nullable

sqlite3_table_column_metadata() leaves its declared-type out-param NULL for a
column declared without a type, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`.
column_nullable() passed that pointer straight to CStr::from_ptr(), so
describing such a column segfaulted the process, and rustc itself, since the
query!() macros describe a live database at expansion time.

A column with no declared type is not declared INTEGER and so cannot be a rowid
alias; treat it as a normal column and fall through to the NOT NULL flag.

Regression introduced in 69ee0df (#4088), released in 0.9.0.

* fix(sqlite): only check the declared type for primary key columns

---------

Co-authored-by: Scott Driggers <[REDACTED_EMAIL]>

**File**: `sqlx-sqlite/src/statement/handle.rs` (modified, +15/-13)
```diff
@@ -263,19 +263,21 @@ impl StatementHandle {
                 return Err(SqliteError::new(self.db_handle()).into());
             }
 
-            let datatype = CStr::from_ptr(datatype);
-
-            Ok(
-                if primary_key != 0
-                    && datatype
-                        .to_bytes()
-                        .eq_ignore_ascii_case("integer".as_bytes())
-                {
-                    None
-                } else {
-                    Some(not_null == 0)
-                },
-            )
+            // `sqlite3_table_column_metadata()` sets the declared type to NULL for a column
+            // declared without one, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`. Such a column
+            // has no type name to compare against, and is by definition not declared
+            // `INTEGER`, so it cannot be a rowid alias.
+            let is_rowid_alias = primary_key != 0
+                && !datatype.is_null()
+                && CStr::from_ptr(datatype)
+                    .to_bytes()
+                    .eq_ignore_ascii_case("integer".as_bytes());
+
+            Ok(if is_rowid_alias {
+                None
+            } else {
+                Some(not_null == 0)
+            })
         }
     }
 
```

**File**: `tests/sqlite/describe.rs` (modified, +34/-1)
```diff
@@ -2,7 +2,7 @@ use sqlx::error::DatabaseError;
 use sqlx::sqlite::{SqliteConnectOptions, SqliteError};
 use sqlx::TypeInfo;
 use sqlx::{sqlite::Sqlite, Column, Executor};
-use sqlx::{ConnectOptions, SqlSafeStr};
+use sqlx::{ConnectOptions, Connection, SqlSafeStr, SqliteConnection};
 use sqlx_test::new;
 use std::env;
 
@@ -1095,3 +1095,36 @@ async fn it_describes_analytical_function() -> anyhow::Result<()> {
 
     Ok(())
 }
+
+// A column declared with no type at all, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`, is
+// legal SQLite. `sqlite3_table_column_metadata()` reports a NULL declared type for such a
+// column, which `column_nullable()` used to dereference unconditionally, segfaulting the
+// process, and thus rustc itself when the `query!()` macros describe a live database.
+#[sqlx_macros::test]
+async fn it_describes_columns_with_no_declared_type() -> anyhow::Result<()> {
+    let mut conn = SqliteConnection::connect(":memory:").await?;
+
+    conn.execute(
+        r#"
+        CREATE TABLE untyped (
+            id PRIMARY KEY,
+            typeless,
+            typed TEXT NOT NULL
+        );
+        "#
+        .into_sql_str(),
+    )
+    .await?;
+
+    let d = conn
+        .describe("SELECT id, typeless, typed FROM untyped".into_sql_str())
+        .await?;
+
+    // A `PRIMARY KEY` with no declared type is not an `INTEGER PRIMARY KEY`, so it is not a
+    // rowid alias and SQLite does permit NULLs in it.
+    assert_eq!(d.nullable(0), Some(true));
+    assert_eq!(d.nullable(1), Some(true));
+    assert_eq!(d.nullable(2), Some(false));
+
+    Ok(())
+}
```

---

### Incident Patch 6: `727c7789` (2026-09-10)
**Commit Message**: fix(postgres): return UnexpectedEof when server closes connection at SSLRequest (#4395) (#4406)

When a remote peer accepts the TCP socket and immediately closes it
without responding to the 8-byte SSLRequest message, socket.read()
returns 0 (EOF). Because the read byte count was discarded, the unwritten
initial [0u8] buffer was matched against, reporting a fabricated
Protocol("unexpected response from SSLRequest: 0x00") error.

Check the returned read length and return an io::ErrorKind::UnexpectedEof
error when 0 bytes are read, correctly identifying connection closure
during the SSLRequest handshake, while preserving Protocol error reporting
if the server actually transmits a wire 0x00 byte.

Co-authored-by: zfaustk <[REDACTED_EMAIL]>

**File**: `sqlx-postgres/src/connection/tls.rs` (modified, +136/-1)
```diff
@@ -1,3 +1,5 @@
+use std::io;
+
 use crate::error::Error;
 use crate::net::tls::{self, TlsConfig};
 use crate::net::{Socket, SocketIntoBox, WithSocket};
@@ -88,7 +90,10 @@ async fn request_upgrade(
 
     let mut response = [0u8];
 
-    socket.read(&mut &mut response[..]).await?;
+    let n = socket.read(&mut &mut response[..]).await?;
+    if n == 0 {
+        return Err(io::Error::from(io::ErrorKind::UnexpectedEof).into());
+    }
 
     match response[0] {
         b'S' => {
@@ -107,3 +112,133 @@ async fn request_upgrade(
         )),
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use sqlx_core::io::ReadBuf;
+    use std::io;
+    use std::pin::pin;
+    use std::task::{Context, Poll, Waker};
+
+    struct MockSocket {
+        read_byte: Option<u8>,
+    }
+
+    impl Socket for MockSocket {
+        fn try_read(&mut self, buf: &mut dyn ReadBuf) -> io::Result<usize> {
+            match self.read_byte {
+                Some(b) => {
+                    buf.put_slice(&[b]);
+                    Ok(1)
+                }
+                None => Ok(0), // EOF
+            }
+        }
+
+        fn try_write(&mut self, buf: &[u8]) -> io::Result<usize> {
+            Ok(buf.len())
+        }
+
+        fn poll_read_ready(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+
+        fn poll_write_ready(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+
+        fn poll_shutdown(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+    }
+
+    /// Polls a future that is guaranteed to complete immediately on its first poll.
+    ///
+    /// This safe test runner uses `Waker::noop()` and `std::pin::pin!` without needing
+    /// a full runtime or unsafe waker implementations.
+    fn poll_immediate<F: std::future::Future>(fut: F) -> F::Output {
+        let mut fut = pin!(fut);
+        let mut cx = Context::from_waker(Waker::noop());
+        match fut.as_mut().poll(&mut cx) {
+            Poll::Ready(val) => val,
+            Poll::Pending => panic!("test future was pending unexpectedly"),
+        }
+    }
+
+    #[test]
+    fn test_request_upgrade_eof() {
+        poll_immediate(async {
+            let mut socket = MockSocket { read_byte: None };
+            let options = PgConnectOptions::new();
+            let err = request_upgrade(&mut socket, &options).await.unwrap_err();
+
+            match err {
+                Error::Io(io_err) => {
+                    assert_eq!(io_err.kind(), io::ErrorKind::UnexpectedEof);
+                }
+                other => panic!("expected Error::Io(UnexpectedEof), but got: {:?}", other),
+            }
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_wire_null_byte() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(0x00),
+            };
+            let options = PgConnectOptions::new();
+            let err = request_upgrade(&mut socket, &options).await.unwrap_err();
+
+            match err {
+                Error::Protocol(msg) => {
+                    assert!(msg.contains("unexpected response from SSLRequest: 0x00"));
+                }
+                other => panic!("expected Error::Protocol, but got: {:?}", other),
+            }
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_supported() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(b'S'),
+            };
+            let options = PgConnectOptions::new();
+            let res = request_upgrade(&mut socket, &options).await.unwrap();
+            assert!(res);
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_unsupported() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(b'N'),
+            };
+            let options = PgConnectOptions::new();
+            let res = request_upgrade(&mut socket, &options).await.unwrap();
+            assert!(!res);
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_unexpected_byte() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(0x42),
+            };
+            let options = PgConnectOptions::new();
+            let err = request_upgrade(&mut socket, &options).await.unwrap_err();
+
+            match err {
+                Error::Protocol(msg) => {
+                    assert!(msg.contains("unexpected response from SSLRequest: 0x42"));
+                }
+                other => panic!("expected Error::Protocol, but got: {:?}", other),
+            }
+        });
+    }
+}
```

---

### Incident Patch 7: `5d3787ef` (2026-09-10)
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

### Incident Patch 8: `f1e94ec3` (2026-09-09)
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

---

### Incident Patch 9: `4fc0fb82` (2026-08-19)
**Commit Message**: fix(sqlite): correct sub-second decoding of pre-epoch REAL datetimes (#4340)

Datetimes stored as a REAL Julian day number (e.g. via SQLite's
julianday()) were decoded by splitting the UNIX timestamp with
trunc()/fract().abs(). timestamp_opt() always adds the nanoseconds
forward in time, so for values before 1970 this pushed the result up to
~2 seconds off and could move it onto the wrong side of the epoch
(e.g. 1969-12-31 23:59:59.5 decoded as 1970-01-01 00:00:00.5).

Round seconds toward negative infinity with floor() and take the
sub-second remainder relative to that, so nanos is always a valid
forward offset. Post-epoch values are unaffected. Adds unit tests for
the pre- and post-epoch paths.

**File**: `sqlx-sqlite/src/types/chrono.rs` (modified, +64/-4)
```diff
@@ -176,10 +176,16 @@ fn decode_datetime_from_float(value: f64) -> Option<DateTime<FixedOffset>> {
     // We checked above if the value is infinite or NaN which could otherwise cause problems
     #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
     {
-        let seconds = timestamp.trunc() as i64;
-        let nanos = (timestamp.fract() * 1E9).abs() as u32;
-
-        Utc.fix().timestamp_opt(seconds, nanos).single()
+        // Split into whole seconds and a non-negative sub-second remainder.
+        // `timestamp_opt` always adds `nanos` *forward* in time, so we must round
+        // `seconds` toward negative infinity (not toward zero) and take the
+        // fraction relative to that. Using `trunc()`/`fract().abs()` here would
+        // push pre-epoch timestamps up to ~2 seconds off (and onto the wrong side
+        // of the epoch), since the fractional part is negative below zero.
+        let seconds = timestamp.floor();
+        let nanos = ((timestamp - seconds) * 1E9) as u32;
+
+        Utc.fix().timestamp_opt(seconds as i64, nanos).single()
     }
 }
 
@@ -218,3 +224,57 @@ impl<'r> Decode<'r, Sqlite> for NaiveTime {
         Err(format!("invalid time: {value}").into())
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::decode_datetime_from_float;
+    use chrono::{Offset, TimeZone, Utc};
+
+    // SQLite may store a datetime as a REAL holding a Julian day number, e.g. the
+    // result of `julianday(...)`. This mirrors that conversion so a test can feed
+    // `decode_datetime_from_float` the value for a known instant.
+    fn julian_day(unix_seconds: f64) -> f64 {
+        2_440_587.5 + unix_seconds / 86_400.0
+    }
+
+    // Assert that the Julian day for `unix_seconds + subsec_nanos` decodes back to
+    // that same instant. The tolerance only absorbs f64 round-off in the
+    // round-trip (tens of microseconds), well below the errors under test.
+    #[track_caller]
+    fn assert_decodes_near(unix_seconds: i64, subsec_nanos: u32) {
+        let input = julian_day(unix_seconds as f64 + f64::from(subsec_nanos) / 1e9);
+        let decoded = decode_datetime_from_float(input).expect("valid Julian day should decode");
+        let expected = Utc
+            .fix()
+            .timestamp_opt(unix_seconds, subsec_nanos)
+            .single()
+            .unwrap();
+
+        let diff_us = (decoded - expected)
+            .num_microseconds()
+            .expect("difference fits in microseconds")
+            .abs();
+        assert!(
+            diff_us < 1_000,
+            "decoded {decoded} differs from expected {expected} by {diff_us} us",
+        );
+    }
+
+    // A Julian day landing before the UNIX epoch must keep its sub-second part in
+    // the correct direction. Before the fix these decoded up to ~2 seconds off,
+    // and could even cross to the wrong side of the epoch.
+    #[test]
+    fn decodes_pre_epoch_float_datetime() {
+        // 1969-12-31 23:59:59.500 UTC
+        assert_decodes_near(-1, 500_000_000);
+        // 1969-12-31 23:59:58.750 UTC
+        assert_decodes_near(-2, 750_000_000);
+    }
+
+    // Post-epoch values were already correct; guard against a regression.
+    #[test]
+    fn decodes_post_epoch_float_datetime() {
+        // 1970-01-01 00:00:01.500 UTC
+        assert_decodes_near(1, 500_000_000);
+    }
+}
```

---

### Incident Patch 10: `80f44db8` (2026-08-19)
**Commit Message**: Fix Any type/close handling, MySQL time signs, SQLite plans, and macro docs (#4359)

**File**: `sqlx-core/src/any/arguments.rs` (modified, +2/-2)
```diff
@@ -67,8 +67,8 @@ impl AnyArguments {
                 AnyValueKind::Null(AnyTypeInfoKind::SmallInt) => out.add(Option::<i16>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Integer) => out.add(Option::<i32>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::BigInt) => out.add(Option::<i64>::None),
-                AnyValueKind::Null(AnyTypeInfoKind::Real) => out.add(Option::<f64>::None),
-                AnyValueKind::Null(AnyTypeInfoKind::Double) => out.add(Option::<f32>::None),
+                AnyValueKind::Null(AnyTypeInfoKind::Real) => out.add(Option::<f32>::None),
+                AnyValueKind::Null(AnyTypeInfoKind::Double) => out.add(Option::<f64>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Text) => out.add(Option::<String>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Blob) => out.add(Option::<Vec<u8>>::None),
                 AnyValueKind::Bool(b) => out.add(b),
```

**File**: `sqlx-core/src/any/connection/mod.rs` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ impl Connection for AnyConnection {
     }
 
     fn close_hard(self) -> impl Future<Output = Result<(), Error>> + Send + 'static {
-        self.backend.close()
+        self.backend.close_hard()
     }
 
     fn ping(&mut self) -> impl Future<Output = Result<(), Error>> + Send + '_ {
```

**File**: `sqlx-macros-core/src/query/metadata.rs` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ fn load_env(
     }))
 }
 
-/// Returns `true` if `val` is `"true"`,
+/// Returns `true` if `val` is `"true"` (case-insensitive) or `"1"`.
 fn is_truthy_bool(val: &str) -> bool {
     val.eq_ignore_ascii_case("true") || val == "1"
 }
```

**File**: `sqlx-mysql/src/types/mysql_time.rs` (modified, +8/-1)
```diff
@@ -213,7 +213,7 @@ impl MySqlTime {
 
     /// Returns `true` if `self` is negative, `false` if positive or zero.
     pub fn is_negative(&self) -> bool {
-        self.sign.is_positive()
+        self.sign.is_negative()
     }
 
     /// Returns `true` if this interval is a valid time-of-day.
@@ -691,6 +691,13 @@ mod tests {
         assert_eq!(format!("{negative:.9}"), "-123:45:56.890011000");
     }
 
+    #[test]
+    fn test_is_negative() {
+        assert!(!MySqlTime::ZERO.is_negative());
+        assert!(!MySqlTime::MAX.is_negative());
+        assert!(MySqlTime::MIN.is_negative());
+    }
+
     #[test]
     fn test_parse_microseconds() {
         assert_eq!(parse_microseconds("010").unwrap(), 10_000);
```

**File**: `sqlx-sqlite/src/logger.rs` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ impl<R: Debug, S: Debug + DebugDiff, P: Debug> core::fmt::Display for QueryPlanL
         let max_branch_id: i64 = [
             self.branch_operations.last_index().unwrap_or(0),
             self.branch_results.last_index().unwrap_or(0),
-            self.branch_results.last_index().unwrap_or(0),
+            self.branch_origins.last_index().unwrap_or(0),
         ]
         .into_iter()
         .max()
```

---

### Incident Patch 11: `ebc408a4` (2026-08-19)
**Commit Message**: bugfix: streamline and fix AnyQueryResult::last_insert_id() for SQLite (#4205)

* fix: make MySqlQueryResult -> AnyQueryResult conversion more consistent & robust

- replaced custom map_result function with From<T> implementation

* fix: unify PgQueryResult -> AnyQueryResult conversion code path

- replaced custom map_result function with From<T> implementation

* fix: make SqliteQueryResult -> AnyQueryResult conversion respect last_insert_rowid

- replaced custom map_result function with From<T> implementation
- fixed bug causing AnyQueryResult.last_insert_id to always be None for Sqlite backend

* test(sqlite): add any_sets_last_insert_id

- added test
- updated required-features

* test(mysql): add any_sets_last_insert_id

- added test
- updated required-features

* test(postgres): add any_sets_last_insert_id

- added test
- updated required-features

* fix(tests): use different syntax to address compiler errors

* fix(test/postgres): slightly change bind syntax as required for this backend

**File**: `Cargo.toml` (modified, +11/-1)
```diff
@@ -313,7 +313,7 @@ required-features = ["sqlite"]
 [[test]]
 name = "sqlite-any"
 path = "tests/sqlite/any.rs"
-required-features = ["sqlite"]
+required-features = ["sqlite", "any"]
 
 [[test]]
 name = "sqlite-types"
@@ -415,6 +415,11 @@ name = "mysql-rustsec"
 path = "tests/mysql/rustsec.rs"
 required-features = ["mysql"]
 
+[[test]]
+name = "mysql-any"
+path = "tests/mysql/any.rs"
+required-features = ["mysql", "any"]
+
 #
 # PostgreSQL
 #
@@ -468,3 +473,8 @@ required-features = ["postgres"]
 name = "postgres-rustsec"
 path = "tests/postgres/rustsec.rs"
 required-features = ["postgres", "macros", "migrate"]
+
+[[test]]
+name = "postgres-any"
+path = "tests/postgres/any.rs"
+required-features = ["postgres", "any"]
```

**File**: `sqlx-mysql/src/any.rs` (modified, +8/-7)
```diff
@@ -96,7 +96,7 @@ impl AnyConnectionBackend for MySqlConnection {
                 .try_flatten_stream()
                 .map(|res| {
                     Ok(match res? {
-                        Either::Left(result) => Either::Left(map_result(result)),
+                        Either::Left(result) => Either::Left(result.into()),
                         Either::Right(row) => Either::Right(AnyRow::try_from(&row)?),
                     })
                 }),
@@ -210,11 +210,12 @@ impl<'a> TryFrom<&'a AnyConnectOptions> for MySqlConnectOptions {
     }
 }
 
-fn map_result(result: MySqlQueryResult) -> AnyQueryResult {
-    AnyQueryResult {
-        rows_affected: result.rows_affected,
-        // Don't expect this to be a problem
-        #[allow(clippy::cast_possible_wrap)]
-        last_insert_id: Some(result.last_insert_id as i64),
+/// This conversion attempts to save last_insert_id by converting to i64.
+impl From<MySqlQueryResult> for AnyQueryResult {
+    fn from(done: MySqlQueryResult) -> Self {
+        AnyQueryResult {
+            rows_affected: done.rows_affected(),
+            last_insert_id: done.last_insert_id().try_into().ok(),
+        }
     }
 }
```

**File**: `sqlx-mysql/src/query_result.rs` (modified, +0/-10)
```diff
@@ -24,13 +24,3 @@ impl Extend<MySqlQueryResult> for MySqlQueryResult {
         }
     }
 }
-#[cfg(feature = "any")]
-/// This conversion attempts to save last_insert_id by converting to i64.
-impl From<MySqlQueryResult> for sqlx_core::any::AnyQueryResult {
-    fn from(done: MySqlQueryResult) -> Self {
-        sqlx_core::any::AnyQueryResult {
-            rows_affected: done.rows_affected(),
-            last_insert_id: done.last_insert_id().try_into().ok(),
-        }
-    }
-}
```

**File**: `sqlx-postgres/src/any.rs` (modified, +7/-5)
```diff
@@ -97,7 +97,7 @@ impl AnyConnectionBackend for PgConnection {
                 .try_flatten_stream()
                 .map(
                     move |res: sqlx_core::Result<Either<PgQueryResult, PgRow>>| match res? {
-                        Either::Left(result) => Ok(Either::Left(map_result(result))),
+                        Either::Left(result) => Ok(Either::Left(result.into())),
                         Either::Right(row) => Ok(Either::Right(AnyRow::try_from(&row)?)),
                     },
                 ),
@@ -246,9 +246,11 @@ impl<'a> TryFrom<&'a AnyConnectOptions> for PgConnectOptions {
     }
 }
 
-fn map_result(res: PgQueryResult) -> AnyQueryResult {
-    AnyQueryResult {
-        rows_affected: res.rows_affected(),
-        last_insert_id: None,
+impl From<PgQueryResult> for AnyQueryResult {
+    fn from(done: PgQueryResult) -> Self {
+        AnyQueryResult {
+            rows_affected: done.rows_affected(),
+            last_insert_id: None,
+        }
     }
 }
```

**File**: `sqlx-postgres/src/query_result.rs` (modified, +0/-10)
```diff
@@ -18,13 +18,3 @@ impl Extend<PgQueryResult> for PgQueryResult {
         }
     }
 }
-
-#[cfg(feature = "any")]
-impl From<PgQueryResult> for sqlx_core::any::AnyQueryResult {
-    fn from(done: PgQueryResult) -> Self {
-        sqlx_core::any::AnyQueryResult {
-            rows_affected: done.rows_affected,
-            last_insert_id: None,
-        }
-    }
-}
```

**File**: `sqlx-sqlite/src/any.rs` (modified, +12/-5)
```diff
@@ -95,7 +95,7 @@ impl AnyConnectionBackend for SqliteConnection {
                 .try_flatten_stream()
                 .map(
                     move |res: sqlx_core::Result<Either<SqliteQueryResult, SqliteRow>>| match res? {
-                        Either::Left(result) => Ok(Either::Left(map_result(result))),
+                        Either::Left(result) => Ok(Either::Left(result.into())),
                         Either::Right(row) => Ok(Either::Right(AnyRow::try_from(&row)?)),
                     },
                 ),
@@ -234,9 +234,16 @@ fn map_arguments(args: AnyArguments) -> SqliteArguments {
     }
 }
 
-fn map_result(res: SqliteQueryResult) -> AnyQueryResult {
-    AnyQueryResult {
-        rows_affected: res.rows_affected(),
-        last_insert_id: None,
+impl From<SqliteQueryResult> for AnyQueryResult {
+    fn from(done: SqliteQueryResult) -> Self {
+        // logic as per: https://www.sqlite.org/c3ref/last_insert_rowid.html
+        let last_insert_id = match done.last_insert_rowid() {
+            0 => None,
+            n => Some(n),
+        };
+        AnyQueryResult {
+            rows_affected: done.rows_affected(),
+            last_insert_id,
+        }
     }
 }
```

**File**: `sqlx-sqlite/src/query_result.rs` (modified, +0/-14)
```diff
@@ -24,17 +24,3 @@ impl Extend<SqliteQueryResult> for SqliteQueryResult {
         }
     }
 }
-
-#[cfg(feature = "any")]
-impl From<SqliteQueryResult> for sqlx_core::any::AnyQueryResult {
-    fn from(done: SqliteQueryResult) -> Self {
-        let last_insert_id = match done.last_insert_rowid() {
-            0 => None,
-            n => Some(n),
-        };
-        sqlx_core::any::AnyQueryResult {
-            rows_affected: done.rows_affected(),
-            last_insert_id,
-        }
-    }
-}
```

**File**: `tests/mysql/any.rs` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+use sqlx::Any;
+use sqlx_test::new;
+
+/// ensure Any type with MySQL backing returns last_insert_id properly
+/// https://github.com/launchbadge/sqlx/issues/2982
+#[sqlx_macros::test]
+async fn any_sets_last_insert_id() -> anyhow::Result<()> {
+    sqlx::any::install_default_drivers();
+
+    let mut conn = new::<Any>().await?;
+    // syntax as per: https://dev.mysql.com/doc/refman/9.6/en/example-auto-increment.html
+    let _ = sqlx::query(
+        "CREATE TEMPORARY TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL)",
+    )
+    .execute(&mut conn)
+    .await?;
+
+    let result = sqlx::query("INSERT INTO users (name) VALUES (?)")
+        .bind("Glorbo")
+        .execute(&mut conn)
+        .await?;
+
+    assert_eq!(result.last_insert_id(), Some(1));
+
+    Ok(())
+}
```

---

### Incident Patch 12: `218ff5f5` (2026-08-18)
**Commit Message**: docs(macros): document that bind parameter nullability is not compile-checked (#4345)

Restructures the "Nullability: Bind Parameters" section of the query!
macro documentation to state upfront that the nullability of bind
parameters is not verified at compile time, why (SQLx does not parse
SQL), and give the concrete example from #2642.

The previous phrasing understated the limitation and hid it behind
guidance about WHERE clauses, which is now demoted to a sub-section.

Closes #2642

**File**: `src/macros/mod.rs` (modified, +29/-5)
```diff
@@ -130,18 +130,42 @@
 /// * MySQL/SQLite: `?` which matches arguments in order that it appears in the query
 ///
 /// ## Nullability: Bind Parameters
-/// For a given expected type `T`, both `T` and `Option<T>` are allowed (as well as either
-/// behind references). `Option::None` will be bound as `NULL`, so if binding a type behind `Option`
-/// be sure your query can support it.
+/// **The nullability of bind parameters is _not_ verified at compile time.** Unlike output
+/// columns (see the [next section](#nullability-output-columns)), the `query!()` family of
+/// macros does not check whether an `Option<T>` bound to a parameter is compatible with the
+/// nullability of the target column. This is a fundamental limitation, not an oversight:
+/// determining which parameter maps to which column would require the macros to parse and
+/// analyze the SQL themselves, which SQLx explicitly does not do
+/// (see [the FAQ][faq-parse-sql] for the reasoning).
+///
+/// For any bind parameter, both `T` and `Option<T>` are accepted (as well as either behind
+/// references). `Option::None` is bound as SQL `NULL`. If the target column has a `NOT NULL`
+/// constraint, binding `None` will compile successfully but fail **at runtime** with a
+/// database error, for example:
 ///
-/// Note, however, if binding in a `where` clause, that equality comparisons with `NULL` may not
-/// work as expected; instead you must use `IS NOT NULL` or `IS NULL` to check if a column is not
+/// ```rust,ignore
+/// // Schema: `CREATE TABLE foo (data TEXT NOT NULL);`
+/// // Compiles fine, fails at runtime:
+/// sqlx::query!("INSERT INTO foo (data) VALUES ($1)", None::<String>)
+///     .execute(&pool)
+///     .await?;
+/// ```
+///
+/// If you need this kind of safety, encode the constraint in your Rust types (e.g. use `String`
+/// instead of `Option<String>` for the field that feeds the bind parameter) or cover the
+/// invariant with an integration test against a real database.
+///
+/// ### Bind parameters in `WHERE` clauses
+/// If binding in a `WHERE` clause, note that equality comparisons with `NULL` may not work
+/// as expected; instead you must use `IS NOT NULL` or `IS NULL` to check if a column is not
 /// null or is null, respectively.
 ///
 /// In Postgres and MySQL you may also use `IS [NOT] DISTINCT FROM` to compare with a possibly
 /// `NULL` value. In MySQL `IS NOT DISTINCT FROM` can be shortened to `<=>`.
 /// In SQLite you can use `IS` or `IS NOT`. Note that operator precedence may be different.
 ///
+/// [faq-parse-sql]: https://github.com/transact-rs/sqlx/blob/main/FAQ.md#why-cant-sqlx-just-look-at-my-database-schemamigrations-and-parse-the-sql-itself
+///
 /// ## Nullability: Output Columns
 /// In most cases, the database engine can tell us whether or not a column may be `NULL`, and
 /// the `query!()` macro adjusts the field types of the returned struct accordingly.
```

---

### Incident Patch 13: `56fbf870` (2026-08-17)
**Commit Message**: Fix PostgreSQL memory leak when statement cache is disabled (#4337)

* fix(postgres): check if statement caching is enabled before assigning an id

* test(postgres): add regression test for #4328

**File**: `sqlx-postgres/src/connection/executor.rs` (modified, +3/-1)
```diff
@@ -28,7 +28,9 @@ async fn prepare(
     persistent: bool,
     resolve_column_origin: bool,
 ) -> Result<(StatementId, Arc<PgStatementMetadata>), Error> {
-    let id = if persistent {
+    // if cache is disabled, persistent statements get an id but are never evicted
+    // which causes a memory leak
+    let id = if persistent && conn.inner.cache_statement.is_enabled() {
         let id = conn.inner.next_statement_id;
         conn.inner.next_statement_id = id.next();
         id
```

**File**: `tests/postgres/postgres.rs` (modified, +26/-0)
```diff
@@ -845,6 +845,32 @@ async fn it_closes_statements_when_not_persistent_issue_3850() -> anyhow::Result
     Ok(())
 }
 
+#[sqlx_macros::test]
+async fn it_closes_statements_when_caching_is_disabled_issue_4328() -> anyhow::Result<()> {
+    sqlx_test::setup_if_needed();
+
+    let mut options: PgConnectOptions = env::var("DATABASE_URL")?.parse().unwrap();
+
+    options = options.statement_cache_capacity(0);
+
+    let mut conn = PgConnection::connect_with(&options).await?;
+
+    let _row = sqlx::query("SELECT $1 AS val")
+        .bind(Oid(1))
+        .fetch_one(&mut conn)
+        .await?;
+
+    let row = sqlx::query("SELECT count(*) AS num_prepared_statements FROM pg_prepared_statements")
+        .persistent(false)
+        .fetch_one(&mut conn)
+        .await?;
+
+    let n: i64 = row.get("num_prepared_statements");
+    assert_eq!(0, n, "no prepared statements should be open");
+
+    Ok(())
+}
+
 #[sqlx_macros::test]
 async fn it_sets_application_name() -> anyhow::Result<()> {
     sqlx_test::setup_if_needed();
```

---

### Incident Patch 14: `4893f831` (2026-06-30)
**Commit Message**: fix(sqlite): migrate datetime format builders off time 0.3.48-depreca… (#4317)

* fix(sqlite): migrate datetime format builders off time 0.3.48-deprecated API

* ci: re-trigger checks

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@ ipnet = "2.3.0"
 ipnetwork = "0.21.1"
 mac_address = "1.1.5"
 rust_decimal = { version = "1.36.0", default-features = false, features = ["std"] }
-time = { version = "0.3.47", features = ["formatting", "parsing", "macros"] }
+time = { version = "0.3.48", features = ["formatting", "parsing", "macros"] }
 uuid = "1.12.1"
 
 # Common utility crates
```

**File**: `examples/postgres/axum-social-with-tests/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ rand = "0.10.1"
 regex = "1.6.0"
 serde = "1.0.219"
 serde_with = { version = "3.18.0", features = ["time_0_3"] }
-time = "0.3.47"
+time = "0.3.48"
 uuid = { version = "1.12.1", features = ["serde"] }
 validator = { version = "0.20.0", features = ["derive"] }
 
```

**File**: `examples/postgres/multi-database/accounts/Cargo.toml` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ uuid = { version = "1.12.1", features = ["serde"] }
 thiserror = "2.0.18"
 rand = "0.10.1"
 
-time = { version = "0.3.47", features = ["serde"] }
+time = { version = "0.3.48", features = ["serde"] }
 
 serde = { version = "1.0.219", features = ["derive"] }
 
```

**File**: `examples/postgres/multi-database/payments/Cargo.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ sqlx = { workspace = true, features = ["postgres", "time", "uuid", "rust_decimal
 
 rust_decimal = "1.36.0"
 
-time = "0.3.47"
+time = "0.3.48"
 uuid = "1.12.1"
 
 [dependencies.accounts]
```

**File**: `examples/postgres/multi-tenant/accounts/Cargo.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ uuid = { version = "1.12.1", features = ["serde"] }
 thiserror = "2.0.18"
 rand = "0.10.1"
 
-time = { version = "0.3.47", features = ["serde"] }
+time = { version = "0.3.48", features = ["serde"] }
 
 serde = { version = "1.0.219", features = ["derive"] }
 
```

**File**: `examples/postgres/multi-tenant/payments/Cargo.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ edition = "2021"
 
 rust_decimal = "1.36.0"
 
-time = "0.3.47"
+time = "0.3.48"
 uuid = "1.12.1"
 
 [dependencies.sqlx]
```

**File**: `examples/postgres/preferred-crates/uses-time/Cargo.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ authors.workspace = true
 
 [dependencies]
 serde = "1.0.219"
-time = "0.3.47"
+time = "0.3.48"
 uuid = "1.12.1"
 
 [dependencies.sqlx]
```

**File**: `sqlx-sqlite/src/types/time.rs` (modified, +12/-129)
```diff
@@ -145,7 +145,12 @@ fn decode_offset_datetime_from_text(value: &str) -> Option<OffsetDateTime> {
         return Some(dt);
     }
 
-    if let Ok(dt) = OffsetDateTime::parse(value, formats::OFFSET_DATE_TIME) {
+    if let Ok(dt) = OffsetDateTime::parse(
+        value,
+        &fd!(
+            "[year]-[month]-[day][optional [ ]][optional [T]][hour]:[minute][optional [:[second]]][optional [.[subsecond]]][optional [[offset_hour]]][optional [:[offset_minute]]]"
+        ),
+    ) {
         return Some(dt);
     }
 
@@ -181,8 +186,12 @@ fn decode_datetime_from_text(value: &str) -> Option<PrimitiveDateTime> {
     }
 
     let formats = [
-        BorrowedFormatItem::Compound(formats::PRIMITIVE_DATE_TIME_SPACE_SEPARATED),
-        BorrowedFormatItem::Compound(formats::PRIMITIVE_DATE_TIME_T_SEPARATED),
+        BorrowedFormatItem::Compound(fd!(
+            "[year]-[month]-[day] [hour]:[minute][optional [:[second]]][optional [.[subsecond]]][optional [Z]]"
+        )),
+        BorrowedFormatItem::Compound(fd!(
+            "[year]-[month]-[day]T[hour]:[minute][optional [:[second]]][optional [.[subsecond]]][optional [Z]]"
+        )),
     ];
 
     if let Ok(dt) = PrimitiveDateTime::parse(value, &BorrowedFormatItem::First(&formats)) {
@@ -191,129 +200,3 @@ fn decode_datetime_from_text(value: &str) -> Option<PrimitiveDateTime> {
 
     None
 }
-
-mod formats {
-    use time::format_description::BorrowedFormatItem::{Component, Literal, Optional};
-    use time::format_description::{modifier, BorrowedFormatItem, Component::*};
-
-    const YEAR: BorrowedFormatItem<'_> = Component(Year({
-        let mut value = modifier::Year::default();
-        value.padding = modifier::Padding::Zero;
-        value.repr = modifier::YearRepr::Full;
-        value.iso_week_based = false;
-        value.sign_is_mandatory = false;
-        value
-    }));
-
-    const MONTH: BorrowedFormatItem<'_> = Component(Month({
-        let mut value = modifier::Month::default();
-        value.padding = modifier::Padding::Zero;
-        value.repr = modifier::MonthRepr::Numerical;
-        value.case_sensitive = true;
-        value
-    }));
-
-    const DAY: BorrowedFormatItem<'_> = Component(Day({
-        let mut value = modifier::Day::default();
-        value.padding = modifier::Padding::Zero;
-        value
-    }));
-
-    const HOUR: BorrowedFormatItem<'_> = Component(Hour({
-        let mut value = modifier::Hour::default();
-        value.padding = modifier::Padding::Zero;
-        value.is_12_hour_clock = false;
-        value
-    }));
-
-    const MINUTE: BorrowedFormatItem<'_> = Component(Minute({
-        let mut value = modifier::Minute::default();
-        value.padding = modifier::Padding::Zero;
-        value
-    }));
-
-    const SECOND: BorrowedFormatItem<'_> = Component(Second({
-        let mut value = modifier::Second::default();
-        value.padding = modifier::Padding::Zero;
-        value
-    }));
-
-    const SUBSECOND: BorrowedFormatItem<'_> = Component(Subsecond({
-        let mut value = modifier::Subsecond::default();
-        value.digits = modifier::SubsecondDigits::OneOrMore;
-        value
-    }));
-
-    const OFFSET_HOUR: BorrowedFormatItem<'_> = Component(OffsetHour({
-        let mut value = modifier::OffsetHour::default();
-        value.sign_is_mandatory = true;
-        value.padding = modifier::Padding::Zero;
-        value
-    }));
-
-    const OFFSET_MINUTE: BorrowedFormatItem<'_> = Component(OffsetMinute({
-        let mut value = modifier::OffsetMinute::default();
-        value.padding = modifier::Padding::Zero;
-        value
-    }));
-
-    pub(super) const OFFSET_DATE_TIME: &[BorrowedFormatItem<'_>] = {
-        &[
-            YEAR,
-            Literal(b"-"),
-            MONTH,
-            Literal(b"-"),
-            DAY,
-            Optional(&Literal(b" ")),
-            Optional(&Literal(b"T")),
-            HOUR,
-            Literal(b":"),
-            MINUTE,
-            Optional(&Literal(b":")),
-            Optional(&SECOND),
-            Optional(&Literal(b".")),
-            Optional(&SUBSECOND),
-            Optional(&OFFSET_HOUR),
-            Optional(&Literal(b":")),
-            Optional(&OFFSET_MINUTE),
-        ]
-    };
-
-    pub(super) const PRIMITIVE_DATE_TIME_SPACE_SEPARATED: &[BorrowedFormatItem<'_>] = {
-        &[
-            YEAR,
-            Literal(b"-"),
-            MONTH,
-            Literal(b"-"),
-            DAY,
-            Literal(b" "),
-            HOUR,
-            Literal(b":"),
-            MINUTE,
-            Optional(&Literal(b":")),
-            Optional(&SECOND),
-            Optional(&Literal(b".")),
-            Optional(&SUBSECOND),
-            Optional(&Literal(b"Z")),
-        ]
-    };
-
-    pub(super) const PRIMITIVE_DATE_TIME_T_SEPARATED: &[BorrowedFormatItem<'_>] = {
-        &[
-            YEAR,
-            Literal(b"-"),
-            MONTH,
-            Literal(b"-"),
-            DAY,
-            Literal(b"
```

---

### Incident Patch 15: `f8afe99d` (2026-06-10)
**Commit Message**: fix: whoami regression to anonymous user (#4303)

**File**: `.github/workflows/sqlx.yml` (modified, +16/-0)
```diff
@@ -301,6 +301,22 @@ jobs:
           SQLX_OFFLINE_DIR: .sqlx
           RUSTFLAGS: -D warnings --cfg postgres="${{ matrix.postgres }}"
 
+      # Run tests again with implied linux user
+      - run: |
+          SKIP_ARGS=()
+          for test in $PG_ISOLATED_TESTS; do
+            SKIP_ARGS+=(--skip "$test")
+          done
+          cargo test \
+            --no-default-features \
+            --features any,postgres,macros,migrate,_unstable-all-types,runtime-${{ matrix.runtime }},tls-${{ matrix.tls }} \
+            -- \
+            "${SKIP_ARGS[@]}"
+        env:
+          DATABASE_URL: postgres:///sqlx?password=runner-password
+          SQLX_OFFLINE_DIR: .sqlx
+          RUSTFLAGS: -D warnings --cfg postgres="${{ matrix.postgres }}"
+
       # Run the `test-attr` test again to cover cleanup.
       - run: >
           cargo test
```

**File**: `sqlx-postgres/Cargo.toml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ num-bigint = { version = "0.4.3", optional = true }
 smallvec = { version = "1.13.1" }
 stringprep = "0.1.2"
 tracing = { version = "0.1.37", features = ["log"] }
-whoami = { version = "2.0.2", default-features = false }
+whoami = { version = "2.0.2", features = ["std"], default-features = false }
 
 dotenvy.workspace = true
 thiserror.workspace = true
```

**File**: `tests/postgres/setup.sql` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+-- Create extra user to be used on runner
+CREATE USER runner WITH SUPERUSER PASSWORD 'runner-password';
+
 -- https://www.postgresql.org/docs/current/ltree.html
 CREATE EXTENSION IF NOT EXISTS ltree;
 
```

#### Recent Merged Pull Requests:
- **PR #4442** (2026-10-03): fix(sqlite): await SQLCipher test connection cleanup before exit (@shuvroroy)
- **PR #4441** (2026-10-03): fix(mysql): decode MySQL 9 VECTOR columns (type 0xf2) (@anderson-andres-dev)
- **PR #4439** (2026-10-03): fix(macros-core): only track paths rustc can checksum (@varunshahdev)
- **PR #4436** (2026-10-04): fix(mysql): use the AuthSwitchRequest nonce for caching_sha2_password full auth (@LeandroDettmer)
- **PR #4412** (closed): Drop prepared-statement-cache in postgres upon invalid cached plan (@nipunn1313)
- **PR #4406** (2026-09-10): fix(postgres): return UnexpectedEof when server closes connection at SSLRequest (@zfaustk)
- **PR #4404** (closed): refactor(pool): replace futures-intrusive semaphore with asyncband (@tisonkun)
- **PR #4402** (2026-09-09): sqlx-sqlite: relax libsqlite3-sys constraint to allow 0.38.x (@dtolnay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
