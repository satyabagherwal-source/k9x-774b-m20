> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `99e571f4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T09:36:48.767Z  
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
> **Harvest Timestamp**: 2026-10-31T09:36:47.382Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3919 stars

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
- **Issue #1655** (2026-10-29): **fix(cuda-oxide-mlir-export): saturate float to int casts**
  *Symptoms*: ## What This PR Does  Fixes `#1642` in `cuda-oxide-mlir-export` (`cutlass-mlir` backend) so Rust float-to-integer `as` casts (`MirCastKindAttr::FloatToInt`) saturate on out-of-range inputs and map `NaN` to `0`, matching Rust semantics and `mir-lower`:  1. **Lower `MirCastKindAttr::FloatToInt` to `llvm.fptosi.sat` / `llvm.fptoui.sat` via `llvm.call_intrinsic` and reject integer destinations wider than 64 bits (`cuda-oxide-mlir-export`)** 2. **Add unit tests covering `f16` (`FP16Type` and `MirFP16Type`), `f32`, `f64`, and `i128` / `u128` rejection (`cuda-oxide-mlir-export`)**  ---  ### 1. Why `arith.fptosi` / `arith.fptoui` Miscompiled Out-of-Range and `NaN` Casts  Previously, `CastTranslation::translate` in `cuda-oxide-mlir-export/src/mir/core.rs` lowered `MirCastKindAttr::FloatToInt` to MLIR `arith.fptosi` / `arith.fptoui`, which have poison semantics on `NaN` or out-of-range values:  ```text BEFORE (arith.fptosi / arith.fptoui under cutlass-mlir on sm_120a):   300.0f32 as u8    ──► 44          (wrapped low byte instead of clamping to 255)   128.0f32 as i8    ──► -128        (wrapped instead of clamping to 127)   f32::NAN as i64   ──► i64::MIN    (returned -9223372036854775808 instead of 0)  AFTER (llvm.call_intrinsic "llvm.fpto{s|u}i.sat.i{W}.f{F}"):   300.0f32 as u8    ──► 255         (clamped via FMNMX + F2I)   128.0f32 as i8    ──► 127         (clamped to i8::MAX)   f32::NAN as i64   ──► 0           (mapped to 0 via DSETP.NAN + SEL) ```  * Rejects destination integer widt

