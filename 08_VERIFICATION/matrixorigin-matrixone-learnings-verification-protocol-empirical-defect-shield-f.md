# Verification Protocol: Verification Protocol: Empirical Defect Shield for matrixorigin-matrixone-learnings

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin-matrixone-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T17:14:27.296Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matrixorigin-matrixone-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin-matrixone-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T17:14:27.296Z`  
> **Learning ID**: `LEARN-EVO-matrixorigin-matrixone-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `matrixorigin-matrixone-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `f70c37b1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T17:14:22.301Z  
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
> **Harvest Timestamp**: 2026-11-15T17:14:22.294Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2065 stars

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
- **Issue #32771** (2026-11-15): **perf: avoid repeated TEXT assignment buffer growth**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32751  ## What this PR does / why we need it:  A new TEXT/BLOB assignment result can repeatedly grow its payload area as large fields are appended. During operations such as ALTER's table copy, old and new buffers coexist and increase transient CN memory use.  For eligible empty, independently owned results, preflight the selected source values and reserve the required payload area once. Width or collation violations, partial selection, aliases, existing capacity, unsupported vector shapes, and allocations beyond the allocator's single-allocation limit keep the original path. The assignment still owns its output, and existing truncation, warning, error, and NULL behavior is preserved.  Validation on a CPU-only 57 host:  - Full `pkg/sql/plan/function` tests and package race test; focused race tests and 100 repeated concurrent-reader runs; incremental lint and format checks. - A four-field regression test reduces result-area allocations from four on the base to one. For one 8 MiB field and 31 64 KiB fields, result-area peak allocation decreases from 18,882,560 to 10,420,224 bytes when the large field comes first; with the large field last, cumulative allocations decrease from 21,692,416 to 10,420,224 bytes. - Isolated 1-CN SQL LOAD/ALTER comparisons verified all row hashes, NULLs, stri

- **Issue #32769** (2026-11-15): **perf: reduce CSV field copy amplification on 4.2-dev**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #32751. Port of main #32766.  ## What this PR does / why we need it:  CSV fragments spanning read blocks were assembled into a temporary growing buffer and then copied into the row buffer, repeating allocation even with a reusable row buffer. Append fragments directly into the caller-owned row/lookahead accumulator, retaining the single-block path.  Adapt the change to 4.2's raw record bounds and memory reservation callbacks. Growth grants still precede appends, and rejected lookahead preserves the prior empty-fragment error result. Keep the existing conservative reservation envelope.  Six alternating Linux/amd64 CPU benchmark samples with Go 1.26.4: - Reused plain 1 MiB / 8 MiB fields: 3,399,680 / 43,220,992 B/op -> 0; time improves about 44% / 55%. Four concurrent 1 MiB readers improve about 58%. - Tradeoff: serial small/wide CSV framing is about 3.6% / 3.5% slower (roughly 1 ns/field). Cold row capacity after an 8 MiB field is about 9.07 MiB versus 8 MiB (1 MiB: 1.20 versus 1 MiB). This targets large-value ingestion and does not make every workload better. - Parallel fixtures keep mutable row headers local to each goroutine. Corrected small-field concurrent controls do not establish a consistent regression; initial shared-header samples are superseded.  Validation: full csvparser n

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

