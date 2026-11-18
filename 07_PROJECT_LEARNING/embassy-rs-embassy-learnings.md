> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source**: github ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Source Version**: `b4d9d61a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T22:03:22.031Z  
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
> **Harvest Timestamp**: 2026-11-18T22:03:21.901Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10127 stars

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
- **Issue #7589** (2026-11-18): **stm32/rcc: use shared backup domain code for G5**
  *Symptoms*: G5 excluded `rcc/bd.rs` because its backup-domain registers are named after the "RTC domain": `RCC_RTCCR` instead of `RCC_BDCR`, and `PWR_RTCCR.DRTCP` instead of `DBP`. `bd.rs` now handles these names the same way it handles `CSR`/`CSR1` on L0/L1/C0, and `rcc::Config` on G5 gets `ls: LsConfig`, so LSI, LSE and the RTC clock can be configured.  - The domain reset is skipped on G5, as on H5/U5/L5. RM0522 (C5, same family line) says SRAM2 is erased by a backup domain reset. - G5's LSEDRV only has medium-high and high drive (ST SVD), so `LseDrive::Low` and `LseDrive::MediumLow` aren't available there. - Bumps stm32-metapac for the `Lsedrv::Highest` → `High` rename on G5 (embassy-rs/stm32-data e40ce1ac8).  Build-tested only; no G5 board on the HIL farm. 

- **Issue #7584** (2026-11-18): **stm32/low-power: build for more chips, restore clocks in all chips, misc fixes**
  *Symptoms*: - Fix LPTIM time driver build in all low-power-supported chips. - Make LPTIM clock config explicit.     - It no longer implicitly changes RCC config, it asserts it's valid instead.     - If it's valid but can't run in STOP mode, it prints a warning and inhibits STOP. - restore clocks after Stop, run HIL tests in real Stop     - remove the `low-power-debug-with-sleep` feature.     - restore the clocks after Stop on all families with low-power support.     - tests: remove `fake-stop`, run all low-power boards in real Stop.     - ci: disable the tests that fail in Stop for now.  - some more errata workarounds.     - workaround u0 instruction fetch corruption on stop exit.     - do not reset BD in L5, it has the same errata as H5. 

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

### Incident Patch 1: `6bd3541f` (2026-11-17)
**Commit Message**: stm32: fix LPTIM time driver and low-power builds, make the LPTIM clock explicit

- time-driver-lptim: build on every LPTIM version. v1/v1a/v1b count the
  overflow on ARRM; the v2 register API is keyed on lptim_v2a/lptim_v2b.
- time-driver-lptim: rcc::init no longer changes the clock config. The
  driver reads its kernel clock mux at init, panics if it can't run from
  it, and with low-power disables Stop (with a warning) when the clock
  doesn't run in Stop.
- rcc: f2/f4/f7, g0, g4, h5/h7 report LSE/LSI; u3 applies LSESYSEN.
- low-power: build on L412/L422, L4P5/L4Q5, U3 with TIM, U0 with LPTIM.
- Add CI builds for the LPTIM/low-power combinations and an LPTIM time
  driver HIL test (tests/stm32-lptim).

**File**: `embassy-stm32/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -49,6 +49,8 @@ RCC:
 - feat: stm32/rcc u5: backup SRAM; `BackupMemory::new` enables its clock
 - feat: stm32/rcc: add `rcc::reset_flags()` to read what caused the last reset.
 - change: stm32/rcc h7: remove `rcc::ResetReason`, use `rcc::reset_flags()` instead (breaking change).
+- fix: stm32/rcc f2, f4, f7, g0, g4, h5, h7: report the LSE and LSI frequencies, so peripherals can use them as kernel clock
+- fix: stm32/rcc u3: `LseConfig::peripherals_clocked` sets `LSESYSEN`; it was ignored
 
 LPTIM:
 - fix: stm32/lptim: a period whose tick count is at least 65536 no longer panics when rounding the divider up to a power of two still leaves the reload above 65535. The prescaler is the smallest of /1, /2, ..., /128 for which the reload fits in 16 bits. A period that does not fit even at /128 still panics.
@@ -60,6 +62,11 @@ Time driver:
 - fix: stm32/time-driver-lptim: the interrupt handler clears only the flags it read; it also cleared every enabled flag, so an overflow that arrived during the handler was lost and time fell back one counter period
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, wait for `DIEROK` after each `DIER` change; a `CCIE` write still in flight when entering Stop lost the alarm wakeup until the next overflow
 - fix: stm32/time-driver-lptim: `now()` retries if the update event flag changes while it reads the counter; a wrap between the two reads returned a time one counter period ahead, then time went backwards
+- fix: stm32/time-driver-lptim: build on chips with LPTIM v1, v1a or v1b (F4, F7, G0, G4, H7, L0, L4, L4+, WB), which have no update event; the counter overflow is counted on `ARRM`
+- fix: stm32/time-driver-lptim: build on C5, H5, L5, U0 and U3; `time-driver-lptim3` on U5 and U3 uses the shared LPTIM3/LPTIM4 kernel clock mux
+- change: stm32/time-driver-lptim: `init` no longer changes `config.rcc`. The LPTIM kernel clock must be selected in `config.rcc.mux` and enabled in `config.rcc` (LSE with `peripherals_clocked: true` on L5, U0, U3, U5, WBA and WL); the reset value is no longer switched to LSI, and LSI and HSI are no longer enabled (breaking change).
+- change: stm32/time-driver-lptim: panic at `init` if the LPTIM kernel clock is LSE not routed to peripherals, or a frequency that is not 1, 2, 4, ..., 128 times the tick rate.
+- change: stm32/time-driver-lptim: with `low-power`, an LPTIM kernel clock other than LSI or LSE disables Stop mode and logs a warning.
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, the wait for `CMPOK` after a compare write is bounded, as the `DIEROK` wait is, instead of spinning forever with interrupts masked; both bounds now count counter clock cycles, so a prescaled counter no longer gives up on a `DIEROK` that is only slow
 
 I2C:
@@ -119,6 +126,7 @@ Flash:
 Low power:
 - fix: stm32/low-power: fail to compile on chip families with no low-power implementation, instead of building a `sleep()` that set `SLEEPDEEP` and entered whatever `PWR` happened to default to, without clearing the wake-up flags or restoring the system clock on wake-up. Implemented families are F4, G4, L0, L4, L5, U0, U3, U5, H5, WB, WBA and WL.
 - add: stm32/low-power: Stop mode support for STM32G4, entering the low-power-regulator stop (`PWR_CR1.LPMS = 0b001`).
+- fix: stm32/low-power: build on L412/L422 and L4P5/L4Q5, on U3 with a TIM time driver, and on U0 with an LPTIM time driver
 
 Align to API guidelines:
 - change: stm32/gpio: rename `get_level()` to `level()` and `get_output_level()` to `output_level()` on `Input`, `Output`, `OutputOpenDrain`, `Flex` and `ExtiInput`. `lpgpio::LpGpio::get_level()` is now `level()`.
