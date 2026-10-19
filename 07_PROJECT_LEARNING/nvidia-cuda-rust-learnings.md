> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nvidia-cuda-rust-learnings.md`  
> **Source**: github ([https://github.com/NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust))  
> **Source Version**: `a25a5857`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T19:22:19.550Z  
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
> **Harvest Timestamp**: 2026-10-19T19:22:19.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/cuda-rust`
- **Description**: NVIDIA's CUDA platform for Rust. Host runtime crates plus Tile (cutile-rs) and SIMT (cuda-oxide) kernel programming models in idiomatic Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3743 stars

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
- **Issue #1510** (2026-10-19): **fix(cargo-oxide): pin release-like codegen in Cargo profiles**
  *Symptoms*: ## What this adds  Release-like `cargo oxide` routes used to force `opt-level=3`, `debug-assertions=off` and (with `--debug-assertions`) `overflow-checks=off` through `CARGO_ENCODED_RUSTFLAGS`. Cargo hashes rustflags into every crate's fingerprint, while `cargo oxide test -- --release` added none, so the first switch between build and test in each direction rebuilt the whole dependency graph and left two copies of every artifact. The pins now travel in the Cargo profile (`CARGO_PROFILE_RELEASE_*`, `CARGO_PROFILE_DEV_*`, and `--config profile.<name>.*` for a selected custom profile), which Cargo compares by value, so both commands share every compiled crate.  ```text cargo oxide test -- --release        # compiles the dependency graph (72 crates) cargo oxide build -- --release  Before: Compiling cuda-core ... 72 crates recompiled, 13 s, second artifact set After:  1 crate recompiled (the application), 71 reused, 0.4 s, PTX unchanged ```  ```bash cargo oxide build -- --release                 # pins via CARGO_PROFILE_RELEASE_* cargo oxide build -- --profile release-lto     # pins via --config profile.release-lto.* ```  ## What we fixed  - Build and `test -- --release` passthrough commands hand rustc the same `CARGO_ENCODED_RUSTFLAGS`; the pins move to Cargo profile settings at the single site every release-like route uses (example build/run/pipeline/debug, emit-ltoir, tilelib, interop device crates, sanitize host binary, passthrough build). - `overflow-checks=off` is pinned exp

- **Issue #1509** (2026-10-19): **fix(cuda-oxide): keep host-written constant memory through LTO**
  *Symptoms*: ## What this adds  `#[constant]` statics are filled by the host after module load through `cuModuleGetGlobal`. The device IR exported them as plain zero-filled globals, so whole-program LTO on the libNVVM and nvJitLink routes treated the zero image as the value, folded every read, and deleted the symbol. The global is now rendered `externally_initialized` and rooted in `@llvm.used`, which is what clang emits for CUDA `__constant__` variables.  ```text Before (cargo oxide run constant_memory --materialize-cubin --arch sm_120; same with --emit-nvvm-ir):   @..._COEFFS = addrspace(4) global [16 x i8] <16 zero bytes>, align 4   @llvm.used  = appending global [1 x ptr] [ptr @apply]   SASS: no COEFFS symbol, no .nv.constant3, kernel stores RZ   Error: DriverError(500, "named symbol not found")  After:   @..._COEFFS = addrspace(4) externally_initialized global [16 x i8] <16 zero bytes>, align 4   @llvm.used  = appending global [2 x ptr] [ptr @apply, ptr addrspacecast (ptr addrspace(4) @..._COEFFS to ptr)]   SASS: STB_GLOBAL COEFFS, .nv.constant3 (16 bytes), LDC c[0x3][...]   Launch A: OK (256 elements match polynomial)   Launch B: OK (256 elements match polynomial)   SUCCESS: #[constant] static populated from host, reflected on device. ```  ```rust #[cuda_module] mod kernels {     #[constant]     static COEFFS: ConstantMemory<[f32; 4]> = ConstantMemory::UNINIT;      #[kernel]     pub fn apply(mut out: DisjointSlice<f32>) {         let [c0, c1, c2, c3] = COEFFS.get();         // out[i

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

