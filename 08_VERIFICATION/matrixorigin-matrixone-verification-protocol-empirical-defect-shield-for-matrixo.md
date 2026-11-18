# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin/matrixone

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "87c44445",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T16:41:22.185Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `87c44445`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T16:41:22.185Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin/matrixone` (Commit: `87c44445`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T16:41:21.491Z  
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
- **Issue #32898** (2026-11-18): **[4.2-dev] Preserve normal completion on local stop during serial reader construction**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32389. The original nightly failure still needs independent confirmation.  ## What this PR does / why we need it:  When Scope.Run builds a reader on demand, a pipeline-local stop during construction can return context.Canceled while the query remains active. The early return carried that error into deferred cleanup and the downstream receiver. Apply the existing scope cancellation classifier at this return so the receiver sees normal completion for a local stop and still receives query cancellation and independent storage errors.  The regression test drives Scope.Run and checks both its result and the receiver's terminal result. The local-stop case failed on the base revision. All three cases passed after the change, the focused serial and parallel reader tests passed five repetitions, and the full pkg/sql/compile package passed locally. 

- **Issue #32894** (2026-11-18): **[4.2-dev] perf: reduce clone metadata work and isolate checkpoint replay**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #29383. Backports #29769 (merge commit `72d4a49db7`) to `4.2-dev`.  ## What this PR does / why we need it:  - Reuses source table definitions already collected by `CLONE DATABASE` when selecting foreign-key tables. The backport reuses the existing 4.2 source collector and retains fresh collection after locking. - Moves checkpoint replay outside the global subscription lock while keeping one active replay. Before publishing readiness or returning a replay error, the caller verifies the subscription entry, its incarnation, and the active partition. This preserves 4.2 replay fencing when a subscription or partition is replaced. - Coalesces the v13+ table-specific checkpoint metadata columns into a single read. While the columns are pinned, it selects the requested table and copies only its rows. This cuts cold backing-store column reads from two to one with a memory-only cache and preserves owned output. An absent table still requires loading the metadata columns but produces no owned row copies. The checkpoint format and older reader paths are unchanged.  ### Validation  The S3FS disk-adapter regression verifies one cold backing-store GET for metadata columns and zero additional GETs on a warm read, with identical data and tombstone ranges. The object header is primed separately. The wa

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

### Incident Patch 1: `87c44445` (2026-11-18)
**Commit Message**: fix: preserve accepted UNIQUE keys in multi-target UPDATE IGNORE (#32827)

## What type of PR is this?

- [x] BUG

## Which issue(s) this PR fixes:

Related to #31824. This PR addresses repeated-target **UPDATE IGNORE**;
the non-IGNORE case was handled by #32821.

## What this PR does / why we need it:

When an UPDATE IGNORE writes the same physical table through multiple
aliases, an earlier alias may have already accepted or rejected a
change. Checking a later candidate against the original snapshot alone
can commit duplicate UNIQUE keys. A CHECK-rejected candidate can leave
an accepted key unprotected if arbitration depends on the arrival order
of concurrent UNION inputs. A later alias can also emit a false CHECK
warning when it is validated against a snapshot value already changed by
an accepted alias.

- Use the preceding accepted row image for current key ownership, while
carrying snapshot-key release evidence separately.
- Reuse the existing HashBuild/DedupJoin path to prioritize current
owners and reservations over competing claims independent of input
arrival order. Preserve the auxiliary-row contract in parallel copies,
remote codecs and spill/rebuild.
- Report warnings on

**File**: `docs/design/20261117-update-ignore-unique-arbitration.md` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+# Unique arbitration for repeated-target UPDATE IGNORE
+
+Issue: [#31824](https://github.com/matrixorigin/matrixone/issues/31824)
+
+Implementation: [#32827](https://github.com/matrixorigin/matrixone/pull/32827)
+
+## Problem and contract
+
+An UPDATE can write the same physical table through more than one alias. Under
+IGNORE, each alias can change a row that an earlier alias already changed or
+rejected. Checking each alias against the statement snapshot independently is
+not sufficient: a later alias can claim a key already accepted for another row,
+or a surviving key can be mistaken for a released snapshot key. In either
+case the table or its unique index can contain conflicting entries.
+
+Keep the existing ordered alias stages. For each physical row, S is its
+statement-snapshot image and C its latest accepted image, initially S. Each
+active alias forms a candidate N from C, including recomputed generated
+columns. If its constraints reject it under IGNORE, retain C and report the
+rejected candidate; otherwise N becomes the next C. Earlier rejected
+assignments are not resurrected. Each accepted physical key must have at most
+one owner under the actual index equality and encoding, including NULL,
+composite, prefix and collation keys. Internal rows and inactive or no-op
+assignments do not themselves create duplicate warnings. A later failure of any
+constraint must reject the candidate atomically.
+
+The existing transaction remains the publication and rollback owner. A normal
+non-IGNORE UPDATE continues to validate the final merged physical image; this
+design does not replace that path. A single writable target and another physical
+table in the same statement retain their existing independent checks. Existing
+guards for repeated targets changing primary or partition identity, including
+generated dependencies, remain in force.
+
+## Existing owners and data flow
+
+The planner owns ordered candidate stages, S, C, and the projections used
+by each affected unique index. A candidate's old key is derived from C, not
+from S. Before checking an alias stage, the planner also represents:
+
+* **Reservation:** an accepted C key, even if its owner has no surviving
+  candidate after CHECK or a preceding unique-index check.
+* **Release:** the snapshot key of a row whose accepted C has a different
+  key for this unique index, using the index's actual encoding and null-safe
+  equality. A payload-only change does not release an unchanged key. This
+  evidence travels with the snapshot key and only exempts that old snapshot
+  entry from a probe; it cannot claim a candidate.
+
+These are auxiliary rows in the existing build input; a NULL physical row ID
+distinguishes them from candidate rows. The delete marker distinguishes release
+from reservation. They cannot reach the DML output or create warnings.
+
+HashBuild owns per-key arbitration using the priority **current-key owner >
+reservation > changed claimant > release**. Thus a current owner survives its
+own reservation, and a reservation defeats a competing changed claimant
+regardless of input arrival order. Release evidence survives compaction and
+rebuild, but never displaces an owner or claimant. The ordinary key and NULL
+rules remain authoritative; priority does not impose an order between unrelated
+keys. Within the existing alias-order contract, a failed candidate retains C.
+
+DedupJoin probes snapshot keys, observes releases, filters rejected candidates
+and renders diagnostics for real candidates. Compiler/operator-copy and
+pipeline serialization preserve the auxiliary-row column reference, including
+parallel copies; spill rebuild carries the same metadata and row roles. A
+selection mapping used for warnings must refer to the retained physical build
+row after compaction, including NULL keys and batch boundaries.
+
+## Alternatives and bounds
+
+Keeping per-alias snapshot checks cannot establish the accepted-image invariant.
+Depending on UNION arrival order is invalid when inputs execute concurrently.
+A separate global arbiter or new storage/state machine duplicates the existing
+materialized alias stages and introduces additional ownership and failure
+contracts. Arbitration inside the existing build/probe path keeps one owner for
+each part of the work and requires no new long-lived service or persistent
+format.
+
+For N retained rows, A affected alias stages and I affected unique
+indexes, each index stage can materialize up to approximately N candidate,
+N reservation and N release rows. It must also probe the snapshot index: if
+M is the number of index rows examined per stage, work can scale with
+A * I * (N + M), and M may be much larger than the affected-row set. The
+existing base also scans/probes the index; the comparison must measure the
+whole stage. Transient candidate state scales with N and carried key/row width,
+plus the existing hash, selection and spill costs. HashBuild owns and accounts
+
```

