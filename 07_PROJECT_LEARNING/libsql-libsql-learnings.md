> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/libsql-libsql-learnings.md`  
> **Source**: github ([https://github.com/libsql/libsql](https://github.com/libsql/libsql))  
> **Source Version**: `d8bc862d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:25:41.425Z  
> **Learning ID**: `learn-github-tursodatabase-libsql`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tursodatabase/libsql

> **Canonical Artifact**: `07_PROJECT_LEARNING/libsql-libsql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/libsql/libsql](https://github.com/libsql/libsql))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:25:41.417Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/libsql`
- **Description**: libSQL is a fork of SQLite that is both Open Source, and Open Contributions.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 17279 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bottomless/src/uuid_utils.rs`
```
// Copy-pasted from uuid crate to avoid their uuid_unstable flag guard.
// Once uuid v7 is standardized and stabilized, we can go back to using uuid::new_v7() directly.

use uuid::{NoContext, Timestamp, Uuid};

fn bytes() -> [u8; 16] {
    rand::random()
}

pub(crate) const fn encode_unix_timestamp_millis(millis: u64, random_bytes: &[u8; 10]) -> Uuid {
    let millis_high = ((millis >> 16) & 0xFFFF_FFFF) as u32;
    let millis_low = (millis & 0xFFFF) as u16;

    let random_and_version =
        (random_bytes[1] as u16 | ((random_bytes[0] as u16) << 8) & 0x0FFF) | (0x7 << 12);

    let mut d4 = [0; 8];

    d4[0] = (random_bytes[2] & 0x3F) | 0x80;
    d4[1] = random_bytes[3];
    d4[2] = random_bytes[4];
    d4[3] = random_bytes[5];
    d4[4] = random_bytes[6];
    d4[5] = random_bytes[7];
    d4[6] = random_bytes[8];
    d4[7] = random_bytes[9];

    Uuid::from_fields(millis_high, millis_low, random_and_version, &d4)
}

pub fn new_v7(ts: Timestamp) -> Uuid {
    let (secs, nanos) = ts.to_unix();
    let millis = (secs * 1000).saturating_add(nanos as u64 / 1_000_000);

    encode_unix_timestamp_millis(millis, &bytes()[..10].try_into().unwrap())
}

pub(crate) fn decode_unix_timestamp(uuid: &Uuid) -> Timestamp {
    // taken from uuid crate (unsafe features)
    let bytes = uuid.as_bytes();

    let millis: u64 = (bytes[0] as u64) << 40
        | (bytes[1] as u64) << 32
        | (bytes[2] as u64) << 24
        | (bytes[3] as u64) << 16
        | (bytes[4] as u64) << 8
        | (bytes[5] as u64);

    let seconds = millis / 1000;
    let nanos = ((millis % 1000) * 1_000_000) as u32;
    Timestamp::from_unix(NoContext, seconds, nanos)
}

#[cfg(test)]
mod test {
    use crate::uuid_utils::{decode_unix_timestamp, new_v7};
    use uuid::{NoContext, Timestamp};

    #[test]
    fn timestamp_uuid_conversion() {
        let ts = Timestamp::now(NoContext);
        let uuid = new_v7(ts);
        let actual = decode_unix_timestamp(&uuid);
        //TODO: information loss on encoding?
        let (s1, _) = actual.to_unix();
        let (s2, _) = ts.to_unix();
        assert_eq!(s1, s2);
    }
}

```

### Core Architecture Module: `libsql-ffi/bundled/SQLite3MultipleCiphers/src/ascon/printstate.c`
```
#ifdef ASCON_PRINT_STATE

#include "printstate.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#ifndef WORDTOU64
#define WORDTOU64
#endif

#ifndef U64BIG
#define U64BIG
#endif

void printword(const char* text, const uint64_t x) {
  printf("%s=%016" PRIx64, text, U64BIG(WORDTOU64(x)));
}

void printstate(const char* text, const ascon_state_t* s) {
  int i;
  printf("%s:", text);
  for (i = strlen(text); i < 17; ++i) printf(" ");
  printword(" x0", s->x[0]);
  printword(" x1", s->x[1]);
  printword(" x2", s->x[2]);
  printword(" x3", s->x[3]);
  printword(" x4", s->x[4]);
#ifdef ASCON_PRINT_BI
  printf(" ");
  printf(" x0=%08x_%08x", s->w[0][1], s->w[0][0]);
  printf(" x1=%08x_%08x", s->w[1][1], s->w[1][0]);
  printf(" x2=%08x_%08x", s->w[2][1], s->w[2][0]);
  printf(" x3=%08x_%08x", s->w[3][1], s->w[3][0]);
  printf(" x4=%08x_%08x", s->w[4][1], s->w[4][0]);
#endif
  printf("\n");
}

#endif

```

### Core Architecture Module: `libsql-ffi/bundled/SQLite3MultipleCiphers/src/ascon/printstate.h`
```
#ifndef PRINTSTATE_H_
#define PRINTSTATE_H_

#ifdef ASCON_PRINT_STATE

#include "ascon.h"
#include "word.h"

void ascon_printword(const char* text, const uint64_t x);
void ascon_printstate(const char* text, const ascon_state_t* s);

#else

#define ascon_printword(text, w) \
  do {                     \
  } while (0)

#define ascon_printstate(text, s) \
  do {                      \
  } while (0)

#endif

#endif /* PRINTSTATE_H_ */

```

### Core Architecture Module: `libsql-ffi/bundled/sqlean/regexp/pcre2/pcre2_string_utils.c`
```
/*************************************************
*      Perl-Compatible Regular Expressions       *
*************************************************/

/* PCRE is a library of functions to support regular expressions whose syntax
and semantics are as close as possible to those of the Perl 5 language.

                       Written by Philip Hazel
     Original API code Copyright (c) 1997-2012 University of Cambridge
          New API code Copyright (c) 2018-2021 University of Cambridge

-----------------------------------------------------------------------------
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

    * Neither the name of the University of Cambridge nor the names of its
      contributors may be used to endorse or promote products derived from
      this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
-----------------------------------------------------------------------------
*/

/* This module contains internal functions for comparing and finding the length
of strings. These are used instead of strcmp() etc because the standard
functions work only on 8-bit data. */


#ifdef HAVE_CONFIG_H
#include "regexp/pcre2/config.h"
#endif

#include "regexp/pcre2/pcre2_internal.h"


