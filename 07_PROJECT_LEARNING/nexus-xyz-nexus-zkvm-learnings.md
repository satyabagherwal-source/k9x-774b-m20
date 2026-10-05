# Forensic Learning Record (Deep Inspection): nexus-xyz/nexus-zkvm

> **Canonical Artifact**: `07_PROJECT_LEARNING/nexus-xyz-nexus-zkvm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nexus-xyz/nexus-zkvm](https://github.com/nexus-xyz/nexus-zkvm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:41.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nexus-xyz/nexus-zkvm`
- **Description**: The Nexus zkVM: The zero-knowledge virtual machine
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2622 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
            + initial_children_usage.ru_stime.tv_usec as f64 / 1_000_000.0;
        self_time + children_time
    };

    let final_cpu_time = {
        let self_time = final_self_usage.ru_utime.tv_sec as f64
            + final_self_usage.ru_utime.tv_usec as f64 / 1_000_000.0
            + final_self_usage.ru_stime.tv_sec as f64
            + final_self_usage.ru_stime.tv_usec as f64 / 1_000_000.0;
        let children_time = final_children_usage.ru_utime.tv_sec as f64
            + final_children_usage.ru_utime.tv_usec as f64 / 1_000_000.0
            + final_children_usage.ru_stime.tv_sec as f64
            + final_children_usage.ru_stime.tv_usec as f64 / 1_000_000.0;
        self_time + children_time
    };

    let total_cpu_time = final_cpu_time - initial_cpu_time;
    let duration = start_time.elapsed();
    let wall_time = duration.as_secs_f64();

    // Calculate CPU usage as percentage.
    let cpu_percentage = if wall_time > 0.0 {
        ((total_cpu_time / wall_time / num_cpus::get() as f64) * 100.0 * 1000.0).round() / 1000.0
    } else {
        0.0
    };

    // Get peak memory usage (use maximum of self and children).
    #[cfg(target_os = "macos")]
    let peak_memory_gb = {
        let self_mem = ((final_self_usage.ru_maxrss as f64) / (1024.0 * 1024.0 * 1024.0) * 1000.0)
            .round()
            / 1000.0;
        let children_mem =
            ((final_children_usage.ru_maxrss as f64) / (1024.0 * 1024.0 * 1024.0) * 1000.0).round()
                / 1000.0;
        f64::max(self_mem, children_mem)
    };
    #[cfg(not(target_os = "macos"))]
    let peak_memory_gb = {
        let self_mem =
            ((final_self_usage.ru_maxrss as f64) / (1024.0 * 1024.0) * 1000.0).round() / 1000.0;
        let children_mem =
            ((final_children_usage.ru_maxrss as f64) / (1024.0 * 1024.0) * 1000.0).round() / 1000.0;
        f64::max(self_mem, children_mem)
    };

    let (user_time, sys_time) = calculate_time_diff(&initial_self_usage, &final_self_usage);

    (
        duration,
        u
```

### Core Architecture Module: `cli/src/utils.rs`
```
use std::{ffi::OsStr, path::Path, process::Command};

pub fn cargo<I, S>(dir: Option<&Path>, args: I) -> anyhow::Result<()>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let cargo_bin = std::env::var("CARGO").unwrap_or_else(|_err| "cargo".into());

    let status = Command::new(cargo_bin)
        .args(args)
        .current_dir(dir.unwrap_or(Path::new(".")))
        .status()?;
    if !status.success() {
        anyhow::bail!("cargo didn't exit successfully: {status}")
    }
    Ok(())
}

```

### Core Architecture Module: `core/src/lib.rs`
```
//! The core crate is intended to provide a unified API for access to the zkvm that can be consumed as needed
//! by the various demand- and supply-side components, such as the network orchestrator, the SDK, and the CLI.

/// RISC-V processing
pub mod nvm {
    pub use nexus_vm::{
        elf::{ElfError, ElfFile},
        emulator::View,
        error::VMError,
        trace::{bb_trace, k_trace, BBTrace, UniformTrace},
    };
    pub mod internals {
        pub use nexus_vm::emulator::{
            convert_instruction, elf_into_program_info, io_entries_into_vec, map_into_io_entries,
            slice_into_io_entries, LinearEmulator, LinearMemoryLayout, MemoryInitializationEntry,
            ProgramInfo, PublicOutputEntry,
        };
    }
}

/// Stwo proving
pub mod stwo {
    pub use nexus_vm_prover::{prove, verify, Proof, ProvingError, VerificationError};
}

