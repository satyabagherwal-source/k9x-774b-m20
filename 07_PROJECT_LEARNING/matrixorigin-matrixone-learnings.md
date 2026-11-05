> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `3d54f0c1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T01:33:31.382Z  
> **Learning ID**: `learn-github-matrixorigin-matrixone`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T01:33:31.375Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2062 stars

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
- **Issue #32194** (2026-11-05): **fix(hnsw): a CDC batch keeps the sign of -0 on every architecture**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #32193  ## What this PR does / why we need it:  An HNSW CDC batch (`VectorIndexCdc`) lost the sign of a `-0` vector element. sonic writes `-0` as `0` on arm64, and reads `-0` as `0` on every architecture, which float64 batches still went through. A synced vector holding `-0` was stored as `+0`.  Float32 and float64 batches are now encoded and decoded with `encoding/json`, as float32 decoding already was. Integer element types keep sonic.  Validation: - `TestVectorIndexCdcFloat32RoundTrip` passes on darwin/arm64, where it failed on main (`entry 0 value 7 (-0)`). - The same test now checks a float64 `-0` too; that check fails without the fix on every architecture, because sonic decodes `-0` as `0`. - `pkg/vectorindex` and `pkg/iscp` pass; lint is clean.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #32191** (2026-11-04): **fix(hashbuild): bound collected runtime-filter keys**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [x] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #30125.  ## What this PR does / why we need it:  HashBuild currently collects runtime-filter keys into one growing vector per key component. These vectors span the entire build and can reach the single-allocation ceiling independently of retained join batches.  Collect keys in aligned batches of at most 8,192 rows, splitting earlier at actual payload and encoding byte limits. Preserve component slots and leave uniqueness decisions to the hash table. Admit chunk-directory storage before allocation and restore the previous tail after an append failure. Join rollback failures with the original error, finish remaining cleanup, and discard invalid collections rather than retrying or publishing partially restored keys.  Preserve the ordinary IN wire format and single-chunk fast path. Encode fixed-width runs directly into the final admitted buffer and sort there. For variable-width runs, bulk-copy each area once and merge/rebase the sorted descriptors, preserving shared values without a whole-build temporary vector or per-key payload copies. Evaluate composite-key expressions per aligned batch with reusable executors.  Publish membership keys as one complete, immutable, reference-counted chunked payload. Retain ownership through compiler receipt and lazy-reader lifetimes, and consume all chu

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

### Incident Patch 1: `948cfbc1` (2026-11-04)
**Commit Message**: fix(vector): return append rollback failures instead of panicking (#32167)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to issue #32143. This contains allocation-error handling; it does not make oversized allocations succeed.

## What this PR does / why we need it:

An allocation refusal must remain a returned query error, even when append cleanup cannot restore its checkpoint. RollbackAppend currently panics on invalid checkpoint bounds or missing restoration metadata, which can replace the original allocation error during failure cleanup.

Make RollbackAppend return a terminal allocation-invariant error instead of panicking. Validate restoration bounds and attempted-row arithmetic before mutation, and retain owned capacity for eventual Free. Preserve the original error object unchanged when rollback succeeds; retain both causes when rollback fails so invariant failures cannot be treated as retryable memory pressure.

Update every production rollback caller to propagate the result, including retained join batches, MergeTop, Order, mult

**File**: `pkg/container/vector/rollback_error_test.go` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
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
+package vector
+
+import (
+	"errors"
+	"math"
+	"strings"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/stretchr/testify/require"
+)
+
+func TestRollbackAppendRejectsBeforeMutation(t *testing.T) {
+	for _, name := range []string{"length", "area", "negative", "overflow", "prepared", "string", "binary"} {
+		t.Run(name, func(t *testing.T) {
+			mp := mpool.MustNewZero()
+			v := NewVec(types.T_varchar.ToType())
+			defer func() { v.Free(mp); require.Zero(t, mp.CurrNB()); require.Zero(t, mp.OnHeapCurrNB()) }()
+			require.NoError(t, AppendBytes(v, []byte(strings.Repeat("a", 64)), false, mp))
+			v.SetSorted(true)
+			cp := v.MakeAppendCheckpoint()
+			attempted := 1
+			switch name {
+			case "length":
+				cp.length++
+			case "area":
+				cp.areaLength++
+			case "negative":
+				attempted = -1
+			case "overflow":
+				attempted = math.MaxInt
+			case "prepared":
+				cp.hadPrepareParamKinds = true
+			case "string":
+				cp.hadStringSources = true
+			case "binary":
+				cp.hadBinaryStringRows = true
+			}
+			err := v.RollbackAppend(cp, attempted)
+			require.ErrorIs(t, err, mpool.ErrAllocationAccountInvariant)
+			require.False(t, mpool.IsRetryableAllocationCapacity(errors.Join(mpool.ErrAllocationAccountCapacity, err)))
+			require.Equal(t, 1, v.Length())
+			require.Equal(t, 64, len(v.GetArea()))
+			require.True(t, v.GetSorted())
+			require.Equal(t, strings.Repeat("a", 64), v.GetStringAt(0))
+		})
+	}
+}
+
+func TestAppendAllocatorLimitReturnsErrorAndKeepsPrefix(t *testing.T) {
+	old := mpool.CapLimit
+	mpool.CapLimit = 128
+	t.Cleanup(func() { mpool.CapLimit = old })
+	mp := mpool.MustNewZero()
+	v := NewVec(types.T_varchar.ToType())
+	defer func() { v.Free(mp); require.Zero(t, mp.CurrNB()); require.Zero(t, mp.OnHeapCurrNB()) }()
+	first := strings.Repeat("a", 64)
+	require.NoError(t, AppendBytes(v, []byte(first), false, mp))
+	err := AppendBytes(v, []byte(strings.Repeat("b", 64)), false, mp)
+	require.ErrorIs(t, err, mpool.ErrAllocationAllocatorLimit)
+	require.NotErrorIs(t, err, mpool.ErrAllocationAccountInvariant)
+	require.Equal(t, 1, v.Length())
+	require.Equal(t, first, v.GetStringAt(0))
+}
```

**File**: `pkg/container/vector/vector.go` (modified, +44/-26)
```diff
@@ -18,6 +18,7 @@ import (
 	"bytes"
 	"cmp"
 	"encoding/binary"
+	"errors"
 	"fmt"
 	"io"
 	"math"
@@ -483,14 +484,37 @@ func (v *Vector) MakeAppendCheckpoint() AppendCheckpoint {
 	}
 }
 
-// RollbackAppend restores the logical state captured before an attempted
-// append. attemptedRows is needed because grouping bits can be published
-// before a varlen copy fails and advances length.
-func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int) {
-	if checkpoint.length < 0 || checkpoint.length > v.length ||
+// JoinAppendRollbackError preserves a successful rollback's original error
+// identity, including direct MO errors used at protocol boundaries.
+func JoinAppendRollbackError(cause, rollbackErr error) error {
+	if rollbackErr == nil {
+		return cause
+	}
+	return errors.Join(cause, rollbackErr)
+}
+
+// RollbackAppend restores an append checkpoint, retaining owned capacity.
+// Invalid checkpoints return a terminal invariant error before any mutation.
+// attemptedRows includes metadata published before a payload append failed.
+func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int) error {
+	invalid := func(message string) error {
+		return errors.Join(mpool.ErrAllocationAccountInvariant, moerr.NewInternalErrorNoCtx(message))
+	}
+	if v == nil || checkpoint.length < 0 || checkpoint.length > v.length ||
 		checkpoint.areaLength < 0 || checkpoint.areaLength > len(v.area) ||
-		attemptedRows < 0 {
-		panic("invalid vector append checkpoint")
+		attemptedRows < 0 || attemptedRows > math.MaxInt-checkpoint.length {
+		return invalid("invalid vector append checkpoint")
+	}
+	// Validate the complete restoration before changing lengths or metadata.
+	if checkpoint.hadPrepareParamKinds && len(v.prepareParamKinds) < checkpoint.length {
+		return invalid("prepared parameter sidecar lost during append rollback")
+	}
+	metadataLength := v.physicalMetadataRowCountForLength(checkpoint.length)
+	if checkpoint.hadStringSources && len(v.stringSources) < metadataLength {
+		return invalid("string source sidecar lost during append rollback")
+	}
+	if checkpoint.hadBinaryStringRows && !(!v.binaryStringRowsActive && checkpoint.binaryStringRowsUniform) && (v.binaryStringRows == nil || !v.binaryStringRowsActive) {
+		return invalid("binary-string sidecar lost during append rollback")
 	}
 	end := max(v.length, checkpoint.length+attemptedRows)
 	nulls.RemoveRange(&v.nsp, uint64(checkpoint.length), uint64(end))
@@ -502,9 +526,6 @@ func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int)
 	v.areaDisjoint = checkpoint.areaDisjoint && v.areaDisjoint
 	v.sorted = checkpoint.sorted
 	if checkpoint.hadPrepareParamKinds {
-		if len(v.prepareParamKinds) < checkpoint.length {
-			panic("prepared parameter sidecar lost during append rollback")
-		}
 		clear(v.prepareParamKinds[checkpoint.length:])
 		v.prepareParamKinds = v.prepareParamKinds[:checkpoint.length]
 	} else {
@@ -514,9 +535,6 @@ func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int)
 	v.prepareParamKindSeen = checkpoint.prepareParamKindSeen
 	if checkpoint.hadStringSources {
 		metadataLength := v.physicalMetadataRowCountForLength(checkpoint.length)
-		if len(v.stringSources) < metadataLength {
-			panic("string source sidecar lost during append rollback")
-		}
 		clear(v.stringSources[metadataLength:])
 		v.stringSources = v.stringSources[:metadataLength]
 	} else {
@@ -526,8 +544,6 @@ func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int)
 	if checkpoint.hadBinaryStringRows {
 		if !v.binaryStringRowsActive && checkpoint.binaryStringRowsUniform {
 			v.setBinaryStringScalar(checkpoint.binaryString)
-		} else if v.binaryStringRows == nil || !v.binaryStringRowsActive {
-			panic("binary-string sidecar lost during append rollback")
 		} else {
 			v.binaryStringRows.RemoveRange(uint64(checkpoint.length), uint64(end))
 			v.textStringRows.RemoveRange(uint64(checkpoint.length), uint64(end))
@@ -536,6 +552,7 @@ func (v *Vector) RollbackAppend(checkpoint AppendCheckpoint, attemptedRows int)
 	} else {
 		v.setBinaryStringScalar(checkpoint.binaryString)
 	}
+	return nil
 }
 
 // Size of data, I think this function is inherently broken.  This
@@ -10142,7 +10159,7 @@ func AppendFixedWithStringSource[T any](vec *Vector, val T, isNull bool, source
 	checkpoint := vec.MakeAppendCheckpoint()
 	defer func() {
 		if err != nil {
-			vec.RollbackAppend(checkpoint, 1)
+			err = JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, 1))
 		}
 	}()
 	return appendOneFixedWithSource(vec, val, isNull, &source, mp)
@@ -10202,7 +10219,7 @@ func AppendBytesWithWriter(vec *Vector, size int, mp *mpool.MPool, writer func([
 	checkpoint := vec.MakeAppendCheckpoint()
 	defer func() {
 		if err != nil {
-			vec.RollbackAppend(checkpoint, 1)
+			err = JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, 1))
 		}
 	}()
 	if err = vec.prepareOrdinaryAppendMetadata(1, mp); e
```

