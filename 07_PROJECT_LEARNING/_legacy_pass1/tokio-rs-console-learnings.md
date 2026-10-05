# Forensic Learning Record (Deep Inspection): tokio-rs/console

> **Canonical Artifact**: `07_PROJECT_LEARNING/tokio-rs-console-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tokio-rs/console](https://github.com/tokio-rs/console))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:13:21.365Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tokio-rs/console`
- **Description**: a debugger for async rust!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4605 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console-api/src/async_ops.rs`
```
#![allow(warnings)]

include!("generated/rs.tokio.console.async_ops.rs");

```

### Core Architecture Module: `console-api/src/common.rs`
```
use std::fmt;

pub use generated::*;

mod generated {
    #![allow(warnings)]
    include!("generated/rs.tokio.console.common.rs");
}

impl From<tracing_core::Level> for metadata::Level {
    fn from(level: tracing_core::Level) -> Self {
        match level {
            tracing_core::Level::ERROR => metadata::Level::Error,
            tracing_core::Level::WARN => metadata::Level::Warn,
            tracing_core::Level::INFO => metadata::Level::Info,
            tracing_core::Level::DEBUG => metadata::Level::Debug,
            tracing_core::Level::TRACE => metadata::Level::Trace,
        }
    }
}

impl From<tracing_core::metadata::Kind> for metadata::Kind {
    fn from(kind: tracing_core::metadata::Kind) -> Self {
        // /!\ Note that this is intentionally *not* implemented using match.
        // The `metadata::Kind` struct in `tracing_core` was written not
        // intending to allow exhaustive matches, but accidentally did.
        //
        // Therefore, we shouldn't be able to write a match against both
        // variants without a wildcard arm. However, on versions of
        // `tracing_core` where the type was exhaustively matchable, a wildcard
        // arm will result in a warning. Thus we must write this rather
        // tortured-looking `if` statement to get non-exhaustive matching
        // behavior.
        if kind == tracing_core::metadata::Kind::SPAN {
            metadata::Kind::Span
        } else {
            metadata::Kind::Event
        }
    }
}

impl<'a> From<&'a tracing_core::Metadata<'a>> for Metadata {
    fn from(meta: &'a tracing_core::Metadata<'a>) -> Self {
        let kind = if meta.is_span() {
            metadata::Kind::Span
        } else {
            debug_assert!(meta.is_event());
            metadata::Kind::Event
        };

        let field_names = meta.fields().iter().map(|f| f.name().to_string()).collect();
        Metadata {
            name: meta.name().to_string(),
            target: meta.target().to_string(),
            location: Some(meta.into()),
            kind: kind as i32,
            level: metadata::Level::from(*meta.level()) as i32,
            field_names,
            ..Default::default()
        }
    }
}

impl<'a> From<&'a tracing_core::Metadata<'a>> for Location {
    fn from(meta: &'a tracing_core::Metadata<'a>) -> Self {
        Location {
            file: meta.file().map(String::from),
            module_path: meta.module_path().map(String::from),
            line: meta.line(),
            column: None, // tracing doesn't support columns yet
        }
    }
}

impl<'a> From<&'a std::panic::Location<'a>> for Location {
    fn from(loc: &'a std::panic::Location<'a>) -> Self {
        Location {
            file: Some(loc.file().to_string()),
            line: Some(loc.line()),
            column: Some(loc.column()),
            ..Default::default()
        }
    }
}

impl fmt::Display for field::Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            field::Value::BoolVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::StrVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::U64Val(v) => fmt::Display::fmt(v, f)?,
            field::Value::DebugVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::I64Val(v) => fmt::Display::fmt(v, f)?,
        }

        Ok(())
    }
}

impl fmt::Display for Field {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name_val = (self.name.as_ref(), self.value.as_ref());
        if let (Some(field::Name::StrName(name)), Some(val)) = name_val {
            write!(f, "{}={}", name, val)?;
        }

        Ok(())
    }
}

impl fmt::Display for Location {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match (self.module_path.as_ref(), self.file.as_ref()) {
            // Module paths take precedence because they're shorter...
            (Some(module), _) => f.write_str(module.as_ref())?,
            (None, Some(file)) => f.write_str(file.as_ref())?,
            // If there's no file or module path, then printing the line and
            // column makes no sense...
            (None, None) => return f.write_str("<unknown location>"),
        };

        if let Some(line) = self.line {
            write!(f, ":{}", line)?;

            // Printing the column only makes sense if there's a line...
            if let Some(column) = self.column {
                write!(f, ":{}", column)?;
            }
        }

        Ok(())
    }
}

// === IDs ===

impl From<&'static tracing_core::Metadata<'static>> for MetaId {
    fn from(meta: &'static tracing_core::Metadata) -> Self {
        MetaId {
            id: meta as *const _ as u64,
        }
    }
}

impl From<tracing_core::span::Id> for SpanId {
    fn from(id: tracing_core::span::Id) -> Self {
        SpanId { id: id.into_u64() }
    }
}

impl From<SpanId> for tracing_core::span::Id {
    fn from(span_id: SpanId) -> Self {
        tracing_core::span::Id::from_u64(span_id.id)
    }
}

impl From<u64> for SpanId {
    fn from(id: u64) -> Self {
        SpanId { id }
    }
}

impl From<&'static tracing_core::Metadata<'static>> for register_metadata::NewMetadata {
    fn from(meta: &'static tracing_core::Metadata) -> Self {
        register_metadata::NewMetadata {
            id: Some(meta.into()),
            metadata: Some(meta.into()),
        }
    }
}

impl From<i64> for field::Value {
    fn from(val: i64) -> Self {
        field::Value::I64Val(val)
    }
}

impl From<u64> for field::Value {
    fn from(val: u64) -> Self {
        field::Value::U64Val(val)
    }
}

impl From<bool> for field::Value {
    fn from(val: bool) -> Self {
        field::Value::BoolVal(val)
    }
}

impl From<&str> for field::Value {
    fn from(val: &str) -> Self {
        field::Value::StrVal(val.into())
    }
}

impl From<&str> for field::Name {
    fn from(val: &str) -> Self {
        field::Name::StrName(val.into())
    }
}

impl From<&dyn std::fmt::Debug> for field::Value {
    fn from(val: &dyn std::fmt::Debug) -> Self {
        field::Value::DebugVal(format!("{:?}", val))
    }
}

// === IDs ===

impl From<u64> for Id {
    fn from(id: u64) -> Self {
        Id { id }
    }
}

impl From<Id> for u64 {
    fn from(id: Id) -> Self {
        id.id
    }
}

impl From<tracing_core::span::Id> for Id {
    fn from(id: tracing_core::span::Id) -> Self {
        Id { id: id.into_u64() }
    }
}

