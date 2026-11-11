> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `e2459cc5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T07:01:05.617Z  
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
> **Harvest Timestamp**: 2026-11-09T07:01:04.432Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2063 stars

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
- **Issue #32409** (2026-11-09): **[Bug]: CREATE CDC silently returns success but no task is created (post-upgrade 4.0.7 instance)**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Branch Name  main  ### Commit ID  c6683bd2f531dcaa80e153c0924dac619c49dc9d (instance reports kernel version 4.0.7, upgrade offset 41, upgraded in-place on 2026-11-05; `git_version()` returns `unknown`)  ### Other Environment Information  - macOS arm64 (MacBook Pro, 8 cores, 4 GB free RAM); single-process local instance (**standalone launch: 1 LOG + 1 TN + CN in one `mo-service` process), SHARED storage on local disk. - Instance was booted from a `main` checkout at the commit above and later went through the **built-in upgrade framework** from an older catalog (offline upgrade on 2026-11-05, `mo_catalog.mo_version` shows `4.0.7` / `offset 41`). SQL frontend still reports `8.0.30-MatrixOne-v1.3.0` via `VERSION()`. - No product code modified. CDC source and sink are both this same instance (MO-to-MO via `sink_type = 'matrixone'`), following the official BVT recipe from `test/distributed/cases/dml/show/cdc.test` (including the `mo_ctl('cn','syncCommit','')` step).  ### Actual Behavior  `CREATE CDC` returns success (rc=0, no output, no warning), but **no CDC task is ever created**:  - `mo_catalog.mo_cdc_task` stays at 0 rows; `mo_catalog.mo_cdc_watermark` stays at 0 rows. - `SHOW CDC ALL` returns empty. - The task framework table `mo_task.sys_async_task` only contains the two system tasks (`StorageUsage`, `mo_table_stats`); no CDC task record ever appears. - Server-side, the `create cd

- **Issue #32380** (2026-11-09): **docs: design early runtime filtering and dictionary vector execution**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [x] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32379, #30844, #30845 and #30850.  ## What this PR does / why we need it:  Define the approved execution series for reducing intermediate TPC-H work. The early-filter design derives necessary integer domains from independent filtered scan sources, validates complete local delivery and acyclic dependencies, and filters before shuffle while preserving exact joins and the existing query memory bound.  Define dictionary vectors over immutable backing and accounted shared selections, their logical read and copy-on-write contracts, explicit compatibility boundaries and staged consumer/producer rollout. Keep persisted/wire vectors flat and separate neutral foundations from producer changes that must demonstrate target-query speedups.  ## Design review  Scope and contracts approved by the requester on 2026-11-09. Reviewed version: `adebe845cb`. The documents close owners, state transitions, compatibility, cost/negative controls and the seven-PR delivery/acceptance sequence. Implementation reviews must use the versioned design and document material deviations.  ## Validation  Documentation-only change. Whitespace and the required latest-main pre-push gate passed. No implementation, benchmark or performance-acceptance result is claimed.

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

