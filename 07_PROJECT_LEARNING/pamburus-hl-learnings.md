# Forensic Learning Record (Deep Inspection): pamburus/hl

> **Canonical Artifact**: `07_PROJECT_LEARNING/pamburus-hl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pamburus/hl](https://github.com/pamburus/hl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:29.664Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pamburus/hl`
- **Description**: A fast and powerful log viewer and processor that converts JSON logs or logfmt logs into a clear human-readable format.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3302 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/lifecycle/src/lib.rs`
```
use std::thread::{self, JoinHandle};

// ---

/// Wraps a value and calls a notification callback after dropping it.
///
/// When this `DropNotifier` is dropped, it will first drop the inner value,
/// then call the notification callback.
pub struct DropNotifier<T, F>
where
    F: FnOnce(),
{
    inner: Option<T>,
    notify: Option<F>,
}

impl<T, F> DropNotifier<T, F>
where
    F: FnOnce(),
{
    /// Creates a new `DropNotifier` wrapping `value`.
    ///
    /// When this `DropNotifier` is dropped, it will first drop `value`,
    /// then call `notify`.
    pub fn new(value: T, notify: F) -> Self {
        Self {
            inner: Some(value),
            notify: Some(notify),
        }
    }
}

impl<T, F> Drop for DropNotifier<T, F>
where
    F: FnOnce(),
{
    fn drop(&mut self) {
        self.inner.take(); // drops the inner value
        if let Some(f) = self.notify.take() {
            f();
        }
    }
}

// ---

/// Drops a value in a background thread, joining on its own drop.
///
/// This is useful when dropping a value may block (e.g. `Child::wait()`),
/// and you want the drop to happen asynchronously while still ensuring
/// it completes before the owning scope exits.
pub struct AsyncDrop {
    handle: Option<JoinHandle<()>>,
}

impl AsyncDrop {
    /// Spawns a background thread that takes ownership of `value` and drops it.
    pub fn new<T: Send + 'static>(value: T) -> Self {
        let handle = thread::spawn(move || {
            drop(value);
        });
        Self { handle: Some(handle) }
    }
}

impl Drop for AsyncDrop {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.take() {
            handle.join().ok();
        }
    }
}

// ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn drop_notifier_calls_notify_on_drop() {
        let called = Arc::new(Mutex::new(false));
        let called_clone = Arc::clone(&called);

        {
            let _notifier = DropNotifier::new(42, move || {
                *called_clone.lock().unwrap() = true;
            });
        }

        assert!(*called.lock().unwrap());
    }

    #[test]
    fn drop_notifier_drops_inner_before_notify() {
        let order = Arc::new(Mutex::new(Vec::new()));
        let order_clone = Arc::clone(&order);

        struct TestDrop {
            order: Arc<Mutex<Vec<u8>>>,
        }

        impl Drop for TestDrop {
            fn drop(&mut self) {
                self.order.lock().unwrap().push(1);
            }
        }

        {
            let test_drop = TestDrop {
                order: Arc::clone(&order),
            };
            let _notifier = DropNotifier::new(test_drop, move || {
                order_clone.lock().unwrap().push(2);
            });
        }

        let sequence = order.lock().unwrap();
        assert_eq!(*sequence, vec![1, 2]);
    }

    #[test]
    fn async_drop_drops_value_in_background() {
        let dropped = Arc::new(Mutex::new(false));
        let dropped_clone = Arc::clone(&dropped);

        struct TestDrop {
            dropped: Arc<Mutex<bool>>,
        }

        impl Drop for TestDrop {
            fn drop(&mut self) {
                *self.dropped.lock().unwrap() = true;
            }
        }

        {
            let test_drop = TestDrop { dropped: dropped_clone };
            let _async_drop = AsyncDrop::new(test_drop);
        }

        assert!(*dropped.lock().unwrap());
    }

    #[test]
    fn async_drop_waits_for_completion() {
        let started = Arc::new(Mutex::new(false));
        let started_clone = Arc::clone(&started);
        let completed = Arc::new(Mutex::new(false));
        let completed_clone = Arc::clone(&completed);

        struct SlowDrop {
            started: Arc<Mutex<bool>>,
            completed: Arc<Mutex<bool>>,
        }

        impl Drop for SlowDrop {
            fn drop(&mut self) {
                *self.started.lock().unwrap() = true;
                std::thread::sleep(std::time::Duration::from_millis(50));
                *self.completed.lock().unwrap() = true;
            }
        }

        {
            let slow_drop = SlowDrop {
                started: started_clone,
                completed: completed_clone,
            };
            let _async_drop = AsyncDrop::new(slow_drop);
        }

        assert!(*started.lock().unwrap());
        assert!(*completed.lock().unwrap());
    }
}

```

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

### Core Architecture Module: `benches/bench/ws/encstr.rs`
```
// std imports
use std::{hint::black_box, time::Duration};

// third-party imports
use const_str::concat as strcat;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput, criterion_group};
use json::de::{Read, StrRead};

// local imports
use super::{BencherExt, ND, hash, samples};
use encstr::{AnyEncodedString, Builder, Handler, Ignorer, json::JsonEncodedString, raw::RawString};

criterion_group!(benches, bench);

const GROUP: &str = strcat!(super::GROUP, ND, "encstr");