```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.async_ops.rs`
```
// This file is @generated by prost-build.
/// An `AsyncOp` state update.
///
/// This includes a list of any new async ops, and updates to the associated statistics
/// for any async ops that have changed since the last update.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct AsyncOpUpdate {
    /// A list of new async operations that were created since the last `AsyncOpUpdate`
    /// was sent. Note that the fact that an async operation has been created
    /// does not mean that is has been polled or is being polled. This information
    /// is reflected in the `Stats` of the operation.
    #[prost(message, repeated, tag = "1")]
    pub new_async_ops: ::prost::alloc::vec::Vec<AsyncOp>,
    /// Any async op stats that have changed since the last update.
    #[prost(map = "uint64, message", tag = "2")]
    pub stats_update: ::std::collections::HashMap<u64, Stats>,
    /// A count of how many async op events (e.g. polls, creation, etc) were not
    /// recorded because the application's event buffer was at capacity.
    ///
    /// If everything is working normally, this should be 0. If it is greater
    /// than 0, that may indicate that some data is missing from this update, and
    /// it may be necessary to increase the number of events buffered by the
    /// application to ensure that data loss is avoided.
    ///
    /// If the application's instrumentation ensures reliable delivery of events,
    /// this will always be 0.
    #[prost(uint64, tag = "3")]
    pub dropped_events: u64,
}
/// An async operation.
///
/// An async operation is an operation that is associated with a resource
/// This could, for example, be a read or write on a TCP stream, or a receive operation on
/// a channel.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct AsyncOp {
    /// The async op's ID.
    ///
    /// This uniquely identifies this op across all *currently live*
    /// ones.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<super::common::Id>,
    /// The numeric ID of the op's `Metadata`.
    ///
    /// This identifies the `Metadata` that describes the `tracing` span
    /// corresponding to this async op. The metadata for this ID will have been sent
    /// in a prior `RegisterMetadata` message.
    #[prost(message, optional, tag = "2")]
    pub metadata: ::core::option::Option<super::common::MetaId>,
    /// The source of this async operation. Most commonly this should be the name
    /// of the method where the instantiation of this op has happened.
    #[prost(string, tag = "3")]
    pub source: ::prost::alloc::string::String,
    /// The ID of the parent async op.
    ///
    /// This field is only set if this async op was created while inside of another
    /// async op.  For example, `tokio::sync`'s `Mutex::lock` internally calls
    /// `Semaphore::acquire`.
    ///
    /// This field can be empty; if it is empty, this async op is not a child of another
    /// async op.
    #[prost(message, optional, tag = "4")]
    pub parent_async_op_id: ::core::option::Option<super::common::Id>,
    /// The resources's ID.
    #[prost(message, optional, tag = "5")]
    pub resource_id: ::core::option::Option<super::common::Id>,
}
/// Statistics associated with a given async operation.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Stats {
    /// Timestamp of when the async op has been created.
    #[prost(message, optional, tag = "1")]
    pub created_at: ::core::option::Option<::prost_types::Timestamp>,
    /// Timestamp of when the async op was dropped.
    #[prost(message, optional, tag = "2")]
    pub dropped_at: ::core::option::Option<::prost_types::Timestamp>,
    /// The Id of the task that is awaiting on this op.
    #[prost(message, optional, tag = "4")]
    pub task_id: ::core::option::Option<super::common::Id>,
    /// Contains the operation poll stats.
    #[prost(message, optional, tag = "5")]
    pub poll_stats: ::core::option::Option<super::common::PollStats>,
    /// State attributes of the async op.
    #[prost(message, repeated, tag = "6")]
    pub attributes: ::prost::alloc::vec::Vec<super::common::Attribute>,
}

```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.common.rs`
```
// This file is @generated by prost-build.
/// Unique identifier for each task.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Id {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// A Rust source code location.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Location {
    /// The file path
    #[prost(string, optional, tag = "1")]
    pub file: ::core::option::Option<::prost::alloc::string::String>,
    /// The Rust module path
    #[prost(string, optional, tag = "2")]
    pub module_path: ::core::option::Option<::prost::alloc::string::String>,
    /// The line number in the source code file.
    #[prost(uint32, optional, tag = "3")]
    pub line: ::core::option::Option<u32>,
    /// The character in `line`.
    #[prost(uint32, optional, tag = "4")]
    pub column: ::core::option::Option<u32>,
}
/// Unique identifier for metadata.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct MetaId {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// Unique identifier for spans.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct SpanId {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// A message representing a key-value pair of data associated with a `Span`
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Field {
    /// Metadata for the task span that the field came from.
    #[prost(message, optional, tag = "8")]
    pub metadata_id: ::core::option::Option<MetaId>,
    /// The key of the key-value pair.
    ///
    /// This is either represented as a string, or as an index into a `Metadata`'s
    /// array of field name strings.
    #[prost(oneof = "field::Name", tags = "1, 2")]
    pub name: ::core::option::Option<field::Name>,
    /// The value of the key-value pair.
    #[prost(oneof = "field::Value", tags = "3, 4, 5, 6, 7")]
    pub value: ::core::option::Option<field::Value>,
}
/// Nested message and enum types in `Field`.
pub mod field {
    /// The key of the key-value pair.
    ///
    /// This is either represented as a string, or as an index into a `Metadata`'s
    /// array of field name strings.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
    pub enum Name {
        /// The string representation of the name.
        #[prost(string, tag = "1")]
        StrName(::prost::alloc::string::String),
        /// An index position into the `Metadata.field_names` of the metadata
        /// for the task span that the field came from.
        #[prost(uint64, tag = "2")]
        NameIdx(u64),
    }
    /// The value of the key-value pair.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
    pub enum Value {
        /// A value serialized to a string using `fmt::Debug`.
        #[prost(string, tag = "3")]
        DebugVal(::prost::alloc::string::String),
        /// A string value.
        #[prost(string, tag = "4")]
        StrVal(::prost::alloc::string::String),
        /// An unsigned integer value.
        #[prost(uint64, tag = "5")]
        U64Val(u64),
        /// A signed integer value.
        #[prost(sint64, tag = "6")]
        I64Val(i64),
        /// A boolean value.
        #[prost(bool, tag = "7")]
        BoolVal(bool),
    }
}
/// Represents a period of time in which a program was executing in a particular context.
///
/// Corresponds to `Span` in the `tracing` crate.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Span {
    /// An Id that uniquely identifies it in relation to other spans.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<SpanId>,
    /// Identifier for metadata describing static characteristics of all spans originating
    /// from that callsite, such as its name, source code location, verbosity level, and
    /// the names of its fields.
    #[prost(message, optional, tag = "2")]
    pub metadata_id: ::core::option::Option<MetaId>,
    /// User-defined key-value pairs of arbitrary data that describe the context the span represents,
    #[prost(message, repeated, tag = "3")]
    pub fields: ::prost::alloc::vec::Vec<Field>,
    /// Timestamp for the span.
    #[prost(message, optional, tag = "4")]
    pub at: ::core::option::Option<::prost_types::Timestamp>,
}
/// Any new metadata that was registered since the last update.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct RegisterMetadata {
    /// The new metadata that was registered since the last update.
    #[prost(message, repeated, tag = "1")]
    pub metadata: ::prost::alloc::vec::Vec<register_metadata::NewMetadata>,
}
/// Nested message and enum types in `RegisterMetadata`.
pub mod register_metadata {
    /// One metadata element registered since the last update.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
    pub struct NewMetadata {
        /// Unique identifier for `metadata`.
        #[prost(message, optional, tag = "1")]
        pub id: ::core::option::Option<super::MetaId>,
        /// The metadata payload.
        #[prost(message, optional, tag = "2")]
        pub metadata: ::core::option::Option<super::Metadata>,
    }
}
/// Metadata associated with a span or event.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Metadata {
    /// The name of the span or event.
    #[prost(string, tag = "1")]
    pub name: ::prost::alloc::string::String,
    /// Describes the part of the system where the span or event that this
    /// metadata describes occurred.
    #[prost(string, tag = "2")]
    pub target: ::prost::alloc::string::String,
    /// The path to the Rust module where the span occurred.
    #[prost(string, tag = "3")]
    pub module_path: ::prost::alloc::string::String,
    /// The Rust source location associated with the span or event.
    #[prost(message, optional, tag = "4")]
    pub location: ::core::option::Option<Location>,
    /// Indicates whether metadata is associated with a span or with an event.
    #[prost(enumeration = "metadata::Kind", tag = "5")]
    pub kind: i32,
    /// Describes the level of verbosity of a span or event.
    #[prost(enumeration = "metadata::Level", tag = "6")]
    pub level: i32,
    /// The names of the key-value fields attached to the
    /// span or event this metadata is associated with.
    #[prost(string, repeated, tag = "7")]
    pub field_names: ::prost::alloc::vec::Vec<::prost::alloc::string::String>,
}
/// Nested message and enum types in `Metadata`.
pub mod metadata {
    /// Indicates whether metadata is associated with a span or with an event.
    #[derive(
        Clone,
        Copy,
        Debug,
        PartialEq,
        Eq,
        Hash,
        PartialOrd,
        Ord,
        ::prost::Enumeration
    )]
    #[repr(i32)]
    pub enum Kind {
        /// Indicates metadata is associated with a span.
        Span = 0,
        /// Indicates metadata is associated with an event.
        Event = 1,
    }
    impl Kind {
        /// String value of the enum field names used in the ProtoBuf definition.
        ///
        /// The values are not transformed in any way and thus are considered stable
        /// (if the ProtoBuf definition does not change) and safe for programmatic use.
        pub fn as_str_name(&self) -> &'static str {
            match self {
                Self::Span => "SPAN",
                Self::Event => "EVENT",
            }
        }
        /// Creates an enum from field names used in the ProtoBuf definition.
        pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
            match value {
                "SPAN" => Some(Self::Span),
                "EVENT" => Some(Self::Event),
                _ => None,
            }
        }
    }
    /// Describes the level of verbosity of a span or event.
    ///
    /// Corresponds to `Level` in the `tracing` crate.
    #[derive(
        Clone,
        Copy,
      
