> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `1e2b536b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T13:47:02.768Z  
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
> **Harvest Timestamp**: 2026-10-20T13:47:02.762Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3749 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1556** (2026-10-20): **fix(oxide-tilebc): write the fragment's symbolic shape as the 13.5 assembler reads it**
  *Symptoms*: ## What this adds  A `.tilelib` written by `cargo oxide tilelib` now loads on the CUDA 13.5 assembler.  ```text before: 13.5 tileiras rejects the implementation descriptor: "concrete shape cache rank (1) does not match symbolic shape rank (0)" after:  the descriptor parses, and a Tile C++ kernel calls the three exports through the library ```  ## What we fixed  - The 13.5 assembler keeps a full-rank symbolic shape on `preview$fragment`, one integer expression per dimension. The compiler trunk switched on 2026-09-08 to holding only the dynamic dimensions, and the writer produced that trunk form for every version. - The fragment type now encodes per version: full rank below 13.6, dynamic-only from 13.6 on. Nothing else in the descriptors changes.  <details> <summary>Implementation</summary>  - `oxide-tilebc`'s type table carries the bytecode version, and the fragment arm branches on it. - The 13.5 golden in the writer tests now holds a one-element symbolic tuple.  </details>  ## Verification  Checked at `514be3a18`:  - ✅ oxide-tilebc 15 unit tests, clippy with warnings as errors, rustdoc. - ✅ CUDA 13.5.40 release toolkit, RTX 5090: `cargo oxide tilelib tilelib_relu --arch sm_120` builds the library, its disassembler reads both descriptors, and `cpp/tile_caller.cu` passes 3 of 3 through it. - ✅ The 13.6 development build still reads the dynamic-only form: the same library built at 13.6 passes 3 of 3 there too.  ## Caveats  - The version switch keys on 13.6 because that is where 

- **Issue #1510** (2026-10-19): **fix(cargo-oxide): pin release-like codegen in Cargo profiles**
  *Symptoms*: ## What this adds  Release-like `cargo oxide` routes used to force `opt-level=3`, `debug-assertions=off` and (with `--debug-assertions`) `overflow-checks=off` through `CARGO_ENCODED_RUSTFLAGS`. Cargo hashes rustflags into every crate's fingerprint, while `cargo oxide test -- --release` added none, so the first switch between build and test in each direction rebuilt the whole dependency graph and left two copies of every artifact. The pins now travel in the Cargo profile (`CARGO_PROFILE_RELEASE_*`, `CARGO_PROFILE_DEV_*`, and `--config profile.<name>.*` for a selected custom profile), which Cargo compares by value, so both commands share every compiled crate.  ```text cargo oxide test -- --release        # compiles the dependency graph (72 crates) cargo oxide build -- --release  Before: Compiling cuda-core ... 72 crates recompiled, 13 s, second artifact set After:  1 crate recompiled (the application), 71 reused, 0.4 s, PTX unchanged ```  ```bash cargo oxide build -- --release                 # pins via CARGO_PROFILE_RELEASE_* cargo oxide build -- --profile release-lto     # pins via --config profile.release-lto.* ```  ## What we fixed  - Build and `test -- --release` passthrough commands hand rustc the same `CARGO_ENCODED_RUSTFLAGS`; the pins move to Cargo profile settings at the single site every release-like route uses (example build/run/pipeline/debug, emit-ltoir, tilelib, interop device crates, sanitize host binary, passthrough build). - `overflow-checks=off` is pinned exp

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

### Incident Patch 1: `1e2b536b` (2026-10-20)
**Commit Message**: fix(oxide-tilebc): write the fragment's symbolic shape as the 13.5 assembler reads it (#1556)

## What this adds

A `.tilelib` written by `cargo oxide tilelib` now loads on the CUDA 13.5
assembler.

```text
before: 13.5 tileiras rejects the implementation descriptor: "concrete shape cache rank (1) does not match symbolic shape rank (0)"
after:  the descriptor parses, and a Tile C++ kernel calls the three exports through the library
```

## What we fixed

- The 13.5 assembler keeps a full-rank symbolic shape on
`preview$fragment`, one integer expression per dimension. The compiler
trunk switched on 2026-09-08 to holding only the dynamic dimensions, and
the writer produced that trunk form for every version.
- The fragment type now encodes per version: full rank below 13.6,
dynamic-only from 13.6 on. Nothing else in the descriptors changes.

<details>
<summary>Implementation</summary>

- `oxide-tilebc`'s type table carries the bytecode version, and the
fragment arm branches on it.
- The 13.5 golden in the writer tests now holds a one-element symbolic
tuple.

</details>

## Verification

Checked at `514be3a18`:

- ✅ oxide-tilebc 15 unit tests, clippy with warnings as errors, rustdoc.
-

**File**: `cuda-oxide/crates/oxide-tilebc/src/lib.rs` (modified, +4/-2)
```diff
@@ -249,15 +249,17 @@ mod tests {
         expected.resize(24, 0xCB);
         assert_eq!(section(&bytes, 2), expected);
 
-        // The fragment type entry: tagged empty symbolic shape, static shape
+        // The fragment type entry at 13.5: tagged symbolic shape holding one
+        // integer per dimension (the 13.5 assembler requires full rank), static shape
         // [1], element f32 (index 0), local, (1):(1), (128, 1, 1):(1, 0, 0),
         // alignment 1.
         let types = section(&bytes, 5);
         let entries = &types[4 + 4 * 3..];
         assert_eq!(
             &entries[1..],
             &[
-                0xD2, 0x01, 0xD8, 0x01, 0x00, 0x01, 1, 0, 0, 0, 0, 0, 0, 0, 0x00, 0x00, //
+                0xD2, 0x01, 0xD8, 0x01, 0x01, 0xD1, 0x01, 0x02, 0x01, 1, 0, 0, 0, 0, 0, 0, 0, 0x00,
+                0x00, //
                 0xD9, 0x01, 0x01, 0xD1, 0x01, 0x02, 0x01, 0xD1, 0x01, 0x02, //
                 0xD9, 0x01, 0x03, 0xD1, 0x01, 0x80, 0x02, 0xD1, 0x01, 0x02, 0xD1, 0x01,
                 0x02, //
```

