# Domain G — Architecture Intelligence: Architecture Intelligence: Xudong-Huang/may Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "Xudong-Huang/may",
  "source_url": "https://github.com/Xudong-Huang/may",
  "source_version": "52489997",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T21:58:35.785Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xudong-huang-may",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Xudong-Huang/may](https://github.com/Xudong-Huang/may) (Revision: `52489997`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T21:58:35.785Z`  
> **Learning ID**: `learn-github-xudong-huang-may`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), B (Product Intelligence), H (Technical Construction Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from Xudong-Huang/may:

# Forensic Learning Record (Deep Inspection): Xudong-Huang/may

> **Canonical Artifact**: `07_PROJECT_LEARNING/xudong-huang-may-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Xudong-Huang/may](https://github.com/Xudong-Huang/may))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T21:58:34.397Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Xudong-Huang/may`
- **Description**: rust stackful coroutine library
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2446 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/cqueue.rs`
```
extern crate generator;
#[macro_use]
extern crate may;

use std::cell::UnsafeCell;
use std::time::Duration;

use may::{coroutine, cqueue};

// this is wrapper to work around the compile error
// we are safe to share the data in bottom half since we run them orderly
struct SyncCell<T>(UnsafeCell<T>);
impl<T> SyncCell<T> {
    fn new(data: T) -> Self {
        Self(UnsafeCell::new(data))
    }

    unsafe fn get_mut(&mut self) -> &mut T {
        self.0.get_mut()
    }
}

// sum ten data resources
fn main() {
    let mut gv = vec![];
    let mut total = SyncCell::new(0);

    // create the event producers
    for i in 0..10 {
        let g = generator::Gn::new_scoped(move |mut s| {
            let mut data = 10;
            loop {
                coroutine::sleep(Duration::from_millis(500 * (i + 1)));
                // println!("coroutine{}: data = {:?}", i, data);
                s.yield_with(data);
                data += 10;
            }
        });

        gv.push(g);
    }

    // the select body that monitor the rx event and recalc the new total
    cqueue::scope(|cqueue| {
        // register select coroutines
        for t in 0..10 {
            go!(cqueue, t, |es| {
                let mut last = 0;
                let token = es.get_token();
                for data in gv[token].by_ref() {
                    // =====================================================
                    es.send(0);
                    // =====================================================

                    let delta = data - last;
                    let total = unsafe { total.get_mut() };
                    // bottom half that will run sequentially in the poller
                    println!("in selector: update from {token}, delta={delta}, last_total={total}");

                    *total += delta;
                    last = data;
                }
            });
        }

        // register timer for poller
        cqueue_add_oneshot!(cqueue, 9999, _ = coroutine::sleep(Duration::from_secs(10)) => {
            println!("poll time over!");
        });

        let total = unsafe { total.get_mut() };
        // poll the event
        while let Ok(ev) = cqueue.poll(None) {
            if ev.token == 9999 {
                break;
            }
            // print the new total
            println!("in poller: total={total}");
        }
    });

    println!("done");
}

```

### Core Architecture Module: `examples/loop_select.rs`
```
use std::time::Duration;

fn main() {
    may::go!(|| {
        // `loop_select!` re-runs the branch closures and borrows the
        // receivers, so use the multi-consumer channel (`mpsc::Receiver` is
        // `!Sync`).
        let (sx1, rx1) = may::sync::mpmc::channel();
        let (sx2, rx2) = may::sync::mpmc::channel();
        sx1.send(100i32).unwrap();
        sx2.send(200i32).unwrap();

        may::loop_select!(
            v1 = rx1.recv() => println!("v1={:?}", v1),
            v2 = rx2.recv() => println!("v2={:?}", v2)
        );
    });
    std::thread::sleep(Duration::from_secs(1));
}

```

### Core Architecture Module: `may_queue/src/atomic.rs`
```
use std::cell::UnsafeCell;
use std::fmt;
use std::ops::Deref;

// /// `AtomicU32` providing an additional `unsync_load` function.
// pub(crate) struct AtomicU32 {
//     inner: UnsafeCell<std::sync::atomic::AtomicU32>,
// }

// unsafe impl Send for AtomicU32 {}
// unsafe impl Sync for AtomicU32 {}

// impl AtomicU32 {
//     pub(crate) const fn new(val: u32) -> AtomicU32 {
//         let inner = UnsafeCell::new(std::sync::atomic::AtomicU32::new(val));
//         AtomicU32 { inner }
//     }

//     /// Performs an unsynchronized load.
//     ///
//     /// # Safety
//     ///
//     /// All mutations must have happened before the unsynchronized load.
//     /// Additionally, there must be no concurrent mutations.
//     pub(crate) unsafe fn unsync_load(&self) -> u32 {
//         core::ptr::read(self.inner.get() as *const u32)
//     }
// }

// impl Deref for AtomicU32 {
//     type Target = std::sync::atomic::AtomicU32;

//     fn deref(&self) -> &Self::Target {
//         // safety: it is always safe to access `&self` fns on the inner value as
//         // we never perform unsafe mutations.
//         unsafe { &*self.inner.get() }
//     }
// }

// impl fmt::Debug for AtomicU32 {
//     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
//         self.deref().fmt(fmt)
//     }
// }

pub(crate) struct AtomicUsize {
    inner: UnsafeCell<std::sync::atomic::AtomicUsize>,
}

unsafe impl Send for AtomicUsize {}
unsafe impl Sync for AtomicUsize {}

impl AtomicUsize {
    pub(crate) const fn new(val: usize) -> AtomicUsize {
        let inner = UnsafeCell::new(std::sync::atomic::AtomicUsize::new(val));
        AtomicUsize { inner }
    }

    /// Performs an unsynchronized load.
    ///
    /// # Safety
    ///
    /// All mutations must have happened before the unsynchronized load.
    /// Additionally, there must be no concurrent mutations.
    pub(crate) unsafe fn unsync_load(&self) -> usize {
        // don't use `get_mut`, it would create a `&mut` that conflicts with concurrent atomic loads
        (*self.inner.get()).as_ptr().read()
    }
}

impl Deref for AtomicUsize {
    type Target = std::sync::atomic::AtomicUsize;

    fn deref(&self) -> &Self::Target {
        // safety: it is always safe to access `&self` fns on the inner value as
        // we never perform unsafe mutations.
        unsafe { &*self.inner.get() }
    }
}

impl fmt::Debug for AtomicUsize {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.deref().fmt(fmt)
    }
}

pub(crate) struct AtomicPtr<T> {
    inner: UnsafeCell<std::sync::atomic::AtomicPtr<T>>,
}

unsafe impl<T> Send for AtomicPtr<T> {}
unsafe impl<T> Sync for AtomicPtr<T> {}

impl<T> AtomicPtr<T> {
    pub(crate) const fn new(val: *mut T) -> AtomicPtr<T> {
        let inner = UnsafeCell::new(std::sync::atomic::AtomicPtr::new(val));
        AtomicPtr { inner }
    }

    /// Performs an unsynchronized load.
    ///
    /// # Safety
    ///
    /// All mutations must have happened before the unsynchronized load.
    /// Additionally, there must be no concurrent mutations.
    pub(crate) unsafe fn unsync_load(&self) -> *mut T {
        // don't use `get_mut`, it would create a `&mut` that conflicts with concurrent atomic loads
        (*self.inner.get()).as_ptr().read()
    }
}

impl<T> Deref for AtomicPtr<T> {
    type Target = std::sync::atomic::AtomicPtr<T>;

    fn deref(&self) -> &Self::Target {
        // safety: it is always safe to access `&self` fns on the inner value as
        // we never perform unsafe mutations.
        unsafe { &*self.inner.get() }
    }
}

impl<T> fmt::Debug for AtomicPtr<T> {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.deref().fmt(fmt)
    }
}

```

### Core Architecture Module: `may_queue/src/lib.rs`
```
#![cfg_attr(all(nightly, test), feature(test))]

mod atomic;

pub mod mpsc;
pub mod mpsc_list;
pub mod mpsc_list_v1;
pub mod spmc;
pub mod spsc;

#[cfg(test)]
mod test_queue {
    pub trait ScBlockPop<T> {
        fn block_pop(&self) -> T;
    }
}

```

### Core Architecture Module: `may_queue/src/mpsc.rs`
```
use crossbeam_utils::{Backoff, CachePadded};
use smallvec::SmallVec;

use crate::atomic::{AtomicPtr, AtomicUsize};

use std::cell::UnsafeCell;
use std::cmp;
use std::marker::PhantomData;
use std::mem::MaybeUninit;
use std::ptr;
use std::sync::atomic::Ordering;

// size for block_node
pub const BLOCK_SIZE: usize = 1 << BLOCK_SHIFT;
// block mask
const BLOCK_MASK: usize = BLOCK_SIZE - 1;
// block shift
const BLOCK_SHIFT: usize = 6;

/// A slot in a block.
struct Slot<T> {
    /// The value.
    value: UnsafeCell<MaybeUninit<T>>,
    ready: AtomicUsize,
}

impl<T> std::panic::RefUnwindSafe for Slot<T> {}

/// a block node contains a bunch of items stored in a array
/// this could make the malloc/free not that frequent, also
/// the array could speed up list operations
#[repr(align(64))]
struct BlockNode<T> {
    data: [Slot<T>; BLOCK_SIZE],
    next: AtomicPtr<BlockNode<T>>,
    start: usize, // start index of the block
}

/// we don't implement the block node Drop trait
/// the queue is responsible to drop all the items
/// and would call its get() method for the dropping
impl<T> BlockNode<T> {
    /// Allocate the block directly on the heap.
    ///
    /// `Box::new(BlockNode { .. })` first materialises the whole node -
    /// BLOCK_SIZE slots of `T` - on the caller's stack and then moves it to
    /// the heap. With a large `T` on a small coroutine stack that is a
    /// guard-page hit at an arbitrary push, and a coroutine killed by stack
    /// overflow does not unwind, so the queue is left corrupted mid-push
    /// and every later consumer blocks forever.
    ///
    /// `alloc_zeroed` never touches the stack: zeroed memory is a valid
    /// state for every field here (atomics at 0 / null, `MaybeUninit`
    /// slots), and any non-zero field is written through a raw pointer, so
    /// no `BlockNode` value ever exists on the stack. Blocks are freed with
    /// `Box::from_raw`, which pairs with the global allocator used here.
    fn new_box(index: usize) -> *mut BlockNode<T> {
        unsafe {
            let layout = std::alloc::Layout::new::<BlockNode<T>>();
            let ptr = std::alloc::alloc_zeroed(layout).cast::<BlockNode<T>>();
            if ptr.is_null() {
                std::alloc::handle_alloc_error(layout);
            }
            ptr::addr_of_mut!((*ptr).start).write(index);
            ptr
        }
    }

