# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin/matrixone

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "a5140aa8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T00:52:09.159Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `a5140aa8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T00:52:09.159Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin/matrixone` (Commit: `a5140aa8`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T00:52:07.902Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2068 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/python/examples/example_20_sqlalchemy_engine_integration.py`
```
#!/usr/bin/env python3

# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Example 20: SQLAlchemy Engine Integration - Comprehensive SQLAlchemy Engine Operations

MatrixOne SQLAlchemy Engine Integration Example

This example demonstrates how to use MatrixOne Client and AsyncClient
with existing SQLAlchemy engines, making it easy to integrate MatrixOne
into existing SQLAlchemy-based projects.
"""

import asyncio
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
from matrixone import Client, AsyncClient
from matrixone.config import get_connection_params, print_config
from matrixone.logger import create_default_logger

# Create MatrixOne logger for all logging
logger = create_default_logger(sql_log_mode="auto")


class SQLAlchemyEngineIntegrationDemo:
    """Demonstrates SQLAlchemy engine integration capabilities with comprehensive testing."""

    def __init__(self):
        self.logger = create_default_logger(sql_log_mode="auto")
        self.results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'unexpected_results': [],
            'engine_integration_performance': {},
        }

    def test_sync_engine_integration(self):
        """Test sync SQLAlchemy engine integration"""
        print("\n=== Sync SQLAlchemy Engine Integration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test sync engine integration
            self.logger.info("Test: Sync SQLAlchemy Engine Integration")
            try:
                # Create SQLAlchemy engine
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string)

                # Create MatrixOne Client from existing SQLAlchemy engine
                client = Client.from_engine(engine)
                self.logger.info("✅ Created MatrixOne Client from SQLAlchemy engine")

                # Test basic functionality
                result = client.execute("SELECT 1 as test_value")
                rows = result.fetchall()
                self.logger.info(f"📊 Test query result: {rows[0][0]}")

                # Test database operations
                test_db = "demo_engine_db"
                client.execute(f"CREATE DATABASE IF NOT EXISTS {test_db}")
                client.execute(f"USE {test_db}")

                # Create test table
                client.execute("DROP TABLE IF EXISTS engine_test")
                client.execute("CREATE TABLE engine_test (id INT PRIMARY KEY, name VARCHAR(100))")

                # Insert test data
                client.execute("INSERT INTO engine_test VALUES (1, 'Test Data 1')")
                client.execute("INSERT INTO engine_test VALUES (2, 'Test Data 2')")

                # Query test data
                result = client.execute("SELECT COUNT(*) FROM engine_test")
                count = result.fetchone()[0]
                self.logger.info(f"📊 Test table has {count} records")

                # Cleanup
                client.execute(f"DROP DATABASE IF EXISTS {test_db}")

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Sync engine integration test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Sync SQLAlchemy Engine Integration', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Sync engine integration test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Sync Engine Integration', 'error': str(e)})

    async def test_async_engine_integration(self):
        """Test async SQLAlchemy engine integration"""
        print("\n=== Async SQLAlchemy Engine Integration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test async engine integration
            self.logger.info("Test: Async SQLAlchemy Engine Integration")
            try:
                # Create async SQLAlchemy engine
                connection_string = f"mysql+aiomysql://{user}:{password}@{host}:{port}/{database}"
                async_engine = create_async_engine(connection_string)

                # Create MatrixOne AsyncClient from existing SQLAlchemy engine
                client = AsyncClient.from_engine(async_engine)
                self.logger.info("✅ Created MatrixOne AsyncClient from SQLAlchemy engine")

                # Test basic functionality
                result = await client.execute("SELECT 1 as async_test_value")
                rows = result.fetchall()
                self.logger.info(f"📊 Async test query result: {rows[0][0]}")

                # Test database operations
                test_db = "demo_async_engine_db"
                await client.execute(f"CREATE DATABASE IF NOT EXISTS {test_db}")
                await client.execute(f"USE {test_db}")

                # Create test table
                await client.execute("DROP TABLE IF EXISTS async_engine_test")
                await client.execute("CREATE TABLE async_engine_test (id INT PRIMARY KEY, name VARCHAR(100))")

                # Insert test data
                await client.execute("INSERT INTO async_engine_test VALUES (1, 'Async Test Data 1')")
                await client.execute("INSERT INTO async_engine_test VALUES (2, 'Async Test Data 2')")

                # Query test data
                result = await client.execute("SELECT COUNT(*) FROM async_engine_test")
                count = result.fetchone()[0]
                self.logger.info(f"📊 Async test table has {count} records")

                # Cleanup
                await client.execute(f"DROP DATABASE IF EXISTS {test_db}")
                await client.disconnect()

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Async engine integration test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Async SQLAlchemy Engine Integration', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Async engine integration test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Async Engine Integration', 'error': str(e)})

    def test_engine_reuse(self):
        """Test engine reuse functionality"""
        print("\n=== Engine Reuse Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test engine reuse
            self.logger.info("Test: Engine Reuse")
            try:
                # Create SQLAlchemy engine
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string)

                # Create multiple clients from the same engine
                client1 = Client.from_engine(engine)
                client2 = Client.from_engine(engine)

                self.logger.info("✅ Created multiple clients from same engine")

                # Test both clients work
                result1 = client1.execute("SELECT 1 as client1_test")
                result2 = client2.execute("SELECT 2 as client2_test")

                self.logger.info(f"📊 Client 1 result: {result1.fetchone()[0]}")
                self.logger.info(f"📊 Client 2 result: {result2.fetchone()[0]}")

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Engine reuse test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Engine Reuse', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Engine reuse test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Engine Reuse', 'error': str(e)})

    def test_custom_engine_configuration(self):
        """Test custom engine configuration"""
        print("\n=== Custom Engine Configuration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test custom engine configuration
            self.logger.info("Test: Custom Engine Configuration")
            try:
                # Create SQLAlchemy engine with custom configuration
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string, pool_size=5, max_overflow=10, pool_pre_ping=True, echo=False)

                # Create MatrixOne Client from custom engine
                client = Client.from_engine(engine)
                self.logger.info("✅ Created MatrixOne Client from custom engine
```

### Core Architecture Module: `clients/python/examples/example_connection_hooks.py`
```
#!/usr/bin/env python3

# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Example: Connection Hooks - Automatic Feature Enablement on Connection

This example demonstrates how to use connection hooks to automatically
enable features like IVF, HNSW, and fulltext search after connecting to MatrixOne:

1. Basic connection hooks with predefined actions
2. Custom callback functions
3. Mixed actions and custom callbacks
4. Asynchronous connection hooks
5. String-based action names
6. Practical application examples
7. Error handling and logging

Connection hooks allow you to automatically configure your MatrixOne client
whenever a new connection is established, eliminating the need for manual
feature enablement.
"""

import asyncio
import logging
from matrixone import Client, AsyncClient
from matrixone.connection_hooks import ConnectionAction, create_connection_hook
from matrixone.config import get_connection_kwargs, print_config
from matrixone.logger import create_default_logger


class ConnectionHooksDemo:
    """Demonstrates connection hooks capabilities with comprehensive testing."""

    def __init__(self):
        self.logger = create_default_logger(
            sql_log_mode="auto",
        )
        self.results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'unexpected_results': [],
            'connection_hooks_tested': [],
        }
        # Get connection parameters and filter to only supported ones
        all_params = get_connection_kwargs()
        self.connection_params = {
            'host': all_params['host'],
            'port': all_params['port'],
            'user': all_params['user'],
            'password': all_params['password'],
            'database': all_params['database'],
        }
        # Note: on_connect is available in all_params but we'll set it explicitly in examples

    def sync_connection_hooks_example(self):
        """Demonstrate connection hooks with synchronous client"""
        print("=== Synchronous Connection Hooks Example ===")

        # Example 1: Enable all features
        print("\n1. Enable all features:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_ALL],
            )
            print("✓ Connected with all features enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_ALL')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_ALL failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 2: Enable only vector operations
        print("\n2. Enable only vector operations:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_VECTOR],
            )
            print("✓ Connected with vector operations enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_VECTOR')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_VECTOR failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 3: Enable only fulltext search
        print("\n3. Enable only fulltext search:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_FULLTEXT],
            )
            print("✓ Connected with fulltext search enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_FULLTEXT')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_FULLTEXT failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 4: Custom callback function
        print("\n4. Custom callback function:")
        self.results['tests_run'] += 1

        def my_callback(client):
            print(f"  Custom callback: Connected to {client._connection_params['host']}:{client._connection_params['port']}")
            print(f"  Database: {client._connection_params['database']}")

        client = Client()
        try:
            client.connect(**self.connection_params, on_connect=my_callback)
            print("✓ Connected with custom callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('CUSTOM_CALLBACK')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"CUSTOM_CALLBACK failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 5: Mixed actions and custom callback
        print("\n5. Mixed actions and custom callback:")
        self.results['tests_run'] += 1

        def setup_callback(client):
            print(f"  Setup callback: Setting up client for {client._connection_params['database']}")
            # You can add custom setup logic here

        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=create_connection_hook(
                    actions=[ConnectionAction.ENABLE_FULLTEXT, ConnectionAction.ENABLE_IVF], custom_hook=setup_callback
                ),
            )
            print("✓ Connected with mixed actions and custom callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('MIXED_ACTIONS')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"MIXED_ACTIONS failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

    async def async_connection_hooks_example(self):
        """Demonstrate connection hooks with asynchronous client"""
        print("\n=== Asynchronous Connection Hooks Example ===")

        # Example 1: Enable all features
        print("\n1. Enable all features:")
        self.results['tests_run'] += 1
        client = AsyncClient()
        try:
            await client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_ALL],
            )
            print("✓ Connected with all features enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_ENABLE_ALL')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_ENABLE_ALL failed: {e}")
        finally:
            if client.connected():
                await client.disconnect()

        # Example 2: Custom async callback
        print("\n2. Custom async callback:")
        self.results['tests_run'] += 1

        async def async_callback(client):
            print(f"  Async callback: Connected to {client._connection_params['host']}:{client._connection_params['port']}")
            print(f"  Database: {client._connection_params['database']}")
            # Simulate some async setup
            await asyncio.sleep(0.1)
            print("  Async setup completed")

        client = AsyncClient()
        try:
            await client.connect(**self.connection_params, on_connect=async_callback)
            print("✓ Connected with async callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_CUSTOM_CALLBACK')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_CUSTOM_CALLBACK failed: {e}")
        finally:
            if client.connected():
                await client.disconnect()

        # Example 3: String action names
        print("\n3. Using string action names:")
        self.results['tests_run'] += 1
        client = AsyncClient()
        try:
            await client.connect(
                **self.connection_params,
                on_connect=["enable_fulltext", "enable_ivf"],
            )
            print("✓ Connected with string action names")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_STRING_ACTIONS')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_STRING_ACTIONS failed: {e}")
        finally:
            if client.connected():
         
```

### Core Architecture Module: `clients/python/matrixone/_analytics_workers.py`
```
# Copyright 2026 Matrix Origin
# Licensed under the Apache License, Version 2.0.
"""Per-client bounded blocking work, independent of an asyncio loop's lifetime."""

import asyncio
import os
import threading
import uuid
from collections import deque
from concurrent.futures import Future, ThreadPoolExecutor
from functools import partial
from contextvars import copy_context


async def _wait(future):
    wrapped = asyncio.wrap_future(future)
    try:
        return await asyncio.shield(wrapped)
    except asyncio.CancelledError:
        # Completion/accounting belongs to the concurrent future, even if the
        # awaiting loop is gone. Consume an eventual asyncio-side exception.
        wrapped.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        raise


class _Executor:
    """Retire a failed generation before another job can enter its queue."""

    def __init__(self, capacity, prefix, on_failure=None):
        self._executor = ThreadPoolExecutor(max_workers=capacity, thread_name_prefix=prefix)
        self._lock = threading.Lock()
        self._failure = None
        self._on_failure = on_failure

    @property
    def failed(self):
        with self._lock:
            return self._failure is not None

    def submit(self, function, *args, _register=None, **kwargs):
        decision = threading.Event()
        accepted = False
        rejection = None

        def execute():
            decision.wait()
            if accepted:
                return function(*args, **kwargs)
            raise RuntimeError('Analytics submission was rejected') from rejection

        with self._lock:
            if self._failure is not None:
                raise RuntimeError(
                    'Analytics worker generation failed; reconnect or retry cleanup explicitly'
                ) from self._failure
            try:
                future = self._executor.submit(execute)
                if _register is not None:
                    _register(future)
                accepted = True
            except BaseException as error:
                # CPython may enqueue before thread creation raises. That
                # wrapper must never perform unrecorded work later.
                rejection = self._failure = error
                try:
                    self._executor.shutdown(wait=False)
                except BaseException as cleanup_error:
                    error.cleanup_error = cleanup_error
                if self._on_failure is not None:
                    self._on_failure()
                raise
            finally:
                decision.set()
        return future


class _Admission:
    def __init__(self, capacity, executor=None):
        self._available = capacity
        self._executor = executor
        self._waiters = deque()
        self._lock = threading.Lock()
        self._closed = False

    async def acquire(self):
        future = Future()
        with self._lock:
            if self._closed:
                raise RuntimeError('Analytics admission is closed')
            if self._available:
                self._available -= 1
                future.set_result(_Lease(self))
            else:
                self._waiters.append(future)
        try:
            return await _wait(future)
        except BaseException:
            if future.cancel():
                with self._lock:
                    try:
                        self._waiters.remove(future)
                    except ValueError:
                        pass
            else:
                # A grant may be marked running without having a result yet.
                # Never block this event loop waiting for its producer thread.
                def return_grant(done):
                    if not done.cancelled() and done.exception() is None:
                        done.result().release()

                future.add_done_callback(return_grant)
            raise

    def release(self):
        granted = None
        with self._lock:
            while self._waiters:
                future = self._waiters.popleft()
                if future.set_running_or_notify_cancel():
                    granted = future
                    break
            if granted is None:
                self._available += 1
        if granted is not None:
            # Completion callbacks may return a canceled caller's grant and
            # therefore reacquire this admission lock.
            granted.set_result(_Lease(self))

    def set_open(self, value):
        rejected = []
        with self._lock:
            self._closed = not value
            if not value:
                while self._waiters:
                    future = self._waiters.popleft()
                    if future.set_running_or_notify_cancel():
                        rejected.append(future)
        for future in rejected:
            future.set_exception(RuntimeError('Analytics admission is closed'))


class _Lease:
    """A canceled await does not release a still-running worker's admission."""

    def __init__(self, admission):
        self._admission = admission
        self._lock = threading.Lock()
        self._future = None
        self._closed = False

    def submit(self, function, *args, _on_submitted=None, **kwargs):
        with self._lock:
            if self._closed or self._future is not None:
                raise RuntimeError('Worker lease is closed or already running')
            context = copy_context()

            def registered(future):
                future.add_done_callback(self._completed)
                self._future = future
                if _on_submitted is not None:
                    _on_submitted(future)

            return self._admission._executor.submit(
                context.run, partial(function, *args, **kwargs), _register=registered
            )

    async def run(self, function, *args, **kwargs):
        return await _wait(self.submit(function, *args, **kwargs))

    def _completed(self, future):
        with self._lock:
            if self._future is not future:
                return
            self._future = None
            release = self._closed
        if release:
            self._admission.release()

    def release(self):
        with self._lock:
            if self._closed:
                return
            self._closed = True
            release = self._future is None
        if release:
            self._admission.release()


class AnalyticsWorkers:
    """Two CPU/I/O jobs and two staged uploads, plus one independent unlink lane.

    Keep this owner across reconnects. A blocked foreign reader or filesystem
    operation cannot be forcibly interrupted; it stays charged until completion.
    """

    def __init__(self):
        self.workers = _Admission(2)
        self._executor = self._cpu_executor()
        self.workers._executor = self._executor
        self._unlink_executor = _Executor(1, 'mo-unlink')
        self._staging = _Admission(2)
        self._lock = threading.Lock()
        self._uploads = {}
        self._unlink_queue = deque()
        self._unlink_active = None

    def _cpu_executor(self):
        return _Executor(2, 'mo-analytics', lambda: self.workers.set_open(False))

    def set_open(self, value):
        if value and self._executor.failed:
            self._executor = self._cpu_executor()
            self.workers._executor = self._executor
        self.workers.set_open(value)
        self._staging.set_open(value)
        if not value:
            with self._lock:
                uploads = tuple(self._uploads.values())
            for upload in uploads:
                upload.cancelled.set()

    async def run(self, function, *args, **kwargs):
        cancelled = threading.Event()
        lease = await self.workers.acquire()
        try:
            return await lease.run(function, *args, cancelled=cancelled, **kwargs)
        except BaseException:
            cancelled.set()
            raise
        finally:
            lease.release()

    async def upload(self):
        permit = await self._staging.acquire()
        upload = StagingOperation(self, permit)
        with self._lock:
            self._uploads[upload.id] = upload
        return upload

    def pending(self):
        with self._lock:
            uploads = tuple(self._uploads.values())
        return tuple(upload.status() for upload in uploads)

    async def retry_cleanup(self, operation_id):
        with self._lock:
            upload = self._uploads[operation_id]
            if self._unlink_executor.failed:
                self._unlink_executor = _Executor(1, 'mo-unlink')
        with upload._lock:
            if upload._cleanup_error is None:
                raise RuntimeError('Operation does not have a failed cleanup')
            upload._cleanup_error = None
            upload._cleanup = Future()
            completion = upload._cleanup
            upload._cleanup_queued = False
        upload.finish()
        await _wait(completion)

    def _enqueue_unlink(self, upload):
        with self._lock:
            self._unlink_queue.append(upload)
        self._dispatch_unlink()

    def _dispatch_unlink(self):
        with self._lock:
            if self._unlink_active is not None or not self._unlink_queue:
                return
            upload = self._unlink_queue.popleft()
            self._unlink_active = upload
        # Submit just one item. The bounded staging owners retain queued work;
        # ThreadPoolExecutor's unbounded queue is never used as admission.
        with upload._lock:
            completion = upload._cleanup
        try:
            future = self._unlink_executor.submit(upload._unlink)
        except BaseException as error:
            future = Future()
            future.set_exception(error)
        future.add_done_callback(partial(self._unlinked, upload, completion))

    def _unlinked(self, upload, completion, future):
        try:
            error = future.exception()
    
```

