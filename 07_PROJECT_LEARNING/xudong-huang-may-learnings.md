# Forensic Learning Record (Deep Inspection): Xudong-Huang/may

> **Canonical Artifact**: `07_PROJECT_LEARNING/xudong-huang-may-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Xudong-Huang/may](https://github.com/Xudong-Huang/may))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:55.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Xudong-Huang/may`
- **Description**: rust stackful coroutine library
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2439 stars

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
        let (sx1, rx1) = may::sync::mpsc::channel();
        let (sx2, rx2) = may::sync::mpsc::channel();
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
        *(*self.inner.get()).get_mut()
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
        *(*self.inner.get()).get_mut()
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

impl<T> Slot<T> {
    #[allow(clippy::declare_interior_mutable_const)]
    const UNINIT: Self = Self {
        value: UnsafeCell::new(MaybeUninit::uninit()),
        ready: AtomicUsize::new(0),
    };
}

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
    /// create a new BlockNode with uninitialized data
    #[inline]
    fn new_box(index: usize) -> *mut BlockNode<T> {
        Box::into_raw(Box::new(BlockNode::new(index)))
    }

    /// create a new BlockNode with uninitialized data
    #[inline]
    fn new(index: usize) -> BlockNode<T> {
        BlockNode {
            next: AtomicPtr::new(ptr::null_mut()),
            data: [Slot::UNINIT; BLOCK_SIZE],
            start: index,
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
        let ptr = ptr as usize;
        let index = ptr & BLOCK_MASK;
        let ptr = (ptr & !BLOCK_MASK) as *mut BlockNode<T>;
        (ptr, index)
    }

    #[inline]
    fn pack(ptr: *const BlockNode<T>, index: usize) -> *mut BlockNode<T> {
        ((ptr as usize) | index) as *mut BlockNode<T>
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
    old_block: UnsafeCell<Option<Box<BlockNode<T>>>>,

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
            old_block: UnsafeCell::new(None),
            _marker: PhantomData,
        }
    }

    /// push a value to the back of queue
    pub fn push(&self, v: T) {
        let backoff = Backoff::new();
        let mut tail = self.tail.0.load(Ordering::Acquire);

        loop {
            tail = (tail as usize & !(1 << 63)) as *mut BlockNode<T>;
            let (block, id) = BlockPtr::unpack(tail);
            let block = unsafe { &*block };

            let new_tail = if id < BLOCK_MASK {
                BlockPtr::pack(block, id + 1)
            } else {
                (tail as usize | (1 << 63)) as *mut BlockNode<T>
            };

            match self.tail.0.compare_exchange_weak(
                tail,
                new_tail,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    // set the data
                    block.set(id, v);
                    // the block may be released here by the consumer,
                    // so we need to use old_block to delay the drop
                    if id == BLOCK_MASK {
                        let new_block = BlockNode::new_box(block.start + BLOCK_SIZE * 2);
                        let next_block = unsafe { &mut *block.wait_next_block() };
                        // install the next-next block
                        next_block.next.store(new_block, Ordering::Release);
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
        let tail_block = (tail_block as usize & !(1 << 63)) as *mut BlockNode<T>;
        unsafe { &*tail_block }.start + id
    }

    /// pop from the queue, if it's empty return None
    pub fn pop(&self) -> Option<T> {
        let head = unsafe { &mut *self.head.block.unsync_load() };
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
            let old_block = unsafe { &mut *(self.old_block.get()) };
            old_block.replace(unsafe { Box::from_raw(head) });

            let next_block = head.wait_next_block();
            self.head.block.store(next_block, Ordering::Relaxed);
        }

        Some(data)
    }

    /// fast pop from the queue, if it's empty return None, or else return `SmallVec<[T; BLOCK_SIZE]>`
    /// don't check the push index, but only the ready flag
    #[inline]
    fn fast_bulk_pop(&self, index: usize, head: &mut BlockNode<T>) -> SmallVec<[T; BLOCK_SIZE]> {
        // only pop within a block
        let block_end = (index + BLOCK_SIZE) & !BLOCK_MASK;
        let len = block_end - index;

        let mut value = SmallVec::new();
        let start = index & BLOCK_MASK;
        for i in start..start + len {
            match head.try_get(i) {
                Some(v) => value.push(v),
                None => break,
            }
        }

        if value.is_empty() {
            return value;
        }

        let new_index = index + value.len();
        self.head.index.store(new_index, Ordering::Relaxed);

        // free the old block node
        if new_index & BLOCK_MASK == 0 {
            let old_block = unsafe { &mut *(self.old_block.get()) };
            old_block.replace(un
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
            let total_work: usize = 1_000_000;
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
            let total_work: usize = 1_000_000;
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
use std::cell::UnsafeCell;
use std::ptr;
use std::sync::atomic::{AtomicPtr, Ordering};

use crossbeam_utils::{Backoff, CachePadded};

struct Node<T> {
    prev: *mut Node<T>,
    next: AtomicPtr<Node<T>>,
    value: Option<T>,
    refs: usize,
}
// linked bit is MSB, ref count is 2 for handle and list
const REF_INIT: usize = 0x1000_0002;
const REF_COUNT_MASK: usize = 0x0FFF_FFFF;

impl<T> Node<T> {
    unsafe fn new(v: Option<T>) -> *mut Node<T> {
        Box::into_raw(Box::new(Node {
            prev: ptr::null_mut(),
            next: AtomicPtr::new(ptr::null_mut()),
            value: v,
            refs: REF_INIT,
        }))
    }
}

pub struct Entry<T>(ptr::NonNull<Node<T>>);

unsafe impl<T: Sync> Sync for Entry<T> {}

impl<T> Entry<T> {
    /// get the internal data mut ref
    /// # Safety
    ///
    /// must make sure it's not popped by the consumer
    #[inline]
    pub unsafe fn with_mut_data<F>(&self, f: F)
    where
        F: FnOnce(&mut T),
    {
        let node = &mut *self.0.as_ptr();
        let data = node.value.as_mut().expect("Node value is None");
        f(data);
    }

    /// judge if the node is still linked in the list
    #[inline]
    pub fn is_link(&self) -> bool {
        let node = unsafe { &mut *self.0.as_ptr() };
        node.refs & !REF_COUNT_MASK != 0
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
    // it's only safe for the consumer that call pop()
    pub fn remove(mut self) -> Option<T> {
        unsafe {
            let node = self.0.as_mut();

            // when the link bit is cleared, next and prev is no longer valid
            if node.refs & !REF_COUNT_MASK == 0 {
                // already removed
                return None;
            }

            // this is a new tail just return
            if node.prev.is_null() {
                return None;
            }

            let next = node.next.load(Ordering::Acquire);
            let prev = &mut *node.prev;

            // here we must make sure the next is not equal to null
            // other thread may modify the next value if it's null
            // it's safe to remove the node that between tail and head
            // but not safe to remove the last node since it's volatile
            // when next is null, the remove takes no action
            // and expect pop() would eventually consume the data
            // this is mainly used in the timer list, so it's rarely
            // the next is not contention for that we have wait some time already
            // leave the last node not removed also persist the queue for a while
            // that prevent frequent queue create and destroy
            if !next.is_null() {
                // clear the link bit
                node.refs &= REF_COUNT_MASK;

                // this is not the last node, just unlink it
                (*next).prev = prev;
                prev.next.store(next, Ordering::Release);

                let ret = node.value.take();

                // since self is not dropped, below is always false
                node.refs -= 1;
                if node.refs == 0 {
                    // release the node only when the ref count becomes 0
                    let _: Box<Node<T>> = Box::from_raw(node);
                }

                return ret;
            }
        }

        None
    }
}

impl<T> Drop for Entry<T> {
    // only call this drop in the same thread, or you must make sure it happens with no contention
    // running in a coroutine is a kind of sequential operation, so it can safely drop there after
    // returning from "kernel"
    fn drop(&mut self) {
        let node = unsafe { self.0.as_mut() };
        // dec the ref count of node
        node.refs -= 1;
        if node.refs == 0 {
            // release the node
            let _: Box<Node<T>> = unsafe { Box::from_raw(node) };
        }
    }
}

unsafe impl<T: Send> Send for Entry<T> {}

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
        // there is no handle for the node, so it's ref should be 1 now
        unsafe { &mut *stub }.refs = 1;
        Queue {
            head: AtomicPtr::new(stub).into(),
            tail: UnsafeCell::new(stub),
        }
    }

    /// Pushes a new value onto this queue.
    /// if the new node is head, indicate a true
    /// this is used to update the BH if it's a new head
    pub fn push(&self, t: T) -> (Entry<T>, bool) {
        unsafe {
            let node = Node::new(Some(t));
            let prev = self.head.swap(node, Ordering::AcqRel);
            (*node).prev = prev;
            (*prev).next.store(node, Ordering::Release);
            let tail = *self.tail.get();
            let is_head = std::ptr::eq(tail, prev);
            (Entry(ptr::NonNull::new_unchecked(node)), is_head)
        }
    }

    /// if the queue is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        let tail = unsafe { *self.tail.get() };
        // the list is empty
        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
    }

    /// get the head ref
    /// # Safety
    /// the if you pop the head, it's unsafe hold the head ref
    #[inline]
    pub unsafe fn peek(&self) -> Option<&T> {
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

        assert!((*tail).value.is_none());
        assert!((*next).value.is_some());

        (*next).value.as_ref()
    }

    pub fn pop_if<F>(&self, f: &F) -> Option<T>
    where
        F: Fn(&T) -> bool,
    {
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

            assert!((*tail).value.is_none());
            assert!((*next).value.is_some());

            let v = (*next).value.as_ref().unwrap();
            if !f(v) {
                // no pop
                return None;
            }

            // clear the link bit
            assert!((*tail).refs & REF_COUNT_MASK != 0);
            (*tail).refs &= REF_COUNT_MASK;

            // clear the prev pointer indicate a new end point
            (*next).prev = ptr::null_mut();
            // move the tail to next
            *self.tail.get() = next;

            // we take the next value, this is why use option to host the value
            let ret = (*next).value.take().unwrap();
            (*tail).refs -= 1;
            if (*tail).refs == 0 {
                // release the node only when the ref count becomes 0
                let _: Box<Node<T>> = Box::from_raw(tail);
            }

            Some(ret)
        }
    }

    /// Pops some data from this queue.
    pub fn pop(&self) -> Option<T> {
        unsafe {
            let tail = *self.tail.get();

            // the list is empty
            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                return None;
            }

            // clear the link bit
            assert!((*tail).refs & REF_COUNT_MASK != 0);
            (*tail).refs &= REF_COUNT_MASK;

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
            (*next).prev = ptr::null_mut();
            // move the tail to next
            *self.tail.get() = next;

            assert!((*tail).value.is_none());
            assert!((*next).value.is_some());
            // we tack the next value, this is why use option to host the value
            let ret = (*next).value.take().unwrap();
            (*tail).refs -= 1;
            if (*tail).refs == 0 {
                // release the node only when the ref count becomes 0
                let _: Box<Node<T>> = Box::from_raw(tail);
            }

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
    use std::sync::Ar
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

impl<T> Slot<T> {
    #[allow(clippy::declare_interior_mutable_const)]
    const UNINIT: Self = Self {
        value: UnsafeCell::new(MaybeUninit::uninit()),
    };
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
    /// create a new BlockNode with uninitialized data
    #[inline]
    fn new(index: usize) -> *mut BlockNode<T> {
        Box::into_raw(Box::new(BlockNode {
            next: AtomicPtr::new(ptr::null_mut()),
            used: AtomicUsize::new(BLOCK_SIZE),
            data: [Slot::UNINIT; BLOCK_SIZE],
            start: AtomicUsize::new(index),
        }))
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
        let old = self.used.fetch_sub(size, Ordering::Relaxed);
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
        let ptr = ptr as usize;
        let index = ptr & BLOCK_MASK;
        let ptr = (ptr & !BLOCK_MASK) as *mut BlockNode<T>;
        (ptr, index)
    }

    #[inline]
    fn pack(ptr: *const BlockNode<T>, index: usize) -> *mut BlockNode<T> {
        ((ptr as usize) | index) as *mut BlockNode<T>
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
        let tail = unsafe { &mut *self.tail.block.unsync_load() };
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
            head = (head as usize & !(1 << 63)) as *mut BlockNode<T>;
            let (block, id) = BlockPtr::unpack(head);
            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                return None;
            }

            let new_head = if id != BLOCK_MASK {
                BlockPtr::pack(block, id + 1)
            } else {
                (head as usize | (1 << 63)) as *mut BlockNode<T>
            };

            let block = unsafe { &mut *block };

            // commit the pop
            match self.head.0.compare_exchange_weak(
                head,
                new_head,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
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
                        let _unused_block = unsafe { Box::from_raw(block) };
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
            head = (head as usize & !(1 << 63)) as *mut BlockNode<T>;
            let (block, id) = BlockPtr::unpack(head);
            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                return None;
            }

            let new_head = if id != BLOCK_MASK {
                BlockPtr::pack(block, id + 1)
            } else {
                (head as usize | (1 << 63)) as *mut BlockNode<T>
            };

            let block = unsafe { &mut *block };

            // commit the pop
            match self.head.0.compare_exchange_weak(
                head,
                new_head,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    let block_start = block.start.load(Ordering::Relaxed);
                    let pop_index = block_start + id;
                    if id == BLOCK_MASK {
                        // we need to check if there is enough data
                        if pop_index >= push_index {
                            // recover the old head, and return None
                            self.head.0.store(head, Ordering::Release);
                            return None;
                        }
                        let next = block.next.load(Ordering::Acquire);
                        self.head.0.store(next, Ordering::Release);
                    } else if pop_index >=
```

### Core Architecture Module: `may_queue/src/spsc.rs`
```
use crossbeam_utils::CachePadded;
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
pub const BLOCK_MASK: usize = BLOCK_SIZE - 1;
// block shift
pub const BLOCK_SHIFT: usize = 5;

/// A slot in a block.
struct Slot<T> {
    /// The value.
    value: UnsafeCell<MaybeUninit<T>>,
}

impl<T> Slot<T> {
    #[allow(clippy::declare_interior_mutable_const)]
    const UNINIT: Self = Self {
        value: UnsafeCell::new(MaybeUninit::uninit()),
    };
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
    /// create a new BlockNode with uninitialized data
    #[inline]
    fn new() -> *mut BlockNode<T> {
        Box::into_raw(Box::new(BlockNode {
            next: AtomicPtr::new(ptr::null_mut()),
            data: [Slot::UNINIT; BLOCK_SIZE],
        }))
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

unsafe impl<T: Send> Send for Queue<T> {}
unsafe impl<T: Send> Sync for Queue<T> {}

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
        let first = unsafe { &mut *self.first.unsync_load() };
        let mut last_head = unsafe { &mut *self.last_head.unsync_load() };
        if !ptr::eq(first, last_head) {
            let next = unsafe { first.next.unsync_load() };
            self.first.store(next, Ordering::Relaxed);
            // first.next.store(ptr::null_mut(), Ordering::Relaxed);
            return first;
        }

        last_head = unsafe { &mut *self.head.block.unsync_load() };
        self.last_head.store(last_head, Ordering::Relaxed);

        if !ptr::eq(first, last_head) {
            let next = unsafe { first.next.unsync_load() };
            self.first.store(next, Ordering::Relaxed);
            // first.next.store(ptr::null_mut(), Ordering::Relaxed);
            first
        } else {
            BlockNode::new()
        }
    }

    /// push a value to the queue
    pub fn push(&self, v: T) {
        let tail = unsafe { &mut *self.tail.block.unsync_load() };
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

        let head = &mut *self.head.block.unsync_load();
        Some(head.peek(index))
    }

    /// pop from the queue, if it's empty return None
    pub fn pop(&self) -> Option<T> {
        let index = unsafe { self.head.index.unsync_load() };
        let push_index = self.tail.index.load(Ordering::Acquire);
        if index == push_index {
            return None;
        }

        let head = unsafe { &mut *self.head.block.unsync_load() };
        // get the data
        let v = head.get(index & BLOCK_MASK);

        let new_index = index.wrapping_add(1);
        // we need to free the old head if it get empty
        if new_index & BLOCK_MASK == 0 {
            let new_head = head.next.load(Ordering::Relaxed);
            // assert!(!new_head.is_null());
            #[cfg(not(feature = "inner_cache"))]
            let _unused_head = unsafe { Box::from_raw(head) };
            self.head.block.store(new_head, Ordering::Relaxed);
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

        let head = unsafe { &mut *self.head.block.unsync_load() };

        // only pop within a block
        let end = bulk_end(index, push_index);
        let value = head.copy_to_bulk(index, end);

        let new_index = end;

        // free the old block node
        if new_index & BLOCK_MASK == 0 {
            let new_head = head.next.load(Ordering::Relaxed);
            // assert!(!new_head.is_null());
            #[cfg(not(feature = "inner_cache"))]
            let _unused_head = unsafe { Box::from_raw(head) };
            self.head.block.store(new_head, Ordering::Relaxed);
        }

        // commit the pop
        self.head.index.store(new_index, Ordering::Relaxed);

        value
    }
}

impl<T> Default for Queue<T> {
    fn default() -> Self {
        Queue::new()
    }
}

impl<T> Drop for Queue<T> {
    fn drop(&mut self) {
        //  pop all the element to make sure the queue is empty
        while !self.bulk_pop().is_empty() {}
        let head = self.head.block.load(Ordering::Relaxed);
        let tail = self.tail.block.load(Ordering::Relaxed);
        assert_eq!(head, tail);

        #[cfg(feature = "inner_cache")]
        let mut first = self.first.load(Ordering::Relaxed);
        #[cfg(feature = "inner_cache")]
        while !std::ptr::eq(first, tail) {
            let next = unsafe { &*first }.next.load(Ordering::Relaxed);
            let _ = unsafe { Box::from_raw(first) };
            first = next;
        }

        let _unused_block = unsafe { Box::from_raw(head) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_sanity() {
        let q = Queue::<usize>::new();
        assert_eq!(q.len(), 0);
        for i in 0..100 {
            q.push(i);
        }
        assert_eq!(q.len(), 100);
   
```

### Core Architecture Module: `src/cqueue.rs`
```
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

use may_queue::mpsc::Queue;

/// This enumeration is the list of the possible reasons that `poll`
/// could not return Event when called.
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
pub enum PollError {
    /// This cqueue currently has no event and timeout happens
    /// so data may become available in future
    Timeout,

    /// This cqueue associated select coroutines are all finished
    /// so there will never be any more event received on it unless
    /// subscribe new select coroutines by using `add`
    Finished,
}

/// This enumeration is the list of the possible reasons that an event
/// is generated
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum EventKind {
    /// the select coroutine has successfully generated an event from top half
    /// so we can continue it's bottom half after call the `poll`
    Normal,

    /// indicate a select coroutine is finished
    Done,
}

/// The event that `poll` would return, events are generated when a select coroutine
/// has finished it's top half
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
    // the async coroutine that work on an select
    co: Option<CoroutineImpl>,
}

impl Event {
    /// continue the select coroutine with it's bottom half
    /// when `poll` got a Normal event, should always call it first
    fn continue_bottom(&mut self) {
        if let Some(co) = self.co.take() {
            run_coroutine(co);
        }
    }
}

/// a handle type for the select coroutine
/// you can only use the `remove` method to manually delete the coroutine
pub struct Selector {
    co: Coroutine,
}

impl Selector {
    /// terminate the select coroutine
    /// this would remove the selector from the associated cqueue
    pub fn remove(self) {
        unsafe { self.co.cancel() };
    }
}

/// each select coroutine would use this struct to communicate with
/// the cqueue. the struct is created in `add` for each select coroutine
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
    /// get the token
    pub fn get_token(&self) -> usize {
        self.token
    }

    /// send out the event
    pub fn send(&self, extra: usize) {
        let cancel = current_cancel_data();
        cancel.check_cancel();
        self.extra.store(extra, Ordering::Relaxed);
        yield_with(self);
    }
}

impl EventSource for EventSender<'_> {
    fn subscribe(&mut self, co: CoroutineImpl) {
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
    // when the select coroutine finished will trigger this drop
    fn drop(&mut self) {
        self.cqueue.ev_queue.push(Event {
            id: self.id,
            token: self.token,
            extra: self.extra.load(Ordering::Relaxed),
            kind: EventKind::Done,
            co: None,
        });
        self.cqueue.cnt.fetch_sub(1, Ordering::Relaxed);
        if let Some(w) = self.cqueue.to_wake.take() {
            w.unpark();
        }
    }
}

/// cqueue interface for general select model
pub struct Cqueue {
    // the mpsc queue that transfer event
    ev_queue: Queue<Event>,
    // thread/coroutine for wake up
    to_wake: AtomicOption<Arc<Blocker>>,
    // track how many coroutines left
    cnt: AtomicUsize,
    // store the select coroutine handles
    selectors: Mutex<Vec<Option<JoinHandle<()>>>>,
    // total created select coroutines
    total: AtomicUsize,
    // panic status
    is_panicking: AtomicBool,
}

impl Cqueue {
    /// register a select coroutine with the cqueue
    /// should use `cqueue_add` and `cqueue_add_oneshot` macros to
    /// create select coroutines correctly
    fn add_impl<'a, F>(&self, token: usize, f: F) -> Selector
    where
        F: FnOnce(EventSender) + Send + 'a,
    {
        let sender = EventSender {
            id: self.total.load(Ordering::Relaxed),
            token,
            extra: 0.into(),
            cqueue: self,
        };
        let h = unsafe { spawn_unsafe(move || f(sender)) };
        let co = h.coroutine().clone();
        self.cnt.fetch_add(1, Ordering::Relaxed);

        self.total.fetch_add(1, Ordering::Relaxed);
        self.selectors.lock().unwrap().push(Some(h));
        Selector { co }
    }

    /// register a select coroutine with the cqueue
    /// should use `cqueue_add` and `cqueue_add_oneshot` macros to
    /// create select coroutines correctly
    pub fn add<'a, F>(&self, token: usize, f: F) -> Selector
    where
        F: FnOnce(EventSender) + Send + 'a,
    {
        self.add_impl(token, f)
    }

    // when the select coroutine is done, check the panic status
    // if it's panicked, re throw the panic data
    fn check_panic(&self, id: usize) {
        if self.is_panicking.load(Ordering::Relaxed) {
            return;
        }

        use generator::Error;
        match self.selectors.lock().unwrap()[id]
            .take()
            .expect("join handler not set")
            .join()
        {
            Ok(_) => {}
            Err(panic) => {
                if let Some(err) = panic.downcast_ref::<Error>() {
                    // ignore the cancel panic
                    if *err == Error::Cancel {
                        return;
                    }
                }
                self.is_panicking.store(true, Ordering::Relaxed);
                panic::resume_unwind(panic);
            }
        }
    }

    /// poll an event that is ready to process
    /// when the event is returned the bottom half is already run
    /// the API is "completion" mode
    /// if any panic in select coroutine detected during the poll
    /// it will propagate the panic to the caller
    pub fn poll(&self, timeout: Option<Duration>) -> Result<Event, PollError> {
        macro_rules! run_ev {
            ($ev:ident) => {{
                if $ev.kind == EventKind::Done {
                    self.check_panic($ev.id);
                    continue;
                }
                $ev.continue_bottom();
                return Ok($ev);
            }};
        }

        let deadline = timeout.map(|dur| Instant::now() + dur);
        loop {
            match self.ev_queue.pop() {
                Some(mut ev) => run_ev!(ev),
                None => {
                    if self.cnt.load(Ordering::Relaxed) == 0 {
                        return Err(PollError::Finished);
                    }
                }
            }

            let cur = Blocker::current();
            // register the waiter
            self.to_wake.store(cur.clone());
            // re-check the queue
            match self.ev_queue.pop() {
                None => {
                    cur.park(timeout).ok();
                }
                Some(mut ev) => {
                    self.to_wake.take();
                    run_ev!(ev);
                }
            }

            // check the timeout
            match deadline {
                Some(d) if Instant::now() >= d => return Err(PollError::Timeout),
                _ => {}
            }
        }
    }
}

impl Drop for Cqueue {
    // this would cancel all unfinished select coroutines
    // and wait until all of them return back
    fn drop(&mut self) {
        // first cancel all the select coroutines if they are running
        self.selectors
            .lock()
            .unwrap()
            .iter()
            .map(|j| j.as_ref())
            .fold((), |_, join| match join {
                Some(j) if !j.is_done() => unsafe { j.coroutine().cancel() },
                _ => {}
            });

        // if self.is_panicking {
        //     return;
        // }

        // run the rest event
        loop {
            match self.poll(None) {
                Ok(_) => {}
                Err(_e @ PollError::Finished) => break,
                _ => unreachable!("cqueue drop unreachable"),
            }
        }
        // we are sure that all the coroutines are finished
    }
}

/// Create a new `scope`, for select coroutines.
///
/// Scopes, in particular, support scoped select coroutine spawning.
///
pub fn scope<'a, F, R>(f: F) -> R
where
    F: FnOnce(&Cqueue) -> R + 'a,
{
    let cqueue = Cqueue {
        ev_queue: Queue::new(),
        to_wake: AtomicOption::none(),
        cnt: AtomicUsize::new(0),
        selectors: Mutex::new(Vec::new()),
        total: AtomicUsize::new(0),
        is_panicking: AtomicBool::new(false),
    };
    f(&cqueue)
}

```

### Core Architecture Module: `src/crossbeam_queue_shim.rs`
```
use crossbeam::deque::{Stealer, Worker};

pub struct Local<T>(Worker<T>);
impl<T> Local<T> {
    pub fn pop(&self) -> Option<T> {
        self.0.pop()
    }

    pub fn push_back(&self, value: T) {
        self.0.push(value);
    }

    pub fn has_tasks(&self) -> bool {
        !self.0.is_empty()
    }
}

pub struct Steal<T>(Stealer<T>);

impl<T> Clone for Steal<T> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<T> Steal<T> {
    pub fn steal_into(&self, target: &Local<T>) -> Option<T> {
        loop {
            match self.0.steal_batch_and_pop(&target.0) {
                crossbeam::deque::Steal::Empty => return None,
                crossbeam::deque::Steal::Success(v) => return Some(v),
                crossbeam::deque::Steal::Retry => {}
            }
        }
    }
}

pub fn local<T: 'static>() -> (Steal<T>, Local<T>) {
    let worker = Worker::new_fifo();
    let stealer = Steal(worker.stealer());
    (stealer, Local(worker))
}

```

### Core Architecture Module: `src/io/event_loop.rs`
```
use std::io;

use super::sys::{Selector, SysEvent};
use crate::scheduler::{get_scheduler, WORKER_ID};

const IO_POLLS_MAX: usize = 1024;

/// Single threaded IO event loop.
pub struct EventLoop {
    selector: Selector,
}

impl EventLoop {
    pub fn new(io_workers: usize) -> io::Result<EventLoop> {
        Selector::new(io_workers).map(|selector| EventLoop { selector })
    }

    /// Keep spinning the event loop indefinitely, and notify the handler whenever
    /// any of the registered handles are ready.
    pub fn run(&self, id: usize) {
        WORKER_ID.set(id);

        let mut events_buf: [SysEvent; IO_POLLS_MAX] = unsafe { std::mem::zeroed() };
        let mut next_expire = None;
        let selector = &self.selector;
        let scheduler = get_scheduler();

        #[cfg(feature = "io_timeout")]
        let timeout_ns = crate::config().get_timeout_ns();
        #[cfg(not(feature = "io_timeout"))]
        let timeout_ns = 1_000_000_000; // 1s

        loop {
            next_expire = match selector.select(scheduler, id, &mut events_buf, next_expire) {
                Ok(t) => t.or(Some(timeout_ns)),
                Err(e) => {
                    error!("select error = {e:?}");
                    Some(timeout_ns)
                }
            }
        }
    }

    // get the internal selector
    #[inline]
    pub fn get_selector(&self) -> &Selector {
        &self.selector
    }
}

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

### Incident Patch 1: `93314756` (2026-07-11)
**Commit Message**: fix(io): map WSAECONNREFUSED (10061) to ConnectionRefused on Windows

On Windows, TCP connection attempts that receive WSAECONNREFUSED (10061)
return an io::Error with ErrorKind::Uncategorized instead of
ErrorKind::ConnectionRefused. This causes may_minihttp integration tests
to fail on Windows.

Remap 10061 explicitly in connect_complete().

**File**: `AI_USAGE_GUIDE.md` (removed, +0/-755)
```diff
@@ -1,755 +0,0 @@
-# May Rust Coroutine Library - AI Usage Guide
-
-## Overview
-
-**May** is a high-performance Rust library for stackful coroutines, providing Go-style goroutines for Rust. This guide provides comprehensive information for AI systems to properly understand, use, and contribute to the May codebase.
-
-## 🎯 Core Concepts
-
-### 1. Stackful Coroutines
-- **Definition**: Each coroutine has its own stack (default 32KB on 64-bit systems)
-- **Implementation**: Built on the `generator` library
-- **Scheduling**: Cooperative scheduling across configurable worker threads
-- **Memory**: Fixed stack size per coroutine (no automatic growth)
-
-### 2. Go-style Concurrency
-- **Philosophy**: Similar to Go's goroutines but with Rust safety guarantees
-- **Spawning**: Use `go!` macro instead of direct `spawn` calls
-- **Communication**: Channels (MPSC, MPMC, SPSC) and synchronization primitives
-
-## 🚀 Getting Started
-
-### Basic Coroutine Spawning
-
-```rust
-#[macro_use]
-extern crate may;
-
-// Simple coroutine
-let handle = go!(|| {
-    println!("Hello from coroutine!");
-});
-handle.join().unwrap();
-
-// With custom stack size
-let handle = go_with!(8192, || {
-    println!("Coroutine with 8KB stack");
-});
-
-// Named coroutine with custom stack
-let handle = go_with!("my_task", 16384, || {
-    println!("Named coroutine with 16KB stack");
-});
-```
-
-### Configuration
-
-```rust
-use may::config;
-
-fn setup_runtime() {
-    config()
-        .set_workers(4)           // 4 worker threads
-        .set_stack_size(0x2000)   // 8KB default stack
-        .set_pool_capacity(1000)  // Coroutine pool size
-        .set_worker_pin(true);    // Pin workers to CPU cores
-}
-```
-
-## 📚 API Reference
-
-### 1. Coroutine Management
-
-#### Spawning Coroutines
-```rust
-// Preferred: Use go! macro (safe)
-let handle = go!(|| {
-    // coroutine code
-});
-
-// Advanced: Use Builder for custom configuration
-let handle = go!(
-    coroutine::Builder::new()
-        .name("worker".to_string())
-        .stack_size(0x4000),
-    || {
-        // coroutine code
-    }
-);
-
-// Scoped coroutines (wait for all to complete)
-coroutine::scope(|scope| {
-    for i in 0..10 {
-        go!(scope, move || {
-            println!("Worker {}", i);
-        });
-    }
-    // All coroutines complete before scope exits
-});
-```
-
-#### Join Handles
-```rust
-let handle = go!(|| {
-    42
-});
-
-// Wait for completion and get result
-let result = handle.join().unwrap();
-assert_eq!(result, 42);
-
-// Check if done without blocking
-if handle.is_done() {
-    println!("Coroutine finished");
-}
-
-// Get coroutine handle for cancellation
-let co = handle.coroutine();
-unsafe { co.cancel(); } // Cancel the coroutine
-```
-
-### 2. Network I/O
-
-#### TCP Server
-```rust
-use may::net::TcpListener;
-use std::io::{Read, Write};
-
-let listener = TcpListener::bind("127.0.0.1:8080")?;
-for stream in listener.incoming() {
-    let mut stream = stream?;
-    go!(move || {
-        let mut buf = [0; 1024];
-        while let Ok(n) = stream.read(&mut buf) {
-            if n == 0 { break; }
-            stream.write_all(&buf[0..n])?;
-        }
-        Ok::<_, std::io::Error>(())
-    });
-}
-```
-
-#### UDP Socket
-```rust
-use may::net::UdpSocket;
-
-let socket = UdpSocket::bind("127.0.0.1:8080")?;
-let mut buf = [0; 1024];
-
-loop {
-    let (len, addr) = socket.recv_from(&mut buf)?;
-    socket.send_to(&buf[0..len], addr)?;
-}
-```
-
-#### Generic I/O Wrapper
-```rust
-use may::io::CoIo;
-use std::fs::File;
-
-// Wrap any I/O object for coroutine use
-let file = File::open("example.txt")?;
-let mut co_file = CoIo::new(file)?;
-
-// Now can be used in coroutine context without blocking
-let mut contents = String::new();
-co_file.read_to_string(&mut contents)?;
-```
-
-### 3. Synchronization Primitives
-
-#### Channels
-```rust
-use may::sync::mpsc;
-
-// MPSC Channel
-let (tx, rx) = mpsc::channel();
-go!(move || {
-    tx.send(42).unwrap();
-});
-let value = rx.recv().unwrap();
-
-// MPMC Channel
-use may::sync::mpmc;
-let (tx, rx) = mpmc::channel();
-
-// SPSC Channel (highest performance)
-use may::sync::spsc;
-let (tx, rx) = spsc::channel();
-```
-
-#### Mutex and RwLock
-```rust
-use may::sync::{Mutex, RwLock};
-use std::sync::Arc;
-
-// Mutex
-let data = Arc::new(Mutex::new(0));
-let data_clone = data.clone();
-
-go!(move || {
-    let mut guard = data_clone.lock().unwrap();
-    *guard += 1;
-});
-
-// RwLock
-let data = Arc::new(RwLock::new(vec![1, 2, 3]));
-let reader = data.read().unwrap();
-println!("Data: {:?}", *reader);
-```
-
-#### Semaphore and Barriers
-```rust
-use may::sync::{Semphore, Barrier};
-use std::sync::Arc;
-
-// Semaphore
-let sem = Arc::new(Semphore::new(3)); // Allow 3 concurrent access
-sem.wait(); // Acquire
-sem.post(); // Release
-
-// Barrier
-let barrier = Arc::new(Barrier::new(5)); // Wait for 5 coroutines
-let result = barrier.wait();
-if result.is_leader() {
-    println!("I'm the lead
```

**File**: `MAY_IMPROVEMENT_ANALYSIS.md` (removed, +0/-574)
```diff
@@ -1,574 +0,0 @@
-# May Rust Coroutine Library - Safety Improvement Analysis
-
-## Executive Summary
-
-This analysis examines the May Rust coroutine library to identify potential improvements that could eliminate the need for `unsafe` spawn functions and enhance overall safety. The current `unsafe` requirements stem from two primary concerns: **Thread Local Storage (TLS) access** and **stack overflow risks**. This document proposes concrete solutions to address these safety issues.
-
-## 🚨 Current Safety Issues
-
-### 1. Thread Local Storage (TLS) Safety
-**Problem**: Coroutines can migrate between threads, making TLS access undefined behavior.
-**Current Impact**: Requires `unsafe` spawn functions and careful developer discipline.
-
-### 2. Stack Overflow Risk  
-**Problem**: Fixed-size stacks with no automatic growth can cause segmentation faults.
-**Current Impact**: Requires `unsafe` spawn functions and manual stack size management.
-
-### 3. Blocking API Detection
-**Problem**: No compile-time or runtime detection of thread-blocking API usage.
-**Current Impact**: Performance degradation when developers accidentally use blocking APIs.
-
-## 🎯 Proposed Improvements
-
-## Improvement 1: Safe TLS Detection and Prevention
-
-### 1.1 Compile-Time TLS Detection
-```rust
-// New proc macro to detect TLS usage
-#[may_coroutine_safe]
-fn my_coroutine_function() {
-    // This would cause a compile error:
-    // thread_local! { static FOO: i32 = 42; }
-    
-    // This would be allowed:
-    coroutine_local! { static FOO: i32 = 42; }
-}
-
-// Implementation using syn/quote
-pub fn may_coroutine_safe(input: TokenStream) -> TokenStream {
-    // Parse function and scan for thread_local! usage
-    // Generate compile errors for unsafe patterns
-}
-```
-
-### 1.2 Runtime TLS Access Guard
-```rust
-// Enhanced coroutine spawn with TLS monitoring
-pub fn spawn_safe<F, T>(f: F) -> JoinHandle<T>
-where
-    F: FnOnce() -> T + Send + 'static + TlsSafe,
-    T: Send + 'static,
-{
-    // TlsSafe trait ensures no TLS access
-    spawn_impl_safe(f)
-}
-
-// Trait to mark TLS-safe functions
-pub unsafe auto trait TlsSafe {}
-
-// Explicitly opt-out functions that use TLS
-impl !TlsSafe for fn() {
-    // Functions using thread_local! would not implement TlsSafe
-}
-```
-
-### 1.3 TLS Access Runtime Detection
-```rust
-// Thread-local flag to detect TLS access in coroutines
-thread_local! {
-    static IN_COROUTINE: Cell<bool> = Cell::new(false);
-}
-
-// Modified coroutine execution wrapper
-fn run_coroutine_safe(mut co: CoroutineImpl) {
-    IN_COROUTINE.with(|flag| flag.set(true));
-    
-    // Install panic hook to catch TLS access
-    let old_hook = std::panic::take_hook();
-    std::panic::set_hook(Box::new(|info| {
-        if info.payload().downcast_ref::<TlsAccessError>().is_some() {
-            eprintln!("❌ FATAL: TLS access detected in coroutine context!");
-            std::process::abort();
-        }
-    }));
-    
-    match co.resume() {
-        Some(ev) => ev.subscribe(co),
-        None => Done::drop_coroutine(co),
-    }
-    
-    std::panic::set_hook(old_hook);
-    IN_COROUTINE.with(|flag| flag.set(false));
-}
-
-// TLS access detector (would need to be injected into std)
-struct TlsAccessError;
-
-fn check_tls_access() {
-    if IN_COROUTINE.with(|flag| flag.get()) {
-        panic!(TlsAccessError);
-    }
-}
-```
-
-## Improvement 2: Stack Safety Enhancements
-
-### 2.1 Stack Guard Pages
-```rust
-use std::alloc::{alloc, dealloc, Layout};
-use libc::{mprotect, PROT_NONE, PROT_READ, PROT_WRITE};
-
-pub struct SafeStack {
-    base: *mut u8,
-    size: usize,
-    guard_size: usize,
-}
-
-impl SafeStack {
-    pub fn new(size: usize) -> io::Result<Self> {
-        let page_size = page_size();
-        let guard_size = page_size;
-        let total_size = size + guard_size * 2; // Guard pages at both ends
-        
-        // Allocate memory
-        let layout = Layout::from_size_align(total_size, page_size)
-            .map_err(|_| io::Error::other("Invalid layout"))?;
-        
-        let base = unsafe { alloc(layout) };
-        if base.is_null() {
-            return Err(io::Error::other("Stack allocation failed"));
-        }
-        
-        // Protect guard pages
-        unsafe {
-            // Bottom guard page
-            mprotect(base as *mut _, guard_size, PROT_NONE);
-            // Top guard page  
-            mprotect(
-                base.add(guard_size + size) as *mut _, 
-                guard_size, 
-                PROT_NONE
-            );
-        }
-        
-        Ok(SafeStack {
-            base: unsafe { base.add(guard_size) }, // Start after guard page
-            size,
-            guard_size,
-        })
-    }
-    
-    pub fn usable_ptr(&self) -> *mut u8 {
-        self.base
-    }
-}
-
-impl Drop for SafeStack {
-    fn drop(&mut self) {
-        unsafe {
-            let layout = Layout::from_size_align_unchecked(
-                self.size + sel
```

**File**: `MAY_MESSAGE_PASSING_IMPROVEMENTS.md` (removed, +0/-668)
```diff
@@ -1,668 +0,0 @@
-# May Rust Coroutine Library - Message Passing Improvement Analysis
-
-## Executive Summary
-
-This analysis examines the current message passing implementations in May and identifies opportunities for significant performance and usability improvements. The current channel implementations (MPSC, MPMC, SPSC) are functional but have several optimization opportunities and missing features that could enhance the developer experience and system performance.
-
-## 🔍 Current State Analysis
-
-### Existing Channel Types
-
-#### 1. SPSC (Single Producer Single Consumer)
-**Location**: `src/sync/spsc.rs`, `may_queue/src/spsc.rs`
-**Performance**: Highest performance, lock-free with block-based queue
-**Strengths**:
-- Lock-free implementation
-- Block-based storage reduces allocation overhead
-- Bulk operations support (`bulk_pop`)
-- Cache-friendly design with padding
-
-**Weaknesses**:
-- Limited to single producer/consumer
-- Complex wake-up mechanism with dual thread/coroutine support
-- No backpressure control
-- Missing timeout operations for some methods
-
-#### 2. MPSC (Multi Producer Single Consumer)  
-**Location**: `src/sync/mpsc.rs`, `may_queue/src/mpsc.rs`
-**Performance**: Good performance for many-to-one scenarios
-**Strengths**:
-- Lock-free queue implementation
-- Supports timeout operations
-- Compatible with both threads and coroutines
-
-**Weaknesses**:
-- Single atomic blocker registration (contention under high load)
-- No priority message support
-- No batching operations
-- Limited flow control
-
-#### 3. MPMC (Multi Producer Multi Consumer)
-**Location**: `src/sync/mpmc.rs`
-**Performance**: Lower performance due to semaphore usage
-**Strengths**:
-- True multi-consumer support
-- Pressure monitoring (`pressure()` method)
-- Timeout support
-
-**Weaknesses**:
-- Uses semaphore which can be expensive
-- No work-stealing between consumers
-- No message prioritization
-- Limited scalability under high contention
-
-### Current Usage Patterns
-
-```rust
-// Basic usage - from examples/select.rs
-let (tx1, rx1) = mpsc::channel();
-let (tx2, rx2) = mpsc::channel();
-
-go!(move || {
-    tx2.send("hello").unwrap();
-    tx1.send(42).unwrap();
-});
-
-// Selection between channels
-let id = select!(
-    _ = rx1.recv() => println!("rx1 received"),
-    a = rx2.recv() => println!("rx2 received, a={a:?}")
-);
-```
-
-## 🚀 Proposed Improvements
-
-## Improvement 1: High-Performance Channel Variants
-
-### 1.1 Lock-Free MPMC with Work Stealing
-```rust
-pub mod sync {
-    pub mod mpmc_ws {
-        pub struct Channel<T> {
-            queues: Vec<WorkStealingQueue<T>>,
-            workers: AtomicUsize,
-            round_robin: AtomicUsize,
-        }
-        
-        impl<T> Channel<T> {
-            pub fn with_workers(worker_count: usize) -> (Sender<T>, Receiver<T>) {
-                // Each worker gets its own queue to reduce contention
-                // Receivers can steal work from other queues when empty
-            }
-            
-            pub fn send_to_worker(&self, worker_id: usize, item: T) -> Result<(), SendError<T>> {
-                // Direct worker targeting for CPU-bound task distribution
-            }
-        }
-    }
-}
-```
-
-### 1.2 Priority Channel Implementation
-```rust
-pub mod sync {
-    pub mod priority {
-        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
-        pub enum Priority {
-            Low = 0,
-            Normal = 1,
-            High = 2,
-            Critical = 3,
-        }
-        
-        pub struct PriorityChannel<T> {
-            queues: [Queue<T>; 4], // One queue per priority level
-            waiters: AtomicOption<Arc<Blocker>>,
-            priority_mask: AtomicU8, // Bitmask of non-empty priorities
-        }
-        
-        impl<T> PriorityChannel<T> {
-            pub fn send_priority(&self, item: T, priority: Priority) -> Result<(), SendError<T>> {
-                let queue_idx = priority as usize;
-                self.queues[queue_idx].push(item);
-                self.priority_mask.fetch_or(1 << queue_idx, Ordering::AcqRel);
-                self.wake_receiver();
-                Ok(())
-            }
-            
-            pub fn recv(&self) -> Result<(T, Priority), RecvError> {
-                // Always receive highest priority message first
-                for (idx, queue) in self.queues.iter().enumerate().rev() {
-                    if let Some(item) = queue.pop() {
-                        if queue.is_empty() {
-                            self.priority_mask.fetch_and(!(1 << idx), Ordering::AcqRel);
-                        }
-                        return Ok((item, Priority::from(idx)));
-                    }
-                }
-                // Block if no messages available
-                self.block_recv()
-            }
-        }
-    }
-}
-```
-
-### 1.3 Bounded Channels with Backpressure
-```rust
-pub mod sync {
-    pub mod bounded {
-        pub struct Bou
```

**File**: `src/io/sys/windows/miow.rs` (modified, +8/-1)
```diff
@@ -589,7 +589,14 @@ pub fn connect_complete(socket: RawSocket) -> io::Result<()> {
     if result == 0 {
         Ok(())
     } else {
-        Err(io::Error::last_os_error())
+        let err = io::Error::last_os_error();
+        // WSAECONNREFUSED (10061) is not mapped to ConnectionRefused by
+        // Rust's std::io::ErrorKind on Windows — remap it explicitly.
+        if err.raw_os_error() == Some(10061) {
+            Err(io::Error::new(io::ErrorKind::ConnectionRefused, err))
+        } else {
+            Err(err)
+        }
     }
 }
 
```

**File**: `tasks/tasks.md` (removed, +0/-634)
```diff
@@ -1,634 +0,0 @@
-# May Rust Coroutine Library - Implementation PRD
-
-## Executive Summary
-
-This Product Requirements Document (PRD) outlines the comprehensive implementation plan for enhancing the May Rust coroutine library based on three key analysis documents:
-
-1. **AI Usage Guide** - Comprehensive documentation and API reference
-2. **Safety Improvement Analysis** - Eliminating unsafe spawn requirements
-3. **Message Passing Improvements** - Enhanced channel implementations and patterns
-
-The implementation spans **24 months** across **6 major phases**, delivering significant performance improvements (10-50% throughput gains), enhanced safety (90%+ safe API coverage), and superior developer experience through modern patterns and comprehensive tooling.
-
-## 🎯 Project Objectives
-
-### Primary Goals
-- **Eliminate unsafe spawn requirements** through compile-time and runtime safety mechanisms
-- **Improve performance by 10-50%** via advanced channel designs and optimizations
-- **Enhance developer experience** with modern APIs, reactive patterns, and comprehensive tooling
-- **Maintain 100% backward compatibility** throughout the transition
-- **Position May as the leading Rust coroutine library** for high-performance applications
-
-### Success Metrics
-- **Safety**: 90%+ of coroutine spawning operations use safe APIs
-- **Performance**: 10-50% throughput improvement in benchmark scenarios
-- **Adoption**: 25% increase in GitHub stars and crate downloads
-- **Developer Satisfaction**: >4.5/5 rating in community surveys
-- **Ecosystem Integration**: 10+ major projects adopt enhanced May APIs
-
-## 📋 Feature Requirements
-
-## Phase 1: Foundation and Safety Infrastructure (Months 1-4)
-
-### 1.1 Safe Coroutine Spawning APIs
-
-**Priority: Critical**
-**Effort: 8 weeks**
-
-#### Requirements
-- **Compile-time TLS Detection**
-  - Implement proc macro `#[may_coroutine_safe]` to detect `thread_local!` usage
-  - Generate compile errors for unsafe TLS patterns
-  - Provide migration suggestions in error messages
-
-- **Runtime TLS Guards**
-  - Implement `TlsSafe` trait for spawn function parameters
-  - Add runtime TLS access monitoring with thread migration detection
-  - Create `CoroutineSafeSpawner` for verified safe spawning
-
-- **Type-Safe Spawn APIs**
-  - Implement `spawn_safe<F, T>()` function requiring `TlsSafe` bounds
-  - Add `CoroutineSafe` trait for automatic safety verification
-  - Create `SafeBuilder` pattern for coroutine configuration
-
-#### Acceptance Criteria
-- [ ] Compile-time macro detects 95%+ of TLS usage patterns
-- [ ] Runtime guards catch TLS violations with <1% performance overhead
-- [ ] All existing examples compile and run with new safe APIs
-- [ ] Comprehensive test suite covering safety edge cases
-
-### 1.2 Stack Safety Mechanisms
-
-**Priority: Critical**
-**Effort: 6 weeks**
-
-#### Requirements
-- **Stack Guard Pages**
-  - Implement memory protection for stack overflow detection
-  - Add configurable guard page sizes (4KB-16KB)
-  - Provide graceful error handling for stack overflow events
-
-- **Stack Monitoring**
-  - Add runtime stack usage tracking
-  - Implement stack watermark detection
-  - Create stack usage reporting and analytics
-
-- **Enhanced Stack Configuration**
-  - Extend builder pattern with stack safety options
-  - Add automatic stack size estimation based on function complexity
-  - Implement stack size recommendations
-
-#### Acceptance Criteria
-- [ ] Stack guard pages prevent 100% of overflow-related crashes
-- [ ] Stack monitoring adds <2% performance overhead
-- [ ] Automatic stack sizing reduces manual configuration by 80%
-- [ ] Stack safety works across all supported platforms
-
-### 1.3 Enhanced Builder Patterns
-
-**Priority: High**
-**Effort: 4 weeks**
-
-#### Requirements
-- **Safe Coroutine Builder**
-  - Implement fluent API for coroutine configuration
-  - Add compile-time validation of configuration combinations
-  - Provide sensible defaults for all safety options
-
-- **Configuration Validation**
-  - Add runtime validation of configuration parameters
-  - Implement configuration conflict detection
-  - Create helpful error messages for invalid configurations
-
-#### Acceptance Criteria
-- [ ] Builder API covers 100% of coroutine configuration options
-- [ ] Configuration validation catches common mistakes
-- [ ] API is intuitive and requires minimal documentation to use
-
-## Phase 2: Advanced Channel Infrastructure (Months 5-8)
-
-### 2.1 High-Performance Channel Variants
-
-**Priority: Critical**
-**Effort: 10 weeks**
-
-#### Requirements
-- **Lock-Free MPMC with Work Stealing**
-  - Implement per-worker queue design to reduce contention
-  - Add work stealing algorithm for load balancing
-  - Support direct worker targeting for CPU-bound tasks
-  - Achieve 2-5x performance improvement over current MPMC
-
-- **Priority Channel Implementation**
-  - Create multi-level priority queues (4 priority levels)
-  - Implement b
```

---

### Incident Patch 2: `51d17e00` (2025-11-26)
**Commit Message**: :pencil: fix test warnings

**File**: `tests/lib.rs` (modified, +1/-0)
```diff
@@ -260,6 +260,7 @@ fn park_timeout() {
             coroutine::park_timeout(Duration::from_millis(100));
             // this test may fail if the scheduler is a little bit slow
             // assert!(now.elapsed() < Duration::from_millis(100));
+            assert_eq!(a, 5);
             a = 10;
         });
 
```

---

### Incident Patch 3: `827ec065` (2025-08-21)
**Commit Message**: :bug: temp fix

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ log = "0.4"
 cfg-if = "1"
 num_cpus = "1"
 smallvec = "1"
-generator = "0.8"
+# generator = "0.8"
+generator = { git = "https://github.com/Xudong-Huang/generator-rs.git" }
 crossbeam = "0.8"
 parking_lot = "0.12"
 core_affinity = "0.8"
```

---

### Incident Patch 4: `8cc314b7` (2025-08-12)
**Commit Message**: :pencil: fix clippy warnings

**File**: `src/os/unix/net.rs` (modified, +1/-1)
```diff
@@ -531,7 +531,7 @@ impl UnixListener {
     ///     }
     /// }
     /// ```
-    pub fn incoming(&self) -> Incoming {
+    pub fn incoming(&self) -> Incoming<'_> {
         Incoming { listener: self }
     }
 }
```

---

### Incident Patch 5: `af5ba992` (2025-08-12)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/windows/miow.rs` (modified, +1/-1)
```diff
@@ -632,7 +632,7 @@ impl AcceptAddrsBuf {
     ///
     /// This function can be called after a call to `accept_overlapped` has
     /// succeeded to parse out the data that was written in.
-    pub fn parse(&self, socket: &TcpListener) -> io::Result<AcceptAddrs> {
+    pub fn parse(&self, socket: &TcpListener) -> io::Result<AcceptAddrs<'_>> {
         let mut ret = AcceptAddrs {
             local: std::ptr::null_mut(),
             local_len: 0,
```

**File**: `src/net/tcp.rs` (modified, +1/-1)
```diff
@@ -412,7 +412,7 @@ impl TcpListener {
         a.done()
     }
 
-    pub fn incoming(&self) -> Incoming {
+    pub fn incoming(&self) -> Incoming<'_> {
         Incoming { listener: self }
     }
 
```

**File**: `src/park.rs` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ impl Park {
         Ok(())
     }
 
-    fn delay_drop(&self) -> DropGuard {
+    fn delay_drop(&self) -> DropGuard<'_> {
         self.wait_kernel.store(true, Ordering::Release);
         DropGuard(self)
     }
```

**File**: `src/sync/delay_drop.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ impl DelayDrop {
         }
     }
 
-    pub fn delay_drop(&self) -> DropGuard {
+    pub fn delay_drop(&self) -> DropGuard<'_> {
         self.can_drop.store(2, Ordering::Release);
         DropGuard(self)
     }
```

**File**: `src/sync/mpmc.rs` (modified, +2/-2)
```diff
@@ -224,11 +224,11 @@ impl<T> Receiver<T> {
         self.inner.recv(Some(timeout))
     }
 
-    pub fn iter(&self) -> Iter<T> {
+    pub fn iter(&self) -> Iter<'_, T> {
         Iter { rx: self }
     }
 
-    pub fn try_iter(&self) -> TryIter<T> {
+    pub fn try_iter(&self) -> TryIter<'_, T> {
         TryIter { rx: self }
     }
 }
```

**File**: `src/sync/mpsc.rs` (modified, +2/-2)
```diff
@@ -228,11 +228,11 @@ impl<T> Receiver<T> {
         }
     }
 
-    pub fn iter(&self) -> Iter<T> {
+    pub fn iter(&self) -> Iter<'_, T> {
         Iter { rx: self }
     }
 
-    pub fn try_iter(&self) -> TryIter<T> {
+    pub fn try_iter(&self) -> TryIter<'_, T> {
         TryIter { rx: self }
     }
 }
```

**File**: `src/sync/mutex.rs` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ impl<T> Mutex<T> {
 }
 
 impl<T: ?Sized> Mutex<T> {
-    pub fn lock(&self) -> LockResult<MutexGuard<T>> {
+    pub fn lock(&self) -> LockResult<MutexGuard<'_, T>> {
         // try lock first
         match self.try_lock() {
             Ok(g) => return Ok(g),
@@ -113,7 +113,7 @@ impl<T: ?Sized> Mutex<T> {
         MutexGuard::new(self)
     }
 
-    pub fn try_lock(&self) -> TryLockResult<MutexGuard<T>> {
+    pub fn try_lock(&self) -> TryLockResult<MutexGuard<'_, T>> {
         match self
             .cnt
             .compare_exchange(0, 1, Ordering::SeqCst, Ordering::Relaxed)
```

**File**: `src/sync/rwlock.rs` (modified, +4/-4)
```diff
@@ -142,7 +142,7 @@ impl<T: ?Sized> RwLock<T> {
         }
     }
 
-    pub fn read(&self) -> LockResult<RwLockReadGuard<T>> {
+    pub fn read(&self) -> LockResult<RwLockReadGuard<'_, T>> {
         let mut r = self.rlock.lock().expect("rwlock read");
         if *r == 0 {
             if let Err(ParkError::Canceled) = self.lock() {
@@ -159,7 +159,7 @@ impl<T: ?Sized> RwLock<T> {
         RwLockReadGuard::new(self)
     }
 
-    pub fn try_read(&self) -> TryLockResult<RwLockReadGuard<T>> {
+    pub fn try_read(&self) -> TryLockResult<RwLockReadGuard<'_, T>> {
         let mut r = match self.rlock.try_lock() {
             Ok(r) => r,
             Err(TryLockError::Poisoned(_)) => {
@@ -190,15 +190,15 @@ impl<T: ?Sized> RwLock<T> {
         }
     }
 
-    pub fn write(&self) -> LockResult<RwLockWriteGuard<T>> {
+    pub fn write(&self) -> LockResult<RwLockWriteGuard<'_, T>> {
         if let Err(ParkError::Canceled) = self.lock() {
             // now we can safely go with the cancel panic
             trigger_cancel_panic();
         }
         RwLockWriteGuard::new(self)
     }
 
-    pub fn try_write(&self) -> TryLockResult<RwLockWriteGuard<T>> {
+    pub fn try_write(&self) -> TryLockResult<RwLockWriteGuard<'_, T>> {
         if let Err(TryLockError::WouldBlock) = self.try_lock() {
             return Err(TryLockError::WouldBlock);
         }
```

---

### Incident Patch 6: `b3b67a39` (2025-05-14)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/unix/epoll.rs` (modified, +4/-4)
```diff
@@ -153,7 +153,7 @@ impl Selector {
     pub fn wakeup(&self, id: usize) {
         let buf = 1u64.to_le_bytes();
         let ret = write(&self.vec[id].evfd, &buf);
-        trace!("wakeup id={:?}, ret={:?}", id, ret);
+        trace!("wakeup id={id:?}, ret={ret:?}");
     }
 
     // register io event to the selector
@@ -171,7 +171,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("add fd to epoll select, fd={:?}", fd);
+        info!("add fd to epoll select, fd={fd:?}");
         epoll
             .add(unsafe { BorrowedFd::borrow_raw(fd) }, info)
             .map_err(from_nix_error)
@@ -196,7 +196,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("mod fd to epoll select, fd={:?}, is_read={}", fd, is_read);
+        info!("mod fd to epoll select, fd={fd:?}, is_read={is_read}");
         epoll
             .modify(unsafe { BorrowedFd::borrow_raw(fd) }, &mut info)
             .map_err(from_nix_error)
@@ -219,7 +219,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("del fd from epoll select, fd={:?}", fd);
+        info!("del fd from epoll select, fd={fd:?}");
         epoll.delete(unsafe { BorrowedFd::borrow_raw(fd) }).ok();
 
         // after EpollCtlDel push the unused event data
```

---

### Incident Patch 7: `ba004942` (2025-05-13)
**Commit Message**: :pencil: fix nix read

**File**: `src/io/sys/unix/epoll.rs` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 use std::io;
 use std::os::fd::AsFd;
-use std::os::fd::AsRawFd;
 use std::os::fd::BorrowedFd;
 use std::sync::atomic::Ordering;
 use std::sync::Arc;
@@ -100,7 +99,7 @@ impl Selector {
                 // this is just a wakeup event, ignore it
                 let mut buf = [0u8; 8];
                 // clear the eventfd, ignore the result
-                read(single_selector.evfd.as_raw_fd(), &mut buf).ok();
+                read(single_selector.evfd.as_fd(), &mut buf).ok();
                 // info!("got wakeup event in select, id={}", id);
                 scheduler.collect_global(id);
                 continue;
```

**File**: `src/io/sys/unix/net/socket_read.rs` (modified, +3/-1)
```diff
@@ -1,4 +1,5 @@
 use std::io;
+use std::os::fd::BorrowedFd;
 use std::sync::atomic::Ordering;
 #[cfg(feature = "io_timeout")]
 use std::time::Duration;
@@ -35,14 +36,15 @@ impl<'a> SocketRead<'a> {
     }
 
     pub fn done(&mut self) -> io::Result<usize> {
+        let fd = unsafe { BorrowedFd::borrow_raw(self.io_data.fd) };
         loop {
             co_io_result(self.is_coroutine)?;
 
             // clear the io_flag
             self.io_data.io_flag.store(0, Ordering::Relaxed);
 
             // finish the read operation
-            match read(self.io_data.fd, self.buf) {
+            match read(fd, self.buf) {
                 Ok(n) => return Ok(n),
                 Err(e) => {
                     if e == nix::errno::Errno::EAGAIN {
```

---

### Incident Patch 8: `05dfb349` (2025-05-13)
**Commit Message**: :pencil: fix clippy warnings

**File**: `src/config.rs` (modified, +3/-3)
```diff
@@ -39,7 +39,7 @@ impl Config {
     ///
     /// the minimum worker thread is 1, if you pass 0 to it, will use internal default
     pub fn set_workers(&self, workers: usize) -> &Self {
-        info!("set workers={:?}", workers);
+        info!("set workers={workers:?}");
         WORKERS.store(workers, Ordering::Relaxed);
         self
     }
@@ -66,7 +66,7 @@ impl Config {
     ///
     /// if you pass 0 to it, will use internal default
     pub fn set_pool_capacity(&self, capacity: usize) -> &Self {
-        info!("set pool capacity={:?}", capacity);
+        info!("set pool capacity={capacity:?}");
         POOL_CAPACITY.store(capacity, Ordering::Release);
         self
     }
@@ -85,7 +85,7 @@ impl Config {
     ///
     /// if you pass 0 to it, will use internal default
     pub fn set_stack_size(&self, size: usize) -> &Self {
-        info!("set stack size={:?}", size);
+        info!("set stack size={size:?}");
         STACK_SIZE.store(size, Ordering::Release);
         self
     }
```

**File**: `src/io/event_loop.rs` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ impl EventLoop {
             next_expire = match selector.select(scheduler, id, &mut events_buf, next_expire) {
                 Ok(t) => t.or(Some(timeout_ns)),
                 Err(e) => {
-                    error!("select error = {:?}", e);
+                    error!("select error = {e:?}");
                     Some(timeout_ns)
                 }
             }
```

**File**: `src/io/sys/windows/cancel.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ impl CancelIoData {
         let ret = CancelIoEx(handle, overlapped);
         if ret == 0 {
             let err = io::Error::last_os_error();
-            error!("cancel err={:?}", err);
+            error!("cancel err={err:?}");
             // ev.co.take().map(|co| get_scheduler().schedule(co));
             Err(err)
         } else {
```

**File**: `src/io/sys/windows/iocp.rs` (modified, +2/-2)
```diff
@@ -165,7 +165,7 @@ impl Selector {
                     // the timeout function would remove the timer handle
                 }
                 err => {
-                    error!("iocp err=0x{:08x}", err);
+                    error!("iocp err=0x{err:08x}");
                     unsafe {
                         // convert the ntstatus to winerr
                         let mut size: u32 = 0;
@@ -248,6 +248,6 @@ pub fn timeout_handler(data: TimerData) {
         event_data.timer.take();
         // ignore the error, the select may grab the data first!
         cancel_io(event_data.handle, event_data.get_overlapped())
-            .unwrap_or_else(|e| error!("CancelIoEx failed! e = {}", e));
+            .unwrap_or_else(|e| error!("CancelIoEx failed! e = {e}"));
     }
 }
```

---

### Incident Patch 9: `3ff1a096` (2025-03-24)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/windows/net/tcp_listener_accept.rs` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ impl<'a> TcpListenerAccept<'a> {
 
         let addr = self.addr.parse(self.socket).and_then(|a| {
             a.remote().ok_or_else(|| {
-                io::Error::new(io::ErrorKind::Other, "could not obtain remote address")
+                io::Error::other("could not obtain remote address")
             })
         })?;
 
```

**File**: `src/io/sys/windows/net/tcp_stream_connect.rs` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ impl TcpStreamConnect {
         // here we should use a thread to finish the resolve?
         addr.to_socket_addrs()?
             .next()
-            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no socket addresses resolved"))
+            .ok_or_else(|| io::Error::other("no socket addresses resolved"))
             .and_then(|addr| {
                 let socket = match addr {
                     SocketAddr::V4(..) => Socket::new(Domain::IPV4, Type::STREAM, None)?,
```

**File**: `src/io/sys/windows/net/udp_recv_from.rs` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ impl<'a> UdpRecvFrom<'a> {
     pub fn done(&mut self) -> io::Result<(usize, SocketAddr)> {
         let size = co_io_result(&self.io_data, self.is_coroutine)?;
         let addr = self.addr.get_socket_addr().ok_or_else(|| {
-            io::Error::new(io::ErrorKind::Other, "could not obtain remote address")
+            io::Error::other("could not obtain remote address")
         })?;
         Ok((size, addr))
     }
```

**File**: `src/io/sys/windows/net/udp_send_to.rs` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ impl<'a> UdpSendTo<'a> {
     ) -> io::Result<Self> {
         addr.to_socket_addrs()?
             .next()
-            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no socket addresses resolved"))
+            .ok_or_else(|| io::Error::other("no socket addresses resolved"))
             .map(|addr| UdpSendTo {
                 io_data: EventData::new(socket.as_raw_socket() as HANDLE),
                 buf,
```

---

### Incident Patch 10: `dda84cb1` (2025-03-24)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `examples/echo_client.rs` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ fn main() {
 
     let msg = vec![0; test_msg_len];
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `examples/echo_udp_client.rs` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ fn main() {
     let test_conn_num = args.flag_c;
     let test_seconds = args.flag_d;
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `examples/echo_udp_client1.rs` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ fn main() {
     let test_conn_num = args.flag_c;
     let test_seconds = args.flag_d;
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `may_queue/src/mpsc_list.rs` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ impl<T> Queue<T> {
     pub fn is_empty(&self) -> bool {
         let tail = unsafe { *self.tail.get() };
         // the list is empty
-        self.head.load(Ordering::Acquire) == tail
+        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
     }
 
     /// Pops some data from this queue.
@@ -62,7 +62,7 @@ impl<T> Queue<T> {
             let tail = *self.tail.get();
 
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
```

**File**: `may_queue/src/mpsc_list_v1.rs` (modified, +5/-5)
```diff
@@ -172,7 +172,7 @@ impl<T> Queue<T> {
             (*node).prev = prev;
             (*prev).next.store(node, Ordering::Release);
             let tail = *self.tail.get();
-            let is_head = tail == prev;
+            let is_head = std::ptr::eq(tail, prev);
             (Entry(ptr::NonNull::new_unchecked(node)), is_head)
         }
     }
@@ -182,7 +182,7 @@ impl<T> Queue<T> {
     pub fn is_empty(&self) -> bool {
         let tail = unsafe { *self.tail.get() };
         // the list is empty
-        self.head.load(Ordering::Acquire) == tail
+        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
     }
 
     /// get the head ref
@@ -192,7 +192,7 @@ impl<T> Queue<T> {
     pub unsafe fn peek(&self) -> Option<&T> {
         let tail = *self.tail.get();
         // the list is empty
-        if self.head.load(Ordering::Acquire) == tail {
+        if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
             return None;
         }
         // spin until tail next become non-null
@@ -219,7 +219,7 @@ impl<T> Queue<T> {
         unsafe {
             let tail = *self.tail.get();
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
@@ -270,7 +270,7 @@ impl<T> Queue<T> {
             let tail = *self.tail.get();
 
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
```

**File**: `may_queue/src/spmc.rs` (modified, +9/-5)
```diff
@@ -195,7 +195,7 @@ impl<T> Queue<T> {
         loop {
             head = (head as usize & !(1 << 63)) as *mut BlockNode<T>;
             let (block, id) = BlockPtr::unpack(head);
-            if block == tail_block && id >= (push_index & BLOCK_MASK) {
+            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                 return None;
             }
 
@@ -265,7 +265,7 @@ impl<T> Queue<T> {
         loop {
             head = (head as usize & !(1 << 63)) as *mut BlockNode<T>;
             let (block, id) = BlockPtr::unpack(head);
-            if block == tail_block && id >= (push_index & BLOCK_MASK) {
+            if std::ptr::eq(block, tail_block) && id >= (push_index & BLOCK_MASK) {
                 return None;
             }
 
@@ -336,11 +336,15 @@ impl<T> Queue<T> {
             let (block, id) = BlockPtr::unpack(head);
             let push_id = push_index & BLOCK_MASK;
             // at least leave one element to the owner
-            if block == tail_block && id >= push_id {
+            if std::ptr::eq(block, tail_block) && id >= push_id {
                 return SmallVec::new();
             }
 
-            let new_id = if block != tail_block { 0 } else { push_id };
+            let new_id = if !std::ptr::eq(block, tail_block) {
+                0
+            } else {
+                push_id
+            };
 
             let new_head = if new_id == 0 {
                 (head as usize | (1 << 63)) as *mut BlockNode<T>
@@ -435,7 +439,7 @@ impl<T> Queue<T> {
         let push_index = self.tail.index.load(Ordering::Acquire);
         let tail_block = self.tail.block.load(Ordering::Acquire);
 
-        block == tail_block && id == (push_index & BLOCK_MASK)
+        std::ptr::eq(block, tail_block) && id == (push_index & BLOCK_MASK)
     }
 }
 
```

**File**: `may_queue/src/spsc.rs` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@ impl<T> Drop for Queue<T> {
         #[cfg(feature = "inner_cache")]
         let mut first = self.first.load(Ordering::Relaxed);
         #[cfg(feature = "inner_cache")]
-        while first != tail {
+        while !std::ptr::eq(first, tail) {
             let next = unsafe { &*first }.next.load(Ordering::Relaxed);
             let _ = unsafe { Box::from_raw(first) };
             first = next;
```

**File**: `src/cancel.rs` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ impl<T: CancelIo> CancelImpl<T> {
             if let Some(mut co) = co.take() {
                 // this is not safe, the kernel may still need to use the overlapped
                 // set the cancel result for the coroutine
-                set_co_para(&mut co, io::Error::new(io::ErrorKind::Other, "Canceled"));
+                set_co_para(&mut co, io::Error::other("Canceled"));
                 get_scheduler().schedule(co);
             }
         }
```

---

### Incident Patch 11: `b9dae541` (2025-02-25)
**Commit Message**: :pencil: fix windows struct offset

**File**: `src/io/sys/windows/miow.rs` (modified, +1/-2)
```diff
@@ -662,8 +662,7 @@ impl AcceptAddrsBuf {
 
     #[allow(deref_nullptr)]
     fn args(&self) -> (*mut std::ffi::c_void, u32, u32, u32) {
-        let remote_offset =
-            unsafe { &(*(std::ptr::null::<AcceptAddrsBuf>())).remote as *const _ as usize };
+        let remote_offset = std::mem::offset_of!(AcceptAddrsBuf, remote);
         (
             self as *const _ as *mut _,
             0,
```

---

### Incident Patch 12: `f31fd807` (2025-01-15)
**Commit Message**: :pencil: fix compile error

**File**: `src/io/event_loop.rs` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@ impl EventLoop {
         loop {
             next_expire = match selector.select(scheduler, id, &mut events_buf, next_expire) {
                 Ok(t) => t.or(Some(timeout_ns)),
-                Err(e) => error!("select error = {:?}", e),
+                Err(e) => {
+                    error!("select error = {:?}", e);
+                    Some(timeout_ns)
+                }
             }
         }
     }
```

---

### Incident Patch 13: `d3947897` (2024-12-23)
**Commit Message**: :pencil: panic on eventloop select error

**File**: `src/io/event_loop.rs` (modified, +1/-4)
```diff
@@ -33,10 +33,7 @@ impl EventLoop {
         loop {
             next_expire = match selector.select(scheduler, id, &mut events_buf, next_expire) {
                 Ok(t) => t.or(Some(timeout_ns)),
-                Err(e) => {
-                    error!("select error = {:?}", e);
-                    continue;
-                }
+                Err(e) => panic!("select error = {:?}", e),
             }
         }
     }
```

---

### Incident Patch 14: `78434623` (2024-12-23)
**Commit Message**: pencil: fix wrongly set std io nonblocking

this test was setting std input to nonblocking mode, and would affect
std out print function. so we have to use a real file that is safe to
set to nonblocking

**File**: `src/io/sys/unix/co_io.rs` (modified, +15/-3)
```diff
@@ -268,11 +268,23 @@ mod tests {
     #[test]
     fn compile_co_io() {
         #[derive(Debug)]
-        struct Fd;
+        struct Fd {
+            file: std::net::UdpSocket,
+        }
+
+        impl Fd {
+            fn new() -> Self {
+                Fd {
+                    // this would call set_nonblocking for the fd
+                    // so we need to open a real fd here
+                    file: std::net::UdpSocket::bind(("127.0.0.1", 9765)).unwrap(),
+                }
+            }
+        }
 
         impl AsRawFd for Fd {
             fn as_raw_fd(&self) -> RawFd {
-                0
+                self.file.as_raw_fd()
             }
         }
 
@@ -283,7 +295,7 @@ mod tests {
             }
         }
 
-        let a = Fd;
+        let a = Fd::new();
         let mut io = CoIo::new(a).unwrap();
         let mut buf = [0u8; 100];
         io.read_exact(&mut buf).unwrap();
```

---

### Incident Patch 15: `d3d4042e` (2024-12-19)
**Commit Message**: :pencil: fix cargo clippy

**File**: `src/io/sys/unix/kqueue.rs` (modified, +2/-2)
```diff
@@ -282,15 +282,15 @@ impl Selector {
     #[inline]
     pub fn del_fd(&self, io_data: &IoData) {
         #[cfg(feature = "io_timeout")]
-        io_data.timer.borrow_mut().take().map(|h| {
+        if let Some(h) = io_data.timer.borrow_mut().take() {
             unsafe {
                 // mark the timer as removed if any, this only happened
                 // when cancel an IO. what if the timer expired at the same time?
                 // because we run this func in the user space, so the timer handler
                 // will not got the coroutine
                 h.with_mut_data(|value| value.data.event_data = ptr::null_mut());
             }
-        });
+        }
 
         let fd = io_data.fd;
         let id = fd as usize % self.vec.len();
```

#### Recent Merged Pull Requests:
- **PR #127** (2026-08-03): Update the generator-rs Version (@BersisSe)
- **PR #125** (2026-07-17): Fix/wsa connrefused mapping (@casibbald)
- **PR #123** (closed): Refs/heads/fix/wsa connrefused mapping (@casibbald)
- **PR #118** (closed): safe coroutine spawning (@casibbald)
- **PR #116** (closed): 2025-05-12 @weix2025 (@ghost)
- **PR #113** (2025-03-15): Remove object lifetime cast (@BoxyUwU)
- **PR #108** (2024-09-01): A variety of changes (@pyprogrammer)
- **PR #104** (2023-06-09): add aarch64 macOS support to README (@Leandros)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