**File**: `pkg/sql/colexec/dedupjoin/join.go` (modified, +50/-2)
```diff
@@ -469,14 +469,15 @@ func (dedupJoin *DedupJoin) build(analyzer process.Analyzer, proc *process.Proce
 				SpillThreshold:            ctr.spillThreshold,
 				AdaptiveMemory:            ctr.autoSpill,
 				NeedsBuildForEmptyProbe:   true,
-				NeedAllocateSels:          dedupJoin.OnDuplicateAction == plan.Node_UPDATE,
+				NeedAllocateSels:          dedupJoin.OnDuplicateAction == plan.Node_UPDATE || dedupJoin.OnDuplicateAction == plan.Node_IGNORE,
 				NeedBatches:               true,
 				IsDedup:                   true,
 				OnDuplicateAction:         dedupJoin.OnDuplicateAction,
 				DedupBuildKeepLast:        dedupJoin.DedupBuildKeepLast,
 				DedupColName:              dedupJoin.DedupColName,
 				DedupColTypes:             dedupJoin.DedupColTypes,
 				DedupKeyExprs:             dedupJoin.DedupKeyExprs,
+				AuxiliaryRowIdColIdx:      dedupJoin.AuxiliaryRowIdColIdx,
 				DelColIdx:                 dedupJoin.DelColIdx,
 				DedupDeleteMarkerColIdx:   dedupJoin.DedupDeleteMarkerColIdx,
 				DedupDeleteKeepColIdxList: dedupJoin.DedupDeleteKeepColIdxList,
@@ -2136,6 +2137,15 @@ func (ctr *container) probe(bat *batch.Batch, ap *DedupJoin, proc *process.Proce
 		if !warningsEnabled {
 			return
 		}
+		suppressed, err := ctr.duplicateWarningSuppressed(ap, proc, group)
+		if err != nil {
+			// Diagnostics are optional; never turn IGNORE into a statement error.
+			duplicateWarnings.AddCount()
+			return
+		}
+		if suppressed {
+			return
+		}
 		if !duplicateWarnings.NeedsDiagnostic() {
 			duplicateWarnings.AddCount()
 			return
@@ -2361,6 +2371,44 @@ func (dedupJoin *DedupJoin) resetRBat() error {
 	return nil
 }
 
+func (ctr *container) duplicateWarningSuppressed(ap *DedupJoin, proc *process.Process, group uint64) (bool, error) {
+	if ap.AuxiliaryRowIdColIdx == 0 {
+		return false, nil
+	}
+	colIdx := ap.AuxiliaryRowIdColIdx - 1
+	checkBatchRow := func(bat *batch.Batch, row int) (bool, error) {
+		if row < 0 {
+			return false, moerr.NewInternalError(proc.Ctx, "negative duplicate diagnostic row")
+		}
+		if bat == nil || row >= bat.RowCount() {
+			return false, moerr.NewInternalError(proc.Ctx, "invalid duplicate warning suppression row")
+		}
+		if colIdx < 0 || int(colIdx) >= len(bat.Vecs) {
+			return false, moerr.NewInternalError(proc.Ctx, "invalid duplicate warning suppression column")
+		}
+		return bat.Vecs[colIdx].IsNull(uint64(row)), nil
+	}
+	checkRow := func(row int) (bool, error) {
+		if row < 0 {
+			return false, moerr.NewInternalError(proc.Ctx, "negative duplicate diagnostic row")
+		}
+		batIdx := row / colexec.DefaultBatchSize
+		if batIdx >= len(ctr.batches) {
+			return false, moerr.NewInternalError(proc.Ctx, "invalid duplicate warning suppression row")
+		}
+		return checkBatchRow(ctr.batches[batIdx], row%colexec.DefaultBatchSize)
+	}
+	if sels := ctr.mp.GetSels(group); len(sels) > 0 {
+		return checkRow(int(sels[0]))
+	}
+	if group == 0 {
+		return false, moerr.NewInternalError(proc.Ctx, "invalid duplicate warning suppression group")
+	}
+	// Marked HashBuilds always collect selections. With no explicit selections,
+	// GroupSels.Finalize proved this identity even if trailing keys are NULL.
+	return checkRow(int(group - 1))
+}
+
 func (ctr *container) formatDuplicateEntry(ap *DedupJoin, proc *process.Process, probeRow int, group uint64) (string, error) {
 	if len(ap.DedupKeyExprs) == 0 {
 		return colexec.FormatDedupEntry(ctr.vecs[0], probeRow, ap.DedupColName, ap.DedupColTypes)
@@ -2372,7 +2420,7 @@ func (ctr *container) formatDuplicateEntry(ap *DedupJoin, proc *process.Process,
 	if sels := ctr.mp.GetSels(group); len(sels) > 0 {
 		return render(int(sels[0]))
 	}
-	if ctr.mp.GetGroupCount() == uint64(ctr.batchRowCount) {
+	if ap.AuxiliaryRowIdColIdx > 0 || ctr.mp.GetGroupCount() == uint64(ctr.batchRowCount) {
 		return render(int(group - 1))
 	}
 	// Compact maps omit row selections. NULL keys do not get a bucket, so a
```

