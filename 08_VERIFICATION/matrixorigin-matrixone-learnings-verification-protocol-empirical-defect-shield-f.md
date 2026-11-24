# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin-matrixone-learnings

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin-matrixone-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T06:55:23.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matrixorigin-matrixone-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin-matrixone-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T06:55:23.583Z`  
> **Learning ID**: `LEARN-EVO-matrixorigin-matrixone-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin-matrixone-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `8b1e884e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T06:55:17.750Z  
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
> **Harvest Timestamp**: 2026-11-24T06:55:17.743Z  
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
- **Issue #33129** (2026-11-24): **Return fileservice read buffer allocation errors**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  - #33095  ## What this PR does / why we need it:  Fileservice panics when it needs a new read buffer and the allocator returns `ENOMEM`. Return the allocator error to the caller before reading or marking the entry complete. A read with sufficient existing capacity reuses that buffer without allocating.  If a LocalFS read fails after allocating a new buffer, its rollback clears the owning entry and releases the buffer once. If the read reuses an existing buffer, LocalFS publishes the resized slice only after both the read and cache conversion succeed. Disk cache reads retain their existing fallback on errors.  ### Validation  - Main baseline `e17d5541537d30252009a9a2d4c70ab5480d3bc3` (macOS arm64, Go 1.27.1). The issue's one-byte reproducer panicked after one allocation attempt when a buffer was needed. The existing-buffer case read the byte with zero allocations. The issue reports the same baseline behavior on `4.2-dev`. - Main candidate `be16d27be8fb21cd716620c4c7b86f1bc8e1f238` (macOS arm64, Go 1.27.1 with CGo). `make -j8 build`, the issue's reproducer, focused fileservice tests, QA probes, and changed-code lint passed. - `4.2-dev` candidate `fe121f6df07f1ac60826c5df1651c7ecbe108d96` (macOS arm64, Go 1.26.4 with CGo). Its branch-specific `make -j8 build` and the same reproducer, focused filese

- **Issue #33128** (2026-11-24): **fix(disttae): tie insert logtail buffers to snapshot lifetime**
  *Symptoms*: ## What type of PR is this?  - [x] BUG  ## Which issue(s) this PR fixes  Fixes #33118. Regression introduced by #33052.  ## What changed  Insert replay passed the engine mpool to protobuf decoding. This copied column data/area into native vectors, but retiring a row removes the row and index entries without owning the last reference to that batch. Multiple partition snapshots may still read it. Consequently, freeing on row removal would be unsafe; leaving the copy as-is leaks it.  Use a read-only view of the received logtail instead: the client unmarshals each response into fresh Go buffers, and a snapshot keeps exactly the referenced buffers alive. Direct/local insert callers (notably catalog bootstrap) can supply a protobuf view over mutable engine vectors, so detach those inputs on the Go heap when retaining row data. Both entry points use the same replay implementation. No per-row release, finalizer, background task, or wire/SQL format change.  ## Validation  - Same test on unchanged main `07d7baa32a`: after actual object retirement the replay pool retained 67 B (received), 67 B (local), and 103 B (keys-only). The fix returns all three to zero and an older snapshot still returns the original key and out-of-line varchar. - Negative control: merely changing the original decoder argument to nil clears the pool but makes the local snapshot return key 0 after its source is overwritten (expected 42). - Full logtailreplay package passes both normal and race builds. The exact reg

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

### Incident Patch 1: `32c9bc65` (2026-11-23)
**Commit Message**: fix(prepare): never allocate for parameter binding after the first execution (#33076) (#33081)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #33076

## What this PR does / why we need it:

Fixes the sysbench regression from #33011 (typed prepared parameters)
without reverting it. The affected workloads are `random_points`,
`random_ranges` and `nopk_random_points`, with ps-mode=auto.

**Rule applied:** a prepared statement allocates what parameter binding
needs, holds it in the statement, and reuses it. After the first
execution, binding allocates only when a value needs more room than
before.

### Cause
Binding allocated on every EXECUTE and in every expression executor:
- `installTypedPrepareParams` built a new batch, plus one vector per
parameter, on every execution.
- Each `ParamExpressionExecutor` copied its parameter: a `Dup` of the
typed value, or a new constant for a string. The per-EXECUTE diagnostic
probes (`ProbePreparedDiagnosticCandidatesWithProof`) and `EvalFoldExpr`
build fresh executor trees, so every `?` in `k IN (?, …)` wa

**File**: `pkg/container/vector/vector.go` (modified, +23/-3)
```diff
@@ -6377,25 +6377,45 @@ func (v *Vector) window(start, end int, logicalRows bool) (*Vector, error) {
 	return v.readOnlyWindow(start, end), nil
 }
 
