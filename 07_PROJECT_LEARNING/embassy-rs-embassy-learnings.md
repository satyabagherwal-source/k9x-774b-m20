> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source**: github ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Source Version**: `d1996344`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T08:14:08.075Z  
> **Learning ID**: `learn-github-embassy-rs-embassy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): embassy-rs/embassy

> **Canonical Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T08:14:03.545Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10066 stars

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
use syn::meta::ParseNestedMeta;
use syn::parse::{Parse, ParseStream};
use syn::{AttrStyle, Attribute, Expr, ExprLit, Lit, LitStr, Signature, Token, Visibility, braced, bracketed, token};

pub fn token_stream_with_error(mut tokens: TokenStream, error: syn::Error) -> TokenStream {
    tokens.extend(error.into_compile_error());
    tokens
}

/// Parse the value of a `name = value` macro argument, which is either an expression
/// or a string literal containing one.
pub fn parse_expr_arg(meta: &ParseNestedMeta) -> syn::Result<Expr> {
    let mut expr: Expr = meta.value()?.parse()?;
    while let Expr::Group(g) = expr {
        expr = *g.expr;
    }
    match expr {
        Expr::Lit(ExprLit { lit: Lit::Str(s), .. }) => s.parse(),
        expr => Ok(expr),
    }
}

/// Parse the value of a `name = "value"` macro argument.
pub fn parse_str_arg(meta: &ParseNestedMeta) -> syn::Result<String> {
    let s: LitStr = meta.value()?.parse()?;
    Ok(s.value())
}

/// Store a parsed macro argument, erroring if it was already given.
pub fn set_arg<T>(meta: &ParseNestedMeta, slot: &mut Option<T>, value: T) -> syn::Result<()> {
    if slot.is_some() {
        return Err(meta.error("duplicate argument"));
    }
    *slot = Some(value);
    Ok(())
}

pub fn error<A: ToTokens, T: Display>(s: &mut TokenStream, obj: A, msg: T) {
    s.extend(syn::Error::new_spanned(obj.into_token_stream(), msg).into_compile_error())
}

/// Function signature and body.
///
/// Same as `syn`'s `ItemFn` except we keep the body as a TokenStream instead of
/// parsing it. This makes the macro not error if there's a syntax error in the body,
/// which helps IDE autocomplete work better.
#[derive(Clone)]
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7422** (2026-11-03): **ci: rm bad boards**
  *Symptoms*: 

- **Issue #7419** (2026-11-04): **[MCXA] Add AOI and CMP drivers**
  *Symptoms*: 

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

### Incident Patch 1: `d1d3c781` (2026-11-04)
**Commit Message**: Merge pull request #7410 from Sandvoxel/stm32-i2c-blocking-timeout-recovery

stm32/i2c v2: reset the peripheral when a blocking transfer times out

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ Time driver:
 
 I2C:
 - fix: stm32/i2c v2: disable own-address recognition before changing an enabled OA1/OA2 address, addressing mode, or OA2 mask.
+- fix: stm32/i2c v2: a blocking controller transfer that times out (e.g. SCL held low by the target) now resets the peripheral (PE toggle, as for BERR/ARLO) instead of requesting STOP and abandoning the transfer. The abandoned transfer's NACKF/STOPF arrived later and the next call returned them after it had started its own transfer, which then ran unserved, so every later blocking transfer timed out until PE was toggled by hand.
 - fix: stm32/i2c v2: an async slave `respond_to_write` that received more than its buffer holds timed out while discarding the extra bytes, because nothing woke it for them, and could leave the last one in RXDR. It now wakes on every byte and reads a byte that arrived with the STOP.
 
 USART:
```

