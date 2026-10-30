> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `91dfab21`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T20:05:19.934Z  
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
> **Harvest Timestamp**: 2026-10-30T20:05:18.535Z  
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
    """True when a string statement is DATA BRANCH MERGE or DATA BRANCH PICK.

    Leading and inter-keyword whitespace/comments are consumed with the
    server's lexical rules, so "data /* trace */ branch merge ...",
    "// trace\\ndata branch merge ..." and "/*! data branch merge src into
    dst */" (MySQL executable comment) classify like the server executes
    them, while a MERGE/PICK-shaped phrase sitting only inside an inert
    comment (e.g. "-- data branch merge a into b\\nSELECT 1") does not.
    """
    if not sql:
        return False
    pos = 0
    words = []
    for _ in range(3):
        pos = _skip_space_and_comments(sql, pos)
        word, pos = _read_word(sql, pos)
        if not word:
            return False
        words.append(word.lower())
    return words[0] == "data" and words[1] == "branch" and words[2] in ("merge", "pick")


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
- **Issue #31935** (2026-10-30): **plan: support DROP VIEW with multiple views (#31910)**
  *Symptoms*: Fixes #31910  ## Summary `DROP VIEW v1, v2 [, ...]` and `DROP VIEW IF EXISTS v1, v2, ...` failed with `20105 not supported: drop multiple (N) view`. They now work like MySQL (`DROP VIEW [IF EXISTS] view_name [, view_name] ...`) and like MO's own `DROP TABLE t1, t2`.  ## Cause `buildDropView` rejected any statement with more than one name. The executor already supports a multi-target `plan.DropTable` (`Tables`, used by `DROP TABLE t1, t2`), and each entry carries its own `IsView`.  ## Fix - `pkg/sql/plan/build_ddl.go`: move the per-name logic into `buildDropViewSingle` (unchanged rules: missing view / base table → `ErrBadView` without IF EXISTS; with IF EXISTS a missing view is skipped and a same-named base table is a no-op, never dropped; subscription views rejected). With several names, every entry is resolved first and placed in `DropTable.Tables`, so an error on any name drops nothing (MySQL behaves the same way). - `pkg/frontend/authenticate.go`: for a multi-name DROP VIEW, check DROP VIEW privilege per target (`authenticateMultiDropViewTargets`, same idea as `authenticateMultiDropTableTargets`), so a list spanning databases is not authorized by the first database only.  ## Evidence (before / after) - UT `pkg/sql/plan/build_ddl_drop_multi_view_test.go` (3 tests): RED on main (`not supported: drop multiple (3) view`), GREEN with the fix. `go test ./pkg/sql/plan/` ok; `./pkg/frontend -run 'Privilege|Authenticate|DropView|DropTable|determine'` ok. - E2E on single-node builds

- **Issue #31934** (2026-10-30): **fix(ci): cancel obsolete PR runs and avoid post-merge main checks**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Refs #29249  ## What this PR does / why we need it:  Cancel obsolete ALL CI runs when a PR closes, using the existing controller and two minutes of cleanup grace before force cancellation. Revalidate PR closure and run attempts; protect reopened PRs, post-close reruns, other forks and branches still needed by another open PR.  Avoid repeating tests after merges to main: retain pre-merge checks and release-branch check-in regression, with daily/manual SCA and Maven warming. The lightweight close-event cancellation controller still releases stale work. Align native-contract assertions with the retained PR path filters.  Reduce cold SCA setup by installing pinned, SHA256-verified golangci-lint 2.14.0 release binaries on supported Go 1.27 hosts through the existing downloader. Bound the download to 60 seconds and retain source fallback. Publish the tool cache before native/analysis work can fail. Other tool versions and source installation remain pinned.  Validation: 45 Node helper tests, native build contracts, 16 GPU/toolchain tests, downloader failure/atomicity tests, actionlint for eight workflows, syntax and diff checks pass. Real Linux/macOS arm64 release binaries were verified and executed; the macOS binary passed a focused project lint check. Full local tool installation remains blocked by e

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

