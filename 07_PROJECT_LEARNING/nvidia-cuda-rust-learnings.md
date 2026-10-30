> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `76ac1021`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T09:15:14.649Z  
> **Learning ID**: `learn-github-nvidia-cuda-rust`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): NVIDIA/cuda-rust

---

## 1. Executive Forensic Architecture & System Mechanics

`NVIDIA/cuda-rust` establishes a production-grade compiler infrastructure and dual runtime execution environment targeting NVIDIA GPUs natively in Rust. The project is partitioned across two distinct compute philosophies:
1. **CUDA Oxide (`cuda-oxide`)**: An ahead-of-time (AOT) compiler backend running on a dedicated MLIR dialect infrastructure (`pliron` dialect-mir, `mir-lower`, `rustc-codegen-cuda`) targeting SIMT execution (Single Instruction, Multiple Threads). It produces PTX directly from Rust MIR while preserving register array residency and eliminating stack frame spillover into local memory (`.local`).
2. **CuTile (`cutile-rs`)**: A just-in-time (JIT) macro-driven tensor/tile programming model operating over ND-arrays and sub-tensor tiles, targeting Tile IR and compilation to cubin on compute architecture sm_90+ (Hopper/Blackwell).

```
+--------------------------------------------------------------------------------------------------+
|                                           CUDA RUST                                              |
+--------------------------------------------------------------------------------------------------+
| HOST RUNTIME LAYER                                                                               |
|  cuda-bindings (Raw FFI, Driver loader) <---+--- cuda-core (RAII CUcontext, CUstream, MemPool)   |
|                                             +--- cuda-core-derive (DeviceCopy proc-macro)        |
|                                             +--- cuda-async (Stream graph reactor, futures)      |
+--------------------------------------------------------------------------------------------------+
| COMPILER ARCHITECTURES & IR PIPELINES                                                            |
|                                                                                                  |
| [SIMT Pipeline: cuda-oxide]                        [Tile Pipeline: cutile-rs]                    |
|   Rust Source AST (#[kernel], #[device])             Rust Source (Tile DSL)                      |
|            │ (cuda-macros AST pass)                           │ (cutile macro transform)          |
|            ▼                                                  ▼                                  |
|   Rustc Monomorphized MIR                            Tile IR AST / Tensor Slices                 |
|            │ (mir-importer)                                   │ (JIT Compiler / Driver)          |
|            ▼                                                  ▼                                  |
|   pliron MLIR Dialect (dialect-mir)                  Tile Assembly / cubin                       |
|   ├── Sparse Conditional Constant Prop (sccp)                 │                                  |
|   ├── Loop Canonicalization (hoist_header_constants)          │                                  |
|   └── Loop Unrolling Engine (induction, latch merge)          │                                  |
|            │ (mir-lower)                                      │                                  |
|            ▼                                                  ▼                                  |
|   llvm-export Dialect (Physical generic carrier)     NVIDIA Driver Execution                     |
|            │ (NVPTX Codegen)                                                                     |
|            ▼                                                                                     |
|   PTX Emission (.pragma "nounroll", register arrays)                                             |
+--------------------------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries & Abstractions

- **The Closed-World Carrier Storage Boundary (`mir-lower/packed_shared_local_storage`)**:
  GPU memory architecture enforces strict separation between generic 64-bit address spaces (`AS0`) and fast shared memory (`AS3` / `.shared`). Passing Rust aggregate values (structs, tuples, arrays) containing `AS3` pointers through local compiler-allocated frame variables (`alloca`) triggers undefined behavior if treated as native 64-bit pointers without target normalization. `cuda-oxide` implements a **Carrier Local Model**: semantic types keep their exact address space qualifiers, but compiler-owned physical storage rewrites the root and leaves into target-stable generic carrier pointers (`p0`). Projections (`field_addr`, `array_element_addr`) never deduce provenance from runtime values; instead, an offline whole-function reachability pass stamps private proof facts on the MIR nodes before lowering begins.
- **The Zero-Spill Loop Normalization Pipeline (`mir-transforms/unroll`)**:
  GPU register arrays (such as SIMD accumulators `[u32; 16]`) must reside strictly in physical registers (`$r0..$r255`). If a loop indexing such an array cannot be fully unrolled at compile time, the compiler must emit dynamically indexed pointer arithmetic, forcing the array into slow GPU local memory (`.local`). The pipeline uses `pliron`-based transformation passes: it injects Sparse Conditional Constant Propagation (`sccp`) before induction variable analysis, moves loop-invariant expressions into preheaders (`hoist_header_constants`), joins multi-branch latch targets into unified headers, and forces `.pragma "nounroll"` via `mir.nounroll_hint` when manual unrolling is prohibited.
- **Foreign Ownership & Driver RAII Lifecycle (`cuda-core/runtime`)**:
  Raw CUDA context handles (`CUcontext`) and stream handles (`CUstream`) lack native Rust lifetime guarantees. To bridge external Python/C++ handles (PyTorch, CuPy) without double-freeing or dropping resources in flight, `cuda-core` employs a type-erased `KeepAlive(Option<Arc<dyn ForeignOwner>>)` liveness token paired with atomic sticky-error accumulators and driver primary context reference counting (`cuDevicePrimaryCtxRetain` / `cuDevicePrimaryCtxRelease_v2`).

---

## 2. Net-New Universal Engineering Rules

### 1. Zero-Validity Invariant for Low-Level FFI Transmutations & GPU Allocators
**RULE**:
Types exposed to raw device-to-host memory blits, zeroed GPU allocations (`cuMemAlloc` + `cuMemset`), or kernel scalar argument decoding MUST uphold the **All-Zero Bit Pattern Validity Invariant** (`0x00...00` represents an inhabited, valid bit pattern in Rust). Types with restricted discriminant ranges (e.g., standard Rust `enum`, `bool`, `char`, `NonZeroU*`) MUST NOT implement raw memory copy traits without custom validation guards, and procedural derive macros MUST fail compilation if applied to non-product types.

**WHY**:
Kernel launch pipelines use `DeviceBuffer::zeroed` to reserve and clear GPU memory via synchronous or asynchronous driver `memset` operations. If a type containing an invalid null discriminant (such as `enum Foo { A = 1, B = 2 }` or `bool` whose valid bit range is strictly `0x00` and `0x01`) is read back across the FFI boundary via `to_host_vec` or direct pointer dereference, LLVM immediately assumes unreachable paths, generating instantaneous Undefined Behavior (UB), branch elisions, and memory corruption without emitting panics.

**WHEN TO APPLY**:
Any cross-boundary FFI, CUDA/Vulkan/Metal driver abstraction, shared-memory buffer manager, IPC ring buffer, or hardware register serialization layer.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In cuda-core-derive / src/device_copy.rs:
// Reject sum types (enums) at compile-time within the proc-macro derive.
pub fn impl_device_copy(input: &syn::DeriveInput, trait_path: proc_macro2::TokenStream) -> proc_macro2::TokenStream {
    let type_ident = &input.ident;
    match input.data {
        syn::Data::Struct(ref data_struct) => generate_field_assertions(data_struct, trait_path, type_ident),
        syn::Data::Union(ref data_union) => generate_union_assertions(data_union, trait_path, type_ident),
        syn::Data::Enum(_) => {
            syn::Error::new_spanned(
                type_ident,
                "DeviceCopy cannot be derived for enums: every bit pattern (including all-zero) \
                 must be valid to prevent undefined behavior when materializing device memory."
            ).to_compile_error()
        }
    }
}

// Generate zero-cost static trait boundary verification helpers:
fn generate_field_assertions(
    s: &syn::DataStruct, 
    trait_path: proc_macro2::TokenStream, 
    type_ident: &syn::Ident
) -> proc_macro2::TokenStream {
    let field_checks = s.fields.iter().map(|f| {
        let ty = &f.ty;
        quote::quote! { assert_device_copy::<#ty>(); }
    });
    
    quote::quote! {
        unsafe impl #trait_path for #type_ident {}
        
        #[doc(hidden)]
        #[allow(non_snake_case, dead_code)]
        fn __verify_device_copy_safety() {
            fn assert_device_copy<T: #trait_path>() {}
            #(#field_checks)*
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Blindly implementing POD/Copy traits on Enums or NonZero primitives
pub enum BadGpuStatus {
    Success = 1,
    Failure = 2,
}

// Catastrophic: DeviceBuffer::<BadGpuStatus>::zeroed() writes 0x00.
// Reading this into host memory materializes an invalid discriminant, triggering LLVM branch miscompilation!
unsafe impl DeviceCopy for BadGpuStatus {} 
```