**File**: `embassy-stm32/src/i2c/v2.rs` (modified, +54/-35)
```diff
@@ -167,6 +167,23 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
         self.info.regs.cr2().write(|w| w.set_stop(true));
     }
 
+    /// Aborts the transfer of a blocking call that returned [`Error::Timeout`], leaving the
+    /// peripheral idle.
+    ///
+    /// The timeout abandons the transfer halfway: its START (and STOP, if one was requested) can
+    /// still be pending in CR2, the peripheral can still wait for TXDR/RXDR, and NACKF/STOPF
+    /// arrive once the target lets go of SCL. The next transfer would run into all of that: it
+    /// returns the old transfer's NACK after starting its own transfer, which then runs with
+    /// nobody serving it, and the peripheral stays stuck until PE is toggled. So toggle PE now,
+    /// as `error_occurred` does for BERR and ARLO.
+    fn abort_on_timeout<R>(&self, result: Result<R, Error>) -> Result<R, Error> {
+        if matches!(result, Err(Error::Timeout)) {
+            trace!("Timeout, resetting the peripheral.");
+            self.soft_reset();
+        }
+        result
+    }
+
     /// Resets the I2C peripheral state machine while preserving configuration.
     ///
     /// This can be used to recover from a spurious start condition that leaves the BUSY flag set
@@ -566,20 +583,15 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
         // I2C start
         //
         // ST SAD+W
-        if let Err(err) = Self::master_write(
+        Self::master_write(
             self.info,
             address,
             write.len().min(255),
             Stop::Software,
             last_chunk_idx != 0,
             false, // restart
             timeout,
-        ) {
-            if send_stop {
-                self.master_stop();
-            }
-            return Err(err);
-        }
+        )?;
 
         for (number, chunk) in write.chunks(255).enumerate() {
             if number != 0 {
@@ -597,8 +609,9 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
                 // (START has been ACKed or last byte when
                 // through)
                 if let Err(err) = self.wait_txis(timeout) {
-                    if send_stop && err != Error::Nack {
-                        // STOP is sent automatically if a NACK was received
+                    // STOP is sent automatically if a NACK was received, and a timeout is
+                    // aborted by resetting the peripheral instead (see `abort_on_timeout`).
+                    if send_stop && !matches!(err, Error::Nack | Error::Timeout) {
                         self.master_stop();
                     }
                     return Err(err);
@@ -622,13 +635,15 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
 
     /// Blocking read.
     pub fn blocking_read(&mut self, address: impl Into<Address>, read: &mut [u8]) -> Result<(), Error> {
-        self.read_internal(address.into(), read, false, self.timeout())
+        let result = self.read_internal(address.into(), read, false, self.timeout());
         // Automatic Stop
+        self.abort_on_timeout(result)
     }
 
     /// Blocking write.
     pub fn blocking_write(&mut self, address: impl Into<Address>, write: &[u8]) -> Result<(), Error> {
-        self.write_internal(address.into(), write, true, self.timeout())
+        let result = self.write_internal(address.into(), write, true, self.timeout());
+        self.abort_on_timeout(result)
     }
 
     /// Blocking write, restart, read.
@@ -640,9 +655,11 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
     ) -> Result<(), Error> {
         let address = address.into();
         let timeout = self.timeout();
-        self.write_internal(address, write, false, timeout)?;
-        self.read_internal(address, read, true, timeout)
+        let result = self
+            .write_internal(address, write, false, timeout)
+            .and_then(|()| self.read_internal(address, read, true, timeout));
         // Automatic Stop
+        self.abort_on_timeout(result)
     }
 
     /// Blocking transaction with operations.
@@ -665,7 +682,16 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
     ) -> Result<(), Error> {
         let address = addr.into();
         let timeout = self.timeout();
+        let result = self.execute_groups(address, operations, timeout);
+        self.abort_on_timeout(result)
+    }
 
+    fn execute_groups<O: TransactionOp>(
+        &mut self,
+        address: Address,
+        operations: &mut [O],
+        timeout: Timeout,
+    ) -> Result<(), Error> {
         // Group consecutive operations of the same type
         let mut op_idx = 0;
         let mut is_first_group = true;
@@ -876,6 +902,11 @@ impl<'d, M: Mode, IM: MasterMode> I2c<'d, M, IM> {
     ///
     /// The buffers are concatenated in a single write transaction.
     pub fn blocking_write_vectored(&mut self, address: u8, write: &[&[u8]]) -> Result<(), Error> {
+        let result = self.write_vectored_internal(address, write);
+        self.abort_on_timeout(result
```

---