### Core Architecture Module: `clients/python/matrixone/_utils.py`
```
"""Shared internal utilities for MatrixOne SDK modules."""

from typing import Optional, Union, Type

try:
    from sqlalchemy import Table
    from sqlalchemy.orm import DeclarativeMeta as _unused  # noqa: F401

    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


def get_table_name(table: Union[str, Type], *, quoted=False) -> str:
    """Extract table name from string or ORM model.

    Supports:
    - "table_name"
    - "db.table_name"
    - ORM model's resolved table name and schema for db.table
    """
    from ._sql_literals import sql_identifier, sql_object_name

    if isinstance(table, str):
        return sql_object_name(table, qualified=True) if quoted else table
    if SQLALCHEMY_AVAILABLE:
        mapped_table = getattr(table, '__table__', None)
        if isinstance(mapped_table, Table):
            if quoted:
                name = sql_identifier(mapped_table.name)
                return sql_identifier(mapped_table.schema) + '.' + name if mapped_table.schema else name
            return mapped_table.fullname
    if SQLALCHEMY_AVAILABLE and hasattr(table, '__tablename__'):
        name = table.__tablename__
        if hasattr(table, '__table_args__'):
            args = table.__table_args__
            if isinstance(args, dict) and 'schema' in args:
                return (
                    sql_identifier(args['schema']) + '.' + sql_identifier(name)
                    if quoted
                    else f"{args['schema']}.{name}"
                )
        return sql_identifier(name) if quoted else name
    raise ValueError(f"Invalid table parameter: {table}. Expected string or ORM model.")


def require_non_empty(value: str, param_name: str) -> str:
    """Validate that a string parameter is non-empty."""
    if not value:
        raise ValueError(f"{param_name} must be a non-empty string")
    return value


# The server rejects these statements with "DATA BRANCH MERGE/PICK is not
# supported in transactions" (pkg/frontend/data_branch.go) when they arrive
# inside a transaction. SQLAlchemy keeps pooled pymysql/aiomysql connections
# in implicit-transaction mode (autocommit=False), and its do_begin is a
# no-op, so a plain engine.begin() lands these statements in an implicit,
# never-committed transaction. They must execute on an AUTOCOMMIT-mode
# connection instead. Classification below is a bounded linear scan, not a
# regex: every user query passes through it, so it must not backtrack.


def _skip_space_and_comments(sql: str, pos: int) -> int:
    """Advance past whitespace and MatrixOne comments, returning the index of
    the next meaningful character.

    Mirrors pkg/sql/parsers/dialect/mysql/scanner.go: `/* ... */` block
    comments are inert, `// ...` and `# ...` are line comments, `-- ...` is a
    line comment only when the dashes are followed by whitespace or
    end-of-line. `/*! ... */` is an executable MySQL comment: the scanner
    steps inside (skipping an optional 5-digit version) because the server
    executes its contents. Its `*/` terminator is likewise transparent; that
    can only affect leading-word matching for statements that are invalid SQL
    either way. A comment that never terminates consumes the rest of the
    string.
    """
    n = len(sql)
    while pos < n:
        ch = sql[pos]
        if ch.isspace():
            pos += 1
            continue
        if sql.startswith("/*!", pos):
            pos += 3
            if sql[pos : pos + 5].isdigit():
                pos += 5
            continue
        if sql.startswith("*/", pos):
            # terminator of an enclosing executable comment; transparent
            pos += 2
            continue
        if sql.startswith("/*", pos):
            end = sql.find("*/", pos + 2)
            if end == -1:
                return n
            pos = end + 2
            continue
        if sql.startswith("--", pos) and (pos + 2 == n or sql[pos + 2].isspace()):
            end = sql.find("\n", pos + 2)
            if end == -1:
                return n
            pos = end + 1
            continue
        if sql.startswith("//", pos):
            end = sql.find("\n", pos + 2)
            if end == -1:
                return n
            pos = end + 1
            continue
        if ch == "#":
            end = sql.find("\n", pos + 1)
            if end == -1:
                return n
            pos = end + 1
            continue
        break
    return pos


def _read_word(sql: str, pos: int) -> tuple:
    """Read one SQL word ([A-Za-z0-9_$]*) starting at pos; return (word, next)."""
    n = len(sql)
    end = pos
    while end < n and (sql[end].isalnum() or sql[end] in "_$"):
        end += 1
    return sql[pos:end], end


def is_non_transactional_statement(sql: Optional[str]) -> bool:
    """True for client-level branch operations and table DDL requiring autocommit.

    Leading and inter-keyword whitespace/comments are consumed with the
    server's lexical rules, so "data /* trace */ branch merge ...",
    "// trace\\ndata branch merge ..." and "/*! data branch merge src into
    dst */" (MySQL executable comment) classify like the server executes
    them, while a MERGE/PICK-shaped phrase sitting only inside an inert
    comment (e.g. "-- data branch merge a into b\\nSELECT 1") does not.
    """
    if not isinstance(sql, str):
        from sqlalchemy.sql.elements import TextClause
        from sqlalchemy.sql.ddl import DDL

        if isinstance(sql, TextClause):
            sql = sql.text
        elif isinstance(sql, DDL):
            sql = sql.statement
        else:
            return False
    if not sql:
        return False
    pos = 0
    words = []
    for _ in range(3):
        pos = _skip_space_and_comments(sql, pos)
        word, pos = _read_word(sql, pos)
        if not word:
            break
        words.append(word.lower())
    return (
        bool(words)
        and words[0] == 'truncate'
        or len(words) >= 2
        and words[:2] == ['alter', 'table']
        or len(words) >= 3
        and words[:2] == ['data', 'branch']
        and words[2] in ('merge', 'pick')
    )


def discard_unrestored_connection(conn):
    """Remove an unrestorable checkout and terminate it without pool reset IO.

    Detach before termination: SQLAlchemy 1.4 invalidate listeners can raise
    before disposal. Invalidation alone after detach does not close the DBAPI
    handle, so retain and terminate it even if a detach callback raises.
    """
    if conn.closed or conn.invalidated:
        return
    proxy = conn.connection
    raw = getattr(proxy, "dbapi_connection", None)
    if raw is None:  # SQLAlchemy < 1.4.24
        raw = proxy.connection
    try:
        conn.detach()
    finally:
        try:
            conn.dialect.do_terminate(raw)
        finally:
            conn.invalidate()


def result_returns_rows(result):
    """CursorResult declares its shape; ORM row results expose keys/fetchall."""
    declared = getattr(result, 'returns_rows', None)
    if declared is not None:
        return bool(declared)
    return callable(getattr(result, 'keys', None)) and callable(getattr(result, 'fetchall', None))


def rows_from_result(result):
    """Read a manager-owned result from buffered Client or SQLAlchemy Session."""
    if result is None:
        return []
    rows = getattr(result, 'rows', None)
    return rows if rows is not None else result.fetchall()


def stage_file_uri(name, filename):
    """Encode a logical Stage identifier while preserving legacy filename syntax."""
    import re
    from urllib.parse import quote
    from ._sql_literals import sql_identifier

    sql_identifier(name)  # Shared identifier bounds/NUL validation.
    root = 'stage://' + name if re.fullmatch(r'[A-Za-z0-9_.-]+', name) else 'stage:///' + quote(name, safe='')
    return root + '/' + filename

```

### Core Architecture Module: `clients/python/matrixone/connection_hooks.py`
```
# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Connection hooks for MatrixOne clients
"""

from enum import Enum
from contextvars import ContextVar
import inspect
import threading
from typing import Callable, List, Optional, Union

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine

_initializing_clients = ContextVar('matrixone_initializing_clients', default=())
_settings_registration = threading.Lock()


def assert_not_in_hook(client):
    if any(owner is client for owner in _initializing_clients.get()):
        raise RuntimeError(
            'on_connect cannot reenter the same client pool; use ConnectionAction for session initialization'
        )


class ConnectionAction(Enum):
    """Predefined connection actions that can be executed after connecting"""

    ENABLE_IVF = "enable_ivf"
    ENABLE_HNSW = "enable_hnsw"
    ENABLE_FULLTEXT = "enable_fulltext"
    ENABLE_VECTOR = "enable_vector"  # Enables both IVF and HNSW
    ENABLE_ALL = "enable_all"  # Enables all features


class ConnectionHook:
    """Connection hook that executes actions after successful connection"""

    def __init__(
        self, actions: Optional[List[Union[ConnectionAction, str]]] = None, custom_hook: Optional[Callable] = None
    ):
        """
        Initialize connection hook

        Args:

            actions: List of predefined actions to execute
            custom_hook: Custom callback function to execute
        """
        self.actions = actions or []
        self.custom_hook = custom_hook
        self._action_handlers = {
            ConnectionAction.ENABLE_IVF: self._enable_ivf_with_connection,
            ConnectionAction.ENABLE_HNSW: self._enable_hnsw_with_connection,
            ConnectionAction.ENABLE_FULLTEXT: self._enable_fulltext_with_connection,
            ConnectionAction.ENABLE_VECTOR: self._enable_vector_with_connection,
            ConnectionAction.ENABLE_ALL: self._enable_all_with_connection,
        }
        self._client_ref = None  # Will be set when hook is attached to a client
        self._async_engine = False
        self._settings = {}
        self._settings_revision = 0
        self._settings_lock = threading.Lock()
        self._settings_publication_lock = threading.Lock()
        self._settings_token = object()

    def set_client(self, client):
        """Set the client reference for this hook"""
        self._client_ref = client

    def attach_to_engine(self, engine):
        """Initialize once per physical generation, including already-open adoption."""
        self._async_engine = isinstance(engine, AsyncEngine)
        target = engine.sync_engine if self._async_engine else engine
        event.listen(target, 'checkout', self._on_checkout)

    def _on_checkout(self, dbapi_connection, connection_record, connection_proxy):
        assert_not_in_hook(self._client_ref)
        # Checkout owns cleanup even on cancellation in SQLAlchemy 1.4 and 2.0.
        # Existing engine connections may predate hook attachment. Record.info
        # is cleared by SQLAlchemy when a physical connection is replaced.
        self._on_connect_sync(dbapi_connection, connection_record)
        self._apply_settings(dbapi_connection, connection_record)

    def _apply_settings(self, connection, record):
        if not self._settings:
            return
        with self._settings_lock:
            revision, settings = self._settings_revision, self._settings
        if record.info.get(self._settings_token) == revision:
            return
        cursor = connection.cursor()
        try:
            for name, value in settings.items():
                cursor.execute('SET ' + name + ' = %s', (value,))
        finally:
            cursor.close()
        record.info[self._settings_token] = revision

    def _on_connect_sync(self, dbapi_connection, connection_record):
        client = self._client_ref
        if client is None or connection_record.info.get(self):
            return
        assert_not_in_hook(client)
        connection_record.info[self] = True
        token = _initializing_clients.set(_initializing_clients.get() + (client,))
        try:
            for action in self.actions:
                action = ConnectionAction(action) if isinstance(action, str) else action
                self._action_handlers[action](client, dbapi_connection)
            if self.custom_hook is not None:
                result = self.custom_hook(client)
                if inspect.isawaitable(result):
                    if not self._async_engine:
                        if inspect.iscoroutine(result):
                            result.close()
                        raise TypeError('An asynchronous on_connect callback requires AsyncClient')
                    # The adapter's checkout event runs inside SQLAlchemy's
                    # greenlet, so this suspends admission until completion.
                    from sqlalchemy.util.concurrency import await_only

                    await_only(result)
        except Exception as error:
            client.logger.warning(f'Connection hook execution failed: {error}')
        finally:
            _initializing_clients.reset(token)

    async def execute_async(self, client) -> None:
        """Execute hook actions asynchronously (for immediate execution)"""
        try:
            # For immediate execution, we need to get a connection from the client
            # This is a fallback for when we don't have a specific connection
            if hasattr(client, '_engine') and client._engine:
                async with client._engine.connect() as conn:
                    # Execute actions directly on async connection
                    await self.execute_async_on_connection(client, conn)
            else:
                client.logger.warning("No engine available for connection hook execution")

        except Exception as e:
            client.logger.warning(f"Connection hook execution failed: {e}")

    async def execute_async_on_connection(self, client, async_connection) -> None:
        """Execute hook actions on an AsyncConnection (SQLAlchemy async connection)"""
        try:
            # Execute predefined actions
            for action in self.actions:
                if isinstance(action, str):
                    action = ConnectionAction(action)

                # Execute SQL directly on async connection
                if action == ConnectionAction.ENABLE_IVF:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    client.logger.debug("✓ Enabled IVF vector operations")
                elif action == ConnectionAction.ENABLE_HNSW:
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    client.logger.debug("✓ Enabled HNSW vector operations")
                elif action == ConnectionAction.ENABLE_FULLTEXT:
                    await async_connection.execute(text("SET experimental_fulltext_index = 1"))
                    client.logger.debug("✓ Enabled fulltext search operations")
                elif action == ConnectionAction.ENABLE_VECTOR:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    client.logger.debug("✓ Enabled vector operations")
                elif action == ConnectionAction.ENABLE_ALL:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    await async_connection.execute(text("SET experimental_fulltext_index = 1"))
                    client.logger.debug("✓ Enabled all operations")
                else:
                    client.logger.warning(f"Unknown connection action: {action}")

            # Execute custom hook if provided
            if self.custom_hook:
                if hasattr(self.custom_hook, '__call__'):
                    # Check if it's an async function
                    if hasattr(self.custom_hook, '__code__') and self.custom_hook.__code__.co_flags & 0x80:
                        await self.custom_hook(client)
                    else:
                        # Try to call it as sync
                        result = self.custom_hook(client)
                        # If it returns a coroutine, await it
                        if hasattr(result, '__await__'):
                            await result

        except Exception as e:
            client.logger.warning(f"Connection hook execution failed: {e}")

    async def execute_async_with_connection(self, client, dbapi_connection) -> None:
        """Execute hook actions asynchronously using the provided connection"""
        try:
            # Execute predefined actions with connection
            for action in self.actions:
                if isinstance(action, str):
                    action = ConnectionAction(action)

                if action in self._action_handlers:
                    # For async, we still use the sync methods since they work with direct connection
                    self._action_handlers[action](client, dbapi_connection)
                else:
                    client.logger.warning(f"Unknown connection action: {action}")

            # Execute custom hook if provided

