# Forensic Learning Record (Deep Inspection): tursodatabase/libsql

> **Canonical Artifact**: `07_PROJECT_LEARNING/libsql-libsql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/libsql/libsql](https://github.com/libsql/libsql))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:23:07.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/libsql`
- **Description**: libSQL is a fork of SQLite that is both Open Source, and Open Contributions.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 17258 stars

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

### Core Architecture Module: `libsql-sqlite3/ext/crr/rs/core/src/backfill.rs`
```
use sqlite_nostd::{sqlite3, Connection, Destructor, ManagedStmt, ResultCode};
extern crate alloc;
use crate::tableinfo::ColumnInfo;
use crate::util::get_dflt_value;
use alloc::format;
use alloc::string::String;
use alloc::{vec, vec::Vec};
use sqlite_nostd as sqlite;

/**
 * Backfills rows in a table with clock values.
 */
pub fn backfill_table(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<ColumnInfo>,
    is_commit_alter: bool,
    no_tx: bool,
) -> Result<ResultCode, ResultCode> {
    if !no_tx {
        db.exec_safe("SAVEPOINT backfill")?;
    }

    let sql = format!(
        "SELECT {pk_cols} FROM \"{table}\" AS t1
        EXCEPT SELECT {pk_cols} FROM \"{table}__crsql_pks\" AS t2",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
    );
    let stmt = db.prepare_v2(&sql);

    let non_pk_cols_refs = non_pk_cols.iter().collect::<Vec<_>>();
    let result = match stmt {
        Ok(stmt) => create_clock_rows_from_stmt(
            stmt,
            db,
            table,
            pk_cols,
            &non_pk_cols_refs,
            is_commit_alter,
        ),
        Err(e) => Err(e),
    };

    if let Err(e) = result {
        if !no_tx {
            db.exec_safe("ROLLBACK")?;
        }

        return Err(e);
    }

    if let Err(e) = backfill_missing_columns(db, table, pk_cols, non_pk_cols, is_commit_alter) {
        if !no_tx {
            db.exec_safe("ROLLBACK")?;
        }

        return Err(e);
    }

    if !no_tx {
        db.exec_safe("RELEASE backfill")
    } else {
        Ok(ResultCode::OK)
    }
}

/**
* Given a statement that returns rows in the source table not present
* in the clock table, create those rows in the clock table.
*/
fn create_clock_rows_from_stmt(
    read_stmt: ManagedStmt,
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<&ColumnInfo>,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    let select_key = db.prepare_v2(&format!(
        "SELECT __crsql_key FROM \"{table}__crsql_pks\" WHERE {pk_where_conditions}",
        table = crate::util::escape_ident(table),
        pk_where_conditions = crate::util::where_list(pk_cols, None)?
    ))?;
    let create_key = db.prepare_v2(&format!(
        "INSERT INTO \"{table}__crsql_pks\" ({pk_cols}) VALUES ({pk_values}) RETURNING __crsql_key",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
        pk_values = pk_cols.iter().map(|_| "?").collect::<Vec<_>>().join(", "),
    ))?;
    // We do not grab nextdbversion on migration.
    // The idea is that other nodes will apply the same migration
    // in the future so if they have already seen this node up
    // to the current db version then the migration will place them into the correct
    // state. No need to re-sync post migration.
    // or-ignore since we do not drop sentinel values during compaction as they act as our metadata
    // to determine if rows should resurrect on a future insertion event provided by a peer.
    let sql = format!(
        "INSERT OR IGNORE INTO \"{table}__crsql_clock\"
          (key, col_name, col_version, db_version, seq) VALUES
          (?, ?, 1, {dbversion_getter}, crsql_increment_and_get_seq())",
        table = crate::util::escape_ident(table),
        dbversion_getter = if is_commit_alter {
            "crsql_db_version()"
        } else {
            "crsql_next_db_version()"
        }
    );
    let write_stmt = db.prepare_v2(&sql)?;

    while read_stmt.step()? == ResultCode::ROW {
        let key = get_or_create_key(&select_key, &create_key, pk_cols, &read_stmt)?;
        write_stmt.bind_int64(1, key)?;

        for col in non_pk_cols.iter() {
            // We even backfill default values since we can't differentiate between an explicit
            // reset to a default vs an implicit set to default on create. Do we? I don't think we do set defaults.
            write_stmt.bind_text(2, &col.name, Destructor::STATIC)?;
            write_stmt.step()?;
            write_stmt.reset()?;
        }
        if non_pk_cols.len() == 0 {
            write_stmt.bind_text(2, crate::c::INSERT_SENTINEL, Destructor::STATIC)?;
            write_stmt.step()?;
            write_stmt.reset()?;
        }
    }

    Ok(ResultCode::OK)
}

fn get_or_create_key(
    select_stmt: &ManagedStmt,
    create_stmt: &ManagedStmt,
    pk_cols: &Vec<ColumnInfo>,
    read_stmt: &ManagedStmt,
) -> Result<sqlite::int64, ResultCode> {
    for (i, _name) in pk_cols.iter().enumerate() {
        let value = read_stmt.column_value(i as i32)?;
        // TODO: ok to bind into to places at once?
        select_stmt.bind_value(i as i32 + 1, value)?;
        create_stmt.bind_value(i as i32 + 1, value)?;
    }

    if let Ok(ResultCode::ROW) = select_stmt.step() {
        let key = select_stmt.column_int64(0);
        create_stmt.clear_bindings()?;
        select_stmt.reset()?;
        return Ok(key);
    }
    select_stmt.reset()?;

    if let Ok(ResultCode::ROW) = create_stmt.step() {
        let key = create_stmt.column_int64(0);
        create_stmt.reset()?;
        return Ok(key);
    }
    create_stmt.reset()?;

    return Err(ResultCode::ERROR);
}

/**
* For each column, make sure there was a clock table entry.
* If not, fill the data in for it for each row.
*
* Can we optimize and skip cases where it is equivalent to the default value?
* E.g., adding a new column set to default values should not require a backfill...
*/
fn backfill_missing_columns(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<ColumnInfo>,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    for non_pk_col in non_pk_cols {
        fill_column(db, table, pk_cols, &non_pk_col, is_commit_alter)?;
    }

    Ok(ResultCode::OK)
}

// This doesn't fill compeltely new columns...
// Wel... does it not? The on condition x left join should do it.
fn fill_column(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_col: &ColumnInfo,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    // Only fill rows for which
    // - a row does not exist for that pk combo _and_ the cid in the clock table.
    // - the value is not the default value for that column.
    let dflt_value = get_dflt_value(db, table, &non_pk_col.name)?;
    let sql = format!(
        "SELECT {pk_cols} FROM {table} as t1
          JOIN \"{table}__crsql_pks\" as t2 ON {pk_on_conditions}
          LEFT JOIN \"{table}__crsql_clock\" as t3 ON t3.key = t2.__crsql_key AND t3.col_name = ?
          WHERE t3.key IS NULL {dflt_value_condition}",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("t1.\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
        pk_on_conditions = pk_cols
            .iter()
            .map(|f| format!(
                "t1.\"{}\" = t2.\"{}\"",
                crate::util::escape_ident(&f.name),
                crate::util::escape_ident(&f.name)
            ))
            .collect::<Vec<_>>()
            .join(" AND "),
        dflt_value_condition = if let Some(dflt) = dflt_value {
            format!("AND t1.\"{}\" IS NOT {}", &non_pk_col.name, dflt)
        } else {
            String::from("")
        },
    );
    let read_stmt = db.prepare_v2(&sql)?;
    read_stmt.bind_text(1, &non_pk_col.name, Destructor::STATIC)?;

    // TODO: rm clone?
    let non_pk_cols = vec![non_pk_col];
    create_clock_rows_from_stmt(read_stmt, db, table, pk_cols, &non_pk_cols, is_commit_alter)
}

```