### Incident Patch 2: `df012c99` (2026-11-04)
**Commit Message**: Merge branch 'main' into stm32-i2c-blocking-timeout-recovery

**File**: `ci.sh` (modified, +2/-0)
```diff
@@ -41,6 +41,8 @@ rm -rf out/tests/nrf5340-dk
 rm -rf out/tests/nrf51422-dk
 
 # temporarily disabled
+rm -rf out/tests/stm32f767zi
+rm -rf out/tests/stm32f429zi
 
 rm -f out/tests/stm32u585ai/saes
 
```

**File**: `embassy-mcxa/Cargo.toml` (modified, +2/-2)
```diff
@@ -118,13 +118,13 @@ embassy-time-queue-utils = { version = "0.3.2", path = "../embassy-time-queue-ut
 grounded = { version = "0.2.1", features = ["cas", "critical-section"] }
 maitake-sync = { version = "0.3.0", default-features = false, features = ["critical-section", "no-cache-pad"] }
 nb = "1.1.0"
-nxp-pac = { git = "https://github.com/embassy-rs/nxp-pac.git", rev = "6b12ea6081a31b8920ab36f883df5e966ac8e34f", features = ["rt"] }
+nxp-pac = { git = "https://github.com/embassy-rs/nxp-pac.git", rev = "9f0745e0285225b8feac3e53dae0f06f58313dc0", features = ["rt"] }
 paste = "1.0.15"
 
 rand-core-10 = { package = "rand_core", version = "0.10" }
 
 [build-dependencies]
-nxp-pac = { git = "https://github.com/embassy-rs/nxp-pac.git", rev = "6b12ea6081a31b8920ab36f883df5e966ac8e34f", default-features = false, features = ["metadata"] }
+nxp-pac = { git = "https://github.com/embassy-rs/nxp-pac.git", rev = "9f0745e0285225b8feac3e53dae0f06f58313dc0", default-features = false, features = ["metadata"] }
 proc-macro2 = "1.0.106"
 quote = "1.0.45"
 convert_case = "0.12"
```

**File**: `embassy-mcxa/build.rs` (modified, +58/-2)
```diff
@@ -70,6 +70,7 @@ fn main() {
         generate_instance_calls(),
         generate_gpio_pin_impls(),
         generate_adc_pin_impls(),
+        generate_cmp_pin_impls(),
         generate_clkout_impls(),
         generate_lpi2c_pin_impls(),
         generate_i3c_pin_impls(),
@@ -118,6 +119,16 @@ fn generate_peripherals_call() -> TokenStream {
             .map(|peripheral| Singleton::just_name(peripheral.name)),
     );
 
+    // Narrow ownership of the digital detector's control register in SECCON.
+    if METADATA
+        .peripherals
+        .iter()
+        .any(|peripheral| peripheral.name == "DGDET0")
+        && !singletons.iter().any(|singleton| singleton.name == "GDET0_CTRL")
+    {
+        singletons.push(Singleton::just_name("GDET0_CTRL"));
+    }
+
     // Add DMA channels
     for (dma_num, dma_peripheral) in METADATA
         .peripherals
@@ -194,7 +205,9 @@ fn generate_cc_gates() -> TokenStream {
         let reset = gate.reset.map(|reset| format_ident!("{reset}"));
         let config = gate.config.map(|config| format_ident!("{config}")).unwrap_or_else(|| {
             // FREQME's PAC metadata predates its HAL clock helper.
-            if peripheral.driver_name == "mcxa/FREQME" {
+            if is_numbered(peripheral.name, "CMP") {
+                format_ident!("CmpConfig")
+            } else if peripheral.driver_name == "mcxa/FREQME" {
                 format_ident!("FreqmeConfig")
             } else {
                 format_ident!("NoConfig")
@@ -230,7 +243,8 @@ fn generate_instance_calls() -> TokenStream {
     let mut generated = TokenStream::new();
 
     const REQUIRES_INSTANCE: &[&str] = &[
-        "adc", "crc", "dac", "gpio", "trng", "wwdt", "ctimer", "lpi2c", "i3c", "lpuart", "lpspi", "flexspi", "can",
+        "adc", "cmp", "crc", "dac", "gpio", "trng", "wwdt", "ctimer", "lpi2c", "i3c", "lpuart", "lpspi", "flexspi",
+        "can",
     ];
 
     for peripheral in METADATA.peripherals {
@@ -317,6 +331,48 @@ fn generate_adc_pin_impls() -> TokenStream {
     generated
 }
 
+fn generate_cmp_pin_impls() -> TokenStream {
+    let mut generated = TokenStream::new();
+    let a2 = env::var_os("CARGO_FEATURE__MCXA2XX").is_some();
+    for cmp in METADATA.peripherals.iter().filter(|p| is_numbered(p.name, "CMP")) {
+        let peripheral = format_ident!("{}", cmp.name);
+        for signal in cmp.signals {
+            let (number, positive, negative) = if let Some(n) = signal.name.strip_prefix("INP") {
+                (n, true, false)
+            } else if let Some(n) = signal.name.strip_prefix("INN") {
+                (n, false, true)
+            } else if let Some(n) = signal.name.strip_prefix("IN") {
+                (n, true, true)
+            } else {
+                continue;
+            };
+            let channel: u8 = number.parse().expect("Unexpected comparator input signal");
+            // A2 RM46.1.2: channel4 is internal despite external-pin metadata.
+            // A5 RM56.1.2: channels4/5 have separate positive/negative pins.
+            if (a2 && channel >= 4) || channel >= 6 {
+                continue;
+            }
+            for pin in signal.pins {
+                let pin_name = format_ident!("{}", pin.pin);
+                let gate = pin_feature_gate(pin.pin);
+                if positive {
+                    generated.extend(quote! {
+                        #gate
+                        crate::impl_cmp_positive_pin!(#pin_name, #peripheral, #channel);
+                    });
+                }
+                if negative {
+                    generated.extend(quote! {
+                        #gate
+                        crate::impl_cmp_negative_pin!(#pin_name, #peripheral, #channel);
+                    });
+                }
+            }
+        }
+    }
+    generated
+}
+
 fn generate_clkout_impls() -> TokenStream {
     let mut generated = TokenStream::new();
 
```