### Incident Patch 1: `d8c90c20` (2026-10-30)
**Commit Message**: fix(plan): MySQL implicit boolean semantics for ENUM/SET, BIT literals and JSON conditions (#31492)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #30931
Related to #30930
Related to #30932

## What this PR does / why we need it:

Consolidated group #30931: ENUM/SET truthiness, BIT value literals, JSON
IF/CASE conditions. Each defect traces to a surface consuming display
text or a strict cast where the stored payload was required.

Root causes
- **#30931 (master)** ENUM/SET column references bind as display calls;
boolean contexts string-parsed labels: `IF(e,1,0)`/`IF(s,1,0)` returned
0 for every nonzero ordinal/bitmap, `WHERE e`/`s` and `e AND 1` failed
with 'a' is not a valid bool expression', grouped/DISTINCT boundaries
lost storage identity, and numeric SET IN/NOT IN comparisons re-parsed
labels after a review-round condition narrowing. On the persisted path
the binder binds raw storage (uint64/T_enum), which base already
evaluates correctly - so the r8 round also removed an over-broad feature
classification that refused native ses

**File**: `docs/design/20261027-implicit-boolean-semantics-enum-set-bit-json.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Implicit boolean semantics for ENUM/SET, BIT literals, and JSON conditions
+
+- Status: Review required
+- Tracking issue: [#30931](https://github.com/matrixorigin/matrixone/issues/30931) (consolidated group: #30930, #30932)
+- Implementation PR: [#31492](https://github.com/matrixorigin/matrixone/pull/31492) - implemented from revision 8; after the revision-9 deviation repair lands, the PR description and implementation review must link THIS revision and its hash
+- Design revision: 9
+- Last updated: 2026-10-30
+- Supersedes revision 8 (SHA256 15d933cf6ac0608423409fa31173d969cc8de16a01be3ee969e0c8678ad6d73a, the independently PASSed predecessor, returned with round-9 finding P2 - the minted per-feature MORPC slot and its version-gate wiring violate the repository's shutdown-only upgrade contract, `.agents/skills/mo-dev/references/upgrade-compatibility.md:13-40`), which superseded revision 7 (SHA256 ea470bd602e6209e383d96db1c1480f5e807a95b147230e48c9b96ac4ed3bb31, returned with finding F8 - exempt SET storage semantics from the boolean-condition contracts), which superseded revision 6 (SHA256 1cec7f6e700f2f3863aea39214475fce3bd3d73e33ef5d2e07608e85105ed1c1, returned with finding R2 - close the expired-but-serving old-CN path before authoring opens), revision 5 (bd774cfa..., finding R1 startup vs already-serving closure), revision 4 (921a53533489bc123ecc296455e72a3d92d926fdf263beb7870d199eb98501bb, finding P2 durable-floor ownership), revision 3 (4bd0cb7d..., findings H1-H2), revision 2 (791b1dfa..., findings G1-G4), and revision 1 (f0a689b7..., findings F1-F5). Revision 7 verified the R2 finding against the code - all anchors confirmed, none refuted - and distinguished heartbeat expiry (control-plane tick arithmetic carrying no shutdown evidence) from verified process shutdown/session drain, removed the unsupported automatic-exclusion-of-the-expired-CN claim, and stated the load-bearing rollout prerequisite of that revision's fence: verified retirement of every below-floor CN process before authoring new-operand definitions (retired together with the fence by the round-9 correction); every other revision-7 decision retains its approval in this revision. Revision 8 applies the F8 correction: SET storage conditions no longer classify as boolean-condition contracts because their executors (numeric iffCheck admission, the uint64 truth kernel, the numeric-to-BOOL cast) are unchanged in every receiver and session mode, so SET persisted/generated expressions keep base-native access with byte-identical answers; D8 item 6 documents the cross-mode consumption gate's exact scope, and Section 9 adds the SET persisted no-contract battery. Revision 9 applies the round-9 P2 correction: D8 is rescoped from a cross-version capability fence to a same-binary, same-version cross-mode contract - the minted protocol slot, every version-gate wire, and every gate-behavior test are removed (Section 3 deviation list, Section 7) - while every other revision-2..8 decision (the invariant, matrices, truth kernels, grouping activation and zones, the two-carrier mode propagation, the F8 SET scope, and the cross-mode consumption gate itself) is retained unchanged. The preserved pre-revision-9 implementation in PR #31492 predates this revision and is adapted only at the listed deviation points after this revision passes.
+
+## 0. Revision history and finding disposition
+
+Round-1 findings F1-F5 (resolved in revision 2): F1 grouping-extension activation (code + probe); F2 coercion/mode matrix (code + probe); F3 remote mixed-version (code); F4 duplicated overflow-folding numeric parser (code + probe); F5 cross-boundary silent truth loss against a falsified lossless claim (probe). All confirmed; decisions D6-D10 resulted.
+
+Round-2 findings G1-G4 (resolved in revision 3): G1 D10 zone overlap against the repository's own complete-domain reversibility rule (mysqlSpecialNumericTypeReversible, mysql_special_types.go:915-929, plus the saved probe-2 two-ordinal table); G2 D9 reuse target's extension dispatch (func_cast.go:7639-7642/8055-8086) contradicting the pinned "0x10" -> false oracle; G3 native-mode parity missing a gate on group-key construction (group_binder.go:220-241 has no mode guard); G4 D8 validation structural-only while encodeRemoteScopeWithProtocol plus the json_string_consumers/quantile protocol-test batteries provide the behavioral shape. All confirmed; decisions D9/D10 revised, D11 added, D8 validation re-planned.
+
+### Round-3 review findings (H1-H2, resolved in revision 4)
+
+| Finding | Disposition (revision 4) |
+| --- | --- |
+| H1 D8 covered remote pipelines but not persisted expressions: a generated `CASE WHEN j` can reach an older CN through catalog metadata and execute locally, bypassing stream confirmation and the old BOOL-vector assumption; the existing durable authoring/read owners were not covered | Confirmed by code: generated-column authoring persists the bound expression through the catalog 
```

**File**: `pkg/pb/plan/string_literal_form.go` (modified, +78/-1)
```diff
@@ -299,6 +299,7 @@ const (
 	planBooleanTypeID                int32 = 10
 	planJSONTypeID                   int32 = 62
 	planInt32TypeID                  int32 = 22
+	planEnumTypeID                   int32 = 66
 	// These stable function IDs are mirrored from pkg/sql/plan/function to
 	// avoid a dependency cycle. The generic CAST operator is not an assignment
 	// bounds check; these three internal assignment casts are.
@@ -458,6 +459,17 @@ type RemoteExpressionFeatures struct {
 	// LeastGreatestCollationSemantics requires v117 for appended overload 4.
 	// Released overload 0 retains its historical byte-order contract.
 	LeastGreatestCollationSemantics bool
+	// JSONBooleanConditionContracts marks expressions whose evaluation depends
+	// on the MySQL conditional-boolean contracts fixed by this change: IF/CASE
+	// condition slots that admit T_json in-domain (values evaluated with MySQL
+	// conditional numeric coercion) and the ENUM storage-truth admission that
+	// casts the stored ordinal to BOOL. Under the repository's shutdown-only
+	// upgrade contract every in-cluster peer runs the same binary, so the
+	// flag requires no protocol version; its consumer is the persisted
+	// expression cross-mode consumption gate (pkg/sql/plan/persisted_ip.go),
+	// which keeps a MatrixOne-native session from re-binding a catalog
+	// definition authored under the MySQL contracts.
+	JSONBooleanConditionContracts bool
 }
 
 func (features RemoteExpressionFeatures) Any() bool {
@@ -496,7 +508,8 @@ func (features RemoteExpressionFeatures) Any() bool {
 		features.DecimalStatisticalResultContracts ||
 		features.TableCollationFunction ||
 		features.InvalidDecimalStatisticalResultContract || features.ScalarDivision ||
-		features.LeastGreatestCollationSemantics
+		features.LeastGreatestCollationSemantics ||
+		features.JSONBooleanConditionContracts
 }
 
 func isPlanMediumIntType(typ Type) bool {
@@ -934,6 +947,66 @@ func isExpressionResultMetadataContract(expr *Expr) bool {
 	}
 }
 
+// isMySQLBooleanConditionContractNode reports whether one expression node uses
+// a boolean-condition semantic that depends on the MySQL conditional-boolean
+// contracts fixed by this change: a T_json condition slot of IF/CASE that
+// evaluates in-domain with MySQL conditional numeric coercion (native-mode
+// statements keep the pre-change admission), or the ENUM storage-truth
+// admission that casts the stored ordinal to BOOL. The walk flag feeds only
+// the same-version cross-mode consumption gate in pkg/sql/plan/persisted_ip.go:
+// under the repository's shutdown-only upgrade contract every in-cluster
+// worker and rebinder runs the same binary, so the expression carries no
+// protocol requirement: no per-feature MORPC version and no
+// version gate. SET storage conditions are exempt (design revision
+// 8, finding F8): the persisted binder binds their raw uint64
+// storage type and
+// MySQL-mode query plans recover the same numeric operand, so the
+// pre-existing numeric admission, uint64 truth and numeric-to-BOOL cast
+// kernels evaluate them identically in any receiver and session mode -
+// classifying them would refuse an unchanged execution and lock native
+// sessions out of SET catalog definitions base already serves.
+func isMySQLBooleanConditionContractNode(expr *Expr, fn *Function, id int32) bool {
+	if fn == nil {
+		return false
+	}
+	switch id {
+	case 21: // generic CAST
+		if expr == nil || expr.Typ.Id != planBooleanTypeID {
+			return false
+		}
+		if len(fn.Args) == 0 || fn.Args[0] == nil {
+			return false
+		}
+		src := fn.Args[0].Typ
+		return src.Id == planEnumTypeID
+	case iffFunctionID:
+		if len(fn.Args) == 0 || fn.Args[0] == nil {
+			return false
+		}
+		// iffCheck admits the ENUM condition in-domain exactly the way
+		// caseCheck's condition slots stay typed, so the IFF condition needs
+		// the same consumption-gate mark the CASE contract does: an ENUM
+		// condition evaluates through the new storage-truth kernel on a
+		// MySQL-mode statement, while a native-mode session keeps the old
+		// admission. A SET condition keeps its raw numeric uint64 type here
+		// and everywhere else, so the unchanged kernel row never needs the
+		// mark.
+		cond := fn.Args[0].Typ
+		return cond.Id == planJSONTypeID || cond.Id == planEnumTypeID
+	case caseFunctionID:
+		for i := 0; i+1 < len(fn.Args); i += 2 {
+			arg := fn.Args[i]
+			if arg == nil {
+				continue
+			}
+			if arg.Typ.Id == planJSONTypeID || arg.Typ.Id == planEnumTypeID {
+				return true
+			}
+		}
+	}
+	return false
+}
+
 // RequiredRemoteExpressionFeatures reports the independent versioned
 // expression features present in owner. Keep the features separate so callers
 // can retain precise diagnostics, while sharing one owner walk so adding one
@@ -1018,6 +1091,10 @@ func RequiredRemoteExpressionFeatures(owner any) (features RemoteExpressionFeatu
 					fn.Args[0] != nil && fn.Args[0].Typ.Id == 55 { // CAST YEAR -> BIT
 					features.
```

**File**: `pkg/sql/colexec/evalExpression.go` (modified, +41/-8)
```diff
@@ -1593,6 +1593,7 @@ func (expr *FunctionExpressionExecutor) iffNullResult(index, length int) (*vecto
 func (expr *FunctionExpressionExecutor) EvalCase(proc *process.Process, batches []*batch.Batch, selectList []bool) (err error) {
 	expr.resetFlowControlPrepareParamKind()
 	rowCount := expressionRowCount(batches)
+	mode := function.CompatibilityModeFromProcess(proc)
 	if len(expr.selectList1) < rowCount {
 		expr.selectList1 = make([]bool, rowCount)
 		expr.selectList2 = make([]bool, rowCount)
@@ -1612,15 +1613,47 @@ func (expr *FunctionExpressionExecutor) EvalCase(proc *process.Process, batches
 			return err
 		}
 		if i != len(expr.parameterExecutor)-1 {
-			bs := vector.GenerateFunctionFixedTypeParameter[bool](expr.parameterResults[i])
+			if expr.parameterResults[i].GetType().Oid == types.T_json {
+				if mode != function.SQLCompatibilityMySQL {
+					// A native-mode statement never binds a JSON condition, so
+					// reaching one here means a persisted expression authored
+					// with the conditional contracts is being consumed
+					// cross-mode. Fail closed with the typed error instead of
+					// letting the BOOL parameter decoding assert on a T_json
+					// vector and never decode JSON as BOOL.
+					return moerr.NewNotSupported(proc.Ctx,
+						"JSON CASE condition requires the MySQL conditional boolean contracts; a MatrixOne native-mode session cannot evaluate it")
+				}
+				// A JSON condition keeps its own domain through the searched CASE
+				// and evaluates per row with MySQL conditional numeric coercion,
+				// the same kernel IF uses. Only an explicit CAST takes the strict
+				// JSON-to-BOOL path, which the BOOL parameter wrapper below would
+				// also wrongly demand here. A native-mode statement never binds a
+				// JSON condition (legacy admission), so it keeps the base
+				// behavior below byte-identically.
+				for j := 0; j < rowCount; j++ {
+					truth, evalErr := function.IffConditionTruthyAt(expr.parameterResults[i], uint64(j), mode)
+					if evalErr != nil {
+						return evalErr
+					}
+					if remaining[j] && truth {
+						remaining[j] = false
+						selectedBranch[j] = true
+					} else {
+						selectedBranch[j] = false
+					}
+				}
+			} else {
+				bs := vector.GenerateFunctionFixedTypeParameter[bool](expr.parameterResults[i])
 
-			for j := 0; j < rowCount; j++ {
-				b, null := bs.GetValue(uint64(j))
-				if remaining[j] && !null && b {
-					remaining[j] = false
-					selectedBranch[j] = true
-				} else {
-					selectedBranch[j] = false
+				for j := 0; j < rowCount; j++ {
+					b, null := bs.GetValue(uint64(j))
+					if remaining[j] && !null && b {
+						remaining[j] = false
+						selectedBranch[j] = true
+					} else {
+						selectedBranch[j] = false
+					}
 				}
 			}
 			expr.parameterResults[i+1], err = expr.parameterExecutor[i+1].Eval(proc, batches, selectedBranch)
```

**File**: `pkg/sql/colexec/evaluate_case_json_bool_test.go` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
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
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/stretchr/testify/require"
+)
+
+// captureSelectExecutor returns a fixed vector from every evaluation and
+// records the row mask each call received, so a test can assert which rows a
+// flow-control evaluator routed to which arm.
+type captureSelectExecutor struct {
+	result *vector.Vector
+	seen   [][]bool
+}
+
+func (c *captureSelectExecutor) Eval(_ *process.Process, _ []*batch.Batch, selectList []bool) (*vector.Vector, error) {
+	c.seen = append(c.seen, append([]bool(nil), selectList...))
+	return c.result, nil
+}
+
+func (c *captureSelectExecutor) EvalWithoutResultReusing(_ *process.Process, _ []*batch.Batch, selectList []bool) (*vector.Vector, error) {
+	c.seen = append(c.seen, append([]bool(nil), selectList...))
+	return c.result, nil
+}
+
+func (c *captureSelectExecutor) ResetForNextQuery() {}
+
+func (c *captureSelectExecutor) Free() {}
+
+func (c *captureSelectExecutor) IsColumnExpr() bool { return false }
+
+func (c *captureSelectExecutor) TypeName() string { return "capture" }
+
+// TestEvalCaseJsonConditionInDomain pins the flow-control CASE evaluator on a
+// JSON condition: the condition stays in its own domain (the BOOL parameter
+// wrapper must not touch the JSON vector, which used to panic with a
+// JSON-to-[]bool type assertion) and each arm is evaluated for exactly the
+// rows whose MySQL conditional numeric truth selects it.
+func TestEvalCaseJsonConditionInDomain(t *testing.T) {
+	proc := testutil.NewProcess(t)
+
+	encodeJSON := func(text string) []byte {
+		bj, err := types.ParseStringToByteJson(text)
+		require.NoError(t, err)
+		packed, err := bj.Marshal()
+		require.NoError(t, err)
+		return packed
+	}
+
+	conditions := []struct {
+		name string
+		data []byte
+		null bool
+	}{
+		{name: `"2tail" numeric prefix is true`, data: encodeJSON(`"2tail"`)},
+		{name: `"abc" is false`, data: encodeJSON(`"abc"`)},
+		{name: `" 12" is true`, data: encodeJSON(`" 12"`)},
+		{name: `string "true" is false`, data: encodeJSON(`"true"`)},
+		{name: "sql null selects else", data: encodeJSON(`"1"`), null: true},
+	}
+
+	condVec := vector.NewVec(types.T_json.ToType())
+	defer condVec.Free(proc.Mp())
+	thenVec := vector.NewVec(types.T_int64.ToType())
+	defer thenVec.Free(proc.Mp())
+	elseVec := vector.NewVec(types.T_int64.ToType())
+	defer elseVec.Free(proc.Mp())
+	for i, cond := range conditions {
+		require.NoError(t, vector.AppendBytes(condVec, cond.data, cond.null, proc.Mp()))
+		require.NoError(t, vector.AppendFixed(thenVec, int64(10+i), false, proc.Mp()))
+		require.NoError(t, vector.AppendFixed(elseVec, int64(-1), false, proc.Mp()))
+	}
+
+	condExec := &captureSelectExecutor{result: condVec}
+	thenExec := &captureSelectExecutor{result: thenVec}
+	elseExec := &captureSelectExecutor{result: elseVec}
+	expr := &FunctionExpressionExecutor{
+		parameterResults:  make([]*vector.Vector, 3),
+		parameterExecutor: []ExpressionExecutor{condExec, thenExec, elseExec},
+	}
+	expr.fid = function.CASE
+	expr.resultType = types.T_int64.ToType()
+
+	input := batch.NewWithSize(1)
+	t.Cleanup(func() { input.Clean(proc.Mp()) })
+	input.Vecs[0] = condVec
+	input.SetRowCount(len(conditions))
+
+	require.NotPanics(t, func() {
+		require.NoError(t, expr.EvalCase(proc, []*batch.Batch{input}, nil))
+	})
+
+	require.Len(t, condExec.seen, 1)
+	for row := range conditions {
+		require.True(t, condExec.seen[0][row], "every row must reach the condition")
+	}
+	require.Len(t, thenExec.seen, 1, "the THEN arm must be evaluated exactly once")
+	require.Equal(t, []bool{true, false, true, false, false}, thenExec.seen[0],
+		"THEN must cover exactly the conditionally-true JSON rows")
+	require.Len(t, elseExec.seen, 1, "the ELSE arm must be evaluated exactly once")
+	require.Equal(t, []bool{false, true, false, true, true}, elseExec.seen[0],
+		"ELSE must cover the false and SQL-NULL JSON rows")
+}
+
+// TestEvalCaseJsonConditionNeverDecodesJsonAsBoolInNativeMode pins the review
+// repair (finding 5): a JSON condition vector only ev
```

**File**: `pkg/sql/colexec/group/group_test.go` (modified, +81/-0)
```diff
@@ -5815,3 +5815,84 @@ func TestJSONMinMaxFinalGroupPhysicalSpillReload(t *testing.T) {
 	require.Len(t, seen, 64)
 	require.Positive(t, g.OpAnalyzer.GetOpStats().SpillRows, "final group must physically spill")
 }