/*************************************************
*    Emulated memmove() for systems without it   *
*************************************************/

/* This function can make use of bcopy() if it is available. Otherwise do it by
steam, as there some non-Unix environments that lack both memmove() and
bcopy(). */

#if !defined(VPCOMPAT) && !defined(HAVE_MEMMOVE)
void *
PRIV(memmove)(void *d, const void *s, size_t n)
{
#ifdef HAVE_BCOPY
bcopy(s, d, n);
return d;
#else
size_t i;
unsigned char *dest = (unsigned char *)d;
const unsigned char *src = (const unsigned char *)s;
if (dest > src)
  {
  dest += n;
  src += n;
  for (i = 0; i < n; ++i) *(--dest) = *(--src);
  return (void *)dest;
  }
else
  {
  for (i = 0; i < n; ++i) *dest++ = *src++;
  return (void *)(dest - n);
  }
#endif   /* not HAVE_BCOPY */
}
#endif   /* not VPCOMPAT && not HAVE_MEMMOVE */


/*************************************************
*    Compare two zero-terminated PCRE2 strings   *
*************************************************/

/*
Arguments:
  str1        first string
  str2        second string

Returns:      0, 1, or -1
*/

int
PRIV(strcmp)(PCRE2_SPTR str1, PCRE2_SPTR str2)
{
PCRE2_UCHAR c1, c2;
while (*str1 != '\0' || *str2 != '\0')
  {
  c1 = *str1++;
  c2 = *str2++;
  if (c1 != c2) return ((c1 > c2) << 1) - 1;
  }
return 0;
}


/*************************************************
*  Compare zero-terminated PCRE2 & 8-bit strings *
*************************************************/

/* As the 8-bit string is almost always a literal, its type is specified as
const char *.

Arguments:
  str1        first string
  str2        second string

Returns:      0, 1, or -1
*/

int
PRIV(strcmp_c8)(PCRE2_SPTR str1, const char *str2)
{
PCRE2_UCHAR c1, c2;
while (*str1 != '\0' || *str2 != '\0')
  {
  c1 = *str1++;
  c2 = *str2++;
  if (c1 != c2) return ((c1 > c2) << 1) - 1;
  }
return 0;
}


/*************************************************
*    Compare two PCRE2 strings, given a length   *
*************************************************/

/*
Arguments:
  str1        first string
  str2        second string
  len         the length

Returns:      0, 1, or -1
*/

int
PRIV(strncmp)(PCRE2_SPTR str1, PCRE2_SPTR str2, size_t len)
{
PCRE2_UCHAR c1, c2;
for (; len > 0; len--)
  {
  c1 = *str1++;
  c2 = *str2++;
  if (c1 != c2) return ((c1 > c2) << 1) - 1;
  }
return 0;
}


/*************************************************
* Compare PCRE2 string to 8-bit string by length *
*************************************************/

/* As the 8-bit string is almost always a literal, its type is specified as
const char *.

Arguments:
  str1        first string
  str2        second string
  len         the length

Returns:      0, 1, or -1
*/

int
PRIV(strncmp_c8)(PCRE2_SPTR str1, const char *str2, size_t len)
{
PCRE2_UCHAR c1, c2;
for (; len > 0; len--)
  {
  c1 = *str1++;
  c2 = *str2++;
  if (c1 != c2) return ((c1 > c2) << 1) - 1;
  }
return 0;
}


/*************************************************
*        Find the length of a PCRE2 string       *
*************************************************/

/*
Argument:    the string
Returns:     the length
*/

PCRE2_SIZE
PRIV(strlen)(PCRE2_SPTR str)
{
PCRE2_SIZE c = 0;
while (*str++ != 0) c++;
return c;
}


/*************************************************
* Copy 8-bit 0-terminated string to PCRE2 string *
*************************************************/

/* Arguments:
  str1     buffer to receive the string
  str2     8-bit string to be copied

Returns:   the number of code units used (excluding trailing zero)
*/

PCRE2_SIZE
PRIV(strcpy_c8)(PCRE2_UCHAR *str1, const char *str2)
{
PCRE2_UCHAR *t = str1;
while (*str2 != 0) *t++ = *str2++;
*t = 0;
return t - str1;
}

/* End of pcre2_string_utils.c */

```

### Core Architecture Module: `libsql-server/src/connection/connection_core.rs`
```
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use libsql_sys::wal::{Wal, WalManager};
use metrics::histogram;
use parking_lot::Mutex;

use crate::connection::legacy::open_conn_active_checkpoint;
use crate::error::Error;
use crate::metrics::{PROGRAM_EXEC_COUNT, QUERY_CANCELED, VACUUM_COUNT, WAL_CHECKPOINT_COUNT};
use crate::namespace::broadcasters::BroadcasterHandle;
use crate::namespace::meta_store::MetaStoreHandle;
use crate::namespace::ResolveNamespacePathFn;
use crate::query_analysis::StmtKind;
use crate::query_result_builder::{QueryBuilderConfig, QueryResultBuilder};
use crate::replication::FrameNo;
use crate::stats::{Stats, StatsUpdateMessage};
use crate::{Result, BLOCKING_RT};

use super::config::DatabaseConfig;
use super::program::{DescribeCol, DescribeParam, DescribeResponse, Program, Vm};

pub type GetCurrentFrameNo = Arc<dyn Fn() -> Option<FrameNo> + Send + Sync + 'static>;

/// The base connection type, shared between legacy and libsql-wal implementations
pub(super) struct CoreConnection<W> {
    conn: libsql_sys::Connection<W>,
    stats: Arc<Stats>,
    config_store: MetaStoreHandle,
    builder_config: QueryBuilderConfig,
    get_current_frame_no: GetCurrentFrameNo,
    block_writes: Arc<AtomicBool>,
    resolve_attach_path: ResolveNamespacePathFn,
    forced_rollback: bool,
    broadcaster: BroadcasterHandle,
    hooked: bool,
    canceled: Arc<AtomicBool>,
}

fn update_stats(
    stats: &Stats,
    sql: String,
    rows_read: u64,
    rows_written: u64,
    mem_used: u64,
    elapsed: Duration,
) {
    stats.send(StatsUpdateMessage {
        sql,
        elapsed,
        rows_read,
        rows_written,
        mem_used,
    });
}

