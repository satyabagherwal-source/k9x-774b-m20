# Forensic Learning Record (Deep Inspection): nexus-xyz/nexus-zkvm

> **Canonical Artifact**: `07_PROJECT_LEARNING/nexus-xyz-nexus-zkvm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nexus-xyz/nexus-zkvm](https://github.com/nexus-xyz/nexus-zkvm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:00:41.436Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nexus-xyz/nexus-zkvm`
- **Description**: The Nexus zkVM: The zero-knowledge virtual machine
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2625 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/benches/integration_bench.rs`
```
#![feature(test)]
#![cfg(test)]

extern crate test;

use nexus_benchmarks::{runner::run_benchmark, utils::get_timestamped_filename};
use nexus_common_testing::emulator::EmulatorType;
use postcard::to_allocvec_cobs;
use test::Bencher;

#[test]
#[ignore]
fn test_benchmark_fib_simple() {
    let results_file = get_timestamped_filename("benchmark_results");
    run_benchmark::<u32>(
        "../examples/src/bin/fib",
        "-C opt-level=3",
        EmulatorType::TwoPass,
        Vec::new(),
        Vec::new(),
        &results_file,
        20,
    );
}

#[test]
#[ignore]
fn test_benchmark_fib_powers() {
    // Inputs corresponding to step count powers of 2 from 2^12 to 2^19.
    let inputs = vec![1, 8, 21, 38, 67, 146, 271, 546];
    let results_file = get_timestamped_filename("fib_powers");
    for mut input in inputs {
        let public_input_bytes = to_allocvec_cobs(&mut input).unwrap();
        run_benchmark::<u32>(
            "../examples/src/bin/fib_input",
            "-C opt-level=3",
            EmulatorType::TwoPass,
            public_input_bytes,
            Vec::new(),
            &results_file,
            20,
        );
    }
}

#[test]
#[ignore]
fn test_benchmark_keccak_powers() {
    // Inputs corresponding to step count powers of 2 from 2^15 to 2^19.
    let inputs = vec![0, 1, 3, 7, 15];
    let results_file = get_timestamped_filename("keccak_powers");
    for mut input in inputs {
        let public_input_bytes = to_allocvec_cobs(&mut input).unwrap();
        run_benchmark::<u32>(
            "../examples/src/bin/keccak_input",
            "-C opt-level=3",
            EmulatorType::TwoPass,
            public_input_bytes,
            Vec::new(),
            &results_file,
            20,
        );
    }
}

/// Benchmark Harvard emulator performance.
#[bench]
fn bench_harvard_fib1000(b: &mut Bencher) {
    let results_file = get_timestamped_filename("benchmark_results");
    b.iter(|| {
        run_benchmark::<u32>(
            "../examples/src/bin/fib1000",
            "-C opt-level=3",
            EmulatorType::Harvard,
            Vec::new(),
            Vec::new(),
            &results_file,
            20,
        );
    });
}

/// Benchmark Linear emulator performance.
#[bench]
fn bench_linear_fib1000(b: &mut Bencher) {
    let results_file = get_timestamped_filename("benchmark_results");
    b.iter(|| {
        run_benchmark::<u32>(
            "../examples/src/bin/fib1000",
            "-C opt-level=3",
            EmulatorType::default_linear(),
            Vec::new(),
            Vec::new(),
            &results_file,
            20,
        );
    });
}

/// Benchmark Two-Pass emulator performance.
#[bench]
fn bench_twopass_fib1000(b: &mut Bencher) {
    let results_file = get_timestamped_filename("benchmark_results");
    b.iter(|| {
        run_benchmark::<u32>(
            "../examples/src/bin/fib1000",
            "-C opt-level=3",
            EmulatorType::TwoPass,
            Vec::new(),
            Vec::new(),
            &results_file,
            20,
        );
    });
}

```

### Core Architecture Module: `benchmarks/src/lib.rs`
```
pub mod models;
pub mod paths;
pub mod runner;
pub mod utils;

```

### Core Architecture Module: `benchmarks/src/models.rs`
```
use csv::StringRecord;
use serde::Serialize;
use std::error::Error;
use std::time::Duration;

/// Statistics for a single stage of the benchmark.
#[derive(Debug, Serialize)]
pub struct StageStats {
    pub speed_khz: f32,
    pub overhead: f32,
    pub peak_cpu_percentage: f64,
    pub peak_memory_gb: f64,
    pub duration: Duration,
    pub sys_time: Duration,
    pub user_time: Duration,
}
const STAGE_STATS_LEN: usize = 7;

impl StageStats {
    /// Write the header for a stage with a given prefix.
    pub fn header_with_prefix(prefix: &str) -> String {
        format!("{}_speed_khz,{}_overhead,{}_peak_cpu_percentage,{}_peak_memory_gb,{}_duration,{}_sys_time,{}_user_time",
            prefix, prefix, prefix, prefix, prefix, prefix, prefix)
    }

    /// Parse a stage's statistics from CSV record fields starting at the given offset.
    fn from_csv_record(record: &StringRecord, offset: usize) -> Result<Self, Box<dyn Error>> {
        Ok(StageStats {
            speed_khz: record[offset].parse()?,
            overhead: record[offset + 1].parse()?,
            peak_cpu_percentage: record[offset + 2].parse()?,
            peak_memory_gb: record[offset + 3].parse()?,
            duration: Duration::from_secs_f32(record[offset + 4].parse()?),
            sys_time: Duration::from_secs_f32(record[offset + 5].parse()?),
            user_time: Duration::from_secs_f32(record[offset + 6].parse()?),
        })
    }
}

impl std::fmt::Display for StageStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{},{},{},{},{},{},{}",
            self.speed_khz,
            self.overhead,
            self.peak_cpu_percentage,
            self.peak_memory_gb,
            self.duration.as_secs_f32(),
            self.sys_time.as_secs_f32(),
            self.user_time.as_secs_f32()
        )
    }
}

/// Complete benchmark results including all stages.
#[derive(Debug, Serialize)]
pub struct BenchmarkResult {
    pub timestamp: String,
    pub test: String,
    pub emulator_type: String,
    pub piecewise_min_total_speed_khz: f32,
    pub piecewise_min_total_duration: Duration,
    pub piecewise_min_total_overhead: f32,
    pub avg_total_speed_khz: f32,
    pub avg_total_duration: Duration,
    pub avg_total_overhead: f32,
    pub piecewise_max_total_speed_khz: f32,
    pub piecewise_max_total_duration: Duration,
    pub piecewise_max_total_overhead: f32,
    pub total_steps: u32,
    pub cpu_cores: usize,
    pub total_ram_gb: f64,
    pub piecewise_min_total_peak_cpu_percentage: f64,
    pub piecewise_min_total_peak_memory_gb: f64,
    pub avg_total_peak_cpu_percentage: f64,
    pub avg_total_peak_memory_gb: f64,
    pub piecewise_max_total_peak_cpu_percentage: f64,
    pub piecewise_max_total_peak_memory_gb: f64,
    pub num_loads: u32,
    pub num_stores: u32,
    pub stack_size: u32,
    pub heap_size: u32,
    pub native_mins: StageStats,
    pub native_avgs: StageStats,
    pub native_maxs: StageStats,
    pub emulation_mins: StageStats,
    pub emulation_avgs: StageStats,
    pub emulation_maxs: StageStats,
    pub proving_mins: StageStats,
    pub proving_avgs: StageStats,
    pub proving_maxs: StageStats,
    pub verification_mins: StageStats,
    pub verification_avgs: StageStats,
    pub verification_maxs: StageStats,
}

impl BenchmarkResult {
    pub fn csv_header() -> String {
        format!("timestamp,test,emulator_type,piecewise_min_total_speed_khz,piecewise_min_total_duration,piecewise_min_total_overhead,avg_total_speed_khz,avg_total_duration,avg_total_overhead,piecewise_max_total_speed_khz,piecewise_max_total_duration,piecewise_max_total_overhead,total_steps,cpu_cores,total_ram_gb,piecewise_min_total_peak_cpu_percentage,piecewise_min_total_peak_memory_gb,avg_total_peak_cpu_percentage,avg_total_peak_memory_gb,piecewise_max_total_peak_cpu_percentage,piecewise_max_total_peak_memory_gb,num_loads,num_stores,stack_size,heap_size,\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {},\
                {}",
                StageStats::header_with_prefix("native_min"),
                StageStats::header_with_prefix("native_avg"),
                StageStats::header_with_prefix("native_max"),
                StageStats::header_with_prefix("emulation_min"),
                StageStats::header_with_prefix("emulation_avg"),
                StageStats::header_with_prefix("emulation_max"),
                StageStats::header_with_prefix("proving_min"),
                StageStats::header_with_prefix("proving_avg"),
                StageStats::header_with_prefix("proving_max"),
                StageStats::header_with_prefix("verification_min"),
                StageStats::header_with_prefix("verification_avg"),
                StageStats::header_with_prefix("verification_max"),
        )
    }

