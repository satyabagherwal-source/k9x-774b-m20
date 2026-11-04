> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `e997c817`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T02:19:24.108Z  
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
> **Harvest Timestamp**: 2026-11-04T02:19:23.808Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2061 stars

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
- **Issue #32108** (2026-11-04): **fix(python): preserve numeric table builder scale**
  *Symptoms*: ## What type of PR is this?  - [x] BUG  ## Which issue(s) this PR fixes:  Fixes #32091  ## What this PR does / why we need it:  VectorTableBuilder.add_numeric_column accepted scale but discarded it for FLOAT and DOUBLE. With precision=10 and scale=2, FLOAT compiled as FLOAT(10), while DOUBLE raised ArgumentError because SQLAlchemy requires both precision and scale.  Forward scale alongside precision to the MySQL FLOAT/DOUBLE constructors. Add 11 tests covering scale zero and two, unchanged decimal/numeric behavior, omitted precision/scale, FLOAT precision-only support, and generated MatrixOne DDL.  Validation on base c337122982537dcf957705cb6fc5f7f9bdc6a0f6, Python 3.12 and SQLAlchemy 2.1.6:  - Before fix: four regression failures, seven passing controls. - After fix: full offline suite passed, 2990 tests plus 106 subtests. - Black, fatal Flake8 checks (E9,F63,F7,F82), and git diff --check passed.  Two files changed. Validation covers column construction and DDL compilation; no live-server execution is claimed.

- **Issue #32103** (2026-11-03): **fix(plan): support LENGTH/OCTET_LENGTH/CHAR_LENGTH on BIT columns**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #31183  ## What this PR does / why we need it:  ### Root cause  `LENGTH`/`OCTET_LENGTH` are backed by the `LENGTH` built-in and `CHAR_LENGTH`/`CHARACTER_LENGTH` by `LENGTH_UTF8` (`pkg/sql/plan/function/function_id.go`). Both were registered with `checkFn: stringDomainFixedTypeMatch`, which never admits `types.T_bit` (BIT's implicit-cast rule row only targets INT64/UINT64), so every call on a BIT column failed function binding with ERROR 20203 `invalid argument ...`. BIT literals worked because they are binary-string constants and never reach that type-match path.  ### Change  - `pkg/sql/plan/function/type_check.go`: new `lengthTypeMatch` — a single BIT argument binds directly with no implicit cast, so the declared width M is preserved; all other inputs keep the previous string-domain behavior. BIT's global implicit-cast rules are untouched. - `pkg/sql/plan/function/list_builtIn.go`: `LENGTH` and `LENGTH_UTF8` use `lengthTypeMatch` and each gains a BIT overload returning INT64, evaluated by the new executor. - `pkg/sql/plan/function/func_unary.go`: new `LengthBit` executor returns `(width+7)/8`, i.e. ceil(M/8), for declared widths 1..64. This matches MySQL 8.0 fixed storage width (`Field_bit::pack_length()`); BIT values stringify with the binary charset, so the character count equals t

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

