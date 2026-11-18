> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `517e1695`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T00:59:30.343Z  
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
> **Harvest Timestamp**: 2026-11-18T00:59:30.336Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2067 stars

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
- **Issue #32868** (2026-11-17): **[4.2-dev] fix: restore DATA BRANCH lineage after restore**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32820.  ## What this PR does / why we need it:  Snapshot and PITR restore recreate DATA BRANCH tables with new physical `rel_id` values. The restore path preserved table data and `dat_type='data-branch'` but did not publish active `mo_branch_metadata` lineage for those new IDs, so the restored branch failed `DATA BRANCH DELETE` with Error 20101.  Multi-generation restore also has two related lifecycle requirements: ordinary ancestors need their historical branch protection, and a compacted ALTER generation can have no current metadata when its descendant is restored. Restore must coordinate with deletion of the last live sibling so reclamation cannot remove protection required by the restored descendant.  ### Root cause  1. Table recreation allocated new physical IDs without DATA BRANCH clone publication for the restored table's current ID. 2. Lineage reconciliation assumed every historical ALTER ancestor still had current metadata, even though ALTER cleanup can remove that generation. 3. Current lineage/protection inspection occurred outside the lineage DAG coordination used by ALTER compaction and sibling reclamation, allowing protection to be reclaimed after restore observed it.  ### Changes  - Add historical lineage collection and locked current-state reconciliation for table/dat

- **Issue #32866** (2026-11-17): **[4.2-dev] fix(tae): propagate checkpoint fallback read errors on 4.2**
  *Symptoms*: ## What type of PR is this?  - [x] BUG - [ ] API-change - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #32867.  Narrow 4.2-dev backport of the checkpoint-read error propagation already present in main via PR #29685 (d0e7f9a552f9).  ## What this PR does / why we need it:  When a checkpoint has no table-ID index, changed-table discovery falls back to reading checkpoint data. An object-read error was discarded, allowing the handler to return a successful empty or partial changed-table list. Propagate that error before publishing the response. Existing catalog lookup behavior is preserved.  The regression writes real checkpoint objects and injects a read error through the file service. It covers a complete successful list, failure on the first data read, and failure after a previous checkpoint contributed a table ID. Both error cases fail through the complete handler before the fix and pass after it with the same test source.  Validation on an isolated Linux builder: focused regression and owning rpc package pass (35 top-level tests passed; 2 existing tests skipped), gofmt, diff whitespace check and go vet pass. Focused race also passes (all three scenarios); changed-package golangci-lint reports 0 issues. The linter needed an environment-only workaround for its standard-library ReleaseTags probe inheriting -modfile; project loading continued to use the verified module file and unchanged depend

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