+
+// TestGroupJointGroupingFlagsPreserveStorageTruthOnActiveArms pins the D6
+// joint activation contract at the operator seam (review repair, finding 1):
+// the rollup replacement nulls every flag-false group-by vector, so an arm
+// whose visible display key is active but whose hidden storage sibling is
+// flag-false loses the storage truth on EVERY active group. The planner side
+// must therefore activate both slots together; this test records the operator
+// consequence of each flag shape: joint activation keeps both key vectors
+// real, an inactive arm nulls both, and a display-only activation nulls the
+// storage sibling (the pre-fix symptom the planner repair removes).
+func TestGroupJointGroupingFlagsPreserveStorageTruthOnActiveArms(t *testing.T) {
+	for _, tc := range []struct {
+		name            string
+		flags           []bool
+		wantRows        int
+		wantStorageKept bool
+	}{
+		{name: "joint active display and storage keep truth", flags: []bool{true, true}, wantRows: 3, wantStorageKept: true},
+		{name: "inactive arm nulls both key vectors", flags: []bool{false, false}, wantRows: 1, wantStorageKept: false},
+		{name: "display-only activation nulls the storage sibling", flags: []bool{true, false}, wantRows: 2, wantStorageKept: false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			proc := testutil.NewProcess(t)
+			input := batch.NewWithSize(3)
+			input.Vecs[0] = testutil.MakeVarcharVector([]string{"a", "a", "b"}, nil, proc.Mp())
+			input.Vecs[1] = testutil.MakeInt32Vector([]int32{1, 2, 2}, nil, proc.Mp())
+			input.Vecs[2] = testutil.MakeInt32Vector([]int32{1, 1, 1}, nil, proc.Mp())
+			input.SetRowCount(3)
+
+			child := colexec.NewMockOperator().WithBatchs([]*batch.Batch{input})
+			partial := newGroupOp(proc, []*plan.Expr{
+				colExpr(0, types.T_varchar), colExpr(1, types.T_int32),
+			}, []aggexec.AggFuncExecExpression{sumAgg(2)})
+			partial.NeedEval = false
+			partial.GroupingFlag = tc.flags
+			partial.AppendChild(child)
+			require.NoError(t, partial.Prepare(proc))
+			partialOutputs := collectBatches(t, partial, proc)
+			partials := make([]*batch.Batch, len(partialOutputs))
+			for i := range partialOutputs {
+				partials[i] = cloneBatch(t, proc, partialOutputs[i])
+			}
+
+			partial.Free(proc, false, nil)
+			child.Free(proc, false, nil)
+
+			mergeChild := colexec.NewMockOperator().WithBatchs(partials)
+			merge := newMergeGroupOp([]aggexec.AggFuncExecExpression{sumAgg(2)})
+			merge.GroupingAware = true
+			merge.AppendChild(mergeChild)
+			require.NoError(t, merge.Prepare(proc))
+			outputs := collectBatches(t, merge, proc)
+
+			rows := 0
+			storageNulls := 0
+			for _, output := range outputs {
+				rows += output.RowCount()
+				wrapper := vector.GenerateFunctionFixedTypeParameter[int32](output.Vecs[1])
+				for row := uint64(0); row < uint64(output.RowCount()); row++ {
+					_, isNull := wrapper.GetValue(row)
+					if isNull {
+						storageNulls++
+					}
+				}
+			}
+			require.Equal(t, tc.wantRows, rows)
+			if tc.wantStorageKept {
+				require.Zero(t, storageNulls,
+					"an activated arm keeps the storage sibling's truth on every group")
+			} else {
+				require.Equal(t, rows, storageNulls,
+					"every flag-false storage slot is a rollup NULL on every arm")
+			}
+
+			merge.Free(proc, false, nil)
+			mergeChild.Free(proc, false, nil)
+			proc.Free()
+			require.Zero(t, proc.Mp().CurrNB())
+		})
+	}
+}
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +89/-1)
```diff
@@ -106,6 +106,31 @@ func (b *baseBinder) baseBindExpr(astExpr tree.Expr, depth int32, isRoot bool) (
 				return
 			}
 
+			// NOT evaluates its operand with MySQL numeric truth, so the
+			// stored ENUM ordinal or SET bitmap must survive both the display
+			// wrapper and the display-typed reference a GROUP BY flattening
+			// leaves behind. Unrelated operands pass through unchanged.
+			expr, err = b.mysqlSpecialBooleanTruthyOperand(b.GetContext(), expr)
+			if err != nil {
+				return
+			}
+			// NOT binds through the expression-plan entry, whose checker only
+			// consults the general implicit-cast table - base keeps no
+			// ENUM -> BOOL row there, and the contract must not add one
+			// (it would leak admission into native mode). Normalize the
+			// recovered ENUM operand through the explicit storage-truth BOOL
+			// cast, the same wrap the boolean-truth recovery loop applies for
+			// AND/OR/XOR; a native-mode statement skips this and keeps the
+			// base checker failure byte-identically.
+			if function.MySQLConditionalBooleanContracts(b.GetContext()) &&
+				isEnumPlanType(&expr.Typ) {
+				expr, err = makePlan2CastExpr(b.GetContext(), expr,
+					plan.Type{Id: int32(types.T_bool)})
+				if err != nil {
+					return
+				}
+			}
+
 			expr, err = BindFuncExprImplByPlanExpr(b.GetContext(), "not", []*plan.Expr{expr})
 		}
 
@@ -250,6 +275,22 @@ func (b *baseBinder) baseBindExpr(astExpr tree.Expr, depth int32, isRoot bool) (
 		// must start from the stored ordinal/bitmap instead of that string.
 		if makeTypeByPlan2Type(typ).IsNumeric() {
 			expr, _ = storedMySQLSpecialTypeExpr(expr)
+		} else if types.T(typ.Id) == types.T_bool {
+			// The explicit CAST ... AS BOOL shares the boolean-truth storage
+			// contract: a projected display label (GROUP BY / DISTINCT /
+			// derived boundary) resolves through the same provenance-aware
+			// recovery as IF/CASE and the logical consumers, so the pending
+			// cast converts the recovered stored ordinal/bitmap instead of
+			// re-parsing the label text. The recovery carries its own D11 gate
+			// and D10 zone semantics: a native-mode statement keeps the
+			// pre-contract display bind untouched, and an ambiguous
+			// declaration fails closed across a display-decoding boundary.
+			recovered, recoveryErr := b.mysqlSpecialBooleanTruthyOperand(b.GetContext(), expr)
+			if recoveryErr != nil {
+				err = recoveryErr
+				return
+			}
+			expr = recovered
 		}
 		if b.builder != nil {
 			var rewritten bool
@@ -11965,7 +12006,18 @@ func (b *baseBinder) bindInetNtoaBinaryLiteral(astExpr *tree.NumVal, typ Type) (
 	return expr, nil
 }
 
-func (b *baseBinder) GetContext() context.Context { return b.sysCtx }
+// GetContext returns the binder's owning context with the D11 statement
+// compatibility scalar attached, so the condition admission sites (IF/CASE
+// typing, the boolean-context rewrites) see the same one-scalar decision the
+// BindContext resolved. A resolved scalar overrides anything inherited on
+// sysCtx; contexts without the scalar (tests, DUMP origin validation) keep
+// the MySQL-compatible default, matching the resolver's default.
+func (b *baseBinder) GetContext() context.Context {
+	if b.ctx != nil && b.ctx.mysqlConditionalBooleanContractsValid {
+		return function.WithMySQLConditionalBooleanContracts(b.sysCtx, b.ctx.mysqlConditionalBooleanContracts)
+	}
+	return b.sysCtx
+}
 
 // GetProcess exposes the compile session's process to the window-function
 // binder surface so constant-expression folding uses the same deterministic
@@ -12242,6 +12294,42 @@ func rewriteMySQLSpecialTypeDisplayCast(ctx context.Context, expr *Expr, toType
 			return bitmap, false, nil
 		}
 	}
+	if types.T(toType.Id) == types.T_bool && function.MySQLConditionalBooleanContracts(ctx) {
+		// D11 gate: this whole BOOL-target block binds with the MySQL
+		// storage-truth contracts; a native-mode statement falls through to the
+		// pre-contract behavior below, so explicit CAST ... AS BOOL keeps the
+		// base bind/execute outcome byte-identically.
+		// MySQL BIT (b'..') and HEX (x'..' / 0x..) literals are numeric bit
+		// strings: a boolean context evaluates their payload numerically instead
+		// of re-parsing the raw bytes as text. Fold the constant so logical
+		// operators, CASE WHEN and predicates match the numeric semantics
+		// arithmetic already gives these literals. Binary introducer strings are
+		// excluded on purpose; they keep ordinary string truthiness.
+		if isBinaryNumericLiteral(expr) {
+			if literal := expr.GetLit(); literal != nil && !literal.Isnull {
+				nonzero := false
+				for _, b := range []byte(literal.GetSval()) {
+					if b != 0 {
+						nonzero = true
+						break
+					}
+				}
+				// The folded BOOL constant is already the boolean value; the
+				// pending cast must not wrap it again.
+				return makePlan2BoolConstExprWithType(nonzero), true, nil
+			}
+		}
+		// Boolean contracts (WHERE/HAVING/ON predicates, AND/O
```

