# Forensic Learning Record (Deep Inspection): DataDog/glommio

> **Canonical Artifact**: `07_PROJECT_LEARNING/datadog-glommio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DataDog/glommio](https://github.com/DataDog/glommio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:25.052Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DataDog/glommio`
- **Description**: Glommio is a thread-per-core crate that makes writing highly parallel asynchronous applications in a thread-per-core architecture easier for rustaceans.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3663 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `glommio/benches/spsc_queue.rs`
```
use glommio::channels::spsc_queue;
use std::time::Instant;

fn test_spsc(capacity: usize) {
    const RUNS: u32 = 10 * 1000 * 1000;
    let (sender, receiver) = spsc_queue::make::<u64>(1024);
    let consumer = std::thread::spawn(move || {
        let t = Instant::now();
        for _ in 0..RUNS {
            while receiver.try_pop().is_none() {}
        }
        println!(
            "cost of receiving {:#?}, capacity {}",
            t.elapsed() / RUNS,
            capacity,
        );
    });
    let t = Instant::now();
    for i in 0..RUNS {
        while sender.try_push(i as u64).is_some() {}
    }
    println!(
        "cost of sending {:#?}, capacity {}",
        t.elapsed() / RUNS,
        capacity
    );
    consumer.join().unwrap();
}

fn main() {
    test_spsc(1024);
}

```

### Core Architecture Module: `glommio/src/channels/spsc_queue.rs`
```
use std::{
    cell::{Cell, UnsafeCell},
    fmt,
    marker::PhantomData,
    mem::{self, MaybeUninit},
    slice::from_raw_parts_mut,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
};

#[derive(Debug)]
#[repr(align(128))]
struct ProducerCacheline {
    /// Index position of current tail
    tail: AtomicUsize,
    limit: Cell<usize>,
    /// Id == 0 : never connected
    /// Id == usize::MAX: disconnected
    consumer_id: AtomicUsize,
}

#[derive(Debug)]
#[repr(align(128))]
struct ConsumerCacheline {
    /// Index position of the current head
    head: AtomicUsize,
    /// Id == 0 : never connected
    /// Id == usize::MAX: disconnected
    producer_id: AtomicUsize,
}

#[derive(Debug)]
struct Slot<T> {
    value: UnsafeCell<MaybeUninit<T>>,
    has_value: AtomicBool,
}

/// The internal memory buffer used by the queue.
///
/// `Buffer` holds a pointer to allocated memory which represents the bounded
/// ring buffer, as well as a head and tail `AtomicUsize` which the producer and
/// consumer use to track location in the ring.
#[repr(C)]
pub(crate) struct Buffer<T> {
    buffer_storage: *mut Slot<T>,
    capacity: usize,
    mask: usize,
    lookahead: usize,

    pcache: ProducerCacheline,
    ccache: ConsumerCacheline,

    _marker: PhantomData<T>,
}

impl<T> fmt::Debug for Buffer<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let head = self.ccache.head.load(Ordering::Relaxed);
        let tail = self.pcache.tail.load(Ordering::Relaxed);
        let limit = self.pcache.limit.get();
        let id_to_str = |id| match id {
            0 => "not connected".into(),
            usize::MAX => "disconnected".into(),
            x => format!("{x}"),
        };

        let consumer_id = id_to_str(self.pcache.consumer_id.load(Ordering::Relaxed));
        let producer_id = id_to_str(self.ccache.producer_id.load(Ordering::Relaxed));

        f.debug_struct("SPSC Buffer")
            .field("capacity:", &self.capacity)
            .field("consumer_head:", &head)
            .field("producer_tail:", &tail)
            .field("lookahead_limit:", &limit)
            .field("consumer_id:", &consumer_id)
            .field("producer_id:", &producer_id)
            .finish()
    }
}

unsafe impl<T: Sync> Sync for Buffer<T> {}

/// A handle to the queue which allows consuming values from the buffer
pub struct Consumer<T> {
    pub(crate) buffer: Arc<Buffer<T>>,
}

impl<T> Clone for Consumer<T> {
    fn clone(&self) -> Self {
        Consumer {
            buffer: self.buffer.clone(),
        }
    }
}

/// A handle to the queue which allows adding values onto the buffer
pub struct Producer<T> {
    pub(crate) buffer: Arc<Buffer<T>>,
}

impl<T> Clone for Producer<T> {
    fn clone(&self) -> Self {
        Producer {
            buffer: self.buffer.clone(),
        }
    }
}

impl<T> fmt::Debug for Consumer<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Consumer {:?}", self.buffer)
    }
}

impl<T> fmt::Debug for Producer<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Producer {:?}", self.buffer)
    }
}

unsafe impl<T: Send> Send for Consumer<T> {}
unsafe impl<T: Send> Send for Producer<T> {}

impl<T> Buffer<T> {
    /// Attempt to pop a value off the buffer.
    ///
    /// If the buffer is empty, this method will not block. Instead, it will
    /// return `None` signifying the buffer was empty. The caller may then
    /// decide what to do next (e.g. spin-wait, sleep, process something
    /// else, etc.)
    fn try_pop(&self) -> Option<T> {
        let head = self.ccache.head.load(Ordering::Relaxed);
        let slot = unsafe { &*self.buffer_storage.add(head & self.mask) };
        if !slot.has_value.load(Ordering::Acquire) {
            return None;
        }
        let v = Some(unsafe { slot.value.get().read().assume_init() });
        slot.has_value.store(false, Ordering::Release);
        self.ccache.head.store(head + 1, Ordering::Relaxed);
        v
    }

    fn has_space(&self, tail: usize) -> bool {
        let index = (tail + self.lookahead) & self.mask;
        let slot = unsafe { &*self.buffer_storage.add(index) };
        if !slot.has_value.load(Ordering::Acquire) {
            self.pcache.limit.set(tail + self.lookahead + 1);
            true
        } else {
            let slot = unsafe { &*self.buffer_storage.add(tail & self.mask) };
            !slot.has_value.load(Ordering::Acquire)
        }
    }

    /// Attempt to push a value onto the buffer.
    ///
    /// If the buffer is full, this method will not block.  Instead, it will
    /// return `Some(v)`, where `v` was the value attempting to be pushed
    /// onto the buffer.  If the value was successfully pushed onto the
    /// buffer, `None` will be returned signifying success.
    fn try_push(&self, v: T) -> Option<T> {
        if self.consumer_disconnected() {
            return Some(v);
        }
        let tail = self.pcache.tail.load(Ordering::Relaxed);
        if tail >= self.pcache.limit.get() && !self.has_space(tail) {
            return Some(v);
        }
        let slot = unsafe {
            let slot = &*self.buffer_storage.add(tail & self.mask);
            slot.value.get().write(MaybeUninit::new(v));
            slot
        };
        slot.has_value.store(true, Ordering::Release);
        self.pcache.tail.store(tail + 1, Ordering::Relaxed);
        None
    }

    /// Disconnects the consumer, and returns whether it was already
    /// disconnected
    pub(crate) fn disconnect_consumer(&self) -> bool {
        self.pcache.consumer_id.swap(usize::MAX, Ordering::Release) == usize::MAX
    }

    /// Disconnects the producer, and returns whether it was already
    /// disconnected
    pub(crate) fn disconnect_producer(&self) -> bool {
        self.ccache.producer_id.swap(usize::MAX, Ordering::Release) == usize::MAX
    }

    /// Returns whether the producer is disconnected.
    pub(crate) fn producer_disconnected(&self) -> bool {
        self.ccache.producer_id.load(Ordering::Acquire) == usize::MAX
    }

    /// Returns whether the consumer is disconnected.
    pub(crate) fn consumer_disconnected(&self) -> bool {
        self.pcache.consumer_id.load(Ordering::Acquire) == usize::MAX
    }

    /// Returns the current size of the queue
    ///
    /// This value represents the current size of the queue.  This value can be
    /// from 0-`capacity` inclusive.
    pub(crate) fn size(&self) -> usize {
        std::cmp::min(
            self.capacity,
            self.pcache
                .tail
                .load(Ordering::Acquire)
                .saturating_sub(self.ccache.head.load(Ordering::Acquire)),
        )
    }
}

/// Handles deallocation of heap memory when the buffer is dropped
impl<T> Drop for Buffer<T> {
    fn drop(&mut self) {
        // Pop the rest of the values off the queue. By moving them into this scope,
        // we implicitly call their destructor
        while self.try_pop().is_some() {}
        // We don't want to run any destructors here, because we didn't run
        // any of the constructors through the vector. And whatever object was
        // in fact still alive we popped above.
        let _drop = unsafe {
            // Nightly clippy warns about this but ptr::from_raw_parts_mut isn't stable yet.
            #[allow(clippy::cast_slice_from_raw_parts)]
            let ptr = from_raw_parts_mut(self.buffer_storage, self.capacity) as *mut [Slot<T>];
            Box::from_raw(ptr)
        };
    }
}

/// Creates a new `spsc_queue` returning its producer and consumer
/// endpoints.
pub fn make<T>(capacity: usize) -> (Producer<T>, Consumer<T>) {
    inner_make(capacity, 0)
}

const MAX_LOOKAHEAD: usize = 1 << 12;

fn inner_make<T>(capacity: usize, initial_value: usize) -> (Producer<T>, Consumer<T>) {
    let capacity = capacity.next_power_of_two();
    let buffer_storage = allocate_buffer::<T>(capacity);
    let buf = Arc::new(Buffer {
        buffer_storage,
        capacity,
        mask: capacity - 1,
        lookahead: std::cmp::min(capacity / 4, MAX_LOOKAHEAD),
        pcache: ProducerCacheline {
            tail: AtomicUsize::new(initial_value),
            limit: Cell::new(0),
            consumer_id: AtomicUsize::new(0),
        },
        ccache: ConsumerCacheline {
            head: AtomicUsize::new(initial_value),
            producer_id: AtomicUsize::new(0),
        },
        _marker: PhantomData,
    });
    (
        Producer {
            buffer: buf.clone(),
        },
        Consumer { buffer: buf },
    )
}

fn allocate_buffer<T>(capacity: usize) -> *mut Slot<T> {
    let mut boxed: Box<[Slot<T>]> = (0..capacity)
        .map(|_| Slot {
            has_value: AtomicBool::new(false),
            value: UnsafeCell::new(MaybeUninit::uninit()),
        })
        .collect();
    let ptr = boxed.as_mut_ptr();
    mem::forget(boxed);
    ptr
}

pub(crate) trait BufferHalf {
    type Item;

    fn buffer(&self) -> &Buffer<Self::Item>;
    fn connect(&self, id: usize);
    fn peer_id(&self) -> usize;

    /// Returns the total capacity of this queue
    ///
    /// This value represents the total capacity of the queue when it is full.
    /// It does not represent the current usage.  For that, call `size()`.
    fn capacity(&self) -> usize {
        self.buffer().capacity
    }

    /// Returns the current size of the queue
    ///
    /// This value represents the current size of the queue.  This value can be
    /// from 0-`capacity` inclusive.
    fn size(&self) -> usize {
        self.buffer().size()
    }
}

impl<T> BufferHalf for Producer<T> {
    type Item = T;
    fn buffer(&self) -> &Buffer<T> {
        &self.buffer
    }

    fn connect(&self, id: usize) {
        assert_ne!(id, 0);
        assert_ne!(id, usize::MAX);
        self.buffer.ccache.producer_id.store(id, Ordering::Release);
    }

    fn peer_id(&self) -> usize {
        self.buf
```

### Core Architecture Module: `glommio/src/controllers/deadline_queue.rs`
```
// Unless explicitly stated otherwise all files in this repository are licensed
// under the MIT/Apache-2.0 License, at your convenience
//
// This product includes software developed at Datadog (https://www.datadoghq.com/). Copyright 2020 Datadog, Inc.

use crate::{
    channels::local_channel::{self, LocalReceiver, LocalSender},
    controllers::ControllerStatus,
    enclose, task, Latency, Shares, SharesManager, TaskQueueHandle,
};
use futures_lite::StreamExt;
use log::{trace, warn};
use std::{
    cell::{Cell, RefCell},
    collections::VecDeque,
    fmt,
    future::Future,
    io,
    pin::Pin,
    rc::Rc,
    time::{Duration, Instant},
};

/// Items going into the [`DeadlineQueue`] must implement this trait.
///
/// It allows the [`DeadlineQueue`] to understand the progress and expectations
/// of processing this item
///
/// [`DeadlineQueue`]: struct.DeadlineQueue.html
pub trait DeadlineSource {
    /// What type is returned by the [`action`] method
    ///
    /// [`action`]: trait.DeadlineSource.html#tymethod.action
    type Output;

    /// Returns a [`Duration`] indicating when we would like this operation to
    /// complete.
    ///
    /// It is calculated from the point of Queueing, not from the point in which
    /// the operation starts.
    fn expected_duration(&self) -> Duration;

    /// The action to execute. Usually your struct will implement an async
    /// function that you want to see completed at a particular deadline,
    /// and then the implementation of this would be:
    ///
    /// ```ignore
    /// fn action(&self) -> Pin<Box<dyn Future<Output = io::Result<Duration>> + 'static>> {
    ///    Box::pin(self.my_action())
    /// }
    /// ```
    fn action(self: Rc<Self>) -> Pin<Box<dyn Future<Output = Self::Output> + 'static>>;

    /// The total amount of units to be processed.
    ///
    /// This could be anything you want:
    /// * If you are flushing a file, this could indicate the size in bytes of
    ///   the buffer
    /// * If you are scanning an array, this could be the number of elements.
    ///
    /// As long as this quantity is consistent with [`processed_units`] the
    /// controllers should work.
    ///
    /// This need not be static. On the contrary: as you are filling a new
    /// buffer you can already add it to the queue and increase its total
    /// units as the buffer is written to. This can lead to smoother
    /// operation as opposed to just adding a lot of units at once.
    ///
    /// [`processed_units`]: trait.DeadlineSource.html#tymethod.processed_units
    fn total_units(&self) -> u64;

    /// The amount of units that were already processed.
    ///
    /// The units should match the quantities specified in [`total_units`].
    /// The more often the system is made aware of processed units, the smoother
    /// the controller will be.
    ///
    /// For example, you can buffer all updates and just inform that
    /// processed_units == total_units at the end of the process, but then
    /// the controller would be a step function.
    ///
    /// [`total_units`]: trait.DeadlineSource.html#tymethod.total_units
    fn processed_units(&self) -> u64;
}

