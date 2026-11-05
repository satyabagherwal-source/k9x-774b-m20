> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source**: github ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Source Version**: `cf9beb71`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T08:03:33.317Z  
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
> **Harvest Timestamp**: 2026-11-05T08:00:37.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10070 stars

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
- **Issue #7438** (2026-11-05): **stm32/vrefbuf: enable the G0x1 clock**
  *Symptoms*: ## Summary - Enable the VREFBUF clock on STM32G0x1, including G0B1, before `VoltageReferenceBuffer::new` waits for `VRR`. - On this family the buffer has no clock bit of its own. RM0444 5.4.16 clocks it through `SYSCFGEN` in `RCC_APBENR2`, shared with SYSCFG and COMP. - Related to embassy-rs/embassy#3398: driving VREF+ on a G0B1 requires this path. `Adc::enable_vrefint()` only connects the internal bandgap to an ADC channel.

- **Issue #7437** (2026-11-05): **stm32/lptim: pick a prescaler whose reload fits in 16 bits**
  *Symptoms*: ## Summary - `Prescaler::from_ticks` rounded `(ticks >> 16)` up to a power of two. That divider is too small when the shift is 1, 2, or already a power of two, and `scale_down` then panicked because the reload did not fit in `u16`. At a 16 MHz kernel clock, 100 Hz is 160000 ticks: `/2` is 80000. - The prescaler is now the smallest of `/1`, `/2`, ..., `/128` for which `ticks / prescaler` fits in 16 bits. Periods that already fitted keep the same divider. A period that does not fit even at `/128` still panics, with an explicit message. - Separate from #7393, which only changes when `CFGR` and `ARR` are written.

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

### Incident Patch 1: `508c2c06` (2026-11-04)
**Commit Message**: Merge pull request #7408 from tobymurray/stm32-lptim-now-ue-race

stm32/time-driver-lptim: retry now() if the update event changes during the read

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ Time driver:
 - fix: stm32/low-power, stm32/time-driver-lptim: compile with the `log` feature
 - fix: stm32/time-driver-lptim: the interrupt handler clears only the flags it read; it also cleared every enabled flag, so an overflow that arrived during the handler was lost and time fell back one counter period
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, wait for `DIEROK` after each `DIER` change; a `CCIE` write still in flight when entering Stop lost the alarm wakeup until the next overflow
+- fix: stm32/time-driver-lptim: `now()` retries if the update event flag changes while it reads the counter; a wrap between the two reads returned a time one counter period ahead, then time went backwards
 
 I2C:
 - fix: stm32/i2c v2: disable own-address recognition before changing an enabled OA1/OA2 address, addressing mode, or OA2 mask.
```

**File**: `embassy-stm32/src/time_driver/lptim.rs` (modified, +25/-16)
```diff
@@ -403,25 +403,34 @@ impl Driver for RtcDriver {
         // a whole period in the past, causing time to go backwards, and any
         // `Instant::duration_since` spanning that window panics.
         critical_section::with(|_| {
-            // RM0456 says: "When the LPTIM is running, reading the LPTIM_CNT register may return
-            // unreliable values. In this case it is necessary to perform consecutive reads until
-            // two returned values are identical."
-            let mut counter = r.cnt().read().cnt();
             loop {
-                let again = r.cnt().read().cnt();
-                if again == counter {
-                    break;
+                // With the period-incrementing, a pending update event unambiguously means
+                // the counter has wrapped and `next_period` has not yet accounted for it. NB: we DO
+                // NOT clear the ue bit, that (and consequently incrementing self.period) is for the
+                // ISR to do once we release this CS.
+                //
+                // The CS masks the interrupt but not the flag: the counter can still wrap between
+                // reading LPTIM_CNT and LPTIM_ISR, pairing 0xFFFF with a pending update event, a
+                // whole period in the future. Sample the flag on both sides and retry if it changed.
+                let pending = r.isr().read().ue();
+
+                // RM0456 says: "When the LPTIM is running, reading the LPTIM_CNT register may return
+                // unreliable values. In this case it is necessary to perform consecutive reads until
+                // two returned values are identical."
+                let mut counter = r.cnt().read().cnt();
+                loop {
+                    let again = r.cnt().read().cnt();
+                    if again == counter {
+                        break;
+                    }
+                    counter = again;
                 }
-                counter = again;
-            }
-
-            // With the period-incrementing, a pending update event unambiguously means
-            // the counter has wrapped and `next_period` has not yet accounted for it. NB: we DO
-            // NOT clear the ue bit, that (and consequently incrementing self.period) is for the
-            // ISR to do once we release this CS.
-            let period = self.period.load(Ordering::Relaxed) + r.isr().read().ue() as u32;
 
-            ((period as u64) << 16) + counter as u64
+                if r.isr().read().ue() == pending {
+                    let period = self.period.load(Ordering::Relaxed) + pending as u32;
+                    break ((period as u64) << 16) + counter as u64;
+                }
+            }
         })
     }
 
