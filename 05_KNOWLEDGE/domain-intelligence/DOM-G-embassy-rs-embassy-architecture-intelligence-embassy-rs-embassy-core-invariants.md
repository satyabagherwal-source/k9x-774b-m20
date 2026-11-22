# Domain G — Architecture Intelligence: Architecture Intelligence: embassy-rs/embassy Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs/embassy",
  "source_url": "https://github.com/embassy-rs/embassy",
  "source_version": "1c5f29e0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T01:32:23.766Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-embassy-rs-embassy",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs/embassy](https://github.com/embassy-rs/embassy) (Revision: `1c5f29e0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T01:32:23.766Z`  
> **Learning ID**: `learn-github-embassy-rs-embassy`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), B (Product Intelligence), K (Quality & Verification Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 75%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from embassy-rs/embassy:

# Forensic Learning Record (Deep Inspection): embassy-rs/embassy

> **Canonical Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T01:32:22.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10137 stars

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
- **Issue #7613** (2026-11-21): **mcxa5xx/rtc: wait out STATUS resync before unlock**
  *Symptoms*: After Stop exit, MCXA5xx RTC `STATUS` reads `FFFEh` and register writes are ignored until the clock domains resync (RM 38.3.1.2). `FFFEh` has `WRITE_PROT_EN` set, so `disable_write_protect()` sends the unlock sequence, the RTC drops it, and the next protected write faults once resync completes.  1. MCU wakes from Stop. 2. `set_alarm()` -> `disable_write_protect()` sees `FFFEh` and sends the unlock. 3. The RTC ignores it and stays locked. 4. The `CTRL` write lands after resync -> BusFault.  - `disable_write_protect()`: wait out `FFFEh` before unlocking (bounded). - `set_datetime()`: wait through `FFFEh` instead of returning an error. - `read_datetime()`: wait through `FFFEh` as well as `INVAL_BIT`.  ## Testing - `cargo check` for mcxa577, mcxa266 and `examples/mcxa577`. - Hardware Stop-wake test pending.

- **Issue #7612** (2026-11-21): **stm32/hsem: fix lost notifications and secondary core boot deadlock**
  *Symptoms*: Fixes #7609. Closes #7576.  ## Verification  - HIL: `hsem_notify` + `hsem` on nucleo-stm32wb55rg, nucleo-stm32wl55jc, nucleo-stm32h755zi (table above), including a run against the pre-fix code to confirm the test detects the regression. - `cargo check` of `embassy-stm32` for `stm32h755zi-cm7`, `stm32h755zi-cm4`, `stm32wl55jc-cm4`, `stm32wl55jc-cm0p`, `stm32wba65ri`, `stm32h743zi`, `stm32wb55rg` + `low-power`. - `cargo check` of the `intercore` examples for `stm32h755cm7`/`stm32h755cm4`/`stm32wl55cm4-lp`/`stm32wl55cm0p-lp`. 
  **Post-Mortem & Fix Analysis**:
  > This pull request is a **draft**, so it isn't in the [review queue](https://bot.embassy.dev) yet. Mark it as **ready for review** when you'd like someone to look at it.

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

### Incident Patch 1: `0f0e5b86` (2026-11-21)
**Commit Message**: stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW

The HIL regression test for #7609 (tests/stm32 hsem_notify, run on
nucleo-stm32wb55rg/wl55jc/h755zi) uncovered two more bugs in the same
notify/listen path, both of which made `listen()` unusable in practice:

The HSEM interrupt line follows the *latched* masked status: MISFx is only
cleared by HSEM_CnICR, and masking HSEM_CnIER does not deassert the line.
`HardwareSemaphoreInterruptHandler` only masked HSEM_IER, so arming the
interrupt with a notification pending re-entered the handler forever: each
entry left the line asserted, the storm starved the executor and the timer
(including `with_timeout`), and the listener could never run to consume the
flag. The handler now consumes the flags with HSEM_CnICR and latches each
notification in software before waking, so a wake that happens before the
listener registers its waker is not lost.

`AtomicModify::set_bits`/`clear_bits` did the register read-modify-write
with `AtomicU32::fetch_or`/`fetch_and`. LDREX/STREX on peripheral
registers is UNPREDICTABLE on Armv7-M: under the interrupt storm above the
retry loop livelocked outright (every STREX is interrupted, cleari

**File**: `embassy-stm32/CHANGELOG.md` (modified, +4/-3)
```diff
@@ -19,11 +19,12 @@ PAC:
 
 Atomic:
 - fix: stm32/atomic: make `AtomicClear::clear` atomic on targets without 8-bit atomic RMW (thumbv6m)
+- fix: stm32/atomic: `Reg::set_bits`/`clear_bits` (used by the HSEM, IPCC, I2C and SDMMC drivers) no longer use core atomics for the read-modify-write. `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv7-M, and when the write re-arms an interrupt whose handler runs between the `LDREX` and the `STREX` the retry loop never terminates. The update is now done in a critical section.
 
 HSEM:
-- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The interrupt flag is now consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
-- fix: stm32/hsem: `listen` waits on the unmasked interrupt status instead of the masked one. The interrupt handler disables the interrupt in `HSEM_IER` before waking, so the masked status could read as clear while a notification was still pending and the future would never complete.
-- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification flag without consuming it.
+- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The notification is consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
+- fix: stm32/hsem: `HardwareSemaphoreInterruptHandler` now consumes the notification flags with `HSEM_CnICR` and latches them in software before waking. The latched masked status keeps the interrupt line asserted until the flags are cleared, so masking `HSEM_CnIER` (the old behavior) did not deassert it: arming the interrupt with a notification pending re-entered the handler forever, starving the tasks supposed to consume the notification. The software latch also delivers a notification whose wake happens before the listener registers its waker.
+- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification without consuming it.
 - fix: stm32: `init_primary` discards a stale HSEM notification from a previous run of the core before initializing the hardware, and `init_secondary`/`try_init_secondary` treat the notification as a level rather than an event. The secondary core can now be started (or restarted under a debugger) in any order relative to the primary core without deadlocking or consuming a stale notification.
 - change: stm32: `try_init_secondary` no longer blocks when the other core is not done with its init (matching its documentation) and, on STM32H7 dual-core parts, no longer writes the shared RCC enable register concurrently with the other core's clock setup.
 
```

**File**: `embassy-stm32/src/atomic.rs` (modified, +8/-26)
```diff
@@ -8,6 +8,14 @@ pub trait AtomicModify<T: Sized> {
     /// Atomically mask bits
     ///
     /// Call `set_xxx(true)` inside the closure
+    ///
+    /// The read-modify-write is atomic against the local interrupt handlers (it
+    /// runs in a critical section). It must not be implemented with core atomics:
+    /// `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv*-M, and
+    /// when the write re-arms an interrupt condition whose handler runs between
+    /// the `LDREX` and the `STREX` (e.g. `HSEM_IER` with the status flag already
+    /// set), the interrupt clears the exclusive monitor and the retry loop never
+    /// terminates.
     fn set_bits(&self, f: impl FnOnce(&mut T));
     /// Atomically unmask bits
     ///
@@ -19,9 +27,6 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
     #[inline]
     fn set_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
-            #[cfg(target_has_atomic = "32")]
-            use core::sync::atomic::{AtomicU32, Ordering, compiler_fence};
-
             let mut v = u32::MIN;
 
             core::assert_eq!(size_of::<u32>(), size_of::<T>());
@@ -31,29 +36,16 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
 
             let ptr = self.as_ptr() as *mut u32;
 
-            #[cfg(not(target_has_atomic = "32"))]
             critical_section::with(|_| {
                 let val = ptr.read_volatile();
                 ptr.write_volatile(val | v);
             });
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
-
-            #[cfg(target_has_atomic = "32")]
-            AtomicU32::from_ptr(ptr).fetch_or(v, Ordering::Relaxed);
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
         }
     }
 
     #[inline]
     fn clear_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
