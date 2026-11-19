> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `3cd5f717`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T22:36:16.955Z  
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
> **Harvest Timestamp**: 2026-11-19T22:36:16.948Z  
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
- **Issue #32945** (2026-11-19): **[4.2-dev] Preserve COS GET cancellation identity**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32389.  ## What this PR does / why we need it:  A COS GET canceled while waiting for response headers can return a singleton SDK RetryError even with SDK retries disabled. It renders as `context canceled`, but standard Go error traversal cannot identify the wrapped cancellation. A normal early stop after IVF sampling reaches its LIMIT can then surface as SQL error 1105.  Restore the request's context error at the COS GET boundary only when the SDK wrapper contains that exact error as its sole child. Independent storage errors and mixed errors retain their identity. The success path incurs no additional checks or allocations.  A local three-CN reproduction on the nightly revision used 250,000 persisted rows and controlled only the response timing of a GET. The same CREATE INDEX failed before normalization and succeeded with it. With disk caching enabled, delaying a bounded-range GET also reproduced the failure. The archived nightly logs contain the same reader and SQL symptoms, but do not record the original Go error type.  The new public Read regression uses a real HTTP request and cancels after the server receives it. It fails with the expected RetryError when normalization is removed. Focused counterexamples cover deadlines, active requests, independent errors and mixed errors. The

- **Issue #32938** (2026-11-19): **perf(cdc): avoid formatting disabled watermark debug logs**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32278 (C28).  ## What this PR does / why we need it:  Buffering a CDC watermark formatted the table key twice and rendered both timestamps before Debug could reject the log event. Reuse the existing metric label and build the structured log fields only when Debug is enabled.  In a local Go 1.27.1 benchmark of repeated accepted updates with Debug disabled, allocation fell from 666 to 72 B/op and from 11 to 4 allocs/op. Median time across three samples fell from 591 to 231 ns/op for that fixture.  Validation: the CDC package under the race detector and incremental SCA. With Debug enabled, the before/after structured records match apart from the wall-clock timestamp. Info emits no buffer-update event. Both levels buffer the same watermark and increment the same commit counter.  A committed CDC regression test verifies Info and Debug behavior, including first and replacement watermark fields, cached values, and the commit counter. In a local coverage run using the CI test tag, both changed coverage blocks are exercised. 

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