```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.instrument.rs`
```
// This file is @generated by prost-build.
/// InstrumentRequest requests the stream of updates
/// to observe the async runtime state over time.
///
/// TODO: In the future allow for the request to specify
/// only the data that the caller cares about (i.e. only
/// tasks but no resources)
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct InstrumentRequest {}
/// TaskDetailsRequest requests the stream of updates about
/// the specific task identified in the request.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct TaskDetailsRequest {
    /// Identifies the task for which details were requested.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<super::common::Id>,
}
/// PauseRequest requests the stream of updates to pause.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct PauseRequest {}
/// ResumeRequest requests the stream of updates to resume after a pause.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct ResumeRequest {}
/// Update carries all information regarding tasks, resources, async operations
/// and resource operations in one message. There are a couple of reasons to combine all
/// of these into a single message:
///
/// - we can use one single timestamp for all the data
/// - we can have all the new_metadata in one place
/// - things such as async ops and resource ops do not make sense
///    on their own as they have relations to tasks and resources
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Update {
    /// The system time when this update was recorded.
    ///
    /// This is the timestamp any durations in the included `Stats` were
    /// calculated relative to.
    #[prost(message, optional, tag = "1")]
    pub now: ::core::option::Option<::prost_types::Timestamp>,
    /// Task state update.
    #[prost(message, optional, tag = "2")]
    pub task_update: ::core::option::Option<super::tasks::TaskUpdate>,
    /// Resource state update.
    #[prost(message, optional, tag = "3")]
    pub resource_update: ::core::option::Option<super::resources::ResourceUpdate>,
    /// Async operations state update
    #[prost(message, optional, tag = "4")]
    pub async_op_update: ::core::option::Option<super::async_ops::AsyncOpUpdate>,
    /// Any new span metadata that was registered since the last update.
    #[prost(message, optional, tag = "5")]
    pub new_metadata: ::core::option::Option<super::common::RegisterMetadata>,
}
/// StateRequest requests the current state of the aggregator.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct StateRequest {}
/// State carries the current state of the aggregator.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct State {
    #[prost(enumeration = "Temporality", tag = "1")]
    pub temporality: i32,
}
/// `PauseResponse` is the value returned after a pause request.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct PauseResponse {}
/// `ResumeResponse` is the value returned after a resume request.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct ResumeResponse {}
/// The time "state" of the aggregator.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, ::prost::Enumeration)]
#[repr(i32)]
pub enum Temporality {
    /// The aggregator is currently live.
    Live = 0,
    /// The aggregator is currently paused.
    Paused = 1,
}
impl Temporality {
    /// String value of the enum field names used in the ProtoBuf definition.
    ///
    /// The values are not transformed in any way and thus are considered stable
    /// (if the ProtoBuf definition does not change) and safe for programmatic use.
    pub fn as_str_name(&self) -> &'static str {
        match self {
            Self::Live => "LIVE",
            Self::Paused => "PAUSED",
        }
    }
    /// Creates an enum from field names used in the ProtoBuf definition.
    pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
        match value {
            "LIVE" => Some(Self::Live),
            "PAUSED" => Some(Self::Paused),
            _ => None,
        }
    }
}
/// Generated client implementations.
pub mod instrument_client {
    #![allow(
        unused_variables,
        dead_code,
        missing_docs,
        clippy::wildcard_imports,
        clippy::let_unit_value,
    )]
    use tonic::codegen::*;
    use tonic::codegen::http::Uri;
    /// `InstrumentServer<T>` implements `Instrument` as a service.
    #[derive(Debug, Clone)]
    pub struct InstrumentClient<T> {
        inner: tonic::client::Grpc<T>,
    }
    impl InstrumentClient<tonic::transport::Channel> {
        /// Attempt to create a new client by connecting to a given endpoint.
        pub async fn connect<D>(dst: D) -> Result<Self, tonic::transport::Error>
        where
            D: TryInto<tonic::transport::Endpoint>,
            D::Error: Into<StdError>,
        {
            let conn = tonic::transport::Endpoint::new(dst)?.connect().await?;
            Ok(Self::new(conn))
        }
    }
    impl<T> InstrumentClient<T>
    where
        T: tonic::client::GrpcService<tonic::body::Body>,
        T::Error: Into<StdError>,
        T::ResponseBody: Body<Data = Bytes> + std::marker::Send + 'static,
        <T::ResponseBody as Body>::Error: Into<StdError> + std::marker::Send,
    {
        pub fn new(inner: T) -> Self {
            let inner = tonic::client::Grpc::new(inner);
            Self { inner }
        }
        pub fn with_origin(inner: T, origin: Uri) -> Self {
            let inner = tonic::client::Grpc::with_origin(inner, origin);
            Self { inner }
        }
        pub fn with_interceptor<F>(
            inner: T,
            interceptor: F,
        ) -> InstrumentClient<InterceptedService<T, F>>
        where
            F: tonic::service::Interceptor,
            T::ResponseBody: Default,
            T: tonic::codegen::Service<
                http::Request<tonic::body::Body>,
                Response = http::Response<
                    <T as tonic::client::GrpcService<tonic::body::Body>>::ResponseBody,
                >,
            >,
            <T as tonic::codegen::Service<
                http::Request<tonic::body::Body>,
            >>::Error: Into<StdError> + std::marker::Send + std::marker::Sync,
        {
            InstrumentClient::new(InterceptedService::new(inner, interceptor))
        }
        /// Compress requests with the given encoding.
        ///
        /// This requires the server to support it otherwise it might respond with an
        /// error.
        #[must_use]
        pub fn send_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.inner = self.inner.send_compressed(encoding);
            self
        }
        /// Enable decompressing responses.
        #[must_use]
        pub fn accept_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.inner = self.inner.accept_compressed(encoding);
            self
        }
        /// Limits the maximum size of a decoded message.
        ///
        /// Default: `4MB`
        #[must_use]
        pub fn max_decoding_message_size(mut self, limit: usize) -> Self {
            self.inner = self.inner.max_decoding_message_size(limit);
            self
        }
        /// Limits the maximum size of an encoded message.
        ///
        /// Default: `usize::MAX`
        #[must_use]
        pub fn max_encoding_message_size(mut self, limit: usize) -> Self {
            self.inner = self.inner.max_encoding_message_size(limit);
            self
        }
        /// Produces a stream of updates representing the behavior of the instrumented async runtime.
        pub async fn watch_updates(
            &mut self,
            request: impl tonic::IntoRequest<super::InstrumentRequest>,
        ) -> std::result::Result<
            tonic::Response<tonic::codec::Streaming<super::Update>>,
     
```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.resources.rs`
```
// This file is @generated by prost-build.
/// A resource state update.
///
/// Each `ResourceUpdate` contains any resource data that has changed since the last
/// update. This includes:
/// - any new resources that were created since the last update
/// - the current stats for any resource whose stats changed since the last update
/// - any new poll ops that have been invoked on a resource
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct ResourceUpdate {
    /// A list of new resources that were created since the last `ResourceUpdate` was
    /// sent.
    #[prost(message, repeated, tag = "1")]
    pub new_resources: ::prost::alloc::vec::Vec<Resource>,
    /// Any resource stats that have changed since the last update.
    #[prost(map = "uint64, message", tag = "2")]
    pub stats_update: ::std::collections::HashMap<u64, Stats>,
    /// A list of all new poll ops that have been invoked on resources since the last update.
    #[prost(message, repeated, tag = "3")]
    pub new_poll_ops: ::prost::alloc::vec::Vec<PollOp>,
    /// A count of how many resource events (e.g. polls, creation, etc) were not
    /// recorded because the application's event buffer was at capacity.
    ///
    /// If everything is working normally, this should be 0. If it is greater
    /// than 0, that may indicate that some data is missing from this update, and
    /// it may be necessary to increase the number of events buffered by the
    /// application to ensure that data loss is avoided.
    ///
    /// If the application's instrumentation ensures reliable delivery of events,
    /// this will always be 0.
    #[prost(uint64, tag = "4")]
    pub dropped_events: u64,
}
/// Static data recorded when a new resource is created.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Resource {
    /// The resources's ID.
    ///
    /// This uniquely identifies this resource across all *currently live*
    /// resources. This is also the primary way any operations on a resource
    /// are associated with it
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<super::common::Id>,
    /// The numeric ID of the resources's `Metadata`.
    #[prost(message, optional, tag = "2")]
    pub metadata: ::core::option::Option<super::common::MetaId>,
    /// The resources's concrete rust type.
    #[prost(string, tag = "3")]
    pub concrete_type: ::prost::alloc::string::String,
    /// The kind of resource (e.g timer, mutex)
    #[prost(message, optional, tag = "4")]
    pub kind: ::core::option::Option<resource::Kind>,
    /// The location in code where the resource was created.
    #[prost(message, optional, tag = "5")]
    pub location: ::core::option::Option<super::common::Location>,
    /// The ID of the parent resource.
    #[prost(message, optional, tag = "6")]
    pub parent_resource_id: ::core::option::Option<super::common::Id>,
    /// Is the resource an internal component of another resource?
    ///
    /// For example, a `tokio::time::Interval` resource might contain a
    /// `tokio::time::Sleep` resource internally.
    #[prost(bool, tag = "7")]
    pub is_internal: bool,
}
/// Nested message and enum types in `Resource`.
pub mod resource {
    /// The kind of resource (e.g. timer, mutex).
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
    pub struct Kind {
        /// Every resource is either a known kind or an other (unknown) kind.
        #[prost(oneof = "kind::Kind", tags = "1, 2")]
        pub kind: ::core::option::Option<kind::Kind>,
    }
    /// Nested message and enum types in `Kind`.
    pub mod kind {
        /// `Known` collects the kinds of resources that are known in this version of the API.
        #[derive(
            Clone,
            Copy,
            Debug,
            PartialEq,
            Eq,
            Hash,
            PartialOrd,
            Ord,
            ::prost::Enumeration
        )]
        #[repr(i32)]
        pub enum Known {
            /// `TIMER` signals that this is a timer resource, e.g. waiting for a sleep to finish.
            Timer = 0,
        }
        impl Known {
            /// String value of the enum field names used in the ProtoBuf definition.
            ///
            /// The values are not transformed in any way and thus are considered stable
            /// (if the ProtoBuf definition does not change) and safe for programmatic use.
            pub fn as_str_name(&self) -> &'static str {
                match self {
                    Self::Timer => "TIMER",
                }
            }
            /// Creates an enum from field names used in the ProtoBuf definition.
            pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
                match value {
                    "TIMER" => Some(Self::Timer),
                    _ => None,
                }
            }
        }
        /// Every resource is either a known kind or an other (unknown) kind.
        #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
        pub enum Kind {
            /// `known` signals that this kind of resource is known to the console API.
            #[prost(enumeration = "Known", tag = "1")]
            Known(i32),
            /// `other` signals that this kind of resource is unknown to the console API.
            #[prost(string, tag = "2")]
            Other(::prost::alloc::string::String),
        }
    }
}
/// Task runtime stats of a resource.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Stats {
    /// Timestamp of when the resource was created.
    #[prost(message, optional, tag = "1")]
    pub created_at: ::core::option::Option<::prost_types::Timestamp>,
    /// Timestamp of when the resource was dropped.
    #[prost(message, optional, tag = "2")]
    pub dropped_at: ::core::option::Option<::prost_types::Timestamp>,
    /// State attributes of the resource. These are dependent on the type of the resource.
    /// For example, a timer resource will have a duration while a semaphore resource may
    /// have permits as an attribute. These values may change over time as the state of
    /// the resource changes. Therefore, they live in the runtime stats rather than the
    /// static data describing the resource.
    #[prost(message, repeated, tag = "3")]
    pub attributes: ::prost::alloc::vec::Vec<super::common::Attribute>,
}
/// A `PollOp` describes each poll operation that completes within the async
/// application.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct PollOp {
    /// The numeric ID of the op's `Metadata`.
    ///
    /// This identifies the `Metadata` that describes the `tracing` span
    /// corresponding to this op. The metadata for this ID will have been sent
    /// in a prior `RegisterMetadata` message.
    #[prost(message, optional, tag = "2")]
    pub metadata: ::core::option::Option<super::common::MetaId>,
    /// The resources's ID.
    #[prost(message, optional, tag = "3")]
    pub resource_id: ::core::option::Option<super::common::Id>,
    /// the name of this op (e.g. poll_elapsed, new_timeout, reset, etc.)
    #[prost(string, tag = "4")]
    pub name: ::prost::alloc::string::String,
    /// Identifies the task context that this poll op has been called from.
    #[prost(message, optional, tag = "5")]
    pub task_id: ::core::option::Option<super::common::Id>,
    /// Identifies the async op ID that this poll op is part of.
    #[prost(message, optional, tag = "6")]
    pub async_op_id: ::core::option::Option<super::common::Id>,
    /// Whether this poll op has returned with ready or pending.
    #[prost(bool, tag = "7")]
    pub is_ready: bool,
}

