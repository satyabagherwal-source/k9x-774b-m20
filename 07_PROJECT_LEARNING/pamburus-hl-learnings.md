# Forensic Learning Record (Deep Inspection): pamburus/hl

> **Canonical Artifact**: `07_PROJECT_LEARNING/pamburus-hl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pamburus/hl](https://github.com/pamburus/hl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:28:55.284Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pamburus/hl`
- **Description**: A fast and powerful log viewer and processor that converts JSON logs or logfmt logs into a clear human-readable format.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3300 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/bench/main.rs`
```
// std imports
use std::{
    alloc::System,
    cmp::{max, min},
    hash::{Hash, Hasher},
    hint::black_box,
    time::{Duration, Instant},
};

// third-party imports
use base32::Alphabet;
use criterion::{BatchSize, Bencher, criterion_main};
use fnv::FnvHasher;
use stats_alloc::{INSTRUMENTED_SYSTEM, StatsAlloc};

#[global_allocator]
static GA: &StatsAlloc<System> = &INSTRUMENTED_SYSTEM;

const ND: &str = ":"; // name delimiter

mod misc;
mod samples;
mod ws;

criterion_main!(
    ws::encstr::benches,
    ws::hl::benches,
    misc::fncall::benches,
    misc::mem::benches,
    misc::wildcard::benches,
);

fn hash<T: Hash>(value: T) -> String {
    let mut hasher = FnvHasher::default();
    value.hash(&mut hasher);
    let hash = hasher.finish().to_be_bytes();
    base32::encode(Alphabet::Rfc4648Lower { padding: false }, &hash[..])
}

trait BencherExt {
    fn iter_batched_fixed<I, O, S, R>(&mut self, setup: S, routine: R, size: BatchSize)
    where
        S: FnMut() -> I,
        R: FnMut(I) -> O;

    fn iter_batched_ref_fixed<I, O, S, R>(&mut self, setup: S, routine: R, size: BatchSize)
    where
        S: FnMut() -> I,
        R: FnMut(&mut I) -> O;
}

impl<'a> BencherExt for Bencher<'a> {
    #[inline(never)]
    fn iter_batched_fixed<I, O, S, R>(&mut self, mut setup: S, mut routine: R, size: BatchSize)
    where
        S: FnMut() -> I,
        R: FnMut(I) -> O,
    {
        self.iter_custom(|iters| {
            let mut n = iters;
            let k = iters_per_batch(size, n);
            assert!(k != 0, "batch size must not be zero");

            let mut total = Duration::from_nanos(0);

            while n > 0 {
                let k = min(k as u64, n) as usize;
                let mut inputs = black_box((0..k).map(|_| setup()).collect::<Vec<_>>());

                let start = Instant::now();
                for _ in 0..k {
                    black_box(routine(inputs.pop().unwrap()));
                }
                let elapsed = start.elapsed();

                let mut inputs = black_box((0..k).map(|_| setup()).collect::<Vec<_>>());

                let start = Instant::now();
                for _ in 0..k {
                    black_box(inputs.pop().unwrap());
                }
                let overhead = start.elapsed();

                total += elapsed - min(elapsed, overhead);

                n -= k as u64;
            }

            max(total, Duration::from_nanos(1))
        });
    }

    #[inline(never)]
    fn iter_batched_ref_fixed<I, O, S, R>(&mut self, mut setup: S, mut routine: R, size: BatchSize)
    where
        S: FnMut() -> I,
        R: FnMut(&mut I) -> O,
    {
        self.iter_custom(|iters| {
            let mut n = iters;
            let k = iters_per_batch(size, n);
            assert!(k != 0, "batch size must not be zero");

            let mut total = Duration::from_nanos(0);

            while n > 0 {
                let k = min(k as u64, n) as usize;
                let mut inputs = (0..k).map(|_| setup()).collect::<Vec<_>>();
                black_box(&mut inputs);

                let start = Instant::now();
                for i in 0..k {
                    black_box(routine(unsafe { inputs.get_unchecked_mut(i) }));
                }
                let elapsed = start.elapsed();

                let start = Instant::now();
                for i in 0..k {
                    black_box(unsafe { inputs.get_unchecked_mut(i) });
                }
                let overhead = start.elapsed();

                total += elapsed - min(elapsed, overhead);

                black_box(inputs);

                n -= k as u64;
            }

            max(total, Duration::from_nanos(1))
        });
    }
}

fn iters_per_batch(size: BatchSize, iters: u64) -> usize {
    let size = match size {
        BatchSize::SmallInput => iters.div_ceil(10),
        BatchSize::LargeInput => iters.div_ceil(1000),
        BatchSize::PerIteration => 1,
        BatchSize::NumBatches(batches) => iters.div_ceil(batches),
        BatchSize::NumIterations(size) => size,
        BatchSize::__NonExhaustive => panic!("__NonExhaustive is not a valid BatchSize."),
    };
    usize::try_from(size).unwrap()
}

```

### Core Architecture Module: `benches/bench/misc/fncall.rs`
```
// std imports
use std::time::Duration;

// third-party imports
use const_str::concat as strcat;
use criterion::{BatchSize, Criterion, criterion_group};

// local imports
use super::{BencherExt, ND};

criterion_group!(benches, bench);

const GROUP: &str = strcat!(super::GROUP, ND, "fncall");

fn bench(c: &mut Criterion) {
    let mut group = c.benchmark_group(GROUP);
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(5));

    group.bench_function("add42", |b| {
        let setup = || 1_u64;
        b.iter_batched_ref_fixed(setup, add42, BatchSize::NumIterations(65536));
    });

    group.bench_function("add42:inline", |b| {
        let setup = || 1_u64;
        b.iter_batched_ref_fixed(setup, add42_inline, BatchSize::NumIterations(65536));
    });

    group.finish();
}

#[inline(never)]
fn add42(x: &mut u64) {
    add42_inline(x)
}

#[inline(always)]
fn add42_inline(x: &mut u64) {
    *x += 42;
}

```

### Core Architecture Module: `benches/bench/misc/mem.rs`
```
// std imports
use std::time::Duration;

// third-party imports
use const_str::concat as strcat;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput, criterion_group};
use memchr::{memchr, memchr2, memchr3};
use rand::random;