```

**File**: `embassy-stm32/Cargo.toml` (modified, +30/-2)
```diff
@@ -134,6 +134,34 @@ build = [
     {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "stm32c552rc", "time", "time-driver-any"]},
     {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "stm32g070rb", "time", "time-driver-any"]},
     {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h755zi-cm4", "time", "time-driver-any"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "stm32c531cb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32f410c8", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "stm32f767zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "stm32g071rb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32g474re", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32h503rb", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32h563zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h723zg", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h753zi", "time", "time-driver-lptim3"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h755zi-cm7", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h7a3zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h7s3l8", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "low-power", "stm32l073rz", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l412kb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l412kb", "time", "time-driver-any"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l476rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l4p5ae", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l4r5zi", "time", "time-driver-lptim2"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l552ze", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "low-power", "stm32u083rc", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-lptim3"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-any"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u585ai", "time", "time-driver-lptim3"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wb55rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32wba65ri", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wl55jc-cm4", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wle5jc", "time", "time-driver-lptim1"]},
 ]
 
 [package.metadata.embassy_docs]
@@ -229,11 +257,11 @@ aligned = "0.4.3"
 heapless = "0.9.3"
 
 # stm32-metapac = { version = "21" }
-stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-82e648dd53815704702719594a12c87e95dd48d8" }
+stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-af2c47a6ac9618b5e4cb3a490b2429fcdcd8bb91" }
 
 [build-dependencies]
 # stm32-metapac = { version = "21", default-features = false, features = ["metadata"]}
-stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-82e648dd53815704702719594a12c87e95dd48d8", default-features = false, features = ["metadata"] }
+stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-af2c47a6ac9618b5e4cb3a490b2429fcdcd8bb91", default-features = false, features = ["metadata"] }
 
 proc-macro2 = "1.0.107"
 quote = "1.0.47"
```

**File**: `embassy-stm32/build.rs` (modified, +68/-0)
```diff
@@ -1189,6 +1189,74 @@ fn main() {
         }
     });
 
