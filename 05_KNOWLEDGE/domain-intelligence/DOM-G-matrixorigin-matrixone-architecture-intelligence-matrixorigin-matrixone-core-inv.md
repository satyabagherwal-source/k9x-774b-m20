# Domain G — Architecture Intelligence: Architecture Intelligence: matrixorigin/matrixone Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "56989d8e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T15:36:15.876Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `56989d8e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T15:36:15.876Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 67%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from matrixorigin/matrixone:

# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T15:36:15.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2069 stars

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

	// Set before any role starts. A Python-only process must exit on worker
	// failure so its process supervisor can restart it.
	pythonWorkerRequired bool

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
- **Issue #33433** (2026-11-28): **[4.2-dev] test: stabilize cross-CN publication lock assertions**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32744.  ## What this PR does / why we need it:  The publication lock test called `syncCommit` after startup and assumed CN0 already knew both fixture CNs. In Coverage, both subtests failed at the membership count before reaching ALTER. [Failing Coverage job](https://github.com/matrixorigin/matrixone/actions/runs/46115958423/job/140889742152)  Refresh CN0's member inventory once after both CNs start and verify their IDs for the lock views. After each CREATE, wait for CN1 to apply CN0's commit before issuing ALTER. The `wide` and `singleton` cases exercise the original target and unrelated account lock assertions.  ### Validation  - Go 1.26.4 on macOS arm64. The full `./pkg/tests/issues/isolated` package passed with `-race -short -tags matrixone_test -count=1` (388 s), including both publication subtests. - Incremental SCA passed for the same package with `go vet`, pinned `molint`, and golangci-lint v2.6.2 (0 issues). Formatting, `git diff --check`, and `make err-check` also passed. 

- **Issue #33432** (2026-11-28): **ci: use S3-only PR Coverage and expose manual OSS COS checks**
  *Symptoms*: ## What type of PR is this?  - [x] Test and CI  ## Which issue(s) this PR fixes:  Related to #33429.  ## What this PR does / why we need it:  Use the two existing UT Coverage groups for main and 4.2-dev. The legacy and standby Shanghai paths share the prefix-scoped IDC fixture and require successful basic and streaming-write tests. The manual OSS/COS workflow tests the official 4.2-dev source and reports fixed identifiers for both SDK and S3FS failures, even when provider metadata appears later in the Go report. The manual check validates both configs before source checkout and reports Go test timeouts separately.  [matrixorigin/CI#505](https://github.com/matrixorigin/CI/pull/505) has merged. All five references use the published commit `d94028c93e14f8054a7cd4d1e2535bbaf59a8ec8`. Its tree is identical to the reviewed CI head.  Linux actionlint, 140 companion CI tests, 86 MatrixOne CI tests and the cross-repository retry and cleanup replay passed against the published revision. Exact legacy workflow setup and pass gates were exercised with local MinIO on both source branches. Healthy requests passed and invalid credentials and zero-request reports failed. Replayed the real UT and BVT profiles from [4.2-dev PR #33424, attempt 2](https://github.com/matrixorigin/matrixone/actions/runs/46107411827/attempts/2). Removing the OSS/COS profile kept changed-code coverage at 100% and changed overall block coverage from 76.784% to 76.752%. Live IDC/CS and the manual provider run remain ro

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

