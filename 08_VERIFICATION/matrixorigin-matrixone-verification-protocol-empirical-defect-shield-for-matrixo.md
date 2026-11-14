# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin/matrixone

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "71390fb3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T03:10:39.704Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `71390fb3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T03:10:39.704Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin/matrixone` (Commit: `71390fb3`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T03:10:38.459Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2065 stars

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
- **Issue #32742** (2026-11-14): **fileservice: TestDiskCacheReadOfDownloadStopsOnCancel flakes during TempDir cleanup**
  *Symptoms*: ## Summary  `TestDiskCacheReadOfDownloadStopsOnCancel` failed during Go's automatic `TempDir` cleanup because a cache subdirectory was not empty.  ## Observed failure  - CI job: https://github.com/matrixorigin/matrixone/actions/runs/43526630231/job/132233966531?pr=32741 - Observed on: #32741, head `d456b5b5b41f67ed611f5e9adc6a7fc42787e8d3` - Package: `pkg/fileservice` - Test: [`TestDiskCacheReadOfDownloadStopsOnCancel`](https://github.com/matrixorigin/matrixone/blob/d456b5b5b41f67ed611f5e9adc6a7fc42787e8d3/pkg/fileservice/disk_cache_download_test.go#L124-L131)  ```text === RUN   TestDiskCacheReadOfDownloadStopsOnCancel 2026/11/14 00:24:37 ... INFO fileservice/disk_cache.go:408 disk cache info loaded ... 2026/11/14 00:24:37 ... INFO fileservice/disk_cache.go:422 disk cache evict done ...     testing.go:1617: TempDir RemoveAll cleanup:         unlinkat /tmp/TestDiskCacheReadOfDownloadStopsOnCancel1644607021/001/37a:         directory not empty --- FAIL: TestDiskCacheReadOfDownloadStopsOnCancel (0.00s) ```  The package subsequently failed and the UT step exited through `make: *** [Makefile:582: ut] Error 1`.  ## Hypothesis to verify  The test cancels the read context and returns immediately. An asynchronous download/cache writer may still be creating or renaming files while `testing.T.TempDir` cleanup runs, allowing `RemoveAll` to race with new directory entries.  This is currently a cleanup-lifecycle failure, not evidence of incorrect read results or data corruption. The exact 

- **Issue #32741** (2026-11-14): **fix(stage): return an error for missing catalog context**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [x] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #18534.  ## What this PR does / why we need it:  Main already supports host- and path-form Stage URIs, but resolving either through a Datalink with no process panics in `StageLoadCatalog`. For example, `ParseDatalink("stage:///a/b/c/1.txt?size=c", nil)` reaches the Stage cache before validating the range.  Return an internal error when the process, its base, or its Stage cache is missing. This propagates through Datalink, export, and nested Stage resolution without returning a partial result. Initialized callers retain the existing Stage resolution, access checks, and range validation. The ordinary SQL process initialization path is unchanged; this PR does not claim a normal SQL statement alone produces a nil process.  Clarify the existing Stage URI syntax and the 4.2.8 server compatibility boundary in the SDK guide. The companion 4.2 change is in #32723.  ### Validation  - Before the fix, the focused regression on main `5540b068209c` reproduced the nil pointer panic in `StageLoadCatalog`. - Linux/amd64, Go 1.27.1, CPU: complete `pkg/datalink` and `pkg/stage/stageutil` tests passed with coverage; the regressions cover three missing-context states, both URI forms, five Datalink entry points, export and nested Stage. Existing valid Stage and malformed-range controls pass. - Scoped `go v

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

### Incident Patch 1: `645219d3` (2026-11-14)
**Commit Message**: fix(compile): support saved-result CTAS with current source privileges (#32727)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31536

## What this PR does / why we need it:

CTAS from a valid saved RESULT_SCAN reached the internal executor's
unsupported metadata lookup and panicked. Delegate that lookup to the
calling session compiler context; return a typed internal error when no
delegate exists and propagate the delegate's errors unchanged.

Before CTAS creates its target, re-check the saved source plan using the
current caller's privileges, as direct RESULT_SCAN does. This prevents
the newly enabled CTAS path from bypassing source SELECT privileges
after a role switch or REVOKE. Result metadata remains account-scoped;
access is not tied to the producing connection.

The maintained `save_query_result` case now exercises this public path
in normal comparison mode. A really saved result populates the CTAS
target through a prepared statement with data, count and schema
assertions; after a live REVOKE that removes only the source read
privil

**File**: `pkg/frontend/authenticate.go` (modified, +12/-0)
```diff
@@ -10178,6 +10178,18 @@ func authenticateCreateTableAsSelectSourcePrivilege(
 	if err != nil {
 		return false, stats, err
 	}
+	// A CTAS source over a saved query result carries no table-scan tips, and
+	// the CTAS follow-up INSERT ... SELECT runs through the internal executor,
+	// whose compile path does not re-verify result-query access. Apply the same
+	// saved-result source re-verification the direct SELECT path uses, so a
+	// role whose source SELECT privilege is missing or revoked cannot copy the
+	// saved result by CTAS. Plain sources have no result scans and return here
+	// with no extra cost.
+	resultStats, resultErr := checkResultQueryPrivilege(compilerContext.GetProcess(), sourcePlan, ctx, ses.GetService(), ses)
+	stats.Add(&resultStats)
+	if resultErr != nil {
+		return false, stats, resultErr
+	}
 	if len(arr) == 0 {
 		return true, stats, nil
 	}
```

**File**: `pkg/sql/compile/query_result_meta_delegate_test.go` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+// Copyright 2021 - 2026 Matrix Origin
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
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	pbplan "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	sqlplan "github.com/matrixorigin/matrixone/pkg/sql/plan"
+)
+
+// queryResultMetaStub records saved-result metadata lookups so tests can
+// assert the internal executor forwards them to the owning session compiler
+// context instead of resolving them against the wrong identity.
+type queryResultMetaStub struct {
+	sqlplan.CompilerContext
+
+	requested []string
+	cols      []*pbplan.ColDef
+	path      string
+	err       error
+}
+
+func (s *queryResultMetaStub) GetQueryResultMeta(uuid string) ([]*pbplan.ColDef, string, error) {
+	s.requested = append(s.requested, uuid)
+	return s.cols, s.path, s.err
+}
+
+// An internal-executor query that reaches a saved-result source without a
+// frontend session delegate must fail with a clean typed error, never panic.
+func TestGetQueryResultMetaWithoutSessionDelegateFailsCleanly(t *testing.T) {
+	c := &compilerContext{ctx: context.Background()}
+
+	cols, path, err := c.GetQueryResultMeta("7f0e9d51-8bd9-4e0f-8d1e-3cddc1234567")
+	require.Error(t, err)
+	require.True(t, moerr.IsMoErrCode(err, moerr.ErrInternal),
+		"want typed internal error, got %v", err)
+	require.Nil(t, cols)
+	require.Empty(t, path)
+
+	// The message must identify the missing session plumbing so operators can
+	// tell an authorization/session-state gap from a missing result file.
+	require.Contains(t, err.Error(), "session compiler context")
+}
+
+// With the owning frontend session compiler context installed (as CTAS
+// populate does), a saved-result metadata lookup must be forwarded to that
+// delegate verbatim, with its columns and result path passed through.
+func TestGetQueryResultMetaDelegatesToSessionCompilerContext(t *testing.T) {
+	delegate := &queryResultMetaStub{
+		cols: []*pbplan.ColDef{{Name: "id"}},
+		path: "result-path",
+	}
+	ctx := attachInternalExecutorCompilerContext(context.Background(), delegate)
+	c := &compilerContext{ctx: ctx}
+
+	cols, path, err := c.GetQueryResultMeta("qid-1")
+	require.NoError(t, err)
+	require.Equal(t, []string{"qid-1"}, delegate.requested)
+	require.Len(t, cols, 1)
+	require.Equal(t, "id", cols[0].Name)
+	require.Equal(t, "result-path", path)
+}
+
+// View-description child contexts must forward saved-result metadata lookups
+// to their isolated delegate as well.
+func TestGetQueryResultMetaViewChildForwardsToViewDelegate(t *testing.T) {
+	delegate := &queryResultMetaStub{
+		cols: []*pbplan.ColDef{{Name: "v"}},
+		path: "view-path",
+	}
+	c := &compilerContext{ctx: context.Background(), viewChild: true, viewDelegate: delegate}
+
+	cols, path, err := c.GetQueryResultMeta("qid-2")
+	require.NoError(t, err)
+	require.Equal(t, []string{"qid-2"}, delegate.requested)
+	require.Len(t, cols, 1)
+	require.Equal(t, "view-path", path)
+}
+
+// A delegate error must be propagated verbatim - never wrapped or swallowed -
+// so the frontend session's typed result-file errors reach the caller intact.
+func TestGetQueryResultMetaDelegatesErrorVerbatim(t *testing.T) {
+	sentinel := moerr.NewResultFileNotFound(context.Background(), "deadbeef-qid")
+	delegate := &queryResultMetaStub{err: sentinel}
+	ctx := attachInternalExecutorCompilerContext(context.Background(), delegate)
+	c := &compilerContext{ctx: ctx}
+
+	cols, path, err := c.GetQueryResultMeta("deadbeef-qid")
+	require.ErrorIs(t, err, sentinel)
+	require.True(t, moerr.IsMoErrCode(err, moerr.ErrResultFileNotFound))
+	require.Nil(t, cols)
+	require.Empty(t, path)
+}
```

**File**: `pkg/sql/compile/sql_executor_context.go` (modified, +19/-1)
```diff
@@ -472,8 +472,26 @@ func (c *compilerContext) GetProcess() *process.Process {
 	return c.proc
 }
 
+// GetQueryResultMeta resolves saved-result metadata for result_scan plans.
+// The stored metadata is account-scoped (frontend.BuildQueryResultMetaPath),
+// and access is authorized separately by re-checking the saved source AST/plan
+// against the CURRENT calling role (frontend checkResultQueryPrivilege); the
+// delegate below carries the calling session's compiler identity and imposes
+// no producer-session ownership on the saved result. The internal executor has
+// no account/session identity of its own, so it consults the calling frontend
+// session's compiler context, which CTAS populate installs via
+// attachInternalExecutorCompilerContext. Without such a delegate nothing can
+// be resolved here: return a clean typed error instead of panicking.
 func (c *compilerContext) GetQueryResultMeta(uuid string) ([]*plan.ColDef, string, error) {
-	panic("not supported in internal sql executor")
+	if delegate := c.sessionCompilerContextValue(); delegate != nil {
+		return delegate.GetQueryResultMeta(uuid)
+	}
+	errCtx := c.ctx
+	if errCtx == nil {
+		errCtx = context.Background()
+	}
+	return nil, "", moerr.NewInternalError(errCtx,
+		"query result metadata requires a session compiler context in internal sql executor")
 }
 
 func (c *compilerContext) DatabaseExists(name string, snapshot *plan.Snapshot) bool {
```

**File**: `pkg/sql/compile/sql_executor_context_test.go` (modified, +9/-4)
```diff
@@ -192,10 +192,15 @@ func TestCompilerContextUnsupportedOperations(t *testing.T) {
 		_, _ = c.ResolveAccountIds(nil)
 	}()
 
-	func() {
-		defer r()
-		_, _, _ = c.GetQueryResultMeta("")
-	}()
+	// GetQueryResultMeta is a delegated operation since CTAS-from-result_scan
+	// support: without a delegate - including the nil-context case above - it
+	// must return a clean typed internal error and no metadata, never panic.
+	cols, path, qerr := c.GetQueryResultMeta("")
+	require.Error(t, qerr)
+	require.True(t, moerr.IsMoErrCode(qerr, moerr.ErrInternal),
+		"want typed internal error, got %v", qerr)
+	require.Nil(t, cols)
+	require.Empty(t, path)
 }
 
 type recordingSessionCompilerContext struct {
```

**File**: `test/distributed/cases/save_query_result/save_query_result.result` (modified, +63/-0)
```diff
@@ -2465,3 +2465,66 @@ acc_save    admin    2024-11-21 07:19:49    open    null    5    65    0.0    0.
 set save_query_result = off;
 drop account acc_save;
 set save_query_result = off;
+set @saved_enable_privilege_cache = @@global.enable_privilege_cache;
+set global enable_privilege_cache = off;
+drop database if exists db_save_ctas;
+create database db_save_ctas;
+use db_save_ctas;
+create table ctas_priv_src(a int, b varchar(20));
+insert into ctas_priv_src values (1, 'alpha'), (2, 'beta'), (3, 'gamma');
+drop role if exists r_ctas_src;
+create role r_ctas_src;
+drop user if exists u_ctas;
+create user u_ctas identified by '111' default role r_ctas_src;
+grant connect on account * to r_ctas_src;
+grant show databases on account * to r_ctas_src;
+grant show tables on database db_save_ctas to r_ctas_src;
+grant create table on database db_save_ctas to r_ctas_src;
+grant select on table db_save_ctas.ctas_priv_src to r_ctas_src;
+use db_save_ctas;
+set save_query_result = on;
+/* save_result */select a, b from ctas_priv_src order by a desc;
+a	b
+3	gamma
+2	beta
+1	alpha
+set @saved_qid = last_query_id();
+set @ctas_sql = concat('create table ctas_priv_ok as select a, b from result_scan(''', @saved_qid, ''') as t');
+prepare ctas_priv_p from @ctas_sql;
+execute ctas_priv_p;
+deallocate prepare ctas_priv_p;
+/* save_result */select a, b from ctas_priv_src order by a desc;
+a	b
+3	gamma
+2	beta
+1	alpha
+revoke select on table db_save_ctas.ctas_priv_src from r_ctas_src;
+create table ctas_priv_denied as select a, b from result_scan(last_query_id()) t;
+internal error: do not have privilege to execute the statement
+create table ctas_priv_probe(a int);
+select a from ctas_priv_src;
+internal error: do not have privilege to execute the statement
+select count(*) from ctas_priv_ok;
+count(*)
+3
+select a, b from ctas_priv_ok order by a;
+a	b
+1	alpha
+2	beta
+3	gamma
+show create table ctas_priv_ok;
+Table	Create Table
+ctas_priv_ok	CREATE TABLE `ctas_priv_ok` (\n  `a` int DEFAULT NULL,\n  `b` varchar(20) DEFAULT NULL\n)
+show tables;
+Tables_in_db_save_ctas
+ctas_priv_ok
+ctas_priv_probe
+ctas_priv_src
+set save_query_result = off;
+drop user if exists u_ctas;
+drop role if exists r_ctas_src;
+drop database if exists db_save_ctas;
+set global enable_privilege_cache = @saved_enable_privilege_cache;
+select @@global.enable_privilege_cache = @saved_enable_privilege_cache as cache_snapshot_restored;
+cache_snapshot_restored
+1
```

**File**: `test/distributed/cases/save_query_result/save_query_result.sql` (modified, +63/-0)
```diff
@@ -180,3 +180,66 @@ set save_query_result = off;
 drop account acc_save;
 -- reset to default(off)
 set save_query_result = off;
+
+-- PR32727 maintained regression: saved-result CTAS with current source
+-- privileges. The allowed population path is asserted first; a live revoke
+-- then removes only the source read privilege while the target CREATE
+-- privilege stays granted, and reusing the same saved queryID must be
+-- denied before any denied target is created.
+set @saved_enable_privilege_cache = @@global.enable_privilege_cache;
+set global enable_privilege_cache = off;
+drop database if exists db_save_ctas;
+create database db_save_ctas;
+use db_save_ctas;
+create table ctas_priv_src(a int, b varchar(20));
+insert into ctas_priv_src values (1, 'alpha'), (2, 'beta'), (3, 'gamma');
+drop role if exists r_ctas_src;
+create role r_ctas_src;
+drop user if exists u_ctas;
+create user u_ctas identified by '111' default role r_ctas_src;
+grant connect on account * to r_ctas_src;
+grant show databases on account * to r_ctas_src;
+grant show tables on database db_save_ctas to r_ctas_src;
+grant create table on database db_save_ctas to r_ctas_src;
+grant select on table db_save_ctas.ctas_priv_src to r_ctas_src;
+-- @session:id=201&user=sys:u_ctas:r_ctas_src&password=111
+use db_save_ctas;
+set save_query_result = on;
+/* save_result */select a, b from ctas_priv_src order by a desc;
+-- allowed CTAS populated from the really saved result while the source is
+-- readable; the queryID is embedded into the prepared statement text with
+-- concat because the populate phase runs in the internal executor where
+-- last_query_id() is not visible and would resolve to the zero query id.
+set @saved_qid = last_query_id();
+set @ctas_sql = concat('create table ctas_priv_ok as select a, b from result_scan(''', @saved_qid, ''') as t');
+prepare ctas_priv_p from @ctas_sql;
+execute ctas_priv_p;
+deallocate prepare ctas_priv_p;
+-- re-save the same producer so it stays the ring top for the deny phase
+/* save_result */select a, b from ctas_priv_src order by a desc;
+-- @session
+-- live revoke of the source read privilege only; the target CREATE stays granted
+revoke select on table db_save_ctas.ctas_priv_src from r_ctas_src;
+-- @session:id=201&user=sys:u_ctas:r_ctas_src&password=111
+-- reusing the saved queryID must be denied by the current source privilege
+-- @ignore:0
+create table ctas_priv_denied as select a, b from result_scan(last_query_id()) t;
+-- witness after the revoke: the same live role keeps target CREATE
+create table ctas_priv_probe(a int);
+-- the direct source read is denied in this live session
+-- @ignore:0
+select a from ctas_priv_src;
+select count(*) from ctas_priv_ok;
+select a, b from ctas_priv_ok order by a;
+show create table ctas_priv_ok;
+-- no leftover denied target exists
+show tables;
+set save_query_result = off;
+-- @session
+drop user if exists u_ctas;
+drop role if exists r_ctas_src;
+drop database if exists db_save_ctas;
+-- restore the genuine original global value captured at case start
+set global enable_privilege_cache = @saved_enable_privilege_cache;
+-- equality with the case-start snapshot is the restoration oracle, valid for any initial value
+select @@global.enable_privilege_cache = @saved_enable_privilege_cache as cache_snapshot_restored;
```

---

### Incident Patch 2: `2a42b3e9` (2026-11-13)
**Commit Message**: fix(external): validate and normalize Parquet temporal LOAD values (#32722)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31519
Fixes #31520

## What this PR does / why we need it:

Numeric Parquet columns loaded into DATE/TIMESTAMP/DATETIME targets via `LOAD` are now validated and normalized per logical consumed row values before assignment, instead of being trusted raw:

- Each consumed non-null dictionary-page value is checked against the target SQL calendar, so out-of-range carriers such as year 10000, DATE32 day 0 (owned by the existing INSERT-layer lower bound) and session-local display overflows are rejected with the engine's own temporal errors instead of silently persisting (issue 31519). The check honors the session time zone for local-wall calendars and keeps the existing foreign-table read mapping untouched - only the LOAD-only numeric temporal mappers changed.
- Fractional-second carriers are staged at the source units/scale (micros) and then routed through the existing assign-cast semantics, so target-scale rounding, `TIME_T

**File**: `pkg/sql/colexec/external/parquet.go` (modified, +56/-0)
```diff
@@ -1762,9 +1762,17 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 				break
 			}
 			if lt.Timestamp != nil {
+				assignment := h.timeAssignment
 				mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
 					loc := parquetSessionLocation(proc)
 					return processParquetValuesToFixed(proc.Ctx, mp, page, proc, vec, types.Date(0), func(v parquet.Value) (types.Date, error) {
+						if assignment {
+							dt, err := parquetLoadTimestampValueToDatetime(proc.Ctx, st, v, loc)
+							if err != nil {
+								return 0, err
+							}
+							return dt.ToDate(), nil
+						}
 						dt, err := parquetTimestampValueToDatetime(proc.Ctx, st, v, loc)
 						if err != nil {
 							return 0, err
@@ -1779,7 +1787,13 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 			if dateT == nil {
 				break
 			}
+			assignment := h.timeAssignment
 			mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
+				if assignment {
+					return processParquetValuesToFixed(proc.Ctx, mp, page, proc, vec, types.Date(0), func(v parquet.Value) (types.Date, error) {
+						return parquetLoadDate32(proc.Ctx, v.Int32())
+					})
+				}
 				data := page.Data()
 				dict := page.Dictionary()
 				if dict == nil {
@@ -1830,9 +1844,17 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 				break
 			}
 			if lt.Date != nil {
+				assignment := h.timeAssignment
 				mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
 					loc := parquetSessionLocation(proc)
 					return processParquetValuesToFixed(proc.Ctx, mp, page, proc, vec, types.Timestamp(0), func(v parquet.Value) (types.Timestamp, error) {
+						if assignment {
+							date, err := parquetLoadDate32(proc.Ctx, v.Int32())
+							if err != nil {
+								return 0, err
+							}
+							return date.ToTimestamp(loc), nil
+						}
 						return types.DaysFromUnixEpochToDate(v.Int32()).ToTimestamp(loc), nil
 					})
 				}
@@ -1845,7 +1867,23 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 			}
 			// isAdjustedToUTC: true=UTC (use directly), false=local wall-clock time.
 			isAdjustedToUTC := tsT.IsAdjustedToUTC
+			assignment := h.timeAssignment
 			mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
+				if assignment {
+					// LOAD stages the true source precision (scale 6) and lets
+					// the standard assignment cast own target-scale rounding,
+					// SQL mode, and the final row-domain check.
+					loc := parquetSessionLocation(proc)
+					return processParquetTemporalAssignment[types.Timestamp](mp, page, proc, vec,
+						parquetTimestampStagingType,
+						func(v parquet.Value) (types.Timestamp, error) {
+							micros, err := parquetTimestampValueToMicros(proc.Ctx, v, lt)
+							if err != nil {
+								return 0, err
+							}
+							return parquetLoadTimestampMicrosToTimestamp(proc.Ctx, micros, isAdjustedToUTC, loc)
+						})
+				}
 				data := page.Data()
 				dict := page.Dictionary()
 
@@ -1967,7 +2005,17 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 			break
 		}
 		if lt.Date != nil {
+			assignment := h.timeAssignment
 			mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
+				if assignment {
+					return processParquetValuesToFixed(proc.Ctx, mp, page, proc, vec, types.Datetime(0), func(v parquet.Value) (types.Datetime, error) {
+						date, err := parquetLoadDate32(proc.Ctx, v.Int32())
+						if err != nil {
+							return 0, err
+						}
+						return date.ToDatetime(), nil
+					})
+				}
 				data := page.Data()
 				dict := page.Dictionary()
 				if dict == nil {
@@ -2010,8 +2058,16 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 		if lt.Timestamp == nil {
 			break
 		}
+		assignment := h.timeAssignment
 		mp.mapper = func(mp *columnMapper, page parquet.Page, proc *process.Process, vec *vector.Vector) error {
 			loc := parquetSessionLocation(proc)
+			if assignment {
+				return processParquetTemporalAssignment[types.Datetime](mp, page, proc, vec,
+					parquetDatetimeStagingType,
+					func(v parquet.Value) (types.Datetime, error) {
+						return parquetLoadTimestampValueToDatetime(proc.Ctx, st, v, loc)
+					})
+			}
 			return processParquetValuesToFixed(proc.Ctx, mp, page, proc, vec, types.Datetime(0), func(v parquet.Value) (types.Datetime, error) {
 				return parquetTimestampValueToDatetime(proc.Ctx, st, v, loc)
 			})
```

**File**: `pkg/sql/colexec/external/parquet_temporal_assignment.go` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
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
+package external
+
+import (
+	"context"
+	"math"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/parquet-go/parquet-go"
+)
+
+// Numeric Parquet DATE/TIMESTAMP sources that feed a temporal target under
+// LOAD receive the same SQL assignment contract as INSERT:
+//
+//   - values above the supported SQL calendar (year > 9999 in the target
+//     calendar) are rejected row by row, before any value reaches the target
+//     vector;
+//   - the carrier keeps the true source precision (scale 6) and the single
+//     target-scale normalization is the standard assignment cast, which owns
+//     half-step rounding, carry, TIME_TRUNCATE_FRACTIONAL, and
+//     statement-ignore semantics;
+//   - after that normalization the rows are re-checked, because rounding can
+//     carry 9999-12-31 23:59:59.999999 into 10000-01-01 00:00:00;
+//   - the lower bound and zero-date policies stay owned by the insert layer.
+//
+// Foreign-table reads never route through this path: their raw mapping policy
+// is unchanged.
+//
+// All checks are per consumed logical row. Dictionary pages are expanded per
+// referenced entry only, so an out-of-range entry that no consumed row
+// references does not fail the load, and NULL-only pages pass unchanged.
+
+var (
+	// parquetUnixEpochMicros is the numeric of 1970-01-01 in the year-0 based
+	// microsecond space shared by types.Timestamp and types.Datetime.
+	parquetUnixEpochMicros = int64(types.UnixMicroToTimestamp(0))
+	// parquetUnixEpochDays is the Date numeric of 1970-01-01.
+	parquetUnixEpochDays = int32(types.DaysFromUnixEpochToDate(0))
+	// The storable SQL calendar in days since the Unix epoch: 0001-01-01
+	// through 9999-12-31. A raw day count inside this interval can never wrap
+	// in the epoch add nor in any derived DATETIME/TIMESTAMP conversion.
+	parquetMinLoadDateDays = time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC).Unix() / int64(86400)
+	parquetMaxLoadDateDays = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC).Unix() / int64(86400)
+	// parquetMaxLoadDatetime is 9999-12-31 23:59:59.999999 in the shared
+	// year-0 based numeric space: the SQL-calendar upper bound.
+	parquetMaxLoadDatetime = types.FromClockUTC(9999, 12, 31, 23, 59, 59, 999999).ToDatetime(time.UTC)
+	// Staging carriers carry the true parquet source precision.
+	parquetTimestampStagingType = types.T_timestamp.ToTypeWithScale(6)
+	parquetDatetimeStagingType  = types.T_datetime.ToTypeWithScale(6)
+)
+
+// parquetLoadTemporalOffsetBudgetMicros bounds the timezone offset applied by
+// ToDatetime when a timestamp is displayed in the session timezone. Real
+// offsets stay within +-15h; the two-day headroom additionally keeps the
+// epoch-space guard below from covering every wrap exactly at its boundary.
+const parquetLoadTemporalOffsetBudgetMicros = int64(2 * 86400 * 1000000)
+
+// parquetGuardTimestampMicros rejects raw epoch microseconds that would
+// overflow the shared year-0 based numeric space when the epoch or a zone
+// offset is added. A wrapped value could otherwise look like a small valid
+// timestamp and slip past calendar validation.
+func parquetGuardTimestampMicros(ctx context.Context, micros int64) error {
+	if micros > math.MaxInt64-parquetUnixEpochMicros-parquetLoadTemporalOffsetBudgetMicros ||
+		micros < math.MinInt64+parquetUnixEpochMicros+parquetLoadTemporalOffsetBudgetMicros {
+		return moerr.NewInvalidInputf(ctx,
+			"parquet timestamp %d microseconds is out of range", micros)
+	}
+	return nil
+}
+
+// parquetLoadDate32 maps days since the Unix epoch into a Date value under
+// the storable SQL calendar. The raw-domain guard runs before the epoch add
+// and before any derived DATETIME/TIMESTAMP conversion, so extreme int32 day
+// counts cannot wrap into a small valid-looking value downstream. Zero-date
+// and TIMESTAMP lower-bound policies stay owned by the insert layer.
+func parquetLoadDate32(ctx context.Context, days int32) (types.Date, error) {
+	if int64(days) < parquetMinLoadDateDays || int64(days) > parquetMaxLoadDateDays {
+		return 0, moerr.NewInvalidInputf(ctx,
+			"parquet date is out of range for 
```

**File**: `pkg/sql/colexec/external/parquet_temporal_assignment_test.go` (added, +577/-0)
```diff
@@ -0,0 +1,577 @@
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
+package external
+
+import (
+	"bytes"
+	"fmt"
+	"math"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/parquet-go/parquet-go"
+	"github.com/stretchr/testify/require"
+)
+
+// loadTemporalProc builds a process wired to the session timezone and SQL mode
+// used by the temporal assignment tests.
+func loadTemporalProc(t *testing.T, tz *time.Location, sqlMode string) *process.Process {
+	t.Helper()
+	proc := testutil.NewProcess(t)
+	proc.Base.SessionInfo.TimeZone = tz
+	proc.SetResolveVariableFunc(func(string, bool, bool) (interface{}, error) {
+		return sqlMode, nil
+	})
+	return proc
+}
+
+// localTimestampMicrosModel writes an int64 TIMESTAMP(MICROS) leaf with
+// isAdjustedToUTC=false through the documented schema tag, so the local
+// wall-clock branch of the timestamp mappers can be exercised end to end.
+type localTimestampMicrosModel struct {
+	Value int64 `parquet:"local_ts,timestamp(microsecond:local)"`
+}
+
+func writeLocalTimestampPage(t *testing.T, micros []int64) (*parquet.File, parquet.Page) {
+	t.Helper()
+	var buf bytes.Buffer
+	schema := parquet.SchemaOf(localTimestampMicrosModel{})
+	w := parquet.NewWriter(&buf, schema)
+	rows := make([]parquet.Row, 0, len(micros))
+	for _, m := range micros {
+		rows = append(rows, parquet.Row{parquet.Int64Value(m).Level(0, 0, 0)})
+	}
+	_, err := w.WriteRows(rows)
+	require.NoError(t, err)
+	require.NoError(t, w.Close())
+	f, err := parquet.OpenFile(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
+	require.NoError(t, err)
+	col := f.Root().Column("local_ts")
+	require.NotNil(t, col)
+	lt := col.Type().LogicalType()
+	require.NotNil(t, lt)
+	require.NotNil(t, lt.Timestamp)
+	require.False(t, lt.Timestamp.IsAdjustedToUTC, "fixture must be a local wall-clock timestamp")
+	pages := col.Pages()
+	defer func() { require.NoError(t, pages.Close()) }()
+	page, err := pages.ReadPage()
+	require.NoError(t, err)
+	require.NotNil(t, page)
+	return f, page
+}
+
+// TestParquetLoadTemporalBounds pins the SQL calendar upper bound for numeric
+// Parquet DATE/TIMESTAMP sources under LOAD, mirroring the rejection the SQL
+// parser applies to year 10000 spellings. Lower-bound and zero-date policies
+// belong to the insert layer and are intentionally not re-enforced here.
+func TestParquetLoadTemporalBounds(t *testing.T) {
+	const (
+		// 9999-12-31 23:59:59.999999 UTC
+		microsMaxSqlCalendar = 253402300799999999
+		// 10000-01-01 00:00:00 UTC
+		microsYear10000 = 253402300800000000
+		// 9999-12-31 15:00:00 UTC: at +14:00 this is local 10000-01-01 05:00.
+		microsUtcTailPlus14 = 253402268000000000
+		// 10000-01-01 05:00:00 UTC: at -12:00 this is local 9999-12-31 17:00.
+		microsUtcHeadMinus12 = 253402322800000000
+	)
+	daysYear10000 := int32(time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC).Unix() / int64(86400))
+	daysMaxSqlCalendar := int32(time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC).Unix() / int64(86400))
+	days2024 := int32(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC).Unix() / int64(86400))
+
+	utc := time.UTC
+	plus14 := time.FixedZone("+14:00", 14*3600)
+	minus12 := time.FixedZone("-12:00", -12*3600)
+
+	rowOfInt64 := func(values ...int64) []parquet.Row {
+		rows := make([]parquet.Row, 0, len(values))
+		for _, v := range values {
+			rows = append(rows, parquet.Row{parquet.Int64Value(v).Level(0, 0, 0)})
+		}
+		return rows
+	}
+	rowOfInt32 := func(values ...int32) []parquet.Row {
+		rows := make([]parquet.Row, 0, len(values))
+		for _, v := range values {
+			rows = append(rows, parquet.Row{parquet.Int32Value(v).Level(0, 0, 0)})
+		}
+		return rows
+	}
+
+	t.Run("adjusted micros max passes at utc", func(t *testing.T) {
+		proc := loadTemporalProc(t, utc, "")
+		f, page := writeColumnAndGetPage(t, parquet.Timestamp(parquet.Microsecond), rowOfInt64(microsMaxSqlCalendar))
+		var h ParquetHandler
+		h.timeAssignment = true
+		mp := h.getMapper(f.Root().Column("c"), plan.Type{Id: int32(types.T_timestamp), Scale: 6, NotNullable: true})
+		require.NotNil(t, mp)
+		vec := vector.NewVec(types.New(types.T_timestamp, 0, 6))
+		defer vec.Free(proc.Mp())
+		re
```

**File**: `test/distributed/cases/load_data/load_data_parquet.result` (modified, +15/-1)
```diff
@@ -218,8 +218,22 @@ select * from ts_test;
 ➤ id[-5,64,0]  ¦  ts_no_tz_micros[93,64,0]  ¦  ts_no_tz_millis[93,64,0]  𝄀
 1  ¦  2023-10-27 10:00:00  ¦  2025-12-25 08:30:00  𝄀
 2  ¦  1960-01-01 12:00:00  ¦  2000-01-01 00:00:00  𝄀
-3  ¦  null  ¦  2023-12-31 23:59:59
+3  ¦  null  ¦  2024-01-01 00:00:00
 drop table ts_test;
+create table ts_test_ctl(id bigint, v datetime);
+insert into ts_test_ctl values (1, '2023-12-31 23:59:59.999');
+select * from ts_test_ctl;
+➤ id[-5,64,0]  ¦  v[93,64,0]  𝄀
+1  ¦  2024-01-01 00:00:00
+set @ts_saved_sql_mode = @@session.sql_mode;
+set session sql_mode = 'TIME_TRUNCATE_FRACTIONAL';
+insert into ts_test_ctl values (2, '2023-12-31 23:59:59.999');
+select * from ts_test_ctl;
+➤ id[-5,64,0]  ¦  v[93,64,0]  𝄀
+1  ¦  2024-01-01 00:00:00  𝄀
+2  ¦  2023-12-31 23:59:59
+set session sql_mode = @ts_saved_sql_mode;
+drop table ts_test_ctl;
 drop table if exists none_compression;
 CREATE TABLE none_compression (
 id BIGINT,
```

**File**: `test/distributed/cases/load_data/load_data_parquet.sql` (modified, +10/-0)
```diff
@@ -140,6 +140,16 @@ load data infile {'filepath'='$resources/parquet/ts_no_tz_test.parquet', 'format
 select * from ts_test;
 drop table ts_test;
 
+create table ts_test_ctl(id bigint, v datetime);
+insert into ts_test_ctl values (1, '2023-12-31 23:59:59.999');
+select * from ts_test_ctl;
+set @ts_saved_sql_mode = @@session.sql_mode;
+set session sql_mode = 'TIME_TRUNCATE_FRACTIONAL';
+insert into ts_test_ctl values (2, '2023-12-31 23:59:59.999');
+select * from ts_test_ctl;
+set session sql_mode = @ts_saved_sql_mode;
+drop table ts_test_ctl;
+
 -- compressed file load
 drop table if exists none_compression;
 CREATE TABLE none_compression (
```

---

### Incident Patch 3: `c52d2deb` (2026-11-13)
**Commit Message**: fix(frontend): combine compound privileges across inherited roles (#32687)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to matrixorigin/matrixflow#21538.

## What this PR does / why we need it:

This is the main-branch counterpart of #32663, adapted to main's single-active-role semantics. `SET SECONDARY ROLE ALL/NONE` remains a no-op; this change does not activate independently granted secondary roles.

Compound authorization currently requires one role to satisfy every item. If the active role can SELECT from A and inherits a role that can SELECT from B, each table is readable separately but their JOIN is rejected with the privilege cache disabled. With caching enabled, the result can depend on traversal order.

### Changes

- Retain fully satisfied table/view compound items across the existing role sets and inheritance levels within one authorization attempt, independently of the session cache.
- Continue checking other items after an individual miss, but authorize only when every required item is satisfied.
- Keep each view chain ato

**File**: `pkg/frontend/authenticate.go` (modified, +45/-6)
```diff
@@ -8493,9 +8493,38 @@ func verifyViewPrivilegeForRole(
 	return false, nil
 }
 
+// newCompoundPrivilegeChecks retains complete table-access checks across inherited
+// roles for one authorization attempt, independently of the session cache.
+func newCompoundPrivilegeChecks(priv *privilege) map[*compoundEntry][]bool {
+	if priv.needMatchedRole {
+		return nil
+	}
+	var checks map[*compoundEntry][]bool
+	for _, entry := range priv.entries {
+		if entry.privilegeEntryTyp != privilegeEntryTypeCompound || entry.compound == nil || len(entry.compound.items) < 2 {
+			continue
+		}
+		canCombine := true
+		for _, item := range entry.compound.items {
+			if item.privilegeTyp == PrivilegeTypeCanGrantRoleToOthersInCreateUser ||
+				(item.objType != objectTypeTable && item.objType != objectTypeView) {
+				canCombine = false
+				break
+			}
+		}
+		if canCombine {
+			if checks == nil {
+				checks = make(map[*compoundEntry][]bool)
+			}
+			checks[entry.compound] = make([]bool, len(entry.compound.items))
+		}
+	}
+	return checks
+}
+
 // determineRoleSetHasPrivilegeSet decides the role set has at least one privilege of the privilege set.
 // The algorithm 2.
-func determineRoleSetHasPrivilegeSet(ctx context.Context, bh BackgroundExec, ses *Session, roleIds *btree.Set[int64], priv *privilege, enableCache bool) (bool, int64, error) {
+func determineRoleSetHasPrivilegeSet(ctx context.Context, bh BackgroundExec, ses *Session, roleIds *btree.Set[int64], priv *privilege, enableCache bool, compoundChecks map[*compoundEntry][]bool) (bool, int64, error) {
 	var err error
 	var pls []privilegeLevelType
 	var yes bool
@@ -8541,8 +8570,13 @@ func determineRoleSetHasPrivilegeSet(ctx context.Context, bh BackgroundExec, ses
 
 				allTrue := true
 				matchedRoleID := int64(0)
-				// multi privileges take effect together
-				for _, mi := range entry.compound.items {
+				checked := compoundChecks[entry.compound]
+				// All items are required, but different inherited roles may satisfy
+				// them. Each view chain remains a complete check in its own context.
+				for itemIndex, mi := range entry.compound.items {
+					if checked != nil && checked[itemIndex] {
+						continue
+					}
 					if mi.privilegeTyp == PrivilegeTypeCanGrantRoleToOthersInCreateUser {
 						yes, err = determineUserCanGrantRolesToOthersInternal(ctx, bh, ses, []*tree.Role{mi.role})
 						if err != nil {
@@ -8650,7 +8684,11 @@ func determineRoleSetHasPrivilegeSet(ctx context.Context, bh BackgroundExec, ses
 					}
 					if !yes {
 						allTrue = false
-						break
+						if checked == nil {
+							break
+						}
+					} else if checked != nil {
+						checked[itemIndex] = true
 					}
 				}
 
@@ -8910,7 +8948,8 @@ func determineUserHasPrivilegeSetWithSelectLockBatch(ctx context.Context, ses *S
 
 	// Call the algorithm 2.
 	// If the result of the algorithm 2 is true, Then return true;
-	yes, matchedRoleID, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roleSetOfKthIteration, priv, enableCache)
+	compoundChecks := newCompoundPrivilegeChecks(priv)
+	yes, matchedRoleID, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roleSetOfKthIteration, priv, enableCache, compoundChecks)
 	if err != nil {
 		return false, stats, err
 	}
@@ -9005,7 +9044,7 @@ func determineUserHasPrivilegeSetWithSelectLockBatch(ctx context.Context, ses *S
 
 		// Call the algorithm 2.
 		// If the result of the algorithm 2 is true, Then return true;
-		yes, matchedRoleID, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roleSetOfKPlusOneThIteration, priv, enableCache)
+		yes, matchedRoleID, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roleSetOfKPlusOneThIteration, priv, enableCache, compoundChecks)
 		if err != nil {
 			return false, stats, err
 		}
```

**File**: `pkg/frontend/authenticate_compound_test.go` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package frontend
+
+import (
+	"context"
+	"fmt"
+	"testing"
+
+	"github.com/golang/mock/gomock"
+	"github.com/prashantv/gostub"
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+)
+
+func TestCompoundPrivilegesAcrossInheritedRoles(t *testing.T) {
+	for _, cacheEnabled := range []bool{false, true} {
+		for _, tc := range []struct {
+			name      string
+			grants    map[int64][]string
+			inherited map[int64][]int64
+			reverse   bool
+			want      bool
+		}{
+			{name: "parent_and_child", grants: map[int64][]string{5: {"a"}, 7: {"b"}}, inherited: map[int64][]int64{5: {7}}, want: true},
+			{name: "reverse_grants", grants: map[int64][]string{5: {"b"}, 7: {"a"}}, inherited: map[int64][]int64{5: {7}}, want: true},
+			{name: "reverse_items", grants: map[int64][]string{5: {"a"}, 7: {"b"}}, inherited: map[int64][]int64{5: {7}}, reverse: true, want: true},
+			{name: "different_depths", grants: map[int64][]string{7: {"a"}, 9: {"b"}}, inherited: map[int64][]int64{5: {7}, 7: {9}}, want: true},
+			{name: "siblings", grants: map[int64][]string{7: {"a"}, 9: {"b"}}, inherited: map[int64][]int64{5: {7, 9}}, want: true},
+			{name: "reverse_siblings", grants: map[int64][]string{7: {"b"}, 9: {"a"}}, inherited: map[int64][]int64{5: {7, 9}}, want: true},
+			{name: "single_role", grants: map[int64][]string{5: {"a", "b"}}, want: true},
+			{name: "missing_permission", grants: map[int64][]string{5: {"a"}}, inherited: map[int64][]int64{5: {7}}},
+			{name: "not_inherited", grants: map[int64][]string{5: {"a"}, 7: {"b"}}},
+			{name: "cycle_missing_permission", grants: map[int64][]string{7: {"a"}}, inherited: map[int64][]int64{5: {7}, 7: {5}}},
+		} {
+			t.Run(fmt.Sprintf("cache_%t/%s", cacheEnabled, tc.name), func(t *testing.T) {
+				ctx := defines.AttachAccountId(t.Context(), 0)
+				priv := compoundTablePrivileges("a", "b")
+				if tc.reverse {
+					priv.entries[0].compound.items[0], priv.entries[0].compound.items[1] = priv.entries[0].compound.items[1], priv.entries[0].compound.items[0]
+				}
+				ses, _ := newCompoundPrivilegeSession(t, priv, tc.grants, tc.inherited, cacheEnabled)
+				ok, _, err := determineUserHasPrivilegeSet(ctx, ses, priv)
+				require.NoError(t, err)
+				require.Equal(t, tc.want, ok)
+			})
+		}
+	}
+}
+
+func TestCompoundPrivilegeCatalogError(t *testing.T) {
+	for _, want := range []error{moerr.NewInternalErrorNoCtx("catalog unavailable"), context.Canceled} {
+		t.Run(want.Error(), func(t *testing.T) {
+			ctx := defines.AttachAccountId(t.Context(), 0)
+			priv := compoundTablePrivileges("a", "b")
+			ses, bh := newCompoundPrivilegeSession(t, priv, map[int64][]string{5: {"a"}, 7: {"b"}}, map[int64][]int64{5: {7}}, false)
+			entry := privilegeEntriesMap[PrivilegeTypeSelect]
+			entry.databaseName, entry.tableName = "compound_db", "b"
+			levels, err := getPrivilegeLevelsOfObjectType(ctx, objectTypeTable)
+			require.NoError(t, err)
+			sql, err := getSqlForPrivilege(ctx, 7, entry, levels[0])
+			require.NoError(t, err)
+			bh.sql2err[sql] = want
+			ok, _, err := determineUserHasPrivilegeSet(ctx, ses, priv)
+			require.ErrorIs(t, err, want)
+			require.False(t, ok)
+			require.Contains(t, bh.executedSQLs, "rollback;")
+		})
+	}
+}
+
+func TestCompoundPrivilegeChecksAreStatementLocal(t *testing.T) {
+	ctx := defines.AttachAccountId(t.Context(), 0)
+	priv := compoundTablePrivileges("a", "b")
+	ses, _ := newCompoundPrivilegeSession(t, priv, map[int64][]string{5: {"a"}, 7: {"b"}}, map[int64][]int64{5: {7}}, false)
+	for _, role := range []uint32{5, 7, 5} {
+		ses.GetTenantInfo().SetDefaultRoleID(role)
+		ok, _, err := determineUserHasPrivilegeSet(ctx, ses, priv)
+		require.NoError(t, err)
+		require.Equal(t, role == 5, ok)
+	}
+}
+
+func TestCompoundPrivilegesPreserveMatchedRole(t *testing.T) {
+	priv := compoundTablePrivileges("a", "b")
+	priv.needMatchedRole = true
+	ses, _ := newCompoundPrivilegeSession(t, priv, map[int64][]string{5: {"a"}, 7: {"b"}}, map[int64][]int64{5: {7}}, true)
+	ok, _, err := determineUserHasPrivilegeSet(defines.AttachAccountId(t.Context(), 0), ses, priv)
+	require.NoError(t, err)
+	require.False(t, ok, "a statement requiring one matched role must not combine roles")
+}
+
+func TestCompoundPrivilegeChecksScope(t *testing.T) {
+	for _, tc := range []struct {
+		name str
```

**File**: `pkg/frontend/view_privilege_principal_test.go` (modified, +20/-1)
```diff
@@ -94,14 +94,33 @@ func TestViewPrivilegePrincipal(t *testing.T) {
 				convertPrivilegeTipsToPrivilege(priv, privilegeTipsArray{{typ: PrivilegeTypeSelect, objType: objectTypeTable, databaseName: "sub", tableName: "t", viewPath: []*plan.ViewStep{step("outer"), step("inner")}, objectRef: ref}})
 				roles := &btree.Set[int64]{}
 				roles.Insert(50)
-				allowed, role, err := determineRoleSetHasPrivilegeSet(ctx, bh, ses, roles, priv, cached)
+				allowed, role, err := determineRoleSetHasPrivilegeSet(ctx, bh, ses, roles, priv, cached, nil)
 				require.NoError(t, err)
 				require.Equal(t, tc.allowed, allowed)
 				if allowed {
 					require.Equal(t, int64(50), role)
 				}
 				require.Equal(t, "sub", ref.SubscriptionName)
 				require.False(t, ses.GetPrivilegeCache().has(objectTypeTable, privilegeLevelDatabaseTable, "publisher", "t", PrivilegeTypeSelect))
+
+				// A complete view check cannot also authorize a direct table item,
+				// even when its database, table and numeric role IDs coincide.
+				priv.entries[0].compound.items = append(priv.entries[0].compound.items, privilegeItem{
+					privilegeTyp: PrivilegeTypeSelect, objType: objectTypeTable, dbName: "publisher", tableName: "t",
+				})
+				roles.Insert(51)
+				allowed, _, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roles, priv, cached, newCompoundPrivilegeChecks(priv))
+				require.NoError(t, err)
+				require.False(t, allowed)
+
+				// Another caller role can supply the sibling grant, but it cannot
+				// repair an invalid DEFINER/INVOKER chain for the original item.
+				sql, err := getSqlForCheckRoleHasTableLevelPrivilegeWithObjType(ctx, objectTypeTable, 51, PrivilegeTypeSelect, "publisher", "t")
+				require.NoError(t, err)
+				results[queryKey{7, sql}] = positive
+				allowed, _, err = determineRoleSetHasPrivilegeSet(ctx, bh, ses, roles, priv, cached, newCompoundPrivilegeChecks(priv))
+				require.NoError(t, err)
+				require.Equal(t, tc.allowed, allowed)
 			})
 		}
 	}
```

**File**: `test/distributed/cases/zz_accesscontrol/inherited_role_compound.result` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+drop database if exists inherited_compound_db;
+drop user if exists inherited_compound_reader;
+drop role if exists inherited_compound_a, inherited_compound_b, inherited_compound_parent, inherited_compound_unused;
+create database inherited_compound_db;
+create table inherited_compound_db.a (yr int, amount int);
+create table inherited_compound_db.b (yr int, amount int);
+create table inherited_compound_db.denied (amount int);
+insert into inherited_compound_db.a values (2024, 10), (2025, 20);
+insert into inherited_compound_db.b values (2024, 2), (2025, 4);
+insert into inherited_compound_db.denied values (99);
+create role inherited_compound_a, inherited_compound_b, inherited_compound_parent, inherited_compound_unused;
+grant connect on account * to inherited_compound_a;
+grant select, insert on table inherited_compound_db.a to inherited_compound_a;
+grant select on table inherited_compound_db.b to inherited_compound_b;
+grant select on table inherited_compound_db.denied to inherited_compound_unused;
+grant inherited_compound_b to inherited_compound_a;
+create user inherited_compound_reader identified by '123456' default role inherited_compound_a;
+grant inherited_compound_b, inherited_compound_unused to inherited_compound_reader;
+set enable_privilege_cache = off;
+select sum(amount) from inherited_compound_db.a;
+➤ sum(amount)[-5,64,0]  𝄀
+30
+select sum(amount) from inherited_compound_db.b;
+➤ sum(amount)[-5,64,0]  𝄀
+6
+select a.amount, b.amount from inherited_compound_db.a a join inherited_compound_db.b b on a.yr = b.yr order by a.yr;
+➤ amount[4,32,0]  ¦  amount[4,32,0]  𝄀
+10  ¦  2  𝄀
+20  ¦  4
+with a24 as (select sum(amount) v from inherited_compound_db.a where yr = 2024),
+a25 as (select sum(amount) v from inherited_compound_db.a where yr = 2025),
+b24 as (select sum(amount) v from inherited_compound_db.b where yr = 2024),
+b25 as (select sum(amount) v from inherited_compound_db.b where yr = 2025)
+select a24.v, a25.v, b24.v, b25.v from a24 cross join a25 cross join b24 cross join b25;
+➤ v[-5,64,0]  ¦  v[-5,64,0]  ¦  v[-5,64,0]  ¦  v[-5,64,0]  𝄀
+10  ¦  20  ¦  2  ¦  4
+select count(*) from (
+with a24 as (select sum(amount) v from inherited_compound_db.a where yr = 2024),
+a25 as (select sum(amount) v from inherited_compound_db.a where yr = 2025),
+b24 as (select sum(amount) v from inherited_compound_db.b where yr = 2024),
+b25 as (select sum(amount) v from inherited_compound_db.b where yr = 2025)
+select a25.v / b25.v as ratio from a24 cross join a25 cross join b24 cross join b25
+union all
+select a24.v / b24.v as ratio from a24 cross join a25 cross join b24 cross join b25
+) totals;
+➤ count(*)[-5,64,0]  𝄀
+2
+set secondary role all;
+select sum(a.amount + d.amount) from inherited_compound_db.a a cross join inherited_compound_db.denied d;
+internal error: do not have privilege to execute the statement
+set secondary role none;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+begin;
+insert into inherited_compound_db.a select * from inherited_compound_db.b;
+select count(*) from inherited_compound_db.a;
+➤ count(*)[-5,64,0]  𝄀
+4
+rollback;
+set enable_privilege_cache = on;
+set clear_privilege_cache = on;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+set clear_privilege_cache = on;
+select sum(b.amount + a.amount) from inherited_compound_db.b b cross join inherited_compound_db.a a;
+➤ sum(b.amount + a.amount)[3,38,0]  𝄀
+72
+set clear_privilege_cache = on;
+select sum(amount) from inherited_compound_db.a;
+➤ sum(amount)[-5,64,0]  𝄀
+30
+select sum(amount) from inherited_compound_db.b;
+➤ sum(amount)[-5,64,0]  𝄀
+6
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+set role inherited_compound_b;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+internal error: do not have privilege to execute the statement
+set secondary role all;
+select sum(amount) from inherited_compound_db.a;
+internal error: do not have privilege to execute the statement
+set role inherited_compound_a;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+revoke inherited_compound_b from inherited_compound_a;
+grant inherited_compound_b to inherited_compound_parent;
+grant inherited_compound_parent to inherited_compound_a;
+set enable_privilege_cache = off;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+➤ sum(a.amount + b.amount)[3,38,0]  𝄀
+72
+revoke select o
```

**File**: `test/distributed/cases/zz_accesscontrol/inherited_role_compound.sql` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+drop database if exists inherited_compound_db;
+drop user if exists inherited_compound_reader;
+drop role if exists inherited_compound_a, inherited_compound_b, inherited_compound_parent, inherited_compound_unused;
+create database inherited_compound_db;
+create table inherited_compound_db.a (yr int, amount int);
+create table inherited_compound_db.b (yr int, amount int);
+create table inherited_compound_db.denied (amount int);
+insert into inherited_compound_db.a values (2024, 10), (2025, 20);
+insert into inherited_compound_db.b values (2024, 2), (2025, 4);
+insert into inherited_compound_db.denied values (99);
+create role inherited_compound_a, inherited_compound_b, inherited_compound_parent, inherited_compound_unused;
+grant connect on account * to inherited_compound_a;
+grant select, insert on table inherited_compound_db.a to inherited_compound_a;
+grant select on table inherited_compound_db.b to inherited_compound_b;
+grant select on table inherited_compound_db.denied to inherited_compound_unused;
+grant inherited_compound_b to inherited_compound_a;
+create user inherited_compound_reader identified by '123456' default role inherited_compound_a;
+grant inherited_compound_b, inherited_compound_unused to inherited_compound_reader;
+
+-- 主角色和继承角色分别提供两张表的权限，关闭缓存仍应允许组合查询。
+-- @session:id=1&user=sys:inherited_compound_reader&password=123456
+set enable_privilege_cache = off;
+select sum(amount) from inherited_compound_db.a;
+select sum(amount) from inherited_compound_db.b;
+select a.amount, b.amount from inherited_compound_db.a a join inherited_compound_db.b b on a.yr = b.yr order by a.yr;
+with a24 as (select sum(amount) v from inherited_compound_db.a where yr = 2024),
+     a25 as (select sum(amount) v from inherited_compound_db.a where yr = 2025),
+     b24 as (select sum(amount) v from inherited_compound_db.b where yr = 2024),
+     b25 as (select sum(amount) v from inherited_compound_db.b where yr = 2025)
+select a24.v, a25.v, b24.v, b25.v from a24 cross join a25 cross join b24 cross join b25;
+select count(*) from (
+with a24 as (select sum(amount) v from inherited_compound_db.a where yr = 2024),
+     a25 as (select sum(amount) v from inherited_compound_db.a where yr = 2025),
+     b24 as (select sum(amount) v from inherited_compound_db.b where yr = 2024),
+     b25 as (select sum(amount) v from inherited_compound_db.b where yr = 2025)
+select a25.v / b25.v as ratio from a24 cross join a25 cross join b24 cross join b25
+union all
+select a24.v / b24.v as ratio from a24 cross join a25 cross join b24 cross join b25
+) totals;
+
+-- 仅直接授予用户但未被当前角色继承的权限不能参与合并；ALL/NONE 仍为无操作。
+set secondary role all;
+select sum(a.amount + d.amount) from inherited_compound_db.a a cross join inherited_compound_db.denied d;
+set secondary role none;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+
+-- 合并目标写权限和源表读权限，随后回滚以保持后续预期数据不变。
+begin;
+insert into inherited_compound_db.a select * from inherited_compound_db.b;
+select count(*) from inherited_compound_db.a;
+rollback;
+
+-- 冷缓存、交换表顺序、单表预热及重复执行的判定保持一致。
+set enable_privilege_cache = on;
+set clear_privilege_cache = on;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+set clear_privilege_cache = on;
+select sum(b.amount + a.amount) from inherited_compound_db.b b cross join inherited_compound_db.a a;
+set clear_privilege_cache = on;
+select sum(amount) from inherited_compound_db.a;
+select sum(amount) from inherited_compound_db.b;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+set role inherited_compound_b;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+set secondary role all;
+select sum(amount) from inherited_compound_db.a;
+set role inherited_compound_a;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+-- @session
+
+-- 将直接继承改为两层继承，权限需要跨不同深度保留。
+revoke inherited_compound_b from inherited_compound_a;
+grant inherited_compound_b to inherited_compound_parent;
+grant inherited_compound_parent to inherited_compound_a;
+-- @session:id=2&user=sys:inherited_compound_reader&password=123456
+set enable_privilege_cache = off;
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+-- @session
+
+-- 撤销底层表授权后，即使角色仍可达也不能读取该表。
+revoke select on table inherited_compound_db.b from inherited_compound_b;
+-- @session:id=3&user=sys:inherited_compound_reader&password=123456
+select sum(a.amount + b.amount) from inherited_compound_db.a a cross join inherited_compound_db.b b;
+select sum(amount) from inherited_compound_db.a;
+-- @session
+
+drop user inherited_compound_reader;
+drop role inherited_compound_a, inherited_compound_parent, inherited_compound_b, inher
```

#### Recent Merged Pull Requests:
- **PR #32741** (2026-11-14): fix(stage): return an error for missing catalog context (@XuPeng-SH)
- **PR #32740** (2026-11-14): [4.2-dev] backport #32734 and #32719 (@XuPeng-SH)
- **PR #32739** (closed): fix(frontend): preserve long-running half-closed clients (4.2-dev) (@XuPeng-SH)
- **PR #32738** (closed): fix(frontend): preserve replies after client write half-close (@XuPeng-SH)
- **PR #32734** (2026-11-14): perf: reduce low-value DEBUG logging (@XuPeng-SH)
- **PR #32730** (2026-11-13): fix(plan): preserve user-variable domains in INTERVAL arithmetic (@aptend)

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

## X. compile): support saved-result CTAS with current source privileges

**RULE**:
When implementing operations in `pkg/frontend/authenticate.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `645219d3`: compile): support saved-result CTAS with current source privileges. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/frontend/authenticate.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// A CTAS source over a saved query result carries no table-scan tips, and
	// the CTAS follow-up INSERT ... SELECT runs through the internal executor,
	// whose compile path does not re-verify result-query access. Apply the same
	// saved-result source re-verification the direct SELECT path uses, so a
	// role whose source SELECT privilege is missing or revoked cannot copy the
	// saved result by CTAS. Plain sources have no result scans and return here
	// with no extra cost.
	resultStats, resultErr := checkResultQueryPrivilege(compilerContext.GetProcess(), sourcePlan, ctx, ses.GetService(), ses)
	stats.Add(&resultStats)
	if resultErr != nil {
		return false, stats, resultErr
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `645219d3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
