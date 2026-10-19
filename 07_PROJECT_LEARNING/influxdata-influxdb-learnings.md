> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/influxdata-influxdb-learnings.md`  
> **Source**: github ([https://github.com/influxdata/influxdb](https://github.com/influxdata/influxdb))  
> **Source Version**: `06200ef9`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:10:13.519Z  
> **Learning ID**: `learn-github-influxdata-influxdb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): influxdata/influxdb

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
InfluxDB 3 Core (the Apache Arrow / DataFusion / Parquet reimagination of InfluxDB, formerly codenamed IOx) solves the high-cardinality, write-intensive, real-time columnar time-series storage and analytical query problem. Traditional time-series engines (LSM/TSM trees) degrade under high label cardinality (millions of series keys), suffer from write amplification during compactions, and execute analytical range scans inefficiently across non-contiguous disk sectors. InfluxDB 3 Core decouples stateful ingestion from long-term persistence by combining an append-only in-memory Write-Ahead Log (WAL) and mutable row-to-column buffer (`mutable_batch`) with columnar Apache Parquet files stored directly on diskless object stores (S3, GCS, Azure Blob, Cloudflare R2).

### Architectural Boundaries & Subsystems
```
                       [ InfluxDB 3 Ingestion & Query Flow ]

 HTTP / Line Protocol / InfluxQL / FlightSQL / InfluxDB v1/v2 Write APIs
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                   Server Boundary (Port 8181)               │
       │  - cli_types::MaxConcurrentQueries (Semaphore-bounded)      │
       │  - authz / influxdb3_authz (RBAC & Operator Token masking)   │
       │  - Python Plugin Engine (Embedded python-build-standalone)  │
       └────────────────────────────┬────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
       ┌──────────────────────┐            ┌──────────────────────┐
       │      WAL Engine      │            │ Mutable Row Buffer   │
       │  - Append-only Log   │            │ - In-memory Arrow    │
       │  - Size-bounded ops  │            │ - MutableBatch / LP  │
       │  - Snapshot rotation │            │ - Row-to-Col schema  │
       └──────────┬───────────┘            └──────────┬───────────┘
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ▼
       ┌─────────────────────────────────────────────────────────────┐
       │             Query Execution Engine (DataFusion)             │
       │  - iox_query / iox_query_influxql                           │
       │  - LogicalPlanBuilder timezone equivalence (EAR #6957)      │
       │  - Streaming merge operator (RunOptimizedStreamingMerge)    │
       │  - Schema projection / Dictionary optimization              │
       └────────────────────────────┬────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
       ┌──────────────────────┐            ┌──────────────────────┐
       │    Catalog Cache     │            │  Object Storage I/O  │
       │  - Retention purge   │            │ - Cloudflare R2 / S3 │
       │  - Partition batching│            │ - Parquet snapshots  │
       │  - gRPC Catalog svc  │            │ - IPC metadata wrap  │
       └──────────────────────┘            └──────────────────────┘
```

1. **Ingest & Buffer Plane (`core/influxdb_line_protocol`, `core/mutable_batch`, `influxdb3_wal`)**: Ingests line protocol lines, parsing byte streams into unescaped string slices (`EscapedStr`), buffering writes in memory. The WAL enforces write limits via byte and operation counters (`max_write_buffer_size`) and snapshots batches to persistent columnar formats before replay truncation.
2. **Columnar Engine & Utilities (`core/arrow_util`)**: Low-overhead Arrow manipulations:
   - `BitSet`: A byte-packed mutable bitmask with bit-level shift operations for boolean selections without allocating whole bytes per boolean.
   - `PackedStringArray<K>` and `StringDictionary<K>`: String interning using custom contiguous storage (`offsets: Vec<K>` and `storage: String`) mapped through a hash table (`hashbrown::HashMap<K, (), ()>`) via the raw entry API. This avoids secondary string allocations and duplicate hashing during deduplication.
   - `optimize_dictionaries`: Compacts RecordBatches prior to disk commit or network flight by stripping unreferenced dictionary keys and recalculating offset indices.
