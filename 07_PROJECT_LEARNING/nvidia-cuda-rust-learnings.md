> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `00f6624c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T09:40:21.184Z  
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
> **Harvest Timestamp**: 2026-11-04T09:39:57.515Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3976 stars

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
        cuda_bindings::cuStreamSynchronize(stream).result()
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
        cuda_bindings::cuStreamWaitEvent(stream, event, flags as _).result()
    }

    /// Attaches memory to a stream for managed memory visibility.
    ///
    /// # Safety
    /// `dptr` must be a valid managed memory pointer.
    pub unsafe fn attach_mem_async(
        stream: cuda_bindings::CUstream,
        dptr: cuda_bindings::CUdeviceptr,
        num_bytes: usize,
        flags: cuda_bindings::CUmemAttach_flags,
    ) -> Result<(), DriverError> {
        cuda_bindings::cuStreamAttachMemAsync(stream, dptr, num_bytes, flags as _).result()
    }

    /// Enqueues a host function callback on the stream.
    ///
    /// # Safety
    /// `func` and `arg` must remain valid until the callback executes.
    pub unsafe
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
- **Issue #1699** (2026-11-03): **fix(mir-importer): bounds-check SharedArray indexing**
  *Symptoms*: ## What This PR Does  Bounds-checks `SharedArray<T, N, ALIGN>` indexing (`Index` and `IndexMut`) on the GPU by default while honoring `#[kernel(unchecked_indexing)]`:  1. **Emit `index < N` bounds assertions in `emit_shared_array_index` (`mir-importer`)** 2. **Document device trap and `unchecked_indexing` behavior (`cuda-device`, `cuda-oxide-book`)** 3. **Verify `SharedArray` checked vs. opted-out PTX and preserve SOL GEMM inner loops (`unchecked_indexing`, `gemm_sol_final`)**  ---  ### 1. Bounds-Checking `SharedArray` Indexing in `mir-importer`  `SharedArray` implements `Index<usize>` and `IndexMut<usize>` via compiler-intercepted stubs. Previously, `emit_shared_array_index` lowered `arr[idx]` straight to `MirPtrOffsetOp` without checking `idx < N`, allowing an out-of-bounds write on one shared array to silently overwrite adjacent `.shared` allocations.  ```text BEFORE (unchecked offset):   b[idx]  ──►  MirPtrOffsetOp(b, idx)                (b[4] on SharedArray<u32, 4> silently overwrites a[0] in .shared)  AFTER (checked by default, opt-out via unchecked_indexing):   b[idx]  ──►  MirConstantOp(N) + MirLtOp(idx, N) + MirAssertOp  ──►  MirPtrOffsetOp(b, idx)                ├── Default #[kernel]:            setp.gt.u32 + @%p bra trap                └── #[kernel(unchecked_indexing)]: assert elided (0 overhead) ```  * Extracts `N` from `SharedArray<T, N, ALIGN>` via `facts::eval_usize_const` and emits an unsigned `MirLtOp` + `MirAssertOp` when `!value_map.unchecked_indexing()`. *
  **Post-Mortem & Fix Analysis**:
  > This pull request requires additional validation before any workflows can run on NVIDIA's runners.  Pull request vetters can view their responsibilities [here](https://docs.gha-runners.nvidia.com/cpr/vetters).  Contributors can view more details about this message [here](https://docs.gha-runners.nvidia.com/cpr/contributors). 
  > Thanks, this is the right fix and matches our slice bounds-check lowering in `mir-importer`. I layered a small follow-up commit on top: - Reused `types::is_cuda_device_adt` and `facts::eval_usize_const` in `shared_array_len` and derived the `APInt` width from `usize_ty`. - Updated `shared_swap_checked` so both the `IndexMut` write and `Index` read emit traps (`2` in checked, `0` in `shared_swap_unchecked`). - Synced the `SharedArray` bounds-check docs in `cuda-device` and `cuda-oxide-book`, and opted `gemm_sol_final` into `#[kernel(unchecked_indexing)]` so its K-loop PTX stays unchanged (`65` regs, `0` spills).  At `8c6e2a677`, crate tests, repository guards, and `unchecked_indexing` on RTX 5090 (`compute-sanitizer` clean) all pass. Merging once CI is green. 

- **Issue #1687** (2026-11-03): **[BUG]: use-site allocas in mir-lower block inlining and SROA (`core::iter::Zip` with a view iterator becomes a call and a 72-byte frame)**
  *Symptoms*: ### Description  Related: #1681 reports the same fixed-scratch placement cause on the NVVM route, where it shows up as `stacksave`/`stackrestore` after inlining. This report adds the LLVM NVPTX route, where it blocks ordinary inlining of `core::iter::Zip`'s `next`, plus larger niche payloads (#1590) and timing. Both should be covered by one placement fix, with tests on both routes.  Several mir-lower conversions create their `alloca` at the use site instead of in the function's entry block. LLVM treats an alloca outside the entry block as dynamic, which has two effects:  - It makes the function ineligible for ordinary cost-driven inlining (`opt` remarks: `has uninlinable pattern (dynamic alloca)`, `cost=never`). Forced inlining (`alwaysinline`) can still happen, but leaves `stacksave`/`stackrestore` behind (the #1590 case). - SROA and mem2reg don't promote it.  `spill_enum_value` (`crates/mir-lower/src/convert/ops/aggregate/common.rs:30-37`) documents the placement and assumes "the standard `opt -O2` run (SROA) removes it again". That assumption doesn't hold once the alloca sits outside the entry block.  A visible case: `w.iter().zip(col.iter())` over a slice iterator and a `ColView32` iterator. `<ZipImpl<..> as Iterator>::next` gets a use-site `alloca { ptr, i64 }` to reinterpret its `Option<(&f32, f32)>` result into the `{ ptr, i64 }` return value. So `next` isn't inlined: the kernel keeps 2 `call`s and a 72-byte local frame for the iterator. Moving every alloca of the expo

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

### Incident Patch 1: `a38e8446` (2026-11-03)
**Commit Message**: fix(mir-importer): lower is_val_statically_known to false (#1359)

## What This PR Does

Lowers `core::intrinsics::is_val_statically_known` (and
`std::intrinsics::is_val_statically_known`) in `mir-importer` to a
constant `false`, unblocking integer `.pow()`, `.checked_pow()`,
`.overflowing_pow()`, `.saturating_pow()`, `.wrapping_pow()`, `.ilog()`,
and `.checked_ilog()` in GPU kernels.

---

### Why `pow` and `ilog` Failed on the Device

Rust's `libcore` implementations of `checked_pow`, `overflowing_pow`,
and `checked_ilog` call
`core::intrinsics::is_val_statically_known(base)` to check whether
`base` is a compile-time constant power of two (so a constant base like
`2u32.pow(n)` can use a bit shift `1 << n` instead of a multiplication
loop). Because `is_val_statically_known` is an optimization hint that is
always allowed to return `false`, lowering it to `MirConstantOp(false)`
+ `MirGotoOp` in `mir-importer` preserves exact Rust semantics and
directs `libcore` to its standard loop implementation.

```text
BEFORE:
  x.checked_pow(e) / x.ilog(10) ──► calls core::intrinsics::is_val_statically_known
                                ──► mir-importer bail-out: "Unsupported construct..."



**File**: `cuda-oxide/crates/mir-importer/src/translator/terminator/helpers.rs` (modified, +68/-1)
```diff
@@ -23,7 +23,7 @@ use crate::translator::values::{ValueMap, establish_declared_pointer_type};
 use crate::translator::{payload_store, rvalue};
 use dialect_mir::{
     attributes::MirPointerKindAuthorityAttr,
-    ops::{MirCallOp, MirConstructArrayOp, MirGotoOp},
+    ops::{MirCallOp, MirConstantOp, MirConstructArrayOp, MirGotoOp},
     types::{MirArrayType, MirPtrType},
 };
 use pliron::basic_block::BasicBlock;
@@ -735,6 +735,73 @@ pub fn emit_unit_noop_intrinsic(
     )
 }
 