impl<T> fmt::Debug for dyn DeadlineSource<Output = T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "DeadlineSource processed {} out of {}",
            self.processed_units(),
            self.total_units()
        )
    }
}

#[derive(Debug)]
/// Allows the priority of the [`DeadlineQueue`] to be temporarily bumped.
///
/// The priority is bumped for as long as this object is alive. This is useful
/// in situations where, despite having a deadline we may never want the
/// priority to fall too low.
///
/// This could be because a user started watching the process, a shutdown
/// sequence was initiated, etc.
///
/// [`DeadlineQueue`]: struct.DeadlineQueue.html
pub struct PriorityBump<T> {
    queue: Rc<InnerQueue<T>>,
}

impl<T> PriorityBump<T> {
    fn new(queue: Rc<InnerQueue<T>>) -> PriorityBump<T> {
        queue.min_shares.set(250);
        PriorityBump { queue }
    }
}

impl<T> Drop for PriorityBump<T> {
    fn drop(&mut self) {
        self.queue.min_shares.set(1);
    }
}

type QueueItem<T> = Rc<dyn DeadlineSource<Output = T>>;

#[derive(Debug)]
struct InnerQueue<T> {
    queue: RefCell<VecDeque<(Instant, QueueItem<T>)>>,
    last_admitted: Cell<Instant>,
    _last_adjusted: Cell<Instant>,
    last_shares: Cell<usize>,
    accumulated_error: Cell<f64>,
    adjustment_period: Duration,
    last_error: Cell<f64>,
    min_shares: Cell<usize>,

    state: Cell<ControllerStatus>,
}

impl<T> SharesManager for InnerQueue<T> {
    /// PI controller for shares.
    ///
    /// We are not dealing with the derivative constant here: it is too risky
    /// given the generic nature of the processes under control.
    ///
    /// The variable we are controlling is the speed at which the units are
    /// processed. Also, because we don't know what units are and different
    /// items in the queue may have different magnitudes we need to work
    /// with normalized units.
    ///
    /// The error is the difference between our effective speed and the desired
    /// speed:
    ///
    ///    e(t) = units_expected/delta_t -  units_processed/ delta_t,
    ///
    ///  and because we are normalizing:
    ///
    ///    e(t) = 1/delta_t * (1 - units_processed / units_expected)
    ///
    ///  The controller output is then:
    ///
    ///    u(t) = Kp * e(t) + Ki + Integral{0, t} e(t)
    ///
    ///  There are a couple of practical problems with that.
    ///
    ///  * The first is that the output of the controller would be zero if we
    ///    there are no error
    ///  * The second is that our integral term would accumulate errors that may
    ///    not be comparable as we accumulate artifacts of the delta_t
    ///    calculation (as we'll never in practice keep delta_t constant)
    ///
    ///  The way we'll solve this is by expressing an alternate error E(T) which
    /// is  essentially the integral of e(t) in time:
    ///
    ///    E(t) = 1 - units_processed / units_expected.
    ///
    ///  That is easy to compute, as it is essentially the total count of units
    /// for  all items in the queue, both processed and expected.
    ///
    ///  We can now express our output function as the derivative of U(t), the
    /// output  function for the integral of the error:
    ///
    ///    u(t) = d(U(t)) / dt = Kp * dE(t) /dt + Ki * E(t)
    ///
    ///  Now we are calculating how many shares should be added or removed to
    /// the  last output, and not how much the shares should be. It also
    /// eliminates any  dependency on time when calculating the error which
    /// increases resiliency.
    fn shares(&self) -> usize {
        if let ControllerStatus::Disabled(shares) = self.state.get() {
            return shares;
        }

        let queue = self.queue.borrow();
        let mut expected = 0.0;
        let mut processed = 0.0;
        let now = Instant::now();

        for (exp, source) in queue.iter() {
            let remaining_time = exp.saturating_duration_since(now);
            trace!(
                "Remaining time for this source: {remaining_time:#?}, total_units {}",
                source.total_units()
            );
            let time_fraction =
                1.0 - (remaining_time.as_secs_f64() / source.expected_duration().as_secs_f64());
            if remaining_time.as_nanos() == 0 && now.saturating_duration_since(*exp).as_secs() > 5 {
                // already too late, bump it up hard
                self.last_shares.set(1000);
                return 1000;
            }
            expected += source.total_units() as f64 * time_fraction;
            processed += source.processed_units() as f64;
        }

        // so little time has passed we can't really make any useful prediction
        if expected < 0.01 {
            return self.last_shares.get();
        }

        let error = 1.0 - processed / expected;
        let accumulated_error = self.accumulated_error.get();
        let acc = accumulated_error + error;
        self.accumulated_error.set(acc);
        let delta_error = error - self.last_error.get();
        self.last_error.set(error);

        // How did we pick our constants:
        //  * As with any stable PI controller we want the bulk of our gain to come from
        //    P.
        //  * As we normalize the maximum error to 1 we know that the gain should be at
        //    most 1000
        //  * physically, Ki can be expressed as Kp / Tau where Tau is a time constant,
        //    roughly equivalent to how many periods need to pass for the integral term
        //    to generate the same gain as the proportional term. We set that to 6 so
        //    the controller is not too sluggish, which is around 1.5 seconds on the
        //    default 250ms adjustment period.
        //
        //  We can then write X + X/6 = 1000, and solving for X we have the constants
        // below
        let kp = 850.0;
        let ki = kp / 6.0;
        let dshares = ki * error + kp * delta_error;

        let mut shares = (dshares + self.last_shares.get() as f64) as isize;
        shares = std::cmp::min(shares, 1000);
        shares = std::cmp::max(shares, self.min_shares.get() as isize);
        let shares = shares as usize;

        trace!(
            "processed: {}. expected: {} error: {}, delta_error {} , kp term {}, ki term {}, \
             shares: {}",
            processed,
            expected,
            error,
            delta_error,
            ki * error,
            kp * delta_error,
            shares
        );
        self.last_shares.set(shares);
        shares
    }

    fn adjustment_period(&self) -> Duration {
        self.adjustment_period
    }
}

impl<T> InnerQueue<T> {
    fn new(adjustment_period: Duration) -> Self {
        let now = Instant::now();
     
```

### Core Architecture Module: `glommio/src/iou/completion_queue.rs`
```
use std::{
    fmt, io,
    marker::PhantomData,
    mem::MaybeUninit,
    ptr::{self, NonNull},
};

use super::{resultify, CQEs, CQEsBlocking, IoUring, CQE};
use crate::uring_sys;

/// The queue of completed IO events.
///
/// Each element is a [`CQE`](crate::cqe::CQE).
///
/// Completion does not imply success. Completed events may be
/// [timeouts](crate::cqe::CQE::is_iou_timeout).
pub struct CompletionQueue<'ring> {
    pub(crate) ring: NonNull<uring_sys::io_uring>,
    _marker: PhantomData<&'ring mut IoUring>,
}

impl<'ring> CompletionQueue<'ring> {
    pub(crate) fn new(ring: &'ring IoUring) -> CompletionQueue<'ring> {
        CompletionQueue {
            ring: NonNull::from(&ring.ring),
            _marker: PhantomData,
        }
    }

    /// Returns the next CQE if any are available.
    pub fn peek_for_cqe(&mut self) -> Option<CQE> {
        unsafe {
            let mut cqe = MaybeUninit::uninit();
            uring_sys::io_uring_peek_cqe(self.ring.as_ptr(), cqe.as_mut_ptr());
            let cqe = cqe.assume_init();
            if !cqe.is_null() {
                Some(CQE::new(self.ring, &mut *cqe))
            } else {
                None
            }
        }
    }

    /// Returns the next CQE, blocking the thread until one is ready if
    /// necessary.
    pub fn wait_for_cqe(&mut self) -> io::Result<CQE> {
        self.wait_for_cqes(1)
    }

    #[inline(always)]
    pub(crate) fn wait_for_cqes(&mut self, count: u32) -> io::Result<CQE> {
        let ring = self.ring;
        self.wait_inner(count).map(|cqe| CQE::new(ring, cqe))
    }

    /// Block the thread until at least `count` CQEs are ready.
    ///
    /// These CQEs can be processed using `peek_for_cqe` or the `cqes` iterator.
    pub fn wait(&mut self, count: u32) -> io::Result<()> {
        self.wait_inner(count).map(|_| ())
    }

    #[inline(always)]
    fn wait_inner(&mut self, count: u32) -> io::Result<&mut uring_sys::io_uring_cqe> {
        unsafe {
            let mut cqe = MaybeUninit::uninit();

            resultify(uring_sys::io_uring_wait_cqes(
                self.ring.as_ptr(),
                cqe.as_mut_ptr(),
                count as _,
                ptr::null(),
                ptr::null(),
            ))?;

            Ok(&mut *cqe.assume_init())
        }
    }

    /// Returns an iterator of ready CQEs.
    ///
    /// When there are no CQEs ready to process, the iterator will end. It will
    /// never block the thread to wait for CQEs to be completed.
    pub fn cqes(&mut self) -> CQEs<'_> {
        CQEs::new(self.ring)
    }

    /// Returns an iterator of ready CQEs, blocking when there are none ready.
    ///
    /// This iterator never ends. Whenever there are no CQEs ready, it will
    /// block the thread until at least `wait_for` CQEs are ready.
    pub fn cqes_blocking(&mut self, wait_for: u32) -> CQEsBlocking<'_> {
        CQEsBlocking::new(self.ring, wait_for)
    }

    pub fn ready(&self) -> u32 {
        unsafe { uring_sys::io_uring_cq_ready(self.ring.as_ptr()) }
    }

    pub fn eventfd_enabled(&self) -> bool {
        unsafe { uring_sys::io_uring_cq_eventfd_enabled(self.ring.as_ptr()) }
    }

    pub fn eventfd_toggle(&mut self, enabled: bool) -> io::Result<()> {
        resultify(unsafe { uring_sys::io_uring_cq_eventfd_toggle(self.ring.as_ptr(), enabled) })?;
        Ok(())
    }
}

impl fmt::Debug for CompletionQueue<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let fd = unsafe { self.ring.as_ref().ring_fd };
        f.debug_struct(std::any::type_name::<Self>())
            .field("fd", &fd)
            .finish()
    }
}

unsafe impl Send for CompletionQueue<'_> {}
unsafe impl Sync for CompletionQueue<'_> {}

```

### Core Architecture Module: `glommio/src/iou/submission_queue.rs`
```
use std::{fmt, io, marker::PhantomData, ptr::NonNull, time::Duration};

use super::{resultify, IoUring, SQEs, SQE};
use crate::uring_sys;

/// The queue of pending IO events.
///
/// Each element is a [`SQE`](crate::sqe::SQE).
/// By default, events are processed in parallel after being submitted.
/// You can modify this behavior for specific events using event
/// [`SubmissionFlags`](crate::sqe::SubmissionFlags).
///
/// # Examples
/// Consider a read event that depends on a successful write beforehand.
///
/// We reify this relationship by using `IO_LINK` to link these events.
pub struct SubmissionQueue<'ring> {
    ring: NonNull<uring_sys::io_uring>,
    _marker: PhantomData<&'ring mut IoUring>,
}

impl<'ring> SubmissionQueue<'ring> {
    pub(crate) fn new(ring: &'ring IoUring) -> SubmissionQueue<'ring> {
        SubmissionQueue {
            ring: NonNull::from(&ring.ring),
            _marker: PhantomData,
        }
    }

    /// Returns new [`SQE`s](crate::sqe::SQE) until the queue size is reached.
    /// After that, will return `None`.
    pub fn prepare_sqe(&mut self) -> Option<SQE<'_>> {
        unsafe {
            let sqe = uring_sys::io_uring_get_sqe(self.ring.as_mut());
            if !sqe.is_null() {
                uring_sys::io_uring_prep_nop(sqe);
                Some(SQE::new(&mut *sqe))
            } else {
                None
            }
        }
    }

    /// Returns the next `count` [`SQE`]s which can be prepared to submit as an
    /// iterator.
    ///
    /// See the [`SQEs`] type for more information about how these multiple SQEs
    /// can be used.
    pub fn prepare_sqes(&mut self, count: u32) -> Option<SQEs<'_>> {
        unsafe {
            if self.space_left() >= count {
                Some(SQEs::new(self.ring.as_mut(), count))
            } else {
                None
            }
        }
    }

    /// Submit all events in the queue. Returns the number of submitted events.
    ///
    /// If this function encounters any IO errors an
    /// [`io::Error`](std::io::Result) variant is returned.
    pub fn submit(&mut self) -> io::Result<u32> {
        resultify(unsafe { uring_sys::io_uring_submit(self.ring.as_ptr()) })
    }

    pub fn submit_and_wait(&mut self, wait_for: u32) -> io::Result<u32> {
        resultify(unsafe { uring_sys::io_uring_submit_and_wait(self.ring.as_ptr(), wait_for as _) })
    }

    pub fn submit_and_wait_with_timeout(
        &mut self,
        wait_for: u32,
        duration: Duration,
    ) -> io::Result<u32> {
        let ts = uring_sys::__kernel_timespec {
            tv_sec: duration.as_secs() as _,
            tv_nsec: duration.subsec_nanos() as _,
        };

        loop {
            if let Some(mut sqe) = self.prepare_sqe() {
                sqe.clear();
                unsafe {
                    sqe.prep_timeout(&ts, 0, crate::iou::sqe::TimeoutFlags::empty());
                    sqe.set_user_data(uring_sys::LIBURING_UDATA_TIMEOUT);
                    return resultify(uring_sys::io_uring_submit_and_wait(
                        self.ring.as_ptr(),
                        wait_for as _,
                    ));
                }
            }

            self.submit()?;
        }
    }

    pub fn ready(&self) -> u32 {
        unsafe { uring_sys::io_uring_sq_ready(self.ring.as_ptr()) }
    }

    pub fn space_left(&self) -> u32 {
        unsafe { uring_sys::io_uring_sq_space_left(self.ring.as_ptr()) }
    }
}