```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.tasks.rs`
```
// This file is @generated by prost-build.
/// A task state update.
///
/// Each `TaskUpdate` contains any task data that has changed since the last
/// update. This includes:
/// - any new tasks that were spawned since the last update
/// - the current stats for any task whose stats changed since the last update
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct TaskUpdate {
    /// A list of new tasks that were spawned since the last `TaskUpdate` was
    /// sent.
    ///
    /// If this is empty, no new tasks were spawned.
    #[prost(message, repeated, tag = "1")]
    pub new_tasks: ::prost::alloc::vec::Vec<Task>,
    /// Any task stats that have changed since the last update.
    ///
    /// This is a map of task IDs (64-bit unsigned integers) to task stats. If a
    /// task's ID is not included in this map, then its stats have *not* changed
    /// since the last `TaskUpdate` in which they were present. If a task's ID
    /// *is* included in this map, the corresponding value represents a complete
    /// snapshot of that task's stats at in the current time window.
    #[prost(map = "uint64, message", tag = "3")]
    pub stats_update: ::std::collections::HashMap<u64, Stats>,
    /// A count of how many task events (e.g. polls, spawns, etc) were not
    /// recorded because the application's event buffer was at capacity.
    ///
    /// If everything is working normally, this should be 0. If it is greater
    /// than 0, that may indicate that some data is missing from this update, and
    /// it may be necessary to increase the number of events buffered by the
    /// application to ensure that data loss is avoided.
    ///
    /// If the application's instrumentation ensures reliable delivery of events,
    /// this will always be 0.
    #[prost(uint64, tag = "4")]
    pub dropped_events: u64,
}
/// A task details update
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct TaskDetails {
    /// The task's ID which the details belong to.
    #[prost(message, optional, tag = "1")]
    pub task_id: ::core::option::Option<super::common::Id>,
    /// The timestamp for when the update to the task took place.
    #[prost(message, optional, tag = "2")]
    pub now: ::core::option::Option<::prost_types::Timestamp>,
    /// A histogram of task scheduled durations.
    ///
    /// The scheduled duration is the time a task spends between being
    /// woken and when it is next polled.
    #[prost(message, optional, tag = "5")]
    pub scheduled_times_histogram: ::core::option::Option<DurationHistogram>,
    /// A histogram of task poll durations.
    ///
    /// This is either:
    /// - the raw binary representation of a HdrHistogram.rs `Histogram`
    ///    serialized to binary in the V2 format (legacy)
    /// - a binary histogram plus details on outliers (current)
    #[prost(oneof = "task_details::PollTimesHistogram", tags = "3, 4")]
    pub poll_times_histogram: ::core::option::Option<task_details::PollTimesHistogram>,
}
/// Nested message and enum types in `TaskDetails`.
pub mod task_details {
    /// A histogram of task poll durations.
    ///
    /// This is either:
    /// - the raw binary representation of a HdrHistogram.rs `Histogram`
    ///    serialized to binary in the V2 format (legacy)
    /// - a binary histogram plus details on outliers (current)
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
    pub enum PollTimesHistogram {
        /// HdrHistogram.rs `Histogram` serialized to binary in the V2 format
        #[prost(bytes, tag = "3")]
        LegacyHistogram(::prost::alloc::vec::Vec<u8>),
        /// A histogram plus additional data.
        #[prost(message, tag = "4")]
        Histogram(super::DurationHistogram),
    }
}
/// Data recorded when a new task is spawned.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Task {
    /// The task's ID.
    ///
    /// This uniquely identifies this task across all *currently live* tasks.
    /// When the task's stats change, or when the task completes, it will be
    /// identified by this ID; if the client requires additional information
    /// included in the `Task` message, it should store that data and access it
    /// by ID.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<super::common::Id>,
    /// The numeric ID of the task's `Metadata`.
    ///
    /// This identifies the `Metadata` that describes the `tracing` span
    /// corresponding to this task. The metadata for this ID will have been sent
    /// in a prior `RegisterMetadata` message.
    #[prost(message, optional, tag = "2")]
    pub metadata: ::core::option::Option<super::common::MetaId>,
    /// The category of task this task belongs to.
    #[prost(enumeration = "task::Kind", tag = "3")]
    pub kind: i32,
    /// A list of `Field` objects attached to this task.
    #[prost(message, repeated, tag = "4")]
    pub fields: ::prost::alloc::vec::Vec<super::common::Field>,
    /// An ordered list of span IDs corresponding to the `tracing` span context
    /// in which this task was spawned.
    ///
    /// The first span ID in this list is the immediate parent, followed by that
    /// span's parent, and so on. The final ID is the root span of the current
    /// trace.
    ///
    /// If this is empty, there were *no* active spans when the task was spawned.
    ///
    /// These IDs may correspond to `tracing` spans which are *not* tasks, if
    /// additional trace data is being collected.
    #[prost(message, repeated, tag = "5")]
    pub parents: ::prost::alloc::vec::Vec<super::common::SpanId>,
    /// The location in code where the task was spawned.
    #[prost(message, optional, tag = "6")]
    pub location: ::core::option::Option<super::common::Location>,
}
/// Nested message and enum types in `Task`.
pub mod task {
    /// The category of task this task belongs to.
    #[derive(
        Clone,
        Copy,
        Debug,
        PartialEq,
        Eq,
        Hash,
        PartialOrd,
        Ord,
        ::prost::Enumeration
    )]
    #[repr(i32)]
    pub enum Kind {
        /// A task spawned using a runtime's standard asynchronous task spawning
        /// operation (such as `tokio::task::spawn`).
        Spawn = 0,
        /// A task spawned via a runtime's blocking task spawning operation
        /// (such as `tokio::task::spawn_blocking`).
        Blocking = 1,
    }
    impl Kind {
        /// String value of the enum field names used in the ProtoBuf definition.
        ///
        /// The values are not transformed in any way and thus are considered stable
        /// (if the ProtoBuf definition does not change) and safe for programmatic use.
        pub fn as_str_name(&self) -> &'static str {
            match self {
                Self::Spawn => "SPAWN",
                Self::Blocking => "BLOCKING",
            }
        }
        /// Creates an enum from field names used in the ProtoBuf definition.
        pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
            match value {
                "SPAWN" => Some(Self::Spawn),
                "BLOCKING" => Some(Self::Blocking),
                _ => None,
            }
        }
    }
}
/// Task performance statistics.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Stats {
    /// Timestamp of when the task was spawned.
    #[prost(message, optional, tag = "1")]
    pub created_at: ::core::option::Option<::prost_types::Timestamp>,
    /// Timestamp of when the task was dropped.
    #[prost(message, optional, tag = "2")]
    pub dropped_at: ::core::option::Option<::prost_types::Timestamp>,
    /// The total number of times this task has been woken over its lifetime.
    #[prost(uint64, tag = "3")]
    pub wakes: u64,
    /// The total number of times this task's waker has been cloned.
    #[prost(uint64, tag = "4")]
    pub waker_clones: u64,
    /// The total number of times this task's waker has been dropped.
    #[prost(uint64, tag = "5")]
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #676** (2026-08-07): **refactor: resolve clippy lints**
  *Symptoms*: ```console warning: redundant reference in `eprintln!` argument    --> console-subscriber/src/builder.rs:434:25     | 434 |                         &self.filter_env_var, log_filter, e     |                         ^^^^^^^^^^^^^^^^^^^^ help: remove the redundant `&`: `self.filter_env_var`     |     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.97.0/index.html#useless_borrows_in_formatting     = note: `#[warn(clippy::useless_borrows_in_formatting)]` on by default  warning: manual checked division    --> tokio-console/src/view/mini_histogram.rs:139:20     | 139 |                 if max != 0 {     |                    ^^^^^^^^ check performed here 140 |                     let r = e * u64::from(area.height) * 8 / max;     |                             ------------------------------------ division performed here     |     = help: consider using `checked_div`     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.97.0/index.html#manual_checked_ops     = note: `#[warn(clippy::manual_checked_ops)]` on by default ```

- **Issue #675** (2026-08-08): **Update ratatui from 0.29 to 0.30**
  *Symptoms*: Release notes:  - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.0 - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.1 - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.2
  **Post-Mortem & Fix Analysis**:
  > `cargo clippy` failure in CI is unrelated to this PR. Fix: https://github.com/tokio-rs/console/pull/676
  > - Rebased over https://github.com/tokio-rs/console/pull/676.

- **Issue #668** (2026-06-30): **chore: bump js-yaml from 4.1.0 to 4.2.0 in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.0 to 4.2.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[4.2.0] - 2026-06-01</h2> <h3>Added</h3> <ul> <li>Added <code>docs/safety.md</code> with notes about processing untrusted YAML.</li> <li>Added <code>maxDepth</code> (100) loader option. Not a problem, but gives a better exception instead of RangeError on stack overflow.</li> <li>Added <code>maxMergeSeqLength</code> (20) loader option. Not a problem after <code>merge</code> fix, but an additional restriction for safety.</li> <li>Added sourcemaps to <code>dist/</code> builds.</li> </ul> <h3>Changed</h3> <ul> <li>Stop resolving numbers with underscores as numeric scalars, <a href="https://redirect.github.com/nodeca/js-yaml/issues/627">#627</a>.</li> <li>Switched dev toolchains to Vite / neostandard.</li> <li>Updated demo.</li> <li>Reorganized tests.</li> <li><code>dist/</code> files are no longer kept in the repository.</li> </ul> <h3>Fixed</h3> <ul> <li>Fix parsing of properties on the first implicit block mapping key, <a href="https://redirect.github.com/nodeca/js-yaml/issues/62">#62</a>.</li> <li>Fix trailing whitespace handling when folding flow scalar lines, <a href="https://redirect.github.com/nodeca/js-yaml/issues/307">#307</a>.</li> <li>Reject top-level block scalars without content indentation, <a href="https://redirect.git
  **Post-Mortem & Fix Analysis**:
  > Superseded by #671.

