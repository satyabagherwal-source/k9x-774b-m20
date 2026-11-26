# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: matrixorigin-matrixone-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin-matrixone-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T03:55:53.790Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matrixorigin-matrixone-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin-matrixone-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T03:55:53.790Z`  
> **Learning ID**: `LEARN-EVO-matrixorigin-matrixone-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from matrixorigin-matrixone-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `e5d6f92f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T03:55:18.481Z  
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
> **Harvest Timestamp**: 2026-11-26T03:55:18.475Z  
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
- **Issue #33273** (2026-11-26): **[4.2-dev] test: wait for publication commits across CNs**
  *Symptoms*: ## What type of PR is this?  - [x] Test and CI  ## Which issue(s) this PR fixes:  Related to #32744.  ## What this PR does / why we need it:  The x86 coverage job for #32497 observed zero active grants where `TestDropAccountConcurrentPublicationGrant` expected one. The retry of `ALTER PUBLICATION` had returned successfully on CN1 before the test queried `mo_subs` on CN0. A new transaction on CN0 can still read at its local applied logtail timestamp.  Use the existing `syncCommit` control at the test's cross-CN handoffs. Wait after publication creation before opening the subscriber on the other CN. After the two concurrent DDLs return, wait before the rollback check and retry, then wait for the final commit before reading the catalog. The DROP and ALTER still contend for the original locks in the same order.  ## Validation  `TestDropAccountConcurrentPublicationGrant` passed 12 of 12 times with `-cover` on Linux x86_64. All 12 runs exercised the transaction retry. A separate `-race` run also passed and exercised the retry. Local runs used a TCP-only embedded fixture.  [Original x86 coverage failure](https://github.com/matrixorigin/matrixone/actions/runs/45730348434/job/139610710109).

- **Issue #33265** (2026-11-26): **refactor(batch): remove Attrs, one batch codec, small BatchSet core; drop mixed-version gates**
  *Symptoms*: ## What type of PR is this?  - [x] Refactoring  ## Which issue(s) this PR fixes:  Part of #33182 (batch cleanup, #32921). Builds on #33199 (remove `Attrs`), which is now merged into `main`.  ## What this PR does / why we need it:  ### 1. Remove `Attrs` from `Batch` (#33199, merged)  This section summarizes #33199 for context; that change is now in `main`. Column names belong to whoever defines the columns: the plan, a table definition, or a workspace entry. They now travel beside the batch where an API needs them. - `Batch.Attrs`, `New(attrs)`, `SetAttributes` and `GetSchema` are gone. `NewWithTypes` replaces `NewWithSchema`, and `Types()` replaces `GetSchema()`. - `SelectColumns`, `CloneSelectedColumns` and `InsertVector` take no names. `BatchToProtoBatch(bat, attrs)` takes them explicitly. - `Relation.Write(ctx, bat, attrs)` and `Relation.Delete(ctx, bat, attrs, name)` take the names. disttae workspace entries own theirs, and CN→TN `api.Batch` carries the same names as before. - On TN, `cmd_util.WriteReq` and the catalog request structs carry the `api.Batch` names. `AppendDataToTable` and `containers.ToTNBatch` take them as arguments. logtailreplay keeps the logtail names in `ReplayBatch`. - Behaviour changes:   - **Iceberg DML/append:** these now trust the plan's column positions.   - **Data-branch hashdiff:** only the current base relation's batches are projected to the target layout (`currentBaseChangesHandle`).   - **Legacy `checkDup` message:** it no longer reads names

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

### Incident Patch 1: `c7393cd3` (2026-11-25)
**Commit Message**: fix(bitmap): address review comments of #33144 (#33231)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #33030

## What this PR does / why we need it:

This PR follows up on #33144 (bitmaps own their words through an mpool).
That PR merged while review comments were still open: the
CHANGES_REQUESTED reviews from iamlinjunhong and the mo-bot review, plus
the Codex automated review. This PR addresses those comments. Each
finding was checked against the merged code on main, and every confirmed
one is fixed here.

### Review findings addressed

| Finding in #33144 | Fix |
|---|---|
| **Persisted dedup swallows probe errors** (`tae/tables/base.go`,
`txnimpl/table.go`). `BatchDedup` errors other than
`OkExpectedPossibleDup` (bloom filter load, candidate bitmap allocation)
were treated as "no key in this block". `GetByFilter` could then report
an existing key absent, and `DedupSnapByPK` could miss a duplicate. |
Propagate the error in `persistedGetDuplicatedRows`, `persistedContains`
and the workspace tombstone probe. |
| **Composed views read past

**File**: `pkg/common/bitmap/bitmap_ext.go` (modified, +0/-5)
```diff
@@ -91,11 +91,6 @@ func (n *Bitmap) Ptr() *uint64 {
 	return &n.data[0]
 }
 
-// WordsCovering returns the bitmap's words, padded with zero words when they
-// cover fewer than nbits bits. A bitmap ends at its highest set bit, so it
-// can be shorter than the vector it describes; C code that tests the bit of
-// every row must get words covering every row, or it reads past the bitmap.
-// It returns nil for a bitmap without words.
 // WordsCovering returns the bitmap's words, padded with zero words when they
 // cover fewer than nbits bits. A bitmap ends at its highest set bit, so it
 // can be shorter than the vector it describes; C code that tests the bit of
```

**File**: `pkg/common/bitmap/bitmap_mem_test.go` (modified, +34/-0)
```diff
@@ -249,3 +249,37 @@ func checkView(t *testing.T, mp *mpool.MPool, src *Bitmap, start, end int64) {
 	want.Free()
 	require.Equal(t, allocated, mp.CurrNB())
 }
+
+// A view of a read-only bitmap must not expose the source's words past its
+// end: they are shared with rows the source does not cover.
+func TestBitmapViewOfViewStopsAtSourceEnd(t *testing.T) {
+	mp := newTestPool(t)
+	var src Bitmap
+	require.NoError(t, src.InitWithSize(64, mp))
+	defer src.Free()
+	src.Add(0)
+	src.Add(1)
+
+	var outer, inner Bitmap
+	outer.InitView(&src, 0, 1)
+	require.Equal(t, 1, outer.Count())
+	require.False(t, outer.Contains(1))
+
+	inner.InitView(&outer, 0, 2)
+	require.Equal(t, 1, inner.Count())
+	require.True(t, inner.Contains(0))
+	require.False(t, inner.Contains(1), "row 1 is past the outer view's end")
+	require.Equal(t, []uint64{0}, inner.ToArray())
+
+	var decoded Bitmap
+	decoded.UnmarshalNoCopy(inner.Marshal())
+	require.NoError(t, decoded.Validate())
+	require.Equal(t, []uint64{0}, decoded.ToArray())
+
+	// An owned source keeps its words clear past Len: the view keeps the
+	// requested length.
+	var padded Bitmap
+	padded.InitView(&src, 0, 100)
+	require.EqualValues(t, 100, padded.Len())
+	require.Equal(t, []uint64{0, 1}, padded.ToArray())
+}
```

