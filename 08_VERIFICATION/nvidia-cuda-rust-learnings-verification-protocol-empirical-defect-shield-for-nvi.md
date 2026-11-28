# Verification Protocol: Verification Protocol: Empirical Defect Shield for nvidia-cuda-rust-learnings

<!-- PROVENANCE_START
{
  "source_repository": "nvidia-cuda-rust-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T01:18:56.917Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nvidia-cuda-rust-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nvidia-cuda-rust-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T01:18:56.917Z`  
> **Learning ID**: `LEARN-EVO-nvidia-cuda-rust-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `nvidia-cuda-rust-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `8b91bb75`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T01:18:44.143Z  
> **Learning ID**: `learn-github-nvidia-cuda-rust`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): NVIDIA/cuda-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T01:18:43.981Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4112 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cuda-core-derive/src/device_copy.rs`
```
// SPDX-FileCopyrightText: Copyright (c) 2024-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! `#[derive(DeviceCopy)]` proc-macro.
//!
//! Emits the `unsafe impl DeviceCopy` plus a hidden field-type-check function
//! that fails to compile if any field is not itself `DeviceCopy`.

use proc_macro2::{Ident, Span, TokenStream};
use quote::quote;
use syn::{
    parse_str, Data, DataStruct, DataUnion, DeriveInput, Field, Fields, Generics, TypeParamBound,
};

pub fn impl_device_copy(input: &DeriveInput, import: TokenStream) -> TokenStream {
    let input_type = &input.ident;

    // Generate the code to type-check all fields of the derived struct/union. We can't perform
    // type checking at expansion-time, so instead we generate a dummy nested function with a
    // type-bound on DeviceCopy and call it with every type that's in the struct/union.
    // This will fail to compile if any of the nested types doesn't implement DeviceCopy.
    //
    // Enums need more than field checks: the all-zero representation must also
    // select a valid discriminant and payload. This derive does not analyze
    // enum layouts, so it conservatively rejects them. DeviceCopy does not
    // require every bit pattern to be valid (bool implements it); an enum with
    // a valid zero representation can have a manually justified unsafe impl.
    let check_types_code = match input.data {
        Data::Struct(ref data_struct) => type_check_struct(data_struct),
        Data::Union(ref data_union) => type_check_union(data_union),
        Data::Enum(_) => {
            return syn::Error::new_spanned(
                input_type,
                "`#[derive(DeviceCopy)]` cannot be applied to enums: this derive cannot \
                 prove that the all-zero representation selects a valid discriminant and \
                 payload. `DeviceCopy` requires byte-copyable values and a valid all-zero \
                 representation, but not validity of every bit pattern. If the enum meets \
                 the full safety contract, write `unsafe impl DeviceCopy for ... {}` by hand.",
            )
            .to_compile_error();
        }
    };

    // We need a function for the type-checking code to live in, so generate a complicated and
    // hopefully-unique name for that. The type identifier is used verbatim (not lowercased) so
    // distinct types differing only in case (e.g. `Foo` and `foo`) get distinct helper names
    // instead of colliding; the `non_snake_case` allow covers the casing.
    let type_test_func_name = format!("__verify_{input_type}_can_implement_devicecopy");
    let type_test_func_ident = Ident::new(&type_test_func_name, Span::call_site());

    // If the struct/enum/union is generic, we need to add the DeviceCopy bound to the generics
    // when implementing DeviceCopy.
    let generics = add_bound_to_generics(&input.generics, import.clone());
    let (impl_generics, type_generics, where_clause) = generics.split_for_impl();

    // Finally, generate the unsafe impl and the type-checking function.
    let generated_code = quote! {
        unsafe impl #impl_generics #import for #input_type #type_generics #where_clause {}

        #[doc(hidden)]
        #[allow(non_snake_case, dead_code, unused_variables)]
        fn #type_test_func_ident #impl_generics(value: &#input_type #type_generics) #where_clause {
            fn assert_impl<T: #import>() {}
            #check_types_code
        }
    };

    generated_code
}