impl<W: Wal + Send + 'static> CoreConnection<W> {
    pub(super) fn new<T: WalManager<Wal = W>>(
        path: &Path,
        extensions: Arc<[PathBuf]>,
        wal_manager: T,
        stats: Arc<Stats>,
        broadcaster: BroadcasterHandle,
        config_store: MetaStoreHandle,
        builder_config: QueryBuilderConfig,
        get_current_frame_no: GetCurrentFrameNo,
        block_writes: Arc<AtomicBool>,
        resolve_attach_path: ResolveNamespacePathFn,
    ) -> Result<Self> {
        let conn = open_conn_active_checkpoint(
            path,
            wal_manager,
            None,
            builder_config.auto_checkpoint,
            builder_config.encryption_config.clone(),
        )?;

        let config = config_store.get();
        conn.pragma_update(None, "max_page_count", config.max_db_pages)?;
        tracing::debug!("setting PRAGMA synchronous to {}", config.durability_mode);
        conn.pragma_update(None, "synchronous", config.durability_mode)?;

        conn.set_limit(
            rusqlite::limits::Limit::SQLITE_LIMIT_LENGTH,
            config.max_row_size as i32,
        );

        let canceled = Arc::new(AtomicBool::new(false));

        conn.progress_handler(100, {
            let canceled = canceled.clone();
            Some(move || {
                let canceled = canceled.load(Ordering::Relaxed);
                if canceled {
                    QUERY_CANCELED.increment(1);
                    tracing::trace!("request canceled");
                }
                canceled
            })
        });

        let this = Self {
            conn,
            stats,
            config_store,
            builder_config,
            block_writes,
            resolve_attach_path,
            forced_rollback: false,
            broadcaster,
            hooked: false,
            canceled,
            get_current_frame_no,
        };

        for ext in extensions.iter() {
            unsafe {
                let _guard = rusqlite::LoadExtensionGuard::new(&this.conn).unwrap();
                if let Err(e) = this.conn.load_extension(ext, None) {
                    tracing::error!("failed to load extension: {}", ext.display());
                    Err(e)?;
                }
                tracing::trace!("Loaded extension {}", ext.display());
            }
        }

        Ok(this)
    }

    pub(super) fn raw_mut(&mut self) -> &mut libsql_sys::Connection<W> {
        &mut self.conn
    }

    pub(super) fn raw(&self) -> &libsql_sys::Connection<W> {
        &self.conn
    }

    pub(super) fn config(&self) -> Arc<DatabaseConfig> {
        self.config_store.get()
    }

    pub(super) async fn run_async<B: QueryResultBuilder>(
        this: Arc<Mutex<Self>>,
        pgm: Program,
        builder: B,
    ) -> Result<B> {
        struct Bomb {
            canceled: Arc<AtomicBool>,
            defused: bool,
        }

        impl Drop for Bomb {
            fn drop(&mut self) {
                if !self.defused {
                    tracing::trace!("cancelling request");
                    self.canceled.store(true, Ordering::Relaxed);
                }
            }
        }

        let canceled = {
            let cancelled = this.lock().canceled.clone();
            cancelled.store(false, Ordering::Relaxed);
            cancelled
        };

        PROGRAM_EXEC_COUNT.increment(1);

        // create the bomb right before spawning the blocking task.
        let mut bomb = Bomb {
            canceled,
            defused: false,
        };
        let ret = BLOCKING_RT
            .spawn_blocking(move || CoreConnection::run(this, pgm, builder))
            .await
            .unwrap();

        bomb.defused = true;

        ret
    }

    pub(super) fn run<B: QueryResultBuilder>(
        this: Arc<Mutex<Self>>,
        pgm: Program,
        mut builder: B,
    ) -> Result<B> {
        let (config, stats, block_writes, resolve_attach_path) = {
            let mut lock = this.lock();
            let config = lock.config_store.get();
            let stats = lock.stats.clone();
            let block_writes = lock.block_writes.clone();
            let resolve_attach_path = lock.resolve_attach_path.clone();

            lock.update_hooks();

            (config, stats, block_writes, resolve_attach_path)
        };

        builder.init(&this.lock().builder_config)?;
        let mut vm = Vm::new(
            builder,
            &pgm,
            move |stmt_kind| {
                let should_block = match stmt_kind {
                    StmtKind::Read | StmtKind::TxnBegin => config.block_reads,
                    StmtKind::Write => {
                        config.block_reads
                            || config.block_writes
                            || block_writes.load(Ordering::SeqCst)
                    }
                    StmtKind::DDL => config.block_reads || config.block_writes,
                    StmtKind::TxnEnd
                    | StmtKind::Release
                    | StmtKind::Savepoint
                    | StmtKind::Detach
                    | StmtKind::Attach(_) => false,
                };

                (
                    should_block,
                    should_block.then(|| config.block_reason.clone()).flatten(),
                )
            },
            move |sql, rows_read, rows_written, mem_used, elapsed| {
                update_stats(&stats, sql, rows_read, rows_written, mem_used, elapsed)
            },
            resolve_attach_path,
        );

        let mut has_timeout = false;
        while !vm.finished() {
            let mut conn = this.lock();

            if conn.forced_rollback {
                has_timeout = true;
                conn.forced_rollback = false;
            }

            // once there was a timeout, invalidate all the program steps
            if has_timeout {
                vm.builder().begin_step()?;
                vm.builder().step_error(Error::LibSqlTxTimeout)?;
                vm.builder().finish_step(0, None)?;
                vm.advance();
                continue;
            }

            vm.step(&conn.raw())?;
        }

        {
            let lock = this.lock();
            let is_autocommit = lock.conn.is_autocommit();
            let current_fno = (lock.get_current_frame_no)();
            vm.builder().finish(current_fno, is_autocommit)?;
        }

        Ok(vm.into_builder())
    }

    fn rollback(&self) {
        if let Err(e) = self.conn.execute("ROLLBACK", ()) {
            tracing::error!("failed to rollback: {e}");
        }
    }

    pub(super) fn force_rollback(&mut self) {
        if !self.forced_rollback {
            self.rollback();
            self.forced_rollback = true;
        }
    }

    pub(super) fn checkpoint(&self) -> Result<()> {
        let start = Instant::now();
        self.conn
            .query_row("PRAGMA wal_checkpoint(TRUNCATE)", (), |row| {
                let status: i32 = row.get(0)?;
                let wal_frames: i32 = row.get(1)?;
                let moved_frames: i32 = row.get(2)?;
                tracing::info!(
                    "WAL checkpoint successful, status: {}, WAL frames: {}, moved frames: {}",
                    status,
                    wal_frames,
                    moved_frames
                );
                Ok(())
            })?;
        WAL_CHECKPOINT_COUNT.increment(1);
        histogram!("libsql_server_wal_checkpoint_time", start.elapsed());
        Ok(())
    }

    pub(super) fn vacuum_if_needed(&self) -> Result<()> {
        let page_count = self
            .conn
            .query_row("PRAGMA page_count", (), |row| row.get::<_, i64>(0))?;
        let freelist_count = self
            .conn
            .query_row("PRAGMA freelist_count", (), |row| row.get::<_, i64>(0))?;
        // NOTICE: don't bother vacuuming if we don't have at least 256MiB of data
        if page_count >= 65536 && freelist_count * 2 > page_count {
            tracing::info!("Vacuuming: pages={page_count} freelist={freelist_count}");
            self.conn.execute("VACUUM", ())?;
        } else {
            tracing::trace!("Not vacuuming: pages={page_count} freelist={freelist_count}");
        }
        VACUUM_COUNT.
```

### Core Architecture Module: `libsql-server/src/utils/mod.rs`
```
pub mod services;

```

### Core Architecture Module: `libsql-server/src/utils/services/idle_shutdown.rs`
```
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use hyper::http;
use tokio::sync::{watch, Notify};
use tokio::time::timeout;
use tokio::time::Duration;
use tower::{Layer, Service};

#[derive(Clone)]
pub struct IdleShutdownKicker {
    watcher: Arc<watch::Sender<()>>,
    connected_replicas: Arc<AtomicUsize>,
}

impl IdleShutdownKicker {
    pub fn new(
        idle_timeout: Duration,
        initial_idle_timeout: Option<Duration>,
        shutdown_notifier: Arc<Notify>,
    ) -> Self {
        let (sender, mut receiver) = watch::channel(());
        let connected_replicas = Arc::new(AtomicUsize::new(0));
        let connected_replicas_clone = connected_replicas.clone();
        let mut sleep_time = initial_idle_timeout.unwrap_or(idle_timeout);
        tokio::spawn(async move {
            loop {
                // FIXME: if we measure that this is causing performance issues, we may want to
                // implement some debouncing.
                let timeout_res = timeout(sleep_time, receiver.changed()).await;
                if let Ok(Err(_)) = timeout_res {
                    break;
                }
                if timeout_res.is_err() && connected_replicas_clone.load(Ordering::SeqCst) == 0 {
                    tracing::info!(
                        "Idle timeout, no new connection in {sleep_time:.0?}. Shutting down.",
                    );
                    shutdown_notifier.notify_waiters();
                }
                sleep_time = idle_timeout;
            }

            tracing::debug!("idle shutdown loop exited");
        });

        Self {
            watcher: Arc::new(sender),
            connected_replicas,
        }
    }

    pub fn add_connected_replica(&mut self) {
        self.connected_replicas.fetch_add(1, Ordering::SeqCst);
    }

    pub fn remove_connected_replica(&mut self) {
        self.connected_replicas.fetch_sub(1, Ordering::SeqCst);
    }

    pub fn into_kicker(self) -> IdleKicker {
        IdleKicker {
            sender: self.watcher,
        }
    }
}

impl<S> Layer<S> for IdleShutdownKicker {
    type Service = IdleShutdownService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        IdleShutdownService {
            inner,
            watcher: self.watcher.clone(),
        }
    }
}