**File**: `pkg/sql/colexec/external/parquet.go` (modified, +21/-21)
```diff
@@ -2274,7 +2274,7 @@ func (h *ParquetHandler) getMapperWithStaging(sc *parquet.Column, dt plan.Type,
 			}
 			checkpoint := vec.MakeAppendCheckpoint()
 			rollback := func(err error) error {
-				vec.RollbackAppend(checkpoint, numRows)
+				err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, numRows))
 				return err
 			}
 			targetType := types.MustTypeFromPlan(dt)
@@ -2937,7 +2937,7 @@ func processStringToTimeAssignment(mp *columnMapper, page parquet.Page, proc *pr
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	if err := vec.UnionBatch(result.GetResultVector(), 0, text.Length(), nil, proc.Mp()); err != nil {
-		vec.RollbackAppend(checkpoint, text.Length())
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, text.Length()))
 		return err
 	}
 	return nil
@@ -3017,7 +3017,7 @@ func processStringToFixedWithTrim[T any](
 	vec.SetLength(numRows + length)
 	ret := vector.MustFixedColWithTypeCheck[T](vec)
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, numRows)
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, numRows))
 		return err
 	}
 
@@ -3110,7 +3110,7 @@ func processStringToJson(
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, numRows)
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, numRows))
 		return err
 	}
 	for i := 0; i < numRows; i++ {
@@ -3217,7 +3217,7 @@ func processStringToArrayEnc[T types.ArrayElement](
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, numRows)
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, numRows))
 		return err
 	}
 	for i := 0; i < numRows; i++ {
@@ -3443,7 +3443,7 @@ func processParquetListValuesToArrayEnc[T types.ArrayElement](
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, numRows)
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, numRows))
 		return err
 	}
 
@@ -3575,7 +3575,7 @@ func processParquetValuesToFixed[T any](
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, len(values))
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, len(values)))
 		return err
 	}
 	for i, v := range values {
@@ -3626,7 +3626,7 @@ func processParquetValuesToBytes(
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, len(values))
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, len(values)))
 		return err
 	}
 	for i, v := range values {
@@ -3681,7 +3681,7 @@ func processParquetValuesToStagingBytes(
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, len(values))
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, len(values)))
 		return err
 	}
 	for i, v := range values {
@@ -3811,7 +3811,7 @@ func processParquetValuesToJson(
 	}
 	checkpoint := vec.MakeAppendCheckpoint()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, len(values))
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, len(values)))
 		return err
 	}
 	for i, v := range values {
@@ -4899,7 +4899,7 @@ func copyPlainBoolPageToVec(page parquet.Page, proc *process.Process, vec *vecto
 	ret := vector.MustFixedColWithTypeCheck[bool](vec)
 	reader := page.Values()
 	rollback := func(err error) error {
-		vec.RollbackAppend(checkpoint, n)
+		err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoint, n))
 		return err
 	}
 	if !nc.noNulls {
@@ -5624,7 +5624,9 @@ func (h *ParquetHandler) getDataByPage(bat *batch.Batch, param *ExternalParam, p
 				bat, length, length+int(toRead), batchBytesBefore, param)
 			accepted = int64(acceptedRows - length)
 			if accepted < toRead {
-				h.rollbackPageAppend(bat, checkpoints, int(toRead))
+				if rollbackErr := h.rollbackPageAppend(bat, checkpoints, int(toRead)); rollbackErr != nil {
+					return rollbackErr
+				}
 				warnings.Reset()
 				if accepted == 0 {
 					break
@@ -5755,8 +5757,7 @@ func (h *ParquetHandler) mapCurrentPageRows(
 	for i, colIdx := range h.dataColIndices {
 		vec := bat.Vecs[colIdx]
 		if vec == nil {
-			h.rollbackPageAppend(bat, checkpoints[:i], int(rows))
-			return nil, moerr.NewInternalErrorf(param.Ctx, "parquet output column %d is not allocated", colIdx)
+			return nil, vector.JoinAppendRollbackError(moerr.NewInternalErrorf(param.Ctx, "parquet output column %d is not allocated", colIdx), h.rollbackPageAppend(bat, checkpoints[:i], int(rows)))
 		}
 		checkpoints[i] = vec.MakeAppendCheckpoint()
 		startLength := vec.Length()
@@ -5768,14 +5769,12 @@ func (h *ParquetHandler) mapCurrentPageRows(
 			MapTime: time.Since(mapStart).Nanoseconds(),
```

**File**: `pkg/sql/colexec/external/parquet_nested.go` (modified, +18/-17)
```diff
@@ -182,18 +182,22 @@ func (h *ParquetHandler) getDataByRow(bat *batch.Batch, param *ExternalParam, pr
 			if err := h.processRow(row, bat, param, proc); err != nil {
 				for colIdx, vec := range bat.Vecs {
 					if vec != nil {
-						vec.RollbackAppend(checkpoints[colIdx], 1)
+						err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoints[colIdx], 1))
 					}
 				}
 				return err
 			}
 			if h.parquetBatchAtByteBudget(bat, rowsRead+1, param) {
 				if rowsRead > 0 {
+					var err error
 					for colIdx, vec := range bat.Vecs {
 						if vec != nil {
-							vec.RollbackAppend(checkpoints[colIdx], 1)
+							err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoints[colIdx], 1))
 						}
 					}
+					if err != nil {
+						return err
+					}
 					batchBoundary = true
 					break
 				}
@@ -269,12 +273,13 @@ func (h *ParquetHandler) getDataByRowAndPage(bat *batch.Batch, param *ExternalPa
 	eof := false
 	batchBoundary := false
 
-	rollbackRows := func(checkpoints []vector.AppendCheckpoint, attemptedRows int) {
+	rollbackRows := func(checkpoints []vector.AppendCheckpoint, attemptedRows int) (err error) {
 		for colIdx, vec := range bat.Vecs {
 			if vec != nil {
-				vec.RollbackAppend(checkpoints[colIdx], attemptedRows)
+				err = vector.JoinAppendRollbackError(err, vec.RollbackAppend(checkpoints[colIdx], attemptedRows))
 			}
 		}
+		return err
 	}
 
 	for length < batchLimit && !h.parquetBatchAtByteBudget(bat, length, param) {
@@ -344,17 +349,14 @@ func (h *ParquetHandler) getDataByRowAndPage(bat *batch.Batch, param *ExternalPa
 		batchBytesBefore := h.physicalBatchSize(bat)
 		for _, row := range rowBuf[:n] {
 			if err := context.Cause(proc.Ctx); err != nil {
-				rollbackRows(checkpoints, n)
-				return err
+				return vector.JoinAppendRollbackError(err, rollbackRows(checkpoints, n))
 			}
 			if err := h.processNestedRow(row, bat, param, proc); err != nil {
-				rollbackRows(checkpoints, n)
-				return err
+				return vector.JoinAppendRollbackError(err, rollbackRows(checkpoints, n))
 			}
 		}
 		if _, err := h.mapCurrentPageRows(bat, param, mappingProc, int64(n)); err != nil {
-			rollbackRows(checkpoints, n)
-			return h.closePagesOnError(param.Ctx, err)
+			return h.closePagesOnError(param.Ctx, vector.JoinAppendRollbackError(err, rollbackRows(checkpoints, n)))
 		}
 
 		accepted := n
@@ -366,26 +368,25 @@ func (h *ParquetHandler) getDataByRowAndPage(bat *batch.Batch, param *ExternalPa
 				accepted = 0
 			}
 			if accepted < n {
-				rollbackRows(checkpoints, n)
+				if rollbackErr := rollbackRows(checkpoints, n); rollbackErr != nil {
+					return rollbackErr
+				}
 				warnings.Reset()
 				if accepted > 0 {
 					for _, row := range rowBuf[:accepted] {
 						if err := h.processNestedRow(row, bat, param, proc); err != nil {
-							rollbackRows(checkpoints, accepted)
-							return err
+							return vector.JoinAppendRollbackError(err, rollbackRows(checkpoints, accepted))
 						}
 					}
 					if _, err := h.mapCurrentPageRows(bat, param, mappingProc, int64(accepted)); err != nil {
-						rollbackRows(checkpoints, accepted)
-						return h.closePagesOnError(param.Ctx, err)
+						return h.closePagesOnError(param.Ctx, vector.JoinAppendRollbackError(err, rollbackRows(checkpoints, accepted)))
 					}
 				}
 				// The row reader has already decoded n rows. Rewind the unread
 				// suffix so the next batch starts at the same logical row as the
 				// scalar page offsets.
 				if err := h.rowReader.SeekToRow(rowStart + int64(length+accepted)); err != nil {
-					rollbackRows(checkpoints, accepted)
-					return moerr.ConvertGoError(param.Ctx, err)
+					return vector.JoinAppendRollbackError(moerr.ConvertGoError(param.Ctx, err), rollbackRows(checkpoints, accepted))
 				}
 				batchBoundary = true
 			}
```

