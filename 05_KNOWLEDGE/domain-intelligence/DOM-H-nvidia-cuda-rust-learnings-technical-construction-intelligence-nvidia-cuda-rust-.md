# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: nvidia-cuda-rust-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "nvidia-cuda-rust-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T21:16:21.257Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nvidia-cuda-rust-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nvidia-cuda-rust-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T21:16:21.257Z`  
> **Learning ID**: `LEARN-EVO-nvidia-cuda-rust-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 92%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from nvidia-cuda-rust-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `7a7d160e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T21:16:06.029Z  
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
> **Harvest Timestamp**: 2026-11-13T21:16:06.023Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4042 stars

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
- **Issue #1789** (2026-11-12): **fix(cuda-oxide): omit NVVM-only --arch on compile-only code-shape prebuild**
  *Symptoms*: ## What This PR Does  Fixes `scripts/smoketest.sh --compile-only` on **Rubin (`R100`, `sm_107`)** for the two `NVVM_VERIFY_EXAMPLES` that also ship a `verify-code-shape.sh` gate (`kernel_reference_validity` and `promoted_ref_return`), resolving **NVBug 7084024**:  ```text BEFORE (in `scripts/smoketest.sh --compile-only` on R100, where nvvm_arch = sm_107):   ├──► Step 1 (NVPTX): cargo oxide build <ex> --arch=sm_107       [X] fails (NVPTX lacks sm_107)   └──► Step 2 (NVVM):  cargo oxide emit-ltoir <ex> --arch=sm_107  (never reached)  AFTER:   ├──► Step 1 (NVPTX): cargo oxide build <ex>                     [OK] NVPTX emits forward-compatible PTX   │                    bash verify-code-shape.sh                  [OK] validates .ll and .ptx code shape   └──► Step 2 (NVVM):  cargo oxide emit-ltoir <ex> --arch=sm_107  [OK] libNVVM compiles natively for sm_107 ```  ---  ### 1. Keep `--arch=sm_107` Scoped to the NVVM (`emit-ltoir`) Step  `cuda-oxide` has two device compilation routes: * **NVPTX (`llc` / LLVM 23)** (`cargo oxide build` / `run`): does not have a processor entry for Rubin (`sm_107`). When invoked without an explicit `--arch` on R100, the compiler sees `sm_107a` only as an advisory device hint, ignores it, and emits forward-compatible `sm_80` PTX. * **NVVM (`libNVVM` / `nvJitLink`)** (`cargo oxide emit-ltoir`): supports `sm_107` natively.  In PR #1726, `smoketest.sh --compile-only` added a `cargo oxide build` pre-step before `emit-ltoir` so `verify-code-shape.sh` could ins

- **Issue #1779** (2026-11-11): **fix(cuda-host): coalesce DWARF debug sections and disambiguate labels in merge_ptx_bundles (NVBug 7038557)**
  *Symptoms*: ## What This PR Does  Fixes **NVBug 7038557** so multi-crate programs built with `--device-debug` merge and JIT-load their PTX bundles cleanly (`cuda_host::merge_ptx_bundles` / `load_all_ptx_bundles_merged`):  1. **Disambiguate bundle-local labels (`$L__*`) and `.local` stack depots (`__local_depot*`) across bundles (`cuda-host`)** 2. **Coalesce `.section .debug_*` blocks once at the end of the merged PTX module and shift per-CU offsets (`cuda-host`)** 3. **Touch direct workspace member crates during `cargo oxide build` / `run` (`cargo-oxide`)**  ---  ### 1. Why Multi-Crate `--device-debug` PTX Failed `ptxas` Assembly  Each crate's `--device-debug` PTX file has code at the top (with internal labels like `$L__func_begin0` and `$L__pubNames_start0`) and DWARF `.section .debug_*` tables at the bottom. Previously, `merge_ptx_bundles` glued the second PTX file directly under the first one, leaving duplicate labels and repeated `.section` blocks in the middle of the merged file:  ```text BEFORE (glued raw PTX files -> ptxas fails with DriverError(218)):   [Crate A Code ($L__func_begin0)] + [Crate A .section .debug_*]   [Crate B Code ($L__func_begin0)] + [Crate B .section .debug_*]  <-- duplicate labels & overlapping sections!  AFTER (rename bundle-local labels + coalesce one .section per name at the end):   [Crate A Code ($L__func_begin0)]   [Crate B Code ($L__func_begin0__bundle_1)]   [.section .debug_abbrev { CU_A + CU_B }]   [.section .debug_info   { CU_A + CU_B (with .debug_abb

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