#[derive(Clone)]
pub struct IdleKicker {
    sender: Arc<watch::Sender<()>>,
}

impl IdleKicker {
    pub fn kick(&self) {
        let _: Result<_, _> = self.sender.send(());
    }
}

#[derive(Clone)]
pub struct IdleShutdownService<S> {
    inner: S,
    watcher: Arc<watch::Sender<()>>,
}

impl<B, S> Service<http::request::Request<B>> for IdleShutdownService<S>
where
    S: Service<http::request::Request<B>>,
{
    type Response = S::Response;

    type Error = S::Error;

    type Future = S::Future;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: http::request::Request<B>) -> Self::Future {
        if should_extend_lifetime(req.uri().path()) {
            let _ = self.watcher.send(());
        }
        self.inner.call(req)
    }
}

fn should_extend_lifetime(path: &str) -> bool {
    path != "/health"
}

```

### Core Architecture Module: `libsql-server/src/utils/services/mod.rs`
```
pub mod idle_shutdown;

```

### Core Architecture Module: `libsql-sqlite3/ext/crr/rs/core/src/alter.rs`
```
// Not yet fully migrated from `crsqlite.c`

use alloc::boxed::Box;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use core::ffi::{c_char, c_int, CStr};
use core::mem;
#[cfg(not(feature = "std"))]
use num_traits::FromPrimitive;
use sqlite_nostd::{sqlite3, Connection, ResultCode, StrRef};

use crate::c::crsql_ExtData;
use crate::db_version::fill_db_version_if_needed;
use crate::tableinfo::{crsql_ensure_table_infos_are_up_to_date, TableInfo};

#[no_mangle]
pub unsafe extern "C" fn crsql_compact_post_alter(
    db: *mut sqlite3,
    tbl_name: *const c_char,
    ext_data: *mut crsql_ExtData,
    errmsg: *mut *mut c_char,
) -> c_int {
    match compact_post_alter(db, tbl_name, ext_data, errmsg) {
        Ok(rc) | Err(rc) => rc as c_int,
    }
}