// local imports
use super::{BencherExt, ND};

criterion_group!(benches, bench);

const GROUP: &str = strcat!(super::GROUP, ND, "mem");

fn bench(c: &mut Criterion) {
    let mut group = c.benchmark_group(GROUP);
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(5));

    let seq = || {
        move || {
            let x: u8 = random();
            x
        }
    };

    let bufs = |size| {
        let next = seq();
        let vi: Vec<u8> = (0..size).map(|_| next()).collect();
        let ve: Vec<u8> = Vec::with_capacity(size);
        (vi, ve)
    };

    let variants = [
        (8, BatchSize::NumIterations(8192)),
        (512, BatchSize::NumIterations(8192)),
        (4096, BatchSize::NumIterations(8192)),
    ];

    for (n, batch) in variants {
        group.throughput(Throughput::Bytes(n as u64));

        group.bench_function(BenchmarkId::new("rotate:1", n), |b| {
            let setup = || bufs(n).0;
            b.iter_batched_ref_fixed(setup, |vi| vi.rotate_right(1), batch);
        });

        group.bench_function(BenchmarkId::new("copy", n), |b| {
            let setup = || bufs(n);
            b.iter_batched_ref_fixed(setup, |(vi, ve)| ve.extend_from_slice(vi.as_slice()), batch);
        });
    }

    let variants = [(4096, BatchSize::NumIterations(8192))];

    for (n, batch) in variants {
        group.throughput(Throughput::Bytes(n as u64));

        let setup = || (0..n).map(|x| (x * 256 / n) as u8).collect::<Vec<u8>>();
        let param = |x| format!("{}:{}", n, x);

        group.bench_function(BenchmarkId::new("position", param("single-value")), |b| {
            let needle = 128;
            b.iter_batched_ref_fixed(setup, |vi| vi.iter().position(|&x| x == needle), batch);
        });

        group.bench_function(BenchmarkId::new("position", param("one-of-two-values")), |b| {
            b.iter_batched_ref_fixed(setup, |vi| vi.iter().position(|&x| matches!(x, 128 | 192)), batch);
        });

        group.bench_function(BenchmarkId::new("position", param("one-of-three-values")), |b| {
            b.iter_batched_ref_fixed(setup, |vi| vi.iter().position(|&x| matches!(x, 128 | 192 | 224)), batch);
        });

        group.bench_function(BenchmarkId::new("memchr", param("single-value")), |b| {
            b.iter_batched_ref_fixed(setup, |vi| memchr(128, vi), batch);
        });

        group.bench_function(BenchmarkId::new("memchr", param("one-of-two-values")), |b| {
            b.iter_batched_ref_fixed(setup, |vi| memchr2(128, 192, vi), batch);
        });

        group.bench_function(BenchmarkId::new("memchr", param("one-of-three-values")), |b| {
            b.iter_batched_ref_fixed(setup, |vi| memchr3(128, 192, 224, vi), batch);
        });
    }

    group.finish();
}

```

### Core Architecture Module: `benches/bench/misc/mod.rs`
```
// workspace imports
use super::{BencherExt, ND, hash};

const GROUP: &str = "misc";

pub mod fncall;
pub mod mem;
pub mod wildcard;

```

### Core Architecture Module: `benches/bench/misc/wildcard.rs`
```
// std imports
use std::{hint::black_box, time::Duration};

// third-party imports
use const_str::concat as strcat;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput, criterion_group};

// local imports
use super::{BencherExt, ND, hash};

criterion_group!(benches, bench);

const GROUP: &str = strcat!(super::GROUP, ND, "wildcard");

fn bench(c: &mut Criterion) {
    bench_with::<wildmatch::WildMatch>(c, "wildmatch");
    bench_with::<wildcard::Pattern>(c, "wildcard");
}

fn bench_with<Pattern: Wildcard>(c: &mut Criterion, title: &str) {
    let mut c = c.benchmark_group(GROUP);
    c.warm_up_time(Duration::from_secs(1));
    c.measurement_time(Duration::from_secs(3));

    const P1X: (&str, &str) = ("1x", "_*");
    const P27X: (&str, &str) = ("27x", "SOME_VERY_VERY_LONG_PREFIX_*");

    let variants = [
        ("short", "_TEST", P1X, true),
        ("short", "TEST", P1X, false),
        ("long", "_TEST_SOME_VERY_VERY_LONG_NAME", P1X, true),
        ("long", "SOME_VERY_VERY_LONG_PREFIX_AND_SOMEWHAT", P27X, true),
        ("long", "TEST_SOME_VERY_VERY_LONG_NAME", P27X, false),
    ];

    for (name, input, (pname, pattern), expected) in &variants {
        let function = format!("{}:{}", title, "matches");
        let param = format!(
            "{}:{}:{}:{}:{}",
            name,
            pname,
            if *expected { "pos" } else { "neg" },
            input.len(),
            hash((pattern, input))
        );
        let pattern = Pattern::new(pattern);
        let setup = || String::from(*input);
        let routine = |input: String| black_box(&pattern).matches(&input);

        assert_eq!(routine(setup()), *expected);

        c.throughput(Throughput::Bytes(input.len() as u64));
        c.bench_function(BenchmarkId::new(function, param), |b| {
            b.iter_batched_fixed(setup, routine, BatchSize::NumIterations(16384));
        });
    }
}

// ---

trait Wildcard {
    fn new(pattern: &'static str) -> Self;
    fn matches(&self, what: &str) -> bool;
}

impl Wildcard for wildmatch::WildMatch {
    #[inline(always)]
    fn new(pattern: &str) -> Self {
        Self::new(pattern)
    }

    #[inline(always)]
    fn matches(&self, what: &str) -> bool {
        self.matches(what)
    }
}

impl Wildcard for wildcard::Pattern {
    #[inline(always)]
    fn new(pattern: &'static str) -> Self {
        Self::new(pattern)
    }

    #[inline(always)]
    fn matches(&self, what: &str) -> bool {
        self.matches(what)
    }
}

```

### Core Architecture Module: `benches/bench/samples/log.rs`
```
pub(crate) mod elk01 {
    use byte_strings::concat_bytes;

