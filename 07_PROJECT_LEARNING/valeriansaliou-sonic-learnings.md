# Forensic Learning Record (Deep Inspection): valeriansaliou/sonic

> **Canonical Artifact**: `07_PROJECT_LEARNING/valeriansaliou-sonic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/valeriansaliou/sonic](https://github.com/valeriansaliou/sonic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:20.589Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `valeriansaliou/sonic`
- **Description**: 🦔 Fast, lightweight & schema-less search backend. An alternative to Elasticsearch that runs on a few MBs of RAM.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 21357 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/examples/search_concurrent_async.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

mod common;

use std::net::Ipv6Addr;

use sonic_client::SonicMultiplexer;
use sonic_client::control::SonicChannelControlAsync;
use sonic_client::ingest::SonicChannelIngestBlocking;
use sonic_client::options::Lang;
use sonic_client::search::SonicChannelSearchAsync;

use crate::common::data::WIKIPEDIA_PARAGRAPHS_SEARCH_ENGINE;
use crate::common::*;

const COLLECTION: &str = "collection";
const BUCKET: &str = "bucket";

async fn task(conn: &SonicChannelSearchAsync, queries: &[&str]) -> std::io::Result<()> {
    for &query in queries.into_iter() {
        conn.query_with_options(COLLECTION, BUCKET, query, &[&Lang("eng")])
            .await?;
        conn.suggest(COLLECTION, BUCKET, query).await?;
    }

    Ok(())
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), std::io::Error> {
    let start = std::time::Instant::now();

    eprintln!("\n=== Create multiplexer ===");
    let mut multiplexer = timed!({ SonicMultiplexer::new()? });

    timed!({
        eprintln!("\n=== Setup ===");
        let ingest = SonicChannelIngestBlocking::connect(
            (Ipv6Addr::LOCALHOST, 1491),
            "SecretPassword",
            &mut multiplexer,
        )?;

        for (i, p) in WIKIPEDIA_PARAGRAPHS_SEARCH_ENGINE.into_iter().enumerate() {
            ingest.push_with_options(
                COLLECTION,
                BUCKET,
                format!("object:{i}"),
                p,
                &[&Lang("eng")],
            )?;
        }

        let control = SonicChannelControlAsync::connect(
            (Ipv6Addr::LOCALHOST, 1491),
            "SecretPassword",
            &mut multiplexer,
        )?;

        control.trigger_consolidate().await?;
    });

    let mut search = timed!({
        eprintln!("\n=== START search ===");
        let search = SonicChannelSearchAsync::connect(
            (Ipv6Addr::LOCALHOST, 1491),
            "SecretPassword",
            &mut multiplexer,
        )?;
        eprintln!("Version: {}", search.server_info().version);
        eprintln!("Channel: {:?}", search.channel_info());
        search
    });

    #[rustfmt::skip]
    let task1 = task(
        &search,
        &["search", "engine", "probabili"],
    );
    #[rustfmt::skip]
    let task2 = task(
        &search,
        &["database", "relevance", "index"],
    );
    #[rustfmt::skip]
    let task3 = task(
        &search,
        &["criteria", "information", "similar"],
    );

    let (res1, res2, res3) = tokio::join!(task1, task2, task3);
    res1?;
    res2?;
    res3?;

    timed!({
        eprintln!("\n=== Quit search ===");
        search.quit().await?;
    });

    eprintln!("\nTotal execution time: {:.3?}", start.elapsed());

    eprintln!("\n=== Drop all ===");

    Ok(())
}

```

### Core Architecture Module: `client/src/util.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

pub(crate) mod errors {
    pub fn io_error_invalid_data<E: Into<Box<dyn std::error::Error + Send + Sync>>>(
        error: E,
    ) -> std::io::Error {
        std::io::Error::new(std::io::ErrorKind::InvalidData, error)
    }
}

/// Builds a command String efficiently.
#[cfg_attr(feature = "raw-api", macro_export)]
macro_rules! make_command {
    ($command:literal) => {{
        $crate::Command::from($command)
    }};

    ($format:literal $(, $arg:ident)* $(; text: $text:ident)? $(; options: $options:ident)?) => {{
        use std::fmt::Write as _;

        $(let $arg: &str = $arg.as_ref();)*
        $(let $text: &str = $text.as_ref();)?

        // NOTE: Since we can’t know if the argument will be quoted or not,
        //   this macro is a bit too generic and might waste a few bytes of
        //   capacity. Using `$format.len()` is a shortcut that’s good enough
        //   to account for spaces, quotes, etc. A single argument formatted
        //   as `{}` will reserve `len + 2`, although it will be printed as
        //   `len + 1` (preceding space). Same goes for `{:?}`, which will
        //   reserve 1 extraneous byte. It’s good enough. Options reserve 16
        //   bytes, as they should rarely be larger than this.
        let mut message: String = String::with_capacity(
            $format.len()
                $(+ $arg.len())*
                // NOTE: `*2` to account for escaping.
                $(+ ($text.len() * 2))?
                $(+ ($options.len() * 16))?
        );

        // SAFETY: `$arg`s are string slices, formatting cannot fail.
        write!(&mut message, $format$(, $arg)*).unwrap();

        #[allow(unused_mut, unused_assignments)]
        let (mut prefix_len, mut suffix_start) = (message.len(), message.len());

        $(
            message.push(' ');
            message.push('"');
            prefix_len = message.len();

            message.push_str($crate::util::escape_str($text).as_str());

            suffix_start = message.len();
            message.push('"');
        )?

        $(for option in $options {
            write!(&mut message, " {option}").map_err(std::io::Error::other)?;
        })?

        let suffix_len = message.len() - suffix_start;

        $crate::Command::new(message.into_boxed_str(), prefix_len, suffix_len)
    }};
}
pub(crate) use make_command;

/// Escapes special characters in strings.
pub(crate) fn escape_str(str: &str) -> String {
    // NOTE: Already allocate twice the space needed to avoid a re-allocation
    //   as soon as one character has to be escaped.
    let mut res = String::with_capacity(str.len() * 2);

    for c in str.chars() {
        match c {
            '"' => res.push_str("\\\""),
            '\r' => res.push_str("\\r"),
            '\n' => res.push_str("\\n"),
            '\\' => res.push_str("\\\\"),
            _ => res.push(c),
        }
    }

    res
}

macro_rules! impl_channel_structs {
    ($mode:ident($mode_lowercase:literal): $low_level_ty:ident / $blocking_ty:ident / $async_ty:ident) => {
        type LowLevelChannel = $low_level_ty;

        #[doc = concat!("A synchronous but non-blocking way to interact with a Sonic Channel in ", stringify!($mode), " mode.")]
        #[doc = concat!("\n\nShared logic for [`", stringify!($blocking_ty), "`] and [`", stringify!($async_ty),"`], which you should use instead.")]
        #[repr(transparent)]
        pub struct $low_level_ty {
            inner: SonicChannel<self::Mode>,
        }

        impl $low_level_ty {
            #[doc(alias = "new")]
            pub fn connect(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                SonicChannel::<self::Mode>::connect::<crate::transport::SonicStream>(addr, pass, multiplexer)
                    .map(|inner| Self { inner })
            }

            /// Same as [`connect`][Self::connect] but allows choosing a
            /// different transport layer.
            ///
            /// This is useful in tests for example, to debug what’s going on
            /// by wrapping the TCP stream in a logging layer.
            pub fn connect_custom<T: crate::transport::Transport + 'static>(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                SonicChannel::<self::Mode>::connect::<T>(addr, pass, multiplexer)
                    .map(|inner| Self { inner })
            }

            pub fn server_info(&self) -> &crate::events::ServerInfo {
                &self.inner.server_info
            }

            pub fn channel_info(&self) -> &crate::events::ChannelInfo {
                &self.inner.channel_info
            }

            fn quit_blocking_(&mut self) -> std::io::Result<()> {
                self.quit()?
                    .recv_timeout($crate::RECV_TIMEOUT)
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::BrokenPipe, error))?
            }
        }

        impl Drop for $low_level_ty {
            #[inline]
            fn drop(&mut self) {
                if !self.inner.is_closed() {
                    $crate::logging::log_trace!(concat!("[Drop] Quitting ", stringify!($low_level_ty)));
                    self.quit_blocking_().unwrap_or_else(|error| crate::logging::log_error!("{error:?}"));
                }
            }
        }

        #[cfg(feature = "sync")]
        type BlockingChannel = $blocking_ty;

        #[doc = concat!("A blocking way to interact with a Sonic Channel in ", stringify!($mode), " mode.")]
        #[doc = concat!("\n\nWhen in an asynchronous context (e.g. using `tokio`), use [`", stringify!($async_ty), "`] instead.")]
        #[cfg(feature = "sync")]
        #[repr(transparent)]
        pub struct $blocking_ty {
            inner: $low_level_ty,
        }

        #[cfg(feature = "sync")]
        impl $blocking_ty {
            #[doc(alias = "new")]
            pub fn connect(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                $low_level_ty::connect(addr, pass, multiplexer).map(|inner| Self { inner })
            }

            /// Same as [`connect`][Self::connect] but allows choosing a
            /// different transport layer.
            ///
            /// This is useful in tests for example, to debug what’s going on
            /// by wrapping the TCP stream in a logging layer.
            pub fn connect_custom<T: crate::transport::Transport + 'static>(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                $low_level_ty::connect_custom::<T>(addr, pass, multiplexer).map(|inner| Self { inner })
            }

            pub fn server_info(&self) -> &crate::events::ServerInfo {
                self.inner.server_info()
            }

            pub fn channel_info(&self) -> &crate::events::ChannelInfo {
                self.inner.channel_info()
            }
        }

        #[cfg(feature = "async")]
        type AsyncChannel = $async_ty;

        #[doc = concat!("An asynchronous way to interact with a Sonic Channel in ", stringify!($mode), " mode.")]
        #[doc = concat!("\n\nIf you can’t be in an asynchronous context, use [`", stringify!($blocking_ty), "`] instead.")]
        #[cfg(feature = "async")]
        #[repr(transparent)]
        pub struct $async_ty {
            inner: $low_level_ty,
        }

        #[cfg(feature = "async")]
        impl $async_ty {
            #[doc(alias = "new")]
            pub fn connect(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                $low_level_ty::connect(addr, pass, multiplexer).map(|inner| Self { inner })
            }

            /// Same as [`connect`][Self::connect] but allows choosing a
            /// different transport layer.
            ///
            /// This is useful in tests for example, to debug what’s going on
            /// by wrapping the TCP stream in a logging layer.
            pub fn connect_custom<T: crate::transport::Transport + 'static>(
                addr: impl Into<std::net::SocketAddr>,
                pass: impl AsRef<str>,
                multiplexer: &$crate::SonicMultiplexer,
            ) -> std::io::Result<Self> {
                $low_level_ty::connect_custom::<T>(addr, pass, multiplexer).map(|inner| Self { inner })
            }

            pub fn server_info(&self) -> &crate::events::ServerInfo {
                self.inner.server_info()
            }

            pub fn channel_info(&self) -> &crate::events::ChannelInfo {
                self.inner.channel_info()
            }
        }
    };
}
pub(crate) use impl_channel_structs;