**File**: `pkg/sql/colexec/dedupjoin/key_contract_test.go` (modified, +125/-0)
```diff
@@ -50,6 +50,131 @@ func TestDedupJoinAllocationSiteLedger(t *testing.T) {
 	require.Equal(t, uint8(113), uint8(dedupJoinAllocationSiteResultGrouping))
 }
 
+func TestDedupJoinAuxiliaryArbitration(t *testing.T) {
+	for _, mode := range []dedupKeyContractMode{
+		{name: "resident"},
+		{name: "spill", shuffle: true, spillThreshold: hashmap.UnitLimit + 1, wantInitialSpill: true},
+		{name: "re-spill", shuffle: true, spillThreshold: 2, wantInitialSpill: true, wantReSpill: true},
+	} {
+		for _, reservationFirst := range []bool{false, true} {
+			t.Run(mode.name+"/reservationFirst="+strconv.FormatBool(reservationFirst), func(t *testing.T) {
+				proc, ctrl := newCaptureTestProc(t)
+				defer ctrl.Finish()
+				proc.Base.Lim.Size = 8 << 20
+				proc.Base.Lim.SpillSize = 64 << 20
+				session := &dedupJoinWarningSession{}
+				proc.Session = session
+				proc.SetStmtProfile(&process.StmtProfile{})
+				proc.GetStmtProfile().SetStatementRuntimeProfile("Update", "DML", true)
+				var join *DedupJoin
+				var build *hashbuild.HashBuild
+				buildBat, probeBat := batch.NewWithSize(4), batch.NewWithSize(1)
+				defer func() {
+					if join != nil {
+						join.Free(proc, false, nil)
+					}
+					if build != nil {
+						build.Free(proc, false, nil)
+					}
+					buildBat.Clean(proc.Mp())
+					probeBat.Clean(proc.Mp())
+					budget, err := proc.GetExecutionResourceBudget()
+					var used, disk, descriptors uint64
+					if err == nil {
+						used, disk, descriptors = budget.Used(), budget.SpillDiskUsed(), budget.SpillFDUsed()
+					}
+					proc.Free()
+					require.NoError(t, err)
+					require.Zero(t, used)
+					require.Zero(t, disk)
+					require.Zero(t, descriptors)
+					require.Zero(t, proc.Mp().CurrNB())
+				}()
+				intType, boolType := types.T_int32.ToType(), types.T_bool.ToType()
+				rightTypes := []types.Type{intType, intType, boolType, intType}
+				for i, typ := range rightTypes {
+					buildBat.Vecs[i] = vector.NewVec(typ)
+				}
+				probeBat.Vecs[0] = vector.NewVec(intType)
+				appendBuild := func(key, previous, id int32, auxiliary, release bool) {
+					require.NoError(t, vector.AppendFixed(buildBat.Vecs[0], key, false, proc.Mp()))
+					require.NoError(t, vector.AppendFixed(buildBat.Vecs[1], previous, auxiliary && !release, proc.Mp()))
+					require.NoError(t, vector.AppendFixed(buildBat.Vecs[2], release, false, proc.Mp()))
+					require.NoError(t, vector.AppendFixed(buildBat.Vecs[3], id, auxiliary, proc.Mp()))
+				}
+				// These unchanged, rejected rows retain reservations and exercise
+				// snapshot diagnostic suppression in every materialized partition.
+				for i := 0; i < hashmap.UnitLimit; i++ {
+					key := int32(1000 + i)
+					appendBuild(key, 0, 0, true, false)
+					require.NoError(t, vector.AppendFixed(probeBat.Vecs[0], key, false, proc.Mp()))
+				}
+				if reservationFirst {
+					appendBuild(30, 0, 0, true, false)
+				}
+				appendBuild(30, 20, 2, false, false) // B cannot steal A's accepted 30.
+				if !reservationFirst {
+					appendBuild(30, 0, 0, true, false)
+				}
+				appendBuild(20, 0, 0, true, false)
+				appendBuild(10, 10, 0, true, true)   // S=10 was released when A accepted 30.
+				appendBuild(10, 30, 1, false, false) // A may reclaim the now-unowned 10.
+				buildBat.SetRowCount(buildBat.Vecs[0].Length())
+				for _, key := range []int32{10, 20} {
+					require.NoError(t, vector.AppendFixed(probeBat.Vecs[0], key, false, proc.Mp()))
+				}
+				probeBat.SetRowCount(probeBat.Vecs[0].Length())
+				if mode.wantReSpill {
+					requireDedupTargetBucketReSpills(t, buildBat.Vecs[0], buildBat.RowCount()-1, mode.spillThreshold)
+				}
+				conditions := [][]*plan.Expr{{newExpr(0, intType)}, {newExpr(0, intType)}}
+				const mapTag = 328270
+				join = &DedupJoin{LeftTypes: []types.Type{intType}, RightTypes: rightTypes, Conditions: conditions,
+					Result:            []colexec.ResultPos{colexec.NewResultPos(1, 3), colexec.NewResultPos(1, 0)},
+					OnDuplicateAction: plan.Node_IGNORE, DelColIdx: 1, DedupDeleteMarkerColIdx: 2, AuxiliaryRowIdColIdx: 4,
+					DedupColName: "uk", DedupColTypes: []plan.Type{conditions[0][0].Typ},
+					IsShuffle: mode.shuffle, SpillThreshold: mode.spillThreshold, JoinMapTag: mapTag}
+				build = &hashbuild.HashBuild{NeedHashMap: true, NeedBatches: true, NeedAllocateSels: true, Conditions: conditions[1],
+					IsDedup: true, OnDuplicateAction: plan.Node_IGNORE, DelColIdx: 1, DedupDeleteMarkerColIdx: 2, AuxiliaryRowIdColIdx: 4,
+					DedupColName: join.DedupColName, DedupColTypes: join.DedupColTypes,
+					IsShuffle: mode.shuffle, SpillThreshold: mode.spillThreshold, JoinMapTag: mapTag, JoinMapRefCnt: 1}
+				if mode.shuffle {
+					build.RuntimeFilterSpec = &plan.RuntimeFilterSpec{Tag: mapTag + 1}
+				}
+				join.AppendChild(colexec.NewMockOperator().WithBatchs([]*batch.Batch{probeBat}))
+				build.AppendChild(colexec.NewMockOperator().WithBatchs([]*batch.Batch{buildBat}))
+				installTestAllocation(t, join, build)
+				spillMetric := metricv
```

**File**: `pkg/sql/colexec/dedupjoin/types.go` (modified, +9/-6)
```diff
@@ -329,12 +329,15 @@ type DedupJoin struct {
 	NumCPU   uint64
 	IsMerger bool
 
-	OnDuplicateAction         plan.Node_OnDuplicateAction
-	DedupBuildKeepLast        bool
-	DedupColName              string
-	SpillThreshold            int64
-	DedupColTypes             []plan.Type
-	DedupKeyExprs             []*plan.Expr
+	OnDuplicateAction  plan.Node_OnDuplicateAction
+	DedupBuildKeepLast bool
+	DedupColName       string
+	SpillThreshold     int64
+	DedupColTypes      []plan.Type
+	DedupKeyExprs      []*plan.Expr
+	// AuxiliaryRowIdColIdx is a one-based build-side row-ID column. NULL marks
+	// reservation/release evidence for IGNORE; zero disables that contract.
+	AuxiliaryRowIdColIdx      int32
 	DelColIdx                 int32
 	DedupDeleteMarkerColIdx   int32
 	DedupDeleteKeepColIdxList []int32
```