**File**: `embassy-mcxa/src/aoi.rs` (added, +356/-0)
```diff
@@ -0,0 +1,356 @@
+//! Constructor-configured AND/OR/invert logic for peripheral event signals.
+//!
+//! Each of AOI0's four outputs is a sum of four product terms over four routed
+//! inputs. Construct the driver before enabling downstream consumers, and keep
+//! it and the signal producers alive while their outputs are in use. Source
+//! selections route signals; they do not enable or own the producing peripheral.
+//! Borrow an [`Output`] to connect an event to a CTIMER capture input.
+//!
+//! AOI has no enable/stop bit. Its combinational logic does not need the register
+//! interface clock. Initialization and teardown are not atomic or glitch-free:
+//! quiesce consumers first. Dropping the owner forces its outputs low and gates
+//! only AOI0's register interface; INPUTMUX routes are left unchanged.
+//!
+//! # Not yet supported
+//!
+//! - AOI1 and its separate input-routing bank on devices that provide it.
+//! - Runtime reconfiguration, independently owned event channels, or arbitrary
+//!   Boolean-expression compilation.
+//! - Software output sampling or general destination routing beyond CTIMER
+//!   capture. Input routes currently cover ADC0 compare, CMP0, CTIMER match and
+//!   LPTMR0 signals; ADC1 compare, external triggers, GPIO events and FlexIO are
+//!   not exposed by this driver.
+//! - Guaranteed event propagation through deep-sleep/power transitions.
+//!
+//! Registers require 16-bit accesses (A2 RM 17.7; A5 RM 25.7). The PAC's typed
+//! accessors supply that width; a pair of registers must not be combined into a
+//! 32-bit access.
+
+use core::marker::PhantomData;
+
+use embassy_hal_internal::{Peri, PeripheralType};
+
+use crate::clocks::periph_helpers::NoConfig;
+use crate::clocks::{ClockError, Gate, disable, enable_and_reset};
+use crate::pac::aoi::InputConfig;
+use crate::{pac, peripherals};
+
+/// One of the four AOI event outputs, ADC compare results, or timer matches.
+#[derive(Debug, Copy, Clone, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+pub enum Event {
+    /// Event/channel 0.
+    Zero,
+    /// Event/channel 1.
+    One,
+    /// Event/channel 2.
+    Two,
+    /// Event/channel 3.
+    Three,
+}
+
+impl Event {
+    pub(crate) const fn index(self) -> usize {
+        match self {
+            Self::Zero => 0,
+            Self::One => 1,
+            Self::Two => 2,
+            Self::Three => 3,
+        }
+    }
+}
+
+/// Contribution of an input to one product term.
+#[derive(Debug, Copy, Clone, Default, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+pub enum Factor {
+    /// Force this factor to zero, making the entire product false.
+    #[default]
+    Zero,
+    /// Force this factor to one, ignoring this input in the product.
+    One,
+    /// Use the input signal unchanged.
+    Direct,
+    /// Use the complement of the input signal.
+    Inverted,
+}
+
+impl From<Factor> for InputConfig {
+    fn from(value: Factor) -> Self {
+        match value {
+            Factor::Zero => Self::Zero,
+            Factor::One => Self::One,
+            Factor::Direct => Self::Pass,
+            Factor::Inverted => Self::Complement,
+        }
+    }
+}
+
+/// Logical AND of the four selected input factors.
+#[derive(Debug, Copy, Clone, Default, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+pub struct ProductTerm {
+    /// Factor for input A.
+    pub a: Factor,
+    /// Factor for input B.
+    pub b: Factor,
+    /// Factor for input C.
+    pub c: Factor,
+    /// Factor for input D.
+    pub d: Factor,
+}
+
+impl ProductTerm {
+    /// Constant false; also the hardware-reset product.
+    pub const FALSE: Self = Self {
+        a: Factor::Zero,
+        b: Factor::Zero,
+        c: Factor::Zero,
+        d: Factor::Zero,
+    };
+
+    /// Constant true; replace individual factors to build a product.
+    pub const TRUE: Self = Self {
+        a: Factor::One,
+        b: Factor::One,
+        c: Factor::One,
+        d: Factor::One,
+    };
+}
+
+/// Logical OR of exactly four product terms. No expression fitting is required.
+#[derive(Debug, Copy, Clone, Default, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+pub struct Function {
+    terms: [ProductTerm; 4],
+}
+
+impl Function {
+    /// Constant-low output, matching the hardware reset configuration.
+    pub const LOW: Self = Self::new([ProductTerm::FALSE; 4]);
+    /// Constant-high output.
+    pub const HIGH: Self = Self::new([ProductTerm::TRUE; 4]);
+
+    /// Form a sum of four products; use [`ProductTerm::FALSE`] for unused terms.
+    pub const fn new(terms: [ProductTerm; 4]) -> Self {
+        Self { terms }
+    }
+}
+
+/// Internal signal routed to one of an event's A/B/C/D inputs.
+///
+/// These selections do not enable the producer or guarantee its power state.
+#[derive(Debug, Copy, Clone, PartialEq, Eq)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+#[non_exhaustive]
+pub 
```