**File**: `pkg/sql/colexec/join_util.go` (modified, +13/-6)
```diff
@@ -104,6 +104,9 @@ func (bs *Batches) CopyIntoBatchesWithAllocation(
 			tailCheckpoints = localTailCheckpoints[:len(originalTail.Vecs)]
 		}
 		for i := range originalTail.Vecs {
+			if err := originalTail.Vecs[i].MaterializeOwned(proc.Mp()); err != nil {
+				return err
+			}
 			tailCheckpoints[i] = originalTail.Vecs[i].MakeAppendCheckpoint()
 		}
 	}
@@ -118,13 +121,14 @@ func (bs *Batches) CopyIntoBatchesWithAllocation(
 		bs.Buf = nil
 	}
 	if originalTail != nil {
+		var rollbackErr error
 		for i := range originalTail.Vecs {
-			originalTail.Vecs[i].RollbackAppend(
-				tailCheckpoints[i],
-				DefaultBatchSize-originalTailRows,
-			)
+			rollbackErr = vector.JoinAppendRollbackError(rollbackErr, originalTail.Vecs[i].RollbackAppend(tailCheckpoints[i], DefaultBatchSize-originalTailRows))
 		}
-		originalTail.SetRowCount(originalTailRows)
+		if rollbackErr == nil {
+			originalTail.SetRowCount(originalTailRows)
+		}
+		err = vector.JoinAppendRollbackError(err, rollbackErr)
 	}
 	bs.MemSize = originalMemSize
 	return err
@@ -301,12 +305,15 @@ func appendToFixedSizeFromOffset(dst *batch.Batch, src *batch.Batch, offset int,
 		checkpoints = localCheckpoints[:len(dst.Vecs)]
 	}
 	for i := range dst.Vecs {
+		if err := dst.Vecs[i].MaterializeOwned(proc.Mp()); err != nil {
+			return 0, err
+		}
 		checkpoints[i] = dst.Vecs[i].MakeAppendCheckpoint()
 	}
 	for i := range dst.Vecs {
 		if err = dst.Vecs[i].UnionBatch(src.Vecs[i], int64(offset), length, nil, proc.Mp()); err != nil {
 			for j := 0; j <= i; j++ {
-				dst.Vecs[j].RollbackAppend(checkpoints[j], length)
+				err = vector.JoinAppendRollbackError(err, dst.Vecs[j].RollbackAppend(checkpoints[j], length))
 			}
 			return 0, err
 		}
```

**File**: `pkg/sql/colexec/mergetop/top.go` (modified, +1/-1)
```diff
@@ -299,7 +299,7 @@ func (ctr *container) processBatch(limit uint64, bat *batch.Batch, proc *process
 				proc.Mp(),
 			); err != nil {
 				for i := range checkpoints {
-					ctr.bat.Vecs[i].RollbackAppend(checkpoints[i], processCount)
+					err = vector.JoinAppendRollbackError(err, ctr.bat.Vecs[i].RollbackAppend(checkpoints[i], processCount))
 				}
 				return err
 			}
```

**File**: `pkg/sql/colexec/multi_update/s3writer_delegate.go` (modified, +3/-3)
```diff
@@ -614,12 +614,12 @@ func (writer *s3WriterDelegate) prepareDeleteBatches(
 			rowIDCheckpoint := rowIDDst.MakeAppendCheckpoint()
 			pkCheckpoint := pkDst.MakeAppendCheckpoint()
 			if err := vector.AppendFixed(rowIDDst, rowID, false, proc.GetMPool()); err != nil {
-				rowIDDst.RollbackAppend(rowIDCheckpoint, 1)
+				err = vector.JoinAppendRollbackError(err, rowIDDst.RollbackAppend(rowIDCheckpoint, 1))
 				return nil, err
 			}
 			if err := pkDst.UnionOne(bat.GetVector(PkIdx), int64(i), proc.GetMPool()); err != nil {
-				rowIDDst.RollbackAppend(rowIDCheckpoint, 1)
-				pkDst.RollbackAppend(pkCheckpoint, 1)
+				err = vector.JoinAppendRollbackError(err, rowIDDst.RollbackAppend(rowIDCheckpoint, 1))
+				err = vector.JoinAppendRollbackError(err, pkDst.RollbackAppend(pkCheckpoint, 1))
 				return nil, err
 			}
 			block.bat.SetRowCount(rowIDDst.Length())
```

**File**: `pkg/sql/colexec/order/order.go` (modified, +1/-2)
```diff
@@ -331,8 +331,7 @@ func (ctr *container) appendBatchAccounted(
 		}
 		if err != nil {
 			for j := range ctr.batWaitForSort.Vecs {
-				ctr.batWaitForSort.Vecs[j].RollbackAppend(
-					checkpoints[j], bat.Vecs[j].Length())
+				err = vector.JoinAppendRollbackError(err, ctr.batWaitForSort.Vecs[j].RollbackAppend(checkpoints[j], bat.Vecs[j].Length()))
 			}
 			return err
 		}
```

---