    pub const JSON: &[u8] = concat_bytes!(br#"{"@timestamp":"2021-06-20T00:00:00.393Z","@version":"1","agent":{"ephemeral_id":"30ca3b53-1ef6-4699-8728-7754d1698a01","hostname":"as-rtrf-fileboat-ajjke","id":"1a9b51ef-ffbe-420e-a92c-4f653afff5aa","type":"fileboat","version":"7.8.3"},"koent-id":"1280e812-654f-4d04-a4f8-e6b84079920a","anchor":"oglsaash","caller":"example/demo.go:200","dc_name":"as-rtrf","ecs":{"version":"1.0.0"},"host":{"name":"as-rtrf-fileboat-ajjke"},"input":{"type":"docker"},"kubernetes":{"container":{"name":"some-segway"},"labels":{"app":"some-segway","component":"some-segway","pod-template-hash":"756d998476","release":"as-rtrf-some-segway","subcomponent":"some-segway"},"namespace":"as-rtrf","node":{"name":"as-rtrf-k8s-kube-node-vm01"},"pod":{"name":"as-rtrf-some-segway-platform-756d998476-jz4jm","uid":"9d445b65-fbf7-4d94-a7f4-4dbb7753d65c"},"replicaset":{"name":"as-rtrf-some-segway-platform-756d998476"}},"level":"info","localTime":"2021-06-19T23:59:58.450Z","log":{"file":{"path":"/var/lib/docker/containers/38a5db8e-45dc-4c33-b38a-6f8a9794e894/74f0afa4-3003-4119-8faf-19b97d27272e/f2b3fc41-4d71-4fe3-a0c4-336eb94dbcca/80c2448b-7806-404e-8e3a-9f88c30a0496-json.log"},"offset":34009140},"logger":"deep","msg":"io#2: io#1rq#8743: readfile = {.offset = 0x4565465000, .length = 4096, .lock_id = dc0cecb7-5179-4daa-9421-b2548b5ed7bf}, xxaao_client = 1","server-uuid":"0a1bec7f-a252-4ff6-994a-1fbdca318d6d","slot":2,"stream":"stdout","task-id":"1a632cba-8480-4644-93f2-262bc0c13d04","tenant-id":"40ddb7cf-ce50-41e4-b994-408e393355c0","time":"2021-06-20T00:00:00.393Z","ts":"2021-06-19T23:59:58.449489225Z","type":"k8s_containers_logs","unit":"0"}"#, b"\n");

    pub const LOGFMT: &[u8] = concat_bytes!(br#"time=2021-06-20T00:00:00.393Z level=INFO msg="io#2: io#1rq#8743: readfile = {.offset = 0x4565465000, .length = 4096, .lock_id = dc0cecb7-5179-4daa-9421-b2548b5ed7bf}, xxaao_client = 1" @version=1 agent.ephemeral_id=30ca3b53-1ef6-4699-8728-7754d1698a01 agent.hostname=as-rtrf-fileboat-ajjke agent.id=1a9b51ef-ffbe-420e-a92c-4f653afff5aa agent.type=fileboat agent.version=7.8.3 koent-id=1280e812-654f-4d04-a4f8-e6b84079920a anchor=oglsaash dc_name=as-rtrf ecs.version=1.0.0 host.name=as-rtrf-fileboat-ajjke input.type=docker kubernetes.container.name=some-segway kubernetes.labels.app=some-segway kubernetes.labels.component=some-segway kubernetes.labels.pod-template-hash=756d998476 kubernetes.labels.release=as-rtrf-some-segway kubernetes.labels.subcomponent=some-segway kubernetes.namespace=as-rtrf kubernetes.node.name=as-rtrf-k8s-kube-node-vm01 kubernetes.pod.name=as-rtrf-some-segway-platform-756d998476-jz4jm kubernetes.pod.uid=9d445b65-fbf7-4d94-a7f4-4dbb7753d65c kubernetes.replicaset.name=as-rtrf-some-segway-platform-756d998476 localTime=2021-06-19T23:59:58.450Z log.file.path=/var/lib/docker/containers/38a5db8e-45dc-4c33-b38a-6f8a9794e894/74f0afa4-3003-4119-8faf-19b97d27272e/f2b3fc41-4d71-4fe3-a0c4-336eb94dbcca/80c2448b-7806-404e-8e3a-9f88c30a0496-json.log log.offset=34009140 logger=deep server-uuid=0a1bec7f-a252-4ff6-994a-1fbdca318d6d slot=2 stream=stdout task-id=1a632cba-8480-4644-93f2-262bc0c13d04 tenant-id=40ddb7cf-ce50-41e4-b994-408e393355c0 type=k8s_containers_logs unit=0 source=example/demo.go:200"#, b"\n");
}

pub(crate) mod int01 {
    use byte_strings::concat_bytes;

    pub const JSON: &[u8] = concat_bytes!(
        br#"{"a":1745349129016,"b":1745349149419,"c":1745349176629,"d":1745349181278,"e":1745349186212}"#,
        b"\n"
    );

    pub const LOGFMT: &[u8] = concat_bytes!(
        br#"a=1745349129016 b=1745349149419 c=1745349176629 d=1745349181278 e=1745349186212}"#,
        b"\n"
    );
}

```

### Core Architecture Module: `benches/bench/samples/mod.rs`
```
pub(crate) mod log;
pub(crate) mod str;

```

### Core Architecture Module: `benches/bench/samples/str.rs`
```
pub(crate) mod query01 {
    pub const JSON: &str = r#""UPDATE \"apple\" SET \"seed\"='8c858361-5b73-442e-b84c-78482ed60ce1',\"planted_at\"=now() + timeout,\"importer\"='00d1cce2-c32e-4bb7-88da-474083fc2a1a',\"start_at\"=now() + repeat_interval,\"planted_at\"=now(),\"state\"='running',\"updated_at\"='2023-12-04 10:01:29.399' WHERE id IN (SELECT id FROM \"apple\" WHERE breed in ('red-delicious') AND distributor in ('magic-fruits','grand-provider') AND ((now() >= harvest_at AND (seed IS NULL OR (seed = 'b66134a4-c5c5-4adc-8c33-c8b7f780853b' AND importer != 'f86eb35d-33cd-499b-85cd-da175188e459'))) OR (now() >= planted_at)) ORDER BY \"updated_at\" LIMIT 4) AND ((now() >= harvest_at AND (seed IS NULL OR (seed = 'a3ecc839-0a32-4722-b4db-90c2ce8296a5' AND importer != '73a1fe4e-f4d1-4d09-99cb-9b07f2e32a96'))) OR (now() >= planted_at)) RETURNING *""#;

    pub const RAW: &str = r#"UPDATE "apple" SET "seed"='8c858361-5b73-442e-b84c-78482ed60ce1',"planted_at"=now() + timeout,"importer"='00d1cce2-c32e-4bb7-88da-474083fc2a1a',"start_at"=now() + repeat_interval,"planted_at"=now(),"state"='running',"updated_at"='2023-12-04 10:01:29.399' WHERE id IN (SELECT id FROM "apple" WHERE breed in ('red-delicious') AND distributor in ('magic-fruits','grand-provider') AND ((now() >= harvest_at AND (seed IS NULL OR (seed = 'b66134a4-c5c5-4adc-8c33-c8b7f780853b' AND importer != 'f86eb35d-33cd-499b-85cd-da175188e459'))) OR (now() >= planted_at)) ORDER BY "updated_at" LIMIT 4) AND ((now() >= harvest_at AND (seed IS NULL OR (seed = 'a3ecc839-0a32-4722-b4db-90c2ce8296a5' AND importer != '73a1fe4e-f4d1-4d09-99cb-9b07f2e32a96'))) OR (now() >= planted_at)) RETURNING *"#;
}

pub(crate) mod ipsum01 {
    pub const JSON: &str = r#""Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut euismod tincidunt mattis. Proin viverra elementum velit vel aliquam. Nullam in dolor risus. Donec tempus aliquet tellus, ac dignissim erat mattis aliquam. Maecenas interdum libero sed felis sodales, a lacinia sapien semper. Sed suscipit, est et auctor aliquam, purus erat porttitor metus, non tincidunt odio est a magna. Duis ac venenatis nulla, non aliquam justo. Vestibulum rhoncus odio ut est suscipit, varius sollicitudin metus consectetur. In feugiat justo at congue commodo. Fusce eros leo, varius nec neque et, pellentesque aliquam libero. Nam convallis eu leo at aliquam. Suspendisse vulputate lacinia nulla, sit amet malesuada quam malesuada at. Pellentesque neque odio, vehicula sed fringilla nec, dignissim vitae nulla ligula.""#;

    pub const RAW: &str = r#"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut euismod tincidunt mattis. Proin viverra elementum velit vel aliquam. Nullam in dolor risus. Donec tempus aliquet tellus, ac dignissim erat mattis aliquam. Maecenas interdum libero sed felis sodales, a lacinia sapien semper. Sed suscipit, est et auctor aliquam, purus erat porttitor metus, non tincidunt odio est a magna. Duis ac venenatis nulla, non aliquam justo. Vestibulum rhoncus odio ut est suscipit, varius sollicitudin metus consectetur. In feugiat justo at congue commodo. Fusce eros leo, varius nec neque et, pellentesque aliquam libero. Nam convallis eu leo at aliquam. Suspendisse vulputate lacinia nulla, sit amet malesuada quam malesuada at. Pellentesque neque odio, vehicula sed fringilla nec, dignissim vitae nulla ligula."#;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1455** (2026-06-11): **fix(fsmon): follow log rotation on Windows**
  *Symptoms*: The `--follow` flag previously stopped receiving new entries after log rotation on Windows. It now detects rotation and resumes reading from the new file, matching the behaviour on Unix.  Closes #1454 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/pamburus/hl/pull/1455?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 90.05%. Comparing base ([`e2fce0f`](https://app.codecov.io/gh/pamburus/hl/commit/e2fce0f84972422453cd697236f4f2279213456b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)) to head ([`dc768d0`](https://app.codecov.io/gh/pamburus/hl/commit/dc768d01c5aeaf90705dba8aeeb51c2125b5ec23?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #1455   +/-   ## ============================

- **Issue #1454** (2026-06-11): **Follow mode misses new entries on Windows when the log writer keeps the file open**
  *Symptoms*: **Description:**  ## Summary  When using `--follow` to watch a log file on Windows, `hl` fails to display new log entries as they are appended by a writer that keeps the file open without flushing (the common case for production log frameworks). Log rotation is also not detected, so even after a new file appears at the same path, no further output is produced.  ## Expected behaviour  `hl --follow` should display new entries as they are written, and should recover and continue reading after log rotation — the same way it does on Linux and macOS.  ## Steps to reproduce  **Write detection:** 1. Start tailing a log file: `hl --follow app.log` 2. Have a long-running process append entries to `app.log` without closing or flushing the handle  **Observed:** no new entries appear until the writer closes or flushes. **Expected:** entries appear as they are written.  **Rotation detection:** 1. Start tailing a log file: `hl --follow app.log` 2. Trigger a log rotation (rename `app.log` → `app.log.1`, create a new `app.log`) 3. Write new log entries to the new `app.log`  **Observed:** no new entries appear after rotation. **Expected:** entries from the new file appear as normal.  ## Root cause  `ReadDirectoryChangesW` — the underlying OS mechanism used for file watching — monitors the NTFS directory index, which is only updated when the writer flushes or closes the file handle. There is no unprivileged event-driven API on Windows that fires on every `WriteFile` call, so neither new writes 

- **Issue #1445** (2026-06-03): **Follow mode does not detect file replacement via atomic rename on macOS**
  *Symptoms*: ## Description  When using `hl -F <file>` on macOS, replacing the watched file via an atomic rename (e.g. `mv r1.log rotate.log`) is not detected and new content is never processed. This is a common log rotation pattern used by many logging systems and tools such as `logrotate`.  ## Steps to Reproduce  ```sh # Start following a log file hl -F rotate.log  # In another terminal: create a new file and atomically rename it over the watched file echo '{"level":"info","msg":"new entry"}' >> r1.log mv r1.log rotate.log ```  **Expected:** the new content appears in the output.   **Actual:** nothing happens; `hl` stops producing output.  ## Workaround  Explicitly deleting the file before replacing it works as expected:  ```sh rm rotate.log mv r1.log rotate.log ```  ## Root Cause  On macOS, the operating system's file event notification mechanism behaves differently from Linux when a file is replaced via rename. Instead of reporting that the file at the watched path was replaced, it reports that the original file was deleted — because the old file's last reference is removed as part of the atomic swap. This distinction means the replacement goes unnoticed and `hl` never picks up the new file.  On Linux this works correctly.  ## Platform  macOS only.

- **Issue #1423** (2026-05-14): **[Bug]: follow mode should output unparsable input**
  *Symptoms*: ### Bug Description  In -F mode, the tool acts as a destructive filter, discarding data that it doesn't understand.  When hl -F encounters a line it cannot parse, **it should fallback to printing the raw string.** This ensures that the user never misses a line of output due to a parsing failure.  I created this reproducible test using the default hl config.  ```bash  echo 'ts="2026-05-14T16:30:00Z" level=INFO msg="log message is correctly formatted"' | hl  # hl without -F prints unparsable lines echo 'ts="2026-05-14T16:30:00Z" level=INFO msg="incorrectly formatted due to "quotes""' | hl  # hl -F does not output unparsable lines echo 'ts="2026-05-14T16:30:00Z" level=INFO msg="incorrectly formatted due to "quotes""' | hl -F ```  ### Steps to Reproduce  Execute the bash commands with the default hl config.  ### Expected Behavior   hl -F should output lines that failed to parse.  ### Actual Behavior   hl -F does not output lines that failed to parse.  ### Environment Details  - hl version: hl 0.35.3-alpha - OS: OSX 26.4.1 - Terminal: kitty - Shell: zsh   ### Logs or Error Messages  ```shell  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Is there any particular reason why you are using hl 0.35.3-alpha? The latest release version is 0.36.1 and as far as I remember it includes fix for this issue.
  > There is currently no reason to be on alpha, I installed the HEAD version from the repo some time ago and haven't updated.  Yes `hl -F` prints unparsable lines on version 0.36.1  ```bash hl --version # hl 0.36.1 # HL shows output echo 'ts="2026-05-14T16:30:00Z" level=INFO msg="incorrectly formatted due to "quotes""' | hl -F ```  Appreciate the fix and this very useful log viewer.

- **Issue #1313** (2026-04-01): **[Bug]: panicking when parsing a JSON log file**
  *Symptoms*: ### Bug Description  below is error msg when panicking, `thread '<unnamed>' (15518391) panicked at src/formatting.rs:1065:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"k:{\\\"uid\\\":\\\"def35946-79ca-4e02-8aeb-ef79db20c081\\\"}\", expected a borrowed string", line: 1, column: 62))  thread '<unnamed>' (15518389) panicked at src/formatting.rs:1065:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"k:{\\\"uid\\\":\\\"def35946-79ca-4e02-8aeb-ef79db20c081\\\"}\", expected a borrowed string", line: 1, column: 62))  thread '<unnamed>' (15518392) panicked at src/formatting.rs:1065:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"v:\\\"projection.genctl.ibm.com/02k7\\\"\", expected a borrowed string", line: 1, column: 39))  thread '<unnamed>' (15518395) panicked at src/formatting.rs:1065:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"k:{\\\"uid\\\":\\\"2470a83c-3b65-4856-846e-6af55417ab87\\\"}\", expected a borrowed string", line: 1, column: 62))  thread '<unnamed>' (15518393) panicked at src/formatting.rs:1065:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"k:{\\\"uid\\\":\\\"2470a83c-3b65-4856-846e-6af55417ab87\\\"}\", expected a borrowed string", line: 1, column: 62))  thread '<unnamed>' (15518397) panicked at src/formatting.rs:1065:42: called `Result::unw
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this.  Could you please  * Clarify the exact version number (including patch version number) * Share the configuration file * Share the command line which was used to execute `hl` * Try to isolate the log entry which triggers the issue and prepare an anonymized entry which still triggers the issue – replace all sensitive data with any gibberish
  > I have a similar issue, I'll attach a minimal example. I tested without a config file so nothing in the config affects it. Parsing the lines with `jq` works fine. Same with `python -m json.tool`.  ``` $ cat parse-error.txt | hl --paging=never 2026-03-31 14:45:09.398 CEST [INF] Waiting for all WAL receivers to be down to elect a new primary › controller=cluster controllerGroup=postgresql.cnpg.io controllerKind=Cluster Cluster.name=cnpg-cnpg-500m-2048-mortenlj-cluster Cluster.namespace=bassengnamespace=basseng name=cnpg-cnpg-500m-2048-mortenlj-cluster reconcileID=ba0ac667-11cf-47ad-a05e-e626704ba126  thread '<unnamed>' (1210352) panicked at src/formatting.rs:1073:42: called `Result::unwrap()` on an `Err` value: JsonParseError(Error("invalid type: string \"k:{\\\"type\\\":\\\"ContainersReady\\\"}\", expected a borrowed string", line: 1, column: 35)) note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace  thread 'main' (1210347) panicked at src/app.rs:367:10: called 
  > Thanks, it looks like the minimal reproducer is ```json {"msg":"x","a":{"\"":0}} ```

- **Issue #1290** (2026-01-24): **fix: strip whitespace around json entries in raw output**
  *Symptoms*: ## Summary  Fix incorrect output in raw mode when processing JSON input with whitespace between entries.  ## Problem  When using raw output mode (`-r` / `--raw`) with JSON input that has whitespace (newlines, spaces) between entries, the leading whitespace could be incorrectly included at the beginning of each output entry.  ## Fix  The byte range for each JSON entry now correctly excludes leading whitespace, producing clean output without unwanted whitespace prefixes.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/pamburus/hl/pull/1290?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.08%. Comparing base ([`a432be0`](https://app.codecov.io/gh/pamburus/hl/commit/a432be01aa485d20314eae577f2d14aa81681777?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)) to head ([`c861393`](https://app.codecov.io/gh/pamburus/hl/commit/c861393efe41b8f8c102abc497071e5297b7fb7a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           ma

- **Issue #1289** (2026-01-24): **fix: restore pre-0.35.0 delimiter behavior for `--allow-prefix` and `logfmt`**
  *Symptoms*: ## Summary  Fix `--allow-prefix` not working with prefixes starting with whitespace unless `--delimiter crlf` was explicitly specified.  ## Problem  Since v0.35.0, the default `auto` delimiter mode uses multiline-aware scanning to support pretty-formatted JSON log entries. This mode assumes that lines on the boundary of adjacent entries should not start with whitespace or closing braces. This optimization broke `--allow-prefix` functionality for prefixes starting with whitespace.  Additionally, since v0.35.0, `--delimiter auto` and omitting the `--delimiter` option behaved differently: - Omitting `--delimiter` performed smart auto-selection based on `--input-format` - Explicit `--delimiter auto` always used multiline-aware scanning regardless of other options  This inconsistency was confusing and caused issues when users explicitly specified `--delimiter auto` together with `--input-format logfmt` or `--allow-prefix`.  ## Solution  When `--delimiter auto` is specified (or `--delimiter` is omitted, which now defaults to `auto`), the delimiter selection now considers other options:  - If `--allow-prefix` is used → uses newline-based delimiter (`crlf`) - If `--input-format logfmt` is used → uses newline-based delimiter (`crlf`) - If `--input-format json` is used → uses JSON boundary delimiter (for multiline or pretty-formatted JSON) - Otherwise → uses multiline-aware auto delimiter  This restores pre-0.35.0 behavior and makes `--delimiter auto` and omittin
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/pamburus/hl/pull/1289?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.07%. Comparing base ([`4acced1`](https://app.codecov.io/gh/pamburus/hl/commit/4acced1f1c7694c401f1901c7406cb5c3005ec64?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)) to head ([`e2c369a`](https://app.codecov.io/gh/pamburus/hl/commit/e2c369a50959e49aaff0b675c98f7e5fc865eb51?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##          

- **Issue #1278** (2026-01-18): **fix: preserve all unparsed prefix lines and fix raw output input badges**
  *Symptoms*: Fix additional issues with auto-delimiter mode when processing mixed JSON and non-JSON input:  - All unparsed prefix lines before JSON blocks are now preserved and output, fixing data loss where previously only the last line of multi-line prefixes was shown - Input badges are now correctly applied to all continuation lines in raw output mode (`--raw`) with multi-line JSON input  These fixes ensure complete preservation of unparsed content and consistent input badge display across all output modes.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/pamburus/hl/pull/1278?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 87.96%. Comparing base ([`62ea8c4`](https://app.codecov.io/gh/pamburus/hl/commit/62ea8c4b384fa225fa3811024627599847285871?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)) to head ([`cbe1902`](https://app.codecov.io/gh/pamburus/hl/commit/cbe1902cf924bbb93025c7626c6a9f3d07552526?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Pavel+Ivanov)). :warning: Report is 8 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##          

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

### Incident Patch 1: `9126a0e6` (2026-09-11)
**Commit Message**: fix: dependabot cap'n proto regeneration workflow (#1560)

**File**: `.github/workflows/regenerate-capnp.yml` (modified, +38/-16)
```diff
@@ -7,8 +7,10 @@ name: Regenerate Cap'n Proto bindings
 # stale, and the build script refuses to accept them, but neither Dependabot nor the scheduled update
 # job runs a build, so the staleness only surfaces as a red CI run.
 #
-# This job closes that gap: whenever an automated dependency branch is pushed, it regenerates
-# whatever is out of date and pushes the result back onto the same branch.
+# This job closes that gap: whenever an automated dependency branch is updated, it regenerates
+# whatever is out of date and pushes the result back onto the same branch. Dependabot branches are
+# handled from `pull_request_target`, because the corresponding `push` workflows do not receive the
+# repository secrets needed to mint the GitHub App token used for the push-back.
 #
 # The compiler comes from the nixpkgs revision pinned in `flake.lock` rather than from the runner
 # image, because its version is embedded verbatim in the generated output. An unpinned compiler would
@@ -18,8 +20,9 @@ name: Regenerate Cap'n Proto bindings
 "on":
   push:
     branches:
-      - "dependabot/**"
       - "update-*"
+  pull_request_target:
+    types: [opened, synchronize, reopened]
 
 permissions:
   contents: read
@@ -28,20 +31,19 @@ jobs:
   regenerate:
     name: Regenerate Cap'n Proto bindings
     runs-on: ubuntu-latest
+    if: >
+      github.event_name == 'push' ||
+      (
+        github.event_name == 'pull_request_target' &&
+        github.event.pull_request.user.login == 'dependabot[bot]' &&
+        github.event.pull_request.head.repo.full_name == github.repository &&
+        startsWith(github.event.pull_request.head.ref, 'dependabot/')
+      )
     steps:
-      - name: Generate GitHub App Token
-        id: generate-token
-        uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0
-        with:
-          app-id: ${{ secrets.APP_ID }}
-          private-key: ${{ secrets.APP_PRIVATE_KEY }}
-          owner: ${{ github.repository_owner }}
-          repositories: ${{ github.event.repository.name }}
-
       - name: Checkout repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
-          token: ${{ steps.generate-token.outputs.token }}
+          ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.ref || github.ref_name }}
 
       - name: Install latest toolchain
         uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # v1
@@ -55,6 +57,7 @@ jobs:
         uses: cachix/install-nix-action@13d8dd58da0234aa297dedd986986ccb8e7f3e24 # v31.11.1
 
       - name: Cache Nix store
+        if: github.event_name == 'push'
         uses: cachix/cachix-action@38b082610b782e7e93e209c35fd730d399dee866 # v17
         with:
           name: hl
@@ -65,14 +68,33 @@ jobs:
           CARGO_TARGET_DIR: target
         run: nix shell --inputs-from . nixpkgs#capnproto --command contrib/bin/regenerate-capnp.sh
 
-      - name: Commit and push regenerated bindings
+      - name: Check whether bindings changed
+        id: bindings-status
         run: |
           if git diff --quiet -- src/index_capnp.rs .build/capnp; then
+            echo "changed=false" >> "$GITHUB_OUTPUT"
             echo "Generated bindings are already up to date."
-            exit 0
+          else
+            echo "changed=true" >> "$GITHUB_OUTPUT"
           fi
+
+      - name: Generate GitHub App Token
+        if: steps.bindings-status.outputs.changed == 'true'
+        id: generate-token
+        uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0
+        with:
+          app-id: ${{ secrets.APP_ID }}
+          private-key: ${{ secrets.APP_PRIVATE_KEY }}
+          owner: ${{ github.repository_owner }}
+          repositories: ${{ github.event.repository.name }}
+
+      - name: Commit and push regenerated bindings
+        if: steps.bindings-status.outputs.changed == 'true'
+        env
```

---

### Incident Patch 2: `3e02e544` (2026-08-25)
**Commit Message**: fix(capnp): correct the shebang in the regeneration script (#1542)

Without it the script ran under `/bin/sh`, which on the CI runner is `dash` and rejects `set -o pipefail`, so the regeneration job failed before invoking the compiler.

**File**: `contrib/bin/regenerate-capnp.sh` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#/bin/bash
+#!/usr/bin/env bash
 
 set -euo pipefail
 
```

---

### Incident Patch 3: `5beb9652` (2026-08-25)
**Commit Message**: Revert "build(cargo): declare dependency versions per crate (#1534)" (#1538)

This reverts commit 967269b2633073d9aa741ee29a3dced14c450137.

**File**: `Cargo.toml` (modified, +25/-12)
```diff
@@ -30,21 +30,34 @@ edition = "2024"
 repository = "https://github.com/pamburus/hl"
 license = "MIT"
 
+[workspace.dependencies]
+capnp = "0.27"
+capnpc = "0.27"
+clap = { version = "4", features = ["derive", "env", "string", "wrap_help"] }
+clap_complete = { version = "4" }
+clap_mangen = { git = "https://github.com/pamburus/rust-clap.git", rev = "20f0ffd737581a5ebf7479d2174f2c197f25c94d" }
+json = { package = "serde_json", version = "1", features = ["raw_value"] }
+log = "0.4"
+memchr = "2"
+rstest = "0.26"
+shellwords = "1"
+wildcard = { path = "crates/wildcard" }
+
 [[bench]]
 harness = false
 name = "bench"
 
 [dependencies]
 anstream = "1"
 bytefmt = "0.1"
-capnp = "0.27"
+capnp.workspace = true
 chrono = { version = "0.4", default-features = false, features = ["clock", "serde", "std"] }
 chrono-english = "0.1"
 chrono-tz = { version = "0.10", features = ["serde"] }
 ciborium = "0.2"
-clap = { version = "4", features = ["derive", "env", "string", "wrap_help"] }
-clap_complete = { version = "4" }
-clap_mangen = { git = "https://github.com/pamburus/rust-clap.git", rev = "20f0ffd737581a5ebf7479d2174f2c197f25c94d" }
+clap = { workspace = true }
+clap_complete = { workspace = true }
+clap_mangen = { workspace = true }
 closure = "0.3"
 collection_macros = "0.2"
 color-print = "0.3"
@@ -71,13 +84,13 @@ hex = "0.4"
 humantime = "2"
 itertools = "0.15"
 itoa = { version = "1", default-features = false }
-json = { package = "serde_json", version = "1", features = ["raw_value"] }
+json.workspace = true
 known-folders = "1"
 liblzma = { version = "*", features = ["static"] }
 lifecycle = { path = "./crates/lifecycle" }
-log = "0.4"
+log.workspace = true
 logos = "0.16"
-memchr = "2"
+memchr.workspace = true
 mline = { path = "./crates/mline" }
 nonzero_ext = "0.3"
 notify = { version = "8", features = ["macos_kqueue"] }
@@ -94,7 +107,7 @@ serde-logfmt = { path = "./crates/serde-logfmt" }
 serde_plain = "1"
 serde-value = "0.7"
 sha2 = "0.11"
-shellwords = "1"
+shellwords.workspace = true
 signal-hook = "0.4"
 snap = "1"
 static_assertions = "1"
@@ -110,7 +123,7 @@ unicode-width = "0.2"
 utf8-supported = "1"
 which = "8"
 wild = "2"
-wildcard = { path = "crates/wildcard" }
+wildcard.workspace = true
 winapi-util = { version = "0.1" }
 wyhash = "0.6"
 yaml = { package = "yaml-peg", version = "1" }
@@ -126,16 +139,16 @@ maplit = "1"
 mockall = "0.15"
 rand = "0.10"
 regex = "1"
-rstest = "0.26"
+rstest.workspace = true
 stats_alloc = "0.1"
 wildmatch = "2"
 
 [build-dependencies]
 anyhow = "1"
-capnpc = "0.27"
+capnpc.workspace = true
 const-str = "1"
 hex = "0.4"
-json = { package = "serde_json", version = "1", features = ["raw_value"] }
+json.workspace = true
 semver = "1"
 serde = { version = "1", features = ["derive"] }
 sha2 = "0.10"
```

**File**: `crates/enumset-ext/Cargo.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ license.workspace = true
 workspace = "../.."
 
 [dependencies]
-clap = { version = "4", features = ["derive", "env", "string", "wrap_help"], optional = true }
+clap = { workspace = true, optional = true }
 enumset = { version = "1", features = [] }
 enumset-serde = { path = "../enumset-serde", optional = true }
 serde = { version = "1", optional = true }
```

**File**: `crates/pager/Cargo.toml` (modified, +2/-2)
```diff
@@ -7,5 +7,5 @@ repository.workspace = true
 license.workspace = true
 
 [dependencies]
-log = "0.4"
-shellwords = "1"
+log.workspace = true
+shellwords.workspace = true
```

**File**: `crates/wildcard/Cargo.toml` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ repository.workspace = true
 license.workspace = true
 
 [dependencies]
-memchr = "2"
+memchr.workspace = true
 
 [dev-dependencies]
-rstest = "0.26"
+rstest.workspace = true
```

---

### Incident Patch 4: `27e5a436` (2026-08-25)
**Commit Message**: Revert "build(dependabot): batch patch updates instead of ignoring them (#1531)" (#1536)

This reverts commit dcd3b7a7dd55a2fcd3618a5d6e1ab81b89d28e88.

**File**: `.github/dependabot.yml` (modified, +2/-8)
```diff
@@ -40,15 +40,9 @@ updates:
         patterns:
           - "capnp"
           - "capnpc"
-      # Patch releases are batched into a single pull request rather than suppressed, so the fixes
-      # still land without one pull request per crate.
-      patch-updates:
-        applies-to: version-updates
-        patterns:
-          - "*"
-        update-types:
-          - "patch"
     ignore:
+      - dependency-name: "*"
+        update-types: ["version-update:semver-patch"]
       - dependency-name: "anstream"
         update-types: ["version-update:semver-minor"]
       - dependency-name: "anyhow"
```

---

### Incident Patch 5: `14e4cf35` (2026-08-25)
**Commit Message**: Revert "build(dependabot): allow updates for indirect dependencies" (#1533)

Recreating #1526 against the change produced the same lock-file-only pull request, so the setting does not affect whether manifest requirements are raised. Restoring it keeps indirect dependencies out of version updates.

This reverts commit aa81d21c.

**File**: `.github/dependabot.yml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ updates:
       time: "18:00"
       timezone: "Etc/UTC"
     allow:
-      - dependency-type: all
+      - dependency-type: direct
     labels:
       - "dependencies"
       - "rust"
```

---

### Incident Patch 6: `63b0ad26` (2026-08-25)
**Commit Message**: Revert "build(dependabot): raise manifest requirements on cargo updates" (#1530)

Cargo accepts only `lockfile-only` and `auto` for `versioning-strategy`, so `increase` made the whole configuration invalid and stopped it being parsed.

This reverts commit 4515379e.

**File**: `.github/dependabot.yml` (modified, +0/-4)
```diff
@@ -26,10 +26,6 @@ updates:
       timezone: "Etc/UTC"
     allow:
       - dependency-type: direct
-    # Cargo's default strategy widens the existing requirement, which cannot express a semver-
-    # incompatible bump such as 0.1 to 0.2. Dependabot then updates only the lock file, producing a
-    # pull request whose lock file contradicts the manifest and fails `cargo check --locked`.
-    versioning-strategy: increase
     labels:
       - "dependencies"
       - "rust"
```

---

### Incident Patch 7: `c2df0ce0` (2026-06-23)
**Commit Message**: fix: regenerate index_capnp.rs for capnp 0.26 compatibility (#1467)

* build(deps): bump capnp from 0.25.6 to 0.26.0

Bumps [capnp](https://github.com/capnproto/capnproto-rust) from 0.25.6 to 0.26.0.
- [Commits](https://github.com/capnproto/capnproto-rust/compare/capnp-v0.25.6...capnp-v0.26.0)

---
updated-dependencies:
- dependency-name: capnp
  dependency-version: 0.26.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>

* fix: regenerate index_capnp.rs for capnp 0.26 compatibility

The capnp dependency was bumped from 0.25.6 to 0.26.0, which removed the
`encoded_node` field from `RawEnumSchema`. The committed `src/index_capnp.rs`
was generated by capnpc 0.25.x and still referenced that field, causing a
compile error in CI.

Regenerated `src/index_capnp.rs` using capnpc 0.26 to match the updated API.

* fix: update capnp build cache hash for regenerated index_capnp.rs

The .build/capnp/index.capnp.json hash file still recorded the hash of the
old src/index_capnp.rs (generated by capnpc 0.25.x). With the new generated
file in place, this caused the build script to unconditionally re-run capnpc
o

**File**: `.build/capnp/index.capnp.json` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 {
   "source": "53323c8019231db5acbbc6b7e1c03fa84def5c76f077ef39180065593e3c652a",
-  "target": "99eaf00c2cdf4204436ba7facd8694c8d3fcc1da9f243d327e414baa512703a6"
+  "target": "fc48108c1b1b555ba650f72b61c1cde5f5cc1d612fb404a9f951368d69739dd0"
 }
\ No newline at end of file
```

**File**: `Cargo.lock` (modified, +2/-11)
```diff
@@ -238,15 +238,6 @@ dependencies = [
  "libbz2-rs-sys",
 ]
 
-[[package]]
-name = "capnp"
-version = "0.25.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4777a3bc19b8f8e5fb2d0196c6b5dfcbbcc8b2fe08ae57f873f2f35f15cfc210"
-dependencies = [
- "embedded-io",
-]
-
 [[package]]
 name = "capnp"
 version = "0.26.0"
@@ -262,7 +253,7 @@ version = "0.26.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "13aea06b902f885cb0313b11e900e96cd57fef775e9e601a96e14e1d655f3cd3"
 dependencies = [
- "capnp 0.26.0",
+ "capnp",
 ]
 
 [[package]]
@@ -1265,7 +1256,7 @@ dependencies = [
  "base32",
  "byte-strings",
  "bytefmt",
- "capnp 0.25.6",
+ "capnp",
  "capnpc",
  "chrono",
  "chrono-english",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ repository = "https://github.com/pamburus/hl"
 license = "MIT"
 
 [workspace.dependencies]
-capnp = "0.25"
+capnp = "0.26"
 capnpc = "0.26"
 clap = { version = "4", features = ["derive", "env", "string", "wrap_help"] }
 clap_complete = { version = "4" }
```

#### Recent Merged Pull Requests:
- **PR #1576** (2026-09-28): build(deps): bump taiki-e/install-action from 2.87.15 to 2.87.20 (@dependabot[bot])
- **PR #1575** (2026-09-28): build(deps): bump github/codeql-action/init from 4.38.1 to 4.38.2 (@dependabot[bot])
- **PR #1574** (2026-09-25): build(deps): update dependencies (@missionis[bot])
- **PR #1573** (2026-09-25): chore(deps): update flake.lock (@missionis[bot])
- **PR #1572** (2026-09-21): build(deps): bump github/codeql-action/init from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #1571** (2026-09-21): build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (@dependabot[bot])
- **PR #1570** (2026-09-21): build(deps): bump dtolnay/rust-toolchain from 6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 to 02cb101ec7c40f2c49e1d9714d64511d8e1b74de (@dependabot[bot])
- **PR #1569** (2026-09-21): build(deps): bump taiki-e/install-action from 2.87.11 to 2.87.15 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