- **Issue #1612** (2026-10-22): **DivHint::from_ptr loses pointer alignment at 0x80000000 in 0.2.0/0.3.0 (fixed in 0.3.1)**
  *Symptoms*: `DivHint::from_ptr` in published `cutile-compiler` 0.2.0 and 0.3.0 can return a negative pointer-divisibility hint for an aligned address whose low 32 bits equal `0x8000_0000`. This drops an otherwise valid alignment assumption and can inhibit memory-access optimizations.  **Already fixed:** [NVlabs/cutile-rs#244](https://github.com/NVlabs/cutile-rs/pull/244), merged August 27, 2026, computes alignment from the full `u64` address. The first published version containing the fix is **0.3.1**. This report records the affected versions and verification; it is not an outstanding defect in current `main`.  ### Cause  The affected implementation casts the pointer to `i32` before computing its lowest set bit. At this boundary, `val & val.wrapping_neg()` yields `i32::MIN`, and `.min(16)` preserves the negative result. The entry generator's `div > 1` check then skips the pointer alignment assumption. The conservative omission also produces a different specialization from other equally aligned addresses.  ### Minimal arithmetic reproducer  This reproduces the old arithmetic with a synthetic address. It does not allocate or dereference memory and requires no CUDA or dependencies.  Save as `repro.rs`, then run `rustc repro.rs -o repro && ./repro`:  ```rust fn from_ptr(ptr: u64) -> i32 {     let val = ptr as i32;     let raw = if val == 0 { 16 } else { val & val.wrapping_neg() };     raw.min(16) }  fn main() {     let ptr = 0x0000_0000_8000_0000_u64;     assert_eq!(ptr % 16, 0);     assert

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

### Incident Patch 1: `0925800d` (2026-10-31)
**Commit Message**: fix(cutile): validate full tensor shapes before allocation (#1452)

Closes #1451 

`api::full` currently uses unchecked multiplication to calculate its
flattened element count. Invalid shapes can panic during construction or
wrap before allocation and initialization, with shape validation
occurring later during `reshape`.

Validate the element count with checked multiplication and reject zero
dimensions and flattened lengths above `i32::MAX`. Invalid inputs return
`DeviceError::Internal` when the operation executes, before GPU
allocation or kernel execution. `zeros` and `ones` inherit the
validation through `full`.

Add five host tests and three GPU tests covering overflow, zero
dimensions, the `i32` boundary, construction without panics, and valid
tensor shapes and values. Preserve scalar shape `[]`.

### Validation

Run from `cutile-rs`:

```bash
cargo fmt --all -- --check
git diff --check
cargo test -p cutile --lib api::full_shape_tests
cargo test -p cutile --release --lib api::full_shape_tests
cargo test -p cutile --test gpu tensor_guards::full_
cargo test -p cutile --release --test gpu tensor_guards::full_
cargo clippy -p cutile --lib --test gpu -- -D warnings
RUST_TEST_THREAD

**File**: `cutile-rs/cutile/src/api.rs` (modified, +99/-8)
```diff
@@ -534,6 +534,12 @@ pub fn ones<T: DType + cuda_core::DeviceCopy>(
 /// Allocates GPU memory and fills it with the specified value. This uses a GPU kernel
 /// to initialize the memory efficiently.
 ///
+/// ## Errors
+///
+/// Returns an error on execution if a dimension is zero, the element count
+/// overflows `usize`, or the flattened element count exceeds `i32::MAX`.
+/// Invalid shapes are rejected before GPU allocation or kernel execution.
+///
 /// ## Examples
 ///
 /// ```rust,ignore
@@ -547,15 +553,40 @@ pub fn full<T: DType + cuda_core::DeviceCopy>(
     val: T,
     shape: &[usize],
 ) -> impl DeviceOp<Output = Tensor<T>> {
+    let len = match checked_full_len(shape) {
+        Ok(len) => len,
+        Err(message) => return fail::<Tensor<T>>(message).boxed(),
+    };
     let shape = shape.to_vec();
-    let len = shape.iter().product::<usize>();
-    Tensor::<T>::uninitialized(len).then(move |t| {
-        // TODO (hme): It's awkward to assume_init this before actually initializing it.
-        let partition_size = 128;
-        let result = unsafe { t.assume_init() }.partition([partition_size]);
-        let (_, res) = value((val, result)).then(full_apply).unzip();
-        res.unpartition().reshape(&shape)
-    })
+    Tensor::<T>::uninitialized(len)
+        .then(move |t| {
+            // TODO (hme): It's awkward to assume_init this before actually initializing it.
+            let partition_size = 128;
+            let result = unsafe { t.assume_init() }.partition([partition_size]);
+            let (_, res) = value((val, result)).then(full_apply).unzip();
+            res.unpartition().reshape(&shape)
+        })
+        .boxed()
+}
+
+// `full` initializes a flat tensor before reshaping it. Its element count
+// must fit that tensor's i32 dimension, which also bounds every positive
+// target dimension and contiguous stride. An empty shape remains a scalar.
+fn checked_full_len(shape: &[usize]) -> Result<usize, String> {
+    let len = shape
+        .iter()
+        .try_fold(1usize, |len, &dim| len.checked_mul(dim))
+        .ok_or_else(|| format!("full: shape {shape:?} element count overflows usize"))?;
+    if len == 0 {
+        return Err(format!("full: shape {shape:?} contains a zero dimension"));
+    }
+    if i32::try_from(len).is_err() {
+        return Err(format!(
+            "full: shape {shape:?} element count {len} exceeds i32::MAX ({})",
+            i32::MAX
+        ));
+    }
+    Ok(len)
 }
 
 pub fn fill<T: DType + cuda_core::DeviceCopy>(
@@ -973,3 +1004,63 @@ pub trait DeviceOpReshapeShared<T: DType + Send>:
 }
 
 impl<T: DType + Send, DI: DeviceOp<Output = Arc<Tensor<T>>>> DeviceOpReshapeShared<T> for DI {}
+
+#[cfg(test)]
+mod full_shape_tests {
+    use super::{checked_full_len, full, ones, zeros};
+
+    #[test]
+    fn accepts_valid_shapes_and_i32_boundary() {
+        assert_eq!(checked_full_len(&[]), Ok(1));
+        assert_eq!(checked_full_len(&[1024]), Ok(1024));
+        assert_eq!(checked_full_len(&[3, 5]), Ok(15));
+        assert_eq!(checked_full_len(&[2, 3, 4]), Ok(24));
+        assert_eq!(
+            checked_full_len(&[i32::MAX as usize]),
+            Ok(i32::MAX as usize)
+        );
+    }
+
+    #[test]
+    fn rejects_zero_dimensions() {
+        for shape in [&[0][..], &[3, 0][..], &[0, usize::MAX][..]] {
+            let error = checked_full_len(shape).expect_err("zero dimension must fail");
+            assert!(error.contains("zero dimension"), "{error}");
+        }
+    }
+
+    #[test]
+    fn rejects_usize_product_overflow() {
+        // The first product wraps to 1 without overflow checks. The second
+        // overflows even though every individual dimension fits in i32.
+        for shape in [&[usize::MAX, usize::MAX][..], &[i32::MAX as usize; 3][..]] {
+            let error = checked_full_len(shape).expect_err("shape product must fail");
+            assert!(error.contains("overflows usize"), "{error}");
+        }
+    }
+
+    #[test]
+    fn rejects_flattened_length_above_i32_max() {
+        // Both products fit usize on 32-bit and 64-bit hosts.
+        for shape in [&[i32::MAX as usize + 1][..], &[32768, 65536][..]] {
+            let error = checked_full_len(shape).expect_err("flat dimension must fail");
+            assert!(error.contains("exceeds i32::MAX"), "{error}");
+        }
+    }
+
+    #[test]
+    fn invalid_shapes_do_not_panic_during_construction() {
+        // Only construct the lazy operations: this must not need a CUDA
+        // context, panic on arithmetic, or reach the zero-length assertion.
+        for shape in [
+            &[usize::MAX, usize::MAX][..],
+            &[i32::MAX as usize + 1][..],
+            &[32768, 65536][..],
+            &[0][..],
+        ] {
+            let _ = full(7.0f32, shape);
+            let _ = zeros::<f32>(shape);
+            let _ = ones::<f32>(shape);
+        }
+    }
+}
```

**File**: `cutile-rs/cutile/tests/gpu/tensor_guards.rs` (modified, +67/-0)
```diff
@@ -9,6 +9,7 @@
 
 use std::panic::{self, AssertUnwindSafe};
 
+use cuda_async::error::DeviceError;
 use cutile::api;
 use cutile::prelude::*;
 
@@ -104,3 +105,69 @@ fn oversized_allocation_is_an_error_not_a_panic() {
         .expect("allocation after OOM");
     assert_eq!(t.shape(), &[16]);
 }
+
+const INVALID_FULL_SHAPES: &[(&[usize], &str)] = &[
+    (&[usize::MAX, usize::MAX], "overflows usize"),
+    (&[i32::MAX as usize; 3], "overflows usize"),
+    (&[i32::MAX as usize + 1], "exceeds i32::MAX"),
+    (&[32768, 65536], "exceeds i32::MAX"),
+    (&[0], "zero dimension"),
+    (&[3, 0], "zero dimension"),
+];
+
+fn assert_full_shape_error(error: DeviceError, expected: &str) {
+    match error {
+        DeviceError::Internal(message) => {
+            assert!(message.starts_with("full: "), "{message}");
+            assert!(message.contains(expected), "{message}");
+        }
+        other => panic!("expected full shape validation error, got: {other:?}"),
+    }
+}
+
+#[test]
+fn full_reports_invalid_shapes_as_errors() {
+    // Check the specific error, not just is_err(): in release builds the
+    // old product could wrap, allocate and fill, then fail during reshape.
+    for &(shape, expected) in INVALID_FULL_SHAPES {
+        let error = api::full(7.0f32, shape)
+            .sync()
+            .expect_err("invalid full shape must fail");
+        assert_full_shape_error(error, expected);
+    }
+}
+
+#[test]
+fn full_wrappers_report_invalid_shapes_as_errors() {
+    for &(shape, expected) in INVALID_FULL_SHAPES {
+        let zeros_error = api::zeros::<f32>(shape)
+            .sync()
+            .expect_err("invalid zeros shape must fail");
+        assert_full_shape_error(zeros_error, expected);
+
+        let ones_error = api::ones::<f32>(shape)
+            .sync()
+            .expect_err("invalid ones shape must fail");
+        assert_full_shape_error(ones_error, expected);
+    }
+}
+
+#[test]
+fn full_and_wrappers_preserve_shape_and_values() {
+    // Exercise a matrix reshape and a partial edge tile of the fill kernel.
+    for (shape, expected_shape) in [
+        (&[2usize, 3][..], &[2i32, 3][..]),
+        (&[129usize][..], &[129i32][..]),
+    ] {
+        let tensors = [
+            (api::full(3.25f32, shape).sync().expect("valid full"), 3.25),
+            (api::zeros::<f32>(shape).sync().expect("valid zeros"), 0.0),
+            (api::ones::<f32>(shape).sync().expect("valid ones"), 1.0),
+        ];
+        for (tensor, expected) in tensors {
+            assert_eq!(tensor.shape(), expected_shape);
+            let host: Vec<f32> = tensor.to_host_vec().sync().expect("copy");
+            assert_eq!(host, vec![expected; shape.iter().product()]);
+        }
+    }
+}
```

---

### Incident Patch 2: `2d47e43e` (2026-10-31)
**Commit Message**: fix(cuda-bindings): preserve complete struct layouts with libclang 22 (#1684)

Older bindgen can emit a one-byte placeholder instead of the fields of a
forward-declared C struct when using libclang 22. This produces
incorrect CUDA bindings and failing layout checks. Upgrade
`cuda-bindings` to bindgen 0.72.1, which includes the upstream
type-completeness fix in
[rust-lang/rust-bindgen#3278](https://github.com/rust-lang/rust-bindgen/pull/3278).

The regression test uses a self-contained C typedef chain and verifies
that both fields of the completed struct survive binding generation.
With bindgen 0.69.5 and libclang 22 it fails because only `_address` is
emitted; with 0.72.1 it passes. It runs as part of the existing
`cuda-bindings` test suite. Use libclang 22 to exercise the original
failure.

The large diff is generated lockfile maintenance: 263 affected
workspace/example lockfiles now resolve the updated shared bindings
dependency. Package additions are limited to the new bindgen and its
required rustc-hash version; obsolete transitive dependencies disappear.
Archived benchmarks that use separately published crates are unchanged.

Validation:

- The regression fails with bindgen 0.

**File**: `Cargo.lock` (modified, +6/-144)
```diff
@@ -19,25 +19,22 @@ checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
  "quote",
  "regex",
- "rustc-hash 1.1.0",
+ "rustc-hash",
  "shlex",
  "syn",
- "which",
 ]
 
 [[package]]
@@ -135,7 +132,7 @@ dependencies = [
  "half",
  "loom",
  "once_cell",
- "rustc-hash 2.1.2",
+ "rustc-hash",
  "thiserror",
 ]
 
@@ -204,16 +201,6 @@ version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
 
-[[package]]
-name = "errno"
-version = "0.3.14"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
-dependencies = [
- "libc",
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "find-msvc-tools"
 version = "0.1.9"
@@ -368,15 +355,6 @@ version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "indexmap"
 version = "2.14.0"
@@ -408,12 +386,6 @@ version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
 
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -430,12 +402,6 @@ dependencies = [
  "windows-link",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "lock_api"
 version = "0.4.14"
@@ -501,7 +467,7 @@ version = "0.50.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7957b9740744892f114936ab4a57b3f487491bbeafaf8083688b16841a4240e5"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -616,31 +582,12 @@ version = "0.8.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "dc897dd8d9e8bd1ed8cdad82b5966c3e0ecae09fb1907d58efaa013543185d0a"
 
-[[package]]
-name = "rustc-hash"
-version = "1.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
 [[package]]
 name = "rustc-hash"
 version = "2.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "94300abf3f1ae2e2b8ffb7b58043de3d399c73fa6f4b73826402a5c457614dbe"
 
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys",
- "windows-sys 0.59.0",
-]
-
 [[package]]
 name = "rustversion"
 version = "1.0.22"
@@ -907,25 +854,13 @@ version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ba73ea9cf16a25df0c8caa16c51acb937d5712a8429db78a3ee29d5dcacd3a65"
 
-[[package]]
-name = "which"
-version = "4.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "87ba24419a2078cd2b0f2ede2691b6c66d8e47836da3b6db8265ebad47afbfc7"
-dependencies = [
- "either",
- "home",
- "once_cell",
- "rustix",
-]
-
 [[package]]
 name = "winapi-util"
 version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -943,15 +878,6 @@ dependencies = [
  "windows-link",
 ]
 
-[[package]]
-name = "windows-sys"
-version = "0.59.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
-dependencies = [
- "windows-targets",
-]
-
 [[package]]
 name = "windows-sys"
 version = "0.61.2"
@@ -961,70 +887,6 @@ dependencies = [
  "windows-link",
 ]
 
-[[package]]
-name = "windows-targets"
-version = "0.52.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b724
```

**File**: `cuda-bindings/Cargo.toml` (modified, +5/-1)
```diff
@@ -16,12 +16,16 @@ doctest = false
 libloading = "0.8"
 
 [build-dependencies]
-bindgen = "0.69.4"
+bindgen = "0.72.1"
 prettyplease = "0.2.35"
 proc-macro2 = { version = "1", features = ["span-locations"] }
 quote = "1.0.35"
 syn = { version = "2.0", features = ["full", "extra-traits", "visit", "visit-mut", "fold"] }
 
+[dev-dependencies]
+bindgen = "0.72.1"
+syn = { version = "2.0", features = ["full"] }
+
 [lints.rust]
 unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }
 
```

**File**: `cuda-bindings/tests/forward_declared_struct.rs` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+//! libclang 22 returns a forward declaration where older versions returned the
+//! definition. Bindgen must follow it to the definition before emitting fields.
+
+#[test]
+fn typedef_chain_preserves_forward_declared_struct_fields() {
+    let bindings = bindgen::builder()
+        .header_contents(
+            "forward_declared_struct.h",
+            r#"
+                typedef struct Packet_st Packet_v1;
+                typedef Packet_v1 Packet;
+                struct Packet_st {
+                    unsigned long long address;
+                    unsigned long long count;
+                };
+            "#,
+        )
+        .generate()
+        .expect("generate bindings for the forward-declared struct");
+    let file = syn::parse_file(&bindings.to_string()).expect("parse generated bindings");
+    let packet = file
+        .items
+        .iter()
+        .find_map(|item| match item {
+            syn::Item::Struct(item) if item.ident == "Packet_st" => Some(item),
+            _ => None,
+        })
+        .expect("emit the complete struct definition");
+    let fields: Vec<_> = packet
+        .fields
+        .iter()
+        .map(|field| field.ident.as_ref().expect("named field").to_string())
+        .collect();
+    assert_eq!(fields, ["address", "count"]);
+}
```

**File**: `cuda-oxide/Cargo.lock` (modified, +18/-152)
```diff
@@ -53,7 +53,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -64,7 +64,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -155,25 +155,22 @@ dependencies = [
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
  "quote",
  "regex",
- "rustc-hash 1.1.0",
+ "rustc-hash",
  "shlex",
  "syn 2.0.117",
- "which",
 ]
 
 [[package]]
@@ -407,7 +404,7 @@ dependencies = [
  "futures",
  "half",
  "once_cell",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "thiserror 1.0.69",
 ]
 
@@ -697,7 +694,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -900,15 +897,6 @@ dependencies = [
  "wide",
 ]
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "iket-lower"
 version = "0.1.0"
@@ -958,18 +946,6 @@ version = "1.0.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
-[[package]]
-name = "lazy_static"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
-
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -1015,12 +991,6 @@ dependencies = [
  "syn 3.0.9",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "linux-raw-sys"
 version = "0.12.1"
@@ -1042,7 +1012,7 @@ dependencies = [
  "pliron-derive",
  "pliron-llvm",
  "reserved-oxide-symbols",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "thiserror 2.0.21",
 ]
 
@@ -1092,7 +1062,7 @@ dependencies = [
  "pliron",
  "pliron-derive",
  "reserved-oxide-symbols",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "thiserror 2.0.21",
 ]
 
@@ -1109,7 +1079,7 @@ dependencies = [
  "pliron",
  "pliron-derive",
  "reserved-oxide-symbols",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "thiserror 2.0.21",
 ]
 
@@ -1120,7 +1090,7 @@ dependencies = [
  "dialect-mir",
  "pliron",
  "reserved-oxide-symbols",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "thiserror 2.0.21",
 ]
 
@@ -1250,7 +1220,7 @@ dependencies = [
  "once_vec",
  "pliron-derive",
  "regex",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "rustc_apfloat",
  "slotmap",
  "smallvec",
@@ -1270,7 +1240,7 @@ dependencies = [
  "indexmap",
  "proc-macro2",
  "quote",
- "rustc-hash 2.1.3",
+ "rustc-hash",
  "syn 3.0.9",
 ]
 
@@ -1402,12 +1372,6 @@ version = "0.1.28"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b74b56ffa8bb2830709a538c2cbcae9aa062db0d2a42563bfb09bdaae44020eb"
 
-[[package]]
-name = "rustc-hash"
-version = "1.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
 [[package]]
 name = "rustc-hash"
 version = "2.1.3"
@@ -1424,19 +1388,6 @@ dependencies = [
  "smallvec",
 ]
 
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys 0.4.15",
- "windows-sys 0.59.0",
-]
-
 [[package]]
 name = "rustix"
 version = "1.1.4"
@@ -1446,8 +1397,8 @@ dependencies = [
  "bitflags",
  "errno",
  "libc",
- "linux-raw-sys 0.12.1",
- "windows-sys 0.61.2",
+ "linux-raw-sys",
+ "windows-sys",
 ]
 
 [[package]]
@@ -1613,8 +1564,8 @@ dependencies = [
  "fastrand",
  "getrandom",
  "once_cell",
- "rustix 1.1.4",
- "windows-sys 0.61.2",
+ "rustix",
+ "windows-sys",
 ]
 
 [[package]]
@@ -1768,18 +1719,6 @@ version = "0.9.5"
 source = "registry+https://githu
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/abi_hmm/Cargo.lock` (modified, +4/-157)
```diff
@@ -28,16 +28,14 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
@@ -46,7 +44,6 @@ dependencies = [
  "rustc-hash",
  "shlex",
  "syn",
- "which",
 ]
 
 [[package]]
@@ -255,16 +252,6 @@ version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
 
-[[package]]
-name = "errno"
-version = "0.3.14"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
-dependencies = [
- "libc",
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "foldhash"
 version = "0.1.5"
@@ -314,15 +301,6 @@ version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "indexmap"
 version = "2.14.0"
@@ -348,18 +326,6 @@ version = "1.0.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
-[[package]]
-name = "lazy_static"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
-
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -385,12 +351,6 @@ dependencies = [
  "thiserror",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "log"
 version = "0.4.29"
@@ -439,12 +399,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "once_cell"
-version = "1.21.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50"
-
 [[package]]
 name = "oxide-artifacts"
 version = "0.2.1"
@@ -530,22 +484,9 @@ version = "0.2.1"
 
 [[package]]
 name = "rustc-hash"
-version = "1.1.0"
+version = "2.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys",
- "windows-sys 0.59.0",
-]
+checksum = "6b1e7f9a428571be2dc5bc0505c13fb6bf936822b894ec87abf8a08a4e51742d"
 
 [[package]]
 name = "serde"
@@ -656,106 +597,12 @@ version = "0.9.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"
 
-[[package]]
-name = "which"
-version = "4.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "87ba24419a2078cd2b0f2ede2691b6c66d8e47836da3b6db8265ebad47afbfc7"
-dependencies = [
- "either",
- "home",
- "once_cell",
- "rustix",
-]
-
 [[package]]
 name = "windows-link"
 version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
 
-[[package]]
-name = "windows-sys"
-version = "0.59.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
-dependencies = [
- "windows-targets",
-]
-
-[[package]]
-name = "windows-sys"
-version = "0.61.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ae137229bcbd6cdf0f7b80a31df61766145077ddf49416a728b02cb3921ff3fc"
-dependencies = [
- "windows-link",
-]
-
-[[package]]
-name = "windows-targets"
-version = "0.52.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b724f72796e036ab90c1021d4780d4d3d648aca59e491e6b98e725b84e99973"
-dependencies = [
- "windows_aarch64_gnullvm",
- "windows_aarch64_msvc",
- "windows_i686_gnu",
- "windows_i686_gnullvm",
- "
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/addressof_sharedarray/Cargo.lock` (modified, +4/-157)
```diff
@@ -28,16 +28,14 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
@@ -46,7 +44,6 @@ dependencies = [
  "rustc-hash",
  "shlex",
  "syn",
- "which",
 ]
 
 [[package]]
@@ -255,16 +252,6 @@ version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
 
-[[package]]
-name = "errno"
-version = "0.3.14"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
-dependencies = [
- "libc",
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "foldhash"
 version = "0.1.5"
@@ -314,15 +301,6 @@ version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "indexmap"
 version = "2.14.0"
@@ -348,18 +326,6 @@ version = "1.0.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
-[[package]]
-name = "lazy_static"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
-
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -385,12 +351,6 @@ dependencies = [
  "thiserror",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "log"
 version = "0.4.29"
@@ -439,12 +399,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "once_cell"
-version = "1.21.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50"
-
 [[package]]
 name = "oxide-artifacts"
 version = "0.2.1"
@@ -530,22 +484,9 @@ version = "0.2.1"
 
 [[package]]
 name = "rustc-hash"
-version = "1.1.0"
+version = "2.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys",
- "windows-sys 0.59.0",
-]
+checksum = "6b1e7f9a428571be2dc5bc0505c13fb6bf936822b894ec87abf8a08a4e51742d"
 
 [[package]]
 name = "serde"
@@ -656,106 +597,12 @@ version = "0.9.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"
 
-[[package]]
-name = "which"
-version = "4.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "87ba24419a2078cd2b0f2ede2691b6c66d8e47836da3b6db8265ebad47afbfc7"
-dependencies = [
- "either",
- "home",
- "once_cell",
- "rustix",
-]
-
 [[package]]
 name = "windows-link"
 version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
 
-[[package]]
-name = "windows-sys"
-version = "0.59.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
-dependencies = [
- "windows-targets",
-]
-
-[[package]]
-name = "windows-sys"
-version = "0.61.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ae137229bcbd6cdf0f7b80a31df61766145077ddf49416a728b02cb3921ff3fc"
-dependencies = [
- "windows-link",
-]
-
-[[package]]
-name = "windows-targets"
-version = "0.52.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b724f72796e036ab90c1021d4780d4d3d648aca59e491e6b98e725b84e99973"
-dependencies = [
- "windows_aarch64_gnullvm",
- "windows_aarch64_msvc",
- "windows_i686_gnu",
- "windows_i686_gnullvm",
- "
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/aligned_field_loads/Cargo.lock` (modified, +4/-157)
```diff
@@ -28,16 +28,14 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
@@ -46,7 +44,6 @@ dependencies = [
  "rustc-hash",
  "shlex",
  "syn",
- "which",
 ]
 
 [[package]]
@@ -255,16 +252,6 @@ version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
 
-[[package]]
-name = "errno"
-version = "0.3.14"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
-dependencies = [
- "libc",
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "foldhash"
 version = "0.1.5"
@@ -314,15 +301,6 @@ version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "indexmap"
 version = "2.14.0"
@@ -348,18 +326,6 @@ version = "1.0.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
-[[package]]
-name = "lazy_static"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
-
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -385,12 +351,6 @@ dependencies = [
  "thiserror",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "log"
 version = "0.4.29"
@@ -439,12 +399,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "once_cell"
-version = "1.21.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50"
-
 [[package]]
 name = "oxide-artifacts"
 version = "0.2.1"
@@ -530,22 +484,9 @@ version = "0.2.1"
 
 [[package]]
 name = "rustc-hash"
-version = "1.1.0"
+version = "2.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys",
- "windows-sys 0.59.0",
-]
+checksum = "6b1e7f9a428571be2dc5bc0505c13fb6bf936822b894ec87abf8a08a4e51742d"
 
 [[package]]
 name = "serde"
@@ -656,106 +597,12 @@ version = "0.9.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"
 
-[[package]]
-name = "which"
-version = "4.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "87ba24419a2078cd2b0f2ede2691b6c66d8e47836da3b6db8265ebad47afbfc7"
-dependencies = [
- "either",
- "home",
- "once_cell",
- "rustix",
-]
-
 [[package]]
 name = "windows-link"
 version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
 
-[[package]]
-name = "windows-sys"
-version = "0.59.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
-dependencies = [
- "windows-targets",
-]
-
-[[package]]
-name = "windows-sys"
-version = "0.61.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ae137229bcbd6cdf0f7b80a31df61766145077ddf49416a728b02cb3921ff3fc"
-dependencies = [
- "windows-link",
-]
-
-[[package]]
-name = "windows-targets"
-version = "0.52.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b724f72796e036ab90c1021d4780d4d3d648aca59e491e6b98e725b84e99973"
-dependencies = [
- "windows_aarch64_gnullvm",
- "windows_aarch64_msvc",
- "windows_i686_gnu",
- "windows_i686_gnullvm",
- "
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/aligned_field_stores/Cargo.lock` (modified, +4/-157)
```diff
@@ -28,16 +28,14 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "bindgen"
-version = "0.69.5"
+version = "0.72.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "271383c67ccabffb7381723dea0672a673f292304fcb45c01cc648c7a8d58088"
+checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
 dependencies = [
  "bitflags",
  "cexpr",
  "clang-sys",
  "itertools",
- "lazy_static",
- "lazycell",
  "log",
  "prettyplease",
  "proc-macro2",
@@ -46,7 +44,6 @@ dependencies = [
  "rustc-hash",
  "shlex",
  "syn",
- "which",
 ]
 
 [[package]]
@@ -255,16 +252,6 @@ version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
 
-[[package]]
-name = "errno"
-version = "0.3.14"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
-dependencies = [
- "libc",
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "foldhash"
 version = "0.1.5"
@@ -314,15 +301,6 @@ version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
 
-[[package]]
-name = "home"
-version = "0.5.12"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc627f471c528ff0c4a49e1d5e60450c8f6461dd6d10ba9dcd3a61d3dff7728d"
-dependencies = [
- "windows-sys 0.61.2",
-]
-
 [[package]]
 name = "indexmap"
 version = "2.14.0"
@@ -348,18 +326,6 @@ version = "1.0.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
 
-[[package]]
-name = "lazy_static"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
-
-[[package]]
-name = "lazycell"
-version = "1.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
-
 [[package]]
 name = "libc"
 version = "0.2.186"
@@ -385,12 +351,6 @@ dependencies = [
  "thiserror",
 ]
 
-[[package]]
-name = "linux-raw-sys"
-version = "0.4.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d26c52dbd32dccf2d10cac7725f8eae5296885fb5703b261f7d0a0739ec807ab"
-
 [[package]]
 name = "log"
 version = "0.4.29"
@@ -439,12 +399,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "once_cell"
-version = "1.21.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50"
-
 [[package]]
 name = "oxide-artifacts"
 version = "0.2.1"
@@ -530,22 +484,9 @@ version = "0.2.1"
 
 [[package]]
 name = "rustc-hash"
-version = "1.1.0"
+version = "2.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"
-
-[[package]]
-name = "rustix"
-version = "0.38.44"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
-dependencies = [
- "bitflags",
- "errno",
- "libc",
- "linux-raw-sys",
- "windows-sys 0.59.0",
-]
+checksum = "6b1e7f9a428571be2dc5bc0505c13fb6bf936822b894ec87abf8a08a4e51742d"
 
 [[package]]
 name = "serde"
@@ -656,106 +597,12 @@ version = "0.9.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"
 
-[[package]]
-name = "which"
-version = "4.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "87ba24419a2078cd2b0f2ede2691b6c66d8e47836da3b6db8265ebad47afbfc7"
-dependencies = [
- "either",
- "home",
- "once_cell",
- "rustix",
-]
-
 [[package]]
 name = "windows-link"
 version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"
 
-[[package]]
-name = "windows-sys"
-version = "0.59.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
-dependencies = [
- "windows-targets",
-]
-
-[[package]]
-name = "windows-sys"
-version = "0.61.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ae137229bcbd6cdf0f7b80a31df61766145077ddf49416a728b02cb3921ff3fc"
-dependencies = [
- "windows-link",
-]
-
-[[package]]
-name = "windows-targets"
-version = "0.52.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b724f72796e036ab90c1021d4780d4d3d648aca59e491e6b98e725b84e99973"
-dependencies = [
- "windows_aarch64_gnullvm",
- "windows_aarch64_msvc",
- "windows_i686_gnu",
- "windows_i686_gnullvm",
- "
```

---

### Incident Patch 3: `dfea1169` (2026-10-30)
**Commit Message**: cuda-core: safe element casts require AnyBitPattern; bool is DeviceCopy (#1516)

Closes #1506. First change under #1460; implements the `bool` decision
recorded there and in #1461 and #1503.

Safe element casts previously checked size and alignment but could turn
a byte containing `2` into a Rust `bool`. This PR rejects those casts,
supports initialized `bool` buffers, and closes the host-side
initialization, atomic-reference, kernel-argument, and pinned-alignment
holes found during review and follow-up auditing.

## Element validity

`DeviceBuffer::cast_elem`, `cast_chunks`, `can_cast_chunks`, and
`Tensor::reinterpret` require `bytemuck::AnyBitPattern` on the target.
Casting into `bool` is therefore a compile error.

The two safe buffer casts also require `T: bytemuck::NoUninit` on their
source: padding or `MaybeUninit` bytes must not become initialized
destination values. `can_cast_chunks` remains a layout query. These
bounds do not restrict `DeviceCopy` itself, and bool-to-byte casts
remain supported.

`bool` implements `DeviceCopy`: valid values can be copied between host
and device, and its all-zero representation is valid. `DeviceCopy` does
not promise that every bit pattern 

**File**: `.github/workflows/book.yml` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@ on:
   # only ever built after merge, so a PR that broke it could not be caught by
   # review or by CI.
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - 'cuda-oxide/cuda-oxide-book/**'
       - 'cutile-rs/cutile-book/**'
```

**File**: `.github/workflows/ci.yml` (modified, +4/-1)
```diff
@@ -12,17 +12,20 @@ on:
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
       - '.github/workflows/**'
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - 'cuda-oxide/**'
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
```

**File**: `.github/workflows/codeql.yml` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@ on:
       - '**/*.sh'
       - '**/*.py'
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - '**/*.rs'
       - '**/Cargo.toml'
```

**File**: `.github/workflows/cutile-rs.yml` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ jobs:
               - 'cuda-bindings/**'
               - 'cuda-core/**'
               - 'cuda-core-derive/**'
+              - 'cuda-repr/**'
               - 'cuda-async/**'
               - 'Cargo.toml'
               - 'Cargo.lock'
```

**File**: `.github/workflows/docs.yml` (modified, +4/-1)
```diff
@@ -10,17 +10,20 @@ on:
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
       - '.github/workflows/**'
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - 'cuda-oxide/**'
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
```

**File**: `.github/workflows/examples-compile.yml` (modified, +4/-1)
```diff
@@ -10,17 +10,20 @@ on:
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
       - '.github/workflows/**'
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - 'cuda-oxide/**'
       - 'cuda-bindings/**'
       - 'cuda-core/**'
       - 'cuda-core-derive/**'
+      - 'cuda-repr/**'
       - 'cuda-async/**'
       - 'Cargo.toml'
       - 'Cargo.lock'
```

**File**: `.github/workflows/naming-guard.yml` (modified, +2/-1)
```diff
@@ -16,7 +16,8 @@ on:
       - 'cuda-oxide/scripts/check-reserved-prefixes.sh'
       - '.github/workflows/naming-guard.yml'
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
     paths:
       - 'cuda-oxide/crates/**'
       - 'cuda-oxide/scripts/check-reserved-prefixes.sh'
```

**File**: `.github/workflows/status-guard.yml` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@ on:
   push:
     branches: [main]
   pull_request:
-    branches: [main]
+    # Include PRs stacked on copy-pr-bot mirrors of their prerequisites.
+    branches: [main, "pull-request/[0-9]+"]
 
 # Each commit on main gets its own group, so it starts at once. Any other ref
 # still shares one group and cancels the older run.
```

#### Recent Merged Pull Requests:
- **PR #1684** (2026-10-31): fix(cuda-bindings): preserve complete struct layouts with libclang 22 (@elibol)
- **PR #1683** (2026-10-30): test(cutile): skip FP8 execution on unsupported targets (@elibol)
- **PR #1672** (2026-10-30): feat(cute-rs): complete SM120a CuTeDSL parity, TiledCopy, BF16/NVFP4 TiledMma, and workload migrations (@nihalpasham)
- **PR #1671** (2026-10-30): feat(cute-rs): add CuTeDSL-aligned SM100 pipelines, TmemAllocator, and arch forwarders (@nihalpasham)
- **PR #1665** (2026-10-29): Put the Rust row inside the prerequisites table (@CanReader)
- **PR #1663** (2026-10-27): perf(cuda-oxide): 7-stage SMEM pipeline and wave-tail tile balancing in gemm_sol_final (@nihalpasham)

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

## X. cutile): validate full tensor shapes before allocation (#1452)

**RULE**:
When implementing operations in `cutile-rs/cutile/src/api.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0925800d`: cutile): validate full tensor shapes before allocation (#1452). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cutile-rs/cutile/src/api.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// ## Errors
///
/// Returns an error on execution if a dimension is zero, the element count
/// overflows `usize`, or the flattened element count exceeds `i32::MAX`.
/// Invalid shapes are rejected before GPU allocation or kernel execution.
///
    let len = match checked_full_len(shape) {
        Ok(len) => len,
        Err(message) => return fail::<Tensor<T>>(message).boxed(),
    };
    Tensor::<T>::uninitialized(len)
        .then(move |t| {
            // TODO (hme): It's awkward to assume_init this before actually initializing it.
            let partition_size = 128;
            let result = unsafe { t.assume_init() }.partition([partition_size]);
            let (_, res) = value((val, result)).then(full_apply).unzip();
            res.unpartition().reshape(&shape)
        })
        .boxed()
}

// `full` initializes a flat tensor before reshaping it. Its element count
// must fit that tensor's i32 dimension, which also bounds every positive
// target dimension and contiguous stride. An empty shape remains a scalar.
fn checked_full_len(shape: &[usize]) -> Result<usize, String> {
    let len = shape
        .iter()
        .try_fold(1usize, |len, &dim| len.checked_mul(dim))

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    let len = shape.iter().product::<usize>();
    Tensor::<T>::uninitialized(len).then(move |t| {
        // TODO (hme): It's awkward to assume_init this before actually initializing it.
        let partition_size = 128;
        let result = unsafe { t.assume_init() }.partition([partition_size]);
        let (_, res) = value((val, result)).then(full_apply).unzip();
        res.unpartition().reshape(&shape)
    })
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0925800d` are properly handled with clean fallback behavior.