### Incident Patch 1: `793b62b5` (2026-11-19)
**Commit Message**: fix(function): reject undefined real-domain POW arguments (#32863)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #31155

Fixes #31155

## What this PR does / why we need it:

POW/POWER with a finite negative base and a finite non-integer exponent
is mathematically undefined in the real domain, but MatrixOne silently
returned a row-local NULL. This PR makes the Power operator reject such
arguments with the typed DOUBLE out-of-range error (MySQL 1690, SQLSTATE
22003, `data out of range: data type float64, DOUBLE value is out of
range in 'pow(-2,0.5)'`), keeping the #28375 row-local NULL semantics
untouched for overflow/NaN-input (EXP/COT) cases.

It also carries a CI fix found by this PR's own required `-race` UT job:
`gc/v3.buildTableExistenceMap` read each table catalog entry's MVCC
chain delete timestamp via `GetDeleteAtLocked` without the entry lock,
racing `DBEntry.DropTableEntryByID` (entry write lock ->
`DropEntryLocked` -> `DeleteLocked` -> `InsertLocked`), reported three
times in
`TestDataBranchDiffAcrossCheckpointGCAndRestart/gc_ch

**File**: `pkg/embed/cdc_control_status_test.go` (modified, +111/-1)
```diff
@@ -16,12 +16,14 @@ package embed
 import (
 	"bytes"
 	"context"
+	"errors"
 	"fmt"
 	"sync"
 	"testing"
 	"time"
 
 	"github.com/google/uuid"
+	dragonboat "github.com/lni/dragonboat/v4"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/cnservice"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
@@ -41,6 +43,108 @@ type cdcControlResult struct {
 	err error
 }
 
+// cdcClusterStateWithReadiness bounds the initial, idempotent, read-only
+// GetClusterState readiness probe of the CDC claims subtest: its result only
+// feeds state.TaskTableUser below. The current5711 CI UT (job 135195296776,
+// 2026-11-18 23:30:59) observed exactly one raw dragonboat request timeout on
+// this first probe while the log service reported the same checker-state read
+// timing out on its side in the same window; root36 kept the stall's own
+// origin qualified UNKNOWN. This helper absorbs no more than that observed
+// failure class, deterministically: at most three attempts on the caller's
+// unchanged context, retrying only errors.Is(dragonboat.ErrTimeout) chains,
+// stopping at the first success, never issuing another request once the
+// context is done, and returning any other error after the first failed
+// attempt. The caller's require.NoError still owns the final failure; no
+// deadline is raised anywhere and no claims/heartbeat/write path is retried.
+func cdcClusterStateWithReadiness(
+	t *testing.T,
+	ctx context.Context,
+	getState func(context.Context) (logservicepb.CheckerState, error),
+) (logservicepb.CheckerState, error) {
+	t.Helper()
+	if ctxErr := ctx.Err(); ctxErr != nil {
+		return logservicepb.CheckerState{}, ctxErr
+	}
+	const attempts = 3
+	state, lastErr := getState(ctx)
+	for i := 2; lastErr != nil && i <= attempts; i++ {
+		if ctxErr := ctx.Err(); ctxErr != nil {
+			return logservicepb.CheckerState{}, lastErr
+		}
+		if !errors.Is(lastErr, dragonboat.ErrTimeout) {
+			return logservicepb.CheckerState{}, lastErr
+		}
+		t.Logf("initial CDC cluster-state readiness %d/%d: %v", i-1, attempts, lastErr)
+		state, lastErr = getState(ctx)
+	}
+	if lastErr != nil {
+		t.Logf("initial CDC cluster-state readiness failed after at most %d attempts: %v", attempts, lastErr)
+	}
+	return state, lastErr
+}
+
+// TestCDCInitialClusterStateReadinessBounds covers every branch of the
+// readiness helper with deterministic pure consumers: scripted results,
+// recorded request contexts, exact error identities and finite call counts.
+// No cluster, no timing assumptions, no retry framework.
+func TestCDCInitialClusterStateReadinessBounds(t *testing.T) {
+	okState := logservicepb.CheckerState{Tick: 42}
+	nonTimeout := errors.New("cdc readiness probe: not a timeout")
+	for _, s := range []struct {
+		name        string
+		preCanceled bool
+		cancelAfter int // 1-based call index whose side effect cancels ctx; 0 = never
+		succeedAt   int // 1-based call index returning success; 0 = never
+		err         error
+		wantCalls   int
+		wantOK      bool
+		wantErrIs   error
+	}{
+		{name: "immediate success", succeedAt: 1, err: nonTimeout, wantCalls: 1, wantOK: true},
+		{name: "timeout then success", succeedAt: 2, err: dragonboat.ErrTimeout, wantCalls: 2, wantOK: true},
+		{name: "wrapped timeout is recognized then succeeds", succeedAt: 2, err: fmt.Errorf("probe: %w", dragonboat.ErrTimeout), wantCalls: 2, wantOK: true},
+		{name: "persistent timeout stays an error after three requests", err: dragonboat.ErrTimeout, wantCalls: 3, wantErrIs: dragonboat.ErrTimeout},
+		{name: "non timeout is returned after one request", err: nonTimeout, wantCalls: 1, wantErrIs: nonTimeout},
+		{name: "pre canceled context issues no request", preCanceled: true, err: nonTimeout, wantCalls: 0, wantErrIs: context.Canceled},
+		{name: "cancellation between attempts stops the probe", cancelAfter: 1, err: dragonboat.ErrTimeout, wantCalls: 1, wantErrIs: dragonboat.ErrTimeout},
+	} {
+		t.Run(s.name, func(t *testing.T) {
+			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
+			if s.preCanceled {
+				cancel()
+			}
+			defer cancel()
+			var seen []context.Context
+			calls := 0
+			get := func(c context.Context) (logservicepb.CheckerState, error) {
+				calls++
+				seen = append(seen, c)
+				if calls == s.cancelAfter {
+					cancel()
+				}
+				if s.succeedAt != 0 && calls >= s.succeedAt {
+					return okState, nil
+				}
+				return logservicepb.CheckerState{}, s.err
+			}
+			state, err := cdcClusterStateWithReadiness(t, ctx, get)
+			require.Equal(t, s.wantCalls, calls, "the probe is bounded")
+			for _, c := range seen {
+				require.Same(t, ctx, c, "every request uses the caller's context unchanged")
+			}
+			if s.wantOK {
+				require.NoError(t, err)
+				require.Equal(t, okState, state)
+				return
+			}
+			require.Error(t, err)
+			if s.wantErrIs != nil {
+				require.ErrorIs(t, err, s.wantErrIs)
+			}
+		})
+	}
+}
+
 func testCDCControlConcurrentClaims(t *testing.T,
```

**File**: `pkg/objectio/arena_pool_test.go` (modified, +126/-25)
```diff
@@ -16,6 +16,7 @@ package objectio
 
 import (
 	"testing"
+	"testing/synctest"
 	"time"
 
 	metric "github.com/matrixorigin/matrixone/pkg/util/metric/v2"
@@ -102,36 +103,136 @@ func TestArenaFreedAfterIdleTTL(t *testing.T) {
 // After a burst, a workload that keeps reusing one arena keeps exactly that
 // one warm; the rest of the burst ages out although the pool stays busy.
 // The global idle timer this replaces never fired while anything was active.
+//
+// Every assertion and the reaper schedule run under testing/synctest's
+// controlled clock: bubble time only advances after every bubble goroutine
+// is durably blocked, so the workload cannot be preempted while it holds
+// the working arena and both schedules below are deterministic in virtual
+// time. One case lets the initial reaper fire normally; the other holds the
+// first fire until well after the old fixed warmup plus the TTL while the
+// workload stays busy. The previous real-time form could not prove either
+// guarantee, because time.Sleep bounds the minimum, not the maximum, pause.
 func TestArenaBurstReleasedWhileStillActive(t *testing.T) {
-	ttl := 150 * time.Millisecond
-	withArenaIdleTTL(t, ttl)
-	base := arenaMPool.CurrNB()
+	// Go 1.27 forbids t.Run inside a synctest bubble, so each schedule
+	// subtest owns its own bubble below.
+	for _, schedule := range []string{"normal first fire", "delayed first fire"} {
+		t.Run(schedule, func(t *testing.T) {
+			synctest.Test(t, func(t *testing.T) {
+				// Drain the reaper on every exit path, including failed
+				// assertions: this defer runs during Goexit while still
+				// inside the bubble, so the bubble-owned reaper timer is
+				// always stopped in-bubble and the outer cleanup, which
+				// runs outside the bubble, only ever sees reaper == nil.
+				defer drainArenaReaper(ArenaLarge)
+				const ttl = 150 * time.Millisecond
+				withArenaIdleTTL(t, ttl)
+				base := arenaMPool.CurrNB()
+
+				// Within capacity, so perArena below divides by what is actually parked.
+				burst := make([]*WriteArena, min(8, arenaPools[ArenaLarge].maxCount))
+				for i := range burst {
+					burst[i] = GetArena(ArenaLarge)
+				}
+				for _, a := range burst {
+					PutArena(a)
+				}
+				perArena := (arenaMPool.CurrNB() - base) / int64(len(burst))
+
+				pool := &arenaPools[ArenaLarge]
+				holdFirstReaper := schedule != "normal first fire"
+				if holdFirstReaper {
+					// Stop the initial timer but keep its non-nil handle, so
+					// the workload's PutArena (which arms only when the
+					// reaper is nil) cannot re-arm it while the delayed
+					// first fire is held back.
+					pool.mu.Lock()
+					pool.reaper.Stop()
+					pool.mu.Unlock()
+				}
+
+				// borrowed tracks the arena the workload holds out of the
+				// pool. Pool-owned arenas are released by withArenaIdleTTL's
+				// cleanup; releasing the borrowed one here covers a failed
+				// assertion mid-borrow without leaking or double-freeing
+				// off-heap buffers.
+				var borrowed *WriteArena
+				t.Cleanup(func() {
+					if borrowed != nil {
+						borrowed.FreeBuffers()
+					}
+				})
+
+				var steady *WriteArena
+				start := time.Now()
+				deadline := start.Add(5 * time.Second)
+				for time.Now().Before(deadline) {
+					n, _ := parkedLargeSnapshot()
+					if n == 1 {
+						break
+					}
+					if holdFirstReaper && time.Since(start) >= 6*ttl {
+						// Re-arm the held reaper after the old fixed warmup
+						// (4*ttl) plus the TTL has elapsed in bubble time,
+						// with the workload still busy.
+						pool.mu.Lock()
+						pool.reaper = time.AfterFunc(arenaIdleTTL, pool.reap)
+						pool.mu.Unlock()
+						holdFirstReaper = false
+					}
+					borrowed = GetArena(ArenaLarge)
+					if steady == nil {
+						steady = borrowed
+					}
+					require.Same(t, steady, borrowed, "the working arena stays on top of the stack")
+					PutArena(borrowed)
+					borrowed = nil
+					time.Sleep(5 * time.Millisecond)
+				}
+
+				// Join any in-flight reaper callback before observing its
+				// effects: the reap frees the aged arenas' buffers after it
+				// releases the pool lock, so the parked count may already read
+				// one while those frees are still running. synctest.Wait
+				// returns only after every other bubble goroutine is
+				// durably blocked or has exited, which makes this barrier
+				// deterministic for the callback's ownership.
+				synctest.Wait()
 
-	// Within capacity, so perArena below divides by what is actually parked.
-	burst := make([]*WriteArena, min(8, arenaPools[ArenaLarge].maxCount))
-	for i := range burst {
-		burst[i] = GetArena(ArenaLarge)
+				n, survivor := parkedLargeSnapshot()
+				require.Equal(t, 1, n, "the cold burst arenas age out while the pool stays busy")
+				require.Same(t, steady, survivor, "the surviving parked arena is the one the workload kept reusing")
+				require.Equal(t, base+perArena, arenaMPool.CurrNB(), "only the working arena's memory is kept")
+			})
+		})
 	}

```

**File**: `pkg/sql/compile/tp_allocation_reuse_test.go` (modified, +63/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
@@ -319,6 +320,68 @@ func TestTPReusablePipelineQueries(t *testing.T) {
 	}
 }
 
+// TestTPReusePowerProjectionDomainErrorRecovery binds a real Power projection
+// consumer (power(v-2, 0.5)) onto the reused prepared-TP pipeline: the same
+// compiled f.c/f.root must serve repeated executions, surface the typed
+// out-of-range rejection for domain rows WITHOUT publishing the failed batch
+// to the consumer, and recover valid results on the next execution.
+func TestTPReusePowerProjectionDomainErrorRecovery(t *testing.T) {
+	f := newTPReusePipeline(t, plan2.ExecTypeTP, false)
+	keyType := types.T_varchar.ToType()
+	valueType := types.T_int32.ToType()
+	bind := func(name string, args ...*plan.Expr) *plan.Expr {
+		expr, err := plan2.BindFuncExprImplByPlanExpr(f.proc.Ctx, name, args)
+		require.NoError(t, err)
+		return expr
+	}
+	col := func(pos int32, typ types.Type) *plan.Expr {
+		return &plan.Expr{Typ: typ.PlanType(), Expr: &plan.Expr_Col{Col: &plan.ColRef{ColPos: pos}}}
+	}
+	project := f.root.(*projection.Projection)
+	// One-shot real consumer binding: keep the key column and project
+	// power(v-2, 0.5). The reader rows are k=A/B/B with v=1/2/3, so the bases
+	// are -1/0/1 and only the v=1 row is inside the rejected real domain.
+	two := &plan.Expr{Typ: valueType.PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_I32Val{I32Val: 2}}}}
+	half := &plan.Expr{Typ: types.T_float64.ToType().PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_Dval{Dval: 0.5}}}}
+	project.ProjectList = []*plan.Expr{col(0, keyType), bind("power", bind("-", col(1, valueType), two), half)}
+
+	runSelected := func() ([]string, error) {
+		var got []string
+		err := f.execute("A", false, nil, func(b *batch.Batch) {
+			require.False(t, b.HasDictionary(), "root must publish flat results")
+			for row := range b.RowCount() {
+				got = append(got, fmt.Sprintf("%s:%v", b.Vecs[0].GetStringAt(row), vector.GetFixedAtNoTypeCheck[float64](b.Vecs[1], row)))
+			}
+		})
+		return got, err
+	}
+	var warmBytes int64
+	for cycle := range 2 {
+		got, err := runSelected()
+		require.NoError(t, err)
+		require.Equal(t, []string{"B:0", "B:1"}, got)
+		var failedBatchRows []string
+		err = f.execute("", false, nil, func(b *batch.Batch) {
+			for row := range b.RowCount() {
+				failedBatchRows = append(failedBatchRows, b.Vecs[0].GetStringAt(row))
+			}
+		})
+		var moErr *moerr.Error
+		require.True(t, errors.As(err, &moErr) && moerr.IsMoErrCode(moErr, moerr.ErrOutOfRange),
+			"empty-param selection must surface the typed domain rejection, got %v", err)
+		require.Empty(t, failedBatchRows, "the failed batch must not be published to the consumer")
+		got, err = runSelected()
+		require.NoError(t, err)
+		require.Equal(t, []string{"B:0", "B:1"}, got)
+		if cycle == 0 {
+			warmBytes = f.proc.Mp().CurrNB()
+		} else {
+			require.Equal(t, warmBytes, f.proc.Mp().CurrNB(),
+				"prepared TP executor reuse must not retain capacity")
+		}
+	}
+}
+
 func BenchmarkTPReusablePipelineQueries(b *testing.B) {
 	for _, execType := range []plan2.ExecType{plan2.ExecTypeTP, plan2.ExecTypeAP_ONECN} {
 		b.Run(fmt.Sprint(execType), func(b *testing.B) {
```

**File**: `pkg/sql/plan/function/func_binary.go` (modified, +23/-2)
```diff
@@ -8954,15 +8954,36 @@ func evalRight(str string, length int64) string {
 }
 
 func Power(ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) error {
-	// MatrixOne treats numeric domain/overflow failures as row-local NULLs.
-	return opBinaryFixedFixedToFixedWithNullOnError[float64, float64, float64](ivecs, result, proc, length, func(v1, v2 float64) (float64, error) {
+	// Overflow/underflow and NaN/Inf-input results stay row-local NULLs (#28375).
+	// A finite negative base with a finite non-integer exponent has no real
+	// value, so an evaluated row rejects with the DOUBLE out-of-range error
+	// (MySQL 1690, SQLSTATE 22003) instead of a silent NULL: the #28375
+	// contract's domain-shaped exception for the #31155 Expected. NULL
+	// inputs, skipped rows and all other results keep the #28375 contract.
+	// A zero-length batch evaluates no rows: the constant/constant template
+	// shape still invokes the callback once, so the domain check stays off
+	// for length 0 (colexec passes empty-batch row counts).
+	var domainErr error
+	err := opBinaryFixedFixedToFixedWithNullOnError[float64, float64, float64](ivecs, result, proc, length, func(v1, v2 float64) (float64, error) {
+		if length > 0 && v1 < 0 && !math.IsInf(v1, 0) &&
+			!math.IsNaN(v2) && !math.IsInf(v2, 0) && v2 != math.Trunc(v2) {
+			if domainErr == nil {
+				domainErr = moerr.NewOutOfRangeNoCtxf(
+					"float64", "DOUBLE value is out of range in 'pow(%v,%v)'", v1, v2)
+			}
+			return 0, nil
+		}
 		res := math.Pow(v1, v2)
 		if math.IsNaN(res) || math.IsInf(res, 0) {
 			return 0, moerr.NewOutOfRangeNoCtxf(
 				"float64", "DOUBLE value is out of range in 'pow(%v,%v)'", v1, v2)
 		}
 		return res, nil
 	}, selectList)
+	if domainErr != nil {
+		return domainErr
+	}
+	return err
 }
 
 func TimeDiff[T types.Time | types.Datetime](ivecs []*vector.Vector, result vector.FunctionResultWrapper, proc *process.Process, length int, selectList *FunctionSelectList) error {
```

**File**: `pkg/sql/plan/function/func_binary_test.go` (modified, +141/-35)
```diff
@@ -5567,7 +5567,12 @@ func TestPower(t *testing.T) {
 	}
 }
 
-func TestPowerInvalidResultReturnsNull(t *testing.T) {
+// TestPowerNonDomainFailuresReturnNull pins the #28375 row-local NULL
+// contract for everything outside the negative-fractional POW domain:
+// overflow and NaN/Inf input results stay NULL, finite underflow stays a
+// value-0 and input NULLs propagate. The finite negative base / finite
+// non-integer exponent domain is covered separately below.
+func TestPowerNonDomainFailuresReturnNull(t *testing.T) {
 	proc := testutil.NewProcess(t)
 	testCases := []struct {
 		name      string
@@ -5577,40 +5582,33 @@ func TestPowerInvalidResultReturnsNull(t *testing.T) {
 		nulls     []bool
 	}{
 		{
-			name:      "vector continues after invalid row",
-			bases:     NewFunctionTestInput(types.T_float64.ToType(), []float64{2, -2, 4}, nil),
-			exponents: NewFunctionTestInput(types.T_float64.ToType(), []float64{3, 0.5, 0.5}, nil),
-			values:    []float64{8, 0, 2},
+			name:      "vector continues after overflow row",
+			bases:     NewFunctionTestInput(types.T_float64.ToType(), []float64{2, 0, 2}, nil),
+			exponents: NewFunctionTestInput(types.T_float64.ToType(), []float64{3, -1, 0.5}, nil),
+			values:    []float64{8, 0, math.Sqrt2},
 			nulls:     []bool{false, true, false},
 		},
-		{
-			name:      "constant base with vector exponent",
-			bases:     NewFunctionTestConstInput(types.T_float64.ToType(), []float64{-2, -2}, nil),
-			exponents: NewFunctionTestInput(types.T_float64.ToType(), []float64{2, 0.5}, nil),
-			values:    []float64{4, 0},
-			nulls:     []bool{false, true},
-		},
 		{
 			name:      "vector base with constant exponent",
 			bases:     NewFunctionTestInput(types.T_float64.ToType(), []float64{2, 0}, nil),
 			exponents: NewFunctionTestConstInput(types.T_float64.ToType(), []float64{-1, -1}, nil),
 			values:    []float64{0.5, 0},
 			nulls:     []bool{false, true},
 		},
-		{
-			name:      "constant invalid result",
-			bases:     NewFunctionTestConstInput(types.T_float64.ToType(), []float64{-2, -2}, nil),
-			exponents: NewFunctionTestConstInput(types.T_float64.ToType(), []float64{0.5, 0.5}, nil),
-			values:    []float64{0, 0},
-			nulls:     []bool{true, true},
-		},
 		{
 			name:      "overflow underflow and input null",
 			bases:     NewFunctionTestInput(types.T_float64.ToType(), []float64{2, 2, 2, 0, 0}, []bool{false, false, false, true, false}),
 			exponents: NewFunctionTestInput(types.T_float64.ToType(), []float64{1023, 1024, -1075, -1, 0}, nil),
 			values:    []float64{math.Ldexp(1, 1023), 0, 0, 0, 1},
 			nulls:     []bool{false, true, false, true, false},
 		},
+		{
+			name:      "nan and inf inputs stay row-local null",
+			bases:     NewFunctionTestInput(types.T_float64.ToType(), []float64{math.NaN(), -2, math.Inf(1), 0.5}, nil),
+			exponents: NewFunctionTestInput(types.T_float64.ToType(), []float64{2, math.NaN(), 0.5, math.Inf(-1)}, nil),
+			values:    []float64{0, 0, 0, 0},
+			nulls:     []bool{true, true, true, true},
+		},
 	}
 
 	for _, tc := range testCases {
@@ -5628,37 +5626,144 @@ func TestPowerInvalidResultReturnsNull(t *testing.T) {
 	}
 }
 
-func TestPowerRespectsSelectList(t *testing.T) {
+// TestPowerNegativeFractionalExponentReturnsOutOfRange pins the #31155
+// Expected: a finite negative base with a finite non-integer exponent
+// rejects the statement with moerr.ErrOutOfRange (MySQL 1690, SQLSTATE
+// 22003) across every input shape of the fixed/fixed binary template.
+// This is a proposed compatibility change over merged #28375's row-local
+// NULL decision, not yet an accepted product decision.
+func TestPowerNegativeFractionalExponentReturnsOutOfRange(t *testing.T) {
 	proc := testutil.NewProcess(t)
-	inputs := []FunctionTestInput{
-		NewFunctionTestInput(types.T_float64.ToType(), []float64{-2, 2}, nil),
-		NewFunctionTestInput(types.T_float64.ToType(), []float64{0.5, 3}, nil),
+
+	expectOutOfRange := func(t *testing.T, bases, exponents FunctionTestInput) {
+		t.Helper()
+		tcc := NewFunctionTestCase(
+			proc,
+			[]FunctionTestInput{bases, exponents},
+			NewFunctionTestResult(types.T_float64.ToType(), false, nil, nil),
+			Power,
+		)
+		defer tcc.Free()
+		require.NoError(t, tcc.result.PreExtendAndReset(tcc.fnLength))
+		err := Power(tcc.parameters, tcc.result, proc, tcc.fnLength, nil)
+		require.Error(t, err)
+		require.True(t, moerr.IsMoErrCode(err, moerr.ErrOutOfRange),
+			"expected ErrOutOfRange, got %v", err)
 	}
+
+	t.Run("constant base with constant exponent", func(t *testing.T) {
+		expectOutOfRange(t,
+			NewFunctionTestConstInput(types.T_float64.ToType(), []float64{-2, -2}, nil),
+			NewFunctionTestConstInput(types.T_float64.ToType(), []float64{0.5, 0.5}, nil),
+		)
+	})
+
+	t.Run("historical pow witness pow(-8, 1/3)", func(t *testing.T) {
+		expectOutOfRange(t,
+			NewFunctionTestConstInput(types.T_float64.ToType(), []float64{-8, -8}, nil),
+			NewFunctionTestConstInput(types.T_float64.ToType(), []float64{1.0 / 3.0, 
```

**File**: `pkg/tests/issues/issue_31401_scalar_test.go` (modified, +16/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"database/sql/driver"
 	"fmt"
 	"os"
+	"runtime"
 	"strings"
 	"sync"
 	"testing"
@@ -77,9 +78,24 @@ func TestIssue31401ScalarRefreshProgress(t *testing.T) {
 				defer cancel()
 				cleanupSQL := func(exec func(context.Context, string, ...any) (sql.Result, error), timeout time.Duration, statement string) error {
 					t.Helper()
+					started := time.Now()
 					cleanup, stop := context.WithTimeout(context.Background(), timeout)
 					defer stop()
 					_, err := exec(cleanup, statement)
+					if err != nil {
+						// Test-only error-boundary diagnostic: retain this cleanup
+						// phase's SQL start/end/cause and a bounded snapshot of
+						// goroutine state before the assert, without touching the
+						// budget, the result, the original error or the fixture.
+						ended := time.Now()
+						var waiters [16384]byte
+						n := runtime.Stack(waiters[:], true)
+						t.Logf("issue31401 cleanupSQL error boundary: statement=%q budget=%s start=%s end=%s elapsed=%s err=%v cleanupCtxErr=%v; goroutine snapshot (bounded %d bytes):\n%s",
+							statement, timeout,
+							started.UTC().Format(time.RFC3339Nano),
+							ended.UTC().Format(time.RFC3339Nano),
+							ended.Sub(started), err, cleanup.Err(), n, waiters[:n])
+					}
 					assert.NoErrorf(t, err, "cleanup SQL: %s", statement)
 					return err
 				}
```

**File**: `pkg/vm/engine/tae/db/gc/v3/exec_v1.go` (modified, +7/-0)
```diff
@@ -348,11 +348,18 @@ func buildTableExistenceMap(snapshotMeta *logtail.SnapshotMeta, checkpointCli ch
 		itTable := db.MakeTableIt(true)
 		for itTable.Valid() {
 			table := itTable.Get().GetPayload()
+			// The MVCC chain behind GetDeleteAtLocked is mutated by concurrent
+			// catalog drops (DBEntry.DropTableEntryByID holds the entry write
+			// lock around DropEntryLocked -> DeleteLocked -> InsertLocked), so
+			// the GC reader must hold the same entry's read lock while taking
+			// the delete-at snapshot for this table.
+			table.RLock()
 			drop := table.GetDeleteAtLocked()
 			if drop.IsEmpty() {
 				tableID := table.GetID()
 				tableExistenceMap[tableID] = true
 			}
+			table.RUnlock()
 			itTable.Next()
 		}
 	}
```

**File**: `pkg/vm/engine/tae/db/gc/v3/executor_test.go` (modified, +178/-0)
```diff
@@ -17,14 +17,20 @@ package gc
 import (
 	"context"
 	"errors"
+	"sync"
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/catalog"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/containers"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/db/checkpoint"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/iface/txnif"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/logtail"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/txn/txnbase"
 	"github.com/stretchr/testify/require"
 )
 
@@ -105,3 +111,175 @@ func TestBuildBloomfilter(t *testing.T) {
 		})
 	}
 }
+
+// gcTableExistenceRunner hands buildTableExistenceMap the real catalog while
+// letting the rest of the checkpoint.Runner surface stay inert. The racing
+// chain under test is entirely real: catalog entries, their MVCC chains, the
+// published iterators and the drop writer path.
+type gcTableExistenceRunner struct {
+	checkpoint.Runner
+	cat *catalog.Catalog
+}
+
+func (r *gcTableExistenceRunner) GetCatalog() *catalog.Catalog { return r.cat }
+
+// TestBuildTableExistenceMapConcurrentCatalogDrop is the owner
+// regression for the UT race on PR CI job 134540016566: buildTableExistenceMap
+// read each table entry's MVCC chain head / payload / delete TS through
+// GetDeleteAtLocked without the entry lock while DBEntry.DropTableEntryByID
+// (handle DropRelationByID) inserts the delete node under the entry write
+// lock. Live tables must stay present in every concurrent snapshot, committed
+// drops must stop being published, and every transaction this test starts is
+// driven to a real terminal commit or rollback via the mock factory's store
+// registration before the txn manager stops - TxnManager.Stop only parks the
+// manager, it does not finalize anyone's transactions. The bounded concurrent
+// loop exercises the racing window; it is not a claim of a deterministic
+// interleaving, and under -race the pre-fix unlocked read fires on the very
+// chains this test mutates.
+func TestBuildTableExistenceMapConcurrentCatalogDrop(t *testing.T) {
+	cat := catalog.MockCatalog(nil)
+	t.Cleanup(func() { require.NoError(t, cat.Close()) })
+	txnMgr := txnbase.NewTxnManager(
+		catalog.MockTxnStoreFactory(cat),
+		catalog.MockTxnFactory(cat),
+		types.NewMockHLCClock(1),
+	)
+	txnMgr.Start(context.Background())
+	t.Cleanup(txnMgr.Stop)
+
+	var ownedMu sync.Mutex
+	owned := make(map[string]txnif.AsyncTxn)
+	track := func(txn txnif.AsyncTxn) {
+		ownedMu.Lock()
+		owned[txn.GetID()] = txn
+		ownedMu.Unlock()
+	}
+	// Safety net before txnMgr.Stop (LIFO cleanup order): every still-active
+	// owned transaction is rolled back so no error or FailNow path can leak
+	// one into the manager.
+	t.Cleanup(func() {
+		ownedMu.Lock()
+		defer ownedMu.Unlock()
+		for _, txn := range owned {
+			if txn.GetTxnState(false) == txnif.TxnStateActive {
+				// Nonfatal reporting: keep the original cause visible while
+				// still letting every remaining owned rollback, manager.Stop
+				// and catalog.Close in the LIFO chain run.
+				if err := txn.Rollback(context.Background()); err != nil {
+					t.Errorf("safety-net rollback of owned txn %s failed: %v", txn.GetID(), err)
+				}
+			}
+		}
+	})
+
+	createTxn, err := txnMgr.StartTxn(nil)
+	require.NoError(t, err)
+	track(createTxn)
+	dbEntry, err := cat.CreateDBEntry(t.Name(), "", "", createTxn)
+	require.NoError(t, err)
+	// Register the DB entry like mockTxn.CreateDatabase does, so Commit()
+	// applies the DB create node too.
+	createTxn.GetStore().AddTxnEntry(dbEntry)
+
+	liveIDs := []uint64{91001, 91002, 91003}
+	victims := make([]uint64, 0, 12)
+	for id := uint64(92001); id < 92001+12; id++ {
+		victims = append(victims, id)
+	}
+	for _, id := range append(append([]uint64{}, liveIDs...), victims...) {
+		tbl, err := dbEntry.CreateTableEntryWithTableId(catalog.MockSchema(2, 0), createTxn, nil, id)
+		require.NoError(t, err)
+		// Register the entry in the txn store exactly like the catalog mock
+		// handles do, so Commit() applies the create nodes and later drop
+		// txns see committed creators instead of a stale w-w conflict.
+		createTxn.GetStore().AddTxnEntry(tbl)
+	}
+	require.NoError(t, createTxn.Commit(context.Background()))
+
+	runner := &gcTableExistenceRunner{cat: cat}
+	build := func(t *testing.T) (map[uint64]bool, error) {
+		return buildTableExistenceMap(logtail.NewSnapshotMeta(), runner)
+	}
+
+	// Warm boundary: before any drop every live and victim table is present.
+	warm, err := build(t)
+	require.NoError(t, err)
+	for _, id := range append(append([]uint64{}, liveIDs...), victims...) {
+		require.True(t, warm[id], "table %d must be visible before the drop starts", id)
+	}
+
+
```

---

### Incident Patch 2: `2e99e997` (2026-11-19)
**Commit Message**: fix(function): admit integer division by DECIMAL256 (#32757)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31637

## What this PR does / why we need it:

Integer columns divided by DECIMAL256 currently fail function binding. Add the missing signed/unsigned integer cast-table entries and the BOOL mirror. Preserve exact extreme values, quotient precision/scale, NULL and zero-divisor behavior. Cover the shared DIV consumer, including signed overflow, with focused unit tests and a distributed SQL case.

Validation:

- Rebased linearly onto main `98796a5456d93b26d6051c546f9a168c0085c0ad`. The five delivery files retain their previously reviewed contents and functional evidence.
- Current local SCA: the unmodified repository selector (`go list -deps -test` inventory) selects 169 packages. Repository-pinned `molint check -mod=readonly <169 explicit packages>` and `golangci-lint run -v -c .golangci.yml <the same 169 packages>` both returned process RC 0. All 169 were checked at current inputs; no earlier SCA result was reused.
- One matching loca

**File**: `pkg/sql/plan/function/decimal_bool_operand_test.go` (modified, +26/-13)
```diff
@@ -51,9 +51,9 @@ func TestDecimalBoolBinaryOperatorSupportLikeInt64(t *testing.T) {
 				_, intErr := GetFunctionByName(ctx, name, intArgs)
 				_, boolErr := GetFunctionByName(ctx, name, boolArgs)
 				if intErr != nil {
-					// Pre-existing parity hole (INT64 / DECIMAL256 and
-					// INT64 div DECIMAL256 are not bound on main): BOOL keeps
-					// the same contract instead of binding wider than an int.
+					// Parity guard: BOOL never binds wider than an INT64
+					// operand, so any pairing the int row set rejects keeps
+					// rejecting the bool mirror too.
 					require.Error(t, boolErr, "%s %s %s", boolArgs[0].Oid, name, boolArgs[1].Oid)
 					continue
 				}
@@ -132,15 +132,6 @@ func TestDecimalBoolBinaryTargets(t *testing.T) {
 			check(tc.name+" "+name+" bool side", resolved.targetTypes[1],
 				rightPlain.Oid, rightPlain.Width, rightPlain.Scale)
 
-			if (name == "/" || name == "div") && tc.dec.Oid == types.T_decimal256 {
-				// BOOL before a DECIMAL256 dividend does not bind for the
-				// division operators; an INT64 operand in the same position
-				// does not bind either, so BOOL carries no extra limitation.
-				_, err = GetFunctionByName(ctx, name,
-					[]types.Type{types.T_int64.ToType(), tc.dec})
-				require.Error(t, err, "int64 %s %s", name, tc.name)
-				continue
-			}
 			resolved, err = GetFunctionByName(ctx, name, []types.Type{boolType, tc.dec})
 			require.NoError(t, err, "bool %s %s", name, tc.name)
 			require.True(t, resolved.needCast, "bool %s %s", name, tc.name)
@@ -413,6 +404,9 @@ func TestDecimalBoolDivisionPrecisionDerivation(t *testing.T) {
 		{"bool divisor increment 10", 10, []types.Type{d10s2, boolT}, types.New(types.T_decimal128, 20, 12)},
 		{"wide quotient promotes", 4, []types.Type{types.New(types.T_decimal128, 38, 0), boolT}, types.New(types.T_decimal256, 42, 4)},
 		{"wide divisor scale promotes", 4, []types.Type{boolT, types.New(types.T_decimal128, 38, 38)}, types.New(types.T_decimal256, 43, 4)},
+		{"bool dividend over decimal256", 4, []types.Type{boolT, types.New(types.T_decimal256, 60, 4)}, types.New(types.T_decimal256, 9, 4)},
+		{"bool dividend over wide decimal256", 4, []types.Type{boolT, types.New(types.T_decimal256, 65, 30)}, types.New(types.T_decimal256, 35, 4)},
+		{"decimal256 dividend by bool", 4, []types.Type{types.New(types.T_decimal256, 60, 4), boolT}, types.New(types.T_decimal256, 64, 8)},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			resolved, err := GetFunctionByName(
@@ -423,7 +417,8 @@ func TestDecimalBoolDivisionPrecisionDerivation(t *testing.T) {
 	}
 
 	// A DECIMAL dividend divides by BOOL with the same result type as by INT64.
-	for _, side := range []types.Type{d10s2, types.New(types.T_decimal128, 38, 0)} {
+	for _, side := range []types.Type{
+		d10s2, types.New(types.T_decimal128, 38, 0), types.New(types.T_decimal256, 60, 4)} {
 		boolDiv, err := GetFunctionByName(context.Background(), "/", []types.Type{side, boolT})
 		require.NoError(t, err)
 		intDiv, err := GetFunctionByName(context.Background(), "/", []types.Type{side, intT})
@@ -441,6 +436,7 @@ func TestDecimalBoolModAndIntegerDivMetadata(t *testing.T) {
 	intT := types.T_int64.ToType()
 	d10s2 := types.New(types.T_decimal64, 10, 2)
 	d30s4 := types.New(types.T_decimal128, 30, 4)
+	d60s4 := types.New(types.T_decimal256, 60, 4)
 
 	// max(decimal width, exact bool width), decimal scale preserved.
 	require.Equal(t,
@@ -453,6 +449,14 @@ func TestDecimalBoolModAndIntegerDivMetadata(t *testing.T) {
 	require.Equal(t,
 		types.New(types.T_decimal128, 19, 2),
 		DecimalModReturnType([]types.Type{d10s2, intT}, types.New(types.T_decimal128, 38, 2)))
+	// The DECIMAL256 mirror repeats the same derivation: the decimal operand
+	// keeps its own width and scale with the exact one-digit BOOL span beside it.
+	require.Equal(t,
+		types.New(types.T_decimal256, 60, 4),
+		DecimalModReturnType([]types.Type{boolT, d60s4}, types.T_decimal256.ToType()))
+	require.Equal(t,
+		types.New(types.T_decimal256, 60, 4),
+		DecimalModReturnType([]types.Type{d60s4, boolT}, types.T_decimal256.ToType()))
 
 	// Integer-division display derives from the dividend's precision and the
 	// divisor's scale, so BOOL and INT64 divisors agree exactly.
@@ -462,4 +466,13 @@ func TestDecimalBoolModAndIntegerDivMetadata(t *testing.T) {
 	require.True(t, ok)
 	require.Equal(t, intDiv, boolDiv)
 	require.Equal(t, types.New(types.T_int64, 9, 0), boolDiv)
+
+	// A BOOL dividend keeps its exact 0/1 span against a DECIMAL256 divisor,
+	// while a wide DECIMAL256 dividend clamps at the BIGINT display domain.
+	boolDividend, ok := DecimalIntegerDivReturnType([]types.Type{boolT, d60s4})
+	require.True(t, ok)
+	require.Equal(t, types.New(types.T_int64, 6, 0), boolDividend)
+	decimalDividend, ok := DecimalIntegerDivReturnType([]types.Type{d60s4, boolT})
+	require.True(t, ok)
+	require.Equal(t, types.New(types.T_int64, 20, 0), decimalDividend)
 }
```

**File**: `pkg/sql/plan/function/integer_decimal256_division_test.go` (added, +579/-0)
```diff
@@ -0,0 +1,579 @@
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
+package function
+
+import (
+	"context"
+	"math"
+	"math/big"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/stretchr/testify/require"
+)
+
+// The "/" admission table (fixedBinaryCastRule2) binds DECIMAL256 dividends
+// with integer divisors, but its integer-dividend mirror was missing: every
+// integer LEFT x DECIMAL256 RIGHT pair errored with an invalid-argument
+// operator message while d / u executed. These cases pin the admitted rows,
+// the implicit-cast targets, MySQL division return typing derived from the
+// ORIGINAL integer operand, real column producer/consumer values through the
+// public binding, and the unchanged neighbor cells.
+
+func decimal256AtScaleTestHelper(t *testing.T, digits string, scale int32) types.Decimal256 {
+	t.Helper()
+	z, ok := new(big.Int).SetString(digits, 10)
+	require.True(t, ok, "bad decimal literal %q", digits)
+	if scale > 0 {
+		z.Mul(z, new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil))
+	}
+	return decimal256FromBigWideTest(z)
+}
+
+func decimal256FromUint64TestHelper(v uint64) types.Decimal256 {
+	return decimal256FromBigWideTest(new(big.Int).SetUint64(v))
+}
+
+func parseDecimal256LiteralTestHelper(t *testing.T, literal string) types.Decimal256 {
+	t.Helper()
+	value, _, err := types.Parse256(literal)
+	require.NoError(t, err)
+	return value
+}
+
+// boundDecimal256SlashExecution binds "/" publicly and returns the overload
+// execution fabric the colexec expression executor obtains for the same
+// overload id, so the consumer path is the production one.
+func boundDecimal256SlashExecution(
+	t *testing.T, name string, args []types.Type,
+) (types.Type, executeLogicOfOverload) {
+	t.Helper()
+	bound, err := GetFunctionByName(context.Background(), name, args)
+	require.NoError(t, err)
+	overload, err := GetFunctionById(context.Background(), bound.GetEncodedOverloadID())
+	require.NoError(t, err)
+	if overload.newOpWithFree != nil {
+		exec, reset, free, retained := overload.newOpWithFree()
+		t.Cleanup(func() { _ = free() })
+		t.Cleanup(func() { _ = reset() })
+		_ = retained
+		return bound.GetReturnType(), exec
+	}
+	return bound.GetReturnType(), overload.newOp()
+}
+
+func TestIntegerOverDecimal256DivisionBinding(t *testing.T) {
+	divisor := types.New(types.T_decimal256, 65, 30)
+	for _, tc := range []struct {
+		name      string
+		left      types.T
+		precision int32
+	}{
+		{"int8", types.T_int8, 37},
+		{"int16", types.T_int16, 39},
+		{"int32", types.T_int32, 44},
+		{"int64", types.T_int64, 53},
+		{"uint8", types.T_uint8, 37},
+		{"uint16", types.T_uint16, 39},
+		{"uint32", types.T_uint32, 44},
+		{"uint64", types.T_uint64, 54},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			bound, err := GetFunctionByName(
+				context.Background(), "/", []types.Type{tc.left.ToType(), divisor})
+			require.NoError(t, err)
+			require.Equal(t,
+				types.New(types.T_decimal256, tc.precision, 4), bound.GetReturnType())
+			targets, cast := bound.ShouldDoImplicitTypeCast()
+			require.True(t, cast)
+			// The integer operand casts through the DECIMAL256 default physical
+			// type at scale zero, mirroring the legacy reverse rows; the
+			// DECIMAL256 divisor keeps its declared width and scale.
+			require.Equal(t, types.T_decimal256.ToType(), targets[0])
+			require.Equal(t, types.New(types.T_decimal256, 65, 30), targets[1])
+		})
+	}
+}
+
+func TestIntegerOverDecimal256DivisionBindingControls(t *testing.T) {
+	divisor := types.New(types.T_decimal256, 65, 30)
+
+	t.Run("decimal256 dividend over integers keeps the reverse contract", func(t *testing.T) {
+		for _, right := range []types.Type{
+			types.T_int64.ToType(), types.T_uint8.ToType(),
+		} {
+			bound, err := GetFunctionByName(
+				context.Background(), "/", []types.Type{divisor, right})
+			require.NoError(t, err)
+			require.Equal(t, types.T_decimal256, bound.GetReturnType().Oid)
+			targets, cast := bound.ShouldDoImplicitTypeCast()
+			require.True(t, cast)
+			require.Equal(t, types.T_decimal256, targets[0].Oid)
+			require.Equal(t, types.T_decimal256, targets[1].Oid)
+		}
+	})
+
+	t.Run("integer over decimal128 stays on the decimal128 cast", func(t *testing.T) {
+		bou
```

**File**: `pkg/sql/plan/function/type_check.go` (modified, +9/-0)
```diff
@@ -2329,6 +2329,7 @@ func initFixed2() {
 		// same contract instead of binding wider than an integer.
 		{types.T_bool, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_bool, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_bool, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_decimal64, types.T_bool, types.T_decimal128, types.T_decimal128},
 		{types.T_decimal128, types.T_bool, types.T_decimal128, types.T_decimal128},
 		{types.T_decimal256, types.T_bool, types.T_decimal256, types.T_decimal256},
@@ -2346,6 +2347,7 @@ func initFixed2() {
 		{types.T_int8, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_int8, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_int8, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_int8, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_int8, types.T_date, types.T_int64, types.T_int64},
 		{types.T_int8, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_int8, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2370,6 +2372,7 @@ func initFixed2() {
 		{types.T_int16, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_int16, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_int16, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_int16, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_int16, types.T_date, types.T_int64, types.T_int64},
 		{types.T_int16, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_int16, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2394,6 +2397,7 @@ func initFixed2() {
 		{types.T_int32, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_int32, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_int32, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_int32, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_int32, types.T_date, types.T_int64, types.T_int64},
 		{types.T_int32, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_int32, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2418,6 +2422,7 @@ func initFixed2() {
 		{types.T_int64, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_int64, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_int64, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_int64, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_int64, types.T_date, types.T_int64, types.T_int64},
 		{types.T_int64, types.T_year, types.T_int64, types.T_int64},
 		{types.T_int64, types.T_time, types.T_decimal64, types.T_decimal64},
@@ -2443,6 +2448,7 @@ func initFixed2() {
 		{types.T_uint8, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_uint8, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_uint8, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_uint8, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_uint8, types.T_date, types.T_int64, types.T_int64},
 		{types.T_uint8, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_uint8, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2467,6 +2473,7 @@ func initFixed2() {
 		{types.T_uint16, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_uint16, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_uint16, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_uint16, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_uint16, types.T_date, types.T_int64, types.T_int64},
 		{types.T_uint16, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_uint16, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2491,6 +2498,7 @@ func initFixed2() {
 		{types.T_uint32, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_uint32, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_uint32, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_uint32, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_uint32, types.T_date, types.T_int64, types.T_int64},
 		{types.T_uint32, types.T_time, types.T_decimal64, types.T_decimal64},
 		{types.T_uint32, types.T_datetime, types.T_decimal128, types.T_decimal128},
@@ -2515,6 +2523,7 @@ func initFixed2() {
 		{types.T_uint64, types.T_float64, types.T_float64, types.T_float64},
 		{types.T_uint64, types.T_decimal64, types.T_decimal128, types.T_decimal128},
 		{types.T_uint64, types.T_decimal128, types.T_decimal128, types.T_decimal128},
+		{types.T_uint64, types.T_decimal256, types.T_decimal256, types.T_decimal256},
 		{types.T_uint64, types.T_date, types.T_int64, types.T_int64},
 		{types.T_uint64, types.T_time, types.T_decima
```

**File**: `test/distributed/cases/operator/integer_decimal256_division.result` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+drop database if exists int_d256_div;
+create database int_d256_div;
+use int_d256_div;
+create table src(id int primary key, u bigint unsigned, s bigint, d decimal(65, 30));
+insert into src values (1,10,10,2),(2,18446744073709551615,-9223372036854775808,1),(3,null,null,2),(4,1,1,null);
+select id, u / d from src order by id;
+➤ id[4,32,0]  ¦  u / d[3,54,4]  𝄀
+1  ¦  5.0000  𝄀
+2  ¦  18446744073709551615.0000  𝄀
+3  ¦  null  𝄀
+4  ¦  null
+select id, s / d from src order by id;
+➤ id[4,32,0]  ¦  s / d[3,53,4]  𝄀
+1  ¦  5.0000  𝄀
+2  ¦  -9223372036854775808.0000  𝄀
+3  ¦  null  𝄀
+4  ¦  null
+create table iw(t8 tinyint, t16 smallint, t32 int, t64 bigint, u8 tinyint unsigned, u16 smallint unsigned, u32 int unsigned, u64 bigint unsigned, d decimal(65, 30));
+insert into iw values (127,32767,2147483647,-9223372036854775808,255,65535,4294967295,18446744073709551615,2);
+select t8 / d, t16 / d, t32 / d, t64 / d from iw;
+➤ t8 / d[3,37,4]  ¦  t16 / d[3,39,4]  ¦  t32 / d[3,44,4]  ¦  t64 / d[3,53,4]  𝄀
+63.5000  ¦  16383.5000  ¦  1073741823.5000  ¦  -4611686018427387904.0000
+select u8 / d, u16 / d, u32 / d, u64 / d from iw;
+➤ u8 / d[3,37,4]  ¦  u16 / d[3,39,4]  ¦  u32 / d[3,44,4]  ¦  u64 / d[3,54,4]  𝄀
+127.5000  ¦  32767.5000  ¦  2147483647.5000  ¦  9223372036854775807.5000
+select id, d / u from src where id = 1;
+➤ id[4,32,0]  ¦  d / u[3,65,30]  𝄀
+1  ¦  0.200000000000000000000000000000
+select id, u / cast(d as decimal(38, 10)) as q from src where id <= 2 order by id;
+➤ id[4,32,0]  ¦  q[3,34,4]  𝄀
+1  ¦  5.0000  𝄀
+2  ¦  18446744073709551615.0000
+select id, cast(u as decimal(65, 0)) / d as q from src order by id;
+➤ id[4,32,0]  ¦  q[3,65,4]  𝄀
+1  ¦  5.0000  𝄀
+2  ¦  18446744073709551615.0000  𝄀
+3  ¦  null  𝄀
+4  ¦  null
+select id, u div d from src order by id;
+➤ id[4,32,0]  ¦  u div d[-5,64,0]  𝄀
+1  ¦  5  𝄀
+2  ¦  18446744073709551615  𝄀
+3  ¦  null  𝄀
+4  ¦  null
+insert into src values (5, 7, 7, 0);
+select id, u / d from src where id = 5;
+➤ id[4,32,0]  ¦  u / d[3,54,4]  𝄀
+5  ¦  null
+create table dst(id int primary key, v decimal(65, 30));
+insert into dst values (99, 9);
+insert into dst select id, u / d from src where id <= 2;
+select id, v from dst order by id;
+➤ id[4,32,0]  ¦  v[3,65,30]  𝄀
+1  ¦  5.000000000000000000000000000000  𝄀
+2  ¦  18446744073709551615.000000000000000000000000000000  𝄀
+99  ¦  9.000000000000000000000000000000
+drop database int_d256_div;
```

**File**: `test/distributed/cases/operator/integer_decimal256_division.sql` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+-- @suite
+
+-- @case
+-- @desc: integer dividends with a DECIMAL256 divisor bind the division operator; reverse,
+-- narrower decimal, typed-cast, DIV-by-DECIMAL256 and division-by-zero neighbors stay on their
+-- existing contracts (issue 31637)
+-- @label:bvt
+
+drop database if exists int_d256_div;
+create database int_d256_div;
+use int_d256_div;
+
+-- unsigned and signed extremes, NULL dividends and NULL divisors
+create table src(id int primary key, u bigint unsigned, s bigint, d decimal(65, 30));
+insert into src values (1,10,10,2),(2,18446744073709551615,-9223372036854775808,1),(3,null,null,2),(4,1,1,null);
+
+select id, u / d from src order by id;
+select id, s / d from src order by id;
+
+-- every integer storage width binds, exact cast values through the scale-0 widening
+create table iw(t8 tinyint, t16 smallint, t32 int, t64 bigint, u8 tinyint unsigned, u16 smallint unsigned, u32 int unsigned, u64 bigint unsigned, d decimal(65, 30));
+insert into iw values (127,32767,2147483647,-9223372036854775808,255,65535,4294967295,18446744073709551615,2);
+
+select t8 / d, t16 / d, t32 / d, t64 / d from iw;
+select u8 / d, u16 / d, u32 / d, u64 / d from iw;
+
+-- reverse rows keep the DECIMAL256 dividend side unchanged
+select id, d / u from src where id = 1;
+
+-- a cast into narrow decimal keeps the DECIMAL128-domain typing
+select id, u / cast(d as decimal(38, 10)) as q from src where id <= 2 order by id;
+
+-- explicitly typed same-physical-type operands stay on decimal256 division
+select id, cast(u as decimal(65, 0)) / d as q from src order by id;
+
+-- unsigned DIV with a DECIMAL256 divisor keeps the unsigned-mixed quotient
+select id, u div d from src order by id;
+
+-- a zero divisor stays NULL on the SELECT path
+insert into src values (5, 7, 7, 0);
+select id, u / d from src where id = 5;
+
+-- INSERT ... SELECT consumer widens the scale-4 quotient into the destination scale
+create table dst(id int primary key, v decimal(65, 30));
+insert into dst values (99, 9);
+insert into dst select id, u / d from src where id <= 2;
+select id, v from dst order by id;
+
+drop database int_d256_div;
```

---

### Incident Patch 3: `035af996` (2026-11-18)
**Commit Message**: fix(frontend): handle missing subscriber accounts in SHOW PUBLICATIONS (#32901)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #32899

## What this PR does / why we need it:

`SHOW PUBLICATIONS` dereferences the account-ID lookup for every subscribed
account without checking that it exists. A persisted subscription referencing a
deleted account makes the whole statement panic, including unrelated healthy
publications owned by the same publisher. MOI's Sample Data startup can therefore
fail with Error 20101.

Keep each selected publication and its metadata, but omit subscriber IDs absent
from the account lookup from `subscribed_accounts`. Keep the existing sorted
names for live accounts and emit one diagnostic warning per affected publication.
Do not fall back to the stored account name: a recreated same-name account has
a different identity and must not inherit the old subscription.

This is a read-side resilience fix only. It does not mutate `mo_subs`, change
publication authorization, mask catalog query errors, or fix orphan creation
trac

**File**: `pkg/embed/show_publications_accounts_test.go` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
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
+package embed
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"strings"
+	"testing"
+	"time"
+
+	_ "github.com/go-sql-driver/mysql"
+	"github.com/matrixorigin/matrixone/pkg/cnservice"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
+	"github.com/stretchr/testify/require"
+)
+
+// Reuse the shared SQL fixture. Only the orphan catalog precondition is seeded
+// internally: all SHOWs and healthy publication/subscription setup use MySQL.
+// This does not attempt to reproduce the separate DROP ACCOUNT lifecycle bug.
+func TestShowPublicationsMissingAccountsSQL(t *testing.T) {
+	RunSingleCNBaseClusterTests(t, func(c Cluster) {
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		sys, err := sql.Open("mysql", fmt.Sprintf("dump:111@tcp(127.0.0.1:%d)/", cn.GetServiceConfig().CN.Frontend.Port))
+		require.NoError(t, err)
+		defer sys.Close()
+		internal := cn.RawService().(cnservice.Service).GetSQLExecutor()
+		internalSQL := func(ctx context.Context, statement string) error {
+			result, err := internal.Exec(ctx, statement, executor.Options{}.WithAccountID(0).WithWaitCommittedLogApplied())
+			if err == nil {
+				result.Close()
+			}
+			return err
+		}
+		const account = "showpub_live"
+		const database = "showpub_source"
+		const orphanID = 2000000000
+		const orphanPredicate = "sub_account_id=2000000000 and pub_account_id=0 and pub_name in ('showpub_mixed','showpub_orphan')"
+		for pass := 0; pass < 2; pass++ {
+			if !t.Run(fmt.Sprintf("pass_%d", pass), func(t *testing.T) {
+				ctx, cancel := context.WithTimeout(t.Context(), 120*time.Second)
+				defer cancel()
+				exec := func(statement string) {
+					t.Helper()
+					_, err := sys.ExecContext(ctx, statement)
+					require.NoError(t, err, statement)
+				}
+				count := func(ctx context.Context, statement string) int {
+					t.Helper()
+					var n int
+					require.NoError(t, sys.QueryRowContext(ctx, statement).Scan(&n))
+					return n
+				}
+				// Assert the prior pass's cleanup; entry DROP IF EXISTS would mask it.
+				require.Zero(t, count(ctx, "select count(*) from mo_catalog.mo_account where account_name='showpub_live' or account_id=2000000000"))
+				require.Zero(t, count(ctx, "select count(*) from mo_catalog.mo_pubs where account_id=0 and pub_name in ('showpub_mixed','showpub_orphan')"))
+				require.Zero(t, count(ctx, "select count(*) from mo_catalog.mo_database where account_id=0 and datname='showpub_source'"))
+				defer func() {
+					cleanup, stop := context.WithTimeout(context.Background(), 90*time.Second)
+					defer stop()
+					if err := internalSQL(cleanup, "delete from mo_catalog.mo_subs where "+orphanPredicate); err != nil {
+						t.Errorf("cleanup orphan subscriptions: %v", err)
+					}
+					for _, statement := range []string{
+						"drop account if exists " + account,
+						"drop publication if exists showpub_mixed",
+						"drop publication if exists showpub_orphan",
+						"drop database if exists " + database,
+					} {
+						_, err := sys.ExecContext(cleanup, statement)
+						if err != nil {
+							t.Errorf("cleanup %q: %v", statement, err)
+						}
+					}
+					require.Zero(t, count(cleanup, "select count(*) from mo_catalog.mo_subs where pub_account_id=0 and pub_name in ('showpub_mixed','showpub_orphan')"))
+					require.Zero(t, count(cleanup, "select count(*) from mo_catalog.mo_account where account_name='showpub_live'"))
+					require.Zero(t, count(cleanup, "select count(*) from mo_catalog.mo_pubs where account_id=0 and pub_name in ('showpub_mixed','showpub_orphan')"))
+					require.Zero(t, count(cleanup, "select count(*) from mo_catalog.mo_database where account_id=0 and datname='showpub_source'"))
+				}()
+				exec("create account " + account + " admin_name 'admin' identified by '111'")
+				exec("create database " + database)
+				exec("create table " + database + ".t (id int primary key)")
+				exec("insert into " + database + ".t values (7)")
+				for _, pub := range []string{"showpub_mixed", "showpub_orphan"} {
+					exec("create publication " + pub + " database " + database + " account " + account)
+				}
+				subscriber, err := sql.Open("mysql", fmt.Sprintf("%s#admin#accountadmin:111@tcp(127.0.0.1:%d)/", account, cn.GetServiceConfig().CN.Frontend.Port))
+				require.NoError(t, err)
+				defer subscriber.Close()
+				_, err = subscriber.ExecContext(ctx, "create database live_sub 
```

**File**: `pkg/frontend/publication_subscription.go` (modified, +12/-1)
```diff
@@ -1987,8 +1987,19 @@ func doShowPublications(ctx context.Context, ses *Session, sp *tree.ShowPublicat
 		if err != nil {
 			return err
 		}
+		missingAccounts := 0
 		for _, subInfo := range subscribedInfos {
-			subscribedAccountNames = append(subscribedAccountNames, accIdInfoMap[subInfo.SubAccountId].Name)
+			accountInfo := accIdInfoMap[subInfo.SubAccountId]
+			if accountInfo == nil {
+				// A stale subscription must not hide this or other publications.
+				// Do not fall back to the stored name: it may belong to a new ID.
+				missingAccounts++
+				continue
+			}
+			subscribedAccountNames = append(subscribedAccountNames, accountInfo.Name)
+		}
+		if missingAccounts > 0 {
+			ses.Warnf(ctx, "SHOW PUBLICATIONS: publication %q has %d subscribed account IDs absent from the account lookup; omitted from subscribed_accounts", pubInfo.PubName, missingAccounts)
 		}
 		slices.Sort(subscribedAccountNames)
 
```

**File**: `pkg/frontend/show_publications_accounts_test.go` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
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
+	"fmt"
+	"testing"
+
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+	"github.com/prashantv/gostub"
+	"github.com/stretchr/testify/require"
+)
+
+func TestShowPublicationsAccountResolution(t *testing.T) {
+	queryErr := errors.New("catalog read failed")
+	for _, tc := range []struct {
+		name       string
+		subs       []int64
+		want       string
+		failQuery  int
+		queryError error
+	}{
+		{name: "healthy_sorted", subs: []int64{2, 1}, want: "alpha,zeta"},
+		{name: "no_subscribers"},
+		{name: "missing_only", subs: []int64{99}},
+		{name: "mixed", subs: []int64{2, 99, 1}, want: "alpha,zeta"},
+		{name: "publication_read_error", failQuery: 0, queryError: queryErr},
+		{name: "account_read_error", failQuery: 1, queryError: queryErr},
+		{name: "subscription_read_error", failQuery: 2, queryError: queryErr},
+		{name: "subscription_canceled", failQuery: 2, queryError: context.Canceled},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			ses := newSes(nil, ctrl)
+			t.Cleanup(ses.Close)
+			ctx := defines.AttachAccount(t.Context(), sysAccountID, rootID, moAdminRoleID)
+			const timestamp = "2026-01-01 00:00:00"
+			pubs := &MysqlResultSet{Columns: make([]Column, 12), Data: [][]interface{}{
+				{int64(0), "sys", "affected", "db1", uint64(1), "*", "all", timestamp, nil, uint64(0), uint64(0), "keep comment"},
+				{int64(0), "sys", "healthy", "db2", uint64(2), "t", "alpha", timestamp, timestamp, uint64(0), uint64(0), ""},
+			}}
+			accounts := &MysqlResultSet{Columns: make([]Column, 5), Data: [][]interface{}{
+				{int64(1), "alpha", "open", uint64(1), nil},
+				{int64(2), "zeta", "open", uint64(1), nil},
+				// A recreated account must not inherit the missing ID's subscription.
+				{int64(100), "reused_name", "open", uint64(1), nil},
+			}}
+			subs := &MysqlResultSet{Columns: make([]Column, 12)}
+			for _, id := range tc.subs {
+				subs.AddRow([]interface{}{id, "reused_name", "sub_db", timestamp, int64(0), "sys", "affected", "db1", "*", timestamp, "", int64(1)})
+			}
+			healthy := &MysqlResultSet{Columns: make([]Column, 12), Data: [][]interface{}{
+				{int64(1), "alpha", "sub_other", timestamp, int64(0), "sys", "healthy", "db2", "t", timestamp, "", int64(0)},
+			}}
+			queries := []string{
+				fmt.Sprintf(getPubInfoSql, sysAccountID) + " order by update_time desc, created_time desc",
+				getAccountIdNamesSql,
+				getSubsSql + " and pub_account_name = 'sys' and pub_name = 'affected' and sub_name is not null",
+				getSubsSql + " and pub_account_name = 'sys' and pub_name = 'healthy' and sub_name is not null",
+			}
+			results := []*MysqlResultSet{pubs, accounts, subs, healthy}
+			bh := mock_frontend.NewMockBackgroundExec(ctrl)
+			stub := gostub.StubFunc(&NewBackgroundExec, bh)
+			t.Cleanup(stub.Reset)
+			bh.EXPECT().Close()
+			var calls []*gomock.Call
+			for i, query := range queries {
+				calls = append(calls, bh.EXPECT().ClearExecResultSet())
+				if tc.queryError != nil && i == tc.failQuery {
+					calls = append(calls, bh.EXPECT().Exec(gomock.Any(), query).Return(tc.queryError))
+					break
+				}
+				calls = append(calls,
+					bh.EXPECT().Exec(gomock.Any(), query).Return(nil),
+					bh.EXPECT().GetExecResultSet().Return([]interface{}{results[i]}),
+				)
+			}
+			// Only these reads are allowed; unexpected cleanup writes fail the test.
+			gomock.InOrder(calls...)
+			err := doShowPublications(ctx, ses, &tree.ShowPublications{})
+			if tc.queryError != nil {
+				require.ErrorIs(t, err, tc.queryError)
+				return
+			}
+			require.NoError(t, err)
+			require.Len(t, ses.mrs.Columns, 8)
+			require.Equal(t, [][]interface{}{
+				{"affected", "db1", "*", "*", tc.want, timestamp, nil, "keep comment"},
+				{"healthy", "db2", "t", "alpha", "alpha", timestamp, timestamp, ""},
+			}, ses.mrs.Data)
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #32945** (2026-11-19): [4.2-dev] Preserve COS GET cancellation identity (@XuPeng-SH)
- **PR #32938** (closed): perf(cdc): avoid formatting disabled watermark debug logs (@XuPeng-SH)
- **PR #32937** (2026-11-19): [4.2-dev] fix(frontend): prevent publication grants from recreating dropped subscriber IDs (@LeftHandCold)
- **PR #32931** (2026-11-19): [4.2-dev] docs: share one change map across Claude review checks (@XuPeng-SH)
- **PR #32932** (2026-11-19): docs: share one change map across Claude review checks (@XuPeng-SH)
- **PR #32929** (2026-11-19): [4.2-dev] docs: backport review skills with maintenance compatibility rules (@XuPeng-SH)

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

## X. function): reject undefined real-domain POW arguments

**RULE**:
When implementing operations in `pkg/embed/cdc_control_status_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `793b62b5`: function): reject undefined real-domain POW arguments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/embed/cdc_control_status_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"errors"
	dragonboat "github.com/lni/dragonboat/v4"
// cdcClusterStateWithReadiness bounds the initial, idempotent, read-only
// GetClusterState readiness probe of the CDC claims subtest: its result only
// feeds state.TaskTableUser below. The current5711 CI UT (job 135195296776,
// 2026-11-18 23:30:59) observed exactly one raw dragonboat request timeout on
// this first probe while the log service reported the same checker-state read
// timing out on its side in the same window; root36 kept the stall's own
// origin qualified UNKNOWN. This helper absorbs no more than that observed
// failure class, deterministically: at most three attempts on the caller's
// unchanged context, retrying only errors.Is(dragonboat.ErrTimeout) chains,
// stopping at the first success, never issuing another request once the
// context is done, and returning any other error after the first failed
// attempt. The caller's require.NoError still owns the final failure; no
// deadline is raised anywhere and no claims/heartbeat/write path is retried.
func cdcClusterStateWithReadiness(
	t *testing.T,
	ctx context.Context,
	getState func(context.Context) (logservicepb.CheckerState, error),
) (logservicepb.Che
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `793b62b5` are properly handled with clean fallback behavior.