fn bench(c: &mut Criterion) {
    for (input, batch) in [
        (samples::str::query01::JSON, BatchSize::SmallInput),
        (samples::str::ipsum01::JSON, BatchSize::SmallInput),
    ] {
        bench_with(c, "json", input, Json, batch);
    }
    for (input, batch) in [
        (samples::str::query01::RAW, BatchSize::SmallInput),
        (samples::str::ipsum01::RAW, BatchSize::SmallInput),
    ] {
        bench_with(c, "raw", input, Raw, batch);
    }
}

fn bench_with<I: InputConstruct>(
    c: &mut Criterion,
    title: &str,
    input: &'static str,
    constructor: I,
    batch: BatchSize,
) {
    let param = format!("{}:{}:{}", title, input.len(), hash(input));

    let mut group = c.benchmark_group(GROUP);
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(5));
    group.throughput(Throughput::Bytes(input.len() as u64));

    if title == "json" {
        group.bench_function(BenchmarkId::new("serde-json:parse-str", &param), |b| {
            let setup = || String::from(input);
            b.iter_batched_ref_fixed(
                setup,
                |input| {
                    let _: json::Value = json::from_str(input).unwrap();
                },
                batch,
            );
        });

        group.bench_function(BenchmarkId::new("serde-json:parse-str-raw", &param), |b| {
            let setup = || (Vec::with_capacity(4096), String::from(input));
            b.iter_batched_ref_fixed(
                setup,
                |(buf, input)| {
                    let mut reader = black_box(StrRead::new(&input[1..]));
                    reader.parse_str_raw(buf).unwrap();
                },
                batch,
            );
        });

        group.bench_function(BenchmarkId::new("serde-json:ignore-str", &param), |b| {
            let setup = || String::from(input);
            b.iter_batched_ref_fixed(
                setup,
                |input| {
                    let mut reader = black_box(StrRead::new(&input[1..]));
                    reader.ignore_str().unwrap()
                },
                batch,
            );
        });
    }

    group.bench_function(BenchmarkId::new("decode:ignore", &param), |b| {
        let mut target = Ignorer;
        let setup = || String::from(input);
        b.iter_batched_ref_fixed(
            setup,
            |input| {
                let input = black_box(constructor.new_input(input));
                input.decode(&mut target).unwrap()
            },
            batch,
        );
    });

    group.bench_function(BenchmarkId::new("decode:build", &param), |b| {
        let setup = || (Builder::with_capacity(4096), String::from(input));
        b.iter_batched_ref_fixed(
            setup,
            |(buf, input)| {
                let input = black_box(constructor.new_input(input));
                input.decode(buf).unwrap()
            },
            batch,
        );
    });

    group.bench_function(BenchmarkId::new("tokens:ignore", &param), |b| {
        let setup = || String::from(input);
        b.iter_batched_ref_fixed(
            setup,
            |input| {
                let input = black_box(constructor.new_input(input));
                for token in input.tokens() {
                    token.unwrap();
                }
            },
            batch,
        );
    });

    group.bench_function(BenchmarkId::new("tokens:build", &param), |b| {
        let setup = || (Builder::with_capacity(4096), String::from(input));
        b.iter_batched_ref_fixed(
            setup,
            |(buf, input)| {
                let input = black_box(constructor.new_input(input));
                for token in input.tokens() {
                    buf.handle(token.unwrap()).unwrap();
                }
            },
            batch,
        );
    });

    group.finish();
}

trait InputConstruct {
    type Output<'a>: AnyEncodedString<'a>;

    fn new_input<'a>(&self, input: &'a str) -> Self::Output<'a>;
}

struct Json;

impl InputConstruct for Json {
    type Output<'a> = JsonEncodedString<'a>;

    #[inline(always)]
    fn new_input<'a>(&self, input: &'a str) -> Self::Output<'a> {
        JsonEncodedString::new(input)
    }
}

struct Raw;

impl InputConstruct for Raw {
    type Output<'a> = RawString<'a>;

    #[inline(always)]
    fn new_input<'a>(&self, input: &'a str) -> Self::Output<'a> {
        RawString::new(input)
    }
}

```

### Core Architecture Module: `benches/bench/ws/hl/combined.rs`
```
// std imports
use std::{iter::empty, sync::Arc};

// third-party imports
use chrono::{Offset, Utc};
use const_str::concat as strcat;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput};

// local imports
use super::{BencherExt, ND, hash, samples};
use hl::{
    DateTimeFormatter, Filter, LinuxDateFormat, Parser, ParserSettings, SegmentProcessor, Settings, Theme,
    app::{RecordIgnorer, SegmentProcess, SegmentProcessorOptions},
    formatting::{NoOpRecordWithSourceFormatter, RecordFormatterBuilder},
    settings::{self, ExpansionMode},
    timezone::Tz,
};

const GROUP: &str = strcat!(super::GROUP, ND, "combined");

const THEME: &str = "universal";
const SAMPLES: [(&str, &[u8], ExpansionMode); 6] = [
    ("json", samples::log::elk01::JSON, ExpansionMode::Inline),
    ("logfmt", samples::log::elk01::LOGFMT, ExpansionMode::Inline),
    ("json", samples::log::elk01::JSON, ExpansionMode::Always),
    ("logfmt", samples::log::elk01::LOGFMT, ExpansionMode::Always),
    ("json", samples::log::int01::JSON, ExpansionMode::Inline),
    ("logfmt", samples::log::int01::LOGFMT, ExpansionMode::Inline),
];