### Core Architecture Module: `libsql-sqlite3/ext/crr/rs/core/src/bootstrap.rs`
```
use core::ffi::{c_char, c_int};

use crate::{consts, tableinfo::TableInfo};
use alloc::{ffi::CString, format};
use core::slice;
use sqlite::{sqlite3, Connection, Destructor, ResultCode};
use sqlite_nostd as sqlite;

fn uuid() -> [u8; 16] {
    let mut blob: [u8; 16] = [0; 16];
    sqlite::randomness(&mut blob);
    blob[6] = (blob[6] & 0x0f) + 0x40;
    blob[8] = (blob[8] & 0x3f) + 0x80;
    blob
}

#[no_mangle]
pub extern "C" fn crsql_init_site_id(db: *mut sqlite3, ret: *mut u8) -> c_int {
    let buffer: &mut [u8] = unsafe { slice::from_raw_parts_mut(ret, 16) };
    if let Ok(site_id) = init_site_id(db) {
        buffer.copy_from_slice(&site_id);
        ResultCode::OK as c_int
    } else {
        ResultCode::ERROR as c_int
    }
}

fn insert_site_id(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    let stmt = db.prepare_v2(&format!(
        "INSERT INTO \"{tbl}\" (site_id, ordinal) VALUES (?, 0)",
        tbl = consts::TBL_SITE_ID
    ))?;

    let site_id = uuid();
    stmt.bind_blob(1, &site_id, Destructor::STATIC)?;
    stmt.step()?;

    Ok(site_id)
}

fn create_site_id_and_site_id_table(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    db.exec_safe(&format!(
        "CREATE TABLE \"{tbl}\" (site_id BLOB NOT NULL, ordinal INTEGER PRIMARY KEY);
        CREATE UNIQUE INDEX {tbl}_site_id ON \"{tbl}\" (site_id);",
        tbl = consts::TBL_SITE_ID
    ))?;

    insert_site_id(db)
}

#[no_mangle]
pub extern "C" fn crsql_init_peer_tracking_table(db: *mut sqlite3) -> c_int {
    match db.exec_safe("CREATE TABLE IF NOT EXISTS crsql_tracked_peers (\"site_id\" BLOB NOT NULL, \"version\" INTEGER NOT NULL, \"seq\" INTEGER DEFAULT 0, \"tag\" INTEGER, \"event\" INTEGER, PRIMARY KEY (\"site_id\", \"tag\", \"event\")) STRICT;") {
      Ok(_) => ResultCode::OK as c_int,
      Err(code) => code as c_int
    }
}

fn has_table(db: *mut sqlite3, table_name: &str) -> Result<bool, ResultCode> {
    let stmt =
        db.prepare_v2("SELECT 1 FROM sqlite_master WHERE type = 'table' AND tbl_name = ?")?;
    stmt.bind_text(1, table_name, Destructor::STATIC)?;
    let tbl_exists_result = stmt.step()?;
    Ok(tbl_exists_result == ResultCode::ROW)
}

/**
 * Loads the siteId into memory. If a site id
 * cannot be found for the given database one is created
 * and saved to the site id table.
 */
fn init_site_id(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    if !has_table(db, consts::TBL_SITE_ID)? {
        return create_site_id_and_site_id_table(db);
    }

    let stmt = db.prepare_v2(&format!(
        "SELECT site_id FROM \"{}\" WHERE ordinal = 0",
        consts::TBL_SITE_ID
    ))?;
    let result_code = stmt.step()?;

    let ret = if result_code == ResultCode::DONE {
        insert_site_id(db)?
    } else {
        let site_id_from_table = stmt.column_blob(0)?;
        site_id_from_table.try_into()?
    };

    Ok(ret)
}

fn crsql_create_schema_table_if_not_exists(db: *mut sqlite3) -> Result<ResultCode, ResultCode> {
    db.exec_safe("SAVEPOINT crsql_create_schema_table;")?;

    if let Ok(_) = db.exec_safe(&format!(
        "CREATE TABLE IF NOT EXISTS \"{}\" (\"key\" TEXT PRIMARY KEY, \"value\" ANY);",
        consts::TBL_SCHEMA
    )) {
        db.exec_safe("RELEASE crsql_create_schema_table;")
    } else {
        let _ = db.exec_safe("ROLLBACK");
        Err(ResultCode::ERROR)
    }
}

#[no_mangle]
pub extern "C" fn crsql_maybe_update_db(db: *mut sqlite3, err_msg: *mut *mut c_char) -> c_int {
    // No schema table? First time this DB has been opened with this extension.
    if let Ok(has_schema_table) = has_table(db, consts::TBL_SCHEMA) {
        if let Err(code) = crsql_create_schema_table_if_not_exists(db) {
            return code as c_int;
        }
        let r = db.exec_safe("SAVEPOINT crsql_maybe_update_db;");
        if let Err(code) = r {
            return code as c_int;
        }
        if let Ok(_) = maybe_update_db_inner(db, has_schema_table == false, err_msg) {
            let _ = db.exec_safe("RELEASE crsql_maybe_update_db;");
            return ResultCode::OK as c_int;
        } else {
            let _ = db.exec_safe("ROLLBACK;");
            return ResultCode::ERROR as c_int;
        }
    } else {
        return ResultCode::ERROR as c_int;
    }
}

fn maybe_update_db_inner(
    db: *mut sqlite3,
    is_blank_slate: bool,
    err_msg: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let mut recorded_version: i32 = 0;

    // Completely new DBs need no migrations.
    // We can set them to the current version.
    if is_blank_slate {
        recorded_version = consts::CRSQLITE_VERSION;
    } else {
        let stmt =
            db.prepare_v2("SELECT value FROM crsql_master WHERE key = 'crsqlite_version'")?;
        let step_result = stmt.step()?;
        if step_result == ResultCode::ROW {
            recorded_version = stmt.column_int(0);
        }
    }

    if recorded_version < consts::CRSQLITE_VERSION && !is_blank_slate {
        // todo: return an error message to the user that their version is
        // not supported
        let cstring = CString::new(format!("Opening a db created with cr-sqlite version {} is not supported. Upcoming release 0.15.0 is a breaking change.", recorded_version))?;
        unsafe {
            (*err_msg) = cstring.into_raw();
            return Err(ResultCode::ERROR);
        }
    }

    // if recorded_version < consts::CRSQLITE_VERSION_0_13_0 {
    //     update_to_0_13_0(db)?;
    // }

    // if recorded_version < consts::CRSQLITE_VERSION_0_15_0 {
    //     update_to_0_15_0(db)?;
    // }

    // write the db version if we migrated to a new one or we are a blank slate db
    if recorded_version < consts::CRSQLITE_VERSION || is_blank_slate {
        let stmt =
            db.prepare_v2("INSERT OR REPLACE INTO crsql_master VALUES ('crsqlite_version', ?)")?;
        stmt.bind_int(1, consts::CRSQLITE_VERSION)?;
        stmt.step()?;
    }

    Ok(ResultCode::OK)
}

/**
 * The clock table holds the versions for each column of a given row.
 *
 * These version are set to the dbversion at the time of the write to the
 * column.
 *
 * The dbversion is updated on transaction commit.
 * This allows us to find all columns written in the same transaction
 * albeit with caveats.
 *
 * The caveats being that two partiall overlapping transactions will
 * clobber the full transaction picture given we only keep latest
 * state and not a full causal history.
 *
 * @param tableInfo
 */
pub fn create_clock_table(
    db: *mut sqlite3,
    table_info: &TableInfo,
    _err: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let pk_list = crate::util::as_identifier_list(&table_info.pks, None)?;
    let table_name = &table_info.tbl_name;

    db.exec_safe(&format!(
        "CREATE TABLE IF NOT EXISTS \"{table_name}__crsql_clock\" (
      key INTEGER NOT NULL,
      col_name TEXT NOT NULL,
      col_version INTEGER NOT NULL,
      db_version INTEGER NOT NULL,
      site_id INTEGER NOT NULL DEFAULT 0,
      seq INTEGER NOT NULL,
      PRIMARY KEY (key, col_name)
    ) WITHOUT ROWID, STRICT",
        table_name = crate::util::escape_ident(table_name),
    ))?;

    db.exec_safe(
      &format!(
        "CREATE INDEX IF NOT EXISTS \"{table_name}__crsql_clock_dbv_idx\" ON \"{table_name}__crsql_clock\" (\"db_version\")",
        table_name = crate::util::escape_ident(table_name),
      ))?;
    db.exec_safe(
      &format!(
        "CREATE TABLE IF NOT EXISTS \"{table_name}__crsql_pks\" (__crsql_key INTEGER PRIMARY KEY, {pk_list})",
        table_name = table_name,
        pk_list = pk_list,
      )
    )?;
    db.exec_safe(
      &format!(
        "CREATE UNIQUE INDEX IF NOT EXISTS \"{table_name}__crsql_pks_pks\" ON \"{table_name}__crsql_pks\" ({pk_list})",
        table_name = table_name,
        pk_list = pk_list
      )
    )
}

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
  > @npearson72 that's a different issue.

- **Issue #2083** (2025-06-24): **Embedded Replica update fails**
  *Symptoms*: When using Embedded Replicas, calling the UPDATE api results in `Hrana 404 "stream not found"`  `@libsql/client: 0.15.7`  Edit: turso dies after a few minutes... even GET requests are 404ing.  Edit2: 0.15.8 did not fix
  **Post-Mortem & Fix Analysis**:
  > My current hypothesis is that we keep a SQL over HTTP connection open for too long in the embedded replica internals and it expires.
  > Can you cut a prerelease with that fix for me to test? And why didn't this happen on Fly.io?
  > I'm also getting `wal_insert_begin failed` when writing. Is this happening when the `syncInterval` is running and locking the database when I try to write?

- **Issue #2076** (2025-05-29): **Embedded replicas (and offline sync) databases are slow if you set `sync_interval`**
  *Symptoms*: If you set `sync_interval`, then `sync` calls take as much as time the `sync_interval` value is set to. This issue is observed in JS SDK (https://github.com/tursodatabase/libsql-js) and this doesn't happen in Rust client.   There are two discord users reporting the same and following links also contain reproducers:   https://discord.com/channels/933071162680958986/1374700570514030592  https://discord.com/channels/933071162680958986/1374075561017741312/1375111427890614435

- **Issue #2061** (2025-06-02): **AWS Embedded Replica returns undefined in transactions.**
  *Symptoms*: Link to repro: https://github.com/khuezy/libsql_bug
  **Post-Mortem & Fix Analysis**:
  > Fixed in latest version.

- **Issue #2059** (2025-05-14): **Sync interval not implemented for V2 sync protocol**
  *Symptoms*: 

- **Issue #2035** (2025-05-14): **Embedded Replica "returning" returns undefined on AWS**
  *Symptoms*: When using `RETURNING` with Embedded Replicas on the new AWS infra, the query returns no data.  I'm using Drizzle-ORM with this query:  `db.update(table).set({ field: 'value' }).where(...).returning().get()`  With Embedded Replicas off, this returns the updated record; with Embedded Replicas on, this returns undefined.
  **Post-Mortem & Fix Analysis**:
  > Yes same here. Glad I found this issue.  
  > I just double checked. Same for this: `await db.insert(Session).values(session)` The `ResultSet` is empty. 
  > @Syntarex I think `insert` works. Can you try adding `.returning().get()`, that should return you the created record. I think this only applies to `update` as far as I know.

- **Issue #2026** (2025-04-11): **Embedded replica V2 can sometimes accidentally use WAL push**
  *Symptoms*: 

- **Issue #2004** (2025-04-01): **Embedded replica write delegation issue**
  *Symptoms*: There seems to be a problem with write delegation where the parser that determines if we should write locally or remotely gets in a bad state.  Examples of the issue:  https://github.com/tursodatabase/libsql-experimental-python/issues/87  https://discord.com/channels/933071162680958986/1354752676260483112

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

### Incident Patch 1: `f8fb14f3` (2026-08-11)
**Commit Message**: ci: install protoc from apt instead of arduino/setup-protoc (#2268)

The setup-protoc action downloads protoc via unauthenticated GitHub API
requests, which share a rate limit across all runners on the same IP and
intermittently fail with "API rate limit exceeded". Our proto files are
all plain proto3, so the protobuf-compiler package from the Ubuntu
archive is sufficient and involves no GitHub API at all.

**File**: `.github/workflows/c-bindings.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
     - uses: dtolnay/rust-toolchain@stable
 
     - name: Install Protoc