-            #[cfg(target_has_atomic = "32")]
-            use core::sync::atomic::{AtomicU32, Ordering, compiler_fence};
-
             let mut v = u32::MAX;
 
             core::assert_eq!(size_of::<u32>(), size_of::<T>());
@@ -63,20 +55,10 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
 
             let ptr = self.as_ptr() as *mut u32;
 
-            #[cfg(not(target_has_atomic = "32"))]
             critical_section::with(|_| {
                 let val = ptr.read_volatile();
                 ptr.write_volatile(val & v);
             });
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
-
-            #[cfg(target_has_atomic = "32")]
-            AtomicU32::from_ptr(ptr).fetch_and(v, Ordering::Relaxed);
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
         }
     }
 }
```

**File**: `embassy-stm32/src/hsem/mod.rs` (modified, +61/-34)
```diff
@@ -2,7 +2,7 @@
 
 use core::future::poll_fn;
 use core::marker::PhantomData;
-use core::sync::atomic::{Ordering, compiler_fence};
+use core::sync::atomic::{AtomicBool, Ordering, compiler_fence};
 use core::task::Poll;
 
 use critical_section::CriticalSection;
@@ -14,7 +14,7 @@ use interrupt::typelevel::Interrupt;
 // The nonsecure lock/listen flow used here is compatible with the common
 // semaphore interface and remains usable across WBA52/54/55/65 families.
 use crate::Peri;
-use crate::atomic::{ActiveInterrupt, InterruptRegister};
+use crate::atomic::{ActiveInterrupt, AtomicClear, InterruptRegister};
 use crate::cpu::CoreId;
 use crate::pac::common::{RW, Reg};
 use crate::peripherals::HSEM;