### Incident Patch 1: `692b50a3` (2026-11-09)
**Commit Message**: fix(group): preserve evaluated inputs across spill retries (#32368)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32369

This bug was found while investigating #32060; the PR does not fix that
issue's performance report.

## What this PR does / why we need it:

A Group can publish part of an input batch, hit a retryable
memory-capacity rejection, and spill that prefix. The retry currently
reevaluates every group expression and aggregate argument for the whole
batch. A volatile expression can consequently contribute values from two
evaluations to the same input batch, producing incorrect groups or
aggregates.

Keep the successfully evaluated vectors and grouping-set sentinels alive
while recovering the resident group state, and retry from the
unpublished chunk. If evaluation itself fails partway through, return
the original error rather than replaying expressions that may already
have side effects. Ordinary post-batch spill, merge, reload, and cleanup
retain their existing lifecycle.

Retaining the input consumes memory until the batch fin

**File**: `docs/design/20261108-group-capacity-retry.md` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+# Preserve evaluated input during Group capacity recovery
+
+Tracking issue: [#32369](https://github.com/matrixorigin/matrixone/issues/32369).
+Implementation PR: [#32368](https://github.com/matrixorigin/matrixone/pull/32368).
+Discovery: [#32060](https://github.com/matrixorigin/matrixone/issues/32060).
+Reviewed baseline: `89ca3dbbf6d594d7614b8e1ca80f6b0300ed3cd2`.
+Design decision: **PASS** for the scope below; implementation and validation
+must be reviewed against this design.
+
+## Problem and scope
+
+Group evaluates one complete child batch before committing it in chunks of at
+most `hashmap.UnitLimit` rows. On an accounted capacity rejection, it can drain
+exact DISTINCT state or spill the committed prefix before retrying an
+unpublished chunk. Currently, spilling resets expression executors and the
+retry path clears `evaluated`. Group consequently evaluates the entire batch
+again, even if an earlier chunk was already published.
+
+An operator test rejects one real allocation after 256 groups are published.
+For 512 rows with an incrementing side-effecting expression, the clean
+baseline spills and reloads, evaluates the root twice, invokes 1,024 side
+effects, and returns group keys `1..256` and `769..1024`. The correct result
+for this input is one evaluation, 512 side effects, and keys `1..512`. The
+test uses the existing allocation-account controller, not a production hook.
+
+This fix is owned by Group's batch and spill lifecycle. It does not fix the
+integer DISTINCT performance reported in #32060, PAD SPACE equality, ordinary
+PK/FD assumptions, or expression replay elsewhere in the pipeline.
+
+## Contract
+
+- Once all group roots, aggregate-argument roots, and rollup sentinels for one
+  child batch are evaluated, every pre-publication retry reuses those exact
+  vectors and the current chunk offset. A committed prefix is never replayed.
+- If the initial `evaluateBuildInput` fails, return its error without retrying
+  that partially evaluated batch. A failed root may already have produced
+  side effects; the same is true when a later root or sentinel allocation
+  fails after an earlier root succeeded. Effects from a failed query are not
+  rolled back, but Group must not automatically repeat them.
+- Only an existing retryable allocation-capacity error at an existing
+  pre-publication boundary may trigger the existing drain or spill recovery.
+  Reuse its progress checks and error handling. Errors after publication,
+  cancellation, failed drain, and failed spill remain terminal.
+- No input expression is shared merely because another expression has an
+  equal AST. The invariant applies to the already evaluated occurrence.
+
+## Design
+
+Factor `container.resetForSpill` in `pkg/sql/colexec/group/types2.go` into a
+resident-state reset and an evaluated-input reset. Resident reset retains the
+existing `distinctGroupReset` transition, releases the hash and accounted
+iterator scratch, detaches the reusable iterator, and releases group-by batches and
+resident and spill aggregate lists. Input reset resets
+the group and aggregate-argument executors and frees the Group-owned rollup
+sentinels. Keep `resetForSpill` as the existing full-reset wrapper.
+
+Keep `spillDataToDisk` in `helper.go` as the full-reset entry point. Factor a
+private variant, or private mode parameter, which after a successful spill
+resets only resident state. The retaining mode has one production caller:
+`Group.retryBuildBatchAfterCapacity`, after the batch evaluation completed.
+Preserve existing spill accounting, recovery floor, measurable-progress
+checks, hash reconstruction, and aggregate-list rebuild.
+
+In `Group.buildOneBatch` in `exec2.go`, return immediately if
+`evaluateBuildInput` fails. After it succeeds, retain the evaluated input through
+both adaptive-growth recovery and ordinary preflight recovery. Exact DISTINCT
+drain does not reset the evaluation. On a successful retaining spill, retry
+the same `i` with a fresh hash preview and the same evaluated vectors. Retain
+the current distinction between explicitly pre-publication commit errors and
+terminal failures in group publication, `GroupGrow`, or `BatchFill`.
+
+`H0` has no group key: initial evaluation already fails directly; later
+aggregate preflight may use exact DISTINCT drain and must keep the evaluated
+argument vectors. It must not start ordinary group spill. SORT ROLLUP has a
+separate call path and is outside this change.
+
+| Existing operation | Evaluation state | Reset after spill |
+| --- | --- | --- |
+| Group capacity retry after successful batch evaluation | Current batch remains live; prefix may be committed | Resident only |
+| Group post-batch spill, end-of-input spill, `vm.EvalReset` | No active build batch | Full |
+| MergeGroup post-batch, end-of-input, and capacity-retry spill | No Group expression-root batch | Full |
+| Spill reload entry, record retry, adaptive respill, and final respill | Replay i
```

**File**: `pkg/sql/colexec/group/capacity_retry_evaluation_test.go` (added, +583/-0)
```diff
@@ -0,0 +1,583 @@
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
+package group
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/aggexec"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/stretchr/testify/require"
+)
+
+type retryStringExpression struct {
+	colexec.ExpressionExecutor
+	vec         *vector.Vector
+	mp          *mpool.MPool
+	selection   *vector.AllocationAccountSelection
+	borrowed    bool
+	calls, rows int
+}
+
+func (e *retryStringExpression) Eval(proc *process.Process, inputs []*batch.Batch, selectList []bool) (*vector.Vector, error) {
+	if e.borrowed {
+		e.calls++
+		result, err := e.ExpressionExecutor.Eval(proc, inputs, selectList)
+		if err == nil {
+			e.rows += inputs[0].RowCount()
+		}
+		return result, err
+	}
+	if e.vec != nil {
+		e.vec.Free(proc.Mp())
+	}
+	e.mp = proc.Mp()
+	e.calls++
+	var err error
+	e.vec, err = vector.NewOffHeapVecWithTypeAndAllocation(types.T_varchar.ToType(), e.selection)
+	if err != nil {
+		return nil, err
+	}
+	for range inputs[0].RowCount() {
+		e.rows++
+		value := fmt.Sprintf("%05d-%s", e.rows, strings.Repeat("x", 96))
+		if err := vector.AppendBytes(e.vec, []byte(value), false, proc.Mp()); err != nil {
+			return nil, err
+		}
+	}
+	return e.vec, nil
+}
+func (e *retryStringExpression) ResetForNextQuery() {
+	if e.vec != nil {
+		e.vec.Free(e.mp)
+		e.vec = nil
+	}
+	e.ExpressionExecutor.ResetForNextQuery()
+}
+func (e *retryStringExpression) Free() {
+	if e.vec != nil {
+		e.vec.Free(e.mp)
+		e.vec = nil
+	}
+	e.ExpressionExecutor.Free()
+}
+
+type retryIntExpression struct {
+	colexec.ExpressionExecutor
+	vec         *vector.Vector
+	mp          *mpool.MPool
+	selection   *vector.AllocationAccountSelection
+	calls, rows int
+}
+
+func (e *retryIntExpression) Eval(proc *process.Process, inputs []*batch.Batch, _ []bool) (*vector.Vector, error) {
+	if e.vec != nil {
+		e.vec.Free(proc.Mp())
+	}
+	e.mp = proc.Mp()
+	e.calls++
+	var err error
+	e.vec, err = vector.NewOffHeapVecWithTypeAndAllocation(types.T_int32.ToType(), e.selection)
+	if err != nil {
+		return nil, err
+	}
+	for range inputs[0].RowCount() {
+		e.rows++
+		if err = vector.AppendFixed(e.vec, int32(e.rows), false, proc.Mp()); err != nil {
+			return nil, err
+		}
+	}
+	return e.vec, nil
+}
+func (e *retryIntExpression) ResetForNextQuery() {
+	if e.vec != nil {
+		e.vec.Free(e.mp)
+		e.vec = nil
+	}
+	e.ExpressionExecutor.ResetForNextQuery()
+}
+func (e *retryIntExpression) Free() {
+	if e.vec != nil {
+		e.vec.Free(e.mp)
+		e.vec = nil
+	}
+	e.ExpressionExecutor.Free()
+}
+
+type observingBudgetController struct {
+	*process.ExecutionResourceGeneration
+	onAcquire func()
+}
+
+func (c *observingBudgetController) AcquireAllocationCapacity(size uint64) error {
+	if c.onAcquire != nil {
+		c.onAcquire()
+	}
+	return c.ExecutionResourceGeneration.AcquireAllocationCapacity(size)
+}
+
+func TestGroupCapacityRecoveryRetainsEvaluatedInput(t *testing.T) {
+	for _, tc := range []struct {
+		name         string
+		rollup       bool
+		partial      bool
+		distinct     bool
+		borrowed     bool
+		adaptive     bool
+		failRecovery bool
+	}{
+		{name: "final"},
+		{name: "rollup", rollup: true},
+		{name: "partial-and-merge", partial: true},
+		{name: "distinct-drain", distinct: true},
+		{name: "borrowed-input", borrowed: true},
+		{name: "adaptive-spill", adaptive: true},
+		{name: "capacity-exhausted-after-spill", rollup: true, failRecovery: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			proc := testutil.NewProcess(t)
+			t.Cleanup(func() {
+				proc.Free()
+				require.Zero(t, proc.Mp().CurrNB())
+			})
+			input := batch.NewWithSize(3)
+			t.Cleanup(func() { input.Clean(proc.Mp()) })
+			keys := make([]string, 512)
+			if tc.borrowed {
+				for i := range keys {
+					keys[i] = fmt.Sprintf("%05d-%s", i+1, strings.Repeat("x", 96))
+				}
+			}
+			input.Vecs[0] = testutil.MakeVarcharVector(keys, nil, proc.Mp())
+			input.Vecs[1] = testuti
```

**File**: `pkg/sql/colexec/group/exec2.go` (modified, +8/-14)
```diff
@@ -657,14 +657,20 @@ func (group *Group) buildOneBatch(proc *process.Process, bat *batch.Batch) (bool
 		// here is a strange loop.   our hash table exposed something called
 		// hashmap.UnitLimit -- which limits per iteration insert mini batch size.
 		count := bat.RowCount()
-		evaluated := false
 		var hashBytesBefore int64
 		var compactHitRows int64
 		compactEligible := !group.DynamicGrouping && !group.ctr.groupingAware && !group.ctr.legacyH8CharSemantics &&
 			compactGroupExpressions(group.GroupBy)
 		if !group.ctr.hr.IsEmpty() {
 			hashBytesBefore = group.ctr.hr.Hash.Size()
 		}
+		if count > 0 {
+			if err = group.evaluateBuildInput(proc, bat); err != nil {
+				// A failed expression may already have side effects. There is
+				// no general safe way to replay a partially evaluated batch.
+				return false, err
+			}
+		}
 		for i := 0; i < count; i += hashmap.UnitLimit {
 			n := min(count-i, hashmap.UnitLimit)
 			var preview groupInsertPreview
@@ -677,16 +683,6 @@ func (group *Group) buildOneBatch(proc *process.Process, bat *batch.Batch) (bool
 			}
 			for {
 				err = nil
-				if !evaluated {
-					if err = group.evaluateBuildInput(proc, bat); err != nil {
-						if retried, retryErr := group.retryBuildBatchAfterCapacity(proc, err); retried {
-							continue
-						} else {
-							return false, retryErr
-						}
-					}
-					evaluated = true
-				}
 				if group.ctr.hr.IsEmpty() {
 					err = group.ctr.buildHashTable(proc.Ctx, 0)
 					if err == nil {
@@ -723,7 +719,6 @@ func (group *Group) buildOneBatch(proc *process.Process, bat *batch.Batch) (bool
 									proc, mpool.ErrAllocationAccountCapacity); !retried {
 									return false, retryErr
 								}
-								evaluated = false
 								continue
 							}
 						}
@@ -809,7 +804,6 @@ func (group *Group) buildOneBatch(proc *process.Process, bat *batch.Batch) (bool
 					}
 				}
 				if retried, retryErr := group.retryBuildBatchAfterCapacity(proc, err); retried {
-					evaluated = false
 					continue
 				} else {
 					return false, retryErr
@@ -968,7 +962,7 @@ func (group *Group) retryBuildBatchAfterCapacity(
 		return false, cause
 	}
 	before := group.ctr.hr.Hash.GroupCount()
-	bytes, rows, err := group.ctr.spillDataToDisk(proc, group.OpAnalyzer, nil)
+	bytes, rows, err := group.ctr.spillDataToDiskWithInput(proc, group.OpAnalyzer, nil, true)
 	if err != nil {
 		return false, err
 	}
```

**File**: `pkg/sql/colexec/group/helper.go` (modified, +6/-1)
```diff
@@ -870,6 +870,11 @@ func (ctr *container) writeSpillRecord(
 }
 
 func (ctr *container) spillDataToDisk(proc *process.Process, opAnalyzer process.Analyzer, parentBkt *spillBucket) (int64, int64, error) {
+	return ctr.spillDataToDiskWithInput(proc, opAnalyzer, parentBkt, false)
+}
+
+// retainInput is used only when retrying a partially consumed input batch.
+func (ctr *container) spillDataToDiskWithInput(proc *process.Process, opAnalyzer process.Analyzer, parentBkt *spillBucket, retainInput bool) (int64, int64, error) {
 	if err, canceled := vm.CancelCheck(proc); canceled {
 		return 0, 0, err
 	}
@@ -1109,7 +1114,7 @@ func (ctr *container) spillDataToDisk(proc *process.Process, opAnalyzer process.
 	}
 
 	// reset ctr for next spill
-	ctr.resetForSpill()
+	ctr.resetSpillState(retainInput)
 	return totalBytes, totalRows, nil
 }
 
```

**File**: `pkg/sql/colexec/group/types2.go` (modified, +15/-8)
```diff
@@ -813,21 +813,28 @@ func (ctr *container) reset() {
 }
 
 func (ctr *container) resetForSpill() {
+	ctr.resetSpillState(false)
+}
+
+// resetSpillState releases resident aggregation state after a spill. A build
+// retry must keep the current input vectors until its unpublished chunk has
+// been consumed; other spill callers can release the expression state too.
+func (ctr *container) resetSpillState(retainInput bool) {
 	if ctr.distinctSpill != nil {
 		ctr.distinctGroupReset = true
 	}
 	// Reset also frees the hash related stuff.
 	ctr.hr.Free0()
 
-	ctr.groupByEvaluate.ResetForNextQuery()
-
-	for i := range ctr.aggArgEvaluate {
-		ctr.aggArgEvaluate[i].ResetForNextQuery()
+	if !retainInput {
+		ctr.groupByEvaluate.ResetForNextQuery()
+		for i := range ctr.aggArgEvaluate {
+			ctr.aggArgEvaluate[i].ResetForNextQuery()
+		}
+		// Grouping-set sentinel vectors are owned outside the expression
+		// executors. Release them before recovery reload borrows capacity.
+		ctr.freeGroupingRollups()
 	}
-	// Grouping-set sentinel vectors are owned outside the expression
-	// executors. Release the just-consumed input's sentinels before recovery
-	// reload borrows the same account capacity.
-	ctr.freeGroupingRollups()
 	// free group by batches, agg list and spill buckets, do not reuse for now.
 	ctr.freeGroupByBatches()
 	ctr.currBatchIdx = 0
```

---

### Incident Patch 2: `93a17bb7` (2026-11-09)
**Commit Message**: fix(plan): prune correlated composite primary-key points (#32377)

## What type of PR is this?

- [x] BUG
- [x] Improvement

## Which issue(s) this PR fixes:

issue #32365

Related 4.2-dev implementation: #32371.

## What this PR does / why we need it:

A predicate like `tenant = ? AND ((session = ? AND request = ?) OR ...)`
describes a small set of complete composite primary keys, but previously
scanned the entire tenant prefix. Derive a bounded set of correlated
keys as a necessary scan filter and retain the full original predicates.

- Reuse existing composite-key encoding, index and join selection, and
reader filtering. Publish points only if the same scan, key, snapshot
and predicate witnesses survive the existing rewrites. Unsafe
comparisons or residuals, unsupported shapes, and exhausted query-wide
admission budgets keep the existing access path.
- Defer execution-value inspection until a point candidate actually
survives access selection. This preserves the existing prepared-plan
cache for index plans that discard the candidate; surviving or
value-dependently rejected candidates use the existing value-dependent
replanning policy. A reused ordinary plan can miss an optimizat

**File**: `docs/design/20261109-correlated-composite-primary-key-points.md` (added, +255/-0)
```diff
@@ -0,0 +1,255 @@
+# Correlated composite-primary-key point pruning
+
+Issue: [#32365](https://github.com/matrixorigin/matrixone/issues/32365)
+Implementation: [#32377](https://github.com/matrixorigin/matrixone/pull/32377)
+Related 4.2 implementation: [#32371](https://github.com/matrixorigin/matrixone/pull/32371)
+
+## Problem and contract
+
+For a composite key `(tenant, session, request)`, a query may request a few
+correlated identities:
+
+```sql
+WHERE tenant = ? AND
+      ((session = ? AND request = ?) OR (session = ? AND request = ?))
+```
+
+On main at `d7185c9a92`, both SQL-prepared and binary-prepared executions
+returned correct results, but the first form scanned 100,001 rows in the
+persisted test table. The comparable factored single-session `IN` form read
+only the two matching rows. A 50-identity prepared UPDATE showed the same
+access-path problem. This is an optimization issue, not a demonstrated wrong
+result.
+
+A further prepared-plan control has a complete point-shaped predicate but
+selects a secondary-index backfill. The eager implementation marked the plan
+value dependent even though no point filter survived; the baseline plan was
+otherwise eligible for the frontend's type-keyed cache. This is a cache-eligibility
+regression for the observed execution, not proof that index selection is
+independent of every possible binding.
+
+For original scan predicate `F` and derived point predicate `C`, a candidate is
+legal only when **every row where `F` is SQL TRUE also satisfies `C`**. It is a
+necessary condition, not a replacement for `F`. Pruning must not suppress or
+introduce observable errors, warnings, or effects, and must preserve parameter
+identity, SQL NULL behavior, duplicate handling, transaction semantics, and
+access control. SQL equality with NULL is unknown, not true; MySQL's documented
+NULL comparison behavior is relevant to MatrixOne's MySQL interface
+([MySQL 8.0 manual](https://dev.mysql.com/doc/refman/8.0/en/working-with-null.html)).
+Physical tuple equality is only usable when the resolved SQL equality domain
+has the same relevant semantics. In particular, a residual cannot recover a
+SQL-equal row excluded by an incorrectly encoded point.
+
+The goal is to avoid broad prefix scans for bounded, provable sets of complete
+correlated primary-key points, including prepared SELECT and DML. The original
+predicate and normal fallback remain authoritative. General OR index union,
+Cartesian expansion of independent ORs, new tuple-lookup storage APIs, and
+changing secondary-index or join costing are not goals.
+
+## Alternatives and ownership
+
+1. **Keep the existing prefix scan and ask users to factor queries.** It has no
+   new planning cost and is correct, but does not solve cross-session batches.
+2. **Normalize all ORs into a general union or publish points before costing.**
+   This could cover more expressions, but needs a broader cost model and can
+   change join, vector-index, covering-index, and limit decisions. Independent
+   OR expansion can also grow combinatorially. That work is outside this fix.
+3. **Capture a bounded proposal before composite-key lowering and publish it
+   after access selection if its proof survives.** This retains the existing
+   optimizer, encoding and reader owners while covering the reported workload.
+   It adds transient proof, planning work, and value-dependent replanning; the
+   tradeoffs and limits below are part of the decision.
+
+The existing scan `FilterList` owns SQL semantics; `BlockFilterList` is derived
+pruning state. Existing composite-key lowering owns encoding, existing access
+selection owns index decisions, and `readutil` owns PK filter selection and
+vector cleanup. The query planner owns only a short-lived proposal and shared
+admission budget. See the preceding
+[secondary-index and composite-key design](20261024-secondary-index-primary-prefix.md)
+for the existing early/late lowering boundary. No catalog, on-disk, wire, or
+client API is added.
+
+## Analysis and publication
+
+After scan predicate pushdown and before ordinary composite-key lowering, walk
+eligible scan predicates and collect facts on the physical primary-key parts.
+Each selected OR arm must, together with inherited conjunctions, imply one
+complete tuple for the same scan. Select one independently sufficient OR; do
+not multiply separate ORs. Incomplete arms, unsupported expressions, malformed
+metadata, absent proof, or exhausted budget leave the established access path
+in place. This phase must not inspect execution values or change prepared-binding
+state. Before copying, charge the shape and metadata. Freeze one independently
+owned typed copy per distinct source expression, and let tuple positions refer
+to those copies. Capture every recognized equality that may be skipped, not
+just selected tuple facts. Preserve original parameter ordinals, type/collation,
+casts, and literal provenance; do not retain mutable original-expre
```

**File**: `pkg/frontend/prepared_composite_point_test.go` (added, +300/-0)
```diff
@@ -0,0 +1,300 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
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
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	pbstats "github.com/matrixorigin/matrixone/pkg/pb/statsinfo"
+	"github.com/matrixorigin/matrixone/pkg/sql/compile"
+	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/stretchr/testify/require"
+)
+
+func preparedCompositePointTable(t *testing.T) (*plan2.MockCompilerContext, *plan.TableDef) {
+	t.Helper()
+	base := plan2.NewMockCompilerContext(true, newPlanTestProcess(t))
+	_, table, err := base.Resolve("tpch", "partsupp", nil)
+	require.NoError(t, err)
+	keys := []string{"ps_partkey", "ps_suppkey", "ps_comment"}
+	for _, col := range table.Cols {
+		for _, key := range keys {
+			if col.Name == key {
+				col.Typ = plan.Type{Id: int32(types.T_varchar), Width: 16, NotNullable: true, Charset: uint32(types.CharsetUTF8)}
+			}
+		}
+	}
+	hidden := plan2.MakeHiddenColDefByName(catalog.CPrimaryKeyColName)
+	table.Pkey = &plan.PrimaryKeyDef{PkeyColName: catalog.CPrimaryKeyColName, Names: keys, CompPkeyCol: hidden}
+	table.ClusterBy = nil
+	rowID := table.Cols[len(table.Cols)-1]
+	table.Cols[len(table.Cols)-1] = hidden
+	table.Cols = append(table.Cols, rowID)
+	table.Name2ColIndex = make(map[string]int32)
+	for i, col := range table.Cols {
+		table.Name2ColIndex[col.Name] = int32(i)
+	}
+	return base, table
+}
+
+func preparedCompositePointPositions(t *testing.T, p *plan.Plan) [][]int32 {
+	t.Helper()
+	for _, node := range p.GetQuery().Nodes {
+		if node.NodeType != plan.Node_TABLE_SCAN || node.TableDef == nil {
+			continue
+		}
+		for _, expr := range node.FilterList {
+			fn := expr.GetF()
+			if fn == nil || fn.Func == nil || fn.Func.ObjName != "in" || len(fn.Args) != 2 {
+				continue
+			}
+			col := fn.Args[0].GetCol()
+			if col == nil || !strings.HasSuffix(col.Name, catalog.CPrimaryKeyColName) || fn.Args[1].GetList() == nil {
+				continue
+			}
+			var tuples [][]int32
+			for _, tuple := range fn.Args[1].GetList().List {
+				var positions []int32
+				require.NoError(t, plan.VisitExprTree(tuple, func(e *plan.Expr) error {
+					if p := e.GetP(); p != nil {
+						positions = append(positions, p.Pos)
+					}
+					return nil
+				}))
+				tuples = append(tuples, positions)
+			}
+			return tuples
+		}
+	}
+	return nil
+}
+
+func setPreparedCompositePointParams(t *testing.T, prepared *PrepareStmt, cw *TxnComputationWrapper, values ...any) {
+	t.Helper()
+	cw.proc.SetPrepareParams(nil)
+	if prepared.params != nil {
+		prepared.params.Free(cw.proc.Mp())
+	}
+	prepared.params = vector.NewVec(types.T_text.ToType())
+	prepared.ParamTypes = nil
+	for _, value := range values {
+		var data []byte
+		switch v := value.(type) {
+		case nil:
+		case string:
+			data = []byte(v)
+		case []byte:
+			data = v
+		default:
+			t.Fatalf("unsupported test parameter %T", value)
+		}
+		require.NoError(t, vector.AppendBytes(prepared.params, data, value == nil, cw.proc.Mp()))
+		prepared.ParamTypes = append(prepared.ParamTypes, byte(defines.MYSQL_TYPE_VAR_STRING), 0)
+	}
+}
+
+func executePreparedCompositePoint(t *testing.T, ses *Session, prepared *PrepareStmt, cw *TxnComputationWrapper, execCtx *ExecCtx, ctx plan2.CompilerContext) *plan.Plan {
+	t.Helper()
+	_, result, clone, _, owned, err := initExecuteStmtParamWithResolverInSession(execCtx, ses, ses, cw, nil, prepared.Name, ctx.Resolve, ctx)
+	if owned && clone != nil {
+		clone.Free()
+	}
+	require.NoError(t, err)
+	return result
+}
+
+func TestPreparedCompositePointRetryKeepsBindings(t *testing.T) {
+	base, table := preparedCompositePointTable(t)
+	ctx := &preparedStatsTestCompiler{
+		preparedTestCompiler: &preparedTestCompiler{CompilerContext: base, proc: base.GetProcess()},
+		stats:                &pbstats.StatsInfo{TableCnt: 128}, table: table,
+	}
+	query := "select ps_availqty from partsupp where ps_partkey=? and ((ps_suppkey=? and ps_comment=?) or (ps_suppkey=? and ps_comment=?))"
+	ses, prepared, cw, execCtx := newPreparedExecuteEnvForSQLWithCompilerContext(t, 32365, query, ctx)
+	ctx.proc, prepared.proc = cw.proc, cw.proc
+	prepared.defaultDatabase = "tpch"
+	t.Cleanup(func() {
+		cw.proc.SetPreparePa
```

**File**: `pkg/sql/plan/composite_key_points.go` (added, +862/-0)
```diff
@@ -0,0 +1,862 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
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
+	"bytes"
+	"context"
+	"errors"
+	"unicode/utf8"
+
+	"github.com/gogo/protobuf/proto"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+)
+
+// These limits bound analysis and the added candidate data per query. String
+// values are charged using their actual bytes, not the column's declared width.
+const (
+	maxCompositePointNodes = 2048
+	maxCompositePointDepth = 256
+	maxCompositePoints     = 128
+	compositePointCopies   = 4
+	// The budget is shared by all candidates in one query, not per scan. The
+	// charge below allows for the row and block filters and their working copies.
+	// Execution fan-out can still multiply memory across readers and nodes.
+	maxCompositePointBytes = 8 << 20
+)
+
+type compositePointAnalysis struct {
+	ctx     context.Context
+	proc    *process.Process
+	tag     int32
+	parts   map[int32]int
+	types   []plan.Type
+	values  []*plan.Expr
+	visited int
+}
+
+type compositePointSet struct {
+	values     [][]*plan.Expr
+	checked    []*plan.Expr
+	shapeBytes uint64
+}
+
+// compositePointCandidate identifies a value-independent shape. Its references
+// must be frozen before ordinary lowering can mutate the original predicates.
+// A nil result keeps the existing access path.
+func compositePointCandidate(ctx context.Context, node *plan.Node, remaining uint64) *compositePointSet {
+	if node == nil || node.TableDef == nil || node.TableDef.Pkey == nil ||
+		len(node.BindingTags) == 0 || node.TableDef.ClusterBy != nil ||
+		remaining < 2*compositePointCopies*types.DefaultPackerCapacity() {
+		return nil
+	}
+	table := node.TableDef
+	key := table.Pkey
+	if len(key.Names) < 2 || len(key.Names) > maxCompositePointNodes ||
+		key.PkeyColName != catalog.CPrimaryKeyColName || key.CompPkeyCol == nil ||
+		tableDefHasNativeUnicodeKeyPart(table, key.Names) {
+		return nil
+	}
+	// Most composite-key scans contain no disjunction. Avoid allocating the
+	// fact map or examining scalar expressions on that common path.
+	nodesRemaining := maxCompositePointNodes
+	hasDisjunction := false
+	for _, filter := range node.FilterList {
+		if compositePointHasOr(filter, 0, &nodesRemaining) {
+			hasDisjunction = true
+			break
+		}
+	}
+	if !hasDisjunction {
+		return nil
+	}
+	keyPos, ok := table.Name2ColIndex[key.PkeyColName]
+	if !ok || keyPos < 0 || int(keyPos) >= len(table.Cols) || table.Cols[keyPos] == nil ||
+		!table.Cols[keyPos].Hidden || table.Cols[keyPos].Name != key.PkeyColName ||
+		types.T(table.Cols[keyPos].Typ.Id) != types.T_varchar {
+		return nil
+	}
+	a := compositePointAnalysis{
+		ctx:   ctx,
+		tag:   node.BindingTags[0],
+		parts: make(map[int32]int, len(key.Names)),
+		types: make([]plan.Type, len(key.Names)),
+	}
+	for i, name := range key.Names {
+		pos, found := table.Name2ColIndex[name]
+		if !found || pos < 0 || int(pos) >= len(table.Cols) || table.Cols[pos] == nil || table.Cols[pos].Name != name {
+			return nil
+		}
+		if _, duplicate := a.parts[pos]; duplicate || !compositePointType(table.Cols[pos].Typ) {
+			return nil
+		}
+		a.parts[pos], a.types[i] = i, table.Cols[pos].Typ
+	}
+	points, ok := a.conjunction(node.FilterList, make([]*plan.Expr, len(key.Names)), false, 0)
+	if !ok || len(points) < 2 {
+		return nil
+	}
+	// The point count is known without inspecting parameter values. If even
+	// the minimum packers do not fit, the fallback is not value-dependent.
+	if uint64(len(points)) > remaining/(compositePointCopies*types.DefaultPackerCapacity()) {
+		return nil
+	}
+	// A point candidate can suppress evaluation on rows it prunes. Prove every
+	// predicate's shape is safe before any execution-bound value is inspected.
+	for _, filter := range node.FilterList {
+		if !a.safePredicate(filter, 0) {
+			return nil
+		}
+	}
+	// Charge independently owned value expressions and tuple references before
+	// copying them. Values used only by an unselected equality are needed too:
+	// early pruning must not suppress a fallible evaluation of that equality.
+	var bytes uint64
+	checked := make([]*plan.Expr, 0, len(a.values))
+	seen := make(map[*plan.Expr]struct{}, len(a.values))
+	for _, value := range a.values {
+		i
```

**File**: `pkg/sql/plan/composite_key_points_test.go` (added, +867/-0)
```diff
@@ -0,0 +1,867 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
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
+	"errors"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/gogo/protobuf/proto"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
+	"github.com/stretchr/testify/require"
+)
+
+func TestCompositePointCandidate(t *testing.T) {
+	ctx := NewMockCompilerContext(true, newPlanTestProcess(t))
+	table := makeExprOptThreePartCompositeSortKeyTableDef()
+	delete(table.Name2ColIndex, table.Pkey.PkeyColName)
+	table.Cols[3].Name = catalog.CPrimaryKeyColName
+	table.Cols[3].Hidden = true
+	table.Name2ColIndex[catalog.CPrimaryKeyColName] = 3
+	table.Pkey.PkeyColName = catalog.CPrimaryKeyColName
+	table.Pkey.CompPkeyCol = table.Cols[3]
+	const tag = 10
+	eq := func(pos int32, value int64) *pb.Expr {
+		return makeExprOptBinaryInt64Expr(t, ctx, "=", makeExprOptInt64Col(tag, pos, table.Cols[pos].Name), value)
+	}
+	logical := func(name string, args ...*pb.Expr) *pb.Expr {
+		expr, err := BindFuncExprImplByPlanExpr(ctx.GetContext(), name, args[:2])
+		require.NoError(t, err)
+		expr.GetF().Args = args
+		return expr
+	}
+	and := func(args ...*pb.Expr) *pb.Expr { return logical("and", args...) }
+	or := func(args ...*pb.Expr) *pb.Expr { return logical("or", args...) }
+	point := func(b, c int64) *pb.Expr { return and(eq(1, b), eq(2, c)) }
+	first, second := point(2, 3), point(4, 5)
+	commuted, err := BindFuncExprImplByPlanExpr(ctx.GetContext(), "=", []*pb.Expr{
+		MakePlan2Int64ConstExprWithType(7), makeExprOptInt64Col(tag, 1, "b"),
+	})
+	require.NoError(t, err)
+	foreign := makeExprOptBinaryInt64Expr(t, ctx, "=", makeExprOptInt64Col(tag+1, 1, "b"), 2)
+	rangeFilter := makeExprOptBinaryInt64Expr(t, ctx, ">", makeExprOptInt64Col(tag, 2, "c"), 0)
+	dynamicLiteral := eq(1, 4)
+	dynamicLiteral.GetF().Args[1].GetLit().Src = &pb.Expr{Expr: &pb.Expr_P{P: &pb.ParamRef{Pos: 1}}}
+	for _, tc := range []struct {
+		name    string
+		filters []*pb.Expr
+		want    [][]int64
+	}{
+		{"correlated", []*pb.Expr{eq(0, 1), or(first, second)}, [][]int64{{1, 2, 3}, {1, 4, 5}}},
+		{"shared suffix and reversed equality", []*pb.Expr{eq(0, 1), eq(2, 9), or(commuted, eq(1, 8))}, [][]int64{{1, 7, 9}, {1, 8, 9}}},
+		{"nested", []*pb.Expr{eq(0, 1), or(first, and(eq(1, 4), or(eq(2, 5), eq(2, 6))))}, [][]int64{{1, 2, 3}, {1, 4, 5}, {1, 4, 6}}},
+		{"contradictory branch", []*pb.Expr{eq(0, 1), or(and(eq(0, 9), eq(1, 2), eq(2, 3)), second)}, [][]int64{{1, 2, 3}, {1, 4, 5}}},
+		{"incomplete branch", []*pb.Expr{eq(0, 1), or(first, eq(1, 4))}, nil},
+		{"foreign column", []*pb.Expr{eq(0, 1), or(first, and(foreign, eq(2, 5)))}, nil},
+		{"independent ORs are not multiplied", []*pb.Expr{eq(0, 1), or(eq(1, 2), eq(1, 4)), or(eq(2, 3), eq(2, 5))}, nil},
+		{"failed OR does not leak points into later OR", []*pb.Expr{eq(0, 1), or(first, eq(1, 4)), or(point(6, 7), point(8, 9))}, [][]int64{{1, 6, 7}, {1, 8, 9}}},
+		{"safe range residual", []*pb.Expr{eq(0, 1), or(first, second), rangeFilter}, [][]int64{{1, 2, 3}, {1, 4, 5}}},
+		{"dynamic folded literal", []*pb.Expr{eq(0, 1), or(first, and(dynamicLiteral, eq(2, 5)))}, nil},
+		{"existing single point", []*pb.Expr{eq(0, 1), eq(1, 2), eq(2, 3), or(eq(1, 2), eq(1, 4))}, nil},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			before := DeepCopyExprList(tc.filters)
+			node := &pb.Node{NodeType: pb.Node_TABLE_SCAN, TableDef: table, BindingTags: []int32{tag}, FilterList: tc.filters}
+			got := compositePointCandidate(ctx.GetContext(), node, maxCompositePointBytes)
+			if tc.want == nil {
+				require.Nil(t, got)
+			} else {
+				require.NotNil(t, got)
+				require.Len(t, got.values, len(tc.want))
+				for i := range got.values {
+					for j := range got.values[i] {
+						require.Equal(t, tc.want[i][j], got.values[i][j].GetLit().GetI64Val())
+					}
+				}
+			}
+			for i := range before {
+				require.True(t, proto.Equal(before[i], tc.filters[i]), "analysis changed the SQL predicate")
+			}
+		})
+	}
+
+	t.Run("bounded points", func(t *testing.T) {
+		arms := make([]*pb.Expr, maxCompositePoints+1)
+		for i := range arms {
+			arms[i] = point(int64(i), int64(i))
+		}
+		node := &pb.Node{TableDef: table, BindingTags: []int32{tag}, FilterList
```

**File**: `pkg/sql/plan/explain/explain_expr.go` (modified, +4/-0)
```diff
@@ -636,6 +636,10 @@ func funcExprExplain(ctx context.Context, funcExpr *plan.Function, Typ *plan.Typ
 			if err != nil {
 				return err
 			}
+		} else {
+			// A hidden-key value is deliberately redacted. An empty pair of
+			// parentheses would instead suggest an empty IN set.
+			buf.WriteString("<opaque>")
 		}
 		buf.WriteString(")")
 	case function.EXISTS_ANY_PREDICATE:
```

**File**: `pkg/sql/plan/explain/explain_expr_serialized_test.go` (modified, +26/-0)
```diff
@@ -156,6 +156,32 @@ func TestSerializedLiteralRedactionAppliesAcrossExpressionLayouts(t *testing.T)
 	}
 }
 
+func TestCompositeKeyInExplainShowsRedaction(t *testing.T) {
+	mp := mpool.MustNew(t.Name())
+	vec := vector.NewVec(types.T_varchar.ToType())
+	defer vec.Free(mp)
+	require.NoError(t, vector.AppendBytes(vec, []byte{0, 1, 2}, false, mp))
+	data, err := vec.MarshalBinary()
+	require.NoError(t, err)
+	registered, err := function.GetFunctionByName(context.Background(), "in",
+		[]types.Type{types.T_varchar.ToType(), types.T_varchar.ToType()})
+	require.NoError(t, err)
+	expr := &planpb.Expr{Expr: &planpb.Expr_F{F: &planpb.Function{
+		Func: &planpb.ObjectRef{Obj: registered.GetEncodedOverloadID(), ObjName: "in"},
+		Args: []*planpb.Expr{
+			{Typ: planpb.Type{Id: int32(types.T_varchar)}, Expr: &planpb.Expr_Col{Col: &planpb.ColRef{Name: catalog.CPrimaryKeyColName}}},
+			{Typ: planpb.Type{Id: int32(types.T_varchar)}, Expr: &planpb.Expr_Vec{Vec: &planpb.LiteralVec{Data: data, Len: 1, IsSerialized: true}}},
+		},
+	}}}
+	var text bytes.Buffer
+	require.NoError(t, describeExpr(context.Background(), expr, NewExplainDefaultOptions(), &text))
+	require.Equal(t, catalog.CPrimaryKeyColName+" in (<opaque>)", text.String())
+	var jsonText bytes.Buffer
+	require.NoError(t, describeExpr(context.Background(), expr, &ExplainOptions{CompleteLiteralVectors: true}, &jsonText))
+	require.Contains(t, jsonText.String(), "serialized_vec(")
+	require.Contains(t, jsonText.String(), "0x000102")
+}
+
 func TestBinaryLiteralExplainUsesHex(t *testing.T) {
 	got := describeComparisonForLiteralTest(t, "payload", "=", "AB", types.T_varchar, true, false)
 	if want := "(payload = 0x4142)"; got != want {
```

**File**: `pkg/sql/plan/expr_opt.go` (modified, +5/-2)
```diff
@@ -678,11 +678,11 @@ type compositePartBlockFilter struct {
 	copy     *plan.Expr
 }
 
-func (builder *QueryBuilder) collectCompositePartBlockFilters(nodeID int32, deferredOnly bool) (map[int32][]compositePartBlockFilter, bool) {
+func (builder *QueryBuilder) collectCompositePartBlockFilters(nodeID int32, deferredOnly bool, points *compositePointCapture) (map[int32][]compositePartBlockFilter, bool) {
 	var ret map[int32][]compositePartBlockFilter
 	needsLate := false
 	blockDisabled := builder.optimizerHints != nil && builder.optimizerHints.blockFilter == 2
-	if blockDisabled && !deferredOnly {
+	if blockDisabled && !deferredOnly && points == nil {
 		return nil, false
 	}
 	visited := make(map[int32]struct{})
@@ -699,6 +699,9 @@ func (builder *QueryBuilder) collectCompositePartBlockFilters(nodeID int32, defe
 			}
 			return
 		}
+		if points != nil {
+			points.collect(builder, id, node)
+		}
 
 		if deferredOnly {
 			if len(node.FilterList) == 0 || len(node.BindingTags) == 0 || node.TableDef.Pkey == nil || !compositeKeyFiltersNeedIndexSelection(node.TableDef) {
```

**File**: `pkg/sql/plan/expr_opt_test.go` (modified, +7/-7)
```diff
@@ -705,7 +705,7 @@ func TestCompositeKeyFoldedInVectorRetainsPartBlockFilters(t *testing.T) {
 		FilterList:  []*planpb.Expr{aEq, bIn},
 	}}
 
-	parts, _ := builder.collectCompositePartBlockFilters(0, false)
+	parts, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	builder.qry.Nodes[0].FilterList = builder.doMergeFiltersOnCompositeKey(true, tableDef, tag, aEq, bIn)
 	builder.retainConsumedCompositePartBlockFilters(parts)
 	foldTableScanFilters(ctx.GetProcess(), builder.qry, 0, true)
@@ -1012,7 +1012,7 @@ func TestCompositeKeyPushesCompoundAndPartBlockFilters(t *testing.T) {
 		FilterList:  []*planpb.Expr{aEq, bGt, bLt},
 	}}
 
-	parts, _ := builder.collectCompositePartBlockFilters(0, false)
+	parts, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	builder.qry.Nodes[0].FilterList = builder.doMergeFiltersOnCompositeKey(true, tableDef, tag, aEq, bGt, bLt)
 	builder.retainConsumedCompositePartBlockFilters(parts)
 	foldTableScanFilters(builder.compCtx.GetProcess(), builder.qry, 0, true)
@@ -1034,7 +1034,7 @@ func TestCompositeKeyPushesCompoundAndPartBlockFilters(t *testing.T) {
 
 	// Rebuilding statistics must not lose constituent filters from an
 	// indexed scan whose row filter is already compounded.
-	parts, _ = builder.collectCompositePartBlockFilters(0, false)
+	parts, _ = builder.collectCompositePartBlockFilters(0, false, nil)
 	require.Len(t, parts[0], 3, "consumed predicates survive only in the block filters")
 	for _, candidate := range parts[0] {
 		require.NotSame(t, candidate.original, candidate.copy)
@@ -1067,7 +1067,7 @@ func TestCompositeKeyPartBlockFiltersRespectDisableHint(t *testing.T) {
 		},
 	}}
 
-	parts, _ := builder.collectCompositePartBlockFilters(0, false)
+	parts, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	require.Empty(t, parts)
 	builder.qry.Nodes[0].FilterList = builder.doMergeFiltersOnCompositeKey(true,
 		tableDef, tag, builder.qry.Nodes[0].FilterList...)
@@ -1088,7 +1088,7 @@ func TestCompositeKeyPreservesPartWhenRewriteMutatesPredicateInPlace(t *testing.
 		FilterList:  []*planpb.Expr{aEq},
 	}}
 
-	parts, _ := builder.collectCompositePartBlockFilters(0, false)
+	parts, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	builder.mergeFiltersOnCompositeKey(0, true)
 	builder.retainConsumedCompositePartBlockFilters(parts)
 	builder.appendCompoundKeyBlockFilters(0)
@@ -1122,7 +1122,7 @@ func TestCompositeKeyPartBlockFiltersDoNotRestoreUnchangedPredicates(t *testing.
 		FilterList:  []*planpb.Expr{filter},
 	}}
 
-	candidates, _ := builder.collectCompositePartBlockFilters(0, false)
+	candidates, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	builder.retainConsumedCompositePartBlockFilters(candidates)
 	require.Empty(t, candidates, "unchanged predicates must be left to later rewrites and stats")
 }
@@ -1140,7 +1140,7 @@ func TestCompositeKeyPartBlockFiltersTrackCanonicalizedPredicateIdentity(t *test
 		FilterList:  []*planpb.Expr{filter},
 	}}
 
-	candidates, _ := builder.collectCompositePartBlockFilters(0, false)
+	candidates, _ := builder.collectCompositePartBlockFilters(0, false, nil)
 	builder.mergeFiltersOnCompositeKey(0, true)
 	builder.retainConsumedCompositePartBlockFilters(candidates)
 	require.Empty(t, candidates, "an in-place canonicalized predicate was not consumed")
```

---

### Incident Patch 3: `90e905a3` (2026-11-09)
**Commit Message**: fix(frontend): reduce disconnect scan stalls during KILL (#32378)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Part of #32362; keep the issue open. The 4.2-dev change is #32364; main
already has a one-second disconnect probe without the 30-second grace
described in that issue.

## What this PR does / why we need it:

On main, an idle connection's `KILL CONNECTION` can hold the routine
request mutex while closing its protocol. A disconnect scan that has
already snapshotted that routine can then wait behind a slow close
before it reaches another disconnected request. This change removes that
lock-held close when the routine and its lifecycle controller are
uncontended and idle. It seals the existing lifecycle controller before
releasing the locks, so a reset or migration cannot acquire the session
while the protocol is closing. Busy or contended paths retain their
previous behavior; this does not guarantee that every disconnect scan is
nonblocking.

A request finishing concurrently with KILL now hands connection closure
to the existing connection

**File**: `pkg/frontend/routine.go` (modified, +64/-21)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"io"
 	"strings"
 	"sync"
 	"sync/atomic"
@@ -146,15 +147,29 @@ func (rt *Routine) shouldCloseConnection() bool {
 	return routineCtx != nil && context.Cause(routineCtx) != nil
 }
 
-func (rt *Routine) setInProcessRequest(b bool) {
+func (rt *Routine) beginClientRequest() bool {
 	rt.mu.Lock()
 	defer rt.mu.Unlock()
-	rt.inProcessRequest = b
-	if b {
-		rt.requestStartedAt.Store(clientRequestClockValue(time.Now()))
-	} else {
-		rt.requestStartedAt.Store(0)
+	if rt.isCancelled() {
+		return false
+	}
+	rt.inProcessRequest = true
+	rt.requestStartedAt.Store(clientRequestClockValue(time.Now()))
+	return true
+}
+
+// endClientRequest hands a concurrent KILL to the connection owner after the
+// response has been attempted, without replacing an existing error.
+func (rt *Routine) endClientRequest(err error) error {
+	rt.mu.Lock()
+	rt.inProcessRequest = false
+	rt.requestStartedAt.Store(0)
+	cancelled := rt.isCancelled()
+	rt.mu.Unlock()
+	if err == nil && cancelled {
+		return io.EOF
 	}
+	return err
 }
 
 func (rt *Routine) requestRunningLongerThan(nowValue int64, minimum time.Duration) bool {
@@ -183,9 +198,10 @@ func (rt *Routine) execCallbackBasedOnRequest(want bool, callback func()) {
 
 func (rt *Routine) releaseRoutineCtx() {
 	rt.mu.Lock()
-	defer rt.mu.Unlock()
-	if rt.cancelRoutineFunc != nil {
-		rt.cancelRoutineFunc()
+	cancel := rt.cancelRoutineFunc
+	rt.mu.Unlock()
+	if cancel != nil {
+		cancel()
 	}
 }
 
@@ -234,7 +250,7 @@ func (rt *Routine) getSession() *Session {
 func (rt *Routine) setCancelRequestFunc(cf context.CancelFunc) {
 	rt.mu.Lock()
 	rt.cancelRequestFunc = cf
-	closing := rt.closing.Load()
+	closing := rt.closing.Load() || rt.isCancelled()
 	rt.mu.Unlock()
 	if closing && cf != nil {
 		cf()
@@ -434,7 +450,11 @@ func (rt *Routine) countConnectionIfNeeded(ses *Session) {
 // handleSessionCommand executes commands that replace the Session generation.
 // They cannot run through handleRequest because request admission pins the old
 // generation until that function returns.
-func (rt *Routine) handleSessionCommand(ctx context.Context, req *Request) error {
+func (rt *Routine) handleSessionCommand(ctx context.Context, req *Request) (retErr error) {
+	if !rt.beginClientRequest() {
+		return io.EOF
+	}
+	defer func() { retErr = rt.endClientRequest(retErr) }()
 	oldSession := rt.getSession()
 	if oldSession == nil {
 		return moerr.NewInternalError(ctx, "cannot reset a missing session")
@@ -448,8 +468,6 @@ func (rt *Routine) handleSessionCommand(ctx context.Context, req *Request) error
 	)
 	defer cancel()
 
-	rt.setInProcessRequest(true)
-	defer rt.setInProcessRequest(false)
 	v2.StartHandleRequestCounter.Inc()
 	defer v2.EndHandleRequestCounter.Inc()
 
@@ -631,18 +649,43 @@ func (rt *Routine) killConnection(killMyself bool) {
 		//will be closed finally.
 		rt.releaseRoutineCtx()
 
-		//If it is in processing the request, it responds to the client normally
-		//before closing the network to avoid the mysql client to be hung.
-		closeConn := func() {
-			//If it is not in processing the request, just close the network
-			proto := rt.getProtocol()
-			if proto != nil {
+		// If the controller and request are idle, seal admission and close the
+		// protocol without holding the request lock across network I/O.
+		if rt.tryCloseIdleAfterKill() {
+			return
+		}
+		rt.execCallbackBasedOnRequest(false, func() {
+			if proto := rt.getProtocol(); proto != nil {
 				proto.Close()
 			}
-		}
+		})
+	}
+}
 
-		rt.execCallbackBasedOnRequest(false, closeConn)
+// tryCloseIdleAfterKill only claims an idle session when neither lifecycle nor
+// request admission can race the protocol close.
+func (rt *Routine) tryCloseIdleAfterKill() bool {
+	if !rt.mc.TryLock() {
+		return false
+	}
+	if rt.mc.inProgress || rt.mc.requestInProgress || rt.mc.resetWaiterPending || !rt.mu.TryLock() {
+		rt.mc.Unlock()
+		return false
+	}
+	if rt.inProcessRequest {
+		rt.mu.Unlock()
+		rt.mc.Unlock()
+		return false
+	}
+	rt.mc.closed = true
+	rt.mc.cond.Broadcast()
+	proto := rt.getProtocol()
+	rt.mu.Unlock()
+	rt.mc.Unlock()
+	if proto != nil {
+		proto.Close()
 	}
+	return true
 }
 
 // cleanup When the io is closed, the cleanup will be called in callback Closed().
```

**File**: `pkg/frontend/routine_kill_handoff_test.go` (added, +425/-0)
```diff
@@ -0,0 +1,425 @@
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
+package frontend
+
+import (
+	"context"
+	"errors"
+	"io"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/config"
+	"github.com/stretchr/testify/require"
+)
+
+type observedKillProtocol struct {
+	*testMysqlWriter
+	closed chan struct{}
+	once   sync.Once
+}
+
+func (p *observedKillProtocol) Close() { p.once.Do(func() { close(p.closed) }) }
+
+func TestKillRequestFinishHandsCloseToConnectionOwner(t *testing.T) {
+	for _, priorError := range []bool{false, true} {
+		t.Run(map[bool]string{false: "successful response", true: "existing error"}[priorError], func(t *testing.T) {
+			protocol := &observedKillProtocol{testMysqlWriter: &testMysqlWriter{}, closed: make(chan struct{})}
+			rt := NewRoutine(context.Background(), protocol, &config.FrontendParameters{})
+			require.True(t, rt.mc.tryBeginRequest())
+			require.True(t, rt.beginClientRequest())
+			// The request's last connection check wins just before KILL.
+			require.False(t, rt.shouldCloseConnection())
+			rt.killConnection(false)
+			select {
+			case <-protocol.closed:
+				t.Fatal("an active request must finish its response before close")
+			default:
+			}
+			var input error
+			if priorError {
+				input = errors.New("response failed")
+			}
+			result := rt.endClientRequest(input)
+			if input == nil {
+				require.ErrorIs(t, result, io.EOF)
+			} else {
+				require.ErrorIs(t, result, input)
+			}
+			rt.mc.endRequest()
+			require.False(t, rt.beginClientRequest())
+			late, cancel := context.WithCancel(context.Background())
+			defer cancel()
+			rt.setCancelRequestFunc(cancel)
+			require.ErrorIs(t, late.Err(), context.Canceled)
+		})
+	}
+	t.Run("self KILL preserves the response", func(t *testing.T) {
+		protocol := &observedKillProtocol{testMysqlWriter: &testMysqlWriter{}, closed: make(chan struct{})}
+		rt := NewRoutine(context.Background(), protocol, &config.FrontendParameters{})
+		require.True(t, rt.beginClientRequest())
+		rt.killConnection(true)
+		select {
+		case <-protocol.closed:
+			t.Fatal("self KILL closed before the response was finished")
+		default:
+		}
+		require.ErrorIs(t, rt.endClientRequest(nil), io.EOF)
+	})
+}
+
+func TestKillIdleDoesNotWaitForBusyController(t *testing.T) {
+	protocol := &observedKillProtocol{testMysqlWriter: &testMysqlWriter{}, closed: make(chan struct{})}
+	rt := NewRoutine(context.Background(), protocol, &config.FrontendParameters{})
+	rt.mc.Lock()
+	var releaseOnce sync.Once
+	release := func() { releaseOnce.Do(rt.mc.Unlock) }
+	done := make(chan struct{})
+	go func() { rt.killConnection(false); close(done) }()
+	t.Cleanup(func() {
+		release()
+		select {
+		case <-done:
+		case <-time.After(3 * time.Second):
+			t.Error("idle KILL did not stop during cleanup")
+		}
+	})
+	select {
+	case <-protocol.closed:
+	case <-time.After(3 * time.Second):
+		t.Fatal("idle KILL waited for the lifecycle controller")
+	}
+	release()
+	select {
+	case <-done:
+	case <-time.After(3 * time.Second):
+		t.Fatal("idle KILL did not return")
+	}
+}
+
+func TestKillPreservesActiveControllerOperation(t *testing.T) {
+	protocol := &observedKillProtocol{testMysqlWriter: &testMysqlWriter{}, closed: make(chan struct{})}
+	rt := NewRoutine(context.Background(), protocol, &config.FrontendParameters{})
+	operation, admitted := rt.mc.beginOperationWithContext(context.Background())
+	require.True(t, admitted)
+	rt.killConnection(false)
+	require.NoError(t, operation.Err(), "account KILL must not newly cancel an admitted proxy operation")
+	rt.mc.Lock()
+	closed := rt.mc.closed
+	rt.mc.Unlock()
+	require.False(t, closed, "the busy controller must retain the original KILL behavior")
+	rt.mc.endOperation()
+}
+
+func TestAccountKillAllowsKillQueryWhileRequestFinishes(t *testing.T) {
+	rt, _ := newUnitTestRoutine(t, 100)
+	owner := killTestIdentity("acme", 10, "owner", 7, "public")
+	rt.setSession(&Session{tenant: owner})
+	require.True(t, rt.mc.tryBeginRequest())
+	require.True(t, rt.beginClientRequest())
+	requestCtx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+	rt.setCancelRequestFunc(cancel)
+	rt.killConnection(false)
+	require.NoError(t, requestCtx.Err())
+	rm := &RoutineManager{routinesByConnID: map[uint32]*Routine{100: rt}}
+	found, err := rm.killLocal(context.Background(), killPrincipal(owner), 1, 100, false, "")

```

**File**: `pkg/frontend/routine_kill_monitor_unix_test.go` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
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
+//go:build darwin || linux
+
+package frontend
+
+import (
+	"context"
+	"net"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/config"
+	"github.com/stretchr/testify/require"
+)
+
+type blockedKillProtocol struct {
+	*testMysqlWriter
+	entered     chan struct{}
+	release     chan struct{}
+	once        sync.Once
+	releaseOnce sync.Once
+}
+
+func (p *blockedKillProtocol) Close() {
+	p.once.Do(func() { close(p.entered) })
+	<-p.release
+}
+
+func (p *blockedKillProtocol) unblock() { p.releaseOnce.Do(func() { close(p.release) }) }
+
+func TestKillCloseDoesNotBlockDisconnectMonitor(t *testing.T) {
+	clients := make(map[*Conn]*Routine)
+	protocols := make(map[*Conn]*blockedKillProtocol)
+	contexts := make(map[*Conn]context.Context)
+	for range 2 {
+		server, client := tcpConnectionPair(t)
+		t.Cleanup(func() { _ = server.Close(); _ = client.Close() })
+		protocol := &blockedKillProtocol{testMysqlWriter: &testMysqlWriter{}, entered: make(chan struct{}), release: make(chan struct{})}
+		t.Cleanup(protocol.unblock)
+		rt := NewRoutine(context.Background(), protocol, &config.FrontendParameters{})
+		require.True(t, rt.mc.tryBeginRequest())
+		require.True(t, rt.beginClientRequest())
+		ctx, cancel := context.WithCancel(context.Background())
+		t.Cleanup(cancel)
+		rt.setCancelRequestFunc(cancel)
+		conn := &Conn{conn: server, livenessProbe: newSocketLivenessProbe(server)}
+		clients[conn], protocols[conn], contexts[conn] = rt, protocol, ctx
+		require.NoError(t, client.(*net.TCPConn).SetLinger(0))
+		require.NoError(t, client.Close())
+		require.Eventually(t, func() bool {
+			closed, err := connectionPeerClosed(conn)
+			return err == nil && closed
+		}, 3*time.Second, time.Millisecond)
+	}
+	now := time.Now()
+	rm := &RoutineManager{clients: clients}
+	selected := make(chan *Conn, 1)
+	killStarted := make(chan struct{})
+	killDone := make(chan struct{})
+	done := make(chan struct{})
+	t.Cleanup(func() {
+		for _, protocol := range protocols {
+			protocol.unblock()
+		}
+		select {
+		case <-done:
+		case <-time.After(5 * time.Second):
+			t.Error("monitor did not stop during cleanup")
+		}
+		select {
+		case <-killStarted:
+			select {
+			case <-killDone:
+			case <-time.After(5 * time.Second):
+				t.Error("KILL did not stop during cleanup")
+			}
+		default:
+		}
+	})
+	go func() {
+		defer close(done)
+		first := true
+		rm.cancelDisconnectedRequests(now, 0, func(conn *Conn) (bool, error) {
+			if first {
+				first = false
+				// The request ended after the monitor captured its snapshot.
+				_ = clients[conn].endClientRequest(nil)
+				clients[conn].mc.endRequest()
+				close(killStarted)
+				go func() { clients[conn].killConnection(false); close(killDone) }()
+				<-protocols[conn].entered
+				selected <- conn
+			}
+			return connectionPeerClosed(conn)
+		})
+	}()
+	var first *Conn
+	select {
+	case first = <-selected:
+	case <-time.After(5 * time.Second):
+		t.Fatal("KILL did not reach protocol close")
+	}
+	var later *Conn
+	for conn := range clients {
+		if conn != first {
+			later = conn
+		}
+	}
+	select {
+	case <-contexts[later].Done():
+	case <-time.After(3 * time.Second):
+		t.Fatal("the monitor waited for an unrelated protocol close")
+	}
+	// The KILL call still owns the blocked close while the monitor progresses.
+	select {
+	case <-killDone:
+		t.Fatal("protocol close unexpectedly finished before release")
+	default:
+	}
+	protocols[first].unblock()
+	select {
+	case <-done:
+	case <-time.After(3 * time.Second):
+		t.Fatal("monitor did not finish")
+	}
+	select {
+	case <-killDone:
+	case <-time.After(3 * time.Second):
+		t.Fatal("KILL did not finish after the protocol close returned")
+	}
+}
```

**File**: `pkg/frontend/routine_manager.go` (modified, +6/-4)
```diff
@@ -19,6 +19,7 @@ import (
 	"crypto/tls"
 	"crypto/x509"
 	"fmt"
+	"io"
 	"math"
 	"os"
 	"sync"
@@ -402,12 +403,11 @@ func getConnectionInfo(rs *Conn) string {
 	return fmt.Sprintf("connection from %s", rs.RemoteAddress())
 }
 
-func (rm *RoutineManager) Handler(rs *Conn, msg []byte) error {
+func (rm *RoutineManager) Handler(rs *Conn, msg []byte) (err error) {
 	logutil.Debugf("get request from %d:%s", rs.ID(), rs.RemoteAddress())
 	defer func() {
 		logutil.Debugf("request from %d:%s has been processed", rs.ID(), rs.RemoteAddress())
 	}()
-	var err error
 	ctx, span := trace.Start(rm.getCtx(), "RoutineManager.Handler",
 		trace.WithKind(trace.SpanKindStatement))
 	defer span.End()
@@ -429,8 +429,10 @@ func (rm *RoutineManager) Handler(rs *Conn, msg []byte) error {
 		return moerr.NewInternalError(ctx, "cannot process request as routine is closed or busy")
 	}
 	defer routine.mc.endRequest()
-	routine.setInProcessRequest(true)
-	defer routine.setInProcessRequest(false)
+	if !routine.beginClientRequest() {
+		return io.EOF
+	}
+	defer func() { err = routine.endClientRequest(err) }()
 	ses := routine.getSession()
 
 	//handle request
```

**File**: `pkg/frontend/routine_test.go` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@ func TestRoutineRequestCallbacksAndCancelContexts(t *testing.T) {
 	})
 	require.Equal(t, int32(1), called)
 
-	rt.setInProcessRequest(true)
+	require.True(t, rt.beginClientRequest())
 	rt.execCallbackBasedOnRequest(false, func() {
 		atomic.AddInt32(&called, 1)
 	})
```

**File**: `pkg/frontend/server.go` (modified, +5/-6)
```diff
@@ -919,16 +919,15 @@ func (mo *MOServer) handleRequest(rs *Conn) error {
 
 	err = mo.rm.Handler(rs, msg)
 	if err != nil {
-		if skipClientQuit(err.Error()) {
+		if err == io.EOF || skipClientQuit(err.Error()) {
 			// COM_QUIT is terminal on the wire: the client has finished the
 			// session and waits for the server to close the connection, so
-			// the read loop must not keep waiting for a next command.
-			// Ending like a clean EOF lets handleConn close the connection
-			// and run the routine/session cleanup once, on the owning path.
+			// the read loop must not keep waiting for a next command. A killed
+			// request can also hand off a clean EOF after its response. Both
+			// paths let handleConn own connection and session cleanup.
 			return io.EOF
-		} else {
-			logutil.LogConnectionCloseEvent(frontendSessionHandleEvents, err)
 		}
+		logutil.LogConnectionCloseEvent(frontendSessionHandleEvents, err)
 		return err
 	}
 	return nil
```

#### Recent Merged Pull Requests:
- **PR #32380** (2026-11-09): docs: design early runtime filtering and dictionary vector execution (@aunjgr)
- **PR #32378** (2026-11-09): fix(frontend): reduce disconnect scan stalls during KILL (@XuPeng-SH)
- **PR #32377** (2026-11-09): fix(plan): prune correlated composite primary-key points (@XuPeng-SH)
- **PR #32376** (2026-11-08): test: guard aggregate input behavior on 4.2 (@XuPeng-SH)
- **PR #32375** (2026-11-08): fix(plan): preserve BIT types and widths in set operations (@aptend)
- **PR #32372** (2026-11-08): fix(sql): preserve MIN/MAX DISTINCT input values (@XuPeng-SH)

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

## X. group): preserve evaluated inputs across spill retries (#32368)

**RULE**:
When implementing operations in `docs/design/20261108-group-capacity-retry.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `692b50a3`: group): preserve evaluated inputs across spill retries (#32368). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261108-group-capacity-retry.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Preserve evaluated input during Group capacity recovery

Tracking issue: [#32369](https://github.com/matrixorigin/matrixone/issues/32369).
Implementation PR: [#32368](https://github.com/matrixorigin/matrixone/pull/32368).
Discovery: [#32060](https://github.com/matrixorigin/matrixone/issues/32060).
Reviewed baseline: `89ca3dbbf6d594d7614b8e1ca80f6b0300ed3cd2`.
Design decision: **PASS** for the scope below; implementation and validation
must be reviewed against this design.

## Problem and scope

Group evaluates one complete child batch before committing it in chunks of at
most `hashmap.UnitLimit` rows. On an accounted capacity rejection, it can drain
exact DISTINCT state or spill the committed prefix before retrying an
unpublished chunk. Currently, spilling resets expression executors and the
retry path clears `evaluated`. Group consequently evaluates the entire batch
again, even if an earlier chunk was already published.

An operator test rejects one real allocation after 256 groups are published.
For 512 rows with an incrementing side-effecting expression, the clean
baseline spills and reloads, evaluates the root twice, invokes 1,024 side
effects, and returns group keys `1..256`
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `692b50a3` are properly handled with clean fallback behavior.