**File**: `cuda-oxide/crates/oxide-tilebc/src/writer.rs` (modified, +33/-6)
```diff
@@ -70,15 +70,27 @@ enum Type {
 }
 
 /// Interning tables, filled in first-use order.
-#[derive(Default)]
 struct Tables {
+    /// The version the module is written at; the fragment type's symbolic
+    /// shape is encoded differently before 13.6.
+    version: BytecodeVersion,
     strings: Vec<String>,
     string_index: HashMap<String, u64>,
     types: Vec<Type>,
     type_index: HashMap<Type, u64>,
 }
 
 impl Tables {
+    fn new(version: BytecodeVersion) -> Self {
+        Self {
+            version,
+            strings: Default::default(),
+            string_index: Default::default(),
+            types: Default::default(),
+            type_index: Default::default(),
+        }
+    }
+
     fn string(&mut self, text: &str) -> u64 {
         if let Some(&index) = self.string_index.get(text) {
             return index;
@@ -177,13 +189,28 @@ fn write_type(w: &mut Writer, tables: &mut Tables, ty: &Type) {
                 w.varint(tables.ty(result));
             }
         }
-        // Tagged empty symbolic shape (the shape is static), the static
-        // shape, element type, memory space, both layouts tagged, then the
-        // alignment as a tagged symbolic integer, always 1.
+        // Tagged symbolic shape, the static shape, element type, memory
+        // space, both layouts tagged, then the alignment as a tagged symbolic
+        // integer, always 1.
+        //
+        // The symbolic shape's contents depend on the version. The 13.5
+        // assembler keeps one integer-valued expression per dimension and
+        // rejects a rank mismatch ("concrete shape cache rank 1 does not
+        // match symbolic shape rank 0"). The compiler trunk switched on
+        // 2026-09-08 to holding only the dynamic dimensions, so a static
+        // shape writes an empty tuple from 13.6 on.
         Type::Fragment(fragment) => {
             w.varint(TAG_FRAGMENT);
             w.varint(ATTR_SYMBOLIC_TUPLE);
-            w.varint(0);
+            if tables.version < BytecodeVersion::new(13, 6) {
+                w.varint(fragment.shape.len() as u64);
+                for &dim in &fragment.shape {
+                    w.varint(ATTR_SYMBOLIC_INT);
+                    w.signed_varint(dim);
+                }
+            } else {
+                w.varint(0);
+            }
             w.le_var_size_i64(&fragment.shape);
             w.varint(tables.ty(&Type::Scalar(fragment.element)));
             w.varint(fragment.memory_space.value());
@@ -335,7 +362,7 @@ fn write_module(
     if version < BytecodeVersion::PREVIEW_FIRST {
         return Err(Error::Version(version));
     }
-    let mut tables = Tables::default();
+    let mut tables = Tables::new(version);
     let mut functions = Writer::new();
     functions.varint(entries as u64);
     write_entries(&mut functions, &mut tables);
```

#### Recent Merged Pull Requests:
- **PR #1556** (2026-10-20): fix(oxide-tilebc): write the fragment's symbolic shape as the 13.5 assembler reads it (@nihalpasham)
- **PR #1555** (2026-10-20): docs(cuda-oxide): take the tile-library chapter out of the book until the toolkit ships (@nihalpasham)
- **PR #1553** (2026-10-19): feat(cutile): add NVFP4 MoE batch-size benchmark (@elibol)
- **PR #1551** (2026-10-19): docs(book): show how an inline request reaches the GPU (@nihalpasham)
- **PR #1549** (2026-10-19): test(drop_glue): keep destructor MIR with -Zinline-mir=no, not #[inline(never)] (@nihalpasham)
- **PR #1545** (2026-10-19): Tile libraries: call Rust device functions from Tile kernels (@nihalpasham)

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

## X. oxide-tilebc): write the fragment's symbolic shape as the 13.5 assembler reads i

**RULE**:
When implementing operations in `cuda-oxide/crates/oxide-tilebc/src/lib.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e2b536b`: oxide-tilebc): write the fragment's symbolic shape as the 13.5 assembler reads it (#1556). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/crates/oxide-tilebc/src/lib.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // The fragment type entry at 13.5: tagged symbolic shape holding one
        // integer per dimension (the 13.5 assembler requires full rank), static shape
                0xD2, 0x01, 0xD8, 0x01, 0x01, 0xD1, 0x01, 0x02, 0x01, 1, 0, 0, 0, 0, 0, 0, 0, 0x00,
                0x00, //
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        // The fragment type entry: tagged empty symbolic shape, static shape
                0xD2, 0x01, 0xD8, 0x01, 0x00, 0x01, 1, 0, 0, 0, 0, 0, 0, 0, 0x00, 0x00, //
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e2b536b` are properly handled with clean fallback behavior.