```

### Core Architecture Module: `clients/python/matrixone/index_utils.py`
```
# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Index utilities - Shared logic for secondary index operations
"""


def read_index_metadata(connection, table_name, database=None):
    """Resolve the tenant/database and index keys on the counting connection."""
    from sqlalchemy import text
    from ._sql_literals import identifier_parts

    parts = identifier_parts(table_name, qualified=True)
    if len(parts) == 2:
        if database is not None and database != parts[0]:
            raise ValueError('Explicit database conflicts with qualified table name')
        database = parts[0]
    elif database is None:
        result = connection.exec_driver_sql('SELECT DATABASE()')
        try:
            database = result.scalar()
        finally:
            result.close()
    if not database:
        raise ValueError('Index verification requires a database')
    result = connection.execute(
        text("""
        SELECT i.id, i.name, i.index_table_name, i.type, i.column_name,
               i.ordinal_position, i.algo, i.algo_table_type
        FROM mo_catalog.mo_indexes i JOIN mo_catalog.mo_tables t ON i.table_id=t.rel_id
        WHERE t.account_id=CURRENT_ACCOUNT_ID()
          AND (t.reldatabase=:database OR (@@lower_case_table_names<>0 AND LOWER(t.reldatabase)=LOWER(:database)))
          AND (t.relname=:table OR (@@lower_case_table_names<>0 AND LOWER(t.relname)=LOWER(:table)))
          AND i.type IN ('MULTIPLE','UNIQUE')
        ORDER BY i.id, i.ordinal_position
    """),
        {'database': database, 'table': parts[-1]},
    )
    try:
        return database, parts[-1], result.fetchall()
    finally:
        result.close()


def index_count_report(connection, table_name):
    """Count UNIQUE entries against non-NULL keys, within one read transaction."""
    from ._sql_literals import sql_identifier

    database, table, metadata = read_index_metadata(connection, table_name)
    quote = lambda name: sql_identifier(name, force=True)
    target = quote(database) + '.' + quote(table)
    groups = {}
    for identity, name, physical, kind, column, ordinal, algorithm, family in metadata:
        if not physical or str(algorithm or '').lower() not in ('', 'btree') or family:
            raise ValueError('Count verification supports ordinary and UNIQUE B-tree indexes only')
        key = (identity, name, physical, kind)
        groups.setdefault(key, []).append((ordinal, column))
    aggregates = ['COUNT(*) AS main_count']
    expectations = []
    actuals = []
    for (_, name, physical, kind), columns in groups.items():
        if kind == 'UNIQUE':
            if [position for position, _ in columns] != list(range(1, len(columns) + 1)):
                raise ValueError('Incomplete UNIQUE index key metadata')
            predicate = ' AND '.join(quote(column) + ' IS NOT NULL' for _, column in columns)
            expected_position = len(aggregates)
            aggregates.append('COUNT(CASE WHEN ' + predicate + ' THEN 1 END) AS expected_' + str(expected_position))
        else:
            expected_position = 0
        expectations.append((name, physical, expected_position))
        actuals.append('(SELECT COUNT(*) FROM ' + quote(database) + '.' + quote(physical) + ')')
    sql = 'SELECT counts.*' + (', ' + ', '.join(actuals) if actuals else '')
    sql += ' FROM (SELECT ' + ', '.join(aggregates) + ' FROM ' + target + ') AS counts'
    result = connection.exec_driver_sql(sql, execution_options={'no_parameters': True})
    try:
        row = result.fetchone()
    finally:
        result.close()
    details = [
        {'name': name, 'table': physical, 'expected': row[expected], 'actual': row[len(aggregates) + index]}
        for index, (name, physical, expected) in enumerate(expectations)
    ]
    return row[0], details


def verify_count_report(report):
    count, details = report
    mismatches = [item for item in details if item['actual'] != item['expected']]
    if mismatches:
        raise ValueError(
            'Index count verification failed!\n'
            + '\n'.join(
                '%s: %s entries, expected %s' % (item['name'], item['actual'], item['expected']) for item in mismatches
            )
        )
    return count

```

### Core Architecture Module: `cmd/mo-service/lifecycle.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/matrixorigin/matrixone/pkg/logutil"
	"go.uber.org/zap"
)

type serviceRole uint8

const (
	serviceRoleProxy serviceRole = iota
	serviceRoleCN
	serviceRoleTN
	serviceRoleLog
	serviceRolePython
	serviceRoleCount
)

func (r serviceRole) String() string {
	switch r {
	case serviceRoleProxy:
		return "proxy"
	case serviceRoleCN:
		return "cn"
	case serviceRoleTN:
		return "tn"
	case serviceRoleLog:
		return "log"
	case serviceRolePython:
		return "python"
	default:
		return "unknown"
	}
}

type serviceRoleState struct {
	stopOnce sync.Once
	stopC    chan struct{}
	wg       sync.WaitGroup

	errMu sync.Mutex
	err   error
	count int
}

type serviceSupervisor struct {
	roles [serviceRoleCount]serviceRoleState

	shutdownOnce       sync.Once
	shutdownErr        error
	dynamicCleanupOnce sync.Once
	dynamicCleanupErr  error
	fatalC             chan error

	dynamicCNStop func(context.Context) error
}

func newServiceSupervisor() *serviceSupervisor {
	s := &serviceSupervisor{}
	for i := range s.roles {
		s.roles[i].stopC = make(chan struct{})
	}
	s.fatalC = make(chan error, 1)
	return s
}

func (s *serviceSupervisor) failureC() <-chan error {
	if s == nil {
		return nil
	}
	return s.fatalC
}

func (s *serviceSupervisor) notifyFatal(err error) {
	if s == nil || err == nil {
		return
	}
	select {
	case s.fatalC <- err:
	default:
	}
}

// registerTask reserves a role slot before starting its stopper task. Shutdown
// is only invoked after startup has returned, so Add and Wait cannot race.
func (s *serviceSupervisor) registerTask(role serviceRole) func(error) {
	if s == nil {
		return func(error) {}
	}
	state := &s.roles[role]
	state.errMu.Lock()
	state.count++
	state.errMu.Unlock()
	state.wg.Add(1)
	var finishOnce sync.Once
	return func(err error) {
		finishOnce.Do(func() {
			if err != nil {
				state.errMu.Lock()
				state.err = errors.Join(state.err, err)
				state.errMu.Unlock()
			}
			state.wg.Done()
		})
	}
}

// roleContext derives a context that is cancelled when the supervisor reaches
// the role's shutdown phase. Service tasks use it only for their run loops;
// the service Close method still owns its orderly shutdown.
func (s *serviceSupervisor) roleContext(parent context.Context, role serviceRole) (context.Context, context.CancelFunc) {
	if s == nil {
		return parent, func() {}
	}
	ctx, cancel := context.WithCancel(parent)
	go func() {
		select {
		case <-s.roles[role].stopC:
			cancel()
		case <-parent.Done():
			cancel()
		case <-ctx.Done():
		}
	}()
	return ctx, cancel
}

func (s *serviceSupervisor) setDynamicCNStop(stop func(context.Context) error) {
	if s != nil {
		s.dynamicCNStop = stop
	}
}

func (s *serviceSupervisor) cleanupDynamicCN(ctx context.Context) error {
	if s == nil || s.dynamicCNStop == nil {
		return nil
	}
	s.dynamicCleanupOnce.Do(func() {
		cleanupCtx, cancel := context.WithTimeout(ctx, time.Minute)
		defer cancel()
		s.dynamicCleanupErr = s.dynamicCNStop(cleanupCtx)
	})
	return s.dynamicCleanupErr
}

func (s *serviceSupervisor) stopRole(
	ctx context.Context,
	role serviceRole,
) error {
	state := &s.roles[role]
	state.stopOnce.Do(func() { close(state.stopC) })
	done := make(chan struct{})
	go func() {
		state.wg.Wait()
		close(done)
	}()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	start := time.Now()
	for {
		select {
		case <-done:
			state.errMu.Lock()
			err := state.err
			count := state.count
			state.errMu.Unlock()
			logutil.Info("shutdown role drained",
				zap.String("shutdown_phase", role.String()),
				zap.Int("service_count", count),
				zap.Duration("duration", time.Since(start)),
				zap.Bool("clean_handoff", err == nil && role == serviceRoleCN),
				zap.Error(err))
			return err
		case <-ticker.C:
			state.errMu.Lock()
			count := state.count
			state.errMu.Unlock()
			logutil.Warn("shutdown role still draining",
				zap.String("shutdown_phase", role.String()),
				zap.Int("service_count", count),
				zap.Duration("duration", time.Since(start)))
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *serviceSupervisor) shutdown(ctx context.Context) error {
	if s == nil {
		return nil
	}
	s.shutdownOnce.Do(func() {
		defer func() {
			if s.shutdownErr != nil {
				s.shutdownErr = errors.Join(s.shutdownErr, s.cleanupDynamicCN(context.Background()))
			}
		}()

		// The built-in proxy is not a stopper task and must stop accepting
		// external SQL before CN ingress is withdrawn.
		if cnProxy != nil {
			if err := cnProxy.Stop(); err != nil {
				s.shutdownErr = err
				return
			}
		}

		phases := []struct {
			role    serviceRole
			timeout time.Duration
		}{
			{serviceRoleProxy, time.Minute},
			{serviceRoleCN, time.Minute},
			{serviceRolePython, time.Minute},
			{serviceRoleTN, 4 * time.Minute},
			{serviceRoleLog, time.Minute},
		}

		for _, phase := range phases {
			phaseCtx, cancel := context.WithTimeout(ctx, phase.timeout)
			start := time.Now()
			logutil.Info("shutdown phase start",
				zap.String("shutdown_phase", phase.role.String()),
				zap.Duration("timeout", phase.timeout))
			var err error
			if phase.role == serviceRoleCN && s.dynamicCNStop != nil {
				dynamicDone := make(chan error, 1)
				go func() { dynamicDone <- s.cleanupDynamicCN(phaseCtx) }()
				err = errors.Join(err, s.stopRole(phaseCtx, phase.role))
				err = errors.Join(err, <-dynamicDone)
			} else {
				err = errors.Join(err, s.stopRole(phaseCtx, phase.role))
			}
			cancel()
			logutil.Info("shutdown phase done",
				zap.String("shutdown_phase", phase.role.String()),
				zap.Duration("duration", time.Since(start)),
				zap.Bool("clean_handoff", err == nil && phase.role == serviceRoleCN),
				zap.Error(err))
			if err != nil {
				s.shutdownErr = errors.Join(s.shutdownErr, err)
				// Do not tear down a dependency after any role failed to close.
				// The caller must fail-stop and let recovery resolve an unknown
				// commit or an incomplete owner handoff.
				return
			}
		}
	})
	return s.shutdownErr
}

func (s *serviceSupervisor) shutdownAfterFatal(ctx context.Context) error {
	if s == nil {
		return nil
	}
	return s.shutdown(ctx)
}

```

### Core Architecture Module: `optools/tpch_compare/engine.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	_ "github.com/duckdb/duckdb-go/v2"
	"github.com/go-sql-driver/mysql"
)

type Engine struct {
	Name        string `json:"name"`
	Database    string `json:"database"`
	DSNEnv      string `json:"dsn_env,omitempty"`
	Threads     int    `json:"threads"`
	MemoryBytes int64  `json:"memory_bytes"`
}

func quoteSQL(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func openEngine(ctx context.Context, e Engine) (*sql.DB, error) {
	var db *sql.DB
	var err error
	switch e.Name {
	case "mo":
		if !strings.HasPrefix(e.Database, "tpch_compare_") {
			return nil, errors.New("MO database must use the private tpch_compare_ prefix")
		}
		var cfg *mysql.Config
		cfg, err = mysql.ParseDSN(os.Getenv(e.DSNEnv))
		if err != nil {
			return nil, errors.New("invalid MO DSN")
		}
		if cfg.Net != "tcp" || (!strings.HasPrefix(cfg.Addr, "127.0.0.1:") && !strings.HasPrefix(cfg.Addr, "localhost:")) {
			return nil, errors.New("benchmark MO DSN must address an owned loopback deployment")
		}
		cfg.DBName = e.Database
		cfg.ParseTime = true
		cfg.MultiStatements = false
		cfg.InterpolateParams = false
		cfg.Collation = "utf8mb4_bin"
		cfg.Timeout = 10 * time.Second
		cfg.ReadTimeout = 0
		cfg.WriteTimeout = 0
		db, err = sql.Open("mysql", cfg.FormatDSN())
	case "duckdb":
		db, err = sql.Open("duckdb", e.Database)
	default:
		return nil, fmt.Errorf("unknown engine %q", e.Name)
	}
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(max(e.Threads+1, 9))
	db.SetMaxIdleConns(max(e.Threads+1, 9))
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("%s readiness: %w", e.Name, err)
	}
	return db, nil
}

func configureConn(ctx context.Context, db *sql.DB, e Engine) (*sql.Conn, error) {
	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	settings := []string{"SET time_zone = '+00:00'", "SET sql_mode = 'ANSI,ONLY_FULL_GROUP_BY'", "SET div_precision_increment = 6", "SET save_query_result = off", "SET SESSION agg_spill_mem = 2147483648"}
	if e.Name == "duckdb" {
		settings = []string{"SET TimeZone = 'UTC'", fmt.Sprintf("SET threads = %d", e.Threads), fmt.Sprintf("SET memory_limit = '%dB'", e.MemoryBytes*4/5), "SET enable_progress_bar = false", "SET default_null_order = 'NULLS_FIRST_ON_ASC_LAST_ON_DESC'"}
	}
	for _, s := range settings {
		if _, err := conn.ExecContext(ctx, s); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("%s session setting %s: %w", e.Name, s, err)
		}
	}
	return conn, nil
}

func effectiveSettings(ctx context.Context, conn *sql.Conn, engine string) (map[string]string, error) {
	out := map[string]string{}
	if engine == "mo" {
		for _, name := range []string{"sql_mode", "time_zone", "div_precision_increment", "save_query_result", "agg_spill_mem"} {
			var v string
			if err := conn.QueryRowContext(ctx, "SELECT @@session."+name).Scan(&v); err != nil {
				return nil, err
			}
			out[name] = v
		}
		return out, nil
	}
	rows, err := conn.QueryContext(ctx, "SELECT name, value FROM duckdb_settings() WHERE name IN ('threads','memory_limit','TimeZone','enable_profiling','profiling_mode','default_collation','default_null_order')")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var value sql.NullString
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		out[name] = value.String
		if !value.Valid {
			out[name] = "<SQL NULL>"
		}
	}
	return out, rows.Err()
}

type LoadReceipt struct {
	SchemaNS     int64 `json:"schema_ns"`
	LoadNS       int64 `json:"load_ns"`
	StatisticsNS int64 `json:"statistics_ns"`
	CheckpointNS int64 `json:"checkpoint_ns"`
}

func bulkLoad(ctx context.Context, conn *sql.Conn, e Engine, root string, d Dataset) (receipt LoadReceipt, retErr error) {
	start := time.Now()
	for _, t := range d.Tables {
		if _, err := conn.ExecContext(ctx, t.ddl()); err != nil {
			return receipt, err
		}
	}
	receipt.SchemaNS = time.Since(start).Nanoseconds()
	start = time.Now()
	for _, t := range d.Tables {
		file := d.Inputs[t.Name]
		path := filepath.Join(root, file.Path)
		var s string
		if e.Name == "mo" {
			// The owned server reads the immutable local file, avoiding a second
			// client-side data generator or a row-at-a-time insert path.
			// CSV loads require an explicit opt-in to use the application's cores.
			s = "LOAD DATA INFILE " + quoteSQL(path) + " INTO TABLE " + t.Name + " FIELDS TERMINATED BY '|' LINES TERMINATED BY '\\n' PARALLEL 'true'"
		} else {
			f, err := os.Open(path)
			if err != nil {
				return receipt, err
			}
			scan := bufio.NewScanner(f)
			ok := scan.Scan()
			line := scan.Text()
			scanErr := scan.Err()
			closeErr := f.Close()
			if !ok {
				return receipt, errors.Join(errors.New("empty input"), scanErr, closeErr)
			}
			if closeErr != nil {
				return receipt, closeErr
			}
			var specs, names []string
			for _, c := range t.Columns {
				specs = append(specs, quoteSQL(c.Name)+": "+quoteSQL(c.SQLType))
				names = append(names, c.Name)
			}
			if strings.HasSuffix(line, "|") {
				specs = append(specs, "'_trailing': 'VARCHAR'")
			}
			s = "INSERT INTO " + t.Name + " SELECT " + strings.Join(names, ",") + " FROM read_csv(" + quoteSQL(path) + ", delim='|', header=false, quote='', escape='', parallel=true, columns={" + strings.Join(specs, ",") + "})"
		}
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return receipt, fmt.Errorf("load %s: %w", t.Name, err)
		}
	}
	receipt.LoadNS = time.Since(start).Nanoseconds()
	start = time.Now()
	for _, t := range d.Tables {
		s := "ANALYZE " + t.Name
		if e.Name == "mo" {
			s = "ANALYZE TABLE " + t.Name
		}
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return receipt, fmt.Errorf("statistics %s: %w", t.Name, err)
		}
	}
	receipt.StatisticsNS = time.Since(start).Nanoseconds()
	start = time.Now()
	s := "CHECKPOINT"
	if e.Name == "mo" {
		s = "SELECT mo_ctl('DN', 'Checkpoint', '')"
	}
	if _, err := conn.ExecContext(ctx, s); err != nil {
		return receipt, fmt.Errorf("durable preparation: %w", err)
	}
	receipt.CheckpointNS = time.Since(start).Nanoseconds()
	return receipt, nil
}

// Check catalog domains before content normalization can hide schema drift.
// DuckDB stores both CHAR(n) and VARCHAR(n) as its unbounded VARCHAR domain.
func verifyTableSchema(ctx context.Context, conn *sql.Conn, engine string, t Table) (retErr error) {
	typeColumn, scope := "c.column_type", "c.table_schema=DATABASE()"
	if engine == "duckdb" {
		typeColumn, scope = "c.data_type", "c.table_catalog=current_database() AND c.table_schema=current_schema()"
	} else if engine != "mo" {
		return errors.New("unknown schema verification engine")
	}
	query := "SELECT c.column_name," + typeColumn + ",c.is_nullable,pk.ordinal_position FROM information_schema.columns c LEFT JOIN (" +
		"SELECT k.table_catalog,k.table_schema,k.table_name,k.column_name,k.ordinal_position FROM information_schema.key_column_usage k " +
		"JOIN information_schema.table_constraints tc ON tc.constraint_catalog=k.constraint_catalog AND tc.constraint_schema=k.constraint_schema " +
		"AND tc.constraint_name=k.constraint_name AND tc.table_schema=k.table_schema AND tc.table_name=k.table_name WHERE tc.constraint_type='PRIMARY KEY'" +
		") pk ON pk.table_catalog=c.table_catalog AND pk.table_schema=c.table_schema AND pk.table_name=c.table_name AND pk.column_name=c.column_name " +
		"WHERE " + scope + " AND c.table_name=? ORDER BY c.ordinal_position"
	rows, err := conn.QueryContext(ctx, query, t.Name)
	if err != nil {
		return err
	}
	defer func() { retErr = errors.Join(retErr, rows.Close()) }()
	keyPositions := make([]int64, len(t.Columns))
	for i, k := range t.Key {
		keyPositions[k] = int64(i + 1)
	}
	i := 0
	for rows.Next() {
		var name, typ, nullable string
		var key sql.NullInt64
		if err := rows.Scan(&name, &typ, &nullable, &key); err != nil {
			return err
		}
		if i >= len(t.Columns) {
			return fmt.Errorf("schema has extra columns in %s", t.Name)
		}
		c := t.Columns[i]
		want := c.SQLType
		if engine == "mo" && want == "INTEGER" {
			want = "INT"
		}
		if engine == "duckdb" && c.Kind == "text" {
			want = "VARCHAR"
		}
		typ = strings.ReplaceAll(strings.ToUpper(typ), " ", "")
		if !strings.EqualFold(name, c.Name) || typ != want || nullable != "NO" || key.Int64 != keyPositions[i] {
			return fmt.Errorf("schema differs for %s.%s: column=%s type=%s nullable=%s key_position=%d; want type=%s NOT NULL key_position=%d", t.Name, c.Name, name, typ, nullable, key.Int64, want, keyPositions[i])
		}
		i++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if i != len(t.Columns) {
		return fmt.Errorf("schema has %d columns in %s; want %d", i, t.Name, len(t.Columns))
	}
	return nil
}

type inputRows struct {
	f        *os.File
	scanner  *bufio.Scanner
	table    Table
	pending  Row
	previous Row
	group    []Row
	at       int
}

func openInput(path string, t Table) (*inputRows, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	s := bufio.NewScanner(f)
	s.Buffer(make([]byte, 64<<10), 1<<20)
	return &inputRows{f: f, scanner: s, table: t}, nil
}
func (r *inputRows) line() (Row, error) {
	if r.pending != nil {
		x := r.pending
		r.pending = nil
		return x, nil
	}
	if !r.scanner.Scan() {
		if err := r.scanner.Err(
```

### Core Architecture Module: `optools/tpch_compare/profile_worker.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"runtime/metrics"
	"runtime/pprof"
	"strconv"
)

type ProfileSpec struct {
	Kind string `json:"kind"`
}
type RuntimeMetric struct {
	Value string `json:"value"`
	Kind  string `json:"kind"`
}

type runtimeEvidence struct{ before, after map[string]RuntimeMetric }

func runtimeSnapshot() map[string]RuntimeMetric {
	names := []string{"/gc/gogc:percent", "/gc/gomemlimit:bytes", "/gc/cycles/total:gc-cycles", "/gc/heap/allocs:bytes", "/gc/heap/allocs:objects", "/memory/classes/heap/objects:bytes", "/cpu/classes/gc/mark/assist:cpu-seconds", "/cpu/classes/gc/total:cpu-seconds"}
	samples := make([]metrics.Sample, len(names))
	for i, name := range names {
		samples[i].Name = name
	}
	metrics.Read(samples)
	out := map[string]RuntimeMetric{}
	for _, sample := range samples {
		switch sample.Value.Kind() {
		case metrics.KindUint64:
			out[sample.Name] = RuntimeMetric{strconv.FormatUint(sample.Value.Uint64(), 10), "uint64"}
		case metrics.KindFloat64:
			out[sample.Name] = RuntimeMetric{strconv.FormatFloat(sample.Value.Float64(), 'g', -1, 64), "float64"}
		}
	}
	return out
}

func goProfileSnapshot(root, prefix, kind string) error {
	names := []string{"allocs", "heap"}
	if kind == "wait" {
		names = []string{"block", "mutex", "goroutine"}
	}
	for _, name := range names {
		p := pprof.Lookup(name)
		if p == nil {
			return fmt.Errorf("go profile %s unavailable", name)
		}
		f, err := os.OpenFile(filepath.Join(root, prefix+"-"+name+".pb.gz"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			return err
		}
		err = p.WriteTo(&limitedWriter{Writer: f, Remaining: 256 << 20}, 0)
		err = errors.Join(err, f.Close())
		if err != nil {
			return err
		}
	}
	return nil
}

func workerProfileStart(r WorkerRequest) (func() error, error) {
	if r.Profile == nil {
		return func() error { return nil }, nil
	}
	if r.Profile.Kind == "wait" {
		runtime.SetBlockProfileRate(1)
		old := runtime.SetMutexProfileFraction(1)
		return func() error { runtime.SetBlockProfileRate(0); runtime.SetMutexProfileFraction(old); return nil }, nil
	}
	return func() error { return nil }, nil
}

func configureNativeProfile(ctx context.Context, conn *sql.Conn, r WorkerRequest) error {
	if r.Profile == nil || r.Profile.Kind != "operator" || r.Engine.Name != "duckdb" {
		return nil
	}
	for _, s := range []string{"SET profiling_mode = 'detailed'", "SET profiling_coverage = 'ALL'", "SET enable_profiling = 'json'"} {
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	return nil
}

type nativeProfile struct {
	engine, root, prefix string
	selectIndex          int
	plainSelect          string
}

func (n *nativeProfile) statement(ctx context.Context, conn *sql.Conn, index int) error {
	if n == nil {
		return nil
	}
	if n.engine == "mo" && index == n.selectIndex {
		rows, err := conn.QueryContext(ctx, "EXPLAIN FORMAT=JSON "+n.plainSelect)
		if err != nil {
			return err
		}
		defer rows.Close()
		var value string
		if !rows.Next() {
			return errors.Join(errors.New("MO structured plan is empty"), rows.Err())
		}
		if err := rows.Scan(&value); err != nil {
			return err
		}
		if rows.Next() {
			return errors.New("MO structured plan has unexpected rows")
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if len(value) > 16<<20 {
			return errors.New("MO structured plan exceeds bound")
		}
		return os.WriteFile(filepath.Join(n.root, n.prefix+"-plan.json"), []byte(value), 0600)
	}
	if n.engine != "duckdb" {
		return nil
	}
	path := filepath.Join(n.root, fmt.Sprintf("%s-statement-%d.json", n.prefix, index))
	_, err := conn.ExecContext(ctx, "SET profiling_output = "+quoteSQL(path))
	return err
}

```

### Core Architecture Module: `optools/tpch_compare/worker.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

type WorkerRequest struct {
	Version         int           `json:"version"`
	Operation       string        `json:"operation"`
	Engine          Engine        `json:"engine"`
	DatasetRoot     string        `json:"dataset_root"`
	OutputRoot      string        `json:"output_root"`
	Queries         []int         `json:"queries,omitempty"`
	Repetitions     int           `json:"repetitions,omitempty"`
	QueryDeadlineNS int64         `json:"query_deadline_ns"`
	Reference       bool          `json:"reference,omitempty"`
	Unlimited       bool          `json:"unlimited_diagnostic,omitempty"`
	Clients         int           `json:"clients,omitempty"`
	Warmup          bool          `json:"warmup,omitempty"`
	Seed            uint64        `json:"seed,omitempty"`
	DeadlinesNS     map[int]int64 `json:"deadlines_ns,omitempty"`
	Profile         *ProfileSpec  `json:"profile,omitempty"`
	WarmupSelected  bool          `json:"warmup_selected_only,omitempty"`
	MaxWindowNS     int64         `json:"max_window_ns,omitempty"`
}
type QueryReceipt struct {
	Query      int     `json:"query"`
	Repetition int     `json:"repetition"`
	Capture    Capture `json:"capture"`
	Error      string  `json:"error,omitempty"`
	Reference  string  `json:"reference,omitempty"`
	Stream     int     `json:"stream,omitempty"`
}
type WorkerReceipt struct {
	Version       int                      `json:"version"`
	Engine        string                   `json:"engine"`
	EngineVersion string                   `json:"engine_version"`
	GoVersion     string                   `json:"go_version"`
	Build         string                   `json:"build"`
	Dataset       FileID                   `json:"dataset"`
	Binary        FileID                   `json:"binary"`
	Settings      map[string]string        `json:"effective_settings"`
	Variant       string                   `json:"variant"`
	Started       time.Time                `json:"started"`
	Finished      time.Time                `json:"finished"`
	Queries       []QueryReceipt           `json:"queries,omitempty"`
	Load          *LoadReceipt             `json:"load,omitempty"`
	Error         string                   `json:"error,omitempty"`
	Cleanup       string                   `json:"cleanup"`
	WaveNS        int64                    `json:"wave_ns,omitempty"`
	Controlled    bool                     `json:"controlled,omitempty"`
	Clients       int                      `json:"clients,omitempty"`
	RuntimeBefore map[string]RuntimeMetric `json:"runtime_before,omitempty"`
	RuntimeAfter  map[string]RuntimeMetric `json:"runtime_after,omitempty"`
}

var identifier = regexp.MustCompile(`^[a-z][a-z0-9_]{0,62}$`)

func createMODatabase(ctx context.Context, e Engine) error {
	if !identifier.MatchString(e.Database) || !strings.HasPrefix(e.Database, "tpch_compare_") {
		return errors.New("invalid private database name")
	}
	cfg, err := mysql.ParseDSN(os.Getenv(e.DSNEnv))
	if err != nil {
		return errors.New("invalid MO DSN")
	}
	if cfg.Net != "tcp" || !strings.HasPrefix(cfg.Addr, "127.0.0.1:") {
		return errors.New("owned MO deployment must use numeric loopback")
	}
	cfg.DBName = ""
	cfg.Timeout = 10 * time.Second
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer db.Close()
	_, err = db.ExecContext(ctx, "CREATE DATABASE "+e.Database)
	return err
}

func runWorker(ctx context.Context, r WorkerRequest, control *workerControl) (out WorkerReceipt, retErr error) {
	out = WorkerReceipt{Version: formatVersion, Engine: r.Engine.Name, GoVersion: runtime.Version(), Started: time.Now().UTC(), Cleanup: "failed"}
	out.Variant = "qualification"
	if r.Clients == 0 {
		r.Clients = 1
	}
	out.Clients = r.Clients
	out.Controlled = control != nil
	if r.Unlimited {
		out.Variant = "unlimited_diagnostic"
	}
	if r.Profile != nil {
		if !slices.Contains([]string{"operator", "cpu", "alloc", "wait", "branches", "cache"}, r.Profile.Kind) {
			return out, errors.New("unsupported profile lens")
		}
		out.Variant = "profile_" + r.Profile.Kind
		if r.Profile.Kind == "operator" && r.Clients > 1 {
			return out, errors.New("native operator profiles require one connection")
		}
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		out.Build = info.String()
	}
	defer func() {
		out.Finished = time.Now().UTC()
		if retErr != nil {
			out.Error = retErr.Error()
		}
	}()
	if r.Version != formatVersion || r.Engine.Threads < 1 || r.Engine.Threads > 64 || r.Engine.MemoryBytes < 128<<20 || r.Repetitions < 0 || r.Repetitions > 2000 || r.QueryDeadlineNS <= 0 || r.Clients < 1 || r.Clients > 8 || r.Repetitions*r.Clients*len(r.Queries) > 4000 {
		return out, errors.New("invalid bounded worker request")
	}
	if r.MaxWindowNS < 0 || r.MaxWindowNS > int64(60*time.Second) {
		return out, errors.New("invalid diagnostic window cap")
	}
	if err := os.Mkdir(r.OutputRoot, 0750); err != nil {
		return out, fmt.Errorf("worker output must be a new directory: %w", err)
	}
	if err := publishJSON(filepath.Join(r.OutputRoot, "owner.json"), map[string]any{"purpose": "tpch-compare worker", "version": formatVersion}); err != nil {
		return out, err
	}
	d, err := loadDataset(r.DatasetRoot, r.Operation == "verify")
	if err != nil {
		return out, err
	}
	if r.Operation == "load" {
		if err := evictTree(r.DatasetRoot); err != nil {
			return out, err
		}
	}
	out.Dataset, err = identify(filepath.Join(r.DatasetRoot, "dataset.json"))
	if err != nil {
		return out, err
	}
	exe, err := os.Executable()
	if err != nil {
		return out, err
	}
	out.Binary, err = identify(exe)
	if err != nil {
		return out, err
	}
	if r.Operation == "load" && r.Engine.Name == "mo" {
		if err := createMODatabase(ctx, r.Engine); err != nil {
			return out, err
		}
	}
	db, err := openEngine(ctx, r.Engine)
	if err != nil {
		return out, err
	}
	defer func() {
		err := db.Close()
		retErr = errors.Join(retErr, err)
		if err == nil {
			out.Cleanup = "complete"
		}
	}()
	conn, err := configureConn(ctx, db, r.Engine)
	if err != nil {
		return out, err
	}
	defer func() { retErr = errors.Join(retErr, conn.Close()) }()
	if err := conn.QueryRowContext(ctx, "SELECT version()").Scan(&out.EngineVersion); err != nil {
		return out, err
	}
	out.Settings, err = effectiveSettings(ctx, conn, r.Engine.Name)
	if err != nil {
		return out, err
	}
	switch r.Operation {
	case "fixtures":
		return out, qualifyFixtures(ctx, conn, r.OutputRoot)
	case "load":
		receipt, err := bulkLoad(ctx, conn, r.Engine, r.DatasetRoot, d)
		out.Load = &receipt
		return out, err
	case "verify":
		for _, t := range d.Tables {
			if err := verifyTableSchema(ctx, conn, r.Engine.Name, t); err != nil {
				return out, err
			}
			if err := verifyTable(ctx, conn, r.DatasetRoot, t, d.Inputs[t.Name]); err != nil {
				return out, err
			}
		}
		return out, verifyRelationships(ctx, conn)
	case "queries":
		if r.Repetitions < 1 || len(r.Queries) < 1 || len(r.Queries) > 22 {
			return out, errors.New("nonempty bounded query selection required")
		}
		var evidence *runtimeEvidence
		if r.Profile != nil || r.MaxWindowNS > 0 {
			evidence = &runtimeEvidence{}
		}
		out.Queries, out.WaveNS, err = runQueryStreams(ctx, db, conn, r, d, control, evidence)
		if evidence != nil {
			out.RuntimeBefore, out.RuntimeAfter = evidence.before, evidence.after
		}
		return out, err
	default:
		return out, fmt.Errorf("unsupported worker operation %q", r.Operation)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #33031** (2026-11-20): **[4.2-dev] fix(mpool): stabilize physical realloc failure test**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Refs #32744  ## What this PR does / why we need it:  The Linux physical-reallocation failure test can abort the Go runtime under its process-local address-space limit. The 1 GiB target crosses the mpool high-watermark logging threshold before the allocator runs, and logging or GC can exhaust the 64 MiB headroom.  Backport the 512 MiB target from #28467 and use the 256 MiB headroom already used on main. The target remains larger than the available address space and the existing assertions still require a physical allocator rejection and verify ownership, accounting, profiling and contents for both source sizes and allocation paths.  If the allocator unexpectedly succeeds, retain the returned allocation for cleanup so the original assertion remains visible.  Validation: - Linux/arm64, Go 1.26.4: focused test passed 20 times with coverage and 5 times with coverage across MatrixOne packages. - Full mpool package passed with coverage and with the race detector. Incremental go vet, gofmt, and git diff --check passed. - An emulated amd64 container did not enforce the guest mapping limit, so native Linux/x86 CI is needed to validate the target runner. The emulator run did verify the unexpected-success cleanup path. - The larger process address-space headroom reduces runtime allocation pressure and remai

- **Issue #33029** (2026-11-20): **fix(cdc): preserve numeric-label ENUM members**
  *Symptoms*: ## What type of PR is this?  - [x] BUG  ## Which issue(s) this PR fixes  Fixes #32976  ## What this PR does / why we need it  CDC serialized MatrixOne ENUM ordinals as quoted SQL strings. In MySQL, a quoted numeric value can match a numeric ENUM label instead of selecting the member by ordinal, silently changing member identity for definitions such as `ENUM('0','1','2')`.  Serialize ENUM ordinals as integer literals so MySQL applies its documented ordinal assignment semantics. NULL handling remains unchanged.  ## Testing  - Regression-first: with only the expected output changed, `Test_convertColIntoSql` failed because actual output was `'1'` instead of `1`. - `go test ./pkg/cdc -run '^Test_convertColIntoSql$/enum_ordinal_is_not_quoted$' -count=1` - `go test ./pkg/cdc -count=1` - `git diff --check`  Independent review: APPROVE, no substantive findings.

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

### Incident Patch 1: `17df10b1` (2026-11-20)
**Commit Message**: fix: preserve TAE snapshot row IDs and stabilize main CI (#32957)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32951
Fixes #32946
Fixes #32893
Fixes #32953
Fixes #32956

Related to #32952, #32954, #32955, #32745 and #32885. The first three
issues stay open for Linux confirmation of tenant cleanup, a
duration-neutral batch deadline fix, and diagnosis of the remaining
embedded and multi-CN failures.

## What this PR does / why we need it:

- Seed the virtual-clock arena test with small buffers tracked by the
arena memory pool. This keeps it on the real arena list and reaper path
without installing a timer in the process-wide mmap cache.
- Preserve the caller's cancellation cause throughout WAL record reads,
including client checkout and retry backoff. Keep transient retries and
the closed-pool error.
- Choose a session offset distinct from the process offset in the
frontend temporal test without writing the global timezone.
- Consolidate tenant cleanup into one DROP ACCOUNT, which also removes
the tenant source database. Retain the two-min

**File**: `optools/run_ut.sh` (modified, +1/-1)
```diff
@@ -2338,7 +2338,7 @@ function run_prebuilt_race_commands(){
                 return 1
             fi
             checkpoint_ut_event start "${stage}" "${race_packages[index]}" "" \
-                "package_index=${index} prebuilt=true parallel=${parallel}"
+                "package_index=${index} prebuilt=true parallel=${parallel} timeout_seconds=${remaining}"
             set -m
             (
                 cd "${race_dirs[index]}" || exit 2
```

**File**: `pkg/common/morpc/client_lock_contention_test.go` (modified, +11/-21)
```diff
@@ -152,37 +152,27 @@ func TestGetBackendConcurrentWithSlowConnection(t *testing.T) {
 // TestGetBackendWithCircuitBreaker tests that circuit breaker prevents
 // repeated attempts to bad backends
 func TestGetBackendWithCircuitBreaker(t *testing.T) {
-	factory := &testBackendFactoryWithDelay{
-		delay:      10 * time.Millisecond,
-		shouldFail: true,
-	}
+	const remote = "bad-backend"
+	factory := &testBackendFactoryWithDelay{shouldFail: true}
 
 	rc, err := NewClient(
 		"test-client",
 		factory,
 		WithClientMaxBackendPerHost(2),
 		WithClientEnableAutoCreateBackend(),
+		WithClientCircuitBreaker(CircuitBreakerConfig{
+			Enabled: true, FailureThreshold: 1, ResetTimeout: time.Hour, HalfOpenMaxRequests: 1,
+		}),
 	)
 	require.NoError(t, err)
-	defer rc.Close()
+	t.Cleanup(func() { require.NoError(t, rc.Close()) })
 
 	c := rc.(*client)
-
-	// Trigger circuit breaker by recording failures
-	for i := 0; i < 10; i++ {
-		c.circuitBreakers.RecordFailure("bad-backend")
-	}
-
-	// getBackend should fail fast
-	start := time.Now()
-	b, err := c.getBackend("bad-backend", false)
-	elapsed := time.Since(start)
-
-	assert.Error(t, err)
-	assert.Nil(t, b)
-	// Should fail fast (either circuit breaker or no backend available)
-	assert.Less(t, elapsed, 20*time.Millisecond,
-		"Should fail fast with circuit breaker or no backend")
+	c.circuitBreakers.RecordFailure(remote)
+	b, err := c.getBackend(remote, false)
+	require.ErrorIs(t, err, ErrCircuitOpen)
+	require.Nil(t, b)
+	require.Zero(t, factory.createCount.Load())
 }
 
 // TestGetBackendWithClientClosed tests that getBackend handles
```

**File**: `pkg/frontend/time_zone_and_saved_temporal_test.go` (modified, +8/-5)
```diff
@@ -50,13 +50,16 @@ func TestConvertRowsIntoBatchTemporalText(t *testing.T) {
 		"2024-01-01 00:00:00.123456", "2024-01-01 00:00:00.999"})
 	mrs.AddRow([]any{nil, nil, nil, nil, nil})
 
-	session := time.FixedZone("session", 0)
+	// Keep the session and process offsets distinct at the fixture timestamp.
+	_, processOffset := time.Date(2024, 1, 1, 0, 0, 0, 0, time.Local).Zone()
+	sessionOffset := 0
+	if processOffset == 0 {
+		sessionOffset = 8 * 3600
+	}
+	session := time.FixedZone("session", sessionOffset)
 	pool, err := mpool.NewMPool("test", 0, mpool.NoFixed)
 	require.NoError(t, err)
-	// Use a process-local zone that differs from the session zone.
-	oldLocal := time.Local
-	time.Local = time.FixedZone("process", 8*3600)
-	defer func() { time.Local = oldLocal }()
+	t.Cleanup(func() { mpool.DeleteMPool(pool) })
 
 	data, colDefs, err := convertRowsIntoBatchInLocation(pool, mrs.Columns, mrs.Data, session)
 	require.NoError(t, err)
```

**File**: `pkg/objectio/arena_pool_test.go` (modified, +14/-11)
```diff
@@ -117,6 +117,7 @@ func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
 	// subtest owns its own bubble below.
 	for _, schedule := range []string{"normal first fire", "delayed first fire"} {
 		t.Run(schedule, func(t *testing.T) {
+			emptyArenaPool(ArenaLarge)
 			synctest.Test(t, func(t *testing.T) {
 				// Drain the reaper on every exit path, including failed
 				// assertions: this defer runs during Goexit while still
@@ -126,17 +127,18 @@ func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
 				defer drainArenaReaper(ArenaLarge)
 				const ttl = 150 * time.Millisecond
 				withArenaIdleTTL(t, ttl)
-				base := arenaMPool.CurrNB()
+				base := arenaMPool.OnHeapCurrNB()
 
-				// Within capacity, so perArena below divides by what is actually parked.
-				burst := make([]*WriteArena, min(8, arenaPools[ArenaLarge].maxCount))
-				for i := range burst {
-					burst[i] = GetArena(ArenaLarge)
+				// Track arena ownership through the same MPool without invoking
+				// the shared C allocator's timers under the virtual clock.
+				const seedSize = 1024
+				burst := min(8, arenaPools[ArenaLarge].maxCount)
+				for range burst {
+					data, err := arenaMPool.Alloc(seedSize, false)
+					require.NoError(t, err)
+					PutArena(&WriteArena{data: data, sizeLimit: arenaMaxSize})
 				}
-				for _, a := range burst {
-					PutArena(a)
-				}
-				perArena := (arenaMPool.CurrNB() - base) / int64(len(burst))
+				require.Equal(t, base+int64(burst*seedSize), arenaMPool.OnHeapCurrNB())
 
 				pool := &arenaPools[ArenaLarge]
 				holdFirstReaper := schedule != "normal first fire"
@@ -154,7 +156,7 @@ func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
 				// pool. Pool-owned arenas are released by withArenaIdleTTL's
 				// cleanup; releasing the borrowed one here covers a failed
 				// assertion mid-borrow without leaking or double-freeing
-				// off-heap buffers.
+				// buffers.
 				var borrowed *WriteArena
 				t.Cleanup(func() {
 					if borrowed != nil {
@@ -170,6 +172,7 @@ func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
 					if n == 1 {
 						break
 					}
+					require.Positive(t, n, "the seeded pool must retain the working arena")
 					if holdFirstReaper && time.Since(start) >= 6*ttl {
 						// Re-arm the held reaper after the old fixed warmup
 						// (4*ttl) plus the TTL has elapsed in bubble time,
@@ -201,7 +204,7 @@ func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
 				n, survivor := parkedLargeSnapshot()
 				require.Equal(t, 1, n, "the cold burst arenas age out while the pool stays busy")
 				require.Same(t, steady, survivor, "the surviving parked arena is the one the workload kept reusing")
-				require.Equal(t, base+perArena, arenaMPool.CurrNB(), "only the working arena's memory is kept")
+				require.Equal(t, base+seedSize, arenaMPool.OnHeapCurrNB(), "only the working arena's memory is kept")
 			})
 		})
 	}
```

**File**: `pkg/tests/issues/issue_29133_policy_refresh_test.go` (modified, +29/-17)
```diff
@@ -17,6 +17,7 @@ package issues
 import (
 	"context"
 	"database/sql"
+	"errors"
 	"fmt"
 	"testing"
 	"time"
@@ -36,7 +37,7 @@ func TestIssue29133RoleRulesTrackRemoteChanges(t *testing.T) {
 			ctx, cancel := context.WithTimeout(t.Context(), 120*time.Second)
 			defer cancel()
 			var tenantPools []*sql.DB
-			open := func(index int, user string) *sql.Conn {
+			open := func(index int, user string) (*sql.DB, *sql.Conn) {
 				t.Helper()
 				cn, err := c.GetCNService(index)
 				require.NoError(t, err)
@@ -48,29 +49,39 @@ func TestIssue29133RoleRulesTrackRemoteChanges(t *testing.T) {
 				}
 				conn, err := db.Conn(ctx)
 				require.NoError(t, err)
-				t.Cleanup(func() { require.NoError(t, conn.Close()) })
-				return conn
+				t.Cleanup(func() {
+					if err := conn.Close(); !errors.Is(err, sql.ErrConnDone) {
+						assert.NoError(t, err)
+					}
+				})
+				return db, conn
 			}
-			admin := open(0, "dump")
+			adminPool, admin := open(0, "dump")
 			mustExec(t, ctx, admin, "create account rule_refresh admin_name 'admin' identified by '111'")
 			// Register before tenant resources so their LIFO cleanup completes before
-			// DROP ACCOUNT kills sessions. The admin connection remains usable.
+			// DROP ACCOUNT kills sessions. Use the pool so an earlier SQL
+			// cancellation cannot leave cleanup pinned to a discarded session.
 			t.Cleanup(func() {
 				for _, db := range tenantPools {
 					assert.Zero(t, db.Stats().OpenConnections, "tenant pool still open before DROP ACCOUNT")
 				}
+				if t.Failed() {
+					// The fixture owner retires the failed cluster.
+					return
+				}
 				cleanup, stop := context.WithTimeout(context.Background(), 30*time.Second)
-				_, err := admin.ExecContext(cleanup, "drop account rule_refresh")
-				stop()
-				assert.NoError(t, err)
-				cleanup, stop = context.WithTimeout(context.Background(), 30*time.Second)
 				defer stop()
+				if _, err := adminPool.ExecContext(cleanup, "drop account rule_refresh"); !assert.NoError(t, err) {
+					return
+				}
+				check, stopCheck := context.WithTimeout(context.Background(), 30*time.Second)
+				defer stopCheck()
 				var remaining int
-				err = admin.QueryRowContext(cleanup, "select count(*) from mo_catalog.mo_account where account_name='rule_refresh'").Scan(&remaining)
-				assert.NoError(t, err)
-				assert.Zero(t, remaining)
+				if assert.NoError(t, adminPool.QueryRowContext(check, "select count(*) from mo_catalog.mo_account where account_name='rule_refresh'").Scan(&remaining)) {
+					assert.Zero(t, remaining)
+				}
 			})
-			owner := open(0, "rule_refresh#admin#accountadmin")
+			_, owner := open(0, "rule_refresh#admin#accountadmin")
 			for _, statement := range []string{
 				"create database app", "create table app.t(id int primary key, tenant int)",
 				"insert into app.t values (1,1),(2,2)", "create role reader",
@@ -81,9 +92,9 @@ func TestIssue29133RoleRulesTrackRemoteChanges(t *testing.T) {
 				mustExec(t, ctx, owner, statement)
 			}
 			mustExec(t, ctx, admin, "select mo_ctl('cn','synccommit','')")
-			reader := open(1, "rule_refresh#learner#reader")
-			binaryReader := open(1, "rule_refresh#learner#reader")
-			sqlReader := open(1, "rule_refresh#learner#reader")
+			_, reader := open(1, "rule_refresh#learner#reader")
+			_, binaryReader := open(1, "rule_refresh#learner#reader")
+			_, sqlReader := open(1, "rule_refresh#learner#reader")
 			const query = "select id from app.t order by id"
 			checkRows := func(query func() (*sql.Rows, error), expected []int) {
 				t.Helper()
@@ -170,7 +181,8 @@ func TestIssue29133RoleRulesTrackRemoteChanges(t *testing.T) {
 				// relying on a preceding text command on that connection.
 				needReprepare(func() (*sql.Rows, error) { return binary.QueryContext(ctx) })
 				needReprepare(func() (*sql.Rows, error) { return sqlReader.QueryContext(ctx, "execute saved") })
-				check(open(1, "rule_refresh#learner#reader"), transition.expected)
+				_, freshReader := open(1, "rule_refresh#learner#reader")
+				check(freshReader, transition.expected)
 				check(reader, transition.expected)
 				check(reader, transition.expected)
 				require.NoError(t, binary.Close())
```

**File**: `pkg/tests/issues/issue_30411_test.go` (modified, +57/-28)
```diff
@@ -42,6 +42,10 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 		const database = "load_duplicate_primary_keys"
 		execSQLRequire(t, ctx, db, "create database "+database)
 		defer func() {
+			if t.Failed() {
+				// The shared fixture retires this generation on failure.
+				return
+			}
 			cleanup, stop := context.WithTimeout(context.Background(), 20*time.Second)
 			defer stop()
 			execSQLRequire(t, cleanup, db, "drop database "+database)
@@ -81,7 +85,7 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 			return fmt.Sprintf("load data infile '%s' into table %s fields terminated by ','", path, table)
 		}
 
-		t.Run("session policy and cached statements", func(t *testing.T) {
+		if !t.Run("session policy and cached statements", func(t *testing.T) {
 			var enabled int
 			require.NoError(t, conn.QueryRowContext(ctx, "select @@session.mo_pk_check_by_cn").Scan(&enabled))
 			require.Zero(t, enabled)
@@ -135,9 +139,10 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 				require.Equal(t, uint16(1062), duplicate.Number)
 				require.Zero(t, count(t, "switch_load"), "prepared INSERT keeps validation and rollback across SETs")
 			}
-		})
-		t.Run("procedure session policy and rollback", func(t *testing.T) {
-			defer func() { _, _ = conn.ExecContext(ctx, "set session mo_pk_check_by_cn=off") }()
+		}) {
+			return
+		}
+		if !t.Run("procedure session policy and rollback", func(t *testing.T) {
 			exec(t, "create table procedure_load(id bigint primary key,name varchar(20))")
 			// Reuse fixed procedure definitions across SETs. Only the owning
 			// connection's current policy may determine LOAD validation.
@@ -152,7 +157,7 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 			for round, on := range []bool{true, false, true} {
 				exec(t, fmt.Sprintf("set session mo_pk_check_by_cn=%t", on))
 				for i, query := range duplicate {
-					t.Run(fmt.Sprintf("round=%d/on=%t/%s", round, on, modes[i]), func(t *testing.T) {
+					if !t.Run(fmt.Sprintf("round=%d/on=%t/%s", round, on, modes[i]), func(t *testing.T) {
 						exec(t, "truncate table procedure_load")
 						if on {
 							requireDuplicate(t, query)
@@ -161,13 +166,15 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 							exec(t, query)
 							require.Equal(t, 2, count(t, "procedure_load"), "OFF with TN OFF bypasses CN validation at every call depth")
 						}
-					})
+					}) {
+						return
+					}
 				}
 			}
 			conflicts := procedure("load_target_conflict", "2,new\n1,conflict\n", "")
 			valid := procedure("load_valid", "2,new\n3,new\n", "")
 			for i, query := range conflicts {
-				t.Run("target conflict and recovery/"+modes[i], func(t *testing.T) {
+				if !t.Run("target conflict and recovery/"+modes[i], func(t *testing.T) {
 					exec(t, "truncate table procedure_load")
 					exec(t, "insert into procedure_load values(1,'old')")
 					requireDuplicate(t, query)
@@ -177,7 +184,9 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 					require.Equal(t, "old", payload)
 					exec(t, valid[i])
 					require.Equal(t, 3, count(t, "procedure_load"), "same call depth remains usable after rejection")
-				})
+				}) {
+					return
+				}
 			}
 			for i, declaration := range []string{
 				"declare mo_pk_check_by_cn int; ",
@@ -188,7 +197,7 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 				for _, on := range []bool{true, false} {
 					exec(t, fmt.Sprintf("set session mo_pk_check_by_cn=%t", on))
 					for depth, query := range queries[1:] {
-						t.Run(fmt.Sprintf("local collision=%d/on=%t/%s", i, on, modes[depth+1]), func(t *testing.T) {
+						if !t.Run(fmt.Sprintf("local collision=%d/on=%t/%s", i, on, modes[depth+1]), func(t *testing.T) {
 							exec(t, "truncate table procedure_load")
 							if on {
 								requireDuplicate(t, query)
@@ -197,22 +206,28 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 								exec(t, query)
 								require.Equal(t, 2, count(t, "procedure_load"))
 							}
-						})
+						}) {
+							return
+						}
 					}
 				}
 			}
-		})
-		// The existing correctness suite exercises the explicitly enabled policy.
+		}) {
+			return
+		}
+		// The remaining cases exercise the explicitly enabled policy.
 		exec(t, "set session mo_pk_check_by_cn=on")
 		exec(t, "create table t(id bigint primary key, name varchar(256))")
-		t.Run("input duplicate and rollback", func(t *testing.T) {
+		if !t.Run("input duplicate and rollback", func(t *testing.T) {
 			path := writeInput(t, "duplicate.csv", "1,a\n1,b\n")
 			requireDuplicate(t, load(path, "t"))
 			require.Zero(t, count(t, "t"))
 			requireDuplicate(t, "insert into t values(1,'a'),(1,'b')")
 			require.Zero(t, count(t, "t"))
-		})
-		t.Run("existing row collision and rollback", func(t *testing.T) {
+		}) {
+			return
+		}
+		if !t.Run("existing row collision and rollback", func(t *testing.T) {
 			exec(t, "insert into t values(1,'old')")
 			path := writeInput(t, "existing.csv", "2,ne
```

**File**: `pkg/tests/issues/issue_31401_scalar_test.go` (modified, +4/-12)
```diff
@@ -117,19 +117,11 @@ func TestIssue31401ScalarRefreshProgress(t *testing.T) {
 					require.NoError(t, err)
 					defer db.Close()
 				}
-				var tenantSourceOwned bool
-				defer func() {
-					if tenantSourceOwned {
-						_ = cleanupSQL(db.ExecContext, 10*time.Second, "drop database if exists "+source)
-					}
-				}()
-				// The next selected child already resets both databases. Keep
-				// system resources until that reset, then clean the final pair once.
-				// Tenant source cleanup still precedes its dependent DROP ACCOUNT.
+				// Each case resets both databases. Keep system resources until
+				// the next reset, then clean the final pair once. DROP ACCOUNT
+				// owns removal of the tenant's source database.
 				resetIssue277xxDatabase(t, ctx, db, source)
-				if tenant {
-					tenantSourceOwned = true
-				} else {
+				if !tenant {
 					systemSourceOwned = true
 				}
 				resetIssue277xxDatabase(t, ctx, sys, peer)
```

**File**: `pkg/vm/engine/tae/db/test/db_test.go` (modified, +21/-3)
```diff
@@ -69,6 +69,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/options"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tables"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tables/jobs"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tables/updates"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tasks"
 	ops "github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tasks/worker"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/testutils"
@@ -4267,14 +4268,25 @@ func TestV9FlushPreservesRowIDAcrossAbortHole(t *testing.T) {
 	require.NoError(t, abortTxn.PrePrepare(ctx))
 	require.NoError(t, abortTxn.PreApplyCommit())
 	require.NoError(t, abortTxn.Rollback(ctx))
+
+	// Insert a terminal reservation with no prepare timestamp. Unlike the
+	// rollback above, the range collector omits this slot entirely. The
+	// following ordinary append still uses the next physical offset.
+	gapTxn, gapRel := tae.GetRelation()
+	metas := testutil.GetAllAppendableMetas(gapRel, false)
+	require.Len(t, metas, 1)
+	gap := updates.NewAppendNode(nil, 2, 3, false, nil)
+	gap.Start, gap.End, gap.Aborted = abortTxn.GetStartTS(), abortTxn.GetCommitTS(), true
+	require.NoError(t, metas[0].GetObjectData().OnReplayAppend(gap))
+	require.NoError(t, gapTxn.Rollback(ctx))
 	tae.DoAppend(tail)
 
 	deleteTxn, deleteRel := tae.GetRelation()
 	sortKeyIdx := schema.GetSingleSortKeyIdx()
 	key := tail.Vecs[sortKeyIdx].Get(0)
 	id, offset, err := deleteRel.GetByFilter(ctx, handle.NewEQFilter(key))
 	require.NoError(t, err)
-	require.Equal(t, uint32(2), offset, "rollback hole must retain its physical slot")
+	require.Equal(t, uint32(3), offset, "both holes must retain their physical slots")
 	oldBlockID := id.BlockID
 	require.NoError(t, deleteRel.RangeDelete(id, offset, offset, handle.DT_Normal))
 	require.NoError(t, deleteTxn.Commit(ctx))
@@ -4297,8 +4309,14 @@ func TestV9FlushPreservesRowIDAcrossAbortHole(t *testing.T) {
 
 	// The historical snapshot is held open while the aobject location is
 	// replaced, so it cannot use tombstones transferred by the later flush.
-	// Its tombstone still targets original offset 2; it must hide that row while
-	// preserving the later live row at offset 3.
+	// Its tombstone targets physical offset 3 and the surviving value is still
+	// at offset 4 in both point-read paths.
+	for _, skipDeleteCheck := range []bool{false, true} {
+		value, isNull, err := snapshotRel.GetValue(id, 4, uint16(sortKeyIdx), skipDeleteCheck)
+		require.NoError(t, err)
+		require.False(t, isNull)
+		require.Equal(t, rows.Vecs[sortKeyIdx].Get(3), value)
+	}
 	var view *containers.Batch
 	err = tables.HybridScanByBlock(
 		ctx,
```

---

### Incident Patch 2: `fa7b7d84` (2026-11-20)
**Commit Message**: [Bug] Recover from invalid and failed exported log snapshots (#32853)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32842
Fixes #32836

## What this PR does / why we need it:

- Validate exported snapshots before import. Remove a definitively
invalid candidate and try an older export while preserving the TN replay
watermark check. Keep transient read and removal errors retryable
without compacting the Raft log.
- Upgrade to the merged Dragonboat fixes in
[#21](https://github.com/matrixorigin/dragonboat/pull/21) and
[#22](https://github.com/matrixorigin/dragonboat/pull/22). Export worker
failures return an error instead of terminating LogService, and
malformed exported metadata or image headers return an
incomplete-snapshot result instead of panicking.
- Retain an admitted export request across a caller timeout, then
reconcile its final worker result before retrying. After a same-process
replica restart, use Dragonboat's successful restart as confirmation
that the previous worker stopped, clean its abandoned export, and
release the old exp

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ replace github.com/hashicorp/memberlist => github.com/matrixorigin/memberlist v0
 replace (
 	github.com/elastic/gosigar v0.14.2 => github.com/matrixorigin/gosigar v0.14.3-0.20241204071856-40aab500bfac
 	github.com/fagongzi/goetty/v2 v2.0.3-0.20230628075727-26c9a2fd5fb8 => github.com/matrixorigin/goetty/v2 v2.0.0-20260811155919-8edc32ac370a
-	github.com/lni/dragonboat/v4 v4.0.0-20220815145555-6f622e8bcbef => github.com/matrixorigin/dragonboat/v4 v4.0.0-20261106075629-8ed6c83d529b
+	github.com/lni/dragonboat/v4 v4.0.0-20220815145555-6f622e8bcbef => github.com/matrixorigin/dragonboat/v4 v4.0.0-20261120034006-a361da8862a7
 	github.com/lni/goutils v1.3.1-0.20220604063047-388d67b4dbc4 => github.com/matrixorigin/goutils v1.3.1-0.20220604063047-388d67b4dbc4
 	github.com/lni/vfs v0.2.1-0.20220616104132-8852fd867376 => github.com/matrixorigin/vfs v0.2.1-0.20220616104132-8852fd867376
 )
```

**File**: `go.sum` (modified, +4/-2)
```diff
@@ -524,8 +524,10 @@ github.com/lufia/plan9stats v0.0.0-20211012122336-39d0f177ccd0/go.mod h1:zJYVVT2
 github.com/lufia/plan9stats v0.0.0-20260330125221-c963978e514e h1:Q6MvJtQK/iRcRtzAscm/zF23XxJlbECiGPyRicsX+Ak=
 github.com/lufia/plan9stats v0.0.0-20260330125221-c963978e514e/go.mod h1:autxFIvghDt3jPTLoqZ9OZ7s9qTGNAWmYCjVFWPX/zg=
 github.com/magiconair/properties v1.8.0/go.mod h1:PppfXfuXeibc/6YijjN8zIbojt8czPbwD3XqdrwzmxQ=
-github.com/matrixorigin/dragonboat/v4 v4.0.0-20261106075629-8ed6c83d529b h1:gflqGAAr3KsFDLWuLxZ9YpJNEgtfo2bxprirlnCJ6cU=
-github.com/matrixorigin/dragonboat/v4 v4.0.0-20261106075629-8ed6c83d529b/go.mod h1:B1VfuDzGm7Uk0xoRkRJynA6n4i31m/1ZJIPfIyJfYQg=
+github.com/matrixorigin/dragonboat/v4 v4.0.0-20261117092219-03ee395d73dd h1:dtfdSrdd3GAppYxM5vW/GVJlZkPigKdTxB8UuBCto9Y=
+github.com/matrixorigin/dragonboat/v4 v4.0.0-20261117092219-03ee395d73dd/go.mod h1:B1VfuDzGm7Uk0xoRkRJynA6n4i31m/1ZJIPfIyJfYQg=
+github.com/matrixorigin/dragonboat/v4 v4.0.0-20261120034006-a361da8862a7 h1:z9Wv1Xkbx2lT5ZOzXzxqfSsfj4nkTdWGrVgErqV96FE=
+github.com/matrixorigin/dragonboat/v4 v4.0.0-20261120034006-a361da8862a7/go.mod h1:B1VfuDzGm7Uk0xoRkRJynA6n4i31m/1ZJIPfIyJfYQg=
 github.com/matrixorigin/goetty/v2 v2.0.0-20260811155919-8edc32ac370a h1:D8kXjySDJHA8nyZzzi/4cx3KB6qrSPQeugUCLkgoEho=
 github.com/matrixorigin/goetty/v2 v2.0.0-20260811155919-8edc32ac370a/go.mod h1:OwIBpVwRW1HjF/Jhc2Av3UvG2NygMg+bdqGxZaqwhU0=
 github.com/matrixorigin/gosigar v0.14.3-0.20241204071856-40aab500bfac h1:KRPOwOcSZRfWT7w8mr7BmFLoFB75ljgqjkg47xkN/Pc=
```

**File**: `pkg/logservice/snapshot.go` (modified, +249/-39)
```diff
@@ -22,6 +22,7 @@ import (
 	"sort"
 	"sync"
 
+	"github.com/lni/dragonboat/v4"
 	"github.com/lni/vfs"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 )
@@ -70,11 +71,6 @@ func (si *snapshotItem) Exists() bool {
 	return err == nil
 }
 
-// Remove implements the ISnapshotItem interface.
-func (si *snapshotItem) Remove() error {
-	return si.fs.RemoveAll(si.dir)
-}
-
 // Valid implements the ISnapshotItem interface.
 func (si *snapshotItem) Valid() (bool, error) {
 	names, err := si.fs.List(si.dir)
@@ -113,6 +109,15 @@ type snapshotRecord struct {
 	// publish a final directory, even after StopReplica returns.
 	activeExports      int
 	lateExportPossible bool
+	// Keep the Dragonboat result after the caller's shorter context expires.
+	// The truncation worker owns and consumes this single pending result.
+	pendingExport *dragonboat.RequestState
+	// StartReplica has confirmed that the previous replica's snapshot worker
+	// has stopped. Wait for its caller to return before reconciling old files.
+	previousReplicaStopped bool
+	// A confirmed failed export left an abandoned directory that could not
+	// be removed. Retry cleanup before the next export at the same index.
+	failedExportCleanup bool
 }
 
 var errSnapshotExportPending = moerr.NewInternalErrorNoCtx("exported snapshot may still be written")
@@ -173,18 +178,53 @@ func (ss *snapshotRecord) add(index snapshotIndex, dir string) error {
 	return nil
 }
 
-// removeFirst removes the first snapshot from snapshot item list.
-func (ss *snapshotRecord) removeFirst() error {
-	if first := ss.first(); first != nil {
-		if err := first.Remove(); err != nil {
+// removeAt renames a completed export before deleting its contents. Once the
+// canonical name is gone, the item must leave the inventory even if cleanup
+// fails: the durable .removing name owns the retry across a process restart.
+func (ss *snapshotRecord) removeAt(i int) error {
+	item := ss.items[i]
+	parent := filepath.Dir(item.dir)
+	removing := ss.fs.PathJoin(parent,
+		fmt.Sprintf(snapshotPathPattern+"-%d.removing", item.index, ss.nodeID.replicaID))
+	renamed := true
+	if err := ss.fs.Rename(item.dir, removing); err != nil {
+		if !errors.Is(err, os.ErrNotExist) {
 			return err
 		}
+		// A missing export cannot be renamed. Confirm the canonical path is
+		// gone before releasing its inventory slot; an ENOENT from Rename
+		// while the source still exists or a transient Stat error must retry.
+		if _, statErr := ss.fs.Stat(item.dir); !errors.Is(statErr, os.ErrNotExist) {
+			return errors.Join(err, statErr)
+		}
+		renamed = false
+	}
+	copy(ss.items[i:], ss.items[i+1:])
+	ss.items[len(ss.items)-1] = nil
+	ss.items = ss.items[:len(ss.items)-1]
+	putSnapshotItem(item)
+	if !renamed {
+		return nil
+	}
+	if err := syncExportDir(ss.fs, parent); err != nil {
+		ss.failedExportCleanup = true
+		return err
+	}
+	if err := ss.fs.RemoveAll(removing); err != nil {
+		ss.failedExportCleanup = true
+		return err
 	}
-	putSnapshotItem(ss.items[0])
-	ss.items = ss.items[1:]
 	return nil
 }
 
+// removeFirst removes the first snapshot from snapshot item list.
+func (ss *snapshotRecord) removeFirst() error {
+	if len(ss.items) == 0 {
+		return nil
+	}
+	return ss.removeAt(0)
+}
+
 // removeLast removes the last (newest) snapshot from the snapshot item
 // list. Used by the truncation loop's timeout-path escape valve to
 // prefer preserving older items, which are more likely to be importable
@@ -194,29 +234,41 @@ func (ss *snapshotRecord) removeLast() error {
 	if l == 0 {
 		return nil
 	}
-	last := ss.items[l-1]
-	if err := last.Remove(); err != nil {
-		return err
+	return ss.removeAt(l - 1)
+}
+
+// removeIndex removes a known unusable export without disturbing newer or
+// older candidates. The Raft log is compacted only after a successful import.
+func (ss *snapshotRecord) removeIndex(index snapshotIndex) (bool, error) {
+	for i, item := range ss.items {
+		if item.index != index {
+			continue
+		}
+		if err := ss.removeAt(i); err != nil {
+			return false, err
+		}
+		return true, nil
 	}
-	putSnapshotItem(last)
-	ss.items = ss.items[:l-1]
-	return nil
+	return false, nil
 }
 
 // remove the snapshots whose index is LE than the index.
 func (ss *snapshotRecord) remove(index snapshotIndex) error {
-	items := make([]*snapshotItem, len(ss.items))
-	copy(items, ss.items)
-	for _, si := range items {
-		if si.index <= index {
-			if err := ss.removeFirst(); err != nil {
-				return err
+	var cleanupErr error
+	for first := ss.first(); first != nil && first.index <= index; first = ss.first() {
+		count := len(ss.items)
+		if err := ss.removeFirst(); err != nil {
+			cleanupErr = errors.Join(cleanupErr, err)
+			if len(ss.items) == count {
+				// Rename failed, so the current item is still canonical and
+				// retained in the inventory for an explicit retry.
+				return cleanupErr
 			}
-		} else {
-			break
+			// A tombstone owns this item's retry. Finish removing the other
+			// images alrea
```

**File**: `pkg/logservice/snapshot_test.go` (modified, +332/-4)
```diff
@@ -17,6 +17,7 @@ package logservice
 import (
 	"fmt"
 	"os"
+	"strings"
 	"testing"
 
 	"github.com/lni/vfs"
@@ -197,6 +198,253 @@ type removeErrorFS struct{ vfs.FS }
 
 func (fs removeErrorFS) RemoveAll(string) error { return os.ErrPermission }
 
+type partialSnapshotRemovalFS struct {
+	vfs.FS
+	failed bool
+}
+
+type retryParentSyncFS struct {
+	vfs.FS
+	syncCalls int
+}
+
+type retryParentSyncDir struct {
+	vfs.File
+	fs *retryParentSyncFS
+}
+
+func (dir *retryParentSyncDir) Sync() error {
+	dir.fs.syncCalls++
+	if dir.fs.syncCalls == 1 {
+		return os.ErrPermission
+	}
+	return dir.File.Sync()
+}
+
+func (fs *retryParentSyncFS) OpenDir(path string) (vfs.File, error) {
+	dir, err := fs.FS.OpenDir(path)
+	if err != nil {
+		return nil, err
+	}
+	return &retryParentSyncDir{File: dir, fs: fs}, nil
+}
+
+func (fs *retryParentSyncFS) RemoveAll(path string) error {
+	if strings.HasSuffix(path, ".removing") && fs.syncCalls < 2 {
+		return os.ErrInvalid
+	}
+	return fs.FS.RemoveAll(path)
+}
+
+func TestReconcileInterruptedExportSyncsTombstoneOnRetry(t *testing.T) {
+	fs := &retryParentSyncFS{FS: vfs.NewStrictMem()}
+	mgr := newSnapshotManager(&Config{FS: fs, SnapshotExportDir: "/tmp/exported"})
+	nid := nodeID{shardID: 1, replicaID: 2}
+	testPrepareSnapshot(t, mgr, nid, 100)
+	final := mgr.snapshotPath(nid, 100)
+	flag, err := fs.Create(fs.PathJoin(final, "dragonboat.snapshot.message"))
+	require.NoError(t, err)
+	require.NoError(t, flag.Close())
+
+	require.ErrorIs(t, mgr.ReconcileInterruptedExport(nid.shardID, nid.replicaID), os.ErrPermission)
+	_, err = fs.Stat(final + "-2.removing")
+	require.NoError(t, err)
+	require.NoError(t, mgr.ReconcileInterruptedExport(nid.shardID, nid.replicaID))
+	require.Equal(t, 2, fs.syncCalls)
+	_, err = fs.Stat(final + "-2.removing")
+	require.ErrorIs(t, err, os.ErrNotExist)
+}
+
+func (fs *partialSnapshotRemovalFS) RemoveAll(path string) error {
+	if strings.HasSuffix(path, ".removing") && !fs.failed {
+		fs.failed = true
+		if err := fs.FS.Remove(fs.FS.PathJoin(path, "dragonboat.snapshot.message")); err != nil {
+			return err
+		}
+		if err := fs.FS.Remove(fs.FS.PathJoin(path, "snapshot.metadata")); err != nil {
+			return err
+		}
+		return os.ErrPermission
+	}
+	return fs.FS.RemoveAll(path)
+}
+
+func TestReconcileInterruptedExportAfterPartialRemovalAndRestart(t *testing.T) {
+	fs := &partialSnapshotRemovalFS{FS: vfs.NewStrictMem()}
+	cfg := &Config{FS: fs, SnapshotExportDir: "/tmp/exported"}
+	mgr := newSnapshotManager(cfg)
+	nid := nodeID{shardID: 1, replicaID: 2}
+	testPrepareSnapshot(t, mgr, nid, 100)
+	testPrepareSnapshot(t, mgr, nid, 200)
+	final := mgr.snapshotPath(nid, 200)
+	flag, err := fs.Create(fs.PathJoin(final, "dragonboat.snapshot.message"))
+	require.NoError(t, err)
+	require.NoError(t, flag.Close())
+
+	require.ErrorIs(t, mgr.ReconcileInterruptedExport(nid.shardID, nid.replicaID), os.ErrPermission)
+	removing := final + "-2.removing"
+	_, err = fs.Stat(final)
+	require.ErrorIs(t, err, os.ErrNotExist)
+	_, err = fs.Stat(removing)
+	require.NoError(t, err)
+	_, err = fs.Stat(fs.PathJoin(removing, "snapshot.metadata"))
+	require.ErrorIs(t, err, os.ErrNotExist)
+
+	// A new manager has no in-memory cleanup marker. The directory name alone
+	// must make the remainder discoverable after a process restart.
+	restarted := newSnapshotManager(cfg)
+	require.NoError(t, restarted.ReconcileInterruptedExport(nid.shardID, nid.replicaID))
+	require.NoError(t, restarted.Init(nid.shardID, nid.replicaID))
+	require.Equal(t, 1, restarted.Count(nid.shardID, nid.replicaID))
+	_, err = fs.Stat(removing)
+	require.ErrorIs(t, err, os.ErrNotExist)
+	_, err = fs.Stat(mgr.snapshotPath(nid, 100))
+	require.NoError(t, err)
+}
+
+type selectiveRenameErrorFS struct {
+	vfs.FS
+	blockedPath string
+	blockedErr  error
+}
+
+func (fs *selectiveRenameErrorFS) Rename(oldname, newname string) error {
+	if oldname == fs.blockedPath {
+		if fs.blockedErr != nil {
+			return fs.blockedErr
+		}
+		return os.ErrPermission
+	}
+	return fs.FS.Rename(oldname, newname)
+}
+
+func TestDropInvalidRetainsCandidateUntilRemovalSucceeds(t *testing.T) {
+	fs := &selectiveRenameErrorFS{FS: vfs.NewStrictMem()}
+	mgr := newSnapshotManager(&Config{FS: fs, SnapshotExportDir: "/tmp/exported"})
+	nid := nodeID{shardID: 1, replicaID: 2}
+	for _, index := range []snapshotIndex{100, 200, 300} {
+		testPrepareSnapshot(t, mgr, nid, index)
+	}
+	require.NoError(t, mgr.Init(nid.shardID, nid.replicaID))
+	fs.blockedPath = mgr.snapshotPath(nid, 200)
+	removed, err := mgr.DropInvalid(nid.shardID, nid.replicaID, 200)
+	require.False(t, removed)
+	require.ErrorIs(t, err, os.ErrPermission)
+	require.Equal(t, 3, mgr.Count(nid.shardID, nid.replicaID))
+	_, err = fs.Stat(fs.blockedPath)
+	require.NoError(t, err)
+	fs.blockedErr = os.ErrNotExist
+	removed, err = mgr.DropInvalid(nid.shardID, nid.replicaID, 200)
+	require.False(t, removed)
+	require.ErrorIs(t, err, os.ErrNotExist)
+	require.Equal(t, 3, mgr.Count(nid.shardID, nid.r
```

**File**: `pkg/logservice/store.go` (modified, +4/-2)
```diff
@@ -693,11 +693,12 @@ func (l *store) startReplica(shardID uint64, replicaID uint64,
 	}
 	cfg := getRaftConfig(shardID, replicaID)
 	if err := l.snapshotMgr.Init(shardID, replicaID); err != nil {
-		panic(err)
+		return err
 	}
 	if err := l.nh.StartReplica(initialReplicas, join, l.newStateMachine, cfg); err != nil {
 		return err
 	}
+	l.snapshotMgr.MarkPreviousReplicaStopped(shardID, replicaID)
 	l.addMetadata(shardID, replicaID, false)
 	if l.onReplicaChanged != nil {
 		l.onReplicaChanged(shardID, replicaID, AddReplica)
@@ -716,11 +717,12 @@ func (l *store) startNonVotingReplica(shardID uint64, replicaID uint64,
 	cfg := getRaftConfig(shardID, replicaID)
 	cfg.IsNonVoting = true
 	if err := l.snapshotMgr.Init(shardID, replicaID); err != nil {
-		panic(err)
+		return err
 	}
 	if err := l.nh.StartReplica(initialReplicas, join, l.newStateMachine, cfg); err != nil {
 		return err
 	}
+	l.snapshotMgr.MarkPreviousReplicaStopped(shardID, replicaID)
 	l.addMetadata(shardID, replicaID, true)
 	if l.onReplicaChanged != nil {
 		l.onReplicaChanged(shardID, replicaID, AddReplica)
```

**File**: `pkg/logservice/truncation.go` (modified, +281/-36)
```diff
@@ -15,11 +15,19 @@
 package logservice
 
 import (
+	"bytes"
 	"context"
+	"encoding/binary"
 	"errors"
+	"hash/crc32"
+	"io"
+	"math"
+	"os"
 	"time"
 
 	"github.com/lni/dragonboat/v4"
+	"github.com/lni/dragonboat/v4/tools"
+	"github.com/lni/vfs"
 	"go.uber.org/zap"
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
@@ -247,7 +255,9 @@ func (l *store) beginExport(shardID, replicaID uint64) error {
 	defer l.mu.Unlock()
 	for _, rec := range l.mu.metadata.Shards {
 		if rec.ShardID == shardID && rec.ReplicaID == replicaID && !rec.Retiring {
-			l.snapshotMgr.BeginExport(shardID, replicaID)
+			if !l.snapshotMgr.BeginExport(shardID, replicaID) {
+				return errSnapshotExportPending
+			}
 			return nil
 		}
 	}
@@ -259,21 +269,64 @@ func (l *store) exportSnapshot(ctx context.Context, shardID uint64, replicaID ui
 	if err := l.beginExport(shardID, replicaID); err != nil {
 		return err
 	}
-	var mayFinishLater bool
-	defer func() { l.snapshotMgr.FinishExport(shardID, replicaID, mayFinishLater) }()
+	var mayFinishLater, transferred bool
+	defer func() {
+		if !transferred {
+			l.snapshotMgr.FinishExport(shardID, replicaID, mayFinishLater)
+		}
+	}()
 	opts := dragonboat.SnapshotOption{
 		// set to true means just export snapshot, do NOT truncate logs.
 		Exported:   true,
 		ExportPath: l.snapshotMgr.exportPath(shardID, replicaID),
 	}
 	// Just take a snapshot and export it. This snapshot is invisible to system.
-	idx, err := l.nh.SyncRequestSnapshot(ctx, shardID, opts)
+	if _, ok := ctx.Deadline(); !ok {
+		return dragonboat.ErrInvalidDeadline
+	}
+	if err := ctx.Err(); err != nil {
+		if errors.Is(err, context.DeadlineExceeded) {
+			return dragonboat.ErrTimeout
+		}
+		return dragonboat.ErrCanceled
+	}
+	// The caller's short deadline must not expire Dragonboat's result channel.
+	// Retain the request until its worker reports completion, including after a
+	// caller timeout. One unresolved request per replica bounds this state.
+	rs, err := l.nh.RequestSnapshot(shardID, opts, time.Duration(math.MaxInt64))
+	if err != nil {
+		return err
+	}
+	var idx uint64
+	select {
+	case result := <-rs.AppliedC():
+		rs.Release()
+		idx, err = exportedSnapshotResult(result)
+	case <-ctx.Done():
+		l.snapshotMgr.RetainPendingExport(shardID, replicaID, rs)
+		transferred = true
+		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
+			return dragonboat.ErrTimeout
+		}
+		return dragonboat.ErrCanceled
+	}
 	if err != nil {
+		var exportErr *dragonboat.SnapshotExportError
+		if errors.As(err, &exportErr) {
+			// The worker has finished. Remove its abandoned generating/flagged
+			// directory and reload a final export if commit finished before the
+			// filesystem reported an error. This permits a quiescent shard to
+			// retry at the same index on the next tick.
+			if cleanupErr := l.reconcileFailedExport(shardID, replicaID); cleanupErr != nil {
+				l.snapshotMgr.MarkFailedExportCleanup(shardID, replicaID)
+				return errors.Join(err, cleanupErr)
+			}
+		}
 		// These results can arrive after Dragonboat accepted the request;
 		// the export may still reach its final directory later.
-		if errors.Is(err, dragonboat.ErrTimeout) ||
+		if exportErr == nil && (errors.Is(err, dragonboat.ErrTimeout) ||
 			errors.Is(err, dragonboat.ErrCanceled) ||
-			errors.Is(err, dragonboat.ErrShardClosed) {
+			errors.Is(err, dragonboat.ErrShardClosed)) {
 			mayFinishLater = true
 		}
 		l.runtime.Logger().Error("request export snapshot failed", zap.Error(err))
@@ -295,6 +348,38 @@ func (l *store) exportSnapshot(ctx context.Context, shardID uint64, replicaID ui
 	return nil
 }
 
+func exportedSnapshotResult(result dragonboat.RequestResult) (uint64, error) {
+	if err := result.Error(); err != nil {
+		return 0, err
+	}
+	switch {
+	case result.Completed():
+		return result.SnapshotIndex(), nil
+	case result.Rejected(), result.Aborted():
+		return 0, dragonboat.ErrRejected
+	case result.Timeout():
+		return 0, dragonboat.ErrTimeout
+	case result.Terminated():
+		return 0, dragonboat.ErrShardClosed
+	case result.Dropped():
+		return 0, dragonboat.ErrShardNotReady
+	default:
+		return 0, moerr.NewInternalErrorNoCtx("unknown snapshot request result")
+	}
+}
+
+func (l *store) reconcileFailedExport(shardID, replicaID uint64) error {
+	if err := l.snapshotMgr.ReconcileInterruptedExport(shardID, replicaID); err != nil {
+		return err
+	}
+	if err := l.snapshotMgr.Init(shardID, replicaID); err != nil {
+		return err
+	}
+	l.shardSnapshotInfo.setSnapshotIndex(shardID,
+		l.snapshotMgr.NewestIndex(shardID, replicaID))
+	return nil
+}
+
 func (l *store) importSnapshot(
 	ctx context.Context, shardID uint64, replicaID uint64, lsn uint64, dir string,
 ) error {
@@ -309,16 +394,122 @@ func (l *store) importSnapshot(
 		zap.Uint64("index", lsn),
 		zap.String("dir", dir),
 	)
+	// The import has already compacted Raft state. Cleanup may need a later
+	// retry, but it must not hold back the in-memory truncation watermark.
+	l.shardSnapsh
```

**File**: `pkg/logservice/truncation_test.go` (modified, +568/-0)
```diff
@@ -17,9 +17,12 @@ package logservice
 import (
 	"context"
 	"fmt"
+	"io"
 	"os"
 	"strings"
 	"sync"
+	"sync/atomic"
+	"syscall"
 	"testing"
 	"time"
 
@@ -43,6 +46,299 @@ type pausedExportRenameFS struct {
 	unblock sync.Once
 }
 
+type failExportRenameOnceFS struct {
+	vfs.FS
+	failed atomic.Bool
+}
+
+type failImportedSnapshotRenameOnceFS struct {
+	vfs.FS
+	attempts atomic.Int32
+}
+
+func (fs *failImportedSnapshotRenameOnceFS) Rename(oldname, newname string) error {
+	if strings.HasSuffix(newname, ".removing") &&
+		strings.Contains(oldname, "/shard-1/replica-2/snapshot-") &&
+		fs.attempts.Add(1) == 1 {
+		return syscall.EIO
+	}
+	return fs.FS.Rename(oldname, newname)
+}
+
+type failExportFlagCleanupFS struct {
+	vfs.FS
+	failed       atomic.Bool
+	blockCleanup atomic.Bool
+}
+
+type pausedFailedFlagFS struct {
+	vfs.FS
+	entered chan struct{}
+	release chan struct{}
+	once    sync.Once
+	unblock sync.Once
+	failed  atomic.Bool
+}
+
+func (fs *pausedFailedFlagFS) Remove(path string) error {
+	if strings.HasSuffix(path, "dragonboat.snapshot.message") {
+		var reject bool
+		fs.once.Do(func() {
+			close(fs.entered)
+			<-fs.release
+			fs.failed.Store(true)
+			reject = true
+		})
+		if reject {
+			return os.ErrPermission
+		}
+	}
+	return fs.FS.Remove(path)
+}
+
+func (fs *pausedFailedFlagFS) resume() {
+	fs.unblock.Do(func() { close(fs.release) })
+}
+
+func (fs *failExportFlagCleanupFS) Remove(path string) error {
+	if strings.HasSuffix(path, "dragonboat.snapshot.message") &&
+		fs.failed.CompareAndSwap(false, true) {
+		return os.ErrPermission
+	}
+	return fs.FS.Remove(path)
+}
+
+func (fs *failExportFlagCleanupFS) RemoveAll(path string) error {
+	if fs.blockCleanup.Load() && strings.Contains(path, "/snapshot-") {
+		return os.ErrPermission
+	}
+	return fs.FS.RemoveAll(path)
+}
+
+type transientSnapshotReadFS struct {
+	vfs.FS
+	failList string
+	failOpen string
+}
+
+func (fs *transientSnapshotReadFS) List(path string) ([]string, error) {
+	if path == fs.failList {
+		return nil, os.ErrPermission
+	}
+	return fs.FS.List(path)
+}
+
+func (fs *transientSnapshotReadFS) Open(name string, opts ...vfs.OpenOption) (vfs.File, error) {
+	if name == fs.failOpen {
+		return nil, os.ErrPermission
+	}
+	return fs.FS.Open(name, opts...)
+}
+
+func TestImportCandidateRetainsExportOnTransientReadError(t *testing.T) {
+	cfg := getStoreTestConfig()
+	cfg.TruncateInterval.Duration = time.Hour
+	cfg.HAKeeperTruncateInterval.Duration = time.Hour
+	l, err := getTestStore(func() Config { return cfg }, true, nil)
+	require.NoError(t, err)
+	t.Cleanup(func() {
+		require.NoError(t, l.close())
+		vfs.ReportLeakedFD(cfg.FS, t)
+	})
+	require.NoError(t, l.startHAKeeperReplica(1,
+		map[uint64]dragonboat.Target{1: l.nh.ID()}, false))
+	const shardID, replicaID = uint64(1), uint64(2)
+	ctx, cancel := context.WithTimeout(context.Background(), testIOTimeout)
+	defer cancel()
+	require.NoError(t, l.getOrExtendTNLease(ctx, shardID, 100))
+	_, err = l.append(ctx, shardID, getTestUserEntry())
+	require.NoError(t, err)
+	require.NoError(t, l.exportSnapshot(ctx, shardID, replicaID))
+	index := l.snapshotMgr.NewestIndex(shardID, replicaID)
+	require.NotZero(t, index)
+	dir := l.snapshotMgr.snapshotPath(nodeID{shardID: shardID, replicaID: replicaID}, snapshotIndex(index))
+	fs := &transientSnapshotReadFS{FS: l.cfg.FS}
+	candidate := &store{cfg: Config{FS: fs}}
+
+	for _, tc := range []struct {
+		name string
+		list string
+		open string
+	}{
+		{name: "list image", list: dir},
+		{name: "read metadata", open: fs.PathJoin(dir, "snapshot.metadata")},
+		{name: "read image", open: fs.PathJoin(dir, fmt.Sprintf(snapshotPathPattern+".gbsnap", index))},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			fs.failList, fs.failOpen = tc.list, tc.open
+			valid, err := candidate.importCandidateValid(ctx, dir)
+			require.False(t, valid)
+			require.ErrorIs(t, err, os.ErrPermission)
+			require.Equal(t, 1, l.snapshotMgr.Count(shardID, replicaID))
+			_, err = fs.Stat(dir)
+			require.NoError(t, err)
+		})
+	}
+	fs.failList, fs.failOpen = "", ""
+	valid, err := candidate.importCandidateValid(ctx, dir)
+	require.NoError(t, err)
+	require.True(t, valid)
+	canceled, cancelValidation := context.WithCancel(ctx)
+	cancelValidation()
+	valid, err = candidate.importCandidateValid(canceled, dir)
+	require.False(t, valid)
+	require.ErrorIs(t, err, context.Canceled)
+	require.Equal(t, 1, l.snapshotMgr.Count(shardID, replicaID))
+}
+
+func (fs *failExportRenameOnceFS) Rename(oldname, newname string) error {
+	if strings.HasSuffix(oldname, ".generating") &&
+		strings.Contains(newname, "/shard-1/replica-2/snapshot-") &&
+		fs.failed.CompareAndSwap(false, true) {
+		return syscall.EIO
+	}
+	return fs.FS.Rename(oldname, newname)
+}
+
+func TestExportSnapshotRetriesFailedCommit(t *testing.T) {
+	cfg := getStoreTestConfig()
+	cfg.TruncateInterval.Duration = time.Hour
+	cfg.HAKeeperTruncateInterval.Duration = time.Hour
+	fs := &failExportRenameOnceFS{FS: cfg.FS}
+	c
```

---

### Incident Patch 3: `c33ce3ff` (2026-11-20)
**Commit Message**: fix(branch): prune historical catalog replay and prefer snapshot reads (#32707)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32708.

Related: #32704 (production FDB DATA BRANCH MERGE timeout, `v4.2.8-hotfix`) and #32705 (`4.2-dev` sibling). This brings the full fix, including the replacement-chain review correction, to `main`.

## What this PR does / why we need it:

The production incident merged a one-row update into a six-row table but spent 29.859 of 29.942 seconds resolving table-creation metadata. Checkpoint recovery dropped the exact-table PK predicate and delivered 1,861,139 historical catalog data/tombstone versions before cancellation.

Preserve the existing predicate through checkpoint recovery and use it to prune object/block payloads. Require explicit confirmation that an object sort-key zonemap describes the requested user PK; unknown zonemaps, cluster-by keys and rowid-sorted tombstones stay eligible. Persisted appendable objects can use PK block pruning, while tombstone blocks use the tombstone PK sequence number. Commit-

**File**: `pkg/frontend/data_branch.go` (modified, +156/-95)
```diff
@@ -47,6 +47,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
 	"github.com/matrixorigin/matrixone/pkg/util/trace/impl/motrace/statistic"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/disttae/logtailreplay"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/readutil"
 	"github.com/panjf2000/ants/v2"
 	"go.uber.org/zap"
@@ -996,6 +997,11 @@ func diffMergeAgency(
 
 	ctx, cancel := context.WithCancel(execCtx.reqCtx)
 	defer cancel()
+	ctx = logtailreplay.WithCheckpointObjectReuse(ctx)
+	ctx = context.WithValue(ctx, branchCatalogHistoryKey{}, &branchCatalogHistory{
+		dbLowerBounds: make(map[dbCreatedTimeLowerBoundKey]types.TS),
+		tableCTS:      make(map[tableCreationCommitTSKey]types.TS),
+	})
 
 	// DATA BRANCH write destinations are never subscription tables (design
 	// §4.3, I3): classify the destination before any write. DIFF ... OUTPUT
@@ -1382,6 +1388,7 @@ func getTableStuff(
 		return
 	}
 	tblStuff.def.pkSeqnum = int(tarTblDef.Cols[tarTblDef.Name2ColIndex[tarTblDef.Pkey.PkeyColName]].Seqnum)
+	tblStuff.def.pkIsSortKey = tblStuff.def.pkKind != fakeKind && tarTblDef.ClusterBy == nil
 	if tblStuff.def.pkKind == fakeKind {
 		tblStuff.def.pkColIdxes = dataBranchFakePKColIdxes(tarTblDef)
 	}
@@ -2690,28 +2697,35 @@ func decideCollectRange(
 	err error,
 ) {
 
-	var (
-		tarCTS  types.TS
-		baseCTS types.TS
-
-		tblCommitTS []types.TS
-
-		tarTableID  = tables.tarRel.GetTableID(ctx)
-		baseTableID = tables.baseRel.GetTableID(ctx)
-	)
-
+	tarTableID := tables.tarRel.GetTableID(ctx)
+	baseTableID := tables.baseRel.GetTableID(ctx)
 	tarSp, baseSp := tables.resolvedSnapshots(ses)
 	tarIdent, baseIdent := tables.endpointIdentities(ctx, ses)
 
-	if tblCommitTS, err = getTablesCreationCommitTS(
-		ctx, ses, tarIdent, tables.tarRel, baseIdent, tables.baseRel,
-		[]types.TS{tarSp, baseSp},
-	); err != nil {
-		return
+	lcaIdent := tables.resolvedLCAIdentity(ctx, ses)
+	resolveEndpoint := func(ident branchIdentity, rel engine.Relation, tableID uint64, snap types.TS) (types.TS, error) {
+		// At an endpoint snapshot a checkpoint may only retain an ALTER's
+		// rewritten catalog row. Reuse the bound already proven at the LCA
+		// for the same physical generation so earlier writes remain visible.
+		if tableID == dagInfo.lcaTableId && ident.account == lcaIdent.account &&
+			!tables.lcaCTS.IsEmpty() && tables.lcaCTS.LE(&snap) {
+			return tables.lcaCTS, nil
+		}
+		timestamps, err := getTablesCreationCommitTS(ctx, ses, ident, rel, ident, rel, []types.TS{snap, snap})
+		if err != nil {
+			return types.TS{}, err
+		}
+		return timestamps[0], nil
 	}
 
-	tarCTS = tblCommitTS[0]
-	baseCTS = tblCommitTS[1]
+	tarCTS, err := resolveEndpoint(tarIdent, tables.tarRel, tarTableID, tarSp)
+	if err != nil {
+		return
+	}
+	baseCTS, err := resolveEndpoint(baseIdent, tables.baseRel, baseTableID, baseSp)
+	if err != nil {
+		return
+	}
 
 	// ============================================================
 	// Running example used throughout the comments below.
@@ -3065,9 +3079,12 @@ func buildSideCollectRange(
 		}
 
 		// Resolve creation commit TS so the window starts after the
-		// clone-materialization commit. Reuse endpointCTS for the
-		// endpoint to avoid a redundant lookup.
-		if nodeID == endpointID {
+		// clone-materialization commit. Reuse the boundary already
+		// resolved for the LCA or the endpoint.
+		if i == 0 && !wholeHistory && segIdent.account == tables.resolvedLCAIdentity(ctx, ses).account &&
+			!tables.lcaCTS.IsEmpty() && tables.lcaCTS.LE(&windowEnd) {
+			nodeCTS = tables.lcaCTS
+		} else if nodeID == endpointID {
 			nodeCTS = endpointCTS
 		} else if !nodeCTSResolved {
 			ctsList, err2 := getTablesCreationCommitTS(
@@ -3130,9 +3147,8 @@ func dataBranchCollectRelationSnapshot(endpointSP, windowEnd types.TS, endpoint
 }
 
 // getTablesCreationCommitTS resolves the creation commit timestamp for
-// both tar and base tables.  It tries CollectChanges first (fast,
-// preserves real commit_ts from partition state), falling back to the
-// Reader-based snapshot scan when partition state is unavailable.
+// both tar and base tables, preferring the original catalog row at the
+// requested snapshot and replaying catalog changes when that row is unavailable.
 func getTablesCreationCommitTS(
 	ctx context.Context,
 	ses *Session,
@@ -3143,8 +3159,13 @@ func getTablesCreationCommitTS(
 	snapshot []types.TS,
 ) ([]types.TS, error) {
 	txnSnap := types.TimestampToTS(ses.GetTxnHandler().GetTxn().SnapshotTS())
+	history, _ := ctx.Value(branchCatalogHistoryKey{}).(*branchCatalogHistory)
 	dbLowerBounds := make(map[dbCreatedTimeLowerBoundKey]types.TS)
 	tableCTS := make(map[tableCreationCommitTSKey]types.TS)
+	if history != nil {
+		dbLowerBounds = history.dbLowerBounds
+		tableCTS = history.tableCTS
+	}
 
 	snapFor := func(idx int) types.TS {
 		if idx < len(snapshot) && !snapshot[idx].IsEmpty() {
@@ -3169,91 +3190,92 @@ func getTablesCreation
```

**File**: `pkg/frontend/data_branch_creation_ts_test.go` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ func TestTryBuildCurrentMoTablesCPKeyFilter(t *testing.T) {
 	require.Empty(t, fallbackReason)
 	require.NotNil(t, pkFilter)
 	require.Equal(t, catalog.MO_TABLES_CPKEY_IDX, pkFilter.PrimarySeqnum)
+	require.True(t, pkFilter.ObjectZMIsPK)
 	require.Len(t, pkFilter.Segments, 1)
 
 	packer := types.NewPacker()
```

**File**: `pkg/frontend/data_branch_pick.go` (modified, +7/-0)
```diff
@@ -561,6 +561,9 @@ func materializeValuesUnified(
 	// Build ZoneMap segments from the sorted Vec.
 	if canBuildSegments {
 		pkFilter = buildPKFilterFromVec(vec, pkType, tblStuff.def.pkSeqnum)
+		if pkFilter != nil {
+			pkFilter.ObjectZMIsPK = tblStuff.def.pkIsSortKey
+		}
 	}
 	vec.Free(mp)
 	return pkFilter, nil
@@ -642,6 +645,9 @@ func materializeCompositeValuesUnified(
 	// Build ZoneMap segments.
 	if canBuildSegments {
 		pkFilter = buildPKFilterFromVec(encodedVec, pkType, tblStuff.def.pkSeqnum)
+		if pkFilter != nil {
+			pkFilter.ObjectZMIsPK = tblStuff.def.pkIsSortKey
+		}
 	}
 	return pkFilter, nil
 }
@@ -974,6 +980,7 @@ func materializeSubqueryUnified(
 			pkFilter = &engine.PKFilter{
 				Segments:      segments,
 				PrimarySeqnum: tblStuff.def.pkSeqnum,
+				ObjectZMIsPK:  tblStuff.def.pkIsSortKey,
 			}
 		}
 	}
```

**File**: `pkg/frontend/data_branch_types.go` (modified, +1/-0)
```diff
@@ -264,6 +264,7 @@ type tableStuff struct {
 		writableIdxes []int
 		pkColIdx      int
 		pkSeqnum      int   // physical column seqnum for PK (for ZoneMap lookup)
+		pkIsSortKey   bool  // object-level sort-key ZoneMap has PK semantics
 		pkColIdxes    []int // expanded pk columns
 		pkKind        int
 
```

**File**: `pkg/objectio/funcs.go` (modified, +61/-17)
```diff
@@ -357,38 +357,82 @@ func ReadOneBlockAllColumns(
 		Entries:  make([]fileservice.IOEntry, 0),
 		Policy:   cachePolicy,
 	}
+	ioVec.Entries = appendBlockColumnEntries(ioVec.Entries, meta.GetBlockMeta(id), cols)
+	if err = fs.Read(ctx, ioVec); err != nil {
+		ioVec.ReleaseReadResultOnError()
+		return nil, err
+	}
+	defer ioVec.Release()
+	return decodeBlockColumns(ioVec.Entries)
+}
+
+// ReadBlocksAllColumns reads the requested blocks in one FileService request.
+// The caller groups only blocks whose physical read ranges overlap enough to
+// make a combined range useful. Batches are returned in blockIDs order.
+func ReadBlocksAllColumns(
+	ctx context.Context,
+	meta *ObjectDataMeta,
+	name string,
+	blockIDs []uint16,
+	cols []uint16,
+	cachePolicy fileservice.Policy,
+	fs fileservice.FileService,
+	mp *mpool.MPool,
+) ([]*batch.Batch, error) {
+	ioVec := &fileservice.IOVector{
+		FilePath: name,
+		Entries:  make([]fileservice.IOEntry, 0, len(blockIDs)*len(cols)),
+		Policy:   cachePolicy,
+	}
+	for _, id := range blockIDs {
+		ioVec.Entries = appendBlockColumnEntries(ioVec.Entries, meta.GetBlockMeta(uint32(id)), cols)
+	}
+	if err := fs.Read(ctx, ioVec); err != nil {
+		ioVec.ReleaseReadResultOnError()
+		return nil, err
+	}
+	defer ioVec.Release()
+
+	batches := make([]*batch.Batch, 0, len(blockIDs))
+	for start := 0; start < len(ioVec.Entries); start += len(cols) {
+		bat, err := decodeBlockColumns(ioVec.Entries[start : start+len(cols)])
+		if err != nil {
+			for _, b := range batches {
+				b.Clean(mp)
+			}
+			return nil, err
+		}
+		batches = append(batches, bat)
+	}
+	return batches, nil
+}
+
+func appendBlockColumnEntries(entries []fileservice.IOEntry, block BlockObject, cols []uint16) []fileservice.IOEntry {
 	for _, seqnum := range cols {
-		blkmeta := meta.GetBlockMeta(id)
-		col := blkmeta.ColumnMeta(seqnum)
-		ext := col.Location()
-		ioVec.Entries = append(ioVec.Entries, fileservice.IOEntry{
+		ext := block.ColumnMeta(seqnum).Location()
+		entries = append(entries, fileservice.IOEntry{
 			Offset:         int64(ext.Offset()),
 			Size:           int64(ext.Length()),
 			CachedDataSize: int64(ext.OriginSize()),
 			ToCacheData:    constructorFactory(int64(ext.OriginSize()), ext.Alg()),
 		})
 	}
+	return entries
+}
 
-	err = fs.Read(ctx, ioVec)
-	if err != nil {
-		ioVec.ReleaseReadResultOnError()
-		return nil, err
-	}
-	defer ioVec.Release()
-
-	bat = batch.NewWithSize(len(cols))
-	var obj any
-	for i := range cols {
+func decodeBlockColumns(entries []fileservice.IOEntry) (*batch.Batch, error) {
+	bat := batch.NewWithSize(len(entries))
+	for i, entry := range entries {
 		// always copy to avoid memory leak
-		bs := slices.Clone(ioVec.Entries[i].CachedData.Bytes())
-		obj, err = Decode(bs)
+		bs := slices.Clone(entry.CachedData.Bytes())
+		obj, err := Decode(bs)
 		if err != nil {
 			return nil, err
 		}
 		bat.Vecs[i] = obj.(*vector.Vector)
 		bat.SetRowCount(bat.Vecs[i].Length())
 	}
-	return
+	return bat, nil
 }
 
 // ReadOneBlockAllColumnsWindow materializes only the requested rows and reads
```

**File**: `pkg/objectio/ioutil/loadfuncs.go` (modified, +29/-0)
```diff
@@ -865,3 +865,32 @@ func withColumnsDataInto(ctx context.Context, columns []uint16, typs []types.Typ
 	}
 	return hit, err
 }
+
+// LoadBlocksWithSpecialLayouts loads the given blocks from one object with a single FileService
+// read. Block IDs must have been grouped using their physical column ranges.
+func LoadBlocksWithSpecialLayouts(
+	ctx context.Context,
+	fs fileservice.FileService,
+	key objectio.Location,
+	blockIDs []uint16,
+	mp *mpool.MPool,
+) ([]*batch.Batch, []objectio.SpecialColumnLayout, error) {
+	meta, err := objectio.FastLoadObjectMeta(ctx, &key, false, fs)
+	if err != nil {
+		return nil, nil, err
+	}
+	data := meta.MustGetMeta(objectio.SchemaData)
+	cols := make([]uint16, data.BlockHeader().ColumnCount())
+	for i := range cols {
+		cols[i] = uint16(i)
+	}
+	batches, err := objectio.ReadBlocksAllColumns(ctx, &data, key.Name().String(), blockIDs, cols, fileservice.SkipAllCache, fs, mp)
+	if err != nil {
+		return nil, nil, err
+	}
+	layouts := make([]objectio.SpecialColumnLayout, len(blockIDs))
+	for i, id := range blockIDs {
+		layouts[i] = objectio.ResolveSpecialColumnLayout(data.GetBlockMeta(uint32(id)))
+	}
+	return batches, layouts, nil
+}
```

**File**: `pkg/tests/dml/merge_catalog_history_test.go` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package dml
+
+import (
+	"context"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/cnservice"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/embed"
+	"github.com/matrixorigin/matrixone/pkg/tests/testutils"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/disttae"
+)
+
+func TestDataBranchMergeWithCheckpointCatalog(t *testing.T) {
+	embed.RunBaseClusterTests(t, func(c embed.Cluster) {
+		ctx, cancel := context.WithTimeout(defines.AttachAccountId(context.Background(), catalog.System_Account), 3*time.Minute)
+		defer cancel()
+		db := openRetestSQLDB(t, c)
+		defer db.Close()
+		db.SetMaxOpenConns(1)
+		execSQLDB(t, ctx, db, "set role moadmin")
+
+		beforeCreate := types.BuildTS(time.Now().UnixNano(), 0)
+		dbName := testutils.GetDatabaseName(t)
+		execSQLDB(t, ctx, db, fmt.Sprintf("create database `%s`", dbName))
+		execSQLDB(t, ctx, db, fmt.Sprintf("use `%s`", dbName))
+		defer func() {
+			execSQLDB(t, ctx, db, "use mo_catalog")
+			execSQLDB(t, ctx, db, fmt.Sprintf("drop database if exists `%s`", dbName))
+		}()
+
+		execSQLDB(t, ctx, db, "create table customers (id int primary key, name varchar(32))")
+		execSQLDB(t, ctx, db, "insert into customers values (1,'汉德'),(2,'two'),(3,'three'),(4,'four'),(5,'five'),(6,'six')")
+		execSQLDB(t, ctx, db, "data branch create table preview from customers")
+		execSQLDB(t, ctx, db, "update preview set name='汉得' where id=1")
+		// Persist unrelated catalog insertions and deletions alongside the branch.
+		execSQLDB(t, ctx, db, "create table a_unrelated (id int primary key)")
+		execSQLDB(t, ctx, db, "create table z_unrelated (id int primary key)")
+		execSQLDB(t, ctx, db, "drop table a_unrelated")
+		gcTS := types.BuildTS(time.Now().UnixNano(), 0)
+		queryStringRows(t, ctx, db, "select mo_ctl('dn','checkpoint','')")
+
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		service := cn.RawService().(cnservice.Service)
+		eng := service.GetEngine().(*disttae.Engine)
+		// Exercise the catalog's history boundary without truncating unrelated
+		// system tables or advancing beyond the completed checkpoint.
+		part := eng.GetOrCreateLatestPart(ctx, uint64(catalog.System_Account), catalog.MO_CATALOG_ID, catalog.MO_TABLES_ID)
+		require.NoError(t, part.Truncate(ctx, [2]uint64{catalog.MO_CATALOG_ID, catalog.MO_TABLES_ID}, gcTS, nil))
+		stateStart := part.Snapshot().GetStart()
+		require.True(t, stateStart.GT(&beforeCreate), "the catalog history must require snapshot recovery")
+
+		start := time.Now()
+		execSQLDB(t, ctx, db, "data branch merge preview into customers when conflict skip")
+		t.Logf("six-row customer rename with checkpoint catalog: %s", time.Since(start))
+		want := [][]string{{"1", "汉得"}, {"2", "two"}, {"3", "three"}, {"4", "four"}, {"5", "five"}, {"6", "six"}}
+		require.Equal(t, want, queryStringRows(t, ctx, db, "select id,name from customers order by id"))
+		// Repeating the merge must preserve every row and the applied data.
+		execSQLDB(t, ctx, db, "data branch merge preview into customers when conflict skip")
+		require.Equal(t, want, queryStringRows(t, ctx, db, "select id,name from customers order by id"))
+
+		// Catalog pruning must not change row-level conflict, insert or delete semantics.
+		execSQLDB(t, ctx, db, "data branch create table edits from customers")
+		execSQLDB(t, ctx, db, "update edits set name='branch' where id=2")
+		execSQLDB(t, ctx, db, "update customers set name='main' where id=2")
+		// An ALTER replaces the catalog row for the same table. The main
+		// change before that rewrite must remain in the conflict window.
+		execSQLDB(t, ctx, db, "alter table customers comment 'changed after the fork'")
+		execSQLDB(t, ctx, db, "delete from edits where id=3")
+		execSQLDB(t, ctx, db, "insert into edits values (7,'seven')")
+		execSQLDB(t, ctx, db, "data branch merge edits into customers when conflict skip")
+		require.Equal(t, [][]string{{"1", "汉得"}, {"2", "main"}, {"4", "four"}, {"5", "five"}, {"6", "six"}, {"7", "seven"}},
+			queryStringRows(t, ctx, db, "select id,name from customers order by id"))
+	})
+}
```

**File**: `pkg/tests/issues/issue_31401_test.go` (modified, +23/-10)
```diff
@@ -48,6 +48,7 @@ type issue31401CopyObserver struct {
 	retired  atomic.Int32
 	replicas sync.Map
 	// Optional barriers/failure injection operate at existing nested SQL calls.
+	hooksMu          sync.RWMutex
 	afterCopy        func(context.Context, int32) error
 	beforeRetire     func() error
 	beforeRecreate   func() error
@@ -151,6 +152,7 @@ func TestIssue31401AlterCopyRebuildTransaction(t *testing.T) {
 						}
 						return true
 					})
+					observer.hooksMu.Lock()
 					observer.afterRetire = func(checkCtx context.Context) error {
 						var count int
 						err := db.QueryRowContext(checkCtx, "select count(*) from mo_catalog.mo_iscp_log where table_id=? and job_id=? and drop_at is null", sourceTableID, sourceJobID).Scan(&count)
@@ -163,7 +165,9 @@ func TestIssue31401AlterCopyRebuildTransaction(t *testing.T) {
 						taskPreserved.Store(true)
 						return nil
 					}
+					observer.hooksMu.Unlock()
 				}
+				observer.hooksMu.Lock()
 				observer.afterCopy = func(callCtx context.Context, n int32) error {
 					if n == 1 {
 						close(prepared)
@@ -193,6 +197,7 @@ func TestIssue31401AlterCopyRebuildTransaction(t *testing.T) {
 				if mode == "publish_retry" {
 					observer.beforeSourceDrop = func() error { return moerr.NewTxnNeedRetryNoCtx() }
 				}
+				observer.hooksMu.Unlock()
 				before := []string{"update " + name + ".t set v=11 where id=1", "delete from " + name + ".t where id=2", "insert into " + name + ".t(id,v) values(4,40)"}
 				alterSQL := "alter table " + name + ".t add column d int default 7"
 				if mode == "late_lineage_error" {
@@ -330,9 +335,11 @@ func TestIssue31401AlterCopyRebuildTransaction(t *testing.T) {
 				if mode == "late_lineage_error" {
 					require.Zero(t, queryIssue277xxInt(t, ctx, db, "select count(*) from "+name+".guard"))
 				}
+				observer.hooksMu.Lock()
 				observer.beforeRetire = nil
 				observer.beforeRecreate = nil
 				observer.beforeSourceDrop = nil
+				observer.hooksMu.Unlock()
 				if mode == "plugin" {
 					require.True(t, taskPreserved.Load())
 					require.Equal(t, 0, queryIssue277xxInt(t, ctx, db, "select count(*) from mo_catalog.mo_iscp_log where table_id=? and job_id=? and drop_at is null", sourceTableID, sourceJobID))
@@ -348,6 +355,12 @@ func TestIssue31401AlterCopyRebuildTransaction(t *testing.T) {
 }
 
 func (o *issue31401CopyObserver) Exec(ctx context.Context, q string, opts executor.Options) (executor.Result, error) {
+	// Background SQL shares this observer with the test's hook updates. Snapshot
+	// callbacks under the lock, then release it before callbacks issue nested SQL.
+	o.hooksMu.RLock()
+	afterCopy, afterRetire := o.afterCopy, o.afterRetire
+	beforeRetire, beforeRecreate, beforeSourceDrop := o.beforeRetire, o.beforeRecreate, o.beforeSourceDrop
+	o.hooksMu.RUnlock()
 	copyOpt := opts.StatementOption().AlterCopyDedupOpt()
 	copySQL := copyOpt != nil && strings.HasPrefix(strings.ToLower(q), "insert into")
 	if copySQL {
@@ -362,40 +375,40 @@ func (o *issue31401CopyObserver) Exec(ctx context.Context, q string, opts execut
 	}
 	if retiring {
 		o.retired.Add(1)
-		if o.beforeRetire != nil {
-			if err := o.beforeRetire(); err != nil {
+		if beforeRetire != nil {
+			if err := beforeRetire(); err != nil {
 				return executor.Result{}, err
 			}
 		}
 	}
-	if o.beforeRecreate != nil && o.retired.Load() == 1 && strings.HasPrefix(strings.ToLower(q), "create table ") {
+	if beforeRecreate != nil && o.retired.Load() == 1 && strings.HasPrefix(strings.ToLower(q), "create table ") {
 		matched := false
 		o.replicas.Range(func(name, _ any) bool {
 			matched = strings.Contains(q, name.(string))
 			return !matched
 		})
 		if matched {
-			if err := o.beforeRecreate(); err != nil {
+			if err := beforeRecreate(); err != nil {
 				return executor.Result{}, err
 			}
 		}
 	}
-	if o.beforeSourceDrop != nil && !retiring && strings.HasPrefix(q, "drop table ") && strings.HasSuffix(q, ".`t`") {
-		if err := o.beforeSourceDrop(); err != nil {
+	if beforeSourceDrop != nil && !retiring && strings.HasPrefix(q, "drop table ") && strings.HasSuffix(q, ".`t`") {
+		if err := beforeSourceDrop(); err != nil {
 			return executor.Result{}, err
 		}
 	}
 	result, err := o.SQLExecutor.Exec(ctx, q, opts)
-	if err == nil && retiring && o.afterRetire != nil {
-		if err = o.afterRetire(ctx); err != nil {
+	if err == nil && retiring && afterRetire != nil {
+		if err = afterRetire(ctx); err != nil {
 			result.Close()
 			return executor.Result{}, err
 		}
 	}
 	if err == nil && copySQL {
 		n := o.copies.Add(1)
-		if o.afterCopy != nil {
-			if err = o.afterCopy(ctx, n); err != nil {
+		if afterCopy != nil {
+			if err = afterCopy(ctx, n); err != nil {
 				result.Close()
 				return executor.Result{}, err
 			}
```

#### Recent Merged Pull Requests:
- **PR #33031** (2026-11-20): [4.2-dev] fix(mpool): stabilize physical realloc failure test (@XuPeng-SH)
- **PR #33029** (closed): fix(cdc): preserve numeric-label ENUM members (@MatrixAdventurer)
- **PR #33026** (closed): fix(cdc): support YEAR columns (@MatrixAdventurer)
- **PR #33017** (2026-11-20): refactor(vector): remove string-source provenance from Vector (#33004) (@fengttt)
- **PR #33012** (2026-11-20): ci: add make static-check-changed for fast local SCA (@fengttt)
- **PR #33011** (2026-11-20): refactor(vector): remove prepareParamKind from Vector; carry prepared parameters as typed values (#33007) (@fengttt)

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

## X. preserve TAE snapshot row IDs and stabilize main CI

**RULE**:
When implementing operations in `optools/run_ut.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17df10b1`: preserve TAE snapshot row IDs and stabilize main CI. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `optools/run_ut.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
                "package_index=${index} prebuilt=true parallel=${parallel} timeout_seconds=${remaining}"
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
                "package_index=${index} prebuilt=true parallel=${parallel}"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17df10b1` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
