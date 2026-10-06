# Forensic Learning Record (Deep Inspection): ydb-platform/ydb

> **Canonical Artifact**: `07_PROJECT_LEARNING/ydb-platform-ydb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ydb-platform/ydb](https://github.com/ydb-platform/ydb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:35.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ydb-platform/ydb`
- **Description**: YDB is an open source Distributed SQL Database that combines high availability and scalability with strong consistency and ACID transactions
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4775 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/deprecated/python/backports.shutil-get-terminal-size/backports/shutil_get_terminal_size/__init__.py`
```
"""A backport of the get_terminal_size function from Python 3.3's shutil."""

__title__ = "backports.shutil_get_terminal_size"
__version__ = "1.0.0"
__license__ = "MIT"
__author__ = "Christopher Rosell"
__copyright__ = "Copyright 2014 Christopher Rosell"

__all__ = ["get_terminal_size"]

from .get_terminal_size import get_terminal_size

```

### Core Architecture Module: `contrib/deprecated/python/backports.shutil-get-terminal-size/backports/shutil_get_terminal_size/get_terminal_size.py`
```
"""This is a backport of shutil.get_terminal_size from Python 3.3.

The original implementation is in C, but here we use the ctypes and
fcntl modules to create a pure Python version of os.get_terminal_size.
"""

import os
import struct
import sys

from collections import namedtuple

__all__ = ["get_terminal_size"]


terminal_size = namedtuple("terminal_size", "columns lines")

try:
    from ctypes import windll, create_string_buffer

    _handles = {
        0: windll.kernel32.GetStdHandle(-10),
        1: windll.kernel32.GetStdHandle(-11),
        2: windll.kernel32.GetStdHandle(-12),
    }

    def _get_terminal_size(fd):
        columns = lines = 0

        try:
            handle = _handles[fd]
            csbi = create_string_buffer(22)
            res = windll.kernel32.GetConsoleScreenBufferInfo(handle, csbi)
            if res:
                res = struct.unpack("hhhhHhhhhhh", csbi.raw)
                left, top, right, bottom = res[5:9]
                columns = right - left + 1
                lines = bottom - top + 1
        except Exception:
            pass

        return terminal_size(columns, lines)

except (ImportError, OSError):
    import fcntl
    import termios

    def _get_terminal_size(fd):
        try:
            res = fcntl.ioctl(fd, termios.TIOCGWINSZ, b"\x00" * 4)
            lines, columns = struct.unpack("hh", res)
        except Exception:
            columns = lines = 0

        return terminal_size(columns, lines)


def get_terminal_size(fallback=(80, 24)):
    """Get the size of the terminal window.

    For each of the two dimensions, the environment variable, COLUMNS
    and LINES respectively, is checked. If the variable is defined and
    the value is a positive integer, it is used.

    When COLUMNS or LINES is not defined, which is the common case,
    the terminal connected to sys.__stdout__ is queried
    by invoking os.get_terminal_size.

    If the terminal size cannot be successfully queried, either because
    the system doesn't support querying, or because we are not
    connected to a terminal, the value given in fallback parameter
    is used. Fallback defaults to (80, 24) which is the default
    size used by many terminal emulators.

    The value returned is a named tuple of type os.terminal_size.
    """
    # Try the environment first
    try:
        columns = int(os.environ["COLUMNS"])
    except (KeyError, ValueError):
        columns = 0

    try:
        lines = int(os.environ["LINES"])
    except (KeyError, ValueError):
        lines = 0

    # Only query if necessary
    if columns <= 0 or lines <= 0:
        try:
            size = _get_terminal_size(sys.__stdout__.fileno())
        except (NameError, OSError):
            size = terminal_size(*fallback)

        if columns <= 0:
            columns = size.columns
        if lines <= 0:
            lines = size.lines

    return terminal_size(columns, lines)


```

### Core Architecture Module: `contrib/deprecated/python/futures/concurrent/__init__.py`
```
from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

```

### Core Architecture Module: `contrib/deprecated/python/futures/concurrent/futures/__init__.py`
```
# Copyright 2009 Brian Quinlan. All Rights Reserved.
# Licensed to PSF under a Contributor Agreement.

"""Execute computations asynchronously using threads or processes."""

__author__ = 'Brian Quinlan (brian@sweetapp.com)'

from concurrent.futures._base import (FIRST_COMPLETED,
                                      FIRST_EXCEPTION,
                                      ALL_COMPLETED,
                                      CancelledError,
                                      TimeoutError,
                                      Future,
                                      Executor,
                                      wait,
                                      as_completed)
from concurrent.futures.thread import ThreadPoolExecutor

try:
    from concurrent.futures.process import ProcessPoolExecutor
except ImportError:
    # some platforms don't have multiprocessing
    pass

```

### Core Architecture Module: `contrib/deprecated/python/futures/concurrent/futures/_base.py`
```
# Copyright 2009 Brian Quinlan. All Rights Reserved.
# Licensed to PSF under a Contributor Agreement.

import collections
import logging
import threading
import itertools
import time
import types

__author__ = 'Brian Quinlan (brian@sweetapp.com)'

FIRST_COMPLETED = 'FIRST_COMPLETED'
FIRST_EXCEPTION = 'FIRST_EXCEPTION'
ALL_COMPLETED = 'ALL_COMPLETED'
_AS_COMPLETED = '_AS_COMPLETED'

# Possible future states (for internal use by the futures package).
PENDING = 'PENDING'
RUNNING = 'RUNNING'
# The future was cancelled by the user...
CANCELLED = 'CANCELLED'
# ...and _Waiter.add_cancelled() was called by a worker.
CANCELLED_AND_NOTIFIED = 'CANCELLED_AND_NOTIFIED'
FINISHED = 'FINISHED'

_FUTURE_STATES = [
    PENDING,
    RUNNING,
    CANCELLED,
    CANCELLED_AND_NOTIFIED,
    FINISHED
]

_STATE_TO_DESCRIPTION_MAP = {
    PENDING: "pending",
    RUNNING: "running",
    CANCELLED: "cancelled",
    CANCELLED_AND_NOTIFIED: "cancelled",
    FINISHED: "finished"
}

# Logger for internal use by the futures package.
LOGGER = logging.getLogger("concurrent.futures")

class Error(Exception):
    """Base class for all future-related exceptions."""
    pass

class CancelledError(Error):
    """The Future was cancelled."""
    pass

class TimeoutError(Error):
    """The operation exceeded the given deadline."""
    pass

class _Waiter(object):
    """Provides the event that wait() and as_completed() block on."""
    def __init__(self):
        self.event = threading.Event()
        self.finished_futures = []

    def add_result(self, future):
        self.finished_futures.append(future)

    def add_exception(self, future):
        self.finished_futures.append(future)

    def add_cancelled(self, future):
        self.finished_futures.append(future)

class _AsCompletedWaiter(_Waiter):
    """Used by as_completed()."""

    def __init__(self):
        super(_AsCompletedWaiter, self).__init__()
        self.lock = threading.Lock()

    def add_result(self, future):
        with self.lock:
            super(_AsCompletedWaiter, self).add_result(future)
            self.event.set()

    def add_exception(self, future):
        with self.lock:
            super(_AsCompletedWaiter, self).add_exception(future)
            self.event.set()

    def add_cancelled(self, future):
        with self.lock:
            super(_AsCompletedWaiter, self).add_cancelled(future)
            self.event.set()

class _FirstCompletedWaiter(_Waiter):
    """Used by wait(return_when=FIRST_COMPLETED)."""

    def add_result(self, future):
        super(_FirstCompletedWaiter, self).add_result(future)
        self.event.set()

    def add_exception(self, future):
        super(_FirstCompletedWaiter, self).add_exception(future)
        self.event.set()

    def add_cancelled(self, future):
        super(_FirstCompletedWaiter, self).add_cancelled(future)
        self.event.set()

class _AllCompletedWaiter(_Waiter):
    """Used by wait(return_when=FIRST_EXCEPTION and ALL_COMPLETED)."""

    def __init__(self, num_pending_calls, stop_on_exception):
        self.num_pending_calls = num_pending_calls
        self.stop_on_exception = stop_on_exception
        self.lock = threading.Lock()
        super(_AllCompletedWaiter, self).__init__()

    def _decrement_pending_calls(self):
        with self.lock:
            self.num_pending_calls -= 1
            if not self.num_pending_calls:
                self.event.set()

    def add_result(self, future):
        super(_AllCompletedWaiter, self).add_result(future)
        self._decrement_pending_calls()

    def add_exception(self, future):
        super(_AllCompletedWaiter, self).add_exception(future)
        if self.stop_on_exception:
            self.event.set()
        else:
            self._decrement_pending_calls()

    def add_cancelled(self, future):
        super(_AllCompletedWaiter, self).add_cancelled(future)
        self._decrement_pending_calls()

class _AcquireFutures(object):
    """A context manager that does an ordered acquire of Future conditions."""

    def __init__(self, futures):
        self.futures = sorted(futures, key=id)

    def __enter__(self):
        for future in self.futures:
            future._condition.acquire()

    def __exit__(self, *args):
        for future in self.futures:
            future._condition.release()

def _create_and_install_waiters(fs, return_when):
    if return_when == _AS_COMPLETED:
        waiter = _AsCompletedWaiter()
    elif return_when == FIRST_COMPLETED:
        waiter = _FirstCompletedWaiter()
    else:
        pending_count = sum(
                f._state not in [CANCELLED_AND_NOTIFIED, FINISHED] for f in fs)

        if return_when == FIRST_EXCEPTION:
            waiter = _AllCompletedWaiter(pending_count, stop_on_exception=True)
        elif return_when == ALL_COMPLETED:
            waiter = _AllCompletedWaiter(pending_count, stop_on_exception=False)
        else:
            raise ValueError("Invalid return condition: %r" % return_when)

    for f in fs:
        f._waiters.append(waiter)

    return waiter


def _yield_finished_futures(fs, waiter, ref_collect):
    """
    Iterate on the list *fs*, yielding finished futures one by one in
    reverse order.
    Before yielding a future, *waiter* is removed from its waiters
    and the future is removed from each set in the collection of sets
    *ref_collect*.

    The aim of this function is to avoid keeping stale references after
    the future is yielded and before the iterator resumes.
    """
    while fs:
        f = fs[-1]
        for futures_set in ref_collect:
            futures_set.remove(f)
        with f._condition:
            f._waiters.remove(waiter)
        del f
        # Careful not to keep a reference to the popped value
        yield fs.pop()


def as_completed(fs, timeout=None):
    """An iterator over the given futures that yields each as it completes.

    Args:
        fs: The sequence of Futures (possibly created by different Executors) to
            iterate over.
        timeout: The maximum number of seconds to wait. If None, then there
            is no limit on the wait time.

    Returns:
        An iterator that yields the given Futures as they complete (finished or
        cancelled). If any given Futures are duplicated, they will be returned
        once.

    Raises:
        TimeoutError: If the entire result iterator could not be generated
            before the given timeout.
    """
    if timeout is not None:
        end_time = timeout + time.time()

    fs = set(fs)
    total_futures = len(fs)
    with _AcquireFutures(fs):
        finished = set(
                f for f in fs
                if f._state in [CANCELLED_AND_NOTIFIED, FINISHED])
        pending = fs - finished
        waiter = _create_and_install_waiters(fs, _AS_COMPLETED)
    finished = list(finished)
    try:
        for f in _yield_finished_futures(finished, waiter,
                                         ref_collect=(fs,)):
            f = [f]
            yield f.pop()

        while pending:
            if timeout is None:
                wait_timeout = None
            else:
                wait_timeout = end_time - time.time()
                if wait_timeout < 0:
                    raise TimeoutError(
                            '%d (of %d) futures unfinished' % (
                            len(pending), total_futures))

            waiter.event.wait(wait_timeout)

            with waiter.lock:
                finished = waiter.finished_futures
                waiter.finished_futures = []
                waiter.event.clear()

            # reverse to keep finishing order
            finished.reverse()
            for f in _yield_finished_futures(finished, waiter,
                                             ref_collect=(fs, pending)):
                f = [f]
                yield f.pop()

    finally:
        # Remove waiter from unfinished futures
        for f in fs:
            with f._condition:
                f._waiters.remove(waiter)

DoneAndNotDoneFutures = collections.namedtuple(
        'DoneAndNotDoneFutures', 'done not_done')
def wait(fs, timeout=None, return_when=ALL_COMPLETED):
    """Wait for the futures in the given sequence to complete.

    Args:
        fs: The sequence of Futures (possibly created by different Executors) to
            wait upon.
        timeout: The maximum number of seconds to wait. If None, then there
            is no limit on the wait time.
        return_when: Indicates when this function should return. The options
            are:

            FIRST_COMPLETED - Return when any future finishes or is
                              cancelled.
            FIRST_EXCEPTION - Return when any future finishes by raising an
                              exception. If no future raises an exception
                              then it is equivalent to ALL_COMPLETED.
            ALL_COMPLETED -   Return when all futures finish or are cancelled.

    Returns:
        A named 2-tuple of sets. The first set, named 'done', contains the
        futures that completed (is finished or cancelled) before the wait
        completed. The second set, named 'not_done', contains uncompleted
        futures.
    """
    with _AcquireFutures(fs):
        done = set(f for f in fs
                   if f._state in [CANCELLED_AND_NOTIFIED, FINISHED])
        not_done = set(fs) - done

        if (return_when == FIRST_COMPLETED) and done:
            return DoneAndNotDoneFutures(done, not_done)
        elif (return_when == FIRST_EXCEPTION) and done:
            if any(f for f in done
                   if not f.cancelled() and f.exception() is not None):
                return DoneAndNotDoneFutures(done, not_done)

        if len(done) == len(fs):
            return DoneAndNotDoneFutures(done, not_done)

        waiter = _create_and_install_waiters(fs, return_when)

    waiter.event.wait(timeout)
    for f in fs:
        with f._condition:
            f._waiters.remove(waiter)

  
```

### Core Architecture Module: `contrib/deprecated/python/futures/concurrent/futures/process.py`
```
# Copyright 2009 Brian Quinlan. All Rights Reserved.
# Licensed to PSF under a Contributor Agreement.

"""Implements ProcessPoolExecutor.

The follow diagram and text describe the data-flow through the system:

|======================= In-process =====================|== Out-of-process ==|

+----------+     +----------+       +--------+     +-----------+    +---------+
|          |  => | Work Ids |    => |        |  => | Call Q    | => |         |
|          |     +----------+       |        |     +-----------+    |         |
|          |     | ...      |       |        |     | ...       |    |         |
|          |     | 6        |       |        |     | 5, call() |    |         |
|          |     | 7        |       |        |     | ...       |    |         |
| Process  |     | ...      |       | Local  |     +-----------+    | Process |
|  Pool    |     +----------+       | Worker |                      |  #1..n  |
| Executor |                        | Thread |                      |         |
|          |     +----------- +     |        |     +-----------+    |         |
|          | <=> | Work Items | <=> |        | <=  | Result Q  | <= |         |
|          |     +------------+     |        |     +-----------+    |         |
|          |     | 6: call()  |     |        |     | ...       |    |         |
|          |     |    future  |     |        |     | 4, result |    |         |
|          |     | ...        |     |        |     | 3, except |    |         |
+----------+     +------------+     +--------+     +-----------+    +---------+

Executor.submit() called:
- creates a uniquely numbered _WorkItem and adds it to the "Work Items" dict
- adds the id of the _WorkItem to the "Work Ids" queue

Local worker thread:
- reads work ids from the "Work Ids" queue and looks up the corresponding
  WorkItem from the "Work Items" dict: if the work item has been cancelled then
  it is simply removed from the dict, otherwise it is repackaged as a
  _CallItem and put in the "Call Q". New _CallItems are put in the "Call Q"
  until "Call Q" is full. NOTE: the size of the "Call Q" is kept small because
  calls placed in the "Call Q" can no longer be cancelled with Future.cancel().
- reads _ResultItems from "Result Q", updates the future stored in the
  "Work Items" dict and deletes the dict entry

Process #1..n:
- reads _CallItems from "Call Q", executes the calls, and puts the resulting
  _ResultItems in "Request Q"
"""

import atexit
from concurrent.futures import _base
import Queue as queue
import multiprocessing
import threading
import weakref
import sys

__author__ = 'Brian Quinlan (brian@sweetapp.com)'

# Workers are created as daemon threads and processes. This is done to allow the
# interpreter to exit when there are still idle processes in a
# ProcessPoolExecutor's process pool (i.e. shutdown() was not called). However,
# allowing workers to die with the interpreter has two undesirable properties:
#   - The workers would still be running during interpreter shutdown,
#     meaning that they would fail in unpredictable ways.
#   - The workers could be killed while evaluating a work item, which could
#     be bad if the callable being evaluated has external side-effects e.g.
#     writing to a file.
#
# To work around this problem, an exit handler is installed which tells the
# workers to exit when their work queues are empty and then waits until the
# threads/processes finish.

_threads_queues = weakref.WeakKeyDictionary()
_shutdown = False

def _python_exit():
    global _shutdown
    _shutdown = True
    items = list(_threads_queues.items()) if _threads_queues else ()
    for t, q in items:
        q.put(None)
    for t, q in items:
        t.join(sys.maxint)

# Controls how many more calls than processes will be queued in the call queue.
# A smaller number will mean that processes spend more time idle waiting for
# work while a larger number will make Future.cancel() succeed less frequently
# (Futures in the call queue cannot be cancelled).
EXTRA_QUEUED_CALLS = 1

class _WorkItem(object):
    def __init__(self, future, fn, args, kwargs):
        self.future = future
        self.fn = fn
        self.args = args
        self.kwargs = kwargs

class _ResultItem(object):
    def __init__(self, work_id, exception=None, result=None):
        self.work_id = work_id
        self.exception = exception
        self.result = result

class _CallItem(object):
    def __init__(self, work_id, fn, args, kwargs):
        self.work_id = work_id
        self.fn = fn
        self.args = args
        self.kwargs = kwargs

def _process_worker(call_queue, result_queue):
    """Evaluates calls from call_queue and places the results in result_queue.

    This worker is run in a separate process.

    Args:
        call_queue: A multiprocessing.Queue of _CallItems that will be read and
            evaluated by the worker.
        result_queue: A multiprocessing.Queue of _ResultItems that will written
            to by the worker.
        shutdown: A multiprocessing.Event that will be set as a signal to the
            worker that it should exit when call_queue is empty.
    """
    while True:
        call_item = call_queue.get(block=True)
        if call_item is None:
            # Wake up queue management thread
            result_queue.put(None)
            return
        try:
            r = call_item.fn(*call_item.args, **call_item.kwargs)
        except:
            e = sys.exc_info()[1]
            result_queue.put(_ResultItem(call_item.work_id,
                                         exception=e))
        else:
            result_queue.put(_ResultItem(call_item.work_id,
                                         result=r))

def _add_call_item_to_queue(pending_work_items,
                            work_ids,
                            call_queue):
    """Fills call_queue with _WorkItems from pending_work_items.

    This function never blocks.

    Args:
        pending_work_items: A dict mapping work ids to _WorkItems e.g.
            {5: <_WorkItem...>, 6: <_WorkItem...>, ...}
        work_ids: A queue.Queue of work ids e.g. Queue([5, 6, ...]). Work ids
            are consumed and the corresponding _WorkItems from
            pending_work_items are transformed into _CallItems and put in
            call_queue.
        call_queue: A multiprocessing.Queue that will be filled with _CallItems
            derived from _WorkItems.
    """
    while True:
        if call_queue.full():
            return
        try:
            work_id = work_ids.get(block=False)
        except queue.Empty:
            return
        else:
            work_item = pending_work_items[work_id]

            if work_item.future.set_running_or_notify_cancel():
                call_queue.put(_CallItem(work_id,
                                         work_item.fn,
                                         work_item.args,
                                         work_item.kwargs),
                               block=True)
            else:
                del pending_work_items[work_id]
                continue

def _queue_management_worker(executor_reference,
                             processes,
                             pending_work_items,
                             work_ids_queue,
                             call_queue,
                             result_queue):
    """Manages the communication between this process and the worker processes.

    This function is run in a local thread.

    Args:
        executor_reference: A weakref.ref to the ProcessPoolExecutor that owns
            this thread. Used to determine if the ProcessPoolExecutor has been
            garbage collected and that this function can exit.
        process: A list of the multiprocessing.Process instances used as
            workers.
        pending_work_items: A dict mapping work ids to _WorkItems e.g.
            {5: <_WorkItem...>, 6: <_WorkItem...>, ...}
        work_ids_queue: A queue.Queue of work ids e.g. Queue([5, 6, ...]).
        call_queue: A multiprocessing.Queue that will be filled with _CallItems
            derived from _WorkItems for processing by the process workers.
        result_queue: A multiprocessing.Queue of _ResultItems generated by the
            process workers.
    """
    nb_shutdown_processes = [0]
    def shutdown_one_process():
        """Tell a worker to terminate, which will in turn wake us again"""
        call_queue.put(None)
        nb_shutdown_processes[0] += 1
    while True:
        _add_call_item_to_queue(pending_work_items,
                                work_ids_queue,
                                call_queue)

        result_item = result_queue.get(block=True)
        if result_item is not None:
            work_item = pending_work_items[result_item.work_id]
            del pending_work_items[result_item.work_id]

            if result_item.exception:
                work_item.future.set_exception(result_item.exception)
            else:
                work_item.future.set_result(result_item.result)
            # Delete references to object. See issue16284
            del work_item
        # Check whether we should start shutting down.
        executor = executor_reference()
        # No more work items can be added if:
        #   - The interpreter is shutting down OR
        #   - The executor that owns this worker has been collected OR
        #   - The executor that owns this worker has been shutdown.
        if _shutdown or executor is None or executor._shutdown_thread:
            # Since no new work items can be added, it is safe to shutdown
            # this thread if there are no pending work items.
            if not pending_work_items:
                while nb_shutdown_processes[0] < len(processes):
                    shutdown_one_process()
                # If .join() is not called on the created processes then
                # some multiprocessing.Queue methods may deadlock on Mac OS
                # X.
 
```

### Core Architecture Module: `contrib/deprecated/python/futures/concurrent/futures/thread.py`
```
# Copyright 2009 Brian Quinlan. All Rights Reserved.
# Licensed to PSF under a Contributor Agreement.

"""Implements ThreadPoolExecutor."""

import atexit
from concurrent.futures import _base
import itertools
import Queue as queue
import threading
import weakref
import sys

try:
    from multiprocessing import cpu_count
except ImportError:
    # some platforms don't have multiprocessing
    def cpu_count():
        return None

__author__ = 'Brian Quinlan (brian@sweetapp.com)'

# Workers are created as daemon threads. This is done to allow the interpreter
# to exit when there are still idle threads in a ThreadPoolExecutor's thread
# pool (i.e. shutdown() was not called). However, allowing workers to die with
# the interpreter has two undesirable properties:
#   - The workers would still be running during interpreter shutdown,
#     meaning that they would fail in unpredictable ways.
#   - The workers could be killed while evaluating a work item, which could
#     be bad if the callable being evaluated has external side-effects e.g.
#     writing to a file.
#
# To work around this problem, an exit handler is installed which tells the
# workers to exit when their work queues are empty and then waits until the
# threads finish.

_threads_queues = weakref.WeakKeyDictionary()
_shutdown = False

def _python_exit():
    global _shutdown
    _shutdown = True
    items = list(_threads_queues.items()) if _threads_queues else ()
    for t, q in items:
        q.put(None)
    for t, q in items:
        t.join(sys.maxint)

atexit.register(_python_exit)

class _WorkItem(object):
    def __init__(self, future, fn, args, kwargs):
        self.future = future
        self.fn = fn
        self.args = args
        self.kwargs = kwargs

    def run(self):
        if not self.future.set_running_or_notify_cancel():
            return

        try:
            result = self.fn(*self.args, **self.kwargs)
        except:
            e, tb = sys.exc_info()[1:]
            self.future.set_exception_info(e, tb)
        else:
            self.future.set_result(result)

def _worker(executor_reference, work_queue, initializer, initargs):
    if initializer is not None:
        try:
            initializer(*initargs)
        except BaseException:
            _base.LOGGER.critical('Exception in initializer:', exc_info=True)
            executor = executor_reference()
            if executor is not None:
                executor._initializer_failed()
            return
    try:
        while True:
            work_item = work_queue.get(block=True)
            if work_item is not None:
                work_item.run()
                # Delete references to object. See issue16284
                del work_item

                # attempt to increment idle count
                executor = executor_reference()
                if executor is not None:
                    executor._idle_semaphore.release()
                del executor
                continue
            executor = executor_reference()
            # Exit if:
            #   - The interpreter is shutting down OR
            #   - The executor that owns the worker has been collected OR
            #   - The executor that owns the worker has been shutdown.
            if _shutdown or executor is None or executor._shutdown:
                # Notice other workers
                work_queue.put(None)
                return
            del executor
    except:
        _base.LOGGER.critical('Exception in worker', exc_info=True)


class BrokenThreadPool(_base.BrokenExecutor):
    """
    Raised when a worker thread in a ThreadPoolExecutor failed initializing.
    """


class ThreadPoolExecutor(_base.Executor):

    # Used to assign unique thread names when thread_name_prefix is not supplied.
    _counter = itertools.count().next

    def __init__(self, max_workers=None, thread_name_prefix='', initializer=None, initargs=()):
        """Initializes a new ThreadPoolExecutor instance.

        Args:
            max_workers: The maximum number of threads that can be used to
                execute the given calls.
            thread_name_prefix: An optional name prefix to give our threads.
        """
        if max_workers is None:
            # Use this number because ThreadPoolExecutor is often
            # used to overlap I/O instead of CPU work.
            max_workers = (cpu_count() or 1) * 5
        if max_workers <= 0:
            raise ValueError("max_workers must be greater than 0")

        self._max_workers = max_workers
        self._initializer = initializer
        self._initargs = initargs
        self._work_queue = queue.Queue()
        self._idle_semaphore = threading.Semaphore(0)
        self._threads = set()
        self._broken = False
        self._shutdown = False
        self._shutdown_lock = threading.Lock()
        self._thread_name_prefix = (thread_name_prefix or
                                    ("ThreadPoolExecutor-%d" % self._counter()))

    def submit(self, fn, *args, **kwargs):
        with self._shutdown_lock:
            if self._broken:
                raise BrokenThreadPool(self._broken)
            if self._shutdown:
                raise RuntimeError('cannot schedule new futures after shutdown')

            f = _base.Future()
            w = _WorkItem(f, fn, args, kwargs)

            self._work_queue.put(w)
            self._adjust_thread_count()
            return f
    submit.__doc__ = _base.Executor.submit.__doc__

    def _adjust_thread_count(self):
        # if idle threads are available, don't spin new threads
        if self._idle_semaphore.acquire(False):
            return

        # When the executor gets lost, the weakref callback will wake up
        # the worker threads.
        def weakref_cb(_, q=self._work_queue):
            q.put(None)

        num_threads = len(self._threads)
        if num_threads < self._max_workers:
            thread_name = '%s_%d' % (self._thread_name_prefix or self,
                                     num_threads)
            t = threading.Thread(name=thread_name, target=_worker,
                                 args=(weakref.ref(self, weakref_cb),
                                       self._work_queue, self._initializer, self._initargs))
            t.daemon = True
            t.start()
            self._threads.add(t)
            _threads_queues[t] = self._work_queue

    def _initializer_failed(self):
        with self._shutdown_lock:
            self._broken = ('A thread initializer failed, the thread pool '
                            'is not usable anymore')
            # Drain work queue and mark pending futures failed
            while True:
                try:
                    work_item = self._work_queue.get_nowait()
                except queue.Empty:
                    break
                if work_item is not None:
                    work_item.future.set_exception(BrokenThreadPool(self._broken))

    def shutdown(self, wait=True):
        with self._shutdown_lock:
            self._shutdown = True
            self._work_queue.put(None)
        if wait:
            for t in self._threads:
                t.join(sys.maxint)
    shutdown.__doc__ = _base.Executor.shutdown.__doc__

```

### Core Architecture Module: `contrib/deprecated/python/win-unicode-console/win_unicode_console/readline_hook.py`
```

from __future__ import print_function # PY2