3. **Query Engine & Planner (`core/iox_query`, `core/iox_query_influxql`)**: Integrates Apache DataFusion. Translates InfluxQL and SQL ASTs into optimized physical plans. Intercepts projection nodes to eliminate redundant timezone conversions that disable Parquet min/max row group pruning.
4. **Transport & Inter-Service Fabric (`core/arrow_util::flight`, `core/generated_types`)**: Serves Arrow Flight / FlightSQL interfaces. Strips nested dictionary encodings down to native primitive arrays when writing across the wire to avoid gRPC/Flight deserialization bugs (`prepare_schema_for_flight`).

---

## 2. Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Allocation Raw Entry Hash Interning
**RULE**:
When building high-throughput string-interning tables or dictionary encoders, implementations MUST store string contents in a single contiguous flat buffer, use typed offset indices as the dictionary key, and perform map lookups via raw entry APIs using precomputed string hashes without constructing intermediate heap allocations or re-hashing stored data.

**WHY**:
Standard `HashMap<String, Key>` implementations allocate a separate heap `String` for every entry and perform a hash calculation on insertion and key verification. At ingest scales exceeding millions of tags/sec, this creates memory fragmentation and CPU cache misses. Using a raw entry API (`hashbrown::hash_map::RawEntryMut`) with `HashMap<K, (), ()>` separates the key storage (`PackedStringArray`) from hash index tracking, cutting lookup and insert overhead to zero allocations.

**WHEN TO APPLY**:
Apply in analytical query engines, time-series ingestion engines, symbol tables, compiler AST interners, and dictionary-encoded columnar serializers processing streaming string inputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use ahash::RandomState;
use hashbrown::HashMap;
use num_traits::{AsPrimitive, FromPrimitive, Zero};

#[derive(Debug, Clone)]
pub struct StringDictionary<K> {
    hash: RandomState,
    // Dedup map stores only key K -> (), using () hasher state since hashing is manual
    dedup: HashMap<K, (), ()>,
    storage: PackedStringArray<K>,
}