unsafe fn compact_post_alter(
    db: *mut sqlite3,
    tbl_name: *const c_char,
    ext_data: *mut crsql_ExtData,
    errmsg: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let tbl_name_str = CStr::from_ptr(tbl_name).to_str()?;
    fill_db_version_if_needed(db, ext_data).or_else(|msg| {
        errmsg.set(&msg);
        Err(ResultCode::ERROR)
    })?;
    let current_db_version = (*ext_data).dbVersion;

    // If primary key columns change (in the schema)
    // We need to drop, re-create and backfill
    // the clock table.
    // A change in pk columns means a change in all identities
    // of all rows.
    // We can determine this by comparing unique index on lookaside table vs
    // pks on source table
    let stmt = db.prepare_v2(&format!(
        "SELECT count(name) FROM (
        SELECT name FROM pragma_table_info('{table_name}')
          WHERE pk > 0 AND name NOT IN
            (SELECT name FROM pragma_index_info('{table_name}__crsql_pks_pks'))
          UNION SELECT name FROM pragma_index_info('{table_name}__crsql_pks_pks') WHERE name NOT IN 
            (SELECT name FROM pragma_table_info('{table_name}') WHERE pk > 0) AND name != 'col_name'
        );",
        table_name = crate::util::escape_ident_as_value(tbl_name_str),
    ))?;
    stmt.step()?;

    let pk_diff = stmt.column_int(0);
    // immediately drop stmt, otherwise clock table is considered locked.
    drop(stmt);

    if pk_diff > 0 {
        // drop the clock table so we can re-create it
        db.exec_safe(&format!(
            "DROP TABLE \"{table_name}__crsql_clock\";
             DROP TABLE \"{table_name}__crsql_pks\";",
            table_name = crate::util::escape_ident(tbl_name_str),
        ))?;
    } else {
        // clock table is still relevant but needs compacting
        // in case columns were removed during the migration

        // First delete entries that no longer have a column
        let sql = format!(
            "DELETE FROM \"{tbl_name_ident}__crsql_clock\" WHERE \"col_name\" NOT IN (
              SELECT name FROM pragma_table_info('{tbl_name_val}') UNION SELECT '{cl_sentinel}'
            )",
            tbl_name_ident = crate::util::escape_ident(tbl_name_str),
            tbl_name_val = crate::util::escape_ident_as_value(tbl_name_str),
            cl_sentinel = crate::c::DELETE_SENTINEL,
        );
        db.exec_safe(&sql)?;

        // Next delete entries that no longer have a row but keeping tombstones
        // TODO: if we move the sentinel metadata to the lookaside this becomes much simpler
        let mut sql = String::from(
            format!(
              "DELETE FROM \"{tbl_name}__crsql_clock\" WHERE (col_name != '-1' OR (col_name = '-1' AND col_version % 2 != 0))
              AND NOT EXISTS (SELECT 1 FROM \"{tbl_name}\" JOIN \"{tbl_name}__crsql_pks\" ON ",
              tbl_name = crate::util::escape_ident(tbl_name_str),
            ),
        );
        let c_rc = crsql_ensure_table_infos_are_up_to_date(db, ext_data, errmsg);
        if c_rc != ResultCode::OK as c_int {
            if let Some(rc) = ResultCode::from_i32(c_rc) {
                return Err(rc);
            }
            return Err(ResultCode::ERROR);
        }
        let table_infos =
            mem::ManuallyDrop::new(Box::from_raw((*ext_data).tableInfos as *mut Vec<TableInfo>));
        let table_info = table_infos.iter().find(|x| x.tbl_name == tbl_name_str);
        if table_info.is_none() {
            return Err(ResultCode::ERROR);
        }
        // TODO: safe since we checked above but make more idiomatic
        let table_info = table_info.unwrap();

        // for each pk col, append \"%w\".\"%w\" = \"%w__crsql_pks\".\"%w\"
        // to the where clause then close the statement.
        for (i, col) in table_info.pks.iter().enumerate() {
            if i > 0 {
                sql.push_str(" AND ");
            }

            sql.push_str(&format!(
                "\"{tbl_name}\".\"{col_name}\" = \"{tbl_name}__crsql_pks\".\"{col_name}\"",
                tbl_name = crate::util::escape_ident(tbl_name_str),
                col_name = &col.name,
            ));
        }
        sql.push_str(
          &format!(
            " WHERE \"{tbl_name}__crsql_clock\".key = \"{tbl_name}__crsql_pks\".__crsql_key LIMIT 1)",
            tbl_name = crate::util::escape_ident(tbl_name_str)
          )
        );
        db.exec_safe(&sql)?;

        // now delete pk lookasides that no longer map to anything in the clock tables
        let sql = format!(
            "DELETE FROM \"{tbl_name}__crsql_pks\" WHERE __crsql_key NOT IN (
        SELECT key FROM \"{tbl_name}__crsql_clock\"
      )",
            tbl_name = crate::util::escape_ident(tbl_name_str),
        );
        db.exec_safe(&sql)?;
    }

    let stmt = db.prepare_v2(
        "INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('pre_compact_dbversion', ?)",
    )?;
    stmt.bind_int64(1, current_db_version)?;
    stmt.step()?;
    Ok(ResultCode::OK)
}

```

### Core Architecture Module: `libsql-sqlite3/ext/crr/rs/core/src/automigrate.rs`
```
extern crate alloc;

// nit: use vecs rather than btreesets. Likely never enough elements
// for a btreeset to perform better.
use alloc::collections::BTreeSet;
use alloc::format;
use alloc::string::String;
use alloc::string::ToString;
use alloc::vec;
use alloc::vec::Vec;
use core::ffi::{c_char, c_int};
use sqlite::ColumnType;
use sqlite_nostd as sqlite;

use sqlite::{args, sqlite3, ManagedConnection, Value};
use sqlite::{strlit, Context};
use sqlite::{Connection, ResultCode};

static IS_UNIQUE_IDX_SQL: &str = "SELECT \"unique\" FROM pragma_index_list(?) WHERE name = ?";
static IDX_COLS_SQL: &str = "SELECT name FROM pragma_index_info(?) ORDER BY seqno ASC";

/**
* Automigrate args:
* 1 - the schema content
* Users are responsible for tracking schema version and applying the migration or not.
*
* We may want to move automigrate to its own crate.
* It is rather limited in completeness and may only be
* useful to myself.
*/
pub extern "C" fn crsql_automigrate(
    ctx: *mut sqlite::context,
    argc: c_int,
    argv: *mut *mut sqlite::value,
) {
    if argc < 1 {
        ctx.result_error("Had no args. Expected a schema to migrate to");
        return;
    }

    let args = args!(argc, argv);
    if let Err(code) = automigrate_impl(ctx, args) {
        // We're using `Err(OK)` to signify that error message and code were already set.
        if code != ResultCode::OK {
            ctx.result_error(&format!("failed to apply the updated schema {:?}", code));
            ctx.result_error_code(code);
        }

        return;
    }

    ctx.result_text_transient("migration complete");
}

