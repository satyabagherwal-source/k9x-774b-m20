# Forensic Learning Record (Deep Inspection): valeriansaliou/sonic

> **Canonical Artifact**: `07_PROJECT_LEARNING/valeriansaliou-sonic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/valeriansaliou/sonic](https://github.com/valeriansaliou/sonic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:30.177Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `valeriansaliou/sonic`
- **Description**: 🦔 Fast, lightweight & schema-less search backend. An alternative to Elasticsearch that runs on a few MBs of RAM.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 21355 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/examples/all_in_one_blocking.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

mod common;

use std::net::Ipv6Addr;

use sonic_client::SonicMultiplexer;
use sonic_client::control::SonicChannelControlBlocking;
use sonic_client::ingest::SonicChannelIngestBlocking;
use sonic_client::options::{Lang, Limit, Offset};
use sonic_client::search::SonicChannelSearchBlocking;
use sonic_client::transport::SonicStream;

use crate::common::*;

// type Transport = SonicStream;
type Transport = crate::common::logging_transport::Logging<SonicStream>;

fn main() -> Result<(), std::io::Error> {
    let start = std::time::Instant::now();

    eprintln!("\n=== Create multiplexer ===");
    let mut multiplexer = timed!({ SonicMultiplexer::new()? });

    let collection = "collection";
    let bucket = "bucket";

    let ingest = timed!({
        eprintln!("\n=== START ingest ===");
        let ingest = SonicChannelIngestBlocking::connect_custom::<Transport>(
            (Ipv6Addr::LOCALHOST, 1491),
            "SecretPassword",
            &mut multiplexer,
        )?;
        eprintln!("Version: {}", ingest.server_info().version);
        eprintln!("Channel: {:?}", ingest.channel_info());
        ingest
    });

    timed!({
        eprintln!("\n=== Ping ===");
        ingest.ping()?;
        eprintln!("Ping successful");
    });

    timed!({
        eprintln!("\n=== Ingest (simple) ===");
        ingest.push(
            collection,
            bucket,
            "object:1",
            "The quick brown fox jumps over the lazy dog.",
        )?;
    });

    timed!({
        eprintln!("\n=== Ingest (with options) ===");
        ingest.push_with_options(
            collection,
            bucket,
            "object:2",
            "Quick search engines return results fast.",
            &[&Lang("eng")],
        )?;
    });

    timed!({
        eprintln!("\n=== Drop ingest ===");
        drop(ingest);
    });

    let control = timed!({
        eprintln!("\n=== START control ===");
        let control = SonicChannelControlBlocking::connect_custom::<Transport>(
            (Ipv6Addr::LOCALHOST, 1491),
            "SecretPassword",
            &mut multiplexer,
        )?;
        eprintln!("Version: {}", control.server_info().version);
        eprintln!("Channel: {:?}", control.channel_info());
        control
    });

    timed!({
        eprintln!("\n=== Ping ===");
        control.
```

### Core Architecture Module: `client/examples/common/data.rs`
```
/// Copyright: <https://en.wikipedia.org/wiki/Search_engine_(computing)>.
pub const WIKIPEDIA_PARAGRAPHS_SEARCH_ENGINE: &[&str] = &[
    "In computing, a search engine is an information retrieval software system designed to help find information stored on one or more computer systems. Search engines discover, crawl, transform, and store information for retrieval and presentation in response to user queries. The search results are usually presented in a list and are commonly called hits. The most widely used type of search engine is a web search engine, which searches for information on the World Wide Web.",
    "A search engine normally consists of four components, as follows: a search interface, a crawler (also known as a spider or bot), an indexer, and a database. The crawler traverses a document collection, deconstructs document text, and assigns surrogates for storage in the search engine index. Online search engines store images, link data and metadata for the document.",
    "Search engines provide an interface to a group of items that enables users to specify criteria about an item of interest and have the engine find the matching items. The criteria are referred to as a search query. In the case of text search engines, the search query is typically expressed as a set of words that identify the desired concept that one or more documents may contain.[1] There are several styles of search query syntax that vary in strictness. It can also switch names within the search engines from previous sites. Whereas some text search engines require users to enter two or three words separated by white space, other search engines may enable users to specify entire documents, pictures, sounds, and various forms of natural language. Some search engines apply improvements to search queries to increase the likelihood of providing a quality set of items through a process known as query expansion. Query understanding methods can be used as standardized query language.",
    "The list of items that meet the criteria specified by the query is typically sorted, or ranked. Ranking items by relevance (from highest to lowest) reduces the time required to find the desired information. Probabilistic search engines rank items based on measures of similarity (between each item and the query, typically on a scale of 1 to 0, 1 being most similar) and sometimes popularity or authority (see Bibliometrics) or use relevance feedback. Boolean search engines typically only return items wh
```