fn add_bound_to_generics(generics: &Generics, import: TokenStream) -> Generics {
    let mut new_generics = generics.clone();
    let bound: TypeParamBound = parse_str(&quote! {#import}.to_string()).unwrap();

    for type_param in &mut new_generics.type_params_mut() {
        type_param.bounds.push(bound.clone())
    }

    new_generics
}

fn type_check_struct(s: &DataStruct) -> TokenStream {
    let checks = match s.fields {
        Fields::Named(ref named_fields) => {
            let fields: Vec<&Field> = named_fields.named.iter().collect();
            check_fields(&fields)
        }
        Fields::Unnamed(ref unnamed_fields) => {
            let fields: Vec<&Field> = unnamed_fields.unnamed.iter().collect();
            check_fields(&fields)
        }
        Fields::Unit => vec![],
    };
    quote!(
        #(#checks)*
    )
}

fn type_check_union(s: &DataUnion) -> TokenStream {
    let fields: Vec<&Field> = s.fields.named.iter().collect();
    let checks = check_fields(&fields);
    quote!(
        #(#checks)*
    )
}

fn check_fields(fields: &[&Field]) -> Vec<TokenStream> {
    fields
        .iter()
        .map(|field| {
            let field_type = &field.ty;
            quote! {assert_impl::<#field_type>();}
        })
        .collect()
}

```

### Core Architecture Module: `cuda-core-derive/src/lib.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! `#[derive(DeviceCopy)]` for `cuda_core::DeviceCopy`.
//!
//! Extracted from cuda-oxide's `cuda-macros` so the shared `cuda-core` can
//! re-export the derive next to the trait (the serde trait+derive pattern)
//! from a publishable crate.

mod device_copy;

use proc_macro::TokenStream;
use quote::quote;

/// Derive `cuda_core::DeviceCopy` for a type whose fields are all themselves
/// `DeviceCopy`.
#[proc_macro_derive(DeviceCopy)]
pub fn device_copy(input: TokenStream) -> TokenStream {
    let ast = syn::parse(input).unwrap();
    let code = device_copy::impl_device_copy(&ast, quote!(::cuda_core::DeviceCopy));
    code.into()
}

```

### Core Architecture Module: `cuda-core/src/allocation.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Shared allocation ownership, byte views, and in-flight access tracking.

use crate::{Context, DriverError, Stream};
use cuda_bindings::CUdeviceptr;
use std::sync::{Arc, Mutex};

/// A foreign allocation whose owner keeps both its memory and CUDA context alive.
///
/// # Safety
/// The pointer, byte extent, and context must remain stable and valid for the
/// owner's lifetime. The pointer must address at least `len_bytes` bytes in that
/// context. Per-operation exclusion from foreign accesses remains the obligation
/// of callers constructing typed views over this memory.
pub unsafe trait DeviceAllocation: Send + Sync + 'static {
    fn device_ptr(&self) -> CUdeviceptr;
    fn len_bytes(&self) -> usize;
    fn context(&self) -> Arc<Context>;
    fn device_id(&self) -> usize {
        self.context().ordinal()
    }
}

struct Access {
    id: u64,
    stream: usize,
    write: bool,
    recording: bool,
    completion: Option<Arc<crate::Event>>,
}

#[derive(Default)]
struct Accesses {
    next_id: u64,
    active: Vec<Access>,
}

impl Accesses {
    fn register(
        &mut self,
        stream: usize,
        write: bool,
        recording: bool,
    ) -> Result<u64, DriverError> {
        // A synchronous wait on another thread may have completed a retired
        // operation before the worker got to its lease. Do not report a stale
        // conflict in that case. Errors leave the exclusion intact.
        self.active
            .retain(|a| !matches!(a.completion.as_ref().map(|e| e.query()), Some(Ok(true))));
        if !recording
            && self
                .active
                .iter()
                .any(|a| !a.recording && a.stream != stream && (write || a.write))
        {
            return Err(DriverError(
                cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_READY,
            ));
        }
        let id = self.next_id.checked_add(1).ok_or(DriverError(
            cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE,
        ))?;
        self.next_id = id;
        self.active.push(Access {
            id,
            stream,
            write,
            recording,
            completion: None,
        });
        Ok(id)
    }
}

enum Owner {
    Synchronous,
    StreamOrdered(Arc<Stream>),
    Borrowed,
    Foreign(#[allow(dead_code)] Arc<dyn DeviceAllocation>),
}

struct Allocation {
    ptr: CUdeviceptr,
    bytes: usize,
    context: Arc<Context>,
    owner: Owner,
    accesses: Mutex<Accesses>,
}

impl Drop for Allocation {
    fn drop(&mut self) {
        if self.ptr == 0 || matches!(self.owner, Owner::Borrowed | Owner::Foreign(_)) {
            return;
        }
        let ptr = self.ptr;
        let context = self.context.clone();
        let allocation_stream = match &self.owner {
            Owner::StreamOrdered(s) => Some(s.clone()),
            _ => None,
        };
        // All safe users hold an independent access lease until completion.
        // Driver teardown is retired on a worker, never on the dropping thread.
        crate::completion::defer(move || {
            if let Err(error) = context.bind_to_thread() {
                context.record_err(Err::<(), _>(error));
                std::mem::forget((context, allocation_stream));
                return;
            }
            let result = if let Some(stream) = &allocation_stream {
                // SAFETY: the allocation is no longer accessed and the retained
                // stream is the one on which its allocation became valid.
                unsafe { crate::memory::free_async(ptr, stream.cu_stream()) }
            } else {
                // SAFETY: ownership of this synchronous allocation is unique.
                unsafe { crate::memory::free_sync(ptr) }
            };
            if let Err(error) = result {
                context.record_err(Err::<(), _>(error));
                std::mem::forget((context, allocation_stream));
            }
        });
    }
}

/// A byte view sharing an allocation owner and access tracker with every derived
/// typed buffer, tensor, and sliced view. Cloning does not copy device memory.
#[derive(Clone)]
pub struct RawDeviceBuffer {
    allocation: Arc<Allocation>,
    // Only user-visible views share this token. Completion leases retain the
    // allocation directly, so creating/dropping them cannot affect uniqueness.
    views: Arc<()>,
    offset: usize,
    len: usize,
}

impl std::fmt::Debug for RawDeviceBuffer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RawDeviceBuffer")
            .field("ptr", &self.cu_deviceptr())
            .field("len", &self.len)
            .field("context", &self.allocation.context)
            .finish_non_exhaustive()
    }
}

impl RawDeviceBuffer {
    fn new(ptr: CUdeviceptr, bytes: usize, context: Arc<Context>, owner: Owner) -> Self {
        assert!(
            ptr.checked_add(bytes as u64).is_some(),
            "device allocation extent overflows"
        );
        Self {
            allocation: Arc::new(Allocation {
                ptr,
                bytes,
                context,
                owner,
                accesses: Mutex::default(),
            }),
            views: Arc::new(()),
            offset: 0,
            len: bytes,
        }
    }

    /// Adopts a synchronous CUDA allocation.
    ///
    /// # Safety
    /// `ptr` must uniquely own `bytes` bytes allocated by `cuMemAlloc` in
    /// `context`, with no outstanding untracked accesses.
    pub unsafe fn from_raw_parts(ptr: CUdeviceptr, bytes: usize, context: Arc<Context>) -> Self {
        Self::new(ptr, bytes, context, Owner::Synchronous)
    }

    /// Adopts a stream-ordered CUDA allocation.
    ///
    /// # Safety
    /// `ptr` must uniquely own `bytes` bytes from `cuMemAllocAsync` or its pool
    /// variant on `stream`. The caller must establish allocation ordering for
    /// every use and retain the allocation through outstanding work.
    pub unsafe fn from_raw_parts_async(
        ptr: CUdeviceptr,
        bytes: usize,
        stream: Arc<Stream>,
    ) -> Self {
        Self::new(
            ptr,
            bytes,
            stream.context().clone(),
            Owner::StreamOrdered(stream),
        )
    }

    /// Borrows externally managed memory without taking ownership.
    ///
    /// # Safety
    /// Memory and context must outlive every derived view and queued use. No
    /// external access may conflict with accesses through this allocation.
    pub unsafe fn borrowed_from_raw_parts(
        ptr: CUdeviceptr,
        bytes: usize,
        context: Arc<Context>,
    ) -> Self {
        Self::new(ptr, bytes, context, Owner::Borrowed)
    }

    /// Retains an external owner and limits the logical view to `bytes` bytes.
    /// No CUDA calls are made, permitting metadata validation before submission.
    pub fn foreign(owner: Arc<dyn DeviceAllocation>, bytes: usize) -> Self {
        assert!(
            bytes <= owner.len_bytes(),
            "view exceeds foreign allocation"
        );
        Self::new(
            owner.device_ptr(),
            bytes,
            owner.context(),
            Owner::Foreign(owner),
        )
    }

    pub fn cu_deviceptr(&self) -> CUdeviceptr {
        self.allocation.ptr + self.offset as u64
    }
    pub fn len_bytes(&self) -> usize {
        self.len
    }
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
    pub fn context(&self) -> &Arc<Context> {
        &self.allocation.context
    }
    pub(crate) fn allocation_stream(&self) -> Option<&Arc<Stream>> {
        match &self.allocation.owner {
            Owner::StreamOrdered(stream) => Some(stream),
            _ => None,
        }
    }
    pub fn device_id(&self) -> usize {
        self.context().ordinal()
    }
    /// Identity of the owner/access tracker, unchanged across byte views.
    pub fn allocation_id(&self) -> usize {
        Arc::as_ptr(&self.allocation) as usize
    }

    /// Creates a bounds-checked view without changing allocation identity.
    pub fn slice_bytes(&self, offset: usize, bytes: usize) -> Result<Self, DriverError> {
        if offset.checked_add(bytes).is_none_or(|end| end > self.len) {
            return Err(DriverError(
                cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE,
            ));
        }
        Ok(Self {
            allocation: self.allocation.clone(),
            views: self.views.clone(),
            offset: self.offset + offset,
            len: bytes,
        })
    }

    /// Whether only this user-visible view owns the allocation. Completion leases
    /// do not count as user aliases; they still enforce in-flight exclusion.
    pub fn is_unique(&self) -> bool {
        Arc::strong_count(&self.views) == 1
    }

    /// Acquires an allocation-wide access, rejecting cross-stream conflicts.
    /// The returned lease must be retained until the submitted work completes.
    pub fn acquire(
        &self,
        stream: &Stream,
        write: bool,
        recording: bool,
    ) -> Result<AllocationLease, DriverError> {
        if self.context().as_ref() != stream.context().as_ref() {
            return Err(DriverError(
                cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_CONTEXT,
            ));
        }
        self.acquire_on_stream(stream.cu_stream() as usize, write, recording)
    }

    /// Registers bookkeeping for a known stream handle. This does not submit GPU
    /// work or grant permission to dereference pointers. Runtime adapters must
    /// separately validate the stream's context before submitting work.
    #[doc(hidden)]
    pub fn acquire_on_stream(
        &self,
        stream: usize,
        write: bool,
        recording: bool,
    ) -> Result<AllocationLease, DriverError> {
        let mut accesses = self
 
```

### Core Architecture Module: `cuda-core/src/api.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! High-level wrappers around CUDA driver API functions.
//!
//! Provides safe(r) Rust interfaces for initialization, kernel launch, memory
//! operations, device queries, and random number generation.

pub use cuda_bindings as sys;
use cuda_bindings::{
    cuDeviceGetAttribute, CUdevice, CUdevice_attribute,
    CUdevice_attribute_enum_CU_DEVICE_ATTRIBUTE_CLOCK_RATE,
    CUdevice_attribute_enum_CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR,
    CUdevice_attribute_enum_CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR,
};
use std::ffi::{c_int, c_uint, c_void};
use std::mem::{self, MaybeUninit};
use std::sync::Arc;

use crate::error::*;
use crate::runtime::Stream;

/// Initializes the CUDA driver API. Must be called before any other driver call.
///
/// # Safety
/// Caller must ensure CUDA is available and `flags` is valid (typically `0`).
pub unsafe fn init(flags: c_uint) -> Result<(), DriverError> {
    cuda_bindings::cuInit(flags).result()
}

/// Returns the API version associated with the given CUDA context.
///
/// # Safety
/// `ctx` must be a valid CUDA context handle.
pub unsafe fn api_version(ctx: cuda_bindings::CUcontext) -> Result<c_uint, DriverError> {
    let mut api_version = 0 as c_uint;
    unsafe { cuda_bindings::cuCtxGetApiVersion(ctx, &mut api_version) }.result()?;
    Ok(api_version)
}

/// Launches a CUDA kernel with the given grid/block dimensions and parameters.
///
/// # Safety
/// `f`, `stream`, and all pointers in `kernel_params` must be valid.
#[inline]
pub unsafe fn launch_kernel(
    f: cuda_bindings::CUfunction,
    grid_dim: (c_uint, c_uint, c_uint),
    block_dim: (c_uint, c_uint, c_uint),
    shared_mem_bytes: c_uint,
    stream: cuda_bindings::CUstream,
    kernel_params: &mut [*mut c_void],
) -> Result<(), DriverError> {
    cuda_bindings::cuLaunchKernel(
        f,
        grid_dim.0,
        grid_dim.1,
        grid_dim.2,
        block_dim.0,
        block_dim.1,
        block_dim.2,
        shared_mem_bytes,
        stream,
        kernel_params.as_mut_ptr(),
        std::ptr::null_mut(),
    )
    .result()
}

/// Launch with programmatic stream serialization enabled for this kernel.
/// The driver entry point is resolved at runtime; a missing entry point is
/// reported as unsupported. Ordinary launches keep using [`launch_kernel`].
///
/// # Safety
/// The ordinary launch contract applies. Additionally, this kernel must wait
/// for predecessor completion before dependent accesses, and work before that
/// wait must not race predecessor work. Neither kernel may require overlap.
/// All resources must outlive their last use by either kernel.
#[inline]
pub unsafe fn launch_kernel_pdl(
    f: cuda_bindings::CUfunction,
    grid_dim: (c_uint, c_uint, c_uint),
    block_dim: (c_uint, c_uint, c_uint),
    shared_mem_bytes: c_uint,
    stream: cuda_bindings::CUstream,
    kernel_params: &mut [*mut c_void],
) -> Result<(), DriverError> {
    let mut attribute = programmatic_launch_attribute();
    let config = cuda_bindings::CUlaunchConfig_st {
        gridDimX: grid_dim.0,
        gridDimY: grid_dim.1,
        gridDimZ: grid_dim.2,
        blockDimX: block_dim.0,
        blockDimY: block_dim.1,
        blockDimZ: block_dim.2,
        sharedMemBytes: shared_mem_bytes,
        hStream: stream,
        attrs: &mut attribute,
        numAttrs: 1,
    };
    // SAFETY: the caller supplies valid launch handles/arguments. The driver
    // copies config, attributes, and parameter values before returning.
    let result = unsafe {
        cuda_bindings::cuLaunchKernelEx(
            &config,
            f,
            kernel_params.as_mut_ptr(),
            std::ptr::null_mut(),
        )
    };
    if result == cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_FOUND {
        // There is no legacy launch with the requested overlap semantics.
        return Err(DriverError(
            cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_SUPPORTED,
        ));
    }
    result.result()
}

fn programmatic_launch_attribute() -> cuda_bindings::CUlaunchAttribute_st {
    // The bindings intentionally keep this union opaque across CTK versions.
    // CUDA's stable layout is id:u32 at 0, padding at 4, value union at 8.
    // programmaticStreamSerializationAllowed is an int at union offset zero.
    const {
        assert!(std::mem::size_of::<cuda_bindings::CUlaunchAttribute_st>() >= 12);
    }
    // SAFETY: all-zero is a valid bit pattern for this C attribute storage.
    let mut attribute = unsafe { std::mem::zeroed::<cuda_bindings::CUlaunchAttribute_st>() };
    // SAFETY: writes stay within the checked storage; unaligned writes avoid
    // depending on bindgen's opaque wrapper alignment.
    unsafe {
        let base = (&mut attribute as *mut cuda_bindings::CUlaunchAttribute_st).cast::<u8>();
        base.cast::<u32>().write_unaligned(
            cuda_bindings::CUlaunchAttributeID_enum_CU_LAUNCH_ATTRIBUTE_PROGRAMMATIC_STREAM_SERIALIZATION
        );
        base.add(8).cast::<i32>().write_unaligned(1);
    }
    attribute
}

#[cfg(test)]
mod pdl_attribute_tests {
    #[test]
    fn programmatic_launch_attribute_has_driver_abi_layout() {
        let attribute = super::programmatic_launch_attribute();
        // SAFETY: the helper initializes every byte of the opaque C storage.
        let bytes = unsafe {
            std::slice::from_raw_parts(
                (&attribute as *const cuda_bindings::CUlaunchAttribute_st).cast::<u8>(),
                std::mem::size_of_val(&attribute),
            )
        };
        let id = cuda_bindings::CUlaunchAttributeID_enum_CU_LAUNCH_ATTRIBUTE_PROGRAMMATIC_STREAM_SERIALIZATION;
        assert_eq!(&bytes[..4], &id.to_ne_bytes());
        assert_eq!(&bytes[8..12], &1i32.to_ne_bytes());
        assert!(bytes[4..8].iter().chain(&bytes[12..]).all(|b| *b == 0));
    }
}

/// Asynchronously allocates `num_bytes` of device memory on the given stream.
///
/// Driver failures (out of memory included) come back as `Err` for the
/// caller to handle; the returned pointer becomes valid once the allocation
/// executes in stream order.
///
/// # Safety
/// `stream` must be a valid, non-destroyed CUDA stream.
pub unsafe fn malloc_async(
    num_bytes: usize,
    stream: &Arc<Stream>,
) -> Result<sys::CUdeviceptr, DriverError> {
    stream.context().bind_to_thread()?;
    crate::cudarc_shim::memory::malloc_async(stream.cu_stream(), num_bytes)
}

/// Asynchronously allocates `num_bytes` of device memory from a specific pool on the given stream.
///
/// Driver failures come back as `Err`, as for [`malloc_async`].
///
/// # Safety
/// `stream` must be a valid, non-destroyed CUDA stream. `pool` must be a valid memory pool.
pub unsafe fn malloc_from_pool_async(
    num_bytes: usize,
    pool: &Arc<crate::MemPool>,
    stream: &Arc<Stream>,
) -> Result<sys::CUdeviceptr, DriverError> {
    stream.context().bind_to_thread()?;
    crate::cudarc_shim::pool::malloc_from_pool_async(pool.cu_pool(), stream.cu_stream(), num_bytes)
}

/// Asynchronously sets `num_bytes` bytes at `dptr` to `value` on `stream`.
///
/// # Safety
/// `dptr` must point to a device allocation of at least `num_bytes` bytes
/// that stays valid until the operation completes on `stream`.
pub unsafe fn memset_d8_async(
    dptr: sys::CUdeviceptr,
    value: u8,
    num_bytes: usize,
    stream: &Arc<Stream>,
) -> Result<(), DriverError> {
    stream.context().bind_to_thread()?;
    crate::cudarc_shim::memory::memset_d8_async(dptr, value, num_bytes, stream.cu_stream())
}

/// Asynchronously frees device memory on the given stream.
///
/// # Safety
/// `dptr` must have been allocated with [`malloc_async`] or
/// [`malloc_from_pool_async`], `stream` must be ordered after every use of
/// the allocation, and `dptr` must not be used after this call.
pub unsafe fn free_async(dptr: sys::CUdeviceptr, stream: &Arc<Stream>) -> Result<(), DriverError> {
    stream.context().bind_to_thread()?;
    crate::cudarc_shim::memory::free_async(dptr, stream.cu_stream())
}

/// Asynchronously copies `num_elements` of type `T` from host to device memory.
///
/// # Safety
/// `src` must point to at least `num_elements` valid elements; `dst` must have sufficient capacity.
pub unsafe fn memcpy_htod_async<T>(
    dst: sys::CUdeviceptr,
    src: *const T,
    num_elements: usize,
    stream: &Arc<Stream>,
) -> Result<(), DriverError> {
    stream.context().bind_to_thread()?;
    let num_bytes = num_elements * mem::size_of::<T>();
    unsafe {
        crate::cudarc_shim::memory::memcpy_htod_async(dst, src, num_bytes, stream.cu_stream())
    }
}

/// Asynchronously copies `num_elements` of type `T` from device to host memory.
///
/// # Safety
/// `dst` must point to at least `num_elements` writable elements; `src` must be valid device memory.
pub unsafe fn memcpy_dtoh_async<T>(
    dst: *mut T,
    src: sys::CUdeviceptr,
    num_elements: usize,
    stream: &Arc<Stream>,
) -> Result<(), DriverError> {
    stream.context().bind_to_thread()?;
    let num_bytes = num_elements * mem::size_of::<T>();
    unsafe {
        crate::cudarc_shim::memory::memcpy_dtoh_async(dst, src, num_bytes, stream.cu_stream())
    }
}

/// Asynchronously copies `num_elements` of type `T` between device memory regions.
///
/// # Safety
/// Both `dst` and `src` must be valid device pointers with sufficient capacity.
pub unsafe fn memcpy_dtod_async<T>(
    dst: sys::CUdeviceptr,
    src: sys::CUdeviceptr,
    num_elements: usize,
    stream: &Arc<Stream>,
) -> Result<(), DriverError> {
    stream.context().bind_to_thread()?;
    let num_bytes = num_elements * mem::size_of::<T>();
    unsafe {
        crate::cudarc_shim::memory::memcpy_dtod_async(dst, src, num_bytes, stream.cu_stream())
    }
}

/// Wrappers around the cuRAND random number generation library.
pub mod curand {
    // TODO (hme): Probably move this into its own file at so
```

### Core Architecture Module: `cuda-core/src/completion.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Completion-bound retirement without waiting in destructors.

use crate::{DriverError, Event, Stream};
use std::sync::{mpsc, Arc, OnceLock};
use std::time::Duration;

type Cleanup = Box<dyn FnOnce() + Send>;
struct Pending {
    event: Option<Arc<Event>>,
    cleanup: Cleanup,
}

fn enqueue(pending: Pending) {
    static QUEUE: OnceLock<Option<mpsc::Sender<Pending>>> = OnceLock::new();
    let queue = QUEUE.get_or_init(|| {
        let (sender, receiver) = mpsc::channel::<Pending>();
        std::thread::Builder::new()
            .name("cuda-resource-retirement".into())
            .spawn(move || {
                let mut pending = Vec::<Pending>::new();
                loop {
                    match receiver.recv_timeout(Duration::from_millis(1)) {
                        Ok(item) => pending.push(item),
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                        Err(mpsc::RecvTimeoutError::Timeout) => {}
                    }
                    pending.extend(receiver.try_iter());
                    let mut i = 0;
                    while i < pending.len() {
                        let ready = pending[i]
                            .event
                            .as_ref()
                            .map_or(Ok(true), |event| event.query());
                        match ready {
                            Ok(false) => i += 1,
                            Ok(true) => {
                                let item = pending.swap_remove(i);
                                // Preserve the event's context until cleanup has finished.
                                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(
                                    item.cleanup,
                                ));
                            }
                            Err(_) => {
                                // Completion is unknown: leaking the owner and its access
                                // lease is safer than freeing memory or allowing conflicting work.
                                std::mem::forget(pending.swap_remove(i));
                            }
                        }
                    }
                }
                for item in pending {
                    std::mem::forget(item);
                }
            })
            .ok()
            .map(|_| sender)
    });
    if let Some(queue) = queue {
        if let Err(error) = queue.send(pending) {
            std::mem::forget(error.0);
        }
    } else {
        std::mem::forget(pending);
    }
}

pub(crate) fn defer(cleanup: impl FnOnce() + Send + 'static) {
    enqueue(Pending {
        event: None,
        cleanup: Box::new(cleanup),
    });
}

/// Keeps an owner or access lease alive until work already queued on `stream`
/// completes. Dropping the caller's future cannot shorten this lifetime.
///
/// Failure to record or observe completion intentionally leaks the owner;
/// releasing it could invalidate work that the driver has already accepted.
pub fn retain_until_complete(
    owner: impl Send + 'static,
    stream: &Stream,
) -> Result<(), DriverError> {
    let event = match stream.record_event(None) {
        Ok(event) => event,
        Err(error) => {
            std::mem::forget(owner);
            return Err(error);
        }
    };
    enqueue(Pending {
        event: Some(Arc::new(event)),
        cleanup: Box::new(move || drop(owner)),
    });
    Ok(())
}

pub(crate) fn retain_until_event(owner: impl Send + 'static, event: Arc<Event>) {
    enqueue(Pending {
        event: Some(event),
        cleanup: Box::new(move || drop(owner)),
    });
}

```

### Core Architecture Module: `cuda-core/src/context.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Context queries and configuration shared by both programming models.

pub use crate::runtime::{Context, Context as CudaContext};
use crate::{DeviceLaunchLimits, DriverError, IntoResult, KeepAlive, Stream};
use std::{
    ffi::c_int,
    mem::MaybeUninit,
    sync::{atomic::Ordering, Arc},
};

/// The device's meaningful stream priorities, from
/// [`Context::stream_priority_range`].
///
/// CUDA orders priorities the opposite way round to intuition: **a lower
/// number is a higher priority**, so the range runs from
/// [`greatest`](Self::greatest) up to [`least`](Self::least) and
/// `greatest <= least` always holds.
///
/// A priority outside the range is not refused when a stream is created. The
/// driver clamps it to the nearest end and reports nothing, so a caller that
/// wants to know what it will get should ask [`clamp`](Self::clamp) rather
/// than assume the request survived.
///
/// A device without priority support reports `0` for both ends, which
/// [`is_supported`](Self::is_supported) reads as unsupported. Creating a
/// stream still succeeds there; every priority simply collapses to the same
/// one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct StreamPriorityRange {
    /// Numerically largest value, the *lowest* priority.
    least: i32,
    /// Numerically smallest value, the *highest* priority.
    greatest: i32,
}

impl StreamPriorityRange {
    /// The lowest priority, which is the numerically largest value.
    pub fn least(&self) -> i32 {
        self.least
    }

    /// The highest priority, which is the numerically smallest value.
    pub fn greatest(&self) -> i32 {
        self.greatest
    }

    /// Whether this device implements stream priorities at all.
    ///
    /// False when the driver reports `0` for both ends, which is how
    /// `cuCtxGetStreamPriorityRange` answers on a device without support.
    /// A device with support always reports a range wider than one value.
    pub fn is_supported(&self) -> bool {
        self.least != self.greatest
    }

    /// Whether `priority` lies inside the range, and so survives stream
    /// creation unchanged.
    pub fn contains(&self, priority: i32) -> bool {
        (self.greatest..=self.least).contains(&priority)
    }

    /// The value the driver will actually apply for a request of `priority`.
    ///
    /// Answers the silent clamp in
    /// [`Context::new_stream_with_priority`] ahead of the call.
    pub fn clamp(&self, priority: i32) -> i32 {
        priority.clamp(self.greatest, self.least)
    }
}

/// A per-context device limit (`CU_LIMIT_*`), read with
/// [`Context::limit`] and written with [`Context::set_limit`].
///
/// Every limit is state on the device's **primary** context, so it is shared
/// by every [`Context`] for that device, by any runtime-API user of the
/// same device in this process, and across library boundaries. A limit set
/// here is not scoped to the handle that set it.
///
/// The driver is free to clamp or round a request. Read the limit back after
/// setting it to observe what was actually applied.
///
/// # Ordering constraints
///
/// [`PrintfFifoSize`](Self::PrintfFifoSize) and
/// [`MallocHeapSize`](Self::MallocHeapSize) must be set **before the first
/// kernel launch in the process that uses `printf` or device `malloc`**;
/// afterwards the driver rejects the write with `CUDA_ERROR_INVALID_VALUE`.
/// Because the limit lives on the shared primary context, "first launch"
/// counts launches made through any handle, not just this one.
///
/// # Omitted variants
///
/// `CU_LIMIT_SHMEM_SIZE`, `CU_LIMIT_CIG_ENABLED` and
/// `CU_LIMIT_CIG_SHMEM_FALLBACK_ENABLED` are absent. The first two are
/// query-only, all three concern CIG (graphics-interop) contexts, and none
/// predates CUDA 12.5, so naming them would need a header probe and a `cfg`
/// in the manner of `cuda_has_cuEventElapsedTime_v2`. The seven variants
/// below have been present since CUDA 11 and are the ones
/// `cuCtxSetLimit`'s own documentation specifies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContextLimit {
    /// Stack size in bytes for each GPU thread (`CU_LIMIT_STACK_SIZE`).
    ///
    /// The driver raises this on its own whenever a launched kernel needs a
    /// larger frame and **does not lower it again**, so a read reflects the
    /// high-water mark of everything launched in this context so far. The
    /// reservation scales as roughly `bytes * mp_count * threads_per_mp` and
    /// is invisible to the allocation APIs: it simply reduces the device
    /// memory a later allocation can obtain. Lowering it after a deep-frame
    /// kernel has raised it is how that memory is handed back.
    StackSize,
    /// Size in bytes of the FIFO backing the device `printf`
    /// (`CU_LIMIT_PRINTF_FIFO_SIZE`).
    ///
    /// The FIFO is circular: once a launch fills it, the **oldest** output is
    /// overwritten and lost silently, with no error and no marker in the
    /// stream the host prints. Raising this is the only fix for a kernel
    /// whose output is truncated. Subject to the ordering constraint above.
    PrintfFifoSize,
    /// Size in bytes of the heap backing device `malloc` and `free`
    /// (`CU_LIMIT_MALLOC_HEAP_SIZE`). Subject to the ordering constraint
    /// above.
    MallocHeapSize,
    /// Maximum grid nesting depth at which a device-runtime thread may call
    /// `cudaDeviceSynchronize` (`CU_LIMIT_DEV_RUNTIME_SYNC_DEPTH`).
    ///
    /// Applies only to devices of compute capability below 9.0; elsewhere the
    /// driver returns `CUDA_ERROR_UNSUPPORTED_LIMIT`. Each level of depth
    /// reserves device memory, so a request the driver cannot back fails with
    /// `CUDA_ERROR_OUT_OF_MEMORY` and leaves the limit settable at a lower
    /// value.
    DevRuntimeSyncDepth,
    /// Maximum number of outstanding device-runtime launches from this
    /// context (`CU_LIMIT_DEV_RUNTIME_PENDING_LAUNCH_COUNT`), default 2048.
    ///
    /// Reserves device memory in proportion, and fails the same way as
    /// [`DevRuntimeSyncDepth`](Self::DevRuntimeSyncDepth) when the
    /// reservation cannot be met.
    DevRuntimePendingLaunchCount,
    /// L2 fetch granularity in bytes, 0 to 128
    /// (`CU_LIMIT_MAX_L2_FETCH_GRANULARITY`). A hint: the platform may ignore
    /// or clamp it, and a read need not return what was written.
    MaxL2FetchGranularity,
    /// Bytes of L2 set aside for persisting lines
    /// (`CU_LIMIT_PERSISTING_L2_CACHE_SIZE`). A hint, with the same caveat as
    /// [`MaxL2FetchGranularity`](Self::MaxL2FetchGranularity).
    PersistingL2CacheSize,
}

impl ContextLimit {
    /// Maps to the raw `CUlimit` the driver expects.
    fn to_raw(self) -> cuda_bindings::CUlimit {
        match self {
            ContextLimit::StackSize => cuda_bindings::CUlimit_enum_CU_LIMIT_STACK_SIZE,
            ContextLimit::PrintfFifoSize => cuda_bindings::CUlimit_enum_CU_LIMIT_PRINTF_FIFO_SIZE,
            ContextLimit::MallocHeapSize => cuda_bindings::CUlimit_enum_CU_LIMIT_MALLOC_HEAP_SIZE,
            ContextLimit::DevRuntimeSyncDepth => {
                cuda_bindings::CUlimit_enum_CU_LIMIT_DEV_RUNTIME_SYNC_DEPTH
            }
            ContextLimit::DevRuntimePendingLaunchCount => {
                cuda_bindings::CUlimit_enum_CU_LIMIT_DEV_RUNTIME_PENDING_LAUNCH_COUNT
            }
            ContextLimit::MaxL2FetchGranularity => {
                cuda_bindings::CUlimit_enum_CU_LIMIT_MAX_L2_FETCH_GRANULARITY
            }
            ContextLimit::PersistingL2CacheSize => {
                cuda_bindings::CUlimit_enum_CU_LIMIT_PERSISTING_L2_CACHE_SIZE
            }
        }
    }
}

/// Context scheduling policy (`CU_CTX_SCHED_*`), governing how the driver
/// waits when the calling host thread blocks on GPU work (a stream or
/// context synchronize).
///
/// Set via [`Context::set_sync_policy`], read via
/// [`Context::sync_policy`]. The trade-off is host CPU against wake
/// latency: [`Spin`](Self::Spin) burns a full core for the lowest latency,
/// [`BlockingSync`](Self::BlockingSync) frees the core but wakes later. On a
/// host with spare cores this trade rarely matters; on a CPU-constrained one
/// (few physical cores, a sync-heavy pipeline) it can cost double-digit
/// percentages of host CPU for no wall-clock benefit, which is the case
/// [`BlockingSync`](Self::BlockingSync) exists to fix.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SyncPolicy {
    /// Driver-chosen default: spin if the process has more logical CPUs than
    /// active contexts, otherwise yield.
    Auto,
    /// Spin the calling thread while waiting. Lowest latency, highest CPU use.
    Spin,
    /// Yield the calling thread's timeslice while waiting.
    Yield,
    /// Block the calling thread on a synchronization primitive while
    /// waiting. Lowest CPU use, highest wake latency.
    BlockingSync,
}