**File**: `pkg/sql/colexec/dedupjoin/warning_suppression_test.go` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//      http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package dedupjoin
+
+import (
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/hashbuild"
+	"github.com/matrixorigin/matrixone/pkg/vm"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/stretchr/testify/require"
+)
+
+func TestAuxiliaryWarningGroupRows(t *testing.T) {
+	for _, prefixNull := range []bool{false, true} {
+		name := "trailing_NULL_compact_identity"
+		if prefixNull {
+			name = "prefix_NULL_explicit_selections"
+		}
+		t.Run(name, func(t *testing.T) {
+			proc, ctrl := newCaptureTestProc(t)
+			defer ctrl.Finish()
+			session := &dedupJoinWarningSession{}
+			proc.Session = session
+			proc.SetStmtProfile(&process.StmtProfile{})
+			proc.GetStmtProfile().SetStatementRuntimeProfile("Update", "DML", true)
+			buildBat, probeBat := batch.NewWithSize(4), batch.NewWithSize(1)
+			var join *DedupJoin
+			var build *hashbuild.HashBuild
+			var account *mpool.AllocationAccount
+			defer func() {
+				if join != nil {
+					join.Free(proc, false, nil)
+				}
+				if build != nil {
+					build.Free(proc, false, nil)
+				}
+				buildBat.Clean(proc.Mp())
+				probeBat.Clean(proc.Mp())
+				proc.Free()
+				require.Zero(t, proc.Mp().CurrNB())
+				if account != nil {
+					require.Zero(t, account.Snapshot().Used)
+				}
+			}()
+			intType, boolType := types.T_int32.ToType(), types.T_bool.ToType()
+			rightTypes := []types.Type{intType, intType, boolType, intType}
+			for i, typ := range rightTypes {
+				buildBat.Vecs[i] = vector.NewVec(typ)
+			}
+			probeBat.Vecs[0] = vector.NewVec(intType)
+			appendRow := func(key, id int32, keyNull, auxiliary bool) {
+				require.NoError(t, vector.AppendFixed(buildBat.Vecs[0], key, keyNull, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(buildBat.Vecs[1], int32(0), true, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(buildBat.Vecs[2], false, false, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(buildBat.Vecs[3], id, auxiliary, proc.Mp()))
+			}
+			if prefixNull {
+				appendRow(0, 0, true, true)
+			}
+			appendRow(10, 1, false, false) // Conflicts with an untargeted snapshot row.
+			appendRow(20, 2, false, false) // The only accepted real candidate.
+			for i := 0; i < colexec.DefaultBatchSize; i++ {
+				appendRow(int32(1000+i), 0, false, true)
+			}
+			if !prefixNull {
+				appendRow(0, 0, true, true)
+			}
+			buildBat.SetRowCount(buildBat.Vecs[0].Length())
+			for _, key := range []int32{10, 1000 + colexec.DefaultBatchSize - 1} {
+				require.NoError(t, vector.AppendFixed(probeBat.Vecs[0], key, false, proc.Mp()))
+			}
+			probeBat.SetRowCount(2)
+			conditions := [][]*plan.Expr{{newExpr(0, intType)}, {newExpr(0, intType)}}
+			const mapTag = 918273
+			join = &DedupJoin{LeftTypes: []types.Type{intType}, RightTypes: rightTypes, Conditions: conditions,
+				Result:            []colexec.ResultPos{colexec.NewResultPos(1, 3), colexec.NewResultPos(1, 0)},
+				OnDuplicateAction: plan.Node_IGNORE, DelColIdx: 1, DedupDeleteMarkerColIdx: 2, AuxiliaryRowIdColIdx: 4,
+				DedupColName: "uk_named", DedupColTypes: []plan.Type{conditions[0][0].Typ},
+				DedupKeyExprs: []*plan.Expr{newExpr(0, intType)}, JoinMapTag: mapTag}
+			build = &hashbuild.HashBuild{NeedHashMap: true, NeedBatches: true, Conditions: conditions[1],
+				// The marked producer owns this requirement, including direct callers.
+				NeedAllocateSels: false, IsDedup: true, OnDuplicateAction: plan.Node_IGNORE,
+				DelColIdx: 1, DedupDeleteMarkerColIdx: 2, AuxiliaryRowIdColIdx: 4,
+				DedupColName: join.DedupColName, DedupColTypes: join.DedupColTypes,
+				JoinMapTag: mapTag, JoinMapRefCnt: 1}
+			join.AppendChild(colexec.NewMockOperator().WithBatchs([]*batch.Batch{probeBat}))
+			build.AppendChild(colexec.NewMockOperator().WithBatchs([]*batch.Batch{buildBat}))
+			account = installTestAllocation(t, join, build)
+			require.NoError(t, build.Prepare(proc))
+			require.NoError(t, join.Prepare(proc))
+			_, err := vm.Exec(build, proc)
+			require.NoError(t, err)
+			result, err := vm.Exec(join, proc)
+			require.
```

**File**: `pkg/sql/colexec/hashbuild/build.go` (modified, +1/-0)
```diff
@@ -105,6 +105,7 @@ func (hashBuild *HashBuild) Prepare(proc *process.Process) (err error) {
 	hashBuild.ctr.hashmapBuilder.DedupColName = hashBuild.DedupColName
 	hashBuild.ctr.hashmapBuilder.DedupColTypes = hashBuild.DedupColTypes
 	hashBuild.ctr.hashmapBuilder.DedupKeyExprs = hashBuild.DedupKeyExprs
+	hashBuild.ctr.hashmapBuilder.AuxiliaryRowIdColIdx = hashBuild.AuxiliaryRowIdColIdx
 	hashBuild.ctr.hashmapBuilder.TrackNullKeys = hashBuild.TrackNullKeys
 	hashBuild.ctr.hashmapBuilder.joinDiagnostic = hashBuild.JoinDiagnostic
 	if hashBuild.JoinDiagnostic != nil {
```

**File**: `pkg/sql/colexec/hashbuild/hashmap.go` (modified, +94/-21)
```diff
@@ -58,6 +58,9 @@ type HashmapBuilder struct {
 	DedupColName       string
 	DedupColTypes      []plan.Type
 	DedupKeyExprs      []*plan.Expr
+	// AuxiliaryRowIdColIdx is one-based; zero disables auxiliary arbitration.
+	// NULL identifies a reservation or release, rather than a real candidate.
+	AuxiliaryRowIdColIdx int32
 
 	IgnoreRows *bitmap.Bitmap
 
@@ -195,6 +198,10 @@ func (hb *HashmapBuilder) Prepare(
 	proc *process.Process,
 	foldOwnedConstantCasts ...bool,
 ) error {
+	if hb.AuxiliaryRowIdColIdx < 0 || hb.AuxiliaryRowIdColIdx > 0 &&
+		(!hb.IsDedup || hb.OnDuplicateAction != plan.Node_IGNORE || delColIdx < 0 || dedupDeleteMarkerColIdx < 0) {
+		return moerr.NewInternalError(proc.Ctx, "invalid auxiliary IGNORE arbitration metadata")
+	}
 	if len(hb.executors) == 0 {
 		needDupVec := false
 		keyWidth := 0
@@ -501,6 +508,17 @@ func (hb *HashmapBuilder) RetainedBatchRecoverySafe() bool {
 	return hb.retainedBatchRecoverySafe
 }
 
+// An auxiliary IGNORE stage protects the preceding accepted image before
+// admitting a changed key. Releases are persistent evidence, not competitors.
+// Without auxiliary metadata, only claimant/owner priorities are used, retaining
+// the generic IGNORE original-key-owner rule.
+const (
+	ignoreReleasePriority uint8 = iota
+	ignoreClaimPriority
+	ignoreReservationPriority
+	ignoreOwnerPriority
+)
+
 func (hb *HashmapBuilder) buildHashmap(
 	hashOnPK bool,
 	needAllocateSels bool,
@@ -509,6 +527,9 @@ func (hb *HashmapBuilder) buildHashmap(
 	dedupBuildKeepLast bool,
 	proc *process.Process,
 ) (retErr error) {
+	// Auxiliary diagnostics need a physical build row for every group. Finalize
+	// keeps explicit selections unless the mapping is the compact g -> g-1 form.
+	needAllocateSels = needAllocateSels || hb.AuxiliaryRowIdColIdx > 0
 	runtimeFilterRequested := needUniqueVec
 	warningsEnabled := proc != nil && proc.GetStmtProfile() != nil &&
 		proc.GetStmtProfile().GetStatementIgnore() && hb.IsDedup &&
@@ -529,6 +550,17 @@ func (hb *HashmapBuilder) buildHashmap(
 		if !warningsEnabled {
 			return
 		}
+		if hb.AuxiliaryRowIdColIdx > 0 {
+			batIdx := inputRow / colexec.DefaultBatchSize
+			colIdx := hb.AuxiliaryRowIdColIdx - 1
+			if batIdx < 0 || batIdx >= len(hb.Batches.Buf) || int(colIdx) >= len(hb.Batches.Buf[batIdx].Vecs) {
+				duplicateWarnings.AddCount()
+				return
+			}
+			if hb.Batches.Buf[batIdx].Vecs[colIdx].IsNull(uint64(inputRow % colexec.DefaultBatchSize)) {
+				return
+			}
+		}
 		if !duplicateWarnings.NeedsDiagnostic() {
 			duplicateWarnings.AddCount()
 			return
@@ -555,6 +587,19 @@ func (hb *HashmapBuilder) buildHashmap(
 	if hb.InputBatchRowCount == 0 {
 		return nil
 	}
+	if hb.AuxiliaryRowIdColIdx > 0 {
+		for _, bat := range hb.Batches.Buf {
+			if int(hb.AuxiliaryRowIdColIdx) > len(bat.Vecs) ||
+				hb.delColIdx < 0 || int(hb.delColIdx) >= len(bat.Vecs) ||
+				hb.dedupDeleteMarkerColIdx < 0 || int(hb.dedupDeleteMarkerColIdx) >= len(bat.Vecs) ||
+				bat.Vecs[hb.AuxiliaryRowIdColIdx-1] == nil ||
+				bat.Vecs[hb.delColIdx] == nil ||
+				bat.Vecs[hb.dedupDeleteMarkerColIdx] == nil ||
+				bat.Vecs[hb.dedupDeleteMarkerColIdx].GetType().Oid != types.T_bool {
+				return moerr.NewInternalError(proc.Ctx, "invalid auxiliary IGNORE arbitration columns")
+			}
+		}
+	}
 	dedupBuildKeepLast = dedupBuildKeepLast && hb.IsDedup && hb.OnDuplicateAction == plan.Node_FAIL
 	defer func() {
 		if retErr != nil {
@@ -690,24 +735,24 @@ func (hb *HashmapBuilder) buildHashmap(
 	}
 
 	var (
-		vOld                   uint64
-		cardinality            uint64
-		lastBatch              = -1
-		lastRows               []int64
-		ignoreSurvivorRows     []int64
-		ignoreSurvivorOwnsKey  []bool
-		ignoreBuildGroups      []uint64
-		ignoreBuildZvals       []int64
-		ignoreCandidateOwnsKey []bool
-		ignoreCandidateOldKey  []*vector.Vector
+		vOld                    uint64
+		cardinality             uint64
+		lastBatch               = -1
+		lastRows                []int64
+		ignoreSurvivorRows      []int64
+		ignoreSurvivorPriority  []uint8
+		ignoreBuildGroups       []uint64
+		ignoreBuildZvals        []int64
+		ignoreCandidatePriority []uint8
+		ignoreCandidateOldKey   []*vector.Vector
 	)
 	cleanupDedupScratch := func() {
 		freeDedupSlice(hb, lastRows, proc.Mp())
 		lastRows = nil
 		freeDedupSlice(hb, ignoreSurvivorRows, proc.Mp())
 		ignoreSurvivorRows = nil
-		freeDedupSlice(hb, ignoreSurvivorOwnsKey, proc.Mp())
-		ignoreSurvivorOwnsKey = nil
+		freeDedupSlice(hb, ignoreSurvivorPriority, proc.Mp())
+		ignoreSurvivorPriority = nil
 	}
 	defer cleanupDedupScratch()
 	if dedupBuildKeepLast {
@@ -734,18 +779,18 @@ func (hb *HashmapBuilder) buildHashmap(
 		if err != nil {
 			return err
 		}
-		ignoreSurvivorOwnsKey, err = makeDedupSlice[bool](
+		ignoreSurvivorPriority, err = makeDedupSlice[uint8](
 			hb,
 			hb.InputBatchRowCount+1,
 			proc.Mp(),
-			HashBuildAllocationSiteDedupSurvivorOwnsKey,
+			HashBuildAllocationSiteDedupSurvivorPriority,
 		)
 		if err != n
```

**File**: `pkg/sql/colexec/hashbuild/hashmap_test.go` (modified, +89/-0)
```diff
@@ -1440,6 +1440,95 @@ func TestDedupBuildIgnoreRebuildsAfterOwnerReplacement(t *testing.T) {
 	require.True(t, hb.DelRows.Contains(1), "delRows=%s count=%d", hb.DelRows.String(), hb.DelRows.Count())
 }
 
+func TestDedupBuildIgnoreAuxiliaryPriority(t *testing.T) {
+	type row struct {
+		key, previous, id  int32
+		auxiliary, release bool
+	}
+	reservation := row{key: 30, auxiliary: true}
+	claimant := row{key: 30, previous: 20, id: 2}
+	owner := row{key: 30, previous: 30, id: 1}
+	release := row{key: 30, previous: 30, auxiliary: true, release: true}
+	for _, tt := range []struct {
+		name     string
+		rows     []row
+		wantIDs  []int32
+		warnings uint64
+	}{
+		{"reservation first", []row{reservation, claimant}, nil, 1},
+		{"claimant first", []row{claimant, reservation}, nil, 1},
+		{"owner after reservation", []row{reservation, claimant, owner}, []int32{1}, 1},
+		{"owner before reservation", []row{owner, reservation, claimant}, []int32{1}, 1},
+		{"claimant reservation owner", []row{claimant, reservation, owner}, []int32{1}, 1},
+		{"claimant owner reservation", []row{claimant, owner, reservation}, []int32{1}, 1},
+		{"release before claimant", []row{release, claimant}, []int32{2}, 0},
+		{"release after claimant", []row{claimant, release}, []int32{2}, 0},
+		{"release survives discarded claimant", []row{claimant, release, reservation}, nil, 1},
+		{"release reservation claimant", []row{release, reservation, claimant}, nil, 1},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			proc := testutil.NewProcessWithOwnedMPool(t, "", mpool.MustNewZero())
+			hb := newTestHashmapBuilder(t)
+			defer func() {
+				hb.Reset(proc, true)
+				hb.Free(proc)
+				proc.Free()
+				require.Zero(t, proc.Mp().CurrNB())
+			}()
+			session := &hashBuildWarningSession{}
+			proc.Session = session
+			proc.SetStmtProfile(&process.StmtProfile{})
+			proc.GetStmtProfile().SetStatementRuntimeProfile("Update", "DML", true)
+			hb.IsDedup = true
+			hb.OnDuplicateAction = plan.Node_IGNORE
+			hb.DedupColName = "uk"
+			hb.DedupColTypes = []plan.Type{newExpr(0, types.T_int32.ToType()).Typ}
+			hb.AuxiliaryRowIdColIdx = 4
+			require.NoError(t, hb.Prepare([]*plan.Expr{newExpr(0, types.T_int32.ToType())}, 1, 2, nil, proc))
+			bat := batch.NewWithSize(4)
+			defer bat.Clean(proc.Mp())
+			for i, typ := range []types.Type{types.T_int32.ToType(), types.T_int32.ToType(), types.T_bool.ToType(), types.T_int32.ToType()} {
+				bat.Vecs[i] = vector.NewVec(typ)
+			}
+			wantReleases := 0
+			for _, r := range tt.rows {
+				require.NoError(t, vector.AppendFixed(bat.Vecs[0], r.key, false, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(bat.Vecs[1], r.previous, r.auxiliary && !r.release, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(bat.Vecs[2], r.release, false, proc.Mp()))
+				require.NoError(t, vector.AppendFixed(bat.Vecs[3], r.id, r.auxiliary, proc.Mp()))
+				if r.release {
+					wantReleases++
+				}
+			}
+			bat.SetRowCount(len(tt.rows))
+			require.NoError(t, hb.CopyBuildBatch(bat, proc))
+			hb.InputBatchRowCount = bat.RowCount()
+			require.NoError(t, hb.BuildHashmap(false, true, false, proc))
+			var ids []int32
+			releases := 0
+			for _, output := range hb.Batches.Buf {
+				for i := 0; i < output.RowCount(); i++ {
+					if !output.Vecs[3].IsNull(uint64(i)) {
+						ids = append(ids, vector.GetFixedAtNoTypeCheck[int32](output.Vecs[3], i))
+					}
+					if vector.GetFixedAtNoTypeCheck[bool](output.Vecs[2], i) {
+						releases++
+					}
+				}
+			}
+			require.Equal(t, tt.wantIDs, ids)
+			require.Equal(t, wantReleases, releases, "release evidence must survive compaction")
+			require.Equal(t, tt.warnings, session.total)
+			if tt.warnings > 0 {
+				require.Equal(t, []hashBuildWarning{{code: moerr.ER_DUP_ENTRY, msg: "Duplicate entry '30' for key 'uk'"}}, session.warnings)
+			}
+			if wantReleases > 0 {
+				require.True(t, hb.DelRows.Contains(0))
+			}
+		})
+	}
+}
+
 func TestBuildHashmapErrorDoesNotLeakIterators(t *testing.T) {
 	hb := newTestHashmapBuilder(t)
 	mp := mpool.MustNewZero()
```

---

### Incident Patch 2: `5d63cf6b` (2026-11-18)
**Commit Message**: ci: reduce race UT work and harden fixture retirement (#32872)

## What type of PR is this?

- [x] Improvement
- [x] Test and CI

## Which issue(s) this PR fixes:

Refs #32745 (FLAKY-001). The issue is a long-lived tracker and should
remain open.

## What this PR does / why we need it:

Reduce repeated race-test cluster setup and large query construction
while retaining the distinct contracts:

- Reuse one dedicated cluster for five compatible inventory CAS cases;
verify each case's database, catalog table and writer transactions are
retired before the next one. Keep restart and topology-sensitive cases
separate.
- Run one complete same-row-count collation repair, then verify each
other field corruption using the real upgrade predicate and an
independently rolled-back transaction. Keep the other repair and retry
cases.
- Keep real 256-branch planner boundary witnesses, but test budget reuse
and case-insensitive admission without repeatedly building equivalent
wide plans. Check that separate builds obtain a fresh budget and
enumerate their own metadata.
- Preserve all 24 strict CTAS error, alias-reuse and cleanup cases. For
each successful mode and table type, keep the standalone co

**File**: `pkg/cnservice/server_heartbeat.go` (modified, +30/-2)
```diff
@@ -16,6 +16,7 @@ package cnservice
 
 import (
 	"context"
+	"errors"
 	"time"
 
 	"go.uber.org/zap"
@@ -30,6 +31,33 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/version"
 )
 
+// ViewMetadataWithdrawalError identifies a failed final admission withdrawal.
+// Close still returns the underlying diagnostic through Unwrap.
+type ViewMetadataWithdrawalError struct{ Err error }
+
+func (e *ViewMetadataWithdrawalError) Error() string { return e.Err.Error() }
+func (e *ViewMetadataWithdrawalError) Unwrap() error { return e.Err }
+
+// IsOnlyViewMetadataWithdrawalTimeout rejects mixed and unknown close errors.
+func IsOnlyViewMetadataWithdrawalTimeout(err error) bool {
+	if e, ok := err.(*ViewMetadataWithdrawalError); ok {
+		return errors.Is(e.Err, context.DeadlineExceeded)
+	}
+	if joined, ok := err.(interface{ Unwrap() []error }); ok {
+		children := joined.Unwrap()
+		if len(children) == 0 {
+			return false
+		}
+		for _, child := range children {
+			if !IsOnlyViewMetadataWithdrawalTimeout(child) {
+				return false
+			}
+		}
+		return true
+	}
+	return false
+}
+
 var cnCommandPollFailed = logutil.Event{
 	Name:    "cn.schedule-command.poll.failed",
 	Message: "failed to poll cn schedule commands",
@@ -257,13 +285,13 @@ func (s *service) withdrawViewMetadataAdmission() error {
 		err = moerr.AttachCause(ctx, err)
 		s.logger.Error("failed to publish final view metadata withdrawal",
 			zap.Bool("clean_handoff", false), zap.Error(err))
-		return err
+		return &ViewMetadataWithdrawalError{Err: err}
 	}
 	if ctx.Err() != nil {
 		err = moerr.AttachCause(ctx, ctx.Err())
 		s.logger.Error("final view metadata withdrawal timed out",
 			zap.Bool("clean_handoff", false), zap.Error(err))
-		return err
+		return &ViewMetadataWithdrawalError{Err: err}
 	}
 	s.logger.Info("published final view metadata withdrawal",
 		zap.Bool("clean_handoff", true),
```

**File**: `pkg/cnservice/server_heartbeat_test.go` (modified, +5/-1)
```diff
@@ -318,7 +318,11 @@ func TestWithdrawViewMetadataAdmissionFailureIsNotCleanHandoff(t *testing.T) {
 			logger:                          zap.NewNop(),
 			viewMetadataAdmissionGeneration: 8,
 		}
-		require.ErrorIs(t, s.withdrawViewMetadataAdmission(), context.DeadlineExceeded)
+		err := s.withdrawViewMetadataAdmission()
+		require.ErrorIs(t, err, context.DeadlineExceeded)
+		require.True(t, IsOnlyViewMetadataWithdrawalTimeout(errors.Join(err)))
+		require.False(t, IsOnlyViewMetadataWithdrawalTimeout(errors.Join(err, errors.New("local teardown failed"))))
+		require.False(t, IsOnlyViewMetadataWithdrawalTimeout(context.DeadlineExceeded))
 	})
 }
 
```

**File**: `pkg/embed/cdc_watermark_lifetime_test.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func (p *watermarkRetirementProbeExecutor) Query(ctx context.Context, sql string
 func TestCDCWatermarkUpdaterRuntimeRetirement(t *testing.T) {
 	// This scenario owns its cluster independently of earlier shared-fixture tests.
 	require.NoError(t, CloseBaseClusterTests())
-	require.NoError(t, CloseSingleCNBaseClusterTests())
+	require.NoError(t, discardSingleCNBaseClusterTests())
 	c, err := NewCluster(WithTesting(), WithCNCount(1))
 	require.NoError(t, err)
 	defer func() { require.NoError(t, c.Close()) }()
```

**File**: `pkg/embed/testing.go` (modified, +17/-1)
```diff
@@ -22,7 +22,9 @@ import (
 	"sync"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/cnservice"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/logutil"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/util/metric/stats"
@@ -469,6 +471,10 @@ func (c *SharedTestCluster) CloseIfActive() error {
 // A topology switch may release an idle fixture, but must not wait for a
 // callback that could be making the switch itself or bypass its cleanup.
 func (c *SharedTestCluster) closeIfActive(waitForCallback bool) error {
+	return c.closeIfActiveWithDiscard(waitForCallback, false)
+}
+
+func (c *SharedTestCluster) closeIfActiveWithDiscard(waitForCallback, discard bool) error {
 	c.initializeRunCondition()
 	c.mu.Lock()
 	defer c.mu.Unlock()
@@ -487,7 +493,7 @@ func (c *SharedTestCluster) closeIfActive(waitForCallback bool) error {
 	// automatic attempt has happened, this method remains the explicit retry
 	// path for incomplete cleanup.
 	if c.sealed && !c.cleanupTried && len(c.cleanupRegistrations) > 0 {
-		if !waitForCallback {
+		if !waitForCallback || discard {
 			return moerr.NewInvalidStateNoCtx("shared cluster callback cleanup is still pending")
 		}
 		return nil
@@ -501,6 +507,10 @@ func (c *SharedTestCluster) closeIfActive(waitForCallback bool) error {
 		return errors.Join(err, moerr.NewInvalidStateNoCtx("shared cluster cleanup is incomplete"))
 	}
 	c.resetGenerationLocked()
+	if discard && cnservice.IsOnlyViewMetadataWithdrawalTimeout(err) {
+		logutil.Warnf("discarded complete test cluster after final admission withdrawal timed out: %v", err)
+		return nil
+	}
 	return err
 }
 
@@ -735,6 +745,12 @@ func CloseSingleCNBaseClusterTests() error {
 	return singleCNClusterState.CloseIfActive()
 }
 
+// discardSingleCNBaseClusterTests destroys the complete shared topology. A
+// timed-out remote handoff is diagnostic once its HAKeeper is also gone.
+func discardSingleCNBaseClusterTests() error {
+	return singleCNClusterState.closeIfActiveWithDiscard(true, true)
+}
+
 // Admission is exclusive and all owners of this generation have completed
 // cleanup. Keep the generation number monotonic so stale finalizers cannot
 // affect a replacement fixture.
```

**File**: `pkg/embed/testing_test.go` (modified, +53/-0)
```diff
@@ -23,13 +23,66 @@ import (
 	"testing"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/cnservice"
 	mruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
 	"github.com/matrixorigin/matrixone/pkg/taskservice"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
 
+func TestDiscardSharedClusterOnlyAcceptsCompletedWithdrawalTimeout(t *testing.T) {
+	remote := &cnservice.ViewMetadataWithdrawalError{Err: context.DeadlineExceeded}
+	local := errors.New("local teardown failed")
+	for _, tc := range []struct {
+		name     string
+		err      error
+		complete bool
+		wantOK   bool
+	}{
+		{"completed withdrawal timeout", remote, true, true},
+		{"nested withdrawal timeouts", errors.Join(remote, errors.Join(remote)), true, true},
+		{"plain local deadline", context.DeadlineExceeded, true, false},
+		{"other withdrawal error", &cnservice.ViewMetadataWithdrawalError{Err: local}, true, false},
+		{"mixed withdrawal and local error", errors.Join(remote, local), true, false},
+		{"incomplete teardown", remote, false, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			svc := &completedCloseService{closeTrackingService: closeTrackingService{closeErr: tc.err}, complete: tc.complete}
+			op := &operator{state: started}
+			op.reset.svc = svc
+			value := &cluster{state: started, services: []*operator{op}}
+			state := SharedTestCluster{cluster: value}
+			err := state.closeIfActiveWithDiscard(true, true)
+			if tc.wantOK {
+				require.NoError(t, err)
+				require.Nil(t, state.cluster)
+				require.True(t, value.CloseComplete())
+			} else {
+				require.Error(t, err)
+				require.ErrorIs(t, err, tc.err)
+				if !tc.complete {
+					require.Same(t, value, state.cluster)
+				}
+			}
+		})
+	}
+	t.Run("pending callback cleanup", func(t *testing.T) {
+		svc := &completedCloseService{complete: true}
+		op := &operator{state: started}
+		op.reset.svc = svc
+		value := &cluster{state: started, services: []*operator{op}}
+		state := SharedTestCluster{
+			cluster:              value,
+			sealed:               true,
+			cleanupRegistrations: map[sharedCleanupRegistration]struct{}{{}: {}},
+		}
+		require.ErrorContains(t, state.closeIfActiveWithDiscard(true, true), "callback cleanup is still pending")
+		require.Same(t, value, state.cluster)
+		require.Zero(t, svc.closeCount.Load())
+	})
+}
+
 func TestWaitBasicClusterTaskServicesRejectsMissingCN(t *testing.T) {
 	err := waitBasicClusterTaskServices(context.Background(), &cluster{}, 1)
 	require.ErrorContains(t, err, "service not found")
```

**File**: `pkg/fileservice/disk_cache_download_test.go` (modified, +23/-1)
```diff
@@ -38,9 +38,14 @@ func downloading(t *testing.T) (*DiskCache, *io.PipeWriter, chan error) {
 	require.NoError(t, err)
 	t.Cleanup(func() { cache.Close(ctx) })
 	pr, pw := io.Pipe()
-	t.Cleanup(func() { _ = pw.Close() })
 	filled := make(chan error, 1)
+	done := make(chan struct{})
+	t.Cleanup(func() {
+		_ = pw.CloseWithError(io.ErrClosedPipe)
+		<-done
+	})
 	go func() {
+		defer close(done)
 		filled <- cache.SetFile(ctx, "obj", func(context.Context) (io.ReadCloser, error) { return pr, nil })
 	}()
 	require.Eventually(t, func() bool { return cache.download(cache.pathForFile("obj")) != nil },
@@ -130,6 +135,23 @@ func TestDiskCacheReadOfDownloadStopsOnCancel(t *testing.T) {
 	require.False(t, waitVector(t, pending).Entries[0].done)
 }
 
+func TestDiskCacheDownloadCleanupJoinsAbandonedFill(t *testing.T) {
+	var filled chan error
+	// Establish TempDir's cleanup before registering the witness. downloading
+	// creates another directory under the same test-owned parent.
+	t.TempDir()
+	// The witness runs after downloading's cleanups and before TempDir removal.
+	t.Cleanup(func() {
+		select {
+		case err := <-filled:
+			require.ErrorIs(t, err, io.ErrClosedPipe)
+		default:
+			t.Error("abandoned cache fill outlived its cleanup")
+		}
+	})
+	_, _, filled = downloading(t)
+}
+
 // A download that ends with the object shorter than a read leaves the read unserved.
 func TestDiskCacheReadBeyondDownloadedObject(t *testing.T) {
 	rangeReadsCost(t, time.Hour)
```

**File**: `pkg/sql/plan/subscription_metadata_test.go` (modified, +51/-11)
```diff
@@ -603,37 +603,77 @@ func TestSubscriptionStatisticsBudgetUsesIdentifierCaseMode(t *testing.T) {
 
 	for _, mode := range []int64{1, 2} {
 		t.Run(fmt.Sprintf("case-insensitive mode %d deduplicates", mode), func(t *testing.T) {
-			optimizer, ctx := newSubscriptionMetadataTestOptimizer(t)
+			_, ctx := newSubscriptionMetadataTestOptimizer(t)
 			ctx.lowerCaseTableNames = mode
 			ctx.metadata = metadata
-
-			queryPlan, err := runOneStmt(optimizer, t,
-				"select count(*) from information_schema.statistics")
+			builder := NewQueryBuilder(plan.Query_SELECT, ctx, false, false)
+			visible, err := builder.visibleSubscriptionMetadata(nil)
 			require.NoError(t, err)
-			require.Len(t, statisticsPublisherScanCounts(queryPlan.GetQuery()),
-				maxSubscriptionStatisticsPublisherBranches)
-			require.Equal(t, maxSubscriptionStatisticsPublisherBranches, ctx.publisherBindCount)
+			require.Len(t, visible, maxSubscriptionStatisticsPublisherBranches)
+			var matching []string
+			for _, subscription := range visible {
+				if strings.EqualFold(subscription.Meta.SubName, "SubCase") {
+					matching = append(matching, subscription.Meta.SubName)
+				}
+			}
+			require.Equal(t, []string{"SubCase"}, matching)
+			require.Equal(t, []int{maxSubscriptionStatisticsPublisherBranches}, ctx.metadataLimits)
+			require.Zero(t, ctx.publisherBindCount)
 			require.Nil(t, ctx.GetQueryingSubscription())
+			_, err = builder.visibleSubscriptionMetadata(nil)
+			require.ErrorContains(t, err, "publisher expansion exceeds planning budget of 256 branches")
+			if mode == 1 {
+				// Retain one complete boundary-sized plan without an outer filter.
+				optimizer, full := newSubscriptionMetadataTestOptimizer(t)
+				full.lowerCaseTableNames = mode
+				full.metadata = metadata
+				queryPlan, err := runOneStmt(optimizer, t, "select count(*) from information_schema.statistics")
+				require.NoError(t, err)
+				require.Len(t, statisticsPublisherScanCounts(queryPlan.GetQuery()), maxSubscriptionStatisticsPublisherBranches)
+				require.Equal(t, maxSubscriptionStatisticsPublisherBranches, full.publisherBindCount)
+				require.Nil(t, full.GetQueryingSubscription())
+			}
 		})
 	}
 }
 
 func TestSubscriptionStatisticsBudgetDoesNotLeakAcrossBuilds(t *testing.T) {
+	t.Run("admission is per builder", func(t *testing.T) {
+		_, ctx := newSubscriptionMetadataTestOptimizer(t)
+		ctx.metadata = subscriptionMetadataTestSet(129)
+		builder := NewQueryBuilder(plan.Query_SELECT, ctx, false, false)
+		visible, err := builder.visibleSubscriptionMetadata(nil)
+		require.NoError(t, err)
+		require.Len(t, visible, 129)
+		_, err = builder.visibleSubscriptionMetadata(nil)
+		require.ErrorContains(t, err, "publisher expansion exceeds planning budget of 256 branches")
+		fresh := NewQueryBuilder(plan.Query_SELECT, ctx, false, false)
+		visible, err = fresh.visibleSubscriptionMetadata(nil)
+		require.NoError(t, err)
+		require.Len(t, visible, 129)
+		require.Equal(t, []int{256, 256}, ctx.metadataLimits)
+	})
+
 	_, ctx := newSubscriptionMetadataTestOptimizer(t)
-	ctx.metadata = subscriptionMetadataTestSet(129)
 	statements, err := mysql.Parse(context.Background(),
 		"select count(*) from information_schema.statistics", 1)
 	require.NoError(t, err)
 	require.Len(t, statements, 1)
 	defer statements[0].Free()
 
-	for build := 0; build < 2; build++ {
+	wantScans := []map[string]int{
+		{"sub_00": 1, "sub_01": 1},
+		{"sub_00": 1, "sub_01": 1, "sub_02": 1},
+	}
+	for build := range wantScans {
+		ctx.metadata = subscriptionMetadataTestSet(build + 2)
 		queryPlan, buildErr := BuildPlan(ctx, statements[0], false, nil)
 		require.NoError(t, buildErr)
-		require.Len(t, statisticsPublisherScanCounts(queryPlan.GetQuery()), 129)
+		require.Equal(t, wantScans[build], statisticsPublisherScanCounts(queryPlan.GetQuery()))
 		require.Nil(t, ctx.GetQueryingSubscription())
 	}
-	require.Equal(t, 258, ctx.publisherBindCount,
+	require.Equal(t, []int{256, 256}, ctx.metadataLimits)
+	require.Equal(t, 5, ctx.publisherBindCount,
 		"the statement-wide budget must be fresh for each independent build")
 }
 
```

**File**: `pkg/tests/issues/issue_28605_test.go` (modified, +36/-7)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"database/sql"
 	"fmt"
+	"strings"
 	"testing"
 	"time"
 
@@ -67,6 +68,8 @@ func TestCTASDivisionByZero(t *testing.T) {
 		exec("USE `" + name + "`")
 		exec("CREATE TABLE src(id INT PRIMARY KEY,n INT,d INT)")
 		exec("INSERT INTO src VALUES(1,10,2),(2,10,0),(3,9,3)")
+		runtimeExpressions := []string{"n/d", "n DIV d", "n % d", "CAST(n AS DECIMAL(18,4))/d", "CAST(n AS DOUBLE)/d"}
+		allExpressions := append([]string{runtimeExpressions[0], "10/0"}, runtimeExpressions[1:]...)
 		for _, temporary := range []bool{false, true} {
 			t.Run(fmt.Sprintf("temporary=%t", temporary), func(t *testing.T) {
 				prefix := "CREATE TABLE copied"
@@ -77,14 +80,19 @@ func TestCTASDivisionByZero(t *testing.T) {
 					t.Run(mode, func(t *testing.T) {
 						err := execSQL("SET SESSION sql_mode='" + mode + "'")
 						require.NoError(t, err)
-						for _, expression := range []string{"n/d", "10/0", "n DIV d", "n % d", "CAST(n AS DECIMAL(18,4))/d", "CAST(n AS DOUBLE)/d"} {
+						strict := mode == "STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO" || mode == "STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO"
+						for _, expression := range allExpressions {
+							// Keep strict failures and constant folding in standalone CTAS
+							// statements. Successful runtime expressions are checked together.
+							if !strict && expression != "10/0" {
+								continue
+							}
 							t.Run(expression, func(t *testing.T) {
 								t.Cleanup(func() {
 									err := execSQL("DROP TABLE IF EXISTS copied")
 									require.NoError(t, err)
 								})
 								err := execSQL(prefix + " AS SELECT id," + expression + " AS v FROM src ORDER BY id")
-								strict := mode == "STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO" || mode == "STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO"
 								if strict {
 									var sqlErr *mysql.MySQLError
 									require.ErrorAs(t, err, &sqlErr)
@@ -99,11 +107,32 @@ func TestCTASDivisionByZero(t *testing.T) {
 									var count, nulls int
 									require.NoError(t, queryScan("SELECT COUNT(*),COUNT(*)-COUNT(v) FROM copied", &count, &nulls))
 									require.Equal(t, 3, count)
-									wantNulls := 1
-									if expression == "10/0" {
-										wantNulls = 3
-									}
-									require.Equal(t, wantNulls, nulls)
+									require.Equal(t, 3, nulls)
+								}
+							})
+						}
+						if !strict {
+							t.Run("runtime expressions", func(t *testing.T) {
+								t.Cleanup(func() {
+									err := execSQL("DROP TABLE IF EXISTS copied")
+									require.NoError(t, err)
+								})
+								projections := make([]string, len(runtimeExpressions))
+								for i, expression := range runtimeExpressions {
+									projections[i] = fmt.Sprintf("%s AS v%d", expression, i)
+								}
+								err := execSQL(prefix + " AS SELECT id," + strings.Join(projections, ",") + " FROM src ORDER BY id")
+								require.NoError(t, err)
+								for i, expression := range runtimeExpressions {
+									t.Run(expression, func(t *testing.T) {
+										var count, nulls, zeroDenominatorNulls int
+										column := fmt.Sprintf("v%d", i)
+										require.NoError(t, queryScan("SELECT COUNT(*),COUNT(*)-COUNT("+column+"),"+
+											"COUNT(CASE WHEN id=2 AND "+column+" IS NULL THEN 1 END) FROM copied", &count, &nulls, &zeroDenominatorNulls))
+										require.Equal(t, 3, count)
+										require.Equal(t, 1, nulls)
+										require.Equal(t, 1, zeroDenominatorNulls)
+									})
 								}
 							})
 						}
```

#### Recent Merged Pull Requests:
- **PR #32898** (2026-11-18): [4.2-dev] Preserve normal completion on local stop during serial reader construction (@VioletQwQ-0)
- **PR #32894** (2026-11-18): [4.2-dev] perf: reduce clone metadata work and isolate checkpoint replay (@gouhongshen)
- **PR #32888** (closed): fix(bitmap): preserve sparse tails during ordered remap (cherry-pick #32846) (@ck89119)
- **PR #32887** (2026-11-18): [4.2-dev] Preserve ENUM definitions across schema rebuilds and honor explicit redefinition (@XuPeng-SH)
- **PR #32877** (2026-11-18): [4.2-dev] fix: preserve SQL S3 environment region fallback (@Ariznawlll)
- **PR #32874** (closed): fix: respect ci collations in ENUM/SET comparisons (@gouhongshen)

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

## X. preserve accepted UNIQUE keys in multi-target UPDATE IGNORE

**RULE**:
When implementing operations in `docs/design/20261117-update-ignore-unique-arbitration.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `87c44445`: preserve accepted UNIQUE keys in multi-target UPDATE IGNORE. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261117-update-ignore-unique-arbitration.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Unique arbitration for repeated-target UPDATE IGNORE

Issue: [#31824](https://github.com/matrixorigin/matrixone/issues/31824)

Implementation: [#32827](https://github.com/matrixorigin/matrixone/pull/32827)

## Problem and contract

An UPDATE can write the same physical table through more than one alias. Under
IGNORE, each alias can change a row that an earlier alias already changed or
rejected. Checking each alias against the statement snapshot independently is
not sufficient: a later alias can claim a key already accepted for another row,
or a surviving key can be mistaken for a released snapshot key. In either
case the table or its unique index can contain conflicting entries.

Keep the existing ordered alias stages. For each physical row, S is its
statement-snapshot image and C its latest accepted image, initially S. Each
active alias forms a candidate N from C, including recomputed generated
columns. If its constraints reject it under IGNORE, retain C and report the
rejected candidate; otherwise N becomes the next C. Earlier rejected
assignments are not resurrected. Each accepted physical key must have at most
one owner under the actual index equality and encoding, including 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `87c44445` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