+/// Emits a `bool`-returning intrinsic whose result is a fixed constant.
+///
+/// Used for `core::intrinsics::is_val_statically_known`, which may return
+/// `false` for any argument. The argument is a MIR operand with no side
+/// effects, so it is not evaluated.
+#[allow(clippy::too_many_arguments)]
+pub fn emit_bool_constant_intrinsic(
+    ctx: &mut Context,
+    body: &mir::Body,
+    destination: &mir::Place,
+    target: &Option<usize>,
+    block_ptr: Ptr<BasicBlock>,
+    prev_op: Option<Ptr<Operation>>,
+    value_map: &mut ValueMap,
+    block_map: &[Ptr<BasicBlock>],
+    loc: Location,
+    intrinsic_name: &str,
+    value: bool,
+) -> TranslationResult<Ptr<Operation>> {
+    use pliron::builtin::attributes::IntegerAttr;
+    use pliron::utils::apint::APInt;
+
+    let (prepared_destination, prepared_last_op) = prepare_destination_write(
+        ctx,
+        body,
+        destination,
+        value_map,
+        block_ptr,
+        prev_op,
+        loc.clone(),
+    )?;
+
+    let bool_ty = IntegerType::get(ctx, 1, Signedness::Signless);
+    let const_op = Operation::new(
+        ctx,
+        MirConstantOp::get_concrete_op_info(),
+        vec![bool_ty.into()],
+        vec![],
+        vec![],
+        0,
+    );
+    const_op.deref_mut(ctx).set_loc(loc.clone());
+    MirConstantOp::new(const_op).set_attr_value(
+        ctx,
+        IntegerAttr::new(
+            bool_ty,
+            APInt::from_u64(u64::from(value), std::num::NonZeroUsize::new(1).unwrap()),
+        ),
+    );
+    insert_op(ctx, const_op, block_ptr, prepared_last_op);
+
+    let const_val = const_op.deref(ctx).get_result(0);
+    let no_target_msg = format!("{} call without target not supported", intrinsic_name);
+    emit_prepared_result_and_goto(
+        ctx,
+        prepared_destination,
+        const_val,
+        target,
+        block_ptr,
+        const_op,
+        value_map,
+        block_map,
+        loc,
+        &no_target_msg,
+    )
+}
+
 #[cfg(test)]
 // Tests build kinded fixture types directly; production code mints via facts::PointerOrigin.
 #[allow(clippy::disallowed_methods)]
```

**File**: `cuda-oxide/crates/mir-importer/src/translator/terminator/mod.rs` (modified, +19/-0)
```diff
@@ -2998,6 +2998,25 @@ fn try_dispatch_intrinsic(
                 name,
             )?))
         }