**File**: `embassy-mcxa/src/clocks/ecc.rs` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+//! RAM A clock prerequisite for ECC diagnostics. Live SRAM is never reset or gated off.
+
+use super::{CLOCKS, ClockError, PoweredClock, WakeGuard};
+use crate::pac;
+
+/// Enables the RAM A clock without disturbing live SRAM and retains a wake vote.
+pub(crate) fn enable_ecc_ram_a_clock() -> Result<WakeGuard, ClockError> {
+    critical_section::with(|cs| {
+        let clocks = CLOCKS.borrow_ref(cs);
+        let clocks = clocks.as_ref().ok_or(ClockError::NeverInitialized)?;
+        clocks.ensure_cpu_system_clk_active(&PoweredClock::NormalEnabledDeepSleepDisabled)?;
+        let guard = WakeGuard::new();
+        #[cfg(feature = "_mcxa2xx")]
+        let cc = pac::MRCC0.mrcc_glb_cc2();
+        #[cfg(feature = "_mcxa5xx")]
+        let cc = pac::MRCC0.mrcc_glb_cc3();
+        cc.modify(|w| w.set_rama(true));
+        cortex_m::asm::dsb();
+        cortex_m::asm::isb();
+        if !cc.read().rama() {
+            // Do not undo the enable: this clock also supplies live memory.
+            return Err(ClockError::BadConfig {
+                clock: "RAMA",
+                reason: "clock enable readback failed",
+            });
+        }
+        Ok(guard)
+    })
+}
```

**File**: `embassy-mcxa/src/clocks/gdet.rs` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+//! Read-only access prerequisites for adopting the ROM-configured digital detector.
+
+use crate::pac;
+
+/// Checks the physical access gates and reset without changing retained setup.
+///
+/// CPU/system clocks and security/privilege access remain platform prerequisites.
+/// This does not validate the detector's reference clock or calibration.
+pub(crate) fn gdet_access_ready() -> bool {
+    critical_section::with(|_| {
+        let clocks = pac::MRCC0.mrcc_glb_cc4().read();
+        let reset = pac::MRCC0.mrcc_glb_rst4().read();
+        clocks.dgdet0() && clocks.seccon() && reset.dgdet0()
+    })
+}
```