```

### Core Architecture Module: `prover/src/chips/utils.rs`
```
pub fn sign_extend(value: u32, num_bits: usize) -> u32 {
    let mask = (1 << num_bits) - 1;
    let lower_bits = value & mask;

    if value & (1 << (num_bits)) != 0 {
        // sign extend
        return lower_bits + (1 << num_bits);
    }

    lower_bits
}

#[cfg(test)]
mod tests {
    use super::sign_extend;

    #[test]
    fn test() {
        let a = 0u32.wrapping_sub(8);
        let b = sign_extend(a, 12);
        assert_eq!(b, 0b1111_1111_1000 + (1 << 12));
        assert_eq!(sign_extend(2047, 12), 2047);

        let a = 0u32.wrapping_sub(30000);
        let b = sign_extend(a, 16);
        assert_eq!(b, 0b1000_1010_1101_0000 + (1 << 16));

        assert_eq!(sign_extend(524287, 20), 524287);
    }
}

```

### Core Architecture Module: `prover/src/trace/utils.rs`
```
use rayon::iter::{IndexedParallelIterator, IntoParallelIterator, ParallelIterator};
use stwo::{
    core::fields::m31::BaseField,
    prover::backend::simd::{column::BaseColumn, SimdBackend},
};

use nexus_vm::WORD_SIZE;

pub use stwo::prover::backend::ColumnOps;

use super::{
    program::{Word, WordWithEffectiveBits},
    utils_external::coset_order_to_circle_domain_order,
};

/// Trait for BaseField representation
pub(crate) trait IntoBaseFields<const N: usize> {
    fn into_base_fields(self) -> [BaseField; N];
}

impl IntoBaseFields<1> for bool {
    fn into_base_fields(self) -> [BaseField; 1] {
        [BaseField::from(self as u32)]
    }
}

impl IntoBaseFields<1> for u8 {
    fn into_base_fields(self) -> [BaseField; 1] {
        [BaseField::from(self as u32)]
    }
}

impl<const N: usize> IntoBaseFields<{ N }> for [bool; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        std::array::from_fn(|i| BaseField::from(self[i] as u32))
    }
}

impl<const N: usize> IntoBaseFields<{ N }> for [u8; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        std::array::from_fn(|i| BaseField::from(self[i] as u32))
    }
}

impl<const N: usize> IntoBaseFields<N> for [BaseField; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        self
    }
}

impl IntoBaseFields<{ WORD_SIZE }> for WordWithEffectiveBits {
    fn into_base_fields(self) -> [BaseField; WORD_SIZE] {
        self.0.into_base_fields()
    }
}

impl IntoBaseFields<{ WORD_SIZE }> for u32 {
    fn into_base_fields(self) -> [BaseField; WORD_SIZE] {
        let bytes = self.to_le_bytes();
        std::array::from_fn(|i| BaseField::from(bytes[i] as u32))
    }
}

impl IntoBaseFields<1> for BaseField {
    fn into_base_fields(self) -> [BaseField; 1] {
        [self]
    }
}

/// Trait for reading Basefields
pub(crate) trait FromBaseFields<const N: usize> {
    fn from_base_fields(elms: [BaseField; N]) -> Self;
}

impl FromBaseFields<WORD_SIZE> for Word {
    fn from_base_fields(elms: [BaseField; WORD_SIZE]) -> Self {
        let mut ret = Word::default();
        for (i, b) in elms.iter().enumerate() {
            let read = b.0;
            assert!(read < 256, "invalid byte value");
            ret[i] = read as u8;
        }
        ret
    }
}

impl FromBaseFields<WORD_SIZE> for u32 {
    fn from_base_fields(elms: [BaseField; WORD_SIZE]) -> Self {
        let bytes = Word::from_base_fields(elms);
        u32::from_le_bytes(bytes)
    }
}

pub fn finalize_columns(columns: Vec<Vec<BaseField>>) -> Vec<BaseColumn> {
    let mut ret = Vec::with_capacity(columns.len());
    columns
        .into_par_iter()
        .map(|col| {
            let eval = coset_order_to_circle_domain_order(col.as_slice());
            let mut base_column = BaseColumn::from_iter(eval);
            <SimdBackend as ColumnOps<BaseField>>::bit_reverse_column(&mut base_column);
            base_column
        })
        .collect_into_vec(&mut ret);
    ret
}

#[cfg(test)]
mod tests {
    use super::*;
    use stwo::core::{
        fields::m31::M31,
        utils::{bit_reverse_index, coset_index_to_circle_domain_index},
    };