+// WindowInto is Window into a descriptor the caller already holds: w becomes a
+// read-only reference to [start, end) of v's memory without allocating a new
+// Vector. w must be read-only (a reference or a zero Vector); whatever it
+// referenced before is dropped.
+func (v *Vector) WindowInto(w *Vector, start, end int) error {
+	if !w.IsReadOnly() {
+		return moerr.NewInternalErrorNoCtx("vector window target owns memory")
+	}
+	if !v.validWindowRange(start, end, false) {
+		return moerr.NewInvalidInputNoCtx("invalid vector window")
+	}
+	v.readOnlyWindowInto(w, start, end)
+	return nil
+}
+
 // readOnlyWindow is a read-only reference to [start, end) of v's memory. Row
 // metadata is copied.
 func (v *Vector) readOnlyWindow(start, end int) *Vector {
-	w := &Vector{typ: v.typ, class: v.class, length: end - start, sorted: v.sorted}
+	w := &Vector{}
+	v.readOnlyWindowInto(w, start, end)
+	return w
+}
+
+func (v *Vector) readOnlyWindowInto(w *Vector, start, end int) {
+	*w = Vector{typ: v.typ, class: v.class, length: end - start, sorted: v.sorted}
 	nulls.Range(&v.nsp, uint64(start), uint64(end), uint64(start), &w.nsp)
 	if v.IsConst() {
 		if !v.IsConstNull() {
 			w.data = v.data
 		}
 		w.area = v.area
-		return w
+		return
 	}
 	if start != end {
 		w.data = v.data[start*v.typ.TypeSize() : end*v.typ.TypeSize()]
 	}
 	if v.typ.IsVarlen() {
 		w.area = v.area
 	}
-	return w
 }
 
 func (v *Vector) validWindowRange(start, end int, logicalRows bool) bool {
```

**File**: `pkg/frontend/computation_wrapper.go` (modified, +128/-17)
```diff
@@ -30,6 +30,7 @@ import (
 	"github.com/mohae/deepcopy"
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -1831,13 +1832,15 @@ func initExecuteStmtParamWithResolverInSession(
 				showPublicationPatternPositions = []int32{0}
 			}
 		}
-		params, paramVals, paramIsBin, _, _, _, err := buildExecuteUserParamsWithMemberOfPositions(
-			cwft.proc, executionSes.GetTxnCompileCtx().ResolveVariablePrepareParamKind, execPlan.Args, prepareStmt.jsonComparisonParamPositions,
+		params, paramVals, paramIsBin, _, _, _, err := buildExecuteUserParamsInto(
+			&prepareStmt.userParams, cwft.proc, executionSes.GetTxnCompileCtx().ResolveVariablePrepareParamKind, execPlan.Args, prepareStmt.jsonComparisonParamPositions,
 			prepareStmt.jsonMemberOfParamPositions, prepareStmt.inetNtoaParamPositions, showPublicationPatternPositions)
 		if err != nil {
 			return nil, nil, nil, originSQL, false, err
 		}
-		cwft.proc.SetOwnedPrepareParamsWithIsBin(params, paramIsBin)
+		// The statement owns the parameters; the process borrows them.
+		cwft.proc.SetPrepareParamsWithIsBin(params, paramIsBin)
+		prepareStmt.userParams.lend(cwft.proc)
 		cwft.proc.SetPrepareParamsStringSource(types.StringSourceSQLPrepare)
 		cwft.paramVals = paramVals
 		if !sourceBindingQuery {
@@ -1867,7 +1870,7 @@ func initExecuteStmtParamWithResolverInSession(
 		// still read their parameters with source types. A parameter whose
 		// source type cannot be determined keeps the TEXT transport.
 		if bindings, bindErr := preparedExecutionBindings(reqCtx, cwft.paramVals, prepareStmt.ParamTypes, nil); bindErr == nil {
-			if err = installTypedPrepareParams(cwft.proc, bindings); err != nil {
+			if err = installTypedPrepareParams(cwft.proc, bindings, &prepareStmt.typedParams); err != nil {
 				return nil, nil, nil, originSQL, false, err
 			}
 		}
@@ -1881,7 +1884,7 @@ func initExecuteStmtParamWithResolverInSession(
 		if err != nil {
 			return nil, nil, nil, originSQL, false, err
 		}
-		if err = installTypedPrepareParams(cwft.proc, cwft.paramBindings); err != nil {
+		if err = installTypedPrepareParams(cwft.proc, cwft.paramBindings, &prepareStmt.typedParams); err != nil {
 			return nil, nil, nil, originSQL, false, err
 		}
 		// Update only after the full protocol payload and typed bindings are
@@ -2630,6 +2633,82 @@ func untypedUserParamKindForType(typ types.T) (types.StringConversionKind, bool)
 	}
 }
 
+// executeUserParams is the storage SQL EXECUTE ... USING binds its
+// parameters into. A prepared statement owns one for its whole life and every
+// execution rewrites it in place: the TEXT vector restarts from an empty area
+// that keeps its capacity and the slices are reused, so after the first
+// execution binding allocates only when a value needs more room than before.
+// The process borrows the vector.
+type executeUserParams struct {
+	mp           *mpool.MPool
+	vec          *vector.Vector
+	vals         []any
+	isBin        []bool
+	binaryString []bool
+	domains      []types.RuntimeStringDomain
+	kinds        []types.StringConversionKind
+	types        []types.T
+	borrowers    []*process.Process
+}
+
+// release frees the storage, detaching the processes that borrowed it.
+func (u *executeUserParams) release() {
+	if u == nil || u.vec == nil {
+		return
+	}
+	for _, proc := range u.borrowers {
+		if proc != nil && proc.GetPrepareParams() == u.vec {
+			proc.SetPrepareParams(nil)
+		}
+	}
+	u.vec.Free(u.mp)
+	*u = executeUserParams{}
+}
+
+// lend records that proc borrows the storage. A process that no longer
+// borrows it (freed, or rebound to other parameters) is forgotten, so an
+// owner that runs many executions, each on a fresh process, such as a stored
+// procedure, retains only the processes that still borrow the storage.
+func (u *executeUserParams) lend(proc *process.Process) {
+	u.borrowers = slices.DeleteFunc(u.borrowers, func(borrower *process.Process) bool {
+		return borrower != proc && (borrower == nil || borrower.GetPrepareParams() != u.vec)
+	})
+	if !slices.Contains(u.borrowers, proc) {
+		u.borrowers = append(u.borrowers, proc)
+	}
+}
+
+func resetSlice[T any](s []T, n int) []T {
+	if cap(s) < n {
+		return make([]T, n)
+	}
+	s = s[:n]
+	clear(s)
+	return s
+}
+
+// prepare readies the storage for an execution with n parameters.
+func (u *executeUserParams) prepare(proc *process.Process, n int) {
+	if u.vec != nil && u.mp != proc.Mp() {
+		// The vector is rewritten through this execution's pool.
+		u.release()
+	}
+	if u.vec == nil {
+		u.mp = proc.Mp()
+		u.vec = vector.NewVec(types.T_text.ToType(), u.mp)
+	} else {
+		u.vec.CleanOnlyData()
+	}
+	u.vals = resetSlice(u.vals, n)
+	u.isBin = resetSlice(u.isBin, n)
+	u.binaryString = resetSlice(u.binaryString, n)
+	u.domains = resetSlice(u.d
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +96/-4)
```diff
@@ -20,13 +20,15 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"strconv"
 	"strings"
 	"testing"
 	"time"
 
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/config"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
@@ -429,16 +431,17 @@ func TestInitExecuteStmtParamPreservesStaticBinarySourceType(t *testing.T) {
 	require.NoError(t, ses.SetUserDefinedVar("binary_param", "now-text", ""))
 	_, _, _, _, _, err = initExecuteStmtParam(execCtx, ses, cw, execPlan, "")
 	require.NoError(t, err)
-	require.Zero(t, params.Length(), "the previous owned params must be released on successful replacement")
-	require.Nil(t, params.GetData())
+	// The statement owns its parameter storage and every execution rewrites it.
+	require.Same(t, params, cw.proc.GetPrepareParams(), "the statement's parameter storage is reused")
 	require.False(t, cw.proc.GetPrepareParamIsBin(0))
 	require.Equal(t, "now-text", cw.proc.GetPrepareParams().GetStringAt(0))
 	require.Equal(t, types.StringSourceSQLPrepare, cw.proc.GetPrepareParamsStringSource())
 
 	current := cw.proc.GetPrepareParams()
 	cw.proc.SetPrepareParams(vector.NewVec(types.T_text.ToType(), cw.proc.Mp()))
-	require.Zero(t, current.Length())
-	require.Nil(t, current.GetData())
+	// The process only borrowed them: installing other parameters frees nothing
+	// of the statement's, which releases its storage when it is closed.
+	require.Equal(t, "now-text", current.GetStringAt(0))
 	require.False(t, cw.proc.GetPrepareParamIsBin(0), "binary metadata must not leak into the next execution")
 	cw.proc.GetPrepareParams().Free(cw.proc.Mp())
 	cw.proc.SetPrepareParams(nil)
@@ -7444,3 +7447,92 @@ func requireTypedParamOid(t *testing.T, proc *process.Process, i int, want types
 	require.NotNil(t, typed, "parameter %d must carry a typed value", i)
 	require.Equal(t, want, typed.GetType().Oid)
 }
+
+// SQL EXECUTE ... USING binds into storage the statement owns: after the first
+// execution it allocates only when a value needs more room than before.
+func TestBuildExecuteUserParamsReusesStatementStorage(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	values := map[string]any{}
+	proc.SetResolveVariableFunc(func(name string, _, _ bool) (any, error) { return values[name], nil })
+	args := []*plan.Expr{
+		{Expr: &plan.Expr_V{V: &plan.VarRef{Name: "n"}}},
+		{Expr: &plan.Expr_V{V: &plan.VarRef{Name: "s"}}},
+	}
+	var store executeUserParams
+	t.Cleanup(store.release)
+	bind := func(n int64, s string) *vector.Vector {
+		values["n"], values["s"] = n, s
+		params, vals, _, _, _, _, err := buildExecuteUserParamsInto(&store, proc, nil, args, nil, nil)
+		require.NoError(t, err)
+		require.Len(t, vals, 2)
+		proc.SetPrepareParamsWithIsBin(params, store.isBin)
+		store.lend(proc)
+		return params
+	}
+	long := func(c byte, n int) string { return strings.Repeat(string(c), n) }
+
+	first := bind(1, long('a', 40))
+	allocs := proc.Mp().Stats().NumAlloc.Load()
+	for i, c := range []byte("bcd") {
+		params := bind(int64(i+2), long(c, 40))
+		require.Same(t, first, params)
+		require.Equal(t, strconv.Itoa(i+2), params.GetStringAt(0))
+		require.Equal(t, long(c, 40), params.GetStringAt(1))
+	}
+	require.Equal(t, allocs, proc.Mp().Stats().NumAlloc.Load(), "re-executing must not allocate")
+
+	// A longer value grows the storage; the same vector is still used.
+	require.Same(t, first, bind(9, long('x', 200)))
+	require.Equal(t, long('x', 200), first.GetStringAt(1))
+
+	// Releasing the statement detaches the process that borrowed it.
+	store.release()
+	require.Nil(t, proc.GetPrepareParams())
+	require.Zero(t, proc.Mp().CurrNB())
+}
+
+// A stored procedure can run the same EXECUTE ... USING many times, each on a
+// fresh process over the same session pool. The statement storage must not
+// retain every process it ever lent to: a finished process is forgotten.
+func TestExecuteUserParamsForgetsFinishedProcesses(t *testing.T) {
+	mp := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { mpool.DeleteMPool(mp) })
+	values := map[string]any{"s": "value"}
+	args := []*plan.Expr{{Expr: &plan.Expr_V{V: &plan.VarRef{Name: "s"}}}}
+	var store executeUserParams
+	t.Cleanup(store.release)
+
+	var first *vector.Vector
+	for i := range 32 {
+		proc := testutil.NewProcessWithMPool(t, "", mp)
+		proc.SetResolveVariableFunc(func(name string, _, _ bool) (any, error) { return values[name], nil })
+		params, _, _, _, _, _, err := buildExecuteUserParamsInto(&store, proc, nil, args, nil, nil)
+		require.NoError(t, err)
+		if i == 0 {
+			first = params
+		}
+		require.Same(t, first, params, "the storage is reused on the same pool")
+		proc.SetPrepareParamsWithIsBin(params, store.isBin)
+		store.lend(proc)
+		require.Len(t, store.borrowers, 1, "only the current execution'
```

**File**: `pkg/frontend/mysql_protocol.go` (modified, +7/-0)
```diff
@@ -1080,6 +1080,13 @@ func (mp *MysqlProtocolImpl) ParseExecuteData(ctx context.Context, proc *process
 			newParamTypes = true
 		}
 
+		// Every position is rewritten below (long data, NULL or a value), so
+		// this execution starts from an empty area that keeps its capacity: the
+		// statement's parameter storage grows only when this execution's strings
+		// need more room than any earlier one, and is otherwise reused.
+		stmt.params.CleanOnlyData()
+		stmt.params.SetLength(numParams)
+
 		// get paramters and set value to session variables
 		for i := 0; i < numParams; i++ {
 			// Materialize each streamed parameter only once. Long data takes
```

**File**: `pkg/frontend/mysql_protocol_execute_boundary_test.go` (modified, +44/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"encoding/binary"
 	"net"
+	"strings"
 	"testing"
 	"time"
 
@@ -282,3 +283,46 @@ func TestParseExecuteDataNonzeroNewTypesWithNullParam(t *testing.T) {
 	require.Equal(t, []byte{byte(defines.MYSQL_TYPE_TINY), 0}, stmt.ParamTypes)
 	require.True(t, stmt.params.GetNulls().Contains(0))
 }
+
+// A string parameter is rewritten into the statement's existing parameter
+// storage: after the first execution its area grows only for a longer value.
+func TestParseExecuteDataReusesStringParamStorage(t *testing.T) {
+	ctx := context.Background()
+	proto, proc, stmt := newBinaryPrepareProtocolTestCase(t, "select ?")
+	defer stmt.Close()
+	packet := func(value string) []byte {
+		data := []byte{0, 1, 0, 0, 0, 0, 1, byte(defines.MYSQL_TYPE_VAR_STRING), 0}
+		data = append(data, byte(len(value)))
+		return append(data, value...)
+	}
+	long := func(c byte, n int) string { return strings.Repeat(string(c), n) }
+
+	require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt, packet(long('a', 40)), 0))
+	require.Equal(t, long('a', 40), stmt.params.GetStringAt(0))
+	area := len(stmt.params.GetArea())
+	allocs := proc.Mp().Stats().NumAlloc.Load()
+	for _, c := range []byte("bcdef") {
+		require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt, packet(long(c, 40)), 0))
+		require.Equal(t, long(c, 40), stmt.params.GetStringAt(0))
+		require.Equal(t, area, len(stmt.params.GetArea()), "the area is reused, not appended to")
+	}
+	require.Equal(t, allocs, proc.Mp().Stats().NumAlloc.Load(), "re-executing must not allocate")
+
+	// A longer value grows the storage once; shorter ones reuse it.
+	require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt, packet(long('x', 100)), 0))
+	require.Equal(t, long('x', 100), stmt.params.GetStringAt(0))
+	allocs = proc.Mp().Stats().NumAlloc.Load()
+	for _, n := range []int{100, 40, 3, 100} {
+		require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt, packet(long('y', n)), 0))
+		require.Equal(t, long('y', n), stmt.params.GetStringAt(0))
+	}
+	require.Equal(t, allocs, proc.Mp().Stats().NumAlloc.Load())
+
+	// NULL after a value, then a value again.
+	require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt,
+		[]byte{0, 1, 0, 0, 0, 1, 0}, 0))
+	require.True(t, stmt.params.GetNulls().Contains(0))
+	require.NoError(t, proto.ParseExecuteData(ctx, proc, stmt, packet("z"), 0))
+	require.False(t, stmt.params.GetNulls().Contains(0))
+	require.Equal(t, "z", stmt.params.GetStringAt(0))
+}
```

**File**: `pkg/frontend/mysql_protocol_test.go` (modified, +1/-1)
```diff
@@ -6883,7 +6883,7 @@ func installTestTypedPrepareParams(t *testing.T, proc *process.Process, typs ...
 	for i, typ := range typs {
 		bindings[i] = plan.PreparedSourceBinding{Position: int32(i), Type: typ}
 	}
-	require.NoError(t, installTypedPrepareParams(proc, bindings))
+	require.NoError(t, installTypedPrepareParams(proc, bindings, nil))
 	for i := range typs {
 		require.NotNil(t, proc.GetTypedPrepareParam(i), "parameter %d must carry a typed value", i)
 	}
```

**File**: `pkg/frontend/prepared_typed_params.go` (modified, +183/-77)
```diff
@@ -18,13 +18,51 @@ import (
 	"strconv"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/common/util"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
 	"github.com/matrixorigin/matrixone/pkg/vm/process"
 )
 
+// typedPrepareParams is the typed form of a prepared statement's parameters.
+// The statement owns it for its whole life: vectors are allocated the first
+// time a position is bound in a type and are overwritten in place by every
+// later execution, so steady-state parameter binding allocates nothing. The
+// process only borrows the batch and the conversion store.
+type typedPrepareParams struct {
+	mp *mpool.MPool
+	// batch is what the process sees: column i is parameter i, or nil when
+	// this execution has no typed value for it.
+	batch *batch.Batch
+	// slots own the vectors; a slot keeps its vector while the batch hides it.
+	slots       []*vector.Vector
+	conversions *process.TypedParamConversions
+}
+
+// release frees everything the statement owns. A process that still borrows
+// the batch is detached first.
+func (t *typedPrepareParams) release(procs ...*process.Process) {
+	if t == nil || t.mp == nil {
+		return
+	}
+	for _, proc := range procs {
+		if proc != nil && t.batch != nil && proc.GetTypedPrepareParams() == t.batch {
+			proc.SetBorrowedTypedPrepareParams(nil, nil)
+		}
+	}
+	for i, vec := range t.slots {
+		if vec != nil {
+			vec.Free(t.mp)
+			t.slots[i] = nil
+		}
+	}
+	t.conversions.Free()
+	*t = typedPrepareParams{}
+}
+
 // installTypedPrepareParams gives the process each bound parameter as one row
 // of its source SQL type, so a ParamRef bound to that type is evaluated without
 // a TEXT round trip. The values come from the TEXT transport, which holds the
@@ -33,22 +71,85 @@ import (
 // A position is left without a typed value (nil column) when its binding is a
 // string or unsupported type, or when its text does not parse exactly; the
 // executor then keeps the TEXT transport for that position.
-func installTypedPrepareParams(proc *process.Process, bindings []plan2.PreparedSourceBinding) error {
+//
+// With a statement-owned store the values are written into the store's
+// vectors and the process borrows them. Without one (store == nil) the
+// process gets a batch of its own.
+func installTypedPrepareParams(proc *process.Process, bindings []plan2.PreparedSourceBinding, store *typedPrepareParams) error {
 	params := proc.GetPrepareParams()
 	if params == nil || params.Length() == 0 || len(bindings) == 0 {
 		return nil
 	}
+	if store == nil {
+		return installOwnedTypedPrepareParams(proc, params.Length(), bindings)
+	}
+	if store.mp != nil && store.mp != proc.Mp() {
+		// The store is rewritten through this execution's pool.
+		store.release(proc)
+	}
+	n := params.Length()
+	if store.mp == nil {
+		store.mp = proc.Mp()
+		store.conversions = process.NewTypedParamConversions(store.mp)
+	}
+	if store.batch == nil || len(store.batch.Vecs) != n {
+		for i := n; i < len(store.slots); i++ {
+			if store.slots[i] != nil {
+				store.slots[i].Free(store.mp)
+			}
+		}
+		if cap(store.slots) >= n {
+			store.slots = store.slots[:n]
+		} else {
+			store.slots = append(store.slots, make([]*vector.Vector, n-len(store.slots))...)
+		}
+		store.batch = batch.NewWithSize(n)
+	}
+	bat := store.batch
+	clear(bat.Vecs)
+	installed := false
+	for _, binding := range bindings {
+		pos := int(binding.Position)
+		if pos < 0 || pos >= n || params.IsNull(uint64(pos)) {
+			continue
+		}
+		raw, err := proc.GetPrepareParamsAt(pos)
+		if err != nil {
+			return err
+		}
+		ok, err := setTypedPrepareParam(&store.slots[pos], proc, binding.Type, raw, store.mp)
+		if err != nil {
+			return err
+		}
+		if ok {
+			bat.Vecs[pos] = store.slots[pos]
+			installed = true
+		}
+	}
+	if !installed {
+		return nil
+	}
+	bat.SetRowCount(1)
+	if err := store.conversions.Refresh(bat); err != nil {
+		return err
+	}
+	proc.SetBorrowedTypedPrepareParams(bat, store.conversions)
+	return nil
+}
+
+func installOwnedTypedPrepareParams(proc *process.Process, n int, bindings []plan2.PreparedSourceBinding) error {
 	var typed *batch.Batch
 	for _, binding := range bindings {
 		pos := int(binding.Position)
-		if pos < 0 || pos >= params.Length() || params.IsNull(uint64(pos)) {
+		if pos < 0 || pos >= n || proc.GetPrepareParams().IsNull(uint64(pos)) {
 			continue
 		}
 		raw, err := proc.GetPrepareParamsAt(pos)
 		if err != nil {
 			return err
 		}
-		vec, ok, err := typedPrepareParam(proc, binding.Type, string(raw))
+		var vec *vector.Vector
+		ok, err := setTypedPrepareParam(&vec, proc, binding.Type, raw, proc.Mp())
 		if err != nil {
 			if typed != nil {
 				typed.Clean(proc.Mp())
@@ -59,7 +160,7 @@ func installTypedPrepareParams(proc *process.Process, bindings 
```

**File**: `pkg/frontend/prepared_typed_params_test.go` (modified, +64/-2)
```diff
@@ -155,14 +155,76 @@ func TestInstallTypedPrepareParams(t *testing.T) {
 		{Position: 2, Type: types.T_int64.ToType()},
 		{Position: 3, Type: types.T_float64.ToType()},
 	}
-	require.NoError(t, installTypedPrepareParams(proc, bindings))
+	require.NoError(t, installTypedPrepareParams(proc, bindings, nil))
 	require.Equal(t, int64(7), vector.GetFixedAtNoTypeCheck[int64](proc.GetTypedPrepareParam(0), 0))
 	require.Nil(t, proc.GetTypedPrepareParam(1), "string binding keeps the TEXT transport")
 	require.Nil(t, proc.GetTypedPrepareParam(2), "NULL keeps the TEXT transport")
 	require.Equal(t, 2.5, vector.GetFixedAtNoTypeCheck[float64](proc.GetTypedPrepareParam(3), 0))
 
 	// Nothing typed: no batch is installed.
 	proc.SetOwnedPrepareParamsWithIsBin(params, nil)
-	require.NoError(t, installTypedPrepareParams(proc, bindings[1:3]))
+	require.NoError(t, installTypedPrepareParams(proc, bindings[1:3], nil))
 	require.Nil(t, proc.GetTypedPrepareParams())
 }
+
+// A prepared statement allocates its typed parameters on the first execution
+// only; later executions rewrite them in place and the process borrows them.
+func TestInstallTypedPrepareParamsReusesStatementStorage(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	t.Cleanup(func() { proc.SetPrepareParams(nil) })
+	bindings := []plan2.PreparedSourceBinding{
+		{Position: 0, Type: types.T_int64.ToType()},
+		{Position: 1, Type: types.T_float64.ToType()},
+		{Position: 2, Type: types.T_json.ToType()},
+	}
+	execute := func(store *typedPrepareParams, values ...string) {
+		params := vector.NewVec(types.T_text.ToType(), proc.Mp())
+		for _, v := range values {
+			require.NoError(t, vector.AppendBytes(params, []byte(v), false, proc.Mp()))
+		}
+		proc.SetOwnedPrepareParamsWithIsBin(params, nil)
+		require.NoError(t, installTypedPrepareParams(proc, bindings, store))
+	}
+	var store typedPrepareParams
+	int32Type := types.T_int32.ToType()
+
+	execute(&store, "7", "2.5", `{"a":1}`)
+	first := []*vector.Vector{proc.GetTypedPrepareParam(0), proc.GetTypedPrepareParam(1), proc.GetTypedPrepareParam(2)}
+	narrowed, err := proc.GetTypedPrepareParamAsInteger(0, int32Type)
+	require.NoError(t, err)
+	require.Equal(t, int32(7), vector.GetFixedAtNoTypeCheck[int32](narrowed, 0))
+
+	// Second execution: new values, no allocation for parameter binding.
+	params := vector.NewVec(types.T_text.ToType(), proc.Mp())
+	for _, v := range []string{"8", "3.5", `{"b":22}`} {
+		require.NoError(t, vector.AppendBytes(params, []byte(v), false, proc.Mp()))
+	}
+	proc.SetOwnedPrepareParamsWithIsBin(params, nil)
+	allocs := proc.Mp().Stats().NumAlloc.Load()
+	require.NoError(t, installTypedPrepareParams(proc, bindings, &store))
+	again, err := proc.GetTypedPrepareParamAsInteger(0, int32Type)
+	require.NoError(t, err)
+	require.Equal(t, allocs, proc.Mp().Stats().NumAlloc.Load(), "an execution after the first must not allocate")
+	for i, vec := range first {
+		require.Same(t, vec, proc.GetTypedPrepareParam(i))
+	}
+	require.Same(t, narrowed, again)
+	require.Equal(t, int64(8), vector.GetFixedAtNoTypeCheck[int64](proc.GetTypedPrepareParam(0), 0))
+	require.Equal(t, 3.5, vector.GetFixedAtNoTypeCheck[float64](proc.GetTypedPrepareParam(1), 0))
+	require.Equal(t, int32(8), vector.GetFixedAtNoTypeCheck[int32](again, 0))
+
+	// A value that no longer fits the narrowed type is not served converted.
+	execute(&store, "3000000000", "1", "1")
+	tooWide, err := proc.GetTypedPrepareParamAsInteger(0, int32Type)
+	require.NoError(t, err)
+	require.Nil(t, tooWide)
+
+	// The process only borrows: replacing its parameters frees nothing of the
+	// statement's, and releasing the statement detaches the process.
+	execute(&store, "9", "1", "1")
+	require.NotNil(t, proc.GetTypedPrepareParams())
+	store.release(proc)
+	require.Nil(t, proc.GetTypedPrepareParams())
+	proc.SetPrepareParams(nil)
+	require.Zero(t, proc.Mp().CurrNB())
+}
```

---

### Incident Patch 2: `e17d5541` (2026-11-23)
**Commit Message**: fix(tae): bound catalog recovery memory on main (#33090)

## What type of PR is this?

- [x] BUG
- [x] Improvement

## Which issue(s) this PR fixes:

Refs #33072. Backports #33078 from `4.2-dev` to `main`.

## What this PR does / why we need it:

TAE recovery accumulated each entire system table in off-heap batches
before replaying the catalog. A large catalog therefore needed
substantial transient memory in addition to its recovered schemas.

Scan visible catalog rows one block at a time using the existing
snapshot and tombstone machinery, copy retained values into owned
schemas, and submit validated tables to the existing database-sharded
executor. Allow a blocked submission to withdraw on cancellation and
wait for already-admitted tasks before returning. Release DB-owned
vector pool buffers on failed open and normal close without invalidating
checked-out vectors.

The main-branch port keeps its existing catalog type encoding,
rename/object replay and persisted tombstone read paths. It also
preserves the released `NextColSeqnum == 0` ordinal fallback, including
for evolved schemas, while rejecting non-ordinal sequence data that
cannot safely be recovered without its high-water ma

**File**: `pkg/vm/engine/tae/catalog/catalog_replay_stream_test.go` (added, +348/-0)
```diff
@@ -0,0 +1,348 @@
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
+package catalog
+
+import (
+	"context"
+	"errors"
+	"sync"
+	"testing"
+
+	pkgcatalog "github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/objectio"
+	apipb "github.com/matrixorigin/matrixone/pkg/pb/api"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/containers"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/iface/txnif"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/options"
+	"github.com/stretchr/testify/require"
+)
+
+type deferredCatalogReplay struct {
+	jobs map[uint64][]func()
+}
+
+func (r *deferredCatalogReplay) Submit(_ context.Context, db uint64, fn func()) error {
+	r.jobs[db] = append(r.jobs[db], fn)
+	return nil
+}
+
+func TestReplaySystemTablesOwnsRowsAcrossBlocks(t *testing.T) {
+	mp := mpool.MustNew("catalog-replay-stream")
+	defer mpool.DeleteMPool(mp)
+	packer := types.NewPacker()
+	defer packer.Close()
+	cat := MockCatalog(&nilReplayDataFactory{})
+	defer cat.Close()
+
+	integer := types.T_int64.ToType()
+	integerBytes, err := types.Encode(&integer)
+	require.NoError(t, err)
+	textType := types.T_varchar.ToType()
+	textBytes, err := types.Encode(&textType)
+	require.NoError(t, err)
+	rowIDType := types.T_Rowid.ToType()
+	rowIDBytes, err := types.Encode(&rowIDType)
+	require.NoError(t, err)
+	generated, err := types.Encode(&plan.GeneratedCol{OriginString: "id + 1", IsStored: true})
+	require.NoError(t, err)
+	extra, err := (&apipb.SchemaExtra{BlockMaxRows: 128, ObjectMaxBlocks: 8, NextColSeqnum: 4}).Marshal()
+	require.NoError(t, err)
+
+	makeDB := func(id uint64, name string) *batch.Batch {
+		b, e := pkgcatalog.GenCreateDatabaseTuple("", 0, 1, 2, name, id, "", mp, packer)
+		require.NoError(t, e)
+		return b
+	}
+	makeTable := func(id, dbID uint64, name, dbName string) *batch.Batch {
+		table := pkgcatalog.Table{
+			TableId: id, DatabaseId: dbID, TableName: name, DatabaseName: dbName,
+			Comment: "owned comment " + name, CreateSql: "create " + name,
+		}
+		if name == "alpha" {
+			table.ExtraInfo = extra
+		} else {
+			// Released schemas may have a nonzero version but no high water mark.
+			table.Version = 1
+		}
+		b, e := pkgcatalog.GenCreateTableTuple(table, mp, packer)
+		require.NoError(t, e)
+		return b
+	}
+	makeColumns := func(cols ...pkgcatalog.Column) *batch.Batch {
+		b, e := pkgcatalog.GenCreateColumnTuples(cols, mp, packer)
+		require.NoError(t, e)
+		return b
+	}
+	col := func(id, dbID uint64, name, dbName, colName string, number int32, typ []byte) pkgcatalog.Column {
+		return pkgcatalog.Column{TableId: id, DatabaseId: dbID, TableName: name, DatabaseName: dbName,
+			Name: colName, Num: number, Seqnum: uint16(number - 1), Typ: typ}
+	}
+
+	// Deliberately interleave tables and split each table's columns across
+	// blocks. Source bytes are overwritten and freed before queued replay runs.
+	alphaLabel := col(101, 11, "alpha", "db1", "label", 2, textBytes)
+	alphaLabel.Seqnum = 3
+	alphaLabel.HasGenerated = 1
+	alphaLabel.GeneratedExpr = generated
+	legacyBlock := makeColumns(col(101, 11, "alpha", "db1", "id", 1, integerBytes), col(102, 12, "beta", "db2", "id", 1, integerBytes))
+	generatedIdx := pkgcatalog.MO_COLUMNS_ATT_GENERATED_IDX
+	generatedType := *legacyBlock.Vecs[generatedIdx].GetType()
+	legacyBlock.Vecs[generatedIdx].Free(mp)
+	legacyBlock.Vecs[generatedIdx] = vector.NewConstNull(generatedType, legacyBlock.RowCount(), mp)
+	// Exercise both a NULL sequence and an absent sequence vector on different
+	// blocks of the same evolved legacy table. Finalize must recover ordinals.
+	legacyBlock.Vecs[pkgcatalog.MO_COLUMNS_ATT_SEQNUM_IDX].GetNulls().Add(1)
+	legacyLabel := makeColumns(col(102, 12, "beta", "db2", "label", 2, textBytes))
+	blocks := map[uint64][]*batch.Batch{
+		pkgcatalog.MO_DATABASE_ID: {
+			makeDB(11, "db1"), makeDB(12, "db2"),
+		},
+		pkgcatalog.MO_TABLES_ID: {
+			makeTable(102, 12, "beta", "db2"), makeTable(101, 11, "alpha", "db1"),
+		},
+		pkgcatalog.MO_COLUMNS_ID: {
+			legacyLabel,
+			makeColumns(alphaLabel),
+			legacyBlock,
+			makeColumns(col(101, 11, "alpha", "db1", PhyAddrColumnName, 3,
```

**File**: `pkg/vm/engine/tae/catalog/catalogreplay.go` (modified, +223/-196)
```diff
@@ -14,8 +14,11 @@
 package catalog
 
 import (
+	"bytes"
+	"cmp"
 	"context"
 	"fmt"
+	"slices"
 
 	pkgcatalog "github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
@@ -29,6 +32,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/containers"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/iface/txnif"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/logstore/wal"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/options"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/txn/txnbase"
 )
 
@@ -37,7 +41,7 @@ const (
 )
 
 type ObjectListReplayer interface {
-	Submit(uint64, func())
+	Submit(context.Context, uint64, func()) error
 }
 
 //#region Replay WAL related
@@ -295,113 +299,248 @@ func (catalog *Catalog) onReplayUpdateObject(
 
 //#region Replay Checkpoint related
 
-func (catalog *Catalog) RelayFromSysTableObjects(
+type replayTableKey struct {
+	id   uint64
+	name string
+}
+
+type replayTable struct {
+	db     *DBEntry
+	id     uint64
+	schema *Schema
+	// Missing sequence metadata must not silently renumber evolved columns.
+	nonOrdinalSeq bool
+	missingSeq    bool
+}
+
+func replayVector(bat *containers.Batch, name string) *vector.Vector {
+	idx, ok := bat.Nameidx[name]
+	if !ok {
+		return nil
+	}
+	return bat.Vecs[idx].GetDownstreamVector()
+}
+
+func replayFixed[T any](bat *containers.Batch, name string, row int) T {
+	v := replayVector(bat, name)
+	if v == nil || v.IsNull(uint64(row)) {
+		var zero T
+		return zero
+	}
+	return vector.GetFixedAtNoTypeCheck[T](v, row)
+}
+
+func replayString(bat *containers.Batch, name string, row int) string {
+	v := replayVector(bat, name)
+	if v == nil || v.IsNull(uint64(row)) {
+		return ""
+	}
+	return v.GetStringAt(row)
+}
+
+// replayBytes returns a view that must be copied before the scanner advances.
+func replayBytes(bat *containers.Batch, name string, row int) []byte {
+	v := replayVector(bat, name)
+	if v == nil || v.IsNull(uint64(row)) {
+		return nil
+	}
+	return v.GetBytesAt(row)
+}
+
+func requireReplayFields(bat *containers.Batch, row int, names ...string) error {
+	for _, name := range names {
+		v := replayVector(bat, name)
+		if v == nil || v.IsNull(uint64(row)) {
+			return moerr.NewInternalErrorNoCtxf("missing required catalog field %s", name)
+		}
+	}
+	return nil
+}
+
+// ReplayFromSysTableObjects rebuilds the catalog without retaining raw system
+// table batches. Only owned schemas and their lookup by table identity remain
+// live while columns are read. Replay tasks do not borrow scanner buffers.
+func (catalog *Catalog) ReplayFromSysTableObjects(
 	ctx context.Context,
 	readTxn txnif.AsyncTxn,
-	readFunc func(context.Context, *TableEntry, txnif.AsyncTxn) *containers.Batch,
-	sortFunc func([]containers.Vector, int) error,
+	scan func(context.Context, *TableEntry, txnif.AsyncTxn, func(*containers.Batch, int) error) error,
 	replayer ObjectListReplayer,
-) (closeCB []func()) {
-	closeCB = make([]func(), 0)
+) error {
 	db, err := catalog.GetDatabaseByID(pkgcatalog.MO_CATALOG_ID)
 	if err != nil {
-		panic(err)
+		return err
 	}
 	dbTbl, err := db.GetTableEntryByID(pkgcatalog.MO_DATABASE_ID)
 	if err != nil {
-		panic(err)
+		return err
 	}
 	tableTbl, err := db.GetTableEntryByID(pkgcatalog.MO_TABLES_ID)
 	if err != nil {
-		panic(err)
+		return err
 	}
 	columnTbl, err := db.GetTableEntryByID(pkgcatalog.MO_COLUMNS_ID)
 	if err != nil {
-		panic(err)
+		return err
 	}
 
-	////  Note: do not use ckp-end as txnNode
-	// Running
-	// ------+------+---------+----+-----------+-> time
-	//       |      |         |    |           |
-	//  create-db-s |         |  ckp-end     drop-db-c
-	//         create-db-c  drop-db-s
-	//
-	// Replay
-	// -----------------------+----+-----------+-> time
-	//                        |    |           |
-	//                  drop-db-s  |          drop-db-c
-	//                             ckp-end
-	//                             create-db-s
-	//                             create-db-c
-	// create-db entry was replayed from checkpoint and drop-db entry was replayed from WAL
-	// If ckp-end was used, the create-db and drop-db are disordered, leading to ExpectedDup error
-
+	// Keep checkpoint-created entries before WAL operations that may drop them.
 	panguEpoch := types.BuildTS(42424242, 0)
-	txnNode := &txnbase.TxnMVCCNode{
-		Start:   panguEpoch,
-		Prepare: panguEpoch,
-		End:     panguEpoch,
+	txnNode := &txnbase.TxnMVCCNode{Start: panguEpoch, Prepare: panguEpoch, End: panguEpoch}
+	if err = scan(ctx, dbTbl, readTxn, func(bat *containers.Batch, row int) error {
+		if err := requireReplayFields(bat, row, pkgcatalog.SystemDBAttr_ID, pkgcatalog.SystemDBAttr_Name); err != nil {
+			return err
+		}
+		catalog.onReplayCreateDB(
+			replayFixed[uint64](bat, pkgcatalog.SystemDBAttr_ID, row),
+			replayString(bat, pkgcatalog.SystemDBAttr_Name, row), txnNode,
+			replayFixed[uint32](bat, pkgcatalog.SystemDBAttr_AccID, row),
+			rep
```

**File**: `pkg/vm/engine/tae/catalog/schema.go` (modified, +27/-60)
```diff
@@ -659,66 +659,33 @@ func (s *Schema) Marshal() (buf []byte, err error) {
 	return
 }
 
-func (s *Schema) ReadFromBatch(
-	bat *containers.Batch,
-	tids []uint64,
-	nullables, isHiddens, clusterbys, autoIncrements []int8,
-	idxes []int32,
-	seqNums []uint16,
-	offset int,
-	checkFn func(currentName string, currentTid uint64) (goNext bool),
-) (next int) {
-	nameVec := bat.GetVectorByName(pkgcatalog.SystemColAttr_RelName)
-	defer func() {
-		slices.SortStableFunc(s.ColDefs, func(i, j *ColDef) int {
-			return i.Idx - j.Idx
-		})
-	}()
-	for {
-		if offset >= nameVec.Length() {
-			break
-		}
-		name := nameVec.GetDownstreamVector().GetStringAt(offset)
-		id := tids[offset]
-		// every schema has 1 rowid column as last column, if have one, break
-		if !checkFn(name, id) {
-			break
-		}
-		def := new(ColDef)
-		def.Name = bat.GetVectorByName((pkgcatalog.SystemColAttr_Name)).GetDownstreamVector().GetStringAt(offset)
-		// unmarshal before releasing, no need to copy
-		data := bat.GetVectorByName((pkgcatalog.SystemColAttr_Type)).GetDownstreamVector().GetBytesAt(offset)
-		types.Decode(data, &def.Type)
-		nullable := nullables[offset]
-		def.NullAbility = !i82bool(nullable)
-		isHidden := isHiddens[offset]
-		def.Hidden = i82bool(isHidden)
-		isClusterBy := clusterbys[offset]
-		def.ClusterBy = i82bool(isClusterBy)
-		if def.ClusterBy {
-			def.SortKey = true
-		}
-		isAutoIncrement := autoIncrements[offset]
-		def.AutoIncrement = i82bool(isAutoIncrement)
-		def.Comment = bat.GetVectorByName((pkgcatalog.SystemColAttr_Comment)).GetDownstreamVector().GetStringAt(offset)
-		def.OnUpdate = bat.GetVectorByName((pkgcatalog.SystemColAttr_Update)).GetDownstreamVector().CloneBytesAt(offset)
-		def.Default = bat.GetVectorByName((pkgcatalog.SystemColAttr_DefaultExpr)).GetDownstreamVector().CloneBytesAt(offset)
-		def.Idx = int(idxes[offset]) - 1
-		def.SeqNum = seqNums[offset]
-		def.EnumValues = bat.GetVectorByName((pkgcatalog.SystemColAttr_EnumValues)).GetDownstreamVector().GetStringAt(offset)
-		s.NameMap[def.Name] = def.Idx
-		s.ColDefs = append(s.ColDefs, def)
-		if def.Name == PhyAddrColumnName {
-			def.PhyAddr = true
-		}
-		constraint := bat.GetVectorByName(pkgcatalog.SystemColAttr_ConstraintType).GetDownstreamVector().GetStringAt(offset)
-		if constraint == "p" {
-			def.SortKey = true
-			def.Primary = true
-		}
-		offset++
-	}
-	return offset
+// readReplayColumn copies a catalog row before the scanner releases its block.
+func (s *Schema) readReplayColumn(bat *containers.Batch, row int) error {
+	def := new(ColDef)
+	def.Name = replayString(bat, pkgcatalog.SystemColAttr_Name, row)
+	if err := types.Decode(replayBytes(bat, pkgcatalog.SystemColAttr_Type, row), &def.Type); err != nil {
+		return err
+	}
+	def.NullAbility = !i82bool(replayFixed[int8](bat, pkgcatalog.SystemColAttr_NullAbility, row))
+	def.Hidden = i82bool(replayFixed[int8](bat, pkgcatalog.SystemColAttr_IsHidden, row))
+	def.ClusterBy = i82bool(replayFixed[int8](bat, pkgcatalog.SystemColAttr_IsClusterBy, row))
+	def.SortKey = def.ClusterBy
+	def.AutoIncrement = i82bool(replayFixed[int8](bat, pkgcatalog.SystemColAttr_IsAutoIncrement, row))
+	def.Comment = replayString(bat, pkgcatalog.SystemColAttr_Comment, row)
+	def.OnUpdate = bytes.Clone(replayBytes(bat, pkgcatalog.SystemColAttr_Update, row))
+	def.Default = bytes.Clone(replayBytes(bat, pkgcatalog.SystemColAttr_DefaultExpr, row))
+	def.GeneratedCol = bytes.Clone(replayBytes(bat, pkgcatalog.SystemColAttr_Generated, row))
+	def.Idx = int(replayFixed[int32](bat, pkgcatalog.SystemColAttr_Num, row)) - 1
+	def.SeqNum = replayFixed[uint16](bat, pkgcatalog.SystemColAttr_Seqnum, row)
+	def.EnumValues = replayString(bat, pkgcatalog.SystemColAttr_EnumValues, row)
+	def.PhyAddr = def.Name == PhyAddrColumnName
+	if replayString(bat, pkgcatalog.SystemColAttr_ConstraintType, row) == "p" {
+		def.SortKey = true
+		def.Primary = true
+	}
+	s.NameMap[def.Name] = def.Idx
+	s.ColDefs = append(s.ColDefs, def)
+	return nil
 }
 
 func (s *Schema) AppendColDef(def *ColDef) (err error) {
```

**File**: `pkg/vm/engine/tae/containers/pool.go` (modified, +29/-0)
```diff
@@ -87,6 +87,17 @@ func (e *vectorPoolElement) put() {
 	if !e.inUse.CompareAndSwap(true, false) {
 		panic("vectorPoolElement.put: vector is not in use")
 	}
+	// Close may have skipped this slot while it was checked out.
+	if e.pool.closed.Load() {
+		e.freeIfIdle()
+	}
+}
+
+func (e *vectorPoolElement) freeIfIdle() {
+	if e.inUse.CompareAndSwap(false, true) {
+		e.vec.Free(e.mp)
+		e.inUse.Store(false)
+	}
 }
 
 func (e *vectorPoolElement) isIdle() bool {
@@ -95,6 +106,7 @@ func (e *vectorPoolElement) isIdle() bool {
 
 type VectorPool struct {
 	name           string
+	closed         atomic.Bool
 	maxAlloc       int
 	ratio          float64
 	fixSizedPool   []*vectorPoolElement
@@ -167,6 +179,9 @@ func (p *VectorPool) String() string {
 
 func (p *VectorPool) GetVector(t *types.Type) *vectorWrapper {
 	p.totalStats.Add(1)
+	if p.closed.Load() {
+		return NewVector(*t, Options{Allocator: p.mp})
+	}
 	if t.IsFixedLen() {
 		if len(p.fixSizedPool) > 0 {
 			for i := 0; i < 4; i++ {
@@ -206,6 +221,20 @@ func (p *VectorPool) GetMPool() *mpool.MPool {
 	return p.mp
 }
 
+// Close releases idle buffers. Checked-out vectors remain valid and release
+// their backing memory when returned; allocations after Close are unpooled.
+func (p *VectorPool) Close() {
+	if !p.closed.CompareAndSwap(false, true) {
+		return
+	}
+	for _, e := range p.fixSizedPool {
+		e.freeIfIdle()
+	}
+	for _, e := range p.varlenPool {
+		e.freeIfIdle()
+	}
+}
+
 func (p *VectorPool) Allocated() int {
 	size := 0
 	size += p.FixedSizeAllocated()
```

**File**: `pkg/vm/engine/tae/containers/pool_lifetime_test.go` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
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
+package containers
+
+import (
+	"fmt"
+	"sync"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/stretchr/testify/require"
+)
+
+func TestVectorPoolClosePreservesBorrowers(t *testing.T) {
+	mp := mpool.MustNewZero()
+	defer mpool.DeleteMPool(mp)
+	pool := NewVectorPool(t.Name(), 2, WithMPool(mp))
+	other := NewVectorPool(t.Name()+"-other", 2, WithMPool(mp))
+	fixedType, bytesType := types.T_int64.ToType(), types.T_varchar.ToType()
+	idle := pool.GetVector(&fixedType)
+	idle.Append(int64(42), false)
+	idle.Close()
+	held := pool.GetVector(&bytesType)
+	held.Append([]byte("still valid"), false)
+	independent := other.GetVector(&fixedType)
+	independent.Append(int64(17), false)
+	before := mp.CurrNB()
+
+	pool.Close()
+	pool.Close()
+	require.Less(t, mp.CurrNB(), before)
+	require.Equal(t, []byte("still valid"), held.Get(0))
+	require.Equal(t, int64(17), independent.Get(0))
+	held.Close()
+	independent.Close()
+	other.Close()
+	require.Zero(t, mp.CurrNB())
+
+	// A caller racing with or arriving after Close gets an ordinary, unpooled
+	// vector whose lifetime remains independent of the closed pool.
+	after := pool.GetVector(&fixedType)
+	after.Append(int64(9), false)
+	require.Equal(t, int64(9), after.Get(0))
+	after.Close()
+	require.Zero(t, mp.CurrNB())
+}
+
+func TestVectorPoolCloseConcurrentBorrowAndReturn(t *testing.T) {
+	mp := mpool.MustNewZero()
+	defer mpool.DeleteMPool(mp)
+	pool := NewVectorPool(t.Name(), 16, WithMPool(mp))
+	typ := types.T_int64.ToType()
+	const workers, iterations = 16, 200
+	var ready, done sync.WaitGroup
+	ready.Add(workers)
+	done.Add(workers)
+	release := make(chan struct{})
+	errCh := make(chan error, workers)
+	for worker := 0; worker < workers; worker++ {
+		go func(worker int) {
+			defer done.Done()
+			held := pool.GetVector(&typ)
+			held.Append(int64(worker), false)
+			ready.Done()
+			<-release
+			if got := held.Get(0); got != int64(worker) {
+				errCh <- fmt.Errorf("held vector: got %v, want %d", got, worker)
+				held.Close()
+				return
+			}
+			held.Close()
+			for i := 0; i < iterations; i++ {
+				v := pool.GetVector(&typ)
+				v.Append(int64(i), false)
+				if got := v.Get(0); got != int64(i) {
+					errCh <- fmt.Errorf("vector: got %v, want %d", got, i)
+					v.Close()
+					return
+				}
+				v.Close()
+			}
+		}(worker)
+	}
+	ready.Wait()
+	closed := make(chan struct{})
+	go func() {
+		pool.Close()
+		close(closed)
+	}()
+	close(release)
+	done.Wait()
+	<-closed
+	pool.Close()
+	close(errCh)
+	for err := range errCh {
+		require.NoError(t, err)
+	}
+	require.Zero(t, mp.CurrNB())
+}
```

**File**: `pkg/vm/engine/tae/db/checkpoint/replay.go` (modified, +20/-16)
```diff
@@ -36,7 +36,6 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/iface/txnif"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/logstore/sm"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/logtail"
-	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/mergesort"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/tables"
 	"go.uber.org/zap"
 
@@ -63,7 +62,7 @@ type CkpReplayer struct {
 	readDuration, applyDuration       time.Duration
 	readCount, applyCount, totalCount int
 
-	objectReplayWorker []sm.Queue
+	objectReplayWorker []sm.ContextQueue
 	wg                 sync.WaitGroup
 	objectCountMap     map[uint64]int
 }
@@ -360,6 +359,7 @@ func (c *CkpReplayer) ReplayThreeTablesObjectlist(phase string) (
 }
 
 func (c *CkpReplayer) ReplayCatalog(
+	ctx context.Context,
 	readTxn txnif.AsyncTxn,
 	phase string,
 ) (err error) {
@@ -382,21 +382,21 @@ func (c *CkpReplayer) ReplayCatalog(
 		return
 	}
 
-	// logutil.Info(c.r.catalog.SimplePPString(common.PPL3))
-	sortFunc := func(cols []containers.Vector, pkidx int) (err2 error) {
-		_, err2 = mergesort.SortBlockColumns(cols, pkidx, c.r.rt.VectorPool.Transient)
-		return
-	}
-	closeFn := c.r.catalog.RelayFromSysTableObjects(
-		c.r.ctx,
+	err = c.r.catalog.ReplayFromSysTableObjects(
+		ctx,
 		readTxn,
-		tables.ReadSysTableBatch,
-		sortFunc,
+		tables.ScanSysTable,
 		c,
 	)
+	// A cancellation or error may arrive after some tasks were submitted.
+	// They own their schemas and must finish before replay returns.
 	c.wg.Wait()
-	for _, fn := range closeFn {
-		fn()
+	if err != nil {
+		return err
+	}
+	if ctx.Err() != nil {
+		err = context.Cause(ctx)
+		return err
 	}
 	c.resetObjectCountMap()
 	// logutil.Info(c.r.catalog.SimplePPString(common.PPL0))
@@ -446,11 +446,15 @@ func (c *CkpReplayer) ReplayObjectlist(ctx context.Context, phase string) (err e
 	return
 }
 
-func (c *CkpReplayer) Submit(tid uint64, replayFn func()) {
+func (c *CkpReplayer) Submit(ctx context.Context, tid uint64, replayFn func()) error {
 	c.wg.Add(1)
 	workerOffset := tid % uint64(len(c.objectReplayWorker))
+	if _, err := c.objectReplayWorker[workerOffset].EnqueueWithContext(ctx, replayFn); err != nil {
+		c.wg.Done()
+		return err
+	}
 	c.objectCountMap[tid] = c.objectCountMap[tid] + 1
-	c.objectReplayWorker[workerOffset].Enqueue(replayFn)
+	return nil
 }
 
 func (c *CkpReplayer) resetObjectCountMap() {
@@ -465,7 +469,7 @@ func (r *runner) BuildReplayer(
 		dir:            dir,
 		objectCountMap: make(map[uint64]int),
 	}
-	objectWorker := make([]sm.Queue, DefaultObjectReplayWorkerCount)
+	objectWorker := make([]sm.ContextQueue, DefaultObjectReplayWorkerCount)
 	for i := 0; i < DefaultObjectReplayWorkerCount; i++ {
 		objectWorker[i] = sm.NewSafeQueue(10000, 100, func(items ...any) {
 			for _, item := range items {
```

**File**: `pkg/vm/engine/tae/db/checkpoint/replay_cancel_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
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
+package checkpoint
+
+import (
+	"context"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/catalog"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/logstore/sm"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/txn/txnbase"
+	"github.com/stretchr/testify/require"
+)
+
+type enqueueContext struct {
+	context.Context
+	once    sync.Once
+	entered chan struct{}
+}
+
+// Observe the cancellation being read by the real catalog scanner.
+type observedReplayContext struct {
+	context.Context
+	once     sync.Once
+	observed chan struct{}
+}
+
+func (c *observedReplayContext) Value(key any) any {
+	c.once.Do(func() { close(c.observed) })
+	return c.Context.Value(key)
+}
+
+func TestReplayCatalogWaitsForAcceptedTasksOnCancellation(t *testing.T) {
+	cat := catalog.MockCatalog(nil)
+	r := &CkpReplayer{
+		r:              &runner{catalog: cat},
+		ckpEntries:     []*CheckpointEntry{{}},
+		objectCountMap: make(map[uint64]int),
+	}
+	started, release := make(chan struct{}), make(chan struct{})
+	var releaseOnce sync.Once
+	q := sm.NewSafeQueue(1, 1, func(items ...any) {
+		for _, item := range items {
+			item.(func())()
+			r.wg.Done()
+		}
+	})
+	r.objectReplayWorker = []sm.ContextQueue{q}
+	q.Start()
+	var replayDone chan struct{}
+	t.Cleanup(func() {
+		releaseOnce.Do(func() { close(release) })
+		q.Stop()
+		if replayDone != nil {
+			select {
+			case <-replayDone:
+			case <-time.After(5 * time.Second):
+				t.Error("catalog replay goroutine did not stop")
+				return
+			}
+		}
+		cat.Close()
+	})
+	require.NoError(t, r.Submit(context.Background(), 1, func() {
+		close(started)
+		<-release
+	}))
+	select {
+	case <-started:
+	case <-time.After(5 * time.Second):
+		t.Fatal("accepted replay task did not start")
+	}
+
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+	observed := &observedReplayContext{Context: ctx, observed: make(chan struct{})}
+	result := make(chan error, 1)
+	replayDone = make(chan struct{})
+	go func() {
+		defer close(replayDone)
+		result <- r.ReplayCatalog(observed, txnbase.MockTxnReaderWithNow(), "test")
+	}()
+	select {
+	case <-observed.observed:
+	case <-time.After(5 * time.Second):
+		t.Fatal("catalog scanner did not observe cancellation")
+	}
+	select {
+	case err := <-result:
+		t.Fatalf("catalog replay returned before the accepted task finished: %v", err)
+	case <-time.After(100 * time.Millisecond):
+	}
+	releaseOnce.Do(func() { close(release) })
+	select {
+	case err := <-result:
+		require.ErrorIs(t, err, context.Canceled)
+	case <-time.After(5 * time.Second):
+		t.Fatal("catalog replay did not return after the accepted task finished")
+	}
+}
+
+func (c *enqueueContext) Done() <-chan struct{} {
+	c.once.Do(func() { close(c.entered) })
+	return c.Context.Done()
+}
+
+func TestReplaySubmissionCancellationDrainsAcceptedWork(t *testing.T) {
+	r := &CkpReplayer{objectCountMap: make(map[uint64]int)}
+	q := sm.NewSafeQueue(1, 1, func(items ...any) {
+		for _, item := range items {
+			item.(func())()
+			r.wg.Done()
+		}
+	})
+	r.objectReplayWorker = []sm.ContextQueue{q}
+	q.Start()
+	ctx, cancel := context.WithCancel(context.Background())
+	release := make(chan struct{})
+	var releaseOnce sync.Once
+	t.Cleanup(func() {
+		cancel()
+		releaseOnce.Do(func() { close(release) })
+		q.Stop()
+	})
+
+	started := make(chan struct{})
+	var ran atomic.Int32
+	require.NoError(t, r.Submit(context.Background(), 1, func() {
+		close(started)
+		<-release
+		ran.Add(1)
+	}))
+	select {
+	case <-started:
+	case <-time.After(5 * time.Second):
+		t.Fatal("first replay task did not start")
+	}
+	require.NoError(t, r.Submit(context.Background(), 2, func() { ran.Add(1) }))
+
+	waiting := &enqueueContext{Context: ctx, entered: make(chan struct{})}
+	result := make(chan error, 1)
+	go func() { result <- r.Submit(waiting, 3, func() { ran.Add(100) }) }()
+	select {
+	case <-waiting.entered:
+	case <-time.After(5 * time.Second):
+		t.Fatal("third replay task did not reach the full queue")
+	}
+	cancel()
+	select {
+	case err := <-result:
+		require.ErrorIs(t, err, context.Canceled)
+	case <-time.After(5 * time.Second):
+		t.Fatal("canceled submission remained blocked")
+	}
+	require.Equal(t, map[uint64]int{1: 1, 2: 1}, r.objectCountMap)
+
+	releaseOnce.Do(func() { close(release) })
+	drained := make(chan struct{})
```

**File**: `pkg/vm/engine/tae/db/controller.go` (modified, +1/-0)
```diff
@@ -920,6 +920,7 @@ func (c *Controller) replayFromCheckpoints(ctx context.Context) (
 
 	// 2. replay all table Entries
 	if err = ckpReplayer.ReplayCatalog(
+		ctx,
 		db.TxnMgr.OpenOfflineTxn(checkpointed),
 		Phase_Open,
 	); err != nil {
```

---

### Incident Patch 3: `ba102575` (2026-11-23)
**Commit Message**: fix: drain proxy connection work during shutdown (#33104)

## What type of PR is this?

- [x] BUG
- [x] Test and CI

## Which issue(s) this PR fixes:

Refs #32745 (main flaky CI tracker)
Related: #32744 (4.2-dev flaky CI tracker)

The observed crash was on main in [PR
#33058](https://github.com/matrixorigin/matrixone/pull/33058). The
4.2-dev branch uses a different Goetty version and does not contain the
same test; this PR does not claim that the identical failure has been
reproduced there or close either tracker.

## What this PR does / why we need it:

Proxy shutdown disconnected sessions without waiting for their handlers.
A handler could then attempt disconnect cleanup after its query client
and service runtime had been released, causing a nil-runtime panic.

Make the existing connection owner cancel and drain handlers, tunnel
pipes and in-progress transfers before releasing shared dependencies.
Keep event delivery cancellable before it is accepted, retain
acknowledgements after acceptance, and start both forwarding directions
before processing traffic so an immediate `COM_QUIT` cannot publish a
still-used backend to the connection cache. Preserve disconnect cleanup
for in-flig

**File**: `pkg/proxy/client_close_logging_test.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
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
+package proxy
+
+import (
+	"context"
+	"errors"
+	"io"
+	"net"
+	"sync/atomic"
+	"syscall"
+	"testing"
+	"time"
+
+	"github.com/fagongzi/goetty/v2"
+	"github.com/matrixorigin/matrixone/pkg/common/log"
+	"github.com/matrixorigin/matrixone/pkg/frontend"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+)
+
+type scriptedClientCloseConn struct {
+	net.Conn
+	closes atomic.Int32
+	failAt int32
+	err    error
+}
+
+func (c *scriptedClientCloseConn) Close() error {
+	count := c.closes.Add(1)
+	_ = c.Conn.Close()
+	if count == c.failAt {
+		return c.err
+	}
+	if count > 1 {
+		return net.ErrClosed
+	}
+	return nil
+}
+
+func TestHandlerClientCloseReportsUnexpectedErrors(t *testing.T) {
+	closeErr := errors.New("injected client transport close failure")
+	for _, tc := range []struct {
+		name      string
+		failAt    int32
+		err       error
+		wantPhase string
+	}{
+		{name: "transport interrupt", failAt: 1, err: closeErr, wantPhase: "interrupt"},
+		{name: "final cleanup", failAt: 2, err: closeErr, wantPhase: "cleanup"},
+		{name: "reset during close", failAt: 1, err: syscall.ECONNRESET, wantPhase: "interrupt"},
+		{name: "already closed", failAt: 1, err: net.ErrClosed},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			core, logs := observer.New(zapcore.ErrorLevel)
+			local, peer := net.Pipe()
+			conn := &scriptedClientCloseConn{Conn: local, failAt: tc.failAt, err: tc.err}
+			session := goetty.NewIOSession(goetty.WithSessionConn(1, conn),
+				goetty.WithSessionCodec(WithProxyProtocolCodec(frontend.NewSqlCodec())))
+			h := &handler{
+				ctx:               context.Background(),
+				logger:            log.GetServiceLogger(zap.New(core), metadata.ServiceType_PROXY, ""),
+				counterSet:        newCounterSet(),
+				connectionLimiter: newConnectionLimiter(1, 1),
+			}
+			done := make(chan error, 1)
+			finished := make(chan struct{})
+			t.Cleanup(func() {
+				_ = local.Close()
+				_ = peer.Close()
+				select {
+				case <-finished:
+				case <-time.After(5 * time.Second):
+					t.Error("handler did not stop during cleanup")
+				}
+			})
+			go func() {
+				defer close(finished)
+				done <- h.handle(session)
+			}()
+			require.NoError(t, peer.SetReadDeadline(time.Now().Add(5*time.Second)))
+			var header [4]byte
+			_, err := io.ReadFull(peer, header[:])
+			require.NoError(t, err)
+			length := int(header[0]) | int(header[1])<<8 | int(header[2])<<16
+			_, err = io.ReadFull(peer, make([]byte, length))
+			require.NoError(t, err)
+			require.NoError(t, peer.Close())
+			select {
+			case err = <-done:
+				require.NoError(t, err)
+			case <-time.After(5 * time.Second):
+				t.Fatal("handler did not finish after client disconnect")
+			}
+			entries := logs.FilterMessage("failed to close tcp connection").All()
+			if tc.wantPhase == "" {
+				require.Empty(t, entries)
+				return
+			}
+			require.Len(t, entries, 1)
+			require.Contains(t, entries[0].ContextMap()["error"], tc.err.Error())
+			require.Equal(t, tc.wantPhase, entries[0].ContextMap()["phase"])
+			require.NotZero(t, entries[0].ContextMap()["ConnID"])
+		})
+	}
+}
```

**File**: `pkg/proxy/client_conn.go` (modified, +13/-26)
```diff
@@ -38,6 +38,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/config"
 	"github.com/matrixorigin/matrixone/pkg/frontend"
 	"github.com/matrixorigin/matrixone/pkg/logservice"
+	"github.com/matrixorigin/matrixone/pkg/logutil"
 	"github.com/matrixorigin/matrixone/pkg/pb/query"
 	qclient "github.com/matrixorigin/matrixone/pkg/queryservice/client"
 	v2 "github.com/matrixorigin/matrixone/pkg/util/metric/v2"
@@ -594,7 +595,7 @@ func (c *clientConn) HandleEvent(ctx context.Context, e IEvent, resp chan<- []by
 	return nil
 }
 
-func (c *clientConn) sendErr(err error, resp chan<- []byte) {
+func (c *clientConn) sendErr(ctx context.Context, err error, resp chan<- []byte) {
 	errCode, sqlState, errMsg := frontend.RewriteError(err, "")
 	payload := c.mysqlProto.MakeErrPayload(
 		errCode, sqlState, errMsg)
@@ -603,7 +604,7 @@ func (c *clientConn) sendErr(err error, resp chan<- []byte) {
 		SequenceID: 1,
 		Payload:    payload,
 	}
-	sendResp(packetToBytes(r), resp)
+	sendRespContext(ctx, packetToBytes(r), resp)
 }
 
 func (c *clientConn) connAndExec(
@@ -628,7 +629,7 @@ func (c *clientConn) connAndExec(
 	}
 	if err != nil {
 		if resp != nil {
-			c.sendErr(err, resp)
+			c.sendErr(ctx, err, resp)
 		}
 		return err
 	}
@@ -640,7 +641,7 @@ func (c *clientConn) connAndExec(
 	if err != nil {
 		c.log.Error("failed to connect to backend server", zap.Error(err))
 		if resp != nil {
-			c.sendErr(err, resp)
+			c.sendErr(ctx, err, resp)
 		}
 		return err
 	}
@@ -650,7 +651,7 @@ func (c *clientConn) connAndExec(
 		c.log.Error("failed to connect to cn to handle event",
 			zap.String("query", stmt), zap.String("error", string(r)))
 		if resp != nil {
-			sendResp(r, resp)
+			sendRespContext(ctx, r, resp)
 		}
 		return moerr.NewInternalErrorNoCtx("access error")
 	}
@@ -783,19 +784,11 @@ func recordSetVarStmt(stmts *[]string, stmtMap map[string]struct{}, stmt string)
 	*stmts = append(*stmts, stmt)
 }
 
-func (c *clientConn) handleQuitEvent(ctx context.Context) error {
-	return c.handleQuitEventInternal(ctx, true)
-}
-
 // handleQuitCommand handles an intercepted COM_QUIT while c2s is synchronously
 // blocked waiting for the event notification. Sealing is sufficient here: the
 // pipe cannot touch the backend again before it is notified, and it terminates
 // immediately afterwards.
 func (c *clientConn) handleQuitCommand(ctx context.Context) error {
-	return c.handleQuitEventInternal(ctx, false)
-}
-
-func (c *clientConn) handleQuitEventInternal(ctx context.Context, waitClientPipe bool) error {
 	c.quit.once.Do(func() {
 		csp, scp := c.tun.getPipes()
 		discardBackend := func() {
@@ -826,12 +819,6 @@ func (c *clientConn) handleQuitEventInternal(ctx context.Context, waitClientPipe
 				abort(err)
 				return
 			}
-			if waitClientPipe {
-				if err := csp.waitStopped(pauseCtx); err != nil {
-					abort(err)
-					return
-				}
-			}
 		}
 		if scp != nil {
 			if err := scp.pause(pauseCtx); err != nil {
@@ -907,14 +894,14 @@ func (c *clientConn) handleUpgradeEvent(
 	if !c.clientInfo.isSuperTenant() {
 		err := moerr.NewInternalErrorNoCtx("do not have privilege to execute the statement")
 		c.log.Error("failed to exec upgrade event", zap.Error(err))
-		c.sendErr(err, resp)
+		c.sendErr(ctx, err, resp)
 		return err
 	}
 
 	servers, err := c.router.AllServers(c.sid)
 	if err != nil {
 		c.log.Error("failed to select CN server", zap.Error(err))
-		c.sendErr(err, resp)
+		c.sendErr(ctx, err, resp)
 		return err
 	}
 
@@ -926,7 +913,7 @@ func (c *clientConn) handleUpgradeEvent(
 		cid, err := c.genConnID()
 		if err != nil {
 			c.log.Error("failed to generate conn ID for upgrade query", zap.Error(err))
-			c.sendErr(err, resp)
+			c.sendErr(ctx, err, resp)
 			return err
 		}
 		cn.connID = cid
@@ -935,12 +922,12 @@ func (c *clientConn) handleUpgradeEvent(
 		// It everything is ok, send ok response at last out of the loop.
 		if err := c.connAndExec(ctx, cn, e.stmt, nil, protocolMemoryBackground); err != nil {
 			c.log.Error("failed to execute upgrade query", zap.Error(err))
-			c.sendErr(err, resp)
+			c.sendErr(ctx, err, resp)
 			return err
 		}
 	}
 	if resp != nil {
-		sendResp(makeOKPacket(8), resp)
+		sendRespContext(ctx, makeOKPacket(8), resp)
 	}
 	return nil
 }
@@ -950,8 +937,8 @@ func (c *clientConn) Close() error {
 	if c.mysqlProto != nil {
 		tcpConn := c.mysqlProto.GetTcpConnection()
 		if tcpConn != nil {
-			if err := tcpConn.Close(); err != nil {
-				c.log.Error("failed to close tcp connection", zap.Error(err))
+			if err := tcpConn.Close(); err != nil && !logutil.IsExpectedConnectionCloseError(err) {
+				c.log.Error("failed to close tcp connection", zap.String("phase", "cleanup"), zap.Error(err))
 			}
 		}
 		c.mysqlProto.Close()
```

**File**: `pkg/proxy/conn_cache_test.go` (modified, +4/-7)
```diff
@@ -1557,6 +1557,7 @@ func TestPreparedShortConnectionQuitProductionPath(t *testing.T) {
 				resourcesClosed = true
 				_ = clientRemote.Close()
 				_ = tun.Close()
+				tun.workers.Wait()
 				clientCleanup()
 			}
 			defer closeGenerationResources()
@@ -1599,20 +1600,16 @@ func TestPreparedShortConnectionQuitProductionPath(t *testing.T) {
 			go func() {
 				for {
 					select {
-					case event, ok := <-tun.reqC:
-						if !ok {
-							eventDone <- nil
-							return
-						}
+					case event := <-tun.reqC:
 						if err := client.HandleEvent(ctx, event, tun.respC); err != nil {
 							eventDone <- err
 							return
 						}
 						if _, ok := event.(*quitEvent); ok {
 							close(quitHandled)
 						}
-					case <-ctx.Done():
-						eventDone <- ctx.Err()
+					case <-tun.ctx.Done():
+						eventDone <- tun.ctx.Err()
 						return
 					}
 				}
```

**File**: `pkg/proxy/event.go` (modified, +7/-5)
```diff
@@ -80,16 +80,18 @@ func (e *baseEvent) wait() {
 	<-e.waitC
 }
 
-// sendReq sends an event to event channel.
-func sendReq(e IEvent, c chan<- IEvent) {
-	c <- e
-}
-
 // sendResp receives an event response from the channel.
 func sendResp(r []byte, c chan<- []byte) {
 	c <- r
 }
 
+func sendRespContext(ctx context.Context, r []byte, c chan<- []byte) {
+	select {
+	case c <- r:
+	case <-ctx.Done():
+	}
+}
+
 // makeEvent parses an event from message bytes. If we got no
 // supported event, just return nil. If the second return value
 // is true, means that the message has been consumed completely,
```

**File**: `pkg/proxy/handler.go` (modified, +64/-67)
```diff
@@ -18,6 +18,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"io"
 	"net"
 
 	"github.com/fagongzi/goetty/v2"
@@ -33,6 +34,7 @@ import (
 	moconfig "github.com/matrixorigin/matrixone/pkg/config"
 	"github.com/matrixorigin/matrixone/pkg/frontend"
 	"github.com/matrixorigin/matrixone/pkg/logservice"
+	"github.com/matrixorigin/matrixone/pkg/logutil"
 	"github.com/matrixorigin/matrixone/pkg/queryservice/client"
 	v2 "github.com/matrixorigin/matrixone/pkg/util/metric/v2"
 )
@@ -282,11 +284,38 @@ func (h *handler) handle(c goetty.IOSession) error {
 		tunnelOptions = append(tunnelOptions, withCacheReuseBarrier())
 	}
 	t := newTunnel(h.ctx, h.logger, h.counterSet, tunnelOptions...)
+	var cc ClientConn
+	var sc ServerConn
+	var st *stopper.Stopper
 	defer func() {
+		if cc != nil && cc.RawConn() != nil {
+			if err := cc.RawConn().Close(); err != nil && !logutil.IsExpectedConnectionCloseError(err) {
+				h.logger.Error("failed to close tcp connection", zap.Uint32("ConnID", cc.ConnID()), zap.String("phase", "interrupt"), zap.Error(err))
+			}
+		}
 		_ = t.Close()
-		// This defer was installed before the client/server and event-handler
-		// cleanup defers, so reaching it proves the old tunnel generation can no
-		// longer touch a backend that is about to be reused.
+		if st != nil {
+			st.Stop()
+		}
+		if sc != nil {
+			cached := false
+			if clientConn, ok := cc.(*clientConn); ok && h.connCache != nil {
+				cached = clientConn.isConnCached()
+			}
+			if !cached {
+				serverC := t.getServerConn()
+				if serverC == nil {
+					serverC = sc
+				}
+				_ = serverC.Close()
+			}
+		}
+		// A cached backend cannot be reused and client state cannot be released
+		// until all forwarding and transfer work for this tunnel has stopped.
+		t.workers.Wait()
+		if cc != nil {
+			_ = cc.Close()
+		}
 		t.markCacheReuseReady()
 	}()
 
@@ -312,11 +341,10 @@ func (h *handler) handle(c goetty.IOSession) error {
 		return err
 	}
 	h.logger.Debug("client conn created")
-	defer func() { _ = cc.Close() }()
 
 	// client builds connections with a best CN server and returns
 	// the server connection.
-	sc, err := cc.BuildConnWithServer(h.ctx, "")
+	sc, err = cc.BuildConnWithServer(h.ctx, "")
 	if err != nil {
 		if isConnEndErr(err) {
 			return nil
@@ -333,30 +361,6 @@ func (h *handler) handle(c goetty.IOSession) error {
 		return err
 	}
 	h.logger.Debug("server conn created")
-	defer func() {
-		// If the connCache is nil, means the connection cached feature is not
-		// enabled. Do close the server connection if the connection cache
-		// feature is not enabled.
-		if h.connCache == nil {
-			_ = sc.Close()
-			return
-		}
-		// connCache enabled: only keep backend connection alive when it has
-		// been cached successfully.
-		if clientConn, ok := cc.(*clientConn); ok && clientConn.isConnCached() {
-			return
-		}
-		serverC := t.getServerConn()
-		if serverC == nil {
-			serverC = sc
-		}
-		if serverC != nil {
-			// This connection was not admitted to the cache. A protocol QUIT can
-			// wait indefinitely for a broken CN to close its side; direct Close is
-			// the terminal ownership edge and also removes connManager state.
-			_ = serverC.Close()
-		}
-	}()
 
 	goId := goid.Get()
 
@@ -368,17 +372,13 @@ func (h *handler) handle(c goetty.IOSession) error {
 		zap.Int64("goId", goId),
 	)
 
-	st := stopper.NewStopper("proxy-conn-handle", stopper.WithLogger(h.logger.RawLogger()))
-	defer st.Stop()
+	st = stopper.NewStopper("proxy-conn-handle", stopper.WithLogger(h.logger.RawLogger()))
 	// Starts the event handler go-routine to handle the events comes from tunnel data flow,
 	// such as, kill connection event.
 	if err := st.RunNamedTask("event-handler", func(ctx context.Context) {
 		for {
 			select {
-			case e, ok := <-t.reqC:
-				if !ok {
-					return
-				}
+			case e := <-t.reqC:
 				if err := cc.HandleEvent(ctx, e, t.respC); err != nil {
 					h.logger.Error("failed to handle event",
 						zap.Any("event", e), zap.Error(err))
@@ -403,15 +403,33 @@ func (h *handler) handle(c goetty.IOSession) error {
 	}
 
 	if err := t.run(cc, sc); err != nil {
+		if h.ctx.Err() != nil {
+			h.cleanupBackendOnClientDisconnect(io.EOF, cc, t)
+		}
 		return err
 	}
+	return h.waitForTunnel(cc, t, c.ID(), goId)
+}
 
+func (h *handler) waitForTunnel(cc ClientConn, t *tunnel, sessionID uint64, goId int64) error {
+	var err error
 	select {
+	case err = <-t.errC:
 	case <-h.ctx.Done():
-		return h.ctx.Err()
-	case err := <-t.errC:
-		return h.handleTunnelErr(err, cc, t, c.ID(), goId)
+		// Preserve an already-published transport error over a later stop.
+		select {
+		case err = <-t.errC:
+		default:
+			err = h.ctx.Err()
+		}
+	}
+	if contextErr := h.ctx.Err(); contextErr != nil && errors.Is(err, contextErr) {
+		// A pipe can label its parent's cancellation as a server disconnect;
+		// it does not prove that a forwarded statement has stopped on the CN.
+		h.cleanupBackendOnClientDisconnect(io.EOF, cc, t)
+		return err
 	}
+	r
```

**File**: `pkg/proxy/handler_test.go` (modified, +18/-9)
```diff
@@ -40,6 +40,9 @@ import (
 	"github.com/lni/goutils/leaktest"
 	"github.com/prometheus/client_golang/prometheus/testutil"
 	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
 
 	"github.com/matrixorigin/matrixone/pkg/clusterservice"
 	"github.com/matrixorigin/matrixone/pkg/common/log"
@@ -219,9 +222,10 @@ func TestHandler_Handle(t *testing.T) {
 	}()
 	mc.ForceRefresh(true)
 
-	// start proxy.
-	s, err := NewServer(ctx, cfg, WithRuntime(runtime.DefaultRuntime()),
-		WithHAKeeperClient(hc))
+	// Capture the proxy's close diagnostics from construction, before it accepts connections.
+	core, logs := observer.New(zapcore.ErrorLevel)
+	proxyRuntime := runtime.NewRuntime(metadata.ServiceType_PROXY, "", zap.New(core))
+	s, err := NewServer(ctx, cfg, WithRuntime(proxyRuntime), WithHAKeeperClient(hc))
 	defer func() {
 		err := s.Close()
 		require.NoError(t, err)
@@ -261,6 +265,9 @@ func TestHandler_Handle(t *testing.T) {
 
 	require.Equal(t, int64(1), s.counterSet.connAccepted.Load())
 	require.Equal(t, int64(1), s.counterSet.connTotal.Load())
+	require.NoError(t, db.Close())
+	require.Eventually(t, func() bool { return s.counterSet.connTotal.Load() == 0 }, 5*time.Second, 10*time.Millisecond)
+	require.Empty(t, logs.FilterMessage("failed to close tcp connection").All())
 }
 
 func TestHandlerCurrentConnections(t *testing.T) {
@@ -1203,9 +1210,10 @@ func TestDisconnectCleanupSealsMigrationBeforeCapture(t *testing.T) {
 	tun.mu.sc = current
 	killed := make(chan ServerConn, 1)
 	cc := &mockClientConn{killFn: func(sc ServerConn) error { killed <- sc; return nil }}
-	done := make(chan bool, 1)
+	done := make(chan struct{}, 1)
 	go func() {
-		done <- h.cleanupBackendOnClientDisconnect(withCode(syscall.ECONNRESET, codeClientDisconnect), cc, tun)
+		h.cleanupBackendOnClientDisconnect(withCode(syscall.ECONNRESET, codeClientDisconnect), cc, tun)
+		close(done)
 	}()
 	<-entered
 	// The handler must complete terminal Close before selecting its backend.
@@ -1219,7 +1227,7 @@ func TestDisconnectCleanupSealsMigrationBeforeCapture(t *testing.T) {
 	require.ErrorIs(t, tun.replaceServerConn(nil, replacement, false), errPipeClosed)
 	require.True(t, replacementClosed)
 	releaseWaiter()
-	require.True(t, <-done)
+	<-done
 	require.Same(t, current, <-killed)
 	require.Same(t, current, tun.getServerConn())
 }
@@ -1249,9 +1257,10 @@ func TestDisconnectCleanupClosesBackendBeforeNotification(t *testing.T) {
 		return nil
 	}}
 
-	done := make(chan bool, 1)
+	done := make(chan struct{}, 1)
 	go func() {
-		done <- h.cleanupBackendOnClientDisconnect(withCode(io.EOF, codeClientDisconnect), cc, tun)
+		h.cleanupBackendOnClientDisconnect(withCode(io.EOF, codeClientDisconnect), cc, tun)
+		close(done)
 	}()
 
 	require.Same(t, current, <-notificationStarted)
@@ -1261,7 +1270,7 @@ func TestDisconnectCleanupClosesBackendBeforeNotification(t *testing.T) {
 		t.Fatal("backend close waited for control-plane notification")
 	}
 	release()
-	require.True(t, <-done)
+	<-done
 }
 
 func TestHandler_handleTunnelErrCleansPlainInFlightEOF(t *testing.T) {
```

**File**: `pkg/proxy/mysql_conn_buf.go` (modified, +17/-9)
```diff
@@ -16,6 +16,7 @@ package proxy
 
 import (
 	"bufio"
+	"context"
 	"fmt"
 	"io"
 	"net"
@@ -204,26 +205,30 @@ func (b *msgBuf) preRecv() (int, error) {
 // mechanism.
 // The first return value is true if the command is handled, means it does not need
 // to be sent through tunnel anymore; false otherwise.
-// The second return value is true means that the transfer happened.
-func (b *msgBuf) consumeClient(msg []byte) bool {
+func (b *msgBuf) consumeClient(ctx context.Context, msg []byte) (bool, error) {
 	if b.reqC == nil {
-		return false
+		return false, nil
 	}
 	e, r := makeEvent(msg, b)
 	if e == nil {
-		return false
+		return false, nil
 	}
 
-	// send this event to the request channel.
-	sendReq(e, b.reqC)
+	// Once delivered, the event handler owns the acknowledgement. Before
+	// delivery, cancellation must release a sender whose handler has stopped.
+	select {
+	case b.reqC <- e:
+	case <-ctx.Done():
+		return false, ctx.Err()
+	}
 
 	// after send, wait the event finished.
 	e.wait()
 
 	// We cannot write to b.src directly here. The response has
 	// to go to the server conn buf, and lock writeMu then
 	// write to client.
-	return r
+	return r, nil
 }
 
 func (b *msgBuf) debugLogs(data []byte, dataLeft int) {
@@ -252,7 +257,7 @@ func (b *msgBuf) flushBufDst() error {
 
 // sendTo sends the data in buffer to destination. handled is true when the
 // complete client command was consumed by the proxy event path instead.
-func (b *msgBuf) sendTo(dst io.Writer) (handled bool, err error) {
+func (b *msgBuf) sendTo(ctx context.Context, dst io.Writer) (handled bool, err error) {
 	l, err := b.preRecv()
 	if err != nil {
 		return false, err
@@ -289,7 +294,10 @@ func (b *msgBuf) sendTo(dst io.Writer) (handled bool, err error) {
 	b.debugLogs(b.buf[readPos:writePos], dataLeft)
 
 	if dataLeft == 0 && b.name == connClientName {
-		handled = b.consumeClient(b.buf[readPos:writePos])
+		handled, err = b.consumeClient(ctx, b.buf[readPos:writePos])
+		if err != nil {
+			return false, err
+		}
 		// means the query has been handled
 		if handled {
 			return true, nil
```

**File**: `pkg/proxy/mysql_conn_buf_test.go` (modified, +3/-2)
```diff
@@ -15,6 +15,7 @@
 package proxy
 
 import (
+	"context"
 	"math"
 	"net"
 	"testing"
@@ -182,7 +183,7 @@ func TestMySQLConnSend(t *testing.T) {
 			require.Equal(t, "ect 1", string(res[:n]))
 		}()
 		d1 := newMySQLConn("source", dst1, 8, nil, nil, false, 0)
-		handled, err := d1.sendTo(src2)
+		handled, err := d1.sendTo(context.Background(), src2)
 		require.NoError(t, err)
 		require.False(t, handled)
 	})
@@ -208,7 +209,7 @@ func TestMySQLConnSend(t *testing.T) {
 			require.Equal(t, q, string(res[5:n]))
 		}()
 		d1 := newMySQLConn("source", dst1, 30, nil, nil, false, 0)
-		handled, err := d1.sendTo(src2)
+		handled, err := d1.sendTo(context.Background(), src2)
 		require.NoError(t, err)
 		require.False(t, handled)
 	})
```

#### Recent Merged Pull Requests:
- **PR #33129** (2026-11-24): Return fileservice read buffer allocation errors (@iamlinjunhong)
- **PR #33128** (2026-11-24): fix(disttae): tie insert logtail buffers to snapshot lifetime (@LeftHandCold)
- **PR #33122** (2026-11-24): [4.2-dev] test(morpc): stabilize blackholed timeout tests (@XuPeng-SH)
- **PR #33114** (2026-11-23): test(embed): start publication lock test transactions fresh (@fengttt)
- **PR #33111** (2026-11-24): fix(embed): shorten test unix socket paths (@XuPeng-SH)
- **PR #33110** (2026-11-23): feat(plan): plan DML on FULLTEXT/vector-indexed tables with the new DML planner (@cpegeric)

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

## X. prepare): never allocate for parameter binding after the first execution

**RULE**:
When implementing operations in `pkg/container/vector/vector.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `32c9bc65`: prepare): never allocate for parameter binding after the first execution. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/container/vector/vector.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// WindowInto is Window into a descriptor the caller already holds: w becomes a
// read-only reference to [start, end) of v's memory without allocating a new
// Vector. w must be read-only (a reference or a zero Vector); whatever it
// referenced before is dropped.
func (v *Vector) WindowInto(w *Vector, start, end int) error {
	if !w.IsReadOnly() {
		return moerr.NewInternalErrorNoCtx("vector window target owns memory")
	}
	if !v.validWindowRange(start, end, false) {
		return moerr.NewInvalidInputNoCtx("invalid vector window")
	}
	v.readOnlyWindowInto(w, start, end)
	return nil
}

	w := &Vector{}
	v.readOnlyWindowInto(w, start, end)
	return w
}

func (v *Vector) readOnlyWindowInto(w *Vector, start, end int) {
	*w = Vector{typ: v.typ, class: v.class, length: end - start, sorted: v.sorted}
		return
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	w := &Vector{typ: v.typ, class: v.class, length: end - start, sorted: v.sorted}
		return w
	return w
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `32c9bc65` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