- **Issue #663** (2026-06-13): **chore: bump vite and @vitejs/plugin-react in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [vite](https://github.com/vitejs/vite/tree/HEAD/packages/vite) and [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/HEAD/packages/plugin-react). These dependencies needed to be updated together. Updates `vite` from 5.4.18 to 8.0.8 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vitejs/vite/releases">vite's releases</a>.</em></p> <blockquote> <h2>v8.0.8</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.8/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.7</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.7/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.6</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.6/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.5</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.5/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.4</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.4/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>create-vite@8.0.3</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/create-vite@8.0.3/packages/create-vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.3</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.3/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>create-v
  **Post-Mortem & Fix Analysis**:
  > Superseded by #666.

- **Issue #658** (2026-03-28): **chore: raise required compiler to rust 1.84**
  *Symptoms*: Rust 1.84.0 (released in January 2025) stabilized the MSRV-aware resolver in Cargo: https://blog.rust-lang.org/2025/01/09/Rust-1.84.0/#cargo-considers-rust-versions-for-dependency-version-selection. This makes it unnecessary to disallow using `tokio-console` with more recent versions of `clap`.  Specifically, I am interested in building `tokio-console` against `clap` 4.6 &mdash; using a much newer compiler than 1.74.0 obviously. But this is prohibited by the current dependency specification.

- **Issue #657** (2026-03-28): **Resolve clippy lints**
  *Symptoms*: ```console warning: the `Err`-variant returned from this closure is very large    --> console-subscriber/tests/support/subscriber.rs:314:14     | 314 |         .map(|expected| validate_expected_task(expected, &actual_tasks))     |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ the `Err`-variant is at least 160 bytes     |     = help: try reducing the size of `support::task::TaskValidationFailure`, for example by boxing large elements or replacing it with `Box<support::task::TaskValidationFailure>`     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.94.0/index.html#result_large_err     = note: `#[warn(clippy::result_large_err)]` on by default  warning: this `impl` can be derived   --> tokio-console/src/state/async_ops.rs:68:1    | 68 | / impl Default for SortBy { 69 | |     fn default() -> Self { 70 | |         Self::Aid 71 | |     } 72 | | }    | |_^    |    = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.94.0/index.html#derivable_impls    = note: `#[warn(clippy::derivable_impls)]` on by default help: replace the manual implementation with a derive attribute and mark the default variant    | 30 + #[derive(Default)] 31 | pub(crate) enum SortBy { 32 ~     #[default] 33 ~     Aid = 0,    |  warning: this `impl` can be derived   --> tokio-console/src/state/resources.rs:76:1    | 76 | / impl Default for SortBy { 77 | |     fn default() -> Self { 78