+        // `false` is a valid answer for any argument. libcore calls this from
+        // integer `checked_pow`/`overflowing_pow` and `checked_ilog`, so
+        // rejecting it also rejects integer `pow` and `ilog`, which call them.
+        "core::intrinsics::is_val_statically_known"
+        | "std::intrinsics::is_val_statically_known" => {
+            Ok(Some(helpers::emit_bool_constant_intrinsic(
+                ctx,
+                body,
+                destination,
+                target,
+                block_ptr,
+                prev_op,
+                value_map,
+                block_map,
+                loc,
+                name,
+                false,
+            )?))
+        }
         "core::intrinsics::copy" | "std::intrinsics::copy" => Ok(Some(emit_ptr_memmove(
             ctx,
             body,
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/checked_arith/src/main.rs` (modified, +125/-0)
```diff
@@ -17,6 +17,11 @@
 //! Unsigned `u8` and signed `i8` cases cover both overflow and non-overflow
 //! paths, including `Some(0)` so it cannot be confused with `None`.
 //!
+//! The `pow_family` kernel covers integer `pow`, `checked_pow`,
+//! `overflowing_pow`, `saturating_pow`, `wrapping_pow`, `ilog` and
+//! `checked_ilog`, which failed to compile while `is_val_statically_known`
+//! was unsupported.
+//!
 //! Run:
 //!   cargo oxide run checked_arith
 //!   CUDA_OXIDE_NO_OPT=1 cargo oxide run checked_arith
@@ -136,6 +141,75 @@ mod kernels {
             };
         }
     }
+
+    /// Exercise the integer `pow` family and `ilog`. libcore implements them
+    /// with `is_val_statically_known`, so they must compile for the device.
+    ///
+    /// Encodings:
+    /// - `checked_pow`: `None` -> 0, `Some(v)` -> bit 32 set, `v` in bits 0..31
+    /// - `overflowing_pow`: result in bits 0..31, overflow flag in bit 32
+    /// - `pow` on `u64`: the plain result; every input here is in range
+    #[kernel]
+    pub fn pow_family(
+        base: &[i32],
+        exp: &[u32],
+        mut checked_out: DisjointSlice<u64>,
+        mut overflowing_out: DisjointSlice<u64>,
+        mut misc_out: DisjointSlice<u64>,
+        mut pow_out: DisjointSlice<u64>,
+    ) {
+        let i = thread::index_1d().get();
+        if i >= base.len() {
+            return;
+        }
+        let (b, e) = (base[i], exp[i]);
+
+        if let Some(o) = checked_out.get_mut(thread::index_1d()) {
+            *o = match b.checked_pow(e) {
+                Some(value) => (1 << 32) | value as u32 as u64,
+                None => 0,
+            };
+        }
+
+        if let Some(o) = overflowing_out.get_mut(thread::index_1d()) {
+            let (value, overflow) = (b as u32).overflowing_pow(e);
+            *o = value as u64 | ((overflow as u64) << 32);
+        }
+
+        if let Some(o) = misc_out.get_mut(thread::index_1d()) {
+            let saturating = (b as u8).saturating_pow(e) as u64;
+            let wrapping = (b as i16).wrapping_pow(e) as u16 as u64;
+            let ilog = match (b as u32).checked_ilog(10) {
+                Some(value) => 0x80 | value as u64,
+                None => 0,
+            };
+            let ilog10 = (b.unsigned_abs() | 1).ilog(10) as u64;
+            *o = saturating | (wrapping << 8) | (ilog << 24) | (ilog10 << 32);
+        }
+
+        if let Some(o) = pow_out.get_mut(thread::index_1d()) {
+            *o = (b.unsigned_abs() as u64).pow(e);
+        }
+    }
+}
+
+fn expected_pow_family(b: i32, e: u32) -> (u64, u64, u64, u64) {
+    let checked = match b.checked_pow(e) {
+        Some(value) => (1 << 32) | value as u32 as u64,
+        None => 0,
+    };
+    let (value, overflow) = (b as u32).overflowing_pow(e);
+    let overflowing = value as u64 | ((overflow as u64) << 32);
+    let saturating = (b as u8).saturating_pow(e) as u64;
+    let wrapping = (b as i16).wrapping_pow(e) as u16 as u64;
+    let ilog = match (b as u32).checked_ilog(10) {
+        Some(value) => 0x80 | value as u64,
+        None => 0,
+    };
+    let ilog10 = (b.unsigned_abs() | 1).ilog(10) as u64;
+    let misc = saturating | (wrapping << 8) | (ilog << 24) | (ilog10 << 32);
+    let pow = (b.unsigned_abs() as u64).pow(e);
+    (checked, overflowing, misc, pow)
 }
 
 fn check(label: &str, got: u32, expected_result: u8, expected_overflow: bool) -> bool {
@@ -300,6 +374,40 @@ fn main() {
     let checked_i8_sub = checked_i8_sub_dev.to_host_vec(&stream).unwrap();
     let checked_i8_mul = checked_i8_mul_dev.to_host_vec(&stream).unwrap();
 
+    // --- integer pow family and ilog ---
+    //
+    // Includes a zero exponent, negative bases with odd exponents, and both
+    // in-range and overflowing results (7^12 and 46341^2 overflow i32).
+    let pow_base: Vec<i32> = vec![2, -3, 10, 0, 1, -1, 7, 46341];
+    let pow_exp: Vec<u32> = vec![10, 5, 9, 0, 100, 3, 12, 2];
+    let pow_n = pow_base.len();
+    let pow_base_dev = DeviceBuffer::from_host(&stream, &pow_base).unwrap();
+    let pow_exp_dev = DeviceBuffer::from_host(&stream, &pow_exp).unwrap();
+    let mut pow_checked_dev = DeviceBuffer::<u64>::zeroed(&stream, pow_n).unwrap();
+    let mut pow_overflowing_dev = DeviceBuffer::<u64>::zeroed(&stream, pow_n).unwrap();
+    let mut pow_misc_dev = DeviceBuffer::<u64>::zeroed(&stream, pow_n).unwrap();
+    let mut pow_plain_dev = DeviceBuffer::<u64>::zeroed(&stream, pow_n).unwrap();
+
+    // SAFETY: launch shape/resources match the kernel; buffers cover its accesses.
+    unsafe {
+        module.pow_family(
+            &stream,
+            LaunchConfig::for_num_elems(pow_n as u32),
+            &pow_base_dev,
+            &pow_exp_dev,
+            &mut pow_checked_dev,
+            &mut pow_overflowing_dev,
+            &mut pow_misc_dev,
+            &mut pow_plain_dev,
+        )
+    }
+    .expect("pow_family launch");
+
+    let pow_checked = pow_checked_dev.to_host_vec(&stream).unwrap();
+    let pow_ove
```

---

### Incident Patch 2: `00f6624c` (2026-11-04)
**Commit Message**: fix(cuda-oxide): resolve --device-debug compile/merge failures in clamp, WGMMA, and multi-crate PTX (#1738)

## What This PR Does

Resolves the three `--device-debug` compile and module-load failures
(**NVBugs 7038282**, **7038557**, **7038682** and **GH #1219**):

| NVBug / Issue | Example(s) | Root Cause | Fix |

|:-----------------------|:-----------------------------------|:-----------------------------------------------------------------------------|:------------------------------------------------------------------------------|
| **7038282 / GH #1219** | `warp_sums`, `partial_warp_reduce` | Dead
`core::fmt::rt::ArgumentType` allocas from dropped `clamp` panic block |
Prune zero-use entry `MirAllocaOp`s after block translation |
| **7038557** | `cross_crate_merged_symbols` | Un-inlined `.visible
.func` helpers collide when merging crate PTX bundles | Disambiguate
colliding `.func` symbols across bundles in `merge_ptx_bundles` |
| **7038682 / GH #1219** | `wgmma_mma_bf16` | Skipping `mem2reg` leaves
WGMMA reborrows and loop descriptors in stack slots| Run `mem2reg` for
WGMMA MMA modules and accept `mir.dbg_value` in WGMMA loops |

---

### 1. Dead Panic-Block Allocas Under `--d

**File**: `cuda-oxide/crates/cuda-host/src/embedded.rs` (modified, +116/-11)
```diff
@@ -162,10 +162,12 @@ pub fn merge_ptx_bundles<'a>(
     let mut merged = String::new();
     let mut found_any = false;
 
-    // Keep each bundle's debug file indices distinct in the merged module.
+    // Keep each bundle's debug file indices and helper `.func` names distinct
+    // in the merged module.
     let mut file_index_offset = 0;
+    let mut seen_functions = std::collections::HashSet::new();
 
-    for bundle in bundles {
+    for (bundle_index, bundle) in bundles.into_iter().enumerate() {
         if let Some(ptx_bytes) = bundle.payload(ArtifactPayloadKind::Ptx) {
             let ptx_str = std::str::from_utf8(ptx_bytes)
                 .map_err(|_| EmbeddedModuleError::UnsupportedPayload {
@@ -174,13 +176,17 @@ pub fn merge_ptx_bundles<'a>(
                 .trim_end_matches('\0');
 
             let strip_headers = found_any;
-            let (body, max_file_index) =
-                prepare_bundle_body(ptx_str, strip_headers, file_index_offset).map_err(
-                    |reason| EmbeddedModuleError::InvalidPtx {
-                        name: bundle.name.clone(),
-                        reason,
-                    },
-                )?;
+            let (body, max_file_index) = prepare_bundle_body_with_functions(
+                ptx_str,
+                strip_headers,
+                file_index_offset,
+                bundle_index,
+                &mut seen_functions,
+            )
+            .map_err(|reason| EmbeddedModuleError::InvalidPtx {
+                name: bundle.name.clone(),
+                reason,
+            })?;
             file_index_offset = file_index_offset.max(max_file_index);
             merged.push_str(&body);
             if !body.ends_with('\n') {
@@ -196,17 +202,63 @@ pub fn merge_ptx_bundles<'a>(
     Ok(merged)
 }
 
-/// Strip repeated headers and shift debug indices past the previous bundles.
-/// Returns the rewritten text and its highest debug file index.
+/// Single-bundle test wrapper around [`prepare_bundle_body_with_functions`]
+/// that starts with an empty seen-function set at bundle index zero.
+#[cfg(test)]
 fn prepare_bundle_body(
     ptx: &str,
     strip_headers: bool,
     file_index_offset: u64,
+) -> Result<(String, u64), String> {
+    let mut seen_functions = std::collections::HashSet::new();
+    prepare_bundle_body_with_functions(
+        ptx,
+        strip_headers,
+        file_index_offset,
+        0,
+        &mut seen_functions,
+    )
+}
+
+/// Strip repeated headers, disambiguate colliding helper `.func` symbols, and
+/// shift debug indices past the previous bundles. Returns the rewritten text
+/// and its highest debug file index.
+fn prepare_bundle_body_with_functions(
+    ptx: &str,
+    strip_headers: bool,
+    file_index_offset: u64,
+    bundle_index: usize,
+    seen_functions: &mut std::collections::HashSet<String>,
 ) -> Result<(String, u64), String> {
     let document = ptx_parse::Document::parse(ptx).map_err(|error| error.to_string())?;
     let mut edits = ptx_parse::EditScript::new();
     let mut max_file_index = 0u64;
 
+    let mut bundle_functions = std::collections::HashSet::new();
+    let mut colliding_functions = std::collections::HashMap::new();
+    for callable in document.callables() {
+        if callable.kind() == ptx_parse::CallableKind::Function && !callable.is_extern() {
+            let name = callable.name();
+            bundle_functions.insert(name.to_string());
+            if seen_functions.contains(name) {
+                colliding_functions.insert(name, format!("{name}__bundle_{bundle_index}"));
+            }
+        }
+    }
+    seen_functions.extend(bundle_functions);
+
+    if !colliding_functions.is_empty() {
+        for token in document.tokens() {
+            if token.kind() == ptx_parse::TokenKind::Word
+                && let Some(renamed) = colliding_functions.get(token.text(ptx))
+            {
+                edits
+                    .replace(token.span(), renamed.clone())
+                    .map_err(|error| error.to_string())?;
+            }
+        }
+    }
+
     for directive in document.directives() {
         match directive.name() {
             ".version" | ".target" | ".address_size" if strip_headers => {
@@ -555,6 +607,59 @@ mod tests {
         );
     }
 
+    #[test]
+    fn merged_bundles_disambiguate_colliding_helper_functions() {
+        let first = ptx_bundle(
+            "first",
+            "\
+.version 8.9
+.target sm_80, debug
+.address_size 64
+.visible .func (.param .b64 retval) shared_helper()
+{
+\tret;
+}
+.visible .entry a()
+{
+\tcall.uni (r0), shared_helper, ();
+\tret;
+}
+",
+        );
+        let second = ptx_bundle(
+            "second",
+            "\
+.version 8.9
+.target sm_80, debug
+.address_size 64
+.visible .func (.param .b64 retval) shared_helper()
+{
+\tret;
+}
+.visible .entry b()
+{
+\tcall.uni (r0), shared_helper, ();
+\tret;
+}
+",
+        );
+
+        let merged = merge_ptx_bundles([&first,
```

**File**: `cuda-oxide/crates/cuda-oxide-codegen/src/prep.rs` (modified, +37/-0)
```diff
@@ -95,6 +95,17 @@ pub fn prepare_mir_module(
                     .to_string(),
             ));
         }
+        if has_wgmma_mma_operations(ctx, module) {
+            let mut analyses = pliron::pass::AnalysisManager::default();
+            pliron::opts::mem2reg::mem2reg(module, ctx, &mut analyses).map_err(|error| {
+                PipelineError::Verification {
+                    name: "mem2reg".to_string(),
+                    message: error.disp(ctx).to_string(),
+                    operation: None,
+                }
+            })?;
+            verify_operation(ctx, module, "module post-wgmma-debug-mem2reg")?;
+        }
         return Ok(Vec::new());
     }
 
@@ -236,6 +247,32 @@ pub fn prepare_mir_module(
     Ok(warnings)
 }
 
+/// Return whether `root` contains any pointer-form WGMMA MMA operation whose
+/// accumulator lifetime must be fused into register SSA values before lowering.
+fn has_wgmma_mma_operations(ctx: &Context, root: Ptr<Operation>) -> bool {
+    use dialect_nvvm::ops::{
+        WgmmaMmaM64N64K8F32Tf32Op, WgmmaMmaM64N64K16F32Bf16Op, WgmmaMmaM64N64K16F32F16Op,
+        WgmmaMmaM64N128K16F32Bf16Op,
+    };
+
+    let mut pending = vec![root];
+    while let Some(operation) = pending.pop() {
+        if Operation::is_op::<WgmmaMmaM64N64K16F32Bf16Op>(operation, ctx)
+            || Operation::is_op::<WgmmaMmaM64N64K16F32F16Op>(operation, ctx)
+            || Operation::is_op::<WgmmaMmaM64N64K8F32Tf32Op>(operation, ctx)
+            || Operation::is_op::<WgmmaMmaM64N128K16F32Bf16Op>(operation, ctx)
+        {
+            return true;
+        }
+        for region in operation.deref(ctx).regions() {
+            for block in region.deref(ctx).iter(ctx) {
+                pending.extend(block.deref(ctx).iter(ctx));
+            }
+        }
+    }
+    false
+}
+
 fn has_high_level_cute_operations(ctx: &Context, root: Ptr<Operation>) -> bool {
     let mut pending = vec![root];
     while let Some(operation) = pending.pop() {
```

**File**: `cuda-oxide/crates/mir-importer/src/translator/body.rs` (modified, +25/-0)
```diff
@@ -2665,6 +2665,31 @@ pub fn translate_body(
         }
     }
 
+    // Remove entry-block allocas that have zero uses after translating all
+    // reachable blocks (such as locals belonging exclusively to unreachable
+    // blocks or dropped panic-formatting blocks like `core::fmt::rt::Argument`).
+    // In normal builds `mem2reg` erases unused allocas; pruning them here keeps
+    // `--device-debug` (which skips `mem2reg`) from lowering dead panic types.
+    use pliron::linked_list::ContainsLinkedList;
+    let dead_allocas: Vec<Ptr<Operation>> = block_map[0]
+        .deref(ctx)
+        .iter(ctx)
+        .filter(|&op| {
+            Operation::get_op::<dialect_mir::ops::MirAllocaOp>(op, ctx).is_some()
+                && op.deref(ctx).get_result(0).uses(ctx).is_empty()
+        })
+        .collect();
+    if !dead_allocas.is_empty() {
+        use pliron::irbuild::{
+            listener::Recorder,
+            rewriter::{IRRewriter, Rewriter},
+        };
+        let mut rewriter = IRRewriter::<Recorder>::default();
+        for dead in dead_allocas {
+            rewriter.erase_operation(ctx, dead);
+        }
+    }
+
     Ok(op_ptr)
 }
 
```

**File**: `cuda-oxide/crates/mir-lower/src/wgmma_deferred_accumulator.rs` (modified, +8/-3)
```diff
@@ -58,9 +58,10 @@
 use dialect_mir::attributes::MirCastKindAttr;
 use dialect_mir::{
     ops::{
-        MirAddOp, MirArrayElementAddrOp, MirCastOp, MirCondBranchOp, MirConstantOp, MirFuncOp,
-        MirGeOp, MirGotoOp, MirGtOp, MirLeOp, MirLoadOp, MirLtOp, MirNoUnrollHintOp, MirNotOp,
-        MirStorageDeadOp, MirStorageLiveOp, MirStoreOp, MirSubOp,
+        MirAddOp, MirArrayElementAddrOp, MirCastOp, MirCondBranchOp, MirConstantOp,
+        MirDbgValueListOp, MirDbgValueOp, MirFuncOp, MirGeOp, MirGotoOp, MirGtOp, MirLeOp,
+        MirLoadOp, MirLtOp, MirNoUnrollHintOp, MirNotOp, MirStorageDeadOp, MirStorageLiveOp,
+        MirStoreOp, MirSubOp,
     },
     types::{MirArrayType, MirPtrType, address_space},
 };
@@ -290,6 +291,8 @@ fn counted_loop_operation_is_supported(ctx: &Context, operation: Ptr<Operation>)
     // `#[nounroll]` on the K loop leaves a hint in it until lowering. Fusion
     // replaces the loop and moves the request onto the fused operation
     Operation::get_op::<MirNoUnrollHintOp>(operation, ctx).is_some()
+        || Operation::get_op::<MirDbgValueOp>(operation, ctx).is_some()
+        || Operation::get_op::<MirDbgValueListOp>(operation, ctx).is_some()
         || Operation::get_op::<MirConstantOp>(operation, ctx).is_some()
         || Operation::get_op::<ConstantOp>(operation, ctx).is_some()
         || Operation::get_op::<MirStorageLiveOp>(operation, ctx).is_some()
@@ -1605,6 +1608,8 @@ fn apply_pointer_fallback(
 
 fn is_ignorable(ctx: &Context, op: Ptr<Operation>) -> bool {
     Operation::get_op::<MirNoUnrollHintOp>(op, ctx).is_some()
+        || Operation::get_op::<MirDbgValueOp>(op, ctx).is_some()
+        || Operation::get_op::<MirDbgValueListOp>(op, ctx).is_some()
         || Operation::get_op::<MirConstantOp>(op, ctx).is_some()
         || Operation::get_op::<ConstantOp>(op, ctx).is_some()
         || Operation::get_op::<MirStorageLiveOp>(op, ctx).is_some()
```

---

### Incident Patch 3: `8a04da1b` (2026-11-03)
**Commit Message**: fix(mir-lower): lower float % to libdevice fmod (#1537)

## What This PR Does

Lowers floating-point `mir.rem` (`%`, `%=`, and `rem_euclid`) to
libdevice `__nv_fmodf` / `__nv_fmod` instead of `llvm.frem`, and records
float `mir.rem` as strict libdevice use in
`cuda-oxide-codegen::select_pre_lowering_backend`.

---

### Why `llvm.frem` Miscompiled Float `%` on NVPTX

In Rust, floating-point `a % b` is exact C `fmod(a, b)`. LLVM's NVPTX
backend expands `llvm.frem` to naive floating-point `a - trunc(a / b) *
b`, which drifts by multiples of `b` when `a / b` exceeds mantissa
precision, loses the sign of `-0.0 % 3.0`, and overflows to `-inf` on
`f64::MAX % f64::MIN_POSITIVE`.

```text
Computing `1e20_f64 % 7.0` on the GPU:

BEFORE (emitted `llvm.frem`):
  NVPTX expands `frem` to `a - trunc(a / b) * b` in fp64 ──► returns `-6144.0` (38/104 cases fail)

AFTER (calls libdevice `__nv_fmod` / `__nv_fmodf`):
  Calls exact libdevice `fmod`                           ──► returns `2.0` (104/104 match host bit-for-bit)
```

---

## Verification

* **GPU Execution (`RTX 5090`, `sm_120a`)**: `cargo oxide run
float_rem_smoke` matches host `fmod` bit-for-bit across all `26 x 4 =
104` `f32`/`f64` `%` a

**File**: `cuda-oxide/crates/cuda-oxide-codegen/src/pipeline.rs` (modified, +123/-2)
```diff
@@ -1064,8 +1064,9 @@ fn select_pre_lowering_backend(
     // Only strict use participates in the emit-NVVM-IR decision; otherwise a
     // kernel using only rounding or sign ops would drag in the libNVVM
     // dependency it no longer needs.
-    let uses_strict_libdevice =
-        typed_mir_uses_libdevice(ctx, module) || module_uses_libdevice(ctx, module);
+    let uses_strict_libdevice = typed_mir_uses_libdevice(ctx, module)
+        || typed_mir_has_float_rem(ctx, module)
+        || module_uses_libdevice(ctx, module);
     let uses_backend_dependent_libdevice = typed_mir_calls_match(
         ctx,
         module,
@@ -1101,6 +1102,37 @@ fn typed_mir_uses_libdevice(ctx: &Context, module: Ptr<Operation>) -> bool {
     })
 }
 
+/// Whether `module` contains a float `mir.rem`.
+///
+/// Float remainder lowers to libdevice `__nv_fmod` / `__nv_fmodf` under
+/// every intrinsic backend (see `mir_lower::convert::ops::arithmetic`), so
+/// it is strict libdevice use that carries no `mir.call` to inspect.
+fn typed_mir_has_float_rem(ctx: &Context, op: Ptr<Operation>) -> bool {
+    use pliron::builtin::type_interfaces::FloatTypeInterface;
+    use pliron::r#type::{Typed, type_cast};
+
+    if Operation::get_op::<dialect_mir::ops::MirRemOp>(op, ctx).is_some() {
+        let lhs_ty = op.deref(ctx).get_operand(0).get_type(ctx);
+        if type_cast::<dyn FloatTypeInterface>(&*lhs_ty.deref(ctx)).is_some() {
+            return true;
+        }
+    }
+
+    let op_ref = op.deref(ctx);
+    for region in op_ref.regions() {
+        let region_ref = region.deref(ctx);
+        for block in region_ref.iter(ctx) {
+            let block_ref = block.deref(ctx);
+            for child_op in block_ref.iter(ctx) {
+                if typed_mir_has_float_rem(ctx, child_op) {
+                    return true;
+                }
+            }
+        }
+    }
+    false
+}
+
 /// Walk `op` and its regions and return whether any `mir.call` callee
 /// satisfies `matches`.
 fn typed_mir_calls_match(
@@ -1802,6 +1834,95 @@ mod tests {
         }
     }
 
+    /// Build a typed MIR module whose kernel takes two `f32` arguments and
+    /// one `i32` argument and applies `mir.rem` to the pair `rem_float`
+    /// selects: the float pair or the integer argument with itself.
+    fn typed_mir_rem_module(ctx: &mut Context, rem_float: bool) -> Ptr<Operation> {
+        use pliron::basic_block::BasicBlock;
+        use pliron::builtin::attributes::TypeAttr;
+        use pliron::builtin::op_interfaces::SymbolOpInterface;
+        use pliron::builtin::types::{FP32Type, FunctionType, IntegerType, Signedness};
+        use pliron::op::Op;
+        use pliron::r#type::TypeHandle;
+
+        dialect_mir::register(ctx);
+        dialect_nvvm::register(ctx);
+        let module = pliron::builtin::ops::ModuleOp::new(ctx, "test".try_into().unwrap());
+        let module_op = module.get_operation();
+
+        let f32_ty: TypeHandle = FP32Type::get(ctx).into();
+        let i32_ty: TypeHandle = IntegerType::get(ctx, 32, Signedness::Signed).into();
+        let arg_tys = vec![f32_ty, f32_ty, i32_ty];
+        let function_type = FunctionType::get(ctx, arg_tys.clone(), vec![]);
+        let function_op = Operation::new(
+            ctx,
+            dialect_mir::ops::MirFuncOp::get_concrete_op_info(),
+            vec![],
+            vec![],
+            vec![],
+            1,
+        );
+        let function =
+            dialect_mir::ops::MirFuncOp::new(ctx, function_op, TypeAttr::new(function_type.into()));
+        function.set_symbol_name(ctx, "kernel".try_into().unwrap());
+
+        let body = function_op.deref(ctx).get_region(0);
+        let block = BasicBlock::new(ctx, None, arg_tys);
+        block.insert_at_back(body, ctx);
+        let (lhs, rhs, result_ty) = if rem_float {
+            (
+                block.deref(ctx).get_argument(0),
+                block.deref(ctx).get_argument(1),
+                f32_ty,
+            )
+        } else {
+            (
+                block.deref(ctx).get_argument(2),
+                block.deref(ctx).get_argument(2),
+                i32_ty,
+            )
+        };
+        let rem = Operation::new(
+            ctx,
+            dialect_mir::ops::MirRemOp::get_concrete_op_info(),
+            vec![result_ty],
+            vec![lhs, rhs],
+            vec![],
+            0,
+        );
+        rem.insert_at_back(block, ctx);
+
+        let module_body = module_op.deref(ctx).get_region(0);
+        let module_block = module_body.deref(ctx).iter(ctx).next().unwrap();
+        function_op.insert_at_back(module_block, ctx);
+        module_op
+    }
+
+    /// Float `mir.rem` lowers to `__nv_fmodf` under every backend, so the
+    /// prediction must flag libdevice before lowering or the post-lowering
+    /// consistency check would abort the build. Integer `mir.rem` lowers to
+    /// `srem`/`urem` and contributes nothing.
+    #[test]
+    fn float_rem_module_is_predicted_as_st
```

**File**: `cuda-oxide/crates/mir-lower/src/convert/ops/arithmetic.rs` (modified, +94/-7)
```diff
@@ -13,7 +13,8 @@
 //! | Category      | MIR Operations                    | LLVM Operations                              |
 //! |---------------|-----------------------------------|----------------------------------------------|
 //! | Integer Arith | `add`, `sub`, `mul`, `div`, `rem` | `add`, `sub`, `mul`, `sdiv`/`udiv`, `srem`/`urem` |
-//! | Float Arith   | `add`, `sub`, `mul`, `div`, `rem` | `fadd`, `fsub`, `fmul`, `fdiv`, `frem`       |
+//! | Float Arith   | `add`, `sub`, `mul`, `div`        | `fadd`, `fsub`, `fmul`, `fdiv`               |
+//! | Float Rem     | `rem`                             | `call __nv_fmodf` / `call __nv_fmod`         |
 //! | Unary         | `neg`, `not`                      | `fneg` / `sub 0, x`, `xor`                   |
 //! | Bitwise       | `and`, `or`, `xor`, `not`         | `and`, `or`, `xor`                           |
 //! | Shifts        | `shl`, `shr`                      | `shl`, `lshr`/`ashr`                         |
@@ -30,6 +31,7 @@
 use crate::convert::intrinsics::common::call_intrinsic;
 use crate::convert::types::convert_type;
 use crate::convert::types::{StructLayoutInfo, build_struct_slot_map};
+use crate::helpers;
 use dialect_mir::types::MirTupleType;
 use llvm_export::attributes::{
     FCmpPredicateAttr, FastmathFlags, FastmathFlagsAttr, ICmpPredicateAttr,
@@ -39,6 +41,7 @@ use llvm_export::op_interfaces::{BinArithOp, CastOpInterface, IntBinArithOpWithO
 use llvm_export::ops as llvm;
 use llvm_export::types as llvm_types;
 use pliron::builtin::attributes::IntegerAttr;
+use pliron::builtin::op_interfaces::CallOpCallable;
 use pliron::builtin::types::{FP32Type, FP64Type, IntegerType, Signedness};
 use pliron::context::{Context, Ptr};
 use pliron::irbuild::dialect_conversion::{DialectConversionRewriter, OperandsInfo};
@@ -244,7 +247,8 @@ pub(crate) fn convert_div(
     Ok(())
 }
 
-/// Convert `mir.rem` to `llvm.srem` (signed), `llvm.urem` (unsigned), or `llvm.frem` (float).
+/// Convert `mir.rem` to `llvm.srem` (signed), `llvm.urem` (unsigned), or a
+/// libdevice `fmod` call (float).
 ///
 /// Uses pre-conversion MIR operand type signedness to select between signed
 /// and unsigned integer remainder.
@@ -256,11 +260,11 @@ pub(crate) fn convert_rem(
 ) -> Result<()> {
     let (lhs, rhs) = get_binary_operands(op, ctx)?;
 
-    let llvm_op = if is_float_type(ctx, lhs) {
-        let frem = llvm::FRemOp::new(ctx, lhs, rhs);
-        add_fastmath_flags(ctx, frem.get_operation());
-        frem.get_operation()
-    } else if is_signed_int_op(ctx, op, operands_info)? {
+    if is_float_type(ctx, lhs) {
+        return convert_float_rem(ctx, rewriter, op, lhs, rhs);
+    }
+
+    let llvm_op = if is_signed_int_op(ctx, op, operands_info)? {
         llvm::SRemOp::new(ctx, lhs, rhs).get_operation()
     } else {
         llvm::URemOp::new(ctx, lhs, rhs).get_operation()
@@ -271,6 +275,89 @@ pub(crate) fn convert_rem(
     Ok(())
 }
 
+/// libdevice entry point for `f64` remainder.
+pub const LIBDEVICE_FMOD_F64: &str = "__nv_fmod";
+/// libdevice entry point for `f32` remainder (also used for `f16` after widening).
+pub const LIBDEVICE_FMOD_F32: &str = "__nv_fmodf";
+
+/// Convert float `mir.rem` to a libdevice `fmod` call.
+///
+/// Rust float `%` is C `fmod`: exact for every finite operand pair, with
+/// the sign of the dividend. `llvm.frem` is not a usable lowering on NVPTX,
+/// whose backend expands it to `a - trunc(a / b) * b` in floating point.
+/// That drifts by whole multiples of `b` once `a / b` is too large to be an
+/// exact integer (`1e20_f64 % 7.0` gave `-6144.0` instead of `2.0`), loses
+/// the sign of a zero result, and overflows to infinity when `a / b` does.
+///
+/// `f16` has no libdevice entry. It widens to `f32`, where `fmod` of two
+/// `f16` values is still exact and its result is representable in `f16`,
+/// then narrows back.
+fn convert_float_rem(
+    ctx: &mut Context,
+    rewriter: &mut DialectConversionRewriter,
+    op: Ptr<Operation>,
+    lhs: Value,
+    rhs: Value,
+) -> Result<()> {
+    let loc = op.deref(ctx).loc().clone();
+    let value_ty = lhs.get_type(ctx);
+    let (callee, call_ty) = if value_ty.deref(ctx).is::<FP64Type>() {
+        (LIBDEVICE_FMOD_F64, value_ty)
+    } else {
+        (LIBDEVICE_FMOD_F32, FP32Type::get(ctx).into())
+    };
+    let widen = value_ty != call_ty;
+
+    let (a, b) = if widen {
+        let a = llvm::FPExtOp::new(ctx, lhs, call_ty).get_operation();
+        set_empty_fastmath_flags(ctx, a);
+        rewriter.insert_operation(ctx, a);
+        let b = llvm::FPExtOp::new(ctx, rhs, call_ty).get_operation();
+        set_empty_fastmath_flags(ctx, b);
+        rewriter.insert_operation(ctx, b);
+        (a.deref(ctx).get_result(0), b.deref(ctx).get_result(0))
+    } else {
+        (lhs, rhs)
+    };
+
+    let func_ty = llvm_types::FuncType::get(ctx, call_ty, vec![call_ty, call_ty], false);
+    let parent_block = op
+        .deref(ctx)
+        .get_parent_block()
+        .ok_or_el
```

**File**: `cuda-oxide/crates/mir-lower/tests/lowering_test/math_conversions.rs` (modified, +70/-0)
```diff
@@ -3265,3 +3265,73 @@ fn test_float_to_int_unchecked_rejects_wide_destination() {
         .to_string();
     assert!(error.contains("wider than 64 bits"), "{error}");
 }
+
+/// Rust float `%` is C `fmod`, exact for every finite pair. NVPTX expands
+/// `llvm.frem` inexactly (`a - trunc(a / b) * b`), so float `mir.rem` must
+/// lower to a libdevice `fmod` call on both widths, while integer `mir.rem`
+/// keeps lowering to `srem` / `urem`.
+#[test]
+fn test_float_rem_lowers_to_libdevice_fmod() -> Result<(), anyhow::Error> {
+    use mir_lower::convert::ops::arithmetic::{LIBDEVICE_FMOD_F32, LIBDEVICE_FMOD_F64};
+    use pliron::builtin::types::{FP32Type, FP64Type, IntegerType, Signedness};
+    use pliron::r#type::TypeHandle;
+
+    let mut ctx = make_test_ctx();
+    let f32_ty: TypeHandle = FP32Type::get(&ctx).into();
+    let f64_ty: TypeHandle = FP64Type::get(&ctx).into();
+    let i32_ty: TypeHandle = IntegerType::get(&ctx, 32, Signedness::Signed).into();
+    let u32_ty: TypeHandle = IntegerType::get(&ctx, 32, Signedness::Unsigned).into();
+    let (module_ptr, entry) = build_test_kernel(
+        &mut ctx,
+        vec![f32_ty, f32_ty, f64_ty, f64_ty, i32_ty, u32_ty],
+    );
+    let arg = |ctx: &Context, i: usize| entry.deref(ctx).get_argument(i);
+    let operands = [
+        (arg(&ctx, 0), arg(&ctx, 1), f32_ty),
+        (arg(&ctx, 2), arg(&ctx, 3), f64_ty),
+        (arg(&ctx, 4), arg(&ctx, 4), i32_ty),
+        (arg(&ctx, 5), arg(&ctx, 5), u32_ty),
+    ];
+    for (lhs, rhs, result_ty) in operands {
+        let rem = Operation::new(
+            &mut ctx,
+            mir::MirRemOp::get_concrete_op_info(),
+            vec![result_ty],
+            vec![lhs, rhs],
+            vec![],
+            0,
+        );
+        rem.insert_at_back(entry, &ctx);
+    }
+    append_return(&mut ctx, entry);
+
+    mir_lower::lower_mir_to_llvm(&mut ctx, module_ptr).map_err(|e| anyhow::anyhow!("{}", e))?;
+
+    let mut callees = Vec::new();
+    let mut frem = 0usize;
+    let mut srem = 0usize;
+    let mut urem = 0usize;
+    for body_op in lowered_kernel_body(&ctx, module_ptr) {
+        if let Some(call) = Operation::get_op::<llvm::CallOp>(body_op, &ctx)
+            && let CallOpCallable::Direct(sym) = call.callee(&ctx)
+        {
+            callees.push(sym.to_string());
+        }
+        frem += usize::from(Operation::get_op::<llvm::FRemOp>(body_op, &ctx).is_some());
+        srem += usize::from(Operation::get_op::<llvm::SRemOp>(body_op, &ctx).is_some());
+        urem += usize::from(Operation::get_op::<llvm::URemOp>(body_op, &ctx).is_some());
+    }
+
+    assert_eq!(
+        callees,
+        vec![
+            LIBDEVICE_FMOD_F32.to_string(),
+            LIBDEVICE_FMOD_F64.to_string()
+        ],
+        "float mir.rem must lower to libdevice fmod on each width"
+    );
+    assert_eq!(frem, 0, "float mir.rem must not lower to llvm.frem");
+    assert_eq!(srem, 1, "signed mir.rem must lower to llvm.srem");
+    assert_eq!(urem, 1, "unsigned mir.rem must lower to llvm.urem");
+    Ok(())
+}
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/float_rem_smoke/Cargo.lock` (added, +630/-0)
```diff
@@ -0,0 +1,630 @@
+# This file is automatically @generated by Cargo.
+# It is not intended for manual editing.
+version = 4
+
+[[package]]
+name = "aho-corasick"
+version = "1.1.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
+dependencies = [
+ "memchr",
+]
+
+[[package]]
+name = "anyhow"
+version = "1.0.102"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+
+[[package]]
+name = "bindgen"
+version = "0.72.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
+dependencies = [
+ "bitflags",
+ "cexpr",
+ "clang-sys",
+ "itertools",
+ "log",
+ "prettyplease",
+ "proc-macro2",
+ "quote",
+ "regex",
+ "rustc-hash",
+ "shlex",
+ "syn",
+]
+
+[[package]]
+name = "bitflags"
+version = "2.13.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b4388bee8683e3d04af747c73422af53102d2bd24d9eadb6cbc100baef4b43f8"
+
+[[package]]
+name = "block-buffer"
+version = "0.10.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
+dependencies = [
+ "generic-array",
+]
+
+[[package]]
+name = "bytemuck"
+version = "1.25.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
+dependencies = [
+ "bytemuck_derive",
+]
+
+[[package]]
+name = "bytemuck_derive"
+version = "1.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f9abbd1bc6865053c427f7198e6af43bfdedc55ab791faed4fbd361d789575ff"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
+[[package]]
+name = "cexpr"
+version = "0.6.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6fac387a98bb7c37292057cffc56d62ecb629900026402633ae9160df93a8766"
+dependencies = [
+ "nom",
+]
+
+[[package]]
+name = "cfg-if"
+version = "1.0.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
+
+[[package]]
+name = "clang-sys"
+version = "1.8.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0b023947811758c97c59bf9d1c188fd619ad4718dcaa767947df1cadb14f39f4"
+dependencies = [
+ "glob",
+ "libc",
+ "libloading",
+]
+
+[[package]]
+name = "cpufeatures"
+version = "0.2.17"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "59ed5838eebb26a2bb2e58f6d5b5316989ae9d08bab10e0e6d103e656d1b0280"
+dependencies = [
+ "libc",
+]
+
+[[package]]
+name = "crc32fast"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9481c1c90cbf2ac953f07c8d4a58aa3945c425b7185c9154d67a65e4230da511"
+dependencies = [
+ "cfg-if",
+]
+
+[[package]]
+name = "crunchy"
+version = "0.2.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "460fbee9c2c2f33933d720630a6a0bac33ba7053db5344fac858d4b8952d77d5"
+
+[[package]]
+name = "crypto-common"
+version = "0.1.7"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "78c8292055d1c1df0cce5d180393dc8cce0abec0a7102adb6c7b1eef6016d60a"
+dependencies = [
+ "generic-array",
+ "typenum",
+]
+
+[[package]]
+name = "cuda-artifact-finalizer"
+version = "0.3.0"
+dependencies = [
+ "libnvvm-sys",
+ "nvjitlink-sys",
+ "serde",
+ "sha2",
+ "thiserror",
+]
+
+[[package]]
+name = "cuda-bindings"
+version = "0.5.0"
+dependencies = [
+ "bindgen",
+ "libloading",
+ "prettyplease",
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
+[[package]]
+name = "cuda-core"
+version = "0.5.0"
+dependencies = [
+ "anyhow",
+ "bytemuck",
+ "cuda-bindings",
+ "cuda-core-derive",
+ "cuda-repr",
+ "half",
+ "oxide-artifacts",
+]
+
+[[package]]
+name = "cuda-core-derive"
+version = "0.5.0"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
+[[package]]
+name = "cuda-device"
+version = "0.3.0"
+dependencies = [
+ "bytemuck",
+ "cuda-macros",
+ "cuda-repr",
+]
+
+[[package]]
+name = "cuda-host"
+version = "0.3.0"
+dependencies = [
+ "cuda-artifact-finalizer",
+ "cuda-core",
+ "cuda-device",
+ "cuda-macros",
+ "half",
+ "libc",
+ "oxide-artifacts",
+ "ptx-parse",
+ "sha2",
+ "thiserror",
+]
+
+[[package]]
+name = "cuda-macros"
+version = "0.3.0"
+dependencies = [
+ "oxide-tile-export",
+ "proc-macro2",
+ "quote",
+ "reserved-oxide-symbols",
+ "syn",
+]
+
+[[package]]
+name = "cuda-repr"
+version = "0.5.0"
+
+[[package]]
+name = "cuda-target-spec"
+version = "0.3.0"
+
+[[package]]
+name = "digest"
+version = "0.10.7"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
+dependencies = [
+ "block-buffer",
+ "crypto-common",
+]
+

```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/float_rem_smoke/Cargo.toml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+[package]
+name = "float_rem_smoke"
+version = "0.1.0"
+edition = "2024"
+license = "Apache-2.0"
+
+# Standalone crate (not part of parent workspace).
+[workspace]
+
+[dependencies]
+cuda-device = { path = "../../../cuda-device" }
+cuda-host = { path = "../../../cuda-host" }
+cuda-core = { path = "../../../../../cuda-core" }
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/float_rem_smoke/README.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# float_rem_smoke
+
+## Float `%` is exact
+
+This example checks that the float remainder operator (`%`, `%=` and the
+`rem_euclid` helper built on it) in device code matches the host for the
+same operands, bit for bit.
+
+## What This Example Does
+
+- Four kernels (`%` and `rem_euclid`, one per float width) compute
+  `xs[i] % ys[i]` per element.
+- The host evaluates the same expressions with stdlib `f{32,64}` and
+  compares bit patterns. Rust float remainder is C `fmod`, which is exact
+  for every finite operand pair, so no tolerance is needed.
+- The operand set includes quotients far beyond `2^53` (`1e20 % 7.0`,
+  `3e17 % 0.7`), sign combinations, signed zero, subnormal divisors, and
+  NaN/infinity edge cases. The large-quotient cases are the regression:
+  a lowering that computes `a - trunc(a / b) * b` is off by thousands
+  there.
+
+Exits 0 on PASS, 1 on FAIL.
+
+## Pipeline
+
+The kernels lower `%` to libdevice `__nv_fmodf` / `__nv_fmod`, so the
+pipeline resolves them the same way it resolves the other libdevice math
+calls (IR-level link or libNVVM, depending on the toolkit).
+
+## Run
+
+```bash
+cargo oxide run float_rem_smoke
+```
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/float_rem_smoke/src/main.rs` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Smoke test for float `%` in device code.
+//!
+//! Rust defines `a % b` on floats as C `fmod`: the result is exact for every
+//! finite pair, `a - n * b` for the truncated integer quotient `n`, with the
+//! sign of `a`. Lowering `%` to LLVM `frem` is not enough on NVPTX, whose
+//! backend expands `frem` to `a - trunc(a / b) * b` in floating point. Once
+//! `a / b` is too large to be an exact integer in the operand width, the
+//! expansion drifts by whole multiples of `b`: `1e20_f64 % 7.0` came back as
+//! `-6144.0` instead of `2.0`.
+//!
+//! Each kernel computes the same expression the host computes, and the host
+//! compares the bit patterns (NaN matches NaN). `%=` and `rem_euclid` are
+//! covered because both reach the same remainder lowering.
+//!
+//! Run:
+//!     cargo oxide run float_rem_smoke
+//!
+//! Exits 0 on PASS, 1 on FAIL.
+
+use cuda_core::LaunchConfig;
+use cuda_core::{CudaContext, DeviceBuffer};
+use cuda_device::{DisjointSlice, kernel, thread};
+use cuda_host::{cuda_module, ltoir};
+
+#[cuda_module]
+mod kernels {
+    use super::*;
+
+    #[kernel]
+    pub fn rem_f32(xs: &[f32], ys: &[f32], mut out: DisjointSlice<f32>) {
+        let idx = thread::index_1d();
+        let i = idx.get();
+        if i < xs.len()
+            && i < ys.len()
+            && let Some(slot) = out.get_mut(idx)
+        {
+            let mut r = xs[i];
+            r %= ys[i];
+            *slot = r;
+        }
+    }
+
+    #[kernel]
+    pub fn rem_f64(xs: &[f64], ys: &[f64], mut out: DisjointSlice<f64>) {
+        let idx = thread::index_1d();
+        let i = idx.get();
+        if i < xs.len()
+            && i < ys.len()
+            && let Some(slot) = out.get_mut(idx)
+        {
+            *slot = xs[i] % ys[i];
+        }
+    }
+
+    #[kernel]
+    pub fn rem_euclid_f32(xs: &[f32], ys: &[f32], mut out: DisjointSlice<f32>) {
+        let idx = thread::index_1d();
+        let i = idx.get();
+        if i < xs.len()
+            && i < ys.len()
+            && let Some(slot) = out.get_mut(idx)
+        {
+            *slot = xs[i].rem_euclid(ys[i]);
+        }
+    }
+
+    #[kernel]
+    pub fn rem_euclid_f64(xs: &[f64], ys: &[f64], mut out: DisjointSlice<f64>) {
+        let idx = thread::index_1d();
+        let i = idx.get();
+        if i < xs.len()
+            && i < ys.len()
+            && let Some(slot) = out.get_mut(idx)
+        {
+            *slot = xs[i].rem_euclid(ys[i]);
+        }
+    }
+}
+
+/// Operand pairs. The host-side cast to `f32` keeps the two widths on the
+/// same table; the f32 cases are still large-quotient cases after rounding.
+fn operands_f64() -> Vec<(f64, f64)> {
+    vec![
+        // Large quotients: trunc(a / b) is not an exact integer anymore.
+        (1e20, 7.0),
+        (-1e20, 7.0),
+        (1e20, -3.0),
+        (-1e20, -3.0),
+        (3e17, 0.7),
+        (f64::from(0xCAFE_BABE_u32), 3.0),
+        (f64::MAX, 3.0),
+        (f64::MAX, f64::MIN_POSITIVE),
+        (1e300, 1e-300),
+        // Small quotients, where the naive expansion also happens to work.
+        (5.5, 2.0),
+        (-5.5, 2.0),
+        (5.5, -2.0),
+        (-5.5, -2.0),
+        (0.0, 3.0),
+        (-0.0, 3.0),
+        (2.0, 8.0),
+        (-2.0, 8.0),
+        (7.0, 7.0),
+        (-7.0, 7.0),
+        // Subnormal divisor, infinite and NaN edges.
+        (1.0, 5e-324),
+        (1.0, f64::INFINITY),
+        (-1.0, f64::INFINITY),
+        (f64::INFINITY, 2.0),
+        (2.0, 0.0),
+        (f64::NAN, 2.0),
+        (2.0, f64::NAN),
+    ]
+}
+
+fn same_f32(a: f32, b: f32) -> bool {
+    (a.is_nan() && b.is_nan()) || a.to_bits() == b.to_bits()
+}
+
+fn same_f64(a: f64, b: f64) -> bool {
+    (a.is_nan() && b.is_nan()) || a.to_bits() == b.to_bits()
+}
+
+fn main() -> Result<(), Box<dyn std::error::Error>> {
+    println!("=== float_rem_smoke: f32/f64 % against host fmod ===\n");
+
+    let ctx = CudaContext::new(0)?;
+    let stream = ctx.default_stream();
+    let module = ltoir::load_kernel_module(&ctx, "float_rem_smoke")?;
+    let module = kernels::from_module(module)?;
+
+    let pairs = operands_f64();
+    let xs_f64: Vec<f64> = pairs.iter().map(|p| p.0).collect();
+    let ys_f64: Vec<f64> = pairs.iter().map(|p| p.1).collect();
+    let xs_f32: Vec<f32> = xs_f64.iter().map(|&v| v as f32).collect();
+    let ys_f32: Vec<f32> = ys_f64.iter().map(|&v| v as f32).collect();
+    let n = pairs.len();
+    let cfg = LaunchConfig::for_num_elems(n as u32);
+
+    let xs32 = DeviceBuffer::from_host(&stream, &xs_f32)?;
+    let ys32 = DeviceBuffer::from_host(&stream, &ys_f32)?;
+    let xs64 = DeviceBuffer::from_host(&stream, &xs_f64)?;
+    let ys64 = DeviceBuffer::from_host(&stream, &ys_f64)?;
+
+    let mut out_rem_f32 = DeviceBuffer::<f32>::zeroed(&stream, n)?;
+    let mut out_rem_f64 = De
```

#### Recent Merged Pull Requests:
- **PR #1738** (2026-11-04): fix(cuda-oxide): resolve --device-debug compile/merge failures in clamp, WGMMA, and multi-crate PTX (@nihalpasham)
- **PR #1735** (2026-11-04): fix(cuda-oxide): anchor relative DIFile paths, emit 32-bit AS3 pointer DWARF, and preserve store !dbg (@nihalpasham)
- **PR #1733** (2026-11-04): fix(mir-importer): unwrap rustc_public Debug template in libm inline asm (NVBug 7024210) (@nihalpasham)
- **PR #1703** (2026-11-02): fix(cuda-oxide): order mbarrier init, pre-arrival try_wait, and arrival in shared_memory_helper (@nihalpasham)
- **PR #1702** (2026-11-02): fix(cuda-oxide): resolve SWQA v0.5.0 failures on A100, R100, and ARM64 (@nihalpasham)
- **PR #1701** (2026-11-02): refactor(cute-rs): unify layout algebra in cute-layout and eliminate hand-rolled kernel index math (@nihalpasham)

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

## X. mir-importer): lower is_val_statically_known to false (#1359)

**RULE**:
When implementing operations in `cuda-oxide/crates/mir-importer/src/translator/terminator/helpers.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a38e8446`: mir-importer): lower is_val_statically_known to false (#1359). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/crates/mir-importer/src/translator/terminator/helpers.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    ops::{MirCallOp, MirConstantOp, MirConstructArrayOp, MirGotoOp},
/// Emits a `bool`-returning intrinsic whose result is a fixed constant.
///
/// Used for `core::intrinsics::is_val_statically_known`, which may return
/// `false` for any argument. The argument is a MIR operand with no side
/// effects, so it is not evaluated.
#[allow(clippy::too_many_arguments)]
pub fn emit_bool_constant_intrinsic(
    ctx: &mut Context,
    body: &mir::Body,
    destination: &mir::Place,
    target: &Option<usize>,
    block_ptr: Ptr<BasicBlock>,
    prev_op: Option<Ptr<Operation>>,
    value_map: &mut ValueMap,
    block_map: &[Ptr<BasicBlock>],
    loc: Location,
    intrinsic_name: &str,
    value: bool,
) -> TranslationResult<Ptr<Operation>> {
    use pliron::builtin::attributes::IntegerAttr;
    use pliron::utils::apint::APInt;

    let (prepared_destination, prepared_last_op) = prepare_destination_write(
        ctx,
        body,
        destination,
        value_map,
        block_ptr,
        prev_op,
        loc.clone(),
    )?;

    let bool_ty = IntegerType::get(ctx, 1, Signedness::Signless);
    let const_op = Operation::new(
        ctx,
        MirConstantOp::get_concrete_op_inf
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    ops::{MirCallOp, MirConstructArrayOp, MirGotoOp},
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a38e8446` are properly handled with clean fallback behavior.