impl fmt::Debug for SubmissionQueue<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let fd = unsafe { self.ring.as_ref().ring_fd };
        f.debug_struct(std::any::type_name::<Self>())
            .field("fd", &fd)
            .finish()
    }
}

unsafe impl Send for SubmissionQueue<'_> {}
unsafe impl Sync for SubmissionQueue<'_> {}

```

### Core Architecture Module: `glommio/src/task/state.rs`
```
// Unless explicitly stated otherwise all files in this repository are licensed
// under the MIT/Apache-2.0 License, at your convenience
//
// This product includes software developed at Datadog (https://www.datadoghq.com/). Copyright 2020 Datadog, Inc.
//
/// Set if the task is scheduled for running.
///
/// A task is considered to be scheduled whenever its [`Task`] reference exists.
/// It therefore also begins in scheduled state at the moment of creation.
///
/// This flag can't be set when the task is completed. However, it can be set
/// while the task is running, in which case it will be rescheduled as soon as
/// polling finishes.
pub(crate) const SCHEDULED: u8 = 1 << 0;

/// Set if the task is running.
///
/// A task is in running state while its future is being polled.
///
/// This flag can't be set when the task is completed. However, it can be in
/// scheduled state while it is running, in which case it will be rescheduled as
/// soon as polling finishes.
pub(crate) const RUNNING: u8 = 1 << 1;

/// Set if the task has been completed.
///
/// This flag is set when polling returns `Poll::Ready`. The output of the
/// future is then stored inside the task until it becomes closed. In fact,
/// [`JoinHandle`] picks up the output by marking the task as closed.
///
/// This flag can't be set when the task is scheduled or running.
pub(crate) const COMPLETED: u8 = 1 << 2;

/// Set if the task is closed.
///
/// If a task is closed, that means it's either canceled or its output has been
/// consumed by the [`JoinHandle`]. A task becomes closed when:
///
/// 1. It gets canceled by [`Task::cancel()`], [`Task::drop()`], or
///    [`JoinHandle::cancel()`]. 2. Its output gets awaited by the [`JoinHandle`].
/// 3. It panics while polling the future.
/// 4. It is completed and the [`JoinHandle`] gets dropped.
pub(crate) const CLOSED: u8 = 1 << 3;

/// Set if the [`JoinHandle`] still exists.
///
/// The [`JoinHandle`] is a special case in that it is only tracked by this
/// flag, while all other task references ([`Task`] and [`Waker`]s) are tracked
/// by the reference count.
pub(crate) const HANDLE: u8 = 1 << 4;

```

### Core Architecture Module: `glommio/src/task/utils.rs`
```
// Unless explicitly stated otherwise all files in this repository are licensed
// under the MIT/Apache-2.0 License, at your convenience
//
// This product includes software developed at Datadog (https://www.datadoghq.com/). Copyright 2020 Datadog, Inc.
//
use core::{alloc::Layout, mem};

/// Aborts the process.
///
/// To abort, this function simply panics while panicking.
#[track_caller]
pub(crate) fn abort() -> ! {
    struct Panic;

    impl Drop for Panic {
        fn drop(&mut self) {
            panic!("aborting the process");
        }
    }

    let _panic = Panic;
    panic!("aborting the process");
}

/// Calls a function and aborts if it panics.
///
/// This is useful in unsafe code where we can't recover from panics.
#[inline]
#[track_caller]
pub(crate) fn abort_on_panic<T>(f: impl FnOnce() -> T) -> T {
    struct Bomb;

    impl Drop for Bomb {
        fn drop(&mut self) {
            abort();
        }
    }

    let bomb = Bomb;
    let t = f();
    mem::forget(bomb);
    t
}

/// Returns the layout for `a` followed by `b` and the offset of `b`.
///
/// This function was adapted from the currently unstable [`Layout::extend()`]
#[inline]
pub(crate) fn extend(a: Layout, b: Layout) -> (Layout, usize) {
    let new_align = a.align().max(b.align());
    let pad = padding_needed_for(a, b.align());

    let offset = a.size().checked_add(pad).unwrap();
    let new_size = offset.checked_add(b.size()).unwrap();

    let layout = Layout::from_size_align(new_size, new_align).unwrap();
    (layout, offset)
}

/// Returns the padding after `layout` that aligns the following address to
/// `align`.
///
/// This function was adapted from the currently unstable,
/// [`Layout::padding_needed_for()`]
#[inline]
pub(crate) fn padding_needed_for(layout: Layout, align: usize) -> usize {
    let len = layout.size();
    let len_rounded_up = len.wrapping_add(align).wrapping_sub(1) & !align.wrapping_sub(1);
    len_rounded_up.wrapping_sub(len)
}

```

### Core Architecture Module: `examples/cooperative_preempt.rs`
```
use futures::join;
use glommio::prelude::*;
use std::{
    cell::RefCell,
    rc::Rc,
    time::{Duration, Instant},
};

/// Glommio is a cooperative thread per core system so once you start
/// processing a future it will run it to completion. This is not great
/// for latency, and may be outright wrong if you have tasks that may
/// spin forever before returning, like a long-lived server.
///
/// Applications using Glommio are then expected to be well-behaved and
/// explicitly yield control if they are going to do something that may take
/// too long (that is usually a loop!)
///
/// There are three ways of yielding control:
///
///  * [`glommio::executor().yield_if_needed()`], which will yield if the
///    current task queue has run for too long. What "too long" means is an
///    implementation detail, but it will be always somehow related to the
///    latency guarantees that the task queues want to uphold in their
///    [`Latency::Matters`] parameter (or [`Latency::NotImportant`]). To check
///    whether preemption is needed without yielding automatically, use
///    [`glommio::executor().need_preempt()`].
///
///  * [`glommio::executor().yield_task_queue_now()`], works like
///    yield_if_needed() but yields unconditionally.
///
///  * [`glommio::executor().yield_now()`], which unconditional yield the
///    current task within the current task queue, forcing the scheduler to run
///    another task on the same task queue. This is equivalent to returning
///    `Poll::Pending` and waking up the current task.
///
/// Because [`yield_if_needed()`] returns a future that has to be .awaited,
/// it cannot be used in situations where .await is illegal. For
/// instance, if we are holding a borrow. For those, one can call
/// [`need_preempt()`] which will tell you if yielding is needed, and
/// then explicitly yield with [`yield_task_queue_now()`].
fn main() {
    let handle = LocalExecutorBuilder::default()
        .spawn(|| async move {
            let tq1 = glommio::executor().create_task_queue(
                Shares::default(),
                Latency::Matters(Duration::from_millis(10)),
                "tq1",
            );
            let tq2 = glommio::executor().create_task_queue(
                Shares::default(),
                Latency::Matters(Duration::from_millis(10)),
                "tq2",
            );
            let shared_value = Rc::new(RefCell::new(0u64));

            let value = shared_value.clone();
            let j1 = glommio::spawn_local_into(
                async move {
                    let start = Instant::now();
                    let mut lap = start;
                    while start.elapsed().as_millis() < 50 {
                        glommio::yield_if_needed().await;
                        if lap.elapsed().as_millis() > 1 {
                            lap = Instant::now();
                            println!("tq1: 1ms");
                        }
                    }
                    println!("tq1: Final value of v: {}", *(value.borrow()));
                },
                tq1,
            )
            .unwrap();

            let value = shared_value.clone();
            let j2 = glommio::spawn_local_into(
                async move {
                    let start = Instant::now();
                    let mut lap = start;
                    while start.elapsed().as_millis() < 50 {
                        let mut v = value.borrow_mut();
                        if glommio::executor().need_preempt() {
                            drop(v);
                            glommio::executor().yield_task_queue_now().await;
                        } else {
                            *v += 1;
                        }
                        if lap.elapsed().as_millis() > 1 {
                            lap = Instant::now();
                            println!("tq2: 1ms");
                        }
                    }
                    println!("tq2: Final value of v: {}", *(value.borrow()));
                },
                tq2,
            )
            .unwrap();

            join!(j1, j2);
        })
        .unwrap();
    handle.join().unwrap();
}

```

### Core Architecture Module: `examples/deadline_writer.rs`
```
use futures_lite::io::AsyncBufReadExt;
use glommio::{
    controllers::{DeadlineQueue, DeadlineSource},
    io::stdin,
    prelude::*,
};
use std::{
    cell::Cell,
    future::Future,
    pin::Pin,
    rc::Rc,
    time::{Duration, Instant},
};
use yansi::Paint;

fn burn_cpu(dur: Duration) {
    let now = Instant::now();
    while now.elapsed() < dur {}
}

struct IntWriter {
    deadline: Duration,
    start: Instant,
    count_target: usize,
    count: Cell<usize>,
    next_print: Cell<Duration>,
    count_at_last_print: Cell<usize>,

    last_tq_runtime: Cell<Duration>,
    last_ex_runtime: Cell<Duration>,
}

impl IntWriter {
    fn new(count_target: usize, deadline: Duration) -> Rc<IntWriter> {
        Rc::new(IntWriter {
            start: Instant::now(),
            deadline,
            count_target,
            count: Cell::new(0),
            next_print: Cell::new(Duration::from_secs(1)),
            count_at_last_print: Cell::new(0),
            last_tq_runtime: Cell::new(Duration::from_nanos(0)),
            last_ex_runtime: Cell::new(Duration::from_nanos(0)),
        })
    }

    async fn write_int(self: Rc<Self>) -> Duration {
        let my_handle = glommio::executor().current_task_queue();

        loop {
            let me = self.count.get();
            let elapsed = self.start.elapsed();
            if me >= self.count_target {
                return elapsed;
            }
            self.count.set(me + 1);
            if elapsed > self.next_print.get() {
                let tq_stats = glommio::executor().task_queue_stats(my_handle).unwrap();

                let tq_runtime = tq_stats.runtime();
                let tq_delta = tq_runtime - self.last_tq_runtime.get();
                let ex_runtime = glommio::executor().executor_stats().total_runtime();
                let ex_delta = ex_runtime - self.last_ex_runtime.get();

                let ratio = self.count.get() as f64 / self.count_target as f64 * 100.0;
                let intratio = self.count.get() - self.count_at_last_print.get();

                let cpuratio = 100.0 * tq_delta.as_secs_f64() / ex_delta.as_secs_f64();

                println!(
                    "{}: Wrote {} ({}%), {:.0} int/s, scheduler shares: {} , {:.2} % CPU",
                    Paint::blue(format!("{}s", elapsed.as_secs())),
                    self.count.get(),
                    Paint::new(format!("{:.0}", ratio)).bold(),
                    intratio,
                    Paint::new(tq_stats.current_shares().to_string()).bold(),
                    cpuratio
                );
                self.next_print
                    .set(self.next_print.get() + Duration::from_secs(1));
                self.count_at_last_print.set(self.count.get());
                self.last_tq_runtime.set(tq_runtime);
                self.last_ex_runtime.set(ex_runtime);
            }

            burn_cpu(Duration::from_micros(500));
            glommio::executor().yield_task_queue_now().await;
        }
    }
}

impl DeadlineSource for IntWriter {
    type Output = Duration;

    fn expected_duration(&self) -> Duration {
        self.deadline
    }

    fn action(self: Rc<Self>) -> Pin<Box<dyn Future<Output = Duration> + 'static>> {
        Box::pin(self.write_int())
    }

    fn total_units(&self) -> u64 {
        self.count_target as _
    }

    fn processed_units(&self) -> u64 {
        self.count.get() as _
    }
}

fn competing_cpu_hog(
    stop: Rc<Cell<bool>>,
    cpuhog_tq: TaskQueueHandle,
) -> glommio::task::JoinHandle<()> {
    glommio::spawn_local_into(
        async move {
            while !stop.get() {
                burn_cpu(Duration::from_micros(500));
                glommio::executor().yield_task_queue_now().await;
            }
        },
        cpuhog_tq,
    )
    .unwrap()
    .detach()
}

async fn static_writer(how_many: usize, shares: usize, cpuhog_tq: TaskQueueHandle) -> Duration {
    let name = format!("shares-{shares}");
    let tq =
        glommio::executor().create_task_queue(Shares::Static(shares), Latency::NotImportant, &name);

    let stop = Rc::new(Cell::new(false));
    let hog = competing_cpu_hog(stop.clone(), cpuhog_tq);

    let writer = glommio::spawn_local_into(
        async move {
            // Last parameter is bogus outside the queue, but we're just reusing the same
            // writer
            let test = IntWriter::new(how_many, Duration::from_secs(0));
            test.write_int().await
        },
        tq,
    )
    .unwrap()
    .detach();

    let res = writer.await.unwrap();
    stop.set(true);
    hog.await.unwrap();
    res
}

async fn read_int() -> Result<usize, <usize as std::str::FromStr>::Err> {
    let mut buffer = String::new();
    stdin().read_line(&mut buffer).await.unwrap();
    let buf = buffer.trim();
    buf.parse::<usize>()
}