```

---

### Incident Patch 2: `0886d40f` (2026-11-04)
**Commit Message**: Merge pull request #7425 from OueslatiGhaith/wpan-fix-stack-configs

wpan: fix build for non-full BLE stacks

**File**: `embassy-stm32-wpan/Cargo.toml` (modified, +3/-0)
```diff
@@ -15,6 +15,9 @@ publish = false
 build = [
     {target = "thumbv7em-none-eabi", features = ["stm32wb55rg"]},
     {target = "thumbv8m.main-none-eabihf", features = ["stm32wba65ri", "wba-ble", "ble-stack-full", "linklayer-ble-full", "direct"]},
+    # The smaller stack profiles hide commands the full one has: build them too.
+    {target = "thumbv8m.main-none-eabihf", features = ["stm32wba65ri", "wba-ble", "ble-stack-basic", "linklayer-ble-basic", "direct", "defmt"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["stm32wba65ri", "wba-ble", "ble-stack-po", "linklayer-ble-peripheral-only", "direct", "defmt"]},
 ]
 
 [package.metadata.embassy_docs]
```

**File**: `embassy-stm32-wpan/src/bluetooth/gap/aci_gap.rs` (modified, +12/-158)
```diff
@@ -6,24 +6,27 @@
 //! Every command is declared by `stm32wb-hci` and executed through the
 //! [`ControllerAdapter`], which calls the same BLE stack functions.
 
-use bt_hci::cmd::{AsyncCmd, SyncCmd};
+use bt_hci::cmd::SyncCmd;
 use bt_hci::param::BdAddr;
-use stm32wb_hci::aci::durations::{
-    AdvInterval, DirectAdvInterval, ExtScanInterval, ExtScanWindow, ScanDuration, ScanPeriod,
-};
-use stm32wb_hci::aci::flags::ScanningPhys;
+use stm32wb_hci::aci::durations::{AdvInterval, DirectAdvInterval};
 use stm32wb_hci::aci::gap::{
-    GapExtStartScan, GapGetOobData, GapSetDirectConnectable, GapSetDiscoverable, GapSetNonDiscoverable, GapSetOobData,
-    GapSetUndirectedConnectable, GapTerminateGapProc, GapUpdateAdvData, ScanParamPhy,
+    GapGetOobData, GapSetDirectConnectable, GapSetDiscoverable, GapSetNonDiscoverable, GapSetOobData,
+    GapSetUndirectedConnectable, GapUpdateAdvData,
 };
 use stm32wb_hci::aci::values::{
-    AddressType, AdvertisingType, ConnectableOwnAddressType, DirectedAdvertisingType, FilterDuplicates, GapProcedure,
-    OobDataType, OobDevice, OwnAddressType, ScanProcedure, ScanType, ScanningFilterPolicy, UndirectedAdvFilterPolicy,
+    AddressType, AdvertisingType, ConnectableOwnAddressType, DirectedAdvertisingType, OobDataType, OobDevice,
+    OwnAddressType, UndirectedAdvFilterPolicy,
 };
 
 use crate::bluetooth::error::BleError;
 use crate::controller::ControllerAdapter;
 
+// Scanning: not available in the peripheral-only stack.
+#[cfg(not(feature = "ble-stack-po"))]
+mod scan;
+#[cfg(not(feature = "ble-stack-po"))]
+pub use scan::*;
+
 // Advertising types for aci_gap_set_discoverable
 #[allow(dead_code)]
 pub const ADV_IND: u8 = 0x00; // Connectable undirected
@@ -36,56 +39,6 @@ pub const ADV_NONCONN_IND: u8 = 0x03; // Non-connectable undirected
 #[allow(dead_code)]
 pub const ADV_DIRECT_IND_LOW_DUTY: u8 = 0x04; // Connectable directed low duty cycle
 
-const HCI_SCAN_TYPE_ACTIVE: u8 = 0x01;
-
-/// Run a GAP discovery procedure through `ACI_GAP_START_SCAN`.
-///
-/// CubeWBA 1.10.0 dropped the legacy `aci_gap_start_{observation,limited,general}_discovery_proc`
-/// commands, so the discovery procedures go through `aci_gap_start_scan` now
-/// (declared as [`GapExtStartScan`] by `stm32wb-hci`, same opcode and layout).
-#[allow(clippy::too_many_arguments)]
-async fn start_scan(
-    controller: &ControllerAdapter<'_>,
-    procedure: ScanProcedure,
-    scan_interval: u16,
-    scan_window: u16,
-    scan_type: u8,
-    own_address_type: u8,
-    filter_duplicates: bool,
-    filter_policy: u8,
-) -> Result<(), BleError> {
-    let phy_param = |scan_type| -> Result<ScanParamPhy, BleError> {
-        Ok(ScanParamPhy {
-            scan_type: ScanType::try_from(scan_type).map_err(|_| BleError::InvalidParameter)?,
-            scan_interval: ExtScanInterval::from_units(scan_interval).ok_or(BleError::InvalidParameter)?,
-            scan_window: ExtScanWindow::from_units(scan_window).ok_or(BleError::InvalidParameter)?,
-        })
-    };
-    // ACI_GAP_START_SCAN requires two PHY parameter records even when only
-    // LE 1M is selected. The second record is ignored in that configuration.
-    let scan_params = [phy_param(scan_type)?, phy_param(scan_type)?];
-
-    GapExtStartScan::new(
-        0,
-        procedure,
-        OwnAddressType::try_from(own_address_type).map_err(|_| BleError::InvalidParameter)?,
-        if filter_duplicates {
-            FilterDuplicates::Enabled
-        } else {
-            FilterDuplicates::Disabled
-        },
-        ScanDuration::CONTINUOUS,
-        ScanPeriod::CONTINUOUS,
-        ScanningFilterPolicy::try_from(filter_policy).map_err(|_| BleError::InvalidParameter)?,
-        ScanningPhys::LE_1M,
-        scan_params,
-    )
-    .exec(controller)
-    .await?;
-
-    Ok(())
-}
-
 /// Start advertising using `aci_gap_set_discoverable`
 ///
 /// This is the proper way to start advertising on ST's BLE stack.
@@ -173,105 +126,6 @@ pub async fn set_direct_connectable(
     .map_err(BleError::from)
 }
 
-/// Start the GAP observation procedure (passive or active scanning).
-///
-/// Advertising reports arrive as standard `HCI_LE_Advertising_Report` events
-/// via `BLECB_Indication`.  This is the correct way to scan on the WBA BLE
-/// stack — raw `HCI_LE_SET_SCAN_ENABLE` starts the radio but does not route
-/// reports through the host layer.
-///
-/// CubeWBA 1.10.0 renamed the observation procedure `GAP_GENERIC_SCAN_PROC`;
-/// `stm32wb-hci` models that as [`ScanProcedure::GenericScan`].
-#[allow(clippy::too_many_arguments)]
-pub async fn start_observation(
-    controller: &ControllerAdapter<'_>,
-    scan_interval: u16,
-    scan_window: u16,
-    scan_type: u8,
-    own_address_type: u8,
-    filter_duplicates: bool,
-    filter_policy: u8,
-) -> Result<(), BleError> {
-    start_scan(
-        controller,
-        ScanProcedure::GenericScan,
-        scan_interval,
-        scan_window,
-        scan_type,
-        own_address_type,
-   
```

**File**: `embassy-stm32-wpan/src/bluetooth/gap/aci_gap/scan.rs` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+//! GAP scanning ACI commands (observer and central roles).
+//!
+//! The peripheral-only BLE stack has no scanning, so this module is only
+//! built for the other stacks.
+
+use bt_hci::cmd::{AsyncCmd, SyncCmd};
+use stm32wb_hci::aci::durations::{ExtScanInterval, ExtScanWindow, ScanDuration, ScanPeriod};
+use stm32wb_hci::aci::flags::ScanningPhys;
+use stm32wb_hci::aci::gap::{GapExtStartScan, GapTerminateGapProc, ScanParamPhy};
+use stm32wb_hci::aci::values::{
+    FilterDuplicates, GapProcedure, OwnAddressType, ScanProcedure, ScanType, ScanningFilterPolicy,
+};
+
+use crate::bluetooth::error::BleError;
+use crate::controller::ControllerAdapter;
+
+const HCI_SCAN_TYPE_ACTIVE: u8 = 0x01;
+
+/// Run a GAP discovery procedure through `ACI_GAP_START_SCAN`.
+///
+/// CubeWBA 1.10.0 dropped the legacy `aci_gap_start_{observation,limited,general}_discovery_proc`
+/// commands, so the discovery procedures go through `aci_gap_start_scan` now
+/// (declared as [`GapExtStartScan`] by `stm32wb-hci`, same opcode and layout).
+#[allow(clippy::too_many_arguments)]
+async fn start_scan(
+    controller: &ControllerAdapter<'_>,
+    procedure: ScanProcedure,
+    scan_interval: u16,
+    scan_window: u16,
+    scan_type: u8,
+    own_address_type: u8,
+    filter_duplicates: bool,
+    filter_policy: u8,
+) -> Result<(), BleError> {
+    let phy_param = |scan_type| -> Result<ScanParamPhy, BleError> {
+        Ok(ScanParamPhy {
+            scan_type: ScanType::try_from(scan_type).map_err(|_| BleError::InvalidParameter)?,
+            scan_interval: ExtScanInterval::from_units(scan_interval).ok_or(BleError::InvalidParameter)?,
+            scan_window: ExtScanWindow::from_units(scan_window).ok_or(BleError::InvalidParameter)?,
+        })
+    };
+    // ACI_GAP_START_SCAN requires two PHY parameter records even when only
+    // LE 1M is selected. The second record is ignored in that configuration.
+    let scan_params = [phy_param(scan_type)?, phy_param(scan_type)?];
+
+    GapExtStartScan::new(
+        0,
+        procedure,
+        OwnAddressType::try_from(own_address_type).map_err(|_| BleError::InvalidParameter)?,
+        if filter_duplicates {
+            FilterDuplicates::Enabled
+        } else {
+            FilterDuplicates::Disabled
+        },
+        ScanDuration::CONTINUOUS,
+        ScanPeriod::CONTINUOUS,
+        ScanningFilterPolicy::try_from(filter_policy).map_err(|_| BleError::InvalidParameter)?,
+        ScanningPhys::LE_1M,
+        scan_params,
+    )
+    .exec(controller)
+    .await?;
+
+    Ok(())
+}
+
+/// Start the GAP observation procedure (passive or active scanning).
+///
+/// Advertising reports arrive as standard `HCI_LE_Advertising_Report` events
+/// via `BLECB_Indication`.  This is the correct way to scan on the WBA BLE
+/// stack — raw `HCI_LE_SET_SCAN_ENABLE` starts the radio but does not route
+/// reports through the host layer.
+///
+/// CubeWBA 1.10.0 renamed the observation procedure `GAP_GENERIC_SCAN_PROC`;
+/// `stm32wb-hci` models that as [`ScanProcedure::GenericScan`].
+#[allow(clippy::too_many_arguments)]
+pub async fn start_observation(
+    controller: &ControllerAdapter<'_>,
+    scan_interval: u16,
+    scan_window: u16,
+    scan_type: u8,
+    own_address_type: u8,
+    filter_duplicates: bool,
+    filter_policy: u8,
+) -> Result<(), BleError> {
+    start_scan(
+        controller,
+        ScanProcedure::GenericScan,
+        scan_interval,
+        scan_window,
+        scan_type,
+        own_address_type,
+        filter_duplicates,
+        filter_policy,
+    )
+    .await
+}
+
+/// Start the GAP limited discovery procedure.
+///
+/// This uses active scanning and reports only peripherals in limited
+/// discoverable mode.
+pub async fn start_limited_discovery(
+    controller: &ControllerAdapter<'_>,
+    scan_interval: u16,
+    scan_window: u16,
+    own_address_type: u8,
+    filter_duplicates: bool,
+) -> Result<(), BleError> {
+    start_scan(
+        controller,
+        ScanProcedure::LimitedDiscovery,
+        scan_interval,
+        scan_window,
+        HCI_SCAN_TYPE_ACTIVE,
+        own_address_type,
+        filter_duplicates,
+        0,
+    )
+    .await
+}
+
+/// Start the GAP general discovery procedure.
+///
+/// This uses active scanning and reports all discovered peripherals.
+pub async fn start_general_discovery(
+    controller: &ControllerAdapter<'_>,
+    scan_interval: u16,
+    scan_window: u16,
+    own_address_type: u8,
+    filter_duplicates: bool,
+) -> Result<(), BleError> {
+    start_scan(
+        controller,
+        ScanProcedure::GeneralDiscovery,
+        scan_interval,
+        scan_window,
+        HCI_SCAN_TYPE_ACTIVE,
+        own_address_type,
+        filter_duplicates,
+        0,
+    )
+    .await
+}
+
+/// Terminate a running GAP procedure.
+pub async fn terminate_gap_proc(controller: &ControllerAdapter<'_>, procedure: GapProcedure) -> Result<(), BleError> {
+    GapTerminateGapProc::new(p
```

**File**: `embassy-stm32-wpan/src/bluetooth/gap/scanner.rs` (modified, +16/-13)
```diff
@@ -5,10 +5,9 @@
 
 pub use stm32wb_hci::aci::values::{ScanProcedure, ScanType, ScanningFilterPolicy};
 
-use crate::bluetooth::error::BleError;
-use crate::bluetooth::gap::aci_gap;
 use crate::bluetooth::gap::types::OwnAddressType;
-use crate::controller::ControllerAdapter;
+#[cfg(not(feature = "ble-stack-po"))]
+use crate::{bluetooth::error::BleError, bluetooth::gap::aci_gap, controller::ControllerAdapter};
 
 /// Scan parameters
 #[derive(Debug, Clone)]
@@ -124,6 +123,20 @@ impl Scanner {
         Self { active_proc: None }
     }
 
+    /// Check if currently scanning
+    pub fn is_scanning(&self) -> bool {
+        self.active_proc.is_some()
+    }
+
+    /// Return the currently active GAP scan procedure.
+    pub fn active_procedure(&self) -> Option<ScanProcedure> {
+        self.active_proc
+    }
+}
+
+// Scanning: not available in the peripheral-only stack.
+#[cfg(not(feature = "ble-stack-po"))]
+impl Scanner {
     /// Start scanning with the given parameters
     ///
     /// Advertising reports will be received as `LeAdvertisingReport` events
@@ -231,16 +244,6 @@ impl Scanner {
         }
         Ok(())
     }
-
-    /// Check if currently scanning
-    pub fn is_scanning(&self) -> bool {
-        self.active_proc.is_some()
-    }
-
-    /// Return the currently active GAP scan procedure.
-    pub fn active_procedure(&self) -> Option<ScanProcedure> {
-        self.active_proc
-    }
 }
 
 /// Parsed advertising data from a scan report
```

**File**: `embassy-stm32-wpan/src/bluetooth/gatt/mod.rs` (modified, +3/-0)
```diff
@@ -3,11 +3,14 @@
 //! This module provides a Rust wrapper around ST's GATT implementation,
 //! including server functionality and event handling.
 
+// GATT client: not available in the peripheral-only stack.
+#[cfg(not(feature = "ble-stack-po"))]
 pub mod client;
 pub mod events;
 pub mod server;
 pub mod types;
 
+#[cfg(not(feature = "ble-stack-po"))]
 pub use client::GattClient;
 pub use events::{
     CHAR_CCCD_HANDLE_OFFSET, CHAR_VALUE_HANDLE_OFFSET, CccdValue, GattClientEvent, GattEvent, aci_event_code,
```

**File**: `embassy-stm32-wpan/src/bluetooth/mod.rs` (modified, +350/-270)
```diff
@@ -10,42 +10,56 @@ pub mod security;
 use bt_hci::cmd::controller_baseband::{Reset, SetEventMask};
 use bt_hci::cmd::info::ReadLocalVersionInformation;
 use bt_hci::cmd::le::{
-    LeConnCteRequestEnable, LeConnCteResponseEnable, LeConnUpdate, LeCreateConn, LeCreateConnCancel,
-    LeReadAntennaInformation, LeReadBufferSizeV2, LeReadLocalSupportedFeatures, LeReadPhy, LeReceiverTest,
-    LeReceiverTestV2, LeRemoteConnectionParameterRequestReply, LeSetConnCteReceiveParams, LeSetConnCteTransmitParams,
-    LeSetDataLength, LeSetEventMask, LeSetPhy, LeSetRandomAddr, LeTestEnd, LeTransmitterTest, LeTransmitterTestV2,
+    LeReadPhy, LeReceiverTest, LeReceiverTestV2, LeRemoteConnectionParameterRequestReply, LeSetDataLength,
+    LeSetEventMask, LeSetPhy, LeTestEnd, LeTransmitterTest, LeTransmitterTestV2,
 };
-use bt_hci::cmd::link_control::Disconnect;
+// HCI commands only the full BLE stack provides.
 use bt_hci::cmd::{AsyncCmd, SyncCmd};
 use bt_hci::controller::Controller as _;
 use bt_hci::event::le::{
     LeConnectionComplete, LeConnectionUpdateComplete, LeDataLengthChange, LeEnhancedConnectionComplete, LeEvent,
     LePhyUpdateComplete, LeRemoteConnectionParameterRequest,
 };
 use bt_hci::event::{DisconnectionComplete, Event, EventKind, EventPacket};
-use bt_hci::param::{
-    AddrKind, BdAddr, ConnHandle, CteKind, CteMask, DisconnectReason as HciDisconnectReason, Duration, EventMask,
-    LeEventMask, PhyOptions,
-};
+use bt_hci::param::{ConnHandle, Duration, EventMask, LeEventMask, PhyOptions};
 use bt_hci::{ControllerToHostPacket, FromHciBytes};
 use embassy_futures::yield_now;
 use embassy_stm32::interrupt;
+use stm32wb_hci::aci::durations::{CeLength, ConnInterval, SupervisionTimeout};
 use stm32wb_hci::aci::flags::{RadioActivityMask, Role};
+use stm32wb_hci::aci::gap::{GapStartConnectionUpdate, GapTerminate};
 use stm32wb_hci::aci::gatt::GattInit;
 use stm32wb_hci::aci::hal::{HalLeTxTestPacketNumber, HalReadRssi, HalRssi, HalSetRadioActivityMask};
 use stm32wb_hci::aci::l2cap::L2capConnectionParameterUpdateReq;
+use stm32wb_hci::aci::ranges::ConnLatency;
+use stm32wb_hci::aci::values::DisconnectReason as AciDisconnectReason;
 pub use stm32wb_hci::event::BleEvent;
+#[cfg(not(feature = "ble-stack-po"))]
+use {
+    crate::bluetooth::{gap::connection::ConnectionInitParams, gap::scanner::ScanParams, gatt::GattClient},
+    bt_hci::param::BdAddr,
+    stm32wb_hci::aci::durations::{ExtScanInterval, ExtScanWindow},
+    stm32wb_hci::aci::gap::{GapCreateConnection, GapTerminateGapProc},
+    stm32wb_hci::aci::values::{AddressType, ConnectableOwnAddressType, GapProcedure},
+};
+#[cfg(feature = "ble-stack-full")]
+use {
+    bt_hci::cmd::le::{
+        LeConnCteRequestEnable, LeConnCteResponseEnable, LeReadAntennaInformation, LeReadBufferSizeV2,
+        LeReadLocalSupportedFeatures, LeSetConnCteReceiveParams, LeSetConnCteTransmitParams,
+    },
+    bt_hci::param::{CteKind, CteMask},
+};
 
 use crate::bluetooth::error::BleError;
 use crate::bluetooth::gap::connection::{
-    Connection, ConnectionInitParams, ConnectionInterval, ConnectionManager, DisconnectReason, GapEvent,
-    MAX_CONNECTIONS, PhyKind,
+    Connection, ConnectionInterval, ConnectionManager, DisconnectReason, GapEvent, MAX_CONNECTIONS, PhyKind,
 };
-use crate::bluetooth::gap::scanner::{ScanParams, ScanProcedure, Scanner};
+use crate::bluetooth::gap::scanner::{ScanProcedure, Scanner};
 use crate::bluetooth::gap::types::{AdvData, AdvParams, BdAddrType};
 use crate::bluetooth::gap_init::{GapInitParams, init_gap_and_hal};
 use crate::bluetooth::gatt::{
-    GattClient, GattClientEvent, GattEvent, GattServer, client_events_from_vendor_event, from_vendor_event,
+    GattClientEvent, GattEvent, GattServer, client_events_from_vendor_event, from_vendor_event,
 };
 use crate::bluetooth::hci::types::DtmPacketPayload;
 use crate::bluetooth::hci::{DtmRxPhy, DtmTxPhy, all_phys_from_raw, phy_mask_from_raw};
@@ -228,31 +242,36 @@ impl<'d> HCI<'d, Normal> {
             info!("le_set_event_mask OK");
         }
 
-        // 4. Read buffer sizes (optional - skip if not available)
-        info!("Calling le_read_buffer_size...");
-        match LeReadBufferSizeV2::new().exec(&self.controller).await {
-            Ok(r) => {
-                // The return parameters are packed: copy them out before
-                // borrowing the fields to log them.
-                let (acl_len, acl_packets, iso_len, iso_packets) = (
-                    r.le_acl_data_packet_length,
-                    r.total_num_le_acl_data_packets,
-                    r.iso_data_packet_length,
-                    r.total_num_iso_data_packets,
-                );
-                info!(
-                    "Buffer sizes - ACL: {} bytes x {} packets, ISO: {} bytes x {} packets",
-                    acl_len, acl_packets, iso_len, iso_packets
-                );
+        // 4-5. Read buffer sizes and supported features, for the log only.
+        // These HCI commands are only in the f
```

**File**: `embassy-stm32-wpan/src/bluetooth/security/mod.rs` (modified, +156/-149)
```diff
@@ -22,13 +22,13 @@
 //! security.set_authentication_requirements(ble.controller(), params).await?;
 //! ```
 
-use bt_hci::cmd::le::{
-    LeClearFilterAcceptList, LeClearResolvingList, LeSetAddrResolutionEnable, LeSetResolvablePrivateAddrTimeout,
-};
+use bt_hci::cmd::le::LeSetResolvablePrivateAddrTimeout;
+#[cfg(feature = "ble-stack-full")]
+use bt_hci::cmd::le::{LeClearFilterAcceptList, LeClearResolvingList, LeSetAddrResolutionEnable};
 // Reading the resolving list back is what the `defmt` diagnostics do; the
 // `not(defmt)` stubs of the `log_*` helpers skip it.
 #[cfg(feature = "defmt")]
-use bt_hci::cmd::le::{LeReadLocalResolvableAddr, LeReadPeerResolvableAddr, LeReadResolvingListSize};
+use bt_hci::cmd::le::{LeReadLocalResolvableAddr, LeReadPeerResolvableAddr};
 use bt_hci::cmd::{AsyncCmd, SyncCmd};
 #[cfg(feature = "defmt")]
 use bt_hci::param::AddrKind;
@@ -37,8 +37,8 @@ use stm32wb_hci::aci::AciEvent;
 use stm32wb_hci::aci::gap::{
     GapAddDevicesToList, GapAllowRebond, GapAuthorizationResp, GapCheckBondedDevice, GapClearSecurityDb,
     GapGetBondedDevices, GapNumericComparisonValueConfirmYesno, GapPairingRequestReply, GapPassKeyResp,
-    GapPasskeyInput, GapPeripheralSecurityReq, GapRemoveBondedDevice, GapSendPairingReq,
-    GapSetAuthenticationRequirement, GapSetIoCapability, ListEntry,
+    GapPasskeyInput, GapPeripheralSecurityReq, GapRemoveBondedDevice, GapSetAuthenticationRequirement,
+    GapSetIoCapability, ListEntry,
 };
 use stm32wb_hci::aci::general::AciWriteConfigData;
 use stm32wb_hci::aci::ranges::Passkey;
@@ -520,23 +520,6 @@ impl SecurityManager {
         Ok(())
     }
 
-    /// Request pairing/encryption from the central side.
-    ///
-    /// Sends a pairing request to the peer peripheral. Set `force_rebond` to
-    /// restart pairing even when a bond entry exists.
-    pub async fn request_pairing_central(
-        &self,
-        controller: &ControllerAdapter<'_>,
-        conn_handle: u16,
-        force_rebond: bool,
-    ) -> Result<(), BleError> {
-        GapSendPairingReq::new(ConnHandle::new(conn_handle), force_rebond)
-            .exec(controller)
-            .await?;
-
-        Ok(())
-    }
-
     /// Reply to a pairing request signaled via `SecurityEvent::PairingRequest`.
     ///
     /// Set `accept` to `true` to continue pairing, or `false` to reject it.
@@ -574,30 +557,6 @@ impl SecurityManager {
         Ok(())
     }
 
-    /// Drop the controller-side copies of every bond: address resolution, the
-    /// resolving list and the Filter Accept List.
-    ///
-    /// [`clear_security_database`](Self::clear_security_database) only empties
-    /// the host bond database. The controller keeps its own IRK table, accept
-    /// list and per-peer privacy modes, and
-    /// [`configure_filter_and_resolving_list`](Self::configure_filter_and_resolving_list)
-    /// returns early once the database is empty, so nothing ever tells the
-    /// controller to forget them. Call this alongside `clear_security_database`
-    /// to leave the stack in the same state a reset would.
-    ///
-    /// Address resolution is disabled first because the Core Spec forbids
-    /// clearing the resolving list while translation is enabled and the radio is
-    /// active (Vol 4, Part E, 7.8.40).
-    ///
-    /// Must NOT be called while advertising, scanning, or initiating is active.
-    pub async fn clear_bond_lists(&self, controller: &ControllerAdapter<'_>) -> Result<(), BleError> {
-        LeSetAddrResolutionEnable::new(false).exec(controller).await?;
-        LeClearResolvingList::new().exec(controller).await?;
-        LeClearFilterAcceptList::new().exec(controller).await?;
-
-        Ok(())
-    }
-
     /// Remove a specific bonded device
     pub async fn remove_bonded_device(
         &self,
@@ -710,20 +669,6 @@ impl SecurityManager {
         Ok(bonded)
     }
 
-    /// Enable or disable address resolution
-    ///
-    /// When enabled, the controller will automatically resolve resolvable
-    /// private addresses (RPA) using stored IRKs.
-    pub async fn set_address_resolution_enable(
-        &self,
-        controller: &ControllerAdapter<'_>,
-        enable: bool,
-    ) -> Result<(), BleError> {
-        LeSetAddrResolutionEnable::new(enable).exec(controller).await?;
-
-        Ok(())
-    }
-
     /// Set RPA (Resolvable Private Address) timeout
     ///
     /// Sets the time interval after which a new RPA is generated.
@@ -743,47 +688,6 @@ impl SecurityManager {
         Ok(())
     }
 
-    /// Populate the controller's resolving list with bonded peer identities so
-    /// that reconnections from RPA-using peers (e.g. iOS) can be recognised as
-    /// the bonded peer.
-    ///
-    /// Without this, `set_address_resolution_enable(true)` only enables resolution
-    /// in the controller — there are no IRKs to resolve against. Incoming
-    /// `LL_ENC_REQ` from a bonded peer will fail with "SMP unexpected LTK request"
-    /// because the host 
```

**File**: `examples/stm32wba/src/bin/ble_central.rs` (modified, +4/-1)
```diff
@@ -32,6 +32,7 @@ use embassy_stm32_wpan::bluetooth::gap_init::GapInitParams;
 use embassy_stm32_wpan::bluetooth::{BleEvent, EventBuffer, HCI};
 use embassy_stm32_wpan::{HighInterruptHandler, LowInterruptHandler, Platform, new_platform};
 use panic_probe as _;
+use stm32wb_hci::aci::flags::Role;
 use stm32wb_hci::aci::values::AddressType;
 
 bind_interrupts!(struct Irqs {
@@ -74,11 +75,13 @@ async fn main(spawner: Spawner) {
             let gap_params = GapInitParams {
                 bd_addr: [0x01, 0x00, 0x00, 0xE1, 0x80, 0x00],
                 address_type: AddressType::Public,
+                // `connect` needs the GAP central role.
+                role: Role::CENTRAL,
                 ..GapInitParams::default()
             };
             HCI::new_with_gap_params(platform, runtime, Irqs, gap_params).await
         }
-        _ => HCI::new(platform, runtime, Irqs).await,
+        _ => HCI::new_with_role(platform, runtime, Irqs, Role::CENTRAL).await,
     }
     .expect("BLE initialization failed");
 
```

---

### Incident Patch 3: `ee435a8f` (2026-11-04)
**Commit Message**: Merge pull request #7389 from lennlouisgeek/feature/stm32c5-dac-v9

stm32: add DAC v9 support for STM32C5

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -255,6 +255,7 @@ DAC:
 - feat: stm32/dac: add HRTIM DAC triggers
 - feat: stm32/dac: type-erase DAC
 - feat: stm32/dac: add trigger trait impl
+- feat: stm32/dac: add DAC v9 (STM32C5) support. DMA, triggered output, and ring-buffered output have not been hardware tested.
 
 OPAMP:
 - feat: stm32/opamp: allow VINM0 as bias input
```

**File**: `embassy-stm32/build.rs` (modified, +2/-6)
```diff
@@ -1914,9 +1914,7 @@ fn main() {
         let mut adc_pairs: BTreeMap<u8, (Option<Ident>, Option<Ident>)> = BTreeMap::new();
         let mut seen_lcd_seg_pins = HashSet::new();
 
-        if (matches!(regs.kind, "hash" | "opamp") || (regs.kind == "dac" && regs.version == "v9"))
-            && chip_name.starts_with("stm32c5")
-        {
+        if matches!(regs.kind, "hash" | "opamp") && chip_name.starts_with("stm32c5") {
             continue;
         }
 
@@ -2333,9 +2331,7 @@ fn main() {
 
     let mut has_dfsdm_adc = false;
     for (p, regs) in &peripheral_list {
-        if (matches!(regs.kind, "hash" | "opamp") || (regs.kind == "dac" && regs.version == "v9"))
-            && chip_name.starts_with("stm32c5")
-        {
+        if matches!(regs.kind, "hash" | "opamp") && chip_name.starts_with("stm32c5") {
             continue;
         }
 
```

**File**: `embassy-stm32/src/dac/mod.rs` (modified, +53/-29)
```diff
@@ -15,7 +15,7 @@ pub use ringbuffered::RingBufferedDacChannel;
 
 use crate::dma::{ChannelAndRequest, Packing, word as dma};
 use crate::mode::{Async, Blocking, Mode as PeriMode};
-#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
 use crate::pac::dac;
 use crate::pac::dac::Dac as Regs;
 use crate::rcc::{self, RccInfo, RccPeripheral, SealedRccPeripheral};
@@ -81,7 +81,7 @@ impl<T: Instance> ChannelTrigger<T> for SOFTWARE {
 }
 
 /// Operating mode for DAC channel
-#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
 #[derive(Debug, Copy, Clone, Eq, PartialEq)]
 #[cfg_attr(feature = "defmt", derive(defmt::Format))]
 pub enum Mode {
@@ -106,7 +106,7 @@ pub enum Mode {
     SampleHoldInternalUnbuffered,
 }
 
-#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+#[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
 impl Mode {
     fn mode(&self) -> dac::vals::Mode {
         match self {
@@ -159,8 +159,8 @@ impl State {
 }
 /// Driver for a single DAC channel.
 ///
-/// If you want to use both channels, either together or independently,
-/// create a [`Dac`] first and use it to access each channel.
+/// On devices with two DAC channels, create a `Dac` first to use both channels,
+/// either together or independently.
 pub struct DacChannel<'d, M: PeriMode> {
     phantom: PhantomData<&'d mut M>,
     #[allow(unused)]
@@ -188,7 +188,7 @@ impl<'d> DacChannel<'d, Async> {
             Some(peri),
             None,
             new_dma!(dma, _irq),
-            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
             Mode::NormalExternalBuffered,
             #[cfg(stm32g4)]
             vals::Wave::Disabled,
@@ -214,7 +214,7 @@ impl<'d> DacChannel<'d, Async> {
             Some(peri),
             Some(trigger.signal()),
             new_dma!(dma, _irq),
-            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
             Mode::NormalExternalBuffered,
             #[cfg(stm32g4)]
             vals::Wave::Disabled,
@@ -230,7 +230,10 @@ impl<'d> DacChannel<'d, Async> {
     /// The channel is set to [`Mode::NormalInternalUnbuffered`] and enabled on creation.
     /// Note that some methods, such as `set_trigger()` and `set_mode()`, will disable the
     /// channel; you must re-enable it with `enable()`.
-    #[cfg(all(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8), not(any(stm32h56x, stm32h57x))))]
+    #[cfg(all(
+        any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9),
+        not(any(stm32h56x, stm32h57x))
+    ))]
     pub fn new_internal<T: Instance, C: Channel, D: Dma<T, C>>(
         peri: Peri<'d, T>,
         dma: Peri<'d, D>,
@@ -255,7 +258,10 @@ impl<'d> DacChannel<'d, Async> {
     /// The channel is set to [`Mode::NormalInternalUnbuffered`] and enabled on creation.
     /// Note that some methods, such as `set_trigger()` and `set_mode()`, will disable the
     /// channel; you must re-enable it with `enable()`.
-    #[cfg(all(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8), not(any(stm32h56x, stm32h57x))))]
+    #[cfg(all(
+        any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9),
+        not(any(stm32h56x, stm32h57x))
+    ))]
     pub fn new_triggered_internal<T: Instance, C: Channel, D: Dma<T, C>>(
         peri: Peri<'d, T>,
         dma: Peri<'d, D>,
@@ -389,7 +395,7 @@ impl<'d> DacChannel<'d, Blocking> {
             Some(peri),
             None,
             None,
-            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))]
+            #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))]
             Mode::NormalExternalBuffered,
             #[cfg(stm32g4)]
             vals::Wave::Disabled,
@@ -408,7 +414,10 @@ impl<'d> DacChannel<'d, Blocking> {
     ///
     /// By default, triggering is disabled, but it can be enabled using
     /// [`DacChannel::set_trigger()`].
-    #[cfg(all(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8), not(any(stm32h56x, stm32h57x))))]
+    #[cfg(all(
+        any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9),
+        not(any(stm32h56x, stm32h57x))
+    ))]
     pub fn new_internal_blocking<T: Instance, C: Channel>(peri: Peri<'d, T>) -> Self {
         Self::new_inner::<T, C>(
             Some(peri),
@@ -476,7 +485,7 @@ impl<'d, M: PeriMode> DacChannel<'d, M> {
         peri: Option<Peri<'d, T>>,
         trigger: Option<u8>,
         dma: Option<ChannelAndRequest<'d>>,
-        #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8))] mode: Mode,
+        #[cfg(any(dac_v3, dac_v4, dac_v5, dac_v6, dac_v7, dac_v8, dac_v9))] mode: Mode,
         #[cfg(stm32g4)] wave: dac::vals::Wave,
         #[cfg(stm32g4)] inc_trigger
```

**File**: `embassy-stm32/src/lib.rs` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ pub mod crc;
 pub mod cryp;
 #[cfg(csi)]
 pub mod csi;
-#[cfg(all(dac, not(dac_v9)))]
+#[cfg(dac)]
 pub mod dac;
 #[cfg(dcmi)]
 pub mod dcmi;
```

**File**: `examples/stm32c5/src/bin/dac.rs` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+#![no_std]
+#![no_main]
+
+// Tested on STM32C562RE. Measure PA4 relative to GND with a DC voltmeter.
+// With VREF+ = 3.3 V, the output steps through approximately 0, 0.825, 1.65,
+// 2.475 and 3.3 V, holding each level for two seconds before repeating.
+
+use defmt::*;
+use defmt_rtt as _;
+use embassy_executor::Spawner;
+use embassy_stm32::Config;
+use embassy_stm32::dac::{DacChannel, u12r};
+use embassy_time::Timer;
+use panic_probe as _;
+
+#[embassy_executor::main]
+async fn main(_spawner: Spawner) {
+    let mut config = Config::default();
+
+    // Configure the shared ADC/DAC kernel clock before initializing DAC1.
+    config.rcc.mux.adcdacsel = embassy_stm32::rcc::mux::Adcdacsel::Hclk1;
+    config.rcc.adcdac_pre = embassy_stm32::pac::rcc::vals::Adcdacpre::Div2;
+
+    let p = embassy_stm32::init(config);
+
+    // DAC1 channel 1 drives PA4 with the output buffer enabled.
+    let mut dac = DacChannel::new_blocking(p.DAC1, p.PA4);
+
+    loop {
+        dac.set(u12r(0));
+        info!("DAC: 0 / 4095");
+        Timer::after_secs(2).await;
+
+        dac.set(u12r(1024));
+        info!("DAC: 1024 / 4095");
+        Timer::after_secs(2).await;
+
+        dac.set(u12r(2048));
+        info!("DAC: 2048 / 4095");
+        Timer::after_secs(2).await;
+
+        dac.set(u12r(3072));
+        info!("DAC: 3072 / 4095");
+        Timer::after_secs(2).await;
+
+        dac.set(u12r(4095));
+        info!("DAC: 4095 / 4095");
+        Timer::after_secs(2).await;
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #7438** (2026-11-05): stm32/vrefbuf: enable the G0x1 clock (@leftger)
- **PR #7437** (2026-11-05): stm32/lptim: pick a prescaler whose reload fits in 16 bits (@leftger)
- **PR #7436** (2026-11-05): stm32/spi: stop rejecting a slave's frequency (@Sandvoxel)
- **PR #7435** (2026-11-05): stm32: add TrustZone secure helpers and a WBA65 example (@leftger)
- **PR #7432** (2026-11-04): [MCXA]: add MBC driver (@felipebalbi)
- **PR #7431** (2026-11-04): stm32/i2c v2: interrupt-driven async transfers for drivers without DMA channels (@Sandvoxel)

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

## X. Merge pull request #7408 from tobymurray/stm32-lptim-now-ue-race

**RULE**:
When implementing operations in `embassy-stm32/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `508c2c06`: Merge pull request #7408 from tobymurray/stm32-lptim-now-ue-race. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- fix: stm32/time-driver-lptim: `now()` retries if the update event flag changes while it reads the counter; a wrap between the two reads returned a time one counter period ahead, then time went backwards
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `508c2c06` are properly handled with clean fallback behavior.