impl<K: AsPrimitive<usize> + FromPrimitive + Zero + Copy + PartialEq> StringDictionary<K> {
    pub fn lookup_value_or_insert(&mut self, value: &str) -> K {
        use hashbrown::hash_map::RawEntryMut;

        let hasher = &self.hash;
        let hash = hasher.hash_one(value);
        let storage = &mut self.storage;

        // Perform raw entry lookup using external hash and storage slice comparison
        let entry = self
            .dedup
            .raw_entry_mut()
            .from_hash(hash, |&key| value == storage.get(key.as_()).unwrap());

        match entry {
            RawEntryMut::Occupied(entry) => *entry.into_key(),
            RawEntryMut::Vacant(entry) => {
                let index = storage.append(value);
                let key = K::from_usize(index)
                    .expect("Failed to cast dictionary index into key type K");
                *entry
                    .insert_with_hasher(hash, key, (), |&key| {
                        let string = storage.get(key.as_()).unwrap();
                        hasher.hash_one(string)
                    })
                    .0
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Double allocation, redundant hashing, cache-thrashing pointer indirection
pub struct InefficientDictionary {
    map: std::collections::HashMap<String, u32>,
    reverse: Vec<String>,
}

impl InefficientDictionary {
    pub fn lookup_or_insert(&mut self, val: &str) -> u32 {
        if let Some(&id) = self.map.get(val) {
            return id;
        }
        // Allocates new String for hashmap key AND duplicate String for reverse lookup
        let id = self.reverse.len() as u32;
        self.map.insert(val.to_string(), id); // Re-computes hash and allocates heap memory
        self.reverse.push(val.to_string());
        id
    }
}
```

**VERIFICATION METHOD**:
Enforce via microbenchmark verifying zero heap allocations per repeat lookup, and property-based test confirming that `lookup_value(val)` matches `storage.get(lookup_value_or_insert(val))`.

---

### 2. Timezone Identity Projection Bypass for Storage Pruning Preservation
**RULE**:
Query planners MUST identify operations where metadata-only timezone tags or instant shifts evaluate to an identity transformation (such as unzoned timestamps projected to UTC) and omit the synthetic projection/UDF wrap entirely from the logical plan.

**WHY**:
Analytical parquet query pushdowns rely on predicate pruning against min/max column statistics (e.g., `time >= 1700000000`). Wrapping a scan column in a timezone conversion function (e.g., `tz(time, "UTC")`) transforms a direct column reference into a synthetic expression or function node (`Expr::ScalarFunction`). DataFusion and Parquet readers cannot prune row groups when the filter expression evaluates an opaque UDF on the partition key. Bypassing identity projections preserves the direct `Expr::Column` reference, enabling physical reader pruning.

**WHEN TO APPLY**:
Apply in SQL/InfluxQL planners, Arrow DataFusion logical optimization rules, and partitioned time-series storage engines mapping logical timestamps to physical storage metadata.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use datafusion_common::Result;
use datafusion_expr::{Expr, LogicalPlanBuilder};
use arrow_schema::DataType;

fn tz_is_equivalent(stored_tz: Option<&str>, target_tz: &str) -> bool {
    match stored_tz {
        Some(itz) => itz == target_tz,
        // IOx / Arrow storage treats None (unspecified timestamp timezone) as UTC
        None => target_tz.eq_ignore_ascii_case("UTC"),
    }
}

pub fn project_timezone_column(
    builder: LogicalPlanBuilder,
    column_name: &str,
    target_tz: &str,
) -> Result<LogicalPlanBuilder> {
    let schema = builder.schema();
    let field = schema.field_with_unqualified_name(column_name)?;

    if let DataType::Timestamp(_, stored_tz) = field.data_type() {
        if tz_is_equivalent(stored_tz.as_deref(), target_tz) {
            // Identity: Return original builder without inserting a wrapper projection.
            // Preserves physical parquet row-group pruning on the column.
            return Ok(builder);
        }
    }

    // Non-equivalent: Wrap in timezone scalar conversion expression
    builder.project(vec![
        // ... explicit timezone conversion expression
    ])
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Always injecting projection wrapper regardless of equivalent timezone
pub fn project_timezone_always(builder: LogicalPlanBuilder, target_tz: &str) -> Result<LogicalPlanBuilder> {
    // Blanket wrapping destroys Parquet statistics pruner!
    builder.project(vec![
        Expr::ScalarFunction {
            func_name: "tz_shift".into(),
            args: vec![col("time"), lit(target_tz)],
        }
    ])
}
```

**VERIFICATION METHOD**:
Compile plan with `EXPLAIN` and assert via integration test that `LogicalPlan` contains no `ProjectionExec` or scalar expression above `TableScan` when target timezone is `"UTC"` on unzoned timestamp schemas. Verify that Parquet row-group pruning statistics are evaluated directly.

---

### 3. Dynamic SELinux Socket Mount-Mask Isolation via Systemd Generators
**RULE**:
When sandboxing system services with hardened systemd isolation (`ProtectSystem=strict`, `InaccessiblePaths=...`), implementations MUST NOT hardcode masking over non-root unix domain sockets (such as `/run/snapd.socket`) inside primary static `.service` unit files on SELinux-enforcing Linux systems. Sockets requiring path isolation MUST be evaluated dynamically via a systemd generator script that injects drop-ins only on Debian-derived kernels or when SELinux is non-enforcing.

**WHY**:
On systemd >= 240, any denied namespace mount triggers a fatal service startup exit with status code `226/NAMESPACE`. RHEL, Rocky Linux, Fedora, and SUSE distributions enforce strict SELinux policies where `init_t` has no `mounton` permission over `snapd.socket` file contexts. A static `InaccessiblePaths=-/run/snapd.socket` directive will fail during systemd namespace setup with status 226 even with the `-` prefix (which only ignores non-existent paths, not security permission denials).

**WHEN TO APPLY**:
Apply in Debian/RPM packaging, systemd service descriptors, edge deployments, and container host installations that enforce filesystem sandbox policies across multi-distribution Linux targets.

**VERIFIED IMPLEMENTATION PATTERN**:
```sh
#!/bin/sh
# Systemd generator: dynamically detects SELinux and conditionally generates drop-in
set -eu

[ "$#" -ge 1 ] || exit 1
normal_dir="$1"
dropin_dir="${normal_dir}/service-daemon.service.d"
dropin_file="${dropin_dir}/50-inaccessible-paths.conf"

selinuxfs_registered() {
    contents=$(cat /proc/filesystems 2>/dev/null) || return 0
    [ -n "$contents" ] || return 0
    case "$contents" in
        *selinuxfs*) return 0 ;;
    esac
    return 1
}

selinux_enabled() {
    if [ -e "/sys/fs/selinux/enforce" ]; then
        return 0
    fi
    selinuxfs_registered
}

is_debian_family() {
    [ -r /etc/os-release ] || return 1
    ids=$(sed -n 's/^\(ID\|ID_LIKE\)=//p' /etc/os-release | tr -d '\'\"' | tr '\n' ' ')
    case " $ids " in
        *" debian "*|*" ubuntu "*) return 0 ;;
    esac
    return 1
}

rm -f -- "$dropin_file"

# If SELinux is active and NOT Debian family, skip masking to prevent exit 226
if selinux_enabled && ! is_debian_family; then
    exit 0
fi

mkdir -p -- "$dropin_dir"
printf '%s\n' \
    '[Service]' \
    '# Conditionally mask snapd socket' \
    'InaccessiblePaths=-/run/snapd.socket' \
    > "$dropin_file"
```

**NEGATIVE CONSTRAINT**:
```ini
# ANTI-PATTERN: Hardcoded in static unit file
[Service]
ProtectSystem=strict
# This triggers fatal exit 226/NAMESPACE on Rocky/RHEL/Fedora when SELinux is Enforcing
InaccessiblePaths=-/run/snapd.socket
```

**VERIFICATION METHOD**:
Execute systemd service start in a Rocky Linux 9/10 container or VM with `getenforce` returning `Enforcing`. Verify via `systemctl status <service>` that exit code is `0` and unit enters active state without `226/NAMESPACE` abort.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Query Planner Redundant Timezone Wrapping Destroys Parquet Pruning (BUG-INFLUX3-01)
- **Context**: InfluxQL to DataFusion query planning engine (`core/iox_query_influxql/src/plan/planner.rs`).
- **What Was Expected**: Queries with timezone clauses evaluating to the natural instant format (UTC on unzoned timestamp storage) must prune Parquet row groups and partitions matching timestamp boundaries directly via `TableScan` min/max statistics.
- **What Actually Happened**: The planner unconditionally wrapped the timestamp column in a timezone projection (`Expr::Column` -> projection UDF) whenever any target timezone was provided. This wrapped the base column, causing DataFusion physical planner rule `PruningPredicate` to discard row group pruning. Analytical scans performed full Parquet file reads across multi-terabyte datasets (Internal Issue EAR #6957).
- **Evidence in Repo**: Commit `15130156`, PR `influxdata/influxdb_pro#4397`. File: `core/iox_query_influxql/src/plan/planner.rs`.
- **Root Cause**: `Context::project_timezone` checked only `if let Some(otz) = &self.tz`, assuming any presence of an output timezone required synthetic expression rewriting without evaluating if `tz_is_equivalent(storage_tz, output_tz)`.
- **Remediation Code Diff**:
```rust
@@ -588,7 +590,7 @@ impl<'a> Context<'a> {
             .map(
                 |column| match schema.field_from_column(&column).unwrap().data_type() {
                     DataType::Timestamp(_, itz) => {
-                        if itz.as_ref().is_some_and(|itz| itz == otz) {
+                        if tz_is_equivalent(itz.as_deref(), otz) {
                             Expr::Column(column)
                         } else {
                             let name = column.name().to_string();
@@ -622,6 +624,16 @@ impl<'a> Context<'a> {
     }
 }
+
+/// Whether `tz(col, otz)` would be the identity on instants for a column whose
+/// stored timezone is `itz`. The UDF retags timezone metadata only, and treats
+/// a `None` storage tz as UTC.
+fn tz_is_equivalent(itz: Option<&str>, otz: &str) -> bool {
+    match itz {
+        Some(itz) => itz == otz,
+        None => otz.eq_ignore_ascii_case("UTC"),
+    }
+}
```
- **Lesson**: Projection planners must perform equivalence checks against physical storage default representations before injecting scalar transformation expressions.

---

### Incident 2: SELinux Policy Violation on Inaccessible Path Crash 226 (BUG-INFLUX3-02)
- **Context**: Packaging & Linux Daemon Sandboxing (`.circleci/packages/influxdb3/fs/lib/systemd/system/influxdb3-core.service`, `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-core-generator`).
- **What Was Expected**: InfluxDB 3 systemd service starts on RHEL, Rocky Linux, Debian, and Ubuntu with hardened process isolation (`ProtectSystem=strict`).
- **What Actually Happened**: InfluxDB 3 core service failed on startup with exit status `226/NAMESPACE` across Rocky Linux 9, Rocky Linux 10, Fedora, and SUSE systems (GitHub Issue #27329).
- **Evidence in Repo**: Commit `06200ef9`, files `.circleci/packages/influxdb3/fs/lib/systemd/system/influxdb3-core.service` and newly added generator `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-core-generator`.
- **Root Cause**: The unit file declared `InaccessiblePaths=-/run/snapd.socket`. In systemd 240+, any mount error during sandboxing is fatal. On RHEL-family kernels with SELinux enabled, policy denies `init_t` mount operations over snapd sockets. The `-` prefix only silences missing files (`ENOENT`), not access permission errors (`EACCES`).
- **Remediation Code Diff**:
```ini
@@ -65,10 +65,18 @@ ProtectSystem=strict
 RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
-# Disallow well-known system services' sockets
-InaccessiblePaths=-/run/avahi-daemon -/run/cups -/run/snapd.socket -/run/dbus/system_bus_socket
-# Disallow well-known desktop services' sockets
+# Disallow well-known system services' runtime directories
+InaccessiblePaths=-/run/avahi-daemon -/run/cups -/run/dbus
+# Disallow well-known desktop services' runtime directories
 InaccessiblePaths=-/tmp/.X11-unix -/tmp/.XIM-unix -/tmp/.ICE-unix -/tmp/.font-unix -/run/user
+# systemd 240 made a denied namespace mount fatal. RHEL-family policy gives
+# init_t no 'mounton' on this socket's type, so masking a socket fails the
+# service with 226 there.
+# See https://github.com/influxdata/influxdb/issues/27329
+#InaccessiblePaths=-/run/snapd.socket
```
Added dynamic generator script `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-core-generator` to dynamically evaluate SELinux state and inject the drop-in exclusively on Debian-family distros.
- **Lesson**: Hardened systemd path isolation cannot be statically defined across disparate Linux distributions with differing MAC (SELinux vs AppArmor) security contexts.

---

### Incident 3: Cloudflare R2 Checksum Header Rejection in CI/CD Artifact Pipelines (BUG-INFLUX3-03)
- **Context**: Release engineering pipeline & object store artifact publication (`.circleci/config.yml`).
- **What Was Expected**: Release artifacts upload reliably to Cloudflare R2 object storage endpoints using the standard AWS S3 CLI sync command.
- **What Actually Happened**: The artifact upload stage began failing systematically across CI builds with HTTP 400 Bad Request / header mismatch errors returned by R2 during `s3 sync`.
- **Evidence in Repo**: Commit `06200ef9`, `.circleci/config.yml`.
- **Root Cause**: Upgrades to modern `awscli` and underlying `boto3` libraries introduced automated calculation and transmission of `x-amz-checksum-crc32` headers by default. S3-compatible APIs such as Cloudflare R2 rejected these unsolicited headers on standard put/sync operations.
- **Remediation Code Diff**:
```yaml
@@ -667,22 +666,23 @@ jobs:
       destination:
         type: string
+    environment:
+      # Newer awscli/boto3 send CRC32 checksum headers that Cloudflare R2
+      # rejects unless checksum calculation is limited to when required.
+      AWS_REQUEST_CHECKSUM_CALCULATION: when_required
     steps:
       - attach_workspace:
           at: /tmp/workspace
-      - aws-s3/sync:
-          arguments:             --acl public-read
-          aws-region:            RELEASE_AWS_REGION
-          aws-access-key-id:     RELEASE_AWS_ACCESS_KEY_ID
-          aws-secret-access-key: RELEASE_AWS_SECRET_ACCESS_KEY
-          from:                  /tmp/workspace/artifacts
-          to:                    s3://dl.influxdata.com/influxdb/<< parameters.destination >>
       - run:
+          name: Upload artifacts to R2
           command: |
+            pip install --quiet awscli
             aws s3 sync /tmp/workspace/artifacts \
               "s3://dl-influxdata-com/influxdb/<< parameters.destination >>" \
               --endpoint-url "${AWS_ENDPOINT_URL_S3}" \
               --region auto
```
- **Lesson**: When interacting with S3-compatible third-party APIs (Cloudflare R2, MinIO, Ceph), explicitly restrict client checksum calculation policies via `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` to avoid protocol mismatches.

---

### Incident 4: Cargo Deny Build Interruption on Non-Exploitable RustSec Soundness Warnings (BUG-INFLUX3-04)
- **Context**: Security dependency governance in CI (`.circleci/config.yml`).
- **What Was Expected**: Security scanning flags CVE vulnerabilities without halting developer workflow on non-exploitable upstream API theoretical soundness warnings.
- **What Actually Happened**: CI pipelines failed during `cargo-deny check -s` due to advisory `RUSTSEC-2026-0097` (unsoundness in rand 0.8.5) and informational crates (`spin`), blocking production release synchronization.
- **Evidence in Repo**: Commit `73be12bf`, Commit `06200ef9`, `.circleci/config.yml`.
- **Root Cause**: `cargo-deny` treats all discovered security advisories as fatal errors by default, failing to distinguish between remotely exploitable CVEs and informational unsoundness notices in transitive dependencies.
- **Remediation Code Diff**:
```yaml
@@ -271,8 +271,10 @@ jobs:
           command: cargo install cargo-deny --locked
       - run:
           name: cargo-deny Checks
-          command: cargo deny check -s
+          # `--warn unsound` downgrades RustSec `informational = "unsound"`
+          # advisories to warnings, they flag API soundness concerns, not
+          # exploitable vulnerabilities, so we don't want them to fail CI.
+          command: cargo deny check -s --warn unsound
```
- **Lesson**: Automated dependency gates must partition actionable remote vulnerability CVEs from informational library soundness warnings to avoid pipeline gridlock.

---

### Incident 5: Darwin Dynamic Loader LC_RPATH Missing PyO3 Python Library (BUG-INFLUX3-05)
- **Context**: Cross-compiling Darwin ARM64/x86_64 binaries containing embedded Python runtime (`.circleci/config.yml`).
- **What Was Expected**: Cross-compiled macOS InfluxDB binaries load the bundled embedded Python runtime without requiring a system-level Python dynamic library.
- **What Actually Happened**: Binaries built on Linux runners targeting `apple-darwin` failed on macOS startup with `dyld: Library not loaded: @rpath/libpython3.13.dylib` / Image Not Found.
- **Evidence in Repo**: Commit `73be12bf`, `.circleci/config.yml`.
- **Root Cause**: `osxcross` cross-compilation toolchain does not natively register Mach-O `@executable_path` runtime search paths (`LC_RPATH`) when linking external static Python distributions (`python-build-standalone`).
- **Remediation Code Diff**:
```yaml
@@ -483,8 +485,22 @@ jobs:
                 name: adjust LC_RPATH path for darwin
                 command: |
+                  export PBS_LIBPYTHON=$(grep '^lib_name=' /tmp/workspace/python-artifacts/<< parameters.target >>/pyo3_config_file.txt | cut -d = -f 2)
+                  test -n "$PBS_LIBPYTHON" || { echo "ERROR: empty $PBS_LIBPYTHON"; exit 1; }
                   echo "Running: /osxcross/bin/aarch64-apple-darwin22.2-install_name_tool -add_rpath '@executable_path/python/lib' '${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3'"
                   /osxcross/bin/aarch64-apple-darwin22.2-install_name_tool -add_rpath '@executable_path/python/lib' "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3"
+                  echo "Verifying python shared library dependency via otool -L"
+                  /osxcross/bin/aarch64-apple-darwin22.2-otool -L "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3" | grep -q "@rpath/lib${PBS_LIBPYTHON}.dylib" || {
+                    echo "ERROR: expected @rpath/lib${PBS_LIBPYTHON}.dylib not found in otool output"
+                    exit 1
+                  }
+                  echo "Verifying LC_RPATH for python shared library dependency via otool -l"
+                  /osxcross/bin/aarch64-apple-darwin22.2-otool -l "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3" | grep -q "path @executable_path/python/lib" || {
+                    echo "ERROR: expected @executable_path/python/lib not found in otool output"
+                    exit 1
+                  }
                   # re-sign after install_name_tool since osxcross won't do it
                   echo "Running: /usr/local/bin/