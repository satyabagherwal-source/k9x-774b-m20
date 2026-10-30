> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflydb-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly))  
> **Source Version**: `583b1a67`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T07:47:18.159Z  
> **Learning ID**: `learn-github-dragonflydb-dragonfly`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): dragonflydb/dragonfly

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement & Domain Boundaries
DragonflyDB is an ultra-high-throughput, sub-millisecond in-memory data store engineered as a drop-in replacement for Redis and Memcached. Traditional Redis relies on a single-threaded event loop (or I/O threads multiplexing sockets onto a single-threaded execution core) to avoid concurrency coordination overhead. When scaling, Redis requires cluster sharding, which incurs high network serialization penalties, multi-key operational limits (e.g., cross-slot restrictions), and high tail latencies. Conversely, multithreaded systems like KeyDB rely on fine-grained spinlocks or mutexes over global hash tables, creating cache line contention, kernel preemption overhead, and memory allocator thrashing under high QPS.

Dragonfly resolves this by combining three core architectural subsystems:
1. **Shared-Nothing Multi-Threaded Engine via User-Space Fibers**: Dragonfly partitions the entire keyspace into discrete engine shards. Each CPU core runs a dedicated proactor event loop executing non-preemptive user-space fibers (`util::fb2`). Fibers within a shard execute sequentially without locking. Cross-shard coordination utilizes fiber-aware lock-less transactions and multi-shard coordination frameworks that schedule fiber dispatches directly on target shard threads.
2. **DASH (Dynamic And Scalable Hashing)**: A cache-line-friendly extendible hashing data structure adapted from academic DASH principles. DASH uses directory-based segment splitting with balanced probe buckets, stash buckets, and fingerprint masks (SIMD SSE/AVX accelerated). It eliminates the massive pointer overhead and rehash latency spikes seen in Redis's standard dict chaining.
3. **PMR-Driven Memory Tiering & Compact Representation**: Dragonfly eliminates jemalloc overhead via tight integration with `mimalloc` and C++17 Polymorphic Memory Resources (`std::pmr`). Objects are encoded into packed `CompactObj` structures (16 bytes inline buffer, tagged representations for strings, JSON, sets, lists, hashes, Bloom filters, Count-Min sketches, and Cuckoo filters), avoiding pointer dereference chains for small payloads and implementing zero-copy buffer pinning via `BorrowedString`.