### Incident Patch 1: `a9ba8ca8` (2026-11-28)
**Commit Message**: Rebuild Python UDF with typed revisions and Arrow Flight execution (#29152)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [x] Improvement
- [x] Documentation
- [x] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Related to #28132. This PR delivers the opt-in external Python UDF
adapter for test and development. Production sandboxing and tenant
isolation remain outside this stage.

## What this PR does / why we need it:

### Python type-family checks and launch config

Commit `b23ac8120eb6c71223ef9c3688f86522c3808c4f` declares the intended
Python decimal and temporal subsets checked by `TestTypeSwitchFamilies`.
DECIMAL256 and YEAR remain outside the Python ABI. TIME keeps the Arrow
Duration representation, and TIMESTAMP NULLs use an explicit typed
branch. The type-check baseline is unchanged. The rebase onto
`940d135ce8c0af3e0d855fb19f71e87d5ff8904d` also preserves both the
upstream Sirius settings and the Python UDF client settings in
`etc/launch/cn.toml`. Both remain disabled by default. [Failing Coverage
worker](https://github.com/matrixorigin/matrixone/actions/runs/46110161943/job/140871682350)

New Darwin/arm64 validation reprodu

**File**: `.gitignore` (modified, +0/-2)
```diff
@@ -78,8 +78,6 @@ node-*-data/
 pkg/catalog/test/
 pkg/config/system_vars.go
 pkg/config/system_vars_test.go
-pkg/udf/pythonservice/pyserver/udf/
-pkg/udf/pythonservice/pyserver/__pycache__/
 path_to_file
 tester-log/
 ut-report/
```

**File**: `.golangci.yml` (modified, +14/-7)
```diff
@@ -35,20 +35,27 @@ linters:
             - $all
             - '!$test'
             - '!pkg/iceberg/adapter/iceberggo/**/*.go'
-            # Arrow IPC is isolated to the ingestion bridge and its external
-            # scan reader. Keep the dependency out of all other production
-            # packages, including the Iceberg-facing layers.
+          deny:
+            - pkg: github.com/apache/iceberg-go
+              desc: Iceberg dependency must stay behind pkg/iceberg/adapter/iceberggo
+        arrow-boundary:
+          list-mode: lax
+          files:
+            - $all
+            - '!$test'
+            - '!pkg/iceberg/adapter/iceberggo/**/*.go'
+            # Arrow belongs to the ingestion and external UDF boundaries.
+            # These owners do not also receive permission to import Iceberg.
             - '!**/pkg/container/arrowbridge/*.go'
             - '!**/pkg/sql/colexec/external/arrowio/*.go'
             - '!**/pkg/sql/colexec/external/reader_arrow.go'
             - '!**/pkg/sql/compile/compile.go'
+            - '!**/pkg/udf/python/*.go'
           deny:
-            - pkg: github.com/apache/iceberg-go
-              desc: Iceberg dependency must stay behind pkg/iceberg/adapter/iceberggo
             - pkg: github.com/apache/arrow-go
-              desc: Arrow dependency must not leak outside the Iceberg adapter
+              desc: Arrow dependency must stay behind an approved Arrow owner
             - pkg: github.com/apache/arrow/go
-              desc: Arrow dependency must not leak outside the Iceberg adapter
+              desc: Arrow dependency must stay behind an approved Arrow owner
     govet:
       disable:
         - fieldalignment
```

**File**: `cmd/mo-service/config.go` (modified, +14/-5)
```diff
@@ -44,7 +44,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/perfcounter"
 	"github.com/matrixorigin/matrixone/pkg/proxy"
 	"github.com/matrixorigin/matrixone/pkg/tnservice"
-	"github.com/matrixorigin/matrixone/pkg/udf/pythonservice"
+	"github.com/matrixorigin/matrixone/pkg/udf/python"
 	"github.com/matrixorigin/matrixone/pkg/util/debug/goroutine"
 	tomlutil "github.com/matrixorigin/matrixone/pkg/util/toml"
 	"github.com/matrixorigin/matrixone/pkg/version"
@@ -117,8 +117,10 @@ type Config struct {
 	CN cnservice.Config `toml:"cn"`
 	// ProxyConfig is the config of proxy.
 	ProxyConfig proxy.Config `toml:"proxy"`
-	// PythonUdfServerConfig is the config of python udf server
-	PythonUdfServerConfig pythonservice.Config `toml:"python-udf-server"`
+	// PythonUdfWorkerConfig is the config of the Python UDF worker.
+	PythonUdfWorkerConfig python.Config `toml:"python-udf-worker"`
+	// Released manifests used this role for the retired Python server.
+	legacyPythonUdfServer bool
 	// Observability parameters for the metric/trace
 	Observability config.ObservabilityParameters `toml:"observability"`
 
@@ -194,7 +196,14 @@ func parseFromString(data string, cfg any) error {
 	if err != nil {
 		return err
 	}
-	return cnservice.ValidateSiriusConfigKeys(metadata)
+	if err := cnservice.ValidateSiriusConfigKeys(metadata); err != nil {
+		return err
+	}
+	if serviceConfig, ok := cfg.(*Config); ok {
+		serviceConfig.legacyPythonUdfServer =
+			metadata.IsDefined("python-udf-server") && !metadata.IsDefined("python-udf-worker")
+	}
+	return nil
 }
 
 func (c *Config) validate() error {
@@ -564,7 +573,7 @@ func (c *Config) mustGetServiceUUID() string {
 	case metadata.ServiceType_PROXY:
 		return c.ProxyConfig.UUID
 	case metadata.ServiceType_PYTHON_UDF:
-		return c.PythonUdfServerConfig.UUID
+		return c.PythonUdfWorkerConfig.UUID
 	}
 	panic("impossible")
 }
```

**File**: `cmd/mo-service/launch_test.go` (modified, +30/-0)
```diff
@@ -713,6 +713,36 @@ func TestServiceClusterValidationAndErrors(t *testing.T) {
 	}
 }
 
+func TestLaunchSkipsReleasedPythonServerRole(t *testing.T) {
+	setLaunchTestHooks(t)
+	// v4.2.6, etc/launch-with-python-udf-server/python-udf-server.toml.
+	const legacy = `service-type = "PYTHON_UDF"
+
+[python-udf-server]
+uuid = "dd1dccb4-4d3c-41f8-b482-5251dc7a41b2"
+address = "127.0.0.1:50051"
+path = "pkg/udf/pythonservice/pyserver"
+`
+	file := writeLaunchTestFile(t, "python-udf-server.toml", legacy)
+	serviceLifecycle = newServiceSupervisor()
+	launchStartService = startService
+	require.NoError(t, startPythonUdfServiceCluster(t.Context(), []string{file}, nil, nil))
+	serviceLifecycle.pythonWorkerRequired = true
+	dedicated := NewConfig()
+	require.NoError(t, parseConfigFromFile(file, dedicated))
+	require.ErrorContains(t, startService(t.Context(), dedicated, nil, nil), "use [python-udf-worker]")
+
+	// An explicit replacement block takes precedence in a migrated file.
+	cfg := NewConfig()
+	require.NoError(t, parseFromString(legacy+`
+[python-udf-worker]
+address = "127.0.0.1:50052"
+path = "pkg/udf/python/worker"
+`, cfg))
+	require.False(t, cfg.legacyPythonUdfServer)
+	require.Equal(t, "127.0.0.1:50052", cfg.PythonUdfWorkerConfig.Address)
+}
+
 func TestLaunchRejectsMisclassifiedServiceConfigs(t *testing.T) {
 	setLaunchTestHooks(t)
 	started := make([]metadata.ServiceType, 0, 2)
```

**File**: `cmd/mo-service/lifecycle.go` (modified, +4/-0)
```diff
@@ -65,6 +65,10 @@ type serviceRoleState struct {
 type serviceSupervisor struct {
 	roles [serviceRoleCount]serviceRoleState
 
+	// Set before any role starts. A Python-only process must exit on worker
+	// failure so its process supervisor can restart it.
+	pythonWorkerRequired bool
+
 	shutdownOnce       sync.Once
 	shutdownErr        error
 	dynamicCleanupOnce sync.Once
```

**File**: `cmd/mo-service/lifecycle_test.go` (modified, +124/-0)
```diff
@@ -18,12 +18,14 @@ import (
 	"context"
 	"errors"
 	"os"
+	"path/filepath"
 	"sync"
 	"syscall"
 	"testing"
 	"time"
 
 	"github.com/matrixorigin/matrixone/pkg/common/stopper"
+	"github.com/matrixorigin/matrixone/pkg/udf/python"
 	"github.com/stretchr/testify/require"
 )
 
@@ -55,6 +57,128 @@ func TestServiceSupervisorStopsRolesInDependencyOrder(t *testing.T) {
 	require.Equal(t, roles, stopped)
 }
 
+func TestManagedPythonWorkerExitDoesNotFailServiceSupervisor(t *testing.T) {
+	for _, exit := range []string{"0", "17"} {
+		t.Run(exit, func(t *testing.T) {
+			dir := t.TempDir()
+			require.NoError(t, os.WriteFile(filepath.Join(dir, "worker.py"), []byte("exit "+exit+"\n"), 0600))
+			lifecycle := newServiceSupervisor()
+			tasks := stopper.NewStopper("worker-exit-test")
+			t.Cleanup(tasks.Stop)
+			require.NoError(t, startManagedPythonWorker(python.Config{
+				Address: "127.0.0.1:0", Path: dir, Python: "/bin/sh",
+			}, tasks, lifecycle))
+
+			done := make(chan struct{})
+			go func() {
+				lifecycle.roles[serviceRolePython].wg.Wait()
+				close(done)
+			}()
+			select {
+			case <-done:
+			case <-time.After(5 * time.Second):
+				t.Fatal("Python worker role did not finish")
+			}
+			select {
+			case err := <-lifecycle.failureC():
+				t.Fatalf("worker exit delivered a database service failure: %v", err)
+			default:
+			}
+			require.NoError(t, lifecycle.stopRole(t.Context(), serviceRolePython))
+		})
+	}
+}
+
+func TestManagedPythonWorkerStartupFailureIsIsolated(t *testing.T) {
+	dir := t.TempDir()
+	require.NoError(t, os.WriteFile(filepath.Join(dir, "worker.py"), nil, 0600))
+	for _, tc := range []struct {
+		name string
+		cfg  python.Config
+	}{
+		{name: "invalid config"},
+		{name: "missing interpreter", cfg: python.Config{
+			Address: "127.0.0.1:0", Path: dir, Python: filepath.Join(dir, "missing-python"),
+		}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			lifecycle := newServiceSupervisor()
+			tasks := stopper.NewStopper("worker-startup-test")
+			t.Cleanup(tasks.Stop)
+			require.NoError(t, startManagedPythonWorker(tc.cfg, tasks, lifecycle))
+
+			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
+			defer cancel()
+			require.NoError(t, lifecycle.stopRole(ctx, serviceRolePython))
+			select {
+			case err := <-lifecycle.failureC():
+				t.Fatalf("worker startup delivered a database service failure: %v", err)
+			default:
+			}
+		})
+	}
+}
+
+func TestDedicatedPythonWorkerFailureWakesShutdown(t *testing.T) {
+	setLaunchTestHooks(t)
+	oldProfileInterval := *profileInterval
+	t.Cleanup(func() { *profileInterval = oldProfileInterval })
+	*profileInterval = 0
+	launchSleep = func(time.Duration) {}
+
+	dir := t.TempDir()
+	require.NoError(t, os.WriteFile(filepath.Join(dir, "worker.py"), []byte("exit 17\n"), 0600))
+	for _, tc := range []struct {
+		name string
+		cfg  python.Config
+		want string
+	}{
+		{
+			name: "invalid config",
+			want: "invalid Python UDF worker configuration: internal error: missing python udf address",
+		},
+		{
+			name: "missing interpreter",
+			cfg: python.Config{
+				Address: "127.0.0.1:0", Path: dir, Python: filepath.Join(dir, "missing-python"),
+			},
+			want: "failed to start Python UDF worker",
+		},
+		{
+			name: "unexpected exit",
+			cfg:  python.Config{Address: "127.0.0.1:0", Path: dir, Python: "/bin/sh"},
+			want: "Python UDF worker exited unexpectedly: exit status 17",
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			lifecycle := newServiceSupervisor()
+			lifecycle.pythonWorkerRequired = true
+			serviceLifecycle = lifecycle
+			tasks := stopper.NewStopper("dedicated-python-worker-test")
+			t.Cleanup(tasks.Stop)
+			require.NoError(t, startManagedPythonWorker(tc.cfg, tasks, lifecycle))
+
+			shutdownC := make(chan struct{})
+			done := make(chan struct{})
+			var shutdownErr error
+			go func() {
+				shutdownErr = waitSignalToStop(tasks, shutdownC)
+				close(done)
+			}()
+			t.Cleanup(func() {
+				close(shutdownC)
+				<-done
+			})
+			select {
+			case <-done:
+				require.ErrorContains(t, shutdownErr, tc.want)
+			case <-time.After(5 * time.Second):
+				t.Fatal("dedicated Python worker failure did not wake shutdown")
+			}
+		})
+	}
+}
+
 func TestServiceSupervisorKeepsPythonProviderUntilCNDrains(t *testing.T) {
 	s := newServiceSupervisor()
 	var mu sync.Mutex
```

**File**: `cmd/mo-service/main.go` (modified, +48/-14)
```diff
@@ -53,7 +53,7 @@ import (
 	qclient "github.com/matrixorigin/matrixone/pkg/queryservice/client"
 	"github.com/matrixorigin/matrixone/pkg/sql/compile"
 	"github.com/matrixorigin/matrixone/pkg/tnservice"
-	"github.com/matrixorigin/matrixone/pkg/udf/pythonservice"
+	"github.com/matrixorigin/matrixone/pkg/udf/python"
 	"github.com/matrixorigin/matrixone/pkg/util/debug/goroutine"
 	"github.com/matrixorigin/matrixone/pkg/util/export"
 	"github.com/matrixorigin/matrixone/pkg/util/export/table"
@@ -147,6 +147,7 @@ func main() {
 	if *launchFile != "" {
 		startErr = startCluster(ctx, stopper, shutdownC)
 	} else if *configFile != "" {
+		serviceLifecycle.pythonWorkerRequired = true
 		cfg := NewConfig()
 		if err := parseConfigFromFile(*configFile, cfg); err != nil {
 			startErr = fmt.Errorf("failed to parse config from %s, error: %w", *configFile, err)
@@ -264,6 +265,14 @@ func startService(
 	if err != nil {
 		return err
 	}
+	if st == metadata.ServiceType_PYTHON_UDF && cfg.legacyPythonUdfServer {
+		const migration = "retired [python-udf-server] role; use [python-udf-worker] and explicitly enable the CN Python UDF client to use Arrow Flight"
+		if serviceLifecycle != nil && serviceLifecycle.pythonWorkerRequired {
+			return errors.New(migration)
+		}
+		logutil.GetGlobalLogger().Warn("skipping " + migration)
+		return nil
+	}
 
 	setupServiceRuntime(cfg, stopper)
 
@@ -316,7 +325,7 @@ func startService(
 	case metadata.ServiceType_LOG:
 		return startLogService(cfg, stopper, fs, shutdownC)
 	case metadata.ServiceType_PYTHON_UDF:
-		return startPythonUdfService(cfg, stopper)
+		return startPythonUdfWorker(cfg, stopper)
 	default:
 		panic("unknown service type")
 	}
@@ -773,12 +782,16 @@ func waitProxyFileServiceRetry(ctx context.Context, delay time.Duration) error {
 	}
 }
 
-// startPythonUdfService starts the python udf service.
-func startPythonUdfService(cfg *Config, stopper *stopper.Stopper) error {
+// startPythonUdfWorker starts the Python UDF worker.
+func startPythonUdfWorker(cfg *Config, stopper *stopper.Stopper) error {
 	if err := waitClusterCondition(cfg.mustGetServiceUUID(), cfg.HAKeeperClient, waitHAKeeperRunning); err != nil {
 		return err
 	}
-	finish := serviceLifecycle.registerTask(serviceRolePython)
+	return startManagedPythonWorker(cfg.PythonUdfWorkerConfig, stopper, serviceLifecycle)
+}
+
+func startManagedPythonWorker(cfg python.Config, stopper *stopper.Stopper, lifecycle *serviceSupervisor) error {
+	finish := lifecycle.registerTask(serviceRolePython)
 	serviceWG.Add(1)
 	var taskDone sync.Once
 	finishTask := func(err error) {
@@ -787,22 +800,43 @@ func startPythonUdfService(cfg *Config, stopper *stopper.Stopper) error {
 			finish(err)
 		})
 	}
-	err := stopper.RunNamedTask("python-udf-service", func(ctx context.Context) {
+	err := stopper.RunNamedTask("python-udf-worker", func(ctx context.Context) {
 		var closeErr error
 		defer func() { finishTask(closeErr) }()
-		roleCtx, cancelRole := serviceLifecycle.roleContext(ctx, serviceRolePython)
+		roleCtx, cancelRole := lifecycle.roleContext(ctx, serviceRolePython)
 		defer cancelRole()
-		s, err := pythonservice.NewService(cfg.PythonUdfServerConfig)
+		reportFailure := func(message string, err error) {
+			logutil.GetGlobalLogger().Error(message, zap.Error(err))
+			if lifecycle != nil && lifecycle.pythonWorkerRequired && roleCtx.Err() == nil {
+				lifecycle.notifyFatal(fmt.Errorf("%s: %w", message, err))
+			}
+		}
+		s, err := python.NewSupervisor(cfg)
 		if err != nil {
-			panic(err)
+			reportFailure("invalid Python UDF worker configuration", err)
+			return
 		}
 		if err := s.Start(); err != nil {
-			panic(err)
+			reportFailure("failed to start Python UDF worker", err)
+			return
 		}
-		<-roleCtx.Done()
-		if err := s.Close(); err != nil {
-			closeErr = err
-			logutil.GetGlobalLogger().Error("failed to close python udf service", zap.Error(err))
+		workerDone := s.Done()
+		select {
+		case <-roleCtx.Done():
+			if err := s.Close(); err != nil {
+				closeErr = err
+				logutil.GetGlobalLogger().Error("failed to close Python UDF worker", zap.Error(err))
+			}
+		case <-workerDone:
+			// The supervisor has reaped the worker. A shutdown-driven exit
+			// is already handled by the role's lifecycle.
+			if roleCtx.Err() == nil {
+				workerErr := s.Err()
+				if workerErr == nil {
+					workerErr = errors.New("process exited without an error")
+				}
+				reportFailure("Python UDF worker exited unexpectedly", workerErr)
+			}
 		}
 	})
 	if err != nil {
```

**File**: `cmd/mo-service/toml_fileservice_test.go` (modified, +31/-0)
```diff
@@ -21,6 +21,9 @@ import (
 	"strings"
 	"testing"
 
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/fileservice"
+	"github.com/matrixorigin/matrixone/pkg/udf/python"
 	"github.com/stretchr/testify/require"
 )
 
@@ -30,6 +33,34 @@ var knownFileServiceBackends = map[string]bool{
 	"DISK-ETL": true, "DISK-TMP": true, "S3": true, "MINIO": true,
 }
 
+func TestBundledPythonWorkerLaunchPublishesArtifacts(t *testing.T) {
+	configPath := filepath.Join("..", "..", "etc", "launch-with-python-udf-worker", "cn.toml")
+	data, err := os.ReadFile(configPath)
+	require.NoError(t, err)
+	var cfg Config
+	require.NoError(t, parseFromString(string(data), &cfg))
+
+	for _, config := range cfg.FileServices {
+		if config.Name != defines.SharedFileServiceName {
+			continue
+		}
+		config.DataDir = t.TempDir()
+		fs, err := fileservice.NewFileService(t.Context(), config, nil)
+		require.NoError(t, err)
+		t.Cleanup(func() { fs.Close(t.Context()) })
+		store, err := python.NewFileArtifactStore(fs, python.DefaultMaxArtifactBytes)
+		require.NoError(t, err)
+		const source = "def f(ctx): return 1"
+		digest, err := store.Publish(t.Context(), 7, "f", source)
+		require.NoError(t, err)
+		resolved, err := store.Resolve(t.Context(), 7, "f", digest)
+		require.NoError(t, err)
+		require.Equal(t, source, resolved)
+		return
+	}
+	t.Fatal("bundled Python worker launch has no shared file service")
+}
+
 func launchTomlFiles(t *testing.T, patterns ...string) []string {
 	root := filepath.Join("..", "..")
 	var files []string
```

---

### Incident Patch 2: `a843ded3` (2026-11-28)
**Commit Message**: fix(frontend): invalidate parent DELETE plans when foreign key checks change (#33409)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #33190

## What this PR does / why we need it:

A cached parent-table DELETE can retain the foreign-key behavior that
was active when the plan was built. A literal prepared DELETE can
therefore remove a referenced parent after checks are enabled or reject
a deletion after checks are disabled.

When the normalized session value of `foreign_key_checks` changes,
invalidate cached DELETEs whose target tables have incoming foreign
keys. Prepared handles rebuild through the existing EXECUTE path.
Ordinary cache entries remain intact until the cache can release their
ASTs. The DELETE execution path retains its existing cache policy.

### Validation

- Rebased onto main at `f1063bd47d0045d49a2a56cf4d8a089b842ee011`.
- Extended `foreign_key/issue_26892.sql` with separate parent rows for
OFF→ON and ON→OFF so the first failure cannot mask the reverse case. The
regression checks the parent row sets, surviving child rows, 

**File**: `pkg/frontend/plan_cache.go` (modified, +24/-1)
```diff
@@ -16,10 +16,11 @@ package frontend
 
 import (
 	"container/list"
+	"slices"
 
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/pb/timestamp"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
-	"github.com/matrixorigin/matrixone/pkg/sql/plan"
 )
 
 type cachedPlan struct {
@@ -300,6 +301,28 @@ func (pc *planCache) invalidatePlanGeneration(
 	cached.invalid = true
 }
 
+func (pc *planCache) invalidateForeignKeyDeletePlans() {
+	for _, element := range pc.cachePool {
+		cached := element.Value.(*cachedPlan)
+		if !cached.invalid && slices.ContainsFunc(cached.plans, deletePlanDependsOnForeignKeyChecks) {
+			// A running wrapper may still borrow this entry's AST.
+			cached.invalid = true
+		}
+	}
+}
+
+func deletePlanDependsOnForeignKeyChecks(p *plan.Plan) bool {
+	query := p.GetQuery()
+	if query.GetStmtType() != plan.Query_DELETE {
+		return false
+	}
+	// Legacy DELETE retains the target definition even when checks are OFF
+	// and the plan can truncate instead of checking referencing rows.
+	return slices.ContainsFunc(query.Nodes, func(node *plan.Node) bool {
+		return len(node.GetDeleteCtx().GetTableDef().GetRefChildTbls()) != 0
+	})
+}
+
 func (pc *planCache) clean() {
 	if pc.lruList == nil {
 		pc.cachePool = nil
```

**File**: `pkg/frontend/plan_cache_test.go` (modified, +47/-0)
```diff
@@ -624,6 +624,53 @@ func TestSessionDivPrecisionIncrementChangeClearsPlanCache(t *testing.T) {
 	require.Equal(t, 1, stmt.freed)
 }
 
+func TestSessionForeignKeyChecksInvalidatesParentDeletePlans(t *testing.T) {
+	ctx := defines.AttachAccountId(t.Context(), catalog.System_Account)
+	setPu("", config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil))
+	ses := NewSession(ctx, "", &testMysqlWriter{}, nil)
+
+	deleteNode := func(refChildren ...uint64) *plan.Node {
+		return &plan.Node{
+			NodeType:  pbplan.Node_DELETE,
+			DeleteCtx: &pbplan.DeleteCtx{TableDef: &plan.TableDef{RefChildTbls: refChildren}},
+		}
+	}
+	deleteQuery := func(nodes ...*plan.Node) *plan.Plan {
+		return &plan.Plan{Plan: &pbplan.Plan_Query{Query: &plan.Query{
+			StmtType: pbplan.Query_DELETE,
+			Nodes:    nodes,
+		}}}
+	}
+	parent, plain := deleteQuery(deleteNode(), deleteNode(2)), deleteQuery(deleteNode())
+	cachedParent, cachedPlain := &trackedStatement{}, &trackedStatement{}
+	ses.cachePlan("parent", []tree.Statement{&trackedStatement{}, cachedParent}, []*plan.Plan{plain, parent})
+	ses.cachePlan("plain", []tree.Statement{cachedPlain}, []*plan.Plan{plain})
+	prepare := func(name string, p *plan.Plan) *PrepareStmt {
+		stmt := &PrepareStmt{Name: name, PreparePlan: &plan.Plan{Plan: &pbplan.Plan_Dcl{Dcl: &pbplan.DataControl{
+			Control: &pbplan.DataControl_Prepare{Prepare: &pbplan.Prepare{Plan: p}},
+		}}}}
+		require.NoError(t, ses.SetPrepareStmt(ctx, name, stmt))
+		return stmt
+	}
+	preparedParent, preparedPlain := prepare("parent", parent), prepare("plain", plain)
+
+	// Equivalent and invalid SETs leave both warmed generations eligible.
+	require.NoError(t, ses.SetSessionSysVar(ctx, "FOREIGN_KEY_CHECKS", "ON"))
+	require.Error(t, ses.SetSessionSysVar(ctx, "foreign_key_checks", "invalid"))
+	require.True(t, ses.isCached("parent"))
+	require.False(t, preparedParent.needsRebuild)
+
+	require.NoError(t, ses.SetSessionSysVar(ctx, "foreign_key_checks", 0))
+	require.True(t, preparedParent.needsRebuild)
+	require.False(t, preparedPlain.needsRebuild)
+	require.False(t, ses.isCached("parent"))
+	require.True(t, ses.isCached("plain"))
+	require.Zero(t, cachedParent.freed, "SET must leave borrowed ASTs alive")
+	require.Nil(t, ses.getCachedPlan("parent"))
+	require.Equal(t, 1, cachedParent.freed)
+	require.Zero(t, cachedPlain.freed)
+}
+
 func TestSessionRollupAlgorithmChangeClearsPlanCache(t *testing.T) {
 	ctx := defines.AttachAccountId(context.Background(), catalog.System_Account)
 	setPu("", config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil))
```

**File**: `pkg/frontend/session.go` (modified, +13/-0)
```diff
@@ -2502,6 +2502,19 @@ func (ses *Session) invalidateCachedPlans(prepared bool) {
 	}
 }
 
+func (ses *Session) invalidateForeignKeyDeletePlans() {
+	ses.mu.Lock()
+	defer ses.mu.Unlock()
+	if ses.planCache != nil {
+		ses.planCache.invalidateForeignKeyDeletePlans()
+	}
+	for _, stmt := range ses.prepareStmts {
+		if deletePlanDependsOnForeignKeyChecks(stmt.PreparePlan.GetDcl().GetPrepare().GetPlan()) {
+			stmt.needsRebuild = true
+		}
+	}
+}
+
 // markPreparedPlansForRollupAlgorithmChange marks prepared plan generations
 // stale without closing their handles. The session variable is read while
 // building the physical rollup plan, so EXECUTE must rebuild the plan after
```

**File**: `pkg/frontend/types.go` (modified, +8/-3)
```diff
@@ -2004,8 +2004,9 @@ func (ses *Session) setSessionSysVar(ctx context.Context, name string, val inter
 	planDependencyVariable := name == "sql_mode" || name == "optimizer_hints" || name == "lc_time_names" || name == "time_zone" || name == "explicit_defaults_for_timestamp" || name == "mo_pk_check_by_cn" ||
 		name == "fulltext2_search_df_cutoff" || name == "fulltext2_threads_search" || name == "fulltext_bloom_filter_pushdown" ||
 		name == "join_spill_mem" || name == "agg_spill_mem" || name == "sort_spill_mem"
+	foreignKeyChecks := name == "foreign_key_checks"
 	var oldPlanDependency interface{}
-	if planDependencyVariable {
+	if planDependencyVariable || foreignKeyChecks {
 		oldValue, getErr := ses.GetSessionSysVar(name)
 		if getErr != nil {
 			return getErr
@@ -2076,7 +2077,7 @@ func (ses *Session) setSessionSysVar(ctx context.Context, name string, val inter
 	if err == nil && name == "sql_mode" {
 		ses.updateSqlModeNoAutoValueOnZero(val)
 	}
-	if err == nil && planDependencyVariable {
+	if err == nil && (planDependencyVariable || foreignKeyChecks) {
 		newValue, getErr := ses.GetSessionSysVar(name)
 		if getErr != nil {
 			return getErr
@@ -2086,7 +2087,11 @@ func (ses *Session) setSessionSysVar(ctx context.Context, name string, val inter
 			return getErr
 		}
 		if oldPlanDependency != newValue {
-			ses.invalidateCachedPlans(true)
+			if foreignKeyChecks {
+				ses.invalidateForeignKeyDeletePlans()
+			} else {
+				ses.invalidateCachedPlans(true)
+			}
 		}
 	}
 	if err == nil && name == "div_precision_increment" {
```

**File**: `pkg/tests/sqlintegration/prepared_delete_fk_test.go` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
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
+package sqlintegration
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/go-sql-driver/mysql"
+	"github.com/matrixorigin/matrixone/pkg/embed"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPreparedDeleteForeignKeyChecks(t *testing.T) {
+	runSQLIntegration(t, func(c embed.Cluster) {
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		db, err := sql.Open("mysql", fmt.Sprintf("dump:111@tcp(127.0.0.1:%d)/", cn.GetServiceConfig().CN.Frontend.Port))
+		require.NoError(t, err)
+		defer db.Close()
+
+		for _, protocol := range []string{"text", "binary", "direct"} {
+			t.Run(protocol, func(t *testing.T) {
+				ctx, cancel := context.WithTimeout(t.Context(), 2*time.Minute)
+				defer cancel()
+				conn, err := db.Conn(ctx)
+				require.NoError(t, err)
+				defer conn.Close()
+				defer cleanupSQLIntegration(t, cn,
+					"drop table if exists prepared_delete_fk.child",
+					"drop database if exists prepared_delete_fk")
+				exec := func(query string) {
+					t.Helper()
+					_, err := conn.ExecContext(ctx, query)
+					require.NoError(t, err, query)
+				}
+				count := func(query string) int {
+					t.Helper()
+					var n int
+					require.NoError(t, conn.QueryRowContext(ctx, query).Scan(&n), query)
+					return n
+				}
+
+				exec("create database prepared_delete_fk")
+				exec("use prepared_delete_fk")
+				exec("create table parent (id int primary key)")
+				exec("create table child (id int primary key, parent_id int, foreign key (parent_id) references parent(id) on delete restrict)")
+				exec("insert into parent values (1), (2)")
+				exec("insert into child values (10, 1)")
+				exec("set foreign_key_checks = 0")
+
+				const deleteParent = "delete from parent where id = 1"
+				var execute func() (sql.Result, error)
+				switch protocol {
+				case "text":
+					exec("prepare delete_parent from '" + deleteParent + "'")
+					defer exec("deallocate prepare delete_parent")
+					execute = func() (sql.Result, error) {
+						return conn.ExecContext(ctx, "execute delete_parent")
+					}
+				case "binary":
+					stmt, err := conn.PrepareContext(ctx, deleteParent)
+					require.NoError(t, err)
+					defer func() { require.NoError(t, stmt.Close()) }()
+					execute = func() (sql.Result, error) {
+						return stmt.ExecContext(ctx)
+					}
+				case "direct":
+					execute = func() (sql.Result, error) {
+						return conn.ExecContext(ctx, deleteParent)
+					}
+				}
+
+				for _, checks := range []int{0, 1, 0, 1} {
+					exec(fmt.Sprintf("set foreign_key_checks = %d", checks))
+					result, err := execute()
+					if checks == 1 {
+						var mysqlErr *mysql.MySQLError
+						require.ErrorAs(t, err, &mysqlErr)
+						require.Equal(t, uint16(1451), mysqlErr.Number)
+						require.Equal(t, 1, count("select count(*) from parent where id = 1"))
+					} else {
+						require.NoError(t, err)
+						rows, err := result.RowsAffected()
+						require.NoError(t, err)
+						require.EqualValues(t, 1, rows)
+						require.Zero(t, count("select count(*) from parent where id = 1"))
+						exec("insert into parent values (1)")
+					}
+					require.Equal(t, 1, count("select count(*) from parent where id = 2"))
+					require.Equal(t, 1, count("select count(*) from child where id = 10 and parent_id = 1"))
+				}
+			})
+		}
+	})
+}
```

**File**: `test/distributed/cases/foreign_key/issue_26892.result` (modified, +41/-0)
```diff
@@ -17,6 +17,47 @@ select id, parent_id from child order by id;
 ➤ id[4,32,0]  ¦  parent_id[4,32,0]  𝄀
 1  ¦  101
 truncate table child;
+insert into parent values (2), (3);
+insert into child values (3, 2), (4, 3), (5, 1);
+prepare fk_delete_child from 'delete from child where id = 5';
+set foreign_key_checks = 0;
+prepare fk_delete_off from 'delete from parent where id = 2';
+set foreign_key_checks = 1;
+execute fk_delete_off;
+Cannot delete or update a parent row: a foreign key constraint fails
+select id from parent order by id;
+➤ id[4,32,0]  𝄀
+1  𝄀
+2  𝄀
+3
+select id, parent_id from child order by id;
+➤ id[4,32,0]  ¦  parent_id[4,32,0]  𝄀
+3  ¦  2  𝄀
+4  ¦  3  𝄀
+5  ¦  1
+deallocate prepare fk_delete_off;
+prepare fk_delete_on from 'delete from parent where id = 3';
+set foreign_key_checks = 0;
+execute fk_delete_on;
+select id from parent order by id;
+➤ id[4,32,0]  𝄀
+1  𝄀
+2
+select id, parent_id from child order by id;
+➤ id[4,32,0]  ¦  parent_id[4,32,0]  𝄀
+3  ¦  2  𝄀
+4  ¦  3  𝄀
+5  ¦  1
+deallocate prepare fk_delete_on;
+set foreign_key_checks = 1;
+execute fk_delete_child;
+select id, parent_id from child order by id;
+➤ id[4,32,0]  ¦  parent_id[4,32,0]  𝄀
+3  ¦  2  𝄀
+4  ¦  3
+deallocate prepare fk_delete_child;
+truncate table child;
+delete from parent where id in (2, 3);
 set foreign_key_checks = 0;
 prepare fk_plain_off from 'insert into child values (?, ?)';
 set @id = 10, @parent_id = 110;
```

**File**: `test/distributed/cases/foreign_key/issue_26892.sql` (modified, +29/-0)
```diff
@@ -18,6 +18,35 @@ insert into child values (2, 102);
 select id, parent_id from child order by id;
 truncate table child;
 
+-- A prepared parent DELETE must honor the execution-time setting (#33190).
+insert into parent values (2), (3);
+insert into child values (3, 2), (4, 3), (5, 1);
+prepare fk_delete_child from 'delete from child where id = 5';
+
+set foreign_key_checks = 0;
+prepare fk_delete_off from 'delete from parent where id = 2';
+set foreign_key_checks = 1;
+execute fk_delete_off;
+select id from parent order by id;
+select id, parent_id from child order by id;
+deallocate prepare fk_delete_off;
+
+-- Use a different parent so the reverse case also fails independently on old code.
+prepare fk_delete_on from 'delete from parent where id = 3';
+set foreign_key_checks = 0;
+execute fk_delete_on;
+select id from parent order by id;
+select id, parent_id from child order by id;
+deallocate prepare fk_delete_on;
+
+-- A child-only DELETE remains usable after the same toggles.
+set foreign_key_checks = 1;
+execute fk_delete_child;
+select id, parent_id from child order by id;
+deallocate prepare fk_delete_child;
+truncate table child;
+delete from parent where id in (2, 3);
+
 -- Plain INSERT prepared while checks are disabled: OFF -> ON -> OFF.
 set foreign_key_checks = 0;
 prepare fk_plain_off from 'insert into child values (?, ?)';
```

---

### Incident Patch 3: `f1063bd4` (2026-11-28)
**Commit Message**: fix(hakeeper): keep stores alive during replica recovery (#33010)

## What type of PR is this?

- [x] BUG
- [x] Code Refactoring

## Which issue(s) this PR fixes:

issue #33008

This is the main-branch counterpart of the recovery fix merged into
4.2-dev in #33009.

## What this PR does / why we need it:

A lost LogStore and an incomplete replica report could make HAKeeper
repeatedly shut down surviving LogStores and TNs. Remove the global
teardown and its latch. LogService and TN consume historical shutdown
commands while continuing to handle sibling commands and retaining
existing TN batch acknowledgement.

HAKeeper selects one ordinary membership change per shard from valid
reports. Fresh and retried changes require a retained reporting voter
and a majority in the current and projected configurations. Configured
replicas can still be started to restore quorum. A Start can reopen
existing Raft files when the replica is authorized. An orphaned initial
bootstrap retains its exact manifest, and a newer removal prevents the
old identity from restarting. Pending local replicas keep their metadata
and exported snapshots while cleanup observes their ownership. Catalog
permits retain thei

**File**: `cmd/mo-service/main.go` (modified, +1/-3)
```diff
@@ -312,7 +312,7 @@ func startService(
 	case metadata.ServiceType_CN:
 		return startCNService(cfg, stopper, fs, gossipNode)
 	case metadata.ServiceType_TN:
-		return startTNService(cfg, stopper, fs, shutdownC)
+		return startTNService(cfg, stopper, fs)
 	case metadata.ServiceType_LOG:
 		return startLogService(cfg, stopper, fs, shutdownC)
 	case metadata.ServiceType_PYTHON_UDF:
@@ -457,7 +457,6 @@ func startTNService(
 	cfg *Config,
 	stopper *stopper.Stopper,
 	fileService fileservice.FileService,
-	shutdownC chan struct{},
 ) error {
 	if err := waitClusterCondition(cfg.mustGetServiceUUID(), cfg.HAKeeperClient, waitHAKeeperRunning); err != nil {
 		return err
@@ -497,7 +496,6 @@ func startTNService(
 			&c,
 			mustGetRuntime(cfg),
 			fileService,
-			shutdownC,
 			func(value tnservice.Service) {
 				owner = value
 			},
```

**File**: `pkg/embed/operator.go` (modified, +0/-1)
```diff
@@ -355,7 +355,6 @@ func (op *operator) startTNServiceAfterReadyLocked(
 		&c,
 		op.reset.rt,
 		fs,
-		op.reset.shutdownC,
 		func(owner tnservice.Service) { op.reset.svc = owner },
 		tnservice.WithConfigData(commonConfigKVMap),
 	)
```

**File**: `pkg/hakeeper/bootstrap_partial_33008_test.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
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
+package hakeeper
+
+import (
+	"testing"
+
+	sm "github.com/lni/dragonboat/v4/statemachine"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/stretchr/testify/require"
+)
+
+func TestBootstrapCommandSurvivesPartialInitialMembership(t *testing.T) {
+	const store = "c"
+	machine := NewStateMachine(0, 1).(*stateMachine)
+	// Three initial AddNode entries are applied individually. The existing
+	// CheckBootstrap accepts two reported members as enough to enter Running.
+	machine.state.State = pb.HAKeeperRunning
+	machine.state.LogState.Shards[1] = pb.LogShardInfo{
+		ShardID: 1, Epoch: 2, Replicas: map[uint64]string{1: "a", 2: "b"},
+	}
+	start := pb.ScheduleCommand{UUID: store, ServiceType: pb.LogService, Bootstrapping: true,
+		ConfigChange: &pb.ConfigChange{ChangeType: pb.StartReplica,
+			Replica:        pb.Replica{UUID: store, ShardID: 1, ReplicaID: 3},
+			InitialMembers: map[uint64]string{1: "a", 2: "b", 3: store}}}
+	machine.state.ScheduleCommands[store] = pb.CommandBatch{Commands: []pb.ScheduleCommand{start}}
+	data, err := (&pb.LogStoreHeartbeat{UUID: store}).Marshal()
+	require.NoError(t, err)
+	_, err = machine.Update(sm.Entry{Cmd: GetLogStoreHeartbeatCmd(data)})
+	require.NoError(t, err)
+	require.Equal(t, []pb.ScheduleCommand{start}, machine.state.ScheduleCommands[store].Commands,
+		"a not-yet-applied initial member is not an obsolete member")
+}
```

**File**: `pkg/hakeeper/checkers/bootstrap_prefix_kill_test.go` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
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
+package checkers
+
+import (
+	"bytes"
+	"maps"
+	"slices"
+	"testing"
+
+	sm "github.com/lni/dragonboat/v4/statemachine"
+	"github.com/matrixorigin/matrixone/pkg/hakeeper"
+	"github.com/matrixorigin/matrixone/pkg/hakeeper/bootstrap"
+	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/util"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/stretchr/testify/require"
+)
+
+func TestInitialPrefixCannotRetireFutureVoter(t *testing.T) {
+	t.Run("initial_cluster", func(t *testing.T) { testInitialPrefixCannotRetireFutureVoter(t, false) })
+	t.Run("dynamic", func(t *testing.T) { testInitialPrefixCannotRetireFutureVoter(t, true) })
+}
+
+func testInitialPrefixCannotRetireFutureVoter(t *testing.T, dynamic bool) {
+	t.Helper()
+	shardID := uint64(1)
+	if dynamic {
+		shardID = 77
+	}
+	cfg := hakeeper.Config{}
+	cfg.Fill()
+	s := hakeeper.NewStateMachine(0, 1)
+	var index uint64
+	apply := func(cmd []byte) sm.Result {
+		t.Helper()
+		index++
+		res, err := s.Update(sm.Entry{Index: index, Cmd: cmd})
+		require.NoError(t, err)
+		return res
+	}
+	heartbeat := func(uuid string, replicas ...pb.LogReplicaInfo) pb.CommandBatch {
+		t.Helper()
+		hb := pb.LogStoreHeartbeat{UUID: uuid, TaskServiceCreated: true, StoreIncarnation: "disk-" + uuid, Replicas: replicas}
+		data, err := hb.Marshal()
+		require.NoError(t, err)
+		result := apply(hakeeper.GetGuardedLogStoreHeartbeatCmd(data))
+		var batch pb.CommandBatch
+		require.NoError(t, batch.Unmarshal(result.Data))
+		return batch
+	}
+	state := func() *pb.CheckerState {
+		t.Helper()
+		value, err := s.Lookup(&hakeeper.StateQuery{Scheduling: true})
+		require.NoError(t, err)
+		return value.(*pb.CheckerState)
+	}
+	check := func() []pb.ScheduleCommand {
+		return NewCoordinator("", cfg).Check(util.NewTestIDAllocator(100), *state(), false)
+	}
+	apply(hakeeper.GetInitialClusterRequestCmd(1, 1, 3, 0, nil, nil))
+	apply(hakeeper.GetTickCmdWithLogStorePolicy(1, cfg.LogStoreTimeoutTicks()))
+	ha := pb.LogShardInfo{ShardID: 0, Epoch: 3, Replicas: map[uint64]string{1: "a", 2: "b", 3: "c"}}
+	for id, uuid := range ha.Replicas {
+		heartbeat(uuid, pb.LogReplicaInfo{LogShardInfo: ha, ReplicaID: id})
+	}
+	var approved []pb.ScheduleCommand
+	var members map[uint64]string
+	if dynamic {
+		apply(hakeeper.GetSetStateCmd(pb.HAKeeperBootstrapCommandsReceived))
+		apply(hakeeper.GetSetStateCmd(pb.HAKeeperRunning))
+		apply(hakeeper.GetAddLogShardCmd(pb.AddLogShard{ShardID: shardID}))
+		approved = check()
+		require.Len(t, approved, 3)
+		require.NotNil(t, approved[0].BootstrapShard)
+		members = approved[0].BootstrapShard.InitialMembers
+	} else {
+		current := state()
+		var err error
+		approved, err = bootstrap.NewBootstrapManager(current.ClusterInfo).
+			Bootstrap("", util.NewTestIDAllocator(100), current.TNState, current.LogState)
+		require.NoError(t, err)
+		require.Len(t, approved, 3)
+		require.True(t, approved[0].Bootstrapping)
+		members = approved[0].ConfigChange.InitialMembers
+	}
+	ids := slices.Sorted(maps.Keys(members))
+	a, b, c := members[ids[0]], members[ids[1]], members[ids[2]]
+	apply(hakeeper.GetUpdateCommandsCmd(1, approved))
+
+	first := pb.LogShardInfo{ShardID: shardID, Epoch: 1, Replicas: map[uint64]string{ids[0]: a}}
+	majority := pb.LogShardInfo{ShardID: shardID, Epoch: 2, Replicas: map[uint64]string{ids[0]: a, ids[1]: b}}
+	localBeforeOwnAdd := pb.LogReplicaInfo{LogShardInfo: first, ReplicaID: ids[2]}
+	heartbeat(a, pb.LogReplicaInfo{LogShardInfo: majority, ReplicaID: ids[0]})
+	heartbeat(b, pb.LogReplicaInfo{LogShardInfo: majority, ReplicaID: ids[1]})
+	heartbeat(c, localBeforeOwnAdd)
+	if !dynamic {
+		current := state()
+		require.True(t, bootstrap.NewBootstrapManager(current.ClusterInfo).CheckBootstrap(current.LogState),
+			"initial cluster can enter Running on the first majority")
+		apply(hakeeper.GetSetStateCmd(pb.HAKeeperRunning))
+	}
+	var kill pb.ScheduleCommand
+	for _, cmd := range check() {
+		if cmd.UUID == c && cmd.ConfigChange != nil && cmd.ConfigChange.ChangeType == pb.KillZombie {
+			kill = cmd
+		}
+	}
+	require.NotNil(t, kill.ConfigChange, "the real checker can classify a report that precedes its own initial AddNode as a zombie")
+	require.Equal(t, ids[2], kill.ConfigChange.Replica.ReplicaID)
+	apply(hakeeper.GetUpdateCommandsCmd(2, []pb.ScheduleCommand{kill}))
+
+	var saved bytes.Buffer
+	require.
```

**File**: `pkg/hakeeper/checkers/bootstrap_start_ownership_test.go` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
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
+package checkers
+
+import (
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/hakeeper"
+	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/util"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/stretchr/testify/require"
+)
+
+func TestBootstrapOwnsUnreportedReplicaStart(t *testing.T) {
+	c := NewCoordinator("", hakeeper.Config{})
+	alloc := util.NewTestIDAllocator(100)
+	state := pb.CheckerState{Tick: 1,
+		ClusterInfo: pb.ClusterInfo{LogShards: []metadata.LogShardRecord{{ShardID: 1, NumberOfReplicas: 3}}},
+		LogState: pb.LogState{Shards: map[uint64]pb.LogShardInfo{1: {ShardID: 1, Replicas: map[uint64]string{}}}, Stores: map[string]pb.LogStoreInfo{
+			"a": {Tick: 1, TaskServiceCreated: true}, "b": {Tick: 1, TaskServiceCreated: true}, "c": {Tick: 1, TaskServiceCreated: true},
+		}},
+	}
+	first := c.Check(alloc, state, false)
+	var bootstrap []pb.ScheduleCommand
+	for _, cmd := range first {
+		if cmd.BootstrapShard != nil {
+			bootstrap = append(bootstrap, cmd)
+		}
+	}
+	require.Len(t, bootstrap, 3, "the first real scheduling round must bootstrap all replicas")
+	shard := pb.LogShardInfo{ShardID: 1, Epoch: 1, Replicas: bootstrap[0].BootstrapShard.InitialMembers}
+	state.LogState.Shards[1] = shard
+	var missing pb.ScheduleCommand
+	for i, cmd := range bootstrap {
+		if i == 0 {
+			missing = cmd
+			continue
+		}
+		store := state.LogState.Stores[cmd.UUID]
+		store.Replicas = []pb.LogReplicaInfo{{LogShardInfo: shard, ReplicaID: cmd.BootstrapShard.ReplicaID}}
+		state.LogState.Stores[cmd.UUID] = store
+	}
+	second := c.Check(alloc, state, false)
+	t.Logf("unreported bootstrap store=%s id=%d commands=%+v", missing.UUID, missing.BootstrapShard.ReplicaID, second)
+	for _, cmd := range second {
+		if cmd.ConfigChange != nil && cmd.ConfigChange.Replica.ReplicaID == missing.BootstrapShard.ReplicaID {
+			require.NotEqual(t, pb.StartReplica, cmd.ConfigChange.ChangeType, "an in-flight bootstrap already owns this local start")
+			require.NotEqual(t, pb.RemoveReplica, cmd.ConfigChange.ChangeType)
+		}
+	}
+}
+
+func TestFreshCoordinatorReplansMembershipAndIndependentTNWork(t *testing.T) {
+	// Initialize and restore the TN checker's service runtime around this test.
+	_, _, _ = tnStartScenario(t)
+	cfg := hakeeper.Config{TickPerSecond: 1, LogStoreTimeout: 5 * time.Second}
+	shard := pb.LogShardInfo{ShardID: 1, Epoch: 7, Replicas: map[uint64]string{1: "a", 2: "b", 3: "c"}}
+	state := pb.CheckerState{
+		Tick:          10,
+		ClusterInfo:   pb.ClusterInfo{LogShards: []metadata.LogShardRecord{{ShardID: 1, NumberOfReplicas: 3}}},
+		TaskTableUser: pb.TaskTableUser{Username: "task"},
+		LogState: pb.LogState{Shards: map[uint64]pb.LogShardInfo{1: shard}, Stores: map[string]pb.LogStoreInfo{
+			"a": {Tick: 10, TaskServiceCreated: true, Replicas: []pb.LogReplicaInfo{{LogShardInfo: shard, ReplicaID: 1}}},
+			"b": {Tick: 1, TaskServiceCreated: true, Replicas: []pb.LogReplicaInfo{{LogShardInfo: shard, ReplicaID: 2}}},
+			"c": {Tick: 10, TaskServiceCreated: true, Replicas: []pb.LogReplicaInfo{{LogShardInfo: shard, ReplicaID: 3}}},
+		}},
+		TNState: pb.TNState{Stores: map[string]pb.TNStoreInfo{"tn": {Tick: 10}}},
+	}
+	check := func() (bool, bool) {
+		commands := NewCoordinator("", cfg).Check(util.NewTestIDAllocator(100), state, false)
+		var remove, tnTask bool
+		for _, cmd := range commands {
+			if cmd.ConfigChange != nil && cmd.ConfigChange.ChangeType == pb.RemoveReplica && cmd.ConfigChange.Replica.UUID == "b" {
+				remove = true
+			}
+			if cmd.UUID == "tn" && cmd.CreateTaskService != nil {
+				tnTask = true
+			}
+		}
+		return remove, tnTask
+	}
+	remove, tnTask := check()
+	require.True(t, remove, "the current plan should remove the expired voter")
+	require.True(t, tnTask, "unrelated TN work must remain in the new batch")
+	b := state.LogState.Stores["b"]
+	b.Tick = state.Tick
+	state.LogState.Stores["b"] = b
+	remove, tnTask = check()
+	require.False(t, remove, "a recovered voter is no longer a removal candidate")
+	require.True(t, tnTask)
+}
```

**File**: `pkg/hakeeper/checkers/coordinator.go` (modified, +2/-38)
```diff
@@ -22,7 +22,6 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/cnservice"
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/logservice"
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/proxy"
-	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/syshealth"
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/tnservice"
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/checkers/util"
 	"github.com/matrixorigin/matrixone/pkg/hakeeper/operator"
@@ -34,11 +33,6 @@ import (
 type Coordinator struct {
 	OperatorController *operator.Controller
 
-	// Considering the context of `Coordinator`,
-	// there is no need for a mutext to protect.
-	teardown    bool
-	teardownOps []*operator.Operator
-
 	service string
 	cfg     hakeeper.Config
 }
@@ -71,38 +65,8 @@ func (c *Coordinator) Check(alloc util.IDAllocator, state pb.CheckerState, stand
 		zap.Uint64("current tick", currentTick),
 	)
 
-	defer func() {
-		if !c.teardown {
-			runtime.ServiceRuntime(c.service).Logger().Debug("MO is working.")
-		}
-	}()
-
 	c.OperatorController.RemoveFinishedOperator(logState, tnState, cnState, proxyState)
 
-	// if we've discovered unhealthy already, no need to keep alive anymore.
-	if c.teardown {
-		return c.OperatorController.Dispatch(c.teardownOps, logState, tnState, cnState, proxyState)
-	}
-
-	// check whether system health or not.
-	if operators, health := syshealth.Check(c.cfg, cluster, tnState, logState, currentTick); !health {
-		// TN starts have a report/target lifetime. Teardown ends their ownership
-		// before ordinary checks stop running.
-		for _, record := range cluster.TNShards {
-			for _, op := range slices.Clone(c.OperatorController.GetOperators(record.ShardID)) {
-				if steps := op.OpSteps(); len(steps) == 1 {
-					if _, ok := steps[0].(operator.AddTnReplica); ok {
-						c.OperatorController.RemoveOperator(op)
-					}
-				}
-			}
-		}
-		c.teardown = true
-		c.teardownOps = operators
-		return c.OperatorController.Dispatch(c.teardownOps, logState, tnState, cnState, proxyState)
-	}
-
-	// system health, try to keep alive.
 	executing := c.OperatorController.GetExecutingReplicas()
 	executingNonVoting := c.OperatorController.GetNonVotingExecutingReplicas()
 
@@ -141,11 +105,11 @@ func (c *Coordinator) Check(alloc util.IDAllocator, state pb.CheckerState, stand
 			shardIDs = append(shardIDs, shard.ShardID)
 		}
 		slices.Sort(shardIDs)
-		var existing []*operator.Operator
+		existing := make([]*operator.Operator, 0, len(shardIDs))
 		for _, shardID := range slices.Compact(shardIDs) {
 			existing = append(existing, c.OperatorController.GetOperators(shardID)...)
 		}
-		pending := logservice.PendingOperators(commonFields, logState, state.NonVotingReplicaNum, existing)
+		pending := logservice.PendingOperators(commonFields, logState, executing, executingNonVoting, state.NonVotingReplicaNum, state.NonVotingLocality, existing)
 		operators = append(pending, operators...)
 	}
 	return c.OperatorController.Dispatch(operators, logState, tnState, cnState, proxyState)
```

**File**: `pkg/hakeeper/checkers/coordinator_test.go` (modified, +14/-14)
```diff
@@ -347,7 +347,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 4,
+							ReplicaID: 4, IsNonVoting: true,
 						}},
 					},
 					"e": {
@@ -359,7 +359,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 5,
+							ReplicaID: 5, IsNonVoting: true,
 						}},
 					},
 					"f": {
@@ -371,7 +371,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 6,
+							ReplicaID: 6, IsNonVoting: true,
 						}},
 					},
 				},