    #[test]
    fn test_order() {
        let log_size = 3;
        let vals: Vec<M31> = (0..1 << log_size).map(M31::from).collect();
        let reordered = coset_order_to_circle_domain_order(&vals);
        let mut col = BaseColumn::from_iter(reordered.clone());
        <SimdBackend as ColumnOps<BaseField>>::bit_reverse_column(&mut col);

        for (i, reordered) in col.as_slice().iter().enumerate().take(1 << log_size) {
            let idx = bit_reverse_index(coset_index_to_circle_domain_index(i, log_size), log_size);
            assert_eq!(reordered, &vals[idx]);
        }
    }
}

```

### Core Architecture Module: `prover/src/trace/utils_external.rs`
```
// Copyright 2024 StarkWare Industries Ltd.
// Copyright 2024-2025 Nexus Laboratories, Ltd.
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

// The code below was copied from
// https://github.com/starkware-libs/stwo/blob/f7871979e6ea8e606dc4674301b7d8b28b5838ed/crates/prover/src/core/utils.rs#L108
// and since then modified.

use rayon::iter::{IndexedParallelIterator, IntoParallelIterator, ParallelIterator};
use stwo::core::fields::Field;

// TODO: patch upstream to make it public and remove / or use pub methods from tests.
pub fn coset_order_to_circle_domain_order<F: Field>(values: &[F]) -> Vec<F> {
    let mut ret = Vec::with_capacity(values.len());
    let n = values.len();
    let half_len = n / 2;

    (0..half_len)
        .into_par_iter()
        .map(|i| values[i << 1])
        .chain(
            (0..half_len)
                .into_par_iter()
                .map(|i| values[n - 1 - (i << 1)]),
        )
        .collect_into_vec(&mut ret);
    ret
}

```

### Core Architecture Module: `prover2/air-column/air-column-derive/src/utils.rs`
```
use proc_macro2::{Span, TokenStream};
use proc_macro_crate::FoundCrate;
use quote::{format_ident, quote, ToTokens};