**VERIFICATION METHOD**:
Enforce compile-fail integration suites using `trybuild`:
```rust
#[test]
fn compile_fail_enum_device_copy() {
    let t = trybuild::TestCases::new();
    t.compile_fail("tests/compile_fail/derive_enum_device_copy.rs");
}
```

---

### 2. Multi-Dialect Pre-Analysis Constant Hoisting & Normalization
**RULE**:
Before invoking loop induction variable analysis or unroll engines in an optimizing compiler pipeline, the transformation driver MUST execute Sparse Conditional Constant Propagation (`SCCP`) and MUST hoist compile-time constants out of loop headers into preheaders. Analyses MUST NOT assume constant operands originate solely from native dialect constant ops; they MUST query both core language constants and synthetic constants materialized by downstream folding engines.

**WHY**:
Global Value Numbering (GVN) and common subexpression elimination deduplicate loop bounds (such as `N / 8` where `N` is a const generic parameter). When a nested loop reads the bound, GVN places the computation in the *outermost dominating loop header*. If constant folding runs after unrolling or induction analysis, the outer loop is rejected because "the loop header defines a value consumed by the body." Furthermore, if induction analysis only recognizes dialect-specific constants (`mir.constant`) and ignores generic builder constants (`builtin.constant`), the loop bound is marked "runtime only," preventing full unroll and forcing register arrays into GPU local memory (`.local`).