    /// write index with data
    #[inline]
    fn set(&self, id: usize, v: T) {
        debug_assert!(id < BLOCK_SIZE);
        unsafe {
            let data = self.data.get_unchecked(id);
            data.value.get().write(MaybeUninit::new(v));

            std::sync::atomic::fence(Ordering::Release);
            // mark the data ready
            data.ready.store(1, Ordering::Release);
        }
    }

    #[inline]
    fn try_get(&self, id: usize) -> Option<T> {
        debug_assert!(id < BLOCK_SIZE);
        let data = unsafe { self.data.get_unchecked(id) };
        if data.ready.load(Ordering::Acquire) != 0 {
            Some(unsafe { data.value.get().read().assume_init() })
        } else {
            None
        }
    }

    #[inline]
    fn get(&self, id: usize) -> T {
        debug_assert!(id < BLOCK_SIZE);
        let data = unsafe { self.data.get_unchecked(id) };
        while data.ready.load(Ordering::Acquire) == 0 {
            std::hint::spin_loop();
        }
        unsafe { data.value.get().read().assume_init() }
    }

    /// peek the indexed value
    /// not safe if pop out a value when hold the data ref
    #[inline]
    unsafe fn peek(&self, id: usize) -> &T {
        let data = unsafe { self.data.get_unchecked(id) };
        while data.ready.load(Ordering::Acquire) == 0 {
            std::hint::spin_loop();
        }
        (*data.value.get()).assume_init_ref()
    }

    #[inline]
    fn wait_next_block(&self) -> *mut BlockNode<T> {
        let mut next: *mut BlockNode<T> = self.next.load(Ordering::Acquire);
        while next.is_null() {
            std::hint::spin_loop();
            next = self.next.load(Ordering::Acquire);
        }
        next
    }

    #[inline]
    fn copy_to_bulk(&self, start: usize, end: usize) -> SmallVec<[T; BLOCK_SIZE]> {
        let len = end - start;
        let start = start & BLOCK_MASK;
        SmallVec::from_iter((start..start + len).map(|i| self.get(i)))
    }
}

/// return the bulk end with in the block
#[inline]
fn bulk_end(start: usize, end: usize) -> usize {
    let block_end = (start + BLOCK_SIZE) & !BLOCK_MASK;
    cmp::min(end, block_end)
}

/// A position in a queue.
#[derive(Debug)]
struct Position<T> {
    /// The index in the queue.
    index: AtomicUsize,

    /// The block in the linked list.
    block: AtomicPtr<BlockNode<T>>,
}

impl<T> Position<T> {
    fn new(block: *mut BlockNode<T>) -> Self {
        Position {
            index: AtomicUsize::new(0),
            block: AtomicPtr::new(block),
        }
    }
}

#[derive(Debug)]
struct BlockPtr<T>(AtomicPtr<BlockNode<T>>);

impl<T> BlockPtr<T> {
    #[inline]
    fn new(block: *mut BlockNode<T>) -> Self {
        BlockPtr(AtomicPtr::new(block))
    }

    #[inline]
    fn unpack(ptr: *mut BlockNode<T>) -> (*mut BlockNode<T>, usize) {
        let index = ptr.addr() & BLOCK_MASK;
        (ptr.map_addr(|a| a & !BLOCK_MASK), index)
    }

    #[inline]
    fn pack(ptr: *const BlockNode<T>, index: usize) -> *mut BlockNode<T> {
        ptr.cast_mut().map_addr(|a| a | index)
    }
}

/// mpsc unbounded queue
#[derive(Debug)]
pub struct Queue<T> {
    // -----------------------------------------
    // use for push
    tail: CachePadded<BlockPtr<T>>,

    // ----------------------------------------
    // use for pop
    head: Position<T>,
    // used to delay the drop of the old block
    old_block: AtomicPtr<BlockNode<T>>,

    /// Indicates that dropping a `Queue<T>` may drop values of type `T`.
    _marker: PhantomData<T>,
}

unsafe impl<T: Send> Send for Queue<T> {}
unsafe impl<T: Send> Sync for Queue<T> {}

// the old_block prevent RefUnwindSafe
impl<T> std::panic::RefUnwindSafe for Queue<T> {}

impl<T> Queue<T> {
    /// create a spsc queue
    pub fn new() -> Self {
        let init_block = BlockNode::new_box(0);
        let next_block = BlockNode::new_box(BLOCK_SIZE);
        unsafe { &*init_block }
            .next
            .store(next_block, Ordering::Relaxed);
        Queue {
            head: Position::new(init_block),
            tail: BlockPtr::new(init_block).into(),
            old_block: AtomicPtr::new(ptr::null_mut()),
            _marker: PhantomData,
        }
    }

    /// push a value to the back of queue
    pub fn push(&self, v: T) {
        let backoff = Backoff::new();
        let mut tail = self.tail.0.load(Ordering::Acquire);

        loop {
            tail = tail.map_addr(|a| a & !(1 << 63));
            // the block may be stale, only dereference it after the CAS succeeds
            let (block_ptr, id) = BlockPtr::unpack(tail);

            let new_tail = if id < BLOCK_MASK {
                BlockPtr::pack(block_ptr, id + 1)
            } else {
                tail.map_addr(|a| a | (1 << 63))
            };

            match self.tail.0.compare_exchange_weak(
                tail,
                new_tail,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    let block = unsafe { &*block_ptr };
                    // set the data
                    block.set(id, v);
                    // the block may be released here by the consumer,
                    // so we need to use old_block to delay the drop
                    if id == BLOCK_MASK {
                        let new_block = BlockNode::new_box(block.start + BLOCK_SIZE * 2);
                        let next_block = block.wait_next_block();
                        // install the next-next block
                        unsafe { &*next_block }
                            .next
                            .store(new_block, Ordering::Release);
                        self.tail.0.store(next_block, Ordering::Release);
                    }
                    return;
                }
                Err(old) => {
                    tail = old;
                    backoff.spin();
                }
            }
        }
    }

    #[inline]
    fn push_index(&self) -> usize {
        let tail = self.tail.0.load(Ordering::Acquire);
        let (tail_block, id) = BlockPtr::unpack(tail);
        let tail_block = tail_block.map_addr(|a| a & !(1 << 63));
        unsafe { &*tail_block }.start + id
    }

    /// pop from the queue, if it's empty return None
    pub fn pop(&self) -> Option<T> {
        let head_ptr = unsafe { self.head.block.unsync_load() };
        let head = unsafe { &*head_ptr };
        let pop_index = unsafe { self.head.index.unsync_load() };
        let id = pop_index & BLOCK_MASK;

        // get the data
        let data = match head.try_get(id) {
            Some(v) => v,
            None => {
                if pop_index >= self.push_index() {
                    return None;
                } else {
                    head.get(id)
                }
            }
        };

        self.head.index.store(pop_index + 1, Ordering::Relaxed);

        if id == BLOCK_MASK {
            // we need to delay the drop of the block to let the push's `wait_next_block` return
            self.swap_and_free_old_block(head_ptr);

            let next_block = head.wait_next_block();
            self.head.block.store(next_block, Ordering::Relaxed);
        }

        Some(data)
    }

    /// fast pop from the queue, if it's empty return None, or else return `SmallVec<[T; BLOCK_SIZE]>`
    /// don't check the push index, but only the ready flag
    #[inline]
    fn fast_bulk_pop(
        &self,
        index: usize,
        head_ptr: *mut BlockNode<T>,
    ) -> SmallVec<[T; BLOCK_SIZE]> {
        let head = unsafe { &*head_ptr };
        // only pop within a block
        let bloc
```

### Core Architecture Module: `may_queue/src/mpsc_list.rs`
```
use std::cell::UnsafeCell;
use std::ptr;
use std::sync::atomic::{AtomicPtr, Ordering};

use crossbeam_utils::{Backoff, CachePadded};

struct Node<T> {
    next: AtomicPtr<Node<T>>,
    value: Option<T>,
}

impl<T> Node<T> {
    unsafe fn new(v: Option<T>) -> *mut Node<T> {
        Box::into_raw(Box::new(Node {
            next: AtomicPtr::new(ptr::null_mut()),
            value: v,
        }))
    }
}

/// The multi-producer single-consumer structure. This is not cloneable, but it
/// may be safely shared so long as it is guaranteed that there is only one
/// popper at a time (many pushers are allowed).
pub struct Queue<T> {
    head: CachePadded<AtomicPtr<Node<T>>>,
    tail: UnsafeCell<*mut Node<T>>,
}

unsafe impl<T: Send> Send for Queue<T> {}
unsafe impl<T: Send> Sync for Queue<T> {}

impl<T> Queue<T> {
    /// Creates a new queue that is safe to share among multiple producers and
    /// one consumer.
    pub fn new() -> Queue<T> {
        let stub = unsafe { Node::new(None) };
        Queue {
            head: AtomicPtr::new(stub).into(),
            tail: UnsafeCell::new(stub),
        }
    }

    pub fn push(&self, t: T) {
        unsafe {
            let node = Node::new(Some(t));
            let prev = self.head.swap(node, Ordering::AcqRel);
            (*prev).next.store(node, Ordering::Release);
        }
    }

    /// if the queue is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        let tail = unsafe { *self.tail.get() };
        // the list is empty
        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
    }

    /// Pops some data from this queue.
    pub fn pop(&self) -> Option<T> {
        unsafe {
            let tail = *self.tail.get();

            // the list is empty
            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                return None;
            }

            // spin until tail next become non-null
            let mut next;
            let backoff = Backoff::new();
            loop {
                next = (*tail).next.load(Ordering::Acquire);
                if !next.is_null() {
                    break;
                }
                backoff.snooze();
            }
            // value is not an atomic operation it may read out old shadow value
            // assert!((*tail).value.is_none());
            assert!((*next).value.is_some());
            // we tack the next value, this is why use option to host the value
            let ret = (*next).value.take().unwrap();
            let _: Box<Node<T>> = Box::from_raw(tail);

            // move the tail to next
            *self.tail.get() = next;

            Some(ret)
        }
    }
}

impl<T> Default for Queue<T> {
    fn default() -> Self {
        Queue::new()
    }
}