pub(crate) fn air_column_crate_include() -> TokenStream {
    match proc_macro_crate::crate_name("nexus-vm-prover-air-column") {
        Ok(FoundCrate::Itself) => quote! { crate },
        Ok(FoundCrate::Name(crate_name)) => format_ident!("{crate_name}").to_token_stream(),
        Err(e) => {
            let err = syn::Error::new(Span::call_site(), e).to_compile_error();
            quote!( #err )
        }
    }
}

```

### Core Architecture Module: `prover2/machine/src/components/utils/constraints.rs`
```
use num_traits::One;
use stwo::core::fields::m31::BaseField;
use stwo_constraint_framework::EvalAtRow;

use nexus_common::constants::WORD_SIZE_HALVED;
use nexus_vm_prover_air_column::{AirColumn, PreprocessedAirColumn};
use nexus_vm_prover_trace::eval::TraceEval;

/// Helper struct for constraining clock increments.
pub struct ClkIncrement<C> {
    /// The current execution time represented by two 16-bit limbs
    pub clk: C,
    /// The helper bit to compute the next clock value
    pub clk_carry: C,
}

impl<C: AirColumn> ClkIncrement<C> {
    pub fn eval<E: EvalAtRow, P: PreprocessedAirColumn>(
        self,
        eval: &mut E,
        trace_eval: &TraceEval<P, C, E>,
    ) -> [E::F; WORD_SIZE_HALVED] {
        let clk: [E::F; WORD_SIZE_HALVED] = trace_eval.column_eval(self.clk);
        let [clk_carry] = trace_eval.column_eval(self.clk_carry);

        // (clk-carry) · (1 − clk-carry) = 0
        eval.add_constraint(clk_carry.clone() * (E::F::one() - clk_carry.clone()));

        let clk_next_0 = clk[0].clone() + E::F::one() - clk_carry.clone();
        let clk_next_1 = clk[1].clone() + clk_carry;
        [clk_next_0, clk_next_1]
    }
}

/// Helper struct for constraining program counter increments.
pub struct PcIncrement<C> {
    /// The current value of the program counter register
    pub pc: C,
    /// The helper bits to compute the program counter update
    pub pc_carry: C,
}

impl<C: AirColumn> PcIncrement<C> {
    pub fn eval<E: EvalAtRow, P: PreprocessedAirColumn>(
        self,
        eval: &mut E,
        trace_eval: &TraceEval<P, C, E>,
    ) -> [E::F; WORD_SIZE_HALVED] {
        let pc: [E::F; WORD_SIZE_HALVED] = trace_eval.column_eval(self.pc);
        let [pc_carry] = trace_eval.column_eval(self.pc_carry);

        // (pc-carry) · (1 − pc-carry) = 0
        eval.add_constraint(pc_carry.clone() * (E::F::one() - pc_carry.clone()));

        let pc_next_0 = pc[0].clone() + E::F::from(BaseField::from(4)) - pc_carry.clone();
        let pc_next_1 = pc[1].clone() + pc_carry;
        [pc_next_0, pc_next_1]
    }
}

```

### Core Architecture Module: `prover2/machine/src/components/utils/mod.rs`
```
use nexus_vm::WORD_SIZE;
use nexus_vm_prover_trace::program::{BoolWord, Word};

pub mod constraints;

/// Adds two 4-byte words with carry propagation across each byte.
pub fn add_with_carries(a: Word, b: Word) -> (Word, BoolWord) {
    let mut sum_bytes = [0u8; WORD_SIZE];
    let mut carry_bits = [false; WORD_SIZE];

    // Compute the sum and carry of each limb.
    let (sum, c0) = a[0].overflowing_add(b[0]);
    carry_bits[0] = c0;
    sum_bytes[0] = sum;
    // Process the remaining bytes
    for i in 1..WORD_SIZE {
        // Add the bytes and the previous carry
        let (sum, c1) = a[i].overflowing_add(carry_bits[i - 1] as u8);
        let (sum, c2) = sum.overflowing_add(b[i]);
        // There can't be 2 carry in: a + b + carry, either c1 or c2 is true.
        carry_bits[i] = c1 || c2;
        sum_bytes[i] = sum;
    }
    (sum_bytes, carry_bits)
}

/// Computes the byte-wise subtraction `x - y` with borrow bits across a 4-byte word.
pub fn subtract_with_borrow(x: Word, y: Word) -> (Word, BoolWord) {
    let mut diff_bytes = [0u8; WORD_SIZE];
    let mut borrow_bits: BoolWord = [false; WORD_SIZE];

    let (diff, b0) = x[0].overflowing_sub(y[0]);
    borrow_bits[0] = b0;
    diff_bytes[0] = diff;

    // Process the remaining difference bytes
    for i in 1..WORD_SIZE {
        // Subtract the bytes and the previous borrow
        let (diff, b1) = x[i].overflowing_sub(borrow_bits[i - 1] as u8);
        let (diff, b2) = diff.overflowing_sub(y[i]);

        // There can't be 2 borrow in: a - b - borrow, either b1 or b2 is true.
        borrow_bits[i] = b1 || b2;
        diff_bytes[i] = diff;
    }
    (diff_bytes, borrow_bits)
}

/// Performs x - 1 - y, returning the result and the borrow bits
///
/// Note that for - 1 - y, for every limb, just one borrow bit suffices
pub fn decr_subtract_with_borrow(x: Word, y: Word) -> (Word, BoolWord) {
    let (diff, borrow1) = subtract_with_borrow(x, 1u32.to_le_bytes());
    let (diff, borrow2) = subtract_with_borrow(diff, y);
    for i in 0..WORD_SIZE {
        assert!(!borrow1[i] || !borrow2[i]);
    }
    let borrow = std::array::from_fn(|i| borrow1[i] | borrow2[i]);
    (diff, borrow)
}

/// Splits a 32-bit unsigned integer into two 16-bit limbs in little-endian order.
pub fn u32_to_16bit_parts_le(a: u32) -> [u16; 2] {
    let mask = (1 << 16) - 1;
    [(a & mask) as u16, ((a >> 16) & mask) as u16]
}

/// Adds a value to the lower part of a half-word, returns a carry flag along with result.
pub fn add_16bit_with_carry(a: [u16; 2], i: u16) -> ([u16; 2], bool) {
    assert!(i == 1 || i == WORD_SIZE as u16);

    let (low, carry) = a[0].overflowing_add(i);
    let high = a[1] + u16::from(carry);

    ([low, high], carry)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_16bit_conversion() {
        for (a, expected) in [
            (0, [0, 0]),
            ((0xFFFF_FFFF), [0xFFFF, 0xFFFF]),
            ((0xFFFF_0000), [0x0000, 0xFFFF]),
            ((0x1234_5678), [0x5678, 0x1234]),
            ((0x0000_0001), [0x0001, 0x0000]),
        ] {
            assert_eq!(u32_to_16bit_parts_le(a), expected);
        }
    }

    #[test]
    fn test_increment_16bit() {
        for a in [0, 0xF, 0xFF, 0xFFFF, 0xFFFFF, 0xFFFAF] {
            let a_parts = u32_to_16bit_parts_le(a);
            let a_inc = a + 1;
            let expected = u32_to_16bit_parts_le(a_inc);

            let (result, carry) = add_16bit_with_carry(a_parts, 1);
            assert_eq!(result, expected);
            assert_eq!(carry, a_parts[0] == u16::MAX);
        }
    }

    #[test]
    fn test_add_word_16bit() {
        for a in [0, 0xF, 0xFF, 0xFFFF, 0xFFFFF, 0xFFFAF, 0xFFFB] {
            let a_parts = u32_to_16bit_parts_le(a);
            let a_inc = a + WORD_SIZE as u32;
            let expected = u32_to_16bit_parts_le(a_inc);

            let (result, carry) = add_16bit_with_carry(a_parts, WORD_SIZE as u16);

            assert_eq!(result, expected);
            assert_eq!(carry, a_parts[0] > u16::MAX - WORD_SIZE as u16);
        }
    }
}

```

### Core Architecture Module: `prover2/trace/src/utils.rs`
```
use num_traits::Zero;
use rayon::iter::{IndexedParallelIterator, IntoParallelIterator, ParallelIterator};
use stwo::{
    core::fields::m31::BaseField,
    prover::backend::simd::{column::BaseColumn, SimdBackend},
};

use nexus_common::constants::WORD_SIZE;

pub use stwo::prover::backend::ColumnOps;
use stwo_constraint_framework::EvalAtRow;

use super::{
    program::{Word, WordWithEffectiveBits},
    utils_external::coset_order_to_circle_domain_order,
};

/// Trait for BaseField representation
pub trait IntoBaseFields<const N: usize> {
    fn into_base_fields(self) -> [BaseField; N];
}

impl IntoBaseFields<1> for bool {
    fn into_base_fields(self) -> [BaseField; 1] {
        [BaseField::from(self as u32)]
    }
}

impl IntoBaseFields<1> for u8 {
    fn into_base_fields(self) -> [BaseField; 1] {
        [BaseField::from(self as u32)]
    }
}

impl<const N: usize> IntoBaseFields<{ N }> for [bool; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        std::array::from_fn(|i| BaseField::from(self[i] as u32))
    }
}