### Incident Patch 1: `d1893e5a` (2026-11-15)
**Commit Message**: fix(ci): correct SCA closure and native test lifecycle ownership (#32717)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32664
Fixes #32706
Fixes #32715

Related to #32544, #32570, #32423, #32422, #32324, #32185 and #32179.
These historical incidents are not claimed fixed by this PR; the local
controls do not establish their original causes.

Supersedes #32666.

## What this PR does / why we need it:

Correct CI dependency selection and test ownership boundaries that cause
unnecessary work or make failures wait on resources that cannot
complete. The branch is rebased on main. This change does not add
runners or change DWARF settings.

- **SCA selection:** traverse `go list` production and test variants
before mapping them to package owners, preventing a test-only reverse
edge from pulling in unchanged production consumers. Changed production
still seeds its variants, and uncertain discovery or broad fan-out still
selects full analysis. Real Go/Make fixtures cover both internal and
external tests, reverse edges and fallbacks.
- **Bootstrap 

**File**: `.github/ci/static-analysis.cjs` (modified, +20/-16)
```diff
@@ -19,7 +19,7 @@ const { category, immutableChanges } = require('./change-scope.cjs');
 
 // Emit one bounded record per main-module package/variant. Go owns import and
 // build-tag resolution, including test-only importers; no source import parser.
-const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,TestImports,XTestImports,' +
+const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,' +
   'GoFiles,CgoFiles,TestGoFiles,XTestGoFiles';
 
 // go list emits adjacent JSON objects rather than an array. Frame the objects;
@@ -49,7 +49,6 @@ function inventory(text) {
           const generatedMain = p.Name === 'main' && p.ImportPath.endsWith('.test') &&
             p.GoFiles?.length && p.GoFiles.every(file => path.isAbsolute(file));
           records.push({ id: p.ImportPath, dir: p.Dir, imports: p.Imports || [],
-            testImports: p.TestImports || [], xTestImports: p.XTestImports || [],
             sources: [...(generatedMain ? [] : p.GoFiles || []), ...(p.CgoFiles || []),
               ...(p.TestGoFiles || []), ...(p.XTestGoFiles || [])] });
         }
@@ -95,36 +94,41 @@ function selectPackages(files, records, root, report = () => {}) {
     owners.set(relative, owner);
     variants.set(record.id, owner);
   }
+  // Imports already resolves production, internal-test and external-test
+  // variants. Keep those identities until traversal ends: a test importer does
+  // not make its owner's unchanged production consumers affected.
   for (const record of records) {
-    const owner = variants.get(record.id);
-    for (const imported of [...(record.imports || []), ...(record.testImports || []),
-      ...(record.xTestImports || [])]) {
-      const dependency = variants.get(imported);
-      if (!dependency) {
+    for (const imported of record.imports || []) {
+      if (!variants.has(imported)) {
         // A main-module test variant missing from discovery is not a known
         // external dependency. Do not guess how its package ID maps.
         if (imported.includes(' [')) return full('test variant is missing from the verified graph');
         continue;
       }
-      if (!reverse.has(dependency)) reverse.set(dependency, new Set());
-      reverse.get(dependency).add(owner);
+      if (!reverse.has(imported)) reverse.set(imported, new Set());
+      reverse.get(imported).add(record.id);
     }
   }
   const selected = new Set();
-  const production = [];
+  const production = new Set();
   for (const file of changed) {
     const owner = owners.get(path.posix.dirname(file));
     if (!owner) return full('changed package is missing from the verified graph');
     selected.add(owner);
-    if (!file.endsWith('_test.go')) production.push(owner);
+    if (!file.endsWith('_test.go')) production.add(owner);
   }
-  const seen = new Set(production);
-  for (let i = 0; i < production.length; i++) {
-    for (const consumer of reverse.get(production[i]) || []) {
-      selected.add(consumer);
+  // A changed production source belongs to every active variant of its owner.
+  const pending = [];
+  for (const [id, owner] of variants) {
+    if (production.has(owner)) pending.push(id);
+  }
+  const seen = new Set(pending);
+  for (let i = 0; i < pending.length; i++) {
+    for (const consumer of reverse.get(pending[i]) || []) {
+      selected.add(variants.get(consumer));
       if (!seen.has(consumer)) {
         seen.add(consumer);
-        production.push(consumer);
+        pending.push(consumer);
       }
     }
   }
```

**File**: `.github/ci/static-analysis.test.cjs` (modified, +25/-3)
```diff
@@ -40,6 +40,24 @@ test('complete package selection follows production and test imports, not test r
   assert.deepEqual(selectPackages([file('pkg/a/a.go', 'D')], records, root), ['./pkg/a', './pkg/b', './pkg/c']);
 });
 
+test('test dependencies preserve variant identity through the reverse closure', () => {
+  const packages = records.slice(0, 8).map(p => ({ ...p, imports: [] }));
+  const [a, b, c, d] = packages;
+  c.imports = [b.id];
+  d.imports = [c.id];
+  const bTest = { id: `${b.id}_test [${b.id}.test]`, dir: b.dir, imports: [a.id] };
+  const graph = [...packages, bTest];
+  assert.deepEqual(selectPackages([file('pkg/a/a.go')], graph, root), ['./pkg/a', './pkg/b']);
+  assert.deepEqual(selectPackages([file('pkg/b/b.go')], graph, root), ['./pkg/b', './pkg/c', './pkg/d']);
+  assert.deepEqual(selectPackages([file('pkg/a/a_test.go')], graph, root), ['./pkg/a']);
+
+  // A production file also belongs to variants compiled for another owner's tests.
+  const bVariant = { id: `${b.id} [${a.id}.test]`, dir: b.dir, imports: [] };
+  const aTest = { id: `${a.id}_test [${a.id}.test]`, dir: a.dir, imports: [bVariant.id] };
+  const variantGraph = packages.map(p => ({ ...p, imports: [] }));
+  assert.deepEqual(selectPackages([file('pkg/b/b.go')], [...variantGraph, bVariant, aTest], root), ['./pkg/a', './pkg/b']);
+});
+
 test('uncertain inputs and broad changes retain full analysis', () => {
   for (const files of [null, [], [file('README.md')], [file('go.mod')], [file('cgo/x.c')],
     [file('.golangci.yml')], [file('pkg/a/testdata/input.go')], [file('pkg/gone/x.go', 'D')],
@@ -53,7 +71,7 @@ test('uncertain inputs and broad changes retain full analysis', () => {
 
 test('Go JSON inventory is framed without interpreting braces inside strings', () => {
   const p = { ImportPath: 'example.org/pkg/a', Dir: '/repo/pkg/a', Module: { Main: true },
-    Imports: ['external/{quoted}"'], TestImports: ['testing'] };
+    Imports: ['external/{quoted}"'] };
   const parsed = inventory(`${JSON.stringify({ ImportPath: 'fmt' })}\n${JSON.stringify(p)}\n`);
   assert.equal(parsed.length, 1);
   assert.deepEqual(parsed[0].imports, p.Imports);
@@ -107,8 +125,12 @@ test('real Make consumer shares selection, keeps full override, and propagates a
   fs.writeFileSync(path.join(repo, 'go.mod'), 'module example.org/project\n\ngo 1.23.0\n');
   for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
     const p = path.join(repo, 'pkg', name); fs.mkdirSync(p, { recursive: true });
-    fs.writeFileSync(path.join(p, `${name}.go`), `package ${name}\n${name === 'b' ? 'import _ "example.org/project/pkg/a"\n' : ''}func Value() int { return 1 }\n`);
-    if (name === 'c') fs.writeFileSync(path.join(p, 'c_test.go'), 'package c_test\nimport _ "example.org/project/pkg/a"\n');
+    const dependency = { b: 'a', d: 'c', e: 'd' }[name];
+    fs.writeFileSync(path.join(p, `${name}.go`), `package ${name}\n${dependency ? `import _ "example.org/project/pkg/${dependency}"\n` : ''}func Value() int { return 1 }\n`);
+    if (name === 'c') {
+      fs.writeFileSync(path.join(p, 'c_test.go'), 'package c_test\nimport _ "example.org/project/pkg/a"\n');
+      fs.writeFileSync(path.join(p, 'c_internal_test.go'), 'package c\nimport _ "example.org/project/pkg/a"\n');
+    }
   }
   const source = path.resolve(__dirname, '../..');
   fs.mkdirSync(path.join(repo, '.github/ci'), { recursive: true });
```

**File**: `pkg/embed/cluster_test.go` (modified, +53/-0)
```diff
@@ -21,11 +21,13 @@ import (
 	"errors"
 	"flag"
 	"fmt"
+	"net"
 	"os"
 	"os/exec"
 	"path/filepath"
 	"sort"
 	"strconv"
+	"strings"
 	"sync"
 	"sync/atomic"
 	"testing"
@@ -1801,3 +1803,54 @@ func TestClusterAndLegacyPortAllocatorsShareLeases(t *testing.T) {
 	}
 	require.False(t, locked)
 }
+
+// A frontend constructor can fail after the engine starts catalog replay and
+// before the CN heartbeat is published. Teardown must retire both owners.
+func TestCNFrontendConstructionFailureReleasesResources(t *testing.T) {
+	socket := filepath.Join(t.TempDir(), strings.Repeat("s", 160))
+	var frontendAddress string
+	value, err := NewCluster(WithTesting(), WithCNCount(1), WithPreStart(func(op ServiceOperator) {
+		if op.ServiceType() == metadata.ServiceType_CN {
+			op.Adjust(func(cfg *ServiceConfig) {
+				cfg.CN.Frontend.UnixSocketAddress = socket
+				frontendAddress = net.JoinHostPort("127.0.0.1", strconv.Itoa(int(cfg.CN.Frontend.Port)))
+			})
+		}
+	}))
+	require.NoError(t, err)
+	c := value.(*cluster)
+	t.Cleanup(func() {
+		require.NoError(t, c.Close())
+		require.True(t, c.CloseComplete())
+		require.NoError(t, os.RemoveAll(c.options.dataPath))
+	})
+	failure := errors.New("injected Unix frontend construction failure")
+	var panicValue any
+	var failed cnservice.Service
+	// Recover only at the existing test seam, in the constructor's goroutine;
+	// the real production constructor and rollback still own every resource.
+	c.startFn = func(op *operator) (err error) {
+		if op.serviceType == metadata.ServiceType_CN {
+			defer func() {
+				if value := recover(); value != nil {
+					panicValue = value
+					failed, _ = op.reset.svc.(cnservice.Service)
+					err = failure
+				}
+			}()
+		}
+		return op.StartContext(c.startup.context())
+	}
+	require.ErrorIs(t, c.Start(), failure)
+	require.NotNil(t, panicValue)
+	require.Contains(t, fmt.Sprint(panicValue), "listen unix "+socket)
+	require.NotNil(t, failed)
+	state, ok := failed.(interface{ CloseComplete() bool })
+	require.True(t, ok)
+	require.True(t, state.CloseComplete(), "failed CN construction must finish its owned cleanup")
+	require.NoError(t, c.Close())
+	require.True(t, c.CloseComplete())
+	rebound, err := net.Listen("tcp", frontendAddress)
+	require.NoError(t, err, "failed frontend handoff must release its TCP listener")
+	require.NoError(t, rebound.Close())
+}
```

**File**: `pkg/frontend/cdc_restart_timeout_fallback_test.go` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
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
+	"flag"
+	"os"
+	"os/exec"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/cdc"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/task"
+	ie "github.com/matrixorigin/matrixone/pkg/util/internalExecutor"
+)
+
+type restartCatalogOperation struct {
+	sql        string
+	account    uint32
+	accountSet bool
+}
+
+type restartCatalogRecorder struct {
+	*blockingRestartPublicationExecutor
+	mu         sync.Mutex
+	operations []restartCatalogOperation
+}
+
+func (r *restartCatalogRecorder) record(ctx context.Context, sql string) {
+	account, err := defines.GetAccountId(ctx)
+	r.mu.Lock()
+	r.operations = append(r.operations, restartCatalogOperation{sql: sql, account: account, accountSet: err == nil})
+	r.mu.Unlock()
+}
+
+func (r *restartCatalogRecorder) Exec(ctx context.Context, sql string, opts ie.SessionOverrideOptions) error {
+	_, err := r.ExecWithStatus(ctx, sql, opts)
+	return err
+}
+
+func (r *restartCatalogRecorder) ExecWithStatus(ctx context.Context, sql string, opts ie.SessionOverrideOptions) (ie.InternalExecStatus, error) {
+	r.record(ctx, sql)
+	return r.blockingRestartPublicationExecutor.ExecWithStatus(ctx, sql, opts)
+}
+
+func (r *restartCatalogRecorder) Query(ctx context.Context, sql string, opts ie.SessionOverrideOptions) ie.InternalExecResult {
+	r.record(ctx, sql)
+	return r.blockingRestartPublicationExecutor.Query(ctx, sql, opts)
+}
+
+// The larger restart test exercises a real race. Pin the alternative where
+// publication has committed running before timeout persistence reads the
+// catalog, so the fallback and its ownership fence have explicit oracles.
+func TestRestartTimeoutRepairsLateRunningCatalogState(t *testing.T) {
+	const childMarker = "MO_TEST_CDC_TIMEOUT_FALLBACK_CHILD"
+	child := os.Getenv(childMarker) == "error-controls"
+	var once sync.Once
+	var childOutput []byte
+	var childErr error
+	runErrorControls := func() {
+		ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
+		defer cancel()
+		args := []string{"-test.run=^TestRestartTimeoutRepairsLateRunningCatalogState$", "-test.v", "-test.count=1", "-test.timeout=20s"}
+		if testing.CoverMode() != "" {
+			coverageDir := ""
+			if f := flag.Lookup("test.gocoverdir"); f != nil {
+				coverageDir = f.Value.String()
+			}
+			if coverageDir == "" {
+				coverageDir = os.Getenv("GOCOVERDIR")
+			}
+			if coverageDir == "" {
+				childErr = errors.New("the child must contribute to the parent coverage profile")
+				return
+			}
+			args = append(args, "-test.gocoverdir="+coverageDir)
+		}
+		command := exec.CommandContext(ctx, os.Args[0], args...)
+		command.Env = append(os.Environ(), childMarker+"=error-controls")
+		childOutput, childErr = command.CombinedOutput()
+	}
+	cases := []struct {
+		name, initial, owner, final string
+		fallback, wantError         bool
+	}{
+		{"timed out and running", cdc.CDCState_Running, "timed out", cdc.CDCState_Failed, true, false},
+		{"missing owner", cdc.CDCState_Running, "missing", cdc.CDCState_Running, false, true},
+		{"pending owner", cdc.CDCState_Running, "pending", cdc.CDCState_Running, false, true},
+		{"conflicting paused state", cdc.CDCState_Paused, "timed out", cdc.CDCState_Paused, true, true},
+		{"still restarting", cdc.CDCState_Restarting, "timed out", cdc.CDCState_Failed, false, false},
+	}
+	for _, tc := range cases {
+		if child && !tc.wantError {
+			continue
+		}
+		t.Run(tc.name, func(t *testing.T) {
+			if tc.wantError && !child {
+				// These errors consume a process-wide logging budget. A single
+				// child isolates them and is also used for selected subtests.
+				once.Do(runErrorControls)
+				require.NoError(t, childErr, "isolated error controls: %s", childOutput)
+				name := strings.ReplaceAll(tc.name, " ", "_")
+				require.Contains(t, string(childOutput), "--- PASS: TestRestartTimeoutRepairsLateRunningCatalogState/"+name)
+				return
+			}
+			store := newBlockingRestartPublicationExecutor()
+			// This test fixes the catalog's starting state; it does not park a
+			// publication. An unexpected running update must not hang it.
+			store.unblock()
+			store.state = tc.initial
+			recorder := &restartCatalogRecorder{b
```

**File**: `pkg/frontend/mysql_cmd_executor_test.go` (modified, +47/-1)
```diff
@@ -174,6 +174,23 @@ func TestDoComQueryParseErrorReplacesPreviousDiagnostics(t *testing.T) {
 	require.Equal(t, 1, info.length())
 	require.Equal(t, []uint16{1064}, info.codes)
 	require.NotContains(t, info.msgs, "stale diagnostic marker")
+	t.Run("restore outer statement after parse error", func(t *testing.T) {
+		previous := ses.GetStmtInfo()
+		t.Cleanup(func() { ses.SetTStmt(previous) })
+		outer := &motrace.StatementInfo{Statement: []byte("outer statement")}
+		ses.SetTStmt(outer)
+		ses.appendErrorDiagnostic(1000, "stale diagnostic marker")
+		execCtx := newTestExecCtx(ctx, ctrl)
+		execCtx.ses = ses
+		err := doComQuery(ses, execCtx, &UserInput{sql: "select from"})
+		require.Error(t, err)
+		require.Same(t, outer, ses.GetStmtInfo(), "a nested request must return the outer statement to its owner")
+		ses.appendErrorDiagnostic(1064, err.Error())
+		info := ses.diagnosticsSnapshot()
+		require.Equal(t, 1, info.length())
+		require.Equal(t, []uint16{1064}, info.codes)
+		require.NotContains(t, info.msgs, "stale diagnostic marker")
+	})
 }
 
 func TestDoComQueryParseErrorRedactsMongoDBSelector(t *testing.T) {
@@ -9167,6 +9184,9 @@ func TestJsonPlanHandlerRefreshesTerminalResourceSummary(t *testing.T) {
 	require.Nil(t, unmarshaled.buffer)
 	require.Nil(t, unmarshaled.marshalHandler)
 	require.Nil(t, unmarshaled.Marshal(context.Background()))
+	unmarshaled.SetResourceSummary(summary)
+	var absent *jsonPlanHandler
+	absent.SetResourceSummary(summary)
 }
 
 func TestSchedulingTracePlanHandlerMarshalsLazilyOnce(t *testing.T) {
@@ -10888,6 +10908,14 @@ func TestMysqlCmdExecutor_HandleShowBackendServers(t *testing.T) {
 
 }
 
+func enableParseErrorTracer(t *testing.T) {
+	t.Helper()
+	provider := motrace.GetTracerProvider()
+	wasEnabled := provider.IsEnable()
+	t.Cleanup(func() { provider.SetEnable(wasEnabled) })
+	provider.SetEnable(true)
+}
+
 func Test_RecordParseErrorStatement(t *testing.T) {
 	ctrl := gomock.NewController(t)
 	defer ctrl.Finish()
@@ -10916,7 +10944,7 @@ func Test_RecordParseErrorStatement(t *testing.T) {
 		Ctx:  context.TODO(),
 	}
 
-	motrace.GetTracerProvider().SetEnable(true)
+	enableParseErrorTracer(t)
 	_, err := RecordParseErrorStatement(context.TODO(), ses, proc, time.Now(), nil, nil, moerr.NewInternalErrorNoCtx("test"))
 	assert.Nil(t, err)
 
@@ -10936,6 +10964,24 @@ func Test_RecordParseErrorStatement(t *testing.T) {
 
 }
 
+func TestRecordParseErrorStatementRestoresTracer(t *testing.T) {
+	provider := motrace.GetTracerProvider()
+	wasEnabled := provider.IsEnable()
+	t.Cleanup(func() { provider.SetEnable(wasEnabled) })
+	for _, enabled := range []bool{false, true} {
+		t.Run(fmt.Sprintf("initial=%t", enabled), func(t *testing.T) {
+			provider.SetEnable(enabled)
+			require.True(t, t.Run("enable tracer", func(t *testing.T) {
+				enableParseErrorTracer(t)
+				require.Same(t, provider, motrace.GetTracerProvider())
+				require.True(t, provider.IsEnable())
+			}))
+			require.Same(t, provider, motrace.GetTracerProvider())
+			require.Equal(t, enabled, provider.IsEnable())
+		})
+	}
+}
+
 func Test_getExplainOption(t *testing.T) {
 	ctx := context.TODO()
 	var option *explain.ExplainOptions
```

**File**: `pkg/frontend/server.go` (modified, +16/-7)
```diff
@@ -844,13 +844,6 @@ func NewMOServer(
 	if err != nil {
 		logutil.Panicf("start server failed with %+v", err)
 	}
-	setRtMgr(service, rm)
-	rm.setBaseService(baseService)
-	if baseService != nil {
-		rm.setSessionMgr(baseService.SessionMgr())
-	}
-	// TODO asyncFlushBatch
-	unixAddr := pu.SV.GetUnixSocketAddress()
 	mo := &MOServer{
 		addr:    addr,
 		uaddr:   pu.SV.UnixSocketAddress,
@@ -859,6 +852,21 @@ func NewMOServer(
 		handler: rm.Handler,
 		service: service,
 	}
+	constructed := false
+	defer func() {
+		if !constructed {
+			if err := mo.Stop(); err != nil {
+				logutil.Errorf("failed to stop partially constructed frontend: %v", err)
+			}
+		}
+	}()
+	setRtMgr(service, rm)
+	rm.setBaseService(baseService)
+	if baseService != nil {
+		rm.setSessionMgr(baseService.SessionMgr())
+	}
+	// TODO asyncFlushBatch
+	unixAddr := pu.SV.GetUnixSocketAddress()
 	listenerTcp, err := net.Listen("tcp", addr)
 	if err != nil {
 		logutil.Panicf("start server failed with %+v", err)
@@ -871,6 +879,7 @@ func NewMOServer(
 		}
 		mo.listeners = append(mo.listeners, listenerUnix)
 	}
+	constructed = true
 	return mo
 }
 
```

**File**: `pkg/frontend/server_test.go` (modified, +95/-1)
```diff
@@ -18,8 +18,11 @@ import (
 	"context"
 	"database/sql"
 	"errors"
+	"fmt"
 	"io"
 	"net"
+	"path/filepath"
+	"strings"
 	"sync"
 	"testing"
 	"time"
@@ -40,14 +43,18 @@ type closeErrorListener struct {
 
 type testMOServerBaseService struct {
 	MockBaseService
-	id string
+	id              string
+	sessionMgrPanic error
 }
 
 func (s *testMOServerBaseService) ID() string {
 	return s.id
 }
 
 func (s *testMOServerBaseService) SessionMgr() *queryservice.SessionManager {
+	if s.sessionMgrPanic != nil {
+		panic(s.sessionMgrPanic)
+	}
 	return nil
 }
 
@@ -131,6 +138,69 @@ func TestMOServerEmptyUnixAddressUsesTCPOnly(t *testing.T) {
 	require.NoError(t, rebound.Close())
 }
 
+func TestMOServerConstructorFailureReleasesResources(t *testing.T) {
+	for _, network := range []string{"session-manager", "tcp", "unix"} {
+		t.Run(network, func(t *testing.T) {
+			address := "127.0.0.1:0"
+			var occupied net.Listener
+			if network != "session-manager" {
+				var err error
+				occupied, err = net.Listen("tcp", address)
+				require.NoError(t, err)
+				t.Cleanup(func() { _ = occupied.Close() })
+				address = occupied.Addr().String()
+			}
+			pu := config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil)
+			pu.SV.SetDefaultValues()
+			pu.SV.KillRountinesInterval = 1
+			pu.SV.UnixSocketAddress = ""
+			if network == "unix" {
+				require.NoError(t, occupied.Close())
+				// Filesystem preflight succeeds; only the Unix bind must fail.
+				pu.SV.UnixSocketAddress = filepath.Join(t.TempDir(), strings.Repeat("s", 160))
+			}
+			ctx, cancel := context.WithCancel(t.Context())
+			defer cancel() // Also retires old-code workers in the negative control.
+			service := &testMOServerBaseService{id: t.Name()}
+			if network == "session-manager" {
+				service.sessionMgrPanic = errors.New("injected session manager panic")
+			}
+			var failure any
+			func() {
+				defer func() { failure = recover() }()
+				NewMOServer(ctx, address, pu, nil, service)
+			}()
+			require.NotNil(t, failure)
+			if network == "session-manager" {
+				require.Same(t, service.sessionMgrPanic, failure, "cleanup must preserve the original panic")
+			} else {
+				require.Contains(t, fmt.Sprint(failure), "listen "+network)
+			}
+			if network == "unix" {
+				require.Contains(t, fmt.Sprint(failure), pu.SV.UnixSocketAddress)
+			}
+			require.NoError(t, ctx.Err(), "constructor cleanup must not cancel its caller")
+			manager := getRtMgr(service.id)
+			require.NotNil(t, manager)
+			if !assert.ErrorIs(t, manager.ctx.Err(), context.Canceled) {
+				cancel() // Release old-code workers before checking the listener.
+			}
+			joined := make(chan struct{})
+			go func() { manager.workerWG.Wait(); close(joined) }()
+			select {
+			case <-joined:
+			case <-time.After(5 * time.Second):
+				t.Fatal("frontend constructor left its routine manager worker running")
+			}
+			if network == "unix" {
+				rebound, err := net.Listen("tcp", address)
+				require.NoError(t, err, "Unix bind failure must release the earlier TCP listener")
+				require.NoError(t, rebound.Close())
+			}
+		})
+	}
+}
+
 func TestMOServerStopJoinsConnectionCleanup(t *testing.T) {
 	ctx, cancel := context.WithCancel(t.Context())
 	defer cancel()
@@ -297,6 +367,30 @@ func Test_handshake(t *testing.T) {
 	assert.NoError(t, err)
 }
 
+func TestMOServerHandleRequestReturnsPeerEOF(t *testing.T) {
+	service := t.Name()
+	InitServerLevelVars(service)
+	t.Cleanup(func() { serverVarsMap.Delete(service) })
+	allocator := NewLeakCheckAllocator()
+	setSessionAlloc(service, allocator)
+	pu := config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil)
+	pu.SV.SetDefaultValues()
+	serverConn, peer := net.Pipe()
+	t.Cleanup(func() { _ = serverConn.Close(); _ = peer.Close() })
+	conn, err := NewIOSession(serverConn, pu, service)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = conn.Close() })
+	// net.Pipe rejects setting a new deadline after its peer closes. Arm the
+	// bounded read now and prevent ReadFromConn from resetting that deadline.
+	conn.timeout = 0
+	require.NoError(t, serverConn.SetReadDeadline(time.Now().Add(time.Second)))
+	require.NoError(t, peer.Close())
+	server := &MOServer{running: true}
+	require.Equal(t, io.EOF, server.handleRequest(conn))
+	require.NoError(t, conn.Close())
+	require.True(t, allocator.CheckBalance())
+}
+
 // TestMOServerTerminatesConnectionOnClientQuit proves the COM_QUIT contract
 // at the connection owner: the MySQL wire protocol makes the client send
 // COM_QUIT and wait for the server (not the client) to close the connection.
```

**File**: `pkg/frontend/trace_ownership_test.go` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
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
+	"encoding/json"
+	"testing"
+	"time"
+
+	"github.com/google/uuid"
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/config"
+	"github.com/matrixorigin/matrixone/pkg/frontend/constant"
+	plan0 "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/util/resource"
+	"github.com/matrixorigin/matrixone/pkg/util/trace/impl/motrace"
+)
+
+// The tracer is process-global; each case borrows it only for the lifetime of
+// the real statement and its memory epoch.
+func TestRecordStatementTraceOwnership(t *testing.T) {
+	provider := motrace.GetTracerProvider()
+	// The frontend test provider is initialized with the no-op exporter. It
+	// leaves these statements with this test, allowing deterministic release.
+	require.IsType(t, motrace.NoopBatchProcessor{}, motrace.GetGlobalBatchProcessor())
+	wasEnabled := provider.IsEnable()
+	t.Cleanup(func() { provider.SetEnable(wasEnabled) })
+	provider.SetEnable(true)
+
+	newSession := func(t *testing.T) *Session {
+		t.Helper()
+		service := t.Name()
+		InitServerLevelVars(service)
+		t.Cleanup(func() { serverVarsMap.Delete(service) })
+		pu := config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil)
+		pu.SV.SetDefaultValues()
+		setPu(service, pu)
+		proto := &internalProtocol{result: &internalExecResult{}}
+		require.Equal(t, "0.0.0.0:0", proto.Peer())
+		require.Equal(t, "0.0.0.0:0", proto.GetStr(PEER))
+		ses := NewSession(context.Background(), service, proto, nil)
+		ses.SetTenantInfo(&TenantInfo{Tenant: "trace_account", User: "trace_user"})
+		t.Cleanup(ses.Close)
+		t.Cleanup(func() {
+			h := ses.GetTxnHandler()
+			h.mu.Lock()
+			h.txnOp, h.txnCtx = nil, nil
+			h.mu.Unlock()
+		})
+		return ses
+	}
+	installTxn := func(ses *Session, id uuid.UUID) {
+		op := newTestTxnOp()
+		op.meta.ID = append([]byte(nil), id[:]...)
+		h := ses.GetTxnHandler()
+		h.mu.Lock()
+		h.txnOp, h.txnCtx = op, context.Background()
+		h.mu.Unlock()
+	}
+	start := func(t *testing.T, ses *Session) (context.Context, *motrace.StatementInfo, *resource.Root) {
+		t.Helper()
+		ctx, err := RecordStatement(context.Background(), ses, ses.GetProc(), nil, time.Now(), "select 17", constant.ExternSql, true)
+		require.NoError(t, err)
+		stmt := ses.GetStmtInfo()
+		require.NotNil(t, stmt)
+		row := motrace.SingleStatementTable.GetRow(ctx)
+		t.Cleanup(func() {
+			stmt.EndStatement(ctx, nil, 0, 0, 0)
+			stmt.FillRow(ctx, row)
+			row.Free()
+			stmt.Free()
+			ses.SetTStmt(nil)
+		})
+		root := resource.RootFromContext(ctx)
+		require.NotNil(t, root)
+		return ctx, stmt, root
+	}
+
+	t.Run("active transaction and available epoch", func(t *testing.T) {
+		ses := newSession(t)
+		id := uuid.MustParse("01020304-0506-0708-090a-0b0c0d0e0f10")
+		installTxn(ses, id)
+		ctx, stmt, root := start(t, ses)
+		require.Equal(t, id[:], stmt.TransactionID[:])
+		require.Equal(t, "trace_account", stmt.Account)
+		require.Equal(t, "trace_user", stmt.User)
+		require.Equal(t, "0.0.0.0:0", stmt.Host)
+		require.Equal(t, constant.ExternSql, stmt.SqlSourceType)
+		require.Equal(t, "select 17", string(stmt.Statement))
+		pool := ses.GetProc().Mp()
+		allocation, err := pool.Alloc(64, true)
+		require.NoError(t, err)
+		pool.Free(allocation)
+		require.GreaterOrEqual(t, root.PreResponseSummary().Memory.MaxDomainPeakLiveBytes, uint64(64))
+		stmt.EndStatement(ctx, nil, 0, 0, 0)
+		token := pool.StartResourcePeakEpoch()
+		require.NotNil(t, token, "statement completion must release its pool epoch")
+		_, ok := pool.EndResourcePeakEpoch(token)
+		require.True(t, ok)
+	})
+
+	t.Run("transaction acquired after statement starts", func(t *testing.T) {
+		ses := newSession(t)
+		ctx, stmt, _ := start(t, ses)
+		require.Equal(t, motrace.NilTxnID, stmt.TransactionID)
+		require.NoError(t, RecordStatementTxnID(ctx, ses))
+		require.Equal(t, motrace.NilTxnID, stmt.TransactionID)
+		id := uuid.MustParse("11121314-1516-1718-191a-1b1c1d1e1f20")
+		installTxn(ses, id)
+		require.NoError(t, RecordStatementTxnID(ctx, ses))
+		require.Equal(t, id[:], stmt.TransactionID[:])
+		got := ses.GetTxnId()
+		require.Equal(t, id[:], got[:])
+		installTxn(ses, uuid.MustParse("21222324-2526-2728-292a-2b2c2d2e2f30"))
+		require.NoError(t, RecordStatementTxnID(ctx, ses))
```

---

### Incident Patch 2: `88100ce0` (2026-11-15)
**Commit Message**: fix(pSpool): reserve batch backing without planning slices (#32754)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #32751.

## What this PR does / why we need it:

Reserve cached backing across the uncopied batch suffix without
allocating request or copy-index slices. After caching `[empty, 128
MiB]`, copying `[1 MiB, 128 MiB]` previously let the small column
consume the only large block. The revised real-Vector diagnostic uses
about **129 MiB target native backing/peak instead of 256 MiB**,
preserving every payload byte. This is a component result, not a CN
RSS/OOM claim. 4.2-dev counterpart: #32758.

Exact compatible hits and current needs that dominate future needs can
reuse backing directly. Other needs are visited largest-first through a
constant-size cursor, followed by source-order undersized fallback.
Best-fit searches first reject insufficient or already-worse capacities
before checking allocation provenance; the chosen block, tie order and
attachment checks are identical. Logical needs replace historical spare
backing size. P

**File**: `pkg/container/pSpool/batch_cache_test.go` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
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
+package pSpool
+
+import (
+	"bytes"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+)
+
+func newSpoolSizeBatch(tb testing.TB, mp *mpool.MPool, sizes []int, alias bool) *batch.Batch {
+	tb.Helper()
+	source := batch.NewWithSize(len(sizes))
+	tb.Cleanup(func() { source.Clean(mp) })
+	for i, size := range sizes {
+		if size == -2 {
+			var err error
+			source.Vecs[i], err = vector.NewConstBytes(types.T_text.ToType(), []byte("constant"), 1, mp)
+			require.NoError(tb, err)
+			continue
+		}
+		if size < 0 {
+			continue
+		}
+		source.Vecs[i] = vector.NewOffHeapVecWithType(types.T_text.ToType())
+		require.NoError(tb, vector.AppendBytes(source.Vecs[i], bytes.Repeat([]byte{byte(i + 1)}, size), false, mp))
+	}
+	if alias {
+		source.Vecs = append(source.Vecs, source.Vecs[len(sizes)-1])
+	}
+	source.SetRowCount(1)
+	return source
+}
+
+func TestCachedBatchCopiesMixedShapes(t *testing.T) {
+	for _, test := range []struct {
+		name                       string
+		columns                    int
+		largeBytes                 int
+		largeFirst, alias          bool
+		descriptorSlack, decorated bool
+	}{
+		{"small_first_exact", 2, 8192, false, false, false, false},
+		{"small_first_spare_capacity", 2, 8191, false, false, false, false},
+		{"large_first_control", 2, 8192, true, false, false, false},
+		{"large_first_spare_capacity", 2, 8191, true, false, false, false},
+		{"aliased_large_column", 2, 8192, false, true, false, false},
+		{"wide_batch", 40, 8192, false, false, false, false},
+		{"spare_descriptor_capacity", 2, 8192, false, false, true, false},
+		{"nil_null_and_constant", 5, 8192, false, false, false, true},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			sourceMP := mpool.MustNewZeroNoFixed()
+			t.Cleanup(func() { defer mpool.DeleteMPool(sourceMP); require.Zero(t, sourceMP.CurrNB()) })
+			seedSizes, nextSizes := make([]int, test.columns), make([]int, test.columns)
+			large, small := test.columns-1, 0
+			if test.largeFirst {
+				large, small = 0, test.columns-1
+			}
+			seedSizes[large], nextSizes[large], nextSizes[small] = 8192, test.largeBytes, 1024
+			if test.decorated {
+				seedSizes[1], nextSizes[1], seedSizes[2], nextSizes[2] = -2, -2, -1, -1
+			}
+			seed := newSpoolSizeBatch(t, sourceMP, seedSizes, test.alias)
+			source := newSpoolSizeBatch(t, sourceMP, nextSizes, test.alias)
+			if test.decorated {
+				seed.Vecs[3].SetNull(0)
+				source.Vecs[3].SetNull(0)
+			}
+			if test.descriptorSlack {
+				require.NoError(t, source.Vecs[small].PreExtend(512, sourceMP))
+			}
+			mp := mpool.MustNewZeroNoFixed()
+			t.Cleanup(func() { defer mpool.DeleteMPool(mp); require.Zero(t, mp.CurrNB()) })
+			cache := initCachedBatch(mp, 1)
+			t.Cleanup(cache.free)
+			copyAndReturn := func(src *batch.Batch, checkMemory bool) {
+				copied, useCache, id, err := cache.GetCopiedBatch(src)
+				require.NoError(t, err)
+				defer cache.CacheBatch(useCache, id, copied)
+				require.Equal(t, src.RowCount(), copied.RowCount())
+				var required int64
+				for i, vec := range src.Vecs {
+					if vec == nil {
+						require.Nil(t, copied.Vecs[i])
+						continue
+					}
+					require.Equal(t, vec.GetBytesAt(0), copied.Vecs[i].GetBytesAt(0))
+					require.Equal(t, vec.IsNull(0), copied.Vecs[i].IsNull(0))
+					if test.alias && i == len(src.Vecs)-1 {
+						require.Same(t, copied.Vecs[i-1], copied.Vecs[i])
+					} else {
+						required += int64(vec.Length()*vec.GetType().TypeSize() + cap(vec.GetArea()))
+					}
+				}
+				if checkMemory {
+					require.LessOrEqual(t, mp.CurrNB(), required,
+						"small columns must not consume the only cached backing needed by a later large column")
+				}
+			}
+			copyAndReturn(seed, false)
+			copyAndReturn(source, true)
+			copyAndReturn(source, true)
+		})
+	}
+}
+
+func TestCachedBatchMixedShapeFailureReturnsBacking(t *testing.T) {
+	sourceMP := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { defer mpool.DeleteMPool(sourceMP); require.Zero(t, sourceMP.CurrNB()) })
+	seed := newSpoolSizeBatch(t, sourceMP, []int{64, 0, 8192}, true)
+	source := newSpoolSizeBatch(t, sourceMP, []int{64, 1024, 8192}, true)
+	const limit = 1 << 20
```

**File**: `pkg/container/pSpool/copy.go` (modified, +340/-32)
```diff
@@ -101,13 +101,32 @@ func (cb *cachedBatch) GetCopiedBatch(
 		dst.Attrs[i] = src.Attrs[i]
 	}
 
-	// copy vectors.
+	memoryCache := &cb.buffer.bytesCache[cacheID]
+	planned := false
+	hasAliases := false
+
+copyVectors:
 	for i := range dst.Vecs {
 		vec := src.Vecs[i]
-		if vec == nil || dst.Vecs[i] != nil {
+		if vec == nil {
 			continue
 		}
+		if dst.Vecs[i] != nil {
+			if !planned {
+				continue
+			}
+			if hasAliases {
+				for _, previous := range src.Vecs[:i] {
+					if previous == vec {
+						continue copyVectors
+					}
+				}
+			}
+		}
 		if vec.HasBorrowedBacking() {
+			if dst.Vecs[i] != nil {
+				continue
+			}
 			dst.Vecs[i], err = vec.RetainedReadonlyViewWithMP(cb.mp)
 			if err != nil {
 				cb.CacheBatch(true, cacheID, dst)
@@ -122,80 +141,82 @@ func (cb *cachedBatch) GetCopiedBatch(
 		}
 
 		typ := *vec.GetType()
-		selection := vec.AllocationAccountSelection()
-		if selection == nil {
-			dst.Vecs[i] = vector.NewOffHeapVecWithType(typ)
-		} else {
-			dst.Vecs[i], err = vector.NewOffHeapVecWithTypeAndAllocation(
-				typ,
-				selection,
-			)
-			if err != nil {
-				cb.CacheBatch(true, cacheID, dst)
-				return nil, false, 0, err
+		if dst.Vecs[i] == nil {
+			selection := vec.AllocationAccountSelection()
+			if selection == nil {
+				dst.Vecs[i] = vector.NewOffHeapVecWithType(typ)
+			} else {
+				dst.Vecs[i], err = vector.NewOffHeapVecWithTypeAndAllocation(
+					typ,
+					selection,
+				)
+				if err != nil {
+					cb.CacheBatch(true, cacheID, dst)
+					return nil, false, 0, err
+				}
 			}
 		}
 
+		destination := dst.Vecs[i]
 		if vec.IsConst() {
-			if err = vector.GetConstSetFunction(typ, cb.mp)(dst.Vecs[i], vec, 0, vec.Length()); err != nil {
+			if err = vector.GetConstSetFunction(typ, cb.mp)(destination, vec, 0, vec.Length()); err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
 
 		} else {
-			if err = cb.buffer.bytesCache[cacheID].
-				setSuitableDataAreaToVector(
-					len(vec.GetData()),
-					len(vec.GetArea()),
-					dst.Vecs[i],
-				); err != nil {
+			planned, hasAliases, err = memoryCache.prepareCopyBacking(src, dst, i, planned, hasAliases)
+			if err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
-			dst.Vecs[i].Reset(typ)
+
+			destination.Reset(typ)
 			if err = vector.GetUnionAllFunction(typ, cb.mp)(
-				dst.Vecs[i],
+				destination,
 				vec); err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
 
-			dst.Vecs[i].SetSorted(vec.GetSorted())
+			destination.SetSorted(vec.GetSorted())
 		}
 		if vec.HasGrouping() {
 			groupingRows := vec.GetGrouping().GetBitmap().Len()
 			if groupingRows < 0 || groupingRows > int64(math.MaxInt) {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, mpool.ErrAllocationAccountInvalid
 			}
-			if err = dst.Vecs[i].PreExtendGrouping(
+			if err = destination.PreExtendGrouping(
 				int(groupingRows),
 				cb.mp,
 			); err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
-			dst.Vecs[i].SetGrouping(vec.GetGrouping())
+			destination.SetGrouping(vec.GetGrouping())
 		}
-		dst.Vecs[i].SetIsBin(vec.GetIsBin())
+		destination.SetIsBin(vec.GetIsBin())
 		if vec.IsConst() {
 			// GetUnionAllFunction already propagates row provenance for the
 			// non-constant path. Constants still need their scalar metadata
 			// copied after the const setter has materialized the value.
-			if err = vec.CopyPrepareParamMetadataToWithMP(dst.Vecs[i], cb.mp); err != nil {
+			if err = vec.CopyPrepareParamMetadataToWithMP(destination, cb.mp); err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
-			if err = dst.Vecs[i].SetRuntimeStringDomainWithMP(vec.GetRuntimeStringDomainAt(0), cb.mp); err != nil {
+			if err = destination.SetRuntimeStringDomainWithMP(vec.GetRuntimeStringDomainAt(0), cb.mp); err != nil {
 				cb.CacheBatch(true, cacheID, dst)
 				return nil, false, 0, err
 			}
 		}
 
-		// range src and found the same vector.
-		for j := i + 1; j < len(src.Vecs); j++ {
-			if dst.Vecs[j] == nil && src.Vecs[j] == vec {
-				dst.Vecs[j] = dst.Vecs[i]
+		if !planned {
+			// range src and found the same vector.
+			for j := i + 1; j < len(src.Vecs); j++ {
+				if dst.Vecs[j] == nil && src.Vecs[j] == vec {
+					dst.Vecs[j] = dst.Vecs[i]
+				}
 			}
 		}
 	}
@@ -208,6 +229,103 @@ func (cb *cachedBatch) GetCopiedBatch(
 	return dst, true, cacheID, nil
 }
 
+// prepareCopyBacking keeps whole-batch reservation off the copy loop's
+// common path. A final column cannot compete with a later request.
+func (mc *oneBatchMemoryCache) prepareCopyBacking(src, dst *batch.Batch, column int, planned, aliases bool) (bool, bool, error) {
+	if planned || len(mc.buffers) == 0 {
+		return planned, aliases, nil
+	}
+	source := src.Vecs[column]
+	dataSize := source.Length() * source.GetType().TypeSize()
+	areaSize := len(source.GetArea())
+	if column == len(src
```

**File**: `pkg/container/pSpool/copy_memory_test.go` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
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
+package pSpool
+
+import (
+	"bytes"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+)
+
+func copySpoolBatchAtPeak(t *testing.T, cache *cachedBatch, source *batch.Batch) (copied *batch.Batch, peak uint64) {
+	t.Helper()
+	epoch := cache.mp.StartResourcePeakEpoch()
+	require.NotNil(t, epoch)
+	defer func() {
+		var ok bool
+		peak, ok = cache.mp.EndResourcePeakEpoch(epoch)
+		require.True(t, ok)
+	}()
+	copied, use, id, err := cache.GetCopiedBatch(source)
+	if err == nil {
+		t.Cleanup(func() { cache.CacheBatch(use, id, copied) })
+	}
+	require.NoError(t, err)
+	return copied, 0
+}
+
+func TestCachedBatchGrowthReleasesEarlierBacking(t *testing.T) {
+	sourceMP := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { defer mpool.DeleteMPool(sourceMP); require.Zero(t, sourceMP.CurrNB()) })
+	makeSource := func(sizes ...int) *batch.Batch {
+		source := batch.NewWithSize(len(sizes))
+		t.Cleanup(func() { source.Clean(sourceMP) })
+		for i, size := range sizes {
+			source.Vecs[i] = vector.NewOffHeapVecWithType(types.T_text.ToType())
+			require.NoError(t, vector.AppendBytes(source.Vecs[i], bytes.Repeat([]byte{byte(i + 1)}, size), false, sourceMP))
+		}
+		source.SetRowCount(1)
+		return source
+	}
+	seed, source := makeSource(1024, 0), makeSource(2048, 4096)
+	mp := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { defer mpool.DeleteMPool(mp); require.Zero(t, mp.CurrNB()) })
+	cache := initCachedBatch(mp, 1)
+	t.Cleanup(cache.free)
+	copied, use, id, err := cache.GetCopiedBatch(seed)
+	require.NoError(t, err)
+	cache.CacheBatch(use, id, copied)
+	copied, peak := copySpoolBatchAtPeak(t, cache, source)
+	for i, vec := range source.Vecs {
+		require.Equal(t, vec.GetBytesAt(0), copied.Vecs[i].GetBytesAt(0))
+	}
+	// Giving the old 1KiB area to the first column releases it during its
+	// 2KiB growth. Holding it until the later 4KiB copy adds needless overlap.
+	require.LessOrEqual(t, peak, uint64(mp.CurrNB()), "earlier growth must release old backing before later allocations")
+}
+
+func TestCachedBatchCreatesBorrowedSnapshotInCopyOrder(t *testing.T) {
+	sourceMP := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { defer mpool.DeleteMPool(sourceMP); require.Zero(t, sourceMP.CurrNB()) })
+	const rows = 512
+	fill := func(vec *vector.Vector, size int) {
+		require.NoError(t, vec.PreExtendWithArea(rows, size, sourceMP))
+		value := bytes.Repeat([]byte("x"), size)
+		for row := range rows {
+			data := value
+			if row != 0 {
+				data = nil
+			}
+			require.NoError(t, vector.AppendBytes(vec, data, false, sourceMP))
+		}
+	}
+	original := vector.NewOffHeapVecWithType(types.T_text.ToType())
+	t.Cleanup(func() { original.Free(sourceMP) })
+	fill(original, 128)
+	private := vector.NewOffHeapVecWithType(types.T_text.ToType())
+	t.Cleanup(func() { private.Free(sourceMP) })
+	require.NoError(t, private.CopyWithReadonlyArea(original, sourceMP))
+	makeSource := func(size int) *batch.Batch {
+		source := batch.NewWithSize(3)
+		t.Cleanup(func() { source.Clean(sourceMP) })
+		source.Vecs[0] = vector.NewOffHeapVecWithType(types.T_text.ToType())
+		fill(source.Vecs[0], size)
+		var err error
+		source.Vecs[1], err = private.RetainedReadonlyViewWithMP(sourceMP)
+		require.NoError(t, err)
+		source.Vecs[2] = source.Vecs[1]
+		source.SetRowCount(rows)
+		return source
+	}
+	seed, source := makeSource(8192), makeSource(13568)
+	mp := mpool.MustNewZeroNoFixed()
+	t.Cleanup(func() { defer mpool.DeleteMPool(mp); require.Zero(t, mp.CurrNB()) })
+	cache := initCachedBatch(mp, 1)
+	t.Cleanup(cache.free)
+	copied, use, id, err := cache.GetCopiedBatch(seed)
+	require.NoError(t, err)
+	cache.CacheBatch(use, id, copied)
+	copied, peak := copySpoolBatchAtPeak(t, cache, source)
+	for i, vec := range source.Vecs {
+		for row := range rows {
+			require.Equal(t, vec.GetBytesAt(row), copied.Vecs[i].GetBytesAt(row))
+		}
+	}
+	require.Same(t, copied.Vecs[1], copied.Vecs[2])
+	// The ordinary column must finish growing and releasing its old area
+	// before the later borrowed column allocates its descriptor snapshot.
+	require.LessOrEqual(t, peak, uint64(mp.CurrNB()), "borrowed descriptors must not overlap an earlier c
```

**File**: `pkg/container/pSpool/copy_producer_benchmark_test.go` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
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
+package pSpool
+
+import (
+	"bytes"
+	"runtime"
+	"sync/atomic"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+)
+
+// Independent producers model separate spools. Each producer owns its source:
+// GetCopiedBatch transfers ExtraBuf and must not share a mutable source batch.
+func BenchmarkCachedBatchProducerShapes(b *testing.B) {
+	for _, tc := range []struct {
+		name                string
+		columns, rows, size int
+		ragged, fixed       bool
+	}{
+		{"fixed_8192", 1, 8192, 0, false, true},
+		{"tiny_exact_2", 2, 1, 64, false, false},
+		{"tiny_slack_2", 2, 1, 65, false, false},
+		{"ragged_2", 2, 1, 65, true, false},
+		{"dense_exact_17", 17, 1, 64, false, false},
+		{"dense_exact_20", 20, 1, 64, false, false},
+		{"dense_exact_128", 128, 1, 64, false, false},
+		{"ragged_20", 20, 1, 65, true, false},
+		{"ragged_128", 128, 1, 65, true, false},
+		{"bulk_varlen_2", 2, 256, 65, true, false},
+	} {
+		b.Run(tc.name, func(b *testing.B) {
+			type producer struct {
+				cache   *cachedBatch
+				sources [2]*batch.Batch
+			}
+			producers := make([]producer, runtime.GOMAXPROCS(0))
+			for worker := range producers {
+				sm := mpool.MustNewZeroNoFixed()
+				b.Cleanup(func() {
+					defer mpool.DeleteMPool(sm)
+					if sm.CurrNB() != 0 {
+						b.Error("source leak")
+					}
+				})
+				for version := range 2 {
+					source := batch.NewWithSize(tc.columns)
+					b.Cleanup(func() { source.Clean(sm) })
+					for column := range tc.columns {
+						if tc.fixed {
+							source.Vecs[column] = vector.NewOffHeapVecWithType(types.T_int64.ToType())
+							if e := vector.AppendFixedList(source.Vecs[column], make([]int64, tc.rows), nil, sm); e != nil {
+								b.Fatal(e)
+							}
+						} else {
+							source.Vecs[column] = vector.NewOffHeapVecWithType(types.T_text.ToType())
+							size := tc.size
+							if tc.ragged {
+								size += column*17 + version*(64+column*14)
+							}
+							value := bytes.Repeat([]byte{byte(column + 1)}, size)
+							for range tc.rows {
+								if e := vector.AppendBytes(source.Vecs[column], value, false, sm); e != nil {
+									b.Fatal(e)
+								}
+							}
+						}
+					}
+					source.SetRowCount(tc.rows)
+					producers[worker].sources[version] = source
+				}
+				mp := mpool.MustNewZeroNoFixed()
+				b.Cleanup(func() {
+					defer mpool.DeleteMPool(mp)
+					if mp.CurrNB() != 0 {
+						b.Error("target leak")
+					}
+				})
+				producers[worker].cache = initCachedBatch(mp, 1)
+				b.Cleanup(producers[worker].cache.free)
+				for warm := range 4 {
+					got, use, id, e := producers[worker].cache.GetCopiedBatch(producers[worker].sources[warm%2])
+					if e != nil {
+						b.Fatal(e)
+					}
+					producers[worker].cache.CacheBatch(use, id, got)
+				}
+			}
+			var next atomic.Int64
+			b.ReportAllocs()
+			b.ResetTimer()
+			b.RunParallel(func(pb *testing.PB) {
+				p := &producers[next.Add(1)-1]
+				iteration := 0
+				for pb.Next() {
+					got, use, id, e := p.cache.GetCopiedBatch(p.sources[iteration%2])
+					if e != nil {
+						b.Error(e)
+						return
+					}
+					p.cache.CacheBatch(use, id, got)
+					iteration++
+				}
+			})
+		})
+	}
+}
```

---

### Incident Patch 3: `8868e6c3` (2026-11-14)
**Commit Message**: fix(plan): allow INSERT IGNORE into writable external tables (#32750)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #32512

## What this PR does / why we need it:

Allow `INSERT IGNORE` into writable, non-Iceberg external tables to use the existing legacy external-insert path when the modern binder returns its exact external-table sentinel. This restores VALUES, SELECT and prepared forms without changing assignment, warning or external-file writer semantics. Read-only tables, Iceberg DML, ODKU, RETURNING and non-Iceberg OVERWRITE keep their existing rejection paths.

The planner regression covers six admitted forms, eight rejection controls and unchanged ordinary external INSERT. No FileService, authorization, error-mapping or native code changes are included.

Validation on the final source based on upstream `bc9b822cd1f5d742b550f8366516fd836936ba70`:

- Regression RED exit 1 before the admission fix and GREEN exit 0 after it. The CGO-enabled owning `pkg/sql/plan` run through `mo-cgo-test` recorded 24,593 named passes and two skips; skipp

**File**: `pkg/sql/plan/build.go` (modified, +14/-5)
```diff
@@ -242,14 +242,23 @@ func bindAndOptimizeInsertQuery(ctx CompilerContext, stmt *tree.Insert, isPrepar
 			}
 		}
 		// ON DUPLICATE KEY UPDATE is fully handled by the modern path; it must
-		// never fall back to the legacy ODKU operator. Two exceptions still fall
-		// back: ordinary plain INSERT (e.g. inserting into a system index table),
-		// and the degenerate ODKU on a table with no primary/unique key (no dedup key to
+		// never fall back to the legacy ODKU operator. Three cases still fall
+		// back: ordinary plain INSERT (e.g. inserting into a system index table);
+		// the degenerate ODKU on a table with no primary/unique key (no dedup key to
 		// represent the upsert; legacy treats it as a plain INSERT and preserves
-		// the prepared-statement parameters).
+		// the prepared-statement parameters); and INSERT IGNORE into a writable
+		// non-Iceberg external table (issue #32512). resolveSingleTable raises
+		// the external-table sentinel only for writable non-Iceberg targets
+		// (read-only targets fail with InvalidInput, Iceberg mappings with their
+		// own sentinel), and an ODKU list keeps external INSERT IGNORE on the
+		// modern rejection, so keying the sentinel admits exactly this one
+		// legacy-supported shape.
 		if !stmt.HasReturning() && moerr.IsMoErrCode(err, moerr.ErrUnsupportedDML) &&
 			((len(stmt.GetOnDuplicateUpdate()) == 0 && !stmt.IsIgnore()) ||
-				err.Error() == noPkOnDupUpdateMsg) {
+				err.Error() == noPkOnDupUpdateMsg ||
+				(stmt.IsIgnore() &&
+					len(stmt.GetOnDuplicateUpdate()) == 0 &&
+					err.Error() == externalTableUnsupportedDMLMsg)) {
 			return buildInsert(stmt, ctx, false, isPrepareStmt)
 		}
 		return nil, err
```

**File**: `pkg/sql/plan/external_insert_ignore_admission_test.go` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
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
+	"encoding/json"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	icebergmodel "github.com/matrixorigin/matrixone/pkg/iceberg/model"
+	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	sqliceberg "github.com/matrixorigin/matrixone/pkg/sql/iceberg"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+)
+
+// newExtIgnoreAdmissionMock registers one writable non-Iceberg external target
+// (WRITE_FILE_PATTERN present), one read-only external target (no pattern), and
+// one Iceberg mapping external target, each with columns id INT (nullable) and
+// a INT NOT NULL. The mock catalog's built-in NATION table is the SELECT source.
+func newExtIgnoreAdmissionMock(t *testing.T) *MockOptimizer {
+	t.Helper()
+	mock := NewMockOptimizer(true, newPlanTestProcess(t))
+
+	newTarget := func(name string, tblId uint64, externSQL string) *planpb.TableDef {
+		def := &planpb.TableDef{
+			TblId:         tblId,
+			Name:          name,
+			TableType:     catalog.SystemExternalRel,
+			Createsql:     externSQL,
+			Name2ColIndex: map[string]int32{"id": 0, "a": 1},
+			Cols: []*planpb.ColDef{
+				{Name: "id", Typ: planpb.Type{Id: int32(types.T_int32), Width: 32}, Default: &planpb.Default{NullAbility: true}},
+				{Name: "a", Typ: planpb.Type{Id: int32(types.T_int32), Width: 32}, Default: &planpb.Default{NullAbility: false}},
+			},
+		}
+		mock.ctxt.tables[name] = def
+		mock.ctxt.objects[name] = &planpb.ObjectRef{Obj: int64(tblId), ObjName: name, SchemaName: mock.ctxt.DefaultDatabase()}
+		return def
+	}
+
+	// Writable non-Iceberg external: the admission contract target.
+	param := &tree.ExternParam{ExParamConst: tree.ExParamConst{
+		Format: tree.CSV,
+		Option: []string{"filepath", "stage://ext_stage/p-*.csv", "format", "csv",
+			"write_file_pattern", "stage://ext_stage/p-%U.csv"},
+	}}
+	metadata, err := json.Marshal(param)
+	require.NoError(t, err)
+	newTarget("ext_w_ignore", 9001, string(metadata))
+
+	// Read-only external: modern InvalidInput rejection stays.
+	roParam := &tree.ExternParam{ExParamConst: tree.ExParamConst{
+		Format: tree.CSV,
+		Option: []string{"filepath", "stage://ext_stage/p-ro-*.csv", "format", "csv"},
+	}}
+	roMetadata, err := json.Marshal(roParam)
+	require.NoError(t, err)
+	newTarget("ext_ro_ignore", 9002, string(roMetadata))
+
+	// Iceberg mapping external: separate Iceberg DML rejection stays.
+	iceSQL := sqliceberg.BuildCreateSQLEnvelope(icebergmodel.TableMapping{
+		Namespace:  "ext_ignore",
+		TableName:  "ice",
+		DefaultRef: icebergmodel.DefaultRefMain,
+		ReadMode:   icebergmodel.ReadModeMergeOnRead,
+		WriteMode:  icebergmodel.WriteModeMergeOnRead,
+	}, "ksa_ext_ignore")
+	newTarget("ice_ext_ignore", 9003, iceSQL)
+
+	return mock
+}
+
+// requireExternalInsertPlan asserts the plan bound through the legacy writable
+// external insert path: an INSERT query whose sink node carries the external
+// table with an INSERT statement.
+func requireExternalInsertPlan(t *testing.T, p *Plan, targetTable string) {
+	t.Helper()
+	q := p.GetQuery()
+	require.NotNil(t, q)
+	require.Equal(t, planpb.Query_INSERT, q.GetStmtType())
+	var insertNode *planpb.Node
+	for _, node := range q.GetNodes() {
+		if node.GetNodeType() == planpb.Node_INSERT {
+			insertNode = node
+			break
+		}
+	}
+	require.NotNil(t, insertNode, "expected an INSERT sink node")
+	require.NotNil(t, insertNode.GetInsertCtx(), "external insert sink must carry an INSERT context")
+	require.True(t, insertNode.GetInsertCtx().GetAddAffectedRows())
+	require.Equal(t, catalog.SystemExternalRel, insertNode.GetTableDef().GetTableType())
+	require.Equal(t, targetTable, insertNode.GetTableDef().GetName())
+}
+
+// TestExternalInsertIgnoreAdmission covers issue #32512: INSERT IGNORE into a
+// writable non-Iceberg external table must bind through the existing legacy
+// external insert path (VALUES / SELECT / prepared forms), while every
+// rejection classification stays unchanged: read-only external (20301),
+// external ODKU / Iceberg (20313), RETURNING (not supported), and non-Iceberg
+// OVERWRITE (not supported).
+func TestExternalInsertIgnoreAdmission(t 
```

#### Recent Merged Pull Requests:
- **PR #32771** (2026-11-15): perf: avoid repeated TEXT assignment buffer growth (@XuPeng-SH)
- **PR #32769** (2026-11-15): perf: reduce CSV field copy amplification on 4.2-dev (@XuPeng-SH)
- **PR #32768** (2026-11-15): fix(load): preserve sealed CSV fields on 4.2-dev (@XuPeng-SH)
- **PR #32767** (2026-11-15): fix: preserve DECIMAL comparison domains on 4.2 (@XuPeng-SH)
- **PR #32766** (2026-11-15): perf: avoid temporary CSV field assembly buffers (@XuPeng-SH)
- **PR #32762** (2026-11-15): perf(ci): parse UT setup reports once (@XuPeng-SH)

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

## X. ci): correct SCA closure and native test lifecycle ownership

**RULE**:
When implementing operations in `.github/ci/static-analysis.cjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1893e5a`: ci): correct SCA closure and native test lifecycle ownership. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/ci/static-analysis.cjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,' +
  // Imports already resolves production, internal-test and external-test
  // variants. Keep those identities until traversal ends: a test importer does
  // not make its owner's unchanged production consumers affected.
    for (const imported of record.imports || []) {
      if (!variants.has(imported)) {
      if (!reverse.has(imported)) reverse.set(imported, new Set());
      reverse.get(imported).add(record.id);
  const production = new Set();
    if (!file.endsWith('_test.go')) production.add(owner);
  // A changed production source belongs to every active variant of its owner.
  const pending = [];
  for (const [id, owner] of variants) {
    if (production.has(owner)) pending.push(id);
  }
  const seen = new Set(pending);
  for (let i = 0; i < pending.length; i++) {
    for (const consumer of reverse.get(pending[i]) || []) {
      selected.add(variants.get(consumer));
        pending.push(consumer);
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,TestImports,XTestImports,' +
            testImports: p.TestImports || [], xTestImports: p.XTestImports || [],
    const owner = variants.get(record.id);
    for (const imported of [...(record.imports || []), ...(record.testImports || []),
      ...(record.xTestImports || [])]) {
      const dependency = variants.get(imported);
      if (!dependency) {
      if (!reverse.has(dependency)) reverse.set(dependency, new Set());
      reverse.get(dependency).add(owner);
  const production = [];
    if (!file.endsWith('_test.go')) production.push(owner);
  const seen = new Set(production);
  for (let i = 0; i < production.length; i++) {
    for (const consumer of reverse.get(production[i]) || []) {
      selected.add(consumer);
        production.push(consumer);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1893e5a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