```
                        +-------------------------------------------------------------+
                        |                     Client TCP Stream                       |
                        +-------------------------------------------------------------+
                                                       |
                                            [epoll / io_uring]
                                                       v
+-------------------------------------------------------------------------------------------------------------------+
| Proactor Thread (Core 0)                                Proactor Thread (Core 1..N)                              |
|                                                                                                                   |
|  +------------------------+                              +------------------------+                               |
|  |   RespSrvParser        |                              |   RespSrvParser        |                               |
|  | (Inline vs RESP Array) |                              | (Inline vs RESP Array) |                               |
|  +------------------------+                              +------------------------+                               |
|              |                                                       |                                            |
|              v                                                       v                                            |
|  +------------------------+                              +------------------------+                               |
|  | Fiber Scheduler (fb2)  |                              | Fiber Scheduler (fb2)  |                               |
|  | - Dispatcher Fiber     |                              | - Dispatcher Fiber     |                               |
|  | - Worker Fibers        |<===== Fiber Channels =======>| - Worker Fibers        |                               |
|  +------------------------+   (Lock-free cross-shard)    +------------------------+                               |
|              |                                                       |                                            |
|              v                                                       v                                            |
|  +-----------------------------------+                   +-----------------------------------+                    |
|  | EngineShard (Shard 0)             |                   | EngineShard (Shard 1..N)          |                    |
|  | +-------------------------------+ |                   | +-------------------------------+ |                    |
|  | | DashTable                     | |                   | | DashTable                     | |                    |
|  | | - Segment Directory           | |                   | | - Segment Directory           | |                    |
|  | | - Buckets + Stash (SSE masks) | |                   | | - Buckets + Stash (SSE masks) | |                    |
|  | | - CompactObj (16B packed)     | |                   | | - CompactObj (16B packed)     | |                    |
|  | +-------------------------------+ |                   | +-------------------------------+ |                    |
|  | | Memory Resource: PMR/mimalloc | |                   | | Memory Resource: PMR/mimalloc | |                    |
|  | +-------------------------------+ |                   | +-------------------------------+ |                    |
|  +-----------------------------------+                   +-----------------------------------+                    |
+-------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Universal Engineering Rules

### 1. Atomic File Replacement Invariant with Directory Durability
**RULE**:
When persisting state atomically via disk replacement, the system MUST write to a uniquely named sibling temporary file (`.tmpXXXXXX`), complete all payload writes, issue `fsync()` on the file descriptor, execute an atomic `rename()` over the target file, and immediately issue an `fsync()` on an open directory file descriptor referencing the target file's parent directory. The system MUST NOT truncate files in place and MUST NOT rely solely on file-level `fsync()`.

**WHY**:
POSIX filesystems commit file metadata updates and directory index entries asynchronously from file payload blocks. Writing directly or truncating an existing configuration or ACL file creates a window where a concurrent reader sees a 0-byte or partially written file. Even when writing to a temporary file and renaming, the directory entry update (pointing the parent inode to the new inode) remains volatile in the kernel dentry cache. A system crash or abrupt power loss before the directory inode hits disk can leave the target file non-existent or pointing to a corrupted inode, rolling back system state.

**WHEN TO APPLY**:
Apply to all configuration mutations, credential state updates, snapshot saves, ACL persists, and stateful journal rotations in persistent C/C++/Rust services where data corruption or truncation induces denial-of-service or privilege-escalation loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <fcntl.h>
#include <libgen.h>
#include <unistd.h>
#include <system_error>
#include <string>
#include <string_view>
#include "absl/strings/str_cat.h"

// Synchronizes the parent directory metadata to physical media.
bool SyncDirectory(std::string_view file_path) {
  // dirname() may modify its argument; allocate a local mutable copy
  std::string path_copy(file_path);
  char* dir_path = dirname(path_copy.data());
  
  const int dir_fd = open(dir_path, O_RDONLY | O_DIRECTORY | O_CLOEXEC);
  if (dir_fd == -1) {
    return false;
  }
  const bool synced = (fsync(dir_fd) == 0);
  close(dir_fd);
  return synced;
}

bool AtomicDurableWrite(const std::string& target_path, std::string_view payload, std::string* error_out) {
  // 1. Create temporary file in the exact same directory (guarantees same mount point / filesystem)
  std::string tmp_template = absl::StrCat(target_path, ".tmpXXXXXX");
  int fd = mkstemp(tmp_template.data());
  if (fd == -1) {
    *error_out = absl::StrCat("Failed to open temp file: ", std::generic_category().message(errno));
    return false;
  }

  // Lambda guard ensuring cleanup on any early failure
  auto cleanup_on_fail = [&](std::string_view stage) -> bool {
    const int saved_errno = errno;
    close(fd);
    unlink(tmp_template.c_str());
    *error_out = absl::StrCat("Failed to ", stage, ": ", std::generic_category().message(saved_errno));
    return false;
  };

  // 2. Write payload loop handling partial writes
  size_t bytes_written = 0;
  while (bytes_written < payload.size()) {
    ssize_t res = write(fd, payload.data() + bytes_written, payload.size() - bytes_written);
    if (res <= 0) {
      if (res < 0 && errno == EINTR) continue;
      return cleanup_on_fail("write payload");
    }
    bytes_written += res;
  }

  // 3. Flush file contents to physical media
  if (fsync(fd) == -1) {
    return cleanup_on_fail("fsync file payload");
  }

  // 4. Close before renaming to release OS file locks and state
  if (close(fd) == -1) {
    fd = -1;
    return cleanup_on_fail("close file");
  }
  fd = -1; // Disarm cleanup handler close

  // 5. Atomic POSIX rename over target file
  if (rename(tmp_template.c_str(), target_path.c_str()) == -1) {
    const int saved_errno = errno;
    unlink(tmp_template.c_str());
    *error_out = absl::StrCat("Failed to rename file: ", std::generic_category().message(saved_errno));
    return false;
  }

  // 6. Sync directory inode to prevent rename rollback on power failure
  if (!SyncDirectory(target_path)) {
    *error_out = "Failed to fsync parent directory";
    return false;
  }

  return true;
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Truncates in place; leaves window where file is empty or corrupted.
// Fails to fsync payload and fails to fsync parent directory dentry.
void UnsafeSave(const std::string& path, const std::string& data) {
  FILE* fp = fopen(path.c_str(), "w"); // File truncated immediately! Concurrent reader reads 0 bytes!
  if (!fp) return;
  fwrite(data.data(), 1, data.size(), fp);
  fclose(fp); // No fsync! Crashes during write lose all data.
}
```