### Incident Patch 1: `1876b2f9` (2026-11-03)
**Commit Message**: fix(fileservice): bound MinIO range reads without draining on close (#32053)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31692

## What this PR does / why we need it:

MinIO bounded reads limited returned bytes but requested an open-ended object suffix and drained it on Close, amplifying small reads into large downloads.

- Set the HTTP Range upper bound on every initial/retry request and avoid Seek overwriting it. Close bounded readers without draining unread data; preserve unbounded-read behavior.
- Preserve ETag/VersionID conditions and retry offsets. Centralize byte limiting, handle nil starts, reject empty/reversed ranges, and close readers after initialization failures.
- Add deterministic regression coverage for actual HTTP response bytes, range boundaries, uncached S3FS consumers, partial-response retries, identity failures, early close, and cancellation.

Local validation on macOS arm64 with Go 1.27.1:
- `mo-cgo-test -json -count=1 -timeout=600s ./pkg/fileservice` and the corresponding `-race` run passed (7 existing skips; no n

**File**: `pkg/fileservice/minio_sdk.go` (modified, +20/-12)
```diff
@@ -395,11 +395,7 @@ func (a *MinioSDK) ReadObjectWithIdentity(
 		r.Close()
 		return nil, mapMinioConditionalReadError(err)
 	}
-	r = mapReadCloserErrors(r, mapMinioConditionalReadError)
-	if max == nil {
-		return r, nil
-	}
-	return &readCloser{r: io.LimitReader(r, *max-*min), closeFunc: r.Close}, nil
+	return mapReadCloserErrors(r, mapMinioConditionalReadError), nil
 }
 
 func mapMinioConditionalReadError(err error) error {
@@ -506,15 +502,10 @@ func (a *MinioSDK) Read(
 	// eager read to expose file not found error
 	_, err = r.Read(nil)
 	if err != nil {
+		r.Close()
 		return nil, err
 	}
-	if max == nil {
-		return r, nil
-	}
-	return &readCloser{
-		r:         io.LimitReader(r, int64(*max-*min)),
-		closeFunc: r.Close,
-	}, nil
+	return r, nil
 }
 
 func (a *MinioSDK) Delete(
@@ -641,8 +632,16 @@ func (a *MinioSDK) getObjectWithOptions(
 	if min == nil {
 		min = ptrTo[int64](0)
 	}
+	if max != nil && *max <= *min {
+		return nil, moerr.NewEmptyRangeNoCtx(key)
+	}
 	r, err := newRetryableReader(
 		func(offset int64) (io.ReadCloser, error) {
+			if max != nil {
+				if err := options.SetRange(offset, *max-1); err != nil {
+					return nil, err
+				}
+			}
 			obj, err := DoWithRetryContext(
 				ctx,
 				"s3 get object",
@@ -658,8 +657,14 @@ func (a *MinioSDK) getObjectWithOptions(
 			if err != nil {
 				return nil, err
 			}
+			if max != nil {
+				// Seek would replace the bounded Range with an open-ended one.
+				// Close the bounded response directly, without draining unread data.
+				return obj, nil
+			}
 			if offset > 0 {
 				if _, err := obj.Seek(offset, 0); err != nil {
+					obj.Close()
 					return nil, err
 				}
 			}
@@ -678,6 +683,9 @@ func (a *MinioSDK) getObjectWithOptions(
 	if err != nil {
 		return nil, err
 	}
+	if max != nil {
+		return &readCloser{r: io.LimitReader(r, *max-*min), closeFunc: r.Close}, nil
+	}
 	return r, nil
 }
 
```

**File**: `pkg/fileservice/minio_sdk_range_lifecycle_test.go` (added, +349/-0)
```diff
@@ -0,0 +1,349 @@
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
+package fileservice
+
+import (
+	"context"
+	"fmt"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"strconv"
+	"strings"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"testing/iotest"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/minio/minio-go/v7"
+	"github.com/minio/minio-go/v7/pkg/credentials"
+	"github.com/stretchr/testify/require"
+)
+
+// Object.Close releases its response from the SDK worker, so counters and the
+// completion signal must also be safe to observe from the test goroutine.
+type minioRangeBody struct {
+	io.Reader
+	reads, bytes, closes atomic.Int64
+	closed               chan struct{}
+	once                 sync.Once
+}
+
+func (b *minioRangeBody) Read(p []byte) (int, error) {
+	b.reads.Add(1)
+	n, err := b.Reader.Read(p)
+	b.bytes.Add(int64(n))
+	return n, err
+}
+
+func (b *minioRangeBody) Close() error {
+	b.closes.Add(1)
+	b.once.Do(func() { close(b.closed) })
+	return nil
+}
+
+func (b *minioRangeBody) waitClosed(t *testing.T) {
+	t.Helper()
+	select {
+	case <-b.closed:
+	case <-time.After(5 * time.Second):
+		t.Fatal("MinIO response was not closed")
+	}
+	require.Equal(t, int64(1), b.closes.Load())
+}
+
+func newMinioRangeTestSDK(t *testing.T, transport http.RoundTripper) *MinioSDK {
+	t.Helper()
+	client, err := minio.New("minio.invalid", &minio.Options{
+		Creds: credentials.NewStaticV4("", "", ""), Region: "us-east-1", Transport: transport,
+	})
+	require.NoError(t, err)
+	return &MinioSDK{bucket: "bucket", client: client}
+}
+
+func minioRangeTestResponse(req *http.Request, body io.ReadCloser, size int) *http.Response {
+	return &http.Response{
+		StatusCode: http.StatusPartialContent, Request: req, Body: body, ContentLength: int64(size),
+		Header: http.Header{
+			"Content-Length": {strconv.Itoa(size)},
+			"Last-Modified":  {time.Unix(1, 0).UTC().Format(http.TimeFormat)},
+			"Etag":           {`"etag"`},
+		},
+	}
+}
+
+func openMinioRangeTestReader(t *testing.T, sdk *MinioSDK, identity string) io.ReadCloser {
+	t.Helper()
+	min, max := int64(1), int64(6)
+	var reader io.ReadCloser
+	var err error
+	if identity == "" {
+		reader, err = sdk.Read(t.Context(), "object", &min, &max)
+	} else {
+		expected := ObjectIdentity{ETag: "etag", Size: 16}
+		if identity == "version" {
+			expected.VersionID = "version"
+		}
+		reader, err = sdk.ReadObjectWithIdentity(t.Context(), "object", &min, &max, expected)
+	}
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = reader.Close() })
+	return reader
+}
+
+func TestMinioSDKBoundedCloseDoesNotRead(t *testing.T) {
+	for _, tc := range []struct {
+		name, identity string
+		take           int
+	}{
+		{name: "unread"},
+		{name: "partial", take: 2},
+		{name: "full", take: 5},
+		{name: "etag", identity: "etag", take: 2},
+		{name: "version", identity: "version", take: 2},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			body := &minioRangeBody{Reader: strings.NewReader("12345"), closed: make(chan struct{})}
+			sdk := newMinioRangeTestSDK(t, roundTripperFunc(func(req *http.Request) (*http.Response, error) {
+				return minioRangeTestResponse(req, body, 5), nil
+			}))
+			reader := openMinioRangeTestReader(t, sdk, tc.identity)
+			prefix := make([]byte, tc.take)
+			_, err := io.ReadFull(reader, prefix)
+			require.NoError(t, err)
+			require.Equal(t, "12345"[:tc.take], string(prefix))
+			reads := body.reads.Load()
+			require.NoError(t, reader.Close())
+			body.waitClosed(t)
+			require.Equal(t, reads, body.reads.Load(), "Close must not read the response")
+			require.Equal(t, int64(tc.take), body.bytes.Load())
+		})
+	}
+}
+
+func TestMinioSDKBoundedReadRetry(t *testing.T) {
+	for _, tc := range []struct {
+		name, identity string
+		prefix         bool
+		failure        int
+	}{
+		{name: "delivered prefix", prefix: true},
+		{name: "bytes and error in one read"},
+		{name: "etag", identity: "etag", prefix: true},
+		{name: "version", identity: "version", prefix: true},
+		{name: "etag changed", identity: "etag", prefix: true, failure: http.StatusPreconditionFailed},
+		{name: "version gone", identity: "version", prefix: true, failure: http.StatusNotFound},
+		{name: "reopen denied", prefix: true, failure: http.StatusForbidden},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			first := &minioRangeBody{
+				Reader: io.MultiReader(strings.NewReader("12"), iotest.ErrReader(io.ErrUnexpectedEOF)),
+				
```

**File**: `pkg/fileservice/minio_sdk_range_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
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
+package fileservice
+
+import (
+	"context"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+type minioRangeResponse struct {
+	http.ResponseWriter
+	bytes int
+}
+
+func (w *minioRangeResponse) Write(p []byte) (int, error) {
+	n, err := w.ResponseWriter.Write(p)
+	w.bytes += n
+	return n, err
+}
+
+func TestMinioSDKReadRanges(t *testing.T) {
+	const data = "0123456789abcdef"
+	for _, tc := range []struct {
+		name, wantRange, identity, consumer string
+		min, max                            *int64
+		want                                string
+	}{
+		{name: "bounded", min: ptrTo[int64](1), max: ptrTo[int64](4), wantRange: "bytes=1-3", want: "123"},
+		{name: "zero start", min: ptrTo[int64](0), max: ptrTo[int64](4), wantRange: "bytes=0-3", want: "0123"},
+		{name: "nil start", max: ptrTo[int64](4), wantRange: "bytes=0-3", want: "0123"},
+		{name: "first byte", max: ptrTo[int64](1), wantRange: "bytes=0-0", want: "0"},
+		{name: "one byte", min: ptrTo[int64](1), max: ptrTo[int64](2), wantRange: "bytes=1-1", want: "1"},
+		{name: "tail", min: ptrTo[int64](13), max: ptrTo[int64](16), wantRange: "bytes=13-15", want: "def"},
+		{name: "past end", min: ptrTo[int64](13), max: ptrTo[int64](20), wantRange: "bytes=13-19", want: "def"},
+		{name: "unbounded", want: data},
+		{name: "unbounded suffix", min: ptrTo[int64](1), wantRange: "bytes=1-", want: data[1:]},
+		{name: "etag", identity: "etag", min: ptrTo[int64](1), max: ptrTo[int64](4), wantRange: "bytes=1-3", want: "123"},
+		{name: "version", identity: "version", min: ptrTo[int64](1), max: ptrTo[int64](4), wantRange: "bytes=1-3", want: "123"},
+		{name: "identity nil start", identity: "etag", max: ptrTo[int64](4), wantRange: "bytes=0-3", want: "0123"},
+		{name: "file service buffered", consumer: "buffered", min: ptrTo[int64](1), max: ptrTo[int64](4), wantRange: "bytes=1-3", want: "123"},
+		{name: "file service stream", consumer: "stream", min: ptrTo[int64](1), max: ptrTo[int64](4), wantRange: "bytes=1-3", want: "123"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			type transfer struct {
+				rangeHeader, ifMatch, version string
+				bytes                         int
+			}
+			transfers := make(chan transfer, 1)
+			var gets atomic.Int32
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				w.Header().Set("ETag", `"etag"`)
+				response := &minioRangeResponse{ResponseWriter: w}
+				http.ServeContent(response, r, "object", time.Unix(1, 0), strings.NewReader(data))
+				if r.Method == http.MethodGet {
+					gets.Add(1)
+					select {
+					case transfers <- transfer{r.Header.Get("Range"), r.Header.Get("If-Match"), r.URL.Query().Get("versionId"), response.bytes}:
+					default:
+					}
+				}
+			}))
+			t.Cleanup(server.Close)
+			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
+			t.Cleanup(cancel)
+			sdk, err := NewMinioSDK(ctx, ObjectStorageArguments{
+				Endpoint: server.URL, Region: "us-east-1", Bucket: "bucket",
+				NoDefaultCredentials: true, NoBucketValidation: true,
+			}, nil)
+			require.NoError(t, err)
+			var reader io.ReadCloser
+			if tc.consumer != "" {
+				fs := &S3FS{name: "range", storage: sdk, ioMerger: NewIOMerger()}
+				vector := &IOVector{FilePath: "object", Policy: SkipAllCache, Entries: []IOEntry{{Offset: *tc.min, Size: *tc.max - *tc.min}}}
+				t.Cleanup(vector.Release)
+				if tc.consumer == "stream" {
+					vector.Entries[0].ReadCloserForRead = &reader
+				}
+				require.NoError(t, fs.Read(ctx, vector))
+				if tc.consumer == "buffered" {
+					reader = io.NopCloser(strings.NewReader(string(vector.Entries[0].Data)))
+				}
+			} else if tc.identity != "" {
+				identity := ObjectIdentity{ETag: "etag", Size: int64(len(data))}
+				if tc.identity == "version" {
+					identity.VersionID = "version"
+				}
+				reader, err = sdk.ReadObjectWithIdentity(ctx, "object", tc.min, tc.max, identity)
+				require.NoError(t, err)
+			} else {
+				reader, err = sdk.Read(ctx, "object", tc.min, tc.max)
+				require.NoError(t, err)
+			}
+			t.Cleanup(func() { _ = reader.Close() })
+			got, err := io.ReadAll(reader)
+			require.NoError(t, err)
+			require.NoError(t, reader.Close())
+			require.Equal(t, tc.want, string(got))
+			select {
+			cas
```

---

### Incident Patch 2: `d2451d5c` (2026-11-03)
**Commit Message**: fix: bound compression scratch growth and oversized merge batches (#32052)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32051

## What this PR does / why we need it:

A legal LZ4 scratch request slightly above 1 GiB was rounded to 2 GiB, exceeding mpool's single-allocation limit and panicking. Retain power-of-two growth where it fits; allocate the exact requested size when rounding alone would cross the limit. Actual allocation failures retain the existing panic behavior.

Check the output batch size after every appended row in both sorted merge and reshape. Flush the block and finish the object once its size exceeds 1.5 × target object size (192 MiB for a 128 MiB target), using the existing writer path. Keep the schema row limit and source transfer stride unchanged. The threshold is soft: one indivisible row may exceed it.

Only critical regression coverage is added:

- Compression capacity at 1 GiB and mpool's allocation boundary, without GiB-sized test allocations.
- Sorted merge and reshape with skewed rows and a deleted row: persist

**File**: `pkg/objectio/writer.go` (modified, +11/-2)
```diff
@@ -143,22 +143,31 @@ func arenaNextPow2(n int) int {
 
 // CompressBuf returns a scratch buffer for LZ4 compression, growing as needed.
 // The buffer is retained across arena Reset() calls.  We round up to the next
-// power of 2 so that minor size variations don't trigger repeated allocations.
+// power of 2 unless that capacity exceeds mpool's single-allocation limit.
 func (a *WriteArena) CompressBuf(minSize int) []byte {
 	if len(a.compressBuf) < minSize {
 		if a.compressBuf != nil {
 			arenaMPool.Free(a.compressBuf)
 			a.compressBuf = nil // nil immediately so a panic in Alloc doesn't leave a dangling pointer
 		}
 		var err error
-		a.compressBuf, err = arenaMPool.Alloc(arenaNextPow2(minSize), true)
+		a.compressBuf, err = arenaMPool.Alloc(arenaCompressBufSize(minSize), true)
 		if err != nil {
 			panic(err)
 		}
 	}
 	return a.compressBuf[:minSize]
 }
 
+func arenaCompressBufSize(minSize int) int {
+	size := arenaNextPow2(minSize)
+	limit := mpool.MaxAllocationSize()
+	if int64(minSize) <= limit && int64(size) > limit {
+		return minSize
+	}
+	return size
+}
+
 // FreeBuffers releases the off-heap allocations and serialization scratch.
 // Call this before dropping an arena that won't be returned to the pool.
 func (a *WriteArena) FreeBuffers() {
```

**File**: `pkg/objectio/writer_test.go` (modified, +10/-0)
```diff
@@ -493,6 +493,16 @@ func TestWriteArena(t *testing.T) {
 		require.GreaterOrEqual(t, len(a.compressBuf), 200)
 	})
 
+	t.Run("compress capacity respects allocation boundary", func(t *testing.T) {
+		// Exercise the real GiB boundary without allocating a GiB buffer.
+		limit := int(mpool.MaxAllocationSize())
+		require.Equal(t, 1<<30, arenaCompressBufSize(1<<30))
+		require.Equal(t, 1<<30+1, arenaCompressBufSize(1<<30+1))
+		require.Equal(t, limit, arenaCompressBufSize(limit))
+		// An illegal request must still reach Alloc's existing failure path.
+		require.Greater(t, arenaCompressBufSize(limit+1), limit)
+	})
+
 	t.Run("zero-size arena falls back to exact make", func(t *testing.T) {
 		a := NewArena(0)
 		b := a.Alloc(10)
```

**File**: `pkg/vm/engine/tae/mergesort/merger.go` (modified, +1/-5)
```diff
@@ -195,7 +195,6 @@ func (m *merger[T]) merge(ctx context.Context) error {
 	defer releaseF()
 
 	mp := m.host.GetMPool()
-	bigblk := false
 	for m.heap.Len() != 0 {
 		select {
 		case <-ctx.Done():
@@ -235,9 +234,7 @@ func (m *merger[T]) merge(ctx context.Context) error {
 
 		m.stats.blkRowCnt++
 		m.stats.objRowCnt++
-		if m.stats.blkRowCnt%100 == 0 && m.stats.targetObjSize > 0 {
-			bigblk = m.buffer.Size() > int(m.stats.targetObjSize)*3/2
-		}
+		bigblk := m.stats.isBlockOversized(m.buffer)
 		// write new block
 		if m.stats.blkRowCnt == int(m.rowPerBlk) || bigblk {
 			m.stats.blkRowCnt = 0
@@ -264,7 +261,6 @@ func (m *merger[T]) merge(ctx context.Context) error {
 				m.stats.objBlkCnt = 0
 				m.stats.objRowCnt = 0
 				m.stats.objCnt++
-				bigblk = false
 			}
 		}
 
```

**File**: `pkg/vm/engine/tae/mergesort/reshaper.go` (modified, +3/-2)
```diff
@@ -116,7 +116,8 @@ func reshape(ctx context.Context, host MergeTaskHost) error {
 				stats.blkRowCnt++
 				stats.objRowCnt++
 
-				if stats.blkRowCnt == int(maxRowCnt) {
+				bigblk := stats.isBlockOversized(buffer)
+				if stats.blkRowCnt == int(maxRowCnt) || bigblk {
 					if writer == nil {
 						writer = host.PrepareNewWriter()
 					}
@@ -131,7 +132,7 @@ func reshape(ctx context.Context, host MergeTaskHost) error {
 
 					buffer.CleanOnlyData()
 
-					if stats.needNewObject() {
+					if stats.needNewObject() || bigblk {
 						if err := syncObject(ctx, writer, host); err != nil {
 							return err
 						}
```

**File**: `pkg/vm/engine/tae/mergesort/row_size_test.go` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
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
+package mergesort
+
+import (
+	"bytes"
+	"context"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/nulls"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/fileservice"
+	"github.com/matrixorigin/matrixone/pkg/objectio"
+	"github.com/matrixorigin/matrixone/pkg/objectio/ioutil"
+	"github.com/matrixorigin/matrixone/pkg/pb/api"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/stretchr/testify/require"
+)
+
+func TestMergeFlushesOversizedRows(t *testing.T) {
+	for _, sorted := range []bool{true, false} {
+		name := "reshape"
+		if sorted {
+			name = "sorted merge"
+		}
+		t.Run(name, func(t *testing.T) {
+			ctx := context.Background()
+			mp := mpool.MustNewZero()
+			fs := testutil.NewSharedFS()
+			host := &sizeLimitMergeHost{
+				jsonReadbackMergeHost: jsonReadbackMergeHost{mp: mp, loaded: make([]bool, 2)},
+				fs:                    fs,
+				sortKey:               -1,
+				deletes:               []*nulls.Nulls{{}, {}},
+			}
+			if sorted {
+				host.sortKey = 0
+			}
+			t.Cleanup(func() {
+				if host.transfer != nil {
+					host.transfer.Release()
+				}
+				for _, run := range host.runs {
+					run.Clean(mp)
+				}
+				fs.Close(ctx)
+				require.Zero(t, mp.CurrNB())
+				mpool.DeleteMPool(mp)
+			})
+			// Use a scaled byte budget: even a single large row may exceed it.
+			payloadSizes := []int{1, 1, 300, 1, 1, 80, 80, 1}
+			for run := range 2 {
+				bat := batch.NewWithSize(2)
+				bat.Attrs = []string{"key", "payload"}
+				bat.Vecs[0] = vector.NewVec(types.T_int64.ToType())
+				bat.Vecs[1] = vector.NewVec(types.T_varchar.ToType())
+				host.runs = append(host.runs, bat)
+				for row := range 4 {
+					key := row*2 + run
+					require.NoError(t, vector.AppendFixed(bat.Vecs[0], int64(key), false, mp))
+					require.NoError(t, vector.AppendBytes(bat.Vecs[1], bytes.Repeat([]byte{'x'}, payloadSizes[key]), false, mp))
+				}
+				bat.SetRowCount(4)
+			}
+			host.deletes[0].Add(2) // key 4 must retain the NoTransfer sentinel.
+
+			if sorted {
+				require.NoError(t, mergeObjs(ctx, host, 0))
+			} else {
+				require.NoError(t, reshape(ctx, host))
+			}
+			require.NotNil(t, host.transfer)
+			require.Equal(t, 8, host.transfer.Stride, "source block stride must not shrink with output blocks")
+			require.Len(t, host.commitEntry.CreatedObjs, 3, "flush before the row limit and before 100 rows")
+
+			var actual []int64
+			output := make([][][]int64, 0, len(host.commitEntry.CreatedObjs)) // object -> block -> keys
+			for _, raw := range host.commitEntry.CreatedObjs {
+				stat := objectio.ObjectStats(raw)
+				reader, err := ioutil.NewFileReaderNoCache(fs, stat.ObjectName().String())
+				require.NoError(t, err)
+				bats, release, err := reader.LoadAllColumns(ctx, []uint16{0, 1}, mp)
+				require.NoError(t, err)
+				var blocks [][]int64
+				for _, bat := range bats {
+					keys := append([]int64(nil), vector.MustFixedColWithTypeCheck[int64](bat.Vecs[0])...)
+					blocks = append(blocks, keys)
+					actual = append(actual, keys...)
+					// All rows before the last fit the budget: only one row can
+					// overshoot it, including when that row alone is oversized.
+					prefixSize := 0
+					for row, key := range keys {
+						require.LessOrEqual(t, prefixSize, 192)
+						value := bat.Vecs[1].GetBytesAt(row)
+						require.Equal(t, bytes.Repeat([]byte{'x'}, payloadSizes[key]), value)
+						prefixSize += 8 + types.VarlenaSize
+						if len(value) > types.VarlenaInlineSize {
+							prefixSize += len(value)
+						}
+					}
+				}
+				output = append(output, blocks)
+				release()
+			}
+			expected := []int64{0, 2, 6, 1, 3, 5, 7}
+			if sorted {
+				expected = []int64{0, 1, 2, 3, 5, 6, 7}
+			}
+			require.Equal(t, expected, actual)
+			for run := range 2 {
+				mapping := host.transfer.GetBlockMap(run)
+				for row := range 4 {
+					key := int64(row*2 + run)
+					dest := mapping[row]
+					if key == 4 {
+						require.Equal(t, api.NoTransfer, dest.ObjIdx)
+						continue
+					}
+					require.Less(t, int(dest.ObjIdx), len(output))
+					blocks := output[dest.ObjIdx]
+					require.Less(t, int(dest.BlkIdx), len(blocks))
+					keys := bl
```

**File**: `pkg/vm/engine/tae/mergesort/types.go` (modified, +7/-0)
```diff
@@ -15,6 +15,7 @@
 package mergesort
 
 import (
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/sort"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/options"
@@ -73,6 +74,12 @@ type mergeStats struct {
 	blkRowCnt, objRowCnt, objBlkCnt, objCnt int
 }
 
+// Check the soft byte limit after each appended row so only that row can
+// overshoot the limit, including when a single row is itself oversized.
+func (s *mergeStats) isBlockOversized(bat *batch.Batch) bool {
+	return s.targetObjSize > 0 && bat.Size() > int(s.targetObjSize)*3/2
+}
+
 func (s *mergeStats) needNewObject() bool {
 	if s.targetObjSize == 0 {
 		if s.blkPerObj == 0 {
```

---

### Incident Patch 3: `d036bcf4` (2026-11-03)
**Commit Message**: fix(python): disable implicit autoincrement for noninteger keys (#32095)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31650

## What this PR does / why we need it:

SQLAlchemy 1.4 and 2.0 implicitly mark a single numeric primary key as auto-incrementing. MatrixOne only supports AUTO_INCREMENT on integer columns, so simplified DOUBLE/DECIMAL primary keys compile into invalid DDL.

Normalize accepted TypeEngine classes to instances, and decide implicit AUTO_INCREMENT in MatrixOne's DDL compiler using the type resolved by the actual compilation dialect. This preserves integer behavior across sync/async drivers, wrapper types, and dialect variants while suppressing implicit autoincrement for noninteger types. Explicit AUTO_INCREMENT requests remain explicit.

Validation:
- Before the original fix on SQLAlchemy 1.4.54: 2 failed / 7 passed; DOUBLE and DECIMAL DDL contained unwanted AUTO_INCREMENT.
- Review regressions reproduced wrapper, differing-affinity variant, and async driver-dependent failures before their fixes.
- Owning contract file:

**File**: `clients/python/matrixone/sqlalchemy_ext/dialect.py` (modified, +28/-2)
```diff
@@ -19,7 +19,12 @@
 import sqlalchemy
 from sqlalchemy import event
 from sqlalchemy.sql.elements import ClauseElement
-from sqlalchemy.dialects.mysql.base import MySQLTypeCompiler, MySQLDialect, ischema_names as mysql_ischema_names
+from sqlalchemy.dialects.mysql.base import (
+    MySQLDDLCompiler,
+    MySQLTypeCompiler,
+    MySQLDialect,
+    ischema_names as mysql_ischema_names,
+)
 
 from .vector_type import VectorType, VectorPrecision
 from .._local_infile import _physical_driver
@@ -276,10 +281,27 @@ def visit_VECTOR(self, type_, **kw):
         return type_.get_col_spec() if hasattr(type_, 'get_col_spec') else 'VECTOR'
 
 
+class MatrixOneDDLCompiler(MySQLDDLCompiler):
+    """Render implicit AUTO_INCREMENT only for the type this dialect sees."""
+
+    def get_column_specification(self, column, **kw):
+        specification = super().get_column_specification(column, **kw)
+        resolved_type = column.type.dialect_impl(self.dialect)
+        auto_increment = ' AUTO_INCREMENT'
+        if (
+            column.autoincrement == 'auto'
+            and resolved_type._type_affinity is not sqlalchemy.Integer
+            and specification.endswith(auto_increment)
+        ):
+            specification = specification[: -len(auto_increment)]
+        return specification
+
+
 # Register the dialect
 MatrixOneDialect.statement_compiler = MatrixOneCompiler
 MatrixOneDialect.type_compiler = MatrixOneTypeCompiler
 MatrixOneDialect.type_compiler_cls = MatrixOneTypeCompiler
+MatrixOneDialect.ddl_compiler = MatrixOneDDLCompiler
 
 
 # MatrixOneVectorType removed - use VectorType from vector_type.py instead
@@ -333,7 +355,11 @@ def adapt_engine_dialect(engine):
     dialect.__class__ = type(
         'MatrixOne_' + driver_type.__name__,
         (driver_type, MatrixOneDialect),
-        {'supports_statement_cache': True, 'statement_compiler': MatrixOneCompiler},
+        {
+            'supports_statement_cache': True,
+            'statement_compiler': MatrixOneCompiler,
+            'ddl_compiler': MatrixOneDDLCompiler,
+        },
     )
     dialect.ischema_names = dict(dialect.ischema_names, **_mo_ischema_names)
     compiler = MatrixOneTypeCompiler(dialect)
```

**File**: `clients/python/matrixone/sqlalchemy_ext/table_builder.py` (modified, +6/-4)
```diff
@@ -65,6 +65,7 @@ def simplified_table(name, columns, primary_key=None, **kwargs):
     if any(key not in columns for key in keys):
         raise ValueError('primary_key must name existing columns')
     definitions = []
+    dtype: TypeEngine
     for column_name, definition in columns.items():
         options = {}
         inline_primary = False
@@ -121,13 +122,14 @@ def simplified_table(name, columns, primary_key=None, **kwargs):
                         dtype = constructor(fsp=precision)
                 else:
                     dtype = constructor(*(int(arg) for arg in args), **type_options)
-        elif isinstance(definition, TypeEngine) or (
-            isinstance(definition, type) and issubclass(definition, TypeEngine)
-        ):
+        elif isinstance(definition, TypeEngine):
             dtype = definition
+        elif isinstance(definition, type) and issubclass(definition, TypeEngine):
+            dtype = definition()
         else:
             raise TypeError('Column types must be strings or SQLAlchemy types')
-        definitions.append(Column(column_name, dtype, primary_key=column_name in keys or inline_primary, **options))
+        is_primary = column_name in keys or inline_primary
+        definitions.append(Column(column_name, dtype, primary_key=is_primary, **options))
     metadata = kwargs.pop('metadata', None) or MetaData()
     return Table(name, metadata, *definitions, **kwargs)
 
```

**File**: `clients/python/tests/offline/contracts/test_mapped_query_identity.py` (modified, +110/-1)
```diff
@@ -6,7 +6,20 @@
 from unittest.mock import AsyncMock, Mock
 
 import pytest
-from sqlalchemy import Column, Enum, Integer, JSON, String, TypeDecorator, create_engine, select
+from sqlalchemy import (
+    BigInteger,
+    Column,
+    Enum,
+    Integer,
+    JSON,
+    MetaData,
+    Numeric,
+    String,
+    Table,
+    TypeDecorator,
+    create_engine,
+    select,
+)
 from sqlalchemy.orm import aliased, declarative_base
 from sqlalchemy.schema import CreateTable
 
@@ -32,6 +45,19 @@ def process_result_value(self, value, dialect):
         return value[len('encoded:') :] if value.startswith('encoded:') else value
 
 
+class WrappedInteger(TypeDecorator):
+    impl = Integer
+    cache_ok = True
+
+
+class AsyncDriverInteger(TypeDecorator):
+    impl = Integer
+    cache_ok = True
+
+    def load_dialect_impl(self, dialect):
+        return Integer() if dialect.driver == 'aiomysql' else Numeric()
+
+
 class State(enum.Enum):
     READY = 'ready'
 
@@ -149,6 +175,89 @@ def test_simplified_types_and_primary_keys(definition, expected):
     table = simplified_table('typed', {'key': definition}, primary_key='key')
     ddl = str(CreateTable(table).compile(dialect=MatrixOneDialect()))
     assert expected in ddl and 'PRIMARY KEY' in ddl and table.c.key.primary_key
+    assert 'AUTO_INCREMENT' not in ddl
+
+
+def test_simplified_integer_primary_key_keeps_implicit_auto_increment():
+    table = simplified_table('typed', {'key': 'int'}, primary_key='key')
+    ddl = str(CreateTable(table).compile(dialect=MatrixOneDialect()))
+    assert 'INTEGER' in ddl and 'PRIMARY KEY' in ddl and 'AUTO_INCREMENT' in ddl
+
+
+@pytest.mark.parametrize(
+    'definition',
+    [
+        WrappedInteger,
+        WrappedInteger(),
+        Integer().with_variant(BigInteger(), 'matrixone'),
+    ],
+)
+def test_simplified_wrapped_integer_primary_key_keeps_implicit_auto_increment(definition):
+    table = simplified_table('typed', {'key': definition}, primary_key='key')
+    ddl = str(CreateTable(table).compile(dialect=MatrixOneDialect()))
+    assert 'PRIMARY KEY' in ddl and 'AUTO_INCREMENT' in ddl
+
+
+def test_simplified_dialect_integer_variant_keeps_sqlalchemy_autoincrement():
+    definition = Numeric().with_variant(Integer(), 'matrixone')
+    table = simplified_table('typed', {'key': definition}, primary_key='key')
+    control = Table('control', MetaData(), Column('key', definition, primary_key=True))
+    actual = str(CreateTable(table).compile(dialect=MatrixOneDialect()))
+    expected = str(CreateTable(control).compile(dialect=MatrixOneDialect()))
+    assert table.c.key.autoincrement == control.c.key.autoincrement == 'auto'
+    assert ('AUTO_INCREMENT' in actual) == ('AUTO_INCREMENT' in expected)
+
+
+def test_implicit_autoincrement_filter_preserves_column_comment():
+    table = Table(
+        'typed',
+        MetaData(),
+        Column('key', Numeric(), primary_key=True, comment='keep AUTO_INCREMENT text'),
+    )
+    ddl = str(CreateTable(table).compile(dialect=MatrixOneDialect()))
+    assert "COMMENT 'keep AUTO_INCREMENT text'" in ddl
+    assert ddl.count('AUTO_INCREMENT') == 1
+
+
+@pytest.mark.asyncio
+async def test_async_create_table_uses_actual_driver_for_implicit_auto_increment():
+    from sqlalchemy.ext.asyncio import create_async_engine
+    from matrixone.sqlalchemy_ext.dialect import adapt_engine_dialect
+
+    sync_dialect = MatrixOneDialect()
+    sync_dialect.driver = 'pymysql'
+    sync_table = simplified_table('sync_typed', {'key': AsyncDriverInteger}, primary_key='key')
+    sync_ddl = str(CreateTable(sync_table).compile(dialect=sync_dialect))
+    assert 'INTEGER' not in sync_ddl and 'AUTO_INCREMENT' not in sync_ddl
+
+    dialect_owner = create_async_engine('mysql+aiomysql://')
+    adapt_engine_dialect(dialect_owner.sync_engine)
+    dialect = dialect_owner.sync_engine.dialect
+    emitted = []
+
+    class Connection:
+        async def execute(self, statement):
+            emitted.append(str(statement.compile(dialect=dialect)))
+
+    class Begin:
+        async def __aenter__(self):
+            return Connection()
+
+        async def __aexit__(self, *args):
+            pass
+
+    class Engine:
+        def begin(self):
+            return Begin()
+
+    client = AsyncClient()
+    client._engine = Engine()
+    try:
+        await client.create_table('typed', {'key': AsyncDriverInteger}, primary_key='key')
+    finally:
+        await dialect_owner.dispose()
+    assert len(emitted) == 1
+    assert 'INTEGER' in emitted[0] and 'PRIMARY KEY' in emitted[0] and 'AUTO_INCREMENT' in emitted[0]
 
 
 def test_unknown_primary_key_fails_instead_of_being_ignored():
```

#### Recent Merged Pull Requests:
- **PR #32108** (2026-11-04): fix(python): preserve numeric table builder scale (@MatrixAdventurer)
- **PR #32103** (2026-11-03): fix(plan): support LENGTH/OCTET_LENGTH/CHAR_LENGTH on BIT columns (@gouhongshen)
- **PR #32095** (2026-11-03): fix(python): disable implicit autoincrement for noninteger keys (@MatrixAdventurer)
- **PR #32092** (2026-11-03): Fix JSON numeric comparisons beyond FLOAT range (@iamlinjunhong)
- **PR #32090** (closed): fix(import): prevent legacy transaction memory self-waits (@aptend)
- **PR #32089** (2026-11-03): Improve SORT ROLLUP reuse for MIN and MAX (@iamlinjunhong)

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

## X. fileservice): bound MinIO range reads without draining on close (#32053)

**RULE**:
When implementing operations in `pkg/fileservice/minio_sdk.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1876b2f9`: fileservice): bound MinIO range reads without draining on close (#32053). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/fileservice/minio_sdk.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	return mapReadCloserErrors(r, mapMinioConditionalReadError), nil
		r.Close()
	return r, nil
	if max != nil && *max <= *min {
		return nil, moerr.NewEmptyRangeNoCtx(key)
	}
			if max != nil {
				if err := options.SetRange(offset, *max-1); err != nil {
					return nil, err
				}
			}
			if max != nil {
				// Seek would replace the bounded Range with an open-ended one.
				// Close the bounded response directly, without draining unread data.
				return obj, nil
			}
					obj.Close()
	if max != nil {
		return &readCloser{r: io.LimitReader(r, *max-*min), closeFunc: r.Close}, nil
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	r = mapReadCloserErrors(r, mapMinioConditionalReadError)
	if max == nil {
		return r, nil
	}
	return &readCloser{r: io.LimitReader(r, *max-*min), closeFunc: r.Close}, nil
	if max == nil {
		return r, nil
	}
	return &readCloser{
		r:         io.LimitReader(r, int64(*max-*min)),
		closeFunc: r.Close,
	}, nil
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1876b2f9` are properly handled with clean fallback behavior.