**File**: `pkg/sql/plan/bind_context.go` (modified, +9/-0)
```diff
@@ -68,11 +68,20 @@ func NewBindContext(builder *QueryBuilder, parent *BindContext) *BindContext {
 			requiredProtocol := int64(0)
 			bc.persistedExpressionProtocolRequirement = &requiredProtocol
 		}
+		if parent == nil {
+			// D11 carrier one: resolve the statement compatibility scalar once
+			// at (root) BindContext entry from the session flag the executors
+			// read. Children inherit it below.
+			bc.mysqlConditionalBooleanContracts = function.MySQLConditionalBooleanContractsFromProcess(builder.compCtx.GetProcess())
+			bc.mysqlConditionalBooleanContractsValid = true
+		}
 	}
 
 	if parent != nil {
 		bc.persistedExpressionProtocolRequirement = parent.persistedExpressionProtocolRequirement
 		bc.ctasExecutionProtocolRequirement = parent.ctasExecutionProtocolRequirement
+		bc.mysqlConditionalBooleanContracts = parent.mysqlConditionalBooleanContracts
+		bc.mysqlConditionalBooleanContractsValid = parent.mysqlConditionalBooleanContractsValid
 		bc.existentialBlock = parent.existentialBlock
 		bc.subqueryNestingDepth = parent.subqueryNestingDepth
 		bc.lower = parent.lower
```

**File**: `pkg/sql/plan/bind_insert.go` (modified, +16/-0)
```diff
@@ -2967,6 +2967,13 @@ func (builder *QueryBuilder) appendDedupAndMultiUpdateNodesForBindInsert(
 			if err != nil {
 				return 0, err
 			}
+			// Same cross-mode consumption boundary as the plain insert path:
+			// a native-mode ODKU statement must fail closed on a persisted
+			// definition that needs the conditional boolean contracts.
+			if err := RequireMySQLConditionalBooleanConsumption(
+				builder.GetContext(), builder.compCtx.GetProcess(), genExpr); err != nil {
+				return 0, err
+			}
 			replaceColRefTag(genExpr, 0, scanTag)
 			updateExprs[col.Name] = genExpr
 			updateColIdxList = append(updateColIdxList, int32(i))
@@ -5584,6 +5591,15 @@ func (builder *QueryBuilder) appendNodesForInsertStmt(
 		if err != nil {
 			return 0, nil, nil, -1, err
 		}
+		// The copied catalog expression is rebound against THIS statement: a
+		// definition that needs the conditional boolean contracts evaluates
+		// with those kernels only on a MySQL-mode session, and a native-mode
+		// DML statement must fail closed at plan time instead of pushing a
+		// persisted JSON condition into the pre-contract BOOL decoding.
+		if err := RequireMySQLConditionalBooleanConsumption(
+			builder.GetContext(), builder.compCtx.GetProcess(), genExpr); err != nil {
+			return 0, nil, nil, -1, err
+		}
 		proj1Pos := genColIdxToProj1Pos[i]
 		columnExprs[int32(i)] = genExpr
 		colIdxToProjPos[int32(i)] = int32(proj1Pos)
```

---