-      uses: arduino/setup-protoc@v2
+      run: sudo apt-get update && sudo apt-get install -y protobuf-compiler
 
     - name: Set up cargo cache
       uses: actions/cache@v3
```

**File**: `.github/workflows/golang-bindings.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
       run: sudo apt-get install -y tcl8.6-dev
 
     - name: Install Protoc
-      uses: arduino/setup-protoc@v2
+      run: sudo apt-get update && sudo apt-get install -y protobuf-compiler
 
     - name: Set up cargo cache
       uses: actions/cache@v3
```

---

### Incident Patch 2: `4ab674d5` (2026-08-11)
**Commit Message**: ci: install protoc from apt instead of arduino/setup-protoc

The setup-protoc action downloads protoc via unauthenticated GitHub
API requests, which share a rate limit across all runners on the same
IP and intermittently fail with "API rate limit exceeded". Our proto
files are all plain proto3, so the protobuf-compiler package from the
Ubuntu archive is sufficient and involves no GitHub API at all.

**File**: `.github/workflows/c-bindings.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
     - uses: dtolnay/rust-toolchain@stable
 
     - name: Install Protoc
-      uses: arduino/setup-protoc@v2
+      run: sudo apt-get update && sudo apt-get install -y protobuf-compiler
 
     - name: Set up cargo cache
       uses: actions/cache@v3
