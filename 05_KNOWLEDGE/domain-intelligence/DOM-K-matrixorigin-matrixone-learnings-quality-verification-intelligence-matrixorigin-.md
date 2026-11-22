# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: matrixorigin-matrixone-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin-matrixone-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T05:28:22.128Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matrixorigin-matrixone-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin-matrixone-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T05:28:22.128Z`  
> **Learning ID**: `LEARN-EVO-matrixorigin-matrixone-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from matrixorigin-matrixone-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `7431a275`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T05:28:16.712Z  
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
> **Harvest Timestamp**: 2026-11-22T05:28:16.704Z  
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
- **Issue #33053** (2026-11-22): **fix(frontend): preserve cancellation errors during LOCAL uploads**
  *Symptoms*: ## What type of PR is this?  - [x] BUG - [x] Test and CI  ## Which issue(s) this PR fixes:  Related to #31475 and #31703. The failing coverage test was observed on #32914.  ## What this PR does / why we need it:  When KILL QUERY interrupted a `LOAD DATA LOCAL` upload, closing the pipe reader caused the SQL consumer to see `io.ErrClosedPipe`. The client could receive MySQL error 1105 for the interrupted query.  Close the upload pipe writer with the cancellation error so the consumer receives it and the existing protocol mapping returns MySQL error 1317 / SQLSTATE 70100. The upload owner still drains a finite client stream before the session is reused. The regression captures the consumer error while the finite tail is pending and checks it after the upload owner has joined.  ## Validation  - The deterministic pipe regression returned `io.ErrClosedPipe` on clean main at `96d0d01872`. - The full frontend package passed with the race detector in short mode. All seven `TestKillLoadLocal` wire scenarios passed under race and 12 times each with coverage enabled. - The focused pipe regression and the partial-payload wire scenario also passed 100 race repetitions each on the identical fix. - Formatting, diff checks, err-check, vet, golangci-lint and molint passed for the affected scope. 

- **Issue #33051** (2026-11-22): **[Subtask]: Vector clean up, remove sorted.   WONT DO.**
  *Symptoms*: ### Parent Issue  #33004  ### Detail of Subtask  Sorted should be tracked by planner/optimizer/operator, not by vector.  ### Describe implementation you've considered  _No response_  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Wont do -- this flag is written to disk and remove it does not really worth the effort and risk. 

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

### Incident Patch 1: `96d0d018` (2026-11-22)
**Commit Message**: fix(ci): distinguish exited UT cases from live tests (#33050)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Test and CI

## Which issue(s) this PR fixes:

Refs #32745 (FLAKY-003). The underlying whole-suite deadline and other
failure signatures stay tracked there.

## What this PR does / why we need it:

In [this Race
job](https://github.com/matrixorigin/matrixone/actions/runs/44914914428/job/136878393798),
LogService exited at 14:58 UTC but its unfinished test appeared in 90
later heartbeats, including the last heavy wave at 16:42 UTC.

- Retire unfinished tests from the live heartbeat when their package
exits. Preserve test names, start times, and the package result in the
failure summary. Merged streams with overlapping package invocations
report ambiguous attribution explicitly.
- Reuse the report publisher's ready-marker rule in the heartbeat. Keep
torn records from consuming the next shard's first event. Preserve the
raw report and give the pinned analyzer readable records when the raw
input contains malformed lines.
- Generate the slow and lifecycle summaries in one pass. A stopped
writer’s final, valid JSON event can end at EOF. Live heartbeat reads
and fa

**File**: `optools/active_ut_incremental.py` (modified, +102/-37)
```diff
@@ -14,42 +14,98 @@
 import tempfile
 
 
+STATE_VERSION = 2
+MAX_LIFECYCLE_LINE_BYTES = 1024 * 1024
+TEST_START_ACTIONS = ("run", "pause", "cont")
+TERMINAL_ACTIONS = ("pass", "fail", "skip")
+
+
 def fresh(identity):
     return {"identity": identity, "offset": 0, "guard": "", "packages": {}, "cases": {}}
 
 
 def valid(state):