    /// Parse a CSV record into a BenchmarkResult.
    pub fn from_csv_record(record: &StringRecord) -> Result<Self, Box<dyn Error>> {
        // Fixed offsets for each stage's stats in the CSV record.
        const NATIVE_OFFSET: usize = 25;
        const EMULATION_OFFSET: usize = NATIVE_OFFSET + 3 * STAGE_STATS_LEN;
        const PROVING_OFFSET: usize = EMULATION_OFFSET + 3 * STAGE_STATS_LEN;
        const VERIFICATION_OFFSET: usize = PROVING_OFFSET + 3 * STAGE_STATS_LEN;

        Ok(BenchmarkResult {
            timestamp: record[0].to_string(),
            test: record[1].to_string(),
            emulator_type: record[2].to_string(),
            piecewise_min_total_speed_khz: record[3].parse()?,
            piecewise_min_total_duration: Duration::from_secs_f32(record[4].parse()?),
            piecewise_min_total_overhead: record[5].parse()?,
            avg_total_speed_khz: record[6].parse()?,
            avg_total_duration: Duration::from_secs_f32(record[7].parse()?),
            avg_total_overhead: record[8].parse()?,
            piecewise_max_total_speed_khz: record[9].parse()?,
            piecewise_max_total_duration: Duration::from_secs_f32(record[10].parse()?),
            piecewise_max_total_overhead: record[11].parse()?,
            total_steps: record[12].parse()?,
            cpu_cores: record[13].parse()?,
            total_ram_gb: record[14].parse()?,
            piecewise_min_total_peak_cpu_percentage: record[15].parse()?,
            piecewise_min_total_peak_memory_gb: record[16].parse()?,
            avg_total_peak_cpu_percentage: record[17].parse()?,
            avg_total_peak_memory_gb: record[18].parse()?,
            piecewise_max_total_peak_cpu_percentage: record[19].parse()?,
            piecewise_max_total_peak_memory_gb: record[20].parse()?,
            num_loads: record[21].parse()?,
            num_stores: record[22].parse()?,
            stack_size: record[23].parse()?,
            heap_size: record[24].parse()?,
            native_mins: StageStats::from_csv_record(record, NATIVE_OFFSET)?,
            native_avgs: StageStats::from_csv_record(record, NATIVE_OFFSET + STAGE_STATS_LEN)?,
            native_maxs: StageStats::from_csv_record(record, NATIVE_OFFSET + 2 * STAGE_STATS_LEN)?,
            emulation_mins: StageStats::from_csv_record(record, EMULATION_OFFSET)?,
            emulation_avgs: StageStats::from_csv_record(
                record,
                EMULATION_OFFSET + STAGE_STATS_LEN,
            )?,
            emulation_maxs: StageStats::from_csv_record(
                record,
                EMULATION_OFFSET + 2 * STAGE_STATS_LEN,
            )?,
            proving_mins: StageStats::from_csv_record(record, PROVING_OFFSET)?,
            proving_avgs: StageStats::from_csv_record(record, PROVING_OFFSET + STAGE_STATS_LEN)?,
            proving_maxs: StageStats::from_csv_record(
                record,
                PROVING_OFFSET + 2 * STAGE_STATS_LEN,
            )?,
            verification_min
```

### Core Architecture Module: `benchmarks/src/paths.rs`
```
use std::path::PathBuf;

/// Get the path to the benchmarks directory.
pub fn benchmarks_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Get the path to the results directory, creating it if it doesn't exist.
pub fn results_dir() -> PathBuf {
    let dir = benchmarks_dir().join("results");
    std::fs::create_dir_all(&dir).expect("Failed to create results directory");
    dir
}

/// Get the path to the graphs directory, creating it if it doesn't exist.
pub fn graphs_dir() -> PathBuf {
    let dir = benchmarks_dir().join("graphs");
    std::fs::create_dir_all(&dir).expect("Failed to create graphs directory");
    dir
}

/// Get a path in the results directory.
pub fn results_file(filename: &str) -> PathBuf {
    results_dir().join(filename)
}

/// Get a path in the graphs directory.
pub fn graphs_file(filename: &str) -> PathBuf {
    graphs_dir().join(filename)
}

```

### Core Architecture Module: `benchmarks/src/runner.rs`
```
use chrono;
use nexus_common::memory::traits::MemoryRecord;
use nexus_common_testing::emulator::{
    compile_guest_project, setup_guest_project, write_guest_source_code, EmulatorType,
};
use nexus_vm::elf::ElfFile;
use nexus_vm::trace::{k_trace, Trace};
use nexus_vm_prover::{prove, verify};
use num_cpus;
use postcard;
use serde::{de::DeserializeOwned, Serialize};
use std::{path::PathBuf, process::Command};
use sys_info;

use crate::{
    models::{BenchmarkResult, StageStats},
    utils::{phase_end, phase_start, record_benchmark_results, PhasesTracker},
};

const K: usize = 1;

/// Executes and measures the native execution speed of a Rust program.
fn measure_native_execution<T>(path: &PathBuf, public_input_bytes: &[u8])
where
    T: DeserializeOwned + Serialize + std::fmt::Display,
{
    // Simpler run process when no inputs are provided.
    let output = if public_input_bytes.is_empty() {
        Command::new("cargo")
            .current_dir(path)
            .arg("run")
            .arg("--release")
            .output()
            .expect("Failed to spawn process")
    } else {
        let mut child = Command::new("cargo")
            .current_dir(path)
            .arg("run")
            .arg("--release")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()
            .expect("Failed to spawn process");

        // Pipe in input as stdin.
        let input: T = postcard::from_bytes_cobs(&mut public_input_bytes.to_owned())
            .expect("Failed to deserialize input");
        let input_str = format!("{}\n", input);
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin
                .write_all(input_str.as_bytes())
                .expect("Failed to write to stdin");
        }

        child.wait_with_output().expect("Failed to wait on child")
    };

    assert!(output.status.success(), "Native execution failed");
}

/// Benchmarks a test program using specified emulator configuration.
pub fn run_benchmark<T>(
    test: &str,
    compile_flags: &str,
    emulator_type: EmulatorType,
    public_input: Vec<u8>,
    private_input: Vec<u8>,
    results_file: &str,
    iters: u32,
) where
    T: DeserializeOwned + Serialize + std::fmt::Display,
{
    // Get system info at start.
    let cpu_cores = num_cpus::get();
    let total_ram_gb = sys_info::mem_info()
        .map(|m| (m.total as f64) / (1024.0 * 1024.0))
        .unwrap_or(0.0);

    // Set up temporary project directory.
    let runtime_path = PathBuf::from("../runtime");
    let tmp_dir = setup_guest_project(&runtime_path);
    let tmp_project_path = tmp_dir.path().join("integration");

    // Compile test to RISC-V ELF.
    write_guest_source_code(&tmp_project_path, &format!("{}.rs", test));
    let elf_contents = compile_guest_project(
        &tmp_project_path,
        &runtime_path.join("linker-scripts/default.x"),
        compile_flags,
    );

    // Build the native binary once (release) before measuring runs.
    let build_output = Command::new("cargo")
        .current_dir(&tmp_project_path)
        .arg("build")
        .arg("--release")
        .output()
        .expect("Failed to build project");
    assert!(
        build_output.status.success(),
        "Native build failed: {}",
        String::from_utf8_lossy(&build_output.stderr)
    );

    // Measure native execution.
    let mut native_tracker = PhasesTracker::default();
    for _ in 0..iters {
        let timing_state = phase_start();
        measure_native_execution::<T>(&tmp_project_path, &public_input);
        let (native_duration, native_user_time, native_sys_time, native_metrics) =
            phase_end(timing_state);

        native_tracker.update(
            &native_duration,
            &native_user_time,
            &native_sys_time,
            &native_metrics,
        );
    }

    // Parse and prepare ELF for emulation.
    let elf = ElfFile::from_bytes(&elf_contents).expect("Failed to parse ELF file");

    // Measure emulation.
    let (mut view, mut execution_trace) =
        k_trace(elf.clone(), &[], &public_input, &private_input, K)
            .expect("error generating trace"); // warm up and make sure we work

    let mut emulation_tracker = PhasesTracker::default();
    for _ in 0..iters {
        let iter_elf = elf.clone();

        let timing_state = phase_start();
        (view, execution_trace) = k_trace(iter_elf, &[], &public_input, &private_input, K)
            .expect("error generating trace");
        let (emulation_duration, emulation_user_time, emulation_sys_time, emulation_metrics) =
            phase_end(timing_state);

        emulation_tracker.update(
            &emulation_duration,
            &emulation_user_time,
            &emulation_sys_time,
            &emulation_metrics,
        );
    }

    // Measure proving.
    let mut proof = prove(&execution_trace, &view).unwrap(); // warm up and make sure we work

    let mut proving_tracker = PhasesTracker::default();
    for _ in 0..iters {
        let timing_state = phase_start();
        proof = prove(&execution_trace, &view).unwrap();
        let (proving_duration, proving_user_time, proving_sys_time, proving_metrics) =
            phase_end(timing_state);

        proving_tracker.update(
            &proving_duration,
            &proving_user_time,
            &proving_sys_time,
            &proving_metrics,
        );
    }

    // Measure verification.
    let mut verification_tracker = PhasesTracker::default();
    for _ in 0..iters {
        let iter_proof = proof.clone();

        let timing_state = phase_start();
        verify(iter_proof, &view).unwrap();
        let (
            verification_duration,
            verification_user_time,
            verification_sys_time,
            verification_metrics,
        ) = phase_end(timing_state);

        verification_tracker.update(
            &verification_duration,
            &verification_user_time,
            &verification_sys_time,
            &verification_metrics,
        );
    }

    let total_steps = execution_trace.get_num_steps();

    let piecewise_min_total_duration =
        emulation_tracker.duration.min + proving_tracker.duration.min;
    let piecewise_min_total_overhead =
        piecewise_min_total_duration.div_duration_f32(native_tracker.duration.max); // min over max for min overhead
    let piecewise_min_total_peak_cpu_percentage = f64::max(
        f64::max(
            native_tracker.metrics.min.peak_cpu,
            emulation_tracker.metrics.min.peak_cpu,
        ),
        proving_tracker.metrics.min.peak_cpu,
    );
    let piecewise_min_total_peak_memory_gb = f64::max(
        f64::max(
            native_tracker.metrics.min.peak_memory_gb,
            emulation_tracker.metrics.min.peak_memory_gb,
        ),
        proving_tracker.metrics.min.peak_memory_gb,
    );

    let avg_total_duration = emulation_tracker.duration.avg + proving_tracker.duration.avg;
    let avg_total_overhead = avg_total_duration.div_duration_f32(native_tracker.duration.avg);
    let avg_total_peak_cpu_percentage = f64::max(
        f64::max(
            native_tracker.metrics.avg.peak_cpu,
            emulation_tracker.metrics.avg.peak_cpu,
        ),
        proving_tracker.metrics.avg.peak_cpu,
    );
    let avg_total_peak_memory_gb = f64::max(
        f64::max(
            native_tracker.metrics.avg.peak_memory_gb,
            emulation_tracker.metrics.avg.peak_memory_gb,
        ),
        proving_tracker.metrics.avg.peak_memory_gb,
    );

    let piecewise_max_total_duration =
        emulation_tracker.duration.max + proving_tracker.duration.max;
    let piecewise_max_total_overhead =
        piecewise_max_total_duration.div_duration_f32(native_tracker.duration.min); // max over min for max overhead
    let piecewise_max_total_peak_cpu_percentage = f64::max(
        f64::max(
            native_tracker.metrics.max.peak_cpu,
        
```

### Core Architecture Module: `benchmarks/src/utils.rs`
```
#[cfg(unix)]
use libc::{getrusage, rusage, RUSAGE_CHILDREN, RUSAGE_SELF};
use std::{fs::OpenOptions, io::Write};

use crate::{models::BenchmarkResult, paths::results_file};

/// Cross-platform timing state
#[cfg(unix)]
pub type TimingState = (std::time::Instant, rusage, rusage);
#[cfg(windows)]
pub type TimingState = std::time::Instant;

/// Gets a timestamped version of a filename by appending timestamp and .csv extension.
pub fn get_timestamped_filename(base_name: &str) -> String {
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    format!("{}_{}.csv", base_name, timestamp)
}

/// Records benchmark results to a CSV file in the results directory.
pub fn record_benchmark_results(result: &BenchmarkResult, filename: &str) {
    let file_path = results_file(filename);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .unwrap_or_else(|_| panic!("Failed to open {}", file_path.display()));

    // Write header if file is empty.
    if file.metadata().unwrap().len() == 0 {
        writeln!(file, "{}", BenchmarkResult::csv_header()).expect("Failed to write CSV header");
    }

    writeln!(file, "{}", result).expect("Failed to write benchmark results");
}

/// Start timing and return resource usage.
#[cfg(unix)]
pub fn start_timer(usage_type: i32) -> rusage {
    let mut usage: rusage = unsafe { std::mem::zeroed() };
    unsafe { getrusage(usage_type, &mut usage) };
    usage
}

/// Start timing and return resource usage (Windows stub).
#[cfg(windows)]
pub fn start_timer(_usage_type: i32) -> std::time::Instant {
    std::time::Instant::now()
}

/// Stop timing and return user and system time differences.
#[cfg(unix)]
pub fn stop_timer(
    start_usage: &rusage,
    usage_type: i32,
) -> (std::time::Duration, std::time::Duration) {
    let mut end_usage: rusage = unsafe { std::mem::zeroed() };
    unsafe { getrusage(usage_type, &mut end_usage) };
    calculate_time_diff(start_usage, &end_usage)
}

/// Stop timing and return user and system time differences (Windows stub).
#[cfg(windows)]
pub fn stop_timer(
    start_time: &std::time::Instant,
    _usage_type: i32,
) -> (std::time::Duration, std::time::Duration) {
    let elapsed = start_time.elapsed();
    // On Windows, we can't easily separate user and system time, so return elapsed time for both
    (elapsed, std::time::Duration::ZERO)
}

/// Calculate user and system time differences between two rusage measurements.
#[cfg(unix)]
pub fn calculate_time_diff(
    start_usage: &rusage,
    end_usage: &rusage,
) -> (std::time::Duration, std::time::Duration) {
    let user_sec_diff = end_usage.ru_utime.tv_sec - start_usage.ru_utime.tv_sec;
    let user_usec_diff = end_usage.ru_utime.tv_usec - start_usage.ru_utime.tv_usec;

    let sys_sec_diff = end_usage.ru_stime.tv_sec - start_usage.ru_stime.tv_sec;
    let sys_usec_diff = end_usage.ru_stime.tv_usec - start_usage.ru_stime.tv_usec;

    // Handle negative microsecond differences by borrowing from seconds
    let (user_sec, user_usec) = if user_usec_diff < 0 {
        (user_sec_diff - 1, user_usec_diff + 1_000_000)
    } else {
        (user_sec_diff, user_usec_diff)
    };

    let (sys_sec, sys_usec) = if sys_usec_diff < 0 {
        (sys_sec_diff - 1, sys_usec_diff + 1_000_000)
    } else {
        (sys_sec_diff, sys_usec_diff)
    };

    let user_time = std::time::Duration::from_secs(user_sec as u64)
        + std::time::Duration::from_micros(user_usec as u64);
    let sys_time = std::time::Duration::from_secs(sys_sec as u64)
        + std::time::Duration::from_micros(sys_usec as u64);

    (user_time, sys_time)
}

/// Helper struct to track resource usage during a phase.
#[derive(Debug, Default, Clone, Copy)]
pub struct PhaseMetrics {
    pub peak_cpu: f64,
    pub peak_memory_gb: f64,
}

// Helper structs to iteratively track stats across repeated phases.

#[derive(Debug, Default, Clone, Copy)]
pub struct DurationTracker {
    pub ct: usize,
    pub min: std::time::Duration,
    pub avg: std::time::Duration,
    pub max: std::time::Duration,
}

impl DurationTracker {
    pub fn update(&mut self, next: &std::time::Duration) {
        let prev = self.ct as f64;
        self.ct += 1;

        if self.ct == 1 {
            self.min = *next;
            self.avg = *next;
            self.max = *next;

            return;
        }

        let curr = self.ct as f64;

        self.min = std::cmp::min(self.min, *next);
        self.avg = (self.avg.mul_f64(prev) + *next).div_f64(curr);
        self.max = std::cmp::max(self.max, *next);
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PhaseMetricsTracker {
    pub ct: usize,
    pub min: PhaseMetrics,
    pub avg: PhaseMetrics,
    pub max: PhaseMetrics,
}

impl PhaseMetricsTracker {
    pub fn update(&mut self, next: &PhaseMetrics) {
        let prev = self.ct as f64;
        self.ct += 1;

        if self.ct == 1 {
            self.min = *next;
            self.avg = *next;
            self.max = *next;

            return;
        }

        let curr = self.ct as f64;

        self.min.peak_cpu = self.min.peak_cpu.min(next.peak_cpu);
        self.min.peak_memory_gb = self.min.peak_memory_gb.min(next.peak_memory_gb);

        self.avg.peak_cpu = ((self.avg.peak_cpu * prev) + next.peak_cpu) / curr;
        self.avg.peak_memory_gb = ((self.avg.peak_memory_gb * prev) + next.peak_memory_gb) / curr;

        self.max.peak_cpu = self.max.peak_cpu.max(next.peak_cpu);
        self.max.peak_memory_gb = self.max.peak_memory_gb.max(next.peak_memory_gb);
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PhasesTracker {
    pub duration: DurationTracker,
    pub user: DurationTracker,
    pub sys: DurationTracker,
    pub metrics: PhaseMetricsTracker,
}

impl PhasesTracker {
    pub fn update(
        &mut self,
        next_duration: &std::time::Duration,
        next_user: &std::time::Duration,
        next_sys: &std::time::Duration,
        next_metrics: &PhaseMetrics,
    ) {
        self.duration.update(next_duration);
        self.user.update(next_user);
        self.sys.update(next_sys);
        self.metrics.update(next_metrics);
    }
}

/// Start measuring a phase and return initial state.
#[cfg(unix)]
pub fn phase_start() -> TimingState {
    let mut initial_self_usage: rusage = unsafe { std::mem::zeroed() };
    let mut initial_children_usage: rusage = unsafe { std::mem::zeroed() };
    unsafe {
        getrusage(RUSAGE_SELF, &mut initial_self_usage);
        getrusage(RUSAGE_CHILDREN, &mut initial_children_usage);
    };
    (
        std::time::Instant::now(),
        initial_self_usage,
        initial_children_usage,
    )
}

/// Start measuring a phase and return initial state (Windows stub).
#[cfg(windows)]
pub fn phase_start() -> TimingState {
    std::time::Instant::now()
}

/// End measuring a phase and return duration and metrics.
#[cfg(unix)]
pub fn phase_end(
    timing_state: TimingState,
) -> (
    std::time::Duration,
    std::time::Duration,
    std::time::Duration,
    PhaseMetrics,
) {
    let (start_time, initial_self_usage, initial_children_usage) = timing_state;
    let mut final_self_usage: rusage = unsafe { std::mem::zeroed() };
    let mut final_children_usage: rusage = unsafe { std::mem::zeroed() };
    unsafe {
        getrusage(RUSAGE_SELF, &mut final_self_usage);
        getrusage(RUSAGE_CHILDREN, &mut final_children_usage);
    };

    let initial_cpu_time = {
        let self_time = initial_self_usage.ru_utime.tv_sec as f64
            + initial_self_usage.ru_utime.tv_usec as f64 / 1_000_000.0
            + initial_self_usage.ru_stime.tv_sec as f64
            + initial_self_usage.ru_stime.tv_usec as f64 / 1_000_000.0;
        let children_time = initial_children_usage.ru_utime.tv_sec as f64
            + initial_children_usage.ru_utime.tv_usec as f64 / 1_000_000.0
            + initial_children_usage.ru_stime.tv_sec as f64
            + initial_children_usage.ru_s
```

### Core Architecture Module: `cli/progress-bar/src/action.rs`
```
use super::component::FmtDuration;

pub(crate) struct Action {
    pub iter: usize,
    pub iter_num: usize,

    pub step_header: &'static str,
    pub step_trailing: Box<dyn Fn(usize) -> String + Send>,
    pub loading_bar_header: Option<&'static str>,

    pub completion_header: &'static str,
    pub completion_trailing: Box<dyn Fn(FmtDuration) -> String + Send>,
}

impl Action {
    pub(crate) fn show_progress(&self) -> bool {
        self.loading_bar_header.is_some()
    }

    pub(crate) fn next_iter(&mut self) {
        let next_iter = self.iter + 1;
        assert!(next_iter <= self.iter_num);

        self.iter = next_iter;
    }

    pub(crate) fn is_finished(&self) -> bool {
        self.iter == self.iter_num
    }
}

impl Default for Action {
    fn default() -> Self {
        Self {
            iter: 0,
            iter_num: 1,
            step_header: "",
            step_trailing: Box::new(|_step| String::new()),
            loading_bar_header: None,
            completion_header: "Finished",
            completion_trailing: Box::new(|elapsed| format!("in {elapsed}")),
        }
    }
}

```

### Core Architecture Module: `cli/progress-bar/src/component/loading.rs`
```
use std::{cell::RefCell, time::Duration};

use superconsole::{style::Stylize, Component, Dimensions, DrawMode, Line, Lines, Span};

use crate::action::Action;

const WIDTH: usize = "=======>                  ".len() - 1;

pub struct LoadingBar<'a> {
    pub time_spent: Duration,

    action: &'a RefCell<Action>,
}

impl Component for LoadingBar<'_> {
    fn draw_unchecked(&self, _: Dimensions, _: DrawMode) -> anyhow::Result<Lines> {
        let action = self.action.borrow();

        let res = if !action.is_finished() {
            if !action.show_progress() {
                return Ok(Lines::new());
            }
            let iteration = action.iter;
            let total = action.iter_num;

            let heading_span = Span::new_styled(
                action
                    .loading_bar_header
                    .unwrap_or_default()
                    .to_owned()
                    .cyan()
                    .bold(),
            )?;

            let percentage = iteration as f64 / total as f64;
            let amount = (percentage * WIDTH as f64).ceil() as usize;

            let loading_bar = format!(
                " [{test:=>bar_amt$}{empty:padding_amt$}] {}/{}: ...",
                iteration,
                total,
                test = ">",
                empty = "",
                bar_amt = amount,
                padding_amt = WIDTH - amount,
            );
            let loading = Span::new_unstyled(loading_bar)?;
            Line::from_iter([heading_span, loading])
        } else {
            let elapsed = self.time_spent;

            let heading_span = Span::new_styled(action.completion_header.to_owned().blue().bold())?;
            let completion_span = Span::new_unstyled((action.completion_trailing)(elapsed.into()))?;

            Line::from_iter([heading_span, Span::padding(1), completion_span])
        };

        Ok(Lines(vec![res]))
    }
}

impl<'a> LoadingBar<'a> {
    pub fn new(action: &'a RefCell<Action>) -> Self {
        Self {
            action,
            time_spent: Duration::ZERO,
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #362** (2025-02-24): **[BUG]: CLI nodes are not generating points**
  *Symptoms*: ### Program Information  Running CLI prover Node on Nexus OS  ### Project Information  _No response_  ### Reproduction Steps  Prover Node   ### What is expected?  I was expecting to be earning points from the running nodes.   ### What is actually happening?  I have 7 CLI nodes running for few days now, but none of them has generated a single point. More like a broken system or something.   ### System Information  Mintair CLI Node  ### Any additional comments?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Redirect to https://github.com/nexus-xyz/network-api or our social channels.

- **Issue #361** (2025-02-21): **[BUG]: error[E0463]: can't find crate for `core`**
  *Symptoms*: ### Program Information  Starting proof #25...  `1. Received proof task from Nexus Orchestrator... 2. Compiling guest program...    Compiling proc-macro2 v1.0.93    Compiling crc-catalog v2.4.0    Compiling cobs v0.2.3    Compiling indexmap v2.7.1    Compiling paste v1.0.15    Compiling serde v1.0.217`  and on the next line it gets crashed:  `Compiling nexus-rt v0.2.3 (https://github.com/nexus-xyz/nexus-zkvm?branch=neo#ae4e2725) error[E0463]: can't find crate for `core`   |   = note: the `riscv32i-unknown-none-elf` target may not be installed   = help: consider downloading the target with `rustup target add riscv32i-unknown-none-elf`   = help: consider building the standard library from source with `cargo build -Zbuild-std`  For more information about this error, try `rustc --explain E0463`. error: could not compile `crc-catalog` (lib) due to 1 previous error warning: build failed, waiting for other jobs to finish... error: could not compile `cobs` (lib) due to 1 previous error thread 'main' panicked at src/main.rs:160:45: failed to compile guest program: BuildError(CompilerError) note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace`  ### Project Information  nexus linux node  ### Reproduction Steps  after running `curl https://cli.nexus.xyz/ | sh` it starts but fails on that line   ### What is expected?  it should not fail or exit  ### What is actually happening?  it's not making a proof work , like per example `proof #25...`  ### System Information 
  **Post-Mortem & Fix Analysis**:
  > This is likely due to conflicting Rust installations. Please see the discussion here: https://github.com/nexus-xyz/nexus-zkvm/issues/293
  > Thanks, OK I found[ this comment meaningful ](https://github.com/nexus-xyz/nexus-zkvm/issues/293#issuecomment-2524109526)and have done the following on my ubuntu baremetal: `uga@65i:~$ rustup target remove riscv32i-unknown-none-elf warning: after removing the last target, no build targets will be available error: toolchain 'stable-x86_64-unknown-linux-gnu' does not have target 'riscv32i-unknown-none-elf' installed  guga@65i:~$ rustup target add riscv32i-unknown-none-elf info: downloading component 'rust-std' for 'riscv32i-unknown-none-elf' info: installing component 'rust-std' for 'riscv32i-unknown-none-elf'`  After that it looks started working: `================================================  Starting proof #2 ...  1. Compiling guest program... 2. Creating ZK proof... 3. ZK proof successfully created with size: 163325 bytes`
  > Starting proof #1 ...  1. Compiling guest program... 2. Creating ZK proof... memory allocation of 8606711792 bytes failed Aborted (core dumped)  how about this? 

- **Issue #357** (2025-02-19): **[BUG]: need to connect after every 2 mins**
  *Symptoms*: ### Program Information  https://github.com/user-attachments/assets/bdf438fd-7144-472d-adf8-f8d64584d3d9  ### Project Information  _No response_  ### Reproduction Steps  when i connect to nexus , it stars but after 2 mins it disconnect and i have to connect again and again  ### What is expected?  i was thinking that i need to connect it once and it will keep on running  ### What is actually happening?  need to connect again and again  ### System Information  _No response_  ### Any additional comments?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Redirect to https://github.com/nexus-xyz/network-api or our social channels.

- **Issue #293** (2024-12-06): **[BUG]: Does this work on Apple Silicon**
  *Symptoms*: ### Program Information  ``` #![cfg_attr(target_arch = "riscv32", no_std, no_main)]  fn fib(n: u32) -> u32 {     match n {         0 => 0,         1 => 1,         _ => fib(n - 1) + fib(n - 2),     } }  #[nexus_rt::main] fn main() {     let n = 7;     let result = fib(n);     assert_eq!(result, 13); } ```  ### Project Information  I was just trying the recommended test program.  ### Reproduction Steps  ``` rustup target add riscv32i-unknown-none-elf cargo install --git https://github.com/nexus-xyz/nexus-zkvm cargo-nexus --tag 'v0.2.4' cargo nexus new nexus-project ``` changed `main.rs` to the program given above and then ran `cargo nexus run`  ### What is expected?  "The command should run successfully"  ### What is actually happening?  ``` info: component 'rust-std' for target 'riscv32i-unknown-none-elf' is up to date Victors-iMac:nexus-project victorsmiller$ cargo nexus run    Compiling proc-macro2 v1.0.92    Compiling indexmap v2.7.0    Compiling serde v1.0.215    Compiling syn v1.0.109    Compiling cobs v0.2.3    Compiling nexus-rt v0.2.4 (https://github.com/nexus-xyz/nexus-zkvm.git#0b787f2e) error[E0463]: can't find crate for `core`   |   = note: the `riscv32i-unknown-none-elf` target may not be installed   = help: consider downloading the target with `rustup target add riscv32i-unknown-none-elf`  For more information about this error, try `rustc --explain E0463`. error: could not compile `cobs` (lib) due to 1 previous error warning:
  **Post-Mortem & Fix Analysis**:
  > A lot of our development team uses apple sillicon, so that shouldn't be the issue. But I will attempt to replicate for the demonstrated issue.
  > @algebravic I'm having trouble reproducing on an M3 Pro running 15.1.1. May I ask what the output is if you sequentially run:  ```bash $ rustup target remove riscv32i-unknown-none-elf $ rustup target add riscv32i-unknown-none-elf ```
  > I already tried that. Same result  On Fri, Dec 6, 2024 at 12:31 Samuel Judson ***@***.***> wrote:  > @algebravic <https://github.com/algebravic> I'm having trouble > reproducing on an M3 Pro running 15.1.1. May I ask what the output is if > you sequentially run: > > $ rustup target remove riscv32i-unknown-none-elf > $ rustup target add riscv32i-unknown-none-elf > > — > Reply to this email directly, view it on GitHub > <https://github.com/nexus-xyz/nexus-zkvm/issues/293#issuecomment-2524109526>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AAHBBJT2RSMONYD7MTOMQFD2EICTLAVCNFSM6AAAAABTFBRM4OVHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHMZDKMRUGEYDSNJSGY> > . > You are receiving this because you were mentioned.Message ID: > ***@***.***> > 

- **Issue #288** (2025-01-08): **[BUG]: RelaxedR1CS test isn't complete**
  *Symptoms*: ### Program Information  The R1CS test in   https://github.com/nexus-xyz/nexus-zkvm/blob/f37401c477b680ce5334b2ca523ded8a7273d8c8/nova/src/r1cs/mod.rs#L874  only checks folding multiple instances of the same r1cs instance/witness in the for loop, such folding doesn't result in any cross-term, despite your construction is correct, your test doesn't check all cases.  ### Project Information  _No response_  ### Reproduction Steps  I'm trying to implement Ova[Bunz] by modifying your code and that's how I realised this...  ### What is expected?  ....  ### What is actually happening?  again the test doesn't check all cases.  ### System Information  _No response_  ### Any additional comments?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks @h-hafezi - relieved that this is an inadequate test rather than a bug in the code, but it's very worth noting and getting full coverage.

- **Issue #287** (2025-03-06): **[BUG]: Witness size to be a power of 2^n isn't checked in Spartan/crr1csproof.rs**
  *Symptoms*: ### Program Information  In Spartan/crr1csproof.rs it's not checked the witness to be a power of two, in fact, it can be checked in   https://github.com/nexus-xyz/nexus-zkvm/blob/7f7789a271a4d7950ad6b4347cb6190b589c15c2/spartan/src/crr1csproof.rs#L363  by adding the following lines:          assert!(z.len().is_power_of_two(), "z must be a power of two");         assert!(evals_ABC.len().is_power_of_two(), "eval_ABC must be a power of two");         assert_eq!(z.len(), evals_ABC.len(), "vector z and eval_ABC should have equal length");  similarly, it can be checked in the conversion function in   https://github.com/nexus-xyz/nexus-zkvm/blob/main/nova/src/circuits/nova/pcd/compression/conversion.rs  when converting an r1cs instance to check witness size to be a power of two in   https://github.com/nexus-xyz/nexus-zkvm/blob/f37401c477b680ce5334b2ca523ded8a7273d8c8/nova/src/circuits/nova/pcd/compression/conversion.rs#L105  ### Project Information  _No response_  ### Reproduction Steps  ...  ### What is expected?  ...  ### What is actually happening?  if this is not done you get a reading index of zero from an empty vector in the function   https://github.com/nexus-xyz/nexus-zkvm/blob/7f7789a271a4d7950ad6b4347cb6190b589c15c2/spartan/src/crr1csproof.rs#L40  ### System Information  _No response_  ### Any additional comments?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks @h-hafezi for this thorough check and proposed fix! Definitely worth taking. We'll look.
  > Made stale by rewrite of codebase for the new Nexus 3.0 machine (https://github.com/nexus-xyz/nexus-zkvm/pull/365).

- **Issue #286** (2024-12-03): **[BUG]: cant find TAG V0.2.3**
  *Symptoms*: ### Program Information  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### Project Information  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### Reproduction Steps  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### What is expected?  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### What is actually happening?  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### System Information  Updating git repository `https://github.com/nexus-xyz/nexus-zkvm` error: failed to find tag `'v0.2.3'`  Caused by:   reference 'refs/remotes/origin/tags/'v0.2.3'' not found; class=Reference (4); code=NotFound (-3)  ### Any additional comments?  Up
  **Post-Mortem & Fix Analysis**:
  > A new release, `v0.2.4` was just cut. I'll close this for now, but feel free to reopen a new issue if the problem persists.

- **Issue #274** (2024-08-21): **[BUG]: quick start example fails to compile**
  *Symptoms*:  Following https://docs.nexus.xyz/zkvm/sdk-quick-start  with the given host and guest example programs:  ```rust #![cfg_attr(target_arch = "riscv32", no_std, no_main)]   use nexus_rt::{println, read_private_input, write_output};   #[nexus_rt::main] fn main() {     let input = read_private_input::<(u32, u32)>();       let mut z: i32 = -1;     if let Ok((x, y)) = input {         println!("Read private input: ({}, {})", x, y);           z = (x * y) as i32;     } else {         println!("No private input provided...");     }       write_output::<i32>(&z) } ```  ```rust use nexus_sdk::{     compile::CompileOpts,     nova::seq::{Generate, Nova, PP},     Local, Prover, Verifiable, };   type Input = (u32, u32); type Output = i32;   const PACKAGE: &str = "guest";   fn main() {     println!("Setting up Nova public parameters...");     let pp: PP = PP::generate().expect("failed to generate parameters");       let mut opts = CompileOpts::new(PACKAGE);     opts.set_memlimit(8); // use an 8mb memory       println!("Compiling guest program...");     let prover: Nova<Local> = Nova::compile(&opts).expect("failed to compile guest program");       let input: Input = (3, 5);       print!("Proving execution of vm...");     let proof = prover         .prove_with_input::<Input>(&pp, &input)         .expect("failed to prove program");       println!(         " output is {}!",         proof             .output::<Output>()             .expect
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. This coincides with a new release to `postcard`, and we're investigating the root cause and working on a fix.
  > Thanks, but how do I know fix my existing nexus-host example program from the quickstart docs?
  > Opened upstream issue: https://github.com/jamesmunns/postcard/issues/167

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

### Incident Patch 1: `24685a24` (2026-01-05)
**Commit Message**: perf: reuse pending_logup capacity in LogupTraceBuilder (#556)

**File**: `prover2/machine/src/lookups/logup_trace_builder.rs` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ impl LogupTraceBuilder {
             Self::iter_logup_fractions(self.log_size, relation, &mult_columns, mult_expr, tuple);
 
         if self.pending_logup.is_empty() {
-            self.pending_logup = frac_iter.collect();
+            self.pending_logup.extend(frac_iter);
         } else {
             let mut logup_col_gen = self.logup_trace_gen.new_col();
 
```

---

### Incident Patch 2: `4dd5ee9e` (2026-01-05)
**Commit Message**: fix: update nightly version to avoid issue with transitive dependency (#574)

* Update nightly version to avoid issue with transitive dependency.

* Update CI.

* Formmating.

* Clippy fix

* Formatting again

**File**: `.github/workflows/ci.yml` (modified, +6/-6)
```diff
@@ -17,7 +17,7 @@ jobs:
         uses: dtolnay/rust-toolchain@stable
         with:
           components: rustfmt
-          toolchain: nightly-2025-04-06
+          toolchain: nightly-2025-05-09
 
       - name: Run `cargo fmt`
         run: |
@@ -41,7 +41,7 @@ jobs:
         uses: dtolnay/rust-toolchain@stable
         with:
           components: clippy
-          toolchain: nightly-2025-04-06
+          toolchain: nightly-2025-05-09
           targets: riscv32im-unknown-none-elf
 
       - name: Add clippy
@@ -79,7 +79,7 @@ jobs:
       - name: Install Rust
         uses: dtolnay/rust-toolchain@stable
         with:
-          toolchain: nightly-2025-04-06
+          toolchain: nightly-2025-05-09
           targets: riscv32im-unknown-none-elf
 
       - name: Install cargo-expand
@@ -113,7 +113,7 @@ jobs:
       - name: Install Rust
         uses: dtolnay/rust-toolchain@stable
         with:
-          toolchain: nightly-2025-04-06 # same version as normal tests
+          toolchain: nightly-2025-05-09 # same version as normal tests
           # need riscv32im-unknown-none-elf for building guest binaries
           targets: wasm32-wasip1, riscv32im-unknown-none-elf
 
@@ -153,7 +153,7 @@ jobs:
       - name: Install Rust
         uses: dtolnay/rust-toolchain@stable
         with:
-          toolchain: nightly-2025-04-06
+          toolchain: nightly-2025-05-09
           targets: riscv32im-unknown-none-elf
 
       - uses: taiki-e/install-action@nextest
@@ -217,7 +217,7 @@ jobs:
       - name: Install Rust
         uses: dtolnay/rust-toolchain@stable
         with:
-          toolchain: nightly-2025-04-06
+          toolchain: nightly-2025-05-09
           targets: riscv32im-unknown-none-elf
 
       - name: Download pre-built host project
```

**File**: `cli/src/command/host.rs` (modified, +1/-1)
```diff
@@ -164,5 +164,5 @@ const GUEST_TEMPLATE_SRC_MAIN: &str = include_str!(concat!(guest_examples_dir!()
 
 // freeze toolchain that works with all provers
 const RUST_TOOLCHAIN: &str = r#"[toolchain]
-channel = "nightly-2025-04-06"
+channel = "nightly-2025-05-09"
 "#;
```

**File**: `common/src/memory/alignment.rs` (modified, +1/-6)
```diff
@@ -36,12 +36,7 @@ pub trait Alignable: Sized + Copy + Display + Debug {
     fn is_aligned_to<const N: usize>(self) -> bool;
 
     fn assert_aligned_to<const N: usize>(self) {
-        assert!(
-            self.is_aligned_to::<N>(),
-            "{} is not aligned to {}",
-            self,
-            N
-        );
+        assert!(self.is_aligned_to::<N>(), "{self} is not aligned to {N}");
     }
 
     /// Assert that the value is aligned to a word boundary.
```

**File**: `common/src/riscv/instruction.rs` (modified, +13/-14)
```diff
@@ -72,8 +72,7 @@ impl Instruction {
             // I-type instruction with shamt has 5 bits for shamt.
             debug_assert!(
                 op_c <= 0x1F,
-                "op_c must be in the range [0..32), got {}",
-                op_c
+                "op_c must be in the range [0..32), got {op_c}"
             );
         }
 
@@ -199,7 +198,7 @@ impl Instruction {
         let rd = self.op_a;
         let rs1 = self.op_b;
         let rs2 = Register::from(self.op_c as u8);
-        format!("{} {}, {}, {}", opcode, rd, rs1, rs2)
+        format!("{opcode} {rd}, {rs1}, {rs2}")
     }
 
     fn i_type_to_string(&self, opcode: BuiltinOpcode) -> String {
@@ -210,51 +209,51 @@ impl Instruction {
             BuiltinOpcode::EBREAK | BuiltinOpcode::ECALL => self.opcode.to_string(),
             BuiltinOpcode::JALR => match (rd, rs1, imm12) {
                 (Register::X0, Register::X1, 0) => "ret".to_string(),
-                (Register::X0, _, 0) => format!("jr {}", rs1),
+                (Register::X0, _, 0) => format!("jr {rs1}"),
                 (Register::X1, _, 0) => format!("{} {}", self.opcode, rs1),
-                _ => format!("{} {}, {}, {}", opcode, rd, rs1, imm12),
+                _ => format!("{opcode} {rd}, {rs1}, {imm12}"),
             },
             BuiltinOpcode::ADDI => match (rd, rs1, imm12) {
                 (Register::X0, Register::X0, 0) => "nop".to_string(),
-                (_, Register::X0, _) => format!("li {}, {}", rd, imm12),
-                (_, _, 0) => format!("mv {}, {}", rd, rs1),
-                _ => format!("{} {}, {}, {}", opcode, rd, rs1, imm12),
+                (_, Register::X0, _) => format!("li {rd}, {imm12}"),
+                (_, _, 0) => format!("mv {rd}, {rs1}"),
+                _ => format!("{opcode} {rd}, {rs1}, {imm12}"),
             },
             BuiltinOpcode::LB
             | BuiltinOpcode::LH
             | BuiltinOpcode::LW
             | BuiltinOpcode::LBU
             | BuiltinOpcode::LHU => {
-                format!("{} {}, {}({})", opcode, rd, imm12, rs1)
+                format!("{opcode} {rd}, {imm12}({rs1})")
             }
-            _ => format!("{} {}, {}, {}", opcode, rd, rs1, imm12),
+            _ => format!("{opcode} {rd}, {rs1}, {imm12}"),
         }
     }
 
     fn s_type_to_string(&self, opcode: BuiltinOpcode) -> String {
         let rs1 = self.op_a;
         let rs2 = self.op_b;
         let imm12 = self.op_c as i32;
-        format!("{} {}, {}({})", opcode, rs2, imm12, rs1)
+        format!("{opcode} {rs2}, {imm12}({rs1})")
     }
 
     fn b_type_to_string(&self, opcode: BuiltinOpcode) -> String {
         let rs1 = self.op_a;
         let rs2 = self.op_b;
         let imm12 = self.op_c as i32;
-        format!("{} {}, {}, 0x{:x}", opcode, rs1, rs2, imm12)
+        format!("{opcode} {rs1}, {rs2}, 0x{imm12:x}")
     }
 
     fn u_type_to_string(&self, opcode: BuiltinOpcode) -> String {
         let rd = self.op_a;
         let imm20 = self.op_c;
-        format!("{} {}, 0x{:x}", opcode, rd, imm20)
+        format!("{opcode} {rd}, 0x{imm20:x}")
     }
 
     fn j_type_to_string(&self, opcode: BuiltinOpcode) -> String {
         let rd = self.op_a;
         let imm20 = self.op_c as i32;
-        format!("{} {}, 0x{:x}", opcode, rd, imm20)
+        format!("{opcode} {rd}, 0x{imm20:x}")
     }
 
     // Encode the instruction struct to binary representation.
```

**File**: `common/src/riscv/register.rs` (modified, +2/-3)
```diff
@@ -188,8 +188,7 @@ mod tests {
             assert_eq!(
                 reg.abi_name(),
                 abi_names[i as usize],
-                "Mismatch for register X{}",
-                i
+                "Mismatch for register X{i}"
             );
         }
     }
@@ -199,7 +198,7 @@ mod tests {
         for i in 0..32 {
             let reg = Register::from(i);
             assert_eq!(
-                format!("{}", reg),
+                format!("{reg}"),
                 reg.abi_name(),
                 "Display mismatch for register X{}",
                 i
```

---

### Incident Patch 3: `e8ed1d6d` (2025-12-17)
**Commit Message**: fix(macros): correct error messages for input types (#552)

* fix(macros): correct error messages for input types

* Update io.rs

* Update io.rs

* Update io.rs

* Update io.rs

* Update io.rs

**File**: `runtime/macros/src/io.rs` (modified, +39/-24)
```diff
@@ -109,7 +109,9 @@ pub(crate) fn handle_output(
             let out = (|| {
                 #block
             })();
-            #output_fn_full(&out).expect("Failed to write output");
+            #output_fn_full(&out).unwrap_or_else(|e| {
+                panic!("Failed to write output: {:?}", e);
+            });
         }
     };
 
@@ -160,25 +162,18 @@ pub(crate) fn handle_input(
                     p.insert(0, Path(id.clone()));
                     (Some(name), p)
                 } else {
-                    return stream_error(
-                        expr,
-                        format!(
-                            "Expected input variable, got {:?}.",
-                            attr_args.get(0).unwrap().to_token_stream()
-                        ),
-                    );
+                    let got = attr_args.get(0).unwrap().to_token_stream().to_string();
+                    return stream_error(expr, format!("Expected input variable, got {}.", got));
                 }
             } else if let Path(id) = attr_args.get(0).unwrap() {
                 let mut p: Punctuated<Expr, Comma> = Punctuated::new();
                 p.insert(0, Path(id.clone()));
                 (Some(name), p)
             } else {
+                let got = attr_args.get(0).unwrap().to_token_stream().to_string();
                 return stream_error(
                     &attr_args,
-                    format!(
-                        "Expected a tuple of input types, got type {:?}.",
-                        attr_args.get(0).unwrap().to_token_stream()
-                    ),
+                    format!("Expected a tuple of input types, got type {}.", got),
                 );
             }
         }
@@ -187,7 +182,15 @@ pub(crate) fn handle_input(
 
     // Check that the set of input variables is non-empty.
     if attr_inputs.is_empty() {
-        return stream_error(&attr_args, "Expected at least one public input.");
+        let input_type_label = match input_type {
+            InputType::Public => "public input",
+            InputType::Private => "private input",
+            InputType::Custom => "input",
+        };
+        return stream_error(
+            &attr_args,
+            format!("Expected at least one {}.", input_type_label),
+        );
     }
 
     // Parse the input variables.
@@ -199,7 +202,7 @@ pub(crate) fn handle_input(
             }
             let name = id.path.segments.get(0).unwrap().ident.clone();
             if public_inputs.contains(&name) {
-                return stream_error(&attr_args, format!("Duplicate public input: {:?}.", name));
+                return stream_error(&attr_args, format!("Duplicate public input: {}.", name));
             }
             public_inputs.insert(name);
         } else {
@@ -236,13 +239,16 @@ pub(crate) fn handle_input(
         }
     }
 
-    // Check that all public inputs listed in the attribute are present in the function signature.
+    // Check that all inputs listed in the attribute are present in the function signature.
     if !public_inputs.is_empty() {
+        let mut input_names: Vec<String> = public_inputs.iter().map(|id| id.to_string()).collect();
+        input_names.sort();
+        let input_list = input_names.join(", ");
         return stream_error(
             &sig.inputs,
             format!(
-                "Provided public input does not appear in the function signature: {:?}",
-                public_inputs
+                "Provided public input does not appear in the function signature: {}",
+                input_list
             ),
         );
     }
@@ -261,7 +267,7 @@ pub(crate) fn handle_input(
         },
     };
 
-    // Check that the target architecture is riscv32 if doing public output.
+    // Check that the target architecture is riscv32 if doing public/private input.
     let target_check = if !matches!(input_type, InputType::Custom) {
         quote! {
             #[cfg(not(target_arch = "riscv32")
```

---

### Incident Patch 4: `e6b1bca9` (2025-12-10)
**Commit Message**: fix(emulator): correct heap_size calculation in LinearMemoryLayout::tracked_ram_size (#551)

**File**: `vm/src/emulator/layout.rs` (modified, +90/-2)
```diff
@@ -337,9 +337,9 @@ impl LinearMemoryLayout {
                 .checked_sub(self.stack_bottom)
                 .expect("stack top should be above stack bottom") as usize;
         let heap_size = self
-            .heap
+            .heap_end()
             .checked_sub(self.heap_start())
-            .expect("heap should be above heap start") as usize;
+            .expect("heap end should be above heap start") as usize;
         let public_input_size =
             self.public_input_end()
                 .checked_sub(self.public_input_start())
@@ -405,3 +405,91 @@ impl Display for LinearMemoryLayout {
         Ok(())
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::LinearMemoryLayout;
+
+    #[test]
+    fn tracked_ram_size_includes_heap_nonzero() {
+        // Construct a layout with a non-zero heap and stack sizes
+        let max_heap_size: u32 = 0x200; // 512 bytes
+        let max_stack_size: u32 = 0x300; // 768 bytes
+        let public_input_size: u32 = 0x20; // 32 bytes (raw)
+        let public_output_size: u32 = 0x40; // 64 bytes (raw)
+        let program_size: u32 = 0x1000; // 4096 bytes
+        let ad_size: u32 = 0x10; // 16 bytes
+
+        let layout = LinearMemoryLayout::try_new(
+            None,
+            max_heap_size,
+            max_stack_size,
+            public_input_size,
+            public_output_size,
+            program_size,
+            ad_size,
+        )
+        .unwrap();
+
+        // Compute expected sizes from the layout getters to include any alignment padding
+        let stack_size = layout.stack_top() - layout.stack_bottom();
+        let heap_size = layout.heap_end() - layout.heap_start();
+        let public_input_span = layout.public_input_end() - layout.public_input_start();
+        let public_output_span = layout.public_output_end() - layout.public_output_start();
+        let exit_code_size = nexus_common::constants::WORD_SIZE as u32;
+
+        let static_memory_size: usize = 0x60; // arbitrary static memory contribution in bytes
+
+        let expected_total = static_memory_size
+            + stack_size as usize
+            + heap_size as usize
+            + public_input_span as usize
+            + public_output_span as usize
+            + exit_code_size as usize;
+
+        let actual = layout.tracked_ram_size(static_memory_size);
+        assert_eq!(actual, expected_total);
+        assert!(heap_size > 0, "heap should be non-zero in this test");
+    }
+
+    #[test]
+    fn tracked_ram_size_handles_zero_heap() {
+        // Zero heap, non-zero stack
+        let max_heap_size: u32 = 0x0;
+        let max_stack_size: u32 = 0x300; // 768 bytes
+        let public_input_size: u32 = 0x20; // 32 bytes (raw)
+        let public_output_size: u32 = 0x40; // 64 bytes (raw)
+        let program_size: u32 = 0x800; // 2048 bytes
+        let ad_size: u32 = 0x0; // 0 bytes
+
+        let layout = LinearMemoryLayout::try_new(
+            None,
+            max_heap_size,
+            max_stack_size,
+            public_input_size,
+            public_output_size,
+            program_size,
+            ad_size,
+        )
+        .unwrap();
+
+        let stack_size = layout.stack_top() - layout.stack_bottom();
+        let heap_size = layout.heap_end() - layout.heap_start(); // should be 0
+        let public_input_span = layout.public_input_end() - layout.public_input_start();
+        let public_output_span = layout.public_output_end() - layout.public_output_start();
+        let exit_code_size = nexus_common::constants::WORD_SIZE as u32;
+
+        let static_memory_size: usize = 0x0;
+
+        let expected_total = static_memory_size
+            + stack_size as usize
+            + heap_size as usize
+            + public_input_span as usize
+            + public_output_span as usize
+            + exit_code_size as usize;
+
+        let actual = layout.tracked_ram_size(static_memory_size);
+        assert_eq!(actual, expected_total);
+        assert_eq!(hea
```

---

### Incident Patch 5: `bdb2a29b` (2025-11-24)
**Commit Message**: Fix I/O error handling in ElfFile::from_path (#540)

* Update loader.rs

* Update loader.rs

* Update loader.rs

**File**: `vm/src/elf/loader.rs` (modified, +3/-6)
```diff
@@ -46,7 +46,7 @@
 use crate::{elf::parser, error::VMError, memory::MemorySegmentImage};
 
 use elf::{endian::LittleEndian, ElfBytes};
-use std::fs::File;
+use std::fs;
 use std::path::Path;
 
 use super::{error::ParserError, parser::ParsedElfData};
@@ -122,11 +122,7 @@ impl ElfFile {
     }
 
     pub fn from_path<P: AsRef<Path> + ?Sized>(path: &P) -> Result<Self, VMError> {
-        let file = File::open(path).map_err(Into::<ParserError>::into)?;
-
-        let data: Vec<u8> = std::io::Read::bytes(file)
-            .map(|b| b.expect("Failed to read byte"))
-            .collect();
+        let data = fs::read(path.as_ref()).map_err(Into::<ParserError>::into)?;
         Self::from_bytes(data.as_slice())
     }
 }
@@ -138,6 +134,7 @@ mod tests {
     use crate::{memory::MemorySegmentImage, read_testing_elf_from_path};
 
     use super::*;
+    use std::fs::File;
     use std::io::Write;
 
     #[allow(dead_code)]
```

---

### Incident Patch 6: `4c7ff3c2` (2025-11-21)
**Commit Message**: Fix documentation link (#535)

Updated the link to the zkVM documentation.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -35,4 +35,4 @@ That said, the Nexus zkVM is also designed to be extensible. Source-available co
 
 ### Learn More
 
-See our zkVM documentation, including guides and walkthroughs, at [docs.nexus.xyz](https://docs.nexus.xyz/zkvm/index).
+See our zkVM documentation, including guides and walkthroughs, at [docs.nexus.xyz](https://docs.nexus.xyz/zkvm).
```

---

### Incident Patch 7: `1fb6ebdd` (2025-11-17)
**Commit Message**: fix: incorrect custom_input example in compile_error! (#532)

**File**: `runtime/macros/src/io.rs` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ pub(crate) fn handle_input(
     let target_check = if !matches!(input_type, InputType::Custom) {
         quote! {
             #[cfg(not(target_arch = "riscv32"))]
-            compile_error!("NexusVM public and private input interfaces are not available for native builds, use a custom handler instead. Ex: #[nexus_rt::custom_input(bar)]");
+            compile_error!("NexusVM public and private input interfaces are not available for native builds, use a custom handler instead. Ex: #[nexus_rt::custom_input((x,y,z), fizz)]");
         }
     } else {
         quote! {}
```

---

### Incident Patch 8: `f9b5a8f3` (2025-11-14)
**Commit Message**: fix: remove duplicate clone in HashSet insert (#529)

Replace HashSet::insert() with contains() check followed by insert()
to avoid cloning the Ident twice. The previous code cloned name when
creating the variable and again when calling insert(), which was
unnecessary since we can check for duplicates first.

**File**: `runtime/macros/src/io.rs` (modified, +2/-1)
```diff
@@ -198,9 +198,10 @@ pub(crate) fn handle_input(
                 return stream_error(id, "Expected an identifier.");
             }
             let name = id.path.segments.get(0).unwrap().ident.clone();
-            if !public_inputs.insert(name.clone()) {
+            if public_inputs.contains(&name) {
                 return stream_error(&attr_args, format!("Duplicate public input: {:?}.", name));
             }
+            public_inputs.insert(name);
         } else {
             return stream_error(x, "Expected an identifier.");
         }
```

---

### Incident Patch 9: `d8f16333` (2025-10-20)
**Commit Message**: fix(vm): correct add_opcode duplicate detection using Entry API (#497)

* fix(vm): correct add_opcode duplicate detection using Entry API

* Update traits.rs

* Update mod.rs

* Update Cargo.toml

* Update traits.rs

* Update Cargo.toml

**File**: `vm/src/emulator/registry.rs` (modified, +8/-5)
```diff
@@ -63,7 +63,7 @@ use crate::{
     memory::{LoadOps, StoreOps, UnifiedMemory},
     riscv::{BuiltinOpcode, Instruction, Opcode},
 };
-use std::collections::HashMap;
+use std::collections::{hash_map::Entry, HashMap};
 
 pub type InstructionExecutorFn<M> =
     fn(&mut Cpu, &mut M, &Instruction) -> Result<(Option<u32>, (LoadOps, StoreOps)), MemoryError>;
@@ -238,10 +238,13 @@ impl Default for InstructionExecutorRegistry {
 
 impl InstructionExecutorRegistry {
     pub fn add_opcode<IE: InstructionExecutor>(&mut self, op: &Opcode) -> Result<(), VMError> {
-        self.precompiles
-            .insert(op.clone(), register_instruction_executor!(IE::evaluator))
-            .ok_or(VMErrorKind::DuplicateInstruction(op.clone()).into())
-            .map(|_| ())
+        match self.precompiles.entry(op.clone()) {
+            Entry::Occupied(_) => Err(VMErrorKind::DuplicateInstruction(op.clone()).into()),
+            Entry::Vacant(v) => {
+                v.insert(register_instruction_executor!(IE::evaluator));
+                Ok(())
+            }
+        }
     }
 
     pub fn get(&self, op: &Opcode) -> Result<InstructionExecutorFn<UnifiedMemory>> {
```

---

### Incident Patch 10: `6bba621f` (2025-10-03)
**Commit Message**:  chore: fix error input messages (#487)

**File**: `runtime/macros/macro_expansion_tests/tests/private-input-expanded-riscv.rs` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ fn main() {
     let out = (|| {
         {
             let (y): (u32) = nexus_rt::read_private_input::<(u32)>()
-                .expect("Failed to read public input");
+                .expect("Failed to read private input");
             {
                 {
                     let (x): (u32) = nexus_rt::read_private_input::<(u32)>()
-                        .expect("Failed to read public input");
+                        .expect("Failed to read private input");
                     { { x * y } }
                 }
             }
```

**File**: `runtime/macros/macro_expansion_tests/tests/public-input-expanded-riscv.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ fn main() {
     let out = (|| {
         {
             let (y): (u32) = nexus_rt::read_private_input::<(u32)>()
-                .expect("Failed to read public input");
+                .expect("Failed to read private input");
             {
                 {
                     let (x): (u32) = nexus_rt::read_public_input::<(u32)>()
```

**File**: `runtime/macros/macro_expansion_tests/tests/public-output-expanded-riscv.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ const _: fn() = main;
 #[allow(unused)]
 fn main() {
     let (x, y): (u32, u32) = nexus_rt::read_private_input::<(u32, u32)>()
-        .expect("Failed to read public input");
+        .expect("Failed to read private input");
     {
         {
             foo(x, y);
```

#### Recent Merged Pull Requests:
- **PR #602** (closed): refactor(benchmarks): remove redundant intermediate variables in benchmark loop (@marukai67)
- **PR #600** (closed): refactor(vm): Remove dead code and replace test suppression with cfg(test) (@marukai67)
- **PR #599** (closed): Fix: invalid macro syntax (@meelon-dev)
- **PR #598** (closed): refactor(runtime/macros): remove redundant clones in macro expansion tests (@0xxFloki)
- **PR #592** (closed): refactor(vm): remove unused InternalView import (@Aleksandr1732)
- **PR #591** (closed): feat: add `nexus_sdk` extensions support (@brech1)
- **PR #587** (closed): refactor(vm): remove dead code from ELF loader tests (@0xlupin)
- **PR #585** (closed): Refine precompile metadata error formatting (@conomist)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