```

**File**: `.github/workflows/golang-bindings.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
       run: sudo apt-get install -y tcl8.6-dev
 
     - name: Install Protoc
-      uses: arduino/setup-protoc@v2
+      run: sudo apt-get update && sudo apt-get install -y protobuf-compiler
 
     - name: Set up cargo cache
       uses: actions/cache@v3
```

---

### Incident Patch 3: `74ab9010` (2026-08-11)
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

### Incident Patch 4: `21b17a76` (2026-08-11)
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

---

### Incident Patch 5: `5cdc619d` (2026-06-02)
**Commit Message**: libsql-server: fix duplicated "the" in doc-comments (#2234)

Two one-line typo fixes for duplicated "the" in `libsql-server`
doc-comments:
- `libsql-server/src/main.rs` — "By default, the the period is 30
seconds." → "By default, the period is 30 seconds."
- `libsql-server/src/rpc/streaming_exec.rs` — "/// Apply the response to
the the builder, and return whether..." → "/// Apply the response to the
builder, ..."

No code/behavior change.

**File**: `libsql-server/src/main.rs` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ struct Cli {
     heartbeat_auth: Option<String>,
 
     /// The heartbeat time period in seconds.
-    /// By default, the the period is 30 seconds.
+    /// By default, the period is 30 seconds.
     #[clap(long, env = "SQLD_HEARTBEAT_PERIOD_S", default_value = "30")]
     heartbeat_period_s: u64,
 
```