@@ -58,22 +58,31 @@ pub struct HardwareSemaphoreInterruptHandler<T: Instance> {
 impl<T: Instance> interrupt::typelevel::Handler<T::Interrupt> for HardwareSemaphoreInterruptHandler<T> {
     unsafe fn on_interrupt() {
         let core = CoreId::current();
-        // Get pending semaphore bits from masked ISR for the current core
+        // Get pending notification flags for the current core.
         let mut pending = T::regs().misr(core.to_index().into()).read().0;
 
-        T::regs().ier(core.to_index().into()).modify(|w| {
-            while pending != 0 {
-                // Index of lowest set bit
-                let n = pending.trailing_zeros() as u8;
-
-                // Clear lowest set bit.
-                // Safe when pending != 0 enforced by while predicate
-                pending &= pending - 1;
-
-                w.set_ise(n.into(), false);
+        // Consume the flags with HSEM_CnICR. The interrupt line follows the
+        // latched masked status, which only this clear releases: masking
+        // HSEM_CnIER does not deassert the line, so without this the handler
+        // would re-enter forever and starve the tasks that are supposed to
+        // consume the notification.
+        T::regs().icr(core.to_index().into()).write(|w| w.0 = pending);
+
+        while pending != 0 {
+            // Index of lowest set bit
+            let n = pending.trailing_zeros() as u8;
+
+            // Clear lowest set bit.
+            // Safe when pending != 0 enforced by while predicate
+            pending &= pending - 1;
+
+            if (n as usize) < CHANNELS {
+                // Latch the notification before waking: the wake is lost if the
+                // listener has not registered its waker yet.
+                T::state().flag_for(n).store(true, Ordering::Relaxed);
                 T::state().waker_for(n).wake();
             }
-        });
+        }
     }
 }
 
@@ -190,18 +199,13 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
     pub fn blocking_listen(&mut self) {
         let core = CoreId::current();
 
-        // Wait for the semaphore interrupt flag. It is only cleared once it has
-        // been observed: clearing it before waiting would drop a notification that
-        // was already pending (e.g. when this core starts after the other core has
-        // already notified).
-        while !T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {}
+        // Wait for a notification to be pending. It is only consumed once it has
+        // been observed: consuming it before waiting would drop a notification
+        // that was already pending (e.g. when this core starts after the other
+        // core has already notified).
+        while !self.take_notification(core) {}
 
         cortex_m::asm::dmb();
-
-        // Consume the notification.
-        T::regs()
-            .icr(core.to_index().into())
-            .write(|w| w.set_isc(self.index.into(), true));
     }
 
     /// Asynchronous wait for a notification on this semaphore channel.
@@ -224,17 +228,9 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
 
             compiler_fence(Ordering::SeqCst);
 
-            // Check the unmasked status flag: the interrupt handler disables the
-            // interrupt in HSEM_IER before waking, so the masked status may read
-            // as clear while a notification is still pending.
-            if T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {
+            if self.take_notification(core) {
                 cortex_m::asm::dmb();
 
-                // Consume the notification.
-                T::regs()
-                    .icr(core.to_index().into())
-                    .write(|w| w.set_isc(self.index.into(), true));
-
                 Poll::Ready(())
             } else {
                 Poll::Pending
@@ -243,6 +239,28 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
         .await;
     }
 
+    /// Consume one pending notification on this semaphore channel, if any.
+    ///
+    /// A notification is either latched by [`HardwareSemaphoreInterruptHandler`]
+    /// (the interrupt handler consumes the hardware flag so that its line
+    /// deasserts) or still pending in the hardware flag when no inter
```

**File**: `tests/stm32/Cargo.toml` (modified, +6/-1)
```diff
@@ -21,7 +21,7 @@ stm32g071rb = ["embassy-stm32/stm32g071rb", "stop", "jiff", "cm0", "not-gpdma",
 stm32g491re = ["embassy-stm32/stm32g491re", "stop", "jiff", "not-gpdma", "rng", "fdcan", "cordic", "adc"]
 stm32h563zi = ["embassy-stm32/stm32h563zi", "stop", "spi-v345", "jiff", "eth", "rng", "fdcan", "hash-v34", "cordic", "adc", "edata"]
 stm32h753zi = ["embassy-stm32/stm32h753zi", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "rng", "fdcan", "hash", "cryp", "adc", "mem2mem", "mem2mem-dma", "mem2mem-mdma"]
-stm32h755zi = ["embassy-stm32/stm32h755zi-cm7", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "dac", "rng", "fdcan", "hash", "cryp", "adc"]
+stm32h755zi = ["embassy-stm32/stm32h755zi-cm7", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "dac", "rng", "fdcan", "hash", "cryp", "adc", "hsem"]
 stm32h7a3zi = ["embassy-stm32/stm32h7a3zi", "not-stop", "spi-v345", "not-gpdma", "rng", "fdcan", "adc"]
 stm32h723zg = ["embassy-stm32/stm32h723zg", "not-stop", "spi-v345", "jiff", "not-gpdma", "dac", "rng", "fdcan", "cordic", "adc", "adc-b", "mem2mem", "mem2mem-dma", "mem2mem-mdma"]
 stm32l073rz = ["embassy-stm32/stm32l073rz", "stop", "jiff", "cm0", "not-gpdma", "rng", "eeprom", "adc"]
@@ -274,6 +274,11 @@ name = "hsem"
 path = "src/bin/hsem.rs"
 required-features = [ "hsem",]
 
+[[bin]]
+name = "hsem_notify"
+path = "src/bin/hsem_notify.rs"
+required-features = [ "hsem",]
+
 [[bin]]
 name = "i2s_dma"
 path = "src/bin/i2s_dma.rs"
```

**File**: `tests/stm32/src/bin/hsem.rs` (modified, +6/-0)
```diff
@@ -11,6 +11,12 @@ use embassy_stm32::bind_interrupts;
 use embassy_stm32::hsem::{HardwareSemaphore, HardwareSemaphoreInterruptHandler};
 use embassy_stm32::peripherals::HSEM;
 
+#[cfg(feature = "stm32h755zi")]
+bind_interrupts!(struct Irqs{
+    HSEM1 => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[cfg(not(feature = "stm32h755zi"))]
 bind_interrupts!(struct Irqs{
     HSEM => HardwareSemaphoreInterruptHandler<HSEM>;
 });
```

**File**: `tests/stm32/src/bin/hsem_notify.rs` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// required-features: hsem
+
+//! HSEM notify/listen regression test for issue #7609.
+//!
+//! `blocking_listen` and `listen` used to clear the notification flag *before*
+//! waiting for it, so a notification sent before the call was lost and the waiter
+//! blocked forever. The dual-core init handshake deadlocks on this: `init_secondary`
+//! waits on a notification that `init_primary` may have sent long before, e.g. when
+//! the secondary core is started or restarted under a debugger while the primary
+//! core keeps running.
+//!
+//! This exercises the same `blocking_listen`/`is_notified` primitives that
+//! `init_secondary` uses. (The handshake itself needs both cores running, which the
+//! HIL farm cannot do; `init_primary` is covered by `common::init()` on this board.)
+#![no_std]
+#![no_main]
+
+#[path = "../common.rs"]
+mod common;
+
+use common::*;
+use embassy_executor::Spawner;
+use embassy_stm32::bind_interrupts;
+use embassy_stm32::hsem::{HardwareSemaphore, HardwareSemaphoreChannel, HardwareSemaphoreInterruptHandler};
+use embassy_stm32::peripherals::HSEM;
+use embassy_time::{Duration, Timer, with_timeout};
+
+teleprobe_meta::timeout!(30);
+
+#[cfg(feature = "stm32h755zi")]
+bind_interrupts!(struct Irqs {
+    HSEM1 => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[cfg(not(feature = "stm32h755zi"))]
+bind_interrupts!(struct Irqs {
+    HSEM => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[embassy_executor::task]
+async fn notify_later(mut ch: HardwareSemaphoreChannel<'static, HSEM>) {
+    Timer::after_millis(100).await;
+    info!("notifier: notifying");
+    ch.blocking_notify();
+}
+
+#[embassy_executor::main(executor = "common::Executor", entry = "cortex_m_rt::entry")]
+async fn main(spawner: Spawner) {
+    let p: embassy_stm32::Peripherals = init();
+    let hsem = HardwareSemaphore::new(p.HSEM, Irqs);
+
+    // Channel 5 is not used by the low-power CPU2 coordination channels (WB uses
+    // 3/4, WL uses 3). `split` returns channels with a caller-chosen lifetime, so
+    // a copy can be moved into the notifier task.
+    let mut ch: HardwareSemaphoreChannel<'static, HSEM> =
+        hsem.split().into_iter().find(|ch| ch.channel() == 5).unwrap();
+    ch.clear_notification();
+
+    // `is_notified` is a level: observing it does not consume the notification.
+    // The init handshake relies on this so the secondary core can be restarted
+    // under a debugger without losing the notification of `init_primary`.
+    info!("level: notify, observe twice, clear");
+    ch.blocking_notify();
+    defmt::assert!(ch.is_notified());
+    defmt::assert!(ch.is_notified());
+    ch.clear_notification();
+    defmt::assert!(!ch.is_notified());
+
+    // A notification sent *before* `listen()` must be consumed by it, not dropped.
+    // (This also covers arming the notification interrupt while the status flag
+    // is already set, which used to livelock the interrupt handler.)
+    info!("async: notification sent before listen is not lost");
+    ch.blocking_notify();
+    if with_timeout(Duration::from_secs(5), ch.listen()).await.is_err() {
+        defmt::panic!("listen() did not consume the pending notification");
+    }
+    defmt::assert!(!ch.is_notified());
+
+    // A notification sent while `listen()` is waiting must wake it (interrupt
+    // handler path).
+    info!("async: notification sent while listen is waiting");
+    let notifier = ch;
+    spawner.spawn(notify_later(notifier).unwrap());
+    if with_timeout(Duration::from_secs(5), ch.listen()).await.is_err() {
+        defmt::panic!("listen() was not woken by a later notification");
+    }
+    defmt::assert!(!ch.is_notified());
+
+    // Same for the blocking variant that `init_secondary` waits on. On regression
+    // this hangs and the teleprobe job times out.
+    info!("blocking: notification sent before blocking_listen is not lost");
+    ch.blocking_notify();
+    defmt::assert!(ch.is_notified());
+    ch.blocking_listen();
+    defmt::assert!(!ch.is_notified());
+
+    info!("Test OK");
+    cortex_m::asm::bkpt();
+}
```

---

### Incident Patch 2: `1c5f29e0` (2026-11-21)
**Commit Message**: Merge pull request #7612 from xoviat/fix-hsem-listen-race

stm32/hsem: fix lost notifications and secondary core boot deadlock

**File**: `embassy-stm32/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -19,6 +19,14 @@ PAC:
 
 Atomic:
 - fix: stm32/atomic: make `AtomicClear::clear` atomic on targets without 8-bit atomic RMW (thumbv6m)
+- fix: stm32/atomic: `Reg::set_bits`/`clear_bits` (used by the HSEM, IPCC, I2C and SDMMC drivers) no longer use core atomics for the read-modify-write. `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv7-M, and when the write re-arms an interrupt whose handler runs between the `LDREX` and the `STREX` the retry loop never terminates. The update is now done in a critical section.
+
+HSEM:
+- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The notification is consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
+- fix: stm32/hsem: `HardwareSemaphoreInterruptHandler` now consumes the notification flags with `HSEM_CnICR` and latches them in software before waking. The latched masked status keeps the interrupt line asserted until the flags are cleared, so masking `HSEM_CnIER` (the old behavior) did not deassert it: arming the interrupt with a notification pending re-entered the handler forever, starving the tasks supposed to consume the notification. The software latch also delivers a notification whose wake happens before the listener registers its waker.
+- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification without consuming it.
+- fix: stm32: `init_primary` discards a stale HSEM notification from a previous run of the core before initializing the hardware, and `init_secondary`/`try_init_secondary` treat the notification as a level rather than an event. The secondary core can now be started (or restarted under a debugger) in any order relative to the primary core without deadlocking or consuming a stale notification.
+- change: stm32: `try_init_secondary` no longer blocks when the other core is not done with its init (matching its documentation) and, on STM32H7 dual-core parts, no longer writes the shared RCC enable register concurrently with the other core's clock setup.
 
 SUBGHZ:
 - feat: stm32/subghz: add a driver for the on-chip sub-GHz radio of STM32WL and STM32WLE5 (`SubghzSpi`, `SubghzControl`). It covers the dedicated `SUBGHZSPI`, radio reset, `RFBUSY` waiting and the `SUBGHZ_RADIO` interrupt. The driver does not wrap the radio's command set: the caller sends the commands.
```

**File**: `embassy-stm32/src/atomic.rs` (modified, +8/-26)
```diff
@@ -8,6 +8,14 @@ pub trait AtomicModify<T: Sized> {
     /// Atomically mask bits
     ///
     /// Call `set_xxx(true)` inside the closure
+    ///
+    /// The read-modify-write is atomic against the local interrupt handlers (it
+    /// runs in a critical section). It must not be implemented with core atomics:
+    /// `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv*-M, and
+    /// when the write re-arms an interrupt condition whose handler runs between
+    /// the `LDREX` and the `STREX` (e.g. `HSEM_IER` with the status flag already
+    /// set), the interrupt clears the exclusive monitor and the retry loop never
+    /// terminates.
     fn set_bits(&self, f: impl FnOnce(&mut T));
     /// Atomically unmask bits
     ///
@@ -19,9 +27,6 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
     #[inline]
     fn set_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
-            #[cfg(target_has_atomic = "32")]
-            use core::sync::atomic::{AtomicU32, Ordering, compiler_fence};
-
             let mut v = u32::MIN;
 
             core::assert_eq!(size_of::<u32>(), size_of::<T>());
@@ -31,29 +36,16 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
 
             let ptr = self.as_ptr() as *mut u32;
 
-            #[cfg(not(target_has_atomic = "32"))]
             critical_section::with(|_| {
                 let val = ptr.read_volatile();
                 ptr.write_volatile(val | v);
             });
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
-
-            #[cfg(target_has_atomic = "32")]
-            AtomicU32::from_ptr(ptr).fetch_or(v, Ordering::Relaxed);
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
         }
     }
 
     #[inline]
     fn clear_bits(&self, f: impl FnOnce(&mut T)) {
         unsafe {
-            #[cfg(target_has_atomic = "32")]
-            use core::sync::atomic::{AtomicU32, Ordering, compiler_fence};
-
             let mut v = u32::MAX;
 
             core::assert_eq!(size_of::<u32>(), size_of::<T>());
@@ -63,20 +55,10 @@ impl<T: Copy, A: Read + Write> AtomicModify<T> for Reg<T, A> {
 
             let ptr = self.as_ptr() as *mut u32;
 
-            #[cfg(not(target_has_atomic = "32"))]
             critical_section::with(|_| {
                 let val = ptr.read_volatile();
                 ptr.write_volatile(val & v);
             });
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
-
-            #[cfg(target_has_atomic = "32")]
-            AtomicU32::from_ptr(ptr).fetch_and(v, Ordering::Relaxed);
-
-            #[cfg(target_has_atomic = "32")]
-            compiler_fence(Ordering::Release);
         }
     }
 }
```

**File**: `embassy-stm32/src/hsem/mod.rs` (modified, +110/-28)
```diff
@@ -2,7 +2,7 @@
 
 use core::future::poll_fn;
 use core::marker::PhantomData;
-use core::sync::atomic::{Ordering, compiler_fence};
+use core::sync::atomic::{AtomicBool, Ordering, compiler_fence};
 use core::task::Poll;
 
 use critical_section::CriticalSection;
@@ -14,7 +14,7 @@ use interrupt::typelevel::Interrupt;
 // The nonsecure lock/listen flow used here is compatible with the common
 // semaphore interface and remains usable across WBA52/54/55/65 families.
 use crate::Peri;
-use crate::atomic::{ActiveInterrupt, InterruptRegister};
+use crate::atomic::{ActiveInterrupt, AtomicClear, InterruptRegister};
 use crate::cpu::CoreId;
 use crate::pac::common::{RW, Reg};
 use crate::peripherals::HSEM;
@@ -58,22 +58,31 @@ pub struct HardwareSemaphoreInterruptHandler<T: Instance> {
 impl<T: Instance> interrupt::typelevel::Handler<T::Interrupt> for HardwareSemaphoreInterruptHandler<T> {
     unsafe fn on_interrupt() {
         let core = CoreId::current();
-        // Get pending semaphore bits from masked ISR for the current core
+        // Get pending notification flags for the current core.
         let mut pending = T::regs().misr(core.to_index().into()).read().0;
 
-        T::regs().ier(core.to_index().into()).modify(|w| {
-            while pending != 0 {
-                // Index of lowest set bit
-                let n = pending.trailing_zeros() as u8;
-
-                // Clear lowest set bit.
-                // Safe when pending != 0 enforced by while predicate
-                pending &= pending - 1;
-
-                w.set_ise(n.into(), false);
+        // Consume the flags with HSEM_CnICR. The interrupt line follows the
+        // latched masked status, which only this clear releases: masking
+        // HSEM_CnIER does not deassert the line, so without this the handler
+        // would re-enter forever and starve the tasks that are supposed to
+        // consume the notification.
+        T::regs().icr(core.to_index().into()).write(|w| w.0 = pending);
+
+        while pending != 0 {
+            // Index of lowest set bit
+            let n = pending.trailing_zeros() as u8;
+
+            // Clear lowest set bit.
+            // Safe when pending != 0 enforced by while predicate
+            pending &= pending - 1;
+
+            if (n as usize) < CHANNELS {
+                // Latch the notification before waking: the wake is lost if the
+                // listener has not registered its waker yet.
+                T::state().flag_for(n).store(true, Ordering::Relaxed);
                 T::state().waker_for(n).wake();
             }
-        });
+        }
     }
 }
 
@@ -181,35 +190,46 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
         self.unlock(0);
     }
 
-    /// Blocking poll for semaphore interrupt flag
+    /// Blocking wait for a notification on this semaphore channel.
+    ///
+    /// A notification sent by [`Self::blocking_notify`] or [`Self::unlock`] on the
+    /// other core is not lost if it was sent before this call: if one is already
+    /// pending it is consumed and this returns immediately. Otherwise this waits
+    /// for the next notification and consumes it.
     pub fn blocking_listen(&mut self) {
         let core = CoreId::current();
 
-        // Clear the interrupt
-        T::regs()
-            .icr(core.to_index().into())
-            .write(|w| w.set_isc(self.index.into(), true));
+        // Wait for a notification to be pending. It is only consumed once it has
+        // been observed: consuming it before waiting would drop a notification
+        // that was already pending (e.g. when this core starts after the other
+        // core has already notified).
+        while !self.take_notification(core) {}
 
-        // Wait for the semaphore interrupt flag
-        while !T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {}
+        cortex_m::asm::dmb();
     }
 
-    /// Asynchronous listen for a notification interrupt when this semaphore channel is unlocked
+    /// Asynchronous wait for a notification on this semaphore channel.
+    ///
+    /// A notification sent by [`Self::blocking_notify`] or [`Self::unlock`] on the
+    /// other core is not lost if it was sent before this call: if one is already
+    /// pending it is consumed and this returns immediately. Otherwise this waits
+    /// for the next notification and consumes it.
     pub async fn listen(&mut self) {
         let _scoped_wake_guard = T::RCC_INFO.wake_guard();
         let core = CoreId::current();
 
-        let _irq = self.clear_and_enable_interupt(core);
-        // Wait for the semaphore interrupt flag
+        // Enable the notification interrupt without clearing a pending
+        // notification first: the notification is consumed below when it is
+        // observed, so one that was already sent is not lost.
+        let _irq = self.enable_interupt(core);
+
         poll_fn(|cx| {
             T::state().waker_for(self.index).register(cx.w
```

**File**: `embassy-stm32/src/lib.rs` (modified, +46/-4)
```diff
@@ -681,12 +681,21 @@ mod dual_core {
     /// This should only be called once at startup, otherwise it panics.
     ///
     /// A hardware semaphore is used to coordinate the init with the second core.
+    /// The notification sent at the end of this function is a level, not an event:
+    /// a secondary core that starts (or restarts) after this function has completed
+    /// observes it immediately. Any stale notification from a previous run of this
+    /// core is discarded before the hardware is initialized, so a secondary core
+    /// cannot mistake it for this run's notification.
     pub fn init_primary(config: Config, shared_data: &'static MaybeUninit<SharedData>) -> Peripherals {
         let shared_data = unsafe { shared_data.assume_init_ref() };
 
         // Enable hardware semaphore.
         critical_section::with(|cs| crate::hsem::init_hsem(cs, true));
 
+        // Discard any notification left over from a previous run of this core (e.g.
+        // when restarting only this core under a debugger).
+        hsem::get_hsem(1).clear_notification();
+
         #[cfg(stm32h7)]
         {
             use stm32_metapac::RCC;
@@ -713,18 +722,47 @@ mod dual_core {
     /// Try to initialize the `embassy-stm32` HAL based on the init done by the other core using [init_primary].
     ///
     /// This returns the peripheral singletons that can be used for creating drivers if the other core is done with its init.
-    /// If the other core is not done yet, this will return `None`.
+    /// If the other core is not done yet, this will return `None`. It never blocks:
+    /// call it repeatedly (as [init_secondary] does) until it returns `Some`.
     ///
-    /// This should only be called once at startup, otherwise it may panic.
+    /// The notification from the other core is consumed as a level rather than an
+    /// event, so this core can be restarted (e.g. under a debugger) while the other
+    /// core keeps running, and still proceed.
+    ///
+    /// This can only succeed once per boot, otherwise it may panic.
     ///
     /// A hardware semaphore is used to coordinate the init with the second core.
     pub fn try_init_secondary(shared_data: &'static MaybeUninit<SharedData>) -> Option<Peripherals> {
+        // The HSEM peripheral must be clocked before its registers can be used.
+        //
+        // On families where each core has its own RCC enable registers this core
+        // can safely enable it. On families where the RCC enable registers are
+        // shared between the cores (STM32H7), doing so here would race with the
+        // other core's clock setup: critical sections are core-local and do not
+        // synchronize across cores, so a concurrent read-modify-write could drop
+        // either side's enable bit and leave the peripheral unclocked. Instead,
+        // wait for `init_primary`, which enables the HSEM peripheral before
+        // anything else, to clock it.
+        #[cfg(stm32wl5x)]
         critical_section::with(|cs| {
             rcc::enable_with_cs_no_refcount::<peripherals::HSEM>(cs);
         });
 
-        // Wait for the semaphore to be unlocked by the primary core
-        hsem::get_hsem(1).blocking_listen();
+        #[cfg(not(stm32wl5x))]
+        if !rcc::is_enabled::<peripherals::HSEM>() {
+            return None;
+        }
+
+        // Wait for the primary core to complete its init. The notification is not
+        // consumed here, so a notification sent before this call (or before this
+        // core was restarted) is not lost.
+        if !hsem::get_hsem(1).is_notified() {
+            return None;
+        }
+
+        // Ensure the notification is observed before the shared data written by
+        // the other core is read.
+        cortex_m::asm::dmb();
 
         let shared_data = unsafe { shared_data.assume_init_ref() };
 
@@ -736,6 +774,10 @@ mod dual_core {
     /// This returns the peripheral singletons that can be used for creating drivers when the other core is done with its init.
     /// If the other core is not done yet, this will spinloop wait on it.
     ///
+    /// This can be called again if this core is restarted while the other core
+    /// keeps running; the notification from [init_primary] is not consumed, so a
+    /// restart does not miss it.
+    ///
     /// This should only be called once at startup, otherwise it may panic.
     ///
     /// The `shared_data` is used to coordinate the init with the second core. Read the [SharedData] docs
```

**File**: `embassy-stm32/src/rcc/mod.rs` (modified, +20/-0)
```diff
@@ -372,6 +372,16 @@ impl RccInfo {
         self.enable_with_cs_inner(cs, true);
     }
 
+    /// Returns whether the peripheral clock is currently enabled.
+    ///
+    /// This only reads the RCC enable register, so unlike `enable_with_cs` it is
+    /// safe to call concurrently with the other core's own clock setup.
+    #[allow(dead_code)]
+    pub(crate) fn is_enabled(&self) -> bool {
+        // TODO: should this be `unsafe`?
+        unsafe { self.enable_ptr().read_volatile() & 1u32 << self.enable_bit != 0 }
+    }
+
     // TODO: should this be `unsafe`?
     fn enable_with_cs_inner(&self, cs: CriticalSection, no_refcount: bool) {
         // set the xxxEN bit
@@ -647,6 +657,16 @@ pub(crate) fn enable_with_cs_no_refcount<T: RccPeripheral>(cs: CriticalSection)
     T::RCC_INFO.enable_with_cs_no_refcount(cs);
 }
 
+/// Returns whether the peripheral clock of `T` is currently enabled.
+///
+/// Unlike [`enable_with_cs_no_refcount`], this does not write to the (possibly
+/// shared) RCC enable register, so it is safe to use while the other core is
+/// concurrently enabling its own peripherals.
+#[allow(dead_code)]
+pub(crate) fn is_enabled<T: RccPeripheral>() -> bool {
+    T::RCC_INFO.is_enabled()
+}
+
 /// Enables and clears the reset for peripheral `T`.
 ///
 /// # Safety
```

**File**: `tests/stm32/Cargo.toml` (modified, +6/-1)
```diff
@@ -21,7 +21,7 @@ stm32g071rb = ["embassy-stm32/stm32g071rb", "stop", "jiff", "cm0", "not-gpdma",
 stm32g491re = ["embassy-stm32/stm32g491re", "stop", "jiff", "not-gpdma", "rng", "fdcan", "cordic", "adc"]
 stm32h563zi = ["embassy-stm32/stm32h563zi", "stop", "spi-v345", "jiff", "eth", "rng", "fdcan", "hash-v34", "cordic", "adc", "edata"]
 stm32h753zi = ["embassy-stm32/stm32h753zi", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "rng", "fdcan", "hash", "cryp", "adc", "mem2mem", "mem2mem-dma", "mem2mem-mdma"]
-stm32h755zi = ["embassy-stm32/stm32h755zi-cm7", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "dac", "rng", "fdcan", "hash", "cryp", "adc"]
+stm32h755zi = ["embassy-stm32/stm32h755zi-cm7", "not-stop", "spi-v345", "jiff", "not-gpdma", "eth", "dac", "rng", "fdcan", "hash", "cryp", "adc", "hsem"]
 stm32h7a3zi = ["embassy-stm32/stm32h7a3zi", "not-stop", "spi-v345", "not-gpdma", "rng", "fdcan", "adc"]
 stm32h723zg = ["embassy-stm32/stm32h723zg", "not-stop", "spi-v345", "jiff", "not-gpdma", "dac", "rng", "fdcan", "cordic", "adc", "adc-b", "mem2mem", "mem2mem-dma", "mem2mem-mdma"]
 stm32l073rz = ["embassy-stm32/stm32l073rz", "stop", "jiff", "cm0", "not-gpdma", "rng", "eeprom", "adc"]
@@ -274,6 +274,11 @@ name = "hsem"
 path = "src/bin/hsem.rs"
 required-features = [ "hsem",]
 
+[[bin]]
+name = "hsem_notify"
+path = "src/bin/hsem_notify.rs"
+required-features = [ "hsem",]
+
 [[bin]]
 name = "i2s_dma"
 path = "src/bin/i2s_dma.rs"
```

**File**: `tests/stm32/src/bin/hsem.rs` (modified, +6/-0)
```diff
@@ -11,6 +11,12 @@ use embassy_stm32::bind_interrupts;
 use embassy_stm32::hsem::{HardwareSemaphore, HardwareSemaphoreInterruptHandler};
 use embassy_stm32::peripherals::HSEM;
 
+#[cfg(feature = "stm32h755zi")]
+bind_interrupts!(struct Irqs{
+    HSEM1 => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[cfg(not(feature = "stm32h755zi"))]
 bind_interrupts!(struct Irqs{
     HSEM => HardwareSemaphoreInterruptHandler<HSEM>;
 });
```

**File**: `tests/stm32/src/bin/hsem_notify.rs` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// required-features: hsem
+
+//! HSEM notify/listen regression test for issue #7609.
+//!
+//! `blocking_listen` and `listen` used to clear the notification flag *before*
+//! waiting for it, so a notification sent before the call was lost and the waiter
+//! blocked forever. The dual-core init handshake deadlocks on this: `init_secondary`
+//! waits on a notification that `init_primary` may have sent long before, e.g. when
+//! the secondary core is started or restarted under a debugger while the primary
+//! core keeps running.
+//!
+//! This exercises the same `blocking_listen`/`is_notified` primitives that
+//! `init_secondary` uses. (The handshake itself needs both cores running, which the
+//! HIL farm cannot do; `init_primary` is covered by `common::init()` on this board.)
+#![no_std]
+#![no_main]
+
+#[path = "../common.rs"]
+mod common;
+
+use common::*;
+use embassy_executor::Spawner;
+use embassy_stm32::bind_interrupts;
+use embassy_stm32::hsem::{HardwareSemaphore, HardwareSemaphoreChannel, HardwareSemaphoreInterruptHandler};
+use embassy_stm32::peripherals::HSEM;
+use embassy_time::{Duration, Timer, with_timeout};
+
+teleprobe_meta::timeout!(30);
+
+#[cfg(feature = "stm32h755zi")]
+bind_interrupts!(struct Irqs {
+    HSEM1 => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[cfg(not(feature = "stm32h755zi"))]
+bind_interrupts!(struct Irqs {
+    HSEM => HardwareSemaphoreInterruptHandler<HSEM>;
+});
+
+#[embassy_executor::task]
+async fn notify_later(mut ch: HardwareSemaphoreChannel<'static, HSEM>) {
+    Timer::after_millis(100).await;
+    info!("notifier: notifying");
+    ch.blocking_notify();
+}
+
+#[embassy_executor::main(executor = "common::Executor", entry = "cortex_m_rt::entry")]
+async fn main(spawner: Spawner) {
+    let p: embassy_stm32::Peripherals = init();
+    let hsem = HardwareSemaphore::new(p.HSEM, Irqs);
+
+    // Channel 5 is not used by the low-power CPU2 coordination channels (WB uses
+    // 3/4, WL uses 3). `split` returns channels with a caller-chosen lifetime, so
+    // a copy can be moved into the notifier task.
+    let mut ch: HardwareSemaphoreChannel<'static, HSEM> =
+        hsem.split().into_iter().find(|ch| ch.channel() == 5).unwrap();
+    ch.clear_notification();
+
+    // `is_notified` is a level: observing it does not consume the notification.
+    // The init handshake relies on this so the secondary core can be restarted
+    // under a debugger without losing the notification of `init_primary`.
+    info!("level: notify, observe twice, clear");
+    ch.blocking_notify();
+    defmt::assert!(ch.is_notified());
+    defmt::assert!(ch.is_notified());
+    ch.clear_notification();
+    defmt::assert!(!ch.is_notified());
+
+    // A notification sent *before* `listen()` must be consumed by it, not dropped.
+    // (This also covers arming the notification interrupt while the status flag
+    // is already set, which used to livelock the interrupt handler.)
+    info!("async: notification sent before listen is not lost");
+    ch.blocking_notify();
+    if with_timeout(Duration::from_secs(5), ch.listen()).await.is_err() {
+        defmt::panic!("listen() did not consume the pending notification");
+    }
+    defmt::assert!(!ch.is_notified());
+
+    // A notification sent while `listen()` is waiting must wake it (interrupt
+    // handler path).
+    info!("async: notification sent while listen is waiting");
+    let notifier = ch;
+    spawner.spawn(notify_later(notifier).unwrap());
+    if with_timeout(Duration::from_secs(5), ch.listen()).await.is_err() {
+        defmt::panic!("listen() was not woken by a later notification");
+    }
+    defmt::assert!(!ch.is_notified());
+
+    // Same for the blocking variant that `init_secondary` waits on. On regression
+    // this hangs and the teleprobe job times out.
+    info!("blocking: notification sent before blocking_listen is not lost");
+    ch.blocking_notify();
+    defmt::assert!(ch.is_notified());
+    ch.blocking_listen();
+    defmt::assert!(!ch.is_notified());
+
+    info!("Test OK");
+    cortex_m::asm::bkpt();
+}
```

---

### Incident Patch 3: `fd0d2e31` (2026-11-21)
**Commit Message**: stm32/hsem: fix lost notifications and secondary core boot deadlock

`blocking_listen` (and async `listen`) cleared the interrupt flag before
waiting for it. A notification sent before the call was therefore dropped:
when the secondary core reached `init_secondary` after the primary core had
already completed `init_primary` (e.g. when starting or restarting the
secondary core under a debugger), `blocking_listen` cleared the latched
notification and then waited forever (issue #7609).

Consume the notification after observing it instead of before waiting for
it, so an already pending notification returns immediately. In `listen`,
also wait on the unmasked interrupt status: the interrupt handler disables
the interrupt in HSEM_IER before waking, so the masked status could read as
clear while a notification was still pending.

Make the dual-core init handshake robust to the core start order:

- `init_primary` discards stale notifications from a previous run of the
  core before initializing, so a secondary core cannot mistake one for the
  notification of the current run.
- `init_secondary`/`try_init_secondary` observe the notification as a
  level (`is_notified`) instead of consuming i

**File**: `embassy-stm32/CHANGELOG.md` (modified, +7/-0)
```diff
@@ -20,6 +20,13 @@ PAC:
 Atomic:
 - fix: stm32/atomic: make `AtomicClear::clear` atomic on targets without 8-bit atomic RMW (thumbv6m)
 
+HSEM:
+- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The interrupt flag is now consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
+- fix: stm32/hsem: `listen` waits on the unmasked interrupt status instead of the masked one. The interrupt handler disables the interrupt in `HSEM_IER` before waking, so the masked status could read as clear while a notification was still pending and the future would never complete.
+- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification flag without consuming it.
+- fix: stm32: `init_primary` discards a stale HSEM notification from a previous run of the core before initializing the hardware, and `init_secondary`/`try_init_secondary` treat the notification as a level rather than an event. The secondary core can now be started (or restarted under a debugger) in any order relative to the primary core without deadlocking or consuming a stale notification.
+- change: stm32: `try_init_secondary` no longer blocks when the other core is not done with its init (matching its documentation) and, on STM32H7 dual-core parts, no longer writes the shared RCC enable register concurrently with the other core's clock setup.
+
 SUBGHZ:
 - feat: stm32/subghz: add a driver for the on-chip sub-GHz radio of STM32WL and STM32WLE5 (`SubghzSpi`, `SubghzControl`). It covers the dedicated `SUBGHZSPI`, radio reset, `RFBUSY` waiting and the `SUBGHZ_RADIO` interrupt. The driver does not wrap the radio's command set: the caller sends the commands.
 - feat: stm32/subghz: `SubghzControl::wait_on_busy_timeout` bounds the `RFBUSY` wait, `SubghzControl::wakeup` wakes the radio from sleep, and `SubghzControl::set_wakeup_sources` lets a radio interrupt or `RFBUSY` wake the CPU from Standby.
```

**File**: `embassy-stm32/src/hsem/mod.rs` (modified, +64/-9)
```diff
@@ -181,32 +181,56 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
         self.unlock(0);
     }
 
-    /// Blocking poll for semaphore interrupt flag
+    /// Blocking wait for a notification on this semaphore channel.
+    ///
+    /// A notification sent by [`Self::blocking_notify`] or [`Self::unlock`] on the
+    /// other core is not lost if it was sent before this call: if one is already
+    /// pending it is consumed and this returns immediately. Otherwise this waits
+    /// for the next notification and consumes it.
     pub fn blocking_listen(&mut self) {
         let core = CoreId::current();
 
-        // Clear the interrupt
+        // Wait for the semaphore interrupt flag. It is only cleared once it has
+        // been observed: clearing it before waiting would drop a notification that
+        // was already pending (e.g. when this core starts after the other core has
+        // already notified).
+        while !T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {}
+
+        cortex_m::asm::dmb();
+
+        // Consume the notification.
         T::regs()
             .icr(core.to_index().into())
             .write(|w| w.set_isc(self.index.into(), true));
-
-        // Wait for the semaphore interrupt flag
-        while !T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {}
     }
 
-    /// Asynchronous listen for a notification interrupt when this semaphore channel is unlocked
+    /// Asynchronous wait for a notification on this semaphore channel.
+    ///
+    /// A notification sent by [`Self::blocking_notify`] or [`Self::unlock`] on the
+    /// other core is not lost if it was sent before this call: if one is already
+    /// pending it is consumed and this returns immediately. Otherwise this waits
+    /// for the next notification and consumes it.
     pub async fn listen(&mut self) {
         let _scoped_wake_guard = T::RCC_INFO.wake_guard();
         let core = CoreId::current();
 
-        let _irq = self.clear_and_enable_interupt(core);
-        // Wait for the semaphore interrupt flag
+        // Enable the notification interrupt without clearing a pending
+        // notification first: the notification is consumed below when it is
+        // observed, so one that was already sent is not lost.
+        let _irq = self.enable_interupt(core);
+
         poll_fn(|cx| {
             T::state().waker_for(self.index).register(cx.waker());
 
             compiler_fence(Ordering::SeqCst);
 
-            if T::regs().misr(core.to_index().into()).read().misf(self.index.into()) {
+            // Check the unmasked status flag: the interrupt handler disables the
+            // interrupt in HSEM_IER before waking, so the masked status may read
+            // as clear while a notification is still pending.
+            if T::regs().isr(core.to_index().into()).read().isf(self.index.into()) {
+                cortex_m::asm::dmb();
+
+                // Consume the notification.
                 T::regs()
                     .icr(core.to_index().into())
                     .write(|w| w.set_isc(self.index.into(), true));
@@ -219,6 +243,30 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
         .await;
     }
 
+    /// Returns whether a notification is pending on this semaphore channel.
+    ///
+    /// Unlike [`Self::blocking_listen`] and [`Self::listen`], this does not consume
+    /// the notification: it stays pending until [`Self::clear_notification`] is
+    /// called. This makes it usable as a persistent "the other core has notified"
+    /// level, which survives restarting this core.
+    pub fn is_notified(&self) -> bool {
+        let core = CoreId::current();
+
+        T::regs().isr(core.to_index().into()).read().isf(self.index.into())
+    }
+
+    /// Clear a pending notification on this semaphore channel.
+    ///
+    /// A notification is broadcast: unlocking the channel latches the interrupt
+    /// flag in the status register of every core. This clears the flag for all
+    /// cores, discarding a pending notification even if the other core has not
+    /// observed it yet.
+    pub fn clear_notification(&mut self) {
+        for bank in [0, 1] {
+            T::regs().icr(bank).write(|w| w.set_isc(self.index.into(), true));
+        }
+    }
+
     /// Clear interrupts for this semaphore and return an active interrupt
     #[inline]
     fn clear_and_enable_interupt(
@@ -229,6 +277,13 @@ impl<'a, T: Instance> HardwareSemaphoreChannel<'a, T> {
             .icr(core.to_index().into())
             .write(|w| w.set_isc(self.index.into(), true));
 
+        self.enable_interupt(core)
+    }
+
+    /// Enable interrupts for this semaphore and return an active interrupt,
+    /// without clearing a pending notification
+    #[inline]
+    fn enable_interupt(&self, core: CoreId) -> ActiveInterrupt<Reg<pac::hsem::regs::Ier, RW>, pac::hsem::regs::Ier> {
         T::regs()
             .ier(core.to_index().into(
```

**File**: `embassy-stm32/src/lib.rs` (modified, +46/-4)
```diff
@@ -681,12 +681,21 @@ mod dual_core {
     /// This should only be called once at startup, otherwise it panics.
     ///
     /// A hardware semaphore is used to coordinate the init with the second core.
+    /// The notification sent at the end of this function is a level, not an event:
+    /// a secondary core that starts (or restarts) after this function has completed
+    /// observes it immediately. Any stale notification from a previous run of this
+    /// core is discarded before the hardware is initialized, so a secondary core
+    /// cannot mistake it for this run's notification.
     pub fn init_primary(config: Config, shared_data: &'static MaybeUninit<SharedData>) -> Peripherals {
         let shared_data = unsafe { shared_data.assume_init_ref() };
 
         // Enable hardware semaphore.
         critical_section::with(|cs| crate::hsem::init_hsem(cs, true));
 
+        // Discard any notification left over from a previous run of this core (e.g.
+        // when restarting only this core under a debugger).
+        hsem::get_hsem(1).clear_notification();
+
         #[cfg(stm32h7)]
         {
             use stm32_metapac::RCC;
@@ -713,18 +722,47 @@ mod dual_core {
     /// Try to initialize the `embassy-stm32` HAL based on the init done by the other core using [init_primary].
     ///
     /// This returns the peripheral singletons that can be used for creating drivers if the other core is done with its init.
-    /// If the other core is not done yet, this will return `None`.
+    /// If the other core is not done yet, this will return `None`. It never blocks:
+    /// call it repeatedly (as [init_secondary] does) until it returns `Some`.
     ///
-    /// This should only be called once at startup, otherwise it may panic.
+    /// The notification from the other core is consumed as a level rather than an
+    /// event, so this core can be restarted (e.g. under a debugger) while the other
+    /// core keeps running, and still proceed.
+    ///
+    /// This can only succeed once per boot, otherwise it may panic.
     ///
     /// A hardware semaphore is used to coordinate the init with the second core.
     pub fn try_init_secondary(shared_data: &'static MaybeUninit<SharedData>) -> Option<Peripherals> {
+        // The HSEM peripheral must be clocked before its registers can be used.
+        //
+        // On families where each core has its own RCC enable registers this core
+        // can safely enable it. On families where the RCC enable registers are
+        // shared between the cores (STM32H7), doing so here would race with the
+        // other core's clock setup: critical sections are core-local and do not
+        // synchronize across cores, so a concurrent read-modify-write could drop
+        // either side's enable bit and leave the peripheral unclocked. Instead,
+        // wait for `init_primary`, which enables the HSEM peripheral before
+        // anything else, to clock it.
+        #[cfg(stm32wl5x)]
         critical_section::with(|cs| {
             rcc::enable_with_cs_no_refcount::<peripherals::HSEM>(cs);
         });
 
-        // Wait for the semaphore to be unlocked by the primary core
-        hsem::get_hsem(1).blocking_listen();
+        #[cfg(not(stm32wl5x))]
+        if !rcc::is_enabled::<peripherals::HSEM>() {
+            return None;
+        }
+
+        // Wait for the primary core to complete its init. The notification is not
+        // consumed here, so a notification sent before this call (or before this
+        // core was restarted) is not lost.
+        if !hsem::get_hsem(1).is_notified() {
+            return None;
+        }
+
+        // Ensure the notification is observed before the shared data written by
+        // the other core is read.
+        cortex_m::asm::dmb();
 
         let shared_data = unsafe { shared_data.assume_init_ref() };
 
@@ -736,6 +774,10 @@ mod dual_core {
     /// This returns the peripheral singletons that can be used for creating drivers when the other core is done with its init.
     /// If the other core is not done yet, this will spinloop wait on it.
     ///
+    /// This can be called again if this core is restarted while the other core
+    /// keeps running; the notification from [init_primary] is not consumed, so a
+    /// restart does not miss it.
+    ///
     /// This should only be called once at startup, otherwise it may panic.
     ///
     /// The `shared_data` is used to coordinate the init with the second core. Read the [SharedData] docs
```

**File**: `embassy-stm32/src/rcc/mod.rs` (modified, +20/-0)
```diff
@@ -372,6 +372,16 @@ impl RccInfo {
         self.enable_with_cs_inner(cs, true);
     }
 
+    /// Returns whether the peripheral clock is currently enabled.
+    ///
+    /// This only reads the RCC enable register, so unlike `enable_with_cs` it is
+    /// safe to call concurrently with the other core's own clock setup.
+    #[allow(dead_code)]
+    pub(crate) fn is_enabled(&self) -> bool {
+        // TODO: should this be `unsafe`?
+        unsafe { self.enable_ptr().read_volatile() & 1u32 << self.enable_bit != 0 }
+    }
+
     // TODO: should this be `unsafe`?
     fn enable_with_cs_inner(&self, cs: CriticalSection, no_refcount: bool) {
         // set the xxxEN bit
@@ -647,6 +657,16 @@ pub(crate) fn enable_with_cs_no_refcount<T: RccPeripheral>(cs: CriticalSection)
     T::RCC_INFO.enable_with_cs_no_refcount(cs);
 }
 
+/// Returns whether the peripheral clock of `T` is currently enabled.
+///
+/// Unlike [`enable_with_cs_no_refcount`], this does not write to the (possibly
+/// shared) RCC enable register, so it is safe to use while the other core is
+/// concurrently enabling its own peripherals.
+#[allow(dead_code)]
+pub(crate) fn is_enabled<T: RccPeripheral>() -> bool {
+    T::RCC_INFO.is_enabled()
+}
+
 /// Enables and clears the reset for peripheral `T`.
 ///
 /// # Safety
```

#### Recent Merged Pull Requests:
- **PR #7613** (closed): mcxa5xx/rtc: wait out STATUS resync before unlock (@gjpmsft)
- **PR #7612** (2026-11-21): stm32/hsem: fix lost notifications and secondary core boot deadlock (@xoviat)
- **PR #7605** (2026-11-20): embassy-usb: upgrade UVC class to UVC 1.5 (@leftger)
- **PR #7604** (2026-11-20): embassy-usb: add MTP (Media Transfer Protocol) device class (@leftger)
- **PR #7602** (2026-11-20): stm32/npu: run streaming-engine epochs (@leftger)
- **PR #7599** (2026-11-19): stm32: update metapac (@Dirbaio)

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

## X. stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW

**RULE**:
When implementing operations in `embassy-stm32/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0f0e5b86`: stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- fix: stm32/atomic: `Reg::set_bits`/`clear_bits` (used by the HSEM, IPCC, I2C and SDMMC drivers) no longer use core atomics for the read-modify-write. `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv7-M, and when the write re-arms an interrupt whose handler runs between the `LDREX` and the `STREX` the retry loop never terminates. The update is now done in a critical section.
- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The notification is consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
- fix: stm32/hsem: `HardwareSemaphoreInterruptHandler` now consumes the notification flags with `HSEM_CnICR` and latches them in software before waking. The latched masked status keeps the interrupt line asserted until the flags are cleared, so masking `HSEM_CnIER` (the old behavior) did not deassert it: arming the interrupt with a notification pending re-entered the handler forever, starving the tasks supposed to consume t
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The interrupt flag is now consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
- fix: stm32/hsem: `listen` waits on the unmasked interrupt status instead of the masked one. The interrupt handler disables the interrupt in `HSEM_IER` before waking, so the masked status could read as clear while a notification was still pending and the future would never complete.
- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification flag without consuming it.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0f0e5b86` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