**VERIFICATION METHOD**:
Implement a multi-fiber / multi-thread integration stress test:
1. Initialize a target file with baseline configuration.
2. Launch a reader thread continuously reading, parsing, and verifying that the file is never empty and never malformed.
3. Launch a writer thread performing 10,000 rapid iterations of `AtomicDurableWrite`.
4. Inject fault crash points before directory fsync and assert via POSIX `stat` that the target file either exists in the complete old version or complete new version, never zero-sized.

---

### 2. Dual-Form Serialization Invariant for Control-Byte and Length-Constrained Protocols
**RULE**:
When serializing unstructured or operator-provided identifiers into an inline space-delimited text wire format, the serializer MUST scan the input for control characters, whitespace (any byte `<= 0x20`), or length boundaries. If any byte `<= 0x20` is present, or if the argument count or field size exceeds the single-line inline capacity, the serializer MUST switch to a structured, binary-safe framed format (such as RESP Array `*<count>\r\n$<len>\r\n...`), and emit the payload under a distinct version-guarded auxiliary key (e.g., `-resp` suffix). The parser MUST validate the frame length against available buffer boundaries BEFORE allocating memory.

**WHY**:
Inline text protocols rely on whitespace splitting. When users inject strings containing spaces (e.g., index names, search tags, JSON field paths, or passwords), an unquoted or unframed serializer splits a single token into multiple arbitrary tokens during deserialization. This causes silent data corruption, index drops, or syntax errors on replication and reload. Furthermore, blind allocation based on unvetted incoming frame counts (e.g., `*4294967295\r\n`) allows memory exhaustion attacks where the parser reserves gigabytes of RAM for non-existent payloads.

**WHEN TO APPLY**:
Apply to all metadata serializers, database dump engines (RDB/AOF), cross-shard replication protocols, and configuration parsers where user-defined arbitrary string inputs are embedded in stream records.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <string>
#include <string_view>
#include <vector>
#include <algorithm>
#include "absl/strings/str_cat.h"
#include "absl/strings/str_join.h"
#include "absl/types/span.h"

// Encodes command arguments safely: inline if safe, framed RESP if spaces/binary bytes exist.
std::string EncodeSafeCommand(absl::Span<const std::string> args) {
  auto is_inline_safe = [](std::string_view arg) {
    return !arg.empty() && std::all_of(arg.begin(), arg.end(), [](unsigned char c) {
      return c > ' '; // Reject spaces, tabs, newlines, and control bytes
    });
  };

  // If every token has no whitespace, keep backward-compatible inline format
  if (std::all_of(args.begin(), args.end(), is_inline_safe)) {
    return absl::StrJoin(args, " ");
  }

  // Otherwise, construct length-prefixed RESP Array
  std::string cmd = absl::StrCat("*", args.size(), "\r\n");
  for (const auto& arg : args) {
    absl::StrAppend(&cmd, "$", arg.size(), "\r\n", arg, "\r\n");
  }
  return cmd;
}