@@ -407,7 +407,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 2,
+							ReplicaID: 1,
 						}},
 					},
 					"b": {
@@ -443,7 +443,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 4,
+							ReplicaID: 4, IsNonVoting: true,
 						}},
 					},
 					"e": {
@@ -455,7 +455,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 5,
+							ReplicaID: 5, IsNonVoting: true,
 						}},
 					},
 					"f": {Tick: 0, Replicas: []pb.LogReplicaInfo{}},
@@ -539,7 +539,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 4,
+							ReplicaID: 4, IsNonVoting: true,
 						}},
 					},
 					"e": {
@@ -551,7 +551,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 5,
+							ReplicaID: 5, IsNonVoting: true,
 						}},
 					},
 					"f": {
@@ -563,7 +563,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e", 6: "f"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 6,
+							ReplicaID: 6, IsNonVoting: true,
 						}},
 					},
 				},
@@ -611,7 +611,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 2,
+							ReplicaID: 1,
 						}},
 					},
 					"b": {
@@ -647,7 +647,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 3,
+							ReplicaID: 4, IsNonVoting: true,
 						}},
 					},
 					"e": {
@@ -659,7 +659,7 @@ func TestFixExpiredStore(t *testing.T) {
 								NonVotingReplicas: map[uint64]string{4: "d", 5: "e"},
 								Epoch:             1,
 								LeaderID:          1},
-							ReplicaID: 3,
+							ReplicaID: 5, IsNonVoting: true,
 						}},
 					},
 					"f": {
@@ -766,7 +766,7 @@ func TestFixZombie(t *testing.T) {
 								Replicas: map[uint64]string{1: "a", 2: "b", 4: "d"},
 								Epoch:    2,
 								LeaderID: 1},
-							ReplicaID: 3,
+							ReplicaID: 4,
 						}},
 					},
 				},