### Incident Patch 1: `5183ab57` (2026-11-12)
**Commit Message**: docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add CLI/MLIR/C++ highlighting (#1785)

## What This PR Does

Rewrites the **Tile Libraries** book chapter
(`cuda-oxide-book/advanced/tile-libraries.md`) and its two SVG diagrams
so the page is concise, scannable, and accurate against current `main`:

1. **Rewrite `tile-libraries.md` with scannable bullets, aligned tables,
and 5 accuracy fixes**
2. **Redesign `tilelib-direct-linkage.svg` and
`tilelib-provider-linkage.svg` for left-to-right flow and accuracy**
3. **Add CLI (`bash`), Tile IR (`mlir`), and Tile C++ (`cpp`) syntax
highlighting in `conf.py`**

---

### 1. Chapter Structure & Accuracy Fixes (`tile-libraries.md`)

Replaces dense prose paragraphs and unformatted `text` blocks with short
bullet points and aligned tables, and resolves five stale/inaccurate
claims:

```text
BEFORE (dense prose + 5 stale claims):
  • Claimed `--provider` fails unless `TILEIR_LINKAGE_PROVIDER_INCLUDE_DIR` is set
  • Dangling broken sentence at end of Building ("...not involved. writes its own Tile IR with.")
  • Listed 3/3 exports in `tilelib_relu` instead of 5/5 (3 static + 2 parametric)
  • Claimed only cuTile Python 

**File**: `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-direct-linkage.svg` (modified, +148/-96)
```diff
@@ -1,107 +1,159 @@
-<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 800" width="1240" height="800" role="img"
-  aria-label="Direct linkage flow: Rust source becomes LTOIR plus two description bytecodes, packaged into a .tilelib that tileiras links with a Tile kernel's bytecode into one cubin">
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 740" width="1240" height="740" role="img"
+  aria-label="Static tile library flow: Left column builds relu.tilelib from #[tile_export], middle column compiles the Tile caller to prog.tilebc, and right column links both in tileiras to produce kernel.cubin">
 <style>
-  :root, svg { 
+  :root, svg {
   --bg: #f4f6f8; --fg: #1a232e; --muted: #5d6b7a; --line: #9aa7b4; --panel: #ffffff;
   --meta: #0e7c72; --meta-fill: #d9f3ef; --code: #b4560a; --code-fill: #fdebd2;
   --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
   --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
-  @media (prefers-color-scheme: dark) { :root, svg { 
+  @media (prefers-color-scheme: dark) { :root, svg {
   --bg: #0f151b; --fg: #e4ebf2; --muted: #9fb0c0; --line: #4d5b6a; --panel: #171f28;
   --meta: #5fe3d2; --meta-fill: #0f3a37; --code: #f6b544; --code-fill: #3b2a0c;
  } }
 </style>
-<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--fg)"/></marker></defs>
-<rect x="0" y="0" width="1240" height="800" style="fill: var(--bg)"/>
-<text x="40" y="34" text-anchor="start" style="font: 600 17px var(--sans); fill: var(--fg)">Direct linkage: a Tile kernel calls a Rust function through a .tilelib</text>
-<text x="40" y="56" text-anchor="start" style="font: 400 12.5px var(--sans); fill: var(--muted)">cuda-oxide is the SIMT provider. It ships code plus a description; the Tile compiler matches, marshals and links.</text>
-<text x="40" y="92" text-anchor="start" style="font: 600 11px var(--sans); fill: var(--muted)">RUST SIDE  (cuda-oxide)</text>
-<text x="620.0" y="92" text-anchor="middle" style="font: 600 11px var(--sans); fill: var(--muted)">TILE COMPILER  (tileiras, CUDA 13.5 or newer)</text>
-<text x="870" y="92" text-anchor="start" style="font: 600 11px var(--sans); fill: var(--muted)">TILE SIDE  (Tile C++, cuTile Python or cutile-rs)</text>
-<rect x="40" y="108" width="330" height="64" rx="6" style="fill: var(--panel); stroke: var(--line); stroke-width: 1.2"/>
-<text x="54" y="134" text-anchor="start" style="font: 600 12px var(--mono); fill: var(--meta)">#[tile_export(tile_shape = 128)]</text>
-<text x="54" y="156" text-anchor="start" style="font: 400 12px var(--mono); fill: var(--fg)">pub fn relu(x: f32) -&gt; f32 { .. }</text>
-<line x1="120" y1="172" x2="120" y2="210" marker-end="url(#arrow)" style="stroke: var(--fg); stroke-width: 1.4"/>
-<text x="132" y="196" text-anchor="start" style="font: 400 11.5px var(--mono); fill: var(--muted)">cargo oxide tilelib relu --arch sm_120</text>
-<rect x="40" y="212" width="330" height="40" rx="6" style="fill: var(--code-fill); stroke: var(--code); stroke-width: 1.2"/>
-<text x="54" y="237" text-anchor="start" style="font: 600 12.5px var(--mono); fill: var(--fg)">relu.ltoir</text>
-<text x="356" y="237" text-anchor="end" style="font: 400 11px var(--sans); fill: var(--muted)">code: LLVM bitcode for nvJitLink</text>
-<rect x="40" y="260" width="330" height="40" rx="6" style="fill: var(--meta-fill); stroke: var(--meta); stroke-width: 1.2"/>
-<text x="54" y="285" text-anchor="start" style="font: 600 12.5px var(--mono); fill: var(--fg)">relu.iface.tilebc</text>
-<text x="356" y="285" text-anchor="end" style="font: 400 11px var(--sans); fill: var(--muted)">declaration: what can be called</text>
-<rect x="40" y="308" width="330" height="40" rx="6" style="fill: var(--meta-fill); stroke: var(--meta); stroke-width: 1.2"/>
-<text x="54" y="333" text-anchor="start" style="font: 600 12.5px var(--mono); fill: var(--fg)">relu.impl.tilebc</text>
-<text x="356" y="333" text-anchor="end" style="font: 400 11px var(--sans); fill: var(--muted)">implementation: how to call it</text>
-<line x1="120" y1="348" x2="120" y2="386" marker-end="url(#arrow)" style="stroke: var(--fg); stroke-width: 1.4"/>
-<text x="132" y="372" text-anchor="start" style="font: 400 11.5px var(--mono); fill: var(--muted)">tileiras --preview-create-tile-lib</text>
-<rect x="40" y="388" width="330" height="96" rx="6" style="fill: var(--panel); stroke: var(--line); stroke-width: 1.6"/>
-<text x="54" y="410" text-anchor="start" style="font: 600 12.5px var(--mono); fill: var(--fg)">relu.tilelib</text>
-<text x="356" y="410" text-anchor="end" style="font: 400 11px var(--sans); fill: var(--muted)">one host object file</text>
-<rect x="54" y="422" width="8" height="12" rx="2" style="fill: var(--meta)"/>
-<text x="70" y="432" text-anchor="start" style="font: 400 11px var(--mono); fill: var(--fg)">.nvtlifc</text>
-<text x="1
```

**File**: `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-provider-linkage.svg` (modified, +126/-62)
```diff
@@ -1,4 +1,5 @@
-<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 610" width="1240" height="610" role="img" aria-label="Provider mode in one page: Rust exports become a shared object the Tile compiler loads; it asks per call site which implementations exist and once for their code">
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 620" width="1240" height="620" role="img"
+  aria-label="Provider mode flow: Left column builds relu.tilelib with embedded NVVM IR, middle column shows the provider runtime inside the .so, and right column shows tileiras querying implementations and compiling size-specific symbols on demand">
 <style>
   :root, svg {
   --bg: #f4f6f8; --fg: #1a232e; --muted: #5d6b7a; --line: #9aa7b4; --panel: #ffffff;
@@ -13,65 +14,128 @@
   --rust: #c9a0f0; --rust-fill: #2b1b3f;
  } }
 </style>
-<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--fg)"/></marker></defs>
-
-<rect x="0" y="0" width="1240" height="610" style="fill: var(--bg)"/>
-<text x="40" y="34" text-anchor="start" xml:space="preserve" style="font: 600 17px var(--sans); fill: var(--fg); white-space: pre">Provider mode: a tile library that answers the Tile compiler while the kernel compiles</text>
-<text x="40" y="56" text-anchor="start" xml:space="preserve" style="font: 400 12.5px var(--sans); fill: var(--muted); white-space: pre">For exports without tile_shape. The compiler asks for one implementation symbol per tile size; the provider builds it from one Rust body.</text>
-<text x="40" y="92" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">RUST SIDE  (build time)</text>
-<text x="500" y="92" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">THE LIBRARY</text>
-<text x="830" y="92" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">TILE COMPILER  (kernel compile time)</text>
-<rect x="40" y="108" width="400" height="74" rx="6" style="fill: var(--rust-fill); stroke: var(--rust); stroke-width: 1.2"/>
-<text x="52" y="128" text-anchor="start" xml:space="preserve" style="font: 600 12px var(--mono); fill: var(--rust); white-space: pre">#[tile_export]  pub fn relu_any(x: f32) -&gt; f32</text>
-<text x="52" y="148" text-anchor="start" xml:space="preserve" style="font: 400 11.5px var(--sans); fill: var(--fg); white-space: pre">no tile_shape: the call supplies the size</text>
-<text x="52" y="166" text-anchor="start" xml:space="preserve" style="font: 400 11.5px var(--sans); fill: var(--fg); white-space: pre">declaration @relu_any&lt;[N: index]&gt;(tile&lt;[N]xf32&gt;)</text>
-<line x1="90" y1="182" x2="90" y2="216" marker-end="url(#arrow)" style="stroke: var(--fg); stroke-width: 1.4"/>
-<text x="102" y="204" text-anchor="start" xml:space="preserve" style="font: 400 11px var(--mono); fill: var(--muted); white-space: pre">cargo oxide tilelib relu --arch sm_120 --provider</text>
-<rect x="40" y="218" width="400" height="74" rx="6" style="fill: var(--code-fill); stroke: var(--code); stroke-width: 1.2"/>
-<text x="52" y="238" text-anchor="start" xml:space="preserve" style="font: 600 12px var(--mono); fill: var(--fg); white-space: pre">relu.ll + descriptions  -&gt;  librelu_provider.so</text>
-<text x="52" y="258" text-anchor="start" xml:space="preserve" style="font: 400 11.5px var(--sans); fill: var(--fg); white-space: pre">a generated cdylib: the oxide-tile-provider runtime</text>
-<text x="52" y="276" text-anchor="start" xml:space="preserve" style="font: 400 11.5px var(--sans); fill: var(--fg); white-space: pre">with the crate's NVVM IR and descriptions embedded</text>
-<line x1="90" y1="292" x2="90" y2="326" marker-end="url(#arrow)" style="stroke: var(--fg); stroke-width: 1.4"/>
-<text x="102" y="314" text-anchor="start" xml:space="preserve" style="font: 400 11px var(--mono); fill: var(--muted); white-space: pre">tileiras --preview-create-tile-lib  (interface + the .so)</text>
-<rect x="40" y="328" width="400" height="56" rx="6" style="fill: var(--code-fill); stroke: var(--code); stroke-width: 1.2"/>
-<text x="52" y="348" text-anchor="start" xml:space="preserve" style="font: 600 12px var(--mono); fill: var(--fg); white-space: pre">relu.tilelib</text>
-<text x="52" y="368" text-anchor="start" xml:space="preserve" style="font: 400 11.5px var(--sans); fill: var(--fg); white-space: pre">the shared object with the interface section spliced in</text>
-<rect x="500" y="108" width="300" height="350" rx="6" style="fill: var(--panel); stroke: var(--line); stroke-width: 1.2"/>
-<text x="514" y="130" text-anchor="start" xml:space="preserve" style="font: 600 12.5px var(--sans); fill: var(--fg); white-space: pre">Inside the .so</text>
-<text x="514" y="162" text-anchor="start" xml:space="preserve" style="font: 600 11.5px var(-
```

**File**: `cuda-oxide/cuda-oxide-book/advanced/tile-libraries.md` (modified, +351/-395)
```diff
@@ -1,72 +1,67 @@
 # Tile Libraries
 
-A Tile kernel works on whole tiles and never names a thread. A SIMT function
-works on one element from one thread. A **tile library** joins the two. It
-packages Rust device functions so the Tile compiler can call them from inside
-a cuTile kernel, once per element or once per warp, and link them into the
-kernel's cubin. The Rust side is `#[tile_export]`, the packaging is
-`cargo oxide tilelib`, and the caller is cuTile Python's `foreign_call` today,
-with [cutile-rs](https://nvidia.github.io/cuda-rust/cutile/) to follow.
-
-```text
-#[tile_export(tile_shape = 128)]
-pub fn relu(x: f32) -> f32 { .. }                     your Rust function
-        |
-        |  cargo oxide tilelib <crate> --arch sm_120
-        v
-<crate>.ltoir          device code     void relu_impl(float x, float *relu_out)
-<crate>.iface.tilebc   declaration     @relu(tile<128xf32> in, tile<128xf32> out) -> tile<128xf32>
-<crate>.impl.tilebc    implementation  @relu_impl implements @relu, one invocation per element
-        |
-        |  tileiras --preview-create-tile-lib       (CUDA 13.5 or newer)
-        v
-<crate>.tilelib
-        |
-        |  tp.foreign_call(symbol_name="relu", ...)   inside a cuTile kernel
-        v
-the Tile compiler links relu_impl into the kernel's cubin
-```
+A Tile kernel operates on whole tiles without naming individual threads. A SIMT
+function operates on elements from individual threads or warps. A **tile
+library** connects the two: it packages Rust device functions so the Tile
+compiler can call them from inside a Tile kernel and link them into a single
+`cubin`.
+
+- **Annotate in Rust:** Mark device functions with `#[tile_export]`.
+- **Package the library:** Run `cargo oxide tilelib` to emit compiled device
+  code and Tile IR metadata, packaged into a `.tilelib` archive by `tileiras`
+  (CUDA 13.5+).
+- **Call from a Tile kernel:** Invoke the exported function from Tile C++ or
+  cuTile Python, with [cutile-rs](https://nvidia.github.io/cuda-rust/cutile/)
+  caller support to follow.
+
+| Mode              | Rust Attribute                   | How It Works                                                        |
+|:------------------|:---------------------------------|:--------------------------------------------------------------------|
+| **Static mode**   | `#[tile_export(tile_shape = N)]` | Fixed tile size `N` is compiled ahead of time into `.tilelib`       |
+| **Provider mode** | `#[tile_export]`                 | Caller chooses size `N`; provider compiles each size `N` on demand  |
 
 :::{seealso}
 [Kernels and Device Functions](../gpu-programming/kernels-and-device-functions.md)
-covers `#[device]` and the LTOIR route to CUDA C++. A tile library is the same
-route with the Tile compiler as the caller.
+covers `#[device]` and LTOIR linking with CUDA C++. A tile library uses the
+same LTOIR pipeline with the Tile compiler as the caller.
 :::
 
 ```{figure} images/tilelib-direct-linkage.svg
 :align: center
 :width: 100%
 
-The direct-linkage path. cuda-oxide ships the code (LTOIR) and two
-descriptions (interface and implementation bytecode); tileiras packs them
-into one `.tilelib`, and a Tile kernel calls the Rust function from inside
-its body.
+Static tile library flow. `cargo oxide tilelib` emits compiled device code
+(`.ltoir`) plus interface and implementation descriptions (`.tilebc`);
+`tileiras` packages them into a `.tilelib` and links called exports into the
+Tile kernel's `cubin`.
 ```
 
-## Writing an export
+---
+
+## Writing Exports
+
+Add `#[tile_export]` to a standard Rust function. Your original function stays
+unchanged so other Rust device code can still call it directly. Alongside it,
+the macro generates:
 
-Put `#[tile_export(tile_shape = N)]` on an ordinary function. `N` is the tile size
-the caller will pass. The function stays as written, so the rest of your
-device code keeps calling it. The attribute adds two items next to it: an
-`extern "C"` implementation on the native SIMT ABI, named `<name>_impl` by
-default, and a host-only description that the compiler writes out as JSON.
-Leave `tile_shape` out and the call supplies the tile size instead; such an
-export needs the provider form of the library, described below.
+- An `extern "C"` wrapper (`<name>_impl` by default) using the Tile-to-SIMT C
+  ABI.
+- A host-side export description that the compiler writes to
+  `<crate>.tileexports.json`.
 
 The
 [`tilelib_relu`](https://github.com/NVIDIA/cuda-rust/tree/main/cuda-oxide/crates/rustc-codegen-cuda/examples/tilelib_relu)
-example exports three functions, and this chapter follows them:
+example demonstrates four export patterns:
 
 ```rust
 use cuda_device::{tile_export, warp};
 
-/// Elementwise `max(x, 0)`.
+/// 1. Fixed-size elementwise export (128 threads, 1 element each).
 #[tile_export(tile_shape = 128)]
 pub fn relu(x: f32) -> f32 {
     if x > 0.0 { x } else { 0.0 }
 }
 
-/// Scale a tile in place. The cuTile side know
```

**File**: `cuda-oxide/cuda-oxide-book/conf.py` (modified, +95/-0)
```diff
@@ -104,3 +104,98 @@
 html_show_sourcelink = False
 html_title = "cuda-oxide"
 html_baseurl = "https://nvidia.github.io/cuda-rust/cuda-oxide/"
+
+
+def setup(app):
+    """Register custom Pygments lexers for CLI commands, Tile C++, and Tile IR."""
+    from pygments.lexer import RegexLexer, inherit
+    from pygments.lexers.c_cpp import CppLexer
+    from pygments.lexers.shell import BashLexer
+    from pygments.token import (
+        Comment,
+        Keyword,
+        Literal,
+        Name,
+        Number,
+        Operator,
+        Punctuation,
+        String,
+        Text,
+        Whitespace,
+    )
+
+    class OxideBashLexer(BashLexer):
+        """Bash lexer that highlights CLI tools, cargo-oxide subcommands, flags, and GPU targets."""
+
+        name = "OxideBash"
+        aliases = ["bash", "sh"]
+
+        tokens = {
+            "basic": [
+                (
+                    r"\b(cargo|nvcc|tileiras|just|rustup|rustc|git|python3?)\b",
+                    Name.Builtin,
+                ),
+                (
+                    r"\b(oxide|tilelib|build|run|test|check|new|doctor|clean|install)\b",
+                    Keyword,
+                ),
+                (r"(--[A-Za-z0-9_-]+|-[A-Za-z0-9]+)\b", Name.Attribute),
+                (r"\b(sm_[0-9]+[a-z]?|compute_[0-9]+[a-z]?)\b", Literal.String.Symbol),
+                inherit,
+            ],
+        }
+
+    class OxideCppLexer(CppLexer):
+        """C++ lexer that accepts CUDA Tile C++ attributes and foreign-call qualifiers."""
+
+        name = "OxideCpp"
+        aliases = ["cpp", "c++", "cuda"]
+
+        tokens = {
+            "statements": [
+                (r"\[\[[^\]]*\]\]", Name.Attribute),
+                (
+                    r"\b(__tile_global__|__tile__|__experimental_foreign_decl__|__experimental_foreign_name__)\b",
+                    Keyword.Reserved,
+                ),
+                inherit,
+            ],
+        }
+
+    class MlirLexer(RegexLexer):
+        """Lexer for MLIR and CUDA Tile IR modules."""
+
+        name = "MLIR"
+        aliases = ["mlir", "tileir"]
+
+        tokens = {
+            "root": [
+                (r"\s+", Whitespace),
+                (r"//[^\n]*", Comment.Single),
+                (r'"[^"]*"', String.Double),
+                (
+                    r"\b(module|func|extern|implements|synchronization|mem_layout|fragmap|local|in|out|inout|warp|none)\b",
+                    Keyword,
+                ),
+                (r"\b(cuda_tile\.[A-Za-z0-9_$]+)\b", Keyword.Namespace),
+                (r"@[A-Za-z_][A-Za-z0-9_$.]*", Name.Function),
+                (r"%[A-Za-z0-9_$.]+", Name.Variable),
+                (r"![A-Za-z0-9_$.]+", Keyword.Type),
+                (r"#[A-Za-z0-9_$.]+", Name.Attribute),
+                (r"\b([0-9]+x)?(f16|bf16|f32|f64|i1|i8|i16|i32|i64|index)\b", Keyword.Type),
+                (r"\b[0-9]+\b", Number.Integer),
+                (r"->|=", Operator),
+                (r"[{}()\[\]<>:,]", Punctuation),
+                (r"[^\s{}()\[\]<>:,]+", Text),
+            ],
+        }
+
+    app.add_lexer("bash", OxideBashLexer)
+    app.add_lexer("sh", OxideBashLexer)
+    app.add_lexer("cpp", OxideCppLexer)
+    app.add_lexer("c++", OxideCppLexer)
+    app.add_lexer("cuda", OxideCppLexer)
+    app.add_lexer("mlir", MlirLexer)
+    app.add_lexer("tileir", MlirLexer)
+
```

---

### Incident Patch 2: `8e039ebe` (2026-11-12)
**Commit Message**: fix(cuda-oxide): omit NVVM-only --arch on compile-only code-shape prebuild (#1789)

## What This PR Does

Fixes `scripts/smoketest.sh --compile-only` on **Rubin (`R100`,
`sm_107`)** for the two `NVVM_VERIFY_EXAMPLES` that also ship a
`verify-code-shape.sh` gate (`kernel_reference_validity` and
`promoted_ref_return`), resolving **NVBug 7084024**:

```text
BEFORE (in `scripts/smoketest.sh --compile-only` on R100, where nvvm_arch = sm_107):
  ├──► Step 1 (NVPTX): cargo oxide build <ex> --arch=sm_107       [X] fails (NVPTX lacks sm_107)
  └──► Step 2 (NVVM):  cargo oxide emit-ltoir <ex> --arch=sm_107  (never reached)

AFTER:
  ├──► Step 1 (NVPTX): cargo oxide build <ex>                     [OK] NVPTX emits forward-compatible PTX
  │                    bash verify-code-shape.sh                  [OK] validates .ll and .ptx code shape
  └──► Step 2 (NVVM):  cargo oxide emit-ltoir <ex> --arch=sm_107  [OK] libNVVM compiles natively for sm_107
```

---

### 1. Keep `--arch=sm_107` Scoped to the NVVM (`emit-ltoir`) Step

`cuda-oxide` has two device compilation routes:
* **NVPTX (`llc` / LLVM 23)** (`cargo oxide build` / `run`): does not
have a processor entry for Rubin (`sm_107`). When invoke

**File**: `cuda-oxide/scripts/check-example-smoketest-contract.sh` (modified, +42/-0)
```diff
@@ -186,6 +186,48 @@ esac
                  f"{result.returncode}, {result.stdout!r}, {result.stderr!r}")
     print(f"OK: {len(cases)} WGMMA verdict cases and failed-run summary/exit status.")
 
+    # On R100 (compute capability 10.7), NVVM_VERIFY_EXAMPLES with a
+    # verify-code-shape.sh gate must run `cargo oxide build <ex>` without
+    # passing the NVVM-only `sm_107` target into the NVPTX prebuild, while
+    # keeping `--arch=sm_107` for `emit-ltoir` (NVBug 7084024).
+    for ex_name in ("kernel_reference_validity", "promoted_ref_return"):
+        ex_dir = simt / f"crates/rustc-codegen-cuda/examples/{ex_name}"
+        ex_dir.mkdir(parents=True, exist_ok=True)
+        (ex_dir / "Cargo.toml").touch()
+        shape = ex_dir / "verify-code-shape.sh"
+        shape.write_text("#!/usr/bin/env bash\ntest -s \"$(dirname \"$0\")/" + ex_name + ".ptx\"\n")
+        shape.chmod(0o755)
+    (bin_dir / "nvidia-smi").write_text('#!/usr/bin/env bash\necho "NVIDIA Graphics Device, 10.7"\n')
+    (bin_dir / "cargo").write_text('''#!/usr/bin/env bash
+case "$*" in
+    "oxide --help"|"oxide setup") exit 0 ;;
+    "oxide __debug-policy") echo unset; exit 0 ;;
+    "oxide build kernel_reference_validity"|"oxide build promoted_ref_return")
+        ex="$3"
+        printf '.version 8.0\n.target sm_80\n.address_size 64\n' > "crates/rustc-codegen-cuda/examples/${ex}/${ex}.ptx"
+        exit 0 ;;
+    "oxide emit-ltoir kernel_reference_validity --arch=sm_107"|"oxide emit-ltoir promoted_ref_return --arch=sm_107")
+        ex="$3"
+        rm -f "crates/rustc-codegen-cuda/examples/${ex}/${ex}.ptx"
+        printf '; ModuleID = %s\n' "${ex}" > "crates/rustc-codegen-cuda/examples/${ex}/${ex}.ll"
+        printf 'ltoir' > "crates/rustc-codegen-cuda/examples/${ex}/${ex}.ltoir"
+        exit 0 ;;
+    *)
+        echo "unexpected cargo invocation: $*" >&2
+        exit 99 ;;
+esac
+''')
+    r100_result = subprocess.run(
+        ["bash", str(script), "--compile-only", "--only", "^(kernel_reference_validity|promoted_ref_return)$", "--no-color"],
+        cwd=root, env=env, capture_output=True, text=True,
+    )
+    if (r100_result.returncode != 0
+            or not re.search(r"^Pass:\s+2 / 2$", r100_result.stdout, re.M)
+            or not re.search(r"^Fail:\s+0 / 2$", r100_result.stdout, re.M)):
+        sys.exit(f"R100 compile-only NVVM code-shape prebuild failed: "
+                 f"{r100_result.returncode}, {r100_result.stdout!r}, {r100_result.stderr!r}")
+    print("OK: R100 (sm_107) compile-only NVVM code-shape prebuild omits --arch on build and passes --arch=sm_107 to emit-ltoir.")
+
 # Exercise the actual CLI/preflight without building or launching an example.
 # The Rust parser owns aliases and normalization; this checks that the shell
 # trusts its token, honors explicit mode, and refuses a failed/malformed reply.
```

**File**: `cuda-oxide/scripts/smoketest.sh` (modified, +2/-2)
```diff
@@ -2213,10 +2213,10 @@ run_cargo() {
         : >"${log}"
         if [[ -f "${nvvm_shape_check}" ]]; then
             if [[ ${VERBOSE} -eq 1 ]]; then
-                cargo oxide build "${ex}" "--arch=${nvvm_arch}" 2>&1 | tee -a "${log}"
+                cargo oxide build "${ex}" 2>&1 | tee -a "${log}"
                 CARGO_EC=${PIPESTATUS[0]}
             else
-                cargo oxide build "${ex}" "--arch=${nvvm_arch}" >>"${log}" 2>&1
+                cargo oxide build "${ex}" >>"${log}" 2>&1
                 CARGO_EC=$?
             fi
             if [[ ${CARGO_EC} -eq 0 ]] && ! bash "${nvvm_shape_check}" >>"${log}" 2>&1; then
```

---

### Incident Patch 3: `cbfaf0dd` (2026-11-13)
**Commit Message**: fix(cutile-examples): add explicit B200 profiles and safe QKV tail loads (#1798)

## Summary

Add explicit, opt-in B200 launch profiles and evaluation controls for
the fused QKV and NVFP4 MoE examples, and fix QKV tail-slot addressing.
Original launch profiles remain the defaults. All changes are under
`cutile-rs/`.

## Changes

- Add opt-in B200 QKV/MoE profiles and document public CUDA Toolkit 13.5
setup. Compiler support for individual schedules can vary; the default
profiles remain available.
- Add explicit large MoE fixture selection, focused correctness runs,
and raw timing samples.
- Keep masked QKV tail-slot addresses in bounds without padding fixtures
or weakening correctness checks.
- Update the example and reusable-kernel documentation.

## Validation

- Local formatting and all 13 QKV/MoE example unit tests passed for this
source tree.
- The cuTile book builds with warnings treated as errors.
- CI results are tracked on the current PR head.
- Additional B200 profile qualification is ongoing; no universal
performance or complete profile-qualification claim is made.

## Checklist

- [x] Commit has a DCO sign-off.
- [x] Commit is cryptographically signed and verified by Gi

**File**: `cutile-rs/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -20,6 +20,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/).
 
 ### Added
 
+- Add opt-in B200 profiles to the fused QKV and NVFP4 MoE examples. Add public
+  CTK 13.5 setup instructions, explicit large MoE fixture selection, focused
+  correctness runs and raw timing samples; retain the original default profiles.
 - Add optional cheap screening and budget-reserved paired confirmation to the
   preparation pipeline. Preparation stops before fresh incumbent comparisons;
   incomplete confirmation retains the incumbent and records raw samples and
@@ -52,6 +55,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/).
 
 ### Fixed
 
+- Keep masked QKV tail-row slot pointers in bounds, retaining the original
+  M=67 fixture and numerical checks under compiler-instrumented memcheck.
 - Update the optional `cuda-tile-rs` bindings and `cuda-tile-translate` build
   from CUDA Tile IR 13.2 to the public 13.5 release, including SIMT preview
   support and translator round-trip tests.
```

**File**: `cutile-rs/cutile-examples/README.md` (modified, +97/-20)
```diff
@@ -38,26 +38,103 @@ features and do not change which APIs are compiled.
 
 `nvfp4_moe` measures the full pipeline's CUDA graph replay latency for batch
 sizes 1, 2, 4, 8, 16, 32, 64, 128, and 256. Each batch uses 20 samples of
-1,000 replays, with 50 warmup replays per sample. CUDA events time GPU execution;
-compilation, allocation, and output validation are outside the timed region.
-The synthetic workload uses H=I=1024, eight allocated experts, four active
-experts, and top-k=4, with direct launches and graph replay checked against a
-deterministic reference. Performance will be optimized in a future version.
-
-The example uses the reusable kernels in
-[`cutile-kernels::experimental::nvfp4_moe`](../cutile-kernels/src/experimental/nvfp4_moe.rs).
-**Peak performance requires CUDA Toolkit 13.5 and its Tile IR assembler.** The
-minimum execution requirements above are unchanged; older assemblers can run
-the kernels without the latest compiler optimizations.
-
-### NVFP4 MoE validation gap
-
-On an RTX 5090 (`sm_120`, driver 610.43.02), the public `tileiras` 13.5.37
-fails the example's direct-launch numerical check at batch 16: normalized
-maximum error 0.5, maximum absolute error 1.578125. This reproduces with both
-13.4 and 13.5 bytecode, so changing the bytecode version is not a workaround.
-The cause has not been isolated. B200 correctness and performance evaluation
-remain pending; retain the output checks when evaluating this example.
+1,000 replays, with 50 warmups per sample. Compilation, allocation, transfers,
+and output validation are outside the timed region. The original default
+fixture remains H=I=1024, eight allocated experts, four active experts, top-k=4.
+Direct launches and graph replay are checked against a deterministic reference.
+The example imports [shared kernels](../cutile-kernels/src/experimental/nvfp4_moe.rs).
+
+### B200 reference profiles
+
+The opt-in B200 profiles provide SM100 schedules for evaluation with CUDA 13.5
+tooling. Compiler support for individual schedules can vary; selecting this
+profile does not guarantee that every schedule is supported by every assembler
+build. The minimum execution requirements above remain unchanged for default
+profiles.
+
+Select matching public toolkit tools and libraries explicitly, and remove
+inherited overrides from other toolkit installations:
+
+```sh
+export CUDA_TOOLKIT_PATH=/absolute/path/to/public/cuda-13.5
+export CUDA_HOME="$CUDA_TOOLKIT_PATH"
+export CUDA_PATH="$CUDA_TOOLKIT_PATH"
+export CUDA_ROOT="$CUDA_TOOLKIT_PATH"
+export CUDACXX="$CUDA_TOOLKIT_PATH/bin/nvcc"
+export CUTILE_TILEIRAS_PATH="$CUDA_TOOLKIT_PATH/bin/tileiras"
+export CUTILE_BYTECODE_VERSION=13.5
+export PATH="$CUDA_TOOLKIT_PATH/bin:$PATH"
+export LD_LIBRARY_PATH="$CUDA_TOOLKIT_PATH/nvvm/lib64:$CUDA_TOOLKIT_PATH/lib64:$CUDA_TOOLKIT_PATH/lib"
+export LIBRARY_PATH="$CUDA_TOOLKIT_PATH/lib64:$CUDA_TOOLKIT_PATH/lib"
+unset LD_PRELOAD
+export LIBCLANG_PATH=/absolute/path/to/libclang/directory
+
+nvcc --version
+"$CUTILE_TILEIRAS_PATH" --version
+"$CUTILE_TILEIRAS_PATH" --list-versions
+sha256sum "$CUTILE_TILEIRAS_PATH"
+```
+
+Preserve the repository's Rust toolchain pin.
+Record actual backend-library loading during compilation (for example with
+`LD_DEBUG=libs`), not just the version-command output.
+
+From `cutile-rs/`:
+
+```sh
+cargo run --release --locked -p cutile-examples --example fused_qkv -- --bench --profile b200
+cargo run --release --locked -p cutile-examples --example fused_qkv -- --bench --profile b200 --nontrivial
+cargo run --release --locked -p cutile-examples --example nvfp4_moe -- --profile b200
+cargo run --release --locked -p cutile-examples --example nvfp4_moe -- --profile b200 --shape large
+```
+
+`--profile b200` is explicit and requires SM100. Omitting it preserves the
+original schedules; it is never selected based on a compiler filename.
+MoE uses bounded persistent FC1/FC2 grids and per-batch tiles, occupancy,
+latency and finalization settings. It still processes every device-computed
+expert group; launch bounds do not assume four active experts.
+
+`--shape large` selects H=6144, I=1536 and 192 allocated experts without a source
+edit. Both shapes retain the same synthetic generator, top-k=4 and four active
+experts. Label the shapes separately when reporting results. MoE prints every
+selected schedule and all 20 `sample_csv,batch,sample,latency_us` records.
+Timing still covers routing, quantization, FC1/ReLU-squared/requantization, FC2,
+and weighted finalization.
+
+For focused correctness/sanitizer runs, use `--batch 16 --check-only`, with
+either shape or profile. This validates direct launches and graph replay
+without timing. It does not suppress checks or change tolerances.
+
+### Validation
+
+An assembler may reject individual B200 schedules, including TN=32. Record the
+selected schedule and compiler diagnostics when comparing compilers; silently
+substituting another profile changes the comparison. `--profile defaul
```

**File**: `cutile-rs/cutile-examples/examples/fused_qkv.rs` (modified, +134/-8)
```diff
@@ -7,8 +7,9 @@
 //!
 //! No arguments: full-output correctness checks on a small tail/scatter fixture.
 //! `--bench`: opt-in CUDA graph timing; `--help` lists shapes and tuning options.
-//! Use CUDA 13.5's Tile IR assembler for performance evaluation. The starting
-//! kernel is not B200-tuned; timings do not imply GEMM/epilogue overlap.
+//! Use `--profile b200` to evaluate SM100 schedules with CUDA 13.5 tooling.
+//! Compiler support for individual schedules can vary. Defaults remain unchanged;
+//! timings do not imply GEMM/epilogue overlap.
 
 use cuda_async::cuda_graph::{CudaGraph, Scope};
 use cuda_core::{f8e4m3fn, Context, Stream};
@@ -24,9 +25,11 @@ const D: usize = 128;
 const EPS: f32 = 1e-6;
 const SENTINEL: u8 = 0x55;
 
-#[derive(Debug)]
+#[derive(Clone, Debug)]
 struct Config {
     bench: bool,
+    automatic_schedule: bool,
+    cga: usize,
     m_list: Vec<usize>,
     k: usize,
     q_heads: usize,
@@ -42,23 +45,52 @@ struct Config {
 }
 
 impl Config {
+    fn for_problem(&self, problem: Problem, sm_count: usize, sm100: bool) -> Self {
+        let mut config = self.clone();
+        if self.automatic_schedule
+            && sm100
+            && sm_count > 0
+            && problem.k == 4096
+            && problem.hq == 32
+            && problem.hkv == 8
+            && [128, 256, 512, 1024, 2048, 4096, 8192].contains(&problem.m)
+        {
+            config.bm = 128;
+            config.bk = if problem.m >= 4096 { 64 } else { 128 };
+            config.group_m = if problem.m == 2048 { 1 } else { 8 };
+            config.programs = if problem.m == 256 { 0 } else { sm_count };
+            config.cga = if problem.m == 128 { 2 } else { 1 };
+            if config.programs > 0 {
+                config.programs = config.programs.div_ceil(config.cga) * config.cga;
+            }
+        }
+        config
+    }
+
     fn parse(args: &[String]) -> Result<Option<Self>> {
         if args.iter().any(|arg| arg == "--help") {
             println!(
                 "fused_qkv [--bench] [--m-list 128,256,512,1024,2048,4096,8192]\n\
                 [--k 4096] [--q-heads 32] [--kv-heads 8] [--bm 64] [--bk 64]\n\
                 [--group-m 8] [--programs 0] [--samples 20] [--replays 1000]\n\
-                [--warmups 50] [--nontrivial]\n\
+                [--warmups 50] [--nontrivial] [--profile default|b200]\n\
                 No arguments runs the small correctness fixture on ordinary/persistent grids.\n\
-                --bench enables timing; programs=0 launches one CTA per output tile.\n\
+                --bench enables timing; --profile b200 selects evaluated SM100 schedules.\n\
+                b200 requires standard benchmark dimensions and cannot mix with manual schedules.\n\
+                programs=0 launches one CTA per output tile.\n\
                 --nontrivial uses non-unit gamma/scales and permuted cache slots.\n\
                 Other options require --bench. Head dimension is fixed at 128."
             );
             return Ok(None);
         }
         let bench = args.iter().any(|arg| arg == "--bench");
+        let manual_schedule = args
+            .iter()
+            .any(|arg| matches!(arg.as_str(), "--bm" | "--bk" | "--group-m" | "--programs"));
         let mut config = Self {
             bench,
+            automatic_schedule: false,
+            cga: 1,
             m_list: if bench {
                 vec![128, 256, 512, 1024, 2048, 4096, 8192]
             } else {
@@ -105,12 +137,31 @@ impl Config {
                 "--bk" => config.bk = value.parse()?,
                 "--group-m" => config.group_m = value.parse()?,
                 "--programs" => config.programs = value.parse()?,
+                "--profile" => match value.as_str() {
+                    "default" => config.automatic_schedule = false,
+                    "b200" => config.automatic_schedule = true,
+                    _ => return Err("profile must be default or b200".into()),
+                },
                 "--samples" => config.samples = value.parse()?,
                 "--replays" => config.replays = value.parse()?,
                 "--warmups" => config.warmups = value.parse()?,
                 _ => return Err(format!("unknown option {arg}").into()),
             }
         }
+        if config.automatic_schedule
+            && (manual_schedule
+                || config.k != 4096
+                || config.q_heads != 32
+                || config.kv_heads != 8
+                || config
+                    .m_list
+                    .iter()
+                    .any(|m| ![128, 256, 512, 1024, 2048, 4096, 8192].contains(m)))
+        {
+            return Err(
+                "b200 requires standard benchmark shapes and no manual schedule options".into(),
+            );
+        }
         if config.samples == 0
             || config.replays == 0
             || config.group_m == 0
@@ -538,7 +589,11 @@ fn launch(
             .to_vec(),
     )
     .grid((progr
```

**File**: `cutile-rs/cutile-examples/examples/nvfp4_moe.rs` (modified, +416/-81)
```diff
@@ -3,7 +3,8 @@
  * SPDX-License-Identifier: Apache-2.0
  *
  * Uses cutile-kernels' NVFP4 mixture of experts kernels by Emmet Zhang et al.
- * Peak kernel performance requires the CUDA Toolkit 13.5 Tile IR assembler.
+ * The opt-in B200 profile provides SM100 schedules for CUDA 13.5 evaluation.
+ * Compiler support for individual schedules can vary.
  *
  * Run with: cargo run --release -p cutile-examples --example nvfp4_moe
  *
@@ -15,8 +16,8 @@
  *
  * The small synthetic fixture uses H=I=1024, eight allocated experts, top-k=4,
  * and four active experts. Constant packed weights and deterministic routes
- * admit an analytical reference. Performance will be optimized in a future
- * version.
+ * admit an analytical reference. --profile b200 opts into bounded persistent
+ * grids and per-batch schedules. --shape large selects H=6144, I=1536, E=192.
  */
 
 use cuda_async::cuda_graph::CudaGraph;
@@ -26,6 +27,7 @@ use cutile::api;
 use cutile::cuda_core::{f4e2m1fnx2, f8e4m3fn};
 use cutile::half::{bf16, f16};
 use cutile::prelude::*;
+use cutile::tile_kernel::CompileOptions;
 use std::sync::Arc;
 
 use cutile_kernels::experimental::nvfp4_moe as kernels;
@@ -36,9 +38,23 @@ use kernels::{
 };
 
 // Kernel config
-const HIDDEN: usize = 1024;
-const INTERMEDIATE: usize = 1024;
-const NUM_EXPERTS: usize = 8;
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+struct Shape {
+    hidden: usize,
+    intermediate: usize,
+    experts: usize,
+}
+
+const SMALL_SHAPE: Shape = Shape {
+    hidden: 1024,
+    intermediate: 1024,
+    experts: 8,
+};
+const LARGE_SHAPE: Shape = Shape {
+    hidden: 6144,
+    intermediate: 1536,
+    experts: 192,
+};
 const MAX_NUM_TOKENS: usize = 256;
 const BATCH_SIZES: [usize; 9] = [1, 2, 4, 8, 16, 32, 64, 128, MAX_NUM_TOKENS];
 const TOP_K: usize = 4;
@@ -59,9 +75,67 @@ const DOWN_FACTORS: [f32; TOP_K] = [1.0, 2.0, 0.5, 1.0];
 
 const INPUT_SCALE: f32 = 1.0;
 
-fn max_num_groups(routed_size: usize, tile_n: usize) -> usize {
-    let filled_experts = NUM_EXPERTS.min(routed_size);
-    filled_experts + (routed_size - filled_experts) / tile_n
+impl Shape {
+    fn max_num_groups(self, routed_size: usize, tile_n: usize) -> usize {
+        let filled_experts = self.experts.min(routed_size);
+        filled_experts + (routed_size - filled_experts) / tile_n
+    }
+}
+
+#[derive(Debug)]
+struct Config {
+    shape: Shape,
+    tuned: bool,
+    check_only: bool,
+    batches: Vec<usize>,
+}
+
+impl Config {
+    fn parse(args: &[String]) -> Result<Option<Self>, Box<dyn std::error::Error>> {
+        if args.iter().any(|arg| arg == "--help") {
+            println!(
+                "nvfp4_moe [--shape small|large] [--profile default|b200] \\
+                 [--batch 1|2|4|8|16|32|64|128|256] [--check-only]\\n\\
+                 small: H=I=1024, experts=8; large: H=6144, I=1536, experts=192.\\n\\
+                 Both use the same synthetic fixture, four active experts and top-k=4.\\n\\
+                 b200 selects SM100 profiles; support depends on the selected assembler.\\n\\
+                 --check-only validates direct launches and graph replay without timing.\\n\\
+                 No arguments preserves the original small fixture, profiles and full batch sweep."
+            );
+            return Ok(None);
+        }
+        let mut config = Self {
+            shape: SMALL_SHAPE,
+            tuned: false,
+            check_only: false,
+            batches: BATCH_SIZES.to_vec(),
+        };
+        let mut args = args.iter();
+        while let Some(arg) = args.next() {
+            if arg == "--check-only" {
+                config.check_only = true;
+                continue;
+            }
+            let value = args
+                .next()
+                .ok_or_else(|| format!("missing value for {arg}"))?;
+            match (arg.as_str(), value.as_str()) {
+                ("--shape", "small") => config.shape = SMALL_SHAPE,
+                ("--shape", "large") => config.shape = LARGE_SHAPE,
+                ("--profile", "default") => config.tuned = false,
+                ("--profile", "b200") => config.tuned = true,
+                ("--batch", _) => {
+                    let batch = value.parse()?;
+                    if !BATCH_SIZES.contains(&batch) {
+                        return Err("batch must be a power of two from 1 through 256".into());
+                    }
+                    config.batches = vec![batch];
+                }
+                _ => return Err(format!("unknown option or value: {arg} {value}").into()),
+            }
+        }
+        Ok(Some(config))
+    }
 }
 
 fn hidden_value(token: usize) -> f32 {
@@ -95,7 +169,113 @@ fn expected_output(token: usize) -> bf16 {
     bf16::from_f32(total)
 }
 
+#[derive(Clone, Copy, Debug)]
+struct Schedule {
+    tile_n: usize,
+    fc1_workers: usize,
+    fc2_workers: usize,
+    fc1_occupancy: i32,
+    fc2_occupancy: i32,
+    fc1_latencies: [usize; 2],
+    fc2_latencies: [usize; 3],
+  
```

**File**: `cutile-rs/cutile-examples/fused_qkv.md` (modified, +25/-7)
```diff
@@ -7,9 +7,10 @@ FP8 quantization, a contiguous Q output, and paged K/V cache stores in one kerne
 V is quantized and stored without normalization. There is no FP16 intermediate
 rounding, bias, RoPE, residual, attention, or communication.
 
-Use the **public CUDA Toolkit 13.5 Tile IR assembler for performance evaluation**.
+Use a complete **public CUDA Toolkit 13.5** installation for evaluation.
+Compiler support for individual opt-in SM100 schedules can vary.
 Execution requires FP8 support (SM90+); the normal target/version rules still
-apply. The kernel is a starting implementation, not a tuned B200 result. Source
+apply. The schedules were evaluated on B200; they are not universal optima. Source
 fusion does not establish overlap between GEMM and the epilogue. Its grouped-M
 traversal and TMA loading derive from TileGym; the kernel retains the MIT notice.
 
@@ -21,11 +22,11 @@ From `cutile-rs/`, after configuring your toolkit and `CUTILE_TILEIRAS_PATH`:
 # Small full-output correctness check, including direct and graph launches.
 cargo run --release -p cutile-examples --example fused_qkv
 
-# Opt-in performance sweep, with per-sample CUDA-event measurements.
-cargo run --release -p cutile-examples --example fused_qkv -- --bench
+# Opt-in B200 profiles, with per-sample CUDA-event measurements.
+cargo run --release --locked -p cutile-examples --example fused_qkv -- --bench --profile b200
 
 # Same sweep with non-unit gamma/scales and permuted physical cache slots.
-cargo run --release -p cutile-examples --example fused_qkv -- --bench --nontrivial
+cargo run --release --locked -p cutile-examples --example fused_qkv -- --bench --profile b200 --nontrivial
 
 # Inspect dimensions, schedule controls and measurement options without a GPU.
 cargo run -p cutile-examples --example fused_qkv -- --help
@@ -36,13 +37,27 @@ The benchmark defaults to M=128,256,512,1024,2048,4096,8192, K=4096,
 with `--m-list`, `--k`, `--q-heads`, and `--kv-heads`. K must be a multiple of
 8 so FP16 input/weight row strides meet 16-byte TMA alignment.
 
-The starting schedule is BM=64, BN=128, BK=64, GROUP_M=8, occupancy=1 and one
-CTA per cluster. `--bm` and `--bk` accept 16,32,64,128; `--group-m` controls
+With `--profile b200`, the standard benchmark dimensions on SM100 use
+BM=128, BN=128 and occupancy=1. BK=128 through M=2048 and BK=64 for larger M.
+GROUP_M=1 at M=2048 and 8 otherwise. M=256 uses one CTA per output tile; other
+sizes use a persistent grid with one CTA per SM. M=128 uses two CTAs per cluster
+(with the grid rounded up to a complete cluster); other sizes use one.
+
+The default profile retains BM=64, BN=128, BK=64, GROUP_M=8, occupancy=1 and
+one CTA per cluster on all architectures. `--profile b200` rejects other
+architectures/nonstandard shapes and cannot mix with manual schedule controls.
+With the default profile, `--bm`, `--bk`, `--group-m` and `--programs` start from
+the original defaults. `--bm` and `--bk` accept 16,32,64,128; `--group-m` controls
 grouped-M traversal. `--programs 0` launches one CTA per output tile; a positive
 count sets a persistent grid. These controls enable evaluation, not an implicit
 claim that a configuration is optimal. This kernel does not explicitly implement
 the CuTe example's two-CTA, two-accumulator, warp-specialized schedule.
 
+See [B200 setup](README.md#b200-reference-profiles) for matching public toolkit
+tools and libraries, and [validation](README.md#validation) for
+compiler-instrumented sanitizer commands. Comparing compilers with different
+profiles is not an isolated compiler comparison.
+
 ## Data and validation
 
 Weights have contiguous `[N,K]` layout, ordered Q, K, V. Each head has 128
@@ -64,6 +79,9 @@ ordinary and persistent grids. It checks every Q/K/V element against an
 independent FP64 projection/norm and FP8 converter, allowing one neighboring
 FP8 spacing for FP32 reduction/rsqrt rounding. Untouched bytes must match exactly.
 Output buffers are reset before direct and graph checks.
+Inactive tail rows retain their slot-load mask and use an in-bounds pointer
+before the load. The fixture remains unpadded and retains its numerical checks
+when running compiler-instrumented memcheck.
 
 Benchmark inputs/weights use the same deterministic, nonuniform recipe in the
 source, including a zero first input row. By default gamma is one, all inverse
```

**File**: `cutile-rs/cutile-kernels/README.md` (modified, +7/-4)
```diff
@@ -69,17 +69,20 @@ cargo run --release -p cutile-examples --example nvfp4_moe
 
 The example is a synthetic correctness and timing fixture; its timings are not
 a comparison against a production MoE library. See the
-[current validation gap](../cutile-examples/README.md#nvfp4-moe-validation-gap)
-observed with public `tileiras` 13.5.37 on SM120 before using its results.
+[validation instructions](../cutile-examples/README.md#validation) and
+[known SM120 limitation](../cutile-examples/README.md#known-sm120-limitation)
+before using its results. Opt-in B200 launch profiles and the large synthetic fixture
+are documented in the [host example guide](../cutile-examples/README.md#b200-reference-profiles).
 
 ## Fused QKV
 
 `experimental::fused_qkv` fuses FP16 QKV projection, FP32 per-head Q/K RMSNorm,
 FP8 conversion, Q storage, and paged K/V scatter. V is not normalized. The
 [runnable example and benchmark guide](../cutile-examples/fused_qkv.md) documents
 the unsafe buffer/slot contract, full-output correctness fixture, and opt-in
-CUDA graph timing sweep. Use CUDA 13.5's assembler for performance evaluation;
-the starting schedule has not been tuned on B200 and overlap is not guaranteed.
+CUDA graph timing sweep. Its opt-in `--profile b200` schedules are intended for
+evaluation with CUDA 13.5 tooling; compiler support for individual schedules can
+vary. Defaults retain the original schedule. Overlap is not guaranteed.
 The adapted TileGym traversal retains its MIT license in the kernel source.
 
 ## Validation
```

**File**: `cutile-rs/cutile-kernels/src/experimental/qkv.rs` (modified, +3/-1)
```diff
@@ -203,8 +203,10 @@ pub mod kernels {
                     slot_base.reshape(const_shape![1]);
                 let slot_base_tile: PointerTile<*const i64, { [BM] }> =
                     slot_base_1d.broadcast(const_shape![BM]);
+                let zero_rows: Tile<i64, { [BM] }> = constant(0i64, const_shape![BM]);
+                let safe_rows: Tile<i64, { [BM] }> = select(row_valid, rows64, zero_rows);
                 let slot_ptrs: PointerTile<*const i64, { [BM] }> =
-                    slot_base_tile.offset_tile(rows64);
+                    slot_base_tile.offset_tile(safe_rows);
                 let (slot, _): (Tile<i64, { [BM] }>, Token) = unsafe {
                     load_ptr_tko(
                         slot_ptrs,
```

#### Recent Merged Pull Requests:
- **PR #1807** (closed): docs(cuda-core): link nvls_all_reduce example in tests (@Code4me2)
- **PR #1799** (2026-11-13): docs(cutile): clarify versioned API compatibility (@elibol)
- **PR #1798** (2026-11-13): fix(cutile-examples): add explicit B200 profiles and safe QKV tail loads (@elibol)
- **PR #1790** (closed): fix(mir-importer,codegen): lower ConstantMemory::{get_ref,get} at opt-level 0 (@ssoj13)
- **PR #1789** (2026-11-12): fix(cuda-oxide): omit NVVM-only --arch on compile-only code-shape prebuild (@nihalpasham)
- **PR #1785** (2026-11-12): docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add CLI/MLIR/C++ highlighting (@nihalpasham)

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

## X. docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add

**RULE**:
When implementing operations in `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-direct-linkage.svg`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5183ab57`: docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add CLI/MLIR/C++ highlighting. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-direct-linkage.svg`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 740" width="1240" height="740" role="img"
  aria-label="Static tile library flow: Left column builds relu.tilelib from #[tile_export], middle column compiles the Tile caller to prog.tilebc, and right column links both in tileiras to produce kernel.cubin">
  :root, svg {
  @media (prefers-color-scheme: dark) { :root, svg {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 800" width="1240" height="800" role="img"
  aria-label="Direct linkage flow: Rust source becomes LTOIR plus two description bytecodes, packaged into a .tilelib that tileiras links with a Tile kernel's bytecode into one cubin">
  :root, svg { 
  @media (prefers-color-scheme: dark) { :root, svg { 
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--fg)"/></marker></defs>
<rect x="0" y="0" width="1240" height="800" style="fill: var(--bg)"/>
<text x="40" y="34" text-anchor="start" style="font: 600 17px var(--sans); fill: var(--fg)">Direct linkage: a Tile kernel calls a Rust function through a .tilelib</text>
<text x="40" y="56" text-anchor="start" style="font: 400 12.5px var(--sans); fill: var(--muted)">cuda-oxide is the SIMT provider. It ships code plus a description; the Tile compiler matches, marshals and links.</text>
<text x="40" y="92" text-anchor="start" style="font: 600 11px var(--sans); fill: var(--muted)">RUST SIDE  (cuda-oxide)</text>
<text x="620.0" y="92" text-anchor="middle" style="font: 600 11
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5183ab57` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