impl<T> Drop for Queue<T> {
    fn drop(&mut self) {
        while self.pop().is_some() {}
        // release the stub
        let _: Box<Node<T>> = unsafe { Box::from_raw(*self.tail.get()) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_queue() {
        let q: Queue<usize> = Queue::new();
        assert_eq!(q.pop(), None);
        q.push(1);
        q.push(2);
        assert_eq!(q.pop(), Some(1));
        assert_eq!(q.pop(), Some(2));
        assert!(q.is_empty());
    }

    #[test]
    fn test() {
        let nthreads = 8;
        let nmsgs = 1000;
        let q = Queue::new();
        match q.pop() {
            None => {}
            Some(..) => panic!(),
        }
        let (tx, rx) = channel();
        let q = Arc::new(q);

        for _ in 0..nthreads {
            let tx = tx.clone();
            let q = q.clone();
            thread::spawn(move || {
                for i in 0..nmsgs {
                    q.push(i);
                }
                tx.send(()).unwrap();
            });
        }

        let mut i = 0;
        while i < nthreads * nmsgs {
            match q.pop() {
                None => {}
                Some(_) => i += 1,
            }
        }
        drop(tx);
        for _ in 0..nthreads {
            rx.recv().unwrap();
        }
    }
}

#[cfg(all(nightly, test))]
mod bench {
    extern crate test;
    use self::test::Bencher;
    use super::*;

    use std::sync::Arc;
    use std::thread;

    use crate::test_queue::ScBlockPop;

    impl<T: Send> ScBlockPop<T> for super::Queue<T> {
        fn block_pop(&self) -> T {
            let backoff = Backoff::new();
            loop {
                match self.pop() {
                    Some(v) => return v,
                    None => backoff.snooze(),
                }
            }
        }
    }

    #[test]
    fn queue_sanity() {
        let q = Queue::<usize>::new();
        assert!(q.is_empty());
        for i in 0..100 {
            q.push(i);
        }
        // assert_eq!(q.len(), 100);
        // println!("{q:?}");

        for i in 0..100 {
            assert_eq!(q.pop(), Some(i));
        }
        assert_eq!(q.pop(), None);
        assert!(q.is_empty());
    }

    #[bench]
    fn single_thread_test(b: &mut Bencher) {
        let q = Queue::new();
        let mut i = 0;
        b.iter(|| {
            q.push(i);
            assert_eq!(q.pop(), Some(i));
            i += 1;
        });
    }

    #[bench]
    fn multi_1p1c_test(b: &mut Bencher) {
        b.iter(|| {
            let q = Arc::new(Queue::new());
            let total_work: usize = if cfg!(miri) { 200 } else { 1_000_000 };
            // create worker threads that generate mono increasing index
            let _q = q.clone();
            // in other thread the value should be still 100
            thread::spawn(move || {
                for i in 0..total_work {
                    _q.push(i);
                }
            });

            for i in 0..total_work {
                let v = q.block_pop();
                assert_eq!(i, v);
            }
        });
    }

    #[bench]
    fn multi_2p1c_test(b: &mut Bencher) {
        b.iter(|| {
            let q = Arc::new(Queue::new());
            let total_work: usize = if cfg!(miri) { 200 } else { 1_000_000 };
            // create worker threads that generate mono increasing index
            // in other thread the value should be still 100
            let mut total = 0;

            thread::scope(|s| {
                let threads = 20;
                for i in 0..threads {
                    let q = q.clone();
                    s.spawn(move || {
                        let len = total_work / threads;
                        let start = i * len;
                        for v in start..start + len {
                            q.push(v);
                        }
                    });
                }
                s.spawn(|| {
                    for _ in 0..total_work {
                        total += q.block_pop();
                    }
                });
            });
            assert!(q.is_empty());
            assert_eq!(total, (0..total_work).sum::<usize>());
        });
    }

    // #[bench]
    // fn bulk_1p2c_test(b: &mut Bencher) {
    //     b.iter(|| {
    //         let q = Arc::new(Queue::new());
    //         let total_work: usize = 1_000_000;
    //         // create worker threads that generate mono increasing index
    //         // in other thread the value should be still 100
    //         for i in 0..total_work {
    //             q.push(i);
    //         }

    //         let total = Arc::new(AtomicUsize::new(0));

    //         thread::scope(|s| {
    //             let threads = 20;
    //             for _ in 0..threads {
    //                 let q = q.clone();
    //                 let total = total.clone();
    //                 s.spawn(move || {
    //                     while !q.is_empty() {
    //                         if let Some(v) = q.bulk_pop() {
    //                             total.fetch_add(v.len(), Ordering::AcqRel);
    //                         }
    //                     }
    //                 });
    //             }
    //         });
    //         assert!(q.is_empty());
    //         assert_eq!(total.load(Ordering::Acquire), total_work);
    //     });
    // }
}

```

### Core Architecture Module: `may_queue/src/mpsc_list_v1.rs`
```
use std::cell::Cell;
use std::marker::PhantomData;
use std::ptr;
use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};
use std::sync::Arc;

use crossbeam_utils::atomic::AtomicCell;
use crossbeam_utils::{Backoff, CachePadded};

struct Node<T> {
    next: AtomicPtr<Node<T>>,
    // The cell itself is the ownership token between the single consumer
    // (`pop`/`pop_if`) and the `Entry` handles (`with_mut_data`/`remove`),
    // which may run on different threads: a value is taken out with an atomic
    // swap, so only one of them can own it at a time. Taking the value out
    // temporarily is also how `with_mut_data` gets exclusive access to it.
    value: AtomicCell<Option<T>>,
    refs: AtomicUsize,
}
// linked bit is MSB, ref count is 2 for handle and list
const REF_INIT: usize = 0x1000_0002;
const REF_COUNT_MASK: usize = 0x0FFF_FFFF;

impl<T> Node<T> {
    fn new(v: Option<T>) -> *mut Node<T> {
        Box::into_raw(Box::new(Node {
            next: AtomicPtr::new(ptr::null_mut()),
            value: AtomicCell::new(v),
            refs: AtomicUsize::new(REF_INIT),
        }))
    }

    /// true if the value was not taken out permanently yet
    #[inline]
    fn is_linked(&self) -> bool {
        self.refs.load(Ordering::Acquire) & !REF_COUNT_MASK != 0
    }

    /// Takes the value out of the node.
    ///
    /// Returns `None` if the value is permanently gone (the node was popped or
    /// removed). A value that another thread holds transiently (a concurrent
    /// `pop`, `with_mut_data` or `remove`) is waited for and taken once it is
    /// put back.
    fn take_value(&self) -> Option<ValueGuard<'_, T>> {
        let backoff = Backoff::new();
        loop {
            if let Some(value) = self.value.take() {
                return Some(ValueGuard {
                    node: self,
                    value: Some(value),
                });
            }
            if !self.is_linked() {
                return None;
            }
            backoff.snooze();
        }
    }
}

/// Puts a value taken from a node back unless the caller commits it.
struct ValueGuard<'a, T> {
    node: &'a Node<T>,
    value: Option<T>,
}

impl<T> ValueGuard<'_, T> {
    #[inline]
    fn as_mut(&mut self) -> &mut T {
        self.value.as_mut().unwrap()
    }

    /// Keep the value instead of putting it back.
    #[inline]
    fn commit(mut self) -> T {
        self.value.take().unwrap()
    }
}

impl<T> Drop for ValueGuard<'_, T> {
    #[inline]
    fn drop(&mut self) {
        if let Some(value) = self.value.take() {
            self.node.value.store(Some(value));
        }
    }
}

pub struct Entry<T>(ptr::NonNull<Node<T>>);

// like `Mutex<T>`, the handle grants exclusive access to the value through
// `with_mut_data`, so the value only needs to be `Send` to share the handle
unsafe impl<T: Send> Sync for Entry<T> {}

impl<T> Entry<T> {
    /// get the internal data mut ref
    ///
    /// Returns `false` without calling `f` if the value has already been taken
    /// by the consumer (the node was popped) or by `remove`. This is safe to
    /// call while the consumer is popping the node: the value is moved out for
    /// the duration of `f`, so a handle can disarm an entry that the consumer
    /// may be taking at the same time.
    ///
    /// The value is put back when `f` returns or panics. `f` must not call back
    /// into the queue, it would wait for the value that is currently taken out.
    #[inline]
    pub fn with_mut_data<F>(&self, f: F) -> bool
    where
        F: FnOnce(&mut T),
    {
        // SAFETY: `self` keeps the node alive, and `take_value` hands the value
        // out to at most one caller at a time
        match unsafe { self.0.as_ref() }.take_value() {
            Some(mut guard) => {
                f(guard.as_mut());
                // the guard puts the value back
                true
            }
            None => false,
        }
    }

    /// judge if the node is still linked in the list
    #[inline]
    pub fn is_link(&self) -> bool {
        // SAFETY: `self` keeps the node alive
        unsafe { self.0.as_ref() }.is_linked()
    }

    #[inline]
    pub fn into_ptr(self) -> *mut Self {
        let ret = self.0.as_ptr() as *mut Self;
        ::std::mem::forget(self);
        ret
    }

    #[inline]
    /// # Safety
    ///
    /// Must use the ptr that from `Entry::into_ptr`
    pub unsafe fn from_ptr(ptr: *mut Self) -> Self {
        Entry(ptr::NonNull::new_unchecked(ptr as *mut Node<T>))
    }

    // remove the entry from it's list and return the contained value
    //
    // The value is claimed with an atomic swap and the node is only marked as
    // removed (its link bit is cleared); it stays linked until the consumer
    // reaches it, which retires it. The list reference is released by the
    // consumer, so a concurrent `pop` can't free the node while this side is
    // still touching it, and any number of handles may remove concurrently.
    pub fn remove(self) -> Option<T> {
        let node = unsafe { self.0.as_ref() };

        // claim the value: if it is gone, the consumer already popped the
        // node and there is nothing left to do
        let guard = node.take_value()?;

        // the newest node has no `next`; removing it would mean updating
        // the queue head, so leave it in the list (and leave its value to
        // the consumer, the guard puts it back)
        //
        // this is mainly used in the timer list, so it's rarely
        // the next is not contention for that we have wait some time already
        // leave the last node not removed also persist the queue for a while
        // that prevent frequent queue create and destroy
        if node.next.load(Ordering::Acquire).is_null() {
            return None;
        }

        // clear the link bit so `pop` retires the node instead of
        // delivering it; the list reference is released when the consumer
        // advances past it
        node.refs.fetch_and(REF_COUNT_MASK, Ordering::AcqRel);

        Some(guard.commit())
    }
}

impl<T> Drop for Entry<T> {
    // the node is released exactly when the last reference goes away: the
    // list reference is held until the consumer retires the node, so this can
    // run on any thread without freeing a node another thread is using
    fn drop(&mut self) {
        // SAFETY: this handle keeps the node alive until the count drops to 0
        let node = unsafe { self.0.as_ref() };
        if node.refs.fetch_sub(1, Ordering::AcqRel) == 1 {
            // SAFETY: the last reference is gone, no other thread can use it
            let _: Box<Node<T>> = unsafe { Box::from_raw(self.0.as_ptr()) };
        }
    }
}

unsafe impl<T: Send> Send for Entry<T> {}

/// Create a multi-producer single-consumer queue.
///
/// The returned [`Sender`] can be cloned and used from any thread. The
/// [`Receiver`] is not cloneable and not `Sync`, so the consuming operations
/// (`pop`/`pop_if`/`peek_with`) can only be used by the thread that owns the
/// receiver, or through a lock.
pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
    let inner = Arc::new(Inner::new());
    (Sender(Arc::clone(&inner)), Receiver(inner, PhantomData))
}

/// The multi-producer handle.
///
/// `Sender` is cloneable, and `push` may be called from any thread.
pub struct Sender<T>(Arc<Inner<T>>);