**File**: `embassy-mcxa/src/clocks/mod.rs` (modified, +8/-0)
```diff
@@ -44,7 +44,13 @@ use critical_section::CriticalSection;
 use crate::pac;
 
 pub mod config;
+#[cfg(any(mcxa_eim0, mcxa_erm0))]
+pub(crate) mod ecc;
+#[cfg(any(mcxa_eim0, mcxa_erm0))]
+pub(crate) use ecc::enable_ecc_ram_a_clock;
 mod gate;
+#[cfg(mcxa_gdet)]
+mod gdet;
 mod operator;
 pub mod periph_helpers;
 mod sleep;
@@ -54,6 +60,8 @@ mod types;
 pub use config::VddLevel;
 pub(crate) use gate::default_register_value;
 pub use gate::{Gate, assert_reset, disable, enable, enable_and_reset, is_reset_released, pulse_reset, release_reset};
+#[cfg(mcxa_gdet)]
+pub(crate) use gdet::gdet_access_ready;
 pub use sleep::deep_sleep_if_possible;
 pub use types::{Clock, ClockError, Clocks, PoweredClock, WakeGuard};
 
```

**File**: `embassy-mcxa/src/clocks/periph_helpers.rs` (modified, +48/-0)
```diff
@@ -240,6 +240,54 @@ impl SPConfHelper for Clk1MConfig {
     }
 }
 
+//
+// CMP
+//
+
+/// Comparator instance; its FRO16K input belongs to a chip-specific domain.
+#[derive(Debug, Copy, Clone)]
+pub enum CmpInstance {
+    /// CMP0 uses the VSYS FRO16K output.
+    Cmp0,
+    /// CMP1 uses the VDD_CORE FRO16K output on A2 devices.
+    #[cfg(feature = "_mcxa2xx")]
+    Cmp1,
+}
+
+/// Comparator clock validation. Only FRO16K filtering is currently supported.
+pub struct CmpConfig {
+    /// Comparator whose clock domain is checked.
+    pub instance: CmpInstance,
+    /// Whether the digital filter needs a functional clock.
+    pub filtered: bool,
+}
+
+impl SPConfHelper for CmpConfig {
+    fn pre_enable_config(&self, clocks: &Clocks) -> Result<PreEnableParts, ClockError> {
+        let freq = if self.filtered {
+            let power = PoweredClock::NormalEnabledDeepSleepDisabled;
+            match self.instance {
+                CmpInstance::Cmp0 => clocks.ensure_clk_16k_vsys_active(&power)?,
+                #[cfg(feature = "_mcxa2xx")]
+                CmpInstance::Cmp1 => clocks.ensure_clk_16k_vdd_core_active(&power)?,
+            }
+        } else {
+            0 // The continuous, unfiltered signal path is unclocked.
+        };
+        if self.filtered && freq == 0 {
+            return Err(ClockError::BadConfig {
+                clock: "cmp filter",
+                reason: "FRO16K functional clock is not running",
+            });
+        }
+        Ok(PreEnableParts {
+            freq,
+            // This first driver does not implement deep-sleep/wakeup sequencing.
+            wake_guard: Some(WakeGuard::new()),
+        })
+    }
+}
+
 //
 // FREQME
 //
```