@@ -843,7 +843,7 @@ func TestFixZombie(t *testing.T) {
 								Replicas: map[uint64]string{1: "a", 2: "b", 4: "d"},
 								Epoch:    2,
 								LeaderID: 1},
-							ReplicaID: 3,
+							ReplicaID: 4,
 						}},
 					},
 				},
```

**File**: `pkg/hakeeper/checkers/coordinator_tn_test.go` (modified, +139/-15)
```diff
@@ -216,7 +216,7 @@ func TestTNStartReservationsAndPartialReports(t *testing.T) {
 	require.Len(t, c.OperatorController.GetOperators(3), 1)
 }
 
-func TestTNStartRebuildAndTeardown(t *testing.T) {
+func TestTNStartRebuildAndRecovery(t *testing.T) {
 	c, state, alloc := tnStartScenario(t)
 	first := c.Check(alloc, state, false)
 	require.Len(t, first, 1)
@@ -237,26 +237,23 @@ func TestTNStartRebuildAndTeardown(t *testing.T) {
 	state.TNState.Stores["tn-a"] = info
 	require.Empty(t, stale.Check(alloc, state, false))
 	require.Empty(t, stale.OperatorController.GetOperators(2))
-	// Keep this coordinator's start unfinished when entering teardown.
+	// A temporary shortage of Log replica reports leaves the TN start in flight.
 	info.Shards = nil
 	state.TNState.Stores["tn-a"] = info
 	pending := c.OperatorController.GetOperators(2)[0]
-	// Expired majority forces the actual syshealth teardown branch.
 	state.ClusterInfo.LogShards = []metadata.LogShardRecord{{ShardID: 1, NumberOfReplicas: 3}}
 	state.LogState = pb.LogState{Stores: map[string]pb.LogStoreInfo{}}
 	for i, id := range []string{"log-a", "log-b"} {
 		state.LogState.Stores[id] = pb.LogStoreInfo{Replicas: []pb.LogReplicaInfo{{LogShardInfo: pb.LogShardInfo{ShardID: 1}, ReplicaID: uint64(i + 1)}}}
 	}
-	for i := 0; i < 2; i++ {
-		commands := c.Check(alloc, state, false)
-		require.NotEmpty(t, commands)
-		for _, cmd := range commands {
-			require.Nil(t, cmd.ConfigChange)
-			require.NotNil(t, cmd.ShutdownStore)
-		}
-		require.Empty(t, c.OperatorController.GetOperators(2))
-		require.Equal(t, operator.CANCELED, pending.Status())
+	for _, cmd := range c.Check(alloc, state, false) {
+		require.Nil(t, cmd.ShutdownStore)
 	}
+	require.Same(t, pending, c.OperatorController.GetOperators(2)[0])
+	info.Shards = []pb.TNShardInfo{{ShardID: 2, ReplicaID: restarted[0].ConfigChange.Replica.ReplicaID}}
+	state.TNState.Stores["tn-a"] = info
+	c.Check(alloc, state, false)
+	require.Empty(t, c.OperatorController.GetOperators(2))
 }
 
 func TestTNRetryPreservesPendingLogStart(t *testing.T) {
@@ -288,6 +285,12 @@ func TestTNRetryPreservesPendingLogStart(t *testing.T) {
 				require.NoError(t, err)
 				return r
 			}
+			// The delivery RSM must observe the same membership as the checker.
+			for _, id := range []string{"a", "b"} {
+				report, err := (&pb.LogStoreHeartbeat{UUID: id, Replicas: state.LogState.Stores[id].Replicas}).Marshal()
+				require.NoError(t, err)
+				apply(hakeeper.GetLogStoreHeartbeatCmd(report))
+			}
 			first := coordinator.Check(alloc, state, false)
 			var logStart *pb.ScheduleCommand
 			for i := range first {
@@ -297,14 +300,17 @@ func TestTNRetryPreservesPendingLogStart(t *testing.T) {
 				}
 			}
 			require.NotNil(t, logStart, "fixture must schedule the actual missing log replica")
-			t.Logf("first batch: %+v", first)
+			confirmedStart := *logStart
+			change := *logStart.ConfigChange
+			change.Replica.Epoch = shard.Epoch
+			confirmedStart.ConfigChange = &change
 			apply(hakeeper.GetUpdateCommandsCmd(1, first))
 			hb, err := (&pb.LogStoreHeartbeat{UUID: "c"}).Marshal()
 			require.NoError(t, err)
 			if tt.consumed {
 				var original pb.CommandBatch
 				require.NoError(t, original.Unmarshal(apply(hakeeper.GetLogStoreHeartbeatCmd(hb)).Data))
-				require.Contains(t, original.Commands, *logStart)
+				require.Contains(t, original.Commands, confirmedStart)
 			}
 			state.Tick++
 			second := coordinator.Check(alloc, state, false)
@@ -315,7 +321,7 @@ func TestTNRetryPreservesPendingLogStart(t *testing.T) {
 			var received pb.CommandBatch
 			require.NoError(t, received.Unmarshal(apply(hakeeper.GetLogStoreHeartbeatCmd(hb)).Data))
 			t.Logf("log heartbeat commands: %+v", received.Commands)
-			require.Contains(t, received.Commands, *logStart, "a TN-only retry must not erase an unrelated undelivered log start")
+			require.Contains(t, received.Commands, confirmedStart, "a TN-only retry must not erase an unrelated undelivered log start")
 			// A real report ends the retained Log intent, even while TN still retries.
 			store := state.LogState.Stores["c"]
 			store.Replicas = []pb.LogReplicaInfo{{LogShardInfo: shard, ReplicaID: 3}}
@@ -346,3 +352,121 @@ func TestTNRetryDoesNotResurrectObsoleteRemoval(t *testing.T) {
 	require.Equal(t, first, next)
 	require.Equal(t, operator.STARTED, old.Status())
 }
+
+func TestCoordinatorRepairsAfterMissingReplicaReport(t *testing.T) {
+	c, state, alloc := tnStartScenario(t)
+	state.Tick = 10000
+	state.TNState.Stores["tn-a"] = pb.TNStoreInfo{Tick: state.Tick, TaskServiceCreated: true}
+	state.ClusterInfo.LogShards = []metadata.LogShardRecord{
+		{ShardID: 0, NumberOfReplicas: 3}, {ShardID: 1, NumberOfReplicas: 3},
+	}
+	members := map[uint64]string{1: "log-a", 2: "log-b", 3: "log-c"}
+	data := pb.LogShardInfo{ShardID: 1, Replicas: members, LeaderID: 1, Epoch: 1}
+	control := pb.LogShardInfo{Replicas: members, LeaderID: 1, Epoch: 1}
+	state.LogState = pb.LogState{
+		Shards: map[uint64]pb.LogShardIn
```

#### Recent Merged Pull Requests:
- **PR #33433** (2026-11-28): [4.2-dev] test: stabilize cross-CN publication lock assertions (@XuPeng-SH)
- **PR #33432** (2026-11-28): ci: use S3-only PR Coverage and expose manual OSS COS checks (@XuPeng-SH)
- **PR #33431** (2026-11-28): ci: roll out the narrowed CS S3 Coverage smoke (@XuPeng-SH)
- **PR #33430** (2026-11-28): ci: pin Coverage standby to merged CI #499 (@Ariznawlll)
- **PR #33426** (closed): fix(compile): metadata MIN/MAX and merge-group codec through shared type functions (#10181) (@fengttt)
- **PR #33425** (2026-11-28): Assign code owners for thirdparties/sirius (@zuyu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