impl<T> Clone for Sender<T> {
    #[inline]
    fn clone(&self) -> Self {
        Sender(Arc::clone(&self.0))
    }
}

impl<T> Sender<T> {
    /// Pushes a new value onto this queue.
    /// if the new node is head, indicate a true
    /// this is used to update the BH if it's a new head
    #[inline]
    pub fn push(&self, t: T) -> (Entry<T>, bool) {
        self.0.push(t)
    }
}

/// The single-consumer handle.
///
/// The receiver is not cloneable and not `Sync`, so there is exactly one handle
/// that can take values out of the queue, and it can only be used by one thread
/// at a time. It is `Send` and may be moved to the consuming thread.
pub struct Receiver<T>(Arc<Inner<T>>, PhantomData<Cell<()>>);

impl<T> Receiver<T> {
    /// if the queue is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// call `f` with the head value
    ///
    /// Removed nodes (tombstones) are skipped, so this returns the first value
    /// that is still queued instead of `None` for a node that `remove` already
    /// claimed. The value is taken out while `f` runs, and put back afterwards.
    ///
    /// Note that `f` must not call back into this queue, it would wait for the
    /// value that is currently taken out.
    #[inline]
    pub fn peek_with<F, R>(&self, f: F) -> Option<R>
    where
        F: FnOnce(&T) -> R,
    {
        self.0.peek_with(f)
    }

    /// Pops some data from this queue.
    #[inline]
    pub fn pop(&self) -> Option<T> {
        self.0.pop()
    }

    /// Pops the head value if the supplied predicate accepts it.
    #[inline]
    pub fn pop_if<F>(&self, f: &F) -> Option<T>
    where
        F: Fn(&T) -> bool,
    {
        self.0.pop_if(f)
    }
}

// the shared queue state behind a `Sender`/`Receiver` pair
struct Inner<T> {
    head: CachePadded<AtomicPtr<Node<T>>>,
    // only written by the consumer, but read by the producers
    tail: AtomicPtr<Node<T>>,
}

unsafe impl<T: Send> Send for Inner<T> {}
unsafe impl<T: Send> Sync for Inner<T> {}

impl<T> Inner<T> {
    /// Creates a new queue that is safe to share among multiple producers and
    /// one consumer.
    fn new() -> Inner<T> {
        let stub = Node::new(None);
        // there is no handle for the node, so it's ref should be 1 now
        // SAFETY: `stub` was just allocated
        unsafe { &*stub }.refs.store(1, Ordering::Relaxed);
        Inner {
            head: AtomicPtr::new(stub).into(),
            tail: AtomicPtr::new(stub),
        }
    }

    fn push(&self, t: T) -> (Entry<T>, bool) {
        let node = Node::new(Some(t));
   
```

### Core Architecture Module: `may_queue/src/spmc.rs`
```
use crossbeam_utils::{Backoff, CachePadded};
use smallvec::SmallVec;

use crate::atomic::{AtomicPtr, AtomicUsize};

use std::cell::UnsafeCell;
use std::marker::PhantomData;
use std::mem::MaybeUninit;
use std::ptr;
use std::sync::atomic::Ordering;
use std::sync::Arc;

// size for block_node
pub const BLOCK_SIZE: usize = 1 << BLOCK_SHIFT;
// block mask
pub const BLOCK_MASK: usize = BLOCK_SIZE - 1;
// block shift
pub const BLOCK_SHIFT: usize = 5;

/// A slot in a block.
struct Slot<T> {
    /// The value.
    value: UnsafeCell<MaybeUninit<T>>,
}

/// a block node contains a bunch of items stored in a array
/// this could make the malloc/free not that frequent, also
/// the array could speed up list operations
#[repr(align(32))]
struct BlockNode<T> {
    data: [Slot<T>; BLOCK_SIZE],
    used: AtomicUsize,
    next: AtomicPtr<BlockNode<T>>,
    start: AtomicUsize, // start index of the block
}

/// we don't implement the block node Drop trait
/// the queue is responsible to drop all the items
/// and would call its get() method for the dropping
impl<T> BlockNode<T> {
    /// Allocate the block directly on the heap.
    ///
    /// `Box::new(BlockNode { .. })` first materialises the whole node -
    /// BLOCK_SIZE slots of `T` - on the caller's stack and then moves it to
    /// the heap. With a large `T` on a small coroutine stack that is a
    /// guard-page hit at an arbitrary push, and a coroutine killed by stack
    /// overflow does not unwind, so the queue is left corrupted mid-push
    /// and every later consumer blocks forever.
    ///
    /// `alloc_zeroed` never touches the stack: zeroed memory is a valid
    /// state for every field here (atomics at 0 / null, `MaybeUninit`
    /// slots), and any non-zero field is written through a raw pointer, so
    /// no `BlockNode` value ever exists on the stack. Blocks are freed with
    /// `Box::from_raw`, which pairs with the global allocator used here.
    fn new(index: usize) -> *mut BlockNode<T> {
        unsafe {
            let layout = std::alloc::Layout::new::<BlockNode<T>>();
            let ptr = std::alloc::alloc_zeroed(layout).cast::<BlockNode<T>>();
            if ptr.is_null() {
                std::alloc::handle_alloc_error(layout);
            }
            ptr::addr_of_mut!((*ptr).used).write(AtomicUsize::new(BLOCK_SIZE));
            ptr::addr_of_mut!((*ptr).start).write(AtomicUsize::new(index));
            ptr
        }
    }

    /// write index with data
    #[inline]
    fn set(&self, index: usize, v: T) {
        unsafe {
            let data = self.data.get_unchecked(index & BLOCK_MASK);
            data.value.get().write(MaybeUninit::new(v));
        }
    }

    /// read out indexed value
    /// this would make the underlying data dropped when it get out of scope
    #[inline]
    fn get(&self, id: usize) -> T {
        debug_assert!(id < BLOCK_SIZE);
        unsafe {
            let data = self.data.get_unchecked(id);
            data.value.get().read().assume_init()
        }
    }

    /// make a range slots read
    /// if all slots read, then we can safely free the block
    #[inline]
    fn mark_slots_read(&self, size: usize) -> bool {
        // AcqRel so the thread that frees the block sees all the reads from the other threads
        let old = self.used.fetch_sub(size, Ordering::AcqRel);
        old == size
    }

    #[inline]
    fn copy_to_bulk(&self, start: usize, end: usize) -> SmallVec<[T; BLOCK_SIZE]> {
        let len = end - start;
        let start = start & BLOCK_MASK;
        (start..start + len).map(|id| self.get(id)).collect()
    }
}

/// A position in a queue.
#[derive(Debug)]
struct Position<T> {
    /// The index in the queue.
    index: AtomicUsize,

    /// The block in the linked list.
    block: AtomicPtr<BlockNode<T>>,
}

impl<T> Position<T> {
    fn new(block: *mut BlockNode<T>) -> Self {
        Position {
            index: AtomicUsize::new(0),
            block: AtomicPtr::new(block),
        }
    }
}

#[derive(Debug)]
struct BlockPtr<T>(AtomicPtr<BlockNode<T>>);

impl<T> BlockPtr<T> {
    #[inline]
    fn new(block: *mut BlockNode<T>) -> Self {
        BlockPtr(AtomicPtr::new(block))
    }

    #[inline]
    fn unpack(ptr: *mut BlockNode<T>) -> (*mut BlockNode<T>, usize) {
        let index = ptr.addr() & BLOCK_MASK;
        (ptr.map_addr(|a| a & !BLOCK_MASK), index)
    }

    #[inline]
    fn pack(ptr: *const BlockNode<T>, index: usize) -> *mut BlockNode<T> {
        ptr.cast_mut().map_addr(|a| a | index)
    }
}

/// spmc unbounded queue
#[derive(Debug)]
pub struct Queue<T> {
    // ----------------------------------------
    // use for pop
    head: CachePadded<BlockPtr<T>>,

    // -----------------------------------------
    // use for push
    tail: CachePadded<Position<T>>,

    /// Indicates that dropping a `Queue<T>` may drop values of type `T`.
    _marker: PhantomData<T>,
}

unsafe impl<T: Send> Send for Queue<T> {}
unsafe impl<T: Send> Sync for Queue<T> {}

impl<T> Queue<T> {
    /// create a spsc queue
    pub fn new() -> Self {
        let init_block = BlockNode::<T>::new(0);
        Queue {
            head: BlockPtr::new(init_block).into(),
            tail: Position::new(init_block).into(),
            _marker: PhantomData,
        }
    }

    /// push a value to the back of queue
    pub fn push(&self, v: T) {
        let tail = unsafe { &*self.tail.block.unsync_load() };
        let push_index = unsafe { self.tail.index.unsync_load() };
        // store the data
        tail.set(push_index, v);
        // need this to make sure the data is stored before the index is updated
        std::sync::atomic::fence(Ordering::Release);

        // alloc new block node if the tail is full
        let new_index = push_index.wrapping_add(1);
        if new_index & BLOCK_MASK == 0 {
            let new_tail = BlockNode::new(new_index);
            // when other thread access next, we already Acquire the container node
            tail.next.store(new_tail, Ordering::Release);
            self.tail.block.store(new_tail, Ordering::Relaxed);
        }

        // commit the push
        self.tail.index.store(new_index, Ordering::Release);
    }

    /// pop from the queue, if it's empty return None
    pub fn pop(&self) -> Option<T> {
        let backoff = Backoff::new();
        let mut head = self.head.0.load(Ordering::Acquire);
        let mut push_index = self.tail.index.load(Ordering::Acquire);
        let mut tail_block = self.tail.block.load(Ordering::Acquire);

        loop {
            head = head.map_addr(|a| a & !(1 << 63));
            let (block, id) = BlockPtr::unpack(head);
            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                return None;
            }

            let new_head = if id != BLOCK_MASK {
                BlockPtr::pack(block, id + 1)
            } else {
                head.map_addr(|a| a | (1 << 63))
            };

            // commit the pop
            match self.head.0.compare_exchange_weak(
                head,
                new_head,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    // the block may be stale before the CAS, only deref it after success
                    let block_ptr = block;
                    let block = unsafe { &*block_ptr };
                    let block_start = block.start.load(Ordering::Relaxed);
                    let pop_index = block_start + id;
                    if id == BLOCK_MASK {
                        push_index = self.tail.index.load(Ordering::Acquire);
                        // we need to check if there is enough data
                        if pop_index >= push_index {
                            // recover the old head, and return None
                            self.head.0.store(head, Ordering::Release);
                            return None;
                        }

                        let next = block.next.load(Ordering::Acquire);
                        self.head.0.store(next, Ordering::Release);
                    } else {
                        // we have to wait if there is enough data
                        // if no any more produce, this will be a dead loop
                        while pop_index >= self.tail.index.load(Ordering::Acquire) {
                            std::thread::sleep(std::time::Duration::from_millis(10));
                        }
                    }
                    // get the data
                    let v = block.get(id);

                    if block.mark_slots_read(1) {
                        // we need to free the old block
                        let _unused_block = unsafe { Box::from_raw(block_ptr) };
                    }
                    return Some(v);
                }
                Err(i) => {
                    head = i;
                    backoff.spin();
                    push_index = self.tail.index.load(Ordering::Acquire);
                    tail_block = self.tail.block.load(Ordering::Acquire);
                }
            }
        }
    }