**File**: `pkg/common/bitmap/bitmap_view.go` (modified, +8/-0)
```diff
@@ -36,6 +36,11 @@ import (
 // src's words: row r of n is row start+r of src. Nothing is allocated or
 // copied. n's previous words are released first. The view is valid only
 // while src's words are unchanged and alive; it must never outlive src.
+//
+// Rows past src's end read clear. An owned src keeps its words clear past
+// Len, so the view keeps the full length end-start. A read-only src may not
+// (a view shares its last word with the rows after it), so the view stops at
+// src's end: Len is then shorter, and the rows after it still read clear.
 func (n *Bitmap) InitView(src *Bitmap, start, end int64) {
 	if start < 0 || end < start {
 		panic(moerr.NewInternalErrorNoCtxf("invalid bitmap view [%d, %d)", start, end))
@@ -46,6 +51,9 @@ func (n *Bitmap) InitView(src *Bitmap, start, end int64) {
 		n.numBits = end - start
 		return
 	}
+	if src.mp == nil && end > src.numBits {
+		end = src.numBits
+	}
 	bit := uint64(start) + src.shift
 	first := int(bit / 64)
 	if first < len(src.data) {
```

**File**: `pkg/container/batch/batch.go` (modified, +19/-11)
```diff
@@ -1335,32 +1335,40 @@ func (bat *Batch) releaseExtraBuf() {
 // OwnReadOnlyVectors replaces every read-only (reference) vector of bat with
 // a copy in mp, so the batch can be mutated in place. A vector shared by
 // several columns is copied once.
+//
+// It copies every vector before replacing any: a vector can sit in several
+// columns, and on a failed copy bat is left unchanged, its originals intact,
+// while the copies already made are freed.
 func (bat *Batch) OwnReadOnlyVectors(mp *mpool.MPool) error {
 	var copied map[*vector.Vector]*vector.Vector
-	// The replaced originals are no longer referenced by bat, also when a
-	// later Dup fails. A read-only vector can still own its nulls bitmap.
-	defer func() {
-		for vec := range copied {
-			vec.Free(nil)
-		}
-	}()
-	for i, vec := range bat.Vecs {
+	for _, vec := range bat.Vecs {
 		if vec == nil || !vec.IsReadOnly() {
 			continue
 		}
-		if owned, ok := copied[vec]; ok {
-			bat.Vecs[i] = owned
+		if _, ok := copied[vec]; ok {
 			continue
 		}
 		owned, err := vec.Dup(mp)
 		if err != nil {
+			for _, c := range copied {
+				c.Free(mp)
+			}
 			return err
 		}
 		if copied == nil {
 			copied = make(map[*vector.Vector]*vector.Vector)
 		}
 		copied[vec] = owned
-		bat.Vecs[i] = owned
+	}
+	for i, vec := range bat.Vecs {
+		if owned, ok := copied[vec]; ok {
+			bat.Vecs[i] = owned
+		}
+	}
+	// No column references the originals now. A read-only vector can still
+	// own its nulls bitmap.
+	for vec := range copied {
+		vec.Free(nil)
 	}
 	return nil
 }
```

**File**: `pkg/container/batch/batch_test.go` (modified, +12/-8)
```diff
@@ -1887,7 +1887,7 @@ func TestBatchShrinkByMaskRowCount(t *testing.T) {
 
 // When a later Dup fails, OwnReadOnlyVectors still frees the read-only
 // originals it already replaced; one of them owns its nulls bitmap.
-func TestOwnReadOnlyVectorsFreesReplacedOnDupError(t *testing.T) {
+func TestOwnReadOnlyVectorsLeavesBatchOnDupError(t *testing.T) {
 	srcMP := mpool.MustNewZero()
 	nspMP := mpool.MustNewZero()
 	dstMP, err := mpool.NewMPool("own_read_only_cap", 1<<20, mpool.NoFixed)
@@ -1910,15 +1910,19 @@ func TestOwnReadOnlyVectorsFreesReplacedOnDupError(t *testing.T) {
 	w2, err := big.Window(0, big.Length())
 	require.NoError(t, err)
 
-	bat := New([]string{"a", "b"})
-	bat.Vecs[0], bat.Vecs[1] = w1, w2
+	// w1 sits in two columns, around the column whose copy fails.
+	bat := New([]string{"a", "b", "c"})
+	bat.Vecs[0], bat.Vecs[1], bat.Vecs[2] = w1, w2, w1
 	require.Error(t, bat.OwnReadOnlyVectors(dstMP))
 
-	require.Zero(t, nspMP.CurrNB(), "the replaced original's nulls are freed")
-	require.False(t, bat.Vecs[0].IsReadOnly(), "the first column was copied")
-	require.Same(t, w2, bat.Vecs[1], "the failed column is left in place")
-	bat.Vecs[0].Free(dstMP)
-	require.Zero(t, dstMP.CurrNB())
+	require.Same(t, w1, bat.Vecs[0], "a failed call leaves the batch unchanged")
+	require.Same(t, w2, bat.Vecs[1])
+	require.Same(t, w1, bat.Vecs[2])
+	require.Equal(t, 8, w1.Length(), "the aliased original stays intact")
+	require.True(t, w1.GetNulls().Contains(0))
+	require.Zero(t, dstMP.CurrNB(), "the copies already made are freed")
+	w1.Free(nil)
+	require.Zero(t, nspMP.CurrNB())
 	small.Free(srcMP)
 	big.Free(srcMP)
 	require.Zero(t, srcMP.CurrNB())
```

**File**: `pkg/container/nulls/nulls.go` (modified, +4/-4)
```diff
@@ -196,7 +196,8 @@ func (nsp *Nulls) GetBitmap() (res *bitmap.Bitmap) {
 
 // Or performs union operation on Nulls nsp,m and store the result in r.
 // r keeps its own rows, except that when nsp and m are both empty, r is
-// reset to length 0. r may alias nsp or m.
+// cleared. Its length and storage are kept, so a result that reserved its
+// validity can still set NULL rows in place afterwards. r may alias nsp or m.
 // @ requires r != nil && r.np.Inv()
 // @ requires nsp != nil && nsp != r ==> acc(nsp.np.Inv(), 1/2)
 // @ requires m != nil && m != r ==> acc(m.np.Inv(), 1/2)
@@ -205,14 +206,13 @@ func (nsp *Nulls) GetBitmap() (res *bitmap.Bitmap) {
 // @ ensures m != nil && m != r ==> acc(m.np.Inv(), 1/2)
 // @ ensures nsp != r ==> forall x int :: {nsp.Has(x)} nsp.Has(x) == old(nsp.Has(x))
 // @ ensures m != r ==> forall x int :: {m.Has(x)} m.Has(x) == old(m.Has(x))
-// @ ensures old(nsp.IsEmpty()) && old(m.IsEmpty()) ==> r.NLen() == 0 && forall x int :: {r.Has(x)} !r.Has(x)
+// @ ensures old(nsp.IsEmpty()) && old(m.IsEmpty()) ==> r.NLen() == old(r.NLen()) && forall x int :: {r.Has(x)} !r.Has(x)
 // @ ensures !(old(nsp.IsEmpty()) && old(m.IsEmpty())) ==>
 // @ 	forall x int :: {r.Has(x)} r.Has(x) == (old(r.Has(x)) || old(nsp.Has(x)) || old(m.Has(x)))
 // @ decreases
 func Or(nsp, m, r *Nulls) {
 	if nsp.IsEmpty() && m.IsEmpty() {
-		// @ r.np.Release()
-		r.Reset()
+		r.Clear()
 		return
 	}
 
```

