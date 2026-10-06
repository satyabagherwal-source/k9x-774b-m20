# Forensic Learning Record (Deep Inspection): mlua-rs/mlua

> **Canonical Artifact**: `07_PROJECT_LEARNING/mlua-rs-mlua-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mlua-rs/mlua](https://github.com/mlua-rs/mlua))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:41.133Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mlua-rs/mlua`
- **Description**: High level Lua 5.5/5.4/5.3/5.2/5.1 (including LuaJIT) and Luau bindings to Rust with async/await support
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2892 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/state.rs`
```
//! Lua state management.
//!
//! This module provides the main [`Lua`] state handle together with state-specific
//! configuration and garbage collector controls.

use std::any::TypeId;
use std::cell::{BorrowError, BorrowMutError, RefCell};
use std::marker::PhantomData;
use std::ops::Deref;
use std::os::raw::{c_char, c_int};
use std::panic::Location;
use std::result::Result as StdResult;
use std::{fmt, mem, ptr};

use crate::chunk::{AsChunk, Chunk};
use crate::debug::Debug;
use crate::error::{Error, Result};
use crate::function::Function;
use crate::memory::MemoryState;
use crate::multi::MultiValue;
use crate::scope::Scope;
use crate::stdlib::StdLib;
use crate::string::LuaString;
use crate::table::Table;
use crate::thread::{Thread, ThreadEvent, ThreadTriggers};
use crate::traits::{FromLua, FromLuaMulti, IntoLua, IntoLuaMulti};
use crate::types::{
    AppDataRef, AppDataRefMut, ArcReentrantMutexGuard, Integer, LuaType, MaybeSend, MaybeSync, Number,
    ReentrantMutex, ReentrantMutexGuard, RegistryKey, VmState, XRc, XWeak,
};
use crate::userdata::{AnyUserData, UserData, UserDataProxy, UserDataRegistry, UserDataStorage};
use crate::util::{StackGuard, assert_stack, check_stack, protect_lua_closure, push_string, rawset_field};
use crate::value::{Nil, Value};

#[cfg(not(feature = "luau"))]
use crate::{debug::HookTriggers, types::HookKind};

#[cfg(any(feature = "luau", doc))]
use crate::{buffer::Buffer, chunk::Compiler};

#[cfg(feature = "async")]
use {
    crate::types::LightUserData,
    std::future::{self, Future},
    std::task::Poll,
};

#[cfg(feature = "serde")]
use serde::Serialize;

pub(crate) use extra::ExtraData;
#[doc(hidden)]
pub use raw::RawLua;
pub(crate) use util::callback_error_ext;

/// Top level Lua struct which represents an instance of Lua VM.
pub struct Lua {
    pub(self) raw: XRc<ReentrantMutex<RawLua>>,
    // Controls whether garbage collection should be run on drop
    pub(self) collect_garbage: bool,
}

/// Weak reference to Lua instance.
///
/// This can used to prevent circular references between Lua and Rust objects.
#[derive(Clone)]
pub struct WeakLua(XWeak<ReentrantMutex<RawLua>>);

pub(crate) struct LuaGuard(ArcReentrantMutexGuard<RawLua>);

/// Tuning parameters for the incremental GC collector.
///
/// Each field is an [`Option`]: `None` leaves the corresponding parameter unchanged, while
/// `Some(v)` sets it. Units and ranges depend on the Lua version, check the Lua reference manual
/// for details.
#[non_exhaustive]
#[derive(Clone, Copy, Debug, Default)]
pub struct GcIncParams {
    /// Pause between successive GC cycles, expressed as a percentage of live memory.
    #[cfg(not(feature = "luau"))]
    #[cfg_attr(docsrs, doc(cfg(not(feature = "luau"))))]
    pub pause: Option<c_int>,

    /// Target heap size as a percentage of live data, controlling how aggressively
    /// the GC reclaims memory (`LUA_GCSETGOAL`).
    #[cfg(any(feature = "luau", doc))]
    #[cfg_attr(docsrs, doc(cfg(feature = "luau")))]
    pub goal: Option<c_int>,

    /// GC work performed per unit of memory allocated.
    pub step_multiplier: Option<c_int>,

    /// Granularity of each GC step.
    ///
    /// The unit is version-dependent, check the Lua reference manual for details.
    #[cfg(any(feature = "lua55", feature = "lua54", feature = "luau"))]
    #[cfg_attr(docsrs, doc(cfg(any(feature = "lua55", feature = "lua54", feature = "luau"))))]
    pub step_size: Option<c_int>,
}

impl GcIncParams {
    /// Sets the `pause` parameter.
    #[cfg(not(feature = "luau"))]
    #[cfg_attr(docsrs, doc(cfg(not(feature = "luau"))))]
    #[must_use]
    pub fn pause(mut self, v: c_int) -> Self {
        self.pause = Some(v);
        self
    }

    /// Sets the `goal` parameter.
    #[cfg(any(feature = "luau", doc))]
    #[cfg_attr(docsrs, doc(cfg(feature = "luau")))]
    #[must_use]
    pub fn goal(mut self, v: c_int) -> Self {
        self.goal = Some(v);
        self
    }

    /// Sets the `step_multiplier` parameter.
    #[must_use]
    pub fn step_multiplier(mut self, v: c_int) -> Self {
        self.step_multiplier = Some(v);
        self
    }

    /// Sets the `step_size` parameter.
    #[cfg(any(feature = "lua55", feature = "lua54", feature = "luau"))]
    #[cfg_attr(docsrs, doc(cfg(any(feature = "lua55", feature = "lua54", feature = "luau"))))]
    #[must_use]
    pub fn step_size(mut self, v: c_int) -> Self {
        self.step_size = Some(v);
        self
    }
}

/// Tuning parameters for the generational GC collector (Lua 5.4+).
///
/// Each field is an [`Option`]: `None` leaves the corresponding parameter unchanged, while
/// `Some(v)` sets it. Units and ranges depend on the Lua version, check the reference manual
/// for details.
#[cfg(any(feature = "lua55", feature = "lua54"))]
#[cfg_attr(docsrs, doc(cfg(any(feature = "lua55", feature = "lua54"))))]
#[non_exhaustive]
#[derive(Clone, Copy, Debug, Default)]
pub struct GcGenParams {
    /// Frequency of minor (young-generation) collection steps.
    pub minor_multiplier: Option<c_int>,

    /// Threshold controlling how large the young generation can grow before triggering
    /// a shift from minor to major collection.
    pub minor_to_major: Option<c_int>,

    /// Threshold controlling how much the major collection must shrink the heap before
    /// switching back to minor (young-generation) collection.
    #[cfg(feature = "lua55")]
    #[cfg_attr(docsrs, doc(cfg(feature = "lua55")))]
    pub major_to_minor: Option<c_int>,
}

#[cfg(any(feature = "lua55", feature = "lua54"))]
impl GcGenParams {
    /// Sets the `minor_multiplier` parameter.
    #[must_use]
    pub fn minor_multiplier(mut self, v: c_int) -> Self {
        self.minor_multiplier = Some(v);
        self
    }

    /// Sets the `minor_to_major` threshold.
    #[must_use]
    pub fn minor_to_major(mut self, v: c_int) -> Self {
        self.minor_to_major = Some(v);
        self
    }

    /// Sets the `major_to_minor` parameter.
    #[cfg(feature = "lua55")]
    #[cfg_attr(docsrs, doc(cfg(feature = "lua55")))]
    #[must_use]
    pub fn major_to_minor(mut self, v: c_int) -> Self {
        self.major_to_minor = Some(v);
        self
    }
}

/// Lua garbage collector (GC) operating mode.
///
/// Use [`Lua::gc_set_mode`] to switch the collector mode and/or tune its parameters.
#[non_exhaustive]
#[derive(Clone, Debug)]
pub enum GcMode {
    /// Incremental mark-and-sweep
    Incremental(GcIncParams),

    /// Generational
    #[cfg(any(feature = "lua55", feature = "lua54"))]
    #[cfg_attr(docsrs, doc(cfg(any(feature = "lua55", feature = "lua54"))))]
    Generational(GcGenParams),
}

/// Controls Lua interpreter behavior such as Rust panics handling.
#[derive(Clone, Debug)]
#[non_exhaustive]
pub struct LuaOptions {
    /// Catch Rust panics when using [`pcall`]/[`xpcall`].
    ///
    /// If disabled, wraps these functions and automatically resumes panic if found.
    /// Also in Lua 5.1 adds ability to provide arguments to [`xpcall`] similar to Lua >= 5.2.
    ///
    /// If enabled, keeps [`pcall`]/[`xpcall`] unmodified.
    /// Panics are still automatically resumed if returned to the Rust side.
    ///
    /// Default: **true**
    ///
    /// [`pcall`]: https://www.lua.org/manual/5.4/manual.html#pdf-pcall
    /// [`xpcall`]: https://www.lua.org/manual/5.4/manual.html#pdf-xpcall
    pub catch_rust_panics: bool,

    /// Max size of thread (coroutine) object pool used to execute asynchronous functions.
    ///
    /// Default: **0** (disabled)
    ///
    /// [`lua_resetthread`]: https://www.lua.org/manual/5.4/manual.html#lua_resetthread
    #[cfg(feature = "async")]
    #[cfg_attr(docsrs, doc(cfg(feature = "async")))]
    pub thread_pool_size: usize,
}

impl Default for LuaOptions {
    fn default() -> Self {
        const { LuaOptions::new() }
    }
}

impl LuaOptions {
    /// Returns a new instance of `LuaOptions` with default parameters.
    pub const fn new() -> Self {
        LuaOptions {
            catch_rust_panics: true,
            #[cfg(feature = "async")]
            thread_pool_size: 0,
        }
    }

    /// Sets [`catch_rust_panics`] option.
    ///
    /// [`catch_rust_panics`]: #structfield.catch_rust_panics
    #[must_use]
    pub const fn catch_rust_panics(mut self, enabled: bool) -> Self {
        self.catch_rust_panics = enabled;
        self
    }

    /// Sets [`thread_pool_size`] option.
    ///
    /// [`thread_pool_size`]: #structfield.thread_pool_size
    #[cfg(feature = "async")]
    #[cfg_attr(docsrs, doc(cfg(feature = "async")))]
    #[must_use]
    pub const fn thread_pool_size(mut self, size: usize) -> Self {
        self.thread_pool_size = size;
        self
    }
}

/// Luau JIT options
#[cfg(any(feature = "luau-jit", doc))]
#[cfg_attr(docsrs, doc(cfg(feature = "luau-jit")))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JitOptions {
    inliner: bool,
}

#[cfg(any(feature = "luau-jit", doc))]
impl Default for JitOptions {
    fn default() -> Self {
        const { Self::new() }
    }
}

#[cfg(any(feature = "luau-jit", doc))]
impl JitOptions {
    /// Creates default JIT options.
    pub const fn new() -> Self {
        JitOptions { inliner: false }
    }

    /// Toggles the runtime bytecode inliner.
    ///
    /// Disabled by default. Enable before compiling and executing code.
    #[must_use]
    pub const fn inliner(mut self, enabled: bool) -> Self {
        self.inliner = enabled;
        self
    }
}

impl Drop for Lua {
    fn drop(&mut self) {
        if self.collect_garbage {
            let _ = self.gc_collect();
        }
    }
}

impl Clone for Lua {
    #[inline]
    fn clone(&self) -> Self {
        Lua {
            raw: XRc::clone(&self.raw),
            collect_garbage: false,
        }
    }
}

impl fmt::Debug for Lua {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Lua({:p})", self.state())
    }
}

impl Default for Lua {
    #[inline]
    fn default() -> Self {
        Lua::new()
    }
}


```

### Core Architecture Module: `src/state/extra.rs`
```
use std::any::TypeId;
use std::cell::UnsafeCell;
use std::mem::MaybeUninit;
use std::os::raw::{c_int, c_void};
use std::ptr;
use std::rc::Rc;
use std::sync::Arc;

use parking_lot::Mutex;
use rustc_hash::FxHashMap;

use crate::error::{Error, Result};
use crate::memory::MemoryState;
use crate::state::RawLua;
use crate::stdlib::StdLib;
use crate::thread::ThreadTriggers;
use crate::types::{AppData, ReentrantMutex, ThreadEventCallback, XRc};
use crate::userdata::RawUserDataRegistry;
use crate::util::{TypeKey, WrappedFailure, get_internal_metatable, push_internal_userdata};

#[cfg(any(feature = "luau", doc))]
use crate::chunk::Compiler;

#[cfg(feature = "async")]
use {futures_util::task::noop_waker_ref, std::ptr::NonNull, std::task::Waker};

use super::{Lua, WeakLua};

// Unique key to store `ExtraData` in the registry
static EXTRA_REGISTRY_KEY: u8 = 0;

const WRAPPED_FAILURE_POOL_DEFAULT_CAPACITY: usize = 64;
const REF_STACK_RESERVE: c_int = 3;

/// Data associated with the Lua state.
pub(crate) struct ExtraData {
    pub(super) lua: MaybeUninit<Lua>,
    pub(super) weak: MaybeUninit<WeakLua>,
    pub(super) owned: bool,

    pub(super) pending_userdata_reg: FxHashMap<TypeId, RawUserDataRegistry>,
    pub(super) registered_userdata_t: FxHashMap<TypeId, c_int>,
    pub(super) registered_userdata_mt: FxHashMap<*const c_void, Option<TypeId>>,
    pub(super) last_checked_userdata_mt: (*const c_void, Option<TypeId>),

    // When Lua instance dropped, setting `None` would prevent collecting `RegistryKey`s
    pub(super) registry_unref_list: Arc<Mutex<Option<Vec<c_int>>>>,

    // Containers to store arbitrary data (extensions)
    pub(super) app_data: AppData,
    pub(super) app_data_priv: AppData,

    pub(super) safe: bool,
    pub(super) libs: StdLib,
    // Cached allocation protection decision for owned states
    pub(super) unlikely_memory_error: bool,
    // Used in module mode
    pub(super) skip_memory_check: bool,

    // Auxiliary thread to store references
    pub(super) ref_thread: *mut ffi::lua_State,
    pub(super) ref_stack_size: c_int,
    pub(super) ref_stack_top: c_int,
    pub(super) ref_free: Vec<c_int>,

    // Pool of `WrappedFailure` enums in the ref thread (as userdata)
    pub(super) wrapped_failure_pool: Vec<c_int>,
    pub(super) wrapped_failure_top: usize,
    // Pool of `Thread`s (coroutines) for async execution
    #[cfg(feature = "async")]
    pub(super) thread_pool: Vec<c_int>,
    // Map for implicit threads to root user-owned Thread
    #[cfg(feature = "async")]
    pub(super) thread_ownership_map: FxHashMap<*mut ffi::lua_State, *mut ffi::lua_State>,

    // Address of `WrappedFailure` metatable
    pub(super) wrapped_failure_mt_ptr: *const c_void,

    // Waker for polling futures
    #[cfg(feature = "async")]
    pub(super) waker: NonNull<Waker>,

    #[cfg(not(feature = "luau"))]
    pub(super) hook_callback: Option<crate::types::HookCallback>,
    #[cfg(not(feature = "luau"))]
    pub(super) hook_triggers: crate::debug::HookTriggers,
    #[cfg(any(feature = "lua55", feature = "lua54", feature = "lua53"))]
    pub(super) hook_removed_while_yielded: bool,
    #[cfg(any(feature = "lua55", feature = "lua54"))]
    pub(super) warn_callback: Option<crate::types::WarnCallback>,
    #[cfg(feature = "luau")]
    pub(super) interrupt_callback: Option<crate::types::InterruptCallback>,
    pub(super) thread_triggers: ThreadTriggers,
    pub(super) thread_event_callback: Option<ThreadEventCallback>,
    pub(super) thread_event_state: *mut ffi::lua_State,

    #[cfg(feature = "luau")]
    pub(crate) running_gc: bool,
    #[cfg(feature = "luau")]
    pub(crate) sandboxed: bool,
    #[cfg(feature = "luau")]
    pub(super) compiler: Option<Compiler>,
    #[cfg(feature = "luau-jit")]
    pub(super) enable_jit: bool,
    #[cfg(feature = "luau")]
    pub(crate) mem_categories: Vec<std::ffi::CString>,
}

impl Drop for ExtraData {
    fn drop(&mut self) {
        unsafe {
            if !self.owned {
                self.lua.assume_init_drop();
            }

            self.weak.assume_init_drop();
        }
        *self.registry_unref_list.lock() = None;
    }
}

static EXTRA_TYPE_KEY: u8 = 0;

impl TypeKey for XRc<UnsafeCell<ExtraData>> {
    #[inline(always)]
    fn type_key() -> *const c_void {
        &EXTRA_TYPE_KEY as *const u8 as *const c_void
    }
}

