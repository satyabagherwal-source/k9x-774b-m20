# Verification Protocol: Verification Protocol: Empirical Defect Shield for embassy-rs-embassy-learnings

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs-embassy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T17:52:50.231Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-embassy-rs-embassy-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs-embassy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T17:52:50.231Z`  
> **Learning ID**: `LEARN-EVO-embassy-rs-embassy-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `embassy-rs-embassy-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source**: github ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Source Version**: `552c0412`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T17:52:40.162Z  
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
> **Harvest Timestamp**: 2026-11-15T17:52:39.970Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10120 stars

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
- **Issue #7550** (2026-11-15): **stm32/usb: apply the OUT packet errata delay on STM32C5 and STM32U535/545**
  *Symptoms*: The errata sheets of every STM32C5 line and of the STM32U535/545 list the USB erratum "Buffer description table update completes after CTR interrupt triggers", which `wait_for_out_packet_memory()` already works around on STM32H5 and STM32U3 (#7232): the CTR interrupt of an OUT transaction fires slightly before the peripheral has finished writing the packet and its byte count to USB SRAM, so software must wait 800 ns at full speed before reading them.  | Chips | Errata sheet | Section | |---|---|---| | STM32C531/532/542 | ES0676 Rev 2 | 2.13.1 | | STM32C551/552/562 | ES0661 Rev 1 | 2.12.1 | | STM32C591/593/5A3 | ES0677 Rev 1 | 2.14.1 | | STM32U535/545 | ES0587 Rev 6 | 2.20.1 |  These chips have the same `usb_v4` peripheral and use the same driver, but the delay was compiled only for STM32H5 and STM32U3, so they read the packet memory without it. This adds `stm32c5` and `stm32u5` to its `cfg`. On the U5 only the U535/545 have this peripheral; the other U5 parts use the OTG driver. Like STM32H5 and STM32U3, they now busy-wait at least 1 µs before reading each received OUT packet.  Checked with `cargo check` on Rust 1.100 for stm32c5a3zg, stm32c552rc and stm32c531rc (dual-bank), stm32u545re and stm32u535re (dual-bank), and for stm32h523cc and stm32u385rg, which are unchanged. Nightly rustfmt passes. Not run on C5 or U5 hardware.

- **Issue #7549** (2026-11-14): **bump esp**
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

### Incident Patch 1: `93589f9b` (2026-11-15)
**Commit Message**: Merge pull request #7539 from nullcrimson/synopsys-otg-ep0-status-rearm

synopsys-otg: do not re-arm EP0 OUT after the status stage of a control transfer

**File**: `embassy-usb-synopsys-otg/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fixed: A driver created after a previous one was dropped no longer panics at start.
 - Fixed: An isochronous IN packet that the host did not poll for in its frame is now discarded, with the endpoint disabled and its TX FIFO flushed. Before, the endpoint was enabled again with the packet still in the FIFO, which left the FIFO and the core out of step, and the writer could wait for room in the FIFO for ever.
 - Fixed: A bus reset or a new SETUP during a control transfer no longer leaves the device unresponsive.
+- Fixed: The status stage of a control transfer no longer clears NAK on EP0 OUT while the next SETUP is in the RX FIFO, which made the interrupt handler panic.
 
 ## 0.4.0 - 2026-05-28
 
```

**File**: `embassy-usb-synopsys-otg/src/lib.rs` (modified, +60/-15)
```diff
@@ -82,6 +82,11 @@ where
                 let data = &state.cp_state.setup_data;
                 data[0].store(r.fifo(0).read().data(), Ordering::Relaxed);
                 data[1].store(r.fifo(0).read().data(), Ordering::Relaxed);
+
+                // The core gives this SETUP to the software with STUP. Until then, and until
+                // `setup()` takes it, nothing must clear NAK on EP0 OUT.
+                state.cp_state.setup_ready.store(false, Ordering::Release);
+                state.cp_state.setup_pending.store(true, Ordering::Release);
             }
             vals::Pktstsd::OUT_DATA_RX => {
                 trace!("OUT_DATA_RX ep={} len={}", ep_num, len);
@@ -355,6 +360,9 @@ struct ControlPipeSetupState {
     /// Holds received SETUP packets. Available if [Ep0State::setup_ready] is true.
     setup_data: [AtomicU32; 2],
     setup_ready: AtomicBool,
+    /// Set when the data of a SETUP packet is read from the RX FIFO, which is before its STUP
+    /// interrupt sets `setup_ready`. Cleared when `setup()` takes the packet.
+    setup_pending: AtomicBool,
 }
 
 #[derive(Debug, Clone, Copy)]
@@ -475,6 +483,7 @@ where
             ep.out_enabled.store(false, Ordering::Release);
         }
         self.cp_state.setup_ready.store(false, Ordering::Release);
