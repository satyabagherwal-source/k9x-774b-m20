# Forensic Learning Record (Deep Inspection): embassy-rs/embassy

> **Canonical Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:40.934Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9922 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cyw43/src/util.rs`
```
#![allow(unused)]

use core::{mem, ops, ptr, slice};

use aligned::{A4, Aligned, Alignment};
use embassy_time::{Duration, Ticker};

use crate::WithContext;

/// Defines a `repr(u8)` enum and implements a `from()` associated function to instantiate it from
/// a `u8`, defaulting to the variant decorated with `#[default]`.
macro_rules! enum_from_u8 {
    (
        $( #[$enum_attr:meta] )*
        enum $enum:ident {
            // NOTE: The default variant must be the first variant.
            // Additionally, the `#[default]` attribute must be placed before any other attributes
            // on the variant, to avoid a parsing ambiguity.
            #[default]
            $( #[$default_variant_attr:meta] )*
            $default_variant:ident = $default_value:literal,
            $(
                $( #[$variant_attr:meta] )*
                $variant:ident = $value:literal
            ),+
            $(,)?
        }
    ) => {
        $( #[$enum_attr] )*
        #[repr(u8)]
        pub enum $enum {
            $( #[$default_variant_attr] )*
            $default_variant = $default_value,
            $(
                $( #[$variant_attr] )*
                $variant = $value
            ),+
        }

        impl $enum {
            pub fn from(value: u8) -> Self {
                match value {
                    $default_value => Self::$default_variant,
                    $( $value => Self::$variant ),+,
                    _ => Self::$default_variant,
                }
            }
        }
    };
}
pub(crate) use enum_from_u8;

pub(crate) fn is_aligned(a: u32, x: u32) -> bool {
    (a & (x - 1)) == 0
}

pub(crate) fn round_down(x: u32, a: u32) -> u32 {
    debug_assert!(a.is_power_of_two());

    x & !(a - 1)
}

pub(crate) fn round_up(x: u32, a: u32) -> u32 {
    debug_assert!(a.is_power_of_two());

    (x + (a - 1)) & !(a - 1)
}

pub(crate) async fn try_until(mut func: impl AsyncFnMut() -> bool, duration: Duration) -> crate::Result<()> {
    let tick = Duration::from_millis(1);
    let mut ticker = Ticker::every(tick);
    let ticks = duration.as_ticks() / tick.as_ticks();

    for _ in 0..ticks {
        if func().await {
            return Ok(());
        }

        ticker.next().await;
    }

    Err(crate::Error)
}

/// Create an aligned buffer from a slice
///
/// Panics if the slice does not have the required alignment
pub(crate) fn aligned_from<A: Alignment>(buf: &mut [u8]) -> &mut Aligned<A, [u8]> {
    core::assert!((buf.as_ptr() as usize).is_multiple_of(mem::align_of::<Aligned<A, u8>>()));

    unsafe { mem::transmute(buf) }
}

/// Buffer with space for a cmd
pub struct WriteBuffer {
    buf: Aligned<A4, [u8]>,
}

impl WriteBuffer {
    pub fn new(buf: &mut Aligned<A4, [u8]>) -> &mut Self {
        unsafe { &mut *(buf as *mut Aligned<A4, [u8]> as *mut Self) }
    }

    pub fn cmd(&mut self) -> &mut [u8] {
        &mut self.buf[..4]
    }

    pub fn buf(&mut self) -> &mut [u8] {
        &mut self.buf[4..]
    }

    pub fn cmd_buf(&self) -> &Aligned<A4, [u8]> {
        &self.buf
    }
}

impl ops::Index<ops::RangeTo<usize>> for WriteBuffer {
    type Output = Self;

    fn index(&self, mut range: ops::RangeTo<usize>) -> &Self::Output {
        range.end += 4;

        unsafe { &*(&self.buf[range] as *const Aligned<A4, [u8]> as *const [u8] as *const WriteBuffer) }
    }
}

impl ops::IndexMut<ops::RangeTo<usize>> for WriteBuffer {
    fn index_mut(&mut self, mut range: ops::RangeTo<usize>) -> &mut Self::Output {
        range.end += 4;

        unsafe { &mut *(&mut self.buf[range] as *mut Aligned<A4, [u8]> as *mut [u8] as *mut WriteBuffer) }
    }
}

```

### Core Architecture Module: `embassy-executor-macros/src/util.rs`
```
use std::fmt::Display;

use proc_macro2::{TokenStream, TokenTree};
use quote::{ToTokens, TokenStreamExt};
use syn::parse::{Parse, ParseStream};
use syn::{AttrStyle, Attribute, Signature, Token, Visibility, braced, bracketed, token};

pub fn token_stream_with_error(mut tokens: TokenStream, error: syn::Error) -> TokenStream {
    tokens.extend(error.into_compile_error());
    tokens
}

pub fn error<A: ToTokens, T: Display>(s: &mut TokenStream, obj: A, msg: T) {
    s.extend(syn::Error::new_spanned(obj.into_token_stream(), msg).into_compile_error())
}

/// Function signature and body.
///
/// Same as `syn`'s `ItemFn` except we keep the body as a TokenStream instead of
/// parsing it. This makes the macro not error if there's a syntax error in the body,
/// which helps IDE autocomplete work better.
#[derive(Debug, Clone)]
pub struct ItemFn {
    pub attrs: Vec<Attribute>,
    pub vis: Visibility,
    pub sig: Signature,
    pub brace_token: token::Brace,
    pub body: TokenStream,
}

impl Parse for ItemFn {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let mut attrs = input.call(Attribute::parse_outer)?;
        let vis: Visibility = input.parse()?;
        let sig: Signature = input.parse()?;

        let content;
        let brace_token = braced!(content in input);
        while content.peek(Token![#]) && content.peek2(Token![!]) {
            let content2;
            attrs.push(Attribute {
                pound_token: content.parse()?,
                style: AttrStyle::Inner(content.parse()?),
                bracket_token: bracketed!(content2 in content),
                meta: content2.parse()?,
            });
        }

        let mut body = Vec::new();
        while !content.is_empty() {
            body.push(content.parse::<TokenTree>()?);
        }
        let body = body.into_iter().collect();

        Ok(ItemFn {
            attrs,
            vis,
            sig,
            brace_token,
            body,
        })
    }
}

impl ToTokens for ItemFn {
    fn to_tokens(&self, tokens: &mut TokenStream) {
        tokens.append_all(self.attrs.iter().filter(|a| matches!(a.style, AttrStyle::Outer)));
        self.vis.to_tokens(tokens);
        self.sig.to_tokens(tokens);
        self.brace_token.surround(tokens, |tokens| {
            tokens.append_all(self.body.clone());
        });
    }
}

```

### Core Architecture Module: `embassy-executor-timer-queue/src/lib.rs`
```
//! Timer queue item for embassy-executor integrated timer queues
//!
//! `embassy-executor` provides the memory needed to implement integrated timer queues. This crate
//! exists to separate that memory from `embassy-executor` itself, to decouple the timer queue's
//! release cycle from `embassy-executor`.
//!
//! This crate contains two things:
//! - [`TimerQueueItem`]: The item type that can be requested from the executor. The size of this
//!   type can be configured using the `timer-item-size-N-words` Cargo features.
//! - The [`TimerQueueItemProvider`] trait, which must be implemented (by `embassy-executor`,
//!   most likely) to return the `TimerQueueItem` associated with a given waker. It is a
//!   [unitrait]: the implementation is registered globally with
//!   [`timer_queue_item_provider_impl`] and resolved at link time.
//!
//! As a queue implementor, you will need to choose one of the `timer-item-size-N-words` features to
//! select a queue item size. You can then define your own item type, which must be
//! `#[repr(align(8))]` (or less) and must fit into the size you selected.
//!
//! You can access the `TimerQueueItem` from a `Waker` using the [`from_embassy_waker`](TimerQueueItem::from_embassy_waker)
//! method. You can then use the [`as_ref`](TimerQueueItem::as_ref) and [`as_mut`](TimerQueueItem::as_mut)
//! methods to reinterpret the data stored in the item as your custom item type.
#![no_std]

use core::task::Waker;

unitrait::unitrait! {
    /// Provider of the [`TimerQueueItem`] associated with a waker.
    ///
    /// This trait is implemented by the executor (`embassy-executor`, most likely), which owns
    /// the storage for timer queue items.
    #[symbol_prefix = "__embassy_time_queue"]
    pub trait TimerQueueItemProvider {
        /// Retrieves the `TimerQueueItem` reference that belongs to the task of the waker.
        ///
        /// Panics if called with a non-embassy waker.
        ///
        /// # Safety
        ///
        /// The caller must ensure they are not violating Rust's aliasing rules - it is not allowed
        /// to use this method to create multiple mutable references to the same `TimerQueueItem` at
        /// the same time.
        ///
        /// This function must only be called in the context of a timer queue implementation.
        unsafe fn item_from_waker(waker: &core::task::Waker) -> &'static mut TimerQueueItem;

        /// Like [`item_from_waker`](TimerQueueItemProvider::item_from_waker), but returns `None`
        /// instead of panicking if the waker is not an embassy waker.
        ///
        /// # Safety
        ///
        /// Same as [`item_from_waker`](TimerQueueItemProvider::item_from_waker).
        #[symbol = "__try_embassy_time_queue_item_from_waker"]
        unsafe fn try_item_from_waker(waker: &core::task::Waker) -> Option<&'static mut TimerQueueItem>;
    }

    /// The global [`TimerQueueItemProvider`] implementation.
    pub struct TimerQueueItemProviderImpl;

    /// Register a type as the global [`TimerQueueItemProvider`] implementation.
    ///
    /// This must be done exactly once in the crate tree, by the executor.
    macro timer_queue_item_provider_impl(path = $crate);
}

const ITEM_WORDS: usize = if cfg!(feature = "timer-item-size-8-words") {
    8
} else if cfg!(feature = "timer-item-size-6-words") {
    6
} else if cfg!(feature = "timer-item-size-4-words") {
    4
} else {
    0
};

/// The timer queue item provided by the executor.
///
/// This type is opaque, it only provides the raw storage for a queue item. The queue implementation
/// is responsible for reinterpreting the contents of the item using [`TimerQueueItem::as_ref`] and
/// [`TimerQueueItem::as_mut`].
#[repr(align(8))]
pub struct TimerQueueItem {
    data: [usize; ITEM_WORDS],
}

impl TimerQueueItem {
    /// Creates a new, zero-initialized `TimerQueueItem`.
    pub const fn new() -> Self {
        Self { data: [0; ITEM_WORDS] }
    }

    /// Retrieves the `TimerQueueItem` reference that belongs to the task of the waker.
    ///
    /// Panics if called with a non-embassy waker.
    ///
    /// # Safety
    ///
    /// The caller must ensure they are not violating Rust's aliasing rules - it is not allowed
    /// to use this method to create multiple mutable references to the same `TimerQueueItem` at
    /// the same time.
    ///
    /// This function must only be called in the context of a timer queue implementation.
    pub unsafe fn from_embassy_waker(waker: &Waker) -> &'static mut Self {
        unsafe { TimerQueueItemProviderImpl::item_from_waker(waker) }
    }

    /// Access the data as a reference to a type `T`.
    ///
    /// Safety:
    ///
    /// - The type must be valid when zero-initialized.
    /// - The timer queue should only be interpreted as a single type `T` during its lifetime.
    pub unsafe fn as_ref<T>(&self) -> &T {
        const { validate::<T>() }
        unsafe { &*(self.data.as_ptr() as *const T) }
    }

    /// Access the data as a reference to a type `T`.
    ///
    /// Safety:
    ///
    /// - The type must be valid when zero-initialized.
    /// - The timer queue should only be interpreted as a single type `T` during its lifetime.
    pub unsafe fn as_mut<T>(&self) -> &mut T {
        const { validate::<T>() }
        unsafe { &mut *(self.data.as_ptr() as *mut T) }
    }
}

const fn validate<T>() {
    const {
        assert!(
            core::mem::size_of::<TimerQueueItem>() >= core::mem::size_of::<T>(),
            "embassy-executor-timer-queue item size is smaller than the requested type. Select a larger timer-item-size-N-words feature."
        );
        assert!(
            core::mem::align_of::<TimerQueueItem>() >= core::mem::align_of::<T>(),
            "the alignment of the requested type is greater than 8"
        );
    }
}

```

### Core Architecture Module: `embassy-executor/src/raw/run_queue.rs`
```
use core::ptr::{NonNull, addr_of_mut};

use cordyceps::Linked;
#[cfg(any(feature = "scheduler-priority", feature = "scheduler-deadline"))]
use cordyceps::SortedList;
use cordyceps::sorted_list::Links;

#[cfg(target_has_atomic = "ptr")]
type TransferStack<T> = cordyceps::TransferStack<T>;

#[cfg(not(target_has_atomic = "ptr"))]
type TransferStack<T> = MutexTransferStack<T>;

use super::{TaskHeader, TaskRef};

/// Use `cordyceps::sorted_list::Links` as the singly linked list
/// for RunQueueItems.
pub(crate) type RunQueueItem = Links<TaskHeader>;

/// Implements the `Linked` trait, allowing for singly linked list usage
/// of any of cordyceps' `TransferStack` (used for the atomic runqueue),
/// `SortedList` (used with the DRS scheduler), or `Stack`, which is
/// popped atomically from the `TransferStack`.
unsafe impl Linked<Links<TaskHeader>> for TaskHeader {
    type Handle = TaskRef;

    // Convert a TaskRef into a TaskHeader ptr
    fn into_ptr(r: TaskRef) -> NonNull<TaskHeader> {
        r.ptr
    }

    // Convert a TaskHeader into a TaskRef
    unsafe fn from_ptr(ptr: NonNull<TaskHeader>) -> TaskRef {
        TaskRef { ptr }
    }

    // Given a pointer to a TaskHeader, obtain a pointer to the Links structure,
    // which can be used to traverse to other TaskHeader nodes in the linked list
    unsafe fn links(ptr: NonNull<TaskHeader>) -> NonNull<Links<TaskHeader>> {
        let ptr: *mut TaskHeader = ptr.as_ptr();
        NonNull::new_unchecked(addr_of_mut!((*ptr).run_queue_item))
    }
}

/// Atomic task queue using a very, very simple lock-free linked-list queue:
///
/// To enqueue a task, task.next is set to the old head, and head is atomically set to task.
///
/// Dequeuing is done in batches: the queue is emptied by atomically replacing head with
/// null. Then the batch is iterated following the next pointers until null is reached.
///
/// Note that batches will be iterated in the reverse order as they were enqueued. This is OK
/// for our purposes: it can't create fairness problems since the next batch won't run until the
/// current batch is completely processed, so even if a task enqueues itself instantly (for example
/// by waking its own waker) can't prevent other tasks from running.
pub(crate) struct RunQueue {
    stack: TransferStack<TaskHeader>,
}

impl RunQueue {
    pub const fn new() -> Self {
        Self {
            stack: TransferStack::new(),
        }
    }

    /// Enqueues an item. Returns true if the queue was empty.
    ///
    /// # Safety
    ///
    /// `item` must NOT be already enqueued in any queue.
    #[inline(always)]
    pub(crate) unsafe fn enqueue(&self, task: TaskRef, _tok: super::state::Token) -> bool {
        self.stack.push_was_empty(
            task,
            #[cfg(not(target_has_atomic = "ptr"))]
            _tok,
        )
    }

    #[inline]
    fn definitely_empty(&self) -> bool {
        #[cfg(target_has_atomic = "ptr")]
        {
            self.stack.is_empty()
        }
        #[cfg(not(target_has_atomic = "ptr"))]
        {
            false
        }
    }

    /// # Standard atomic runqueue
    ///
    /// Empty the queue, then call `on_task` for each task that was in the queue.
    /// NOTE: It is OK for `on_task` to enqueue more tasks. In this case they're left in the queue
    /// and will be processed by the *next* call to `dequeue_all`, *not* the current one.
    #[cfg(not(any(feature = "scheduler-priority", feature = "scheduler-deadline")))]
    pub(crate) fn dequeue_all(&self, on_task: impl Fn(TaskRef)) {
        // Besides the saved write, this matters on RP2350, where any exclusive
        // access posts an event that keeps the idle `WFE` from ever sleeping.
        if self.definitely_empty() {
            return;
        }

        let taken = self.stack.take_all();
        for taskref in taken {
            run_dequeue(&taskref);
            on_task(taskref);
        }
    }

    /// # Earliest Deadline First Scheduler
    ///
    /// This algorithm will loop until all enqueued tasks are processed.
    ///
    /// Before polling a task, all currently enqueued tasks will be popped from the
    /// runqueue, and will be added to the working `sorted` list, a linked-list that
    /// sorts tasks by their deadline, with nearest deadline items in the front, and
    /// furthest deadline items in the back.
    ///
    /// After popping and sorting all pending tasks, the SOONEST task will be popped
    /// from the front of the queue, and polled by calling `on_task` on it.
    ///
    /// This process will repeat until the local `sorted` queue AND the global
    /// runqueue are both empty, at which point this function will return.
    #[cfg(any(feature = "scheduler-priority", feature = "scheduler-deadline"))]
    pub(crate) fn dequeue_all(&self, on_task: impl Fn(TaskRef)) {
        if self.definitely_empty() {
            return;
        }

        let mut sorted = SortedList::<TaskHeader>::new_with_cmp(|lhs, rhs| {
            // compare by priority first
            #[cfg(feature = "scheduler-priority")]
            {
                let lp = lhs.metadata.priority();
                let rp = rhs.metadata.priority();
                if lp != rp {
                    return lp.cmp(&rp).reverse();
                }
            }
            // compare deadlines in case of tie.
            #[cfg(feature = "scheduler-deadline")]
            {
                let ld = lhs.metadata.deadline();
                let rd = rhs.metadata.deadline();
                if ld != rd {
                    return ld.cmp(&rd);
                }
            }
            core::cmp::Ordering::Equal
        });

        loop {
            // For each loop, grab any newly pended items
            let taken = self.stack.take_all();

            // Sort these into the list - this is potentially expensive! We do an
            // insertion sort of new items, which iterates the linked list.
            //
            // Something on the order of `O(n * m)`, where `n` is the number
            // of new tasks, and `m` is the number of already pending tasks.
            sorted.extend(taken);

            // Pop the task with the SOONEST deadline. If there are no tasks
            // pending, then we are done.
            let Some(taskref) = sorted.pop_front() else {
                return;
            };

            // We got one task, mark it as dequeued, and process the task.
            run_dequeue(&taskref);
            on_task(taskref);
        }
    }
}

/// atomic state does not require a cs...
#[cfg(target_has_atomic = "ptr")]
#[inline(always)]
fn run_dequeue(taskref: &TaskRef) {
    taskref.header().state.run_dequeue();
}

/// ...while non-atomic state does
#[cfg(not(target_has_atomic = "ptr"))]
#[inline(always)]
fn run_dequeue(taskref: &TaskRef) {
    critical_section::with(|cs| {
        taskref.header().state.run_dequeue(cs);
    })
}

/// A wrapper type that acts like TransferStack by wrapping a normal Stack in a CS mutex
#[cfg(not(target_has_atomic = "ptr"))]
struct MutexTransferStack<T: Linked<cordyceps::stack::Links<T>>> {
    inner: critical_section::Mutex<core::cell::UnsafeCell<cordyceps::Stack<T>>>,
}

#[cfg(not(target_has_atomic = "ptr"))]
impl<T: Linked<cordyceps::stack::Links<T>>> MutexTransferStack<T> {
    const fn new() -> Self {
        Self {
            inner: critical_section::Mutex::new(core::cell::UnsafeCell::new(cordyceps::Stack::new())),
        }
    }

    /// Push an item to the transfer stack, returning whether the stack was previously empty
    fn push_was_empty(&self, item: T::Handle, token: super::state::Token) -> bool {
        // SAFETY: The critical-section mutex guarantees that there is no *concurrent* access
        // for the lifetime of the token, but does NOT protect against re-entrant access.
        // However, we never *return* the reference, nor do we recurse (or call another method
        // like `take_all`) that could ever allow for re-entrant aliasing. Therefore, the
        // presence of the critical section is sufficient to guarantee exclusive access to
        // the `inner` field for the purposes of this function.
        let inner = unsafe { &mut *self.inner.borrow(token).get() };
        let is_empty = inner.is_empty();
        inner.push(item);
        is_empty
    }

    fn take_all(&self) -> cordyceps::Stack<T> {
        critical_section::with(|cs| {
            // SAFETY: The critical-section mutex guarantees that there is no *concurrent* access
            // for the lifetime of the token, but does NOT protect against re-entrant access.
            // However, we never *return* the reference, nor do we recurse (or call another method
            // like `push_was_empty`) that could ever allow for re-entrant aliasing. Therefore, the
            // presence of the critical section is sufficient to guarantee exclusive access to
            // the `inner` field for the purposes of this function.
            let inner = unsafe { &mut *self.inner.borrow(cs).get() };
            inner.take_all()
        })
    }
}

```

### Core Architecture Module: `embassy-executor/src/raw/state_atomics.rs`
```
// Prefer pointer-width atomic operations, as narrower ones may be slower.
#[cfg(all(target_pointer_width = "32", target_has_atomic = "32"))]
type AtomicState = core::sync::atomic::AtomicU32;
#[cfg(not(all(target_pointer_width = "32", target_has_atomic = "32")))]
type AtomicState = core::sync::atomic::AtomicU8;

#[cfg(all(target_pointer_width = "32", target_has_atomic = "32"))]
type StateBits = u32;
#[cfg(not(all(target_pointer_width = "32", target_has_atomic = "32")))]
type StateBits = u8;

use core::sync::atomic::Ordering;

#[derive(Clone, Copy)]
pub(crate) struct Token(());

/// Creates a token and passes it to the closure.
///
/// This is a no-op replacement for `CriticalSection::with` because we don't need any locking.
pub(crate) fn locked<R>(f: impl FnOnce(Token) -> R) -> R {
    f(Token(()))
}

/// Task is spawned (has a future)
pub(crate) const STATE_SPAWNED: StateBits = 1 << 0;
/// Task is in the executor run queue
pub(crate) const STATE_RUN_QUEUED: StateBits = 1 << 1;

pub(crate) struct State {
    state: AtomicState,
}

impl State {
    pub const fn new() -> State {
        Self {
            state: AtomicState::new(0),
        }
    }

    /// If task is idle, mark it as spawned + run_queued and return true.
    #[inline(always)]
    pub fn spawn(&self) -> bool {
        self.state
            .compare_exchange(0, STATE_SPAWNED | STATE_RUN_QUEUED, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    /// Unmark the task as spawned.
    #[inline(always)]
    pub fn despawn(&self) {
        self.state.fetch_and(!STATE_SPAWNED, Ordering::AcqRel);
    }

    /// Mark the task as run-queued if it's spawned and isn't already run-queued. Run the given
    /// function if the task was successfully marked.
    #[inline(always)]
    pub fn run_enqueue(&self, f: impl FnOnce(Token)) {
        let prev = self.state.fetch_or(STATE_RUN_QUEUED, Ordering::AcqRel);
        if prev & STATE_RUN_QUEUED == 0 {
            locked(f);
        }
    }

    /// Unmark the task as run-queued. Return whether the task is spawned.
    #[inline(always)]
    pub fn run_dequeue(&self) {
        self.state.fetch_and(!STATE_RUN_QUEUED, Ordering::AcqRel);
    }
}

```

### Core Architecture Module: `embassy-executor/src/raw/state_atomics_arm.rs`
```
use core::sync::atomic::{AtomicBool, AtomicU32, Ordering, compiler_fence};

#[derive(Clone, Copy)]
pub(crate) struct Token(());

/// Creates a token and passes it to the closure.
///
/// This is a no-op replacement for `CriticalSection::with` because we don't need any locking.
pub(crate) fn locked<R>(f: impl FnOnce(Token) -> R) -> R {
    f(Token(()))
}

// Must be kept in sync with the layout of `State`!
pub(crate) const STATE_SPAWNED: u32 = 1 << 0;
pub(crate) const STATE_RUN_QUEUED: u32 = 1 << 8;

#[repr(C, align(4))]
pub(crate) struct State {
    /// Task is spawned (has a future)
    spawned: AtomicBool,
    /// Task is in the executor run queue
    run_queued: AtomicBool,
    pad: AtomicBool,
    pad2: AtomicBool,
}

impl State {
    pub const fn new() -> State {
        Self {
            spawned: AtomicBool::new(false),
            run_queued: AtomicBool::new(false),
            pad: AtomicBool::new(false),
            pad2: AtomicBool::new(false),
        }
    }

    fn as_u32(&self) -> &AtomicU32 {
        unsafe { &*(self as *const _ as *const AtomicU32) }
    }

    /// If task is idle, mark it as spawned + run_queued and return true.
    #[inline(always)]
    pub fn spawn(&self) -> bool {
        compiler_fence(Ordering::Release);
        let r = self
            .as_u32()
            .compare_exchange(
                0,
                STATE_SPAWNED | STATE_RUN_QUEUED,
                Ordering::Relaxed,
                Ordering::Relaxed,
            )
            .is_ok();
        compiler_fence(Ordering::Acquire);
        r
    }

    /// Unmark the task as spawned.
    #[inline(always)]
    pub fn despawn(&self) {
        compiler_fence(Ordering::Release);
        self.spawned.store(false, Ordering::Relaxed);
    }

    /// Mark the task as run-queued if it's spawned and isn't already run-queued. Run the given
    /// function if the task was successfully marked.
    #[inline(always)]
    pub fn run_enqueue(&self, f: impl FnOnce(Token)) {
        let old = self.run_queued.swap(true, Ordering::AcqRel);

        if !old {
            locked(f);
        }
    }

    /// Unmark the task as run-queued. Return whether the task is spawned.
    #[inline(always)]
    pub fn run_dequeue(&self) {
        compiler_fence(Ordering::Release);

        self.run_queued.store(false, Ordering::Relaxed);
    }
}

```

### Core Architecture Module: `embassy-executor/src/raw/state_critical_section.rs`
```
use core::cell::Cell;

use critical_section::{CriticalSection, Mutex};
pub(crate) use critical_section::{CriticalSection as Token, with as locked};

#[cfg(target_arch = "avr")]
type StateBits = u8;
#[cfg(not(target_arch = "avr"))]
type StateBits = usize;

/// Task is spawned (has a future)
pub(crate) const STATE_SPAWNED: StateBits = 1 << 0;
/// Task is in the executor run queue
pub(crate) const STATE_RUN_QUEUED: StateBits = 1 << 1;

pub(crate) struct State {
    state: Mutex<Cell<StateBits>>,
}

impl State {
    pub const fn new() -> State {
        Self {
            state: Mutex::new(Cell::new(0)),
        }
    }

    fn update<R>(&self, f: impl FnOnce(&mut StateBits) -> R) -> R {
        critical_section::with(|cs| self.update_with_cs(cs, f))
    }

    fn update_with_cs<R>(&self, cs: CriticalSection<'_>, f: impl FnOnce(&mut StateBits) -> R) -> R {
        let s = self.state.borrow(cs);
        let mut val = s.get();
        let r = f(&mut val);
        s.set(val);
        r
    }

    /// If task is idle, mark it as spawned + run_queued and return true.
    #[inline(always)]
    pub fn spawn(&self) -> bool {
        self.update(|s| {
            if *s == 0 {
                *s = STATE_SPAWNED | STATE_RUN_QUEUED;
                true
            } else {
                false
            }
        })
    }

    /// Unmark the task as spawned.
    #[inline(always)]
    pub fn despawn(&self) {
        self.update(|s| *s &= !STATE_SPAWNED);
    }

    /// Mark the task as run-queued if it's spawned and isn't already run-queued. Run the given
    /// function if the task was successfully marked.
    #[inline(always)]
    pub fn run_enqueue(&self, f: impl FnOnce(Token)) {
        critical_section::with(|cs| {
            if self.update_with_cs(cs, |s| {
                let ok = *s & STATE_RUN_QUEUED == 0;
                *s |= STATE_RUN_QUEUED;
                ok
            }) {
                f(cs);
            }
        });
    }

    /// Unmark the task as run-queued. Return whether the task is spawned.
    #[inline(always)]
    pub fn run_dequeue(&self, cs: CriticalSection<'_>) {
        self.update_with_cs(cs, |s| *s &= !STATE_RUN_QUEUED)
    }
}

```

### Core Architecture Module: `embassy-executor/src/raw/util.rs`
```
use core::cell::UnsafeCell;
use core::mem::MaybeUninit;
use core::ptr;

pub(crate) struct UninitCell<T>(MaybeUninit<UnsafeCell<T>>);
impl<T> UninitCell<T> {
    pub const fn uninit() -> Self {
        Self(MaybeUninit::uninit())
    }

    pub unsafe fn as_mut_ptr(&self) -> *mut T {
        (*self.0.as_ptr()).get()
    }

    #[allow(clippy::mut_from_ref)]
    pub unsafe fn as_mut(&self) -> &mut T {
        &mut *self.as_mut_ptr()
    }

    #[inline(never)]
    pub unsafe fn write_in_place(&self, func: impl FnOnce() -> T) {
        ptr::write(self.as_mut_ptr(), func())
    }

    pub unsafe fn drop_in_place(&self) {
        ptr::drop_in_place(self.as_mut_ptr())
    }
}

unsafe impl<T> Sync for UninitCell<T> {}

#[repr(transparent)]
pub struct SyncUnsafeCell<T> {
    value: UnsafeCell<T>,
}

unsafe impl<T: Sync> Sync for SyncUnsafeCell<T> {}

impl<T> SyncUnsafeCell<T> {
    #[inline]
    pub const fn new(value: T) -> Self {
        Self {
            value: UnsafeCell::new(value),
        }
    }

    pub unsafe fn set(&self, value: T) {
        *self.value.get() = value;
    }

    pub unsafe fn get(&self) -> T
    where
        T: Copy,
    {
        *self.value.get()
    }
}

```

### Core Architecture Module: `embassy-nrf/src/crypto/pka/cryptocell/engine.rs`
```
//! CryptoCell PKA engine.
//!
//! The PKA is a big-integer coprocessor with a dedicated SRAM holding 32 registers. An
//! operation is one opcode word. It names the two operand registers, the result register,
//! and one of eight operand sizes from the sizes table. The engine runs it over the whole
//! register width.
//!
//! Modular operations use Barrett reduction. They need the modulus in register `N` and its
//! Barrett tag in register `NP`.
//!
//! The register file is virtual. A mapping table gives the SRAM address of each register.
//! The engine reserves registers 30 and 31 as its own temporaries.
//!
//! This follows the PKA layer of Arm's CryptoCell runtime library (`pka.c`, `pki.c`).

use core::sync::atomic::{AtomicBool, Ordering};

use crate::crypto::pka::Error;
use crate::pac;
use crate::pac::cc_pka::vals::{ConstA, ConstB, DiscardR, Opcode, PkaDoneStatus};

/// Width of a PKA word, the operand width of the hardware multiplier.
///
/// Both CryptoCell-310 and CryptoCell-312 have a 64x16 multiplier. Registers are a multiple
/// of this, and so are the Barrett tags.
const PKA_WORD_BITS: usize = 64;

/// A PKA word in 32-bit words.
const PKA_WORD_WORDS: usize = PKA_WORD_BITS / 32;
/// Extra bits every register carries, so unreduced intermediate results fit.
const EXTRA_BITS: usize = 8;
/// Usable size of the PKA SRAM, in 32-bit words.
///
/// This bounds how many registers of a given size an operation can use.
const SRAM_WORDS: usize = 4 * 1024 / 4;
/// Mapping table entry for a register that is not in use.
const ADDR_UNUSED: u32 = 0xFFC;

/// Register holding the modulus.
pub(super) const REG_N: u8 = 0;
/// Register holding the Barrett tag of the modulus.
pub(super) const REG_NP: u8 = 1;
/// Engine temporaries.
pub(super) const REG_T0: u8 = 30;
/// Engine temporaries.
pub(super) const REG_T1: u8 = 31;
/// Number of registers in the file.
pub(super) const REG_COUNT: usize = 32;

/// Sizes-table entry holding the exact modulus size.
pub(super) const LEN_N: u8 = 0;
/// Sizes-table entry holding the modulus size rounded up by one whole PKA word.
pub(super) const LEN_FULL: u8 = 1;
/// Sizes-table entry holding the size of the CRT primes.
pub(super) const LEN_PQ: u8 = 2;
/// Sizes-table entry holding the full register size.
pub(super) const LEN_MAX: u8 = 7;

fn wait_done() {
    while pac::CC_PKA.pka_done().read().status() != PkaDoneStatus::Completed {}
}

fn wait_pipe() {
    while !pac::CC_PKA.pka_pipe().read().status() {}
}

/// Number of 32-bit words in the operation size `bits`, rounded up by one whole PKA word.
const fn full_op_size_pka_words(bits: usize) -> usize {
    bits / PKA_WORD_BITS + (bits % PKA_WORD_BITS > 0) as usize + 1
}

/// Sets one entry of the sizes table.
pub(super) fn set_len(id: u8, bits: u32) {
    wait_done();
    pac::CC_PKA.pka_l(id as usize).write(|w| w.set_op_size(bits as u16));
}

/// Reads one entry of the sizes table.
pub(super) fn get_len(id: u8) -> u32 {
    wait_done();
    pac::CC_PKA.pka_l(id as usize).read().op_size() as u32
}

/// Sets the sizes-table entry `id` to the exact size and `id + 1` to the rounded-up size.
pub(super) fn set_len_pair(id: u8, bits: u32) {
    set_len(id, bits);
    set_len(id + 1, (PKA_WORD_BITS * full_op_size_pka_words(bits as usize)) as u32);
}

fn set_map(vreg: u8, addr: u32) {
    wait_done();
    pac::CC_PKA
        .memory_map(vreg as usize)
        .write_value(pac::cc_pka::regs::MemoryMap(addr));
}

fn get_map(vreg: u8) -> u32 {
    wait_done();
    pac::CC_PKA.memory_map(vreg as usize).read().0
}

/// Issues one operation.
#[allow(clippy::too_many_arguments)]
fn exec(op: Opcode, len: u8, a_const: bool, a: u8, b_const: bool, b: u8, discard: bool, res: u8, tag: u8) {
    let mut w = pac::cc_pka::regs::Opcode(0);
    w.set_opcode(op);
    w.set_len(len);
    w.set_const_a(if a_const { ConstA::Constant } else { ConstA::Register });
    w.set_reg_a(a);
    w.set_const_b(if b_const { ConstB::Constant } else { ConstB::Register });
    w.set_reg_b(b);
    w.set_discard_r(if discard { DiscardR::Discard } else { DiscardR::Register });
    w.set_reg_r(res);
    w.set_tag(tag);
    wait_pipe();
    pac::CC_PKA.opcode().write_value(w);
}

macro_rules! op_rr {
    ($(#[$m:meta])* $name:ident, $op:ident) => {
        $(#[$m])*
        pub(super) fn $name(len: u8, res: u8, a: u8, b: u8) {
            exec(Opcode::$op, len, false, a, false, b, false, res, 0);
        }
    };
}

macro_rules! op_ri {
    ($(#[$m:meta])* $name:ident, $op:ident) => {
        $(#[$m])*
        pub(super) fn $name(len: u8, res: u8, a: u8, imm: u8) {
            exec(Opcode::$op, len, false, a, true, imm, false, res, 0);
        }
    };
}

op_rr!(
    /// `res = a + b`
    add,
    AddInc
);
op_ri!(
    /// `res = a + imm`
    add_im,
    AddInc
);
op_rr!(
    /// `res = a - b`
    sub,
    SubDecNeg
);
op_ri!(
    /// `res = a - imm`
    sub_im,
    SubDecNeg
);
op_rr!(
    /// `res = (a + b) mod n`
    mod_add,
    ModAddInc
);
op_ri!(
    /// `res = (a + imm) mod n`
    mod_add_im,
    ModAddInc
);
op_rr!(
    /// `res = (a - b) mod n`
    mod_sub,
    ModSubDecNeg
);
op_ri!(
    /// `res = a & imm`
    and_im,
    Andtst0clr0
);
op_ri!(
    /// `res = a | imm`
    or_im,
    Orcopyset0
);
/// `res = a >> (shift + 1)`, shifting in zeros.
///
/// The shift count goes in the second operand field, without the immediate flag.
pub(super) fn shr0(len: u8, res: u8, a: u8, shift: u8) {
    exec(Opcode::Shr0, len, false, a, false, shift, false, res, 0);
}
op_rr!(
    /// `res = low half of a * b`
    mul_low,
    MulLow
);
op_rr!(
    /// `res = a * b mod n`
    mod_mul,
    ModMul
);
op_rr!(
    /// `res = a * b mod n`, leaving up to eight extra bits unreduced
    mod_mul_nfr,
    ModMulN
);
op_rr!(
    /// `res = a ^ b mod n`
    mod_exp,
    ModExp
);
op_rr!(
    /// `res = floor(a / b)`, replacing `a` with the remainder
    div,
    Division
);

/// `res = c + a * b mod n`, leaving up to eight extra bits unreduced.
pub(super) fn mod_mul_acc_nfr(len: u8, res: u8, a: u8, b: u8, c: u8) {
    exec(Opcode::ModMlacnr, len, false, a, false, b, false, res, c);
}

/// `res = a`
pub(super) fn copy(len: u8, res: u8, a: u8) {
    or_im(len, res, a, 0);
}

/// `res = a`, reducing it below the modulus.
pub(super) fn reduce(len: u8, res: u8, a: u8) {
    exec(Opcode::Reduction, len, false, a, false, 0, false, res, 0);
}

/// `res = 1 / b mod n`, for an odd modulus.
pub(super) fn mod_inv(len: u8, res: u8, b: u8) {
    exec(Opcode::ModInv, len, true, 1, false, b, false, res, 0);
}

/// Zeroes a register.
pub(super) fn clear(len: u8, reg: u8) {
    and_im(len, reg, reg, 0);
}

/// Zeroes a register including the bits above the operation size.
pub(super) fn clear2(len: u8, reg: u8) {
    clear(len, reg);
    clear(len, reg);
}

/// Sets a register to a small constant.
pub(super) fn set_value(reg: u8, value: u8) {
    and_im(LEN_FULL, reg, reg, 0);
    or_im(LEN_FULL, reg, reg, value);
}

/// Returns whether the two registers hold the same value.
pub(super) fn equal(len: u8, a: u8, b: u8) -> bool {
    exec(Opcode::Xorflp0invcmp, len, false, a, false, b, true, 0, 0);
    alu_out_zero()
}

/// Returns whether a register holds `imm`.
pub(super) fn equal_im(len: u8, a: u8, imm: u8) -> bool {
    exec(Opcode::Xorflp0invcmp, len, false, a, true, imm, true, 0, 0);
    alu_out_zero()
}

/// `res = 1 / a mod n` by exponentiation, for a prime modulus.
///
/// Unlike [`mod_inv`] this runs in a time that does not depend on `a`. `tmp` is overwritten.
pub(super) fn mod_inv_exp(res: u8, a: u8, tmp: u8) {
    sub_im(LEN_FULL, tmp, REG_N, 2);
    mod_exp(LEN_N, res, a, tmp);
}

fn alu_out_zero() -> bool {
    wait_done();
    pac::CC_PKA.pka_status().read().alu_out_zero()
}

/// Number of 32-bit words in one register.
pub(super) fn reg_words() -> usize {
    (get_len(LEN_MAX) as usize).div_ceil(32)
}

/// Writes a big-endian value into a register, zeroing the rest of it.
pub(super) fn write_be(vreg: u8, data: &[u8]) {
    let total = reg_words();
    let addr = get_map(vreg);
    wait_done();
    pac::CC_PKA.pka_sram_waddr().write_value(addr);
    let mut left = data.len();
    let mut written = 0;
    while left > 0 && written < total {
        let n = left.min(4);
        let mut w = [0u8; 4];
        w[4 - n..].copy_from_slice(&data[left - n..left]);
        pac::CC_PKA.pka_sram_wdata().write_value(u32::from_be_bytes(w));
        left -= n;
        written += 1;
    }
    for _ in written..total {
        pac::CC_PKA.pka_sram_wdata().write_value(0);
    }
}

/// Reads a register into a big-endian buffer.
pub(super) fn read_be(vreg: u8, out: &mut [u8]) {
    let addr = get_map(vreg);
    wait_done();
    pac::CC_PKA.pka_sram_raddr().write_value(addr);
    let mut left = out.len();
    for _ in 0..out.len().div_ceil(4) {
        let v = pac::CC_PKA.pka_sram_rdata().read().to_be_bytes();
        let n = left.min(4);
        out[left - n..left].copy_from_slice(&v[4 - n..]);
        left -= n;
    }
}

/// Reads one 32-bit word of a register.
pub(super) fn read_word(vreg: u8, index: usize) -> u32 {
    let addr = get_map(vreg);
    wait_done();
    pac::CC_PKA.pka_sram_raddr().write_value(addr + index as u32);
    pac::CC_PKA.pka_sram_rdata().read()
}

/// Writes one 32-bit word of a register. The other words of the same PKA word must be zero.
///
/// A write is only committed once the whole PKA word is written, so this rewrites the other
/// words too.
pub(super) fn write_word(vreg: u8, index: usize, value: u32) {
    let addr = get_map(vreg);
    let base = index - index % PKA_WORD_WORDS;
    wait_done();
    pac::CC_PKA.pka_sram_waddr().write_value(addr + base as u32);
    for i in 0..PKA_WORD_WORDS {
        pac::CC_PKA
            .pka_sram_wdata()
            .write_value(if base + i == index { value } else { 0 });
    }
}

/// Zeroes a block of registers, including the engine temporaries.
pub(super) fn clear_regs(first: u8, count: usize) {
    let words = reg_words();
    for i in 0..count as u8 {
  
```

### Core Architecture Module: `embassy-nrf/src/util.rs`
```
#![allow(dead_code)]

const SRAM_LOWER: usize = 0x2000_0000;
const SRAM_UPPER: usize = 0x3000_0000;

/// Does this slice reside entirely within RAM?
pub(crate) fn slice_in_ram<T>(slice: *const [T]) -> bool {
    if slice.is_empty() {
        return true;
    }

    let ptr = slice as *const T as usize;
    ptr >= SRAM_LOWER && (ptr + slice.len() * core::mem::size_of::<T>()) < SRAM_UPPER
}

/// Return an error if slice is not in RAM. Skips check if slice is zero-length.
pub(crate) fn slice_in_ram_or<T, E>(slice: *const [T], err: E) -> Result<(), E> {
    if slice_in_ram(slice) { Ok(()) } else { Err(err) }
}

/// Compute the maximum value of an EasyDMA `MAXCNT`-style register field.
///
/// Writes all-ones through the PAC's (masking) field setter and reads the field
/// back, so the result is exactly the largest value the hardware field can hold.
#[cfg(not(feature = "_nrf51"))]
macro_rules! easy_dma_max {
    ($reg:path, $set:ident, $get:ident) => {{
        let mut r = $reg(0);
        r.$set(!0);
        r.$get() as usize
    }};
}
#[cfg(not(feature = "_nrf51"))]
pub(crate) use easy_dma_max;

/// Bounce buffer size used when data is not in RAM (e.g. in flash) and has to be copied
/// before the DMA can read it.
const BOUNCE_LEN: usize = 256;

/// Calls `f` for consecutive chunks of `data` of at most `max` bytes, with each chunk
/// guaranteed to be in RAM. `max` must be a multiple of 16.
///
/// Data that is not in RAM is copied through a stack buffer, in chunks of at most 256 bytes.
pub(crate) fn for_each_ram_chunk(data: &[u8], max: usize, mut f: impl FnMut(&[u8])) {
    if slice_in_ram(data) {
        for chunk in data.chunks(max) {
            f(chunk);
        }
    } else {
        bounce_chunks(data, max, &mut f);
    }
}

#[inline(never)]
fn bounce_chunks(data: &[u8], max: usize, f: &mut dyn FnMut(&[u8])) {
    let mut buf = [0u8; BOUNCE_LEN];
    for chunk in data.chunks(max.min(BOUNCE_LEN)) {
        buf[..chunk.len()].copy_from_slice(chunk);
        f(&buf[..chunk.len()]);
    }
}

/// Like [`for_each_ram_chunk`], for an input/output pair of buffers that may alias
/// (in-place processing).
///
/// `input` and `output` must both point to `len` bytes. `f` is called with
/// `(input, output, len)` pointer pairs to chunks, with the input chunk guaranteed to be in
/// RAM. The output chunk is always the original location.
///
/// # Safety
///
/// `input` must be readable and `output` writable for `len` bytes. If they overlap, they
/// must be equal.
pub(crate) unsafe fn for_each_ram_chunk_inout(
    input: *const u8,
    output: *mut u8,
    len: usize,
    max: usize,
    mut f: impl FnMut(*const u8, *mut u8, usize),
) {
    if slice_in_ram(core::ptr::slice_from_raw_parts(input, len)) {
        let mut done = 0;
        while done < len {
            let n = (len - done).min(max);
            f(input.wrapping_add(done), output.wrapping_add(done), n);
            done += n;
        }
    } else {
        unsafe { bounce_chunks_inout(input, output, len, max, &mut f) };
    }
}

#[inline(never)]
unsafe fn bounce_chunks_inout(
    input: *const u8,
    output: *mut u8,
    len: usize,
    max: usize,
    f: &mut dyn FnMut(*const u8, *mut u8, usize),
) {
    let mut buf = [0u8; BOUNCE_LEN];
    let max = max.min(BOUNCE_LEN);
    let mut done = 0;
    while done < len {
        let n = (len - done).min(max);
        unsafe { core::ptr::copy_nonoverlapping(input.wrapping_add(done), buf.as_mut_ptr(), n) };
        f(buf.as_ptr(), output.wrapping_add(done), n);
        done += n;
    }
}

```

### Core Architecture Module: `embassy-rp/src/multicore.rs`
```
//! Multicore support
//!
//! This module handles setup of the 2nd cpu core on the rp2040, which we refer to as core1.
//! It provides functionality for setting up the stack, and starting core1.
//!
//! The entrypoint for core1 can be any function that never returns, including closures.
//!
//! Enable the `critical-section-impl` feature in embassy-rp when sharing data across cores using
//! the `embassy-sync` primitives and `CriticalSectionRawMutex`.
//!
//! # Usage
//!
//! ```no_run
//! use embassy_rp::multicore::Stack;
//! use static_cell::StaticCell;
//! use embassy_executor::Executor;
//! use core::ptr::addr_of_mut;
//!
//! static mut CORE1_STACK: Stack<4096> = Stack::new();
//! static EXECUTOR0: StaticCell<Executor> = StaticCell::new();
//! static EXECUTOR1: StaticCell<Executor> = StaticCell::new();
//!
//! # // workaround weird error: `main` function not found in crate `rust_out`
//! # let _ = ();
//!
//! #[embassy_executor::task]
//! async fn core0_task() {
//!     // ...
//! }
//!
//! #[embassy_executor::task]
//! async fn core1_task() {
//!     // ...
//! }
//!
//! #[cortex_m_rt::entry]
//! fn main() -> ! {
//!     let p = embassy_rp::init(Default::default());
//!
//!     embassy_rp::multicore::spawn_core1(p.CORE1, unsafe { &mut *addr_of_mut!(CORE1_STACK) }, move || {
//!         let executor1 = EXECUTOR1.init(Executor::new());
//!         executor1.run(|spawner| spawner.spawn(core1_task().unwrap()));
//!     });
//!
//!     let executor0 = EXECUTOR0.init(Executor::new());
//!     executor0.run(|spawner| spawner.spawn(core0_task().unwrap()))
//! }
//! ```

use core::mem::ManuallyDrop;
use core::sync::atomic::{AtomicBool, Ordering, compiler_fence};

#[cfg(all(feature = "rt", any(feature = "rp2040", feature = "_rp235x")))]
use cortex_m::interrupt::InterruptNumber;
#[cfg(all(feature = "rt", any(feature = "rp2040", feature = "_rp235x")))]
use cortex_m::peripheral::NVIC;

use crate::interrupt::InterruptExt;
use crate::peripherals::CORE1;
use crate::{Peri, gpio, install_stack_guard, interrupt, pac};

const PAUSE_TOKEN: u32 = 0xDEADBEEF;
const RESUME_TOKEN: u32 = !0xDEADBEEF;
#[cfg(all(feature = "rt", any(feature = "rp2040", feature = "_rp235x")))]
pub(crate) const PEND_IRQ_TOKEN: u32 = 0xCAFE0000;

static IS_CORE1_INIT: AtomicBool = AtomicBool::new(false);

/// Represents a particular CPU core (SIO_CPUID)
#[derive(Debug, PartialEq, Eq, Clone, Copy, Hash)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
#[repr(u8)]
pub enum CoreId {
    /// Core 0
    Core0 = 0x0,
    /// Core 1
    Core1 = 0x1,
}

/// Gets which core we are currently executing from
pub fn current_core() -> CoreId {
    if pac::SIO.cpuid().read() == 0 {
        CoreId::Core0
    } else {
        CoreId::Core1
    }
}

#[inline(always)]
unsafe fn core1_setup(stack_bottom: *mut usize) {
    if install_stack_guard(stack_bottom).is_err() {
        // currently only happens if the MPU was already set up, which
        // would indicate that the core is already in use from outside
        // embassy, somehow. trap if so since we can't deal with that.
        cortex_m::asm::udf();
    }

    #[cfg(feature = "_rp235x")]
    crate::enable_actlr_extexclall();

    unsafe {
        gpio::init();
    }
}

/// Data type for a properly aligned stack of N bytes
#[repr(C, align(32))]
pub struct Stack<const SIZE: usize> {
    /// Memory to be used for the stack
    pub mem: [u8; SIZE],
}

impl<const SIZE: usize> Stack<SIZE> {
    /// Construct a stack of length SIZE, initialized to 0
    pub const fn new() -> Stack<SIZE> {
        Stack { mem: [0_u8; SIZE] }
    }
}

#[cfg(all(feature = "rt", any(feature = "rp2040", feature = "_rp235x")))]
#[derive(Clone, Copy)]
struct Irq(u16);
#[cfg(all(feature = "rt", any(feature = "rp2040", feature = "_rp235x")))]
unsafe impl InterruptNumber for Irq {
    fn number(self) -> u16 {
        self.0
    }
}

#[cfg(all(feature = "rt", feature = "rp2040"))]
#[interrupt]
unsafe fn SIO_IRQ_PROC1() {
    let sio = pac::SIO;
    // Clear IRQ
    sio.fifo().st().write(|w| w.set_wof(false));

    while sio.fifo().st().read().vld() {
        let fifo_read = fifo_read_wfe();
        if fifo_read == PAUSE_TOKEN {
            // Pause CORE1 execution and disable interrupts
            cortex_m::interrupt::disable();
            // Signal to CORE0 that execution is paused
            fifo_write(PAUSE_TOKEN);
            // Wait for `resume` signal from CORE0
            while fifo_read_wfe() != RESUME_TOKEN {
                cortex_m::asm::nop();
            }
            cortex_m::interrupt::enable();
            // Signal to CORE0 that execution is resumed
            fifo_write(RESUME_TOKEN);
        } else if fifo_read & 0xFFFF0000 == PEND_IRQ_TOKEN {
            // Pend the IRQ to wake up interrupt executors.
            let irq = Irq((fifo_read & 0xFFFF) as u16);
            NVIC::pend(irq);
        }
    }
}

#[cfg(all(feature = "rt", feature = "_rp235x"))]
#[interrupt]
unsafe fn SIO_IRQ_FIFO() {
    let sio = pac::SIO;
    // Clear IRQ
    sio.fifo().st().write(|w| w.set_wof(false));

    while sio.fifo().st().read().vld() {
        let fifo_read = fifo_read_wfe();
        if fifo_read == PAUSE_TOKEN {
            // Pause CORE1 execution and disable interrupts
            cortex_m::interrupt::disable();
            // Signal to CORE0 that execution is paused
            fifo_write(PAUSE_TOKEN);
            // Wait for `resume` signal from CORE0
            while fifo_read_wfe() != RESUME_TOKEN {
                cortex_m::asm::nop();
            }
            cortex_m::interrupt::enable();
            // Signal to CORE0 that execution is resumed
            fifo_write(RESUME_TOKEN);
        } else if fifo_read & 0xFFFF0000 == PEND_IRQ_TOKEN {
            // Pend the IRQ to wake up interrupt executors.
            let irq = Irq((fifo_read & 0xFFFF) as u16);
            let mut nvic: NVIC = core::mem::transmute(());
            nvic.request(irq);
        }
    }
}

/// Spawn a function on this core
pub fn spawn_core1<F, const SIZE: usize>(_core1: Peri<'static, CORE1>, stack: &'static mut Stack<SIZE>, entry: F)
where
    F: FnOnce() -> bad::Never + Send + 'static,
{
    // The first two ignored `u64` parameters are there to take up all of the registers,
    // which means that the rest of the arguments are taken from the stack,
    // where we're able to put them from core 0.
    extern "C" fn core1_startup<F: FnOnce() -> bad::Never>(
        _: u64,
        _: u64,
        entry: *mut ManuallyDrop<F>,
        stack_bottom: *mut usize,
    ) -> ! {
        unsafe { core1_setup(stack_bottom) };

        let entry = unsafe { ManuallyDrop::take(&mut *entry) };

        // make sure the preceding read doesn't get reordered past the following fifo write
        compiler_fence(Ordering::SeqCst);

        // Signal that it's safe for core 0 to get rid of the original value now.
        fifo_write(1);

        IS_CORE1_INIT.store(true, Ordering::Release);
        // Enable fifo interrupt on CORE1 for `pause` functionality.
        #[cfg(feature = "rp2040")]
        unsafe {
            interrupt::SIO_IRQ_PROC1.enable()
        };
        #[cfg(feature = "_rp235x")]
        unsafe {
            interrupt::SIO_IRQ_FIFO.enable()
        };

        // Enable FPU
        #[cfg(all(feature = "_rp235x", has_fpu))]
        unsafe {
            let p = cortex_m::Peripherals::steal();
            p.SCB.cpacr.modify(|cpacr| cpacr | (3 << 20) | (3 << 22));
        }

        entry()
    }

    // Reset the core
    let psm = pac::PSM;
    psm.frce_off().modify(|w| w.set_proc1(true));
    while !psm.frce_off().read().proc1() {
        cortex_m::asm::nop();
    }
    psm.frce_off().modify(|w| w.set_proc1(false));

    // The ARM AAPCS ABI requires 8-byte stack alignment.
    // #[align] on `struct Stack` ensures the bottom is aligned, but the top could still be
    // unaligned if the user chooses a stack size that's not multiple of 8.
    // So, we round down to the next multiple of 8.
    let stack_words = stack.mem.len() / 8 * 2;
    let mem = unsafe { core::slice::from_raw_parts_mut(stack.mem.as_mut_ptr() as *mut usize, stack_words) };

    // Set up the stack
    let mut stack_ptr = unsafe { mem.as_mut_ptr().add(mem.len()) };

    // We don't want to drop this, since it's getting moved to the other core.
    let mut entry = ManuallyDrop::new(entry);

    // Push the arguments to `core1_startup` onto the stack.
    unsafe {
        // Push `stack_bottom`.
        stack_ptr = stack_ptr.sub(1);
        stack_ptr.cast::<*mut usize>().write(mem.as_mut_ptr());

        // Push `entry`.
        stack_ptr = stack_ptr.sub(1);
        stack_ptr.cast::<*mut ManuallyDrop<F>>().write(&mut entry);
    }

    // Make sure the compiler does not reorder the stack writes after to after the
    // below FIFO writes, which would result in them not being seen by the second
    // core.
    //
    // From the compiler perspective, this doesn't guarantee that the second core
    // actually sees those writes. However, we know that the RP2040 doesn't have
    // memory caches, and writes happen in-order.
    compiler_fence(Ordering::Release);

    let p = unsafe { cortex_m::Peripherals::steal() };
    let vector_table = p.SCB.vtor.read();

    // After reset, core 1 is waiting to receive commands over FIFO.
    // This is the sequence to have it jump to some code.
    let cmd_seq = [
        0,
        0,
        1,
        vector_table as usize,
        stack_ptr as usize,
        core1_startup::<F> as *const () as usize,
    ];

    let mut seq = 0;
    let mut fails = 0;
    loop {
        let cmd = cmd_seq[seq] as u32;
        if cmd == 0 {
            fifo_drain();
            cortex_m::asm::sev();
        }
        fifo_write(cmd);

        let response = fifo_read();
        if cmd == response {
            seq += 1;
        } else {
            seq = 0;
            fails += 1;
            if fails > 16 {
                // The second core isn't responding, a
```

### Core Architecture Module: `embassy-stm32-wpan/src/net/util.rs`
```
//! Utils for the driver

use core::cell::RefCell;
use core::future::poll_fn;

use embassy_sync::blocking_mutex;
use embassy_sync::blocking_mutex::raw::NoopRawMutex;
use embassy_sync::signal::Signal;
use futures_util::FutureExt;

use crate::net::iface::ControllerToHostPacketBox;

pub struct ZeroCopyPubSub<B: ControllerToHostPacketBox> {
    event: blocking_mutex::Mutex<NoopRawMutex, RefCell<Option<Signal<NoopRawMutex, B>>>>,
}

impl<B: ControllerToHostPacketBox> ZeroCopyPubSub<B> {
    pub const fn new() -> Self {
        Self {
            event: blocking_mutex::Mutex::const_new(NoopRawMutex::new(), RefCell::new(None)),
        }
    }

    pub fn publish(&self, event: B) {
        if let Some(signal) = self.event.borrow().borrow_mut().as_ref() {
            signal.signal(event);
        }
    }

    pub fn subscribe<'a>(&'a self) -> Subscriber<'a, B> {
        Subscriber::new(&self.event)
    }
}

pub struct Subscriber<'a, B: ControllerToHostPacketBox> {
    event: &'a blocking_mutex::Mutex<NoopRawMutex, RefCell<Option<Signal<NoopRawMutex, B>>>>,
}

impl<'a, B: ControllerToHostPacketBox> Subscriber<'a, B> {
    fn new(event: &'a blocking_mutex::Mutex<NoopRawMutex, RefCell<Option<Signal<NoopRawMutex, B>>>>) -> Self {
        if event.borrow().borrow_mut().replace(Signal::new()).is_some() {
            panic!("ZeroCopyPubSub cannot have multiple subscribers ")
        }

        Self { event }
    }

    pub async fn wait(&self) -> B {
        poll_fn(|cx| self.event.borrow().borrow_mut().as_ref().unwrap().wait().poll_unpin(cx)).await
    }
}

impl<'a, B: ControllerToHostPacketBox> Drop for Subscriber<'a, B> {
    fn drop(&mut self) {
        self.event.borrow().borrow_mut().take();
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7183** (2026-10-06): **stm32/i2c: await STOPF after async DMA master writes**
  *Symptoms*: The async STM32 I2Cv2 DMA write path requests STOP after TC, then returns without waiting for it to complete. This can leave the bus busy and STOPF pending after `write().await` returns.  This change waits asynchronously for STOPF, clears it, and disables STOPIE on cancellation or timeout.  Tested on a NUCLEO-H753ZI using an I2C1-to-I2C2 loopback. Without the fix, the write returned before STOPF. With the fix, STOPF was observed and cleared before each write returned. The hardware test  is not included because it requires additional HIL fixture wiring. I can add it to this PR if desired, off by default in CI under the "disabled until wired" section.

- **Issue #7182** (2026-10-05): **labeler: allow checkout**
  *Symptoms*: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target

- **Issue #7181** (2026-10-06): **wpan: get fus working**
  *Symptoms*: confirmed on hardware

- **Issue #7180** (2026-10-05): **Allow SAI ringbuffer to be started (TX direction)**
  *Symptoms*: After recent changes in https://github.com/embassy-rs/embassy/pull/7159, SAI transmit was broken, because it could not be started.
  **Post-Mortem & Fix Analysis**:
  > CI on this pull request is failing, so it isn't in the [review queue](https://bot.embassy.dev) yet. A pull request needs passing CI to be queued for review — push a fix and it'll be added automatically.
  > Tested on STM32H723 SAI by the way. Previous changes (start empty) work fine.
  > Sorry, I should have noticed that it can't be started myself. :sweat_smile: On the other hand, since also some examples broke due to changes in #7159, I'm glad you took a look and fixed them. Thank you.

- **Issue #7179** (2026-10-05): **dfsdm: gate pin ownership on transceiver build**
  *Symptoms*: Stacked on #7177. The earlier DFSDM PRs in this series were bugfixes and API-guideline compliance; this is the main user-facing API change in the set, and it closes a leak in the pin model, so I separated it in the last PR-batch.  The pin model from the reservation work minted two reservations per slot and disclaimed the unused one at build time. A builder the caller never consumed kept its reservation until the driver dropped, so a pin that was declared but never used stayed in alternate-function mode for the whole lifetime of the instance. This makes `configure_pins` the ownership gate: transceivers are built inside a closure, and once it returns every slot is swept down to its live consumers, so "a configured instance drops every pin it isn't using" is literally true.  The per-slot `AtomicU8` refcount becomes two named flags (`owner`/`neighbor`) in a plain `RefCell`: a pin has 0, 1 or 2 consumers, and the flags record which require it present. There is no mint-2/disclaim dance and no underflow guard. `insert_pin` only stores the handle; marker-typed `claim`/`release` set and clear a consumer's flag and drop the `Flex` once neither is set; a `sweep` drops anything unrequired. The slots lose their critical section and atomics: they are only touched in the executor (the ISR only touches the SCD/CKAB armed caches), so `RefCell`'s `!Sync` is the honest marker and `Send` is preserved.  `configure_pins` now returns a split that can only be consumed through `build`: the cl
  **Post-Mortem & Fix Analysis**:
  > This pull request is a **draft**, so it isn't in the [review queue](https://bot.embassy.dev) yet. Mark it as **ready for review** when you'd like someone to look at it.

- **Issue #7178** (2026-10-05): **Fix C5 flash write getting stuck**
  *Symptoms*: Revert change from #6842, [see comment there](https://github.com/embassy-rs/embassy/pull/6842/changes#r4165872925)  Before ``` [...] 0.336242 [INFO ] Reading... (flash src/bin/flash.rs:33) 0.336303 [INFO ] Read after erase: [ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff] (flash src/bin/flash.rs:36) 0.336486 [INFO ] Writing... (flash src/bin/flash.rs:38) 0.336517 [TRACE] Writing 32 bytes at 0x8040000 (base=0x8040000, offset=0x0) (embassy_stm32 src/flash/common.rs:132) (stuck) ```  After fix ``` [...] 0.336273 [INFO ] Reading... (flash src/bin/flash.rs:33) 0.336334 [INFO ] Read after erase: [ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff, ff] (flash src/bin/flash.rs:36) 0.336517 [INFO ] Writing... (flash src/bin/flash.rs:38) 0.336547 [TRACE] Writing 32 bytes at 0x8040000 (base=0x8040000, offset=0x0) (embassy_stm32 src/flash/common.rs:132) 0.336730 [INFO ] Reading... (flash src/bin/flash.rs:41) 0.336761 [INFO ] Read: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, a, b, c, d, e, f, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 1a, 1b, 1c, 1d, 1e, 1f] (flash src/bin/flash.rs:44) 0.336975 [INFO ] Success! (flash src/bin/flash.rs:46) ```
  **Post-Mortem & Fix Analysis**:
  > cc @lennlouisgeek

- **Issue #7177** (2026-10-05): **dfsdm: cleanup and API polish**
  *Symptoms*: Follow-up pass over the DFSDM driver that landed recently, tightening the API surface and removing leftovers. It is almost entirely mechanical and compile verified; the only behavioral change is relaxing two over-strict panics (see below).  The DMA ring-buffer reads no longer require the caller's buffer to be exactly half the ring capacity. That constraint never existed: the shared ring buffer accepts any length, and the half/full DMA interrupts only bound wake granularity, not correctness. Every other ring-buffered reader in the crate (usart, spi, i2s, sai, adf, mdf, spdifrx) already accepts arbitrary lengths, and `blocking_read` additionally documented "at most `buf.len()`" while asserting the opposite. The example that used the half-capacity wording is updated to match.  The rest is an idiom pass against the API guidelines:  - Public traits are sealed with private supertraits instead of the module-level `sealed::Sealed` pattern. - The `capability` module is public so the bounds it appears in are nameable, and `Instance` is `Send`. - Result and event types derive `Debug` and `defmt::Format`; config `TryFrom` impls return the driver's `Error` instead of `()`. - `ResultRegular`/`ResultInjected`/`ResultExtreme` are renamed to `RegularResult`/`InjectedResult`/`ExtremeResult`. - A batch of method names is unified for consistency (for example `try_get_result` -> `try_read`, `set_channels` -> `set_armed`). - `Error::PeripheralError`, which has had no producer since the 
  **Post-Mortem & Fix Analysis**:
  > You can make larger prs with more stuff in them if you want
  > > You can make larger prs with more stuff in them if you want  I've bundled all cleanups here now and actual API-stuff in #7179. This concludes my review round I did this weekendso there's no more spam to be expected. 

- **Issue #7176** (2026-10-05): **cyw: small cleanup**
  *Symptoms*: use a named struct

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

### Incident Patch 1: `79e3deaf` (2026-10-06)
**Commit Message**: Merge pull request #7183 from Abrahamh08/fix/i2c-async-write-stopf

stm32/i2c: await STOPF after async DMA master writes

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ I2C:
 - fix: stm32/i2cv2: handle a master RESTART during async slave `respond_to_read` instead of stalling until the transaction times out
 - fix: stm32/i2cv2: re-enable TCIE after starting a DMA write group, so an async `transaction()` whose write group is not the first group completes instead of hanging until it times out
 - fix: stm32/i2cv2: program `CR2.SADD` without the 7-bit left shift when addressing a 10-bit target, which was putting every `Address::TenBit` on the bus one bit too far left and so addressing a different device
+- fix: stm32/i2cv2: wait asynchronously for STOPF and clear it before a DMA master write returns; disable STOPIE on cancellation.
 
 ADC:
 - feat: stm32/adc: add `VrefInt::calibrated_value()` for additional chips
```

**File**: `embassy-stm32/src/i2c/v2.rs` (modified, +15/-0)
```diff
@@ -959,6 +959,7 @@ impl<'d, IM: MasterMode> I2c<'d, Async, IM> {
                     w.set_txdmaen(false);
                 }
                 w.set_tcie(false);
+                w.set_stopie(false);
                 w.set_nackie(false);
                 w.set_errie(false);
             });
@@ -1051,6 +1052,20 @@ impl<'d, IM: MasterMode> I2c<'d, Async, IM> {
 
         if last_slice & send_stop {
             self.master_stop();
+            poll_fn(|cx| {
+                self.state.waker.register(cx.waker());
+
+                let regs = self.info.regs;
+                if regs.isr().read().stopf() {
+                    regs.icr().modify(|w| w.set_stopcf(true));
+                    return Poll::Ready(());
+                }
+
+                // The interrupt handler disables STOPIE when it wakes us.
+                regs.cr1().modify(|w| w.set_stopie(true));
+                Poll::Pending
+            })
+            .await;
         }
 
         drop(on_drop);
```

---

### Incident Patch 2: `5d57cc00` (2026-10-06)
**Commit Message**: tests: fix config.toml

**File**: `tests/stm32/.cargo/config.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
 
 [target.'cfg(all(target_arch = "arm", target_os = "none"))']
 runner = "teleprobe client run -s"
-#runner = "teleprobe local run --chip STM32H7S3L8Hx --elf"
+#runner = "teleprobe local run --chip STM32H7S3L8Hx"
 
 rustflags = [
   # Code-size optimizations.
@@ -24,4 +24,4 @@ target = "thumbv7em-none-eabi"
 #target = "thumbv8m.main-none-eabihf"
 
 [env]
-DEFMT_LOG = "trace,embassy_hal_internal=debug,embassy_net_esp_hosted=debug,xarxa=info,embedded-tls=info"
+DEFMT_LOG = "trace,embassy_hal_internal=debug,embassy_net_esp_hosted=debug,xarxa=info,embedded_tls=info"
```

---

### Incident Patch 3: `9ca5dd00` (2026-10-05)
**Commit Message**: fix: update examples

**File**: `embassy-stm32/src/sai/mod.rs` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ impl<'d, W: word::Word> Sai<'d, W> {
     /// Start the SAI driver.
     ///
     /// Starts the ring buffer for both directions. Transmitters must fill the ring buffer with
-    /// [[`Self::write`]] before starting.
+    /// [`Self::write`] before starting.
     pub fn start(&mut self) {
         match &mut self.ring_buffer {
             RingBuffer::Writable(rb) => {
```

**File**: `examples/stm32h5/src/bin/sai.rs` (modified, +5/-0)
```diff
@@ -95,6 +95,11 @@ async fn main(_spawner: Spawner) {
 
     info!("Test signal buffer prepared, starting playback loop");
 
+    // The SAI driver's `write` does not start the ring buffer automatically. The ring must
+    // be filled and started explicitly.
+    sai_a.write(&test_data).await.ok();
+    sai_a.start();
+
     loop {
         if let Err(e) = sai_a.write(&test_data).await {
             info!("SAI write error: {:?}", e);
```

**File**: `examples/stm32h7/src/bin/sai.rs` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ async fn main(_spawner: Spawner) {
 
     let mut sai_receiver = Sai::new_synchronous(sub_block_rx, p.PE3, p.DMA1_CH1, Irqs, rx_buffer, rx_config);
 
-    sai_receiver.start().unwrap();
+    sai_receiver.start();
 
     let mut buf = [0u32; HALF_DMA_BUFFER_LENGTH];
 
```

**File**: `examples/stm32wba6/src/bin/sdmmc_sai.rs` (modified, +21/-11)
```diff
@@ -115,17 +115,24 @@ fn parse_wav_header(buf: &[u8]) -> Option<WavInfo> {
     })
 }
 
-async fn write_samples(sai_tx: &mut Sai<'static, u16>, samples: &[u16]) {
+async fn write_samples(sai_tx: &mut Sai<'static, u16>, started: &mut bool, samples: &[u16]) {
     if samples.is_empty() {
         return;
     }
-    if let Err(e) = sai_tx.write(samples).await {
-        warn!("SAI write error: {:?}", defmt::Debug2Format(&e));
+    // The SAI driver's `write` does not start the ring buffer; the first (whole-admitted)
+    // block fills it before `start`, after which writes append behind the playhead.
+    if !*started {
+        sai_tx.write(samples).await.ok();
+        sai_tx.start();
+        *started = true;
+    } else if let Err(e) = sai_tx.write(samples).await {
+        warn!("SAI write error: {:?}", e);
     }
 }
 
 async fn play_pcm<D, T, const MAX_DIRS: usize, const MAX_FILES: usize, const MAX_VOLUMES: usize>(
     sai_tx: &mut Sai<'static, u16>,
+    started: &mut bool,
     volume_mgr: &mut VolumeManager<D, T, MAX_DIRS, MAX_FILES, MAX_VOLUMES>,
     file: RawFile,
 ) where
@@ -158,12 +165,13 @@ async fn play_pcm<D, T, const MAX_DIRS: usize, const MAX_FILES: usize, const MAX
             i += 2;
         }
 
-        write_samples(sai_tx, &out[..count]).await;
+        write_samples(sai_tx, started, &out[..count]).await;
     }
 }
 
 async fn play_wav<D, T, const MAX_DIRS: usize, const MAX_FILES: usize, const MAX_VOLUMES: usize>(
     sai_tx: &mut Sai<'static, u16>,
+    started: &mut bool,
     volume_mgr: &mut VolumeManager<D, T, MAX_DIRS, MAX_FILES, MAX_VOLUMES>,
     file: RawFile,
 ) where
@@ -227,7 +235,7 @@ async fn play_wav<D, T, const MAX_DIRS: usize, const MAX_FILES: usize, const MAX
             count += 1;
             i += 2;
         }
-        write_samples(sai_tx, &out[..count]).await;
+        write_samples(sai_tx, started, &out[..count]).await;
     }
 
     loop {
@@ -252,7 +260,7 @@ async fn play_wav<D, T, const MAX_DIRS: usize, const MAX_FILES: usize, const MAX
             i += 2;
         }
 
-        write_samples(sai_tx, &out[..count]).await;
+        write_samples(sai_tx, started, &out[..count]).await;
     }
 }
 
@@ -263,7 +271,7 @@ bind_interrupts!(struct Irqs {
 });
 
 #[embassy_executor::main]
-async fn main(spawner: Spawner) {
+async fn main(_spawner: Spawner) {
     let mut config = Config::default();
     {
         use embassy_stm32::rcc::*;
@@ -308,6 +316,10 @@ async fn main(spawner: Spawner) {
 
     let mut sai_tx = Sai::new_asynchronous(sai_a, p.PA7, p.PB14, p.PA8, p.GPDMA1_CH2, Irqs, sai_dma_buf, sai_cfg);
 
+    // Tracks whether the SAI ring has been filled and started (its `write` does not
+    // start the ring buffer automatically).
+    let mut started = false;
+
     let _max98357a_sd = Output::new(p.PA1, Level::High, Speed::Low);
 
     let mut spi_cfg = spi::Config::default();
@@ -376,12 +388,10 @@ async fn main(spawner: Spawner) {
 
     let raw_file = file;
     if name.extension() == b"PCM" {
-        play_pcm(&mut sai_tx, vol_mgr, raw_file).await;
+        play_pcm(&mut sai_tx, &mut started, vol_mgr, raw_file).await;
     } else {
-        play_wav(&mut sai_tx, vol_mgr, raw_file).await;
+        play_wav(&mut sai_tx, &mut started, vol_mgr, raw_file).await;
     }
 
     let _ = vol_mgr.close_file(file);
-
-    let _ = spawner;
 }
```

---

### Incident Patch 4: `45cda6f3` (2026-10-05)
**Commit Message**: Merge pull request #7178 from usbalbin/fix-flash-write

Fix C5 flash write getting stuck

**File**: `embassy-stm32/src/flash/c5.rs` (modified, +5/-1)
```diff
@@ -260,7 +260,7 @@ unsafe fn blocking_wait_ready() -> Result<(), Error> {
     loop {
         let sr = pac::FLASH.sr().read();
 
-        if !sr_busy(sr) {
+        if !sr.bsy() {
             if sr.optchangeerr() {
                 error!("optchangeerr");
                 return Err(Error::Prog);
@@ -336,6 +336,10 @@ pub fn perform_bank_swap() {
 
 fn sr_busy(sr: Sr) -> bool {
     // Flash is ready only when BSY, DBNE, and WBNE are all cleared.
+    //
+    // The exception being during a write operation where WBNE will
+    // be set until the entire WRITE_SIZE is written.
+    //
     // See RM0522, "Monitoring ongoing write operations".
     sr.bsy() || sr.dbne() || sr.wbne() == vals::Wbne::B0x1
 }
```

---

### Incident Patch 5: `71436715` (2026-10-05)
**Commit Message**: Merge pull request #7179 from M3gaFr3ak/fix/dfsdm-pin-gate

dfsdm: gate pin ownership on transceiver build

**File**: `embassy-stm32/src/dfsdm/codegen.rs` (modified, +151/-33)
```diff
@@ -68,21 +68,21 @@ pub fn parse(block: &str) -> Option<Shape> {
 /// Channel count -> transceiver capability ident.
 pub fn tcv(ch: u8) -> &'static str {
     match ch {
-        2 => "Tcv2",
-        4 => "Tcv4",
-        8 => "Tcv8",
+        2 => "TcvCnt2",
+        4 => "TcvCnt4",
+        8 => "TcvCnt8",
         _ => unreachable!("invalid DFSDM channel count: {}", ch),
     }
 }
 
 /// Filter count -> filter capability ident.
 pub fn flt(f: u8) -> &'static str {
     match f {
-        1 => "Flt1",
-        2 => "Flt2",
-        4 => "Flt4",
-        6 => "Flt6",
-        8 => "Flt8",
+        1 => "FltCnt1",
+        2 => "FltCnt2",
+        4 => "FltCnt4",
+        6 => "FltCnt6",
+        8 => "FltCnt8",
         _ => unreachable!("invalid DFSDM filter count: {}", f),
     }
 }
@@ -95,6 +95,9 @@ pub const SHAPES: &[(u8, u8)] = &[(2, 1), (4, 2), (4, 4), (8, 4), (8, 6), (8, 8)
 // On 3-bit-JEXTSEL parts the `DFSDM1_JTRGn` channel number is *not* the
 // register value; the valid channels are compressed into 0..7 per filter.
 // Each row is `(filter index, jtrg channel number, jextsel)`.
+//
+// Hand-transcribed and verified against RM0410 Table 110, RM0402 Table 86
+// and RM0430 Table 89.
 pub const DFSDM_TRG3_JEXTSEL: &[(u8, u8, u8)] = &[
     (0, 0, 0),
     (0, 1, 1),
@@ -161,13 +164,22 @@ pub fn gen_instance(inst: &str, block: &str) -> TokenStream {
     };
 
     if shape.dly {
-        ts.extend(quote! { impl crate::dfsdm::capability::HasDelay for crate::peripherals::#inst {} });
+        ts.extend(quote! {
+            impl crate::dfsdm::capability::SealedHasDelay for crate::peripherals::#inst {}
+            impl crate::dfsdm::capability::HasDelay for crate::peripherals::#inst {}
+        });
     }
     if shape.hwid {
-        ts.extend(quote! { impl crate::dfsdm::capability::HasHwid for crate::peripherals::#inst {} });
+        ts.extend(quote! {
+            impl crate::dfsdm::capability::SealedHasHwid for crate::peripherals::#inst {}
+            impl crate::dfsdm::capability::HasHwid for crate::peripherals::#inst {}
+        });
     }
     if shape.adc {
-        ts.extend(quote! { impl crate::dfsdm::capability::AdcInput for crate::peripherals::#inst {} });
+        ts.extend(quote! {
+            impl crate::dfsdm::capability::SealedAdcInput for crate::peripherals::#inst {}
+            impl crate::dfsdm::capability::AdcInput for crate::peripherals::#inst {}
+        });
     }
 
     ts
@@ -187,6 +199,9 @@ pub fn gen_trigger_source(inst: &str, block: &str, source: &Ident, idx: u8) -> T
         // 5-bit JEXTSEL: the signal number *is* the JEXTSEL value, and every
         // source can drive every filter.
         quote! {
+            impl<M: crate::dfsdm::FilterMarker> crate::dfsdm::SealedTriggerSource<crate::peripherals::#inst, M>
+                for crate::triggers::#source {
+            }
             impl<M: crate::dfsdm::FilterMarker> crate::dfsdm::TriggerSource<crate::peripherals::#inst, M>
                 for crate::triggers::#source {
                 fn jextsel(&self) -> u8 { #idx }
@@ -200,6 +215,9 @@ pub fn gen_trigger_source(inst: &str, block: &str, source: &Ident, idx: u8) -> T
             .map(|&(flt, _, jextsel)| {
                 let flt = format_ident!("Flt{}", flt);
                 quote! {
+                    impl crate::dfsdm::SealedTriggerSource<crate::peripherals::#inst, crate::dfsdm::#flt>
+                        for crate::triggers::#source {
+                    }
                     impl crate::dfsdm::TriggerSource<crate::peripherals::#inst, crate::dfsdm::#flt>
                         for crate::triggers::#source {
                         fn jextsel(&self) -> u8 { #jextsel }
@@ -240,6 +258,7 @@ fn gen_split(ch: u8, flt_n: u8) -> TokenStream {
     let name = format_ident!("DfsdmSplit{}Ch{}Flt", ch, flt_count);
     let ready = format_ident!("Flt{}Ready", flt_count);
     let tcv_trait = format_ident!("Tcv{}SplitBuild", ch);
+    let sealed_tcv_trait = format_ident!("SealedTcv{}SplitBuild", ch);
     let tcv_cap = format_ident!("{}", tcv(ch as u8));
     let flt_cap = format_ident!("{}", flt(flt_count as u8));
 
@@ -249,20 +268,78 @@ fn gen_split(ch: u8, flt_n: u8) -> TokenStream {
     let flt_idents: Vec<Ident> = (0..flt_count).map(|i| format_ident!("flt{}", i)).collect();
     let flt_markers: Vec<Ident> = (0..flt_count).map(|i| format_ident!("Flt{}", i)).collect();
 
-    let struct_channels = (0..ch).map(|i| {
-        let c = &ch_idents[i];
-        let t = &tcv_idents[i];
-        let own = &s[i];
-        let neighbor = &s[(i + 1) % ch];
-        let doc = format!("Builder for [`crate::dfsdm::Transceiver`] {}.", i);
-        quote! { #[doc = #doc] pub #c: crate::dfsdm::TransceiverBuilder<T, crate::dfsdm::#t, C, #own, #neighbor>, }
-    });
-    let struct_filters = (0..flt_count).map(|i| {
-        let f = &flt_idents[i];
-        let m = &flt_markers[i];
-        let doc = format!("Builder for [`crate::dfsdm::Filter`] {}.", i);
-      
```

**File**: `embassy-stm32/src/dfsdm/config.rs` (modified, +24/-16)
```diff
@@ -129,14 +129,14 @@ impl CkoutDivider {
 }
 
 impl TryFrom<u16> for CkoutDivider {
-    type Error = ();
+    type Error = Error;
 
     /// Try to create from the actual divider value (2..=256).
     fn try_from(divider: u16) -> Result<Self, Self::Error> {
         if (2..=256).contains(&divider) {
             Ok(Self((divider - 1) as u8))
         } else {
-            Err(())
+            Err(Error::InvalidConfig)
         }
     }
 }
@@ -157,9 +157,9 @@ impl AwdFilterOsr {
     /// Create from the actual OSR value (2..=32).
     /// Panics if out of range.
     /// For a non-panicking variant, use [`AwdFilterOsr::try_from`].
-    pub fn new(divider: u16) -> Self {
-        assert!((2..=32).contains(&divider), "OSR must be 2..=32");
-        Self((divider - 1) as u8)
+    pub fn new(osr: u16) -> Self {
+        assert!((2..=32).contains(&osr), "OSR must be 2..=32");
+        Self((osr - 1) as u8)
     }
 
     /// Watchdog filter bypassed (register value 0).
@@ -172,14 +172,14 @@ impl AwdFilterOsr {
 }
 
 impl TryFrom<u16> for AwdFilterOsr {
-    type Error = ();
+    type Error = Error;
 
     /// Try to create from the actual OSR value (2..=32).
     fn try_from(divider: u16) -> Result<Self, Self::Error> {
         if (2..=32).contains(&divider) {
             Ok(Self((divider - 1) as u8))
         } else {
-            Err(())
+            Err(Error::InvalidConfig)
         }
     }
 }
@@ -332,9 +332,13 @@ impl DataRightShift {
 }
 
 impl TryFrom<u8> for DataRightShift {
-    type Error = ();
+    type Error = Error;
     fn try_from(shift: u8) -> Result<Self, Self::Error> {
-        if shift <= 31 { Ok(Self(shift)) } else { Err(()) }
+        if shift <= 31 {
+            Ok(Self(shift))
+        } else {
+            Err(Error::InvalidConfig)
+        }
     }
 }
 
@@ -364,9 +368,13 @@ impl PulsesToSkip {
 }
 
 impl TryFrom<u8> for PulsesToSkip {
-    type Error = ();
+    type Error = Error;
     fn try_from(pulses: u8) -> Result<Self, Self::Error> {
-        if pulses <= 63 { Ok(Self(pulses)) } else { Err(()) }
+        if pulses <= 63 {
+            Ok(Self(pulses))
+        } else {
+            Err(Error::InvalidConfig)
+        }
     }
 }
 
@@ -524,7 +532,7 @@ const MAX_GAIN_SERIAL: u128 = i32::MAX.unsigned_abs() as u128;
 /// the 1-bit serial case. This linear model is an approximation for the
 /// parallel (16-bit) case - verify against TRM before
 /// trusting it in a headroom-critical design; use
-/// [`FilterParameters::new_ignore_gain_ceiling`] if you've verified your
+/// [`FilterParameters::try_new_ignore_gain_ceiling`] if you've verified your
 /// own headroom instead.
 const fn max_gain(width: InputWidth) -> u128 {
     MAX_GAIN_SERIAL >> (width.bits() - 1)
@@ -680,7 +688,7 @@ impl FilterParameters {
     /// Returns [`Error::InvalidFilterParameters`] if `iosr` is outside
     /// `1..=256`, the filter order's FOSR is outside `1..=1024`, or the gain
     /// computation itself overflows `u128`.
-    pub fn new_ignore_gain_ceiling(order: FilterOrder, iosr: u16) -> Result<Self, Error> {
+    pub fn try_new_ignore_gain_ceiling(order: FilterOrder, iosr: u16) -> Result<Self, Error> {
         if (1..=256).contains(&iosr) && (1..=1024).contains(&order.fosr()) && order.valid() {
             Ok(Self {
                 order,
@@ -711,7 +719,7 @@ impl FilterParameters {
     /// `new`/`try_new`/`new_for_width`/`try_new_for_width`, since they
     /// already require this to succeed at construction. May be `None`'s
     /// logical inverse (i.e. always computable) for
-    /// `new_ignore_gain_ceiling` instances, since those skip the ceiling -
+    /// `try_new_ignore_gain_ceiling` instances, since those skip the ceiling -
     /// this method still reports the ceiling-checked view for them, which
     /// is why [`total_gain`]/[`total_gain_wide`] exist as the ceiling-free
     /// accessors.
@@ -729,7 +737,7 @@ impl FilterParameters {
     /// `try_new_for_width`, the gain is guaranteed `<= i32::MAX`-derived
     /// ceiling and this never truncates.
     ///
-    /// For instances built via [`FilterParameters::new_ignore_gain_ceiling`],
+    /// For instances built via [`FilterParameters::try_new_ignore_gain_ceiling`],
     /// the true gain may exceed `u32::MAX` and this value silently
     /// truncates (`as u32`) - use [`FilterParameters::total_gain_wide`]
     /// instead in that case.
@@ -740,7 +748,7 @@ impl FilterParameters {
     /// Returns the total gain of this filter parametrization as a lossless
     /// `u128`, regardless of how the instance was constructed. Prefer this
     /// over [`FilterParameters::total_gain`] for instances built via
-    /// [`FilterParameters::new_ignore_gain_ceiling`].
+    /// [`FilterParameters::try_new_ignore_gain_ceiling`].
     pub fn total_gain_wide(&self) -> u128 {
         // Safe to unwrap: `order.gain()` only returns `None` on arithmetic
         // overflow, which both constructor paths already reject at
```

**File**: `embassy-stm32/src/dfsdm/detector.rs` (modified, +93/-103)
```diff
@@ -90,6 +90,8 @@ fn encode_threshold(threshold: i32) -> u32 {
 }
 
 /// Analog watchdog event.
+#[derive(Debug)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
 pub enum AnalogWatchdogEvent {
     /// High threshold exceeded
     HighThreshold {
@@ -131,32 +133,32 @@ where
     /// Wait for an analog watchdog event.
     pub async fn wait_for_event(&mut self) -> AnalogWatchdogEvent {
         poll_fn(|cx| {
-            Self::set_interrupt_enable(false);
+            Self::set_irq(false);
             T::state().watchdog_waker.register(cx.waker());
 
-            let high = Self::high_channels();
-            let low = Self::low_channels();
+            let high = Self::flags_high_raw();
+            let low = Self::flags_low_raw();
 
             if high != 0 {
-                Self::clear_high(high);
+                Self::clear_high_raw(high);
                 return Poll::Ready(AnalogWatchdogEvent::HighThreshold { transceivers: high });
             }
             if low != 0 {
-                Self::clear_low(low);
+                Self::clear_low_raw(low);
                 return Poll::Ready(AnalogWatchdogEvent::LowThreshold { transceivers: low });
             }
 
-            Self::set_interrupt_enable(true);
+            Self::set_irq(true);
             Poll::Pending
         })
         .await
     }
 
     /// Apply a full configuration.
     pub fn configure(&mut self, config: AnalogWatchdogConfig) {
-        self.enable_analog_watchdog_fastmode(config.fastmode);
-        self.assign_low_to_break_signals(config.low_break_signals);
-        self.assign_high_to_break_signals(config.high_break_signals);
+        self.enable_fastmode(config.fastmode);
+        self.assign_low_breaks(config.low_break_signals);
+        self.assign_high_breaks(config.high_break_signals);
         self.set_low_threshold(config.low_threshold);
         self.set_high_threshold(config.high_threshold);
     }
@@ -166,7 +168,7 @@ where
     /// Thresholds are on the 24-bit main-filter scale in both AWFSEL modes
     /// and saturate to the i24 range: `0x7F_FFFF` / `-0x80_0000` (or any
     /// out-of-range value) mean "never trigger". With fast mode enabled
-    /// (see [`enable_analog_watchdog_fastmode`](Self::enable_analog_watchdog_fastmode))
+    /// (see [`enable_fastmode`](Self::enable_fastmode))
     /// the hardware compares only the top 16 threshold bits against the
     /// watchdog filter output (resolution 256); toggling fast mode does not
     /// change the meaning of a stored threshold.
@@ -193,7 +195,7 @@ where
     /// # Note
     /// This routes a watchdog event to a DFSDM break wire (BKAWH); the
     /// receiving timer must separately map that wire to a break input (BRK).
-    pub fn assign_high_to_break_signals(&mut self, break_signals: config::BreakSignals) {
+    pub fn assign_high_breaks(&mut self, break_signals: config::BreakSignals) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awhtr()
@@ -205,7 +207,7 @@ where
     /// # Note
     /// This routes a watchdog event to a DFSDM break wire (BKAWL); the
     /// receiving timer must separately map that wire to a break input (BRK).
-    pub fn assign_low_to_break_signals(&mut self, break_signals: config::BreakSignals) {
+    pub fn assign_low_breaks(&mut self, break_signals: config::BreakSignals) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awltr()
@@ -223,7 +225,7 @@ where
     /// [`set_high_threshold`](Self::set_high_threshold)): toggling this
     /// changes the comparison source and its resolution, not the meaning of
     /// already-written thresholds.
-    pub fn enable_analog_watchdog_fastmode(&mut self, enabled: bool) {
+    pub fn enable_fastmode(&mut self, enabled: bool) {
         T::regs()
             .flt(M::CHANNEL.index())
             .cr1()
@@ -236,9 +238,8 @@ where
         // No borrow lifetime here as watchdog events are not awaited when the transceiver is off.
         // They're "errors", not results that waiting for might stall your program.
         transceivers: [&dyn TransceiverTrait<T, Enabled>; N],
-    ) where
-        [(); N]: NonEmpty,
-    {
+    ) {
+        const { core::assert!(N > 0, "at least one element is required") };
         let filterword = filterword_of(&transceivers);
 
         // thread-only writes, but full-register RMW on CR2 competes with the ISR's IE RMW - same cs discipline.
@@ -251,47 +252,47 @@ where
     }
 
     /// Whether the low-threshold flag is set for `channel`.
-    pub fn channel_flag_low(&self, channel: TransceiverChannel) -> bool {
+    pub fn flag_low(&self, channel: TransceiverChannel) -> bool {
         self.flags_low().get_bit(channel.index())
     }
 
     /// Whether the high-threshold flag is set for `channel`.
-    pub fn channel_flag_high(&self, channel: TransceiverChannel) -> bool {
+    pub fn flag_high(&self, channel: TransceiverChannel) -> bool {
         self.flags_high().get_bit(channel.index())
     }
 
   
```

**File**: `embassy-stm32/src/dfsdm/dma.rs` (modified, +18/-28)
```diff
@@ -18,8 +18,8 @@ use crate::rcc::WakeGuard;
 /// in scan mode: it identifies which transceiver produced each word. The buffer
 /// is 32-bit words only.
 ///
-/// Decode each word with [`ResultRegular::from_word`] or
-/// [`ResultInjected::from_word`]; use [`FilterRegular::read`] for
+/// Decode each word with [`RegularResult::from_word`] or
+/// [`InjectedResult::from_word`]; use [`FilterRegular::read`] for
 /// already-decoded, sign-extended results.
 ///
 /// # Note
@@ -48,7 +48,7 @@ where
         irq: impl Binding<D::Interrupt, crate::dma::InterruptHandler<D>> + 'e,
         dma_buf: &'e mut [u32],
     ) -> RingBufferedFilter<'e, T, M, RegDma> {
-        let mut buf = RingBufferedFilter::<T, M, RegDma>::new_int(self, dma, irq, dma_buf);
+        let mut buf = RingBufferedFilter::<T, M, RegDma>::new_inner(self, dma, irq, dma_buf);
         buf.ring_buf.set_alignment(1);
         buf
     }
@@ -66,26 +66,25 @@ where
         irq: impl Binding<D::Interrupt, crate::dma::InterruptHandler<D>> + 'e,
         dma_buf: &'e mut [u32],
     ) -> RingBufferedFilter<'e, T, M, InjDma> {
-        let alignment = self.popcnt();
-        let mut buf = RingBufferedFilter::<T, M, InjDma>::new_int(self, dma, irq, dma_buf);
+        let alignment = self.assigned_count();
+        let mut buf = RingBufferedFilter::<T, M, InjDma>::new_inner(self, dma, irq, dma_buf);
         buf.ring_buf.set_alignment(alignment);
         buf
     }
 
     /// Returns number of assigned transceivers in the injected group.
-    fn popcnt(&self) -> usize {
+    fn assigned_count(&self) -> usize {
         let bitmask = T::regs().flt(M::CHANNEL.index()).jchgr().read().jchg();
         bitmask.count_ones() as usize
     }
 }
 
-#[allow(private_bounds)]
 impl<'e, T, M, DM: DmaMode> RingBufferedFilter<'e, T, M, DM>
 where
     T: Instance + FilterInterrupt<M>,
     M: FilterMarker + InstanceEvents<T>,
 {
-    fn new_int<D: Dma<T, M>, DMODE: DmaMode>(
+    fn new_inner<D: Dma<T, M>, DMODE: DmaMode>(
         filter: &'e mut dyn FilterDma<T, M>,
         dma: Peri<'e, D>,
         irq: impl Binding<D::Interrupt, crate::dma::InterruptHandler<D>> + 'e,
@@ -150,49 +149,40 @@ where
     /// returns the number of samples written into `buf`.
     ///
     /// `buf` receives raw `u32` data-register words; decode each with
-    /// [`ResultRegular::from_word`] or [`ResultInjected::from_word`].
+    /// [`RegularResult::from_word`] or [`InjectedResult::from_word`].
     pub fn read_latest(&mut self, buf: &mut [u32]) -> Result<usize, Error> {
         self.autostart()?;
 
         Ok(self.ring_buf.read_latest(buf))
     }
 
-    /// Asynchronously read `buf.len()` samples. `buf.len()` must equal half of
-    /// [`capacity`](Self::capacity), or this panics. Starts the DMA if needed;
-    /// returns [`Error::Overrun`] if the buffer overran.
+    /// Asynchronously read `buf.len()` samples, starting the DMA if needed.
+    /// Returns [`Error::Overrun`] if the buffer overran.
     ///
     /// `buf` receives raw `u32` data-register words; decode each with
-    /// [`ResultRegular::from_word`] or [`ResultInjected::from_word`].
+    /// [`RegularResult::from_word`] or [`InjectedResult::from_word`].
+    ///
+    /// Any `buf` length is accepted. The DMA only raises an interrupt at the
+    /// buffer half and full points, so unless `buf.len()` is a multiple of
+    /// half the ring, the final sample may arrive up to half a ring late; that
+    /// is a wake granularity / latency effect, not a correctness constraint.
     ///
     /// # Note
     /// Like [`FilterRegular::read`], this hangs forever if the filter is
     /// starved; see that method for the layered starvation detection.
     pub async fn read(&mut self, buf: &mut [u32]) -> Result<usize, Error> {
-        assert_eq!(
-            self.ring_buf.capacity() / 2,
-            buf.len(),
-            "Buffer size must be half the size of the ring buffer"
-        );
-
         self.autostart()?;
 
         self.ring_buf.read_exact(buf).await.map_err(remap_dma_error)
     }
 
     /// Blocking counterpart of [`read`](Self::read): waits until at least one
     /// sample is available, then returns whatever is currently ready (at most
-    /// `buf.len()`, which must equal half of
-    /// [`capacity`](Self::capacity)). Returns [`Error::Overrun`] if the buffer
-    /// overran.
+    /// `buf.len()`). Any `buf` length is accepted. Returns [`Error::Overrun`]
+    /// if the buffer overran.
     ///
     /// Like [`read`](Self::read), this never returns if the filter is starved.
     pub fn blocking_read(&mut self, buf: &mut [u32]) -> Result<usize, Error> {
-        assert_eq!(
-            self.ring_buf.capacity() / 2,
-            buf.len(),
-            "Buffer size must be half the size of the ring buffer"
-        );
-
         self.autostart()?;
 
         loop {
```

**File**: `embassy-stm32/src/dfsdm/filter.rs` (modified, +206/-153)
```diff
@@ -154,11 +154,9 @@ where
         regular: &'tr dyn TransceiverTrait<T, Enabled>,
         injected: [&'ti dyn TransceiverTrait<T, Enabled>; N],
         config: &FilterConfig<T, M>,
-    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, NoDma>
-    where
-        [(); N]: NonEmpty,
-    {
-        self.enable_int(regular, injected, config)
+    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, NoDma> {
+        const { core::assert!(N > 0, "at least one element is required") };
+        self.enable_inner(regular, injected, config)
     }
 
     /// Enable the filter and set the regular-conversion DMA request flag (RDMAEN).
@@ -167,11 +165,9 @@ where
         regular: &'tr dyn TransceiverTrait<T, Enabled>,
         injected: [&'ti dyn TransceiverTrait<T, Enabled>; N],
         config: &FilterConfig<T, M>,
-    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, RegDma>
-    where
-        [(); N]: NonEmpty,
-    {
-        self.enable_int(regular, injected, config)
+    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, RegDma> {
+        const { core::assert!(N > 0, "at least one element is required") };
+        self.enable_inner(regular, injected, config)
     }
 
     /// Enable the filter and set the injected-conversion DMA request flag (JDMAEN).
@@ -180,23 +176,21 @@ where
         regular: &'tr dyn TransceiverTrait<T, Enabled>,
         injected: [&'ti dyn TransceiverTrait<T, Enabled>; N],
         config: &FilterConfig<T, M>,
-    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, InjDma>
-    where
-        [(); N]: NonEmpty,
-    {
-        self.enable_int(regular, injected, config)
+    ) -> Filter<'tr, 'ti, 'a, 'd, T, M, InjDma> {
+        const { core::assert!(N > 0, "at least one element is required") };
+        self.enable_inner(regular, injected, config)
     }
 
-    fn enable_int<'tr, 'ti, const N: usize, D>(
+    fn enable_inner<'tr, 'ti, const N: usize, D>(
         self,
         regular: &'tr dyn TransceiverTrait<T, Enabled>,
         injected: [&'ti dyn TransceiverTrait<T, Enabled>; N],
         config: &FilterConfig<T, M>,
     ) -> Filter<'tr, 'ti, 'a, 'd, T, M, D>
     where
         D: DmaMode,
-        [(); N]: NonEmpty,
     {
+        const { core::assert!(N > 0, "at least one element is required") };
         let filter = Filter {
             _guard: FilterGuard(PhantomData),
             common: self.common,
@@ -220,7 +214,7 @@ where
     }
 
     fn configure(config: &FilterConfig<T, M>) {
-        Self::set_filter_parameters(config.filter_params);
+        Self::set_parameters(config.filter_params);
         Self::set_continuous(config.enable_continuous_regular);
         Self::set_fastmode(config.enable_fast_regular);
         Self::set_regular_synchronization(config.enable_regular_sync);
@@ -230,7 +224,7 @@ where
     }
 
     /// Writes the filter order, FOSR and IOSR into the filter registers.
-    fn set_filter_parameters(params: config::FilterParameters) {
+    fn set_parameters(params: config::FilterParameters) {
         let (order, fosr, iosr) = params.register_values();
         T::regs().flt(M::CHANNEL.index()).fcr().modify(|w| {
             w.set_ford(order);
@@ -255,7 +249,7 @@ where
     /// conversion request. Disabling it while a continuous conversion is in
     /// progress stops the conversion immediately.
     fn set_continuous(enabled: bool) {
-        T::regs().flt(M::CHANNEL.index()).cr1().modify(|w| w.set_rcont(enabled));
+        RegularRegs::<T, M>::set_continuous(enabled);
     }
 
     /// Configures the trigger for injected conversions.
@@ -268,13 +262,10 @@ where
             InjectedTrigger::Enabled { jextsel, edge, _m } => (*jextsel, *edge as u8),
         };
 
-        T::regs()
-            .flt(M::CHANNEL.index())
-            .cr1()
-            .modify(|w: &mut stm32_metapac::dfsdm::regs::Cr1| {
-                w.set_jextsel(jextsel);
-                w.set_jexten(jexten);
-            });
+        T::regs().flt(M::CHANNEL.index()).cr1().modify(|w| {
+            w.set_jextsel(jextsel);
+            w.set_jexten(jexten);
+        });
     }
 
     /// Enables or disables synchronization for regular conversions.
@@ -341,7 +332,7 @@ where
     /// rather than mutating in place. This is pure borrow-checker bookkeeping,
     /// not a hardware requirement - see [`FilterRegular::assign_transceiver`]
     /// for the in-place alternative when the lifetime doesn't need to change.
-    pub fn replace_regular_transceiver<'new_reg>(
+    pub fn replace_regular<'new_reg>(
         self,
         transceiver: &'new_reg dyn TransceiverTrait<T, Enabled>,
     ) -> Filter<'new_reg, 'ti, 'a, 'd, T, M, D> {
@@ -362,15 +353,13 @@ where
     /// rather than mutating in place. This is pure borrow-checker bookkeeping,
     /// not a hardware requirement - see [`FilterInjected::assign_transceivers`]
     /// for the in-place alternative when the lifetime doesn't need to change.
-    pub fn replace_injected_transceivers<'new_inj, const N: usize>(
+    pub fn replace_injected<'new_inj, const N: usize>(
         self,
         tr
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +65/-50)
```diff
@@ -1,4 +1,9 @@
 //! Digital Filter and Sigma-Delta Modulator (DFSDM)
+//!
+//! One core owns a DFSDM instance. The driver takes no cross-core lock, so
+//! sharing an instance across cores needs external synchronization (an HSEM,
+//! for example): the CR1/CR2/CFGR1 read-modify-writes, the per-instance
+//! armed caches and the RCC disable on drop all race otherwise.
 
 #![macro_use]
 
@@ -40,8 +45,6 @@ use crate::{Peri, interrupt, rcc};
 pub enum Error {
     /// Overrun error: the hardware generated data faster than we could read it.
     Overrun,
-    /// Internal peripheral error.
-    PeripheralError,
     /// No data available yet.
     NotReady,
     /// Invalid filter parameters: FOSR/IOSR out of range, or the resulting
@@ -74,21 +77,6 @@ pub struct Dfsdm<'d, T: Instance, C: ClockOutputMode> {
     ckout: Option<Flex<'d>>,
 }
 
-impl<'d, T, C> Dfsdm<'d, T, C>
-where
-    T: Instance,
-    C: ClockOutputMode,
-{
-}
-
-#[allow(private_bounds)]
-impl<'d, T, C> Dfsdm<'d, T, C>
-where
-    C: ClockOutputMode,
-    T: Instance<Transceivers = capability::Tcv8, Filters = capability::Flt8>,
-{
-}
-
 impl<'d, T> Dfsdm<'d, T, OutputEnabled>
 where
     T: Instance,
@@ -131,8 +119,6 @@ where
     C: ClockOutputMode,
 {
     fn new_inner(peri: Peri<'d, T>, ckout: Option<Flex<'d>>) -> Self {
-        let _ = peri;
-
         rcc::enable_and_reset::<T>();
 
         Self {
@@ -221,15 +207,7 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
                 PinKind::Datin => &mut self.datin_slots[ch],
                 PinKind::Ckin => &mut self.ckin_slots[ch],
             };
-            critical_section::with(|cs| {
-                *slot.inner.borrow_ref_mut(cs) = Some(p);
-            });
-            // Two potential users per slot: this channel's own transceiver and
-            // its predecessor's (CHINSEL=1 takes the next channel's pins, and
-            // `NextChannel` wraps). Both reservations are minted up front;
-            // whichever user does not take one disclaims it at build time, and
-            // the other releases it at transceiver drop.
-            slot.rc.store(2, Ordering::Relaxed);
+            slot.inner.borrow_mut().flex = Some(p);
         }
     }
 
@@ -240,36 +218,73 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn release_pin(&self, ch: usize, kind: PinKind) {
+    /// Sets or clears one consumer's requirement on a slot; drops the `Flex` once
+    /// neither consumer requires it.
+    fn set_flag(&self, ch: usize, kind: PinKind, owner: bool, held: bool) {
         let slot = self.get_slot(ch, kind);
-        loop {
-            let val = slot.rc.load(Ordering::Acquire);
-            if val == 0 {
-                return; // Prevent underflow
-            }
-            if slot
-                .rc
-                .compare_exchange(val, val - 1, Ordering::AcqRel, Ordering::Acquire)
-                .is_ok()
-            {
-                if val - 1 == 0 {
-                    critical_section::with(|cs| {
-                        let _ = slot.inner.borrow_ref_mut(cs).take();
-                    });
-                }
-                return;
-            }
+        let mut inner = slot.inner.borrow_mut();
+        if owner {
+            inner.owner = held;
+        } else {
+            inner.neighbor = held;
         }
+        if !inner.owner && !inner.neighbor {
+            inner.flex = None;
+        }
+    }
+
+    /// Records that `M`'s transceiver requires its pinset `S` present, on the
+    /// channel the pins belong to (the successor's when they came from the
+    /// neighbour).
+    pub(crate) fn claim<M, S, PS>(&self)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        self.set_pinset_flag::<M, S, PS>(true);
     }
 
-    /// Releases the reservations `S` holds on `ch`, if any.
-    pub(crate) fn release_pinset<S: PinSet>(&self, ch: usize) {
+    /// Releases `M`'s transceiver's requirement on its pinset `S`.
+    pub(crate) fn release<M, S, PS>(&self)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        self.set_pinset_flag::<M, S, PS>(false);
+    }
+
+    fn set_pinset_flag<M, S, PS>(&self, held: bool)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        let ch = if PS::FROM_NEIGHBOR {
+            <M::Next as TransceiverMarker>::CHANNEL.index()
+        } else {
+            M::CHANNEL.index()
+        };
+        let owner = !PS::FROM_NEIGHBOR;
         let (data, clk) = pinset_kinds::<S>();
         if data {
-            self.release_pin(ch, PinKind::Datin);
+            self.set_flag(ch, PinKind::Datin, owner, held);
         }
         if clk {
-            self.release_pin(ch, PinKind::Ckin);
+            self.set_flag(ch, PinKind::Ckin, owner, held);
+   
```

**File**: `embassy-stm32/src/dfsdm/splits.rs` (modified, +18/-4)
```diff
@@ -9,8 +9,11 @@ use super::*;
 // SplitBuild - filter-count dispatch, one trait per channel arity
 // =============================================================================
 
+pub(crate) trait SealedTcv2SplitBuild {}
+
 /// Builds the actual split struct from already-extracted pin pairs.
-pub trait Tcv2SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet> {
+#[allow(private_bounds)]
+pub trait Tcv2SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet>: SealedTcv2SplitBuild {
     /// The split struct for this (transceiver, filter) shape.
     type Out;
 
@@ -22,8 +25,13 @@ pub trait Tcv2SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet
     ) -> Self::Out;
 }
 
+pub(crate) trait SealedTcv4SplitBuild {}
+
 /// 4-transceiver twin of [`Tcv2SplitBuild`].
-pub trait Tcv4SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet, S2: PinSet, S3: PinSet> {
+#[allow(private_bounds)]
+pub trait Tcv4SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet, S2: PinSet, S3: PinSet>:
+    SealedTcv4SplitBuild
+{
     /// The split struct for this (transceiver, filter) shape.
     type Out;
 
@@ -37,7 +45,10 @@ pub trait Tcv4SplitBuild<T: Instance, C: ClockOutputMode, S0: PinSet, S1: PinSet
     ) -> Self::Out;
 }
 
+pub(crate) trait SealedTcv8SplitBuild {}
+
 /// 8-transceiver twin of [`Tcv2SplitBuild`].
+#[allow(private_bounds)]
 pub trait Tcv8SplitBuild<
     T: Instance,
     C: ClockOutputMode,
@@ -49,7 +60,7 @@ pub trait Tcv8SplitBuild<
     S5: PinSet,
     S6: PinSet,
     S7: PinSet,
->
+>: SealedTcv8SplitBuild
 {
     /// The split struct for this (transceiver, filter) shape.
     type Out;
@@ -76,6 +87,8 @@ pub trait Tcv8SplitBuild<
 // Channel-config tuples - the split entry point
 // =============================================================================
 
+pub(crate) trait SealedChannelCfgTuple {}
+
 /// Implemented for the tuple a `configure_pins` closure returns.
 /// The arity *is* the transceiver-count check: `(C0, C1)` only impls for
 /// `Tcv2` instances, the 8-tuple only for `Tcv8`.
@@ -84,7 +97,8 @@ pub trait Tcv8SplitBuild<
     label = "tuple length doesn't match `{T}`'s transceiver count",
     note = "check `{T}`'s transceiver count and return a tuple of that length, one token per `creator.chN`"
 )]
-pub trait ChannelCfgTuple<'d, T: Instance, C: ClockOutputMode> {
+#[allow(private_bounds)]
+pub trait ChannelCfgTuple<'d, T: Instance, C: ClockOutputMode>: SealedChannelCfgTuple {
     /// The fully-wired split (neighbor pin-sets already correct).
     type Split;
 
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +96/-124)
```diff
@@ -1,5 +1,5 @@
-//! Transceiver driver, its pin reference-counting storage, single-use pin
-//! selectors, and the pin-trait associations.
+//! Transceiver driver, its pin-slot storage, single-use pin selectors, and the
+//! pin-trait associations.
 
 use super::*;
 
@@ -16,17 +16,33 @@ pub enum PinKind {
     Ckin,
 }
 
-/// Reference-counted storage for one pin of one transceiver.
+/// State of one pin slot: the pin handle plus which consumers require it present.
+#[derive(Default)]
+pub(crate) struct PinSlotInner<'d> {
+    pub(crate) flex: Option<Flex<'d>>,
+    /// The channel's own transceiver requires the pin.
+    pub(crate) owner: bool,
+    /// The predecessor's neighbor transceiver requires the pin.
+    pub(crate) neighbor: bool,
+}
+
+/// Storage for one pin of one transceiver.
+///
+/// A pin has 0, 1 or 2 consumers: the channel's own transceiver (`owner`) and its
+/// predecessor's neighbor transceiver (`neighbor`). The two flags track which of
+/// them require the pin present; the `Flex` is dropped once neither does.
 pub struct PinSlot<'d> {
-    pub(crate) inner: critical_section::Mutex<RefCell<Option<Flex<'d>>>>,
-    pub(crate) rc: AtomicU8,
+    pub(crate) inner: RefCell<PinSlotInner<'d>>,
 }
 
 impl<'d> PinSlot<'d> {
     pub(crate) const fn new() -> Self {
         Self {
-            inner: critical_section::Mutex::new(RefCell::new(None)),
-            rc: AtomicU8::new(0),
+            inner: RefCell::new(PinSlotInner {
+                flex: None,
+                owner: false,
+                neighbor: false,
+            }),
         }
     }
 }
@@ -107,21 +123,15 @@ where
     PS: PinSource,
 {
     fn drop(&mut self) {
-        // Release the reservations this transceiver kept: its pinset `S` on
-        // the channel the pins belong to (the successor's when they came from
-        // the neighbour). The reservations it did not keep were already
-        // disclaimed at build time.
-        let ch = if PS::FROM_NEIGHBOR {
-            <M::Next as TransceiverMarker>::CHANNEL.index()
-        } else {
-            M::CHANNEL.index()
-        };
-        self.common.release_pinset::<S>(ch);
+        // Release the requirement this transceiver held: its pinset `S` on the
+        // channel the pins belong to (the successor's when they came from the
+        // neighbour). A pin nobody else requires deconfigures here.
+        self.common.release::<M, S, PS>();
 
         // Disabling deactivates the detector flags, so drop them from the
         // cached armed mask too.
-        ShortCircuitDetector::<T>::drop_transceiver(M::CHANNEL);
-        ClockAbsenceDetector::<T>::drop_transceiver(M::CHANNEL);
+        ShortCircuitDetector::<T>::unarm_channel(M::CHANNEL);
+        ClockAbsenceDetector::<T>::unarm_channel(M::CHANNEL);
 
         T::regs().ch(M::CHANNEL.index()).cfgr1().modify(|w| w.set_chen(false));
     }
@@ -184,7 +194,7 @@ where
     #[cfg(feature = "time")]
     pub async fn wait_for_sync(&mut self) {
         loop {
-            if ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {
+            if ClockAbsenceDetector::<T>::try_clear_flag(M::CHANNEL) {
                 break;
             }
             embassy_time::Timer::after_millis(1).await;
@@ -194,7 +204,7 @@ where
     /// Blocking `wait_for_sync`: polls the clock-absence flag without
     /// yielding. Available with and without the `time` feature.
     pub fn blocking_wait_for_sync(&mut self) {
-        while !ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {}
+        while !ClockAbsenceDetector::<T>::try_clear_flag(M::CHANNEL) {}
     }
 }
 
@@ -246,8 +256,8 @@ where
     ///
     /// # Note
     /// The valid watchdog OSR range depends on this order; set
-    /// [`select_awd_filter_osr`](Self::select_awd_filter_osr) accordingly.
-    pub fn select_awd_filter_order(self, filter_order: config::AwdFilterOrder) -> Self {
+    /// [`set_awd_osr`](Self::set_awd_osr) accordingly.
+    pub fn set_awd_order(self, filter_order: config::AwdFilterOrder) -> Self {
         T::regs()
             .ch(M::CHANNEL.index())
             .awscdr()
@@ -259,8 +269,8 @@ where
     ///
     /// # Note
     /// The valid OSR range depends on the order set via
-    /// [`select_awd_filter_order`](Self::select_awd_filter_order).
-    pub fn select_awd_filter_osr(self, osr: config::AwdFilterOsr) -> Self {
+    /// [`set_awd_order`](Self::set_awd_order).
+    pub fn set_awd_osr(self, osr: config::AwdFilterOsr) -> Self {
         T::regs()
             .ch(M::CHANNEL.index())
             .awscdr()
@@ -356,7 +366,7 @@ where
 
     /// Read the analog watchdog data for this transceiver, converted by the
     /// watchdog filter (continuously, with limited resolution).
-    pub fn awd_filter_data(&self) -> u16 {
+    pub fn awd_data(&self) -> u16 {
         T::regs().ch(M::CHANNEL.index()).wdatr().read().wdata()
     }
 }
@@ -381,11 +391,6 @@ where
     /// To skip more than 63 pulses, issue repeated writ
```

---

### Incident Patch 6: `6813d418` (2026-10-05)
**Commit Message**: fix: allow SAI TX ringbuffer to be started

**File**: `embassy-stm32/src/sai/mod.rs` (modified, +8/-6)
```diff
@@ -712,13 +712,15 @@ impl<'d, W: word::Word> Sai<'d, W> {
 
     /// Start the SAI driver.
     ///
-    /// Only receivers can be started. Transmitters are started on the first writing operation.
-    pub fn start(&mut self) -> Result<(), Error> {
-        match self.ring_buffer {
-            RingBuffer::Writable(_) => Err(Error::NotAReceiver),
-            RingBuffer::Readable(ref mut rb) => {
+    /// Starts the ring buffer for both directions. Transmitters must fill the ring buffer with
+    /// [[`Self::write`]] before starting.
+    pub fn start(&mut self) {
+        match &mut self.ring_buffer {
+            RingBuffer::Writable(rb) => {
+                rb.start();
+            }
+            RingBuffer::Readable(rb) => {
                 rb.start();
-                Ok(())
             }
         }
     }
```

---

### Incident Patch 7: `f9b5b29c` (2026-10-05)
**Commit Message**: dfsdm: make transceiver build the pin gate

Replace the per-slot `AtomicU8` reference count with two named flags
(`owner`/`neighbor`) in a plain `RefCell<PinSlotInner>`: a pin has 0, 1
or 2 consumers, and the flags record which of them require it present.
There is no mint-2/disclaim dance and no underflow guard; `insert_pin`
only stores the handle, `claim`/`release` set/clear one consumer's flag,
and the `Flex` is dropped once neither flag is set.

Drop the critical section and atomics from the slots. They are touched
only in the executor (the ISR only touches the SCD/CKAB armed caches),
so `RefCell`'s `!Sync` is the honest marker and `Send` is preserved.

Add a generated `build` method on each split struct: it hands the
channel builders to a closure, then sweeps every slot, so a pin that
was declared but never required deconfigures immediately instead of
lingering until the driver drops. `claim`/`release` are marker-typed
over `(M, S, PS)`.

**File**: `embassy-stm32/src/dfsdm/codegen.rs` (modified, +89/-14)
```diff
@@ -268,20 +268,59 @@ fn gen_split(ch: u8, flt_n: u8) -> TokenStream {
     let flt_idents: Vec<Ident> = (0..flt_count).map(|i| format_ident!("flt{}", i)).collect();
     let flt_markers: Vec<Ident> = (0..flt_count).map(|i| format_ident!("Flt{}", i)).collect();
 
-    let struct_channels = (0..ch).map(|i| {
-        let c = &ch_idents[i];
-        let t = &tcv_idents[i];
-        let own = &s[i];
-        let neighbor = &s[(i + 1) % ch];
-        let doc = format!("Builder for [`crate::dfsdm::Transceiver`] {}.", i);
-        quote! { #[doc = #doc] pub #c: crate::dfsdm::TransceiverBuilder<T, crate::dfsdm::#t, C, #own, #neighbor>, }
-    });
-    let struct_filters = (0..flt_count).map(|i| {
-        let f = &flt_idents[i];
-        let m = &flt_markers[i];
-        let doc = format!("Builder for [`crate::dfsdm::Filter`] {}.", i);
-        quote! { #[doc = #doc] pub #f: crate::dfsdm::FilterBuilder<T, crate::dfsdm::#m>, }
-    });
+    let builders_name = format_ident!("{}Builders", name);
+    let filters_name = format_ident!("{}Filters", name);
+
+    let struct_channels: Vec<_> = (0..ch)
+        .map(|i| {
+            let c = &ch_idents[i];
+            let t = &tcv_idents[i];
+            let own = &s[i];
+            let neighbor = &s[(i + 1) % ch];
+            let doc = format!("Builder for [`crate::dfsdm::Transceiver`] {}.", i);
+            quote! { #[doc = #doc] pub #c: crate::dfsdm::TransceiverBuilder<T, crate::dfsdm::#t, C, #own, #neighbor>, }
+        })
+        .collect();
+    let struct_filters: Vec<_> = (0..flt_count)
+        .map(|i| {
+            let f = &flt_idents[i];
+            let m = &flt_markers[i];
+            let doc = format!("Builder for [`crate::dfsdm::Filter`] {}.", i);
+            quote! { #[doc = #doc] pub #f: crate::dfsdm::FilterBuilder<T, crate::dfsdm::#m>, }
+        })
+        .collect();
+
+    let builders_struct = quote! {
+        /// One [`crate::dfsdm::TransceiverBuilder`] per transceiver, handed to the
+        /// closure of [`#name::build`]. Build the channels you use; leave the rest,
+        /// and their pins deconfigure at the sweep. `#[non_exhaustive]` so callers
+        /// can consume fields but cannot construct or exhaustively destructure it.
+        #[non_exhaustive]
+        pub struct #builders_name<T, C, #(#s),*>
+        where
+            T: crate::dfsdm::Instance + crate::dfsdm::#ready,
+            C: crate::dfsdm::ClockOutputMode,
+            #(#s: crate::dfsdm::PinSet,)*
+        {
+            #(#struct_channels)*
+        }
+    };
+
+    let filters_struct = quote! {
+        /// The filter builders and detectors left after [`#name::build`] built the
+        /// transceivers. `#[non_exhaustive]`, so callers consume fields but cannot
+        /// construct it.
+        #[non_exhaustive]
+        pub struct #filters_name<T>
+        where
+            T: crate::dfsdm::Instance + crate::dfsdm::#ready,
+        {
+            #(#struct_filters)*
+            /// Builds the instance-level [`crate::dfsdm::ShortCircuitDetector`] and
+            /// [`crate::dfsdm::ClockAbsenceDetector`].
+            pub detectors: crate::dfsdm::DetectorsBuilder<T>,
+        }
+    };
 
     let build_args = (0..ch).map(|i| {
         let c = &ch_idents[i];
@@ -308,6 +347,36 @@ fn gen_split(ch: u8, flt_n: u8) -> TokenStream {
         quote! { #f: crate::dfsdm::FilterBuilder::new(), }
     });
 
+    let build_impl = quote! {
+        impl<T, C, #(#s),*> #name<T, C, #(#s),*>
+        where
+            T: crate::dfsdm::Instance + crate::dfsdm::#ready,
+            C: crate::dfsdm::ClockOutputMode,
+            #(#s: crate::dfsdm::PinSet,)*
+        {
+            /// Builds the transceivers inside `f`, then deconfigures every pin no
+            /// transceiver required.
+            pub fn build<'a, 'd, F, R>(
+                self,
+                common: &'a crate::dfsdm::DfsdmCommon<'d, T, crate::dfsdm::Enabled>,
+                f: F,
+            ) -> (R, #filters_name<T>)
+            where
+                F: FnOnce(#builders_name<T, C, #(#s),*>) -> R,
+            {
+                let Self {
+                    detectors,
+                    #(#ch_idents,)*
+                    #(#flt_idents,)*
+                } = self;
+                let builders = #builders_name { #(#ch_idents,)* };
+                let r = f(builders);
+                common.sweep();
+                (r, #filters_name { #(#flt_idents,)* detectors })
+            }
+        }
+    };
+
     quote! {
         /// One [`crate::dfsdm::TransceiverBuilder`] per transceiver, one
         /// [`crate::dfsdm::FilterBuilder`] per filter, and the shared
@@ -325,6 +394,10 @@ fn gen_split(ch: u8, flt_n: u8) -> TokenStream {
             #(#struct_filters)*
         }
 
+        #builders_struct
+
+        #filters_struct
+
         impl crate::dfsdm::#sealed_tcv_trait for crate::dfsdm::capability::#flt_cap {}
 
         impl<T, C, #(#s),*> crate::dfsdm::#tcv_trait<T, C, #(#s),*>
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +60/-31)
```diff
@@ -207,15 +207,7 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
                 PinKind::Datin => &mut self.datin_slots[ch],
                 PinKind::Ckin => &mut self.ckin_slots[ch],
             };
-            critical_section::with(|cs| {
-                *slot.inner.borrow_ref_mut(cs) = Some(p);
-            });
-            // Two potential users per slot: this channel's own transceiver and
-            // its predecessor's (CHINSEL=1 takes the next channel's pins, and
-            // `NextChannel` wraps). Both reservations are minted up front;
-            // whichever user does not take one disclaims it at build time, and
-            // the other releases it at transceiver drop.
-            slot.rc.store(2, Ordering::Relaxed);
+            slot.inner.borrow_mut().flex = Some(p);
         }
     }
 
@@ -226,36 +218,73 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn release_pin(&self, ch: usize, kind: PinKind) {
+    /// Sets or clears one consumer's requirement on a slot; drops the `Flex` once
+    /// neither consumer requires it.
+    fn set_flag(&self, ch: usize, kind: PinKind, owner: bool, held: bool) {
         let slot = self.get_slot(ch, kind);
-        loop {
-            let val = slot.rc.load(Ordering::Acquire);
-            if val == 0 {
-                return; // Prevent underflow
-            }
-            if slot
-                .rc
-                .compare_exchange(val, val - 1, Ordering::AcqRel, Ordering::Acquire)
-                .is_ok()
-            {
-                if val - 1 == 0 {
-                    critical_section::with(|cs| {
-                        let _ = slot.inner.borrow_ref_mut(cs).take();
-                    });
-                }
-                return;
-            }
+        let mut inner = slot.inner.borrow_mut();
+        if owner {
+            inner.owner = held;
+        } else {
+            inner.neighbor = held;
+        }
+        if !inner.owner && !inner.neighbor {
+            inner.flex = None;
         }
     }
 
-    /// Releases the reservations `S` holds on `ch`, if any.
-    pub(crate) fn release_pinset<S: PinSet>(&self, ch: usize) {
+    /// Records that `M`'s transceiver requires its pinset `S` present, on the
+    /// channel the pins belong to (the successor's when they came from the
+    /// neighbour).
+    pub(crate) fn claim<M, S, PS>(&self)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        self.set_pinset_flag::<M, S, PS>(true);
+    }
+
+    /// Releases `M`'s transceiver's requirement on its pinset `S`.
+    pub(crate) fn release<M, S, PS>(&self)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        self.set_pinset_flag::<M, S, PS>(false);
+    }
+
+    fn set_pinset_flag<M, S, PS>(&self, held: bool)
+    where
+        M: TransceiverMarker + NextChannelForInstance<T>,
+        S: PinSet,
+        PS: PinSource,
+    {
+        let ch = if PS::FROM_NEIGHBOR {
+            <M::Next as TransceiverMarker>::CHANNEL.index()
+        } else {
+            M::CHANNEL.index()
+        };
+        let owner = !PS::FROM_NEIGHBOR;
         let (data, clk) = pinset_kinds::<S>();
         if data {
-            self.release_pin(ch, PinKind::Datin);
+            self.set_flag(ch, PinKind::Datin, owner, held);
         }
         if clk {
-            self.release_pin(ch, PinKind::Ckin);
+            self.set_flag(ch, PinKind::Ckin, owner, held);
+        }
+    }
+
+    /// Drops every pin no consumer required. Called once all transceivers are
+    /// built, so a pin that was declared but never used is deconfigured now
+    /// instead of lingering until the driver drops.
+    pub(crate) fn sweep(&self) {
+        for slot in self.datin_slots.iter().chain(self.ckin_slots.iter()) {
+            let mut inner = slot.inner.borrow_mut();
+            if !inner.owner && !inner.neighbor {
+                inner.flex = None;
+            }
         }
     }
 }
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +39/-68)
```diff
@@ -1,5 +1,5 @@
-//! Transceiver driver, its pin reference-counting storage, single-use pin
-//! selectors, and the pin-trait associations.
+//! Transceiver driver, its pin-slot storage, single-use pin selectors, and the
+//! pin-trait associations.
 
 use super::*;
 
@@ -16,17 +16,33 @@ pub enum PinKind {
     Ckin,
 }
 
-/// Reference-counted storage for one pin of one transceiver.
+/// State of one pin slot: the pin handle plus which consumers require it present.
+#[derive(Default)]
+pub(crate) struct PinSlotInner<'d> {
+    pub(crate) flex: Option<Flex<'d>>,
+    /// The channel's own transceiver requires the pin.
+    pub(crate) owner: bool,
+    /// The predecessor's neighbor transceiver requires the pin.
+    pub(crate) neighbor: bool,
+}
+
+/// Storage for one pin of one transceiver.
+///
+/// A pin has 0, 1 or 2 consumers: the channel's own transceiver (`owner`) and its
+/// predecessor's neighbor transceiver (`neighbor`). The two flags track which of
+/// them require the pin present; the `Flex` is dropped once neither does.
 pub struct PinSlot<'d> {
-    pub(crate) inner: critical_section::Mutex<RefCell<Option<Flex<'d>>>>,
-    pub(crate) rc: AtomicU8,
+    pub(crate) inner: RefCell<PinSlotInner<'d>>,
 }
 
 impl<'d> PinSlot<'d> {
     pub(crate) const fn new() -> Self {
         Self {
-            inner: critical_section::Mutex::new(RefCell::new(None)),
-            rc: AtomicU8::new(0),
+            inner: RefCell::new(PinSlotInner {
+                flex: None,
+                owner: false,
+                neighbor: false,
+            }),
         }
     }
 }
@@ -107,16 +123,10 @@ where
     PS: PinSource,
 {
     fn drop(&mut self) {
-        // Release the reservations this transceiver kept: its pinset `S` on
-        // the channel the pins belong to (the successor's when they came from
-        // the neighbour). The reservations it did not keep were already
-        // disclaimed at build time.
-        let ch = if PS::FROM_NEIGHBOR {
-            <M::Next as TransceiverMarker>::CHANNEL.index()
-        } else {
-            M::CHANNEL.index()
-        };
-        self.common.release_pinset::<S>(ch);
+        // Release the requirement this transceiver held: its pinset `S` on the
+        // channel the pins belong to (the successor's when they came from the
+        // neighbour). A pin nobody else requires deconfigures here.
+        self.common.release::<M, S, PS>();
 
         // Disabling deactivates the detector flags, so drop them from the
         // cached armed mask too.
@@ -570,10 +580,8 @@ where
     {
         self.set_channel_input(config::ChannelInput::Same);
         self.set_data_mux(config::InputDataMux::InternalAdc);
-        // This mode uses no pins: disclaim both reservations the builder
-        // minted, so the declared pins deconfigure now.
-        self.disclaim_own(common);
-        self.disclaim_neighbor(common);
+        // This mode uses no pins: claim nothing, so declared pins deconfigure at
+        // the gate's sweep.
         Transceiver::new(common)
     }
 
@@ -590,8 +598,6 @@ where
         self.set_channel_input(config::ChannelInput::Same);
         self.set_data_mux(config::InputDataMux::InternalRegisterWrite);
         self.set_data_packing_mode(config::DataPackingMode::Standard);
-        self.disclaim_own(common);
-        self.disclaim_neighbor(common);
         Transceiver::new(common)
     }
 
@@ -608,8 +614,6 @@ where
         self.set_channel_input(config::ChannelInput::Same);
         self.set_data_mux(config::InputDataMux::InternalRegisterWrite);
         self.set_data_packing_mode(config::DataPackingMode::Interleaved);
-        self.disclaim_own(common);
-        self.disclaim_neighbor(common);
         Transceiver::new(common)
     }
 
@@ -640,11 +644,7 @@ where
         neighbor.set_data_mux(config::InputDataMux::InternalRegisterWrite);
         self.set_data_packing_mode(config::DataPackingMode::Dual);
         neighbor.set_data_packing_mode(config::DataPackingMode::Standard);
-        // No pins are used by either half: disclaim all four reservations.
-        self.disclaim_own(common);
-        self.disclaim_neighbor(common);
-        neighbor.disclaim_own(common);
-        neighbor.disclaim_neighbor(common);
+        // No pins are used by either half: claim nothing.
         ParallelPairDisabled {
             even: Transceiver::new(common),
             odd: Transceiver::new(common),
@@ -666,9 +666,8 @@ where
         self.set_channel_input(config::ChannelInput::Same);
         self.set_data_mux(config::InputDataMux::ExternalSerial);
         self.set_serial_interface(mode.into());
-        // The transceiver keeps its own DATIN reservation; disclaim the
-        // successor-slot reservation minted for the neighbour build.
-        self.disclaim_neighbor(common);
+        // The transceiver requires its own DATIN pin.
+        common.claim::<M, S, OwnPins>();
         Transceiver::new(common)
     }
 
@@ -681,19 +680,12 @@ wh
```

---

### Incident Patch 8: `ea40c203` (2026-10-05)
**Commit Message**: Fix C5 flash write

**File**: `embassy-stm32/src/flash/c5.rs` (modified, +5/-1)
```diff
@@ -260,7 +260,7 @@ unsafe fn blocking_wait_ready() -> Result<(), Error> {
     loop {
         let sr = pac::FLASH.sr().read();
 
-        if !sr_busy(sr) {
+        if !sr.bsy() {
             if sr.optchangeerr() {
                 error!("optchangeerr");
                 return Err(Error::Prog);
@@ -336,6 +336,10 @@ pub fn perform_bank_swap() {
 
 fn sr_busy(sr: Sr) -> bool {
     // Flash is ready only when BSY, DBNE, and WBNE are all cleared.
+    //
+    // The exception being during a write operation where WBNE will
+    // be set until the entire WRITE_SIZE is written.
+    //
     // See RM0522, "Monitoring ongoing write operations".
     sr.bsy() || sr.dbne() || sr.wbne() == vals::Wbne::B0x1
 }
```

---

### Incident Patch 9: `74eb5738` (2026-10-04)
**Commit Message**: Merge pull request #7175 from M3gaFr3ak/fix/dfsdm-pin-reservations

dfsdm: fix pin ownership with a two-reservation model

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +22/-31)
```diff
@@ -42,8 +42,6 @@ pub enum Error {
     Overrun,
     /// Internal peripheral error.
     PeripheralError,
-    /// Neighbor pin unavailable.
-    NeighborPinUnavailable,
     /// No data available yet.
     NotReady,
     /// Invalid filter parameters: FOSR/IOSR out of range, or the resulting
@@ -207,6 +205,15 @@ impl<T: Instance> Drop for RccOff<T> {
     }
 }
 
+/// Kinds a pin-set consumes on its channel: `(Datin, Ckin)` flags.
+///
+/// Shared by the builder (to disclaim reservations it does not keep) and the
+/// transceiver drop guard (to release the ones it does), so the two sets can
+/// never drift apart.
+pub(crate) fn pinset_kinds<S: PinSet>() -> (bool, bool) {
+    (S::HAS_DATA, S::HAS_CLK)
+}
+
 impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
     pub(crate) fn insert_pin(&mut self, ch: usize, kind: PinKind, flex: Option<Flex<'d>>) {
         if let Some(p) = flex {
@@ -217,7 +224,12 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
             critical_section::with(|cs| {
                 *slot.inner.borrow_ref_mut(cs) = Some(p);
             });
-            slot.rc.store(1, Ordering::Relaxed);
+            // Two potential users per slot: this channel's own transceiver and
+            // its predecessor's (CHINSEL=1 takes the next channel's pins, and
+            // `NextChannel` wraps). Both reservations are minted up front;
+            // whichever user does not take one disclaims it at build time, and
+            // the other releases it at transceiver drop.
+            slot.rc.store(2, Ordering::Relaxed);
         }
     }
 
@@ -228,23 +240,6 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn acquire_pin(&self, ch: usize, kind: PinKind) -> Result<(), Error> {
-        let slot = self.get_slot(ch, kind);
-        loop {
-            let val = slot.rc.load(Ordering::Acquire);
-            if val == 0 {
-                return Err(Error::NeighborPinUnavailable);
-            }
-            if slot
-                .rc
-                .compare_exchange(val, val + 1, Ordering::AcqRel, Ordering::Acquire)
-                .is_ok()
-            {
-                return Ok(());
-            }
-        }
-    }
-
     pub(crate) fn release_pin(&self, ch: usize, kind: PinKind) {
         let slot = self.get_slot(ch, kind);
         loop {
@@ -267,19 +262,15 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn acquire_pins<S: PinSet>(&self, ch: usize) -> Result<(), Error> {
-        if S::HAS_DATA {
-            self.acquire_pin(ch, PinKind::Datin)?;
+    /// Releases the reservations `S` holds on `ch`, if any.
+    pub(crate) fn release_pinset<S: PinSet>(&self, ch: usize) {
+        let (data, clk) = pinset_kinds::<S>();
+        if data {
+            self.release_pin(ch, PinKind::Datin);
         }
-        if S::HAS_CLK
-            && let Err(e) = self.acquire_pin(ch, PinKind::Ckin)
-        {
-            if S::HAS_DATA {
-                self.release_pin(ch, PinKind::Datin);
-            }
-            return Err(e);
+        if clk {
+            self.release_pin(ch, PinKind::Ckin);
         }
-        Ok(())
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +154/-42)
```diff
@@ -45,6 +45,10 @@ where
     PS: PinSource,
     P: PowerState,
 {
+    /// Drop glue: releases the pin reservations this transceiver owns and
+    /// disables the channel. A guard field instead of a `Drop` impl so
+    /// [`Transceiver`] stays freely destructurable (`enable`/`disable`).
+    _guard: ChannelGuard<'a, 'd, T, M, S, PS>,
     pub(crate) common: &'a DfsdmCommon<'d, T, Enabled>,
     _instance_marker: PhantomData<T>,
     _transceiver_marker: PhantomData<M>,
@@ -65,6 +69,10 @@ where
 {
     fn new(common: &'a DfsdmCommon<'d, T, Enabled>) -> Self {
         Self {
+            _guard: ChannelGuard {
+                common,
+                _marker: PhantomData,
+            },
             common,
             _instance_marker: PhantomData,
             _transceiver_marker: PhantomData,
@@ -76,36 +84,46 @@ where
     }
 }
 
-impl<'a, 'd, T, M, S, MODE, PS, P> Drop for Transceiver<'a, 'd, T, M, S, MODE, PS, P>
+/// Releases a transceiver's pin reservations and disables its channel on drop.
+///
+/// A field of [`Transceiver`], so the latter has no `Drop` and can be rebuilt
+/// by struct update syntax in `enable`/`disable`.
+pub(crate) struct ChannelGuard<'a, 'd, T, M, S, PS>
+where
+    T: Instance,
+    M: TransceiverMarker + NextChannelForInstance<T>,
+    S: PinSet,
+    PS: PinSource,
+{
+    common: &'a DfsdmCommon<'d, T, Enabled>,
+    _marker: PhantomData<(M, S, PS)>,
+}
+
+impl<'a, 'd, T, M, S, PS> Drop for ChannelGuard<'a, 'd, T, M, S, PS>
 where
     T: Instance,
     M: TransceiverMarker + NextChannelForInstance<T>,
     S: PinSet,
-    MODE: ChannelMode,
     PS: PinSource,
-    P: PowerState,
 {
     fn drop(&mut self) {
-        // "Drop pin references" as we "manually" reference count
+        // Release the reservations this transceiver kept: its pinset `S` on
+        // the channel the pins belong to (the successor's when they came from
+        // the neighbour). The reservations it did not keep were already
+        // disclaimed at build time.
         let ch = if PS::FROM_NEIGHBOR {
             <M::Next as TransceiverMarker>::CHANNEL.index()
         } else {
             M::CHANNEL.index()
         };
+        self.common.release_pinset::<S>(ch);
 
-        if S::HAS_DATA {
-            self.common.release_pin(ch, PinKind::Datin);
-        }
-        if S::HAS_CLK {
-            self.common.release_pin(ch, PinKind::Ckin);
-        }
-
-        // Disabling will deactivate the detector flags,
-        // so we need to remove them from the cached version
+        // Disabling deactivates the detector flags, so drop them from the
+        // cached armed mask too.
         ShortCircuitDetector::<T>::drop_transceiver(M::CHANNEL);
         ClockAbsenceDetector::<T>::drop_transceiver(M::CHANNEL);
 
-        Self::set_enabled(false);
+        T::regs().ch(M::CHANNEL.index()).cfgr1().modify(|w| w.set_chen(false));
     }
 }
 
@@ -122,9 +140,26 @@ where
     pub fn disable(self) -> Transceiver<'a, 'd, T, M, S, MODE, PS, Disabled> {
         Self::set_enabled(false);
 
-        let common = self.common;
-        core::mem::forget(self);
-        Transceiver::new(common)
+        let Self {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: _,
+        } = self;
+        Transceiver {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: PhantomData,
+        }
     }
 
     /// Set the transceiver's offset.
@@ -176,10 +211,26 @@ where
     pub fn enable(self) -> Transceiver<'a, 'd, T, M, S, MODE, PS, Enabled> {
         Self::set_enabled(true);
 
-        let common = self.common;
-        core::mem::forget(self);
-
-        Transceiver::new(common)
+        let Self {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: _,
+        } = self;
+        Transceiver {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: PhantomData,
+        }
     }
 
     /// Set the transceiver's right-shift factor.
@@ -500,47 +551,64 @@ where
     }
 
     /// Parallel input from ADC writes to CHyDATINR (DATMPX=1).
-    /// No CKOUT, no pins needed. Serial pins declared on this transceiver
-    /// are disconnected (the builder's Flexes drop here - they're unused
-    /// in this mode).
+    ///
+    /// No CKOUT, no pins needed: serial pins declared on this transceiver a
```

**File**: `embassy-stm32/src/dfsdm/types.rs` (modified, +3/-2)
```diff
@@ -587,8 +587,9 @@ impl_trait! {
 // deliberately excluded
 
 /// Which transceiver's serial pins this transceiver's interface consumes
-/// (CFGR1.CHINSEL). Pins are borrowed from that transceiver's slot, so
-/// acquire/release live there too (see `Drop`).
+/// (CFGR1.CHINSEL). Pins are borrowed from that transceiver's slot; the
+/// reservation is released by the transceiver's drop guard (see
+/// [`ChannelGuard`]).
 pub trait PinSource: sealed::Sealed {
     /// Consume the next transceiver's pins instead of this transceiver's own.
     const FROM_NEIGHBOR: bool;
```

**File**: `examples/stm32h755cm7/src/bin/dfsdm_neighbor.rs` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+#![no_std]
+#![no_main]
+
+//! DFSDM neighbor-pin build demo.
+//!
+//! Builds channel 1 as `build_spi_int_neighbor`, so it reads *channel 2's*
+//! DATIN pin instead of declaring its own. Exercises the two-reservation pin
+//! model: channel 1's own slot is disclaimed at build time, and channel 2's
+//! slot reservation is released when the transceiver drops.
+
+use core::mem::MaybeUninit;
+
+use defmt::*;
+use defmt_rtt as _;
+use embassy_executor::Spawner;
+use embassy_stm32::dfsdm::config::{CkoutDivider, FilterOrder, FilterParameters, InternalSpiMode};
+use embassy_stm32::dfsdm::{FilterConfig, Flt0, ResultRegular};
+use embassy_stm32::gpio::{Level, Output, Speed};
+use embassy_stm32::peripherals::DFSDM1;
+use embassy_stm32::rcc::{self};
+use embassy_stm32::time::Hertz;
+use embassy_stm32::{SharedData, bind_interrupts, dfsdm};
+use panic_probe as _;
+
+#[unsafe(link_section = ".ram_d3.shared_data")]
+static SHARED_DATA: MaybeUninit<SharedData> = MaybeUninit::uninit();
+
+bind_interrupts!(struct Irqs {
+    DFSDM1_FLT0 => dfsdm::InterruptHandler<DFSDM1, Flt0>;
+});
+
+#[embassy_executor::main]
+async fn main(_spawner: Spawner) {
+    let mut config = embassy_stm32::Config::default();
+    {
+        use embassy_stm32::rcc::*;
+        config.rcc.hsi = Some(HSIPrescaler::Div1);
+        config.rcc.csi = true;
+        config.rcc.pll1 = Some(Pll {
+            source: PllSource::Hsi,
+            prediv: PllPreDiv::Div4,
+            mul: PllMul::Mul50,
+            divp: Some(PllDiv::Div2),
+            divq: Some(PllDiv::Div8), // 100mhz
+            divr: None,
+        });
+        config.rcc.sys = Sysclk::Pll1P; // 400 Mhz
+        config.rcc.ahb_pre = AHBPrescaler::Div2; // 200 Mhz
+        config.rcc.apb1_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb2_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb3_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb4_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.voltage_scale = VoltageScale::Scale1;
+        config.rcc.supply_config = SupplyConfig::DirectSMPS;
+    }
+
+    let p = embassy_stm32::init_primary(config, &SHARED_DATA);
+    info!("Hello World!");
+
+    // Mic as left channel: data valid at clock low, sampled on rising edge.
+    let _mic_sel = Output::new(p.PA3, Level::Low, Speed::Low);
+
+    let mic_clk_freq = Hertz::mhz(2);
+    let prescaler = rcc::frequency::<DFSDM1>() / mic_clk_freq;
+
+    // CKOUT on PC2.
+    let dfsdm1 = dfsdm::Dfsdm::new_ckout(
+        p.DFSDM1,
+        p.PC2,
+        dfsdm::config::CkoutSource::System,
+        CkoutDivider::try_from(prescaler as u16).expect("Divider wrong?"),
+    );
+
+    // Declare the mic data pin on channel 2. Channel 1 will borrow it.
+    let (common, split) = dfsdm1.configure_pins(|creator| {
+        (
+            creator.ch0.none(),
+            creator.ch1.none(),
+            creator.ch2.datin(p.PC5),
+            creator.ch3.none(),
+            creator.ch4.none(),
+            creator.ch5.none(),
+            creator.ch6.none(),
+            creator.ch7.none(),
+        )
+    });
+
+    // Channel 1 reads channel 2's DATIN pin (CHINSEL=1, next channel).
+    let channel_mic = split
+        .ch1
+        .build_spi_int_neighbor(&common, InternalSpiMode::SpiRising)
+        .set_data_right_shift(
+            FilterParameters::try_new(FilterOrder::Sinc3 { fosr: 100 }, 50)
+                .expect("inside bounds")
+                .recommended_shift()
+                .try_into()
+                .unwrap(),
+        )
+        .enable();
+
+    let flt_cfg = FilterConfig {
+        filter_params: FilterParameters::try_new(FilterOrder::Sinc3 { fosr: 100 }, 50).expect("inside bounds"),
+        ..Default::default()
+    };
+
+    let mut flt0 = split
+        .flt0
+        .build(&common, Irqs)
+        .enable_no_dma(&channel_mic, [&channel_mic], &flt_cfg);
+
+    flt0.regular.start_conversion();
+    info!("Reading neighbor-fed channel 1; polling for 2s...");
+
+    // Bounded polling: this is a build/pin-lifecycle smoke test, not a data
+    // test (the pin may be floating). It must run without panicking.
+    let mut count = 0u32;
+    let mut polls = 0u32;
+    while polls < 200_000 {
+        polls += 1;
+        if let Ok(ResultRegular { data, .. }) = flt0.regular.try_get_result() {
+            flt0.regular.start_conversion();
+            count += 1;
+            if count % 25 == 0 {
+                info!("sample {}: {}", count, data);
+            }
+        }
+    }
+    info!("PASS: neighbor-fed build ran; {} conversions seen", count);
+}
```

---

### Incident Patch 10: `2ded4cab` (2026-10-04)
**Commit Message**: dfsdm: fix pin ownership with a two-reservation model

Each pin slot has exactly two potential users: its own channel's
transceiver and its predecessor's (CHINSEL=1 takes the next channel's
pins and NextChannel wraps). The old refcount minted only one
reservation and grew it lazily with acquire_pin at build time, which
had two defects:

- Neighbor builds rebound the returned transceiver's pinset to the
  neighbor's set, so nothing ever released the base reference on the
  channel's own slot. Those pins stayed configured until DfsdmCommon
  dropped.
- acquire_pin could fail at runtime with NeighborPinUnavailable even
  though the build's type bounds promised the pin, making the result
  depend on build order.

Mint both reservations up front in insert_pin instead. Each build
disclaims the reservations its transceiver will not hold; the ones it
keeps are released by the transceiver's drop. This makes the
availability static (no runtime failure) and the teardown symmetric.

Delete acquire_pin/acquire_pins and the now-unreachable
Error::NeighborPinUnavailable. Parallel builds return NoPins (they
hold no claims), so their drop releases nothing.

Also move Transceiver's Drop into a Chann

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +22/-31)
```diff
@@ -42,8 +42,6 @@ pub enum Error {
     Overrun,
     /// Internal peripheral error.
     PeripheralError,
-    /// Neighbor pin unavailable.
-    NeighborPinUnavailable,
     /// No data available yet.
     NotReady,
     /// Invalid filter parameters: FOSR/IOSR out of range, or the resulting
@@ -207,6 +205,15 @@ impl<T: Instance> Drop for RccOff<T> {
     }
 }
 
+/// Kinds a pin-set consumes on its channel: `(Datin, Ckin)` flags.
+///
+/// Shared by the builder (to disclaim reservations it does not keep) and the
+/// transceiver drop guard (to release the ones it does), so the two sets can
+/// never drift apart.
+pub(crate) fn pinset_kinds<S: PinSet>() -> (bool, bool) {
+    (S::HAS_DATA, S::HAS_CLK)
+}
+
 impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
     pub(crate) fn insert_pin(&mut self, ch: usize, kind: PinKind, flex: Option<Flex<'d>>) {
         if let Some(p) = flex {
@@ -217,7 +224,12 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
             critical_section::with(|cs| {
                 *slot.inner.borrow_ref_mut(cs) = Some(p);
             });
-            slot.rc.store(1, Ordering::Relaxed);
+            // Two potential users per slot: this channel's own transceiver and
+            // its predecessor's (CHINSEL=1 takes the next channel's pins, and
+            // `NextChannel` wraps). Both reservations are minted up front;
+            // whichever user does not take one disclaims it at build time, and
+            // the other releases it at transceiver drop.
+            slot.rc.store(2, Ordering::Relaxed);
         }
     }
 
@@ -228,23 +240,6 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn acquire_pin(&self, ch: usize, kind: PinKind) -> Result<(), Error> {
-        let slot = self.get_slot(ch, kind);
-        loop {
-            let val = slot.rc.load(Ordering::Acquire);
-            if val == 0 {
-                return Err(Error::NeighborPinUnavailable);
-            }
-            if slot
-                .rc
-                .compare_exchange(val, val + 1, Ordering::AcqRel, Ordering::Acquire)
-                .is_ok()
-            {
-                return Ok(());
-            }
-        }
-    }
-
     pub(crate) fn release_pin(&self, ch: usize, kind: PinKind) {
         let slot = self.get_slot(ch, kind);
         loop {
@@ -267,19 +262,15 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
     }
 
-    pub(crate) fn acquire_pins<S: PinSet>(&self, ch: usize) -> Result<(), Error> {
-        if S::HAS_DATA {
-            self.acquire_pin(ch, PinKind::Datin)?;
+    /// Releases the reservations `S` holds on `ch`, if any.
+    pub(crate) fn release_pinset<S: PinSet>(&self, ch: usize) {
+        let (data, clk) = pinset_kinds::<S>();
+        if data {
+            self.release_pin(ch, PinKind::Datin);
         }
-        if S::HAS_CLK
-            && let Err(e) = self.acquire_pin(ch, PinKind::Ckin)
-        {
-            if S::HAS_DATA {
-                self.release_pin(ch, PinKind::Datin);
-            }
-            return Err(e);
+        if clk {
+            self.release_pin(ch, PinKind::Ckin);
         }
-        Ok(())
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +154/-42)
```diff
@@ -45,6 +45,10 @@ where
     PS: PinSource,
     P: PowerState,
 {
+    /// Drop glue: releases the pin reservations this transceiver owns and
+    /// disables the channel. A guard field instead of a `Drop` impl so
+    /// [`Transceiver`] stays freely destructurable (`enable`/`disable`).
+    _guard: ChannelGuard<'a, 'd, T, M, S, PS>,
     pub(crate) common: &'a DfsdmCommon<'d, T, Enabled>,
     _instance_marker: PhantomData<T>,
     _transceiver_marker: PhantomData<M>,
@@ -65,6 +69,10 @@ where
 {
     fn new(common: &'a DfsdmCommon<'d, T, Enabled>) -> Self {
         Self {
+            _guard: ChannelGuard {
+                common,
+                _marker: PhantomData,
+            },
             common,
             _instance_marker: PhantomData,
             _transceiver_marker: PhantomData,
@@ -76,36 +84,46 @@ where
     }
 }
 
-impl<'a, 'd, T, M, S, MODE, PS, P> Drop for Transceiver<'a, 'd, T, M, S, MODE, PS, P>
+/// Releases a transceiver's pin reservations and disables its channel on drop.
+///
+/// A field of [`Transceiver`], so the latter has no `Drop` and can be rebuilt
+/// by struct update syntax in `enable`/`disable`.
+pub(crate) struct ChannelGuard<'a, 'd, T, M, S, PS>
+where
+    T: Instance,
+    M: TransceiverMarker + NextChannelForInstance<T>,
+    S: PinSet,
+    PS: PinSource,
+{
+    common: &'a DfsdmCommon<'d, T, Enabled>,
+    _marker: PhantomData<(M, S, PS)>,
+}
+
+impl<'a, 'd, T, M, S, PS> Drop for ChannelGuard<'a, 'd, T, M, S, PS>
 where
     T: Instance,
     M: TransceiverMarker + NextChannelForInstance<T>,
     S: PinSet,
-    MODE: ChannelMode,
     PS: PinSource,
-    P: PowerState,
 {
     fn drop(&mut self) {
-        // "Drop pin references" as we "manually" reference count
+        // Release the reservations this transceiver kept: its pinset `S` on
+        // the channel the pins belong to (the successor's when they came from
+        // the neighbour). The reservations it did not keep were already
+        // disclaimed at build time.
         let ch = if PS::FROM_NEIGHBOR {
             <M::Next as TransceiverMarker>::CHANNEL.index()
         } else {
             M::CHANNEL.index()
         };
+        self.common.release_pinset::<S>(ch);
 
-        if S::HAS_DATA {
-            self.common.release_pin(ch, PinKind::Datin);
-        }
-        if S::HAS_CLK {
-            self.common.release_pin(ch, PinKind::Ckin);
-        }
-
-        // Disabling will deactivate the detector flags,
-        // so we need to remove them from the cached version
+        // Disabling deactivates the detector flags, so drop them from the
+        // cached armed mask too.
         ShortCircuitDetector::<T>::drop_transceiver(M::CHANNEL);
         ClockAbsenceDetector::<T>::drop_transceiver(M::CHANNEL);
 
-        Self::set_enabled(false);
+        T::regs().ch(M::CHANNEL.index()).cfgr1().modify(|w| w.set_chen(false));
     }
 }
 
@@ -122,9 +140,26 @@ where
     pub fn disable(self) -> Transceiver<'a, 'd, T, M, S, MODE, PS, Disabled> {
         Self::set_enabled(false);
 
-        let common = self.common;
-        core::mem::forget(self);
-        Transceiver::new(common)
+        let Self {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: _,
+        } = self;
+        Transceiver {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: PhantomData,
+        }
     }
 
     /// Set the transceiver's offset.
@@ -176,10 +211,26 @@ where
     pub fn enable(self) -> Transceiver<'a, 'd, T, M, S, MODE, PS, Enabled> {
         Self::set_enabled(true);
 
-        let common = self.common;
-        core::mem::forget(self);
-
-        Transceiver::new(common)
+        let Self {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: _,
+        } = self;
+        Transceiver {
+            _guard,
+            common,
+            _instance_marker,
+            _transceiver_marker,
+            _pinset_marker,
+            _channel_mode_marker,
+            _pin_source_marker,
+            _powerstate_marker: PhantomData,
+        }
     }
 
     /// Set the transceiver's right-shift factor.
@@ -500,47 +551,64 @@ where
     }
 
     /// Parallel input from ADC writes to CHyDATINR (DATMPX=1).
-    /// No CKOUT, no pins needed. Serial pins declared on this transceiver
-    /// are disconnected (the builder's Flexes drop here - they're unused
-    /// in this mode).
+    ///
+    /// No CKOUT, no pins needed: serial pins declared on this transceiver a
```

**File**: `embassy-stm32/src/dfsdm/types.rs` (modified, +3/-2)
```diff
@@ -587,8 +587,9 @@ impl_trait! {
 // deliberately excluded
 
 /// Which transceiver's serial pins this transceiver's interface consumes
-/// (CFGR1.CHINSEL). Pins are borrowed from that transceiver's slot, so
-/// acquire/release live there too (see `Drop`).
+/// (CFGR1.CHINSEL). Pins are borrowed from that transceiver's slot; the
+/// reservation is released by the transceiver's drop guard (see
+/// [`ChannelGuard`]).
 pub trait PinSource: sealed::Sealed {
     /// Consume the next transceiver's pins instead of this transceiver's own.
     const FROM_NEIGHBOR: bool;
```

**File**: `examples/stm32h755cm7/src/bin/dfsdm_neighbor.rs` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+#![no_std]
+#![no_main]
+
+//! DFSDM neighbor-pin build demo.
+//!
+//! Builds channel 1 as `build_spi_int_neighbor`, so it reads *channel 2's*
+//! DATIN pin instead of declaring its own. Exercises the two-reservation pin
+//! model: channel 1's own slot is disclaimed at build time, and channel 2's
+//! slot reservation is released when the transceiver drops.
+
+use core::mem::MaybeUninit;
+
+use defmt::*;
+use defmt_rtt as _;
+use embassy_executor::Spawner;
+use embassy_stm32::dfsdm::config::{CkoutDivider, FilterOrder, FilterParameters, InternalSpiMode};
+use embassy_stm32::dfsdm::{FilterConfig, Flt0, ResultRegular};
+use embassy_stm32::gpio::{Level, Output, Speed};
+use embassy_stm32::peripherals::DFSDM1;
+use embassy_stm32::rcc::{self};
+use embassy_stm32::time::Hertz;
+use embassy_stm32::{SharedData, bind_interrupts, dfsdm};
+use panic_probe as _;
+
+#[unsafe(link_section = ".ram_d3.shared_data")]
+static SHARED_DATA: MaybeUninit<SharedData> = MaybeUninit::uninit();
+
+bind_interrupts!(struct Irqs {
+    DFSDM1_FLT0 => dfsdm::InterruptHandler<DFSDM1, Flt0>;
+});
+
+#[embassy_executor::main]
+async fn main(_spawner: Spawner) {
+    let mut config = embassy_stm32::Config::default();
+    {
+        use embassy_stm32::rcc::*;
+        config.rcc.hsi = Some(HSIPrescaler::Div1);
+        config.rcc.csi = true;
+        config.rcc.pll1 = Some(Pll {
+            source: PllSource::Hsi,
+            prediv: PllPreDiv::Div4,
+            mul: PllMul::Mul50,
+            divp: Some(PllDiv::Div2),
+            divq: Some(PllDiv::Div8), // 100mhz
+            divr: None,
+        });
+        config.rcc.sys = Sysclk::Pll1P; // 400 Mhz
+        config.rcc.ahb_pre = AHBPrescaler::Div2; // 200 Mhz
+        config.rcc.apb1_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb2_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb3_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.apb4_pre = APBPrescaler::Div2; // 100 Mhz
+        config.rcc.voltage_scale = VoltageScale::Scale1;
+        config.rcc.supply_config = SupplyConfig::DirectSMPS;
+    }
+
+    let p = embassy_stm32::init_primary(config, &SHARED_DATA);
+    info!("Hello World!");
+
+    // Mic as left channel: data valid at clock low, sampled on rising edge.
+    let _mic_sel = Output::new(p.PA3, Level::Low, Speed::Low);
+
+    let mic_clk_freq = Hertz::mhz(2);
+    let prescaler = rcc::frequency::<DFSDM1>() / mic_clk_freq;
+
+    // CKOUT on PC2.
+    let dfsdm1 = dfsdm::Dfsdm::new_ckout(
+        p.DFSDM1,
+        p.PC2,
+        dfsdm::config::CkoutSource::System,
+        CkoutDivider::try_from(prescaler as u16).expect("Divider wrong?"),
+    );
+
+    // Declare the mic data pin on channel 2. Channel 1 will borrow it.
+    let (common, split) = dfsdm1.configure_pins(|creator| {
+        (
+            creator.ch0.none(),
+            creator.ch1.none(),
+            creator.ch2.datin(p.PC5),
+            creator.ch3.none(),
+            creator.ch4.none(),
+            creator.ch5.none(),
+            creator.ch6.none(),
+            creator.ch7.none(),
+        )
+    });
+
+    // Channel 1 reads channel 2's DATIN pin (CHINSEL=1, next channel).
+    let channel_mic = split
+        .ch1
+        .build_spi_int_neighbor(&common, InternalSpiMode::SpiRising)
+        .set_data_right_shift(
+            FilterParameters::try_new(FilterOrder::Sinc3 { fosr: 100 }, 50)
+                .expect("inside bounds")
+                .recommended_shift()
+                .try_into()
+                .unwrap(),
+        )
+        .enable();
+
+    let flt_cfg = FilterConfig {
+        filter_params: FilterParameters::try_new(FilterOrder::Sinc3 { fosr: 100 }, 50).expect("inside bounds"),
+        ..Default::default()
+    };
+
+    let mut flt0 = split
+        .flt0
+        .build(&common, Irqs)
+        .enable_no_dma(&channel_mic, [&channel_mic], &flt_cfg);
+
+    flt0.regular.start_conversion();
+    info!("Reading neighbor-fed channel 1; polling for 2s...");
+
+    // Bounded polling: this is a build/pin-lifecycle smoke test, not a data
+    // test (the pin may be floating). It must run without panicking.
+    let mut count = 0u32;
+    let mut polls = 0u32;
+    while polls < 200_000 {
+        polls += 1;
+        if let Ok(ResultRegular { data, .. }) = flt0.regular.try_get_result() {
+            flt0.regular.start_conversion();
+            count += 1;
+            if count % 25 == 0 {
+                info!("sample {}: {}", count, data);
+            }
+        }
+    }
+    info!("PASS: neighbor-fed build ran; {} conversions seen", count);
+}
```

---

### Incident Patch 11: `4bb980dd` (2026-10-04)
**Commit Message**: Merge pull request #7174 from M3gaFr3ak/fix/dfsdm-drop-guards

dfsdm: replace manual drop workarounds with guard fields

**File**: `embassy-stm32/src/dfsdm/filter.rs` (modified, +31/-44)
```diff
@@ -76,6 +76,16 @@ where
     M: FilterMarker + InstanceEvents<T>,
     D: DmaMode,
 {
+    /// Drop glue for DFEN=0: a guard field instead of a `Drop` impl so `Filter`
+    /// stays freely destructurable.
+    ///
+    /// # Note
+    /// `Filter` intentionally has public fields for disjoint borrows of its
+    /// halves. Because it has no `Drop`, a struct-update pattern that discards
+    /// this field (`Filter { regular, .. }`) disables the filter early while the
+    /// extracted halves stay usable. Prefer [`Filter::disable`] or letting the
+    /// whole `Filter` drop.
+    _guard: FilterGuard<T, M>,
     common: &'a DfsdmCommon<'d, T, Enabled>,
     /// Regular-conversion half.
     pub regular: FilterRegular<'a, 'd, 'tr, T, M, D>,
@@ -87,6 +97,23 @@ where
     pub extremes: ExtremesDetector<'a, 'd, T, M>,
 }
 
+/// Sets DFEN=0 on drop. A guard field instead of a `Drop` impl on [`Filter`],
+/// so the latter stays freely destructurable.
+pub(crate) struct FilterGuard<T, M>(PhantomData<(T, M)>)
+where
+    T: Instance + FilterInterrupt<M>,
+    M: FilterMarker + InstanceEvents<T>;
+
+impl<T, M> Drop for FilterGuard<T, M>
+where
+    T: Instance + FilterInterrupt<M>,
+    M: FilterMarker + InstanceEvents<T>,
+{
+    fn drop(&mut self) {
+        FilterRegs::<T, M>::set_enabled(false);
+    }
+}
+
 /// Regular-conversion half of a filter.
 pub struct FilterRegular<'a, 'd, 't, T, M, D>
 where
@@ -171,6 +198,7 @@ where
         [(); N]: NonEmpty,
     {
         let filter = Filter {
+            _guard: FilterGuard(PhantomData),
             common: self.common,
             regular: FilterRegular::new(self.common, regular),
             injected: FilterInjected::new(self.common, injected),
@@ -272,17 +300,6 @@ where
     }
 }
 
-impl<'tr, 'ti, 'a, 'd, T, M, D> Drop for Filter<'tr, 'ti, 'a, 'd, T, M, D>
-where
-    T: Instance + FilterInterrupt<M>,
-    M: FilterMarker + InstanceEvents<T>,
-    D: DmaMode,
-{
-    fn drop(&mut self) {
-        FilterRegs::<T, M>::set_enabled(false);
-    }
-}
-
 impl<'tr, 'ti, 'a, 'd, T, M, D> Filter<'tr, 'ti, 'a, 'd, T, M, D>
 where
     T: Instance + FilterInterrupt<M>,
@@ -328,29 +345,14 @@ where
         self,
         transceiver: &'new_reg dyn TransceiverTrait<T, Enabled>,
     ) -> Filter<'new_reg, 'ti, 'a, 'd, T, M, D> {
-        FilterRegular::<'a, 'd, 'ti, T, M, D>::set_transceiver(transceiver.index());
-
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop` to prevent the destructor from
-        // running. We extract each field with `ptr::read`, which performs a bitwise
-        // move without invoking drop. The original `Filter` is never dropped and all
-        // extracted fields are moved into the new `Filter`, maintaining ownership
-        // invariants. Skipping the original `Filter`'s Drop is intentional: it would
-        // clear DFEN, but the returned `Filter` re-acquires that teardown obligation.
-        let common = unsafe { ptr::read(&this.common) };
-        let injected = unsafe { ptr::read(&this.injected) };
-        let awd = unsafe { ptr::read(&this.awd) };
-        let extremes = unsafe { ptr::read(&this.extremes) };
+        FilterRegular::<'a, 'd, 'tr, T, M, D>::set_transceiver(transceiver.index());
 
         Filter {
-            common,
             regular: FilterRegular {
                 _common: PhantomData,
                 regular: transceiver,
             },
-            injected,
-            awd,
-            extremes,
+            ..self
         }
     }
 
@@ -370,27 +372,12 @@ where
         let (slots, filterword) = FilterInjected::<'a, 'd, 'ti, T, M, D>::build_slots(transceivers);
         FilterInjected::<'a, 'd, 'ti, T, M, D>::set_channels(filterword);
 
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop` to prevent the destructor from
-        // running. We extract each field with `ptr::read`, which performs a bitwise
-        // move without invoking drop. The original `Filter` is never dropped and all
-        // extracted fields are moved into the new `Filter`, maintaining ownership
-        // invariants. Skipping the original `Filter`'s Drop is intentional: it would
-        // clear DFEN, but the returned `Filter` re-acquires that teardown obligation.
-        let common = unsafe { ptr::read(&this.common) };
-        let regular = unsafe { ptr::read(&this.regular) };
-        let awd = unsafe { ptr::read(&this.awd) };
-        let extremes = unsafe { ptr::read(&this.extremes) };
-
         Filter {
-            common,
-            regular,
             injected: FilterInjected {
                 injected: slots,
                 _common: PhantomData,
             },
-            awd,
-            extremes,
+            ..self
         }
     }
 }
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +40/-36)
```diff
@@ -13,8 +13,6 @@ pub mod types;
 use core::cell::RefCell;
 use core::future::poll_fn;
 use core::marker::PhantomData;
-use core::mem::ManuallyDrop;
-use core::ptr;
 use core::sync::atomic::{AtomicU8, Ordering};
 use core::task::Poll;
 
@@ -70,6 +68,10 @@ pub(crate) const I24_MIN: i32 = -0x80_0000;
 pub struct Dfsdm<'d, T: Instance, C: ClockOutputMode> {
     _instance_marker: PhantomData<T>,
     _clock_mode: PhantomData<C>,
+    /// Keeps the peripheral clock on while the entry point may still be
+    /// configured. Moved into [`DfsdmCommon`] by
+    /// [`Dfsdm::configure_pins`], which takes over the obligation.
+    _rcc: RccOff<T>,
     peri: Option<Peri<'d, T>>,
     ckout: Option<Flex<'d>>,
 }
@@ -138,6 +140,7 @@ where
         Self {
             _instance_marker: PhantomData,
             _clock_mode: PhantomData,
+            _rcc: RccOff(PhantomData),
             ckout,
             peri: Some(peri),
         }
@@ -184,12 +187,26 @@ where
 
 /// Holds references to the peripheral and the optional clock-output. Disables the RCC of the peripheral when dropped.
 pub struct DfsdmCommon<'d, T: Instance, P: PowerState> {
+    /// Drop glue for the peripheral clock: declared first so it drops before
+    /// the `Peri`/`Flex` fields, matching the previous `Drop` ordering.
+    _rcc: RccOff<T>,
     _peri: Peri<'d, T>,
     _ckout: Option<Flex<'d>>,
     _powerstate_marker: PhantomData<P>,
     datin_slots: [PinSlot<'d>; 8],
     ckin_slots: [PinSlot<'d>; 8],
 }
+
+/// Disables the peripheral clock on drop. A guard field instead of a `Drop`
+/// impl on [`DfsdmCommon`], so the latter stays freely destructurable.
+pub(crate) struct RccOff<T: Instance>(PhantomData<T>);
+
+impl<T: Instance> Drop for RccOff<T> {
+    fn drop(&mut self) {
+        rcc::disable::<T>();
+    }
+}
+
 impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
     pub(crate) fn insert_pin(&mut self, ch: usize, kind: PinKind, flex: Option<Flex<'d>>) {
         if let Some(p) = flex {
@@ -264,44 +281,15 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
         Ok(())
     }
-
-    fn into_raw_parts(self) -> (Peri<'d, T>, Option<Flex<'d>>, [PinSlot<'d>; 8], [PinSlot<'d>; 8]) {
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop`, so its destructor will not
-        // run. We use `ptr::read` to bitwise-move each field out, transferring
-        // ownership to the caller exactly once per field (the source value is
-        // consumed and intentionally never dropped). Since we never drop `this`,
-        // immediately return the extracted values, and nothing between the reads
-        // can unwind, no double-free, use-after-free or leak of `Flex` drop-glue
-        // can occur. (`Peri` is a ghost type carrying no real `&mut`, so copying
-        // it cannot alias.)
-        unsafe {
-            (
-                ptr::read(&this._peri),
-                ptr::read(&this._ckout),
-                ptr::read(&this.datin_slots),
-                ptr::read(&this.ckin_slots),
-            )
-        }
-    }
-}
-
-impl<'d, T, P> Drop for DfsdmCommon<'d, T, P>
-where
-    T: Instance,
-    P: PowerState,
-{
-    fn drop(&mut self) {
-        rcc::disable::<T>();
-    }
 }
 
 impl<'d, T> DfsdmCommon<'d, T, Disabled>
 where
     T: Instance,
 {
-    pub(crate) fn new(peri: Peri<'d, T>, ckout: Option<Flex<'d>>) -> Self {
+    pub(crate) fn new(rcc: RccOff<T>, peri: Peri<'d, T>, ckout: Option<Flex<'d>>) -> Self {
         Self {
+            _rcc: rcc,
             _peri: peri,
             _ckout: ckout,
             _powerstate_marker: PhantomData,
@@ -331,8 +319,16 @@ where
     /// Enables the peripheral.
     pub fn enable(self) -> DfsdmCommon<'d, T, Enabled> {
         T::regs().ch(0).cfgr1().modify(|w| w.set_dfsdmen(true));
-        let (_peri, _ckout, datin_slots, ckin_slots) = self.into_raw_parts();
+        let Self {
+            _rcc,
+            _peri,
+            _ckout,
+            datin_slots,
+            ckin_slots,
+            ..
+        } = self;
         DfsdmCommon {
+            _rcc,
             _peri,
             _ckout,
             _powerstate_marker: PhantomData,
@@ -354,8 +350,16 @@ where
     pub fn disable(self) -> DfsdmCommon<'d, T, Disabled> {
         T::regs().ch(0).cfgr1().modify(|w| w.set_dfsdmen(false));
 
-        let (_peri, _ckout, datin_slots, ckin_slots) = self.into_raw_parts();
+        let Self {
+            _rcc,
+            _peri,
+            _ckout,
+            datin_slots,
+            ckin_slots,
+            ..
+        } = self;
         DfsdmCommon {
+            _rcc,
             _peri,
             _ckout,
             _powerstate_marker: PhantomData,
@@ -409,7 +413,7 @@ where
     {
         let out = f(<T::Transceivers as Shape>::selectors::<T>());
 
-        let mut common = DfsdmCommon::new(self.peri.expect("taken once"), self.ckout.take()).enable();
+        let mut common = DfsdmCommon::new(
```

---

### Incident Patch 12: `c416e7da` (2026-10-04)
**Commit Message**: dfsdm: replace manual drop workarounds with guard fields

DfsdmCommon and Filter had `Drop` impls, so moving fields out of them
required ManuallyDrop + ptr::read, and DfsdmCommon's power-state flip
used into_raw_parts. Move the drop glue into private guard fields
instead:

- RccOff<T> disables the peripheral clock.
- FilterGuard<T, M> clears DFEN.

With no Drop on the outer types, into_raw_parts and both
replace_regular_transceiver / replace_injected_transceivers become
plain field moves (struct update syntax). Deletes all unsafe from
mod.rs and filter.rs.

The guard is declared first in DfsdmCommon so it still drops before
the Peri/Flex fields, matching the previous destructor ordering.

Dfsdm now owns an RccOff from construction (rcc::enable_and_reset
runs in new_inner) and moves it into DfsdmCommon in configure_pins.
Previously a Dfsdm dropped without configure_pins leaked the RCC
enable, since the guard was only created later.

**File**: `embassy-stm32/src/dfsdm/filter.rs` (modified, +31/-44)
```diff
@@ -76,6 +76,16 @@ where
     M: FilterMarker + InstanceEvents<T>,
     D: DmaMode,
 {
+    /// Drop glue for DFEN=0: a guard field instead of a `Drop` impl so `Filter`
+    /// stays freely destructurable.
+    ///
+    /// # Note
+    /// `Filter` intentionally has public fields for disjoint borrows of its
+    /// halves. Because it has no `Drop`, a struct-update pattern that discards
+    /// this field (`Filter { regular, .. }`) disables the filter early while the
+    /// extracted halves stay usable. Prefer [`Filter::disable`] or letting the
+    /// whole `Filter` drop.
+    _guard: FilterGuard<T, M>,
     common: &'a DfsdmCommon<'d, T, Enabled>,
     /// Regular-conversion half.
     pub regular: FilterRegular<'a, 'd, 'tr, T, M, D>,
@@ -87,6 +97,23 @@ where
     pub extremes: ExtremesDetector<'a, 'd, T, M>,
 }
 
+/// Sets DFEN=0 on drop. A guard field instead of a `Drop` impl on [`Filter`],
+/// so the latter stays freely destructurable.
+pub(crate) struct FilterGuard<T, M>(PhantomData<(T, M)>)
+where
+    T: Instance + FilterInterrupt<M>,
+    M: FilterMarker + InstanceEvents<T>;
+
+impl<T, M> Drop for FilterGuard<T, M>
+where
+    T: Instance + FilterInterrupt<M>,
+    M: FilterMarker + InstanceEvents<T>,
+{
+    fn drop(&mut self) {
+        FilterRegs::<T, M>::set_enabled(false);
+    }
+}
+
 /// Regular-conversion half of a filter.
 pub struct FilterRegular<'a, 'd, 't, T, M, D>
 where
@@ -171,6 +198,7 @@ where
         [(); N]: NonEmpty,
     {
         let filter = Filter {
+            _guard: FilterGuard(PhantomData),
             common: self.common,
             regular: FilterRegular::new(self.common, regular),
             injected: FilterInjected::new(self.common, injected),
@@ -272,17 +300,6 @@ where
     }
 }
 
-impl<'tr, 'ti, 'a, 'd, T, M, D> Drop for Filter<'tr, 'ti, 'a, 'd, T, M, D>
-where
-    T: Instance + FilterInterrupt<M>,
-    M: FilterMarker + InstanceEvents<T>,
-    D: DmaMode,
-{
-    fn drop(&mut self) {
-        FilterRegs::<T, M>::set_enabled(false);
-    }
-}
-
 impl<'tr, 'ti, 'a, 'd, T, M, D> Filter<'tr, 'ti, 'a, 'd, T, M, D>
 where
     T: Instance + FilterInterrupt<M>,
@@ -328,29 +345,14 @@ where
         self,
         transceiver: &'new_reg dyn TransceiverTrait<T, Enabled>,
     ) -> Filter<'new_reg, 'ti, 'a, 'd, T, M, D> {
-        FilterRegular::<'a, 'd, 'ti, T, M, D>::set_transceiver(transceiver.index());
-
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop` to prevent the destructor from
-        // running. We extract each field with `ptr::read`, which performs a bitwise
-        // move without invoking drop. The original `Filter` is never dropped and all
-        // extracted fields are moved into the new `Filter`, maintaining ownership
-        // invariants. Skipping the original `Filter`'s Drop is intentional: it would
-        // clear DFEN, but the returned `Filter` re-acquires that teardown obligation.
-        let common = unsafe { ptr::read(&this.common) };
-        let injected = unsafe { ptr::read(&this.injected) };
-        let awd = unsafe { ptr::read(&this.awd) };
-        let extremes = unsafe { ptr::read(&this.extremes) };
+        FilterRegular::<'a, 'd, 'tr, T, M, D>::set_transceiver(transceiver.index());
 
         Filter {
-            common,
             regular: FilterRegular {
                 _common: PhantomData,
                 regular: transceiver,
             },
-            injected,
-            awd,
-            extremes,
+            ..self
         }
     }
 
@@ -370,27 +372,12 @@ where
         let (slots, filterword) = FilterInjected::<'a, 'd, 'ti, T, M, D>::build_slots(transceivers);
         FilterInjected::<'a, 'd, 'ti, T, M, D>::set_channels(filterword);
 
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop` to prevent the destructor from
-        // running. We extract each field with `ptr::read`, which performs a bitwise
-        // move without invoking drop. The original `Filter` is never dropped and all
-        // extracted fields are moved into the new `Filter`, maintaining ownership
-        // invariants. Skipping the original `Filter`'s Drop is intentional: it would
-        // clear DFEN, but the returned `Filter` re-acquires that teardown obligation.
-        let common = unsafe { ptr::read(&this.common) };
-        let regular = unsafe { ptr::read(&this.regular) };
-        let awd = unsafe { ptr::read(&this.awd) };
-        let extremes = unsafe { ptr::read(&this.extremes) };
-
         Filter {
-            common,
-            regular,
             injected: FilterInjected {
                 injected: slots,
                 _common: PhantomData,
             },
-            awd,
-            extremes,
+            ..self
         }
     }
 }
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +40/-36)
```diff
@@ -13,8 +13,6 @@ pub mod types;
 use core::cell::RefCell;
 use core::future::poll_fn;
 use core::marker::PhantomData;
-use core::mem::ManuallyDrop;
-use core::ptr;
 use core::sync::atomic::{AtomicU8, Ordering};
 use core::task::Poll;
 
@@ -70,6 +68,10 @@ pub(crate) const I24_MIN: i32 = -0x80_0000;
 pub struct Dfsdm<'d, T: Instance, C: ClockOutputMode> {
     _instance_marker: PhantomData<T>,
     _clock_mode: PhantomData<C>,
+    /// Keeps the peripheral clock on while the entry point may still be
+    /// configured. Moved into [`DfsdmCommon`] by
+    /// [`Dfsdm::configure_pins`], which takes over the obligation.
+    _rcc: RccOff<T>,
     peri: Option<Peri<'d, T>>,
     ckout: Option<Flex<'d>>,
 }
@@ -138,6 +140,7 @@ where
         Self {
             _instance_marker: PhantomData,
             _clock_mode: PhantomData,
+            _rcc: RccOff(PhantomData),
             ckout,
             peri: Some(peri),
         }
@@ -184,12 +187,26 @@ where
 
 /// Holds references to the peripheral and the optional clock-output. Disables the RCC of the peripheral when dropped.
 pub struct DfsdmCommon<'d, T: Instance, P: PowerState> {
+    /// Drop glue for the peripheral clock: declared first so it drops before
+    /// the `Peri`/`Flex` fields, matching the previous `Drop` ordering.
+    _rcc: RccOff<T>,
     _peri: Peri<'d, T>,
     _ckout: Option<Flex<'d>>,
     _powerstate_marker: PhantomData<P>,
     datin_slots: [PinSlot<'d>; 8],
     ckin_slots: [PinSlot<'d>; 8],
 }
+
+/// Disables the peripheral clock on drop. A guard field instead of a `Drop`
+/// impl on [`DfsdmCommon`], so the latter stays freely destructurable.
+pub(crate) struct RccOff<T: Instance>(PhantomData<T>);
+
+impl<T: Instance> Drop for RccOff<T> {
+    fn drop(&mut self) {
+        rcc::disable::<T>();
+    }
+}
+
 impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
     pub(crate) fn insert_pin(&mut self, ch: usize, kind: PinKind, flex: Option<Flex<'d>>) {
         if let Some(p) = flex {
@@ -264,44 +281,15 @@ impl<'d, T: Instance, P: PowerState> DfsdmCommon<'d, T, P> {
         }
         Ok(())
     }
-
-    fn into_raw_parts(self) -> (Peri<'d, T>, Option<Flex<'d>>, [PinSlot<'d>; 8], [PinSlot<'d>; 8]) {
-        let this = ManuallyDrop::new(self);
-        // SAFETY: `this` is wrapped in `ManuallyDrop`, so its destructor will not
-        // run. We use `ptr::read` to bitwise-move each field out, transferring
-        // ownership to the caller exactly once per field (the source value is
-        // consumed and intentionally never dropped). Since we never drop `this`,
-        // immediately return the extracted values, and nothing between the reads
-        // can unwind, no double-free, use-after-free or leak of `Flex` drop-glue
-        // can occur. (`Peri` is a ghost type carrying no real `&mut`, so copying
-        // it cannot alias.)
-        unsafe {
-            (
-                ptr::read(&this._peri),
-                ptr::read(&this._ckout),
-                ptr::read(&this.datin_slots),
-                ptr::read(&this.ckin_slots),
-            )
-        }
-    }
-}
-
-impl<'d, T, P> Drop for DfsdmCommon<'d, T, P>
-where
-    T: Instance,
-    P: PowerState,
-{
-    fn drop(&mut self) {
-        rcc::disable::<T>();
-    }
 }
 
 impl<'d, T> DfsdmCommon<'d, T, Disabled>
 where
     T: Instance,
 {
-    pub(crate) fn new(peri: Peri<'d, T>, ckout: Option<Flex<'d>>) -> Self {
+    pub(crate) fn new(rcc: RccOff<T>, peri: Peri<'d, T>, ckout: Option<Flex<'d>>) -> Self {
         Self {
+            _rcc: rcc,
             _peri: peri,
             _ckout: ckout,
             _powerstate_marker: PhantomData,
@@ -331,8 +319,16 @@ where
     /// Enables the peripheral.
     pub fn enable(self) -> DfsdmCommon<'d, T, Enabled> {
         T::regs().ch(0).cfgr1().modify(|w| w.set_dfsdmen(true));
-        let (_peri, _ckout, datin_slots, ckin_slots) = self.into_raw_parts();
+        let Self {
+            _rcc,
+            _peri,
+            _ckout,
+            datin_slots,
+            ckin_slots,
+            ..
+        } = self;
         DfsdmCommon {
+            _rcc,
             _peri,
             _ckout,
             _powerstate_marker: PhantomData,
@@ -354,8 +350,16 @@ where
     pub fn disable(self) -> DfsdmCommon<'d, T, Disabled> {
         T::regs().ch(0).cfgr1().modify(|w| w.set_dfsdmen(false));
 
-        let (_peri, _ckout, datin_slots, ckin_slots) = self.into_raw_parts();
+        let Self {
+            _rcc,
+            _peri,
+            _ckout,
+            datin_slots,
+            ckin_slots,
+            ..
+        } = self;
         DfsdmCommon {
+            _rcc,
             _peri,
             _ckout,
             _powerstate_marker: PhantomData,
@@ -409,7 +413,7 @@ where
     {
         let out = f(<T::Transceivers as Shape>::selectors::<T>());
 
-        let mut common = DfsdmCommon::new(self.peri.expect("taken once"), self.ckout.take()).enable();
+        let mut common = DfsdmCommon::new(
```

---

### Incident Patch 13: `de0dbdb0` (2026-10-04)
**Commit Message**: Merge pull request #7173 from M3gaFr3ak/fix/dfsdm-awd-thresholds-overrun

dfsdm: fix watchdog, thresholds, overrun and FOSR bound

**File**: `embassy-stm32/src/dfsdm/config.rs` (modified, +14/-9)
```diff
@@ -649,10 +649,10 @@ impl FilterParameters {
     /// the given `width`.
     ///
     /// Returns [`Error::InvalidFilterParameters`] if `iosr` is outside
-    /// `1..=256`, the filter order's FOSR is invalid, or the resulting gain
-    /// exceeds the ceiling for `width`.
+    /// `1..=256`, the filter order's FOSR is outside `1..=1024`, or the
+    /// resulting gain exceeds the ceiling for `width`.
     pub fn try_new_for_width(order: FilterOrder, iosr: u16, width: InputWidth) -> Result<Self, Error> {
-        if (1..=256).contains(&iosr) && order.fosr() > 0 {
+        if (1..=256).contains(&iosr) && (1..=1024).contains(&order.fosr()) {
             let params = Self { order, iosr, width };
             if params.total_gain_checked().is_some() {
                 return Ok(params);
@@ -678,10 +678,10 @@ impl FilterParameters {
     /// method.
     ///
     /// Returns [`Error::InvalidFilterParameters`] if `iosr` is outside
-    /// `1..=256`, the filter order's FOSR is invalid, or the gain
+    /// `1..=256`, the filter order's FOSR is outside `1..=1024`, or the gain
     /// computation itself overflows `u128`.
     pub fn new_ignore_gain_ceiling(order: FilterOrder, iosr: u16) -> Result<Self, Error> {
-        if (1..=256).contains(&iosr) && order.fosr() > 0 && order.valid() {
+        if (1..=256).contains(&iosr) && (1..=1024).contains(&order.fosr()) && order.valid() {
             Ok(Self {
                 order,
                 iosr,
@@ -751,11 +751,16 @@ impl FilterParameters {
             .expect("FilterParameters: gain computation overflowed u128 for a validated instance")
     }
 
-    /// Recommended right-shift to achieve i24-fullscale results
+    /// Recommended right-shift to achieve i24-fullscale results.
+    ///
+    /// Assumes a full-scale input for the configured input width: +/-1 for
+    /// serial inputs, +/-2^15 for parallel inputs.
     pub fn recommended_shift(&self) -> u8 {
-        let gain = self.total_gain_wide();
-
-        gain.next_power_of_two().ilog2().saturating_sub(23) as u8
+        // Exponent arithmetic: shift = log2(gain) + (width bits - 1) - 23,
+        // computed without materializing the (possibly huge) product.
+        let gain_exp = self.total_gain_wide().next_power_of_two().ilog2();
+        let exp = gain_exp + self.width.bits() - 1;
+        exp.saturating_sub(23) as u8
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/detector.rs` (modified, +33/-8)
```diff
@@ -74,12 +74,21 @@ impl Default for AnalogWatchdogConfig {
             fastmode: false,
             low_break_signals: BreakSignals::empty(),
             high_break_signals: BreakSignals::empty(),
-            low_threshold: i32::MAX,
-            high_threshold: i32::MIN,
+            // Exact i24 extremes: never trigger in either AWFSEL mode (in
+            // fast mode the hardware compares the top 16 bits, which are
+            // exactly the i16 extremes).
+            low_threshold: I24_MIN,
+            high_threshold: I24_MAX,
         }
     }
 }
 
+/// Encodes a threshold for the 24-bit AWHT/AWLT fields: clamps to the i24
+/// range and re-encodes negatives as 24-bit two's complement.
+fn encode_threshold(threshold: i32) -> u32 {
+    (threshold.clamp(I24_MIN, I24_MAX) as u32) & 0xFF_FFFF
+}
+
 /// Analog watchdog event.
 pub enum AnalogWatchdogEvent {
     /// High threshold exceeded
@@ -153,19 +162,30 @@ where
     }
 
     /// Set the high threshold.
+    ///
+    /// Thresholds are on the 24-bit main-filter scale in both AWFSEL modes
+    /// and saturate to the i24 range: `0x7F_FFFF` / `-0x80_0000` (or any
+    /// out-of-range value) mean "never trigger". With fast mode enabled
+    /// (see [`enable_analog_watchdog_fastmode`](Self::enable_analog_watchdog_fastmode))
+    /// the hardware compares only the top 16 threshold bits against the
+    /// watchdog filter output (resolution 256); toggling fast mode does not
+    /// change the meaning of a stored threshold.
     pub fn set_high_threshold(&mut self, threshold: i32) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awhtr()
-            .modify(|w| w.set_awht(threshold as u32));
+            .modify(|w| w.set_awht(encode_threshold(threshold)));
     }
 
     /// Set the low threshold.
+    ///
+    /// See [`set_high_threshold`](Self::set_high_threshold) for the scale,
+    /// saturation and fast-mode semantics.
     pub fn set_low_threshold(&mut self, threshold: i32) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awltr()
-            .modify(|w| w.set_awlt(threshold as u32));
+            .modify(|w| w.set_awlt(encode_threshold(threshold)));
     }
 
     /// Assign break signals to fire on the high threshold.
@@ -198,6 +218,11 @@ where
     /// AWFSEL is per-channel and only meaningful in fast mode, where the
     /// watchdog compares against its own fast filter instead of the main filter
     /// output.
+    ///
+    /// Thresholds are mode-independent (see
+    /// [`set_high_threshold`](Self::set_high_threshold)): toggling this
+    /// changes the comparison source and its resolution, not the meaning of
+    /// already-written thresholds.
     pub fn enable_analog_watchdog_fastmode(&mut self, enabled: bool) {
         T::regs()
             .flt(M::CHANNEL.index())
@@ -292,16 +317,16 @@ where
     pub(crate) fn clear_high(channels: u8) {
         T::regs()
             .flt(M::CHANNEL.index())
-            .awsr()
-            .modify(|w| w.set_awhtf(channels));
+            .awcfr()
+            .write(|w| w.set_clrawhtf(channels));
     }
 
     /// Clears the provided channels' analog watchdog flags
     pub(crate) fn clear_low(channels: u8) {
         T::regs()
             .flt(M::CHANNEL.index())
-            .awsr()
-            .modify(|w| w.set_awltf(channels));
+            .awcfr()
+            .write(|w| w.set_clrawltf(channels));
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/filter.rs` (modified, +10/-0)
```diff
@@ -551,6 +551,11 @@ where
     /// Reading the result clears the corresponding data register.
     pub fn try_get_result(&mut self) -> Result<ResultRegular, Error> {
         if self.get_and_clear_overrun() {
+            // Drain the sample left over by the overrun so it is not served
+            // out of order by a later read.
+            if self.end_of_conversion() {
+                let _ = self.get_result_unchecked();
+            }
             return Err(Error::Overrun);
         } else if self.end_of_conversion() {
             return Ok(self.get_result_unchecked());
@@ -759,6 +764,11 @@ where
     /// Reading the result clears the corresponding data register.
     pub fn try_get_result(&mut self) -> Result<ResultInjected, Error> {
         if self.get_and_clear_overrun() {
+            // Drain the sample left over by the overrun so it is not served
+            // out of order by a later read.
+            if self.end_of_conversion() {
+                let _ = self.get_result_unchecked();
+            }
             return Err(Error::Overrun);
         } else if self.end_of_conversion() {
             return Ok(self.get_result_unchecked());
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +6/-0)
```diff
@@ -56,6 +56,12 @@ pub enum Error {
     InvalidConfig,
 }
 
+/// 24-bit signed data range shared by filter results (`RDATAR`/`JDATAR`),
+/// analog watchdog thresholds (`AWHT`/`AWLT`) and the extremes detector
+/// (`EXMAX`/`EXMIN`): literal RM-stated extremes.
+pub(crate) const I24_MAX: i32 = 0x7F_FFFF;
+pub(crate) const I24_MIN: i32 = -0x80_0000;
+
 // =============================================================================
 // Entrypoint to creating a DFSDM driver instance.
 // =============================================================================
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +7/-8)
```diff
@@ -146,22 +146,21 @@ where
 {
     /// Wait until this transceiver's clock-absence flag clears, indicating it
     /// is synchronized. Only meaningful for externally-clocked serial modes.
+    #[cfg(feature = "time")]
     pub async fn wait_for_sync(&mut self) {
         loop {
             if ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {
                 break;
             }
-            #[cfg(feature = "time")]
             embassy_time::Timer::after_millis(1).await;
-
-            #[cfg(not(feature = "time"))]
-            {
-                let freq = unsafe { crate::rcc::get_freqs() }.sys.to_hertz().unwrap().0 as u64;
-                let cycles = freq / 1_000; // 1ms
-                cortex_m::asm::delay(cycles as u32);
-            }
         }
     }
+
+    /// Blocking `wait_for_sync`: polls the clock-absence flag without
+    /// yielding. Available with and without the `time` feature.
+    pub fn blocking_wait_for_sync(&mut self) {
+        while !ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {}
+    }
 }
 
 /// Only when disabled
```

**File**: `examples/stm32h755cm7/src/bin/dfsdm_awd.rs` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+#![no_std]
+#![no_main]
+
+//! Analog watchdog (AWD) demo.
+//!
+//! Feeds a deterministic ramp through the parallel (CPU-write) input and
+//! checks the watchdog end to end:
+//!
+//! 1. a high-threshold crossing raises a high event, and the event flags
+//!    are actually cleared afterwards,
+//! 2. a low-threshold crossing raises a low event,
+//! 3. the default thresholds never trigger, including with fast mode
+//!    (AWFSEL) enabled - they saturate to the i24 "never trigger" extremes.
+//!
+//! With the filter order disabled, each conversion output is the sum of
+//! the last IOSR samples (verified by the `dfsdm_cpu_write` example), so
+//! thresholds are exactly predictable.
+
+use core::mem::MaybeUninit;
+
+use defmt::{assert_eq, info, panic};
+use defmt_rtt as _;
+use embassy_executor::Spawner;
+use embassy_futures::select::{Either, select};
+use embassy_stm32::dfsdm::config::{DataRightShift, FilterOrder, FilterParameters};
+use embassy_stm32::dfsdm::{AnalogWatchdogConfig, AnalogWatchdogEvent, FilterConfig, Flt0};
+use embassy_stm32::peripherals::DFSDM1;
+use embassy_stm32::{SharedData, bind_interrupts, dfsdm};
+use embassy_time::Timer;
+use panic_probe as _;
+
+/// Integrator oversampling ratio; conversion outputs are IOSR * sample.
+const IOSR: u16 = 32;
+
+#[unsafe(link_section = ".ram_d3.shared_data")]
+static SHARED_DATA: MaybeUninit<SharedData> = MaybeUninit::uninit();
+
+bind_interrupts!(struct Irqs {
+    DFSDM1_FLT0 => dfsdm::InterruptHandler<DFSDM1, Flt0>;
+});
+
+#[embassy_executor::main]
+async fn main(_spawner: Spawner) {
+    let mut config = embassy_stm32::Config::default();
+    {
+        use embassy_stm32::rcc::*;
+        config.rcc.hsi = Some(HSIPrescaler::Div1);
+        config.rcc.csi = true;
+        config.rcc.pll1 = Some(Pll {
+            source: PllSource::Hsi,
+            prediv: PllPreDiv::Div4,
+            mul: PllMul::Mul50,
+            divp: Some(PllDiv::Div2),
+            divq: Some(PllDiv::Div8),
+            divr: None,
+        });
+        config.rcc.sys = Sysclk::Pll1P;
+        config.rcc.ahb_pre = AHBPrescaler::Div2;
+        config.rcc.apb1_pre = APBPrescaler::Div2;
+        config.rcc.apb2_pre = APBPrescaler::Div2;
+        config.rcc.apb3_pre = APBPrescaler::Div2;
+        config.rcc.apb4_pre = APBPrescaler::Div2;
+        config.rcc.voltage_scale = VoltageScale::Scale1;
+        config.rcc.supply_config = SupplyConfig::DirectSMPS;
+    }
+
+    let p = embassy_stm32::init_primary(config, &SHARED_DATA);
+    info!("Hello World!");
+
+    let dfsdm1 = dfsdm::Dfsdm::new(p.DFSDM1);
+    let (common, split) = dfsdm1.configure_pins(|creator| {
+        (
+            creator.ch0.none(),
+            creator.ch1.none(),
+            creator.ch2.none(),
+            creator.ch3.none(),
+            creator.ch4.none(),
+            creator.ch5.none(),
+            creator.ch6.none(),
+            creator.ch7.none(),
+        )
+    });
+
+    // Standard packing: one 16-bit sample per CPU write.
+    let ch = split
+        .ch0
+        .build_parallel_standard(&common)
+        .set_data_right_shift(DataRightShift::new(0))
+        .enable();
+
+    // Disabled order: each conversion output = sum of the last IOSR samples.
+    let flt_cfg = FilterConfig {
+        filter_params: FilterParameters::try_new(FilterOrder::Disabled, IOSR).expect("inside bounds"),
+        enable_continuous_regular: true,
+        enable_fast_regular: false,
+        ..Default::default()
+    };
+
+    let mut flt0 = split.flt0.build(&common, Irqs).enable_no_dma(&ch, [&ch], &flt_cfg);
+    flt0.regular.start_conversion();
+    flt0.awd.assign_transceivers([&ch]);
+
+    // Phase 1: input +1000/sample => output +32000 > high threshold +16000.
+    flt0.awd.configure(AnalogWatchdogConfig {
+        low_threshold: -16000,
+        high_threshold: 16000,
+        ..Default::default()
+    });
+    for _ in 0..2 * IOSR as u32 {
+        ch.write(1000);
+    }
+    match flt0.awd.wait_for_event().await {
+        AnalogWatchdogEvent::HighThreshold { transceivers } => {
+            info!("high event, channels {:b}", transceivers);
+            assert_eq!(transceivers, 0b1);
+        }
+        AnalogWatchdogEvent::LowThreshold { .. } => panic!("expected a high event, got a low one"),
+    }
+    // Regression check: the event flags must read back cleared.
+    assert_eq!(flt0.awd.flags_high(), 0);
+    assert_eq!(flt0.awd.flags_low(), 0);
+
+    // Phase 2: input -1000/sample => output -32000 < low threshold -16000.
+    for _ in 0..2 * IOSR as u32 {
+        ch.write((-1000i16) as u16);
+    }
+    match flt0.awd.wait_for_event().await {
+        AnalogWatchdogEvent::LowThreshold { transceivers } => {
+            info!("low event, channels {:b}", transceivers);
+            assert_eq!(transceivers, 0b1);
+        }
+        AnalogWatchdogEvent::HighThreshold { .. } => panic!("expected a low event, got a high one"),
+    }
+    assert_eq!(flt0.awd.flags_high(), 0);
```

---

### Incident Patch 14: `744578fd` (2026-10-04)
**Commit Message**: dfsdm: fix watchdog, thresholds, overrun and FOSR bound

Several fixes from adversarial review of the DFSDM driver.

Analog watchdog:
- clear_high/clear_low wrote AWSR (status) instead of AWCFR (clear),
  so watchdog flags were never cleared and wait_for_event returned
  stale events forever. Write AWCFR instead.
- AnalogWatchdogConfig::default had low/high thresholds inverted
  (i32::MAX / i32::MIN), which truncate to 0xffffff/0x000000 in the
  24-bit fields and fire on almost every sample. Use the exact i24
  extremes via new shared I24_MIN/I24_MAX consts.
- set_high/low_threshold truncated the i32 into the 24-bit field.
  Clamp to the i24 range and re-encode negatives as two's
  complement so out-of-range values saturate to "never trigger".
  Thresholds stay on the 24-bit scale; in fast mode the hardware
  compares only the top 16 bits, and toggling fast mode no longer
  changes the meaning of a stored threshold.

Filter:
- try_get_result returned Err(Overrun) while leaving the stale
  sample in the data register, so the next read served it out of
  order. Drain it first.
- FilterParameters accepted FOSR above 1024 and silently truncated
  it to the 10-bit field. Bound both cons

**File**: `embassy-stm32/src/dfsdm/config.rs` (modified, +14/-9)
```diff
@@ -649,10 +649,10 @@ impl FilterParameters {
     /// the given `width`.
     ///
     /// Returns [`Error::InvalidFilterParameters`] if `iosr` is outside
-    /// `1..=256`, the filter order's FOSR is invalid, or the resulting gain
-    /// exceeds the ceiling for `width`.
+    /// `1..=256`, the filter order's FOSR is outside `1..=1024`, or the
+    /// resulting gain exceeds the ceiling for `width`.
     pub fn try_new_for_width(order: FilterOrder, iosr: u16, width: InputWidth) -> Result<Self, Error> {
-        if (1..=256).contains(&iosr) && order.fosr() > 0 {
+        if (1..=256).contains(&iosr) && (1..=1024).contains(&order.fosr()) {
             let params = Self { order, iosr, width };
             if params.total_gain_checked().is_some() {
                 return Ok(params);
@@ -678,10 +678,10 @@ impl FilterParameters {
     /// method.
     ///
     /// Returns [`Error::InvalidFilterParameters`] if `iosr` is outside
-    /// `1..=256`, the filter order's FOSR is invalid, or the gain
+    /// `1..=256`, the filter order's FOSR is outside `1..=1024`, or the gain
     /// computation itself overflows `u128`.
     pub fn new_ignore_gain_ceiling(order: FilterOrder, iosr: u16) -> Result<Self, Error> {
-        if (1..=256).contains(&iosr) && order.fosr() > 0 && order.valid() {
+        if (1..=256).contains(&iosr) && (1..=1024).contains(&order.fosr()) && order.valid() {
             Ok(Self {
                 order,
                 iosr,
@@ -751,11 +751,16 @@ impl FilterParameters {
             .expect("FilterParameters: gain computation overflowed u128 for a validated instance")
     }
 
-    /// Recommended right-shift to achieve i24-fullscale results
+    /// Recommended right-shift to achieve i24-fullscale results.
+    ///
+    /// Assumes a full-scale input for the configured input width: +/-1 for
+    /// serial inputs, +/-2^15 for parallel inputs.
     pub fn recommended_shift(&self) -> u8 {
-        let gain = self.total_gain_wide();
-
-        gain.next_power_of_two().ilog2().saturating_sub(23) as u8
+        // Exponent arithmetic: shift = log2(gain) + (width bits - 1) - 23,
+        // computed without materializing the (possibly huge) product.
+        let gain_exp = self.total_gain_wide().next_power_of_two().ilog2();
+        let exp = gain_exp + self.width.bits() - 1;
+        exp.saturating_sub(23) as u8
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/detector.rs` (modified, +33/-8)
```diff
@@ -74,12 +74,21 @@ impl Default for AnalogWatchdogConfig {
             fastmode: false,
             low_break_signals: BreakSignals::empty(),
             high_break_signals: BreakSignals::empty(),
-            low_threshold: i32::MAX,
-            high_threshold: i32::MIN,
+            // Exact i24 extremes: never trigger in either AWFSEL mode (in
+            // fast mode the hardware compares the top 16 bits, which are
+            // exactly the i16 extremes).
+            low_threshold: I24_MIN,
+            high_threshold: I24_MAX,
         }
     }
 }
 
+/// Encodes a threshold for the 24-bit AWHT/AWLT fields: clamps to the i24
+/// range and re-encodes negatives as 24-bit two's complement.
+fn encode_threshold(threshold: i32) -> u32 {
+    (threshold.clamp(I24_MIN, I24_MAX) as u32) & 0xFF_FFFF
+}
+
 /// Analog watchdog event.
 pub enum AnalogWatchdogEvent {
     /// High threshold exceeded
@@ -153,19 +162,30 @@ where
     }
 
     /// Set the high threshold.
+    ///
+    /// Thresholds are on the 24-bit main-filter scale in both AWFSEL modes
+    /// and saturate to the i24 range: `0x7F_FFFF` / `-0x80_0000` (or any
+    /// out-of-range value) mean "never trigger". With fast mode enabled
+    /// (see [`enable_analog_watchdog_fastmode`](Self::enable_analog_watchdog_fastmode))
+    /// the hardware compares only the top 16 threshold bits against the
+    /// watchdog filter output (resolution 256); toggling fast mode does not
+    /// change the meaning of a stored threshold.
     pub fn set_high_threshold(&mut self, threshold: i32) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awhtr()
-            .modify(|w| w.set_awht(threshold as u32));
+            .modify(|w| w.set_awht(encode_threshold(threshold)));
     }
 
     /// Set the low threshold.
+    ///
+    /// See [`set_high_threshold`](Self::set_high_threshold) for the scale,
+    /// saturation and fast-mode semantics.
     pub fn set_low_threshold(&mut self, threshold: i32) {
         T::regs()
             .flt(M::CHANNEL.index())
             .awltr()
-            .modify(|w| w.set_awlt(threshold as u32));
+            .modify(|w| w.set_awlt(encode_threshold(threshold)));
     }
 
     /// Assign break signals to fire on the high threshold.
@@ -198,6 +218,11 @@ where
     /// AWFSEL is per-channel and only meaningful in fast mode, where the
     /// watchdog compares against its own fast filter instead of the main filter
     /// output.
+    ///
+    /// Thresholds are mode-independent (see
+    /// [`set_high_threshold`](Self::set_high_threshold)): toggling this
+    /// changes the comparison source and its resolution, not the meaning of
+    /// already-written thresholds.
     pub fn enable_analog_watchdog_fastmode(&mut self, enabled: bool) {
         T::regs()
             .flt(M::CHANNEL.index())
@@ -292,16 +317,16 @@ where
     pub(crate) fn clear_high(channels: u8) {
         T::regs()
             .flt(M::CHANNEL.index())
-            .awsr()
-            .modify(|w| w.set_awhtf(channels));
+            .awcfr()
+            .write(|w| w.set_clrawhtf(channels));
     }
 
     /// Clears the provided channels' analog watchdog flags
     pub(crate) fn clear_low(channels: u8) {
         T::regs()
             .flt(M::CHANNEL.index())
-            .awsr()
-            .modify(|w| w.set_awltf(channels));
+            .awcfr()
+            .write(|w| w.set_clrawltf(channels));
     }
 }
 
```

**File**: `embassy-stm32/src/dfsdm/filter.rs` (modified, +10/-0)
```diff
@@ -551,6 +551,11 @@ where
     /// Reading the result clears the corresponding data register.
     pub fn try_get_result(&mut self) -> Result<ResultRegular, Error> {
         if self.get_and_clear_overrun() {
+            // Drain the sample left over by the overrun so it is not served
+            // out of order by a later read.
+            if self.end_of_conversion() {
+                let _ = self.get_result_unchecked();
+            }
             return Err(Error::Overrun);
         } else if self.end_of_conversion() {
             return Ok(self.get_result_unchecked());
@@ -759,6 +764,11 @@ where
     /// Reading the result clears the corresponding data register.
     pub fn try_get_result(&mut self) -> Result<ResultInjected, Error> {
         if self.get_and_clear_overrun() {
+            // Drain the sample left over by the overrun so it is not served
+            // out of order by a later read.
+            if self.end_of_conversion() {
+                let _ = self.get_result_unchecked();
+            }
             return Err(Error::Overrun);
         } else if self.end_of_conversion() {
             return Ok(self.get_result_unchecked());
```

**File**: `embassy-stm32/src/dfsdm/mod.rs` (modified, +6/-0)
```diff
@@ -56,6 +56,12 @@ pub enum Error {
     InvalidConfig,
 }
 
+/// 24-bit signed data range shared by filter results (`RDATAR`/`JDATAR`),
+/// analog watchdog thresholds (`AWHT`/`AWLT`) and the extremes detector
+/// (`EXMAX`/`EXMIN`): literal RM-stated extremes.
+pub(crate) const I24_MAX: i32 = 0x7F_FFFF;
+pub(crate) const I24_MIN: i32 = -0x80_0000;
+
 // =============================================================================
 // Entrypoint to creating a DFSDM driver instance.
 // =============================================================================
```

**File**: `embassy-stm32/src/dfsdm/transceiver.rs` (modified, +7/-8)
```diff
@@ -146,22 +146,21 @@ where
 {
     /// Wait until this transceiver's clock-absence flag clears, indicating it
     /// is synchronized. Only meaningful for externally-clocked serial modes.
+    #[cfg(feature = "time")]
     pub async fn wait_for_sync(&mut self) {
         loop {
             if ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {
                 break;
             }
-            #[cfg(feature = "time")]
             embassy_time::Timer::after_millis(1).await;
-
-            #[cfg(not(feature = "time"))]
-            {
-                let freq = unsafe { crate::rcc::get_freqs() }.sys.to_hertz().unwrap().0 as u64;
-                let cycles = freq / 1_000; // 1ms
-                cortex_m::asm::delay(cycles as u32);
-            }
         }
     }
+
+    /// Blocking `wait_for_sync`: polls the clock-absence flag without
+    /// yielding. Available with and without the `time` feature.
+    pub fn blocking_wait_for_sync(&mut self) {
+        while !ClockAbsenceDetector::<T>::try_clear_channel_flag(M::CHANNEL) {}
+    }
 }
 
 /// Only when disabled
```

**File**: `examples/stm32h755cm7/src/bin/dfsdm_awd.rs` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+#![no_std]
+#![no_main]
+
+//! Analog watchdog (AWD) demo.
+//!
+//! Feeds a deterministic ramp through the parallel (CPU-write) input and
+//! checks the watchdog end to end:
+//!
+//! 1. a high-threshold crossing raises a high event, and the event flags
+//!    are actually cleared afterwards,
+//! 2. a low-threshold crossing raises a low event,
+//! 3. the default thresholds never trigger, including with fast mode
+//!    (AWFSEL) enabled - they saturate to the i24 "never trigger" extremes.
+//!
+//! With the filter order disabled, each conversion output is the sum of
+//! the last IOSR samples (verified by the `dfsdm_cpu_write` example), so
+//! thresholds are exactly predictable.
+
+use core::mem::MaybeUninit;
+
+use defmt::{assert_eq, info, panic};
+use defmt_rtt as _;
+use embassy_executor::Spawner;
+use embassy_futures::select::{Either, select};
+use embassy_stm32::dfsdm::config::{DataRightShift, FilterOrder, FilterParameters};
+use embassy_stm32::dfsdm::{AnalogWatchdogConfig, AnalogWatchdogEvent, FilterConfig, Flt0};
+use embassy_stm32::peripherals::DFSDM1;
+use embassy_stm32::{SharedData, bind_interrupts, dfsdm};
+use embassy_time::Timer;
+use panic_probe as _;
+
+/// Integrator oversampling ratio; conversion outputs are IOSR * sample.
+const IOSR: u16 = 32;
+
+#[unsafe(link_section = ".ram_d3.shared_data")]
+static SHARED_DATA: MaybeUninit<SharedData> = MaybeUninit::uninit();
+
+bind_interrupts!(struct Irqs {
+    DFSDM1_FLT0 => dfsdm::InterruptHandler<DFSDM1, Flt0>;
+});
+
+#[embassy_executor::main]
+async fn main(_spawner: Spawner) {
+    let mut config = embassy_stm32::Config::default();
+    {
+        use embassy_stm32::rcc::*;
+        config.rcc.hsi = Some(HSIPrescaler::Div1);
+        config.rcc.csi = true;
+        config.rcc.pll1 = Some(Pll {
+            source: PllSource::Hsi,
+            prediv: PllPreDiv::Div4,
+            mul: PllMul::Mul50,
+            divp: Some(PllDiv::Div2),
+            divq: Some(PllDiv::Div8),
+            divr: None,
+        });
+        config.rcc.sys = Sysclk::Pll1P;
+        config.rcc.ahb_pre = AHBPrescaler::Div2;
+        config.rcc.apb1_pre = APBPrescaler::Div2;
+        config.rcc.apb2_pre = APBPrescaler::Div2;
+        config.rcc.apb3_pre = APBPrescaler::Div2;
+        config.rcc.apb4_pre = APBPrescaler::Div2;
+        config.rcc.voltage_scale = VoltageScale::Scale1;
+        config.rcc.supply_config = SupplyConfig::DirectSMPS;
+    }
+
+    let p = embassy_stm32::init_primary(config, &SHARED_DATA);
+    info!("Hello World!");
+
+    let dfsdm1 = dfsdm::Dfsdm::new(p.DFSDM1);
+    let (common, split) = dfsdm1.configure_pins(|creator| {
+        (
+            creator.ch0.none(),
+            creator.ch1.none(),
+            creator.ch2.none(),
+            creator.ch3.none(),
+            creator.ch4.none(),
+            creator.ch5.none(),
+            creator.ch6.none(),
+            creator.ch7.none(),
+        )
+    });
+
+    // Standard packing: one 16-bit sample per CPU write.
+    let ch = split
+        .ch0
+        .build_parallel_standard(&common)
+        .set_data_right_shift(DataRightShift::new(0))
+        .enable();
+
+    // Disabled order: each conversion output = sum of the last IOSR samples.
+    let flt_cfg = FilterConfig {
+        filter_params: FilterParameters::try_new(FilterOrder::Disabled, IOSR).expect("inside bounds"),
+        enable_continuous_regular: true,
+        enable_fast_regular: false,
+        ..Default::default()
+    };
+
+    let mut flt0 = split.flt0.build(&common, Irqs).enable_no_dma(&ch, [&ch], &flt_cfg);
+    flt0.regular.start_conversion();
+    flt0.awd.assign_transceivers([&ch]);
+
+    // Phase 1: input +1000/sample => output +32000 > high threshold +16000.
+    flt0.awd.configure(AnalogWatchdogConfig {
+        low_threshold: -16000,
+        high_threshold: 16000,
+        ..Default::default()
+    });
+    for _ in 0..2 * IOSR as u32 {
+        ch.write(1000);
+    }
+    match flt0.awd.wait_for_event().await {
+        AnalogWatchdogEvent::HighThreshold { transceivers } => {
+            info!("high event, channels {:b}", transceivers);
+            assert_eq!(transceivers, 0b1);
+        }
+        AnalogWatchdogEvent::LowThreshold { .. } => panic!("expected a high event, got a low one"),
+    }
+    // Regression check: the event flags must read back cleared.
+    assert_eq!(flt0.awd.flags_high(), 0);
+    assert_eq!(flt0.awd.flags_low(), 0);
+
+    // Phase 2: input -1000/sample => output -32000 < low threshold -16000.
+    for _ in 0..2 * IOSR as u32 {
+        ch.write((-1000i16) as u16);
+    }
+    match flt0.awd.wait_for_event().await {
+        AnalogWatchdogEvent::LowThreshold { transceivers } => {
+            info!("low event, channels {:b}", transceivers);
+            assert_eq!(transceivers, 0b1);
+        }
+        AnalogWatchdogEvent::HighThreshold { .. } => panic!("expected a low event, got a high one"),
+    }
+    assert_eq!(flt0.awd.flags_high(), 0);
```

---

### Incident Patch 15: `87f285db` (2026-10-04)
**Commit Message**: Merge pull request #7170 from xoviat/timeout

stm32: extract common changes from i2c-wait

**File**: `embassy-stm32/src/atomic.rs` (modified, +54/-0)
```diff
@@ -1,3 +1,4 @@
+use core::mem;
 use core::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, Ordering};
 
 use crate::pac::common::{Read, Reg, Write};
@@ -15,6 +16,7 @@ pub trait AtomicModify<T: Sized> {
 }
 
 impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
+    #[inline]
     fn set_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
             #[cfg(target_has_atomic = "32")]
@@ -46,6 +48,7 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
         }
     }
 
+    #[inline]
     fn clear_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
             #[cfg(target_has_atomic = "32")]
@@ -162,3 +165,54 @@ impl AtomicIncrement<u32> for AtomicU32 {
         self.fetch_add(1, Ordering::Acquire)
     }
 }
+
+#[allow(dead_code)]
+pub struct ActiveInterrupt<R: AtomicModify<T> + Copy, T: Sized + Copy> {
+    ptr: R,
+    reg: T,
+}
+
+impl<'a, R: AtomicModify<T> + Copy, T: Sized + Copy> Drop for ActiveInterrupt<R, T> {
+    fn drop(&mut self) {
+        self.ptr.clear_bits(|w| *w = self.reg);
+    }
+}
+
+#[allow(dead_code)]
+pub trait InterruptRegister<T: Sized + Copy> {
+    /// Atomically enable interrupts and return a guard that disables them
+    ///
+    /// Call `set_xxx(true)` inside the closure
+    fn enable_interrupts<'a>(&'a self, f: impl FnOnce(&mut T)) -> ActiveInterrupt<Self, T>
+    where
+        Self: Sized + Copy + AtomicModify<T>;
+}
+
+impl<T: Sized + Copy, A: Read + Write> InterruptRegister<T> for Reg<T, A> {
+    #[inline]
+    fn enable_interrupts<'a>(&'a self, f: impl FnOnce(&mut T)) -> ActiveInterrupt<Self, T>
+    where
+        Self: Sized + AtomicModify<T>,
+    {
+        let (t, u): (T, T) = unsafe {
+            let mut t: T = mem::zeroed();
+            let mut u: T = mem::zeroed();
+
+            let mut v = u32::MIN;
+
+            core::assert_eq!(size_of::<u32>(), size_of::<T>());
+            core::assert_eq!(align_of::<u32>(), align_of::<T>());
+
+            f(&mut *(&raw mut v as *mut T));
+
+            *(&raw mut t as *mut u32) = v;
+            *(&raw mut u as *mut u32) = !v;
+
+            (t, u)
+        };
+
+        self.set_bits(|w| *w = t);
+
+        ActiveInterrupt { ptr: *self, reg: u }
+    }
+}
```

**File**: `embassy-stm32/src/hsem/mod.rs` (modified, +9/-31)
```diff
@@ -14,8 +14,9 @@ use interrupt::typelevel::Interrupt;
 // The nonsecure lock/listen flow used here is compatible with the common
 // semaphore interface and remains usable across WBA52/54/55/65 families.
 use crate::Peri;
-use crate::atomic::AtomicModify;
+use crate::atomic::{ActiveInterrupt, InterruptRegister};
 use crate::cpu::CoreId;
+use crate::pac::common::{RW, Reg};
 use crate::peripherals::HSEM;
 use crate::rcc::RccPeripheral;
 use crate::{interrupt, pac};
@@ -76,34 +77,6 @@ impl<T: Instance> interrupt::typelevel::Handler<T::Interrupt> for HardwareSemaph
     }
 }
 
-struct ActiveInterrupt<T: Instance> {
-    core: CoreId,
-    index: u8,
-    _marker: PhantomData<T>,
-}
-
-impl<T: Instance> ActiveInterrupt<T> {
-    pub fn new(core: CoreId, index: u8) -> Self {
-        T::regs()
-            .ier(core.to_index().into())
-            .set_bits(|w| w.set_ise(index.into(), true));
-
-        Self {
-            core,
-            index,
-            _marker: PhantomData,
-        }
-    }
-}
-
-impl<T: Instance> Drop for ActiveInterrupt<T> {
-    fn drop(&mut self) {
-        T::regs()
-            .ier(self.core.to_index().into())
-            .clear_bits(|w| w.set_ise(self.index.into(), false));
-    }
-}
-
 /// Hardware semaphore mutex. The semaphore is unlocked when the guard is dropped
 pub struct HardwareSemaphoreMutex<'a, T: Instance> {
     index: u8,
@@ -248,12 +221,17 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
 
     /// Clear interrupts for this semaphore and return an active interrupt
     #[inline]
-    fn clear_and_enable_interupt(&self, core: CoreId) -> ActiveInterrupt<T> {
+    fn clear_and_enable_interupt(
+        &self,
+        core: CoreId,
+    ) -> ActiveInterrupt<Reg<pac::hsem::regs::Ier, RW>, pac::hsem::regs::Ier> {
         T::regs()
             .icr(core.to_index().into())
             .write(|w| w.set_isc(self.index.into(), true));
 
-        ActiveInterrupt::new(core, self.index)
+        T::regs()
+            .ier(core.to_index().into())
+            .enable_interrupts(|w| w.set_ise(self.index.into(), true))
     }
 
     #[cfg(all(stm32wb, feature = "low-power"))]
```

**File**: `embassy-stm32/src/i2c/mod.rs` (modified, +12/-37)
```diff
@@ -7,15 +7,14 @@ mod _version;
 
 mod config;
 
-use core::future::Future;
 use core::iter;
 use core::marker::PhantomData;
 
 pub use config::*;
 use embassy_hal_internal::Peri;
 use embassy_sync::waitqueue::AtomicWaker;
 #[cfg(feature = "time")]
-use embassy_time::{Duration, Instant};
+use embassy_time::Duration;
 use mode::MasterMode;
 pub use mode::{Master, MultiMaster};
 
@@ -26,8 +25,15 @@ use crate::mode::{Async, Blocking, Mode};
 use crate::pac::i2c::I2c as Regs;
 use crate::rcc::SealedRccPeripheral;
 use crate::time::Hertz;
+use crate::wait::{Timeout, TimeoutError};
 use crate::{interrupt, peripherals};
 
+impl From<TimeoutError> for Error {
+    fn from(_: TimeoutError) -> Self {
+        Error::Timeout
+    }
+}
+
 /// I2C error.
 #[derive(Debug, PartialEq, Eq, Copy, Clone)]
 #[cfg_attr(feature = "defmt", derive(defmt::Format))]
@@ -256,45 +262,14 @@ impl<'d, M: Mode> I2c<'d, M, Master> {
 
 impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
     fn timeout(&self) -> Timeout {
-        Timeout {
-            #[cfg(feature = "time")]
-            deadline: Instant::now() + self.timeout,
-        }
-    }
-}
-
-#[derive(Copy, Clone)]
-struct Timeout {
-    #[cfg(feature = "time")]
-    deadline: Instant,
-}
-
-#[allow(dead_code)]
-impl Timeout {
-    #[inline]
-    fn check(self) -> Result<(), Error> {
-        #[cfg(feature = "time")]
-        if Instant::now() > self.deadline {
-            return Err(Error::Timeout);
-        }
-
-        Ok(())
-    }
-
-    #[inline]
-    fn with<R>(self, fut: impl Future<Output = Result<R, Error>>) -> impl Future<Output = Result<R, Error>> {
         #[cfg(feature = "time")]
         {
-            use futures_util::FutureExt;
-
-            embassy_futures::select::select(embassy_time::Timer::at(self.deadline), fut).map(|r| match r {
-                embassy_futures::select::Either::First(_) => Err(Error::Timeout),
-                embassy_futures::select::Either::Second(r) => r,
-            })
+            Timeout::new(self.timeout)
         }
-
         #[cfg(not(feature = "time"))]
-        fut
+        {
+            Timeout::new()
+        }
     }
 }
 
```

**File**: `embassy-stm32/src/wait.rs` (modified, +129/-22)
```diff
@@ -1,30 +1,122 @@
-//! Provides a function to try until something is true
+//! Helpers for waiting: timeouts and poll-until-true utilities.
+
+use core::future::Future;
 
 #[cfg(feature = "time")]
-use embassy_time::Timer;
+use embassy_time::{Duration, Instant, Timer};
+
+/// Error returned when a [`Timeout`] expires.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+pub struct TimeoutError;
+
+/// A deadline-based timeout.
+///
+/// Without the `time` feature there is no clock, so a `Timeout` never expires:
+/// [`check`](Timeout::check) always succeeds, [`with`](Timeout::with) runs the
+/// future to completion, and [`try_until_result`] loops until the predicate
+/// returns `true`.
+#[derive(Copy, Clone)]
+pub struct Timeout {
+    #[cfg(feature = "time")]
+    deadline: Instant,
+}
+
+impl Timeout {
+    /// Create a timeout that expires `duration` from now.
+    #[cfg(feature = "time")]
+    pub fn new(duration: Duration) -> Self {
+        Self {
+            deadline: Instant::now() + duration,
+        }
+    }
+
+    /// Create a timeout that never expires.
+    #[cfg(not(feature = "time"))]
+    pub fn new() -> Self {
+        Self {}
+    }
+
+    #[cfg(feature = "time")]
+    pub fn from_micros(micros: u64) -> Self {
+        Self::new(Duration::from_micros(micros))
+    }
+
+    #[cfg(not(feature = "time"))]
+    pub fn from_micros(_micros: u64) -> Self {
+        Self::new()
+    }
+
+    #[cfg(feature = "time")]
+    pub(crate) fn deadline(&self) -> Instant {
+        self.deadline
+    }
+
+    /// Returns `Err(TimeoutError)` if the timeout has expired.
+    #[inline]
+    pub fn check(self) -> Result<(), TimeoutError> {
+        #[cfg(feature = "time")]
+        if Instant::now() > self.deadline {
+            return Err(TimeoutError);
+        }
 
-use crate::rcc;
+        #[cfg(not(feature = "time"))]
+        let _ = self;
+
+        Ok(())
+    }
+
+    /// Runs a future, returning `Err` if the timeout expires before the future completes.
+    #[inline]
+    pub fn with<R, E>(self, fut: impl Future<Output = Result<R, E>>) -> impl Future<Output = Result<R, E>>
+    where
+        E: From<TimeoutError>,
+    {
+        #[cfg(feature = "time")]
+        {
+            use futures_util::FutureExt;
+
+            embassy_futures::select::select(embassy_time::Timer::at(self.deadline), fut).map(|r| match r {
+                embassy_futures::select::Either::First(_) => Err(TimeoutError.into()),
+                embassy_futures::select::Either::Second(r) => r,
+            })
+        }
+
+        #[cfg(not(feature = "time"))]
+        fut
+    }
+}
 
 /// Performs a busy-wait delay for a specified number of microseconds that is async if possible
 #[allow(dead_code)]
-pub async fn wait_for_us(us: u64) {
+pub async fn wait_for_us(micros: u64) {
     #[cfg(feature = "time")]
-    Timer::after_micros(us).await;
+    Timer::after_micros(micros).await;
 
     #[cfg(not(feature = "time"))]
-    block_for_us(us);
+    block_for_us(micros);
 }
 
 /// Performs a busy-wait delay for a specified number of microseconds.
 #[allow(dead_code)]
-pub fn block_for_us(us: u64) {
-    cortex_m::asm::delay(unsafe { rcc::get_freqs().sys.to_hertz().unwrap().0 as u64 * us / 1_000_000 } as u32);
+pub fn block_for_us(micros: u64) {
+    #[cfg(feature = "time")]
+    embassy_time::block_for(Duration::from_micros(micros));
+
+    #[cfg(not(feature = "time"))]
+    cortex_m::asm::delay(
+        unsafe { crate::rcc::get_freqs().sys.to_hertz().unwrap().0 as u64 * micros / 1_000_000 } as u32,
+    );
 }
 
 #[cfg(feature = "time")]
-/// Function to try until something is true
+/// Polls `func` until it returns `true` or an error, `Err` from `func` is returned immediately,
+/// yielding to other tasks between polls. Returns `Err(TimeoutError)` if the timeout expires first.
 #[allow(dead_code)]
-pub async fn try_until(mut func: impl AsyncFnMut() -> bool, micros: u64) -> Result<(), ()> {
+pub async fn try_until_result<E: From<TimeoutError>>(
+    mut func: impl AsyncFnMut() -> Result<bool, E>,
+    timeout: Timeout,
+) -> Result<(), E> {
     use core::future::poll_fn;
     use core::task::Poll;
 
@@ -37,8 +129,8 @@ pub async fn try_until(mut func: impl AsyncFnMut() -> bool, micros: u64) -> Resu
             let mut ticker = Ticker::every(Duration::from_millis(1));
 
             loop {
-                if func().await {
-                    return;
+                if func().await? {
+                    return Ok(());
                 }
 
                 // Advance the ticker to the next pending tick
@@ -51,31 +143,46 @@ pub async fn try_until(mut func: impl AsyncFnMut() -> bool, micros: u64) -> Resu
                 ticker.next().await;
             }
         },
-        Timer::after_micros(micros),
+        Timer::at(timeout.deadline()),
     )
     .await
     {
-        Either::First(()) => Ok(()),
-        Either::Second(()) => Err(()),
+        Either::First(r) => r,
```

**File**: `tests/stm32/src/bin/tls.rs` (modified, +16/-3)
```diff
@@ -57,9 +57,22 @@ async fn main(spawner: Spawner) {
     embassy_crypto::rng_fill_bytes(&mut seed);
     let seed = u64::from_le_bytes(seed);
 
-    // Unique MAC id (eth.rs uses 1..=6) so eth and tls tests can run
-    // concurrently on different boards on the same LAN.
-    let mac_addr = [0x00, 7, 0xDE, 0xAD, 0xBE, 0xEF];
+    // Ensure different boards get different MAC
+    // so running tests concurrently doesn't break (they're all in the same LAN)
+    #[cfg(feature = "stm32f429zi")]
+    let n = 1;
+    #[cfg(feature = "stm32h755zi")]
+    let n = 2;
+    #[cfg(feature = "stm32h563zi")]
+    let n = 3;
+    #[cfg(feature = "stm32f767zi")]
+    let n = 4;
+    #[cfg(feature = "stm32f207zg")]
+    let n = 5;
+    #[cfg(feature = "stm32h753zi")]
+    let n = 6;
+
+    let mac_addr = [0x00, n, 0xDE, 0xAD, 0xBE, 0xEF];
 
     const PACKET_QUEUE_SIZE: usize = 4;
     static PACKETS: StaticCell<PacketQueue<PACKET_QUEUE_SIZE, PACKET_QUEUE_SIZE>> = StaticCell::new();
```

#### Recent Merged Pull Requests:
- **PR #7183** (2026-10-06): stm32/i2c: await STOPF after async DMA master writes (@Abrahamh08)
- **PR #7182** (2026-10-05): labeler: allow checkout (@xoviat)
- **PR #7181** (2026-10-06): wpan: get fus working (@xoviat)
- **PR #7180** (2026-10-05): Allow SAI ringbuffer to be started (TX direction) (@elagil)
- **PR #7179** (2026-10-05): dfsdm: gate pin ownership on transceiver build (@M3gaFr3ak)
- **PR #7178** (2026-10-05): Fix C5 flash write getting stuck (@usbalbin)
- **PR #7177** (2026-10-05): dfsdm: cleanup and API polish (@M3gaFr3ak)
- **PR #7176** (2026-10-05): cyw: small cleanup (@xoviat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