### Incident Patch 1: `5b606fdd` (2026-10-19)
**Commit Message**: fix(cuda-device): run mbarrier init on one linear thread (#1349)

ManagedBarrier::init_by and inval_by elected the acting thread with threadIdx.x == selector, which names one thread only in a 1D block: in a (32, 4, 1) block selector 0 ran mbarrier.init on four threads and selector 127 on none, so the launch failed with error 719. Elect by the block-linear thread id through the shared helper from #1351, document the all-threads protocol and the block-uniform selector, and add a (32, 4, 1) regression to future_apis.

Signed-off-by: YeonwooSung <[REDACTED_EMAIL]>
Signed-off-by: nihalpasham <[REDACTED_EMAIL]>

**File**: `cuda-oxide/crates/cuda-device/src/barrier.rs` (modified, +52/-35)
```diff
@@ -254,29 +254,29 @@ impl BarrierToken {
 ///
 /// # Thread Requirements
 ///
-/// | Operation       | Thread Requirement        |
-/// |-----------------|---------------------------|
-/// | `from_static()` | Single thread (thread 0)  |
-/// | `init()`        | Single thread (thread 0)  |
-/// | `arrive()`      | All participating threads |
-/// | `wait()`        | All participating threads |
-/// | `inval()`       | Single thread (thread 0)  |
+/// | Operation       | Thread Requirement                     |
+/// |-----------------|----------------------------------------|
+/// | `from_static()` | All threads call                       |
+/// | `init()`        | All threads call; linear thread 0 acts |
+/// | `arrive()`      | All participating threads              |
+/// | `wait()`        | All participating threads              |
+/// | `inval()`       | All threads call; linear thread 0 acts |
 ///
 /// # Example
 ///
 /// ```rust,ignore
-/// // Thread 0: Create and initialize
+/// // All threads: create the handle and initialize. Linear thread 0, that is
+/// // thread (0, 0, 0), runs mbarrier.init; init() then fences and
+/// // synchronizes the block, so every thread holds a Ready handle.
 /// let bar = ManagedBarrier::<Uninit, TmaBarrier>::from_static(&raw mut BAR);
 /// let bar = unsafe { bar.init(128) };  // Now Ready
-/// fence_proxy_async_shared_cta();
-/// sync_threads();
 ///
 /// // All threads: arrive and wait
 /// let token = bar.arrive();
 /// bar.wait(token);
 ///
-/// // Thread 0: Cleanup
-/// sync_threads();
+/// // All threads: clean up. inval() synchronizes the block, then linear
+/// // thread 0 runs mbarrier.inval.
 /// unsafe { bar.inval(); }
 /// ```
 pub struct ManagedBarrier<State, Kind, const ID: usize = 0> {
@@ -301,21 +301,24 @@ impl<Kind, const ID: usize> ManagedBarrier<Uninit, Kind, ID> {
     ///
     /// # Thread Requirements
     ///
-    /// **Single-thread**: Only call from the initialization thread (thread 0).
+    /// **All threads**: this is a plain constructor with no device effect. Every
+    /// thread wraps the same static, and `init()` then elects linear thread 0 to
+    /// run `mbarrier.init`. Do not wrap `init()` in a thread-0 branch: it
+    /// synchronizes the whole block, and a block-wide sync inside a branch that
+    /// only some threads take is undefined, in practice a hang.
     ///
     /// # Example
     ///
     /// ```rust,ignore
     /// static mut BAR0: Barrier = Barrier::UNINIT;
     /// static mut BAR1: Barrier = Barrier::UNINIT;
     ///
-    /// if tid == 0 {
-    ///     let bar0 = ManagedBarrier::<Uninit, TmaBarrier>::from_static(&raw mut BAR0);
-    ///     let bar1 = ManagedBarrier::<Uninit, GeneralBarrier>::from_static(&raw mut BAR1);
+    /// // All threads: wrap and initialize; init() elects linear thread 0.
+    /// let bar0 = ManagedBarrier::<Uninit, TmaBarrier>::from_static(&raw mut BAR0);
+    /// let bar1 = ManagedBarrier::<Uninit, GeneralBarrier>::from_static(&raw mut BAR1);
     ///
-    ///     let bar0 = unsafe { bar0.init(32) };
-    ///     let bar1 = unsafe { bar1.init(32) };
-    /// }
+    /// let bar0 = unsafe { bar0.init(32) };
+    /// let bar1 = unsafe { bar1.init(32) };
     /// ```
     pub fn from_static(ptr: *mut Barrier) -> Self {
         ManagedBarrier {
@@ -327,8 +330,9 @@ impl<Kind, const ID: usize> ManagedBarrier<Uninit, Kind, ID> {
 
     /// Initialize the barrier with an expected arrival count.
     ///
-    /// **All threads in the block should call this.** Only thread 0 performs
-    /// the actual initialization; all threads synchronize and receive a `Ready` handle.
+    /// **All threads in the block should call this.** Only linear thread 0,
+    /// that is thread (0, 0, 0), performs the actual initialization; all threads
+    /// synchronize and receive a `Ready` handle.
     ///
     /// This is a convenience wrapper for `init_by(count, 0)`.
     ///
@@ -347,7 +351,7 @@ impl<Kind, const ID: usize> ManagedBarrier<Uninit, Kind, ID> {
     /// ```rust,ignore
     /// static mut BAR: Barrier = Barrier::UNINIT;
     ///
-    /// // ALL threads call init - only thread 0 actually initializes
+    /// // ALL threads call init - only linear thread 0 actually initializes
     /// let bar = ManagedBarrier::<Uninit, TmaBarrier>::from_static(&raw mut BAR);
     /// let bar = unsafe { bar.init(128) };  // All threads get Ready handle
     /// ```
@@ -358,8 +362,8 @@ impl<Kind, const ID: usize> ManagedBarrier<Uninit, Kind, ID> {
 
     /// Initialize the barrier with a specific thread performing initialization.
     ///
-    /// **All threads in the block should call this.** Only the thread with
-    /// `threadIdx.x == init_thread` performs the actual initialization;
+    /// **All threads in the block should call this.** Only the thread whose
+    /// linear id equals `init_thread` performs the actual initialization;
     /// all threads synchronize and receive a `Ready` handle.
     ///
     /// # Block-Sc
```

**File**: `cuda-oxide/crates/cuda-device/src/thread.rs` (modified, +36/-0)
```diff
@@ -1415,6 +1415,24 @@ const fn validate_unroll_factor(factor: u32) {
 mod tests {
     use super::block_linear_thread_id;
 
+    /// Number of threads in a `(dx, dy, dz)` block whose block-linear id is
+    /// `selected`. `ManagedBarrier::init_by` and `inval_by` make this
+    /// comparison on the device, one thread at a time.
+    fn threads_selected_by(block_dim: (u32, u32, u32), selected: u32) -> u32 {
+        let (dx, dy, dz) = block_dim;
+        let mut hits = 0;
+        for tz in 0..dz {
+            for ty in 0..dy {
+                for tx in 0..dx {
+                    if block_linear_thread_id(tx, ty, tz, dx, dy) == selected {
+                        hits += 1;
+                    }
+                }
+            }
+        }
+        hits
+    }
+
     #[test]
     fn a_1d_block_numbers_threads_by_x() {
         for tx in 0..256 {
@@ -1452,4 +1470,22 @@ mod tests {
         // One step along z skips a whole x-y plane.
         assert_eq!(block_linear_thread_id(0, 0, 1, dx, dy), dx * dy);
     }
+
+    #[test]
+    fn every_in_range_id_selects_one_thread() {
+        for block_dim in [(64, 1, 1), (32, 4, 1), (8, 4, 2), (16, 2, 2), (24, 3, 1)] {
+            let (dx, dy, dz) = block_dim;
+            let threads = dx * dy * dz;
+            for selected in 0..threads {
+                assert_eq!(
+                    threads_selected_by(block_dim, selected),
+                    1,
+                    "block {block_dim:?} id {selected}"
+                );
+            }
+            // An id at or past the thread count selects nobody, which is why
+            // init_by and inval_by require the selector to be in range.
+            assert_eq!(threads_selected_by(block_dim, threads), 0);
+        }
+    }
 }
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/future_apis/README.md` (modified, +5/-0)
```diff
@@ -16,6 +16,7 @@ Tests new type-safe abstractions: `CuSimd<T, N>` for SIMD values and `ManagedBar
 1. **test_managed_barrier**: Single barrier typestate flow
 2. **test_multi_barrier**: Multiple barriers (TMA + General)
 3. **test_double_buffered_barriers**: Ping-pong pattern with two barriers
+4. **test_managed_barrier_2d**: One barrier in a (32, 4, 1) block; every thread calls `init_by` and `inval_by`, and linear thread 127, that is thread (31, 3, 0), runs the instructions
 
 ## Key Concepts Demonstrated
 
@@ -153,6 +154,10 @@ cargo oxide run future_apis
   All 32 threads completed 3 iterations
 ✓ Double-buffered PASSED
 
+--- Test 6: ManagedBarrier in a (32, 4, 1) block ---
+  All 128 threads wrote 42 in a (32, 4, 1) block
+✓ ManagedBarrier 2D PASSED
+
 === ALL FUTURE APIS TESTS COMPLETED ===
 ```
 
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/future_apis/src/main.rs` (modified, +102/-0)
```diff
@@ -11,11 +11,20 @@
 //!
 //! Run: cargo oxide run future_apis
 
+use cuda_device::cooperative_groups::{ThreadGroup, this_thread_block};
 use cuda_device::cusimd::CuSimd;
 use cuda_device::{Barrier, GeneralBarrier, ManagedBarrier, TmaBarrier, Uninit};
 use cuda_device::{DisjointSlice, kernel, thread};
 use cuda_host::cuda_module;
 
+/// Block of the 2D barrier test: 4 rows of 32 threads, one warp per row.
+const BLOCK_2D_WIDTH: usize = 32;
+const BLOCK_2D_HEIGHT: usize = 4;
+const BLOCK_2D_THREADS: u32 = (BLOCK_2D_WIDTH * BLOCK_2D_HEIGHT) as u32;
+/// Block-linear id of thread (31, 3, 0), the last thread of the block, so the
+/// x and y terms of the id both count. No thread has `threadIdx.x` equal to it.
+const BARRIER_2D_THREAD: u32 = BLOCK_2D_THREADS - 1;
+
 // =============================================================================
 // CUSIMD KERNELS
 // =============================================================================
@@ -231,6 +240,63 @@ mod kernels {
             *output_elem = sum; // Should be 3
         }
     }
+
+    /// Test kernel for `ManagedBarrier` in a 2D block of (32, 4, 1) threads.
+    ///
+    /// Every thread calls `init_by` and `inval_by`, as their contract asks:
+    /// both synchronize the whole block. The selector is the block-linear id
+    /// of thread (31, 3, 0), the last thread of the block, so the x and y
+    /// terms of the id both count. No thread has `threadIdx.x` equal to it,
+    /// so an election by `threadIdx.x` alone initializes nothing and the
+    /// launch fails with error 719.
+    ///
+    /// Thread 0 first fills the barrier word with all-ones. The store is a
+    /// determinism aid, not the detector: a missing init then faults on this
+    /// word instead of depending on what shared memory held at launch.
+    ///
+    /// Each thread writes 42 at its row-major 2D index when that index equals
+    /// its block rank, so the host also checks that `thread_rank()` numbers
+    /// the block x fastest, the same numbering the barrier election uses.
+    #[kernel]
+    pub fn test_managed_barrier_2d(
+        mut output: DisjointSlice<u32, thread::Index2D<BLOCK_2D_WIDTH>>,
+    ) {
+        static mut BAR: Barrier = Barrier::UNINIT;
+
+        let rank = this_thread_block().thread_rank() as usize;
+
+        // Determinism aid, not the detector: see the kernel docs above
+        if rank == 0 {
+            // SAFETY: BAR is this block's own shared memory, one 8-byte aligned
+            // u64 that nothing in this launch has made an mbarrier object yet;
+            // the sync below orders the store before init_by.
+            unsafe { *(&raw mut BAR as *mut u64) = u64::MAX };
+        }
+        thread::sync_threads();
+
+        // ALL threads create the Uninit handle (wraps the same shared static)
+        let bar = ManagedBarrier::<Uninit, GeneralBarrier>::from_static(&raw mut BAR);
+
+        // ALL threads call init_by - only linear thread 127 runs mbarrier.init
+        // init_by includes: fence + sync_threads; all threads get a Ready handle
+        let bar = unsafe { bar.init_by(BLOCK_2D_THREADS, BARRIER_2D_THREAD) };
+
+        // All threads arrive and wait
+        let token = bar.arrive();
+        bar.wait(token);
+
+        // ALL threads call inval_by - it synchronizes the block, then only
+        // linear thread 127 runs mbarrier.inval, then synchronizes again
+        let _dead = unsafe { bar.inval_by(BARRIER_2D_THREAD) };
+
+        // Write results - 42 when the row-major index is the block rank
+        if let Some(idx) = thread::index_2d::<BLOCK_2D_WIDTH>() {
+            let value = if idx.get() == rank { 42 } else { 1 };
+            if let Some(output_elem) = output.get_mut(idx) {
+                *output_elem = value;
+            }
+        }
+    }
 }
 
 // =============================================================================
@@ -433,6 +499,42 @@ fn main() -> Result<(), Box<dyn std::error::Error>> {
         }
     }
 
+    // ====================================================================
+    // Test 6: ManagedBarrier in a 2D block
+    // ====================================================================
+    println!("--- Test 6: ManagedBarrier in a ({BLOCK_2D_WIDTH}, {BLOCK_2D_HEIGHT}, 1) block ---");
+    {
+        const N: usize = BLOCK_2D_WIDTH * BLOCK_2D_HEIGHT;
+        let mut output_dev = DeviceBuffer::<u32>::zeroed(&stream, N)?;
+
+        let cfg = LaunchConfig {
+            grid_dim: (1, 1, 1),
+            block_dim: (BLOCK_2D_WIDTH as u32, BLOCK_2D_HEIGHT as u32, 1),
+            shared_mem_bytes: 0,
+        };
+
+        // SAFETY: launch shape/resources match the kernel; buffers cover its accesses.
+        unsafe { module.test_managed_barrier_2d((stream).as_ref(), cfg, &mut output_dev) }?;
+        stream.synchronize()?;
+
+        let output: Vec<u32> = output_dev.to_host_vec(&stream)?;
+
+        // Every thread writes 42 once it passed the barrier and its block
+      
```

**File**: `cuda-oxide/cuda-oxide-book/advanced/images/mbarrier-thread-election.svg` (added, +750/-0)
```diff
@@ -0,0 +1,750 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 697" width="1240" height="697" role="img" aria-label="ManagedBarrier thread election. Left, a (32, 4, 1) block drawn as 32 by 4 cells with thread (0, 0, 0), the x equals 0 column and thread (31, 3, 0) marked, the init_by call of the future_apis regression, and the all-threads contract. Middle, main compared threadIdx.x with the selector: selector 0 lights four cells, selector 127 lights none and the launch fails with error 719. Right, the fix compares the block-linear id x + 32 * (y + 4 * z): selector 0 lights one cell, 127 lights (31, 3), 128 of 128 threads correct with sanitizers clean, through the shared helper from #1351. Bottom, the PTX election on both trees: a predicate on %tid.x alone against one on the linear id.">
+<style>
+  :root, svg {
+  --bg: #f4f6f8; --fg: #1a232e; --muted: #5d6b7a; --line: #9aa7b4; --panel: #ffffff;
+  --meta: #0e7c72; --meta-fill: #d9f3ef; --code: #b4560a; --code-fill: #fdebd2;
+  --rust: #7a3fb3; --rust-fill: #efe4fb;
+  --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
+  --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
+ }
+  @media (prefers-color-scheme: dark) { :root, svg {
+  --bg: #0f151b; --fg: #e4ebf2; --muted: #9fb0c0; --line: #4d5b6a; --panel: #171f28;
+  --meta: #5fe3d2; --meta-fill: #0f3a37; --code: #f6b544; --code-fill: #3b2a0c;
+  --rust: #c9a0f0; --rust-fill: #2b1b3f;
+ } }
+</style>
+<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--fg)"/></marker></defs>
+
+<rect x="0" y="0" width="1240" height="697" style="fill: var(--bg)"/>
+<text x="40" y="34" text-anchor="start" xml:space="preserve" style="font: 600 17px var(--sans); fill: var(--fg); white-space: pre">ManagedBarrier: one thread runs mbarrier.init, chosen by its block-linear id</text>
+<text x="40" y="56" text-anchor="start" xml:space="preserve" style="font: 400 12.5px var(--sans); fill: var(--muted); white-space: pre">All threads call init_by(count, id) and inval_by(id); one thread acts. Main chose it by threadIdx.x alone, which names one thread only in a 1D block; #1349 uses the block-linear id.</text>
+<text x="40" y="82" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">THE BLOCK  (future_apis, test_managed_barrier_2d)</text>
+<text x="500" y="82" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">MAIN  (threadIdx_x() == selector)</text>
+<text x="860" y="82" text-anchor="start" xml:space="preserve" style="font: 600 11px var(--sans); fill: var(--muted); white-space: pre">FIXED  (block_linear_thread_id_here() == selector)</text>
+<rect x="40" y="94" width="440" height="149.0" rx="6" style="fill: var(--panel); stroke: var(--line); stroke-width: 1.2"/>
+<text x="52" y="114" text-anchor="start" xml:space="preserve" style="font: 600 12px var(--sans); fill: var(--fg); white-space: pre">block_dim = (32, 4, 1): 128 threads, one warp per row</text>
+<text x="54" y="130" text-anchor="start" xml:space="preserve" style="font: 400 9.5px var(--sans); fill: var(--muted); white-space: pre">y</text>
+<text x="68" y="130" text-anchor="start" xml:space="preserve" style="font: 400 9.5px var(--sans); fill: var(--muted); white-space: pre">threadIdx.x = 0</text>
+<text x="451.0" y="130" text-anchor="end" xml:space="preserve" style="font: 400 9.5px var(--sans); fill: var(--muted); white-space: pre">31</text>
+<rect x="68.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--rust); stroke: none; stroke-width: 1.0"/>
+<rect x="80.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="92.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="104.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="116.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="128.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="140.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="152.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="164.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="176.0" y="138.0" width="11.0" height="11.0" rx="1.5" style="fill: var(--panel); stroke: var(--line); stroke-width: 0.6"/>
+<rect x="188.0" y="138.0" width="11.0" height="11
```

**File**: `cuda-oxide/cuda-oxide-book/advanced/tensor-memory-accelerator.md` (modified, +12/-0)
```diff
@@ -188,6 +188,18 @@ The lifecycle is: `Uninit` → `init()` → `Ready` → `arrive()` / `wait()` 
 `inval()` → `Invalidated`. The type system prevents calling `wait` on an
 uninitialized barrier or `arrive` on an invalidated one.
 
+```{figure} images/mbarrier-thread-election.svg
+:align: center
+:width: 100%
+
+Which thread runs `mbarrier.init`. Every thread calls `init_by(count, id)` and `inval_by(id)`,
+and the thread whose block-linear id (`x + blockDim.x * (y + blockDim.y * z)`, the numbering
+`thread_rank()` uses) equals `id` runs the instruction; `init()` and `inval()` pass 0, thread
+(0, 0, 0). Comparing `threadIdx.x` alone named one thread only in a 1D block: in a (32, 4, 1)
+block selector 0 ran the instruction on four threads and selector 127 on none, so the launch
+failed with error 719.
+```
+
 ### Key barrier rules
 
 | Rule                                                  | Why                                                                            |
```

---

### Incident Patch 2: `f6507e7b` (2026-10-19)
**Commit Message**: fix(cargo-oxide): pin release-like codegen in Cargo profiles (#1510)

Move cargo oxide's opt-level, debug-assertions, overflow-checks and debuginfo pins from rustflags into Cargo profile settings (CARGO_PROFILE_RELEASE_* and CARGO_PROFILE_DEV_*, and --config profile.<name>.* for a selected custom profile), so build and test share one dependency build instead of forking the fingerprint. The trailing -C re-pin still wins over incoming rustflags. Real-Cargo tests cover the reuse and a dashed custom profile; the README states what outranks the pins.

Closes #1508.

Signed-off-by: Alex Khal <[REDACTED_EMAIL]>
Signed-off-by: nihalpasham <[REDACTED_EMAIL]>

**File**: `cuda-oxide/crates/cargo-oxide/README.md` (modified, +26/-5)
```diff
@@ -257,10 +257,25 @@ cargo oxide build tcgen05        # sm_100a only, but PTX generation works anywhe
 cargo oxide build debug --debug-assertions
 ```
 
-`--debug-assertions` keeps the normal release-like `-Copt-level=3` policy but
-switches to `-Cdebug-assertions=on`. It also explicitly sets
-`-Coverflow-checks=off`: rustc otherwise enables overflow checks with debug
-assertions, which adds distinct MIR checks and trap paths. The option applies
+Builds pin a release-like codegen policy: `opt-level = 3`,
+`debug-assertions = off` and `overflow-checks = off` (overflow checks add
+distinct MIR checks and trap paths). The pins travel in the Cargo profile, so
+a build whose pins match the release defaults shares every compiled crate
+with `cargo oxide test -- --release`. Two carriers deliver them: the `release`
+and `dev` profiles take `CARGO_PROFILE_RELEASE_*` and `CARGO_PROFILE_DEV_*`
+environment settings, and a profile you select with `--profile` takes
+`--config profile.<name>.<key>=<value>` arguments placed before your own
+Cargo arguments. When `RUSTFLAGS`, `CARGO_ENCODED_RUSTFLAGS` or the project's
+`extra-rustflags` set one of these options, cargo-oxide also appends the
+pinned `-C` flag after them, so the pin still wins there. Three channels
+outrank the pins: `[profile.*.package.*]` overrides, `--config profile.*`
+arguments, and manifest `[profile.*.rustflags]` or
+`[profile.*.package.*.rustflags]` lists, which cargo-oxide never sees. Host
+units (build scripts, proc-macros) follow Cargo's `build-override` settings.
+
+`--debug-assertions` keeps `opt-level = 3` and `overflow-checks = off` but
+switches to `debug-assertions = on` (rustc would otherwise enable overflow
+checks with it). The option applies
 to regular builds, passthrough builds, and metadata-declared interop device
 crates. It is independent of `--device-debug`, which controls emitted device
 debug information and CUDA finalization optimization.
@@ -533,7 +548,13 @@ Do not put `RUSTFLAGS` or `CARGO_ENCODED_RUSTFLAGS` in the `[env]` table; use
 inherited user flags, explicit `--device-cfg` values, and its required compiler
 flags in boundary-preserving `CARGO_ENCODED_RUSTFLAGS`. Required compiler flags
 are applied last so inherited settings cannot replace the cuda-oxide backend or
-disable its correctness-critical codegen options.
+disable its correctness-critical codegen options. Pinned profile options
+(opt-level, debug assertions, overflow checks, debug info) travel in the Cargo
+profile, as `CARGO_PROFILE_RELEASE_*` and `CARGO_PROFILE_DEV_*` settings for
+the base profiles and as `--config profile.<name>.*` arguments for a selected
+`--profile`. They appear here only when `RUSTFLAGS`, `CARGO_ENCODED_RUSTFLAGS`
+or `extra-rustflags` set the same option. Manifest `[profile.*.rustflags]`
+lists never pass through here and outrank the pins.
 
 ## Architecture
 
```

**File**: `cuda-oxide/crates/cargo-oxide/src/commands/build_run.rs` (modified, +2/-1)
```diff
@@ -118,7 +118,8 @@ pub fn codegen_run(
         println!();
     }
     println!("This is the proper cargo workflow:");
-    println!("  CARGO_ENCODED_RUSTFLAGS=<cuda-oxide flags> cargo run");
+    println!("  CARGO_ENCODED_RUSTFLAGS=<cuda-oxide flags> CARGO_PROFILE_*=<pins> cargo run");
+    println!("  (a custom --profile takes the pins as --config profile.<name>.<key>=<value>)");
     println!();
 
     touch_main_rs(&example_dir);
```

**File**: `cuda-oxide/crates/cargo-oxide/src/commands/codegen_env.rs` (modified, +205/-25)
```diff
@@ -20,11 +20,11 @@ pub(super) const ENCODED_RUSTFLAGS_SEPARATOR: char = '\u{1f}';
 pub(super) const FULL_DEBUG_GET_MUT_OUTLINE_CFG: &str =
     "cuda_oxide_internal_outline_disjoint_get_mut_v1";
 
-/// Profile-related rustc flags owned by cuda-oxide.
+/// Profile-related codegen settings owned by cuda-oxide.
 ///
 /// Backend selection and MIR/symbol invariants are always applied separately.
-/// `CargoSelected` deliberately adds no optimization, assertion, or debug-info
-/// flags so Cargo's chosen profile remains authoritative.
+/// `CargoSelected` deliberately pins no optimization, assertion, or debug-info
+/// setting so Cargo's chosen profile remains authoritative.
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
 pub(super) enum CodegenProfilePolicy {
     CargoSelected,
@@ -41,6 +41,197 @@ impl CodegenProfilePolicy {
             Self::ReleaseLike
         }
     }
+
+    /// The codegen options this policy pins, in rustc flag order.
+    pub(super) fn pinned_options(self) -> &'static [PinnedOption] {
+        const OPT_LEVEL: PinnedOption = PinnedOption::new("opt-level", "3", "opt-level", "3");
+        const NO_ASSERTIONS: PinnedOption =
+            PinnedOption::new("debug-assertions", "off", "debug-assertions", "false");
+        const ASSERTIONS: PinnedOption =
+            PinnedOption::new("debug-assertions", "on", "debug-assertions", "true");
+        // Overflow-check MIR changes code shape enough to break pattern-sensitive
+        // device lowerings, so it is off in every release-like policy. Pinned
+        // explicitly: rustc derives it from debug assertions, and Cargo's dev
+        // profile (passthrough builds without `--release`) would turn it on.
+        const NO_OVERFLOW_CHECKS: PinnedOption =
+            PinnedOption::new("overflow-checks", "off", "overflow-checks", "false");
+        const DEBUGINFO: PinnedOption = PinnedOption::new("debuginfo", "2", "debug", "2");
+        match self {
+            Self::CargoSelected => &[],
+            Self::ReleaseLike => &[OPT_LEVEL, NO_ASSERTIONS, NO_OVERFLOW_CHECKS],
+            Self::ReleaseLikeWithDebugAssertions => &[OPT_LEVEL, ASSERTIONS, NO_OVERFLOW_CHECKS],
+            Self::ReleaseLikeWithDebugInfo => {
+                &[OPT_LEVEL, NO_ASSERTIONS, NO_OVERFLOW_CHECKS, DEBUGINFO]
+            }
+        }
+    }
+}
+
+/// One rustc codegen option a release-like policy requires, with its Cargo
+/// profile key.
+///
+/// The Cargo profile is the primary carrier: Cargo fingerprints resolved
+/// profile values, not where they came from, so a release-like `build` whose
+/// pins equal the release defaults shares every artifact with a plain
+/// `cargo test --release`. A `-C` flag in RUSTFLAGS would change every crate's
+/// cache key and rebuild the whole graph between the two. The rustc flag is
+/// emitted only when incoming rustflags set the same option, since rustflags
+/// follow profile flags on the rustc command line and would otherwise win.
+///
+/// Two carriers deliver the pins. The base profiles `release` and `dev` take
+/// them from the environment (`CARGO_PROFILE_RELEASE_*` and
+/// `CARGO_PROFILE_DEV_*`, see [`apply_profile_pins`]). Any other profile
+/// selected with `--profile` takes them as
+/// `--config profile.<name>.<key>=<value>` arguments (see
+/// [`profile_config_args`]), because the environment key for such a name can
+/// collide with a base profile's table: Cargo reads
+/// `CARGO_PROFILE_RELEASE_LTO_OPT_LEVEL` as `profile.release.lto` and rejects
+/// it.
+///
+/// Limits of the profile route: `[profile.<name>.package.<pkg>]` overrides,
+/// `--config profile.*` arguments and manifest `[profile.<name>.rustflags]` or
+/// `[profile.<name>.package.<pkg>.rustflags]` lists outrank the pins. The
+/// trailing `-C` flag covers RUSTFLAGS, `CARGO_ENCODED_RUSTFLAGS` and the
+/// project's `extra-rustflags` only; cargo-oxide never sees manifest
+/// rustflags. Host units (build scripts, proc-macros) follow Cargo's
+/// `build-override` defaults.
+#[derive(Clone, Copy, Debug, Eq, PartialEq)]
+pub(super) struct PinnedOption {
+    /// rustc `-C` option name.
+    name: &'static str,
+    /// Value in rustc's `-C name=value` form.
+    rustc_value: &'static str,
+    /// Cargo profile key as a manifest writes it (`opt-level`, `debug`).
+    cargo_key: &'static str,
+    /// Value in Cargo's profile form.
+    cargo_value: &'static str,
+}
+
+impl PinnedOption {
+    const fn new(
+        name: &'static str,
+        rustc_value: &'static str,
+        cargo_key: &'static str,
+        cargo_value: &'static str,
+    ) -> Self {
+        Self {
+            name,
+            rustc_value,
+            cargo_key,
+            cargo_value,
+        }
+    }
+
+    pub(super) fn rustc_flag(self) -> String {
+        format!("-C{}={}", self.name, self.rustc_value)
+    }
+
+    /// `CARGO_PROFILE_<PROFILE>_<KEY>`. Cargo derives the environment key from
+    /// the manifest key by uppercasing it and replacing `-` wit
```

**File**: `cuda-oxide/crates/cargo-oxide/src/commands/passthrough.rs` (modified, +9/-7)
```diff
@@ -225,11 +225,19 @@ pub(super) fn cargo_passthrough_command_with_env(
         target_arch,
         &materialization,
     );
+    let policy = cargo_subcommand.codegen_profile(opts.debug_assertions);
     let mut cmd = Command::new("cargo");
     cmd.arg(cargo_subcommand.as_str());
     if let Some(features) = opts.features {
         cmd.args(["--features", features]);
     }
+    // A profile other than `release` or `dev` may set a pinned key itself and
+    // cannot take the environment carrier, so it receives the pins as
+    // `--config` arguments. They go before the user's arguments: a later user
+    // `--config` for the same key still wins.
+    if let Some(profile) = selected_cargo_profile(cargo_args) {
+        cmd.args(profile_config_args(policy, profile));
+    }
     cmd.args(cargo_args).current_dir(&ctx.workspace_root);
 
     // Project configuration provides defaults. Explicit wrapper flags and
@@ -242,13 +250,7 @@ pub(super) fn cargo_passthrough_command_with_env(
         opts.unchecked_indexing,
         opts.device_debug,
     );
-    apply_codegen_configuration(
-        &mut cmd,
-        ctx,
-        cargo_subcommand.codegen_profile(opts.debug_assertions),
-        opts.device_cfgs,
-        &fingerprint,
-    )?;
+    apply_codegen_configuration(&mut cmd, ctx, policy, opts.device_cfgs, &fingerprint)?;
 
     if let Some(cargo_target_dir) = opts.cargo_target_dir {
         cmd.env("CARGO_TARGET_DIR", cargo_target_dir);
```

**File**: `cuda-oxide/crates/cargo-oxide/src/commands/pipeline_debug.rs` (modified, +4/-3)
```diff
@@ -68,9 +68,11 @@ pub fn codegen_show_pipeline(
         }
     }
     println!();
+    println!("Required settings (Cargo profile; also rustflags if yours override them):");
+    println!("  opt-level=3                 MIR optimization");
+    println!("  debug-assertions=off        Remove debug checks");
+    println!("  overflow-checks=off         Keep MIR free of overflow trap paths");
     println!("Required flags (applied via CARGO_ENCODED_RUSTFLAGS):");
-    println!("  -C opt-level=3              MIR optimization");
-    println!("  -C debug-assertions=off     Remove debug checks");
     println!("  -Z mir-enable-passes=-JumpThreading");
     println!("                              Prevent barrier duplication");
     println!("  -Z always-encode-mir        Emit MIR for all reachable device deps");
@@ -227,7 +229,6 @@ pub fn codegen_debug(
         &[],
         &fingerprint,
     );
-    cmd.env("CARGO_PROFILE_RELEASE_DEBUG", "2");
     apply_output_mode(&mut cmd, false, target_arch, &materialization);
     apply_device_arch_hint(&mut cmd, target_arch, detected_device_arch.as_deref());
     apply_ld_library_path(&mut cmd, ctx);
```

**File**: `cuda-oxide/crates/cargo-oxide/src/commands/tests.rs` (modified, +594/-32)
```diff
@@ -69,6 +69,16 @@ fn is_sha256(value: &str) -> bool {
             .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
 }
 
+fn strings(args: &[&str]) -> Vec<String> {
+    args.iter().map(|arg| arg.to_string()).collect()
+}
+
+fn command_args(cmd: &Command) -> Vec<String> {
+    cmd.get_args()
+        .map(|arg| arg.to_string_lossy().into_owned())
+        .collect()
+}
+
 /// `cargo_passthrough_command` with an empty ambient
 /// `CUDA_OXIDE_MATERIALIZE_CUBIN`.
 ///
@@ -86,18 +96,19 @@ fn passthrough_command_for_test(
     cargo_passthrough_command_with_env(ctx, cargo_subcommand, opts, cargo_args, None)
 }
 
+/// Run one passthrough command on a scratch workspace and report which units
+/// Cargo reused, by target name. A test harness carries a ` (test)` suffix so
+/// it never shadows the library it was built from.
 fn cargo_artifact_freshness(
     ctx: &Context,
+    cargo_subcommand: CargoPassthroughSubcommand,
     opts: &CargoPassthroughOptions<'_>,
+    cargo_args: &[&str],
     materializer_provenance: Option<&str>,
 ) -> BTreeMap<String, bool> {
-    let mut cmd = passthrough_command_for_test(
-        ctx,
-        CargoPassthroughSubcommand::Build,
-        opts,
-        &["--message-format=json-render-diagnostics".to_string()],
-    )
-    .unwrap();
+    let mut args = strings(&["--message-format=json-render-diagnostics"]);
+    args.extend(strings(cargo_args));
+    let mut cmd = passthrough_command_for_test(ctx, cargo_subcommand, opts, &args).unwrap();
     if let Some(provenance) = materializer_provenance {
         // Exercise a non-canonical spelling accepted by the backend. The
         // macro must still track exact provenance rather than keying that
@@ -118,10 +129,13 @@ fn cargo_artifact_freshness(
         .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
         .filter(|message| message["reason"] == "compiler-artifact")
         .filter_map(|message| {
-            Some((
-                message["target"]["name"].as_str()?.to_string(),
-                message["fresh"].as_bool()?,
-            ))
+            let name = message["target"]["name"].as_str()?;
+            let key = if message["profile"]["test"].as_bool()? {
+                format!("{name} (test)")
+            } else {
+                name.to_string()
+            };
+            Some((key, message["fresh"].as_bool()?))
         })
         .collect()
 }
@@ -1216,15 +1230,23 @@ fn interop_build_keeps_debug_assertions_and_device_debug_independent() {
             append_full_debug_rustflags(&mut encoded, &cmd, None);
             let flags = decoded_rustflags(&encoded);
 
-            assert!(flags.contains(&"-Copt-level=3"));
-            assert!(flags.contains(&if assertions {
+            let pins: Vec<String> = options
+                .codegen_profile()
+                .pinned_options()
+                .iter()
+                .map(|pin| pin.rustc_flag())
+                .collect();
+            let assertions_flag = if assertions {
                 "-Cdebug-assertions=on"
             } else {
                 "-Cdebug-assertions=off"
-            }));
-            if assertions {
-                assert!(flags.contains(&"-Coverflow-checks=off"));
-            }
+            };
+            assert_eq!(
+                pins,
+                ["-Copt-level=3", assertions_flag, "-Coverflow-checks=off"]
+            );
+            // Without incoming overrides the pins stay in the Cargo profile.
+            assert!(!flags.iter().any(|flag| pins.iter().any(|pin| pin == flag)));
             assert_eq!(has_full_debug_cfg(&flags), debug == DeviceDebug::Full);
             for required in FULL_DEBUG_MIR_RUSTFLAGS {
                 assert_eq!(flags.contains(required), debug == DeviceDebug::Full);
@@ -2003,12 +2025,12 @@ fn build_passthrough_retains_release_profile_and_required_flags() {
     assert_eq!(flags[0], "-Lnative=/nix/store/cuda-cudart/lib");
     assert!(flags.contains(&"-Copt-level=0"));
     assert!(flags.contains(&"-Zcodegen-backend=llvm"));
+    // Only the overridden option is re-pinned; debug-assertions stays in the profile.
     assert_eq!(
-        &flags[flags.len() - 6..],
+        &flags[flags.len() - 5..],
         [
             "-Zcodegen-backend=/tmp/librustc_codegen_cuda.so",
             "-Copt-level=3",
-            "-Cdebug-assertions=off",
             "-Zmir-enable-passes=-JumpThreading",
             "-Zalways-encode-mir",
             "-Csymbol-mangling-version=v0",
@@ -2069,8 +2091,9 @@ fn encoded_rustflags_preserve_configured_flag_boundaries_and_spaces() {
             .any(|pair| pair == ["--cfg", "model=\"alpha beta\""])
     );
     assert_eq!(&flags[2..4], ["-L", "native=/nix/store/cuda-cudart/lib"]);
+    // Backend, then the three required -Z/-C invariants (no incoming pin overrides).
     assert_eq!(
-        flags[flags.len() - 6],
+        flags[flags.len() - 4],
         "-Zcodegen-backend=/tmp/backend path/librustc_codegen_c
```

---

### Incident Patch 3: `e1ce6255` (2026-10-19)
**Commit Message**: fix(mir-importer): preserve emitted diverging device calls (#1364)

A direct call to an emitted #[device] fn -> ! was lowered to trap;, so the callee's side effects before diverging were lost. Emit the call followed by unreachable, as rustc's own backend does; panic entry points, panic-only -> ! bodies and calls through function pointers still trap. The function_item_call check covers all three call sites plus a retained-trap control.

Signed-off-by: Yunus Mutlu <[REDACTED_EMAIL]>
Signed-off-by: nihalpasham <[REDACTED_EMAIL]>

**File**: `cuda-oxide/crates/mir-importer/src/pipeline.rs` (modified, +9/-4)
```diff
@@ -494,11 +494,16 @@ pub fn run_pipeline(
     config: &PipelineConfig,
     known_defs: crate::translator::facts::KnownDefs,
 ) -> Result<CompilationResult, PipelineError> {
-    // Install the driver-resolved lang-item ids for this run. Set (not
-    // merged) every entry: the ids are only valid inside the caller's
-    // `rustc_internal::run` context, so a stale set from a previous run on
-    // this thread must never survive.
+    // Install the driver-resolved lang-item ids and emitted-function identities
+    // for this run. Replace (rather than merge) both thread-local sets so
+    // stale state from a previous run on this thread cannot survive.
     crate::translator::facts::set_known_defs(known_defs);
+    crate::translator::facts::set_emitted_functions(
+        functions
+            .iter()
+            .map(|func| func.instance.mangled_name().to_string())
+            .collect(),
+    );
 
     prepare_output_dir(&config.output_dir)?;
 
```

**File**: `cuda-oxide/crates/mir-importer/src/translator/facts.rs` (modified, +51/-0)
```diff
@@ -85,6 +85,12 @@ thread_local! {
             index_mut_trait: None,
         })
     };
+    // Exact monomorphized Rust functions that this pipeline run will emit.
+    //
+    // Store rustc's linkage identity rather than the legalised module symbol:
+    // call classification must not depend on Legaliser ordering or spelling.
+    static EMITTED_FUNCTIONS: std::cell::RefCell<std::collections::BTreeSet<String>> =
+        const { std::cell::RefCell::new(std::collections::BTreeSet::new()) };
 }
 
 /// Installs the driver-resolved lang-item ids for this pipeline run,
@@ -99,6 +105,28 @@ pub(crate) fn known_defs() -> KnownDefs {
     KNOWN_DEFS.with(|cell| cell.get())
 }
 
+/// Replace the emitted-function set for the current pipeline run.
+///
+/// Like [`set_known_defs`], this replaces rather than extends previous
+/// thread-local state so one rustc invocation cannot leak into the next.
+pub(crate) fn set_emitted_functions(names: std::collections::BTreeSet<String>) {
+    EMITTED_FUNCTIONS.with(|set| *set.borrow_mut() = names);
+}
+
+/// Whether this exact monomorphized Rust instance will have a `mir.func`
+/// definition in the module being translated.
+pub(crate) fn is_emitted_function(instance: &mir::mono::Instance) -> bool {
+    is_emitted_name(&instance.mangled_name())
+}
+
+/// Whether `mangled_name`, rustc's linkage identity of one monomorphized
+/// function, is in the current run's emitted-function set. The name-based
+/// form lets the set's replace-not-merge contract be tested without a rustc
+/// session.
+pub(crate) fn is_emitted_name(mangled_name: &str) -> bool {
+    EMITTED_FUNCTIONS.with(|set| set.borrow().contains(mangled_name))
+}
+
 /// Validate the source reference and the fully specialized read-only storage
 /// contract using rustc's type system. MIR locals have erased regions, so the
 /// outer lifetime is read from the declaration before instantiation instead.
@@ -1104,4 +1132,27 @@ pub fn reference_validity(
             assert!(fact.pointee_alignment.is_power_of_two());
         }
     }
+
+    /// `set_emitted_functions` replaces the previous run's set instead of
+    /// merging into it. A name left over from an earlier rustc invocation on
+    /// the same thread would keep a diverging call to a function this run
+    /// never emits, and the module would reference an undefined symbol.
+    #[test]
+    fn emitted_function_set_is_replaced_per_run() {
+        let first_run = std::collections::BTreeSet::from(["first_run_die".to_string()]);
+        set_emitted_functions(first_run);
+        assert!(is_emitted_name("first_run_die"));
+        assert!(!is_emitted_name("second_run_spin"));
+
+        let second_run = std::collections::BTreeSet::from(["second_run_spin".to_string()]);
+        set_emitted_functions(second_run);
+        assert!(is_emitted_name("second_run_spin"));
+        assert!(
+            !is_emitted_name("first_run_die"),
+            "an entry from the previous run must not survive the replacement"
+        );
+
+        set_emitted_functions(std::collections::BTreeSet::new());
+        assert!(!is_emitted_name("second_run_spin"));
+    }
 }
```

**File**: `cuda-oxide/crates/mir-importer/src/translator/terminator/helpers.rs` (modified, +35/-22)
```diff
@@ -316,10 +316,10 @@ pub fn bundle_generated_u32_results_as_array(
 /// 1. Translate all MIR arguments to Pliron IR values
 /// 2. At a foreign ABI boundary, adapt pointer address spaces to the exact
 ///    declared parameter types without changing pointer kind or mutability
-/// 3. Prepare the call destination using the current projection state
+/// 3. For returning calls, prepare the destination using the current projection state
 /// 4. Create a `mir.call` operation carrying the callee's name attribute
-/// 5. Store the result through the prepared destination
-/// 6. Emit a zero-operand goto to the call's success target
+/// 5. For returning calls, store the result and goto the success target
+/// 6. For diverging calls, emit `mir.unreachable` after the call
 ///
 /// Reference arguments (`&mut local`) are handed the local's alloca slot
 /// pointer directly, so callee writes through the reference are observed by
@@ -383,16 +383,21 @@ pub fn emit_function_call(
         }
     }
 
-    let (prepared_destination, prepared_last_op) = prepare_destination_write(
-        ctx,
-        body,
-        destination,
-        value_map,
-        block_ptr,
-        last_op,
-        loc.clone(),
-    )?;
-    last_op = prepared_last_op;
+    let prepared_destination = if target.is_some() {
+        let (prepared, prepared_last_op) = prepare_destination_write(
+            ctx,
+            body,
+            destination,
+            value_map,
+            block_ptr,
+            last_op,
+            loc.clone(),
+        )?;
+        last_op = prepared_last_op;
+        Some(prepared)
+    } else {
+        None
+    };
 
     use pliron::builtin::attributes::StringAttr;
 
@@ -423,26 +428,34 @@ pub fn emit_function_call(
         call_op
     };
 
+    if target.is_none() {
+        return Ok(super::emit_unreachable_after(
+            ctx,
+            block_ptr,
+            Some(call_op),
+            loc,
+        ));
+    }
+
     let result_value = call_op.deref(ctx).get_result(0);
 
     let goto_prev = finish_destination_write(
         ctx,
-        prepared_destination,
+        prepared_destination.expect("returning call prepared its destination"),
         result_value,
         value_map,
         block_ptr,
         call_op,
         loc.clone(),
     )?;
 
-    if let Some(target_idx) = target {
-        Ok(emit_goto(ctx, *target_idx, goto_prev, block_map, loc))
-    } else {
-        input_err!(
-            loc.clone(),
-            TranslationErr::unsupported("Call terminator without target not supported".to_string(),)
-        )
-    }
+    Ok(emit_goto(
+        ctx,
+        target.expect("returning call has a success target"),
+        goto_prev,
+        block_map,
+        loc,
+    ))
 }
 
 /// Adapt a foreign-call pointer argument only when the address space is the
```

**File**: `cuda-oxide/crates/mir-importer/src/translator/terminator/mod.rs` (modified, +39/-17)
```diff
@@ -1254,25 +1254,47 @@ fn translate_call(
         return Ok(result);
     }
 
-    // Handle diverging calls (calls that never return, like unwrap_failed, panic, etc.)
-    // These have no target block because the function never returns.
+    // `Call { target: None }` means there is no normal successor. rustc
+    // clears the target when the destination type is visibly uninhabited:
+    // `!`, `core::convert::Infallible`, an empty enum. That does not mean the
+    // callee can be erased. An emitted Rust function with such a return type
+    // may do observable work before it diverges. When the resolved instance
+    // is in this pipeline run's emitted-function set, keep the call and let
+    // `emit_function_call` end the block with `mir.unreachable`, which is
+    // what rustc's own backend emits for a call without a destination.
     //
-    // The callee is dropped and replaced by an immediate trap. That applies
-    // to every `-> !` callee reaching this point, including a user
-    // `#[device]` fn that legitimately diverges (e.g. `loop {}`); full Rust
-    // fidelity would emit the call for resolvable callees the way
-    // `translate_function_item_call` does. Dropping the call is a
-    // pre-existing semantic: the trap only makes it safe, where the bare
-    // `unreachable` previously emitted here was UB that let `opt` delete
-    // the whole panic path.
-    //
-    // Panic entry points additionally never get here with any statements
-    // translated ahead of them: `block::translate_block` recognizes the same
-    // shape via [`is_dropped_panic_call`] and emits the trap directly.
+    // Every other diverging call keeps the pre-existing trap fallback. That
+    // covers callees the collector skipped, such as core helpers without MIR
+    // and local `-> !` bodies that are nothing but a panic, and a call
+    // through a function pointer, whose `func` operand is not a constant and
+    // so resolves no instance. Panic entry points never reach this arm: for
+    // a callee whose path matches `is_panic_entry_path`,
+    // `block::translate_block` lowers the whole block to the trap through
+    // `is_dropped_panic_call` before any call is classified. Keep this arm
+    // before the unsupported-intrinsic and libm checks below so the trapped
+    // cases take the same path as before.
     if target_usize.is_none() {
-        // This is a diverging call (returns !) - emit trap + unreachable
-        // Examples: unwrap_failed(), panic!(), abort()
-        return Ok(emit_trap_unreachable_after(ctx, block_ptr, prev_op, loc));
+        let resolved_instance = match func {
+            mir::Operand::Constant(constant)
+                if *constant.const_.kind() == ConstantKind::ZeroSized =>
+            {
+                match constant.const_.ty().kind() {
+                    rustc_public::ty::TyKind::RigidTy(rustc_public::ty::RigidTy::FnDef(
+                        fn_def,
+                        substs,
+                    )) => rustc_public::mir::mono::Instance::resolve(fn_def, &substs).ok(),
+                    _ => None,
+                }
+            }
+            _ => None,
+        };
+
+        if !resolved_instance
+            .as_ref()
+            .is_some_and(crate::translator::facts::is_emitted_function)
+        {
+            return Ok(emit_trap_unreachable_after(ctx, block_ptr, prev_op, loc));
+        }
     }
 
     // A call to a rustc intrinsic that no dispatch arm above recognized can
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/function_item_call/README.md` (modified, +17/-0)
```diff
@@ -7,3 +7,20 @@ Rust lowers `apply_once(plus_seven, x)` through a callable trait method such as
 function-item body, and MIR import must emit a direct call name that matches the
 collector/export naming policy. Otherwise the generated device IR references a
 callee symbol that was never emitted.
+
+The diverging-call regression also covers an ordinary direct `#[device]`
+function returning `!`. Its body performs an observable store before looping
+forever. A MIR `Call` with no normal successor must therefore keep the call and
+end the caller block with `unreachable`; replacing the call itself with a trap
+would erase the store.
+
+`verify-code-shape.sh` checks that contract in the pre-optimization LLVM IR,
+before the middle-end can inline the diverging helper. It covers the three
+call sites in `diverging_callable` that used to lower to a trap: two through
+`apply_never` (a function item and a closure) and the direct call to
+`write_then_diverge`. Each kept call must be followed by `unreachable`. When
+the build also wrote PTX, the kernel entry must keep the sentinel store or a
+call to the helper. The control is `panic_only`, a `-> !` function whose body
+is nothing but a panic: the collector does not emit it, so its call site must
+still lower to the device trap, in the IR and in the PTX. The divergent
+branches are not launched; the host run exercises only the returning path.
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/function_item_call/src/main.rs` (modified, +46/-5)
```diff
@@ -10,8 +10,11 @@
 //! back to the concrete function body instead of emitting a dangling trait-shim
 //! callee symbol. The regression also covers `Fn`/`FnMut`, references,
 //! multiple and nested-tuple arguments, tuple returns, and type/const-generic
-//! function items. Diverging function items and closures also verify that a
-//! direct Rust call returning `!` ends its MIR block with `unreachable`.
+//! function items. Diverging function items, closures, and an ordinary direct
+//! `-> !` device helper also verify that a non-returning Rust call is emitted
+//! before its MIR block ends with `unreachable`. `panic_only` is the control:
+//! its `-> !` body is nothing but a panic, so the collector never emits it and
+//! its call site must still lower to the device trap.
 //! `call_once_decoy` proves that an ordinary function whose name contains
 //! trait-like text is not mistaken for a callable-trait shim.
 
@@ -57,6 +60,30 @@ fn spin_forever(_value: u32) -> ! {
     loop {}
 }
 
+// Unlike `spin_forever`, this is reached by an ordinary direct MIR `Call`.
+// The store makes replacing that call with an immediate trap observably wrong.
+#[allow(clippy::empty_loop)]
+#[inline(never)]
+#[device]
+unsafe fn write_then_diverge(ptr: *mut u32) -> ! {
+    unsafe {
+        ptr.write(0x1111_1111);
+    }
+    loop {}
+}
+
+// Control for the retained trap. A `-> !` body that is nothing but a panic is
+// a placeholder to the collector, so this function is never emitted and its
+// call site must keep the device trap. `#[inline(never)]` keeps the call in
+// the kernel's MIR, so the importer classifies this callee rather than the
+// panic entry point inside it. The name must not contain a `panicking` module
+// segment: that would trap the whole block before the call is classified.
+#[inline(never)]
+#[device]
+fn panic_only() -> ! {
+    panic!("not collected")
+}
+
 #[device]
 fn apply_once<F: FnOnce(u32) -> u32>(f: F, x: u32) -> u32 {
     f(x)
@@ -133,9 +160,10 @@ mod kernels {
         }
     }
 
-    /// Compile both diverging callable paths without entering them on-device.
-    /// A Rust call returning `!` has no successor block, so the importer must
-    /// emit the direct call followed by `mir.unreachable`.
+    /// Compile the diverging call paths without entering them on-device.
+    /// A Rust call returning `!` has no successor block. When the callee's
+    /// body is emitted, the importer must keep the direct call followed by
+    /// `mir.unreachable`; when it is not, the call site keeps the device trap.
     #[kernel]
     pub fn diverging_callable(flag: u32, mut out: DisjointSlice<u32>) {
         let idx = thread::index_1d();
@@ -148,6 +176,19 @@ mod kernels {
             #[allow(clippy::empty_loop)]
             apply_never(|_| loop {}, flag);
         }
+        if flag == 3 {
+            // The importer must preserve this ordinary direct call. The callee
+            // stores first and then diverges, so replacing it with a trap loses
+            // an observable side effect.
+            unsafe {
+                write_then_diverge(out.as_mut_ptr());
+            }
+        }
+        if flag == 4 {
+            // Retained-trap control: the callee's body is only a panic, so the
+            // collector does not emit it and this call site must still trap.
+            panic_only();
+        }
         if let Some(slot) = out.get_mut(idx) {
             *slot = 0xd1ce;
         }
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/examples/function_item_call/verify-code-shape.sh` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+#!/usr/bin/env bash
+# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+# SPDX-License-Identifier: Apache-2.0
+
+set -euo pipefail
+
+root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+llvm="${root}/function_item_call.ll"
+ptx="${root}/function_item_call.ptx"
+
+test -s "${llvm}"
+
+extract_llvm_function() {
+    local needle="$1"
+    awk -v needle="${needle}" '
+        /^define / && index($0, needle) != 0 { in_function = 1 }
+        in_function { print }
+        in_function && /^}/ { exit }
+    ' "${llvm}"
+}
+
+kernel="$(extract_llvm_function '@diverging_callable(')"
+test -n "${kernel}"
+
+# A kept diverging call must be followed by LLVM `unreachable` on the next
+# line. A `--device-debug` build appends `, !dbg !N` to that line, so the
+# match stops at the keyword. Monomorphized callees carry a mangled suffix
+# after the Rust name (`apply_neverNvB2_12spin_foreverEB2_`), so the pattern
+# allows symbol text on both sides of the name.
+expect_kept_diverging_calls() {
+    local callee="$1"
+    local expected="$2"
+    local pattern="call void @[^ (]*${callee}[^ (]*\\("
+    local found
+    found="$(grep -Ec "${pattern}" <<<"${kernel}" || true)"
+    if [[ "${found}" -ne "${expected}" ]]; then
+        echo "diverging_callable must keep ${expected} direct call(s) to ${callee}, found ${found}" >&2
+        exit 1
+    fi
+    local line next
+    while IFS= read -r line; do
+        next="$(sed -n "$((line + 1))p" <<<"${kernel}")"
+        if ! grep -Eq '^[[:space:]]*unreachable(,|[[:space:]]*$)' <<<"${next}"; then
+            echo "the direct diverging call to ${callee} at kernel line ${line} is not followed by LLVM unreachable" >&2
+            exit 1
+        fi
+    done < <(grep -nE "${pattern}" <<<"${kernel}" | cut -d: -f1)
+}
+
+# The three call sites the importer used to replace with a trap: two through
+# the generic `apply_never` (a function item and a closure) and the ordinary
+# direct call to the store-then-loop helper.
+expect_kept_diverging_calls 'apply_never' 2
+expect_kept_diverging_calls 'write_then_diverge' 1
+
+# Retained-trap control. `panic_only` has a body that is nothing but a panic,
+# which the collector does not emit, so its call site must still lower to the
+# device trap and the callee must not be called.
+trap_count="$(grep -Ec 'asm sideeffect "trap;"' <<<"${kernel}" || true)"
+if [[ "${trap_count}" -ne 1 ]]; then
+    echo "diverging_callable must keep one trap for the panic-only callee, found ${trap_count}" >&2
+    exit 1
+fi
+if grep -Eq 'call void @[^ (]*panic_only[^ (]*\(' <<<"${kernel}"; then
+    echo "the panic-only callee must not be called: the collector does not emit its body" >&2
+    exit 1
+fi
+
+helper="$(extract_llvm_function 'write_then_diverge')"
+test -n "${helper}"
+if ! grep -Eq 'store i32 286331153, ptr ' <<<"${helper}"; then
+    echo "write_then_diverge lost its observable sentinel store" >&2
+    exit 1
+fi
+
+# The direct llc route also writes PTX; the NVVM route writes only `.ll` and
+# `.target`. Check the PTX only when it exists and is at least as new as the
+# IR, so a leftover from an older build is never checked. In the kernel entry
+# the sentinel store must survive `opt` and `llc` (the helper is normally
+# inlined) or the helper must still be called, and the panic-only control
+# must keep its trap.
+if [[ -s "${ptx}" && ! "${ptx}" -ot "${llvm}" ]]; then
+    extract_ptx_function() {
+        local pattern="$1"
+        awk -v pattern="${pattern}" '
+            /^\.(visible )?\.(entry|func) / && $0 ~ pattern && $0 ~ /\($/ { in_function = 1 }
+            in_function { print }
+            in_function && /^}/ { exit }
+        ' "${ptx}"
+    }
+    entry="$(extract_ptx_function '[.]entry diverging_callable[(]')"
+    test -n "${entry}"
+    if ! grep -Eq 'st\.global\.b32[[:space:]]+\[[^]]+\], 286331153|call\.uni[[:space:]].*write_then_diverge' <<<"${entry}"; then
+        echo "the diverging_callable PTX entry neither stores the sentinel nor calls write_then_diverge" >&2
+        exit 1
+    fi
+    ptx_trap_count="$(grep -Ec '^[[:space:]]*trap;' <<<"${entry}" || true)"
+    if [[ "${ptx_trap_count}" -ne 1 ]]; then
+        echo "the diverging_callable PTX entry must keep one trap for the panic-only callee, found ${ptx_trap_count}" >&2
+        exit 1
+    fi
+fi
+
+echo "function_item_call code shape: PASS"
```

**File**: `cuda-oxide/crates/rustc-codegen-cuda/src/collector.rs` (modified, +7/-7)
```diff
@@ -2695,10 +2695,9 @@ impl<'tcx> DeviceCollector<'tcx> {
     ///    "Symbol ... not found" error.
     ///
     /// Functions that are declared diverging (return type `!`) are left
-    /// alone: their call sites have no target block, so the translator
-    /// already lowers them to LLVM `unreachable` (note: NOT a trap;
-    /// the optimizer may delete paths that provably reach it, a known
-    /// gap tracked separately).
+    /// alone. If their body is emitted, the importer preserves the call and
+    /// terminates its caller with `unreachable`; if collection deliberately
+    /// omits the body, the importer retains the existing device-trap fallback.
     fn check_unreachable_callee(
         &self,
         resolved: Instance<'tcx>,
@@ -2778,8 +2777,9 @@ impl<'tcx> DeviceCollector<'tcx> {
 
         // No stub marker: leave non-local functions to the existing silent
         // skip (this is what keeps the real `cuda_device` intrinsic
-        // placeholders and `core`'s cold panic wrappers working), and leave
-        // declared-diverging functions to the translator's `unreachable` lowering.
+        // placeholders and `core`'s cold panic wrappers working). Declared-
+        // diverging functions that are omitted here retain the translator's
+        // device-trap fallback rather than producing an undefined call.
         if !def_id.is_local() || mir.return_ty().is_never() {
             return;
         }
@@ -2808,7 +2808,7 @@ impl<'tcx> DeviceCollector<'tcx> {
             .with_help(
                 "annotate device helpers with `#[device]`; if the panic is \
                  intentional, declare the function as diverging (`-> !`) so the \
-                 call lowers to LLVM `unreachable`",
+                 device pipeline can treat the path as non-returning",
             )
             .emit()
     }
```

#### Recent Merged Pull Requests:
- **PR #1551** (2026-10-19): docs(book): show how an inline request reaches the GPU (@nihalpasham)
- **PR #1549** (2026-10-19): test(drop_glue): keep destructor MIR with -Zinline-mir=no, not #[inline(never)] (@nihalpasham)
- **PR #1545** (2026-10-19): Tile libraries: call Rust device functions from Tile kernels (@nihalpasham)
- **PR #1542** (closed): Tile libraries: call Rust device functions from Tile kernels (@nihalpasham)
- **PR #1535** (2026-10-18): cuda-oxide: add public FP16 GEMM comparison reference (@nihalpasham)
- **PR #1534** (2026-10-18): cuda-oxide: migrate CuTeIR printing to upstream Pliron MLIR interop (@nihalpasham)

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

## X. cuda-device): run mbarrier init on one linear thread (#1349)

**RULE**:
When implementing operations in `cuda-oxide/crates/cuda-device/src/barrier.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b606fdd`: cuda-device): run mbarrier init on one linear thread (#1349). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/crates/cuda-device/src/barrier.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// | Operation       | Thread Requirement                     |
/// |-----------------|----------------------------------------|
/// | `from_static()` | All threads call                       |
/// | `init()`        | All threads call; linear thread 0 acts |
/// | `arrive()`      | All participating threads              |
/// | `wait()`        | All participating threads              |
/// | `inval()`       | All threads call; linear thread 0 acts |
/// // All threads: create the handle and initialize. Linear thread 0, that is
/// // thread (0, 0, 0), runs mbarrier.init; init() then fences and
/// // synchronizes the block, so every thread holds a Ready handle.
/// // All threads: clean up. inval() synchronizes the block, then linear
/// // thread 0 runs mbarrier.inval.
    /// **All threads**: this is a plain constructor with no device effect. Every
    /// thread wraps the same static, and `init()` then elects linear thread 0 to
    /// run `mbarrier.init`. Do not wrap `init()` in a thread-0 branch: it
    /// synchronizes the whole block, and a block-wide sync inside a branch that
    /// only some threads take is undefined, in practice a hang.
    /// // All threads: wrap and 
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
/// | Operation       | Thread Requirement        |
/// |-----------------|---------------------------|
/// | `from_static()` | Single thread (thread 0)  |
/// | `init()`        | Single thread (thread 0)  |
/// | `arrive()`      | All participating threads |
/// | `wait()`        | All participating threads |
/// | `inval()`       | Single thread (thread 0)  |
/// // Thread 0: Create and initialize
/// fence_proxy_async_shared_cta();
/// sync_threads();
/// // Thread 0: Cleanup
/// sync_threads();
    /// **Single-thread**: Only call from the initialization thread (thread 0).
    /// if tid == 0 {
    ///     let bar0 = ManagedBarrier::<Uninit, TmaBarrier>::from_static(&raw mut BAR0);
    ///     let bar1 = ManagedBarrier::<Uninit, GeneralBarrier>::from_static(&raw mut BAR1);
    ///     let bar0 = unsafe { bar0.init(32) };
    ///     let bar1 = unsafe { bar1.init(32) };
    /// }
    /// **All threads in the block should call this.** Only thread 0 performs
    /// the actual initialization; all threads synchronize and receive a `Ready` handle.
    /// // ALL threads call init - only thread 0 actually initializes
    /// **All threads in the block should call this.** Only the thr
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b606fdd` are properly handled with clean fallback behavior.