    /// pop from the queue, if it's empty return None
    fn local_pop(&self) -> Option<T> {
        let backoff = Backoff::new();
        let mut head = self.head.0.load(Ordering::Acquire);
        // this is used for local pop, we can sure that push_index is not changed
        let push_index = unsafe { self.tail.index.unsync_load() };
        let tail_block = unsafe { self.tail.block.unsync_load() };

        loop {
            head = head.map_addr(|a| a & !(1 << 63));
            let (block, id) = BlockPtr::unpack(head);
            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                return None;
            }

            let new_head = if id != BLOCK_MASK {
                BlockPtr::pack(block, id + 1)
            } else {
                head.map_addr(|a| a | (1 << 63))
            };

            // commit the pop
           
```

### Core Architecture Module: `may_queue/src/spsc.rs`
```
use crossbeam_utils::CachePadded;
use smallvec::SmallVec;

use crate::atomic::{AtomicPtr, AtomicUsize};

use std::cell::Cell;
use std::cell::UnsafeCell;
use std::cmp;
use std::marker::PhantomData;
use std::mem::MaybeUninit;
use std::ptr;
use std::sync::atomic::Ordering;
use std::sync::Arc;

// size for block_node
pub const BLOCK_SIZE: usize = 1 << BLOCK_SHIFT;
// block mask
pub const BLOCK_MASK: usize = BLOCK_SIZE - 1;
// block shift
pub const BLOCK_SHIFT: usize = 5;

/// A slot in a block.
struct Slot<T> {
    /// The value.
    value: UnsafeCell<MaybeUninit<T>>,
}

/// a block node contains a bunch of items stored in a array
/// this could make the malloc/free not that frequent, also
/// the array could speed up list operations
struct BlockNode<T> {
    data: [Slot<T>; BLOCK_SIZE],
    next: AtomicPtr<BlockNode<T>>,
}

/// we don't implement the block node Drop trait
/// the queue is responsible to drop all the items
/// and would call its get() method for the dropping
impl<T> BlockNode<T> {
    /// Allocate the block directly on the heap.
    ///
    /// `Box::new(BlockNode { .. })` first materialises the whole node -
    /// BLOCK_SIZE slots of `T` - on the caller's stack and then moves it to
    /// the heap. With a large `T` on a small coroutine stack that is a
    /// guard-page hit at an arbitrary push, and a coroutine killed by stack
    /// overflow does not unwind, so the queue is left corrupted mid-push
    /// and every later consumer blocks forever.
    ///
    /// `alloc_zeroed` never touches the stack: zeroed memory is a valid
    /// state for every field here (atomics at 0 / null, `MaybeUninit`
    /// slots), and any non-zero field is written through a raw pointer, so
    /// no `BlockNode` value ever exists on the stack. Blocks are freed with
    /// `Box::from_raw`, which pairs with the global allocator used here.
    fn new() -> *mut BlockNode<T> {
        unsafe {
            let layout = std::alloc::Layout::new::<BlockNode<T>>();
            let ptr = std::alloc::alloc_zeroed(layout).cast::<BlockNode<T>>();
            if ptr.is_null() {
                std::alloc::handle_alloc_error(layout);
            }
            ptr
        }
    }

    /// write index with data
    #[inline]
    fn set(&self, index: usize, v: T) {
        unsafe {
            let data = self.data.get_unchecked(index & BLOCK_MASK);
            data.value.get().write(MaybeUninit::new(v));
        }
        // make sure the data is stored before the index is updated
        std::sync::atomic::fence(Ordering::Release);
    }

    /// peek the indexed value
    /// not safe if pop out a value when hold the data ref
    #[inline]
    unsafe fn peek(&self, index: usize) -> &T {
        let data = self.data.get_unchecked(index & BLOCK_MASK);
        (*data.value.get()).assume_init_ref()
    }

    /// read out indexed value
    /// this would make the underlying data dropped when it get out of scope
    #[inline]
    fn get(&self, id: usize) -> T {
        debug_assert!(id < BLOCK_SIZE);
        unsafe {
            let data = self.data.get_unchecked(id);
            data.value.get().read().assume_init()
        }
    }

    #[inline]
    fn copy_to_bulk(&self, start: usize, end: usize) -> SmallVec<[T; BLOCK_SIZE]> {
        let len = end - start;
        let start = start & BLOCK_MASK;
        (start..start + len).map(|id| self.get(id)).collect()
    }
}

/// return the bulk end with in the block
#[inline]
fn bulk_end(start: usize, end: usize) -> usize {
    let block_end = (start + BLOCK_SIZE) & !BLOCK_MASK;
    cmp::min(end, block_end)
}

/// A position in a queue.
#[derive(Debug)]
struct Position<T> {
    /// The index in the queue.
    index: AtomicUsize,

    /// The block in the linked list.
    block: AtomicPtr<BlockNode<T>>,
}

impl<T> Position<T> {
    fn new(block: *mut BlockNode<T>) -> Self {
        Position {
            index: AtomicUsize::new(0),
            block: AtomicPtr::new(block),
        }
    }
}

/// spsc unbounded queue
#[derive(Debug)]
pub struct Queue<T> {
    // -----------------------------------------
    // use for push
    tail: CachePadded<Position<T>>,

    // ----------------------------------------
    // use for pop
    head: Position<T>,

    // only used to track node, updated by producer
    #[cfg(feature = "inner_cache")]
    first: AtomicPtr<BlockNode<T>>,
    // node between first and head, update by producer
    #[cfg(feature = "inner_cache")]
    last_head: AtomicPtr<BlockNode<T>>,

    /// Indicates that dropping a `Queue<T>` may drop values of type `T`.
    _marker: PhantomData<T>,
}

// Sync implementation for Queue does not allow for unsynchronised concurrent push/pop operations.
// unsafe impl<T: Send> Send for Queue<T> {}
// unsafe impl<T: Send> Sync for Queue<T> {}

impl<T> Queue<T> {
    /// create a spsc queue
    pub fn new() -> Self {
        let init_block = BlockNode::<T>::new();
        Queue {
            head: Position::new(init_block),
            tail: Position::new(init_block).into(),
            #[cfg(feature = "inner_cache")]
            first: AtomicPtr::new(init_block),
            #[cfg(feature = "inner_cache")]
            last_head: AtomicPtr::new(init_block),

            _marker: PhantomData,
        }
    }

    #[inline]
    #[cfg(feature = "inner_cache")]
    fn alloc_node(&self) -> *mut BlockNode<T> {
        let first = unsafe { self.first.unsync_load() };
        let mut last_head = unsafe { self.last_head.unsync_load() };
        if !ptr::eq(first, last_head) {
            let next = unsafe { (*first).next.unsync_load() };
            self.first.store(next, Ordering::Relaxed);
            // first.next.store(ptr::null_mut(), Ordering::Relaxed);
            return first;
        }

        // the consumer updates the head concurrently, and has finished reading the blocks before it
        last_head = self.head.block.load(Ordering::Acquire);
        self.last_head.store(last_head, Ordering::Relaxed);

        if !ptr::eq(first, last_head) {
            let next = unsafe { (*first).next.unsync_load() };
            self.first.store(next, Ordering::Relaxed);
            // first.next.store(ptr::null_mut(), Ordering::Relaxed);
            first
        } else {
            BlockNode::new()
        }
    }

    /// push a value to the queue
    pub fn push(&self, v: T) {
        let tail = unsafe { &*self.tail.block.unsync_load() };
        let push_index = unsafe { self.tail.index.unsync_load() };
        // store the data
        tail.set(push_index, v);

        // alloc new block node if the tail is full
        let new_index = push_index.wrapping_add(1);
        if new_index & BLOCK_MASK == 0 {
            #[cfg(not(feature = "inner_cache"))]
            let new_tail = BlockNode::new();
            #[cfg(feature = "inner_cache")]
            let new_tail = self.alloc_node();
            tail.next.store(new_tail, Ordering::Relaxed);
            self.tail.block.store(new_tail, Ordering::Relaxed);
        }

        self.tail.index.store(new_index, Ordering::Release);
    }

    /// peek the head
    ///
    /// # Safety
    ///
    /// not safe if you pop out the head value when hold the data ref
    pub unsafe fn peek(&self) -> Option<&T> {
        let index = self.head.index.unsync_load();
        let push_index = self.tail.index.load(Ordering::Acquire);
        if index == push_index {
            return None;
        }

        let head = &*self.head.block.unsync_load();
        Some(head.peek(index))
    }

    /// pop from the queue, if it's empty return None
    pub fn pop(&self) -> Option<T> {
        let index = unsafe { self.head.index.unsync_load() };
        let push_index = self.tail.index.load(Ordering::Acquire);
        if index == push_index {
            return None;
        }

        let head_ptr = unsafe { self.head.block.unsync_load() };
        let head = unsafe { &*head_ptr };
        // get the data
        let v = head.get(index & BLOCK_MASK);

        let new_index = index.wrapping_add(1);
        // we need to free the old head if it get empty
        if new_index & BLOCK_MASK == 0 {
            let new_head = head.next.load(Ordering::Relaxed);
            // assert!(!new_head.is_null());
            #[cfg(not(feature = "inner_cache"))]
            let _unused_head = unsafe { Box::from_raw(head_ptr) };
            self.head.block.store(new_head, Ordering::Release);
        }

        // commit the pop
        self.head.index.store(new_index, Ordering::Relaxed);

        Some(v)
    }

    /// get the size of queue
    #[inline]
    pub fn len(&self) -> usize {
        let pop_index = self.head.index.load(Ordering::Relaxed);
        let push_index = self.tail.index.load(Ordering::Acquire);
        push_index.wrapping_sub(pop_index)
    }

    /// if the queue is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    // bulk pop as much as possible
    pub fn bulk_pop(&self) -> SmallVec<[T; BLOCK_SIZE]> {
        // self.bulk_pop_expect(0, vec)
        let index = unsafe { self.head.index.unsync_load() };
        let push_index = self.tail.index.load(Ordering::Acquire);
        if index == push_index {
            return SmallVec::new();
        }

        let head_ptr = unsafe { self.head.block.unsync_load() };
        let head = unsafe { &*head_ptr };

        // only pop within a block
        let end = bulk_end(index, push_index);
        let value = head.copy_to_bulk(index, end);

        let new_index = end;

        // free the old block node
        if new_index & BLOCK_MASK == 0 {
            let new_head = head.next.load(Ordering::Relaxed);
            // assert!(!new_head.is_null());
            #[cfg(not(feature = "inner_cache"))]
            let _unused_head = unsafe { Box::from_raw(head_ptr) };
            self.head.block.store(new_head, Ordering::Release);
        }

        // commit the pop
        self.head.index.store(new_index, Ordering::Relaxed);

        value
```

### Core Architecture Module: `src/cqueue.rs`
```
//! A select-style event queue for scoped coroutines.
//!
//! [`scope`] creates a [`Cqueue`]. Each selector added with [`Cqueue::add`]
//! (usually through the `cqueue_add!` / `cqueue_add_oneshot!` macros) runs as
//! a coroutine: its *top half* runs until it calls [`EventSender::send`], which
//! queues an event and suspends the selector. [`Cqueue::poll`] later resumes
//! that selector's *bottom half* on the polling coroutine, so bottom halves
//! run sequentially and only on the poller.
//!
//! # Constraints
//!
//! * Only one coroutine/thread may call [`Cqueue::poll`] on a given cqueue: the
//!   event queue has a single consumer and `to_wake` holds a single waiter.
//! * Selectors must all be registered before polling starts, and the cqueue
//!   has a single owner: [`Cqueue::add`] must not run concurrently with
//!   another `add` or with `poll`. Debug builds assert this.
//! * An [`EventSender`] must only be used from the selector coroutine it was
//!   passed to. It is `Send` because the selector closure captures it, but
//!   `send` yields the *current* coroutine, so using it from another coroutine
//!   would resume the wrong one.
//! * A panic in a selector is re-raised by a later [`Cqueue::poll`], or by
//!   `Drop` after every selector has been cancelled and drained; only the
//!   first selector panic is propagated. If the thread is already unwinding,
//!   the panic is dropped instead of aborting the process.

use std::any::Any;
use std::panic;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::cancel::Cancel;
use crate::coroutine_impl::{
    current_cancel_data, run_coroutine, Coroutine, CoroutineImpl, EventSource,
};
use crate::join::JoinHandle;
use crate::scoped::spawn_unsafe;
use crate::sync::Mutex;
use crate::sync::{AtomicOption, Blocker};
use crate::yield_now::yield_with;

use generator::Error;
use may_queue::mpsc::Queue;

/// The list of possible reasons that `poll` could not return an event.
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
pub enum PollError {
    /// The cqueue has no ready event and the timeout expired; an event may
    /// become available in the future.
    Timeout,

    /// All select coroutines associated with this cqueue have finished, so no
    /// more events can be received unless new select coroutines are added with
    /// [`Cqueue::add`].
    Finished,
}

/// This enumeration is the list of the possible reasons that an event
/// is generated
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum EventKind {
    /// the select coroutine has successfully generated an event from its top
    /// half, so its bottom half can be continued by `poll`
    Normal,

    /// indicates a select coroutine is finished
    Done,
}

/// The event that `poll` returns. Events are generated when a select coroutine
/// reaches [`EventSender::send`] in its top half.
///
/// Returned events never own the coroutine: the bottom half has already run by
/// the time `poll` returns it.
#[derive(Debug)]
pub struct Event {
    /// the token associated with the select coroutine
    pub token: usize,
    /// the select coroutine can use it to pass extra data with the caller
    pub extra: usize,
    /// id of the select coroutine, used internally to locate the JoinHandle
    id: usize,
    /// the event type
    kind: EventKind,
    // the suspended coroutine that will run the bottom half, if any
    co: Option<CoroutineImpl>,
}

impl Event {
    /// continue the select coroutine with its bottom half
    /// when `poll` got a Normal event, should always call it first
    fn continue_bottom(&mut self) {
        if let Some(co) = self.co.take() {
            run_coroutine(co);
        }
    }
}

/// A handle to a select coroutine.
///
/// Dropping the handle does not stop the coroutine: use [`Selector::remove`]
/// to cancel it. Cancellation is asynchronous, so events already queued may
/// still be delivered before the coroutine finishes.
pub struct Selector {
    co: Coroutine,
}

impl Selector {
    /// Terminate the select coroutine.
    ///
    /// This cancels the coroutine; it is removed from the cqueue
    /// asynchronously, once it reaches a cancellation point.
    pub fn remove(self) {
        unsafe { self.co.cancel() };
    }
}

/// Per-selector handle used to communicate with the cqueue.
///
/// Created by [`Cqueue::add`] and passed to the selector closure. It must only
/// be used by that selector coroutine.
pub struct EventSender<'a> {
    // index of the select coroutine
    id: usize,
    // associated token, passed from `add`
    token: usize,
    // the select coroutine can use it to pass extra data to the caller
    extra: AtomicUsize,
    // the mpsc event queue to collect the events
    cqueue: &'a Cqueue,
}

unsafe impl Send for EventSender<'_> {}

impl EventSender<'_> {
    /// Get the token.
    pub fn get_token(&self) -> usize {
        self.token
    }

    /// Publish an event and suspend until `poll` has run the bottom half.
    ///
    /// # Panics
    ///
    /// Panics if called outside a coroutine context.
    pub fn send(&self, extra: usize) {
        let cancel = current_cancel_data();
        cancel.check_cancel();
        self.extra.store(extra, Ordering::Relaxed);
        yield_with(self);
    }
}

impl EventSource for EventSender<'_> {
    fn subscribe(&mut self, co: CoroutineImpl) {
        // Publish before waking: the poller re-checks the queue after
        // registering its blocker, so either order is observed.
        self.cqueue.ev_queue.push(Event {
            id: self.id,
            token: self.token,
            extra: self.extra.load(Ordering::Relaxed),
            kind: EventKind::Normal,
            co: Some(co),
        });
        if let Some(w) = self.cqueue.to_wake.take() {
            w.unpark();
        }
    }

    fn yield_back(&self, _cancel: &'static Cancel) {
        // ignore the cancel to let the bottom half get processed
    }
}

impl Drop for EventSender<'_> {
    // when the select coroutine finishes this drop is triggered
    fn drop(&mut self) {
        self.cqueue.ev_queue.push(Event {
            id: self.id,
            token: self.token,
            extra: self.extra.load(Ordering::Relaxed),
            kind: EventKind::Done,
            co: None,
        });
        // Publish the done event before decrementing `cnt`: the polling side
        // reads `cnt` with acquire ordering and re-checks the queue, so it
        // cannot report `Finished` while this event is still invisible.
        self.cqueue.cnt.fetch_sub(1, Ordering::Release);
        if let Some(w) = self.cqueue.to_wake.take() {
            w.unpark();
        }
    }
}