impl<const N: usize> IntoBaseFields<{ N }> for [u8; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        std::array::from_fn(|i| BaseField::from(self[i] as u32))
    }
}

impl<const N: usize> IntoBaseFields<{ N }> for [u16; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        std::array::from_fn(|i| BaseField::from(self[i] as u32))
    }
}

impl<const N: usize> IntoBaseFields<N> for [BaseField; N] {
    fn into_base_fields(self) -> [BaseField; N] {
        self
    }
}

impl IntoBaseFields<{ WORD_SIZE }> for WordWithEffectiveBits {
    fn into_base_fields(self) -> [BaseField; WORD_SIZE] {
        self.0.into_base_fields()
    }
}

impl IntoBaseFields<{ WORD_SIZE }> for u32 {
    fn into_base_fields(self) -> [BaseField; WORD_SIZE] {
        let bytes = self.to_le_bytes();
        std::array::from_fn(|i| BaseField::from(bytes[i] as u32))
    }
}

impl IntoBaseFields<1> for BaseField {
    fn into_base_fields(self) -> [BaseField; 1] {
        [self]
    }
}

/// Trait for reading Basefields
pub trait FromBaseFields<const N: usize> {
    fn from_base_fields(elms: [BaseField; N]) -> Self;
}

impl FromBaseFields<WORD_SIZE> for Word {
    fn from_base_fields(elms: [BaseField; WORD_SIZE]) -> Self {
        let mut ret = Word::default();
        for (i, b) in elms.iter().enumerate() {
            let read = b.0;
            assert!(read < 256, "invalid byte value");
            ret[i] = read as u8;
        }
        ret
    }
}

impl FromBaseFields<WORD_SIZE> for u32 {
    fn from_base_fields(elms: [BaseField; WORD_SIZE]) -> Self {
        let bytes = Word::from_base_fields(elms);
        u32::from_le_bytes(bytes)
    }
}

pub fn finalize_columns(columns: Vec<Vec<BaseField>>) -> Vec<BaseColumn> {
    let mut ret = Vec::with_capacity(columns.len());
    columns
        .into_par_iter()
        .map(|col| {
            let eval = coset_order_to_circle_domain_order(col.as_slice());
            let mut base_column = BaseColumn::from_iter(eval);
            <SimdBackend as ColumnOps<BaseField>>::bit_reverse_column(&mut base_column);
            base_column
        })
        .collect_into_vec(&mut ret);
    ret
}