**File**: `pkg/container/nulls/nulls_test.go` (modified, +24/-0)
```diff
@@ -608,3 +608,27 @@ func TestFilterVariantsMatchReference(t *testing.T) {
 		requireSameNulls(t, want, got, fmt.Sprintf("Filter unordered iter=%d", iter))
 	}
 }
+
+// Or of two empty inputs clears the result in place: a result that reserved
+// its validity keeps that storage, so later in-place Adds do not allocate.
+func TestOrOfEmptyKeepsReservedStorage(t *testing.T) {
+	mp := mpool.MustNewZero()
+	var r Nulls
+	r.Init(mp)
+	require.NoError(t, r.GetBitmap().Reserve(130))
+	r.Add(3)
+	reserved := mp.CurrNB()
+	require.Positive(t, reserved)
+
+	Or(nil, &Nulls{}, &r)
+	require.True(t, r.IsEmpty())
+	require.False(t, r.Contains(3))
+	require.Equal(t, reserved, mp.CurrNB(), "the reservation is kept")
+
+	r.Add(0)
+	r.Add(129)
+	require.Equal(t, reserved, mp.CurrNB(), "Adds within the reservation do not allocate")
+	require.Equal(t, []uint64{0, 129}, r.ToArray())
+	r.Free()
+	require.Zero(t, mp.CurrNB())
+}
```

**File**: `pkg/container/vector/vector.go` (modified, +18/-2)
```diff
@@ -194,7 +194,12 @@ func (v *Vector) Capacity() int {
 // Allocated returns the total allocated memory size of the vector.
 // it can be used to estimate the memory usage of the vector.
 func (v *Vector) Allocated() int {
+	// An owned null bitmap holds pool memory too, and CleanOnlyData keeps it
+	// for reuse; a read-only one references words it does not own.
 	retained := 0
+	if !v.nsp.IsReadOnly() {
+		retained = v.nsp.GetBitmap().CapWords() * 8
+	}
 	return retained + cap(v.data) + cap(v.area)
 }
 
@@ -8346,11 +8351,21 @@ func Union2VectorValen(
 	return nil
 }
 
-func (v *Vector) FillRawPtrLen(dest []uintptr) {
+// FillRawPtrLen writes v's raw (pointer, length) pairs for native code. A
+// read-only null bitmap (a window view) may be shifted, which C cannot read,
+// so it is handed over as a clean copy. The returned slice holds that copy:
+// the caller must keep it alive until the native call returns.
+func (v *Vector) FillRawPtrLen(dest []uintptr) (keepAlive []uint64) {
 	// The null map's first word and its length in bits; (0, 0) when it has
 	// no storage.
 	dest[0], dest[1] = 0, 0
-	if ptr := nulls.Ptr(&v.nsp); ptr != nil {
+	if v.nsp.IsReadOnly() {
+		bm := v.nsp.GetBitmap()
+		if keepAlive = bm.WordsCovering(int(bm.Len())); len(keepAlive) > 0 {
+			dest[0] = uintptr(unsafe.Pointer(&keepAlive[0]))
+			dest[1] = uintptr(bm.Len())
+		}
+	} else if ptr := nulls.Ptr(&v.nsp); ptr != nil {
 		dest[0] = uintptr(unsafe.Pointer(ptr))
 		dest[1] = uintptr(v.nsp.GetBitmap().Len())
 	}
@@ -8363,6 +8378,7 @@ func (v *Vector) FillRawPtrLen(dest []uintptr) {
 		dest[4] = uintptr(unsafe.Pointer(&v.area[0]))
 		dest[5] = uintptr(len(v.area))
 	}
+	return keepAlive
 }
 
 // hasBackingStorage reports whether v holds any data, area or bitmap storage.
```

---