### Incident Patch 2: `4e0a1864` (2026-11-04)
**Commit Message**: fix(disttae): bound long-transaction workspace maintenance and close orphan-cleanup ownership (#30988)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #25590

## What this PR does / why we need it:

Long explicit transactions repeatedly updating the same primary-key rows rescan superseded workspace history at statement boundaries and during reads. This PR keeps incremental per-table views and compacts superseded entries so maintenance follows the live working set. The issue's UPDATE, REPLACE and DELETE+INSERT cases are covered by focused workspace tests and SQL cases.

Persistence and compaction also need a complete ownership contract: every unpublished object must reserve bounded capacity and remain owned until publication or cleanup. The implementation centralizes that contract in the workspace/engine, retains failed cleanup work, and drains it with bounded batches/backoff and a single shutdown budget. Local writers and remote fragments share the same same-version admission contract running on one build; remote ownership transfer prov

**File**: `pkg/fileservice/local_fs.go` (modified, +7/-0)
```diff
@@ -1028,6 +1028,13 @@ func deleteLocalFile(mu *sync.RWMutex, dirFiles map[string]*os.File, nativePath
 
 	err = os.Remove(nativePath)
 	if err != nil {
+		// A concurrent deletion already removed the file between this
+		// check's Stat and its Remove: the file is gone, which is the
+		// documented not-found outcome, not an error (the cleanup
+		// subsystem's drains race benignly over one-ownership names).
+		if os.IsNotExist(err) {
+			return nil
+		}
 		return err
 	}
 
```

**File**: `pkg/objectio/injects.go` (modified, +111/-0)
```diff
@@ -121,13 +121,60 @@ const (
 	// -> NewCompile -> UpdateSnapshotWriteOffset.
 	FJ_CNReenterSnapshotOffsetOnGetTable = "fj/cn/reenter_snapshot_offset_on_get_table"
 
+	// FJ_CNWorkspaceMergeRowidAllocFailed is a test-only fault that makes
+	// the >=30-entries merge pass of the admission merge fail exactly at
+	// its combined-batch rowid regeneration. Before the round-6 rewrite
+	// of issue #25590 this fired AFTER the merge had already destroyed
+	// the combined sources, which left the retained batch mixing the
+	// rowids of several blocks with no reader-safe invariants left.
+	FJ_CNWorkspaceMergeRowidAllocFailed = "fj/cn/workspace_merge_rowid_alloc_failed"
+
+	// FJ_CNWorkspaceCompactPublishFailed is a test-only fault that makes
+	// the object-compaction pass of the admission merge fail exactly at
+	// the post-lookup re-publication of another object sharing a metadata
+	// batch with a compacted (dirty) object — the mpool-fallible window
+	// between the compaction's table resolution and the pending-deletion
+	// rewrite. Before the round-7 fix of issue #25590 this fired where the
+	// compaction still wiped pending deletedBlocks unconditionally while
+	// the dirty object had not been rewritten yet, so the retried
+	// admission resurrected the rows those marks deleted.
+	FJ_CNWorkspaceCompactPublishFailed = "fj/cn/workspace_compact_publish_failed"
+
 	// FJ_CNDumpResolveWindowWait is a test-only orchestration point inside the
 	// unlocked table-resolution window of a workspace dump. Armed with the
 	// WAIT action, it parks the dumping goroutine right before the transaction
 	// lock is re-acquired, so a test can deterministically mutate the
 	// workspace from another goroutine while the window is open.
 	FJ_CNDumpResolveWindowWait = "fj/cn/dump_resolve_window_wait"
 
+	// FJ_CNWorkspaceRecordStageFailed is a test-only fault that fails one
+	// table's S3 metadata record inside its fallible preparation (the
+	// staged record phase of issue #25590's object compaction): armed
+	// with the table's name — or empty to fire for every record — it
+	// makes the record fail AFTER an earlier replacement of the same
+	// pass has already staged, which is the exact window the round-20
+	// atomicity contract covers: nothing the failed record prepared may
+	// survive a partially failed pass as a live workspace entry.
+	FJ_CNWorkspaceRecordStageFailed = "fj/cn/workspace_record_stage_failed"
+
+	// The four FJ_CNDump{Insert,Delete}{Write,Sync}Failed keys are test-only
+	// faults inside the fallible publication phase of the workspace dumps
+	// (Transaction.dumpInsertBatchLocked / dumpDeleteBatchLocked). They let a
+	// test fail the publication deterministically — before the writer Write,
+	// or between Write and Sync — to pin that a failed dump leaves the
+	// workspace intact instead of discarding staged sources whose
+	// replacement file entries were never published (issue #25590).
+	FJ_CNDumpInsertWriteFailed = "fj/cn/dump_insert_write_fails"
+	FJ_CNDumpInsertSyncFailed  = "fj/cn/dump_insert_sync_fails"
+	FJ_CNDumpDeleteWriteFailed = "fj/cn/dump_delete_write_fails"
+	FJ_CNDumpDeleteSyncFailed  = "fj/cn/dump_delete_sync_fails"
+
+	// FJ_CNDumpDeleteCloseFailed fails the tombstone writer's Close AFTER
+	// the replacement entry is recorded, pinning that such a table counts
+	// as published (retiring to its sources would double-apply the
+	// tombstones) while the dump still reports the error.
+	FJ_CNDumpDeleteCloseFailed = "fj/cn/dump_delete_close_fails"
+
 	// FJ_ArrowLoadRolloutWait is a test-only post-admission/pre-publication
 	// barrier. Arrow's reader triggers it after a range has been admitted and
 	// converted, but before the batch is published to the LOAD pipeline, so a
@@ -388,13 +435,77 @@ func CNReenterSnapshotOffsetOnGetTableInjected() (injected bool, rogueUpdate boo
 	return true, iarg == 2, iarg != 1
 }
 
+// CNWorkspaceMergeRowidAllocFailedInjected reports whether the
+// FJ_CNWorkspaceMergeRowidAllocFailed fault is active: when it is, the
+// admission merge's staged publication fails before the regenerated rowids
+// of the combined raw-insert batch are installed.
+func CNWorkspaceMergeRowidAllocFailedInjected() bool {
+	return SimpleInjected(FJ_CNWorkspaceMergeRowidAllocFailed)
+}
+
+// CNWorkspaceCompactPublishFailedInjected reports whether the
+// FJ_CNWorkspaceCompactPublishFailed fault is active: when it is, the
+// object-compaction pass' re-publication of a metadata-batch-sharing
+// object fails after the compaction's table lookup has resolved, so the
+// pass returns mid-batch with the dirty object's rewrite still pending.
+func CNWorkspaceCompactPublishFailedInjected() bool {
+	return SimpleInjected(FJ_CNWorkspaceCompactPublishFailed)
+}
+
+// CNWorkspaceRecordStageFailedInjected reports whether the table's S3
+// record belongs to the FJ_CNWorkspaceRecordStageFailed fault — armed by
+// table name (or with no name to refuse every record): the staged record
+// fails at 
```

**File**: `pkg/objectio/ioutil/sink_pool.go` (modified, +35/-1)
```diff
@@ -55,11 +55,24 @@ type poolSinkJob struct {
 	mp      *mpool.MPool
 	fs      fileservice.FileService
 	result  *pipelineResult
+	// capacityHook, when the owning sinker carries one, gates each
+	// spilling object right before the pool's sync worker would make it
+	// durable — the SAME edge-of-persistence contract as the sync path's
+	// syncFileSinker, so a pipelined writer cannot push its objects past
+	// an admission bound its non-pipelined sibling respects (issue
+	// #25590 round-19 review). A refused job persists nothing and only
+	// the job's error surfaces.
+	capacityHook UncommittedCapacityHook
 }
 
 type poolSyncJob struct {
 	fSinker FileSinker
 	result  *pipelineResult
+	// capacityHook gates one spilling object before the sync worker
+	// persists it — the same edge-of-persistence contract as
+	// syncFileSinker, so pipelined writers respect the admission bound
+	// (issue #25590 round-19 review). Refusal persists nothing.
+	capacityHook UncommittedCapacityHook
 }
 
 // pipelineResult tracks accumulated results and errors for one Sinker's
@@ -168,7 +181,11 @@ func (p *SinkPool) runSinkWorker() {
 		// Forward to sync worker. Do NOT call r.pending.Done() here;
 		// the sync worker calls it after completing the IO.
 		select {
-		case p.syncChan <- &poolSyncJob{fSinker: fSinker, result: r}:
+		case p.syncChan <- &poolSyncJob{
+			fSinker:      fSinker,
+			result:       r,
+			capacityHook: job.capacityHook,
+		}:
 		case <-r.ctx.Done():
 			fSinker.Close()
 			r.setError(context.Cause(r.ctx))
@@ -191,6 +208,23 @@ func (p *SinkPool) runSyncWorker() {
 			continue
 		}
 
+		// The hook gate runs before the pool's Sync exactly like
+		// syncFileSinker runs it on the sync path: a refusal aborts the
+		// object before anything goes durable — nothing lands in
+		// r.unpublished because the object never met storage — and the
+		// error fails the writer's Sync through result.getError (issue
+		// #25590 round-19 review).
+		if job.capacityHook != nil {
+			if name := activeFileSinkerObjectName(job.fSinker); name != "" {
+				if err := job.capacityHook(name); err != nil {
+					job.fSinker.Close()
+					r.setError(err)
+					r.pending.Done()
+					continue
+				}
+			}
+		}
+
 		syncStart := time.Now()
 		stats, err := job.fSinker.Sync(r.ctx)
 		atomic.AddInt64(&r.syncNs, int64(time.Since(syncStart)))
```

**File**: `pkg/objectio/ioutil/sinker.go` (modified, +119/-13)
```diff
@@ -415,6 +415,9 @@ type Sinker struct {
 		tailSizeCap         int
 		offHeap             bool
 		chunkedColumnPolicy objectio.ChunkedColumnPolicy
+		// capacityHook gates each object right before it persists; nil
+		// in every caller without an engine capacity ledger.
+		capacityHook UncommittedCapacityHook
 	}
 	fSinker struct {
 		executor FileSinker
@@ -548,12 +551,26 @@ func DeleteUnpublishedObjects(
 	return len(unique), nil
 }
 
-// DeletePersisted deletes every object that this sinker has persisted, or may
-// have persisted after a commit-ambiguous Sync error, but has not transferred
-// out of its lifecycle yet. It returns the exact ownership snapshot on both
-// success and failure. The tracked references are retained when deletion fails
-// so the caller may retry or hand them off before closing the sinker.
-func (sinker *Sinker) DeletePersisted(ctx context.Context) ([]string, error) {
+// PersistedNames takes this sinker's exact ownership snapshot — every
+// object it persisted, or may have persisted after a commit-ambiguous
+// Sync error, and has not transferred out of its lifecycle yet — WITHOUT
+// deleting anything (issue #25590 round-15 review): a caller on a
+// lock-holding or user-blocking path (a transaction's statement
+// admission) can transfer the names to its asynchronous cleanup owner
+// instead of synchronously deleting them on a file service whose
+// deletion a stalled context cannot move. The snapshot follows the same
+// completeness rule as DeletePersisted: a still-running pipeline is
+// drained first so no sibling write's file can be missed, and the tracked
+// references stay inside the sinker — closing it drops them exactly as
+// DeletePersisted's callers have always done after taking the snapshot.
+func (sinker *Sinker) PersistedNames() []string {
+	return sinker.persistedSnapshot()
+}
+
+// persistedSnapshot assembles the persisted/possibly-persisted name
+// snapshot shared by DeletePersisted (which deletes it) and
+// PersistedNames (which only hands it out).
+func (sinker *Sinker) persistedSnapshot() []string {
 	if sinker.pipe.enabled && sinker.pipe.result != nil {
 		// A failed pipeline may still have successful sibling writes. Wait for
 		// all of them before taking the ownership snapshot.
@@ -577,7 +594,16 @@ func (sinker *Sinker) DeletePersisted(ctx context.Context) ([]string, error) {
 		files = append(files, sinker.pipe.result.unpublished...)
 		sinker.pipe.result.mu.RUnlock()
 	}
-	files = normalizeUnpublishedObjectNames(files)
+	return normalizeUnpublishedObjectNames(files)
+}
+
+// DeletePersisted deletes every object that this sinker has persisted, or may
+// have persisted after a commit-ambiguous Sync error, but has not transferred
+// out of its lifecycle yet. It returns the exact ownership snapshot on both
+// success and failure. The tracked references are retained when deletion fails
+// so the caller may retry or hand them off before closing the sinker.
+func (sinker *Sinker) DeletePersisted(ctx context.Context) ([]string, error) {
+	files := sinker.persistedSnapshot()
 	_, err := DeleteUnpublishedObjects(ctx, sinker.fs, files...)
 	if err != nil {
 		return files, err
@@ -718,11 +744,12 @@ func (sinker *Sinker) pipelineSubmit(ctx context.Context, data []*batch.Batch) e
 	}
 	waitStart := time.Now()
 	err := GetDefaultSinkPool().Submit(&poolSinkJob{
-		data:    data,
-		factory: sinker.fSinker.factory,
-		mp:      sinker.mp,
-		fs:      sinker.fs,
-		result:  sinker.pipe.result,
+		data:         data,
+		factory:      sinker.fSinker.factory,
+		mp:           sinker.mp,
+		fs:           sinker.fs,
+		result:       sinker.pipe.result,
+		capacityHook: sinker.config.capacityHook,
 	})
 	atomic.AddInt64(&sinker.timing.waitNs, int64(time.Since(waitStart)))
 	return err
@@ -815,6 +842,76 @@ func (sinker *Sinker) trySpill(ctx context.Context) error {
 	return err
 }
 
+// UncommittedCapacityHook gates one object sitting on the edge of
+// persistence: the file sinker calls it right BEFORE its Sync would make
+// the object durable, with the object's name, and a returned error aborts
+// that spill before anything persists. The engine uses this hook to
+// reserve capacity for each unpublished object as it is created, in
+// object units rather than writer units, so a workspace dump whose
+// writer spills several objects consumes one reservation per object and
+// a refusal stops the spilling writer with no partially-persisted
+// object behind it (issue #25590 round-18 review).
+type UncommittedCapacityHook func(name string) error
+
+// WithUncommittedCapacityHook installs the capacity hook consulted
+// before each object persists. It is nil in production unless the
+// caller's persistence is bounded by an engine admission ledger.
+func WithUncommittedCapacityHook(hook UncommittedCapacityHook) SinkerOption {
+	return func(sinker *Sinker) {
+		sinker.config.capacityHook = hook
+	}
+}
+
+// SinkerOwner is the structural interface to a workspace 
```

**File**: `pkg/objectio/ioutil/sinker_test.go` (modified, +27/-0)
```diff
@@ -237,3 +237,30 @@ func TestSinkerDeletePersistedAfterAmbiguousSyncFailure(t *testing.T) {
 	_, err = baseFS.StatFile(ctx, fs.persisted)
 	require.True(t, moerr.IsMoErrCode(err, moerr.ErrFileNotFound))
 }
+
+func TestSinkerResetDiscardsTransferredFailureNames(t *testing.T) {
+	ctx := context.Background()
+	proc := testutil.NewProc(t)
+	baseFS, err := fileservice.NewMemoryFS("shared", fileservice.DisabledCacheConfig, nil)
+	require.NoError(t, err)
+	t.Cleanup(func() { baseFS.Close(ctx) })
+	fs := &persistThenErrorFS{FileService: baseFS}
+	_, typs, _, sinker := makeTestSinker(proc.Mp(), fs)
+	t.Cleanup(func() { require.NoError(t, sinker.Close()) })
+	bat := containers.MockBatch(typs, 2, 2, nil)
+	t.Cleanup(bat.Close)
+	require.NoError(t, sinker.Write(ctx, containers.ToCNBatch(bat)))
+	require.ErrorContains(t, sinker.Sync(ctx), "injected post-persist sync failure")
+	owned := sinker.PersistedNames()
+	require.Equal(t, []string{fs.persisted}, owned)
+	require.Equal(t, owned, sinker.GetUnpublishedFiles())
+
+	sinker.Reset()
+	require.Empty(t, sinker.PersistedNames())
+	require.Empty(t, sinker.GetUnpublishedFiles())
+	require.Equal(t, []string{fs.persisted}, owned, "the transferred snapshot is independent")
+	_, err = baseFS.StatFile(ctx, fs.persisted)
+	require.NoError(t, err, "Reset must leave physical cleanup to the owner")
+	sinker.Reset()
+	require.Empty(t, sinker.PersistedNames())
+}
```

**File**: `pkg/sql/colexec/cn_segment_map.go` (modified, +28/-19)
```diff
@@ -15,7 +15,6 @@
 package colexec
 
 import (
-	"bytes"
 	"encoding/binary"
 	"sync"
 
@@ -40,6 +39,34 @@ type CnSegmentMap struct {
 	sync.Mutex
 	// tag whether a segment is generated by this txn
 	mp map[string]int32
+	// refs counts, per map entry, the ledgers that claimed it through
+	// PutCnSegment — the dual-claim shape a coordinator's re-record of an
+	// adopted transferred object builds on this CN (issue #25590
+	// round-55 review): two workspaces of one transaction can register
+	// the same (txnID, table, segment) — the fragment's mirror and the
+	// recording workspace — so a map entry retires only when EVERY
+	// claiming ledger has reached its terminal. It is read and written
+	// only under the mutex.
+	refs map[string]int
+}
+
+// TxnWorkspaceSegments records exactly the CN segment-map entries ONE
+// workspace registered, so the workspace's terminal can remove exactly
+// those entries at a cost proportional to its own registrations. The
+// whole-map prefix sweep the retire path previously ran cost up to
+// milliseconds once unrelated live transactions registered hundreds of
+// thousands of segments (issue #25590 review finding P2), and — because
+// a remote statement's fragment mirror workspaces share the user
+// transaction's ID — one fragment's settlement could also unregister
+// segments a concurrent fragment of the same live transaction had
+// registered on this CN, corrupting later in-transaction delete
+// routing (GetCnSegmentType). The zero value is a workspace that
+// registered no segment; retiring it never opens the segment mutex. All
+// ledger access happens through the owning server's segment-map mutex
+// (register on Put, retire on removal), so the ledger needs no
+// separate synchronization.
+type TxnWorkspaceSegments struct {
+	keys map[string]struct{}
 }
 
 func IsDeletionOnTxnUnCommit(
@@ -70,22 +97,4 @@ func segmentKey(txnID []byte, tableId uint64, segId *types.Segmentid) string {
 	return string(key)
 }
 
-func segmentKeyPrefix(txnID []byte) []byte {
-	if len(txnID) > maxTxnIDLen {
-		txnID = txnID[:maxTxnIDLen]
-	}
-	prefix := make([]byte, 2+len(txnID))
-	binary.BigEndian.PutUint16(prefix[:2], uint16(len(txnID)))
-	copy(prefix[2:], txnID)
-	return prefix
-}
-
-func segmentKeyHasTxn(key string, txnID []byte) bool {
-	prefix := segmentKeyPrefix(txnID)
-	if len(key) < len(prefix) {
-		return false
-	}
-	return bytes.HasPrefix([]byte(key), prefix)
-}
-
 const maxTxnIDLen = int(^uint16(0))
```

**File**: `pkg/sql/colexec/cn_segment_map_test.go` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//	http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package colexec
+
+import (
+	"encoding/binary"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/common/runtime"
+	"github.com/matrixorigin/matrixone/pkg/objectio"
+	"github.com/stretchr/testify/require"
+)
+
+// newSegmentMapTestServer installs a fresh server for the default runtime
+// and restores whatever server the process had before, so segment-map
+// cases never observe state another test left behind.
+func newSegmentMapTestServer(t *testing.T) *Server {
+	t.Helper()
+	rt := runtime.ServiceRuntime("")
+	previous, existed := rt.GetGlobalVariables(runtime.ColexecServer)
+	server := NewServer("")
+	t.Cleanup(func() {
+		if existed {
+			rt.SetGlobalVariables(runtime.ColexecServer, previous)
+		} else {
+			rt.CompareAndDeleteGlobalVariables(runtime.ColexecServer, server)
+		}
+	})
+	return server
+}
+
+// TestTxnWorkspaceSegmentsRetireExactlyOwnRegistrations pins the issue
+// #25590 review finding P2 contract on the segment map itself: a
+// workspace's retirement deletes exactly the entries the workspace
+// registered — never entries registered by other workspaces, including
+// workspaces that share the same transaction ID (fragments of one
+// distributed transaction do exactly that), and never extra entries of
+// other transactions. The pre-fix per-txnID prefix sweep violated both
+// halves: it cost a whole-CN map scan under the shared mutex on every
+// fragment settlement, and a shared-txnID fragment settlement removed
+// another live fragment's registrations.
+func TestTxnWorkspaceSegmentsRetireExactlyOwnRegistrations(t *testing.T) {
+	srv := newSegmentMapTestServer(t)
+
+	txnID := []byte("shared-user-txn")
+	foreignTxnID := []byte("unrelated-txn")
+	const tableA = uint64(42)
+	const tableB = uint64(43)
+
+	writerA := &TxnWorkspaceSegments{}
+	writerB := &TxnWorkspaceSegments{}
+	foreign := &TxnWorkspaceSegments{}
+
+	sidA := objectio.NewSegmentid()
+	sidB := objectio.NewSegmentid()
+	sidForeign := objectio.NewSegmentid()
+
+	// Two workspaces of the SAME user transaction register distinct
+	// segments; an unrelated transaction registers a third entry.
+	srv.PutCnSegment(writerA, txnID, tableA, sidA, TxnWorkspaceUnCommitType)
+	srv.PutCnSegment(writerB, txnID, tableB, sidB, TxnWorkspaceUnCommitType)
+	srv.PutCnSegment(foreign, foreignTxnID, tableA, sidForeign, TxnWorkspaceUnCommitType)
+
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidA, tableA, txnID))
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidB, tableB, txnID))
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidForeign, tableA, foreignTxnID))
+
+	// A repeated registration of the same segment dedupes in the ledger,
+	// so retirement stays proportional to distinct registrations.
+	srv.PutCnSegment(writerA, txnID, tableA, sidA, TxnWorkspaceUnCommitType)
+
+	// Retire writerA: exactly its own segment disappears. Pre-fix this
+	// swept writerB's and foreign's entries away too, because every entry
+	// with the same txnID prefix — and, for the full-scan cost, every
+	// foreign entry — was compared under the shared mutex.
+	srv.RetireTxnWorkspaceSegments(writerA)
+
+	require.Zero(t, srv.GetCnSegmentType(sidA, tableA, txnID),
+		"the retiring workspace's own registration must be removed at its terminal")
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidB, tableB, txnID),
+		"another fragment workspace of the SAME user transaction keeps its registration")
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidForeign, tableA, foreignTxnID),
+		"an unrelated transaction's registration keeps untouched")
+
+	// The ledger is cleared, so a second terminal — a double settlement —
+	// is a no-op, and the remaining writer's own terminal removes its
+	// entry exactly.
+	srv.RetireTxnWorkspaceSegments(writerA)
+	require.Equal(t, int32(TxnWorkspaceUnCommitType),
+		srv.GetCnSegmentType(sidB, tableB, txnID))
+	srv.RetireTxnWorkspaceSegments(writerB)
+	require.Zero(t, srv.GetCnSegmentType(sidB, tableB, txnID))
+
+	// A zero-value ledger — the ordinary read-only remote fragment case —
+	// retires with nothing to remove.
+	srv.RetireTxnWorkspaceSegments(&TxnWorkspaceSegments{})
+
+	// The remaining consumers still see the surviving entries.
+	require.Equal(t, int32(TxnWorkspa
```

**File**: `pkg/sql/colexec/deletion/relay_object_names.go` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//	http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+// relay_object_names.go derives the storage-object names a standalone
+// remote DELETE fragment's result stream carries (issue #25590
+// round-23 review, finding 3).
+//
+// A remote deletion operator (Deletion.RemoteDelete) flushes what it
+// persisted through the fragment result stream itself:
+// makeDelRemoteBatch's five-vector layout [BlockMeta_Delete_ID,
+// BlockMeta_DeltaLoc, BlockMeta_Type, BlockMeta_Partition,
+// BlockMeta_Deletes_Length]. Two row classes share that stream, and
+// only one of them names an object: for each CN-flushed S3 tombstone
+// the row's DeltaLoc column carries the MARSHALED tombstone stats
+// batch (a [ObjectMeta_ObjectStats] batch, one serialized ObjectStats
+// row per tombstone object) and its Type column is FlushDeltaLoc; a
+// per-block row carries the retained row-id batch and a block class
+// in Type, owning nothing. The pre-r23 intake recognized none of it:
+// a clean, drained standalone-delete fragment settled transferred,
+// released its local owner, and a cancellation before the coordinator's
+// record left the tombstone files enumerable nowhere.
+//
+// The recognizer is attribute-anchored and excludes the row-only class
+// by the producer's own Type discriminator; a DeltaLoc that cannot
+// decode rejects the ack instead of adopting a subset of the tombstones
+// the delete persisted.
+package deletion
+
+import (
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/objectio"
+)
+
+// ProducesRemotePersistedObjectMetadata is the mode-authenticated
+// provenance edge the coordinator's remote-object admission asserts
+// (issue #25590 round-24 review finding F2, design r11 D2): the remote
+// deletion layout names tombstone objects only when a real remote
+// S3-flushing deletion produced it. A local delete (RemoteDelete off)
+// is a stream whose rows are ordinary data - the very same
+// makeDelRemoteBatch-shaped rows from such an operator must never reach
+// the recognizer, where they would either reject a legitimate stream
+// fail-closed or adopt embedded stats as cleanup obligations.
+func (deletion *Deletion) ProducesRemotePersistedObjectMetadata() bool {
+	return deletion.RemoteDelete
+}
+
+// ProducesRemotePersistedObjectMetadata mirrors the raw operator's mode
+// on the partition wrapper: the wrapper's raw field is only visible
+// inside this package, so the compile-side admission consumes the mode
+// through this predicate alone, never by reaching into the wrapper.
+func (op *PartitionDelete) ProducesRemotePersistedObjectMetadata() bool {
+	return op.raw != nil && op.raw.RemoteDelete
+}
+
+// TryExtractRemoteDeleteObjectNames returns ok=true only for a batch
+// carrying the standalone deletion operator's remote layout, with one
+// canonical name per flushed tombstone object, or an error when a
+// FlushDeltaLoc row cannot prove the object it claims.
+func TryExtractRemoteDeleteObjectNames(
+	bat *batch.Batch, mp *mpool.MPool,
+) (names []string, ok bool, err error) {
+	if bat == nil || len(bat.Vecs) < 4 || bat.Vecs[0].Length() == 0 {
+		return nil, false, nil
+	}
+	if len(bat.Attrs) < 4 ||
+		bat.Attrs[0] != catalog.BlockMeta_Delete_ID ||
+		bat.Attrs[1] != catalog.BlockMeta_DeltaLoc ||
+		bat.Attrs[2] != catalog.BlockMeta_Type ||
+		bat.Attrs[3] != catalog.BlockMeta_Partition {
+		return nil, false, nil
+	}
+	if bat.Vecs[0].GetType().Oid != types.T_text ||
+		bat.Vecs[1].GetType().Oid != types.T_text ||
+		bat.Vecs[2].GetType().Oid != types.T_int8 ||
+		bat.Vecs[3].GetType().Oid != types.T_int32 {
+		return nil, false, nil
+	}
+	classes := vector.MustFixedColNoTypeCheck[int8](bat.Vecs[2])
+	data, area := vector.MustVarlenaRawData(bat.Vecs[1])
+	seen := make(map[string]struct{})
+	inner := batch.NewOffHeapEmpty()
+	defer inner.Clean(mp)
+	for i, class := range classes {
+		if class != int8(FlushDeltaLoc) {
+			// A retained block's rows stayed in the workspace; the
+			// producer's own class marker says no tombstone object.
+			continue
+		}
+		blob := data[i].GetByteSlice(area)
+		if len(blob) == 0 {
+			re
```

---

### Incident Patch 3: `2b16c3ab` (2026-11-04)
**Commit Message**: fix(sql): accept JSON in remaining string functions (#30883)

## What type of PR is this?

- [x] BUG
- [x] Test and CI

## Which issue(s) this PR fixes:

Related to #28905. Keep the issue open until deployed QA acceptance.

## What this PR does / why we need it:

Support JSON operands in MD5, SHA/SHA1, SHA2, COMPRESS, QUOTE and SOUNDEX. Bind JSON operands directly and render complete visible JSON bytes inside each consumer without inserting a CONCAT expression or intermediate text vector. This preserves quotes, escape bytes and values above 65,535 bytes without a bounded VARCHAR cast. SHA2 integer-argument normalization, non-JSON behavior, ordinary CAST/assignment semantics, SQL NULL versus JSON null, and selection masks remain unchanged. QUOTE/SOUNDEX retain unbounded result metadata; COMPRESS retains its binary result.

**Deployment contract: full offline upgrade.** Stop the cluster and replace all MatrixOne service binaries before accepting queries or resuming work; every CN must run the new binary. Mixed old/new CN execution and binary rollback are unsupported. The current implementation binds JSON directly. A retained seven-consumer predecessor-expression test replays the earl

**File**: `pkg/common/morpc/backend_test.go` (modified, +4/-2)
```diff
@@ -1716,19 +1716,21 @@ func TestSendWithCannotConnect(t *testing.T) {
 			defer cancel()
 			req := &testMessage{id: 1}
 			f, err := b.Send(ctx, req)
-			assert.NoError(t, err)
+			require.NoError(t, err)
 			defer f.Close()
 
 			resp, err := f.Get()
 			assert.Error(t, err)
 			assert.Nil(t, resp)
 		},
 		WithBackendFilter(func(Message, string) bool {
+			// Keep the short reconnect budget out of healthy fixture setup.
+			// The filter and subsequent reconnects share the write-loop owner.
+			rb.options.connectTimeout = time.Millisecond * 200
 			assert.NoError(t, rb.conn.Disconnect())
 			rb.remote = ""
 			return true
 		}),
-		WithBackendConnectTimeout(time.Millisecond*200),
 	)
 }
 
```

**File**: `pkg/frontend/show_account_test.go` (modified, +27/-10)
```diff
@@ -21,6 +21,7 @@ import (
 	"math/rand"
 	"strings"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/golang/mock/gomock"
@@ -451,9 +452,12 @@ func Test_updateStorageUsageCache(t *testing.T) {
 }
 
 func Test_checkStorageUsageCache_V2(t *testing.T) {
+	synctest.Test(t, testCheckStorageUsageCacheV2)
+}
+
+func testCheckStorageUsageCacheV2(t *testing.T) {
 	origCache := cnUsageCache
 	cnUsageCache = logtail.NewStorageUsageCache(logtail.WithLazyThreshold(1))
-	cnUsageCache = logtail.NewStorageUsageCache(logtail.WithLazyThreshold(1))
 	t.Cleanup(func() {
 		cnUsageCache = origCache
 	})
@@ -476,16 +480,24 @@ func Test_checkStorageUsageCache_V2(t *testing.T) {
 		require.Equal(t, rep.Sizes[i], usages[int64(i)][0])
 	}
 
-	require.Eventually(t, func() bool {
-		_, ok = checkStorageUsageCache([][]int64{rep.AccIds})
-		return !ok
-	}, time.Second+200*time.Millisecond, 10*time.Millisecond)
+	// Advance the bubble's fake clock, not wall time. Synchronous checks
+	// cannot leave an Eventually predicate racing the cache cleanup.
+	time.Sleep(time.Second - time.Nanosecond)
+	_, ok = checkStorageUsageCache([][]int64{rep.AccIds})
+	require.True(t, ok, "cache must remain valid before the expiry boundary")
+	time.Sleep(time.Nanosecond)
+	usages, ok = checkStorageUsageCache([][]int64{rep.AccIds})
+	require.False(t, ok, "cache must expire at the lazy threshold")
+	require.Nil(t, usages)
 }
 
 func Test_checkStorageUsageCache(t *testing.T) {
+	synctest.Test(t, testCheckStorageUsageCache)
+}
+
+func testCheckStorageUsageCache(t *testing.T) {
 	origCache := cnUsageCache
 	cnUsageCache = logtail.NewStorageUsageCache(logtail.WithLazyThreshold(1))
-	cnUsageCache = logtail.NewStorageUsageCache(logtail.WithLazyThreshold(1))
 	t.Cleanup(func() {
 		cnUsageCache = origCache
 	})
@@ -510,10 +522,15 @@ func Test_checkStorageUsageCache(t *testing.T) {
 		require.Equal(t, rep.SnapshotSizes[i], usages[int64(i)][1])
 	}
 
-	require.Eventually(t, func() bool {
-		_, ok = checkStorageUsageCache([][]int64{rep.AccIds})
-		return !ok
-	}, time.Second+200*time.Millisecond, 10*time.Millisecond)
+	// The virtual-clock boundary is independent of scheduler delays and
+	// has no polling goroutine that can outlive cache restoration.
+	time.Sleep(time.Second - time.Nanosecond)
+	_, ok = checkStorageUsageCache([][]int64{rep.AccIds})
+	require.True(t, ok, "cache must remain valid before the expiry boundary")
+	time.Sleep(time.Nanosecond)
+	usages, ok = checkStorageUsageCache([][]int64{rep.AccIds})
+	require.False(t, ok, "cache must expire at the lazy threshold")
+	require.Nil(t, usages)
 }
 
 func Test_GetObjectCount_V2(t *testing.T) {
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +0/-1)
```diff
@@ -9385,7 +9385,6 @@ func bindFuncExprImplByPlanExpr(
 			}
 		}
 	}
-
 	// Temporal precision is also the display width stored in derived schemas.
 	// Keep the two metadata fields aligned after unit-dependent refinement.
 	switch name {
```

**File**: `pkg/sql/plan/function/func_binary.go` (modified, +14/-2)
```diff
@@ -7862,7 +7862,7 @@ func EndsWith(ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc
 }
 
 // https://dev.mysql.com/doc/refman/8.0/en/encryption-functions.html#function_sha2
-func SHA2Func(args []*vector.Vector, result vector.FunctionResultWrapper, _ *process.Process, length int, selectList *FunctionSelectList) (err error) {
+func SHA2Func(args []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) (err error) {
 	res := vector.MustFunctionResult[types.Varlena](result)
 	strs := vector.GenerateFunctionStrParameter(args[0])
 	shaTypes := vector.GenerateFunctionFixedTypeParameter[int64](args[1])
@@ -7875,6 +7875,12 @@ func SHA2Func(args []*vector.Vector, result vector.FunctionResultWrapper, _ *pro
 			continue
 		}
 		str, isnull1 := strs.GetStrValue(i)
+		if args[0].GetType().Oid == types.T_json {
+			str, isnull1, err = getJSONStringConsumerValue(proc.Ctx, strs, i)
+			if err != nil {
+				return err
+			}
+		}
 		shaType, isnull2 := shaTypes.GetValue(i)
 
 		if isnull1 || isnull2 {
@@ -7905,7 +7911,7 @@ func SHA2Func(args []*vector.Vector, result vector.FunctionResultWrapper, _ *pro
 // as '256tail' selects SHA-256 while a non-numeric value becomes zero. The
 // string wrapper preserves binary bytes and avoids the lossy implicit cast to
 // VARCHAR that would otherwise happen before execution.
-func SHA2StringLengthFunc(args []*vector.Vector, result vector.FunctionResultWrapper, _ *process.Process, length int, selectList *FunctionSelectList) (err error) {
+func SHA2StringLengthFunc(args []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) (err error) {
 	res := vector.MustFunctionResult[types.Varlena](result)
 	strs := vector.GenerateFunctionStrParameter(args[0])
 	shaLengths := vector.GenerateFunctionStrParameter(args[1])
@@ -7928,6 +7934,12 @@ func SHA2StringLengthFunc(args []*vector.Vector, result vector.FunctionResultWra
 			continue
 		}
 		str, isnull1 := strs.GetStrValue(i)
+		if args[0].GetType().Oid == types.T_json {
+			str, isnull1, err = getJSONStringConsumerValue(proc.Ctx, strs, i)
+			if err != nil {
+				return err
+			}
+		}
 		var isnull2 bool
 		var shaType int64
 		if lengthIsConst {
```

**File**: `pkg/sql/plan/function/func_json_string_consumers_test.go` (modified, +330/-0)
```diff
@@ -15,12 +15,22 @@
 package function
 
 import (
+	"bytes"
+	"compress/zlib"
 	"context"
+	"crypto/md5"
+	"crypto/sha1"
+	"crypto/sha256"
+	"encoding/binary"
+	"encoding/hex"
+	"io"
+	"strings"
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
 	"github.com/stretchr/testify/require"
 )
 
@@ -63,6 +73,76 @@ func TestJSONStringConsumerJSONOverloads(t *testing.T) {
 	}
 }
 
+func TestJSONStringConsumerRemainingFunctionsKeepJSONAsSource(t *testing.T) {
+	cases := []struct {
+		name         string
+		args         []types.Type
+		wantOverload int32
+		wantCast     bool
+	}{
+		{name: "md5", args: []types.Type{types.T_json.ToType()}, wantOverload: 0},
+		{name: "sha1", args: []types.Type{types.T_json.ToType()}, wantOverload: 0},
+		{name: "sha2", args: []types.Type{types.T_json.ToType(), types.T_int64.ToType()}, wantOverload: 0},
+		{name: "sha2", args: []types.Type{types.T_json.ToType(), types.T_varchar.ToType()}, wantOverload: 0, wantCast: true},
+		{name: "compress", args: []types.Type{types.T_json.ToType()}, wantOverload: 0},
+		{name: "quote", args: []types.Type{types.T_json.ToType()}, wantOverload: 0},
+		{name: "soundex", args: []types.Type{types.T_json.ToType()}, wantOverload: 0},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name+"/"+tc.args[len(tc.args)-1].Oid.String(), func(t *testing.T) {
+			resolved, err := GetFunctionByName(context.Background(), tc.name, tc.args)
+			require.NoError(t, err)
+			_, overloadIndex := DecodeOverloadID(resolved.GetEncodedOverloadID())
+			require.Equal(t, tc.wantOverload, overloadIndex)
+			casts, shouldCast := resolved.ShouldDoImplicitTypeCast()
+			require.Equal(t, tc.wantCast, shouldCast)
+			if shouldCast {
+				require.Equal(t, []types.Type{types.T_json.ToType(), types.T_int64.ToType()}, casts)
+			}
+		})
+	}
+}
+
+func TestJSONStringConsumerNonJSONTypesKeepExistingOverloads(t *testing.T) {
+	varcharType := types.T_varchar.ToType()
+	cases := []struct {
+		name string
+		args []types.Type
+	}{
+		{name: "md5", args: []types.Type{varcharType}},
+		{name: "sha1", args: []types.Type{varcharType}},
+		{name: "sha2", args: []types.Type{varcharType, types.T_int64.ToType()}},
+		{name: "compress", args: []types.Type{varcharType}},
+		{name: "quote", args: []types.Type{varcharType}},
+		{name: "soundex", args: []types.Type{varcharType}},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			resolved, err := GetFunctionByName(context.Background(), tc.name, tc.args)
+			require.NoError(t, err)
+			_, shouldCast := resolved.ShouldDoImplicitTypeCast()
+			require.False(t, shouldCast)
+		})
+	}
+}
+
+func TestJSONStringConsumerJSONResultBounds(t *testing.T) {
+	for _, tc := range []struct {
+		name string
+		want types.Type
+	}{
+		{name: "compress", want: types.T_blob.ToType()},
+		{name: "quote", want: types.NewWithCharset(types.T_text, 0, 0, types.CharsetUTF8MB4Bin)},
+		{name: "soundex", want: types.NewWithCharset(types.T_text, types.MaxLongTextLen, 0, types.CharsetUTF8)},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			resolved, err := GetFunctionByName(context.Background(), tc.name, []types.Type{types.T_json.ToType()})
+			require.NoError(t, err)
+			require.Equal(t, tc.want, resolved.GetReturnType())
+		})
+	}
+}
+
 func TestJSONStringConsumerRegisteredExecutors(t *testing.T) {
 	proc := testutil.NewProcess(t)
 	t.Cleanup(proc.Free)
@@ -132,6 +212,215 @@ func TestJSONStringConsumerRegisteredExecutors(t *testing.T) {
 	}
 }
 
+func runRegisteredJSONStringConsumer(
+	t *testing.T,
+	proc *process.Process,
+	name string,
+	argTypes []types.Type,
+	values []any,
+) []byte {
+	t.Helper()
+	require.Len(t, values, len(argTypes))
+	resolved, err := GetFunctionByName(proc.Ctx, name, argTypes)
+	require.NoError(t, err)
+	inputs := make([]*vector.Vector, len(argTypes))
+	for i := range argTypes {
+		inputs[i] = newVectorByType(proc.Mp(), argTypes[i], values[i], nil)
+	}
+	defer func() {
+		for _, input := range inputs {
+			input.Free(proc.Mp())
+		}
+	}()
+	if targets, shouldCast := resolved.ShouldDoImplicitTypeCast(); shouldCast {
+		require.Len(t, targets, len(inputs))
+		for i, targetType := range targets {
+			if argTypes[i].Eq(targetType) {
+				continue
+			}
+			// Reproduce the binder-owned integer parameter conversion instead
+			// of passing the original string vector to an INT64 executor.
+			integerTarget, integerContext := IntegerArgumentTarget(name, i)
+			require.True(t, integerContext)
+			require.Equal(t, integerTarget, targetType.Oid)
+			target := vector.NewVec(targetType)
+			defer target.Free(proc.Mp())
+			converted, err := RunFunctionDirectly(proc, EncodeOverloadID(CAST, IntegerArgumentCastOverload), []*vector.Vector{inputs[i], target}, 1)
+			require.NoError(t, err)
+			inputs[i].Free(proc.Mp())
+			inputs[i] = converted
+		}
+	}
+	result, err := RunFu
```

**File**: `pkg/sql/plan/function/func_unary.go` (modified, +39/-5)
```diff
@@ -1485,7 +1485,8 @@ func QuoteString(str string) string {
 func Quote(ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) error {
 	parameter := vector.GenerateFunctionStrParameter(ivecs[0])
 	rs := vector.MustFunctionResult[types.Varlena](result)
-	isUTF8Text := isExplicitUTF8Charset(ivecs[0].GetType().Charset)
+	isJSON := ivecs[0].GetType().Oid == types.T_json
+	isUTF8Text := isJSON || isExplicitUTF8Charset(ivecs[0].GetType().Charset)
 	for row := uint64(0); row < uint64(length); row++ {
 		if selectList != nil && (selectList.IgnoreAllRow() ||
 			(!selectList.ShouldEvalAllRow() && selectList.Contains(row))) {
@@ -1494,7 +1495,10 @@ func Quote(ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc *pr
 			}
 			continue
 		}
-		value, null := parameter.GetStrValue(row)
+		value, null, err := getJSONStringConsumerValue(proc.Ctx, parameter, row)
+		if err != nil {
+			return err
+		}
 		if null {
 			if err := rs.AppendBytes([]byte("NULL"), false); err != nil {
 				return err
@@ -5870,6 +5874,33 @@ func soundexTextString(str string) string {
 }
 
 func Soundex(ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) error {
+	if ivecs[0].GetType().Oid == types.T_json {
+		parameter := vector.GenerateFunctionStrParameter(ivecs[0])
+		rs := vector.MustFunctionResult[types.Varlena](result)
+		for row := uint64(0); row < uint64(length); row++ {
+			if functionRowSkipped(selectList, row) {
+				if err := rs.AppendBytes(nil, true); err != nil {
+					return err
+				}
+				continue
+			}
+			value, isNull, err := getJSONStringConsumerValue(proc.Ctx, parameter, row)
+			if err != nil {
+				return err
+			}
+			if isNull {
+				if err := rs.AppendBytes(nil, true); err != nil {
+					return err
+				}
+				continue
+			}
+			resultValue := functionUtil.QuickStrToBytes(soundexTextString(functionUtil.QuickBytesToStr(value)))
+			if err := rs.AppendBytes(resultValue, false); err != nil {
+				return err
+			}
+		}
+		return nil
+	}
 	textSoundex := SoundexString
 	if isExplicitUTF8Charset(ivecs[0].GetType().Charset) {
 		textSoundex = soundexTextString
@@ -9356,7 +9387,7 @@ func Unhex(parameters []*vector.Vector, result vector.FunctionResultWrapper, pro
 }
 
 func Md5(parameters []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) error {
-	return opUnaryBytesToBytes(parameters, result, proc, length, func(data []byte) []byte {
+	return jsonStringConsumerUnaryBytesToBytes(parameters, result, proc, length, func(data []byte) []byte {
 		sum := md5.Sum(data)
 		return []byte(hex.EncodeToString(sum[:]))
 	}, selectList)
@@ -9761,7 +9792,10 @@ func Compress(parameters []*vector.Vector, result vector.FunctionResultWrapper,
 			continue
 		}
 
-		data, null := source.GetStrValue(i)
+		data, null, err := getJSONStringConsumerValue(proc.Ctx, source, i)
+		if err != nil {
+			return err
+		}
 		if null {
 			if err := rs.AppendBytes(nil, true); err != nil {
 				return err
@@ -14039,7 +14073,7 @@ func SHA1Func(
 	length int,
 	selectList *FunctionSelectList,
 ) error {
-	return opUnaryBytesToBytes(parameters, result, proc, length, func(v []byte) []byte {
+	return jsonStringConsumerUnaryBytesToBytes(parameters, result, proc, length, func(v []byte) []byte {
 		sum := sha1.Sum(v)
 		return []byte(hex.EncodeToString(sum[:]))
 	}, selectList)
```

**File**: `pkg/sql/plan/function/json_string_consumers.go` (modified, +88/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
 )
 
 const jsonStringConsumerOverloadID = 1
@@ -54,3 +55,90 @@ func jsonStringConsumerReturnType(parameters []types.Type) types.Type {
 	}
 	return types.NewWithCharset(types.T_text, 0, 0, types.CharsetUTF8MB4Bin)
 }
+
+func jsonStringConsumerResultParameters(parameters []types.Type) []types.Type {
+	// JSON visible text has no VARCHAR width bound. Preserve that fact when
+	// deriving output metadata as well as when consuming the runtime value.
+	if len(parameters) == 0 || parameters[0].Oid != types.T_json {
+		return parameters
+	}
+	result := append([]types.Type(nil), parameters...)
+	result[0] = jsonStringConsumerReturnType(parameters[:1])
+	return result
+}
+
+// Keep JSON in its source type so each consumer can hash or transform the
+// complete visible JSON bytes without an implicit VARCHAR width limit.
+func jsonStringConsumerUnaryFixedTypeMatch(overloads []overload, inputs []types.Type) checkResult {
+	return jsonStringConsumerTypeMatch(overloads, inputs, fixedTypeMatch)
+}
+
+func jsonStringConsumerUnaryDomainTypeMatch(overloads []overload, inputs []types.Type) checkResult {
+	return jsonStringConsumerTypeMatch(overloads, inputs, stringDomainFixedTypeMatch)
+}
+
+// Keep JSON as the bound input so the executor can serialize its complete
+// visible bytes without an intermediate string expression or width bound.
+func jsonStringConsumerTypeMatch(
+	overloads []overload,
+	inputs []types.Type,
+	match func([]overload, []types.Type) checkResult,
+) checkResult {
+	if len(inputs) == 0 || inputs[0].Oid != types.T_json {
+		return match(overloads, inputs)
+	}
+	prepared := append([]types.Type(nil), inputs...)
+	prepared[0] = types.T_varchar.ToType()
+	matched := match(overloads, prepared)
+	if matched.status == succeedMatched {
+		return newCheckResultWithSuccess(matched.idx)
+	}
+	if matched.status != succeedWithCast || len(matched.finalType) != len(inputs) {
+		return matched
+	}
+	castTypes := append([]types.Type(nil), matched.finalType...)
+	castTypes[0] = inputs[0]
+	for i := range inputs {
+		if !inputs[i].Eq(castTypes[i]) {
+			return newCheckResultWithCast(matched.idx, castTypes)
+		}
+	}
+	return newCheckResultWithSuccess(matched.idx)
+}
+
+func jsonStringConsumerUnaryBytesToBytes(
+	parameters []*vector.Vector,
+	result vector.FunctionResultWrapper,
+	proc *process.Process,
+	length int,
+	resultFn func([]byte) []byte,
+	selectList *FunctionSelectList,
+) error {
+	if parameters[0].GetType().Oid != types.T_json {
+		return opUnaryBytesToBytes(parameters, result, proc, length, resultFn, selectList)
+	}
+	source := vector.GenerateFunctionStrParameter(parameters[0])
+	rs := vector.MustFunctionResult[types.Varlena](result)
+	for row := uint64(0); row < uint64(length); row++ {
+		if functionRowSkipped(selectList, row) {
+			if err := rs.AppendBytes(nil, true); err != nil {
+				return err
+			}
+			continue
+		}
+		value, isNull, err := getJSONStringConsumerValue(proc.Ctx, source, row)
+		if err != nil {
+			return err
+		}
+		if isNull {
+			if err := rs.AppendBytes(nil, true); err != nil {
+				return err
+			}
+			continue
+		}
+		if err := rs.AppendBytes(resultFn(value), false); err != nil {
+			return err
+		}
+	}
+	return nil
+}
```

**File**: `pkg/sql/plan/function/list_builtIn.go` (modified, +16/-16)
```diff
@@ -4553,14 +4553,14 @@ var supportedStringBuiltIns = []FuncNew{
 		functionId: COMPRESS,
 		class:      plan.Function_STRICT,
 		layout:     STANDARD_FUNCTION,
-		checkFn:    stringDomainFixedTypeMatch,
+		checkFn:    jsonStringConsumerUnaryDomainTypeMatch,
 
 		Overloads: []overload{
 			{
 				overloadId: 0,
 				args:       []types.T{types.T_varchar},
 				retType: func(parameters []types.Type) types.Type {
-					return compressReturnType(parameters)
+					return compressReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Compress
@@ -4570,7 +4570,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 1,
 				args:       []types.T{types.T_char},
 				retType: func(parameters []types.Type) types.Type {
-					return compressReturnType(parameters)
+					return compressReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Compress
@@ -4580,7 +4580,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 2,
 				args:       []types.T{types.T_text},
 				retType: func(parameters []types.Type) types.Type {
-					return compressReturnType(parameters)
+					return compressReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Compress
@@ -4590,7 +4590,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 3,
 				args:       []types.T{types.T_blob},
 				retType: func(parameters []types.Type) types.Type {
-					return compressReturnType(parameters)
+					return compressReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Compress
@@ -5203,14 +5203,14 @@ var supportedStringBuiltIns = []FuncNew{
 		functionId: QUOTE,
 		class:      plan.Function_STRICT,
 		layout:     STANDARD_FUNCTION,
-		checkFn:    stringDomainFixedTypeMatch,
+		checkFn:    jsonStringConsumerUnaryDomainTypeMatch,
 
 		Overloads: []overload{
 			{
 				overloadId: 0,
 				args:       []types.T{types.T_varchar},
 				retType: func(parameters []types.Type) types.Type {
-					return quoteReturnType(parameters)
+					return quoteReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Quote
@@ -5220,7 +5220,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 1,
 				args:       []types.T{types.T_char},
 				retType: func(parameters []types.Type) types.Type {
-					return quoteReturnType(parameters)
+					return quoteReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Quote
@@ -5230,7 +5230,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 2,
 				args:       []types.T{types.T_text},
 				retType: func(parameters []types.Type) types.Type {
-					return quoteReturnType(parameters)
+					return quoteReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Quote
@@ -7389,14 +7389,14 @@ var supportedStringBuiltIns = []FuncNew{
 		functionId: SOUNDEX,
 		class:      plan.Function_STRICT,
 		layout:     STANDARD_FUNCTION,
-		checkFn:    stringDomainFixedTypeMatch,
+		checkFn:    jsonStringConsumerUnaryDomainTypeMatch,
 
 		Overloads: []overload{
 			{
 				overloadId: 0,
 				args:       []types.T{types.T_varchar},
 				retType: func(parameters []types.Type) types.Type {
-					return soundexReturnType(parameters)
+					return soundexReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Soundex
@@ -7406,7 +7406,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 1,
 				args:       []types.T{types.T_char},
 				retType: func(parameters []types.Type) types.Type {
-					return soundexReturnType(parameters)
+					return soundexReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Soundex
@@ -7416,7 +7416,7 @@ var supportedStringBuiltIns = []FuncNew{
 				overloadId: 2,
 				args:       []types.T{types.T_text},
 				retType: func(parameters []types.Type) types.Type {
-					return soundexReturnType(parameters)
+					return soundexReturnType(jsonStringConsumerResultParameters(parameters))
 				},
 				newOp: func() executeLogicOfOverload {
 					return Soundex
@@ -7432,7 +7432,7 @@ var supportedStringBuiltIns = []FuncNew{
 		integerParameters: []integerParameter{{position: 1, target: types.T_int64}},
 		bindingOverloads:  []int{0},
 		layout:            STANDARD_FUNCTION,
-		checkFn:           stringDomainFixedTypeMatch,
+		checkFn:           jsonStringConsumerUnaryDomainTypeMatch,
 
 		Overloads: []overload{
 			{
@@ -9516,7 +9516,7 @@ var supportedMathBuiltIns = []FuncNew{
 		functionId: MD5,
 		class:      plan.Function_STRICT,
 		layout:     STANDARD_FUNCTION,
-		checkFn:    fixedTypeMat
```

#### Recent Merged Pull Requests:
- **PR #32194** (2026-11-05): fix(hnsw): a CDC batch keeps the sign of -0 on every architecture (@cpegeric)
- **PR #32191** (2026-11-04): fix(hashbuild): bound collected runtime-filter keys (@aunjgr)
- **PR #32186** (2026-11-04): fix(vector): return append rollback failures on 4.2-dev (@aunjgr)
- **PR #32184** (2026-11-04): fix(python): reject overflowing CDC CLI durations (@MatrixAdventurer)
- **PR #32182** (2026-11-05): fix(median): correct unaccounted results across chunks (@XuPeng-SH)
- **PR #32181** (2026-11-04): fix(plan): serve a selected MATCH through views, derived tables and CTEs (#31715) (@cpegeric)

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

## X. vector): return append rollback failures instead of panicking (#32167)

**RULE**:
When implementing operations in `pkg/container/vector/rollback_error_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `948cfbc1`: vector): return append rollback failures instead of panicking (#32167). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/container/vector/rollback_error_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
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

package vector

import (
	"errors"
	"math"
	"strings"
	"testing"

	"github.com/matrixorigin/matrixone/pkg/common/mpool"
	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/stretchr/testify/require"
)

func TestRollbackAppendRejectsBeforeMutation(t *testing.T) {
	for _, name := range []string{"length", "area", "negative", "overflow", "prepared", "string", "binary"} {
		t.Run(name, func(t *testing.T) {
			mp := mpool.MustNewZero()
			v := NewVec(types.T_varchar.ToType())
			defer func() { v.Free(mp); require.Zero(t, mp.CurrNB()); require.Zero(t, mp.OnHeapCurrNB()) }()
			require.NoErro
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `948cfbc1` are properly handled with clean fallback behavior.