### Core Architecture Module: `client/examples/common/logging_transport.rs`
```
// Sonic
//
// Fast, lightweight and schema-less search backend
// Copyright: 2026, Rémi Bardon <remi@remibardon.name>
// License: Mozilla Public License v2.0 (MPL v2.0)

use sonic_client::transport::Transport;

use super::macros::logging::*;

pub struct Logging<T: Transport>(T);

impl<T: Transport> sonic_client::transport::Transport for Logging<T> {
    type Lines<'a>
        = LinesLogger<T::Lines<'a>>
    where
        Self: 'a;

    fn connect(addr: std::net::SocketAddr) -> std::io::Result<Self> {
        T::connect(addr).map(Self)
    }

    fn read_lines<'a>(&'a mut self) -> std::io::Result<Self::Lines<'a>> {
        self.0.read_lines().map(LinesLogger)
    }

    fn read_line_sync(&mut self) -> std::io::Result<String> {
        let res = self.0.read_line_sync();

        if let Ok(ref line) = res {
            log_debug!("< {line}");
        }

        res
    }

    fn write_with<R>(&mut self, write: impl FnOnce(&mut bytes::BytesMut) -> R) -> R {
        use bytes::BufMut as _;

        let mut line = bytes::BytesMut::new();

        let res = write(&mut line);

        log_debug!("> {}", String::from_utf8_lossy(&line));

        self.0.write_with(|buf| buf.put_slice(&line));

        res
    }

    fn write_line(&mut self, line: impl AsRef<[u8]>) {
        log_debug!("> {}", String::from_utf8_lossy(line.as_ref()));

        self.0.write_line(line)
    }

    fn has_buffered_writes(&self) -> bool {
        self.0.has_buffered_writes()
    }

    fn flush_writes(&mut self) -> std::io::Result<usize> {
        self.0.flush_writes()
    }
}

impl<T: Transport> AsMut<mio::net::TcpStream> for Logging<T> {
    fn as_mut(&mut self) -> &mut mio::net::TcpStream {
        self.0.as_mut()
    }
}

#[repr(transparent)]
pub struct LinesLogger<I: Iterator<Item = bytes::Bytes>>(I);

impl<I: Iterator<Item = bytes::Bytes>> Iterator for LinesLogger<I> {
    type Item = bytes::Bytes;

    fn next(&mut self) -> Option<Self::Item> {
        let res = self.0.next();

        if let Some(ref line) = res {
            log_debug!("< {}", String::from_utf8_lossy(line));
        }

        res
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
  *Symptoms*: In everything I implemented in #401, it seems I made a mistake somewhere in the IID cache code and `IIDIncr` gets de-synced after a KV store gets closed and re-opened. I’ve been investigating for some time and I don’t get how that happens.  I have written a non-regression test, which I already know how to turn green, but I must first understand how the heck this happens:  ```log Executor: PUSH "docs" "default" "doc:0" "foobar 0" LANG(none) Executor: PUSH "docs" "default" "doc:1" "foobar 1" LANG(none) Executor: PUSH "docs" "default" "doc:2" "foobar 2" LANG(none) Executor: TRIGGER consolidate Ex
  **Post-Mortem & Fix Analysis**:
  > Well… I got it…  1. The `u32_max` merge operator did:     ```rust    if res > new_val {        res = new_val;    }    ```     Which is a no-op and caused `IIDIncr` to remain at `0` in DB.  2. `get_new_iid` didn’t call `get_iid_incr` to populate the cache:     ```rust    let iid = *write_guard        .entry(bucket.into_compact())        .and_modify(|iid| *iid = iid.saturating_add(1))        .or_ins
  > The sad thing is I couldn’t have caught this in tests, because Sonic had no way to return the number of buckets in a collection. It’s while fixing/improving `COUNT` that I uncovered this issue! Next release will contain a new `COUNT` syntax along with a fix for this bug.

- **Issue #405** (2026-09-22): **Experimental flag `NEW` is incompatible with content > `buffer_size`**
  *Symptoms*: I just realized that the experimental `NEW` flag in `PUSH` commands has a big gotcha: if a document is longer than `buffer_size`, we end up indexing it under multiple IIDs! Thanks a big overlook from my part, I’ll have to fix it before releasing v2!  To help catch this, I’ll add a `COUNT` check at the end of our benchmarks, checking that there are as many objects as there were input documents.  It’s a huge performance gain so I won’t get rid of it, simply work around the issue using an in-memory table (suboptimal but will be an in-between).
  **Post-Mortem & Fix Analysis**:
  > First I had to fix #392, but now that it’s done I ran the `wikipedia_parallel` benchmark with my final check and here is the result:  ```log  INFO wikipedia_parallel: Ensuring documents have 1:1 matching IIDs…  thread 'main' (1054564) panicked at server/benches/wikipedia_parallel.rs:357:29: assertion `left == right` failed   left: 642265  right: 625156 ```  Turns out 17109 documents (~2.6%) are ju

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

### Incident Patch 1: `0e1a2ce1` (2026-09-25)
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

### Incident Patch 2: `6902b0e9` (2026-09-25)
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
+                .get_iid_incr(&bucket, &self.store.iid_incr_per_bucket.read().u
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
+/// be merged into `0u32` and returned as a `u32` counter. On last ite
```