**WHEN TO APPLY**:
Compiler backends, JIT pipelines, MLIR transformation engines, and AST loop unrollers targeting strict register architectures (GPUs, DSPs).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In mir-transforms/src/canonicalize.rs & unroll.rs
pub(crate) fn hoist_header_constants(
    ctx: &mut Context,
    info: &LoopInfo,
    id: LoopId,
    preheader: Ptr<BasicBlock>,
) -> bool {
    let header = info.loops()[id].header;
    let Some(anchor) = preheader.deref(ctx).get_terminator(ctx) else {
        return false;
    };

    // Filter operations that represent pure constants from any dialect
    let constants: Vec<Ptr<Operation>> = header
        .deref(ctx)
        .iter(ctx)
        .filter(|&op| {
            Operation::get_op::<MirConstantOp>(op, ctx).is_some()
                || Operation::get_op::<ConstantOp>(op, ctx).is_some()
        })
        .collect();

    // Relocate them to the preheader anchor to prevent invalid loop-carried dependencies
    for &op in &constants {
        op.unlink(ctx);
        op.insert_before(ctx, anchor);
    }
    !constants.is_empty()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Querying only importer-specific constant ops without prior SCCP folding
pub(crate) fn bad_induction_trip_count(ctx: &Context, v: Value) -> Option<i128> {
    let def = v.defining_op()?;
    // BUGS: Misses builtin.constant created by SCCP!
    // Fails on folded const generic division (N / 8)!
    let c = Operation::get_op::<MirConstantOp>(def, ctx)?; 
    Some(c.get_attr_value(ctx)?.value().to_i128())
}
```

**VERIFICATION METHOD**:
Verify that intermediate IR generated for const-generic nested loops emits zero `.local` memory operations:
```bash
# Automated PTX shape assertion:
cargo oxide build --example unroll_smoke
python3 -c '
import re, sys
ptx = open("target/ptx/unroll_smoke.ptx").read()
assert not re.search(r"(\.local\b|ld\.local|st\.local)", ptx), "Local memory leak detected!"
'
```

---

### 3. Closed-World Lowering Invariant for Non-Standard Address Spaces
**RULE**:
When lowering complex aggregate types across hardware-specific address spaces (e.g., CUDA `AS3` shared memory), compilers MUST NOT rely on local type conversion or deduce carrier storage types ad-hoc from converted operands. Lowering MUST execute a global, pre-pass reachability analysis over the entire function graph, verifying every consumer. If and only if the full address-use graph is valid, physical lowering attributes MUST be committed transactionally. Any untracked operation (indirect branch, unmodeled cast, raw pointer arithmetic) MUST fail closed before generating backend IR.

**WHY**:
GPU architectures impose distinct physical bitwidths and ABI constraints on pointers depending on their address space (e.g., 32-bit offset inside `.shared` space vs 64-bit generic pointer). Allowing an `AS3` pointer to pass through a local struct projection without verified, synchronized layout transforms leads to LLVM type-mismatch assertion crashes or, worse, miscalculated `GetElementPtr` byte offsets that silently overwrite adjacent shared memory partitions.

**WHEN TO APPLY**:
Hardware compilers, embedded systems targeting banked SRAM/TCM, graphics shaders, and heterogeneous accelerators.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In mir-lower/src/packed_shared_local_storage.rs
#[derive(Default)]
pub struct CarrierFactPlan {
    storage_types: Vec<(Ptr<Operation>, TypeHandle)>,
    gep_source_types: Vec<(Ptr<Operation>, TypeHandle)>,
    projection_alignments: Vec<(Ptr<Operation>, u32)>,
}

impl CarrierFactPlan {
    pub fn commit(self, ctx: &mut Context) {
        for (op, ty) in self.storage_types {
            op.deref_mut(ctx).set_attr(CARRIER_STORAGE_TYPE_KEY, TypeAttr::new(ty));
        }
        for (op, ty) in self.gep_source_types {
            op.deref_mut(ctx).set_attr(CARRIER_GEP_SOURCE_TYPE_KEY, TypeAttr::new(ty));
        }
        for (op, align) in self.projection_alignments {
            llvm_export::ops::set_address_alignment(ctx, op, align);
        }
    }
}

// Closed-world validation pass:
pub fn validate_and_plan_carrier_storage(ctx: &Context, func: Ptr<Operation>) -> Result<CarrierFactPlan, CompileError> {
    let mut plan = CarrierFactPlan::default();
    for op in func.deref(ctx).iter_all_ops() {
        if is_carrier_address_use(op, ctx) {
            if !is_provably_safe_projection(op, ctx) {
                // FAIL CLOSED: Never attempt partial fallback lowering!
                return Err(CompileError::UnsafeCarrierEscape(op));
            }
            plan.record_safe_fact(op, ctx);
        }
    }
    Ok(plan)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Speculatively recovering carrier properties during lowering
pub fn convert_gep(ctx: &mut Context, op: Ptr<Operation>) -> Result<()> {
    // ANTI-PATTERN: Inferring parent physical carrier layout from an incoming LLVM operand!
    let incoming_ptr = op.deref(ctx).get_operand(0);
    let inferred_type = incoming_ptr.get_type(ctx); 
    // If incoming_ptr was converted from another dialect pass, this pointer 
    // now lacks AS3 provenance, leading to incorrect stride and memory corruption.
}
```

**VERIFICATION METHOD**:
Automated IR verifier that asserts carrier-annotated ops contain verified physical attributes:
```rust
#[test]
fn test_carrier_lowering_fails_closed_on_unmodeled_use() {
    let mut ctx = Context::default();
    let module = build_invalid_carrier_escape_module(&mut ctx);
    let result = validate_and_plan_carrier_storage(&ctx, module);
    assert!(result.is_err(), "Must reject unmodeled carrier escape");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unrolled Const-Generic Bounds Register Spill Regression (BUG-CRUST-01)
- **Context**: `cuda-oxide/crates/mir-transforms/src/analyses/induction.rs`, `canonicalize.rs`, `unroll.rs`
- **What Was Expected**: Annotating a loop bounded by a const-generic division (e.g., `while j < N / 8`) with `#[unroll]` must compute the trip count at compile time, unroll the loop entirely, and preserve the index accumulator array in GPU registers (`$r0..$r31`).
- **What Actually Happened**: The induction analysis warned that the trip count was "only known at runtime" and left the loop rolled. The array variable was spilled to GPU local memory (`.local` space via `st.local`/`ld.local`), degrading memory throughput by orders of magnitude. In nested loops, rustc's GVN placed the folded constant in the outer loop's header block, causing the outer loop to be rejected with: `"the header computes a value the body reads"`.
- **Evidence in Repo**: Commit `f3fb10f0`, PR #1569, Issue #1494.
- **Root Cause**: Two coupled defects:
  1. `induction::const_i128` inspected only direct `MirConstantOp` instructions. Monomorphized const-generic expressions arrive as `MirDivOp` operations. When SCCP folded them, it produced `pliron::builtin::ops::ConstantOp`, which was ignored by `const_i128`.
  2. GVN hoisted `N / 8` once into the outer loop header, which unroller validity checks specifically prohibit.
- **Remediation Code Diff**:
```rust
// mir-transforms/src/analyses/induction.rs
-    let c = Operation::get_op::<MirConstantOp>(def, ctx)?;
-    let attr = c.get_attr_value(ctx)?;
+    let value = if let Some(c) = Operation::get_op::<MirConstantOp>(def, ctx) {
+        c.get_attr_value(ctx)?.value()
+    } else {
+        let c = Operation::get_op::<ConstantOp>(def, ctx)?;
+        let attr = c.get_value(ctx);
+        (&*attr as &dyn Attribute)
+            .downcast_ref::<IntegerAttr>()?
+            .value()
+    };

// mir-transforms/src/unroll.rs
+    // Run SCCP before analyzing loop trip count
+    if sccp(func_op, ctx)? == IRStatus::Changed {
+        function_changed = true;
+        changed = true;
+    }
...
+    // Hoist folded constants out of loop headers into preheaders
+    if hoist_header_constants(ctx, &info, loop_id, ph) {
+        function_changed = true;
+        changed = true;
+    }
```
- **Lesson**: In multi-dialect compilers, constant evaluation passes must precede analysis passes, and all consumers must accept synthetic constant nodes materialized by external dialect optimizers.

---

### Incident 2: Miscompiled Packed-AS3 Shared Memory Struct Projections (BUG-CRUST-02)
- **Context**: `cuda-oxide/crates/mir-lower/src/convert/ops/aggregate/carrier_field_addr.rs`, `addressing.rs`, `packed_shared_local_storage.rs`
- **What Was Expected**: Structs and tuples containing recursive `AS3` shared pointers inside arrays or nested sub-structs must maintain their exact byte offsets and verified memory alignments during lowering to LLVM `GetElementPtr` (`inbounds`).
- **What Actually Happened**: Nested structs, fixed arrays with `AS3` leaves, and element projections caused the lowerer to crash or fall back to standard `GEP` inference. This inferred non-packed alignments, causing misaligned memory accesses or generating non-power-of-two `align N` instructions in LLVM IR, which `llc` rejected.
- **Evidence in Repo**: Commit `023f2ac3`, PR #1330, Issue #1094.
- **Root Cause**: `convert_field_addr` assumed carrier roots were strictly non-nested structs. When encountering nested structs or arrays, the calculated stride fell back to the semantic element's natural ABI alignment, which is completely invalid when an array or field is embedded at an underaligned packed offset.
- **Remediation Code Diff**:
```rust
// mir-lower/src/convert/ops/aggregate/addressing.rs
+pub(crate) fn field_alignment_from_base(base_align: u64, offset: u64) -> Option<u32> {
+    if base_align == 0 {
+        return None;
+    }
+    let provable = if offset == 0 {
+        base_align
+    } else {
+        gcd_alignment(base_align, offset)
+    };
+    if provable.is_power_of_two() {
+        u32::try_from(provable).ok()
+    } else {
+        None
+    }
+}
+
+fn gcd_alignment(mut a: u64, mut b: u64) -> u64 {
+    while b != 0 {
+        (a, b) = (b, a % b);
+    }
+    a
+}
```
- **Lesson**: Never claim or propagate an alignment that is not provably a power-of-two. When computing field or array-element alignments from base pointers, apply the greatest common divisor (GCD) over the base alignment and the byte offset.

---

### Incident 3: Float-to-Integer Cast Undefined Value/Poison Miscompilation (BUG-CRUST-03)
- **Context**: `cuda-oxide/crates/cuda-oxide-mlir-export/src/mir/core.rs`
- **What Was Expected**: Float-to-integer `as` casts in Rust must saturate on out-of-range values and convert `NaN` to `0`, matching canonical Rust runtime semantics.
- **What Actually Happened**: `CastTranslation::translate` lowered `MirCastKindAttr::FloatToInt` directly to MLIR `arith.fptosi` / `arith.fptoui`. On sm_120a hardware, MLIR's operations carry poison/UB semantics on overflow or `NaN`. Consequently:
  - `300.0f32 as u8` yielded `44` (wrapping lower 8 bits instead of saturating to `255`).
  - `128.0f32 as i8` yielded `-128` (instead of clamping to `127`).
  - `f32::NAN as i64` yielded `i64::MIN` (`-9223372036854775808` instead of `0`).
- **Evidence in Repo**: Issue #1642, PR #1655.
- **Root Cause**: The compiler backend erroneously used raw non-saturating arithmetic hardware instructions instead of Rust's language standard saturating conversion intrinsics.
- **Remediation Code Diff**:
```rust
// cuda-oxide-mlir-export/src/mir/core.rs
- // Lowered directly to arith.fptosi / arith.fptoui
+ // Lower to saturating LLVM intrinsics:
+ let intrinsic_name = match signedness {
+     Signedness::Signed => format!("llvm.fptosi.sat.i{dst_width}.f{src_width}"),
+     Signedness::Unsigned => format!("llvm.fptoui.sat.i{dst_width}.f{src_width}"),
+ };
+ // Call intrinsic via llvm.call_intrinsic
+ // Reject integer destinations wider than 64-bits explicitly.
+ if dst_width > 64 {
+     return Err(CompilationError::UnsupportedCastWidth(dst_width));
+ }
```
- **Lesson**: Hardware FPU instructions rarely match source language safety semantics for floating-point corner cases (`NaN`, overflow). Compilers must explicitly lower to saturating intrinsics or emit explicit clamping logic.

---

### Incident 4: Pointer Alignment Loss on 32-bit Integer Boundary (BUG-CRUST-04)
- **Context**: `cutile-compiler` / `DivHint::from_ptr`
- **What Was Expected**: Divisibility and memory alignment hint analysis must detect whether a memory pointer is aligned to 16 bytes for vectorized 128-bit memory instructions (`ld.global.v4`).
- **What Actually Happened**: Addresses whose low 32 bits equaled `0x8000_0000` returned negative alignment hints. This caused the alignment analysis to fail, dropping valid vectorization optimizations and degrading memory throughput.
- **Evidence in Repo**: Issue #1612, PR NVlabs/cutile-rs#244 (fixed in cutile 0.3.1).
- **Root Cause**: Pointer addresses were truncated to `i32` before computing the lowest set bit. At `0x8000_0000`, `val & val.wrapping_neg()` evaluated to `i32::MIN` (`-2147483648`). Calling `.min(16)` preserved the negative number, failing downstream `div > 1` checks.
- **Remediation Code Diff**:
```rust
// cutile-compiler/src/div_hint.rs
- fn from_ptr(ptr: u64) -> i32 {
-     let val = ptr as i32;
-     let raw = if val == 0 { 16 } else { val & val.wrapping_neg() };
-     raw.min(16)
- }
+ fn from_ptr(ptr: u64) -> u32 {
+     let raw = if ptr == 0 { 16 } else { 1u64 << ptr.trailing_zeros() };
+     raw.min(16) as u32
+ }
```
- **Lesson**: Pointers and hardware addresses must never be cast to signed integer types when computing alignment masks or bit operations. Always use unsigned integer types and explicit `.trailing_zeros()`.

---

### Incident 5: Driver Context Teardown and Primary Context Leaks (BUG-CRUST-05)
- **Context**: `cuda-core/src/runtime.rs`, `cuda-core/src/simt/context.rs`
- **What Was Expected**: Dropping a `Device` handle must cleanly release the CUDA primary context, flushing any pooled streams and unbinding thread-local driver state.
- **What Actually Happened**: If a thread dropped an owned `Device` while another thread or foreign framework held a stream open, calling `cuDevicePrimaryCtxRelease` destroyed the context prematurely. Conversely, pooled streams left in the global pool retained references to dead contexts, causing subsequent `Device::new()` calls to pop invalid, destroyed handles.
- **Evidence in Repo**: Commit `cuda-core/src/runtime.rs`, PR #1552 notes.
- **Root Cause**: Inadequate synchronization between the process-wide stream pool and individual RAII context drops, coupled with unhandled context thread-binding obligations before release calls.
- **Remediation Code Diff**:
```rust
// cuda-core/src/runtime.rs
impl Drop for Device {
    fn drop(&mut self) {
        if !self.owned {
            return;
        }
        let _guard = teardown_lock();
        // 1. Purge every pooled stream associated with this ordinal
        stream_pool()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&self.ordinal);
        
        // 2. Must bind context to calling thread before release call
        let _ = self.bind_to_thread();
        
        // 3. Atomically nullify context pointer to prevent double-drop
        let ctx = std::mem::replace(&mut self.cu_ctx, std::ptr::null_mut());
        if !ctx.is_null() {
            let _ = unsafe { primary_ctx::release(self.cu_device) };
        }
    }
}
```
- **Lesson**: RAII wrappers managing FFI context teardowns must purge global pools, guarantee thread affinity at drop time, and swap raw pointers to null atomically before invoking external C destructors.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Sign-Extension Hazard in Unsigned Constant Ingestion**:
  `pliron` / MLIR `APInt` stores arbitrary-width integers in signed representation. Calling `.to_i128()` on an unsigned 8-bit integer (e.g., `200u8`) sign-extends `0xC8` to `-56i128`. In loop induction analysis, this converts a trip count of 200 into a negative number, breaking loop bounds:
  ```rust
  // CORRECT INVARIANT:
  match ty.deref(ctx).signedness() {
      Signedness::Signed => Some(value.to_i128()),
      Signedness::Unsigned | Signedness::Signless => i128::try_from(value.to_u128()).ok(),
  }
  ```
- **Unchecked Power-of-Two LLVM Alignment Assertions**:
  LLVM enforces that all memory load/store/alloca alignment attributes MUST be positive powers of two. Rust types synthesized manually in dialect conversion (such as packed structs with 3-byte elements) can yield alignment offsets like `12`. Feeding `12` into `llvm_export::ops::set_address_alignment` triggers an immediate assertion abort in `llc`:
  ```rust
  // CORRECT INVARIANT:
  if provable.is_power_of_two() {
      u32::try_from(provable).ok()
  } else {
      None // Omit invalid non-power-of-two alignment
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **AST Loop Transformation Termination**:
  Proc-macro AST visitors that rewrite loops (`#[unroll]` -> inject `__unroll_config()`) must mutate expressions in-place. If an AST visitor inspects inner loop expressions recursively after prepending statements to the body without removing the outer macro attribute, it re-matches the attribute infinitely:
  ```rust
  // In cuda-macros/src/launch_attrs.rs:
  // Must remove attribute from vector during inspection!
  let idx = attrs.iter().position(|attr| attr.path().is_ident("nounroll"))?;
  let attr = attrs.remove(idx); // INVARIANT: Mutation breaks re-triggering recursion
  ```
- **Recursive Structural Type Bounds Checking**:
  Analyzing recursive packed structs containing pointer fields could cause stack overflow if mutually recursive types or self-referential aggregates enter the analysis. Type scanners must cap expansion depth and leaf budgets:
  ```rust
  pub(crate) const MAX_PACKED_SHARED_INTERNAL_ABI_ARRAY_REWRITE_LEAVES: u64 = 16;
  ```

### 3. UI & UX Micro-Mechanics (CLI & Compiler Diagnostic Reporting)
- **Accidental Terminal Error Silencing in Dynamic Loaders**:
  When dynamic linking of `libcuda.so` fails, the CUDA driver returns opaque error codes: `CUDA_ERROR_NOT_INITIALIZED` (3) or `CUDA_ERROR_SHARED_OBJECT_INIT_FAILED` (303). Formatting these directly produces useless strings like `DriverError(3)`. `cuda-core` inspects the internal dynload error cache and enriches the message with actionable remediation steps:
  ```rust
  // In cuda-core/src/error.rs:
  if self.0 == CUDA_ERROR_NOT_INITIALIZED || self.0 == CUDA_ERROR_SHARED_OBJECT_INIT_FAILED {
      return formatter.debug_tuple("DriverError")
          .field(&self.0)
          .field(&format!("CUDA driver library unavailable: {load_error}"))
          .finish();
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Asynchronous Deallocation TOCTOU Elimination**:
  When a stream-allocated GPU buffer (`DeviceBuffer`) is dropped, safe operations may still be in flight on other streams within the same context. Calling `cuMemFreeAsync` immediately on the buffer's allocation stream induces a time-of-check to time-of-use (TOCTOU) race condition with concurrent streams:
  ```rust
  // In cuda-core/src/simt/device_buffer.rs:
  impl<T> Drop for DeviceBuffer<T> {
      fn drop(&mut self) {
          if self.ptr != 0 {
              self.ctx.record_err(self.ctx.bind_to_thread());
              let result = match &self.dealloc_stream {
                  Some(stream) => {
                      // CRITICAL: Synchronize entire context to ensure cross-stream completions
                      // before queuing the asynchronous free!
                      match self.ctx.synchronize() {
                          Ok(()) => unsafe { crate::simt::memory::free_async(self.ptr, stream.cu_stream()) },
                          Err(err) => Err(err),
                      }
                  }
                  None => unsafe { crate::simt::memory::free_sync(self.ptr) },
              };
              self.ctx.record_err(result);
          }
      }
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **CUDA Device Ordinal Integer Truncation**:
  The CUDA driver expects `c_int` (signed 32-bit integer) for device ordinals. Rust code uses `usize`. A blind cast `ordinal as c_int` wraps large integers (e.g., `4294967296usize` -> `0`), silently binding the operation to GPU 0 instead of reporting an error:
  ```rust
  // In cuda-core/src/runtime.rs: