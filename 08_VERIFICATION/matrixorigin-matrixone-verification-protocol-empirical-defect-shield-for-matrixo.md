# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin/matrixone

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "e765c5fd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T01:34:09.277Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `e765c5fd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T01:34:09.277Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin/matrixone` (Commit: `e765c5fd`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T01:34:08.221Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2066 stars

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
- **Issue #32823** (2026-11-17): **[4.2] Fix grouped ENUM and SET numeric conversions**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #32819  ## What this PR does / why we need it:  On 4.2-dev, numeric operations on a grouped ENUM or SET can attempt to convert its display label instead of using its ordinal or bitmap. For example, grouping `ENUM('a','b')` and selecting `e + 0` fails on the label `a` even though the corresponding row-level expression succeeds.  Adapt the approach from #28751 to 4.2's existing ENUM encoding and provenance rules. Recover the stored numeric value only when the original domain is known and reversible, including numeric casts, scalar comparisons, IN/quantified subqueries, and the correlated scalar and projection forms covered by the regression tests. Keep string comparisons and ambiguous domains on their existing paths. A numeric IN list may contain NULL without losing its numeric comparison semantics.  This reuses existing conversion overloads and does not change persisted formats. Numeric operations on grouped or projected values add conversion work for those expressions only. The general correlated scalar projection path for a subquery with its own FROM remains unsupported by the existing executor; the same query shape also fails with ordinary integer columns on the exact 4.2-dev base. Legacy overload compatibility was checked against the source and serialized plans; mixed-version execution 

- **Issue #32815** (2026-11-16): **perf(malloc): advise huge pages for large MPool mappings**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32813  ## What this PR does / why we need it:  Advise fresh Linux MPool mappings of at least 2 MiB with `MADV_HUGEPAGE` before handing the allocation to callers. Under `defer+madvise`, this permits compaction for large query buffers whose first touches would otherwise fall back to many small-page faults when contiguous blocks are scarce.  Treat advice as optional and preserve successful allocation if the hint is unavailable. Keep exact allocation sizes, zeroing, memory accounting, bounded reuse and cleanup. Reused mappings retain their policy without another syscall. Small allocations, the file-service cache allocator and Darwin retain their existing behavior.  ## Validation  Focused SimpleCAllocator tests and the owning malloc/MPool packages pass, including the 2 MiB boundary cases. Convention checks and configured static checks for the changed package pass with repository-pinned tools.  Actual-allocator controls measure available and fragmented backing with serial and 32-worker first touches. The local SF100 disk comparison covers all 22 queries with one process per arm, one excluded cold suite and five profiled warm suites, using identical cache and memory thresholds with spilling and swap disallowed. Per-query results, Q11 I/O tracing, binary/source provenance and measurement lim

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