/// Implements the given functions for all supported contexts (low-level, sync,
/// async), depending on enabled features.
///
/// NOTE: We must have two branches for `&self`, `&mut self`…
///   it’s annoying but I(@RemiBardon) found no way around it.
macro_rules! impl_fns {
    (
        $(#[$meta:meta])*
        fn $fn:ident $(<$($lifetime:lifetime),+>)? (&mut $self:ident $(, $arg_name:ident: $arg_ty:ty)* $(,)?) -> $ret_ty:ty $main:block
    ) => {
        impl self::LowLevelChannel {
            $(#[$meta])*
            pub fn $fn$(<$($lifetime),+>)?(
                &mut $self,
                $($arg_name: $arg_ty,)*
     
```

### Core Architecture Module: `core/src/config.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

//! Sonic library configuration.
//!
//! It does not include server nor channel configuration, which are specific
//! to the `sonic-server` binary.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;

use crate::util::serde::env_var;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub normalization: NormalizationConfig,

    pub tokenization: TokenizationConfig,

    pub stopwords: StopwordsConfig,

    pub search: SearchConfig,

    pub store: StoreConfig,
}

impl Config {
    pub fn validate(&self) {
        // Check 'write_buffer' for KV
        if self.store.kv.database.write_buffer_size == Some(0) {
            panic!("write_buffer for kv must not be zero");
        }

        // Check 'flush_after' for KV
        if self.store.kv.database.flush_after >= self.store.kv.pool.inactive_after {
            panic!("flush_after for kv must be strictly lower than inactive_after");
        }

        // Check 'consolidate_after' for FST
        if self.store.fst.graph.consolidate_after >= self.store.fst.pool.inactive_after {
            panic!("consolidate_after for fst must be strictly lower than inactive_after");
        }
    }
}

/// Configuration group for normalization options (Unicode normalization,
/// stemming, lemmatization…).
#[derive(Debug, Deserialize, Clone, Copy)]
pub struct NormalizationConfig {
    #[serde(with = "crate::util::serde::none_string_as_none")]
    pub unicode_normalization: Option<UnicodeNormalization>,

    pub diacritic_folding_enabled: bool,

    #[cfg(feature = "stemming")]
    pub stemming_enabled: bool,
}

#[derive(Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum UnicodeNormalization {
    /// Unicode Normalization Form C.
    Nfc,
    /// Unicode Normalization Form KC.
    Nfkc,
}

/// Configuration group for tokenization options.
#[derive(Debug, Deserialize, Clone, Copy)]
pub struct TokenizationConfig {
    pub detect_special_patterns: bool,

    #[serde(alias = "split_special_patterns")]
    pub compat_split_special_patterns: bool,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct StopwordsConfig {
    #[serde(deserialize_with = "to_stopwords")]
    pub allow: HashSet<String>,

    #[serde(deserialize_with = "to_stopwords")]
    pub deny: HashSet<String>,
}

fn to_stopwords<'de, D>(deserializer: D) -> Result<HashSet<String>, D::Error>
where
    D: serde::de::Deserializer<'de>,
{
    use unicode_normalization::UnicodeNormalization as _;

    let vec: Vec<Box<str>> = Deserialize::deserialize(deserializer)?;
    let stopwords_iter = vec.into_iter().map(|s| s.nfkd().to_string());
    Ok(HashSet::from_iter(stopwords_iter))
}

#[derive(Debug, Deserialize)]
pub struct SearchConfig {
    pub query_limit_default: u16,

    pub query_limit_maximum: u16,

    pub query_alternates_try: usize,

    pub query_minimum_term_idf_default: f32,

    pub query_minimum_term_idf_minimum_object_count: u64,

    pub suggest_limit_default: u16,

    pub suggest_limit_maximum: u16,

    pub list_limit_default: u16,

    pub list_limit_maximum: u16,
}

#[derive(Debug, Deserialize)]
pub struct StoreConfig {
    pub kv: Arc<KvStoreConfig>,

    pub fst: Arc<FstStoreConfig>,
}

#[derive(Debug, Deserialize)]
pub struct KvStoreConfig {
    #[serde(deserialize_with = "env_var::path_buf")]
    pub path: PathBuf,

    pub retain_word_objects: usize,

    pub pool: KvStorePoolConfig,

    pub database: KvStoreDatabaseConfig,
}

#[derive(Debug, Deserialize)]
pub struct KvStorePoolConfig {
    pub inactive_after: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KvStoreDatabaseConfig {
    pub flush_after: u64,

    pub write_ahead_log: bool,

    /// Whether or not to compress.
    ///
    /// Will get overriden if [`compression_type`](Self::compression_type) is
    /// also specified.
    #[serde(default)]
    pub compress: Option<bool>,

    #[serde(default)]
    pub parallelism: Option<i32>,

    #[serde(default)]
    #[serde(alias = "max_files")]
    pub max_open_files: Option<i32>,

    // TODO(major): Make this MB, as in Kvrocks.
    /// WARN: In KB!
    #[serde(default = "default_write_buffer_size")]
    #[serde(alias = "write_buffer")]
    pub write_buffer_size: Option<usize>,

    #[serde(default)]
    pub max_write_buffer_number: Option<i32>,

    #[serde(default)]
    pub min_write_buffer_number: Option<i32>,

    #[serde(default)]
    pub min_write_buffer_number_to_merge: Option<i32>,

    #[serde(default)]
    pub block_cache_size: Option<u32>,

    #[serde(default)]
    pub cache_index_and_filter_blocks: Option<bool>,

    #[serde(default)]
    #[serde(alias = "compression")]
    #[serde(deserialize_with = "to_rocksdb_compression_type_opt")]
    pub compression_type: Option<rocksdb::DBCompressionType>,

    #[serde(default)]
    #[serde(alias = "wal_compression")]
    #[serde(deserialize_with = "to_rocksdb_compression_type_opt")]
    pub wal_compression_type: Option<rocksdb::DBCompressionType>,

    #[serde(default)]
    pub wal_ttl_seconds: Option<u64>,

    #[serde(default)]
    pub wal_size_limit_mb: Option<u64>,

    #[serde(default)]
    pub wal_bytes_per_sync: Option<u64>,

    #[serde(default)]
    #[serde(deserialize_with = "to_rocksdb_recovery_mode_opt")]
    pub wal_recovery_mode: Option<rocksdb::DBRecoveryMode>,

    #[serde(default)]
    pub compression_level: Option<i32>,

    #[serde(default)]
    #[serde(alias = "compression_start_level")]
    pub min_level_to_compress: Option<std::ffi::c_int>,

    #[serde(default)]
    #[serde(alias = "level0_file_num_compaction_trigger")]
    pub level_zero_file_num_compaction_trigger: Option<i32>,

    #[serde(default)]
    #[serde(alias = "level0_slowdown_writes_trigger")]
    pub level_zero_slowdown_writes_trigger: Option<i32>,

    #[serde(default)]
    #[serde(alias = "level0_stop_writes_trigger")]
    pub level_zero_stop_writes_trigger: Option<i32>,

    #[serde(default)]
    pub max_bytes_for_level_base: Option<u64>,

    #[serde(default)]
    pub max_bytes_for_level_multiplier: Option<f64>,

    #[serde(default)]
    pub target_file_size_base: Option<u64>,

    #[serde(default)]
    pub max_background_jobs: Option<i32>,

    #[serde(default)]
    #[serde(alias = "max_compactions")]
    pub max_subcompactions: Option<u32>,

    #[serde(default)]
    pub max_flushes: Option<i32>,

    #[serde(default)]
    pub stats_dump_period_sec: Option<u32>,
}

fn default_write_buffer_size() -> Option<usize> {
    Some(16384)
}

fn parse_rocksdb_compression_type<E: serde::de::Error>(
    str: &str,
) -> Result<rocksdb::DBCompressionType, E> {
    // NOTE: Some values are not available because not compiled in rocksdb
    //   (feature flag is off).
    match str.to_ascii_lowercase().as_str() {
        "none" => Ok(rocksdb::DBCompressionType::None),
        // "snappy" => Ok(rocksdb::DBCompressionType::Snappy),
        // "zlib" => Ok(rocksdb::DBCompressionType::Zlib),
        // "bz2" => Ok(rocksdb::DBCompressionType::Bz2),
        // "lz4" => Ok(rocksdb::DBCompressionType::Lz4),
        // "lz4hc" => Ok(rocksdb::DBCompressionType::Lz4hc),
        "zstd" => Ok(rocksdb::DBCompressionType::Zstd),
        _ => Err(serde::de::Error::unknown_variant(
            str,
            &[
                "none",
                // "snappy",
                // "zlib",
                // "bz2",
                // "lz4",
                // "lz4hc",
                "zstd",
            ],
        )),
    }
}

fn to_rocksdb_compression_type_opt<'de, D>(
    deserializer: D,
) -> Result<Option<rocksdb::DBCompressionType>, D::Error>
where
    D: serde::de::Deserializer<'de>,
{
    let str: Option<String> = Deserialize::deserialize(deserializer)?;
    str.map(|s| parse_rocksdb_compression_type(&s)).transpose()
}

fn parse_rocksdb_recovery_mode<E: serde::de::Error>(
    str: &str,
) -> Result<rocksdb::DBRecoveryMode, E> {
    match str.to_ascii_lowercase().as_str() {
        "tolerate_corrupted_tail_records" | "TolerateCorruptedTailRecords" => {
            Ok(rocksdb::DBRecoveryMode::TolerateCorruptedTailRecords)
        }
        "absolute_consistency" | "AbsoluteConsistency" => {
            Ok(rocksdb::DBRecoveryMode::AbsoluteConsistency)
        }
        "point_in_time" | "PointInTime" => Ok(rocksdb::DBRecoveryMode::PointInTime),
        "skip_any_corrupted_record" | "SkipAnyCorruptedRecord" => {
            Ok(rocksdb::DBRecoveryMode::SkipAnyCorruptedRecord)
        }
        _ => Err(serde::de::Error::unknown_variant(
            str,
            &[
                "tolerate_corrupted_tail_records",
                "absolute_consistency",
                "point_in_time",
                "skip_any_corrupted_record",
            ],
        )),
    }
}

fn to_rocksdb_recovery_mode_opt<'de, D>(
    deserializer: D,
) -> Result<Option<rocksdb::DBRecoveryMode>, D::Error>
where
    D: serde::de::Deserializer<'de>,
{
    let str: Option<String> = Deserialize::deserialize(deserializer)?;
    str.map(|s| parse_rocksdb_recovery_mode(&s)).transpose()
}

#[derive(Debug, Deserialize)]
pub struct FstStoreConfig {
    #[serde(deserialize_with = "env_var::path_buf")]
    pub path: PathBuf,

    pub pool: FstStorePoolConfig,

    pub graph: FstStoreGraphConfig,
}

#[derive(Debug, Deserialize)]
pub struct FstStorePoolConfig {
    pub inactive_after: u64,
}

#[derive(Debug, Deserialize)]
pub struct FstStoreGraphConfig {
    pub consolidate_after: u64,

    pub max_size: usize,

    pub max_words: usize,
}

#[cfg(test)]
pub(crate) mod tests {
    pub(crate) fn defaults_toml() -> &'static str {
        r#"
        [channel]
        inet = "[::1]:1491"
        tcp_timeout = 300

        [normalization]
        unicode_normalization = 
```

### Core Architecture Module: `core/src/executor/count.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use crate::store::{StoreItemPart, StoreObjectOid};

impl super::Executor {
    /// Count terms in object (from KV store).
    pub fn counto(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
        oid: StoreObjectOid,
    ) -> Result<u32, ()> {
        // Important: acquire database access read lock, and reference it in context. This \
        //   prevents the database from being erased while using it in this block.
        let _kv_read_guard = self.kv_pool.lock_read_access();

        if let Ok(kv_store) = self.kv_pool.acquire(false, collection, None, |_| {}) {
            let Some(kv_store) = kv_store else {
                tracing::debug!(
                    "collection store does not exist, consider {bucket:?} from {collection:?} empty"
                );
                return Ok(0);
            };

            // Important: acquire bucket store read lock
            executor_kv_lock_read!(kv_store);

            let kv_action = kv_store.access_read_only(bucket);

            // Try to resolve existing OID to IID
            kv_action
                .get_oid_to_iid(oid)
                .unwrap_or(None)
                .map(|iid| {
                    // List terms for IID
                    if let Some(terms) = kv_action.get_iid_to_terms(iid).unwrap_or(None) {
                        terms.len() as u32
                    } else {
                        0
                    }
                })
                .ok_or(())
                .or(Ok(0))
        } else {
            Err(())
        }
    }

    /// Count objects in bucket (from KV store).
    pub fn countb(&self, collection: StoreItemPart, bucket: StoreItemPart) -> Result<u32, ()> {
        let kv_store = self.kv_pool.acquire(false, collection, None, |_| {})?;

        let Some(kv_store) = kv_store else {
            tracing::debug!(
                "collection store does not exist, consider {bucket:?} from {collection:?} empty"
            );
            return Ok(0);
        };

        let kv_action = kv_store.access_read_only(bucket);

        let count = kv_action
            .get_object_count()
            .map_err(|error| tracing::warn!("{error:?}"))?;

        Ok(count)
    }

    /// Count buckets in collection (from FST filesystem).
    pub fn countc(&self, collection: StoreItemPart) -> Result<u32, ()> {
        self.fst_pool
            .count_collection_buckets(collection)
            .map(|count| count as u32)
    }
}

// MARK: - Deprecated

impl super::Executor {
    /// Count terms in (collection, bucket) from FST.
    pub fn legacy_countb(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
    ) -> Result<u32, ()> {
        // Important: acquire graph access read lock, and reference it in context. This \
        //   prevents the graph from being erased while using it in this block.
        let _fst_read_guard = self.fst_pool.lock_read_access();

        if let Ok(fst_store) = self.fst_pool.acquire(collection, bucket) {
            Ok(fst_store.count_words() as u32)
        } else {
            Err(())
        }
    }
}

```

### Core Architecture Module: `core/src/executor/flushb.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use crate::store::StoreItemPart;

impl super::Executor {
    pub fn flushb(&self, collection: StoreItemPart, bucket: StoreItemPart) -> Result<u32, ()> {
        // Important: acquire database access read lock, and reference it in context. This \
        //   prevents the database from being erased while using it in this block.
        // Notice: acquire FST lock in write mode, as we will erase it.
        let _kv_read_guard = self.kv_pool.lock_read_access();
        let _fst_write_guard = self.fst_pool.lock_write_access();

        if let Ok(kv_store) = self.kv_pool.acquire(false, collection, None, |_| {}) {
            let Some(kv_store) = kv_store else {
                tracing::debug!(
                    "collection store does not exist, consider {bucket:?} from {collection:?} already erased"
                );
                return Ok(0);
            };

            // Important: acquire bucket store write lock
            executor_kv_lock_write!(kv_store);

            // Store exists, proceed erasure.
            tracing::debug!("collection store exists, erasing: {bucket} from {collection}");

            let kv_action = kv_store.access_read_write(bucket);

            // Notice: we cannot use the provided KV bucket erasure helper there, as \
            //   erasing a bucket requires a database lock, which would incur a dead-lock, \
            //   thus we need to perform the erasure from there.
            if let Ok(erase_count) = kv_action.batch_erase_bucket() {
                if self.fst_pool.erase(collection, Some(bucket)).is_ok() {
                    tracing::debug!("done with bucket erasure");

                    return Ok(erase_count);
                }
            }
        }

        Err(())
    }
}

```

### Core Architecture Module: `core/src/executor/flushc.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use crate::store::StoreItemPart;

impl super::Executor {
    pub fn flushc(&self, collection: StoreItemPart) -> Result<u32, ()> {
        // Important: do not acquire the store from there, as otherwise it will remain open \
        //   even if dropped in the inner function, as this caller would still own a reference to \
        //   it.
        // Acquire KV + FST locks in write mode, as we will erase them, we need to prevent any \
        //   other consumer to use them.
        let _kv_write_guard = self.kv_pool.lock_write_access();
        let _fst_write_guard = self.fst_pool.lock_write_access();

        match (
            self.kv_pool.erase(collection, None),
            self.fst_pool.erase(collection, None),
        ) {
            (Ok(erase_count), Ok(_)) => Ok(erase_count),
            _ => Err(()),
        }
    }
}

```

### Core Architecture Module: `core/src/executor/flusho.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use rocksdb::WriteBatch;

use crate::store::{StoreItemPart, StoreObjectOid};

impl super::Executor {
    pub fn flusho(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
        oid: StoreObjectOid,
    ) -> Result<u32, ()> {
        // Important: acquire database access read lock, and reference it in context. This \
        //   prevents the database from being erased while using it in this block.
        let _kv_read_guard = self.kv_pool.lock_read_access();

        if let Ok(kv_store) = self.kv_pool.acquire(false, collection, None, |_| {}) {
            let Some(kv_store) = kv_store else {
                tracing::debug!(
                    "collection store does not exist, consider {bucket:?} from {collection:?} empty"
                );
                return Ok(0);
            };

            // Important: acquire bucket store write lock
            executor_kv_lock_write!(kv_store);

            let kv_action = kv_store.access_read_write(bucket);

            // Try to resolve existing OID to IID (if it does not exist, there is nothing to \
            //   be flushed)
            if let Ok(iid_value) = kv_action.get_oid_to_iid(oid) {
                let mut count_flushed = 0;

                if let Some(iid) = iid_value {
                    // Resolve terms associated to IID
                    let iid_terms = {
                        if let Ok(iid_terms_value) = kv_action.get_iid_to_terms(iid) {
                            iid_terms_value.unwrap_or_default()
                        } else {
                            tracing::error!("failed getting flusho executor iid-to-terms");

                            Vec::new()
                        }
                    };

                    let mut batch = WriteBatch::default();

                    // Flush bucket (batch operation, as it is shared w/ other executors)
                    let batch_count =
                        kv_action.batch_flush_bucket(&mut batch, iid, oid, &iid_terms);

                    if kv_action.write(batch).is_ok() {
                        count_flushed += batch_count;
                    } else {
                        tracing::error!("failed executing batch-flush-bucket in flusho executor");
                    }
                }

                return Ok(count_flushed);
            } else {
                tracing::error!("failed getting flusho executor oid-to-iid");
            }
        }

        Err(())
    }
}

```

### Core Architecture Module: `core/src/executor/list.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2022, Troy Kohler <troy.kohler@zalando.de>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use super::types::{QuerySearchLimit, QuerySearchOffset};
use crate::store::StoreItemPart;

impl super::Executor {
    pub fn list(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
        limit: QuerySearchLimit,
        offset: QuerySearchOffset,
    ) -> Result<Vec<String>, ()> {
        // Important: acquire graph access read lock, and reference it in context. This \
        //   prevents the graph from being erased while using it in this block.
        let _fst_read_guard = self.fst_pool.lock_read_access();

        if let Ok(fst_store) = self.fst_pool.acquire(collection, bucket) {
            tracing::debug!("running list");

            return fst_store.list_words(limit as usize, offset as usize);
        }

        Err(())
    }
}

```

### Core Architecture Module: `core/src/executor/macros.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

macro_rules! executor_ensure_op {
    ($operation:expr) => {
        match $operation {
            Ok(_) => {}
            Err(err) => tracing::error!("executor operation failed: {:?}", err),
        }
    };
}

macro_rules! executor_kv_lock_read {
    ($store:ident) => {
        let kv_store_reference = $store.clone();

        let _kv_store_lock = kv_store_reference.lock.read().unwrap();
    };
}

macro_rules! executor_kv_lock_write {
    ($store:ident) => {
        let kv_store_reference = $store.clone();

        let _kv_store_lock = kv_store_reference.lock.write().unwrap();
    };
}

```

### Core Architecture Module: `core/src/executor/mod.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use std::collections::HashMap;
use std::sync::{Arc, RwLock, RwLockReadGuard};

use crate::store::kv::KvStoreId;
use crate::store::{StoreItemPart, StoreObjectIid};
use crate::util::hash::NoopU32HasherBuilder;

#[macro_use]
mod macros;
mod types;

mod count;
mod flushb;
mod flushc;
mod flusho;
mod list;
mod pop;
mod push;
mod search;
mod suggest;

pub use types::*;

pub struct Executor {
    pub app_conf: Arc<crate::Config>,
    pub kv_pool: crate::store::kv::KvStorePool,
    pub fst_pool: crate::store::fst::FstStorePool,
    pub dynamic_conf_store: Arc<DynamicConfigStore>,

    /// When using `NEW` with `PUSH`, a new IID is automatically created.
    /// However, if the input data is larger than the allowed buffer size Sonic
    /// would end up indexing the same document across multiple IIDs
    /// (see [issue #405 “Experimental flag `NEW` is incompatible with content > `buffer_size`”](https://github.com/valeriansaliou/sonic/issues/405)).
    ///
    /// To fix it, we keep track of the last “assumed new” OID and its IID so
    /// we can reuse it on subsequent `PUSH … NEW` requests.
    // NOTE: We can’t use `StoreObjectOid` as it’d not owned.
    last_assumed_new_oid: RwLock<Option<(String, StoreObjectIid)>>,
}

impl Executor {
    pub fn new(
        app_conf: Arc<crate::Config>,
        kv_pool: crate::store::kv::KvStorePool,
        fst_pool: crate::store::fst::FstStorePool,
        dynamic_conf_store: Arc<DynamicConfigStore>,
    ) -> Self {
        Self {
            app_conf,
            kv_pool,
            fst_pool,
            dynamic_conf_store,
            last_assumed_new_oid: RwLock::new(None),
        }
    }
}

impl std::fmt::Debug for Executor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // NOTE: Deconstructing to future-proof this function.
        let Self {
            kv_pool,
            fst_pool,
            dynamic_conf_store,
            last_assumed_new_oid,
            // NOTE: We don’t care about the app configuration,
            //   we can see it elsewhere if needed.
            app_conf: _app_conf,
        } = self;

        f.debug_struct("Executor")
            .field("kv_pool", kv_pool)
            .field("fst_pool", fst_pool)
            .field("dynamic_conf_store", dynamic_conf_store)
            .field("last_assumed_new_oid", last_assumed_new_oid)
            .finish_non_exhaustive()
    }
}

/// A wrapper over a `RwLock<HashMap>` that doesn’t leak private types.
#[derive(Default)]
pub struct DynamicConfigStore(RwLock<HashMap<u32, DynamicConfig, NoopU32HasherBuilder>>);

impl DynamicConfigStore {
    pub fn insert(&self, collection: StoreItemPart, config: DynamicConfig) {
        (self.0.write().unwrap()).insert(collection.into_compact(), config);
    }

    pub fn get(&self, collection: StoreItemPart) -> Option<DynamicConfig> {
        (self.0.read().unwrap())
            .get(&collection.into_compact())
            .copied()
    }

    pub fn read<'a>(&'a self) -> DynamicConfigStoreReadGuard<'a> {
        DynamicConfigStoreReadGuard(self.0.read().unwrap())
    }
}

impl std::fmt::Debug for DynamicConfigStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        use crate::util::fmt::AsPrettyRwLock;

        f.debug_tuple("DynamicConfStore")
            .field(&AsPrettyRwLock(&self.0))
            .finish()
    }
}