+        self.cp_state.setup_pending.store(false, Ordering::Release);
     }
 
     /// # Safety
@@ -509,6 +518,7 @@ where
             cp_state: ControlPipeSetupState {
                 setup_data: [const { AtomicU32::new(0) }; 2],
                 setup_ready: AtomicBool::new(false),
+                setup_pending: AtomicBool::new(false),
             },
             ep_states: [const {
                 EpState {
@@ -1302,6 +1312,7 @@ where
         // A packet or a SETUP in these buffers is from the previous session. If the software
         // keeps this data, the stack receives it as data from after the reset.
         st.cp_state.setup_ready.store(false, Ordering::Release);
+        st.cp_state.setup_pending.store(false, Ordering::Release);
         for ep in st.ep_states {
             ep.out_size.store(EP_OUT_BUFFER_EMPTY, Ordering::Release);
         }
@@ -2220,27 +2231,55 @@ where
         poll_fn(|cx| {
             self.ep_out.state.out_waker.register(cx.waker());
 
-            if self.setup_state.setup_ready.load(Ordering::Acquire) {
+            if !self.setup_state.setup_ready.load(Ordering::Acquire) {
+                trace!("SETUP waiting");
+                return Poll::Pending;
+            }
+
+            // Take the SETUP and arm EP0 OUT for its transfer in one critical section, so that the
+            // interrupt handler cannot read a newer SETUP from the RX FIFO in between.
+            let data = self.mutex.lock(|| {
+                // An entry that the interrupt handler did not read yet can be a newer SETUP.
+                if self.regs.gintsts().read().rxflvl() {
+                    return None;
+                }
+
                 let mut data = [0; 8];
                 data[0..4].copy_from_slice(&self.setup_state.setup_data[0].load(Ordering::Relaxed).to_ne_bytes());
                 data[4..8].copy_from_slice(&self.setup_state.setup_data[1].load(Ordering::Relaxed).to_ne_bytes());
                 self.setup_state.setup_ready.store(false, Ordering::Release);
+                self.setup_state.setup_pending.store(false, Ordering::Release);
 
-                // EP0 should not be controlled by `Bus` so this RMW does not need a critical section
-                self.regs.doeptsiz(self.ep_out.info.addr.index()).modify(|w| {
+                // Discard a packet that an aborted stage of the previous transfer did not read.
+                self.ep_out.state.out_size.store(EP_OUT_BUFFER_EMPTY, Ordering::Release);
+
+                // Clear NAK to indicate we are ready to receive more data. This is the only place
+                // that arms EP0 OUT for the first packet of a transfer: the status stage does
+                // not arm it again.
+                let index = self.ep_out.info.addr.index();
+                self.regs.doeptsiz(index).modify(|w| {
                     w.set_rxdpid_stupcnt(3);
+                    w.set_pktcnt(1);
+                    w.set_xfrsiz(u32::from(self.max_packet_size));
+                });
+                self.regs.doepctl(index).modify(|w| {
+                    w.set_epena(true);
+                    w.set_cnak(true);
                 });
 
-                // Clear NAK to indicate we are ready to receive more data
-                self.regs
-                    .doepctl(self.ep_out.info.addr.index())
-                    .modify(|w| w.set_cnak(true));
+                Some(data)
+            });
 
-                trace!("SETUP received: {:?}", Bytes(&data));
-                Poll::Ready(data)
-            } else {
-                trace!("SETUP waiting");
-                Poll::Pending
+            match data {
+                Some(data) => {
+                    trac
```

---

### Incident Patch 2: `859d3525` (2026-11-14)
**Commit Message**: Merge pull request #7526 from Finomnis/stm32-ucpd-pd-fixes

stm32/ucpd: fix RXORDSETEN bits for the debug SOPs

**File**: `embassy-stm32/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ UCPD:
 - fix: stm32/ucpd: when `CcPhy` and `PdPhy` were dropped at the same time from different priority levels, the peripheral could be left enabled.
 - fix: stm32/ucpd: update the control register (CR) without lost updates or repeated commands. `CcPhy` and `PdPhy` could overwrite each other's settings, and any CR update could write back a `TXSEND` or `TXHRST` the hardware had just cleared, sending a message or Hard Reset twice.
 - feat: stm32/ucpd: add `Ucpd::split_idle_pd_phy`, which keeps the `CcPhy` and an `IdlePdPhy` for the whole lifetime of the driver. `IdlePdPhy::activate` enables PD on a CC line and returns an `ActivePdPhy` guard that disables it again when dropped, so PD can be turned on and off on every attach and detach without recreating `Ucpd` or touching the CC terminations.
+- fix: stm32/ucpd: enable SOP'_Debug and SOP''_Debug reception on the right `RXORDSETEN` bits. `sop_prime_debug` enabled Cable Reset detection and `sop_double_prime_debug` enabled SOP'_Debug.
 
 VREFBUF:
 - feat: stm32/vrefbuf g0x1: enable the VREFBUF clock. On G0x1, including G0B1, it is `SYSCFGEN` in `RCC_APBENR2`, shared with SYSCFG and COMP (RM0444 5.4.16). Without it `VoltageReferenceBuffer::new` never sees `VRR` and waits forever.
```

**File**: `embassy-stm32/src/ucpd.rs` (modified, +5/-4)
```diff
@@ -158,12 +158,12 @@ impl<'d, T: Instance> Ucpd<'d, T> {
             w.set_hbitclkdiv(13 - 1);
 
             // Time window for detecting non-idle (12-20us).
-            // 1.75us * 8 = 14us.
+            // 1.625us * 8 = 13us.
             w.set_transwin(8 - 1);
 
             // Time from the end of last bit of a Frame until the start of the first bit of the
             // next Preamble (min 25us).
-            // 1.75us * 17 = ~30us
+            // 1.625us * 17 = ~27.6us
             w.set_ifrgap(17 - 1);
 
             // UNDOCUMENTED: This register can only be written while UCPDEN=0 (found by testing).
@@ -172,8 +172,9 @@ impl<'d, T: Instance> Ucpd<'d, T> {
                 | (config.sop_double_prime as u16) << 2
                 // Hard reset
                 | 0x1 << 3
-                | (config.sop_prime_debug as u16) << 4
-                | (config.sop_double_prime_debug as u16) << 5;
+                // Bit 4 is Cable Reset, which is not enabled.
+                | (config.sop_prime_debug as u16) << 5
+                | (config.sop_double_prime_debug as u16) << 6;
             w.set_rxordseten(rxordset);
 
             // Enable DMA
```

---

### Incident Patch 3: `9d117616` (2026-11-13)
**Commit Message**: Merge pull request #7538 from felipebalbi/rtc-fixes

[MCXA] more RTC fixes

**File**: `embassy-mcxa/Cargo.toml` (modified, +0/-3)
```diff
@@ -220,9 +220,6 @@ trace = []
 # If this feature is enabled, users should NOT enable `embassy-executor/platform-cortex-m` or any other executor platform.
 executor-platform = []
 
-# This feature is not done yet, don't use it!
-unstable-osc32k = []
-
 #
 # Chip selection
 #
```

**File**: `embassy-mcxa/src/clkout.rs` (modified, +7/-4)
```diff
@@ -36,8 +36,11 @@ pub enum ClockOutSel {
     /// 16KHz oscillator
     #[cfg(feature = "_mcxa2xx")]
     Clk16K,
-    /// Either the 16K or 32K oscillator, depending on settings
-    #[cfg(feature = "_mcxa5xx")]
+    /// RTC-selected low-power clock output.
+    ///
+    /// Unsupported: CLK_SEL and CLKO_DIS belong to the independently owned RTC,
+    /// so CLKOUT cannot guarantee this route's frequency or availability.
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     LpOsc,
     /// Output of PLL1
     #[cfg(feature = "_mcxa2xx")]
@@ -162,8 +165,8 @@ fn check_sel(sel: ClockOutSel, level: PoweredClock, divisor: u32) -> Result<(u32
                 ClockOutSel::FroHfDiv => (c.ensure_fro_hf_div_active(&level)?, Mux::I1ClkrootFircDiv),
                 #[cfg(not(feature = "sosc-as-gpio"))]
                 ClockOutSel::ClkIn => (c.ensure_clk_in_active(&level)?, Mux::I2ClkrootSosc),
-                // TODO: we need this to be an lp_osc clock
-                ClockOutSel::LpOsc => (c.ensure_clk_32k_vdd_core_active(&level)?, Mux::I3ClkrootLposc),
+                #[cfg(not(feature = "rosc-32k-as-gpio"))]
+                ClockOutSel::LpOsc => return Err(ClockError::NotImplemented { clock: "lp_osc" }),
                 ClockOutSel::Pll1ClkDiv => (c.ensure_pll1_clk_div_active(&level)?, Mux::I5ClkrootSpllDiv),
                 ClockOutSel::SlowClk => (c.ensure_slow_clk_active(&level)?, Mux::I6ClkrootSlow),
             };
```

**File**: `embassy-mcxa/src/clocks/config.rs` (modified, +42/-38)
```diff
@@ -129,8 +129,8 @@ pub struct ClocksConfig {
     pub sirc: SircConfig,
     /// FRO16K clock source
     pub fro16k: Option<Fro16KConfig>,
-    /// OSC32K clock source
-    #[cfg(all(feature = "_mcxa5xx", feature = "unstable-osc32k", not(feature = "rosc-32k-as-gpio")))]
+    /// LP OSC32K clock source. `None` preserves hardware without advertising it.
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub osc32k: Option<Osc32KConfig>,
     /// SOSC, clk_in clock source
     ///
@@ -565,47 +565,31 @@ impl Default for Fro16KConfig {
     }
 }
 
-/// OSC32K Operational Mode
-#[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
-pub enum Osc32KMode {
-    ///  low power switched oscillator mode
-    LowPower {
-        /// 32K Oscillator internal transconductance gain current
-        coarse_amp_gain: Osc32KCoarseGain,
-        /// Enable if Vbat exceeds 3.0v
-        vbat_exceeds_3v0: bool,
-    },
-    /// high performance transconductance oscillator mode
-    HighPower {
-        /// 32K Oscillator internal transconductance gain current
-        coarse_amp_gain: Osc32KCoarseGain,
-        /// Configurable capacitance for XTAL pad
-        xtal_cap_sel: Osc32KCapSel,
-        /// Configurable capacitance for EXTAL pad
-        extal_cap_sel: Osc32KCapSel,
-    },
-}
-
 /// Coarse Gain Amplification
 ///
-/// See datasheet table 4.2.1.4, "32 kHz oscillation gain setting"
+/// NXP specifies LP ESR limits of 50 kOhm for gain 00 and 70 kOhm for gain 01.
+/// Higher gain LP electrical limits require device/crystal qualification.
 #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
 pub enum Osc32KCoarseGain {
-    /// Max ESR 50kOhms, Max Cx 14pF
+    /// Gain 00: LP maximum ESR 50 kOhm.
     EsrRange0,
-    /// Max ESR 70kOhms, Max Cx 22pF
+    /// Gain 01: LP maximum ESR 70 kOhm.
     EsrRange1,
-    /// Max ESR 80kOhms, Max Cx 22pF
+    /// Gain 10: no LP ESR limit specified here.
     EsrRange2,
-    /// Max ESR 100kOhms, Max Cx 20pF
+    /// Gain 11: no LP ESR limit specified here.
     EsrRange3,
 }
 
+/// Per-pin startup capacitance, not effective crystal load capacitance.
+///
+/// Only positive startup values are supported. Final LP capacitances are always zero.
 #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
+#[derive(Clone, Copy)]
+#[repr(u8)]
 pub enum Osc32KCapSel {
-    // NOTE: 0pF is not supported in non-low-power-modes
     /// 2pF
-    Cap2PicoF,
+    Cap2PicoF = 1,
     /// 4pF
     Cap4PicoF,
     /// 6pF
@@ -636,12 +620,29 @@ pub enum Osc32KCapSel {
     Cap30PicoF,
 }
 
-/// OSC32K Configuration Items
+/// LP-only OSC32K configuration.
+///
+/// Startup loading must be qualified for the crystal and PCB parasitics; crystal C0
+/// is not the pad/PCB shunt capacitance. Readiness does not establish frequency accuracy
+/// or crystal drive compliance. Normal mode is not supported on this device family.
+/// A compatible retained LP source is adopted without replaying startup. Unrequested
+/// retained output gates remain enabled, but are not advertised in the clock cache.
 #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
 #[non_exhaustive]
 pub struct Osc32KConfig {
-    /// Low/High Power Mode Selection
-    pub mode: Osc32KMode,
+    /// XTAL pin capacitance used only during startup.
+    pub startup_xtal_cap_sel: Osc32KCapSel,
+    /// EXTAL pin capacitance used only during startup.
+    pub startup_extal_cap_sel: Osc32KCapSel,
+    /// Oscillator transconductance gain used during startup and LP operation.
+    pub coarse_amp_gain: Osc32KCoarseGain,
+    /// Select the LP supply detector setting for VBAT above 3.0 V.
+    pub vbat_exceeds_3v0: bool,
+    /// Maximum status polls per LDO/startup/LP readiness stage, before the time driver exists.
+    ///
+    /// The reference default is 100,000,000 polls, not a wall-clock duration. Tune for
+    /// CPU/bus speed and qualified worst-case crystal startup; it is always finite.
+    pub readiness_poll_budget: core::num::NonZeroU32,
     /// is `clk_32k[0]` active?
     pub vsys_domain_active: bool,
     /// is `clk_32k[1]` active?
@@ -652,12 +653,15 @@ pub struct Osc32KConfig {
 
 #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
 impl Default for Osc32KConfig {
+    /// SDK 26.09 reference STARTUP profile (12 pF per pin, gain 01), followed by LP.
+    /// This is not universal crystal/board qualification. All three outputs are enabled.
     fn default() -> Self {
         Self {
-            mode: Osc32KMode::LowPower {
-                coarse_amp_gain: Osc32KCoarseGain::EsrRange0,
-                vbat_exceeds_3v0: true,
-            },
+            startup_xtal_cap_sel: Osc32KCapSel::Cap12PicoF,
+            startup_extal_cap_sel: Osc32KCapSel::Cap12PicoF,
+            coarse_amp_gain: Osc32KCoarseGain::EsrRange1,
+            vbat_exceeds_3v0: true,
+            readiness_poll_budget: core::num::NonZeroU32::new(100_000_0
```

**File**: `embassy-mcxa/src/clocks/mod.rs` (modified, +5/-1)
```diff
@@ -122,6 +122,10 @@ pub fn init(settings: ClocksConfig) -> Result<(), ClockError> {
         cmc: pac::CMC,
     };
 
+    // Reject incompatible retained VBAT state before changing any clock dependencies.
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
+    operator.preflight_osc32k_clocks()?;
+
     operator.unlock_mrcc();
 
     // Before applying any requested clocks, apply the requested VDD_CORE
@@ -135,7 +139,7 @@ pub fn init(settings: ClocksConfig) -> Result<(), ClockError> {
     operator.configure_fro16k_clocks()?;
 
     // NOTE: OSC32K must be configured AFTER FRO16K.
-    #[cfg(all(feature = "_mcxa5xx", feature = "unstable-osc32k", not(feature = "rosc-32k-as-gpio")))]
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     operator.configure_osc32k_clocks()?;
 
     #[cfg(not(feature = "sosc-as-gpio"))]
```

**File**: `embassy-mcxa/src/clocks/operator.rs` (modified, +204/-202)
```diff
@@ -444,229 +444,231 @@ impl ClockOperator<'_> {
         Ok(())
     }
 
-    /// Configure the ROSC/OSC32K clock family
-    #[cfg(all(feature = "_mcxa5xx", feature = "unstable-osc32k", not(feature = "rosc-32k-as-gpio")))]
+    /// Validate retained VBAT controls before changing the FRO16K dependency.
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
+    pub(super) fn preflight_osc32k_clocks(&self) -> Result<(), ClockError> {
+        let Some(_) = self.config.osc32k.as_ref() else {
+            return Ok(());
+        };
+        if !self.config.fro16k.as_ref().is_some_and(|fro| fro.vbat_domain_active) {
+            return Err(ClockError::BadConfig {
+                clock: "osc32k",
+                reason: "FRO16K and its VBAT output must be requested",
+            });
+        }
+        if self.vbat0.frolcka().read().lock() && !self.vbat0.froctla().read().fro_en() {
+            return Err(ClockError::BadConfig {
+                clock: "osc32k",
+                reason: "FRO16K locked disabled; VBAT POR required",
+            });
+        }
+        // RM 31.7.1.17 requires at least one retained array whenever LDO_RAM is enabled.
+        // Retention policy belongs to the SRAM owner; reject rather than changing it.
+        let ram = self.vbat0.ldoramc().read();
+        if ram.ret0() && ram.ret1() && ram.ret2() && ram.ret3() {
+            return Err(ClockError::BadConfig {
+                clock: "osc32k",
+                reason: "LDO_RAM requires at least one retained SRAM array",
+            });
+        }
+        let ldo = self.vbat0.ldoctla().read();
+        if self.vbat0.ldolcka().read().lock() && !(ldo.ldo_en() && ldo.bg_en() && ldo.refresh_en()) {
+            return Err(ClockError::BadConfig {
+                clock: "osc32k",
+                reason: "LDO controls locked incompatible; VBAT POR required",
+            });
+        }
+        let osc = self.vbat0.oscctla().read();
+        if osc.osc_en() {
+            // Do not restart or retune an oscillator that may already supply the RTC.
+            if !self.osc32k_lp_controls_match() {
+                return Err(ClockError::BadConfig {
+                    clock: "osc32k",
+                    reason: "retained oscillator is not compatible LP; VBAT POR required",
+                });
+            }
+        } else if self.vbat0.osclcka().read().lock() {
+            return Err(ClockError::BadConfig {
+                clock: "osc32k",
+                reason: "oscillator locked disabled; VBAT POR required",
+            });
+        }
+        Ok(())
+    }
+
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
+    fn osc32k_lp_controls_match(&self) -> bool {
+        use config::Osc32KCoarseGain;
+        use nxp_pac::vbat::{CoarseAmpGain, ExtalCapSel, InitTrim, ModeEn, SupplyDet, XtalCapSel};
+
+        let Some(cfg) = self.config.osc32k.as_ref() else {
+            return false;
+        };
+        let gain = match cfg.coarse_amp_gain {
+            Osc32KCoarseGain::EsrRange0 => CoarseAmpGain::Gain05,
+            Osc32KCoarseGain::EsrRange1 => CoarseAmpGain::Gain10,
+            Osc32KCoarseGain::EsrRange2 => CoarseAmpGain::Gain18,
+            Osc32KCoarseGain::EsrRange3 => CoarseAmpGain::Gain33,
+        };
+        let supply = if cfg.vbat_exceeds_3v0 {
+            SupplyDet::G3vsupply
+        } else {
+            SupplyDet::L3vsupply
+        };
+        let osc = self.vbat0.oscctla().read();
+        osc.osc_en()
+            && !osc.osc_byp_en()
+            && osc.cap_sel_en()
+            && osc.mode_en() == ModeEn::Sw
+            && osc.xtal_cap_sel() == XtalCapSel::Sel0
+            && osc.extal_cap_sel() == ExtalCapSel::Sel0
+            && osc.coarse_amp_gain() == gain
+            && osc.supply_det() == supply
+            && self.vbat0.osccfga().read().init_trim() == InitTrim::Sel0
+    }
+
+    /// Establish LP OSC32K or adopt a compatible retained source without restarting it.
+    #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub(super) fn configure_osc32k_clocks(&mut self) -> Result<(), ClockError> {
-        use config::{Osc32KCapSel, Osc32KCoarseGain, Osc32KMode};
+        use config::Osc32KCoarseGain;
         use nxp_pac::vbat::{
             CoarseAmpGain, ExtalCapSel, InitTrim, ModeEn, StatusaLdoRdy, StatusaOscRdy, SupplyDet, XtalCapSel,
         };
 
-        // Unlock the control first
-        self.vbat0.ldolcka().modify(|w| w.set_lock(false));
-
+        // None neither claims the source nor changes its controls, gates or locks.
         let Some(cfg) = self.config.osc32k.as_ref() else {
-            // TODO: how to ensure disabled?
-            // ???
-
-            // Re-lock after disabling
-            self.vbat0.ldolcka().modify(|w| w.set_lock(true));
             return Ok(());
         };
+        self.preflight_osc32k_clocks()?;
+        if !self.vbat0.froctla().read().fro_en() || !self.vbat0.froclke().rea
```

**File**: `embassy-mcxa/src/clocks/types.rs` (modified, +7/-3)
```diff
@@ -59,6 +59,8 @@ impl Drop for WakeGuard {
 /// These values are configured by providing
 /// [ClocksConfig](crate::clocks::config::ClocksConfig) to the
 /// [`init()`](super::init) function at boot time.
+/// This is established configuration, not live clock-health monitoring. In particular,
+/// OSC32K readiness does not measure frequency accuracy or detect subsequent failure.
 #[derive(Default, Debug, Clone)]
 #[non_exhaustive]
 pub struct Clocks {
@@ -138,24 +140,26 @@ pub struct Clocks {
     #[cfg(feature = "_mcxa5xx")]
     pub clk_16k_vbat: Option<Clock>,
 
-    /// `clk_32k_vsys` is one of two/three outputs of the `FRO16K` internal oscillator.
+    /// `clk_32k_vsys` is an output of the LP `OSC32K` crystal oscillator.
     ///
     /// Also referred to as `clk_32k[0]` in the datasheet, it feeds peripherals in
     /// the system domain, such as the CMP. Note that it does NOT feed the RTC,
     /// which is a VBAT-domain peripheral and uses `clk_32k[2]`.
     #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub clk_32k_vsys: Option<Clock>,
 
-    /// `clk_32k_vdd_core` is one of two/three outputs of the `FRO16K` internal oscillator.
+    /// `clk_32k_vdd_core` is an output of the LP `OSC32K` crystal oscillator.
     ///
     /// Also referred to as `clk_32k[1]` in the datasheet, it feeds peripherals in
     /// the VDD Core domain, such as the OSTimer or LPUarts.
     #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub clk_32k_vdd_core: Option<Clock>,
 
-    /// `clk_32k_vbat` is one of three outputs of the `FRO16K` internal oscillator.
+    /// `clk_32k_vbat` is an output of the LP `OSC32K` crystal oscillator.
     ///
     /// Also referred to as `clk_32k[2]` in the datasheet.
+    /// LP operation retains the `AlwaysEnabled` contract for powered consumers;
+    /// this does not guarantee operation of unpowered system-domain consumers.
     #[cfg(all(feature = "_mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub clk_32k_vbat: Option<Clock>,
 
```

**File**: `embassy-mcxa/src/rtc/mcxa5xx.rs` (modified, +128/-13)
```diff
@@ -8,7 +8,7 @@ use embassy_hal_internal::{Peri, PeripheralType};
 use embedded_mcu_hal::time::{Datetime, DatetimeClock, DatetimeClockError, DatetimeFields, Month as HalMonth};
 use maitake_sync::WaitCell;
 
-use crate::clocks::{WakeGuard, with_clocks};
+use crate::clocks::{Clock, WakeGuard, with_clocks};
 use crate::interrupt::typelevel::{Handler, Interrupt};
 use crate::pac;
 use crate::pac::rtc::Swr;
@@ -385,7 +385,7 @@ const DESYNCED: u16 = 0xfffe;
 ///
 /// This is a distinct sentinel from [`DESYNCED`]: FFFFh means the counters are
 /// mid-update and the read should simply be retried, whereas FFFEh means the
-/// block has no clock at all and retrying will never succeed.
+/// register interface is synchronizing, possibly because its clock is stopped.
 const INVALID: u16 = 0xffff;
 
 /// Errors exclusive to HW initialization
@@ -454,7 +454,29 @@ pub struct Rtc<'a> {
 impl<'a> Rtc<'a> {
     const BASE_YEAR: i16 = 2112;
 
+    fn selected_clock(clksel: ClkSel) -> Result<Clock, SetupError> {
+        // RTC uses the VBAT-domain outputs, not the system/core outputs.
+        // A retained but unadvertised source is not an initialization opt-in.
+        with_clocks(|c| match clksel {
+            ClkSel::Clk16384 => c.clk_16k_vbat.clone(),
+            ClkSel::Clk32768 => {
+                #[cfg(not(feature = "rosc-32k-as-gpio"))]
+                {
+                    c.clk_32k_vbat.clone()
+                }
+                #[cfg(feature = "rosc-32k-as-gpio")]
+                None
+            }
+        })
+        .flatten()
+        .ok_or(SetupError::ClockSetup)
+    }
+
     /// Create an exclusive RTC handle and a cloneable, read-only time provider.
+    ///
+    /// Board clock setup must enable both the currently selected (possibly
+    /// retained) source and the requested source. This does not start oscillators;
+    /// it waits finitely for register synchronization before configuration.
     pub fn new<T: Instance>(
         _inst: Peri<'a, T>,
         _irq: impl crate::interrupt::typelevel::Binding<T::Interrupt, InterruptHandler<T>> + 'a,
@@ -470,13 +492,7 @@ impl<'a> Rtc<'a> {
         // osc32k[2] (RM p.81527), not the system-domain [0] outputs. Measured
         // on FRDM-MCXA577 with CLK_SEL=0: the counter runs with FROCLKE=0b100
         // alone, and stops with 0b001 or 0b010.
-        let clocks = if config.clksel == ClkSel::Clk16384 {
-            with_clocks(|c| c.clk_16k_vbat.clone())
-        } else {
-            with_clocks(|c| c.clk_32k_vbat.clone())
-        };
-
-        let clk = clocks.flatten().ok_or(SetupError::ClockSetup)?;
+        let clk = Self::selected_clock(config.clksel)?;
 
         let mut inst = Self {
             info,
@@ -501,7 +517,26 @@ impl<'a> Rtc<'a> {
     }
 
     fn set_configuration(&mut self, config: &Config) -> Result<(), SetupError> {
-        critical_section::with(|_| self.set_configuration_inner(config))
+        let clk = Self::selected_clock(config.clksel)?;
+        let wg = WakeGuard::for_power(&clk.power);
+
+        // RM 38.3.1.2-3: FFFEh is normal for two oscillator cycles after the
+        // selected clock becomes available. Wait outside the protected-write
+        // critical section; a stopped source must still fail finitely. This is
+        // a CPU/bus-dependent poll budget, not a wall-clock timeout.
+        let mut polls = 1_000_000u32;
+        while self.info.regs().ctrl().read().0 == DESYNCED {
+            if polls == 0 {
+                return Err(SetupError::RegisterAccess);
+            }
+            polls -= 1;
+            core::hint::spin_loop();
+        }
+
+        critical_section::with(|_| self.set_configuration_inner(config))?;
+        self._freq = clk.frequency;
+        self._wg = wg;
+        Ok(())
     }
 
     fn set_configuration_inner(&mut self, config: &Config) -> Result<(), SetupError> {
@@ -512,7 +547,34 @@ impl<'a> Rtc<'a> {
             return Err(SetupError::RegisterAccess);
         }
 
-        self.disable_write_protect();
+        // The block may still be in its power-on unlocked window, whose age is
+        // unknown. Lock first so configuration gets a fresh two-second window
+        // rather than racing the inherited window's expiry (RM 38.3.7).
+        let mut attempts = 8u8;
+        loop {
+            if attempts == 0 {
+                return Err(SetupError::RegisterAccess);
+            }
+            attempts -= 1;
+
+            self.enable_write_protect();
+            let status = self.info.regs().status().read();
+            if status.0 == DESYNCED {
+                return Err(SetupError::RegisterAccess);
+            }
+            if !status.write_prot_en() {
+                continue;
+            }
+
+            self.disable_write_protect();
+            let status = self.info.regs().status().read();
+            if status.0 == DESYNCED {
+                return Err(SetupError::RegisterAccess);
+            }
+            if !status.write_prot_en() {
+   
```

**File**: `examples/mcxa287/Cargo.toml` (modified, +2/-1)
```diff
@@ -13,6 +13,7 @@ defmt = "1.0"
 defmt-rtt = "1.0"
 embassy-embedded-hal = { version = "0.6.0", path = "../../embassy-embedded-hal" }
 embassy-executor = { version = "0.10.0", path = "../../embassy-executor", default-features = false, features = ["executor-thread", "defmt"] }
+embassy-futures = { version = "0.1.2", path = "../../embassy-futures" }
 embassy-mcxa = { version = "0.1.0", path = "../../embassy-mcxa", features = ["defmt", "unstable-pac", "mcxa287"] }
 embassy-time = { version = "0.5.1", path = "../../embassy-time", features = ["defmt", "defmt-timestamp-uptime"] }
 embedded-io-async = "0.7.0"
@@ -37,5 +38,5 @@ debug = 2
 
 [package.metadata.embassy]
 build = [
-  { target = "thumbv8m.main-none-eabihf", artifact-dir = "out/examples/mcxa287" }
+  { target = "thumbv8m.main-none-eabihf", artifact-dir = "out/examples/mcxa287" },
 ]
```

#### Recent Merged Pull Requests:
- **PR #7550** (2026-11-15): stm32/usb: apply the OUT packet errata delay on STM32C5 and STM32U535/545 (@buda-gotivac)
- **PR #7549** (2026-11-14): bump esp (@xoviat)
- **PR #7548** (2026-11-15): Remove never type hack (@0e4ef622)
- **PR #7539** (2026-11-15): synopsys-otg: do not re-arm EP0 OUT after the status stage of a control transfer (@nullcrimson)
- **PR #7538** (2026-11-13): [MCXA] more RTC fixes (@felipebalbi)
- **PR #7537** (2026-11-13): stm32: subghz: simplify the API after review (@leftger)

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

## X. Empirical Invariant Guard in CHANGELOG.md

**RULE**:
When implementing operations in `embassy-usb-synopsys-otg/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `93589f9b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-usb-synopsys-otg/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Fixed: The status stage of a control transfer no longer clears NAK on EP0 OUT while the next SETUP is in the RX FIFO, which made the interrupt handler panic.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `93589f9b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