+    // The kernel clock selected for an LPTIM time driver, so the driver can check that it can run
+    // and whether it keeps running in Stop mode.
+    if let Some(p) = METADATA.peripherals.iter().find(|p| p.name == time_driver_singleton)
+        && p.registers.as_ref().is_some_and(|r| r.kind == "lptim")
+        && let Some(rcc) = &p.rcc
+        && let PeripheralRccKernelClock::Mux(mux) = &rcc.kernel_clock
+    {
+        let ir = &clock_gen.rcc_registers.ir;
+        let fieldset_name = mux.register.to_ascii_lowercase();
+        let fieldset = ir
+            .fieldsets
+            .iter()
+            .find(|i| i.name.eq_ignore_ascii_case(&fieldset_name))
+            .unwrap();
+        let field_name = mux.field.to_ascii_lowercase();
+        let field = fieldset.fields.iter().find(|i| i.name == field_name).unwrap();
+        let enum_name = field.enumm.unwrap();
+        let enumm = ir.enums.iter().find(|i| i.name == enum_name).unwrap();
+
+        let mut name_arms = TokenStream::new();
+        for v in enumm.variants {
+            let variant = format_ident!("{}", v.name);
+            let name = pascal_to_upper_snake(v.name);
+            name_arms.extend(quote!(Sel::#variant => #name,));
+        }
+        let has = |name: &str| enumm.variants.iter().any(|v| v.name == name);
+        let is_lsi = if has("Lsi") {
+            quote!(sel() == Sel::Lsi)
+        } else {
+            quote!(false)
+        };
+        let is_lse = if has("Lse") {
+            quote!(sel() == Sel::Lse)
+        } else {
+            quote!(false)
+        };
+
+        let fieldset_name = format_ident!("{}", fieldset_name);
+        let field_name = format_ident!("{}", field_name);
+        let enum_name = format_ident!("{}", enum_name);
+        g.extend(quote! {
+            pub(crate) mod time_driver_clock {
+                use crate::pac::rcc::vals::#enum_name as Sel;
+
+                fn sel() -> Sel {
+                    crate::pac::RCC.#fieldset_name().read().#field_name()
+                }
+
+                /// Name of the selected clock.
+                pub(crate) fn name() -> &'static str {
+                    #[allow(unreachable_patterns)]
+                    match sel() {
+                        #name_arms
+                        _ => "?",
+                    }
+                }
+
+                pub(crate) fn is_lsi() -> bool {
+                    #is_lsi
+                }
+
+                pub(crate) fn is_lse() -> bool {
+                    #is_lse
+                }
+            }
+        });
+    }
+
     // Generate RCC
     clock_gen.clock_names.insert("sys".to_string());
     clock_gen.clock_names.insert("rtc".to_string());
```

**File**: `embassy-stm32/src/low_power.rs` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ foreach_interrupt! {
     };
 }
 
-#[cfg(all(feature = "rt", stm32u0))]
+#[cfg(all(feature = "rt", stm32u0, not(feature = "_lp-time-driver")))]
 foreach_interrupt! {
     (RTC, rtc, $block:ident, TAMP, $irq:ident) => {
         #[interrupt]
```

**File**: `embassy-stm32/src/rcc/bd.rs` (modified, +4/-4)
```diff
@@ -169,7 +169,7 @@ impl LsConfig {
             },
             None => (false, false, None),
         };
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         let lse_sysen = if let Some(lse) = self.lse {
             Some(lse.peripherals_clocked)
         } else {
@@ -298,7 +298,7 @@ impl LsConfig {
         {
             ok &= lsecfgr.lsebyp() == lse_byp;
         }
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         if let Some(lse_sysen) = lse_sysen
             && !lse_sysen
         {
@@ -315,7 +315,7 @@ impl LsConfig {
 
         // After a power-on reset LSESYSEN will be set to 0
         // even if VBAT was present and kept the RTC running
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         if ok
             && let Some(lse_sysen) = lse_sysen
             && lse_sysen
@@ -388,7 +388,7 @@ impl LsConfig {
                 while !crate::pac::RCC.sr().read().lserdy() {}
             }
 
-            #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+            #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
             if let Some(lse_sysen) = lse_sysen {
                 bdcr().modify(|w| {
                     w.set_lsesysen(lse_sysen);
```

**File**: `embassy-stm32/src/rcc/f247.rs` (modified, +3/-2)
```diff
@@ -11,6 +11,7 @@ pub use crate::pac::rcc::vals::{
     Pllsrc as PllSource, Ppre as APBPrescaler, Sw as Sysclk,
 };
 use crate::pac::{FLASH, RCC};
+use crate::rcc::LSI_FREQ;
 #[cfg(dsihost)]
 use crate::rcc::dsi;
 #[cfg(dsihost)]
@@ -338,8 +339,8 @@ pub(crate) unsafe fn init(config: Config) {
     set_clocks!(
         hsi: hsi,
         hse: hse,
-        lse: None, // TODO
-        lsi: None, // TODO
+        lse: config.ls.lse.map(|l| l.frequency),
+        lsi: config.ls.lsi.then_some(LSI_FREQ),
         sys: Some(sys),
         hclk1: Some(hclk),
         hclk2: Some(hclk),
```

**File**: `embassy-stm32/src/rcc/g0.rs` (modified, +2/-4)
```diff
@@ -369,10 +369,8 @@ pub(crate) unsafe fn init(config: Config) {
         #[cfg(crs)]
         hsi48: hsi48,
         rtc: rtc,
-
-        // TODO
-        lsi: None,
-        lse: None,
+        lsi: config.ls.lsi.then_some(LSI_FREQ),
+        lse: config.ls.lse.map(|l| l.frequency),
     );
 }
 
```

**File**: `embassy-stm32/src/rcc/g4.rs` (modified, +3/-2)
```diff
@@ -4,6 +4,7 @@ pub use crate::pac::rcc::vals::{
     Pllsrc as PllSource, Ppre as APBPrescaler, Sw as Sysclk,
 };
 use crate::pac::{FLASH, PWR, RCC};
+use crate::rcc::LSI_FREQ;
 use crate::time::Hertz;
 
 /// HSI speed
@@ -332,8 +333,8 @@ pub(crate) unsafe fn init(config: Config) {
         hsi48: hsi48,
         rtc: rtc,
         i2s_ckin: None,
-        lsi: None,
-        lse: None,
+        lsi: config.ls.lsi.then_some(LSI_FREQ),
+        lse: config.ls.lse.map(|l| l.frequency),
     );
 }
 
```

---

### Incident Patch 2: `326f980c` (2026-11-18)
**Commit Message**: Merge pull request #7584 from embassy-rs/stm32-lp-build-fixes

stm32/low-power: build for more chips, restore clocks in all chips, misc fixes

**File**: `ci.sh` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ rm -rf out/tests/nrf51422-dk
 
 # temporarily disabled
 rm -rf out/tests/stm32f767zi
-rm -rf out/tests/stm32f429zi
+rm -f out/tests/stm32f429zi/i2s_dma
 
 rm -f out/tests/stm32u585ai/saes
 
```

**File**: `embassy-stm32/CHANGELOG.md` (modified, +15/-0)
```diff
@@ -49,6 +49,8 @@ RCC:
 - feat: stm32/rcc u5: backup SRAM; `BackupMemory::new` enables its clock
 - feat: stm32/rcc: add `rcc::reset_flags()` to read what caused the last reset.
 - change: stm32/rcc h7: remove `rcc::ResetReason`, use `rcc::reset_flags()` instead (breaking change).
+- fix: stm32/rcc f2, f4, f7, g0, g4, h5, h7: report the LSE and LSI frequencies, so peripherals can use them as kernel clock
+- fix: stm32/rcc u3: `LseConfig::peripherals_clocked` sets `LSESYSEN`; it was ignored
 
 LPTIM:
 - fix: stm32/lptim: a period whose tick count is at least 65536 no longer panics when rounding the divider up to a power of two still leaves the reload above 65535. The prescaler is the smallest of /1, /2, ..., /128 for which the reload fits in 16 bits. A period that does not fit even at /128 still panics.
@@ -60,6 +62,11 @@ Time driver:
 - fix: stm32/time-driver-lptim: the interrupt handler clears only the flags it read; it also cleared every enabled flag, so an overflow that arrived during the handler was lost and time fell back one counter period
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, wait for `DIEROK` after each `DIER` change; a `CCIE` write still in flight when entering Stop lost the alarm wakeup until the next overflow
 - fix: stm32/time-driver-lptim: `now()` retries if the update event flag changes while it reads the counter; a wrap between the two reads returned a time one counter period ahead, then time went backwards
+- fix: stm32/time-driver-lptim: build on chips with LPTIM v1, v1a or v1b (F4, F7, G0, G4, H7, L0, L4, L4+, WB), which have no update event; the counter overflow is counted on `ARRM`
+- fix: stm32/time-driver-lptim: build on C5, H5, L5, U0 and U3; `time-driver-lptim3` on U5 and U3 uses the shared LPTIM3/LPTIM4 kernel clock mux
+- change: stm32/time-driver-lptim: `init` no longer changes `config.rcc`. The LPTIM kernel clock must be selected in `config.rcc.mux` and enabled in `config.rcc` (LSE with `peripherals_clocked: true` on L5, U0, U3, U5, WBA and WL); the reset value is no longer switched to LSI, and LSI and HSI are no longer enabled (breaking change).
+- change: stm32/time-driver-lptim: panic at `init` if the LPTIM kernel clock is LSE not routed to peripherals, or a frequency that is not 1, 2, 4, ..., 128 times the tick rate.
+- change: stm32/time-driver-lptim: with `low-power`, an LPTIM kernel clock other than LSI or LSE disables Stop mode and logs a warning.
 - fix: stm32/time-driver-lptim: on U5, U3 and WBA, the wait for `CMPOK` after a compare write is bounded, as the `DIEROK` wait is, instead of spinning forever with interrupts masked; both bounds now count counter clock cycles, so a prescaled counter no longer gives up on a `DIEROK` that is only slow
 
 I2C:
@@ -119,6 +126,14 @@ Flash:
 Low power:
 - fix: stm32/low-power: fail to compile on chip families with no low-power implementation, instead of building a `sleep()` that set `SLEEPDEEP` and entered whatever `PWR` happened to default to, without clearing the wake-up flags or restoring the system clock on wake-up. Implemented families are F4, G4, L0, L4, L5, U0, U3, U5, H5, WB, WBA and WL.
 - add: stm32/low-power: Stop mode support for STM32G4, entering the low-power-regulator stop (`PWR_CR1.LPMS = 0b001`).
+- fix: stm32/low-power: build on L412/L422 and L4P5/L4Q5, on U3 with a TIM time driver, and on U0 with an LPTIM time driver
+- fix: stm32/low-power: restore the clocks after Stop on L0, L4, L5, U0, WB and H5 (including the voltage scale and flash latency on H5), which kept running on the wake-up clock.
+- change: stm32/low-power: after Stop, turn back on only the oscillators, PLLs and voltage settings that Stop turned off, instead of re-running the RCC init (U3, U5, WL, WBA, F4, G4).
+- fix: stm32/low-power l0: only put the regulator in low-power mode for Stop, not for the `WFI` sleeps after it.
+- fix: stm32/low-power u0: execute the `WFI` from RAM. With `enable_debug_during_sleep`, the chip HardFaulted on wake-up from Stop.
+- fix: stm32/rcc l5: don't reset the backup domain when configuring LSE/LSI, which also erased SRAM2.
+- change: stm32/rcc l5: `LsConfig::new()` and `LsConfig::default()` use LSI for the RTC, like the other families, instead of turning it off.
+- change: stm32/low-power: remove the `low-power-debug-with-sleep` feature.
 
 Align to API guidelines:
 - change: stm32/gpio: rename `get_level()` to `level()` and `get_output_level()` to `output_level()` on `Input`, `Output`, `OutputOpenDrain`, `Flex` and `ExtiInput`. `lpgpio::LpGpio::get_level()` is now `level()`.
```

**File**: `embassy-stm32/Cargo.toml` (modified, +30/-3)
```diff
@@ -134,6 +134,34 @@ build = [
     {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "stm32c552rc", "time", "time-driver-any"]},
     {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "stm32g070rb", "time", "time-driver-any"]},
     {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h755zi-cm4", "time", "time-driver-any"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "stm32c531cb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32f410c8", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "stm32f767zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "stm32g071rb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32g474re", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32h503rb", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32h563zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h723zg", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h753zi", "time", "time-driver-lptim3"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h755zi-cm7", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h7a3zi", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "stm32h7s3l8", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "low-power", "stm32l073rz", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l412kb", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l412kb", "time", "time-driver-any"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32l476rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l4p5ae", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l4r5zi", "time", "time-driver-lptim2"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "dual-bank", "exti", "low-power", "stm32l552ze", "time", "time-driver-lptim1"]},
+    {target = "thumbv6m-none-eabi", features = ["defmt", "exti", "low-power", "stm32u083rc", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-lptim3"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u385rg", "time", "time-driver-any"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32u585ai", "time", "time-driver-lptim3"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wb55rg", "time", "time-driver-lptim1"]},
+    {target = "thumbv8m.main-none-eabihf", features = ["defmt", "exti", "low-power", "stm32wba65ri", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wl55jc-cm4", "time", "time-driver-lptim1"]},
+    {target = "thumbv7em-none-eabi", features = ["defmt", "exti", "low-power", "stm32wle5jc", "time", "time-driver-lptim1"]},
 ]
 
 [package.metadata.embassy_docs]
@@ -229,11 +257,11 @@ aligned = "0.4.3"
 heapless = "0.9.3"
 
 # stm32-metapac = { version = "21" }
-stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-82e648dd53815704702719594a12c87e95dd48d8" }
+stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-af2c47a6ac9618b5e4cb3a490b2429fcdcd8bb91" }
 
 [build-dependencies]
 # stm32-metapac = { version = "21", default-features = false, features = ["metadata"]}
-stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-82e648dd53815704702719594a12c87e95dd48d8", default-features = false, features = ["metadata"] }
+stm32-metapac = { git = "https://github.com/embassy-rs/stm32-data-generated", tag = "stm32-data-af2c47a6ac9618b5e4cb3a490b2429fcdcd8bb91", default-features = false, features = ["metadata"] }
 
 proc-macro2 = "1.0.107"
 quote = "1.0.47"
@@ -354,7 +382,6 @@ embassy-crypto-p384-ecdsa = ["dep:crypto-bigint"]
```

**File**: `embassy-stm32/build.rs` (modified, +68/-0)
```diff
@@ -1189,6 +1189,74 @@ fn main() {
         }
     });
 