pub(super) fn bench(c: &mut Criterion) {
    let mut c = c.benchmark_group(GROUP);

    for (format, input, expansion) in SAMPLES {
        let mut param = format!("{}:{}:{}", format, input.len(), hash(input));
        if expansion != ExpansionMode::Inline {
            param = format!("{}:x={}", param, expansion);
        }

        c.throughput(Throughput::Bytes(input.len() as u64));

        let settings = Settings::default();
        let parser = Parser::new(ParserSettings::new(&settings.fields.predefined, empty(), None));
        let filter = Filter::default();
        let formatter = RecordFormatterBuilder::new()
            .with_theme(Arc::new(Theme::embedded(THEME).unwrap()))
            .with_timestamp_formatter(DateTimeFormatter::new(
                LinuxDateFormat::new("%b %d %T.%3N").compile(),
                Tz::FixedOffset(Utc.fix()),
            ))
            .with_expansion(expansion.into())
            .with_options(settings::Formatting::default())
            .build();

        c.bench_function(BenchmarkId::new("parse-and-format", &param), |b| {
            let mut processor = SegmentProcessor::new(&parser, &formatter, &filter, SegmentProcessorOptions::default());
            let setup = || Vec::with_capacity(4096);

            b.iter_batched_ref_fixed(
                setup,
                |buf| {
                    processor.process(input, buf, "", None, &mut RecordIgnorer {});
                },
                BatchSize::SmallInput,
            );
        });

        c.bench_function(BenchmarkId::new("parse-only", &param), |b| {
            let formatter = NoOpRecordWithSourceFormatter;
            let mut processor = SegmentProcessor::new(&parser, formatter, &filter, SegmentProcessorOptions::default());
            let setup = || Vec::with_capacity(4096);

            b.iter_batched_ref_fixed(
                setup,
                |buf| {
                    processor.process(input, buf, "", None, &mut RecordIgnorer {});
                },
                BatchSize::SmallInput,
            );
        });
    }
}

```

### Core Architecture Module: `benches/bench/ws/hl/delimiter.rs`
```
// std imports
use std::{hint::black_box, time::Duration};

// third-party imports
use const_str::concat as strcat;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput};

// local imports
use super::{BencherExt, ND, hash, samples};
use hl::{Delimit, Delimiter, SearchExt};

const GROUP: &str = strcat!(super::GROUP, ND, "delimiter");

pub(super) fn bench(c: &mut Criterion) {
    let mut c = c.benchmark_group(GROUP);
    c.warm_up_time(Duration::from_secs(2));
    c.measurement_time(Duration::from_secs(3));

    let variants = [
        (
            "s1:byte:e",
            Vec::from(samples::log::elk01::JSON),
            Delimiter::Byte(b'\n'),
            BatchSize::NumIterations(8192),
        ),
        (
            "s1:byte:s",
            rotated(samples::log::elk01::JSON, 1),
            Delimiter::Byte(b'\n'),
            BatchSize::NumIterations(8192),
        ),
        (
            "s1:new-line:lf:e",
            Vec::from(samples::log::elk01::JSON),
            Delimiter::Newline,
            BatchSize::NumIterations(8192),
        ),
        (
            "s1:new-line:lf:s",
            rotated(samples::log::elk01::JSON, 1),
            Delimiter::Newline,
            BatchSize::NumIterations(8192),
        ),
    ];

    for edge in [false, true] {
        for (title, input, delim, batch) in &variants {
            let param = format!(
                "{}:{}:{}:{}",
                title,
                input.len(),
                hash(input),
                if edge { "edge" } else { "center" }
            );

            let bytes = Throughput::Bytes(
                delim
                    .clone()
                    .into_searcher()
                    .search_l(input, edge)
                    .map(|x| x.end as u64)
                    .unwrap_or(0),
            );
            c.throughput(bytes)
                .bench_function(BenchmarkId::new("search-l", &param), |b| {
                    let setup = || (input.clone(), delim.clone().into_searcher());
                    b.iter_batched_ref_fixed(setup, |(input, searcher)| searcher.search_l(input, edge), *batch)
                });

            let bytes = Throughput::Bytes(input.len() as u64);
            c.throughput(bytes)
                .bench_function(BenchmarkId::new("split", &param), |b| {
                    let setup = || (input.clone(), delim.clone().into_searcher());
                    b.iter_batched_ref_fixed(
                        setup,
                        |(input, searcher)| {
                            for x in searcher.split(input) {
                                black_box(x);
                            }
                        },
                        *batch,
                    )
                });

            let bytes = Throughput::Bytes(
                delim
                    .clone()
                    .into_searcher()
                    .search_r(input, edge)
                    .map(|x| (input.len() - x.start) as u64)
                    .unwrap_or(0),
            );
            c.throughput(bytes)
                .bench_function(BenchmarkId::new("search-r", &param), |b| {
                    let setup = || (input.clone(), delim.clone().into_searcher());
                    b.iter_batched_ref_fixed(setup, |(input, searcher)| searcher.search_r(input, edge), *batch)
                });
        }
    }
}