### Incident Patch 2: `5196dc4e` (2026-11-25)
**Commit Message**: fix: propagate bitmap allocation errors in result conversion and dedup (#33240)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Test and CI

## Which issue(s) this PR fixes:

Related to #33030. Follow-up to #33144 and #33231.

## What this PR does / why we need it:

After bitmap allocations moved into mpool, converting frontend results
with NULLs could exhaust the pool while copying the temporary bitmap.
That copy panicked and bypassed cleanup of the partial batch. Set NULLs
on the destination vector and return allocation errors through the
existing batch cleanup. Extend the bitmap only through the word
containing the NULL row so rows in the same word can be marked without
another growth call. The physical word requirement is unchanged from
growing to the row itself. Columns without NULLs allocate no bitmap, and
an early isolated NULL does not reserve bitmap storage for the whole
column.

Workspace tombstone lookup returned probe errors from its lower layer,
but the caller ignored them and could classify a deleted primary key as
a live duplicate. Return the original error before dedup continues.
Propagate allocation failures while marking or publishing a deleted
can

**File**: `pkg/frontend/util.go` (modified, +98/-53)
```diff
@@ -37,6 +37,7 @@ import (
 	"go.uber.org/zap"
 
 	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/bitmap"
 	"github.com/matrixorigin/matrixone/pkg/common/collation"
 	"github.com/matrixorigin/matrixone/pkg/common/log"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
@@ -46,7 +47,6 @@ import (
 	commonutil "github.com/matrixorigin/matrixone/pkg/common/util"
 	mo_config "github.com/matrixorigin/matrixone/pkg/config"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
-	"github.com/matrixorigin/matrixone/pkg/container/nulls"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/defines"
@@ -1388,17 +1388,10 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 	//2. make batch
 	cnt := len(rows)
 	bat.SetRowCount(cnt)
-	// nsp collects one column's NULL rows before they are copied into the
-	// vector; the last one is freed on return, the others as they are
-	// replaced.
-	var nsp *nulls.Nulls
-	defer func() { nsp.Free() }()
 	for colIndex, typ := range colTyps {
-		bat.Vecs[colIndex] = vector.NewVec(typ, pool)
-		nsp.Free()
-		if nsp, err = nulls.NewWithSize(cnt, pool); err != nil {
-			return nil, nil, err
-		}
+		vec := vector.NewVec(typ, pool)
+		bat.Vecs[colIndex] = vec
+		mask := vec.GetNulls().GetBitmap()
 
 		// typeswitch:partial colTyps come from mysqlColDef2PlanResultColDef, which maps MySQL FLOAT/DOUBLE only to T_float32/T_float64
 		switch typ.Oid {
@@ -1409,11 +1402,13 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val []byte
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = textRowValueBytes(row[colIndex])
 				}
-				err := vector.AppendBytes(bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendBytes(vec, val, false, pool)
 				if err != nil {
 					return nil, nil, err
 				}
@@ -1423,11 +1418,13 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val int8
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = row[colIndex].(int8)
 				}
-				err := vector.AppendFixed[int8](bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendFixed[int8](vec, val, false, pool)
 				if err != nil {
 					return nil, nil, err
 				}
@@ -1436,12 +1433,14 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val int16
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = row[colIndex].(int16)
 				}
 
-				err := vector.AppendFixed[int16](bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendFixed[int16](vec, val, false, pool)
 				if err != nil {
 					return nil, nil, err
 				}
@@ -1450,12 +1449,14 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val types.MoYear
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = row[colIndex].(types.MoYear)
 				}
 
-				err := vector.AppendFixed[types.MoYear](bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendFixed[types.MoYear](vec, val, false, pool)
 				if err != nil {
 					return nil, nil, err
 				}
@@ -1464,12 +1465,14 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val int32
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = row[colIndex].(int32)
 				}
 
-				err := vector.AppendFixed[int32](bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendFixed[int32](vec, val, false, pool)
 				if err != nil {
 					return nil, nil, err
 				}
@@ -1478,12 +1481,14 @@ func convertRowsIntoBatchInLocation(pool *mpool.MPool, cols []Column, rows [][]a
 			for rowIdx, row := range rows {
 				var val int64
 				if row[colIndex] == nil {
-					nsp.Add(uint64(rowIdx))
+					if err = markResultNull(mask, rowIdx, cnt); err != nil {
+						return nil, nil, err
+					}
 				} else {
 					val = row[colIndex].(int64)
 				}
 
-				err := vector.AppendFixed[int64](bat.Vecs[colIndex], val, false, pool)
+				err := vector.AppendFixed[int64](vec, val, false, pool)
 				if err != nil {
 					return nil, nil, 
```

**File**: `pkg/frontend/util_test.go` (modified, +139/-0)
```diff
@@ -3902,3 +3902,142 @@ func Test_convertRowsIntoBatchFreesPartialBatchOnError(t *testing.T) {
 	require.Nil(t, pColDefs)
 	require.Zero(t, pool.CurrNB())
 }
+
+func TestConvertRowsIntoBatchNullAtPoolCapacity(t *testing.T) {
+	col := new(MysqlColumn)
+	col.SetName("v")
+	col.SetColumnType(defines.MYSQL_TYPE_TINY)
+	col.SetSigned(true)
+
+	for _, tc := range []struct {
+		name      string
+		value     any
+		remaining int
+		wantError bool
+	}{
+		{name: "null fits without a copy", remaining: 16},
+		{name: "non-null needs only data", value: int8(7), remaining: 8},
+		{name: "null cannot fit", remaining: 8, wantError: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			const capacity = 1 << 20
+			pool, err := mpool.NewMPool(t.Name(), capacity, mpool.NoFixed)
+			require.NoError(t, err)
+			defer mpool.DeleteMPool(pool)
+			filler, err := pool.Alloc(capacity-tc.remaining, true)
+			require.NoError(t, err)
+			defer pool.Free(filler)
+			before := pool.CurrNB()
+
+			data, defs, err := convertRowsIntoBatch(pool, []Column{col}, [][]any{{tc.value}})
+			if tc.wantError {
+				require.True(t, moerr.IsMoErrCode(err, moerr.ErrMPoolCapacity), "%v", err)
+				require.Nil(t, data)
+				require.Nil(t, defs)
+			} else {
+				require.NoError(t, err)
+				require.NotNil(t, defs)
+				require.Equal(t, 1, data.RowCount())
+				require.Equal(t, tc.value == nil, data.Vecs[0].GetNulls().Contains(0))
+				if tc.value != nil {
+					require.Equal(t, tc.value, vector.GetFixedAtNoTypeCheck[int8](data.Vecs[0], 0))
+				}
+				data.Clean(pool)
+			}
+			require.Equal(t, before, pool.CurrNB())
+		})
+	}
+}
+
+func TestConvertRowsIntoBatchDistinguishesNullAndEmptyBytes(t *testing.T) {
+	col := new(MysqlColumn)
+	col.SetName("v")
+	col.SetColumnType(defines.MYSQL_TYPE_VARCHAR)
+	col.SetLength(64)
+	pool := mpool.MustNewZeroNoFixed()
+	defer mpool.DeleteMPool(pool)
+
+	data, _, err := convertRowsIntoBatch(pool, []Column{col}, [][]any{{""}, {nil}, {"last"}})
+	require.NoError(t, err)
+	defer data.Clean(pool)
+	vec := data.Vecs[0]
+	require.False(t, vec.GetNulls().Contains(0))
+	require.Empty(t, vec.GetBytesAt(0))
+	require.True(t, vec.GetNulls().Contains(1))
+	require.False(t, vec.GetNulls().Contains(2))
+	require.Equal(t, []byte("last"), vec.GetBytesAt(2))
+}
+
+func TestConvertRowsIntoBatchNullWordGrowth(t *testing.T) {
+	col := new(MysqlColumn)
+	col.SetName("v")
+	col.SetColumnType(defines.MYSQL_TYPE_TINY)
+	col.SetSigned(true)
+	cols := []Column{col}
+	rows := make([][]any, 257)
+	for i := range rows {
+		rows[i] = []any{int8(7)}
+	}
+
+	// Measure the data-only peak, so the constrained pool has room for
+	// the data and exactly one bitmap word during the largest data growth.
+	dataPeak := func() int64 {
+		pool := mpool.MustNewZeroNoFixed()
+		defer mpool.DeleteMPool(pool)
+		data, _, err := convertRowsIntoBatch(pool, cols, rows)
+		require.NoError(t, err)
+		defer data.Clean(pool)
+		return pool.Stats().HighWaterMark.Load()
+	}()
+	rows[0][0] = nil
+	t.Run("early null only needs one word", func(t *testing.T) {
+		const capacity = 1 << 20
+		const bitmapWordBytes = 8
+		pool, err := mpool.NewMPool(t.Name(), capacity, mpool.NoFixed)
+		require.NoError(t, err)
+		defer mpool.DeleteMPool(pool)
+		filler, err := pool.Alloc(capacity-int(dataPeak)-bitmapWordBytes, true)
+		require.NoError(t, err)
+		defer pool.Free(filler)
+		before := pool.CurrNB()
+
+		data, _, err := convertRowsIntoBatch(pool, cols, rows)
+		require.NoError(t, err)
+		func() {
+			defer data.Clean(pool)
+			mask := data.Vecs[0].GetNulls().GetBitmap()
+			require.Equal(t, 1, mask.CapWords())
+			require.True(t, mask.Contains(0))
+			require.False(t, mask.Contains(uint64(len(rows)-1)))
+		}()
+		// A late NULL needs more words. The allocation error must clean
+		// the partially filled vector.
+		rows[len(rows)-1][0] = nil
+		defer func() { rows[len(rows)-1][0] = int8(7) }()
+		data, defs, err := convertRowsIntoBatch(pool, cols, rows)
+		require.True(t, moerr.IsMoErrCode(err, moerr.ErrMPoolCapacity), "%v", err)
+		require.Nil(t, data)
+		require.Nil(t, defs)
+		require.Equal(t, before, pool.CurrNB())
+	})
+
+	t.Run("nulls cross word boundaries", func(t *testing.T) {
+		for _, i := range []int{63, 64, 129, len(rows) - 1} {
+			rows[i][0] = nil
+		}
+		pool := mpool.MustNewZeroNoFixed()
+		defer mpool.DeleteMPool(pool)
+		data, _, err := convertRowsIntoBatch(pool, cols, rows)
+		require.NoError(t, err)
+		defer data.Clean(pool)
+		require.Equal(t, len(rows), data.RowCount())
+		vec := data.Vecs[0]
+		getNulls := vec.GetNulls()
+		for i, row := range rows {
+			require.Equal(t, row[0] == nil, getNulls.Contains(uint64(i)), "row %d", i)
+			if row[0] != nil {
+				require.Equal(t, int8(7), vector.GetFixedAtNoTypeCheck[int8](vec, i))
+			}
+		}
+	})
+}
```

**File**: `pkg/vm/engine/tae/txn/txnimpl/table.go` (modified, +21/-7)
```diff
@@ -28,7 +28,6 @@ import (
 	"github.com/RoaringBitmap/roaring/v2"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/moprobe"
-	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/nulls"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -1551,6 +1550,15 @@ func (tbl *txnTable) DedupSnapByPK(
 	return
 }
 
+func markDeletedRow(rows containers.Vector, row int) error {
+	mask := rows.NullMask()
+	if err := nulls.TryExpand(mask, row+1); err != nil {
+		return err
+	}
+	mask.Add(uint64(row))
+	return nil
+}
+
 func (tbl *txnTable) findDeletesForCandidates(
 	ctx context.Context,
 	candidates *duplicatedRowIDs,
@@ -1622,7 +1630,9 @@ func (tbl *txnTable) findDeletes(
 	if err = index.BatchUpdateZM(keysZM, rowIDs.GetDownstreamVector()); err != nil {
 		return
 	}
-	tbl.contains(ctx, rowIDs, keysZM, rowIDs.GetAllocator())
+	if err = tbl.contains(ctx, rowIDs, keysZM); err != nil {
+		return
+	}
 
 	// Dedup uses a PrepareTS-based upper fence. A delete that is still
 	// committing conflicts with the writer regardless of whether it prepared
@@ -2251,7 +2261,6 @@ func (tbl *txnTable) contains(
 	ctx context.Context,
 	keys containers.Vector,
 	keysZM index.ZM,
-	mp *mpool.MPool,
 ) (err error) {
 	if tbl.tombstoneTable == nil || tbl.tombstoneTable.tableSpace == nil {
 		return
@@ -2297,7 +2306,9 @@ func (tbl *txnTable) contains(
 			} else if !slices.Contains(workspaceRowids, keyRowids[j]) {
 				continue
 			}
-			containers.UpdateValue(keys.GetDownstreamVector(), uint32(j), nil, true, mp)
+			if err := markDeletedRow(keys, j); err != nil {
+				return err
+			}
 		}
 	}
 	for _, stats := range tbl.tombstoneTable.tableSpace.stats {
@@ -2337,7 +2348,7 @@ func (tbl *txnTable) contains(
 			metaloc := objectio.BuildLocation(stats.ObjectName(), stats.Extent(), blkRow, i)
 
 			vectors, closeFunc, err := ioutil.LoadColumns2(
-				tbl.store.ctx,
+				ctx,
 				[]uint16{uint16(tbl.tombstoneTable.schema.GetSingleSortKeyIdx())},
 				nil,
 				tbl.store.rt.Fs,
@@ -2351,7 +2362,7 @@ func (tbl *txnTable) contains(
 				return err
 			}
 			data := vector.MustFixedColWithTypeCheck[types.Rowid](vectors[0].GetDownstreamVector())
-			containers.ForeachVector(keys,
+			err = containers.ForeachVector(keys,
 				func(id types.Rowid, isNull bool, row int) error {
 					if keys.IsNull(row) {
 						return nil
@@ -2362,12 +2373,15 @@ func (tbl *txnTable) contains(
 						types.CompareRowidRowidAligned,
 						nil,
 					); existed {
-						keys.Update(row, nil, true)
+						return markDeletedRow(keys, row)
 					}
 					return nil
 				}, sel)
 			closeFunc()
 			sel.Free()
+			if err != nil {
+				return err
+			}
 		}
 	}
 	return nil
```

**File**: `pkg/vm/engine/tae/txn/txnimpl/txn_test.go` (modified, +17/-0)
```diff
@@ -184,9 +184,17 @@ func TestFindDeletesForCandidatesRetainsPartialFilteringOnWW(t *testing.T) {
 		},
 	}
 
+	const capacity = 1 << 20
+	candidatePool, err := mpool.NewMPool(t.Name(), capacity, mpool.NoFixed)
+	require.NoError(t, err)
+	defer mpool.DeleteMPool(candidatePool)
 	candidates, err := newDuplicatedRowIDs(pool, 1)
 	require.NoError(t, err)
 	defer candidates.Close()
+	// The combined vector can record the delete. Publishing it to the
+	// original candidate requires a separate allocation.
+	candidates.appendable.Close()
+	candidates.appendable = containers.MakeVector(objectio.RowidType, candidatePool)
 	appendableObjectID := objectio.NewObjectid()
 	appendableID := types.NewRowIDWithObjectIDBlkNumAndRowID(appendableObjectID, 0, 0)
 	nonAppendableObjectID := objectio.NewObjectid()
@@ -228,6 +236,15 @@ func TestFindDeletesForCandidatesRetainsPartialFilteringOnWW(t *testing.T) {
 	entry.AddEntryLocked(first)
 	entry.AddEntryLocked(second)
 
+	t.Run("copyback allocation error takes precedence over conflict", func(t *testing.T) {
+		filler, err := candidatePool.Alloc(capacity-int(candidatePool.CurrNB()), true)
+		require.NoError(t, err)
+		defer candidatePool.Free(filler)
+		err = tbl.findDeletesForCandidates(t.Context(), candidates, types.TS{}, types.MaxTs(), dedupMetricLookup)
+		require.True(t, moerr.IsMoErrCode(err, moerr.ErrMPoolCapacity), "%v", err)
+		require.False(t, candidates.appendable.IsNull(0))
+	})
+
 	err = tbl.findDeletesForCandidates(context.Background(), candidates, types.TS{}, types.MaxTs(), dedupMetricLookup)
 	require.True(t, moerr.IsMoErrCode(err, moerr.ErrTxnWWConflict), err)
 	require.True(t, candidates.appendable.IsNull(candidates.appendableByKey[0][0]))
```

**File**: `pkg/vm/engine/tae/txn/txnimpl/workspace_delete_filter_test.go` (modified, +80/-4)
```diff
@@ -19,11 +19,17 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/fileservice"
 	"github.com/matrixorigin/matrixone/pkg/objectio"
+	"github.com/matrixorigin/matrixone/pkg/objectio/ioutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/catalog"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/common"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/containers"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/db/dbutils"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/tae/index"
 	"github.com/stretchr/testify/require"
 )
@@ -55,7 +61,7 @@ func TestWorkspaceDeleteFilter(t *testing.T) {
 		for i := range keys.Length() {
 			keys.Update(i, nil, true)
 		}
-		require.NoError(t, table.contains(t.Context(), keys, index.ZM{}, common.WorkspaceAllocator))
+		require.NoError(t, table.contains(t.Context(), keys, index.ZM{}))
 		require.Equal(t, keys.Length(), keys.NullCount())
 	})
 	for _, probes := range []int{0, 1, 2, 32, 33, 34, 65} {
@@ -68,7 +74,7 @@ func TestWorkspaceDeleteFilter(t *testing.T) {
 					keys.Update(3, nil, true)
 				}
 				for range 2 { // A repeated filtering pass must be idempotent.
-					require.NoError(t, table.contains(t.Context(), keys, index.ZM{}, common.WorkspaceAllocator))
+					require.NoError(t, table.contains(t.Context(), keys, index.ZM{}))
 					for i, rowid := range original {
 						wantNull := i == 3
 						for _, removed := range deleted {
@@ -84,14 +90,84 @@ func TestWorkspaceDeleteFilter(t *testing.T) {
 				if probes > 1 {
 					// No index may survive a call: a later workspace append is visible.
 					workspace.Append(original[1], false)
-					require.NoError(t, table.contains(t.Context(), keys, index.ZM{}, common.WorkspaceAllocator))
+					require.NoError(t, table.contains(t.Context(), keys, index.ZM{}))
 					require.True(t, keys.IsNull(1))
 				}
 			})
 		}
 	}
 }
 
+func TestFindDeletesPropagatesWorkspaceTombstoneErrors(t *testing.T) {
+	ctx := t.Context()
+	fs, err := fileservice.NewMemoryFS("workspace-tombstones", fileservice.CacheConfig{}, nil)
+	require.NoError(t, err)
+	defer fs.Close(ctx)
+	const capacity = 1 << 20
+	pool, err := mpool.NewMPool(t.Name(), capacity, mpool.NoFixed)
+	require.NoError(t, err)
+	defer mpool.DeleteMPool(pool)
+	keys := containers.MakeVector(objectio.RowidType, pool)
+	defer keys.Close()
+	objectID := objectio.NewObjectid()
+	rowID := types.NewRowIDWithObjectIDBlkNumAndRowID(objectID, 0, 0)
+	keys.Append(rowID, false)
+
+	pkType := types.T_int32.ToType()
+	tombstones := catalog.NewCNTombstoneBatchByPKType(pkType, common.WorkspaceAllocator)
+	defer tombstones.Close()
+	tombstones.GetVectorByName(objectio.TombstoneAttr_Rowid_Attr).Append(rowID, false)
+	tombstones.GetVectorByName(objectio.TombstoneAttr_PK_Attr).Append(int32(1), false)
+	sink := ioutil.NewTombstoneSinker(objectio.HiddenColumnSelection_None, pkType,
+		common.WorkspaceAllocator, fs, ioutil.WithMemorySizeThreshold(1))
+	defer func() { require.NoError(t, sink.Close()) }()
+	require.NoError(t, sink.Write(ctx, containers.ToCNBatch(tombstones)))
+	require.NoError(t, sink.Sync(ctx))
+	stats, tail := sink.GetResult()
+	require.Len(t, stats, 1)
+	require.Empty(t, tail)
+
+	schema := catalog.MockSchemaAll(3, 2)
+	table := &txnTable{
+		entry: catalog.MockStaloneTableEntry(1, schema),
+		store: &txnStore{ctx: ctx, rt: dbutils.NewRuntime(dbutils.WithRuntimeObjectFS(fs))},
+		tombstoneTable: &baseTable{
+			schema: catalog.GetTombstoneSchema(schema), tableSpace: &tableSpace{stats: stats},
+		},
+	}
+	from, to := types.TS{}, types.MaxTs()
+	cancelled, cancel := context.WithCancel(ctx)
+	cancel()
+	require.ErrorIs(t, table.findDeletes(cancelled, keys, from, to, dedupMetricLookup), context.Canceled)
+	require.False(t, keys.IsNull(0))
+
+	// Keep the extent and zone map but point to an object that was never written.
+	missing := stats[0]
+	missingID := objectio.NewObjectid()
+	require.NoError(t, objectio.SetObjectStatsObjectName(&missing, objectio.BuildObjectNameWithObjectID(&missingID)))
+	table.tombstoneTable.tableSpace.stats = []objectio.ObjectStats{missing}
+	err = table.findDeletes(ctx, keys, from, to, dedupMetricLookup)
+	var fileErr *moerr.Error
+	require.ErrorAs(t, err, &fileErr)
+	require.Equal(t, moerr.ErrFileNotFound, fileErr.ErrorCode())
+	require.False(t, keys.IsNull(0))
+
+	table.tombstoneTable.tableSpace.stats = stats
+	used := pool.CurrNB()
+	func() {
+		filler, allocErr := pool.Alloc(capacity-int(used), true)
+		require.NoError(t, allocErr)
+		defer pool.Free(filler)
+		err := table.findDeletes(ctx, keys, from, to, dedupMetricLookup)
+		require.True(t, moerr.IsMoErrCode(err, moerr.ErrMPoolCapacity), "%v", err)
+		require.False(t, keys.IsNull(0))
+		require.EqualValues(t, capacity, pool.CurrNB())
+	}(
```

---

### Incident Patch 3: `afe647f6` (2026-11-25)
**Commit Message**: fix(function): inspect advisory lock holders without probes (#33200)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #33166 and #33178.

## What this PR does / why we need it:

`IS_FREE_LOCK` and `RELEASE_LOCK` without a tracked hold used to acquire
a temporary exclusive lock to inspect a name. Reusing a probe
transaction ID let a delayed unlock from an earlier probe release a
later one after a lost response. Giving each probe a different ID
isolated cleanup but let concurrent probes report each other as actual
holders.

Both functions now use the existing read-only LockService holder lookup.
It reports any actual holder, including those with an undecodable
connection ID. This removes the temporary lock acquisition, cleanup
reservation, and unlock retry from the lookup path. Lookup errors
propagate to SQL, and the 10-second lookup timeout honors earlier caller
deadlines.

## Validation

- Full `pkg/sql/plan/function` race suite, including real and absent
holders, cancellation, and lookup under cleanup saturation.
- Focused `pkg/lockserv

**File**: `pkg/sql/plan/function/func_unary.go` (modified, +14/-120)
```diff
@@ -43,7 +43,6 @@ import (
 	"strconv"
 	"strings"
 	"sync"
-	"sync/atomic"
 	"time"
 	"unicode/utf8"
 	"unsafe"
@@ -11799,6 +11798,7 @@ func Sleep[T uint64 | float64](ivecs []*vector.Vector, result vector.FunctionRes
 
 const userLevelLockTableID uint64 = 1 << 62
 
+const userLevelLockLookupTimeout = 10 * time.Second
 const userLevelLockCloseTimeout = 5 * time.Second
 const userLevelLockDetachedCleanupAttemptTimeout = time.Second
 const userLevelLockDetachedCleanupInitialBackoff = 10 * time.Millisecond
@@ -12076,22 +12076,6 @@ func userLevelLockTxnIDOld(owner, name string) []byte {
 	return []byte("mo-user-level-lock\x00" + owner + "\x00" + name)
 }
 
-func userLevelLockProbeTxnID(owner string, connID uint64, name, probeType string) []byte {
-	sequence := userLevelLockProbeTxnIDSequence.Add(1)
-	prefix := userLevelLockProbeTxnIDPrefix(owner, connID, name, probeType)
-	var attempt [16]byte
-	if _, err := rand.Read(attempt[:]); err == nil {
-		return append(prefix, []byte(fmt.Sprintf("\x00%d\x00%s", sequence, hex.EncodeToString(attempt[:])))...)
-	}
-	return append(prefix, []byte(fmt.Sprintf("\x00%d\x00%d", sequence, time.Now().UnixNano()))...)
-}
-
-func userLevelLockProbeTxnIDPrefix(owner string, connID uint64, name, probeType string) []byte {
-	return []byte(fmt.Sprintf("mo-user-level-lock-probe\x00%s\x00%s\x00%s\x00%d", probeType, owner, name, connID))
-}
-
-var userLevelLockProbeTxnIDSequence atomic.Uint64
-
 func userLevelLockConnectionIDFromTxnID(txnID []byte) (uint64, bool) {
 	return userLevelLockConnectionIDFromTxnIDWithFallback(txnID, 0, false)
 }
@@ -13080,29 +13064,6 @@ func queueDetachedUserLevelLockCleanupLocked() {
 	}
 }
 
-func unlockUserLevelLockProbe(ctx context.Context, ls lockservice.LockService, owner string, connID uint64, name, probeType string, txnID []byte) error {
-	attemptCtx, cancel := userLevelLockCleanupAttemptContext(ctx)
-	err := unlockUserLevelLockTxnID(attemptCtx, ls, txnID)
-	cancel()
-	if err == nil {
-		return nil
-	}
-	key := userLevelLockFailedAttemptCleanupKey(ls, owner, connID, name, "probe:"+probeType, txnID)
-	if handoffDetachedUserLevelLockTxnCleanup(
-		ctx,
-		ls,
-		key,
-		[][]byte{txnID},
-	) {
-		releaseRetainedUserLevelLockTxnCleanupSlot(key)
-		return err
-	}
-	if !retainDetachedUserLevelLockTxnCleanup(ls, key, [][]byte{txnID}) {
-		return moerr.NewInternalErrorNoCtxf("user-level lock probe cleanup queue is full for %s", name)
-	}
-	return err
-}
-
 func userLevelLockOptions(policy lockpb.WaitPolicy) lockpb.LockOptions {
 	return lockpb.LockOptions{
 		Granularity: lockpb.Granularity_Row,
@@ -13123,12 +13084,6 @@ func userLevelLockContext(proc *process.Process, timeoutSeconds uint32) (context
 	return ctx, cancel, lockpb.WaitPolicy_Wait
 }
 
-func userLevelLockConflictOrTimeout(err error) bool {
-	return moerr.IsMoErrCode(err, moerr.ErrLockConflict) ||
-		errors.Is(err, lockservice.ErrLockConflict) ||
-		errors.Is(err, context.DeadlineExceeded)
-}
-
 func userLevelLockTimedOut(err error) bool {
 	return errors.Is(err, context.DeadlineExceeded)
 }
@@ -13415,46 +13370,8 @@ func releaseUserLevelLockValidated(name string, proc *process.Process) (int64, b
 	connID := userLevelLockConnectionID(proc)
 	count := userLevelLockRefCount(owner, name)
 	if count == 0 {
-		probeTxnID := userLevelLockProbeTxnID(owner, connID, name, "release")
-		probeCleanupKey := userLevelLockFailedAttemptCleanupKey(ls, owner, connID, name, "probe:release", probeTxnID)
-		if !reserveRetainedUserLevelLockTxnCleanupSlot(ls, probeCleanupKey) {
-			return 0, false, moerr.NewInternalErrorNoCtxf("user-level lock cleanup capacity is full for %s", name)
-		}
-		if err := registerUserLevelLockTxn(ls, probeTxnID); err != nil {
-			releaseRetainedUserLevelLockTxnCleanupSlot(probeCleanupKey)
-			return 0, false, err
-		}
-		// Probe the lockservice to distinguish "lock does not exist" (NULL)
-		// from "lock exists but held by another session" (0).
-		_, probeErr := ls.Lock(
-			proc.Ctx,
-			userLevelLockTableID,
-			[][]byte{userLevelLockRow(proc, name)},
-			probeTxnID,
-			userLevelLockOptions(lockpb.WaitPolicy_FastFail))
-		if probeErr != nil {
-			cleanupErr := cleanupFailedUserLevelLockTxn(
-				proc.Ctx,
-				ls,
-				probeCleanupKey,
-				probeTxnID,
-			)
-			if cleanupErr != nil {
-				return 0, false, cleanupErr
-			}
-			if userLevelLockConflictOrTimeout(probeErr) {
-				// Lock exists but is held by another session.
-				return 0, false, nil
-			}
-			return 0, false, probeErr
-		}
-		// Lock did not exist — we acquired it via the probe. Release it and
-		// return NULL to signal the lock was already free.
-		if err := unlockUserLevelLockProbe(proc.Ctx, ls, owner, connID, name, "release", probeTxnID); err != nil {
-			return 0, false, err
-		}
-		releaseRetainedUserLevelLockTxnCleanupSlot(probeCleanupKey)
-		return 0, true, nil
+		held, err := lookupUserLevelLockHeld(proc, ls, name)
+		return 0, err == nil && !held, err
 	}
 	if count > 1 {
 		untrackUserLevelLock(owner, name)
@@ -13
```

**File**: `pkg/sql/plan/function/func_unary_test.go` (modified, +50/-194)
```diff
@@ -9262,21 +9262,6 @@ func detachedUserLevelLockCleanupCountForKind(kind string) int {
 	return count
 }
 
-func userLevelLockCleanupOwned(key detachedUserLevelLockCleanupKey) bool {
-	detachedUserLevelLockCleanups.Lock()
-	_, detached := detachedUserLevelLockCleanups.entries[key]
-	detachedUserLevelLockCleanups.Unlock()
-	userLevelLocks.Lock()
-	_, pending := userLevelLocks.pendingCleanups[key]
-	userLevelLocks.Unlock()
-	return detached || pending
-}
-
-func requireUserLevelLockCleanupOwned(t *testing.T, key detachedUserLevelLockCleanupKey) {
-	t.Helper()
-	require.True(t, userLevelLockCleanupOwned(key), "cleanup key was not retained: %+v", key)
-}
-
 func detachedUserLevelLockCleanupMaxTxnIDCountForKind(kind string) int {
 	detachedUserLevelLockCleanups.Lock()
 	defer detachedUserLevelLockCleanups.Unlock()
@@ -9505,6 +9490,9 @@ func (s *userLevelLockTestService) GetWaitingList(ctx context.Context, txnID []b
 }
 
 func (s *userLevelLockTestService) GetLockHolder(ctx context.Context, tableID uint64, row []byte, options lockpb.LockOptions) (lockpb.WaitTxn, bool, error) {
+	if err := ctx.Err(); err != nil {
+		return lockpb.WaitTxn{}, false, err
+	}
 	s.state.Lock()
 	defer s.state.Unlock()
 	holder := s.state.locks[string(row)]
@@ -9586,14 +9574,6 @@ func TestUserLevelLockCleanupTestServiceUnblocksInFlightUnlock(t *testing.T) {
 	}
 }
 
-func requireUserLevelLockProbeTxnUnlocked(t *testing.T, service *userLevelLockTestService, owner string, connID uint64, name, probeType string) {
-	t.Helper()
-	prefix := userLevelLockProbeTxnIDPrefix(owner, connID, name, probeType)
-	requireUserLevelLockTxnUnlockedFunc(t, service, func(unlocked []byte) bool {
-		return bytes.HasPrefix(unlocked, prefix)
-	}, "owner=%q connID=%d name=%q probeType=%q", owner, connID, name, probeType)
-}
-
 func requireUserLevelLockTxnUnlockedFunc(t *testing.T, service *userLevelLockTestService, match func([]byte) bool, msg string, args ...any) {
 	t.Helper()
 	service.unlockMu.Lock()
@@ -9618,18 +9598,6 @@ func requireUserLevelLockTxnUnlockedForLock(t *testing.T, service *userLevelLock
 	}, "owner=%q connID=%d name=%q", owner, connID, name)
 }
 
-func TestUserLevelLockConnectionIDFromProbeTxnID(t *testing.T) {
-	txnID := userLevelLockProbeTxnID("owner-1", 1001, "probe_lock", "is_free")
-	anotherTxnID := userLevelLockProbeTxnID("owner-1", 1001, "probe_lock", "is_free")
-	connID, ok := userLevelLockConnectionIDFromTxnID(txnID)
-	require.False(t, ok)
-	require.Equal(t, uint64(0), connID)
-	require.NotEqual(t, txnID, anotherTxnID,
-		"every probe attempt needs its own ID so delayed cleanup cannot affect a later attempt")
-	require.True(t, bytes.HasPrefix(txnID,
-		userLevelLockProbeTxnIDPrefix("owner-1", 1001, "probe_lock", "is_free")))
-}
-
 func getUserLevelLock(name string, timeout float64, proc *process.Process) (int64, error) {
 	name, err := validateUserLevelLockName(name)
 	if err != nil {
@@ -9933,8 +9901,8 @@ func TestUserLevelLockLivenessTracksFailedAndSuccessfulCleanup(t *testing.T) {
 		holderTxnID := held[0].TxnIDs[0]
 		requireUserLevelLockTxnRegistered(t, state, holderTxnID, true)
 
-		// Failed GET_LOCK and probe attempts must clean their temporary
-		// registrations without disturbing the live holder registration.
+		// Failed GET_LOCK cleans its temporary registration. Holder lookups
+		// leave the live holder registered.
 		value, err = getUserLevelLock("liveness_cleanup", 0, contender)
 		require.NoError(t, err)
 		require.Equal(t, int64(0), value)
@@ -9963,8 +9931,7 @@ func TestUserLevelLockLivenessTracksFailedAndSuccessfulCleanup(t *testing.T) {
 		require.Equal(t, int64(1), value)
 		requireUserLevelLockTxnRegistered(t, state, holderTxnID, false)
 
-		// Successful RELEASE_LOCK and IS_FREE_LOCK probes also unregister their
-		// short-lived transaction IDs.
+		// Looking up a free name does not register a transaction.
 		_, isNull, err = releaseUserLevelLock("liveness_free", holder)
 		require.NoError(t, err)
 		require.True(t, isNull)
@@ -10897,12 +10864,10 @@ func TestFailedFastFailUserLevelLockAttemptsAreUnlocked(t *testing.T) {
 		require.NoError(t, err)
 		require.False(t, isNull)
 		require.Equal(t, int64(0), v)
-		requireUserLevelLockProbeTxnUnlocked(t, service, owner, connID, lockName, "release")
 
 		v, err = isUserLevelLockFree(lockName, contender)
 		require.NoError(t, err)
 		require.Equal(t, int64(0), v)
-		requireUserLevelLockProbeTxnUnlocked(t, service, owner, connID, lockName, "is_free")
 	})
 }
 
@@ -10920,15 +10885,6 @@ func TestFailedUserLevelLockAttemptsCleanupUnexpectedErrors(t *testing.T) {
 		owner, connID := holder.GetUserLevelLockIdentity()
 		requireUserLevelLockTxnUnlockedForLock(t, service, owner, connID, lockName)
 		require.Empty(t, UserLevelLocksForMigration(holder))
-
-		_, isNull, err := releaseUserLevelLock("release_"+lockName, holder)
-		require.ErrorIs(t, err, lockErr)
-		require.False(t, isNull)
-		requireUserLevelLockProbeTxnUnlocked(t, service, owner, connID, "release_"+lockName, "r
```

#### Recent Merged Pull Requests:
- **PR #33273** (2026-11-26): [4.2-dev] test: wait for publication commits across CNs (@XuPeng-SH)
- **PR #33265** (2026-11-26): refactor(batch): remove Attrs, one batch codec, small BatchSet core; drop mixed-version gates (@fengttt)
- **PR #33264** (closed): fix(json): report uint64 JSON numbers as UNSIGNED INTEGER in JSON_TYPE (@MatrixAdventurer)
- **PR #33262** (2026-11-25): [4.2-dev] fix: reject unavailable service runtime (@XuPeng-SH)
- **PR #33261** (2026-11-25): fix(sql): handle inequality for GEOMETRY and GEOMETRY32 (@aptend)
- **PR #33260** (2026-11-25): [4.2-dev] fix: support ENUM and YEAR in serial_extract (@XuPeng-SH)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