### Incident Patch 1: `59bf4b8f` (2026-11-17)
**Commit Message**: fix(conntrack): restart ordered monitoring after receive errors (#32865)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #32851. Follow-up to merged #32854 for the fatal-receive-error availability gap identified during its review.

## What this PR does / why we need it:

The ordered, single-worker conntrack listener exits on ENOBUFS or a decode error. Previously MO only logged that error and continued reporting its stale map forever. This affects diagnostic connection statistics, not SQL or stored data.

- Retain one worker and the existing 65,536-entry queue. A fatal listener error invalidates that statistics generation, closes its socket, and retries with fresh queues/map at most once every five seconds.
- Drain pending publications while joining the old listener. Stop retrying if socket cleanup itself fails; repeated Dial/Listen failures do not busy-loop or accumulate listeners.
- Keep existing log names/count fields, adding `scope=since_listener_start`, `complete=false`, and a start timestamp. This resumes future observation; it doe

**File**: `cmd/mo-service/debug_connections.go` (modified, +110/-12)
```diff
@@ -18,6 +18,7 @@ package main
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"net"
 	"time"
@@ -29,11 +30,13 @@ import (
 )
 
 const (
-	connsThreshold = 1024
+	connsThreshold         = 1024
+	conntrackRetryInterval = 5 * time.Second
 )
 
 var (
 	conntrackReportInterval = time.Second * 5
+	errConntrackClose       = errors.New("conntrack socket close failed")
 )
 
 type conntrackClient interface {
@@ -52,11 +55,31 @@ func startConnectionTracking() (err error) {
 		}
 	}()
 
-	c, err := dialConntrack()
+	// Capture the factory once; every replacement has the same owner and policy.
+	dial := dialConntrack
+	listener, err := listenConntrack(dial)
 	if err != nil {
 		return err
 	}
+	// Keep the existing process lifetime. Runtime replacement only happens after
+	// the worker reports a fatal error; it is then safe to join that worker.
+	go runConnectionTracking(context.Background(), listener, dial)
+	return nil
+}
 
+// A listener owns one socket and its queues. Replacements never share queues
+// or the consumer's map, so an old generation cannot update the new one.
+type conntrackListener struct {
+	client conntrackClient
+	events chan conntrack.Event
+	errors chan error
+}
+
+func listenConntrack(dial func() (conntrackClient, error)) (*conntrackListener, error) {
+	c, err := dial()
+	if err != nil {
+		return nil, err
+	}
 	events := make(chan conntrack.Event, 65536)
 	// Keep receive, decode and delivery ordered. Concurrent conntrack workers
 	// can deliver DESTROY before NEW, leaving a destroyed flow in activeConns.
@@ -65,31 +88,96 @@ func startConnectionTracking() (err error) {
 		netfilter.GroupCTDestroy,
 	})
 	if err != nil {
-		_ = c.Close()
-		return err
+		if closeErr := c.Close(); closeErr != nil {
+			return nil, errors.Join(err, errConntrackClose, closeErr)
+		}
+		return nil, err
 	}
+	return &conntrackListener{client: c, events: events, errors: errorChan}, nil
+}
 
+func (l *conntrackListener) close() error {
+	// conntrack.Close closes the socket, then waits for its worker. The worker
+	// may be blocked publishing an event/error, which closing the fd cannot
+	// interrupt. Keep draining both queues until Close has joined the worker.
+	done := make(chan error, 1)
 	go func() {
-		defer c.Close()
-		logConnTrack(context.Background(), events, errorChan)
+		done <- l.client.Close()
 	}()
+	for {
+		select {
+		case err := <-done:
+			return err
+		case _, ok := <-l.events:
+			if !ok {
+				l.events = nil
+			}
+		case _, ok := <-l.errors:
+			if !ok {
+				l.errors = nil
+			}
+		}
+	}
+}
 
-	return nil
+func runConnectionTracking(ctx context.Context, listener *conntrackListener, dial func() (conntrackClient, error)) {
+	for {
+		err := logConnTrack(ctx, listener.events, listener.errors)
+		closeErr := listener.close()
+		if closeErr != nil {
+			// Do not accumulate replacements when the old socket cannot be closed.
+			logutil.Error("conntrack: tracking stopped", zap.Error(closeErr))
+			return
+		}
+		if ctx.Err() != nil {
+			return
+		}
+		logutil.Warn("conntrack: tracking interrupted; previous statistics invalid", zap.Error(err))
+		for {
+			// This is optional diagnostics, not a service admission gate. Retry at
+			// most once per interval, including repeated Dial/Listen failures.
+			timer := time.NewTimer(conntrackRetryInterval)
+			select {
+			case <-ctx.Done():
+				timer.Stop()
+				return
+			case <-timer.C:
+			}
+			if ctx.Err() != nil {
+				return
+			}
+			listener, err = listenConntrack(dial)
+			if err == nil {
+				break
+			}
+			logutil.Error("conntrack: restart failed", zap.Error(err))
+			if errors.Is(err, errConntrackClose) {
+				return
+			}
+		}
+	}
 }
 
-func logConnTrack(ctx context.Context, events chan conntrack.Event, errorChan chan error) {
+func logConnTrack(ctx context.Context, events chan conntrack.Event, errorChan chan error) error {
 
 	activeConns := make(map[uint32]*conntrack.Flow)
 	ticker := time.NewTicker(conntrackReportInterval)
 	defer ticker.Stop()
+	startedAt := time.Now()
 
 	for {
+		if err := ctx.Err(); err != nil {
+			return err
+		}
 		select {
 
 		case <-ctx.Done():
-			return
+			return ctx.Err()
 
-		case ev := <-events:
+		case ev, ok := <-events:
+			if !ok {
+				return errors.New("conntrack event channel closed")
+			}
 			switch ev.Type {
 
 			case conntrack.EventNew:
@@ -100,12 +188,20 @@ func logConnTrack(ctx context.Context, events chan conntrack.Event, errorChan ch
 
 			}
 
-		case err := <-errorChan:
-			logutil.Error("conntrack: error", zap.Error(err))
+		case err, ok := <-errorChan:
+			if !ok || err == nil {
+				return errors.New("conntrack listener stopped without an error")
+			}
+			// Listen has one worker, and every reported error terminates it.
+			// Do not keep publishing stale counts after that worker exits.
+			return err
 
 		case <-ticker.C:
 			logutil.Info("conntrack: stats",
 				zap.Any("connections", len(activeConns)),
+				zap.String("scope", "since_listener_start"),
+				zap.Bool("complete", false),
```

**File**: `cmd/mo-service/debug_connections_test.go` (modified, +304/-57)
```diff
@@ -19,13 +19,20 @@ package main
 import (
 	"context"
 	"errors"
-	"io"
-	"math/rand/v2"
+	"fmt"
+	"sync/atomic"
 	"testing"
+	"testing/synctest"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/logutil"
+	"github.com/stretchr/testify/require"
 	"github.com/ti-mo/conntrack"
 	"github.com/ti-mo/netfilter"
+	"go.uber.org/zap/buffer"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+	"golang.org/x/sys/unix"
 )
 
 type failingConntrackClient struct {
@@ -54,7 +61,8 @@ func TestStartConnectionTrackingClosesOnListenFailure(t *testing.T) {
 		return client, nil
 	}
 
-	if err := startConnectionTracking(); err == nil {
+	err := startConnectionTracking()
+	if err == nil {
 		t.Fatal("expected Listen failure")
 	}
 	if !client.closed {
@@ -82,64 +90,303 @@ func TestDialConntrack(t *testing.T) {
 }
 
 func TestConntrack(t *testing.T) {
-	ctx, cancel := context.WithCancel(context.Background())
-	defer cancel()
-
-	events := make(chan conntrack.Event)
-	errorCh := make(chan error)
-
-	go logConnTrack(ctx, events, errorCh)
-
-	t0 := time.Now()
-	for {
-
-		for range connsThreshold {
-
-			events <- conntrack.Event{
-				Type: conntrack.EventNew,
-				Flow: &conntrack.Flow{
-					ID: rand.Uint32(),
-					TupleOrig: conntrack.Tuple{
-						Proto: conntrack.ProtoTuple{
-							SourcePort:      42,
-							DestinationPort: 41,
-						},
-					},
-				},
-			}
+	synctest.Test(t, func(t *testing.T) {
+		logs := observeConntrack(t)
+		ctx, cancel := context.WithCancel(context.Background())
+		defer cancel()
+		events, errs := make(chan conntrack.Event), make(chan error)
+		done := make(chan error, 1)
+		go func() { done <- logConnTrack(ctx, events, errs) }()
+		for id := uint32(0); id < connsThreshold; id++ {
+			events <- conntrackEvent(false, id)
+		}
+		synctest.Wait()
+		// Advance the fake clock, not a wall-clock synchronization sleep.
+		time.Sleep(conntrackReportInterval)
+		synctest.Wait()
+		requireConntrackCount(t, logs, connsThreshold)
+		require.Len(t, logs.FilterMessage("conntrack: source").All(), 1)
+		require.Len(t, logs.FilterMessage("conntrack: destination").All(), 1)
+		for id := uint32(0); id < connsThreshold; id++ {
+			events <- conntrackEvent(true, id)
+		}
+		synctest.Wait()
+		time.Sleep(conntrackReportInterval)
+		synctest.Wait()
+		requireConntrackCount(t, logs, 0)
+		cancel()
+		require.ErrorIs(t, <-done, context.Canceled)
+	})
+}
 
-			events <- conntrack.Event{
-				Type: conntrack.EventDestroy,
-				Flow: &conntrack.Flow{
-					ID: rand.Uint32(),
-					TupleOrig: conntrack.Tuple{
-						Proto: conntrack.ProtoTuple{
-							SourcePort:      42,
-							DestinationPort: 41,
-						},
-					},
-				},
-			}
+func conntrackEvent(destroy bool, id uint32) conntrack.Event {
+	kind := conntrack.EventNew
+	if destroy {
+		kind = conntrack.EventDestroy
+	}
+	return conntrack.Event{Type: kind, Flow: &conntrack.Flow{ID: id, TupleOrig: conntrack.Tuple{
+		Proto: conntrack.ProtoTuple{SourcePort: 42, DestinationPort: 41},
+	}}}
+}
 
-		}
+func observeConntrack(t *testing.T) *observer.ObservedLogs {
+	t.Helper()
+	core, logs := observer.New(zapcore.DebugLevel)
+	oldReport, oldContext := logutil.GetReportZapFunc(), logutil.GetContextFieldFunc()
+	t.Cleanup(func() { logutil.SetLogReporter(&logutil.TraceReporter{ReportZap: oldReport, ContextField: oldContext}) })
+	pool := buffer.NewPool()
+	logutil.SetLogReporter(&logutil.TraceReporter{ReportZap: func(_ zapcore.Encoder, entry zapcore.Entry, fields []zapcore.Field) (*buffer.Buffer, error) {
+		return pool.Get(), core.Write(entry, fields)
+	}})
+	restore := logutil.SetupMOLoggerForTest(&logutil.LogConfig{Level: "info", DisableLog: true})
+	t.Cleanup(func() { restore() })
+	return logs
+}
 
-		errorCh <- io.ErrShortBuffer
-		events <- conntrack.Event{
-			Type: conntrack.EventNew,
-			Flow: &conntrack.Flow{
-				ID: rand.Uint32(),
-				TupleOrig: conntrack.Tuple{
-					Proto: conntrack.ProtoTuple{
-						SourcePort:      1,
-						DestinationPort: 2,
-					},
-				},
-			},
-		}
+func requireConntrackCount(t *testing.T, logs *observer.ObservedLogs, count int) {
+	t.Helper()
+	stats := logs.FilterMessage("conntrack: stats").All()
+	require.NotEmpty(t, stats)
+	fields := stats[len(stats)-1].ContextMap()
+	require.EqualValues(t, count, fields["connections"])
+	require.Equal(t, "since_listener_start", fields["scope"])
+	require.Equal(t, false, fields["complete"])
+	require.Contains(t, fields, "listener_started_at")
+}
+
+func TestConntrackListenerTerminal(t *testing.T) {
+	for _, terminal := range []string{"ENOBUFS", "decode error", "events closed", "errors closed", "nil error"} {
+		t.Run(terminal, func(t *testing.T) {
+			synctest.Test(t, func(t *testing.T) {
+				logs := observeConntrack(t)
+				ctx, cancel := context.WithCancel(context.Background())
+				defer cancel()
+				events, errs := make(chan conntrack.Event), make(chan error)
+				done := make(chan error, 1)
+				go func() { done <- logConnTrack(ctx, events, errs) }()
+				events <- conntrac
```

---

### Incident Patch 2: `612e34dc` (2026-11-17)
**Commit Message**: fix: enforce unique checks in multi-target UPDATE (#32821)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #31824

## What this PR does / why we need it:

A multi-target self-join `UPDATE` could commit duplicate `UNIQUE`
values. After repeated physical targets were merged, the selector
guarding deduplication keys was no longer valid, and independent
per-alias checks could not detect two target rows writing the same new
key.

This change:
- rebuilds the physical-row selector after the non-`IGNORE`
repeated-target merge;
- consolidates `UNIQUE` checks per physical table/index and evaluates
the final merged row image;
- preserves the existing `UPDATE IGNORE` path and per-row old-key
self-update exemption;
- adds typed plan assertions plus end-to-end coverage for
single/composite/prefix/multiple unique indexes, three aliases,
same-physical-row updates, key swaps, `NULL`, atomicity, index reads,
and retry.

## Validation

Earlier author-reported validation (before the latest rebase):
- complete `./pkg/sql/plan` package;
- focused planner assertio

**File**: `pkg/sql/plan/bind_update.go` (modified, +91/-9)
```diff
@@ -1084,6 +1084,30 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 			}
 			lastNodeID = builder.appendNode(selectNode, bindCtx)
 			selectNodeTag = groupActiveTag
+			for _, tableID := range physicalTableOrder {
+				targets := targetsByTableID[tableID]
+				if len(targets) < 2 {
+					continue
+				}
+				ownerIdx := targets[0]
+				rowIDPos := oldColName2Idx[dmlCtx.aliases[ownerIdx]+"."+catalog.Row_ID]
+				var groupRowNumberPos int32
+				lastNodeID, selectNode, selectNodeTag, groupRowNumberPos, err =
+					builder.appendTargetRowNumberNode(
+						bindCtx,
+						lastNodeID,
+						selectNode,
+						selectNodeTag,
+						rowIDPos,
+						physicalTargetActivePos[ownerIdx],
+					)
+				if err != nil {
+					return 0, err
+				}
+				for _, targetIdx := range targets {
+					targetRowNumberPos[targetIdx] = groupRowNumberPos
+				}
+			}
 		}
 	}
 	if !isMultiTargetUpdate && updateHasMultipleSourceTables(stmt) {
@@ -1384,6 +1408,9 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 		aliasIdxNeedConstraintCheck[i] = append([]bool(nil), idxNeedUpdate[i]...)
 	}
 	coalesceRepeatedPhysicalTargetRegularIndexes(dmlCtx, idxNeedUpdate)
+	if !deferRepeatedPhysicalTargetMerge {
+		coalesceRepeatedPhysicalTargetUniqueChecks(dmlCtx, aliasIdxNeedConstraintCheck)
+	}
 
 	if updatePkOrUk {
 		newProjTag := builder.genNewBindTag()
@@ -1422,7 +1449,11 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 			}
 			return builder.makeIndexPartExprFromInputExpr(inputExpr, partName, prefixLengths)
 		}
-		guardTargetDedupExpr := func(targetIdx int, expr *plan.Expr) (*plan.Expr, error) {
+		uniqueDedupActivePos := targetBranchActivePos
+		if !deferRepeatedPhysicalTargetMerge {
+			uniqueDedupActivePos = physicalTargetActivePos
+		}
+		guardTargetDedupExpr := func(targetIdx int, activePositions []int32, expr *plan.Expr) (*plan.Expr, error) {
 			rowNumberExpr := &plan.Expr{
 				Typ: selectNode.ProjectList[targetRowNumberPos[targetIdx]].Typ,
 				Expr: &plan.Expr_Col{
@@ -1441,11 +1472,11 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 				return nil, err
 			}
 			activeExpr := &plan.Expr{
-				Typ: selectNode.ProjectList[targetBranchActivePos[targetIdx]].Typ,
+				Typ: selectNode.ProjectList[activePositions[targetIdx]].Typ,
 				Expr: &plan.Expr_Col{
 					Col: &plan.ColRef{
 						RelPos: selectNodeTag,
-						ColPos: targetBranchActivePos[targetIdx],
+						ColPos: activePositions[targetIdx],
 					},
 				},
 			}
@@ -1506,7 +1537,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 
 					newPkExpr, _ := BindFuncExprImplByPlanExpr(builder.GetContext(), "serial", args)
 					if isMultiTargetUpdate {
-						newPkExpr, err = guardTargetDedupExpr(i, newPkExpr)
+						newPkExpr, err = guardTargetDedupExpr(i, targetBranchActivePos, newPkExpr)
 						if err != nil {
 							return 0, err
 						}
@@ -1523,7 +1554,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 							Col: &plan.ColRef{RelPos: selectNodeTag, ColPos: colPos},
 						},
 					}
-					pkExpr, err = guardTargetDedupExpr(i, pkExpr)
+					pkExpr, err = guardTargetDedupExpr(i, targetBranchActivePos, pkExpr)
 					if err != nil {
 						return 0, err
 					}
@@ -1686,7 +1717,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 						return 0, err
 					}
 					if isMultiTargetUpdate {
-						newUkExpr, err = guardTargetDedupExpr(i, newUkExpr)
+						newUkExpr, err = guardTargetDedupExpr(i, uniqueDedupActivePos, newUkExpr)
 						if err != nil {
 							return 0, err
 						}
@@ -1730,7 +1761,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 							}
 						}
 						if isMultiTargetUpdate {
-							newPartExpr, err = guardTargetDedupExpr(i, newPartExpr)
+							newPartExpr, err = guardTargetDedupExpr(i, uniqueDedupActivePos, newPartExpr)
 							if err != nil {
 								return 0, err
 							}
@@ -1756,7 +1787,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 							}
 							newColName2Idx[idxTableDef.Name+"."+catalog.IndexTableIndexColName] = int32(len(newProjNode.ProjectList))
 							if isMultiTargetUpdate {
-								newPartExpr, err = guardTargetDedupExpr(i, newPartExpr)
+								newPartExpr, err = guardTargetDedupExpr(i, uniqueDedupActivePos, newPartExpr)
 								if err != nil {
 									return 0, err
 								}
@@ -1776,7 +1807,7 @@ func (builder *QueryBuilder) bindUpdate(stmt *tree.Update, bindCtx *BindContext,
 									Col: &plan.ColRef{RelPos: selectNodeTag, ColPos: colPos},
 								},
 							}
-							newPartExpr, err = guardTargetDedupExpr(i, newPartExpr)
+							newPartExpr, err = guardTargetDedupExpr(i, uniqueDedupActivePos, newPartExpr)
 							if err != nil {
 								return 0, err
 							}
@@ -2846,6 +2877,57 @@ func coalesceRepeated
```

**File**: `pkg/sql/plan/bind_update_test.go` (modified, +33/-0)
```diff
@@ -645,6 +645,39 @@ func TestCoalesceRepeatedPhysicalTargetIndexes(t *testing.T) {
 	require.Empty(t, irregularIndexes[1])
 }
 
+func TestCoalesceRepeatedPhysicalTargetUniqueChecks(t *testing.T) {
+	uniqueA := &IndexDef{IndexName: "uk_a", IndexTableName: "uk_a_table", Unique: true}
+	uniqueB := &IndexDef{IndexName: "uk_b", IndexTableName: "uk_b_table", Unique: true}
+	regular := &IndexDef{IndexName: "idx", IndexTableName: "idx_table"}
+	indexes := []*IndexDef{uniqueA, uniqueB, regular}
+	dmlCtx := &DMLContext{
+		aliases: []string{"a", "b", "c"},
+		tableDefs: []*TableDef{
+			{TblId: 100, Indexes: indexes},
+			{TblId: 100, Indexes: indexes},
+			{TblId: 200, Indexes: indexes},
+		},
+		updateCol2Expr: []map[string]tree.Expr{
+			{"x": nil},
+			{"x": nil},
+			{"x": nil},
+		},
+	}
+
+	checks := [][]bool{
+		{false, false, false},
+		{true, true, true},
+		{true, false, false},
+	}
+	coalesceRepeatedPhysicalTargetUniqueChecks(dmlCtx, checks)
+
+	// All unique checks for one physical table are evaluated once by its owner.
+	require.Equal(t, []bool{true, true, false}, checks[0])
+	require.Equal(t, []bool{false, false, true}, checks[1])
+	// Another physical table keeps its own independent check.
+	require.Equal(t, []bool{true, false, false}, checks[2])
+}
+
 func TestPrimaryKeyUpdatedDetectsSingleAndCompositeKeys(t *testing.T) {
 	tests := []struct {
 		name       string
```

**File**: `pkg/sql/plan/issue_31824_plan_test.go` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+// Copyright 2021 - 2026 Matrix Origin
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
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+)
+
+type repeatedTargetDedupGuard struct {
+	rowNumber *plan.ColRef
+	active    *plan.ColRef
+}
+
+func repeatedTargetFunctionsAtCol(query *plan.Query, pos int32, name string) []*plan.Function {
+	var functions []*plan.Function
+	for _, node := range query.Nodes {
+		if int(pos) >= len(node.ProjectList) {
+			continue
+		}
+		fn := node.ProjectList[pos].GetF()
+		if fn != nil && fn.GetFunc().GetObjName() == name {
+			functions = append(functions, fn)
+		}
+	}
+	return functions
+}
+
+func repeatedTargetExtractGuard(
+	t *testing.T, query *plan.Query, dedup *plan.Node,
+) repeatedTargetDedupGuard {
+	t.Helper()
+	require.Len(t, dedup.OnList, 1)
+	joinEQ := dedup.OnList[0].GetF()
+	require.NotNil(t, joinEQ)
+	require.Equal(t, "=", joinEQ.GetFunc().GetObjName())
+	require.Len(t, joinEQ.Args, 2)
+	parseGuard := func(guardIF *plan.Function) (repeatedTargetDedupGuard, bool) {
+		if guardIF == nil || guardIF.GetFunc().GetObjName() != "if" || len(guardIF.Args) != 3 {
+			return repeatedTargetDedupGuard{}, false
+		}
+		guardAND := guardIF.Args[0].GetF()
+		if guardAND == nil || guardAND.GetFunc().GetObjName() != "and" || len(guardAND.Args) != 2 {
+			return repeatedTargetDedupGuard{}, false
+		}
+		selectedEQ := guardAND.Args[0].GetF()
+		if selectedEQ == nil || selectedEQ.GetFunc().GetObjName() != "=" || len(selectedEQ.Args) != 2 ||
+			selectedEQ.Args[0].GetCol() == nil || guardAND.Args[1].GetCol() == nil {
+			return repeatedTargetDedupGuard{}, false
+		}
+		return repeatedTargetDedupGuard{
+			rowNumber: selectedEQ.Args[0].GetCol(),
+			active:    guardAND.Args[1].GetCol(),
+		}, true
+	}
+	if guard, ok := parseGuard(joinEQ.Args[1].GetF()); ok {
+		return guard
+	}
+
+	// Some finalized plans retain a projection reference instead of inlining the guard.
+	keyRef := joinEQ.Args[1].GetCol()
+	require.NotNil(t, keyRef)
+	var guards []repeatedTargetDedupGuard
+	for _, guardIF := range repeatedTargetFunctionsAtCol(query, keyRef.ColPos, "if") {
+		if guard, ok := parseGuard(guardIF); ok {
+			guards = append(guards, guard)
+		}
+	}
+	require.Len(t, guards, 1, "the DEDUP key must have one unambiguous row-level guard")
+	return guards[0]
+}
+
+func repeatedTargetDedupsByIndexTable(query *plan.Query) map[string][]*plan.Node {
+	result := make(map[string][]*plan.Node)
+	for _, node := range query.Nodes {
+		if node.NodeType != plan.Node_JOIN || node.JoinType != plan.Node_DEDUP ||
+			len(node.Children) != 2 {
+			continue
+		}
+		indexScan := query.Nodes[node.Children[0]]
+		if indexScan.TableDef == nil {
+			continue
+		}
+		result[indexScan.TableDef.Name] = append(result[indexScan.TableDef.Name], node)
+	}
+	return result
+}
+
+func TestUpdateRepeatedPhysicalTargetUniqueDedupPlan(t *testing.T) {
+	t.Run("one merged physical check per unique index", func(t *testing.T) {
+		mock := NewMockOptimizer(true, newPlanTestProcess(t))
+		tableDef := mock.ctxt.tables["dept"]
+		require.Len(t, tableDef.Indexes, 2)
+		secondIndex := *tableDef.Indexes[0]
+		secondIndex.IndexTableName = tableDef.Indexes[1].IndexTableName
+		secondIndex.Parts = []string{"loc"}
+		tableDef.Indexes[1] = &secondIndex
+		logicPlan, err := runOneStmt(mock, t,
+			"UPDATE dept a JOIN dept b ON a.deptno = b.deptno "+
+				"SET a.dname = 'a', a.loc = 'a', b.dname = 'b', b.loc = 'b'")
+		require.NoError(t, err)
+		query := logicPlan.GetQuery()
+		dedups := repeatedTargetDedupsByIndexTable(query)
+
+		var previous *repeatedTargetDedupGuard
+		for _, indexDef := range tableDef.Indexes {
+			indexDedups := dedups[indexDef.IndexTableName]
+			require.Len(t, indexDedups, 1,
+				"each physical unique index must be checked once, not once per alias")
+			require.Equal(t, plan.Node_FAIL, indexDedups[0].OnDuplicateAction)
+			guard := repeatedTargetExtractGuard(t, query, indexDedups[0])
+			active := repeatedTargetFunctionsAtCol(query, guard.active.ColPos, "or")
+			require.Len(t, active, 1,
+				"the unique guard must use the merged physical active selector")
+			require.Len(t, active[0].Args, 2)
+			require.Equal(t, guard.active.ColPos+1, guard.rowNumber.ColPos,
+				"the merged active selector and its physical row_number must be adjacent")
+			if previous != nil {
+				require.Equal(t, previous.rowNumber, guard.rowN
```

**File**: `pkg/tests/issues/issue_31824_test.go` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
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
+package issues
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/go-sql-driver/mysql"
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/embed"
+	"github.com/matrixorigin/matrixone/pkg/tests/testutils"
+)
+
+func TestIssue31824SelfJoinMultiTargetUpdateUnique(t *testing.T) {
+	embed.RunBaseClusterTests(t, func(c embed.Cluster) {
+		ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
+		defer cancel()
+
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		port := cn.GetServiceConfig().CN.Frontend.Port
+		db, err := sql.Open("mysql", fmt.Sprintf(
+			"dump:111@tcp(127.0.0.1:%d)/?interpolateParams=false", port))
+		require.NoError(t, err)
+		defer db.Close()
+		conn, err := db.Conn(ctx)
+		require.NoError(t, err)
+		defer conn.Close()
+
+		dbName := testutils.GetDatabaseName(t)
+		mustExec(t, ctx, conn, fmt.Sprintf("create database `%s`", dbName))
+		defer func() {
+			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
+			defer cleanupCancel()
+			if _, err := db.ExecContext(cleanupCtx, fmt.Sprintf("drop database if exists `%s`", dbName)); err != nil {
+				t.Errorf("drop test database %s: %v", dbName, err)
+			}
+		}()
+		mustExec(t, ctx, conn, fmt.Sprintf("use `%s`", dbName))
+
+		originalRows := []string{"1,1,10,100", "2,1,20,200"}
+		conflictTests := []struct {
+			name           string
+			uniqueDef      string
+			indexName      string
+			indexPredicate string
+			update         string
+		}{
+			{
+				name:           "single column existing key through second alias",
+				uniqueDef:      "unique key uk_k(k)",
+				indexName:      "uk_k",
+				indexPredicate: "k=10",
+				update: `update t as x join t as y on x.id=1 and y.id=2
+					set x.v=x.v+1, y.k=10`,
+			},
+			{
+				name:           "single column existing key through first alias",
+				uniqueDef:      "unique key uk_k(k)",
+				indexName:      "uk_k",
+				indexPredicate: "k=20",
+				update: `update t as y join t as x on x.id=1 and y.id=2
+					set y.v=y.v+1, x.k=20`,
+			},
+			{
+				name:           "single column same new key",
+				uniqueDef:      "unique key uk_k(k)",
+				indexName:      "uk_k",
+				indexPredicate: "k=30",
+				update: `update t as x join t as y on x.id=1 and y.id=2
+					set x.k=30, y.k=30`,
+			},
+			{
+				name:           "single column same new key reversed assignments",
+				uniqueDef:      "unique key uk_k(k)",
+				indexName:      "uk_k",
+				indexPredicate: "k=30",
+				update: `update t as y join t as x on x.id=1 and y.id=2
+					set y.k=30, x.k=30`,
+			},
+			{
+				name:           "composite existing key through second alias",
+				uniqueDef:      "unique key uk_gk(g,k)",
+				indexName:      "uk_gk",
+				indexPredicate: "g=1 and k=10",
+				update: `update t as x join t as y on x.id=1 and y.id=2
+					set x.v=x.v+1, y.k=10`,
+			},
+			{
+				name:           "composite existing key through first alias",
+				uniqueDef:      "unique key uk_gk(g,k)",
+				indexName:      "uk_gk",
+				indexPredicate: "g=1 and k=20",
+				update: `update t as y join t as x on x.id=1 and y.id=2
+					set y.v=y.v+1, x.k=20`,
+			},
+			{
+				name:           "composite same new key",
+				uniqueDef:      "unique key uk_gk(g,k)",
+				indexName:      "uk_gk",
+				indexPredicate: "g=1 and k=30",
+				update: `update t as x join t as y on x.id=1 and y.id=2
+					set x.k=30, y.k=30`,
+			},
+			{
+				name:           "composite same new key reversed assignments",
+				uniqueDef:      "unique key uk_gk(g,k)",
+				indexName:      "uk_gk",
+				indexPredicate: "g=1 and k=30",
+				update: `update t as y join t as x on x.id=1 and y.id=2
+					set y.k=30, x.k=30`,
+			},
+		}
+
+		for _, tt := range conflictTests {
+			t.Run(tt.name, func(t *testing.T) {
+				createIssue31824Table(t, ctx, conn, tt.uniqueDef)
+				_, err := conn.ExecContext(ctx, tt.update)
+				requireIssue31824Duplicate(t, err)
+
+				require.Equal(t, originalRows, queryIssue31824Rows(t, ctx, conn,
+					fmt.Sprintf("select id,g,k,v from t ignore index(%s) order by id", tt.indexName)))
+				var wantIndexed []string
+				switch tt.indexPredicate {
+				case "k=10", "g=1 and k=10":
+					wantIndexed = originalRows[:1]
+				case "k=20", "g=1 and k=20":
+					wantIndexed = originalRows[1:]
+				}
+				require.Equal(t, wantIndex
```

---

### Incident Patch 3: `e1160015` (2026-11-17)
**Commit Message**: fix(logservice): harden lease fencing, snapshots and HAKeeper (#32688)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32661
Fixes #32667
Fixes #32677
Fixes #32678
Fixes #32679
Fixes #32681
Fixes #32683

## What this PR does / why we need it:

- Stamp CN removal time in the HAKeeper proposal and reset the bootstrap deadline when the leader term changes. This keeps Raft apply deterministic and gives an A-B-A leader transfer a fresh bootstrap budget.
- Classify rejected WAL append entries from persisted lease and recovery state so TN replay skips them. Bound each READ page's lease-history lookup with a sorted in-memory index.
- Persist a retiring marker before stopping a zombie replica. Fence new exports and retain the marker while an accepted export can still finish; a restart retries final cleanup. Keep retired initial HAKeeper IDs blocked through bootstrap, even when cleanup runs first. Apply the same cleanup condition to catalog revocation.
- Carry the TN ID into both truncate commands and check the lease inside Raft apply, before changin

**File**: `pkg/common/moerr/error.go` (modified, +16/-0)
```diff
@@ -1493,10 +1493,26 @@ func NewInvalidTruncateLsn(ctx context.Context, shardId, idx uint64) *Error {
 	return newError(ctx, ErrInvalidTruncateLsn, shardId, idx)
 }
 
+// NewInvalidTruncateLsnWithMessage preserves the diagnostic sent by a remote
+// LogService while retaining the original MO error code and SQL metadata.
+func NewInvalidTruncateLsnWithMessage(ctx context.Context, message string) *Error {
+	err := NewInvalidTruncateLsn(ctx, 0, 0)
+	err.message = message
+	return err
+}
+
 func NewNotLeaseHolder(ctx context.Context, holderId uint64) *Error {
 	return newError(ctx, ErrNotLeaseHolder, holderId)
 }
 
+// NewNotLeaseHolderWithMessage preserves the diagnostic sent by a remote
+// LogService while retaining the original MO error code and SQL metadata.
+func NewNotLeaseHolderWithMessage(ctx context.Context, message string) *Error {
+	err := NewNotLeaseHolder(ctx, 0)
+	err.message = message
+	return err
+}
+
 func NewNoSuchTable(ctx context.Context, db, tbl string) *Error {
 	noReportCtx := errutil.ContextWithNoReport(ctx, true)
 	return newError(noReportCtx, ErrNoSuchTable, db, tbl)
```

**File**: `pkg/hakeeper/issue32661_regression_test.go` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
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
+package hakeeper
+
+import (
+	"testing"
+	"time"
+
+	sm "github.com/lni/dragonboat/v4/statemachine"
+	"github.com/stretchr/testify/require"
+
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+)
+
+func TestDeleteCNStoreUsesReplicatedTime(t *testing.T) {
+	a := NewStateMachine(0, 1).(*stateMachine)
+	b := NewStateMachine(0, 2).(*stateMachine)
+	store := pb.CNStoreInfo{SQLAddress: "10.0.0.1:6001", UpTime: 123}
+	a.state.CNState.Stores["cn-1"] = store
+	b.state.CNState.Stores["cn-1"] = store
+	cmd := GetDeleteCNStoreCmd(pb.DeleteCNStore{StoreID: "cn-1", DownTime: 123456789})
+	_, err := a.Update(sm.Entry{Cmd: cmd})
+	require.NoError(t, err)
+	time.Sleep(10 * time.Millisecond)
+	_, err = b.Update(sm.Entry{Cmd: cmd})
+	require.NoError(t, err)
+	require.Len(t, a.state.DeletedStores, 1)
+	require.Len(t, b.state.DeletedStores, 1)
+	require.Equal(t, a.state.DeletedStores, b.state.DeletedStores)
+	require.Equal(t, int64(123456789), a.state.DeletedStores[0].DownTime)
+}
+
+func TestDeleteCNStoreLegacyAndUnsortedPruning(t *testing.T) {
+	first := NewStateMachine(0, 1).(*stateMachine)
+	second := NewStateMachine(0, 2).(*stateMachine)
+	for _, machine := range []*stateMachine{first, second} {
+		machine.state.CNState.Stores["legacy"] = pb.CNStoreInfo{UpTime: 42}
+	}
+	legacy := GetDeleteCNStoreCmd(pb.DeleteCNStore{StoreID: "legacy"})
+	_, err := first.Update(sm.Entry{Cmd: legacy})
+	require.NoError(t, err)
+	time.Sleep(10 * time.Millisecond)
+	_, err = second.Update(sm.Entry{Cmd: legacy})
+	require.NoError(t, err)
+	require.Equal(t, first.state.DeletedStores, second.state.DeletedStores)
+	require.Zero(t, first.state.DeletedStores[0].DownTime)
+
+	const day = int64(24 * time.Hour)
+	first.state.DeletedStores = []pb.DeletedStore{
+		{UUID: "legacy", DownTime: 0},
+		{UUID: "old", DownTime: day},
+		{UUID: "recent", DownTime: 9 * day},
+		{UUID: "older", DownTime: 2 * day},
+		{UUID: "future", DownTime: 11 * day},
+	}
+	first.handleDeleteCNCmd("missing", 10*day)
+	require.Equal(t, []pb.DeletedStore{
+		{UUID: "recent", DownTime: 9 * day},
+		{UUID: "future", DownTime: 11 * day},
+	}, first.state.DeletedStores)
+}
```

**File**: `pkg/hakeeper/rsm.go` (modified, +14/-8)
```diff
@@ -558,7 +558,7 @@ func (s *stateMachine) handleUpdateCommandsCmd(cmd []byte) sm.Result {
 			s.handleSetStateCmd(GetSetStateCmd(pb.HAKeeperBootstrapCommandsReceived))
 		}
 		if c.DeleteCNStore != nil {
-			s.handleDeleteCNCmd(c.UUID)
+			s.handleDeleteCNCmd(c.UUID, c.DeleteCNStore.DownTime)
 			delete(s.state.ScheduleCommands, c.UUID)
 			continue
 		}
@@ -1397,15 +1397,20 @@ func (s *stateMachine) handleTaskTableUserCmd(cmd []byte) sm.Result {
 	return result
 }
 
-func (s *stateMachine) handleDeleteCNCmd(uuid string) sm.Result {
+func (s *stateMachine) handleDeleteCNCmd(uuid string, downTimeArg ...int64) sm.Result {
+	var downTime int64
+	if len(downTimeArg) != 0 {
+		downTime = downTimeArg[0]
+	}
 	deletedTimeout := time.Hour * 24 * 7
-	var pos int
+	kept := s.state.DeletedStores[:0]
 	for _, store := range s.state.DeletedStores {
-		if time.Now().UnixNano()-store.DownTime > int64(deletedTimeout) {
-			pos++
+		if downTime <= 0 || (store.DownTime > 0 &&
+			(store.DownTime > downTime || downTime-store.DownTime <= int64(deletedTimeout))) {
+			kept = append(kept, store)
 		}
 	}
-	s.state.DeletedStores = s.state.DeletedStores[pos:]
+	s.state.DeletedStores = kept
 	delete(s.state.ViewMetadataAdmissionCNReady, uuid)
 	delete(s.state.ViewMetadataAdmissionCNTargets, uuid)
 	delete(s.state.ViewMetadataAdmissionCNTargetTicks, uuid)
@@ -1421,7 +1426,7 @@ func (s *stateMachine) handleDeleteCNCmd(uuid string) sm.Result {
 			StoreType: "CN",
 			Address:   addr,
 			UpTime:    store.UpTime,
-			DownTime:  time.Now().UnixNano(),
+			DownTime:  downTime,
 		})
 	}
 	return sm.Result{}
@@ -1710,7 +1715,8 @@ func (s *stateMachine) Update(e sm.Entry) (sm.Result, error) {
 	case pb.PatchCNStore:
 		return s.handlePatchCNStore(cmd), nil
 	case pb.RemoveCNStore:
-		return s.handleDeleteCNCmd(parseDeleteCNStoreCmd(cmd).StoreID), nil
+		request := parseDeleteCNStoreCmd(cmd)
+		return s.handleDeleteCNCmd(request.StoreID, request.DownTime), nil
 	case pb.ProxyHeartbeatUpdate:
 		return s.handleProxyHeartbeat(cmd), nil
 	case pb.UpdateNonVotingReplicaNum:
```

**File**: `pkg/logservice/catalog_metadata_executor.go` (modified, +6/-5)
```diff
@@ -146,13 +146,17 @@ func (l *store) catalogStartReplica(p pb.CatalogMetadataStartPermit) error {
 	return l.startHAKeeperReplicaRaw(p.ReplicaID, nil, join)
 }
 func (l *store) catalogStopReplica(p pb.CatalogMetadataStartPermit) error {
+	l.markReplicaRetiring(hakeeper.DefaultHAKeeperShardID, p.ReplicaID)
 	if l.catalogReplicaPresent(p, false) {
 		if err := l.stopReplicaRaw(hakeeper.DefaultHAKeeperShardID, p.ReplicaID); err != nil {
 			return err
 		}
 	}
-	// REVOKING is already durable. Remove stale local recovery metadata even
-	// after a crash between StopReplica and this cleanup; retain the tombstone.
+	// REVOKING is durable. Keep metadata until exported snapshots have been
+	// removed; a failed removal is retried by the supervisor after restart.
+	if err := l.snapshotMgr.RemoveReplica(hakeeper.DefaultHAKeeperShardID, p.ReplicaID); err != nil {
+		return err
+	}
 	l.removeMetadata(hakeeper.DefaultHAKeeperShardID, p.ReplicaID)
 	return nil
 }
@@ -519,9 +523,6 @@ func (l *store) executeCatalogCommand(cmd pb.ScheduleCommand) error {
 		if err := l.executeCatalogStart(*p); err != nil {
 			return err
 		}
-		if cfg.ChangeType == pb.KillZombie {
-			l.removeMetadata(hakeeper.DefaultHAKeeperShardID, p.ReplicaID)
-		}
 		return nil
 	default:
 		return catalogExecutionError()
```

**File**: `pkg/logservice/catalog_metadata_executor_test.go` (modified, +7/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"errors"
 	"maps"
+	"os"
 	"sync"
 	"testing"
 	"time"
@@ -249,6 +250,10 @@ func TestCatalogExecutorLifecycle(t *testing.T) {
 	hb = s.getHeartbeatMessage()
 	require.Equal(t, p.Token, hb.CatalogMetadataStartResult.Token)
 	require.True(t, hb.CatalogMetadataStartResult.Completed)
+	nid := nodeID{shardID: hakeeper.DefaultHAKeeperShardID, replicaID: p.ReplicaID}
+	testPrepareSnapshot(t, s.snapshotMgr, nid, snapshotIndex(123))
+	require.NoError(t, s.snapshotMgr.Init(nid.shardID, nid.replicaID))
+	exportPath := s.snapshotMgr.exportPath(nid.shardID, nid.replicaID)
 	revoke := p
 	revoke.RevocationPending = true
 	var wg sync.WaitGroup
@@ -261,6 +266,8 @@ func TestCatalogExecutorLifecycle(t *testing.T) {
 	wg.Wait()
 	require.NoError(t, <-errs)
 	require.False(t, s.catalogReplicaPresent(p, false))
+	_, err = s.cfg.FS.Stat(exportPath)
+	require.ErrorIs(t, err, os.ErrNotExist)
 	require.Error(t, s.executeCatalogStart(p))
 	require.True(t, s.getHeartbeatMessage().CatalogMetadataStartResult.Revoked)
 	require.NoError(t, s.close())
```

**File**: `pkg/logservice/errors.go` (modified, +8/-3)
```diff
@@ -88,10 +88,15 @@ func toError(ctx context.Context, resp pb.Response) error {
 	if resp.ErrorCode == uint32(moerr.ErrNoHAKeeper) {
 		return moerr.NewNoHAKeeper(ctx)
 	} else if resp.ErrorCode == uint32(moerr.ErrInvalidTruncateLsn) {
-		return moerr.NewInvalidTruncateLsn(ctx, 0, 0)
+		if resp.ErrorMessage != "" {
+			return moerr.NewInvalidTruncateLsnWithMessage(ctx, resp.ErrorMessage)
+		}
+		return moerr.NewInvalidTruncateLsnWithMessage(ctx, "invalid truncate lsn")
 	} else if resp.ErrorCode == uint32(moerr.ErrNotLeaseHolder) {
-		// holder id get lost?
-		return moerr.NewNotLeaseHolder(ctx, 0xDEADBEEF)
+		if resp.ErrorMessage != "" {
+			return moerr.NewNotLeaseHolderWithMessage(ctx, resp.ErrorMessage)
+		}
+		return moerr.NewNotLeaseHolderWithMessage(ctx, "not lease holder")
 	} else if resp.ErrorCode == uint32(moerr.ErrInternal) {
 		// internal error
 		return moerr.NewInternalError(ctx, resp.ErrorMessage)
```

**File**: `pkg/logservice/issue32667_regression_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
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
+package logservice
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/hakeeper"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/stretchr/testify/require"
+)
+
+func TestBootstrapLeaderRetakeStartsNewTermBudget(t *testing.T) {
+	for _, tc := range []struct {
+		name          string
+		interval      time.Duration
+		beforeB       time.Duration
+		arrivalMargin time.Duration
+	}{
+		{name: "short", interval: 30 * time.Millisecond, beforeB: time.Second, arrivalMargin: 50 * time.Millisecond},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			runHAKeeperClusterTest(t, func(t *testing.T, services []*Service) {
+				stores := []*store{services[0].store, services[1].store, services[2].store}
+				for _, s := range stores {
+					s.cfg.HAKeeperCheckInterval.Duration = tc.interval
+				}
+				require.NoError(t, stores[0].setInitialClusterInfo(1, 1, 3, hakeeper.K8SIDRangeEnd+10, nil, nil))
+				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
+				defer cancel()
+				for _, s := range stores {
+					_, err := s.addLogStoreHeartbeat(ctx, s.getHeartbeatMessage())
+					require.NoError(t, err)
+				}
+				_, err := stores[0].addTNStoreHeartbeat(ctx, pb.TNStoreHeartbeat{UUID: "retake-diagnostic-tn"})
+				require.NoError(t, err)
+				first := -1
+				var term uint64
+				for i, s := range stores {
+					ok, currentTerm, err := s.isLeaderHAKeeper()
+					require.NoError(t, err)
+					if ok {
+						first, term = i, currentTerm
+						break
+					}
+				}
+				require.NotEqual(t, -1, first)
+				a := stores[first]
+				second := (first + 1) % len(stores)
+				b := stores[second]
+				state, err := a.getCheckerState()
+				require.NoError(t, err)
+				require.NoError(t, a.bootstrap(term, state))
+				state, err = a.getCheckerState()
+				require.NoError(t, err)
+				require.Equal(t, pb.HAKeeperBootstrapCommandsReceived, state.State)
+				originalDeadline := a.bootstrapCheckDeadline
+				require.False(t, originalDeadline.IsZero())
+				a.hakeeperCheck()
+				require.Equal(t, originalDeadline, a.bootstrapCheckDeadline)
+				t.Logf("A deadline=%s, interval=%s", originalDeadline.Format(time.RFC3339Nano), tc.interval)
+				time.Sleep(tc.beforeB)
+				require.NoError(t, a.requestLeaderTransfer(hakeeper.DefaultHAKeeperShardID, uint64(second+1)))
+				require.Eventually(t, func() bool { ok, _, err := b.isLeaderHAKeeper(); return err == nil && ok }, 10*time.Second, 20*time.Millisecond)
+				state, err = b.getCheckerState()
+				require.NoError(t, err)
+				require.Equal(t, pb.HAKeeperBootstrapCommandsReceived, state.State)
+				require.NoError(t, b.checkBootstrap(state))
+				bDeadline := b.bootstrapCheckDeadline
+				require.True(t, bDeadline.After(originalDeadline))
+				t.Logf("B deadline=%s", bDeadline.Format(time.RFC3339Nano))
+				if wait := time.Until(originalDeadline.Add(tc.arrivalMargin)); wait > 0 {
+					time.Sleep(wait)
+				}
+				require.True(t, time.Now().Before(bDeadline), "B's budget must still be live")
+				require.NoError(t, b.requestLeaderTransfer(hakeeper.DefaultHAKeeperShardID, uint64(first+1)))
+				require.Eventually(t, func() bool { ok, _, err := a.isLeaderHAKeeper(); return err == nil && ok }, 10*time.Second, 20*time.Millisecond)
+				state, err = a.getCheckerState()
+				require.NoError(t, err)
+				require.Equal(t, pb.HAKeeperBootstrapCommandsReceived, state.State)
+				a.hakeeperCheck()
+				state, err = a.getCheckerState()
+				require.NoError(t, err)
+				require.Equal(t, pb.HAKeeperBootstrapCommandsReceived, state.State)
+				require.True(t, a.bootstrapCheckDeadline.After(originalDeadline))
+				require.True(t, time.Now().Before(a.bootstrapCheckDeadline))
+			})
+		})
+	}
+}
```

**File**: `pkg/logservice/issue32677_regression_test.go` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
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
+package logservice
+
+import (
+	"bytes"
+	"context"
+	"encoding/hex"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/lni/dragonboat/v4/raftpb"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/stretchr/testify/require"
+)
+
+func TestRejectedAppendIsNotUserRecord(t *testing.T) {
+	runServiceTest(t, false, true, func(t *testing.T, s *Service) {
+		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+		defer cancel()
+		connect := func(id uint64) {
+			resp := s.handleConnect(ctx, pb.Request{Method: pb.CONNECT,
+				LogRequest: pb.LogRequest{ShardID: 1, TNID: id}})
+			require.Equal(t, uint32(moerr.Ok), resp.ErrorCode)
+		}
+		connect(100)
+		connect(101)
+		const walPayloadHex = "e8030200010000000000000000000000000000000000000000000000000000000000000000000100000001000000000000000000000000000000830000000100000000000000d5070100150000001c0000000000000083010000000000000000000000000000000000000000000072656a65637465642d6275742d7265706c617965643e00000045000000"
+		walPayload, err := hex.DecodeString(walPayloadHex)
+		require.NoError(t, err)
+		cmd := getTestAppendCmd(100, walPayload)
+		resp := s.handleAppend(ctx, pb.Request{Method: pb.APPEND_WAL,
+			LogRequest: pb.LogRequest{ShardID: 1}}, cmd, true)
+		require.NotEqual(t, uint32(moerr.Ok), resp.ErrorCode)
+		require.Zero(t, resp.LogResponse.Lsn)
+		records, _, err := s.store.queryLog(ctx, 1, 1, 1<<20)
+		require.NoError(t, err)
+		var found []pb.LogRecord
+		for _, rec := range records {
+			if bytes.Equal(rec.Data, cmd) {
+				found = append(found, rec)
+			}
+		}
+		require.Len(t, found, 1)
+		require.Equal(t, pb.LeaseRejected, found[0].Type)
+		require.NotZero(t, found[0].Lsn)
+
+		accepted := getTestAppendCmd(101, []byte("accepted-after-rejection"))
+		resp = s.handleAppend(ctx, pb.Request{Method: pb.APPEND_WAL,
+			LogRequest: pb.LogRequest{ShardID: 1}}, accepted, true)
+		require.Equal(t, uint32(moerr.Ok), resp.ErrorCode)
+		records, _, err = s.store.queryLog(ctx, 1, found[0].Lsn, 1<<20)
+		require.NoError(t, err)
+		var acceptedType pb.RecordType
+		for _, rec := range records {
+			if bytes.Equal(rec.Data, accepted) {
+				acceptedType = rec.Type
+			}
+		}
+		require.Equal(t, pb.UserRecord, acceptedType)
+
+		digest := strings.Repeat("a", walRecoveryDigestSize)
+		_, err = s.store.propose(ctx, s.store.nh.GetNoOPSession(1), getBeginWALRecoveryCmd(digest, 1))
+		require.NoError(t, err)
+		firstRecovery := getTestAppendCmd(walRecoveryLeaseHolderID, []byte("recovery-accepted"))
+		resp = s.handleAppend(ctx, pb.Request{Method: pb.APPEND_WAL,
+			LogRequest: pb.LogRequest{ShardID: 1}}, firstRecovery, true)
+		require.Equal(t, uint32(moerr.Ok), resp.ErrorCode)
+		secondRecovery := getTestAppendCmd(walRecoveryLeaseHolderID, []byte("recovery-rejected"))
+		resp = s.handleAppend(ctx, pb.Request{Method: pb.APPEND_WAL,
+			LogRequest: pb.LogRequest{ShardID: 1}}, secondRecovery, true)
+		require.Equal(t, uint32(moerr.ErrNotLeaseHolder), resp.ErrorCode)
+		records, _, err = s.store.queryLog(ctx, 1, 1, 1<<20)
+		require.NoError(t, err)
+		recoveryTypes := make(map[string]pb.RecordType)
+		for _, rec := range records {
+			if bytes.Equal(rec.Data, firstRecovery) {
+				recoveryTypes["first"] = rec.Type
+			}
+			if bytes.Equal(rec.Data, secondRecovery) {
+				recoveryTypes["second"] = rec.Type
+			}
+		}
+		require.Equal(t, pb.UserRecord, recoveryTypes["first"])
+		require.Equal(t, pb.LeaseRejected, recoveryTypes["second"])
+	})
+}
+
+func TestRejectedReadKeepsLeaseSnapshotAcrossTruncate(t *testing.T) {
+	machine := newStateMachine(1, 1).(*stateMachine)
+	machine.state.Index = 9
+	machine.state.LeaseHistory[3] = 100
+	machine.state.LeaseHistory[4] = 101
+	machine.state.LeaseHistory[7] = 100
+	machine.rebuildLeaseIndexes()
+	v, err := machine.Lookup(userEntryStateQuery{first: 5, last: 5})
+	require.NoError(t, err)
+	state := v.(userEntryState)
+	machine.truncateLeaseHistory(8) // A truncate after the read snapshot drops the old transition.
+	require.NotContains(t, machine.state.LeaseHistory, uint64(4))
+	machine.state.TruncatedLsn = 8
+	late, err := machine.Lookup(userEntryStateQuery{first: 5, last: 5})
+	require.NoError(t, err)
+	require.GreaterOrEqual(t, late.(userEntryState).truncatedLSN, uint64(5))
+	cmd := getTestAppendCmd(100, []byte("rejected-before-truncat
```

#### Recent Merged Pull Requests:
- **PR #32868** (2026-11-17): [4.2-dev] fix: restore DATA BRANCH lineage after restore (@gouhongshen)
- **PR #32866** (2026-11-17): [4.2-dev] fix(tae): propagate checkpoint fallback read errors on 4.2 (@LeftHandCold)
- **PR #32865** (2026-11-17): fix(conntrack): restart ordered monitoring after receive errors (@LeftHandCold)
- **PR #32864** (2026-11-17): fix(scan): admit nullable deep-offset pagination into the ordered cutoff (@gouhongshen)
- **PR #32862** (2026-11-17): fix(compile): preserve prepared TP expression reuse (@LeftHandCold)
- **PR #32861** (2026-11-17): [4.2.1-hotfix] backport VALUES and ODKU index maintenance fixes (@aptend)

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

## X. conntrack): restart ordered monitoring after receive errors

**RULE**:
When implementing operations in `cmd/mo-service/debug_connections.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `59bf4b8f`: conntrack): restart ordered monitoring after receive errors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/mo-service/debug_connections.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"errors"
	connsThreshold         = 1024
	conntrackRetryInterval = 5 * time.Second
	errConntrackClose       = errors.New("conntrack socket close failed")
	// Capture the factory once; every replacement has the same owner and policy.
	dial := dialConntrack
	listener, err := listenConntrack(dial)
	// Keep the existing process lifetime. Runtime replacement only happens after
	// the worker reports a fatal error; it is then safe to join that worker.
	go runConnectionTracking(context.Background(), listener, dial)
	return nil
}
// A listener owns one socket and its queues. Replacements never share queues
// or the consumer's map, so an old generation cannot update the new one.
type conntrackListener struct {
	client conntrackClient
	events chan conntrack.Event
	errors chan error
}

func listenConntrack(dial func() (conntrackClient, error)) (*conntrackListener, error) {
	c, err := dial()
	if err != nil {
		return nil, err
	}
		if closeErr := c.Close(); closeErr != nil {
			return nil, errors.Join(err, errConntrackClose, closeErr)
		}
		return nil, err
	return &conntrackListener{client: c, events: events, errors: errorChan}, nil
}
func (l *conntrackListener) close() error {
	// conntrack.C
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	connsThreshold = 1024
	c, err := dialConntrack()
		_ = c.Close()
		return err
		defer c.Close()
		logConnTrack(context.Background(), events, errorChan)
	return nil
func logConnTrack(ctx context.Context, events chan conntrack.Event, errorChan chan error) {
			return
		case ev := <-events:
		case err := <-errorChan:
			logutil.Error("conntrack: error", zap.Error(err))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `59bf4b8f` are properly handled with clean fallback behavior.