impl ExtraData {
    // Index of `error_traceback` function in auxiliary thread stack
    #[cfg(any(feature = "lua51", feature = "luajit", feature = "luau"))]
    pub(super) const ERROR_TRACEBACK_IDX: c_int = 1;

    pub(super) unsafe fn init(state: *mut ffi::lua_State, owned: bool) -> XRc<UnsafeCell<Self>> {
        // Create ref stack thread and place it in the registry to prevent it
        // from being garbage collected.
        let ref_thread = mlua_expect!(
            protect_lua!(state, 0, 0, |state| {
                let thread = ffi::lua_newthread(state);
                ffi::luaL_ref(state, ffi::LUA_REGISTRYINDEX);
                thread
            }),
            "Error while creating ref thread",
        );

        // Do not run inherited hooks during protected ref stack growth (matters in module mode)
        #[cfg(all(feature = "lua51", not(feature = "vendored")))]
        ffi::lua_sethook(ref_thread, None, 0, 0);

        let wrapped_failure_mt_ptr = {
            get_internal_metatable::<WrappedFailure>(state);
            let ptr = ffi::lua_topointer(state, -1);
            ffi::lua_pop(state, 1);
            ptr
        };

        // Store `error_traceback` function on the ref stack
        #[cfg(any(feature = "lua51", feature = "luajit", feature = "luau"))]
        {
            ffi::lua_pushcfunction(ref_thread, crate::util::error_traceback);
            assert_eq!(ffi::lua_gettop(ref_thread), Self::ERROR_TRACEBACK_IDX);
        }

        #[allow(clippy::arc_with_non_send_sync)]
        let extra = XRc::new(UnsafeCell::new(ExtraData {
            lua: MaybeUninit::uninit(),
            weak: MaybeUninit::uninit(),
            owned,
            pending_userdata_reg: FxHashMap::default(),
            registered_userdata_t: FxHashMap::default(),
            registered_userdata_mt: FxHashMap::default(),
            last_checked_userdata_mt: (ptr::null(), None),
            registry_unref_list: Arc::new(Mutex::new(Some(Vec::new()))),
            app_data: AppData::default(),
            app_data_priv: AppData::default(),
            safe: false,
            libs: StdLib::NONE,
            unlikely_memory_error: owned && {
                let mem_state = MemoryState::get(state);
                !mem_state.is_null() && (*mem_state).memory_limit() == 0
            },
            skip_memory_check: false,
            ref_thread,
            // We need some reserved stack space to move values in and out of the ref stack.
            ref_stack_size: ffi::LUA_MINSTACK - REF_STACK_RESERVE,
            ref_stack_top: ffi::lua_gettop(ref_thread),
            ref_free: Vec::new(),
            wrapped_failure_pool: Vec::with_capacity(WRAPPED_FAILURE_POOL_DEFAULT_CAPACITY),
            wrapped_failure_top: 0,
            #[cfg(feature = "async")]
            thread_pool: Vec::new(),
            #[cfg(feature = "async")]
            thread_ownership_map: FxHashMap::default(),
            wrapped_failure_mt_ptr,
            #[cfg(feature = "async")]
            waker: NonNull::from(noop_waker_ref()),
            #[cfg(not(feature = "luau"))]
            hook_callback: None,
            #[cfg(not(feature = "luau"))]
            hook_triggers: Default::default(),
            #[cfg(any(feature = "lua55", feature = "lua54", feature = "lua53"))]
            hook_removed_while_yielded: false,
            #[cfg(any(feature = "lua55", feature = "lua54"))]
            warn_callback: None,
            #[cfg(feature = "luau")]
            interrupt_callback: None,
            thread_triggers: ThreadTriggers::default(),
            thread_event_callback: None,
            thread_event_state: ptr::null_mut(),
            #[cfg(feature = "luau")]
            sandboxed: false,
            #[cfg(feature = "luau")]
            compiler: None,
            #[cfg(feature = "luau-jit")]
            enable_jit: true,
            #[cfg(feature = "luau")]
            running_gc: false,
            #[cfg(feature = "luau")]
            mem_categories: vec![std::ffi::CString::new("main").unwrap()],
        }));

        // Store it in the registry
        mlua_expect!(Self::store(&extra, state), "Error while storing extra data");

        extra
    }

    pub(super) unsafe fn set_lua(&mut self, raw: &XRc<ReentrantMutex<RawLua>>) {
        self.lua.write(Lua {
            raw: XRc::clone(raw),
            collect_garbage: false,
        });
        self.weak.write(WeakLua(XRc::downgrade(raw)));
    }

    pub(crate) unsafe fn get(state: *mut ffi::lua_State) -> *mut Self {
        #[cfg(feature = "luau")]
        if cfg!(not(feature = "module")) {
            // In the main app we can use `lua_callbacks` to access ExtraData
            return (*ffi::lua_callbacks(state)).userdata as *mut _;
        }

        let extra_key = &EXTRA_REGISTRY_KEY as *const u8 as *const c_void;
        if ffi::lua_rawgetp(state, ffi::LUA_REGISTRYINDEX, extra_key) != ffi::LUA_TUSERDATA {
            // `ExtraData` can be null only when Lua state is foreign.
            // This case in used in `Lua::try_from_ptr()`.
            ffi::lua_pop(state, 1);
            return ptr::null_mut();
        }
        let extra_ptr = ffi::lua_touserdata(state, -1) as *mut Rc<UnsafeCell<ExtraData>>;
        ffi::lua_pop(state, 1);
        (*extra_ptr).get()
    }

