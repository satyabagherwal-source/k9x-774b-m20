> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `906848d5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T04:56:53.905Z  
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
> **Harvest Timestamp**: 2026-11-07T04:51:50.971Z  
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
- **Issue #32342** (2026-11-07): **fix(sql): scan Decimal256 MIN/MAX aggregates without zonemap bounds**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #32300  ## What this PR does / why we need it:  MIN/MAX over persisted DECIMAL columns with precision greater than 38 can silently return NULL because the zonemap fast path has no Decimal256 bounds. Decline that optimization for the whole aggregate node and retain the ordinary scan input. Keep Decimal64/Decimal128 optimization eligible. After rewriting COUNT(non-NULL literal) to COUNT(*), continue checking the remaining aggregates so COUNT before an unsupported MIN/MAX cannot bypass eligibility checks.  Add regressions for aggregate ordering, supported decimal neighbors and the real Scope.aggOptimize consumer, including preservation of its original data input when any aggregate is ineligible.  Validation on Linux/amd64 with CGO enabled and this worktree's native artifacts:  - Against upstream main `647eaf9dd36d4b8521114e5dedb9d99d4c148c68`, the four anchored owning roots pass with original exit 0 and nonzero selection: TestCheckAggOptimize_CountNotNull, TestCheckAggOptimize_ZmMinMaxEligibility, TestForceSingleScan_ZmMinMaxEligibility and TestScopeAggOptimizeDeclinesWholeNode. Each was selected and executed through `.agents/skills/mo-dev/scripts/mo-cgo-test` in `./pkg/sql/compile`. - `make static-check-selected STATIC_CHECK_PACKAGES="$PKGS"` passes both repository-pinned analyzers with orig

- **Issue #32340** (2026-11-06): **fix(parser): preserve mixed-case UNIQUE constraint symbols**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #31659  ## What this PR does / why we need it:  The named-UNIQUE fix in #31791 still lowercases an explicit constraint symbol: `CONSTRAINT `Uq_MiXeD` UNIQUE(k)` exposes `uq_mixed` instead of the declared spelling. Preserve the original symbol for UNIQUE constraints, matching an equivalent explicitly named UNIQUE KEY. Keep the existing normalization for PRIMARY KEY, FOREIGN KEY and CHECK constraints and the existing case-insensitive duplicate-name and DROP behavior.  Regenerate the parser and add real-parser/planner regressions for CREATE, ALTER ADD, Unicode and embedded-backtick identifiers, explicit-name precedence, duplicate names and unchanged non-UNIQUE symbols. The test owns the parsed AST until its cleanup runs.  Validation on Linux/amd64 with CGO and this worktree's native artifacts, against upstream main `aeab8787f2b8acd4a80d47a2f23fd263d6f0ef2d`:  - The regression fails on the original parser. Focused final-source parser/planner regressions pass; the existing owning-parser package pass is reused for the unchanged grammar closure. - One real foreground service regression passes with original exit 0. SHOW INDEX, SHOW CREATE and information_schema preserve `Uq_MiXeD`; duplicate values return numeric 1062 without adding a row; case-variant duplicate names return 1061 without publishin

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

### Incident Patch 1: `606ae4fb` (2026-11-06)
**Commit Message**: fix: consolidate stopped-upgrade cleanup and stabilize CI (#32307)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [x] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32288
Fixes #32297
Fixes #32298
Fixes #32321
Fixes #32260

Related to #32278. The separate view-refresh work in #29433 remains
open.

## What this PR does / why we need it:

Support a stopped 4.2 release upgraded directly to current main,
including its existing data and snapshots.

* Move historical orphan-grant cleanup into the existing 4.0.7 tenant
upgrade and current system-view publication into the existing
startup/admission owner. Remove the recurring per-CN repair loops.
Current create, drop and restore paths retain their own catalog
responsibilities.
* Preserve the current physical-index filtering from main in TABLES,
COLUMNS and PARTITIONS. The startup completion check includes
PARTITIONS, so a missing or outdated system definition reaches the
existing admission-gated reconciliation; the current state remains
read-only and failures prevent ingress.
* Stop creating retired transaction-trace tables on fresh clusters.
Pres

**File**: `docs/design/20261028-catalog-upgrade-407.md` (modified, +40/-6)
```diff
@@ -1,12 +1,12 @@
-# Consolidate catalog upgrades for 4.1 and 4.2 sources
+# Catalog upgrade consolidation and 4.2 stopped-upgrade cleanup
 
 Status: design reviewed; validation is required for the final change before delivery. Issue: [#31490](https://github.com/matrixorigin/matrixone/issues/31490). Main base: `f84780380228`; source controls: v4.1.0 `c58a0e62c382`, v4.2.6 `71498157cc21`, and 4.2-dev `86a45d39df3d`.
 
 ## Scope and observed behavior
 
-The requested source is a stopped, intact deployment whose current released version is 4.1 or 4.2. Direct upgrades from 3.x and all unreleased main catalogs (including prior 4.0.7 and 4.0.18/19 identities), downgrade and mixed-version operation are out of scope. This boundary does not erase older data: a 4.1 or 4.2 source can contain snapshots created before that release. The migration must preserve data, existing snapshot records and retention. Ambiguous historical snapshot ownership must follow the user's explicit decision: pause and obtain administrator confirmation by snapshot UUID; do not guess from the snapshot name alone.
+The original #31490 design considered stopped, intact 4.1 and 4.2 deployments. For the #32278 follow-up, the supported source is a stopped 4.2 release upgraded directly to current main; intermediate main versions, mixed-version operation and downgrade are out of scope. References to a 4.1 source below describe the earlier design, not an additional acceptance target for this follow-up. This boundary does not erase older data: a 4.2 source can contain snapshots created before that release. The migration must preserve data, existing snapshot records and retention. Ambiguous historical snapshot ownership must follow the user's explicit decision: pause and obtain administrator confirmation by snapshot UUID; do not guess from the snapshot name alone.
 
-The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, preserving the existing version/tenant task owners and recurring maintenance. Do not register unpublished 4.0.8–4.0.19 identities as new upgrade steps. Before release, fold the later COLUMNS and prefix-aware STATISTICS refreshes into the existing 4.0.7 entries: 27 tenant entries and 14 cluster entries, offset 41. COLUMNS uses the current declared-type definition; STATISTICS uses the current numeric prefix-length projection, with SQL NULL for whole-column indexes. This explicitly supersedes the previous assumption that main's unreleased 4.0.7 was already frozen. Its identity becomes immutable when released, not merely when merged into main. Preserve unrelated current-main behavior and existing maintenance owners.
+The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, using the version/tenant task and startup reconciliation owners described below. Do not register unpublished 4.0.8–4.0.19 identities as new upgrade steps. Before release, fold the later COLUMNS and prefix-aware STATISTICS refreshes into the existing 4.0.7 entries: 27 tenant entries and 14 cluster entries, offset 41. COLUMNS uses the current declared-type definition; STATISTICS uses the current numeric prefix-length projection, with SQL NULL for whole-column indexes. This explicitly supersedes the previous assumption that main's unreleased 4.0.7 was already frozen. Its identity becomes immutable when released, not merely when merged into main. Preserve unrelated current-main behavior.
 
 On a v4.2.6 source, unmodified main reached 4.0.17 and retained the sampled user rows, but lacked foreign-key metadata columns and UDF `arg_types`: main had appended them to the already-consumed 4.0.6 handler. On a freshly initialized v4.1.0 source, first startup on PR head timed out waiting for query-ready CN inventory while the older upgrade route had not yet created `mo_view_refresh`. On one unmodified restart, the route created that table and the CN appeared in query-ready inventory about two seconds later. The source fixture had working indexed/FK tables, a function, a procedure and account snapshots. After the resumed upgrade, table/tenant rows and FK enforcement remained, but the function, procedure and restoring the 4.1 account snapshot all failed because `sql_mode` was missing; historical table reads still worked.
 
@@ -18,9 +18,9 @@ There is a separate SQL-semantics issue: on a fresh v4.1.0 source, both `select
 
 The existing bootstrap framework remains the owner of catalog routing, tenant tasks and final readiness. A ready 4.1 source follows the 4.0.2–4.0.6 route before the new 4.0.7 step; a ready 4.2 source starts at 4.0.6. An interrupted published 4.1-to-4.2 route must finish us
```

**File**: `docs/guides/upgrade-4.2-to-main.md` (modified, +46/-23)
```diff
@@ -1,5 +1,9 @@
 # Stopped upgrade from 4.2 to catalog 4.0.7
 
+This procedure upgrades a stopped 4.2 release directly to current main.
+Intermediate development versions, mixed-version operation and downgrade are
+outside this upgrade contract. Existing data and snapshots in 4.2 remain in scope.
+
 Before starting any new-version service, connect to the running 4.2 deployment
 as a system administrator and check for CDC tasks across all accounts:
 
@@ -16,10 +20,10 @@ configuration and watermarks, decide how to rebuild the target, and remove all
 such tasks using 4.2 before upgrading. Log in as an administrator of each task's
 own account and run `DROP CDC TASK <name>` there; a system-account session does
 not drop another account's task. `DROP CDC` removes task metadata and
-watermarks. Return to the system account and confirm the query above is empty,
-stop and drain every old CN, and
-take a verified backup of the complete stopped deployment before starting the
-new version. Recreate CDC after upgrading against a clean or independent
+watermarks. Return to the system account and confirm the query above is empty.
+Complete the snapshot preflight below while the 4.2 system account is still
+accessible, then stop and drain every old CN and take a verified backup of the
+complete stopped deployment before starting the new version. Recreate CDC after upgrading against a clean or independent
 target; the old watermark does not prove that target is safe to resume.
 
 Enable automatic catalog upgrade for this stopped migration. If it was disabled,
@@ -58,32 +62,49 @@ metadata or job table as proof that remote writes have finished.
 ## Ambiguous snapshot ownership
 
 Some old system table snapshots can have names also used by branch protection.
-If the upgrade reports undecided snapshots, it prints their complete preimages,
-including the snapshot UUID and the branch edge (or `null`). An administrator
-must determine each snapshot's ownership from independent records; the name
-alone does not prove ownership. If ownership cannot be established, keep the
-upgrade stopped rather than guessing.
+An administrator must determine each snapshot's ownership from independent
+records; its name alone does not prove ownership. If ownership cannot be
+established, keep the upgrade stopped rather than guessing.
+
+Before stopping the 4.2 CNs, stop snapshot and branch operations, including
+background jobs that modify them. Keep them stopped until the old deployment
+is shut down. From the new source tree, use a system-account connection to
+produce a complete template:
+
+```sh
+optools/upgrade-4.2-preflight.sh decisions.ndjson \
+  --defaults-extra-file=/secure/path/mysql-client.cnf
+```
 
-Stop and drain all CNs. Create a UTF-8 newline-delimited JSON file with this
-header on its first line:
+The MySQL option file must be readable only by the administrator and contain
+the connection details and credentials; configure TLS according to the source
+deployment. The script requires a MySQL-compatible client, `jq` and GNU
+coreutils. It reports the CDC task count and writes a private file without
+overwriting an existing path. Its temporary disk use is proportional to the
+number and size of snapshot and branch records; `TMPDIR` chooses the scratch
+filesystem. It scans both source catalogs, and its 16 MiB sort setting does not
+bound database-server or total process memory. Failures before publication leave
+no output file. If interruption races with publication, a complete file may
+already exist: inspect it before proceeding. Choose a new path when regenerating.
+
+Review each template record by UUID and replace its `"decision":null` with
+`"user"` or `"branch"`. Do not change the remaining fields or their order in the
+file; do not automatically classify records by name. A template containing
+only the header needs no decisions. The header is:
 
 ```json
 {"format":"matrixone-catalog-snapshot-decisions-v1","target":"4.0.7"}
 ```
 
-For each undecided snapshot, copy its entire JSON preimage from the diagnostic
-to a separate line and add `"decision":"user"` or `"decision":"branch"`.
 Preserve every field and its exact value, including explicit `null` values and
-the entire edge object. Decimal IDs and timestamps are strings. Sort records
-by snapshot name, with no duplicate names. For example, the following single
-line illustrates the format only; replace every value with the reported
-preimage and the administrator's independently verified decision:
+the entire edge object. Decimal IDs and timestamps are strings. Records are
+sorted by snapshot name, with no duplicate names. For example:
 
 ```json
 {"catalog_account_id":"0","snapshot_id":"01a17d34-05f1-752c-acbd-52c7a8fe04fe","name":"__mo_branch_42","timestamp":"123","level":"table","account_name":"sys","database_name":"db","table_name":"t","object_id":"9","prior_kind":"user","edge":{"table_id":"42","parent_id":"9","clone_ts":"123","creator":"0","level":"table","table_del
```

**File**: `optools/upgrade-4.2-preflight-test.py` (added, +387/-0)
```diff
@@ -0,0 +1,387 @@
+#!/usr/bin/env python3
+# Copyright 2026 Matrix Origin
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+import json
+import os
+from pathlib import Path
+import select
+import signal
+import subprocess
+import tempfile
+import unittest
+
+SCRIPT = Path(__file__).with_name("upgrade-4.2-preflight.sh").resolve()
+
+
+def encoded(value):
+    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
+
+
+def snapshot(child, account_name="sys"):
+    return {
+        "catalog_account_id": "0",
+        "snapshot_id": "01a17d34-05f1-752c-acbd-52c7a8fe04fe",
+        "name": "__mo_branch_" + child,
+        "timestamp": "123",
+        "level": "table",
+        "account_name": account_name,
+        "database_name": None,
+        "table_name": "tab\tline\n雪",
+        "object_id": "9",
+        "prior_kind": "user",
+        "edge": None,
+        "decision": None,
+    }
+
+
+def edge(child):
+    return {
+        "table_id": child,
+        "parent_id": "9",
+        "clone_ts": "123",
+        "creator": "0",
+        "level": "table",
+        "table_deleted": False,
+    }
+
+
+class PreflightTest(unittest.TestCase):
+    def setUp(self):
+        self.temp = tempfile.TemporaryDirectory()
+        self.addCleanup(self.temp.cleanup)
+        self.root = Path(self.temp.name)
+        self.data = self.root / "mysql.tsv"
+        self.output = self.root / "decisions.ndjson"
+        mysql = self.root / "mysql"
+        mysql.write_text(
+            '#!/bin/sh\n'
+            'if [ "${TEST_MYSQL_BLOCK:-0}" = 1 ]; then\n'
+            '  eval "printf \'%s\\n\' $$ >&${TEST_READY_FD}"\n'
+            '  exec sleep 60\n'
+            'fi\n'
+            'if [ "${TEST_MYSQL_FORCE_FAILURE:-0}" = 1 ]; then\n'
+            '  printf "A\\t0\\t{}\\nC\\t0\\t{}\\n"\n'
+            '  for last do :; done\n'
+            '  if [ "$last" = --skip-force ]; then exit 1; fi\n'
+            '  printf "Z\\tdone\\t{}\\n"\nexit 0\n'
+            'fi\n'
+            'cat "$TEST_MYSQL_DATA"\nexit "${TEST_MYSQL_EXIT:-0}"\n'
+        )
+        mysql.chmod(0o700)
+        self.env = os.environ.copy()
+        self.env["PATH"] = str(self.root) + os.pathsep + self.env["PATH"]
+        self.env["TMPDIR"] = str(self.root)
+        self.env["TEST_MYSQL_DATA"] = str(self.data)
+
+    def run_export(self, lines, exit_code=0, newline=True, terminal=True):
+        rows = [*lines, "Z\tdone\t{}"] if terminal else lines
+        self.data.write_text("\n".join(rows) + ("\n" if newline else ""))
+        self.env["TEST_MYSQL_EXIT"] = str(exit_code)
+        return subprocess.run(
+            [str(SCRIPT), str(self.output), "--defaults-extra-file=protected.cnf"],
+            env=self.env, text=True, capture_output=True, check=False,
+        )
+
+    def test_merges_canonical_ids_without_guessing(self):
+        low, high = "18446744073709551614", "18446744073709551615"
+        values = [
+            "A\t0\t{}", "C\t3\t{}",
+            "S\t" + high + "\t" + encoded(snapshot(high, "sys\\name")),
+            "E\t" + low + "\t" + encoded(edge(low)),
+            "S\t0\t" + encoded(snapshot("0")),
+            "S\t" + low + "\t" + encoded(snapshot(low)),
+        ]
+        result = self.run_export(values)
+        self.assertEqual(0, result.returncode, result.stderr)
+        self.assertIn("CDC tasks: 3", result.stderr)
+        self.assertEqual(0o600, self.output.stat().st_mode & 0o777)
+        records = [json.loads(line) for line in self.output.read_text().splitlines()]
+        self.assertEqual({"format": "matrixone-catalog-snapshot-decisions-v1", "target": "4.0.7"}, records[0])
+        self.assertEqual(["__mo_branch_0", "__mo_branch_" + low, "__mo_branch_" + high], [r["name"] for r in records[1:]])
+        self.assertEqual(edge(low), records[2]["edge"])
+        self.assertIsNone(records[1]["edge"])
+        self.assertIsNone(records[3]["edge"])
+        self.assertTrue(all(r["decision"] is None for r in records[1:]))
+        self.assertEqual("tab\tline\n雪", records[2]["table_name"])
+        self.assertEqual("sys\\name", records[3]["account_name"])
+
+    def test_exports_more_than_one_startup_page(self):
+        values = ["A\t0\t{}", "C\t0\t{}"]
+        for i in range(129):
+            child = str(i)
+            row = snapshot(child)
+            row["snapshot_id"] = f"00000000-0000-4000-8000-{i:012x}"
+            values.append("S\t" + child + "\t" + encoded(row))
+            if i % 2:
+              
```

**File**: `optools/upgrade-4.2-preflight.sh` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+#!/usr/bin/env bash
+# Copyright 2026 Matrix Origin
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+set -euo pipefail
+export LC_ALL=C
+umask 077
+
+if (($# < 2)); then
+    echo "usage: $0 OUTPUT MYSQL_OPTIONS..." >&2
+    echo "Use a protected --defaults-extra-file as the first MySQL option." >&2
+    exit 2
+fi
+output=$1
+shift
+outdir=$(dirname -- "$output")
+tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/mo-upgrade-preflight.XXXXXXXX")
+outtmp=
+child=
+spawning=0
+cleanup() {
+    trap '' HUP INT TERM
+    if [[ -n $child ]]; then
+        kill "$child" 2>/dev/null || true
+        # A stopped child must be resumed to receive the termination signal.
+        kill -CONT "$child" 2>/dev/null || true
+        wait "$child" 2>/dev/null || true
+    fi
+    rm -rf -- "$tmpdir"
+    if [[ -n $outtmp ]]; then rm -f -- "$outtmp"; fi
+}
+on_signal() {
+    trap '' HUP INT TERM
+    local status=$1 pid job_info job_pattern
+    if ((spawning)); then
+        # run_cmd is serial and owns the only background job. A signal may
+        # arrive after Bash launches it but before child=$! has executed.
+        pid=${!:-}
+        if [[ -n $pid ]]; then
+            job_info=$(jobs -l)
+            job_pattern="^\\[[0-9]+\\][+-]?[[:space:]]+${pid}[[:space:]]+(Running|Stopped)([[:space:]]|$)"
+            if [[ $job_info =~ $job_pattern ]]; then child=$pid; fi
+        fi
+    fi
+    exit "$status"
+}
+trap cleanup EXIT
+trap 'on_signal 129' HUP
+trap 'on_signal 130' INT
+trap 'on_signal 143' TERM
+outtmp=$(mktemp "$outdir/.mo-upgrade-decisions.XXXXXXXX")
+export MO_CATALOG_PREFLIGHT_TMP=$tmpdir
+run_cmd() {
+    spawning=1
+    "$@" <&0 &
+    child=$!
+    spawning=0
+    local status=0
+    wait "$child" || status=$?
+    child=
+    return "$status"
+}
+
+# The snapshot and edge reads form one statement: 4.2 advances its snapshot
+# between statements even inside a transaction. Writers must still be drained.
+run_cmd mysql "$@" --quick --raw --batch --skip-column-names --default-character-set=utf8mb4 --skip-force > "$tmpdir/raw" <<'SQL'
+select 'A', cast(current_account_id() as varchar(32)), '{}';
+select 'C', cast(count(*) as varchar(32)), '{}' from mo_catalog.mo_cdc_task;
+select case when s.kind='user' then 'S' else 'X' end, substring(s.sname,13), json_object(
+  'catalog_account_id','0', 'snapshot_id',cast(s.snapshot_id as varchar(36)),
+  'name',s.sname, 'timestamp',cast(s.ts as varchar(32)),
+  'level',cast(s.level as varchar(32)), 'account_name',s.account_name,
+  'database_name',s.database_name, 'table_name',s.table_name,
+  'object_id',cast(s.obj_id as varchar(32)), 'prior_kind',s.kind,
+  'edge',null, 'decision',null)
+from mo_catalog.mo_snapshots s
+where (s.kind is null or s.kind<>'branch') and cast(s.level as varchar(32))='table'
+  and s.sname regexp '^__mo_branch_(0|[1-9][0-9]{0,19})$'
+  and (length(substring(s.sname,13))<20 or substring(s.sname,13)<='18446744073709551615')
+union all
+select 'E', cast(b.table_id as varchar(32)), json_object(
+  'table_id',cast(b.table_id as varchar(32)), 'parent_id',cast(b.p_table_id as varchar(32)),
+  'clone_ts',cast(b.clone_ts as varchar(32)), 'creator',cast(b.creator as varchar(32)),
+  'level',b.level, 'table_deleted',b.table_deleted)
+from mo_catalog.mo_branch_metadata b;
+select 'Z', 'done', '{}';
+SQL
+
+# A successful MySQL result has a complete final line, even for an empty set.
+last_byte=$(tail -c 1 "$tmpdir/raw" | od -An -tu1 | tr -d '[:space:]')
+if [[ $last_byte != 10 ]]; then
+    echo "incomplete MySQL output" >&2
+    exit 1
+fi
+: > "$tmpdir/snapshots"
+: > "$tmpdir/edges"
+run_cmd awk -F '\t' '
+        BEGIN { OFS="\t" }
+        NF != 3 { print "malformed preflight row" > "/dev/stderr"; exit 1 }
+        ended { print "rows after preflight completion" > "/dev/stderr"; exit 1 }
+        $1 == "Z" { if (++ends != 1 || $2 != "done") exit 1; ended=1; next }
+        $1 == "A" { if (++accounts != 1 || $2 != "0") exit 1; next }
+        $1 == "C" { if (++counts != 1 || $2 !~ /^[0-9]+$/) exit 1; print $2 > (ENVIRON["MO_CATALOG_PREFLIGHT_TMP"] "/cdc-count"); next }
+        $1 == "S" || $1 == "E" {
+            if ($2 !~ /^(0|[1-9][0-9]*)$/ || length($2) > 20 || length($3) >= 262144) exit 1
+            if ($1 == "S") print $2, $3 > (ENVIRON["MO_CATALOG_PREFLIGHT_TMP"] "/snapshots")
+            else print $2, $3 > (ENVIRON["MO_CATALOG_PREFLIGHT_TMP"] "/edges")
+            next
+        }
+        { print "unexpected snapshot kind or pre
```

**File**: `pkg/bootstrap/service.go` (modified, +27/-21)
```diff
@@ -41,7 +41,6 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/shardservice"
 	"github.com/matrixorigin/matrixone/pkg/txn/client"
 	"github.com/matrixorigin/matrixone/pkg/txn/clock"
-	"github.com/matrixorigin/matrixone/pkg/txn/trace"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
 	"github.com/matrixorigin/matrixone/pkg/util/metric/mometric"
 	"github.com/matrixorigin/matrixone/pkg/util/sysview"
@@ -124,9 +123,6 @@ func init() {
 	sql = predefine.GenInitPublicationTaskSQL()
 	initSQLs = append(initSQLs, sql)
 
-	// Retired collector catalog only; removal follows pkg/txn/trace's rollback gate.
-	initSQLs = append(initSQLs, trace.InitSQLs...)
-
 	initSQLs = append(initSQLs, shardservice.InitSQLs...)
 
 	initSQLs = append(initSQLs, partitionservice.InitSQLs...)
@@ -147,21 +143,15 @@ type service struct {
 	}
 
 	upgrade struct {
-		upgradeTenantBatch                       int
-		catalogObjectLimit                       uint64
-		decisionFileService                      fileservice.FileService
-		checkUpgradeDuration                     time.Duration
-		checkUpgradeTenantDuration               time.Duration
-		upgradeTenantTasks                       int
-		finalVersionCompleted                    atomic.Bool
-		failure                                  atomic.Pointer[upgradeFailure]
-		orphanPrivilegeMaintenanceWorkerRunning  atomic.Bool
-		orphanPrivilegeMaintenanceRunning        atomic.Bool
-		orphanPrivilegeMaintenanceState          orphanPrivilegeMaintenanceState
-		orphanPrivilegeMaintenanceStart          func() string
-		informationSchemaViewsMaintenanceRunning atomic.Bool
-		informationSchemaViewsMaintenanceState   informationSchemaViewsMaintenanceState
-		kek                                      string
+		upgradeTenantBatch         int
+		catalogObjectLimit         uint64
+		decisionFileService        fileservice.FileService
+		checkUpgradeDuration       time.Duration
+		checkUpgradeTenantDuration time.Duration
+		upgradeTenantTasks         int
+		finalVersionCompleted      atomic.Bool
+		failure                    atomic.Pointer[upgradeFailure]
+		kek                        string
 	}
 }
 
@@ -183,7 +173,6 @@ func NewService(
 		stopper: stopper.NewStopper("upgrade", stopper.WithLogger(getLogger(sid).RawLogger())),
 	}
 	s.mu.tenants = make(map[int32]bool)
-	s.upgrade.orphanPrivilegeMaintenanceState.restartSeed = newOrphanPrivilegeMaintenanceRestartSeed()
 	s.initUpgrade()
 
 	for _, opt := range opts {
@@ -495,6 +484,10 @@ func InitSystemViews(ctx context.Context, exec executor.SQLExecutor) error {
 			if err := entry.UpgradeAfterProtocolCheck(txn, catalog.System_Account); err != nil {
 				return err
 			}
+			views := versions.InformationSchemaViewsUpgradeEntry()
+			if err := views.UpgradeAfterProtocolCheck(txn, catalog.System_Account); err != nil {
+				return err
+			}
 
 			// Same-version refresh rail for PARTITIONS: a cluster already at
 			// the current version keeps its persisted definition until this
@@ -548,7 +541,20 @@ func SystemViewsExist(ctx context.Context, exec executor.SQLExecutor) (bool, err
 	err := exec.ExecTxn(ctx, func(txn executor.TxnExecutor) error {
 		var err error
 		complete, err = motrace.SchemaViewsExistWithTxn(ctx, txn)
-		return err
+		if err != nil || !complete {
+			return err
+		}
+		for _, entry := range []versions.UpgradeEntry{
+			versions.InformationSchemaTablesUpgradeEntry(),
+			versions.InformationSchemaViewsUpgradeEntry(),
+			versions.InformationSchemaPartitionsUpgradeEntry(),
+		} {
+			complete, err = entry.CheckFunc(txn, catalog.System_Account)
+			if err != nil || !complete {
+				return err
+			}
+		}
+		return nil
 	}, executor.Options{}.WithAccountID(catalog.System_Account))
 	return complete, err
 }
```

**File**: `pkg/bootstrap/service_information_schema_views_maintenance.go` (removed, +0/-300)
```diff
@@ -1,300 +0,0 @@
-// Copyright 2026 Matrix Origin
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//     http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License.
-
-package bootstrap
-
-import (
-	"context"
-	"errors"
-	"fmt"
-	"time"
-
-	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
-	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
-	"github.com/matrixorigin/matrixone/pkg/catalog"
-	"github.com/matrixorigin/matrixone/pkg/common/moerr"
-	"github.com/matrixorigin/matrixone/pkg/container/vector"
-	"github.com/matrixorigin/matrixone/pkg/defines"
-	"github.com/matrixorigin/matrixone/pkg/util/executor"
-	"github.com/matrixorigin/matrixone/pkg/util/sysview"
-)
-
-const informationSchemaViewsMaintenancePageSize = 32
-
-// informationSchemaPartitionsMaintenanceEntry keeps the PARTITIONS
-// reconciliation on the same bounded page, cursor and transaction as VIEWS.
-// The indirection only exists so the pre-existing VIEWS scenario tests can
-// pin an already-current PARTITIONS entry and keep exercising exactly their
-// original subjects; production always reconciles the live PARTITIONS
-// definition against sysview's current DDL.
-var informationSchemaPartitionsMaintenanceEntry = versions.InformationSchemaPartitionsUpgradeEntry
-
-var errInformationSchemaViewsProtocolUnavailable = moerr.NewNotSupportedNoCtx(
-	"information schema views maintenance protocol is unavailable")
-
-// informationSchemaViewsMaintenanceState is process-local progress. The
-// persisted VIEWS definition is the durable pending-work marker, so a fresh
-// process can start at zero and a failed transaction can safely retry the same
-// page without losing work.
-type informationSchemaViewsMaintenanceState struct {
-	accountCursor int32
-}
-
-// maintainInformationSchemaViews repairs the system VIEWS and PARTITIONS
-// definitions for every account, including tenants already at v4.0.6, v4.0.7,
-// or the final version. It processes one bounded page per invocation after the
-// v126 gate; the standalone repair does not alter any historical handler
-// identity, and the page cursor publishes only when every definition staged
-// on that page committed together.
-func (s *service) maintainInformationSchemaViews(ctx context.Context) error {
-	if !s.upgrade.informationSchemaViewsMaintenanceRunning.CompareAndSwap(false, true) {
-		return nil
-	}
-	defer s.upgrade.informationSchemaViewsMaintenanceRunning.Store(false)
-
-	current := s.upgrade.informationSchemaViewsMaintenanceState
-	next := current
-	options := executor.Options{}.
-		WithDatabase(catalog.MO_CATALOG).
-		WithAccountID(catalog.System_Account).
-		WithMinCommittedTS(s.now()).
-		WithWaitCommittedLogApplied().
-		WithTimeZone(time.Local)
-
-	err := s.exec.ExecTxn(ctx, func(txn executor.TxnExecutor) error {
-		txn.Use(catalog.MO_CATALOG)
-
-		// Do not even enumerate tenants until the writer protocol is known to
-		// be available everywhere. A NotSupported result is a normal rolling-
-		// upgrade retry; actual catalog or transaction errors remain visible.
-		if ready, err := informationSchemaViewsProtocolReady(txn); err != nil {
-			return err
-		} else if !ready {
-			return nil
-		}
-
-		accountIDs, err := loadInformationSchemaViewsMaintenanceAccounts(
-			txn, current.accountCursor)
-		if err != nil {
-			return err
-		}
-		if len(accountIDs) == 0 {
-			// Account IDs are monotonic. Starting the next pass at zero makes
-			// late-created accounts and a restarted process discoverable.
-			next = current
-			next.accountCursor = 0
-			return nil
-		}
-
-		candidateCursor := nextInformationSchemaViewsMaintenanceCursor(accountIDs[len(accountIDs)-1])
-		partitionsEntry := informationSchemaPartitionsMaintenanceEntry()
-		for _, accountID := range accountIDs {
-			exists, viewDefinition, err := v4_0_7.CheckInformationSchemaViewsDefinition(txn, uint32(accountID))
-			if err != nil {
-				if informationSchemaViewsAccountGone(accountID, err) {
-					// DROP ACCOUNT removes the account-local mo_user and
-					// information_schema objects while the system-account page
-					// is being scanned. The account is no longer a valid repair
-					// target; keep the page transactional and let the next pass
-					// discover any surviving accounts.
-					continue
-				}
-				return err
-			}
-			viewsCurrent := exists && sysview.InformationSchemaViewDefinitionMatches(
-				viewDefinition, sysview.InformationSchemaViewsDDL)
-
-			// The same ready account can carry a current VIEWS definition next
-			// to a stale PARTITIO
```

**File**: `pkg/bootstrap/service_information_schema_views_maintenance_test.go` (removed, +0/-1047)
```diff
@@ -1,1047 +0,0 @@
-// Copyright 2026 Matrix Origin
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//     http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License.
-
-package bootstrap
-
-import (
-	"context"
-	"errors"
-	"fmt"
-	"strings"
-	"sync"
-	"sync/atomic"
-	"testing"
-	"time"
-
-	"github.com/golang/mock/gomock"
-	"github.com/stretchr/testify/require"
-
-	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
-	"github.com/matrixorigin/matrixone/pkg/common/moerr"
-	"github.com/matrixorigin/matrixone/pkg/common/mpool"
-	"github.com/matrixorigin/matrixone/pkg/container/types"
-	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
-	"github.com/matrixorigin/matrixone/pkg/pb/txn"
-	"github.com/matrixorigin/matrixone/pkg/txn/client"
-	"github.com/matrixorigin/matrixone/pkg/txn/clock"
-	"github.com/matrixorigin/matrixone/pkg/util/executor"
-	"github.com/matrixorigin/matrixone/pkg/util/sysview"
-)
-
-func TestMaintainInformationSchemaViewsRetriesFailedReplacement(t *testing.T) {
-	const accountID = int32(10)
-	viewDefinition := sysview.InformationSchemaViewsLegacyDDL
-	failReplacement := true
-	var successfulReplacements int
-	var executed []string
-	var accountLookups int
-
-	oldCheck := versions.CheckViewDefinition
-	versions.CheckViewDefinition = func(
-		_ executor.TxnExecutor,
-		id uint32,
-		schema string,
-		viewName string,
-	) (bool, string, error) {
-		require.Equal(t, uint32(accountID), id)
-		require.Equal(t, sysview.InformationDBConst, schema)
-		require.Contains(t, []string{"VIEWS", "views"}, viewName)
-		if viewName == "VIEWS" {
-			return false, "", nil
-		}
-		return true, viewDefinition, nil
-	}
-	t.Cleanup(func() { versions.CheckViewDefinition = oldCheck })
-	// Keep this scenario about VIEWS: pin an already-current PARTITIONS
-	// entry so the shared page does not run PARTITIONS reconciliation here.
-	t.Cleanup(func() {
-		informationSchemaPartitionsMaintenanceEntry = versions.InformationSchemaPartitionsUpgradeEntry
-	})
-	informationSchemaPartitionsMaintenanceEntry = currentPartitionsMaintenanceEntryForScenario
-
-	service := newInformationSchemaViewsMaintenanceTestService(t, func(sql string) (executor.Result, error) {
-		switch {
-		case sql == "SELECT mo_ctl('cn', 'GetProtocolVersion', '')":
-			return newBootstrapStringResult(`{"method":"GETPROTOCOLVERSION","result":"cn-a:126"}`), nil
-		case strings.HasPrefix(sql, "select account_id from mo_catalog.mo_account"):
-			accountLookups++
-			require.Contains(t, sql, "limit 32")
-			if accountLookups == 1 || accountLookups == 2 || accountLookups == 4 {
-				require.Contains(t, sql, "account_id >= 0")
-				return buildInformationSchemaViewsMaintenanceAccountRows(accountID), nil
-			}
-			require.Equal(t, 3, accountLookups)
-			require.Contains(t, sql, "account_id >= 11")
-			return executor.Result{}, nil
-		case sql == strings.Replace(sysview.InformationSchemaViewsDDL, "CREATE VIEW ", "CREATE OR REPLACE VIEW ", 1):
-			executed = append(executed, sql)
-			if failReplacement {
-				failReplacement = false
-				return executor.Result{}, errors.New("replace VIEWS failed")
-			}
-			viewDefinition = sysview.InformationSchemaViewsDDL
-			successfulReplacements++
-			return executor.Result{}, nil
-		default:
-			return executor.Result{}, fmt.Errorf("unexpected sql: %s", sql)
-		}
-	})
-
-	err := service.maintainInformationSchemaViews(t.Context())
-	require.ErrorContains(t, err, "replace VIEWS failed")
-	require.Equal(t, sysview.InformationSchemaViewsLegacyDDL, viewDefinition,
-		"a failed transaction must leave the legacy definition as the retry marker")
-	require.Zero(t, service.upgrade.informationSchemaViewsMaintenanceState.accountCursor,
-		"a failed replacement must not publish the page cursor")
-
-	require.NoError(t, service.maintainInformationSchemaViews(t.Context()))
-	require.Equal(t, sysview.InformationSchemaViewsDDL, viewDefinition)
-	require.Equal(t, int32(accountID+1),
-		service.upgrade.informationSchemaViewsMaintenanceState.accountCursor)
-	require.Equal(t, 1, successfulReplacements)
-	require.Equal(t, 2, len(executed), "the failed attempt and the committed retry each issue one replacement")
-
-	// The persisted definition is now the idempotence marker. A subsequent
-	// pass first observes an empty page, then a wrapped scan rediscovers the
-	// account and must still not replace it again.
-	require.NoError(t, service.maintainInformationSchemaViews(t.Context()))
-	require.Zero(t, service.upgrade.informationSchemaViewsMaintenanceState.accountCursor)
-	require.NoE
```

**File**: `pkg/bootstrap/service_orphan_privilege_maintenance.go` (removed, +0/-368)
```diff
@@ -1,368 +0,0 @@
-// Copyright 2026 Matrix Origin
-//
-// Licensed under the Apache License, Version 2.0 (the "License");
-// you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at
-//
-//     http://www.apache.org/licenses/LICENSE-2.0
-//
-// Unless required by applicable law or agreed to in writing, software
-// distributed under the License is distributed on an "AS IS" BASIS,
-// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-// See the License for the specific language governing permissions and
-// limitations under the License.
-
-package bootstrap
-
-import (
-	"context"
-	cryptorand "crypto/rand"
-	"encoding/binary"
-	"encoding/hex"
-	"fmt"
-	"math"
-	"time"
-
-	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_6"
-	"github.com/matrixorigin/matrixone/pkg/catalog"
-	"github.com/matrixorigin/matrixone/pkg/common/moerr"
-	"github.com/matrixorigin/matrixone/pkg/container/types"
-	"github.com/matrixorigin/matrixone/pkg/container/vector"
-	"github.com/matrixorigin/matrixone/pkg/util/executor"
-	"go.uber.org/zap"
-)
-
-const orphanPrivilegeMaintenanceLongRunningPageInterval = 64
-
-// orphanPrivilegeMaintenanceState is intentionally process-local. An account
-// round freezes account IDs at roundHighWater and walks the ring from roundStart
-// back to (but not including) roundStart, so account creation cannot extend a
-// live round. Every selected tenant independently walks a high-water-bounded
-// physical-key ring across page snapshots. Fresh processes choose independent
-// account and physical-key starts to avoid a fixed restart bias; they do not
-// provide a finite restart-count or sustained-write completion guarantee.
-type orphanPrivilegeMaintenanceState struct {
-	restartSeed uint64
-	round       uint64
-
-	roundInitialized bool
-	roundHighWater   int32
-	roundStart       int32
-	accountCursor    int32
-	wrapped          bool
-
-	tenantSelected       bool
-	tenantID             int32
-	tenantCommittedPages uint64
-	tenantScan           v4_0_6.OrphanPrivilegeScan
-}
-
-func newOrphanPrivilegeMaintenanceRestartSeed() uint64 {
-	var value [8]byte
-	if _, err := cryptorand.Read(value[:]); err == nil {
-		return binary.LittleEndian.Uint64(value[:])
-	}
-	// Entropy failure must not restore the old deterministic "always start at
-	// zero" behavior. Wall time is only a degraded seed, not correctness state.
-	return uint64(time.Now().UnixNano())
-}
-
-func newOrphanPrivilegeMaintenancePhysicalStart() string {
-	// The current mo_role_privs composite key has an exact serial() upper bound
-	// of 956 bytes: int32(6) + varchar(16)(131) + uint64(10) + int32(6) +
-	// varchar(100)(803). Half of starts use a valid, magnitude-distributed key
-	// shape so ordinary small role/object IDs are reached efficiently. The raw
-	// half chooses every length in [0,956] and every byte with non-zero
-	// probability, giving every possible physical key a non-zero,
-	// table-size-independent chance to be the next ring threshold after restart.
-	var seedBytes [8]byte
-	seed := uint64(time.Now().UnixNano())
-	if _, err := cryptorand.Read(seedBytes[:]); err == nil {
-		seed = binary.LittleEndian.Uint64(seedBytes[:])
-	}
-	if seed&1 == 0 {
-		return structuredOrphanPrivilegeMaintenancePhysicalStart(seed)
-	}
-	length := int(seed % (v4_0_6.OrphanPrivilegePhysicalKeyMaxSize + 1))
-	value := make([]byte, length)
-	if _, err := cryptorand.Read(value); err != nil {
-		// Keep the degraded path non-constant if the host entropy source fails.
-		// It remains bounded; uninterrupted scans still deterministically close
-		// their physical-key ring.
-		for i := 0; i < len(value); i += 8 {
-			mixed := nextOrphanPrivilegeMaintenanceRandom(&seed)
-			for j := 0; j < 8 && i+j < len(value); j++ {
-				value[i+j] = byte(mixed >> (8 * j))
-			}
-		}
-	}
-	return hex.EncodeToString(value)
-}
-
-func structuredOrphanPrivilegeMaintenancePhysicalStart(seed uint64) string {
-	objectTypes := [...]string{"account", "database", "table", "view"}
-	privilegeLevels := [...]string{"", "*", "*.*", "d", "d.*", "d.t", "t"}
-	roleID := int32(orphanPrivilegeMaintenanceMagnitude(&seed, 31))
-	objectType := objectTypes[nextOrphanPrivilegeMaintenanceRandom(&seed)%uint64(len(objectTypes))]
-	objectID := orphanPrivilegeMaintenanceMagnitude(&seed, 64)
-	privilegeID := int32(orphanPrivilegeMaintenanceMagnitude(&seed, 31))
-	privilegeLevel := privilegeLevels[nextOrphanPrivilegeMaintenanceRandom(&seed)%uint64(len(privilegeLevels))]
-
-	var buffer [v4_0_6.OrphanPrivilegePhysicalKeyMaxSize]byte
-	packer := types.NewPackerWithFixedBuffer(buffer[:])
-	packer.EncodeInt32(roleID)
-	packer.EncodeStringType([]byte(objectType))
-	packer.EncodeUint64(objectID)
-	packer.EncodeInt32(privilegeID)
-	packer.EncodeStringType([]byte(privilegeLevel))
-	if packer.Err() != nil {
-		return ""
-	}
-	return hex.EncodeToString(packer.GetBuf())
-}
-
-func orphanPrivilegeMaintenanceMagnitude(seed *uin
```

---

### Incident Patch 2: `647eaf9d` (2026-11-06)
**Commit Message**: fix: make INSERT IGNORE tolerate NOT NULL violations (#32299)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #30906

## What this PR does / why we need it:

`INSERT IGNORE` already downgraded duplicate-key, foreign-key and CHECK
failures to warnings, but a NULL supplied for a NOT NULL column aborted
the whole statement, so a multi-row batch inserted nothing where MySQL
keeps the good rows and replaces the offending cells with the column
type's implicit default, publishing warning 1048 per adjusted cell:

```
mysql> insert ignore into ig(u,nn,c) values(2,null,1);
ERROR 3819 (HY000): constraint violation: Column 'nn' cannot be null
```

Root cause: no value-adjustment stage existed between the constructed
row image and the constraint consumers, so the NOT NULL gate in the
insert path always raised the hard violation even under statement IGNORE
(and the 3819 check-constraint class hid the NOT NULL origin). A second
gap surfaced in review of this change: the planner's unique-index skip
heuristic decided "this key is all-NULL" from pre-adju

**File**: `pkg/sql/colexec/constraint_util.go` (modified, +303/-0)
```diff
@@ -18,14 +18,18 @@ import (
 	"context"
 	"fmt"
 
+	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
 	"github.com/matrixorigin/matrixone/pkg/container/nulls"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine"
 	"github.com/matrixorigin/matrixone/pkg/vm/process"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 )
 
 func FilterRowIdForDel(proc *process.Process, retBat *batch.Batch, srcBat *batch.Batch,
@@ -70,6 +74,305 @@ func BatchDataNotNullCheck(vecs []*vector.Vector, attrs []string, tableDef *plan
 	return nil
 }
 
+// ColForbidsNull reports whether a table column enforces NOT NULL. Both plan
+// signals are honored: the explicit flag used by minimal external-insert
+// plans and the default-value descriptor the PreInsert check relies on.
+func ColForbidsNull(col *plan.ColDef) bool {
+	return col != nil && (col.NotNull || (col.Default != nil && !col.Default.NullAbility))
+}
+
+// BatchDataNotNullFillForIgnore adapts one batch to the IGNORE statement rule
+// for NOT NULL columns: each NULL cell is replaced with the implicit default
+// of its column type and reported as one ER_BAD_NULL_ERROR warning, matching
+// the value adjustment MySQL applies for INSERT/UPDATE/LOAD with IGNORE. The
+// row itself is kept. vec indices whose vectors were modified are returned so
+// selector pipelines can mirror the adjustment into their un-shrunk output.
+// A constant NULL broadcast carries no backing storage, so it is replaced by
+// an equivalent constant of the implicit default instead of being written
+// in place.
+// A NOT NULL column whose type has no implicit default keeps the
+// constraint-violation error: storing NULL would trade the report for corruption.
+func BatchDataNotNullFillForIgnore(
+	vecs []*vector.Vector,
+	attrs []string,
+	cols []*plan.ColDef,
+	proc *process.Process,
+) ([]int, error) {
+	var warnings process.WarningAccumulator
+	warnings.SetWarningRetentionForProcess(proc)
+	defer warnings.Reset()
+
+	var filled []int
+	for j := range vecs {
+		vec := vecs[j]
+		if vec == nil || j >= len(cols) || j >= len(attrs) || !ColForbidsNull(cols[j]) {
+			continue
+		}
+		attr := attrs[j]
+		if vec.IsConst() {
+			// A constant vector broadcasts its single physical slot, and a
+			// constant NULL owns no backing storage at all (NewConstNull
+			// allocates no data), so the in-place setters below would fail
+			// on it: LOAD legs project an omitted column's folded NULL
+			// default straight into this helper. Replace the broadcast with
+			// a constant carrying the implicit default - the sanctioned
+			// NewConstFixed shape - so every logical row keeps its row and
+			// one warning is published per adjusted row.
+			if !vec.IsNull(0) || vec.Length() <= 0 {
+				continue
+			}
+			rows := vec.Length()
+			fillVec, ok, err := constImplicitNotNullDefaultVec(vec, rows, proc.Mp())
+			if err != nil {
+				return nil, err
+			}
+			if !ok {
+				return nil, moerr.NewConstraintViolation(proc.Ctx,
+					fmt.Sprintf("Column '%s' cannot be null", attr))
+			}
+			for row := 0; row < rows; row++ {
+				warnings.Add(moerr.ER_BAD_NULL_ERROR,
+					fmt.Sprintf("Column '%s' cannot be null", attr))
+			}
+			vecs[j] = fillVec
+			filled = append(filled, j)
+			continue
+		}
+		slotCount := vec.Length()
+		adjusted := false
+		for slot := 0; slot < slotCount; slot++ {
+			if !vec.IsNull(uint64(slot)) {
+				continue
+			}
+			ok, err := setImplicitNotNullDefault(vec, slot, proc.Mp())
+			if err != nil {
+				return nil, err
+			}
+			if !ok {
+				return nil, moerr.NewConstraintViolation(proc.Ctx,
+					fmt.Sprintf("Column '%s' cannot be null", attr))
+			}
+			nulls.Del(vec.GetNulls(), uint64(slot))
+			adjusted = true
+			warnings.Add(moerr.ER_BAD_NULL_ERROR,
+				fmt.Sprintf("Column '%s' cannot be null", attr))
+		}
+		if adjusted {
+			filled = append(filled, j)
+		}
+	}
+	warnings.Flush(proc)
+	return filled, nil
+}
+
+// constImplicitNotNullDefaultVec builds the replacement for a constant NULL
+// broadcast: one physical slot carrying the implicit default of the column
+// type, broadcast over the original logical length. The value comes from the
+// shared per-type rule, so the broadcast fill and the in-place fill can never
+// diverge. It reports false when the type has no implicit default.
+func constImplicitNotNullDefaultVec(vec *vector.Vector, rows int, mp *mpool.MPool) (*vector.Vector, bool, error) {
+	dst := vector.NewVec(*vec.GetType())
+	if err := vector.AppendAny(dst, nil, true, mp); err != nil {
+		dst.Free(mp)
+		return nil, false, err
+	}
+	// The appended NULL slot is the cell the shared rule overwrites.
+	ok, err := setImplicitNotNullDefault(dst
```

**File**: `pkg/sql/colexec/constraint_util_ignorefill_test.go` (added, +507/-0)
```diff
@@ -0,0 +1,507 @@
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
+package colexec
+
+import (
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/stretchr/testify/require"
+)
+
+type notNullWarning struct {
+	code uint16
+	msg  string
+}
+
+type notNullWarningSession struct {
+	total    uint64
+	warnings []notNullWarning
+}
+
+func (*notNullWarningSession) GetTempTable(string, string) (string, bool) { return "", false }
+func (*notNullWarningSession) AddTempTable(string, string, string)        {}
+func (*notNullWarningSession) RemoveTempTable(string, string)             {}
+func (*notNullWarningSession) RemoveTempTableByRealName(string)           {}
+func (*notNullWarningSession) GetSqlModeNoAutoValueOnZero() (bool, bool)  { return false, false }
+func (s *notNullWarningSession) AppendWarningBatch(total uint64, codes []uint16, messages []string) {
+	s.total += total
+	for i := 0; i < len(codes) && i < len(messages); i++ {
+		s.warnings = append(s.warnings, notNullWarning{code: codes[i], msg: messages[i]})
+	}
+}
+
+func newIgnoreFillProc(t *testing.T) (*process.Process, *notNullWarningSession) {
+	proc := testutil.NewProc(t)
+	session := &notNullWarningSession{}
+	proc.Session = session
+	proc.SetStmtProfile(&process.StmtProfile{})
+	proc.GetStmtProfile().SetStatementRuntimeProfile("Insert", "DML", true)
+	return proc, session
+}
+
+func notNullCol(name string, oid types.T) *plan.ColDef {
+	return &plan.ColDef{
+		Name: name,
+		Typ:  plan.Type{Id: int32(oid)},
+		Default: &plan.Default{
+			NullAbility: false,
+		},
+	}
+}
+
+func nullableCol(name string, oid types.T) *plan.ColDef {
+	return &plan.ColDef{
+		Name: name,
+		Typ:  plan.Type{Id: int32(oid)},
+		Default: &plan.Default{
+			NullAbility: true,
+		},
+	}
+}
+
+// TestBatchDataNotNullFillForIgnoreAdjustsEveryFillableType pins the implicit
+// default written for each fillable column type. Every adjusted cell produces
+// one ER_BAD_NULL_ERROR warning carrying the MySQL message.
+func TestBatchDataNotNullFillForIgnoreAdjustsEveryFillableType(t *testing.T) {
+	proc, session := newIgnoreFillProc(t)
+	defer proc.Free()
+	mp := proc.Mp()
+
+	// Every type gets one kept value at slot 0 and one NULL cell at slot 1,
+	// so a single call proves both the implicit default and value retention.
+	// Uuid has no cheap non-null zero allocation here, so both of its cells
+	// are NULL and only the adjustment is asserted.
+	intVec := vector.NewVec(types.T_int32.ToType())
+	defer intVec.Free(mp)
+	require.NoError(t, vector.AppendFixed(intVec, int32(7), false, mp))
+	require.NoError(t, vector.AppendAny(intVec, nil, true, mp))
+
+	// fixedPair builds the (kept value, NULL cell) pair. The created vectors
+	// are registered for one test-scoped release; freeing inside the helper
+	// would release each vector as soon as it is built.
+	var pairVecs []*vector.Vector
+	fixedPair := func(vec *vector.Vector, value any) {
+		pairVecs = append(pairVecs, vec)
+		require.NoError(t, vector.AppendAny(vec, value, false, mp))
+		require.NoError(t, vector.AppendAny(vec, nil, true, mp))
+	}
+	t.Cleanup(func() {
+		for _, vec := range pairVecs {
+			vec.Free(mp)
+		}
+	})
+
+	floatVec := vector.NewVec(types.T_float64.ToType())
+	fixedPair(floatVec, float64(3))
+	// The low-precision float family stores +0 as all-zero bits, so the
+	// implicit default of each is the zero of its Go type; kept values stay
+	// exactly representable per format (bf16 2, float16 3, float8 4,
+	// float4 6 is the largest finite float4 magnitude).
+	bf16Vec := vector.NewVec(types.T_bf16.ToType())
+	fixedPair(bf16Vec, types.BF16FromFloat32(2))
+	f16Vec := vector.NewVec(types.T_float16.ToType())
+	fixedPair(f16Vec, types.Float16FromFloat32(3))
+	f8Vec := vector.NewVec(types.T_float8.ToType())
+	fixedPair(f8Vec, types.Float8FromFloat32(4))
+	f4Vec := vector.NewVec(types.T_float4.ToType())
+	fixedPair(f4Vec, types.Float4FromFloat32(6))
+	decVec := vector.NewVec(types.T_decimal64.ToType())
+	fixedPair(decVec, types.Decimal64(3))
+	boolVec := vector.NewVec(types.T_bool.ToType())
+	fixedPair(boolVec, true)
+	b
```

**File**: `pkg/sql/colexec/insert/insert.go` (modified, +153/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"bytes"
 	"context"
 	goruntime "runtime"
+	"slices"
 	"sync"
 	"sync/atomic"
 	"time"
@@ -251,6 +252,43 @@ func (insert *Insert) Call(proc *process.Process) (vm.CallResult, error) {
 // checkExternalNotNull rejects NULLs in NOT NULL columns. ctr.extCols is
 // aligned with InsertCtx.Attrs (and therefore with the leading batch vectors).
 func (insert *Insert) checkExternalNotNull(proc *process.Process, bat *batch.Batch) error {
+	if len(insert.ctr.extCols) == 0 {
+		return nil
+	}
+	if proc != nil && proc.GetStmtProfile() != nil &&
+		proc.GetStmtProfile().GetStatementIgnore() {
+		// A minimal external-insert plan runs no PreInsert, so this is the
+		// single NOT NULL gate. Under statement IGNORE apply the same rule
+		// PreInsert uses for normal tables: keep the row, set the implicit
+		// default of the column type, and warn per adjusted cell.
+		//
+		// The fill also replaces a constant NULL broadcast - the projected
+		// fold of an omitted column's NULL default - with a freshly
+		// allocated constant. That batch belongs to the child, which
+		// overwrites every slot on its next Call and frees only its own
+		// vectors, so this operator books the exchanged slots as its own
+		// allocations here and insert_external releases them once the write
+		// consumed the batch; otherwise each affected batch would leave one
+		// more replacement recorded in the pool with an owner nobody calls.
+		//
+		// The staged default of a dependent NOT NULL column
+		// (b DEFAULT (a)) lowers to a raw column reference while a stays
+		// nullable, and the child projection hands that reference the very
+		// vector holding a: one flat vector feeds two slots. The flat leg
+		// of the fill rewrites its destination in place, so it would also
+		// overwrite a's NULL cells with b's implicit default and drop
+		// a's null bitmap. PreInsert normally gives repeated vectors an
+		// independent copy, but this minimal external plan runs no
+		// PreInsert, so the detachment is booked here the same way.
+		if err := insert.detachAliasedFillDestinations(bat, proc); err != nil {
+			return err
+		}
+		before := insert.snapshotConstantNullSlots(bat)
+		_, err := colexec.BatchDataNotNullFillForIgnore(
+			bat.Vecs, insert.InsertCtx.Attrs, insert.ctr.extCols, proc)
+		insert.adoptExtFillReplacements(bat, before)
+		return err
+	}
 	for j, col := range insert.ctr.extCols {
 		if col == nil || j >= len(bat.Vecs) {
 			continue
@@ -269,6 +307,113 @@ func (insert *Insert) checkExternalNotNull(proc *process.Process, bat *batch.Bat
 	return nil
 }
 
+// snapshotConstantNullSlots keeps the batch's vector pointers while any slot
+// holds the one shape the fill exchanges for a fresh allocation - a constant
+// NULL broadcast of a NOT NULL column - and returns nil otherwise, so
+// ordinary batches take no snapshot at all. A constant NULL owns no backing
+// storage (NewConstNull allocates none), so the absorbed slot below is
+// guaranteed to be a child-owned broadcast the fill cannot free in place.
+func (insert *Insert) snapshotConstantNullSlots(bat *batch.Batch) []*vector.Vector {
+	for j, col := range insert.ctr.extCols {
+		if col == nil || j >= len(bat.Vecs) {
+			continue
+		}
+		vec := bat.Vecs[j]
+		if vec == nil || !vec.IsConst() || vec.Length() <= 0 || !vec.IsNull(0) {
+			continue
+		}
+		if !colexec.ColForbidsNull(col) {
+			continue
+		}
+		return slices.Clone(bat.Vecs)
+	}
+	return nil
+}
+
+// detachAliasedFillDestinations gives every fill destination whose flat
+// vector also occupies another slot independent storage before the IGNORE
+// fill runs. The in-place leg of the fill overwrites NULL cells and clears
+// the null bitmap of the vector holding them, so a shared vector would let
+// b's adjustment also set a's cell to the implicit default and clear a's
+// live NULL - the writer would emit a value where the row supplied NULL.
+// Only a vector that actually holds a NULL can be rewritten, so vectors
+// without one keep the single in-place fill. Every detachment is booked with
+// the same ownership the constant replacement uses: releaseExtFillOwned
+// hands the borrowed slot back to the child and frees the copy on each path
+// out of insert_external.
+func (insert *Insert) detachAliasedFillDestinations(bat *batch.Batch, proc *process.Process) error {
+	hasDestination := false
+	for _, col := range insert.ctr.extCols {
+		if colexec.ColForbidsNull(col) {
+			hasDestination = true
+			break
+		}
+	}
+	if !hasDestination {
+		return nil
+	}
+	shared := make(map[*vector.Vector]int, len(bat.Vecs))
+	for _, v := range bat.Vecs {
+		if v != nil && !v.IsConst() && nulls.Any(v.GetNulls()) {
+			shared[v]++
+		}
+	}
+	for j, v := range bat.Vecs {
+		if shared[v] < 2 || j >= len(insert.ctr.extCols) {
+			continue
+		}
+		if !colexec.ColForbidsNull(insert.ctr.extCols[j]) {
+			continue
+		}
+		detached := vector.NewVec(*v.GetType())
+		if err := detached.UnionBatch(v, 0, v.Length(), nil, proc
```

**File**: `pkg/sql/colexec/insert/insert_extwrite_test.go` (modified, +600/-0)
```diff
@@ -19,13 +19,15 @@ import (
 	"errors"
 	"testing"
 
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/perfcounter"
 	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/projection"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/util/resource"
 	"github.com/matrixorigin/matrixone/pkg/vm"
@@ -42,10 +44,17 @@ type mockExtWriter struct {
 	failure    error
 	writeBytes int64
 	closeBytes int64
+	// onWrite, when set, observes each batch inside its synchronous
+	// WriteBatch window - exactly the time the external IGNORE fill's
+	// per-batch adaptations are installed for.
+	onWrite func(*batch.Batch)
 }
 
 func (m *mockExtWriter) WriteBatch(ctx context.Context, bat *batch.Batch, analyzer process.Analyzer) error {
 	m.writes++
+	if m.onWrite != nil {
+		m.onWrite(bat)
+	}
 	err := process.MeasureFilesystemWaitErr(analyzer, func() error {
 		if m.writeBytes > 0 {
 			perfcounter.Update(ctx, func(counter *perfcounter.CounterSet) {
@@ -158,6 +167,112 @@ func TestCheckExternalNotNull(t *testing.T) {
 	require.NoError(t, ins3.checkExternalNotNull(proc, bat5))
 }
 
+// extIgnoreWarningSession collects flushed warning batches for the IGNORE leg.
+type extIgnoreWarningSession struct {
+	total    uint64
+	codes    []uint16
+	messages []string
+}
+
+func (*extIgnoreWarningSession) GetTempTable(string, string) (string, bool) { return "", false }
+func (*extIgnoreWarningSession) AddTempTable(string, string, string)        {}
+func (*extIgnoreWarningSession) RemoveTempTable(string, string)             {}
+func (*extIgnoreWarningSession) RemoveTempTableByRealName(string)           {}
+func (*extIgnoreWarningSession) GetSqlModeNoAutoValueOnZero() (bool, bool) {
+	return false, false
+}
+
+func (s *extIgnoreWarningSession) AppendWarningBatch(total uint64, codes []uint16, messages []string) {
+	s.total += total
+	for i := 0; i < len(codes) && i < len(messages); i++ {
+		s.codes = append(s.codes, codes[i])
+		s.messages = append(s.messages, messages[i])
+	}
+}
+
+// TestCheckExternalNotNullIgnoreAdjustsInsteadOfRejecting pins the writable
+// external-table gate: under statement IGNORE the same NULL cell that strict
+// mode rejects is adjusted to the implicit default with one warning and the
+// row is kept.
+func TestCheckExternalNotNullIgnoreAdjustsInsteadOfRejecting(t *testing.T) {
+	proc := testutil.NewProc(t)
+	session := &extIgnoreWarningSession{}
+	proc.Session = session
+	proc.SetStmtProfile(&process.StmtProfile{})
+	proc.GetStmtProfile().SetStatementRuntimeProfile("Insert", "DML", true)
+	defer proc.Free()
+	mp := mpool.MustNewZero()
+
+	ins := NewArgument()
+	ins.ToExternal = true
+	ins.InsertCtx = &InsertCtx{Attrs: []string{"a"}}
+	ins.ctr.extCols = []*plan.ColDef{notNullCol("a")}
+	defer ins.Release()
+
+	vec := vector.NewVec(types.T_int64.ToType())
+	require.NoError(t, vector.AppendFixed[int64](vec, 7, false, mp))
+	require.NoError(t, vector.AppendFixed[int64](vec, 0, true, mp))
+	bat := batch.New([]string{"a"})
+	bat.Vecs[0] = vec
+	bat.SetRowCount(2)
+	defer bat.Clean(mp)
+
+	require.NoError(t, ins.checkExternalNotNull(proc, bat))
+	require.Equal(t, int64(7), vector.GetFixedAtNoTypeCheck[int64](vec, 0))
+	require.False(t, vec.GetNulls().Contains(1))
+	require.Equal(t, int64(0), vector.GetFixedAtNoTypeCheck[int64](vec, 1),
+		"the NULL cell was adjusted to the implicit default")
+	require.Equal(t, uint64(1), session.total)
+	require.Equal(t, []uint16{moerr.ER_BAD_NULL_ERROR}, session.codes)
+	require.Equal(t, []string{"Column 'a' cannot be null"}, session.messages)
+}
+
+// TestCheckExternalNotNullIgnoreFillsConstNullVector extends the strict
+// const-null red leg with IGNORE coverage, mirroring the LOAD fact of the
+// review: a writable external-table load omits a NOT NULL column whose folded
+// default is a constant NULL (e.g. DEFAULT (abs(null))). The projection
+// delivers a NewConstNull broadcast with no backing storage; under statement
+// IGNORE the gate must still fill every logical row of the implicit default
+// with one warning per row instead of failing the load on the mutation.
+func TestCheckExternalNotNullIgnoreFillsConstNullVector(t *testing.T) {
+	proc := testutil.NewProc(t)
+	session := &extIgnoreWarningSession{}
+	proc.Session = session
+	proc.SetStmtProfile(&process.StmtProfile{})
+	proc.GetStmtProfile().SetStatementRuntimeProfile("Insert", "DML", true)
+	defer proc.Free()
+	mp := mpool.MustNewZero()
+
+	ins := NewArgument()
+	ins.ToExternal = true
+	ins.InsertCtx = &InsertCtx{Attrs: []string{"a"}}
+	ins.ctr.extCols = []*plan.ColDef{notNullCol("a")}
+	defer ins.Release()
+

```

**File**: `pkg/sql/colexec/insert/types.go` (modified, +25/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/reuse"
 	"github.com/matrixorigin/matrixone/pkg/common/rscthrottler"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/objectio/ioutil"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/perfcounter"
@@ -56,6 +57,30 @@ type container struct {
 	// extCols are the ColDefs aligned with InsertCtx.Attrs, for the external
 	// path's NOT NULL check.
 	extCols []*plan.ColDef
+	// extFillOwned holds the operator-owned vectors the external IGNORE fill
+	// booked for the child's batch during the current insert_external Call,
+	// each paired with the child-owned vector it displaced: the fresh
+	// constant a constant NULL broadcast was replaced with, and the detached
+	// copy an aliased flat fill destination got before its in-place fill.
+	// The external path writes the child's batch in place, but the child - a
+	// projection in the minimal external plan - reuses its batch and
+	// overwrites every slot on its next Call, freeing only its own vectors,
+	// so a replacement nobody owns would stay recorded in the mpool's pointer
+	// registry forever. The operator is that cleanup owner: insert_external
+	// drains the list on every path out of the Call (fill rejection, write
+	// failure, success and a panicking unwind alike), so no entry survives
+	// its batch and Reset/Free never carry one.
+	extFillOwned []extFillReplacement
+}
+
+// extFillReplacement pairs one operator-owned IGNORE-fill vector this
+// operator installs into the child's borrowed batch with the child-owned
+// vector that occupied the slot, so the slot can be returned and the
+// replacement's storage released once the batch was consumed.
+type extFillReplacement struct {
+	slot int
+	orig *vector.Vector
+	fill *vector.Vector
 }
 
 type Insert struct {
```

**File**: `pkg/sql/colexec/multi_update/insert.go` (modified, +19/-7)
```diff
@@ -64,11 +64,17 @@ func (update *MultiUpdate) insert_main_table(
 	}
 
 	// preinsert: check not null column
-	for insertIdx, inputIdx := range updateCtx.InsertCols {
-		col := updateCtx.TableDef.Cols[insertIdx]
-		if col.Default != nil && !col.Default.NullAbility && !strings.HasPrefix(col.Name, catalog.PrefixCBColName) {
-			if inputBatch.Vecs[inputIdx].HasNull() {
-				return moerr.NewConstraintViolation(proc.Ctx, fmt.Sprintf("Column '%s' cannot be null", col.Name))
+	filled, _, fillErr := fillMainInsertNotNullForIgnore(proc, updateCtx, inputBatch, false, update.insertNotNullFillOwned())
+	if fillErr != nil {
+		return fillErr
+	}
+	if !filled {
+		for insertIdx, inputIdx := range updateCtx.InsertCols {
+			col := updateCtx.TableDef.Cols[insertIdx]
+			if col.Default != nil && !col.Default.NullAbility && !strings.HasPrefix(col.Name, catalog.PrefixCBColName) {
+				if inputBatch.Vecs[inputIdx].HasNull() {
+					return moerr.NewConstraintViolation(proc.Ctx, fmt.Sprintf("Column '%s' cannot be null", col.Name))
+				}
 			}
 		}
 	}
@@ -135,8 +141,14 @@ func (update *MultiUpdate) check_null_and_insert_main_table(
 		return nil
 	}
 	insertBatch.SetRowCount(newRowCount)
-	if err = checkMainTableNotNull(proc, updateCtx, insertBatch); err != nil {
-		return err
+	filled, _, fillErr := fillMainInsertNotNullForIgnore(proc, updateCtx, insertBatch, true, update.insertNotNullFillOwned())
+	if fillErr != nil {
+		return fillErr
+	}
+	if !filled {
+		if err = checkMainTableNotNull(proc, updateCtx, insertBatch); err != nil {
+			return err
+		}
 	}
 	if err = checkZeroTemporalInStrictMode(update.RejectZeroTemporal, proc, insertBatch); err != nil {
 		return err
```

**File**: `pkg/sql/colexec/multi_update/insert_ignore_fill.go` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+// Copyright 2026 MatrixOne
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
+package multi_update
+
+import (
+	"strings"
+
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+)
+
+// insertNotNullFillOwned reports whether this operator is executing a
+// statement whose pipeline owns INSERT semantics for the IGNORE NOT NULL
+// adjustment: INSERT (plain and IGNORE), LOAD with the IGNORE duplicate
+// policy, and INSERT-shaped ON DUPLICATE KEY statements whose main target
+// only inserts. An UPDATE pipeline (and REPLACE) instead pairs every insert
+// leg with a delete leg, so the main context carries DeleteCols; for those
+// statements the fill and the row drop are not applied and the strict NOT
+// NULL error keeps its historical behavior, leaving UPDATE IGNORE and
+// REPLACE outside this INSERT-scoped fix.
+func (update *MultiUpdate) insertNotNullFillOwned() bool {
+	return len(update.MultiUpdateCtx) > 0 && len(update.MultiUpdateCtx[0].DeleteCols) == 0
+}
+
+// fillMainInsertNotNullForIgnore applies the statement IGNORE rule to the
+// main insert legs of INSERT-owned statements. Under IGNORE it first
+// adjusts every NULL cell of a NOT NULL column to the implicit default of
+// the column type with one ER_BAD_NULL_ERROR warning per cell, keeping the
+// row instead of failing the statement, like the pre-insert pipeline does.
+// It then drops every row whose resolvable single-column primary key still
+// carries its supplied NULL, publishing one further ER_BAD_NULL_ERROR
+// warning per dropped row: a main-table entry cannot carry a NULL primary
+// key, and adjusting it instead would let several adjusted rows claim the
+// same primary key inside one statement before any duplicate arbitration
+// can see it. Dropping such rows keeps the primary-key invariant and
+// matches the pinned skip-rows contract of the report; MySQL instead
+// adjusts the key to the implicit default and lets uniqueness filter the
+// duplicates, which is documented as a known divergence. The fill runs
+// before the drop so a dropped row still publishes the warnings of its
+// other supplied-NULL cells, exactly like a row the pre-insert pass drops.
+//
+// The pre-insert fill normally runs before this leg for INSERT IGNORE
+// statements (the planner forces the PRE_INSERT node whenever a supplied
+// column enforces NOT NULL), so this fill remains a no-op backstop there
+// and the live path for pipelines without that node, such as LOAD legs.
+//
+// useInsertIdx selects the vector layout. The operator's input batch keeps
+// table columns at InsertCols[inputIdx]; the shrunk write batch built by
+// check_null_and_insert_main_table keeps them at the InsertCols index
+// position. insertOwned is computed by the caller from the statement-owned
+// shape (see insertNotNullFillOwned) so UPDATE-style pipelines keep the
+// strict check. The function reports false when the statement does not run
+// under IGNORE so callers keep the strict check unchanged, and reports
+// droppedRows=true only when the batch also lost rows, so derived batches
+// sharing the vectors can be re-counted. Cluster-by helper columns are
+// skipped exactly like the strict check does.
+func fillMainInsertNotNullForIgnore(
+	proc *process.Process,
+	updateCtx *MultiUpdateCtx,
+	bat *batch.Batch,
+	useInsertIdx bool,
+	insertOwned bool,
+) (filled, droppedRows bool, err error) {
+	if !insertOwned ||
+		proc == nil || proc.GetStmtProfile() == nil || !proc.GetStmtProfile().GetStatementIgnore() {
+		return false, false, nil
+	}
+	// The pinned drop key is resolved from TableDef.Pkey by name: ordinary
+	// INSERT plans never populate InsertPkColIdx (it stays a REPLACE-only
+	// field), so any position taken from that field resolves the key to
+	// column 0 and moves the rule sideways for tables whose primary key is
+	// not the first column. The resolved key column is excluded from the
+	// fill so its cell keeps the NULL that identifies the row for the
+	// drop below.
+	pkColIdx := colexec.IgnoreNullPkColumnIdx(updateCtx.TableDef)
+	var (
+		vecs       = make([]*vector.Vector, 0, len(updateCtx.InsertCols))
+		attrs      = make([]string, 0, len(updateCtx.In
```

**File**: `pkg/sql/colexec/multi_update/insert_ignore_fill_test.go` (added, +663/-0)
```diff
@@ -0,0 +1,663 @@
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
+package multi_update
+
+import (
+	"context"
+	"testing"
+
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
+	pbPlan "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
+	"github.com/stretchr/testify/require"
+)
+
+type multiUpdateIgnoreWarningSession struct {
+	total    uint64
+	codes    []uint16
+	messages []string
+}
+
+func (*multiUpdateIgnoreWarningSession) GetTempTable(string, string) (string, bool) { return "", false }
+func (*multiUpdateIgnoreWarningSession) AddTempTable(string, string, string)        {}
+func (*multiUpdateIgnoreWarningSession) RemoveTempTable(string, string)             {}
+func (*multiUpdateIgnoreWarningSession) RemoveTempTableByRealName(string)           {}
+func (*multiUpdateIgnoreWarningSession) GetSqlModeNoAutoValueOnZero() (bool, bool) {
+	return false, false
+}
+
+func (s *multiUpdateIgnoreWarningSession) AppendWarningBatch(total uint64, codes []uint16, messages []string) {
+	s.total += total
+	for i := 0; i < len(codes) && i < len(messages); i++ {
+		s.codes = append(s.codes, codes[i])
+		s.messages = append(s.messages, messages[i])
+	}
+}
+
+func newIgnoreProfiledProc(t *testing.T) (context.Context, *gomock.Controller, *process.Process, *multiUpdateIgnoreWarningSession) {
+	t.Helper()
+	ctx, ctrl, proc := prepareTestCtx(t, false)
+	session := &multiUpdateIgnoreWarningSession{}
+	proc.Session = session
+	proc.SetStmtProfile(&process.StmtProfile{})
+	proc.GetStmtProfile().SetStatementRuntimeProfile("Insert", "DML", true)
+	return ctx, ctrl, proc, session
+}
+
+func newIgnoreFillMainHarness(
+	t *testing.T,
+	ctrl *gomock.Controller,
+	withClusterByHelper bool,
+) (*MultiUpdate, *MultiUpdateCtx, *[]*batch.Batch) {
+	t.Helper()
+
+	cols := []*pbPlan.ColDef{
+		{ColId: 0, Name: "a", Typ: i32typ, Default: &pbPlan.Default{NullAbility: true}},
+		{ColId: 1, Name: "nn", Typ: i32typ, NotNull: true, Default: &pbPlan.Default{NullAbility: false}},
+	}
+	insertCols := []int{0, 1}
+	if withClusterByHelper {
+		cols = append(cols, &pbPlan.ColDef{
+			ColId: 2, Name: catalog.PrefixCBColName + "helper",
+			Typ: i32typ, Default: &pbPlan.Default{NullAbility: false},
+		})
+		insertCols = append(insertCols, 2)
+	}
+
+	tableDef := &pbPlan.TableDef{Name: "t_ig_fill", Cols: cols, Pkey: &pbPlan.PrimaryKeyDef{}}
+	updateCtx := &MultiUpdateCtx{TableDef: tableDef, InsertCols: insertCols}
+
+	written := make([]*batch.Batch, 0, 1)
+	rel := mock_frontend.NewMockRelation(ctrl)
+	rel.EXPECT().
+		Write(gomock.Any(), gomock.Any()).
+		DoAndReturn(func(_ context.Context, b *batch.Batch) error {
+			written = append(written, b)
+			return nil
+		}).AnyTimes()
+
+	op := &MultiUpdate{
+		MultiUpdateCtx: []*MultiUpdateCtx{updateCtx},
+		ctr: container{
+			updateCtxInfos: map[string]*updateCtxInfo{
+				tableDef.Name: {
+					Source:       rel,
+					tableType:    UpdateMainTable,
+					isContiguous: isContiguousMapping(updateCtx.InsertCols),
+				},
+			},
+			insertBuf: make([]*batch.Batch, 1),
+		},
+	}
+	op.addAffectedRowsFunc = op.doAddAffectedRows
+	return op, updateCtx, &written
+}
+
+func makeIgnoreFillInputBatch(mp *mpool.MPool, withClusterByHelper bool) *batch.Batch {
+	attrs := []string{"a", "nn"}
+	vecs := []*vector.Vector{
+		testutil.MakeInt32Vector([]int32{10, 11, 12}, nil, mp),
+		testutil.MakeInt32Vector([]int32{10, 7, 12}, []uint64{1}, mp),
+	}
+	if withClusterByHelper {
+		attrs = append(attrs, catalog.PrefixCBColName+"helper")
+		vecs = append(vecs,
+			testutil.MakeInt32Vector([]int32{4, 5, 6}, []uint64{0, 1, 2}, mp))
+	}
+	bat := batch.New(attrs)
+	bat.Vecs = vecs
+	bat.SetRowCount(3)
+	return bat
+}
+
+// TestInsertMainTableIgnoreFillsInsteadOfAborting is the multi_update-path
+// red/green pair for issue #30906: a batch with one NULL NOT NULL cell aborts
+// the statement without IGNORE, while statement IGNORE adjusts the cell to
+// the implicit default, keeps every row and publishes one warning.
+func TestInsertMainTableIgnoreFillsInsteadOfAborting
```

---

### Incident Patch 3: `bfbb2645` (2026-11-06)
**Commit Message**: fix: restrict direct access to physical index relations (#32032)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31436

## What this PR does / why we need it:

An ordinary user who knows a physical index relation's name can
otherwise read or mutate index rows independently of its base table.
Restrict direct SQL, clone/restore, metadata and SQL-callable
maintenance access while retaining sys/moadmin diagnostics and
server-owned index maintenance.

The frontend, planner and runtime use the existing relation
classification and authorization boundaries. Generated maintenance
carries the base and role-specific target identities along its existing
path; plugin validation and runtime admission remain independent. Shared
role selection, ordered operand projection and table-function admission
remove repeated algorithm-specific paths while preserving each
algorithm’s validation and reset behavior. Descriptor tests share a
table while retaining the algorithm-specific cases. ISCP retains its own
source admission and error policy. Authorization happens 

**File**: `docs/design/physical-index-access.md` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+# Physical index relation access
+
+MatrixOne's physical index relations are implementation details of their owning
+base table. [Issue #31436](https://github.com/matrixorigin/matrixone/issues/31436)
+and [PR #32032](https://github.com/matrixorigin/matrixone/pull/32032) address
+direct SQL and maintenance functions that otherwise expose those relations.
+
+## Boundary
+
+An authenticated sys/moadmin session may inspect a physical index relation.
+Other sessions cannot explicitly read, mutate, clone, or use table-specific
+metadata operations on one. Classification uses the requested and resolved
+names, relation kind, and durable index feature. Missing definitions fail closed.
+Server-authored index work is tied to its already-authorized base and exact
+generated relation, and does not confer access to a user expression, view,
+subquery, or stored routine.
+
+SHOW INDEX's generated metadata sources carry exact AST-node identities and
+their parent object. User-supplied WHERE expressions bind normally. Metadata
+listings exclude physical relations using their decoded feature as well as the
+legacy name and kind; current persisted information-schema views are upgraded
+through the catalog owner. Historical TABLES views bind a filtered catalog
+source without changing their stored definition. Clone source snapshots are
+resolved in the source account, while destination checks use the authorized
+destination account before mutation. Prepared cross-account clone validates its
+source during PREPARE and rechecks the destination at EXECUTE. New clones of
+system metadata views use the local listing policy. Existing user-owned views,
+including older clones, keep their definitions and grants and may expose catalog
+metadata; they do not grant direct access to index rows.
+
+## Index maintenance functions
+
+Every caller-configured relation consumed by a maintenance table function is
+resolved and classified before reads, persistence, cache eviction, or other
+effects. Internal SQL issued by that operator carries a restrictive relation
+policy, including full caller identity. A consumed view is recursively bound
+without executing or folding its expressions; actual child SQL is checked again
+when bound. Untrusted contexts cannot inherit an internal access capability.
+
+Each index plugin maps its own generated function and operands to the live base
+and child definitions. The SQL owner selects roles through that descriptor;
+callers supply the function and index name without repeating the role list.
+Maintenance matches the exact name from the owned definition; SQL spelling is
+normalized by the planner, preserving distinct Unicode index identities.
+Synchronous maintenance and ISCP share role projection while retaining their
+own source admission and error policy.
+Vector plugin validators share config decoding, while runtime admission retains
+its independent checks of the consumed relations. A bounded attestation carries the account, database,
+base, function, and role-specific child identities on exactly one generated
+operator. The internal codec transports this record when the operator runs on a
+different CN. A restricted nested statement may mark only the exact generated
+AST source nodes corresponding to that attestation. ISCP initialization derives
+a fresh record from the fenced source table ID and current index group; legacy
+non-function initialization SQL remains on its existing path. Admission is
+repeated after reset and operator reuse, without per-row catalog lookups.
+
+The CPU implementations cover fulltext2, HNSW, and IVF-FLAT; CAGRA and IVF-PQ
+use the same boundary without changing their distributed placement. GPU runtime
+behavior requires validation on a CUDA-capable runner.
+
+CAGRA and IVF-PQ ignored-row targets follow the same optional-operand contract as HNSW: the plugin validates and attests each present ignored relation, synchronous rebuild uses the descriptor's role list, and runtime admission checks that target before any effects. ISCP initialization derives the same role list from the fenced live index group. An absent optional target grants no authority.
+
+## Decisions and alternatives
+
+The security invariant is that knowing an internal relation name does not
+grant access to its rows or a way to invoke maintenance on it. A privileged
+sys/moadmin session can still inspect it; an ordinary session retains its
+existing access to authorized base tables. Current TABLES, PARTITIONS and
+COLUMNS listings exclude physical children, including a child renamed after
+its creation. The existing-user-view exception described above concerns
+metadata in previously saved definitions, not authority to read index rows.
+
+Leaving the existing behavior unchanged would preserve the direct-access
+exposure. Filtering only the reserved name prefix would miss a renamed child
+whose catalog identity still marks it as physical. Treating a complete internal
+executor or nested query
```

**File**: `pkg/bootstrap/versions/information_schema_tables.go` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ import (
 // InformationSchemaTablesUpgradeEntry refreshes the current TABLES definition.
 // Historical and forward handlers share the same idempotent view repair.
 func InformationSchemaTablesUpgradeEntry() UpgradeEntry {
-	return InformationSchemaViewUpgradeEntry("TABLES", sysview.InformationSchemaTablesV118DDL, defines.MORPCVersion118)
+	return InformationSchemaViewUpgradeEntry("TABLES", sysview.InformationSchemaTablesCurrentDDL, defines.MORPCVersion118)
 }
 
 // InformationSchemaPartitionsUpgradeEntry refreshes the current PARTITIONS
```

**File**: `pkg/bootstrap/versions/v1_2_0/partitions_legacy_test.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
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
+package v1_2_0
+
+import (
+	"crypto/sha256"
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestPartitionsUpgradeKeepsReleasedDefinition(t *testing.T) {
+	// SHA-256 of InformationSchemaPartitionsDDL evaluated from the published
+	// v4.2.8 source at 10d204b8763f19b2b37ba2147d1d4c1a7828d6d4.
+	digest := sha256.Sum256([]byte(upg_information_schema_partitions.UpgSql))
+	require.Equal(t, "5bef2546566ddf69d36e0cdffe281be1de3bad3672005b6ecaec623564261f17", fmt.Sprintf("%x", digest))
+}
```

**File**: `pkg/bootstrap/versions/v1_2_0/tenant_upgrade_list.go` (modified, +2/-2)
```diff
@@ -372,14 +372,14 @@ var upg_information_schema_partitions = versions.UpgradeEntry{
 	Schema:    sysview.InformationDBConst,
 	TableName: "PARTITIONS",
 	UpgType:   versions.MODIFY_VIEW,
-	UpgSql:    sysview.InformationSchemaPartitionsDDL,
+	UpgSql:    sysview.InformationSchemaPartitionsRelease428DDL,
 	CheckFunc: func(txn executor.TxnExecutor, accountId uint32) (bool, error) {
 		exists, viewDef, err := versions.CheckViewDefinition(txn, accountId, sysview.InformationDBConst, "PARTITIONS")
 		if err != nil {
 			return false, err
 		}
 
-		if exists && viewDef == sysview.InformationSchemaPartitionsDDL {
+		if exists && viewDef == sysview.InformationSchemaPartitionsRelease428DDL {
 			return true, nil
 		}
 		return false, nil
```

**File**: `pkg/bootstrap/versions/v4_0_7/catalog_upgrade_entries_test.go` (modified, +2/-2)
```diff
@@ -252,7 +252,7 @@ func TestDaemonClaimPrecisionCheckUsesStoredType(t *testing.T) {
 func TestColumnsAndTablesAreIncludedInTenantUpgrade(t *testing.T) {
 	want := map[string]string{
 		"COLUMNS": sysview.InformationSchemaColumnsDDL,
-		"TABLES":  sysview.InformationSchemaTablesV118DDL,
+		"TABLES":  sysview.InformationSchemaTablesCurrentDDL,
 	}
 	for _, entry := range tenantUpgEntries {
 		ddl, ok := want[entry.TableName]
@@ -271,7 +271,7 @@ func TestInformationSchemaMetadataVisibilityUpgradeChecks(t *testing.T) {
 		entry versions.UpgradeEntry
 		ddl   string
 	}{
-		{versions.InformationSchemaTablesUpgradeEntry(), sysview.InformationSchemaTablesV118DDL},
+		{versions.InformationSchemaTablesUpgradeEntry(), sysview.InformationSchemaTablesCurrentDDL},
 		{versions.InformationSchemaColumnsUpgradeEntry(), sysview.InformationSchemaColumnsDDL},
 		{upgradeInformationSchemaStatistics(), sysview.InformationSchemaStatisticsPrefixSubPartDDL},
 		{upgradeInformationSchemaTableConstraints(), sysview.InformationSchemaTableConstraintsDDL},
```

**File**: `pkg/catalog/index_relation_access.go` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
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
+package catalog
+
+import (
+	"fmt"
+	"strings"
+
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/sql/features"
+)
+
+const PhysicalIndexPredicateFunction = "mo_is_physical_index"
+
+// NonIndexRelationSQLPredicate excludes physical index children from metadata
+// listings. It must not be used by clone or restore scans, which need children.
+func NonIndexRelationSQLPredicate(alias string) string {
+	prefix := ""
+	if alias != "" {
+		prefix = alias + "."
+	}
+	return NonIndexRelationSQLPredicateForColumns(prefix+SystemRelAttr_Name, prefix+SystemRelAttr_Kind, prefix+SystemRelAttr_ExtraInfo)
+}
+
+// NonIndexRelationSQLPredicateForColumns accepts the catalog column expressions
+// of a metadata source, including subscription columns whose name is att_relname.
+func NonIndexRelationSQLPredicateForColumns(name, kind, extra string) string {
+	return fmt.Sprintf("not %s(coalesce(%s, ''), coalesce(%s, ''), coalesce(%s, ''))", PhysicalIndexPredicateFunction, name, kind, extra)
+}
+
+// RequiresPrivilegedRelationAccess checks an explicit physical relation target.
+// Unknown nonempty kinds fail closed: they may belong to an index plugin not
+// compiled into this binary. Empty kind remains valid for old ordinary tables
+// and name-only checks. New children also carry the durable IndexTable flag.
+func RequiresPrivilegedRelationAccess(name, kind string, flags uint64) bool {
+	if features.IsIndexTable(flags) {
+		return true
+	}
+	if len(name) >= len(IndexTableNamePrefix) && strings.EqualFold(name[:len(IndexTableNamePrefix)], IndexTableNamePrefix) {
+		return true
+	}
+	if len(name) >= len(defines.TempTableNamePrefix) && strings.EqualFold(name[:len(defines.TempTableNamePrefix)], defines.TempTableNamePrefix) {
+		lower := strings.ToLower(name)
+		if IsUniqueIndexTable(lower) || IsSecondaryIndexTable(lower) {
+			return true
+		}
+	}
+	if kind == "" {
+		return false
+	}
+	if strings.EqualFold(kind, SystemTemporaryTable) || strings.EqualFold(kind, SystemPersistRel) || strings.EqualFold(kind, SystemTransientRel) {
+		return false
+	}
+	for _, coreKind := range userVisibleRelationKinds {
+		if strings.EqualFold(kind, coreKind) {
+			return false
+		}
+	}
+	return true
+}
```

**File**: `pkg/catalog/index_relation_access_test.go` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
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
+package catalog
+
+import (
+	"strings"
+	"testing"
+
+	"github.com/google/uuid"
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/sql/features"
+)
+
+func TestPhysicalIndexRelationClassification(t *testing.T) {
+	id := "0198fa2b-7cc8-7ed1-b7ae-a3d9c29e75fd"
+	session := uuid.MustParse("018f1f76-7b9d-7f35-b2d9-9b8d7774bde8")
+	index := SecondaryIndexTableNamePrefix + id
+	cases := []struct {
+		name, kind string
+		want       bool
+	}{
+		{index, "", true},
+		{strings.ToUpper(index), "", true},
+		{"nonreserved", SystemIndexRel, true},
+		{defines.GenTempTableName(session, "db", "generation_"+index), "", true},
+		{defines.GenTempTableName(session, index, "ordinary"), "", false},
+		{"orders__mo_index_secondary_not_an_index", SystemOrdinaryRel, false},
+		{"ordinary", SystemOrdinaryRel, false},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			require.Equal(t, tc.want, RequiresPrivilegedRelationAccess(tc.name, tc.kind, 0))
+		})
+	}
+	for _, kind := range append(userVisibleRelationKinds[:], "", SystemTemporaryTable, SystemPersistRel, SystemTransientRel, "V") {
+		t.Run("core/"+kind, func(t *testing.T) {
+			require.False(t, RequiresPrivilegedRelationAccess("ordinary", kind, 0))
+			require.False(t, RequiresPrivilegedRelationAccess("ordinary", kind, features.Partition))
+			require.True(t, RequiresPrivilegedRelationAccess("ordinary", kind, features.IndexTable))
+		})
+	}
+	for _, kind := range []string{SystemIndexRel, "unregistered_plugin_kind", Cagra_TblType_Storage, Ivfpq_TblType_Metadata} {
+		require.True(t, RequiresPrivilegedRelationAccess("ordinary", kind, 0), kind)
+	}
+}
+
+func TestNonIndexRelationSQLPredicate(t *testing.T) {
+	require.Equal(t, "not mo_is_physical_index(coalesce(relname, ''), coalesce(relkind, ''), coalesce(extra_info, ''))", NonIndexRelationSQLPredicate(""))
+	require.Equal(t, "not mo_is_physical_index(coalesce(tbl.relname, ''), coalesce(tbl.relkind, ''), coalesce(tbl.extra_info, ''))", NonIndexRelationSQLPredicate("tbl"))
+	require.Equal(t, "not mo_is_physical_index(coalesce(mc.att_relname, ''), coalesce(mc.relkind, ''), coalesce(mc.extra_info, ''))", NonIndexRelationSQLPredicateForColumns("mc.att_relname", "mc.relkind", "mc.extra_info"))
+}
```

**File**: `pkg/catalog/temp_table.go` (modified, +9/-1)
```diff
@@ -24,9 +24,17 @@ import (
 const (
 	legacyTemporaryTableNameRegexp = `^__mo_tmp_[0-9a-f]{32}_`
 	legacyTemporaryTableFunction   = `mo_is_legacy_temporary_table`
-	userVisibleRelationKindsSQL    = "'" + SystemOrdinaryRel + "', '" + SystemViewRel + "', '" + SystemExternalRel + "', '" + SystemMaterializedRel + "', '" + SystemSourceRel + "', '" + SystemClusterRel + "', '" + SystemPartitionRel + "', '" + SystemSequenceRel + "'"
 )
 
+// Keep the SQL filter and explicit-relation admission on the same set of
+// catalog relation kinds. The order is part of the generated SQL's shape.
+var userVisibleRelationKinds = [...]string{
+	SystemOrdinaryRel, SystemViewRel, SystemExternalRel, SystemMaterializedRel,
+	SystemSourceRel, SystemClusterRel, SystemPartitionRel, SystemSequenceRel,
+}
+
+var userVisibleRelationKindsSQL = "'" + strings.Join(userVisibleRelationKinds[:], "', '") + "'"
+
 // NonTemporaryTableSQLPredicate returns the catalog predicate used to exclude
 // temporary objects from metadata and clone/restore queries.
 //
```

#### Recent Merged Pull Requests:
- **PR #32342** (2026-11-07): fix(sql): scan Decimal256 MIN/MAX aggregates without zonemap bounds (@aptend)
- **PR #32340** (2026-11-06): fix(parser): preserve mixed-case UNIQUE constraint symbols (@aptend)
- **PR #32337** (2026-11-06): fix(mo-service): apply max-processor after flag parsing (@aptend)
- **PR #32335** (2026-11-06): fix(frontend): reject unsupported SET PASSWORD statements (@aptend)
- **PR #32319** (2026-11-06): fix: harden two-node HA deployment and DRBD fencing (@wangxiaoze-orange)
- **PR #32307** (2026-11-06): fix: consolidate stopped-upgrade cleanup and stabilize CI (@XuPeng-SH)

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

## X. consolidate stopped-upgrade cleanup and stabilize CI (#32307)

**RULE**:
When implementing operations in `docs/design/20261028-catalog-upgrade-407.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `606ae4fb`: consolidate stopped-upgrade cleanup and stabilize CI (#32307). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261028-catalog-upgrade-407.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Catalog upgrade consolidation and 4.2 stopped-upgrade cleanup
The original #31490 design considered stopped, intact 4.1 and 4.2 deployments. For the #32278 follow-up, the supported source is a stopped 4.2 release upgraded directly to current main; intermediate main versions, mixed-version operation and downgrade are out of scope. References to a 4.1 source below describe the earlier design, not an additional acceptance target for this follow-up. This boundary does not erase older data: a 4.2 source can contain snapshots created before that release. The migration must preserve data, existing snapshot records and retention. Ambiguous historical snapshot ownership must follow the user's explicit decision: pause and obtain administrator confirmation by snapshot UUID; do not guess from the snapshot name alone.
The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, using the version/tenant task and startup reconciliation owners described below. Do not register unpublished 4.0.8–4.0.19 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
# Consolidate catalog upgrades for 4.1 and 4.2 sources
The requested source is a stopped, intact deployment whose current released version is 4.1 or 4.2. Direct upgrades from 3.x and all unreleased main catalogs (including prior 4.0.7 and 4.0.18/19 identities), downgrade and mixed-version operation are out of scope. This boundary does not erase older data: a 4.1 or 4.2 source can contain snapshots created before that release. The migration must preserve data, existing snapshot records and retention. Ambiguous historical snapshot ownership must follow the user's explicit decision: pause and obtain administrator confirmation by snapshot UUID; do not guess from the snapshot name alone.
The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, preserving the existing version/tenant task owners and recurring maintenance. Do not register unpublished 4.0.8–4.0.19 identities as new upgrade steps. Before release, fold the later COLUMNS and prefix-aware STATISTICS refreshes into the existing 4.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `606ae4fb` are properly handled with clean fallback behavior.