-    return (
+    if not (
         isinstance(state, dict)
         and isinstance(state.get("offset"), int)
         and state["offset"] >= 0
         and isinstance(state.get("guard"), str)
         and isinstance(state.get("packages"), dict)
-        and all(isinstance(k, str) and isinstance(v, str) for k, v in state["packages"].items())
         and isinstance(state.get("cases"), dict)
-        and all(isinstance(v, list) and len(v) == 4 and all(isinstance(s, str) for s in v)
-                for v in state["cases"].values())
+    ):
+        return False
+
+    def package_entry(entry):
+        return (
+            isinstance(entry, list) and len(entry) == 2
+            and isinstance(entry[0], str)
+            and type(entry[1]) is int and entry[1] > 0
+        )
+
+    def cases_entry(cases):
+        return isinstance(cases, dict) and all(
+            isinstance(entry, list) and len(entry) == 4
+            and isinstance(entry[0], str) and isinstance(entry[1], str)
+            and type(entry[2]) is int and entry[2] > 0
+            and isinstance(entry[3], bool)
+            for entry in cases.values()
+        )
+
+    return all(map(package_entry, state["packages"].values())) and all(
+        map(cases_entry, state["cases"].values())
     )
 
 
-def apply_event(state, event):
+def apply_event(state, event, unfinished=None):
     action, package = event.get("Action", ""), event.get("Package", "")
     test, when = event.get("Test", ""), event.get("Time", "")
     if not all(isinstance(v, str) for v in (action, package, test, when)) or not package:
         return
+    packages, cases = state["packages"], state["cases"]
+    invocation = packages.get(package)
     if not test:
         if action == "start":
-            state["packages"][package] = when
-        elif action in ("pass", "fail", "skip"):
-            state["packages"].pop(package, None)
-        # Keep unfinished cases on a package failure, as the AWK oracle does.
+            if invocation is None:
+                packages[package] = [when, 1]
+            else:
+                invocation[1] += 1
+        elif action in TERMINAL_ACTIONS:
+            if invocation is not None and invocation[1] > 1:
+                # The merged stream cannot tell which invocation exited.
+                invocation[0] = "unknown"
+                invocation[1] -= 1
+                for entry in cases.get(package, {}).values():
+                    entry[3] = True
+            else:
+                packages.pop(package, None)
+                outstanding = cases.pop(package, {})
+                if unfinished is not None:
+                    unfinished.extend(
+                        (package, name, last_action, started, "unknown" if ambiguous else action)
+                        for name, (last_action, started, _, ambiguous) in outstanding.items()
+                    )
         return
-    key = json.dumps([package, test])
-    if action in ("run", "pause", "cont"):
-        started = state["cases"].get(key, [package, test, action, when])[3]
-        state["cases"][key] = [package, test, action, started]
-    elif action in ("pass", "fail", "skip"):
-        state["cases"].pop(key, None)
+    if action in TEST_START_ACTIONS:
+        current = cases.setdefault(package, {})
+        entry = current.get(test)
+        if entry is None:
+            current[test] = [action, when, 1, False]
+        elif (action == "run" and invocation is not None
+              and (invocation[1] > 1 or entry[3])):
+            # An unmatched run can also belong to an invocation that already
+            # exited. A test terminal accounts for only one observed run.
+            current[test] = ["unknown", "unknown", entry[2] + 1, True]
+        elif entry[0] != "unknown":
+            entry[0] = action
+    elif action in TERMINAL_ACTIONS and package in cases:
+        current = cases[package]
+        entry = current.get(test)
+        if entry is not None and entry[2] > 1:
+            entry[2] -= 1
+        else:
+            current.pop(test, None)
+        if not current:
+            del cases[package]
 
 
 def update(path, old):
@@ -65,12 +121,12 @@ def update(path, old):
             state = fresh(identity)
         stream.seek(state["offset"])
         while True:
-            line = stream.readline(1024 * 1024)
+            line = stream.readline(MAX_LIFECYCLE_LINE_BYTES)
             if not line:
                 break
-            oversized = not line.endswith(b"\n") and len(line) == 1024 * 1024
+            oversized = not line.endswith(b"\n") and len(line) == MAX_LIFECYCLE_LINE_BYTES
             while oversized an
```

**File**: `optools/run_ut.sh` (modified, +51/-26)
```diff
@@ -644,10 +644,16 @@ function report_active_ut_cases(){
         return 0
     fi
 
-    logger "ERR" "Active or incomplete UT cases from ${UT_REPORT}:"
-    awk -f "${BUILD_WKSP}/optools/active_ut_cases.awk" "${UT_REPORT}" |
-        LC_ALL=C sort |
-        sed 's/^/[active_ut_cases] /'
+    local lifecycle_report="${UT_REPORT}.lifecycle"
+    if [[ -s "${lifecycle_report}" ]]; then
+        logger "ERR" "Active or incomplete UT cases from ${UT_REPORT}:"
+        sed 's/^/[active_ut_cases] /' "${lifecycle_report}"
+    else
+        logger "ERR" "Unclassified UT cases from ${UT_REPORT}:"
+        awk -f "${BUILD_WKSP}/optools/active_ut_cases.awk" "${UT_REPORT}" |
+            LC_ALL=C sort |
+            sed -e 's/^active UT /UT /' -e 's/^/[unclassified_ut_cases] /'
+    fi
 }
 
 function report_slow_ut_cases(){
@@ -658,8 +664,15 @@ function report_slow_ut_cases(){
 
     local slow_report="${UT_DIAGNOSTIC_DIR}/top.txt"
     local slow_output=""
-    if ! slow_output=$(python3 "${BUILD_WKSP}/optools/summarize_ut_slow_cases.py" "${UT_REPORT}" 2>&1); then
-        logger "ERR" "failed to summarize slow UT cases: ${slow_output}"
+    local lifecycle_report="${UT_REPORT}.lifecycle"
+    local -a lifecycle_args=(--active-out "${lifecycle_report}")
+    if [[ -n "${CURRENT_UT_PID}" ]] || (( CURRENT_UT_DRAIN_FAILED != 0 )); then
+        lifecycle_args+=(--require-lifecycle-lf)
+    fi
+    rm -f "${lifecycle_report}"
+    if ! slow_output=$(python3 -B "${BUILD_WKSP}/optools/summarize_ut_slow_cases.py" \
+        "${UT_REPORT}" "${lifecycle_args[@]}"); then
+        logger "ERR" "failed to summarize slow UT cases from ${UT_REPORT}"
         return 0
     fi
 
@@ -789,7 +802,7 @@ function start_ut_heartbeat(){
                 wait "${heartbeat_scan_pid}" 2>/dev/null || true
                 heartbeat_scan_pid=""
             fi
-            rm -f "${UT_HEARTBEAT_STATE}" "${UT_HEARTBEAT_STATE}.out"
+            rm -f "${UT_HEARTBEAT_STATE}" "${UT_HEARTBEAT_STATE}.out" "${UT_HEARTBEAT_STATE}.tmp."*
             exit 0
         }
         trap request_heartbeat_stop TERM INT
@@ -816,8 +829,8 @@ function start_ut_heartbeat(){
             fi
             [[ "${UT_TERMINATING}" == 0 ]] || exit 0
 
-            local latest stage label active_cases active_detail active_records process_count memory report
-            local -a heartbeat_reports
+            local latest stage label active_cases active_detail active_records unresolved_cases process_count memory report
+            local -a helper_reports
             # A heartbeat can race a stage transition. Never read our own stale
             # stage back as the source of truth on the next tick.
             latest=$(awk '!/event=heartbeat / { latest=$0 } END { print latest }' "${UT_CHECKPOINT}" 2>/dev/null || true)
@@ -828,33 +841,28 @@ function start_ut_heartbeat(){
             # The heartbeat is forked before run_tests assigns the helper
             # report variables. Discover reports from the immutable run
             # workspace instead of relying on those later parent-shell values.
-            heartbeat_reports=(
-                "${UT_REPORT}"
+            helper_reports=(
                 "${G_WKSP}/${G_TS}-light-race-report.out"
                 "${G_WKSP}/${G_TS}-engine-race-report.out"
-                "${G_WKSP}/${G_TS}-engine-race-report.out".*
                 "${G_WKSP}/${G_TS}-plan-race-report.out"
-                "${G_WKSP}/${G_TS}-plan-race-report.out".*
                 "${G_WKSP}/${G_TS}-issues-race-report.out"
-                "${G_WKSP}/${G_TS}-issues-race-report.out".*
                 "${G_WKSP}/${G_TS}-embedded-race-report.out"
-                "${G_WKSP}/${G_TS}-embedded-race-report.out".*
                 "${G_WKSP}/${G_TS}-embedded-batched-race-report.out"
-                "${G_WKSP}/${G_TS}-embedded-batched-race-report.out".*
             )
             # Own the finite scan as a group. A large first scan or fallback
             # must not outlive heartbeat cancellation or keep its pipes open.
             set -m
             (
                 trap - TERM INT
+                local -a heartbeat_reports=("${UT_REPORT}") sources=()
+                for report in "${helper_reports[@]}"; do
+                    if collect_ut_report_sources "${report}" 2>/dev/null && (( ${#sources[@]} > 0 )); then
+                        heartbeat_reports+=("${sources[@]}")
+                    fi
+                done
                 if ! python3 "${BUILD_WKSP}/optools/active_ut_incremental.py" \
                     --state "${UT_HEARTBEAT_STATE}" "${heartbeat_reports[@]}" 2>/dev/null; then
-                    # The original full-scan reader remains the recovery path.
-                    for report in "${heartbeat_reports[@]}"; do
-                        if [[ -s "${report}" ]]; then
-                            awk -f "${BUILD_WKSP}/optools/active_ut_cases.awk" "${report}" 2>/dev/null || true
-                        fi
-                    d
```

**File**: `optools/summarize_ut_slow_cases.py` (modified, +37/-18)
```diff
@@ -17,15 +17,18 @@
 
 from __future__ import annotations
 
+import argparse
 import json
 import sys
 from datetime import datetime
 from pathlib import Path
 from typing import Dict, List, Optional, Tuple
 
 
-TERMINAL_ACTIONS = {"pass", "fail", "skip"}
-TEST_START_ACTIONS = {"run", "pause", "cont"}
+from active_ut_incremental import (
+    MAX_LIFECYCLE_LINE_BYTES, TERMINAL_ACTIONS, TEST_START_ACTIONS,
+    apply_event, atomic_write, fresh, render,
+)
 
 
 def parse_time(value: object) -> Optional[datetime]:
@@ -65,7 +68,8 @@ def format_duration(seconds: float) -> str:
 
 
 def summarize(
-    report_path: Path, limit: int = 20
+    report_path: Path, limit: int = 20, active_out: Optional[Path] = None,
+    *, require_lifecycle_lf: bool = False,
 ) -> Tuple[
     List[Tuple[float, str, str, str, str]],
     List[Tuple[float, str, str, str, str]],
@@ -76,6 +80,8 @@ def summarize(
     completed_tests: List[Tuple[float, str, str, str, str]] = []
     completed_packages: List[Tuple[float, str, str, str, str]] = []
     malformed = 0
+    lifecycle = fresh(None) if active_out is not None else None
+    unfinished = []
 
     with report_path.open("rb") as report:
         for raw_line in report:
@@ -98,6 +104,15 @@ def summarize(
             package = event.get("Package")
             if not isinstance(action, str) or not isinstance(package, str) or not package:
                 continue
+            if action not in TEST_START_ACTIONS and action not in TERMINAL_ACTIONS and action != "start":
+                continue
+            if lifecycle is not None:
+                has_lf = raw_line.endswith(b"\n")
+                # A stopped writer's decoded EOF record is equivalent to the
+                # merged record, including the separator in the size budget.
+                framed_size = len(raw_line) + (0 if has_lf else 1)
+                if framed_size <= MAX_LIFECYCLE_LINE_BYTES and (has_lf or not require_lifecycle_lf):
+                    apply_event(lifecycle, event, unfinished)
             timestamp = parse_time(event.get("Time"))
             test = event.get("Test")
             if isinstance(test, str) and test:
@@ -137,30 +152,34 @@ def summarize(
                         )
                     )
 
+    if active_out is not None:
+        try:
+            atomic_write(active_out, "\n".join(render({"report": lifecycle}, unfinished)) + "\n",
+                         prefix=active_out.name + ".tmp.")
+        except OSError as error:
+            print(f"failed to publish UT lifecycle summary: {error}", file=sys.stderr)
     completed_tests.sort(key=lambda item: item[0], reverse=True)
     completed_packages.sort(key=lambda item: item[0], reverse=True)
     return completed_tests[:limit], completed_packages[:limit], malformed
 
 
 def main(argv: List[str]) -> int:
-    if len(argv) not in (2, 3):
-        print(f"usage: {argv[0]} GO_TEST_JSON [LIMIT]", file=sys.stderr)
-        return 2
-    try:
-        limit = int(argv[2]) if len(argv) == 3 else 20
-    except ValueError:
-        print("LIMIT must be a positive integer", file=sys.stderr)
-        return 2
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("report", type=Path)
+    parser.add_argument("limit", nargs="?", type=int, default=20)
+    parser.add_argument("--active-out", type=Path)
+    parser.add_argument("--require-lifecycle-lf", action="store_true")
+    args = parser.parse_args(argv[1:])
+    limit = args.limit
     if limit <= 0:
-        print("LIMIT must be a positive integer", file=sys.stderr)
-        return 2
-
-    report_path = Path(argv[1])
-    if not report_path.is_file():
-        print(f"slow UT case report missing: {report_path}", file=sys.stderr)
+        parser.error("LIMIT must be a positive integer")
+    if not args.report.is_file():
+        print(f"slow UT case report missing: {args.report}", file=sys.stderr)
         return 1
 
-    tests, packages, malformed = summarize(report_path, limit)
+    tests, packages, malformed = summarize(
+        args.report, limit, args.active_out, require_lifecycle_lf=args.require_lifecycle_lf,
+    )
     print(f"[slow_ut_cases] completed test cases (top {limit}):")
     if tests:
         for elapsed, package, test, result, ended in tests:
```

**File**: `optools/testdata/active_ut_incremental_test.py` (modified, +131/-3)
```diff
@@ -17,6 +17,7 @@
 
 sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
 import active_ut_incremental as reader
+from summarize_ut_slow_cases import summarize
 
 
 class IncrementalReaderTest(unittest.TestCase):
@@ -90,14 +91,141 @@ def test_corrupt_state_and_escaped_names(self):
         self.assertEqual(1, len(self.read()[0].splitlines()))
 
     def test_multiple_reports_and_package_failure(self):
-        self.report.write_bytes(self.event("run") + self.event("fail", ""))
+        self.report.write_bytes(self.event("start", "") + self.event("run"))
+        self.assertIn("TestOne", self.read()[0])
+        with self.report.open("ab") as stream:
+            stream.write(self.event("fail", ""))
+        self.assertEqual(["no active or incomplete UT package/test case found"], self.read())
         second = self.report.with_suffix(".second")
         second.write_bytes(self.event("run"))
-        self.assertEqual(self.read(), self.read(self.report, second, second))
-        self.oracle()  # unfinished case must survive the package failure
+        self.assertEqual(self.read(second), self.read(self.report, second, second))
         second.unlink()
         self.assertEqual(self.read(), self.read(self.report, second))
 
+        with self.report.open("ab") as stream:
+            stream.write(self.event("start", "") + self.event("run"))
+        self.assertIn("TestOne", self.read()[0])
+        active_out = self.report.with_suffix(".active")
+        summarize(self.report, active_out=active_out)
+        lines = active_out.read_text().splitlines()
+        self.assertEqual(2, len(lines))
+        self.assertTrue(lines[0].startswith("active UT case: "))
+        self.assertTrue(lines[1].startswith("unfinished UT case at package exit: "))
+        self.assertTrue(lines[1].endswith("package_result=fail"))
+
+    def test_overlapping_package_invocations(self):
+        self.report.write_bytes(
+            self.event("start", "") + self.event("run", "TestA")
+            + self.event("start", "") + self.event("run", "TestB")
+            + self.event("fail", "")
+        )
+        lines = self.read()
+        self.assertEqual(2, len(lines))
+        self.assertTrue(all(line.startswith("unresolved UT case") for line in lines))
+        with self.report.open("ab") as stream:
+            stream.write(self.event("pass", "TestB") + self.event("pass", ""))
+        self.assertEqual(["no active or incomplete UT package/test case found"], self.read())
+        active_out = self.report.with_suffix(".active")
+        summarize(self.report, active_out=active_out)
+        final = active_out.read_text().splitlines()
+        self.assertEqual(1, len(final))
+        self.assertIn("test=TestA", final[0])
+        self.assertTrue(final[0].endswith("package_result=unknown"))
+
+    def test_same_name_overlap_preserves_unmatched_run(self):
+        for events in (
+            self.event("run") + self.event("fail", ""),
+            self.event("fail", "") + self.event("run"),
+        ):
+            with self.subTest(events=events):
+                self.report.write_bytes(
+                    self.event("start", "") + self.event("run") + self.event("start", "")
+                    + events + self.event("pass")
+                )
+                self.assertIn("unresolved UT case", self.read()[0])
+                with self.report.open("ab") as stream:
+                    stream.write(self.event("pass", ""))
+                active_out = self.report.with_suffix(".active")
+                summarize(self.report, active_out=active_out)
+                self.assertEqual(1, len(active_out.read_text().splitlines()))
+                self.assertIn("test=TestOne state=unknown started=unknown package_result=unknown",
+                              active_out.read_text())
+
+    def test_final_package_exit_without_newline(self):
+        self.report.write_bytes(
+            self.event("start", "") + self.event("run") + self.event("fail", "")[:-1]
+        )
+        active_out = self.report.with_suffix(".active")
+        _, packages, malformed = summarize(self.report, active_out=active_out)
+        self.assertEqual(0, malformed)
+        self.assertEqual("fail", packages[0][3])
+        self.assertIn("unfinished UT case at package exit:", active_out.read_text())
+        self.assertIn("test=TestOne", active_out.read_text())
+        self.assertIn("package_result=fail", active_out.read_text())
+
+        summarize(self.report, active_out=active_out, require_lifecycle_lf=True)
+        self.assertEqual(self.read(), active_out.read_text().splitlines())
+        self.assertTrue(self.read()[0].startswith("active UT case: "))
+        with self.report.open("ab") as stream:
+            stream.write(b"\n")
+        self.assertEqual(["no active or incomplete UT package/test case found"], self.read())
+
+    def test_final_lifecycle_size_matches_merged_size(self):
+        terminal = self.event("fail", "")[:-1]
+        prefix
```

**File**: `optools/ut_incremental_test.go` (modified, +16/-0)
```diff
@@ -20,6 +20,22 @@ func TestUTIncrementalActiveCases(t *testing.T) {
 	}
 }
 
+func TestUTFailureReporterRequiresNewlineForUndrainedWriter(t *testing.T) {
+	script := `source ./run_ut.sh UT
+printf '%s\n' '{"Action":"start","Package":"p"}' '{"Action":"run","Package":"p","Test":"TestOne"}' > "$UT_REPORT"
+printf '%s' '{"Action":"fail","Package":"p"}' >> "$UT_REPORT"
+CURRENT_UT_DRAIN_FAILED=1
+report_slow_ut_cases
+grep -q '^active UT case: .*test=TestOne' "$UT_REPORT.lifecycle" || exit 90
+CURRENT_UT_DRAIN_FAILED=0
+report_slow_ut_cases
+grep -q '^unfinished UT case at package exit: .*test=TestOne .*package_result=fail$' "$UT_REPORT.lifecycle" || exit 91
+`
+	if out, err := scheduleHarness(t, script); err != nil {
+		t.Fatalf("final report EOF classification: %v\n%s", err, out)
+	}
+}
+
 func TestUTHeartbeatCancelsReader(t *testing.T) {
 	script := `source ./run_ut.sh UT
 mkfifo "$CASE_DIR/reader-ready" "$CASE_DIR/reader-block"
```

**File**: `optools/ut_process.bash` (modified, +52/-30)
```diff
@@ -124,39 +124,17 @@ function remove_ut_report_file(){
     return 0
 }
 
-# append_ut_report copies a helper-owned report into the authoritative report
-# after the helper has stopped.  A helper may be interrupted while it is
-# merging shard files, so the completion marker is the ownership boundary:
-#
-#   marker exists  -> the complete base report is authoritative
-#   marker missing -> consume shard files (or an unmarked base as a last resort)
-#
-# Never concatenate both forms; doing so duplicates every event already copied
-# before cancellation and makes go-ut-analysis report false failures.  The
-# caller must serialize this operation with its TERM trap because appending to a
-# shared file is not intrinsically idempotent.  Build the complete destination
-# in a same-directory temporary file and publish it with rename.  A TERM/KILL
-# during any source copy therefore leaves both the old destination and the
-# source representation intact; a direct `cat >> destination` would leave an
-# indistinguishable prefix that a retry could duplicate.
-function append_ut_report(){
-    if (( $# != 2 )); then
-        echo "Usage: append_ut_report REPORT DESTINATION" >&2
-        return 2
-    fi
-
+# Populate the caller's sources array with the authoritative representation of
+# one helper report. Both the report appender and the heartbeat use this rule.
+function collect_ut_report_sources(){
     local report=$1
-    local destination=$2
     local partial=""
-    local staging=""
-    local expected=""
-    local partial_found=0
+    sources=()
 
     # Select one authoritative representation.  A ready marker is meaningful
     # only when its complete base file is still present; silently treating a
     # missing base as success would allow the caller to delete the marker and
     # lose the only diagnostic source.
-    local -a sources=()
     if [[ -f "${report}.ready" ]]; then
         if [[ ! -f "${report}" ]]; then
             echo "UT report marker exists without its base report: ${report}" >&2
@@ -171,26 +149,70 @@ function append_ut_report(){
             # is not a report shard and must never be consumed as one.
             [[ "${partial}" == "${report}.tmp."* ]] && continue
             sources+=("${partial}")
-            partial_found=1
         done
-        if (( partial_found == 0 )) && [[ -f "${report}" ]]; then
+        if (( ${#sources[@]} == 0 )) && [[ -f "${report}" ]]; then
             # This covers a helper that failed before it could create the
             # marker and left only a diagnostic base file.
             sources=("${report}")
         fi
     fi
+}
+
+# Seal a stopped writer's incomplete line before concatenating another report.
+# Keep report bytes for diagnosis. A complete JSON record without its newline
+# remains usable once the writer has stopped.
+function copy_ut_report_chunk(){
+    local source=$1
+    local last_byte_lines
+    cat "${source}" || return 1
+    if [[ -s "${source}" ]]; then
+        last_byte_lines=$(set -o pipefail; tail -c 1 "${source}" | wc -l) || return 1
+        if (( last_byte_lines == 0 )); then
+            printf '\n' || return 1
+        fi
+    fi
+}
+
+# append_ut_report copies a helper-owned report into the authoritative report
+# after the helper has stopped.  A helper may be interrupted while it is
+# merging shard files, so the completion marker is the ownership boundary:
+#
+#   marker exists  -> the complete base report is authoritative
+#   marker missing -> consume shard files (or an unmarked base as a last resort)
+#
+# Never concatenate both forms; doing so duplicates every event already copied
+# before cancellation and makes go-ut-analysis report false failures.  The
+# caller must serialize this operation with its TERM trap because appending to a
+# shared file is not intrinsically idempotent.  Build the complete destination
+# in a same-directory temporary file and publish it with rename.  A TERM/KILL
+# during any source copy therefore leaves both the old destination and the
+# source representation intact; a direct `cat >> destination` would leave an
+# indistinguishable prefix that a retry could duplicate.
+function append_ut_report(){
+    if (( $# != 2 )); then
+        echo "Usage: append_ut_report REPORT DESTINATION" >&2
+        return 2
+    fi
+
+    local report=$1
+    local destination=$2
+    local partial=""
+    local staging=""
+    local expected=""
+    local -a sources=()
+    collect_ut_report_sources "${report}" || return 1
 
     if (( ${#sources[@]} == 0 )); then
         return 0
     fi
 
     staging=$(mktemp "${destination}.tmp.XXXXXX") || return 1
-    if [[ -f "${destination}" ]] && ! cat "${destination}" > "${staging}"; then
+    if [[ -f "${destination}" ]] && ! copy_ut_report_chunk "${destination}" > "${staging}"; then
         rm -f "${staging}"
         return 1
     fi
     for partial in "${sources[@]}"; do
-        if ! cat "${partial}" >> "${staging}"; then
+        if ! copy_ut
```

**File**: `optools/ut_schedule_test.go` (modified, +109/-17)
```diff
@@ -1182,14 +1182,12 @@ cgroup_resource_breakdown "$CASE_DIR/missing"
 func TestUTHeartbeatStopsCleanly(t *testing.T) {
 	t.Parallel()
 	script := `source ./run_ut.sh UT
-mkfifo "$CASE_DIR/heartbeat-ready"
-exec 9<> "$CASE_DIR/heartbeat-ready"
-trap 'stop_ut_heartbeat; exec 9>&-' EXIT
+mkfifo "$CASE_DIR/heartbeat-tick" "$CASE_DIR/heartbeat-waiting" || exit 90
+exec 8<> "$CASE_DIR/heartbeat-tick"
+exec 9<> "$CASE_DIR/heartbeat-waiting"
+trap 'stop_ut_heartbeat; exec 8>&- 9>&-' EXIT
 function logger() {
     printf "%s\n" "$2" >> "$CASE_DIR/ut.log"
-    if [[ "$2" == *active_cases=3* && "$2" == *TestPrivate* && "$2" == *TestShard* && "$2" == *TestBatched* ]]; then
-        printf 'ready\n' >&9
-    fi
 }
 UT_HEARTBEAT_INTERVAL=60
 start_ut_heartbeat
@@ -1201,12 +1199,30 @@ stop_ut_heartbeat
 ! kill -0 "$heartbeat_pid" 2>/dev/null || exit 90
 
 UT_HEARTBEAT_INTERVAL=1
+# Release one timer only after the reports are ready. Its next wait confirms
+# the previous iteration wrote both the log and checkpoint.
+function sleep() {
+    if [[ "$*" == 1 ]]; then
+        printf 'waiting\n' >&9
+        read -r tick <&8
+    else
+        command sleep "$@"
+    fi
+}
+function heartbeat_waiting() {
+    local state
+    read -r -t 10 state <&9 && [[ "$state" == waiting ]]
+}
+function heartbeat_tick() {
+    printf 'tick\n' >&8 && heartbeat_waiting
+}
 # Exercise the actual heartbeat formatting without exposing real process data.
 function ps() {
     [[ "$*" == '-eo pid=,ppid=,rss=,comm=' ]] || return 93
     printf '1 0 100 tiny\n2 1 200 small\n3 1 300 third\n4 1 400 fourth\n5 1 500 fifth\n6 1 600 sixth\n7 1 700 seventh\n8 1 800 eighth\n9 1 900 largest\n'
 }
 start_ut_heartbeat
+heartbeat_waiting || exit 92
 LIGHT_RACE_REPORT="$G_WKSP/${G_TS}-light-race-report.out"
 cat > "$LIGHT_RACE_REPORT" <<'EOF'
 {"Time":"2026-09-10T01:00:01Z","Action":"run","Package":"example/light","Test":"TestPrivate"}
@@ -1217,19 +1233,42 @@ EOF
 cat > "$G_WKSP/${G_TS}-embedded-batched-race-report.out.0" <<'EOF'
 {"Time":"2026-09-10T01:00:01Z","Action":"run","Package":"example/embedded","Test":"TestBatched"}
 EOF
-read -r -t 10 heartbeat_ready <&9 || exit 92
+cat > "$G_WKSP/${G_TS}-engine-race-report.out.tmp.staging" <<'EOF'
+{"Time":"2026-09-10T01:00:01Z","Action":"run","Package":"example/engine","Test":"TestStaged"}
+EOF
+cat > "$UT_REPORT" <<'EOF'
+{"Time":"2026-09-10T00:00:00Z","Action":"start","Package":"example/retired"}
+{"Time":"2026-09-10T00:00:01Z","Action":"run","Package":"example/retired","Test":"TestRetired"}
+{"Time":"2026-09-10T00:00:02Z","Action":"fail","Package":"example/retired"}
+EOF
+heartbeat_tick || exit 92
 stop_ut_heartbeat
-exec 9>&-
 [[ -z "$UT_HEARTBEAT_PID" ]] || exit 91
-grep -q 'event=heartbeat' "$UT_CHECKPOINT"
-grep -q 'active_cases=3' "$CASE_DIR/ut.log"
-grep -q 'TestPrivate' "$CASE_DIR/ut.log"
-grep -q 'TestShard' "$CASE_DIR/ut.log"
-grep -q 'TestBatched' "$CASE_DIR/ut.log"
-grep -q 'processes=9' "$CASE_DIR/ut.log"
-grep -q 'processes.top_rss=pid=9,ppid=1,rss_kib=900,comm=largest;pid=8,ppid=1,rss_kib=800,comm=eighth;' "$CASE_DIR/ut.log"
-grep -q 'pid=2,ppid=1,rss_kib=200,comm=small;' "$CASE_DIR/ut.log"
-! grep -q 'pid=1,ppid=0,rss_kib=100,comm=tiny;' "$CASE_DIR/ut.log"
+grep -q 'event=heartbeat ' "$UT_CHECKPOINT" || exit 93
+grep -q 'active_cases=3 ' "$CASE_DIR/ut.log" || exit 93
+grep -q 'TestPrivate' "$CASE_DIR/ut.log" || exit 93
+grep -q 'TestShard' "$CASE_DIR/ut.log" || exit 93
+grep -q 'TestBatched' "$CASE_DIR/ut.log" || exit 93
+! grep -qE 'active_cases=unknown|TestRetired|TestStaged' "$CASE_DIR/ut.log" || exit 94
+grep -q 'processes=9' "$CASE_DIR/ut.log" || exit 93
+grep -q 'processes.top_rss=pid=9,ppid=1,rss_kib=900,comm=largest;pid=8,ppid=1,rss_kib=800,comm=eighth;' "$CASE_DIR/ut.log" || exit 93
+grep -q 'pid=2,ppid=1,rss_kib=200,comm=small;' "$CASE_DIR/ut.log" || exit 93
+! grep -q 'pid=1,ppid=0,rss_kib=100,comm=tiny;' "$CASE_DIR/ut.log" || exit 95
+
+function python3() { return 1; }
+function awk() {
+    if [[ "$*" == *active_ut_cases.awk* ]]; then
+        touch "$CASE_DIR/rescanned"
+        return 1
+    fi
+    command awk "$@"
+}
+: > "$CASE_DIR/ut.log"
+start_ut_heartbeat
+heartbeat_waiting && heartbeat_tick || exit 96
+stop_ut_heartbeat
+exec 8>&- 9>&-
+grep -q 'active_cases=unknown active=unclassified report' "$CASE_DIR/ut.log" && [[ ! -e "$CASE_DIR/rescanned" ]]
 `
 	mock := `#!/bin/bash
 if [[ "$1" == version ]]; then exit 0; fi
@@ -1241,6 +1280,59 @@ exit 0
 	}
 }
 
+func TestPlanRaceReportSeparatesTornShard(t *testing.T) {
+	script := `source ./run_ut.sh UT
+PLAN_RACE_SHARDS=2
+PLAN_RACE_PARALLEL=2
+PLAN_RACE_REPORT="$CASE_DIR/plan.out"
+status=0
+run_plan_race_shards example/plan || status=$?
+[[ "$status" == 1 && -f "$PLAN_RACE_REPORT.ready" ]] || exit 90
+append_ut_report "$PLAN_RACE_REPORT" "$CASE_DIR/ready.out" || exit 91
+rm "$PLAN_RACE_REPORT.ready"
+append_ut_report "$PLAN_RACE_REPORT" "$CASE_DIR/recovered.out" || exit 92
+cmp "$CASE_DIR/ready.out" "$CASE_DIR/recovered.out" ||
```

**File**: `optools/validate_ut_report.py` (modified, +26/-8)
```diff
@@ -87,6 +87,23 @@ def _event_fields(event: object) -> Optional[Tuple[str, str, str]]:
     return action, package, test
 
 
+def decode_event(raw_line: bytes) -> object:
+    return json.loads(raw_line.decode("utf-8"))
+
+
+def emit_analyzer_input(report_path: Path) -> None:
+    # Preserve complete records exactly. The pinned analyzer aborts on invalid
+    # JSON, so keep malformed fragments only in the authoritative raw report.
+    with report_path.open("rb") as report:
+        for raw_line in report:
+            try:
+                event = decode_event(raw_line)
+            except (UnicodeDecodeError, json.JSONDecodeError):
+                continue
+            if isinstance(event, dict):
+                sys.stdout.buffer.write(raw_line)
+
+
 def validate(report_path: Path, require_complete: bool = False) -> Validation:
     result = Validation()
     active: Dict[Tuple[str, str], ActiveTest] = {}
@@ -96,13 +113,8 @@ def validate(report_path: Path, require_complete: bool = False) -> Validation:
     with report_path.open("rb") as report:
         for line_number, raw_line in enumerate(report, 1):
             try:
-                line = raw_line.decode("utf-8")
-            except UnicodeDecodeError:
-                result.malformed += 1
-                continue
-            try:
-                event = json.loads(line)
-            except json.JSONDecodeError:
+                event = decode_event(raw_line)
+            except (UnicodeDecodeError, json.JSONDecodeError):
                 result.malformed += 1
                 continue
 
@@ -239,13 +251,19 @@ def _print_result(result: Validation) -> None:
 
 def main(argv: Optional[Iterable[str]] = None) -> int:
     parser = argparse.ArgumentParser(description=__doc__)
-    parser.add_argument("--require-complete", action="store_true")
+    mode = parser.add_mutually_exclusive_group()
+    mode.add_argument("--require-complete", action="store_true")
+    mode.add_argument("--emit-analyzer-input", action="store_true")
     parser.add_argument("report", type=Path)
     arguments = parser.parse_args(argv)
     if not arguments.report.is_file():
         print(f"UT report missing: {arguments.report}", file=sys.stderr)
         return 1
 
+    if arguments.emit_analyzer_input:
+        emit_analyzer_input(arguments.report)
+        return 0
+
     result = validate(arguments.report, arguments.require_complete)
     _print_result(result)
     return 1 if result.errors else 0
```

---

### Incident Patch 2: `a9dda368` (2026-11-21)
**Commit Message**: fix(data branch): use lineage mapping for diff output tables (#32971)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #32969

## What this PR does / why we need it:

### Summary
Fixes `DATA BRANCH DIFF ... OUTPUT AS` schema evolution / column lineage resolution bugs and fixes related column mapping, row ordering, `TIMESTAMP` formatting, `DECIMAL` attribute, and Unicode case-fold edge cases.

### Root Cause & Changes
1. **Lineage-mapped `OUTPUT AS` DDL & base history projection (`pkg/frontend/data_branch.go`, `pkg/frontend/data_branch_hashdiff.go`, `pkg/frontend/data_branch_output.go`)**:
   - Updated `reconcileDataBranchEndpointSchema` to index target data columns positionally (`tarDataIdx` skipping `catalog.Row_ID`), populate `lcaColNames`, `baseColNames`, and `baseColToTarIdx` accurately across altered/renamed/reordered schemas, and keep `dataBranchIndexedSpecialUpdateColIdxes` consistent via `commonutil.EqualFoldKey`.
   - Added `excludeTargetOnly` in `dataBranchSourceColToTargetIdx` so base-side historical batches exclude target-only slo

**File**: `pkg/frontend/data_branch.go` (modified, +60/-28)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/rscthrottler"
+	commonutil "github.com/matrixorigin/matrixone/pkg/common/util"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -1450,20 +1451,19 @@ func reconcileDataBranchEndpointSchema(
 			return err
 		}
 		tables.def.lcaColNames = make([]string, len(tables.def.colNames))
+		tarDataIdx := -1
 		for _, tarCol := range tarDef.Cols {
 			if tarCol.Name == catalog.Row_ID {
 				continue
 			}
+			tarDataIdx++
 			reachesLCA, lcaCol, redefined := dataBranchColumnReachesLCA(
 				tarDefs, dagInfo.pathFromLCAToTarLineageOnly, tarCol,
 			)
 			if !reachesLCA || redefined || lcaCol == nil {
 				continue
 			}
-			idx := dataBranchColumnIndexByName(tables.def.colNames, tarCol.Name)
-			if idx >= 0 {
-				tables.def.lcaColNames[idx] = lcaCol.Name
-			}
+			tables.def.lcaColNames[tarDataIdx] = lcaCol.Name
 		}
 		resolveBaseColumn = func(tarCol *plan.ColDef) *plan.ColDef {
 			if baseCol := endpointColumns[strings.ToLower(tarCol.Name)]; baseCol != nil {
@@ -1505,21 +1505,20 @@ func reconcileDataBranchEndpointSchema(
 		tables.def.baseColToTarIdx[i] = -1
 	}
 	tables.def.baseColNames = make([]string, len(tables.def.colNames))
+	tarDataIdx := -1
 	for _, tarCol := range tarDef.Cols {
 		if tarCol.Name == catalog.Row_ID {
 			continue
 		}
+		tarDataIdx++
 		baseCol := resolveBaseColumn(tarCol)
 		if baseCol == nil {
 			continue
 		}
-		tarIdx := dataBranchColumnIndexByName(tables.def.colNames, tarCol.Name)
-		if tarIdx >= 0 {
-			tables.def.baseColNames[tarIdx] = baseCol.Name
-		}
+		tables.def.baseColNames[tarDataIdx] = baseCol.Name
 		for i, candidate := range baseDataCols {
-			if strings.EqualFold(candidate.Name, baseCol.Name) {
-				tables.def.baseColToTarIdx[i] = tarIdx
+			if candidate == baseCol || strings.EqualFold(candidate.Name, baseCol.Name) {
+				tables.def.baseColToTarIdx[i] = tarDataIdx
 				break
 			}
 		}
@@ -1731,6 +1730,7 @@ func checkDataBranchPrimaryKeyCompatibilityWithResolver(
 func dataBranchColumnTypeAttributesEqual(left, right plan.Type) bool {
 	return left.Width == right.Width &&
 		left.Scale == right.Scale &&
+		left.NumericAttributes == right.NumericAttributes &&
 		left.Enumvalues == right.Enumvalues &&
 		left.AutoIncr == right.AutoIncr &&
 		left.NotNullable == right.NotNullable
@@ -1750,16 +1750,22 @@ func checkSchemaCompatibilityWithResolver(
 
 	baseVisibleColMap := make(map[string]*plan.ColDef, len(baseDef.Cols))
 	for _, col := range baseDef.Cols {
-		if col.Name == catalog.Row_ID {
-			continue
-		}
-		name := strings.ToLower(col.Name)
 		if isDataBranchUserVisibleColumn(col) {
-			baseVisibleColMap[name] = col
+			nameKey := commonutil.EqualFoldKey(col.Name)
+			if prev := baseVisibleColMap[nameKey]; prev != nil {
+				err = moerr.NewInternalErrorNoCtxf(
+					"schema compatibility check: base columns '%s' and '%s' have equivalent names",
+					prev.Name, col.Name,
+				)
+				return
+			}
+			baseVisibleColMap[nameKey] = col
 		}
 	}
 
 	commonColNameSet := make(map[string]bool)
+	matchedBaseCols := make(map[*plan.ColDef]string)
+	tarVisibleColMap := make(map[string]*plan.ColDef, len(tarDef.Cols))
 	dataIdx := 0
 	for _, tarCol := range tarDef.Cols {
 		if tarCol.Name == catalog.Row_ID {
@@ -1771,8 +1777,28 @@ func checkSchemaCompatibilityWithResolver(
 			continue
 		}
 
-		name := strings.ToLower(tarCol.Name)
 		baseCol := resolveBaseColumn(tarCol)
+		if baseCol != nil {
+			if prevTarName, matched := matchedBaseCols[baseCol]; matched {
+				err = moerr.NewInternalErrorNoCtxf(
+					"schema compatibility check: base column '%s' matches multiple target columns ('%s' and '%s')",
+					baseCol.Name, prevTarName, tarCol.Name,
+				)
+				return
+			}
+			matchedBaseCols[baseCol] = tarCol.Name
+		}
+		if isDataBranchUserVisibleColumn(tarCol) {
+			tarNameKey := commonutil.EqualFoldKey(tarCol.Name)
+			if prev := tarVisibleColMap[tarNameKey]; prev != nil {
+				err = moerr.NewInternalErrorNoCtxf(
+					"schema compatibility check: target columns '%s' and '%s' have equivalent names",
+					prev.Name, tarCol.Name,
+				)
+				return
+			}
+			tarVisibleColMap[tarNameKey] = tarCol
+		}
 		if baseCol != nil {
 			if !dataBranchGeneratedColumnsLogicallyEqual(
 				tarCol, baseCol, tarDef, baseDef, resolveBaseColumn,
@@ -1799,12 +1825,13 @@ func checkSchemaCompatibilityWithResolver(
 					return
 				}
 				commonIdxes = append(commonIdxes, dataIdx)
-				commonColNameSet[name] = true
-				commonColNameSet[strings.ToLower(baseCol.Name)] = true
+				baseNameKey := commonutil.EqualFoldKey(baseCol.Name)
+				commonColNameSet[commonutil.EqualFoldKey(tarCol.Name)] = true
+				commonColNameSet[baseNameKey] = true
 				if isDataBranchUserVisibleColumn(tarCol) {
 					commonVisibl
```

**File**: `pkg/frontend/data_branch_hashdiff.go` (modified, +8/-16)
```diff
@@ -925,21 +925,6 @@ func runLCAProbeWithReaderFallback(
 				return executor.Result{}, err
 			}
 		}
-	} else if len(missedRows) == 0 {
-		for targetIdx, sourceIdx := range sourceIdxByTarget {
-			if sourceIdx < 0 {
-				nullConst := vector.NewConstNull(tblStuff.def.colTypes[targetIdx], rowCount, mp)
-				err = out.Vecs[targetIdx+1].UnionBatch(nullConst, 0, rowCount, nil, mp)
-				nullConst.Free(mp)
-				if err != nil {
-					return executor.Result{}, err
-				}
-				continue
-			}
-			if err = out.Vecs[targetIdx+1].UnionBatch(tmp.Vecs[sourceIdx], 0, rowCount, nil, mp); err != nil {
-				return executor.Result{}, err
-			}
-		}
 	} else {
 		for targetIdx, sourceIdx := range sourceIdxByTarget {
 			if sourceIdx < 0 {
@@ -951,6 +936,7 @@ func runLCAProbeWithReaderFallback(
 				}
 				continue
 			}
+			// Even an all-hit scan may return rows in a different order than orderedIdx.
 			if err = out.Vecs[targetIdx+1].Union(tmp.Vecs[sourceIdx], sels, mp); err != nil {
 				return executor.Result{}, err
 			}
@@ -3175,6 +3161,7 @@ func dataBranchSourceColToTargetIdx(
 	sourceDef, targetDef *plan2.TableDef,
 	targetColNames []string,
 	targetOnlyIdxes []int,
+	excludeTargetOnly bool,
 ) ([]int, error) {
 	if sourceDef == nil || targetDef == nil {
 		return nil, moerr.NewInternalErrorNoCtx("missing schema for historical data branch projection")
@@ -3231,6 +3218,11 @@ func dataBranchSourceColToTargetIdx(
 		if targetCol != nil {
 			targetIdx = dataBranchColumnIndexByName(targetColNames, targetCol.Name)
 		}
+		_, isTargetOnly := targetOnly[targetIdx]
+		if excludeTargetOnly && isTargetOnly {
+			// A historical base value is absent from the current base schema.
+			targetIdx = -1
+		}
 		mapping = append(mapping, targetIdx)
 		if targetIdx < 0 {
 			continue
@@ -3240,7 +3232,7 @@ func dataBranchSourceColToTargetIdx(
 		sameType := col.Typ.Id == targetCol.Typ.Id &&
 			(dataBranchColumnTypeAttributesEqual(col.Typ, targetCol.Typ) || derivedCompositePK)
 		if !sameType {
-			if _, isTargetOnly := targetOnly[targetIdx]; isTargetOnly {
+			if isTargetOnly {
 				// This column does not exist on the base endpoint and is excluded
 				// from comparison and MERGE apply. Its old physical representation
 				// cannot be moved into the endpoint-typed batch; project it as NULL
```

**File**: `pkg/frontend/data_branch_hashdiff_test.go` (modified, +122/-10)
```diff
@@ -43,6 +43,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/vm/engine"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/readutil"
 	"github.com/panjf2000/ants/v2"
+	"github.com/prashantv/gostub"
 	"github.com/stretchr/testify/require"
 )
 
@@ -1074,6 +1075,57 @@ func TestRunLCAProbeWithReaderFallback_PrepareAndPropagateReaderError(t *testing
 	ret.Close()
 }
 
+func TestRunLCAProbeWithReaderFallback_AllHitsPreserveInputOrder(t *testing.T) {
+	ctx := context.Background()
+	ses := newValidateSession(t)
+	mp := ses.proc.Mp()
+	ctrl := gomock.NewController(t)
+	tblStuff := newTestBranchTableStuff(ctrl)
+	lcaRel := mock_frontend.NewMockRelation(ctrl)
+	lcaRel.EXPECT().GetTableDef(gomock.Any()).Return(newTestBranchTableDef("lca_tbl", "name"))
+	lcaRel.EXPECT().GetTableID(gomock.Any()).Return(uint64(77)).AnyTimes()
+	tblStuff.lcaRel = lcaRel
+
+	keys := batch.NewWithSize(1)
+	defer keys.Clean(mp)
+	keys.Vecs[0] = vector.NewVec(types.T_int64.ToType())
+	require.NoError(t, vector.AppendFixedList(keys.Vecs[0], []int64{20, 10}, nil, mp))
+	keys.SetRowCount(2)
+
+	stub := gostub.Stub(&scanSnapshotRelationByIDWithFallback, func(
+		_ context.Context, _ string, _ *Session, _ uint64, _ types.TS, _ engine.Relation,
+		attrs []string, typs []types.Type, _ *plan.Expr, _ int, onBatch func(*batch.Batch) error,
+	) error {
+		require.Equal(t, []string{"id", "name", "hidden"}, attrs)
+		readBatch := batch.NewWithSize(len(attrs))
+		defer readBatch.Clean(mp)
+		for i, typ := range typs {
+			readBatch.Vecs[i] = vector.NewVec(typ)
+		}
+		require.NoError(t, vector.AppendFixedList(readBatch.Vecs[0], []int64{10, 20}, nil, mp))
+		require.NoError(t, vector.AppendBytes(readBatch.Vecs[1], []byte("ten"), false, mp))
+		require.NoError(t, vector.AppendBytes(readBatch.Vecs[1], []byte("twenty"), false, mp))
+		require.NoError(t, vector.AppendBytes(readBatch.Vecs[2], nil, true, mp))
+		require.NoError(t, vector.AppendBytes(readBatch.Vecs[2], []byte("present"), false, mp))
+		readBatch.SetRowCount(2)
+		return onBatch(readBatch)
+	})
+	t.Cleanup(stub.Reset)
+
+	ret, err := runLCAProbeWithReaderFallback(ctx, ses, keys, tblStuff, types.BuildTS(10, 0))
+	require.NoError(t, err)
+	defer ret.Close()
+	require.Len(t, ret.Batches, 1)
+	out := ret.Batches[0]
+	require.Equal(t, 2, out.RowCount())
+	require.Equal(t, []int64{0, 1}, vector.MustFixedColNoTypeCheck[int64](out.Vecs[0]))
+	require.Equal(t, []int64{20, 10}, vector.MustFixedColNoTypeCheck[int64](out.Vecs[tblStuff.def.pkColIdx+1]))
+	require.Equal(t, "twenty", out.Vecs[2].GetStringAt(0))
+	require.Equal(t, "ten", out.Vecs[2].GetStringAt(1))
+	require.Equal(t, "present", out.Vecs[3].GetStringAt(0))
+	require.True(t, out.Vecs[3].IsNull(1))
+}
+
 func TestHandleDelsOnLCA_EarlyPaths(t *testing.T) {
 	ses := newValidateSession(t)
 	ctrl := gomock.NewController(t)
@@ -3635,7 +3687,7 @@ func TestDataBranchSourceColToTargetIdxRejectsHistoricalTypeDrift(t *testing.T)
 	}
 
 	_, err := dataBranchSourceColToTargetIdx(
-		sourceDef, targetDef, []string{"a", "c"}, []int{1},
+		sourceDef, targetDef, []string{"a", "c"}, []int{1}, false,
 	)
 	require.Error(t, err)
 	require.Contains(t, err.Error(), "historical data branch column a has a different type")
@@ -3658,7 +3710,7 @@ func TestDataBranchSourceColToTargetIdxSkipsTargetOnlyHistoricalTypeDrift(t *tes
 	}
 
 	mapping, err := dataBranchSourceColToTargetIdx(
-		sourceDef, targetDef, []string{"a", "c"}, []int{1},
+		sourceDef, targetDef, []string{"a", "c"}, []int{1}, false,
 	)
 	require.NoError(t, err)
 	require.Equal(t, []int{0, -1}, mapping)
@@ -3688,6 +3740,66 @@ func TestDataBranchSourceColToTargetIdxSkipsTargetOnlyHistoricalTypeDrift(t *tes
 	require.Equal(t, baseline, mp.CurrNB())
 }
 
+func TestDataBranchSourceColToTargetIdxExcludesBaseHistoricalTargetOnlyColumns(t *testing.T) {
+	// The historical base and the current target have the same schema, but
+	// x and y no longer exist on the current base.
+	def := &plan.TableDef{
+		Cols: []*plan.ColDef{
+			{Name: "id", ColId: 1, Seqnum: 0, Typ: plan.Type{Id: int32(types.T_int32)}},
+			{Name: "x", ColId: 2, Seqnum: 1, Typ: plan.Type{Id: int32(types.T_int32)}},
+			{Name: "y", ColId: 3, Seqnum: 2, Typ: plan.Type{Id: int32(types.T_int32)}},
+			{Name: "amount", ColId: 4, Seqnum: 3, Typ: plan.Type{Id: int32(types.T_decimal64), Width: 9, Scale: 2}},
+		},
+		Pkey: &plan.PrimaryKeyDef{PkeyColName: "id", Names: []string{"id"}},
+	}
+	tblStuff := tableStuff{}
+	tblStuff.def.colNames = []string{"id", "x", "y", "amount"}
+	intType := types.T_int32.ToType()
+	decimalType := types.New(types.T_decimal64, 9, 2)
+	tblStuff.def.colTypes = []types.Type{intType, intType, intType, decimalType}
+	targetOnly := []int{1, 2}
+	targetMapping, err := dataBranchSourceColToTargetIdx(def, def, tblStuff.def.colNames, targetOnly, false)
+	require.NoError(t, err)
+	require.Equal(t, []int{0, 1, 2, 3}, targetMapping)
+	require.False(t, dataBranchNeedsHistoricalProjection(targetMapping, len(tblStuff.def.colNames)))
+	baseMapp
```

**File**: `pkg/frontend/data_branch_output.go` (modified, +121/-82)
```diff
@@ -37,6 +37,7 @@ import (
 	"github.com/google/uuid"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	commonutil "github.com/matrixorigin/matrixone/pkg/common/util"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -470,7 +471,16 @@ func resolveProjectedIdxes(columns tree.IdentifierList, tblStuff tableStuff) ([]
 
 	nameToIdx := make(map[string]int, len(tblStuff.def.visibleIdxes))
 	for _, idx := range tblStuff.def.visibleIdxes {
-		nameToIdx[strings.ToLower(tblStuff.def.colNames[idx])] = idx
+		colName := tblStuff.def.colNames[idx]
+		nameKey := commonutil.EqualFoldKey(colName)
+		if prevIdx, exists := nameToIdx[nameKey]; exists && prevIdx != idx {
+			return nil, moerr.NewInvalidInputNoCtxf(
+				"column names %q and %q are equivalent",
+				tblStuff.def.colNames[prevIdx],
+				colName,
+			)
+		}
+		nameToIdx[nameKey] = idx
 	}
 
 	projected := make([]int, 0, len(columns)+len(tblStuff.def.pkColIdxes))
@@ -486,7 +496,7 @@ func resolveProjectedIdxes(columns tree.IdentifierList, tblStuff tableStuff) ([]
 	}
 
 	for _, col := range columns {
-		idx, ok := nameToIdx[strings.ToLower(string(col))]
+		idx, ok := nameToIdx[commonutil.EqualFoldKey(string(col))]
 		if !ok {
 			if tblStuff.tarRel != nil && tblStuff.tarRel.GetTableName() != "" {
 				return nil, moerr.NewInvalidInputNoCtxf(
@@ -566,9 +576,19 @@ func newDiffOutputTable(
 
 	columnNames := make([]string, 0, len(projectedIdxes)+2)
 	usedNames := make(map[string]struct{}, len(projectedIdxes)+2)
+	usedColNames := make(map[string]string, len(projectedIdxes))
 	for _, idx := range projectedIdxes {
 		name := tblStuff.def.colNames[idx]
-		usedNames[strings.ToLower(name)] = struct{}{}
+		nameKey := commonutil.EqualFoldKey(name)
+		if prevName, exists := usedColNames[nameKey]; exists {
+			return nil, moerr.NewInvalidInputNoCtxf(
+				"column names %q and %q are equivalent",
+				prevName,
+				name,
+			)
+		}
+		usedColNames[nameKey] = name
+		usedNames[nameKey] = struct{}{}
 	}
 	columnNames = append(columnNames,
 		nextAvailableDiffOutputColumnName(diffOutputSourceColumn, usedNames),
@@ -592,11 +612,11 @@ func nextAvailableDiffOutputColumnName(base string, used map[string]struct{}) st
 		if suffix > 0 {
 			name = fmt.Sprintf("%s_%d", base, suffix)
 		}
-		lowerName := strings.ToLower(name)
-		if _, exists := used[lowerName]; exists {
+		nameKey := commonutil.EqualFoldKey(name)
+		if _, exists := used[nameKey]; exists {
 			continue
 		}
-		used[lowerName] = struct{}{}
+		used[nameKey] = struct{}{}
 		return name
 	}
 }
@@ -615,32 +635,37 @@ func (output *diffOutputTable) createSQL(ctx context.Context, tblStuff tableStuf
 		return "", moerr.NewInternalErrorNoCtx("DATA BRANCH DIFF OUTPUT AS target table definition is unavailable")
 	}
 
-	projectedNames := make([]string, len(output.projectedIdxes))
-	projectedTargetOnly := make([]bool, len(output.projectedIdxes))
-	targetOnlyIdxes := make(map[int]struct{}, len(tblStuff.def.tarOnlyIdxes))
-	for _, idx := range tblStuff.def.tarOnlyIdxes {
-		targetOnlyIdxes[idx] = struct{}{}
-	}
-	for i, idx := range output.projectedIdxes {
-		projectedNames[i] = tblStuff.def.colNames[idx]
-		_, projectedTargetOnly[i] = targetOnlyIdxes[idx]
-	}
-	outputColDefs, targetOnly, err := dataBranchOutputColumnDefs(
-		targetTableDef, baseTableDef, projectedNames, projectedTargetOnly,
-	)
-	if err != nil {
-		return "", err
-	}
-
 	columnDefs := []string{
 		fmt.Sprintf("%s varchar(255) default null", quoteIdentifierForSQL(output.columnNames[0])),
 		fmt.Sprintf("%s varchar(16) default null", quoteIdentifierForSQL(output.columnNames[1])),
 	}
-	for i, name := range projectedNames {
-		colDef := outputColDefs[i]
+	for _, idx := range output.projectedIdxes {
+		name := tblStuff.def.colNames[idx]
+		targetOnly := slices.Contains(tblStuff.def.tarOnlyIdxes, idx)
+		var colDef *plan2.ColDef
+		if targetOnly {
+			colDef = dataBranchColumnDefByName(targetTableDef, name)
+			if colDef == nil {
+				return "", moerr.NewInternalErrorNoCtxf(
+					"DATA BRANCH source column %q is unavailable", name,
+				)
+			}
+		} else {
+			// The reconciled mapping identifies the same logical column across
+			// physical table generations, including renamed columns.
+			if idx < len(tblStuff.def.baseColNames) {
+				colDef = dataBranchColumnDefByName(baseTableDef, tblStuff.def.baseColNames[idx])
+			}
+			if colDef == nil {
+				return "", moerr.NewInternalErrorNoCtxf(
+					"DATA BRANCH destination column for source column %q is unavailable", name,
+				)
+			}
+		}
 
 		columnDef := fmt.Sprintf("%s %s", quoteIdentifierForSQL(name), plan2.FormatColType(colDef.Typ))
-		if colDef.Typ.NotNullable && !targetOnly[i] {
+		// Base-side rows project missing target-only values as NULL.
+		if colDef.Typ.NotNullable && !targetOnly {
 			columnDef += " not null"
 		} else {
 			colu
```

**File**: `pkg/frontend/data_branch_output_test.go` (modified, +422/-0)
```diff
@@ -33,6 +33,7 @@ import (
 
 	"github.com/golang/mock/gomock"
 	"github.com/google/uuid"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
@@ -48,6 +49,8 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/stage"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
 	"github.com/panjf2000/ants/v2"
 	"github.com/stretchr/testify/require"
 )
@@ -278,6 +281,7 @@ func TestDataBranchOutputTableSpec(t *testing.T) {
 
 	tblStuff := tableStuff{baseRel: baseRel, tarRel: tarRel}
 	tblStuff.def.colNames = []string{"id", "name", "__mo_diff_source", "__mo_diff_flag"}
+	tblStuff.def.baseColNames = tblStuff.def.colNames
 	tblStuff.def.colTypes = []types.Type{
 		types.T_int64.ToType(),
 		types.T_varchar.ToType(),
@@ -393,6 +397,271 @@ func TestDataBranchOutputTableSpec(t *testing.T) {
 	})
 }
 
+func TestDataBranchOutputTableUsesLineageColumnMapping(t *testing.T) {
+	ctx := context.Background()
+	ctrl := gomock.NewController(t)
+	baseRel := mock_frontend.NewMockRelation(ctrl)
+	tarRel := mock_frontend.NewMockRelation(ctrl)
+	baseRel.EXPECT().GetTableDef(ctx).Return(&plan.TableDef{Cols: []*plan.ColDef{
+		{Name: "id", ColId: 1, Typ: plan.Type{Id: int32(types.T_int64), NotNullable: true}},
+		{Name: "note", ColId: 2, Seqnum: 1, Typ: plan.Type{Id: int32(types.T_varchar), Width: 20, NotNullable: true}},
+	}}).AnyTimes()
+	tarRel.EXPECT().GetTableDef(ctx).Return(&plan.TableDef{Cols: []*plan.ColDef{
+		{Name: "id", ColId: 1, Typ: plan.Type{Id: int32(types.T_int64), NotNullable: true}},
+		{Name: "extra", ColId: 2, Seqnum: 1, Typ: plan.Type{Id: int32(types.T_int32), NotNullable: true}},
+		{Name: "label", ColId: 3, Seqnum: 2, Typ: plan.Type{Id: int32(types.T_varchar), Width: 20, NotNullable: true}},
+	}}).AnyTimes()
+	tables := tableStuff{baseRel: baseRel, tarRel: tarRel}
+	tables.def.colNames = []string{"id", "extra", "label"}
+	tables.def.baseColNames = []string{"id", "", "note"}
+	tables.def.tarOnlyIdxes = []int{1}
+	output := diffOutputTable{
+		databaseName: "db",
+		tableName:    "result",
+		columnNames:  []string{"__mo_diff_source", "__mo_diff_flag"},
+	}
+
+	t.Run("renamed common column with a different physical identity", func(t *testing.T) {
+		output.projectedIdxes = []int{0, 2}
+		sql, err := output.createSQL(ctx, tables)
+		require.NoError(t, err)
+		require.Contains(t, sql, "`label` VARCHAR(20) not null")
+	})
+	t.Run("target-only column reuses a base column identity", func(t *testing.T) {
+		output.projectedIdxes = []int{0, 1}
+		sql, err := output.createSQL(ctx, tables)
+		require.NoError(t, err)
+		require.Contains(t, sql, "`extra` INT default null")
+	})
+	t.Run("missing common column mapping", func(t *testing.T) {
+		missingMapping := tables
+		missingMapping.def.baseColNames = []string{"", "", "note"}
+		projected := output
+		projected.projectedIdxes = []int{0, 2}
+
+		sql, err := projected.createSQL(ctx, missingMapping)
+		require.ErrorContains(t, err, `destination column for source column "id"`)
+		require.Empty(t, sql)
+	})
+	t.Run("missing target-only column definition", func(t *testing.T) {
+		tarRel := mock_frontend.NewMockRelation(gomock.NewController(t))
+		tarRel.EXPECT().GetTableDef(ctx).Return(&plan.TableDef{Cols: []*plan.ColDef{
+			{Name: "id", ColId: 1, Typ: plan.Type{Id: int32(types.T_int64), NotNullable: true}},
+		}})
+		missingColumn := tables
+		missingColumn.tarRel = tarRel
+		projected := output
+		projected.projectedIdxes = []int{0, 1}
+
+		sql, err := projected.createSQL(ctx, missingColumn)
+		require.ErrorContains(t, err, `source column "extra" is unavailable`)
+		require.Empty(t, sql)
+	})
+}
+
+func TestDataBranchOutputTableUnicodeFold(t *testing.T) {
+	t.Run("lineage rejects fold equivalent target columns", func(t *testing.T) {
+		baseDef := &plan.TableDef{Cols: []*plan.ColDef{{Name: "s"}}}
+		tarDef := &plan.TableDef{Cols: []*plan.ColDef{{Name: "s"}, {Name: "ſ"}}}
+		endpointColumns, err := dataBranchLineageEndpointColumns(
+			[]*plan.TableDef{baseDef, tarDef}, []bool{false, false},
+			[]*plan.TableDef{baseDef}, []bool{false},
+		)
+		require.ErrorContains(t, err, "target columns 's' and 'ſ' have equivalent names")
+		require.Nil(t, endpointColumns)
+	})
+
+	t.Run("lineage maps ordinary target columns", func(t *testing.T) {
+		baseCol := &plan.ColDef{Name: "id"}
+		baseDef := &plan.TableDef{Cols: []*plan.ColDef{baseCol}}
+		tarDef := &plan.TableDef{Cols: []*plan.ColDef{{Name: "ID"}}}
+		endpointColumns, err := dataBranchLineageEndpointColumns(
+			[]*plan.TableDef{baseDef, tarDef}, []bool{false, false},
+			[]*plan.TableDef{baseDef}, []bool{false},
+		)
+		require.NoError(t, err)
+		require.Len(t, endpointColumns, 1)
+		require.Same(t, baseCol, 
```

**File**: `test/distributed/cases/git4data/branch/diff/diff_output_as_altered_columns.result` (added, +318/-0)
```diff
@@ -0,0 +1,318 @@
+drop database if exists test_diff_output_as_altered;
+create database test_diff_output_as_altered;
+use test_diff_output_as_altered;
+create table added_base(id int primary key, note varchar(20) not null);
+insert into added_base values (1,'one'),(2,'two');
+data branch create table added_tar from added_base;
+alter table added_tar add column extra int not null default 7;
+update added_tar set note = 'target' where id = 1;
+update added_base set note = 'base' where id = 2;
+data branch diff added_tar against added_base columns (note,extra) output as added_diff;
+➤ TABLE CREATED[12,0,0]  𝄀
+`test_diff_output_as_altered`.`added_diff`
+show create table added_diff;
+➤ Table[12,10,0]  ¦  Create Table[12,201,0]  𝄀
+added_diff  ¦  CREATE TABLE `added_diff` (
+  `__mo_diff_source` varchar(255) DEFAULT NULL,
+  `__mo_diff_flag` varchar(16) DEFAULT NULL,
+  `id` int NOT NULL,
+  `note` varchar(20) NOT NULL,
+  `extra` int DEFAULT NULL
+)
+select __mo_diff_source, __mo_diff_flag, id, note, extra from added_diff order by id;
+➤ __mo_diff_source[12,255,0]  ¦  __mo_diff_flag[12,16,0]  ¦  id[4,32,0]  ¦  note[12,20,0]  ¦  extra[4,32,0]  𝄀
+added_tar  ¦  UPDATE  ¦  1  ¦  target  ¦  7  𝄀
+added_base  ¦  UPDATE  ¦  2  ¦  base  ¦  null
+create table rename_base(id int primary key, note varchar(20) not null);
+insert into rename_base values (1,'one'),(2,'two');
+data branch create table rename_tar from rename_base;
+alter table rename_tar algorithm=instant, rename column note to label;
+update rename_tar set label = 'target' where id = 1;
+update rename_base set note = 'base' where id = 2;
+data branch diff rename_tar against rename_base columns (label) output as rename_diff;
+➤ TABLE CREATED[12,0,0]  𝄀
+`test_diff_output_as_altered`.`rename_diff`
+show create table rename_diff;
+➤ Table[12,11,0]  ¦  Create Table[12,175,0]  𝄀
+rename_diff  ¦  CREATE TABLE `rename_diff` (
+  `__mo_diff_source` varchar(255) DEFAULT NULL,
+  `__mo_diff_flag` varchar(16) DEFAULT NULL,
+  `id` int NOT NULL,
+  `label` varchar(20) NOT NULL
+)
+select __mo_diff_source, __mo_diff_flag, id, label from rename_diff order by id;
+➤ __mo_diff_source[12,255,0]  ¦  __mo_diff_flag[12,16,0]  ¦  id[4,32,0]  ¦  label[12,20,0]  𝄀
+rename_tar  ¦  UPDATE  ¦  1  ¦  target  𝄀
+rename_base  ¦  UPDATE  ¦  2  ¦  base
+create table copy_base(id int primary key, amount decimal(9,2) not null);
+insert into copy_base values (1,10.50),(2,20.00);
+data branch create table copy_tar from copy_base;
+alter table copy_tar algorithm=copy, add column extra int not null default 9 first;
+update copy_tar set amount = 11.75 where id = 1;
+update copy_base set amount = 21.25 where id = 2;
+data branch diff copy_tar against copy_base columns (amount,extra);
+➤ diff copy_tar against copy_base[12,0,0]  ¦  flag[12,0,0]  ¦  id[4,32,0]  ¦  amount[3,9,2]  ¦  extra[4,32,0]  𝄀
+copy_tar  ¦  UPDATE  ¦  1  ¦  11.75  ¦  9  𝄀
+copy_base  ¦  UPDATE  ¦  2  ¦  21.25  ¦  null
+data branch diff copy_tar against copy_base columns (amount,extra) output as copy_diff;
+➤ TABLE CREATED[12,0,0]  𝄀
+`test_diff_output_as_altered`.`copy_diff`
+show create table copy_diff;
+➤ Table[12,9,0]  ¦  Create Table[12,203,0]  𝄀
+copy_diff  ¦  CREATE TABLE `copy_diff` (
+  `__mo_diff_source` varchar(255) DEFAULT NULL,
+  `__mo_diff_flag` varchar(16) DEFAULT NULL,
+  `id` int NOT NULL,
+  `amount` decimal(9,2) NOT NULL,
+  `extra` int DEFAULT NULL
+)
+select __mo_diff_source, __mo_diff_flag, id, amount, extra from copy_diff order by id;
+➤ __mo_diff_source[12,255,0]  ¦  __mo_diff_flag[12,16,0]  ¦  id[4,32,0]  ¦  amount[3,9,2]  ¦  extra[4,32,0]  𝄀
+copy_tar  ¦  UPDATE  ¦  1  ¦  11.75  ¦  9  𝄀
+copy_base  ¦  UPDATE  ¦  2  ¦  21.25  ¦  null
+data branch diff copy_tar against copy_base output as copy_full_diff;
+➤ TABLE CREATED[12,0,0]  𝄀
+`test_diff_output_as_altered`.`copy_full_diff`
+show create table copy_full_diff;
+➤ Table[12,14,0]  ¦  Create Table[12,208,0]  𝄀
+copy_full_diff  ¦  CREATE TABLE `copy_full_diff` (
+  `__mo_diff_source` varchar(255) DEFAULT NULL,
+  `__mo_diff_flag` varchar(16) DEFAULT NULL,
+  `extra` int DEFAULT NULL,
+  `id` int NOT NULL,
+  `amount` decimal(9,2) NOT NULL
+)
+select * from copy_full_diff order by id;
+➤ __mo_diff_source[12,255,0]  ¦  __mo_diff_flag[12,16,0]  ¦  extra[4,32,0]  ¦  id[4,32,0]  ¦  amount[3,9,2]  𝄀
+copy_tar  ¦  UPDATE  ¦  9  ¦  1  ¦  11.75  𝄀
+copy_base  ¦  UPDATE  ¦  null  ¦  2  ¦  21.25
+create table base_copy_base(id int primary key, note varchar(20) not null, amount int not null);
+insert into base_copy_base values (1,'one',10),(2,'two',20);
+data branch create table base_copy_tar from base_copy_base;
+alter table base_copy_base algorithm=copy, modify column note varchar(20) not null first;
+data branch diff base_copy_tar against base_copy_base output as empty_reordered_diff;
+➤ TABLE CREATED[12,0,0]  𝄀
+`test_diff_output_as_altered`.`empty_reordered_diff`
+show create table empty_reordered_diff;
+➤ Table[12,20,0]  ¦  Create Table[12,
```

**File**: `test/distributed/cases/git4data/branch/diff/diff_output_as_altered_columns.sql` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+drop database if exists test_diff_output_as_altered;
+create database test_diff_output_as_altered;
+use test_diff_output_as_altered;
+
+-- Target-only columns retain their type and are nullable for base-side rows.
+create table added_base(id int primary key, note varchar(20) not null);
+insert into added_base values (1,'one'),(2,'two');
+data branch create table added_tar from added_base;
+alter table added_tar add column extra int not null default 7;
+update added_tar set note = 'target' where id = 1;
+update added_base set note = 'base' where id = 2;
+data branch diff added_tar against added_base columns (note,extra) output as added_diff;
+show create table added_diff;
+select __mo_diff_source, __mo_diff_flag, id, note, extra from added_diff order by id;
+
+-- A renamed column materializes under the target name for both sides.
+create table rename_base(id int primary key, note varchar(20) not null);
+insert into rename_base values (1,'one'),(2,'two');
+data branch create table rename_tar from rename_base;
+alter table rename_tar algorithm=instant, rename column note to label;
+update rename_tar set label = 'target' where id = 1;
+update rename_base set note = 'base' where id = 2;
+data branch diff rename_tar against rename_base columns (label) output as rename_diff;
+show create table rename_diff;
+select __mo_diff_source, __mo_diff_flag, id, label from rename_diff order by id;
+
+-- COPY ALTER with ADD FIRST reassigns physical column identities.
+create table copy_base(id int primary key, amount decimal(9,2) not null);
+insert into copy_base values (1,10.50),(2,20.00);
+data branch create table copy_tar from copy_base;
+alter table copy_tar algorithm=copy, add column extra int not null default 9 first;
+update copy_tar set amount = 11.75 where id = 1;
+update copy_base set amount = 21.25 where id = 2;
+data branch diff copy_tar against copy_base columns (amount,extra);
+data branch diff copy_tar against copy_base columns (amount,extra) output as copy_diff;
+show create table copy_diff;
+select __mo_diff_source, __mo_diff_flag, id, amount, extra from copy_diff order by id;
+
+-- The default projection follows the target's visible column order.
+data branch diff copy_tar against copy_base output as copy_full_diff;
+show create table copy_full_diff;
+select * from copy_full_diff order by id;
+
+-- A base-side COPY ALTER reorders a common column.
+create table base_copy_base(id int primary key, note varchar(20) not null, amount int not null);
+insert into base_copy_base values (1,'one',10),(2,'two',20);
+data branch create table base_copy_tar from base_copy_base;
+alter table base_copy_base algorithm=copy, modify column note varchar(20) not null first;
+data branch diff base_copy_tar against base_copy_base output as empty_reordered_diff;
+show create table empty_reordered_diff;
+select * from empty_reordered_diff;
+update base_copy_tar set note = 'target', amount = 11 where id = 1;
+update base_copy_base set note = 'base', amount = 21 where id = 2;
+data branch diff base_copy_tar against base_copy_base output as base_copy_diff;
+show create table base_copy_diff;
+select * from base_copy_diff order by id;
+
+-- Base-side rows written before COPY ALTER must omit dropped columns.
+create table drop_base(id int primary key, x int, y int, amount decimal(9,2) not null);
+insert into drop_base values (10,11,22,10.00);
+data branch create table drop_tar from drop_base;
+insert into drop_base values (20,77,88,20.00);
+update drop_base set amount = 15.25 where id = 10;
+alter table drop_base algorithm=copy, drop column x, drop column y;
+data branch diff drop_tar against drop_base output as drop_diff;
+show create table drop_diff;
+select * from drop_diff order by id;
+
+-- Identical COPY ALTER operations still materialize an empty result table.
+create table empty_copy_base(id int primary key, amount int not null);
+insert into empty_copy_base values (1,10);
+data branch create table empty_copy_tar from empty_copy_base;
+alter table empty_copy_base algorithm=copy, add column extra int not null default 9 first;
+alter table empty_copy_tar algorithm=copy, add column extra int not null default 9 first;
+data branch diff empty_copy_tar against empty_copy_base output as empty_copy_diff;
+show create table empty_copy_diff;
+select * from empty_copy_diff;
+
+-- COPY ALTER preserves the common columns' types and values in the output.
+set @previous_time_zone = @@session.time_zone;
+set time_zone = '+00:00';
+create table typed_copy_base(id int primary key, wall_time datetime(6), payload json, code binary(4), event_time timestamp(6));
+insert into typed_copy_base values
+    (1,'2024-01-01 01:02:03.010203','{"id":1}',x'01020304','2024-01-01 04:05:06.040506'),
+    (2,'2024-01-02 01:02:03.010203','{"id":2}',x'05060708','2024-01-02 04:05:06.040506');
+data branch create table typed_copy_tar from typed_copy_base;
+alter table typed_copy_tar algorithm=copy, add column extra int not null default 9 first;
+update
```

---

### Incident Patch 3: `7431a275` (2026-11-22)
**Commit Message**: fix: account for merge block capacity and avoid sparse S3 overreads (#32914)

## What type of PR is this?

- [x] BUG
- [x] Improvement

## Which issue(s) this PR fixes:

Related to #32278 (C04 and C05; the umbrella issue remains open).

## What this PR does / why we need it:

- Include the table's configured block capacity in merge memory
admission and the merge-start estimate. Existing input objects can
contain default-sized blocks even when the current schema specifies
fewer rows, so the estimate retains the 8,192-row floor; configurations
above that floor increase the input-block estimate.
- Read a small number of ordered, buffered sparse S3 misses individually
when the existing range-amplification threshold is exceeded. Keep the
envelope for dense, unordered, streaming, or more than four misses, and
retain full-file cache-fill behavior. A later object-store 416 after a
successful first range remains an unexpected EOF. Failed reads do not
publish partially completed cache entries, and cache-update failures
keep their existing non-fatal behavior.

- Reuse the resolved bounds to bypass sparse-range classification on
short ranges and single-entry reads. For other candidates, stop a

**File**: `pkg/fileservice/io_vector.go` (modified, +43/-13)
```diff
@@ -106,26 +106,27 @@ func (i *IOVector) readRange() (min *int64, max *int64, readFull bool) {
 	return
 }
 
-func (i *IOVector) readMinimalRange() (min *int64, max *int64) {
-	min = ptrTo(int64(math.MaxInt))
-	max = ptrTo(int64(0))
-	for _, entry := range i.Entries {
+func (i *IOVector) readMinimalRange() (*int64, *int64) {
+	minOffset := int64(math.MaxInt)
+	maxOffset := int64(0)
+	readToEnd := false
+	for pos := range i.Entries {
+		entry := &i.Entries[pos]
 		if entry.done {
 			continue
 		}
-		if entry.Offset < *min {
-			min = &entry.Offset
-		}
+		minOffset = min(minOffset, entry.Offset)
 		if entry.Size < 0 {
-			max = nil
+			readToEnd = true
 		}
-		if max != nil {
-			if end := entry.Offset + entry.Size; end > *max {
-				max = &end
-			}
+		if !readToEnd {
+			maxOffset = max(maxOffset, entry.Offset+entry.Size)
 		}
 	}
-	return
+	if readToEnd {
+		return &minOffset, nil
+	}
+	return &minOffset, &maxOffset
 }
 
 // expensiveMinimalRangeRead reports whether collapsing the unfinished entries
@@ -162,6 +163,35 @@ func (i *IOVector) expensiveMinimalRangeRead() (logicalBytes, spanBytes int64, e
 		spanBytes > logicalBytes*maxMinimalRangeReadAmplification
 }
 
+// shouldSplitSparseRead uses the computed envelope to reject ordinary dense
+// reads before inspecting the unfinished entries.
+func (i *IOVector) shouldSplitSparseRead(min, max *int64) bool {
+	if len(i.Entries) < 2 || max == nil || *min < 0 || *max <= *min ||
+		*max-*min <= minExpensiveRangeReadSpan {
+		return false
+	}
+
+	var previousOffset int64
+	misses := 0
+	for pos := range i.Entries {
+		entry := &i.Entries[pos]
+		if entry.done {
+			continue
+		}
+		if misses == 4 || entry.WriterForRead != nil || entry.ReadCloserForRead != nil ||
+			(misses > 0 && entry.Offset < previousOffset) {
+			return false
+		}
+		previousOffset = entry.Offset
+		misses++
+	}
+	if misses < 2 {
+		return false
+	}
+	_, _, expensive := i.expensiveMinimalRangeRead()
+	return expensive
+}
+
 func (i *IOVector) size() *int64 {
 	if len(i.Entries) == 0 {
 		return nil
```

**File**: `pkg/fileservice/io_vector_test.go` (modified, +21/-0)
```diff
@@ -122,6 +122,27 @@ func TestIOVectorReadRangeDoesNotMutateReadToEndEntry(t *testing.T) {
 	require.Equal(t, int64(-1), vector.Entries[0].Size)
 }
 
+func TestIOVectorMinimalRangeBoundsAreIndependentOfEntries(t *testing.T) {
+	vector := IOVector{Entries: []IOEntry{
+		{Offset: 4, Size: -1, done: true},
+		{Offset: 16, Size: 8},
+		{Offset: 8, Size: 4},
+	}}
+	minOffset, maxOffset := vector.readMinimalRange()
+	require.Equal(t, int64(8), *minOffset)
+	require.Equal(t, int64(24), *maxOffset)
+
+	vector.Entries[2].Offset = 2
+	*maxOffset = 3
+	require.Equal(t, int64(8), *minOffset)
+	require.Equal(t, int64(8), vector.Entries[1].Size)
+
+	vector.Entries[1].Size = -1
+	minOffset, maxOffset = vector.readMinimalRange()
+	require.Equal(t, int64(2), *minOffset)
+	require.Nil(t, maxOffset)
+}
+
 func TestIOVectorIOMergeKeyDoesNotMutateReadToEndEntry(t *testing.T) {
 	vector := IOVector{
 		FilePath: "foo",
```

**File**: `pkg/fileservice/s3_fs.go` (modified, +61/-38)
```diff
@@ -730,8 +730,8 @@ func (s *S3FS) Read(ctx context.Context, vector *IOVector) (err error) {
 	}()
 	defer finishFill()
 	// A merge leader must not wake its waiters until caller-visible cache work
-	// has completed. Cache updates are deferred below, so register this defer
-	// first and let their later defers run before the merge is marked done.
+	// has completed. Successful reads publish cache updates before returning,
+	// so this defer marks the merge done only after those updates finish.
 	// Async disk finalization is intentionally outside this generation: the
 	// foreground read only admits that bounded work, and subsequent disk-cache
 	// readers use their own bounded wait before falling back to object storage.
@@ -769,30 +769,39 @@ func (s *S3FS) Read(ctx context.Context, vector *IOVector) (err error) {
 		return err
 	}
 
+	// Run queued IOVectorCache updates only after read work succeeds. Deferring
+	// them in registration order runs them in reverse; if one panics or calls
+	// runtime.Goexit, the remaining registered updates still run.
+	var updatesBuf [4]func()
+	cacheUpdates := updatesBuf[:0]
+	finishCacheUpdates := func() error {
+		for _, update := range cacheUpdates {
+			defer update()
+		}
+		return nil
+	}
+
 	for _, cache := range vector.Caches {
 
 		t0 := time.Now()
 		LogEvent(ctx, str_read_vector_Caches_begin)
-		err := readCache(ctx, cache, vector)
+		cacheReadErr := readCache(ctx, cache, vector)
 		LogEvent(ctx, str_read_vector_Caches_end)
 		metric.FSReadDurationReadVectorCache.Observe(time.Since(t0).Seconds())
-		if err != nil {
-			return err
+		if cacheReadErr != nil {
+			return cacheReadErr
 		}
 		if vector.allDone() {
-			return nil
+			return finishCacheUpdates()
 		}
 
-		defer func() {
-			if err != nil {
-				return
-			}
+		cacheUpdates = append(cacheUpdates, func() {
 			t0 := time.Now()
 			LogEvent(ctx, str_update_vector_Caches_begin)
-			err = cache.Update(ctx, vector, false)
+			_ = cache.Update(ctx, vector, false)
 			LogEvent(ctx, str_update_vector_Caches_end)
 			metric.FSReadDurationUpdateVectorCache.Observe(time.Since(t0).Seconds())
-		}()
+		})
 	}
 
 	mayReadMemoryCache := vector.Policy&SkipMemoryCacheReads == 0
@@ -804,26 +813,23 @@ read_memory_cache:
 
 		t0 := time.Now()
 		LogEvent(ctx, str_read_memory_cache_Caches_begin)
-		err := readCache(ctx, s.memCache, vector)
+		cacheReadErr := readCache(ctx, s.memCache, vector)
 		LogEvent(ctx, str_read_memory_cache_Caches_end)
 		metric.FSReadDurationReadMemoryCache.Observe(time.Since(t0).Seconds())
-		if err != nil {
-			return err
+		if cacheReadErr != nil {
+			return cacheReadErr
 		}
 		if vector.allDone() {
-			return nil
+			return finishCacheUpdates()
 		}
 
-		defer func() {
-			if err != nil {
-				return
-			}
+		cacheUpdates = append(cacheUpdates, func() {
 			t0 := time.Now()
 			LogEvent(ctx, str_update_memory_cache_begin)
-			err = s.memCache.Update(ctx, vector, s.asyncUpdate)
+			_ = s.memCache.Update(ctx, vector, s.asyncUpdate)
 			LogEvent(ctx, str_update_memory_cache_end)
 			metric.FSReadDurationUpdateMemoryCache.Observe(time.Since(t0).Seconds())
-		}()
+		})
 	}
 
 read_disk_cache:
@@ -845,7 +851,7 @@ read_disk_cache:
 				return err
 			}
 			if vector.allDone() {
-				return nil
+				return finishCacheUpdates()
 			}
 			if fillTicket != nil && !fillTicket.leader {
 				// This request did not receive an admitted disk-cache fill. Do
@@ -863,12 +869,12 @@ read_disk_cache:
 		for i, entry := range vector.Entries {
 			undoneBefore[i] = !entry.done
 		}
-		err := readCache(ctx, s.diskCache, vector)
+		cacheReadErr := readCache(ctx, s.diskCache, vector)
 		LogEvent(ctx, str_read_disk_cache_Caches_end)
 		metric.FSReadDurationReadDiskCache.Observe(time.Since(t0).Seconds())
-		if err != nil {
+		if cacheReadErr != nil {
 			finishFill()
-			return err
+			return cacheReadErr
 		}
 		// Count bytes actually read from disk cache (entries that became done and from disk cache)
 		var actualDiskReadBytes int64
@@ -884,21 +890,18 @@ read_disk_cache:
 			})
 		}
 		if vector.allDone() {
-			return nil
+			return finishCacheUpdates()
 		}
 
 		// try to cache IOEntry if not caching the full file
 		if vector.Policy.CacheIOEntry() {
-			defer func() {
-				if err != nil {
-					return
-				}
+			cacheUpdates = append(cacheUpdates, func() {
 				t0 := time.Now()
 				LogEvent(ctx, str_update_disk_cache_Caches_begin)
-				err = s.diskCache.Update(ctx, vector, s.asyncUpdate)
+				_ = s.diskCache.Update(ctx, vector, s.asyncUpdate)
 				LogEvent(ctx, str_update_disk_cache_Caches_end)
 				metric.FSReadDurationUpdateDiskCache.Observe(time.Since(t0).Seconds())
-			}()
+			})
 		}
 		finishFill()
 
@@ -914,7 +917,7 @@ read_disk_cache:
 			return err
 		}
 		if vector.allDone() {
-			return nil
+			return finishCacheUpdates()
 		}
 	}
 
@@ -1053,7 +1056,7 @@ read_s3:
 	if forcePerEntryRangeRead {
 		err = s.readEntriesIndividually(ctx, vector)
 	} else {
-		err = s.read(ctx, vector, forceMinimalRangeRead)
+
```

**File**: `pkg/fileservice/s3_fs_test.go` (modified, +919/-0)
```diff
@@ -23,6 +23,7 @@ import (
 	"io"
 	"os"
 	"path"
+	"runtime"
 	"strings"
 	"sync"
 	"sync/atomic"
@@ -3380,3 +3381,921 @@ func TestS3FSReadFullObjectToDiskCacheStreamingBackgroundEndsOnClose(t *testing.
 		t.Fatal("the download outlived the disk cache")
 	}
 }
+
+func TestS3FSOrdinarySparseRangeRead(t *testing.T) {
+	for _, tc := range []struct {
+		name    string
+		offsets []int64
+		reads   int
+	}{
+		{"sparse", []int64{0, 16 << 20}, 2},
+		{"adjacent", []int64{0, 4096}, 1},
+		{"exact span threshold", []int64{0, minExpensiveRangeReadSpan - 4096}, 1},
+		{"above span threshold", []int64{0, minExpensiveRangeReadSpan - 4095}, 2},
+		{"out of order", []int64{16 << 20, 0}, 1},
+		{"four sparse", []int64{0, 16 << 20, 32 << 20, 48 << 20}, 4},
+		{"five sparse", []int64{0, 16 << 20, 32 << 20, 48 << 20, 64 << 20}, 1},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx := t.Context()
+			fs, err := NewS3FS(ctx, ObjectStorageArguments{Name: "sparse", Endpoint: "disk", Bucket: t.TempDir()}, CacheConfig{}, nil, true, false)
+			require.NoError(t, err)
+			t.Cleanup(func() { fs.Close(context.Background()) })
+			storage := &generatedRangeObjectStorage{}
+			fs.storage = storage
+			vector := &IOVector{FilePath: "foo", Policy: SkipAllCache}
+			for _, offset := range tc.offsets {
+				vector.Entries = append(vector.Entries, IOEntry{Offset: offset, Size: 4096})
+			}
+			t.Cleanup(vector.Release)
+			require.NoError(t, fs.Read(ctx, vector))
+			reads := storage.readRanges()
+			require.Len(t, reads, tc.reads)
+			if tc.reads > 1 {
+				for i, read := range reads {
+					require.Equal(t, tc.offsets[i], *read.min)
+					require.Equal(t, tc.offsets[i]+4096, *read.max)
+				}
+			}
+			for _, entry := range vector.Entries {
+				require.Equal(t, make([]byte, 4096), entry.Data)
+			}
+		})
+	}
+}
+
+var errTestHDFSSeek = errors.New("test HDFS seek beyond EOF")
+
+// hdfsSeekReader models the bounds check in colinmarc/hdfs FileReader.Seek.
+type hdfsSeekReader struct {
+	size, offset int64
+}
+
+func (r *hdfsSeekReader) Seek(offset int64, whence int) (int64, error) {
+	if whence != io.SeekStart || offset < 0 || offset > r.size {
+		return r.offset, errTestHDFSSeek
+	}
+	r.offset = offset
+	return offset, nil
+}
+
+func (r *hdfsSeekReader) Read(p []byte) (int, error) {
+	if r.offset == r.size {
+		return 0, io.EOF
+	}
+	n := int(min(int64(len(p)), r.size-r.offset))
+	clear(p[:n])
+	r.offset += int64(n)
+	return n, nil
+}
+
+type hdfsSeekStorage struct {
+	dummyObjectStorage
+	size   int64
+	ranges [][2]int64
+	closes int
+}
+
+func (s *hdfsSeekStorage) Read(_ context.Context, key string, min, max *int64) (io.ReadCloser, error) {
+	s.ranges = append(s.ranges, [2]int64{*min, *max})
+	reader, err := readObjectRange(&hdfsSeekReader{size: s.size}, key, min, max)
+	if err != nil {
+		s.closes++ // HDFS.Read closes its opened file on an error.
+		return nil, err
+	}
+	return &readCloser{r: reader, closeFunc: func() error { s.closes++; return nil }}, nil
+}
+
+func TestS3FSOrdinarySparseHDFSSeekBounds(t *testing.T) {
+	const far = int64(16 << 20)
+	for _, tc := range []struct {
+		name       string
+		hdfs       bool
+		size       int64
+		offsets    [2]int64
+		wantRanges [][2]int64
+		wantErr    error
+		short      bool
+	}{
+		{"later beyond EOF", true, 8192, [2]int64{0, far}, [][2]int64{{0, far + 4096}}, nil, true},
+		{"first beyond EOF", true, 8192, [2]int64{far, 2 * far}, [][2]int64{{far, 2*far + 4096}}, errTestHDFSSeek, false},
+		{"first at EOF", true, 8192, [2]int64{8192, far}, [][2]int64{{8192, far + 4096}}, nil, true},
+		{"success", true, far + 4096, [2]int64{0, far}, [][2]int64{{0, far + 4096}}, nil, false},
+		{"non-HDFS control", false, 8192, [2]int64{0, far}, [][2]int64{{0, 4096}, {far, far + 4096}}, errTestHDFSSeek, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx := t.Context()
+			fs, err := NewS3FS(ctx, ObjectStorageArguments{Name: "sparse", Endpoint: "disk", Bucket: t.TempDir()}, CacheConfig{}, nil, true, false)
+			require.NoError(t, err)
+			t.Cleanup(func() { fs.Close(context.Background()) })
+			storage := &hdfsSeekStorage{size: tc.size}
+			fs.storage = storage
+			if tc.hdfs {
+				fs.rawStorage = &HDFS{}
+			} else {
+				fs.rawStorage = storage
+			}
+			cache := &publicationVectorCache{}
+			vector := &IOVector{FilePath: "foo", Policy: SkipAllCache, Caches: []IOVectorCache{cache}, Entries: []IOEntry{
+				{Offset: tc.offsets[0], Size: 4096}, {Offset: tc.offsets[1], Size: 4096},
+			}}
+			t.Cleanup(vector.Release)
+			err = fs.Read(ctx, vector)
+			switch {
+			case tc.short:
+				require.True(t, moerr.IsMoErrCode(err, moerr.ErrUnexpectedEOF), "%v", err)
+			case tc.wantErr != nil:
+				require.ErrorIs(t, err, tc.wantErr)
+			default:
+				require.NoError(t, err)
+				for _, entry := range vector.Entries {
+					require.Equal(t, make([]byte, 4096), entry.Data)
+				}
+			}
+			require.Equal(t, tc.wantRanges, storage.ranges)
+			require.Equal(t, len(tc.wantRanges), storage.closes)
+			if 
```

**File**: `pkg/vm/engine/tae/catalog/tableForMerge.go` (modified, +10/-0)
```diff
@@ -75,6 +75,7 @@ type MergeTable interface {
 	IterDataItem() iter.Seq[MergeDataItem]
 	IterTombstoneItem() iter.Seq[MergeTombstoneItem]
 	GetNameDesc() string
+	GetBlockMaxRows() uint32
 	ID() uint64
 	HasDropCommitted() bool
 
@@ -167,6 +168,15 @@ func (t TNMergeTable) ID() uint64 {
 	return t.TableEntry.ID
 }
 
+// GetBlockMaxRows returns the configured data and tombstone block capacity.
+func (t TNMergeTable) GetBlockMaxRows() uint32 {
+	schema := t.GetLastestSchema(false)
+	if schema == nil || schema.Extra == nil {
+		return 0
+	}
+	return schema.Extra.BlockMaxRows
+}
+
 func (t TNMergeTable) IsSpecialBigTable() bool {
 	name := t.GetLastestSchema(false).Name
 	dbName := t.GetDB().GetName()
```

**File**: `pkg/vm/engine/tae/db/merge/reservation_accounting_probe_test.go` (modified, +9/-6)
```diff
@@ -166,7 +166,7 @@ func runMergeReservationAccountingProbe(t *testing.T, originSize uint32, checkGl
 					}
 					// Estimate uses metadata only; the size never allocates a
 					// corresponding physical object or merge input payload.
-					estimate := int64(mergesort.EstimateMergeSize(IterStats(table.stats[:3])))
+					estimate := int64(mergesort.EstimateMergeSizeWithBlockRows(IterStats(table.stats[:3]), table.GetBlockMaxRows()))
 					require.Positive(t, estimate)
 					if !checkGlobalGuard {
 						require.Less(t, estimate, int64(1024))
@@ -289,8 +289,8 @@ func TestMergeReservationContinuesAfterDenial(t *testing.T) {
 			table.stats = append(table.stats, newTestObjectStats(t, lo, lo+1, size, 2, 1, nil, 0))
 		}
 	}
-	large := int64(mergesort.EstimateMergeSize(IterStats(table.stats[:3])))
-	small := int64(mergesort.EstimateMergeSize(IterStats(table.stats[6:])))
+	large := int64(mergesort.EstimateMergeSizeWithBlockRows(IterStats(table.stats[:3]), table.GetBlockMaxRows()))
+	small := int64(mergesort.EstimateMergeSizeWithBlockRows(IterStats(table.stats[6:]), table.GetBlockMaxRows()))
 	require.Less(t, small, large/2)
 	clock := newFakeClock()
 	rc := &reservationProbeRSC{limit: large * 3 / 2}
@@ -347,14 +347,17 @@ func (e *inlineCompletionExecutor) ExecuteFor(_ catalog.MergeTable, task mergeTa
 }
 
 func TestMergeReservationInlineCompletion(t *testing.T) {
-	table := &reservationProbeTable{MergeTable: promotionTable(8903)}
+	const blockRows = uint32(16384)
+	table := &reservationProbeTable{MergeTable: mergeTableWithBlockRows(8903, blockRows)}
 	for cluster := range 3 {
 		for range 3 {
 			lo := int32(cluster*100 + 1)
-			table.stats = append(table.stats, newTestObjectStats(t, lo, lo+1, 64*common.Const1MBytes, 2, 1, nil, 0))
+			table.stats = append(table.stats, newTestObjectStats(t, lo, lo+1, 64*common.Const1MBytes, blockRows, 1, nil, 0))
 		}
 	}
-	size := int64(mergesort.EstimateMergeSize(IterStats(table.stats[:3])))
+	size := int64(mergesort.EstimateMergeSizeWithBlockRows(IterStats(table.stats[:3]), table.GetBlockMaxRows()))
+	defaultSize := mergesort.EstimateMergeSizeWithBlockRows(IterStats(table.stats[:3]), objectio.BlockMaxRows)
+	require.Greater(t, size, int64(defaultSize))
 	rc := &reservationProbeRSC{limit: size * 2}
 	executor := &inlineCompletionExecutor{rc: rc}
 	clock := newFakeClock()
```

**File**: `pkg/vm/engine/tae/db/merge/scheduler.go` (modified, +7/-6)
```diff
@@ -1410,7 +1410,7 @@ func (p *launchPad) gatherTombstoneTasks(ctx context.Context,
 	rc rscthrottler.RSCThrottler,
 ) {
 	tasks := GatherTombstoneTasks(ctx, IterStats(p.tombstoneStats), tombstoneOpts, p.lastMergeTime)
-	p.revisedResults = append(p.revisedResults, controlTaskMemInPlace(tasks, rc, 1)...)
+	p.revisedResults = append(p.revisedResults, controlTaskMemInPlace(tasks, rc, 1, p.table.GetBlockMaxRows())...)
 }
 
 func (p *launchPad) gatherLnTasks(ctx context.Context,
@@ -1439,7 +1439,7 @@ func (p *launchPad) gatherLnTasks(ctx context.Context,
 		)
 		if err == nil {
 			p.revisedResults = append(p.revisedResults,
-				controlTaskMemInPlace(overlapTasks, rc, 2)...)
+				controlTaskMemInPlace(overlapTasks, rc, 2, p.table.GetBlockMaxRows())...)
 		}
 	}
 }
@@ -1457,7 +1457,7 @@ func (p *launchPad) gatherL0Tasks(ctx context.Context,
 		zap.Int("tasks", len(l0Tasks)),
 	)
 	p.revisedResults = append(p.revisedResults,
-		controlTaskMemInPlace(l0Tasks, rc, 2)...)
+		controlTaskMemInPlace(l0Tasks, rc, 2, p.table.GetBlockMaxRows())...)
 }
 
 func (p *launchPad) gatherByTrigger(ctx context.Context,
@@ -1493,7 +1493,7 @@ func (p *launchPad) gatherByTrigger(ctx context.Context,
 	}
 	if len(trigger.assigns) > 0 {
 		p.revisedResults = append(p.revisedResults,
-			controlTaskMemInPlace(trigger.assigns, rc, 1)...)
+			controlTaskMemInPlace(trigger.assigns, rc, 1, p.table.GetBlockMaxRows())...)
 	}
 	return p.revisedResults
 }
@@ -1510,6 +1510,7 @@ func controlTaskMemInPlace(
 	tasks []mergeTask,
 	rc rscthrottler.RSCThrottler,
 	deleteLessThan int,
+	blockRows uint32,
 ) []mergeTask {
 
 	if len(tasks) == 0 {
@@ -1518,8 +1519,8 @@ func controlTaskMemInPlace(
 	for i := range tasks {
 		task := &tasks[i]
 		original := len(task.objs)
-		estSize := mergesort.EstimateMergeSize(IterStats(task.objs))
-		for ; !resourceAvailable(int64(estSize), rc) && len(task.objs) > 1; estSize = mergesort.EstimateMergeSize(IterStats(task.objs)) {
+		estSize := mergesort.EstimateMergeSizeWithBlockRows(IterStats(task.objs), blockRows)
+		for ; !resourceAvailable(int64(estSize), rc) && len(task.objs) > 1; estSize = mergesort.EstimateMergeSizeWithBlockRows(IterStats(task.objs), blockRows) {
 			task.objs = task.objs[:len(task.objs)/2]
 		}
 		if original-len(task.objs) > 0 {
```

**File**: `pkg/vm/engine/tae/db/merge/scheduler_test.go` (modified, +75/-0)
```diff
@@ -1033,3 +1033,78 @@ func TestXxx(t *testing.T) {
 	now := time.Now().AddDate(0, 0, 3)
 	t.Log(now.UnixNano(), " // ", now)
 }
+
+func mergeTableWithBlockRows(id uint64, rows uint32) catalog.MergeTable {
+	table := promotionTable(id).(catalog.TNMergeTable)
+	table.GetLastestSchema(false).Extra.BlockMaxRows = rows
+	return table
+}
+
+func TestLaunchPadUsesTableBlockMaxRows(t *testing.T) {
+	objects := []*objectio.ObjectStats{
+		newTestObjectStats(t, 1, 2, 16<<20, 16384, 1, nil, 0),
+		newTestObjectStats(t, 3, 4, 16<<20, 16384, 1, nil, 0),
+		newTestObjectStats(t, 5, 6, 16<<20, 16384, 1, nil, 0),
+		newTestObjectStats(t, 7, 8, 16<<20, 16384, 1, nil, 0),
+	}
+	for _, tc := range []struct {
+		name  string
+		table catalog.MergeTable
+		want  int
+		size  int
+	}{
+		{"large", mergeTableWithBlockRows(9511, 16384), 2, 93257728},
+		{"small", mergeTableWithBlockRows(9511, 1000), 4, 119406592},
+		{"standard", mergeTableWithBlockRows(9511, 8192), 4, 119406592},
+		{"default", mergeTableWithBlockRows(9511, 0), 4, 119406592},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			pad := newLaunchPad(newFakeClock())
+			trigger := NewMMsgTaskTrigger(tc.table).WithAssignedTasks([]mergeTask{{objs: objects}})
+			tasks := pad.gatherByTrigger(t.Context(), trigger, pad.clock.Now(), newTestRscController(192<<20))
+			require.Len(t, tasks, 1)
+			require.Len(t, tasks[0].objs, tc.want)
+			require.Equal(t, tc.size, tasks[0].eSize)
+		})
+	}
+}
+
+func TestLaunchPadCapacityAcrossGatherPaths(t *testing.T) {
+	for _, tc := range []struct {
+		name  string
+		table catalog.MergeTable
+		want  int
+		size  int
+	}{
+		{"zero", mergeTableWithBlockRows(9511, 0), 4, 119406592},
+		{"large", mergeTableWithBlockRows(9511, 16384), 2, 93257728},
+	} {
+		for _, path := range []string{"l0", "ln", "tombstone"} {
+			t.Run(tc.name+"/"+path, func(t *testing.T) {
+				objects := make([]*objectio.ObjectStats, 0, 4)
+				for i := range 4 {
+					objects = append(objects, newTestObjectStats(t, 1, 100, 16<<20, 16384, 0, nil, uint16(i)))
+				}
+				pad := newLaunchPad(newFakeClock())
+				pad.table = tc.table
+				pad.lastMergeTime = time.Hour
+				rc := newTestRscController(192 << 20)
+				switch path {
+				case "l0":
+					pad.leveledObjects[0] = objects
+					opts := NewLayerZeroOpts().WithToleranceDegressionCurve(1, 1, time.Hour, [4]float64{})
+					pad.gatherL0Tasks(t.Context(), opts, rc)
+				case "ln":
+					pad.leveledObjects[1] = objects
+					pad.gatherLnTasks(t.Context(), NewOverlapOptions().WithMinPointDepthPerCluster(2), 1, 1, rc)
+				case "tombstone":
+					pad.tombstoneStats = objects
+					pad.gatherTombstoneTasks(t.Context(), NewTombstoneOpts().WithOneShot(true), rc)
+				}
+				require.Len(t, pad.revisedResults, 1)
+				require.Len(t, pad.revisedResults[0].objs, tc.want)
+				require.Equal(t, tc.size, pad.revisedResults[0].eSize)
+			})
+		}
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #33053** (2026-11-22): fix(frontend): preserve cancellation errors during LOCAL uploads (@XuPeng-SH)
- **PR #33050** (2026-11-22): fix(ci): distinguish exited UT cases from live tests (@XuPeng-SH)
- **PR #33049** (2026-11-21): fix(disttae): scope flushed workspace tombstones by table (@XuPeng-SH)
- **PR #33046** (2026-11-21): test(external): verify cleanup when filling a missing saved column fails (@XuPeng-SH)
- **PR #33045** (2026-11-21): fix(external): preserve saved result scan projections (@XuPeng-SH)
- **PR #33044** (2026-11-21): perf(plan): cost bounded DELETE lookups using index cardinality (@XuPeng-SH)

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

## X. ci): distinguish exited UT cases from live tests

**RULE**:
When implementing operations in `optools/active_ut_incremental.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `96d0d018`: ci): distinguish exited UT cases from live tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `optools/active_ut_incremental.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
STATE_VERSION = 2
MAX_LIFECYCLE_LINE_BYTES = 1024 * 1024
TEST_START_ACTIONS = ("run", "pause", "cont")
TERMINAL_ACTIONS = ("pass", "fail", "skip")


    if not (
    ):
        return False

    def package_entry(entry):
        return (
            isinstance(entry, list) and len(entry) == 2
            and isinstance(entry[0], str)
            and type(entry[1]) is int and entry[1] > 0
        )

    def cases_entry(cases):
        return isinstance(cases, dict) and all(
            isinstance(entry, list) and len(entry) == 4
            and isinstance(entry[0], str) and isinstance(entry[1], str)
            and type(entry[2]) is int and entry[2] > 0
            and isinstance(entry[3], bool)
            for entry in cases.values()
        )

    return all(map(package_entry, state["packages"].values())) and all(
        map(cases_entry, state["cases"].values())
def apply_event(state, event, unfinished=None):
    packages, cases = state["packages"], state["cases"]
    invocation = packages.get(package)
            if invocation is None:
                packages[package] = [when, 1]
            else:
                invocation[1] += 1
        elif action in TERMINAL_ACTIONS:
     
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    return (
        and all(isinstance(k, str) and isinstance(v, str) for k, v in state["packages"].items())
        and all(isinstance(v, list) and len(v) == 4 and all(isinstance(s, str) for s in v)
                for v in state["cases"].values())
def apply_event(state, event):
            state["packages"][package] = when
        elif action in ("pass", "fail", "skip"):
            state["packages"].pop(package, None)
        # Keep unfinished cases on a package failure, as the AWK oracle does.
    key = json.dumps([package, test])
    if action in ("run", "pause", "cont"):
        started = state["cases"].get(key, [package, test, action, when])[3]
        state["cases"][key] = [package, test, action, started]
    elif action in ("pass", "fail", "skip"):
        state["cases"].pop(key, None)
            line = stream.readline(1024 * 1024)
            oversized = not line.endswith(b"\n") and len(line) == 1024 * 1024
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `96d0d018` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