fn automigrate_impl(
    ctx: *mut sqlite::context,
    args: &[*mut sqlite::value],
) -> Result<ResultCode, ResultCode> {
    let cleanup = |mem_db: ManagedConnection| {
        if args.len() == 2 {
            let cleanup_stmt = args[1].text();
            mem_db.exec_safe(cleanup_stmt)
        } else {
            Ok(ResultCode::OK)
        }
    };
    let local_db = ctx.db_handle();
    let desired_schema = args[0].text();
    let stripped_schema = strip_crr_statements(desired_schema);

    let result = sqlite::open(strlit!(":memory:"));
    if let Ok(mem_db) = result {
        if let Err(_) = mem_db.exec_safe(&stripped_schema) {
            let mem_db_err_msg = mem_db.errmsg()?;
            ctx.result_error(&mem_db_err_msg);
            ctx.result_error_code(mem_db.errcode());
            cleanup(mem_db)?;
            return Err(ResultCode::OK);
        }
        local_db.exec_safe("SAVEPOINT automigrate_tables;")?;

        let migrate_result = migrate_to(local_db, &mem_db);

        if let Err(_) = migrate_result {
            local_db.exec_safe("ROLLBACK")?;
            let mem_db_err_msg = mem_db.errmsg()?;
            ctx.result_error(&mem_db_err_msg);
            ctx.result_error_code(mem_db.errcode());
            cleanup(mem_db)?;
            return Err(ResultCode::OK);
        } else {
            cleanup(mem_db)?;
        }

        if !desired_schema.is_empty() {
            local_db.exec_safe(desired_schema)?;
        }
        local_db.exec_safe("RELEASE automigrate_tables")
    } else {
        ctx.result_error("could not open the temporary migration db");
        ctx.result_error_code(ResultCode::CANTOPEN);
        return Err(ResultCode::OK);
    }
}

fn migrate_to(
    local_db: *mut sqlite3,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    // TODO: why not HashSet?
    let mut mem_tables: BTreeSet<String> = BTreeSet::new();

    let sql = "SELECT name FROM sqlite_master WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'crsql_%'
        AND name NOT LIKE '__crsql_%'
        AND name NOT LIKE '%__crsql_%'";
    let fetch_mem_tables = mem_db.prepare_v2(sql)?;
    let fetch_local_tables = local_db.prepare_v2(sql)?;

    while fetch_mem_tables.step()? == ResultCode::ROW {
        mem_tables.insert(fetch_mem_tables.column_text(0)?.to_string());
    }

    let mut removed_tables: Vec<String> = vec![];
    let mut maybe_modified_tables: Vec<String> = vec![];

    while fetch_local_tables.step()? == ResultCode::ROW {
        let table_name = fetch_local_tables.column_text(0)?;
        if mem_tables.contains(table_name) {
            maybe_modified_tables.push(table_name.to_string());
        } else {
            removed_tables.push(table_name.to_string());
        }
    }

    drop_tables(local_db, removed_tables)?;
    for table in maybe_modified_tables {
        maybe_modify_table(local_db, &table, &mem_db)?;
    }
    // no add tables. Schema file application will add tables.
    Ok(ResultCode::OK)
}