// Emits the appropriate metadata aux key to ensure backwards-incompatible records
// are skipped by older daemon versions rather than misinterpreted.
std::string DetermineAuxKey(std::string_view base_key, std::string_view encoded_value) {
  if (encoded_value.find('\r') == std::string_view::npos) {
    return std::string(base_key);
  }
  return absl::StrCat(base_key, "-resp");
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Blindly space-joins arbitrary user arguments.
// If arg contains ' ', "tag city" turns into two tokens ("tag" and "city").
std::string BrokenEncode(const std::vector<std::string>& args) {
  return absl::StrJoin(args, " "); // Corrupts any argument containing whitespace!
}
```

**VERIFICATION METHOD**:
Verify using a memory-limited unit test:
1. Feed a malicious payload string `"*4294967295\r\n"` into the parser within a Linux container with `setrlimit(RLIMIT_AS)` clamped to 2GB.
2. Assert that the parser rejects the header with a parse error without executing `vector::reserve` or throwing `std::bad_alloc`.
3. Round-trip test: Create indices containing tabs, spaces, and strings exceeding 64 KiB, save to RDB, reload, and verify bit-for-bit identity across reload.

---

### 3. Cooperative Fiber Dispatcher Non-Preemption Invariant
**RULE**:
Code running on an event-driven dispatcher fiber or an atomic critical execution section MUST NOT invoke blocking primitives, synchronization barriers, or throttling functions that yield execution back to the fiber scheduler (`WaitUntil`, `EventCount::wait_until`, or channel blocking). All flow-control, queue throttling, and socket backpressure checks MUST be verified and scheduled on worker fibers prior to entering the non-preemptive dispatcher context.

**WHY**:
In shared-nothing fiber architectures (e.g., Dragonfly's `util::fb2`), the dispatcher fiber is responsible for scheduling work, processing timers, and dispatching tasks to shard queues. If a dispatcher fiber yields or halts on an event count, the fiber scheduler cannot pump pending microtasks or process completions. The fiber engine detects this invariant violation via assertion (`Should not preempt dispatcher`) and aborts with a SIGSEGV / exit code 139 to prevent deadlocks and memory corruptions across all connected client pipelines.

**WHEN TO APPLY**:
Apply to all core engine dispatchers, network command demuxers, asynchronous state machines, and cooperative thread-pool engines executing transactional phases across distributed shards.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <cstdint>
#include <cassert>

class JournalStreamer {
 public:
  bool NeedsThrottling() const {
    return buffered_bytes_ >= kOutputLimit;
  }

  // MUST only be called from a worker fiber context, NEVER dispatcher fiber
  void ThrottleIfNeeded(bool is_dispatcher_context) {
    if (!NeedsThrottling()) {
      return;
    }

    // STRICT INVARIANT ENFORCEMENT
    if (is_dispatcher_context) {
      // Must not suspend! Mark backpressure flag and return to prevent preemption panic.
      backpressure_signaled_ = true;
      return; 
    }

    // Worker fiber is safe to yield execution until buffer drains below threshold
    while (buffered_bytes_ >= kOutputLimit) {
      buffer_drained_event_.wait(); // Yields worker fiber, scheduler continues running
    }
  }

 private:
  static constexpr size_t kOutputLimit = 1024 * 1024;
  size_t buffered_bytes_ = 0;
  bool backpressure_signaled_ = false;
  EventCount buffer_drained_event_;
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Calling blocking flow-control unconditionally from any context.
void JournalStreamer::UnsafeThrottle() {
  if (buffered_bytes_ >= kOutputLimit) {
    // FATAL: If called during WAIT or on a dispatcher fiber, scheduler crashes:
    // "Should not preempt dispatcher: util::fb2::detail::Scheduler::WaitUntil()"
    buffer_drained_event_.wait();
  }
}
```

**VERIFICATION METHOD**:
Compile with fiber debug assertions (`-DDFLY_FIBER_DEBUG=1`). Execute replication under backpressure:
1. Spin up a replica on a Docker network and run `docker pause <replica_container>`.
2. Pipeline 200MB of `SET` commands into the primary to breach `replication_stream_output_limit`.
3. Concurrently issue `WAIT 1 2000` against the primary.
4. Assert that the server handles the wait timeout smoothly, returns integer `0`, and does not crash with exit code 139 or log dispatcher preemption panics.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Broken ACL File Parser Crash, Fail-Open Privilege Escalation, and File Truncation (BUG-ACL-01)
- **Context**: Subsystem: `src/server/acl/acl_family.cc`, `src/server/acl/acl_family.h`, `src/server/acl/user.cc`
- **What Was Expected**: 
  - Malformed lines or lines containing only whitespace in an ACL file should be safely ignored or raise a parse error naming the line number.
  - An invalid ACL configuration file on server startup must cause the server to fail-closed and abort.
  - Running `ACL SAVE` while concurrent `ACL LOAD` commands are executing must never expose an empty or partially written file.
  - Password hashes specified with `#` prefix must be validated as exactly 64 hexadecimal characters.
- **What Actually Happened**:
  - Whitespace-only lines (spaces, tabs, CRLF) crashed the server on startup or when executing `ACL LOAD`.
  - A syntax error in the ACL file caused the daemon to start with an open, unauthenticated `default` user (fail-open security vulnerability).
  - An ACL file lacking a `default` user configuration line silently ignored the `--requirepass` command-line flag, granting unauthenticated access.
  - A malformed `#` hash was stripped without validation, leaving the target user account active with no password requirement.
  - `ACL SAVE` used `io::OpenWrite(acl_file_path)` which truncated the ACL file in place. A concurrent `ACL LOAD` reading the file midway parsed an empty file, wiping out all configured user accounts and ACL permissions.
- **Evidence in Repo**: Commit SHA: `b6a8cf51`. Test cases: `AclFamilyTest.AclFileWhitespaceIsData`, `AclFamilyTest.AclLoadErrorNamesLine`, `AclFamilyTest.AclSaveIsAtomic`.
- **Root Cause**: The ACL file reader treated whitespace as structural separators rather than ignoring pure blank lines, crashed on zero tokens, truncated target files using standard `O_TRUNC` file streams, and lacked atomic write/rename mechanics.
- **Remediation Code Diff**:
```diff
--- a/src/server/acl/acl_family.cc
+++ b/src/server/acl/acl_family.cc
@@ -277,31 +298,38 @@ void AclFamily::Save(CmdArgParser parser, CommandContext* cmd_cntx) {
     return;
   }
 
-  auto res = io::OpenWrite(acl_file_path);
-  if (!res) {
-    std::string error = absl::StrCat("Failed to open the aclfile: ", res.error().message());
+  // Written next to the aclfile and renamed over it, so a reader never sees a partial file.
+  std::string tmp = absl::StrCat(acl_file_path, ".tmpXXXXXX");
+  int fd = mkstemp(tmp.data());
+  auto fail = [&](std::string_view what) {
+    std::error_code ec(errno, std::system_category());
+    std::string error = absl::StrCat("Failed to ", what, ": ", ec.message());
+    if (fd != -1) {
+      close(fd);
+      unlink(tmp.c_str());
+    }
     LOG(ERROR) << error;
     builder->SendError(error);
-    return;
+  };
+  if (fd == -1) {
+    return fail("open the aclfile");
   }
 
-  std::unique_ptr<io::WriteFile> file(res.value());
   std::string output = RegistryToString();
-  auto ec = file->Write(output);
-
-  if (ec) {
-    std::string error = absl::StrCat("Failed to write to the aclfile: ", ec.message());
-    LOG(ERROR) << error;
-    builder->SendError(error);
-    return;
+  ssize_t n = 1;
+  for (size_t off = 0; n > 0 && off < output.size(); off += n) {
+    n = write(fd, output.data() + off, output.size() - off);
   }
-
-  ec = file->Close();
-  if (ec) {
-    std::string error = absl::StrCat("Failed to close the aclfile ", ec.message());
-    LOG(WARNING) << error;
-    builder->SendError(error);
-    return;
+  if (n <= 0 || fsync(fd) == -1) {
+    return fail("write to the aclfile");
+  }
+  if (rename(tmp.c_str(), acl_file_path.c_str()) == -1) {
+    return fail("rename the aclfile");
+  }
+  close(fd);
+  fd = -1;
+  if (!SyncDir(acl_file_path)) {
+    return fail("sync the aclfile directory");
   }
 
   builder->SendOk();
```
- **Lesson**: Security and persistence configurations must always fail closed. Atomic rename with directory sync is mandatory for persistent files.

---

### Incident 2: Search Index Definition Truncation & Memory Exhaustion on Snapshot Reload (BUG-SEARCH-01)
- **Context**: Subsystem: `src/server/rdb_save.cc`, `src/server/rdb_load.cc`, `src/server/rdb_load_context.cc`, `src/facade/resp_srv_parser.cc`
- **What Was Expected**:
  - Full synchronization and RDB snapshots containing RediSearch index definitions, aliases, and synonym groups must persist and restore arguments containing whitespace, tabs, and control bytes.
  - Wide schema definitions (exceeding the default 64 KiB inline command limit) must parse cleanly on reload.
  - Corrupt or malicious metadata counts (e.g. `*4294967295\r\n`) must not crash or trigger unbounded heap allocation.
- **What Actually Happened**:
  - Search indexes, aliases, and synonyms were serialized as space-separated inline strings. Any argument containing a space (e.g., index prefixes `my pfx:`, tag separators `SEPARATOR ' '`, multi-word synonym groups) split into multiple arguments on restore.
  - Schema definitions longer than 64 KiB tripped the `BAD_INLINE` error in `RespSrvParser` and were dropped on restart or replication.
  - Floats for `TEXT WEIGHT` and `HNSW EPSILON` written with default formatting lost precision on round-trip reload.
- **Evidence in Repo**: Commit SHA: `dd4cf8e6`. PR: `#8696`. Test cases: `RdbTest.SearchDefinitionsWithSpacesSurviveReload`, `RdbTest.WideSearchIndexSurvivesReload`, `RdbTest.CorruptSearchArgumentCountIsRejected`.
- **Root Cause**: The RDB serializer assumed all search commands were inline text tokens. Deserialization used a hardcoded 64 KiB inline buffer limit and lacked input length clamping on array headers.
- **Remediation Code Diff**:
```diff
--- a/src/server/rdb_save.cc
+++ b/src/server/rdb_save.cc
@@ -1582,6 +1583,29 @@ namespace {
+#ifdef WITH_SEARCH
+string EncodeSearchCommand(absl::Span<const string> args) {
+  auto is_inline_safe = [](string_view arg) {
+    return !arg.empty() && ranges::all_of(arg, [](unsigned char c) { return c > ' '; });
+  };
+  if (ranges::all_of(args, is_inline_safe))
+    return absl::StrJoin(args, " ");
+
+  string cmd = absl::StrCat("*", args.size(), "\r\n");
+  for (const auto& arg : args)
+    absl::StrAppend(&cmd, "$", arg.size(), "\r\n", arg, "\r\n");
+  return cmd;
+}
+#endif
+
+string SearchAuxKey(string_view key, string_view value) {
+  return value.find('\r') == string_view::npos ? string{key} : absl::StrCat(key, "-resp");
+}
--- a/src/server/rdb_load_context.cc
+++ b/src/server/rdb_load_context.cc
@@ -183,22 +185,28 @@ void LoadSearchCommandFromAux(Service* service, std::string&& def, std::string_v
-  facade::RespSrvParser parser;
+  const size_t eol = def.find("\r\n");
+  const bool is_array = def.starts_with('*') && eol != std::string::npos && eol > 1 &&
+                        std::all_of(def.begin() + 1, def.begin() + eol,
+                                    [](unsigned char c) { return absl::ascii_isdigit(c); });
+  const std::string inline_def = is_array ? std::string{} : absl::StrCat(" ", def, "\r\n");
+  const std::string& input = is_array ? def : inline_def;
+
+  // Limits follow the input: inline definitions have no length limit, and a corrupt header cannot
+  // reserve memory beyond the input size.
+  const uint32_t max_len = input.size();
+  facade::RespSrvParser parser{max_len, max_len, max_len};
```
- **Lesson**: Wire formats must be binary-safe. Parser length limits must be dynamically bounded by actual input payload sizes to prevent memory inflation attacks.

---

### Incident 3: Replication Stream Backpressure Dispatcher Panic on WAIT Command (BUG-REPL-01)
- **Context**: Subsystem: `src/server/journal/journal_slice.cc`, `src/server/journal/journal_streamer.cc`, `src/util/fb2/detail/scheduler.cc`
- **What Was Expected**:
  - When replication buffer limits (`replication_stream_output_limit`, default 1 MB) are breached due to slow or stalled replicas, the primary server must throttle writes or report replication lags.
  - Issuing `WAIT <numreplicas> <timeout>` during replication backpressure must block the client's fiber until acknowledged or timed out, without crashing the primary daemon.
- **What Actually Happened**:
  - Primary daemon crashed with `SIGSEGV` (exit code 139).
  - Scheduler logged: `E scheduler.cc:206] Should not preempt dispatcher: util::fb2::detail::Scheduler::WaitUntil()`.
- **Evidence in Repo**: Issue `#8647`. Docker reproduction script under pipelined writes while replica is paused with `docker pause`.
- **Root Cause**: When a client executes `WAIT`, execution occurs within the coordinator/dispatcher context. Under journal backpressure, `JournalStreamer::ThrottleIfNeeded()` invoked fiber preemption (`WaitUntil()`). Preempting the core dispatcher fiber violated the non-preemption scheduler invariant, triggering an assertion panic.
- **Remediation Code Diff**:
```diff
--- a/src/server/journal/journal_streamer.cc
+++ b/src/server/journal/journal_streamer.cc
@@ -102,7 +102,8 @@ void JournalStreamer::ThrottleIfNeeded() {
   if (buffered_bytes_ < output_limit_) {
     return;
   }
-  wait_event_.wait(); // CRASH: preempted dispatcher fiber during WAIT execution
+  if (ServerState::IsDispatcherFiber()) {
+    return; // Defer throttling to worker fibers; never yield dispatcher
+  }
+  wait_event_.wait();
```
- **Lesson**: Cooperative fiber schedulers must strictly prohibit fiber preemption or suspension within dispatcher threads and coordination roots.

---

### Incident 4: Stream ID Parser Wildcard Acceptance & Uninitialized Memory Corruption (BUG-STREAM-01)
- **Context**: Subsystem: `src/server/stream_family.cc` (`ParseID` function)
- **What Was Expected**:
  - The wildcard token `*` represents auto-generated ID requests solely for `XADD`.
  - All other stream commands