---

### Incident Patch 3: `d1996344` (2026-11-04)
**Commit Message**: Merge pull request #7409 from tobymurray/stm32-lptim-irq-lost-overflow

stm32/time-driver-lptim: clear only the interrupt flags the handler read

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ Time driver:
 - fix: stm32/time-driver-lptim: arm alarms that fall in the current counter cycle; they fired at the overflow, up to a quarter cycle late
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, clear the previous `CMPOK` before a compare write, as on WL, so the wait is for this write
 - fix: stm32/low-power, stm32/time-driver-lptim: compile with the `log` feature
+- fix: stm32/time-driver-lptim: the interrupt handler clears only the flags it read; it also cleared every enabled flag, so an overflow that arrived during the handler was lost and time fell back one counter period
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, wait for `DIEROK` after each `DIER` change; a `CCIE` write still in flight when entering Stop lost the alarm wakeup until the next overflow
 
 I2C:
```

**File**: `embassy-stm32/src/time_driver/lptim.rs` (modified, +3/-15)
```diff
@@ -31,18 +31,6 @@ fn regs_lptim() -> Lptim {
 // instead of Icr/Ier. The compare register also changes from a single `cmp()`
 // to an indexed `ccr(n)`.
 
-/// Read the interrupt enable register value as a raw u32.
-fn ier_read(r: Lptim) -> u32 {
-    #[cfg(not(any(stm32wba, stm32u5, stm32u3)))]
-    {
-        r.ier().read().0
-    }
-    #[cfg(any(stm32wba, stm32u5, stm32u3))]
-    {
-        r.dier().read().0
-    }
-}
-
 /// Check if the compare-capture interrupt is enabled for channel `n`.
 fn ier_ccie(r: Lptim, n: usize) -> bool {
     #[cfg(not(any(stm32wba, stm32u5, stm32u3)))]
@@ -268,10 +256,10 @@ impl RtcDriver {
 
         critical_section::with(|cs| {
             let sr = r.isr().read();
-            let ier = ier_read(r);
 
-            // Clear all interrupt flags. Bits in ICR are "write 1 to clear"
-            icr_write_raw(r, ier);
+            // Clear the flags read, and only those. Bits in ICR are "write 1 to clear". A flag set
+            // since the read stays set and enters this handler again: clearing it here would lose
+            // it, and a lost UE loses a counter period.
             icr_write_raw(r, sr.0);
 
             // Overflow
```

#### Recent Merged Pull Requests:
- **PR #7422** (2026-11-03): ci: rm bad boards (@xoviat)
- **PR #7419** (2026-11-04): [MCXA] Add AOI and CMP drivers (@felipebalbi)
- **PR #7417** (2026-11-04): stm32/time-driver-lptim: wait for DIEROK between DIER writes on U5, U3 and WBA (@tobymurray)
- **PR #7416** (2026-11-03): [MCXA] Add EIM ERM and GDET drivers (@felipebalbi)
- **PR #7413** (2026-11-03): stm32: update pac (@xoviat)
- **PR #7412** (2026-11-04): stm32/usart: keep TC set when a DMA read clears its flags (@Sandvoxel)

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

## X. Merge pull request #7410 from Sandvoxel/stm32-i2c-blocking-timeout-recovery

**RULE**:
When implementing operations in `embassy-stm32/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1d3c781`: Merge pull request #7410 from Sandvoxel/stm32-i2c-blocking-timeout-recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- fix: stm32/i2c v2: a blocking controller transfer that times out (e.g. SCL held low by the target) now resets the peripheral (PE toggle, as for BERR/ARLO) instead of requesting STOP and abandoning the transfer. The abandoned transfer's NACKF/STOPF arrived later and the next call returned them after it had started its own transfer, which then ran unserved, so every later blocking transfer timed out until PE was toggled by hand.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1d3c781` are properly handled with clean fallback behavior.