### Incident Patch 2: `8197e28b` (2026-10-30)
**Commit Message**: fix(sysview): publish declared COLUMNS metadata, numeric SUB_PART and full generated expressions (#31489)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #30936.
Related to #30935.
Related to #30937.

## What this PR does / why we need it:

Fixes the declared-catalog metadata defects of #30936/#30935/#30937 and
delivers the corrected
identities through the repository's supported model: **unconditional
publication plus one
idempotent stored-view refresh hop**. No feature-specific protocol gate
and no mixed-version
fallback exists in this PR: after the first implementation review every
such mechanism was
removed (`MORPCLatestVersion` stays 134, no read substitution, no
admission survey, no per-tenant
floor), while the stored-view migration the reviewers called "necessary"
is retained.

### Design record (design-first review chain)

The change is triggered (persisted-view migration, upgrade recovery,
cross-subsystem changes), so
the repository's design gate applies:
`docs/design/20261026-declared-catalog-metadata-publication-and-repair.md`

**File**: `pkg/bootstrap/columns_upgrade_test.go` (modified, +191/-1)
```diff
@@ -4,7 +4,7 @@
 // you may not use this file except in compliance with the License.
 // You may obtain a copy of the License at
 //
-//     http://www.apache.org/licenses/LICENSE-2.0
+//      http://www.apache.org/licenses/LICENSE-2.0
 //
 // Unless required by applicable law or agreed to in writing, software
 // distributed under the License is distributed on an "AS IS" BASIS,
@@ -16,17 +16,22 @@ package bootstrap
 
 import (
 	"errors"
+	"fmt"
 	"strings"
 	"testing"
 
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_18"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/defines"
 	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
 	pbtxn "github.com/matrixorigin/matrixone/pkg/pb/txn"
+	"github.com/matrixorigin/matrixone/pkg/txn/clock"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
 	"github.com/matrixorigin/matrixone/pkg/util/sysview"
 	"github.com/stretchr/testify/require"
@@ -110,3 +115,188 @@ func TestColumnsUpgradeAdmissionAndIdempotence(t *testing.T) {
 		})
 	}
 }
+
+// TestColumnsUpgradeReachesExistingTenants drives the retained 4.0.19 tenant
+// hop (design 5.2, routes per D14-2; renumbered by revision 10 onto the
+// consolidated ladder): a 4.0.7 account holding any pre-correction
+// information_schema identity is rewritten to exactly the published
+// identities through the per-account walk, which steps the upstream 4.0.18
+// handle and the final vehicle; a current account is a no-op, a mid-hop DDL
+// failure leaves the account marker untouched and retries cleanly.
+func TestColumnsUpgradeReachesExistingTenants(t *testing.T) {
+	runtime.RunTest("", func(runtime.Runtime) {
+		frozen := v4_0_7.Handler.Metadata()
+		current := versions.Version{Version: frozen.Version, VersionOffset: frozen.VersionOffset, State: versions.StateReady}
+		columnsDefinition := sysview.InformationSchemaColumnsBinaryFamilyNullDDL()
+		statisticsDefinition := sysview.InformationSchemaStatisticsDDL
+		tenantVersion := "4.0.7"
+		var queuedVersion, queuedRoute bool
+		var writes []string
+		failStatistics := false
+		injected := errors.New("injected STATISTICS create failure")
+		op := mock_frontend.NewMockTxnOperator(gomock.NewController(t))
+		op.EXPECT().TxnOptions().Return(pbtxn.TxnOptions{}).AnyTimes()
+		op.EXPECT().Txn().Return(pbtxn.TxnMeta{}).AnyTimes()
+		exec := executor.NewMemExecutor2(func(sql string) (executor.Result, error) {
+			switch {
+			case strings.HasPrefix(sql, "SELECT reldatabase, relname, account_id FROM mo_catalog.mo_tables"):
+				return newBootstrapStringResult("mo_catalog"), nil
+			case sql == versions.LatestVersionSQL:
+				return recoveryVersionResult(t, current), nil
+			case strings.HasPrefix(sql, "select version from mo_version"):
+				// The latest ready version that the route chains from.
+				return newBootstrapStringResult(frozen.Version), nil
+			case strings.HasPrefix(sql, "select state from mo_version"):
+				// The queued forward version has no row yet; the checker
+				// proceeds to enqueue it with its route.
+				return executor.Result{}, nil
+			case strings.HasPrefix(sql, "insert into mo_version"):
+				// The registered forward version carries the two shared entries.
+				require.Contains(t, sql, "'4.0.19', 2, 0")
+				queuedVersion = true
+			case strings.HasPrefix(sql, "insert into mo_upgrade"):
+				require.Contains(t, sql, "'4.0.7'")
+				require.Contains(t, sql, "'4.0.19'")
+				queuedRoute = true
+			case strings.HasPrefix(sql, "select create_version from mo_account"):
+				return newBootstrapStringResult(tenantVersion), nil
+			case strings.Contains(sql, "relname = 'COLUMNS'"), strings.Contains(sql, "relname = 'columns'"):
+				return newBootstrapStringResult(columnsDefinition), nil
+			case strings.Contains(sql, "relname = 'STATISTICS'"), strings.Contains(sql, "relname = 'statistics'"):
+				return newBootstrapStringResult(statisticsDefinition), nil
+			case strings.HasPrefix(sql, "select rel_id, rel_logical_id, relkind from mo_catalog.mo_tables"):
+				return executor.Result{}, nil
+			case sql == "SELECT mo_ctl('cn', 'GetProtocolVersion', '')":
+				return newBootstrapStringResult(`{"result":"cn:118"}`), nil
+			case sql == strings.Replace(sysview.InformationSchemaColumnsDDL, "CREATE VIEW ", "CREATE OR REPLACE VIEW ", 1):
+				writes = append(writes, sql)
+				columnsDefinition = sysview.InformationSchemaColumnsDDL
+			case sql == strings.Replace(sysview.InformationSchemaStatisticsPrefixSubPartDDL, "CREATE VIEW ", "CREATE OR REPLACE VIEW ", 1):
+				writes = append(writes, sql)
+				if failStatistics {
+					return executor.Result{}, injected
+				
```

**File**: `pkg/bootstrap/custom_upgrade.go` (modified, +8/-0)
```diff
@@ -201,6 +201,14 @@ func (s *service) UpgradeOneTenant(ctx context.Context, tenantID int32) error {
 						from = v.Metadata().Version
 					}
 				}
+				// A manual upgrade reports success only with the account at the
+				// cluster's final version. The re-planned loop below still takes
+				// over after a committed paged 4.0.7 stage, so only a non-pending
+				// shortfall is terminal here instead of being cached as success.
+				if !pendingV407 && from != currentCN.Version {
+					return moerr.NewInvalidInputNoCtxf("cannot upgrade tenant version %s to current cn version %s",
+						from, currentCN.Version)
+				}
 				return nil
 			},
 			opts)
```

**File**: `pkg/bootstrap/service_statistics_upgrade_test.go` (modified, +7/-5)
```diff
@@ -22,6 +22,7 @@ import (
 
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_18"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_6"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
@@ -50,9 +51,10 @@ func TestPublishedCatalogUpgradeRoutes(t *testing.T) {
 		offset        uint32
 		hops          [][2]string
 	}{
-		{name: "4.1", version: "4.0.1", offset: 1, hops: [][2]string{{"4.0.1", "4.0.2"}, {"4.0.2", "4.0.3"}, {"4.0.3", "4.0.4"}, {"4.0.4", "4.0.5"}, {"4.0.5", "4.0.6"}, {"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}}},
-		{name: "4.2", version: "4.0.6", offset: 5, hops: [][2]string{{"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}}},
-		{name: "4.0.7", version: "4.0.7", offset: v4_0_7.Handler.Metadata().VersionOffset, hops: [][2]string{{"4.0.7", "4.0.18"}}},
+		{name: "4.1", version: "4.0.1", offset: 1, hops: [][2]string{{"4.0.1", "4.0.2"}, {"4.0.2", "4.0.3"}, {"4.0.3", "4.0.4"}, {"4.0.4", "4.0.5"}, {"4.0.5", "4.0.6"}, {"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}, {"4.0.18", "4.0.19"}}},
+		{name: "4.2", version: "4.0.6", offset: 5, hops: [][2]string{{"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}, {"4.0.18", "4.0.19"}}},
+		{name: "4.0.7_frozen", version: "4.0.7", offset: v4_0_7.Handler.Metadata().VersionOffset, hops: [][2]string{{"4.0.7", "4.0.19"}}},
+		{name: "4.0.18_main_era", version: "4.0.18", offset: v4_0_18.Handler.Metadata().VersionOffset, hops: [][2]string{{"4.0.18", "4.0.19"}}},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			runtime.RunTest("", func(runtime.Runtime) {
@@ -72,12 +74,12 @@ func TestPublishedCatalogUpgradeRoutes(t *testing.T) {
 				}, &testTxnOperator{})
 				s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
 				t.Cleanup(s.stopper.Stop)
-				require.Equal(t, "4.0.18", s.GetFinalVersion())
+				require.Equal(t, "4.0.19", s.GetFinalVersion())
 				require.Equal(t, uint32(5), v4_0_6.Handler.Metadata().VersionOffset)
 				require.NoError(t, s.doCheckUpgrade(t.Context()))
 				require.Len(t, upgrades, len(tc.hops))
 				for i, hop := range tc.hops {
-					require.Contains(t, upgrades[i], fmt.Sprintf("values ('%s', '%s', '4.0.18',", hop[0], hop[1]))
+					require.Contains(t, upgrades[i], fmt.Sprintf("values ('%s', '%s', '4.0.19',", hop[0], hop[1]))
 				}
 			})
 		})
```

**File**: `pkg/bootstrap/service_upgrade.go` (modified, +18/-0)
```diff
@@ -499,6 +499,14 @@ func (s *service) checkUpgradeRecovery(target versions.Version, txn executor.Txn
 			(u.State != versions.StateCreated && u.State != versions.StateUpgradingTenant && u.State != versions.StateReady) {
 			return &terminalUpgradeError{moerr.NewInvalidStateNoCtxf("cannot resume invalid upgrade step %s", u.String())}
 		}
+		// Offset-only legs target only the frozen 4.0.7 stage, whose only
+		// durable per-account progress marker cannot identify two offsets
+		// of the same version. Reject resumption here exactly as the
+		// pre-mutation check rejects creating it.
+		if u.FromVersion == v4_0_7.Handler.Metadata().Version &&
+			u.ToVersion == v4_0_7.Handler.Metadata().Version {
+			return &terminalUpgradeError{moerr.NewInvalidStateNoCtx("unsupported in-progress 4.0.7 offset-only upgrade; 4.0.7 is frozen and further migrations require a new catalog version")}
+		}
 		supported := false
 		for _, h := range s.handles {
 			v := h.Metadata()
@@ -512,6 +520,16 @@ func (s *service) checkUpgradeRecovery(target versions.Version, txn executor.Txn
 			return &terminalUpgradeError{moerr.NewInvalidStateNoCtxf("cannot resume unsupported upgrade step %s", u.String())}
 		}
 	}
+	// A retained route to the frozen 4.0.7 stage needs the same catalog
+	// admission upstream enforces before creating it: a final above 4.0.7
+	// reaches this resume path without any other admission check.
+	// canResumeUpgrade already pinned the route to the registered frozen
+	// handle's offset.
+	if target.Version == v4_0_7.Handler.Metadata().Version {
+		if err := rejectLegacyCDCTasks(txn); err != nil {
+			return err
+		}
+	}
 	return nil
 }
 
```

**File**: `pkg/bootstrap/service_upgrade_cdc_test.go` (modified, +115/-0)
```diff
@@ -22,6 +22,9 @@ import (
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_18"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_19"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_6"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
@@ -112,3 +115,115 @@ func TestLegacyCDCAdmissionBeforeUpgradeMutation(t *testing.T) {
 		})
 	}
 }
+
+// TestLegacyCDCAdmissionEmptyCatalogAdmitsSourceOnward pins that a source
+// below the frozen stage with no legacy CDC tasks admits past the gate and
+// proceeds to create the consolidated route - the successor keeps upstream's
+// admission/passage contract at the 4.0.19 final.
+func TestLegacyCDCAdmissionEmptyCatalogAdmitsSourceOnward(t *testing.T) {
+	runtime.RunTest("", func(runtime.Runtime) {
+		source := v4_0_6.Handler.Metadata()
+		var routes []string
+		exec := executor.NewMemExecutor2(func(sql string) (executor.Result, error) {
+			switch {
+			case strings.HasPrefix(sql, "SELECT reldatabase, relname, account_id FROM mo_catalog.mo_tables"):
+				return newBootstrapStringResult("mo_catalog"), nil
+			case sql == versions.LatestVersionSQL:
+				return recoveryVersionResult(t, versions.Version{Version: source.Version, VersionOffset: source.VersionOffset, State: versions.StateReady}), nil
+			case strings.Contains(sql, "from mo_catalog.mo_cdc_task"):
+				return executor.Result{}, nil
+			case strings.Contains(sql, "select version from mo_version"):
+				return newBootstrapStringResult(source.Version), nil
+			case strings.HasPrefix(sql, "insert into mo_upgrade"):
+				routes = append(routes, sql)
+				return executor.Result{}, nil
+			default:
+				return executor.Result{}, nil
+			}
+		}, &testTxnOperator{})
+		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+		t.Cleanup(s.stopper.Stop)
+		require.NoError(t, s.doCheckUpgrade(t.Context()))
+		require.Len(t, routes, 3, "an admitted 4.0.6 source chains through the frozen stage, the upstream 4.0.18 handle and the final vehicle")
+		require.Contains(t, fmt.Sprint(routes), fmt.Sprintf("'%s', '%s', '4.0.19',", source.Version, v4_0_7.Handler.Metadata().Version))
+		require.Contains(t, fmt.Sprint(routes), fmt.Sprintf("'%s', '%s', '4.0.19',", v4_0_7.Handler.Metadata().Version, v4_0_18.Handler.Metadata().Version))
+		require.Contains(t, fmt.Sprint(routes), fmt.Sprintf("'%s', '%s', '4.0.19',", v4_0_18.Handler.Metadata().Version, v4_0_19.Handler.Metadata().Version))
+	})
+}
+
+// TestLegacyCDCReadErrorStaysRetryableAtAdmission pins the successor's
+// create-admission contract for a transient catalog read: the wrapped error
+// stays retryable, terminates nothing, and no mutation runs.
+func TestLegacyCDCReadErrorStaysRetryableAtAdmission(t *testing.T) {
+	runtime.RunTest("", func(runtime.Runtime) {
+		source := v4_0_6.Handler.Metadata()
+		want := errors.New("catalog read failed")
+		exec := executor.NewMemExecutor2(func(sql string) (executor.Result, error) {
+			switch {
+			case strings.HasPrefix(sql, "SELECT reldatabase, relname, account_id FROM mo_catalog.mo_tables"):
+				return newBootstrapStringResult("mo_catalog"), nil
+			case sql == versions.LatestVersionSQL:
+				return recoveryVersionResult(t, versions.Version{Version: source.Version, VersionOffset: source.VersionOffset, State: versions.StateReady}), nil
+			case strings.Contains(sql, "from mo_catalog.mo_cdc_task"):
+				return executor.Result{}, want
+			default:
+				return executor.Result{}, fmt.Errorf("no mutation may follow a failed read: %s", sql)
+			}
+		}, &testTxnOperator{})
+		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+		t.Cleanup(s.stopper.Stop)
+		err := s.doCheckUpgrade(t.Context())
+		require.ErrorIs(t, err, want)
+		var terminal *terminalUpgradeError
+		require.False(t, errors.As(err, &terminal))
+		require.False(t, s.upgrade.finalVersionCompleted.Load())
+	})
+}
+
+// TestLegacyCDCAdmissionRecoveryEnforcedBeforeResumeVerdict pins the
+// recovery-path admission the successor registration newly reaches: a
+// retained route to the frozen 4.0.7 stage admits only after the legacy CDC
+// catalog is clean, and the paused-task rejection stays terminal before the
+// resume verdict.
+func TestLegacyCDCAdmissionRecoveryEnforcedBeforeResumeVerdict(t *testing.T) {
+	frozen := v4_0_7.Handler.Metadata()
+	target := versions.Version{Version: frozen.Version, VersionOffset: frozen.VersionOffset, State: versions.StateCreated}
+	from := v4_0_6.Handler.Metadata().Version
+	for _, paused := range []bool{true, false} {
+		t.Run(fmt.Sprintf("paused=%v", paused), func(t *testing.T) {
+			runtime.RunTest("", func(runtime.Runtime) {
+				t
```

**File**: `pkg/bootstrap/service_upgrade_crossing_test.go` (modified, +28/-22)
```diff
@@ -34,7 +34,7 @@ import (
 
 // crossingFakeDB is a stateful in-memory catalog for the frozen-4.0.7
 // crossing fixtures. The route of the integrated binary is keyed by the new
-// final row (4.0.18, 1); older retained routes (4.0.6/4.0.7 sources) live
+// final row (4.0.19, 2); older retained routes (4.0.6/4.0.7 sources) live
 // under their own keys. Any read of an intermediate mo_version marker is a
 // hard error: the v36 persistence model proves such a row can never exist,
 // so the production flow must never look for one.
@@ -60,7 +60,7 @@ type crossingFakeDB struct {
 	strict       bool
 }
 
-const crossingFinalDDLKey = "'4.0.18'"
+const crossingFinalDDLKey = "'4.0.19'"
 
 func crossingVersion(metadata versions.Version) versions.Version {
 	return metadata
@@ -107,7 +107,7 @@ func (db *crossingFakeDB) exec(sql string) (executor.Result, error) {
 	case sql == versions.LatestVersionSQL:
 		v := db.latest
 		if db.finalExists {
-			v = versions.Version{Version: "4.0.18", VersionOffset: 1, State: db.finalState}
+			v = versions.Version{Version: "4.0.19", VersionOffset: 2, State: db.finalState}
 		}
 		return recoveryVersionResult(db.t, v), nil
 	case strings.HasPrefix(sql, "select state from mo_version"):
@@ -279,10 +279,12 @@ func newCrossingService(t *testing.T, db *crossingFakeDB) *service {
 func crossingFinalSteps() []versions.VersionUpgrade {
 	v407 := v4_0_7.Handler.Metadata()
 	return []versions.VersionUpgrade{
-		{ID: 10, FromVersion: "4.0.6", ToVersion: "4.0.7", FinalVersion: "4.0.18", FinalVersionOffset: 1,
+		{ID: 10, FromVersion: "4.0.6", ToVersion: "4.0.7", FinalVersion: "4.0.19", FinalVersionOffset: 2,
 			State: versions.StateCreated, UpgradeOrder: 0, UpgradeCluster: v407.UpgradeCluster, UpgradeTenant: v407.UpgradeTenant, TotalTenant: 0, ReadyTenant: 0},
-		{ID: 11, FromVersion: "4.0.7", ToVersion: "4.0.18", FinalVersion: "4.0.18", FinalVersionOffset: 1,
+		{ID: 11, FromVersion: "4.0.7", ToVersion: "4.0.18", FinalVersion: "4.0.19", FinalVersionOffset: 2,
 			State: versions.StateCreated, UpgradeOrder: 1, UpgradeCluster: versions.No, UpgradeTenant: versions.Yes, TotalTenant: 0, ReadyTenant: 0},
+		{ID: 12, FromVersion: "4.0.18", ToVersion: "4.0.19", FinalVersion: "4.0.19", FinalVersionOffset: 2,
+			State: versions.StateCreated, UpgradeOrder: 2, UpgradeCluster: versions.No, UpgradeTenant: versions.Yes, TotalTenant: 0, ReadyTenant: 0},
 	}
 }
 
@@ -347,13 +349,15 @@ func TestCrossingLegacyCDCGateMatrix(t *testing.T) {
 						return
 					}
 					require.NoError(t, err)
-					require.Equal(t, 1, db.cdcReads, "the preflight runs once on an eligible source")
 					switch src.name {
 					case "ready-4.0.5":
-						requireCrossingRouteShape(t, db.finalSteps, [][2]string{{"4.0.5", "4.0.6"}, {"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}})
+						require.Equal(t, 1, db.cdcReads, "the creation preflight runs once on an eligible source")
+						requireCrossingRouteShape(t, db.finalSteps, [][2]string{{"4.0.5", "4.0.6"}, {"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}, {"4.0.18", "4.0.19"}})
 					case "ready-4.0.6":
-						requireCrossingRouteShape(t, db.finalSteps, [][2]string{{"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}})
+						require.Equal(t, 1, db.cdcReads, "the creation preflight runs once on an eligible source")
+						requireCrossingRouteShape(t, db.finalSteps, [][2]string{{"4.0.6", "4.0.7"}, {"4.0.7", "4.0.18"}, {"4.0.18", "4.0.19"}})
 					case "interrupted-4.0.7":
+						require.Equal(t, 2, db.cdcReads, "the crossing preflight and the frozen-4.0.7 resume admission each read the legacy gate once")
 						require.False(t, db.finalExists, "an interrupted 4.0.7 is retained, not re-routed")
 						require.Empty(t, db.mutations(), "recovery validation is read-only")
 					}
@@ -369,26 +373,27 @@ func requireCrossingRouteShape(t *testing.T, steps []versions.VersionUpgrade, wa
 	for i, pair := range want {
 		require.Equal(t, pair[0], steps[i].FromVersion)
 		require.Equal(t, pair[1], steps[i].ToVersion)
-		require.Equal(t, "4.0.18", steps[i].FinalVersion)
-		require.Equal(t, uint32(1), steps[i].FinalVersionOffset)
+		require.Equal(t, "4.0.19", steps[i].FinalVersion)
+		require.Equal(t, uint32(2), steps[i].FinalVersionOffset)
 		require.Equal(t, versions.StateCreated, steps[i].State)
 		require.Equal(t, int32(i), steps[i].UpgradeOrder)
 	}
 }
 
 // (vi) REAL-ROUTE interruption, mid-crossing: the persisted shape the
-// integrated binary writes for a 4.0.6 -> 4.0.18 route (final row
-// 4.0.18/1 Created, steps [4.0.6 -> 4.0.7, 4.0.7 -> 4.0.18] under key
-// (4.0.18, 1), no intermediate mo_version marker) interrupted BEFORE the
-// 4.0.7 step completes. The restart must terminally reject a seeded legacy
-// task before any catalog mutation and must never look for a 4.0.7 marker.
+// integrated binary writes for a 4.0.6 -> 4.0.19 route (final row
+// 4.0.19/2 Created, steps [4.0.6 -> 4.0.7, 4.0.7 -> 4.0.18, 4.0.18 ->
+// 4.0.19] under key (4.0.19, 2), no intermediate mo_version marker)
+// interrupted BEFORE the 4.
```

**File**: `pkg/bootstrap/service_upgrade_recovery_test.go` (modified, +68/-0)
```diff
@@ -25,6 +25,7 @@ import (
 	"time"
 
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_19"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
@@ -557,6 +558,11 @@ func (e *recoveryTestExecutor) exec(sql string) (executor.Result, error) {
 		res.NewBatchWithRowCount(1)
 		require.NoError(e.t, executor.AppendFixedRows(res, 0, []int32{state}))
 		return res.GetResult(), nil
+	case strings.Contains(sql, "from mo_catalog.mo_cdc_task"):
+		// The re-keyed recheck admission probes the CDC catalog before a
+		// non-ready final row is accepted (design D11-1); an empty task
+		// catalog admits the retained route.
+		return executor.Result{}, nil
 	case strings.Contains(sql, "from mo_upgrade"):
 		if strings.Contains(sql, "'4.0.12'") {
 			return ownRecoveryResult(e.t, buildUpgradeVersionResult(11, versions.StateCreated, "4.0.11", "4.0.12", 1, 0, versions.No, versions.No, 0, 0)), nil
@@ -789,3 +795,65 @@ func TestV407RejectsInterruptedOffsetOnlyRouteBeforeMutation(t *testing.T) {
 		require.False(t, s.upgrade.finalVersionCompleted.Load())
 	})
 }
+
+// TestV407InterruptedOffsetOnlyRouteRejectedAtRecoveryValidation closes the
+// resume path the successor registration newly reaches: an unfinished route
+// to the frozen identity that carries a 4.0.7 -> 4.0.7 leg terminates in the
+// recovery validation with the same message as the pre-mutation check.
+func TestV407InterruptedOffsetOnlyRouteRejectedAtRecoveryValidation(t *testing.T) {
+	runtime.RunTest("", func(runtime.Runtime) {
+		frozen := v4_0_7.Handler.Metadata()
+		target := versions.Version{Version: frozen.Version, VersionOffset: frozen.VersionOffset, State: versions.StateCreated}
+		txn := executor.NewMemTxnExecutor(func(sql string) (executor.Result, error) {
+			switch {
+			case strings.Contains(sql, "from mo_upgrade"):
+				return ownRecoveryResult(t, buildUpgradeVersionResult(10, versions.StateUpgradingTenant, frozen.Version, frozen.Version, frozen.VersionOffset, 0, versions.Yes, versions.Yes, 1, 0)), nil
+			default:
+				return executor.Result{}, fmt.Errorf("recovery validation may read only the retained route: %s", sql)
+			}
+		}, &testTxnOperator{})
+		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, nil, func(s *service) { s.initUpgrade() })
+		t.Cleanup(s.stopper.Stop)
+		require.True(t, s.canResumeUpgrade(target),
+			"the registered handle's offset keeps the frozen identity resumable; the offset-only leg must reject it")
+		err := s.checkUpgradeRecovery(target, txn)
+		require.ErrorContains(t, err, "unsupported in-progress 4.0.7 offset-only upgrade")
+		var terminal *terminalUpgradeError
+		require.ErrorAs(t, err, &terminal)
+	})
+}
+
+// TestV407ReadyFrozenSourceCreatesDirectRoute pins the one allowed
+// frozen-source transition at the successor final: a ready 4.0.7 row at the
+// registered handle's offset skips the pre-mutation rejections, admits with
+// no legacy CDC source below the frozen stage, and takes the single direct
+// succession hop.
+func TestV407ReadyFrozenSourceCreatesDirectRoute(t *testing.T) {
+	runtime.RunTest("", func(runtime.Runtime) {
+		frozen := v4_0_7.Handler.Metadata()
+		var routes []string
+		exec := executor.NewMemExecutor2(func(sql string) (executor.Result, error) {
+			switch {
+			case strings.HasPrefix(sql, "SELECT reldatabase, relname, account_id FROM mo_catalog.mo_tables"):
+				return newBootstrapStringResult("mo_catalog"), nil
+			case sql == versions.LatestVersionSQL:
+				return recoveryVersionResult(t, versions.Version{Version: frozen.Version, VersionOffset: frozen.VersionOffset, State: versions.StateReady}), nil
+			case strings.Contains(sql, "select version from mo_version"):
+				return newBootstrapStringResult(frozen.Version), nil
+			case strings.HasPrefix(sql, "insert into mo_upgrade"):
+				routes = append(routes, sql)
+				return executor.Result{}, nil
+			case strings.Contains(sql, "from mo_catalog.mo_cdc_task"):
+				return executor.Result{}, fmt.Errorf("a ready frozen identity is a post-4.0.7 source: %s", sql)
+			default:
+				return executor.Result{}, nil
+			}
+		}, &testTxnOperator{})
+		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+		t.Cleanup(s.stopper.Stop)
+		require.NoError(t, s.doCheckUpgrade(t.Context()))
+		require.Len(t, routes, 1, "the valid frozen identity takes the single direct succession hop")
+		require.Contains(t, routes[0], fmt.Sprintf("'%s', '%s', '%s',", frozen.Version, v4_0_19.Handler.Metadata().Version, v4_0_19.Handler.Metadata().Version))
+		require.False(t, s.upgrade.finalVersionCompleted.Load())
+	})
+}
```

**File**: `pkg/bootstrap/service_upgrade_tenant_v407_test.go` (modified, +437/-6)
```diff
@@ -17,18 +17,24 @@ package bootstrap
 import (
 	"context"
 	"fmt"
+	"os"
 	"strings"
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_18"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_19"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/txn"
 	"github.com/matrixorigin/matrixone/pkg/txn/clock"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
+	"github.com/matrixorigin/matrixone/pkg/util/sysview"
 	"github.com/stretchr/testify/require"
 )
 
@@ -76,11 +82,11 @@ func TestV407TaskCompletionAfterLastAccountCommit(t *testing.T) {
 }
 
 // A ready semantic version has no offset progress to replay. On the
-// integrated chain the final handle is 4.0.18, so the converged leg uses a
-// cluster READY at 4.0.18/1 with the account already at 4.0.18: the manual
+// merged chain the final handle is 4.0.19, so the converged leg uses a
+// cluster READY at 4.0.19/2 with the account already at 4.0.19: the manual
 // path reads its route state, runs no migration SQL, and caches the account.
 // The frozen-4.0.7 staging pins the other reachable branch of the same
-// boundary: a CN at final 4.0.18 refuses a manual tenant upgrade while the
+// boundary: a CN at final 4.0.19 refuses a manual tenant upgrade while the
 // cluster still reports 4.0.7 as its latest version, because its own cluster
 // route has not been created yet. The final==4.0.7 arm inside
 // UpgradeOneTenant can no longer fire on this binary; the frozen offset-only
@@ -90,8 +96,8 @@ func TestManualV407ReadyAccountDoesNotReplay(t *testing.T) {
 	for _, midRoll := range []bool{false, true} {
 		t.Run(fmt.Sprint(midRoll), func(t *testing.T) {
 			runtime.RunTest("", func(runtime.Runtime) {
-				accountVersion := "4.0.18"
-				latest := versions.Version{Version: "4.0.18", VersionOffset: 1, State: versions.StateReady}
+				accountVersion := "4.0.19"
+				latest := versions.Version{Version: "4.0.19", VersionOffset: v4_0_19.Handler.Metadata().VersionOffset, State: versions.StateReady}
 				wantReads := 3
 				if midRoll {
 					accountVersion = final.Version
@@ -118,7 +124,7 @@ func TestManualV407ReadyAccountDoesNotReplay(t *testing.T) {
 				err := s.UpgradeOneTenant(t.Context(), 7)
 				if midRoll {
 					require.ErrorContains(t, err,
-						"tenant upgrade requires current cn version 4.0.18 to match cluster latest version 4.0.7")
+						"tenant upgrade requires current cn version 4.0.19 to match cluster latest version 4.0.7")
 					require.Empty(t, s.mu.tenants)
 				} else {
 					require.NoError(t, err)
@@ -131,6 +137,57 @@ func TestManualV407ReadyAccountDoesNotReplay(t *testing.T) {
 	}
 }
 
+// An account at the cluster's final version has no migration to replay. A
+// restarted CN must skip DDL rather than silently rebuilding existing objects
+// and grants - including a differently stamped final row from another
+// generation, which never reaches the tenant walk.
+func TestManualFinalReadyAccountDoesNotReplay(t *testing.T) {
+	for _, mismatch := range []bool{false, true} {
+		t.Run(fmt.Sprint(mismatch), func(t *testing.T) {
+			runtime.RunTest("", func(runtime.Runtime) {
+				final := v4_0_19.Handler.Metadata()
+				offset := final.VersionOffset
+				if mismatch {
+					offset++
+				}
+				reads := 0
+				exec := executor.NewMemExecutor2(func(sql string) (executor.Result, error) {
+					reads++
+					switch {
+					case sql == "select create_version from mo_account where account_id = 7":
+						return newBootstrapStringResult(final.Version), nil
+					case sql == versions.LatestVersionSQL:
+						return statisticsLatestVersionResult(t, versions.Version{Version: final.Version, VersionOffset: offset}, versions.StateReady), nil
+					case strings.Contains(sql, "from mo_upgrade"):
+						return executor.Result{}, nil
+					default:
+						t.Fatalf("ready account must not run migrations: %s", sql)
+						return executor.Result{}, nil
+					}
+				}, &testTxnOperator{})
+				s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+				t.Cleanup(s.stopper.Stop)
+				err := s.UpgradeOneTenant(t.Context(), 7)
+				require.NoError(t, err)
+				require.True(t, s.mu.tenants[7])
+				// A differently stamped final row skips the walk entirely; the
+				// matching row reads the retained route and replays nothing.
+				if mismatch {
+					require.Equal(t, 2, reads)
+				} else {
+					require.Equal(t, 3, reads)
+				}
+				require.NoError(t, s.UpgradeOneTenant(t.Context(), 7))
+				if mismatc
```

---

### Incident Patch 3: `91dfab21` (2026-10-30)
**Commit Message**: fix(python-sdk): unify SQL, transaction and driver boundaries (#31889)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [x] Improvement
- [x] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Closes #30242
Closes #31149
Closes #30059
Closes #31845
Closes #31840
Closes #31404
Closes #31403
Closes #31400
Closes #31399
Closes #31394

## What this PR does / why we need it:

Repair the shared Python SDK boundaries behind the ten assigned reports
in one change. A duplicate-key COMMIT reply now reports a rejected write
with `committed=False`; a lost successful reply remains unknown. All
search builders quote MATCH identifiers correctly, preserve explicit
zero pagination, and share safe native mode rendering. Vector index
creation and deletion share validation and execution instead of
swallowing failures in repeated paths.

- Repair async ORM bytes binding at the common
dialect/physical-connection boundary. Install one instance-local
hexadecimal binary encoder per connection, preserving the original
nonbinary encoder and module globals. Move the existing pre-ping
compatibility setting to the actual engine/pool owner so warmed 

**File**: `.github/ci/change-scope.test.cjs` (modified, +9/-5)
```diff
@@ -558,15 +558,19 @@ test('the reusable SDK owner preserves the matrix and isolates untrusted checkou
   assert.match(offline, /flake8 matrixone --select=E9,F63,F7,F82/);
   assert.match(offline, /if: \$\{\{ matrix.python == '3.12' && matrix.sqlalchemy == '>=2.0,<2.1' \}\}/);
   assert.match(offline, /fail-fast: false/);
-  const pythons = ['3.10', '3.12'];
-  const sqlalchemy = ['>=1.4,<1.5', '>=2.0,<2.1', '>=2.1,<3'];
-  for (const python of pythons) assert.ok(offline.includes(`'${python}'`));
-  for (const range of sqlalchemy) assert.ok(offline.includes(`'${range}'`));
+  assert.match(offline, /^        python: \['3\.10', '3\.12'\]$/m);
+  assert.match(offline, /^        sqlalchemy: \['>=1\.4\.54,<1\.5', '>=2\.0,<2\.1', '>=2\.1,<3'\]$/m);
   assert.match(offline, /exclude:\n          - python: '3.10'\n            sqlalchemy: '>=2.1,<3'/);
+  assert.match(offline, /include:\n          - python: '3\.10'\n            sqlalchemy: '==1\.4\.54'/);
   assert.match(offline, /include:[\s\S]*?- python: '3.11'\n            sqlalchemy: '>=2.1,<3'/);
+  assert.match(offline, /SQLALCHEMY_RANGE: \$\{\{ matrix\.sqlalchemy \}\}/);
+  assert.match(offline, /"SQLAlchemy\[asyncio\]\$\{SQLALCHEMY_RANGE\}"/);
+  assert.match(offline, /- name: Assert exact supported SQLAlchemy floor\n        if: \$\{\{ matrix\.sqlalchemy == '==1\.4\.54' \}\}\n        run: python -c "import sqlalchemy; assert sqlalchemy\.__version__ == '1\.4\.54', sqlalchemy\.__version__"/);
+  assert.ok(offline.indexOf('Assert exact supported SQLAlchemy floor') < offline.indexOf('Run required offline contracts without skips'));
   assert.match(offline, /name: python-sdk-\$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}-\$\{\{ strategy.job-index \}\}/);
   assert.match(offline, /if: \$\{\{ !cancelled\(\) \}\}/);
   const core = checkoutSpec(sections['core-import']);
+  assert.match(sections['core-import'], /include:\n          - python: '3\.8'\n            sqlalchemy: '==1\.4\.54'/);
   assert.equal(core.repository, checkout.repository);
   assert.equal(core.ref, checkout.ref);
   assert.equal(core['persist-credentials'], 'false');
@@ -587,7 +591,7 @@ test('the reusable SDK owner preserves the matrix and isolates untrusted checkou
     assert.equal(result.status === 0, database !== '', result.stderr);
     if (!database) assert.match(result.stderr, /Configure MATRIXONE_DATABASE/);
   }
-  assert.match(offline, /python scripts\/run_contracts\.py --output offline-contracts/);
+  assert.match(offline, /- name: Run required offline contracts without skips\n        run: python scripts\/run_contracts\.py --output offline-contracts/);
   assert.match(sections.online, /python scripts\/run_contracts\.py --server "\$SDK_SERVER_TARGET" --output online-contracts/);
   assert.ok(readFileSync(join(__dirname, '../../clients/python/scripts/run_contracts.py'), 'utf8').length > 0);
   const group = sdk.match(/^  group: (.*)$/m)[1];
```

**File**: `.github/workflows/python-sdk.yml` (modified, +17/-2)
```diff
@@ -29,11 +29,13 @@ jobs:
       fail-fast: false
       matrix:
         python: ['3.10', '3.12']
-        sqlalchemy: ['>=1.4,<1.5', '>=2.0,<2.1', '>=2.1,<3']
+        sqlalchemy: ['>=1.4.54,<1.5', '>=2.0,<2.1', '>=2.1,<3']
         exclude:
           - python: '3.10'
             sqlalchemy: '>=2.1,<3'
         include:
+          - python: '3.10'
+            sqlalchemy: '==1.4.54'
           - python: '3.12'
             sqlalchemy: '==2.0.43'
           # SQLAlchemy 2.1 requires Python >=3.11.
@@ -70,6 +72,19 @@ jobs:
           SQLALCHEMY_RANGE: ${{ matrix.sqlalchemy }}
         run: |
           python -m pip install -e '.[test]' "SQLAlchemy[asyncio]${SQLALCHEMY_RANGE}" pytest-asyncio pytest-subtests
+      - name: Assert exact supported SQLAlchemy floor
+        if: ${{ matrix.sqlalchemy == '==1.4.54' }}
+        run: python -c "import sqlalchemy; assert sqlalchemy.__version__ == '1.4.54', sqlalchemy.__version__"
+      - name: Pin and verify the async driver regression tuple
+        if: ${{ matrix.sqlalchemy == '==2.0.43' }}
+        run: |
+          python -m pip install 'PyMySQL==1.2.3' 'aiomysql==0.3.2'
+          python - <<'PYDRIVERS'
+          from importlib.metadata import version
+          assert version('SQLAlchemy') == '2.0.43'
+          assert version('PyMySQL') == '1.2.3'
+          assert version('aiomysql') == '0.3.2'
+          PYDRIVERS
       - name: Check fatal Python errors
         if: ${{ matrix.python == '3.12' && matrix.sqlalchemy == '>=2.0,<2.1' }}
         run: |
@@ -102,7 +117,7 @@ jobs:
       matrix:
         include:
           - python: '3.8'
-            sqlalchemy: '>=1.4,<1.5'
+            sqlalchemy: '==1.4.54'
           - python: '3.9'
             sqlalchemy: '>=2.0,<2.1'
     defaults:
```

**File**: `clients/python/SDK_CI.md` (modified, +7/-1)
```diff
@@ -9,9 +9,15 @@ The existing `CI Required` aggregate enforces the SDK call's result, including
 failures, cancellations and missing results. SDK-only skips do not provide kernel
 coverage or online SDK certification.
 
+The supported SQLAlchemy minimum is **1.4.54**. An exact 1.4.54 cell
+runs the full offline contracts and asserts the installed version; the Python
+3.8 installed-core cell also pins that minimum. SQLAlchemy 1.4.24 fails verified
+escaped expanding-bind and cancelled-connection cleanup contracts.
+
 Offline contracts run on Python 3.10/3.12 with SQLAlchemy 1.4/2.0 and Python
 3.11/3.12 with SQLAlchemy 2.1 (which requires Python >=3.11). An additional Python
-3.12 cell fixes SQLAlchemy at 2.0.43 for the pre-ping regression. Each cell runs
+3.12 cell fixes SQLAlchemy at 2.0.43 with PyMySQL 1.2.3 and aiomysql 0.3.2
+for pre-ping and binary binding, asserting all three distribution versions. Each cell runs
 `scripts/run_contracts.py`, which records source/dependency provenance and rejects
 failures, errors, skips, empty selections and source changes during execution.
 Analytics offline checks run separately; their online-only skips do not weaken
```

**File**: `clients/python/docs/async-analytics-and-execution.md` (modified, +99/-1)
```diff
@@ -20,7 +20,9 @@ Shorthand table definitions preserve `datetime(6)`, `timestamp(3)` and `time(6)`
 creation and DROP. SQLAlchemy reflection also recognizes existing F16, BF16,
 INT8 and UINT8 vectors; Arrow support is qualified separately.
 
-SQLAlchemy 1.4.24 or newer is required: projection inference uses
+SQLAlchemy 1.4.54 or newer is required. SQLAlchemy 1.4.24 has verified
+escaped expanding-bind and cancelled physical-connection cleanup failures. The
+SDK also requires the following public APIs: projection inference uses
 `Select.get_final_froms()` (1.4.23), and native async streams use the public
 `driver_connection` accessor (1.4.24). SQLAlchemy 2.1 itself requires Python
 3.11 or newer; Python 3.8/3.9 use a compatible 1.4/2.0 series.
@@ -218,3 +220,99 @@ requests fail before any CREATE/ALTER mutation; equals signs in values work.
 
 See [design revision 2.3](design/systemic-sdk-boundaries.md) for ownership,
 compatibility and failure-path decisions.
+
+
+### Explicit snapshot support
+
+Importing `matrixone` or its SQLAlchemy extensions does not modify SQLAlchemy's
+`Select` class. Prefer `select(User, snapshot='nightly')` from `matrixone`, or
+annotate an existing statement with `with_snapshot(statement, 'nightly')`.
+The same helpers and `compile_select` are exported by `matrixone.sqlalchemy_ext`.
+Both forms return a new statement; the original remains a live query.
+
+Applications retaining the legacy `statement.with_snapshot('nightly')` spelling
+must call `enable_snapshot_method()` once at startup. This is a process-wide
+opt-in; it refuses to overwrite a method or attribute installed by another
+library. Configure it before concurrent class modifications. Unsupported snapshot
+sources continue to fail explicitly rather than silently reading live data.
+
+### Search and index boundaries
+
+`boolean_match()` defaults to Boolean mode. The higher-level
+`FulltextSearchBuilder` defaults to natural-language mode; choose
+`.with_mode(FulltextSearchMode.BOOLEAN)` when supplying Boolean operators.
+Explicit `LIMIT 0` and `OFFSET 0` remain in generated SQL, including offsets
+without a limit. MATCH identifier components are always backtick-quoted.
+Strings may name `column`, `table.column` or `database.table.column`; SQLAlchemy
+column objects retain atomic names, including dots and embedded backticks.
+
+The builders' `.where()`, projections, table and ordering fragments remain
+caller-owned SQL. Do not interpolate untrusted values into these fragments;
+use a parameterized SQLAlchemy statement for that purpose. Structured Boolean
+terms retain MatrixOne grammar (`stop-fire` and `c++` are valid terms); phrase
+contents with embedded quotes/backslashes cannot be represented and fail early.
+Raw-mode builders also preserve `IN BM25 MODE` and natural-language query
+expansion. Unsupported modes raise `ValueError`; the filter and legacy builder
+retain their existing fallback for unknown modes. Query-expansion syntax is
+rendered as `WITH QUERY EXPANSION`; execution still
+depends on server support.
+
+Vector index numeric options accept positive signed 64-bit integers or `None`
+to use the server default; booleans, strings, fractional values, zero and negative
+values are rejected before DDL or setup SQL. The same validation applies to
+later option assignments. Server algorithm-specific limits remain server-owned.
+The five native metric names (L2, L2 squared, inner product, cosine and L1) are
+recognized case-insensitively; empty `op_type` retains the server's L2 default.
+The server decides which metrics each algorithm supports. Unknown safe index
+keywords remain available for server plugins.
+
+Index class/instance `create` and `drop` return `True` on success and now raise
+execution errors instead of printing them and returning `False`. Catch the
+original SQLAlchemy/database exception to distinguish failure from success.
+Names use the same quoting boundary for create and drop; no retry, capability
+probe, or extra query is added to the execution path.
+
+
+### Complete-SQL builder parameters
+
+`MatrixOneSQLBuilder.build_with_parameter_substitution()`, `str(builder)` and
+its convenience helpers use the execution path's existing lexical renderer.
+Only executable `?` markers are substituted, values are rendered by type, and
+missing/extra values fail before execution. `build()` continues to return SQL
+and its parameter list. The builder retains its historical qmark-only style;
+modulo expressions using columns such as `s` or `scol` are left intact. The
+Client/Session renderer's existing `%s` support is unchanged.
+
+Convenience helpers reject nonempty `where_params` when conditions are absent
+or empty (including empty condition iterators), in both parameterized and
+complete-SQL modes. Empty parameters remain valid without conditions. Vector distance
+values use the existing string-token boundary; column names, expressions and
+other raw SQL fragments remain caller-owned. Rendered values are
```

**File**: `clients/python/docs/design/analytics-arrow-upload.md` (modified, +7/-1)
```diff
@@ -33,7 +33,13 @@ Create one owned unique IPC file in the caller's existing staging directory. Wri
 After staging completes, create a new table (`create=True`) or append (`create=False`) and execute native Arrow `LOAD DATA` in one transaction. Hold UTC, STRICT_ALL_TABLES and TN primary-key checks through COMMIT, then restore session settings.
 
 - Before-commit errors: roll back creation/append; no partial rows.
-- Disconnection during COMMIT: `AnalyticsCommitUnknownError`, `committed=None`; reconcile rather than retry.
+- An acknowledged, non-invalidated PyMySQL/aiomysql duplicate-key (1062)
+  COMMIT reply: `AnalyticsCommitRejectedError`, `committed=False`, with
+  original errno/cause and row count when known. The failed connection is
+  still discarded. File imports share this transaction classification.
+- Other COMMIT errors, cancellation or missing replies: `AnalyticsCommitUnknownError`, `committed=None`; reconcile rather than retry.
+  Cancellation retains its cancellation exception with the same unknown state.
+  The SDK does not infer rollback from arbitrary error codes or retry writes.
 - Acknowledged commit followed by session/staging cleanup failure: `AnalyticsCleanupError`, `committed=True`, with row count.
 - If a primary input/DB error is already active, attach `rollback_error`, `cleanup_error` or `staging_cleanup_error` instead of replacing it.
 
```

**File**: `clients/python/docs/design/systemic-sdk-boundaries.md` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ qualified negative target for native Arrow LOAD and the new Stage literal cases.
 ## Validation and compatibility
 
 Core Python 3.8 remains available without Arrow. Analytics requires Python 3.9+.
-SQLAlchemy >=1.4.24 is the supported floor; 2.1 requires Python >=3.11. Driver-bound
+SQLAlchemy >=1.4.54 is the supported floor; 2.1 requires Python >=3.11. Driver-bound
 execution is explicit and does not reinterpret existing SDK text placeholders.
 
 Validation maps shared compilation to real SQLAlchemy controls, async ownership
```

**File**: `clients/python/docs/installation.rst` (modified, +3/-3)
```diff
@@ -66,9 +66,9 @@ Requirements
 ------------
 
 * Python 3.8 or higher
-* PyMySQL >= 1.0.0
-* aiomysql >= 0.1.0
-* SQLAlchemy >= 1.4.0
+* PyMySQL >= 1.0.0, != 1.2.1, != 1.2.2, < 1.3
+* aiomysql >= 0.2.0
+* SQLAlchemy >= 1.4.54, < 3
 * typing-extensions >= 4.0.0
 * python-dateutil >= 2.8.0
 
```

**File**: `clients/python/docs/requirements.txt` (modified, +2/-2)
```diff
@@ -7,9 +7,9 @@ sphinx-rtd-theme>=1.0,<3.0
 sphinx-autobuild>=2021.3.14
 
 # Required for autodoc to work with the source code
-PyMySQL>=1.0.0
+PyMySQL>=1.0.0,!=1.2.1,!=1.2.2,<1.3
 aiomysql>=0.2.0
-SQLAlchemy>=1.4.0,<3.0.0
+SQLAlchemy>=1.4.54,<3.0.0
 typing-extensions>=4.0.0
 python-dateutil>=2.8.0
 numpy>=1.20.0,<2.0.0
```

#### Recent Merged Pull Requests:
- **PR #31935** (closed): plan: support DROP VIEW with multiple views (#31910) (@MatrixAdventurer)
- **PR #31934** (2026-10-30): fix(ci): cancel obsolete PR runs and avoid post-merge main checks (@XuPeng-SH)
- **PR #31933** (2026-10-30): fix(ci): repair shared UT lifecycle and trim redundant fixtures (@XuPeng-SH)
- **PR #31932** (closed): Preserve borrowed vector snapshots and backing ownership (@iamlinjunhong)
- **PR #31925** (closed): test(bvt): cover external CSV table read consistency and read-only rejections (@MatrixAdventurer)
- **PR #31924** (closed): test(bvt): cover data branch table shapes, vector index metric consistency and multibyte charset parity (@MatrixAdventurer)

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

## X. plan): MySQL implicit boolean semantics for ENUM/SET, BIT literals and JSON cond

**RULE**:
When implementing operations in `docs/design/20261027-implicit-boolean-semantics-enum-set-bit-json.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d8c90c20`: plan): MySQL implicit boolean semantics for ENUM/SET, BIT literals and JSON conditions (#31492). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261027-implicit-boolean-semantics-enum-set-bit-json.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Implicit boolean semantics for ENUM/SET, BIT literals, and JSON conditions

- Status: Review required
- Tracking issue: [#30931](https://github.com/matrixorigin/matrixone/issues/30931) (consolidated group: #30930, #30932)
- Implementation PR: [#31492](https://github.com/matrixorigin/matrixone/pull/31492) - implemented from revision 8; after the revision-9 deviation repair lands, the PR description and implementation review must link THIS revision and its hash
- Design revision: 9
- Last updated: 2026-10-30
- Supersedes revision 8 (SHA256 15d933cf6ac0608423409fa31173d969cc8de16a01be3ee969e0c8678ad6d73a, the independently PASSed predecessor, returned with round-9 finding P2 - the minted per-feature MORPC slot and its version-gate wiring violate the repository's shutdown-only upgrade contract, `.agents/skills/mo-dev/references/upgrade-compatibility.md:13-40`), which superseded revision 7 (SHA256 ea470bd602e6209e383d96db1c1480f5e807a95b147230e48c9b96ac4ed3bb31, returned with finding F8 - exempt SET storage semantics from the boolean-condition contracts), which superseded revision 6 (SHA256 1cec7f6e700f2f3863aea39214475fce3bd3d73e33ef5d2e07608e85105ed1c1, returned with finding R2 - cl
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d8c90c20` are properly handled with clean fallback behavior.