+    // The kernel clock selected for an LPTIM time driver, so the driver can check that it can run
+    // and whether it keeps running in Stop mode.
+    if let Some(p) = METADATA.peripherals.iter().find(|p| p.name == time_driver_singleton)
+        && p.registers.as_ref().is_some_and(|r| r.kind == "lptim")
+        && let Some(rcc) = &p.rcc
+        && let PeripheralRccKernelClock::Mux(mux) = &rcc.kernel_clock
+    {
+        let ir = &clock_gen.rcc_registers.ir;
+        let fieldset_name = mux.register.to_ascii_lowercase();
+        let fieldset = ir
+            .fieldsets
+            .iter()
+            .find(|i| i.name.eq_ignore_ascii_case(&fieldset_name))
+            .unwrap();
+        let field_name = mux.field.to_ascii_lowercase();
+        let field = fieldset.fields.iter().find(|i| i.name == field_name).unwrap();
+        let enum_name = field.enumm.unwrap();
+        let enumm = ir.enums.iter().find(|i| i.name == enum_name).unwrap();
+
+        let mut name_arms = TokenStream::new();
+        for v in enumm.variants {
+            let variant = format_ident!("{}", v.name);
+            let name = pascal_to_upper_snake(v.name);
+            name_arms.extend(quote!(Sel::#variant => #name,));
+        }
+        let has = |name: &str| enumm.variants.iter().any(|v| v.name == name);
+        let is_lsi = if has("Lsi") {
+            quote!(sel() == Sel::Lsi)
+        } else {
+            quote!(false)
+        };
+        let is_lse = if has("Lse") {
+            quote!(sel() == Sel::Lse)
+        } else {
+            quote!(false)
+        };
+
+        let fieldset_name = format_ident!("{}", fieldset_name);
+        let field_name = format_ident!("{}", field_name);
+        let enum_name = format_ident!("{}", enum_name);
+        g.extend(quote! {
+            pub(crate) mod time_driver_clock {
+                use crate::pac::rcc::vals::#enum_name as Sel;
+
+                fn sel() -> Sel {
+                    crate::pac::RCC.#fieldset_name().read().#field_name()
+                }
+
+                /// Name of the selected clock.
+                pub(crate) fn name() -> &'static str {
+                    #[allow(unreachable_patterns)]
+                    match sel() {
+                        #name_arms
+                        _ => "?",
+                    }
+                }
+
+                pub(crate) fn is_lsi() -> bool {
+                    #is_lsi
+                }
+
+                pub(crate) fn is_lse() -> bool {
+                    #is_lse
+                }
+            }
+        });
+    }
+
     // Generate RCC
     clock_gen.clock_names.insert("sys".to_string());
     clock_gen.clock_names.insert("rtc".to_string());
```

**File**: `embassy-stm32/src/lib.rs` (modified, +3/-3)
```diff
@@ -664,7 +664,7 @@ mod dual_core {
         clocks: UnsafeCell<MaybeUninit<Clocks>>,
         config: UnsafeCell<MaybeUninit<SharedConfig>>,
         #[cfg(feature = "low-power")]
-        rcc_config: UnsafeCell<MaybeUninit<Option<rcc::Config>>>,
+        stop_restore: UnsafeCell<MaybeUninit<Option<rcc::StopRestore>>>,
     }
 
     unsafe impl Sync for SharedData {}
@@ -699,7 +699,7 @@ mod dual_core {
 
         rcc::set_freqs_ptr(shared_data.clocks.get());
         #[cfg(feature = "low-power")]
-        rcc::set_rcc_config_ptr(shared_data.rcc_config.get());
+        rcc::set_stop_restore_ptr(shared_data.stop_restore.get());
         let p = init_hw(config);
 
         hsem::get_hsem(1).blocking_notify();
@@ -748,7 +748,7 @@ mod dual_core {
     fn init_secondary_hw(shared_data: &'static SharedData) -> Peripherals {
         rcc::set_freqs_ptr(shared_data.clocks.get());
         #[cfg(feature = "low-power")]
-        rcc::set_rcc_config_ptr(shared_data.rcc_config.get());
+        rcc::set_stop_restore_ptr(shared_data.stop_restore.get());
 
         let config = unsafe { (*shared_data.config.get()).assume_init() };
 
```

**File**: `embassy-stm32/src/low_power.rs` (modified, +42/-71)
```diff
@@ -74,7 +74,7 @@ foreach_interrupt! {
     };
 }
 
-#[cfg(all(feature = "rt", stm32u0))]
+#[cfg(all(feature = "rt", stm32u0, not(feature = "_lp-time-driver")))]
 foreach_interrupt! {
     (RTC, rtc, $block:ident, TAMP, $irq:ident) => {
         #[interrupt]
@@ -110,7 +110,6 @@ mod platform {
         #[cfg(stm32wb)]
         let mutex = {
             use crate::hsem::get_hsem;
-            use crate::pac::rcc::vals::{Smps, Sw};
             use crate::pac::{PWR, RCC};
 
             trace!("low power: trying to get sem3");
@@ -126,27 +125,7 @@ mod platform {
 
             if !(sem4_mutex.is_some() && !PWR.extscr().read().c2ds()) {
                 sem4_mutex.take();
-
-                // Set HSION
-                RCC.cr().modify(|w| {
-                    w.set_hsion(true);
-                });
-
-                // Wait for HSIRDY
-                while !RCC.cr().read().hsirdy() {}
-
-                // Set SW to HSI
-                RCC.cfgr().modify(|w| {
-                    w.set_sw(Sw::Hsi);
-                });
-
-                // Wait for SWS to report HSI
-                while !RCC.cfgr().read().sws().eq(&Sw::Hsi) {}
-
-                // Set SMPSSEL to HSI
-                RCC.smpscr().modify(|w| {
-                    w.set_smpssel(Smps::Hsi);
-                });
+                crate::rcc::stop_switch_to_hsi();
             }
 
             // on PWR
@@ -236,8 +215,13 @@ mod platform {
         // Clear WKUP1..WKUP8 pending flags (CWUFx) before stop entry.
         crate::pac::PWR.wuscr().write(|w| w.0 = 0xff);
 
+        // LPSDSR also puts the regulator in low-power mode in Sleep, which needs the system clock
+        // at or below MSI range 1 (RM0377 6.3.8), so it's only set for Stop.
         #[cfg(stm32l0)]
-        crate::pac::PWR.cr().modify(|w| w.set_cwuf(true));
+        crate::pac::PWR.cr().modify(|w| {
+            w.set_cwuf(true);
+            w.set_lpsdsr(crate::pac::pwr::vals::Mode::MainMode);
+        });
 
         #[cfg(stm32g4)]
         // G4 keeps its wake-up flags (WUF1..WUF5) in PWR_SR1 and the standby flag (SBF) there
@@ -254,19 +238,24 @@ mod platform {
         });
     }
 
-    /// Exit stop mode, reinitializing timer and rcc if required
+    /// Exit stop mode: restore the clocks, clear the flags and reinitialize the timer if required.
     pub fn exit_stop(_cs: CriticalSection) {
+        // Both cores share the clocks, so they restore them one at a time.
+        #[cfg(any(stm32wb, stm32wl5x))]
+        let lock = crate::hsem::get_hsem(3).blocking_lock(0);
+
+        crate::rcc::stop_exit(_cs);
+
+        #[cfg(any(stm32wb, stm32wl5x))]
+        drop(lock);
+
         #[cfg(any(stm32u5, stm32u3))]
         {
             let sr = crate::pac::PWR.sr().read();
             if sr.stopf() {
                 let lpms = crate::pac::PWR.cr1().read().lpms();
                 debug!("low power: U5/U3 woke from STOP (LPMS={})", lpms.to_bits());
 
-                // HSE and all PLLs stop in any STOP mode on U5/U3.
-                // Full RCC restore from saved config on every STOP exit.
-                crate::rcc::reinit_saved(_cs);
-
                 // GPTIM timer state is lost in Stop2/Stop3, needs re-init.
                 // LPTIM (_lp-time-driver) survives all STOP modes autonomously.
                 #[cfg(not(feature = "_lp-time-driver"))]
@@ -280,45 +269,17 @@ mod platform {
             crate::pac::PWR.sr().modify(|w| w.set_cssf(true));
         }
 
-        #[cfg(any(stm32wl, stm32wb, stm32wba, stm32f4, stm32g4))]
-        {
-            // stm32wl5x is dual core and we don't want BOTH cores to re-initialize RCC so we hold a lock
-            #[cfg(stm32wl5x)]
-            let lock = crate::hsem::get_hsem(3).blocking_lock(0);
+        #[cfg(stm32h5)]
+        crate::pac::PWR.pmcr().modify(|w| w.set_cssf(true));
 
+        #[cfg(any(stm32wl, stm32wb, stm32wba))]
+        {
             #[cfg(any(stm32wl, stm32wb))]
             let es = crate::pac::PWR.extscr().read();
 
             #[cfg(stm32wba)]
             let es = crate::pac::PWR.sr().read();
 
-            // we need to re-initialize RCC if *BOTH* cores have been in some STOP mode!
-            #[cfg(any(stm32wl, stm32wba, stm32f4, stm32g4))]
-            let re_initialize_rcc = {
-                #[cfg(stm32wl5x)]
-                {
-                    // core 1 in any STOP mode AND core 2 in any STOP mode
-                    (es.c1stopf() || es.c1stop2f()) && (es.c2stopf() || es.c2stop2f())
-                }
-                #[cfg(stm32wlex)]
-                {
-                    es.c1stop2f() || es.c1stopf()
-                }
-                #[cfg(stm32wba)]
-                {
-                    es.stopf()
-                }
-                // F4 and G4 always need it: neither has STOPWUCK (RM0440 Table 40 lists HSI16 as
-                // the only wake-up system clock for Stop 0/1), so exiting Stop always lands us on
-                // HSI16 rather than the configured PLL. `reini
```

**File**: `embassy-stm32/src/rcc/bd.rs` (modified, +18/-14)
```diff
@@ -99,13 +99,7 @@ pub struct LsConfig {
 impl LsConfig {
     /// Creates an [`LsConfig`] using the LSI when possible.
     pub const fn new() -> Self {
-        // on L5, just the fact that LSI is enabled makes things crash.
-        // TODO: investigate.
-
-        #[cfg(not(stm32l5))]
-        return Self::default_lsi();
-        #[cfg(stm32l5)]
-        return Self::off();
+        Self::default_lsi()
     }
 
     pub const fn default_lse() -> Self {
@@ -169,7 +163,7 @@ impl LsConfig {
             },
             None => (false, false, None),
         };
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         let lse_sysen = if let Some(lse) = self.lse {
             Some(lse.peripherals_clocked)
         } else {
@@ -181,7 +175,7 @@ impl LsConfig {
         // Disable backup domain write protection
         unlock();
 
-        if self.lsi {
+        let enable_lsi = || {
             #[cfg(any(stm32u5, stm32h5, stm32wba))]
             let csr = crate::pac::RCC.bdcr();
             #[cfg(stm32n6)]
@@ -205,6 +199,9 @@ impl LsConfig {
 
             #[cfg(any(rcc_wb, rcc_wba))]
             while !csr.read().lsi1rdy() {}
+        };
+        if self.lsi {
+            enable_lsi();
         }
 
         // Enable backup regulator for persistent battery backed sram
@@ -298,7 +295,7 @@ impl LsConfig {
         {
             ok &= lsecfgr.lsebyp() == lse_byp;
         }
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         if let Some(lse_sysen) = lse_sysen
             && !lse_sysen
         {
@@ -315,7 +312,7 @@ impl LsConfig {
 
         // After a power-on reset LSESYSEN will be set to 0
         // even if VBAT was present and kept the RTC running
-        #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+        #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
         if ok
             && let Some(lse_sysen) = lse_sysen
             && lse_sysen
@@ -334,11 +331,17 @@ impl LsConfig {
         }
 
         // If not OK, reset backup domain and configure it.
-        #[cfg(not(any(rcc_l0, rcc_l0_v2, rcc_l1, stm32h5, stm32h7rs, stm32c0, stm32n6, stm32u5)))]
+        #[cfg(not(any(rcc_l0, rcc_l0_v2, rcc_l1, stm32h5, stm32h7rs, stm32c0, stm32n6, stm32u5, stm32l5)))]
         {
             bdcr().modify(|w| w.set_bdrst(true));
             bdcr().modify(|w| w.set_bdrst(false));
         }
+        // The reset turns the LSI off on WBA, although RM0493 says it doesn't reset LSI1ON
+        // (checked on an STM32WBA52).
+        #[cfg(stm32wba)]
+        if self.lsi {
+            enable_lsi();
+        }
         // H5 has a terrible, terrible errata: 'SRAM2 is erased when the backup domain is reset'
         // pending a more sane sane way to handle this, just don't reset BD for now.
         // This means the RTCSEL write below will have no effect, only if it has already been written
@@ -348,7 +351,8 @@ impl LsConfig {
         // STM32H562xx/563xx/573xx device errata - 2.2.14 SRAM2 is erased when the backup domain is reset
         // The U5 does the same: SRAM2 is one of the "device secrets" a backup domain reset wipes
         // (RM0456, tamper and backup registers), observed on an STM32U585 where the erase zeroed
-        // the 64 kB of SRAM2 during `init`.
+        // the 64 kB of SRAM2 during `init`. L5 too: "The SRAM2 is also erased by a Backup domain
+        // reset" (RM0438, memory and bus architecture).
         //#[cfg(any(stm32h5, stm32h7rs))]
         #[cfg(any(stm32h7rs, stm32n6))]
         {
@@ -388,7 +392,7 @@ impl LsConfig {
                 while !crate::pac::RCC.sr().read().lserdy() {}
             }
 
-            #[cfg(any(rcc_l5, rcc_u5, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
+            #[cfg(any(rcc_l5, rcc_u5, rcc_u3, rcc_wle, rcc_wl5, rcc_wba, rcc_u0))]
             if let Some(lse_sysen) = lse_sysen {
                 bdcr().modify(|w| {
                     w.set_lsesysen(lse_sysen);
```

**File**: `embassy-stm32/src/rcc/f247.rs` (modified, +80/-2)
```diff
@@ -11,6 +11,7 @@ pub use crate::pac::rcc::vals::{
     Pllsrc as PllSource, Ppre as APBPrescaler, Sw as Sysclk,
 };
 use crate::pac::{FLASH, RCC};
+use crate::rcc::LSI_FREQ;
 #[cfg(dsihost)]
 use crate::rcc::dsi;
 #[cfg(dsihost)]
@@ -338,8 +339,8 @@ pub(crate) unsafe fn init(config: Config) {
     set_clocks!(
         hsi: hsi,
         hse: hse,
-        lse: None, // TODO
-        lsi: None, // TODO
+        lse: config.ls.lse.map(|l| l.frequency),
+        lsi: config.ls.lsi.then_some(LSI_FREQ),
         sys: Some(sys),
         hclk1: Some(hclk),
         hclk2: Some(hclk),
@@ -378,6 +379,83 @@ pub(crate) unsafe fn init(config: Config) {
     );
 }
 
+/// The clocks to bring back after Stop.
+///
+/// F4 wakes up on HSI at 16 MHz with HSE and the PLLs off (RM0090 5.3.4, 6.3.1), which runs at
+/// 0 wait states at any supply voltage, so the flash latency never needs raising before Stop. The
+/// chips with over-drive also lose it and drop to voltage scale 3 until the PLL is on (RM0090
+/// 5.1.4).
+#[cfg(feature = "low-power")]
+#[derive(Clone, Copy)]
+pub(crate) struct StopRestore {
+    cr: crate::pac::rcc::regs::Cr,
+    sw: Sysclk,
+    #[cfg(any(stm32f446, stm32f4x9, stm32f427, stm32f437))]
+    overdrive: bool,
+}
+
+#[cfg(feature = "low-power")]
+impl StopRestore {
+    pub(crate) fn capture() -> Self {
+        Self {
+            cr: RCC.cr().read(),
+            sw: RCC.cfgr().read().sws(),
+            #[cfg(any(stm32f446, stm32f4x9, stm32f427, stm32f437))]
+            overdrive: PWR.cr1().read().odswen(),
+        }
+    }
+
+    pub(crate) fn enter(&self) {}
+
+    pub(crate) fn exit(&self) {
+        let s = self.cr;
+        RCC.cr().modify(|w| w.set_hseon(w.hseon() | s.hseon()));
+        while s.hseon() && !RCC.cr().read().hserdy() {}
+
+        RCC.cr().modify(|w| {
+            w.set_pllon(w.pllon() | s.pllon());
+            #[cfg(not(stm32f410))]
+            w.set_plli2son(w.plli2son() | s.plli2son());
+            #[cfg(any(stm32f446, stm32f427, stm32f437, stm32f4x9))]
+            w.set_pllsaion(w.pllsaion() | s.pllsaion());
+        });
+
+        // Over-drive goes back on once the PLL is on, while still running on HSI (RM0090 5.1.4).
+        #[cfg(any(stm32f446, stm32f4x9, stm32f427, stm32f437))]
+        if self.overdrive && !PWR.cr1().read().odswen() {
+            PWR.cr1().modify(|w| w.set_oden(true));
+            while !PWR.csr1().read().odrdy() {}
+            PWR.cr1().modify(|w| w.set_odswen(true));
+            while !PWR.csr1().read().odswrdy() {}
+        }
+
+        loop {
+            let cr = RCC.cr().read();
+            #[allow(unused_mut)]
+            let mut ready = cr.pllrdy() | !s.pllon();
+            #[cfg(not(stm32f410))]
+            {
+                ready &= cr.plli2srdy() | !s.plli2son();
+            }
+            #[cfg(any(stm32f446, stm32f427, stm32f437, stm32f4x9))]
+            {
+                ready &= cr.pllsairdy() | !s.pllsaion();
+            }
+            if ready {
+                break;
+            }
+        }
+
+        if RCC.cfgr().read().sws() != self.sw {
+            RCC.cfgr().modify(|w| w.set_sw(self.sw));
+            while RCC.cfgr().read().sws() != self.sw {}
+        }
+        if !s.hsion() {
+            RCC.cr().modify(|w| w.set_hsion(false));
+        }
+    }
+}
+
 struct PllInput {
     source: PllSource,
     hsi: Option<Hertz>,
```

---

### Incident Patch 3: `4f1f3c8d` (2026-11-16)
**Commit Message**: fix: use dedicated buffer for control commands

* Use a dedicated control buffer for at commands to prevent them from
being blocked by unreleased data buffers.
* Add a lock to ensure only a single ongoing at command at a time.
* Make number of ipc tx buffers configurable using cargo features.

**File**: `embassy-net-nrf91/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - changed: add `keep_open` config option to keep sockets open across PDN loss/reattach.
 - changed: link state follows the PDN deactivated/activated socket status notifications rather than polling attach.
 - fixed: reopen the raw socket when the modem closes it, instead of polling for a detach.
+- changed: select the number of IP TX buffers with the `tx-buf-count-4` or `tx-buf-count-8` feature (exactly one is required).
+- fixed: AT commands and socket requests use a dedicated TX buffer, so they are not blocked when IP packets hold all TX buffers.
+- fixed: only one AT command runs at a time.
 
 ## 0.2.0 - 2026-03-10
 
```

**File**: `embassy-net-nrf91/Cargo.toml` (modified, +7/-3)
```diff
@@ -14,6 +14,10 @@ publish = true
 defmt = ["dep:defmt", "heapless/defmt", "embassy-time/defmt"]
 log = ["dep:log"]
 
+## Number of IP TX buffers. Select exactly one.
+tx-buf-count-4 = []
+tx-buf-count-8 = []
+
 [dependencies]
 defmt = { version = "1.0.1", optional = true }
 log = { version = "0.4.14", optional = true }
@@ -31,14 +35,14 @@ at-commands = "0.5.4"
 
 [package.metadata.embassy]
 build = [
-    {target = "thumbv7em-none-eabi", features = ["defmt", "nrf-pac/nrf9160"]}
+    {target = "thumbv7em-none-eabi", features = ["defmt", "nrf-pac/nrf9160", "tx-buf-count-4"]}
 ]
 
 [package.metadata.embassy_docs]
 src_base = "https://github.com/embassy-rs/embassy/blob/embassy-net-nrf91-v$VERSION/embassy-net-nrf91/src/"
 src_base_git = "https://github.com/embassy-rs/embassy/blob/$COMMIT/embassy-net-nrf91/src/"
 target = "thumbv7em-none-eabi"
-features = ["defmt", "nrf-pac/nrf9160"]
+features = ["defmt", "nrf-pac/nrf9160", "tx-buf-count-4"]
 
 [package.metadata.docs.rs]
-features = ["defmt", "nrf-pac/nrf9160"]
+features = ["defmt", "nrf-pac/nrf9160", "tx-buf-count-4"]
```

**File**: `embassy-net-nrf91/src/lib.rs` (modified, +190/-12)
```diff
@@ -21,6 +21,7 @@ use core::task::{Poll, Waker};
 use cortex_m::peripheral::NVIC;
 use embassy_net_driver_channel as ch;
 use embassy_sync::blocking_mutex::raw::NoopRawMutex;
+use embassy_sync::mutex::Mutex;
 use embassy_sync::pipe;
 use embassy_sync::waitqueue::{AtomicWaker, WakerRegistration};
 use heapless::Vec;
@@ -230,6 +231,7 @@ async fn new_internal<'a>(
 
         tx_seq_no: 0,
         tx_buf_used: [false; TX_BUF_COUNT],
+        ctrl_buf_used: [false; CTRL_BUF_COUNT],
         tx_waker: WakerRegistration::new(),
 
         trace_chans: Vec::new(),
@@ -245,6 +247,7 @@ async fn new_internal<'a>(
     let control = Control {
         state: state_inner,
         state_ch,
+        at_lock: &state.at_lock,
     };
 
     let (trace_reader, trace_writer) = if let Some(trace) = trace_buffer {
@@ -287,6 +290,7 @@ impl TraceBuffer {
 pub struct State {
     ch: ch::State<4, 4>,
     inner: MaybeUninit<RefCell<StateInner>>,
+    at_lock: Mutex<NoopRawMutex, ()>,
 }
 
 impl State {
@@ -295,12 +299,31 @@ impl State {
         Self {
             ch: ch::State::new(),
             inner: MaybeUninit::uninit(),
+            at_lock: Mutex::new(()),
         }
     }
 }
 
+#[cfg(all(feature = "tx-buf-count-4", feature = "tx-buf-count-8"))]
+compile_error!("Select only one of the features `tx-buf-count-4` and `tx-buf-count-8`.");
+#[cfg(not(any(feature = "tx-buf-count-4", feature = "tx-buf-count-8")))]
+compile_error!("Select one of the features `tx-buf-count-4` or `tx-buf-count-8`.");
+
+#[cfg(feature = "tx-buf-count-4")]
 const TX_BUF_COUNT: usize = 4;
+#[cfg(not(feature = "tx-buf-count-4"))]
+const TX_BUF_COUNT: usize = 8;
 const TX_BUF_SIZE: usize = 1500;
+/// The modem can hold a control buffer after the response, until it gets the next message.
+const CTRL_BUF_COUNT: usize = 2;
+
+/// Control requests use dedicated buffers, so full IP buffers cannot block them.
+#[derive(Copy, Clone, PartialEq, Eq, Debug)]
+#[cfg_attr(feature = "defmt", derive(defmt::Format))]
+enum TxKind {
+    Ip,
+    Control,
+}
 
 struct TraceChannelInfo {
     ptr: *mut TraceChannel,
@@ -318,7 +341,10 @@ struct PendingRequest {
 
 #[derive(Copy, Clone, PartialEq, Eq, Debug)]
 #[cfg_attr(feature = "defmt", derive(defmt::Format))]
-struct NoFreeBufs;
+enum NoFreeBufs {
+    TxBuf,
+    MsgSlot,
+}
 
 struct StateInner {
     init: bool,
@@ -343,6 +369,7 @@ struct StateInner {
 
     tx_seq_no: u16,
     tx_buf_used: [bool; TX_BUF_COUNT],
+    ctrl_buf_used: [bool; CTRL_BUF_COUNT],
     tx_waker: WakerRegistration,
 
     trace_chans: Vec<TraceChannelInfo, TRACE_CHANNEL_COUNT>,
@@ -544,26 +571,38 @@ impl StateInner {
         return None;
     }
 
-    fn send_message(&mut self, msg: &mut Message, data: &[u8]) -> Result<(), NoFreeBufs> {
+    fn alloc_tx_buf(&mut self, kind: TxKind) -> Option<*mut u8> {
+        match kind {
+            TxKind::Ip => {
+                let idx = self.find_free_tx_buf()?;
+                self.tx_buf_used[idx] = true;
+                Some(unsafe { addr_of_mut!((*self.cb).tx_bufs[idx]) } as *mut u8)
+            }
+            TxKind::Control => {
+                let idx = self.ctrl_buf_used.iter().position(|&u| !u)?;
+                self.ctrl_buf_used[idx] = true;
+                Some(unsafe { addr_of_mut!((*self.cb).ctrl_bufs[idx]) } as *mut u8)
+            }
+        }
+    }
+
+    fn send_message(&mut self, msg: &mut Message, data: &[u8], kind: TxKind) -> Result<(), NoFreeBufs> {
         if data.is_empty() {
             msg.data = ptr::null_mut();
             msg.data_len = 0;
             self.send_message_raw(msg)
         } else {
             assert!(data.len() <= TX_BUF_SIZE);
-            let buf_idx = self.find_free_tx_buf().ok_or(NoFreeBufs)?;
-            let buf = unsafe { addr_of_mut!((*self.cb).tx_bufs[buf_idx]) } as *mut u8;
+            let buf = self.alloc_tx_buf(kind).ok_or(NoFreeBufs::TxBuf)?;
             unsafe { copy_nonoverlapping(data.as_ptr(), buf, data.len()) }
             msg.data = buf;
             msg.data_len = data.len();
-            self.tx_buf_used[buf_idx] = true;
 
             fence(Ordering::SeqCst); // synchronize copy_nonoverlapping (non-volatile) with volatile writes below.
             if let Err(e) = self.send_message_raw(msg) {
                 msg.data = ptr::null_mut();
                 msg.data_len = 0;
-                self.tx_buf_used[buf_idx] = false;
-                self.tx_waker.wake();
+                self.handle_control_free(buf);
                 Err(e)
             } else {
                 Ok(())
@@ -579,7 +618,7 @@ impl StateInner {
         };
 
         // allocate a msg.
-        let idx = self.find_free_message(ch).ok_or(NoFreeBufs)?;
+        let idx = self.find_free_message(ch).ok_or(NoFreeBufs::MsgSlot)?;
 
         debug!("tx seq {} msg: {:?}", self.tx_seq_no, msg);
 
@@ -604,6 +643,21 @@ impl StateInner {
     }
 
     fn handle_control_free(&mut self, ptr: *mut u8) {
+        for idx in 0..CTRL_BUF_COUNT {
+            if
```

**File**: `examples/nrf9160/Cargo.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ publish = false
 embassy-executor = { version = "0.10.0", path = "../../embassy-executor", features = ["platform-cortex-m", "executor-thread", "executor-interrupt", "defmt"] }
 embassy-time = { version = "0.5.1", path = "../../embassy-time", features = ["defmt", "defmt-timestamp-uptime"] }
 embassy-nrf = { version = "0.11.0", path = "../../embassy-nrf", features = ["defmt", "nrf9160-s", "time-driver-rtc1", "unstable-pac", "time"] }
-embassy-net-nrf91 = { version = "0.2.0", path = "../../embassy-net-nrf91", features = ["defmt"] }
+embassy-net-nrf91 = { version = "0.2.0", path = "../../embassy-net-nrf91", features = ["defmt", "tx-buf-count-4"] }
 embassy-net = { version = "0.9.1", path = "../../embassy-net", features = ["defmt", "tcp", "ipv4", "medium-ip", "icmp-ping-reply"] }
 
 defmt = "1.0.1"
```

#### Recent Merged Pull Requests:
- **PR #7589** (2026-11-18): stm32/rcc: use shared backup domain code for G5 (@Dirbaio)
- **PR #7584** (2026-11-18): stm32/low-power: build for more chips, restore clocks in all chips, misc fixes (@Dirbaio)
- **PR #7583** (2026-11-18): fix: use dedicated buffer for control commands (@lulf)
- **PR #7580** (2026-11-18): nrf/uart: fix buffered uart hanging if irqs are delayed (@Dirbaio)
- **PR #7577** (2026-11-18): G5 (@xoviat)
- **PR #7575** (2026-11-18): usb(synopsys-otg): abort an IN transfer cancelled before its FIFO is filled (@leftger)

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

## X. stm32: fix LPTIM time driver and low-power builds, make the LPTIM clock explicit

**RULE**:
When implementing operations in `embassy-stm32/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6bd3541f`: stm32: fix LPTIM time driver and low-power builds, make the LPTIM clock explicit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- fix: stm32/rcc f2, f4, f7, g0, g4, h5, h7: report the LSE and LSI frequencies, so peripherals can use them as kernel clock
- fix: stm32/rcc u3: `LseConfig::peripherals_clocked` sets `LSESYSEN`; it was ignored
- fix: stm32/time-driver-lptim: build on chips with LPTIM v1, v1a or v1b (F4, F7, G0, G4, H7, L0, L4, L4+, WB), which have no update event; the counter overflow is counted on `ARRM`
- fix: stm32/time-driver-lptim: build on C5, H5, L5, U0 and U3; `time-driver-lptim3` on U5 and U3 uses the shared LPTIM3/LPTIM4 kernel clock mux
- change: stm32/time-driver-lptim: `init` no longer changes `config.rcc`. The LPTIM kernel clock must be selected in `config.rcc.mux` and enabled in `config.rcc` (LSE with `peripherals_clocked: true` on L5, U0, U3, U5, WBA and WL); the reset value is no longer switched to LSI, and LSI and HSI are no longer enabled (breaking change).
- change: stm32/time-driver-lptim: panic at `init` if the LPTIM kernel clock is LSE not routed to peripherals, or a frequency that is not 1, 2, 4, ..., 128 times the tick rate.
- change: stm32/time-driver-lptim: with `low-power`, an LPTIM kernel clock other than LSI or LSE disables Stop mode and logs a warning.
- fix: stm32/l
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6bd3541f` are properly handled with clean fallback behavior.