impl SyncPolicy {
    fn to_raw(self) -> cuda_bindings::CUctx_flags_enum {
        match self {
            SyncPolicy::Auto => cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_AUTO,
            SyncPolicy::Spin => cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_SPIN,
            SyncPolicy::Yield => cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_YIELD,
            SyncPolicy::BlockingSync => cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_BLOCKING_SYNC,
        }
    }

    /// Decodes the scheduling bits (`CU_CTX_SCHED_MASK`) out of a raw flags
    /// word. `None` for a driver-reserved combination this enum does not
    /// name (the mask is 3 bits wide; only 4 of 8 values are assigned today).
    fn from_raw(raw: cuda_bindings::CUctx_flags_enum) -> Option<Self> {
        match raw & cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_MASK {
            cuda_bindings::CUctx_flags_enum_CU_CTX_SCHED_AUTO => Some(SyncPolicy::Auto),
          
```

### Core Architecture Module: `cuda-core/src/cudarc_shim.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 * Portions of this file are copyright per https://github.com/chelsea0x3b/cudarc
 */

//\! Low-level CUDA driver API wrappers.
//\!
//\! Thin `pub(crate)` modules around `cuda_bindings` calls. The public API
//\! lives in [`crate::runtime`].
//\!
//\! CUDA driver flag bindings have platform-dependent integer types, so FFI
//\! calls cast them as `_`.

use crate::error::*;

/// Low-level primary context retain/release operations.
#[allow(dead_code)]
pub(crate) mod primary_ctx {

    use super::{DriverError, IntoResult};
    use std::mem::MaybeUninit;

    /// Retains the primary context for the given device, incrementing its reference count.
    ///
    /// # Safety
    /// `dev` must be a valid CUDA device handle.
    pub unsafe fn retain(
        dev: cuda_bindings::CUdevice,
    ) -> Result<cuda_bindings::CUcontext, DriverError> {
        let mut ctx = MaybeUninit::uninit();
        cuda_bindings::cuDevicePrimaryCtxRetain(ctx.as_mut_ptr(), dev).result()?;
        Ok(ctx.assume_init())
    }

    /// Releases the primary context for the given device.
    ///
    /// # Safety
    /// Must be paired with a prior `retain` call.
    pub unsafe fn release(dev: cuda_bindings::CUdevice) -> Result<(), DriverError> {
        cuda_bindings::cuDevicePrimaryCtxRelease_v2(dev).result()
    }
}

/// Low-level device query operations.
#[allow(dead_code)]
pub(crate) mod device {

    use super::{DriverError, IntoResult};
    use std::{
        ffi::{c_int, CStr},
        mem::MaybeUninit,
        string::String,
    };

    /// Returns the device handle for the given ordinal.
    pub fn get(ordinal: c_int) -> Result<cuda_bindings::CUdevice, DriverError> {
        let mut dev = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuDeviceGet(dev.as_mut_ptr(), ordinal).result()?;
            Ok(dev.assume_init())
        }
    }

    /// Returns the number of CUDA-capable devices.
    pub fn get_count() -> Result<c_int, DriverError> {
        let mut count = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuDeviceGetCount(count.as_mut_ptr()).result()?;
            Ok(count.assume_init())
        }
    }

    /// Returns the total memory in bytes on the device.
    ///
    /// # Safety
    /// `dev` must be a valid device handle.
    pub unsafe fn total_mem(dev: cuda_bindings::CUdevice) -> Result<usize, DriverError> {
        let mut bytes = MaybeUninit::uninit();
        cuda_bindings::cuDeviceTotalMem_v2(bytes.as_mut_ptr(), dev).result()?;
        Ok(bytes.assume_init())
    }

    /// Queries a device attribute value.
    ///
    /// # Safety
    /// `dev` must be a valid device handle.
    pub unsafe fn get_attribute(
        dev: cuda_bindings::CUdevice,
        attrib: cuda_bindings::CUdevice_attribute,
    ) -> Result<i32, DriverError> {
        let mut value = MaybeUninit::uninit();
        cuda_bindings::cuDeviceGetAttribute(value.as_mut_ptr(), attrib, dev).result()?;
        Ok(value.assume_init())
    }

    /// Returns the device name as a string.
    pub fn get_name(dev: cuda_bindings::CUdevice) -> Result<String, DriverError> {
        const BUF_SIZE: usize = 128;
        let mut buf = [0u8; BUF_SIZE];
        unsafe {
            cuda_bindings::cuDeviceGetName(buf.as_mut_ptr() as _, BUF_SIZE as _, dev).result()?;
        }
        let name = CStr::from_bytes_until_nul(&buf).expect("No null byte was present");
        Ok(String::from_utf8_lossy(name.to_bytes()).into())
    }

    /// Returns the UUID of the device.
    pub fn get_uuid(dev: cuda_bindings::CUdevice) -> Result<cuda_bindings::CUuuid, DriverError> {
        let id: cuda_bindings::CUuuid;
        unsafe {
            let mut uuid = MaybeUninit::uninit();
            cuda_bindings::cuDeviceGetUuid_v2(uuid.as_mut_ptr(), dev).result()?;
            id = uuid.assume_init();
        }
        Ok(id)
    }
}

/// Low-level function attribute operations.
#[allow(dead_code)]
pub(crate) mod function {

    use super::{DriverError, IntoResult};