import sys
import traceback
import warnings
import ctypes.util
from ctypes import (pythonapi, cdll, cast, 
	c_char_p, c_void_p, c_size_t, CFUNCTYPE)

from .info import WINDOWS

try:
	import pyreadline
except ImportError:
	pyreadline = None


def get_libc():
	if WINDOWS:
		path = "msvcrt"
	else:
		path = ctypes.util.find_library("c")
		if path is None:
			raise RuntimeError("cannot locate libc")
	
	return cdll[path]

LIBC = get_libc()

PyMem_Malloc = pythonapi.PyMem_Malloc
PyMem_Malloc.restype = c_size_t
PyMem_Malloc.argtypes = [c_size_t]

strncpy = LIBC.strncpy
strncpy.restype = c_char_p
strncpy.argtypes = [c_char_p, c_char_p, c_size_t]

HOOKFUNC = CFUNCTYPE(c_char_p, c_void_p, c_void_p, c_char_p)

#PyOS_ReadlineFunctionPointer = c_void_p.in_dll(pythonapi, "PyOS_ReadlineFunctionPointer")


def new_zero_terminated_string(b):
	p = PyMem_Malloc(len(b) + 1)
	strncpy(cast(p, c_char_p), b, len(b) + 1)
	return p

def check_encodings():
	if sys.stdin.encoding != sys.stdout.encoding:
		# raise RuntimeError("sys.stdin.encoding != sys.stdout.encoding, readline hook doesn't know, which one to use to decode prompt")
		
		warnings.warn("sys.stdin.encoding == {!r}, whereas sys.stdout.encoding == {!r}, readline hook consumer may assume they are the same".format(sys.stdin.encoding, sys.stdout.encoding), 
			RuntimeWarning, stacklevel=3)

def stdio_readline(prompt=""):
	sys.stdout.write(prompt)
	sys.stdout.flush()
	return sys.stdin.readline()


class ReadlineHookManager:
	def __init__(self):
		self.readline_wrapper_ref = HOOKFUNC(self.readline_wrapper)
		self.address = cast(self.readline_wrapper_ref, c_void_p).value
		#self.original_address = PyOS_ReadlineFunctionPointer.value
		self.readline_hook = None
	
	def readline_wrapper(self, stdin, stdout, prompt):
		try:
			try:
				check_encodings()
			except RuntimeError:
				traceback.print_exc(file=sys.stderr)
				try:
					prompt = prompt.decode("utf-8")
				except UnicodeDecodeError:
					prompt = ""
				
			else:
				prompt = prompt.decode(sys.stdout.encoding)
			
			try:
				line = self.readline_hook(prompt)
			except KeyboardInterrupt:
				return 0
			else:
				return new_zero_terminated_string(line.encode(sys.stdin.encoding))
			
		except:
			self.restore_original()
			print("Internal win_unicode_console error, disabling custom readline hook...", file=sys.stderr)
			traceback.print_exc(file=sys.stderr)
			return new_zero_terminated_string(b"\n")
	
	def install_hook(self, hook):
		self.readline_hook = hook
		PyOS_ReadlineFunctionPointer.value = self.address
	
	def restore_original(self):
		self.readline_hook = None
		PyOS_ReadlineFunctionPointer.value = self.original_address


class PyReadlineManager:
	def __init__(self):
		self.original_codepage = pyreadline.unicode_helper.pyreadline_codepage
	
	def set_codepage(self, codepage):
		pyreadline.unicode_helper.pyreadline_codepage = codepage
	
	def restore_original(self):
		self.set_codepage(self.original_codepage)

def pyreadline_is_active():
	if not pyreadline:
		return False
	
	ref = pyreadline.console.console.readline_ref
	if ref is None:
		return False
	
	return cast(ref, c_void_p).value == PyOS_ReadlineFunctionPointer.value


manager = ReadlineHookManager()

if pyreadline:
	pyreadline_manager = PyReadlineManager()


# PY3 # def enable(*, use_pyreadline=True):
def enable(use_pyreadline=True):
	check_encodings()
	
	if use_pyreadline and pyreadline:
		pyreadline_manager.set_codepage(sys.stdin.encoding)
			# pyreadline assumes that encoding of all sys.stdio objects is the same
		if not pyreadline_is_active():
			manager.install_hook(stdio_readline)
		
	else:
		manager.install_hook(stdio_readline)

def disable():
	if pyreadline:
		pyreadline_manager.restore_original()
	else:
		manager.restore_original()

```

### Core Architecture Module: `contrib/go/_std_1.27/src/crypto/internal/randutil/randutil.go`
```
// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package randutil contains internal randomness utilities for various
// crypto packages.
package randutil

import (
	"io"
	"math/rand/v2"
)

// MaybeReadByte reads a single byte from r with 50% probability. This is used
// to ensure that callers do not depend on non-guaranteed behaviour, e.g.
// assuming that rsa.GenerateKey is deterministic w.r.t. a given random stream.
//
// This does not affect tests that pass a stream of fixed bytes as the random
// source (e.g. a zeroReader).
func MaybeReadByte(r io.Reader) {
	if rand.Uint64()&1 == 1 {
		return
	}
	var buf [1]byte
	r.Read(buf[:])
}

```

### Core Architecture Module: `contrib/go/_std_1.27/src/crypto/rand/util.go`
```
// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package rand

import (
	"crypto/internal/fips140only"
	"crypto/internal/rand"
	"errors"
	"io"
	"math/big"
)

// Prime returns a number of the given bit length that is prime with high probability.
// Prime will return error for any error returned by rand.Read or if bits < 2.
//
// Since Go 1.26, a secure source of random bytes is always used, and the Reader is
// ignored unless GODEBUG=cryptocustomrand=1 is set. This setting will be removed
// in a future Go release. Instead, use [testing/cryptotest.SetGlobalRandom].
func Prime(r io.Reader, bits int) (*big.Int, error) {
	if fips140only.Enforced() {
		return nil, errors.New("crypto/rand: use of Prime is not allowed in FIPS 140-only mode")
	}
	if bits < 2 {
		return nil, errors.New("crypto/rand: prime size must be at least 2-bit")
	}

	r = rand.CustomReader(r)

	b := uint(bits % 8)
	if b == 0 {
		b = 8
	}

	bytes := make([]byte, (bits+7)/8)
	p := new(big.Int)

	for {
		if _, err := io.ReadFull(r, bytes); err != nil {
			return nil, err
		}

		// Clear bits in the first byte to make sure the candidate has a size <= bits.
		bytes[0] &= uint8(int(1<<b) - 1)
		// Don't let the value be too small, i.e, set the most significant two bits.
		// Setting the top two bits, rather than just the top bit,
		// means that when two of these values are multiplied together,
		// the result isn't ever one bit short.
		if b >= 2 {
			bytes[0] |= 3 << (b - 2)
		} else {
			// Here b==1, because b cannot be zero.
			bytes[0] |= 1
			if len(bytes) > 1 {
				bytes[1] |= 0x80
			}
		}
		// Make the value odd since an even number this large certainly isn't prime.
		bytes[len(bytes)-1] |= 1

		p.SetBytes(bytes)
		if p.ProbablyPrime(20) {
			return p, nil
		}
	}
}

// Int returns a uniform random value in [0, max). It panics if max <= 0, and
// returns an error if rand.Read returns one.
func Int(rand io.Reader, max *big.Int) (n *big.Int, err error) {
	if max.Sign() <= 0 {
		panic("crypto/rand: argument to Int is <= 0")
	}
	n = new(big.Int)
	n.Sub(max, n.SetUint64(1))
	// bitLen is the maximum bit length needed to encode a value < max.
	bitLen := n.BitLen()
	if bitLen == 0 {
		// the only valid result is 0
		return
	}
	// k is the maximum byte length needed to encode a value < max.
	k := (bitLen + 7) / 8
	// b is the number of bits in the most significant byte of max-1.
	b := uint(bitLen % 8)
	if b == 0 {
		b = 8
	}

	bytes := make([]byte, k)

	for {
		_, err = io.ReadFull(rand, bytes)
		if err != nil {
			return nil, err
		}

		// Clear bits in the first byte to increase the probability
		// that the candidate is < max.
		bytes[0] &= uint8(int(1<<b) - 1)

		n.SetBytes(bytes)
		if n.Cmp(max) < 0 {
			return
		}
	}
}

```

### Core Architecture Module: `contrib/go/_std_1.27/src/crypto/x509/internal/macos/corefoundation.go`
```
// Copyright 2020 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build darwin

// Package macos provides cgo-less wrappers for Core Foundation and
// Security.framework, similarly to how package syscall provides access to
// libSystem.dylib.
package macos

import (
	"bytes"
	"errors"
	"internal/abi"
	"runtime"
	"time"
	"unsafe"
)

// Core Foundation linker flags for the external linker. See Issue 42459.
//
//go:cgo_ldflag "-framework"
//go:cgo_ldflag "CoreFoundation"

// CFRef is an opaque reference to a Core Foundation object. It is a pointer,
// but to memory not owned by Go, so not an unsafe.Pointer.
type CFRef uintptr

// CFDataToSlice returns a copy of the contents of data as a bytes slice.
func CFDataToSlice(data CFRef) []byte {
	length := CFDataGetLength(data)
	ptr := CFDataGetBytePtr(data)
	src := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), length)
	return bytes.Clone(src)
}

// CFStringToString returns a Go string representation of the passed
// in CFString, or an empty string if it's invalid.
func CFStringToString(ref CFRef) string {
	data, err := CFStringCreateExternalRepresentation(ref)
	if err != nil {
		return ""
	}
	b := CFDataToSlice(data)
	CFRelease(data)
	return string(b)
}

// TimeToCFDateRef converts a time.Time into an apple CFDateRef.
func TimeToCFDateRef(t time.Time) CFRef {
	secs := t.Sub(time.Date(2001, 1, 1, 0, 0, 0, 0, time.UTC)).Seconds()
	ref := CFDateCreate(secs)
	return ref
}

type CFString CFRef

const kCFAllocatorDefault = 0
const kCFStringEncodingUTF8 = 0x08000100

//go:cgo_import_dynamic x509_CFDataCreate CFDataCreate "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func BytesToCFData(b []byte) CFRef {
	p := unsafe.Pointer(unsafe.SliceData(b))
	ret := syscall(abi.FuncPCABI0(x509_CFDataCreate_trampoline), kCFAllocatorDefault, uintptr(p), uintptr(len(b)), 0, 0, 0)
	runtime.KeepAlive(p)
	return CFRef(ret)
}
func x509_CFDataCreate_trampoline()

//go:cgo_import_dynamic x509_CFStringCreateWithBytes CFStringCreateWithBytes "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

// StringToCFString returns a copy of the UTF-8 contents of s as a new CFString.
func StringToCFString(s string) CFString {
	p := unsafe.Pointer(unsafe.StringData(s))
	ret := syscall(abi.FuncPCABI0(x509_CFStringCreateWithBytes_trampoline), kCFAllocatorDefault, uintptr(p),
		uintptr(len(s)), uintptr(kCFStringEncodingUTF8), 0 /* isExternalRepresentation */, 0)
	runtime.KeepAlive(p)
	return CFString(ret)
}
func x509_CFStringCreateWithBytes_trampoline()

//go:cgo_import_dynamic x509_CFDictionaryGetValueIfPresent CFDictionaryGetValueIfPresent "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFDictionaryGetValueIfPresent(dict CFRef, key CFString) (value CFRef, ok bool) {
	ret := syscall(abi.FuncPCABI0(x509_CFDictionaryGetValueIfPresent_trampoline), uintptr(dict), uintptr(key),
		uintptr(unsafe.Pointer(&value)), 0, 0, 0)
	if ret == 0 {
		return 0, false
	}
	return value, true
}
func x509_CFDictionaryGetValueIfPresent_trampoline()

const kCFNumberSInt32Type = 3

//go:cgo_import_dynamic x509_CFNumberGetValue CFNumberGetValue "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFNumberGetValue(num CFRef) (int32, error) {
	var value int32
	ret := syscall(abi.FuncPCABI0(x509_CFNumberGetValue_trampoline), uintptr(num), uintptr(kCFNumberSInt32Type),
		uintptr(unsafe.Pointer(&value)), 0, 0, 0)
	if ret == 0 {
		return 0, errors.New("CFNumberGetValue call failed")
	}
	return value, nil
}
func x509_CFNumberGetValue_trampoline()

//go:cgo_import_dynamic x509_CFDataGetLength CFDataGetLength "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFDataGetLength(data CFRef) int {
	ret := syscall(abi.FuncPCABI0(x509_CFDataGetLength_trampoline), uintptr(data), 0, 0, 0, 0, 0)
	return int(ret)
}
func x509_CFDataGetLength_trampoline()

//go:cgo_import_dynamic x509_CFDataGetBytePtr CFDataGetBytePtr "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFDataGetBytePtr(data CFRef) uintptr {
	ret := syscall(abi.FuncPCABI0(x509_CFDataGetBytePtr_trampoline), uintptr(data), 0, 0, 0, 0, 0)
	return ret
}
func x509_CFDataGetBytePtr_trampoline()

//go:cgo_import_dynamic x509_CFArrayGetCount CFArrayGetCount "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFArrayGetCount(array CFRef) int {
	ret := syscall(abi.FuncPCABI0(x509_CFArrayGetCount_trampoline), uintptr(array), 0, 0, 0, 0, 0)
	return int(ret)
}
func x509_CFArrayGetCount_trampoline()

//go:cgo_import_dynamic x509_CFArrayGetValueAtIndex CFArrayGetValueAtIndex "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFArrayGetValueAtIndex(array CFRef, index int) CFRef {
	ret := syscall(abi.FuncPCABI0(x509_CFArrayGetValueAtIndex_trampoline), uintptr(array), uintptr(index), 0, 0, 0, 0)
	return CFRef(ret)
}
func x509_CFArrayGetValueAtIndex_trampoline()

//go:cgo_import_dynamic x509_CFEqual CFEqual "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFEqual(a, b CFRef) bool {
	ret := syscall(abi.FuncPCABI0(x509_CFEqual_trampoline), uintptr(a), uintptr(b), 0, 0, 0, 0)
	return ret == 1
}
func x509_CFEqual_trampoline()

//go:cgo_import_dynamic x509_CFRelease CFRelease "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFRelease(ref CFRef) {
	syscall(abi.FuncPCABI0(x509_CFRelease_trampoline), uintptr(ref), 0, 0, 0, 0, 0)
}
func x509_CFRelease_trampoline()

//go:cgo_import_dynamic x509_CFArrayCreateMutable CFArrayCreateMutable "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFArrayCreateMutable() CFRef {
	ret := syscall(abi.FuncPCABI0(x509_CFArrayCreateMutable_trampoline), kCFAllocatorDefault, 0, 0 /* kCFTypeArrayCallBacks */, 0, 0, 0)
	return CFRef(ret)
}
func x509_CFArrayCreateMutable_trampoline()

//go:cgo_import_dynamic x509_CFArrayAppendValue CFArrayAppendValue "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFArrayAppendValue(array CFRef, val CFRef) {
	syscall(abi.FuncPCABI0(x509_CFArrayAppendValue_trampoline), uintptr(array), uintptr(val), 0, 0, 0, 0)
}
func x509_CFArrayAppendValue_trampoline()

//go:cgo_import_dynamic x509_CFDateCreate CFDateCreate "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFDateCreate(seconds float64) CFRef {
	ret := syscall(abi.FuncPCABI0(x509_CFDateCreate_trampoline), kCFAllocatorDefault, 0, 0, 0, 0, seconds)
	return CFRef(ret)
}
func x509_CFDateCreate_trampoline()

//go:cgo_import_dynamic x509_CFErrorCopyDescription CFErrorCopyDescription "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFErrorCopyDescription(errRef CFRef) CFRef {
	ret := syscall(abi.FuncPCABI0(x509_CFErrorCopyDescription_trampoline), uintptr(errRef), 0, 0, 0, 0, 0)
	return CFRef(ret)
}
func x509_CFErrorCopyDescription_trampoline()

//go:cgo_import_dynamic x509_CFErrorGetCode CFErrorGetCode "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFErrorGetCode(errRef CFRef) int {
	return int(syscall(abi.FuncPCABI0(x509_CFErrorGetCode_trampoline), uintptr(errRef), 0, 0, 0, 0, 0))
}
func x509_CFErrorGetCode_trampoline()

//go:cgo_import_dynamic x509_CFStringCreateExternalRepresentation CFStringCreateExternalRepresentation "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"

func CFStringCreateExternalRepresentation(strRef CFRef) (CFRef, error) {
	ret := syscall(abi.FuncPCABI0(x509_CFStringCreateExternalRepresentation_trampoline), kCFAllocatorDefault, uintptr(strRef), kCFStringEncodingUTF8, 0, 0, 0)
	if ret == 0 {
		return 0, errors.New("string can't be represented as UTF-8")
	}
	return CFRef(ret), nil
}
func x509_CFStringCreateExternalRepresentation_trampoline()

// syscall is implemented in the runtime package (runtime/sys_darwin.go)
func syscall(fn, a1, a2, a3, a4, a5 uintptr, f1 float64) uintptr

// ReleaseCFArray iterates through an array, releasing its contents, and then
// releases the array itself. This is necessary because we cannot, easily, set the
// CFArrayCallBacks argument when creating CFArrays.
func ReleaseCFArray(array CFRef) {
	for i := 0; i < CFArrayGetCount(array); i++ {
		ref := CFArrayGetValueAtIndex(array, i)
		CFRelease(ref)
	}
	CFRelease(array)
}

```

### Core Architecture Module: `contrib/go/_std_1.27/src/encoding/json/jsontext/state.go`
```
// Copyright 2020 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build goexperiment.jsonv2

package jsontext

import (
	"errors"
	"iter"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"

	"encoding/json/internal/jsonwire"
)

// ErrDuplicateName indicates that a JSON token could not be
// encoded or decoded because it results in a duplicate JSON object name.
// This error is directly wrapped within a [SyntacticError] when produced.
//
// The name of a duplicate JSON object member can be extracted as:
//
//	err := ...
//	serr, ok := errors.AsType[*jsontext.SyntacticError](err)
//	if ok && serr.Err == jsontext.ErrDuplicateName {
//		ptr := serr.JSONPointer // JSON pointer to duplicate name
//		name := ptr.LastToken() // duplicate name itself
//		...
//	}
//
// This error is only returned if [AllowDuplicateNames] is false.
var ErrDuplicateName = errors.New("duplicate object member name")

// ErrNonStringName indicates that a JSON token could not be
// encoded or decoded because it is not a string,
// as required for JSON object names according to RFC 8259, section 4.
// This error is directly wrapped within a [SyntacticError] when produced.
var ErrNonStringName = errors.New("object member name must be a string")

var (
	errMissingValue  = errors.New("missing value after object name")
	errMismatchDelim = errors.New("mismatching structural token for object or array")
	errMaxDepth      = errors.New("exceeded max depth")

	errInvalidNamespace = errors.New("object namespace is in an invalid state")
)

// Per RFC 8259, section 9, implementations may enforce a maximum depth.
// Such a limit is necessary to prevent stack overflows.
const maxNestingDepth = 10000

type state struct {
	// Tokens validates whether the next token kind is valid.
	Tokens stateMachine

	// Names is a stack of object names.
	Names objectNameStack

	// Namespaces is a stack of object namespaces.
	// For performance reasons, Encoder or Decoder may not update this
	// if Marshal or Unmarshal is able to track names in a more efficient way.
	// See makeMapArshaler and makeStructArshaler.
	// Not used if AllowDuplicateNames is true.
	Namespaces objectNamespaceStack
}

// needObjectValue reports whether the next token should be an object value.
// This method is used by [wrapSyntacticError].
func (s *state) needObjectValue() bool {
	return s.Tokens.Last.needObjectValue()
}

func (s *state) reset() {
	s.Tokens.reset()
	s.Names.reset()
	s.Namespaces.reset()
}

// Pointer is a JSON Pointer (RFC 6901) that references a particular JSON value
// relative to the root of the top-level JSON value.
//
// A Pointer is a slash-separated list of tokens, where each token is
// either a JSON object name or an index to a JSON array element
// encoded as a base-10 integer value.
// It is impossible to distinguish between an array index and an object name
// (that happens to be a base-10 encoded integer) without also knowing
// the structure of the top-level JSON value that the pointer refers to.
//
// There is exactly one representation of a pointer to a particular value,
// so comparability of Pointer values is equivalent to checking whether
// they both point to the same value.
type Pointer string

// IsValid reports whether p is a valid JSON Pointer according to RFC 6901.
// Note that the concatenation of two valid pointers produces a valid pointer.
func (p Pointer) IsValid() bool {
	for i, r := range p {
		switch {
		case r == '~' && (i+1 == len(p) || (p[i+1] != '0' && p[i+1] != '1')):
			return false // invalid escape
		case r == '\ufffd' && !strings.HasPrefix(string(p[i:]), "\ufffd"):
			return false // invalid UTF-8
		}
	}
	return len(p) == 0 || p[0] == '/'
}

// Contains reports whether the JSON value that p points to
// is equal to or contains the JSON value that pc points to.
func (p Pointer) Contains(pc Pointer) bool {
	// Invariant: len(p) <= len(pc) if p.Contains(pc)
	suffix, ok := strings.CutPrefix(string(pc), string(p))
	return ok && (suffix == "" || suffix[0] == '/')
}

// Parent strips off the last token and returns the remaining pointer.
// The parent of an empty Pointer is the empty string.
func (p Pointer) Parent() Pointer {
	return p[:max(strings.LastIndexByte(string(p), '/'), 0)]
}

// LastToken returns the last token in the pointer.
// The last token of an empty Pointer is the empty string.
func (p Pointer) LastToken() string {
	last := p[max(strings.LastIndexByte(string(p), '/'), 0):]
	return unescapePointerToken(strings.TrimPrefix(string(last), "/"))
}

// AppendToken appends a token to the end of p and returns the full pointer.
func (p Pointer) AppendToken(tok string) Pointer {
	return Pointer(appendEscapePointerName([]byte(p+"/"), []byte(tok)))
}

// TODO: Add Pointer.AppendTokens,
// but should this take in a ...string or an iter.Seq[string]?

// Tokens returns an iterator over the reference tokens in the JSON pointer,
// from first to last.
func (p Pointer) Tokens() iter.Seq[string] {
	return func(yield func(string) bool) {
		for len(p) > 0 {
			p = Pointer(strings.TrimPrefix(string(p), "/"))
			i := min(uint(strings.IndexByte(string(p), '/')), uint(len(p)))
			if !yield(unescapePointerToken(string(p)[:i])) {
				return
			}
			p = p[i:]
		}
	}
}

func unescapePointerToken(token string) string {
	if strings.Contains(token, "~") {
		// Per RFC 6901, section 3, unescape '~' and '/' characters.
		token = strings.ReplaceAll(token, "~1", "/")
		token = strings.ReplaceAll(token, "~0", "~")
	}
	return token
}

// appendStackPointer appends a JSON Pointer (RFC 6901) to the current value.
//
//   - If where is -1, then it points to the previously processed token.
//
//   - If where is 0, then it points to the parent JSON object or array,
//     or an object member if in-between an object member key and value.
//     This is useful when the position is ambiguous whether
//     we are interested in the previous or next token, or
//     when we are uncertain whether the next token
//     continues or terminates the current object or array.
//
//   - If where is +1, then it points to the next expected value,
//     assuming that it continues the current JSON object or array.
//     As a special case, if the next token is a JSON object name,
//     then it points to the parent JSON object.
//
// Invariant: Must call s.names.copyQuotedBuffer beforehand.
func (s state) appendStackPointer(b []byte, where int) []byte {
	var objectDepth int
	for i := 1; i < s.Tokens.Depth(); i++ {
		e := s.Tokens.index(i)
		arrayDelta := -1 // by default point to previous array element
		if isLast := i == s.Tokens.Depth()-1; isLast {
			switch {
			case where < 0 && e.Length() == 0 || where == 0 && !e.needObjectValue() || where > 0 && e.NeedObjectName():
				return b
			case where > 0 && e.isArray():
				arrayDelta = 0 // point to next array element
			}
		}
		switch {
		case e.isObject():
			b = appendEscapePointerName(append(b, '/'), s.Names.getUnquoted(objectDepth))
			objectDepth++
		case e.isArray():
			b = strconv.AppendUint(append(b, '/'), uint64(e.Length()+int64(arrayDelta)), 10)
		}
	}
	return b
}

func appendEscapePointerName(b, name []byte) []byte {
	for _, r := range string(name) {
		// Per RFC 6901, section 3, escape '~' and '/' characters.
		switch r {
		case '~':
			b = append(b, "~0"...)
		case '/':
			b = append(b, "~1"...)
		default:
			b = utf8.AppendRune(b, r)
		}
	}
	return b
}

// stateMachine is a push-down automaton that validates whether
// a sequence of tokens is valid or not according to the JSON grammar.
// It is useful for both encoding and decoding.
//
// It is a stack where each entry represents a nested JSON object or array.
// The stack has a minimum depth of 1 where the first level is a
// virtual JSON array to handle a stream of top-level JSON values.
// The top-level virtual JSON array is special in that it doesn't require commas
// between each JSON value.
//
// For performance, most methods are carefully written to be inlinable.
// The zero value is a valid state machine ready for use.
type stateMachine struct {
	Stack []stateEntry
	Last  stateEntry
}

// reset resets the state machine.
// The machine always starts with a minimum depth of 1.
func (m *stateMachine) reset() {
	m.Stack = m.Stack[:0]
	if cap(m.Stack) > 1<<10 {
		m.Stack = nil
	}
	m.Last = stateTypeArray
}

// Depth is the current nested depth of JSON objects and arrays.
// It is one-indexed (i.e., top-level values have a depth of 1).
func (m stateMachine) Depth() int {
	return len(m.Stack) + 1
}

// index returns a reference to the ith entry.
// It is only valid until the next push method call.
func (m *stateMachine) index(i int) *stateEntry {
	if i == len(m.Stack) {
		return &m.Last
	}
	return &m.Stack[i]
}

// DepthLength reports the current nested depth and
// the length of the last JSON object or array.
func (m stateMachine) DepthLength() (int, int64) {
	return m.Depth(), m.Last.Length()
}

// appendLiteral appends a JSON literal as the next token in the sequence.
// If an error is returned, the state is not mutated.
func (m *stateMachine) appendLiteral() error {
	switch {
	case m.Last.NeedObjectName():
		return ErrNonStringName
	case !m.Last.isValidNamespace():
		return errInvalidNamespace
	default:
		m.Last.Increment()
		return nil
	}
}

// appendString appends a JSON string as the next token in the sequence.
// If an error is returned, the state is not mutated.
func (m *stateMachine) appendString() error {
	switch {
	case !m.Last.isValidNamespace():
		return errInvalidNamespace
	default:
		m.Last.Increment()
		return nil
	}
}

// appendNumber appends a JSON number as the next token in the sequence.
// If an error is returned, the state is not mutated.
func (m *stateMachine) appendNumber() error {
	return m.appendLiteral()
}

// pushObject appends a JSON begin object token as next in the sequence.
// If an error is returned, the state is not mutated.
func (m *stateMachine) pu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54282** (2026-09-28): **TSan: tests hang in teardown in TActorCoroImpl::Destroy of a coroutine actor that was never bootstrapped**
  *Symptoms*: ## Summary  In TSan builds a random test of a KQP unit test suite sometimes never finishes and is killed at the 600 s ya test timeout. The test body has already passed: the process hangs in the test server teardown, in `TActorCoroImpl::Destroy`, waiting for the worker thread of a coroutine actor that was never bootstrapped, so the thread does not exist. Only TSan builds are affected, because only there coroutine actors run on threads (`CORO_THROUGH_THREADS`). In the KQP tests the actor is the datashard table stats builder (`TTableStatsCoroBuilder`) registered right before the actor system stops, but any `TActorCoro` registered at that moment hangs the same way.  ## Environment  - `./ya make --build relwithdebinfo --sanitize=thread -tA ydb/core/kqp/ut/join/index_lookup`, 108 tests in 60 chunks. - Hangs seen on main `9445e841a8e` and `de286f42f02`; the fix was tested on `7d08c4d0693`. The code involved is the same in all three. - Default single-node `TKikimrRunner`.  ## Symptom  - About 1 run of the suite in 4 has one test (once two) that never finishes; about 1 test in 400. The test differs from run to run: 13 hangs in 47 TSan runs, 12 different tests. Those marked * come from 15 earlier runs of branch builds with unmerged DQ channel PRs; they were not caught with gdb but look the same (a 600 s kill after a passing body):   - `KqpJoin`: `RightSemiJoin_ComplexKey` (twice, once *), `RightSemiJoin_SimpleKey`*, `RightSemiJoin_KeyPrefix`, `JoinDupColumnRight`*, `JoinDupColumnRightP