fn main() {
    let handle = LocalExecutorBuilder::new(Placement::Fixed(0))
        .spawn(|| async move {
            let cpuhog_tq = glommio::executor().create_task_queue(
                Shares::Static(1000),
                Latency::NotImportant,
                "cpuhog",
            );

            println!(
                "{}",
                Paint::new("Welcome to the Deadline Writer example").bold()
            );
            println!(
                "In this example we will write a sequence of integers to a variable, busy looping \
                 for 500us after each write"
            );
            println!(
                "While we do that, another CPU hog will be running constantly in a different \
                 TaskQueue"
            );
            println!(
                "For {} results, this test is pinned to your CPU0. Make sure nothing else of \
                 significance is running there. You should be able to see it at 100% at all times!",
                Paint::new("best").bold()
            );

            println!("\n\nPlease tell me how many integers you would like to write");
            let to_write = read_int().await.unwrap();
            println!(
                "Ok, now let's write {} integers with both the writer and the CPU hog having the \
                 same priority",
                Paint::blue(to_write.to_string())
            );
            let dur = static_writer(to_write, 1000, cpuhog_tq).await;
            println!(
                "Finished writing in {}",
                Paint::green(format!("{dur:#.0?}"))
            );
            println!(
                "This was using {} shares, and short of reducing the priority of the CPU hog. {}",
                Paint::green("1000"),
                Paint::new("This is as fast as we can do!").bold()
            );
            println!(
                "With {} shares, this would have taken approximately {}",
                Paint::green("100"),
                Paint::green(format!("{:#.1?}", dur * 10))
            );
            println!(
                "With {} shares, this would have taken approximately {}. {}.",
                Paint::green("1"),
                Paint::green(format!("{:#.1?}", dur * 1000)),
                Paint::new("Can't go any slower than that!").bold()
            );

            println!(
                "\n\nLet's try the controlled process. How long would you like it to take? \
                 (seconds)"
            );
            println!(
                "Keep in mind that very short processes will be inherently unstable because of \
                 the time the controller needs to adapt"
            );
            let mut duration = read_int().await.unwrap();

            loop {
                let stop = Rc::new(Cell::new(false));
                let hog = competing_cpu_hog(stop.clone(), cpuhog_tq);
                glommio::executor().yield_task_queue_now().await;

                let deadline = DeadlineQueue::new("example", Duration::from_millis(250));
                let test = IntWriter::new(to_write, Duration::from_secs(duration as u64));
                let dur = deadline.push_work(test).await.unwrap();
                println!(
                    "Finished writing in {}",
                    Paint::green(format!("{dur:#.2?}"))
                );
                stop.set(true);
                hog.await.unwrap();
                println!(
                    "If you want to try again tell me how long it should take this time, or press \
                     some non-number to exit"
                );
                duration = match read_int().await {
                    Ok(num) => num,
                    Err(_) => break,
                }
            }
        })
        .unwrap();

    handle.join().unwrap();
}

```

### Core Architecture Module: `examples/defer.rs`
```
// Unless explicitly stated otherwise all files in this repository are licensed
// under the MIT/Apache-2.0 License, at your convenience
//
// This product includes software developed at Datadog (https://www.datadoghq.com/). Copyright 2020 Datadog, Inc.
//
use glommio::{defer, timer::TimerActionOnce, LocalExecutorBuilder};
use std::time::Duration;

fn main() {
    defer! {
        println!("Executor is done!");
    }

    let handle = LocalExecutorBuilder::default()
        .spawn(|| async move {
            defer! {
                println!("This will print after the timer");
            }

            println!("This will print first");
            let task = TimerActionOnce::do_in(Duration::from_secs(1), async move {
                println!("This will print after one second");
            });
            task.join().await;
        })
        .unwrap();
    handle.join().unwrap();
}

```

### Core Architecture Module: `examples/echo.rs`
```
// Unless explicitly stated otherwise all files in this repository are licensed
// under the MIT/Apache-2.0 License, at your convenience
//
// This product includes software developed at Datadog (https://www.datadoghq.com/). Copyright 2020 Datadog, Inc.
//
use futures_lite::{AsyncReadExt, AsyncWriteExt};
use glommio::{
    net::{TcpListener, TcpStream},
    prelude::*,
};
use std::{io::Result, rc::Rc, time::Instant};

async fn server(conns: usize) -> Result<()> {
    let listener = Rc::new(TcpListener::bind("127.0.0.1:10000").unwrap());
    println!(
        "Server Listening on {} on {} connections",
        listener.local_addr()?,
        conns
    );

    // After we are already listening, we will spawn the client.
    // Not only this will guarantee that we are listening on the port already (so no
    // need for sleep or retry), but it also demonstrates how a more complex
    // application may not necessarily spawn all executors at once running
    // symmetrical code.
    let client_handle = LocalExecutorBuilder::new(Placement::Fixed(2))
        .name("client")
        .spawn(move || async move { client(conns).await })?;

    let mut servers = vec![];
    for _ in 0..conns {
        let l = listener.clone();
        servers.push(
            spawn_local(async move {
                let mut stream = l.accept().await.unwrap();
                loop {
                    let mut buf = [0u8; 1];
                    let b = stream.read(&mut buf).await?;
                    if b == 0 {
                        break;
                    } else {
                        stream.write(&buf).await?;
                    }
                }
                Result::Ok(())
            })
            .detach(),
        );
    }

    for s in servers {
        s.await.unwrap()?;
    }

    client_handle.join().unwrap().unwrap();
    Ok(())
}

async fn client(clients: usize) -> Result<()> {
    let msgs: usize = 300_000;
    let msg_per_client = msgs / clients;

    let now = Instant::now();
    let mut tasks = vec![];
    for _ in 0..clients {
        tasks.push(crate::spawn_local(async move {
            let mut stream = TcpStream::connect("127.0.0.1:10000").await.unwrap();
            for _ in 0..msg_per_client {
                stream.write(b"a").await?;
                let mut buf = [0u8; 1];
                stream.read(&mut buf).await?;
                assert_eq!(&buf, b"a");
            }
            stream.flush().await?;
            stream.close().await
        }));
    }
    for c in tasks {
        c.await?;
    }

    let delta = now.elapsed();
    println!(
        "Sent {} messages in {} ms. {:.2} msg/s",
        msgs,
        delta.as_millis(),
        msgs as f64 / delta.as_secs_f64()
    );
    Ok(())
}

fn main() -> Result<()> {
    // Skip CPU0 because that is commonly used to host interrupts. That depends on
    // system configuration and most modern systems will balance it, but that it is
    // still common enough that it is worth excluding it in this benchmark
    let builder = LocalExecutorBuilder::new(Placement::Fixed(1));
    let server_handle = builder.name("server").spawn(|| async move {
        // If you try `top` during the execution of the first batch, you
        // will see that the CPUs should not be at 100%. A single connection will
        // not be enough to extract all the performance available in the cores.
        server(1).await?;
        // This should drive the CPU utilization to 100%.
        // Asynchronous execution needs parallelism to thrive!
        server(5).await
    })?;

    // Congrats for getting to the end of this example!
    //
    // Now can you adapt it, so it uses multiple executors and all CPUs in your
    // system?
    server_handle.join().unwrap().unwrap();
    Ok(())
}

```

### Core Architecture Module: `examples/gate.rs`
```
use std::rc::Rc;

use glommio::{
    enclose,
    prelude::*,
    sync::{Gate, Semaphore},
};