---

### Incident Patch 3: `98726dc9` (2026-09-25)
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
+ 
```

---

### Incident Patch 4: `638d3101` (2026-09-25)
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
+ 
```

---

### Incident Patch 5: `c2b22796` (2026-09-22)
**Commit Message**: Merge pull request #410 from fix-issue-405

fix(server): Make experimental flag `NEW` compatible with content > `buffer_size`

**File**: `core/src/executor/mod.rs` (modified, +31/-2)
```diff
@@ -8,8 +8,8 @@
 use std::collections::HashMap;
 use std::sync::{Arc, RwLock, RwLockReadGuard};
 
-use crate::store::StoreItemPart;
 use crate::store::kv::KvStoreId;
+use crate::store::{StoreItemPart, StoreObjectIid};
 use crate::util::hash::NoopU32HasherBuilder;
 
 #[macro_use]
@@ -33,6 +33,33 @@ pub struct Executor {
     pub kv_pool: crate::store::kv::KvStorePool,
     pub fst_pool: crate::store::fst::FstStorePool,
     pub dynamic_conf_store: Arc<DynamicConfigStore>,
+
+    /// When using `NEW` with `PUSH`, a new IID is automatically created.
+    /// However, if the input data is larger than the allowed buffer size Sonic
+    /// would end up indexing the same document across multiple IIDs
+    /// (see [issue #405 “Experimental flag `NEW` is incompatible with content > `buffer_size`”](https://github.com/valeriansaliou/sonic/issues/405)).
+    ///
+    /// To fix it, we keep track of the last “assumed new” OID and its IID so
+    /// we can reuse it on subsequent `PUSH … NEW` requests.
+    // NOTE: We can’t use `StoreObjectOid` as it’d not owned.
+    last_assumed_new_oid: RwLock<Option<(String, StoreObjectIid)>>,
+}
+
+impl Executor {
+    pub fn new(
+        app_conf: Arc<crate::Config>,
+        kv_pool: crate::store::kv::KvStorePool,
+        fst_pool: crate::store::fst::FstStorePool,
+        dynamic_conf_store: Arc<DynamicConfigStore>,
+    ) -> Self {
+        Self {
+            app_conf,
+            kv_pool,
+            fst_pool,
+            dynamic_conf_st
```

**File**: `core/src/executor/push.rs` (modified, +18/-3)
```diff
@@ -56,11 +56,26 @@ impl super::Executor {
 
             Ok(iid)
         };
+        let mut is_new = true;
         let iid = if assume_new {
-            assign_new_iid()?
+            if let Some((last_oid, iid)) = self.last_assumed_new_oid.read().unwrap().as_ref()
+                && **oid == *last_oid.as_str()
+            {
+                is_new = false;
+                *iid
+            } else {
+                let iid = assign_new_iid()?;
+
+                *self.last_assumed_new_oid.write().unwrap() = Some((oid.to_string(), iid));
+
+                iid
+            }
         } else {
             match kv_action.get_oid_to_iid(oid) {
-                Ok(Some(iid)) => iid,
+                Ok(Some(iid)) => {
+                    is_new = false;
+                    iid
+                }
                 Ok(None) => assign_new_iid()?,
                 Err(error) => {
                     tracing::error!("Error getting OID-To-IID: {error:?}");
@@ -86,7 +101,7 @@ impl super::Executor {
         }
 
         // Link terms to IID
-        if assume_new {
+        if assume_new && is_new {
             kv_action.set_iid_to_terms(&mut batch, iid, tokens.seen().iter().copied());
         } else {
             kv_action.add_iid_to_terms(&mut batch, iid, tokens.seen().iter().copied());
```

**File**: `core/tests/common/executor.rs` (modified, +1/-6)
```diff
@@ -65,12 +65,7 @@ pub fn make_test_executor_with_id(
 
     ExecutorGuard {
         id: id.to_string(),
-        executor: sonic::Executor {
-            app_conf: Arc::new(app_conf),
-            kv_pool,
-            fst_pool,
-            dynamic_conf_store: Default::default(),
-        },
+        executor: sonic::Executor::new(Arc::new(app_conf), kv_pool, fst_pool, Arc::default()),
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #426** (2026-09-29): Add experimental `PUSH` flags (@RemiBardon)
- **PR #425** (2026-09-29): Remove packaged stopwords (@RemiBardon)
- **PR #424** (2026-09-25): fix(core): use byte offsets in CJK tokenizer (@Theryston)
- **PR #421** (2026-09-24): Improve FST store performance (@RemiBardon)
- **PR #420** (2026-09-24): Encode key integers as big-endian, and fix some encoding issues (@RemiBardon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