    /// Sets a function attribute value.
    ///
    /// # Safety
    /// `f` must be a valid function handle.
    pub unsafe fn set_function_attribute(
        f: cuda_bindings::CUfunction,
        attribute: cuda_bindings::CUfunction_attribute_enum,
        value: i32,
    ) -> Result<(), DriverError> {
        unsafe {
            cuda_bindings::cuFuncSetAttribute(f, attribute, value).result()?;
        }
        Ok(())
    }

    /// Sets the preferred cache configuration for a function.
    ///
    /// # Safety
    /// `f` must be a valid function handle.
    pub unsafe fn set_function_cache_config(
        f: cuda_bindings::CUfunction,
        attribute: cuda_bindings::CUfunc_cache_enum,
    ) -> Result<(), DriverError> {
        unsafe {
            cuda_bindings::cuFuncSetCacheConfig(f, attribute).result()?;
        }
        Ok(())
    }
}

/// Low-level CUDA context management operations.
#[allow(dead_code)]
pub(crate) mod ctx {
    use super::{DriverError, IntoResult};
    use std::mem::MaybeUninit;

    /// Sets the current CUDA context for the calling thread.
    ///
    /// # Safety
    /// `ctx` must be a valid context handle.
    pub unsafe fn set_current(ctx: cuda_bindings::CUcontext) -> Result<(), DriverError> {
        cuda_bindings::cuCtxSetCurrent(ctx).result()
    }

    /// Returns the CUDA context bound to the calling thread, or `None`.
    pub fn get_current() -> Result<Option<cuda_bindings::CUcontext>, DriverError> {
        let mut ctx = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuCtxGetCurrent(ctx.as_mut_ptr()).result()?;
            let ctx: cuda_bindings::CUcontext = ctx.assume_init();
            if ctx.is_null() {
                Ok(None)
            } else {
                Ok(Some(ctx))
            }
        }
    }

    /// Sets flags on the current context.
    pub fn set_flags(flags: cuda_bindings::CUctx_flags) -> Result<(), DriverError> {
        unsafe { cuda_bindings::cuCtxSetFlags(flags as _).result() }
    }

    /// Blocks until all work in the current context is complete.
    pub fn synchronize() -> Result<(), DriverError> {
        unsafe { cuda_bindings::cuCtxSynchronize() }.result()
    }
}

/// Low-level CUDA stream operations.
#[allow(dead_code)]
pub(crate) mod stream {
    use super::{DriverError, IntoResult};
    use std::ffi::c_void;
    use std::mem::MaybeUninit;

    /// The kind of CUDA stream to create.
    pub enum StreamKind {
        /// > Default stream creation flag.
        Default,

        /// > Specifies that work running in the created stream
        /// > may run concurrently with work in stream 0 (the NULL stream),
        /// > and that the created stream should perform no implicit
        /// > synchronization with stream 0.
        NonBlocking,
    }

    impl StreamKind {
        fn flags(self) -> cuda_bindings::CUstream_flags {
            match self {
                Self::Default => cuda_bindings::CUstream_flags_enum_CU_STREAM_DEFAULT,
                Self::NonBlocking => cuda_bindings::CUstream_flags_enum_CU_STREAM_NON_BLOCKING,
            }
        }
    }

    /// Returns the null (default) stream handle.
    pub fn null() -> cuda_bindings::CUstream {
        std::ptr::null_mut()
    }

    /// Creates a new CUDA stream of the given kind.
    pub fn create(kind: StreamKind) -> Result<cuda_bindings::CUstream, DriverError> {
        let mut stream = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuStreamCreate(stream.as_mut_ptr(), kind.flags() as _).result()?;
            Ok(stream.assume_init())
        }
    }

    /// Blocks until all work on the stream is complete.
    ///
    /// # Safety
    /// `stream` must be a valid stream handle.
    pub unsafe fn synchronize(stream: cuda_bindings::CUstream) -> Result<(), DriverError> {
        cuda_bindings::cuStreamSynchronize(stream).result()?;
        #[cfg(test)]
        super::fence_trace::record(super::fence_trace::Call::Synchronize(stream as usize));
        Ok(())
    }

    /// Queries stream completion without blocking: `Ok(true)` when all prior
    /// work has completed, `Ok(false)` when work is still in flight
    /// (`CUDA_ERROR_NOT_READY`).
    ///
    /// # Safety
    /// `stream` must be a valid stream handle.
    pub unsafe fn query(stream: cuda_bindings::CUstream) -> Result<bool, DriverError> {
        match cuda_bindings::cuStreamQuery(stream) {
            cuda_bindings::cudaError_enum_CUDA_SUCCESS => Ok(true),
            cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_READY => Ok(false),
            code => {
                code.result()?;
                unreachable!("non-error CUresult handled above")
            }
        }
    }

    /// Destroys a CUDA stream.
    ///
    /// # Safety
    /// `stream` must be valid and not in use.
    pub unsafe fn destroy(stream: cuda_bindings::CUstream) -> Result<(), DriverError> {
        cuda_bindings::cuStreamDestroy_v2(stream).result()
    }

    /// Makes a stream wait on an event.
    ///
    /// # Safety
    /// Both handles must be valid.
    pub unsafe fn wait_event(
        stream: cuda_bindings::CUstream,
        event: cuda_bindings::CUevent,
        flags: cuda_bindings::CUevent_wait_flags,
    ) -> Result<(), DriverError> {
        cuda_bindings::cuStreamWaitEvent(stream, event, flags as _).result()?;
        #[cfg(test)]
        super::fence_trace::record(super::fence_trace::Call::Wait {
            stream: stream as usize,
            event: event as usize,
        });
        Ok(())
    }

    /// Attaches memory to a stream for managed memory visibility.
    ///
    /// # Safety
    /// `dptr` must be a valid managed memory pointer.
    pub unsafe fn attach_mem_async(
        stream: cuda_bindings::CUstream,
        dptr: cuda_bindings::CUdeviceptr,
        num_bytes: usize,
        flags: cuda_bindings::C
```

### Core Architecture Module: `cuda-core/src/device_buffer.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Owning device memory buffer with ergonomic host-device transfer methods.
//!
//! [`DeviceBuffer<T>`] is analogous to `Vec<T>` on the host: it owns a
//! contiguous allocation of `len` elements on the device and frees it on
//! drop. The stream is an explicit parameter on every transfer operation,
//! making data-flow and synchronization transparent. Buffers allocated with
//! [`DeviceBuffer::uninitialized_async`] retain their allocation stream for
//! deallocation.
//!
//! Drop does not wait for GPU work. Safe launch and transfer APIs retain the
//! shared allocation owner and access leases independently until completion.
//! Unsafe raw-pointer callers must retain storage and order accesses themselves.
//!
//! # Quick start
//!
//! ```ignore
//! let a_dev = DeviceBuffer::from_host(&stream, &a_host)?;
//! let c_dev = DeviceBuffer::<f32>::zeroed(&stream, N)?;
//! // ... kernel launch ...
//! let c_host = c_dev.to_host_vec(&stream)?;
//! ```

use std::marker::PhantomData;
use std::mem::MaybeUninit;
use std::num::Wrapping;
use std::sync::Arc;

use bytemuck::{AnyBitPattern, NoUninit};
use cuda_bindings::CUdeviceptr;
use cuda_repr::DeviceRepr;

use crate::context::Context;
use crate::error::DriverError;
use crate::pinned_host_buffer::PinnedHostBuffer;
use crate::stream::Stream;

/// Marker trait for values that can be safely copied between host and device
/// memory as raw bytes.
///
/// Types implementing `DeviceCopy` must not contain Rust-owned allocations,
/// references, or other values whose validity depends on host-side ownership or
/// drop semantics. This is the device-memory equivalent of a plain-old-data
/// contract.
///
/// # Safety
///
/// Implementors must be safe to duplicate with a byte-for-byte copy, and the
/// all-zero bit pattern must be a valid value because [`DeviceBuffer::zeroed`]
/// initializes memory with zero bytes. Types whose zero pattern is invalid,
/// such as `NonZeroU32`, cannot implement `DeviceCopy`.
///
/// `DeviceCopy` does not promise that every bit pattern is valid. `bool`
/// implements it although only `0` and `1` are `bool` values. That is sound
/// because a typed `DeviceBuffer<T>` holds valid `T` values by construction:
/// the safe constructors copy `T` values from the host or write zero bytes, a
/// kernel that writes through `&mut T` writes a `T`, and the raw constructors
/// are `unsafe`, so their caller vouches for the contents. The one place
/// arbitrary bytes could become typed values is the safe reinterpreting casts,
/// [`DeviceBuffer::cast_elem`] and [`DeviceBuffer::cast_chunks`]. They require
/// the source to implement [`bytemuck::NoUninit`] and the target to implement
/// [`bytemuck::AnyBitPattern`]. This excludes uninitialized source bytes and
/// padding, and rejects `bool` as a target, so a `DeviceBuffer<bool>` can only
/// come from memory written as `bool`.
pub unsafe trait DeviceCopy: Copy {}

macro_rules! impl_device_copy {
    ($($ty:ty),+ $(,)?) => {
        $(
            unsafe impl DeviceCopy for $ty {}
        )+
    };
}

impl_device_copy!(
    (),
    i8,
    i16,
    i32,
    i64,
    i128,
    isize,
    u8,
    u16,
    u32,
    u64,
    u128,
    usize,
    f32,
    f64
);

// Zero is `false`, and the trait documentation explains why the `0`/`1`
// validity requirement does not stop `bool` from being `DeviceCopy`. It is not
// `bytemuck::AnyBitPattern`, so the reinterpreting casts cannot produce it.
unsafe impl DeviceCopy for bool {}

unsafe impl<T: DeviceCopy, const N: usize> DeviceCopy for [T; N] {}
unsafe impl<T: ?Sized> DeviceCopy for *const T {}
unsafe impl<T: ?Sized> DeviceCopy for *mut T {}

// Wrapper types that don't change the byte representation: a value of the
// wrapper has the same layout and validity invariants as the inner `T`.
// `PhantomData<T>` is a zero-sized marker -- always trivially copyable
// regardless of `T`. `MaybeUninit<T>` accepts any bit pattern by design.
// `Wrapping<T>` is a `#[repr(transparent)]` newtype.
unsafe impl<T: ?Sized> DeviceCopy for PhantomData<T> {}
unsafe impl<T: DeviceCopy> DeviceCopy for MaybeUninit<T> {}
unsafe impl<T: DeviceCopy> DeviceCopy for Wrapping<T> {}

macro_rules! impl_device_copy_tuple {
    ($($name:ident),+ $(,)?) => {
        unsafe impl<$($name: DeviceCopy),+> DeviceCopy for ($($name,)+) {}
    };
}

impl_device_copy_tuple!(A);
impl_device_copy_tuple!(A, B);
impl_device_copy_tuple!(A, B, C);
impl_device_copy_tuple!(A, B, C, D);
impl_device_copy_tuple!(A, B, C, D, E);
impl_device_copy_tuple!(A, B, C, D, E, F);
impl_device_copy_tuple!(A, B, C, D, E, F, G);
impl_device_copy_tuple!(A, B, C, D, E, F, G, H);

#[cfg(feature = "f16")]
unsafe impl DeviceCopy for f16 {}
unsafe impl DeviceCopy for half::bf16 {}
unsafe impl DeviceCopy for half::f16 {}

// SAFETY: these transparent numeric storage wrappers own no resources, have
// valid all-zero representations, and can be duplicated byte-for-byte. Packed
// FP4 remains one byte holding two logical values; copying does not unpack it.
impl_device_copy!(
    crate::tf32,
    crate::f8e4m3fn,
    crate::f8e5m2,
    crate::f8e8m0fnu,
    crate::f8e5m3fnu,
    crate::f4e2m1fnx2
);

/// Owning handle to a contiguous device allocation of `T` elements.
///
/// Shares an allocation owner, its CUDA context, and an access tracker with
/// tensor and byte views. Safe submissions retain independent access leases
/// until completion, including when a launch future is dropped or forgotten.
/// Drop retires deallocation on a worker without waiting on the caller's
/// thread. Unsafe raw-pointer users must retain storage through their own work.
///
/// Device buffers may only transfer plain device-copyable values. Owning host
/// types such as [`String`] are rejected because copying their bytes to and
/// from device memory would not preserve Rust ownership invariants.
///
/// ```compile_fail
/// # use cuda_core::{Stream, DeviceBuffer};
/// # fn rejects_non_device_copy(stream: &Stream) {
/// let _ = DeviceBuffer::<String>::zeroed(stream, 1);
/// # }
/// ```
pub struct DeviceBuffer<T> {
    storage: crate::RawDeviceBuffer,
    shared_access_writes: bool,
    ptr: CUdeviceptr,
    len: usize,
    num_bytes: usize,
    _marker: PhantomData<T>,
}

// SAFETY: CUdeviceptr is a u64 handle valid across threads when the owning
// context is bound. The PhantomData<T> is Send if T is Send.
unsafe impl<T: Send> Send for DeviceBuffer<T> {}
// SAFETY: &DeviceBuffer only exposes cu_deviceptr() and len(), both of which
// return Copy values. No interior mutability.
unsafe impl<T: Send + Sync> Sync for DeviceBuffer<T> {}

impl<T> DeviceBuffer<T> {
    fn enqueue_access(
        &self,
        stream: &Stream,
        write: bool,
        enqueue: impl FnOnce() -> Result<(), DriverError>,
    ) -> Result<(), DriverError> {
        let lease = self.storage.acquire(stream, write, false)?;
        self.storage.context().bind_to_thread()?;
        let submitted = enqueue();
        let retained = lease.retain_until_complete(stream);
        submitted.and(retained)
    }

    /// The shared byte storage and allocation identity underlying this view.
    pub fn storage(&self) -> &crate::RawDeviceBuffer {
        &self.storage
    }
    /// Whether a shared kernel reference may mutate elements through interior
    /// mutability. Representation wrappers and unclassified raw types are
    /// conservative; ordinary DeviceCopy values can share read accesses.
    #[doc(hidden)]
    pub fn shared_access_writes(&self) -> bool {
        self.shared_access_writes
    }

    /// Erases the element type without copying or releasing storage.
    pub fn into_storage(self) -> crate::RawDeviceBuffer {
        self.storage
    }

    /// Constructs a typed view over shared byte storage.
    ///
    /// # Safety
    /// Every initialized element must be a valid `T`; the caller must preserve
    /// element validity across all aliases (including future writes through
    /// aliases with another element type). The storage must be initialized before
    /// any read, and raw foreign accesses must obey its access-exclusion contract.
    pub unsafe fn from_storage(
        storage: crate::RawDeviceBuffer,
        len: usize,
    ) -> Result<Self, DriverError> {
        let num_bytes = allocation_size::<T>(len)?;
        let ptr = storage.cu_deviceptr();
        if num_bytes != storage.len_bytes()
            || (num_bytes != 0 && !(ptr as usize).is_multiple_of(std::mem::align_of::<T>()))
        {
            return Err(DriverError(
                cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE,
            ));
        }
        Ok(Self {
            ptr,
            len,
            num_bytes,
            storage,
            shared_access_writes: true,
            _marker: PhantomData,
        })
    }

    /// Borrows a contiguous range of elements while retaining the same storage
    /// owner and access tracker. No device memory is copied.
    pub fn slice(
        &self,
        range: std::ops::Range<usize>,
    ) -> Result<DeviceBufferView<'_, T>, DriverError> {
        if range.start > range.end || range.end > self.len {
            return Err(DriverError(
                cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE,
            ));
        }
        let storage = self.storage.slice_bytes(
            allocation_size::<T>(range.start)?,
            allocation_size::<T>(range.end - range.start)?,
        )?;
        Ok(DeviceBufferView {
            storage,
            shared_access_writes: self.shared_access_writes,
            len: range.end - range.start,
            _borrow: PhantomData,
        })
    }

    /// Returns the raw `CUdeviceptr` for use in kernel argument lists.
    #[inline]
    pub fn cu_deviceptr(&self) -> CUdeviceptr {
        self.ptr
    }

    /// Number of `T` elements in the buffer.
    #[inline]

```

### Core Architecture Module: `cuda-core/src/dtype.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Primitive data types for GPU tensors and kernel arguments.
//!
//! `DType` marks Rust types that can be used as tensor element types (`Tensor<T: DType>`)
//! and as scalar kernel arguments. `DTypeId` is the corresponding runtime identifier.

use half::{bf16, f16};
use std::fmt::{Debug, Display};

// ---------------------------------------------------------------------------
// GPU-specific type wrappers (no host arithmetic, storage only)
// ---------------------------------------------------------------------------

/// TensorFloat-32 format (TF32). 19-bit format with FP32 range and FP16 precision.
/// Used by Ampere+ GPUs for accelerated matrix multiplication.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct tf32(pub u32);

/// FP8 E4M3FN format (4-bit exponent, 3-bit mantissa, no infinity).
/// Used by Hopper+ GPUs for efficient matrix multiplication and quantized inference.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f8e4m3fn(pub u8);

/// FP8 E5M2 format (5-bit exponent, 2-bit mantissa).
/// Same exponent range as FP16 with reduced precision.
/// Used by Hopper+ GPUs.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f8e5m2(pub u8);

/// FP8 E8M0FNU format (8-bit exponent, unsigned, finite-only).
///
/// Used as a block scale type for scaled low-precision MMA, including NVFP4
/// inputs.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f8e8m0fnu(pub u8);

/// Unsigned FP8 E5M3FNU storage (5 exponent bits, 3 fraction bits).
/// Tile IR 13.4 introduces this scale format; arithmetic support is target-dependent.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f8e5m3fnu(pub u8);

/// FP4 E2M1FN format (2-bit exponent, 1-bit mantissa, finite-only).
///
/// This is a logical sub-byte Tile IR element type. It is the type consumed by
/// FP4 MMA after packed tensor data has been unpacked inside a kernel. Host
/// tensors should store model data in byte-addressable packed storage such as
/// [`f4e2m1fnx2`].
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f4e2m1fn(pub u8);

/// Packed pair of FP4 E2M1FN values in one byte.
///
/// This is a byte-addressable storage type for tensors that contain packed
/// `f4e2m1fn` values. A nibble is a 4-bit half-byte: the low nibble is the
/// first logical value and the high nibble is the second logical value,
/// matching the [`Self::from_nibbles`], [`Self::low`], and [`Self::high`]
/// convention.
///
/// This is not a Tile IR arithmetic element type. Kernels should explicitly
/// unpack it to logical `f4e2m1fn` tiles before using FP4 MMA operations.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct f4e2m1fnx2(u8);

impl f4e2m1fnx2 {
    /// Creates a packed pair from a raw byte.
    ///
    /// This preserves the byte exactly. Every `u8` bit pattern is valid packed
    /// storage for two 4-bit values, so this constructor is safe. It does not
    /// validate that the byte came from a correctly quantized model. Use
    /// [`Self::from_nibbles`] when building a pair from two logical FP4 bit
    /// patterns.
    pub const fn from_bits(bits: u8) -> Self {
        Self(bits)
    }

    /// Creates a packed pair from two raw FP4 nibble values.
    ///
    /// Each input is masked to 4 bits. `low` becomes the first logical FP4 value
    /// and `high` becomes the second logical FP4 value. Higher input bits are
    /// discarded.
    pub const fn from_nibbles(low: u8, high: u8) -> Self {
        Self((low & 0x0F) | ((high & 0x0F) << 4))
    }

    /// Returns the first logical FP4 value, stored in the low nibble.
    pub const fn low(self) -> f4e2m1fn {
        f4e2m1fn(self.0 & 0x0F)
    }

    /// Returns the second logical FP4 value, stored in the high nibble.
    pub const fn high(self) -> f4e2m1fn {
        f4e2m1fn((self.0 >> 4) & 0x0F)
    }

    /// Returns the packed byte.
    pub const fn to_bits(self) -> u8 {
        self.0
    }
}

/// 4-bit signless integer Tile IR element marker.
///
/// This is a sub-byte Tile IR type for integer pack/unpack paths. It is not the
/// NVFP4 data type, and it is not a byte-addressable host tensor element in
/// this crate. Packed host storage should use bytes.
#[derive(Copy, Clone, Debug, PartialEq, Default)]
#[repr(transparent)]
#[allow(non_camel_case_types)]
pub struct i4(pub u8);

// Every bit pattern of the underlying `u8` or `u32` is a valid value of each
// wrapper: the fields are public or reachable through a safe `from_bits`, and
// nothing is reserved. That makes them plain old data in bytemuck's sense,
// which is what lets byte storage be reinterpreted as one of them through
// `DeviceBuffer::cast_elem`, `DeviceBuffer::cast_chunks`, and
// `Tensor::reinterpret`, all bounded on `AnyBitPattern` (#1506). `bool` is
// a `DType` too but deliberately has no such impl: only `0` and `1` are
// valid, so a `bool` buffer or tensor can only come from memory written as
// `bool`.
macro_rules! impl_pod_newtype {
    ($($ty:ty),+ $(,)?) => {
        $(
            // SAFETY: `#[repr(transparent)]` over an integer, so there is no
            // padding, and every bit pattern is a valid value (see above).
            unsafe impl bytemuck::Zeroable for $ty {}
            unsafe impl bytemuck::Pod for $ty {}
        )+
    };
}

impl_pod_newtype!(tf32, f8e4m3fn, f8e5m2, f8e8m0fnu, f8e5m3fnu, f4e2m1fn, f4e2m1fnx2, i4);

/// Runtime identifier for a `DType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DTypeId {
    Bool,
    U8,
    U16,
    U32,
    U64,
    I8,
    I16,
    I32,
    I64,
    F16,
    BF16,
    F32,
    TF32,
    F64,
    F8E4M3FN,
    F8E5M2,
    F8E8M0FNU,
    F8E5M3FNU,
    F4E2M1FNX2,
}