- **Issue #654** (2026-03-28): **chore(deps): bump bytes from 1.10.1 to 1.11.1**
  *Symptoms*: Bumps [bytes](https://github.com/tokio-rs/bytes) from 1.10.1 to 1.11.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/tokio-rs/bytes/releases">bytes's releases</a>.</em></p> <blockquote> <h2>Bytes v1.11.1</h2> <h1>1.11.1 (February 3rd, 2026)</h1> <ul> <li>Fix integer overflow in <code>BytesMut::reserve</code></li> </ul> <h2>Bytes v1.11.0</h2> <h1>1.11.0 (November 14th, 2025)</h1> <ul> <li>Bump MSRV to 1.57 (<a href="https://redirect.github.com/tokio-rs/bytes/issues/788">#788</a>)</li> </ul> <h3>Fixed</h3> <ul> <li>fix: <code>BytesMut</code> only reuse if src has remaining (<a href="https://redirect.github.com/tokio-rs/bytes/issues/803">#803</a>)</li> <li>Specialize <code>BytesMut::put::&lt;Bytes&gt;</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/793">#793</a>)</li> <li>Reserve capacity in <code>BytesMut::put</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/794">#794</a>)</li> <li>Change <code>BytesMut::remaining_mut</code> to use <code>isize::MAX</code> instead of <code>usize::MAX</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/795">#795</a>)</li> </ul> <h3>Internal changes</h3> <ul> <li>Guarantee address in <code>slice()</code> for empty slices. (<a href="https://redirect.github.com/tokio-rs/bytes/issues/780">#780</a>)</li> <li>Rename <code>Vtable::to_*</code> -&gt; <code>Vtable::into_*</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/776">#776</a>)</li> <l
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.
  > (Oops, wrong button.)

- **Issue #649** (2026-06-22): **chore(deps-dev): bump js-yaml from 4.1.0 to 4.1.1 in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.0 to 4.1.1. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[4.1.1] - 2025-11-12</h2> <h3>Security</h3> <ul> <li>Fix prototype pollution issue in yaml merge (&lt;&lt;) operator.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/cc482e775913e6625137572a3712d2826170e53a"><code>cc482e7</code></a> 4.1.1 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/50968b862e75866ef90e626572fe0b2f97b55f9f"><code>50968b8</code></a> dist rebuild</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d092d866031751cb27c12d93f3e2470ad74d678b"><code>d092d86</code></a> lint fix</li> <li><a href="https://github.com/nodeca/js-yaml/commit/383665ff4248ec2192d1274e934462bb30426879"><code>383665f</code></a> fix prototype pollution in merge (&lt;&lt;)</li> <li><a href="https://github.com/nodeca/js-yaml/commit/0d3ca7a27b03a6c974790a30a89e456007d62976"><code>0d3ca7a</code></a> README.md: HTTP =&gt; HTTPS (<a href="https://redirect.github.com/nodeca/js-yaml/issues/678">#678</a>)</li> <li><a href="https://github.com/nodeca/js-yaml/commit/49baadd52af887d2991e2c39a6639baa56d6c71b"><code>49baadd</code></a> doc: 'empty' style option for !!null</li> <li><a href="https://github.com/nodeca/js-yaml/commit/ba3460eb9d3e4478edcbc2
  **Post-Mortem & Fix Analysis**:
  > Superseded by #668.

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

### Incident Patch 1: `d3848d71` (2025-09-29)
**Commit Message**: Fix Nix builds and update the lock file (#641)

* Fix clippy warnings

* Fix doc example

* Clean up tonic-web usage

It looks like `tonic_web::enable` was removed with the 0.13.x release so
this code hasn't actually compiled for a long time. The doc and code
examples all use a custom cors layer so whatever heavy lifting the 0.12
method was doing doesn't seem necessary anymore

* ci: run clippy with all features enabled

Features are additive so this should be safe to lint them all together
(and avoid the combinatorics of using cargo-hack)

* ci: run all crate tests in one invocation

1. We've already committed our lockfile so there's no need to test the
   API/subscriber crates individually (if we want to test with the
   latest available versions we should be running a `cargo update` in
   CI, so this change remains compatible with the previous behavior)
2. Also enable some non-default feature flags to ensure they are being
   tested

* Fix nix builds

* flake.lock: Update

Flake lock file updates:

• Updated input 'flake-utils':
    'github:numtide/flake-utils/cfacdce06f30d2b68473a46042957675eebb3401' (2023-04-11)
  → 'github:numtide/flake-utils/11707dc2f618dd54ca8739b309ec4fc02

**File**: `flake.lock` (modified, +9/-12)
```diff
@@ -5,11 +5,11 @@
         "systems": "systems"
       },
       "locked": {
-        "lastModified": 1681202837,
-        "narHash": "sha256-H+Rh19JDwRtpVPAWp64F+rlEtxUWBAQW28eAi3SRSzg=",
+        "lastModified": 1731533236,
+        "narHash": "sha256-l0KFg5HjrsfsO/JpG+r7fRrqm12kzFHyUHqHCVpMMbI=",
         "owner": "numtide",
         "repo": "flake-utils",
-        "rev": "cfacdce06f30d2b68473a46042957675eebb3401",
+        "rev": "11707dc2f618dd54ca8739b309ec4fc024de578b",
         "type": "github"
       },
       "original": {
@@ -20,11 +20,11 @@
     },
     "nixpkgs": {
       "locked": {
-        "lastModified": 1707689078,
-        "narHash": "sha256-UUGmRa84ZJHpGZ1WZEBEUOzaPOWG8LZ0yPg1pdDF/yM=",
+        "lastModified": 1759036355,
+        "narHash": "sha256-0m27AKv6ka+q270dw48KflE0LwQYrO7Fm4/2//KCVWg=",
         "owner": "NixOS",
         "repo": "nixpkgs",
-        "rev": "f9d39fb9aff0efee4a3d5f4a6d7c17701d38a1d8",
+        "rev": "e9f00bd893984bc8ce46c895c3bf7cac95331127",
         "type": "github"
       },
       "original": {
@@ -43,19 +43,16 @@
     },
     "rust-overlay": {
       "inputs": {
-        "flake-utils": [
-          "flake-utils"
-        ],
         "nixpkgs": [
           "nixpkgs"
         ]
       },
       "locked": {
-        "lastModified": 1707790272,
-        "narHash": "sha256-KQXPNl3BLdRbz7xx+mwIq/017fxLRk6JhXHxVWCKsTU=",
+        "lastModified": 1759113356,
+        "narHash": "sha256-xm4kEUcV2jk6u15aHazFP4YsMwhq+PczA+Ul/4FDKWI=",
         "owner": "oxalica",
         "repo": "rust-overlay",
-        "rev": "8dfbe2dffc28c1a18a29ffa34d5d0b269622b158",
+        "rev": "be3b8843a2be2411500f6c052876119485e957a2",
         "type": "github"
       },
       "original": {
```

**File**: `flake.nix` (modified, +25/-4)
```diff
@@ -8,7 +8,6 @@
       url = "github:oxalica/rust-overlay";
       inputs = {
         nixpkgs.follows = "nixpkgs";
-        flake-utils.follows = "flake-utils";
       };
     };
   };
@@ -66,12 +65,32 @@
               pname = cargoTOML.package.name;
               version = cargoTOML.package.version;
 
-              nativeBuildInputs = [ protobuf ];
+              nativeBuildInputs = [
+                installShellFiles
+                protobuf
+              ];
+
+              RUSTFLAGS = "--cfg tokio_unstable";
 
               inherit src;
 
               cargoLock = { lockFile = "${src}/Cargo.lock"; };
 
+              checkFlags = [
+                # tests depend upon git repository at test execution time
+                "--skip bootstrap"
+                "--skip config::tests::args_example_changed"
+                "--skip config::tests::toml_example_changed"
+                "--skip cli_tests"
+              ];
+
+              postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
+                installShellCompletion --cmd tokio-console \
+                  --bash <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion bash) \
+                  --fish <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion fish) \
+                  --zsh <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion zsh)
+              '';
+
               meta = {
                 inherit (cargoTOML.package) description homepage license;
                 maintainers = cargoTOML.package.authors;
@@ -84,8 +103,7 @@
           devShell = with pkgs;
             mkShell {
               name = "tokio-console-env";
-              buildInputs = tokio-console.buildInputs ++ lib.optional stdenv.isDarwin libiconv;
-              nativeBuildInputs = tokio-console.nativeBuildInputs;
+              inputsFrom = [ tokio-console ];
               RUST_SRC_PATH = "${rustPlatform.rustLibSrc}";
               CARGO_TERM_COLOR = "always";
               RUST_BACKTRACE = "full";
@@ -105,5 +123,8 @@
             inherit tokio-console;
             default = self.packages.${system}.tokio-console;
           };
+          checks = {
+            inherit tokio-console;
+          };
         });
 }
```

---

### Incident Patch 2: `4238e732` (2025-09-29)
**Commit Message**: Fix some clippy warnings and building with `--all-features` (#640)

* Fix clippy warnings

* Fix doc example

* Clean up tonic-web usage

It looks like `tonic_web::enable` was removed with the 0.13.x release so
this code hasn't actually compiled for a long time. The doc and code
examples all use a custom cors layer so whatever heavy lifting the 0.12
method was doing doesn't seem necessary anymore

* ci: run clippy with all features enabled

Features are additive so this should be safe to lint them all together
(and avoid the combinatorics of using cargo-hack)

* ci: run all crate tests in one invocation

1. We've already committed our lockfile so there's no need to test the
   API/subscriber crates individually (if we want to test with the
   latest available versions we should be running a `cargo update` in
   CI, so this change remains compatible with the previous behavior)
2. Also enable some non-default feature flags to ensure they are being
   tested

**File**: `.github/workflows/ci.yml` (modified, +10/-10)
```diff
@@ -71,15 +71,21 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        os: [ubuntu-latest, macos-latest, windows-latest]
+        os: [ubuntu-latest, macos-latest]
         rust: [stable]
+        extraFeatures: [vsock]
         include:
+          - rust: stable
+            os: windows-latest
+            extraFeatures: ""
           - rust: 1.74.0
             os: ubuntu-latest
+            extraFeatures: vsock
           # Try to build on the latest nightly. This job is allowed to fail, but
           # it's useful to help catch bugs in upcoming Rust versions.
           - rust: nightly
             os: ubuntu-latest
+            extraFeatures: vsock
     steps:
       - name: Checkout sources
         uses: actions/checkout@v4
@@ -95,14 +101,8 @@ jobs:
         with:
           repo-token: ${{ secrets.GITHUB_TOKEN }}
 
-      - name: Run cargo test (API)
-        run: cargo test -p console-api
-
-      - name: Run cargo test (subscriber)
-        run: cargo test -p console-subscriber
-
-      - name: Run cargo test (console)
-        run: cargo test -p tokio-console --locked
+      - name: Run cargo test
+        run: cargo test --workspace --locked --features "transport,grpc-web,${{ matrix.extraFeatures }}"
 
   lints:
     name: Lints
@@ -122,7 +122,7 @@ jobs:
         run: cargo fmt --all -- --check
 
       - name: Run cargo clippy
-        run: cargo clippy --workspace --all-targets --no-deps -- -D warnings
+        run: cargo clippy --workspace --all-features --all-targets --no-deps -- -D warnings
 
   docs:
     name: Docs
```

**File**: `console-subscriber/Cargo.toml` (modified, +2/-4)
```diff
@@ -28,7 +28,7 @@ keywords = [
 default = ["env-filter"]
 parking_lot = ["dep:parking_lot", "tracing-subscriber/parking_lot"]
 env-filter = ["tracing-subscriber/env-filter"]
-grpc-web = ["dep:tonic-web"]
+grpc-web = []
 vsock = ["dep:tokio-vsock"]
 
 [dependencies]
@@ -54,9 +54,6 @@ serde = { version = "1.0.145", features = ["derive"] }
 serde_json = "1"
 crossbeam-channel = "0.5"
 
-# Only for the web feature:
-tonic-web = { version = "0.13", optional = true }
-
 # Only for the vsock feature:
 tokio-vsock = { version = "0.7.1", optional = true, features = ["tonic013"]}
 
@@ -66,6 +63,7 @@ tower = { version = "0.4.12", default-features = false, features = ["util"] }
 futures = "0.3"
 http = "1.1"
 tower-http = { version = "0.5", features = ["cors"] }
+tonic-web = "0.13"
 
 [lints.rust.unexpected_cfgs]
 level = "warn"
```

**File**: `console-subscriber/src/builder.rs` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ impl Builder {
     /// ```
     /// # use console_subscriber::Builder;
     /// # #[cfg(feature = "vsock")]
-    /// let builder = Builder::default().server_addr((tokio_vsock::VMADDR_CID_ANY, 6669));
+    /// let builder = Builder::default().server_addr(tokio_vsock::VsockAddr::new(tokio_vsock::VMADDR_CID_ANY, 6669));
     /// ```
     ///
     /// [environment variable]: `Builder::with_default_env`
```

**File**: `console-subscriber/src/lib.rs` (modified, +1/-13)
```diff
@@ -974,16 +974,6 @@ impl Server {
     ///
     /// # Examples
     ///
-    /// To serve the instrument server with gRPC-Web support with the default
-    /// settings:
-    ///
-    /// ```rust
-    /// # async fn docs() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
-    /// # let (_, server) = console_subscriber::ConsoleLayer::new();
-    /// server.serve_with_grpc_web(tonic::transport::Server::default()).await
-    /// # }
-    /// ```
-    ///
     /// To serve the instrument server with gRPC-Web support and a custom CORS configuration, use the
     /// following code:
     ///
@@ -1076,9 +1066,7 @@ impl Server {
             instrument_server,
             aggregator,
         } = self.into_parts();
-        let router = builder
-            .accept_http1(true)
-            .add_service(tonic_web::enable(instrument_server));
+        let router = builder.accept_http1(true).add_service(instrument_server);
         let aggregate = spawn_named(aggregator.run(), "console::aggregate");
         let res = match addr {
             ServerAddr::Tcp(addr) => {
```

**File**: `console-subscriber/tests/support/subscriber.rs` (modified, +1/-2)
```diff
@@ -207,8 +207,7 @@ async fn console_client(client_stream: DuplexStream, mut test_state: TestState)
                 // We need to return a Result from this async block, which is
                 // why we don't unwrap the `client` here.
                 client.map(TokioIo::new).ok_or_else(|| {
-                    std::io::Error::new(
-                        std::io::ErrorKind::Other,
+                    std::io::Error::other(
                         "console-test error: client already taken. This shouldn't happen.",
                     )
                 })
```

---

### Incident Patch 3: `85acb905` (2025-04-10)
**Commit Message**: chore: fix new clippy lint from Rust 1.86 (#622)

The new [`clippy::doc_overindented_list_items`] lint was triggering on a
few lines in the documentation of our Tokio Console config struct. These
have been aligned with Clippy's suggestions.

[`clippy::doc_overindented_list_items`]: https://rust-lang.github.io/rust-clippy/master/index.html#doc_overindented_list_items

**File**: `tokio-console/src/config.rs` (modified, +6/-6)
```diff
@@ -58,17 +58,17 @@ pub struct Config {
     /// Each warning is specified by its name, which is one of:
     ///
     /// * `self-wakes` -- Warns when a task wakes itself more than a certain percentage of its total wakeups.
-    ///                   Default percentage is 50%.
+    ///   Default percentage is 50%.
     ///
     /// * `lost-waker` -- Warns when a task is dropped without being woken.
     ///
     /// * `never-yielded` -- Warns when a task has never yielded.
     ///
     /// * `auto-boxed-future` -- Warnings when the future driving a task was automatically boxed by
-    ///                          the runtime because it was large.
+    ///   the runtime because it was large.
     ///
     /// * `large-future` -- Warnings when the future driving a task occupies a large amount of
-    ///                     stack space.
+    ///   stack space.
     #[clap(long = "warn", short = 'W', value_delimiter = ',', num_args = 1..)]
     #[clap(default_values_t = KnownWarnings::default_enabled_warnings())]
     pub(crate) warnings: Vec<KnownWarnings>,
@@ -80,17 +80,17 @@ pub struct Config {
     /// Each warning is specified by its name, which is one of:
     ///
     /// * `self-wakes` -- Warns when a task wakes itself more than a certain percentage of its total wakeups.
-    ///                  Default percentage is 50%.
+    ///   Default percentage is 50%.
     ///
     /// * `lost-waker` -- Warns when a task is dropped without being woken.
     ///
     /// * `never-yielded` -- Warns when a task has never yielded.
     ///
     /// * `auto-boxed-future` -- Warnings when the future driving a task was automatically boxed by
-    ///                          the runtime because it was large.
+    ///   the runtime because it was large.
     ///
     /// * `large-future` -- Warnings when the future driving a task occupies a large amount of
-    ///                     stack space.
+    ///   stack space.
     ///
     /// If this is set to `all`, all warnings are allowed.
     ///
```

---

### Incident Patch 4: `ada7dab7` (2025-03-31)
**Commit Message**: fix(console): add dynamic constraints layout in task details screen (#614)

The changes I've made is for accommodating long location names.

I've changed the .. to the long name; it widens the task rectangle if its longer
than the default (50%) and goes to the next line if its longer than what we can
accommodate in a single line. This fixes issue #523, I have attached screenshots
of the same in the PR, before and after changes.

Fixes #523

Co-authored-by: Hayden Stainsby <hds@caffeineconcepts.com>

**File**: `tokio-console/src/view/task.rs` (modified, +47/-31)
```diff
@@ -68,6 +68,18 @@ impl TaskView {
             })
             .collect();
 
+        let location_heading = "Location: ";
+        let max_width_stats_area = area.width - 45; //NOTE: 45 is min width needed, this is a calculated number according to the string: 'Last woken: 75.831727ms ago' but with some more extra pixels.
+        let location_lines_vector: Vec<String> = task
+            .location()
+            .to_string()
+            .chars()
+            .collect::<Vec<char>>()
+            .chunks(max_width_stats_area as usize)
+            .map(|chunk| chunk.iter().collect())
+            .collect();
+        let task_stats_height = 9 + location_lines_vector.len() as u16;
+        // Id, Name, Target, Location (multiple), total, busy, scheduled, and idle times + top/bottom borders
         let (
             controls_area,
             stats_area,
@@ -83,7 +95,7 @@ impl TaskView {
                         // controls
                         layout::Constraint::Length(controls.height()),
                         // task stats
-                        layout::Constraint::Length(10),
+                        layout::Constraint::Length(task_stats_height),
                         // poll duration
                         layout::Constraint::Length(9),
                         // scheduled duration
@@ -105,7 +117,7 @@ impl TaskView {
                         // warnings (add 2 for top and bottom borders)
                         layout::Constraint::Length(warnings.len() as u16 + 2),
                         // task stats
-                        layout::Constraint::Length(10),
+                        layout::Constraint::Length(task_stats_height),
                         // poll duration
                         layout::Constraint::Length(9),
                         // scheduled duration
@@ -127,15 +139,15 @@ impl TaskView {
             )
         };
 
+        let stats_constraints = [
+            // 15 is the length of "| Location:     |"
+            layout::Constraint::Min(task.location().len() as u16 + 15),
+            layout::Constraint::Min(32),
+        ];
+
         let stats_area = Layout::default()
             .direction(layout::Direction::Horizontal)
-            .constraints(
-                [
-                    layout::Constraint::Percentage(50),
-                    layout::Constraint::Percentage(50),
-                ]
-                .as_ref(),
-            )
+            .constraints(stats_constraints.as_ref())
             .split(stats_area);
 
         // Just preallocate capacity for ID, name, target, total, busy, and idle.
@@ -152,17 +164,12 @@ impl TaskView {
 
         overview.push(Line::from(vec![bold("Target: "), Span::raw(task.target())]));
 
-        let title = "Location: ";
-        let location_max_width = stats_area[0].width as usize - 2 - title.len(); // NOTE: -2 for the border
-        let location = if task.location().len() > location_max_width {
-            let ellipsis = styles.if_utf8("\u{2026}", "...");
-            let start = task.location().len() - location_max_width + ellipsis.chars().count();
-            format!("{}{}", ellipsis, &task.location()[start..])
-        } else {
-            task.location().to_string()
-        };
-
-        overview.push(Line::from(vec![bold(title), Span::raw(location)]));
+        let location_vector = vec![bold(location_heading), Span::raw(&location_lines_vector[0])];
+        overview.push(Line::from(location_vector));
+        for line in &location_lines_vector[1..] {
+            overview.push(Line::from(Span::raw(format!("          {}", line))));
+            //10 spaces to be precise due to the Length of  "Location: "
+        }
 
         let total = task.total(now);
 
@@ -185,28 +192,37 @@ impl TaskView {
 
         let mut waker_stats = vec![Line::from(vec![
             bold("Current wakers: "),
-            Span::from(format!("{} (", task.waker_count())),
-            bold("clones: "),
-            Span::from(format!("{}, ",
```

---

### Incident Patch 5: `3dbca7a7` (2024-12-26)
**Commit Message**: docs(subscriber): fix typo in doc comment

**File**: `console-subscriber/src/builder.rs` (modified, +1/-1)
```diff
@@ -659,7 +659,7 @@ impl<'a> From<&'a Path> for ServerAddr {
 ///
 /// If the "env-filter" crate feature flag is enabled, the `RUST_LOG`
 /// environment variable will be parsed using the [`EnvFilter`] type from
-/// `tracing-subscriber. If the "env-filter" feature is **not** enabled, the
+/// `tracing-subscriber`. If the "env-filter" feature is **not** enabled, the
 /// [`Targets`] filter is used instead. The `EnvFilter` type accepts all the
 /// same syntax as `Targets`, but with the added ability to filter dynamically
 /// on span field values. See the documentation for those types for details.
```

---

### Incident Patch 6: `dd646291` (2024-12-12)
**Commit Message**: fix: bump the url to 2.5.4 (#602)

close #601

As Remedy said, because we are not directly dependent on `idna`. 
So we just need to bump the `url` to 2.5.4 or later.

Signed-off-by: Rustin170506 <tech@rustin.me>

**File**: `Cargo.lock` (modified, +265/-31)
```diff
@@ -510,6 +510,17 @@ dependencies = [
  "windows-sys 0.48.0",
 ]
 
+[[package]]
+name = "displaydoc"
+version = "0.2.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "97369cbbc041bc366949bc74d34658d6cda5621039731c6310521892a3a20ae0"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
 [[package]]
 name = "dunce"
 version = "1.0.5"
@@ -891,14 +902,143 @@ dependencies = [
  "tracing",
 ]
 
+[[package]]
+name = "icu_collections"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "db2fa452206ebee18c4b5c2274dbf1de17008e874b4dc4f0aea9d01ca79e4526"
+dependencies = [
+ "displaydoc",
+ "yoke",
+ "zerofrom",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "13acbb8371917fc971be86fc8057c41a64b521c184808a698c02acc242dbf637"
+dependencies = [
+ "displaydoc",
+ "litemap",
+ "tinystr",
+ "writeable",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid_transform"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "01d11ac35de8e40fdeda00d9e1e9d92525f3f9d887cdd7aa81d727596788b54e"
+dependencies = [
+ "displaydoc",
+ "icu_locid",
+ "icu_locid_transform_data",
+ "icu_provider",
+ "tinystr",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid_transform_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fdc8ff3388f852bede6b579ad4e978ab004f139284d7b28715f773507b946f6e"
+
+[[package]]
+name = "icu_normalizer"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "19ce3e0da2ec68599d193c93d088142efd7f9c5d6fc9b803774855747dc6a84f"
+dependencies = [
+ "displaydoc",
+ "icu_collections",
+ "icu_normalizer_data",
+ "icu_properties",
+ "icu_provider",
+ "smallvec",
+ "utf16_iter",
+ "utf8_iter",
+ "write16",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_normalizer_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f8cafbf7aa791e9b22bec55a167906f9e1215fd475cd22adfcf660e03e989516"
+
+[[package]]
+name = "icu_properties"
+version = "1.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "93d6020766cfc6302c15dbbc9c8778c37e62c14427cb7f6e601d849e092aeef5"
+dependencies = [
+ "displaydoc",
+ "icu_collections",
+ "icu_locid_transform",
+ "icu_properties_data",
+ "icu_provider",
+ "tinystr",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_properties_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "67a8effbc3dd3e4ba1afa8ad918d5684b8868b3b26500753effea8d2eed19569"
+
+[[package]]
+name = "icu_provider"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6ed421c8a8ef78d3e2dbc98a973be2f3770cb42b606e3ab18d6237c4dfde68d9"
+dependencies = [
+ "displaydoc",
+ "icu_locid",
+ "icu_provider_macros",
+ "stable_deref_trait",
+ "tinystr",
+ "writeable",
+ "yoke",
+ "zerofrom",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_provider_macros"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1ec89e9337638ecdc08744df490b221a7399bf8d164eb52a665454e60e075ad6"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
 [[package]]
 name = "idna"
-version = "0.5.0"
+version = "1.0.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "686f825264d630750a544639377bae737628043f20d38bbc029e8f29ea968a7e"
+dependencies = [
+ "idna_adapter",
+ "smallvec",
+ "utf8_iter",
+]
+
+[[package]]
+name = "idna_adapter"
+version = "1.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "634d9b1461af396cad843f47fdba5597a4f9e6ddd4bfb6ff5d85028c25cb12f6"
+checksum = "daca1df1c957320b2cf139ac61e7bd64fed304c5040df000a745aa1de3b4ef71"
 dependencies = [
- "unicode-bidi",
- "unicode-normalization",
+ "icu_normalizer",
+ "
```

---

### Incident Patch 7: `1f41b61f` (2024-11-04)
**Commit Message**: fix(api): bump minimum version of tonic (#593)

Change the minimum version of tonic from 0.12 to 0.12.3. This fixes
compilation in downstream projects with old lock files, since the
generated code now uses a constant only present in tonic 0.12.3.

Closes #592

**File**: `console-api/Cargo.toml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ keywords = [
 transport = ["tonic/transport"]
 
 [dependencies]
-tonic = { version = "0.12", default-features = false, features = [
+tonic = { version = "0.12.3", default-features = false, features = [
     "prost",
     "codegen",
     "transport",
```

---

### Incident Patch 8: `f8e1bee7` (2024-08-29)
**Commit Message**: fix(console): correct the grammar issue (#579)

I know the best solution is to ensure we can distinguish singular or plural here.
But for now, let's correct the grammar issue first.

**File**: `tokio-console/src/warnings.rs` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ pub(crate) struct LostWaker;
 
 impl Warn<Task> for LostWaker {
     fn summary(&self) -> &str {
-        "tasks have lost their waker"
+        "tasks have lost their wakers"
     }
 
     fn check(&self, task: &Task) -> Warning {
```

---

### Incident Patch 9: `c4420630` (2024-07-29)
**Commit Message**: fix(subscriber): remove unused `AggregatorHandle` and fix other lints (#578)

A number of new or updated Clippy lints in Rust 1.80.0 need to be fixed.

An update to the `dead_code` pointed out that the `AggregatorHandle` is
not used, and it is not constructable from outside the crate because it
has a private field. This struct was introduced in #451 as part of the
`Server::into_parts` method. Originally, this method was going to return
the `AggregatorHandle`, which wrapped the join handle from the task
where the `Aggregator` had been spawned. This was later replaced by
returning the `Aggregator` itself, which the user had the obligation to
spawn themselves. However, it seems that the `AggregatorHandle` wasn't
removed, even though it was never used.

A new lint is the one for unexpected `--cfg` items. We now need to
declare those in `Cargo.toml`.

An update to `needless_borrows_for_generic_args` causes a false positive
changing a `&mut` to a move, which we can't do as the same value is used
afterwards.

**File**: `console-subscriber/Cargo.toml` (modified, +4/-0)
```diff
@@ -63,6 +63,10 @@ futures = "0.3"
 http = "1.1"
 tower-http = { version = "0.5", features = ["cors"] }
 
+[lints.rust.unexpected_cfgs]
+level = "warn"
+check-cfg = [ 'cfg(tokio_unstable)', 'cfg(console_without_tokio_unstable)' ]
+
 [package.metadata.docs.rs]
 all-features = true
 rustdoc-args = ["--cfg", "docsrs"]
```

**File**: `console-subscriber/README.md` (modified, +4/-4)
```diff
@@ -94,12 +94,12 @@ runtime][Tokio] is considered *experimental*. In order to use
   level].
 
   + If you're using the [`console_subscriber::init()`][init] or
-  [`console_subscriber::Builder`][builder] APIs, these targets are enabled
-  automatically.
+    [`console_subscriber::Builder`][builder] APIs, these targets are enabled
+    automatically.
 
   + If you are manually configuring the `tracing` subscriber using the
-  [`EnvFilter`] or [`Targets`] filters from [`tracing-subscriber`], add
-  `"tokio=trace,runtime=trace"` to your filter configuration.
+    [`EnvFilter`] or [`Targets`] filters from [`tracing-subscriber`], add
+    `"tokio=trace,runtime=trace"` to your filter configuration.
 
   + Also, ensure you have not enabled any of the [compile time filter
     features][compile_time_filters] in your `Cargo.toml`.
```

**File**: `console-subscriber/src/lib.rs` (modified, +1/-36)
```diff
@@ -15,10 +15,7 @@ use std::{
 use thread_local::ThreadLocal;
 #[cfg(unix)]
 use tokio::net::UnixListener;
-use tokio::{
-    sync::{mpsc, oneshot},
-    task::JoinHandle,
-};
+use tokio::sync::{mpsc, oneshot};
 #[cfg(unix)]
 use tokio_stream::wrappers::UnixListenerStream;
 use tracing_core::{
@@ -1187,38 +1184,6 @@ pub struct ServerParts {
     pub aggregator: Aggregator,
 }
 
-/// Aggregator handle.
-///
-/// This object is returned from [`Server::into_parts`]. It can be
-/// used to abort the aggregator task.
-///
-/// The aggregator collects the traces that implement the async runtime
-/// being observed and prepares them to be served by the gRPC server.
-///
-/// Normally, if the server, started with [`Server::serve`] or
-/// [`Server::serve_with`] stops for any reason, the aggregator is aborted,
-/// hoewver, if the server was started with the [`InstrumentServer`] returned
-/// from [`Server::into_parts`], then it is the responsibility of the user
-/// of the API to stop the aggregator task by calling [`abort`] on this
-/// object.
-///
-/// [`abort`]: fn@crate::AggregatorHandle::abort
-pub struct AggregatorHandle {
-    join_handle: JoinHandle<()>,
-}
-
-impl AggregatorHandle {
-    /// Aborts the task running this aggregator.
-    ///
-    /// To avoid having a disconnected aggregator running forever, this
-    /// method should be called when the [`tonic::transport::Server`] started
-    /// with the [`InstrumentServer`] also returned from [`Server::into_parts`]
-    /// stops running.
-    pub fn abort(&mut self) {
-        self.join_handle.abort();
-    }
-}
-
 #[tonic::async_trait]
 impl proto::instrument::instrument_server::Instrument for Server {
     type WatchUpdatesStream =
```

**File**: `console-subscriber/src/record.rs` (modified, +3/-0)
```diff
@@ -83,6 +83,9 @@ fn record_io(file: File, rx: Receiver<Event>) -> io::Result<()> {
     use std::io::{BufWriter, Write};
 
     fn write<T: Serialize>(mut file: &mut BufWriter<File>, val: &T) -> io::Result<()> {
+        // Clippy throws a false positive here. We can't actually pass the owned `file` to
+        // `to_writer` because we need it again in the line blow.
+        #[allow(clippy::needless_borrows_for_generic_args)]
         serde_json::to_writer(&mut file, val)?;
         file.write_all(b"\n")
     }
```

---

### Incident Patch 10: `9205e159` (2024-07-24)
**Commit Message**: fix(console): avoid crash when accessing selected item (#570)

We should check the length before using the index to access it.

Closes #565

Test locally:

https://github.com/tokio-rs/console/assets/29879298/5c4fd5da-e1c7-490b-bd67-1257972076d3

But it is difficult to view it, you can try it by following the steps from the issue.

**File**: `tokio-console/src/view/mod.rs` (modified, +3/-3)
```diff
@@ -132,7 +132,7 @@ impl View {
                 // mutate the currently selected view.
                 match event {
                     key!(Enter) => {
-                        if let Some(task) = self.tasks_list.selected_item().upgrade() {
+                        if let Some(task) = self.tasks_list.selected_item() {
                             update_kind = UpdateKind::SelectTask(task.borrow().span_id());
                             self.state = TaskInstance(self::task::TaskView::new(
                                 task,
@@ -149,7 +149,7 @@ impl View {
             ResourcesList => {
                 match event {
                     key!(Enter) => {
-                        if let Some(res) = self.resources_list.selected_item().upgrade() {
+                        if let Some(res) = self.resources_list.selected_item() {
                             update_kind = UpdateKind::SelectResource(res.borrow().span_id());
                             self.state = ResourceInstance(self::resource::ResourceView::new(res));
                         }
@@ -169,7 +169,7 @@ impl View {
                         update_kind = UpdateKind::Other;
                     }
                     key!(Enter) => {
-                        if let Some(op) = view.async_ops_table.selected_item().upgrade() {
+                        if let Some(op) = view.async_ops_table.selected_item() {
                             if let Some(task_id) = op.borrow().task_id() {
                                 let task = self
                                     .tasks_list
```

**File**: `tokio-console/src/view/table.rs` (modified, +13/-9)
```diff
@@ -13,7 +13,7 @@ use ratatui::{
 use std::convert::TryFrom;
 
 use std::cell::RefCell;
-use std::rc::Weak;
+use std::rc::{Rc, Weak};
 
 pub(crate) trait TableList<const N: usize> {
     type Row;
@@ -154,18 +154,22 @@ impl<T: TableList<N>, const N: usize> TableListState<T, N> {
         self.scroll_with(|_, _| 0)
     }
 
-    pub(in crate::view) fn selected_item(&self) -> Weak<RefCell<T::Row>> {
+    pub(in crate::view) fn selected_item(&self) -> Option<Rc<RefCell<T::Row>>> {
         self.table_state
             .selected()
-            .map(|i| {
-                let selected = if self.sort_descending {
-                    i
+            .and_then(|i| {
+                if self.sort_descending {
+                    if i < self.sorted_items.len() {
+                        Some(self.sorted_items[i].clone())
+                    } else {
+                        None
+                    }
                 } else {
-                    self.sorted_items.len() - i - 1
-                };
-                self.sorted_items[selected].clone()
+                    let adjusted_index = self.sorted_items.len().checked_sub(i + 1)?;
+                    self.sorted_items.get(adjusted_index).cloned()
+                }
             })
-            .unwrap_or_default()
+            .and_then(|weak| weak.upgrade())
     }
 
     pub(in crate::view) fn render(
```

#### Recent Merged Pull Requests:
- **PR #676** (2026-08-07): refactor: resolve clippy lints (@dtolnay)
- **PR #675** (2026-08-08): Update ratatui from 0.29 to 0.30 (@dtolnay)
- **PR #668** (closed): chore: bump js-yaml from 4.1.0 to 4.2.0 in /console-subscriber/examples/grpc_web/app (@dependabot[bot])
- **PR #663** (closed): chore: bump vite and @vitejs/plugin-react in /console-subscriber/examples/grpc_web/app (@dependabot[bot])
- **PR #658** (2026-03-28): chore: raise required compiler to rust 1.84 (@dtolnay)
- **PR #657** (2026-03-28): Resolve clippy lints (@dtolnay)
- **PR #656** (closed): Replace manual Default impls with #[derive(Default)] (@ghost)
- **PR #654** (2026-03-28): chore(deps): bump bytes from 1.10.1 to 1.11.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
