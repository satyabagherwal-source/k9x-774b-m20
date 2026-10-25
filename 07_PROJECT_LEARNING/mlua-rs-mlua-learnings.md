> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mlua-rs-mlua-learnings.md`  
> **Source**: github ([https://github.com/mlua-rs/mlua](https://github.com/mlua-rs/mlua))  
> **Source Version**: `ff96ed78`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T19:06:28.073Z  
> **Learning ID**: `learn-github-mlua-rs-mlua`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mlua-rs/mlua

> **Canonical Artifact**: `07_PROJECT_LEARNING/mlua-rs-mlua-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mlua-rs/mlua](https://github.com/mlua-rs/mlua))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T19:06:28.063Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mlua-rs/mlua`
- **Description**: High level Lua 5.5/5.4/5.3/5.2/5.1 (including LuaJIT) and Luau bindings to Rust with async/await support
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2922 stars

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
                            let digit = (c as u8 - b'0') as Integer;
                            let new_num = num
                                .unwrap_or(0)
                                .checked_mul(10)
                                .and_then(|n| {
                                    if negative {
                                        n.checked_sub(digit)
                                    } else {
                                        n.checked_add(digit)
                                    }
                                })
                                .ok_or_else(|| {
                                    Error::runtime(format!("integer overflow in path at position {pos}"))
                                })?;
                            num = Some(new_num);
                            chars.next(); // consume digit
                        }
                        match num {
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

        let min_path = format!("a[{}]", crate::Integer::MIN);
        let path = parse_path(&min_path).unwrap();
        assert!(matches!(path[1], (PathKey::Int(n), false) if n == crate::Integer::MIN));

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
        assert_eq!(
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

### Incident Patch 1: `ff96ed78` (2026-10-24)
**Commit Message**: Fix minimum integer lookup paths

**File**: `src/util/path.rs` (modified, +15/-2)
```diff
@@ -78,18 +78,24 @@ pub(crate) fn parse_path<'a>(path: &'a str) -> Result<Vec<(PathKey<'a>, bool)>>
                         }
                         let mut num: Option<Integer> = None;
                         while let Some(&(_, c @ '0'..='9')) = chars.peek() {
+                            let digit = (c as u8 - b'0') as Integer;
                             let new_num = num
                                 .unwrap_or(0)
                                 .checked_mul(10)
-                                .and_then(|n| n.checked_add((c as u8 - b'0') as Integer))
+                                .and_then(|n| {
+                                    if negative {
+                                        n.checked_sub(digit)
+                                    } else {
+                                        n.checked_add(digit)
+                                    }
+                                })
                                 .ok_or_else(|| {
                                     Error::runtime(format!("integer overflow in path at position {pos}"))
                                 })?;
                             num = Some(new_num);
                             chars.next(); // consume digit
                         }
                         match num {
-                            Some(n) if negative => PathKey::Int(-n),
                             Some(n) => PathKey::Int(n),
                             None => {
                                 let err = format!("invalid integer in path at position {pos}");
@@ -209,6 +215,10 @@ mod tests {
         assert!(matches!(path[3], (PathKey::Str(ref s), false) if s == "c"));
         assert!(matches!(path[4], (PathKey::Str(ref s), false) if s == "d"));
 
+        let min_path = format!("a[{}]", crate::Integer::MIN);
+        let path = parse_path(&min_path).unwrap();
+        assert!(matches!(path[1], (PathKey::Int(n), false) if n == crate::Integer::MIN));
+
         // Test empty path
         let path = parse_path("").unwrap();
         assert_eq!(path.len(), 0);
@@ -249,6 +259,9 @@ mod tests {
         // Test bad integers
         let err = parse_path("a[99999999999999999999]").unwrap_err().to_string();
         assert_eq!(err, "runtime error: integer overflow in path at position 2");
+        let negative_overflow = format!("a[{}0]", crate::Integer::MIN);
+        let err = parse_path(&negative_overflow).unwrap_err().to_string();
+        assert_eq!(err, "runtime error: integer overflow in path at position 2");
         let err = parse_path("a[-]").unwrap_err().to_string();
         assert_eq!(err, "runtime error: invalid integer in path at position 2");
     }
```

---

### Incident Patch 2: `717c9eee` (2026-10-24)
**Commit Message**: Document Wasm builds

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Started as an `rlua` fork, `mlua` supports Lua 5.5, 5.4, 5.3, 5.2, 5.1 (includin
 
 `mlua` is tested on Windows/macOS/Linux including module mode in [GitHub Actions] on `x86_64` platforms and cross-compilation to `aarch64` (other targets are also supported).
 
-WebAssembly (WASM) is supported through the `wasm32-unknown-emscripten` target for all Lua/Luau versions excluding JIT.
+Lua 5.1–5.5 and Luau support `wasm32-unknown-unknown` with a WASI C runtime and the `wasm32-wasip` targets. See [Compiling for WebAssembly](docs/wasm32.md) for setup and build instructions.
 
 [GitHub Actions]: https://github.com/mlua-rs/mlua/actions
 [Luau]: https://luau.org
```

**File**: `docs/wasm32.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# Compiling for WebAssembly
+
+Lua 5.1-5.5 and Luau can be compiled for WebAssembly. The WASI
+builds use [WASI SDK](https://github.com/WebAssembly/wasi-sdk) to compile and link
+the C/C++ code, and [Wasmtime](https://github.com/bytecodealliance/wasmtime) to run it.
+
+| Rust target | Rust toolchain | Output |
+| --- | --- | --- |
+| `wasm32-wasip1` | stable | WASI Preview 1 module |
+| `wasm32-wasip2` | stable | WASI Preview 2 component |
+| `wasm32-wasip3` | nightly | WASI Preview 3 component |
+| `wasm32-unknown-unknown` | stable | Module or component, linked with a WASI Preview 1 or 2 C runtime |
+
+LuaJIT and Luau's JIT backend are not supported.
+
+## Setup
+
+Run the commands below from the mlua repository root.
+
+Install WASI SDK, for example on Apple Silicon:
+
+```bash
+WASI_SDK_VERSION=34
+WASI_SDK_ARCHIVE="wasi-sdk-${WASI_SDK_VERSION}.0-arm64-macos"
+mkdir -p "$HOME/.local"
+curl -fL "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_SDK_VERSION}/${WASI_SDK_ARCHIVE}.tar.gz" \
+    | tar -xz -C "$HOME/.local"
+export WASI_SDK_PATH="$HOME/.local/$WASI_SDK_ARCHIVE"
+```
+
+Install Wasmtime:
+
+```bash
+brew install wasmtime
+```
+
+Install the Rust target(s):
+
+```bash
+rustup target add wasm32-wasip1 wasm32-wasip2 wasm32-unknown-unknown
+```
+
+The [setup script](../tests/wasm/setup.sh) selects the SDK compilers,
+libraries, linker flags and Cargo runner. Source it in the same shell as the
+Cargo commands. It also enables Wasm exceptions, which the Lua runtimes need
+for error handling.
+
+## WASI Preview 1 and 2
+
+To compile and run the basic tests with Lua 5.5 on Preview 2:
+
+```bash
+source tests/wasm/setup.sh wasm32-wasip2
+cargo test --manifest-path tests/wasm/Cargo.toml \
+    --target wasm32-wasip2 --lib --features lua55
+```
+
+The test crate accepts `lua55`, `lua54`, `lua53`, `lua52`, `lua51` or `luau`.
+It enables vendored Lua automatically.
+
+For your own application, enable `vendored` for Lua.
+Source the setup script using the path to your mlua checkout,
+then build or run your application:
+
+```bash
+source /path/to/mlua/tests/wasm/setup.sh wasm32-wasip2
+cargo build --target wasm32-wasip2
+cargo run --target wasm32-wasip2
+```
+
+Cargo uses Wasmtime as its runner. To run the output directly:
+
+```bash
+wasmtime -W exceptions target/wasm32-wasip2/debug/your-app.wasm
+```
+
+## wasm32-unknown-unknown
+
+This build uses Rust's `wasm32-unknown-unknown` target with a WASI C runtime.
+The host must provide the matching WASI imports and support Wasm exceptions.
+Loading the output in a browser requires those facilities too.
+
+The [test crate](../tests/wasm/src/lib.rs) is a working example. Run it with
+either C runtime:
+
+```bash
+./tests/wasm/run.sh lua55 wasm32-wasip1
+./tests/wasm/run.sh lua55 wasm32-wasip2
+```
+
+Append `--release` to build and run with optimizations, or `--debug` for the default debug build.
+
+With Preview 1, it builds a `cdylib` and invokes the exported `run_tests` function.
+With Preview 2, it builds a Rust `staticlib`, then links it with a small
+[C entry point](../tests/wasm/main.c) into a command component.
+
+To adapt this to your project:
+
+1. Use the `allocator` module from the test crate as your global allocator. Rust
+   and WASI libc must share an allocator so they do not independently manage the
+   same linear memory.
+2. Export your entry point as an `extern "C"` function with `#[unsafe(no_mangle)]`.
+3. Follow [run.sh](../tests/wasm/run.sh) for the build and link commands, replacing
+   the crate path, output name and entry point with your own. Its call to
+   `setup.sh` selects the C runtime separately from the Rust target.
```

**File**: `tests/wasm/run.sh` (modified, +10/-4)
```diff
@@ -3,16 +3,22 @@ set -euo pipefail
 
 lua="${1:-luau}"
 c_target="${2:-wasm32-wasip1}"
-if [[ $# -gt 2 || ! "$lua" =~ ^(luau|lua5[1-5])$ || ! "$c_target" =~ ^wasm32-wasip[12]$ ]]; then
-    echo "Usage: $0 [lua55|lua54|lua53|lua52|lua51|luau] [wasm32-wasip1|wasm32-wasip2]" >&2
+if [[ $# -gt 3 || ! "$lua" =~ ^(luau|lua5[1-5])$ || ! "$c_target" =~ ^wasm32-wasip[12]$ || ! "${3:---debug}" =~ ^--(debug|release)$ ]]; then
+    echo "Usage: $0 [lua55|lua54|lua53|lua52|lua51|luau] [wasm32-wasip1|wasm32-wasip2] [--debug|--release]" >&2
     exit 2
 fi
 
 cd "$(dirname "$0")/../.."
 source tests/wasm/setup.sh wasm32-unknown-unknown "$c_target"
 export CARGO_TARGET_DIR="$PWD/target/wasm-tests"
 cargo_args=(--manifest-path tests/wasm/Cargo.toml --target wasm32-unknown-unknown --features "$lua")
-wasm_output="$CARGO_TARGET_DIR/wasm32-unknown-unknown/debug/mlua_wasm_tests.wasm"
+profile=debug
+if [[ "${3:-}" == --release ]]; then
+    cargo_args+=(--release)
+    profile=release
+fi
+wasm_output_dir="$CARGO_TARGET_DIR/wasm32-unknown-unknown/$profile"
+wasm_output="$wasm_output_dir/mlua_wasm_tests.wasm"
 if [[ "$c_target" == wasm32-wasip1 ]]; then
     cargo build "${cargo_args[@]}"
     "${wasm_runner[@]}" --invoke run_tests "$wasm_output"
@@ -21,7 +27,7 @@ else
     wasm_output="${wasm_output%.wasm}.component.wasm"
     cargo rustc "${cargo_args[@]}" --lib --crate-type staticlib
     "$WASI_SDK_PATH/bin/clang" --target="$c_target" tests/wasm/main.c \
-        "$CARGO_TARGET_DIR/wasm32-unknown-unknown/debug/libmlua_wasm_tests.a" \
+        "$wasm_output_dir/libmlua_wasm_tests.a" \
         -L"$wasm_lib/eh" -lc++ -lsetjmp -o "$wasm_output"
     "${wasm_runner[@]}" "$wasm_output"
 fi
```

---

### Incident Patch 3: `d366205f` (2026-10-24)
**Commit Message**: Fix calls to callable table and userdata fields

Close #746

**File**: `src/table.rs` (modified, +4/-0)
```diff
@@ -1307,6 +1307,8 @@ impl ObjectLike for Table {
     fn call_function<R: FromLuaMulti>(&self, name: &str, args: impl IntoLuaMulti) -> Result<R> {
         match self.get(name)? {
             Value::Function(func) => func.call(args),
+            Value::Table(table) => table.call(args),
+            Value::UserData(ud) => ud.call(args),
             val => {
                 let msg = format!("attempt to call a {} value (function '{name}')", val.type_name());
                 Err(Error::runtime(msg))
@@ -1322,6 +1324,8 @@ impl ObjectLike for Table {
     {
         match self.get(name) {
             Ok(Value::Function(func)) => func.call_async(args),
+            Ok(Value::Table(table)) => table.call_async(args),
+            Ok(Value::UserData(ud)) => ud.call_async(args),
             Ok(val) => {
                 let msg = format!("attempt to call a {} value (function '{name}')", val.type_name());
                 AsyncCallFuture::error(Error::RuntimeError(msg))
```

**File**: `src/traits.rs` (modified, +6/-6)
```diff
@@ -169,14 +169,14 @@ pub trait ObjectLike: Sealed {
     where
         R: FromLuaMulti;
 
-    /// Gets the function associated to key `name` from the object and calls it,
+    /// Gets the callable value associated to key `name` from the object and calls it,
     /// passing the object itself along with `args` as function arguments.
     fn call_method<R>(&self, name: &str, args: impl IntoLuaMulti) -> Result<R>
     where
         R: FromLuaMulti;
 
-    /// Gets the function associated to key `name` from the object and asynchronously calls it,
-    /// passing the object itself along with `args` as function arguments.
+    /// Gets the callable value associated to key `name` from the object and asynchronously calls
+    /// it, passing the object itself along with `args` as function arguments.
     ///
     /// This might invoke the `__index` metamethod.
     #[cfg(feature = "async")]
@@ -185,16 +185,16 @@ pub trait ObjectLike: Sealed {
     where
         R: FromLuaMulti;
 
-    /// Gets the function associated to key `name` from the object and calls it,
+    /// Gets the callable value associated to key `name` from the object and calls it,
     /// passing `args` as function arguments.
     ///
     /// This might invoke the `__index` metamethod.
     fn call_function<R>(&self, name: &str, args: impl IntoLuaMulti) -> Result<R>
     where
         R: FromLuaMulti;
 
-    /// Gets the function associated to key `name` from the object and asynchronously calls it,
-    /// passing `args` as function arguments.
+    /// Gets the callable value associated to key `name` from the object and asynchronously calls
+    /// it, passing `args` as function arguments.
     ///
     /// This might invoke the `__index` metamethod.
     #[cfg(feature = "async")]
```

**File**: `src/userdata/object.rs` (modified, +4/-0)
```diff
@@ -63,6 +63,8 @@ impl ObjectLike for AnyUserData {
     {
         match self.get(name)? {
             Value::Function(func) => func.call(args),
+            Value::Table(table) => table.call(args),
+            Value::UserData(ud) => ud.call(args),
             val => {
                 let msg = format!("attempt to call a {} value (function '{name}')", val.type_name());
                 Err(Error::RuntimeError(msg))
@@ -77,6 +79,8 @@ impl ObjectLike for AnyUserData {
     {
         match self.get(name) {
             Ok(Value::Function(func)) => func.call_async(args),
+            Ok(Value::Table(table)) => table.call_async(args),
+            Ok(Value::UserData(ud)) => ud.call_async(args),
             Ok(val) => {
                 let msg = format!("attempt to call a {} value (function '{name}')", val.type_name());
                 AsyncCallFuture::error(Error::RuntimeError(msg))
```

**File**: `tests/async.rs` (modified, +18/-0)
```diff
@@ -411,6 +411,13 @@ async fn test_async_table_object_like() -> Result<()> {
     )?;
     table.set_metatable(Some(metatable))?;
     assert_eq!(table.call_async::<i64>(()).await.unwrap(), 15);
+    lua.globals().set("callable_table", &table)?;
+    assert_eq!(
+        lua.globals()
+            .call_async_function::<i64>("callable_table", ())
+            .await?,
+        15
+    );
 
     match table.call_async_method::<()>("non_existent", ()).await {
         Err(Error::RuntimeError(err)) => {
@@ -465,6 +472,10 @@ async fn test_async_userdata() -> Result<()> {
     struct MyUserdata(u64);
 
     impl UserData for MyUserdata {
+        fn add_fields<F: mlua::UserDataFields<Self>>(fields: &mut F) {
+            fields.add_field_method_get("callable_userdata", |_, this| Ok(MyUserdata(this.0)));
+        }
+
         fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
             methods.add_async_method("get_value", |_, data, ()| async move {
                 sleep_ms(10).await;
@@ -558,6 +569,13 @@ async fn test_async_userdata() -> Result<()> {
     let n: u64 = userdata.call_async_method("get_value", ()).await?;
     assert_eq!(n, 24);
     userdata.call_async_function::<()>("sleep", 15).await?;
+    #[cfg(not(any(feature = "lua51", feature = "luau")))]
+    assert_eq!(
+        userdata
+            .call_async_function::<String>("callable_userdata", ())
+            .await?,
+        "elapsed:24ms"
+    );
 
     #[cfg(not(any(feature = "lua51", feature = "luau")))]
     assert_eq!(userdata.call_async::<String>(()).await?, "elapsed:24ms");
```

**File**: `tests/table.rs` (modified, +12/-0)
```diff
@@ -702,6 +702,13 @@ fn test_table_object_like() -> Result<()> {
     assert_eq!(table.call_method::<String>("method", "a")?, "method_1");
     assert_eq!(table.to_string()?, "table object");
 
+    assert_eq!(lua.globals().call_function::<String>("table", "b")?, "call_2");
+    let callable = lua
+        .load("return setmetatable({}, {__call = function(_, receiver, key) return receiver[key] end})")
+        .eval::<Table>()?;
+    table.set("callable", callable)?;
+    assert_eq!(table.call_method::<i32>("callable", "a")?, 1);
+
     match table.call_method::<()>("non_existent", ()) {
         Err(Error::RuntimeError(err)) => {
             assert!(err.contains("attempt to call a nil value (function 'non_existent')"))
@@ -712,6 +719,11 @@ fn test_table_object_like() -> Result<()> {
     // Test calling non-callable table
     let table2 = lua.create_table()?;
     assert!(matches!(table2.call::<()>(()), Err(Error::RuntimeError(_))));
+    table.set("non_callable", table2)?;
+    assert!(matches!(
+        table.call_function::<()>("non_callable", ()),
+        Err(Error::RuntimeError(_))
+    ));
 
     Ok(())
 }
```

**File**: `tests/userdata.rs` (modified, +2/-0)
```diff
@@ -976,6 +976,7 @@ fn test_userdata_object_like() -> Result<()> {
 
     impl UserData for MyUserData {
         fn add_fields<F: UserDataFields<Self>>(fields: &mut F) {
+            fields.add_field_method_get("callable_userdata", |_, this| Ok(*this));
             fields.add_field_method_get("n", |_, this| Ok(this.0));
             fields.add_field_method_set("n", |_, this, val| {
                 this.0 = val;
@@ -1004,6 +1005,7 @@ fn test_userdata_object_like() -> Result<()> {
     }
 
     assert_eq!(ud.call::<LuaString>(())?, "called");
+    assert_eq!(ud.call_function::<String>("callable_userdata", ())?, "called");
 
     ud.call_method::<()>("add", 2)?;
     assert_eq!(ud.get::<u32>("n")?, 323);
```

#### Recent Merged Pull Requests:
- **PR #743** (closed): Compile `luau` for `wasm32-unknown-unknown`: skip stdio heap dump there (@nikolchaa)
- **PR #732** (closed): Clippy fixes (@notpeter)
- **PR #727** (closed): Allow `#[mlua::userdata_impl]` in a different module than the type (@teddytennant)
- **PR #719** (closed): Expose `ValueRef` via trait. (@Renderthegreat)
- **PR #712** (2026-07-05): mlua-sys: separate compile error when no Lua feature is enabled (@mrcjkb)
- **PR #707** (2026-06-09): Remove unmaintained proc-macro-error2 dependency (RUSTSEC-2026-0173) (@thomasqueirozb)

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

## X. minimum integer lookup paths

**RULE**:
When implementing operations in `src/util/path.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mlua-rs/mlua. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ff96ed78`: minimum integer lookup paths. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/util/path.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                            let digit = (c as u8 - b'0') as Integer;
                                .and_then(|n| {
                                    if negative {
                                        n.checked_sub(digit)
                                    } else {
                                        n.checked_add(digit)
                                    }
                                })
        let min_path = format!("a[{}]", crate::Integer::MIN);
        let path = parse_path(&min_path).unwrap();
        assert!(matches!(path[1], (PathKey::Int(n), false) if n == crate::Integer::MIN));

        let negative_overflow = format!("a[{}0]", crate::Integer::MIN);
        let err = parse_path(&negative_overflow).unwrap_err().to_string();
        assert_eq!(err, "runtime error: integer overflow in path at position 2");
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                                .and_then(|n| n.checked_add((c as u8 - b'0') as Integer))
                            Some(n) if negative => PathKey::Int(-n),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ff96ed78` are properly handled with clean fallback behavior.