impl DTypeId {
    /// Returns the string representation of this data type.
    pub fn as_str(&self) -> &'static str {
        match self {
            DTypeId::Bool => "bool",
            DTypeId::U8 => "u8",
            DTypeId::U16 => "u16",
            DTypeId::U32 => "u32",
            DTypeId::U64 => "u64",
            DTypeId::I8 => "i8",
            DTypeId::I16 => "i16",
            DTypeId::I32 => "i32",
            DTypeId::I64 => "i64",
            DTypeId::F16 => "f16",
            DTypeId::BF16 => "bf16",
            DTypeId::F32 => "f32",
            DTypeId::TF32 => "tf32",
            DTypeId::F64 => "f64",
            DTypeId::F8E4M3FN => "f8e4m3fn",
            DTypeId::F8E5M2 => "f8e5m2",
            DTypeId::F8E8M0FNU => "f8e8m0fnu",
            DTypeId::F8E5M3FNU => "f8e5m3fnu",
            DTypeId::F4E2M1FNX2 => "f4e2m1fnx2",
        }
    }

    /// Returns the size in bytes of this data type.
    pub fn size_in_bytes(&self) -> usize {
        match self {
            DTypeId::Bool | DTypeId::U8 | DTypeId::I8 => 1,
            DTypeId::U16 | DTypeId::I16 | DTypeId::F16 | DTypeId::BF16 => 2,
            DTypeId::U32 | DTypeId::I32 | DTypeId::F32 | DTypeId::TF32 => 4,
            DTypeId::U64 | DTypeId::I64 | DTypeId::F64 => 8,
            DTypeId::F8E4M3FN
            | DTypeId::F8E5M2
            | DTypeId::F8E8M0FNU
            | DTypeId::F8E5M3FNU
            | DTypeId::F4E2M1FNX2 => 1,
        }
    }
}

impl Display for DTypeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// A primitive type that can be stored in a `Tensor` or passed as a scalar kernel argument.
///
/// # Safety
///
/// Implementors promise that **every byte sequence the device can produce for
/// `Self::DTYPE` is a valid `Self`**. Host code reads device memory back as
/// `Self` without validation (a `to_host_vec` copy, a borrowed tensor's
/// elements), so an invalid bit pattern would be undefined behaviour the
/// moment it is read. For the integer and floating-point types every bit
/// pattern is valid. For `bool` the promise rests on device code storing only
/// `0` or `1`: the DSL guarantees that for the kernels it compiles, and any
/// foreign memory borrowed as a `Tensor<bool>` must uphold it too.
pub unsafe trait DType: Send + Sync + Copy + Debug + 'static {
    /// The runtime data type identifier for this scalar type.
    const DTYPE: DTypeId;
    /// Returns the zero value for this scalar type.
    fn zero() -> Self;
    /// Returns the one value for this scalar type.
    fn one() -> Self;
}

macro_rules! impl_dtype {
    ($($ty:ty => $variant:ident, $zero:expr, $one:expr),* $(,)?) => {
        $(
            // SAFETY: see the invocation below.
            unsafe impl DType for $ty {
                const DTYPE: DTypeId = DTypeId::$variant;
                fn zero() -> Self { $zero }
                fn one() -> Self { $one }
            }
        )*
    }
}

// SAFETY: every bit pattern is a valid value for each type below — the
// integers by definition, the IEEE and reduced-precision floats because NaN
// payloads and non-canonical encodings are still values, and the `repr(
// transparent)` wrappers because they are plain `u8`/`u32` — except `bool`,
// whose only valid patterns are 0 and 1; the device side guarantees those
// (see the trait's `# Safety` section).
impl_dtype!(
    bool => Bool, false, true,
    u8 => U8, 0, 1,
    u16 => U16, 0, 1,
    u32 => U32, 0, 1,
    u64 => U64, 0, 1,
    i8 => I8, 0, 1,
    i16 => I16, 0, 1,
    i32 => I32, 0, 1,
    i64 => I64, 0, 1,
    f16 => F16, f16::ZERO, f16::ONE,
    bf16 => BF16, bf16::ZERO, bf16::ONE,
    f32 => F32, 0.0, 1.0,
    tf32 => TF32, tf32(0), tf32(0x3F800000),  // IEEE 754 1.0 in f32 
```

### Core Architecture Module: `cuda-core/src/embedded.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Loading CUDA modules from embedded device artifact bundles.

use crate::{Context, DriverError, Module};
use oxide_artifacts::ArtifactError;
pub use oxide_artifacts::{
    ArtifactCompileOptions, ArtifactDebugPolicy, ArtifactPayloadKind, OwnedArtifactBundle,
    COMPILE_OPTIONS_TARGET_MARKER,
};
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EmbeddedModule {
    bundle: OwnedArtifactBundle,
}

impl EmbeddedModule {
    pub fn new(bundle: OwnedArtifactBundle) -> Option<Self> {
        loadable_payload(&bundle)
            .is_some()
            .then_some(Self { bundle })
    }

    pub fn name(&self) -> &str {
        &self.bundle.name
    }

    pub fn target(&self) -> &str {
        &self.bundle.target
    }

    pub fn bundle(&self) -> &OwnedArtifactBundle {
        &self.bundle
    }

    pub fn payload(&self, kind: ArtifactPayloadKind) -> Option<&[u8]> {
        self.bundle.payload(kind)
    }

    pub fn load(&self, ctx: &Arc<Context>) -> Result<Arc<Module>, EmbeddedModuleError> {
        let image =
            loadable_payload(&self.bundle).expect("EmbeddedModule always has a loadable payload");
        ctx.load_module_from_image(image)
            .map_err(EmbeddedModuleError::Driver)
    }
}

pub fn artifact_bundles_from_current_exe() -> Result<Vec<OwnedArtifactBundle>, EmbeddedModuleError>
{
    let path =
        std::env::current_exe().map_err(|source| EmbeddedModuleError::CurrentExe { source })?;
    artifact_bundles_from_binary_path(path)
}

pub fn artifact_bundles_from_binary_path(
    path: impl AsRef<Path>,
) -> Result<Vec<OwnedArtifactBundle>, EmbeddedModuleError> {
    let path = path.as_ref();
    let bytes = std::fs::read(path).map_err(|source| EmbeddedModuleError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    oxide_artifacts::read_artifact_bundles_from_object_bytes(&bytes)
        .map_err(EmbeddedModuleError::Artifacts)
}

pub fn embedded_modules_from_current_exe() -> Result<Vec<EmbeddedModule>, EmbeddedModuleError> {
    Ok(artifact_bundles_from_current_exe()?
        .into_iter()
        .filter_map(EmbeddedModule::new)
        .collect())
}

pub fn load_embedded_module(
    ctx: &Arc<Context>,
    name: &str,
) -> Result<Arc<Module>, EmbeddedModuleError> {
    let module = embedded_modules_from_current_exe()?
        .into_iter()
        .find(|module| module.name() == name)
        .ok_or_else(|| EmbeddedModuleError::ModuleNotFound {
            name: name.to_string(),
        })?;
    module.load(ctx)
}

pub fn load_first_embedded_module(ctx: &Arc<Context>) -> Result<Arc<Module>, EmbeddedModuleError> {
    let module = embedded_modules_from_current_exe()?
        .into_iter()
        .next()
        .ok_or(EmbeddedModuleError::NoModules)?;
    module.load(ctx)
}

fn loadable_payload(bundle: &OwnedArtifactBundle) -> Option<&[u8]> {
    bundle
        .payload(ArtifactPayloadKind::Cubin)
        .or_else(|| bundle.payload(ArtifactPayloadKind::Ptx))
}

#[derive(Debug)]
pub enum EmbeddedModuleError {
    CurrentExe {
        source: std::io::Error,
    },
    Io {
        path: PathBuf,
        source: std::io::Error,
    },
    Artifacts(ArtifactError),
    ModuleNotFound {
        name: String,
    },
    NoModules,
    Driver(DriverError),
}

impl fmt::Display for EmbeddedModuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CurrentExe { source } => {
                write!(f, "failed to resolve the current executable: {source}")
            }
            Self::Io { path, source } => write!(f, "failed to read {}: {source}", path.display()),
            Self::Artifacts(error) => write!(f, "failed to read embedded artifacts: {error}"),
            Self::ModuleNotFound { name } => {
                write!(f, "embedded CUDA module '{name}' was not found")
            }
            Self::NoModules => f.write_str("no embedded CUDA modules were found"),
            Self::Driver(error) => write!(f, "failed to load embedded CUDA module: {error}"),
        }
    }
}