/// Extracts the lower `num_bits` of a value while preserving the sign bit,
/// does not perform full two's complement sign extension.
pub fn sign_extend(value: u32, num_bits: usize) -> u32 {
    let mask = (1 << num_bits) - 1;
    let lower_bits = value & mask;

    if value & (1 << (num_bits)) != 0 {
        // sign extend
        return lower_bits + (1 << num_bits);
    }

    lower_bits
}

pub fn zero_array<const N: usize, E: EvalAtRow>() -> [E::F; N] {
    std::array::from_fn(|_i| E::F::zero())
}

#[cfg(test)]
mod tests {
    use super::*;
    use stwo::core::{
        fields::m31::M31,
        utils::{bit_reverse_index, coset_index_to_circle_domain_index},
    };

    #[test]
    fn test_order() {
        let log_size = 3;
        let vals: Vec<M31> = (0..1 << log_size).map(M31::from).collect();
        let reordered = coset_order_to_circle_domain_order(&vals);
        let mut col = BaseColumn::from_iter(reordered.clone());
        <SimdBackend as ColumnOps<BaseField>>::bit_reverse_column(&mut col);

        for (i, reordered) in col.as_slice().iter().enumerate().take(1 << log_size) {
            let idx = bit_reverse_index(coset_index_to_circle_domain_index(i, log_size), log_size);
            assert_eq!(reordered, &vals[idx]);
        }
    }

    #[test]
    fn test() {
        let a = 0u32.wrapping_sub(8);
        let b = sign_extend(a, 12);
        assert_eq!(b, 0b1111_1111_1000 + (1 << 12));
        assert_eq!(sign_extend(2047, 12), 2047);

        let a = 0u32.wrapping_sub(30000);
        let b = sign_extend(a, 16);
        assert_eq!(b, 0b1000_1010_1101_0000 + (1 << 16));

        assert_eq!(sign_extend(524287, 20), 524287);
    }
}

```

### Core Architecture Module: `prover2/trace/src/utils_external.rs`
```
// Copyright 2024 StarkWare Industries Ltd.
// Copyright 2024-2025 Nexus Laboratories, Ltd.
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

// The code below was copied from
// https://github.com/starkware-libs/stwo/blob/f7871979e6ea8e606dc4674301b7d8b28b5838ed/crates/prover/src/core/utils.rs#L108
// and since then modified.

use rayon::iter::{IndexedParallelIterator, IntoParallelIterator, ParallelIterator};
use stwo::core::fields::Field;

// TODO: patch upstream to make it public and remove / or use pub methods from tests.
pub fn coset_order_to_circle_domain_order<F: Field>(values: &[F]) -> Vec<F> {
    let mut ret = Vec::with_capacity(values.len());
    let n = values.len();
    let half_len = n / 2;

    (0..half_len)
        .into_par_iter()
        .map(|i| values[i << 1])
        .chain(
            (0..half_len)
                .into_par_iter()
                .map(|i| values[n - 1 - (i << 1)]),
        )
        .collect_into_vec(&mut ret);
    ret
}

```

### Core Architecture Module: `sdk/src/legacy/ark_serialize_utils.rs`
```
// see: https://github.com/arkworks-rs/algebra/issues/178#issuecomment-1413219278
use ark_serialize::{CanonicalDeserialize, CanonicalSerialize, Compress, Validate};

pub(crate) fn ark_se<S, A: CanonicalSerialize>(a: &A, s: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let mut bytes = vec![];
    a.serialize_with_mode(&mut bytes, Compress::Yes)
        .map_err(serde::ser::Error::custom)?;
    s.serialize_bytes(&bytes)
}