### Incident Patch 1: `7fcd9bdf` (2026-11-16)
**Commit Message**: fix: publish partitioned CREATE INDEX metadata through ALTER (#32772)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32211

## What this PR does / why we need it:

Standalone CREATE INDEX could succeed on a partitioned table while SHOW INDEX, SHOW CREATE TABLE and FORCE INDEX could not see the logical parent index.

Route ordinary BTREE CREATE INDEX, including the existing UNIQUE form, through the same existing ALTER TABLE ADD INDEX transactional route used by ALTER. This publishes the logical parent and physical partition children together; it does not add a new partition index mechanism. Preserve quoted identifiers, serializable options, typed duplicate-name errors and existing paths for other index families. Add the CI test-readiness fence for the isolated SQL task-ownership test.

Validation:

- Three actual native/CGo foreground test invocations passed; current owning-package coverage is 488 packages.
- Pinned 510-package SCA passed with zero findings: `make static-check-selected STATIC_CHECK_PACKAGES="$(cat /home/mo/.local/share/matr

**File**: `pkg/sql/compile/alter.go` (modified, +12/-2)
```diff
@@ -2745,14 +2745,24 @@ func (s *Scope) AlterTable(c *Compile) (err error) {
 				return err
 			}
 
-			st, _ := parsers.ParseOne(
+			st, err := parsers.ParseOne(
 				c.proc.Ctx,
 				dialect.MYSQL,
 				qry.RawSQL,
 				c.getLower(),
 			)
+			if err != nil {
+				// Propagate the original parse error instead of dropping
+				// it and asserting the statement type downstream.
+				return err
+			}
+			alterPartitionStmt, ok := st.(*tree.AlterTable)
+			if !ok {
+				return moerr.NewParseError(c.proc.Ctx,
+					fmt.Sprintf("not an ALTER TABLE statement: %s", qry.RawSQL))
+			}
 			return c.alterPartitionTables(
-				st.(*tree.AlterTable),
+				alterPartitionStmt,
 				metadata.Partitions,
 				hasAlterAutoIncrementReset(qry.Actions),
 				cleanup,
```

**File**: `pkg/sql/parsers/tree/create.go` (modified, +22/-3)
```diff
@@ -2129,6 +2129,11 @@ type IndexOption struct {
 }
 
 // Must follow the following sequence when test
+// IsEmpty reports whether Format renders nothing for this option set: it is
+// the exact gate Format uses for its leading separator, kept as a single
+// source of truth so callers can decide whether to serialize an option at
+// all. The index type (IType) is serialized by the owning index AST, not
+// here, and the engine attributes have no serialized form at all.
 func (node *IndexOption) Format(ctx *FmtCtx) {
 	if node.KeyBlockSize != 0 || node.ParserName != "" ||
 		node.Comment != "" || node.Visible != VISIBLE_TYPE_INVALID ||
@@ -2158,7 +2163,21 @@ func (node *IndexOption) Format(ctx *FmtCtx) {
 	}
 	if node.Comment != "" {
 		ctx.WriteString("comment ")
-		ctx.WriteString(node.Comment)
+		if ctx.singleQuoteString {
+			// Mirror the OP_TYPE serializer's owner semantics (issue #32211):
+			// escape the backslash-escape mode first so the consumer's
+			// backslash-aware ParseOne restores the exact comment bytes,
+			// then single-quote escaping.
+			value := node.Comment
+			if !ctx.NoBackslashEscape() {
+				value = FormatString(value)
+			}
+			ctx.WriteByte('\'')
+			ctx.WriteString(strings.ReplaceAll(value, "'", "''"))
+			ctx.WriteByte('\'')
+		} else {
+			ctx.WriteString(node.Comment)
+		}
 		ctx.WriteByte(' ')
 	}
 	if node.AlgoParamList != 0 {
@@ -2398,7 +2417,7 @@ func (node *Index) Format(ctx *FmtCtx) {
 	}
 	if node.Name != "" {
 		ctx.WriteByte(' ')
-		ctx.WriteString(node.Name)
+		ctx.WriteIdentifier(Identifier(node.Name))
 	}
 	if node.KeyType != INDEX_TYPE_INVALID {
 		ctx.WriteString(" using ")
@@ -2463,7 +2482,7 @@ func (node *UniqueIndex) Format(ctx *FmtCtx) {
 	ctx.WriteString("unique key")
 	if node.Name != "" {
 		ctx.WriteByte(' ')
-		ctx.WriteString(node.Name)
+		ctx.WriteIdentifier(Identifier(node.Name))
 	}
 	if !node.Empty {
 		ctx.WriteString(" using none")
```

**File**: `pkg/sql/parsers/tree/issue_32211_index_option_format_test.go` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
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
+package tree
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+)
+
+// Issue #32211 review R1: the global IndexOption formatter must keep
+// rendering ASYNC-only options. The delegated-empty-option normalization
+// owns only the whitelisted KEY_BLOCK_SIZE/comment/visibility fields and
+// must never drop unrelated legal option content (previously an ASYNC-only
+// option still rendered through the caller's leading separator).
+func TestIssue32211IndexOptionAsyncOnlyStillRenders(t *testing.T) {
+	opt := &IndexOption{Async: true}
+
+	ctx := NewFmtCtx(dialect.MYSQL)
+	opt.Format(ctx)
+	require.Contains(t, ctx.String(), "ASYNC",
+		"an ASYNC-only legal index option must keep its ASYNC render")
+
+	wrapped := &Index{
+		Name:        "idx_async",
+		KeyType:     INDEX_TYPE_INVALID,
+		IndexOption: opt,
+	}
+	serialized := StringWithOpts(wrapped, dialect.MYSQL,
+		WithQuoteIdentifier(), WithSingleQuoteString())
+	require.Contains(t, serialized, "ASYNC",
+		"the serialized index must keep the ASYNC option")
+}
+
+// Issue #32211 review R2: the single-quote comment branch must reuse the
+// OP_TYPE owner semantics — FormatString for the consumer's backslash-aware
+// ParseOne, then single-quote doubling — so the raw-SQL byte loop restores
+// the exact comment. Expected bytes are pinned per case per mode as an
+// independent oracle; the default mode keeps writing raw bytes.
+func TestIssue32211IndexOptionCommentEscapingBytes(t *testing.T) {
+	cases := []struct {
+		name string
+		// default-mode bytes: the raw comment exactly as before
+		wantDefault string
+		// singleQuoteString-mode bytes: FormatString + quote doubling
+		wantSingleQuoted string
+		// singleQuoteString + NO_BACKSLASH_ESCAPES form: only quote doubling
+		wantNoBackslash string
+	}{
+		{
+			name:             "real newline",
+			wantDefault:      " comment line1\nline2 ",
+			wantSingleQuoted: " comment 'line1\\nline2' ",
+			wantNoBackslash:  " comment 'line1\nline2' ",
+		},
+		{
+			name:             "real tab",
+			wantDefault:      " comment col1\tcol2 ",
+			wantSingleQuoted: " comment 'col1\\tcol2' ",
+			wantNoBackslash:  " comment 'col1\tcol2' ",
+		},
+		{
+			// value bytes: a backslash b space c
+			name:             "backslash before letter",
+			wantDefault:      " comment a\\b c ",
+			wantSingleQuoted: " comment 'a\\\\b c' ",
+			wantNoBackslash:  " comment 'a\\b c' ",
+		},
+		{
+			// value bytes: p r e backslash quote p o s t
+			name:             "backslash before quote",
+			wantDefault:      " comment pre\\'post ",
+			wantSingleQuoted: " comment 'pre\\\\''post' ",
+			wantNoBackslash:  " comment 'pre\\''post' ",
+		},
+		{
+			name:             "utf8",
+			wantDefault:      " comment 数据库 ✓ ok ",
+			wantSingleQuoted: " comment '数据库 ✓ ok' ",
+			wantNoBackslash:  " comment '数据库 ✓ ok' ",
+		},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			// Restore the exact producing source values for each expected
+			// byte form (reverse of the escaping the oracle pins).
+			var comment string
+			switch tc.name {
+			case "real newline":
+				comment = "line1\nline2"
+			case "real tab":
+				comment = "col1\tcol2"
+			case "backslash before letter":
+				comment = "a\\b c"
+			case "backslash before quote":
+				comment = "pre\\'post"
+			default:
+				comment = "数据库 ✓ ok"
+			}
+
+			def := NewFmtCtx(dialect.MYSQL)
+			(&IndexOption{Comment: comment}).Format(def)
+			require.Equal(t, tc.wantDefault, def.String(),
+				"default formatting must keep writing the raw comment bytes")
+
+			sq := NewFmtCtx(dialect.MYSQL, WithSingleQuoteString())
+			(&IndexOption{Comment: comment}).Format(sq)
+			require.Equal(t, tc.wantSingleQuoted, sq.String(),
+				"single-quote mode must mirror the OP_TYPE owner bytes")
+
+			nb := NewFmtCtx(dialect.MYSQL, WithSingleQuoteString(), WithNoBackslashEscape())
+			(&IndexOption{Comment: comment}).Format(nb)
+			require.Equal(t, tc.wantNoBackslash, nb.String(),
+				"NO_BACKSLASH_ESCAPES form must only double quotes")
+		})
+	}
+}
```

**File**: `pkg/sql/plan/build_ddl.go` (modified, +129/-1)
```diff
@@ -6684,7 +6684,12 @@ func buildCreateIndex(stmt *tree.CreateIndex, ctx CompilerContext) (*Plan, error
 	switch stmt.IndexCat {
 	case tree.INDEX_CATEGORY_UNIQUE:
 		uIdx = &tree.UniqueIndex{
-			Name:        indexName,
+			Name: indexName,
+			// Parser-consistent typed construction: ALTER's own AST
+			// records only whether an explicit USING index type was
+			// present on a unique index, not which one. Serialize the
+			// same shape so the delegable default form roundtrips.
+			Empty:       stmt.IndexOption.IType == tree.INDEX_TYPE_INVALID,
 			KeyParts:    stmt.KeyParts,
 			IndexOption: stmt.IndexOption,
 		}
@@ -6727,6 +6732,65 @@ func buildCreateIndex(stmt *tree.CreateIndex, ctx CompilerContext) (*Plan, error
 	default:
 		return nil, moerr.NewNotSupportedf(ctx.GetContext(), "statement: '%v'", tree.String(stmt, dialect.MYSQL))
 	}
+	// Partitioned tables: the dedicated CREATE INDEX executor publishes each
+	// physical partition child only and never the logical parent, so SHOW
+	// INDEX, SHOW CREATE TABLE and index hints — all resolved from the
+	// logical table id — cannot observe the index even though the statement
+	// succeeds (issue #32211). MySQL defines CREATE INDEX ON t (...) as
+	// ALTER TABLE t ADD INDEX (...), so plan the qualified ordinary and
+	// unique forms through the ALTER route: its executor publishes the
+	// logical parent and re-runs the same ADD INDEX on every partition child
+	// child inside one transaction. Eligibility is bounded to the forms whose typed
+	// AST survives the executor's RawSQL serialize → reparse → per-child
+	// re-serialize loop losslessly: the default and explicit-BTREE ordinary and
+	// unique forms, keeping quoted identifiers and the
+	// serializable KEY_BLOCK_SIZE/comment/visibility options intact. Every
+	// other family — the vector/plugin and other explicit index algos,
+	// non-BTREE USING unique indexes, functional, fulltext and spatial forms —
+	// keeps its dedicated CREATE INDEX planning path and original errors.
+	if tableDef.Partition != nil || features.IsPartitioned(tableDef.FeatureFlag) {
+		switch stmt.IndexCat {
+		case tree.INDEX_CATEGORY_UNIQUE:
+			if (stmt.IndexOption.IType == tree.INDEX_TYPE_INVALID ||
+				stmt.IndexOption.IType == tree.INDEX_TYPE_BTREE) &&
+				indexOptionDelegable(stmt.IndexOption) {
+				return buildAlterTable(&tree.AlterTable{
+					Table: stmt.Table,
+					Options: tree.AlterTableOptions{&tree.AlterOptionAdd{Def: &tree.UniqueIndex{
+						// Build the delegable form exactly as ALTER's own
+						// parser carries it: Empty records that no USING
+						// index type was declared, and the option survives
+						// only when something renders (KEY_BLOCK_SIZE,
+						// comment, visibility) — keeping the per-partition
+						// RawSQL reparse/rewrite loop lossless and
+						// byte-idempotent.
+						KeyParts:    stmt.KeyParts,
+						Name:        indexName,
+						Empty:       true,
+						IndexOption: alterNativeIndexOption(stmt.IndexOption),
+					}}},
+				}, ctx)
+			}
+		case tree.INDEX_CATEGORY_NONE:
+			if (sIdx.KeyType == tree.INDEX_TYPE_INVALID || sIdx.KeyType == tree.INDEX_TYPE_BTREE) &&
+				indexOptionDelegable(stmt.IndexOption) {
+				return buildAlterTable(&tree.AlterTable{
+					Table: stmt.Table,
+					Options: tree.AlterTableOptions{&tree.AlterOptionAdd{Def: &tree.Index{
+						// Same typed data as the parsed CREATE INDEX AST;
+						// the raw option is normalized to the shape ALTER's
+						// own parser produces (nil when nothing renders) so
+						// the per-partition RawSQL reparse/rewrite loop
+						// stays lossless and byte-idempotent.
+						Name:        indexName,
+						KeyParts:    stmt.KeyParts,
+						KeyType:     sIdx.KeyType,
+						IndexOption: alterNativeIndexOption(stmt.IndexOption),
+					}}},
+				}, ctx)
+			}
+		}
+	}
 	colMap := make(map[string]*ColDef)
 	for _, col := range tableDef.Cols {
 		colMap[col.Name] = col
@@ -6777,6 +6841,70 @@ func buildCreateIndex(stmt *tree.CreateIndex, ctx CompilerContext) (*Plan, error
 	}, nil
 }
 
+// indexOptionDelegable reports whether an index's parsed options can ride
+// the partitioned CREATE INDEX → ALTER ADD INDEX delegation losslessly.
+// KEY_BLOCK_SIZE, comment and visibility serialize through the established
+// IndexOption formatter and reparse through the index_option grammar. Every
+// other field — the parser name, the engine attributes, and the vector and
+// fulltext parameters the CREATE INDEX grammar also accepts — either has no
+// serialized form or would not reparse as this ALTER option list, so indexes
+// carrying them keep the dedicated CREATE INDEX planning path.
+func indexOptionDelegable(option *tree.IndexOption) bool {
+	if option == nil {
+		return true
+	}
+	return option.ParserName == "" &&
+		option.EngineAttribute == "" &&
+		option.SecondaryEngineAttribute == "" &&
+		option.AlgoParamList == 0 &&
+		option.AlgoParamVectorOpType == "" &&
+		option.AlgoParamM == 0 &&
+		option.HnswEfConstructio
```

**File**: `pkg/sql/plan/issue_32211_partitioned_create_index_publication_test.go` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
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
+package plan
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/features"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+)
+
+// Issue #32211 regression ledger.
+//
+// Invariant: a standalone CREATE INDEX / CREATE UNIQUE INDEX on a
+// partitioned table must publish the index of the logical parent table in
+// the same statement that propagates each physical partition child, i.e.
+// it must plan through the very route ALTER TABLE ... ADD INDEX uses.
+// The dedicated CREATE_INDEX executor publishes only physical children
+// (one per partition) and writes mo_indexes rows keyed by each child
+// table id, so SHOW INDEX, SHOW CREATE TABLE and index hints, which all
+// resolve from the resolved logical table id, never observe the index
+// even though the statement reports success.
+//
+// MySQL treats CREATE INDEX ON t ... as ALTER TABLE t ADD INDEX ..., so
+// planning the statement into an ALTER TABLE INPLACE plan keeps parent
+// publication and per-partition propagation on the established
+// parent-and-children transactional route (Scope.AlterTable runs the
+// logical parent first, then rewrites the recorded ALTER AST onto every
+// partition child inside the same transaction).
+//
+// Controls proved here together with the desired-success cases, so the
+// delegation is exactly bounded:
+//   - non-partitioned tables keep the CREATE_INDEX executor and plan,
+//   - duplicate index names keep the exact CREATE INDEX admission error
+//     before any delegation,
+//   - non-regular index families (RTREE/spatial, fulltext, functional)
+//     keep their existing planning paths; only the qualified ordinary
+//     BTREE and lossless-regular UNIQUE forms are routed.
+
+func newPartitionedIssue32211Context(t testing.TB) *MockCompilerContext {
+	t.Helper()
+	ctx := NewMockCompilerContext(true, newPlanTestProcess(t))
+	ctx.SetContext(context.Background())
+	registerIssue32211Table(ctx, newIssue32211TableDef("pp", true))
+	return ctx
+}
+
+func registerIssue32211Table(ctx *MockCompilerContext, def *TableDef) {
+	ctx.tables[def.Name] = def
+	ctx.objects[def.Name] = &ObjectRef{SchemaName: "db", ObjName: def.Name}
+}
+
+// newIssue32211TableDef mirrors what the engine resolves for a CREATE
+// TABLE ... PARTITION BY planning leaf: both the resolved Partition
+// state and the durable FeatureFlag partition bit are filled
+// (build_ddl.go sets features.Partitioned on partitioned creates, and
+// relation resolution fills TableDef.Partition and TableDef.FeatureFlag).
+func newIssue32211TableDef(name string, partitioned bool) *TableDef {
+	intType := plan.Type{Id: int32(types.T_int32)}
+	def := &TableDef{
+		Name: name,
+		Cols: []*ColDef{
+			{
+				ColId:   1,
+				Name:    "c1",
+				NotNull: false,
+				Typ:     intType,
+				Default: &plan.Default{NullAbility: true},
+			},
+			{
+				ColId:   2,
+				Name:    "c2",
+				NotNull: false,
+				Typ:     intType,
+				Default: &plan.Default{NullAbility: true},
+			},
+			{
+				ColId:   3,
+				Name:    "c3",
+				NotNull: false,
+				Typ:     plan.Type{Id: int32(types.T_geometry), Width: 64},
+				Default: &plan.Default{NullAbility: true},
+			},
+		},
+	}
+	def.Pkey = &plan.PrimaryKeyDef{
+		Names:       []string{"c1"},
+		PkeyColName: "__mo_fake_pk",
+		CompPkeyCol: &plan.ColDef{
+			Name: "__mo_fake_pk",
+			Typ: plan.Type{
+				Id:    int32(types.T_varchar),
+				Width: 64,
+			},
+		},
+	}
+	if partitioned {
+		def.Partition = &plan.Partition{
+			PartitionDefs: []*plan.PartitionDef{
+				{Def: &plan.Expr{}},
+				{Def: &plan.Expr{}},
+			},
+		}
+		def.FeatureFlag |= features.Partitioned
+	}
+	return def
+}
+
+func runIssue32211Stmt(t testing.TB, ctx *MockCompilerContext, sql string) (*Plan, error) {
+	t.Helper()
+	stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, sql, 1)
+	if err != nil {
+		return nil, err
+	}
+	defer stmt.Free()
+	return BuildPlan(ctx, stmt, false, nil)
+}
+
+// requireIssue32211AlterIndexPlan asserts that the statement plans into
+// the ALTER TABLE INPLACE ADD INDEX route that publishes the l
```

**File**: `pkg/sql/plan/issue_32211_partitioned_create_index_roundtrip_test.go` (added, +533/-0)
```diff
@@ -0,0 +1,533 @@
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
+package plan
+
+import (
+	"context"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/features"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+)
+
+// Issue #32211 — consumer-valid RawSQL oracle for the partitioned
+// CREATE INDEX → ALTER ADD INDEX delegation.
+//
+// The delegated plan's RawSQL is a real consumer input: Scope.AlterTable
+// reparses it to propagate each physical partition child
+// (compile/alter.go alterPartitionTables), so every qualified form must
+// survive the full serialize → ParseOne → rewrite-child-table →
+// serialize → ParseOne loop with the exact index AST bytes and no
+// semantic loss, including quoted identifiers, explicit btree, prefix,
+// order, comment and visibility options. The dedicated CREATE INDEX
+// families excluded from the delegation (vector/plugin/regular-other
+// algos, explicit-using unique, fulltext) must keep their original
+// planning route or their original admission error — never the ALTER
+// route.
+
+// newIssue32211RoundtripTableDef mirrors the engine-resolved partition
+// state (Partition defs + durable features.Partitioned flag) plus the
+// legal-but-tricky identifier surface the roundtrip must preserve.
+func newIssue32211RoundtripTableDef(name string, partitioned bool) *TableDef {
+	def := &TableDef{
+		Name: name,
+		Cols: []*ColDef{
+			{
+				ColId:   1,
+				Name:    "c1",
+				NotNull: true,
+				Typ:     plan.Type{Id: int32(types.T_int32)},
+				Default: &plan.Default{NullAbility: false},
+			},
+			{
+				ColId:   2,
+				Name:    "nm",
+				NotNull: false,
+				Typ:     plan.Type{Id: int32(types.T_varchar), Width: 64},
+				Default: &plan.Default{NullAbility: true},
+			},
+			{
+				ColId:   3,
+				Name:    "my col",
+				NotNull: false,
+				Typ:     plan.Type{Id: int32(types.T_varchar), Width: 64},
+				Default: &plan.Default{NullAbility: true},
+			},
+			{
+				ColId:   4,
+				Name:    "select",
+				NotNull: false,
+				Typ:     plan.Type{Id: int32(types.T_varchar), Width: 64},
+				Default: &plan.Default{NullAbility: true},
+			},
+		},
+	}
+	def.Pkey = &plan.PrimaryKeyDef{
+		Names:       []string{"c1"},
+		PkeyColName: "c1",
+	}
+	if partitioned {
+		def.Partition = &plan.Partition{
+			PartitionDefs: []*plan.PartitionDef{
+				{Def: &plan.Expr{}},
+				{Def: &plan.Expr{}},
+			},
+		}
+		def.FeatureFlag |= features.Partitioned
+	}
+	return def
+}
+
+func newIssue32211RoundtripContext(t testing.TB) *MockCompilerContext {
+	t.Helper()
+	ctx := NewMockCompilerContext(true, newPlanTestProcess(t))
+	ctx.SetContext(context.Background())
+	registerIssue32211Table(ctx, newIssue32211RoundtripTableDef("pp", true))
+	registerIssue32211Table(ctx, newIssue32211RoundtripTableDef("p q", true))
+	registerIssue32211Table(ctx, newIssue32211RoundtripTableDef("nn", false))
+	return ctx
+}
+
+type issue32211ExpectedKeyPart struct {
+	col       string
+	direction tree.Direction
+	length    int
+}
+
+type issue32211RoundtripCase struct {
+	name      string
+	sql       string
+	unique    bool
+	indexName string
+	keyType   tree.IndexType
+	keyParts  []issue32211ExpectedKeyPart
+	comment   string
+	visible   tree.VisibleType
+}
+
+func parseIssue32211AlterSQL(t testing.TB, sql string, caseSensitive int64, assertMsg string) *tree.AlterTable {
+	t.Helper()
+	stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, sql, caseSensitive)
+	require.NoError(t, err, "%s: delegated RawSQL %q must reparse", assertMsg, sql)
+	alter, ok := stmt.(*tree.AlterTable)
+	require.True(t, ok, "%s: reparsed statement must stay ALTER TABLE, got %T", assertMsg, stmt)
+	return alter
+}
+
+// requireIssue32211IndexAST asserts the exact parser-produced index
+// definition inside an AlterOptionAdd.
+func requireIssue32211IndexAST(
+	t testing.TB,
+	tc issue32211RoundtripCase,
+	def tree.TableDef,
+	assertMsg string,
+) {
+	t.Helper()
+	if tc.unique {
+		ui, ok := def.(*tree.UniqueIndex)
+		require.True(t, ok, "%s: expected a unique index def, got %T", assertMsg, def)
+		require.Equal(t, tc.indexName, ui.Name, "
```

**File**: `pkg/tests/issues/isolated/sql_task_ownership_test.go` (modified, +228/-0)
```diff
@@ -233,6 +233,28 @@ func TestSQLTaskRunBarrierAcrossDropAndRecreate(t *testing.T) {
 		_, _ = gate.ExecContext(cleanupCtx, "select release_lock('task_race_gate')")
 	}()
 	execSQLRequire(t, ctx, db, "create task concurrent_task as begin insert into sink select get_lock('task_race_gate', 30); end")
+	// Fence the exact named+account definition read each racing EXECUTE resolves
+	// through on its CN (frontend getSQLTaskByName -> CN task storage). Only a
+	// missing definition may keep waiting inside the bounded window; any read
+	// error, duplicate row count, wrong name/account, non-positive ID, or
+	// cross-CN identity mismatch fails immediately with its preserved cause,
+	// so the racing pair never starts on an unobserved assumption.
+	racingStorages := make([]taskservice.TaskStorage, 0, 2)
+	for cnIndex := 0; cnIndex < 2; cnIndex++ {
+		cnService, err := cluster.GetCNService(cnIndex)
+		require.NoError(t, err)
+		cnTaskService, ok := cnService.RawService().(testutil.TaskServiceGetter).GetTaskService()
+		require.True(t, ok)
+		racingStorages = append(racingStorages, cnTaskService.GetStorage())
+	}
+	readyTaskID, err := waitForSQLTaskDefinitions(ctx, func(readCtx context.Context, cnIndex int) ([]taskservice.SQLTask, error) {
+		return racingStorages[cnIndex].QuerySQLTask(readCtx,
+			taskservice.WithTaskName(taskservice.EQ, "concurrent_task"),
+			taskservice.WithAccountID(taskservice.EQ, 0))
+	}, "concurrent_task", 0, 20*time.Second)
+	require.NoError(t, err)
+	require.Positive(t, readyTaskID)
+	t.Logf("concurrent_task readiness fence converged before the race: task_id=%d", readyTaskID)
 	startRace := make(chan struct{})
 	raceResults := make(chan error, 2)
 	for _, client := range []*sql.DB{db, peerDB} {
@@ -548,3 +570,209 @@ func TestSQLTaskRunBarrierAcrossDropAndRecreate(t *testing.T) {
 	require.NoError(t, db.QueryRowContext(ctx, "select count(*) from scheduled_sink where v=2").Scan(&rows))
 	require.Equal(t, 1, rows)
 }
+
+// waitForSQLTaskDefinitions synchronously bounds one real named+account
+// readiness condition across the two racing CN storages. Only a missing
+// (zero-row) observation keeps waiting until the scoped child deadline; a
+// read error, duplicate row count, wrong expected name/account, non-positive
+// task ID, or cross-CN identity mismatch is terminal immediately with the
+// original cause preserved and the first/last observations attached. All
+// reads run on the child context so cancellation always reaches them; the
+// ticker, child timer, and the call itself never outlive the caller, and no
+// callback or worker goroutine is ever detached.
+func waitForSQLTaskDefinitions(ctx context.Context,
+	read func(context.Context, int) ([]taskservice.SQLTask, error),
+	expectName string, expectAccount uint32, window time.Duration) (uint64, error) {
+	if window <= 0 || window > 20*time.Second {
+		return 0, fmt.Errorf("readiness window %s outside the allowed bounded range", window)
+	}
+	childCtx, cancel := context.WithTimeout(ctx, window)
+	defer cancel()
+	ticker := time.NewTicker(50 * time.Millisecond)
+	defer ticker.Stop()
+	var first, last string
+	for iteration := 0; ; iteration++ {
+		observed := make([]taskservice.SQLTask, 0, 2)
+		views := make([]string, 0, 2)
+		var terminal error
+		for cnIndex := 0; cnIndex < 2 && terminal == nil; cnIndex++ {
+			definitions, err := read(childCtx, cnIndex)
+			switch {
+			case err != nil:
+				terminal = fmt.Errorf("cn%d definition read failed: %w", cnIndex, err)
+				views = append(views, fmt.Sprintf("cn%d: read error %v", cnIndex, err))
+			case len(definitions) > 1:
+				terminal = fmt.Errorf("cn%d saw %d definitions, want exactly 1", cnIndex, len(definitions))
+				views = append(views, fmt.Sprintf("cn%d: definitions=%d", cnIndex, len(definitions)))
+			case len(definitions) == 1:
+				definition := definitions[0]
+				views = append(views, fmt.Sprintf("cn%d: task_id=%d account=%d name=%s",
+					cnIndex, definition.TaskID, definition.AccountID, definition.TaskName))
+				switch {
+				case definition.TaskName != expectName:
+					terminal = fmt.Errorf("cn%d definition name=%q, want %q", cnIndex, definition.TaskName, expectName)
+				case definition.AccountID != expectAccount:
+					terminal = fmt.Errorf("cn%d definition account=%d, want %d", cnIndex, definition.AccountID, expectAccount)
+				case definition.TaskID == 0:
+					terminal = fmt.Errorf("cn%d definition task_id must be positive", cnIndex)
+				default:
+					observed = append(observed, definition)
+				}
+			default:
+				views = append(views, fmt.Sprintf("cn%d: definitions=0", cnIndex))
+			}
+		}
+		record := fmt.Sprintf("%v", views)
+		if iteration == 0 {
+			first = record
+		}
+		last = record
+		if terminal != nil {
+			return 0, fmt.Errorf("concurrent_task definition readiness ended terminally: %w (first=%s, last=%s)", terminal, first, last)
+		}
+		if len(observed) == 2 {
+			if observed[0].TaskID != observed[1].TaskID {
+				return 0, fmt.Errorf("concurrent_
```

**File**: `test/distributed/cases/index/issue_32211_partition_create_index.sql` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+-- Issue #32211: standalone CREATE INDEX on a partitioned table must
+-- publish the logical parent index (consumers resolving the logical table
+-- id: SHOW INDEX, SHOW CREATE TABLE, index hints) together with the
+-- physical partition-child maintenance, so the statement result is the
+-- same operation MySQL defines it as: ALTER TABLE ... ADD INDEX. The
+-- implicit per-case DB of this harness (issue_32211_partition_create_index)
+-- is mo-tester Executor-owned and torn down by the harness itself; the
+-- content DB below is private to this batch and dropped exactly. The
+-- driver's SQL stage asserts the catalog rows parent/child; this public
+-- case pins the statement flow through real consumers, including the
+-- indexed-key query path after DML maintenance. Expected .result is a
+-- semantic derivation and stays NOT_RUN until the authorized single
+-- foreground run byte-compares it (baseline must visibly FAIL here; the
+-- fixed binary must match the derived expected bytes exactly).
+drop database if exists index32211_bvt;
+create database index32211_bvt;
+use index32211_bvt;
+create table t1 (id int primary key, nm varchar(32), c1 int) partition by range (id) (partition p0 values less than (10), partition p1 values less than (maxvalue));
+insert into t1 values (1,'k01',1),(5,'k05',5),(20,'k20',20),(30,'k30',30);
+create index idx_nm on t1 (nm);
+select id from t1 force index (idx_nm) where nm = 'k20';
+select id from t1 where nm = 'k05';
+update t1 set nm = 'k20b' where nm = 'k20';
+select id from t1 force index (idx_nm) where nm = 'k20b';
+select id from t1 where nm = 'k20';
+delete from t1 where id in (1, 20);
+select id from t1 force index (idx_nm) where nm = 'k30';
+create index idx_cpx on t1 (c1 desc);
+create unique index uidx_nm on t1 (nm);
+create unique index ubt_nm on t1 (nm) using btree;
+drop database index32211_bvt;
```

---

### Incident Patch 2: `4b45e977` (2026-11-15)
**Commit Message**: fix(ci): retain ownership during batched UT cancellation (#32780)

## What type of PR is this?

- [x] BUG
- [x] Test and CI

## Which issue(s) this PR fixes:

Related to https://github.com/matrixorigin/matrixone/issues/28933 and PR
#32717. This PR does not claim to fix the already closed issue.

## What this PR does / why we need it:

When cancellation interrupts batched race-test preparation, an ordinary
preparation error can currently start a complete fallback `go test`
after the parent has already requested termination. A controlled
reproduction using the real parent/helper and a blocked mock `sort` also
observed a successful helper acknowledgement; the outer job still exited
143. This PR does not claim an observed false-green CI job.

Carry the cancellation request through preparation, dispatch and
completion; prevent a cancelled preparation from starting the fallback;
and retain ownership of an admitted fallback until it is drained. On
Linux with Bash 5 or newer, a verified parent-owned process group keeps
the fallback reachable even if the helper dies before publishing its
child PID. Non-Linux, older Bash, or unverified ownership retain the
original foreground fallback. Ordin

**File**: `optools/run_ut.sh` (modified, +277/-12)
```diff
@@ -130,6 +130,7 @@ PREBUILT_RACE_TEST_BINARY=""
 LIGHT_RACE_JOB_PID=""
 LIGHT_RACE_REPORT=""
 CURRENT_UT_PID=""
+CURRENT_UT_BATCHED_OWNER=0
 CURRENT_UT_COMMAND_STAGE=""
 CURRENT_UT_COMMAND_LABEL=""
 CURRENT_UT_STAGE="initializing"
@@ -172,6 +173,49 @@ if [[ -n "${MO_CL_CUDA:-}" ]] ; then
     fi
 fi
 
+# Keep a prior run's live diagnostic links out of this run's bounded upload
+# without deleting them. rename(2) is required: a cross-device copy could be
+# slow and would not preserve the meaning of a link to a still-live writer.
+function archive_previous_live_prebuilt_diagnostics(){
+    local directory name archive archive_root="${BUILD_WKSP}/scratch"
+    for directory in "${UT_DIAGNOSTIC_DIR}"/live-prebuilt-[0-9]*; do
+        name=${directory##*/}
+        [[ "${name}" =~ ^live-prebuilt-[0-9]{14}$ ]] || continue
+        [[ -e "${directory}" || -L "${directory}" ]] || continue
+        if [[ -L "${directory}" || ! -d "${directory}" ]]; then
+            echo "invalid previous live diagnostic directory: ${directory}" >&2
+            return 1
+        fi
+        mkdir -p "${archive_root}" || return 1
+        archive=$(mktemp -d "${archive_root}/archived-live-prebuilt.XXXXXX") || return 1
+        if ! python3 - "${directory}" "${archive}/${name}" "${UT_DIAGNOSTIC_DIR}" <<'PY'
+import os
+import re
+import sys
+destination = os.path.realpath(os.path.dirname(sys.argv[2]))
+diagnostics = os.path.realpath(sys.argv[3])
+if os.path.commonpath((destination, diagnostics)) == diagnostics:
+    raise RuntimeError("archive destination is inside the diagnostic directory")
+for entry in os.scandir(sys.argv[1]):
+    name_ok = entry.name == "origin.txt" or re.fullmatch(r"live\.(?:base|[0-9]+)\.jsonl", entry.name)
+    if not name_ok or not entry.is_file(follow_symlinks=False):
+        raise RuntimeError("unexpected live diagnostic entry: " + entry.name)
+os.rename(sys.argv[1], sys.argv[2])
+PY
+        then
+            rmdir "${archive}" 2>/dev/null || echo "preserving archive directory: ${archive}" >&2
+            echo "failed to archive previous live diagnostics: ${directory}" >&2
+            return 1
+        fi
+        echo "archived previous live diagnostics: ${directory} -> ${archive}/${name}" >&2
+    done
+}
+
+if [[ "${TEST_TYPE}" == UT ]] && ! archive_previous_live_prebuilt_diagnostics; then
+    echo "refusing to mix diagnostics from different UT runs" >&2
+    exit 1
+fi
+
 if [[ -f $SCA_REPORT ]]; then rm $SCA_REPORT; fi
 if [[ -f $UT_REPORT ]]; then rm $UT_REPORT; fi
 if [[ -f $UT_STDERR ]]; then rm $UT_STDERR; fi
@@ -261,9 +305,47 @@ function publish_ut_helper_completion(){
 
 function invoke_ut_helper(){
     local UT_HELPER_COMPLETION="${G_WKSP}/${G_TS}-owner-complete.$1"
+    local owner_name=$1 helper_name=${2:-}
+    local batched_owner=0 BATCHED_RACE_INVOKE_TERM_REQUESTED=0 BATCHED_RACE_OWNER_PID="" BATCHED_RACE_OWNER_VERIFIED=0
+    local owner_group="" owner_candidate=""
     local helper_status=0
     shift
+    if [[ "${owner_name}" == CURRENT_UT_PID && "${helper_name}" == run_race_test_batches ]]; then
+        batched_owner=1
+        # The preparation wrapper temporarily replaces this trap. Keep a
+        # separate latch alive through the return-to-completion handoff.
+        trap 'BATCHED_RACE_INVOKE_TERM_REQUESTED=1' TERM
+        if [[ "${BATCHED_RACE_LAUNCHED_FROM_START:-0}" == 1 && -f "${UT_HELPER_COMPLETION}" ]]; then
+            if [[ -n "${BASHPID:-}" ]]; then
+                owner_candidate=${BASHPID}
+            else
+                owner_candidate=$(exec /bin/sh -c 'printf "%s" "$PPID"') || owner_candidate=""
+            fi
+            if [[ "${owner_candidate}" =~ ^[1-9][0-9]*$ ]]; then
+                owner_group=$(ps -o pgid= -p "${owner_candidate}") || owner_group=""
+                owner_group=${owner_group//[[:space:]]/}
+                if [[ "${owner_group}" == "${owner_candidate}" ]]; then
+                    BATCHED_RACE_OWNER_PID=${owner_candidate}
+                    BATCHED_RACE_OWNER_VERIFIED=1
+                fi
+            fi
+        fi
+    fi
     "$@" || helper_status=$?
+    if (( batched_owner )); then
+        if (( helper_status != 0 && helper_status != 125 )); then
+            logger "ERR" "batched UT owner selected status ${helper_status}" >&2
+        fi
+        # The helper has returned from its descendant ownership boundary. A
+        # TERM from now through completion publication must prevent a success
+        # acknowledgement; a prior TERM remains in the latch below.
+        trap 'exit 125' TERM
+        if (( BATCHED_RACE_INVOKE_TERM_REQUESTED != 0 )) ||
+            [[ -e "${UT_HELPER_COMPLETION}.cancel" ]]; then
+            logger "ERR" "batched UT owner canceled after status ${helper_status}; retaining diagnostics" >&2
+            return 125
+        fi
+    fi
     publish_ut_helper_completion "${helper_status}" || return 125
     return "${helper_status}"
 }
@@ -305,6 +387,12 @@ function join_ut_owner(){
       
```

**File**: `optools/ut_batched_cancel_test.go` (added, +918/-0)
```diff
@@ -0,0 +1,918 @@
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
+package optools
+
+import (
+	"os/exec"
+	"strconv"
+	"strings"
+	"testing"
+	"time"
+)
+
+const batchedOwnerSetup = `source ./run_ut.sh UT
+function logger() { :; }
+function checkpoint_ut_event() { :; }
+UT_TIMEOUT=1
+LD_LIBRARY_PATH=''; CGO_CFLAGS=''; CGO_LDFLAGS=''
+UT_REPORT="$CASE_DIR/authoritative.out"
+UT_STDERR="$CASE_DIR/stderr.log"
+PREBUILT_RACE_REPORT="$CASE_DIR/issues-report"
+PREBUILT_RACE_TEST_BINARY="$CASE_DIR/issues.test"
+: > "$UT_REPORT"; : > "$UT_STDERR"
+: > "$CASE_DIR/fixture_test.go"
+completion="$G_WKSP/$G_TS-owner-complete.CURRENT_UT_PID"
+`
+
+func injectBatchedHook(t *testing.T, text, anchor, replacement string) string {
+	t.Helper()
+	if count := strings.Count(text, anchor); count != 1 {
+		t.Fatalf("batched test hook anchor count = %d, want 1", count)
+	}
+	return strings.Replace(text, anchor, replacement, 1)
+}
+
+// These synthetic children exercise the same parent drain/KILL path with a
+// shorter grace. Existing ownership tests retain the production grace value.
+func shortenBatchedOwnerGrace(t *testing.T, text string) string {
+	t.Helper()
+	const anchor = "        wait_for_ut_process_group \"${!pid_name}\" 20 || join_status=125\n"
+	return injectBatchedHook(t, text, anchor, "        wait_for_ut_process_group \"${!pid_name}\" 4 || join_status=125\n")
+}
+
+// The real owner cancels while the inventory partitioner's sort is running.
+// A failed partition is normally allowed to fall back to the complete go test,
+// but that fallback must not start after the owner requested cancellation.
+func TestBatchedPreparationCancellationDoesNotStartFallback(t *testing.T) {
+	t.Parallel()
+	mock := `#!/bin/bash
+case "${1:-}" in
+ version|env) exit 0 ;;
+ list) printf '%s\texample/package\nfixture_test.go\n' "$CASE_DIR"; exit 0 ;;
+ test)
+  shift; compile=0; out=''
+  while (( $# )); do
+   [[ "$1" == -c ]] && compile=1
+   if [[ "$1" == -o ]]; then out=$2; shift; fi
+   shift
+  done
+  if (( compile )); then
+   printf '#!/bin/bash\nprintf "TestOne\\nTestTwo\\n"\n' > "$out"
+   chmod +x "$out"
+   exit 0
+  fi
+  : > "$CASE_DIR/fallback-ran"
+  printf '%s\n' '{"Action":"pass","Package":"example/package"}'
+  exit 0 ;;
+esac
+exit 81
+`
+	script := `source ./run_ut.sh UT
+function logger() { :; }
+function checkpoint_ut_event() { :; }
+function stop_ut_heartbeat() { :; }
+function snapshot_ut_diagnostics() { :; }
+function report_slow_ut_cases() { :; }
+function report_active_ut_cases() { :; }
+cat > "$CASE_DIR/sort" <<'EOF'
+#!/bin/bash
+: > "$CASE_DIR/sort-ready"
+exec sleep 30
+EOF
+chmod +x "$CASE_DIR/sort"
+export PATH="$CASE_DIR:$PATH"
+UT_TIMEOUT=1
+LD_LIBRARY_PATH=''; CGO_CFLAGS=''; CGO_LDFLAGS=''
+UT_REPORT="$CASE_DIR/authoritative.out"
+UT_STDERR="$CASE_DIR/stderr.log"
+UT_CHECKPOINT="$CASE_DIR/checkpoint.log"
+LOG="$CASE_DIR/runner.log"
+PREBUILT_RACE_REPORT="$CASE_DIR/issues-report"
+PREBUILT_RACE_TEST_BINARY="$CASE_DIR/issues.test"
+mkdir -p "$UT_DIAGNOSTIC_DIR"
+: > "$UT_REPORT"; : > "$UT_STDERR"; : > "$UT_CHECKPOINT"
+: > "$CASE_DIR/fixture_test.go"
+cleanup() {
+ status=$?
+ [[ "$status" == 143 || "$status" == 125 ]] || status=90
+ [[ ! -e "$CASE_DIR/fallback-ran" ]] || status=91
+ exit "$status"
+}
+trap cleanup EXIT
+trap handle_ut_termination TERM
+start_ut_command embedded 'batched mock' run_race_test_batches example/package "$PREBUILT_RACE_TEST_BINARY" 4 4 2 independent || exit 92
+for ((i=0; i<200; i++)); do
+ [[ -e "$CASE_DIR/sort-ready" ]] && break
+ kill -0 "$CURRENT_UT_PID" 2>/dev/null || break
+ sleep .025
+done
+[[ -e "$CASE_DIR/sort-ready" ]] || exit 93
+kill -TERM "$$"
+exit 94
+`
+	out, err := scheduleHarnessWithMock(t, script, mock)
+	exit, ok := err.(*exec.ExitError)
+	if !ok || (exit.ExitCode() != 143 && exit.ExitCode() != 125) {
+		t.Fatalf("canceled preparation must not run the ordinary fallback: %v\n%s", err, out)
+	}
+}
+
+// A persistent request must stop discovery even when TERM did not reach its
+// shell. The inventory child has its own process group and must be drained.
+func TestBatchedMarkerOnlyCancelsInventory(t *testing.T) {
+	t.Parallel()
+	mock := `#!/bin/bash
+case "${1:-}" in
+ version|env) exit 0 ;;
+ list) printf '%s\texample/package\nfixture_test.go\n' "$CASE_DIR"; exit 0 ;;
+ test)
+  if [[ " $* " != *' -c '* ]]; then : > "$CASE_DIR/fallback"; exit 0; fi
+  while (( $# )); do
+   if [[ "$1" == -o ]]; then out=$2; br
```

**File**: `optools/ut_batched_signal_linux_test.go` (added, +445/-0)
```diff
@@ -0,0 +1,445 @@
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
+package optools
+
+import (
+	"fmt"
+	"os"
+	"os/exec"
+	"os/signal"
+	"path/filepath"
+	"runtime/debug"
+	"strconv"
+	"strings"
+	"syscall"
+	"testing"
+	"time"
+)
+
+// Compare an actual Go test process (race-instrumented when enabled) against
+// the original foreground invocation, before and after cmd/go-style Notify.
+func TestBatchedFallbackSignalDisposition(t *testing.T) {
+	if os.Getenv("MO_BATCHED_SIGNAL_PROBE") == "1" {
+		readBits := func() string {
+			data, err := os.ReadFile("/proc/self/status")
+			if err != nil {
+				t.Fatal(err)
+			}
+			bits := make(map[string]uint64)
+			for _, line := range strings.Split(string(data), "\n") {
+				key, value, ok := strings.Cut(line, ":")
+				if !ok || (key != "SigIgn" && key != "SigCgt") {
+					continue
+				}
+				bits[key], err = strconv.ParseUint(strings.TrimSpace(value), 16, 64)
+				if err != nil {
+					t.Fatal(err)
+				}
+			}
+			if len(bits) != 2 {
+				t.Fatal("missing signal disposition")
+			}
+			return fmt.Sprintf("%d/%d", (bits["SigIgn"]>>1)&3, (bits["SigCgt"]>>1)&3)
+		}
+		before := readBits()
+		signals := make(chan os.Signal, 1)
+		signal.Notify(signals, syscall.SIGINT, syscall.SIGQUIT)
+		after := readBits()
+		signal.Stop(signals)
+		if err := os.WriteFile(os.Getenv("MO_BATCHED_SIGNAL_OUTPUT"), []byte(before+" "+after+"\n"), 0600); err != nil {
+			t.Fatal(err)
+		}
+		return
+	}
+
+	t.Parallel()
+	program, err := os.Executable()
+	if err != nil {
+		t.Fatal(err)
+	}
+	mock := `#!/bin/bash
+case "${1:-}" in
+ version) exit 0 ;;
+ env) exit 1 ;;
+ test) exec "$TEST_BINARY" -test.run '^TestBatchedFallbackSignalDisposition$' ;;
+esac
+exit 81
+`
+	for _, mode := range []string{"default", "ignore", "custom"} {
+		t.Run(mode, func(t *testing.T) {
+			transform := func(text string) string {
+				const foreground = "    if (( use_owned_group == 0 )); then\n"
+				text = injectBatchedHook(t, text, foreground, "    MO_BATCHED_SIGNAL_OUTPUT=\"$CASE_DIR/foreground-signals\" \"$TEST_BINARY\" -test.run '^TestBatchedFallbackSignalDisposition$' > /dev/null || return 125\n"+foreground)
+				const anchor = "    ) 0<&0 &\n    pid=$!\n"
+				return injectBatchedHook(t, text, anchor, anchor+"    : > \"$CASE_DIR/async-fallback\"\n")
+			}
+			script := batchedOwnerSetup + `
+trap - INT QUIT
+case "$SIGNAL_MODE" in
+ ignore) trap '' INT QUIT ;;
+ custom) trap ':' INT QUIT ;;
+esac
+export MO_BATCHED_SIGNAL_PROBE=1 GORACE=atexit_sleep_ms=0
+export MO_BATCHED_SIGNAL_OUTPUT="$CASE_DIR/fallback-signals"
+status=0
+run_ut_command embedded batched run_race_test_batches example/package "$PREBUILT_RACE_TEST_BINARY" 4 || status=$?
+[[ "$status" == 0 ]] || exit 91
+if (( BASH_VERSINFO[0] >= 5 )); then [[ -e "$CASE_DIR/async-fallback" ]] || exit 93; fi
+cmp "$CASE_DIR/foreground-signals" "$CASE_DIR/fallback-signals" || exit 92
+`
+			out, err := scheduleHarnessWithMockTransform(t, script, mock, transform, "SIGNAL_MODE="+mode, "TEST_BINARY="+program)
+			if err != nil {
+				t.Fatalf("Go signal disposition (%s): %v\n%s", mode, err, out)
+			}
+		})
+	}
+}
+
+// Exercise the actual go test driver as well as its test process. The probe
+// records INT/QUIT dispositions in both processes without sending a signal.
+func TestBatchedFallbackRealGoDriverSignals(t *testing.T) {
+	t.Parallel()
+	info, ok := debug.ReadBuildInfo()
+	if !ok {
+		t.Fatal("missing test binary build information")
+	}
+	raceFlag := ""
+	for _, setting := range info.Settings {
+		if setting.Key == "-race" && setting.Value == "true" {
+			raceFlag = "-race"
+		}
+	}
+	t.Logf("nested go test race enabled: %t", raceFlag != "")
+	goTool, err := exec.LookPath("go")
+	if err != nil {
+		t.Fatal(err)
+	}
+	root := t.TempDir()
+	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/signalprobe\n\ngo 1.27.0\n"), 0600); err != nil {
+		t.Fatal(err)
+	}
+	const source = `package signalprobe
+import (
+ "fmt"
+ "os"
+ "strconv"
+ "strings"
+ "testing"
+)
+func bits(t *testing.T, pid string) string {
+ data, err := os.ReadFile("/proc/"+pid+"/status"); if err != nil { t.Fatal(err) }
+ found := map[string]uint64{}
+ for _, line := range strings.Split(string(data), "\n") {
+  key, value, ok := strings.Cut(line, ":")
+  if !ok || (key != "SigIgn" && key != "SigCgt") { continue }
+  n, err := strconv.ParseUint(strings.TrimSpace(value), 16, 64); if err != nil { t.Fatal(err) }
```

**File**: `optools/ut_schedule_cleanup_test.go` (modified, +2/-2)
```diff
@@ -636,8 +636,8 @@ func TestHelperFailedDrainKeepsParentOwnership(t *testing.T) {
 						hook = "            ut_test_publication \"$!\" ''\n"
 					}
 					if helper == "inventory" {
-						anchor = "    pid=$!\n    set +m\n"
-						hook = "    pid=$!\n    ut_test_publication \"$pid\" \"\"\n    set +m\n"
+						anchor = "    ) > \"${inventory}\" 2>&1 &\n    pid=$!\n    set +m\n"
+						hook = "    ) > \"${inventory}\" 2>&1 &\n    pid=$!\n    ut_test_publication \"$pid\" \"\"\n    set +m\n"
 					}
 					if strings.Count(text, anchor) != 1 {
 						t.Fatal("missing unique helper publication")
```

---

### Incident Patch 3: `f491aaab` (2026-11-16)
**Commit Message**: [Bug] hash JSON text bytes in CRC32 (#28935)

### Rebase update — 2026-11-16

Rebased and pushed onto upstream `main`
`8e8708a8d306a69512d140b40bfcfebc1d404a32`; current head:
`031557350606c2826c564a1dda70af13186db1fd`. `git diff --check` passes
and GitHub reports the PR mergeable. Exact-head run
[43871964993](https://github.com/matrixorigin/matrixone/actions/runs/43871964993)
completed with 13 success, 14 skipped, 2 neutral and no failures. Shared
Build, Ubuntu/x86 UT, coverage UT, arm64 SCA, PROXY and pessimistic
multi-CN BVT, CI preflight, Iceberg adapter tidy and Summary passed.
Local PASS on darwin/arm64 with Go 1.27.1: `mo-cgo-test` ran 7 focused
CRC32 compatibility tests across `pkg/sql/plan` and
`pkg/sql/plan/function`.

Remaining gates: fresh review on this head; the dedicated 188-statement
`func_crc32.sql` BVT remains NOT_RUN because the shared-host lock has no
verifiable owner; compatible `mo_br` backup/restore and deployed QA
remain open. No unresolved inline review threads remain.
---

## What type of PR is this?

- [x] BUG

## Which issue(s) this PR relates to

Partially addresses #28910; the issue remains open pending QA and the
gaps below.

## What this PR changes



**File**: `docs/design/pr-28935-crc32-json-compatibility.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# CRC32(JSON) compatibility
+
+New SQL binds `CRC32(j)` for JSON `j` as the existing CRC32 byte function over
+an explicit JSON-to-TEXT expression. Explicit conversion preserves the quotes
+and escapes of a JSON string; the TEXT expression does not impose a VARCHAR
+width on the JSON document. SQL NULL remains NULL, while JSON `null` is text.
+Other input domains continue to use their existing CRC32 behavior.
+
+A supported-release catalog expression that already calls CRC32 on binary JSON
+retains its original function and argument. Its materialized values and index
+entries are not rewritten. Thus an old generated column can differ from a new
+query's `CRC32(j)` for the same row; later supported writes must continue to
+use the stored expression. Parameter rebinding must preserve the old argument,
+while a newly bound untyped parameter specializes to its actual input domain.
+
+Internal ALTER COPY and LIKE carry the old bound expressions when replaying
+unchanged definitions. Referenced column types and positions must remain valid;
+a changed expression or incompatible input is not an implicit lossless change.
+An explicitly changed generated expression binds with current semantics and
+COPY rebuilds its values and dependent indexes; it is not presented as
+preserving the old expression.
+Existing folded defaults without source expressions keep their stored values.
+The existing JSON text feature guard keeps new CRC32 JSON default expressions
+visible through ordinary constant folding and catalog serialization.
+
+The legacy DML planner does not calculate generated columns. The current
+candidate retains its rejection for a legacy CRC32 generated expression on
+that fallback path; this is an unresolved availability gap, not evidence that
+all old-table writes are supported.
+
+## Approaches considered
+
+| Approach | Benefit | Evidence or cost still required |
+| --- | --- | --- |
+| Existing CRC32 with a newly bound JSON-to-TEXT expression | No new CRC32 signature; matches the SQL conversion contract | Rebinding, folding and DDL must retain old expression behavior; the candidate remains under validation. |
+| Separate new and old CRC32 execution identities | Directly distinguishes the two algorithms | Adds a durable function identity and its compatibility maintenance; the reviewer requested avoiding this extra signature. |
+| Apply the new algorithm to every expression and rebuild old data | One final semantic value | Must recompute rows, indexes and constraints with recoverable failure handling; this changes the selected old-data contract. |
+
+## Connection migration and protocol
+
+Ordinary prepared-statement migration uses the existing SQL replay,
+authorization, session-state and target-failure lifecycle. It adds no CRC32
+proof messages, connection-migration preflight or CRC32-specific RPC version.
+Existing protocol checks remain: in particular, the existing JSON-to-text CAST
+contract can require version 129, and the CRC32 UINT64 result contract can
+require version 80. The stopped-upgrade contract does not promise mixed-version
+CN operation or downgrade.
+
+## Validation required
+
+Compare fixed JSON text bytes against an independent CRC32 oracle, including
+quotes, escapes, long and multibyte strings, SQL NULL and JSON null. Exercise
+prepared binding and rebind, selection and executor reuse, non-JSON domains,
+legacy and new generated values, indexes, ALTER/LIKE, defaults and checks, and
+ordinary and CRC32 prepared connection migration. Validate actual supported
+release-created rows and indexes through shutdown upgrade, subsequent writes,
+restart and restoration of a backup made by the old release.
+
+The earlier v4.2.5-to-`533cf11915cf` upgrade and same-head CI evidence applies
+only to that published candidate. This edited candidate requires its own
+validation, and its legacy fallback gap remains open.
```

**File**: `pkg/embed/crc32_json_prepared_test.go` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
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
+package embed
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/go-sql-driver/mysql"
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
+	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/pb/query"
+	qclient "github.com/matrixorigin/matrixone/pkg/queryservice/client"
+	"github.com/stretchr/testify/require"
+)
+
+// Reuse the package's single-CN fixture; two rows distinguish runtime JSON
+// evaluation from folding and one schema change exercises prepared reprepare.
+func TestCRC32JSONBinaryPrepared(t *testing.T) {
+	RunSingleCNBaseClusterTests(t, func(c Cluster) {
+		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
+		defer cancel()
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		cfg := mysql.NewConfig()
+		cfg.User = "dump"
+		cfg.Passwd = "111"
+		cfg.Net = "tcp"
+		cfg.Addr = fmt.Sprintf("127.0.0.1:%d", cn.GetServiceConfig().CN.Frontend.Port)
+		db, err := sql.Open("mysql", cfg.FormatDSN())
+		require.NoError(t, err)
+		defer db.Close()
+		db.SetMaxOpenConns(1)
+		conn, err := db.Conn(ctx)
+		require.NoError(t, err)
+		defer conn.Close()
+		exec := func(query string) { t.Helper(); _, err := conn.ExecContext(ctx, query); require.NoError(t, err) }
+		exec("create database crc32_prepared_contract")
+		defer func() {
+			cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
+			defer stop()
+			_, _ = conn.ExecContext(cleanup, "drop database crc32_prepared_contract")
+		}()
+		exec("use crc32_prepared_contract")
+		exec("create table t(id int primary key,j json)")
+		exec(`insert into t values(1,'{"t1":"a"}'),(2,'{"t1":"b"}')`)
+		stmt, err := conn.PrepareContext(ctx, "select crc32(j) from t where id=?")
+		require.NoError(t, err)
+		defer stmt.Close()
+		check := func(id int, want uint64) {
+			t.Helper()
+			var got uint64
+			require.NoError(t, stmt.QueryRowContext(ctx, id).Scan(&got))
+			require.Equal(t, want, got)
+		}
+		check(1, 4012824821)
+		check(2, 3983042220)
+		exec("alter table t add column other int")
+		check(1, 4012824821)
+
+		// Exercise the added function BVT's generated value and index contract
+		// through the same live SQL frontend, including every mutation form.
+		// The embedded cluster becomes query-ready before the durable catalog
+		// barrier finishes. Observe the existing JSON-to-text admission; do not
+		// set a runtime version or floor to manufacture authoring permission.
+		require.Eventually(t, func() bool {
+			rt := moruntime.ServiceRuntime(cn.ServiceID())
+			if rt == nil {
+				return false
+			}
+			value, ok := rt.GetGlobalVariables(moruntime.PersistedExpressionProtocolAuthoringFloor)
+			floor, valid := value.(int64)
+			return ok && valid && floor >= defines.MORPCVersion129
+		}, 90*time.Second, 100*time.Millisecond, "existing result-type authoring admission did not complete")
+		exec(`create table crc32_constant_default(id int primary key,c bigint unsigned default (crc32(cast('{"t1":"a"}' as json))))`)
+		exec("insert into crc32_constant_default(id) values(1)")
+		var constantDefaultCRC uint64
+		require.NoError(t, conn.QueryRowContext(ctx, "select c from crc32_constant_default where id=1").Scan(&constantDefaultCRC))
+		require.Equal(t, uint64(4012824821), constantDefaultCRC)
+		exec("create table generated_crc(id int primary key,j json,c bigint unsigned generated always as (crc32(j)) stored,index idx_crc(c))")
+		exec(`insert into generated_crc(id,j) values(1,'{"t1":"a"}')`)
+		exec("insert into generated_crc(id,j) select 2,j from generated_crc where id=1")
+		exec(`update generated_crc set j='{"t1":"b"}' where id=2`)
+		exec(`replace into generated_crc(id,j) values(1,'{"t1":"c"}')`)
+		exec(`insert into generated_crc(id,j) values(2,'{"t1":"a"}') on duplicate key update j=values(j)`)
+		checkGenerated := func() {
+			t.Helper()
+			for id, want := range map[int]uint64{1: 3970567323, 2: 4012824821} {
+				var stored, fresh uint64
+				require.NoError(t, conn.QueryRowContext(ctx, "select c,crc32(j) from generated_crc where id=?", id).Scan(&stored, &fresh))
+				require.Equal(t, want, stored)
+				require.Equal(t, want, fresh)
+			}
+		}
+		checkGenerated()
+		exec("prepare crc32_read from 'select
```

**File**: `pkg/pb/plan/string_literal_form_test.go` (modified, +29/-0)
```diff
@@ -1023,6 +1023,35 @@ func TestRequiredRemoteExpressionFeaturesDecimalLiteralSemantics(t *testing.T) {
 	require.False(t, features.DecimalLiteralSemantics)
 }
 
+func TestCRC32ExecutionIdentityRoundTrip(t *testing.T) {
+	for _, tc := range []struct {
+		typ      int32
+		textCast bool
+	}{
+		{planJSONTypeID, false}, {planAnyTypeID, false}, {61, false}, {planJSONTypeID, true},
+	} {
+		arg := &Expr{Typ: Type{Id: tc.typ}, Expr: &Expr_Col{Col: &ColRef{ColPos: 0}}}
+		if tc.textCast {
+			arg = &Expr{Typ: Type{Id: planTextTypeID}, Expr: &Expr_F{F: &Function{
+				Func: &ObjectRef{Obj: int64(21)<<32 | 1, ObjName: "cast"}, Args: []*Expr{arg},
+			}}}
+		}
+		expr := &Expr{Typ: Type{Id: 28}, Expr: &Expr_F{F: &Function{Func: &ObjectRef{Obj: int64(crc32FunctionID) << 32, ObjName: "crc32"}, Args: []*Expr{arg}}}}
+		owner := &TableDef{Cols: []*ColDef{{GeneratedCol: &GeneratedCol{Expr: expr, IsStored: true}}}}
+		data, err := owner.Marshal()
+		require.NoError(t, err)
+		decoded := &TableDef{}
+		require.NoError(t, decoded.Unmarshal(data))
+		features, err := RequiredRemoteExpressionFeatures(decoded)
+		require.NoError(t, err)
+		require.Equal(t, tc.textCast, features.JSONOpaqueTextContracts)
+		folded := &Expr{Expr: &Expr_Lit{Lit: &Literal{Src: expr}}}
+		features, err = RequiredRemoteExpressionFeatures(folded)
+		require.NoError(t, err)
+		require.Equal(t, tc.textCast, features.JSONOpaqueTextContracts)
+	}
+}
+
 func TestTemporalConversionProtocolSourceMatrix(t *testing.T) {
 	column := func(id int32) *Expr {
 		return &Expr{Typ: Type{Id: id}, Expr: &Expr_Col{Col: &ColRef{ColPos: 0}}}
```

**File**: `pkg/sql/compile/crc32_protocol_test.go` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
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
+package compile
+
+import (
+	"context"
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/pipeline"
+	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/projection"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/vectorscan"
+	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine"
+)
+
+func crc32JSONTextProtocolExpr(t *testing.T, pos int32) *planpb.Expr {
+	t.Helper()
+	arg := &planpb.Expr{Typ: planpb.Type{Id: int32(types.T_json)}, Expr: &planpb.Expr_Col{Col: &planpb.ColRef{ColPos: pos}}}
+	expr, err := plan2.BindFuncExprImplByPlanExpr(context.Background(), "crc32", []*planpb.Expr{arg})
+	require.NoError(t, err)
+	return expr
+}
+
+func TestCRC32JSONProtocolIncludesMergedMediumIntBounds(t *testing.T) {
+	mediumInt := &planpb.Expr{
+		Typ: planpb.Type{Id: int32(types.T_int32), Width: 24},
+		Expr: &planpb.Expr_F{F: &planpb.Function{
+			Func: &planpb.ObjectRef{Obj: function.EncodeOverloadID(function.CAST_ASSIGN, 0), ObjName: "cast_assign"},
+			Args: []*planpb.Expr{
+				{Typ: planpb.Type{Id: int32(types.T_int32)}, Expr: &planpb.Expr_Col{Col: &planpb.ColRef{ColPos: 0}}},
+				{Typ: planpb.Type{Id: int32(types.T_int32), Width: 24}, Expr: &planpb.Expr_T{T: &planpb.TargetType{}}},
+			},
+		}},
+	}
+	// Preserve actual main's widened-result/width-24 assignment-target contract.
+	mediumInt.Typ.Width = 32
+	crc32JSON := crc32JSONTextProtocolExpr(t, 1)
+	floatCast := floatConversionProtocolExpr(function.CAST, types.T_varchar, types.T_float64)
+	for _, tc := range []struct {
+		name            string
+		exprs           []*planpb.Expr
+		mediumInt       bool
+		crc32JSON       bool
+		floatConversion bool
+		version         int64
+	}{
+		{"mediumint_only", []*planpb.Expr{mediumInt}, true, false, false, defines.MORPCVersion110},
+		{"crc32_only", []*planpb.Expr{crc32JSON}, false, true, false, defines.MORPCVersion129},
+		{"mediumint_then_crc32", []*planpb.Expr{mediumInt, crc32JSON}, true, true, false, defines.MORPCVersion129},
+		{"crc32_then_mediumint", []*planpb.Expr{crc32JSON, mediumInt}, true, true, false, defines.MORPCVersion129},
+		{"float_only", []*planpb.Expr{floatCast}, false, false, true, defines.MORPCVersion132},
+		{"float_then_crc32", []*planpb.Expr{floatCast, crc32JSON}, false, true, true, defines.MORPCVersion132},
+		{"crc32_then_float", []*planpb.Expr{crc32JSON, floatCast}, false, true, true, defines.MORPCVersion132},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			c, client := expressionProtocolTestCompile(t)
+			qry := &planpb.Query{Nodes: []*planpb.Node{{ProjectList: tc.exprs}}, Steps: []int32{0}}
+			features, err := planpb.RequiredRemoteExpressionFeatures(qry)
+			require.NoError(t, err)
+			require.Equal(t, tc.mediumInt, features.MediumIntAssignmentBounds)
+			require.Equal(t, tc.crc32JSON, features.JSONOpaqueTextContracts)
+			require.Equal(t, tc.floatConversion, features.FloatConversionSemantics)
+			require.Equal(t, tc.version, remoteExpressionProtocolVersion(features))
+			owner := &planpb.TableDef{}
+			for _, expr := range tc.exprs {
+				owner.Cols = append(owner.Cols, &planpb.ColDef{GeneratedCol: &planpb.GeneratedCol{Expr: expr}})
+			}
+			persisted, err := plan2.RequiredPersistedExpressionProtocolVersion(owner)
+			require.NoError(t, err)
+			require.Equal(t, tc.version, persisted)
+
+			op := projection.NewArgument()
+			defer op.Release()
+			op.ProjectList = tc.exprs
+			scope := &Scope{Magic: Remote, Proc: c.proc, NodeInfo: engine.Node{Id: "old-worker", Addr: "remote:6001"}, RootOp: op}
+			client.version = tc.version - 1
+			c.execType = plan2.ExecTypeAP_MULTICN
+			c.cnList = engine.Nodes{{Id: "old-worker", Addr: "remote:6001", Mcpu: 4}}
+			require.NoError(t, c.constrainRemoteExpressionWorkers(qry))
+			require.Equal(t, plan2.ExecTypeAP_ONECN, c.execType)
+			_, err = encodeRemoteScope(scope, c.proc)
+			require.ErrorContains(t, err, "remote destination")
+			require.ErrorContains(t, err, fmt.Sprintf("MORPC ver
```

**File**: `pkg/sql/compile/remoterun_test.go` (modified, +39/-0)
```diff
@@ -1653,6 +1653,17 @@ func TestRemoteExpressionProtocolValidation(t *testing.T) {
 		require.NoError(t, validateRemoteExpressionPipelineProtocol(proc, remotePipeline))
 	})
 
+	t.Run("CRC32 JSON text retains existing cast gate", func(t *testing.T) {
+		crc := crc32JSONTextProtocolExpr(t, 0)
+		pipeline := &pipeline.Pipeline{InstructionList: []*pipeline.Instruction{{ProjectList: []*planpb.Expr{crc}}}}
+		rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion128)
+		require.ErrorContains(t, validateRemoteExpressionPipelineProtocol(proc, pipeline), "protocol version 129")
+		for _, version := range []int64{defines.MORPCVersion129, defines.MORPCVersion134} {
+			rt.SetGlobalVariables(moruntime.MOProtocolVersion, version)
+			require.NoError(t, validateRemoteExpressionPipelineProtocol(proc, pipeline))
+		}
+	})
+
 	t.Run("typed BIN/CONV sender and receiver boundary", func(t *testing.T) {
 		cases := []struct {
 			name       string
@@ -1892,6 +1903,34 @@ func TestRemoteExpressionProtocolValidation(t *testing.T) {
 	})
 }
 
+func TestCRC32JSONTextBytesKeepsExistingStreamMinimum(t *testing.T) {
+	c, client := expressionProtocolTestCompile(t)
+	client.version = defines.MORPCVersion134
+	crc := crc32JSONTextProtocolExpr(t, 0)
+	floatCast := floatConversionProtocolExpr(planfunction.CAST, types.T_varchar, types.T_float64)
+	for _, tc := range []struct {
+		name  string
+		exprs []*planpb.Expr
+		want  int64
+	}{
+		{"crc only", []*planpb.Expr{crc}, defines.MORPCVersion129},
+		{"crc then float", []*planpb.Expr{crc, floatCast}, defines.MORPCVersion132},
+		{"float then crc", []*planpb.Expr{floatCast, crc}, defines.MORPCVersion132},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			root := projection.NewArgument()
+			defer root.Release()
+			root.ProjectList = tc.exprs
+			scope := &Scope{Magic: Remote, Proc: c.proc, NodeInfo: engine.Node{Id: "old-worker", Addr: "remote:6001"}, RootOp: root}
+			minimum := defines.MORPCVersion134
+			data, err := encodeRemoteScopeWithProtocol(scope, c.proc, &minimum)
+			require.NoError(t, err)
+			require.NotEmpty(t, data)
+			require.Equal(t, tc.want, minimum)
+		})
+	}
+}
+
 func TestRemoteASCIIResultProtocolValidation(t *testing.T) {
 	proc := testutil.NewProcess(t)
 	proc.Ctx = context.WithValue(proc.Ctx, defines.TenantIDKey{}, uint32(0))
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +14/-0)
```diff
@@ -7928,6 +7928,20 @@ func bindFuncExprImplByPlanExpr(
 			}
 		}
 	}
+	if strings.EqualFold(name, "crc32") && len(args) == 1 && args[0] != nil &&
+		types.T(args[0].Typ.Id) == types.T_json {
+		// New JSON bindings hash the visible JSON document. Keep CRC32's
+		// original execution identity so old persisted calls still hash their
+		// original binary argument. An explicit TEXT cast preserves JSON string
+		// quoting and does not impose VARCHAR's expression-width limit.
+		target := types.T_text.ToType()
+		cast, castErr := appendExplicitCastBeforeExpr(ctx, args[0], makePlan2Type(&target))
+		if castErr != nil {
+			return nil, castErr
+		}
+		args = append([]*Expr(nil), args...)
+		args[0] = cast
+	}
 	if name == "between" && len(args) == 3 &&
 		(preparedBetweenHasMixedNumericText(ctx, args) || types.T(args[0].Typ.Id).IsLowPrecisionFloat()) &&
 		(!containsVolatileFunction(args[0]) || args[0].AuxId < 0) {
```

**File**: `pkg/sql/plan/build_alter_change_column.go` (modified, +56/-2)
```diff
@@ -158,6 +158,11 @@ func buildColumnAndConstraint(
 			defaultScope[i] = col
 		}
 	}
+	for _, col := range targetTableDef.Cols {
+		if err := validateLegacyCRC32GeneratedInputs(ctx.GetContext(), col.GetGeneratedCol().GetExpr(), defaultScope); err != nil {
+			return nil, err
+		}
+	}
 
 	preserved, err := charsetConversionExpressions(ctx, targetTableDef.Name, newColName, colType)
 	if err != nil {
@@ -167,7 +172,18 @@ func buildColumnAndConstraint(
 		if preserved != nil && preserved.defaultExpr != nil {
 			return preserved.defaultExpr, nil
 		}
-		return buildDefaultExprWithColumns(ddlExpressionContext(ctx, ctx.GetProcess().Ctx), specNewColumn, colType, ctx.GetProcess(), defaultScope)
+		unchanged, err := unchangedCRC32ColumnClauses(ctx.GetContext(), oldCol, specNewColumn, colType, ctx.GetProcess())
+		if err != nil {
+			return nil, err
+		}
+		return buildDefaultExprWithColumns(
+			ddlExpressionContext(ctx, ctx.GetProcess().Ctx),
+			specNewColumn,
+			colType,
+			ctx.GetProcess(),
+			defaultScope,
+			unchanged,
+		)
 	}
 
 	// If the column null property is not specified, it defaults to allowing null
@@ -241,11 +257,25 @@ func buildColumnAndConstraint(
 				}
 			}
 		case *tree.AttributeGeneratedAlways:
+			if err := validateGeneratedColumnAttributes(ctx.GetContext(), specNewColumn); err != nil {
+				return nil, err
+			}
 			var generatedCol *plan.GeneratedCol
 			if preserved != nil && preserved.generated != nil {
 				generatedCol = preserved.generated
+			} else if crc32Preserved, handled, preserveErr := preserveLegacyCRC32Generated(ctx.GetContext(), oldCol, attribute, colType); handled {
+				if preserveErr != nil {
+					return nil, preserveErr
+				}
+				generatedCol = crc32Preserved
 			} else {
-				generatedCol, err = buildGeneratedExpr(ddlExpressionContext(ctx, ctx.GetProcess().Ctx), specNewColumn, colType, targetTableDef.Cols, ctx.GetProcess())
+				generatedCol, err = buildGeneratedExpr(
+					ddlExpressionContext(ctx, ctx.GetProcess().Ctx),
+					specNewColumn,
+					colType,
+					targetTableDef.Cols,
+					ctx.GetProcess(),
+				)
 			}
 			if err != nil {
 				return nil, err
@@ -261,6 +291,30 @@ func buildColumnAndConstraint(
 			return nil, moerr.NewNotSupportedf(ctx.GetContext(), "unsupport column definition %v", attribute)
 		}
 	}
+	// Attribute parsing above finalizes AutoIncr. Preserve the early representation
+	// check before binding, but do not let COPY retain an illegal final dependency.
+	for _, col := range targetTableDef.Cols {
+		for _, owner := range []struct {
+			subject string
+			expr    *plan.Expr
+		}{
+			{"generated column", col.GetGeneratedCol().GetExpr()},
+			{"default expression", col.GetDefault().GetExpr()},
+		} {
+			expr := owner.expr
+			if !containsLegacyCRC32(expr) {
+				continue
+			}
+			if err := validateLegacyCRC32ExprInputs(ctx.GetContext(), expr, defaultScope, owner.subject); err != nil {
+				return nil, err
+			}
+			if owner.subject == "generated column" {
+				if err := checkGeneratedExprReferences(ctx.GetContext(), expr, col.GetOriginCaseName(), defaultScope, make(map[int32]bool)); err != nil {
+					return nil, err
+				}
+			}
+		}
+	}
 	if newCol.GeneratedCol != nil {
 		// Reject VIRTUAL generated columns as PRIMARY KEY
 		if newCol.Primary && !newCol.GeneratedCol.IsStored {
```

**File**: `pkg/sql/plan/build_alter_table.go` (modified, +17/-0)
```diff
@@ -526,6 +526,23 @@ func buildAlterTableCopy(stmt *tree.AlterTable, cctx CompilerContext, bindings a
 			"Table '%s' does not have an AUTO_INCREMENT column", tableDef.Name)
 	}
 
+	// CHECK expressions retain the original catalog coordinates throughout the
+	// schema clauses. Validate them only against the final source-to-target
+	// replay, never against a reordered intermediate column slice. The same
+	// replay will preserve their bound identity in the internal CREATE.
+	var checkReplay *persistedDDLReplay
+	for _, check := range copyTableDef.Checks {
+		if !containsLegacyCRC32(check.GetCheck()) {
+			continue
+		}
+		if checkReplay == nil {
+			checkReplay = ddlReplayForTable(WithPersistedDDLReplay(ctx, tableDef, copyTableDef), copyTableDef.Name)
+		}
+		if checkReplay == nil || checkReplay.checks[strings.ToLower(check.Name)] == nil {
+			return nil, moerr.NewNotSupported(ctx, "changing a legacy CRC32 JSON check constraint requires an explicit table rebuild")
+		}
+	}
+
 	// Generated values are recomputed from the original table rows under the
 	// final schema. Rebuild indexes on every generated dependent, not just the
 	// directly modified column; otherwise COPY could clone stale index entries.
```

#### Recent Merged Pull Requests:
- **PR #32823** (2026-11-17): [4.2] Fix grouped ENUM and SET numeric conversions (@XuPeng-SH)
- **PR #32815** (2026-11-16): perf(malloc): advise huge pages for large MPool mappings (@aunjgr)
- **PR #32809** (2026-11-16): Revert "perf(fileservice): keep IVF-Flat entries objects in the index-file cache (#32697)" (@cpegeric)
- **PR #32808** (2026-11-16): [4.2-dev] fix DISTINCT inserts for ENUM and SET (@XuPeng-SH)
- **PR #32807** (2026-11-16): perf(plan): preaggregate outer-join counts on unique keys (@aunjgr)
- **PR #32803** (2026-11-16): [4.2] fix: preserve empty saved results and result_scan projections (@XuPeng-SH)

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

## X. publish partitioned CREATE INDEX metadata through ALTER

**RULE**:
When implementing operations in `pkg/sql/compile/alter.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7fcd9bdf`: publish partitioned CREATE INDEX metadata through ALTER. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/sql/compile/alter.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			st, err := parsers.ParseOne(
			if err != nil {
				// Propagate the original parse error instead of dropping
				// it and asserting the statement type downstream.
				return err
			}
			alterPartitionStmt, ok := st.(*tree.AlterTable)
			if !ok {
				return moerr.NewParseError(c.proc.Ctx,
					fmt.Sprintf("not an ALTER TABLE statement: %s", qry.RawSQL))
			}
				alterPartitionStmt,
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
			st, _ := parsers.ParseOne(
				st.(*tree.AlterTable),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7fcd9bdf` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
