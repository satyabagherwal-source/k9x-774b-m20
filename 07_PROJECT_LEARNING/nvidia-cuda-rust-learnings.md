# Forensic Learning Record (Deep Inspection): NVIDIA/cuda-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:36.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: cuda-oxide is a Rust-to-CUDA compiler that lets you write (SIMT) GPU kernels in safe(ish), idiomatic Rust. It compiles standard Rust code directly to PTX — no DSLs, no foreign language bindings, just Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3659 stars

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
    // Enums are deliberately rejected: `DeviceCopy`'s safety contract requires
    // every bit pattern, including the all-zero pattern written by
    // `DeviceBuffer::zeroed`, to be a valid value of the type. That holds for
    // product types (structs/unions) when every field is `DeviceCopy`, but NOT
    // for enums, whose discriminant leaves most byte patterns invalid. A zeroed
    // or device-written buffer could then materialize an out-of-range
    // discriminant (undefined behavior). This is the same reason `bool`, `char`,
    // and `NonZeroU32` are not `DeviceCopy`. Per-field checking is necessary but
    // not sufficient for enums, so we refuse rather than emit an unsound impl.
    let check_types_code = match input.data {
        Data::Struct(ref data_struct) => type_check_struct(data_struct),
        Data::Union(ref data_union) => type_check_union(data_union),
        Data::Enum(_) => {
            return syn::Error::new_spanned(
                input_type,
                "`#[derive(DeviceCopy)]` cannot be applied to enums: `DeviceCopy` requires \
                 every bit pattern (including the all-zero pattern written by \
                 `DeviceBuffer::zeroed`) to be a valid value, but an enum's discriminant \
                 leaves most byte patterns invalid, so a zeroed or device-written buffer \
                 could materialize an out-of-range discriminant (undefined behavior). If you \
                 can guarantee every device-produced byte pattern is a valid variant, write \
                 `unsafe impl DeviceCopy for ... {}` by hand.",
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
    crate::cudarc_shim::memory::memset_d8_async(dptr, value, num_bytes, stream.cu_stream())
}

/// Asynchronously frees device memory on the given stream.
///
/// # Safety
/// `dptr` must have been allocated with [`malloc_async`] or
/// [`malloc_from_pool_async`], `stream` must be ordered after every use of
/// the allocation, and `dptr` must not be used after this call.
pub unsafe fn free_async(dptr: sys::CUdeviceptr, stream: &Arc<Stream>) -> Result<(), DriverError> {
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
    let num_bytes = num_elements * mem::size_of::<T>();
    unsafe {
        crate::cudarc_shim::memory::memcpy_dtod_async(dst, src, num_bytes, stream.cu_stream())
    }
}

/// Wrappers around the cuRAND random number generation library.
pub mod curand {
    // TODO (hme): Probably move this into its own file at some point.

    use crate::runtime::Stream;
    use cuda_bindings::{
        curandCreateGenerator, curandDestroyGenerator, curandGenerateNormal,
        curandGenerateNormalDouble, curandGenerateUniform, curandGenerateUniformDouble,
        curandGenerator_t, curandRngType_CURAND
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
    tf32 => TF32, tf32(0), tf32(0x3F800000),  // IEEE 754 1.0 in f32 bits
    f64 => F64, 0.0, 1.0,
    f8e4m3fn => F8E4M3FN, f8e4m3fn(0), f8e4m3fn(0x38),  // 1.0 in E4M3FN
    f8e5m2 => F8E5M2, f8e5m2(0), f8e5m2(0x3C),          // 1.0 in E5M2
    f8e8m0fnu => F8E8M0FNU, f8e8m0fnu(0), f8e8m0fnu(0x7F),
    f8e5m3fnu => F8E5M3FNU, f8e5m3fnu(0), f8e5m3fnu(0x78),
    f4e2m1fnx2 => F4E2M1FNX2, f4e2m1fnx2::from_bits(0), f4e2m1fnx2::from_nibbles(0x2, 0x2),
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dtype_enum_as_str() {
        assert_eq!(DTypeId::Bool.as_str(), "bool");
        assert_eq!(DTypeId::U8.as_str(), "u8");
        assert_eq!(DTypeId::U16.as_str(), "u16");
        assert_eq!(DTypeId::U32.as_str(), "u32");
        assert_eq!(DTypeId::U64.as_str(), "u64");
        assert_eq!(DTypeId::I8.as_str(), "i8");
        assert_eq!(DTypeId::I16.as_str(), "i16");
        assert_eq!(DTypeId::I32.as_str(), "i32");
        assert_eq!(DTypeId::I64.as_str(), "i64");
        assert_eq!(DTypeId::F16.as_str(), "f16");
        assert_eq!(DTypeId::BF16.as_str(), "bf16");
        assert_eq!(DTypeI
```

### Core Architecture Module: `cuda-core/src/error.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! CUDA driver error types and result conversion utilities.

use std::ffi::CStr;
use std::mem::MaybeUninit;
use std::{
    error,
    fmt::{self, Display, Formatter},
};

/// Wrapper around a CUDA driver API error code.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct DriverError(pub cuda_bindings::CUresult);

impl DriverError {
    /// Returns true when the driver cannot JIT the PTX version in a module.
    ///
    /// This usually means the selected CUDA toolkit is newer than the
    /// installed driver. PTX requires direct driver support even when other
    /// parts of the toolkit can use CUDA minor-version compatibility.
    pub fn is_unsupported_ptx_version(&self) -> bool {
        self.0 == cuda_bindings::cudaError_enum_CUDA_ERROR_UNSUPPORTED_PTX_VERSION
    }

    fn _fmt(&self, formatter: &mut Formatter) -> fmt::Result {
        self.fmt_with_loader_error(formatter, cuda_bindings::cuda_driver_load_error())
    }

    /// Reports a driver library that could not be loaded when the code says
    /// so. Takes the loader's cached failure as a parameter so the keying can
    /// be unit-tested on a machine where the driver loads fine.
    ///
    /// Every driver entry point goes through a loader shim that returns
    /// `CUDA_ERROR_NOT_INITIALIZED` when libcuda could not be loaded at all;
    /// `CUDA_ERROR_SHARED_OBJECT_INIT_FAILED` is what the driver itself (and
    /// an earlier shim) reports for the same condition. Both codes are
    /// otherwise opaque, while the loader's message names the library
    /// candidates tried and why they failed, which is the actionable part.
    fn fmt_with_loader_error(
        &self,
        formatter: &mut Formatter,
        load_error: Option<&cuda_bindings::DynLoadError>,
    ) -> fmt::Result {
        if let Some(load_error) = load_error {
            if self.0 == cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_INITIALIZED
                || self.0 == cuda_bindings::cudaError_enum_CUDA_ERROR_SHARED_OBJECT_INIT_FAILED
            {
                return formatter
                    .debug_tuple("DriverError")
                    .field(&self.0)
                    .field(&format!("CUDA driver library unavailable: {load_error}"))
                    .finish();
            }
        }

        let help = "the CUDA driver cannot JIT PTX from the selected toolkit; upgrade the driver \
                    or select a compatible toolkit with CUDA_TOOLKIT_PATH or CUDA_HOME";

        let mut output = formatter.debug_tuple("DriverError");
        output.field(&self.0);
        match self.error_string() {
            Ok(err_str) => {
                output.field(&err_str);
            }
            Err(_) => {
                output.field(&"<Failure when calling cuGetErrorString()>");
            }
        }
        if self.is_unsupported_ptx_version() {
            output.field(&help);
        }
        output.finish()
    }
}

impl Display for DriverError {
    fn fmt(&self, formatter: &mut Formatter) -> fmt::Result {
        self._fmt(formatter)
    }
}

impl std::fmt::Debug for DriverError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter) -> fmt::Result {
        self._fmt(formatter)
    }
}

impl error::Error for DriverError {}

/// Converts a CUDA driver call return value into a `Result`.
pub trait IntoResult<T> {
    /// Returns `Ok` on `CUDA_SUCCESS`, or `Err(DriverError)` otherwise.
    fn result(self) -> Result<T, DriverError>
    where
        Self: Sized;
}

impl IntoResult<()> for cuda_bindings::CUresult {
    fn result(self) -> Result<(), DriverError> {
        match self {
            cuda_bindings::cudaError_enum_CUDA_SUCCESS => Ok(()),
            _ => Err(DriverError(self)),
        }
    }
}

impl<T> IntoResult<T> for (cuda_bindings::CUresult, T) {
    fn result(self) -> Result<T, DriverError> {
        match self.0 {
            cuda_bindings::cudaError_enum_CUDA_SUCCESS => Ok(self.1),
            _ => Err(DriverError(self.0)),
        }
    }
}

impl<T> IntoResult<T> for (cuda_bindings::CUresult, MaybeUninit<T>) {
    fn result(self) -> Result<T, DriverError> {
        match self.0 {
            cuda_bindings::cudaError_enum_CUDA_SUCCESS => Ok(unsafe { self.1.assume_init() }),
            _ => Err(DriverError(self.0)),
        }
    }
}

impl DriverError {
    /// Returns the short error name string for this CUDA error code.
    pub fn error_name(&self) -> Result<&CStr, DriverError> {
        let mut err_str = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuGetErrorName(self.0, err_str.as_mut_ptr()).result()?;
            Ok(CStr::from_ptr(err_str.assume_init()))
        }
    }

    /// Returns the human-readable description string for this CUDA error code.
    pub fn error_string(&self) -> Result<&CStr, DriverError> {
        let mut err_str = MaybeUninit::uninit();
        unsafe {
            cuda_bindings::cuGetErrorString(self.0, err_str.as_mut_ptr()).result()?;
            Ok(CStr::from_ptr(err_str.assume_init()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::DriverError;

    #[test]
    fn identifies_unsupported_ptx_version() {
        let unsupported =
            DriverError(cuda_bindings::cudaError_enum_CUDA_ERROR_UNSUPPORTED_PTX_VERSION);
        let unrelated = DriverError(cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE);

        assert!(unsupported.is_unsupported_ptx_version());
        assert!(!unrelated.is_unsupported_ptx_version());
    }

    const NOT_INITIALIZED: cuda_bindings::CUresult =
        cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_INITIALIZED;
    const SHARED_OBJECT_INIT_FAILED: cuda_bindings::CUresult =
        cuda_bindings::cudaError_enum_CUDA_ERROR_SHARED_OBJECT_INIT_FAILED;

    /// Renders `error` as `Display` would, but with an explicit loader state.
    fn format_with(error: DriverError, load_error: Option<&cuda_bindings::DynLoadError>) -> String {
        struct WithLoader<'a>(DriverError, Option<&'a cuda_bindings::DynLoadError>);
        impl std::fmt::Display for WithLoader<'_> {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.0.fmt_with_loader_error(f, self.1)
            }
        }
        WithLoader(error, load_error).to_string()
    }

    /// The loader shims report an unloadable libcuda as `NOT_INITIALIZED`
    /// (3), so the hint must key on that code as well as on the driver's own
    /// `SHARED_OBJECT_INIT_FAILED` (303), and on nothing else. Runs the real
    /// formatting path with a synthetic loader failure, so it holds on a
    /// machine where the driver loads.
    #[test]
    fn loader_hint_is_attached_to_both_unavailable_driver_codes() {
        let load_error = cuda_bindings::DynLoadError::RuntimeTooOld {
            compile_version: 13030,
            runtime_version: 12040,
        };

        for code in [NOT_INITIALIZED, SHARED_OBJECT_INIT_FAILED] {
            let formatted = format_with(DriverError(code), Some(&load_error));
            assert!(
                formatted.contains("CUDA driver library unavailable"),
                "code {code}: expected the loader hint, got: {formatted}"
            );
            assert!(
                formatted.contains("CUDA driver too old"),
                "code {code}: expected the loader's own message, got: {formatted}"
            );
        }

        // Any other code keeps the plain rendering even while the loader has failed.
        let unrelated = format_with(
            DriverError(cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_VALUE),
            Some(&load_error),
        );
        assert!(
            !unrelated.contains("CUDA driver library unavailable"),
            "an unrelated code must not carry the loader hint, got: {unrelated}"
        );

        // And with a loaded driver the two codes render plainly too.
        for code in [NOT_INITIALIZED, SHARED_OBJECT_INIT_FAILED] {
            let formatted = format_with(DriverError(code), None);
            assert!(
                !formatted.contains("CUDA driver library unavailable"),
                "code {code}: no loader failure, no hint; got: {formatted}"
            );
        }
    }

    /// The end-to-end path, exercised only where the driver really is
    /// unavailable: `Display` picks up the loader's cached failure itself.
    #[test]
    fn display_surfaces_the_real_loader_error_when_driver_is_missing() {
        let Some(load_error) = cuda_bindings::cuda_driver_load_error() else {
            return;
        };
        let expected_detail = match load_error {
            cuda_bindings::DynLoadError::LoadFailed { .. } => "failed to load any of",
            cuda_bindings::DynLoadError::RuntimeTooOld { .. } => "CUDA driver too old",
        };

        for code in [NOT_INITIALIZED, SHARED_OBJECT_INIT_FAILED] {
            let formatted = DriverError(code).to_string();
            assert!(
                formatted.contains("CUDA driver library unavailable"),
                "code {code}: expected a human-readable loader hint, got: {formatted}"
            );
            assert!(
                formatted.contains(expected_detail),
                "code {code}: expected the cached loader failure context, got: {formatted}"
            );
        }
    }
}

```

### Core Architecture Module: `cuda-core/src/lib.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Low-level CUDA driver API bindings and safe wrappers.

#![cfg_attr(feature = "f16", feature(f16))]

mod api;
pub(crate) mod cudarc_shim;
mod dtype;
mod error;
mod runtime;
pub mod simt;
pub mod vmm;

pub use api::*;
pub use cuda_bindings as sys;
pub use dtype::*;
pub use error::*;
pub use runtime::*;

// The cuda-oxide surface, re-exported at the root where its consumers
// expect it. `simt::LaunchConfig` and `simt::vmm` are deliberately absent:
// they collide with this crate's own `LaunchConfig` and with the reviewed
// `vmm` module above (both forks of the same cuda-oxide ancestor), and stay
// reachable only through `simt::`.
pub use simt::embedded;
pub use simt::{
    launch_kernel_cooperative, launch_kernel_cooperative_on_stream, launch_kernel_ex,
    launch_kernel_ex_cooperative, launch_kernel_ex_cooperative_on_stream,
    launch_kernel_ex_on_stream, launch_kernel_on_stream, BlockRequirement, ConstantHandle,
    ContextLimit, CudaContext, CudaEvent, CudaFunction, CudaModule, CudaStream, DeviceBuffer,
    DeviceCopy, DeviceLaunchLimits, DynamicSharedMemoryRequirement, EmbeddedModule,
    EmbeddedModuleError, KernelLaunchConfig, KernelLaunchContract, LaunchAxis, LaunchConfig1D,
    LaunchConfig2D, LaunchConfig3D, LaunchContractError, LaunchContractSpec, LaunchDimension,
    PinnedHostBuffer, PreparedLaunch, StreamPriorityRange, SyncPolicy,
};

```

### Core Architecture Module: `cuda-core/src/runtime.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! CUDA runtime types: Device, Stream, Module, Function, LaunchConfig.
//!
//! These are the public API of `cuda-core`. They wrap raw CUDA driver
//! handles with RAII lifetimes and provide `borrow_raw` constructors
//! for interop with external frameworks (cudarc, etc.).

use std::ffi::{c_int, c_void, CString};
use std::sync::Arc;

use crate::cudarc_shim::{ctx, device, module, pool, primary_ctx, stream};
use crate::error::*;
use crate::init;

/// Kernel launch configuration specifying grid, block, and shared memory sizes.
#[derive(Clone, Copy, Debug)]
pub struct LaunchConfig {
    /// Grid dimensions `(x, y, z)` in thread blocks.
    pub grid_dim: (u32, u32, u32),
    /// Block dimensions `(x, y, z)` in threads.
    pub block_dim: (u32, u32, u32),
    /// Bytes of dynamic shared memory per block.
    pub shared_mem_bytes: u32,
}

/// Anything that owns an external CUDA resource. A borrowed handle can hold an
/// `Arc<dyn ForeignOwner>` as a *liveness token*: while the handle (and anything
/// derived from it) is alive, the token's refcount is nonzero, so the external
/// owner cannot be dropped — and the resource it backs cannot be destroyed —
/// out from under cutile. Blanket-implemented, so any `Arc<T>` erases to
/// `Arc<dyn ForeignOwner>`.
pub trait ForeignOwner: Send + Sync + 'static {}
impl<T: Send + Sync + 'static> ForeignOwner for T {}

/// Optional liveness token held by a borrowed handle (see [`ForeignOwner`]).
///
/// Compares equal regardless of contents (the token is an ownership detail, not
/// part of a handle's identity) and prints opaquely, so the handle types keep
/// their `Debug`/`PartialEq`/`Eq` derives.
#[derive(Clone, Default)]
pub struct KeepAlive(Option<Arc<dyn ForeignOwner>>);

impl KeepAlive {
    /// A token holding nothing (owned or raw-borrowed handles).
    pub fn none() -> Self {
        Self(None)
    }
    /// A token keeping `owner` alive for the handle's lifetime.
    pub fn owner(owner: Arc<dyn ForeignOwner>) -> Self {
        Self(Some(owner))
    }
}

impl std::fmt::Debug for KeepAlive {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(if self.0.is_some() {
            "KeepAlive(owner)"
        } else {
            "KeepAlive(none)"
        })
    }
}

impl PartialEq for KeepAlive {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}
impl Eq for KeepAlive {}

/// A GPU device handle wrapping a CUDA primary context.
///
/// Can be **owned** (created via [`Device::new`], releases the primary context
/// on drop), **borrowed** (created via [`Device::borrow_raw`], does NOT release
/// on drop), or **foreign** (created via [`Device::borrow_with_owner`], holds a
/// liveness token so the external owner outlives it).
#[derive(Debug)]
pub struct Device {
    pub(crate) cu_device: cuda_bindings::CUdevice,
    pub(crate) cu_ctx: cuda_bindings::CUcontext,
    pub(crate) ordinal: usize,
    owned: bool,
    _keep_alive: KeepAlive,
}

unsafe impl Send for Device {}
unsafe impl Sync for Device {}

impl Drop for Device {
    fn drop(&mut self) {
        if !self.owned {
            return;
        }
        let _guard = teardown_lock();
        // Streams hold an Arc<Device>, so by the time the last device handle
        // for this ordinal drops, every pooled handle is idle; the context
        // release below reclaims them. Discard so a later re-retain cannot
        // pop a handle from a torn-down context.
        stream_pool()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&self.ordinal);
        let _ = self.bind_to_thread();
        let ctx = std::mem::replace(&mut self.cu_ctx, std::ptr::null_mut());
        if !ctx.is_null() {
            let _ = unsafe { primary_ctx::release(self.cu_device) };
        }
    }
}

impl PartialEq for Device {
    fn eq(&self, other: &Self) -> bool {
        self.cu_device == other.cu_device
            && self.cu_ctx == other.cu_ctx
            && self.ordinal == other.ordinal
    }
}
impl Eq for Device {}

/// The driver indexes devices with a C `int`. An ordinal that does not fit is
/// not a device at all; `as c_int` would wrap it onto some other device's
/// index, so it is rejected up front with `CUDA_ERROR_INVALID_DEVICE`.
fn ordinal_to_c_int(ordinal: usize) -> Result<c_int, DriverError> {
    c_int::try_from(ordinal)
        .map_err(|_| DriverError(cuda_bindings::cudaError_enum_CUDA_ERROR_INVALID_DEVICE))
}

impl Device {
    /// Creates a new owned device on the specified ordinal.
    ///
    /// Errors with `CUDA_ERROR_INVALID_DEVICE` (before touching the driver)
    /// when `ordinal` does not fit the driver's `int` ordinal type.
    pub fn new(ordinal: usize) -> Result<Arc<Self>, DriverError> {
        let cu_ordinal = ordinal_to_c_int(ordinal)?;
        unsafe { init(0)? };
        let cu_device = device::get(cu_ordinal)?;
        let cu_ctx = unsafe { primary_ctx::retain(cu_device) }?;
        let device = Arc::new(Device {
            cu_device,
            cu_ctx,
            ordinal,
            owned: true,
            _keep_alive: KeepAlive::none(),
        });
        device.bind_to_thread()?;
        Ok(device)
    }

    /// Wraps externally-owned CUDA handles without taking ownership.
    ///
    /// Inputs are the raw C primitives (`CUcontext` is an opaque pointer,
    /// `CUdevice` is `int` in the driver API). Accepting primitives rather
    /// than `cuda_bindings::CU*` typedefs keeps this API agnostic to which
    /// binding crate the caller uses — a cudarc `CUcontext`, a fresh
    /// `bindgen` wrapper, or a hand-rolled FFI type all cast in the same way.
    ///
    /// # Safety
    ///
    /// The caller must ensure:
    /// - `cu_ctx` points to a valid retained `CUcontext` for `cu_device`
    /// - The handles outlive the returned `Device` **and everything derived
    ///   from it**. Streams from [`new_stream`](Self::new_stream) hold the
    ///   device alive and, because the device is borrowed, are never parked in
    ///   the process-wide stream pool: each is synchronized and destroyed
    ///   against `cu_ctx` when it drops (see [`Stream`]). `cu_ctx` must
    ///   therefore still be valid when the last such stream drops.
    /// - No concurrent destruction of the handles
    pub unsafe fn borrow_raw(cu_ctx: *mut c_void, cu_device: c_int, ordinal: usize) -> Arc<Self> {
        Arc::new(Device {
            cu_device: cu_device as cuda_bindings::CUdevice,
            cu_ctx: cu_ctx as cuda_bindings::CUcontext,
            ordinal,
            owned: false,
            _keep_alive: KeepAlive::none(),
        })
    }

    /// Wraps externally-owned CUDA handles, holding `owner` alive for the
    /// returned device's lifetime.
    ///
    /// Same as [`borrow_raw`](Self::borrow_raw), but the liveness obligation is
    /// discharged by construction: `owner` is whatever owns the context (a
    /// cudarc device, a torch context handle, ...), and holding it here
    /// guarantees the handles stay valid as long as this `Device` — or anything
    /// derived from it — lives. Only the point-in-time validity of the handles
    /// remains a caller assertion.
    ///
    /// # Safety
    /// The caller must ensure, *at construction*, that:
    /// - `cu_ctx` points to a valid retained `CUcontext` for `cu_device`, and
    /// - dropping `owner` would release those handles (i.e. `owner` really is
    ///   what keeps them alive).
    pub unsafe fn borrow_with_owner(
        cu_ctx: *mut c_void,
        cu_device: c_int,
        ordinal: usize,
        owner: Arc<dyn ForeignOwner>,
    ) -> Arc<Self> {
        Arc::new(Device {
            cu_device: cu_device as cuda_bindings::CUdevice,
            cu_ctx: cu_ctx as cuda_bindings::CUcontext,
            ordinal,
            owned: false,
            _keep_alive: KeepAlive::owner(owner),
        })
    }

    /// Returns the number of CUDA-capable devices available.
    pub fn device_count() -> Result<i32, DriverError> {
        unsafe { init(0)? };
        device::get_count()
    }

    /// Returns the raw `CUdevice` handle for a given ordinal without
    /// creating a full `Device` (no context retained). Rejects an ordinal
    /// that does not fit `c_int` like [`new`](Self::new) does.
    pub fn raw_device(ordinal: usize) -> Result<cuda_bindings::CUdevice, DriverError> {
        let cu_ordinal = ordinal_to_c_int(ordinal)?;
        unsafe { init(0)? };
        device::get(cu_ordinal)
    }

    /// Get the `ordinal` index of the device this is on.
    pub fn ordinal(&self) -> usize {
        self.ordinal
    }

    /// Get the name of this device.
    pub fn name(&self) -> Result<String, DriverError> {
        device::get_name(self.cu_device)
    }

    /// Returns the raw `CUdevice` handle.
    pub fn cu_device(&self) -> cuda_bindings::CUdevice {
        self.cu_device
    }

    /// Returns the raw `CUcontext` handle.
    pub fn cu_ctx(&self) -> cuda_bindings::CUcontext {
        self.cu_ctx
    }

    /// Binds this context to the calling thread if not already current.
    pub fn bind_to_thread(&self) -> Result<(), DriverError> {
        if match ctx::get_current()? {
            Some(curr_ctx) => curr_ctx != self.cu_ctx,
            None => true,
        } {
            unsafe { ctx::set_current(self.cu_ctx) }?;
        }
        Ok(())
    }

    /// Blocks until all work on this device's context is complete.
    ///
    /// # Safety
    /// The caller must ensure this device's context is current on the
    /// calling thread (via [`bind_to_thread`](Device::bind_to_thread)).
    pub unsafe fn synchronize(&self) -> Result<(), DriverError> {
        ctx::synchronize()
    }

    /// Creates a new non-blocking CUDA stream on this device.
    ///
    /// On an owned device the handle may be one parked by an earli
```

### Core Architecture Module: `cuda-core/src/simt/context.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! CUDA context management (primary context, RAII).
//!
//! [`CudaContext`] retains the **primary context** for a given device ordinal
//! via `cuDevicePrimaryCtxRetain` and releases it on [`Drop`]. The primary
//! context is shared across the process; multiple `CudaContext` instances for
//! the same device share the same underlying `CUcontext`.
//!
//! # Thread binding
//!
//! CUDA driver calls are context-scoped and thread-local. [`CudaContext`]
//! transparently calls `cuCtxSetCurrent` before any driver operation, so
//! callers do not need to manage the context stack manually.

use crate::error::{DriverError, IntoResult};
use crate::simt::launch::DeviceLaunchLimits;
use crate::simt::stream::CudaStream;
use std::ffi::c_int;
use std::mem::MaybeUninit;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::Arc;

/// Owns a reference to a CUDA device's primary context.
///
/// Created via [`CudaContext::new`] and typically held in an `Arc` so streams,
/// events, and modules can share the same context. Dropping the last reference
/// releases the primary context (`cuDevicePrimaryCtxRelease`).
///
/// Tracks live stream count and accumulated error state atomically for
/// cross-thread diagnostics.
#[derive(Debug)]
pub struct CudaContext {
    /// Raw CUDA device handle (`CUdevice`).
    pub(crate) cu_device: cuda_bindings::CUdevice,
    /// Raw CUDA context handle (`CUcontext`). Set to null on drop.
    pub(crate) cu_ctx: cuda_bindings::CUcontext,
    /// Zero-based device ordinal passed to [`CudaContext::new`].
    pub(crate) ordinal: usize,
    /// Number of live [`CudaStream`] instances sharing this context.
    pub(crate) num_streams: AtomicUsize,
    /// When `true`, the first [`new_stream`](CudaContext::new_stream) call
    /// synchronizes the context to establish a clean ordering baseline.
    pub(crate) event_tracking: AtomicBool,
    /// Sticky error state recorded by [`record_err`](CudaContext::record_err).
    /// Stores the raw `CUresult` value, or `0` if no error.
    pub(crate) error_state: AtomicU32,
}

/// # Safety
///
/// `CUdevice` and `CUcontext` are process-wide handles. All mutable state
/// (`num_streams`, `event_tracking`, `error_state`) uses atomics. The CUDA
/// driver itself is thread-safe for distinct contexts, and the
/// [`bind_to_thread`](CudaContext::bind_to_thread) mechanism ensures the
/// correct context is current before each call.
unsafe impl Send for CudaContext {}
/// See [`Send`] impl.
unsafe impl Sync for CudaContext {}

/// Releases the primary context on drop.
///
/// Binds the context to the current thread first (required by
/// `cuDevicePrimaryCtxRelease`). Errors during teardown are recorded via
/// [`record_err`](CudaContext::record_err) rather than panicking.
impl Drop for CudaContext {
    fn drop(&mut self) {
        self.record_err(self.bind_to_thread());
        let ctx = std::mem::replace(&mut self.cu_ctx, std::ptr::null_mut());
        if !ctx.is_null() {
            self.record_err(unsafe {
                cuda_bindings::cuDevicePrimaryCtxRelease_v2(self.cu_device).result()
            });
        }
    }
}

/// Equality is based on device handle, context handle, and ordinal.
impl PartialEq for CudaContext {
    fn eq(&self, other: &Self) -> bool {
        self.cu_device == other.cu_device
            && self.cu_ctx == other.cu_ctx
            && self.ordinal == other.ordinal
    }
}
impl Eq for CudaContext {}

/// The device's meaningful stream priorities, from
/// [`CudaContext::stream_priority_range`].
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
    /// [`CudaContext::new_stream_with_priority`] ahead of the call.
    pub fn clamp(&self, priority: i32) -> i32 {
        priority.clamp(self.greatest, self.least)
    }
}

/// A per-context device limit (`CU_LIMIT_*`), read with
/// [`CudaContext::limit`] and written with [`CudaContext::set_limit`].
///
/// Every limit is state on the device's **primary** context, so it is shared
/// by every [`CudaContext`] for that device, by any runtime-API user of the
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
    /// 
```

### Core Architecture Module: `cuda-core/src/simt/device_buffer.rs`
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
//! Ordinary drop synchronizes the context before freeing an asynchronous
//! allocation, because safe operations may have submitted work using the
//! buffer on any stream in that context. The unsafe
//! [`DeviceBuffer::drop_async`] avoids that host-side synchronization by
//! freeing on a chosen stream; its caller takes over the obligation to
//! order every other stream that uses the buffer before that stream.
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

use cuda_bindings::CUdeviceptr;

use crate::error::DriverError;
use crate::simt::context::CudaContext;
use crate::simt::pinned_host_buffer::PinnedHostBuffer;
use crate::simt::stream::CudaStream;

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
/// Implementors must be safe to duplicate with a byte-for-byte copy. Values
/// copied back from device memory must have a bit pattern that is valid for
/// `Self`, and the all-zero bit pattern must also be valid because
/// [`DeviceBuffer::zeroed`] initializes memory with zero bytes.
///
/// `Copy` alone is not enough: types such as `bool`, `char`, and
/// `NonZeroU32` are `Copy`, but not every byte pattern is a valid value of
/// those types. `DeviceCopy` is the stronger promise required when
/// `DeviceBuffer` turns raw device bytes back into initialized Rust values.
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

/// Owning handle to a contiguous device allocation of `T` elements.
///
/// Holds a raw device pointer, element count, and a reference-counted
/// context that keeps the CUDA context alive. Synchronous allocations are
/// freed with `cuMemFree`. Dropping a stream-ordered allocation synchronizes
/// its context before enqueueing `cuMemFreeAsync` on its retained allocation
/// stream. Use the unsafe [`DeviceBuffer::drop_async`] when the caller can
/// provide explicit stream ordering and must avoid that context-wide
/// synchronization.
///
/// Device buffers may only transfer plain device-copyable values. Owning host
/// types such as [`String`] are rejected because copying their bytes to and
/// from device memory would not preserve Rust ownership invariants.
///
/// ```compile_fail
/// # use cuda_core::{CudaStream, DeviceBuffer};
/// # fn rejects_non_device_copy(stream: &CudaStream) {
/// let _ = DeviceBuffer::<String>::zeroed(stream, 1);
/// # }
/// ```
pub struct DeviceBuffer<T> {
    ptr: CUdeviceptr,
    len: usize,
    num_bytes: usize,
    ctx: Arc<CudaContext>,
    /// Retains the allocation stream for a stream-ordered (`cuMemAllocAsync`)
    /// allocation. Ordinary `Drop` first synchronizes the context so work
    /// submitted on any stream has completed, then frees on this stream.
    /// `None` identifies a synchronous (`cuMemAlloc`) allocation.
    dealloc_stream: Option<Arc<CudaStream>>,
    _marker: PhantomData<T>,
}

// SAFETY: CUdeviceptr is a u64 handle valid across threads when the owning
// context is bound. The PhantomData<T> is Send if T is Send.
unsafe impl<T: Send> Send for DeviceBuffer<T> {}
// SAFETY: &DeviceBuffer only exposes cu_deviceptr() and len(), both of which
// return Copy values. No interior mutability.
unsafe impl<T: Send + Sync> Sync for DeviceBuffer<T> {}

impl<T> Drop for DeviceBuffer<T> {
    fn drop(&mut self) {
        if self.ptr != 0 {
            self.ctx.record_err(self.ctx.bind_to_thread());
            // Safe buffer operations can enqueue work on any stream in this
            // context. Synchronize all of them before implicitly freeing a
            // stream-ordered allocation.
            let result = match &self.dealloc_stream {
                Some(stream) => match self.ctx.synchronize() {
                    Ok(()) => unsafe {
                        crate::simt::memory::free_async(self.ptr, stream.cu_stream())
                    },
                    Err(error) => Err(error),
                },
                None => unsafe { crate::simt::memory::free_sync(self.ptr) },
            };
            self.ctx.record_err(result);
        }
    }
}

impl<T> DeviceBuffer<T> {
    /// Returns the raw `CUdeviceptr` for use in kernel argument lists.
    #[inline]
    pub fn cu_deviceptr(&self) -> CUdeviceptr {
        self.ptr
    }

    /// Number of `T` elements in the buffer.
    #[inline]
    pub fn len(&self) -> usize {
        self.len
    }

    /// Returns `true` if the buffer has zero elements.
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Total size in bytes (`len * size_of::<T>()`).
    #[inline]
    pub fn num_bytes(&self) -> usize {
        self.num_bytes
    }

    /// Returns a reference to the owning context.
    #[inline]
    pub fn context(&self) -> &Arc<CudaContext> {
        &self.ctx
    }

    /// Constructs a `DeviceBuffer` from pre-existing raw parts.
    ///
    /// # Safety
    ///
    /// - `ptr` must have been allocated via `cuMemAlloc*` with at least
    ///   `len * size_of::<T>()` bytes.
    /// - `ptr` must belong to the same CUDA context as `ctx`.
    /// - The caller transfers ownership -- `ptr` will be freed on drop.
    /// - `ptr` is assumed to be a synchronous (`cuMemAlloc`) allocation and is
    ///   freed with the synchronous `cuMemFree` on drop. Do not pass a
    ///   stream-ordered (`cuMemAllocAsync`) pointer here.
    ///
    /// # Panics
    ///
    /// Panics if `len * size_of::<T>()` overflows `usize`.
    pub unsafe fn from_raw_parts(ptr: CUdeviceptr, len: usize, ctx: Arc<CudaContext>) -> Self {
        // SAFETY: `from_raw_parts` has the same raw-allocation safety contract,
        // with no stream-ordered deallocation metadata attached.
        unsafe { Self::from_raw_parts_with_dealloc_stream(ptr, len, ctx, None) }
    }

    unsafe fn from_raw_parts_with_dealloc_stream(
        ptr: CUdeviceptr,
        len: usize,
        ctx: Arc<CudaContext>,
        dealloc_stream: Option<Arc<CudaStream>>,
    ) -> Self {
        let num_bytes =
            allocation_size::<T>(len).expect("DeviceBuffer::from_raw_parts byte size overflow");
        Self {
            ptr,
            len,
            num_bytes,
            ctx,
            dealloc_stream,
            _marker: PhantomData,
        }
    }

    /// Consumes the buffer and returns the raw parts without freeing.
    ///
    /// The caller is responsible for eventually freeing `ptr` with the
    /// allocator that matches how it was created. For stream-ordered
    /// allocations, this does not return the stored deallocation stream; the
    /// caller must already know which stream to use for `cuMemFreeAsync`.
    pub fn into_raw_parts(self) -> (CUdeviceptr, usize, Arc<CudaContext>) {
        let (ptr, len, ctx, _dealloc_stream) = self.into_all_raw_parts();
        (ptr, len, ctx)
    }

    fn into_all_raw_parts(
        self,
    ) -> (
        CUdeviceptr,
        usize,
        Arc<CudaContext>,
        Option<Arc<CudaStream>>,
    ) {
        // Suppress the buffer's `Drop` (which would free `ptr`) while still
        // moving out the heap-owned fields. Callers that do not need
        // `dealloc_stream` can drop it after this helper returns.
        let this = std::mem::ManuallyDrop::new(self);
        let ptr = this.pt
```

### Core Architecture Module: `cuda-core/src/simt/embedded.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! Loading CUDA modules from embedded device artifact bundles.

use crate::{CudaContext, CudaModule, DriverError};
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

    pub fn load(&self, ctx: &Arc<CudaContext>) -> Result<Arc<CudaModule>, EmbeddedModuleError> {
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
    ctx: &Arc<CudaContext>,
    name: &str,
) -> Result<Arc<CudaModule>, EmbeddedModuleError> {
    let module = embedded_modules_from_current_exe()?
        .into_iter()
        .find(|module| module.name() == name)
        .ok_or_else(|| EmbeddedModuleError::ModuleNotFound {
            name: name.to_string(),
        })?;
    module.load(ctx)
}

pub fn load_first_embedded_module(
    ctx: &Arc<CudaContext>,
) -> Result<Arc<CudaModule>, EmbeddedModuleError> {
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

### Core Architecture Module: `cuda-core/src/simt/event.rs`
```
/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//! CUDA event management (RAII, timing, synchronization).
//!
//! A [`CudaEvent`] wraps a `CUevent` handle and ties its lifetime to its
//! parent [`CudaContext`]. Events are the fundamental synchronization
//! primitive between CUDA streams: record an event on one stream, then wait
//! on it from another to establish ordering.
//!
//! # Timing
//!
//! By default, events are created with `CU_EVENT_DISABLE_TIMING` for lower
//! overhead. Pass `Some(CU_EVENT_DEFAULT)` to
//! [`CudaContext::new_event`] or [`CudaStream::record_event`] if you
//! need [`elapsed_ms`](CudaEvent::elapsed_ms).

use crate::error::{DriverError, IntoResult};
use crate::simt::context::CudaContext;
use crate::simt::stream::CudaStream;
use std::mem::MaybeUninit;
use std::sync::Arc;

/// An RAII wrapper around a `CUevent` handle.
///
/// Holds an `Arc<CudaContext>` to ensure the context outlives the event.
/// Destroyed automatically via `cuEventDestroy` on [`Drop`].
#[derive(Debug)]
pub struct CudaEvent {
    /// Raw CUDA event handle.
    pub(crate) cu_event: cuda_bindings::CUevent,
    /// Owning context. Kept alive for the lifetime of this event.
    pub(crate) ctx: Arc<CudaContext>,
}

/// # Safety
///
/// `CUevent` handles are not thread-local. The CUDA driver permits recording
/// and waiting on events from any thread, provided the owning context is bound.
unsafe impl Send for CudaEvent {}
/// See [`Send`] impl.
unsafe impl Sync for CudaEvent {}

/// Destroys the underlying `CUevent` on drop.
///
/// Binds the context to the current thread first (required by
/// `cuEventDestroy`). Errors are recorded on the context rather than
/// panicking.
impl Drop for CudaEvent {
    fn drop(&mut self) {
        self.ctx.record_err(self.ctx.bind_to_thread());
        self.ctx
            .record_err(unsafe { cuda_bindings::cuEventDestroy_v2(self.cu_event).result() });
    }
}

impl CudaContext {
    /// Creates a new CUDA event in this context.
    ///
    /// `flags` defaults to `CU_EVENT_DISABLE_TIMING` when `None`. Use
    /// `Some(CU_EVENT_DEFAULT)` to enable timing queries via
    /// [`CudaEvent::elapsed_ms`].
    pub fn new_event(
        self: &Arc<Self>,
        flags: Option<cuda_bindings::CUevent_flags>,
    ) -> Result<CudaEvent, DriverError> {
        let flags = flags.unwrap_or(cuda_bindings::CUevent_flags_enum_CU_EVENT_DISABLE_TIMING);
        self.bind_to_thread()?;
        let mut cu_event = MaybeUninit::uninit();
        let cu_event = unsafe {
            cuda_bindings::cuEventCreate(cu_event.as_mut_ptr(), flags).result()?;
            cu_event.assume_init()
        };
        Ok(CudaEvent {
            cu_event,
            ctx: self.clone(),
        })
    }
}

impl CudaEvent {
    /// Returns the raw `CUevent` handle.
    pub fn cu_event(&self) -> cuda_bindings::CUevent {
        self.cu_event
    }

    /// Returns the parent [`CudaContext`].
    pub fn context(&self) -> &Arc<CudaContext> {
        &self.ctx
    }

    /// Records this event on `stream`.
    ///
    /// The event captures the point in the stream's work queue at the time of
    /// the call. A subsequent [`CudaStream::wait`] on this event will block
    /// the waiting stream until all work prior to the record point completes.
    pub fn record(&self, stream: &CudaStream) -> Result<(), DriverError> {
        self.ctx.bind_to_thread()?;
        unsafe { cuda_bindings::cuEventRecord(self.cu_event, stream.cu_stream()).result() }
    }

    /// Blocks the calling thread until this event has been recorded and all
    /// preceding stream work has completed.
    pub fn synchronize(&self) -> Result<(), DriverError> {
        self.ctx.bind_to_thread()?;
        unsafe { cuda_bindings::cuEventSynchronize(self.cu_event).result() }
    }

    /// Returns `true` when all work captured by this event has completed,
    /// `false` when it is still in flight. Never blocks.
    ///
    /// Wraps `cuEventQuery`, mapping `CUDA_SUCCESS` to `Ok(true)` and
    /// `CUDA_ERROR_NOT_READY` to `Ok(false)`. Any other code is a real
    /// driver error.
    pub fn query(&self) -> Result<bool, DriverError> {
        self.ctx.bind_to_thread()?;
        match unsafe { cuda_bindings::cuEventQuery(self.cu_event) } {
            cuda_bindings::cudaError_enum_CUDA_SUCCESS => Ok(true),
            cuda_bindings::cudaError_enum_CUDA_ERROR_NOT_READY => Ok(false),
            err => Err(DriverError(err)),
        }
    }

    /// Returns the elapsed time in milliseconds between `self` (start) and
    /// `end`.
    ///
    /// Both events are synchronized before querying. Both events must have
    /// been created **without** `CU_EVENT_DISABLE_TIMING`; otherwise the
    /// driver returns `CUDA_ERROR_INVALID_HANDLE`.
    ///
    /// `self` must have been recorded before `end` in wall-clock time.
    pub fn elapsed_ms(&self, end: &Self) -> Result<f32, DriverError> {
        self.synchronize()?;
        end.synchronize()?;
        let mut ms: f32 = 0.0;
        unsafe {
            cuda_bindings::cu_event_elapsed_time(&mut ms as *mut _, self.cu_event, end.cu_event)
                .result()?;
        }
        Ok(ms)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1327** (2026-09-24): **fix(mir-lower): support packed AS3 carrier local projections**
  *Symptoms*: ## What this adds  Packed structs with one direct shared-memory pointer can now use compiler-owned local storage and one direct field projection.  ```text MIR value:     <{ u8, p3 }> local storage: <{ u8, p0 }> store: p3 -> p0    load: p0 -> p3 ```  The complete address-use graph must validate before lowering attaches its private type facts. Whole-value loads/stores, direct field projections and debug uses are supported. Escaping addresses, nested projections and unknown uses fail before conversion. This avoids the operation-history inference used by #1092.  ## Coverage  The GPU example writes through the projected shared pointer and observes the result independently through the original pointer. Maintainer regressions check whole-value conversion directions, preexisting private facts, address escape and nested projections.  Verified at `e92236ef`:  - 450 mir-lower unit/lowering tests, strict Clippy and formatting passed. - B200: `packed_aggregate_abi` passed LLVM NVPTX/SM100a execution, memcheck and synccheck. - A separate narrow mutable-local probe passed LLVM NVPTX and modern libNVVM with full device debug, retaining the local slot. Both passed memcheck; LLVM also passed synccheck. - The narrow probe also passed normal modern libNVVM/SM100a and legacy libNVVM/SM90 builds under memcheck. All sanitizer runs reported 0 errors.  At `e92236ef`, hosted tests, lint/format checks, guards, docs/book and example compilation passed. CodeQL was still running at the final review check.

- **Issue #1326** (2026-09-24): **fix(cuda-host): handle Btrfs mapped file identities**
  *Symptoms*: ## What this fixes  CUDA module loading can reject a valid loaded image on Btrfs because `stat` and procfs report different device identities. Compare both the loaded image and opened file through procfs before reading artifact bytes.  ## Details  - Preserve device and inode checks using a temporary, non-readable mapping of the opened file. - Compare native `map_files` paths to distinguish equal inode numbers in different subvolumes. - Keep artifact reads on the verified file descriptor and reject replaced or deleted images.  ## Verification  All seven hosted validation workflows passed at `c08a986f`, including example compilation and CodeQL.  - 110 cuda-host tests/doctests passed, including renamed/replaced libraries and simulated inode collisions. - Strict Clippy and formatting passed. - Local validation used ext4; direct Btrfs validation remains untested here.  Fixes #1325. 

- **Issue #1322** (2026-09-24): **fix(cuda-host): renumber debug file indices when merging PTX bundles**
  *Symptoms*: ## What this fixes  Merging debug or lineinfo PTX bundles repeats module-local `.file` indices and causes ptxas to reject the output. Each appended bundle now continues after the highest index already used.  ```text before: .file 1 + .file 1 -> duplicate index  after: .file 1 + .file 2 -> distinct indices ```  ## Details  - Shift `.file`, `.loc` and `inlined_at` indices together while removing repeated module headers. - Preserve the first bundle's indices and leave bundles without debug information unchanged. - Parse complete tokens so comments, paths and labels remain intact; reject malformed indices and arithmetic overflow.  ## Verification  At `a50ccff5`, hosted tests, lint/format checks, guards, docs/book and example compilation passed. CodeQL was still running at the final review check.  - 112 cuda-host tests/doctests passed, including three-bundle, comment, malformed-index and overflow regressions. - Strict Clippy and formatting passed. - CUDA 13.4 ptxas assembled debug bundles merged through the public API in both orders for sm_100.  Fixes #1292. 

- **Issue #1314** (2026-09-23): **fix(dialect-mir): fold shifts whose amount has a different width**
  *Symptoms*: ## What this fixes  Constant folding now accepts shifts whose count has a different integer width from the shifted value. This fixes a compiler crash in ordinary Rust code such as `u32 << usize` after loop unrolling.  ```rust let mut bits = 0u32; let mut i = 0usize; #[unroll] while i < 4 {     bits |= 1u32 << (2 * i);     i += 1; } ```  ```text before: compiler panic — APInt::shl bitwidth mismatch (32 vs 64) after:  compilation succeeds; bits == 85 ```  The folder checks the complete count before converting it to the value's width. Large counts therefore cannot lose their high bits and accidentally become valid shifts. Right-shift signedness and result types still come from the shifted value.  ## What we added  - Kept @midagedev's implementation and original regression cases. - Added exact result-type checks, correctly typed test operands, and coverage for 128-bit values, negative counts and counts with bits above 64. - Added a regression to `unroll_smoke` covering wider and narrower counts, left shifts, and arithmetic/logical right shifts. - Rebased onto current main and signed both commits, preserving contributor authorship and DCO credit.  ## Verification  Checked at `b024b5fd`:  - `just check`: 5,426 tests/doctests pass, along with formatting, strict Clippy, guards, generated-intrinsic checks and warning-denied docs. Strict Clippy also passes for the changed example. - Independent review: 378,720 value/type checks, 40,590 invalid-count checks and 900 nonconstant controls 

- **Issue #1313** (2026-09-23): **fix(cuda-device): normalize cooperative group match masks**
  *Symptoms*: ## What this fixes  Typed cooperative-group match operations now return bits in group-rank order, matching typed ballot masks.  ```text second WarpTile<16>, four equal values: 0x000f0000 -> 0x0000000f sparse lanes {0,3,7,20,31}, all equal:   0x80100089 -> 0x0000001f ```  ## What we fixed  - Shift contiguous tile masks by the tile base; preserve the full-warp fast path. - Reuse the existing sparse-lane packing helper for coalesced groups. - Apply the correction to both 32-bit and 64-bit match-any/match-all operations. - Strengthen 64-bit regressions with differences only above bit 32, so accidentally comparing only the low word fails.  ## Migration  Interpret typed masks using `thread_rank()`. Call raw `warp::match_*_sync` when physical lane bits are needed. The repository's existing hash-map consumer uses `WarpTile<32>` and remains unchanged.  ## Verification  Checked at `5cef57a7` against main `66ff93c1`:  - Device tests/doctests, strict device Clippy, formatting, and warnings-denied device rustdoc pass. - Full-warp, both half-warp tiles, even sparse groups, and irregular sparse groups pass on RTX 5090, including positive/negative match-all and high-word-only 64-bit inputs. - The same tests fail with the original implementation. Synccheck reports zero errors. - Independent review found no remaining mask-contract counterexample. All seven hosted workflows pass on this exact head.  Closes #1312. Sub-warp and sparse typed match masks change their documented meaning; raw warp op

- **Issue #1312** (2026-09-23): **cooperative_groups: typed match masks use absolute warp-lane positions**
  *Symptoms*: **Description**   `WarpCollective::match_any` / `match_all` return masks in absolute physical warp-lane positions for sub-warp `WarpTile<N>` groups instead of the group-relative rank space used by the rest of the typed cooperative-groups API. For example, the second `WarpTile<16>` in a warp returns bits 16..31 even though its ranks are 0..15. The same issue also affects sparse `CoalescedThreads` groups, where raw physical lane masks are returned instead of packed group-relative masks.  **Minimal reproducer**   Paste the smallest kernel + host code that triggers the issue.  ```rust use cuda_core::simt::LaunchConfig; use cuda_core::{CudaContext, DeviceBuffer}; use cuda_device::cooperative_groups::{     ThreadGroup, WarpCollective, this_thread_block, }; use cuda_device::{DisjointSlice, kernel, warp}; use cuda_host::cuda_module;  #[cuda_module] mod kernels {     use super::*;      #[kernel]     pub fn match_mask_repro(mut out: DisjointSlice<u32>) {         let lane = warp::lane_id();          let block = this_thread_block();         let tile = block.tiled_partition::<16>();         let rank = tile.thread_rank();          let any = tile.match_any(rank / 4);         let all = tile.match_all(42);          if lane == 0 || lane == 16 {             let base = if lane == 0 { 0 } else { 2 };              unsafe {                 *out.get_unchecked_mut(base) = any;                 *out.get_unchecked_mut(base + 1) = all;             }         }     } }  fn main() {     let ctx = CudaContex

- **Issue #1311** (2026-09-23): **fix(cuda-device): handle partial warps in block collectives**
  *Symptoms*: ## What this fixes  Block reductions and scans now handle a partial final warp without reading nonexistent lanes or unused scratch slots.  ```text 48-thread block: full warp + 16 live lanes -> block sum 48 scratch capacity 32, live warp count 2     -> only two totals are read ```  ## What we fixed  - Kept the full-warp shuffle path and used a live contiguous-prefix mask for the tail. Single-warp blocks avoid a second full-warp collective. - Checked `ceil(block_threads / 32) <= NUM_WARPS` before scratch access. Extra capacity is allowed. - Changed the scratch accesses to raw element reads/writes, avoiding an overlapping mutable borrow of the complete allocation in every thread. - Made `block_reduce` and `block_scan` unsafe and updated all repository callers. An arbitrary raw pointer cannot prove that shared scratch is valid or exclusively assigned to the collective. - Added 77 launch shapes, including every size 1..65, full-warp controls, 1024 threads, multidimensional blocks, two CTAs, and scratch reuse.  ## Call contract  Every thread in the block must call with the same live shared allocation and reach every collective/barrier. Other operations must not access that scratch while the collective runs. Place a block barrier before reusing it.  ## Verification  Checked at `cba13824` against main `66ff93c1`:  - Device tests/doctests, strict device/example Clippy, formatting, and warnings-denied device rustdoc pass. - The 77-shape regression and all existing cooperative-groups ch

- **Issue #1310** (2026-09-23): **cooperative_groups: block_reduce/block_scan mishandle partial final warps**
  *Symptoms*: ## Summary  `block_reduce` and `block_scan` in `cuda_device::cooperative_groups` do not correctly handle thread blocks whose size is not a multiple of the physical warp size.  For example, a 48-thread block contains one full 32-lane warp and one 16-lane final warp. The current implementation partitions the block into `WarpTile<32>` groups and uses the regular full-warp reduction/scan path for every warp. As a result, the final partial warp can execute shuffle collectives with a full `0xffffffff` member mask even though only the low 16 lanes participate.  This violates the shuffle participation contract and can produce incorrect results depending on the GPU / generated code.  There is also a related shared-memory sizing issue: the runtime number of warps is `ceil(block_threads / 32)`, so scratch storage must have capacity for that many warp totals before any `SharedArray` indexing occurs.  ## Reproduction  A minimal reduction kernel is:  ```rust #[kernel] pub fn repro(mut out: DisjointSlice<u32>) {     static mut SMEM: SharedArray<u32, 2> = SharedArray::UNINIT;      let gid = thread::index_1d();     let block = this_thread_block();      let total = block_reduce::<u32, Sum, 2>(&block, 1u32, &raw mut SMEM);      if gid.in_bounds(out.len()) {         unsafe {             *out.get_unchecked_mut(gid.get()) = total;         }     } } ```  Launch it with:  ```text block_dim = (48, 1, 1) grid_dim  = (1, 1, 1) ```  Every thread should receive `48`.  On an RTX 3050 Ti (`sm_86`), I obser

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

### Incident Patch 1: `2182375d` (2026-10-02)
**Commit Message**: fix: make the Nix project template usable in pure mode

Store the project flake in cuda-oxide/nix/templates/default and use that
source directory for both nix flake init and the new-project app. This
avoids reading a generated derivation output during pure template
initialization and keeps both entry points on one template.

Use the canonical repository URL in generated projects and document how
to add the development environment to an existing project.

Signed-off-by: nihalpasham <[REDACTED_EMAIL]>

**File**: `cuda-oxide/cuda-oxide-book/getting-started/installation.md` (modified, +8/-0)
```diff
@@ -95,6 +95,14 @@ this repo's dev shell. The shellHook auto-discovers host NVIDIA driver
 libraries on NixOS and non-NixOS systems; if the host driver is too old,
 update it rather than changing what's inside the Nix shell.
 
+To add the same development environment to an existing project, run inside
+that project:
+
+```bash
+nix flake init -t github:NVIDIA/cuda-rust
+nix develop
+```
+
 If you use the Nix flake, you can skip the manual CUDA, LLVM, Clang, and
 Rust setup sections below.
 
```

**File**: `cuda-oxide/nix/templates/default/flake.nix` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+/*
+  SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+  SPDX-License-Identifier: Apache-2.0
+*/
+
+{
+  description = "A cuda-oxide project";
+
+  inputs = {
+    cuda-oxide.url = "github:NVIDIA/cuda-rust";
+    # Reuse the development shell's inputs to avoid duplicate closures.
+    nixpkgs.follows = "cuda-oxide/nixpkgs";
+    flake-utils.follows = "cuda-oxide/flake-utils";
+  };
+
+  outputs =
+    {
+      cuda-oxide,
+      nixpkgs,
+      flake-utils,
+      ...
+    }:
+    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (
+      system:
+      let
+        pkgs = nixpkgs.legacyPackages.${system};
+      in
+      {
+        devShells.default = pkgs.mkShell {
+          # Inherit CUDA, Rust, and the shellHook that discovers the host driver.
+          inputsFrom = [ cuda-oxide.devShells.${system}.default ];
+          packages = [
+            # add project-specific packages here
+          ];
+        };
+      }
+    );
+}
```

**File**: `flake.nix` (modified, +4/-45)
```diff
@@ -25,50 +25,9 @@
       ...
     }:
     let
-      # Template flake for user projects. Extends cuda-oxide's devShell via
-      # inputsFrom so users can add their own packages while inheriting the full
-      # CUDA + Rust environment (including the shellHook that wires up the host
-      # NVIDIA driver). nixpkgs and flake-utils are followed from cuda-oxide to
-      # avoid duplicate closures.
-      userFlakeContent = ''
-        {
-          description = "A cuda-oxide project";
-
-          inputs = {
-            cuda-oxide.url = "github:NVlabs/cuda-oxide";
-            nixpkgs.follows = "cuda-oxide/nixpkgs";
-            flake-utils.follows = "cuda-oxide/flake-utils";
-          };
-
-          outputs =
-            {
-              cuda-oxide,
-              nixpkgs,
-              flake-utils,
-              ...
-            }:
-            flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (
-              system:
-              let
-                pkgs = nixpkgs.legacyPackages.''${system};
-              in
-              {
-                devShells.default = pkgs.mkShell {
-                  inputsFrom = [ cuda-oxide.devShells.''${system}.default ];
-                  packages = [
-                    # add project-specific packages here
-                  ];
-                };
-              }
-            );
-        }
-      '';
-
-      userFlake = builtins.toFile "flake.nix" userFlakeContent;
-
-      # Directory used by `nix flake init -t github:NVlabs/cuda-oxide`.
-      # Content is system-independent; x86_64-linux is chosen arbitrarily.
-      templateSrc = nixpkgs.legacyPackages.x86_64-linux.writeTextDir "flake.nix" userFlakeContent;
+      # Use the same source-backed template for `nix flake init` and #new.
+      # Template initialization copies this directory without building it.
+      templateSrc = ./cuda-oxide/nix/templates/default;
     in
     (flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (
       system:
@@ -169,7 +128,7 @@
             output=$(cargo-oxide new "$@")
 
             if [ -n "$project" ] && [ -d "$project" ]; then
-              cp ${userFlake} "$project/flake.nix"
+              cp ${templateSrc}/flake.nix "$project/flake.nix"
               chmod +w "$project/flake.nix"
             fi
 
```

---

### Incident Patch 2: `1b9dfead` (2026-10-02)
**Commit Message**: fix: align development tooling with split workspaces

Build cargo-oxide from its nested workspace and nightly in the root Nix
flake, retain sibling host dependencies, and key the dependency cache on
the cuda-oxide lockfile. Link both product workspaces in rust-analyzer.

Resolve the backend toolchain from the selected backend toward its
checkout root so fallback clones do not pick the stable host toolchain.
Cover flat, nested, and split layouts and nearest-pin boundaries.

Signed-off-by: nihalpasham <[REDACTED_EMAIL]>

**File**: `.vscode/settings.json` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@
     // rust-analyzer reports "Failed to load workspaces".
     "rust-analyzer.linkedProjects": [
         "./Cargo.toml",
+        "./cuda-oxide/Cargo.toml",
+        "./cutile-rs/Cargo.toml",
         "./cuda-oxide/crates/rustc-codegen-cuda/Cargo.toml",
         "./cuda-oxide/crates/rustc-codegen-cuda/examples/debug_pointer_locals/Cargo.toml",
         "./cuda-oxide/crates/rustc-codegen-cuda/examples/gemm_sol_final/Cargo.toml",
```

**File**: `cuda-oxide/crates/cargo-oxide/src/backend.rs` (modified, +48/-4)
```diff
@@ -2332,12 +2332,13 @@ mod tests {
         assert!(report.contains("CUDA_OXIDE_BACKEND"), "{report}");
     }
 
-    // A moved dependency must still use the toolchain pin at the repository root.
+    // Both dependency resolution and the fallback main clone must use the
+    // backend's pin, even when the monorepo's host workspace uses stable.
     #[test]
     fn dependency_toolchain_guard_supports_flat_and_nested_checkouts() {
         let rev = "728539f652ba107800fa13d0c31675f6c11aab9c";
         let git_source = format!("git+https://github.com/NVIDIA/cuda-rust.git#{rev}");
-        for nested in [false, true] {
+        for (nested, component_workspace) in [(false, false), (true, false), (true, true)] {
             let root = tempdir();
             std::fs::write(root.join("Cargo.toml"), "[workspace]\n").unwrap();
             std::fs::write(
@@ -2350,6 +2351,20 @@ mod tests {
             } else {
                 root.clone()
             };
+            if component_workspace {
+                std::fs::create_dir_all(&simt_root).unwrap();
+                std::fs::write(simt_root.join("Cargo.toml"), "[workspace]\n").unwrap();
+                std::fs::rename(
+                    root.join("rust-toolchain.toml"),
+                    simt_root.join("rust-toolchain.toml"),
+                )
+                .unwrap();
+                std::fs::write(
+                    root.join("rust-toolchain.toml"),
+                    "[toolchain]\nchannel = \"1.98.0\"\n",
+                )
+                .unwrap();
+            }
             let codegen = simt_root.join(CODEGEN_CRATE_SUBDIR);
             let device = simt_root.join("crates/cuda-device");
             for (directory, name) in [(&codegen, "rustc_codegen_cuda"), (&device, "cuda-device")] {
@@ -2360,10 +2375,32 @@ mod tests {
                 )
                 .unwrap();
             }
-            if nested {
+            if nested && !component_workspace {
                 assert!(!simt_root.join("Cargo.toml").exists());
             }
 
+            // auto_fetch_and_build passes the git root, without dependency
+            // metadata to identify the component workspace first.
+            let fallback_channel = backend_source::pinned_channel(&root);
+            assert_eq!(fallback_channel.as_deref(), Some("nightly-2026-08-28"));
+            assert_eq!(
+                unloadable_backend_report(
+                    "the cuda-oxide main clone",
+                    Some("nightly-2026-08-28-x86_64-unknown-linux-gnu"),
+                    fallback_channel.as_deref(),
+                ),
+                None
+            );
+            assert!(
+                unloadable_backend_report(
+                    "the cuda-oxide main clone",
+                    Some("1.98.0-x86_64-unknown-linux-gnu"),
+                    fallback_channel.as_deref(),
+                )
+                .expect("the stable host toolchain cannot load the nightly backend")
+                .contains("needs Rust `nightly-2026-08-28`")
+            );
+
             for (package_source, marker) in [
                 (None, None),
                 (None, Some(".git")),
@@ -2382,7 +2419,14 @@ mod tests {
                 let resolved = backend_source::dependency_source_from_metadata(&metadata)
                     .unwrap()
                     .unwrap();
-                assert_eq!(resolved.checkout(), root);
+                assert_eq!(
+                    resolved.checkout(),
+                    if component_workspace {
+                        &simt_root
+                    } else {
+                        &root
+                    }
+                );
                 assert_eq!(resolved.codegen_crate(), codegen);
                 assert_eq!(resolved.rev(), package_source.map(|_| rev));
                 let channel = backend_source::pinned_channel(resolved.checkout());
```

**File**: `cuda-oxide/crates/cargo-oxide/src/backend_source.rs` (modified, +75/-5)
```diff
@@ -109,12 +109,28 @@ pub fn short_rev(rev: &str) -> &str {
     rev.get(..10).unwrap_or(rev)
 }
 
-/// The nightly a checkout pins in its `rust-toolchain.toml`, when readable.
+/// The nearest toolchain pin for the selected backend, within its checkout.
+///
+/// A fallback clone names the git root, whose pin may belong to the stable
+/// host workspace. Follow the same backend layout selection as the build,
+/// then walk toward that root so the component's nightly takes precedence.
 pub fn pinned_channel(checkout: &Path) -> Option<String> {
-    let contents = std::fs::read_to_string(checkout.join("rust-toolchain.toml")).ok()?;
-    crate::commands::parse_rust_toolchain_toml(&contents)
-        .ok()
-        .map(|pin| pin.channel)
+    let codegen_crate = codegen_crate_in_checkout(checkout);
+    for directory in codegen_crate.ancestors() {
+        match std::fs::read_to_string(directory.join("rust-toolchain.toml")) {
+            Ok(contents) => {
+                return crate::commands::parse_rust_toolchain_toml(&contents)
+                    .ok()
+                    .map(|pin| pin.channel);
+            }
+            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
+            Err(_) => return None,
+        }
+        if directory == checkout {
+            break;
+        }
+    }
+    None
 }
 
 /// Resolves the cuda-oxide checkout the project in `project_dir` depends on.
@@ -683,6 +699,60 @@ mod tests {
             Some("nightly-2026-08-28".to_string())
         );
         assert_eq!(pinned_channel(&checkout.join("absent")), None);
+        std::fs::remove_dir_all(checkout).unwrap();
+    }
+
+    #[test]
+    fn pinned_channel_follows_the_selected_backend_and_nearest_pin() {
+        let root = tempdir();
+        checkout_with_backend(&root, "cuda-device");
+        std::fs::write(
+            root.join("rust-toolchain.toml"),
+            "[toolchain]\nchannel = \"nightly-2026-04-03\"\n",
+        )
+        .unwrap();
+        let component = root.join("cuda-oxide");
+        std::fs::create_dir_all(&component).unwrap();
+        std::fs::write(
+            component.join("rust-toolchain.toml"),
+            "[toolchain]\nchannel = \"nightly-2026-08-28\"\n",
+        )
+        .unwrap();
+        // A similarly named directory without the selected backend cannot
+        // override the flat checkout's pin.
+        assert_eq!(pinned_channel(&root).as_deref(), Some("nightly-2026-04-03"));
+
+        checkout_with_backend(&component, "cuda-device");
+        assert_eq!(pinned_channel(&root).as_deref(), Some("nightly-2026-08-28"));
+        assert_eq!(pinned_channel(&component), pinned_channel(&root));
+
+        let backend_pin = codegen_crate_in_checkout(&root).join("rust-toolchain.toml");
+        std::fs::write(
+            &backend_pin,
+            "[toolchain]\nchannel = \"nightly-2026-02-01\"\n",
+        )
+        .unwrap();
+        assert_eq!(pinned_channel(&root).as_deref(), Some("nightly-2026-02-01"));
+
+        // An invalid nearer pin is not permission to choose a different
+        // compiler from the parent workspace.
+        std::fs::write(&backend_pin, "[toolchain]\nchannel = [").unwrap();
+        assert_eq!(pinned_channel(&root), None);
+        std::fs::remove_dir_all(root).unwrap();
+    }
+
+    #[test]
+    fn pinned_channel_never_uses_a_pin_outside_the_checkout() {
+        let outer = tempdir();
+        std::fs::write(
+            outer.join("rust-toolchain.toml"),
+            "[toolchain]\nchannel = \"nightly-2026-08-28\"\n",
+        )
+        .unwrap();
+        let checkout = outer.join("checkout");
+        checkout_with_backend(&checkout, "cuda-device");
+        assert_eq!(pinned_channel(&checkout), None);
+        std::fs::remove_dir_all(outer).unwrap();
     }
 
     #[test]
```

**File**: `flake.nix` (modified, +11/-2)
```diff
@@ -85,7 +85,7 @@
         llvmPkgs = pkgs.llvmPackages_22;
 
         # Nightly Rust
-        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
+        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./cuda-oxide/rust-toolchain.toml;
 
         # cuda
         cudaSymlinked = pkgs.symlinkJoin {
@@ -120,8 +120,17 @@
         craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchain;
 
         cargoOxideCommonArgs = {
+          # Keep the shared host crates alongside the Oxide workspace so its
+          # sibling path dependencies remain available during Cargo resolution.
           src = ./.;
-          cargoExtraArgs = "-p cargo-oxide";
+          # Isolate the lockfile so source edits do not invalidate the deps cache.
+          cargoLock = builtins.toFile "Cargo.lock" (builtins.readFile ./cuda-oxide/Cargo.lock);
+          # Both the dependency cache and final package must build from Oxide.
+          # Crane's prePatch hook also installs cargoLock here in the dummy tree.
+          postUnpack = ''
+            sourceRoot="$sourceRoot/cuda-oxide"
+          '';
+          cargoExtraArgs = "--locked -p cargo-oxide";
           doCheck = false;
 
           nativeBuildInputs = [
```

---

### Incident Patch 3: `b546b3a9` (2026-10-01)
**Commit Message**: fix: judge the host workspace with a copy of deny.toml

cargo-deny 0.20 rejects --config after check, and 0.18 only accepts it there. Walk up to a git-root copy of cuda-oxide/deny.toml so the host lock, including cuda-async's loom dev-dependencies, stays under the SIMT policy.

**File**: `.github/workflows/cargo-deny.yml` (modified, +7/-8)
```diff
@@ -8,7 +8,7 @@ name: cargo-deny
 # Four parts of the same concern. `check` enforces the license *policy* over
 # the whole resolved graph from deny.toml, once per `[workspace]` root that
 # resolves third-party crates and is neither an example nor under cutile-rs:
-# the stable host workspace, the cuda-oxide workspace,
+# the stable host workspace, the SIMT workspace,
 # cuda-oxide/crates/rustc-codegen-cuda, and the cuda-macros device-only
 # fixture. Each declares its own `[workspace]`, so each is a
 # separate resolution the others cannot reach. `license-manifest` enforces that
@@ -45,15 +45,14 @@ jobs:
       # re-resolved on the way past. Without it this step rewrites the very
       # Cargo.lock it is judging -- verified: deleting a package block from the
       # lock still exits 0 here and leaves the file rewritten, while --locked
-      # stops with "cannot update the lock file". The other two runs below and
+      # stops with "cannot update the lock file". The other runs below and
       # in cuda-oxide/scripts/ already pass it.
-      # The git root is the host workspace, so walking up never sees
-      # cuda-oxide/deny.toml. `--config` is a `check` subcommand flag on both
-      # cargo-deny 0.18 and 0.19+: it has to follow `check`. This step's working
-      # directory and manifest directory are both the git root, so 0.18
-      # (manifest-relative) and 0.19+ (cwd-relative) resolve the same file.
+      # Host-crate dev-dependencies are a separate resolution (cuda-async's loom
+      # is not in the SIMT graph). The git-root deny.toml is a copy of
+      # cuda-oxide/deny.toml, so this walks up to that policy and does not pass
+      # --config.
       - name: Run cargo-deny over the stable host workspace
-        run: cargo deny --locked check --config cuda-oxide/deny.toml
+        run: cargo deny --manifest-path Cargo.toml --workspace --locked check
 
       # Find deny.toml through a SIMT member; --workspace checks all SIMT members.
       - name: Run cargo-deny over the CUDA Oxide workspace
```

**File**: `cuda-oxide/Justfile` (modified, +5/-6)
```diff
@@ -197,8 +197,8 @@ check-errors:
 # workspace, crates/rustc-codegen-cuda, and the cuda-macros device-only
 # fixture, each of
 # which resolves its own graph because each declares its own `[workspace]`;
-# the license inventory covers what the SIMT workspace and the codegen backend
-# declare; deny.toml holds over the example workspaces; and every first-party
+# the license inventory covers what those workspaces declare; deny.toml holds
+# over the example workspaces; and every first-party
 # source file carries an SPDX header. These were only reachable by reading the
 # workflows, so `just check` could pass while status-guard or cargo-deny
 # failed. Keep this list in step when a guard is added to any of the three
@@ -224,10 +224,9 @@ check-guards:
     bash scripts/check-host-api-paths.sh
     bash scripts/check-shared-crate-pin.sh
     bash scripts/check-oxide-artifacts-parity.sh
-    # Host workspace: deny.toml is not an ancestor of the git root. `--config`
-    # follows `check` so cargo-deny 0.18 and 0.19+ both accept it, and this
-    # line runs at the git root so both versions resolve the same relative path.
-    cd .. && cargo deny --locked check --config cuda-oxide/deny.toml
+    # Host-crate dev-dependencies (cuda-async's loom) are outside the SIMT graph.
+    # The git-root deny.toml is a copy of cuda-oxide/deny.toml.
+    cd .. && cargo deny --manifest-path Cargo.toml --workspace --locked check
     # Find deny.toml through a SIMT member; --workspace checks all SIMT members.
     cargo deny --manifest-path crates/cargo-oxide/Cargo.toml --workspace --locked check
     cargo deny --manifest-path crates/rustc-codegen-cuda/Cargo.toml --locked check
```

**File**: `deny.toml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Copy of cuda-oxide/deny.toml for the git-root host workspace
+# (cuda-bindings, cuda-core, cuda-core-derive, cuda-async). Edit the SIMT
+# file and copy it here. This file is not a second policy.
+#
+# cargo-deny finds deny.toml by walking up from the manifest. It does not
+# look into child directories, so a run on the host workspace never sees
+# cuda-oxide/deny.toml. Passing --config does not fix that for every
+# install: 0.18 accepts the flag only after `check` and resolves the path
+# from the manifest directory, while 0.20 accepts it only before `check`
+# and resolves the path from the working directory.
+#
+# The policy stays in cuda-oxide/deny.toml. That is the file the SIMT,
+# codegen, device-only, and example walks stop at. The root workspace is
+# only the four host crates; the allow-list and the pliron git exception
+# belong to the SIMT tree. A single deny.toml at the git root would make
+# those walks continue upward, and any cutile-rs directory that lacked its
+# own deny.toml would then inherit the Oxide policy. cutile-rs/deny.toml is
+# a separate product policy and must remain the file a walk inside that
+# tree finds first.
+#
+# The host graph is still a separate resolution. Normal and build
+# dependencies of the host crates are also in the SIMT graph, but
+# dev-dependencies are not. cuda-async's loom dev-dependency (generator,
+# cc, tracing, and the rest of that tree) exists only in the root
+# Cargo.lock, and only this file lets `cargo deny --locked` judge that lock.
+
+[advisories]
+version = 2
+
+[licenses]
+version = 2
+allow = [
+    "MIT",
+    "Apache-2.0",
+    "Apache-2.0 WITH LLVM-exception",
+    "BSD-2-Clause",
+    "BSD-3-Clause",
+    "ISC",
+    "Unicode-3.0",
+    "Zlib",
+]
+confidence-threshold = 0.8
+
+[bans]
+multiple-versions = "warn"
+wildcards = "allow"
+
+[sources]
+unknown-registry = "deny"
+unknown-git = "deny"
+allow-registry = ["https://github.com/rust-lang/crates.io-index"]
+allow-git = ["https://github.com/pliron-org/pliron"]
```

---

### Incident Patch 4: `15d3da15` (2026-10-02)
**Commit Message**: fix: pin stable Rust at the git root

Host-crate CI runs cargo from the repository root, and rustup had no
toolchain to select after the Oxide nightly moved under cuda-oxide/.
Example locks that still named the crates.io host crates failed --locked.

The host clippy line is one YAML scalar, so cargo does not see a leading
space on --all-targets. cuda-core's f16 feature stays on the nightly
reactor job. Each rebuilt example lock names that example. Third-party
crates stay at the versions the manifests already resolved, and the
in-tree host and cutile crates stay path dependencies at 0.4.0.

**File**: `.github/workflows/cutile-rs.yml` (modified, +7/-3)
```diff
@@ -62,6 +62,7 @@ jobs:
               - 'cuda-async/**'
               - 'Cargo.toml'
               - 'Cargo.lock'
+              - 'rust-toolchain.toml'
               - '.github/workflows/cutile-rs.yml'
               - '.github/copy-pr-bot.yaml'
 
@@ -158,8 +159,10 @@ jobs:
 
       - name: Clippy (host crates)
         working-directory: ${{ github.workspace }}
-        run: cargo clippy -p cuda-bindings -p cuda-core -p cuda-core-derive -p cuda-async \
-            --all-targets --all-features
+        # One line: a plain YAML scalar turns `\` into a literal backslash, so
+        # cargo saw ` --all-targets` as one argument. Skip --all-features here;
+        # cuda-core's f16 feature is nightly-only and reactor-verification covers it.
+        run: cargo clippy -p cuda-bindings -p cuda-core -p cuda-core-derive -p cuda-async --all-targets
 
       - name: TileIR toolchain smoke test
         run: cargo test -p cutile-ir --test bytecode_validate simple_arithmetic -- --exact --nocapture
@@ -238,7 +241,8 @@ jobs:
         run: cargo check -p cuda-bindings -p cuda-core -p cuda-async --all-targets
 
   # Nightly also covers cuda-core's optional native f16 support. The remaining
-  # jobs use stable from rust-toolchain.toml.
+  # jobs use stable: cutile-rs/rust-toolchain.toml inside this tree, and the
+  # git-root rust-toolchain.toml for the host-crate steps.
   # Model-checks / sanitizers for the cuda-async completion reactor's lock-free
   # slot protocol. CPU-only, no GPU: loom explores the interleavings and weak-
   # memory outcomes, miri checks the UnsafeCell/pointer UB, ThreadSanitizer
```

**File**: `Cargo.lock` (modified, +109/-126)
```diff
@@ -4,18 +4,18 @@ version = 4
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.5"
+version = "1.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c982642fa9e8606056828ee9a8505737230110bb1099153c79efe865c59d12ba"
+checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
 dependencies = [
  "memchr",
 ]
 
 [[package]]
 name = "anyhow"
-version = "1.0.104"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "330a5ed07fa54e4702c9d6c4174f74427fc0ef6e214bbd677ae50a5099946470"
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "bindgen"
@@ -35,25 +35,25 @@ dependencies = [
  "quote",
  "regex",
  "rustc-hash 1.1.0",
- "shlex 1.3.0",
- "syn 2.0.119",
+ "shlex",
+ "syn",
  "which",
 ]
 
 [[package]]
 name = "bitflags"
-version = "2.13.2"
+version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3ded4057c258ba199e2d26386d3af3780957ecaee6c4ef4041c6b4b8b97c0b06"
+checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
 [[package]]
 name = "cc"
-version = "1.5.1"
+version = "1.2.60"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f360145194ee8e21db5ee7f3fcd4fe52210864c75c985dae33218202c8bbe040"
+checksum = "43c5703da9466b66a946814e1adf53ea2c90f10063b86290cc9eb67ce3478a20"
 dependencies = [
  "find-msvc-tools",
- "shlex 2.0.1",
+ "shlex",
 ]
 
 [[package]]
@@ -67,15 +67,15 @@ dependencies = [
 
 [[package]]
 name = "cfg-if"
-version = "1.0.5"
+version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e7648175b45a9a48536d676f68d918270699102aa8dab5496df06904c914600"
+checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
 [[package]]
 name = "clang-sys"
-version = "1.9.1"
+version = "1.8.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "157a8ba7b480713b56f4c09fd13fc3e0a22a5dfab8097ba61cbc5feef950788a"
+checksum = "0b023947811758c97c59bf9d1c188fd619ad4718dcaa767947df1cadb14f39f4"
 dependencies = [
  "glob",
  "libc",
@@ -84,18 +84,18 @@ dependencies = [
 
 [[package]]
 name = "crc32fast"
-version = "1.5.2"
+version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "01a7799fd6b852db0e61728dde9a204c423b44d689dbd432522543614b490e78"
+checksum = "9481c1c90cbf2ac953f07c8d4a58aa3945c425b7185c9154d67a65e4230da511"
 dependencies = [
  "cfg-if",
 ]
 
 [[package]]
 name = "crossbeam-utils"
-version = "0.8.23"
+version = "0.8.22"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a31eee39dddec8330830986fcd7625edb5a24ec90ea038215273bbc3adb08ac6"
+checksum = "61803da095bee82a81bb1a452ecc25d3b2f1416d1897eb86430c6159ef717c17"
 
 [[package]]
 name = "crunchy"
@@ -115,7 +115,7 @@ dependencies = [
  "half",
  "loom",
  "once_cell",
- "rustc-hash 2.1.3",
+ "rustc-hash 2.1.2",
  "thiserror",
 ]
 
@@ -128,7 +128,7 @@ dependencies = [
  "prettyplease",
  "proc-macro2",
  "quote",
- "syn 2.0.119",
+ "syn",
 ]
 
 [[package]]
@@ -149,7 +149,7 @@ version = "0.4.0"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.119",
+ "syn",
 ]
 
 [[package]]
@@ -168,9 +168,9 @@ dependencies = [
 
 [[package]]
 name = "either"
-version = "1.18.0"
+version = "1.15.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "252afb9ae5eaa683babdc6a068b3f5726eb19e05070c731f9b2a23a7c3e8ed34"
+checksum = "48c757948c5ede0e46177b7add2e67155f70e33c07fea8284df6576da70b3719"
 
 [[package]]
 name = "equivalent"
@@ -190,9 +190,9 @@ dependencies = [
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.14"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "aedcfb3409746eddb02b9e19ebda1c3394f759a152e48ee875a0844d1b955484"
+checksum = "5baebc0774151f905a1a2cc41989300b1e6fbb29aff0ceffa1064fdd3088d582"
 
 [[package]]
 name = "foldhash"
@@ -202,9 +202,9 @@ checksum = "d9c4f5dac5e15c24eb999c26181a6ca40b39fe946cbe4c263c7209467bc83af2"
 
 [[package]]
 name = "futures"
-version = "0.3.34"
+version = "0.3.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9a31d2a3fbaaeb2af2368bbdd904aa8e812d3c04a1ee10d3171f52d556e5d0a3"
+checksum = "8b147ee9d1f6d097cef9ce628cd2ee62288d963e16fb287bd9286455b241382d"
 dependencies = [
  "futures-channel",
  "futures-core",
@@ -217,25 +217,25 @@ dependencies = [
 
 [[package]]
 name = "futures-channel"
-version = "0.3.34"
+version = "0.3.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b1f9e3d69d39e4862ffed03ed071a76f9a13ba1d9109d355b0f0aa6b15e393c4"
+checksum = "07bbe89c50d7a535e539b8c17bc0b49bdb77747034daa8087407d655f3f7cc1d"
 dependencies = [
  "futures-core",
  "futures-sink",
 ]
 
 [[package]]
 name = "futures-core"
-version = "0.3.34"
+version = "0.3.32"
 source = "registry+https://github.com/rust-la
```

**File**: `cuda-oxide/Cargo.lock` (modified, +187/-186)
```diff
@@ -4,9 +4,9 @@ version = 4
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.5"
+version = "1.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c982642fa9e8606056828ee9a8505737230110bb1099153c79efe865c59d12ba"
+checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
 dependencies = [
  "memchr",
 ]
@@ -69,9 +69,9 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.104"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "330a5ed07fa54e4702c9d6c4174f74427fc0ef6e214bbd677ae50a5099946470"
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "arrayvec"
@@ -81,9 +81,9 @@ checksum = "d3fb67a6e08acf24fdeccbac2cb6ac4305825bd1f117462e0e6f2f193345ad56"
 
 [[package]]
 name = "awint"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b2a8f298efd080b0d3e1ee1723b5d88ecc0d78805fad347e09b76dbd4dadbe37"
+checksum = "d48b7360a36d335663e8f20b7f439029debf52b5a0a749d6e936405f25045288"
 dependencies = [
  "awint_core",
  "awint_dag",
@@ -94,19 +94,19 @@ dependencies = [
 
 [[package]]
 name = "awint_core"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c24d226d9faa090abec192c8ad1ea74635e6cc94000c72a95ceb60cf691428c3"
+checksum = "f8280079e78217ace721501f35dbf551dadf0ab63863504169316cea1bbac872"
 dependencies = [
  "awint_internals",
  "const_fn",
 ]
 
 [[package]]
 name = "awint_dag"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dc5377016f3077b18304da4233a28626ea069047ca84c9bc8c8b81b659f11032"
+checksum = "73977ba1786a5e127272f08b865b60f5d548576a0925de1daa5703cc9ba78a8d"
 dependencies = [
  "awint_ext",
  "awint_macro_internals",
@@ -116,28 +116,28 @@ dependencies = [
 
 [[package]]
 name = "awint_ext"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "01ff843cdefdd48fbe9bc11292a902b7921ff37433ed4124fa02136f83186f58"
+checksum = "ef1b30d3640d9f94dd9f55f655773c5238c11be6f95ab36d24308b7ae34c9bbc"
 dependencies = [
  "awint_core",
  "const_fn",
 ]
 
 [[package]]
 name = "awint_internals"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6209d7873685ac95ee41c4b63fe29bff9b2e1106de65d05b106b2b769c178575"
+checksum = "173937e3f4e233d93362fc1e28ab23808cb31671a1923033706cb44ed4e5d10c"
 dependencies = [
  "const_fn",
 ]
 
 [[package]]
 name = "awint_macro_internals"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6b519a9cd37bf73e44e29b3779ca90246412b56db4af4e96d959f5082bb8bdcc"
+checksum = "d2c6a23f64f14c3b566c2c04124015f78c5fb93e8275a6574e0118747ee60de6"
 dependencies = [
  "awint_ext",
  "proc-macro2",
@@ -146,10 +146,11 @@ dependencies = [
 
 [[package]]
 name = "awint_macros"
-version = "0.19.0"
+version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "518a133c2163e8f021f708d7278af27dd6c1bcee96ea672a2d825b13a6931818"
+checksum = "16e50a2862c6002a424fc9bb4982ec33ab679cb4ad04a174e2a52c2ecc3ea4c7"
 dependencies = [
+ "awint_internals",
  "awint_macro_internals",
 ]
 
@@ -172,15 +173,15 @@ dependencies = [
  "regex",
  "rustc-hash 1.1.0",
  "shlex",
- "syn 2.0.119",
+ "syn 2.0.117",
  "which",
 ]
 
 [[package]]
 name = "bitflags"
-version = "2.13.2"
+version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3ded4057c258ba199e2d26386d3af3780957ecaee6c4ef4041c6b4b8b97c0b06"
+checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
 [[package]]
 name = "block-buffer"
@@ -193,15 +194,15 @@ dependencies = [
 
 [[package]]
 name = "bytemuck"
-version = "1.25.2"
+version = "1.25.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "95832e849adfb21180ccb6826a99da14e5d266ae5c2e668e1602cf234f153797"
+checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
 
 [[package]]
 name = "bytes"
-version = "1.12.1"
+version = "1.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fc652a48c352aef3ea3aed32080501cf3ef6ed5da78602a020c991775b0aff04"
+checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
 
 [[package]]
 name = "cargo-oxide"
@@ -231,15 +232,15 @@ dependencies = [
 
 [[package]]
 name = "cfg-if"
-version = "1.0.5"
+version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e7648175b45a9a48536d676f68d918270699102aa8dab5496df06904c914600"
+checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
 [[package]]
 name = "clang-sys"
-version = "1.9.1"
+version = "1.8.1"
 source = "registry+https://github.c
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/cross_crate_merged_symbols/Cargo.lock` (modified, +0/-6)
```diff
@@ -139,8 +139,6 @@ dependencies = [
 [[package]]
 name = "cuda-bindings"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0f42e2c99c56bf2eef9d569435bfd72a478dfaea3f178b8e5bae891875bbbe2e"
 dependencies = [
  "bindgen",
  "libloading",
@@ -153,8 +151,6 @@ dependencies = [
 [[package]]
 name = "cuda-core"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "84bdb592a2844148fb13bdfbbab158879f56916bde1d1a1b6580ca27f23850cd"
 dependencies = [
  "anyhow",
  "cuda-bindings",
@@ -166,8 +162,6 @@ dependencies = [
 [[package]]
 name = "cuda-core-derive"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8a48da7d10c1078f7fbb87d7176e9476affadea148babf31946e348073872d44"
 dependencies = [
  "proc-macro2",
  "quote",
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/cutile_inter_kernel/Cargo.lock` (modified, +3/-66)
```diff
@@ -258,21 +258,21 @@ dependencies = [
 
 [[package]]
 name = "cutile-ir"
-version = "0.3.1"
+version = "0.4.0"
 dependencies = [
  "half",
  "indexmap",
  "thiserror",
+ "uuid",
 ]
 
 [[package]]
 name = "cutile-macro"
-version = "0.3.1"
+version = "0.4.0"
 dependencies = [
  "convert_case",
  "cutile-compiler",
  "itertools 0.14.0",
- "phf",
  "proc-macro2",
  "quote",
  "sha2",
@@ -742,48 +742,6 @@ dependencies = [
  "windows-link",
 ]
 
-[[package]]
-name = "phf"
-version = "0.11.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1fd6780a80ae0c52cc120a26a1a42c1ae51b247a253e4e06113d23d2c2edd078"
-dependencies = [
- "phf_macros",
- "phf_shared",
-]
-
-[[package]]
-name = "phf_generator"
-version = "0.11.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3c80231409c20246a13fddb31776fb942c38553c51e871f8cbd687a4cfb5843d"
-dependencies = [
- "phf_shared",
- "rand",
-]
-
-[[package]]
-name = "phf_macros"
-version = "0.11.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f84ac04429c13a7ff43785d75ad27569f2951ce0ffd30a3321230db2fc727216"
-dependencies = [
- "phf_generator",
- "phf_shared",
- "proc-macro2",
- "quote",
- "syn",
-]
-
-[[package]]
-name = "phf_shared"
-version = "0.11.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "67eabc2ef2a60eb7faa00097bd1ffdb5bd28e62bf39990626a582201b7a754e5"
-dependencies = [
- "siphasher",
-]
-
 [[package]]
 name = "pin-project-lite"
 version = "0.2.17"
@@ -834,21 +792,6 @@ version = "6.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf"
 
-[[package]]
-name = "rand"
-version = "0.8.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5ca0ecfa931c29007047d1bc58e623ab12e5590e8c7cc53200d5202b69266d8a"
-dependencies = [
- "rand_core",
-]
-
-[[package]]
-name = "rand_core"
-version = "0.6.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ec0be4795e2f6a28069bec0b5ff3e2ac9bafc99e6a9a7dc3547996c5c816922c"
-
 [[package]]
 name = "redox_syscall"
 version = "0.5.18"
@@ -1006,12 +949,6 @@ dependencies = [
  "libc",
 ]
 
-[[package]]
-name = "siphasher"
-version = "1.0.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ee5873ec9cce0195efcb7a4e9507a04cd49aec9c83d0389df45b1ef7ba2e649"
-
 [[package]]
 name = "slab"
 version = "0.4.12"
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/debug-tests/Cargo.lock` (modified, +0/-6)
```diff
@@ -129,8 +129,6 @@ dependencies = [
 [[package]]
 name = "cuda-bindings"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0f42e2c99c56bf2eef9d569435bfd72a478dfaea3f178b8e5bae891875bbbe2e"
 dependencies = [
  "bindgen",
  "libloading",
@@ -143,8 +141,6 @@ dependencies = [
 [[package]]
 name = "cuda-core"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "84bdb592a2844148fb13bdfbbab158879f56916bde1d1a1b6580ca27f23850cd"
 dependencies = [
  "anyhow",
  "cuda-bindings",
@@ -156,8 +152,6 @@ dependencies = [
 [[package]]
 name = "cuda-core-derive"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8a48da7d10c1078f7fbb87d7176e9476affadea148babf31946e348073872d44"
 dependencies = [
  "proc-macro2",
  "quote",
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/debug_pointer_locals/Cargo.lock` (modified, +0/-6)
```diff
@@ -129,8 +129,6 @@ dependencies = [
 [[package]]
 name = "cuda-bindings"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0f42e2c99c56bf2eef9d569435bfd72a478dfaea3f178b8e5bae891875bbbe2e"
 dependencies = [
  "bindgen",
  "libloading",
@@ -143,8 +141,6 @@ dependencies = [
 [[package]]
 name = "cuda-core"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "84bdb592a2844148fb13bdfbbab158879f56916bde1d1a1b6580ca27f23850cd"
 dependencies = [
  "anyhow",
  "cuda-bindings",
@@ -156,8 +152,6 @@ dependencies = [
 [[package]]
 name = "cuda-core-derive"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8a48da7d10c1078f7fbb87d7176e9476affadea148babf31946e348073872d44"
 dependencies = [
  "proc-macro2",
  "quote",
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/image_convolution/Cargo.lock` (modified, +0/-6)
```diff
@@ -141,8 +141,6 @@ dependencies = [
 [[package]]
 name = "cuda-bindings"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0f42e2c99c56bf2eef9d569435bfd72a478dfaea3f178b8e5bae891875bbbe2e"
 dependencies = [
  "bindgen",
  "libloading",
@@ -155,8 +153,6 @@ dependencies = [
 [[package]]
 name = "cuda-core"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "84bdb592a2844148fb13bdfbbab158879f56916bde1d1a1b6580ca27f23850cd"
 dependencies = [
  "anyhow",
  "cuda-bindings",
@@ -168,8 +164,6 @@ dependencies = [
 [[package]]
 name = "cuda-core-derive"
 version = "0.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8a48da7d10c1078f7fbb87d7176e9476affadea148babf31946e348073872d44"
 dependencies = [
  "proc-macro2",
  "quote",
```

---

### Incident Patch 5: `c45e2968` (2026-09-11)
**Commit Message**: fix: restore paths after CUDA Oxide layout migration

Update workspace members, CI, and developer tooling for the nested
SIMT tree. Search reserved-prefix literals under cuda-oxide/crates
after #1102 removed the root host crates. Keep CODEGEN_CRATE_SUBDIR
only in tests.

ci: match stacked PR bases with one glob per line

Oxide pull_request gates run for main, ci/**, and layout/** so stacked
private PRs do not need a new branch name in seven workflows. One
pattern per line keeps the conflict to a single added or removed line.

fix: restore paths after host-crate lift

Join the lifted crates to the root workspace with inlined cutile
metadata (edition 2021, 0.3.1). Nested cutile-rs path-depends on
../cuda-*; Oxide keeps the crates.io pin so example workspaces do not
see two cuda_core crates. Host-crate tests run from the git root.
Oxide rustdoc excludes the imported crates. PR gates also run when the
base is layout/cuda-oxide-crates.

**File**: `.github/workflows/clippy.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
       - name: Run clippy (workspace crates)
         env:
           CUDA_TOOLKIT_PATH: ${{ steps.cuda-toolkit.outputs.CUDA_PATH }}
-        run: cargo clippy --workspace --all-targets -- -D warnings
+        run: cargo clippy --workspace --all-targets --exclude cuda-bindings --exclude cuda-core --exclude cuda-core-derive --exclude cuda-async -- -D warnings
 
       # `rustc-codegen-cuda` and each example under examples/ are their own
       # standalone workspaces (the codegen backend is swapped in via
```

**File**: `.github/workflows/cutile-rs.yml` (modified, +17/-2)
```diff
@@ -1,7 +1,8 @@
 ---
 # Port of cutile-rs/.github/workflows/pr.yml for the monorepo.
-# cutile-rs remains a nested Cargo workspace until workspace membership is
-# reconciled, so cargo/script steps run under cutile-rs.
+# Tile crates stay a nested Cargo workspace under cutile-rs/. Shared host
+# crates (cuda-bindings, cuda-core, cuda-core-derive, cuda-async) are git-root
+# workspace members; `-p` those from the repository root.
 # Checkout does not init submodules. cuda-tile-rs is outside default-members,
 # and these CUDA images have no git until the setup action, so
 # `submodules: recursive` makes actions/checkout reject the REST API fallback.
@@ -111,6 +112,11 @@ jobs:
         # cuda-tile-rs is outside default-members (its build compiles LLVM); keep it out of clippy too.
         run: cargo clippy --workspace --exclude cuda-tile-rs --all-targets
 
+      - name: Clippy (host crates)
+        working-directory: ${{ github.workspace }}
+        run: cargo clippy -p cuda-bindings -p cuda-core -p cuda-core-derive -p cuda-async \
+            --all-targets --all-features
+
       - name: TileIR toolchain smoke test
         run: cargo test -p cutile-ir --test bytecode_validate simple_arithmetic -- --exact --nocapture
 
@@ -152,6 +158,10 @@ jobs:
             --exclude cutile-examples \
             --exclude cutile-benchmarks
 
+      - name: Check host-crate API compatibility against crates.io
+        working-directory: ${{ github.workspace }}
+        run: cargo semver-checks -p cuda-bindings -p cuda-core -p cuda-async
+
   # The shared host-side crates (cuda-bindings, cuda-core, cuda-async)
   # support CUDA 13.0+, while the Tile stack requires 13.2+. This lane keeps
   # the 13.0 floor honest: compile-only, no GPU, no TileIR toolchain (13.0
@@ -170,6 +180,7 @@ jobs:
       - uses: ./cutile-rs/.github/actions/setup
 
       - name: Check shared crates against CUDA 13.0
+        working-directory: ${{ github.workspace }}
         run: cargo check -p cuda-bindings -p cuda-core -p cuda-async --all-targets
 
   # Nightly also covers cuda-core's optional native f16 support. The remaining
@@ -204,15 +215,19 @@ jobs:
         run: cargo clippy --workspace --exclude cuda-tile-rs --all-targets --all-features
 
       - name: Native f16 DeviceCopy
+        working-directory: ${{ github.workspace }}
         run: cargo test -p cuda-core --features f16 --test simt_device_copy_impls
 
       - name: loom model check (interleavings + weak memory)
+        working-directory: ${{ github.workspace }}
         run: RUSTFLAGS="--cfg loom" cargo test -p cuda-async --lib loom_
 
       - name: miri (UnsafeCell / pointer UB)
+        working-directory: ${{ github.workspace }}
         run: cargo miri test -p cuda-async --lib slot_table
 
       - name: ThreadSanitizer (sampled data races, full-scale stress)
+        working-directory: ${{ github.workspace }}
         run: |
           # setarch -R pre-disables ASLR so TSan doesn't need to re-exec itself
           # (which the container blocks); this sidesteps the high mmap-entropy
```

**File**: `.github/workflows/docs.yml` (modified, +12/-4)
```diff
@@ -46,12 +46,20 @@ jobs:
           export LIBRARY_PATH="${sysroot}/lib:${LIBRARY_PATH:-}"
           export LD_LIBRARY_PATH="${sysroot}/lib:${LD_LIBRARY_PATH:-}"
 
+          # The shared host crates are workspace members so they build and
+          # publish from here, but they are cutile-rs source: their gates live
+          # in cutile-rs.yml, which does not run rustdoc under -D warnings.
+          # Documenting them here would hold imported code to a policy its own
+          # repository does not apply, so exclude them rather than diverge from
+          # NVlabs/cutile-rs over a doc-link nit. cuda-bindings would also drag
+          # its bindgen-generated doc comments in.
+          host_crates="--exclude cuda-bindings --exclude cuda-core --exclude cuda-core-derive --exclude cuda-async"
+
           # Docs must build warning-free (RUSTDOCFLAGS=-D warnings above).
-          cargo doc --no-deps --workspace
+          cargo doc --no-deps --workspace ${host_crates}
 
-          # Run doctests. The shared cuda-bindings is not a workspace member,
-          # so nothing here reaches its bindgen-generated doc comments.
-          cargo test --doc --workspace
+          # Run doctests.
+          cargo test --doc --workspace ${host_crates}
 
       # `rustc-codegen-cuda` is its own [workspace] (it links against
       # rustc-private dylibs), so `--workspace` above never reaches it. fmt,
```

**File**: `.github/workflows/unit-tests.yml` (modified, +4/-0)
```diff
@@ -28,6 +28,10 @@ jobs:
         # crates from cutile-rs now; their unit tests run in cutile-rs CI.
         #
         # Crates intentionally not in this matrix:
+        #   * `cuda-bindings` — shared host crate; unit tests run in cutile-rs CI.
+        #   * `cuda-core` — shared host crate; unit tests run in cutile-rs CI.
+        #   * `cuda-core-derive` — proc-macro for cuda-core; tests run via cuda-core.
+        #   * `cuda-async` — shared host crate; unit tests run in cutile-rs CI.
         #   * `fuzzer` — differential-testing infra with no unit tests.
         #   * `rustc-codegen-cuda` — its own [workspace] that links against
         #     `rustc-private` dylibs; covered by the separate job below.
```

**File**: `Cargo.lock` (modified, +213/-8)
```diff
@@ -172,7 +172,7 @@ dependencies = [
  "quote",
  "regex",
  "rustc-hash 1.1.0",
- "shlex",
+ "shlex 1.3.0",
  "syn 2.0.117",
  "which",
 ]
@@ -221,6 +221,16 @@ dependencies = [
  "toml",
 ]
 
+[[package]]
+name = "cc"
+version = "1.4.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "005ec2760ca554fae18df7a11195552ec576cd665632a881bc011d5bb2fd4d80"
+dependencies = [
+ "find-msvc-tools",
+ "shlex 2.0.1",
+]
+
 [[package]]
 name = "cexpr"
 version = "0.6.0"
@@ -370,15 +380,31 @@ dependencies = [
  "thiserror 2.0.18",
 ]
 
+[[package]]
+name = "cuda-async"
+version = "0.3.1"
+dependencies = [
+ "anyhow",
+ "cuda-bindings 0.3.1",
+ "cuda-core 0.3.1",
+ "dashmap",
+ "futures",
+ "half",
+ "loom",
+ "once_cell",
+ "rustc-hash 2.1.2",
+ "thiserror 1.0.69",
+]
+
 [[package]]
 name = "cuda-async"
 version = "0.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6d51fe2c9b1a89f4ac760d72a197761789f4e60db1d07d3f4d48de65a78adc9"
 dependencies = [
  "anyhow",
- "cuda-bindings",
- "cuda-core",
+ "cuda-bindings 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cuda-core 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
  "dashmap",
  "futures",
  "half",
@@ -387,6 +413,18 @@ dependencies = [
  "thiserror 1.0.69",
 ]
 
+[[package]]
+name = "cuda-bindings"
+version = "0.3.1"
+dependencies = [
+ "bindgen",
+ "libloading",
+ "prettyplease",
+ "proc-macro2",
+ "quote",
+ "syn 2.0.117",
+]
+
 [[package]]
 name = "cuda-bindings"
 version = "0.3.1"
@@ -401,19 +439,40 @@ dependencies = [
  "syn 2.0.117",
 ]
 
+[[package]]
+name = "cuda-core"
+version = "0.3.1"
+dependencies = [
+ "anyhow",
+ "cuda-bindings 0.3.1",
+ "cuda-core-derive 0.3.1",
+ "half",
+ "oxide-artifacts 0.2.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "trybuild",
+]
+
 [[package]]
 name = "cuda-core"
 version = "0.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "84bdb592a2844148fb13bdfbbab158879f56916bde1d1a1b6580ca27f23850cd"
 dependencies = [
  "anyhow",
- "cuda-bindings",
- "cuda-core-derive",
+ "cuda-bindings 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cuda-core-derive 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
  "half",
  "oxide-artifacts 0.2.1 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
+[[package]]
+name = "cuda-core-derive"
+version = "0.3.1"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 2.0.117",
+]
+
 [[package]]
 name = "cuda-core-derive"
 version = "0.3.1"
@@ -438,8 +497,8 @@ name = "cuda-host"
 version = "0.2.1"
 dependencies = [
  "cuda-artifact-finalizer",
- "cuda-async",
- "cuda-core",
+ "cuda-async 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cuda-core 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
  "cuda-device",
  "cuda-macros",
  "half",
@@ -472,7 +531,7 @@ dependencies = [
 name = "cuda-macros"
 version = "0.2.1"
 dependencies = [
- "cuda-core",
+ "cuda-core 0.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
  "cuda-device",
  "cuda-host",
  "proc-macro2",
@@ -633,6 +692,12 @@ version = "2.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "da7c62ceae207dd37ea5b845da6a0696c799f85e97da1ab5b7910be3c1c80223"
 
+[[package]]
+name = "find-msvc-tools"
+version = "0.1.12"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3e0f1c7c3a72c66fd80abe965175f7523475c0489a87d3ff9d6e8c87d87a9d2d"
+
 [[package]]
 name = "foldhash"
 version = "0.1.5"
@@ -737,6 +802,21 @@ dependencies = [
 name = "fuzzer"
 version = "0.2.1"
 
+[[package]]
+name = "generator"
+version = "0.8.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b3b854b0e584ead1a33f18b2fcad7cf7be18b3875c78816b753639aa501513ae"
+dependencies = [
+ "cc",
+ "cfg-if",
+ "libc",
+ "log",
+ "rustversion",
+ "windows-link",
+ "windows-result",
+]
+
 [[package]]
 name = "generic-array"
 version = "0.14.7"
@@ -977,6 +1057,28 @@ version = "0.4.29"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5e5032e24019045c762d3c0f28f5b6b8bbf38563a65908389bf7978758920897"
 
+[[package]]
+name = "loom"
+version = "0.7.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "419e0dc8046cb947daa77eb95ae174acfbddb7673b4151f56d1eed8e93fbfaca"
+dependencies = [
+ "cfg-if",
+ "generator",
+ "scoped-tls",
+ "tracing",
+ "tracing-subscriber",
+]
+
+[[package]]
+name = "matchers"
+version = "0.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d1525a2a28c7f4fa0fc98bb91ae755d1e2d1505079e05539e35bc876b5d65ae9"
+dependencies = [
+ "regex-automata",
+]
+
 [[package]]
 name = "memchr"
 version = "2.8.0"
@@ -1048,6 +1150,15 @@ dependencies = [
  "minimal-lexical",
 ]
 
+[[package]]
+name = "nu-ansi-term"
+version = "0.50.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum
```

**File**: `Cargo.toml` (modified, +15/-3)
```diff
@@ -24,10 +24,14 @@ members = [
     "cuda-oxide/crates/nvvm-transforms",
     "cuda-oxide/crates/cargo-oxide",
     "cuda-oxide/crates/oxide-artifacts",
+    # Host-side crates shared with cutile-rs and published from NVlabs/cutile-rs.
+    # The cuda-oxide SIMT surface lives under their `simt` modules. Inlined
+    # package metadata (edition 2021, 0.4.0) so they do not inherit Oxide 2024.
+    "cuda-bindings",
+    "cuda-core",
+    "cuda-core-derive",
+    "cuda-async",
     # FFI bindings
-    # cuda-bindings, cuda-core, and cuda-async are the host-side crates shared
-    # with cutile-rs and published from NVlabs/cutile-rs; the cuda-oxide SIMT
-    # surface lives under their `simt` modules. The local copies are gone.
     "cuda-oxide/crates/libnvvm-sys",
     "cuda-oxide/crates/nvjitlink-sys",
     # Internal naming contract (workspace-private; publish = false)
@@ -81,6 +85,14 @@ cuda-host = { path = "cuda-oxide/crates/cuda-host" }
 # `cuda-host` names `features = ["host"]`, so anything that loads or launches a
 # module still gets it.
 cuda-macros = { path = "cuda-oxide/crates/cuda-macros", default-features = false }
+# The crates.io release, not the in-tree path, for the same reason as
+# oxide-artifacts below: a path copy of the same version is a second crate to
+# rustc. Every example is its own [workspace] pinned to crates.io 0.3.1 and
+# also depends on cuda-host by path, so a path pin here puts two cuda_core
+# crates in one example graph and `CudaModule` stops unifying. The lifted
+# directories stay workspace members as the source these releases are
+# published from (and what nested cutile-rs path-depends on); bump, publish,
+# then move these lines.
 cuda-bindings = "0.3.1"
 cuda-core = "0.3.1"
 cuda-async = "0.3.1"
```

**File**: `cuda-async/Cargo.toml` (modified, +26/-17)
```diff
@@ -1,30 +1,39 @@
 [package]
 name = "cuda-async"
-version.workspace = true
-edition.workspace = true
-rust-version.workspace = true
-license.workspace = true
-authors.workspace = true
-repository.workspace = true
+version = "0.4.0"
+edition = "2021"
+rust-version = "1.89"
+license = "Apache-2.0"
+authors = ["Melih Elibol"]
+repository = "https://github.com/nvlabs/cutile-rs"
 readme = "README.md"
 description = "Safe Async CUDA support via Async Rust."
 
 [dependencies]
-cuda-core = { workspace = true }
-rustc-hash = { workspace = true }
-cuda-bindings = { workspace = true }
-half = { workspace = true }
-futures = { workspace = true }
-anyhow = { workspace = true }
-thiserror = { workspace = true }
-dashmap = { workspace = true }
-once_cell = { workspace = true }
+# Sibling paths, not the root workspace entries; see cuda-core/Cargo.toml.
+cuda-core = { version = "=0.4.0", path = "../cuda-core" }
+rustc-hash = "2.0"
+cuda-bindings = { version = "=0.4.0", path = "../cuda-bindings" }
+half = { version = "2" }
+futures = "0.3"
+anyhow = "1"
+thiserror = "1"
+dashmap = "6"
+once_cell = "1.19"
 
 # `loom` model-checks the slot_table completion protocol; test-only, pulled in
 # solely under `--cfg loom` (e.g. `RUSTFLAGS="--cfg loom" cargo test`).
 [target.'cfg(loom)'.dev-dependencies]
 loom = "0.7"
 
+[lints.rust]
+unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }
 
-[lints]
-workspace = true
+[lints.clippy]
+all = { level = "deny", priority = -1 }
+missing_safety_doc = "allow"
+type_complexity = "allow"
+too_many_arguments = "allow"
+needless_range_loop = "allow"
+large_enum_variant = "allow"
+single_range_in_vec_init = "allow"
```

**File**: `cuda-bindings/Cargo.toml` (modified, +22/-13)
```diff
@@ -1,26 +1,35 @@
 [package]
 name = "cuda-bindings"
-version.workspace = true
-authors.workspace = true
-edition.workspace = true
-rust-version.workspace = true
+version = "0.4.0"
+authors = ["Melih Elibol"]
+edition = "2021"
+rust-version = "1.89"
 description = "NVIDIA CUDA bindings."
 readme = "README.md"
-license.workspace = true
-repository.workspace = true
+license = "Apache-2.0"
+repository = "https://github.com/nvlabs/cutile-rs"
 
 [lib]
 doctest = false
 
 [dependencies]
-libloading = { workspace = true }
+libloading = "0.8"
 
 [build-dependencies]
 bindgen = "0.69.4"
-prettyplease = { workspace = true }
-proc-macro2 = { workspace = true }
-quote = { workspace = true }
-syn = { workspace = true }
+prettyplease = "0.2.35"
+proc-macro2 = { version = "1", features = ["span-locations"] }
+quote = "1.0.35"
+syn = { version = "2.0", features = ["full", "extra-traits", "visit", "visit-mut", "fold"] }
 
-[lints]
-workspace = true
+[lints.rust]
+unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }
+
+[lints.clippy]
+all = { level = "deny", priority = -1 }
+missing_safety_doc = "allow"
+type_complexity = "allow"
+too_many_arguments = "allow"
+needless_range_loop = "allow"
+large_enum_variant = "allow"
+single_range_in_vec_init = "allow"
```

---

### Incident Patch 6: `37446163` (2026-10-01)
**Commit Message**: Fix cargo-deny compatibility

- Support both local and CI versions.
- Keep the full workspace under the same policy.

Signed-off-by: nihalp <[REDACTED_EMAIL]>

**File**: `.github/workflows/cargo-deny.yml` (modified, +2/-1)
```diff
@@ -46,8 +46,9 @@ jobs:
       # lock still exits 0 here and leaves the file rewritten, while --locked
       # stops with "cannot update the lock file". The other two runs below and
       # in cuda-oxide/scripts/ already pass it.
+      # Find deny.toml through a SIMT member; --workspace checks all root members.
       - name: Run cargo-deny
-        run: cargo deny --locked check --config cuda-oxide/deny.toml
+        run: cargo deny --manifest-path cuda-oxide/crates/cargo-oxide/Cargo.toml --workspace --locked check
 
       # cuda-oxide/crates/rustc-codegen-cuda carries its own `[workspace]` for the
       # rustc-private dylibs, so the run above stops at that boundary and never
```

**File**: `cuda-oxide/Justfile` (modified, +2/-1)
```diff
@@ -222,7 +222,8 @@ check-guards:
     bash scripts/check-host-api-paths.sh
     bash scripts/check-shared-crate-pin.sh
     bash scripts/check-oxide-artifacts-parity.sh
-    cargo deny --manifest-path ../Cargo.toml --locked check --config deny.toml
+    # Find deny.toml through a SIMT member; --workspace checks all root members.
+    cargo deny --manifest-path crates/cargo-oxide/Cargo.toml --workspace --locked check
     cargo deny --manifest-path crates/rustc-codegen-cuda/Cargo.toml --locked check
     cargo deny --manifest-path crates/cuda-macros/tests/device-only/Cargo.toml --locked check
     bash scripts/check-dependency-licenses.sh
```

---

### Incident Patch 7: `7f91babe` (2026-10-01)
**Commit Message**: Fix paths after the repository move

- Restore toolchain checks for standalone projects.
- Test both layouts and ignore leftover build directories.
- Fix local check and book commands.

Signed-off-by: nihalp <[REDACTED_EMAIL]>

**File**: `.github/workflows/cargo-deny.yml` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ jobs:
       # stops with "cannot update the lock file". The other two runs below and
       # in cuda-oxide/scripts/ already pass it.
       - name: Run cargo-deny
-        run: cargo deny --config cuda-oxide/deny.toml --locked check
+        run: cargo deny --locked check --config cuda-oxide/deny.toml
 
       # cuda-oxide/crates/rustc-codegen-cuda carries its own `[workspace]` for the
       # rustc-private dylibs, so the run above stops at that boundary and never
```

**File**: `cuda-oxide/Justfile` (modified, +1/-1)
```diff
@@ -222,7 +222,7 @@ check-guards:
     bash scripts/check-host-api-paths.sh
     bash scripts/check-shared-crate-pin.sh
     bash scripts/check-oxide-artifacts-parity.sh
-    cargo deny --manifest-path ../Cargo.toml --config deny.toml --locked check
+    cargo deny --manifest-path ../Cargo.toml --locked check --config deny.toml
     cargo deny --manifest-path crates/rustc-codegen-cuda/Cargo.toml --locked check
     cargo deny --manifest-path crates/cuda-macros/tests/device-only/Cargo.toml --locked check
     bash scripts/check-dependency-licenses.sh
```

**File**: `cuda-oxide/crates/cargo-oxide/src/backend.rs` (modified, +101/-11)
```diff
@@ -117,9 +117,7 @@ use crate::backend_source::{self, DependencySource};
 pub fn find_workspace_root() -> Option<PathBuf> {
     let mut dir = std::env::current_dir().ok()?;
     loop {
-        if dir.join("Cargo.toml").is_file()
-            && (dir.join("crates/rustc-codegen-cuda").is_dir()
-                || dir.join("cuda-oxide/crates/rustc-codegen-cuda").is_dir())
+        if dir.join("Cargo.toml").is_file() && codegen_crate_path(&dir).join("Cargo.toml").is_file()
         {
             return Some(dir);
         }
@@ -131,17 +129,12 @@ pub fn find_workspace_root() -> Option<PathBuf> {
 
 /// Returns a SIMT crate in either supported repository layout.
 pub fn simt_crate_path(workspace_root: &Path, crate_name: &str) -> PathBuf {
-    let nested_crates = workspace_root.join("cuda-oxide/crates");
-    if nested_crates.is_dir() {
-        nested_crates.join(crate_name)
-    } else {
-        workspace_root.join("crates").join(crate_name)
-    }
+    codegen_crate_path(workspace_root).with_file_name(crate_name)
 }
 
 /// Returns the codegen crate in either supported repository layout.
 pub fn codegen_crate_path(workspace_root: &Path) -> PathBuf {
-    simt_crate_path(workspace_root, "rustc-codegen-cuda")
+    backend_source::codegen_crate_in_checkout(workspace_root)
 }
 
 /// Returns the path to the codegen backend `.so`, building it if necessary.
@@ -1390,11 +1383,22 @@ mod tests {
         let root = tempdir();
         let flat = root.join("crates/rustc-codegen-cuda");
         std::fs::create_dir_all(&flat).unwrap();
+        std::fs::write(flat.join("Cargo.toml"), "[package]\n").unwrap();
         assert_eq!(codegen_crate_path(&root), flat);
 
+        // Switching branches can leave build outputs from the nested layout.
         let nested = root.join("cuda-oxide/crates/rustc-codegen-cuda");
-        std::fs::create_dir_all(&nested).unwrap();
+        std::fs::create_dir_all(nested.join("target/debug")).unwrap();
+        assert_eq!(codegen_crate_path(&root), flat);
+        assert_eq!(backend_source::codegen_crate_in_checkout(&root), flat);
+        assert_eq!(
+            simt_crate_path(&root, "cuda-macros"),
+            root.join("crates/cuda-macros")
+        );
+
+        std::fs::write(nested.join("Cargo.toml"), "[package]\n").unwrap();
         assert_eq!(codegen_crate_path(&root), nested);
+        assert_eq!(backend_source::codegen_crate_in_checkout(&root), nested);
         assert_eq!(
             simt_crate_path(&root, "cuda-macros"),
             root.join("cuda-oxide/crates/cuda-macros")
@@ -2327,6 +2331,92 @@ mod tests {
         assert!(report.contains("CUDA_OXIDE_BACKEND"), "{report}");
     }
 
+    // A moved dependency must still use the toolchain pin at the repository root.
+    #[test]
+    fn dependency_toolchain_guard_supports_flat_and_nested_checkouts() {
+        let rev = "728539f652ba107800fa13d0c31675f6c11aab9c";
+        let git_source = format!("git+https://github.com/NVIDIA/cuda-rust.git#{rev}");
+        for nested in [false, true] {
+            let root = tempdir();
+            std::fs::write(root.join("Cargo.toml"), "[workspace]\n").unwrap();
+            std::fs::write(
+                root.join("rust-toolchain.toml"),
+                "[toolchain]\nchannel = \"nightly-2026-08-28\"\n",
+            )
+            .unwrap();
+            let simt_root = if nested {
+                root.join("cuda-oxide")
+            } else {
+                root.clone()
+            };
+            let codegen = simt_root.join(CODEGEN_CRATE_SUBDIR);
+            let device = simt_root.join("crates/cuda-device");
+            for (directory, name) in [(&codegen, "rustc_codegen_cuda"), (&device, "cuda-device")] {
+                std::fs::create_dir_all(directory).unwrap();
+                std::fs::write(
+                    directory.join("Cargo.toml"),
+                    format!("[package]\nname = {name:?}\nversion = \"0.0.0\"\n"),
+                )
+                .unwrap();
+            }
+            if nested {
+                assert!(!simt_root.join("Cargo.toml").exists());
+            }
+
+            for (package_source, marker) in [
+                (None, None),
+                (None, Some(".git")),
+                (Some(git_source.as_str()), Some(".cargo-ok")),
+            ] {
+                if let Some(marker) = marker {
+                    std::fs::write(root.join(marker), "").unwrap();
+                }
+                let metadata = serde_json::json!({
+                    "packages": [{
+                        "name": "cuda-device",
+                        "manifest_path": device.join("Cargo.toml"),
+                        "source": package_source,
+                    }],
+                });
+                let resolved = backend_source::dependency_source_from_metadata(&metadata)
+                    .unwrap()
+                    .unwrap();
+                assert_eq!(resolved.checkout(), root);
+                assert_eq!(resolved.co
```

**File**: `cuda-oxide/crates/cargo-oxide/src/backend_source.rs` (modified, +14/-6)
```diff
@@ -47,7 +47,7 @@ pub const NESTED_CODEGEN_CRATE_SUBDIR: &str = "cuda-oxide/crates/rustc-codegen-c
 /// Returns the codegen crate in either supported repository layout.
 pub fn codegen_crate_in_checkout(root: &Path) -> PathBuf {
     let nested = root.join(NESTED_CODEGEN_CRATE_SUBDIR);
-    if nested.is_dir() {
+    if nested.join("Cargo.toml").is_file() {
         nested
     } else {
         root.join(CODEGEN_CRATE_SUBDIR)
@@ -219,11 +219,9 @@ fn git_source_rev(source: &str) -> Option<&str> {
 fn checkout_root(manifest: &Path) -> Option<PathBuf> {
     let mut dir = manifest.parent()?;
     loop {
-        if dir.join(CODEGEN_CRATE_SUBDIR).join("Cargo.toml").is_file()
-            || dir
-                .join(NESTED_CODEGEN_CRATE_SUBDIR)
-                .join("Cargo.toml")
-                .is_file()
+        // cuda-oxide/ has the crates; its parent owns the workspace and pin.
+        if dir.join("Cargo.toml").is_file()
+            && codegen_crate_in_checkout(dir).join("Cargo.toml").is_file()
         {
             return Some(dir.to_path_buf());
         }
@@ -313,6 +311,11 @@ mod tests {
             std::fs::create_dir_all(&dir).unwrap();
             std::fs::write(dir.join("Cargo.toml"), "[package]\n").unwrap();
         }
+        std::fs::write(
+            root.join("Cargo.toml"),
+            "[workspace]\nmembers = [\"crates/*\"]\nexclude = [\"crates/rustc-codegen-cuda\"]\n",
+        )
+        .unwrap();
         root.join("crates").join(crate_name).join("Cargo.toml")
     }
 
@@ -496,6 +499,11 @@ mod tests {
         std::fs::create_dir_all(trimmed.join(".git")).unwrap();
         assert_eq!(checkout_root(&manifest), None);
 
+        // Worktrees use a .git file instead of a directory.
+        std::fs::remove_dir(trimmed.join(".git")).unwrap();
+        std::fs::write(trimmed.join(".git"), "gitdir: /unused\n").unwrap();
+        assert_eq!(checkout_root(&manifest), None);
+
         // The marker directory itself is still eligible when it has the crate.
         checkout_with_backend(&trimmed, "cuda-device");
         assert_eq!(checkout_root(&manifest), Some(trimmed));
```

**File**: `cuda-oxide/cuda-oxide-book/compiler/catalog-generated-intrinsics.md` (modified, +1/-1)
```diff
@@ -277,7 +277,7 @@ Finally, run the normal checks required by the files you changed. For changes
 that also update the book:
 
 ```bash
-just book
+just -f cuda-oxide/Justfile book
 bash cuda-oxide/scripts/check-book-api-names.sh
 git diff --check
 ```
```

---

### Incident Patch 8: `728539f6` (2026-09-10)
**Commit Message**: fix: restore paths after CUDA Oxide layout migration

Update workspace members, CI, and developer tooling for the nested
SIMT tree. Search reserved-prefix literals under cuda-oxide/crates
after #1102 removed the root host crates. Keep CODEGEN_CRATE_SUBDIR
only in tests.

ci: match stacked PR bases with one glob per line

Oxide pull_request gates run for main, ci/**, and layout/** so stacked
private PRs do not need a new branch name in seven workflows. One
pattern per line keeps the conflict to a single added or removed line.

fix: retarget checks after nesting the SIMT tree

The source-reference guard and its workflow step still assumed scripts and crates at the git root. Drop the private ci/** and layout/** pull_request branches the path fix added.

docs: keep the Oxide README at the repository root

GitHub only renders the root file, so the nested layout should not replace the Oxide overview with a short index. Point links in that file at the nested SIMT tree.

**File**: `.cargo/config.toml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# Workspace-root Cargo aliases. SIMT-specific environment configuration lives
+# in cuda-oxide/.cargo/config.toml.
+
+[alias]
+oxide = "run --package cargo-oxide --"
```

**File**: `.dockerignore` (modified, +8/-8)
```diff
@@ -4,11 +4,11 @@
 .git
 .github
 target
-crates/rustc-codegen-cuda/target
-crates/rustc-codegen-cuda/examples/*/target
-crates/rustc-codegen-cuda/examples/**/*.ptx
-crates/rustc-codegen-cuda/examples/**/*.ll
-crates/rustc-codegen-cuda/examples/**/*.ltoir
-crates/rustc-codegen-cuda/examples/**/*.cubin
-cuda-oxide-book/_build
-cuda-oxide-book/.venv
+cuda-oxide/crates/rustc-codegen-cuda/target
+cuda-oxide/crates/rustc-codegen-cuda/examples/*/target
+cuda-oxide/crates/rustc-codegen-cuda/examples/**/*.ptx
+cuda-oxide/crates/rustc-codegen-cuda/examples/**/*.ll
+cuda-oxide/crates/rustc-codegen-cuda/examples/**/*.ltoir
+cuda-oxide/crates/rustc-codegen-cuda/examples/**/*.cubin
+cuda-oxide/cuda-oxide-book/_build
+cuda-oxide/cuda-oxide-book/.venv
```

**File**: `.gitattributes` (modified, +1/-1)
```diff
@@ -1 +1 @@
-intrinsics/probes/*.ll whitespace=-blank-at-eof
+cuda-oxide/intrinsics/probes/*.ll whitespace=-blank-at-eof
```

**File**: `.github/pull_request_template.md` (modified, +4/-4)
```diff
@@ -8,10 +8,10 @@
 
 ## Testing
 
-<!-- How did you verify this? Paste relevant `cargo oxide run` / `just check`
-output, or smoketest results. -->
-- [ ] `just check` passes (the local mirror of CI: fmt, clippy, tests, guards, docs)
-- [ ] `cargo oxide run <example>` passes, or `scripts/smoketest.sh -o '^<example>$'`
+<!-- How did you verify this? Paste relevant `cargo oxide run` /
+`just -f cuda-oxide/Justfile check` output, or smoketest results. -->
+- [ ] `just -f cuda-oxide/Justfile check` passes (the local mirror of CI: fmt, clippy, tests, guards, docs)
+- [ ] `cargo oxide run <example>` passes, or `cuda-oxide/scripts/smoketest.sh -o '^<example>$'`
 - [ ] New example added (if applicable)
 
 ## Checklist
```

**File**: `.github/workflows/book.yml` (modified, +5/-5)
```diff
@@ -46,13 +46,13 @@ jobs:
           python-version: "3.13"
           cache: pip
           # One install covers both books; keep cutile-rs/cutile-book/requirements.txt
-          # in sync with cuda-oxide-book/requirements.txt for local `make setup`.
+          # in sync with cuda-oxide/cuda-oxide-book/requirements.txt for local `make setup`.
           cache-dependency-path: |
-            cuda-oxide-book/requirements.txt
+            cuda-oxide/cuda-oxide-book/requirements.txt
             cutile-rs/cutile-book/requirements.txt
 
       - name: Install dependencies
-        run: pip install -r cuda-oxide-book/requirements.txt
+        run: pip install -r cuda-oxide/cuda-oxide-book/requirements.txt
 
       # `-W` matches the Rust docs gate, which builds under
       # RUSTDOCFLAGS="-D warnings". Without it a broken cross-reference, a
@@ -62,8 +62,8 @@ jobs:
       - name: Build cuda-oxide Sphinx site
         run: >-
           sphinx-build -W --keep-going -b html
-          -d cuda-oxide-book/_build/doctrees
-          cuda-oxide-book _site
+          -d cuda-oxide/cuda-oxide-book/_build/doctrees
+          cuda-oxide/cuda-oxide-book _site
 
       # GitHub Pages allows one artifact per repository. Nest the former
       # cutile-rs Pages site under /cutile-rs/ so both books share one deploy.
```

**File**: `.github/workflows/cargo-deny.yml` (modified, +14/-14)
```diff
@@ -8,7 +8,7 @@ name: cargo-deny
 # Four parts of the same concern. `check` enforces the license *policy* over
 # the whole resolved graph from deny.toml, once per `[workspace]` root that
 # resolves third-party crates and is neither an example nor under cutile-rs:
-# the root workspace, crates/rustc-codegen-cuda, and the cuda-macros
+# the root workspace, cuda-oxide/crates/rustc-codegen-cuda, and the cuda-macros
 # device-only fixture. Each declares its own `[workspace]`, so each is a
 # separate resolution the others cannot reach. `license-manifest` enforces that
 # the human-readable inventory in dependency-licenses.csv still lists what the
@@ -45,30 +45,30 @@ jobs:
       # Cargo.lock it is judging -- verified: deleting a package block from the
       # lock still exits 0 here and leaves the file rewritten, while --locked
       # stops with "cannot update the lock file". The other two runs below and
-      # in scripts/ already pass it.
+      # in cuda-oxide/scripts/ already pass it.
       - name: Run cargo-deny
-        run: cargo deny --locked check
+        run: cargo deny --config cuda-oxide/deny.toml --locked check
 
-      # crates/rustc-codegen-cuda carries its own `[workspace]` for the
+      # cuda-oxide/crates/rustc-codegen-cuda carries its own `[workspace]` for the
       # rustc-private dylibs, so the run above stops at that boundary and never
       # sees the 88 third-party crates it resolves. Same policy, second
       # workspace -- the pass asked for in the #662 review. No --config:
       # cargo-deny walks up from the manifest directory and finds the
-      # repository-root deny.toml, as the example-policy script relies on too.
+      # SIMT-root cuda-oxide/deny.toml, as the example-policy script relies on too.
       - name: Run cargo-deny over the codegen backend workspace
-        run: cargo deny --manifest-path crates/rustc-codegen-cuda/Cargo.toml --locked check
+        run: cargo deny --manifest-path cuda-oxide/crates/rustc-codegen-cuda/Cargo.toml --locked check
 
       # The last `[workspace]` root this job runs.
-      # `crates/cuda-macros/tests/device-only`
+      # `cuda-oxide/crates/cuda-macros/tests/device-only`
       # declares its own `[workspace]` so that its graph provably excludes
       # cuda-host, which is the whole point of the fixture -- and that same
       # boundary puts it outside the root run above, outside the backend run,
       # and outside the example-policy script (which walks
-      # crates/rustc-codegen-cuda/examples only). Its lock resolves
+      # cuda-oxide/crates/rustc-codegen-cuda/examples only). Its lock resolves
       # proc-macro2, quote and syn at versions that appear nowhere in the root
       # lock, so those three (name, version) pairs were governed by no policy
       # at all. It passes today: advisories ok, bans ok, licenses ok, sources
-      # ok. (crates/fuzzer/rustlantis is another `[workspace]` root
+      # ok. (cuda-oxide/crates/fuzzer/rustlantis is another `[workspace]` root
       # and is deliberately not here: it is a vendored upstream project, not
       # first-party code, and bringing its graph under deny.toml is a policy
       # call rather than a gap. The cutile-rs roots -- cutile-rs/Cargo.toml and
@@ -78,10 +78,10 @@ jobs:
       # policy is not the one that judges it. To bring them in one day, add a
       # `cargo deny --manifest-path <root> --locked check` step per root here,
       # and drop the matching CUTILE_ROOT filter in
-      # scripts/check-dependency-licenses.sh so the inventory half
+      # cuda-oxide/scripts/check-dependency-licenses.sh so the inventory half
       # covers them too.)
       - name: Run cargo-deny over the cuda-macros device-only fixture
-        run: cargo deny --manifest-path crates/cuda-macros/tests/device-only/Cargo.toml --locked check
+        run: cargo deny --manifest-path cuda-oxide/crates/cuda-macros/tests/device-only/Cargo.toml --locked check
 
   license-manifest:
     name: dependency-licenses.csv covers every declared crate
@@ -94,7 +94,7 @@ jobs:
       # Only reads manifests: `cargo metadata` resolves the graph without
       # running build scripts, so this needs no CUDA toolkit and no LLVM.
       - name: Verify the license inventory covers the workspace
-        run: bash scripts/check-dependency-licenses.sh
+        run: bash cuda-oxide/scripts/check-dependency-licenses.sh
 
   example-policy:
     name: deny.toml governs the example workspaces
@@ -112,7 +112,7 @@ jobs:
       # than one per lock file, covering the same crates. The script prints
       # both counts.
       - name: Run cargo-deny over the example workspaces
-        run: bash scripts/check-example-license-policy.sh
+        run: bash cuda-oxide/scripts/check-example-license-policy.sh
 
   source-headers:
     name: every source file carries the SPDX header
@@ -126,4 +126,4 @@ jobs:
       # review fixed 32 missing headers in #812 and the next two scripts to
       # land (#819, #835) drift
```

**File**: `.github/workflows/clippy.yml` (modified, +5/-5)
```diff
@@ -56,7 +56,7 @@ jobs:
         env:
           CUDA_TOOLKIT_PATH: ${{ steps.cuda-toolkit.outputs.CUDA_PATH }}
           CARGO_TARGET_DIR: ${{ runner.temp }}/clippy-shared-target
-        working-directory: crates/rustc-codegen-cuda
+        working-directory: cuda-oxide/crates/rustc-codegen-cuda
         run: cargo clippy --all-targets -- -D warnings
 
       - name: Run clippy (rustc-codegen-cuda examples)
@@ -65,7 +65,7 @@ jobs:
           CARGO_TARGET_DIR: ${{ runner.temp }}/clippy-shared-target
         run: |
           set -e
-          for ex in crates/rustc-codegen-cuda/examples/*/; do
+          for ex in cuda-oxide/crates/rustc-codegen-cuda/examples/*/; do
             if [ ! -f "$ex/Cargo.toml" ]; then continue; fi
             name=$(basename "$ex")
             echo "::group::clippy: $name"
@@ -96,11 +96,11 @@ jobs:
                grep -q "\"${sub}\""; then
               continue
             fi
-            echo "::group::clippy: ${dir#crates/rustc-codegen-cuda/examples/}"
+            echo "::group::clippy: ${dir#cuda-oxide/crates/rustc-codegen-cuda/examples/}"
             (cd "${dir}" && cargo clippy --locked --all-targets -- -D warnings)
             echo "::endgroup::"
           done < <(
-            find crates/rustc-codegen-cuda/examples -mindepth 3 -name Cargo.toml \
+            find cuda-oxide/crates/rustc-codegen-cuda/examples -mindepth 3 -name Cargo.toml \
               -not -path '*/target/*' | sort
           )
 
@@ -111,5 +111,5 @@ jobs:
           # surface, and check-device-only-build.sh runs `cargo check` on it but
           # never a lint.
           echo "::group::clippy: cuda-macros device-only fixture"
-          (cd crates/cuda-macros/tests/device-only && cargo clippy --locked --all-targets -- -D warnings)
+          (cd cuda-oxide/crates/cuda-macros/tests/device-only && cargo clippy --locked --all-targets -- -D warnings)
           echo "::endgroup::"
```

**File**: `.github/workflows/docs.yml` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ jobs:
       # this gate did not, which is how four broken intra-doc links in its
       # crate-level documentation went unreported.
       - name: Build docs (warning-free) for rustc-codegen-cuda
-        working-directory: crates/rustc-codegen-cuda
+        working-directory: cuda-oxide/crates/rustc-codegen-cuda
         env:
           RUSTDOCFLAGS: "-D warnings"
         run: |
```

---

### Incident Patch 9: `4ab9ab3e` (2026-09-29)
**Commit Message**: ci: increase CodeQL analysis timeout (#1362)

## Summary
- Raise the CodeQL `analyze` job timeout from 60 minutes to 120.
- The Rust analysis is the job that runs long enough to hit the old
limit. The Actions analysis is unchanged aside from sharing this job
timeout.

## Test plan
- [ ] CodeQL workflow still triggers on pull requests, pushes to `main`,
and the weekly schedule
- [ ] The Rust `Analyze (rust)` job completes instead of being cancelled
at 60 minutes

**File**: `.github/workflows/codeql.yml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ jobs:
   analyze:
     name: Analyze (${{ matrix.language }})
     runs-on: ubuntu-latest
-    timeout-minutes: 60
+    timeout-minutes: 120
     permissions:
       security-events: write
       packages: read
```

---

### Incident Patch 10: `df048dc1` (2026-09-24)
**Commit Message**: build(deps): bump the all-actions group with 2 updates (#312)

Bumps the all-actions group with 2 updates: [taiki-e/install-action](https://github.com/taiki-e/install-action) and [github/codeql-action](https://github.com/github/codeql-action).


Updates `taiki-e/install-action` from 2.87.16 to 2.87.17
- [Release notes](https://github.com/taiki-e/install-action/releases)
- [Changelog](https://github.com/taiki-e/install-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/taiki-e/install-action/compare/9114bf4d891761788c546334fd37538eae1bf8b3...94c31af3204a9f15ab40b35ad084410b905bbc73)

Updates `github/codeql-action` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.38.0...v4.38.1)

---
updated-dependencies:
- dependency-name: taiki-e/install-action
  dependency-version: 2.87.17
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: all-actions
- dependency-name: github/codeql-action
  dependency-version: 4.38.1
  dependency-type: direct:production
  up

**File**: `cutile-rs/.github/workflows/cargo-deny.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Install cargo-deny
-        uses: taiki-e/install-action@9114bf4d891761788c546334fd37538eae1bf8b3 # v2.87.16
+        uses: taiki-e/install-action@94c31af3204a9f15ab40b35ad084410b905bbc73 # v2.87.17
         with:
           tool: cargo-deny
 
```

**File**: `cutile-rs/.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -36,12 +36,12 @@ jobs:
         uses: actions/checkout@v7
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@v4.38.0
+        uses: github/codeql-action/init@v4.38.1
         with:
           languages: ${{ matrix.language }}
           build-mode: ${{ matrix.build-mode }}
 
       - name: Perform CodeQL analysis
-        uses: github/codeql-action/analyze@v4.38.0
+        uses: github/codeql-action/analyze@v4.38.1
         with:
           category: "/language:${{ matrix.language }}"
```

**File**: `cutile-rs/.github/workflows/pr.yml` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ jobs:
 
       # Prebuilt binary instead of `cargo install` (which compiled the tool
       # from source on every run).
-      - uses: taiki-e/install-action@9114bf4d891761788c546334fd37538eae1bf8b3 # v2.87.16
+      - uses: taiki-e/install-action@94c31af3204a9f15ab40b35ad084410b905bbc73 # v2.87.17
         with:
           tool: cargo-semver-checks
 
```

---

### Incident Patch 11: `acf33d74` (2026-09-24)
**Commit Message**: fix(compiler): do not chain a read-only partition's loads on each other's tokens (#310)

The token copy-back added for set_token carried any same-identity
binding's token across inlining and block boundaries, including the
completion token a load installs on its own view inside the inlined
Partition::load. For an immutable Partition that update used to stay in
the callee frame; carrying it out made every read-only partition's second
load depend on its first, serializing loads that need no ordering among
themselves. grout's fused norm+RoPE prefill kernel went from 20 to 27 us
per call (+4.4% on short prefill) with identical Tile IR text apart from
the load token operands; its SASS grew from 5408 to 5520 instructions.

Only explicit set_token / set_tensor_token installs now cross a boundary
for immutable bindings (the compiler already records them in
explicit_token_updates). Mutable bindings keep the full metadata copy.
With the fix both kernels compile to Tile IR identical to fce7e4c and to
the same SASS (5408 / 4312 instructions, 181 / 189 registers).

Signed-off-by: Melih Elibol <[REDACTED_EMAIL]>

**File**: `cutile-rs/CHANGELOG.md` (modified, +11/-0)
```diff
@@ -25,6 +25,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/).
   conjunctive version/architecture checks before JIT assembly. The writer
   preserves 13.2/13.3 layouts and rejects newer features when targeting them.
 
+### Fixed
+
+- Loads through a read-only `Partition` are no longer chained on each
+  other's completion tokens. The token-threading work in 0.4.0's `set_token`
+  carried a load's completion token out of the inlined `Partition::load`
+  for immutable bindings, which serialized every read-only partition's
+  loads and slowed load-bound kernels by up to 35% (a fused norm+RoPE
+  kernel went from 20 to 27 µs). Only explicit `set_token` /
+  `set_tensor_token` installs now cross an inlining or block boundary for
+  immutable bindings; mutable bindings are unchanged.
+
 ### Changed
 
 - `Tensor::store` returns its completion `Token`; `Tensor::token` reads it
```

**File**: `cutile-rs/cutile-compiler/src/compiler/shared_utils.rs` (modified, +18/-8)
```diff
@@ -1052,9 +1052,21 @@ pub fn update_type_meta(
         let Some(inner_val) = inner_block_vars.vars.get(inner_key) else {
             continue;
         };
-        // Ordering metadata can change through &Tensor, even when the caller
-        // used `let mut`. Compare view identity, not names or mutability.
-        if inner_val.value.is_some() && inner_val.value == outer_val.value {
+        // Ordering metadata can change through `&Tensor`, even when the
+        // caller used `let mut`: an explicit `set_token` /
+        // `set_tensor_token` installs an external ordering point (a PDL
+        // wait) that every later view must start from. Compare view
+        // identity, not names or mutability, and carry *only* explicit
+        // installs. The completion token a load writes into its own view
+        // (inside the inlined `Partition::load`) must not escape an
+        // immutable binding: reads need no ordering among themselves, and
+        // chaining a read-only partition's loads serializes them (a 35%
+        // slowdown in a load-bound kernel). Writable bindings keep the
+        // full metadata copy below, which carries their access tokens.
+        if inner_val.value.is_some()
+            && inner_val.value == outer_val.value
+            && inner_block_vars.explicit_token_updates.contains(inner_key)
+        {
             let inner_token = inner_val
                 .type_meta
                 .as_ref()
@@ -1065,11 +1077,9 @@ pub fn update_type_meta(
                     if meta.fields.contains_key("token") {
                         meta.fields.insert("token".to_string(), inner_token);
                         outer_block_vars.vars.insert(outer_key.clone(), new_val);
-                        if inner_block_vars.explicit_token_updates.contains(inner_key) {
-                            outer_block_vars
-                                .explicit_token_updates
-                                .insert(outer_key.clone());
-                        }
+                        outer_block_vars
+                            .explicit_token_updates
+                            .insert(outer_key.clone());
                     }
                 }
             }
```

**File**: `cutile-rs/cutile/tests/token_threading.rs` (modified, +30/-0)
```diff
@@ -58,6 +58,17 @@ mod token_module {
         out.store(t);
     }
 
+    /// Two loads through one read-only partition must not be chained: a
+    /// load's completion token stays inside `Partition::load`, so both
+    /// loads start from the tensor's entry token and can be issued together.
+    #[cutile::entry()]
+    fn two_loads_one_partition(z: &mut Tensor<f32, { [4] }>, x: &Tensor<f32, { [-1] }>) {
+        let p = x.partition(shape![4]);
+        let a: Tile<f32, { [4] }> = p.load([program_id(0)]);
+        let b: Tile<f32, { [4] }> = p.load([program_id(0) + 1]);
+        z.store(a + b);
+    }
+
     /// Control: a wait whose token is never installed orders nothing.
     #[cutile::entry()]
     fn consumer_without_set(out: &mut Tensor<f32, { [4] }>, input: &Tensor<f32, { [-1] }>) {
@@ -478,3 +489,22 @@ fn rebinding_after_explicit_token_installation_is_rejected() {
         }
     });
 }
+
+/// Regression for the #298 slowdown of load-bound kernels: the second load
+/// from a read-only partition consumed the first load's completion token,
+/// serializing the two loads. Both must consume the same (entry) token.
+#[test]
+fn loads_through_a_read_only_partition_are_not_chained() {
+    common::with_test_stack(|| {
+        let ir = compile("two_loads_one_partition", &[("z", &[1]), ("x", &[1])]);
+        let loads = lines_with(&ir, "load_view_tko");
+        assert_eq!(loads.len(), 2, "IR:\n{ir}");
+        assert_eq!(
+            token_operand(loads[0]),
+            token_operand(loads[1]),
+            "the second load must not depend on the first load's completion.\nIR:\n{ir}"
+        );
+        let first_result = result_of(loads[0]);
+        assert_ne!(token_operand(loads[1]), first_result, "IR:\n{ir}");
+    });
+}
```

---

### Incident Patch 12: `ec4aa479` (2026-09-24)
**Commit Message**: Merge pull request #1327 from uurl/fix/packed-as3-local-storage-contract

fix(mir-lower): support packed AS3 carrier local projections

**File**: `crates/mir-lower/src/convert/ops/aggregate/carrier_field_addr.rs` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Direct field-address lowering for verified packed-AS3 carrier locals.
+
+use super::addressing;
+use super::common::anyhow_to_pliron;
+use crate::convert::types::{StructLayoutInfo, build_struct_slot_map};
+use crate::packed_shared_local_storage::carrier_gep_source_type;
+use dialect_mir::ops::MirFieldAddrOp;
+use dialect_mir::types::MirStructType;
+use llvm_export::ops as llvm;
+use llvm_export::types::{StructLayout, StructType};
+use pliron::builtin::types::{IntegerType, Signedness};
+use pliron::context::{Context, Ptr};
+use pliron::irbuild::dialect_conversion::{DialectConversionRewriter, OperandsInfo};
+use pliron::irbuild::inserter::Inserter;
+use pliron::irbuild::rewriter::Rewriter;
+use pliron::op::Op;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+
+/// Lower a field address, using the physical carrier struct only when the
+/// pre-lowering carrier proof stamped this exact projection.
+///
+/// Ordinary field projections stay on the established #859 path. Carrier
+/// projections never reconstruct provenance from operand history: the physical
+/// GEP source type is an LLVM `TypeAttr` placed directly on this MIR operation
+/// by the closed-world preparation pass.
+pub(crate) fn convert_field_addr(
+    ctx: &mut Context,
+    rewriter: &mut DialectConversionRewriter,
+    op: Ptr<Operation>,
+    operands_info: &OperandsInfo,
+) -> Result<()> {
+    let Some(carrier_source_ty) = carrier_gep_source_type(ctx, op) else {
+        return addressing::convert_field_addr(ctx, rewriter, op, operands_info);
+    };
+
+    let field_addr = MirFieldAddrOp::new(op);
+    let field_index = field_addr
+        .get_attr_field_index(ctx)
+        .ok_or_else(|| pliron::input_error_noloc!("MirFieldAddrOp missing field_index attribute"))?
+        .0 as usize;
+    let semantic_aggregate = field_addr
+        .get_attr_aggregate_ty(ctx)
+        .ok_or_else(|| {
+            pliron::input_error_noloc!("MirFieldAddrOp missing verified aggregate_ty attribute")
+        })?
+        .get_type(ctx);
+
+    let (layout, aggregate_abi_align) = {
+        let aggregate_ref = semantic_aggregate.deref(ctx);
+        let Some(struct_ty) = aggregate_ref.downcast_ref::<MirStructType>() else {
+            return pliron::input_err_noloc!(
+                "packed-AS3 carrier field projection requires a struct root"
+            );
+        };
+        (StructLayoutInfo::of_struct(struct_ty), struct_ty.abi_align)
+    };
+    let map = build_struct_slot_map(ctx, &layout).map_err(anyhow_to_pliron)?;
+
+    let carrier_is_packed = {
+        let carrier_ref = carrier_source_ty.deref(ctx);
+        carrier_ref
+            .downcast_ref::<StructType>()
+            .is_some_and(|ty| ty.layout() == StructLayout::Packed)
+    };
+    if !carrier_is_packed {
+        return pliron::input_err_noloc!(
+            "packed-AS3 carrier field projection was stamped with a non-packed physical source type"
+        );
+    }
+
+    let slot = match map.decl_to_llvm.get(field_index) {
+        Some(Some(slot)) => *slot,
+        Some(None) => {
+            // Match the ordinary field-address contract for stripped ZSTs: a
+            // distinct zero-offset byte GEP keeps value identity unambiguous.
+            use llvm_export::ops::GepIndex;
+            let ptr = op.deref(ctx).get_operand(0);
+            let i8_ty: TypeHandle = IntegerType::get(ctx, 8, Signedness::Signless).into();
+            let gep = llvm::GetElementPtrOp::new(ctx, ptr, vec![GepIndex::Constant(0)], i8_ty);
+            rewriter.insert_operation(ctx, gep.get_operation());
+            rewriter.replace_operation(ctx, op, gep.get_operation());
+            return Ok(());
+        }
+        None => {
+            return pliron::input_err_noloc!(
+                "packed-AS3 carrier field index {} out of bounds for struct with {} fields",
+                field_index,
+                map.decl_to_llvm.len()
+            );
+        }
+    };
+
+    // The carrier itself is the byte-faithful physical representation. Unlike
+    // the ordinary semantic path, do not enter #859's natural-layout byte-GEP
+    // fallback: `[0, slot]` over this packed carrier is already the exact
+    // storage address and also selects the physical p0 field type.
+    use llvm_export::ops::GepIndex;
+    let ptr = op.deref(ctx).get_operand(0);
+    let gep = llvm::GetElementPtrOp::new(
+        ctx,
+        ptr,
+        vec![GepIndex::Constant(0), GepIndex::Constant(slot)],
+        carrier_source_ty,
+    );
+    rewriter.insert_operation(ctx, gep.get_operation());
+    stamp_field_address_alignment(
+        ctx,
+        gep.get_operation(),
+        aggregate_abi_align,
+        layout.field_offsets.get(field_index).copied(),
+    );
+    rewriter.replace_
```

**File**: `crates/mir-lower/src/convert/ops/aggregate/mod.rs` (modified, +3/-1)
```diff
@@ -38,6 +38,7 @@
 
 mod addressing;
 mod array_extract;
+mod carrier_field_addr;
 mod common;
 mod construct;
 mod enum_layout;
@@ -46,8 +47,9 @@ mod fields;
 #[cfg(test)]
 mod test_support;
 
-pub(crate) use addressing::{convert_array_element_addr, convert_field_addr};
+pub(crate) use addressing::convert_array_element_addr;
 pub(crate) use array_extract::convert_extract_array_element;
+pub(crate) use carrier_field_addr::convert_field_addr;
 pub(crate) use construct::{
     convert_construct_array, convert_construct_disjoint_slice, convert_construct_slice,
     convert_construct_struct, convert_construct_tuple,
```

**File**: `crates/mir-lower/src/convert/ops/memory/access.rs` (modified, +55/-18)
```diff
@@ -10,7 +10,9 @@ use super::common::{
     pointer_proved_alignment, value_abi_align, value_mir_type,
 };
 use super::debug::copy_debug_local_variable;
+use crate::convert::target_stable_storage::coerce_target_stable_value;
 use crate::convert::types::{convert_type, mir_type_abi_align};
+use crate::packed_shared_local_storage::carrier_storage_type;
 use dialect_mir::types::MirPtrType;
 use llvm_export::attributes::GepNoWrapFlags;
 use llvm_export::op_interfaces::VolatilityOpInterface;
@@ -45,16 +47,31 @@ pub(crate) fn convert_store(
         }
     };
 
-    // Packed whole-value stores are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep the target-dependent AS3 case
-    // fail-closed because its physical pointer width is selected only later.
-    fail_on_target_dependent_packed_aggregate(
-        ctx,
-        value_mir_type(ctx, operands_info, val),
-        "storing",
-    )?;
+    let stored_val = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        // Carrier identity was proven on MIR before conversion. Convert exactly
+        // at the memory boundary; never rediscover storage provenance from the
+        // converted pointer or its defining operation.
+        coerce_target_stable_value(
+            ctx,
+            rewriter,
+            val,
+            storage_ty,
+            "packed shared carrier-local store",
+        )?
+    } else {
+        // Packed whole-value stores are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep the target-dependent AS3
+        // case fail-closed for arbitrary memory; only pre-proven carrier-local
+        // accesses are exempt.
+        fail_on_target_dependent_packed_aggregate(
+            ctx,
+            value_mir_type(ctx, operands_info, val),
+            "storing",
+        )?;
+        val
+    };
 
-    let llvm_store = llvm::StoreOp::new(ctx, val, ptr);
+    let llvm_store = llvm::StoreOp::new(ctx, stored_val, ptr);
     if dialect_mir::ops::MirStoreOp::new(op).is_volatile(ctx) {
         llvm_store.set_volatile(ctx, true);
     }
@@ -94,15 +111,19 @@ pub(crate) fn convert_load(
 ) -> Result<()> {
     let ptr = op.deref(ctx).get_operand(0);
     let result_ty = op.deref(ctx).get_result(0).get_type(ctx);
+    let semantic_llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
 
-    // Packed whole-value loads are byte-faithful now that divergent rustc
-    // layouts lower to LLVM packed structs. Keep only the target-dependent AS3
-    // physical-image case fail-closed.
-    fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
-
-    let llvm_ty = convert_type(ctx, result_ty).map_err(anyhow_to_pliron)?;
+    let storage_ty = if let Some(storage_ty) = carrier_storage_type(ctx, op) {
+        storage_ty
+    } else {
+        // Packed whole-value loads are byte-faithful now that divergent rustc
+        // layouts lower to LLVM packed structs. Keep only the target-dependent
+        // AS3 physical-image case fail-closed for arbitrary memory.
+        fail_on_target_dependent_packed_aggregate(ctx, result_ty, "loading")?;
+        semantic_llvm_ty
+    };
 
-    let llvm_load = llvm::LoadOp::new(ctx, ptr, llvm_ty);
+    let llvm_load = llvm::LoadOp::new(ctx, ptr, storage_ty);
     if dialect_mir::ops::MirLoadOp::new(op).is_volatile(ctx) {
         llvm_load.set_volatile(ctx, true);
     }
@@ -125,7 +146,20 @@ pub(crate) fn convert_load(
         llvm_export::ops::set_op_alignment(ctx, llvm_load.get_operation(), align as u32);
     }
     rewriter.insert_operation(ctx, llvm_load.get_operation());
-    rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+
+    if storage_ty == semantic_llvm_ty {
+        rewriter.replace_operation(ctx, op, llvm_load.get_operation());
+    } else {
+        let physical_value = llvm_load.get_operation().deref(ctx).get_result(0);
+        let semantic_value = coerce_target_stable_value(
+            ctx,
+            rewriter,
+            physical_value,
+            semantic_llvm_ty,
+            "packed shared carrier-local load",
+        )?;
+        rewriter.replace_operation_with_values(ctx, op, vec![semantic_value]);
+    }
 
     Ok(())
 }
@@ -156,7 +190,10 @@ pub(crate) fn convert_alloca(
         })?;
         mir_ptr.pointee
     };
-    let llvm_pointee = convert_type(ctx, mir_pointee).map_err(anyhow_to_pliron)?;
+    let llvm_pointee = match carrier_storage_type(ctx, op) {
+        Some(storage_ty) => storage_ty,
+        None => convert_type(ctx, mir_pointee).map_err(anyhow_to_pliron)?,
+    };
 
     let i32_ty = IntegerType::get(ctx, 32, Signedness::Signless);
     let one_apint =
```

**File**: `crates/mir-lower/src/lib.rs` (modified, +6/-0)
```diff
@@ -128,6 +128,7 @@ pub mod conversion_interface;
 pub mod convert;
 pub mod helpers;
 pub mod lowering;
+mod packed_shared_local_storage;
 pub mod scalarize_block_args;
 pub mod type_conversion_interface;
 mod wgmma_deferred_accumulator;
@@ -409,6 +410,11 @@ pub fn lower_mir_to_llvm_with_options(
     // every kernel-to-helper requirement while the complete MIR call graph is
     // still available; function conversion removes that graph incrementally.
     lowering::propagate_kernel_dynamic_shared_alignments(ctx, module_op);
+    // Prove the complete address-use path for every narrow packed-AS3 carrier
+    // local immediately before conversion. The resulting per-op TypeAttrs are
+    // lowering capabilities, not inferred provenance: calls, block arguments,
+    // casts, nested projections, returns, and unknown uses fail closed here.
+    packed_shared_local_storage::prepare_packed_shared_local_storage(ctx, module_op)?;
     let mut conversion = MirToLlvmConversionDriver {
         shared_globals: FxHashMap::default(),
         device_globals: FxHashMap::default(),
```

**File**: `crates/mir-lower/src/packed_shared_local_storage.rs` (added, +829/-0)
```diff
@@ -0,0 +1,829 @@
+/*
+ * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+//! Verified lowering facts for the narrow packed-AS3 local-storage lane.
+//!
+//! The physical carrier representation is a storage property, not Rust pointer
+//! provenance. This module therefore does not extend `MirPointerKind`. Instead,
+//! immediately before dialect conversion it performs a closed-world walk over
+//! MIR, proves every use of an eligible compiler-owned local address, and only
+//! after the complete proof succeeds stamps the exact physical LLVM type on the
+//! MIR operations that consume the address.
+//!
+//! No lowering converter reconstructs carrier identity from `OperandsInfo` or
+//! from an LLVM defining-op chain. If a carrier address crosses a call, cast,
+//! block-argument edge, return, pointer offset, nested projection, or any other
+//! unmodelled operation, preparation fails before any MIR operation is lowered.
+
+use crate::convert::target_stable_storage::{StorageRewriteOptions, target_stable_storage_type};
+use crate::convert::types::{
+    PackedSharedInternalAbiInfo, StructLayoutInfo, build_struct_slot_map, convert_type,
+    is_zero_sized_type, packed_shared_internal_abi_info,
+};
+use dialect_mir::ops::{
+    MirAllocaOp, MirArrayElementAddrOp, MirAssertOp, MirCallOp, MirCastOp, MirCondBranchOp,
+    MirDbgValueListOp, MirDbgValueOp, MirFieldAddrOp, MirGotoOp, MirLoadOp, MirPtrOffsetOp,
+    MirReturnOp, MirStoreOp,
+};
+use dialect_mir::types::{MirPtrType, MirStructType};
+use llvm_export::types as llvm_types;
+use pliron::builtin::attributes::TypeAttr;
+use pliron::builtin::types::{FP32Type, FP64Type, IntegerType};
+use pliron::context::{Context, Ptr};
+use pliron::identifier::Identifier;
+use pliron::linked_list::ContainsLinkedList;
+use pliron::operation::Operation;
+use pliron::result::Result;
+use pliron::r#type::{TypeHandle, Typed};
+use pliron::value::Value;
+use rustc_hash::FxHashMap;
+
+const CARRIER_STORAGE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_storage_type";
+const CARRIER_GEP_SOURCE_TYPE_KEY: &str = "cuda_oxide_packed_shared_carrier_gep_source_type";
+
+#[derive(Clone, Copy, Debug)]
+struct CarrierAddress {
+    physical_pointee: TypeHandle,
+    projection_depth: u8,
+}
+
+#[derive(Default)]
+struct CarrierFactPlan {
+    storage_types: Vec<(Ptr<Operation>, TypeHandle)>,
+    gep_source_types: Vec<(Ptr<Operation>, TypeHandle)>,
+}
+
+impl CarrierFactPlan {
+    fn plan_storage_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.storage_types.push((operation, ty));
+    }
+
+    fn plan_gep_source_type(&mut self, operation: Ptr<Operation>, ty: TypeHandle) {
+        self.gep_source_types.push((operation, ty));
+    }
+
+    fn apply(self, ctx: &mut Context) {
+        for (operation, ty) in self.storage_types {
+            set_type_attr(ctx, operation, CARRIER_STORAGE_TYPE_KEY, ty);
+        }
+        for (operation, ty) in self.gep_source_types {
+            set_type_attr(ctx, operation, CARRIER_GEP_SOURCE_TYPE_KEY, ty);
+        }
+    }
+}
+
+fn attr_key(name: &str) -> Identifier {
+    Identifier::try_new(name.to_string()).expect("static carrier attribute key must be valid")
+}
+
+fn get_type_attr(ctx: &Context, op: Ptr<Operation>, name: &str) -> Option<TypeHandle> {
+    op.deref(ctx)
+        .attributes
+        .get::<TypeAttr>(&attr_key(name))
+        .map(|attr| attr.get_type(ctx))
+}
+
+fn set_type_attr(ctx: &mut Context, op: Ptr<Operation>, name: &str, ty: TypeHandle) {
+    op.deref_mut(ctx)
+        .attributes
+        .set(attr_key(name), TypeAttr::new(ty));
+}
+
+/// Physical storage type proven for `mir.alloca`, `mir.load`, or `mir.store`.
+///
+/// The attribute is created only by [`prepare_packed_shared_local_storage`]
+/// after the complete whole-tree carrier plan validates, then is consumed
+/// mechanically during lowering.
+pub(crate) fn carrier_storage_type(ctx: &Context, op: Ptr<Operation>) -> Option<TypeHandle> {
+    get_type_attr(ctx, op, CARRIER_STORAGE_TYPE_KEY)
+}
+
+/// Physical aggregate type that a carrier-backed `mir.field_addr` must index.
+pub(crate) fn carrier_gep_source_type(ctx: &Context, op: Ptr<Operation>) -> Option<TypeHandle> {
+    get_type_attr(ctx, op, CARRIER_GEP_SOURCE_TYPE_KEY)
+}
+
+fn collect_operations(ctx: &Context, root: Ptr<Operation>) -> Vec<Ptr<Operation>> {
+    let mut result = Vec::new();
+    let mut pending = vec![root];
+    while let Some(operation) = pending.pop() {
+        let nested = {
+            let op = operation.deref(ctx);
+            op.regions()
+                .flat_map(|region| region.deref(ctx).iter(ctx))
+                .flat_map(|block| block.deref(ctx).iter(ctx))
+                .collect::<Vec<_>>()
+        };
+        pending.extend(nested);
+        result.push(operation);
+    }
+    result
+}
+
+fn reject_preexisting_carrier_facts(ctx: &Context, operat
```

**File**: `crates/rustc-codegen-cuda/examples/packed_aggregate_abi/src/main.rs` (modified, +24/-19)
```diff
@@ -5,13 +5,15 @@
 
 //! End-to-end ABI regression coverage for packed aggregates.
 //!
-//! This example exercises eight paths that must agree on the same rustc byte
+//! This example exercises nine paths that must agree on the same rustc byte
 //! layout:
 //!
 //! - packed structs passed by value across the host -> kernel boundary;
 //! - packed structs passed to and returned from an internal device helper;
 //! - packed structs containing one shared pointer returned from an internal
 //!   device helper through a target-stable generic-pointer carrier;
+//! - direct field projections from that one-shared-pointer value after local
+//!   materialization through the same target-stable carrier;
 //! - packed structs containing multiple direct shared-pointer leaves crossing
 //!   the same internal device ABI;
 //! - packed structs containing recursively nested shared-pointer leaves crossing
@@ -131,13 +133,19 @@ mod kernels {
     #[inline(never)]
     #[device]
     unsafe fn consume_packed_shared(
-        _value: PackedShared,
+        value: PackedShared,
         shared: *mut SharedArray<u32, 1>,
         out: *mut u32,
     ) {
+        // These two projections force the returned packed-AS3 value through a
+        // compiler-owned local. The slot is physically <{ i8, p0 }>; loading
+        // `ptr` reconstructs the semantic AS3 pointer explicitly at the memory
+        // boundary before it is dereferenced.
+        let tag = value.tag;
+        let round_tripped = value.ptr;
         unsafe {
-            (&mut *shared)[0] = (&*shared)[0].wrapping_add(0x0102_0304);
-            out.write(0x22);
+            (&mut *round_tripped)[0] = (&*round_tripped)[0].wrapping_add(0x0102_0304);
+            out.write(u32::from(tag.wrapping_add(1)));
             out.add(1).write((&*shared)[0]);
         }
     }
@@ -231,10 +239,9 @@ mod kernels {
             ptr: raw,
         });
 
-        // Keep the packed AS3 aggregate in SSA across both internal device ABI
-        // boundaries. The raw shared pointer is passed separately for the
-        // observable runtime check so this regression does not require a
-        // target-dependent whole-value packed store/load.
+        // The callee now projects both fields from the returned packed value.
+        // That forces the narrow #1036 local-carrier path while the independent
+        // raw pointer keeps the reconstructed AS3 pointer's write observable.
         unsafe { consume_packed_shared(value, raw, out) };
     }
 
@@ -257,9 +264,8 @@ mod kernels {
         });
 
         // The returned packed value contains two direct AS3 leaves. Keep it in
-        // SSA and pass it whole into another device helper; the raw pointers
-        // remain separate only to make the runtime effect observable before
-        // packed field projections gain carrier-backed local storage.
+        // SSA and pass it whole into another device helper; recursive/multi-leaf
+        // carrier-local projection support remains deliberately out of scope.
         unsafe { consume_packed_shared_pair(value, left, right, out) };
     }
 
@@ -280,9 +286,9 @@ mod kernels {
             pair: SharedPair { left, right },
         });
 
-        // The AS3 leaves live under a nested aggregate. As above, keep the
-        // packed outer value in SSA so this exercises only the internal ABI
-        // carrier generalization and does not depend on packed local storage.
+        // The AS3 leaves live under a nested aggregate. Keep the packed outer
+        // value in SSA so this still exercises only the internal ABI carrier
+        // generalization, not recursive packed local storage.
         unsafe { consume_packed_nested_shared(value, left, right, out) };
     }
 
@@ -303,10 +309,9 @@ mod kernels {
             ptrs: [left, right],
         });
 
-        // The two AS3 leaves live inside one fixed array. Keep the packed
-        // value in SSA so the return boundary must rebuild the array through
-        // the bounded target-stable carrier without relying on packed local
-        // storage or field projection support.
+        // The two AS3 leaves live inside one fixed array. Keep the packed value
+        // in SSA so the return boundary rebuilds the bounded target-stable
+        // carrier without widening the narrow local-storage lane.
         unsafe { consume_packed_shared_array(value, left, right, out) };
     }
 
@@ -618,7 +623,7 @@ fn main() -> Result<(), Box<dyn std::error::Error>> {
     assert_eq!(&bytes2[2..6], &0xd0e0_f001u32.to_le_bytes());
 
     println!(
-        "packed_aggregate_abi: PASS (runtime values, recursive/multi-leaf/bounded-array packed shared internal ABI, whole-value load/store, and PTX parameter shapes)"
+        "packed_aggregate_abi: PASS (runtime values, direct packed-AS3 carrier-local projections, recursive/multi-leaf/bounded-array packed shared internal ABI, whole-value load/store, and PTX parameter shapes)"
     );
     Ok(())
 }
```

---

### Incident Patch 13: `dbaec217` (2026-09-24)
**Commit Message**: Merge pull request #1326 from 0xOsiris/fix/procfs-image-identity

fix(cuda-host): handle Btrfs mapped file identities

**File**: `crates/cuda-host/src/embedded/mapped_image.rs` (modified, +84/-9)
```diff
@@ -7,9 +7,10 @@
 //! through an unbounded raw pointer. Procfs supplies the mapped file's identity;
 //! metadata validation and artifact reads use the same open file description.
 
-use std::fs::{self, OpenOptions};
+use std::fs::{self, File, OpenOptions};
 use std::io::{self, Read};
-use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
+use std::os::fd::AsRawFd;
+use std::os::unix::fs::OpenOptionsExt;
 use std::path::Path;
 
 #[derive(Debug)]
@@ -81,19 +82,46 @@ fn mapping_at<'a>(maps: &'a [u8], address: usize) -> io::Result<Mapping<'a>> {
     ))
 }
 
+fn mapped_identity_matches(file: &File, mapping: &Mapping<'_>) -> io::Result<bool> {
+    // SAFETY: the descriptor stays open and no references to the mapping are created.
+    let address = unsafe {
+        libc::mmap(
+            std::ptr::null_mut(),
+            1,
+            libc::PROT_NONE,
+            libc::MAP_PRIVATE,
+            file.as_raw_fd(),
+            0,
+        )
+    };
+    if address == libc::MAP_FAILED {
+        return Err(io::Error::last_os_error());
+    }
+    let result = fs::read("/proc/self/maps").and_then(|maps| {
+        let probe = mapping_at(&maps, address.addr())?;
+        if (probe.major, probe.minor, probe.inode) != (mapping.major, mapping.minor, mapping.inode)
+        {
+            return Ok(false);
+        }
+        // Btrfs subvolumes can share procfs device and inode numbers.
+        let map_files = Path::new("/proc/self/map_files");
+        Ok(fs::read_link(map_files.join(probe.range))?
+            == fs::read_link(map_files.join(mapping.range))?)
+    });
+    // SAFETY: this releases only the successful mapping above, including on read errors.
+    unsafe { libc::munmap(address, 1) };
+    result
+}
+
 fn read_verified(path: &Path, mapping: &Mapping<'_>) -> io::Result<Vec<u8>> {
     // A pathname can change after map_files was read. Avoid blocking on a
     // replaced FIFO before its type and identity can be checked below.
     let mut file = OpenOptions::new()
         .read(true)
         .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW)
         .open(path)?;
-    let metadata = file.metadata()?;
-    if !metadata.is_file()
-        || metadata.ino() != mapping.inode
-        || u64::from(libc::major(metadata.dev())) != mapping.major
-        || u64::from(libc::minor(metadata.dev())) != mapping.minor
-    {
+    // Compare both file identities through procfs; stat can report different IDs.
+    if !file.metadata()?.is_file() || !mapped_identity_matches(&file, mapping)? {
         return Err(invalid(
             "artifact image no longer identifies the mapped file",
         ));
@@ -120,6 +148,7 @@ mod tests {
     use oxide_artifacts::{ArtifactBundleSpec, ArtifactPayloadKind, ArtifactPayloadSpec};
     use std::ffi::OsStr;
     use std::os::unix::ffi::OsStrExt;
+    use std::os::unix::fs::MetadataExt;
     use std::process::Command;
     use std::time::{SystemTime, UNIX_EPOCH};
 
@@ -159,6 +188,28 @@ mod tests {
         );
     }
 
+    #[test]
+    fn opened_file_mapping_preserves_device_and_inode_checks() {
+        static ANCHOR: u8 = 0;
+        let maps = fs::read("/proc/self/maps").unwrap();
+        let mut mapping = mapping_at(&maps, std::ptr::from_ref(&ANCHOR).addr()).unwrap();
+        let path = std::env::current_exe().unwrap();
+        let file = File::open(&path).unwrap();
+        assert!(mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.major ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        assert_eq!(
+            read_verified(&path, &mapping).unwrap_err().kind(),
+            io::ErrorKind::InvalidData
+        );
+        mapping.major ^= 1;
+        mapping.minor ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+        mapping.minor ^= 1;
+        mapping.inode ^= 1;
+        assert!(!mapped_identity_matches(&file, &mapping).unwrap());
+    }
+
     #[test]
     fn shared_library_discovery() {
         const CHILD: &str = "CUDA_OXIDE_MAPPED_IMAGE_TEST";
@@ -175,6 +226,24 @@ mod tests {
                 "changed-directory" => std::env::set_current_dir("..").unwrap(),
                 "renamed" => fs::rename(path, "renamed.so").unwrap(),
                 "deleted" => fs::remove_file(path).unwrap(),
+                "replaced" => {
+                    let maps = fs::read("/proc/self/maps").unwrap();
+                    let mut mapping = mapping_at(&maps, std::ptr::from_ref(anchor).addr()).unwrap();
+                    fs::rename(path, "replaced.so").unwrap();
+                    fs::copy("fixture.so", path).unwrap();
+                    assert_eq!(
+                        read_verified(path, &mapping).unwrap_err().kind(),
+                        io::ErrorKind::InvalidData
+                    );
+                    let replacement = File::open(path).unwrap();
+                    // Simulate equal inode numbers in distinct Btrfs subvolumes.
+                    mapping.inode = rep
```

---

### Incident Patch 14: `8206f6e9` (2026-09-24)
**Commit Message**: Merge pull request #1321 from midagedev/fix/unroll-offset-guard

feat(unroll): recognize an exit test that adds a constant to the counter

**File**: `crates/mir-lower/src/wgmma_deferred_accumulator.rs` (modified, +6/-2)
```diff
@@ -539,7 +539,9 @@ fn match_pipelined_counted_loop(
     let Some(trip_count) = recurrences.trip_count else {
         return Ok(None);
     };
-    if trip_count == 0 || primary_iv >= header_args.len() {
+    // An exit test `counter + const <op> bound` is not proven free of
+    // wraparound here, so its trip count is not trusted.
+    if trip_count == 0 || primary_iv >= header_args.len() || recurrences.iv_offset != 0 {
         return Ok(None);
     }
 
@@ -803,7 +805,9 @@ fn match_counted_loop(
     let Some(trip_count) = recurrences.trip_count else {
         return Ok(None);
     };
-    if trip_count == 0 || primary_iv >= header_args.len() {
+    // An exit test `counter + const <op> bound` is not proven free of
+    // wraparound here, so its trip count is not trusted.
+    if trip_count == 0 || primary_iv >= header_args.len() || recurrences.iv_offset != 0 {
         return Ok(None);
     }
 
```

**File**: `crates/mir-transforms/src/analyses/induction.rs` (modified, +97/-47)
```diff
@@ -42,7 +42,9 @@
 //! The **trip count** is how many times the loop body runs. We read it off the
 //! header's exit test `IV <pred> bound` (e.g. `i < 16`) when `init`, `step`, and
 //! a constant `bound` are all known. For `i = 0; i < 16; i += 4` the trip count
-//! is 4.
+//! is 4. The test may also add a constant to the counter first, as in
+//! `i + 2 <= 16` ("a whole tile of two still fits"); that is the same as
+//! `i <= 14` when the addition does not wrap.
 //!
 //! This is a small, reusable stand-in for full scalar evolution that the
 //! unroller (and later loop passes) build on. It is deliberately cautious:
@@ -123,18 +125,26 @@ pub struct LoopRecurrences {
     /// Which header argument is the counter the loop tests against to decide
     /// whether to keep going (its index in `args`), if we found one.
     pub primary_iv: Option<usize>,
-    /// The loop's limit as a plain number, from a test `IV <pred> bound`, when
-    /// `bound` is a compile-time constant.
+    /// The loop's limit as a plain number, when it is a compile-time constant.
+    /// It is normalized so the body runs while `IV <continue_pred> bound`: for
+    /// a test written `IV + iv_offset <pred> n` it is `n - iv_offset`.
     pub bound: Option<i128>,
-    /// The same limit as an IR value rather than a number. The limit can be a
-    /// value only known at runtime (e.g. an array length), which is fine for
-    /// partial unrolling, so we keep the value here even when `bound` is `None`.
+    /// The value the exit test actually compares against, as written (`n`, not
+    /// `n - iv_offset`). It can be a value only known at runtime (e.g. an array
+    /// length), which is fine for partial unrolling, so we keep it here even
+    /// when `bound` is `None`.
     pub bound_value: Option<Value>,
+    /// The constant the exit test adds to the counter before comparing: the
+    /// body runs while `IV + iv_offset <continue_pred> bound_value`. It is 0 for
+    /// `i < n`, 2 for `i + 2 <= n`, and -1 for `i - 1 < n`.
+    pub iv_offset: i128,
     /// The test that keeps the loop going: the body runs while
     /// `IV <continue_pred> bound` holds (e.g. `<` for `while i < n`).
     pub continue_pred: Option<CmpPred>,
     /// How many times the body runs, when `init`, `step`, `bound`, and the
-    /// predicate are all known constants; `None` otherwise.
+    /// predicate are all known constants; `None` otherwise. This is the count
+    /// over mathematical integers: consumers must prove that the counter and
+    /// its exit-test offset do not wrap in the actual integer type.
     pub trip_count: Option<u64>,
 }
 
@@ -253,8 +263,12 @@ pub fn analyze(
 
     // Read the header's exit test to find the counter it checks, the limit, and
     // the keep-going predicate.
-    let (primary_iv, bound, bound_value, continue_pred) =
-        analyze_guard(ctx, info, id, &header_args, &args);
+    let guard = analyze_guard(ctx, info, id, &header_args, &args);
+    let primary_iv = guard.as_ref().map(|g| g.iv);
+    let bound = guard.as_ref().and_then(|g| g.bound);
+    let bound_value = guard.as_ref().map(|g| g.bound_value);
+    let iv_offset = guard.as_ref().map_or(0, |g| g.offset);
+    let continue_pred = guard.as_ref().map(|g| g.pred);
 
     let trip_count = match (primary_iv, bound, continue_pred) {
         (Some(iv), Some(b), Some(p)) => match &args[iv] {
@@ -269,6 +283,7 @@ pub fn analyze(
         primary_iv,
         bound,
         bound_value,
+        iv_offset,
         continue_pred,
         trip_count,
     }
@@ -390,7 +405,7 @@ fn classify_arg(
 
     // Every back-edge must carry `arg + c`, `c + arg`, or `arg - c`, and every
     // path must agree on c. Choosing one arbitrary latch is unsound.
-    let mut steps = values.iter().map(|&value| step_of(ctx, value, arg));
+    let mut steps = values.iter().map(|&value| constant_offset(ctx, value, arg));
     let first_step = steps.next().flatten();
     if let Some(step) = first_step
         && steps.all(|candidate| candidate == Some(step))
@@ -409,9 +424,11 @@ fn classify_arg(
     ArgKind::Reduction
 }
 
-/// If `v` is `arg + c`, `c + arg`, or `arg - c` for a constant `c`, return the
-/// per-iteration step (`c`, or `-c` for the subtraction). `None` otherwise.
-fn step_of(ctx: &Context, v: Value, arg: Value) -> Option<i128> {
+/// If `v` is `arg + c`, `c + arg`, or `arg - c` for a constant `c`, return how
+/// far `v` is from `arg` (`c`, or `-c` for the subtraction). `None` otherwise.
+/// On a latch edge this is the per-iteration step; in an exit test it is the
+/// offset added to the counter before comparing.
+fn constant_offset(ctx: &Context, v: Value, arg: Value) -> Option<i128> {
     let def = v.defining_op()?;
     if Operation::get_op::<MirAddOp>(def, ctx).is_some() {
         let a = def.deref(ctx).get_operand(0);
@@ -432,33 +449,53 @@ fn step_of(ctx: &Context, v: Value, arg: Value) -> Option<i128> {
     None
 }
 
+/// A header exit test the analysis unde
```

**File**: `crates/mir-transforms/src/unroll.rs` (modified, +76/-9)
```diff
@@ -18,8 +18,9 @@
 //! small remainder loop for leftover iterations. The frontend records the
 //! request as a `mir.unroll_hint` operation inside that loop.
 //!
-//! The current analysis recognizes explicit counted `while` loops. Range-based
-//! `for` loops are not yet recognized.
+//! The current analysis recognizes explicit counted `while` loops, including an
+//! exit test that adds a constant to the counter (`while i + 2 <= n`).
+//! Range-based `for` loops are not yet recognized.
 //!
 //! Several `continue` paths are supported: the pass joins their back-edges
 //! before unrolling. Full `#[unroll]` also preserves early `break` paths and
@@ -538,9 +539,17 @@ fn analyze_shape(
     let header = l.header;
     let latch = l.latches[0];
 
-    let iv_idx = rec
-        .primary_iv
-        .ok_or("no recognized induction variable (loop counter)")?;
+    let iv_idx = match rec.primary_iv {
+        Some(iv_idx) => iv_idx,
+        None if rec
+            .args
+            .iter()
+            .any(|arg| matches!(arg, ArgKind::BasicIv { .. })) =>
+        {
+            return Err("the loop has a counter, but its exit test is not of the form `counter <op> bound` (or `counter + const <op> bound`)".into());
+        }
+        None => return Err("no recognized induction variable (loop counter)".into()),
+    };
     let (iv_init, iv_step) = match &rec.args[iv_idx] {
         ArgKind::BasicIv { init, step } => (*init, *step),
         _ => return Err("the loop counter is not a simple induction variable".into()),
@@ -869,6 +878,35 @@ fn full_iv_stays_in_range(ctx: &Context, shape: &LoopShape, trip: i128) -> bool
     (min..=max).contains(&shape.iv_init) && (min..=max).contains(&final_iv)
 }
 
+/// With an exit test `IV + offset <pred> bound`, the header computes
+/// `init + k*step + offset` for every `k` from 0 to the trip count. That sum
+/// changes monotonically in `k`, so it stays in the IV type's range exactly when
+/// its first and last values do; otherwise the fixed-width test can wrap and
+/// disagree with the trip count.
+fn full_exit_test_stays_in_range(
+    ctx: &Context,
+    shape: &LoopShape,
+    trip: i128,
+    offset: i128,
+) -> bool {
+    if offset == 0 {
+        return true;
+    }
+    let Some((min, max)) = integer_value_bounds(ctx, shape.iv_type) else {
+        return false;
+    };
+    let Some(final_iv) = trip
+        .checked_mul(shape.iv_step)
+        .and_then(|delta| shape.iv_init.checked_add(delta))
+    else {
+        return false;
+    };
+    [shape.iv_init, final_iv].iter().all(|&iv| {
+        iv.checked_add(offset)
+            .is_some_and(|tested| (min..=max).contains(&tested))
+    })
+}
+
 /// A grouped positive-IV span must be small enough to cross the type boundary
 /// at most once. The runtime guard can then detect that crossing reliably.
 fn partial_span_is_representable(ctx: &Context, ty: TypeHandle, span: i128) -> bool {
@@ -931,6 +969,11 @@ fn full_unroll(
                 .into(),
         ));
     }
+    if !full_exit_test_stays_in_range(ctx, &s, trip, rec.iv_offset) {
+        return Ok(UnrollOutcome::Skipped(
+            "the exit test's `counter + const` may wrap in the counter's type, so the computed trip count may be wrong".into(),
+        ));
+    }
 
     // Precompute every literal before changing the CFG. Besides keeping all
     // arithmetic checked, this guarantees that an unsupported recurrence cannot
@@ -1061,8 +1104,8 @@ fn make_const(ctx: &mut Context, ty: TypeHandle, value: i128, before: Ptr<Operat
 /// ```text
 ///   preheader -> main_h(init...)
 ///   main_h(acc, i):                       (i = counter, acc = carried values)
-///       if (i + (factor-1)*step) <pred> bound  -> copy0   (a full group fits)
-///       else                                   -> header  (run the remainder)
+///       if (i + (factor-1)*step) + off <pred> bound  -> copy0   (a full group fits)
+///       else                                         -> header  (run the remainder)
 ///   copy0 .. copy(factor-1): the body, factor times, chained; the last copy's
 ///       latch loops back to main_h with (acc', i + factor*step)
 ///   header/.../latch: the original loop, now just the leftover tail
@@ -1224,9 +1267,33 @@ fn partial_unroll(
     };
     let last_off = append_const(ctx, s.iv_type, last_span, main_h);
     let last_iv = append_add(ctx, s.iv_type, mh_iv, last_off, main_h);
-    let within_bound = append_cmp(ctx, pred, last_iv, guard_bound, s.i1_type, main_h);
+    // With an exit test `IV + off <pred> bound`, compare what the source test
+    // computes for the last copy. That sum is only meaningful if it did not
+    // wrap for any copy in the group. It moves monotonically with the counter,
+    // so a positive `off` can only wrap at the last copy and a negative one
+    // only at the first; one more comparison rules that out.
+    let (last_tested, offset_no_wrap) = match rec.iv_offset {
+        0 => (last_iv, None),
+        off if of
```

**File**: `crates/mir-transforms/tests/common/mod.rs` (modified, +209/-1)
```diff
@@ -16,8 +16,10 @@
 use core::num::NonZero;
 
 use dialect_mir::ops::{
-    MirAddOp, MirCondBranchOp, MirConstantOp, MirFuncOp, MirGotoOp, MirLtOp, MirNotOp, MirReturnOp,
+    MirAddOp, MirCondBranchOp, MirConstantOp, MirFuncOp, MirGeOp, MirGotoOp, MirGtOp, MirLeOp,
+    MirLtOp, MirNotOp, MirReturnOp, MirSubOp,
 };
+use mir_transforms::analyses::induction::CmpPred;
 use pliron::basic_block::BasicBlock;
 use pliron::builtin::attributes::{IntegerAttr, TypeAttr};
 use pliron::builtin::op_interfaces::{
@@ -51,6 +53,16 @@ pub fn u32t(ctx: &mut Context) -> TypedHandle<IntegerType> {
     IntegerType::get(ctx, 32, Signedness::Unsigned)
 }
 
+/// A signed 32-bit type.
+pub fn i32t(ctx: &mut Context) -> TypedHandle<IntegerType> {
+    IntegerType::get(ctx, 32, Signedness::Signed)
+}
+
+/// A signed 128-bit type, for constants at the edge of the analysis range.
+pub fn i128t(ctx: &mut Context) -> TypedHandle<IntegerType> {
+    IntegerType::get(ctx, 128, Signedness::Signed)
+}
+
 /// Create `fn foo(inputs...) -> outputs...` inside a module and return
 /// `(module_op, region)`. Blocks are appended to `region` by the caller; the
 /// first block is the entry and must have the same argument types as `inputs`.
@@ -110,6 +122,28 @@ pub fn iconst(
     op.deref(ctx).get_result(0)
 }
 
+/// Append an integer constant given as an `i128`, for types wider than 64 bits.
+pub fn iconst_i128(
+    ctx: &mut Context,
+    b: Ptr<BasicBlock>,
+    ty: TypedHandle<IntegerType>,
+    val: i128,
+) -> Value {
+    let width = ty.deref(ctx).width() as usize;
+    let apint = APInt::from_i128(val, NonZero::new(width).unwrap());
+    let op = Operation::new(
+        ctx,
+        MirConstantOp::get_concrete_op_info(),
+        vec![ty.into()],
+        vec![],
+        vec![],
+        0,
+    );
+    MirConstantOp::new(op).set_attr_value(ctx, IntegerAttr::new(ty, apint));
+    op.insert_at_back(b, ctx);
+    op.deref(ctx).get_result(0)
+}
+
 /// Append an unconditional `goto target(operands)` to `b`.
 pub fn goto(ctx: &mut Context, b: Ptr<BasicBlock>, target: Ptr<BasicBlock>, operands: Vec<Value>) {
     let op = Operation::new(
@@ -297,6 +331,180 @@ pub fn counted_loop_from_step(ctx: &mut Context, start: i64, n: i64, step: i64)
     }
 }
 
+/// Where an offset loop's limit `n` comes from.
+#[derive(Debug, Clone, Copy)]
+pub enum OffsetBound {
+    /// A compile-time constant.
+    Const(i128),
+    /// The function's only argument, so the limit is known only at runtime.
+    Param,
+    /// The carried accumulator plus this constant, so both sides of the exit
+    /// test are computed from header arguments.
+    AccPlus(i128),
+}
+
+/// Build `while i + off <pred> n { acc += i; i += step }` in the shape mem2reg
+/// leaves it. A negative `off` is written `i - |off|`:
+///
+/// ```text
+///   preheader(n?):    acc0=0; i0=start;          goto header(acc0, i0)
+///   header(acc, i):   v = i + off; t = not(v <pred> n); cond_br t [exit(acc), latch]
+///   latch:            acc1=acc+i; i1=i+step;     goto header(acc1, i1)
+///   exit(result):     return result
+/// ```
+///
+/// All values have type `ty`. With [`OffsetBound::Param`] the function takes
+/// `n` as its only argument.
+pub fn offset_counted_loop(
+    ctx: &mut Context,
+    ty: TypedHandle<IntegerType>,
+    start: i128,
+    step: i128,
+    off: i128,
+    pred: CmpPred,
+    bound: OffsetBound,
+) -> CountedLoop {
+    offset_loop(ctx, ty, start, step, off, pred, bound, false)
+}
+
+/// The same loop with the counter expression on the right of the exit test:
+/// `while n <pred> i + off`. `pred` is the operator as written, so
+/// `n >= i + off` passes [`CmpPred::Ge`].
+pub fn offset_counted_loop_iv_on_right(
+    ctx: &mut Context,
+    ty: TypedHandle<IntegerType>,
+    start: i128,
+    step: i128,
+    off: i128,
+    pred: CmpPred,
+    bound: OffsetBound,
+) -> CountedLoop {
+    offset_loop(ctx, ty, start, step, off, pred, bound, true)
+}
+
+#[allow(clippy::too_many_arguments)]
+fn offset_loop(
+    ctx: &mut Context,
+    ty: TypedHandle<IntegerType>,
+    start: i128,
+    step: i128,
+    off: i128,
+    pred: CmpPred,
+    bound: OffsetBound,
+    iv_on_right: bool,
+) -> CountedLoop {
+    let i1 = i1(ctx);
+    let inputs = match bound {
+        OffsetBound::Param => vec![ty.into()],
+        OffsetBound::Const(_) | OffsetBound::AccPlus(_) => vec![],
+    };
+    let (module, region) = func(ctx, inputs.clone(), vec![ty.into()]);
+
+    let preheader = block(ctx, region, inputs);
+    let header = block(ctx, region, vec![ty.into(), ty.into()]); // (acc, i)
+    let latch = block(ctx, region, vec![]);
+    let exit = block(ctx, region, vec![ty.into()]);
+
+    let acc0 = iconst_i128(ctx, preheader, ty, 0);
+    let i0 = iconst_i128(ctx, preheader, ty, start);
+    goto(ctx, preheader, header, vec![acc0, i0]);
+
+    let acc = header.deref(ctx).get_argument(0);
+    let i = header.deref(ctx).get_argument(1);
+    let tested = if off < 0 {
+        let c = ic
```

**File**: `crates/mir-transforms/tests/induction.rs` (modified, +147/-1)
```diff
@@ -9,7 +9,10 @@
 
 mod common;
 
-use common::{counted_loop, counted_loop_from, mir_ctx, multi_latch_counted_loop};
+use common::{
+    CountedLoop, OffsetBound, counted_loop, counted_loop_from, i32t, i128t, mir_ctx,
+    multi_latch_counted_loop, offset_counted_loop, offset_counted_loop_iv_on_right, u32t,
+};
 use mir_transforms::analyses::induction::{ArgKind, CmpPred, analyze};
 use mir_transforms::analyses::loop_info::LoopInfo;
 use pliron::graph::dominance::DomInfo;
@@ -29,6 +32,21 @@ fn recurrences_for(n: i64) -> mir_transforms::analyses::induction::LoopRecurrenc
     analyze(&ctx, &info, id, ph)
 }
 
+/// Run the analysis on an already built loop.
+fn recurrences_of(
+    ctx: &pliron::context::Context,
+    lp: &CountedLoop,
+) -> mir_transforms::analyses::induction::LoopRecurrences {
+    let mut dom = DomInfo::default();
+    let info = {
+        let dt = dom.get_dom_tree(ctx, lp.region);
+        LoopInfo::compute(ctx, lp.region, dt)
+    };
+    let id = info.innermost_loop(lp.header).unwrap();
+    let ph = info.preheader(ctx, lp.region, id).unwrap();
+    analyze(ctx, &info, id, ph)
+}
+
 #[test]
 fn analyzes_counted_loop_recurrence() {
     // while i < 8 { acc += i; i += 1 }  =>  header args are (acc, i).
@@ -151,3 +169,131 @@ fn rejects_inconsistent_iv_steps_across_latches() {
     );
     assert_eq!(rec.trip_count, None);
 }
+
+/// `while i + 1 <= 4` tests the counter plus one. The analysis records the
+/// offset and normalizes the limit to `i <= 3`, so the loop runs four times.
+#[test]
+fn counter_plus_constant_exit_test_is_recognized() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 1, 1, CmpPred::Le, OffsetBound::Const(4));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 1);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Le));
+    assert_eq!(rec.bound, Some(3));
+    assert_eq!(rec.trip_count, Some(4));
+}
+
+/// `while i + 2 < 8` with `i += 2` runs for `i = 0, 2, 4`: three trips.
+#[test]
+fn counter_offset_and_step_combine_in_the_trip_count() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 2, 2, CmpPred::Lt, OffsetBound::Const(8));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 2);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Lt));
+    assert_eq!(rec.bound, Some(6));
+    assert_eq!(rec.trip_count, Some(3));
+}
+
+/// `while 8 >= i + 2` is the same test as `while i + 2 <= 8`: the predicate is
+/// swapped and the counter found on the right.
+#[test]
+fn counter_offset_on_the_right_side_is_swapped() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp =
+        offset_counted_loop_iv_on_right(&mut ctx, u32, 0, 1, 2, CmpPred::Ge, OffsetBound::Const(8));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, 2);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Le));
+    assert_eq!(rec.bound, Some(6));
+    assert_eq!(rec.trip_count, Some(7));
+}
+
+/// `while i - 1 < 4` has offset -1, so the normalized limit is `i < 5` and a
+/// signed counter from 0 runs five times.
+#[test]
+fn counter_minus_constant_exit_test_raises_the_limit() {
+    let mut ctx = mir_ctx();
+    let i32 = i32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, i32, 0, 1, -1, CmpPred::Lt, OffsetBound::Const(4));
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert_eq!(rec.primary_iv, Some(1));
+    assert_eq!(rec.iv_offset, -1);
+    assert_eq!(rec.continue_pred, Some(CmpPred::Lt));
+    assert_eq!(rec.bound, Some(5));
+    assert_eq!(rec.trip_count, Some(5));
+}
+
+/// `while i - 1 <= i128::MAX` would need the limit `i128::MAX + 1`, which the
+/// analysis cannot represent. It reports no exit test rather than a wrong one.
+#[test]
+fn counter_offset_whose_limit_overflows_is_not_recognized() {
+    let mut ctx = mir_ctx();
+    let i128 = i128t(&mut ctx);
+    let lp = offset_counted_loop(
+        &mut ctx,
+        i128,
+        0,
+        1,
+        -1,
+        CmpPred::Le,
+        OffsetBound::Const(i128::MAX),
+    );
+    let rec = recurrences_of(&ctx, &lp);
+
+    assert!(matches!(rec.args[1], ArgKind::BasicIv { init: 0, step: 1 }));
+    assert_eq!(rec.primary_iv, None);
+    assert_eq!(rec.bound, None);
+    assert_eq!(rec.continue_pred, None);
+    assert_eq!(rec.trip_count, None);
+}
+
+/// Unsigned constants in the offset and the limit must be zero-extended.
+/// `while i + 0x8000_0000 < 0x8000_0004` is a four-trip loop.
+#[test]
+fn high_bit_unsigned_offset_keeps_its_positive_value() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(
+        &mut ctx,
+        u32,
+        0,
+        1,
+        2_147_483_648,
+        CmpPred::Lt,
+        OffsetBound::Const(2_147_483_652),
+   
```

**File**: `crates/mir-transforms/tests/unroll.rs` (modified, +326/-4)
```diff
@@ -14,24 +14,30 @@
 mod common;
 
 use common::{
-    counted_loop, counted_loop_from_step, early_exit_counted_loop, early_exit_with_direct_liveout,
-    mir_ctx, multi_latch_counted_loop, multiple_exit_counted_loop, nested_counted_loop,
+    OffsetBound, counted_loop, counted_loop_from_step, early_exit_counted_loop,
+    early_exit_with_direct_liveout, mir_ctx, multi_latch_counted_loop, multiple_exit_counted_loop,
+    nested_counted_loop, offset_counted_loop, u32t,
 };
 use dialect_mir::ops::{
-    MirBitAndOp, MirCallOp, MirCondBranchOp, MirConstantOp, MirGeOp, MirReturnOp, MirUnrollHintOp,
+    MirAddOp, MirBitAndOp, MirCallOp, MirCondBranchOp, MirConstantOp, MirGeOp, MirGtOp, MirLeOp,
+    MirLtOp, MirNotOp, MirReturnOp, MirSubOp, MirUnrollHintOp,
 };
+use mir_transforms::analyses::induction::{CmpPred, analyze};
 use mir_transforms::unroll::unroll_annotated_loops;
 use pliron::attribute::Attribute;
 use pliron::builtin::attributes::{IntegerAttr, StringAttr};
 use pliron::builtin::ops::ConstantOp;
-use pliron::builtin::types::FunctionType;
+use pliron::builtin::types::{FunctionType, IntegerType, Signedness};
 use pliron::context::{Context, Ptr};
 use pliron::graph::{ControlFlowGraph, dominance::DomInfo};
 use pliron::linked_list::ContainsLinkedList;
 use pliron::op::Op;
 use pliron::operation::Operation;
 use pliron::pass::AnalysisManager;
 use pliron::region::Region;
+use pliron::r#type::{Typed, TypedHandle};
+use pliron::value::Value;
+use std::collections::HashMap;
 
 use mir_transforms::analyses::loop_info::LoopInfo;
 
@@ -545,3 +551,319 @@ fn huge_partial_unroll_factor_is_skipped_before_cloning() {
     assert_eq!(loop_count(&ctx, lp.region), 1, "the source loop remains");
     assert_eq!(hint_count(&ctx, lp.region), 0, "the request was consumed");
 }
+
+fn op_count<T: Op>(ctx: &Context, region: Ptr<Region>) -> usize {
+    operations(ctx, region)
+        .into_iter()
+        .filter(|&op| Operation::get_op::<T>(op, ctx).is_some())
+        .count()
+}
+
+/// The trip count the induction analysis computes for `lp`.
+fn analyzed_trip_count(ctx: &Context, lp: &common::CountedLoop) -> Option<u64> {
+    let info = loop_info(ctx, lp.region);
+    let id = info.innermost_loop(lp.header).unwrap();
+    let ph = info.preheader(ctx, lp.region, id).unwrap();
+    analyze(ctx, &info, id, ph).trip_count
+}
+
+/// Plant an unroll hint (`factor` 0 = full) in the latch and run the pass.
+fn unroll_offset_loop(ctx: &mut Context, lp: &common::CountedLoop, factor: u32) {
+    MirUnrollHintOp::new(ctx, factor)
+        .get_operation()
+        .insert_at_front(lp.latch, ctx);
+    let mut analyses = AnalysisManager::default();
+    unroll_annotated_loops(lp.module, ctx, &mut analyses).expect("unroll pass succeeds");
+    pliron::operation::verify_operation(lp.module, ctx).expect("valid IR after the pass");
+}
+
+/// `while i + 1 <= 4 { acc += i; i += 1 }` fully unrolls: no loop is left and
+/// the function returns the constant `0 + 1 + 2 + 3`.
+#[test]
+fn full_unroll_of_a_counter_offset_exit_test_folds_the_sum() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 1, 1, CmpPred::Le, OffsetBound::Const(4));
+
+    unroll_offset_loop(&mut ctx, &lp, 0);
+
+    assert_eq!(loop_count(&ctx, lp.region), 0);
+    assert_eq!(sole_return_constant(&ctx, lp.region), Some(6));
+}
+
+/// `while i + 2 <= u32::MAX` from `u32::MAX - 5`: the analysis counts four
+/// trips, but at the fifth test `i + 2` wraps to 0, which is still `<= MAX`, so
+/// the source loop keeps going. Full unroll must skip it.
+#[test]
+fn full_unroll_skips_a_counter_offset_that_wraps_at_the_last_test() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let max = i128::from(u32::MAX);
+    let lp = offset_counted_loop(
+        &mut ctx,
+        u32,
+        max - 5,
+        1,
+        2,
+        CmpPred::Le,
+        OffsetBound::Const(max),
+    );
+    assert_eq!(
+        analyzed_trip_count(&ctx, &lp),
+        Some(4),
+        "the analysis recognizes the test; only the wrap check may refuse it"
+    );
+
+    unroll_offset_loop(&mut ctx, &lp, 0);
+
+    assert_eq!(loop_count(&ctx, lp.region), 1, "the source loop remains");
+    assert_eq!(hint_count(&ctx, lp.region), 0, "the request was consumed");
+}
+
+/// `while i - 1 < 4` with an unsigned counter from 0: `0 - 1` wraps to
+/// `u32::MAX`, so the source loop runs zero times, not five. Full unroll must
+/// skip it.
+#[test]
+fn full_unroll_skips_a_counter_offset_that_wraps_at_the_first_test() {
+    let mut ctx = mir_ctx();
+    let u32 = u32t(&mut ctx);
+    let lp = offset_counted_loop(&mut ctx, u32, 0, 1, -1, CmpPred::Lt, OffsetBound::Const(4));
+    assert_eq!(
+        analyzed_trip_count(&ctx, &lp),
+        Some(5),
+        "the analysis recognizes the test; only the wrap check may refuse it"
+    );
+
+    unroll_offset_loop(&mut ctx, &lp, 0);
+
+    assert_eq!(loop_count(&ctx, lp.region), 1, "the sour
```

**File**: `crates/rustc-codegen-cuda/examples/unroll_smoke/src/main.rs` (modified, +81/-0)
```diff
@@ -394,6 +394,54 @@ mod kernels {
             *out_elem = acc;
         }
     }
+
+    /// Exit tests that compare the counter plus a constant, the way one writes
+    /// "stop when a whole tile no longer fits". `while i + 1 <= 4` fully unrolls
+    /// like `while i < 4` (`1 + 4 + 16 + 64 = 85`); the tile walk
+    /// `while d + 2 <= 8` visits `0 + 2 + 4 + 6 = 12`; and `#[unroll(4)]` on
+    /// `while j + 1 <= n` sums `j` over `0..n`, `n*(n-1)/2`.
+    #[allow(clippy::int_plus_one)]
+    #[kernel]
+    pub fn offset_exit_tests(
+        mut bits: DisjointSlice<u32>,
+        mut walk: DisjointSlice<u32>,
+        mut partial: DisjointSlice<u32>,
+        n: u32,
+    ) {
+        let (Some(bits), Some(walk), Some(partial)) = (
+            bits.get_mut(thread::index_1d()),
+            walk.get_mut(thread::index_1d()),
+            partial.get_mut(thread::index_1d()),
+        ) else {
+            return;
+        };
+        let mut set = 0u32;
+        let mut i = 0usize;
+        #[unroll]
+        while i + 1 <= 4 {
+            set |= 1u32 << (2 * i);
+            i += 1;
+        }
+        const TILE: usize = 2;
+        const WIDTH: usize = 8;
+        let mut visited = 0u32;
+        let mut d = 0usize;
+        #[unroll]
+        while d + TILE <= WIDTH {
+            visited += d as u32;
+            d += TILE;
+        }
+        let mut sum = 0u32;
+        let mut j = 0u32;
+        #[unroll(4)]
+        while j + 1 <= n {
+            sum = sum.wrapping_add(j);
+            j += 1;
+        }
+        *bits = set;
+        *walk = visited;
+        *partial = sum;
+    }
 }
 
 fn main() {
@@ -529,6 +577,39 @@ fn main() {
         .expect("launch outer_partial");
     let got_opart = d_opart.to_host_vec(&stream).unwrap();
 
+    for offset_trip in [7u32, 16] {
+        let mut d_bits = DeviceBuffer::<u32>::zeroed(&stream, N).unwrap();
+        let mut d_walk = DeviceBuffer::<u32>::zeroed(&stream, N).unwrap();
+        let mut d_offset_part = DeviceBuffer::<u32>::zeroed(&stream, N).unwrap();
+        // SAFETY: each thread writes its own element in three separate buffers.
+        unsafe {
+            module.offset_exit_tests(
+                stream.as_ref(),
+                cfg,
+                &mut d_bits,
+                &mut d_walk,
+                &mut d_offset_part,
+                offset_trip,
+            )
+        }
+        .expect("launch offset_exit_tests");
+        assert_eq!(
+            d_bits.to_host_vec(&stream).unwrap(),
+            vec![85; N],
+            "offset exit test `i + 1 <= 4`"
+        );
+        assert_eq!(
+            d_walk.to_host_vec(&stream).unwrap(),
+            vec![12; N],
+            "tile walk `d + 2 <= 8`"
+        );
+        assert_eq!(
+            d_offset_part.to_host_vec(&stream).unwrap(),
+            vec![offset_trip * (offset_trip - 1) / 2; N],
+            "partial offset exit test `j + 1 <= {offset_trip}`"
+        );
+    }
+
     let mut failures = 0usize;
     let want_part = trip * (trip - 1) / 2;
     let want_fold: u32 = (0..trip).map(|i| i & 3).sum();
```

---

### Incident Patch 15: `c363b927` (2026-09-24)
**Commit Message**: Merge pull request #1307 from letv1nnn/fix/doctor-clang-versioned-name

fix(cargo-oxide): probe versioned clang binaries in doctor

**File**: `crates/cargo-oxide/src/commands/doctor.rs` (modified, +30/-15)
```diff
@@ -14,6 +14,23 @@ use super::*;
 // Doctor command
 // =============================================================================
 
+/// Find the first compiler that can report a non-empty resource directory.
+/// Probe the required operation directly: `--version` alone does not establish
+/// that a wrapper or incomplete installation can answer this query.
+pub(super) fn clang_resource_dir<'a>(candidates: &[&'a str]) -> Option<(&'a str, String)> {
+    candidates.iter().find_map(|&name| {
+        let output = Command::new(name)
+            .arg("-print-resource-dir")
+            .output()
+            .ok()?;
+        if !output.status.success() {
+            return None;
+        }
+        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
+        (!dir.is_empty()).then_some((name, dir))
+    })
+}
+
 /// Parsed contents of a `rust-toolchain.toml` pin.
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub(crate) struct RustToolchainPin {
@@ -678,28 +695,26 @@ pub fn doctor(ctx: &Context) {
     // leave `/usr/lib/clang/*/include` empty and bindgen explodes with a
     // mysterious "'stddef.h' file not found". Catch that up front.
     print!("clang / libclang resource dir... ");
-    let clang_resource_dir = Command::new("clang")
-        .arg("-print-resource-dir")
-        .output()
-        .ok()
-        .filter(|o| o.status.success())
-        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
-    match clang_resource_dir {
-        Some(ref dir) if std::path::Path::new(&format!("{}/include/stddef.h", dir)).exists() => {
-            println!("✓ {}", dir);
+    let clangs = [
+        "clang", "clang-22", "clang-21", "clang-20", "clang-19", "clang-18", "clang-17",
+        "clang-16", "clang-15",
+    ];
+
+    match clang_resource_dir(&clangs) {
+        Some((name, ref dir))
+            if std::path::Path::new(&format!("{}/include/stddef.h", dir)).exists() =>
+        {
+            println!("✓ {dir} (via {name})");
         }
-        Some(ref dir) => {
-            println!(
-                "✗ resource dir present but `include/stddef.h` missing: {}",
-                dir
-            );
+        Some((name, ref dir)) => {
+            println!("✗ resource dir present but `include/stddef.h` missing: {dir} (via {name})");
             eprintln!("  Host `cuda-bindings` uses bindgen, which needs clang's own stddef.h.");
             eprintln!("  Install the matching dev headers: sudo apt install clang-21");
             eprintln!("  (or libclang-common-21-dev)");
             ok = false;
         }
         None => {
-            println!("✗ clang not found");
+            println!("✗ no clang could report its resource directory");
             eprintln!(
                 "  Host `cuda-bindings` uses bindgen, which needs clang + its resource headers."
             );
```

**File**: `crates/cargo-oxide/src/commands/tests.rs` (modified, +52/-0)
```diff
@@ -144,6 +144,58 @@ fn unique_temp_dir(prefix: &str) -> PathBuf {
     std::env::temp_dir().join(format!("{}_{}_{}", prefix, std::process::id(), unique))
 }
 
+#[cfg(unix)]
+fn doctor_clang_fixture(root: &Path, name: &str, resource_response: &str) -> String {
+    use std::os::unix::fs::PermissionsExt;
+
+    let path = root.join(name);
+    fs::write(
+        &path,
+        format!(
+            "#!/bin/sh\ncase \"$1\" in\n--version) echo clang; exit 0;;\n-print-resource-dir) {resource_response};;\nesac\nexit 1\n"
+        ),
+    )
+    .unwrap();
+    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
+    path.to_string_lossy().into_owned()
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_falls_back_after_absent_failed_and_empty_probes() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_fallback");
+    fs::create_dir_all(&root).unwrap();
+    let absent = root.join("clang").to_string_lossy().into_owned();
+    let failed = doctor_clang_fixture(&root, "clang-22", "exit 1");
+    let empty = doctor_clang_fixture(&root, "clang-21", "printf '   \n'; exit 0");
+    let working = doctor_clang_fixture(
+        &root,
+        "clang-20",
+        "printf ' /clang/resource dir \n'; exit 0",
+    );
+    assert_eq!(
+        clang_resource_dir(&[&absent, &failed, &empty, &working]),
+        Some((working.as_str(), "/clang/resource dir".to_string()))
+    );
+    assert_eq!(clang_resource_dir(&[&absent, &failed, &empty]), None);
+    fs::remove_dir_all(root).unwrap();
+}
+
+#[cfg(unix)]
+#[test]
+fn doctor_clang_resource_prefers_the_first_successful_candidate() {
+    let root = unique_temp_dir("cargo_oxide_doctor_clang_precedence");
+    fs::create_dir_all(&root).unwrap();
+    let bare = doctor_clang_fixture(&root, "clang", "printf '/bare/resource\n'; exit 0");
+    let versioned =
+        doctor_clang_fixture(&root, "clang-22", "printf '/versioned/resource\n'; exit 0");
+    assert_eq!(
+        clang_resource_dir(&[&bare, &versioned]),
+        Some((bare.as_str(), "/bare/resource".to_string()))
+    );
+    fs::remove_dir_all(root).unwrap();
+}
+
 /// The examples walk backing `cargo oxide fmt` must reach nested manifests
 /// and skip build directories.
 ///
```

#### Recent Merged Pull Requests:
- **PR #1383** (closed): fix: reject oversized cuTile partition dimensions (@Rachit2323)
- **PR #1369** (2026-10-02): refactor: lift shared host crates to the git root (@roivanov)
- **PR #1368** (2026-10-01): refactor: nest the CUDA Oxide SIMT tree under cuda-oxide (@roivanov)
- **PR #1366** (2026-09-30): Import cutile-rs v0.4.0 under cutile-rs (@roivanov)
- **PR #1362** (2026-09-29): ci: increase CodeQL analysis timeout (@roivanov)
- **PR #1347** (closed): mir-lower: avoid emitting same-width llvm.trunc in shift lowering (@amansahani)
- **PR #1339** (closed): bench(cuda-device): add paired warp reduction measurements (@0z5a)
- **PR #1327** (2026-09-24): fix(mir-lower): support packed AS3 carrier local projections (@uurl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