pub(crate) fn ark_de<'de, D, A: CanonicalDeserialize>(data: D) -> Result<A, D::Error>
where
    D: serde::de::Deserializer<'de>,
{
    let s: Vec<u8> = serde::de::Deserialize::deserialize(data)?;
    let a = A::deserialize_with_mode(s.as_slice(), Compress::Yes, Validate::Yes);
    a.map_err(serde::de::Error::custom)
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

**File**: `prover/src/chips/instructions/i/syscall.rs` (modified, +1/-2)
```diff
@@ -71,8 +71,7 @@ impl MachineChip for SyscallChip {
             (0x405, None) => traces.fill_columns(row_idx, true, Column::IsSysMemoryAdvise),
             _ => {
                 panic!(
-                    "Unknown syscall number: 0x{:x} and result: {:?}, on row {}",
-                    syscall_number, result, row_idx
+                    "Unknown syscall number: 0x{syscall_number:x} and result: {result:?}, on row {row_idx}"
                 );
             }
         };
```

**File**: `prover/src/chips/instructions/m/nexani.rs` (modified, +2/-2)
```diff
@@ -173,7 +173,7 @@ pub(super) fn mull_limb(b: u32, c: u32) -> MulResult {
     let (a23, carry_1) = (a23 as u16, (a23 >> 16));
 
     // Verify our calculations match the built-in multiplication
-    assert!(carry_1 < 5, "Carry_1 exceeds expected bounds {}", carry_1);
+    assert!(carry_1 < 5, "Carry_1 exceeds expected bounds {carry_1}");
     assert_eq!(
         a01.to_le_bytes(),
         [a_l_bytes[0], a_l_bytes[1]],
@@ -217,7 +217,7 @@ pub(super) fn mull_limb(b: u32, c: u32) -> MulResult {
         .wrapping_add((c3_prime_prime) << 8);
     let (a45, carry_2) = (a45 as u16, (a45 >> 16));
 
-    assert!(carry_2 < 4, "Carry_2 exceeds expected bounds {}", carry_2);
+    assert!(carry_2 < 4, "Carry_2 exceeds expected bounds {carry_2}");
 
     // Bytes 6-7 of the final result
     let a67 = (z3 as u32)
```

**File**: `prover/src/chips/memory_check/register_mem_check.rs` (modified, +1/-4)
```diff
@@ -412,10 +412,7 @@ fn fill_prev_values(
     let cur_value = u32::from_base_fields(reg_value);
     assert!(
         reg_idx != 0 || cur_value == 0,
-        "writing non-zero to X0, reg_idx: {}, cur_value: {}, row_idx: {}",
-        reg_idx,
-        cur_value,
-        row_idx
+        "writing non-zero to X0, reg_idx: {reg_idx}, cur_value: {cur_value}, row_idx: {row_idx}"
     );
     let AccessResult {
         prev_timestamp,
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
             #[cfg(not(target_arch = "riscv32"))]
@@ -272,12 +278,21 @@ pub(crate) fn handle_input(
     };
 
     // Build the output token stream
-    let expanded = quote! {
-        #target_check
-        #(#attrs)*
-        fn #fn_name(#input_sig) #output {
-            let (#(#inputs),*):(#(#types),*) = #input_handler().expect("Failed to read public input");
-            #block
+    let expanded = {
+        let error_msg = match input_type {
+            InputType::Public => "Failed to read public input",
+            InputType::Private => "Failed to read private input",
+            InputType::Custom => "Failed to read input",
+        };
+        quote! {
+            #target_check
+            #(#attrs)*
+            fn #fn_name(#input_sig) #output {
+                let (#(#inputs),*):(#(#types),*) = #input_handler().unwrap_or_else(|e| {
+                    panic!("{}: {:?}", #error_msg, e);
+                });
+                #block
+            }
         }
     };
 
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
+        assert_eq!(heap_size, 0);
+    }
+}
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

---

### Incident Patch 11: `29847b75` (2025-09-30)
**Commit Message**: fix(macros): silence unused imm param in InstructionEmitter impl (#484)

**File**: `precompiles/macros/src/generation.rs` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ pub(crate) fn generate_instruction_impls(paths: &[PrecompilePath]) -> TokenStrea
             quote! {
                 impl InstructionEmitter for #path {
                     #[inline(always)]
-                    fn emit_instruction(rs1: u32, rs2: u32, imm: u32) -> u32 {
+                    fn emit_instruction(rs1: u32, rs2: u32, _imm: u32) -> u32 {
                         #[cfg(target_arch = "riscv32")] {
                             let mut rd: u32;
                             unsafe {
```

---

### Incident Patch 12: `f33bbbca` (2025-09-24)
**Commit Message**: fix(testing): record Linear emulator cycles after execution (#479)

**File**: `common-testing/src/emulator.rs` (modified, +1/-1)
```diff
@@ -304,8 +304,8 @@ pub fn emulate(
                     &public_input_bytes,
                     &private_input_bytes,
                 );
-                cycles.push(emulator.executor.global_clock);
                 let _ = emulator.execute(false);
+                cycles.push(emulator.executor.global_clock);
 
                 let view = emulator.finalize();
                 exit_code_bytes = view
```

---

### Incident Patch 13: `b0ae78e9` (2025-09-24)
**Commit Message**: Fix mixed-base range in Alignable tests (use 0x1001..0x1005) (#478)

**File**: `common/src/memory/alignment.rs` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ mod tests {
     fn test_alignable() {
         // Test `word_align`
         #[allow(clippy::reversed_empty_ranges)] // absurd false positive
-        for i in 0x1001..1005 {
+        for i in 0x1001..0x1005 {
             assert_eq!((i as u32).word_align(), 0x1004);
             assert_eq!((i as usize).word_align(), 0x1004);
         }
```

---

### Incident Patch 14: `41e1801c` (2025-09-10)
**Commit Message**: fix: docs fill N columns with value convertible into base fields (#468)

**File**: `prover2/trace/src/builder.rs` (modified, +3/-3)
```diff
@@ -47,7 +47,7 @@ impl<C: AirColumn> TraceBuilder<C> {
     }
 
     /// Returns a copy of `N` raw columns in range `[offset..offset + N]` at `row`, where
-    /// `N` is assumed to be equal `Column::size` of a `col`.
+    /// `N` must equal `col.size()`.
     pub fn column<const N: usize>(&self, row: usize, col: C) -> [BaseField; N] {
         assert_eq!(col.size(), N, "column size mismatch");
 
@@ -57,7 +57,7 @@ impl<C: AirColumn> TraceBuilder<C> {
     }
 
     /// Returns mutable reference to `N` raw columns in range `[offset..offset + N]` at `row`,
-    /// where `N` is assumed to be equal `Column::size` of a `col`.
+    /// where `N` must equal `col.size()`.
     pub fn column_mut<const N: usize>(&mut self, row: usize, col: C) -> [&mut BaseField; N] {
         assert_eq!(col.size(), N, "column size mismatch");
 
@@ -68,7 +68,7 @@ impl<C: AirColumn> TraceBuilder<C> {
         })
     }
 
-    /// Fills four columns with u32 value.
+    /// Fills N columns with a value convertible into base fields.
     pub fn fill_columns<const N: usize, T: IntoBaseFields<N>>(
         &mut self,
         row: usize,
```

---

### Incident Patch 15: `a27683f8` (2025-09-08)
**Commit Message**: fix(benchmarks): make native timing consistent and avoid rebuilds per iteration (#466)

**File**: `benchmarks/src/runner.rs` (modified, +18/-27)
```diff
@@ -9,7 +9,7 @@ use nexus_vm_prover::{prove, verify};
 use num_cpus;
 use postcard;
 use serde::{de::DeserializeOwned, Serialize};
-use std::{path::PathBuf, process::Command, time::Duration};
+use std::{path::PathBuf, process::Command};
 use sys_info;
 use sysinfo::System;
 
@@ -21,29 +21,10 @@ use crate::{
 const K: usize = 1;
 
 /// Executes and measures the native execution speed of a Rust program.
-fn measure_native_execution<T>(
-    path: &PathBuf,
-    public_input_bytes: &[u8],
-) -> (Duration, Duration, Duration)
+fn measure_native_execution<T>(path: &PathBuf, public_input_bytes: &[u8])
 where
     T: DeserializeOwned + Serialize + std::fmt::Display,
 {
-    // Build with release optimizations.
-    let output = Command::new("cargo")
-        .current_dir(path)
-        .arg("build")
-        .arg("--release")
-        .output()
-        .expect("Failed to build project");
-
-    assert!(
-        output.status.success(),
-        "Native build failed: {}",
-        String::from_utf8_lossy(&output.stderr)
-    );
-
-    let timing_state = phase_start();
-
     // Simpler run process when no inputs are provided.
     let output = if public_input_bytes.is_empty() {
         Command::new("cargo")
@@ -77,10 +58,6 @@ where
     };
 
     assert!(output.status.success(), "Native execution failed");
-
-    let (total_time, user_time, sys_time, _) = phase_end(timing_state);
-
-    (total_time, user_time, sys_time)
 }
 
 /// Benchmarks a test program using specified emulator configuration.
@@ -118,12 +95,26 @@ pub fn run_benchmark<T>(
         compile_flags,
     );
 
+    // Build the native binary once (release) before measuring runs.
+    let build_output = Command::new("cargo")
+        .current_dir(&tmp_project_path)
+        .arg("build")
+        .arg("--release")
+        .output()
+        .expect("Failed to build project");
+    assert!(
+        build_output.status.success(),
+        "Native build failed: {}",
+        String::from_utf8_lossy(&build_output.stderr)
+    );
+
     // Measure native execution.
     let mut native_tracker = PhasesTracker::default();
     for _ in 0..iters {
         let timing_state = phase_start();
-        let native_duration = measure_native_execution::<T>(&tmp_project_path, &public_input).0;
-        let (_, native_user_time, native_sys_time, native_metrics) = phase_end(timing_state);
+        measure_native_execution::<T>(&tmp_project_path, &public_input);
+        let (native_duration, native_user_time, native_sys_time, native_metrics) =
+            phase_end(timing_state);
 
         native_tracker.update(
             &native_duration,
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