/// Debug-only guard asserting that a cqueue has a single owner: `add` and
/// `poll` must not run concurrently.
#[cfg(debug_assertions)]
struct BusyGuard<'a>(&'a AtomicBool);

#[cfg(debug_assertions)]
impl<'a> BusyGuard<'a> {
    fn acquire(flag: &'a AtomicBool, what: &str) -> Self {
        if flag.swap(true, Ordering::SeqCst) {
            panic!("Cqueue::{what} called concurrently with add/poll, which is not supported");
        }
        BusyGuard(flag)
    }
}

#[cfg(debug_assertions)]
impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// The event queue for the select model.
///
/// Created by [`scope`]; a single coroutine/thread polls it while the select
/// coroutines publish events.
pub struct Cqueue {
    // the mpsc queue that transfers events
    ev_queue: Queue<Event>,
    // thread/coroutine for wake up
    to_wake: AtomicOption<Arc<Blocker>>,
    // track how many coroutines are left
    cnt: AtomicUsize,
    // store the select coroutine handles
    selectors: Mutex<Vec<Option<JoinHandle<()>>>>,
    // total created select coroutines
    total: AtomicUsize,
    // set once a selector panic has escaped through `poll`; later panics are
    // not re-raised
    is_panicking: AtomicBool,
    // set while `drop` cancels and drains the selectors; a selector panic is
    // recorded in `panic_data` instead of unwinding in the middle of the drain
    draining: AtomicBool,
    // the first selector panic recorded during the drain
    panic_data: AtomicOption<Box<dyn Any + Send>>,
    // debug-only guard that `add`/`poll` are not used concurrently
    #[cfg(debug_assertions)]
    busy: AtomicBool,
}

impl Cqueue {
    /// Register a select coroutine with the cqueue.
    ///
    /// The `cqueue_add!` and `cqueue_add_oneshot!` macros should be used to
    /// create select coroutines correctly. All `add` calls must be sequential
    /// and must not overlap with [`Cqueue::poll`]: debug builds assert this.
    pub fn add<'a, F>(&self, token: usize, f: F) -> Selector
    where
        F: FnOnce(EventSender) + Send + 'a,
    {
        #[cfg(debug_assertions)]
        let _busy = BusyGuard::acquire(&self.busy, "add");

        let sender = EventSender {
            id: self.total.load(Ordering::Relaxed),
            token,
            extra: 0.into(),
            cqueue: self,
        };
        let h = unsafe { spawn_unsafe(move || f(sender)) };
        let co = h.coroutine().clone();
        self.cnt.fetch_add(1, Ordering::Release);

        self.total.fetch_add(1, Ordering::Relaxed);
        self.selectors.lock().unwrap().push(Some(h));
        Selector { co }
    }