fn main() {
    LocalExecutor::default().run(async {
        let gate = Gate::new();

        let nr_tasks = 5;
        let running_tasks = Rc::new(Semaphore::new(0));
        let tasks_to_complete = Rc::new(Semaphore::new(0));

        for i in 0..nr_tasks {
            gate.spawn(enclose!((running_tasks, tasks_to_complete) async move {
                running_tasks.signal(1);
                println!("[Task {i}] started, running tasks: {}", running_tasks.available());
                tasks_to_complete.acquire(1).await.unwrap();
            }))
            .unwrap()
            .detach();
        }

        println!("Main: waiting for {nr_tasks} tasks");
        running_tasks.acquire(nr_tasks).await.unwrap();

        println!("Main: closing gate");
        let close_future =
            crate::spawn_local(enclose!((gate) async move { gate.close().await })).detach();

        tasks_to_complete.signal(nr_tasks);
        close_future.await.unwrap().unwrap();
        println!("Main: gate is closed");
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #270** (2021-02-25): **error information is lost**
  *Symptoms*: Part of the information we encode in errors is lost when we print them.  Take for example this: ```          if start_id != end_id {             return Err(GlommioError::<()>::WouldBlock(ResourceType::File(format!(                 "Reading {} bytes from position {} would cross a buffer boundary (Buffer size {})",                 len, self.current_pos, buffer_size             ))));         } ```  This very helpful message was supposed to tell us how much we are reading, by how much we failed, etc.  However due to the way we are implementing `Display` for `GlommioError`, the only information that make the output is:  ``` thread 'test-1' panicked at 'called `Result::unwrap()` on an `Err` value: Custom { kind: WouldBlock, error: "File operation would block" }', ```
  **Post-Mortem & Fix Analysis**:
  > @bryandmc can you please take a look ? 
  > Yeah I'll look at it as soon as I get back tomorrow it's probably an easy fix. Just gotta tweak the display impl as you suggest.  -Bryan  On Wed, Feb 10, 2021, 5:10 AM Glauber Costa <notifications@github.com> wrote:  > @bryandmc <https://github.com/bryandmc> can you please take a look ? > > — > You are receiving this because you were mentioned. > Reply to this email directly, view it on GitHub > <https://github.com/DataDog/glommio/issues/270#issuecomment-776773056>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AAF5GA67M2DOHG2GY6GKKGLS6KOVHANCNFSM4XNDZ6KA> > . > 
  > Ok so after looking at this I'm starting to think maybe it's worth just getting rid of `thiserror` and doing our own display impl's manually instead of contorting this library to do it. We already did our own impls for other things that it would sometimes offer as well because we had more specific needs so I'm just gonna do that. Bonus: we get to remove a dependency! 

- **Issue #269** (2021-02-11): **shared_channel is destoryed with pending wakers alive**
  *Symptoms*: A test is as as following.  ```rust diff --git a/glommio/src/channels/shared_channel.rs b/glommio/src/channels/shared_channel.rs index 723ddaa..6a70102 100644 --- a/glommio/src/channels/shared_channel.rs +++ b/glommio/src/channels/shared_channel.rs @@ -456,6 +456,7 @@ mod test {      use super::*;      use crate::timer::Timer;      use crate::LocalExecutorBuilder; +    use futures_lite::FutureExt;      use futures_lite::StreamExt;      use std::sync::atomic::{AtomicUsize, Ordering};      use std::sync::Arc; @@ -650,28 +651,33 @@ mod test {        #[test]      fn send_to_full_channel() { -        let (sender, receiver) = new_bounded(1); +        let (sender, receiver) = new_bounded::<u8>(1);            let status = Arc::new(AtomicUsize::new(0));          let s1 = status.clone();            let ex1 = LocalExecutorBuilder::new()              .spawn(move || async move { -                let sender = sender.connect().await; -                sender.send(0).await.unwrap(); -                let x = sender.try_send(1); -                assert_eq!(x.is_err(), true); -                s1.store(1, Ordering::Relaxed);              })              .unwrap();            let ex2 = LocalExecutorBuilder::new()              .spawn(move || async move { -                let receiver = receiver.connect().await; - -                while status.load(Ordering::Relaxed) == 0 {} -                let x = receiver.recv().await.unwrap(); -                assert_eq!(
  **Post-Mortem & Fix Analysis**:
  > Thanks. Just setting expectations that I may not get to it this week as I am semi-off
  > Hi,  What behavior would you expect from this? The future that generated the waker is being dropped so it is not there to receive the wake. In this case, what's wrong with dropping the connection wakers?
  > The wakers are not dropped before unregister_shared_channel is called. It will make a panic in  ```rust     fn process_shared_channels(&mut self, wakers: &mut Vec<Waker>) -> usize {         let mut added = self.connection_wakers.len();         wakers.append(&mut self.connection_wakers);          let current_wakers = mem::take(&mut self.wakers_map);         for (id, mut pending) in current_wakers.into_iter() {             let room = self.check_map.get(&id).unwrap()();   // PANIC THIS LINE!             let room = std::cmp::min(room, pending.len());             for w in pending.drain(0..room) {                 added += 1;                 wakers.push(w);             }             if !pending.is_empty() {                 self.wakers_map.insert(id, pending);             }         }         added     } } ```

- **Issue #241** (2020-12-23): **Program hangs**
  *Symptoms*: ```rust use glommio::{LocalExecutor, Local};  fn main() {   LocalExecutor::make_default().run(async {     Local::local(async { println!("hello") }).detach().await;      // The program hangs if the following line is uncommented.     // Local::local(async { println!("hello") }).detach().await;      println!("world")   }); }  ```
  **Post-Mortem & Fix Analysis**:
  > Ack, reproduced locally.  FWIW, this works:  ``` fn main() {   let ex = LocalExecutorBuilder::new().spawn(|| async {     Local::local(async { println!("hello") }).detach().await;     Local::local(async { println!("hello") }).detach().await;     println!("world")   }).unwrap();    ex.join().unwrap(); } ```  Your code seems fine to me, but just a bit of reasoning and internals about what could be happening: `run()` is special (I don't necessarily like that) because code you run in run (pun intended) doesn't belong to any task queue so there are things that you can't do (like yield). In your case you are spawning tasks and that should be fine. I have to investigate a bit more why this breaks.  But I also want to get rid of the special casing in `run()` as much as possible. It's very counter intuitive.  For the time being, in case you are blocked in your application, consider using a spawned executor as in the example I posted (which guarantees everything is inside a t
  > @thirstycrow this is fixed now.  Have a fantastic new year!

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

### Incident Patch 1: `bf85f19c` (2025-04-17)
**Commit Message**: Fix CI bitrot (#680)

* Update cache action to v4

v2 was deprecated a while back and all builds are failing.

* Bump fastrand and futures-lite dependency

cargo deny disallows this dependency due to instant being unmaintained.

```
   ├ instant v0.1.12
     └── fastrand v1.9.0
         ├── (dev) examples v0.0.0
         ├── futures-lite v1.13.0
```

* Update cargo deny config

Running cargo deny points to
https://github.com/EmbarkStudios/cargo-deny/pull/611 which indicates
that all the previously explicitly set fields are now deny by default
(not sure why they're no longer recognized).

Also update licenses allowed to remove warnings / work with latest
tokio.

* Fix test_spin in CI

Not sure why the timings are so different for this test. Maybe the test
is inherently written in a slightly flaky manner?

* Fix clippy errors

Bump minimum Rust version to 1.70 because Arc::into_inner is stabilized
only from that version.

**File**: `.github/actions/cache-setup/action.yml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ runs:
       shell: bash
 
     - name: Cache
-      uses: actions/cache@v2
+      uses: actions/cache@v4
       with:
         path: |
           ~/.cargo/bin/
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ jobs:
           cat << EOF > "run-gha-workflow.sh"
           PATH=$PATH:/usr/share/rust/.cargo/bin
           echo "`nproc` CPU(s) available"
-          rustup install 1.65
+          rustup install 1.70
           rustup show
           rustup default stable
           cargo install cargo-sort
```

**File**: `.github/workflows/third-party_exported.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
           ref: ${{ github.event.pull_request.head.sha }}
 
       - name: Assert Glommio depends on crates permissively licensed
-        uses: EmbarkStudios/cargo-deny-action@v1
+        uses: EmbarkStudios/cargo-deny-action@v2
         with:
           log-level: warn
           command: check licenses
```

**File**: `.github/workflows/third-party_vulnerabilities.yml` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ jobs:
         uses: actions/checkout@v2
 
       - name: Run checks on third-party dependencies
-        uses: EmbarkStudios/cargo-deny-action@v1
+        uses: EmbarkStudios/cargo-deny-action@v2
         with:
           log-level: warn
           command: check
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ an [introductory article.](https://www.datadoghq.com/blog/engineering/introducin
 
 ## Supported Rust Versions
 
-Glommio is built against the latest stable release. The minimum supported version is 1.65. The current Glommio version
+Glommio is built against the latest stable release. The minimum supported version is 1.70. The current Glommio version
 is not guaranteed to build on Rust versions earlier than the minimum supported version.
 
 ## Supported Linux kernels
```

**File**: `deny.toml` (modified, +3/-10)
```diff
@@ -3,27 +3,20 @@
 # https://embarkstudios.github.io/cargo-deny/checks/licenses/cfg.html
 
 [licenses]
-unlicensed = "deny"
 allow = [
     "MIT",
-    "BSD-3-Clause",
     "Apache-2.0",
     "Apache-2.0 WITH LLVM-exception",
     "MPL-2.0",
     "Unlicense",
     "Zlib",
-    "Unicode-DFS-2016"
+    "Unicode-3.0"
 ]
-copyleft = "deny"
-default = "deny"
 confidence-threshold = 0.95
 private = { ignore = true }
 
 [advisories]
-vulnerability = "deny"
-unmaintained = "deny"
-notice = "deny"
-unsound = "deny"
+version = 2
 
 [bans]
-multiple-versions = "allow"
\ No newline at end of file
+multiple-versions = "allow"
```

**File**: `examples/Cargo.toml` (modified, +2/-2)
```diff
@@ -9,9 +9,9 @@ edition = "2021"
 byte-unit = "5.1.4"
 yansi = "~0.5.1"
 clap = "4.5.3"
-fastrand = "1.4.0"
+fastrand = "2"
 futures = "~0.3.5"
-futures-lite = "1.11.1"
+futures-lite = "2.6.0"
 glommio = { path = "../glommio" }
 
 # hyper and tokio for the hyper example. We just need the traits from Tokio
```

**File**: `glommio/Cargo.toml` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@ keywords = ["linux", "rust", "async", "iouring", "thread-per-core"]
 categories = ["asynchronous", "concurrency", "os", "filesystem", "network-programming"]
 readme = "../README.md"
 # This is also documented in the README.md under "Supported Rust Versions"
-rust-version = "1.65"
+rust-version = "1.70"
 
 [dependencies]
 ahash = "0.7"
@@ -27,7 +27,7 @@ concurrent-queue = "1.2"
 crossbeam = "0.8"
 enclose = "1.1"
 flume = { version = "0.11", features = ["async"] }
-futures-lite = "1.12"
+futures-lite = "2.6.0"
 intrusive-collections = "0.9"
 lazy_static = "1.4"
 libc = "0.2"
@@ -46,7 +46,7 @@ tracing = "0.1"
 typenum = "1.15"
 
 [dev-dependencies]
-fastrand = "1"
+fastrand = "2"
 futures = "0"
 hdrhistogram = "7"
 pretty_env_logger = "0"
```

---

### Incident Patch 2: `d3f6e7a2` (2024-06-20)
**Commit Message**: add CI security workflow  (#668)

Add supports for Datadog static analysis. It checks rules that validates
the GitHub actions are safe and secure.

**File**: `.github/workflows/datadog-static-analysis.yml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+on: [push]
+
+name: Datadog Static Analysis
+
+jobs:
+  static-analysis:
+    runs-on: ubuntu-latest
+    name: Datadog Static Analyzer
+    steps:
+    - name: Checkout
+      uses: actions/checkout@v3
+    - name: Check code meets quality and security standards
+      id: datadog-static-analysis
+      uses: DataDog/datadog-static-analyzer-github-action@v1
+      with:
+        dd_api_key: ${{ secrets.DD_STATIC_ANALYSIS_API_KEY }}
+        dd_app_key: ${{ secrets.DD_STATIC_ANALYSIS_APP_KEY }}
+        dd_service: dd-trace-py
+        dd_env: ci
+        dd_site: datadoghq.com
+        cpu_count: 2
```

**File**: `static-analysis.datadog.yml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+rulesets:
+  - sit-ci-best-practices:
+    only:
+      - ".github/workflows"
```

---

### Incident Patch 3: `83d30239` (2024-05-01)
**Commit Message**: WeakDmaFile fixups (#661)

Missing from exports. Also missing were default and new constructor
methods as well as strong_count.

**File**: `glommio/src/io/dma_file.rs` (modified, +77/-0)
```diff
@@ -666,6 +666,17 @@ impl DmaFile {
         }
     }
 
+    /// How many strong references are holding this file open. The returned count will always be at least 1.
+    ///
+    /// # Safety
+    ///
+    /// This method by itself is safe, but using it correctly requires extra care. Another thread can change the count
+    /// at any time, including potentially between calling this method and acting on the result. You probably want to
+    /// use [Self::downgrade] or [DmaFile::try_take_last_clone] to manage the ownership.
+    pub fn strong_count(&self) -> usize {
+        self.file.strong_count()
+    }
+
     /// Convenience method that closes a DmaFile wrapped inside an Rc.
     ///
     /// Returns [CloseResult] to indicate which operation was performed.
@@ -832,6 +843,17 @@ impl OwnedDmaFile {
             pollable: self.pollable,
         }
     }
+
+    /// How many strong references are holding this file open. The returned count will always be at least 1.
+    ///
+    /// # Safety
+    ///
+    /// This method by itself is safe, but using it correctly requires extra care. Another thread can change the count
+    /// at any time, including potentially between calling this method and acting on the result. You probably want to
+    /// use [Self::downgrade] or convert to a [DmaFile] and use [DmaFile::try_take_last_clone].
+    pub fn strong_count(&self) -> usize {
+        self.file.strong_count()
+    }
 }
 
 impl From<DmaFile> for OwnedDmaFile {
@@ -880,7 +902,31 @@ pub struct WeakDmaFile {
     pollable: PollableStatus,
 }
 
+impl Default for WeakDmaFile {
+    fn default() -> Self {
+        Self::new()
+    }
+}
+
 impl WeakDmaFile {
+    /// Creates an empty reference that will never upgrade.
+    pub fn new() -> WeakDmaFile {
+        Self {
+            file: WeakGlommioFile::new(),
+            o_direct_alignment: 0,
+            max_sectors_size: 0,
+            max_segment_size: 0,
+            pollable: PollableStatus::Pollable,
+        }
+    }
+
+    /// The number of strong references that still remain on the file.
+    /// If created via [Self::new], this will return 0.
+    pub fn strong_count(&self) -> usize {
+        self.file.strong_count()
+    }
+
+    /// Returns an `Option` containing ownership over the file if the file hasn't been closed yet, otherwise None.
     pub fn upgrade(&self) -> Option<OwnedDmaFile> {
         self.file.upgrade().map(|file| OwnedDmaFile {
             file,
@@ -2131,4 +2177,35 @@ pub(crate) mod test {
             })
             .await;
     });
+
+    #[test]
+    fn new_weak_file_strong_count() {
+        assert_eq!(WeakDmaFile::new().strong_count(), 0);
+    }
+
+    dma_file_test!(weak_file_strong_count, path, _k, {
+        let file = OpenOptions::new()
+            .create_new(true)
+            .read(true)
+            .write(true)
+            .tmpfile(true)
+            .dma_open(&path)
+            .await
+            .unwrap();
+
+        let weak = file.downgrade();
+        assert_eq!(weak.strong_count(), 1);
+
+        let cloned = file.clone();
+
+        assert_eq!(weak.strong_count(), 2);
+
+        std::mem::drop(file);
+
+        assert_eq!(weak.strong_count(), 1);
+
+        std::mem::drop(cloned);
+
+        assert_eq!(weak.strong_count(), 0);
+    });
 }
```

**File**: `glommio/src/io/glommio_file.rs` (modified, +18/-2)
```diff
@@ -356,6 +356,10 @@ impl GlommioFile {
             dev_minor: self.dev_minor,
         }
     }
+
+    pub(crate) fn strong_count(&self) -> usize {
+        self.file.as_ref().map_or(0, Arc::strong_count)
+    }
 }
 
 /// This lets you open a DmaFile on one thread and then send it safely to another thread for processing.
@@ -384,7 +388,11 @@ impl OwnedGlommioFile {
         })
     }
 
-    pub fn downgrade(&self) -> WeakGlommioFile {
+    pub(crate) fn strong_count(&self) -> usize {
+        self.fd.as_ref().map_or(0, Arc::strong_count)
+    }
+
+    pub(crate) fn downgrade(&self) -> WeakGlommioFile {
         WeakGlommioFile {
             fd: self.fd.as_ref().map_or(AWeak::new(), Arc::downgrade),
             path: self.path.clone(),
@@ -437,7 +445,7 @@ impl From<GlommioFile> for OwnedGlommioFile {
     }
 }
 
-#[derive(Debug, Clone)]
+#[derive(Default, Debug, Clone)]
 pub(crate) struct WeakGlommioFile {
     pub(crate) fd: AWeak<RawFd>,
     pub(crate) path: Option<PathBuf>,
@@ -447,6 +455,14 @@ pub(crate) struct WeakGlommioFile {
 }
 
 impl WeakGlommioFile {
+    pub(crate) fn new() -> Self {
+        Self::default()
+    }
+
+    pub(crate) fn strong_count(&self) -> usize {
+        self.fd.strong_count()
+    }
+
     pub(crate) fn upgrade(&self) -> Option<OwnedGlommioFile> {
         self.fd.upgrade().map(|fd| OwnedGlommioFile {
             fd: Some(fd),
```

**File**: `glommio/src/io/mod.rs` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ pub use self::{
     },
     bulk_io::{IoVec, MergedBufferLimit, ReadAmplificationLimit, ReadManyResult},
     directory::Directory,
-    dma_file::{CloseResult, DmaFile, OwnedDmaFile},
+    dma_file::{CloseResult, DmaFile, OwnedDmaFile, WeakDmaFile},
     dma_file_stream::{
         DmaStreamReader, DmaStreamReaderBuilder, DmaStreamWriter, DmaStreamWriterBuilder,
     },
```

---

### Incident Patch 4: `562adb8a` (2024-04-25)
**Commit Message**: fix clippy issues (#659)

**File**: `glommio/src/sys/uring.rs` (modified, +2/-2)
```diff
@@ -893,7 +893,7 @@ impl UringCommon for PollRing {
 
     fn submit_one_event(&mut self, queue: &mut VecDeque<UringDescriptor>) -> Option<bool> {
         submit_event_chain(
-            &mut *self.source_map.borrow_mut(),
+            &mut self.source_map.borrow_mut(),
             &mut self.ring,
             self.allocator.clone(),
             queue,
@@ -1206,7 +1206,7 @@ impl UringCommon for SleepableRing {
 
     fn submit_one_event(&mut self, queue: &mut VecDeque<UringDescriptor>) -> Option<bool> {
         submit_event_chain(
-            &mut *self.source_map.borrow_mut(),
+            &mut self.source_map.borrow_mut(),
             &mut self.ring,
             self.allocator.clone(),
             queue,
```

---

### Incident Patch 5: `2418fa3e` (2024-04-25)
**Commit Message**: Fix first sleep taking at least 30-50ms (#653)

Noticed this problem in unit tests where the very first timer sleep
would take a very long time because the membarrier was being registered
and tests have more than 1 thread.

Initializing the membarrier strategy before the BlockingThreadPool is
constructed seems like a good idea because it tries to elide the
registration cost if we haven't created any other threads yet. Even if
there are threads, the cost is front-loaded eagerly so it's part of the
cost of creating the executor rather than appearing as a random delay
going to sleep on the io_uring the first time (assuming it could
otherwise wake before the 30-80ms cost observed).

I believe the cost of registration got worse sometime after Linux 6.6
because tests in my project that do something similar started regularly
taking >30ms after upgrading to 6.8 whereas before they were mostly
succeeding < 30ms (it was my grace window for how long a 10ms sleep
could take).

With this change we see that the very first timer now completes within
11ms (I added a grace window of an extra ms in case of CI).

Co-authored-by: Glauber Costa <[REDACTED_EMAIL]>

**File**: `glommio/src/executor/mod.rs` (modified, +30/-0)
```diff
@@ -93,6 +93,36 @@ pub fn executor() -> ExecutorProxy {
     ExecutorProxy {}
 }
 
+/// You probably don't need to call this explicitly unless you have created threads before
+/// you constructed an executor. You may also want to call this explicitly if you're sandboxing
+/// your app and dropping permissions required to use privated expedited membarrier commands to
+/// improve Glommio performance.
+///
+/// This run some early initialization that may save ~30-80ms if you create threads before you
+/// tough Glommio code & don't otherwise register with membarrier. This is an idempotent call
+/// that can be invoked as many times, but only really makes sense to do early in main before
+/// you've constructed any threads. Additionally, the explicit membarrier registration this
+/// attempts is also useful if you're later dropping the privilege required to using private
+/// expedited commands so that the membarrier synchronization strategy can be used within
+/// the executor hot loop.
+///
+/// The detailed motivation is that internally glommio prefers to use [membarrier](https://man7.org/linux/man-pages/man2/membarrier.2.html)
+/// as a high performance synchronization barrier of the underlying io_uring memory
+/// shared with the kernel (if the feature is available). If there exist any threads in the program,
+/// registering the barrier has been observed to take a relatively long and highly variable amount
+/// of time (as high as 30-80ms). If we register before any threads are constructed, this takes almost no time.
+/// That's why this can be useful if you're integrating Glommio into an existing application to move this to
+/// the front of main.
+///
+/// The suspicion is that the membarrier registration makes a synchronous IPI to enable the use of cheap
+/// asynchronous IPI within the reactor hot loop. This means the startup cost will depend on the specific
+/// number of cores; 30-80ms was observed on a 32-core machine running a high end Intel consumer CPU.
+/// That's probably on the high end for consumer machines and smartphones today and on the low-end for
+/// server-class hardware.
+pub fn early_init() {
+    sys::initialize_membarrier_strategy();
+}
+
 pub(crate) fn executor_id() -> Option<usize> {
     #[cfg(not(feature = "native-tls"))]
     {
```

**File**: `glommio/src/lib.rs` (modified, +2/-2)
```diff
@@ -446,8 +446,8 @@ pub use crate::{
         ResourceType, Result,
     },
     executor::{
-        allocate_dma_buffer, allocate_dma_buffer_global, executor, spawn_local, spawn_local_into,
-        spawn_scoped_local, spawn_scoped_local_into,
+        allocate_dma_buffer, allocate_dma_buffer_global, early_init, executor, spawn_local,
+        spawn_local_into, spawn_scoped_local, spawn_scoped_local_into,
         stall::{DefaultStallDetectionHandler, StallDetection, StallDetectionHandler},
         yield_if_needed, CpuSet, ExecutorJoinHandle, ExecutorProxy, ExecutorStats, LocalExecutor,
         LocalExecutorBuilder, LocalExecutorPoolBuilder, Placement, PoolPlacement,
```

**File**: `glommio/src/sys/blocking.rs` (modified, +10/-0)
```diff
@@ -20,6 +20,8 @@ use std::{
     thread::JoinHandle,
 };
 
+use super::membarrier;
+
 // So hard to copy/clone io::Error, plus need to send between threads. Best to
 // do all i64.
 macro_rules! raw_syscall {
@@ -193,6 +195,14 @@ impl BlockingThreadPool {
         placement: PoolPlacement,
         sleep_notifier: Arc<SleepNotifier>,
     ) -> crate::Result<Self, ()> {
+        // Make sure to initialize the membarrier before the thread pool is constructed so that registration
+        // is much cheaper. Additionally, even if we take the expensive slow path, we do it here instead
+        // of at the reactor hot loop which synchronously blocks the io_uring loop to register the membarrier.
+        // https://github.com/DataDog/glommio/issues/652
+        // An alternative solution is to pull in https://crates.io/crates/ctor as a dependency and run this
+        // that way - then the public API to call early_init can be elided wholesale.
+        membarrier::initialize_strategy();
+
         let (in_tx, in_rx) = flume::bounded(4 << 10);
         let (out_tx, out_rx) = flume::bounded(4 << 10);
         let in_rx = Arc::new(in_rx);
```

**File**: `glommio/src/sys/membarrier.rs` (modified, +15/-0)
```diff
@@ -226,3 +226,18 @@ pub(crate) fn heavy() {
         Fallback => atomic::fence(atomic::Ordering::SeqCst),
     }
 }
+
+/// The membarrier strategy is expensive to initialize. Expose that initialization so
+/// that [crate::executor::early_init] can call it (it also gets intentionally called
+/// by [crate::executor::LocalExecutor::new] in case the user didn't).
+///
+/// I believe the cost of registration got worse sometime after Linux 6.6 because tests
+/// in my project that do a sleep on a timer as the first thing started taking >30ms
+/// after upgrading to 6.8 whereas before they were mostly succeeding < 30ms (it was
+/// my hacky attempt at dealing with setting a timeout on how long a timer could take
+/// before I dug into the problem once 6.8 made it unbearable & waiting up to 100ms
+/// for a 10ms test seemed silly & was hard to write assertions around).
+#[inline]
+pub(crate) fn initialize_strategy() {
+    let _ = *STRATEGY;
+}
```

**File**: `glommio/src/sys/mod.rs` (modified, +1/-0)
```diff
@@ -173,6 +173,7 @@ pub(crate) fn sendmsg_syscall(
 
 mod dma_buffer;
 mod membarrier;
+pub(crate) use membarrier::initialize_strategy as initialize_membarrier_strategy;
 pub(crate) mod source;
 pub(crate) mod sysfs;
 mod uring;
```

**File**: `glommio/src/timer/timer_impl.rs` (modified, +17/-0)
```diff
@@ -1195,4 +1195,21 @@ mod test {
 
         handle.join().unwrap();
     }
+
+    #[test]
+    fn first_timer_finishes_with_expected_duration() {
+        test_executor!(async move {
+            let start = Instant::now();
+            Timer::new(Duration::from_millis(3)).await;
+            let elapsed = start.elapsed();
+            assert!(
+                elapsed >= Duration::from_millis(3),
+                "Timer expired too soon: {elapsed:?}"
+            );
+            assert!(
+                elapsed <= Duration::from_millis(5),
+                "Timer took way too long to run: {elapsed:?}"
+            );
+        });
+    }
 }
```

---

### Incident Patch 6: `f9394774` (2024-04-24)
**Commit Message**: Fix stat to use the fd instead of the path (#649)

* chore(deps): Upgrade to flume 0.11

Has a race condition fix for async APIs. Not sure if this actually
impacts us but sounds like a worthwhile upgrade.

* Add failing test cases (#648)

Attempting to stat on an unlinked file will error with NotFound when it
shouldn't since we still have the fd. Similarly, invoking stat on a
tempfile will stat the parent directory instead of the file itself.

* Fix stat() behavior to use the fd instead of the path

This fixes the broken test cases - unlinked files will still stat
successfully and temporary files will return stat for the file rather
than the parent directory.

There's probably a negligible performance boost since we don't need to
do anything with the path (I believe it saves a memory allocation + some
other cycles) + the kernel might have to do less work handling the
syscall. Of course, stat should never be in the hot path so it's largely
an academic difference.

**File**: `glommio/Cargo.toml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ buddy-alloc = "0.4"
 concurrent-queue = "1.2"
 crossbeam = "0.8"
 enclose = "1.1"
-flume = { version = "0.10", features = ["async"] }
+flume = { version = "0.11", features = ["async"] }
 futures-lite = "1.12"
 intrusive-collections = "0.9"
 lazy_static = "1.4"
```

**File**: `glommio/src/io/buffered_file_stream.rs` (modified, +1/-5)
```diff
@@ -502,11 +502,7 @@ macro_rules! do_seek {
             }
             SeekFrom::End(pos) => match $source.take() {
                 None => {
-                    let source = $self
-                        .reactor
-                        .upgrade()
-                        .unwrap()
-                        .statx($fileobj.as_raw_fd(), &$fileobj.path().unwrap());
+                    let source = $self.reactor.upgrade().unwrap().statx($fileobj.as_raw_fd());
                     source.add_waiter_single($cx.waker());
                     $source = Some(source);
                     Poll::Pending
```

**File**: `glommio/src/io/dma_file.rs` (modified, +52/-0)
```diff
@@ -1618,6 +1618,58 @@ pub(crate) mod test {
             .expect_err("O_TMPFILE requires opening with write permissions");
     });
 
+    dma_file_test!(deleted_file_still_can_be_stat, path, _k, {
+        let file = OpenOptions::new()
+            .create_new(true)
+            .read(true)
+            .write(true)
+            .dma_open(path.join("deleted_file_still_can_be_stat"))
+            .await
+            .expect("file should open");
+        let mut buf = file.alloc_dma_buffer(512);
+        buf.as_bytes_mut().fill(2);
+        file.write_at(buf, 0)
+            .await
+            .expect("should be able to write the file");
+        file.remove().await.expect("should have removed file");
+        let stat = file
+            .stat()
+            .await
+            .expect("should be able to state unlinked but open file");
+        assert_eq!(stat.file_size, 512);
+    });
+
+    dma_file_test!(tmpfiles_have_unique_inode, path, _k, {
+        let f1 = OpenOptions::new()
+            .create_new(true)
+            .read(true)
+            .write(true)
+            .tmpfile(true)
+            .dma_open(&path)
+            .await
+            .unwrap();
+
+        let f2 = OpenOptions::new()
+            .create_new(true)
+            .read(true)
+            .write(true)
+            .tmpfile(true)
+            .dma_open(&path)
+            .await
+            .unwrap();
+
+        assert_ne!(f1.inode(), f2.inode());
+        assert_eq!(f1.stat().await.unwrap().file_size, 0);
+        assert_eq!(f2.stat().await.unwrap().file_size, 0);
+
+        let mut buf = f1.alloc_dma_buffer(512);
+        buf.as_bytes_mut().fill(2);
+        f1.write_at(buf, 0)
+            .await
+            .expect("failed to write to temporary file");
+        assert_eq!(f1.stat().await.unwrap().file_size, 512);
+    });
+
     dma_file_test!(resize_dma_buf, path, _k, {
         let file = OpenOptions::new()
             .create_new(true)
```

**File**: `glommio/src/io/glommio_file.rs` (modified, +1/-7)
```diff
@@ -329,13 +329,7 @@ impl GlommioFile {
 
     // Retrieve file metadata, backed by the statx(2) syscall
     pub(crate) async fn statx(&self) -> Result<Statx> {
-        let path = self.path_required("stat")?.to_owned();
-
-        let source = self
-            .reactor
-            .upgrade()
-            .unwrap()
-            .statx(self.as_raw_fd(), path.as_ref());
+        let source = self.reactor.upgrade().unwrap().statx(self.as_raw_fd());
         source.collect_rw().await.map_err(|source| {
             GlommioError::create_enhanced(
                 source,
```

**File**: `glommio/src/reactor.rs` (modified, +3/-5)
```diff
@@ -737,20 +737,18 @@ impl Reactor {
         source
     }
 
-    pub(crate) fn statx(&self, raw: RawFd, path: &Path) -> Source {
-        let path = CString::new(path.as_os_str().as_bytes()).expect("path contained null!");
-
+    pub(crate) fn statx(&self, raw: RawFd) -> Source {
         let statx_buf = unsafe {
             let statx_buf = mem::MaybeUninit::<Statx>::zeroed();
             statx_buf.assume_init()
         };
 
         let source = self.new_source(
             raw,
-            SourceType::Statx(path, Box::new(RefCell::new(statx_buf))),
+            SourceType::Statx(Box::new(RefCell::new(statx_buf))),
             None,
         );
-        self.sys.statx(&source);
+        self.sys.statx_fd(&source);
         source
     }
 
```

**File**: `glommio/src/sys/source.rs` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ pub(crate) enum SourceType {
     Close,
     LinkRings,
     ForeignNotifier(u64, bool),
-    Statx(CString, Box<RefCell<Statx>>),
+    Statx(Box<RefCell<Statx>>),
     Timeout(TimeSpec64, u32),
     Connect(nix::sys::socket::SockaddrStorage),
     Accept(SockAddrStorage),
@@ -73,7 +73,7 @@ impl TryFrom<SourceType> for Statx {
 
     fn try_from(value: SourceType) -> Result<Self, Self::Error> {
         match value {
-            SourceType::Statx(_, buf) => Ok(buf.into_inner()),
+            SourceType::Statx(buf) => Ok(buf.into_inner()),
             src => Err(GlommioError::ReactorError(
                 ReactorErrorKind::IncorrectSourceType(format!("{src:?}")),
             )),
```

**File**: `glommio/src/sys/uring.rs` (modified, +9/-10)
```diff
@@ -70,7 +70,7 @@ enum UringOpDescriptor {
     LinkTimeout(*const uring_sys::__kernel_timespec),
     Accept(*mut SockAddrStorage),
     Fallocate(u64, u64, libc::c_int),
-    Statx(*const u8, *mut Statx),
+    StatxFd(RawFd, *mut Statx),
     Timeout(*const uring_sys::__kernel_timespec, u32),
     TimeoutRemove(u64),
     SockSend(*const u8, usize, i32),
@@ -334,12 +334,12 @@ fn fill_sqe<F>(
                 let flags = FallocateFlags::from_bits_truncate(flags);
                 sqe.prep_fallocate(op.fd, offset, size, flags);
             }
-            UringOpDescriptor::Statx(path, statx_buf) => {
-                let flags = StatxFlags::AT_STATX_SYNC_AS_STAT | StatxFlags::AT_NO_AUTOMOUNT;
+            UringOpDescriptor::StatxFd(fd, statx_buf) => {
+                let flags = StatxFlags::AT_STATX_SYNC_AS_STAT
+                    | StatxFlags::AT_NO_AUTOMOUNT
+                    | StatxFlags::AT_EMPTY_PATH;
                 let mode = StatxMode::from_bits_truncate(0x7ff);
-
-                let path = CStr::from_ptr(path as _);
-                sqe.prep_statx(-1, path, flags, mode, &mut *statx_buf);
+                sqe.prep_statx(fd, Default::default(), flags, mode, &mut *statx_buf);
             }
             UringOpDescriptor::Timeout(timespec, events) => {
                 sqe.prep_timeout(&*timespec, events, TimeoutFlags::empty());
@@ -1641,12 +1641,11 @@ impl Reactor {
         );
     }
 
-    pub(crate) fn statx(&self, source: &Source) {
+    pub(crate) fn statx_fd(&self, source: &Source) {
         let op = match &*source.source_type() {
-            SourceType::Statx(path, buf) => {
-                let path = path.as_c_str().as_ptr();
+            SourceType::Statx(buf) => {
                 let buf = buf.as_ptr();
-                UringOpDescriptor::Statx(path as _, buf)
+                UringOpDescriptor::StatxFd(source.raw(), buf)
             }
             _ => panic!("Unexpected source for statx operation"),
         };
```

---

### Incident Patch 7: `f920e804` (2024-04-24)
**Commit Message**: fix: export publicly 'StallDetection' (#656)

**File**: `glommio/src/executor/stall.rs` (modified, +13/-6)
```diff
@@ -16,13 +16,20 @@ use std::{
     time::{Duration, Instant},
 };
 
+/// Store information about detected stall
 pub struct StallDetection<'a> {
-    executor: usize,
-    queue_handle: TaskQueueHandle,
-    queue_name: &'a str,
-    trace: backtrace::Backtrace,
-    budget: Duration,
-    overage: Duration,
+    /// Executor id in which the detection occurred
+    pub executor: usize,
+    /// The handle of the queue where the stall was detected
+    pub queue_handle: TaskQueueHandle,
+    /// Name of the queue
+    pub queue_name: &'a str,
+    /// Backtrace captured on stall detection
+    pub trace: backtrace::Backtrace,
+    /// Maximum allowed duration for a task execution before being considered stalled
+    pub budget: Duration,
+    /// Additional duration granted for task execution
+    pub overage: Duration,
 }
 
 impl fmt::Debug for StallDetection<'_> {
```

**File**: `glommio/src/lib.rs` (modified, +1/-1)
```diff
@@ -448,7 +448,7 @@ pub use crate::{
     executor::{
         allocate_dma_buffer, allocate_dma_buffer_global, executor, spawn_local, spawn_local_into,
         spawn_scoped_local, spawn_scoped_local_into,
-        stall::{DefaultStallDetectionHandler, StallDetectionHandler},
+        stall::{DefaultStallDetectionHandler, StallDetection, StallDetectionHandler},
         yield_if_needed, CpuSet, ExecutorJoinHandle, ExecutorProxy, ExecutorStats, LocalExecutor,
         LocalExecutorBuilder, LocalExecutorPoolBuilder, Placement, PoolPlacement,
         PoolThreadHandles, ScopedTask, Task, TaskQueueHandle, TaskQueueStats,
```

---

### Incident Patch 8: `b0e93f9e` (2024-03-18)
**Commit Message**: Fix third-party vulnerability caused by atty v0.2.14 (#644)

* Update Clap version to 4.6

Github detects third-party vulnerabilities seems to originate from the
old version of clap.

* fix fmt

* Replace pretty-bytes with byte-unit

**File**: `examples/Cargo.toml` (modified, +2/-2)
```diff
@@ -6,8 +6,9 @@ publish = false
 edition = "2021"
 
 [dev-dependencies]
+byte-unit = "5.1.4"
 yansi = "~0.5.1"
-clap = "2.33"
+clap = "4.5.3"
 fastrand = "1.4.0"
 futures = "~0.3.5"
 futures-lite = "1.11.1"
@@ -16,7 +17,6 @@ glommio = { path = "../glommio" }
 # hyper and tokio for the hyper example. We just need the traits from Tokio
 hyper = { version = "1.2.0", features = ["full"] }
 num_cpus = "1.13.0"
-pretty-bytes = "~0.2.2"
 sys-info = "~0.8.0"
 http-body-util = "0.1.0"
 serde_json = "1.0.114"
```

**File**: `examples/storage.rs` (modified, +37/-29)
```diff
@@ -1,4 +1,5 @@
-use clap::{App, Arg};
+use byte_unit::{Byte, UnitType};
+use clap::{Arg, Command};
 use futures_lite::{
     stream::{self, StreamExt},
     AsyncReadExt, AsyncWriteExt,
@@ -11,7 +12,6 @@ use glommio::{
     },
     LocalExecutorBuilder, Placement,
 };
-use pretty_bytes::converter;
 use std::{
     cell::Cell,
     fs,
@@ -51,13 +51,17 @@ async fn stream_write<T: AsyncWriteExt + std::marker::Unpin, S: Into<String>>(
 
     let endw = Instant::now();
     let time = start.elapsed();
-    let bytes = converter::convert(file_size as _);
-    let rate = converter::convert((file_size as f64 / time.as_secs_f64()) as _);
-    println!("{name}: Wrote {bytes} in {time:#?}, {rate}/s");
+    let bytes = Byte::from_u64(file_size).get_appropriate_unit(UnitType::Binary);
+    let rate = Byte::from_f64(file_size as f64 / time.as_secs_f64())
+        .unwrap_or_default()
+        .get_appropriate_unit(UnitType::Binary);
+    println!("{name}: Wrote {bytes:.2} in {time:#?}, {rate:.2}/s");
     stream.close().await.unwrap();
-    let rate = converter::convert((file_size as f64 / start.elapsed().as_secs_f64()) as _);
+    let rate = Byte::from_f64(file_size as f64 / start.elapsed().as_secs_f64())
+        .unwrap_or_default()
+        .get_appropriate_unit(UnitType::Binary);
     let time = endw.elapsed();
-    println!("{name}: Closed in {time:#?}, Amortized total {rate}/s");
+    println!("{name}: Closed in {time:#?}, Amortized total {rate:.2}/s");
 }
 
 async fn stream_scan<T: AsyncReadExt + std::marker::Unpin, S: Into<String>>(
@@ -82,10 +86,12 @@ async fn stream_scan<T: AsyncReadExt + std::marker::Unpin, S: Into<String>>(
     let time = start.elapsed();
     let name = name.into();
 
-    let bytes = converter::convert(bytes_read as _);
-    let rate = converter::convert((bytes_read as f64 / time.as_secs_f64()) as _);
+    let bytes = Byte::from_u64(bytes_read as _).get_appropriate_unit(UnitType::Binary);
+    let rate = Byte::from_f64(bytes_read as f64 / time.as_secs_f64())
+        .unwrap_or_default()
+        .get_appropriate_unit(UnitType::Binary);
     println!(
-        "{name}: Scanned {bytes} in {time:#?}, {rate}/s, {} IOPS",
+        "{name}: Scanned {bytes:.2} in {time:#?}, {rate:.2}/s, {} IOPS",
         (ops as f64 / time.as_secs_f64()) as usize
     );
     stream
@@ -115,10 +121,12 @@ async fn stream_scan_alt_api<S: Into<String>>(
     let time = start.elapsed();
     let name = name.into();
 
-    let bytes = converter::convert(bytes_read as _);
-    let rate = converter::convert((bytes_read as f64 / time.as_secs_f64()) as _);
+    let bytes = Byte::from_u64(bytes_read as _).get_appropriate_unit(UnitType::Binary);
+    let rate = Byte::from_f64(bytes_read as f64 / time.as_secs_f64())
+        .unwrap_or_default()
+        .get_appropriate_unit(UnitType::Binary);
     println!(
-        "{name}: Scanned {bytes} in {time:#?}, {rate}/s, {} IOPS",
+        "{name}: Scanned {bytes:.2} in {time:#?}, {rate:.2}/s, {} IOPS",
         (ops as f64 / time.as_secs_f64()) as usize
     );
     stream.close().await.unwrap();
@@ -212,11 +220,11 @@ async fn random_read<S: Into<String>>(
         Ok(file) => file.close().await,
     };
 
-    assert_eq!(finished, parallelism as _);
-    let bytes = converter::convert(random as _);
+    assert_eq!(finished, parallelism);
+    let bytes = Byte::from_u64(random).get_appropriate_unit(UnitType::Binary);
     let dur = time.elapsed();
     println!(
-        "{name}: Random Read (uniform) size span of {bytes}, for {dur:#?}, {} IOPS",
+        "{name}: Random Read (uniform) size span of {bytes:.2}, for {dur:#?}, {} IOPS",
         (iops.get() as f64 / dur.as_secs_f64()) as usize
     );
 }
@@ -261,39 +269,39 @@ async fn random_many_read<S: Into<String>>(
         Ok(file) => file.close().await,
     };
 
-    assert_eq!(finished, parallelism as _);
-    let bytes = converter::convert(random as _);
-    let max_merged = converter::convert(max_buffer_size as _);
+    assert_eq!(finished, parallelism);
+    let bytes = Byte::from_u64(random).get_appropriate_unit(UnitType::Binary);
+    let max_merged = Byte::from_u64(max_buffer_size as _).get_appropriate_unit(UnitType::Binary);
     let dur = time.elapsed();
     println!(
-        "{name}: Random Bulk Read (uniform) size span of {bytes}, for {dur:#?} (max merged size \
-         of {max_merged}), {} IOPS",
+        "{name}: Random Bulk Read (uniform) size span of {bytes:.2}, for {dur:#?} (max merged size \
+         of {max_merged:.2}), {} IOPS",
         (iops.get() as f64 / dur.as_secs_f64()) as usize
     );
 }
 
 fn main() {
-    let matches = App::new("storage example")
+    let matches = Command::new("storage example")
         .version("0.1.0")
         .author("Glauber Costa <glauber@datadoghq.com>")
         .about("demonstrate glommio's storage APIs")
         .arg(
-            Arg::with_name("storage_dir")
+            Arg::new("storage_dir")
                 .long("dir")
-                .takes_value(
```

---

### Incident Patch 9: `328b3b62` (2023-12-03)
**Commit Message**: Fix stall detector to be correct threshold (#628)

The final expected runtime, is supposed to be whatever we get
from the `threshold` call.

If we add the `max_expected_time` again, it will be wrong.

**File**: `glommio/src/executor/stall.rs` (modified, +2/-2)
```diff
@@ -60,9 +60,9 @@ pub trait StallDetectionHandler: std::fmt::Debug + Send + Sync {
     fn threshold(
         &self,
         _queue_handle: TaskQueueHandle,
-        max_expected_runtime: Duration,
+        _max_expected_runtime: Duration,
     ) -> Option<Duration> {
-        Some(max_expected_runtime + Duration::from_millis(10))
+        Some(Duration::from_millis(10))
     }
 
     /// What signal number to use; see values in libc::SIG*.
```

---

### Incident Patch 10: `c6ca6f2b` (2023-11-23)
**Commit Message**: fix test for file send

The test is broken because we can't really guarantee that the old fd
will fail to open. It is entirely possible that by now, some other test
(remember tests are threaded) have opened a new file for itself that
ended up with the same fd as original_fd.

This test was always failing for me when I ran "cargo test" but always
succeeding if I ran the test in isolation, which confirms that this is
the likely cause.

**File**: `glommio/src/io/dma_file.rs` (modified, +0/-3)
```diff
@@ -780,7 +780,6 @@ pub(crate) mod test {
     };
     use futures::join;
     use futures_lite::{stream, StreamExt};
-    use nix::fcntl::{fcntl, FcntlArg::F_GETFD};
     use rand::{seq::SliceRandom, thread_rng};
     use std::{cell::RefCell, convert::TryInto, path::PathBuf, time::Duration};
 
@@ -1547,8 +1546,6 @@ pub(crate) mod test {
         .join()
         .unwrap();
 
-        assert_eq!(fcntl(original_fd, F_GETFD), Err(nix::errno::Errno::EBADF));
-
         let file: DmaFile = result.into();
         assert_ne!(file.as_raw_fd(), original_fd);
         assert_eq!(file.file.inode, original_inode);
```

---

### Incident Patch 11: `7c7c3665` (2023-11-22)
**Commit Message**: Fix Timers type in docs (#623)

* Fix Timers type in docs

* Fix typo in parking.rs

pool -> poll

---------

Co-authored-by: Glauber Costa <[REDACTED_EMAIL]>

**File**: `glommio/src/parking.rs` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ impl Parker {
         self.inner.park(|| None)
     }
 
-    /// Performs non-sleepable pool and install a preemption timeout into the
+    /// Performs non-sleepable poll and installs a preemption timeout into the
     /// ring with `Duration`. A value of zero means we are not interested in
     /// installing a preemption timer. Tasks executing in the CPU right after
     /// this will be able to check if the timer has elapsed and yield the
```

**File**: `glommio/src/reactor.rs` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ struct Timers {
 
     /// An ordered map of registered timers.
     ///
-    /// Timers are in the order in which they fire. The `usize` in this type is
+    /// Timers are in the order in which they fire. The `u64` in this type is
     /// a timer ID used to distinguish timers that fire at the same time.
     /// The [`Waker`] represents the task awaiting the timer.
     timers: BTreeMap<(Instant, u64), Waker>,
```

---

### Incident Patch 12: `a3d9d227` (2023-10-15)
**Commit Message**: fix description of shares behavior

Fixes #615

**File**: `glommio/src/lib.rs` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@
 //!
 //! This example creates two task queues: `tq1` has 2 shares, `tq2` has 1 share.
 //! This means that if both want to use the CPU to its maximum, `tq1` will have
-//! `1/3` of the CPU time `(1 / (1 + 2))` and `tq2` will have `2/3` of the CPU
+//! `2/3` of the CPU time `(2 / (1 + 2))` and `tq2` will have `1/3` of the CPU
 //! time. Those shares are dynamic and can be changed at any time. Notice that
 //! this scheduling method doesn't prevent either `tq1` no `tq2` from using 100%
 //! of CPU time at times in which they are the only task queue running: the
```

---

### Incident Patch 13: `e3bdf40e` (2023-10-06)
**Commit Message**: Fix Unbound background thread pool affinity (#607)

* fix CI: Bump minimum version to 1.65

backtrace picked up a new addr2line in a patch release that depends on
1.65.

* Fix Cargo warning about resolver

```
warning: some crates are on edition 2021 which defaults to `resolver = "2"`, but virtual workspaces default to `resolver = "1"`
note: to keep the current resolver, specify `workspace.resolver = "1"` in the workspace root's manifest
note: to use the edition 2021 resolver, specify `workspace.resolver = "2"` in the workspace root's manifest
```

* Fix clippy warnings in newer Rust compilers.

* Upgrade to bitflags 2

Resolves clippy errors that are now caught: https://github.com/bitflags/bitflags/pull/373

* Add test highlighting the problem

* Fix background thread pool unbound placement

Any threads we spawn inherit our affinity. This means that background
thread pools for any executors that don't have an affinity of "Unbound"
will only ever run on the executor's CPU rather than distributing work
across many CPUs. This seems undesirable given that the background
thread pool placement can be set independent of the executor it's
associated with. Addit

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ jobs:
           cat << EOF > "run-gha-workflow.sh"
           PATH=$PATH:/usr/share/rust/.cargo/bin
           echo "`nproc` CPU(s) available"
-          rustup install 1.58
+          rustup install 1.65
           rustup show
           rustup default stable
           cargo install cargo-sort
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -3,3 +3,4 @@ members = [
   "examples",
   "glommio",
 ]
+resolver = "2"
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ an [introductory article.](https://www.datadoghq.com/blog/engineering/introducin
 
 ## Supported Rust Versions
 
-Glommio is built against the latest stable release. The minimum supported version is 1.58. The current Glommio version
+Glommio is built against the latest stable release. The minimum supported version is 1.65. The current Glommio version
 is not guaranteed to build on Rust versions earlier than the minimum supported version.
 
 ## Supported Linux kernels
```

**File**: `examples/ping_pong.rs` (modified, +9/-12)
```diff
@@ -30,19 +30,16 @@ fn main() {
         .detach();
 
         // What would you write if there were no enclose! macro.
-        let second =
-            glommio::spawn_local(|_left: Rc<RefCell<bool>>, right: Rc<RefCell<bool>>| -> _ {
-                async move {
-                    loop {
-                        if !(*(right.borrow())) {
-                            println!("right");
-                            *(right.borrow_mut()) = true
-                        }
-                        glommio::yield_if_needed().await;
-                    }
+        let second = glommio::spawn_local(async move {
+            loop {
+                if !(*(right.borrow())) {
+                    println!("right");
+                    *(right.borrow_mut()) = true
                 }
-            }(left.clone(), right.clone()))
-            .detach();
+                glommio::yield_if_needed().await;
+            }
+        })
+        .detach();
 
         futures::join!(first, second);
     });
```

**File**: `glommio/Cargo.toml` (modified, +2/-2)
```diff
@@ -15,12 +15,12 @@ keywords = ["linux", "rust", "async", "iouring", "thread-per-core"]
 categories = ["asynchronous", "concurrency", "os", "filesystem", "network-programming"]
 readme = "../README.md"
 # This is also documented in the README.md under "Supported Rust Versions"
-rust-version = "1.58"
+rust-version = "1.65"
 
 [dependencies]
 ahash = "0.7"
 backtrace = { version = "0.3" }
-bitflags = "1.3"
+bitflags = "2.4"
 bitmaps = "3.1"
 buddy-alloc = "0.4"
 concurrent-queue = "1.2"
```

**File**: `glommio/src/channels/channel_mesh.rs` (modified, +3/-2)
```diff
@@ -7,6 +7,7 @@ use std::{
     cell::Cell,
     fmt::{self, Debug, Formatter},
     io::{Error, ErrorKind},
+    rc::Rc,
 };
 
 use std::sync::{Arc, RwLock};
@@ -251,7 +252,7 @@ pub type PartialMesh<T> = MeshBuilder<T, Partial>;
 pub struct MeshBuilder<T: Send, A: MeshAdapter> {
     nr_peers: usize,
     channel_size: usize,
-    peers: Arc<RwLock<Vec<Peer>>>,
+    peers: Rc<RwLock<Vec<Peer>>>,
     channels: Arc<SharedChannels<T>>,
     adapter: A,
 }
@@ -308,7 +309,7 @@ impl<T: 'static + Send, A: MeshAdapter> MeshBuilder<T, A> {
         MeshBuilder {
             nr_peers,
             channel_size,
-            peers: Arc::new(RwLock::new(Vec::new())),
+            peers: Rc::new(RwLock::new(Vec::new())),
             channels: Arc::new(Self::placeholder(nr_peers)),
             adapter,
         }
```

**File**: `glommio/src/channels/shared_channel.rs` (modified, +1/-1)
```diff
@@ -295,7 +295,7 @@ impl<T: Send + Sized> ConnectedSender<T> {
         res
     }
 
-    fn wait_for_room(&self, cx: &mut Context<'_>) -> Poll<()> {
+    fn wait_for_room(&self, cx: &Context<'_>) -> Poll<()> {
         match self.state.buffer.free_space() > 0 || self.state.buffer.producer_disconnected() {
             true => Poll::Ready(()),
             false => {
```

**File**: `glommio/src/error.rs` (modified, +1/-0)
```diff
@@ -532,6 +532,7 @@ impl<T> From<GlommioError<T>> for io::Error {
 }
 
 #[cfg(test)]
+#[allow(clippy::unnecessary_literal_unwrap)]
 mod test {
     use std::{io, panic::panic_any};
 
```

---

### Incident Patch 14: `9570106b` (2023-08-16)
**Commit Message**: trying to fix CI

**File**: `.github/workflows/ci.yml` (modified, +3/-62)
```diff
@@ -15,7 +15,7 @@ jobs:
 
     steps:
       - name: Checkout
-        uses: actions/checkout@v2
+        uses: actions/checkout@v3
 
       - name: Cache setup
         uses: ./.github/actions/cache-setup
@@ -26,24 +26,6 @@ jobs:
       - name: Generate documentation
         run: cargo doc --all
 
-  doc-nightly:
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v2
-
-      - name: Cache setup
-        uses: ./.github/actions/cache-setup
-
-      - name: Install cargo-deadlinks
-        run: which deadlinks || cargo install cargo-deadlinks
-
-      - name: Generate documentation
-        run: |
-          rustup install nightly
-          cargo +nightly doc --all
-
     # temporarily disabled.
     # - name: Validate links
     #   run: cargo deadlinks --dir target/doc/glommio
@@ -53,35 +35,20 @@ jobs:
 
     steps:
       - name: Checkout
-        uses: actions/checkout@v2
+        uses: actions/checkout@v3
 
       - name: Cache setup
         uses: ./.github/actions/cache-setup
 
       - name: Build all targets
         run: cargo build --all --all-targets
 
-  build-nightly:
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v2
-
-      - name: Cache setup
-        uses: ./.github/actions/cache-setup
-
-      - name: Build all targets on the nigthly channel
-        run: >
-          rustup install nightly;
-          cargo +nightly build --all --all-targets --features=nightly
-
   test:
     runs-on: ubuntu-latest
 
     steps:
       - name: Checkout
-        uses: actions/checkout@v2
+        uses: actions/checkout@v3
 
       - name: Cache setup
         uses: ./.github/actions/cache-setup
@@ -91,36 +58,10 @@ jobs:
           cat << EOF > "run-gha-workflow.sh"
           PATH=$PATH:/usr/share/rust/.cargo/bin
           echo "`nproc` CPU(s) available"
-          rustup install nightly
-          rustup component add rustfmt --toolchain nightly-x86_64-unknown-linux-gnu
           rustup install 1.58
           rustup show
           rustup default stable
           cargo install cargo-sort
           cargo test -- --test-threads=`nproc`
           EOF
           sudo -E bash -c "ulimit -Sl 512 && ulimit -Hl 512 && bash run-gha-workflow.sh"
-
-  test-nightly:
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v2
-
-      - name: Cache setup
-        uses: ./.github/actions/cache-setup
-
-      - name: Install cargo helpers and test all targets on the nigthly channel
-        run: |
-          cat << EOF > "run-gha-workflow.sh"
-          PATH=$PATH:/usr/share/rust/.cargo/bin
-          echo "`nproc` CPU(s) available"
-          rustup install nightly
-          rustup component add rustfmt --toolchain nightly-x86_64-unknown-linux-gnu
-          rustup install 1.58
-          cargo install cargo-sort
-          rustup show
-          cargo +nightly test --features=nightly -- --test-threads=`nproc`
-          EOF
-          sudo -E bash -c "ulimit -Sl 512 && ulimit -Hl 512 && bash run-gha-workflow.sh"
```

**File**: `examples/storage.rs` (modified, +4/-13)
```diff
@@ -1,24 +1,15 @@
 use clap::{App, Arg};
 use futures_lite::{
     stream::{self, StreamExt},
-    AsyncReadExt,
-    AsyncWriteExt,
+    AsyncReadExt, AsyncWriteExt,
 };
 use glommio::{
     enclose,
     io::{
-        BufferedFile,
-        DmaFile,
-        DmaStreamReader,
-        DmaStreamReaderBuilder,
-        DmaStreamWriterBuilder,
-        MergedBufferLimit,
-        ReadAmplificationLimit,
-        StreamReaderBuilder,
-        StreamWriterBuilder,
+        BufferedFile, DmaFile, DmaStreamReader, DmaStreamReaderBuilder, DmaStreamWriterBuilder,
+        MergedBufferLimit, ReadAmplificationLimit, StreamReaderBuilder, StreamWriterBuilder,
     },
-    LocalExecutorBuilder,
-    Placement,
+    LocalExecutorBuilder, Placement,
 };
 use pretty_bytes::converter;
 use std::{
```

**File**: `glommio/Cargo.toml` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ homepage = "https://github.com/DataDog/glommio"
 keywords = ["linux", "rust", "async", "iouring", "thread-per-core"]
 categories = ["asynchronous", "concurrency", "os", "filesystem", "network-programming"]
 readme = "../README.md"
+# This is also documented in the README.md under "Supported Rust Versions"
+rust-version = "1.58"
 
 [dependencies]
 ahash = "0.7"
```

**File**: `glommio/benches/competing_io.rs` (modified, +1/-5)
```diff
@@ -3,10 +3,7 @@ use futures_lite::AsyncWriteExt;
 use glommio::{
     enclose,
     io::{ImmutableFile, ImmutableFileBuilder},
-    Latency,
-    LocalExecutorBuilder,
-    Placement,
-    Shares,
+    Latency, LocalExecutorBuilder, Placement, Shares,
 };
 use rand::Rng;
 use std::{
@@ -102,7 +99,6 @@ async fn run_io(name: &str, file: &ImmutableFile, count: usize, size: usize) {
     let started_at = Instant::now();
 
     let tasks: Vec<_> = (0..2 << 10)
-        .into_iter()
         .map(|_| {
             let file = file.clone();
             let hist = hist.clone();
```

**File**: `glommio/benches/tcp.rs` (modified, +1/-2)
```diff
@@ -5,8 +5,7 @@ use futures_lite::{
 use glommio::{
     enclose,
     net::{TcpListener, TcpStream},
-    LocalExecutorBuilder,
-    Placement,
+    LocalExecutorBuilder, Placement,
 };
 use std::{
     cell::Cell,
```

**File**: `glommio/src/channels/channel_mesh.rs` (modified, +1/-2)
```diff
@@ -13,8 +13,7 @@ use std::sync::{Arc, RwLock};
 
 use crate::{
     channels::shared_channel::{self, *},
-    GlommioError,
-    Result,
+    GlommioError, Result,
 };
 
 /// Sender side
```

**File**: `glommio/src/channels/local_channel.rs` (modified, +1/-7)
```diff
@@ -13,13 +13,7 @@ use std::{
 };
 
 use intrusive_collections::{
-    container_of,
-    linked_list::LinkOps,
-    offset_of,
-    Adapter,
-    LinkedList,
-    LinkedListLink,
-    PointerOps,
+    container_of, linked_list::LinkOps, offset_of, Adapter, LinkedList, LinkedListLink, PointerOps,
 };
 
 use std::{collections::VecDeque, marker::PhantomPinned, ptr::NonNull};
```

**File**: `glommio/src/channels/sharding.rs` (modified, +1/-3)
```diff
@@ -9,9 +9,7 @@ use futures_lite::{Future, Stream, StreamExt};
 use crate::{
     channels::channel_mesh::{FullMesh, Senders},
     task::JoinHandle,
-    GlommioError,
-    ResourceType,
-    Result,
+    GlommioError, ResourceType, Result,
 };
 
 /// Alias for return type of `Handler`
```

---

### Incident Patch 15: `9faa8bf4` (2023-02-27)
**Commit Message**: fix clippy errors

**File**: `glommio/src/channels/shared_channel.rs` (modified, +0/-1)
```diff
@@ -286,7 +286,6 @@ impl<T: Send + Sized> ConnectedSender<T> {
     /// producer.join().unwrap();
     /// receiver.join().unwrap();
     /// ```
-    #[track_caller]
     pub async fn send(&self, item: T) -> Result<(), T> {
         let waiter = future::poll_fn(|cx| self.wait_for_room(cx));
         waiter.await;
```

**File**: `glommio/src/lib.rs` (modified, +1/-1)
```diff
@@ -648,7 +648,7 @@ impl RingIoStats {
     /// [`files_opened`]: RingIoStats::files_opened
     /// [`files_closed`]: RingIoStats::files_closed
     pub fn files_closed(&self) -> u64 {
-        self.files_opened
+        self.files_closed
     }
 
     /// File read IO stats
```

**File**: `glommio/src/net/udp_socket.rs` (modified, +0/-2)
```diff
@@ -492,7 +492,6 @@ impl UdpSocket {
     /// The function must be called with valid byte array buf of sufficient size
     /// to hold the message bytes. If a message is too long to fit in the
     /// supplied buffer, excess bytes may be discarded.
-    #[track_caller]
     pub async fn peek_from(&self, buf: &mut [u8]) -> Result<(usize, SocketAddr)> {
         let (sz, addr) = self.socket.peek_from(buf).await?;
 
@@ -580,7 +579,6 @@ impl UdpSocket {
     ///     assert_eq!(addr, sender.local_addr().unwrap());
     /// })
     /// ```
-    #[track_caller]
     pub async fn recv_from(&self, buf: &mut [u8]) -> Result<(usize, SocketAddr)> {
         let (sz, addr) = self.socket.recv_from(buf).await?;
         let addr = match addr {
```

**File**: `glommio/src/net/unix.rs` (modified, +0/-2)
```diff
@@ -594,7 +594,6 @@ impl UnixDatagram {
     /// The function must be called with valid byte array buf of sufficient size
     /// to hold the message bytes. If a message is too long to fit in the
     /// supplied buffer, excess bytes may be discarded.
-    #[track_caller]
     pub async fn peek_from(&self, buf: &mut [u8]) -> Result<(usize, UnixAddr)> {
         let (sz, addr) = self.socket.peek_from(buf).await?;
 
@@ -672,7 +671,6 @@ impl UnixDatagram {
     ///     assert_eq!(sz, 1);
     /// })
     /// ```
-    #[track_caller]
     pub async fn recv_from(&self, buf: &mut [u8]) -> Result<(usize, UnixAddr)> {
         let (sz, addr) = self.socket.recv_from(buf).await?;
         let addr = match addr {
```

#### Recent Merged Pull Requests:
- **PR #712** (closed): chore(deps): update rust crate flume to 0.12 - autoclosed (@dd-octo-sts[bot])
- **PR #711** (closed): chore(deps): update rust crate buddy-alloc to 0.6 - autoclosed (@dd-octo-sts[bot])
- **PR #710** (closed): chore(deps): update rust crate ahash to 0.8 - autoclosed (@dd-octo-sts[bot])
- **PR #706** (closed): chore(deps): update rust crate yansi to v1 (@dd-octo-sts[bot])
- **PR #705** (closed): chore(deps): update rust crate concurrent-queue to v2 (@dd-octo-sts[bot])
- **PR #704** (closed): chore(deps): update cargo non-major dependencies - autoclosed (@dd-octo-sts[bot])
- **PR #702** (closed): Update dependencies (@Michael-Wigham)
- **PR #698** (closed): CI tests (@taufik-rama)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