- **Issue #53391** (2026-09-19): **Fix increament of CpuUsage for Query**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=53391&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F53391&ui=true)
  > <!-- status pr=53391, preset=relwithdebinfo, run=180020 --> :white_circle: `2026-09-17 11:20:15 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/35215054806/job/105181508796) **linux-x86_64-relwithdebinfo** for bbce772481663e9230e828f5305fb38f9e67eed6 has started. :white_circle: `2026-09-17 11:20:19 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/index.html) :white_circle: `2026-09-17 11:21:57 UTC` ya make is running... :yellow_circle: `2026-09-17 14:27:19 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://git
  > <!-- status pr=53391, preset=release-asan, run=180020 --> :white_circle: `2026-09-17 11:21:30 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/35215054806/job/105181508812) **linux-x86_64-release-asan** for bbce772481663e9230e828f5305fb38f9e67eed6 has started. :white_circle: `2026-09-17 11:21:34 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/index.html) :white_circle: `2026-09-17 11:22:58 UTC` ya make is running... :green_circle: `2026-09-17 13:30:42 UTC` Tests successful.  [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://github.com/ydb-platform/ydb/tree/main/.github/config/muted_ya

- **Issue #52822** (2026-09-11): **Fix UAF**
  *Symptoms*: ### Changelog entry <!-- a user-readable short description of the changes that goes to CHANGELOG.md and Release Notes -->  Fix issue https://github.com/ydb-platform/ydb/pull/52264#issuecomment-5618845523 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=52822&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F52822&ui=true)
  > <!-- status pr=52822, preset=release-asan, run=177284 --> :white_circle: `2026-09-11 05:42:17 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/34566734757/job/103160327575) **linux-x86_64-release-asan** for 3a448bd3ba5f0512278fe859111391b8deb4fa97 has started. :white_circle: `2026-09-11 05:42:36 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/index.html) :white_circle: `2026-09-11 05:44:01 UTC` ya make is running... :yellow_circle: `2026-09-11 07:56:27 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](
  > <!-- status pr=52822, preset=relwithdebinfo, run=177284 --> :white_circle: `2026-09-11 05:42:33 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/34566734757/job/103160327577) **linux-x86_64-relwithdebinfo** for 3a448bd3ba5f0512278fe859111391b8deb4fa97 has started. :white_circle: `2026-09-11 05:42:52 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/index.html) :white_circle: `2026-09-11 05:44:21 UTC` ya make is running... :green_circle: `2026-09-11 08:29:48 UTC` Tests successful.  [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://github.com/ydb-platform/ydb/tree/main/.github/config/muted_ya.txt "All m

- **Issue #48539** (2026-08-10): **VERIFY failed verification=!Extracted**
  *Symptoms*: Got the following verify on scan request to column table: ``` VERIFY failed (2026-07-31T19:58:49.103027+0300): verification=!Extracted;fline=execution.h:361;   ydb/library/actors/core/log.cpp:908   ~TVerifyFormattedRecordWriter(): requirement false failed build: commit e4abf511810b4001eff6cbcad57af966fbc0b8dd (clean) 0. /-S/util/system/yassert.cpp:86: NPrivate::InternalPanicImpl(int, char const*, char const*, int, int, int, TBasicStringBuf<char, std::__y1::char_traits<char>>, char const*, unsigned long) @ 0xA6A332A 1. /-S/util/system/yassert.cpp:55: NPrivate::Panic(NPrivate::TStaticBuf const&, int, char const*, char const*, char const*, ...) @ 0xA69D53B 2. /-S/ydb/library/actors/core/log.cpp:908: NActors::TVerifyFormattedRecordWriter::~TVerifyFormattedRecordWriter() @ 0xB2B26FF 3. /-S/ydb/core/formats/arrow/program/execution.h:361: NKikimr::NArrow::NSSA::TProcessorContext::GetResources() const @ 0x156BF96F 4. /-S/ydb/core/tx/columnshard/engines/reader/common_reader/iterator/fetching.cpp:100: NKikimr::NOlap::NReader::NCommon::TProgramStep::ReportTracing(std::__y1::shared_ptr<NKikimr::NOlap::NReader::NCommon::IDataSource> const&, TDuration, TBasicString<char, std::__y1::char_traits<char>> const&, unsigned int, TBasicString<char, std::__y1::char_traits<char>> const&, std::__y1::shared_ptr<NKikimr::NArrow::NSSA::IResourceProcessor> const&) const @ 0x1583855C 5. /-S/ydb/core/tx/columnshard/engines/reader/common_reader/iterator/fetching.cpp:283: NKikimr::NOlap::NReader::NCommon::TP
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/ydb-platform/ydb/pull/49129

- **Issue #47131** (2026-07-20): **Fix build on Windows**
  *Symptoms*: ### Changelog entry <!-- a user-readable short description of the changes that goes to CHANGELOG.md and Release Notes -->  ### Changelog category <!-- remove all except one -->  * Not for changelog (changelog entry is not required)  ### Description for reviewers <!-- (optional) description for those who read this PR --> 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=47131&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F47131&ui=true)
  > <!-- status pr=47131, preset=relwithdebinfo, run=152831 --> :white_circle: `2026-07-20 06:50:13 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/29722597935/job/88288589125) **linux-x86_64-relwithdebinfo** for 636faecb67db7c42f9535d631d552d26560b640d has started. :white_circle: `2026-07-20 06:50:31 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/index.html) :white_circle: `2026-07-20 06:51:58 UTC` ya make is running... :yellow_circle: `2026-07-20 09:29:54 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://gith
  > <!-- status pr=47131, preset=release-asan, run=152831 --> :white_circle: `2026-07-20 06:50:33 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/29722597935/job/88288589111) **linux-x86_64-release-asan** for 636faecb67db7c42f9535d631d552d26560b640d has started. :white_circle: `2026-07-20 06:50:53 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/index.html) :white_circle: `2026-07-20 06:52:24 UTC` ya make is running... :yellow_circle: `2026-07-20 09:15:35 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](h

- **Issue #46027** (2026-07-13): **Coredump in CreateRegistryScanSnapshotGuard**
  *Symptoms*: ydb-stable-26-2-1-4  Applied the following config on the cluster: ``` selector: {} config: !inherit   column_shard_config: !inherit     enable_cursor_v1: true     s3_client:       executor_threads_count: 64       max_connections_count: 64   feature_flags: !inherit     enable_local_min_max_index: true     enable_cs_dictionary_encoding: true     enable_snapshots_locking: true   memory_controller_config: !inherit     shared_cache_max_percent: 15      query_execution_limit_percent: 30 ```  I **didn't** restart any nodes!!! (so i guess some part of the config was applied without restart), but all nodes got the following coredump:  ``` 0 NKikimr::NColumnShard::CreateRegistryScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NOlap::IPathIdTranslator const&, TTrueAtomicSharedPtr<NKikimr::IImmutableSnapshotRegistry>, NKikimrConfig::TLongTxServiceConfig const&) () [contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp](ydb/core/tx/columnshard/scan_snapshot_guard.cpp?#L107) +107 1 NKikimr::NColumnShard::CreateScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NColumnShard::TInFlightReadsTracker const&, NKikimr::NOlap::IPathIdTranslator const&) () [contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp](ydb/core/tx/columnshard/scan_snapshot_guard.cpp?#L170) +170 2 NKikimr::NColumnShard::TColumnShard::GetMinSnapshotForNewReads() const () [contrib/ydb/core/tx/columnshard/columnshard_impl.cpp](ydb/core/tx/col
  **Post-Mortem & Fix Analysis**:
  > 2 types of coredumps, the second one: ``` 0 NKikimr::NColumnShard::CreateRegistryScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NOlap::IPathIdTranslator const&, TTrueAtomicSharedPtr<NKikimr::IImmutableSnapshotRegistry>, NKikimrConfig::TLongTxServiceConfig const&) () contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp +107 1 NKikimr::NColumnShard::CreateScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NColumnShard::TInFlightReadsTracker const&, NKikimr::NOlap::IPathIdTranslator const&) () contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp +170 2 NKikimr::NColumnShard::TColumnShard::GetSnapshotHolders() const () contrib/ydb/core/tx/columnshard/columnshard_impl.cpp +218 3 NKikimr::NColumnShard::TColumnShard::SetupCleanupPortions() () contrib/ydb/core/tx/columnshard/columnshard_impl.cpp +902 4 NKikimr::NColumnShard::TColumnShard::EnqueueBackgroundActivities(bool) () contrib/ydb/core/tx/columnshar

- **Issue #45735** (2026-08-04): **Supportive topic partitions create empty topics_per_partition monitoring subgroups**
  *Symptoms*: Служебные (supportive) партиции топика, создаваемые в транзакциях, попадали в мониторинг topics_per_partition.  Причина: TPartition::SetupDetailedMetrics() пропускал supportive-партиции, а TUsersInfoStorage::GetPartitionCounterSubgroupImpl() и TPartition::GetPerPartitionCounterSubgroup() — нет. Вызов GetSubgroup("partition_id", ...) создавал пустые узлы в дереве счётчиков.  Симптом: множество пустых секций partition_id=<большой id> в выгрузке метрик. Объём данных в мониторинг рос, система деградировала.  Исправление: проверка IsSupportive в обоих местах.
  **Post-Mortem & Fix Analysis**:
  > <!-- gh-to-st:ydbbugs-handoff -->  ### This issue has been migrated to **[YDBBUGS-461](http://st/YDBBUGS-461)** 

- **Issue #45732** (2026-08-18): **`/operation/list?kind=import/nfs` returns BAD_REQUEST**
  *Symptoms*: `/operation/list` documents and exposes `import/nfs` as a valid operation kind, but the request returns `BAD_REQUEST`. Root cause seems to be in SchemeShard import listing: schemeshard_import__list.cpp accepts only import/s3 and import/fs, so import/nfs is rejected by TryParseKind(). Expected behavior: import/nfs should be accepted, likely as an alias for import/fs. Related note: export/nfs does not fail, but schemeshard_export__list.cpp also only explicitly handles export/s3 and export/fs; other values fall back to YT, so export/nfs may be silently parsed incorrectly.

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

### Incident Patch 1: `ed42451f` (2026-10-06)
**Commit Message**: Fix UUID predicate pushdown review issues (#55117)

**File**: `ydb/library/yql/providers/generic/provider/ut/pushdown/pushdown_ut.cpp` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 #include <ydb/library/yql/providers/generic/expr_nodes/yql_generic_expr_nodes.h>
 #include <ydb/library/yql/providers/generic/proto/source.pb.h>
 #include <ydb/library/yql/providers/generic/provider/yql_generic_provider.h>
+#include <ydb/library/yql/providers/generic/provider/yql_generic_predicate_pushdown.h>
 #include <ydb/library/yql/providers/generic/provider/yql_generic_state.h>
 
 #include <yql/essentials/ast/yql_ast.h>
@@ -849,6 +850,13 @@ Y_UNIT_TEST_SUITE_F(PushdownTest, TPushdownFixture) {
         );
     }
 
+    Y_UNIT_TEST(FormatUuidPredicate) {
+        const auto& filter = BuildProtoFilterFromLambda(
+            R"ast((== (Member $row '"col_uuid") (Uuid '"0123456789abcdef")))ast");
+        UNIT_ASSERT_STRINGS_EQUAL(FormatPredicate(filter),
+            R"sql((`col_uuid` = Uuid("33323130-3534-3736-3839-616263646566")))sql");
+    }
+
     Y_UNIT_TEST(EqualUuid) {
         // Literal "0123456789abcdef" is 16 bytes = low_128 LE + high_128 LE.
         AssertFilter(
```

**File**: `ydb/library/yql/providers/generic/provider/ya.make` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ PEERDIR(
     ydb/core/fq/libs/common
     ydb/core/fq/libs/result_formatter
     yql/essentials/ast
+    yql/essentials/types/uuid
     yql/essentials/core
     yql/essentials/core/type_ann
     ydb/library/yql/dq/expr_nodes
```

**File**: `ydb/library/yql/providers/generic/provider/yql_generic_predicate_pushdown.cpp` (modified, +17/-9)
```diff
@@ -5,7 +5,10 @@
 #include <yql/essentials/core/yql_expr_type_annotation.h>
 #include <util/string/cast.h>
 
-#include <cstring>
+#include <yql/essentials/types/uuid/uuid.h>
+#include <util/stream/str.h>
+#include <util/system/byteorder.h>
+#include <util/system/unaligned_mem.h>
 
 namespace NYql {
 
@@ -258,14 +261,8 @@ namespace NYql {
             }
             auto* value = proto->mutable_typed_value();
             value->mutable_type()->set_type_id(Ydb::Type::UUID);
-            // Byte-by-byte copy to avoid endianness issues.
-            // low_128 = bytes 0..7, high_128 = bytes 8..15 (little-endian interpretation).
-            ui64 low = 0;
-            ui64 high = 0;
-            for (int i = 0; i < 8; ++i) {
-                low |= static_cast<ui64>(static_cast<unsigned char>(literal[i])) << (8 * i);
-                high |= static_cast<ui64>(static_cast<unsigned char>(literal[8 + i])) << (8 * i);
-            }
+            const ui64 low = LittleToHost(ReadUnaligned<ui64>(literal.data()));
+            const ui64 high = LittleToHost(ReadUnaligned<ui64>(literal.data() + sizeof(ui64)));
             auto* v = value->mutable_value();
             v->set_low_128(low);
             v->set_high_128(high);
@@ -739,6 +736,8 @@ namespace NYql {
 
     TString FormatPrimitiveType(const Ydb::Type::PrimitiveTypeId& typeId) {
         switch (typeId) {
+            case Ydb::Type::UUID:
+                return "Uuid";
             case Ydb::Type::BOOL:
                 return "Bool";
             case Ydb::Type::INT8:
@@ -795,6 +794,15 @@ namespace NYql {
         case Ydb::Type::kTypeId: {
             const auto& typeId = type.type_id();
             switch (typeId) {
+            case Ydb::Type::UUID: {
+                const auto& value = typedValue.value();
+                if (value.value_case() == Ydb::Value::kLow128) {
+                    TStringStream uuid;
+                    NKikimr::NUuid::UuidHalfsToString(value.low_128(), value.high_128(), uuid);
+                    return TStringBuilder() << "Uuid(\"" << uuid.Str() << "\")";
+                }
+                break;
+            }
             case Ydb::Type::INTERVAL: {
                 const auto& value = typedValue.value();
                 switch (value.value_case()) {
```

**File**: `ydb/library/yql/providers/generic/pushdown/ut/match_predicate_ut.cpp` (modified, +32/-7)
```diff
@@ -4,7 +4,8 @@
 
 #include <google/protobuf/text_format.h>
 
-#include <cstring>
+#include <util/system/byteorder.h>
+#include <util/system/unaligned_mem.h>
 
 namespace {
 
@@ -26,8 +27,8 @@ namespace {
     TString UuidBytesFromHalves(ui64 low, ui64 high) {
         TString bytes;
         bytes.resize(16);
-        memcpy(bytes.begin(), &low, sizeof(ui64));
-        memcpy(bytes.begin() + sizeof(ui64), &high, sizeof(ui64));
+        WriteUnaligned<ui64>(bytes.begin(), HostToLittle(low));
+        WriteUnaligned<ui64>(bytes.begin() + sizeof(ui64), HostToLittle(high));
         return bytes;
     }
 
@@ -55,10 +56,8 @@ namespace {
     }
 
     std::pair<ui64, ui64> UuidHalves(const TString& bytes) {
-        ui64 low = 0;
-        ui64 high = 0;
-        memcpy(&low, bytes.data(), sizeof(ui64));
-        memcpy(&high, bytes.data() + sizeof(ui64), sizeof(ui64));
+        const ui64 low = LittleToHost(ReadUnaligned<ui64>(bytes.data()));
+        const ui64 high = LittleToHost(ReadUnaligned<ui64>(bytes.data() + sizeof(ui64)));
         return {low, high};
     }
 
@@ -302,6 +301,32 @@ Y_UNIT_TEST_SUITE(MatchPredicate) {
             BuildPredicate(ComparisonPredicate("col1", "EQ", "INT64", "int64_value: 1"))));
     }
 
+    Y_UNIT_TEST(UuidBetweenInvalidStatsKeepsGroup) {
+        const auto bound = UuidHalves(TString(16, '\x30'));
+        const auto predicate = BuildPredicate(TStringBuilder()
+            << "between { value { column: \"col1\" }"
+            << " least { typed_value { type { type_id: UUID } value { low_128: " << bound.first
+            << " high_128: " << bound.second << " } } }"
+            << " greatest { typed_value { type { type_id: UUID } value { low_128: " << bound.first
+            << " high_128: " << bound.second << " } } } }");
+        for (const size_t lowSize : {0, 8, 16, 32}) {
+            for (const size_t highSize : {0, 8, 16, 32}) {
+                const auto stats = BuildUuidStats(TString(lowSize, '\x10'), TString(highSize, '\x20'));
+                const bool matched = MatchPredicate(
+                    TMap<TString, NYql::NGenericPushDown::TColumnStatistics>{{"col1", stats}}, predicate);
+                UNIT_ASSERT_VALUES_EQUAL(matched, lowSize != 16 || highSize != 16);
+            }
+        }
+        auto stats = BuildUuidStats(TString(16, '\x10'), TString(16, '\x20'));
+        stats.UuidStats->lowValue.Clear();
+        UNIT_ASSERT(MatchPredicate(
+            TMap<TString, NYql::NGenericPushDown::TColumnStatistics>{{"col1", stats}}, predicate));
+        stats.UuidStats->lowValue = TString(16, '\x10');
+        stats.UuidStats->highValue.Clear();
+        UNIT_ASSERT(MatchPredicate(
+            TMap<TString, NYql::NGenericPushDown::TColumnStatistics>{{"col1", stats}}, predicate));
+    }
+
     Y_UNIT_TEST(UuidStatsWrongLengthKeepsGroup) {
         // UuidStats with lowValue/highValue not 16 bytes -> Unknown -> keep group.
         const TString shortLo(8, '\x10');
```

**File**: `ydb/library/yql/providers/generic/pushdown/yql_generic_match_predicate.cpp` (modified, +36/-30)
```diff
@@ -1,6 +1,7 @@
 #include "yql_generic_match_predicate.h"
 
-#include <cstring>
+#include <util/system/byteorder.h>
+#include <util/system/unaligned_mem.h>
 
 namespace NYql::NGenericPushDown {
 
@@ -93,26 +94,34 @@ namespace NYql::NGenericPushDown {
             }
         }
 
-        Triple BetweenTimestamp(const TMaybe<TColumnStatistics>& statistics, const Ydb::TypedValue& least, const Ydb::TypedValue& greatest, int64_t multiplier) {
-            if (!statistics || !statistics->Timestamp || !statistics->Timestamp->lowValue || !statistics->Timestamp->highValue) {
+        template <typename TStats, typename TConvert>
+        Triple BetweenStats(const TColumnStatistics& column, const TMaybe<TStats>& statistics,
+                            const Ydb::TypedValue& least, const Ydb::TypedValue& greatest, TConvert convert) {
+            if (!statistics || !statistics->lowValue || !statistics->highValue) {
                 return Triple::Unknown;
             }
-            auto& timestampStatistics = *statistics->Timestamp;
-            if (!least.type().has_type_id()) {
+            if (!least.type().has_type_id() || !greatest.type().has_type_id()
+                || column.ColumnType.type_id() != least.type().type_id()
+                || column.ColumnType.type_id() != greatest.type().type_id()) {
                 return Triple::Unknown;
             }
-            if (!greatest.type().has_type_id()) {
+            const auto leastValue = convert(least);
+            const auto greatestValue = convert(greatest);
+            if (!leastValue || !greatestValue) {
                 return Triple::Unknown;
             }
-            if (statistics->ColumnType.type_id() != least.type().type_id() || statistics->ColumnType.type_id() != greatest.type().type_id()) {
-                return Triple::Unknown;
-            }
-            auto leastTimestamp = TInstant::FromValue(least.value().int64_value() * multiplier);
-            auto greatestTimestamp = TInstant::FromValue(greatest.value().int64_value() * multiplier);
-            if (leastTimestamp > greatestTimestamp) {
+            if (*leastValue > *greatestValue) {
                 return Triple::False;
             }
-            return timestampStatistics.lowValue <= greatestTimestamp && timestampStatistics.highValue >= leastTimestamp ? Triple::True : Triple::False;
+            return *statistics->lowValue <= *greatestValue && *statistics->highValue >= *leastValue
+                ? Triple::True : Triple::False;
+        }
+
+        Triple BetweenTimestamp(const TColumnStatistics& statistics, const Ydb::TypedValue& least, const Ydb::TypedValue& greatest, int64_t multiplier) {
+            return BetweenStats(statistics, statistics.Timestamp, least, greatest,
+                [multiplier](const Ydb::TypedValue& value) -> TMaybe<TInstant> {
+                    return TInstant::FromValue(value.value().int64_value() * multiplier);
+                });
         }
 
         Triple ComparatorTimestamp(const TMaybe<TColumnStatistics>& lValue, ::NYql::NConnector::NApi::TPredicate::TComparison::EOperation operation, const Ydb::TypedValue& rValue, int64_t multiplier) {
@@ -195,14 +204,8 @@ namespace NYql::NGenericPushDown {
             }
             TString bytes;
             bytes.resize(16);
-            const ui64 low = value.value().low_128();
-            const ui64 high = value.value().high_128();
-            // Byte-by-byte copy to avoid endianness issues.
-            // low_128 = bytes 0..7, high_128 = bytes 8..15 (little-endian interpretation).
-            for (int i = 0; i < 8; ++i) {
-                bytes[i] = static_cast<char>(low >> (8 * i));
-                bytes[8 + i] = static_cast<char>(high >> (8 * i));
-            }
+            WriteUnaligned<ui64>(bytes.begin(), HostToLittle(value.value().low_128()));
+            WriteUnaligned<ui64>(bytes.begin() + sizeof(ui64), HostToLittle(value.value().high_128()));
             return bytes;
         }
 
@@ -219,7 +222,16 @@ namespace NYql::NGenericPushDown {
                     return TComparison::LE;
                 case TComparison::G:
                     return TComparison::L;
-                default:
+                case TComparison::EQ:
+                case TComparison::NE:
+                case TComparison::IND:
+                case TComparison::ID:
+                case TComparison::STARTS_WITH:
+                case TComparison::ENDS_WITH:
+                case TComparison::CONTAINS:
+                case TComparison::COMPARISON_OPERATION_UNSPECIFIED:
+                case ::NYql::NConnector::NApi::TPredicate_TComparison_EOperation_TPredicate_TComparison_EOperation_INT_MIN_SENTINEL_DO_NOT_USE_:
+                case ::NYql::NConnector::NApi::TPredicate_TComparison_EOperation_TPredicate_TComparison_EOperation_INT_MAX_SENTINEL_DO_NOT_USE_:
                     return operation;
             }
         }
@@ -318,16 +330,10 @@ namespace NYql::NGenericPushDown {
                     
```

**File**: `ydb/library/yql/providers/s3/actors/ut/yql_arrow_push_down_ut.cpp` (modified, +36/-5)
```diff
@@ -8,7 +8,8 @@
 
 #include <google/protobuf/text_format.h>
 
-#include <cstring>
+#include <util/system/byteorder.h>
+#include <util/system/unaligned_mem.h>
 
 namespace NYql::NPathGenerator {
 
@@ -40,6 +41,14 @@ struct TFileMetaDataBuilder {
             return *this;
         }
 
+        TRowGroupBuilder& AddColumnNullStatistics(int64_t nullCount) {
+            auto columnChunk = RowGroup->NextColumnChunk();
+            parquet::EncodedStatistics statistics;
+            statistics.set_null_count(nullCount);
+            columnChunk->SetStatistics(statistics);
+            return *this;
+        }
+
         TFileMetaDataBuilder& Build() {
             return *Parent;
         }
@@ -102,10 +111,8 @@ NYql::NConnector::NApi::TPredicate BuildPredicate(const TString& text) {
 }
 
 TString UuidValueField(const TString& bytes) {
-    ui64 low = 0;
-    ui64 high = 0;
-    memcpy(&low, bytes.data(), sizeof(ui64));
-    memcpy(&high, bytes.data() + sizeof(ui64), sizeof(ui64));
+    const ui64 low = LittleToHost(ReadUnaligned<ui64>(bytes.data()));
+    const ui64 high = LittleToHost(ReadUnaligned<ui64>(bytes.data() + sizeof(ui64)));
     return TStringBuilder() << "low_128: " << low << " high_128: " << high;
 }
 
@@ -221,6 +228,30 @@ Y_UNIT_TEST_SUITE(TArrowPushDown) {
         UNIT_ASSERT_VALUES_EQUAL(rowGroups[1], 1);
     }
 
+    Y_UNIT_TEST(UuidWithoutMinMaxKeepsGroup) {
+        auto plainSchema = std::make_shared<parquet::SchemaDescriptor>();
+        plainSchema->Init(parquet::schema::GroupNode::Make(
+            "schema", parquet::Repetition::REQUIRED,
+            {parquet::schema::PrimitiveNode::Make("id", parquet::Repetition::OPTIONAL,
+                parquet::Type::FIXED_LEN_BYTE_ARRAY, parquet::ConvertedType::NONE, 16)}));
+        const auto predicate = BuildPredicate(
+            R"proto(comparison {
+                operation: EQ
+                left_value { column: "id" }
+                right_value { typed_value { type { type_id: UUID } value { low_128: 0 high_128: 0 } } }
+            })proto");
+        for (const auto& schema : {MakeLogicalUuidSchema("id"), plainSchema}) {
+            TFileMetaDataBuilder builder{schema};
+            auto metadata = builder.AddRowGroup().AddColumnNullStatistics(2).Build().Build();
+            const auto column = metadata->RowGroup(0)->ColumnChunk(0);
+            UNIT_ASSERT(column->is_stats_set());
+            UNIT_ASSERT(!column->statistics()->HasMinMax());
+            const auto kept = NDq::MatchedRowGroups(metadata, predicate);
+            UNIT_ASSERT_VALUES_EQUAL(kept.size(), 1);
+            UNIT_ASSERT_VALUES_EQUAL(kept[0], 0);
+        }
+    }
+
     Y_UNIT_TEST(UuidLogicalTypePushDown) {
         const TString lo(16, '\x10');
         const TString hi(16, '\x20');
```

**File**: `ydb/library/yql/providers/s3/actors/yql_arrow_push_down.cpp` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ bool MatchRowGroup(std::unique_ptr<parquet::RowGroupMetaData> rowGroupMetadata,
     TMap<TString, NYql::NGenericPushDown::TColumnStatistics> columns;
     for (int i = 0; i < rowGroupMetadata->schema()->num_columns(); i++) {
         auto columnChunkMetadata = rowGroupMetadata->ColumnChunk(i);
-        if (!columnChunkMetadata->is_stats_set()) {
+        if (!columnChunkMetadata->is_stats_set() || !columnChunkMetadata->statistics()->HasMinMax()) {
             continue;
         }
         auto column = rowGroupMetadata->schema()->Column(i);
```

**File**: `ydb/tests/fq/s3/test_parquet_pushdown.py` (modified, +2/-14)
```diff
@@ -3,15 +3,7 @@
 """
 Integration tests for Parquet min/max predicate pushdown in S3 Federated Query.
 
-Tests cover all supported column types and operators:
-- INT32/INT64 (already partially covered, but extended here)
-- FLOAT/DOUBLE
-- BOOL
-- UUID
-- TIMESTAMP/DATE (already covered, but extended here)
-- BETWEEN operator
-- Multi-column AND predicates
-- Edge cases (all skipped, all kept, non-contiguous groups)
+Tests cover UUID equality, a missing UUID value, and BETWEEN predicates.
 """
 
 import struct
@@ -61,11 +53,7 @@ def _assert_pushdown_correctness(self, client, sql, expected_rows, column_names=
         assert sorted(rows_with) == sorted(expected_rows), f"With pushdown: {rows_with}"
 
     # =========================================================================
-    # FLOAT/DOUBLE pushdown tests (T4)
-    # =========================================================================
-
-    # =========================================================================
-    # UUID pushdown tests (T11)
+    # UUID pushdown tests
     # =========================================================================
 
     @yq_v2
```

---

### Incident Patch 2: `61ed8488` (2026-10-05)
**Commit Message**: Added rebuild index docs (#53918)

Co-authored-by: sintjuri <[REDACTED_EMAIL]>

**File**: `ydb/docs/en/core/dev/vector-indexes.md` (modified, +42/-2)
```diff
@@ -234,16 +234,56 @@ A particularly problematic corner case arises when a vector index is created on
 To prevent degradation:
 
 * Avoid creating a vector index on an empty table.
-* If a large volume of new data has been added, [build a new index](../yql/reference/syntax/alter_table/indexes.md) and [atomically replace](../reference/ydb-cli/commands/secondary_index.md#rename) the old index with the updated one.
+* If a large volume of new data has been added, [rebuild the index](#rebuild) when search quality or performance has degraded.
 
-### Update inconsistency during index build
+To decide when to rebuild:
+
+1. Choose a representative set of query vectors. Measure search recall by comparing indexed results with exact results from a full scan of the same table. The [vector workload command](../reference/ydb-cli/workload-vector.md#run-select) demonstrates this with `--recall`.
+2. Record search latency for the same queries. Repeat the measurements with the same distance function and search settings, including [`KMeansTreeSearchTopSize`](../yql/reference/syntax/select/vector_index.md#KMeansTreeSearchTopSize).
+3. Rebuild if recall falls or latency rises consistently after the data distribution changes. Row growth alone is a reason to measure, not a fixed rebuild threshold.
+
+### Update inconsistency during index build {#build-consistency}
 
 Vector indexes do not support consistent updates during build. That is, a vector index is not updated when data in the main table is modified until the index build is finished.
 
 This means that if you want a vector index to remain 100% consistent, you have to pause table updates while it is being built.
 
 Updates are not blocked automatically because vector index search is approximate by nature, and in many cases temporary inconsistency during the build is acceptable.
 
+This temporary limitation is planned to be removed in a future {{ ydb-short-name }} release.
+
+## Rebuilding a Vector Index {#rebuild}
+
+Rebuilding creates a new cluster tree and redistributes the table's vectors across it. Use [`ALTER TABLE ... REBUILD INDEX`](../yql/reference/syntax/alter_table/indexes.md#rebuild-index) when changes in the data distribution reduce search recall or performance:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`;
+```
+
+The command preserves the index name, indexed and covered columns, and vector index settings. To adjust the tree for a changed dataset size, explicitly set `clusters` and `levels`, which control the number of clusters and tree levels:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`
+WITH (clusters = 128, levels = 2);
+```
+
+The existing index continues to serve queries and receive table updates during the build. Once the replacement is ready, {{ ydb-short-name }} atomically replaces the old index. Applications continue to use the same index name. The operation temporarily requires storage for both index versions and resources to build the replacement.
+
+To limit the number of parallel partition handlers during the rebuild, set the [`parallel` parameter](../yql/reference/syntax/alter_table/indexes.md#rebuild-index). For example, to run no more than eight handlers at a time:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`
+WITH (parallel = 8);
+```
+
+The replacement is built from a snapshot, so the [consistency limitation during index building](#build-consistency) also applies to rebuilding. If you need a fully consistent index:
+
+1. Stop all application writers and ingestion jobs for the table, and wait for in-flight writes to finish. {{ ydb-short-name }} does not pause writes automatically.
+2. Start the rebuild. Find its ID with [`ydb operation list buildindex`](../reference/ydb-cli/operation-list.md), then check it with [`ydb operation get`](../reference/ydb-cli/operation-get.md).
+3. Resume writes when the operation reports `ready: true` and `status: SUCCESS`.
+
+Queries remain available during rebuilding, but may require a [retry](../recipes/ydb-sdk/retry.md) when the index is replaced.
+
 ## Recipes for Working with Vector Indexes {#vector-index-recipes}
 
 To get started with vector indexes, you can use the following recipes:
```

**File**: `ydb/docs/en/core/yql/reference/syntax/alter_table/indexes.md` (modified, +45/-1)
```diff
@@ -1,4 +1,4 @@
-# Adding, deleting, and renaming an index
+# Managing Indexes
 
 ## Adding an index {#add-index}
 
@@ -239,6 +239,50 @@ ALTER TABLE `/Root/Table` ALTER INDEX idx_ngram SET (
 ```
 
 
+## Rebuilding a Vector Index {#rebuild-index}
+
+`REBUILD INDEX` builds a replacement for an existing [vector index](../../../../dev/vector-indexes.md) from the table data and atomically replaces the old index under the same name. Use it to recalculate clusters after the data distribution changes or to change clustering parameters.
+
+The operation supports only `vector_kmeans_tree` indexes, including filtered and covering indexes. The index must already exist and be in the `Ready` state, which means its previous build has completed. You can check that the index exists and verify its type with [scheme describe](../../../../reference/ydb-cli/commands/scheme-describe.md).
+
+To rebuild an index with its current settings:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_vector_index`;
+```
+
+To change clustering parameters during the rebuild, add `WITH`:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_vector_index`
+WITH (clusters = 128, levels = 2);
+```
+
+The `WITH` clause accepts the following parameters:
+
+| Parameter | Description |
+| --- | --- |
+| `clusters` | Number of clusters. An integer from `2` to `2048`. |
+| `levels` | Number of tree levels. An integer from `1` to `16`. |
+| `overlap_clusters` | Number of nearest leaf clusters to which each vector is added. When specified, an integer from `2` to `2048` and no greater than `clusters`. When omitted, retains the existing setting; if the existing index has no value, the effective default is `1`. |
+| `overlap_ratio` | Non-negative distance ratio threshold for adding a vector to additional clusters; `0` disables the threshold. |
+| `adaptive_clusters` | Whether to select the number of clusters automatically for each filtering-column value in a filtered index. Accepts `true` or `false`. |
+| `parallel` | Maximum number of partition handlers involved in rebuilding. Uses the same limits and default as [`ADD INDEX`](#add-index). |
+
+Clustering parameters omitted from `WITH` retain their existing values. In particular, omitting `clusters` and `levels` does not automatically select new values for the current table size. The [vector index parameter constraints](#add-index) also apply when rebuilding.
+
+The index keeps its indexed and covered columns. Its distance or similarity function, vector value type, and vector dimensionality are inherited from the existing index. Do not specify `distance`, `similarity`, `vector_type`, or `vector_dimension` in `WITH`: the statement rejects these parameters, even if their values match the existing settings. To change them, create a separate index.
+
+The existing index remains available for queries and continues to receive table updates while the replacement is built. After a successful build, {{ ydb-short-name }} atomically switches to the replacement. Queries continue to use the same index name. If rebuilding fails or is cancelled before replacement, the old index remains available. Rebuilding can resume after a restart of the schema management tablet.
+
+Replacing the index can invalidate cached query plans. A query using the index may return a transient `ABORTED` status during the switch. If this happens while the [rebuild operation](../../../../reference/ydb-cli/operation-list.md) is completing, retry the entire query using the standard [SDK retry mechanism](../../../../recipes/ydb-sdk/retry.md).
+
+{% note warning %}
+
+The replacement is built from a snapshot and inherits the [consistency limitation of vector index builds](../../../../dev/vector-indexes.md#build-consistency). Concurrent table updates may not be reflected in the rebuilt index. If full consistency is required, [pause application writes and wait for the rebuild to succeed](../../../../dev/vector-indexes.md#rebuild). This temporary limitation is planned to be removed in a future {{ ydb-short-name }} release.
+
+{% endnote %}
+
 ## Deleting an index {#drop-index}
 
 `DROP INDEX` — deletes the index with the specified name. The code below will delete the index named `title_index`.
```

**File**: `ydb/docs/ru/core/dev/vector-indexes.md` (modified, +42/-2)
```diff
@@ -234,16 +234,56 @@ SET AUTO_PARTITIONING_PARTITION_SIZE_MB 100;
 Чтобы избежать деградации:
 
 * Не создавайте векторный индекс на пустой таблице;
-* Если в таблице накопилось много новых данных, [постройте новый индекс](../yql/reference/syntax/alter_table/indexes.md) и [атомарно замените](../reference/ydb-cli/commands/secondary_index.md#rename) старый индекс на вновь построенный.
+* Если в таблице накопилось много новых данных, [перестройте индекс](#rebuild), когда снизились качество или скорость поиска.
 
-### Неконсистентность при обновлении во время построения
+Чтобы определить, когда требуется перестроение:
+
+1. Выберите репрезентативный набор векторов запросов. Оцените полноту, сравнив результаты поиска по индексу с точными результатами полного сканирования той же таблицы. Пример такого сравнения с параметром `--recall` есть в [команде векторной нагрузки](../reference/ydb-cli/workload-vector.md#run-select).
+2. Измерьте время поиска для тех же запросов. Повторяйте измерения с одинаковой функцией расстояния и настройками поиска, включая [`KMeansTreeSearchTopSize`](../yql/reference/syntax/select/vector_index.md#KMeansTreeSearchTopSize).
+3. Перестройте индекс, если после изменения распределения данных полнота устойчиво снизилась или время поиска выросло. Сам по себе рост числа строк служит поводом для измерения, а не задаёт порог перестроения.
+
+### Неконсистентность при обновлении во время построения {#build-consistency}
 
 Векторные индексы не поддерживают консистентные обновления во время построения. То есть, векторный индекс не обновляется, если данные в основной таблице меняются до завершения построения индекса.
 
 Это означает, что если вы хотите, чтобы векторный индекс оставался на 100% консистентным, вы должны приостановить обновления данных в таблице во время его построения.
 
 Обновления таблицы не блокируются автоматически, так как поиск по векторному индексу всегда приблизительный и поэтому отсутствие консистентности при построении часто не является проблемой.
 
+Это временное ограничение планируется устранить в одной из следующих версий {{ ydb-short-name }}.
+
+## Перестроение векторного индекса {#rebuild}
+
+При перестроении создаётся новое дерево кластеров, по которым заново распределяются векторы таблицы. Используйте [`ALTER TABLE ... REBUILD INDEX`](../yql/reference/syntax/alter_table/indexes.md#rebuild-index), если изменения в распределении данных привели к снижению полноты или скорости поиска:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`;
+```
+
+Команда сохраняет имя индекса, набор индексируемых и покрываемых колонок и настройки векторного индекса. Чтобы адаптировать дерево к изменившемуся объёму данных, явно задайте `clusters` и `levels`, которые определяют количество кластеров и уровней дерева:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`
+WITH (clusters = 128, levels = 2);
+```
+
+Во время построения существующий индекс продолжает обслуживать запросы и получать обновления таблицы. Когда новая версия готова, {{ ydb-short-name }} атомарно заменяет старый индекс. Приложения продолжают использовать прежнее имя индекса. На время операции требуется место для хранения обеих версий индекса и ресурсы для построения новой версии.
+
+Чтобы ограничить число параллельных обработчиков партиций при перестроении, задайте [параметр `parallel`](../yql/reference/syntax/alter_table/indexes.md#rebuild-index). Например, чтобы одновременно работало не более восьми обработчиков:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_index`
+WITH (parallel = 8);
+```
+
+Новая версия строится по снимку данных, поэтому [ограничение консистентности при построении](#build-consistency) распространяется и на перестроение. Если нужен полностью консистентный индекс:
+
+1. Остановите все приложения и процессы загрузки, записывающие данные в таблицу, и дождитесь завершения уже выполняющихся операций записи. {{ ydb-short-name }} не приостанавливает запись автоматически.
+2. Запустите перестроение. Найдите идентификатор операции командой [`ydb operation list buildindex`](../reference/ydb-cli/operation-list.md) и проверьте её состояние командой [`ydb operation get`](../reference/ydb-cli/operation-get.md).
+3. Возобновите запись, когда операция вернёт `ready: true` и `status: SUCCESS`.
+
+Запросы остаются доступны во время перестроения, но в момент замены индекса может потребоваться [повторная попытка](../recipes/ydb-sdk/retry.md).
+
 ## Рецепты работы с векторным индексом {#vector-index-recipes}
 
 Для начала работы с векторным индексом можно воспользоваться следующими рецептами:
```

**File**: `ydb/docs/ru/core/yql/reference/syntax/alter_table/indexes.md` (modified, +45/-1)
```diff
@@ -1,4 +1,4 @@
-# Добавление, удаление и переименование индекса
+# Управление индексами
 
 ## Добавление индекса {#add-index}
 
@@ -215,6 +215,50 @@ ALTER TABLE `/Root/Table` ALTER INDEX idx_ngram SET (
 );
 ```
 
+## Перестроение векторного индекса {#rebuild-index}
+
+`REBUILD INDEX` создаёт новую версию существующего [векторного индекса](../../../../dev/vector-indexes.md) по данным таблицы и атомарно заменяет старый индекс с сохранением имени. Используйте команду для пересчёта кластеров после изменения распределения данных или для изменения параметров кластеризации.
+
+Операция поддерживает только индексы `vector_kmeans_tree`, включая индексы с фильтрацией и покрывающие индексы. Индекс должен существовать и находиться в состоянии `Ready`, то есть его предыдущее построение должно быть завершено. Проверить наличие и тип индекса можно командой [scheme describe](../../../../reference/ydb-cli/commands/scheme-describe.md).
+
+Чтобы перестроить индекс с текущими настройками, выполните:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_vector_index`;
+```
+
+Чтобы изменить параметры кластеризации при перестроении, добавьте `WITH`:
+
+```yql
+ALTER TABLE `my_table` REBUILD INDEX `my_vector_index`
+WITH (clusters = 128, levels = 2);
+```
+
+В `WITH` можно указать следующие параметры:
+
+| Параметр | Описание |
+| --- | --- |
+| `clusters` | Количество кластеров. Целое число от `2` до `2048`. |
+| `levels` | Количество уровней дерева. Целое число от `1` до `16`. |
+| `overlap_clusters` | Количество ближайших кластеров последнего уровня, в которые добавляется каждый вектор. Если параметр задан, допустимо целое число от `2` до `2048`, но не больше значения `clusters`. Если не задан, сохраняется текущее значение; при отсутствии значения в существующем индексе используется `1`. |
+| `overlap_ratio` | Неотрицательный порог отношения расстояний, ограничивающий добавление вектора в дополнительные кластеры; значение `0` отключает порог. |
+| `adaptive_clusters` | Автоматический выбор количества кластеров для каждого значения фильтруемой колонки в индексе с фильтрацией. Принимает `true` или `false`. |
+| `parallel` | Максимальное число обработчиков партиций, участвующих в перестроении. Ограничения и значение по умолчанию совпадают с [`ADD INDEX`](#add-index). |
+
+Параметры кластеризации, не указанные в `WITH`, сохраняют текущие значения. В частности, если не указать `clusters` и `levels`, новые значения для текущего размера таблицы не будут подобраны автоматически. При перестроении действуют те же [ограничения параметров векторного индекса](#add-index), что и при создании.
+
+Индекс сохраняет набор индексируемых и покрываемых колонок. Функция расстояния или сходства, тип элементов вектора и размерность вектора наследуются от существующего индекса. Не указывайте `distance`, `similarity`, `vector_type` или `vector_dimension` в `WITH`: команда отклоняет эти параметры, даже если их значения совпадают с текущими. Для их изменения создайте отдельный индекс.
+
+Существующий индекс остаётся доступным для запросов и продолжает получать обновления таблицы, пока строится новая версия. После успешного построения {{ ydb-short-name }} атомарно переключается на новую версию. Запросы продолжают использовать прежнее имя индекса. Если перестроение завершится ошибкой или будет отменено до замены, старый индекс останется доступным. Перестроение может продолжиться после перезапуска таблетки управления схемой.
+
+Замена индекса может сделать кешированные планы запросов неактуальными. Во время переключения запрос к индексу может получить временный статус `ABORTED`. Если это происходит при завершении [операции перестроения](../../../../reference/ydb-cli/operation-list.md), повторите запрос целиком с помощью стандартного [механизма повторных попыток SDK](../../../../recipes/ydb-sdk/retry.md).
+
+{% note warning %}
+
+Новая версия строится по снимку данных и наследует [ограничение консистентности при построении векторных индексов](../../../../dev/vector-indexes.md#build-consistency). Обновления таблицы во время перестроения могут не попасть в новый индекс. Если требуется полная консистентность, [приостановите запись из приложений и дождитесь успешного завершения перестроения](../../../../dev/vector-indexes.md#rebuild). Это временное ограничение планируется устранить в одной из следующих версий {{ ydb-short-name }}.
+
+{% endnote %}
+
 ## Удаление индекса {#drop-index}
 
 `DROP INDEX` — удаляет индекс с указанным именем. Приведенный ниже код удалит индекс с именем `title_index`.
```

---

### Incident Patch 3: `f2a2ca21` (2026-10-05)
**Commit Message**: Test RelativePathPrefix in KQP after YQL sync (#53874)

**File**: `ydb/core/kqp/ut/query/kqp_relative_path_prefix_ut.cpp` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+#include <ydb/core/kqp/ut/common/kqp_ut_common.h>
+
+namespace NKikimr::NKqp {
+
+using namespace NYdb;
+using namespace NYdb::NTable;
+
+Y_UNIT_TEST_SUITE(KqpRelativePathPrefix) {
+    Y_UNIT_TEST(LiteralRelativePath) {
+        TKikimrRunner kikimr(TKikimrSettings().SetWithSampleTables(false));
+        auto db = kikimr.GetTableClient();
+        auto session = db.CreateSession().GetValueSync().GetSession();
+
+        auto directory = kikimr.GetSchemeClient().MakeDirectory("/Root/folder").ExtractValueSync();
+        UNIT_ASSERT_C(directory.IsSuccess(), directory.GetIssues().ToString());
+
+        auto create = session.ExecuteSchemeQuery(R"(
+            CREATE TABLE `/Root/folder/items` (id Uint64 NOT NULL, PRIMARY KEY (id));
+        )").ExtractValueSync();
+        UNIT_ASSERT_C(create.IsSuccess(), create.GetIssues().ToString());
+
+        auto write = session.ExecuteDataQuery(R"(
+            UPSERT INTO `/Root/folder/items` (id) VALUES (1u);
+        )", TTxControl::BeginTx().CommitTx()).ExtractValueSync();
+        UNIT_ASSERT_C(write.IsSuccess(), write.GetIssues().ToString());
+
+        auto read = session.ExecuteDataQuery(R"(
+            PRAGMA RelativePathPrefix = "folder";
+            SELECT id FROM items;
+        )", TTxControl::BeginTx().CommitTx()).ExtractValueSync();
+        UNIT_ASSERT_C(read.IsSuccess(), read.GetIssues().ToString());
+        CompareYson("[[1u]]", FormatResultSetYson(read.GetResultSet(0)));
+    }
+}
+
+} // namespace NKikimr::NKqp
```

**File**: `ydb/core/kqp/ut/query/ya.make` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ SRCS(
     kqp_params_ut.cpp
     kqp_query_ut.cpp
     kqp_query_event_log_ut.cpp
+    kqp_relative_path_prefix_ut.cpp
     kqp_stats_ut.cpp
     kqp_types_ut.cpp
     kqp_write_affinity_ut.cpp
```

---

### Incident Patch 4: `2eeea180` (2026-10-05)
**Commit Message**: Document RelativePathPrefix for schema object paths (#53886)

**File**: `ydb/docs/en/core/yql/reference/syntax/pragma.md` (modified, +13/-0)
```diff
@@ -64,6 +64,19 @@ SELECT * FROM test;`
 
 The prefix is not added if the table name is an absolute path (starts with /).
 
+### RelativePathPrefix {#relative-path-prefix}
+
+| Value type | Default |
+| --- | --- |
+| String | — |
+
+Sets the root of schema object paths relative to the base path supplied by the execution environment. The value must be relative (must not start with `/`). Specify the pragma only once and before SQL statements. Absolute schema object paths remain unchanged.
+
+```yql
+PRAGMA RelativePathPrefix = "folder";
+SELECT * FROM test;
+```
+
 ### UseTablePrefixForEach {#use-table-prefix-for-each}
 
 | Value type | Default |
```

**File**: `ydb/docs/ru/core/yql/reference/syntax/pragma.md` (modified, +13/-0)
```diff
@@ -65,6 +65,19 @@ SELECT * FROM test;
 
 Префикс не добавляется, если имя таблицы указано как абсолютный путь (начинается с /).
 
+### RelativePathPrefix {#relative-path-prefix}
+
+| Тип значения | По умолчанию |
+| --- | --- |
+| Строка | — |
+
+Задаёт корень путей схемных объектов относительно базового пути среды выполнения. Значение должно быть относительным (не начинаться с `/`). Прагму можно указать только один раз и только до SQL-операторов. Абсолютные пути схемных объектов не меняются.
+
+```yql
+PRAGMA RelativePathPrefix = "folder";
+SELECT * FROM test;
+```
+
 ### UseTablePrefixForEach {#use-table-prefix-for-each}
 
 | Тип значения | По умолчанию |
```

---

### Incident Patch 5: `9ff86675` (2026-10-05)
**Commit Message**: [detailed-metrics] move pre-aggregation to a node side to reduce memory consumption (#55115)

**File**: `ydb/core/kqp/ut/scheme/kqp_scheme_ut.cpp` (modified, +46/-11)
```diff
@@ -14,6 +14,7 @@
 #include <ydb/services/workload_manager/actors/actors.h>
 #include <ydb/services/workload_manager/ut/common/workload_service_ut_common.h>
 #include <ydb/core/protos/schemeshard/operations.pb.h>
+#include <ydb/core/sys_view/common/events.h>
 #include <ydb/core/tablet/tablet_counters_aggregator.h>
 #include <ydb/core/testlib/cs_helper.h>
 #include <ydb/core/testlib/common_helper.h>
@@ -7387,10 +7388,46 @@ Y_UNIT_TEST_SUITE(KqpScheme) {
         UNIT_FAIL("The database " << path << " is not running: " << status.DebugString());
     }
 
+    using TDetailedCountersRegistrations = THashMap<std::pair<ui32, TString>, TIntrusivePtr<NSysView::IDbDetailedCounters>>;
+
+    // The aggregator actor registers on creation and every 60 seconds afterwards, so the observer
+    // must be in place before the database is created.
+    auto ObserveDetailedCountersRegistrations(TTestActorRuntime& runtime, TDetailedCountersRegistrations& registrations) {
+        return runtime.AddObserver<NSysView::TEvSysView::TEvRegisterDbDetailedCounters>(
+            [&registrations](NSysView::TEvSysView::TEvRegisterDbDetailedCounters::TPtr& ev) {
+                const auto* msg = ev->Get();
+                if (msg->Service == NKikimrSysView::TABLETS) {
+                    registrations[std::make_pair(ev->Recipient.NodeId(), msg->Database)] = msg->Counters;
+                }
+            });
+    }
+
+    bool HasPublishedPartitionLeaf(NSysView::IDbDetailedCounters& counters, const TString& tablePath, ui64 tabletId) {
+        // Pack twice, as TPackedReceiver::Settle() does
+        NProtoBuf::RepeatedPtrField<NKikimrSysView::TDetailedTableCounters> report;
+        counters.Pack(report);
+        report.Clear();
+        counters.Pack(report);
+
+        for (const auto& entry : report) {
+            if (entry.GetTablePath() != tablePath
+                || entry.GetLevel() != NKikimrSchemeOp::TTableDetailedMetricsSettings::MetricsLevelPartition)
+            {
+                continue;
+            }
+            for (const auto& leaf : entry.GetLeaves()) {
+                if (leaf.GetTabletId() == tabletId && leaf.GetFollowerId() == 0) {
+                    return true;
+                }
+            }
+        }
+        return false;
+    }
+
     // The detailed metrics a node publishes for a table: "none" (DATABASE level), "table"
     // (one bucket for the whole table) or "partition" (a leaf per partition).
-    TString GetPublishedDetailedMetrics(TTestActorRuntime& runtime, const TString& database,
-        const TString& table, ui64 tabletId)
+    TString GetPublishedDetailedMetrics(TTestActorRuntime& runtime, const TDetailedCountersRegistrations& registrations,
+        const TString& database, const TString& table, ui64 tabletId)
     {
         auto findExecutorGroup = [](::NMonitoring::TDynamicCounterPtr group) -> ::NMonitoring::TDynamicCounterPtr {
             auto typeGroup = group ? group->FindSubgroup("type", "DataShard") : nullptr;
@@ -7401,16 +7438,11 @@ Y_UNIT_TEST_SUITE(KqpScheme) {
             auto rawGroup = runtime.GetAppData(nodeIndex).Counters->FindSubgroup("counters", "ydb_detailed_raw");
             auto databaseGroup = rawGroup ? rawGroup->FindSubgroup("database", database) : nullptr;
             auto tableGroup = databaseGroup ? databaseGroup->FindSubgroup("table", table) : nullptr;
-            if (!tableGroup) {
-                continue;
-            }
-
             const bool hasTableBucket = bool(findExecutorGroup(tableGroup));
 
-            auto perPartitionGroup = tableGroup->FindSubgroup("detailed_metrics", "per_partition");
-            auto tabletGroup = perPartitionGroup ? perPartitionGroup->FindSubgroup("tablet_id", ToString(tabletId)) : nullptr;
-            auto leaderGroup = tabletGroup ? tabletGroup->FindSubgroup("follower_id", "0") : nullptr;
-            const bool hasPartitionLeaf = bool(findExecutorGroup(leaderGroup));
+            auto it = registrations.find(std::make_pair(runtime.GetNodeId(nodeIndex), database));
+            const bool hasPartitionLeaf = it != registrations.end()
+                && HasPublishedPartitionLeaf(*it->second, database + "/" + table, tabletId);
 
             if (hasTableBucket && !hasPartitionLeaf) {
                 return "table";
@@ -7441,6 +7473,9 @@ Y_UNIT_TEST_SUITE(KqpScheme) {
             .SetStoragePoolTypes({"hdd1"}));
         auto& runtime = *kikimr.GetTestServer().GetRuntime();
 
+        TDetailedCountersRegistrations detailedCounters;
+        auto detailedCountersObserver = ObserveDetailedCountersRegistrations(runtime, detailedCounters);
+
         const TString database = "/Root/Test";
         Tests::TTenants tenants(&kikimr.GetTestServer());
         CreateTenantInSimulatedRuntime(runtime, tenants, database, "hdd1");
@@ -7499,7 +7534,7 @@ Y_UNIT_TEST_SUITE(KqpScheme) {
                     const auto it = reported.find(database + "/" + table.Table);
                     const ui32 level = it != reporte
```

**File**: `ydb/core/protos/counters_detailed_datashard.proto` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ option java_package = "ru.yandex.kikimr.proto";
  */
 option (SourceCountersTabletTypeName) = "DataShard";
 
+// The enum values are wire slots of TDbCounters (sys_view.proto): append-only, never remove or renumber an entry.
+
 /**
  * Public detailed metrics (GAUGE), mapped from DataShard low level metrics.
  */
```

**File**: `ydb/core/protos/sys_view.proto` (modified, +16/-4)
```diff
@@ -558,6 +558,9 @@ message TEvGetQueryStatsResponse {
 // cumulative and histogram values may be absolute or diffs depending on the context,
 // except a histogram marked NonDerivative, which always holds full values
 // only index-value pairs with non-zero values are stored in diff mode
+// On the detailed metrics channel (TDetailedTableCounters) slot i is the enum value i of the public
+// metrics of the tablet type (counters_detailed_<type>.proto): Simple is dense, Cumulative holds
+// (slot, delta) pairs, every histogram metric is present, a non-derivative one marked NonDerivative
 message TDbCounters {
     message THistogram {
         repeated uint64 Buckets = 1;
@@ -587,19 +590,28 @@ message TDbTabletCounters {
 
 message TDetailedTableCounters {
     message TLeaf {
+        reserved 3;
+        reserved "Counters";
+
         optional uint64 TabletId = 1;
         optional uint32 FollowerId = 2;
-        optional TDbTabletCounters Counters = 3;
+        optional TDbCounters Metrics = 4;
     }
 
+    reserved 5;
+    reserved "TableCounters";
+
     optional string TablePath = 3;
     optional NKikimrSchemeOp.TTableDetailedMetricsSettings.EMetricsLevel Level = 4;
 
-    // Set iff Level == MetricsLevelTable
-    optional TDbTabletCounters TableCounters = 5;
-
     // Set iff Level == MetricsLevelPartition
     repeated TLeaf Leaves = 6;
+
+    // Set iff Level == MetricsLevelTable
+    optional TDbCounters TableMetrics = 7;
+
+    // Defines the slots of TableMetrics and TLeaf.Metrics, an entry without it is ignored
+    optional NKikimrTabletBase.TTabletTypes.EType TabletType = 8;
 }
 
 message TDbGRpcCounters {
```

**File**: `ydb/core/sys_view/processor/db_counters.cpp` (modified, +1/-5)
```diff
@@ -347,11 +347,7 @@ TProcessorDatabaseMetricsAggregator* TSysViewProcessor::GetDetailedAggregator()
     // be built and fed on a plain db counters deployment.
     if (!DetailedAggregator && Database && AppData()->FeatureFlags.GetEnableDataShardDetailedMetrics()) {
         NProfiling::TMemoryTagScope memoryScope(NDetailedMetrics::ProcessorMemoryTag());
-        DetailedAggregator = CreateProcessorDatabaseMetricsAggregator(
-            DetailedRawGroup,
-            DetailedGroup,
-            Database,
-            THolder<TTabletCountersBase>(new NTabletFlatExecutor::TExecutorCounters));
+        DetailedAggregator = CreateProcessorDatabaseMetricsAggregator(DetailedGroup, Database);
     }
     return DetailedAggregator.Get();
 }
```

**File**: `ydb/core/sys_view/processor/processor_impl.cpp` (modified, +0/-2)
```diff
@@ -32,8 +32,6 @@ TSysViewProcessor::TSysViewProcessor(const NActors::TActorId& tablet, TTabletSto
     , ExternalGroup(new ::NMonitoring::TDynamicCounters)
     , LabeledGroup(new ::NMonitoring::TDynamicCounters)
     , DetailedGroup(CreateDetailedCounterGroup())
-    , DetailedRawGroup(CreateDetailedCounterGroup(
-        ::NMonitoring::TCountableBase::EVisibility::Private))
 {
     InternalGroups["kqp_serverless"] = new ::NMonitoring::TDynamicCounters;
     InternalGroups["tablets_serverless"] = new ::NMonitoring::TDynamicCounters;
```

**File**: `ydb/core/sys_view/processor/processor_impl.h` (modified, +0/-1)
```diff
@@ -427,7 +427,6 @@ class TSysViewProcessor : public TActor<TSysViewProcessor>, public NTabletFlatEx
     std::unordered_map<TString, ::NMonitoring::TDynamicCounterPtr> InternalGroups;
 
     ::NMonitoring::TDynamicCounterPtr DetailedGroup;
-    ::NMonitoring::TDynamicCounterPtr DetailedRawGroup;
     TProcessorDatabaseMetricsAggregatorPtr DetailedAggregator;
 
     using TDbCountersServiceMap = std::unordered_map<NKikimrSysView::EDbCountersService,
```

**File**: `ydb/core/sys_view/service/sysview_service_ut.cpp` (modified, +5/-5)
```diff
@@ -42,9 +42,9 @@ namespace NKikimr {
                         auto* table = out.Add();
                         table->SetTablePath(i ? TablePath + ToString(i) : TablePath);
                         table->SetLevel(NKikimrSchemeOp::TTableDetailedMetricsSettings::MetricsLevelTable);
-                        auto* counters = table->MutableTableCounters()->MutableAppCounters();
-                        counters->AddSimple(0);
-                        counters->AddSimple(PackCount);
+                        auto* metrics = table->MutableTableMetrics();
+                        metrics->AddSimple(0);
+                        metrics->AddSimple(PackCount);
                         for (int j = 0; j < Leaves; ++j) {
                             table->AddLeaves()->SetTabletId(j);
                         }
@@ -208,7 +208,7 @@ namespace NKikimr {
                 UNIT_ASSERT_VALUES_EQUAL(leaderStub->PackCount, 2);
                 UNIT_ASSERT_VALUES_EQUAL(followerStub->PackCount, 2);
                 for (const auto& detailed : req3.GetDetailedCounters()) {
-                    UNIT_ASSERT_VALUES_EQUAL(detailed.GetTables(0).GetTableCounters().GetAppCounters().GetSimple(1), 2);
+                    UNIT_ASSERT_VALUES_EQUAL(detailed.GetTables(0).GetTableMetrics().GetSimple(1), 2);
                 }
             }
 
@@ -290,7 +290,7 @@ namespace NKikimr {
                 UNIT_ASSERT_VALUES_EQUAL(req.DetailedCountersSize(), 1);
                 UNIT_ASSERT_VALUES_EQUAL(req.GetDetailedCounters(0).TablesSize(), 1);
                 UNIT_ASSERT_VALUES_EQUAL(
-                    req.GetDetailedCounters(0).GetTables(0).GetTableCounters().GetAppCounters().GetSimple(1), 2);
+                    req.GetDetailedCounters(0).GetTables(0).GetTableMetrics().GetSimple(1), 2);
             }
 
             Y_UNIT_TEST(ShrunkDetailedPayloadReleasedLater) {
```

**File**: `ydb/core/tablet/detailed_metrics/detailed_metrics_binding.cpp` (added, +394/-0)
```diff
@@ -0,0 +1,394 @@
+#include "detailed_metrics_binding.h"
+
+#include <ydb/core/protos/counters_detailed_datashard.pb.h>
+#include <ydb/core/tablet/tablet_counters_protobuf.h>
+
+#include <util/string/builder.h>
+
+#include <algorithm>
+
+namespace NKikimr {
+
+namespace {
+
+constexpr ui32 NO_SLOT = TBoundTerm::NoSlot;
+
+// Parsed as for the YDB metrics mapper: a malformed definition aborts there
+template <const NProtoBuf::EnumDescriptor* Desc()>
+TVector<TMetricSpec> BuildMetricSpecs(EMetricKind kind) {
+    const auto* opts = NAux::GetAppOpts<Desc, true /* ParseSourceCounters */>();
+
+    TVector<TMetricSpec> specs;
+    specs.reserve(opts->Size);
+
+    for (size_t i = 0; i < opts->Size; ++i) {
+        TVector<TSourceRef> sources;
+        for (const auto& source : opts->GetSourceCounters(i)) {
+            sources.push_back(ParseSourceRef(source.GetName(), source.GetCategory()));
+        }
+
+        TVector<ui64> bounds;
+        bool nonDerivative = false;
+        if (kind == EMetricKind::Histogram) {
+            for (const auto& range : opts->GetRanges(i)) {
+                bounds.push_back(range.RangeVal);
+            }
+            nonDerivative = opts->GetIntegral(i)
+                || std::any_of(sources.begin(), sources.end(), [](const TSourceRef& source) {
+                    return source.Wrapper == ESourceWrapper::Hist;
+                });
+        }
+
+        specs.push_back(TMetricSpec{
+            .Name = opts->GetNames()[i],
+            .LeaderOnly = opts->GetLeaderOnly(i),
+            .Sources = std::move(sources),
+            .Bounds = std::move(bounds),
+            .NonDerivative = nonDerivative,
+        });
+    }
+
+    return specs;
+}
+
+void AddCounterNames(TDetailedMetricsDescriptor& descriptor, const TSourceRef& source) {
+    auto& names = source.Category == ESourceCounterCategory::SCC_TABLET
+        ? descriptor.AppCounterNames
+        : descriptor.ExecutorCounterNames;
+
+    names.insert(source.Text);
+    if (source.Wrapper == ESourceWrapper::Sum || source.Wrapper == ESourceWrapper::Max) {
+        names.insert(source.Name);
+    }
+}
+
+template <const NProtoBuf::EnumDescriptor* SimpleDesc(),
+          const NProtoBuf::EnumDescriptor* CumulativeDesc(),
+          const NProtoBuf::EnumDescriptor* PercentileDesc()>
+TDetailedMetricsDescriptor BuildDescriptor(TTabletTypes::EType type) {
+    TDetailedMetricsDescriptor descriptor{
+        .Type = type,
+        .Gauges = BuildMetricSpecs<SimpleDesc>(EMetricKind::Gauge),
+        .Rates = BuildMetricSpecs<CumulativeDesc>(EMetricKind::Rate),
+        .Histograms = BuildMetricSpecs<PercentileDesc>(EMetricKind::Histogram),
+    };
+
+    for (const auto* specs : {&descriptor.Gauges, &descriptor.Rates, &descriptor.Histograms}) {
+        for (const auto& spec : *specs) {
+            for (const auto& source : spec.Sources) {
+                AddCounterNames(descriptor, source);
+            }
+        }
+    }
+
+    return descriptor;
+}
+
+enum class ECounterArray {
+    Simple,
+    Cumulative,
+    Percentile,
+};
+
+ui32 FindCounter(const TTabletCountersBase& counters, ECounterArray array, TStringBuf name) {
+    const auto find = [name](ui32 size, auto getName) {
+        for (ui32 slot = 0; slot < size; ++slot) {
+            const char* counterName = getName(slot);
+            if (counterName && name == counterName) {
+                return slot;
+            }
+        }
+        return NO_SLOT;
+    };
+
+    switch (array) {
+    case ECounterArray::Simple:
+        return find(counters.Simple().Size(), [&](ui32 slot) { return counters.SimpleCounterName(slot); });
+    case ECounterArray::Cumulative:
+        return find(counters.Cumulative().Size(), [&](ui32 slot) { return counters.CumulativeCounterName(slot); });
+    case ECounterArray::Percentile:
+        return find(counters.Percentile().Size(), [&](ui32 slot) { return counters.PercentileCounterName(slot); });
+    }
+
+    Y_ABORT("unexpected counter array %d", static_cast<int>(array));
+}
+
+class TBinder {
+public:
+    TBinder(
+        const TDetailedMetricsDescriptor& descriptor,
+        const TTabletCountersBase& executorCounters,
+        const TTabletCountersBase& appCounters,
+        TDetailedMetricsBinding& binding)
+        : ExecutorCounters(executorCounters)
+        , AppCounters(appCounters)
+        , Binding(binding)
+    {
+        Binding.Descriptor = &descriptor;
+        Binding.LayoutSizes = TDetailedMetricsBinding::GetLayoutSizes(executorCounters, appCounters);
+
+        BindMetrics(EMetricKind::Gauge, descriptor.Gauges);
+        BindMetrics(EMetricKind::Rate, descriptor.Rates);
+        BindMetrics(EMetricKind::Histogram, descriptor.Histograms);
+    }
+
+private:
+    void BindMetrics(EMetricKind kind, const TVector<TMetricSpec>& specs) {
+        for (ui32 metric = 0; metric < specs.size(); ++metric) {
+            const auto& spec = specs[metric];
+
+            ui32 pendingOffset = NO_SLOT;
+
+            fo
```

---

### Incident Patch 6: `f6c460df` (2026-10-05)
**Commit Message**: Fix TLI chain summary when the lock span is COMMIT (#55103)

**File**: `ydb/tools/tli_analysis/find_tli_chain.py` (modified, +44/-11)
```diff
@@ -225,6 +225,37 @@ def in_window(t: float, start: float, end: float) -> bool:
     return start <= t <= end
 
 
+def select_victim_query(
+    items: List[Tuple[str, str]], victim_span_id: Optional[str]
+) -> Tuple[str, Optional[str]]:
+    """Pick the victim statement and the span to highlight in VictimTx.
+
+    Prefer the row whose query span is the lock span when that row is real SQL.
+    Deferred-lock logs put a synthetic COMMIT on the lock span and the statement
+    that conflicted on a different span. In that case use the earliest collected
+    statement. Callers pass items in timestamp order so a merged log follows
+    emission time rather than file order.
+    """
+    matched = ""
+    matched_id: Optional[str] = None
+    first_sql = ""
+    first_sql_id: Optional[str] = None
+    for query_id, query_text in items:
+        if not query_text:
+            continue
+        if victim_span_id and query_id == victim_span_id and not matched:
+            matched = query_text
+            matched_id = query_id
+        if query_text != "COMMIT" and not first_sql:
+            first_sql = query_text
+            first_sql_id = query_id
+    if matched and matched != "COMMIT":
+        return matched, matched_id
+    if first_sql:
+        return first_sql, first_sql_id
+    return matched, matched_id
+
+
 def print_tx_block(title: str, items: List[Tuple[str, str]], highlight_id: Optional[str], use_color: bool):
     """Print transaction block with optional highlighting."""
     print_section_header(title, use_color)
@@ -261,8 +292,6 @@ def main():
     tp = FastTimeParser()
 
     # Collected data
-    victim_query_text = ""
-    anchor_t: Optional[float] = None
     breaker_log_ds: Optional[str] = None     # DataShard "broke other locks" line
     breaker_id: Optional[str] = None
     breaker_sa_with_text_by_id: Dict[str, str] = {}
@@ -287,26 +316,28 @@ def main():
                 if t is None:
                     continue
 
-                # Find anchor: first line containing victim_id
-                if anchor_t is None and (victim_id in line):
-                    anchor_t = t
-
                 relevant_lines.append((t, line))
     except (FileNotFoundError, PermissionError, OSError) as e:
         err_msg = f"Failed to open log file '{path}': {e}"
         print(style(err_msg, color=ANSI_RED, bold=True, enable=use_color), file=sys.stderr)
         sys.exit(1)
 
-    if anchor_t is None:
+    anchor_times = [t for t, line in relevant_lines if victim_id in line]
+    if not anchor_times:
         print(f"Error: VictimQuerySpanId {victim_id} not found in log file.", file=sys.stderr)
         sys.exit(1)
 
+    # Merged logs are concatenated per node, so file order is not time order.
+    anchor_t = min(anchor_times)
+    relevant_lines.sort(key=lambda item: item[0])
+
     w_start = anchor_t - W
     w_end = anchor_t + W
 
     # Process all relevant lines within the time window
 
     victim_tx_items: List[Tuple[str, str]] = []
+    victim_tx_span_id: Optional[str] = None
     breaker_tx_items: List[Tuple[str, str]] = []
     breaker_query_text = None
 
@@ -323,9 +354,9 @@ def main():
             line_query_text = unescape_and_format_query_text(extract_field(line, "queryText"))
 
             if line_query_id and line_query_text:
-                victim_tx_span_id = extract_field(line, "victimTxSpanId")
-                if victim_tx_span_id == line_query_id:
-                    victim_query_text = line_query_text
+                line_victim_tx_span_id = extract_field(line, "victimTxSpanId")
+                if line_victim_tx_span_id and victim_tx_span_id is None:
+                    victim_tx_span_id = line_victim_tx_span_id
                 victim_tx_items.append((line_query_id, line_query_text))
 
         # Breaker DataShard line: "broke other locks" + Component: DataShard
@@ -336,6 +367,8 @@ def main():
                 breaker_log_ds = line
                 breaker_id = extract_breaker_id(line)
 
+    victim_query_text, victim_highlight_id = select_victim_query(victim_tx_items, victim_tx_span_id)
+
     for t, line in relevant_lines:
         if not in_window(t, w_start, w_end):
             continue
@@ -375,7 +408,7 @@ def main():
     print_kv_header("BreakerQueryText", use_color)
     print(breaker_query_text if breaker_query_text else "(not found)")
 
-    print_tx_block("VictimTx", victim_tx_items, victim_id, use_color)
+    print_tx_block("VictimTx", victim_tx_items, victim_highlight_id, use_color)
 
     print_tx_block("BreakerTx", breaker_tx_items, breaker_id, use_color)
 
```

**File**: `ydb/tools/tli_analysis/tests/test_find_tli_chain.py` (modified, +308/-117)
```diff
@@ -1,10 +1,4 @@
-"""End-to-end tests for find_tli_chain against real TLI scenarios.
-
-Uses the same Basic / CrossTables lock-breaking scenarios:
-* run them on a live cluster with TLI logging,
-* take VictimQuerySpanId from the Aborted issue,
-* reconstruct the chain with find_tli_chain.py.
-"""
+"""Cluster tests for find_tli_chain over the KqpTli scenarios that change chain selection."""
 
 from __future__ import annotations
 
@@ -27,7 +21,7 @@
 from ydb.tools.tli_analysis import find_tli_chain
 
 
-RE_BREAKER_ID = re.compile(r"BreakerQuerySpanId:\s*(\d+)")
+_ANSI = re.compile(r"\033\[[0-9;]*m")
 
 
 def _collect_ydbd_log_paths(cluster):
@@ -51,27 +45,65 @@ def _merge_logs_to_file(log_paths) -> str:
     return merged_path
 
 
-def _run_find_tli_chain(victim_id: str, logfile: str) -> str:
+def _run_find_tli_chain(victim_id: str, logfile: str, *, color: bool = False) -> str:
     buf = io.StringIO()
-    argv = ["find_tli_chain.py", str(victim_id), logfile, "--no-color"]
+    if color:
+        buf.isatty = lambda: True
+    argv = ["find_tli_chain.py", str(victim_id), logfile, "--window-sec", "120"]
+    if not color:
+        argv.append("--no-color")
     with mock.patch.object(sys, "argv", argv), redirect_stdout(buf):
-        find_tli_chain.main()
+        env = os.environ.copy()
+        env.pop("NO_COLOR", None)
+        with mock.patch.dict(os.environ, env, clear=True):
+            find_tli_chain.main()
     return buf.getvalue()
 
 
-def _assert_chain_output(output: str, victim_id: int, victim_query: str, breaker_query: str):
-    assert f"VictimQuerySpanId: {victim_id}" in output, output
-    assert "VictimQueryText: (not found)" not in output, output
-    assert "BreakerQuerySpanId: (not found)" not in output, output
-    assert "BreakerQueryText: (not found)" not in output, output
+def _red(text: str) -> str:
+    return f"\033[31m{text}\033[0m"
+
+
+def _summary_field(output: str, name: str) -> str:
+    plain = _ANSI.sub("", output)
+    marker = f"{name}: "
+    start = plain.find(marker)
+    assert start >= 0, output
+    return plain[start + len(marker):].split("\n", 1)[0]
+
+
+def _tx_section(output: str, title: str, next_title: str | None = None) -> str:
+    body = output.split(title, 1)[1]
+    if next_title:
+        body = body.split(next_title, 1)[0]
+    return body
+
 
-    breaker_m = RE_BREAKER_ID.search(output)
-    assert breaker_m and breaker_m.group(1) != "0", output
+def _exec(workload: WorkloadTli, tx, query: str, *, commit: bool = False):
+    workload._drain_query_result_if_needed(tx.execute(query, commit_tx=commit))
 
-    assert victim_query in output, f"missing victim query {victim_query!r} in:\n{output}"
-    assert breaker_query in output, f"missing breaker query {breaker_query!r} in:\n{output}"
-    assert "VictimTx" in output, output
-    assert "BreakerTx" in output, output
+
+def _expect_aborted(workload: WorkloadTli, scenario: str, action) -> int:
+    try:
+        action()
+    except ydb.issues.Aborted as e:
+        issues = workload._extract_issue_text(e)
+        workload._verify_tli_issue_content(issues, scenario)
+        victim_id = workload._extract_victim_query_span_id(issues)
+        assert victim_id, f"{scenario}: VictimQuerySpanId was not captured: {issues}"
+        return victim_id
+    raise AssertionError(f"{scenario}: expected ABORTED")
+
+
+class _Expect:
+    def __init__(self, name, victim_id, victim_query, breaker_query, victim_tx=(), breaker_tx=(), commit_row=False):
+        self.name = name
+        self.victim_id = victim_id
+        self.victim_query = victim_query
+        self.breaker_query = breaker_query
+        self.victim_tx = victim_tx
+        self.breaker_tx = breaker_tx
+        self.commit_row = commit_row
 
 
 class TestFindTliChain(StressFixture):
@@ -84,114 +116,273 @@ def setup_tli(self):
             use_log_files=True,
         )
 
-    def _run_scenario_capture_victim_id(
-        self,
-        client,
-        workload: WorkloadTli,
-        victim_read_query: str,
-        breaker_query: str,
-        victim_commit_query: str,
-        scenario_name: str,
-    ) -> int:
-        captured = {}
+    def _create_table(self, client, path: str, rows):
+        client.query(
+            f"""
+            CREATE TABLE `{path}` (
+                Key Uint64,
+                Value String,
+                PRIMARY KEY (Key)
+            )
+            """,
+            True,
+        )
+        for key, value in rows:
+            client.query(
+                f'UPSERT INTO `{path}` (Key, Value) VALUES ({key}u, "{value}")',
+                False,
+            )
 
-        def run_in_victim_session(victim_session):
-            with victim_session.transaction() as victim_tx:
-                victim_tx.begin()
-                workload._drain_query_result_if_needed(victim_tx.execute(victim_read_query))
+    def _on_session(self, client, fn):
+        def run(session):
+            return fn(session)
 
-             
```

---

### Incident Patch 7: `88fe8304` (2026-10-05)
**Commit Message**: Fix ColumnShard cleanup logging compilation (#55166)

**File**: `ydb/core/tx/columnshard/columnshard_impl.cpp` (modified, +1/-1)
```diff
@@ -1019,7 +1019,7 @@ void TColumnShard::SetupCleanupTables(const NOlap::ISnapshotHolders& snapshotHol
                 continue;
             }
             if (OperationsManager->HasWriteOperations(pathId)) {
-                AFL_DEBUG(NKikimrServices::TX_COLUMNSHARD)("event", "CleanupTableMetadataDeferredByWriteOperations")("path_id", pathId);
+                YDB_LOG_DEBUG("", {"event", "CleanupTableMetadataDeferredByWriteOperations"}, {"path_id", pathId});
                 continue;
             }
             pathIdsToCleanup.insert(pathId);
```

---

### Incident Patch 8: `5433431e` (2026-10-05)
**Commit Message**: Fix scheme objects for local indexes (#53625)

**File**: `ydb/core/tx/schemeshard/olap/operations/alter/abstract/context.h` (modified, +17/-13)
```diff
@@ -87,45 +87,49 @@ class TEvolutionInitializationContext {
 class TUpdateStartContext {
 private:
     const TPath* ObjectPath = nullptr;
-    TOperationContext* SSOperationContext = nullptr;
-    NIceDb::TNiceDb* DB;
+    TProposeContext* SSOperationContext = nullptr;
 public:
     const TPath* GetObjectPath() const {
         return ObjectPath;
     }
-    NIceDb::TNiceDb* GetDB() const {
-        return DB;
-    }
-    const TOperationContext* GetSSOperationContext() const {
+    const TProposeContext* GetSSOperationContext() const {
         return SSOperationContext;
     }
 
-    TUpdateStartContext(const TPath* objectPath, TOperationContext* ssOperationContext, NIceDb::TNiceDb* db)
+    TUpdateStartContext(const TPath* objectPath, TProposeContext* ssOperationContext)
         : ObjectPath(objectPath)
         , SSOperationContext(ssOperationContext)
-        , DB(db)
     {
-        AFL_VERIFY(DB);
         AFL_VERIFY(ObjectPath);
         AFL_VERIFY(SSOperationContext);
     }
 };
 
-class TUpdateFinishContext: public TUpdateStartContext {
+class TUpdateFinishContext {
 private:
-    using TBase = TUpdateStartContext;
+    const TPath* ObjectPath = nullptr;
+    TOperationContext* SSOperationContext = nullptr;
     YDB_READONLY_DEF(std::optional<NKikimr::NOlap::TSnapshot>, Snapshot);
 public:
+    const TPath* GetObjectPath() const {
+        return ObjectPath;
+    }
+    const TOperationContext* GetSSOperationContext() const {
+        return SSOperationContext;
+    }
 
     const NKikimr::NOlap::TSnapshot& GetSnapshotVerified() const {
         AFL_VERIFY(Snapshot);
         return *Snapshot;
     }
 
-    TUpdateFinishContext(const TPath* objectPath, TOperationContext* ssOperationContext, NIceDb::TNiceDb* db, const std::optional<NKikimr::NOlap::TSnapshot>& ss)
-        : TBase(objectPath, ssOperationContext, db)
+    TUpdateFinishContext(const TPath* objectPath, TOperationContext* ssOperationContext, const std::optional<NKikimr::NOlap::TSnapshot>& ss)
+        : ObjectPath(objectPath)
+        , SSOperationContext(ssOperationContext)
         , Snapshot(ss)
     {
+        AFL_VERIFY(ObjectPath);
+        AFL_VERIFY(SSOperationContext);
     }
 };
 
```

**File**: `ydb/core/tx/schemeshard/olap/operations/alter/common/update.cpp` (modified, +24/-10)
```diff
@@ -9,26 +9,34 @@ TConclusionStatus TColumnTableUpdate::DoStart(const TUpdateStartContext& context
         return conclusion;
     }
     const auto pathId = context.GetObjectPath()->Base()->PathId;
-    auto tableInfo = context.GetSSOperationContext()->SS->ColumnTables.TakeVerified(pathId);
-    context.GetSSOperationContext()->SS->PersistColumnTableAlter(*context.GetDB(), pathId, *GetTargetTableInfoVerified());
+    auto* ssContext = context.GetSSOperationContext();
+    ssContext->MemChanges.GrabColumnTable(ssContext->SS, pathId);
+    auto tableInfo = ssContext->SS->ColumnTables.TakeVerified(pathId);
     tableInfo->AlterData = GetTargetTableInfoVerified();
+    if (IsAlterPersistent()) {
+        ssContext->DbChanges.PersistColumnTableAlter(pathId);
+    }
 
     {
         THashSet<TString> oldDataSources = tableInfo->GetUsedTiers();
         THashSet<TString> newDataSources = GetTargetTableInfoVerified()->GetUsedTiers();
         for (const auto& tier : oldDataSources) {
             if (!newDataSources.contains(tier)) {
-                auto tierPath = TPath::Resolve(tier, context.GetSSOperationContext()->SS);
+                auto tierPath = TPath::Resolve(tier, ssContext->SS);
                 AFL_VERIFY(tierPath.IsResolved())("path", tier);
-                context.GetSSOperationContext()->SS->PersistRemoveExternalDataSourceReference(*context.GetDB(), tierPath->PathId, pathId);
+                ssContext->MemChanges.GrabExternalDataSource(ssContext->SS, tierPath->PathId);
+                ssContext->SS->RemoveExternalDataSourceReference(tierPath->PathId, pathId);
+                ssContext->DbChanges.PersistExternalDataSource(tierPath->PathId);
             }
         }
         for (const auto& tier : newDataSources) {
             if (!oldDataSources.contains(tier)) {
-                auto tierPath = TPath::Resolve(tier, context.GetSSOperationContext()->SS);
+                auto tierPath = TPath::Resolve(tier, ssContext->SS);
                 AFL_VERIFY(tierPath.IsResolved())("path", tier);
-                context.GetSSOperationContext()->SS->PersistExternalDataSourceReference(
-                    *context.GetDB(), tierPath->PathId, TPath::Init(pathId, context.GetSSOperationContext()->SS));
+                ssContext->MemChanges.GrabExternalDataSource(ssContext->SS, tierPath->PathId);
+                ssContext->SS->AddExternalDataSourceReference(
+                    tierPath->PathId, TPath::Init(pathId, ssContext->SS));
+                ssContext->DbChanges.PersistExternalDataSource(tierPath->PathId);
             }
         }
     }
@@ -43,9 +51,15 @@ TConclusionStatus TColumnTableUpdate::DoFinish(const TUpdateFinishContext& conte
     }
 
     const auto pathId = context.GetObjectPath()->Base()->PathId;
-    auto tableInfo = context.GetSSOperationContext()->SS->ColumnTables.TakeAlterVerified(pathId);
-    context.GetSSOperationContext()->SS->PersistColumnTableAlterRemove(*context.GetDB(), pathId);
-    context.GetSSOperationContext()->SS->PersistColumnTable(*context.GetDB(), pathId, *tableInfo);
+    auto* ssContext = context.GetSSOperationContext();
+    {
+        // RAII guard: swaps the table in ColumnTables with its AlterData on scope exit.
+        [[maybe_unused]] auto applyAlterGuard = ssContext->SS->ColumnTables.TakeAlterVerified(pathId);
+    }
+    if (IsAlterPersistent()) {
+        ssContext->DbChanges.PersistColumnTableAlterRemove(pathId);
+    }
+    ssContext->DbChanges.PersistColumnTable(pathId);
     return TConclusionStatus::Success();
 }
 
```

**File**: `ydb/core/tx/schemeshard/olap/operations/alter/common/update.h` (modified, +4/-0)
```diff
@@ -47,6 +47,10 @@ class TColumnTableUpdate: public ISSEntityUpdate {
         return DoInitializeImpl(context);
     }
 
+    bool IsAlterPersistent() const {
+        return !GetShardIds().empty();
+    }
+
     std::shared_ptr<TColumnTableInfo> GetTargetTableInfoVerified() const {
         auto result = GetTargetTableInfo();
         AFL_VERIFY(!!result);
```

**File**: `ydb/core/tx/schemeshard/olap/operations/alter/in_store/common/update.cpp` (modified, +8/-4)
```diff
@@ -9,17 +9,21 @@ NKikimr::TConclusionStatus TInStoreTableUpdate::DoStartImpl(const TUpdateStartCo
 
     auto tableInfo = GetTargetTableInfoVerified();
     const auto storePathId = tableInfo->GetOlapStorePathIdVerified();
-    TPath storePath = TPath::Init(storePathId, context.GetSSOperationContext()->SS);
+    auto* ssContext = context.GetSSOperationContext();
+    TPath storePath = TPath::Init(storePathId, ssContext->SS);
+
+    ssContext->MemChanges.GrabPath(ssContext->SS, storePathId);
+    ssContext->MemChanges.GrabOlapStore(ssContext->SS, storePathId);
 
     Y_ABORT_UNLESS(inStoreTable.GetStoreInfo()->ColumnTables.contains((*context.GetObjectPath())->PathId));
     inStoreTable.GetStoreInfo()->ColumnTablesUnderOperation.insert((*context.GetObjectPath())->PathId);
 
     // Sequentially chain operations in the same olap store
-    if (context.GetSSOperationContext()->SS->Operations.contains(storePath.Base()->LastTxId)) {
-        context.GetSSOperationContext()->OnComplete.Dependence(storePath.Base()->LastTxId, (*context.GetObjectPath())->LastTxId);
+    if (ssContext->SS->Operations.contains(storePath.Base()->LastTxId)) {
+        ssContext->OnComplete.Dependence(storePath.Base()->LastTxId, (*context.GetObjectPath())->LastTxId);
     }
     storePath.Base()->LastTxId = (*context.GetObjectPath())->LastTxId;
-    context.GetSSOperationContext()->SS->PersistLastTxId(*context.GetDB(), storePath.Base());
+    ssContext->DbChanges.PersistPath(storePathId);
     return DoStartInStoreImpl(context);
 }
 
```

**File**: `ydb/core/tx/schemeshard/olap/operations/alter_table.cpp` (modified, +23/-22)
```diff
@@ -111,7 +111,7 @@ class TPropose: public TSubOperationState {
         TUpdateRestoreContext urContext(originalEntity.get(), &context, (ui64)OperationId.GetTxId());
         std::shared_ptr<ISSEntityUpdate> update = originalEntity->RestoreUpdateVerified(urContext);
 
-        TUpdateFinishContext fContext(&objPath, &context, &db, NKikimr::NOlap::TSnapshot(ev->Get()->StepId, ev->Get()->TxId));
+        TUpdateFinishContext fContext(&objPath, &context, NKikimr::NOlap::TSnapshot(ev->Get()->StepId, ev->Get()->TxId));
         update->Finish(fContext).Validate();
 
         auto parentDir = context.SS->PathsById.at(path->ParentPathId);
@@ -308,7 +308,9 @@ class TAlterColumnTable: public TSubOperation {
             return result;
         }
 
-        NIceDb::TNiceDb db(context.GetDB());
+        auto guard = context.DbGuard();
+        context.MemChanges.GrabPath(context.SS, path.Base()->PathId);
+        context.MemChanges.GrabNewTxState(context.SS, OperationId);
 
         if (update->GetShardIds().size()) {
             TTxState& txState = context.SS->CreateTx(OperationId, TTxState::TxAlterColumnTable, path->PathId);
@@ -319,46 +321,45 @@ class TAlterColumnTable: public TSubOperation {
                 auto shardIdx = context.SS->TabletIdToShardIdx.at(tabletId);
 
                 Y_VERIFY_S(context.SS->ShardInfos.contains(shardIdx), "Unknown shardIdx " << shardIdx);
+                context.MemChanges.GrabShard(context.SS, shardIdx);
+                context.DbChanges.PersistShard(shardIdx);
                 txState.Shards.emplace_back(shardIdx, context.SS->ShardInfos[shardIdx].TabletType, TTxState::ConfigureParts);
 
                 context.SS->ShardInfos[shardIdx].CurrentTxId = OperationId.GetTxId();
-                context.SS->PersistShardTx(db, shardIdx, OperationId.GetTxId());
             }
 
             path->LastTxId = OperationId.GetTxId();
             path->PathState = TPathElement::EPathState::EPathStateAlter;
-            context.SS->PersistLastTxId(db, path.Base());
+            context.DbChanges.PersistPath(path.Base()->PathId);
 
             {
-                TUpdateStartContext startContext(&path, &context, &db);
+                TUpdateStartContext startContext(&path, &context);
                 auto status = update->Start(startContext);
                 if (status.IsFail()) {
                     errors.AddError(status.GetErrorMessage());
                     return result;
                 }
             }
-            context.SS->PersistTxState(db, OperationId);
+            context.DbChanges.PersistTxState(OperationId);
 
             context.OnComplete.ActivateTx(OperationId);
 
             SetState(NextState());
         } else {
             {
-                {
-                    TUpdateStartContext startContext(&path, &context, &db);
-                    auto status = update->Start(startContext);
-                    if (status.IsFail()) {
-                        errors.AddError(status.GetErrorMessage());
-                        return result;
-                    }
+                TUpdateStartContext startContext(&path, &context);
+                auto status = update->Start(startContext);
+                if (status.IsFail()) {
+                    errors.AddError(status.GetErrorMessage());
+                    return result;
                 }
-                {
-                    TUpdateFinishContext fContext(&path, &context, &db, {});
-                    auto status = update->Finish(fContext);
-                    if (status.IsFail()) {
-                        errors.AddError(status.GetErrorMessage());
-                        return result;
-                    }
+            }
+            {
+                TUpdateFinishContext fContext(&path, &context, {});
+                auto status = update->Finish(fContext);
+                if (status.IsFail()) {
+                    errors.AddError(status.GetErrorMessage());
+                    return result;
                 }
             }
             const auto& alter = Transaction.GetAlterColumnTable();
@@ -377,8 +378,8 @@ class TAlterColumnTable: public TSubOperation {
         return result;
     }
 
-    void AbortPropose(TProposeContext&) override {
-        Y_ABORT("no AbortPropose for TAlterColumnTable");
+    void AbortPropose(TProposeContext& context) override {
+        YDB_LOG_NOTICE_CTX(context.Ctx, "");
     }
 
     void AbortUnsafe(TTxId forceDropTxId, TOperationContext& context) override {
```

**File**: `ydb/core/tx/schemeshard/olap/table/table.cpp` (modified, +8/-0)
```diff
@@ -90,6 +90,14 @@ TColumnTableInfo::TPtr TColumnTableInfo::BuildTableWithAlter(const TColumnTableI
     return alterData;
 }
 
+TColumnTableInfo::TPtr TColumnTableInfo::Clone() const {
+    auto copy = std::make_shared<TColumnTableInfo>(*this);
+    if (AlterData) {
+        copy->AlterData = AlterData->Clone();
+    }
+    return copy;
+}
+
 void TColumnTableInfo::UpdateShardStats(TDiskSpaceUsageDelta* diskSpaceUsageDelta, const TShardIdx shardIdx, const TPartitionStats& newStats, TInstant now) {
     Stats.Aggregated.PartCount = GetColumnShards().size();
     Stats.PartitionStats[shardIdx]; // insert if none
```

**File**: `ydb/core/tx/schemeshard/olap/table/table.h` (modified, +2/-0)
```diff
@@ -62,6 +62,8 @@ struct TColumnTableInfo {
 
     static TColumnTableInfo::TPtr BuildTableWithAlter(const TColumnTableInfo& initialTable, const NKikimrSchemeOp::TAlterColumnTable& alterBody);
 
+    TPtr Clone() const;
+
     bool IsStandalone() const {
         return !!StandaloneSharding;
     }
```

**File**: `ydb/core/tx/schemeshard/schemeshard__operation_db_changes.cpp` (modified, +10/-0)
```diff
@@ -62,6 +62,16 @@ void TStorageChanges::Apply(TSchemeShard* ss, NTabletFlatExecutor::TTransactionC
         ss->PersistColumnTable(db, pId, *tableInfo.GetPtr(), /* isAlter */ false);
     }
 
+    for (const auto& pId : ColumnTableAlters) {
+        const auto& tableInfo = ss->ColumnTables.GetVerified(pId);
+        Y_ABORT_UNLESS(tableInfo->AlterData);
+        ss->PersistColumnTableAlter(db, pId, *tableInfo->AlterData);
+    }
+
+    for (const auto& pId : ColumnTableAlterRemoves) {
+        ss->PersistColumnTableAlterRemove(db, pId);
+    }
+
     for (const auto& [shardIdx, pId, txId] : SharedShards) {
         ss->PersistAddSharedShard(db, shardIdx, pId);
         if (txId != InvalidTxId) {
```

---

### Incident Patch 9: `d5daa7d2` (2026-10-05)
**Commit Message**: Record DDisk checksum cache memory history (#54947)

**File**: `ydb/core/blobstorage/ddisk/ddisk_actor.cpp` (modified, +2/-0)
```diff
@@ -350,6 +350,7 @@ namespace {
             Become(&TThis::StateFuncDDisk);
             TabletStatsActor = Register(CreateTabletStatsActor(SelfId()));
             RegisterMonPage();
+            InitMemoryMetrics();
             if (!Config.EnableChecksums) {
                 YDB_LOG_NOTICE("TDDiskActor booting with integrity checksums disabled",
                     {"marker", "BSDD55"},
@@ -912,6 +913,7 @@ namespace {
             return;
         }
         Stopping = true;
+        MemoryMetric.Close();
         PersistentBufferRegistrationTokens.clear();
         Become(&TThis::StateFuncStopping);
         YDB_LOG_NOTICE("DDisk stopping", {"DDiskId", DDiskId}, {"reason", reason});
```

**File**: `ydb/core/blobstorage/ddisk/ddisk_actor.h` (modified, +6/-0)
```diff
@@ -18,6 +18,7 @@
 #include <ydb/core/blobstorage/pdisk/blobstorage_pdisk.h>
 
 #include <ydb/library/actors/core/mon.h>
+#include <ydb/library/actors/core/subsystems/metric_system.h>
 #include <ydb/library/actors/wilson/wilson_span.h>
 #include <ydb/library/wilson_ids/wilson.h>
 
@@ -510,6 +511,7 @@ namespace NKikimr::NDDisk {
             WakeupCollectPbStats = 3,
             WakeupProcessPersistentBufferBatchWrite = 4,
             WakeupProcessDeallocatePersistentBufferChunk = 5,
+            WakeupCollectMemoryMetrics = 6,
         };
 
         struct TPbOpSnapshot {
@@ -526,6 +528,10 @@ namespace NKikimr::NDDisk {
 
         void CollectPbStatsSnapshot();
 
+        TLine<TRawLineFrontend<ui64>> MemoryMetric;
+        void InitMemoryMetrics();
+        void CollectMemoryMetrics();
+
         const bool IsPersistentBufferActor = false;
 
         // Actor-thread-only health state. I/O callbacks communicate status/data exclusively
```

**File**: `ydb/core/blobstorage/ddisk/ddisk_actor_mon.cpp` (modified, +25/-0)
```diff
@@ -16,6 +16,31 @@
 
 namespace NKikimr::NDDisk {
 
+void TDDiskActor::InitMemoryMetrics() {
+    if (auto* metrics = GetMetricSystem()) {
+        const std::array<TLabel, 3> labels = {{
+            {.Name = "pdisk", .Value = ToString(BaseInfo.PDiskId)},
+            {.Name = "slot", .Value = ToString(BaseInfo.VDiskSlotId)},
+            {.Name = "incarnation", .Value = SelfId().ToString()},
+        }};
+        MemoryMetric = metrics->CreateLine("ddisk.memory.checksum_cache_estimated_bytes", labels);
+        CollectMemoryMetrics();
+    }
+}
+
+void TDDiskActor::CollectMemoryMetrics() {
+    if (Stopping || !MemoryMetric) {
+        return;
+    }
+    // Before PDisk initialization the enabled checksum cache size is not known yet.
+    if (!Config.EnableChecksums) {
+        MemoryMetric.Append(0);
+    } else if (IntegrityManager) {
+        MemoryMetric.Append(IntegrityManager->CachedBlockStates() * TIntegrityManager::BlockStateApproxBytes);
+    }
+    Schedule(TDuration::Seconds(1), new TEvents::TEvWakeup(EWakeupTag::WakeupCollectMemoryMetrics));
+}
+
 namespace {
 
 TString FormatDuration(TDuration v) {
```

**File**: `ydb/core/blobstorage/ddisk/ddisk_actor_read_write.cpp` (modified, +4/-0)
```diff
@@ -816,6 +816,10 @@ namespace NKikimr::NDDisk {
 
     void TDDiskActor::HandleWakeup(TEvents::TEvWakeup::TPtr &ev) {
         switch (ev->Get()->Tag) {
+            case EWakeupTag::WakeupCollectMemoryMetrics: {
+                CollectMemoryMetrics();
+                break;
+            }
             case EWakeupTag::WakeupUpdateFreeSpaceInfo: {
                 UpdateFreeSpaceInfo();
                 break;
```

**File**: `ydb/core/blobstorage/ddisk/ut/ddisk_actor_ut.cpp` (modified, +100/-1)
```diff
@@ -13,6 +13,7 @@
 #include <ydb/core/blobstorage/pdisk/blobstorage_pdisk_data.h>
 #include <ydb/core/blobstorage/vdisk/common/vdisk_config.h>
 #include <ydb/core/util/actorsys_test/testactorsys.h>
+#include <ydb/library/actors/core/subsystems/inmemory_metrics.h>
 #include <ydb/core/node_whiteboard/node_whiteboard.h>
 #include <ydb/core/protos/blobstorage_ddisk_internal.pb.h>
 
@@ -86,10 +87,18 @@ class TTestContext {
     std::set<TActorId> PDiskServiceIds;
     std::unique_ptr<TEventHandle<NPDisk::TEvChunkReserve>> HeldBootstrapRefill;
 
-    TTestContext()
+    explicit TTestContext(bool memoryMetrics = false)
         : Runtime(1)
         , Counters(MakeIntrusive<::NMonitoring::TDynamicCounters>())
     {
+        if (memoryMetrics) {
+            Runtime.SetupNodeSubSystems = [](ui32, TActorSystemSetup* setup) {
+                setup->RegisterSubSystem(MakeInMemoryMetricsRegistry({
+                    .MemoryBytes = 128ull << 10, .MaxLines = 8,
+                    .AllowedMetricPrefixes = {"ddisk."},
+                }));
+            };
+        }
         Runtime.Start();
         Edge = Runtime.AllocateEdgeActor(NodeId, __FILE__, __LINE__);
     }
@@ -4299,6 +4308,96 @@ Y_UNIT_TEST_SUITE(TDDiskActorTest) {
         }
     }
 
+    Y_UNIT_TEST(ChecksumCacheMemoryHistory) {
+        for (bool checksums : {false, true}) {
+            TTestContext ctx(true);
+            ctx.Runtime.RegisterService(MakeBlobStorageNodeWardenID(NodeId), ctx.Edge);
+            const auto disk = ctx.CreateDDisk(6, 1, std::nullopt, {.EnableChecksums = checksums});
+            const auto creds = Connect(ctx, disk.ServiceId, 229, 1);
+            auto* registry = GetInMemoryMetrics(*ctx.Runtime.GetNode(NodeId)->ActorSystem);
+            const auto snapshot = [&] {
+                UNIT_ASSERT(registry->RequestSnapshot(ctx.Edge));
+                return WaitFromDDisk<TEvInMemoryMetricsSnapshot>(ctx);
+            };
+            const auto tick = [&] {
+                ctx.Runtime.Schedule(TDuration::MilliSeconds(1100),
+                    new IEventHandle(ctx.Edge, ctx.Edge, new TEvents::TEvWakeup()), nullptr, NodeId);
+                WaitFromDDisk<TEvents::TEvWakeup>(ctx);
+            };
+            // Flush registration; use the actual periodic timer rather than injecting samples.
+            snapshot();
+            tick();
+            size_t initialSamples = 0;
+            ui32 lineId = 0;
+            snapshot()->Get()->Snapshot.Read([&](const TSnapshotView& view) {
+                UNIT_ASSERT_VALUES_EQUAL(view.LinesSize(), 1);
+                const auto& line = view.GetLine(0);
+                UNIT_ASSERT_VALUES_EQUAL(line.Name, "ddisk.memory.checksum_cache_estimated_bytes");
+                UNIT_ASSERT(!line.Closed);
+                lineId = line.LineId;
+                const auto values = line.ReadValuesAs<ui64>();
+                initialSamples = values.size();
+                UNIT_ASSERT(initialSamples);
+                UNIT_ASSERT_VALUES_EQUAL(values.back(), 0);
+            });
+            auto write = DoWriteWithChunkAllocation(ctx, disk,
+                MakeWrite(creds, 0, 0, MakeData('A', BlockSize)),
+                disk.FirstChunkId + PersistentBufferInitChunks, 0, MakeData('A', BlockSize), true, true);
+            AssertStatus(write.WriteResult, TReplyStatus::OK);
+            tick();
+            size_t samples = 0;
+            const ui64 expected = checksums ? NDDisk::TIntegrityManager::BlockStateApproxBytes : 0;
+            snapshot()->Get()->Snapshot.Read([&](const TSnapshotView& view) {
+                UNIT_ASSERT_VALUES_EQUAL(view.LinesSize(), 1);
+                const auto& line = view.GetLine(0);
+                UNIT_ASSERT_VALUES_EQUAL(line.LineId, lineId);
+                const auto values = line.ReadValuesAs<ui64>();
+                samples = values.size();
+                UNIT_ASSERT_VALUES_EQUAL(samples, initialSamples + 1);
+                UNIT_ASSERT_VALUES_EQUAL(values.front(), 0);
+                UNIT_ASSERT_VALUES_EQUAL(values.back(), expected);
+            });
+            SendToDDisk(ctx, disk.ServiceId, new TEvents::TEvPoison());
+            WaitFromDDisk<TEvents::TEvGone>(ctx);
+            tick();
+            snapshot()->Get()->Snapshot.Read([&](const TSnapshotView& view) {
+                UNIT_ASSERT_VALUES_EQUAL(view.LinesSize(), 1);
+                const auto& line = view.GetLine(0);
+                UNIT_ASSERT_VALUES_EQUAL(line.LineId, lineId);
+                UNIT_ASSERT(line.Closed);
+                const auto values = line.ReadValuesAs<ui64>();
+                UNIT_ASSERT_VALUES_EQUAL(values.size(), samples);
+                UNIT_ASSERT_VALUES_EQUAL(values.back(), expected);
+            });
+        }
+    }
+
+    Y_UNIT_TEST(ChecksumCacheMemoryHistoryDuringInitialization) {
+        for (bool checksums : {false, true}) {
+            TTestContext ctx(true);
+            const auto disk = ctx.RegisterDDisk(6, 1, std::nullopt, {.E
```

---

### Incident Patch 10: `e29b8f6d` (2026-10-05)
**Commit Message**: fix build (#55122)

**File**: `ydb/library/yql/providers/pq/async_io/dq_pq_read_actor.cpp` (modified, +1/-1)
```diff
@@ -1118,7 +1118,7 @@ class TDqPqReadActor : public TActor<TDqPqReadActor>, public NYql::NDq::NInterna
                 Self.Send(Self.ComputeActorId, new TEvAsyncInputError(Self.InputIndex, TIssues({TIssue(message)}), NYql::NDqProto::StatusIds::SCHEME_ERROR));
                 return;
             }
-            event.Confirm();
+            event.PartitionControl->ConfirmExhausted();
         }
 
         void operator()(NFq::TMessageStreamPartitionStatusEvent& event) {
```

---

### Incident Patch 11: `6744d62c` (2026-10-05)
**Commit Message**: Fix leaked locks of not proposed transactions (#54223)

Co-authored-by: Kirill Vasilenko <[REDACTED_EMAIL]>

**File**: `ydb/core/tx/columnshard/columnshard.cpp` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ void TColumnShard::TrySwitchToWork(const TActorContext& ctx) {
         return;
     }
     ProgressTxController->OnTabletInit();
+    AbortNotProposedTransactions();
     {
         const TLogContextGuard gLogging = NActors::TLogContextBuilder::Build(NKikimrServices::TX_COLUMNSHARD)("tablet_id", TabletID())(
             "self_id", SelfId())("process", "SwitchToWork");
```

**File**: `ydb/core/tx/columnshard/columnshard__locks.cpp` (modified, +11/-1)
```diff
@@ -40,12 +40,22 @@ void TColumnShard::SubscribeLockIfNotAlready(const ui64 lockId, const ui32 lockN
 }
 
 void TColumnShard::TransactionToAbort(const ui64 lockId) {
-    if (auto lock = OperationsManager->GetLockOptional(lockId)) {
+    if (auto lock = OperationsManager->GetLockOptional(lockId); lock && !lock->IsTxIdAssigned()) {
         lock->SetNeedsAborting();
         MaybeAbortTransaction(lockId);
     }
 }
 
+void TColumnShard::AbortNotProposedTransactions() {
+    for (const ui64 lockId : OperationsManager->GetLockIdsOfNotProposedTransactions()) {
+        YDB_LOG_WARN_COMP(NKikimrServices::TX_COLUMNSHARD_TX, "",
+            {"event", "abort_not_proposed_transaction"},
+            {"tabletId", TabletID()},
+            {"lockId", lockId});
+        TransactionToAbort(lockId);
+    }
+}
+
 void TColumnShard::MaybeAbortTransaction(const ui64 lockId) {
     auto lock = OperationsManager->GetLockOptional(lockId);
     if (!lock || !lock->ReadyForAborting() || lock->IsTxIdAssigned()) {
```

**File**: `ydb/core/tx/columnshard/columnshard__write.cpp` (modified, +42/-39)
```diff
@@ -340,11 +340,12 @@ class TProposeWriteTransaction: public TExtendedTransactionBase {
     std::shared_ptr<TTxController::ITransactionOperator> TxOperator;
 };
 
-void TColumnShard::ProposeTransaction(std::shared_ptr<TCommitOperation> op, const TActorId source, const ui64 cookie) {
-    if (auto lock = OperationsManager->GetLockOptional(op->GetLockId()); lock) {
-        lock->SetTxId(op->GetTxId());
+bool TColumnShard::ProposeTransaction(std::shared_ptr<TCommitOperation> op, const TActorId source, const ui64 cookie) {
+    if (auto lock = OperationsManager->GetLockOptional(op->GetLockId()); lock && !lock->TryProposeTransaction(op->GetTxId())) {
+        return false;
     }
     Execute(new TProposeWriteTransaction(this, op, source, cookie));
+    return true;
 }
 
 void TColumnShard::Handle(NEvents::TDataEvents::TEvWrite::TPtr& ev, const TActorContext& ctx) {
@@ -448,45 +449,47 @@ void TColumnShard::Handle(NEvents::TDataEvents::TEvWrite::TPtr& ev, const TActor
         auto conclusionParse = commitOperation->Parse(*ev->Get());
         if (conclusionParse.IsFail()) {
             sendError(conclusionParse.GetErrorMessage(), NKikimrDataEvents::TEvWriteResult::STATUS_BAD_REQUEST, 0, 0, "CommitWriteLock", true);
-        } else {
-            auto* lockInfo = OperationsManager->GetLockOptional(commitOperation->GetLockId());
-            if (!lockInfo) {
-                sendError("missing lock for commit: " + ::ToString(commitOperation->GetLockId()),
+            return;
+        }
+        auto* lockInfo = OperationsManager->GetLockOptional(commitOperation->GetLockId());
+        if (!lockInfo) {
+            sendError("missing lock for commit: " + ::ToString(commitOperation->GetLockId()),
+                NKikimrDataEvents::TEvWriteResult::STATUS_LOCKS_BROKEN, 0, 0, "CommitWriteLock", true);
+            return;
+        }
+        THashSet<TSchemeShardLocalPathId> schemeShardLocalPathIds;
+        for (const auto& op : lockInfo->GetWriteOperations()) {
+            schemeShardLocalPathIds.insert(op->GetPathId().GetSchemeShardLocalPathId());
+        }
+        for (const auto& ev : lockInfo->GetEvents()) {
+            schemeShardLocalPathIds.insert(ev->GetPathId().GetSchemeShardLocalPathId());
+        }
+        for (const auto& p : schemeShardLocalPathIds) {
+            if (!TablesManager.ResolveInternalPathId(p, false)) {
+                //Table is renamed or dropped
+                sendError(
+                    "unknown table: " + ::ToString(p), NKikimrDataEvents::TEvWriteResult::STATUS_SCHEME_CHANGED, 0, 0, "CommitWriteLock", true);
+                return;
+            }
+        }
+        if (commitOperation->NeedSyncLocks()) {
+            if (lockInfo->GetGeneration() != commitOperation->GetGeneration()) {
+                sendError("tablet lock have another generation: " + ::ToString(lockInfo->GetGeneration()) +
+                              " != " + ::ToString(commitOperation->GetGeneration()), NKikimrDataEvents::TEvWriteResult::STATUS_LOCKS_BROKEN, 0,
+                    0, "CommitWriteLock", true);
+                return;
+            }
+            if (lockInfo->GetInternalGenerationCounter() != commitOperation->GetInternalGenerationCounter()) {
+                sendError("tablet lock have another internal generation counter: " + ::ToString(lockInfo->GetInternalGenerationCounter()) +
+                              " != " + ::ToString(commitOperation->GetInternalGenerationCounter()),
                     NKikimrDataEvents::TEvWriteResult::STATUS_LOCKS_BROKEN, 0, 0, "CommitWriteLock", true);
-            } else {
-                THashSet<TSchemeShardLocalPathId> schemeShardLocalPathIds;
-                for (const auto& op : lockInfo->GetWriteOperations()) {
-                    schemeShardLocalPathIds.insert(op->GetPathId().GetSchemeShardLocalPathId());
-                }
-                for (const auto& ev : lockInfo->GetEvents()) {
-                    schemeShardLocalPathIds.insert(ev->GetPathId().GetSchemeShardLocalPathId());
-                }
-                for (const auto& p : schemeShardLocalPathIds) {
-                    if (!TablesManager.ResolveInternalPathId(p, false)) {
-                        //Table is renamed or dropped
-                        sendError("unknown table: " + ::ToString(p), NKikimrDataEvents::TEvWriteResult::STATUS_SCHEME_CHANGED, 0, 0,
-                            "CommitWriteLock", true);
-                        return;
-                    }
-                }
-                if (commitOperation->NeedSyncLocks()) {
-                    if (lockInfo->GetGeneration() != commitOperation->GetGeneration()) {
-                        sendError("tablet lock have another generation: " + ::ToString(lockInfo->GetGeneration()) +
-                                      " != " + ::ToString(commitOperation->GetGeneration()),
-                            NKikimrDataEvents::TEvWriteResult::STATUS_LOCKS_BROKEN, 0, 0, "CommitWriteLock", true);
-             
```

**File**: `ydb/core/tx/columnshard/columnshard_impl.cpp` (modified, +4/-0)
```diff
@@ -1014,6 +1014,10 @@ void TColumnShard::SetupCleanupTables(const NOlap::ISnapshotHolders& snapshotHol
                 ("event", "CleanupTableMetadataDeferredByActiveScan")("path_id", pathId)("drop_snapshot", dropSnapshot.DebugString());
                 continue;
             }
+            if (OperationsManager->HasWriteOperations(pathId)) {
+                AFL_DEBUG(NKikimrServices::TX_COLUMNSHARD)("event", "CleanupTableMetadataDeferredByWriteOperations")("path_id", pathId);
+                continue;
+            }
             pathIdsToCleanup.insert(pathId);
         }
     }
```

**File**: `ydb/core/tx/columnshard/columnshard_impl.h` (modified, +2/-1)
```diff
@@ -349,8 +349,9 @@ class TColumnShard: public TActor<TColumnShard>, public NTabletFlatExecutor::TTa
     void Handle(TEvColumnShard::TEvOverloadUnsubscribe::TPtr& ev, const TActorContext& ctx);
     void Handle(NLongTxService::TEvLongTxService::TEvLockStatus::TPtr& ev, const TActorContext& ctx);
     void SubscribeLockIfNotAlready(const ui64 lockId, const ui32 lockNodeId) const;
-    void ProposeTransaction(std::shared_ptr<TCommitOperation> op, const TActorId source, const ui64 cookie);
+    [[nodiscard]] bool ProposeTransaction(std::shared_ptr<TCommitOperation> op, const TActorId source, const ui64 cookie);
     void TransactionToAbort(const ui64 lockId);
+    void AbortNotProposedTransactions();
     void MaybeAbortTransaction(const ui64 lockId);
     void CancelTransaction(const ui64 txId);
 
```

**File**: `ydb/core/tx/columnshard/engines/column_engine_logs.h` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ class TColumnEngineForLogs: public IColumnEngine {
 
     virtual bool HasDataInPathId(const TInternalPathId pathId) const override {
         auto g = GetGranuleOptional(pathId);
-        return g && g->GetPortions().size();
+        return g && (g->GetPortions().size() || g->GetInsertedPortions().size());
     }
 
     bool IsGranuleExists(const TInternalPathId pathId) const {
```

**File**: `ydb/core/tx/columnshard/engines/storage/granule/granule.h` (modified, +1/-1)
```diff
@@ -356,7 +356,7 @@ class TGranuleMeta: TNonCopyable {
     }
 
     bool IsErasable() const {
-        return Portions.empty();
+        return Portions.empty() && InsertedPortions.empty();
     }
 
     void OnCompactionStarted();
```

**File**: `ydb/core/tx/columnshard/normalizer/abstract/abstract.h` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ enum class ENormalizerSequentialId: ui32 {
     RestoreV0ChunksMeta,
     CopyBlobIdsToV2,
     RestoreAppearanceSnapshot,
+    CleanOrphanedOperations,
 
     MAX
 };
```

---

### Incident Patch 12: `379c2070` (2026-10-05)
**Commit Message**: Fix vdisk quota tracking (#55037)

**File**: `ydb/apps/dstool/lib/common.py` (modified, +17/-0)
```diff
@@ -295,6 +295,23 @@ def get_vslot_owner_weight(group_size_in_units, pdisk_slot_size_in_units):
     return int(vu / pu) + (1 if (vu % pu) else 0)
 
 
+def get_vslot_quota(group_size_in_units, pdisk_slot_size_in_units, slot_size,
+                    expected_slot_size=0, user_chunk_pool_size=None):
+    if expected_slot_size:
+        quota = (slot_size or expected_slot_size) * max(1, group_size_in_units)
+        return min(quota, user_chunk_pool_size) if user_chunk_pool_size is not None else quota
+    return slot_size * get_vslot_owner_weight(group_size_in_units, pdisk_slot_size_in_units)
+
+
+def get_vslot_quota_from_pdisk(group_size_in_units, pdisk):
+    metrics = pdisk.PDiskMetrics
+    _, slot_size_in_units = get_pdisk_inferred_settings(pdisk)
+    return get_vslot_quota(
+        group_size_in_units, slot_size_in_units, metrics.EnforcedDynamicSlotSize,
+        pdisk.ExpectedSlotSize,
+        metrics.UserChunkPoolSize if metrics.HasField('UserChunkPoolSize') else None)
+
+
 class Location(typing.NamedTuple):
     dc: int
     room: int
```

**File**: `ydb/apps/dstool/lib/dstool_cmd_group_list.py` (modified, +10/-4)
```diff
@@ -111,6 +111,9 @@ def _convert_legacy_storage_state(data):
         pdisk.id.pdisk_id = source.PDiskId
         _, pdisk.slot_size_in_units = common.get_pdisk_inferred_settings(source)
         pdisk.enforced_dynamic_slot_size = source.PDiskMetrics.EnforcedDynamicSlotSize
+        pdisk.expected_slot_size = source.ExpectedSlotSize
+        if source.PDiskMetrics.HasField('UserChunkPoolSize'):
+            pdisk.user_chunk_pool_size = source.PDiskMetrics.UserChunkPoolSize
 
     return result
 
@@ -268,9 +271,11 @@ def do(args):
 
         pdisk = pdisk_map.get((vdisk.slot_id.node_id, vdisk.slot_id.pdisk_id))
         vdisk_slot_size = 0
-        if pdisk is not None and pdisk.enforced_dynamic_slot_size > 0:
-            weight = common.get_vslot_owner_weight(group.size_in_units, pdisk.slot_size_in_units)
-            vdisk_slot_size = pdisk.enforced_dynamic_slot_size * weight
+        if pdisk is not None:
+            vdisk_slot_size = common.get_vslot_quota(
+                group.size_in_units, pdisk.slot_size_in_units, pdisk.enforced_dynamic_slot_size,
+                pdisk.expected_slot_size,
+                pdisk.user_chunk_pool_size if pdisk.HasField('user_chunk_pool_size') else None)
             group_stat['Limit'] += vdisk_slot_size
 
         # Aggregate capacity metrics - use max values
@@ -285,8 +290,9 @@ def do(args):
             #
             # Formula matches blobstorage_pdisk_keeper.h GetVDiskRawUsage()
             #   VDiskRawUsage = 100.0 * (used / hardLimit)
-            # Per blobstorage_pdisk_impl.cpp TPDisk::WhiteboardReport(), EnforcedDynamicSlotSize is calculated as:
+            # For slot-weight-based quotas, TPDisk::WhiteboardReport() uses:
             #   EnforcedDynamicSlotSize = min(HardLimit / Weight) across all owners
+            # Fixed quotas instead scale by group units and are capped by the user chunk pool.
             #
             vdisk_raw_usage = vdisk.allocated_size / vdisk_slot_size
             group_stat['VDiskRawUsage'] = max(group_stat['VDiskRawUsage'] or 0, vdisk_raw_usage)
```

**File**: `ydb/apps/dstool/lib/dstool_cmd_pool_list.py` (modified, +2/-6)
```diff
@@ -38,9 +38,7 @@ def calculate_estimated_usage(pdisk_map, vslot_map, groups):
 
             pdisk = pdisk_map[pdisk_id]
             vslot_used_sizes.append(vslot.VDiskMetrics.AllocatedSize)
-            _, pdisk_slot_size_in_units = common.get_pdisk_inferred_settings(pdisk)
-            weight = common.get_vslot_owner_weight(group.GroupSizeInUnits, pdisk_slot_size_in_units)
-            vslot_fair_size = pdisk.PDiskMetrics.EnforcedDynamicSlotSize * weight
+            vslot_fair_size = common.get_vslot_quota_from_pdisk(group.GroupSizeInUnits, pdisk)
             vslot_fair_sizes.append(vslot_fair_size)
 
         min_vslot_fair_size = apply_func(min, vslot_fair_sizes)
@@ -185,9 +183,7 @@ def do(args):
         pdisk = pdisk_map.get(common.get_pdisk_id(vslot.VSlotId))
         vdisk_slot_size = None
         if pdisk is not None:
-            _, pdisk_slot_size_in_units = common.get_pdisk_inferred_settings(pdisk)
-            weight = common.get_vslot_owner_weight(group.GroupSizeInUnits, pdisk_slot_size_in_units)
-            vdisk_slot_size = pdisk.PDiskMetrics.EnforcedDynamicSlotSize * weight
+            vdisk_slot_size = common.get_vslot_quota_from_pdisk(group.GroupSizeInUnits, pdisk)
 
         if vdisk_slot_size is not None:
             vslots['Limit'] = vslots.get('Limit', 0) + vdisk_slot_size
```

**File**: `ydb/apps/dstool/lib/dstool_cmd_vdisk_list.py` (modified, +3/-3)
```diff
@@ -124,8 +124,7 @@ def do(args):
             _, row['PDiskSlotSizeInUnits'] = common.get_pdisk_inferred_settings(pdisk)
             row['UsedSize'] = vslot.VDiskMetrics.AllocatedSize
             row['AvailableSize'] = vslot.VDiskMetrics.AvailableSize
-            weight = common.get_vslot_owner_weight(row['GroupSizeInUnits'], row['PDiskSlotSizeInUnits'])
-            row['SlotSize'] = pdisk.PDiskMetrics.EnforcedDynamicSlotSize * weight
+            row['SlotSize'] = common.get_vslot_quota_from_pdisk(row['GroupSizeInUnits'], pdisk)
             row['TotalSize'] = row['UsedSize'] + row['AvailableSize']
             row['VDiskSlotUsage'] = None
             row['VDiskRawUsage'] = None
@@ -143,8 +142,9 @@ def do(args):
                 #
                 # Formula matches blobstorage_pdisk_keeper.h GetVDiskRawUsage()
                 #   VDiskRawUsage = 100.0 * (used / hardLimit)
-                # Per blobstorage_pdisk_impl.cpp TPDisk::WhiteboardReport(), EnforcedDynamicSlotSize is calculated as:
+                # For slot-weight-based quotas, TPDisk::WhiteboardReport() uses:
                 #   EnforcedDynamicSlotSize = min(HardLimit / Weight) across all owners
+                # Fixed quotas instead scale by group units and are capped by the user chunk pool.
                 #
                 row['VDiskRawUsage'] = row['UsedSize'] / row['SlotSize']
 
```

**File**: `ydb/apps/dstool/lib/ut/test_capacity_metrics.py` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+from types import SimpleNamespace
+
+import pytest
+
+from ydb.apps.dstool.lib import common, table
+from ydb.apps.dstool.lib import dstool_cmd_group_list as group_list
+from ydb.apps.dstool.lib import dstool_cmd_pool_list as pool_list
+from ydb.apps.dstool.lib import dstool_cmd_vdisk_list as vdisk_list
+
+
+@pytest.mark.parametrize(
+    'command, use_grpc',
+    [(vdisk_list, False), (group_list, False), (pool_list, False), (group_list, True)],
+    ids=['vdisk', 'group', 'pool', 'group-grpc'])
+@pytest.mark.parametrize('group_size_in_units', [0, 1, 3, 20])
+@pytest.mark.parametrize('expected_slot_size', [0, 101])
+@pytest.mark.parametrize('slot_size_in_units', [0, 2, 5])
+@pytest.mark.parametrize('enforced_slot_size', [0, 96])
+@pytest.mark.parametrize('user_chunk_pool_size', [None, 0, 200])
+def test_rounded_slot_size_in_list(command, use_grpc, group_size_in_units, expected_slot_size,
+                                   slot_size_in_units, enforced_slot_size, user_chunk_pool_size, monkeypatch):
+    base_config = common.kikimr_bsconfig.TBaseConfig()
+    base_config.Node.add(NodeId=1).HostKey.Fqdn = 'node-1'
+    pdisk = base_config.PDisk.add(NodeId=1, PDiskId=1, ExpectedSlotSize=expected_slot_size)
+    pdisk.PDiskMetrics.EnforcedDynamicSlotSize = enforced_slot_size
+    pdisk.PDiskMetrics.TotalSize = 1800
+    if user_chunk_pool_size is not None:
+        pdisk.PDiskMetrics.UserChunkPoolSize = user_chunk_pool_size
+    pdisk.PDiskMetrics.ExpectedSlotCount = 10
+    pdisk.PDiskMetrics.SlotSizeInUnits = slot_size_in_units
+    group = base_config.Group.add(GroupId=0x80000001, GroupSizeInUnits=group_size_in_units,
+                                  BoxId=1, StoragePoolId=1)
+    vslot = base_config.VSlot.add(GroupId=group.GroupId, Status='READY')
+    vslot.VSlotId.NodeId = 1
+    vslot.VSlotId.PDiskId = 1
+    vslot.VSlotId.VSlotId = 1
+    group.VSlotId.add().CopyFrom(vslot.VSlotId)
+    units = max(1, group_size_in_units)
+    if expected_slot_size:
+        rounded_quota = (enforced_slot_size or expected_slot_size) * units
+        if user_chunk_pool_size is not None:
+            rounded_quota = min(rounded_quota, user_chunk_pool_size)
+    else:
+        slot_units = max(1, slot_size_in_units)
+        rounded_quota = enforced_slot_size * ((units + slot_units - 1) // slot_units)
+    vslot.VDiskMetrics.AllocatedSize = 24
+    vslot.VDiskMetrics.AvailableSize = max(0, rounded_quota - 24)
+    storage_pool = common.kikimr_bsconfig.TDefineStoragePool(BoxId=1, StoragePoolId=1, Name='pool')
+    data = {'BaseConfig': base_config, 'StoragePools': [storage_pool]}
+    monkeypatch.setattr(common, 'fetch_base_config_and_storage_pools', lambda **kwargs: data)
+    monkeypatch.setattr(common, 'has_explicit_grpc_endpoints', lambda: use_grpc)
+    monkeypatch.setattr(common, 'fetch_storage_state', lambda **kwargs: group_list._convert_legacy_storage_state(data))
+    rows = []
+    monkeypatch.setattr(table.TableOutput, 'dump', lambda self, result, args: rows.extend(result))
+    command.do(SimpleNamespace(show_pdisk_status=False, show_vdisk_usage=True, show_vdisk_status=False,
+                               show_group_status=False, show_vdisk_estimated_usage=True, all_columns=False,
+                               virtual_groups_only=False))
+
+    assert len(rows) == 1
+    row = rows[0]
+    assert row['SlotSize' if command is vdisk_list else 'Limit'] == rounded_quota
+    assert row['UsedSize'] == 24
+    assert row['AvailableSize'] == max(0, rounded_quota - 24)
+    if command is pool_list:
+        assert row['EstimatedUsage'] == (pytest.approx(24 / rounded_quota) if rounded_quota else 0.0)
+    else:
+        assert row['VDiskRawUsage'] == (pytest.approx(24 / rounded_quota) if rounded_quota else None)
```

**File**: `ydb/apps/dstool/lib/ut/test_cluster_balance.py` (modified, +64/-0)
```diff
@@ -226,3 +226,67 @@ def invoke(request):
     assert [r.Rollback for r in requests] == ([True, True, dry_run] if failed_command_index is None else [True, True])
     if failed_command_index is None:
         assert requests[1].Command == requests[2].Command
+
+
+@pytest.mark.parametrize('expected_slot_size', [0, 100])
+@pytest.mark.parametrize('slot_size_in_units, expected_usage', [(0, 4), (1, 4), (2, 2), (3, 2)])
+def test_fixed_quota_preserves_weighted_slot_usage(
+        inferred_settings_strategy, expected_slot_size, slot_size_in_units, expected_usage):
+    base_config = balance.common.fetch_base_config()
+    disk = base_config.PDisk[0]
+    for group in base_config.Group:
+        group.GroupSizeInUnits = 2
+    disk.ExpectedSlotSize = expected_slot_size
+    disk.PDiskConfig.SlotSizeInUnits = slot_size_in_units
+    assert balance.common.build_pdisk_usage_map(base_config)[1, 1] == expected_usage
+
+
+@pytest.mark.parametrize('source_slot_size', [0, 100])
+@pytest.mark.parametrize('destination_slot_size', [0, 100])
+@pytest.mark.parametrize('destination_units, accepted', [(0, False), (1, False), (2, True)])
+def test_multi_unit_group_reassignment_to_last_slot(
+        inferred_settings_strategy, monkeypatch, source_slot_size, destination_slot_size, destination_units, accepted):
+    strategy = inferred_settings_strategy
+    base_config = balance.common.fetch_base_config()
+    for group in base_config.Group:
+        group.GroupSizeInUnits = 2
+    base_config.PDisk[0].ExpectedSlotSize = source_slot_size
+    destination = base_config.PDisk[1]
+    destination.ExpectedSlotSize = destination_slot_size
+    destination.ExpectedSlotCount = 1
+    destination.PDiskConfig.SlotSizeInUnits = destination_units
+    strategy.cluster_info = balance.ClusterInfo.collect_cluster_info()
+    strategy.calculate_extra_info()
+    requests = []
+
+    def invoke(request):
+        requests.append(request.Rollback)
+        return response_to(3)
+
+    monkeypatch.setattr(balance.common, 'invoke_bsc_request', invoke)
+    assert strategy.reassign_vslot(base_config.VSlot[0], False) == accepted
+    assert requests == ([True, False] if accepted else [True])
+
+
+@pytest.mark.parametrize('slot_size', [0, 100])
+@pytest.mark.parametrize('donor_slot_size', [0, 100])
+@pytest.mark.parametrize('count_donors', [False, True])
+def test_donor_weight_uses_its_pdisk_capacity_model(
+        inferred_settings_strategy, slot_size, donor_slot_size, count_donors):
+    base_config = balance.common.fetch_base_config()
+    for group in base_config.Group:
+        group.GroupSizeInUnits = 5
+    disk, donor_disk = base_config.PDisk
+    disk.ExpectedSlotSize = slot_size
+    disk.PDiskConfig.SlotSizeInUnits = 2
+    donor_disk.ExpectedSlotSize = donor_slot_size
+    donor_disk.PDiskConfig.SlotSizeInUnits = 4
+    donor_disk.NumStaticSlots = 1
+    donor = base_config.VSlot[0].Donors.add()
+    donor.VSlotId.NodeId = donor_disk.NodeId
+    donor.VSlotId.PDiskId = donor_disk.PDiskId
+    donor.VSlotId.VSlotId = 1
+
+    usage = balance.common.build_pdisk_usage_map(base_config, count_donors=count_donors)
+    assert usage[1, 1] == 6
+    assert usage[3, 1] == 1 + (2 if count_donors else 0)
```

**File**: `ydb/apps/dstool/lib/ut/ya.make` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ PY3TEST()
 SIZE(SMALL)
 
 TEST_SRCS(
+    test_capacity_metrics.py
     test_connection_tokens.py
     test_nbs_dbg_like_load.py
     test_cluster_balance.py
```

**File**: `ydb/core/blobstorage/nodewarden/blobstorage_node_warden_ut.cpp` (modified, +88/-5)
```diff
@@ -1318,6 +1318,30 @@ Y_UNIT_TEST_SUITE(TBlobStorageWardenTest) {
         }
     }
 
+    CUSTOM_UNIT_TEST(UseFixedVDiskSlotSizeInference) {
+        auto config = MakeIntrusive<TPDiskConfig>("fake_drive", ui64{0}, ui32{0}, ui64{0});
+        for (const auto& [driveSize, expectedSlots, expectedUnits] : std::vector<std::tuple<ui64, ui32, ui32>>{
+                {999, 0, 1}, {1000, 1, 1}, {1500, 1, 1}, {7900, 7, 1}, {16000, 16, 1},
+                {24000, 16, 1}, {38000, 16, 2}, {48000, 16, 3}, {77000, 16, 4}}) {
+            NStorage::TNodeWarden::InferPDiskSlotCount(config, driveSize, 1000, 16, false);
+            const ui32 originalSlots = config->ExpectedSlotCount;
+            const ui32 originalUnits = config->SlotSizeInUnits;
+            for (bool enabled : {true, false, true, false}) {
+                NStorage::TNodeWarden::InferPDiskSlotCount(config, driveSize, 1000, 16, enabled);
+                UNIT_ASSERT_VALUES_EQUAL(config->ExpectedSlotCount, enabled ? expectedSlots : originalSlots);
+                UNIT_ASSERT_VALUES_EQUAL(config->ExpectedSlotSize, enabled ? 1000 : 0);
+                UNIT_ASSERT_VALUES_EQUAL(config->SlotSizeInUnits, enabled ? expectedUnits : originalUnits);
+            }
+        }
+        // 7.6 TB / 200 GB: the control changes 10 four-unit slots to 16 two-unit slots.
+        NStorage::TNodeWarden::InferPDiskSlotCount(config, 7'600'000'000'000, 200'000'000'000, 16, false);
+        UNIT_ASSERT_VALUES_EQUAL(config->ExpectedSlotCount, 10);
+        UNIT_ASSERT_VALUES_EQUAL(config->SlotSizeInUnits, 4);
+        NStorage::TNodeWarden::InferPDiskSlotCount(config, 7'600'000'000'000, 200'000'000'000, 16, true);
+        UNIT_ASSERT_VALUES_EQUAL(config->ExpectedSlotCount, 16);
+        UNIT_ASSERT_VALUES_EQUAL(config->SlotSizeInUnits, 2);
+    }
+
     CUSTOM_UNIT_TEST(TestInferPDiskSlotCountPureFunction) {
         TestInferPDiskSlotCount(7900, 1000, 16, 8, 1u, 0.0125);
         TestInferPDiskSlotCount(8000, 1000, 16, 8, 1u, std::numeric_limits<double>::epsilon());
@@ -1360,7 +1384,7 @@ Y_UNIT_TEST_SUITE(TBlobStorageWardenTest) {
     void CheckInferredPDiskSettings(TTestBasicRuntime& runtime, TActorId fakeWhiteboard,
             TActorId fakeNodeWarden, ui32 pdiskId, ui32 expectedSlotCount, ui32 expectedSlotSizeInUnits,
             std::optional<ui64> expectedSlotSize = std::nullopt,
-            TDuration simTimeout = TDuration::Seconds(10)) {
+            TDuration simTimeout = TDuration::Seconds(10), bool waitForSettings = false) {
         const int maxAttempts = 10;
         for (int attempt = 1; attempt <= maxAttempts; ++attempt) {
             // Check EvPDiskStateUpdate sent from PDiskActor to Whiteboard
@@ -1373,6 +1397,12 @@ Y_UNIT_TEST_SUITE(TBlobStorageWardenTest) {
                 UNIT_ASSERT_LT_C(attempt, maxAttempts, "last attempt failed");
                 continue;
             }
+            if (waitForSettings && (pdiskInfo.GetExpectedSlotCount() != expectedSlotCount
+                    || pdiskInfo.GetSlotSizeInUnits() != expectedSlotSizeInUnits
+                    || pdiskInfo.GetExpectedSlotSize() != expectedSlotSize.value_or(0))) {
+                UNIT_ASSERT_LT_C(attempt, maxAttempts, "PDisk settings did not reach Whiteboard");
+                continue;
+            }
             UNIT_ASSERT(pdiskInfo.HasExpectedSlotCount());
             UNIT_ASSERT(pdiskInfo.HasSlotSizeInUnits());
             UNIT_ASSERT(pdiskInfo.HasAvailableSize());
@@ -1403,17 +1433,24 @@ Y_UNIT_TEST_SUITE(TBlobStorageWardenTest) {
                 UNIT_ASSERT_LT_C(attempt, maxAttempts, "last attempt failed");
                 continue;
             }
+            if (waitForSettings && (metrics.GetExpectedSlotCount() != expectedSlotCount
+                    || metrics.GetSlotSizeInUnits() != expectedSlotSizeInUnits
+                    || metrics.GetExpectedSlotSize() != expectedSlotSize.value_or(0))) {
+                UNIT_ASSERT_LT_C(attempt, maxAttempts, "PDisk settings did not reach NodeWarden metrics");
+                continue;
+            }
             // metrics are replaced as a whole on the receiving side, so zero values are
-            // reported by omitting the field
-            UNIT_ASSERT_VALUES_EQUAL(metrics.HasExpectedSlotCount(), expectedSlotCount != 0);
+            // reported by omitting the field, except ExpectedSlotCount with fixed quotas.
+            UNIT_ASSERT_VALUES_EQUAL(metrics.HasExpectedSlotCount(), expectedSlotCount != 0 || expectedSlotSize.value_or(0) != 0);
             UNIT_ASSERT(metrics.HasSlotSizeInUnits());
             UNIT_ASSERT_VALUES_EQUAL(metrics.GetExpectedSlotCount(), expectedSlotCount);
             UNIT_ASSERT_VALUES_EQUAL(metrics.GetSlotSizeInUnits(), expectedSlotSizeInUnits);
-            if (expectedSlotSize) {
+            if (expectedSlotSize.value_or(0)) {
                 UNIT_ASSERT(metrics.HasExpectedSlotSize());
                 UNIT_ASSERT_VALUES_EQUAL(metrics.GetExpectedSlotSize(), *expectedSlotS
```

---

### Incident Patch 13: `abe5014d` (2026-10-05)
**Commit Message**: add a way to trigger move data from hive developer ui (#54690)

**File**: `ydb/core/mind/hive/hive.h` (modified, +6/-0)
```diff
@@ -270,6 +270,12 @@ struct IReassignCallback {
     virtual ~IReassignCallback() = default;
 };
 
+struct IMoveDataCallback {
+    virtual IEventBase* MakeEvent(bool success, ui64 tabletsDone) = 0;
+
+    virtual ~IMoveDataCallback() = default;
+};
+
 TResourceNormalizedValues NormalizeRawValues(const TResourceRawValues& values, const TResourceRawValues& maximum);
 NMetrics::EResource GetDominantResourceType(const TResourceRawValues& values, const TResourceRawValues& maximum);
 NMetrics::EResource GetDominantResourceType(const TResourceNormalizedValues& normValues);
```

**File**: `ydb/core/mind/hive/hive_impl.cpp` (modified, +13/-1)
```diff
@@ -4664,6 +4664,18 @@ bool THive::ReassignInactiveGroups(TStoragePoolInfo& pool) {
 }
 
 bool THive::MoveDataInactiveGroups(TStoragePoolInfo& pool) {
+    struct TShrinkPoolMoveDataCallback : IMoveDataCallback {
+        TString PoolName;
+
+        virtual IEventBase* MakeEvent(bool success, ui64) override {
+            return new TEvPrivate::TEvMoveDataComplete(PoolName, success);
+        }
+
+        TShrinkPoolMoveDataCallback(const TString& poolName)
+            : PoolName(poolName)
+        {}
+    };
+
     std::unordered_set<TStorageGroupId> inactiveGroups(pool.InactiveGroups.begin(), pool.InactiveGroups.end());
     std::vector<TTabletId> tabletsToMoveData;
     if (pool.RemainingHistory.empty()) {
@@ -4698,7 +4710,7 @@ bool THive::MoveDataInactiveGroups(TStoragePoolInfo& pool) {
             {"tabletsToMoveDataCount", tabletsToMoveData.size()},
             {"remainingHistoryCount", pool.RemainingHistory.size()});
         UpdateCounterShrinkRemainingHistory();
-        StartMoveDataActor(std::move(tabletsToMoveData), pool.InactiveGroups, pool.Name);
+        StartMoveDataActor(std::move(tabletsToMoveData), pool.InactiveGroups, SelfId(), 1, TStringBuilder() << "shrink pool " << pool.Name, std::make_unique<TShrinkPoolMoveDataCallback>(pool.Name), true);
         return true;
     }
 }
```

**File**: `ydb/core/mind/hive/hive_impl.h` (modified, +2/-1)
```diff
@@ -250,6 +250,7 @@ class THive : public TActor<THive>, public TTabletExecutedFlat, public THiveShar
     friend class TTxConfigureScaleRecommender;
     friend class TTxProcessBootQueue;
     friend class TTxUnlockTabletExecution;
+    friend class TTxMonEvent_MoveData;
 
     friend class TDeleteTabletActor;
 
@@ -265,7 +266,7 @@ class THive : public TActor<THive>, public TTabletExecutedFlat, public THiveShar
     void StartReassignActor(std::vector<TReassignOperation> operations, const TActorId& source, ui32 maxInFlight, TString description, std::unique_ptr<IReassignCallback> callback);
     // continues reassigns of tablets that were left in the middle of it (e.g. by a Hive restart)
     void ContinueInterruptedReassigns(std::vector<TReassignOperation> operations);
-    void StartMoveDataActor(std::vector<TTabletId> tablets, const std::vector<TStorageGroupId>& groups, const TString& poolName);
+    void StartMoveDataActor(std::vector<TTabletId> tablets, const std::vector<TStorageGroupId>& groups, const TActorId& source, ui32 maxInFlight, TString description, std::unique_ptr<IMoveDataCallback> callback, bool fastFail);
     void CreateEvMonitoring(NMon::TEvRemoteHttpInfo::TPtr& ev, const TActorContext& ctx);
     NJson::TJsonValue GetBalancerProgressJson();
     ITransaction* CreateDeleteTablet(TEvHive::TEvDeleteTablet::TPtr& ev);
```

**File**: `ydb/core/mind/hive/monitoring.cpp` (modified, +270/-0)
```diff
@@ -1791,6 +1791,9 @@ class TTxMonEvent_Landing : public TTransactionBase<THive> {
         out << "<button type='button' class='btn btn-info' data-toggle='modal' data-target='#reassign-groups' style='width:138px'>Reassign Groups</button>";
         out << "</div>";
         out << "<div class='col-sm-1 col-md-1' style='text-align:center'>";
+        out << "<button type='button' class='btn btn-info' data-toggle='modal' data-target='#move-data' style='width:138px'>Move Data</button>";
+        out << "</div>";
+        out << "<div class='col-sm-1 col-md-1' style='text-align:center'>";
         out << "<button type='button' class='btn btn-info' onclick='location.href=\"?TabletID=" << Self->HiveId << "&page=Subactors\";' style='width:138px'>SubActors</button>";
         out << "</div>";
         out << "<div class='col-sm-1 col-md-1' style='text-align:center'>";
@@ -1943,6 +1946,70 @@ class TTxMonEvent_Landing : public TTransactionBase<THive> {
                </div>
                )___";
 
+        out << R"___(
+               <div class='modal fade' id='move-data' role='dialog'>
+                   <div class='modal-dialog' style='width:60%'>
+                       <div class='modal-content'>
+                           <div class='modal-header'>
+                               <button type='button' class='close' data-dismiss='modal'>&times;</button>
+                               <h4 class='modal-title'>Move Tablets Data</h4>
+                           </div>
+                           <div class='modal-body'>
+                               <div class='row'>
+                                   <div class='col-md-12'>
+                                       <p>Makes tablets that still reference the given groups in their channels history rewrite all their data into the current groups of their channels,
+                                          then restarts them so the old history entries could be cut.
+                                          Tablets whose current group is one of the given groups are not affected: reassign them first.</p>
+                                   </div>
+                               </div>
+                               <div class='row'>
+                                   <div class='col-md-5'>
+                                       <label for='move_data_groups'>Storage groups</label>
+                                       <div class='input-group' style='width:100%'>
+                                           <input id='move_data_groups' type='text' class='form-control' placeholder='group id[,group id...]'>
+                                       </div>
+                                   </div>
+                                   <div class='col-md-4'>
+                                       <label for='move_data_storage_pool'>Storage pool (optional)</label>
+                                       <div class='input-group' style='width:100%'>
+                                           <input id='move_data_storage_pool' type='text' class='form-control'>
+                                       </div>
+                                   </div>
+                                   <div class='col-md-3'>
+                                       <label for='move_data_inflight'>Inflight</label>
+                                       <div class='input-group'>
+                                           <input id='move_data_inflight' type='number' value='1' min='1' max='10' class='form-control'>
+                                           <span class='input-group-addon'>1-10</span>
+                                       </div>
+                                   </div>
+                               </div>
+                               <div class='row' style='margin-top:20px'>
+                                   <div class='col-md-3'>
+                                       <label>Tablets found</label>
+                                       <div><span id='move_data_tablets_found'>-</span></div>
+                                   </div>
+                                   <div class='col-md-3'>
+                                       <div id='move_data_confirm_group' style='visibility:hidden'>
+                                           <label for='move_data_confirm'>Confirm number of tablets</label>
+                                           <input id='move_data_confirm' type='number' class='form-control'>
+                                       </div>
+                                   </div>
+                                   <div class='col-md-6'>
+                                       <h4>Running: <a id='move_data_subactors' href='#'>SubActors</a></h4>
+                                   </div>
+                               </div>
+                           </div>
+                           <div class='modal-footer'>
+                               <span id='move_data_status' style='float:left'></span>
+                               <button id='move_dat
```

**File**: `ydb/core/mind/hive/move_data_actor.cpp` (modified, +47/-15)
```diff
@@ -22,19 +22,26 @@ class TMoveDataActor
     std::vector<TTabletId> Tablets;
     std::vector<TTabletId>::const_iterator NextTablet;
     std::vector<TStorageGroupId> Groups;
-    TString PoolName;
+    const TActorId Source;
+    const TString Description;
+    std::unique_ptr<IMoveDataCallback> Callback;
     std::vector<TPipeClient> PipeClients;
     i64 MoveDataInFlight = 0;
     // Sends, not iterator position: NextTablet is advanced before SendMoveData in one caller and after in the other.
     size_t SentCount = 0;
+    ui64 TabletsDone = 0;
+    bool FastFail;
     THive* Hive;
 
-    TMoveDataActor(std::vector<TTabletId> tablets, const std::vector<TStorageGroupId>& groups, const TString& poolName, ui64 maxInFlight, THive* hive)
+    TMoveDataActor(std::vector<TTabletId> tablets, const std::vector<TStorageGroupId>& groups, const TActorId& source, ui64 maxInFlight, TString description, std::unique_ptr<IMoveDataCallback> callback, bool fastFail, THive* hive)
         : Tablets(std::move(tablets))
         , NextTablet(Tablets.begin())
         , Groups(groups)
-        , PoolName(poolName)
-        , PipeClients(maxInFlight)
+        , Source(source)
+        , Description(std::move(description))
+        , Callback(std::move(callback))
+        , PipeClients(std::max<ui64>(maxInFlight, 1))
+        , FastFail(fastFail)
         , Hive(hive)
     {
     }
@@ -54,7 +61,14 @@ class TMoveDataActor
     }
 
     TString GetDescription() const override {
-        return TStringBuilder() << "MoveData(" << PoolName << ")";
+        return TStringBuilder() << "MoveData(" << Description << "): " << TabletsDone << "/" << Tablets.size();
+    }
+
+    void ReplyAndPassAway(bool success) {
+        if (Source && Callback) {
+            Send(Source, Callback->MakeEvent(success, TabletsDone));
+        }
+        return PassAway();
     }
 
     size_t Queued() const {
@@ -71,7 +85,7 @@ class TMoveDataActor
         ++SentCount;
         Hive->OnShrinkMoveDataSent(MoveDataInFlight, Queued());
         YDB_LOG_NOTICE("ShrinkPool: MoveData sent",
-            {"pool", PoolName},
+            {"description", Description},
             {"tablet", tablet},
             {"sent", SentCount},
             {"total", Tablets.size()},
@@ -81,8 +95,7 @@ class TMoveDataActor
 
     void CheckCompletion() {
         if (MoveDataInFlight == 0 && NextTablet == Tablets.end()) {
-            Send(Hive->SelfId(), new TEvPrivate::TEvMoveDataComplete(PoolName, true));
-            return PassAway();
+            return ReplyAndPassAway(true);
         }
     }
 
@@ -99,15 +112,21 @@ class TMoveDataActor
         for (size_t i = 0; i < PipeClients.size(); ++i) {
             if (PipeClients[i].Tablet == tablet) {
                 NTabletPipe::CloseClient(SelfId(), PipeClients[i].Client);
+                PipeClients[i].Tablet = 0;
                 --MoveDataInFlight;
                 Hive->OnShrinkMoveDataAnswered(MoveDataInFlight, Queued());
                 YDB_LOG_NOTICE("ShrinkPool: MoveData answered",
-                    {"pool", PoolName},
+                    {"description", Description},
                     {"tablet", tablet},
                     {"status", (ui32)ev->Get()->Record.GetStatus()},
                     {"queued", Queued()},
                     {"inFlight", MoveDataInFlight});
-                Hive->Execute(Hive->CreateRestartTablet(ToFullTabletId(tablet)));
+                if (ev->Get()->Record.GetStatus() == NKikimrTabletBase::TEvMoveDataResponse::Success) {
+                    ++TabletsDone;
+                    Hive->Execute(Hive->CreateRestartTablet(ToFullTabletId(tablet)));
+                } else if (FastFail) {
+                    return ReplyAndPassAway(false);
+                }
                 if (NextTablet != Tablets.end()) {
                     SendMoveData(i, *(NextTablet++));
                     break;
@@ -120,8 +139,21 @@ class TMoveDataActor
     void Handle(TEvTabletPipe::TEvClientConnected::TPtr& ev) {
         if (ev->Get()->Status != NKikimrProto::OK) {
             if (ev->Get()->Dead) {
-                Send(Hive->SelfId(), new TEvPrivate::TEvMoveDataComplete(PoolName, false));
-                return PassAway();
+                if (FastFail) {
+                    return ReplyAndPassAway(false);
+                } else {
+                    for (size_t i = 0; i < PipeClients.size(); ++i) {
+                        if (PipeClients[i].Tablet == ev->Get()->TabletId) {
+                            NTabletPipe::CloseClient(SelfId(), PipeClients[i].Client);
+                            PipeClients[i].Tablet = 0;
+                            --MoveDataInFlight;
+                            if (NextTablet != Tablets.end()) {
+                                SendMoveData(i, *(NextTablet++));
+                            }
+                            break;
+                        }
+                    }
+                }
             } else {
                 Retry(ev->Get()->TabletI
```

**File**: `ydb/core/protos/counters_hive.proto` (modified, +1/-0)
```diff
@@ -201,4 +201,5 @@ enum ETxTypes {
     TXTYPE_SHRINK_POOL = 71                               [(TxTypeOpts) = {Name: "TxShrinkPool"}];
     TXTYPE_SHRINK_POOL_REPLY = 72                         [(TxTypeOpts) = {Name: "TxShrinkPoolReply"}];
     TXTYPE_MON_SHRINK_POOL = 73                           [(TxTypeOpts) = {Name: "TxMonShrinkPool"}];
+    TXTYPE_MON_MOVE_DATA = 74                             [(TxTypeOpts) = {Name: "TxMonMoveData"}];
 }
```

---

### Incident Patch 14: `262d994a` (2026-10-05)
**Commit Message**: Fix uninitialized value (#55107)

Co-authored-by: Oleg Geller <[REDACTED_EMAIL]>

**File**: `ydb/tests/olap/load/lib/tpcc.py` (modified, +1/-1)
```diff
@@ -206,8 +206,8 @@ def test(self):
             'warmup_seconds': summary.get('warmup_seconds', ''),
         }
         deviation = DeviationCheckResult()
+        run_type = f'ydb_cli_{str(self.tx_mode).replace("-rw", "")}_{getenv("TPCC_RUN_TYPE", "default")}'
         if result.success and 'tpcc_json' in stats:
-            run_type = f'ydb_cli_{str(self.tx_mode).replace("-rw", "")}_{getenv("TPCC_RUN_TYPE", "default")}'
             # Read the baseline before the upload, so that the current run is not part of it.
             deviation = check_tpcc_deviation(stats['tpcc_json'], run_type, result.start_time)
             # Results are stored regardless of the deviation check outcome.
```

---

### Incident Patch 15: `3269492a` (2026-10-05)
**Commit Message**: docs: replace remaining Embedded UI mentions with YDB UI preset (#54685)

Co-authored-by: Stepan Beloyarov <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `ydb/docs/en/core/devops/configuration-management/configuration-v1/state-storage-reconfiguration.md` (modified, +1/-1)
```diff
@@ -145,4 +145,4 @@ config:
 
 ## Checking the result {#verify-result}
 
-You can verify that the changes have been applied in the `CMS` section of the cluster's Embedded UI (available on port 8765): go to the `Tablets` tab and check the replicas of the metadata subsystem tablets to make sure the configuration has been picked up.
+You can verify that the changes have been applied in the `CMS` section of the cluster [{{ ydb-ui-name }}](../../../reference/ydb-ui/index.md) (available on port 8765): go to the `Tablets` tab and check the replicas of the metadata subsystem tablets to make sure the configuration has been picked up.
```

**File**: `ydb/docs/en/core/devops/configuration-management/configuration-v2/node-removal.md` (modified, +3/-3)
```diff
@@ -19,7 +19,7 @@ After stopping the process, check the **Nodes** tab on the [cluster monitoring p
 
 Static nodes serve the storage system and are listed in the [`hosts`](../../../reference/configuration/hosts.md) section. A static node can contain [VDisks](../../../concepts/glossary.md#vdisk) of [dynamic](../../../concepts/glossary.md#dynamic-group) and [static](../../../concepts/glossary.md#static-group) groups, as well as [State Storage](../../../concepts/glossary.md#state-storage), [Board](../../../concepts/glossary.md#board), and [SchemeBoard](../../../concepts/glossary.md#scheme-board) replicas. These resources must be moved before the node is removed from the configuration.
 
-Before starting the procedure, use the [Embedded UI](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page) to check that the affected storage groups are healthy, that is, all VDisks of these groups are shown in the `Ok` state (highlighted in green), with none in `Error` or `Degraded` state.
+Before starting the procedure, use the [{{ ydb-ui-name }}](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page) to check that the affected storage groups are healthy, that is, all VDisks of these groups are shown in the `Ok` state (highlighted in green), with none in `Error` or `Degraded` state.
 
 The remaining nodes must have enough free [PDisk](../../../concepts/glossary.md#pdisk) space and slots for all VDisks from the node being removed. VDisk placement across [failure domains](../../../concepts/glossary.md#fail-domain) and [failure realms](../../../concepts/glossary.md#fail-realm) must comply with the configured [erasure coding scheme](../../../concepts/glossary.md#erasure-coding) to preserve group fault tolerance after node removal. For details on calculating the required capacity margin, see [{#T}](../../concepts/capacity-planning.md#hardware-estimation).
 
@@ -52,7 +52,7 @@ To remove a static node:
 
     The command runs in the foreground. Wait for it to complete successfully, then verify that data relocation is complete in the next step. For details, see [Move VDisks from a broken/missing block store volume](../../../maintenance/manual/moving_vdisks.md#removal_from_a_broken_device).
 
-1. In the [Embedded UI](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page), check that no VDisks remain on the node and that the affected storage groups are healthy (all VDisks are in the `Ok` state). If State Storage, Board, or SchemeBoard replicas were moved from the node, [check that the relocation is complete](../../concepts/selfheal-metadata-distribution.md#verify-result).
+1. In the [{{ ydb-ui-name }}](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page), check that no VDisks remain on the node and that the affected storage groups are healthy (all VDisks are in the `Ok` state). If State Storage, Board, or SchemeBoard replicas were moved from the node, [check that the relocation is complete](../../concepts/selfheal-metadata-distribution.md#verify-result).
 1. Fetch the current cluster configuration using the [ydb admin cluster config fetch](../../../reference/ydb-cli/commands/configuration/cluster/fetch.md) command:
 
     ```bash
@@ -106,7 +106,7 @@ To remove a static node:
     failed to remove PDisk# 1:1 as it has active VSlots
     ```
 
-    In this case, wait for SelfHeal to move the remaining VDisks. Relocation time depends on the amount of data and disk performance. Monitor the relocation on the **Storage** tab of the node being removed in the [Embedded UI](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page). When no VDisks remain on the node, rerun the `config replace` command with the same file.
+    In this case, wait for SelfHeal to move the remaining VDisks. Relocation time depends on the amount of data and disk performance. Monitor the relocation on the **Storage** tab of the node being removed in the [{{ ydb-ui-name }}](../../../reference/ydb-ui/ydb-monitoring.md#node_storage_page). When no VDisks remain on the node, rerun the `config replace` command with the same file.
 
     If the VDisk list is not shrinking and replication is not in progress, [move the remaining VDisks manually](../../../maintenance/manual/moving_vdisks.md#removal_from_a_broken_device).
 
```

**File**: `ydb/docs/en/core/devops/configuration-management/configuration-v2/state-storage-reconfiguration.md` (modified, +1/-1)
```diff
@@ -162,4 +162,4 @@ config:
 
 ## Verifying the result {#verify-result}
 
-You can verify that the changes have been applied in the `CMS` section of the cluster's Embedded UI (available on port 8765): go to the `Tablets` tab and check the replicas of the metadata subsystem tablets to confirm that the configuration has been picked up.
+You can verify that the changes have been applied in the `CMS` section of the cluster [{{ ydb-ui-name }}](../../../reference/ydb-ui/index.md) (available on port 8765): go to the `Tablets` tab and check the replicas of the metadata subsystem tablets to confirm that the configuration has been picked up.
```

**File**: `ydb/docs/en/core/security/authorization.md` (modified, +5/-5)
```diff
@@ -124,11 +124,11 @@ For operations where both [access control lists](../concepts/glossary.md#access-
 
 ### Access level hierarchy
 
-Access level lists form a hierarchy used in [Embedded UI](../reference/ydb-ui/ydb-monitoring.md), viewer, and many other cluster-wide actions (ordered from least to most privileges):
+Access level lists form a hierarchy used in [{{ ydb-ui-name }}](../reference/ydb-ui/ydb-monitoring.md), viewer, and many other cluster-wide actions (ordered from least to most privileges):
 
 - `database_allowed_sids` (`Database`) - access to operations in the context of a specific database.
 - `viewer_allowed_sids` (`Viewer`) - access to viewing cluster-wide state.
-- `monitoring_allowed_sids` (`Monitoring`) - access to operational actions in Embedded UI.
+- `monitoring_allowed_sids` (`Monitoring`) - access to operational actions in {{ ydb-ui-name }}.
 - `administration_allowed_sids` (`Administration`) - administrative actions on the cluster and databases.
 
 A higher level automatically includes all lower ones, so a subject only needs to be present in one list. For example, being in `administration_allowed_sids` automatically grants privileges `monitoring`, `viewer`, and `database`.
@@ -143,9 +143,9 @@ Additionally, there are two separate access level lists for specific operations:
 
 Access level lists are configured in the [security configuration](../reference/configuration/security_config.md#security-access-levels) and define privileges for:
 
-- **Database** (included in `database_allowed_sids`) — access only in the context of a specific database. You can open Embedded UI and work with the data of this database, but you cannot run cluster-wide queries (for example, view the list of cluster nodes). Queries without specifying a database are prohibited.
-- **Viewer** (included in `viewer_allowed_sids`) — read-only access to the cluster-wide state: you can view [Embedded UI](../reference/ydb-ui/ydb-monitoring.md) pages and diagnostic information, but you cannot run actions that change the system state.
-- **Monitoring** (included in `monitoring_allowed_sids`) — access to operational actions in Embedded UI, including actions that can change the system state. For example, starting a backup, restoring a database, or running YQL queries through Embedded UI.
+- **Database** (included in `database_allowed_sids`) — access only in the context of a specific database. You can open {{ ydb-ui-name }} and work with the data of this database, but you cannot run cluster-wide queries (for example, view the list of cluster nodes). Queries without specifying a database are prohibited.
+- **Viewer** (included in `viewer_allowed_sids`) — read-only access to the cluster-wide state: you can view [{{ ydb-ui-name }}](../reference/ydb-ui/ydb-monitoring.md) pages and diagnostic information, but you cannot run actions that change the system state.
+- **Monitoring** (included in `monitoring_allowed_sids`) — access to operational actions in {{ ydb-ui-name }}, including actions that can change the system state. For example, starting a backup, restoring a database, or running YQL queries through {{ ydb-ui-name }}.
 - **Administration** (included in `administration_allowed_sids`) — grants the right to perform administrative actions on databases or the cluster. Full administrative access to the cluster and its databases. Also used for changing configuration, schema operations that require administrative rights, and other administrative checks.
 - **Register node** (included in `register_dynamic_node_allowed_sids`) — a separate (non-hierarchical) level for registering dynamic nodes in the cluster. It does not automatically grant `database`/`viewer`/`monitoring`/`administration` rights. For technical reasons, if the list is specified (not empty), it must include `root@builtin`.
 - **Bootstrap** (included in `bootstrap_allowed_sids`) — a separate (non-hierarchical) level only for cluster initialization operations. Used in an uninitialized state when the authentication subsystem is not yet functioning. Initialization is allowed if the subject is in `bootstrap_allowed_sids` or `administration_allowed_sids`, while `bootstrap` itself does not grant full administrative privileges.
```

**File**: `ydb/docs/en/core/yql/reference/syntax/create-resource-pool-classifier.md` (modified, +4/-4)
```diff
@@ -91,14 +91,14 @@ The `HAS_APP_NAME` value is set by the client and is not authenticated by the se
 
 Setting the application identifier on the client:
 
-- **{{ ydb-short-name }} Embedded UI** — fixed value `ydb-ui`, set by the viewer and not user-configurable.
+- **{{ ydb-ui-name }}** — fixed value `ydb-ui`, set by {{ ydb-ui-name }} and not user-configurable.
 - **YDB CLI** — not supported: the client application identifier is not sent in requests.
 - **YDB C++ SDK** — per request via the `Header` parameter of [`TRequestSettings`](https://github.com/ydb-platform/ydb/blob/main/ydb/public/sdk/cpp/include/ydb-cpp-sdk/client/types/request_settings.h): `settings.Header({{ NYdb::YDB_APPLICATION_NAME, "my-app" }})`, where the [`YDB_APPLICATION_NAME`](https://github.com/ydb-platform/ydb/blob/main/ydb/public/sdk/cpp/include/ydb-cpp-sdk/client/resources/ydb_resources.h) constant equals `x-ydb-application-name`.
 - **YDB Go SDK** — at the driver level via the [`WithApplicationName`](https://github.com/ydb-platform/ydb-go-sdk/blob/v3.151.1/options.go#L163) option in the `ydb.Open` call.
 - **YDB Java SDK** — at the transport level via the [`GrpcTransportBuilder.withApplicationName`](https://github.com/ydb-platform/ydb-java-sdk/blob/v2.4.11/core/src/main/java/tech/ydb/core/grpc/GrpcTransportBuilder.java#L280) method.
 - **YDB Python SDK** — no dedicated parameter; the value is set per request via a generic header: `settings.with_header("x-ydb-application-name", "my-app")` (the [`BaseRequestSettings.with_header`](https://github.com/ydb-platform/ydb-python-sdk/blob/3.31.4/ydb/settings.py#L66) method).
 
-**Example.** Direct requests from the Embedded UI to the `pool_adhoc` pool:
+**Example.** Direct requests from {{ ydb-ui-name }} to the `pool_adhoc` pool:
 
 ```yql
 CREATE RESOURCE POOL CLASSIFIER cl_adhoc_ui WITH (
@@ -178,7 +178,7 @@ GRANT 'USE' ON `/my_db` TO `user1@domain`;
 
 ## Examples {#examples}
 
-Below is a combined example that composes several classifiers and predicates: rejecting full scans of archive tables, isolating streaming requests, and dedicating a pool for interactive admin queries from the Embedded UI.
+Below is a combined example that composes several classifiers and predicates: rejecting full scans of archive tables, isolating streaming requests, and dedicating a pool for interactive admin queries from {{ ydb-ui-name }}.
 
 Creating resource pools:
 
@@ -209,7 +209,7 @@ CREATE RESOURCE POOL CLASSIFIER cl_stream WITH (
     HAS_STREAM=true
 );
 
--- Admin requests from the Embedded UI — into the interactive-queries pool.
+-- Admin requests from YDB UI — into the interactive-queries pool.
 -- AND condition: both MEMBER_NAME and HAS_APP_NAME must match.
 CREATE RESOURCE POOL CLASSIFIER cl_adhoc_admin WITH (
     RANK=300,
```

**File**: `ydb/docs/ru/core/yql/reference/syntax/create-resource-pool-classifier.md` (modified, +4/-4)
```diff
@@ -91,14 +91,14 @@ CREATE RESOURCE POOL CLASSIFIER cl_archive WITH (
 
 Установка идентификатора приложения в клиенте:
 
-- **{{ ydb-short-name }} Embedded UI** — фиксированное значение `ydb-ui`, задаётся Embedded UI и не настраивается пользователем.
+- **{{ ydb-ui-name }}** — фиксированное значение `ydb-ui`, задаётся {{ ydb-ui-name }} и не настраивается пользователем.
 - **YDB CLI** — не поддерживается: идентификатор клиентского приложения в запросе не отправляется.
 - **YDB C++ SDK** — на каждом запросе через параметр `Header` настроек [`TRequestSettings`](https://github.com/ydb-platform/ydb/blob/main/ydb/public/sdk/cpp/include/ydb-cpp-sdk/client/types/request_settings.h): `settings.Header({{ NYdb::YDB_APPLICATION_NAME, "my-app" }})`, где константа [`YDB_APPLICATION_NAME`](https://github.com/ydb-platform/ydb/blob/main/ydb/public/sdk/cpp/include/ydb-cpp-sdk/client/resources/ydb_resources.h) равна `x-ydb-application-name`.
 - **YDB Go SDK** — на драйвере через опцию [`WithApplicationName`](https://github.com/ydb-platform/ydb-go-sdk/blob/v3.151.1/options.go#L163) в вызове `ydb.Open`.
 - **YDB Java SDK** — на транспорте через метод [`GrpcTransportBuilder.withApplicationName`](https://github.com/ydb-platform/ydb-java-sdk/blob/v2.4.11/core/src/main/java/tech/ydb/core/grpc/GrpcTransportBuilder.java#L280).
 - **YDB Python SDK** — отдельного параметра нет; значение задаётся на каждом запросе через дополнительный заголовок: `settings.with_header("x-ydb-application-name", "my-app")` (метод [`BaseRequestSettings.with_header`](https://github.com/ydb-platform/ydb-python-sdk/blob/3.31.4/ydb/settings.py#L66)).
 
-**Пример.** Направить запросы от Embedded UI в пул `pool_adhoc`:
+**Пример.** Направить запросы от {{ ydb-ui-name }} в пул `pool_adhoc`:
 
 ```yql
 CREATE RESOURCE POOL CLASSIFIER cl_adhoc_ui WITH (
@@ -178,7 +178,7 @@ GRANT 'USE' ON `/my_db` TO `user1@domain`;
 
 ## Примеры {#examples}
 
-Ниже — сводный пример, комбинирующий несколько классификаторов и предикатов: отклонение полных сканов архивных таблиц, изоляция стриминговых запросов и выделение пула под интерактивные запросы админа из Embedded UI.
+Ниже — сводный пример, комбинирующий несколько классификаторов и предикатов: отклонение полных сканов архивных таблиц, изоляция стриминговых запросов и выделение пула под интерактивные запросы админа из {{ ydb-ui-name }}.
 
 Создание ресурсных пулов:
 
@@ -209,7 +209,7 @@ CREATE RESOURCE POOL CLASSIFIER cl_stream WITH (
     HAS_STREAM=true
 );
 
--- Запросы админа из Embedded UI — в пул интерактивных запросов.
+-- Запросы админа из YDB UI — в пул интерактивных запросов.
 -- Условие AND: и MEMBER_NAME, и HAS_APP_NAME должны совпасть.
 CREATE RESOURCE POOL CLASSIFIER cl_adhoc_admin WITH (
     RANK=300,
```

#### Recent Merged Pull Requests:
- **PR #55261** (2026-10-06): Update muted_ya (relwithdebinfo) in stable-26-2-1 (@ydbot)
- **PR #55260** (2026-10-06): Update muted_ya (relwithdebinfo) in stable-25-3-1 (@ydbot)
- **PR #55259** (2026-10-06): Update muted_ya (relwithdebinfo) in stable-25-4-1 (@ydbot)
- **PR #55257** (2026-10-06): Update muted_ya (release-asan) in stable-26-3-1 (@ydbot)
- **PR #55254** (2026-10-06): Update muted_ya (release-asan) in stable-26-3-1 (@ydbot)
- **PR #55253** (2026-10-06): Update muted_ya (relwithdebinfo) in main (@ydbot)
- **PR #55252** (2026-10-06): Update muted_ya (release-asan) in main (@ydbot)
- **PR #55251** (2026-10-06): Update muted_ya (relwithdebinfo) in stable-25-3-1 (@ydbot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