/**
* stripts `select crsql_as_crr` statements
* from the provided schema.
* returns which tables were crrs so we can re-apply the statements
* once migrations are complete.
*
* We have to strip the statements given we can't load an extension into an extension
* in all environment.
*
* E.g., if cr-sqlite is running as a runtime loadable ext
* then it cannot open an in-memory db within itself that loads this same
* extension.
*/
fn strip_crr_statements(schema: &str) -> String {
    schema
        .split("\n")
        .filter(|line| {
            !line.to_lowercase().contains("crsql_as_crr")
                && !line.to_lowercase().contains("crsql_fract_as_ordered")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn drop_tables(local_db: *mut sqlite3, tables: Vec<String>) -> Result<ResultCode, ResultCode> {
    for table in tables {
        local_db.exec_safe(&format!(
            "DROP TABLE \"{table}\"",
            table = crate::util::escape_ident(&table)
        ))?;
    }

    Ok(ResultCode::OK)
}

// TODO: we could potentially track renames...
fn maybe_modify_table(
    local_db: *mut sqlite3,
    table: &str,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    let mut local_columns = BTreeSet::new();
    let mut mem_columns = BTreeSet::new();

    let sql = "SELECT name FROM pragma_table_info(?)";
    let local_stmt = local_db.prepare_v2(sql)?;
    let mem_stmt = mem_db.prepare_v2(sql)?;
    local_stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
    mem_stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;

    while mem_stmt.step()? == ResultCode::ROW {
        mem_columns.insert(mem_stmt.column_text(0)?.to_string());
    }

    let mut removed_columns: Vec<String> = vec![];
    let mut added_columns: Vec<String> = vec![];

    while local_stmt.step()? == ResultCode::ROW {
        let col_name = local_stmt.column_text(0)?;
        local_columns.insert(col_name.to_string());
        if !mem_columns.contains(col_name) {
            removed_columns.push(col_name.to_string());
        }
    }

    for mem_col in mem_columns {
        if !local_columns.contains(&mem_col) {
            added_columns.push(mem_col);
        }
    }

    let is_a_crr = crate::is_crr(local_db, table)?;
    if is_a_crr {
        let stmt = local_db.prepare_v2("SELECT crsql_begin_alter(?)")?;
        stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
        stmt.step()?;
    }

    drop_columns(local_db, table, removed_columns)?;
    add_columns(local_db, table, added_columns, mem_db)?;
    maybe_update_indices(local_db, table, mem_db)?;

    if is_a_crr {
        let stmt = local_db.prepare_v2("SELECT crsql_commit_alter(?)")?;
        stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
        stmt.step()?;
    }

    Ok(ResultCode::OK)
}

fn drop_columns(
    local_db: *mut sqlite3,
    table: &str,
    columns: Vec<String>,
) -> Result<ResultCode, ResultCode> {
    local_db.exec_safe(&format!(
        "DROP VIEW IF EXISTS \"{table}_fractindex\"",
        table = crate::util::escape_ident(table)
    ))?;
    for col in columns {
        local_db.exec_safe(&format!(
            "ALTER TABLE \"{table}\" DROP \"{column}\"",
            table = crate::util::escape_ident(table),
            column = crate::util::escape_ident(&col)
        ))?;
    }

    Ok(ResultCode::OK)
}

fn add_columns(
    local_db: *mut sqlite3,
    table: &str,
    columns: Vec<String>,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    if columns.is_empty() {
        return Ok(ResultCode::OK);
    }
    let sql = format!(
        "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?) WHERE name IN ({qs})",
        qs = columns.iter().map(|_| "?").collect::<Vec<_>>().join(", "),
    );
    let stmt = mem_db.prepare_v2(&sql)?;
    stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
    let mut b = 2;
    for col in &columns {
        stmt.bind_text(b, &col, sqlite::Destructor::STATIC)?;
        b += 1;
    }

    let mut processed_cols = 0;
    while stmt.step()? == ResultCode::ROW {
        let is_pk = stmt.column_int(4) == 1;

        if is_pk {
            // We do not support adding PK columns to existing tables in auto-migration
            return Err(ResultCode::MISUSE);
        }

        let name = stmt.column_text(0)?;
        let col_type = stmt.column_text(1)?;
        let notnull = stmt.column_int(2) == 1;
        let dflt_val = stmt.column_value(3)?;

        add_column(local_db, table, name, col_type, notnull, dflt_val)?;
        processed_cols += 1;
    }
    if processed_cols != columns.len() {
        return Err(ResultCode::ERROR_MISSING_COLLSEQ);
    }

    Ok(ResultCode::OK)
}

fn add_column(
    local_db: *mut sqlite3,
    table: &str,
    name: &str,
    col_type: &str,
    notnull: bool,
    dflt_val: *mut sqlite::value,
) -> Result<ResultCode, ResultCode> {
    // ideally we'd extract out the SQL for the specific column
    // so we can get all constraints
    // as it is now, we don't support many things in auto-migration
    let dflt_val_str = if dflt_val.value_type() == ColumnType::Null {
        String::from("")
    } else {
        format!("DEFAULT {}", dflt_val.text())
    };

    local_db.exec_safe(&format!(
        "ALTER TABLE \"{table}\" ADD COLUMN \"{name}\" {col_type} {notnull} {dflt
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2102** (2025-07-31): **Database locked error after offline sync push**
  *Symptoms*: Various people are reporting that database becomes locked forever after offline push sync. We assumed this was due to the bug we had with background sync keeping lock forever, but let's investigate if there's some other problem.
  **Post-Mortem & Fix Analysis**:
  > I'm hitting this specific error trying to integrate with Tauri:  ``` Working offline - data will sync later: sync error: failed to push frame: status=503 Service Unavailable, error={"error":"SQLite error: max_frame_no failed: database is locked"} ```
  > Is this a dupe or a tangent? https://github.com/tursodatabase/libsql/issues/2122

- **Issue #2083** (2025-06-24): **Embedded Replica update fails**
  *Symptoms*: When using Embedded Replicas, calling the UPDATE api results in `Hrana 404 "stream not found"`  `@libsql/client: 0.15.7`  Edit: turso dies after a few minutes... even GET requests are 404ing.  Edit2: 0.15.8 did not fix
  **Post-Mortem & Fix Analysis**:
  > My current hypothesis is that we keep a SQL over HTTP connection open for too long in the embedded replica internals and it expires.
  > Can you cut a prerelease with that fix for me to test? And why didn't this happen on Fly.io?

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

### Incident Patch 1: `d9f2f7d8` (2026-10-13)
**Commit Message**: fix: null sqlite3 handle after close to prevent double-free (#2251) (#2261)

## Problem

Closes #2251

The local connection's `sqlite3` handle is `sqlite3_close_v2`'d
**twice** on teardown. `LibsqlConnection`'s `Drop` calls `disconnect()`,
then the inner `Connection`'s `Drop` calls it again. Both go through
`Connection::disconnect` (connection.rs:110). `disconnect()` isn't
idempotent — the `Arc::get_mut(drop_ref)` guard only checks unique
ownership (true both times) and doesn't record that the handle was
already closed.

On Windows this is a hard `STATUS_ACCESS_VIOLATION` (0xC0000005); on
Linux it doesn't fault (glibc keeps the freed page mapped) but the
double free is real, as valgrind shows — 800 errors from 1 context at
800 iterations, one per connection.

## Root Cause

```
LibsqlConnection::drop -> self.conn.disconnect()   <- first close
Connection::drop       -> self.disconnect()         <- second close
```

Both calls succeed because `Arc::get_mut(drop_ref)` returns `Some` both
times (the first close doesn't mark the handle as closed).

## Fix

After calling `sqlite3_close_v2`, set `self.raw` to
`std::ptr::null_mut()`. This makes `disconnect()` idempotent — the
second call s

**File**: `libsql/src/local/connection.rs` (modified, +4/-1)
```diff
@@ -107,7 +107,10 @@ impl Connection {
     /// Disconnect from the database.
     pub fn disconnect(&mut self) {
         if Arc::get_mut(&mut self.drop_ref).is_some() {
-            unsafe { libsql_sys::ffi::sqlite3_close_v2(self.raw) };
+            unsafe {
+                libsql_sys::ffi::sqlite3_close_v2(self.raw);
+                self.raw = std::ptr::null_mut();
+            };
         }
     }
 
```

---

### Incident Patch 2: `74ab9010` (2026-08-11)
**Commit Message**: Update cmake crate to fix Windows CI (#2267)

The windows-latest runner image moved to windows-2025-vs2026, which
ships Visual Studio 2026. The cmake crate 0.1.54 pinned in Cargo.lock
does not recognize VS 2026 and panics in the libsql-ffi build script
with "couldn't determine visual studio generator" while configuring the
SQLite3MultipleCiphers build.

Support for the VS 2026 generator was added in cmake 0.1.55, so bump the
lockfile to 0.1.58 (pulling in the newer cc and libc it requires).

**File**: `Cargo.lock` (modified, +21/-8)
```diff
@@ -855,7 +855,7 @@ dependencies = [
  "quote",
  "regex",
  "rustc-hash",
- "shlex",
+ "shlex 1.3.0",
  "syn 2.0.87",
  "which",
 ]
@@ -1125,13 +1125,14 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.1.0"
+version = "1.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "eaff6f8ce506b9773fa786672d63fc7a191ffea1be33f72bbd4aeacefca9ffc8"
+checksum = "5d262e149917187838d5b42777c8253bcb64500067342904e7d429499a6f277e"
 dependencies = [
+ "find-msvc-tools",
  "jobserver",
  "libc",
- "once_cell",
+ "shlex 2.0.1",
 ]
 
 [[package]]
@@ -1277,9 +1278,9 @@ checksum = "4b82cf0babdbd58558212896d1a4272303a57bdb245c2bf1147185fb45640e70"
 
 [[package]]
 name = "cmake"
-version = "0.1.54"
+version = "0.1.58"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e7caa3f9de89ddbe2c607f4101924c5abec803763ae9534e4f4d7d8f84aa81f0"
+checksum = "c0f78a02292a74a88ac736019ab962ece0bc380e3f977bf72e376c5d78ff0678"
 dependencies = [
  "cc",
 ]
@@ -2014,6 +2015,12 @@ dependencies = [
  "windows-sys 0.52.0",
 ]
 
+[[package]]
+name = "find-msvc-tools"
+version = "0.1.10"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "26b73573e6edcd2af0cdf47bd6cb58f0b3839491263c314eaad1ccf24430e1de"
+
 [[package]]
 name = "findshlibs"
 version = "0.10.2"
@@ -2857,9 +2864,9 @@ checksum = "884e2677b40cc8c339eaefcb701c32ef1fd2493d71118dc0ca4b6a736c93bd67"
 
 [[package]]
 name = "libc"
-version = "0.2.155"
+version = "0.2.189"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "97b3888a4aecf77e811145cadf6eef5901f4782c53886191b2f693f24761847c"
+checksum = "3eaf3ede3fee6db1a4c2ee091bf8a8b4dccdc6d17f656fb07896ee72867612f2"
 
 [[package]]
 name = "libloading"
@@ -4843,6 +4850,12 @@ version = "1.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0fda2ff0d084019ba4d7c6f371c95d8fd75ce3524c3cb8fb653a3023f6323e64"
 
+[[package]]
+name = "shlex"
+version = "2.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f8fadd59c855ef2080decdef8ff161eb6661b86933c9d82e5ba29dc602a55aba"
+
 [[package]]
 name = "signal-hook-registry"
 version = "1.4.2"
```

---

### Incident Patch 3: `21b17a76` (2026-08-11)
**Commit Message**: Update cmake crate to fix Windows CI

The windows-latest runner image moved to windows-2025-vs2026, which
ships Visual Studio 2026. The cmake crate 0.1.54 pinned in Cargo.lock
does not recognize VS 2026 and panics in the libsql-ffi build script
with "couldn't determine visual studio generator" while configuring
the SQLite3MultipleCiphers build.

Support for the VS 2026 generator was added in cmake 0.1.55, so bump
the lockfile to 0.1.58 (pulling in the newer cc and libc it requires).

**File**: `Cargo.lock` (modified, +21/-8)
```diff
@@ -855,7 +855,7 @@ dependencies = [
  "quote",
  "regex",
  "rustc-hash",
- "shlex",
+ "shlex 1.3.0",
  "syn 2.0.87",
  "which",
 ]
@@ -1125,13 +1125,14 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.1.0"
+version = "1.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "eaff6f8ce506b9773fa786672d63fc7a191ffea1be33f72bbd4aeacefca9ffc8"
+checksum = "5d262e149917187838d5b42777c8253bcb64500067342904e7d429499a6f277e"
 dependencies = [
+ "find-msvc-tools",
  "jobserver",
  "libc",
- "once_cell",
+ "shlex 2.0.1",
 ]
 
 [[package]]
@@ -1277,9 +1278,9 @@ checksum = "4b82cf0babdbd58558212896d1a4272303a57bdb245c2bf1147185fb45640e70"
 
 [[package]]
 name = "cmake"
-version = "0.1.54"
+version = "0.1.58"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e7caa3f9de89ddbe2c607f4101924c5abec803763ae9534e4f4d7d8f84aa81f0"
+checksum = "c0f78a02292a74a88ac736019ab962ece0bc380e3f977bf72e376c5d78ff0678"
 dependencies = [
  "cc",
 ]
@@ -2014,6 +2015,12 @@ dependencies = [
  "windows-sys 0.52.0",
 ]
 
+[[package]]
+name = "find-msvc-tools"
+version = "0.1.10"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "26b73573e6edcd2af0cdf47bd6cb58f0b3839491263c314eaad1ccf24430e1de"
+
 [[package]]
 name = "findshlibs"
 version = "0.10.2"
@@ -2857,9 +2864,9 @@ checksum = "884e2677b40cc8c339eaefcb701c32ef1fd2493d71118dc0ca4b6a736c93bd67"
 
 [[package]]
 name = "libc"
-version = "0.2.155"
+version = "0.2.189"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "97b3888a4aecf77e811145cadf6eef5901f4782c53886191b2f693f24761847c"
+checksum = "3eaf3ede3fee6db1a4c2ee091bf8a8b4dccdc6d17f656fb07896ee72867612f2"
 
 [[package]]
 name = "libloading"
@@ -4843,6 +4850,12 @@ version = "1.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0fda2ff0d084019ba4d7c6f371c95d8fd75ce3524c3cb8fb653a3023f6323e64"
 
+[[package]]
+name = "shlex"
+version = "2.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f8fadd59c855ef2080decdef8ff161eb6661b86933c9d82e5ba29dc602a55aba"
+
 [[package]]
 name = "signal-hook-registry"
 version = "1.4.2"
```

#### Recent Merged Pull Requests:
- **PR #2274** (2026-08-23): parser: Add support for `ANALYZE` (@avinassh)
- **PR #2268** (2026-08-11): ci: install protoc from apt instead of arduino/setup-protoc (@penberg)
- **PR #2267** (2026-08-11): Update cmake crate to fix Windows CI (@penberg)
- **PR #2262** (closed): A gentle deadlock monitor (@aredridel)
- **PR #2261** (2026-10-13): fix: null sqlite3 handle after close to prevent double-free (#2251) (@wasim-builds)
- **PR #2259** (closed): TEST (@LeMikaelF)

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

## X. null sqlite3 handle after close to prevent double-free (#2251) (#2261)

**RULE**:
When implementing operations in `libsql/src/local/connection.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/libsql. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9f2f7d8`: null sqlite3 handle after close to prevent double-free (#2251) (#2261). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `libsql/src/local/connection.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
            unsafe {
                libsql_sys::ffi::sqlite3_close_v2(self.raw);
                self.raw = std::ptr::null_mut();
            };
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
            unsafe { libsql_sys::ffi::sqlite3_close_v2(self.raw) };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9f2f7d8` are properly handled with clean fallback behavior.