    unsafe fn store(extra: &XRc<UnsafeCell<Self>>, state: *mut ffi::lua_State) -> Result<()> {
        #[cfg(feature = "luau")]
        if cfg!(not(feature = "module")) {
            (*ffi::lua_callbacks(state)).userdata = extra.get() as *mut _;
            return Ok(());
        }

        push_internal_userdata(state, XRc::clone(extra), tr
```

### Core Architecture Module: `src/state/raw.rs`
```
use std::any::TypeId;
use std::cell::{Cell, UnsafeCell};
use std::ffi::CStr;
use std::mem::{self, ManuallyDrop};
use std::os::raw::{c_char, c_int, c_void};
use std::panic::resume_unwind;
use std::ptr::{self, NonNull};
use std::sync::Arc;

use crate::chunk::ChunkMode;
use crate::error::{Error, Result};
use crate::function::Function;
use crate::memory::{ALLOCATOR, MemoryState};
use crate::state::util::callback_error_ext;
use crate::stdlib::StdLib;
use crate::string::LuaString;
use crate::table::Table;
use crate::thread::{Thread, ThreadTriggers};
use crate::traits::{FromLua, IntoLua};
use crate::types::{
    AppDataRef, AppDataRefMut, Callback, CallbackUpvalue, DestructedUserdata, Integer, LightUserData,
    LuaType, MaybeSend, ReentrantMutex, RegistryKey, ThreadEventCallback, ValueRef, XRc,
};
use crate::userdata::{
    AnyUserData, MetaMethod, RawUserDataRegistry, UserData, UserDataRegistry, UserDataStorage,
    init_userdata_metatable,
};
use crate::util::{
    StackGuard, WrappedFailure, assert_stack, check_stack, get_destructed_userdata_metatable,
    get_internal_userdata, get_main_state, get_metatable_ptr, get_userdata, init_error_registry,
    init_internal_metatable, pop_error, push_internal_userdata, push_string, push_table, push_userdata,
    rawset_field, safe_pcall, safe_xpcall, short_type_name,
};
use crate::value::{Nil, Value};

use super::extra::ExtraData;
use super::{Lua, LuaOptions, WeakLua};

#[cfg(not(feature = "luau"))]
use crate::{
    debug::Debug,
    types::{HookCallback, HookKind, VmState},
};

#[cfg(feature = "async")]
use {
    crate::multi::MultiValue,
    crate::traits::FromLuaMulti,
    crate::types::{AsyncCallback, AsyncCallbackUpvalue, AsyncPollUpvalue},
    std::task::{Context, Poll, Waker},
};

/// An internal Lua struct which holds a raw Lua state.
#[doc(hidden)]
pub struct RawLua {
    // The state is dynamic and depends on context
    pub(super) state: Cell<*mut ffi::lua_State>,
    pub(super) main_state: Option<NonNull<ffi::lua_State>>,
    pub(super) extra: ManuallyDrop<XRc<UnsafeCell<ExtraData>>>,
    owned: bool,
}

impl Drop for RawLua {
    fn drop(&mut self) {
        unsafe {
            if !self.owned {
                return;
            }

            let mem_state = MemoryState::get(self.main_state());

            #[cfg(feature = "luau")]
            {
                // Reset any callbacks
                (*ffi::lua_callbacks(self.main_state())).interrupt = None;
                (*ffi::lua_callbacks(self.main_state())).userthread = None;
            }

            ffi::lua_close(self.main_state());

            // Deallocate `MemoryState`
            if !mem_state.is_null() {
                drop(Box::from_raw(mem_state));
            }

            // Drop the `ExtraData` reference after `lua_close` has collected the registry entry
            ManuallyDrop::drop(&mut self.extra);
        }
    }
}

#[cfg(feature = "send")]
unsafe impl Send for RawLua {}

impl RawLua {
    #[inline(always)]
    pub(crate) fn lua(&self) -> &Lua {
        unsafe { (*self.extra.get()).lua() }
    }

    #[inline(always)]
    pub(crate) fn weak(&self) -> &WeakLua {
        unsafe { (*self.extra.get()).weak() }
    }

    #[cfg(feature = "luau")]
    #[inline(always)]
    pub(crate) fn is_running_gc(&self) -> bool {
        unsafe { (*self.extra.get()).running_gc }
    }

    /// Returns a pointer to the current Lua state.
    ///
    /// The pointer refers to the active Lua coroutine and depends on the context.
    #[inline(always)]
    pub fn state(&self) -> *mut ffi::lua_State {
        self.state.get()
    }

    #[inline(always)]
    pub(crate) fn main_state(&self) -> *mut ffi::lua_State {
        self.main_state
            .map(|state| state.as_ptr())
            .unwrap_or_else(|| self.state())
    }

    #[inline(always)]
    pub(crate) fn ref_thread(&self) -> *mut ffi::lua_State {
        unsafe { (*self.extra.get()).ref_thread }
    }

    pub(super) unsafe fn new(libs: StdLib, options: &LuaOptions) -> XRc<ReentrantMutex<Self>> {
        #[cfg(feature = "luau-jit")]
        crate::luau::init_jit_flags();

        let mem_state: *mut MemoryState = Box::into_raw(Box::default());
        #[cfg(feature = "lua55")]
        let mut state = {
            let seed = ffi::luaL_makeseed(ptr::null_mut());
            ffi::lua_newstate(ALLOCATOR, mem_state as *mut c_void, seed)
        };
        #[cfg(not(feature = "lua55"))]
        let mut state = ffi::lua_newstate(ALLOCATOR, mem_state as *mut c_void);
        // If state is null then switch to Lua internal allocator
        if state.is_null() {
            drop(Box::from_raw(mem_state));
            state = ffi::luaL_newstate();
        }
        assert!(!state.is_null(), "Failed to create a Lua VM");

        ffi::luaL_requiref(state, cstr!("_G"), ffi::luaopen_base, 1);
        ffi::lua_pop(state, 1);

        // Init Luau code generator (jit)
        #[cfg(feature = "luau-jit")]
        if ffi::luau_codegen_supported() != 0 {
            ffi::luau_codegen_create(state);
        }

        let rawlua = Self::init_from_ptr(state, true);
        let extra = rawlua.lock().extra.get();

        mlua_expect!(
            load_std_libs(state, libs),
            "Error during loading standard libraries"
        );
        (*extra).libs |= libs;

        if !options.catch_rust_panics {
            mlua_expect!(
                (|| -> Result<()> {
                    let _sg = StackGuard::new(state);

                    #[cfg(any(feature = "lua55", feature = "lua54", feature = "lua53", feature = "lua52"))]
                    ffi::lua_rawgeti(state, ffi::LUA_REGISTRYINDEX, ffi::LUA_RIDX_GLOBALS);
                    #[cfg(any(feature = "lua51", feature = "luajit", feature = "luau"))]
                    ffi::lua_pushvalue(state, ffi::LUA_GLOBALSINDEX);

                    ffi::lua_pushcfunction(state, safe_pcall);
                    rawset_field(state, -2, "pcall")?;

                    ffi::lua_pushcfunction(state, safe_xpcall);
                    rawset_field(state, -2, "xpcall")?;

                    Ok(())
                })(),
                "Error during applying option `catch_rust_panics`"
            )
        }

        #[cfg(feature = "async")]
        if options.thread_pool_size > 0 {
            (*extra).thread_pool.reserve_exact(options.thread_pool_size);
        }

        rawlua
    }

    pub(super) unsafe fn init_from_ptr(state: *mut ffi::lua_State, owned: bool) -> XRc<ReentrantMutex<Self>> {
        assert!(!state.is_null(), "Lua state is NULL");
        if let Some(lua) = Self::try_from_ptr(state) {
            return lua;
        }

        let main_state = get_main_state(state).unwrap_or(state);
        let main_state_top = ffi::lua_gettop(main_state);

        mlua_expect!(
            (|state| {
                init_error_registry(state)?;

                // Create the internal metatables and store them in the registry
                // to prevent from being garbage collected.

                init_internal_metatable::<XRc<UnsafeCell<ExtraData>>>(state, None)?;
                init_internal_metatable::<Callback>(state, None)?;
                init_internal_metatable::<CallbackUpvalue>(state, None)?;
                #[cfg(not(feature = "luau"))]
                init_internal_metatable::<HookCallback>(state, None)?;
                #[cfg(feature = "async")]
                {
                    init_internal_metatable::<AsyncCallback>(state, None)?;
                    init_internal_metatable::<AsyncCallbackUpvalue>(state, None)?;
                    init_internal_metatable::<AsyncPollUpvalue>(state, None)?;
                    init_internal_metatable::<Option<Waker>>(state, None)?;
                }

                // Init serde metatables
                #[cfg(feature = "serde")]
                crate::serde::init_metatables(state)?;

                Ok::<_, Error>(())
            })(main_state),
            "Error during Lua initialization",
        );

        // Init ExtraData
        let extra = ExtraData::init(main_state, owned);

        // Register `DestructedUserdata` type
        get_destructed_userdata_metatable(main_state);
        let destructed_mt_ptr = ffi::lua_topointer(main_state, -1);
        let destructed_ud_typeid = TypeId::of::<DestructedUserdata>();
        (*extra.get())
            .registered_userdata_mt
            .insert(destructed_mt_ptr, Some(destructed_ud_typeid));
        ffi::lua_pop(main_state, 1);

        mlua_debug_assert!(
            ffi::lua_gettop(main_state) == main_state_top,
            "stack leak during creation"
        );
        assert_stack(main_state, ffi::LUA_MINSTACK);

        #[allow(clippy::arc_with_non_send_sync)]
        let rawlua = XRc::new(ReentrantMutex::new(RawLua {
            state: Cell::new(state),
            // Make sure that we don't store current state as main state (if it's not available)
            main_state: get_main_state(state).and_then(NonNull::new),
            extra: ManuallyDrop::new(XRc::clone(&extra)),
            owned,
        }));
        (*extra.get()).set_lua(&rawlua);
        if owned {
            // If Lua state is managed by us, then make internal `RawLua` reference "weak"
            XRc::decrement_strong_count(XRc::as_ptr(&rawlua));
        } else {
            // If Lua state is not managed by us, then keep internal `RawLua` reference "strong"
            // but `Extra` reference weak (it will be collected from registry at lua_close time)
            XRc::decrement_strong_count(XRc::as_ptr(&extra));
        }

        rawlua
    }

    unsafe fn try_from_ptr(state: *mut ffi::lua_State) -> Option<XRc<ReentrantMutex<Self>>> {
        match ExtraData::get(state) {
            extra if extra.is_null() => None,
            extra => Some(XRc::clone(&(*extra).lua().raw)),
        }
    }

    /// Marks the Lua state as safe.
    #[inline(always)]
    pub(super) fn mark_safe(&self) {
        unsafe { (*self.extra.get()
```

### Core Architecture Module: `src/state/util.rs`
```
use std::os::raw::c_int;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::ptr::{self, NonNull};
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::state::{ExtraData, RawLua};
use crate::util::{self, WrappedFailure, get_internal_metatable};

struct StateGuard<'a>(&'a RawLua, *mut ffi::lua_State);

impl<'a> StateGuard<'a> {
    fn new(inner: &'a RawLua, mut state: *mut ffi::lua_State) -> Self {
        state = inner.state.replace(state);
        Self(inner, state)
    }
}

impl Drop for StateGuard<'_> {
    fn drop(&mut self) {
        self.0.state.set(self.1);
    }
}

// An optimized version of `callback_error` that does not allocate `WrappedFailure` userdata
// and instead reuses unused values from previous calls (or allocates new).
pub(crate) unsafe fn callback_error_ext<F, R>(
    state: *mut ffi::lua_State,
    mut extra: *mut ExtraData,
    wrap_error: bool,
    f: F,
) -> R
where
    F: FnOnce(*mut ExtraData, c_int) -> Result<R>,
{
    if extra.is_null() {
        extra = ExtraData::get(state);
    }

    let nargs = ffi::lua_gettop(state);

    enum PreallocatedFailure {
        New(NonNull<WrappedFailure>),
        Reserved,
    }

    impl PreallocatedFailure {
        #[inline(always)]
        unsafe fn reserve(state: *mut ffi::lua_State, extra: *mut ExtraData) -> Self {
            if (*extra).wrapped_failure_top > 0 {
                (*extra).wrapped_failure_top -= 1;
                return PreallocatedFailure::Reserved;
            }

            Self::reserve_new(state)
        }

        #[cold]
        #[inline(never)]
        unsafe fn reserve_new(state: *mut ffi::lua_State) -> Self {
            // We need to check stack for Luau in case when callback is called from interrupt
            // See https://github.com/luau-lang/luau/issues/446 and mlua #142 and #153
            #[cfg(feature = "luau")]
            ffi::lua_rawcheckstack(state, 2);
            // Place it to the beginning of the stack
            let ud = WrappedFailure::new_userdata(state);
            ffi::lua_insert(state, 1);
            // Lua raises an error on allocation failure instead of returning null
            PreallocatedFailure::New(NonNull::new_unchecked(ud))
        }

        #[cold]
        unsafe fn r#use(&self, state: *mut ffi::lua_State, extra: *mut ExtraData) -> *mut WrappedFailure {
            let ref_thread = (*extra).ref_thread;
            match *self {
                PreallocatedFailure::New(ud) => {
                    ffi::lua_settop(state, 1);
                    ud.as_ptr()
                }
                PreallocatedFailure::Reserved => {
                    let index = (*extra).wrapped_failure_pool.pop().unwrap();
                    ffi::lua_settop(state, 0);
                    #[cfg(feature = "luau")]
                    ffi::lua_rawcheckstack(state, 2);
                    ffi::lua_xpush(ref_thread, state, index);
                    ffi::lua_pushnil(ref_thread);
                    ffi::lua_replace(ref_thread, index);
                    (*extra).ref_free.push(index);
                    ffi::lua_touserdata(state, -1) as *mut WrappedFailure
                }
            }
        }

        #[inline(always)]
        unsafe fn release(self, state: *mut ffi::lua_State, extra: *mut ExtraData) {
            match self {
                PreallocatedFailure::New(_) => Self::release_new(state, extra),
                PreallocatedFailure::Reserved => (*extra).wrapped_failure_top += 1,
            }
        }

        #[cold]
        #[inline(never)]
        unsafe fn release_new(state: *mut ffi::lua_State, extra: *mut ExtraData) {
            let ref_thread = (*extra).ref_thread;
            ffi::lua_rotate(state, 1, -1);
            ffi::lua_xmove(state, ref_thread, 1);
            if let Ok(index) = (*extra).try_ref_stack_pop() {
                (*extra).wrapped_failure_pool.push(index);
                (*extra).wrapped_failure_top += 1;
            }
        }
    }

    // We cannot shadow Rust errors with Lua ones, so we need to reserve pre-allocated memory
    // to store a wrapped failure (error or panic) *before* we proceed.
    let prealloc_failure = PreallocatedFailure::reserve(state, extra);

    // Keep the Error payload out of catch_unwind return value
    let mut callback_error = None;
    match catch_unwind(AssertUnwindSafe(|| {
        let rawlua = (*extra).raw_lua();
        let _guard = StateGuard::new(rawlua, state);
        match f(extra, nargs) {
            Ok(result) => Some(result),
            Err(err) => {
                callback_error = Some(err);
                None
            }
        }
    })) {
        Ok(Some(r)) => {
            // Return unused `WrappedFailure` to the pool
            prealloc_failure.release(state, extra);
            r
        }
        Ok(None) => {
            let mut err = callback_error.take().unwrap();
            let wrapped_error = prealloc_failure.r#use(state, extra);
            if wrap_error {
                err = Error::CallbackError {
                    traceback: String::new(),
                    cause: Arc::new(err),
                };
            }

            // Store the error before traceback generation can fail or run GC.
            ptr::write(wrapped_error, WrappedFailure::Error(err));
            get_internal_metatable::<WrappedFailure>(state);
            ffi::lua_setmetatable(state, -2);

            if wrap_error {
                if (*extra).raw_lua().unlikely_memory_error() {
                    if ffi::lua_checkstack(state, ffi::LUA_TRACEBACK_STACK) != 0 {
                        ffi::luaL_traceback(state, state, ptr::null(), 0);
                    }
                } else if let Err(p) = catch_unwind(AssertUnwindSafe(
                    || protect_lua!(state, 0, 1, fn(state) ffi::luaL_traceback(state, state, ptr::null(), 1)),
                )) {
                    // Let Lua restore its frames before resuming a hook panic.
                    *wrapped_error = WrappedFailure::Panic(Some(p));
                }
                if let WrappedFailure::Error(Error::CallbackError { traceback, .. }) = &mut *wrapped_error {
                    // A successful call leaves the traceback above the stored error.
                    *traceback = if ffi::lua_type(state, -1) == ffi::LUA_TSTRING {
                        util::to_string(state, -1)
                    } else {
                        "<traceback unavailable>".to_string()
                    };
                }
            }

            ffi::lua_settop(state, 1);
            ffi::lua_error(state)
        }
        Err(p) => {
            let wrapped_panic = prealloc_failure.r#use(state, extra);
            ptr::write(wrapped_panic, WrappedFailure::Panic(Some(p)));
            get_internal_metatable::<WrappedFailure>(state);
            ffi::lua_setmetatable(state, -2);
            ffi::lua_error(state)
        }
    }
}

```

### Core Architecture Module: `src/userdata/util.rs`
```
use std::any::TypeId;
use std::os::raw::c_int;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::ptr;

use rustc_hash::FxHashMap;

use super::UserDataStorage;
use crate::error::{Error, Result};
use crate::types::CallbackPtr;
use crate::util::{get_userdata, rawget_field, rawset_field, take_userdata};

// Userdata type hints,  used to match types of wrapped userdata
#[derive(Clone, Copy)]
pub(crate) struct TypeIdHints {
    t: TypeId,

    #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
    rc: TypeId,
    #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
    rc_refcell: TypeId,

    #[cfg(feature = "userdata-wrappers")]
    arc: TypeId,
    #[cfg(feature = "userdata-wrappers")]
    arc_mutex: TypeId,
    #[cfg(feature = "userdata-wrappers")]
    arc_rwlock: TypeId,
    #[cfg(feature = "userdata-wrappers")]
    arc_pl_mutex: TypeId,
    #[cfg(feature = "userdata-wrappers")]
    arc_pl_rwlock: TypeId,
}

impl TypeIdHints {
    pub(crate) fn new<T: 'static>() -> Self {
        Self {
            t: TypeId::of::<T>(),

            #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
            rc: TypeId::of::<std::rc::Rc<T>>(),
            #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
            rc_refcell: TypeId::of::<std::rc::Rc<std::cell::RefCell<T>>>(),

            #[cfg(feature = "userdata-wrappers")]
            arc: TypeId::of::<std::sync::Arc<T>>(),
            #[cfg(feature = "userdata-wrappers")]
            arc_mutex: TypeId::of::<std::sync::Arc<std::sync::Mutex<T>>>(),
            #[cfg(feature = "userdata-wrappers")]
            arc_rwlock: TypeId::of::<std::sync::Arc<std::sync::RwLock<T>>>(),
            #[cfg(feature = "userdata-wrappers")]
            arc_pl_mutex: TypeId::of::<std::sync::Arc<parking_lot::Mutex<T>>>(),
            #[cfg(feature = "userdata-wrappers")]
            arc_pl_rwlock: TypeId::of::<std::sync::Arc<parking_lot::RwLock<T>>>(),
        }
    }

    #[inline(always)]
    pub(crate) fn type_id(&self) -> TypeId {
        self.t
    }
}

pub(crate) unsafe fn borrow_userdata_scoped<T, R>(
    state: *mut ffi::lua_State,
    idx: c_int,
    type_id: Option<TypeId>,
    type_hints: TypeIdHints,
    f: impl FnOnce(&T) -> R,
) -> Result<R> {
    match type_id {
        Some(type_id) if type_id == type_hints.t => {
            let ud = get_userdata::<UserDataStorage<T>>(state, idx);
            (*ud).try_borrow_scoped(|ud| f(ud))
        }

        #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
        Some(type_id) if type_id == type_hints.rc => {
            let ud = get_userdata::<UserDataStorage<std::rc::Rc<T>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| f(ud))
        }
        #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
        Some(type_id) if type_id == type_hints.rc_refcell => {
            let ud = get_userdata::<UserDataStorage<std::rc::Rc<std::cell::RefCell<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let ud = ud.try_borrow().map_err(|_| Error::UserDataBorrowError)?;
                Ok(f(&ud))
            })?
        }

        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<T>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| f(ud))
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_mutex => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<std::sync::Mutex<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let ud = ud.try_lock().map_err(|_| Error::UserDataBorrowError)?;
                Ok(f(&ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_rwlock => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<std::sync::RwLock<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let ud = ud.try_read().map_err(|_| Error::UserDataBorrowError)?;
                Ok(f(&ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_pl_mutex => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<parking_lot::Mutex<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let ud = ud.try_lock().ok_or(Error::UserDataBorrowError)?;
                Ok(f(&ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_pl_rwlock => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<parking_lot::RwLock<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let ud = ud.try_read().ok_or(Error::UserDataBorrowError)?;
                Ok(f(&ud))
            })?
        }
        _ => Err(Error::UserDataTypeMismatch),
    }
}

pub(crate) unsafe fn borrow_userdata_scoped_mut<T, R>(
    state: *mut ffi::lua_State,
    idx: c_int,
    type_id: Option<TypeId>,
    type_hints: TypeIdHints,
    f: impl FnOnce(&mut T) -> R,
) -> Result<R> {
    match type_id {
        Some(type_id) if type_id == type_hints.t => {
            let ud = get_userdata::<UserDataStorage<T>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| f(ud))
        }

        #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
        Some(type_id) if type_id == type_hints.rc => {
            let ud = get_userdata::<UserDataStorage<std::rc::Rc<T>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| match std::rc::Rc::get_mut(ud) {
                Some(ud) => Ok(f(ud)),
                None => Err(Error::UserDataBorrowMutError),
            })?
        }
        #[cfg(all(feature = "userdata-wrappers", not(feature = "send")))]
        Some(type_id) if type_id == type_hints.rc_refcell => {
            let ud = get_userdata::<UserDataStorage<std::rc::Rc<std::cell::RefCell<T>>>>(state, idx);
            (*ud).try_borrow_scoped(|ud| {
                let mut ud = ud.try_borrow_mut().map_err(|_| Error::UserDataBorrowMutError)?;
                Ok(f(&mut ud))
            })?
        }

        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<T>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| match std::sync::Arc::get_mut(ud) {
                Some(ud) => Ok(f(ud)),
                None => Err(Error::UserDataBorrowMutError),
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_mutex => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<std::sync::Mutex<T>>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| {
                let mut ud = ud.try_lock().map_err(|_| Error::UserDataBorrowMutError)?;
                Ok(f(&mut ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_rwlock => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<std::sync::RwLock<T>>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| {
                let mut ud = ud.try_write().map_err(|_| Error::UserDataBorrowMutError)?;
                Ok(f(&mut ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_pl_mutex => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<parking_lot::Mutex<T>>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| {
                let mut ud = ud.try_lock().ok_or(Error::UserDataBorrowMutError)?;
                Ok(f(&mut ud))
            })?
        }
        #[cfg(feature = "userdata-wrappers")]
        Some(type_id) if type_id == type_hints.arc_pl_rwlock => {
            let ud = get_userdata::<UserDataStorage<std::sync::Arc<parking_lot::RwLock<T>>>>(state, idx);
            (*ud).try_borrow_scoped_mut(|ud| {
                let mut ud = ud.try_write().ok_or(Error::UserDataBorrowMutError)?;
                Ok(f(&mut ud))
            })?
        }
        _ => Err(Error::UserDataTypeMismatch),
    }
}

// Populates the given table with the appropriate members to be a userdata metatable for the given
// type. This function takes the given table at the `metatable` index, and adds an appropriate
// `__gc` member to it for the given type and a `__metatable` entry to protect the table from script
// access. The function also, if given a `field_getters` or `methods` tables, will create an
// `__index` metamethod (capturing previous one) to lookup in `field_getters` first, then `methods`
// and falling back to the captured `__index` if no matches found.
// The same is also applicable for `__newindex` metamethod and `field_setters` table.
// Internally uses 9 stack spaces and does not call checkstack.
pub(crate) unsafe fn init_userdata_metatable(
    state: *mut ffi::lua_State,
    metatable: c_int,
    field_getters: Option<c_int>,
    field_setters: Option<c_int>,
    methods: Option<c_int>,
    _methods_map: Option<(FxHashMap<Vec<u8>, CallbackPtr>, c_int)>, // Used only in Luau for `__namecall`
) -> Result<()> {
    if field_getters.is_some() || methods.is_some() {
        // Push `__index` generator function
        init_userdata_metatable_index(state)?;

        let index_type = rawget_field(state, metatable, "__index")?;
        match index_type {
            ffi::LUA_TNIL | ffi::LUA_TTABLE | ffi::LUA_TFUNCTION => {
                for &idx in &[field_getters, methods] {
                    if let Some(idx) = idx {
                        ffi::lua_pushvalue(state, idx);
                    } else {
                        ffi::lua_pushnil(state);
                    }
                }

                // Generat
```

### Core Architecture Module: `src/util/error.rs`
```
use std::any::Any;
use std::fmt::Write as _;
use std::mem::MaybeUninit;
use std::os::raw::{c_int, c_void};
use std::panic::{AssertUnwindSafe, catch_unwind, resume_unwind};
use std::ptr;
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::memory::MemoryState;
use crate::util::{
    DESTRUCTED_USERDATA_METATABLE, TypeKey, check_stack, get_internal_userdata, init_internal_metatable,
    push_internal_userdata, push_string, push_table, rawset_field, to_string,
};

static WRAPPED_FAILURE_TYPE_KEY: u8 = 0;

pub(crate) enum WrappedFailure {
    None,
    Error(Error),
    Panic(Option<Box<dyn Any + Send + 'static>>),
}

impl TypeKey for WrappedFailure {
    #[inline(always)]
    fn type_key() -> *const c_void {
        &WRAPPED_FAILURE_TYPE_KEY as *const u8 as *const c_void
    }
}

impl WrappedFailure {
    pub(crate) unsafe fn new_userdata(state: *mut ffi::lua_State) -> *mut Self {
        // Unprotected calls always return `Ok`
        push_internal_userdata(state, WrappedFailure::None, false).unwrap()
    }
}

// In the context of a lua callback, this will call the given function and if the given function
// returns an error, *or if the given function panics*, this will result in a call to `lua_error` (a
// longjmp). The error or panic is wrapped in such a way that when calling `pop_error` back on
// the Rust side, it will resume the panic.
//
// This function assumes the structure of the stack at the beginning of a callback, that the only
// elements on the stack are the arguments to the callback.
//
// This function uses some of the bottom of the stack for error handling, the given callback will be
// given the number of arguments available as an argument, and should return the number of returns
// as normal, but cannot assume that the arguments available start at 0.
unsafe fn callback_error<F, R>(state: *mut ffi::lua_State, f: F) -> R
where
    F: FnOnce(c_int) -> Result<R>,
{
    let nargs = ffi::lua_gettop(state);

    // We need 2 extra stack spaces to store preallocated memory and error/panic metatable
    let extra_stack = if nargs < 2 { 2 - nargs } else { 1 };
    ffi::luaL_checkstack(
        state,
        extra_stack,
        cstr!("not enough stack space for callback error handling"),
    );

    // We cannot shadow Rust errors with Lua ones, we pre-allocate enough memory
    // to store a wrapped error or panic *before* we proceed.
    let ud = WrappedFailure::new_userdata(state);
    ffi::lua_rotate(state, 1, 1);

    match catch_unwind(AssertUnwindSafe(|| f(nargs))) {
        Ok(Ok(r)) => {
            ffi::lua_remove(state, 1);
            r
        }
        Ok(Err(err)) => {
            ffi::lua_settop(state, 1);

            // Store the error before traceback generation can fail or run GC.
            let err = Error::CallbackError {
                traceback: String::new(),
                cause: Arc::new(err),
            };
            ptr::write(ud, WrappedFailure::Error(err));
            if let Err(p) = catch_unwind(AssertUnwindSafe(
                || protect_lua!(state, 0, 1, fn(state) ffi::luaL_traceback(state, state, ptr::null(), 1)),
            )) {
                // Let Lua restore its frames before resuming a hook panic.
                *ud = WrappedFailure::Panic(Some(p));
            }
            if let WrappedFailure::Error(Error::CallbackError { traceback, .. }) = &mut *ud {
                *traceback = if ffi::lua_type(state, -1) == ffi::LUA_TSTRING {
                    to_string(state, -1)
                } else {
                    "<traceback unavailable>".to_string()
                };
            }
            ffi::lua_settop(state, 1);
            ffi::lua_error(state)
        }
        Err(p) => {
            ffi::lua_settop(state, 1);
            ptr::write(ud, WrappedFailure::Panic(Some(p)));
            ffi::lua_error(state)
        }
    }
}

// Pops an error off of the stack and returns it. The specific behavior depends on the type of the
// error at the top of the stack:
//   1) If the error is actually a panic, this will continue the panic.
//   2) If the error on the top of the stack is actually an error, just returns it.
//   3) Otherwise, interprets the error as the appropriate lua error.
// Uses 2 stack spaces, does not call checkstack.
pub(crate) unsafe fn pop_error(state: *mut ffi::lua_State, err_code: c_int) -> Error {
    mlua_debug_assert!(
        err_code != ffi::LUA_OK && err_code != ffi::LUA_YIELD,
        "pop_error called with non-error return code"
    );

    match get_internal_userdata::<WrappedFailure>(state, -1, ptr::null()).as_mut() {
        Some(WrappedFailure::Error(err)) => {
            ffi::lua_pop(state, 1);
            err.clone()
        }
        Some(WrappedFailure::Panic(panic)) => {
            if let Some(p) = panic.take() {
                resume_unwind(p);
            } else {
                Error::PreviouslyResumedPanic
            }
        }
        _ => {
            let err_string = to_string(state, -1);
            ffi::lua_pop(state, 1);

            match err_code {
                ffi::LUA_ERRRUN => Error::RuntimeError(err_string),
                ffi::LUA_ERRSYNTAX => {
                    Error::SyntaxError {
                        // This seems terrible, but as far as I can tell, this is exactly what the
                        // stock Lua REPL does.
                        incomplete_input: err_string.ends_with("<eof>") || err_string.ends_with("'<eof>'"),
                        message: err_string,
                    }
                }
                ffi::LUA_ERRERR => {
                    // This error is raised when the error handler raises an error too many times
                    // recursively, and continuing to trigger the error handler would cause a stack
                    // overflow. It is not very useful to differentiate between this and "ordinary"
                    // runtime errors, so we handle them the same way.
                    Error::RuntimeError(err_string)
                }
                ffi::LUA_ERRMEM => Error::MemoryError(err_string),
                #[cfg(any(feature = "lua53", feature = "lua52"))]
                ffi::LUA_ERRGCMM => Error::GarbageCollectorError(err_string),
                _ => mlua_panic!("unrecognized lua error code"),
            }
        }
    }
}

// Create C closures under `lua_cpcall` so an allocation failure doesn't escape
#[cfg(any(feature = "lua51", feature = "luajit"))]
unsafe fn push_protected_cfunctions(state: *mut ffi::lua_State, f: ffi::lua_CFunction) -> Result<()> {
    if !MemoryState::get(state).is_null() {
        MemoryState::relax_limit_with(state, || {
            ffi::lua_pushcfunction(state, error_traceback);
            ffi::lua_pushcfunction(state, f);
        });
        return Ok(());
    }

    static ERROR_TRACEBACK_KEY: u8 = 0;
    static FUNCTION_KEY: u8 = 0;

    unsafe extern "C-unwind" fn do_push(state: *mut ffi::lua_State) -> c_int {
        let f = ffi::lua_tolightuserdata(state, -1) as *const ffi::lua_CFunction;
        ffi::lua_pop(state, 1);

        ffi::lua_pushcfunction(state, error_traceback);
        ffi::lua_rawsetp(
            state,
            ffi::LUA_REGISTRYINDEX,
            &ERROR_TRACEBACK_KEY as *const u8 as *const c_void,
        );
        ffi::lua_pushcfunction(state, *f);
        ffi::lua_rawsetp(
            state,
            ffi::LUA_REGISTRYINDEX,
            &FUNCTION_KEY as *const u8 as *const c_void,
        );
        0
    }

    let ret = ffi::lua_cpcall(state, do_push, &f as *const ffi::lua_CFunction as *mut c_void);
    if ret != ffi::LUA_OK {
        return Err(pop_error(state, ret));
    }

    ffi::lua_rawgetp(
        state,
        ffi::LUA_REGISTRYINDEX,
        &ERROR_TRACEBACK_KEY as *const u8 as *const c_void,
    );
    ffi::lua_rawgetp(
        state,
        ffi::LUA_REGISTRYINDEX,
        &FUNCTION_KEY as *const u8 as *const c_void,
    );
    Ok(())
}

#[cfg(not(any(feature = "lua51", feature = "luajit")))]
#[inline]
unsafe fn push_protected_cfunctions(state: *mut ffi::lua_State, f: ffi::lua_CFunction) -> Result<()> {
    MemoryState::relax_limit_with(state, || {
        ffi::lua_pushcfunction(state, error_traceback);
        ffi::lua_pushcfunction(state, f);
    });
    Ok(())
}

// Call a function that calls into the Lua API and may trigger a Lua error (longjmp) in a safe way.
// Wraps the inner function in a call to `lua_pcall`, so the inner function only has access to a
// limited lua stack. `nargs` is the same as the the parameter to `lua_pcall`, and `nresults` is
// always `LUA_MULTRET`. Provided function must *not* panic, and since it will generally be
// longjmping, should not contain any values that implements Drop.
// Internally uses 2 extra stack spaces, and does not call checkstack.
pub(crate) unsafe fn protect_lua_call(
    state: *mut ffi::lua_State,
    nargs: c_int,
    f: unsafe extern "C-unwind" fn(*mut ffi::lua_State) -> c_int,
) -> Result<()> {
    let stack_start = ffi::lua_gettop(state) - nargs;

    push_protected_cfunctions(state, f)?;
    if nargs > 0 {
        ffi::lua_rotate(state, stack_start + 1, 2);
    }

    let ret = ffi::lua_pcall(state, nargs, ffi::LUA_MULTRET, stack_start + 1);
    ffi::lua_remove(state, stack_start + 1);

    if ret == ffi::LUA_OK {
        Ok(())
    } else {
        Err(pop_error(state, ret))
    }
}

// Call a function that calls into the Lua API and may trigger a Lua error (longjmp) in a safe way.
// Wraps the inner function in a call to `lua_pcall`, so the inner function only has access to a
// limited lua stack. `nargs` and `nresults` are similar to the parameters of `lua_pcall`, but the
// given function return type is not the return value count, instead the inner function return
// values are assumed to match the `nresults` param. Provided function must *not* panic, and since
// it will generally be longjmping, should not contain any values that implements Drop.
// Internally uses 3 ext
```

### Core Architecture Module: `src/util/mod.rs`
```
use std::borrow::Cow;
use std::ffi::CStr;
use std::os::raw::{c_char, c_int, c_void};
use std::{ptr, slice, str};

use crate::error::{Error, Result};

pub(crate) use error::{
    WrappedFailure, error_traceback, error_traceback_thread, init_error_registry, pop_error,
    protect_lua_call, protect_lua_closure,
};
pub(crate) use path::parse_path as parse_lookup_path;
pub(crate) use short_names::short_type_name;
pub(crate) use types::TypeKey;
pub(crate) use userdata::{
    DESTRUCTED_USERDATA_METATABLE, get_destructed_userdata_metatable, get_internal_metatable,
    get_internal_userdata, get_userdata, init_internal_metatable, push_internal_userdata,
    push_uninit_userdata, push_userdata, take_userdata,
};

// Checks that Lua has enough free stack space for future stack operations. On failure, this will
// panic with an internal error message.
#[inline]
pub(crate) unsafe fn assert_stack(state: *mut ffi::lua_State, amount: c_int) {
    // TODO: This should only be triggered when there is a logic error in `mlua`. In the future,
    // when there is a way to be confident about stack safety and test it, this could be enabled
    // only when `cfg!(debug_assertions)` is true.
    mlua_assert!(ffi::lua_checkstack(state, amount) != 0, "out of stack space");
}

// Checks that Lua has enough free stack space and returns `Error::StackError` on failure.
#[inline]
pub(crate) unsafe fn check_stack(state: *mut ffi::lua_State, amount: c_int) -> Result<()> {
    if ffi::lua_checkstack(state, amount) == 0 {
        Err(Error::StackError)
    } else {
        Ok(())
    }
}

pub(crate) struct StackGuard {
    state: *mut ffi::lua_State,
    top: c_int,
}

impl StackGuard {
    // Creates a StackGuard instance with record of the stack size, and on Drop will check the
    // stack size and drop any extra elements. If the stack size at the end is *smaller* than at
    // the beginning, this is considered a fatal logic error and will result in a panic.
    #[inline]
    pub(crate) unsafe fn new(state: *mut ffi::lua_State) -> StackGuard {
        StackGuard {
            state,
            top: ffi::lua_gettop(state),
        }
    }

    // Same as `new()`, but allows specifying the expected stack size at the end of the scope.
    #[inline]
    pub(crate) fn with_top(state: *mut ffi::lua_State, top: c_int) -> StackGuard {
        StackGuard { state, top }
    }

    #[inline]
    pub(crate) fn keep(&mut self, n: c_int) {
        self.top += n;
    }
}

impl Drop for StackGuard {
    #[track_caller]
    fn drop(&mut self) {
        unsafe {
            let top = ffi::lua_gettop(self.state);
            if top < self.top {
                mlua_panic!("{} too many stack values popped", self.top - top)
            }
            if top > self.top {
                ffi::lua_settop(self.state, self.top);
            }
        }
    }
}

// Uses 3 (or 1 if unprotected) stack spaces, does not call checkstack.
#[inline(always)]
pub(crate) unsafe fn push_string(state: *mut ffi::lua_State, s: &[u8], protect: bool) -> Result<()> {
    // Always use protected mode if the string is too long
    let protect = protect || s.len() >= const { 1 << 30 };
    protect_lua_mem!(state, if protect, 0, 1, |state| {
        ffi::lua_pushlstring(state, s.as_ptr() as *const c_char, s.len());
    })
}

// Uses 3 (or 1 if unprotected) stack spaces, does not call checkstack.
#[cfg(feature = "lua55")]
pub(crate) unsafe fn push_external_string(
    state: *mut ffi::lua_State,
    mut bytes: Vec<u8>,
    protect: bool,
) -> Result<()> {
    bytes.push(0);
    let s_len = bytes.len() - 1; // exclude null terminator
    let s_ptr = bytes.as_ptr() as *const c_char;
    let bytes_ud = Box::into_raw(Box::new(bytes));

    unsafe extern "C" fn dealloc(ud: *mut c_void, _: *mut c_void, _: usize, _: usize) -> *mut c_void {
        drop(Box::from_raw(ud as *mut Vec<u8>));
        ptr::null_mut()
    }

    // Lua frees the external string on error.
    protect_lua_mem!(state, if protect, 0, 1, move |state| {
        ffi::lua_pushexternalstring(state, s_ptr, s_len, Some(dealloc), bytes_ud as *mut _);
    })
}

// Uses 3 stack spaces (when protect), does not call checkstack.
#[cfg(feature = "luau")]
#[inline(always)]
pub(crate) unsafe fn push_buffer(state: *mut ffi::lua_State, size: usize, protect: bool) -> Result<*mut u8> {
    let protect = protect || size > const { 1024 * 1024 * 1024 };
    protect_lua_mem!(state, if protect, 0, 1, |state| {
        ffi::lua_newbuffer(state, size) as *mut u8
    })
}

// Uses 3 stack spaces, does not call checkstack.
#[inline]
pub(crate) unsafe fn push_table(
    state: *mut ffi::lua_State,
    narr: usize,
    nrec: usize,
    protect: bool,
) -> Result<()> {
    let narr: c_int = narr.try_into().unwrap_or(c_int::MAX);
    let nrec: c_int = nrec.try_into().unwrap_or(c_int::MAX);
    let protect = protect || narr >= const { 1 << 26 } || nrec >= const { 1 << 26 };
    protect_lua_mem!(state, if protect, 0, 1, |state| ffi::lua_createtable(state, narr, nrec))
}

// Uses 4 stack spaces, does not call checkstack.
pub(crate) unsafe fn rawget_field(state: *mut ffi::lua_State, table: c_int, field: &str) -> Result<c_int> {
    ffi::lua_pushvalue(state, table);
    protect_lua!(state, 1, 1, |state| {
        ffi::lua_pushlstring(state, field.as_ptr() as *const c_char, field.len());
        ffi::lua_rawget(state, -2)
    })
}

// Uses 4 stack spaces, does not call checkstack.
pub(crate) unsafe fn rawset_field(state: *mut ffi::lua_State, table: c_int, field: &str) -> Result<()> {
    ffi::lua_pushvalue(state, table);
    protect_lua!(state, 2, 0, |state| {
        ffi::lua_pushlstring(state, field.as_ptr() as *const c_char, field.len());
        ffi::lua_rotate(state, -3, 2);
        ffi::lua_rawset(state, -3);
    })
}

// A variant of `pcall` that does not allow Lua to catch Rust panics from `callback_error`.
pub(crate) unsafe extern "C-unwind" fn safe_pcall(state: *mut ffi::lua_State) -> c_int {
    ffi::luaL_checkstack(state, 2, ptr::null());

    let top = ffi::lua_gettop(state);
    if top == 0 {
        ffi::lua_pushstring(state, cstr!("not enough arguments to pcall"));
        ffi::lua_error(state);
    }

    if ffi::lua_pcall(state, top - 1, ffi::LUA_MULTRET, 0) == ffi::LUA_OK {
        ffi::lua_pushboolean(state, 1);
        ffi::lua_insert(state, 1);
        ffi::lua_gettop(state)
    } else {
        let wf_ud = get_internal_userdata::<WrappedFailure>(state, -1, ptr::null());
        if let Some(WrappedFailure::Panic(_)) = wf_ud.as_ref() {
            ffi::lua_error(state);
        }
        ffi::lua_pushboolean(state, 0);
        ffi::lua_insert(state, -2);
        2
    }
}

// A variant of `xpcall` that does not allow Lua to catch Rust panics from `callback_error`.
pub(crate) unsafe extern "C-unwind" fn safe_xpcall(state: *mut ffi::lua_State) -> c_int {
    unsafe extern "C-unwind" fn xpcall_msgh(state: *mut ffi::lua_State) -> c_int {
        ffi::luaL_checkstack(state, 2, ptr::null());

        let wf_ud = get_internal_userdata::<WrappedFailure>(state, -1, ptr::null());
        if let Some(WrappedFailure::Panic(_)) = wf_ud.as_ref() {
            1
        } else {
            ffi::lua_pushvalue(state, ffi::lua_upvalueindex(1));
            ffi::lua_insert(state, 1);
            ffi::lua_call(state, ffi::lua_gettop(state) - 1, ffi::LUA_MULTRET);
            ffi::lua_gettop(state)
        }
    }

    ffi::luaL_checkstack(state, 2, ptr::null());

    let top = ffi::lua_gettop(state);
    if top < 2 {
        ffi::lua_pushstring(state, cstr!("not enough arguments to xpcall"));
        ffi::lua_error(state);
    }

    ffi::lua_pushvalue(state, 2);
    ffi::lua_pushcclosure(state, xpcall_msgh, 1);
    ffi::lua_copy(state, 1, 2);
    ffi::lua_replace(state, 1);

    if ffi::lua_pcall(state, ffi::lua_gettop(state) - 2, ffi::LUA_MULTRET, 1) == ffi::LUA_OK {
        ffi::lua_pushboolean(state, 1);
        ffi::lua_insert(state, 2);
        ffi::lua_gettop(state) - 1
    } else {
        let wf_ud = get_internal_userdata::<WrappedFailure>(state, -1, ptr::null());
        if let Some(WrappedFailure::Panic(_)) = wf_ud.as_ref() {
            ffi::lua_error(state);
        }
        ffi::lua_pushboolean(state, 0);
        ffi::lua_insert(state, -2);
        2
    }
}

// Returns Lua main thread for Lua >= 5.2 or checks that the passed thread is main for Lua 5.1.
// Does not call lua_checkstack, uses 1 stack space.
pub(crate) unsafe fn get_main_state(state: *mut ffi::lua_State) -> Option<*mut ffi::lua_State> {
    #[cfg(any(feature = "lua55", feature = "lua54", feature = "lua53", feature = "lua52"))]
    {
        ffi::lua_rawgeti(state, ffi::LUA_REGISTRYINDEX, ffi::LUA_RIDX_MAINTHREAD);
        let main_state = ffi::lua_tothread(state, -1);
        ffi::lua_pop(state, 1);
        Some(main_state)
    }
    #[cfg(any(feature = "lua51", feature = "luajit"))]
    {
        // Check the current state first
        let is_main_state = ffi::lua_pushthread(state) == 1;
        ffi::lua_pop(state, 1);
        if is_main_state { Some(state) } else { None }
    }
    #[cfg(feature = "luau")]
    Some(ffi::lua_mainthread(state))
}

// Converts the given lua value to a string in a reasonable format without causing a Lua error or
// panicking.
pub(crate) unsafe fn to_string(state: *mut ffi::lua_State, index: c_int) -> String {
    match ffi::lua_type(state, index) {
        ffi::LUA_TNONE => "<none>".to_string(),
        ffi::LUA_TNIL => "<nil>".to_string(),
        ffi::LUA_TBOOLEAN => (ffi::lua_toboolean(state, index) != 1).to_string(),
        ffi::LUA_TLIGHTUSERDATA => {
            format!("<lightuserdata {:?}>", ffi::lua_topointer(state, index))
        }
        ffi::LUA_TNUMBER => {
            let mut isint = 0;
            let i = ffi::lua_tointegerx(state, index, &mut isint);
            if isint == 0 {
                ffi::lua_tonumber(state, index).to_string()
            } else {
                i.to_string()
            }
        }
        #[cfg(feat
```

### Core Architecture Module: `src/util/path.rs`
```
use std::borrow::Cow;
use std::fmt;
use std::iter::Peekable;
use std::str::CharIndices;

use crate::error::{Error, Result};
use crate::state::Lua;
use crate::traits::IntoLua;
use crate::types::Integer;
use crate::value::Value;

#[derive(Debug)]
pub(crate) enum PathKey<'a> {
    Str(Cow<'a, str>),
    Int(Integer),
}

impl fmt::Display for PathKey<'_> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            PathKey::Str(s) => write!(f, "{}", s),
            PathKey::Int(i) => write!(f, "{}", i),
        }
    }
}

impl IntoLua for PathKey<'_> {
    fn into_lua(self, lua: &Lua) -> Result<Value> {
        match self {
            PathKey::Str(s) => Ok(Value::String(lua.create_string(s.as_ref())?)),
            PathKey::Int(i) => Ok(Value::Integer(i)),
        }
    }
}

// Parses a path like `a.b[3]?.c["d"]` into segments of `(key, safe_nil)`.
pub(crate) fn parse_path<'a>(path: &'a str) -> Result<Vec<(PathKey<'a>, bool)>> {
    fn read_ident<'a>(path: &'a str, chars: &mut Peekable<CharIndices<'a>>) -> (Cow<'a, str>, bool) {
        let mut safe_nil = false;
        let start = chars.peek().map(|&(i, _)| i).unwrap_or(path.len());
        let mut end = start;
        while let Some(&(pos, c)) = chars.peek() {
            if c == '.' || c == '?' || c.is_ascii_whitespace() || c == '[' {
                if c == '?' {
                    safe_nil = true;
                    chars.next(); // consume '?'
                }
                break;
            }
            end = pos + c.len_utf8();
            chars.next();
        }
        (Cow::Borrowed(&path[start..end]), safe_nil)
    }

    let mut segments = Vec::new();
    let mut chars = path.char_indices().peekable();
    while let Some(&(pos, next)) = chars.peek() {
        match next {
            '.' => {
                // Dot notation: identifier
                chars.next();
                let (key, safe_nil) = read_ident(path, &mut chars);
                if key.is_empty() {
                    return Err(Error::runtime(format!("empty key in path at position {pos}")));
                }
                segments.push((PathKey::Str(key), safe_nil));
            }
            '[' => {
                // Bracket notation: either integer or quoted string
                chars.next();
                let key = match chars.peek() {
                    Some(&(pos, c @ '0'..='9' | c @ '-')) => {
                        // Integer key
                        let negative = c == '-';
                        if negative {
                            chars.next(); // consume '-'
                        }
                        let mut num: Option<Integer> = None;
                        while let Some(&(_, c @ '0'..='9')) = chars.peek() {
                            let new_num = num
                                .unwrap_or(0)
                                .checked_mul(10)
                                .and_then(|n| n.checked_add((c as u8 - b'0') as Integer))
                                .ok_or_else(|| {
                                    Error::runtime(format!("integer overflow in path at position {pos}"))
                                })?;
                            num = Some(new_num);
                            chars.next(); // consume digit
                        }
                        match num {
                            Some(n) if negative => PathKey::Int(-n),
                            Some(n) => PathKey::Int(n),
                            None => {
                                let err = format!("invalid integer in path at position {pos}");
                                return Err(Error::runtime(err));
                            }
                        }
                    }
                    Some((_, '\'' | '"')) => {
                        // Quoted string
                        PathKey::Str(unquote_string(path, &mut chars)?)
                    }
                    Some((_, ']')) => {
                        return Err(Error::runtime(format!("empty key in path at position {pos}")));
                    }
                    Some((pos, c)) => {
                        let err = format!("unexpected character '{c}' in path at position {pos}");
                        return Err(Error::runtime(err));
                    }
                    None => {
                        return Err(Error::runtime("unexpected end of path"));
                    }
                };
                // Expect closing bracket
                let mut safe_nil = false;
                match chars.next() {
                    Some((_, ']')) => {
                        // Check for optional safe-nil operator
                        if let Some(&(_, '?')) = chars.peek() {
                            safe_nil = true;
                            chars.next(); // consume '?'
                        }
                    }
                    Some((pos, c)) => {
                        let err = format!("expected ']' in path at position {pos}, found '{c}'");
                        return Err(Error::runtime(err));
                    }
                    None => {
                        return Err(Error::runtime("unexpected end of path"));
                    }
                }
                segments.push((key, safe_nil));
            }
            c if c.is_ascii_whitespace() => {
                chars.next(); // Skip whitespace
            }
            _ if segments.is_empty() => {
                // First segment without dot/bracket notation
                let (key_cow, safe_nil) = read_ident(path, &mut chars);
                if key_cow.is_empty() {
                    return Err(Error::runtime(format!("empty key in path at position {pos}")));
                }
                segments.push((PathKey::Str(key_cow), safe_nil));
            }
            c => {
                let err = format!("unexpected character '{c}' in path at position {pos}");
                return Err(Error::runtime(err));
            }
        }
    }
    Ok(segments)
}

fn unquote_string<'a>(path: &'a str, chars: &mut Peekable<CharIndices<'a>>) -> Result<Cow<'a, str>> {
    let (start_pos, first_quote) = chars.next().unwrap();
    let mut result = String::new();
    loop {
        match chars.next() {
            Some((pos, '\\')) => {
                if result.is_empty() {
                    // First escape found, copy everything up to this point
                    result.push_str(&path[start_pos + 1..pos]);
                }
                match chars.next() {
                    Some((_, '\\')) => result.push('\\'),
                    Some((_, '"')) => result.push('"'),
                    Some((_, '\'')) => result.push('\''),
                    Some((_, other)) => {
                        result.push('\\');
                        result.push(other);
                    }
                    None => continue, // will be handled by outer loop
                }
            }
            Some((pos, c)) if c == first_quote => {
                if !result.is_empty() {
                    return Ok(Cow::Owned(result));
                }
                // No escapes, return borrowed slice
                return Ok(Cow::Borrowed(&path[start_pos + 1..pos]));
            }
            Some((_, c)) => {
                if !result.is_empty() {
                    result.push(c);
                }
                // If no escapes yet, continue tracking for potential borrowed slice
            }
            None => {
                let err = format!("unexpected end of string at position {start_pos}");
                return Err(Error::runtime(err));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{PathKey, parse_path};

    #[test]
    fn test_parse_path() {
        // Test valid paths
        let path = parse_path("a.b[3]?.c['d']").unwrap();
        assert_eq!(path.len(), 5);
        assert!(matches!(path[0], (PathKey::Str(ref s), false) if s == "a"));
        assert!(matches!(path[1], (PathKey::Str(ref s), false) if s == "b"));
        assert!(matches!(path[2], (PathKey::Int(3), true)));
        assert!(matches!(path[3], (PathKey::Str(ref s), false) if s == "c"));
        assert!(matches!(path[4], (PathKey::Str(ref s), false) if s == "d"));

        // Test empty path
        let path = parse_path("").unwrap();
        assert_eq!(path.len(), 0);
        let path = parse_path("   ").unwrap();
        assert_eq!(path.len(), 0);

        // Test invalid dot syntax
        let err = parse_path("a..b").unwrap_err().to_string();
        assert_eq!(err, "runtime error: empty key in path at position 1");
        let err = parse_path("a.b.").unwrap_err().to_string();
        assert_eq!(err, "runtime error: empty key in path at position 3");

        // Test invalid bracket syntax
        let err = parse_path("a[unclosed").unwrap_err().to_string();
        assert_eq!(
            err,
            "runtime error: unexpected character 'u' in path at position 2"
        );
        let err = parse_path("a[]").unwrap_err().to_string();
        assert_eq!(err, "runtime error: empty key in path at position 1");
        let err = parse_path(r#"a["unclosed"#).unwrap_err().to_string();
        assert_eq!(err, "runtime error: unexpected end of string at position 2");
        let err = parse_path(r#"a["#).unwrap_err().to_string();
        assert_eq!(err, "runtime error: unexpected end of path");
        let err = parse_path(r#"a[123"#).unwrap_err().to_string();
        assert_eq!(err, "runtime error: unexpected end of path");
        let err = parse_path(r#"a['bla'123"#).unwrap_err().to_string();
        assert_eq!(
            err,
            "runtime error: expected ']' in path at position 7, found '1'"
        );
        let err = parse_path(r#"a["bla"]x"#).unwrap_err().to_string();
        assert_eq!(
            err,
            "runtime error: unexpected character 'x' in path at position 8"
        );

        // Tes
```

### Core Architecture Module: `src/util/short_names.rs`
```
//! Inspired by bevy's [disqualified]
//!
//! [disqualified]: https://github.com/bevyengine/disqualified/blob/main/src/short_name.rs

use std::any::type_name;

/// Returns a short version of a type name `T` without all module paths.
///
/// The short name of a type is its full name as returned by
/// [`std::any::type_name`], but with the prefix of all paths removed. For
/// example, the short name of `alloc::vec::Vec<core::option::Option<u32>>`
/// would be `Vec<Option<u32>>`.
pub(crate) fn short_type_name<T: ?Sized>() -> String {
    let full_name = type_name::<T>();

    // Generics result in nested paths within <..> blocks.
    // Consider "core::option::Option<alloc::string::String>".
    // To tackle this, we parse the string from left to right, collapsing as we go.
    let mut index: usize = 0;
    let end_of_string = full_name.len();
    let mut parsed_name = String::new();

    while index < end_of_string {
        let rest_of_string = full_name.get(index..end_of_string).unwrap_or_default();

        // Collapse everything up to the next special character, then skip over it
        if let Some(special_character_index) =
            rest_of_string.find(|c: char| [' ', '<', '>', '(', ')', '[', ']', ',', ';'].contains(&c))
        {
            let segment_to_collapse = rest_of_string.get(0..special_character_index).unwrap_or_default();
            parsed_name += collapse_type_name(segment_to_collapse);
            // Insert the special character
            let special_character = &rest_of_string[special_character_index..=special_character_index];
            parsed_name += special_character;

            // Remove lifetimes like <'_> or <'_, '_, ...>
            if parsed_name.ends_with("<'_>") || parsed_name.ends_with("<'_, ") {
                _ = parsed_name.split_off(parsed_name.len() - 4);
            }

            match special_character {
                ">" | ")" | "]" if rest_of_string[special_character_index + 1..].starts_with("::") => {
                    parsed_name += "::";
                    // Move the index past the "::"
                    index += special_character_index + 3;
                }
                // Move the index just past the special character
                _ => index += special_character_index + 1,
            }
        } else {
            // If there are no special characters left, we're done!
            parsed_name += collapse_type_name(rest_of_string);
            index = end_of_string;
        }
    }
    parsed_name
}

#[inline(always)]
fn collapse_type_name(segment: &str) -> &str {
    segment.rsplit("::").next().unwrap()
}

#[cfg(test)]
mod tests {
    use super::short_type_name;
    use std::collections::HashMap;
    use std::marker::PhantomData;

    struct MyData<'a, 'b>(PhantomData<&'a &'b ()>);
    struct MyDataT<'a, T>(PhantomData<&'a T>);

    #[test]
    fn tests() {
        assert_eq!(short_type_name::<String>(), "String");
        assert_eq!(short_type_name::<Option<String>>(), "Option<String>");
        assert_eq!(short_type_name::<(String, &str)>(), "(String, &str)");
        assert_eq!(short_type_name::<[i32; 3]>(), "[i32; 3]");
        assert_eq!(
            short_type_name::<HashMap<String, Option<[i32; 3]>>>(),
            "HashMap<String, Option<[i32; 3]>>"
        );
        assert_eq!(short_type_name::<dyn Fn(i32) -> i32>(), "dyn Fn(i32) -> i32");
        assert_eq!(short_type_name::<MyDataT<&str>>(), "MyDataT<&str>");
        assert_eq!(short_type_name::<(&MyData, [MyData])>(), "(MyData, [MyData])");
    }
}

```

### Core Architecture Module: `src/util/types.rs`
```
use std::any::Any;
use std::os::raw::c_void;

use crate::types::{Callback, CallbackUpvalue};

#[cfg(feature = "async")]
use crate::types::{AsyncCallback, AsyncCallbackUpvalue, AsyncPollUpvalue};

pub(crate) trait TypeKey: Any {
    fn type_key() -> *const c_void;
}

impl TypeKey for Callback {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static CALLBACK_TYPE_KEY: u8 = 0;
        &CALLBACK_TYPE_KEY as *const u8 as *const c_void
    }
}

impl TypeKey for CallbackUpvalue {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static CALLBACK_UPVALUE_TYPE_KEY: u8 = 0;
        &CALLBACK_UPVALUE_TYPE_KEY as *const u8 as *const c_void
    }
}

#[cfg(not(feature = "luau"))]
impl TypeKey for crate::types::HookCallback {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static HOOK_CALLBACK_TYPE_KEY: u8 = 0;
        &HOOK_CALLBACK_TYPE_KEY as *const u8 as *const c_void
    }
}

#[cfg(feature = "async")]
impl TypeKey for AsyncCallback {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static ASYNC_CALLBACK_TYPE_KEY: u8 = 0;
        &ASYNC_CALLBACK_TYPE_KEY as *const u8 as *const c_void
    }
}

#[cfg(feature = "async")]
impl TypeKey for AsyncCallbackUpvalue {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static ASYNC_CALLBACK_UPVALUE_TYPE_KEY: u8 = 0;
        &ASYNC_CALLBACK_UPVALUE_TYPE_KEY as *const u8 as *const c_void
    }
}

#[cfg(feature = "async")]
impl TypeKey for AsyncPollUpvalue {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static ASYNC_POLL_UPVALUE_TYPE_KEY: u8 = 0;
        &ASYNC_POLL_UPVALUE_TYPE_KEY as *const u8 as *const c_void
    }
}

#[cfg(feature = "async")]
impl TypeKey for Option<std::task::Waker> {
    #[inline(always)]
    fn type_key() -> *const c_void {
        static WAKER_TYPE_KEY: u8 = 0;
        &WAKER_TYPE_KEY as *const u8 as *const c_void
    }
}

```

### Core Architecture Module: `src/util/userdata.rs`
```
use std::os::raw::{c_int, c_void};
use std::{mem, ptr};

use crate::error::Result;
use crate::userdata::collect_userdata;
use crate::util::{TypeKey, check_stack, get_metatable_ptr, push_table, rawset_field};

// Pushes the userdata and attaches a metatable with __gc method.
// Internally uses 3 stack spaces, does not call checkstack.
pub(crate) unsafe fn push_internal_userdata<T: TypeKey>(
    state: *mut ffi::lua_State,
    t: T,
    protect: bool,
) -> Result<*mut T> {
    let ud_ptr = push_userdata(state, t, protect)?;
    get_internal_metatable::<T>(state);
    ffi::lua_setmetatable(state, -2);
    Ok(ud_ptr)
}

#[track_caller]
pub(crate) unsafe fn get_internal_metatable<T: TypeKey>(state: *mut ffi::lua_State) {
    ffi::lua_rawgetp(state, ffi::LUA_REGISTRYINDEX, T::type_key());
    debug_assert!(ffi::lua_isnil(state, -1) == 0, "internal metatable not found");
}

// Initialize the internal metatable for a type T (with __gc method).
// Uses 6 stack spaces and calls checkstack.
pub(crate) unsafe fn init_internal_metatable<T: TypeKey>(
    state: *mut ffi::lua_State,
    customize_fn: Option<fn(*mut ffi::lua_State)>,
) -> Result<()> {
    check_stack(state, 6)?;

    push_table(state, 0, 3, true)?;

    #[cfg(not(feature = "luau"))]
    {
        ffi::lua_pushcfunction(state, collect_userdata::<T>);
        rawset_field(state, -2, "__gc")?;
    }

    ffi::lua_pushboolean(state, 0);
    rawset_field(state, -2, "__metatable")?;

    protect_lua!(state, 1, 0, |state| {
        if let Some(f) = customize_fn {
            f(state);
        }

        ffi::lua_rawsetp(state, ffi::LUA_REGISTRYINDEX, T::type_key());
    })?;

    Ok(())
}

// Uses up to 1 stack space, does not call `checkstack`
pub(crate) unsafe fn get_internal_userdata<T: TypeKey>(
    state: *mut ffi::lua_State,
    index: c_int,
    mut type_mt_ptr: *const c_void,
) -> *mut T {
    let ud = ffi::lua_touserdata(state, index) as *mut T;
    if ud.is_null() {
        return ptr::null_mut();
    }
    let mt_ptr = get_metatable_ptr(state, index);
    if type_mt_ptr.is_null() {
        get_internal_metatable::<T>(state);
        type_mt_ptr = ffi::lua_topointer(state, -1);
        ffi::lua_pop(state, 1);
    }
    if mt_ptr != type_mt_ptr {
        return ptr::null_mut();
    }
    ud
}

// Internally uses 3 stack spaces, does not call checkstack.
#[inline]
pub(crate) unsafe fn push_uninit_userdata<T>(state: *mut ffi::lua_State, protect: bool) -> Result<*mut T> {
    protect_lua_mem!(state, if protect, 0, 1, |state| {
        ffi::lua_newuserdata(state, const { mem::size_of::<T>() }) as *mut T
    })
}

// Internally uses 3 stack spaces, does not call checkstack.
#[inline]
pub(crate) unsafe fn push_userdata<T>(state: *mut ffi::lua_State, t: T, protect: bool) -> Result<*mut T> {
    let size = const { mem::size_of::<T>() };

    #[cfg(not(feature = "luau"))]
    let ud_ptr =
        protect_lua_mem!(state, if protect, 0, 1, |state| ffi::lua_newuserdata(state, size))? as *mut T;

    #[cfg(feature = "luau")]
    let ud_ptr = protect_lua_mem!(state, if protect, 0, 1, |state| {
        ffi::lua_newuserdatadtor(state, size, collect_userdata::<T>)
    })? as *mut T;

    ptr::write(ud_ptr, t);
    Ok(ud_ptr)
}

#[inline]
#[track_caller]
pub(crate) unsafe fn get_userdata<T>(state: *mut ffi::lua_State, index: c_int) -> *mut T {
    let ud = ffi::lua_touserdata(state, index) as *mut T;
    mlua_debug_assert!(!ud.is_null(), "userdata pointer is null");
    ud
}

/// Unwraps `T` from the Lua userdata and invalidating it by setting the special "destructed"
/// metatable.
///
/// This method does not check that userdata is of type `T` and was not previously invalidated.
///
/// Uses 1 extra stack space, does not call checkstack.
pub(crate) unsafe fn take_userdata<T>(state: *mut ffi::lua_State, idx: c_int) -> T {
    #[rustfmt::skip]
    let idx = if idx < 0 { ffi::lua_absindex(state, idx) } else { idx };

    // Update the metatable of this userdata to a special one with no `__gc` method and with
    // metamethods that trigger an error on access.
    // We do this so that it will not be double dropped or used after being dropped.
    get_destructed_userdata_metatable(state);
    ffi::lua_setmetatable(state, idx);
    let ud = get_userdata::<T>(state, idx);

    // Update userdata tag to disable destructor and mark as destructed
    #[cfg(feature = "luau")]
    ffi::lua_setuserdatatag(state, idx, 1);

    ptr::read(ud)
}

pub(crate) unsafe fn get_destructed_userdata_metatable(state: *mut ffi::lua_State) {
    let key = &DESTRUCTED_USERDATA_METATABLE as *const u8 as *const c_void;
    ffi::lua_rawgetp(state, ffi::LUA_REGISTRYINDEX, key);
}

pub(crate) static DESTRUCTED_USERDATA_METATABLE: u8 = 0;

```

### Core Architecture Module: `benches/benchmark.rs`
```
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use criterion::{BatchSize, Criterion, criterion_group, criterion_main};
use tokio::runtime::Runtime;
use tokio::task;

use mlua::prelude::*;

fn collect_gc_twice(lua: &Lua) {
    lua.gc_collect().unwrap();
    lua.gc_collect().unwrap();
}

fn table_create_empty(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create empty]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_table().unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_create_array(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create array]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_sequence_from(1..=10).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_create_hash(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create hash]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_table_from(
                    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
                        .into_iter()
                        .map(|s| (s, s)),
                )
                .unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_get_set(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [get and set]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                lua.create_table().unwrap()
            },
            |table| {
                for (i, s) in ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
                    .into_iter()
                    .enumerate()
                {
                    table.raw_set(s, i).unwrap();
                    assert_eq!(table.raw_get::<usize>(s).unwrap(), i);
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_pairs(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [traversal pairs]", |b| {
        b.iter_batched(
            || lua.globals(),
            |globals| {
                for kv in globals.pairs::<String, LuaValue>() {
                    let (_k, _v) = kv.unwrap();
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_for_each(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [traversal for_each]", |b| {
        b.iter_batched(
            || lua.globals(),
            |globals| globals.for_each::<String, LuaValue>(|_k, _v| Ok(())),
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_sequence(c: &mut Criterion) {
    let lua = Lua::new();

    let table = lua.create_sequence_from(1..1000).unwrap();

    c.bench_function("table [traversal sequence]", |b| {
        b.iter_batched(
            || table.clone(),
            |table| {
                for v in table.sequence_values::<i32>() {
                    let _i = v.unwrap();
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_ref_clone(c: &mut Criterion) {
    let lua = Lua::new();

    let t = lua.create_table().unwrap();

    c.bench_function("table [ref clone]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                let _t2 = t.clone();
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_create(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("function [create Rust]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_function(|_, ()| Ok(123)).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_sum(c: &mut Criterion) {
    let lua = Lua::new();

    let sum = lua
        .create_function(|_, (a, b, c): (i64, i64, i64)| Ok(a + b - c))
        .unwrap();

    c.bench_function("function [call Rust sum]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(sum.call::<i64>((10, 20, 30)).unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_lua_sum(c: &mut Criterion) {
    let lua = Lua::new();

    let sum = lua
        .load("function(a, b, c) return a + b - c end")
        .eval::<LuaFunction>()
        .unwrap();

    c.bench_function("function [call Lua sum]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(sum.call::<i64>((10, 20, 30)).unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_concat(c: &mut Criterion) {
    let lua = Lua::new();

    let concat = lua
        .create_function(|_, (a, b): (LuaString, LuaString)| Ok(format!("{}{}", a.to_str()?, b.to_str()?)))
        .unwrap();
    let i = AtomicUsize::new(0);

    c.bench_function("function [call Rust concat string]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                i.fetch_add(1, Ordering::Relaxed)
            },
            |i| {
                assert_eq!(concat.call::<LuaString>(("num:", i)).unwrap(), format!("num:{i}"));
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_lua_concat(c: &mut Criterion) {
    let lua = Lua::new();

    let concat = lua
        .load("function(a, b) return a..b end")
        .eval::<LuaFunction>()
        .unwrap();
    let i = AtomicUsize::new(0);

    c.bench_function("function [call Lua concat string]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                i.fetch_add(1, Ordering::Relaxed)
            },
            |i| {
                assert_eq!(concat.call::<LuaString>(("num:", i)).unwrap(), format!("num:{i}"));
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_async_call_sum(c: &mut Criterion) {
    let options = LuaOptions::new().thread_pool_size(1024);
    let lua = Lua::new_with(LuaStdLib::ALL_SAFE, options).unwrap();

    let sum = lua
        .create_async_function(|_, (a, b, c): (i64, i64, i64)| async move {
            task::yield_now().await;
            Ok(a + b - c)
        })
        .unwrap();

    c.bench_function("function [async call Rust sum]", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(rt).iter_batched(
            || collect_gc_twice(&lua),
            |_| async {
                assert_eq!(sum.call_async::<i64>((10, 20, 30)).await.unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn registry_value_create(c: &mut Criterion) {
    let lua = Lua::new();
    lua.gc_stop();

    c.bench_function("registry value [create]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| lua.create_registry_value("hello").unwrap(),
            BatchSize::SmallInput,
        );
    });
}

fn registry_value_get(c: &mut Criterion) {
    let lua = Lua::new();
    lua.gc_stop();

    let value = lua.create_registry_value("hello").unwrap();

    c.bench_function("registry value [get]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(lua.registry_value::<LuaString>(&value).unwrap(), "hello");
            },
            BatchSize::SmallInput,
        );
    });
}

fn userdata_create(c: &mut Criterion) {
    struct UserData(#[allow(unused)] i64);
    impl LuaUserData for UserData {}

    let lua = Lua::new();

    c.bench_function("userdata [create]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_userdata(UserData(123)).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn userdata_call_index(c: &mut Criterion) {
    struct UserData(#[allow(unused)] i64);
    impl LuaUserData for UserData {
        fn add_methods<M: LuaUserDataMethods<Self>>(methods: &mut M) {
            methods.add_meta_method(LuaMetaMethod::Index, move |_, _, key: LuaString| Ok(key));
        }
    }

    let lua = Lua::new();
    let ud = lua.create_userdata(UserData(123)).unwrap();
    let index = lua
        .load("function(ud) return ud.test end")
        .eval::<LuaFunction>()
        .unwrap();

    c.bench_function("userdata [call index]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(index.call::<LuaString>(&ud).unwrap(), "test");
            },
            BatchSize::SmallInput,
        );
    });
}

fn userdata_call_method(c: &mut Criterion) {
    struct UserData(i64);
    impl LuaUserData for UserData {
        fn add_methods<M: LuaUserDataMethods<Self>>(methods: &mut M) {
            methods.add_method("add", |_, this, i: i64| Ok(this.0 + i));
        }
    }

    let lua = Lua::new();
    let ud = lua.create_userdata(UserData(123)).unwrap();
    let method = lua
        .load("function(ud, i) return ud:add(i) end")
        .eval::<LuaFunction>()
        .unwrap();
    let i = AtomicUsize::new(0);

    c.bench_function("userdata [call method]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                i.fetch_add(1, Ordering::Relaxed)
            },
            |i| {
                assert_eq!(method.call::<usize>((&ud, i)).unwrap(), 123 + i);
            },
            BatchSize::SmallInput,
        );
    });
}

// A userdata method call that goes through an implicit `__index` function
fn userdata_call_method_complex(c: &mut Criterion) {
    struct UserData(u64);
    impl LuaUserData for UserData {
        fn register(registry: &mu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #416** (2024-06-13): **Limiting script execution time (a question and a bug report)**
  *Symptoms*: First off, thank you for creating and maintaining this wonderful crate!  I'm trying to limit the time a script executes, and what I found to be potentially the most effective way was to set a hook that will reset the thread if the execution time is too long (I would be more than happy to hear about better ways to achieve that).  While experimenting with that, I hit an internal bug that needed to be reported.  Here's hopefully the shortest repro for it:  ```toml [dependencies] mlua = { version = "0.9.8", features = ["lua54", "vendored"] } ```  ```rust use mlua::*;  fn main() {     limit_function_execution_time(); }  fn limit_function_execution_time() {     let lua = Lua::new();     let run_forever: Function = lua         .load(             r#"             function ()                 while true do                     x = 10                 end             end             "#,         )         .eval()         .unwrap();      let thread = lua.create_thread(run_forever).unwrap();     let start = std::time::SystemTime::now();      thread.set_hook(         HookTriggers::default().every_nth_instruction(100000),         move |lua, _debug| {             let do_nothing: Function = lua                 .load(                     r#"                     function ()                         print("doing nothing")                     end                 "#,                 )                 .eval()                 .unwrap();              let
  **Post-Mortem & Fix Analysis**:
  > Thank you for the bug report! It was a bug in mlua and users are not allowed to reset running coroutines (it's not supported by Lua itself).  Answering your question. To stop executing Lua script you can simply return a error from the hook and coroutine will finish immediately with the returned error. 
  > Thanks. This is working perfectly.

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

### Incident Patch 1: `4dd50552` (2026-09-27)
**Commit Message**: Fix check_stack in `TableSequence::next`

**File**: `src/table.rs` (modified, +1/-1)
```diff
@@ -1549,7 +1549,7 @@ impl<V: FromLua> Iterator for TableSequence<'_, V> {
         let state = lua.state();
         unsafe {
             let _sg = StackGuard::new(state);
-            if let Err(err) = check_stack(state, 1) {
+            if let Err(err) = check_stack(state, 2) {
                 return Some(Err(err));
             }
 
```

---

### Incident Patch 2: `90ae20e0` (2026-09-27)
**Commit Message**: Fix tests

**File**: `tests/memory.rs` (modified, +1/-4)
```diff
@@ -37,10 +37,7 @@ fn test_memory_limit() -> Result<()> {
 
     // Test memory limit during chunk loading
     lua.set_memory_limit(1024)?;
-    match lua
-        .load("local t = {}; for i = 1,10000 do t[i] = i end")
-        .into_function()
-    {
+    match lua.load(format!("return '{}'", "x".repeat(4096))).into_function() {
         Err(Error::MemoryError(_)) => {}
         _ => panic!("did not trigger memory error"),
     };
```

---

### Incident Patch 3: `d5d82352` (2026-09-27)
**Commit Message**: mlua-sys: Fix luau-codegen feature flag usage

**File**: `mlua-sys/src/luau/mod.rs` (modified, +3/-0)
```diff
@@ -4,6 +4,7 @@ pub use compat::*;
 pub use lauxlib::*;
 pub use lua::*;
 pub use luacode::*;
+#[cfg(any(feature = "luau-codegen", doc))]
 pub use luacodegen::*;
 pub use lualib::*;
 pub use luarequire::*;
@@ -12,6 +13,8 @@ pub mod compat;
 pub mod lauxlib;
 pub mod lua;
 pub mod luacode;
+#[cfg(any(feature = "luau-codegen", doc))]
+#[cfg_attr(docsrs, doc(cfg(feature = "luau-codegen")))]
 pub mod luacodegen;
 pub mod lualib;
 pub mod luarequire;
```

---

### Incident Patch 4: `d334c26d` (2026-09-27)
**Commit Message**: Move Luau require internals to upvalues from environment

**File**: `src/luau/require.rs` (modified, +45/-36)
```diff
@@ -481,51 +481,60 @@ pub(super) fn create_require_function<R: Require + MaybeSend + 'static>(
         })
     }?;
 
-    // Prepare environment for the "require" function
-    let env = lua.create_table_with_capacity(0, 7)?;
-    env.raw_set("get_cache_key", get_cache_key)?;
-    env.raw_set("find_current_file", find_current_file)?;
-    env.raw_set("proxyrequire", proxyrequire)?;
-    env.raw_set("REGISTERED_MODULES", registered_modules)?;
-    env.raw_set("LOADER_CACHE", loader_cache)?;
-    env.raw_set("error", error)?;
-    env.raw_set("type", r#type)?;
-    env.raw_set("to_lowercase", to_lowercase)?;
+    let upvalues = lua.create_table_with_capacity(0, 8)?;
+    upvalues.raw_set("get_cache_key", get_cache_key)?;
+    upvalues.raw_set("find_current_file", find_current_file)?;
+    upvalues.raw_set("proxyrequire", proxyrequire)?;
+    upvalues.raw_set("REGISTERED_MODULES", registered_modules)?;
+    upvalues.raw_set("LOADER_CACHE", loader_cache)?;
+    upvalues.raw_set("error", error)?;
+    upvalues.raw_set("type", r#type)?;
+    upvalues.raw_set("to_lowercase", to_lowercase)?;
 
     lua.load(
         r#"
-        local path = ...
-        if type(path) ~= "string" then
-            error("bad argument #1 to 'require' (string expected, got " .. type(path) .. ")")
-        end
-
-        -- Check if the module (path) is explicitly registered
-        local maybe_result = REGISTERED_MODULES[to_lowercase(path)]
-        if maybe_result ~= nil then
-            return maybe_result
-        end
-
-        local loader = proxyrequire(path, find_current_file())
-        local cache_key = get_cache_key()
-        -- Check if the loader result is already cached
-        local result = LOADER_CACHE[cache_key]
-        if result ~= nil then
+        local upvalues = ...
+        local get_cache_key = upvalues.get_cache_key
+        local find_current_file = upvalues.find_current_file
+        local proxyrequire = upvalues.proxyrequire
+        local REGISTERED_MODULES = upvalues.REGISTERED_MODULES
+        local LOADER_CACHE = upvalues.LOADER_CACHE
+        local error = upvalues.error
+        local type = upvalues.type
+        local to_lowercase = upvalues.to_lowercase
+        return function(path)
+            if type(path) ~= "string" then
+                error("bad argument #1 to 'require' (string expected, got " .. type(path) .. ")")
+            end
+
+            -- Check if the module (path) is explicitly registered
+            local maybe_result = REGISTERED_MODULES[to_lowercase(path)]
+            if maybe_result ~= nil then
+                return maybe_result
+            end
+
+            local loader = proxyrequire(path, find_current_file())
+            local cache_key = get_cache_key()
+            -- Check if the loader result is already cached
+            local result = LOADER_CACHE[cache_key]
+            if result ~= nil then
+                return result
+            end
+
+            -- Call the loader function and cache the result
+            result = loader()
+            if result == nil then
+                result = true
+            end
+            LOADER_CACHE[cache_key] = result
             return result
         end
-
-        -- Call the loader function and cache the result
-        result = loader()
-        if result == nil then
-            result = true
-        end
-        LOADER_CACHE[cache_key] = result
-        return result
         "#,
     )
     .try_cache()
     .set_name("=__mlua_require")
-    .set_environment(env)
-    .into_function()
+    .set_environment(lua.create_table()?)
+    .call(upvalues)
 }
 
 mod fs;
```

**File**: `tests/luau/require.rs` (modified, +10/-11)
```diff
@@ -126,32 +126,31 @@ fn test_require_errors() {
             _alive: alive.clone(),
         })
         .unwrap();
-    let proxy = (require.environment().unwrap())
-        .get::<Function>("proxyrequire")
-        .unwrap();
-    lua.globals().set("require", require).unwrap();
+    lua.globals().set("require", &require).unwrap();
     let res = lua
         .load(r#"return require('./a/relative/path')"#)
         .set_name("@main.rs")
         .exec();
     assert!((res.unwrap_err().to_string()).contains("test error"));
 
-    // An escaped proxy must retain its context independently of the require environment.
+    // A saved require function must retain its context independently of the globals.
     lua.globals().set("require", Value::Nil).unwrap();
     lua.gc_collect().unwrap();
     lua.gc_collect().unwrap();
     assert_eq!(Arc::strong_count(&alive), 2);
-    let res = proxy.call::<Value>(("./a/relative/path", "@main.rs"));
+    let res = lua
+        .load(r#"local require = ...; return require('./a/relative/path')"#)
+        .set_name("@main.rs")
+        .call::<Value>(&require);
     assert!(res.unwrap_err().to_string().contains("test error"));
     assert_eq!(
-        proxy
-            .call::<Function>(("./dependency", "@tests/luau/require/without_config/module.luau"))
-            .unwrap()
-            .call::<i32>(())
+        lua.load(r#"local require = ...; return require('./dependency')"#)
+            .set_name("@tests/luau/require/without_config/module.luau")
+            .call::<i32>(&require)
             .unwrap(),
         42
     );
-    drop(proxy);
+    drop(require);
     lua.gc_collect().unwrap();
     lua.gc_collect().unwrap();
     assert_eq!(Arc::strong_count(&alive), 1);
```

---

### Incident Patch 5: `496d834d` (2026-09-27)
**Commit Message**: Catch panics in Luau require `cache_key` callback

**File**: `src/luau/require.rs` (modified, +5/-4)
```diff
@@ -295,7 +295,7 @@ pub(super) unsafe extern "C-unwind" fn init_config(config: *mut ffi::luarequire_
         size_out: *mut usize,
     ) -> WriteResult {
         let this = try_borrow!(state, ctx);
-        let cache_key = this.cache_key();
+        let cache_key = callback_error_ext(state, ptr::null_mut(), true, move |_, _| Ok(this.cache_key()));
         write_to_buffer(buffer, buffer_size, size_out, cache_key.as_bytes())
     }
 
@@ -416,9 +416,10 @@ pub(super) fn create_require_function<R: Require + MaybeSend + 'static>(
     unsafe extern "C-unwind" fn get_cache_key(state: *mut ffi::lua_State) -> c_int {
         let ctx = ffi::lua_touserdata(state, ffi::lua_upvalueindex(1));
         let ctx = try_borrow!(state, ctx);
-        let cache_key = ctx.cache_key();
-        ffi::lua_pushlstring(state, cache_key.as_ptr() as *const _, cache_key.len());
-        1
+        callback_error_ext(state, ptr::null_mut(), true, move |extra, _| {
+            (*extra).raw_lua().push(ctx.cache_key())?;
+            Ok(1)
+        })
     }
 
     let (get_cache_key, find_current_file, proxyrequire, registered_modules, loader_cache) = unsafe {
```

---

### Incident Patch 6: `0225a351` (2026-09-27)
**Commit Message**: Fix stale userdata metatable registration on re-registration

**File**: `src/state.rs` (modified, +10/-2)
```diff
@@ -1680,16 +1680,24 @@ impl Lua {
     /// Registers a custom Rust type in Lua to use in userdata objects.
     ///
     /// This methods provides a way to add fields or methods to userdata objects of a type `T`.
+    /// Re-registering a type invalidates existing userdata instances of that type.
     pub fn register_userdata_type<T: 'static>(&self, f: impl FnOnce(&mut UserDataRegistry<T>)) -> Result<()> {
         let type_id = TypeId::of::<T>();
         let mut registry = UserDataRegistry::new(self);
         f(&mut registry);
 
         let lua = self.lock();
         unsafe {
-            // Deregister the type if it already registered
+            let state = lua.state();
+            let _sg = StackGuard::new(state);
+            check_stack(state, 1)?;
+
+            // Deregister the old metatable before releasing its registry reference.
             if let Some(table_id) = (*lua.extra.get()).registered_userdata_t.remove(&type_id) {
-                ffi::luaL_unref(lua.state(), ffi::LUA_REGISTRYINDEX, table_id);
+                ffi::lua_rawgeti(state, ffi::LUA_REGISTRYINDEX, table_id as _);
+                lua.deregister_userdata_metatable(ffi::lua_topointer(state, -1));
+                ffi::lua_pop(state, 1);
+                ffi::luaL_unref(state, ffi::LUA_REGISTRYINDEX, table_id);
             }
 
             // Add to "pending" registration map
```

**File**: `tests/userdata.rs` (modified, +9/-1)
```diff
@@ -930,8 +930,16 @@ fn test_any_userdata() -> Result<()> {
 #[test]
 fn test_userdata_reregister_type() -> Result<()> {
     let lua = Lua::new();
-    assert!(lua.create_any_userdata(0u32)?.is::<u32>());
+    let old = lua.create_any_userdata(0u32)?;
+    assert!(old.is::<u32>());
     lua.register_userdata_type::<u32>(|_| {})?;
+    assert!(!old.is::<u32>());
+    assert!(matches!(old.borrow::<u32>(), Err(Error::UserDataTypeMismatch)));
+
+    let new = lua.create_any_userdata(1u32)?;
+    assert_eq!(*new.borrow::<u32>()?, 1);
+    assert!(!old.is::<u32>());
+    drop(old);
     lua.gc_collect()?;
     lua.gc_collect()?;
     // Metatable address of `u32` can be reused for `i32`
```

---

### Incident Patch 7: `60a4d504` (2026-09-27)
**Commit Message**: Fix `__call` in examples/userdata.rs

Close #737

**File**: `examples/userdata.rs` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-use mlua::{Lua, Result, UserData, chunk};
+use mlua::{AnyUserData, Lua, Result, UserData, chunk};
 
 #[derive(Default, UserData)]
 struct Rectangle {
@@ -26,7 +26,7 @@ impl Rectangle {
 
     // Constructor via `__call` metamethod
     #[lua(meta, infallible)]
-    fn __call(length: u32, width: u32) -> Self {
+    fn __call(_: AnyUserData, length: u32, width: u32) -> Self {
         Rectangle::new(length, width)
     }
 }
```

---

### Incident Patch 8: `ae3cfaa5` (2026-09-27)
**Commit Message**: mlua-sys: Fix Lua 5.2 `luaL_len` declaration

**File**: `mlua-sys/src/lua52/lauxlib.rs` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ unsafe extern "C-unwind" {
 
     pub fn luaL_newstate() -> *mut lua_State;
 
-    pub fn luaL_len(L: *mut lua_State, idx: c_int) -> lua_Integer;
+    pub fn luaL_len(L: *mut lua_State, idx: c_int) -> c_int;
 
     pub fn luaL_gsub(
         L: *mut lua_State,
```

**File**: `src/table.rs` (modified, +1/-1)
```diff
@@ -658,7 +658,7 @@ impl Table {
             check_stack(state, 4)?;
 
             lua.push_ref(&self.0);
-            protect_lua!(state, 1, 0, |state| ffi::luaL_len(state, -1))
+            protect_lua!(state, 1, 0, |state| ffi::luaL_len(state, -1) as Integer)
         }
     }
 
```

---

### Incident Patch 9: `b2bdc456` (2026-09-27)
**Commit Message**: Fix HashSet/BTreeSet integer round trip conversion

**File**: `src/conversion.rs` (modified, +10/-2)
```diff
@@ -1034,7 +1034,11 @@ impl<T: Eq + Hash + FromLua, S: BuildHasher + Default> FromLua for HashSet<T, S>
     #[inline]
     fn from_lua(value: Value, _: &Lua) -> Result<Self> {
         match value {
-            Value::Table(table) if table.raw_len() > 0 => table.sequence_values().collect(),
+            Value::Table(table)
+                if table.raw_len() > 0 && !matches!(table.raw_get(1)?, Value::Boolean(true)) =>
+            {
+                table.sequence_values().collect()
+            }
             Value::Table(table) => table.pairs::<T, Value>().map(|res| res.map(|(k, _)| k)).collect(),
             _ => Err(Error::from_lua_conversion(
                 value.type_name(),
@@ -1058,7 +1062,11 @@ impl<T: Ord + FromLua> FromLua for BTreeSet<T> {
     #[inline]
     fn from_lua(value: Value, _: &Lua) -> Result<Self> {
         match value {
-            Value::Table(table) if table.raw_len() > 0 => table.sequence_values().collect(),
+            Value::Table(table)
+                if table.raw_len() > 0 && !matches!(table.raw_get(1)?, Value::Boolean(true)) =>
+            {
+                table.sequence_values().collect()
+            }
             Value::Table(table) => table.pairs::<T, Value>().map(|res| res.map(|(k, _)| k)).collect(),
             _ => Err(Error::from_lua_conversion(
                 value.type_name(),
```

**File**: `tests/conversion.rs` (modified, +8/-0)
```diff
@@ -439,6 +439,10 @@ fn test_conv_hashset() -> Result<()> {
     let set3 = lua.load(r#"{"a", "b", "c"}"#).eval::<HashSet<String>>()?;
     assert_eq!(set3, hashset! { "a".into(), "b".into(), "c".into() });
 
+    let set = hashset! {1, 2, 3};
+    assert_eq!(lua.unpack::<HashSet<i32>>(set.clone().into_lua(&lua)?)?, set);
+    assert_eq!(lua.load("{1, 2, 3}").eval::<HashSet<i32>>()?, set);
+
     Ok(())
 }
 
@@ -466,6 +470,10 @@ fn test_conv_btreeset() -> Result<()> {
     let set3 = lua.load(r#"{"a", "b", "c"}"#).eval::<BTreeSet<String>>()?;
     assert_eq!(set3, btreeset! { "a".into(), "b".into(), "c".into() });
 
+    let set = btreeset! {1, 2, 3};
+    assert_eq!(lua.unpack::<BTreeSet<i32>>(set.clone().into_lua(&lua)?)?, set);
+    assert_eq!(lua.load("{1, 2, 3}").eval::<BTreeSet<i32>>()?, set);
+
     Ok(())
 }
 
```

---

### Incident Patch 10: `381de8ba` (2026-09-27)
**Commit Message**: Prevent buffer seek overflow

**File**: `src/buffer.rs` (modified, +4/-4)
```diff
@@ -140,17 +140,17 @@ impl io::Seek for BufferCursor {
         let lua = self.0.0.lua.lock();
         let data = self.0.as_slice(&lua);
         let new_offset = match pos {
-            io::SeekFrom::Start(offset) => offset as i64,
-            io::SeekFrom::End(offset) => data.len() as i64 + offset,
-            io::SeekFrom::Current(offset) => self.1 as i64 + offset,
+            io::SeekFrom::Start(offset) => offset as i128,
+            io::SeekFrom::End(offset) => data.len() as i128 + offset as i128,
+            io::SeekFrom::Current(offset) => self.1 as i128 + offset as i128,
         };
         if new_offset < 0 {
             return Err(io::Error::new(
                 io::ErrorKind::InvalidInput,
                 "invalid seek to a negative position",
             ));
         }
-        if new_offset as usize > data.len() {
+        if new_offset > data.len() as i128 {
             return Err(io::Error::new(
                 io::ErrorKind::InvalidInput,
                 "invalid seek to a position beyond the end of the buffer",
```

---

### Incident Patch 11: `2f489ee5` (2026-09-20)
**Commit Message**: Prevent userdata destructor panics from corrupting Lua state

Resume explicit destruction panics after Lua restores its call frames, and abort on GC destructor panics.

**File**: `src/userdata.rs` (modified, +9/-1)
```diff
@@ -816,6 +816,9 @@ impl AnyUserData {
     /// This is similar to [`AnyUserData::take`], but it doesn't require a type.
     ///
     /// This method works for non-scoped userdata only.
+    ///
+    /// Panics from the value's destructor propagate to the caller. During garbage collection,
+    /// destructor panics abort the process instead.
     pub fn destroy(&self) -> Result<()> {
         let lua = self.0.lua.lock();
         let state = lua.state();
@@ -825,7 +828,12 @@ impl AnyUserData {
 
             lua.push_userdata_ref(&self.0)?;
             protect_lua!(state, 1, 1, fn(state) {
-                if ffi::luaL_callmeta(state, -1, cstr!("__gc")) == 0 {
+                if ffi::luaL_getmetafield(state, 1, cstr!("__gc")) != ffi::LUA_TNIL {
+                    ffi::lua_pushvalue(state, 1);
+                    // Only explicit destruction may propagate panics
+                    ffi::lua_pushboolean(state, 1);
+                    ffi::lua_call(state, 2, 1);
+                } else {
                     ffi::lua_pushboolean(state, 0);
                 }
             })?;
```

**File**: `src/userdata/util.rs` (modified, +15/-7)
```diff
@@ -1,5 +1,6 @@
 use std::any::TypeId;
 use std::os::raw::c_int;
+use std::panic::{AssertUnwindSafe, catch_unwind};
 use std::ptr;
 
 use rustc_hash::FxHashMap;
@@ -443,7 +444,8 @@ unsafe fn push_userdata_metatable_namecall(
 #[cfg(not(feature = "luau"))]
 pub(crate) unsafe extern "C-unwind" fn collect_userdata<T>(state: *mut ffi::lua_State) -> c_int {
     let ud = get_userdata::<T>(state, -1);
-    ptr::drop_in_place(ud);
+    // A GC finalizer must neither unwind through Lua nor raise a Lua error
+    catch_unwind(AssertUnwindSafe(|| ptr::drop_in_place(ud))).unwrap_or_else(|_| std::process::abort());
     0
 }
 
@@ -473,14 +475,20 @@ pub(crate) unsafe extern "C" fn collect_userdata<T>(
 // It checks if the userdata is safe to destroy and sets the "destroyed" metatable
 // to prevent further GC collection.
 pub(super) unsafe extern "C-unwind" fn destroy_userdata_storage<T>(state: *mut ffi::lua_State) -> c_int {
-    let ud = get_userdata::<UserDataStorage<T>>(state, 1);
-    if (*ud).is_safe_to_destroy() {
-        take_userdata::<UserDataStorage<T>>(state, 1);
-        ffi::lua_pushboolean(state, 1);
+    let destroy = |index| {
+        let ud = get_userdata::<UserDataStorage<T>>(state, index);
+        let safe_to_destroy = (*ud).is_safe_to_destroy();
+        if safe_to_destroy {
+            drop(take_userdata::<UserDataStorage<T>>(state, index));
+        }
+        ffi::lua_pushboolean(state, safe_to_destroy as c_int);
+        1
+    };
+    if ffi::lua_toboolean(state, 2) != 0 {
+        crate::state::callback_error_ext(state, ptr::null_mut(), false, |_, nargs| Ok(destroy(-nargs)))
     } else {
-        ffi::lua_pushboolean(state, 0);
+        catch_unwind(AssertUnwindSafe(|| destroy(1))).unwrap_or_else(|_| std::process::abort())
     }
-    1
 }
 
 static USERDATA_METATABLE_INDEX: u8 = 0;
```

**File**: `tests/userdata.rs` (modified, +84/-0)
```diff
@@ -446,6 +446,90 @@ fn test_userdata_destroy() -> Result<()> {
     Ok(())
 }
 
+#[test]
+#[cfg(panic = "unwind")]
+fn test_userdata_destroy_panic() -> Result<()> {
+    use std::panic::{AssertUnwindSafe, catch_unwind};
+
+    struct Panicking;
+    impl Drop for Panicking {
+        fn drop(&mut self) {
+            panic!("userdata drop");
+        }
+    }
+
+    let lua = Lua::new();
+    // Repeat beyond Lua's C-call limit
+    for _ in 0..256 {
+        let ud = lua.create_any_userdata(Panicking)?;
+        let panic = catch_unwind(AssertUnwindSafe(|| ud.destroy())).unwrap_err();
+        assert_eq!(panic.downcast_ref::<&str>(), Some(&"userdata drop"));
+        assert!(matches!(ud.destroy(), Err(Error::UserDataDestructed)));
+        assert!(lua.inspect_stack(0, |_| ()).is_none());
+        assert_eq!(lua.load("return 42").eval::<i32>()?, 42);
+    }
+    lua.gc_collect()?;
+
+    Ok(())
+}
+
+#[cfg(not(target_family = "wasm"))]
+#[test]
+fn test_userdata_gc_panic() -> Result<()> {
+    use std::panic::{AssertUnwindSafe, catch_unwind};
+
+    struct Panicking;
+    impl Drop for Panicking {
+        fn drop(&mut self) {
+            panic!("userdata drop");
+        }
+    }
+
+    if let Ok(mode) = std::env::var("MLUA_TEST_GC_PANIC") {
+        let _ = catch_unwind(AssertUnwindSafe(|| -> Result<()> {
+            let lua = Lua::new();
+            lua.gc_stop();
+            if mode.starts_with("callback") {
+                let value = Panicking;
+                lua.create_function(move |_, ()| {
+                    let _ = &value;
+                    Ok(())
+                })?;
+            } else {
+                lua.create_any_userdata(Panicking)?;
+            }
+            if mode.ends_with("collect") {
+                lua.gc_collect()?;
+                lua.gc_collect()?;
+                // Collection must abort before reaching here
+                std::process::exit(0);
+            }
+            drop(lua);
+            Ok(())
+        }));
+        return Ok(());
+    }
+
+    for mode in [
+        "userdata_collect",
+        "userdata_close",
+        "callback_collect",
+        "callback_close",
+    ] {
+        let output = std::process::Command::new(std::env::current_exe()?)
+            .args(["--exact", "test_userdata_gc_panic"])
+            .env("MLUA_TEST_GC_PANIC", mode)
+            .output()?;
+        assert!(!output.status.success(), "{mode}");
+        #[cfg(unix)]
+        {
+            use std::os::unix::process::ExitStatusExt;
+            assert_eq!(output.status.signal(), Some(libc::SIGABRT), "{mode}");
+        }
+    }
+    Ok(())
+}
+
 #[test]
 fn test_userdata_method_once() -> Result<()> {
     struct MyUserdata(Arc<i64>);
```

---

### Incident Patch 12: `dc06aac5` (2026-09-20)
**Commit Message**: Anchor Luau require contexts without retaining them through cached loaders

**File**: `src/luau/require.rs` (modified, +4/-2)
```diff
@@ -432,11 +432,13 @@ pub(super) fn create_require_function<R: Require + MaybeSend + 'static>(
             ffi::lua_pushcclosured(state, get_cache_key, cstr!("get_cache_key"), 1);
             ffi::lua_pushcfunctiond(state, find_current_file, cstr!("find_current_file"));
             ffi::luarequire_pushproxyrequire(state, init_config, context_ptr as *mut _);
-            // Keep the context alive in the proxy's environment
+            // Anchor to the config userdata to keep the context alive
+            ffi::lua_getupvalue(state, -1, 1);
             ffi::lua_createtable(state, 1, 0);
             ffi::lua_getupvalue(state, 1, 1);
             ffi::lua_rawseti(state, -2, 1);
-            ffi::lua_setfenv(state, -2);
+            ffi::lua_setmetatable(state, -2);
+            ffi::lua_pop(state, 1);
             ffi::luaL_getsubtable(state, ffi::LUA_REGISTRYINDEX, ffi::LUA_REGISTERED_MODULES_TABLE);
             ffi::luaL_getsubtable(state, ffi::LUA_REGISTRYINDEX, cstr!("__MLUA_LOADER_CACHE"));
         })?;
```

**File**: `tests/luau/require.rs` (modified, +25/-14)
```diff
@@ -5,7 +5,7 @@ use std::result::Result as StdResult;
 use std::sync::Arc;
 
 use mlua::luau::{FsRequirer, NavigateError, Require};
-use mlua::{Error, FromLua, IntoLua, Lua, MultiValue, Result, Value};
+use mlua::{Error, FromLua, Function, IntoLua, Lua, MultiValue, Result, Value};
 
 fn run_require(lua: &Lua, path: impl IntoLua) -> Result<Value> {
     lua.load(r#"return require(...)"#).call(path)
@@ -79,8 +79,11 @@ fn test_require_errors() {
             self.inner.is_require_allowed(chunk_name)
         }
 
-        fn reset(&mut self, _chunk_name: &str) -> StdResult<(), NavigateError> {
-            Err(Error::runtime("test error"))?
+        fn reset(&mut self, chunk_name: &str) -> StdResult<(), NavigateError> {
+            if chunk_name.ends_with(".rs") {
+                Err(Error::runtime("test error"))?;
+            }
+            self.inner.reset(chunk_name)
         }
 
         fn jump_to_alias(&mut self, path: &str) -> StdResult<(), NavigateError> {
@@ -111,8 +114,8 @@ fn test_require_errors() {
             self.inner.config()
         }
 
-        fn loader(&self, lua: &Lua) -> Result<mlua::Function> {
-            self.inner.loader(lua)
+        fn loader(&self, lua: &Lua) -> Result<Function> {
+            lua.create_function(|_, ()| Ok(42))
         }
     }
 
@@ -123,23 +126,31 @@ fn test_require_errors() {
             _alive: alive.clone(),
         })
         .unwrap();
-    let proxy = require
-        .environment()
-        .unwrap()
-        .get::<mlua::Function>("proxyrequire")
+    let proxy = (require.environment().unwrap())
+        .get::<Function>("proxyrequire")
         .unwrap();
     lua.globals().set("require", require).unwrap();
-    let res = lua.load(r#"return require('./a/relative/path')"#).exec();
+    let res = lua
+        .load(r#"return require('./a/relative/path')"#)
+        .set_name("@main.rs")
+        .exec();
     assert!((res.unwrap_err().to_string()).contains("test error"));
 
     // An escaped proxy must retain its context independently of the require environment.
     lua.globals().set("require", Value::Nil).unwrap();
     lua.gc_collect().unwrap();
     lua.gc_collect().unwrap();
     assert_eq!(Arc::strong_count(&alive), 2);
-    let res = proxy.call::<Value>(("./a/relative/path", "@main.lua"));
+    let res = proxy.call::<Value>(("./a/relative/path", "@main.rs"));
     assert!(res.unwrap_err().to_string().contains("test error"));
-
+    assert_eq!(
+        proxy
+            .call::<Function>(("./dependency", "@tests/luau/require/without_config/module.luau"))
+            .unwrap()
+            .call::<i32>(())
+            .unwrap(),
+        42
+    );
     drop(proxy);
     lua.gc_collect().unwrap();
     lua.gc_collect().unwrap();
@@ -353,7 +364,7 @@ fn test_alias_override() {
             self.0.config()
         }
 
-        fn loader(&self, lua: &Lua) -> Result<mlua::Function> {
+        fn loader(&self, lua: &Lua) -> Result<Function> {
             self.0.loader(lua)
         }
     }
@@ -428,7 +439,7 @@ fn test_alias_fallback() {
             self.0.config()
         }
 
-        fn loader(&self, lua: &Lua) -> Result<mlua::Function> {
+        fn loader(&self, lua: &Lua) -> Result<Function> {
             self.0.loader(lua)
         }
     }
```

---

### Incident Patch 13: `0adc5387` (2026-09-20)
**Commit Message**: Fix Luau require from chunks loaded by path

Fixes #735

**File**: `src/luau/require/fs.rs` (modified, +12/-12)
```diff
@@ -137,20 +137,20 @@ impl Require for FsRequirer {
             return Ok(());
         }
 
-        if chunk_path.is_absolute() {
-            let resolved_path = Self::resolve_module(&chunk_path)?;
-            self.abs_path = chunk_path.clone();
-            self.rel_path = chunk_path;
-            self.resolved_path = resolved_path;
+        let abs_path = if chunk_path.is_absolute() {
+            chunk_path.clone()
         } else {
-            // Relative path
             let cwd = env::current_dir().map_err(|_| NavigateError::NotFound)?;
-            let abs_path = Self::normalize_path(&cwd.join(&chunk_path));
-            let resolved_path = Self::resolve_module(&abs_path)?;
-            self.abs_path = abs_path;
-            self.rel_path = chunk_path;
-            self.resolved_path = resolved_path;
-        }
+            Self::normalize_path(&cwd.join(&chunk_path))
+        };
+        // Chunks loaded by path include the file extension, unlike module names.
+        let resolved_path = match Self::resolve_module(&abs_path) {
+            Err(NavigateError::NotFound) if abs_path.is_file() => Some(abs_path.clone()),
+            result => result?,
+        };
+        self.abs_path = abs_path;
+        self.rel_path = chunk_path;
+        self.resolved_path = resolved_path;
 
         Ok(())
     }
```

**File**: `tests/luau/require.rs` (modified, +23/-0)
```diff
@@ -1,4 +1,6 @@
+use std::fs;
 use std::io::Result as IoResult;
+use std::path::Path;
 use std::result::Result as StdResult;
 use std::sync::Arc;
 
@@ -144,6 +146,27 @@ fn test_require_errors() {
     assert_eq!(Arc::strong_count(&alive), 1);
 }
 
+#[test]
+fn test_require_from_path() -> Result<()> {
+    let dir = tempfile::tempdir_in(".").unwrap();
+    // Resetting a required module must not pick an unrelated extensionless file.
+    fs::write(dir.path().join("dependency"), "return 99").unwrap();
+    fs::write(
+        dir.path().join("dependency.luau"),
+        "if not loaded then loaded = true; return require('@self') end; return 42",
+    )
+    .unwrap();
+    for name in ["main.luau", "main.lua", "init.luau"] {
+        let path = Path::new(dir.path().file_name().unwrap()).join(name);
+        fs::write(&path, "return require('./dependency')").unwrap();
+        for path in [path.clone(), path.canonicalize().unwrap()] {
+            let lua = Lua::new();
+            assert_eq!(lua.load(path.as_path()).eval::<i32>()?, 42);
+        }
+    }
+    Ok(())
+}
+
 #[test]
 fn test_require_without_config() {
     let lua = Lua::new();
```

---

### Incident Patch 14: `9e63bcf7` (2026-09-20)
**Commit Message**: Keep Luau require contexts alive with escaped proxy helpers

**File**: `src/luau/require.rs` (modified, +5/-0)
```diff
@@ -432,6 +432,11 @@ pub(super) fn create_require_function<R: Require + MaybeSend + 'static>(
             ffi::lua_pushcclosured(state, get_cache_key, cstr!("get_cache_key"), 1);
             ffi::lua_pushcfunctiond(state, find_current_file, cstr!("find_current_file"));
             ffi::luarequire_pushproxyrequire(state, init_config, context_ptr as *mut _);
+            // Keep the context alive in the proxy's environment
+            ffi::lua_createtable(state, 1, 0);
+            ffi::lua_getupvalue(state, 1, 1);
+            ffi::lua_rawseti(state, -2, 1);
+            ffi::lua_setfenv(state, -2);
             ffi::luaL_getsubtable(state, ffi::LUA_REGISTRYINDEX, ffi::LUA_REGISTERED_MODULES_TABLE);
             ffi::luaL_getsubtable(state, ffi::LUA_REGISTRYINDEX, cstr!("__MLUA_LOADER_CACHE"));
         })?;
```

**File**: `tests/luau/require.rs` (modified, +39/-11)
```diff
@@ -1,5 +1,6 @@
 use std::io::Result as IoResult;
 use std::result::Result as StdResult;
+use std::sync::Arc;
 
 use mlua::luau::{FsRequirer, NavigateError, Require};
 use mlua::{Error, FromLua, IntoLua, Lua, MultiValue, Result, Value};
@@ -66,54 +67,81 @@ fn test_require_errors() {
     assert!((res.unwrap_err().to_string()).contains("@ is not a valid alias"));
 
     // Test throwing mlua::Error
-    struct MyRequire(FsRequirer);
+    struct MyRequire {
+        inner: FsRequirer,
+        _alive: Arc<()>,
+    }
 
     impl Require for MyRequire {
         fn is_require_allowed(&self, chunk_name: &str) -> bool {
-            self.0.is_require_allowed(chunk_name)
+            self.inner.is_require_allowed(chunk_name)
         }
 
         fn reset(&mut self, _chunk_name: &str) -> StdResult<(), NavigateError> {
             Err(Error::runtime("test error"))?
         }
 
         fn jump_to_alias(&mut self, path: &str) -> StdResult<(), NavigateError> {
-            self.0.jump_to_alias(path)
+            self.inner.jump_to_alias(path)
         }
 
         fn to_parent(&mut self) -> StdResult<(), NavigateError> {
-            self.0.to_parent()
+            self.inner.to_parent()
         }
 
         fn to_child(&mut self, name: &str) -> StdResult<(), NavigateError> {
-            self.0.to_child(name)
+            self.inner.to_child(name)
         }
 
         fn has_module(&self) -> bool {
-            self.0.has_module()
+            self.inner.has_module()
         }
 
         fn cache_key(&self) -> String {
-            self.0.cache_key()
+            self.inner.cache_key()
         }
 
         fn has_config(&self) -> bool {
-            self.0.has_config()
+            self.inner.has_config()
         }
 
         fn config(&self) -> IoResult<Vec<u8>> {
-            self.0.config()
+            self.inner.config()
         }
 
         fn loader(&self, lua: &Lua) -> Result<mlua::Function> {
-            self.0.loader(lua)
+            self.inner.loader(lua)
         }
     }
 
-    let require = lua.create_require_function(MyRequire(FsRequirer::new())).unwrap();
+    let alive = Arc::new(());
+    let require = lua
+        .create_require_function(MyRequire {
+            inner: FsRequirer::new(),
+            _alive: alive.clone(),
+        })
+        .unwrap();
+    let proxy = require
+        .environment()
+        .unwrap()
+        .get::<mlua::Function>("proxyrequire")
+        .unwrap();
     lua.globals().set("require", require).unwrap();
     let res = lua.load(r#"return require('./a/relative/path')"#).exec();
     assert!((res.unwrap_err().to_string()).contains("test error"));
+
+    // An escaped proxy must retain its context independently of the require environment.
+    lua.globals().set("require", Value::Nil).unwrap();
+    lua.gc_collect().unwrap();
+    lua.gc_collect().unwrap();
+    assert_eq!(Arc::strong_count(&alive), 2);
+    let res = proxy.call::<Value>(("./a/relative/path", "@main.lua"));
+    assert!(res.unwrap_err().to_string().contains("test error"));
+
+    drop(proxy);
+    lua.gc_collect().unwrap();
+    lua.gc_collect().unwrap();
+    assert_eq!(Arc::strong_count(&alive), 1);
 }
 
 #[test]
```

---

### Incident Patch 15: `ed93064a` (2026-09-19)
**Commit Message**: Fix tests

**File**: `tests/luau.rs` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ fn test_sandbox() -> Result<()> {
         let err = collectgarbage.call::<()>(arg).err().unwrap().to_string();
         assert!(err.contains("collectgarbage called with invalid option"));
     }
-    assert!(collectgarbage.call::<u64>("count").unwrap() > 0);
+    assert!(collectgarbage.call::<f64>("count").unwrap() > 0.0);
 
     lua.sandbox(false)?;
 
```

#### Recent Merged Pull Requests:
- **PR #732** (closed): Clippy fixes (@notpeter)
- **PR #727** (closed): Allow `#[mlua::userdata_impl]` in a different module than the type (@teddytennant)
- **PR #719** (closed): Expose `ValueRef` via trait. (@Renderthegreat)
- **PR #712** (2026-07-05): mlua-sys: separate compile error when no Lua feature is enabled (@mrcjkb)
- **PR #707** (2026-06-09): Remove unmaintained proc-macro-error2 dependency (RUSTSEC-2026-0173) (@thomasqueirozb)
- **PR #701** (closed): Add hooks for coroutine yield and resume (@johalun)
- **PR #699** (2026-04-30): feat: implement `Not` for `StdLib` (@mokurin000)
- **PR #697** (closed): Fix module mode linking on macOS (@ChrisJefferson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