pub struct DynamicConfigStoreReadGuard<'a>(
    RwLockReadGuard<'a, HashMap<u32, DynamicConfig, NoopU32HasherBuilder>>,
);

impl<'a> DynamicConfigStoreReadGuard<'a> {
    pub fn iter(&self) -> impl Iterator<Item = (&u32, &DynamicConfig)> {
        self.0.iter()
    }

    pub fn get(&self, key: &u32) -> Option<&DynamicConfig> {
        self.0.get(key)
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct DynamicConfig {
    pub sonic: DynamicConfigSonic,
    pub rocksdb: DynamicConfigRocksDb,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DynamicConfigSonic {
    pub disable_janitor_tasks: Option<bool>,
    pub disable_fst_consolidate_task: Option<bool>,
    pub disable_kv_flush_task: Option<bool>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DynamicConfigRocksDb {
    pub disable_auto_compactions: Option<bool>,
    pub unordered_write: Option<bool>,
    pub memtable: Option<RocksDbMemtable>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RocksDbMemtable {
    Default,
    Vector,
}

impl Executor {
    pub fn set_dynamic_conf(
        &self,
        collection: StoreItemPart,
        new_conf: DynamicConfig,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let kv_store_id = KvStoreId::from_part(collection);

        tracing::debug!(
            ?new_conf.rocksdb,
            "Re-opening KV store connection for {kv_store_id:?} with new dynamic configuration overrides…"
        );

        let mut kv_pool_write_guard = self.kv_pool.write().unwrap();

        self.kv_pool
            .close(kv_store_id, Some(&mut kv_pool_write_guard));

        self.kv_pool
            .acquire(
                true,
                collection,
                Some(&mut kv_pool_write_guard),
                |options| {
                    let DynamicConfigRocksDb {
                        disable_auto_compactions,
                        unordered_write,
                        memtable,
                    } = &new_conf.rocksdb;

                    if let Some(disable_auto_compactions) = disable_auto_compactions {
                        options.set_disable_auto_compactions(*disable_auto_compactions);
                    }

                    if let Some(unordered_write) = unordered_write {
                        options.set_unordered_write(*unordered_write);
                    }

                    match memtable {
                        Some(RocksDbMemtable::Vector) => {
                            // Use the vector-based memtable instead of the default skiplist.
                            options.set_memtable_factory(rocksdb::MemtableFactory::Vector);

                            // Vector memtables don't support concurrent inserts, so this must be false.
                            options.set_allow_concurrent_memtable_write(false);
                        }
                        None | Some(RocksDbMemtable::Default) => {}
                    }
                },
            )
            .map_err(|()| std::io::Error::other("Error re-opening connection"))?;

        drop(kv_pool_write_guard);

        tracing::info!(
            ?new_conf.rocksdb,
            "KV store connection for {collection:?} successfully re-opened"
        );

        self.dynamic_conf_store.insert(collection, new_conf);

        Ok(())
    }
}

```

### Core Architecture Module: `core/src/executor/pop.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use linked_hash_set::LinkedHashSet;
use rocksdb::WriteBatch;
use std::iter::FromIterator;

use crate::lexer::itertools::UniqueBy;
use crate::lexer::preprocessor::{PreprocessorOutput, Token};
use crate::store::StoreItemPart;
use crate::store::{StoreObjectOid, StoreTermHash};
use crate::util::hash::NoopU32HasherBuilder;

impl super::Executor {
    pub fn pop(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
        oid: StoreObjectOid,
        input: PreprocessorOutput,
    ) -> Result<u32, ()> {
        // Important: acquire database access read lock, and reference it in context. This \
        //   prevents the database from being erased while using it in this block.
        let _kv_read_guard = self.kv_pool.lock_read_access();
        let _fst_read_guard = self.fst_pool.lock_read_access();

        if let (Ok(kv_store), Ok(fst_store)) = (
            self.kv_pool.acquire(false, collection, None, |_| {}),
            self.fst_pool.acquire(collection, bucket),
        ) {
            let Some(kv_store) = kv_store else {
                tracing::debug!(
                    "collection store does not exist, consider {bucket:?} from {collection:?} empty"
                );
                return Ok(0);
            };

            // Important: acquire bucket store write lock
            executor_kv_lock_write!(kv_store);

            let kv_action = kv_store.access_read_write(bucket);

            // Try to resolve existing OID to IID (if it does not exist, there is nothing to \
            //   be flushed)
            if let Ok(iid_value) = kv_action.get_oid_to_iid(oid) {
                let mut count_popped = 0;

                if let Some(iid) = iid_value {
                    // Try to resolve existing search terms from IID, and perform an algebraic \
                    //   AND on all popped terms to generate a list of terms to be cleaned up.
                    if let Ok(Some(iid_terms_hashes_vec)) = kv_action.get_iid_to_terms(iid) {
                        tracing::info!(
                            "got pop executor stored iid-to-terms: {:?}",
                            iid_terms_hashes_vec
                        );

                        let iid_terms_hashes: LinkedHashSet<StoreTermHash> =
                            LinkedHashSet::from_iter(iid_terms_hashes_vec.iter().copied());

                        let remaining_terms: LinkedHashSet<StoreTermHash> = iid_terms_hashes
                            .difference(&LinkedHashSet::from_iter(
                                input.tokens().map(Token::into_hash),
                            ))
                            .copied()
                            .collect();

                        tracing::debug!(
                            "got pop executor terms remaining terms: {:?} for iid: {:?}",
                            remaining_terms,
                            iid
                        );

                        count_popped = (iid_terms_hashes.len() - remaining_terms.len()) as u32;

                        if count_popped > 0 {
                            let mut batch = WriteBatch::default();

                            if remaining_terms.is_empty() {
                                tracing::info!("nuke whole bucket for pop executor");

                                // Flush bucket (batch operation, as it is shared w/ other \
                                //   executors)
                                kv_action.batch_flush_bucket(
                                    &mut batch,
                                    iid,
                                    oid,
                                    &iid_terms_hashes_vec,
                                );
                            } else {
                                tracing::info!("nuke only certain terms for pop executor");

                                let tokens = UniqueBy::new_with_hasher(
                                    input.tokens(),
                                    Token::hash,
                                    NoopU32HasherBuilder,
                                );

                                // Nuke IID in Term-to-IIDs list
                                for token in tokens {
                                    let (pop_term, pop_term_hash) =
                                        (token.as_normalized(), token.hash());

                                    // Check that term is linked to IID (and should be removed)
                                    if iid_terms_hashes.contains(&pop_term_hash) {
                                        if let Ok(Some(mut pop_term_iids)) =
                                            kv_action.get_term_to_iids(pop_term_hash)
                                        {
                                            // Remove IID from list of IIDs to be popped
                                            pop_term_iids.retain(|cur_iid| cur_iid != &iid);

                                            if pop_term_iids.is_empty() {
                                                // IIDs list was empty, delete whole key
                                                kv_action
                                                    .delete_term_to_iids(&mut batch, pop_term_hash);

                                                // Pop from FST graph (does not exist anymore)
                                                if fst_store.pop_word(pop_term) {
                                                    tracing::debug!(
                                                        "pop term hash nuked from graph: {:?}",
                                                        pop_term_hash
                                                    );
                                                }
                                            } else {
                                                // Re-build IIDs list w/o current IID
                                                kv_action.set_term_to_iids(
                                                    &mut batch,
                                                    pop_term_hash,
                                                    pop_term_iids.into_iter(),
                                                );
                                            }
                                        } else {
                                            tracing::error!(
                                                "failed getting term-to-iids in pop executor"
                                            );
                                        }
                                    }
                                }

                                // Bump IID-to-Terms list
                                let remaining_terms_vec: Vec<StoreTermHash> =
                                    Vec::from_iter(remaining_terms);

                                kv_action.set_iid_to_terms(
                                    &mut batch,
                                    iid,
                                    remaining_terms_vec.into_iter(),
                                );
                            }

                            executor_ensure_op!(kv_action.write(batch));
                        }
                    } else {
                        tracing::error!("failed getting iid-to-terms in pop executor");
                    }
                }

                return Ok(count_popped);
            }
        }

        Err(())
    }
}

```

### Core Architecture Module: `core/src/executor/push.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2019, Valerian Saliou <valerian@valeriansaliou.name>
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use rocksdb::WriteBatch;

use crate::lexer::itertools::UniqueBy;
use crate::lexer::preprocessor::{PreprocessorOutput, Token};
use crate::store::{StoreItemPart, StoreObjectOid};
use crate::util::hash::NoopU32HasherBuilder;

impl super::Executor {
    pub fn push(
        &self,
        collection: StoreItemPart,
        bucket: StoreItemPart,
        oid: StoreObjectOid,
        input: PreprocessorOutput,
        assume_new: bool,
    ) -> Result<(), ()> {
        // Important: acquire database access read lock, and reference it in context. This \
        //   prevents the database from being erased while using it in this block.
        let _kv_read_guard = self.kv_pool.lock_read_access();
        let _fst_read_guard = self.fst_pool.lock_read_access();

        let kv_store = self.kv_pool.acquire(true, collection, None, |_| {})?;
        let fst_store = self.fst_pool.acquire(collection, bucket)?;

        debug_assert!(kv_store.is_some());
        let Some(kv_store) = kv_store else {
            tracing::error!(
                "collection store {collection:?} does not exist, but it should have been created"
            );
            return Err(());
        };

        let kv_action = kv_store.access_read_write(bucket);

        let mut batch = WriteBatch::default();

        // Try to resolve existing OID to IID, otherwise initialize IID (store the \
        //   bi-directional relationship)
        let mut assign_new_iid = || {
            tracing::trace!("must initialize push executor oid-to-iid and iid-to-oid");

            // Bump last stored increment
            let iid = (kv_action.get_new_iid(&mut batch))
                .map_err(|error| tracing::error!("Error getting new IID: {error:?}"))?;

            // Associate OID <> IID (bidirectional)
            kv_action.set_oid_to_iid(&mut batch, oid, iid);
            kv_action.set_iid_to_oid(&mut batch, iid, oid);

            Ok(iid)
        };
        let mut is_new = true;
        let iid = if assume_new {
            if let Some((last_oid, iid)) = self.last_assumed_new_oid.read().unwrap().as_ref()
                && **oid == *last_oid.as_str()
            {
                is_new = false;
                *iid
            } else {
                let iid = assign_new_iid()?;

                *self.last_assumed_new_oid.write().unwrap() = Some((oid.to_string(), iid));

                iid
            }
        } else {
            match kv_action.get_oid_to_iid(oid) {
                Ok(Some(iid)) => {
                    is_new = false;
                    iid
                }
                Ok(None) => assign_new_iid()?,
                Err(error) => {
                    tracing::error!("Error getting OID-To-IID: {error:?}");
                    assign_new_iid()?
                }
            }
        };

        let mut tokens =
            UniqueBy::new_with_hasher(input.tokens(), Token::hash, NoopU32HasherBuilder);

        for token in &mut tokens {
            let term = token.as_normalized();
            let term_hash = token.hash();

            // Push to FST graph? (this consumes the term; to avoid sub-clones)
            if fst_store.push_word(&term, &self.app_conf.store.fst) {
                tracing::trace!("push term committed to graph: {}", term);
            }

            // Link IID to term
            kv_action.add_term_to_iids(&mut batch, term_hash, std::iter::once(iid));
        }

        // Link terms to IID
        if assume_new && is_new {
            kv_action.set_iid_to_terms(&mut batch, iid, tokens.seen().iter().copied());
        } else {
            kv_action.add_iid_to_terms(&mut batch, iid, tokens.seen().iter().copied());
        }

        executor_ensure_op!(kv_action.write(batch));

        Ok(())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #420** (2026-09-24): **Encode key integers as big-endian, and fix some encoding issues**
  *Symptoms*: See #417. This also contains fixes for bugs noticed along the way.

- **Issue #408** (2026-09-20): **Sonic v1.9.0 and v1.9.1: `IIDIncr` de-syncs after KV store gets closed**
  *Symptoms*: In everything I implemented in #401, it seems I made a mistake somewhere in the IID cache code and `IIDIncr` gets de-synced after a KV store gets closed and re-opened. I’ve been investigating for some time and I don’t get how that happens.  I have written a non-regression test, which I already know how to turn green, but I must first understand how the heck this happens:  ```log Executor: PUSH "docs" "default" "doc:0" "foobar 0" LANG(none) Executor: PUSH "docs" "default" "doc:1" "foobar 1" LANG(none) Executor: PUSH "docs" "default" "doc:2" "foobar 2" LANG(none) Executor: TRIGGER consolidate Executor: COUNT "docs" "default" COUNT = 3 Closed "docs" KV store Executor: QUERY "docs" "default" "foobar 2"  thread 'issue_408' (542575) panicked at core/src/executor/search.rs:500:5: 3 > 1 ```  ---  Until I release a patch (v1.9.2), I marked v1.8.1 as latest on GitHub… as it might affect users.
  **Post-Mortem & Fix Analysis**:
  > Well… I got it…  1. The `u32_max` merge operator did:     ```rust    if res > new_val {        res = new_val;    }    ```     Which is a no-op and caused `IIDIncr` to remain at `0` in DB.  2. `get_new_iid` didn’t call `get_iid_incr` to populate the cache:     ```rust    let iid = *write_guard        .entry(bucket.into_compact())        .and_modify(|iid| *iid = iid.saturating_add(1))        .or_insert(StoreObjectIid::from(0));    ```     And given that on close + re-open, the cache gets emptied, it would return `0`.     How the heck did I miss that? I was sure I had written some code to populate the cache, but I guess I got mixed up between everything I was doing in parallel at the time.  I’ll release a fix in a minute.
  > The sad thing is I couldn’t have caught this in tests, because Sonic had no way to return the number of buckets in a collection. It’s while fixing/improving `COUNT` that I uncovered this issue! Next release will contain a new `COUNT` syntax along with a fix for this bug.
  > Just found this comment in my own tests written on July 4, 2026:  ```rust let res = ingest.countb("collection", "bucket").unwrap(); // Counterintuitively, this returns the number of terms. assert_eq!(res, 4); ```  Didn’t expect it to come bite me 2 months later…

- **Issue #405** (2026-09-22): **Experimental flag `NEW` is incompatible with content > `buffer_size`**
  *Symptoms*: I just realized that the experimental `NEW` flag in `PUSH` commands has a big gotcha: if a document is longer than `buffer_size`, we end up indexing it under multiple IIDs! Thanks a big overlook from my part, I’ll have to fix it before releasing v2!  To help catch this, I’ll add a `COUNT` check at the end of our benchmarks, checking that there are as many objects as there were input documents.  It’s a huge performance gain so I won’t get rid of it, simply work around the issue using an in-memory table (suboptimal but will be an in-between).
  **Post-Mortem & Fix Analysis**:
  > First I had to fix #392, but now that it’s done I ran the `wikipedia_parallel` benchmark with my final check and here is the result:  ```log  INFO wikipedia_parallel: Ensuring documents have 1:1 matching IIDs…  thread 'main' (1054564) panicked at server/benches/wikipedia_parallel.rs:357:29: assertion `left == right` failed   left: 642265  right: 625156 ```  Turns out 17109 documents (~2.6%) are just separate chunks of existing documents…  Will fix that now, it’s important (although still experimental)

- **Issue #404** (2026-09-15): **Debian 11 release doesn’t compile: LTS ended August 31st, 2026**
  *Symptoms*: See https://www.debian.org/releases/bullseye/  It causes CD to fail: https://github.com/valeriansaliou/sonic/actions/runs/34948192111/job/104312532051
  **Post-Mortem & Fix Analysis**:
  > Ironically, the issue number is 404, and it’s caused by  ```log Err:51 http://deb.debian.org/debian-security bullseye-security/main …   404  Not Found [IP: 151.101.22.132 80] ```  😄

- **Issue #396** (2026-08-16): **v1.8.0 configuration changes are breaking**
  *Symptoms*: `v1.8.0` renamed some configuration keys, with aliases for backward compatibility. Unfortunately, I didn’t realize `serde` would fail deserializing `v1.7.x` configuration files because of default values (e.g. `max_subcompactions`) causing duplicate keys.  I’ll fix that in a minute, and add compatibility tests so we get rid of this kind of bug once and for all.  Until then, I’ll yank `v1.8.0` and release `v1.8.1` in the afternoon.
  **Post-Mortem & Fix Analysis**:
  > It’s on its way:  ```bash task test:compatibility -- -- --no-capture task: [test] cargo test --locked --no-fail-fast --test compatibility -- --no-capture    Compiling sonic-server v1.8.0 (/Users/prose/src/sonic/server)     Finished `test` profile [unoptimized + debuginfo] target(s) in 0.35s      Running tests/compatibility.rs (target/debug/deps/compatibility-dc058800c966d27a)  running 1 test Testing v1.7.0 Environment variable "SONIC_BIN" not found, using local build 2026-08-16T14:27:23.396657Z DEBUG reading config file: "/Users/prose/src/sonic/server/tests/packaged-configs/v1.7.0"  thread 'main' (1476197) panicked at server/src/config.rs:107:14: syntax error in config: duplicate field `max_subcompactions` for key `store.kv.database` note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ```

- **Issue #392** (2026-09-20): **`document_count` is incorrect after a `FLUSHO`**
  *Symptoms*: `document_count` is derived from `IIDIncr`:  ```rust let document_count = match kv_action.get_meta_to_value(StoreMetaKey::IIDIncr)? {     Some(StoreMetaValue::IIDIncr(last_iid)) => u64::from(last_iid) + 1,     None => 0, }; ```  If we remove an object (`FLUSHO`), the document count should decrease by one but `IIDIncr` does not (logically).  It’s not that big of a deal but I suggest at some point we introduce a proper atomic count.

- **Issue #389** (2026-09-20): **Reduce locks contention**
  *Symptoms*: As mentioned by @baptistejamin in #372, Sonic has plenty of useless locking which slows down ingestion.  _**Edit:** When I said “useless locking”, I mostly meant “locking for too long”. I have a feeling some locks are completely unnecessary, but most are just locked for too long and force concurrent tasks to wait for no good reason._  For example, `StoreKVPool::flush` locks the pool in write mode, while it only ever needs read access. By doing so, it prevents concurrent reads, which seem unnecessary. Every time the janitor runs, all KV reads are blocked, increasing response time for in-flight queries.  ```rust // Acquire access lock (in blocking write mode), and reference it in context // Notice: this prevents store to be acquired from any context let _access = self.store_access_lock.write().unwrap();  if let Some(store) = self.pool.read().unwrap().get(key) {   // … ```  I may have missed something and this is just one example, but it’s the kind of broad locking behavior we will get rid of.
  **Post-Mortem & Fix Analysis**:
  > I don't recall the context here, but when shipping the initial version of Sonic, locks had been specified meticulously and every time for a good reason.  Looking at my original code, acquiring write locks when listing items to flush is needed as to prevent concurrent store accesses in write mode between multiple flush operations — eg closing the RcoksDB database whilst it's being flushed on disk. The locks are always scoped to a context and released ASAP when not needed anymore (this is what I did here, that's why locks/unlocks are staged).  Write locks had only been used when strictly necessary, given the downsides. Locks are needed here to prevent race conditions between Sonic threads, at least in my implementation.  However, the `flush()` method flushes RocksDB memtables to disk. Those could be made automatic (letting RocksDB manage this on its own). But RocksDB databases are also auto-closed via `inactive_after`, so manual flush helps ensuring we flush and then close cleanly. Rocks
  > I created a playground where I tested RocksDB's behavior with parallel operations on a shared connection (what Sonic does, per collection) and I could confirm it handles race conditions internally (unless I'm mistaken). Maybe it wasn't the case years ago, but it seems most locks in the KV store aren't needed anymore (I am writing tests to check that).
  > It took me quite a while, but I now have complex parallelism tests which allowed me to detect a regression when I removed the KV locks. Looks like I was wrong and RocksDB doesn’t handle race conditions internally; it just silently accepts out of order operations and we end up with a messy index (queries work but return wrong results!).  I’ll look for the root cause this afternoon, hopefully it’s just a simple fix. Otherwise I’ll revert to our battle-tested locking mechanism, and accept the overhead (I’m sure we can remove some wait time).

- **Issue #370** (2026-07-21): **Unicode normalization**
  *Symptoms*: When diacritic folding is disabled (Sonic default), input text isn’t normalized in terms of Unicode representation. This means words like `café` can be indexed and queried differently, resulting in incorrect results. This can also cause stopwords to be missed, just because they’re represented differently.  I am already working on a fix, which will be —as always— backward compatible (i.e. no reindexing required).
  **Post-Mortem & Fix Analysis**:
  > Fixed in 678d5e1.

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

### Incident Patch 1: `85238906` (2026-10-05)
**Commit Message**: fixup! ci: Build “light” version of Sonic on server releases

**File**: `scripts/build_release_archive.sh` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ main() {
   #   (unless ran with `source`, which one shouldn’t do).
   cd "${REPOSITORY_ROOT:?}"
 
-  cargo build --target "${TARGET_TRIPLE:?}" --locked --profile "${BUILD_PROFILE:?}" $CARGO_BUILD_ARGS
+  cargo build --bin sonic --target "${TARGET_TRIPLE:?}" --locked --profile "${BUILD_PROFILE:?}" $CARGO_BUILD_ARGS
 
   rm -rf ./sonic/
   mkdir -p ./sonic
```

---

### Incident Patch 2: `cafce833` (2026-09-29)
**Commit Message**: fix(core): Fix `set_low_priority_background_threads`

**File**: `core/src/store/kv/pool.rs` (modified, +1/-1)
```diff
@@ -493,7 +493,7 @@ impl From<&KvStoreDatabaseConfig> for rocksdb::Options {
 
             // Update threads configuration otherwise RocksDB only uses 1/4 for flushes by default.
             env.set_high_priority_background_threads(*max_flushes); // HIGH pool = flushes (default)
-            env.set_low_priority_background_threads(max_subcompactions.unwrap_or(1) as i32 - max_flushes); // LOW pool = compactions (default)
+            env.set_low_priority_background_threads(max_background_jobs.map_or(1i32, |n| (n - max_flushes).max(1i32))); // LOW pool = compactions (default)
         }
 
         if_some!(db_options.set_max_background_jobs(max_background_jobs.as_ref()));
```

---

### Incident Patch 3: `890ba78a` (2026-09-30)
**Commit Message**: fix(config): Fix `unicode_normalization` deserialization

**File**: `core/src/config.rs` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ pub struct NormalizationConfig {
 }
 
 #[derive(Deserialize, Debug, Clone, Copy)]
+#[serde(rename_all = "snake_case")]
 pub enum UnicodeNormalization {
     /// Unicode Normalization Form C.
     Nfc,
```

**File**: `core/src/util/serde.rs` (modified, +2/-8)
```diff
@@ -6,7 +6,7 @@
 // License: Mozilla Public License v2.0 (MPL v2.0)
 
 pub(crate) mod none_string_as_none {
-    use serde::{Deserialize, Deserializer};
+    use serde::{Deserialize, Deserializer, de::IntoDeserializer as _};
 
     pub(crate) fn deserialize<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
     where
@@ -25,13 +25,7 @@ pub(crate) mod none_string_as_none {
         match Option::<StringOrT<T>>::deserialize(deserializer)? {
             None => Ok(None),
             Some(StringOrT::String(s)) if s.eq_ignore_ascii_case("none") => Ok(None),
-            Some(StringOrT::String(s)) => {
-                // Try to parse the string itself as T (in case T is String-like)
-                // For simple cases you may just want to error here instead.
-                Err(serde::de::Error::custom(format!(
-                    "unexpected string value: {s}"
-                )))
-            }
+            Some(StringOrT::String(s)) => T::deserialize(s.into_deserializer()).map(Some),
             Some(StringOrT::T(v)) => Ok(Some(v)),
         }
     }
```

---

### Incident Patch 4: `9c7875a0` (2026-10-05)
**Commit Message**: Merge pull request #430 from dualfroz/fix/274-backup-open-kv-store

fix(core): Make `TRIGGER backup` work while stores are in use

**File**: `core/src/store/fst/backup.rs` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ impl FstStorePool {
         // Create backup directory (full path)
         fs::create_dir_all(path)?;
 
+        // NOTE: The FST store directory gets created when the first FST is
+        //   consolidated, so there is nothing to back up until then.
+        if !self.fst_store_config.path.exists() {
+            return Ok(());
+        }
+
         // Proceed dump action (backup)
         self.dump_action(
             "backup",
```

**File**: `core/src/store/kv/backup.rs` (modified, +24/-7)
```diff
@@ -6,6 +6,7 @@
 // License: Mozilla Public License v2.0 (MPL v2.0)
 
 use std::path::Path;
+use std::sync::Arc;
 use std::{fs, io};
 
 use rocksdb::backup::{
@@ -22,6 +23,12 @@ impl KvStorePool {
         // Create backup directory (full path)
         fs::create_dir_all(path)?;
 
+        // NOTE: The KV store directory gets created when the first KV store
+        //   is opened, so there is nothing to back up until then.
+        if !self.kv_store_config.path.exists() {
+            return Ok(());
+        }
+
         // Proceed dump action (backup)
         self.dump_action(
             "backup",
@@ -97,10 +104,6 @@ impl KvStorePool {
         // Create backup folder for collection
         fs::create_dir_all(backup_path.join(collection_hash))?;
 
-        let origin_kv = self
-            .open(store_id, |_| {})
-            .map_err(|_| io::Error::other("database open failure"))?;
-
         // Initialize KV database backup engine
         let kv_backup_options = DBBackupEngineOptions::new(&kv_backup_path)
             .map_err(|_| io::Error::other("backup engine options acquire failure"))?;
@@ -111,9 +114,23 @@ impl KvStorePool {
             .map_err(|_| io::Error::other("backup engine failure"))?;
 
         // Proceed actual KV database backup
-        kv_backup_engine
-            .create_new_backup(&origin_kv)
-            .map_err(|_| io::Error::other("database backup failure"))?;
+        // NOTE: RocksDB refuses to open a database which is already open in
+        //   this process (its `LOCK` file is held), so back up the pooled
+        //   store if there is one. Flush it first, as its memtables may hold
+        //   writes not persisted yet (e.g. if the write-ahead log is disabled).
+        let pooled_store = self.read().unwrap().get(&store_id).map(Arc::clone);
+
+        match pooled_store {
+            Some(store) => kv_backup_engine.create_new_backup_flush(&store.database, true),
+            None => {
+                let origin_kv = self
+                    .open(store_id, |_| {})
+                    .map_err(|_| io::Error::other("database open failure"))?;
+
+                kv_backup_engine.create_new_backup(&origin_kv)
+            }
+        }
+        .map_err(|_| io::Error::other("database backup failure"))?;
 
         tracing::info!("kv store {store_id} backed up to path: {kv_backup_path:?}");
 
```

**File**: `server/tests/control_trigger.rs` (modified, +45/-2)
```diff
@@ -41,9 +41,52 @@ fn trigger_consolidate() {
 }
 
 #[test]
-#[ignore = "Not supported by sonic_client yet (FIXME)"]
 fn trigger_backup() {
-    todo!()
+    let ctx = start_empty(|command| {
+        command
+            .env("SONIC_STORE__FST__GRAPH__CONSOLIDATE_AFTER", "3600")
+            .env("SONIC_STORE__FST__POOL__INACTIVE_AFTER", "3700")
+            .env("SONIC_STORE__KV__DATABASE__FLUSH_AFTER", "3600")
+            .env("SONIC_STORE__KV__POOL__INACTIVE_AFTER", "3700")
+    });
+
+    let multiplexer = SonicMultiplexer::new().unwrap();
+
+    let ingest =
+        SonicChannelIngestBlocking::connect(ctx.addr, "SecretPassword", &multiplexer).unwrap();
+    let control =
+        SonicChannelControlBlocking::connect(ctx.addr, "SecretPassword", &multiplexer).unwrap();
+
+    let backup_path = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"))
+        .join("test-backups")
+        .join(ctx.id.to_string());
+    if backup_path.exists() {
+        std::fs::remove_dir_all(&backup_path).unwrap();
+    }
+
+    // NOTE: Nothing was pushed yet, so the store directories do not exist.
+    () = control
+        .trigger_backup(backup_path.to_str().unwrap())
+        .unwrap();
+
+    // NOTE: Pushing opens the KV store, which then stays open in the pool
+    //   while the backup runs, and leaves the FST changes pending.
+    ingest
+        .push("collection", "bucket", "object", "foo bar")
+        .unwrap();
+
+    () = control
+        .trigger_backup(backup_path.to_str().unwrap())
+        .unwrap();
+
+    let kv_backups = std::fs::read_dir(backup_path.join("kv"))
+        .unwrap()
+        .map(|entry| entry.unwrap().path())
+        .collect::<Vec<_>>();
+    assert_eq!(kv_backups.len(), 1);
+    assert!(std::fs::read_dir(&kv_backups[0]).unwrap().next().is_some());
+
+    std::fs::remove_dir_all(&backup_path).unwrap();
 }
 
 #[test]
```

---

### Incident Patch 5: `fd6c8ae8` (2026-10-05)
**Commit Message**: Merge pull request #432 from dualfroz/fix/fst-backup-bucket-entry

fix(core): Back up and restore FST buckets again

**File**: `core/src/store/fst/backup.rs` (modified, +2/-2)
```diff
@@ -88,7 +88,7 @@ impl FstStorePool {
                 let bucket_entry = bucket_entry?;
 
                 // Actual bucket found?
-                let file_type = collection_entry.file_type()?;
+                let file_type = bucket_entry.file_type()?;
                 if !file_type.is_file() {
                     tracing::trace!(
                         ?file_type,
@@ -97,7 +97,7 @@ impl FstStorePool {
                     continue 'buckets;
                 }
 
-                let file_name = collection_entry.file_name();
+                let file_name = bucket_entry.file_name();
                 let Some(bucket_file_name) = file_name.to_str() else {
                     tracing::warn!(
                         file_name_bytes = ?file_name.as_encoded_bytes(),
```

**File**: `core/tests/data_backup.rs` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+// Sonic
+//
+// Fast, lightweight and schema-less search backend
+// Copyright: 2026, DualFroz <me@dualfroz.com>
+// License: Mozilla Public License v2.0 (MPL v2.0)
+
+//! Feature: Data backup
+
+mod common;
+
+use crate::common::util::unique_hex;
+use crate::common::*;
+
+/// Consolidated FST stores are backed up, and can be restored.
+#[test]
+fn test_fst_backup_and_restore() {
+    init_logging();
+    let executor = make_test_executor(|_| {});
+
+    exec!(executor -> PUSH "messages" "user:1" "chat:1" "Hello world");
+    exec!(executor -> TRIGGER consolidate);
+
+    let backup_path = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"))
+        .join(unique_hex().unwrap())
+        .join("fst-backup");
+
+    executor.fst_pool.backup(&backup_path).unwrap();
+
+    let backup_files = std::fs::read_dir(&backup_path)
+        .unwrap()
+        .flat_map(|collection| std::fs::read_dir(collection.unwrap().path()).unwrap())
+        .map(|bucket| bucket.unwrap().path())
+        .collect::<Vec<_>>();
+    assert_eq!(backup_files.len(), 1, "got: {backup_files:?}");
+    assert!(
+        backup_files[0].to_string_lossy().ends_with(".fst.bck"),
+        "got: {backup_files:?}"
+    );
+
+    let restored_executor = make_test_executor(|_| {});
+
+    restored_executor.fst_pool.restore(&backup_path).unwrap();
+
+    let response = exec!(restored_executor -> LIST "messages" "user:1");
+    assert_contains!(response, ["hello", "world"]);
+}
```

---

### Incident Patch 6: `9fc76b23` (2026-10-05)
**Commit Message**: Merge pull request #431 from dualfroz/fix/319-document-name-limits

docs: Document the 128 characters limit on collection, bucket and object names

**File**: `PROTOCOL.md` (modified, +6/-5)
```diff
@@ -18,6 +18,7 @@ _Refer to sections below to interact with Sonic._
 
 1. Each command sent must be terminated with a new line character (`\n`) as to commit the command to the server;
 2. Upon starting a Sonic Channel session, your library should read the `buffer(20000)` parameter in the `STARTED` response, and use this value (in bytes) as to know when a command data should be truncated and split in multiple sub-commands (to avoid buffer overflows, ie. sending too much data in a single command);
+3. The `<collection>`, `<bucket>` and `<object>` values of any command must be 1 to 128 ASCII characters long, otherwise the command is rejected with `ERR invalid_argument(InvalidCollection)`, `ERR invalid_argument(InvalidBucket)` or `ERR invalid_argument(InvalidObject)`;
 
 ---
 
@@ -44,8 +45,8 @@ _The Sonic Channel Search mode is used for querying the search index. Once in th
 
 **⏩ Syntax terminology:**
 
-* `<collection>`: index collection (ie. what you search in, eg. `messages`, `products`, etc.);
-* `<bucket>`: index bucket name (ie. user-specific search classifier in the collection if you have any eg. `user-1, user-2, ..`, otherwise use a common bucket name eg. `generic, default, common, ..`);
+* `<collection>`: index collection (ie. what you search in, eg. `messages`, `products`, etc.), 1 to 128 ASCII characters long;
+* `<bucket>`: index bucket name (ie. user-specific search classifier in the collection if you have any eg. `user-1, user-2, ..`, otherwise use a common bucket name eg. `generic, default, common, ..`), 1 to 128 ASCII characters long;
 * `<terms>`: text for search terms (between quotes);
 * `<count>`: a positive integer number; set within allowed maximum & minimum limits;
 * `<locale>`: an ISO 639-3 locale code eg. `eng` for English (if set, the locale must be a valid ISO 639-3 code; if set to `none`, lexing will be disabled; if not set, the locale will be guessed from text);
@@ -120,9 +121,9 @@ Note that Sonic doesn’t provide an `UPDATE` command, because of the lossy natu
 
 **⏩ Syntax terminology:**
 
-* `<collection>`: index collection (ie. what you search in, eg. `messages`, `products`, etc.);
-* `<bucket>`: index bucket name (ie. user-specific search classifier in the collection if you have any eg. `user-1, user-2, ..`, otherwise use a common bucket name eg. `generic, default, common, ..`);
-* `<object>`: object identifier that refers to an entity in an external database, where the searched object is stored (eg. you use Sonic to index CRM contacts by name; full CRM contact data is stored in a MySQL database; in this case the object identifier in Sonic will be the MySQL primary key for the CRM contact);
+* `<collection>`: index collection (ie. what you search in, eg. `messages`, `products`, etc.), 1 to 128 ASCII characters long;
+* `<bucket>`: index bucket name (ie. user-specific search classifier in the collection if you have any eg. `user-1, user-2, ..`, otherwise use a common bucket name eg. `generic, default, common, ..`), 1 to 128 ASCII characters long;
+* `<object>`: object identifier that refers to an entity in an external database, where the searched object is stored (eg. you use Sonic to index CRM contacts by name; full CRM contact data is stored in a MySQL database; in this case the object identifier in Sonic will be the MySQL primary key for the CRM contact), 1 to 128 ASCII characters long;
 * `<text>`: search text to be indexed (can be a single word, or a longer text; within maximum length safety limits; should be quoted using `"` quotes; internal quotes should be escaped using `\"`);
 * `<locale>`: an ISO 639-3 locale code eg. `eng` for English (if set, the locale must be a valid ISO 639-3 code; if set to `none`, lexing will be disabled; if not set, the locale will be guessed from text);
 * `<manual>`: help manual to be shown (available manuals: `commands`);
```

---

### Incident Patch 7: `31b01504` (2026-10-03)
**Commit Message**: fix(core): Back up and restore FST buckets again

Since 27a1b2b ("chore(core): Flatten FST store code"), the bucket loop in
`FstStorePool::dump_action` checked the type and name of the collection
entry instead of the bucket entry. As a collection is a directory, every
bucket was skipped: `TRIGGER backup` answered `OK` but wrote no FST, and
`TRIGGER restore` restored none.

Add a test which backs up a consolidated FST and restores it.

**File**: `core/src/store/fst/backup.rs` (modified, +2/-2)
```diff
@@ -88,7 +88,7 @@ impl FstStorePool {
                 let bucket_entry = bucket_entry?;
 
                 // Actual bucket found?
-                let file_type = collection_entry.file_type()?;
+                let file_type = bucket_entry.file_type()?;
                 if !file_type.is_file() {
                     tracing::trace!(
                         ?file_type,
@@ -97,7 +97,7 @@ impl FstStorePool {
                     continue 'buckets;
                 }
 
-                let file_name = collection_entry.file_name();
+                let file_name = bucket_entry.file_name();
                 let Some(bucket_file_name) = file_name.to_str() else {
                     tracing::warn!(
                         file_name_bytes = ?file_name.as_encoded_bytes(),
```

**File**: `core/tests/data_backup.rs` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+// Sonic
+//
+// Fast, lightweight and schema-less search backend
+// Copyright: 2026, DualFroz <me@dualfroz.com>
+// License: Mozilla Public License v2.0 (MPL v2.0)
+
+//! Feature: Data backup
+
+mod common;
+
+use crate::common::util::unique_hex;
+use crate::common::*;
+
+/// Consolidated FST stores are backed up, and can be restored.
+#[test]
+fn test_fst_backup_and_restore() {
+    init_logging();
+    let executor = make_test_executor(|_| {});
+
+    exec!(executor -> PUSH "messages" "user:1" "chat:1" "Hello world");
+    exec!(executor -> TRIGGER consolidate);
+
+    let backup_path = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"))
+        .join(unique_hex().unwrap())
+        .join("fst-backup");
+
+    executor.fst_pool.backup(&backup_path).unwrap();
+
+    let backup_files = std::fs::read_dir(&backup_path)
+        .unwrap()
+        .flat_map(|collection| std::fs::read_dir(collection.unwrap().path()).unwrap())
+        .map(|bucket| bucket.unwrap().path())
+        .collect::<Vec<_>>();
+    assert_eq!(backup_files.len(), 1, "got: {backup_files:?}");
+    assert!(
+        backup_files[0].to_string_lossy().ends_with(".fst.bck"),
+        "got: {backup_files:?}"
+    );
+
+    let restored_executor = make_test_executor(|_| {});
+
+    restored_executor.fst_pool.restore(&backup_path).unwrap();
+
+    let response = exec!(restored_executor -> LIST "messages" "user:1");
+    assert_contains!(response, ["hello", "world"]);
+}
```

---

### Incident Patch 8: `6afa0bb3` (2026-10-03)
**Commit Message**: fix(core): Make `TRIGGER backup` work while stores are in use

`TRIGGER backup` answered `ERR internal_error` in two common cases:

- a KV store was open in the pool (e.g. right after a `PUSH`): the backup
  opened the database a second time, which RocksDB refuses as its `LOCK`
  file is held. The pooled store is now backed up instead, after a flush.
- the KV or FST store directory did not exist yet (nothing ingested, or
  nothing consolidated yet): listing it failed. There is nothing to back up
  in that case.

Also enable the `trigger_backup` test, which covers both cases.

Fixes #274

**File**: `core/src/store/fst/backup.rs` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ impl FstStorePool {
         // Create backup directory (full path)
         fs::create_dir_all(path)?;
 
+        // NOTE: The FST store directory gets created when the first FST is
+        //   consolidated, so there is nothing to back up until then.
+        if !self.fst_store_config.path.exists() {
+            return Ok(());
+        }
+
         // Proceed dump action (backup)
         self.dump_action(
             "backup",
```

**File**: `core/src/store/kv/backup.rs` (modified, +24/-7)
```diff
@@ -6,6 +6,7 @@
 // License: Mozilla Public License v2.0 (MPL v2.0)
 
 use std::path::Path;
+use std::sync::Arc;
 use std::{fs, io};
 
 use rocksdb::backup::{
@@ -22,6 +23,12 @@ impl KvStorePool {
         // Create backup directory (full path)
         fs::create_dir_all(path)?;
 
+        // NOTE: The KV store directory gets created when the first KV store
+        //   is opened, so there is nothing to back up until then.
+        if !self.kv_store_config.path.exists() {
+            return Ok(());
+        }
+
         // Proceed dump action (backup)
         self.dump_action(
             "backup",
@@ -97,10 +104,6 @@ impl KvStorePool {
         // Create backup folder for collection
         fs::create_dir_all(backup_path.join(collection_hash))?;
 
-        let origin_kv = self
-            .open(store_id, |_| {})
-            .map_err(|_| io::Error::other("database open failure"))?;
-
         // Initialize KV database backup engine
         let kv_backup_options = DBBackupEngineOptions::new(&kv_backup_path)
             .map_err(|_| io::Error::other("backup engine options acquire failure"))?;
@@ -111,9 +114,23 @@ impl KvStorePool {
             .map_err(|_| io::Error::other("backup engine failure"))?;
 
         // Proceed actual KV database backup
-        kv_backup_engine
-            .create_new_backup(&origin_kv)
-            .map_err(|_| io::Error::other("database backup failure"))?;
+        // NOTE: RocksDB refuses to open a database which is already open in
+        //   this process (its `LOCK` file is held), so back up the pooled
+        //   store if there is one. Flush it first, as its memtables may hold
+        //   writes not persisted yet (e.g. if the write-ahead log is disabled).
+        let pooled_store = self.read().unwrap().get(&store_id).map(Arc::clone);
+
+        match pooled_store {
+            Some(store) => kv_backup_engine.create_new_backup_flush(&store.database, true),
+            None => {
+                let origin_kv = self
+                    .open(store_id, |_| {})
+                    .map_err(|_| io::Error::other("database open failure"))?;
+
+                kv_backup_engine.create_new_backup(&origin_kv)
+            }
+        }
+        .map_err(|_| io::Error::other("database backup failure"))?;
 
         tracing::info!("kv store {store_id} backed up to path: {kv_backup_path:?}");
 
```

**File**: `server/tests/control_trigger.rs` (modified, +45/-2)
```diff
@@ -41,9 +41,52 @@ fn trigger_consolidate() {
 }
 
 #[test]
-#[ignore = "Not supported by sonic_client yet (FIXME)"]
 fn trigger_backup() {
-    todo!()
+    let ctx = start_empty(|command| {
+        command
+            .env("SONIC_STORE__FST__GRAPH__CONSOLIDATE_AFTER", "3600")
+            .env("SONIC_STORE__FST__POOL__INACTIVE_AFTER", "3700")
+            .env("SONIC_STORE__KV__DATABASE__FLUSH_AFTER", "3600")
+            .env("SONIC_STORE__KV__POOL__INACTIVE_AFTER", "3700")
+    });
+
+    let multiplexer = SonicMultiplexer::new().unwrap();
+
+    let ingest =
+        SonicChannelIngestBlocking::connect(ctx.addr, "SecretPassword", &multiplexer).unwrap();
+    let control =
+        SonicChannelControlBlocking::connect(ctx.addr, "SecretPassword", &multiplexer).unwrap();
+
+    let backup_path = std::path::Path::new(env!("CARGO_TARGET_TMPDIR"))
+        .join("test-backups")
+        .join(ctx.id.to_string());
+    if backup_path.exists() {
+        std::fs::remove_dir_all(&backup_path).unwrap();
+    }
+
+    // NOTE: Nothing was pushed yet, so the store directories do not exist.
+    () = control
+        .trigger_backup(backup_path.to_str().unwrap())
+        .unwrap();
+
+    // NOTE: Pushing opens the KV store, which then stays open in the pool
+    //   while the backup runs, and leaves the FST changes pending.
+    ingest
+        .push("collection", "bucket", "object", "foo bar")
+        .unwrap();
+
+    () = control
+        .trigger_backup(backup_path.to_str().unwrap())
+        .unwrap();
+
+    let kv_backups = std::fs::read_dir(backup_path.join("kv"))
+        .unwrap()
+        .map(|entry| entry.unwrap().path())
+        .collect::<Vec<_>>();
+    assert_eq!(kv_backups.len(), 1);
+    assert!(std::fs::read_dir(&kv_backups[0]).unwrap().next().is_some());
+
+    std::fs::remove_dir_all(&backup_path).unwrap();
 }
 
 #[test]
```

---

### Incident Patch 9: `54d43044` (2026-10-03)
**Commit Message**: fix(core): Remove debug logs

I thought I had removed that wow. Will definitely have to add a CI check
for such mistake!

**File**: `core/src/store/kv/util.rs` (modified, +0/-8)
```diff
@@ -210,24 +210,16 @@ fn i32_counter(existing_val: Option<&[u8]>, operands: &rocksdb::MergeOperands) -
         None if operands.is_empty() => return None,
         None => 0,
     };
-    if existing_val.is_some() {
-        eprint!("i32_counter(Some({res}), ");
-    } else {
-        eprint!("i32_counter(None, ");
-    }
 
     for op in operands {
         for chunk in op.chunks(4) {
             // SAFETY: `chunk` is guaranteed to be 4 bytes long.
             let diff = i32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
 
             res = res.saturating_add(diff);
-            eprint!("{diff},");
         }
     }
 
-    eprintln!(")={res}");
-
     Some(res.to_le_bytes().to_vec())
 }
 
```

---

### Incident Patch 10: `33acc004` (2026-10-01)
**Commit Message**: ci: Build “light” version of Sonic on server releases

Sonic “light” only has `allocator-jemalloc` enabled. All other features
(e.g. `tokenizer-chinese`, `stemming`).

A quick test locally showed a 20% reduction in binary size.

**File**: `.github/workflows/release-server.yml` (modified, +9/-0)
```diff
@@ -98,6 +98,12 @@ jobs:
             target_platform: gnu
             target_triple: x86_64-unknown-linux-gnu
             container: debian:bookworm
+          - target_arch: x86_64
+            target_platform: gnu
+            target_triple: x86_64-unknown-linux-gnu
+            container: debian:bookworm
+            build_args: --no-default-features -F allocator-jemalloc
+            variant: light
           - target_arch: x86_64
             target_platform: rhel9
             target_triple: x86_64-unknown-linux-gnu
@@ -186,6 +192,9 @@ jobs:
       - id: build_archive
         name: Build and archive binary
         run: ./scripts/build_release_archive.sh ${{ matrix.target_arch }} ${{ matrix.target_platform }} ${{ matrix.target_triple }}
+        env:
+          CARGO_BUILD_ARGS: ${{ matrix.build_args }}
+          SONIC_VARIANT: ${{ matrix.variant }}
 
       - name: Publish archive in GitHub release
         if: github.ref_type == 'tag' || github.ref == 'refs/heads/master'
```

**File**: `scripts/build_release_archive.sh` (modified, +2/-2)
```diff
@@ -107,14 +107,14 @@ main() {
   #   (unless ran with `source`, which one shouldn’t do).
   cd "${REPOSITORY_ROOT:?}"
 
-  cargo build --target "${TARGET_TRIPLE:?}" --locked --profile "${BUILD_PROFILE:?}"
+  cargo build --target "${TARGET_TRIPLE:?}" --locked --profile "${BUILD_PROFILE:?}" $CARGO_BUILD_ARGS
 
   rm -rf ./sonic/
   mkdir -p ./sonic
   cp -p "target/${TARGET_TRIPLE:?}/${BUILD_PROFILE:?}/sonic" ./sonic/
   cp -r ./config.cfg sonic/
 
-  local final_tar="v${SERVER_VERSION:?}-${TARGET_ARCH:?}-${TARGET_PLATFORM:?}.tar.gz"
+  local final_tar="v${SERVER_VERSION:?}-${TARGET_ARCH:?}-${TARGET_PLATFORM:?}${SONIC_VARIANT:+"-${SONIC_VARIANT:?}"}.tar.gz"
   tar --owner=0 --group=0 -czvf "${final_tar:?}" ./sonic
   rm -r ./sonic/
 
```

---

### Incident Patch 11: `215f21cf` (2026-09-30)
**Commit Message**: chore(core): Fix comment in `Token` struct

**File**: `core/src/lexer/token.rs` (modified, +1/-1)
```diff
@@ -592,7 +592,7 @@ pub mod preprocessor {
         /// Start index (byte) in original text.
         pub(super) start: usize,
 
-        /// Start index (byte) in original text.
+        /// End index (byte) in original text (exclusive).
         pub(super) end: usize,
 
         /// Index of the token in the tokenized text (stopwords included).
```

---

### Incident Patch 12: `0e1a2ce1` (2026-09-25)
**Commit Message**: fix(core): Clear `IIDIncr` from cache during a `FLUSHO`

**File**: `core/src/store/kv/mod.rs` (modified, +2/-0)
```diff
@@ -793,6 +793,8 @@ impl<'a> KvStoreActionReadWrite<'a> {
             tracing::debug!("succeeded in store batch erase bucket: {bucket}");
         }
 
+        (self.store.iid_incr_per_bucket.write().unwrap()).remove(&bucket.into_compact());
+
         tracing::info!("done processing store batch erase bucket: {bucket}");
 
         Ok(1)
```

---

### Incident Patch 13: `6902b0e9` (2026-09-25)
**Commit Message**: fix(core): Fix object counter on big-endian platforms and after batch ingest

**File**: `core/src/store/kv/mod.rs` (modified, +56/-16)
```diff
@@ -163,7 +163,12 @@ impl KvStore {
                                 .is_ok_and(|opt| opt.is_none())
                             {
                                 self.database
-                                    .put(object_count_key, iid_incr.into_bytes())
+                                    .put(
+                                        object_count_key,
+                                        i32::try_from(u32::from(iid_incr))
+                                            .unwrap_or(i32::MAX)
+                                            .to_le_bytes(),
+                                    )
                                     .unwrap_or_else(|error| {
                                         tracing::error!(
                                             "Could not backfill ObjectCount from IIDIncr: {error:?}"
@@ -255,25 +260,62 @@ impl<'a> KvStoreActionReadOnly<'a> {
         }
     }
 
+    /// Note that because of the underlying use of `i32`, the max value is
+    /// `i32::MAX` (hence `u32::MAX / 2`).
     pub fn get_object_count(&self) -> Result<u32, Box<dyn std::error::Error>> {
         let bucket = self.bucket;
 
         let store_key = KvStoreKey::meta_to_value(&bucket, &StoreMetaKey::ObjectCount);
-        let value = self.store.database.get(store_key)?;
+        let value = self.store.database.get(&store_key)?;
+
+        let get_iid_incr_fallback = || {
+            self.store
+                .get_iid_incr(&bucket, &self.store.iid_incr_per_bucket.read().unwrap())
+                .map(|opt| opt.map_or(0, |n| u32::from(n).saturating_add(1)))
+        };
 
         match value {
-            Some(bytes) => match decode_u32_mapped(&bytes) {
-                Ok(count) => {
-                    tracing::debug!(?bucket, ?count, "Read ObjectCount from database");
-                    Ok(count)
+            Some(bytes) if bytes.len() == 4 => {
+                // SAFETY: `bytes` is guaranteed to be 4 bytes long.
+                let count = i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
+
+                tracing::debug!(?bucket, ?count, "Read ObjectCount from database");
+
+                // FIX: In Sonic v1.10.0, singed counters used to be stored
+                //   unsigned. In itself it wasn’t a problem, but because of
+                //   how RocksDB merges operations, huge batches would cause
+                //   partial counters to be mis-interpreted, yielding a final
+                //   sum that’s far off. We can fix it by checking whether
+                //   `ObjectCount` is negative or bigger than `IIDIncr + 1`.
+                let iid_incr_fallback = get_iid_incr_fallback()?;
+                if (count < 0) || (count as u32 > iid_incr_fallback) {
+                    // Fix stored `ObjectCount` once (issue won’t reappear).
+                    self.store.database.put(
+                        &store_key,
+                        i32::try_from(iid_incr_fallback)
+                            .unwrap_or(i32::MAX)
+                            .to_le_bytes(),
+                    )?;
+                    tracing::debug!(
+                        ?bucket,
+                        "Fixed ObjectCount in database, falling back to IIDIncr (only this time)"
+                    );
+                    return Ok(iid_incr_fallback);
                 }
-                Err(()) => {
-                    tracing::error!(?bucket, "Invalid ObjectCount in database");
-                    Err(Box::new(io::Error::other(
-                        "Invalid ObjectCount value in bucket {bucket:?}",
-                    )))
+
+                match u32::try_from(count) {
+                    Ok(count) => Ok(count),
+                    Err(error) => Err(Box::new(io::Error::other(format!(
+                        "Invalid ObjectCount value in bucket {bucket:?}: {error:?}",
+                    )))),
                 }
-            },
+            }
+            Some(_bytes) => {
+                tracing::error!(?bucket, "Invalid ObjectCount in database");
+                Err(Box::new(io::Error::other(
+                    "Invalid ObjectCount value in bucket {bucket:?}",
+                )))
+            }
             None => {
                 tracing::debug!(
                     ?bucket,
@@ -282,9 +324,7 @@ impl<'a> KvStoreActionReadOnly<'a> {
 
                 // COMPAT: Fallback to `IIDIncr` for users migrating from an older version.
                 // TODO(major): Remove compat fallback.
-                self.store
-                    .get_iid_incr(&bucket, &self.store.iid_incr_per_bucket.read().unwrap())
-                    .map(|opt| opt.map_or(0, u32::from))
+                get_iid_incr_fallback()
             }
         }
     }
@@ -473,7 +513,7 @@ impl<'a> KvStoreActionReadWrite<'a> {
             &self.bucket
         );
 
-        batch.merge(store_key, diff.to_ne_bytes());
+        batch.merge(store_key, diff.to_le_bytes());
     }
 
     pub fn get_new_iid(
```

**File**: `core/src/store/kv/util.rs` (modified, +25/-19)
```diff
@@ -87,7 +87,7 @@ pub(super) fn default_merge_operator(
         META_TO_VALUE => match &key[5..9] {
             v if v == encode_u32(StoreMetaKey::IIDIncr.as_u32()) => u32_max(existing_val, operands),
             v if v == encode_u32(StoreMetaKey::ObjectCount.as_u32()) => {
-                u32_counter_signed(existing_val, operands)
+                i32_counter(existing_val, operands)
             }
             _ => None,
         },
@@ -187,42 +187,48 @@ fn u32_max(existing_val: Option<&[u8]>, operands: &rocksdb::MergeOperands) -> Op
     Some(encode_u32(res).to_vec())
 }
 
-/// This implements a counter.
+/// This implements a counter (as `i32`).
 ///
 /// It’s used for `ObjectCount`, where we have to add **and remove** `1`.
 ///
-/// The accumulator is a `u32`, but because we want the counter to go both ways
-/// we have to pass signed values. By having this mix of types, we do not create
-/// a discrepancy between `ObjectCount`’s maximum value and that of `IIDIncr`.
-fn u32_counter_signed(
-    existing_val: Option<&[u8]>,
-    operands: &rocksdb::MergeOperands,
-) -> Option<Vec<u8>> {
+/// We can’t keep `u32` as value space, because of how operands are merged
+/// together. If we used a `u32` accumulator and `i32` operands, the last merge
+/// operation would yield incorrect results. On `n` iterations, `existing_val`
+/// would be `None` and `operands` filled with `i32` values. Those values would
+/// be merged into `0u32` and returned as a `u32` counter. On last iteration,
+/// all `n` intermediate counters would be passed as operands, and we’d have no
+/// way to know that they’re now encoded as `u32`. In addition, if one merge
+/// operation gets `(None, [-1, -1])` and another `(None, [1, 1, 1])`, the
+/// final counter value would be `3`; which is incorrect (expected: `1`).
+fn i32_counter(existing_val: Option<&[u8]>, operands: &rocksdb::MergeOperands) -> Option<Vec<u8>> {
     let mut res = match existing_val {
         Some(bytes) if bytes.len() == 4 => {
             // SAFETY: `bytes` is guaranteed to be 4 bytes long.
-            decode_u32(bytes).unwrap()
+            i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
         }
-        Some(_) => panic!("u32_counter_signed: initial value isn’t a u32"),
+        Some(_) => panic!("i32_counter: initial value isn’t a u32"),
         None if operands.is_empty() => return None,
         None => 0,
     };
+    if existing_val.is_some() {
+        eprint!("i32_counter(Some({res}), ");
+    } else {
+        eprint!("i32_counter(None, ");
+    }
 
     for op in operands {
         for chunk in op.chunks(4) {
             // SAFETY: `chunk` is guaranteed to be 4 bytes long.
-            let diff = i32::from_ne_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
+            let diff = i32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
 
-            if diff > 0 {
-                res = res.saturating_add(diff as u32);
-            } else if diff < 0 {
-                debug_assert_ne!(res, 0);
-                res = res.saturating_sub(diff.unsigned_abs());
-            }
+            res = res.saturating_add(diff);
+            eprint!("{diff},");
         }
     }
 
-    Some(encode_u32(res).to_vec())
+    eprintln!(")={res}");
+
+    Some(res.to_le_bytes().to_vec())
 }
 
 #[cfg(test)]
```

---

### Incident Patch 14: `98726dc9` (2026-09-25)
**Commit Message**: Merge pull request #424 from Theryston/fix/core-cjk-byte-offsets

fix(core): use byte offsets in CJK tokenizer

**File**: `core/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@
 <!-- WARN: Do not move the next line and add changelog entries **under** it.
        It’s used by `task release:*` when updating the changelog. -->
 [Unreleased]: https://github.com/valeriansaliou/sonic/compare/core-v0.4.0...HEAD
+### Bug Fixes
+
+* Fix panic on Chinese text (`start byte index … is not a char boundary`): use `jieba_rs::Token::byte_start` (byte offset) instead of `start` (Unicode offset) in `Tokenizer::tokenize`. Also use `lindera` `Token::byte_start` instead of the removed `token_start` field.
 
 ## [0.4.0] (2026-09-21)
 
```

**File**: `core/src/lexer/token.rs` (modified, +52/-2)
```diff
@@ -702,14 +702,14 @@ pub mod lexing {
                     TOKENIZER_JIEBA
                         .cut(text, false)
                         .into_iter()
-                        .map(|token| (token.start, token.word)),
+                        .map(|token| (token.byte_start, token.word)),
                 ),
                 #[cfg(feature = "tokenizer-japanese")]
                 Some(Lang::Jpn) => match TOKENIZER_LINDERA.tokenize(text) {
                     Ok(tokens) => Box::from(
                         tokens
                             .into_iter()
-                            .map(|token| (token.token_start, token.text)),
+                            .map(|token| (token.byte_start, token.text)),
                     ),
                     Err(err) => {
                         tracing::warn!("unable to tokenize japanese, falling back: {}", err);
@@ -766,6 +766,56 @@ pub mod lexing {
         );
     }
 
+    #[cfg(feature = "tokenizer-chinese")]
+    #[test]
+    fn test_tokenizer_cmn_yields_byte_offsets() {
+        let tokenizer = Tokenizer {
+            lang: Some(Lang::Cmn),
+        };
+
+        // `jieba_rs::Token::start` is a Unicode (char) offset, but the lexer
+        // expects byte offsets. Mixing them up panics on multi-byte text
+        // (`start byte index 2 is not a char boundary`, inside '维').
+        assert_eq!(
+            tokenizer.tokenize("我来到北京清华大学").collect::<Vec<_>>(),
+            [(0, "我"), (3, "来到"), (9, "北京"), (15, "清华大学")],
+        );
+    }
+
+    #[cfg(feature = "tokenizer-chinese")]
+    #[test]
+    fn test_preprocessor_cmn_tokens_have_valid_ranges() {
+        use super::preprocessor::Preprocessor;
+
+        let mut preprocessor = Preprocessor::default();
+        preprocessor.detect_stopwords = false;
+        preprocessor.filter_stopwords = false;
+
+        let text = "我来到北京清华大学";
+        let output = preprocessor.preprocess(text, Some(Lang::Cmn));
+
+        // Iterating slices the original text by token ranges; wrong offsets
+        // panic here instead of yielding garbage.
+        assert_eq!(
+            output
+                .tokens()
+                .map(|token| {
+                    assert!(text.is_char_boundary(token.start));
+                    assert!(text.is_char_boundary(token.end));
+                    assert_eq!(&text[token.start..token.end], token.as_original());
+
+                    (token.as_original().to_owned(), token.start, token.end)
+                })
+                .collect::<Vec<_>>(),
+            [
+                ("我".to_owned(), 0, 3),
+                ("来到".to_owned(), 3, 9),
+                ("北京".to_owned(), 9, 15),
+                ("清华大学".to_owned(), 15, 27),
+            ]
+        );
+    }
+
     #[cfg(feature = "tokenizer-japanese")]
     #[test]
     fn test_tokenizer_jpn() {
```

---

### Incident Patch 15: `638d3101` (2026-09-25)
**Commit Message**: fix(core): use byte offsets in CJK tokenizer

jieba_rs::Token::start is a Unicode (char) offset, but
Tokenizer::tokenize feeds it to byte slicing in TokensIter,
panicking on multi-byte text ('start byte index 2 is not a
char boundary', inside '维'). Use byte_start instead. Same
fix on the lindera path (byte_start instead of token_start).

Adds regression tests asserting byte offsets for
'我来到北京清华大学' and valid char-boundary ranges from
Preprocessor::preprocess with Lang::Cmn.

**File**: `core/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@
 <!-- WARN: Do not move the next line and add changelog entries **under** it.
        It’s used by `task release:*` when updating the changelog. -->
 [Unreleased]: https://github.com/valeriansaliou/sonic/compare/core-v0.4.0...HEAD
+### Bug Fixes
+
+* Fix panic on Chinese text (`start byte index … is not a char boundary`): use `jieba_rs::Token::byte_start` (byte offset) instead of `start` (Unicode offset) in `Tokenizer::tokenize`. Also use `lindera` `Token::byte_start` instead of the removed `token_start` field.
 
 ## [0.4.0] (2026-09-21)
 
```

**File**: `core/src/lexer/token.rs` (modified, +52/-2)
```diff
@@ -702,14 +702,14 @@ pub mod lexing {
                     TOKENIZER_JIEBA
                         .cut(text, false)
                         .into_iter()
-                        .map(|token| (token.start, token.word)),
+                        .map(|token| (token.byte_start, token.word)),
                 ),
                 #[cfg(feature = "tokenizer-japanese")]
                 Some(Lang::Jpn) => match TOKENIZER_LINDERA.tokenize(text) {
                     Ok(tokens) => Box::from(
                         tokens
                             .into_iter()
-                            .map(|token| (token.token_start, token.text)),
+                            .map(|token| (token.byte_start, token.text)),
                     ),
                     Err(err) => {
                         tracing::warn!("unable to tokenize japanese, falling back: {}", err);
@@ -766,6 +766,56 @@ pub mod lexing {
         );
     }
 
+    #[cfg(feature = "tokenizer-chinese")]
+    #[test]
+    fn test_tokenizer_cmn_yields_byte_offsets() {
+        let tokenizer = Tokenizer {
+            lang: Some(Lang::Cmn),
+        };
+
+        // `jieba_rs::Token::start` is a Unicode (char) offset, but the lexer
+        // expects byte offsets. Mixing them up panics on multi-byte text
+        // (`start byte index 2 is not a char boundary`, inside '维').
+        assert_eq!(
+            tokenizer.tokenize("我来到北京清华大学").collect::<Vec<_>>(),
+            [(0, "我"), (3, "来到"), (9, "北京"), (15, "清华大学")],
+        );
+    }
+
+    #[cfg(feature = "tokenizer-chinese")]
+    #[test]
+    fn test_preprocessor_cmn_tokens_have_valid_ranges() {
+        use super::preprocessor::Preprocessor;
+
+        let mut preprocessor = Preprocessor::default();
+        preprocessor.detect_stopwords = false;
+        preprocessor.filter_stopwords = false;
+
+        let text = "我来到北京清华大学";
+        let output = preprocessor.preprocess(text, Some(Lang::Cmn));
+
+        // Iterating slices the original text by token ranges; wrong offsets
+        // panic here instead of yielding garbage.
+        assert_eq!(
+            output
+                .tokens()
+                .map(|token| {
+                    assert!(text.is_char_boundary(token.start));
+                    assert!(text.is_char_boundary(token.end));
+                    assert_eq!(&text[token.start..token.end], token.as_original());
+
+                    (token.as_original().to_owned(), token.start, token.end)
+                })
+                .collect::<Vec<_>>(),
+            [
+                ("我".to_owned(), 0, 3),
+                ("来到".to_owned(), 3, 9),
+                ("北京".to_owned(), 9, 15),
+                ("清华大学".to_owned(), 15, 27),
+            ]
+        );
+    }
+
     #[cfg(feature = "tokenizer-japanese")]
     #[test]
     fn test_tokenizer_jpn() {
```

#### Recent Merged Pull Requests:
- **PR #432** (2026-10-05): fix(core): Back up and restore FST buckets again (@dualfroz)
- **PR #431** (2026-10-05): docs: Document the 128 characters limit on collection, bucket and object names (@dualfroz)
- **PR #430** (2026-10-05): fix(core): Make `TRIGGER backup` work while stores are in use (@dualfroz)
- **PR #428** (2026-10-01): feat: Add snippet retrieval capabilities to `QUERY` (@RemiBardon)
- **PR #427** (2026-10-01): feat(core): Store original text on `PUSH` (@RemiBardon)
- **PR #426** (2026-09-29): Add experimental `PUSH` flags (@RemiBardon)
- **PR #425** (2026-09-29): Remove packaged stopwords (@RemiBardon)
- **PR #424** (2026-09-25): fix(core): use byte offsets in CJK tokenizer (@Theryston)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