**File**: `libsql-server/src/rpc/streaming_exec.rs` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ impl StreamResponseBuilder {
     }
 }
 
-/// Apply the response to the the builder, and return whether the builder need more steps
+/// Apply the response to the builder, and return whether the builder need more steps
 pub fn apply_program_resp_to_builder<B: QueryResultBuilder>(
     config: &QueryBuilderConfig,
     builder: &mut B,
```

---

### Incident Patch 6: `58161459` (2026-05-28)
**Commit Message**: github: Build the Windows CI job with the MSVC toolchain (#2242)

The Windows job's `cargo build -p libsql --all-features` was being built
with the `x86_64-pc-windows-gnu` toolchain (MinGW/GCC), set as the
default host triple by `hecrj/setup-rust-action@v2`. MSVC was never
exercised. So breaks that only fail under MSVC -- like the SQLite 3.47.0
`#warning` that errors with C1021 -- compiled green here. We discovered
the gap when libsql-js (which builds with `--target
x86_64-pc-windows-msvc`) failed downstream on the same code.

Add `--target x86_64-pc-windows-msvc --release` so the Windows job
actually compiles the bundled SQLite encryption amalgamation (sqlite3mc)
with MSVC, and breaks surface in CI.

`cargo clean -p libsql-ffi` runs first so sqlite3mc is rebuilt from
source rather than restored from a cached target/.

**File**: `.github/workflows/rust.yml` (modified, +7/-4)
```diff
@@ -242,11 +242,14 @@ jobs:
             ~/.cargo/registry/index/
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
-            target/
-          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
-          restore-keys: ${{ runner.os }}-cargo-
+          key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
+          restore-keys: ${{ runner.os }}-cargo-registry-
+      - name: Install x86_64-pc-windows-msvc target
+        run: rustup target add x86_64-pc-windows-msvc
       - name: build libsql all features
-        run: cargo build -p libsql --all-features 
+        run: |
+          cargo clean -p libsql-ffi
+          cargo build -p libsql --all-features --release --target x86_64-pc-windows-msvc
 
   # test-rust-wasm:
   #   runs-on: ubuntu-latest
```

---

### Incident Patch 7: `e3f7e8ee` (2026-05-28)
**Commit Message**: github: Build the Windows CI job with the MSVC toolchain

The Windows job's `cargo build -p libsql --all-features` was being built
with the `x86_64-pc-windows-gnu` toolchain (MinGW/GCC), set as the default
host triple by `hecrj/setup-rust-action@v2`. MSVC was never exercised. So
breaks that only fail under MSVC -- like the SQLite 3.47.0 `#warning` that
errors with C1021 -- compiled green here. We discovered the gap when
libsql-js (which builds with `--target x86_64-pc-windows-msvc`) failed
downstream on the same code.

Add `--target x86_64-pc-windows-msvc --release` so the Windows job
actually compiles the bundled SQLite encryption amalgamation (sqlite3mc)
with MSVC, and breaks surface in CI.

`cargo clean -p libsql-ffi` runs first so sqlite3mc is rebuilt from source
rather than restored from a cached target/.

**File**: `.github/workflows/rust.yml` (modified, +7/-4)
```diff
@@ -242,11 +242,14 @@ jobs:
             ~/.cargo/registry/index/
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
-            target/
-          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
-          restore-keys: ${{ runner.os }}-cargo-
+          key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
+          restore-keys: ${{ runner.os }}-cargo-registry-
+      - name: Install x86_64-pc-windows-msvc target
+        run: rustup target add x86_64-pc-windows-msvc
       - name: build libsql all features
-        run: cargo build -p libsql --all-features 
+        run: |
+          cargo clean -p libsql-ffi
+          cargo build -p libsql --all-features --release --target x86_64-pc-windows-msvc
 
   # test-rust-wasm:
   #   runs-on: ubuntu-latest
```

---

### Incident Patch 8: `a6b1de0d` (2026-05-26)
**Commit Message**: libsql-sqlite3: Sync ext/misc/fileio.c symlink fixes from 3.46.1

The 3.46.1 merge updated shell8.test (adding the symlink extraction
tests shell8-3.x) and the bundled MultipleCiphers fileio.c, but left
libsql-sqlite3/ext/misc/fileio.c at 3.44.0. That file is embedded into
the CLI shell via 'INCLUDE ../ext/misc/fileio.c', so '.ar -x' ran the
stale writeFile() and the new tests failed with
'failed to create symlink: link1'.

Bring writeFile() in line with upstream 3.46.1:

  - Skip utimes() on symbolic links. utimes() follows the link to its
    target; the archive only contains link1 -> file1 (no file1), so the
    dangling link made utimes() fail and broke the first extraction
    (shell8-3.2).
  - unlink(zFile) before symlink() so re-extraction does not fail with
    EEXIST (shell8-3.3).

**File**: `libsql-sqlite3/ext/misc/fileio.c` (modified, +16/-8)
```diff
@@ -372,7 +372,9 @@ static int writeFile(
 #if !defined(_WIN32) && !defined(WIN32)
   if( S_ISLNK(mode) ){
     const char *zTo = (const char*)sqlite3_value_text(pData);
-    if( zTo==0 || symlink(zTo, zFile)<0 ) return 1;
+    if( zTo==0 ) return 1;
+    unlink(zFile);
+    if( symlink(zTo, zFile)<0 ) return 1;
   }else
 #endif
   {
@@ -458,13 +460,19 @@ static int writeFile(
       return 1;
     }
 #else
-    /* Legacy unix */
-    struct timeval times[2];
-    times[0].tv_usec = times[1].tv_usec = 0;
-    times[0].tv_sec = time(0);
-    times[1].tv_sec = mtime;
-    if( utimes(zFile, times) ){
-      return 1;
+    /* Legacy unix.
+    **
+    ** Do not use utimes() on a symbolic link - it sees through the link and
+    ** modifies the timestamps on the target. Or fails if the target does
+    ** not exist.  */
+    if( 0==S_ISLNK(mode) ){
+      struct timeval times[2];
+      times[0].tv_usec = times[1].tv_usec = 0;
+      times[0].tv_sec = time(0);
+      times[1].tv_sec = mtime;
+      if( utimes(zFile, times) ){
+        return 1;
+      }
     }
 #endif
   }
```

---

### Incident Patch 9: `cc9cfaae` (2026-05-14)
**Commit Message**: libsql-server: fix duplicated "the" in doc-comments

**File**: `libsql-server/src/main.rs` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ struct Cli {
     heartbeat_auth: Option<String>,
 
     /// The heartbeat time period in seconds.
-    /// By default, the the period is 30 seconds.
+    /// By default, the period is 30 seconds.
     #[clap(long, env = "SQLD_HEARTBEAT_PERIOD_S", default_value = "30")]
     heartbeat_period_s: u64,
 
```

**File**: `libsql-server/src/rpc/streaming_exec.rs` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ impl StreamResponseBuilder {
     }
 }
 
-/// Apply the response to the the builder, and return whether the builder need more steps
+/// Apply the response to the builder, and return whether the builder need more steps
 pub fn apply_program_resp_to_builder<B: QueryResultBuilder>(
     config: &QueryBuilderConfig,
     builder: &mut B,
```

---

### Incident Patch 10: `e4beacaa` (2026-03-25)
**Commit Message**: Fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
 >
 > **libSQL** (this repository) is an open-source fork of SQLite. It extends SQLite with features like embedded replicas and remote access, but inherits SQLite's fundamental limitations such as the single-writer model.
 >
-> **[Turso](https://github.com/tursodatabase/turso) database** is a SQLite-compatible database rewritten from scratch in Rust. It is **not** a fork of SQLite — it is a completely new implementation that goes beyond what any SQLite fork can offer, including concurrent writes and bi-directional sync with offline support. Turso is currently in beta.
+> **[Turso database](https://github.com/tursodatabase/turso)** is a SQLite-compatible database rewritten from scratch in Rust. It is **not** a fork of SQLite — it is a completely new implementation that goes beyond what any SQLite fork can offer, including concurrent writes and bi-directional sync with offline support. Turso is currently in beta.
 >
 > **If you're starting a new project, you probably want to look into [Turso](https://github.com/tursodatabase/turso).** libSQL is actively maintained, but new features are being developed in Turso.
 
```

---

### Incident Patch 11: `dda04140` (2026-03-19)
**Commit Message**: libsql: Fix total_changes accumulation for SQL over HTTP batch execution (#2220)

The batch_inner() updates affected_row_count but never adds it to
total_changes. Only finalize() did, so total_changes was missing the
contributions of all intermediate batch/execute operations.

Found while investigating
https://github.com/tursodatabase/libsql-client-ts/issues/312

**File**: `libsql/src/hrana/stream.rs` (modified, +3/-0)
```diff
@@ -163,6 +163,9 @@ where
                     self.inner
                         .affected_row_count
                         .store(result.affected_row_count, Ordering::SeqCst);
+                    self.inner
+                        .total_changes
+                        .fetch_add(result.affected_row_count, Ordering::SeqCst);
                     if let Some(last_insert_rowid) = result.last_insert_rowid {
                         self.inner
                             .last_insert_rowid
```

---

### Incident Patch 12: `eb0fe775` (2026-03-19)
**Commit Message**: Pin cargo-chef to 0.1.75 to fix Docker build on rustc 1.85.0

cargo-chef 0.1.76+ switched to guppy, which transitively pulls in
cargo_metadata@0.23.1, cargo-platform@0.3.2, and target-spec@3.5.7,
all requiring rustc 1.86+.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ RUN cat rust-toolchain.toml | grep "channel" | awk '{print $3}' | sed 's/\"//g'
     && rustup update $(cat toolchain.txt) \
     && rustup default $(cat toolchain.txt) \
     && rm toolchain.txt rust-toolchain.toml \
-    && cargo install cargo-chef --locked
+    && cargo install cargo-chef --version 0.1.75 --locked
 
 FROM chef AS planner
 ARG BUILD_DEBUG=false
```

---

### Incident Patch 13: `3044eb73` (2026-03-19)
**Commit Message**: Fix Docker build by using --locked for cargo-chef install (#2222)

cargo-chef's transitive dependencies (cargo-platform, cargo_metadata,
guppy, target-spec) bumped their MSRV to Rust 1.86-1.88, breaking the
install on our pinned Rust 1.85.0 toolchain. Using --locked forces cargo
to use cargo-chef's bundled lockfile, which is tested against its
supported Rust versions.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ RUN cat rust-toolchain.toml | grep "channel" | awk '{print $3}' | sed 's/\"//g'
     && rustup update $(cat toolchain.txt) \
     && rustup default $(cat toolchain.txt) \
     && rm toolchain.txt rust-toolchain.toml \
-    && cargo install cargo-chef
+    && cargo install cargo-chef --locked
 
 FROM chef AS planner
 ARG BUILD_DEBUG=false
```

---

### Incident Patch 14: `46a0527a` (2026-03-19)
**Commit Message**: Fix Docker build by using --locked for cargo-chef install

cargo-chef's transitive dependencies (cargo-platform, cargo_metadata,
guppy, target-spec) bumped their MSRV to Rust 1.86-1.88, breaking the
install on our pinned Rust 1.85.0 toolchain. Using --locked forces
cargo to use cargo-chef's bundled lockfile, which is tested against
its supported Rust versions.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ RUN cat rust-toolchain.toml | grep "channel" | awk '{print $3}' | sed 's/\"//g'
     && rustup update $(cat toolchain.txt) \
     && rustup default $(cat toolchain.txt) \
     && rm toolchain.txt rust-toolchain.toml \
-    && cargo install cargo-chef
+    && cargo install cargo-chef --locked
 
 FROM chef AS planner
 ARG BUILD_DEBUG=false
```

---

### Incident Patch 15: `b7cc2b86` (2026-03-18)
**Commit Message**: libsql: Fix total_changes accumulation for SQL over HTTP batch execution

The batch_inner() updates affected_row_count but never adds it to
total_changes. Only finalize() did, so total_changes was missing the
contributions of all intermediate batch/execute operations.

**File**: `libsql/src/hrana/stream.rs` (modified, +3/-0)
```diff
@@ -163,6 +163,9 @@ where
                     self.inner
                         .affected_row_count
                         .store(result.affected_row_count, Ordering::SeqCst);
+                    self.inner
+                        .total_changes
+                        .fetch_add(result.affected_row_count, Ordering::SeqCst);
                     if let Some(last_insert_rowid) = result.last_insert_rowid {
                         self.inner
                             .last_insert_rowid
```

#### Recent Merged Pull Requests:
- **PR #2274** (2026-08-23): parser: Add support for `ANALYZE` (@avinassh)
- **PR #2268** (2026-08-11): ci: install protoc from apt instead of arduino/setup-protoc (@penberg)
- **PR #2267** (2026-08-11): Update cmake crate to fix Windows CI (@penberg)
- **PR #2262** (closed): A gentle deadlock monitor (@aredridel)
- **PR #2259** (closed): TEST (@LeMikaelF)
- **PR #2252** (2026-07-01): savepoint forget hook (@jussisaurio)
- **PR #2249** (closed): Delete CONTRIBUTING.md  file from forked repo (@CJ-cmd-byte)
- **PR #2248** (2026-06-02): libsql-sqlite3: Make libsql_stmt_interrupt() abort an in-flight step (@penberg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