    // when the select coroutine is done, check the panic status
    // if it's panicked, re throw the panic data
    fn check_panic(&self, id: usize) {
        if self.is_panicking.load(Ordering::Relaxed) {
            return;
        }

        // Take the handle and release the `selectors` lock before joining:
        // `join` can park, and the `resume_unwind` below must not run while
        // the lock is held, otherwise the unwind poisons the mutex and a later
        // `lock().unwrap()` (e.g. in `Drop` while unwinding) aborts.
        let handle = {
            let mut selectors = se
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39** (2018-03-04): **support send io ojbect to thread context that was created in coroutine context**
  *Symptoms*: currently if send an io object that initialized in coroutine context to a thread context, it will trigger a core dump. This was caused by wrongly assuming the context when initialize the io object. however detect run time context every time call read/write would hurt the performance a little.

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

### Incident Patch 1: `2727c031` (2026-11-13)
**Commit Message**: Fix EpollTimeout overflow with large Duration values

EpollTimeout::try_from() only accepts values up to i32.MAX milliseconds,
but AtomicDuration can store values up to usize.MAX milliseconds. When
users set very large timeouts (e.g., Duration::from_secs(30*24*3600)),
the .unwrap() would panic the selector thread, causing a restart loop
that would panic again on every wakeup.

This fix clamps timeout values to i32.MAX milliseconds before conversion,
allowing large timeouts to be safely handled without panicking.

Added regression test to verify large timeouts don't cause panics.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `src/io/sys/unix/epoll.rs` (modified, +7/-1)
```diff
@@ -90,7 +90,13 @@ impl Selector {
         // non-blocking reactor poll; anything else keeps blocking forever
         let timeout = _timeout.filter(|to| *to == 0);
         let timeout_ms = timeout
-            .map(|to| EpollTimeout::try_from(to.div_ceil(1_000_000)).unwrap())
+            .map(|to| {
+                let ms = to.div_ceil(1_000_000);
+                // Clamp to i32::MAX milliseconds if the timeout exceeds that.
+                // EpollTimeout::try_from rejects values > i32::MAX, so we cap it.
+                let ms_clamped = ms.min(i32::MAX as u64) as i32;
+                EpollTimeout::try_from(ms_clamped).unwrap()
+            })
             .unwrap_or(EpollTimeout::NONE);
         // info!("select; timeout={:?}", timeout_ms);
 
```

**File**: `tests/park_timeout.rs` (modified, +29/-0)
```diff
@@ -51,3 +51,32 @@ fn park_timeout_returns_for_short_timeouts() {
         "park_timeout did not return"
     );
 }
+
+#[cfg(unix)]
+#[test]
+fn large_timeout_does_not_panic() {
+    // Test that very large timeouts don't cause panics in the epoll/kqueue selector.
+    // This is a regression test for an issue where EpollTimeout::try_from would panic
+    // on values > i32::MAX milliseconds (e.g., 30 days = 2,592,000,000 ms).
+    let (tx, rx) = mpsc::channel();
+    let co = unsafe {
+        may::coroutine::Builder::new()
+            .spawn_local(move || {
+                // Very large timeout (30 days)
+                let large_timeout = Duration::from_secs(30 * 24 * 3600);
+                // Using a short timeout after the large one to ensure the test doesn't hang
+                may::coroutine::park_timeout(large_timeout);
+                println!("Large timeout completed by outside unpark");
+                may::coroutine::park_timeout(Duration::from_millis(1));
+                tx.send(()).unwrap();
+            })
+            .unwrap()
+    };
+    // don't wait that long for the large timeout, we will unpark it immediately
+    co.coroutine().unpark();
+    // Give it time to complete (should be quick since we don't actually wait 30 days)
+    assert!(
+        rx.recv().is_ok(),
+        "park_timeout with large timeout did not complete"
+    );
+}
```

---

### Incident Patch 2: `52489997` (2026-11-13)
**Commit Message**: fix: make semaphore wake-ups advisory to stop phantom permits

`post` handed its permit to a waiter implicitly: the +1 stayed in `cnt`
while `wakeup_one` walked the waiter queue, and retiring a timed-out
waiter raises `cnt` above zero. A concurrent fast-path `try_wait` could
therefore consume that permit mid-walk, and the delayed hand-off then
woke a newly registered receiver for a permit that no longer existed.
`recv` saw `Acquired`, popped an empty queue, and tripped the
"a semaphore permit had no queued item" assert (a release build returned
a spurious `Disconnected` instead).

Interleaving (single receiver, matches stress_recv_timeout_shared):

1. a recv_timeout times out and leaves a released blocker S (cnt = -1);
2. a sender pushes and posts: prev == -1, so wakeup_one starts;
3. wakeup_one pops S, retires it (cnt = 1), and is preempted;
4. the receiver's fast path consumes the permit and pops the value;
5. the receiver registers a new blocker and parks;
6. the delayed wakeup_one pops it and unparks it;
7. recv returns Acquired, pops nothing, senders alive -> panic.

Permits are now consumed only by `try_wait`: `post` increments the
counter and wakes one waiter advisory-style,

**File**: `src/sync/mpmc.rs` (modified, +17/-26)
```diff
@@ -23,7 +23,7 @@ use std::sync::Arc;
 use std::time::Duration;
 
 use super::semphore::WaitStatus;
-use super::Semphore;
+use super::Semaphore;
 use crossbeam::queue::SegQueue;
 
 /// /////////////////////////////////////////////////////////////////////////////
@@ -32,7 +32,7 @@ use crossbeam::queue::SegQueue;
 struct InnerQueue<T> {
     queue: SegQueue<T>,
     // thread/coroutine for wake up
-    sem: Semphore,
+    sem: Semaphore,
     // The number of tx channels which are currently using this queue.
     tx_ports: AtomicUsize,
     // if rx is dropped
@@ -43,7 +43,7 @@ impl<T> InnerQueue<T> {
     pub fn new() -> InnerQueue<T> {
         InnerQueue {
             queue: SegQueue::new(),
-            sem: Semphore::new(0),
+            sem: Semaphore::new(0),
             tx_ports: AtomicUsize::new(1),
             rx_ports: AtomicUsize::new(1),
         }
@@ -66,9 +66,9 @@ impl<T> InnerQueue<T> {
             Err(TryRecvError::Disconnected) => return Err(RecvTimeoutError::Disconnected),
         }
 
-        // The disconnect re-check is done *after* the waiter is registered
+        // The disconnect re-check is done *after* the waiter is published
         // (inside `wait_timeout_until`): a receiver that parks after the last
-        // sender's wakeup posts would otherwise never be woken again.
+        // sender's wakeup would otherwise never be woken again.
         match self
             .sem
             .wait_timeout_until(dur, || self.tx_ports.load(Ordering::Acquire) == 0)
@@ -77,11 +77,9 @@ impl<T> InnerQueue<T> {
             WaitStatus::Stopped => {
                 // The wait ended on the disconnect. A sender may still have
                 // published its last value before dropping its port, and the
-                // value's permit can race with the broadcast wakeup (the
-                // drain pops the blocker, but `leave_wait` wins the hand-off
-                // spin lock first), so `Stopped` does not imply that no value
-                // is buffered. Queued values must be delivered before the
-                // disconnect is reported.
+                // disconnect wake-up is only advisory, so `Stopped` does not
+                // imply that no value is buffered. Queued values must be
+                // delivered before the disconnect is reported.
                 return match self.queue.pop() {
                     Some(data) => Ok(data),
                     None => Err(RecvTimeoutError::Disconnected),
@@ -154,20 +152,13 @@ impl<T> InnerQueue<T> {
         match self.tx_ports.fetch_sub(1, Ordering::SeqCst) {
             1 => {
                 // There is no tx port any more; wake every parked receiver
-                // so it observes the disconnect.
-                //
-                // This must be a broadcast, not a "post while waiters exist"
-                // loop: a receiver pushes its blocker *before* decrementing
-                // the semaphore counter, and while it sits in that window the
-                // counter under-reports the parked receivers. Two receivers
-                // in that window can absorb the posts (and the spare permit)
-                // and make the loop stop while a fully registered receiver is
-                // still parked. Draining the waiter queue wakes everyone
-                // registered at this point regardless of the counter.
+                // so it observes the disconnect. This must be a broadcast,
+                // not a single wake: the stop predicate is permanently true
+                // and every receiver has to re-check it.
                 //
                 // Receivers that register after the drain observe
-                // `tx_ports == 0` through `wait_timeout_until`, so no wakeup
-                // is lost.
+                // `tx_ports == 0` through `wait_timeout_until`'s
+                // post-registration check, so no wakeup is lost.
                 self.sem.wake_all();
             }
             n if n > 1 => {}
@@ -280,10 +271,10 @@ impl<T> Sender<T> {
     /// Return a best-effort count of queued items not yet claimed by a
     /// receiver.
     ///
-    /// This is the semaphore's permit count, clamped at 0. It does not count
-    /// items already handed to a woken receiver, and it can transiently
-    /// include a permit returned by the release protocol after a receiver
-    /// timed out or was canceled.
+    /// This is the semaphore's permit count: one permit is posted per send
+    /// and consumed by `try_wait` when a receiver pops a value, so it can
+    /// transiently over-report a value whose receiver has been woken but has
+    /// not acquired the permit yet.
     pub fn pressure(&self) -> usize {
         self.inner.sem.get_value()
     }
```

**File**: `src/sync/semphore.rs` (modified, +198/-187)
```diff
@@ -1,13 +1,16 @@
 use std::fmt;
 use std::sync::atomic::{AtomicIsize, Ordering};
 use std::sync::Arc;
-use std::time::Duration;
+use std::time::{Duration, Instant};
 
 use super::blocking::{cancel_pending, SyncBlocker};
 use crate::cancel::trigger_cancel_panic;
 use crate::park::ParkError;
 use crossbeam::queue::SegQueue;
 
+/// Alias for [`Semaphore`] using the conventional spelling.
+pub type Semphore = Semaphore;
+
 /// Semphore primitive
 ///
 /// semaphores allow threads and coroutines to synchronize their actions.
@@ -19,6 +22,12 @@ use crossbeam::queue::SegQueue;
 /// zero, then a wait() operation will block until the value becomes
 /// greater than zero.
 ///
+/// A wake-up is advisory: it does not carry a permit. A woken waiter
+/// re-checks the counter and blocks again if another waiter consumed the
+/// permit first. This keeps the counter authoritative even when a `post`,
+/// `try_wait` and a waiter leaving (timeout/cancel) race, so a permit can
+/// never be handed out twice.
+///
 /// # Examples
 ///
 /// ```rust
@@ -29,7 +38,6 @@ use crossbeam::queue::SegQueue;
 /// let sem = Arc::new(Semphore::new(0));
 /// let sem2 = sem.clone();
 ///
-/// // spawn a coroutine, and then wait for it to start
 /// unsafe {
 ///     coroutine::spawn(move || {
 ///         sem2.post();
@@ -39,101 +47,60 @@ use crossbeam::queue::SegQueue;
 /// // wait for the coroutine to start up
 /// sem.wait();
 /// ```
-pub struct Semphore {
-    // track how many resources available for the semphore
-    // if it's negative means how many threads are waiting for
+pub struct Semaphore {
+    // how many permits are available; only `try_wait` decrements it
     cnt: AtomicIsize,
     // the waiting blocker list, must be mpmc
     to_wake: SegQueue<Arc<SyncBlocker>>,
 }
 
-/// Alias for [`Semphore`] using the conventional spelling.
-pub type Semaphore = Semphore;
-
 /// Result of [`Semphore::wait_timeout_until`].
 pub(crate) enum WaitStatus {
-    /// A permit was acquired (or the wait was notified).
+    /// A permit was acquired.
     Acquired,
-    /// The `stop` predicate was true after the waiter registered; no permit
-    /// was consumed.
+    /// The `stop` predicate was true; no permit was consumed.
     Stopped,
     /// The timeout expired.
     Timeout,
 }
 
-impl Semphore {
+impl Semaphore {
     /// create a semphore with the initial value
     pub fn new(init: usize) -> Self {
         assert!(init < isize::MAX as usize);
-        Semphore {
+        Semaphore {
             to_wake: SegQueue::new(),
             cnt: AtomicIsize::new(init as isize),
         }
     }
 
-    // wake up the first live waiter, forwarding the permit past waiters that
-    // have already timed out or been canceled (their `release` flag is set).
-    //
-    // Returns `true` if a live waiter took the permit and `false` if there
-    // was no live waiter queued, in which case the permit stays in `cnt`.
-    //
-    // The walk must not stop on a positive `cnt`: waiters that already
-    // registered (and are queued behind a released blocker) are covered by
-    // permits, so `cnt >= 0` does not mean that no live waiter is left.
-    //
-    // Iterative on purpose: a cancel storm can leave many released blockers
-    // back to back in the queue, and recursing through `post` would overflow
-    // the (small, 32KB default) coroutine stack and abort.
+    /// Wake the first live waiter.
+    ///
+    /// The wake-up is advisory: the woken waiter re-checks the permit count,
+    /// so it is harmless for the wake to race with [`try_wait`](Self::try_wait)
+    /// or with a waiter that timed out. A waiter that has already left
+    /// (timeout or cancel) only leaves a released blocker behind; it is
+    /// skipped so it cannot swallow the wake-up meant for a waiter behind it.
+    ///
+    /// Iterative on purpose: a cancel storm can leave many released blockers
+    /// back to back in the queue, and recursing through `post` would overflow
+    /// the (small, 32KB default) coroutine stack and abort.
     #[inline]
-    fn wakeup_one(&self) -> bool {
+    fn wakeup_one(&self) {
         while let Some(w) = self.to_wake.pop() {
-            // `true` means a live waiter took the permit
             if w.try_hand_off() {
-                return true;
+                return;
             }
-
-            // the released waiter no longer counts as waiting (`cnt += 1`);
-            // keep looking for a live waiter to forward the permit to
-            self.cnt.fetch_add(1, Ordering::SeqCst);
-        }
-
-        // The queue is empty although the counter said otherwise. Receivers
-        // that pushed a blocker but have not yet decremented `cnt`, or that
-        // were already woken by a broadcast drain, are the common cause; the
-        // permit simply stays in `cnt`.
-        false
-    }
-
-    /// Account an already-pushed blocker as a waiter.
-    ///
-    /// A permit can be posted between the fast path and this reg
```

**File**: `tests/park_timeout.rs` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 //! Timed waits in a coroutine must return for any timeout, including ones
 //! shorter than the timer's resolution.
 
-use may::sync::Semphore;
+use may::sync::Semaphore;
 use std::sync::mpsc;
 use std::time::Duration;
 
 fn returns_within(d: Duration, n: usize) -> bool {
     let (tx, rx) = mpsc::channel();
     may::go!(move || {
-        let s = Semphore::new(0);
+        let s = Semaphore::new(0);
         for _ in 0..n {
             assert!(!s.wait_timeout(d));
         }
```

---

### Incident Patch 3: `1a30a504` (2026-11-12)
**Commit Message**: fix: broadcast receiver wakeup on MPMC disconnect

A receiver pushes its blocker into the semaphore's waiter queue before it
decrements the counter, so it is briefly queued but not accounted. The
disconnect path (`drop_tx`) posted permits until the counter reported no
waiters; two receivers inside that window could absorb the posts and the
spare permit, letting the loop exit while a fully registered receiver was
still parked. The window receivers leave anyway (the post-registration
`stop` re-check sees `tx_ports == 0`), so the parked one was stranded.

- Add `Semphore::wake_all`, a broadcast drain of the waiter queue used by
  `drop_tx`: each blocker is retired from the counter and its waiter is
  unparked, regardless of the counter state. Receivers that register
  after the drain are covered by the existing `stop` re-check.
- Make `wakeup_one` tolerate an empty queue: a drained window receiver's
  late `fetch_sub` used to panic with "got null blocker!".
- Keep `wakeup_one` walking past released blockers instead of stopping on
  a non-negative counter, which could skip a live waiter queued behind
  them.
- Drop the now-unused `post_and_check`.

Add a deterministic regression test f

**File**: `src/sync/mpmc.rs` (modified, +14/-12)
```diff
@@ -124,19 +124,21 @@ impl<T> InnerQueue<T> {
         match self.tx_ports.fetch_sub(1, Ordering::SeqCst) {
             1 => {
                 // There is no tx port any more; wake every parked receiver
-                // so it observes the disconnect. No spare permit is left
-                // behind: receivers that register after this wakeup observe
-                // `tx_ports == 0` through `wait_timeout_until`.
+                // so it observes the disconnect.
                 //
-                // Keep posting until no more waiters are woken. This handles
-                // the race where a receiver can register after we check for
-                // waiters but before we post. By repeatedly posting until
-                // post_and_check returns false, we ensure all receivers
-                // (including those registering concurrently) observe the
-                // disconnect.
-                while self.sem.post_and_check() {
-                    // Keep posting
-                }
+                // This must be a broadcast, not a "post while waiters exist"
+                // loop: a receiver pushes its blocker *before* decrementing
+                // the semaphore counter, and while it sits in that window the
+                // counter under-reports the parked receivers. Two receivers
+                // in that window can absorb the posts (and the spare permit)
+                // and make the loop stop while a fully registered receiver is
+                // still parked. Draining the waiter queue wakes everyone
+                // registered at this point regardless of the counter.
+                //
+                // Receivers that register after the drain observe
+                // `tx_ports == 0` through `wait_timeout_until`, so no wakeup
+                // is lost.
+                self.sem.wake_all();
             }
             n if n > 1 => {}
             n => {
```

**File**: `src/sync/semphore.rs` (modified, +106/-39)
```diff
@@ -74,24 +74,67 @@ impl Semphore {
     // wake up the first live waiter, forwarding the permit past waiters that
     // have already timed out or been canceled (their `release` flag is set).
     //
+    // Returns `true` if a live waiter took the permit and `false` if there
+    // was no live waiter queued, in which case the permit stays in `cnt`.
+    //
+    // The walk must not stop on a positive `cnt`: waiters that already
+    // registered (and are queued behind a released blocker) are covered by
+    // permits, so `cnt >= 0` does not mean that no live waiter is left.
+    //
     // Iterative on purpose: a cancel storm can leave many released blockers
     // back to back in the queue, and recursing through `post` would overflow
     // the (small, 32KB default) coroutine stack and abort.
     #[inline]
-    fn wakeup_one(&self) {
-        loop {
-            let w = self.to_wake.pop().expect("got null blocker!");
-
+    fn wakeup_one(&self) -> bool {
+        while let Some(w) = self.to_wake.pop() {
             // `true` means a live waiter took the permit
             if w.try_hand_off() {
-                break;
+                return true;
             }
 
             // the released waiter no longer counts as waiting (`cnt += 1`);
-            // forward the permit if there are still waiters behind it
-            if self.cnt.fetch_add(1, Ordering::SeqCst) >= 0 {
-                break;
-            }
+            // keep looking for a live waiter to forward the permit to
+            self.cnt.fetch_add(1, Ordering::SeqCst);
+        }
+
+        // The queue is empty although the counter said otherwise. Receivers
+        // that pushed a blocker but have not yet decremented `cnt`, or that
+        // were already woken by a broadcast drain, are the common cause; the
+        // permit simply stays in `cnt`.
+        false
+    }
+
+    /// Account an already-pushed blocker as a waiter.
+    ///
+    /// A permit can be posted between the fast path and this registration.
+    /// Hand it to the oldest waiter; if there is none, it stays available in
+    /// `cnt`.
+    #[inline]
+    fn record_waiter(&self) {
+        // dec the cnt, if it's positive, unpark one waiter
+        if self.cnt.fetch_sub(1, Ordering::SeqCst) > 0 {
+            self.wakeup_one();
+        }
+    }
+
+    /// Wake every queued waiter.
+    ///
+    /// This is a broadcast for a predicate that has become permanently true
+    /// (an MPMC receiver observing a disconnect): each queued blocker is
+    /// retired (`cnt += 1` undoes its registration) and its waiter is
+    /// unparked. Receivers that pushed a blocker but have not yet run
+    /// `record_waiter` are woken too; the same `+1` retires the registration
+    /// they are about to add.
+    ///
+    /// Unlike [`post`](Self::post), the wakeup is not permit based, so
+    /// waiters that were not yet accounted for cannot make it stop early.
+    pub(crate) fn wake_all(&self) {
+        while let Some(w) = self.to_wake.pop() {
+            // retire the waiter's registration, exactly like the
+            // released-blocker path in `wakeup_one`
+            self.cnt.fetch_add(1, Ordering::SeqCst);
+            // live waiters are unparked; released blockers are just dropped
+            w.try_hand_off();
         }
     }
 
@@ -119,10 +162,9 @@ impl Semphore {
         let cur = SyncBlocker::current();
         // register blocker first
         self.to_wake.push(cur.clone());
-        // dec the cnt, if it's positive, unpark one waiter
-        if self.cnt.fetch_sub(1, Ordering::SeqCst) > 0 {
-            self.wakeup_one();
-        }
+        // dec the cnt, and forward a permit that was posted in between to the
+        // oldest waiter (which can end up being this one)
+        self.record_waiter();
 
         // Re-check after registering; the fetch_sub above synchronizes with
         // the producer's post through the SeqCst modification order of `cnt`.
@@ -250,32 +292,6 @@ impl Semphore {
         }
     }
 
-    /// Increment the semaphore and wake one waiter if any exist.
-    /// Returns `true` if a waiter was woken, `false` if there were no waiters.
-    pub(crate) fn post_and_check(&self) -> bool {
-        // CAS loop so the counter is not wrapped before the overflow check
-        // can fire
-        let prev = loop {
-            let cur = self.cnt.load(Ordering::SeqCst);
-            assert!(cur < isize::MAX, "semaphore permit count overflow");
-            match self
-                .cnt
-                .compare_exchange_weak(cur, cur + 1, Ordering::SeqCst, Ordering::SeqCst)
-            {
-                Ok(_) => break cur,
-                Err(_) => continue,
-            }
-        };
-
-        // try to wakeup one waiter first
-        if prev < 0 {
-            self.wakeup_one();
-            true
-        } else {
-            false
-        }
-    }
-
     /// Return the current semaphore value.
     ///
     /// Queued w
```

#### Recent Merged Pull Requests:
- **PR #131** (2026-10-28): spsc: add Receiver::recv_timeout (@casibbald)
- **PR #130** (2026-10-28): park: keep sub-millisecond timeouts instead of waiting forever (@casibbald)
- **PR #129** (2026-10-26): may_queue: keep block allocation and queue teardown off the calling stack (@casibbald)
- **PR #127** (2026-08-03): Update the generator-rs Version (@BersisSe)
- **PR #126** (2026-10-28): Fix/spsc lost wakeup (@casibbald)
- **PR #125** (2026-07-17): Fix/wsa connrefused mapping (@casibbald)

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

## X. EpollTimeout overflow with large Duration values

**RULE**:
When implementing operations in `src/io/sys/unix/epoll.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Xudong-Huang/may. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2727c031`: EpollTimeout overflow with large Duration values. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/io/sys/unix/epoll.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            .map(|to| {
                let ms = to.div_ceil(1_000_000);
                // Clamp to i32::MAX milliseconds if the timeout exceeds that.
                // EpollTimeout::try_from rejects values > i32::MAX, so we cap it.
                let ms_clamped = ms.min(i32::MAX as u64) as i32;
                EpollTimeout::try_from(ms_clamped).unwrap()
            })
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            .map(|to| EpollTimeout::try_from(to.div_ceil(1_000_000)).unwrap())
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2727c031` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