fn rotated(data: &[u8], n: usize) -> Vec<u8> {
    let mut v = Vec::from(data);
    v.rotate_right(n);
    v
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

### Incident Patch 1: `c1ac299f` (2026-10-02)
**Commit Message**: build(deps): update dependencies (#1578)

Updating lazy_static v1.5.0 -> v1.5.1

Co-authored-by: missionis[bot] <234988995+missionis[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1579,9 +1579,9 @@ dependencies = [
 
 [[package]]
 name = "lazy_static"
-version = "1.5.0"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
+checksum = "20870f649af7073d53e38067b2a84312175d56ea15217e1b15bc83506ec50afb"
 
 [[package]]
 name = "libbz2-rs-sys"
```

---

### Incident Patch 2: `81a8d0de` (2026-09-28)
**Commit Message**: build(deps): bump taiki-e/install-action from 2.87.15 to 2.87.20 (#1576)

Bumps [taiki-e/install-action](https://github.com/taiki-e/install-action) from 2.87.15 to 2.87.20.
- [Release notes](https://github.com/taiki-e/install-action/releases)
- [Changelog](https://github.com/taiki-e/install-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/taiki-e/install-action/compare/4076c08d76dba979c11a7285295b0716c1d67908...9983c65e42da123ff25d1f78505eb6de315aa172)

---
updated-dependencies:
- dependency-name: taiki-e/install-action
  dependency-version: 2.87.20
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ jobs:
         uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
 
       - name: Install coverage tools
-        uses: taiki-e/install-action@4076c08d76dba979c11a7285295b0716c1d67908 # v2.87.15
+        uses: taiki-e/install-action@9983c65e42da123ff25d1f78505eb6de315aa172 # v2.87.20
         with:
           tool: rustfilt@${{ env.RUSTFILT_VERSION }}
 
```

---

### Incident Patch 3: `df1f254e` (2026-09-28)
**Commit Message**: build(deps): bump github/codeql-action/init from 4.38.1 to 4.38.2 (#1575)

Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.38.1 to 4.38.2.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

---
updated-dependencies:
- dependency-name: github/codeql-action/init
  dependency-version: 4.38.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -71,7 +71,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
@@ -100,6 +100,6 @@ jobs:
           exit 1
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           category: "/language:${{matrix.language}}"
```

---

### Incident Patch 4: `7b83e18a` (2026-09-25)
**Commit Message**: build(deps): update dependencies (#1574)

Updating cc v1.4.7 -> v1.5.1
    Updating find-msvc-tools v0.1.13 -> v0.1.14
    Updating js-sys v0.3.105 -> v0.3.106
    Updating libredox v0.1.24 -> v0.1.25
    Updating pest v2.9.1 -> v2.9.2
    Updating pest_derive v2.9.1 -> v2.9.2
    Updating pest_generator v2.9.1 -> v2.9.2
    Updating pest_meta v2.9.1 -> v2.9.2
    Updating rand v0.10.2 -> v0.10.3
    Updating rustls-platform-verifier v0.7.0 -> v0.7.1
    Updating rustls-platform-verifier-android v0.1.1 -> v0.2.0
    Updating siphasher v1.0.3 -> v1.0.4
    Updating thiserror v2.0.20 -> v2.0.21
    Updating thiserror-impl v2.0.20 -> v2.0.21
    Updating wasm-bindgen v0.2.128 -> v0.2.129
    Updating wasm-bindgen-macro v0.2.128 -> v0.2.129
    Updating wasm-bindgen-macro-support v0.2.128 -> v0.2.129
    Updating wasm-bindgen-shared v0.2.128 -> v0.2.129
    Updating web-sys v0.3.105 -> v0.3.106
    Updating zerocopy v0.8.57 -> v0.8.59
    Updating zerocopy-derive v0.8.57 -> v0.8.59

Co-authored-by: missionis[bot] <234988995+missionis[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +42/-42)
```diff
@@ -261,9 +261,9 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "cc"
-version = "1.4.7"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "54413ede23c2daf518f35156dfde027feb2374004d63bd497f983c8db9c0e313"
+checksum = "f360145194ee8e21db5ee7f3fcd4fe52210864c75c985dae33218202c8bbe040"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
@@ -981,9 +981,9 @@ checksum = "da7c62ceae207dd37ea5b845da6a0696c799f85e97da1ab5b7910be3c1c80223"
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.13"
+version = "0.1.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ef25905e51abafe4dcea6c15fec58c57b601cdbd0ee53d22ea1d3016c587d39b"
+checksum = "aedcfb3409746eddb02b9e19ebda1c3394f759a152e48ee875a0844d1b955484"
 
 [[package]]
 name = "flate2"
@@ -1528,9 +1528,9 @@ dependencies = [
 
 [[package]]
 name = "js-sys"
-version = "0.3.105"
+version = "0.3.106"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ce57d20d1ea864ce2ac172ab472d409214f4fd359f0b2a2775abdf522e2af99e"
+checksum = "7883d941dae510fb2d978fc3fe018c71c9e2892fd38854de3e8b92c2e5ad9cc5"
 dependencies = [
  "cfg-if",
  "futures-util",
@@ -1617,9 +1617,9 @@ dependencies = [
 
 [[package]]
 name = "libredox"
-version = "0.1.24"
+version = "0.1.25"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6480ccc157a1389bb2e4891b24751b0f798ba640d22386f23143fbcc89da195a"
+checksum = "61ff90caf6077a803a240f62fdbe88645a890bbca49ef8174c3cb0404362171d"
 dependencies = [
  "libc",
 ]
@@ -1980,29 +1980,29 @@ checksum = "9b4f627cb1b25917193a259e49bdad08f671f8d9708acfd5fe0a8c1455d87220"
 
 [[package]]
 name = "pest"
-version = "2.9.1"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6d45aeb61b4bf818e12d4205f2466f8c4748f85f4fce0146d1c03d69d753f0ad"
+checksum = "45d3aca230fad2e6f6317ca0a72724338c4960cb97168a85cdee66df4a9a21a8"
 dependencies = [
  "memchr",
  "ucd-trie",
 ]
 
 [[package]]
 name = "pest_derive"
-version = "2.9.1"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "89cc5a242e25ed4e7704d0be240f2cfbe20a8c27e7e252d94835be93d92dc39f"
+checksum = "284b60557f2c4a2e72ad3f2d34d42685a2fa4a6a61d0d2a10c0ae2a5e916c2cf"
 dependencies = [
  "pest",
  "pest_generator",
 ]
 
 [[package]]
 name = "pest_generator"
-version = "2.9.1"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7abf21475cc3820fe4b2ca2dc2142902f67a02189f3b5b3a229f4febc01a43e5"
+checksum = "1d9d1f08a115309ee99268cf85e5228e0e56aa9caf8841ec12866b6be07c3109"
 dependencies = [
  "pest",
  "pest_meta",
@@ -2013,9 +2013,9 @@ dependencies = [
 
 [[package]]
 name = "pest_meta"
-version = "2.9.1"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "adba4db388f687393c18c51348d44a41d870ca9df71a2c98172ea3035dc6936e"
+checksum = "ed93ba1a9ffcca32130a5188701c81c0c49cf00d4b7c5007d5148951d743adcb"
 dependencies = [
  "pest",
 ]
@@ -2154,9 +2154,9 @@ checksum = "f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf"
 
 [[package]]
 name = "rand"
-version = "0.10.2"
+version = "0.10.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c7f5fa3a058cd35567ef9bfa5e75732bee0f9e4c55fa90477bef2dfcdbc4be80"
+checksum = "65c9fb96cbc91e3478eaae79a69fcd3f1ae4ad052e471fe6732fff548984b4af"
 dependencies = [
  "chacha20",
  "getrandom 0.4.3",
@@ -2419,9 +2419,9 @@ dependencies = [
 
 [[package]]
 name = "rustls-platform-verifier"
-version = "0.7.0"
+version = "0.7.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "26d1e2536ce4f35f4846aa13bff16bd0ff40157cdb14cc056c7b14ba41233ba0"
+checksum = "1167586491e2b18b8bfbb293e8180ec17c201c4f076d7cb3070ca964e7598f98"
 dependencies = [
  "core-foundation",
  "core-foundation-sys",
@@ -2440,9 +2440,9 @@ dependencies = [
 
 [[package]]
 name = "rustls-platform-verifier-android"
-version = "0.1.1"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f87165f0995f63a9fbeea62b64d10b4d9d8e78ec6d7d51fb2125fda7bb36788f"
+checksum = "eec689c0bc40ff2458a5977b6619cb718087084a18e02a131c599b62d05e1a5f"
 
 [[package]]
 name = "rustls-webpki"
@@ -2675,9 +2675,9 @@ checksum = "e3a9fe34e3e7a50316060351f37187a3f546bce95496156754b601a5fa71b76e"
 
 [[package]]
 name = "siphasher"
-version = "1.0.3"
+version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ee5873ec9cce0195efcb7a4e9507a04cd49aec9c83d0389df45b1ef7ba2e649"
+checksum = "33f4fe9184a62d842c9ef383018f3306d8ba224fd9d836f56d7288308847c256"
 
 [[package]]
 name = "slab"
@@ -2804,18 +2804,18 @@ checksum = "8f50febec83f5ee1df3015341d8bd429f2d1cc62bcba7ea2076759d315084683"
 
 [[package]]
 name = "thiserror"
-version = "2.0.20"
+version = "2.0.21"
 so
```

---

### Incident Patch 5: `1410f567` (2026-09-21)
**Commit Message**: build(deps): bump github/codeql-action/init from 4.38.0 to 4.38.1 (#1572)

Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

---
updated-dependencies:
- dependency-name: github/codeql-action/init
  dependency-version: 4.38.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -71,7 +71,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
@@ -100,6 +100,6 @@ jobs:
           exit 1
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           category: "/language:${{matrix.language}}"
```

---

### Incident Patch 6: `c2b7fc7e` (2026-09-21)
**Commit Message**: build(deps): bump taiki-e/install-action from 2.87.11 to 2.87.15 (#1569)

Bumps [taiki-e/install-action](https://github.com/taiki-e/install-action) from 2.87.11 to 2.87.15.
- [Release notes](https://github.com/taiki-e/install-action/releases)
- [Changelog](https://github.com/taiki-e/install-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/taiki-e/install-action/compare/9534c84618278caac52cb373bb164ed464dbd8af...4076c08d76dba979c11a7285295b0716c1d67908)

---
updated-dependencies:
- dependency-name: taiki-e/install-action
  dependency-version: 2.87.15
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ jobs:
         uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
 
       - name: Install coverage tools
-        uses: taiki-e/install-action@9534c84618278caac52cb373bb164ed464dbd8af # v2.87.11
+        uses: taiki-e/install-action@4076c08d76dba979c11a7285295b0716c1d67908 # v2.87.15
         with:
           tool: rustfilt@${{ env.RUSTFILT_VERSION }}
 
```

---

### Incident Patch 7: `e1d32bc3` (2026-09-21)
**Commit Message**: build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (#1571)

Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.1.
- [Release notes](https://github.com/codecov/codecov-action/releases)
- [Changelog](https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/codecov/codecov-action/compare/fb8b3582c8e4def4969c97caa2f19720cb33a72f...303a32d7a59b442fa8d48b6a1cc6825c09c847a5)

---
updated-dependencies:
- dependency-name: codecov/codecov-action
  dependency-version: 7.1.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ jobs:
           make coverage
 
       - name: Upload coverage to codecov.io
-        uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v7.0.0
+        uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
         with:
           use_oidc: true
 
```

---

### Incident Patch 8: `51798707` (2026-09-21)
**Commit Message**: build(deps): bump tombi-toml/setup-tombi from 1.5.4 to 1.5.5 (#1568)

Bumps [tombi-toml/setup-tombi](https://github.com/tombi-toml/setup-tombi) from 1.5.4 to 1.5.5.
- [Release notes](https://github.com/tombi-toml/setup-tombi/releases)
- [Commits](https://github.com/tombi-toml/setup-tombi/compare/0ca8607861bce3508ba79339c7c47acb40a334e1...ea139001852855a7f1cf30a9b60c71ebb6446a99)

---
updated-dependencies:
- dependency-name: tombi-toml/setup-tombi
  dependency-version: 1.5.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
         uses: uncenter/setup-taplo@b18c8c8302695fe63d6853bc004006215ac52b91 # v2
 
       - name: Setup tombi
-        uses: tombi-toml/setup-tombi@0ca8607861bce3508ba79339c7c47acb40a334e1 # v1.5.4
+        uses: tombi-toml/setup-tombi@ea139001852855a7f1cf30a9b60c71ebb6446a99 # v1.5.5
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
```

---

### Incident Patch 9: `4201cd58` (2026-09-21)
**Commit Message**: build(deps): bump dtolnay/rust-toolchain (#1570)

Bumps [dtolnay/rust-toolchain](https://github.com/dtolnay/rust-toolchain) from 6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 to 02cb101ec7c40f2c49e1d9714d64511d8e1b74de.
- [Release notes](https://github.com/dtolnay/rust-toolchain/releases)
- [Commits](https://github.com/dtolnay/rust-toolchain/compare/6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772...02cb101ec7c40f2c49e1d9714d64511d8e1b74de)

---
updated-dependencies:
- dependency-name: dtolnay/rust-toolchain
  dependency-version: 02cb101ec7c40f2c49e1d9714d64511d8e1b74de
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -49,7 +49,7 @@ jobs:
         run: tombi lint
 
       - name: Install latest nightly
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # v1
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # v1
         with:
           toolchain: nightly
           components: rustfmt
@@ -121,7 +121,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Install latest toolchain
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # v1
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # v1
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/regenerate-capnp.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
           ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.ref || github.ref_name }}
 
       - name: Install latest toolchain
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # v1
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # v1
         with:
           toolchain: stable
 
```

---

### Incident Patch 10: `96bc72a2` (2026-09-18)
**Commit Message**: build(deps): update dependencies (#1567)

Updating cc v1.4.5 -> v1.4.7
    Updating cfg-if v1.0.4 -> v1.0.5
    Updating clap v4.6.6 -> v4.6.7
    Updating clap_builder v4.6.6 -> v4.6.7
    Updating clap_complete v4.6.9 -> v4.6.11
    Updating clap_derive v4.6.4 -> v4.6.7
    Updating clap_lex v1.1.0 -> v1.1.1
    Updating crc32fast v1.5.1 -> v1.5.2
    Updating derive-where v1.6.1 -> v1.7.0
    Updating find-msvc-tools v0.1.12 -> v0.1.13
    Updating jiff v0.2.35 -> v0.2.37
    Updating jiff-core v0.1.0 -> v0.1.1
    Updating jiff-static v0.2.35 -> v0.2.37
    Updating liblzma-sys v0.4.8 -> v0.4.9
    Updating libredox v0.1.23 -> v0.1.24
    Updating redox_users v0.5.2 -> v0.5.3
    Updating rustix v1.1.4 -> v1.1.5
    Updating rustls v0.23.44 -> v0.23.45
    Updating syn v3.0.5 -> v3.0.6
    Updating unicode-ident v1.0.24 -> v1.0.26
    Updating ureq v3.4.1 -> v3.4.2
    Updating ureq-proto v0.6.2 -> v0.6.4
    Updating zlib-rs v0.6.7 -> v0.6.8

Co-authored-by: missionis[bot] <234988995+missionis[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +54/-54)
```diff
@@ -128,7 +128,7 @@ checksum = "82f6aeea286b8eb4dd3431a1be1b59d290ace00f5bfd8e2a159bc2a05e2c1667"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 3.0.5",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -261,9 +261,9 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "cc"
-version = "1.4.5"
+version = "1.4.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "005ec2760ca554fae18df7a11195552ec576cd665632a881bc011d5bb2fd4d80"
+checksum = "54413ede23c2daf518f35156dfde027feb2374004d63bd497f983c8db9c0e313"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
@@ -273,9 +273,9 @@ dependencies = [
 
 [[package]]
 name = "cfg-if"
-version = "1.0.4"
+version = "1.0.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
+checksum = "4e7648175b45a9a48536d676f68d918270699102aa8dab5496df06904c914600"
 
 [[package]]
 name = "chacha20"
@@ -350,19 +350,19 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "473c7e07f409a8d772161724aa8db6a765a2532a70f9667eeb7b49d3d02fbdca"
+checksum = "aa8876b300ab35ba921adea3dfd70157a46249b33f95c9084ae5709785478946"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b48fea5a88e9ae728a2dcbedbfc0e730f7d60da42e1cb049a83c9fb8b789889"
+checksum = "ec0797fb7aeb1406c84efac526901f7ec3ead2124f946b494e72879d4b54704d"
 dependencies = [
  "anstream",
  "anstyle",
@@ -373,30 +373,30 @@ dependencies = [
 
 [[package]]
 name = "clap_complete"
-version = "4.6.9"
+version = "4.6.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3be2ad0423bdbbb0e25bc89add796f3559706d4a95e1bc98e4d9662a957b6a19"
+checksum = "037e2a1a92236d0aff7e845093f64661d6df4c02c9fcc61a60e9e1d736fa392f"
 dependencies = [
  "clap",
 ]
 
 [[package]]
 name = "clap_derive"
-version = "4.6.4"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d012d2b9d65aca7f18f4d9878a045bc17899bba951561ba5ec3c2ba1eed9a061"
+checksum = "f9c751b79415d4e559e3d1fcf128e09e720eb673a06d26cf6f392d37d75b66e0"
 dependencies = [
  "heck",
  "proc-macro2",
  "quote",
- "syn 3.0.5",
+ "syn 3.0.6",
 ]
 
 [[package]]
 name = "clap_lex"
-version = "1.1.0"
+version = "1.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
+checksum = "1c133bc6a41be0d194c306b5506d15e6feeea7b1d6604bd3f8310dfb2ca96486"
 
 [[package]]
 name = "clap_mangen"
@@ -559,9 +559,9 @@ dependencies = [
 
 [[package]]
 name = "crc32fast"
-version = "1.5.1"
+version = "1.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8498c871161e1742aaa9d52551b2d6ebdd4c3d45a3be423e3728f33b955be550"
+checksum = "01a7799fd6b852db0e61728dde9a204c423b44d689dbd432522543614b490e78"
 dependencies = [
  "cfg-if",
 ]
@@ -748,13 +748,13 @@ dependencies = [
 
 [[package]]
 name = "derive-where"
-version = "1.6.1"
+version = "1.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d08b3a0bcc0d079199cd476b2cae8435016ec11d1c0986c6901c5ac223041534"
+checksum = "2e2b94854e8576378ccda7c8de8a66ed8b4e8acbd2c50ec3418ea6c8aaf4b567"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.119",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -981,9 +981,9 @@ checksum = "da7c62ceae207dd37ea5b845da6a0696c799f85e97da1ab5b7910be3c1c80223"
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.12"
+version = "0.1.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3e0f1c7c3a72c66fd80abe965175f7523475c0489a87d3ff9d6e8c87d87a9d2d"
+checksum = "ef25905e51abafe4dcea6c15fec58c57b601cdbd0ee53d22ea1d3016c587d39b"
 
 [[package]]
 name = "flate2"
@@ -1432,9 +1432,9 @@ checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
 [[package]]
 name = "jiff"
-version = "0.2.35"
+version = "0.2.37"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "668b7183bd07af9a4885f5c35b0cc5c83c4607a913c16b7e17291832910d2dcc"
+checksum = "0ab1baf72f08796de0260609515130699b890ac25f30e610ad894bc5856cafdb"
 dependencies = [
  "defmt",
  "jiff-core",
@@ -1447,18 +1447,19 @@ dependencies = [
 
 [[package]]
 name = "jiff-core"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7feca88439efe53da3754500c1851dedf3cb36c524dd5cf8225cc0794de95d09"
+checksum = "5e52fe76043ccecc9005d2305ebaadf7d7fc0cc89ca6baa10a94d6bc68c7128c"
 dependencies = [
  "defmt",
+ "log",
 ]
 
 [[package]]
 name = "jiff-static"
-version = "0.2.35"
+version = "0.2.37"
 source = "registry+https://github.com/rust-l
```

---

### Incident Patch 11: `b11c6214` (2026-09-14)
**Commit Message**: build(deps): bump github/codeql-action/init from 4.37.9 to 4.38.0 (#1562)

Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.37.9 to 4.38.0.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

---
updated-dependencies:
- dependency-name: github/codeql-action/init
  dependency-version: 4.38.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -71,7 +71,7 @@ jobs:
 
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
@@ -100,6 +100,6 @@ jobs:
           exit 1
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           category: "/language:${{matrix.language}}"
```

---

### Incident Patch 12: `9dc90f4c` (2026-09-14)
**Commit Message**: build(deps): bump actions-rust-lang/setup-rust-toolchain (#1564)

Bumps [actions-rust-lang/setup-rust-toolchain](https://github.com/actions-rust-lang/setup-rust-toolchain) from 1.17.0 to 2.0.0.
- [Release notes](https://github.com/actions-rust-lang/setup-rust-toolchain/releases)
- [Changelog](https://github.com/actions-rust-lang/setup-rust-toolchain/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions-rust-lang/setup-rust-toolchain/compare/166cdcfd11aee3cb47222f9ddb555ce30ddb9659...ecabd13d1c56bd1345c230e542e9144811ad706f)

---
updated-dependencies:
- dependency-name: actions-rust-lang/setup-rust-toolchain
  dependency-version: 2.0.0
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/build.yml` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ jobs:
         with:
           ref: ${{ inputs.ref || github.ref }}
 
-      - uses: actions-rust-lang/setup-rust-toolchain@166cdcfd11aee3cb47222f9ddb555ce30ddb9659 # v1.17.0
+      - uses: actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f # v2.0.0
         with:
           toolchain: stable
           rustflags: ""
```

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ jobs:
           echo "branch=${TEMP_BRANCH:?}" >> $GITHUB_OUTPUT
 
       - name: Setup Rust toolchain
-        uses: actions-rust-lang/setup-rust-toolchain@166cdcfd11aee3cb47222f9ddb555ce30ddb9659 # v1.17.0
+        uses: actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f # v2.0.0
         with:
           toolchain: stable
           rustflags: ""
```

---

### Incident Patch 13: `2c77043c` (2026-09-14)
**Commit Message**: build(deps): bump taiki-e/install-action from 2.87.5 to 2.87.11 (#1565)

Bumps [taiki-e/install-action](https://github.com/taiki-e/install-action) from 2.87.5 to 2.87.11.
- [Release notes](https://github.com/taiki-e/install-action/releases)
- [Changelog](https://github.com/taiki-e/install-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/taiki-e/install-action/compare/5bf6ce016fd2e72eefc647cbca1e4213f65955b8...9534c84618278caac52cb373bb164ed464dbd8af)

---
updated-dependencies:
- dependency-name: taiki-e/install-action
  dependency-version: 2.87.11
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ jobs:
         uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
 
       - name: Install coverage tools
-        uses: taiki-e/install-action@5bf6ce016fd2e72eefc647cbca1e4213f65955b8 # v2.87.5
+        uses: taiki-e/install-action@9534c84618278caac52cb373bb164ed464dbd8af # v2.87.11
         with:
           tool: rustfilt@${{ env.RUSTFILT_VERSION }}
 
```

---

### Incident Patch 14: `d19c185f` (2026-09-14)
**Commit Message**: build(deps): bump tombi-toml/setup-tombi from 1.5.1 to 1.5.4 (#1563)

Bumps [tombi-toml/setup-tombi](https://github.com/tombi-toml/setup-tombi) from 1.5.1 to 1.5.4.
- [Release notes](https://github.com/tombi-toml/setup-tombi/releases)
- [Commits](https://github.com/tombi-toml/setup-tombi/compare/3312a580f45ec61ab93c4b84159c9376c1d5a035...0ca8607861bce3508ba79339c7c47acb40a334e1)

---
updated-dependencies:
- dependency-name: tombi-toml/setup-tombi
  dependency-version: 1.5.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
         uses: uncenter/setup-taplo@b18c8c8302695fe63d6853bc004006215ac52b91 # v2
 
       - name: Setup tombi
-        uses: tombi-toml/setup-tombi@3312a580f45ec61ab93c4b84159c9376c1d5a035 # v1.5.1
+        uses: tombi-toml/setup-tombi@0ca8607861bce3508ba79339c7c47acb40a334e1 # v1.5.4
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
```

---

### Incident Patch 15: `32607518` (2026-09-14)
**Commit Message**: build(deps): bump DeterminateSystems/nix-installer-action from 22 to 23 (#1561)

Bumps [DeterminateSystems/nix-installer-action](https://github.com/determinatesystems/nix-installer-action) from 22 to 23.
- [Release notes](https://github.com/determinatesystems/nix-installer-action/releases)
- [Commits](https://github.com/determinatesystems/nix-installer-action/compare/ef8a148080ab6020fd15196c2084a2eea5ff2d25...3138316df39ed29be04236d7ffc686fa525866aa)

---
updated-dependencies:
- dependency-name: DeterminateSystems/nix-installer-action
  dependency-version: '23'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -190,7 +190,7 @@ jobs:
           fetch-depth: 0
 
       - name: Install Nix
-        uses: DeterminateSystems/nix-installer-action@ef8a148080ab6020fd15196c2084a2eea5ff2d25 # v22
+        uses: DeterminateSystems/nix-installer-action@3138316df39ed29be04236d7ffc686fa525866aa # v23
 
       - name: Generate Nix binary hashes file
         run: |
```

#### Recent Merged Pull Requests:
- **PR #1578** (2026-10-02): build(deps): update dependencies (@missionis[bot])
- **PR #1577** (2026-10-02): chore(deps): update flake.lock (@missionis[bot])
- **PR #1576** (2026-09-28): build(deps): bump taiki-e/install-action from 2.87.15 to 2.87.20 (@dependabot[bot])
- **PR #1575** (2026-09-28): build(deps): bump github/codeql-action/init from 4.38.1 to 4.38.2 (@dependabot[bot])
- **PR #1574** (2026-09-25): build(deps): update dependencies (@missionis[bot])
- **PR #1573** (2026-09-25): chore(deps): update flake.lock (@missionis[bot])
- **PR #1572** (2026-09-21): build(deps): bump github/codeql-action/init from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #1571** (2026-09-21): build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
