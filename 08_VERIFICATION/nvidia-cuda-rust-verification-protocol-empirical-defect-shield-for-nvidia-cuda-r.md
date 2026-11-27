# Verification Protocol: Verification Protocol: Empirical Defect Shield for NVIDIA/cuda-rust

<!-- PROVENANCE_START
{
  "source_repository": "NVIDIA/cuda-rust",
  "source_url": "https://github.com/NVIDIA/cuda-rust",
  "source_version": "920720a2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T01:06:47.394Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nvidia-cuda-rust",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust) (Revision: `920720a2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T01:06:47.394Z`  
> **Learning ID**: `learn-github-nvidia-cuda-rust`


## 1. Scope & Verification Target
- **Target Repository**: `NVIDIA/cuda-rust` (Commit: `920720a2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): NVIDIA/cuda-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T01:06:46.142Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4105 stars

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
- **Issue #1878** (2026-11-26): **fix(cuda-oxide): support == requires, pure math intrinsics, and lake setup in #[verify]**
  *Symptoms*: ## Summary  Closes three gaps in the `#[verify(...)]` formal-verification workflow:  | Area                           | Fix                                                                      | |:-------------------------------|:-------------------------------------------------------------------------| | `==`, `>`, `<` in `requires`   | Forwards slice-length relations to Lean (`==` emits both directions)     | | Pure math intrinsics (`.sin()`) | Admits the exact compiler allow-list of pure scalar/math placeholders    | | `lake build` setup & freshness | Runs `lake build` in `cargo oxide setup`/`update` and on stale `.olean`s |  ### Before vs. After  1. **Equal-length `requires` (`requires = (a.len() == c.len())`)**    ```text    Before: Checked on the host launcher, dropped before Lean (`requiresLenGe := []` -> FAIL)    After:  Emits both `a.len() >= c.len()` and `c.len() >= a.len()` to Lean (`>` and `<` weaken to `>=` and `<=`)    ```  2. **Scalar math intrinsics (`a[idx].sin()`, `b[idx].cos()`, `idx.count_ones()`)**    ```text    Before: `__cuda_oxide_rust_intrinsic_sinf32` missed the `core::` / `cuda_device::` check -> REJECTED    After:  `is_pure_total_scalar_placeholder` admits known pure math/bit intrinsics as `.unk` / `OpaqueUint`            (un-inlined user `f32 -> f32` helpers and UB unchecked intrinsics remain rejected)    ```  3. **Lean proof library build (`cargo oxide setup` / `update` and `runner.rs`)**    ```text    Before: `setup`/`update` skipped `lake build

- **Issue #1866** (2026-11-25): **fix(cuda-oxide): support reverse indexing in writes_all_elems and harden write coverage**
  *Symptoms*: ## Summary  Fixes `#[verify(writes_all_elems(...))]` for reverse and swapped 1D output indexing (`c[c.len() - 1 - idx]`, `c[idx ^ 1]`), and closes three gaps around `writes_all_elems` and `cargo oxide test` builds.  | Area                     | Fix                                                            | |:-------------------------|:---------------------------------------------------------------| | Reverse output indexing  | Picks the actual writer thread instead of assuming thread `i`  | | Panics before write      | Rejects `writes_all_elems` if an earlier bounds check can trap | | 1D launch check          | Rejects `writes_all_elems` on `domain = 2` kernels             | | `cargo oxide test`       | Handles uninlined `idx.get()` in unoptimized dev/test builds   |  ### Before vs. After  1. **Reverse output indexing (`c[c.len() - 1 - idx]`)**    ```text    Example (`c.len() = 4`): Thread 0 -> c[3], Thread 1 -> c[2], Thread 2 -> c[1], Thread 3 -> c[0]     Before: Always checked Thread `i` for `c[i]` (checked Thread 0 for `c[0]`, saw `c[3]` -> FAIL)    After:  Checks Thread `3 - i` for `c[i]` (checks Thread 3 for `c[0]`, sees `c[0]` -> PASS)    ```  2. **Trapping bounds check before an output write**    ```text    Before: `c[idx] = a[idx]` without `requires(a.len() >= c.len())` passed even though `a[idx]` traps when `a.len() == 0`    After:  Requires every `mir.assert` along the write path to pass, so unchecked `a[idx]` fails closed    ```  3. **2D domain mismatch & `cargo 

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

### Incident Patch 1: `e969a765` (2026-11-26)
**Commit Message**: fix(lean-exporter): model raw slice pointers via SlicePtr and fail closed on untagged accesses (#1862)

## What This PR Does

Fixes raw-pointer origin tracking in `lean-exporter` around two rules: **model 1-to-1 before rejecting**, and **never silently drop a verified pointer's origin tag**.

1. **1-to-1 Raw Slice Pointer Transcription (`lean-exporter`)**: Transcribes `as_ptr` / `as_mut_ptr` / `get_unchecked` casts on verified slice parameters into `LocalTag::GlobalPtr(p)` + `MirRhs::SlicePtr(p)`, so Lean 4 verifies safe raw pointer offsets and rejects out-of-bounds offsets.
2. **Sound Pointer Origin Guards (`lean-exporter`)**:
   - Rejects stores through read-only `&[T]` slice parameters (`*(a.as_ptr() as *mut T) = ...`).
   - Blocks `expose_provenance` on verified slice and `SharedArray` pointers (`BarrierPtr` 2-CTA peer-bit masking is the single verified exception), while tagging `usize -> ptr` (`null()`, `NonNull::dangling()`) as `UnverifiedPtr`.
   - Requires `if / else` joins (`merge_local_tag`) to agree on pointer origin, marking mismatched branches (`GlobalPtr` vs `UnverifiedPtr`) as `ConflictingPtr` instead of letting the second branch overwrite the first.
   - Fails close

**File**: `cuda-oxide/crates/lean-exporter/src/runner.rs` (modified, +19/-8)
```diff
@@ -23,8 +23,13 @@ use std::{
     io::Write,
     path::{Path, PathBuf},
     process::Command,
+    sync::atomic::{AtomicU64, Ordering},
 };
 
+/// Monotonic per-process counter guaranteeing unique temp filenames when
+/// `verify_module_kernels` checks multiple kernels concurrently in one process.
+static NEXT_TEMP_SEQ: AtomicU64 = AtomicU64::new(0);
+
 use dialect_mir::ops::MirFuncOp;
 use pliron::{
     builtin::op_interfaces::SymbolOpInterface,
@@ -237,20 +242,26 @@ pub fn check_generated_lean_in_cache(
         return Ok(());
     }
 
+    let seq = NEXT_TEMP_SEQ.fetch_add(1, Ordering::Relaxed);
     let unique = std::time::SystemTime::now()
         .duration_since(std::time::UNIX_EPOCH)
         .unwrap_or_default()
         .as_nanos();
     let temp_path = env::temp_dir().join(format!(
-        "cuda_oxide_verified_{}_{unique}.lean",
+        "cuda_oxide_verified_{}_{seq}_{unique}.lean",
         std::process::id()
     ));
-    fs::write(&temp_path, lean_source).map_err(|e| {
-        reject(
-            "lean verifier",
-            format!("cannot write temporary Lean file: {e}"),
-        )
-    })?;
+    OpenOptions::new()
+        .write(true)
+        .create_new(true)
+        .open(&temp_path)
+        .and_then(|mut f| f.write_all(lean_source.as_bytes()))
+        .map_err(|e| {
+            reject(
+                "lean verifier",
+                format!("cannot write temporary Lean file: {e}"),
+            )
+        })?;
 
     let output = if use_direct_lean {
         Command::new(&lean_bin)
@@ -305,7 +316,7 @@ pub fn check_generated_lean_in_cache(
         }
     }
     if let Some(marker) = cache_marker {
-        let tmp = marker.with_extension(format!("tmp.{}", std::process::id()));
+        let tmp = marker.with_extension(format!("tmp.{}_{seq}", std::process::id()));
         if fs::write(&tmp, b"ok\n").is_ok() {
             let _ = fs::rename(&tmp, &marker);
         }
```

**File**: `cuda-oxide/crates/lean-exporter/src/translate/program.rs` (modified, +216/-33)
```diff
@@ -12,7 +12,9 @@
 
 use std::collections::{BTreeSet, HashMap, HashSet};
 
-use dialect_mir::types::{MirDisjointSliceType, MirEnumType, MirSliceType, MirStructType};
+use dialect_mir::types::{
+    MirDisjointSliceType, MirEnumType, MirPtrType, MirSliceType, MirStructType,
+};
 use pliron::{
     basic_block::BasicBlock,
     builtin::types::IntegerType,
@@ -39,6 +41,7 @@ use crate::{
         CfgBranchCond, CfgOpItem, GuardExpr, IdxExpr, TranscribedCfgBlock,
         TranscribedControlFlowCfg,
     },
+    symbol_name,
 };
 
 /// Parameter kind in a transcribed [`MirProgramData`].
@@ -227,6 +230,22 @@ enum LocalTag {
     Index1DWrapper(usize),
     /// Thread-local stack slot (`mir.alloca`).
     StackSlot,
+    /// Join of incompatible pointer origins across predecessors; fails closed on load/store/call.
+    ConflictingPtr,
+}
+
+/// Join `incoming` into `dst`'s provenance tag, saturating to [`LocalTag::ConflictingPtr`]
+/// whenever two control-flow predecessors disagree on a pointer's origin.
+fn merge_local_tag(tags: &mut HashMap<Value, LocalTag>, dst: Value, incoming: LocalTag) {
+    match tags.get(&dst).copied() {
+        None => {
+            tags.insert(dst, incoming);
+        }
+        Some(cur) if cur == incoming => {}
+        Some(_) => {
+            tags.insert(dst, LocalTag::ConflictingPtr);
+        }
+    }
 }
 
 /// Candidate `mir.assert` instruction awaiting pairing with the subsequent `mir.ptr_offset`
@@ -389,6 +408,14 @@ pub(super) fn translate_mir_program(
             || spec.mutable_slice_params.contains(&p)
             || spec.requires_len_ge.iter().any(|&(l, r)| l == p || r == p)
     };
+    // Parameters a `#[verify]` clause makes an access or coverage claim about.
+    let is_claimed_param = |p: usize| -> bool {
+        spec.no_oob_idx.contains(&p)
+            || spec.disjoint_writes.contains(&p)
+            || spec.writes_all_elems.contains(&p)
+            || spec.mutable_slice_params.contains(&p)
+    };
+    let kernel_name = symbol_name(ctx, function).unwrap_or_else(|_| "<kernel>".to_string());
     for (idx, arg) in graph.blocks[0].deref(ctx).arguments().enumerate() {
         let arg_vid = *val_ids.entry(arg).or_insert_with(|| {
             let id = next_var_id;
@@ -414,9 +441,16 @@ pub(super) fn translate_mir_program(
                 tags.insert(arg, LocalTag::ScalarWrapper(arg_vid));
             } else {
                 params.push(MirParamKind::Scalar(0));
+                tags.insert(arg, LocalTag::UnverifiedPtr);
             }
         } else {
             let w = mir_uint_width(ctx, ty);
+            if w <= 1
+                && (ty_ref.downcast_ref::<MirPtrType>().is_some()
+                    || ty_ref.downcast_ref::<MirStructType>().is_some())
+            {
+                tags.insert(arg, LocalTag::UnverifiedPtr);
+            }
             params.push(MirParamKind::Scalar(if w <= 1 { 0 } else { w }));
         }
     }
@@ -999,11 +1033,11 @@ pub(super) fn translate_mir_program(
                     let (src, res) = (op.get_operand(0), op.get_result(0));
                     let fi = attribute_field_index(&op.attributes, "index")
                         .or_else(|| attribute_field_index(&op.attributes, "field_index"));
-                    if let Some(LocalTag::SliceParam(p, ver)) = tags.get(&src).copied() {
+                    if let Some(LocalTag::SliceParam(p, _)) = tags.get(&src).copied() {
                         if fi == Some(0) {
                             tags.insert(
                                 res,
-                                if ver {
+                                if is_claimed_param(p) {
                                     LocalTag::GlobalPtr(p)
                                 } else {
                                     LocalTag::UnverifiedPtr
@@ -1031,14 +1065,51 @@ pub(super) fn translate_mir_program(
                     && op.get_num_results() == 1
                 {
                     let cstr = format!("{:?}", op.attributes);
-                    if (cstr.contains("PtrToPtr")
+                    if cstr.contains("PointerExposeAddress") {
+                        if let Some(t @ (LocalTag::BarrierPtr { .. } | LocalTag::UnverifiedPtr)) =
+                            tags.get(&op.get_operand(0)).copied()
+                        {
+                            tags.insert(op.get_result(0), t);
+                        }
+                    } else if cstr.contains("PointerWithExposedProvenance") {
+                        let src_op = op.get_operand(0);
+                        if let Some(t @ LocalTag::BarrierPtr { .. }) = tags.get(&src_op).copied() {
+                            tags.insert(op.get_result(0), t);
+                        } else {
+                            tags.insert(op.get_result(0), LocalTag::UnverifiedPtr);
+                        }
+                    } else if (cstr.contains("PtrToPtr")
                         || cstr.contains("StaticAddress")
-                        || cs
```

**File**: `cuda-oxide/crates/lean-exporter/tests/export.rs` (modified, +191/-0)
```diff
@@ -2392,3 +2392,194 @@ mir.func @vecadd_rev: builtin.function <(mir.slice <builtin.fp32 ,mutable:false,
         "unexpected domain=2 error: {dom2_err}"
     );
 }
+
+/// `a.as_ptr().add(idx + 1_000_000)` on a slice parameter named in `#[verify]`: slice -> raw slice
+/// -> thin pointer casts, then `mir.ptr_offset` and `mir.load`. The model tracks no access on it.
+fn with_raw_far_read(fixture: &str) -> String {
+    fixture
+        .replacen(
+            "    b_ptr = mir.extract_field (b)",
+            concat!(
+                "    raw_slice = mir.cast (a) [] [cast_kind: mir.cast_kind PtrToPtr, pointer_kind_authority: mir.pointer_kind_authority RawAddress]: <(mir.slice <builtin.fp32 ,mutable:false,kind:SharedRef>) -> (mir.slice <builtin.fp32 ,mutable:false,kind:RawConst>)>;\n",
+                "    raw_ptr = mir.cast (raw_slice) [] [cast_kind: mir.cast_kind PtrToPtr, pointer_kind_authority: mir.pointer_kind_authority RustCast]: <(mir.slice <builtin.fp32 ,mutable:false,kind:RawConst>) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>)>;\n",
+                "    far = mir.constant () [] [value: builtin.integer <1000000: ui64>]: <() -> (builtin.integer ui64)>;\n",
+                "    far_idx = mir.add (idx, far) [] []: <(builtin.integer ui64, builtin.integer ui64) -> (builtin.integer ui64)>;\n",
+                "    far_elem = mir.ptr_offset (raw_ptr, far_idx) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>, builtin.integer ui64) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>)>;\n",
+                "    far_val = mir.load (far_elem) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>) -> (builtin.fp32)>;\n",
+                "    b_ptr = mir.extract_field (b)",
+            ),
+            1,
+        )
+        .replacen(
+            "    mir.store (c_elem, sum) [] []:",
+            "    sum_far = mir.add (sum, far_val) [] []: <(builtin.fp32, builtin.fp32) -> (builtin.fp32)>;\n    mir.store (c_elem, sum_far) [] []:",
+            1,
+        )
+}
+
+/// Verify that `as_ptr` / `as_mut_ptr` casts on verified slice parameters transcribe
+/// 1-to-1 into `MirRhs::SlicePtr`, so Lean 4 proves in-bounds raw pointer accesses and
+/// rejects out-of-bounds raw pointer reads and stores.
+#[test]
+fn verifies_safe_raw_slice_pointers_and_rejects_oob_immutable_and_exposed_accesses() {
+    let Some(lean_dir) = lean_package_dir_if_available() else {
+        return;
+    };
+
+    // 1. Positive: in-bounds `a.as_ptr().add(idx)` under `idx < c.len()` + `a.len() >= c.len()`
+    //    transcribes to `MirRhs::SlicePtr(0)` + `MirRhs::PtrOffset` and verifies in Lean 4.
+    let safe_raw_read = VECADD_FIXTURE.replacen(
+        "    a_ptr = mir.extract_field (a) [] [index: mir.field_index 0]: <(mir.slice <builtin.fp32 ,mutable:false,kind:SharedRef>) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:Erased>)>;\n    a_elem = mir.ptr_offset (a_ptr, idx) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:Erased>, builtin.integer ui64) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:Erased>)>;\n    a_val = mir.load (a_elem) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:Erased>) -> (builtin.fp32)>;",
+        concat!(
+            "    a_raw_slice = mir.cast (a) [] [cast_kind: mir.cast_kind PtrToPtr, pointer_kind_authority: mir.pointer_kind_authority RawAddress]: <(mir.slice <builtin.fp32 ,mutable:false,kind:SharedRef>) -> (mir.slice <builtin.fp32 ,mutable:false,kind:RawConst>)>;\n",
+            "    a_ptr = mir.cast (a_raw_slice) [] [cast_kind: mir.cast_kind PtrToPtr, pointer_kind_authority: mir.pointer_kind_authority RustCast]: <(mir.slice <builtin.fp32 ,mutable:false,kind:RawConst>) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>)>;\n",
+            "    a_elem = mir.ptr_offset (a_ptr, idx) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>, builtin.integer ui64) -> (mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>)>;\n",
+            "    a_val = mir.load (a_elem) [] []: <(mir.ptr <builtin.fp32 ,mutable:false,addrspace:0,kind:RawConst>) -> (builtin.fp32)>;",
+        ),
+        1,
+    );
+    let safe_lean = export_named_source(&safe_raw_read, "vecadd")
+        .expect("safe raw-pointer read from verified slice exports cleanly");
+    assert!(safe_lean.contains("(.slicePtr 0)"));
+    lean_exporter::runner::check_generated_lean(&safe_lean, &lean_dir)
+        .expect("Lean 4 proves in-bounds `a.as_ptr().add(idx)` read");
+
+    // 2. Negative: `a.as_ptr().add(idx + 1_000_000)` exports and fails `verify_no_oob_idx_param0` in Lean 4.
+    let raw_far = with_raw_far_read(VECADD_FIXTURE);
+    let raw_far_lean =
+        export_named_source(&raw_far, "vecadd").expect("exports OOB raw-pointer read for Lean VC");
+    let far_err = lean_exporter::runner::check_generated_lean(&raw_far_lean, &lean_dir)
+        .expect_err("Lean 4 must
```

---

### Incident Patch 2: `acec7dac` (2026-11-26)
**Commit Message**: fix(lean): step both arms on an unknown condition (#1860)

## What This PR Does

Closes a specification gap in `CudaOxide/Mir/Program.lean` where `Reachable` stopped at `.unk` branch conditions (`if xs[i] > 0.0`), leaving universal safety contracts blind inside float or memory-load branches:

1. **Both-Arm `Reachable` on `.unk` (`CudaOxide/Mir/Program.lean`, `Proofs/Program/Invariant.lean`)**: Relaxes `Reachable.stepCondTrue` to `outRegs cond != .bool false` and `stepCondFalse` to `outRegs cond != .bool true` so unknown runtime guards step into both arms.
2. **Definite Coverage Guard (`CudaOxide/Mir/Program.lean`, `tests/program/*`)**: Keeps `ReachableTrapFree` strict (`= .bool true` / `= .bool false`) for existential `MirWritesAllElems`, bridges `ReachableTrapFree.toReachable`, and adds both safety and write-coverage counterexamples to `check.py`.

---

### 1. Why `Reachable` Needed Both Arms on `.unk` (While `ReachableTrapFree` Stays Strict)

In `Mir/Program.lean`, float comparisons and memory loads evaluate to `Val.unk`. Previously, requiring exact `= .bool true` / `= .bool false` blocked both arms of an unknown `condBr` in `Reachable`:

```text
BEFORE (`main`, `Reachable` stuck

**File**: `cuda-oxide/oxide-proofs-preview/CudaOxide/Mir/Program.lean` (modified, +10/-6)
```diff
@@ -640,22 +640,24 @@ inductive Reachable (f : MirFunc) (env : InputEnv) (t : ThreadCtx) :
       (hterm : (f.blockAt b).term = .goto target args)
       (hdst : target < f.blocks.length) :
       Reachable f env t target (bindBlockArgs outRegs outRegs (f.blockAt target).args args) outPhase
-  /-- Conditional `mir.cond_br` taking `thenBlk` when `outRegs cond = .bool true`. -/
+  /-- Conditional `mir.cond_br` taking `thenBlk` unless `outRegs cond = .bool false`.
+      A `.unk` condition, such as a comparison on a loaded value, may take either arm. -/
   | stepCondTrue {b tBlk fBlk cond phase outPhase : Nat} {regs outRegs : RegFile}
       {evs : List MemEvent} {tevs : List TmemEvent} {tArgs fArgs : List Nat}
       (hreach : Reachable f env t b regs phase)
       (hexec : execStmts f env t regs phase (f.blockAt b).term (f.blockAt b).stmts = (outRegs, outPhase, evs, tevs))
       (hterm : (f.blockAt b).term = .condBr cond tBlk tArgs fBlk fArgs)
-      (hcond : outRegs cond = .bool true)
+      (hcond : outRegs cond ≠ .bool false)
       (hdst : tBlk < f.blocks.length) :
       Reachable f env t tBlk (bindBlockArgs outRegs outRegs (f.blockAt tBlk).args tArgs) outPhase
-  /-- Conditional `mir.cond_br` taking `elseBlk` when `outRegs cond = .bool false`. -/
+  /-- Conditional `mir.cond_br` taking `elseBlk` unless `outRegs cond = .bool true`.
+      A `.unk` condition may take either arm. -/
   | stepCondFalse {b tBlk fBlk cond phase outPhase : Nat} {regs outRegs : RegFile}
       {evs : List MemEvent} {tevs : List TmemEvent} {tArgs fArgs : List Nat}
       (hreach : Reachable f env t b regs phase)
       (hexec : execStmts f env t regs phase (f.blockAt b).term (f.blockAt b).stmts = (outRegs, outPhase, evs, tevs))
       (hterm : (f.blockAt b).term = .condBr cond tBlk tArgs fBlk fArgs)
-      (hcond : outRegs cond = .bool false)
+      (hcond : outRegs cond ≠ .bool true)
       (hdst : fBlk < f.blocks.length) :
       Reachable f env t fBlk (bindBlockArgs outRegs outRegs (f.blockAt fBlk).args fArgs) outPhase
 
@@ -735,8 +737,10 @@ theorem ReachableTrapFree.toReachable {f : MirFunc} {env : InputEnv} {t : Thread
   induction h with
   | entry hpos => exact Reachable.entry hpos                 -- Base entry block `0`
   | stepGoto _ _ hex hterm hdst ih => exact Reachable.stepGoto ih hex hterm hdst
-  | stepCondTrue _ _ hex hterm hc hdst ih => exact Reachable.stepCondTrue ih hex hterm hc hdst
-  | stepCondFalse _ _ hex hterm hc hdst ih => exact Reachable.stepCondFalse ih hex hterm hc hdst
+  | stepCondTrue _ _ hex hterm hc hdst ih =>
+      exact Reachable.stepCondTrue ih hex hterm (by rw [hc]; simp) hdst
+  | stepCondFalse _ _ hex hterm hc hdst ih =>
+      exact Reachable.stepCondFalse ih hex hterm (by rw [hc]; simp) hdst
 
 /-- `MemEvent` `ev` is emitted on a trap-free execution path (every `Stmt.assertCond`
     along predecessor blocks and inside the emitting block evaluates to `.bool true`). -/
```

**File**: `cuda-oxide/oxide-proofs-preview/CudaOxide/Proofs/Program/Invariant.lean` (modified, +16/-12)
```diff
@@ -831,11 +831,13 @@ theorem symReachable_sound {f : MirFunc} {tbl : List SymBlockInv}
       have hcv := hmOut cond; dsimp only at hcv
       cases hget : (symExecStmts f (tbl.getD b0 {}).effCond (tbl.getD b0 {}).regs (tbl.getD b0 {}).phaseSpec (.condBr cond tBlk tArgs fBlk fArgs) (f.blockAt b0).stmts).1.getVar cond with
       | bool cSym =>                                      --   Tracked boolean guard: strengthen `effCond` with `cSym = true`
-          rw [hget] at hbrOk hcv
-          rw [hcond, SymVal.matchesVal] at hcv
-          injection hcv with hcTrue
-          simp only [Bool.and_eq_true] at hbrOk
-          have hec := symBool_conj_true hpc0 hcTrue.symm
+          rw [hget] at hbrOk hcv                          --   Substitute `getVar cond = .bool cSym` into edge check & match
+          rw [SymVal.matchesVal] at hcv                   --   Unpack `outR cond = .bool (cSym.eval env t havoc)`
+          rw [hcv] at hcond                               --   Rewrite `outR cond ≠ .bool false` using `cSym.eval`
+          have hcTrue : cSym.eval env t havoc = true := by --   A tracked boolean other than `false` evaluates to `true`
+            simpa using hcond
+          simp only [Bool.and_eq_true] at hbrOk           --   Split `validSymEdge` conjunction across both outgoing arms
+          have hec := symBool_conj_true hpc0 hcTrue       --   Combine entry path condition `hpc0` with `cSym = true`
           obtain ⟨hrDst, havoc', hpcDst, hpsDst, hmDst⟩ :=
             validSymEdge_sound hvalidIn hbrOk.1 hec hmOut hpsOut
           exact ⟨hdst, hrDst, havoc', hpcDst, hpsDst, hmDst⟩
@@ -860,13 +862,15 @@ theorem symReachable_sound {f : MirFunc} {tbl : List SymBlockInv}
       have hcv := hmOut cond; dsimp only at hcv
       cases hget : (symExecStmts f (tbl.getD b0 {}).effCond (tbl.getD b0 {}).regs (tbl.getD b0 {}).phaseSpec (.condBr cond tBlk tArgs fBlk fArgs) (f.blockAt b0).stmts).1.getVar cond with
       | bool cSym =>                                      --   Tracked boolean guard: strengthen `effCond` with `!cSym = true`
-          rw [hget] at hbrOk hcv
-          rw [hcond, SymVal.matchesVal] at hcv
-          injection hcv with hcFalse
-          simp only [Bool.and_eq_true] at hbrOk
-          have hnotTrue : (SymBool.not cSym).eval env t havoc = true := by
-            simp [SymBool.eval, hcFalse.symm]
-          have hec := symBool_conj_true hpc0 hnotTrue
+          rw [hget] at hbrOk hcv                          --   Substitute `getVar cond = .bool cSym` into edge check & match
+          rw [SymVal.matchesVal] at hcv                   --   Unpack `outR cond = .bool (cSym.eval env t havoc)`
+          rw [hcv] at hcond                               --   Rewrite `outR cond ≠ .bool true` using `cSym.eval`
+          have hcFalse : cSym.eval env t havoc = false := by -- A tracked boolean other than `true` evaluates to `false`
+            simpa using hcond
+          simp only [Bool.and_eq_true] at hbrOk           --   Split `validSymEdge` conjunction across both outgoing arms
+          have hnotTrue : (SymBool.not cSym).eval env t havoc = true := by -- Negated guard `!cSym` evaluates to `true`
+            simp [SymBool.eval, hcFalse]
+          have hec := symBool_conj_true hpc0 hnotTrue     --   Combine entry path condition `hpc0` with `!cSym = true`
           obtain ⟨hrDst, havoc', hpcDst, hpsDst, hmDst⟩ :=
             validSymEdge_sound hvalidIn hbrOk.2 hec hmOut hpsOut
           exact ⟨hdst, hrDst, havoc', hpcDst, hpsDst, hmDst⟩
```

**File**: `cuda-oxide/oxide-proofs-preview/check.py` (modified, +5/-1)
```diff
@@ -23,6 +23,8 @@
     ("RejectedMutSliceRace.lean", "cross-thread &mut [T] read-write race"),
     ("RejectedTrappingWrite.lean", "trapping mir.assert before writes_all_elems store"),
     ("RejectedDivergentSharedRace.lean", "shared-memory race masked by divergent sync_threads"),
+    ("tests/program/RejectedUnknownGuard.lean", "branch pruned on an untracked guard"),
+    ("tests/program/RejectedUnknownWriteCoverage.lean", "write coverage claimed across an untracked guard"),
 )
 
 
@@ -76,9 +78,11 @@ def main():
     require_success("env", "lean", "tests/exporter/Scalar.lean")
     require_success("env", "lean", "tests/vecadd/Accepted.lean")
     require_success("env", "lean", "tests/vecadd/Counterexamples.lean")
+    require_success("env", "lean", "tests/program/UnknownGuard.lean")
     print("PASS: scalar semantics, vecadd access model, typed indices, and counterexamples.", flush=True)
     for filename, label in REJECTED:
-        result = run_lake("env", "lean", f"tests/vecadd/{filename}")
+        rel_path = filename if "/" in filename else f"tests/vecadd/{filename}"
+        result = run_lake("env", "lean", rel_path)
         if result.returncode == 0:
             raise RuntimeError(f"The false obligation unexpectedly passed: {filename}")
         # Require a failed proof obligation, not an import or tool error.
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/program/RejectedUnknownGuard.lean` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+/-
+SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+SPDX-License-Identifier: Apache-2.0
+-/
+
+import CudaOxide
+
+/-!
+Block 0 branches on an opaque value. `Reachable` must reach both arms. A proof that
+only block 0 is reachable must fail.
+-/
+open CudaOxide.Mir.Program
+
+/-- Block 0 branches on an opaque value. -/
+def unknownGuard : MirFunc :=
+  { domain := 1, blockDimX := 32, blockDimY := 1, params := [.slice false]
+  , blocks := [
+      { args := [⟨0, 0⟩], stmts := [.assign 2 .opaqueVal], term := .condBr 2 1 [] 2 [] },
+      { stmts := [.assign 3 (.constBool false), .assertCond 0 3], term := .ret },
+      { term := .ret } ] }
+
+-- This claim is false because a `.unk` condition prunes neither arm.
+example {env t b regs phase} (h : Reachable unknownGuard env t b regs phase) : b = 0 := by
+  induction h with                                          -- Induct over `Reachable` steps from block `0`
+  | entry => rfl                                            -- Entry starts at block `0`
+  | stepGoto _ _ hterm _ ih =>                              -- Block `0` ends in `condBr`, not `goto`
+      subst ih; simp [unknownGuard, MirFunc.blockAt] at hterm
+  | stepCondTrue _ hexec hterm hcond _ ih | stepCondFalse _ hexec hterm hcond _ ih =>
+      subst ih                                              -- Substitute `b = 0` from induction hypothesis
+      simp [unknownGuard, MirFunc.blockAt] at hterm         -- Unfold block `0`'s `condBr` terminator
+      obtain ⟨rfl, -⟩ := hterm                              -- The branch condition is register `2`
+      simp [unknownGuard, MirFunc.blockAt, execStmts, evalRhs] at hexec -- Execute block `0` statements
+      obtain ⟨rfl, -⟩ := hexec                              -- Block 0 leaves `.unk` in register `2`
+      simp [RegFile.set] at hcond <;> omega                 -- `.unk` excludes neither arm
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/program/RejectedUnknownWriteCoverage.lean` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/-
+SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+SPDX-License-Identifier: Apache-2.0
+-/
+
+import CudaOxide
+
+/-!
+Block 0 branches on an opaque runtime condition; only block 1 writes `out[bx]`, while block 2
+returns without writing. `MirWritesAllElems` requires `EmitsTrapFreeEvent` (`ReachableTrapFree`),
+so an angelic attempt to pick block 1 across `.unk` must fail.
+-/
+open CudaOxide.Mir.Program CudaOxide.Contracts.Program
+
+/-- Kernel that writes `out[bx]` only on the `then` arm of an untracked `.opaqueVal` branch. -/
+def conditionalWrite : MirFunc :=
+  { domain := 1, blockDimX := 1, blockDimY := 1, params := [.disjointSlice]
+  , blocks := [
+      { args := [⟨0, 0⟩], stmts := [.assign 2 .opaqueVal], term := .condBr 2 1 [] 2 [] },
+      { stmts := [ .assign 3 (.slicePtr 0)
+                 , .assign 4 (.sreg .ctaidX)
+                 , .assign 5 (.ptrOffset 3 4)
+                 , .assign 6 (.constInt 32 1)
+                 , .store 5 6 ], term := .ret },
+      { term := .ret } ] }
+
+-- This claim is false because `.unk` does not guarantee taking block 1 (`ReachableTrapFree` requires `.bool true`).
+example : MirWritesAllElems conditionalWrite 0 := by
+  intro env gridDimX gridDimY _ _ hgyPos _ hcov elemIdx helem -- Unpack launch & element bounds
+  refine ⟨{ bx := elemIdx, by_ := 0, tx := 0, ty := 0 },      -- Propose witness thread `bx = elemIdx`
+          { isWrite := true, space := .global, bufId := 0, index := elemIdx, phase := 0 }, ?_⟩
+  have hbxLt : elemIdx < gridDimX := by                       -- `blockDimX = 1` gives `elemIdx < gridDimX`
+    simp [conditionalWrite] at hcov; omega
+  refine ⟨?_, hbxLt, hgyPos, ?_, rfl, rfl, rfl, rfl⟩          -- Split thread validity vs `EmitsTrapFreeEvent`
+  · refine ⟨by decide, by decide, ?_, by decide, by simp [conditionalWrite], by simp [conditionalWrite]⟩
+    omega                                                     -- `elemIdx < gridDimX <= 2^32`
+  · refine ⟨1, 0, _, .stepCondTrue (.entry (by decide)) rfl rfl rfl ?_ (by decide), rfl, ?_⟩
+    · simp [conditionalWrite, MirFunc.blockAt, execStmts, evalRhs, RegFile.set] <;> omega -- `.unk = .bool true` fails
+    · simp [conditionalWrite, MirFunc.blockAt, execStmts, evalRhs, RegFile.set]           -- Block 1 emits the store
```

**File**: `cuda-oxide/oxide-proofs-preview/tests/program/UnknownGuard.lean` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+/-
+SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+SPDX-License-Identifier: Apache-2.0
+-/
+
+import CudaOxide
+
+/-! Checks that `Reachable` follows both arms of a branch whose condition is `.unk`. -/
+namespace UnknownGuardTests
+open CudaOxide.Mir.Program CudaOxide.Contracts.Program
+
+/-- Block 0 branches on an opaque value. The then-arm asserts `false`. -/
+def unknownGuard : MirFunc :=
+  { domain := 1, blockDimX := 32, blockDimY := 1, params := [.slice false]
+  , blocks := [
+      { args := [⟨0, 0⟩], stmts := [.assign 2 .opaqueVal], term := .condBr 2 1 [] 2 [] },
+      { stmts := [.assign 3 (.constBool false), .assertCond 0 3], term := .ret },
+      { term := .ret } ] }
+
+/-- The then-arm is reachable on every thread. -/
+theorem then_arm_reachable (env : InputEnv) (t : ThreadCtx) :
+    ∃ regs, Reachable unknownGuard env t 1 regs 0 :=
+  ⟨_, .stepCondTrue (.entry (by decide)) rfl rfl (by simp [evalRhs, RegFile.set]) (by decide)⟩
+
+/-- The else-arm is reachable on every thread. -/
+theorem else_arm_reachable (env : InputEnv) (t : ThreadCtx) :
+    ∃ regs, Reachable unknownGuard env t 2 regs 0 :=
+  ⟨_, .stepCondFalse (.entry (by decide)) rfl rfl (by simp [evalRhs, RegFile.set]) (by decide)⟩
+
+/-- The `assert(false)` in the then-arm of a `.unk` branch is not redundant. -/
+theorem assert_not_redundant (env : InputEnv) (t : ThreadCtx)
+    (henv : unknownGuard.validInput env) (ht : unknownGuard.validThread t) :
+    ¬ MirAssertRedundant unknownGuard 0 := by
+  intro h                                                          -- Assume `MirAssertRedundant unknownGuard 0` holds
+  obtain ⟨regs, hr⟩ := then_arm_reachable env t                    -- Witness reachable `then`-arm state `(1, regs, 0)`
+  have hcond := h env t 1 0 regs henv ht hr [.assign 3 (.constBool false)] [] 3 rfl -- Assert `0` reads register `3`
+  simp [execStmts, evalRhs, RegFile.set] at hcond                  -- Register `3` evaluates to `.bool false`, contradiction
+
+#print axioms then_arm_reachable
+#print axioms else_arm_reachable
+#print axioms assert_not_redundant
+
+end UnknownGuardTests
```

---

### Incident Patch 3: `97f61aef` (2026-11-26)
**Commit Message**: ci: build both `cargo oxide new` templates against the checkout (#1764)

Closes #1763.

The scaffold tests check what `cargo oxide new` writes as text, and
nothing compiles it. This builds both templates on every
examples-compile run.

## How

```text
cargo build -p cargo-oxide (the tree's)
  └─ cargo oxide new scaffold_sync / scaffold_async --async   (in a temp dir)
       └─ append [patch."<the git URL the template names>"] → this checkout
            (only the cuda-* crates the template depends on; its dependency lines stay as users get them)
            └─ cargo oxide build
                 └─ fail if Cargo.lock still has a `git+` CUDA source
```

The last check covers a patch that silently doesn't apply. In that case
the build would quietly use GitHub's `main`, and the guard would test
nothing.

- **`cuda-oxide/scripts/check-scaffold-builds.sh`**: the new guard. It
runs from anywhere in the repository and finds `cargo-oxide` through
`cargo metadata`, so it honours `CARGO_TARGET_DIR`.
- **`examples-compile`**: a new step after "Compile every example". It
reuses that step's shared target dir, LLVM and `CARGO_INCREMENTAL=0`, so
the backend and `cargo-oxide` are already built.

##

**File**: `.github/workflows/examples-compile.yml` (modified, +19/-3)
```diff
@@ -84,8 +84,8 @@ jobs:
     # device codegen. Typically well under an hour with the shared
     # CARGO_TARGET_DIR; the timeout leaves headroom for cold runners.
     # Leave job-level headroom around the 50-minute full compile and the
-    # focused 10-minute materialization gate, plus toolkit/LLVM setup.
-    timeout-minutes: 75
+    # focused 10-minute post-smoketest gates, plus toolkit/LLVM setup.
+    timeout-minutes: 85
     strategy:
       fail-fast: false
       # The baseline lane keeps its existing job name (empty suffix); the newer
@@ -145,7 +145,7 @@ jobs:
           opt-23 --version | head -2
 
       - name: Compile every example (smoketest --compile-only)
-        # Step-level timeout, below the job's 75: a job-level timeout
+        # Step-level timeout, below the job's 85: a job-level timeout
         # CANCELS the job and `if: failure()` never fires, losing the
         # logs. A step timeout fails the step, so the upload still runs.
         timeout-minutes: 50
@@ -173,6 +173,22 @@ jobs:
 
           cuda-oxide/scripts/smoketest.sh --compile-only --no-color
 
+      # The scaffold tests read `cargo oxide new` output as text. This builds
+      # both templates against this checkout, so an API change that breaks a
+      # new user's first project fails here. Reuses the shared target dir.
+      - name: Both `cargo oxide new` templates build
+        timeout-minutes: 10
+        env:
+          CUDA_OXIDE_LLC: /usr/bin/llc-23
+          CARGO_TARGET_DIR: ${{ runner.temp }}/examples-shared-target
+          CARGO_INCREMENTAL: "0"
+        run: |
+          set -euo pipefail
+          sysroot="$(rustc --print sysroot)"
+          export LIBRARY_PATH="${sysroot}/lib:${LIBRARY_PATH:-}"
+          export LD_LIBRARY_PATH="${sysroot}/lib:${LD_LIBRARY_PATH:-}"
+          bash cuda-oxide/scripts/check-scaffold-builds.sh
+
       # Builds shared_static_names, then copies with added kernels, in
       # release and full-debug, and requires the original kernels' PTX to be
       # unchanged (#1477). Reuses the shared target dir, so it adds only the
```

**File**: `cuda-oxide/scripts/check-scaffold-builds.sh` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+#!/usr/bin/env bash
+# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+# SPDX-License-Identifier: Apache-2.0
+
+# Build both `cargo oxide new` templates against this checkout.
+#
+# The scaffold tests in cargo-oxide read the generated files as text; nothing
+# compiles them, so an API change in cuda-host or cuda-core can break the first
+# project a new user creates while every check stays green. This generates the
+# sync and the async project, redirects the template's git source to this
+# checkout with a [patch] table (the dependency lines stay as users get them),
+# and runs `cargo oxide build` on each.
+#
+# Needs the SIMT toolchain, LLVM tools and a CUDA toolkit, as any example
+# build does. Run from anywhere in the repository.
+
+set -euo pipefail
+
+root="$(git rev-parse --show-toplevel)"
+oxide="${root}/cuda-oxide"
+work="$(mktemp -d "${TMPDIR:-/tmp}/scaffold-builds.XXXXXX")"
+trap 'rm -rf "${work}"' EXIT
+
+(cd "${oxide}" && cargo build --quiet -p cargo-oxide)
+target_dir="$(cd "${oxide}" && cargo metadata --format-version 1 --no-deps |
+    python3 -c 'import json, sys; print(json.load(sys.stdin)["target_directory"])')"
+cargo_oxide="${target_dir}/debug/cargo-oxide"
+
+ptxas_bin=""
+for candidate in "${CUDA_OXIDE_PTXAS:-}" \
+    "$(command -v ptxas 2>/dev/null || true)" \
+    "${CUDA_TOOLKIT_PATH:+${CUDA_TOOLKIT_PATH}/bin/ptxas}" \
+    "${CUDA_HOME:+${CUDA_HOME}/bin/ptxas}" \
+    /usr/local/cuda/bin/ptxas; do
+    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
+        ptxas_bin="${candidate}"
+        break
+    fi
+done
+
+failed=0
+for mode in sync async; do
+    name="scaffold_${mode}"
+    flags=()
+    [[ "${mode}" == "async" ]] && flags+=(--async)
+    (cd "${work}" && "${cargo_oxide}" oxide new "${name}" "${flags[@]}" >/dev/null)
+    project="${work}/${name}"
+
+    # Patch exactly the git source the template names.
+    source_url="$(sed -nE 's/^cuda-device = \{ git = "([^"]+)".*/\1/p' "${project}/Cargo.toml")"
+    if [[ -z "${source_url}" ]]; then
+        echo "error: the ${mode} template no longer takes cuda-device from git" >&2
+        failed=1
+        continue
+    fi
+    {
+        echo
+        echo "[patch.\"${source_url}\"]"
+        for crate in cuda-device cuda-host cuda-core cuda-async; do
+            grep -q "^${crate} = " "${project}/Cargo.toml" || continue
+            case "${crate}" in
+                cuda-device | cuda-host) path="${oxide}/crates/${crate}" ;;
+                *) path="${root}/${crate}" ;;
+            esac
+            echo "${crate} = { path = \"${path}\" }"
+        done
+    } >>"${project}/Cargo.toml"
+
+    if ! (cd "${project}" && "${cargo_oxide}" oxide build) >"${work}/${name}.log" 2>&1; then
+        echo "error: the ${mode} \`cargo oxide new\` template does not build:" >&2
+        tail -n 80 "${work}/${name}.log" >&2
+        failed=1
+        continue
+    fi
+    # A patch that silently did not apply would have built GitHub's main.
+    if grep -qE '^source = "git\+' "${project}/Cargo.lock"; then
+        echo "error: the ${mode} project resolved a CUDA crate from git, not this checkout" >&2
+        failed=1
+        continue
+    fi
+    ptx="${project}/${name}.ptx"
+    if [[ ! -s "${ptx}" ]]; then
+        echo "error: the ${mode} project build produced no device PTX at ${ptx}" >&2
+        failed=1
+        continue
+    fi
+    if [[ -n "${ptxas_bin}" ]]; then
+        ptx_arch="$(sed -nE 's/^\.target[[:space:]]+(sm_[0-9]+[af]?).*/\1/p' "${ptx}" | head -n 1)"
+        if [[ -z "${ptx_arch}" ]]; then
+            echo "error: ${ptx} has no .target directive" >&2
+            failed=1
+            continue
+        fi
+        if ! "${ptxas_bin}" -arch="${ptx_arch}" "${ptx}" -o "${work}/${name}.cubin" \
+            >"${work}/${name}.ptxas.log" 2>&1; then
+            echo "error: ptxas rejected ${mode} template PTX (${ptx_arch}):" >&2
+            cat "${work}/${name}.ptxas.log" >&2
+            failed=1
+            continue
+        fi
+    fi
+    echo "${mode} template: builds against this checkout"
+done
+
+exit "${failed}"
```

#### Recent Merged Pull Requests:
- **PR #1878** (2026-11-26): fix(cuda-oxide): support == requires, pure math intrinsics, and lake setup in #[verify] (@nihalpasham)
- **PR #1874** (2026-11-26): feat(cuda-oxide): honor #[no_mangle]/#[export_name] on device statics and evaluate array lengths (@nihalpasham)
- **PR #1873** (2026-11-26): feat(cuda-oxide): opt-in 64-bit pointers (CUDA_OXIDE_NO_SHORT_PTR) via ExportTarget (@nihalpasham)
- **PR #1872** (2026-11-26): feat(cuda-oxide): add #[device(export)] to root .func exports alongside kernels (@nihalpasham)
- **PR #1871** (2026-11-26): feat(cuda-oxide): ptx_asm! up to 256 inputs and #[constant(export_name)] (@nihalpasham)
- **PR #1870** (2026-11-26): ci(cuda-oxide): add Windows MSVC compile and PTX/cubin verification lane (@nihalpasham)

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

## X. lean-exporter): model raw slice pointers via SlicePtr and fail closed on untagge

**RULE**:
When implementing operations in `cuda-oxide/crates/lean-exporter/src/runner.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e969a765`: lean-exporter): model raw slice pointers via SlicePtr and fail closed on untagged accesses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/crates/lean-exporter/src/runner.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    sync::atomic::{AtomicU64, Ordering},
/// Monotonic per-process counter guaranteeing unique temp filenames when
/// `verify_module_kernels` checks multiple kernels concurrently in one process.
static NEXT_TEMP_SEQ: AtomicU64 = AtomicU64::new(0);

    let seq = NEXT_TEMP_SEQ.fetch_add(1, Ordering::Relaxed);
        "cuda_oxide_verified_{}_{seq}_{unique}.lean",
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .and_then(|mut f| f.write_all(lean_source.as_bytes()))
        .map_err(|e| {
            reject(
                "lean verifier",
                format!("cannot write temporary Lean file: {e}"),
            )
        })?;
        let tmp = marker.with_extension(format!("tmp.{}_{seq}", std::process::id()));
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "cuda_oxide_verified_{}_{unique}.lean",
    fs::write(&temp_path, lean_source).map_err(|e| {
        reject(
            "lean verifier",
            format!("cannot write temporary Lean file: {e}"),
        )
    })?;
        let tmp = marker.with_extension(format!("tmp.{}", std::process::id()));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e969a765` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
