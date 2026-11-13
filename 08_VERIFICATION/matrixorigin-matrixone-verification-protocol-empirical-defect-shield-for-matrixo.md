# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin/matrixone

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin/matrixone` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `90e547c6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T14:56:34.330Z  
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
> **Harvest Timestamp**: 2026-11-11T14:56:34.317Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2064 stars

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
- **Issue #32564** (2026-11-11): **ci: run pinned coverage comparison on MNL2**
  *Symptoms*: ## Purpose Run the same PR #32523 commit b0641dbf3cb1ed67f90f9e4226f0585ba451abc0 and package concurrency 8 on the MNL2 CS runner, matching the MTY comparison. The pinned reusable workflow checks this historical commit is in PR #32523, and retains its trust and secret checks. Only a manual test-branch entry changes; production CI and other tests are not changed.  ## Status Requires test branch review/merge before dispatch. No validation run has been triggered.
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > This pull request is merged. <!-- mergify:queue-control-withdrawn:queue -->

- **Issue #32554** (2026-11-11): **docs(defect-hunt): record vector index cache eventual-consistency ruling**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [x] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #32553  ## What this PR does / why we need it:  This adds a row to the `defect-hunt` MatrixOne adapter's "Prior evidence and decisions" table, so agents stop reporting the vector / fulltext index cache's eventual consistency as a bug (see #32501).  The row records: - **Ruling:** a cached HNSW / IVF-PQ / CAGRA / fulltext2 model that answers from an older snapshot is intentional while the periodic `IsStale` sweep has not yet evicted it (default window about 10–12.5 min). The search path never checks freshness. - **Deterministic probing:** `mo_ctl('cn', 'SetVectorIndexFreshnessInterval', '1s')` (restore `'0'`), or `GetVectorIndexCacheKeys` + `EvictVectorIndexCache`. - **What is still a defect:** staleness that persists after the shortened sweep or after eviction. - **Sources:** the `StaleChecker` design-decision comment in `pkg/vectorindex/cache/cache.go`, `docs/design/vector_index_cache_ctl.md` §1–§3 (#28985 / #29024), and the #32501 explanation.  Checked: the relative link resolves, the four `mo_ctl` command names match `pkg/sql/plan/function/ctl/`, and every cached index search in the list implements `IsStale` (IVF-PQ / CAGRA cached search exists only in GPU builds). Docs-only, one line.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `56ad29d8` (2026-11-10)
**Commit Message**: fix(disttae): budget transaction workspace batch copies (#32458)

## What type of PR is this?

- [x] BUG

## Which issue(s) this PR fixes:

issue #32008 (partial workspace-admission hardening, not closure of the historical OOM investigation)

## What this PR does / why we need it:

Transaction INSERT/DELETE copies could allocate outside execution-memory admission while staying live alongside accounted operators. Give workspace copies independent lifetime accounts on the existing CN budget, including physical-headroom checks and physical-Free refund ownership. Snapshot workspaces sharing a Process do not close each other's generations. Generic CopyBatch remains unchanged; raw WriteBatch destinations retain their own provenance.

Integrate ownership across INSERT and commit-time merge, rather than charging obsolete copies:
- Ordinary INSERT adopts its generated rowid vector when destination provenance matches. Different destination provenance retains the necessary independent copy.
- INSERT merge stages only surviving payload columns, omitting old rowids from both copy and append, then adopts the regenerated rowid vector. All fallible staging completes before entries, indexes or owne

**File**: `docs/design/txn-workspace-memory.md` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+# Transaction workspace allocation admission, revision 1
+
+Owner: issue #32008; implementation PR pending. Base: 745d25375de6.
+Design-first review: PASS, reviewed before implementation in this task.
+
+Invariant: a workspace-owned physical vector allocation is admitted against its
+own lifetime account and the existing CN ledger before backing is allocated.
+Free is the sole refund owner. Source and destination copies coexist and are
+both charged. A workspace never closes the Process generation it borrowed.
+
+Each workspace lazily opens an independent generation on the Process generation's
+CN ledger, including snapshot workspaces sharing a Process. A separate mutex
+serializes creation and terminal closure without reentering the workspace mutex.
+States: absent -> open -> terminal. Terminal cannot reopen. Partial construction
+closes its private generation. Final cleanup seals/publishes the account only
+after workspace batches are cleaned; nonzero snapshots retain the existing
+release-capable tombstone semantics. Statement rollback retains earlier writes.
+
+Use the existing allocator-backed off-heap vector APIs, destination-selected
+CopyBatch, and append-only owner catalog. Preserve generic CopyBatch semantics.
+Account rowids before filling; append/merge/ALTER copies preserve provenance.
+Keep existing approximate workspace/spill counters: they are not refund owners.
+Capacity errors propagate; no unaccounted fallback or automatic retry is added.
+No new configuration, protocol, storage format, worker or controller.
+
+Alternatives rejected: source operator accounts have the wrong lifetime;
+estimated reservation tokens duplicate physical lease refunds; a new RSS
+controller duplicates main's existing dynamic CN headroom guard. Cost is one
+lazy account per writing workspace, allocation metadata and existing admission
+locking, with no per-row global lookup. Read-only workspaces allocate no account.
+
+Tests: deterministic low-budget copy/growth failures and source independence;
+independent generation close and CN competition; workspace terminal/rollback;
+SQL low-budget rejection with unchanged rows and subsequent connection reuse.
+Native build, UT, race, BVT and fresh-capacity isolated QA are separate evidence.
+4.2 lacks these main mechanisms: assess dependencies separately, no blind cherry
+pick. Original incident SQL/concurrency remain unknown; this closes a proven
+admission gap and does not claim incident reproduction. Old source resources and
+receiver are out of scope. Rollback is code rollback, with no data migration.
+
+## Implementation review and validation
+
+Closures reviewed: explicit downstream copy ownership (R2), independent generation
+and close/concurrent lazy initialization (R3), workspace rowid/copy/merge cleanup
+(R3), append-only owner compatibility (R1), inert database-keyed test limit (R1).
+The raw WriteBatch transfer interface retains caller-owned batch provenance;
+normal table INSERT/DELETE select the workspace owner at the copy boundary.
+Generic CopyBatch remains unchanged. Existing spill staging and ownership
+rollback remain authoritative; no release is inferred from approximate sizes.
+
+Normal tests passed for mpool, util and process; disttae final full package
+passed after multi-block fixtures explicitly selected an appropriate query
+limit and the mirror-memory oracle included off-heap backing. Selected race
+checks passed, including independent close and concurrent lazy initialization.
+Incremental lint reported zero issues; vet-all passed for the changed packages.
+The new BVT SQL passed direct MySQL execution on the built local service:
+three capacity errors, unchanged rows after each refusal, and successful writes
+on the same connection after removing the limit. It passed twice on the same
+instance; cn_spill_byte_bound also passed exact structured output checks. The
+mo-tester result-file comparison remains for CI. Initial service build attempts
+hit toolchain switching and disk pressure; the explicit toolchain and completed
+cache allowed the final build to pass. All local SQL services were stopped and
+only their owned data was removed; logs and checksum manifests are retained.
+Isolated 16 GiB/cgroup acceptance is NOT_RUN.
+Microbenchmark (32 varlen rows, 1000 copies): generic 1163 ns/op, 3196 B/op,
+6 allocations; workspace 3725 ns/op, 616 B/op, 4 allocations. This diagnostic is
+not a transaction throughput acceptance result; QA must assess the hot-path cost.
+
+4.2 assessment: the incident version lacks main's unified execution generation,
+physical-growth headroom and destination-account lifecycle closure. This patch
+must not be mechanically cherry-picked without a separate dependency and
+release-specific failure-path review. No 4.2 code is changed here.
+
+Local SQL evidence: /private/var/folders/_7/28p3df355x96blk88tp_0w4r0000gn/T/txn-workspace-bvt-7o0zgimb (evidence-manifest.json, sql-oracle.json, repeat-oracles.json, c
```

**File**: `pkg/common/mpool/allocation_owner.go` (modified, +4/-1)
```diff
@@ -35,12 +35,13 @@ const (
 	AllocationOwnerExternal
 	AllocationOwnerDependent
 	AllocationOwnerWindow
+	AllocationOwnerTxnWorkspace
 )
 
 const (
 	// AllocationOwnerCatalogMax is the largest owner implemented by this
 	// binary. Append new catalog entries immediately before it.
-	AllocationOwnerCatalogMax = AllocationOwnerWindow
+	AllocationOwnerCatalogMax = AllocationOwnerTxnWorkspace
 	// AllocationOwnerMax preserves the existing public bound and reserves IDs
 	// for rolling-version terminal summaries. Unknown owners remain observable
 	// on the wire but cannot allocate locally until catalogued by this binary.
@@ -51,6 +52,8 @@ const (
 // non-zero IDs remain renderable during rolling upgrades.
 func (o AllocationOwner) String() string {
 	switch o {
+	case AllocationOwnerTxnWorkspace:
+		return "txn_workspace"
 	case AllocationOwnerHashBuild:
 		return "hash_build"
 	case AllocationOwnerIndexBuild:
```

**File**: `pkg/common/mpool/allocation_owner_test.go` (modified, +3/-2)
```diff
@@ -37,6 +37,7 @@ func TestAllocationOwnerCatalog(t *testing.T) {
 		{AllocationOwnerExternal, 13, "external"},
 		{AllocationOwnerDependent, 14, "dependent"},
 		{AllocationOwnerWindow, 15, "window"},
+		{AllocationOwnerTxnWorkspace, 16, "txn_workspace"},
 	}
 	seen := make(map[AllocationOwner]struct{}, len(owners))
 	seenNames := make(map[string]struct{}, len(owners))
@@ -59,8 +60,8 @@ func TestAllocationOwnerCatalog(t *testing.T) {
 		}
 		seenNames[entry.name] = struct{}{}
 	}
-	if AllocationOwnerCatalogMax != AllocationOwnerWindow {
-		t.Fatalf("catalog max = %d, want %d", AllocationOwnerCatalogMax, AllocationOwnerWindow)
+	if AllocationOwnerCatalogMax != AllocationOwnerTxnWorkspace {
+		t.Fatalf("catalog max = %d, want %d", AllocationOwnerCatalogMax, AllocationOwnerTxnWorkspace)
 	}
 	if AllocationOwnerCatalogMax > AllocationOwnerMax {
 		t.Fatalf("catalog max %d exceeds reserved max %d", AllocationOwnerCatalogMax, AllocationOwnerMax)
```

**File**: `pkg/objectio/injects.go` (modified, +10/-0)
```diff
@@ -1016,3 +1016,13 @@ func UpstreamSQLHelperInjected() (string, bool) {
 	_, sarg, injected := fault.TriggerFault(FJ_UpstreamSQLHelper)
 	return sarg, injected
 }
+
+// CNWorkspaceAllocationLimit returns a test-only limit for one explicitly named
+// database. An empty selector is deliberately inert to protect unrelated work.
+func CNWorkspaceAllocationLimit(database string) uint64 {
+	limit, target, injected := fault.TriggerFault("fj/cn/workspace_allocation_limit")
+	if !injected || target == "" || target != database || limit <= 0 {
+		return 0
+	}
+	return uint64(limit)
+}
```

**File**: `pkg/objectio/injects_test.go` (modified, +18/-0)
```diff
@@ -93,3 +93,21 @@ func TestCommitWaitInjectedTargetsTransaction(t *testing.T) {
 	_, injected = CommitWaitInjected(7, "accepted")
 	require.False(t, injected)
 }
+
+func TestWorkspaceAllocationLimitIsDatabaseScoped(t *testing.T) {
+	enabled := fault.Enable()
+	const point = "fj/cn/workspace_allocation_limit"
+	t.Cleanup(func() {
+		_, _ = fault.RemoveFaultPoint(t.Context(), point)
+		if enabled {
+			fault.Disable()
+		}
+	})
+	require.NoError(t, fault.AddFaultPoint(t.Context(), point, ":::", "ECHO", 32, "workspace_test", false))
+	require.Equal(t, uint64(32), CNWorkspaceAllocationLimit("workspace_test"))
+	require.Zero(t, CNWorkspaceAllocationLimit("other_database"))
+	_, err := fault.RemoveFaultPoint(t.Context(), point)
+	require.NoError(t, err)
+	require.NoError(t, fault.AddFaultPoint(t.Context(), point, ":::", "ECHO", 32, "", false))
+	require.Zero(t, CNWorkspaceAllocationLimit("workspace_test"))
+}
```

**File**: `pkg/sql/util/copy_batch_test.go` (modified, +125/-0)
```diff
@@ -236,3 +236,128 @@ func copyBatchWithUnionAll(src *batch.Batch, mp *mpool.MPool) (*batch.Batch, err
 	dst.SetRowCount(src.RowCount())
 	return dst, nil
 }
+
+func TestCopyBatchDestinationAdmission(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	src := batch.NewWithSize(2)
+	src.Attrs = []string{"id", "payload"}
+	src.SetVector(0, vector.NewVec(types.T_int64.ToType()))
+	src.SetVector(1, vector.NewVec(types.T_varchar.ToType()))
+	require.NoError(t, vector.AppendFixedList(src.Vecs[0], []int64{1, 2}, []bool{false, true}, proc.Mp()))
+	require.NoError(t, vector.AppendBytes(src.Vecs[1], []byte("a sufficiently long variable payload"), false, proc.Mp()))
+	require.NoError(t, vector.AppendBytes(src.Vecs[1], nil, true, proc.Mp()))
+	src.SetRowCount(2)
+	defer src.Clean(proc.Mp())
+	for _, limit := range []uint64{1, 32, 1 << 20} {
+		t.Run(fmt.Sprint(limit), func(t *testing.T) {
+			registry, err := mpool.NewAllocationAccountRegistry(2, 1024)
+			require.NoError(t, err)
+			account, err := registry.Open(limit)
+			require.NoError(t, err)
+			selection, err := vector.NewAllocationAccountSelection(account, mpool.AllocationOwnerTxnWorkspace, 1, 2, 3, 4)
+			require.NoError(t, err)
+			dst, err := CopyBatchWithAllocation(src, proc, selection)
+			if limit == 1<<20 {
+				require.NoError(t, err)
+				require.Positive(t, account.Snapshot().Used)
+				require.NotNil(t, dst.AllocationAccountSelection())
+				require.Equal(t, src.RowCount(), dst.RowCount())
+				require.Equal(t, src.Vecs[1].GetBytesAt(0), dst.Vecs[1].GetBytesAt(0))
+				dst.Clean(proc.Mp())
+			} else {
+				require.ErrorIs(t, err, mpool.ErrAllocationAccountCapacity)
+				require.Nil(t, dst)
+			}
+			require.Zero(t, account.Snapshot().Used)
+			require.Equal(t, int64(1), vector.MustFixedColNoTypeCheck[int64](src.Vecs[0])[0])
+			_, _, err = registry.CompleteTerminal(account)
+			require.NoError(t, err)
+		})
+	}
+}
+
+func BenchmarkCopyBatchDestinationAdmission(b *testing.B) {
+	proc := testutil.NewProcess(b)
+	src := batch.NewWithSize(1)
+	src.Attrs = []string{"payload"}
+	src.Vecs[0] = vector.NewVec(types.T_varchar.ToType())
+	for range 32 {
+		require.NoError(b, vector.AppendBytes(src.Vecs[0], []byte("a moderately wide variable payload for a workspace batch"), false, proc.Mp()))
+	}
+	src.SetRowCount(32)
+	defer src.Clean(proc.Mp())
+	registry, err := mpool.NewAllocationAccountRegistry(2, 1024)
+	require.NoError(b, err)
+	account, err := registry.Open(64 << 20)
+	require.NoError(b, err)
+	selection, err := vector.NewAllocationAccountSelection(account, mpool.AllocationOwnerTxnWorkspace, 1, 2, 3, 4)
+	require.NoError(b, err)
+	generation, err := proc.GetExecutionResourceBudget()
+	require.NoError(b, err)
+	cnRegistry, err := generation.AllocationAccountRegistry()
+	require.NoError(b, err)
+	cnAccount, err := cnRegistry.OpenWithController(generation.Cap(), generation)
+	require.NoError(b, err)
+	b.Cleanup(func() {
+		require.Zero(b, cnAccount.Snapshot().Used)
+		_, _, err := cnRegistry.CompleteTerminal(cnAccount)
+		require.NoError(b, err)
+		generation.Close()
+	})
+	cnSelection, err := vector.NewAllocationAccountSelection(cnAccount, mpool.AllocationOwnerTxnWorkspace, 1, 2, 3, 4)
+	require.NoError(b, err)
+	for _, tc := range []struct {
+		name      string
+		selection *vector.AllocationAccountSelection
+	}{{"generic", nil}, {"workspace", selection}, {"workspace_cn", cnSelection}} {
+		b.Run(tc.name, func(b *testing.B) {
+			b.ReportAllocs()
+			for range b.N {
+				dst, err := CopyBatchWithAllocation(src, proc, tc.selection)
+				if err != nil {
+					b.Fatal(err)
+				}
+				dst.Clean(proc.Mp())
+			}
+		})
+	}
+	require.Zero(b, account.Snapshot().Used)
+	_, _, err = registry.CompleteTerminal(account)
+	require.NoError(b, err)
+}
+
+func TestCopyBatchKeepsSourceAndDestinationChargesIndependent(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	registry, err := mpool.NewAllocationAccountRegistry(2, 1024)
+	require.NoError(t, err)
+	source, err := registry.Open(1 << 20)
+	require.NoError(t, err)
+	target, err := registry.Open(1 << 20)
+	require.NoError(t, err)
+	srcSelection, err := vector.NewAllocationAccountSelection(source, mpool.AllocationOwnerDML, 1, 2, 3, 4)
+	require.NoError(t, err)
+	dstSelection, err := vector.NewAllocationAccountSelection(target, mpool.AllocationOwnerTxnWorkspace, 1, 2, 3, 4)
+	require.NoError(t, err)
+	src := batch.NewOffHeapWithSize(1)
+	require.NoError(t, src.SetAllocationAccount(srcSelection))
+	src.SetVector(0, vector.NewOffHeapVecWithType(types.T_int64.ToType()))
+	defer src.Clean(proc.Mp())
+	require.NoError(t, vector.AppendFixed(src.Vecs[0], int64(42), false, proc.Mp()))
+	src.SetRowCount(1)
+	used := source.Snapshot().Used
+	dst, err := CopyBatchWithAllocation(src, proc, dstSelection)
+	require.NoError(t, err)
+	defer dst.Clean(proc.Mp())
+	require.Equal(t, used, source.Snapshot().Used)
+	require.Positive(t, target.Snapshot().Used)
+	src.Clean(proc.Mp())
+	require.Zero(t, source.Snapshot().Used)
+	require.Positive(t
```

**File**: `pkg/sql/util/util.go` (modified, +22/-0)
```diff
@@ -67,6 +67,28 @@ func CopyBatch(bat *batch.Batch, proc *process.Process) (*batch.Batch, error) {
 	return rbat, nil
 }
 
+// CopyBatchWithAllocation creates an independent copy under the destination owner.
+func CopyBatchWithAllocation(bat *batch.Batch, proc *process.Process, selection *vector.AllocationAccountSelection) (*batch.Batch, error) {
+	if selection == nil {
+		return CopyBatch(bat, proc)
+	}
+	dst := batch.NewOffHeapWithSize(len(bat.Vecs))
+	if err := dst.SetAllocationAccount(selection); err != nil {
+		return nil, err
+	}
+	dst.Attrs = append(dst.Attrs, bat.Attrs...)
+	for i, src := range bat.Vecs {
+		v, err := src.CloneToFlatCompactWithAllocation(proc.Mp(), selection)
+		if err != nil {
+			dst.Clean(proc.Mp())
+			return nil, err
+		}
+		dst.SetVector(int32(i), v)
+	}
+	dst.SetRowCount(bat.RowCount())
+	return dst, nil
+}
+
 func TableIsLoggingTable(dbName string, tableName string) bool {
 	if tableName == "statement_info" && dbName == "system" {
 		return true
```

**File**: `pkg/vm/engine/disttae/local_disttae_datasource_test.go` (modified, +4/-2)
```diff
@@ -297,6 +297,7 @@ func TestBigS3WorkspaceIterMissingData(t *testing.T) {
 	s3Bat.SetRowCount(8193)
 	s3Bat.SetAttributes([]string{catalog.BlockMeta_BlockInfo, catalog.ObjectMeta_ObjectStats})
 	txn := &Transaction{
+		proc: testutil.NewProc(t),
 		cn_flushed_s3_tombstone_object_stats_list: new(sync.Map),
 		op:            txnOp,
 		deletedBlocks: &deletedBlocks{},
@@ -317,7 +318,8 @@ func TestBigS3WorkspaceIterMissingData(t *testing.T) {
 	m := mpool.MustNewZero()
 	normalBat.SetRowCount(1)
 	vector.AppendFixed(normalBat.Vecs[0], int32(1), false, m)
-	txn.WriteBatch(INSERT, "", 0, 11, 23, "db", "t2", normalBat, DNStore{})
+	_, err := txn.WriteBatch(INSERT, "", 0, 11, 23, "db", "t2", normalBat, DNStore{})
+	require.NoError(t, err)
 
 	txnOp.AddWorkspace(txn)
 
@@ -337,7 +339,7 @@ func TestBigS3WorkspaceIterMissingData(t *testing.T) {
 
 	outBatch := batch.NewWithSize(1)
 	outBatch.Vecs[0] = vector.NewVec(types.T_int32.ToType())
-	err := ls.filterInMemUnCommittedInserts(ctx, []uint16{0}, -1, m, outBatch)
+	err = ls.filterInMemUnCommittedInserts(ctx, []uint16{0}, -1, m, outBatch)
 	require.NoError(t, err)
 	require.Equal(t, 1, outBatch.RowCount())
 	require.Equal(t, 1, outBatch.Vecs[0].Length())
```

---

### Incident Patch 2: `2e175e97` (2026-11-11)
**Commit Message**: fix(sql): isolate binary capacity and assignment semantics (#29057)

## What type of PR is this?

- [x] BUG
- [x] Test and CI

## Which issue(s) this PR fixes:

Related to #28164 — isolated binary byte-capacity, assignment and
COPY/replay stage only; not the complete ODKU/collation issue and not a
closing reference. Native0900 remains disabled.

## What this PR does / why we need it:

### Current scope and predecessor-data observations (2026-11-09)

Current head: `d6400a6ed84e9312847f80f2e6d5708241405b86`. The dated
descriptions and binary-133 statements below refer to superseded PR
heads. Against merge base `52cbba793b9a36b9d5d442bbded32d88f296e761`,
this head does not change `pkg/defines`, `proto/plan.proto`,
`proto/pipeline.proto`, or generated protobuf files; see the
[current-scope review
reply](https://github.com/matrixorigin/matrixone/pull/29057#discussion_r4510861344).

An isolated predecessor-data comparison ran the official v4.2.6 binary
and a candidate built from snapshot
`777a203f1434921da55e31ca871d556a32d547d5` (the same source tree as the
current head) against the same stopped old store. All 24 compared SQL
outcomes, rows, and warnings matched: 15 statements succeeded

**File**: `pkg/lockservice/publication_test.go` (modified, +4/-0)
```diff
@@ -114,8 +114,12 @@ func TestPublicationSurvivesAllocatorRestart(t *testing.T) {
 		case <-ctx.Done():
 			t.Fatal(ctx.Err())
 		}
+		// Incarnation fields are immutable while allocator RPCs are running.
+		// The restart helper closes the owner and drains stale backends before
+		// creating its replacement, rather than mutating a live epoch.
 		alloc, err = restart()
 		require.NoError(t, err)
+		require.NotEqual(t, oldBind.AllocatorID, alloc.allocatorID)
 		_, err = b.Lock(ctx, table, newTestRows(1), newTestTxnID(2), newTestRowExclusiveOptions())
 		require.NoError(t, err)
 		require.NoError(t, fileservice.WriteExclusive(ctx, fs, fileservice.IOVector{
```

**File**: `pkg/sql/plan/alter_copy_binary_assignment_test.go` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ func TestAlterCopyBinaryAssignmentBoundary(t *testing.T) {
 			physicalType := types.New(oid, 4, 0)
 			target := makePlan2Type(&physicalType)
 			source := MakePlan2StringConstExprWithType("🧪")
-			require.Equal(t, "cast", assignmentCastFunctionNameForSource(ordinary, source, target, false, nil))
+			require.Equal(t, "cast_assign", assignmentCastFunctionNameForSource(ordinary, source, target, false, nil))
 			expression, err := forceAssignmentCastExprWithProcess(copyContext, source, target, false, nil)
 			require.NoError(t, err)
 			require.Equal(t, "cast_strict", expression.GetF().Func.ObjName)
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +37/-11)
```diff
@@ -9337,10 +9337,25 @@ func bindFuncExprImplByPlanExpr(
 		refineRepeatLiteralReturnType(args, &returnType)
 
 	case "substring", "substr", "mid":
-		refineSubstringLiteralReturnType(args, &returnType)
+		if argsType[0].Oid != types.T_blob {
+			refineSubstringLiteralReturnType(args, &returnType)
+		}
 
 	case "left", "right":
-		refineLeftRightLiteralReturnType(args, &returnType)
+		if argsType[0].Oid != types.T_blob {
+			refineLeftRightLiteralReturnType(args, &returnType)
+		}
+
+	case "hex":
+		// Keep the slice's BLOB type for its other consumers. HEX needs only
+		// its proven payload bound to choose the result's metadata.
+		if len(args) == 1 && argsType[0].Oid == types.T_blob {
+			if bounded, ok := boundedBinaryBlobSliceType(args[0]); ok {
+				if resolved, ok := function.GetFunctionByNameWithoutError(name, []types.Type{bounded}); ok {
+					returnType = resolved.GetReturnType()
+				}
+			}
+		}
 
 	case "lpad", "rpad":
 		refinePadLiteralReturnType(args, &returnType)
@@ -9967,11 +9982,6 @@ func refineSubstringLiteralReturnType(args []*plan.Expr, returnType *types.Type)
 		return
 	}
 
-	sourceType := makeTypeByPlan2Expr(args[0])
-	if sourceType.Oid == types.T_blob {
-		return
-	}
-
 	if possibleStringDomainsForExpr(args[0]) != possibleStringDomainBinary {
 		if len(args) == 3 {
 			refineCharacterSliceLiteralWidth(args[0], args[2], returnType)
@@ -10018,6 +10028,26 @@ func refineSubstringLiteralReturnType(args []*plan.Expr, returnType *types.Type)
 	refineKnownStringResultType(returnType, bound, binary)
 }
 
+// boundedBinaryBlobSliceType obtains a byte bound without changing the slice
+// expression's declared BLOB type, or its overload and execution arguments.
+func boundedBinaryBlobSliceType(expr *plan.Expr) (types.Type, bool) {
+	fn := expr.GetF()
+	if fn == nil || fn.Func == nil || len(fn.Args) == 0 ||
+		possibleStringDomainsForExpr(fn.Args[0]) != possibleStringDomainBinary {
+		return types.Type{}, false
+	}
+	bounded := types.T_blob.ToType()
+	switch strings.ToLower(fn.Func.GetObjName()) {
+	case "substring", "substr", "mid":
+		refineSubstringLiteralReturnType(fn.Args, &bounded)
+	case "left", "right":
+		refineLeftRightLiteralReturnType(fn.Args, &bounded)
+	default:
+		return types.Type{}, false
+	}
+	return bounded, bounded.Oid == types.T_varbinary
+}
+
 // refineLeftRightLiteralReturnType narrows LEFT/RIGHT when the requested
 // length is a constant.  The result cannot exceed either that length or the
 // source's proven bound; an unknown length keeps the overload's conservative
@@ -10026,10 +10056,6 @@ func refineLeftRightLiteralReturnType(args []*plan.Expr, returnType *types.Type)
 	if len(args) != 2 {
 		return
 	}
-	sourceType := makeTypeByPlan2Expr(args[0])
-	if sourceType.Oid == types.T_blob {
-		return
-	}
 	if possibleStringDomainsForExpr(args[0]) != possibleStringDomainBinary {
 		refineCharacterSliceLiteralWidth(args[0], args[1], returnType)
 		return
```

**File**: `pkg/sql/plan/base_binder_blob_slice_width_test.go` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
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
+package plan
+
+import (
+	"context"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/stretchr/testify/require"
+)
+
+func TestBoundedBinarySliceRefinesBlobResultWidth(t *testing.T) {
+	blobType := types.NewWithCharset(types.T_blob, 0, 0, types.CharsetBinary)
+	source := &planpb.Expr{
+		Typ: blobType.PlanType(),
+		Expr: &planpb.Expr_Lit{Lit: &planpb.Literal{
+			IsBin:       true,
+			LiteralForm: planpb.StringLiteralForm_STRING_LITERAL_HEX,
+			Value:       &planpb.Literal_Sval{Sval: "61"},
+		}},
+	}
+	count := makePlan2Int64ConstExprWithType(1)
+	start := makePlan2Int64ConstExprWithType(1)
+
+	t.Run("left-right", func(t *testing.T) {
+		got := blobType
+		refineLeftRightLiteralReturnType([]*planpb.Expr{source, count}, &got)
+		require.Equal(t, types.T_varbinary, got.Oid)
+		require.Equal(t, int32(1), got.Width)
+		require.Equal(t, types.CharsetBinary, got.Charset)
+	})
+
+	t.Run("substring", func(t *testing.T) {
+		got := blobType
+		refineSubstringLiteralReturnType([]*planpb.Expr{source, start, count}, &got)
+		require.Equal(t, types.T_varbinary, got.Oid)
+		require.Equal(t, int32(1), got.Width)
+		require.Equal(t, types.CharsetBinary, got.Charset)
+	})
+
+	t.Run("unknown-blob-domain-stays-unbounded", func(t *testing.T) {
+		unknown := &planpb.Expr{
+			Typ:  blobType.PlanType(),
+			Expr: &planpb.Expr_V{V: &planpb.VarRef{Name: "v"}},
+		}
+		left := blobType
+		refineLeftRightLiteralReturnType([]*planpb.Expr{unknown, count}, &left)
+		require.Equal(t, blobType, left)
+
+		substring := blobType
+		refineSubstringLiteralReturnType([]*planpb.Expr{unknown, start, count}, &substring)
+		require.Equal(t, blobType, substring)
+	})
+}
+
+func TestHexBoundedBlobSlicePreservesSliceType(t *testing.T) {
+	ctx := context.Background()
+	blobType := types.T_blob.ToType()
+	source := &planpb.Expr{Typ: blobType.PlanType(), Expr: &planpb.Expr_Col{Col: &planpb.ColRef{}}}
+	for _, name := range []string{"left", "right", "substring", "substr", "mid"} {
+		for _, tc := range []struct {
+			name      string
+			length    *planpb.Expr
+			wantOID   types.T
+			wantWidth int32
+		}{
+			{"bounded", makePlan2Int64ConstExprWithType(1), types.T_varchar, 2},
+			{"aggregate limit", makePlan2Int64ConstExprWithType(511), types.T_varchar, 1022},
+			{"above aggregate limit", makePlan2Int64ConstExprWithType(512), types.T_varchar, 1024},
+			{"hex result exceeds varchar", makePlan2Int64ConstExprWithType(32768), types.T_text, 0},
+			{"unknown", &planpb.Expr{Typ: planpb.Type{Id: int32(types.T_int64)}, Expr: &planpb.Expr_P{P: &planpb.ParamRef{Pos: 0}}}, types.T_text, 0},
+		} {
+			t.Run(name+"/"+tc.name, func(t *testing.T) {
+				args := []*planpb.Expr{source, tc.length}
+				if name == "substring" || name == "substr" || name == "mid" {
+					args = []*planpb.Expr{source, makePlan2Int64ConstExprWithType(1), tc.length}
+				}
+				slice, err := BindFuncExprImplByPlanExpr(ctx, name, args)
+				require.NoError(t, err)
+				require.Equal(t, int32(types.T_blob), slice.Typ.Id)
+				for _, aggregate := range []string{"bit_and", "bit_or", "bit_xor"} {
+					bound, err := BindFuncExprImplByPlanExpr(ctx, aggregate, []*planpb.Expr{slice})
+					require.NoError(t, err)
+					require.Equal(t, slice.Typ.Id, bound.Typ.Id)
+				}
+				result, err := BindFuncExprImplByPlanExpr(ctx, "hex", []*planpb.Expr{slice})
+				require.NoError(t, err)
+				require.Equal(t, int32(tc.wantOID), result.Typ.Id)
+				require.Equal(t, tc.wantWidth, result.Typ.Width)
+			})
+		}
+	}
+
+	variable := &planpb.Expr{Typ: blobType.PlanType(), Expr: &planpb.Expr_V{V: &planpb.VarRef{Name: "v"}}}
+	slice, err := BindFuncExprImplByPlanExpr(ctx, "left", []*planpb.Expr{variable, makePlan2Int64ConstExprWithType(1)})
+	require.NoError(t, err)
+	result, err := BindFuncExprImplByPlanExpr(ctx, "hex", []*planpb.Expr{slice})
+	require.NoError(t, err)
+	require.Equal(t, int32(types.T_text), result.Typ.Id)
+}
+
+func TestHexSliceOfConditionalBlobMetadata(t *testing.T) {
+	ctx := context.Background()
+	column := func(typ types.Type, pos int32) *planpb.Expr {
+		return &planpb.Expr{Typ: typ.PlanType(), Expr: &planpb.Expr_Col{Col: &planpb.ColRef{ColPos: pos}}}
+	}
+	condition := column(types.T_bool.ToType(), 0)
+	text := column(types.NewWithCharset(types.T_varchar, 16, 0, types.CharsetUTF8)
```

**File**: `pkg/sql/plan/base_binder_test.go` (modified, +16/-1)
```diff
@@ -24,8 +24,10 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
@@ -63,7 +65,20 @@ func TestSerialExtractBinaryAssignment(t *testing.T) {
 	require.Equal(t, target, bound.Typ)
 	assigned, err := forceAssignmentCastExpr(t.Context(), bound, target)
 	require.NoError(t, err)
-	require.Same(t, bound, assigned)
+	require.NotNil(t, assigned.GetF(), "same binary type must retain the capacity assignment")
+	proc := testutil.NewProcess(t)
+	proc.SetResolveVariableFunc(func(string, bool, bool) (any, error) { return "STRICT_TRANS_TABLES", nil })
+	t.Cleanup(proc.Free)
+	exec, err := colexec.NewExpressionExecutor(proc, assigned)
+	require.NoError(t, err)
+	t.Cleanup(func() { exec.Free() })
+	value, err := exec.Eval(proc, []*batch.Batch{batch.EmptyForConstFoldBatch}, nil)
+	require.NoError(t, err)
+	// Typed physical replay validates the declared capacity without padding.
+	want := []byte{0x41, 0x42}
+	got, isNull := vector.GenerateFunctionStrParameter(value).GetStrValue(0)
+	require.False(t, isNull)
+	require.Equal(t, want, got)
 }
 
 func TestStoredProcedureVariablesUseDeclaredDecimalType(t *testing.T) {
```

**File**: `pkg/sql/plan/bind_insert_filled_default_test.go` (modified, +15/-2)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"testing"
 
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/stretchr/testify/require"
@@ -112,8 +113,8 @@ func TestImplicitFilledChildDefaultExprMirrorsRuntimeFill(t *testing.T) {
 	require.EqualValues(t, 2, binExpr.Typ.Width, "the BINARY mirror keeps the declared width")
 	binCast := binExpr.GetF()
 	require.NotNil(t, binCast, "BINARY(n) mirrors its fill as an assignment cast")
-	require.Equal(t, "cast", binCast.Func.ObjName,
-		"the BINARY mirror is the plain assignment cast - its zero-fill rule applies in every cast mode")
+	require.Equal(t, "cast_strict", binCast.Func.ObjName,
+		"the BINARY mirror retains the width-constrained assignment boundary")
 	require.Len(t, binCast.Args, 2)
 	require.Equal(t, "", binCast.Args[0].GetLit().GetSval(),
 		"the cast source is the empty payload")
@@ -124,6 +125,18 @@ func TestImplicitFilledChildDefaultExprMirrorsRuntimeFill(t *testing.T) {
 	require.Equal(t, int32(types.T_binary), dstTyp.GetId(),
 		"the cast lands on the column type")
 
+	// Exercise the conversion, not only the selected function name: a
+	// width-constrained assignment must still mirror the runtime zero fill.
+	proc := newPlanTestProcess(t)
+	foldedBinary, err := ConstantFold(batch.EmptyForConstFoldBatch, DeepCopyExpr(binExpr), proc, false, true)
+	require.NoError(t, err)
+	require.NotNil(t, foldedBinary.GetLit())
+	require.Equal(t, "\x00\x00", foldedBinary.GetLit().GetSval(), "BINARY(2) fills with exactly two zero bytes")
+	foldedVarbinary, err := ConstantFold(batch.EmptyForConstFoldBatch, DeepCopyExpr(varbinExpr), proc, false, true)
+	require.NoError(t, err)
+	require.NotNil(t, foldedVarbinary.GetLit())
+	require.Equal(t, "", foldedVarbinary.GetLit().GetSval(), "VARBINARY remains empty without fixed-width padding")
+
 	// The write side stores a filled value for these families (zero uuid,
 	// json null payload) but the plan has no constant for it: the caller must
 	// drop the MATCH-SIMPLE exemption while checking the raw column.
```

**File**: `pkg/sql/plan/build_alter_table.go` (modified, +9/-0)
```diff
@@ -274,6 +274,15 @@ func buildAlterTableCopy(stmt *tree.AlterTable, cctx CompilerContext, bindings a
 	}
 
 	// 2. split alter_option list
+	// A binary conversion must validate the source identity before MODIFY or
+	// CONVERT can erase unsupported persisted collation metadata.
+	for _, option := range stmt.Options {
+		if charset, ok := option.(*tree.TableOptionCharset); ok && charset.Convert && strings.EqualFold(charset.Charset, "binary") {
+			if err := plan.RequireLegacyCollations(tableDef); err != nil {
+				return nil, err
+			}
+		}
+	}
 	copyTableDef, err := buildCopyTableDef(ctx, tableDef)
 	if err != nil {
 		return nil, err
```

**File**: `pkg/sql/plan/build_alter_table_test.go` (modified, +105/-0)
```diff
@@ -2719,3 +2719,108 @@ func TestCheckChangeTypeCompatibleVectorDimension(t *testing.T) {
 	require.NoError(t, checkChangeTypeCompatible(ctx, vec(types.T_varchar, 10), vec(types.T_varchar, 20)),
 		"a non-vector same-type width change is unaffected")
 }
+
+func TestAlterBinaryConversionPreservesDeclaredCapacity(t *testing.T) {
+	databaseDefaultsProtocol(t, defines.MORPCVersion129)
+	for _, tc := range []struct {
+		source string
+		target types.T
+	}{
+		{"char(2)", types.T_binary},
+		{"varchar(2)", types.T_varbinary},
+		{"text", types.T_blob},
+	} {
+		t.Run(tc.source, func(t *testing.T) {
+			mock := newAutoIncrementAlterOptimizer(t)
+			definition, err := buildTestCreateTableStmt(mock, "create table capacity_source(v "+tc.source+")")
+			require.NoError(t, err)
+			original := mock.ctxt.tables["auto_incr_t"]
+			original.Cols[1].Typ = definition.Cols[0].Typ
+			original.DefaultCharset = definition.DefaultCharset
+			before, err := original.Marshal()
+			require.NoError(t, err)
+			p, err := buildSingleStmt(mock, t, "ALTER TABLE constraint_test.auto_incr_t CONVERT TO CHARACTER SET binary")
+			require.NoError(t, err)
+			copy := p.GetDdl().GetAlterTable().CopyTableDef
+			require.Equal(t, int32(tc.target), copy.Cols[1].Typ.Id)
+			require.Equal(t, original.Cols[1].Typ.Width, copy.Cols[1].Typ.Width)
+			require.Zero(t, copy.Cols[1].Typ.CollationVersion)
+			require.Equal(t, uint32(types.CharsetBinary), copy.DefaultCharset)
+			after, err := original.Marshal()
+			require.NoError(t, err)
+			require.Equal(t, before, after)
+		})
+	}
+	for _, corrupt := range []func(*TableDef){
+		func(td *TableDef) { td.Cols[1].Typ.Charset = 4; td.Cols[1].Typ.CollationVersion = 1 },
+		func(td *TableDef) { td.KeyFormat = 1 },
+		func(td *TableDef) { td.Cols[1].Typ.Charset = 256 },
+	} {
+		mock := newAutoIncrementAlterOptimizer(t)
+		original := mock.ctxt.tables["auto_incr_t"]
+		original.Cols[1].Typ = Type{Id: int32(types.T_varchar), Width: 2}
+		corrupt(original)
+		before, err := original.Marshal()
+		require.NoError(t, err)
+		_, err = buildSingleStmt(mock, t, "ALTER TABLE constraint_test.auto_incr_t CONVERT TO CHARACTER SET binary")
+		require.Error(t, err)
+		after, err := original.Marshal()
+		require.NoError(t, err)
+		require.Equal(t, before, after, "rejected source metadata must remain unchanged")
+	}
+}
+
+func TestAlterBinaryConvertAlgorithm(t *testing.T) {
+	for _, tc := range []struct {
+		sql  string
+		want plan.AlterTable_AlgorithmType
+	}{
+		{"ALTER TABLE t CONVERT TO CHARACTER SET binary", plan.AlterTable_COPY},
+		{"ALTER TABLE t DEFAULT CHARACTER SET binary", plan.AlterTable_INPLACE},
+		{"ALTER TABLE t CONVERT TO CHARACTER SET utf8mb4", plan.AlterTable_COPY},
+	} {
+		t.Run(tc.sql, func(t *testing.T) {
+			stmt, err := mysql.ParseOne(context.Background(), tc.sql, 1)
+			require.NoError(t, err)
+			defer stmt.Free()
+			got, err := ResolveAlterTableAlgorithm(context.Background(), stmt.(*tree.AlterTable).Options, &TableDef{})
+			require.NoError(t, err)
+			require.Equal(t, tc.want, got)
+		})
+	}
+}
+
+func TestAlterBinaryConversionUsesFinalCombinedSchema(t *testing.T) {
+	databaseDefaultsProtocol(t, defines.MORPCVersion129)
+	for _, clauses := range []string{
+		"ADD COLUMN extra VARCHAR(2) CHARACTER SET utf8mb4, CONVERT TO CHARACTER SET binary",
+		"ADD COLUMN (extra VARCHAR(2), extra2 VARCHAR(2)), CONVERT TO CHARACTER SET binary",
+		"CONVERT TO CHARACTER SET binary, ADD COLUMN (extra VARCHAR(2), extra2 VARCHAR(2))",
+		"CONVERT TO CHARACTER SET binary, ADD COLUMN extra VARCHAR(2) CHARACTER SET utf8mb4",
+		"MODIFY COLUMN v VARCHAR(2) CHARACTER SET utf8mb4, CONVERT TO CHARACTER SET binary",
+		"CONVERT TO CHARACTER SET binary, MODIFY COLUMN v VARCHAR(2) CHARACTER SET utf8mb4",
+		"CHANGE COLUMN v value_col VARCHAR(2) CHARACTER SET utf8mb4, CONVERT TO CHARACTER SET binary",
+		"CONVERT TO CHARACTER SET binary, CHANGE COLUMN v value_col VARCHAR(2) CHARACTER SET utf8mb4",
+	} {
+		t.Run(clauses, func(t *testing.T) {
+			mock := newAutoIncrementAlterOptimizer(t)
+			old := mock.ctxt.tables["auto_incr_t"]
+			old.Cols[1].Typ = Type{Id: int32(types.T_varchar), Width: 2, Charset: uint32(types.CharsetUTF8)}
+			before, err := old.Marshal()
+			require.NoError(t, err)
+			p, err := buildSingleStmt(mock, t, "ALTER TABLE constraint_test.auto_incr_t "+clauses)
+			require.NoError(t, err)
+			copy := p.GetDdl().GetAlterTable().CopyTableDef
+			for _, col := range copy.Cols {
+				if col.Name == "v" || col.Name == "extra" || col.Name == "extra2" || col.Name == "value_col" {
+					require.Equal(t, int32(types.T_varbinary), col.Typ.Id)
+					require.Equal(t, int32(2), col.Typ.Width)
+				}
+			}
+			require.Equal(t, uint32(types.CharsetBinary), copy.DefaultCharset)
+			after, err := old.Marshal()
+			require.NoError(t, err)
+			require.Equal(t, before, after)
+		})
+	}
+}
```

---

### Incident Patch 3: `4df268ea` (2026-11-11)
**Commit Message**: fix(task): preserve SQL task execution ownership (#32331)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32279
Fixes #32280
Fixes #32281

Part of #32278.

## What this PR does / why we need it:

A SQL task that was still executing could lose exclusion after 24 hours.
Delayed repair could then change a later run, while separate commits for
an async firing and its run result could leave inconsistent metadata.

- Bind admission, retries and completion to the exact firing, run,
runner and epoch. Preserve exclusion across DROP/recreation, atomically
publish run/firing outcomes, and reconcile uncertain commits before an
executor retries SQL.
- Keep known outcomes in bounded, service-owned metadata receipts;
recovery publishes metadata without replaying business SQL. A runner
stopped before an executor wrapper claims a firing leaves that firing
available for recovery instead of marking it failed.
- Keep the parent admission guard, but group same-parent firings within
a fetched batch and reconsider held work through bounded hints and fair
scans. R

**File**: `docs/design/20261025-decimal-unsigned-zerofill.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # DECIMAL UNSIGNED and ZEROFILL attributes
 
-Catalog-upgrade routing follows [the current 4.0.7 design](20261028-catalog-upgrade-407.md); draft version-chain references below do not define additional supported upgrade sources or handlers.
+Catalog-upgrade routing follows [the current 4.0.7 design](20261028-catalog-upgrade-407.md); draft version-chain and offset references below reflect review history and do not define additional supported upgrade sources or handlers.
 
 Issue: [#30940](https://github.com/matrixorigin/matrixone/issues/30940)
 (consolidated tracker, includes the independent report
```

**File**: `docs/design/20261026-declared-catalog-metadata-publication-and-repair.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Declared catalog metadata: publication admission and account repair
 
-The maintained upgrade target is [4.0.7/41](20261028-catalog-upgrade-407.md). This supersedes earlier draft references below to 4.0.18/19 successor routes; those handlers are retired. Stored-view history recognition remains supported independently.
+The maintained upgrade target is [4.0.7](20261028-catalog-upgrade-407.md), with an offset determined by its registered entries. This supersedes earlier draft references below to 4.0.18/19 successor routes; those handlers are retired. Stored-view history recognition remains supported independently.
 
 Status: revision 16 (2026-10-30) - documentation-only evidence
 linkage on top of revision 15; the delivered design content remains
```

**File**: `docs/design/20261028-catalog-upgrade-407.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ Status: design reviewed; validation is required for the final change before deli
 
 The original #31490 design considered stopped, intact 4.1 and 4.2 deployments. For the #32278 follow-up, the supported source is a stopped 4.2 release upgraded directly to current main; intermediate main versions, mixed-version operation and downgrade are out of scope. References to a 4.1 source below describe the earlier design, not an additional acceptance target for this follow-up. This boundary does not erase older data: a 4.2 source can contain snapshots created before that release. The migration must preserve data, existing snapshot records and retention. Ambiguous historical snapshot ownership must follow the user's explicit decision: pause and obtain administrator confirmation by snapshot UUID; do not guess from the snapshot name alone.
 
-The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, using the version/tenant task and startup reconciliation owners described below. Do not register unpublished 4.0.8–4.0.19 identities as new upgrade steps. Before release, fold the later COLUMNS and prefix-aware STATISTICS refreshes into the existing 4.0.7 entries: 27 tenant entries and 14 cluster entries, offset 41. COLUMNS uses the current declared-type definition; STATISTICS uses the current numeric prefix-length projection, with SQL NULL for whole-column indexes. This explicitly supersedes the previous assumption that main's unreleased 4.0.7 was already frozen. Its identity becomes immutable when released, not merely when merged into main. Preserve unrelated current-main behavior.
+The target catalog version is `4.0.7`, above published 4.2's `4.0.6/5`; its offset follows the existing handler metadata contract and is fixed when the final entry set is frozen. Freeze the released 4.0.6 effects; place necessary subsequent effects in 4.0.7, using the version/tenant task and startup reconciliation owners described below. Do not register unpublished 4.0.8–4.0.19 identities as new upgrade steps. Before release, fold the later COLUMNS and prefix-aware STATISTICS refreshes into the existing 4.0.7 entries: 27 tenant entries and 17 cluster entries, offset 44 after the three SQL-task ownership entries. COLUMNS uses the current declared-type definition; STATISTICS uses the current numeric prefix-length projection, with SQL NULL for whole-column indexes. This explicitly supersedes the previous assumption that main's unreleased 4.0.7 was already frozen. Its identity becomes immutable when released, not merely when merged into main. Preserve unrelated current-main behavior.
 
 On a v4.2.6 source, unmodified main reached 4.0.17 and retained the sampled user rows, but lacked foreign-key metadata columns and UDF `arg_types`: main had appended them to the already-consumed 4.0.6 handler. On a freshly initialized v4.1.0 source, first startup on PR head timed out waiting for query-ready CN inventory while the older upgrade route had not yet created `mo_view_refresh`. On one unmodified restart, the route created that table and the CN appeared in query-ready inventory about two seconds later. The source fixture had working indexed/FK tables, a function, a procedure and account snapshots. After the resumed upgrade, table/tenant rows and FK enforcement remained, but the function, procedure and restoring the 4.1 account snapshot all failed because `sql_mode` was missing; historical table reads still worked.
 
```

**File**: `docs/design/20261106-sql-task-completion-ownership.md` (added, +412/-0)
```diff
@@ -0,0 +1,412 @@
+# SQL task execution ownership and recovery
+
+Implementation: [PR #32331](https://github.com/matrixorigin/matrixone/pull/32331).
+Issues: [#32279](https://github.com/matrixorigin/matrixone/issues/32279),
+[#32280](https://github.com/matrixorigin/matrixone/issues/32280), and
+[#32281](https://github.com/matrixorigin/matrixone/issues/32281).
+
+## Problem and scope
+
+A SQL task with no timeout may run indefinitely, including across several
+statements. Age, CN membership, and a heartbeat timeout do not prove that its
+SQL has stopped. The existing age reaper can therefore admit a second run
+while the first is still executing. The async failure repair also guesses a run
+from task/account/CN, and can corrupt a later run; async completion and run
+repair can be committed separately, leaving a permanent RUNNING record.
+
+Fix #32279, #32280 and #32281 together at the task-storage boundary. Ordinary
+SQL statements receive no additional query, RPC or per-statement check.
+
+## Design decision
+
+| Approach | Correctness and recovery | Cost and limitation |
+| --- | --- | --- |
+| Existing age-based reaper and guessed repair | Can admit overlapping SQL and modify the wrong run; split commits can strand RUNNING metadata. | Small, but does not satisfy the ownership contract. |
+| Lease and fence every business effect | A lease cannot itself stop SQL; fencing is safe only where every effect, including external effects, accepts the fence. | Broad execution and integration changes, with a new availability dependency. |
+| Durable replicated result journal | Could recover known results after the executor process is lost. | Adds persistent infrastructure, upgrade, bounded admission and crash-recovery obligations. |
+| Atomic run/async identity and bounded live receipts (selected) | Prevents guessed ownership changes and lets the live service publish a known outcome without rerunning SQL. | A process loss may retain RUNNING and need operator reconciliation; receipts are not durable. |
+
+The selected boundary addresses all three failures without adding a check to
+ordinary SQL. It deliberately does not claim exactly-once business effects or
+automatic recovery when the owner and its in-memory receipts are lost.
+
+## Ownership and normal execution
+
+* Under the definition row lock, an existing RUNNING run for the same
+  `(account_id, task_name)` blocks admission, even if the definition was
+  dropped and recreated. Duration and timeout alone never release it.
+* A scheduled async row has one internal `sql_task_run_id` pointer. In one
+  transaction, validate its runner/epoch, definition, schedule generation and
+  exact firing ID; insert RUNNING and set the pointer. Manual execution uses
+  the same RUNNING barrier without an async row. An executor starts the gate or
+  body only after successful admission.
+* The existing `TaskStorage` contract exposes the atomic ownership operations
+  and bounded ID scan with value-only requests, so storage decorators can
+  forward the same transaction boundary. `TaskService.SQLTaskService` identifies
+  the single owner of SQL task recovery. A service wrapper must return that
+  owner and the same authoritative storage object; otherwise admission fails
+  before SQL. Neither a second recovery service nor a second completion path
+  is created.
+* Persist the known run result and complete its exact async pointer in one
+  transaction. Retry attempts atomically finish attempt A, insert RUNNING B,
+  and, for scheduled tasks, move the pointer before B starts; manual retries
+  use the same transition without an async row. The already admitted executor,
+  not a new-request admission guard, owns the retry. It can retry a failed
+  metadata transition for at most five seconds while its execution and service
+  remain live. An uncertain COMMIT is reconciled against the frozen result,
+  both exact run IDs and, for a scheduled run, its runner, epoch and pointer.
+  Only that same live executor may start B after reconciliation proves its
+  ownership. No business SQL is run by the metadata receipt worker. Ordinary
+  SUSPEND and SET SCHEDULE do not cancel retries of an already claimed firing.
+  A late owner or scheduler completion
+  must never update another run. A typed/wrapped/joined `ErrTxnUnknown` keeps
+  the RUNNING barrier, preserves the original error, and does not rerun SQL.
+  Once that unknown reason is durably recorded, release the receipt credit but
+  retain RUNNING. This differs from an unknown metadata COMMIT/ACK, which
+  retains the already known business result for reconciliation.
+* Deleting a definition does not delete its run history. A suspended or
+  modified schedule invalidates previously queued, unclaimed scheduled
+  firings; ordinary business errors do not permanently disable later firings.
+
+Admission binds identity and reserves capacity from the locked definition,
+not caller-supplied names; a mismatched run identity is rejected. Comp
```

**File**: `pkg/bootstrap/service_upgrade_cdc_test.go` (modified, +3/-5)
```diff
@@ -115,9 +115,7 @@ func TestLegacyCDCAdmissionBeforeUpgradeMutation(t *testing.T) {
 }
 
 // TestLegacyCDCAdmissionEmptyCatalogAdmitsSourceOnward pins that a source
-// below the frozen stage with no legacy CDC tasks admits past the gate and
-// proceeds to create the consolidated route - the successor keeps upstream's
-// admission/passage contract at the 4.0.7 final.
+// with no legacy CDC tasks admits past the gate to the pending 4.0.7 target.
 func TestLegacyCDCAdmissionEmptyCatalogAdmitsSourceOnward(t *testing.T) {
 	runtime.RunTest("", func(runtime.Runtime) {
 		source := v4_0_6.Handler.Metadata()
@@ -142,8 +140,8 @@ func TestLegacyCDCAdmissionEmptyCatalogAdmitsSourceOnward(t *testing.T) {
 		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
 		t.Cleanup(s.stopper.Stop)
 		require.NoError(t, s.doCheckUpgrade(t.Context()))
-		require.Len(t, routes, 1, "a released 4.0.6 source crosses only the consolidated 4.0.7 step")
-		require.Contains(t, fmt.Sprint(routes), fmt.Sprintf("'%s', '%s', '4.0.7',", source.Version, v4_0_7.Handler.Metadata().Version))
+		require.Len(t, routes, 1)
+		require.Contains(t, routes[0], fmt.Sprintf("'%s', '%s', '4.0.7',", source.Version, v4_0_7.Handler.Metadata().Version))
 	})
 }
 
```

**File**: `pkg/bootstrap/service_upgrade_crossing_test.go` (modified, +3/-3)
```diff
@@ -102,7 +102,7 @@ func (db *crossingFakeDB) exec(sql string) (executor.Result, error) {
 	case sql == versions.LatestVersionSQL:
 		v := db.latest
 		if db.finalExists {
-			v = versions.Version{Version: "4.0.7", VersionOffset: 41, State: db.finalState}
+			v = versions.Version{Version: "4.0.7", VersionOffset: v4_0_7.Handler.Metadata().VersionOffset, State: db.finalState}
 		}
 		return recoveryVersionResult(db.t, v), nil
 	case strings.HasPrefix(sql, "select state from mo_version"):
@@ -263,7 +263,7 @@ func (db *crossingFakeDB) mutations() []string {
 func newCrossingService(t *testing.T, db *crossingFakeDB) *service {
 	t.Helper()
 	s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, db,
-		func(s *service) { s.initUpgrade() })
+		(*service).initUpgrade)
 	t.Cleanup(s.stopper.Stop)
 	return s
 }
@@ -377,7 +377,7 @@ func TestCrossingRestartMidCrossingRejectsLegacyTask(t *testing.T) {
 		db.finalExists = true
 		db.finalSteps = crossingFinalSteps()
 		db.cdcTasks = [][]string{{"10001", "task-uuid", "old-task", "paused"}}
-		db.latest = versions.Version{Version: "4.0.7", VersionOffset: 41, State: versions.StateCreated}
+		db.latest = versions.Version{Version: "4.0.7", VersionOffset: v4_0_7.Handler.Metadata().VersionOffset, State: versions.StateCreated}
 		s := newCrossingService(t, db)
 		err := s.doCheckUpgrade(t.Context())
 		requireCrossingTerminalLegacyTask(t, err, "10001", "task-uuid", "paused")
```

**File**: `pkg/bootstrap/service_upgrade_recovery_test.go` (modified, +1/-1)
```diff
@@ -817,7 +817,7 @@ func TestV407ReadySourceDoesNotCreateAnotherRoute(t *testing.T) {
 				return executor.Result{}, nil
 			}
 		}, &testTxnOperator{})
-		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+		s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, (*service).initUpgrade)
 		t.Cleanup(s.stopper.Stop)
 		require.NoError(t, s.doCheckUpgrade(t.Context()))
 		require.Empty(t, routes, "a completed current catalog must not create another route")
```

**File**: `pkg/bootstrap/service_upgrade_tenant_v407_test.go` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ func TestManualFinalReadyAccountDoesNotReplay(t *testing.T) {
 						return executor.Result{}, nil
 					}
 				}, &testTxnOperator{})
-				s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, func(s *service) { s.initUpgrade() })
+				s := newServiceForTest("", &memLocker{}, clock.NewHLCClock(func() int64 { return 0 }, 0), nil, exec, (*service).initUpgrade)
 				t.Cleanup(s.stopper.Stop)
 				err := s.UpgradeOneTenant(t.Context(), 7)
 				if mismatch {
```

#### Recent Merged Pull Requests:
- **PR #32564** (2026-11-11): ci: run pinned coverage comparison on MNL2 (@Ariznawlll)
- **PR #32554** (2026-11-11): docs(defect-hunt): record vector index cache eventual-consistency ruling (@cpegeric)
- **PR #32535** (2026-11-11): fix: reject overflowing datetime generate_series steps (@XuPeng-SH)
- **PR #32524** (2026-11-11): ci: add isolated CS coverage canary for PR 32523 (@Ariznawlll)
- **PR #32517** (2026-11-11): fix(python): trim export query whitespace before terminators (@MatrixAdventurer)
- **PR #32510** (2026-11-11): feat(plan): widen functional index expression eligibility and diagnostics (@gouhongshen)

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

## X. disttae): budget transaction workspace batch copies (#32458)

**RULE**:
When implementing operations in `docs/design/txn-workspace-memory.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `56ad29d8`: disttae): budget transaction workspace batch copies (#32458). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/txn-workspace-memory.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Transaction workspace allocation admission, revision 1

Owner: issue #32008; implementation PR pending. Base: 745d25375de6.
Design-first review: PASS, reviewed before implementation in this task.

Invariant: a workspace-owned physical vector allocation is admitted against its
own lifetime account and the existing CN ledger before backing is allocated.
Free is the sole refund owner. Source and destination copies coexist and are
both charged. A workspace never closes the Process generation it borrowed.

Each workspace lazily opens an independent generation on the Process generation's
CN ledger, including snapshot workspaces sharing a Process. A separate mutex
serializes creation and terminal closure without reentering the workspace mutex.
States: absent -> open -> terminal. Terminal cannot reopen. Partial construction
closes its private generation. Final cleanup seals/publishes the account only
after workspace batches are cleaned; nonzero snapshots retain the existing
release-capable tombstone semantics. Statement rollback retains earlier writes.

Use the existing allocator-backed off-heap vector APIs, destination-selected
CopyBatch, and append-only owner catalog. Preserve generic 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `56ad29d8` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