impl std::error::Error for EmbeddedModuleError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::CurrentExe { source } | Self::Io { source, .. } => Some(source),
            Self::Artifacts(error) => Some(error),
            Self::Driver(error) => Some(error),
            Self::ModuleNotFound { .. } | Self::NoModules => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxide_artifacts::OwnedArtifactPayload;
    // Only the host-object tests below (gated to linux/x86_64) use these.
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    use oxide_artifacts::{
        build_artifact_blob, build_host_object_for_target, ArtifactBundleSpec, ArtifactPayloadSpec,
    };

    #[test]
    fn embedded_module_filters_unloadable_bundles() {
        let bundle = OwnedArtifactBundle {
            name: "demo".to_string(),
            target: "sm_90".to_string(),
            compile_options: ArtifactCompileOptions::new(),
            payloads: Vec::new(),
            entries: Vec::new(),
        };

        assert!(EmbeddedModule::new(bundle).is_none());
    }

    #[test]
    fn embedded_module_accepts_ptx_payload() {
        let bundle = OwnedArtifactBundle {
            name: "demo".to_string(),
            target: "sm_90".to_string(),
            compile_options: ArtifactCompileOptions::new(),
            payloads: vec![OwnedArtifactPayload {
                kind: ArtifactPayloadKind::Ptx,
                name: "demo.ptx".to_string(),
                bytes: b"ptx".to_vec(),
            }],
            entries: Vec::new(),
        };

        let module = EmbeddedModule::new(bundle).unwrap();
        assert_eq!(module.name(), "demo");
        assert_eq!(module.payload(ArtifactPayloadKind::Ptx), Some(&b"ptx"[..]));
    }

    #[test]
    fn embedded_module_accepts_cubin_payload() {
        let bundle = OwnedArtifactBundle {
            name: "demo".to_string(),
            target: "sm_90".to_string(),
            compile_options: ArtifactCompileOptions::new(),
            payloads: vec![OwnedArtifactPayload {
                kind: ArtifactPayloadKind::Cubin,
                name: "demo.cubin".to_string(),
                bytes: b"cubin".to_vec(),
            }],
            entries: Vec::new(),
        };

        let module = EmbeddedModule::new(bundle).unwrap();
        assert_eq!(module.name(), "demo");
        assert_eq!(
            module.payload(ArtifactPayloadKind::Cubin),
            Some(&b"cubin"[..])
        );
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    #[test]
    fn artifact_bundles_from_binary_path_reads_linked_executable() {
        let temp_dir = unique_temp_dir("cuda-core-embedded-artifacts");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let source_path = temp_dir.join("main.rs");
        let object_path = temp_dir.join("artifact.o");
        let exe_path = temp_dir.join("host");

        let blob = build_artifact_blob(&ArtifactBundleSpec::new("linked", "sm_90").with_payload(
            ArtifactPayloadSpec::new(ArtifactPayloadKind::Ptx, "linked.ptx", b"ptx"),
        ))
        .unwrap();
        // Mirror production: the backend always defines a link-anchor
        // symbol in the artifact object. The linked-executable round trip
        // must keep working with that symbol present.
        // `reserved_oxide_symbols::artifact_anchor_symbol("linked", "0.0.0")`,
        // precomputed: that crate is cuda-oxide-internal and not a
        // dependency here. Format: prefix + sanitized(name) + '_' +
        // sanitized(version), non-alphanumerics mapped to '_'.
        let anchor = "cuda_oxide_artifact_anchor_246e25db_linked_0_0_0".to_string();
        let object =
            build_host_object_for_target(&blob, "x86_64-unknown-linux-gnu", Some(anchor.as_str()))
                .unwrap();
        std::fs::write(&source_path, "fn main() {}\n").unwrap();
        std::fs::write(&object_path, object).unwrap();

        let rustc = std::env::var_os("RUSTC").unwrap_or_else(|| "rustc".into());
        let output = std::process::Command::new(rustc)
            .arg(&source_path)
            .arg("-C")
            .arg(format!("link-arg={}", object_path.display()))
            .arg("-o")
            .arg(&exe_path)
            .output()
            .unwrap();

        if !output.status.success() {
            panic!(
                "failed to link artifact test executable\nstdout:\n{}\nstderr:\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
        }

        let bundles = artifact_bundles_from_binary_path(&exe_path).unwrap();
        assert_eq!(bundles.len(), 1);
        assert_eq!(bundles[0].name, "linked");
        assert_eq!(
            bundles[0].payload(ArtifactPayloadKind::Ptx),
            Some(&b"ptx"[..])
        );

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    fn unique_temp_dir(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{name}-{}-{nanos}", std::process::id()))
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1885** (2026-11-27): **fix(cuda-oxide): enforce Blackwell cluster/tcgen05 fences in Lean 4 and support short-K GEMMs**
  *Symptoms*: ## What This PR Does  Closes four Blackwell 2-CTA cluster, `mbarrier` scope, `tcgen05.fence`, and short-`K` pipeline gaps across `CudaOxide`, `lean-exporter`, and the Blackwell examples:  | Area                        | Fix                                                                                  | |:----------------------------|:-------------------------------------------------------------------------------------| | 2-CTA `tcgen05.alloc` sync  | Enforces `cluster_sync()` from kernel entry `0` in Lean; adds syncs in unsafe GEMM   | | Cross-CTA `mbarrier` waits  | Models `.ctaAcquire` / `.clusterAcquire` / `.clusterRelaxed` and switches peer waits | | `tcgen05.fence` handoffs    | Requires `fence::after` and warp-convergent `fence::before` in `CtaState` + kernels  | | Short-`K` (`64, 128, 192`)  | Clamps `CLC` prefetch (`k_iters.saturating_sub(4)`), adds `k >= 64` contract & tests |  ---  ### Before vs. After  1. **2-CTA `TMEM` allocation ordering (`tcgen05_alloc_cg2`)**    ```text    Before: [mbarrier_init] ──(cluster_sync)──► [alloc_cg2]   (skipped if no mbarrier_init; missing in gemm_sol_final)    After:  [Kernel Entry ] ──(cluster_sync)──► [alloc_cg2]   (enforced in Lean + added in gemm_sol_final)    ```  2. **Cross-CTA `mbarrier` wait scope (`mbarrier_try_wait_parity_cluster`)**    ```text    Before: try_wait(&BAR)         ──► mbarReady(BAR)                  ──► Accepted on peer-CTA barriers    After:  try_wait(&BAR)         ──► mbarReady(BAR, .ctaAcquire)     ──► 

- **Issue #1883** (2026-11-27): **fix(lean-exporter): preserve register identity across blocks**
  *Symptoms*: Closes #1882.  ## What This PR Does  Fixes cross-block register clobbering in `lean-exporter` (`translate/program.rs`) where SSA values captured inside value aggregates (`struct`, `tuple`, `array`, `enum`) or `Barrier` array slot indices were assigned per-block recycled Tier-2 scratch IDs and overwritten in downstream blocks:  ```text BEFORE (`main`):   Block 1:  `x = index_1d()`        ──► recycled scratch slot #25             `pair = (x, 0)`         ──► `struct_fields[pair]` records slot #25   Block 2:  `dummy = 0`             ──► reuses slot #25 (OVERWRITES #25 with `0`!)             `idx = pair.0`          ──► reads slot #25 -> gets `0` instead of `index_1d()`!  AFTER (This PR):   • Promote aggregate operands (`construct_struct`, `construct_tuple`, `construct_array`,     `construct_enum`, `insert_field`), aggregate results, and `SharedArray<Barrier, N>` slot     indices into persistent Tier-1 registers (`0..local_base_vid`).   • Read canonical `insert_index` on `mir.insert_field` and evict Tier-2 slots from     `smem_desc_ready` at basic-block boundaries.   • Enforce `check_no_tier2_cross_block_escape` in both debug and release builds so any     upward-exposed Tier-2 register read fails closed. ```  ---  ## Verification  * **Lean 4 & Exporter Suite**: `CUDA_OXIDE_REQUIRE_LEAN=1 cargo test -p lean-exporter --all-targets`: **PASS** * **Lints & Guards**: `cargo clippy -p lean-exporter --all-targets -- -D warnings`, `rustdoc -D warnings`, `cargo oxide fmt --check`, and `check

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

### Incident Patch 1: `298736cf` (2026-11-27)
**Commit Message**: fix(oxide-proofs): allow Step 8 Or-splitting when iteFuel reaches zero (#1868)

Closes #1867.

## What This PR Does

Fixes an indentation bug in
`CudaOxide.Proofs.Program.Tactic.solveVcGoals` (`Tactic.lean`) where
Step 8 (case-splitting `P ∨ Q` disjunction hypotheses in context) was
nested inside Step 7's `if iteFuel > 0` guard:

```text
BEFORE (`main` - Step 8 indented inside `if iteFuel > 0`):
  if iteFuel > 0 then
    -- Step 7: split `if cond then a else b` subterms (consumes `iteFuel`)
    -- Step 8: split `P ∨ Q` hypotheses  <-- skipped once 16 `ite` splits drain `iteFuel`!

AFTER (This PR - un-indents Step 8 by 2 spaces):
  if iteFuel > 0 then
    -- Step 7: split `if cond then a else b` subterms (consumes `iteFuel`)
  -- Step 8: split `P ∨ Q` hypotheses    <-- runs whenever structural `fuel > 0`!
```

---

## Changes

* **`CudaOxide/Proofs/Program/Tactic.lean`**: Un-indent Step 8 out of
`if iteFuel > 0` while preserving structural `fuel - 1` recursion
bounds.
* **`tests/program/OrSplitAfterIteFuel.lean` & `check.py`**: Add two `0
sorryAx` regression theorems covering both `iteFuel = 0` directly and
`mir_solve_vc` after 16 `ite` splits exhaust `iteFuel`.

---

## Verificatio

**File**: `cuda-oxide/oxide-proofs-preview/CudaOxide/Proofs/Program/Tactic.lean` (modified, +10/-10)
```diff
@@ -411,16 +411,16 @@ partial def solveVcGoals (fuel iteFuel : Nat) : TacticM Unit := do
         solveVcGoals (fuel - 1) (iteFuel - 1)
         setGoals []
         return
-      for d in (← getLCtx) do                             -- Step 8: Case-split any `P ∨ Q` disjunction hypothesis
-        if !d.isImplementationDetail then
-          let dTy ← whnfR (← instantiateMVars d.type)
-          if dTy.isAppOfArity ``Or 2 then
-            let subs ← (← getMainGoal).cases d.fvarId
-            for sub in subs do
-              setGoals [sub.mvarId]
-              solveVcGoals (fuel - 1) iteFuel
-            setGoals []
-            return
+    for d in (← getLCtx) do                               -- Step 8: Case-split any `P ∨ Q` disjunction hypothesis
+      if !d.isImplementationDetail then
+        let dTy ← whnfR (← instantiateMVars d.type)
+        if dTy.isAppOfArity ``Or 2 then
+          let subs ← (← getMainGoal).cases d.fvarId
+          for sub in subs do
+            setGoals [sub.mvarId]
+            solveVcGoals (fuel - 1) iteFuel
+          setGoals []
+          return
     if (← try evalTactic (← `(tactic| (mir_mul_mono; omega))); pure true catch _ => pure false) then return -- Step 9: Nonlinear bounds + `omega`
     evalTactic (← `(tactic| omega))                       -- Final step: run `omega` directly so any failure prints a clean counterexample
 
```

**File**: `cuda-oxide/oxide-proofs-preview/check.py` (modified, +1/-0)
```diff
@@ -80,6 +80,7 @@ def main():
     require_success("env", "lean", "tests/vecadd/Accepted.lean")
     require_success("env", "lean", "tests/vecadd/Counterexamples.lean")
     require_success("env", "lean", "tests/program/UnknownGuard.lean")
+    require_success("env", "lean", "tests/program/OrSplitAfterIteFuel.lean")
     print("PASS: scalar semantics, vecadd access model, typed indices, and counterexamples.", flush=True)
     for filename, label in REJECTED:
         rel_path = filename if "/" in filename else f"tests/vecadd/{filename}"
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/program/OrSplitAfterIteFuel.lean` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/-
+SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+SPDX-License-Identifier: Apache-2.0
+-/
+
+import Lean
+import CudaOxide
+
+/-!
+Regression tests for `CudaOxide.Proofs.Program.Tactic.solveVcGoals`:
+Step 8 must still case-split `Or` hypotheses in context when `iteFuel` reaches `0`.
+-/
+namespace OrSplitAfterIteFuelTests
+open CudaOxide.Proofs.Program
+
+open Lean Elab Tactic in
+local elab "mir_solve_vc_ite0" : tactic => solveVcGoals 512 0
+
+/-- Disjunction hypothesis splitting still fires when `iteFuel = 0` on a nonlinear goal
+    that plain `omega` and `mir_mul_mono; omega` without `Or`-splitting cannot solve. -/
+theorem orSplit_zero_iteFuel (a b c d M : Nat)
+    (h : (a ≤ c ∧ c * b ≤ M) ∨ (a ≤ d ∧ d * b ≤ M)) : a * b ≤ M := by
+  mir_solve_vc_ite0
+
+/-- Public `mir_solve_vc` (`iteFuel = 16`) still splits `Or` hypotheses after 16 `ite`
+    splits exhaust `iteFuel`. -/
+theorem orSplit_after_iteFuel_exhausted (t a b c d M : Nat) (ht : 16 ≤ t)
+    (h : (a ≤ c ∧ c * b ≤ M) ∨ (a ≤ d ∧ d * b ≤ M))
+    (h16 : (if t = 0 then 0 else if t = 1 then 0 else if t = 2 then 0 else if t = 3 then 0 else
+            if t = 4 then 0 else if t = 5 then 0 else if t = 6 then 0 else if t = 7 then 0 else
+            if t = 8 then 0 else if t = 9 then 0 else if t = 10 then 0 else if t = 11 then 0 else
+            if t = 12 then 0 else if t = 13 then 0 else if t = 14 then 0 else if t = 15 then 0 else 1) = 1) :
+    a * b ≤ M := by
+  mir_solve_vc
+
+#print axioms orSplit_zero_iteFuel
+#print axioms orSplit_after_iteFuel_exhausted
+
+end OrSplitAfterIteFuelTests
```

---

### Incident Patch 2: `8b91bb75` (2026-11-27)
**Commit Message**: fix(lean-exporter): allocate OpaqueUint IDs from opaque_ids (#1881)

Closes #1880.

## What This PR Does

Fixes an oracle-ID aliasing bug in `lean-exporter`
(`translate/program.rs`) where `fallback_rhs_for` accepted an explicit
ID map parameter and two call sites (`mir.extract_array_element` and
`nvvm.clc_query_*`) passed the recycled register map `&val_ids` instead
of the monotonic `&opaque_ids` map:

```text
BEFORE (`main`):
  Block 1:  `ld0 = mir.load(...)`                  ──► `opaque_ids` #7  ──► `OpaqueUint(7, 32)`
  Block 2:  `elem = mir.extract_array_element(..)` ──► `val_ids`    #7  ──► `OpaqueUint(7, 32)`  (COLLISION!)
            Lean treated two unrelated runtime values as equal (`env.opaqueUint t 7`)!

AFTER (This PR):
  `fallback_rhs_for` captures `opaque_ids` directly (and `CtaUint1` on `clc_query_*` also reads
  `opaque_ids`), so every opaque/CTA integer definition receives a strictly increasing ID.
```

---

## Changes

* **`crates/lean-exporter/src/translate/program.rs`**:
* Capture `opaque_ids` directly inside `fallback_rhs_for` and allocate
`clc_query_*` (`CtaUint1` / `OpaqueUint`) IDs from `opaque_ids`.
  * Remove the shadowed duplicate `"mir.array_element_addr

**File**: `cuda-oxide/crates/lean-exporter/src/translate/program.rs` (modified, +27/-66)
```diff
@@ -1592,7 +1592,10 @@ pub(super) fn translate_mir_program(
 
     let mut pending_asserts: Vec<PendingAssert> = Vec::new();
 
-    let fallback_rhs_for = |v: Value, opaque_ids: &HashMap<Value, usize>| -> MirRhs {
+    // Capture `opaque_ids` directly so every fallback oracle ID is allocated from the
+    // monotonic `opaque_ids` map (strictly increasing in RPO definition order) and can
+    // never alias per-block `val_ids`.
+    let fallback_rhs_for = |v: Value| -> MirRhs {
         let w = mir_uint_width(ctx, v.get_type(ctx));
         if w > 1 {
             MirRhs::OpaqueUint(opaque_ids[&v], w)
@@ -2278,25 +2281,24 @@ pub(super) fn translate_mir_program(
                         span_elems,
                     ));
                 }
-                "nvvm.clc_query_is_canceled" if op.get_num_results() == 1 => {
-                    let res = op.get_result(0);
-                    let rhs = match op.operands().next() {
-                        Some(v) => MirRhs::CtaUnary(val_ids[&v]),
-                        None => MirRhs::CtaConst,
-                    };
-                    stmts.push(MirStmt::Assign(val_ids[&res], rhs));
-                }
-                "nvvm.clc_query_get_first_ctaid_x"
+                "nvvm.clc_query_is_canceled"
+                | "nvvm.clc_query_get_first_ctaid_x"
                 | "nvvm.clc_query_get_first_ctaid_y"
                 | "nvvm.clc_query_get_first_ctaid_z"
                     if op.get_num_results() == 1 =>
                 {
                     let res = op.get_result(0);
                     let w = mir_uint_width(ctx, res.get_type(ctx));
-                    let eff_w = if w > 1 { w } else { 32 };
-                    let rhs = match op.operands().next() {
-                        Some(v) => MirRhs::CtaUint1(val_ids[&res], eff_w, val_ids[&v]),
-                        None => MirRhs::OpaqueUint(val_ids[&res], eff_w),
+                    let rhs = if w > 1 {
+                        match op.operands().next() {
+                            Some(v) => MirRhs::CtaUint1(opaque_ids[&res], w, val_ids[&v]),
+                            None => MirRhs::OpaqueUint(opaque_ids[&res], w),
+                        }
+                    } else {
+                        match op.operands().next() {
+                            Some(v) => MirRhs::CtaUnary(val_ids[&v]),
+                            None => MirRhs::CtaConst,
+                        }
                     };
                     stmts.push(MirStmt::Assign(val_ids[&res], rhs));
                 }
@@ -2528,10 +2530,7 @@ pub(super) fn translate_mir_program(
                     for r_idx in 0..op.get_num_results() {
                         let res = op.get_result(r_idx);
                         tags.insert(res, LocalTag::TmemLoadedReg(ld_id));
-                        stmts.push(MirStmt::Assign(
-                            val_ids[&res],
-                            fallback_rhs_for(res, &opaque_ids),
-                        ));
+                        stmts.push(MirStmt::Assign(val_ids[&res], fallback_rhs_for(res)));
                     }
                 }
                 "nvvm.tcgen05_load_wait" => {
@@ -2817,10 +2816,7 @@ pub(super) fn translate_mir_program(
                             pending_asserts.remove(pos);
                         }
                     }
-                    stmts.push(MirStmt::Assign(
-                        val_ids[&res],
-                        fallback_rhs_for(res, &val_ids),
-                    ));
+                    stmts.push(MirStmt::Assign(val_ids[&res], fallback_rhs_for(res)));
                 }
                 "mir.insert_field" if op.get_num_operands() == 2 && op.get_num_results() == 1 => {
                     let (base_s, fv, res) =
@@ -2884,19 +2880,6 @@ pub(super) fn translate_mir_program(
                         stmts.push(MirStmt::Assign(val_ids[&res], MirRhs::OpaqueVal));
                     }
                 }
-                "mir.array_element_addr"
-                    if op.get_num_operands() >= 2 && op.get_num_results() == 1 =>
-                {
-                    let idx_v = op.get_operand(1);
-                    if let Some(pos) = pending_asserts.iter().rposition(|p| p.idx_val == idx_v) {
-                        pending_asserts.remove(pos);
-                    }
-                    let res = op.get_result(0);
-                    if matches!(tags.get(&op.get_operand(0)), Some(LocalTag::StackSlot)) {
-                        tags.insert(res, LocalTag::StackSlot);
-                    }
-                    stmts.push(MirStmt::Assign(val_ids[&res], MirRhs::OpaqueVal));
-                }
                 "mir.constant" | "builtin.constant" if op.get_num_results() == 1 => {
                     let res = op.get_result(0);
                     let w = mir_uint_width(ctx, res.get_type(ctx));
@@ -2913,16 +2896,10 @@ pub(super) fn translate_mir_program(
                             stmts
                                 .push(Mi
```

**File**: `cuda-oxide/crates/lean-exporter/tests/export.rs` (modified, +138/-0)
```diff
@@ -2810,6 +2810,144 @@ fn accepts_raw_pointer_read_of_a_slice_parameter_no_verify_clause_names() {
         .expect("raw read of a slice parameter that no verify clause names stays accepted");
 }
 
+/// Collect all `(id, width)` pairs from [`lean_exporter::translate::program::MirRhs::OpaqueUint`]
+/// assignments in RPO block and statement emission order.
+fn collect_program_opaque_uints(
+    program: &lean_exporter::translate::program::MirProgramData,
+) -> Vec<(usize, u32)> {
+    use lean_exporter::translate::program::{MirRhs, MirStmt};
+
+    let mut out = Vec::new();
+    for blk in &program.blocks {
+        for stmt in &blk.stmts {
+            if let MirStmt::Assign(
+                _,
+                MirRhs::OpaqueUint(id, width) | MirRhs::CtaUint1(id, width, _),
+            ) = stmt
+            {
+                out.push((*id, *width));
+            }
+        }
+    }
+    out
+}
+
+/// Ensure `nvvm.clc_query_*`, `mir.extract_array_element`, and `mir.load` allocate
+/// globally distinct, strictly monotonic `OpaqueUint` IDs from `opaque_ids` across both a
+/// minimal multi-block synthetic kernel and all shipped `MirFunc` exporter fixtures.
+#[test]
+fn clc_query_and_array_element_use_distinct_opaque_ids() {
+    let collision_mir = r#"
+builtin.module @opaque_id_collision {
+  ^entry():
+    mir.func @opaque_id_collision_k: builtin.function <(mir.slice <builtin.integer ui32 ,mutable:false,kind:SharedRef>) -> ()>
+      [gpu_kernel: builtin.string "true", launch_contract_domain: builtin.integer <1: ui32>, reqntid_x: builtin.integer <32: ui32>, reqntid_y: builtin.integer <1: ui32>, reqntid_z: builtin.integer <1: ui32>, verify_no_oob_idx: builtin.string "0"]
+    {
+      ^entry(a: mir.slice <builtin.integer ui32 ,mutable:false,kind:SharedRef>):
+        z64 = mir.constant () [] [value: builtin.integer <0: ui64>]: <() -> (builtin.integer ui64)>;
+        a_ptr = mir.extract_field (a) [] [index: mir.field_index 0]: <(mir.slice <builtin.integer ui32 ,mutable:false,kind:SharedRef>) -> (mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>)>;
+        a_len = mir.extract_field (a) [] [index: mir.field_index 1]: <(mir.slice <builtin.integer ui32 ,mutable:false,kind:SharedRef>) -> (builtin.integer ui64)>;
+        ok = mir.lt (z64, a_len) [] []: <(builtin.integer ui64, builtin.integer ui64) -> (builtin.integer i1)>;
+        mir.cond_br (ok) [^blk0, ^exit] [builtin_operand_segment_sizes: builtin.operand_segment_sizes [1, 0, 0]]: <(builtin.integer i1) -> ()>
+
+      ^blk0():
+        p0 = mir.ptr_offset (a_ptr, z64) [] []: <(mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>, builtin.integer ui64) -> (mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>)>;
+        ld0 = mir.load (p0) [] []: <(mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>) -> (builtin.integer ui32)>;
+        p1 = mir.ptr_offset (a_ptr, z64) [] []: <(mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>, builtin.integer ui64) -> (mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>)>;
+        ld1 = mir.load (p1) [] []: <(mir.ptr <builtin.integer ui32 ,mutable:false,addrspace:0,kind:Erased>) -> (builtin.integer ui32)>;
+        mir.goto () [^blk1] []: <() -> ()>
+
+      ^blk1():
+        c_arr = mir.construct_array (ld0, ld1) [] []: <(builtin.integer ui32, builtin.integer ui32) -> (mir.array <builtin.integer ui32, 2>)>;
+        _elem_v = mir.extract_array_element (c_arr, z64) [] []: <(mir.array <builtin.integer ui32, 2>, builtin.integer ui64) -> (builtin.integer ui32)>;
+        _q_x = nvvm.clc_query_get_first_ctaid_x (z64, z64) [] []: <(builtin.integer ui64, builtin.integer ui64) -> (builtin.integer ui32)>;
+        _q_c = nvvm.clc_query_is_canceled (z64, z64) [] []: <(builtin.integer ui64, builtin.integer ui64) -> (builtin.integer ui32)>;
+        mir.return () [] []: <() -> ()>
+
+      ^exit():
+        mir.return () [] []: <() -> ()>
+    }
+}
+"#;
+    let prog = translate_named_mir_program(collision_mir, "opaque_id_collision_k");
+    let opaques = collect_program_opaque_uints(&prog);
+    assert_eq!(
+        opaques.len(),
+        5,
+        "expected 5 OpaqueUint values: {opaques:?}"
+    );
+    let unique: std::collections::HashSet<usize> = opaques.iter().map(|&(id, _)| id).collect();
+    assert_eq!(
+        unique.len(),
+        5,
+        "load, extract_array_element, and clc_query_* must have distinct OpaqueUint IDs: {opaques:?}"
+    );
+    assert!(
+        opaques.windows(2).all(|w| w[0].0 < w[1].0),
+        "OpaqueUint IDs must be strictly increasing in RPO emission order: {opaques:?}"
+    );
+    let lean = export_named_source(collision_mir, "opaque_id_collision_k")
+        .expect("transcribes opaque_id_collision_k");
+    if let Some(lean_dir) = lean_package_dir_if_available() {
+        lean_exporter::runner::check_generated_lean(&lean, &lean_dir)
+            .expect("Lean 4 accepts kerne
```

---

### Incident Patch 3: `28a30056` (2026-11-27)
**Commit Message**: fix(verify): refuse reads of a shared array while a TMA copy into it is pending (#1877)

## What This PR Does

Closes a soundness gap in `#[verify(uniform_barriers)]` /
`#[verify(no_data_race)]` where replacing an `mbarrier_try_wait_parity`
spin loop with `thread::sync_threads()` after an asynchronous
`cp_async_bulk_tensor_*_g2s` copy was accepted even though no thread
awaited TMA completion before reading the destination `SharedArray`:

```rust
if tid == 0 {
    let _ = mbarrier_arrive_expect_tx(&raw const BAR, 1, TILE_BYTES);
    cp_async_bulk_tensor_2d_g2s_cta(&raw mut TILE as *mut u8, tensor_map, tile_x, tile_y, &raw mut BAR);
}
thread::sync_threads(); // orders Thread 0's issue instruction, NOT TMA completion!
let val = TILE[tid];    // reads `TILE` while the TMA copy is still in flight
```

```text
BEFORE (`main`):
  1. `MirNoSharedRace` only compares events in the same `sync_threads()` phase
     (TMA copy in Phase 0 vs. `TILE[tid]` in Phase 1 -> skipped!)
  2. `stepOp` blocked `.sharedWrite` and `.tmemAsyncIssue` while `sharedPendingTma[s]`
     was non-empty, but allowed `.sharedRead s` -> kernel falsely stamped proved!

AFTER (This PR):
  • `stepOp` on `.sharedRead s` (`M

**File**: `cuda-oxide/oxide-proofs-preview/CudaOxide/Mir/ControlFlow.lean` (modified, +6/-1)
```diff
@@ -750,7 +750,12 @@ def stepOp (cfg : ControlFlowCfg) (curBlk : Nat) (blkGuard : GuardExpr) (inCycle
             | .needsFence => .clean
             | other => other }
   | .sharedRead s =>
-      if s < st.sharedProxy.length then some st else none
+      if s ≥ st.sharedProxy.length || s ≥ st.sharedPendingTma.length then
+        none
+      else if !(st.sharedPendingTma.getD s []).isEmpty then
+        none
+      else
+        some st
   | .dsmemAccess s =>
       if cfg.clusterDimX ≤ 1 || s ≥ st.sharedClusterSynced.length then
         none
```

**File**: `cuda-oxide/oxide-proofs-preview/CudaOxide/Proofs/ControlFlow/Lattice.lean` (modified, +13/-5)
```diff
@@ -358,12 +358,20 @@ theorem stepOp_mono (cfg : ControlFlowCfg) (curBlk : Nat) (blkGuard : GuardExpr)
       exact ⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨⟨
         listSubsumes_map proxyStepFence_mono hsp, hpt⟩, hsc⟩,
         listSubsumes_map proxyStepFence_mono hbp⟩, hbs⟩, htp⟩, hcl⟩, hac⟩, hmh⟩, hmi⟩, hcb⟩, htcr⟩, htr⟩, hufw⟩, hufl⟩, hpl⟩, hss⟩, hcs⟩, hrp⟩, hvp⟩
-  | sharedRead s =>                                       -- Case 4: Generic-proxy shared read
+  | sharedRead s =>                                       -- Case 4: Generic-proxy shared read requires no pending TMA on `s`
       dsimp only [stepOp] at hstep ⊢
-      rw [← hlenSP]
-      by_cases hslt : s < abs.sharedProxy.length
-      · rw [if_pos hslt] at hstep ⊢; injection hstep with hstep; subst hstep; exact ⟨conc, rfl, hsub⟩
-      · rw [if_neg hslt] at hstep; contradiction
+      rw [← hlenSP, ← hlenPT]
+      by_cases hpre : (decide (s ≥ abs.sharedProxy.length) || decide (s ≥ abs.sharedPendingTma.length)) = true
+      · rw [if_pos hpre] at hstep; contradiction
+      · rw [if_neg hpre] at hstep ⊢
+        cases hemp : (abs.sharedPendingTma.getD s []).isEmpty
+        · rw [hemp] at hstep; contradiction
+        · rw [hemp] at hstep; simp only [Bool.not_true, Bool.false_eq_true, ↓reduceIte] at hstep
+          have hptS := listSubsumes_getD (sub := fun a c => natSubset c a) (d := []) (natSubset_refl []) s hpt
+          have hcEmp : (conc.sharedPendingTma.getD s []).isEmpty = true := natSubset_isEmpty hptS hemp
+          injection hstep with hstep; subst hstep
+          simp only [hcEmp, Bool.not_true, Bool.false_eq_true, ↓reduceIte]
+          exact ⟨conc, rfl, hsub⟩
   | dsmemAccess s =>                                      -- Case 5: Cross-CTA DSMEM access requires `sharedClusterSynced[s]`
       dsimp only [stepOp] at hstep ⊢
       rw [← hlenSC]
```

**File**: `cuda-oxide/oxide-proofs-preview/check-exporter.py` (modified, +24/-0)
```diff
@@ -467,6 +467,30 @@ def main():
             raise RuntimeError(f"Expected bypassing mbarrier_try_wait_parity to fail NoDataRace in Lean:\n{res_no_wait.stdout}")
         print("REJECTED as expected: reading `TILE` without `mbarrier_try_wait_parity` fails `no_data_race`.", flush=True)
 
+        # Mutate async_copy_stage MIR by replacing the `mbarrier_try_wait_parity` loop with `sync_threads()`.
+        # The copy and the read then sit in different barrier phases, so only `uniform_barriers` can refuse it:
+        wait_loop = async_source[async_source.index("      ^wait_header():"):async_source.index("      ^consume_tile():")]
+        sync_for_wait_mir = temporary / "async_copy_sync_for_wait.mir"
+        sync_for_wait_mir.write_text(
+            async_source.replace(
+                wait_loop,
+                "      ^wait_header():\n"
+                "        nvvm.barrier0 () [] []: <() -> ()>;\n"
+                "        mir.goto () [^consume_tile] []: <() -> ()>\n\n",
+                1,
+            )
+        )
+        sync_for_wait_lean = require_export(sync_for_wait_mir, "async_copy_stage")
+        sync_for_wait_file = temporary / "AsyncCopySyncForWait.lean"
+        sync_for_wait_file.write_text(
+            "\n".join(line for line in sync_for_wait_lean.splitlines() if not line.startswith("#print axioms"))
+        )
+        res_sync_for_wait = run_lake("env", "lean", str(sync_for_wait_file))
+        if (res_sync_for_wait.returncode == 0 or "checkUniformBarriersWith" not in res_sync_for_wait.stdout
+                or "error: omega could not prove the goal:" in res_sync_for_wait.stdout):
+            raise RuntimeError(f"Expected sync_threads in place of the mbarrier wait to fail only UniformBarriers in Lean:\n{res_sync_for_wait.stdout}")
+        print("REJECTED as expected: `sync_threads()` in place of `mbarrier_try_wait_parity` before reading `TILE` fails `uniform_barriers`.", flush=True)
+
         # Mutate async_copy_stage MIR with oversized 32 KB TMA byte count into 16 KB `TILE`:
         oversized_tma_mir = temporary / "async_copy_oversized.mir"
         oversized_tma_mir.write_text(
```

**File**: `cuda-oxide/oxide-proofs-preview/check.py` (modified, +13/-0)
```diff
@@ -27,6 +27,10 @@
     ("tests/program/RejectedUnknownWriteCoverage.lean", "write coverage claimed across an untracked guard"),
     ("tests/program/RejectedDivergentLoopUniformity.lean", "barrier loop bounded by a split-thread join"),
 )
+# Refused by the CTA state machine: `decide` evaluates `checkUniformBarriersWith` to `false`.
+REJECTED_BARRIERS = (
+    ("RejectedTmaReadAfterSync.lean", "TMA destination read after sync_threads without an mbarrier wait"),
+)
 
 
 def find_lake():
@@ -91,6 +95,15 @@ def main():
         if "error: omega could not prove the goal:" not in result.stdout:
             raise RuntimeError(f"Unexpected failure in {filename}:\n{result.stdout}")
         print(f"REJECTED as expected: {label}.", flush=True)
+    for filename, label in REJECTED_BARRIERS:
+        result = run_lake("env", "lean", f"tests/vecadd/{filename}")
+        if result.returncode == 0:
+            raise RuntimeError(f"The false obligation unexpectedly passed: {filename}")
+        # Require the barrier check itself to evaluate to `false`, not an import or tool error.
+        if ("error: Tactic `decide` proved that the proposition" not in result.stdout
+                or "checkUniformBarriersWith" not in result.stdout):
+            raise RuntimeError(f"Unexpected failure in {filename}:\n{result.stdout}")
+        print(f"REJECTED as expected: {label}.", flush=True)
     print("Model checks passed. Rust/MIR extraction is not implemented by this checker.")
 
 
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/vecadd/Accepted.lean` (modified, +20/-0)
```diff
@@ -77,10 +77,30 @@ theorem rev_writes_all_elems :
   apply CudaOxide.Proofs.Program.vcWritesAllElems rfl (by mir_bind_writes)
   mir_vc revMirFunc
 
+/-- Thread `0` arms `BAR` and starts a TMA copy into `TILE` (block `3`), every thread waits on `BAR`
+    (block `4`), then reads `TILE` (block `5`): the shape of `examples/safe_async_copy`.
+    `RejectedTmaReadAfterSync.lean` replaces the wait with `sync_threads()`. -/
+def tmaWaitCfg : ControlFlow.ControlFlowCfg :=
+  { blockDimX := 256, blockDimY := 1, numShared := 1, numBarriers := 1
+  , blocks := [
+      { succs := [(.coord (.eq .tx (.const 0)), 1), (.coord (.ne .tx (.const 0)), 2)] },
+      { ops := [.mbarInit 0 1, .proxyFenceAsyncShared], succs := [(.always, 2)] },
+      { ops := [.syncThreads]
+      , succs := [(.coord (.eq .tx (.const 0)), 3), (.coord (.ne .tx (.const 0)), 4)] },
+      { ops := [.mbarArriveExpectTx 0 16384, .tmaCopyG2S 0 0], succs := [(.always, 4)] },
+      { succs := [(.mbarSpin 0, 4), (.mbarReady 0 false, 5)] },
+      { ops := [.sharedRead 0], succs := [(.always, 6)] },
+      { isReturn := true } ] }
+
+theorem tma_read_after_wait : ControlFlow.UniformBarriersCfg tmaWaitCfg :=
+  CudaOxide.Proofs.ControlFlow.uniform_barriers_cfg_of_stateMap
+    (inv := CudaOxide.Proofs.ControlFlow.inferStateMap tmaWaitCfg) (by decide)
+
 #print axioms no_oob_idx_all
 #print axioms disjoint_writes_c
 #print axioms writes_all_elems_c
 #print axioms rev_writes_all_elems
+#print axioms tma_read_after_wait
 #print axioms CudaOxide.Mir.Program.ReachableTrapFree.toReachable
 #print axioms CudaOxide.Mir.Program.EmitsTrapFreeEvent.toEmitsEvent
 #print axioms index_lt_of_guard
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/vecadd/RejectedTmaReadAfterSync.lean` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+/-
+SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+SPDX-License-Identifier: Apache-2.0
+-/
+
+import CudaOxide
+
+/-!
+Negative model test: thread `0` arms `BAR` and starts a TMA copy into `TILE` (block `3`), then every
+thread executes `sync_threads()` (block `4`) and reads `TILE` (block `5`). Nobody waits on `BAR`.
+A CTA barrier orders the instruction that starts the copy, not its completion, so the read can see
+stale data. This is `examples/safe_async_copy` with `thread::sync_threads()` in place of the
+`mbarrier` wait. `Accepted.tma_read_after_wait` is the same graph with the wait.
+-/
+open CudaOxide.Mir.ControlFlow
+open CudaOxide.Contracts.ControlFlow
+open CudaOxide.Proofs.ControlFlow
+
+namespace RejectedTmaReadAfterSync
+
+def cfg : ControlFlowCfg :=
+  { blockDimX := 256, blockDimY := 1, numShared := 1, numBarriers := 1
+  , blocks := [
+      { succs := [(.coord (.eq .tx (.const 0)), 1), (.coord (.ne .tx (.const 0)), 2)] },
+      { ops := [.mbarInit 0 1, .proxyFenceAsyncShared], succs := [(.always, 2)] },
+      { ops := [.syncThreads]
+      , succs := [(.coord (.eq .tx (.const 0)), 3), (.coord (.ne .tx (.const 0)), 4)] },
+      { ops := [.mbarArriveExpectTx 0 16384, .tmaCopyG2S 0 0], succs := [(.always, 4)] },
+      { ops := [.syncThreads], succs := [(.always, 5)] },
+      { ops := [.sharedRead 0], succs := [(.always, 6)] },
+      { isReturn := true } ] }
+
+-- Intentionally false: the read in block `5` is refused while the copy on `BAR` is still pending.
+theorem false_claim : UniformBarriersCfg cfg :=
+  uniform_barriers_cfg_of_stateMap (cfg := cfg) (inv := inferStateMap cfg) (by decide)
+
+end RejectedTmaReadAfterSync
```

#### Recent Merged Pull Requests:
- **PR #1885** (2026-11-27): fix(cuda-oxide): enforce Blackwell cluster/tcgen05 fences in Lean 4 and support short-K GEMMs (@nihalpasham)
- **PR #1884** (2026-11-27): perf(cuda-oxide): compact UniformBarriers certificates and IntToInt CTA uniformity (@nihalpasham)
- **PR #1883** (2026-11-27): fix(lean-exporter): preserve register identity across blocks (@hs1167)
- **PR #1881** (2026-11-27): fix(lean-exporter): allocate OpaqueUint IDs from opaque_ids (@hs1167)
- **PR #1878** (2026-11-26): fix(cuda-oxide): support == requires, pure math intrinsics, and lake setup in #[verify] (@nihalpasham)
- **PR #1877** (2026-11-27): fix(verify): refuse reads of a shared array while a TMA copy into it is pending (@bastianhagedorn)

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

## X. oxide-proofs): allow Step 8 Or-splitting when iteFuel reaches zero

**RULE**:
When implementing operations in `cuda-oxide/oxide-proofs-preview/CudaOxide/Proofs/Program/Tactic.lean`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `298736cf`: oxide-proofs): allow Step 8 Or-splitting when iteFuel reaches zero. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/oxide-proofs-preview/CudaOxide/Proofs/Program/Tactic.lean`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    for d in (← getLCtx) do                               -- Step 8: Case-split any `P ∨ Q` disjunction hypothesis
      if !d.isImplementationDetail then
        let dTy ← whnfR (← instantiateMVars d.type)
        if dTy.isAppOfArity ``Or 2 then
          let subs ← (← getMainGoal).cases d.fvarId
          for sub in subs do
            setGoals [sub.mvarId]
            solveVcGoals (fuel - 1) iteFuel
          setGoals []
          return
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      for d in (← getLCtx) do                             -- Step 8: Case-split any `P ∨ Q` disjunction hypothesis
        if !d.isImplementationDetail then
          let dTy ← whnfR (← instantiateMVars d.type)
          if dTy.isAppOfArity ``Or 2 then
            let subs ← (← getMainGoal).cases d.fvarId
            for sub in subs do
              setGoals [sub.mvarId]
              solveVcGoals (fuel - 1) iteFuel
            setGoals []
            return
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `298736cf` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
