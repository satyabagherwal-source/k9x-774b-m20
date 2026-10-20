> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `3d78d840`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T00:12:52.854Z  
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
> **Harvest Timestamp**: 2026-10-20T00:12:52.844Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2056 stars

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

### Core Architecture Module: `clients/python/matrixone/_utils.py`
```
"""Shared internal utilities for MatrixOne SDK modules."""

from typing import Union, Type

try:
    from sqlalchemy.orm import DeclarativeMeta as _unused  # noqa: F401

    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


def get_table_name(table: Union[str, Type]) -> str:
    """Extract table name from string or ORM model.

    Supports:
    - "table_name"
    - "db.table_name"
    - ORM model with optional __table_args__['schema'] for db.table
    """
    if isinstance(table, str):
        return table
    if SQLALCHEMY_AVAILABLE and hasattr(table, '__tablename__'):
        name = table.__tablename__
        if hasattr(table, '__table_args__'):
            args = table.__table_args__
            if isinstance(args, dict) and 'schema' in args:
                return f"{args['schema']}.{name}"
        return name
    raise ValueError(f"Invalid table parameter: {table}. Expected string or ORM model.")


def require_non_empty(value: str, param_name: str) -> str:
    """Validate that a string parameter is non-empty."""
    if not value:
        raise ValueError(f"{param_name} must be a non-empty string")
    return value

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
from typing import Callable, List, Optional, Union

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine


class ConnectionAction(Enum):
    """Predefined connection actions that can be executed after connecting"""

    ENABLE_IVF = "enable_ivf"
    ENABLE_HNSW = "enable_hnsw"
    ENABLE_FULLTEXT = "enable_fulltext"
    ENABLE_VECTOR = "enable_vector"  # Enables both IVF and HNSW
    ENABLE_ALL = "enable_all"  # Enables all features


class ConnectionHook:
    """Connection hook that executes actions after successful connection"""

    def __init__(self, actions: Optional[List[Union[ConnectionAction, str]]] = None, custom_hook: Optional[Callable] = None):
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
        self._executed_connections = set()  # Track which connections have executed the hook

    def set_client(self, client):
        """Set the client reference for this hook"""
        self._client_ref = client

    def attach_to_engine(self, engine: Union[Engine, AsyncEngine]):
        """Attach this hook to a SQLAlchemy engine to listen for connection events"""
        if isinstance(engine, AsyncEngine):
            # For async engines, listen to both connect and before_cursor_execute events
            event.listen(engine.sync_engine, "connect", self._on_connect_sync)
            event.listen(engine.sync_engine, "before_cursor_execute", self._on_before_cursor_execute)
            if hasattr(self._client_ref, 'logger'):
                self._client_ref.logger.debug("Attached connection hook to async engine")
        else:
            # For sync engines, listen to both connect and before_cursor_execute events
            event.listen(engine, "connect", self._on_connect_sync)
            event.listen(engine, "before_cursor_execute", self._on_before_cursor_execute)
            if hasattr(self._client_ref, 'logger'):
                self._client_ref.logger.debug("Attached connection hook to sync engine")

    def _on_connect_sync(self, dbapi_connection, connection_record):
        """SQLAlchemy event handler for new connections (sync)"""
        if self._client_ref:
            # Get connection ID to track which connections have executed the hook
            conn_id = id(dbapi_connection)
            if conn_id not in self._executed_connections:
                try:
                    # Log that the hook is being executed
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.debug(f"Executing connection hook on new connection {conn_id}")
                    # Pass the connection to avoid creating new connections
                    self.execute_sync_with_connection(self._client_ref, dbapi_connection)
                    self._executed_connections.add(conn_id)
                except Exception as e:
                    # Log error but don't fail the connection
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.warning(f"Connection hook execution failed: {e}")

    def _on_before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """SQLAlchemy event handler for before cursor execute"""
        if self._client_ref:
            # Get connection ID to track which connections have executed the hook
            conn_id = id(conn.connection)
            if conn_id not in self._executed_connections:
                try:
                    # Log that the hook is being executed
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.debug(f"Executing connection hook on connection {conn_id}")
                    # Use the connection to avoid creating new connections
                    self.execute_sync_with_connection(self._client_ref, conn.connection)
                    self._executed_connections.add(conn_id)
                except Exception as e:
                    # Log error but don't fail the query
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.warning(f"Connection hook execution failed: {e}")

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
                        try:
                            result = self.custom_hook(client)
                            # If it returns a coroutine, await it
                            if hasattr(result, '__await__'):
                                await result
                        except TypeError as e:
                            if "object NoneType can't be used in 'await' expression" in str(e):
                                client.logger.warning("Custom hook appears to be async but was called synchronously")

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
                els
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

from typing import List, Tuple


def build_get_index_tables_sql(table_name: str, database: str = None) -> Tuple[str, Tuple]:
    """
    Build SQL to get all secondary index table names for a given table.

    This includes both MULTIPLE (regular secondary indexes) and UNIQUE indexes.

    Args:
        table_name: Name of the table
        database: Name of the database (optional, but recommended to avoid cross-database conflicts)

    Returns:
        Tuple of (sql, params)
    """
    if database:
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND reldatabase = ? AND type IN ('MULTIPLE', 'UNIQUE')
        """
        return sql, (table_name, database)
    else:
        # Fallback to old behavior if database is not provided
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND type IN ('MULTIPLE', 'UNIQUE')
        """
        return sql, (table_name,)


def build_get_index_table_by_name_sql(table_name: str, index_name: str, database: str = None) -> Tuple[str, Tuple]:
    """
    Build SQL to get the physical table name of a secondary index by its index name.

    Args:
        table_name: Name of the table
        index_name: Name of the secondary index
        database: Name of the database (optional, but recommended to avoid cross-database conflicts)

    Returns:
        Tuple of (sql, params)
    """
    if database:
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND name = ? AND reldatabase = ?
        """
        return sql, (table_name, index_name, database)
    else:
        # Fallback to old behavior if database is not provided
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND name = ?
        """
        return sql, (table_name, index_name)


def build_verify_counts_sql(table_name: str, index_tables: List[str]) -> str:
    """
    Build SQL to verify counts of main table and all index tables in a single query.

    Args:
        table_name: Name of the main table
        index_tables: List of index table names

    Returns:
        SQL string
    """
    if not index_tables:
        return f"SELECT COUNT(*) FROM `{table_name}`"

    select_parts = [f"(SELECT COUNT(*) FROM `{table_name}`) as main_count"]
    for idx, index_table in enumerate(index_tables):
        select_parts.append(f"(SELECT COUNT(*) FROM `{index_table}`) as idx{idx}_count")

    return "SELECT " + ", ".join(select_parts)


def process_verify_result(table_name: str, index_tables: List[str], row: Tuple) -> int:
    """
    Process the verification result and raise exception if counts don't match.

    Args:
        table_name: Name of the main table
        index_tables: List of index table names
        row: Result row from the verification SQL

    Returns:
        Row count if verification succeeds

    Raises:
        ValueError: If any index table has a different count
    """
    main_count = row[0]

    if not index_tables:
        return main_count

    index_counts = {}
    mismatch = []

    for idx, index_table in enumerate(index_tables):
        index_count = row[idx + 1]
        index_counts[index_table] = index_count
        if index_count != main_count:
            mismatch.append(index_table)

    # If there's a mismatch, raise an exception with details
    if mismatch:
        error_details = [f"Main table '{table_name}': {main_count} rows"]
        for index_table, count in index_counts.items():
            status = "✗ MISMATCH" if index_table in mismatch else "✓"
            error_details.append(f"{status} Index '{index_table}': {count} rows")

        error_msg = "Index count verification failed!\n" + "\n".join(error_details)
        raise ValueError(error_msg)

    return main_count

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

### Core Architecture Module: `pkg/backup/utils.go`
```
// Copyright 2023 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backup

import (
	"context"
	"strconv"
	"strings"

	"github.com/matrixorigin/matrixone/pkg/common/moerr"
	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
	"github.com/matrixorigin/matrixone/pkg/version"
)

func buildInfo() string {
	infos := []string{
		"GoVersion: " + version.GoVersion,
		"BranchName: " + version.BranchName,
		"CommitID: " + version.CommitID,
		"BuildTime: " + version.BuildTime,
		"Version: " + version.Version,
	}
	return strings.Join(infos, "|")
}

// SaveLaunchConfigPath saves all config file paths for the standalone config
func SaveLaunchConfigPath(typ string, paths []string) {
	launchConfigPaths[typ] = paths
}

func getS3Config(ctx context.Context, option []string) (*s3Config, error) {
	conf := &s3Config{}
	for i := 0; i < len(option); i += 2 {
		switch strings.ToLower(option[i]) {
		case "endpoint":
			conf.endpoint = option[i+1]
		case "region":
			conf.region = option[i+1]
		case "access_key_id":
			conf.accessKeyId = option[i+1]
		case "secret_access_key":
			conf.secretAccessKey = option[i+1]
		case "bucket":
			conf.bucket = option[i+1]
		case "filepath":
			conf.filepath = option[i+1]
		case "compression":
			conf.compression = option[i+1]
		case "provider":
			conf.provider = option[i+1]
		case "role_arn":
			conf.roleArn = option[i+1]
		case "external_id":
			conf.externalId = option[i+1]
		case "format":
			format := strings.ToLower(option[i+1])
			if format != tree.CSV && format != tree.JSONLINE {
				return nil, moerr.NewBadConfigf(ctx, "the format '%s' is not supported", format)
			}
			conf.format = format
		case "jsondata":
			jsondata := strings.ToLower(option[i+1])
			if jsondata != tree.OBJECT && jsondata != tree.ARRAY {
				return nil, moerr.NewBadConfigf(ctx, "the jsondata '%s' is not supported", jsondata)
			}
			conf.jsonData = jsondata
			conf.format = tree.JSONLINE
		case "is_minio":
			isMinioData := strings.ToLower(option[i+1])
			if isMinioData != "true" && isMinioData != "false" {
				return nil, moerr.NewBadConfigf(ctx, "the is_minio '%s' is not supported", isMinioData)
			}
			if isMinioData == "true" {
				conf.isMinio = true
			} else {
				conf.isMinio = false
			}
		case "parallelism":
			parallelismData := strings.ToLower(option[i+1])
			parall, err := strconv.ParseUint(parallelismData, 10, 16)
			if err != nil {
				return nil, moerr.NewBadConfigf(ctx, "the parallelism '%s' is invalid", parallelismData)
			}
			conf.parallelism = uint16(parall)
		default:
			return nil, moerr.NewBadConfigf(ctx, "the keyword '%s' is not support", strings.ToLower(option[i]))
		}
	}
	if conf.format == tree.JSONLINE && len(conf.jsonData) == 0 {
		return nil, moerr.NewBadConfig(ctx, "the jsondata must be specified")
	}
	if len(conf.format) == 0 {
		conf.format = tree.CSV
	}
	return conf, nil
}

```

### Core Architecture Module: `pkg/bootstrap/versions/utils.go`
```
// Copyright 2021 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package versions

import (
	"time"

	"github.com/matrixorigin/matrixone/pkg/common/pubsub"
	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/container/vector"
	"github.com/matrixorigin/matrixone/pkg/util/executor"
)

const (
	getPubInfosSql = "select pub_name, database_name, database_id, table_list, account_list, created_time, update_time, comment from mo_catalog.mo_pubs"
)

var GetPubInfos = func(txn executor.TxnExecutor, accountId uint32, accountName string) (pubInfos []*pubsub.PubInfo, err error) {
	var exist bool
	if exist, err = CheckTableDefinition(txn, accountId, "mo_catalog", "mo_pubs"); err != nil || !exist {
		return
	}

	// select from old mo_pubs table, which located in each account
	res, err := txn.Exec(getPubInfosSql, executor.StatementOption{}.WithAccountID(accountId))
	if err != nil {
		return
	}
	defer res.Close()

	res.ReadRows(func(rows int, cols []*vector.Vector) bool {
		for i := 0; i < rows; i++ {
			var pubInfo pubsub.PubInfo
			pubInfo.PubAccountName = accountName
			pubInfo.PubName = cols[0].GetStringAt(i)
			pubInfo.DbName = cols[1].GetStringAt(i)
			pubInfo.DbId = vector.GetFixedAtWithTypeCheck[uint64](cols[2], i)
			pubInfo.TablesStr = cols[3].GetStringAt(i)
			pubInfo.SubAccountsStr = cols[4].GetStringAt(i)
			pubInfo.CreateTime = vector.GetFixedAtWithTypeCheck[types.Timestamp](cols[5], i).String2(time.Local, cols[5].GetType().Scale)
			if !cols[6].IsNull(uint64(i)) {
				pubInfo.UpdateTime = vector.GetFixedAtWithTypeCheck[types.Timestamp](cols[6], i).String2(time.Local, cols[6].GetType().Scale)
			}
			pubInfo.Comment = cols[7].GetStringAt(i)
			pubInfos = append(pubInfos, &pubInfo)
		}
		return true
	})
	return
}

// GetAllPubInfos returns map[pubAccountName#pubName] -> pubInfo
var GetAllPubInfos = func(txn executor.TxnExecutor, accNameInfoMap map[string]*pubsub.AccountInfo) (map[string]*pubsub.PubInfo, error) {
	allPubInfos := make(map[string]*pubsub.PubInfo)
	for _, accountInfo := range accNameInfoMap {
		pubInfos, err := GetPubInfos(txn, uint32(accountInfo.Id), accountInfo.Name)
		if err != nil {
			return nil, err
		}

		for _, pubInfo := range pubInfos {
			allPubInfos[accountInfo.Name+"#"+pubInfo.PubName] = pubInfo
		}
	}
	return allPubInfos, nil
}

```

### Core Architecture Module: `pkg/catalog/secondary_index_utils.go`
```
// Copyright 2023 Matrix Origin
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

package catalog

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/bytedance/sonic"
	"github.com/matrixorigin/matrixone/pkg/common/moerr"
	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
	"github.com/matrixorigin/matrixone/pkg/vectorindex/metric"
)

// Index Algorithm names
const (
	MoIndexDefaultAlgo   = tree.INDEX_TYPE_INVALID   // used by UniqueIndex or default SecondaryIndex
	MoIndexBTreeAlgo     = tree.INDEX_TYPE_BTREE     // used for Mocking MySQL behaviour.
	MoIndexRTreeAlgo     = tree.INDEX_TYPE_RTREE     // used for Spatial Index on GEOMETRY columns
	MoIndexIvfFlatAlgo   = tree.INDEX_TYPE_IVFFLAT   // used for IVF flat index on Vector/Array columns
	MOIndexMasterAlgo    = tree.INDEX_TYPE_MASTER    // used for Master Index on VARCHAR columns
	MOIndexFullTextAlgo  = tree.INDEX_TYPE_FULLTEXT  // used for Fulltext Index on VARCHAR columns
	MoIndexHnswAlgo      = tree.INDEX_TYPE_HNSW      // used for HNSW Index on Vector/Array columns
	MoIndexCagraAlgo     = tree.INDEX_TYPE_CAGRA     // used for CAGRA Index on Vector/Array columns
	MoIndexIvfpqAlgo     = tree.INDEX_TYPE_IVFPQ     // used for IVFPQ Index on Vector/Array columns
	MoIndexFullText2Algo = tree.INDEX_TYPE_FULLTEXT2 // CREATE FULLTEXT2 INDEX: WAND positional engine on TEXT/VARCHAR columns
)

// ToLower is used for before comparing AlgoType and IndexAlgoParamOpType. Reason why they are strings
//  1. Changing AlgoType from string to Enum will break the backward compatibility.
//     "panic: Unable to find target column from predefined table columns"
//  2. IndexAlgoParamOpType is serialized and stored in the mo_indexes as JSON string.
func ToLower(str string) string {
	return strings.ToLower(strings.TrimSpace(str))
}

// IsNullIndexAlgo is used to skip printing the default "" index algo in the restoreDDL and buildShowCreateTable
func IsNullIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexDefaultAlgo.ToString()
}

// IsRegularIndexAlgo are indexes which will be handled by regular index flow, ie the one where
// we have one hidden table.
func IsRegularIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexDefaultAlgo.ToString() || _algo == MoIndexBTreeAlgo.ToString() || _algo == MoIndexRTreeAlgo.ToString()
}

func IsRTreeIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexRTreeAlgo.ToString()
}

func IsIvfIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexIvfFlatAlgo.ToString()
}

func IsMasterIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MOIndexMasterAlgo.ToString()
}

func IsFullTextIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MOIndexFullTextAlgo.ToString()
}

// IsFullText2IndexAlgo reports the distinct WAND positional fulltext engine
// (CREATE FULLTEXT2 INDEX). It is a separate algo from classic fulltext so its
// plugin hooks stay static; query routing / MATCH detection treat both.
func IsFullText2IndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexFullText2Algo.ToString()
}

func IsHnswIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexHnswAlgo.ToString()
}

func IsCagraIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexCagraAlgo.ToString()
}

func IsIvfpqIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexIvfpqAlgo.ToString()
}

// ------------------------[START] IndexAlgoParams------------------------
const (
	IndexAlgoParamLists     = "lists"
	IndexAlgoParamOpType    = "op_type"
	HnswM                   = "m"
	HnswEfConstruction      = "ef_construction"
	HnswEfSearch            = "ef_search"
	Async                   = "async"
	AutoUpdate              = "auto_update"
	Day                     = "day"
	Hour                    = "hour"
	Second                  = "second"
	DistributionMode        = "distribution_mode"
	Quantization            = "quantization"
	BitsPerCode             = "bits_per_code"
	IntermediateGraphDegree = "intermediate_graph_degree"
	GraphDegree             = "graph_degree"
	ITopkSize               = "itopk_size"
	// IncludedColumns persists INCLUDE metadata inside algo_params. Consumers
	// prefer plan.IndexDef.IncludedColumns when present and fall back to this key
	// for catalog-loaded definitions.
	IncludedColumns = "included_columns"

	// Index-defining build params, settable as CREATE INDEX options (parsed by
	// each plugin's ParamsFromTree). Written into flat algo_params only when
	// explicitly specified, read back by the build path (table functions /
	// sync), and rendered by IndexParamsToStringList for SHOW CREATE.
	IndexAlgoParamKmeansTrainPercent  = "kmeans_train_percent"
	IndexAlgoParamKmeansMaxIteration  = "kmeans_max_iteration"
	IndexAlgoParamMaxIndexCapacity    = "max_index_capacity"
	IndexAlgoParamQuantizerTrainLimit = "quantizer_train_limit"

	// IndexAlgoParamMaxPostingsCapacity (fulltext2): max postings (term occurrences)
	// per built segment. Bounds per-segment build memory regardless of doc size —
	// max_index_capacity (docs) is a poor memory proxy since a doc can hold one token
	// or tens of thousands. A segment seals on whichever cap (docs OR postings) is hit
	// first. Recorded only when explicitly specified; absence ⇒ DefaultPostingCapacity.
	IndexAlgoParamMaxPostingsCapacity = "max_postings_capacity"

	// IndexAlgoParamJSONIncludeKeys (fulltext2, parser=json): "false" ⇒ index leaf
	// VALUES only, the pre-tuple behaviour. Absent ⇒ "true": the json word breaker
	// indexes each leaf as a (tag, value) tuple so a key/value association is one
	// searchable term.
	IndexAlgoParamJSONIncludeKeys = "include_keys"

	// IndexAlgoParamPositionFree (fulltext2): "true" ⇒ build a position-free index
	// (bag-of-words retrieval only, ~half the footprint; the FST term dict is kept).
	// Recorded only when POSITION_FREE=TRUE; absence ⇒ positional (phrase-capable).
	IndexAlgoParamPositionFree = "position_free"

	// IndexAlgoParamPrefixLengths is the legacy, delimiter-separated encoding.
	// It remains readable for metadata written by older versions.
	IndexAlgoParamPrefixLengths = "prefix_lengths"
	// IndexAlgoParamPrefixLengthsV2 stores a JSON object in a string value.
	// Unlike the legacy colon/comma-separated value, it can represent every
	// legal quoted column name without ambiguity.
	IndexAlgoParamPrefixLengthsV2 = "prefix_lengths_v2"

	// IndexAlgoParamVersion selects the index engine version. Currently fulltext
	// only: unset/1 = classic SQL engine, 2 = WAND-based fulltext v2. The fulltext
	// plugin routes each hook to the matching engine by this value.
	IndexAlgoParamVersion = "version"
)

func ParseIncludeColumnsValue(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	if strings.HasPrefix(raw, "[") {
		var cols []string
		if err := json.Unmarshal([]byte(raw), &cols); err == nil {
			return cols, nil
		}
	}

	parts := strings.Split(raw, ",")
	cols := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		cols = append(cols, part)
	}
	if len(cols) == 0 {
		return nil, nil
	}
	return cols, nil
}

// MarshalIncludeColumnsValue encodes INCLUDE column names without losing
// commas or leading/trailing whitespace that are valid inside quoted SQL
// identifiers. ParseIncludeColumnsValue retains support for the historical
// comma-separated representation when catalog metadata is reloaded.
func MarshalIncludeColumnsValue(cols []string) (string, error) {
	if len(cols) == 0 {
		return "", nil
	}
	encoded, err := json.Marshal(cols)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

/* 1. ToString Functions */

// IndexParamsToStringList used by buildShowCreateTable and restoreDDL
// Eg:- "LIST = 10 op_type 'vector_l2_ops'"
// NOTE: don't set default values here as it is used by SHOW and RESTORE DDL.
func IndexParamsToStringList(indexParams string) (string, error) {
	result, err := IndexParamsStringToMap(indexParams)
	if err != nil {
		return "", err
	}

	res := ""
	if val, ok := result[IndexAlgoParamLists]; ok {
		res += fmt.Sprintf(" %s = %s ", IndexAlgoParamLists, val)
	}

	if val, ok := result[HnswM]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswM, val)
	}

	if val, ok := result[HnswEfConstruction]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswEfConstruction, val)
	}

	if val, ok := result[HnswEfSearch]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswEfSearch, val)
	}

	if opType, ok := result[IndexAlgoParamOpType]; ok {
		opType = ToLower(opType)
		if _, ok := metric.OpTypeToIvfMetric[opType]; !ok {
			return "", moerr.NewInternalErrorNoCtxf("invalid op_type: '%s'", opType)
		}

		res += fmt.Sprintf(" %s '%s' ", IndexAlgoParamOpType, opType)
	}

	if val, ok := result[Async]; ok {
		if val == "true" {
			res += fmt.Sprintf(" %s ", Async)
		}
	}

	if val, ok := result[AutoUpdate]; ok {
		if val == "true" {
			res += fmt.Sprintf(" %s = %s ", AutoUpdate, val)
		}
	}

	if val, ok := result[Day]; ok {
		res += fmt.Sprintf(" %s = %s ", Day, val)
	}

	if val, ok := result[Hour]; ok {
		res += fmt.Sprintf(" %s = %s ", Hour, val)
	}

	// SECOND is the async-index AUTO_UPDATE compaction cadence (idxcron reads it as the
	// explicit interval). Like DAY/HOUR it must round-trip through SHOW CREATE / checkpoint
	
```

### Core Architecture Module: `pkg/cdc/reader_v2_state.go`
```
// Copyright 2024 Matrix Origin
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

package cdc

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/txn/client"
)

// ReaderState represents the state of a table reader
type ReaderState int32

const (
	// ReaderStateIdle - Reader is idle, no active transaction
	ReaderStateIdle ReaderState = iota
	// ReaderStateReading - Reader is actively reading changes
	ReaderStateReading
	// ReaderStateProcessing - Reader is processing and sending data to sinker
	ReaderStateProcessing
	// ReaderStateCommitting - Reader is committing transaction
	ReaderStateCommitting
	// ReaderStateError - Reader encountered an error
	ReaderStateError
)

func (s ReaderState) String() string {
	switch s {
	case ReaderStateIdle:
		return "Idle"
	case ReaderStateReading:
		return "Reading"
	case ReaderStateProcessing:
		return "Processing"
	case ReaderStateCommitting:
		return "Committing"
	case ReaderStateError:
		return "Error"
	default:
		return "Unknown"
	}
}

// TransactionTracker tracks the lifecycle of a transaction
// This is a key improvement: explicit transaction state tracking
// instead of relying on implicit hasBegin flag
type TransactionTracker struct {
	mu sync.Mutex

	// Transaction boundaries
	fromTs types.TS
	toTs   types.TS

	// Transaction state
	hasBegin      bool // Whether BEGIN has been sent to sinker
	hasCommitted  bool // Whether COMMIT has been sent to sinker
	hasRolledBack bool // Whether ROLLBACK has been sent to sinker

	// Watermark tracking
	// The watermark we expect to update to after successful commit
	expectedWatermark types.TS
	// Whether watermark has been updated
	watermarkUpdated bool
}

// NewTransactionTracker creates a new transaction tracker
func NewTransactionTracker(fromTs, toTs types.TS) *TransactionTracker {
	return &TransactionTracker{
		fromTs:            fromTs,
		toTs:              toTs,
		expectedWatermark: toTs,
	}
}

// MarkBegin marks that BEGIN has been sent to sinker
func (t *TransactionTracker) MarkBegin() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasBegin = true
}

// MarkCommit marks that COMMIT has been sent to sinker
func (t *TransactionTracker) MarkCommit() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasCommitted = true
}

// MarkRollback marks that ROLLBACK has been sent to sinker
func (t *TransactionTracker) MarkRollback() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasRolledBack = true
}

// MarkWatermarkUpdated marks that watermark has been updated
func (t *TransactionTracker) MarkWatermarkUpdated() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.watermarkUpdated = true
}

// NeedsRollback returns true if transaction needs to be rolled back
// This is the key improvement: explicit check instead of relying on watermark
func (t *TransactionTracker) NeedsRollback() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	// If BEGIN was sent but not committed and not rolled back, need rollback
	return t.hasBegin && !t.hasCommitted && !t.hasRolledBack
}

// IsCompleted returns true if transaction is fully completed (committed or rolled back)
func (t *TransactionTracker) IsCompleted() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.hasCommitted || t.hasRolledBack
}

// GetFromTs returns the fromTs of this transaction
func (t *TransactionTracker) GetFromTs() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.fromTs
}

// GetToTs returns the toTs of this transaction
func (t *TransactionTracker) GetToTs() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.toTs
}

// UpdateToTs updates the transaction end timestamp
// This is used when multiple batches are processed in one transaction
// and we need to track the latest toTs
func (t *TransactionTracker) UpdateToTs(toTs types.TS) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.toTs = toTs
	t.expectedWatermark = toTs
}

// GetExpectedWatermark returns the expected watermark after commit
func (t *TransactionTracker) GetExpectedWatermark() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.expectedWatermark
}

// IsWatermarkUpdated returns whether watermark has been updated
func (t *TransactionTracker) IsWatermarkUpdated() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.watermarkUpdated
}

// Reset resets the tracker for a new transaction
func (t *TransactionTracker) Reset(fromTs, toTs types.TS) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.fromTs = fromTs
	t.toTs = toTs
	t.expectedWatermark = toTs
	t.hasBegin = false
	t.hasCommitted = false
	t.hasRolledBack = false
	t.watermarkUpdated = false
}

// StateManager manages the reader state atomically
type StateManager struct {
	state atomic.Int32
}

// NewStateManager creates a new state manager
func NewStateManager() *StateManager {
	return &StateManager{}
}

// SetState sets the reader state
func (sm *StateManager) SetState(state ReaderState) {
	sm.state.Store(int32(state))
}

// GetState returns the current reader state
func (sm *StateManager) GetState() ReaderState {
	return ReaderState(sm.state.Load())
}

// CompareAndSwapState atomically compares and swaps the state
func (sm *StateManager) CompareAndSwapState(old, new ReaderState) bool {
	return sm.state.CompareAndSwap(int32(old), int32(new))
}

// ReadContext holds the context for a read operation
type ReadContext struct {
	ctx    context.Context
	txnOp  client.TxnOperator
	packer *types.Packer

	// Current transaction tracker
	tracker *TransactionTracker
}

// NewReadContext creates a new read context
func NewReadContext(ctx context.Context, txnOp client.TxnOperator, packer *types.Packer) *ReadContext {
	return &ReadContext{
		ctx:    ctx,
		txnOp:  txnOp,
		packer: packer,
	}
}

// SetTracker sets the transaction tracker
func (rc *ReadContext) SetTracker(tracker *TransactionTracker) {
	rc.tracker = tracker
}

// GetTracker returns the transaction tracker
func (rc *ReadContext) GetTracker() *TransactionTracker {
	return rc.tracker
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30606** (2026-10-19): **fix(fulltext2): evict idle search cache after CDC flush so incremental DML is visible (#30401)**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #30401  ## What this PR does / why we need it:  A `FULLTEXT2` index indexed its initial (pre-create) rows correctly, but an `INSERT`/`UPDATE`/`DELETE` issued **after** `CREATE FULLTEXT2 INDEX` stayed invisible to `MATCH ... AGAINST` for ~10 minutes.  ### Root cause  The deltas are **not** lost. The ISCP consumer materializes them into `cdc_tail` frames correctly (confirmed: the frames are on disk, and a process restart — fresh cache — shows every incremental row). The defect is that the **warm in-memory fulltext2 search cache never refreshes** to include new `cdc_tail` frames in a live session, so `MATCH` keeps serving the create-time snapshot until the ~10-minute async stale sweep (`VectorIndexCacheTTL/2 × 4`) finally evicts the entry. DROP+recreate "fixes" it only because it builds a fresh cache object.  #29227 removed the post-flush idle-evict from `RunFulltext2` (and the `EvictIdleCache` helper), leaving the stale sweep as the only refresh path.  ### Fix  Restore the idle-evict: after a CDC tail flush that wrote frames, drop the cache entry **if idle** so the next query reloads the appended tail.  - `RemoveIdle` evicts only when no search is in flight, so it never thrashes   concurrent readers — a busy entry stays warm and refreshes later via the   sweep. This was #29227's stated conce

- **Issue #30602** (2026-10-19): **test(disttae): guard catalog replacement across lineage snapshot advance**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #30541. Production fixes are already present on main through #29539 and #29754; the release-branch correction is #30576.  ## What this PR does / why we need it:  Add the missing deterministic catalog regression for COPY ALTER's DROP/rename window. Existing main tests cover transferred data deletes and replacement keys, but do not check the same-name catalog replacement and the next real `txnDatabase.Delete` singleton guard.  The test commits an original table, creates its transaction-local replacement, drops and renames through the real engine APIs, synchronously flushes `mo_catalog.mo_tables` on TN, and advances through the shared lineage helper. It then requires exactly the replacement table ID and successfully executes the next real Delete.  There is no statement boundary between flush and verification: a normal boundary could repair the stale tombstone and hide the original defect. Setup reuses EnginePack with long checkpoint scanning, one PK column, two table identities, and no user data rows. Pack, setup/RC transactions and query results register cleanup immediately. No production hook, state, guard relaxation or runtime change is introduced.  Validation on Go 1.27.1 / Darwin arm64 CPU, with matching native provenance:  - New focused regression passes normally and with race; the

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

### Incident Patch 1: `d82e828b` (2026-10-19)
**Commit Message**: fix: preserve prepared temporal result types and values (#30224)

Prepared temporal expressions could expose string result types, discard time-of-day before CTAS materialization, or select an executor with an incompatible TIME result vector. Unary TIMESTAMP also lost fractional precision and introduced timezone-dependent materialization.

Preserve direct parameter provenance and consume calendar operands before provisional casts truncate them. DATE_ADD/DATE_SUB use the original interval unit for DATE versus DATETIME(6); TIMESTAMPADD preserves full calendar inputs. Unary TIMESTAMP binds to appended DATETIME overloads 6–10, while released overloads 0–4 retain their original execution ABI and pair overload 5 stays unchanged. Dynamic ADDTIME/SUBTIME compute calendar arithmetic before extracting TIME(6), preserving genuine durations over 24 hours and explicit SQL casts. The FROM_UNIXTIME reproduction already passes on base; retain source-type and reuse regressions without an unnecessary kernel change.

MORPC 122 protects the changed result contracts after released main epochs 114–121. Reuse existing expression classification, worker placement, actual-destination validation, receiver/per

**File**: `docs/design/unary_timestamp_result_contract_v1.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+# Unary TIMESTAMP result contract, revision 1
+
+Status: implemented compatibility design; independent review pending.
+PR: https://github.com/matrixorigin/matrixone/pull/30224
+Review addressed: https://github.com/matrixorigin/matrixone/pull/30224#pullrequestreview-5525155127
+
+## Invariant
+
+A serialized function identity has one physical result-vector type. Unary
+`TIMESTAMP` now binds a DATETIME result, preserving civil time and source FSP;
+reusing its released TIMESTAMP identities lets an older worker allocate the
+wrong result wrapper and panic during a rolling upgrade.
+
+## Identities and admission
+
+| Encoded identity (function 250) | Physical result | Binding | Required protocol |
+| --- | --- | --- | --- |
+| 0–4 (DATE, DATETIME, TIMESTAMP, VARCHAR, CHAR) | TIMESTAMP | Execution of released expressions only | Existing temporal floor 98 |
+| 5 (two arguments) | DATETIME | Unchanged | Existing temporal floor 98 |
+| 6–10 (corresponding unary signatures) | DATETIME | All new unary binding, including PREPARE/rebind | 122 |
+
+Official main `873282742714436bff407dfcdbbe879147162bd3` advertises protocol 121;
+this single capability uses the next value, 122. A later rebase must allocate
+again from official main and update all gates and predecessor tests together.
+No protobuf fields or RPCs are added. The existing registry binding filter
+selects new identities while ID-based execution retains the released handlers.
+An older binary has no unary identities 6–10; it cannot dispatch them to a
+released TIMESTAMP handler.
+
+The common expression walk identifies new unary IDs and rejects an ID/result
+shape mismatch. Its independent feature is included in worker placement,
+sender rollout validation, the actual destination probe before encoding, and
+receiver validation after decoding and before operator construction. An old or
+unknown destination causes local placement or a send error, never a downgrade
+of the expression's result type. Capabilities are observed again at each send.
+Other temporal contracts remain at protocol 98.
+
+The same walk computes catalog read and authoring requirements for defaults,
+on-update expressions, generated columns (including functional-index backing
+columns), checks and view queries. The existing pre-fold view observer stores
+122 even when binding folds the expression to a literal. Existing catalog
+admission and its durable required floor continue to own publication and CN
+readiness. Local executor construction validates the ID/result shape before
+allocating a result wrapper; valid local execution needs no per-row protocol
+check. PREPARE specialization must bind the appended identity and retain its
+DATETIME metadata and value contract.
+
+## Upgrade and rollback
+
+Before capability 122 is enabled, old catalog unary expressions continue to
+execute with their original TIMESTAMP handlers and timezone semantics on new
+binaries. New DATETIME unary expressions can execute locally, but cannot be
+sent to protocol 112/121 workers or published below read/authoring floor 122.
+
+After catalog expressions requiring 122 are published, downgrading the binary
+alone is unsupported: the existing durable admission floor keeps an older CN
+out. Removing or rebinding those dependencies must follow the existing catalog
+admission procedure before any downgrade; this patch supplies no automatic
+floor reduction or lossy expression rewrite. Expressions from the unmerged PR
+that paired old IDs with DATETIME require SQL rebinding rather than ABI guessing.
+
+## Acceptance evidence
+
+Focused tests cover actual binding, all five old/new serialized unary domains
+in UTC and +08, NULL/masks/reuse, and invalid vector shapes. Protocol tests cover
+112/121 rejection, 122 acceptance, destination change after placement, rollback
+after success, unknown capability, sender and decoded receiver. Catalog tests
+cover read/authoring floors independently and serialized folded-view metadata.
+Existing prepared SELECT/CTAS/reuse tests assert the new identity where retained;
+BVT executes nonconstant DATETIME input via PREPARE and stored-view replay.
+
+No new mutable state, resource owner, wait, queue or per-row work is introduced.
+The versioned checks extend existing bounded admission paths. A live mixed
+binary cluster is not claimed by the deterministic component tests.
+
+## Maintenance revision 5: admission before CTAS effects
+
+The execution epoch is MORPC 122, after main's released epochs 114–121.
+Official epoch 120 remains reserved for current-session KILL authorization and
+proxy disconnect cleanup. Official epoch 121 preserves exact unsigned DECIMAL
+DIV domains. This PR appends epoch 122 and rejects immediate-
+predecessor 121 peers at each temporal boundary. The same epoch protects new
+unary TIMESTAMP DATETIME overloads and prepared
+ADDTIME/SUBTIME TIME results over non-TIME inputs. Native TIME durations and
+released TIMESTAMP overloads retain their exist
```

**File**: `pkg/defines/const.go` (modified, +2/-1)
```diff
@@ -157,7 +157,8 @@ const (
 	MORPCVersion119    int64 = 119 // coordinator-owned parameterized subquery programs
 	MORPCVersion120    int64 = 120 // current-session KILL authorization and proxy disconnect cleanup
 	MORPCVersion121    int64 = 121 // exact unsigned DECIMAL DIV result domain
-	MORPCLatestVersion       = MORPCVersion121
+	MORPCVersion122    int64 = 122 // unary TIMESTAMP and dynamic TIME result contracts
+	MORPCLatestVersion       = MORPCVersion122
 )
 
 // DefaultLockWaitTimeoutSeconds is shared by the frontend default and by
```

**File**: `pkg/pb/plan/string_literal_form.go` (modified, +30/-0)
```diff
@@ -392,6 +392,10 @@ const (
 // TableCollationFunction requires MORPC v118 for INTERNAL_TABLE_COLLATION's
 // execution identity, including directly authored catalog expressions.
 // CalendarIntervalNormalization requires MORPC v115 for the new normalization identity.
+// TimestampDatetimeResultContracts requires MORPC v122 for appended unary
+// TIMESTAMP identities; released unary identities retain TIMESTAMP vectors.
+// DynamicTimeResultContracts uses the same epoch for prepared TIME results
+// over string/calendar ADDTIME/SUBTIME inputs; native TIME inputs are unchanged.
 type RemoteExpressionFeatures struct {
 	DependentPrograms             bool
 	CalendarIntervalNormalization bool
@@ -431,6 +435,8 @@ type RemoteExpressionFeatures struct {
 	WeekSessionDefault                      bool
 	MediumIntAssignmentBounds               bool
 	DateNumericResultContracts              bool
+	TimestampDatetimeResultContracts        bool
+	DynamicTimeResultContracts              bool
 	DecimalStatisticalResultContracts       bool
 	TableCollationFunction                  bool
 	InvalidDecimalStatisticalResultContract bool
@@ -467,6 +473,7 @@ func (features RemoteExpressionFeatures) Any() bool {
 		features.LegacyIntervalUnits ||
 		features.WeekSessionDefault ||
 		features.MediumIntAssignmentBounds ||
+		features.TimestampDatetimeResultContracts || features.DynamicTimeResultContracts ||
 		features.DateNumericResultContracts ||
 		features.DecimalStatisticalResultContracts ||
 		features.TableCollationFunction ||
@@ -1016,6 +1023,16 @@ func RequiredRemoteExpressionFeatures(owner any) (features RemoteExpressionFeatu
 				if id == 216 && (overload == 0 || overload == 1) { // one-arg WEEK
 					features.WeekSessionDefault = true
 				}
+				timestamp, dynamicTime := TemporalResultContractFeatures(current)
+				features.TimestampDatetimeResultContracts = features.TimestampDatetimeResultContracts || timestamp
+				features.DynamicTimeResultContracts = features.DynamicTimeResultContracts || dynamicTime
+				if id == 250 && overload >= 0 && overload <= 10 { // TIMESTAMP
+					want := planTimestampTypeID
+					if overload >= 5 {
+						want = planDatetimeTypeID
+					}
+					features.InvalidTemporalResultContract = features.InvalidTemporalResultContract || current.Typ.Id != want
+				}
 				// Released overloads retain their physical vector ABI. The new
 				// numeric EXTRACT and string ADDTIME/SUBTIME results use appended
 				// identities, so 4.2 catalog expressions remain executable.
@@ -1720,3 +1737,16 @@ func expressionOwnerContainer(kind reflect.Kind) bool {
 		return false
 	}
 }
+
+// TemporalResultContractFeatures classifies one expression before folding.
+// Native TIME inputs keep their released physical result contract.
+func TemporalResultContractFeatures(expr *Expr) (timestampDatetime, dynamicTime bool) {
+	fn := expr.GetF()
+	if fn == nil || fn.Func == nil {
+		return false, false
+	}
+	id, overload := int32(fn.Func.Obj>>32), int32(fn.Func.Obj)
+	return id == 250 && overload >= 6 && overload <= 10,
+		(id == 41 || id == 378) && expr.Typ.Id == planTimeTypeID &&
+			len(fn.Args) == 2 && fn.Args[0] != nil && fn.Args[0].Typ.Id != planTimeTypeID
+}
```

**File**: `pkg/sql/colexec/evalExpression.go` (modified, +12/-0)
```diff
@@ -456,6 +456,18 @@ func newExpressionExecutorWithAllocation(
 
 	case *plan.Expr_F:
 		overloadID := t.F.GetFunc().GetObj()
+		// Validate before allocating the result wrapper, including plans retained
+		// from the pre-versioned unary TIMESTAMP implementation.
+		fid, oid := function.DecodeOverloadID(overloadID)
+		if fid == function.TIMESTAMP && oid >= 0 && oid <= 10 {
+			want := types.T_timestamp
+			if oid >= 5 {
+				want = types.T_datetime
+			}
+			if typ.Oid != want {
+				return nil, moerr.NewNotSupportedNoCtx("TIMESTAMP result vector contract mismatch requires rebinding")
+			}
+		}
 		overload, err := function.GetFunctionById(proc.Ctx, overloadID)
 		if err != nil {
 			return nil, err
```

**File**: `pkg/sql/compile/compile2.go` (modified, +9/-0)
```diff
@@ -153,6 +153,9 @@ func (c *Compile) Compile(
 	// rolling back the caller's workspace statement. This also covers
 	// frontend background execution and reused Compile instances.
 	if c.proc != nil && c.proc.IncrStatementDisabled() {
+		if err = validateTemporalResultProtocol(c.proc, queryPlan); err != nil {
+			return err
+		}
 		queryPlan, err = c.prepareCreateNamePlan(queryPlan)
 		if err != nil {
 			return err
@@ -161,6 +164,9 @@ func (c *Compile) Compile(
 	if err = plan.RequireLegacyCollations(queryPlan); err != nil {
 		return err
 	}
+	if err = validateTemporalResultProtocol(c.proc, queryPlan); err != nil {
+		return err
+	}
 	if err = validateOctStringProtocol(c.proc, queryPlan); err != nil {
 		return err
 	}
@@ -414,6 +420,9 @@ func expressionsContainUnresolvedFullText(expressions []*plan.Expr) bool {
 // Run executes the pipeline and returns the result.
 func (c *Compile) Run(_ uint64) (queryResult *util2.RunResult, err error) {
 	defer func() { err = process.UnwrapPipelineFailure(err) }()
+	if err = validateTemporalResultProtocol(c.proc, c.pn); err != nil {
+		return nil, err
+	}
 	if c.pn.GetDdl().GetDropTable() != nil {
 		// Retry generations share this statement owner. Other statements do
 		// not need a temporary DROP retirement journal.
```

**File**: `pkg/sql/compile/expression_destination_protocol.go` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ func validateRemoteExpressionDestination(proc *process.Process, p *pipeline.Pipe
 		{features.DecimalStatisticalResultContracts, defines.MORPCVersion113,
 			"decimal statistical DOUBLE results require a versioned remote destination",
 			"remote destination does not support decimal statistical DOUBLE results (MORPC version %d)"},
+		{features.TimestampDatetimeResultContracts || features.DynamicTimeResultContracts, defines.MORPCVersion122,
+			"temporal result contracts require a versioned remote destination",
+			"remote destination does not support temporal result contracts (MORPC version %d)"},
 		{features.DateNumericResultContracts, defines.MORPCVersion112,
 			"signed date result contracts require a versioned remote destination",
 			"remote destination does not support signed date result contracts (MORPC version %d)"},
```

**File**: `pkg/sql/compile/expression_protocol.go` (modified, +49/-0)
```diff
@@ -20,6 +20,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/clusterservice"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
@@ -43,6 +44,9 @@ func (c *Compile) constrainRemoteExpressionWorkers(qry *plan.Query) error {
 	if features.InvalidDecimalStatisticalResultContract {
 		return moerr.NewNotSupportedNoCtx("decimal statistical result contract requires rebinding")
 	}
+	if features.InvalidTemporalResultContract {
+		return moerr.NewNotSupportedNoCtx("temporal result vector contract mismatch requires rebinding")
+	}
 	if features.LegacyIntervalUnits {
 		return moerr.NewNotSupportedNoCtx("legacy interval unit contract requires rebinding")
 	}
@@ -74,6 +78,9 @@ func executionRemoteExpressionProtocolVersion(proc *process.Process, features pl
 
 func remoteExpressionProtocolVersion(features plan.RemoteExpressionFeatures) int64 {
 	required := max(requiredExpressionContractProtocolVersion(features), temporalExpressionProtocolVersion(features))
+	if features.TimestampDatetimeResultContracts || features.DynamicTimeResultContracts {
+		required = max(required, defines.MORPCVersion122)
+	}
 	if features.IntegerArithmeticDomains {
 		required = max(required, defines.MORPCVersion71)
 	}
@@ -253,3 +260,45 @@ func remoteWorkerProtocolVersion(ctx context.Context, proc *process.Process, wor
 	}
 	return resp.GetProtocolVersion.Version, true, nil
 }
+
+// Cached compilations can survive a cluster capability rollback. Reject only
+// the changed result contracts here, before Prepare or statement effects; the
+// existing placement/receiver owners retain all other expression policies.
+func validateTemporalResultProtocol(proc *process.Process, owner any) error {
+	var required int64
+	if queryPlan, ok := owner.(*plan.Plan); ok {
+		if create := createTableForNameAdmission(queryPlan); create != nil {
+			required = create.CtasExecutionProtocolVersion
+		}
+	}
+	var version int64
+	var known bool
+	if proc != nil {
+		if rt := moruntime.ServiceRuntime(proc.GetService()); rt != nil {
+			value, exists := rt.GetGlobalVariables(moruntime.MOProtocolVersion)
+			var valid bool
+			version, valid = value.(int64)
+			known = exists && valid
+		}
+	}
+	if required < 0 {
+		return moerr.NewNotSupportedNoCtx("invalid CTAS population protocol requirement requires rebinding")
+	}
+	if required > 0 && (!known || version < required) {
+		return moerr.NewNotSupportedf(context.Background(), "CTAS population requires MORPC protocol version %d", required)
+	}
+	if known && version >= defines.MORPCVersion122 {
+		return nil
+	}
+	features, err := plan.RequiredRemoteExpressionFeatures(owner)
+	if err != nil {
+		return err
+	}
+	if features.InvalidTemporalResultContract {
+		return moerr.NewNotSupportedNoCtx("temporal result vector contract mismatch requires rebinding")
+	}
+	if features.TimestampDatetimeResultContracts || features.DynamicTimeResultContracts {
+		return moerr.NewNotSupportedNoCtx("temporal result contracts require MORPC protocol version 122")
+	}
+	return nil
+}
```

**File**: `pkg/sql/compile/lifecycle_admission_test.go` (modified, +42/-5)
```diff
@@ -17,12 +17,14 @@ package compile
 import (
 	"context"
 	"errors"
+	"strings"
 	"testing"
 	"time"
 
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
 	"github.com/matrixorigin/matrixone/pkg/lockservice"
@@ -177,7 +179,7 @@ func TestTransactionLocalReplacementRequiresBothGenerations(t *testing.T) {
 }
 
 func TestBorrowedCreateNameRefreshBeforeEffects(t *testing.T) {
-	for _, mode := range []string{"unknown_binding", "stable_binding", "changed_domain", "canceled", "ctas_refresh"} {
+	for _, mode := range []string{"unknown_binding", "stable_binding", "changed_domain", "canceled", "ctas_refresh", "unsupported_temporal", "unsupported_ctas", "unsupported_temporary_ctas", "ctas_rollback"} {
 		t.Run(mode, func(t *testing.T) {
 			ctrl := gomock.NewController(t)
 			proc := testutil.NewProcess(t)
@@ -190,7 +192,11 @@ func TestBorrowedCreateNameRefreshBeforeEffects(t *testing.T) {
 			op.EXPECT().Txn().DoAndReturn(func() txn.TxnMeta {
 				return txn.TxnMeta{Mode: txn.TxnMode_Pessimistic, Isolation: txn.TxnIsolation_RC, SnapshotTS: now}
 			}).AnyTimes()
-			op.EXPECT().Snapshot().Return(txn.CNTxnSnapshot{LockTables: []lock.LockTable{{Table: 33, Valid: true}}}, nil).AnyTimes()
+			snapshot := txn.CNTxnSnapshot{LockTables: []lock.LockTable{{Table: 33, Valid: true}}}
+			if strings.HasPrefix(mode, "unsupported_") {
+				snapshot.LockTables = nil
+			}
+			op.EXPECT().Snapshot().Return(snapshot, nil).AnyTimes()
 			op.EXPECT().TxnOptions().Return(txn.TxnOptions{}).AnyTimes()
 			op.EXPECT().CreateTS().Return(timestamp.Timestamp{}).AnyTimes()
 			op.EXPECT().AddWaitLock(gomock.Any(), gomock.Any(), gomock.Any()).Return(uint64(1)).AnyTimes()
@@ -222,13 +228,20 @@ func TestBorrowedCreateNameRefreshBeforeEffects(t *testing.T) {
 			original := &plan.Plan{Plan: &plan.Plan_Ddl{Ddl: &plan.DataDefinition{DdlType: plan.DataDefinition_CREATE_TABLE, Definition: &plan.DataDefinition_CreateTable{CreateTable: q}}}}
 			var source tree.Statement
 			var planner *plan2.MockCompilerContext
-			if mode == "ctas_refresh" {
+			if mode == "ctas_refresh" || strings.HasPrefix(mode, "unsupported_") || mode == "ctas_rollback" {
 				var err error
-				source, err = parsers.ParseOne(t.Context(), dialect.MYSQL, "create table db.t as select a + 1 from select_test.bind_select", 1)
+				sql := "create table db.t as select a + 1 from select_test.bind_select"
+				if strings.HasPrefix(mode, "unsupported_") || mode == "ctas_rollback" {
+					sql = "create table db.t as select timestamp(granted_time) from mo_catalog.mo_role_privs"
+				}
+				if mode == "unsupported_temporary_ctas" {
+					sql = strings.Replace(sql, "create table", "create temporary table", 1)
+				}
+				source, err = parsers.ParseOne(t.Context(), dialect.MYSQL, sql, 1)
 				require.NoError(t, err)
 				defer source.Free()
 				planner = plan2.NewMockCompilerContext(true, testutil.NewProcess(t))
-				original, err = plan2.BuildPlan(planner, source, false)
+				original, err = plan2.BuildPlan(planner, source, mode == "unsupported_temporal")
 				require.NoError(t, err)
 			}
 			builds := 0
@@ -254,9 +267,26 @@ func TestBorrowedCreateNameRefreshBeforeEffects(t *testing.T) {
 				proc.Ctx = ctx
 				proc.ReplaceTopCtx(ctx)
 			}
+			if strings.HasPrefix(mode, "unsupported_") || mode == "ctas_rollback" {
+				rt := moruntime.ServiceRuntime(proc.GetService())
+				old, _ := rt.GetGlobalVariables(moruntime.MOProtocolVersion)
+				t.Cleanup(func() { rt.SetGlobalVariables(moruntime.MOProtocolVersion, old) })
+				rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion121)
+				if mode == "ctas_rollback" {
+					rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion122)
+				} else {
+					eng.dbErr = errors.New("catalog accessed before temporal admission")
+				}
+			}
 			err := c.Compile(proc.Ctx, original, nil)
 			got := c.GetPlan()
 			switch mode {
+			case "unsupported_temporal", "unsupported_ctas", "unsupported_temporary_ctas":
+				require.ErrorContains(t, err, "version 122")
+				require.NotErrorIs(t, err, eng.dbErr, "unsupported CTAS must not access catalog names")
+				require.Zero(t, builds)
+				require.Zero(t, advances)
+				require.Zero(t, locks)
 			case "canceled":
 				require.ErrorIs(t, err, context.Canceled)
 				require.Zero(t, builds)
@@ -281,6 +311,13 @@ func TestBorrowedCreateNameRefreshBeforeEffects(t *testing.T) {
 				require.Equal(t, "a + 1", got.GetDdl().GetCreateTable().TableDef.Cols[0].Name)
 				require.Equal(t, original.GetDdl().GetCreateTable().CreateAsSelectSql, got.GetDdl().GetCreateTable().CreateAsSelectSql)
 			}
+			if mode == "ctas_rollback" {
+				before := locks
+				moruntime.ServiceRuntime(proc.GetService()).SetGlobalVariables(moruntime.M
```

---

### Incident Patch 2: `e0314478` (2026-10-19)
**Commit Message**: fix(check): make CHECK constraint names schema-unique, MySQL-style (#30343) (#30368)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #30343

## What this PR does / why we need it:

Generic unnamed CHECK names and copied LIKE names allow separate tables
to own the same `(CONSTRAINT_SCHEMA, CONSTRAINT_NAME)`, causing
information_schema joins to associate the wrong expression with a table.
Generate MySQL-style `<table>_chk_<n>` names, regenerate names for
ordinary LIKE/CLONE, and reject new schema-wide duplicate claims with
MySQL error 3822. Generated names retain the 64-character identifier
limit (error 1059).

Planning owns the names, the shared legacy SQL decoder supplies missing
old catalog identities, and compile admission reserves newly introduced
names using existing transactional catalog locks. COPY validates new
logical names before its trusted replica; physical partition/index
tables borrow their logical owner's namespace. Table/column rename
composition validates and persists the final identities together,
including SQL-only legacy s

**File**: `optools/run_ut.sh` (modified, +40/-13)
```diff
@@ -231,6 +231,11 @@ function current_ut_command_is_prebuilt_helper(){
 # Completion belongs to the existing helper owner, independently of report shards.
 function prepare_ut_helper_completion(){
     local path="${G_WKSP}/${G_TS}-owner-complete.$1"
+    remove_ut_report_file "${path}.cancel"
+    if [[ -e "${path}.cancel" ]]; then
+        printf -v "$2" '%s' 1
+        return 125
+    fi
     if ! : > "${path}"; then
         printf -v "$2" '%s' 1
         return 125
@@ -289,6 +294,12 @@ function join_ut_owner(){
                 [[ "$(<"${completion_path}")" != "${join_status}" ]]; then
                 join_status=125
             fi
+            # The helper has joined and acknowledged descendant drainage.
+            # Only now can its parent's cancellation request be retired.
+            if (( join_status != 125 )); then
+                remove_ut_report_file "${completion_path}.cancel"
+                [[ ! -e "${completion_path}.cancel" ]] || join_status=125
+            fi
         fi
         if (( join_status == 125 )); then printf -v "${failed_flag_name}" '%s' 1; fi
         printf -v "${pid_name}" '%s' ''
@@ -1205,11 +1216,20 @@ function handle_ut_termination(){
         exit 143
     fi
     UT_TERMINATING=1
+    local pid
+    local termination_status=${1:-143} child_status=0
+    if [[ -n "${CURRENT_UT_PID}" ]] && current_ut_command_is_prebuilt_helper; then
+        # TERM is a wakeup, not the only record of cancellation. The helper
+        # polls this request at PID-safe points even if a shell trap is delayed
+        # or consumed during a publication/probe boundary. Completion remains
+        # the separate authoritative acknowledgement of descendant drainage.
+        if ! : > "${G_WKSP}/${G_TS}-owner-complete.CURRENT_UT_PID.cancel"; then
+            termination_status=125
+        fi
+    fi
     checkpoint_ut_event "cancel" "${CURRENT_UT_STAGE}" "${CURRENT_UT_LABEL}" "143" \
         "current_pid=${CURRENT_UT_PID} light_pid=${LIGHT_RACE_JOB_PID} engine_pid=${ENGINE_RACE_JOB_PID} plan_pid=${PLAN_RACE_JOB_PID} prebuild_pid=${CLUSTER_PREBUILD_JOB_PID}"
 
-    local pid
-    local termination_status=${1:-143} child_status=0
     # Notify every group before waiting, so the concurrent plan/helper cleanup
     # gets the same grace window as the foreground writer.
     for pid in "${CURRENT_UT_PID}" "${LIGHT_RACE_JOB_PID}" "${ENGINE_RACE_JOB_PID}" "${PLAN_RACE_JOB_PID}" "${CLUSTER_PREBUILD_JOB_PID}"; do
@@ -2064,7 +2084,7 @@ function run_prebuilt_race_commands(){
     local stage=$1 report=$2 parallel=$3 hard_timeout_seconds=$4
     local exclusive_high_footprint=${5:-0}
     local index candidate scheduled=0 active=0 high_footprint_active=0 progress status=0 child_status now remaining deadline
-    local previous_term_trap execution_term_trap term_pending=0
+    local previous_term_trap term_pending=0
     local -a child_pids=() test_pids=() watchdog_pids=() started=()
     local -a reports=() expired=()
     if ! [[ "${exclusive_high_footprint}" =~ ^[01]$ ]]; then
@@ -2092,14 +2112,24 @@ function run_prebuilt_race_commands(){
         publish_ut_helper_completion 143 || exit 125
         exit 143
     }
-    trap cancel_prebuilt_race_commands TERM
-    execution_term_trap=$(trap -p TERM)
+    function prebuilt_race_cancel_requested(){
+        (( term_pending != 0 )) ||
+            [[ -n "${UT_HELPER_COMPLETION:-}" && -e "${UT_HELPER_COMPLETION:-}.cancel" ]]
+    }
+    # Keep one sticky TERM latch for the entire admission/drain lifetime.
+    # Swapping traps around each $! publication creates a signal handoff
+    # window. The trap only records intent; the owner cancels at safe points
+    # after recording every newly admitted PID, never from inside a probe or
+    # while a PID is still unpublished. Do not reset this latch between spawns.
+    trap 'term_pending=1' TERM
     rm -f "${report}" "${report}".*
 
     while (( scheduled < ${#race_packages[@]} || active > 0 )); do
+        if prebuilt_race_cancel_requested; then cancel_prebuilt_race_commands; fi
         # The same admission owner enforces exclusion in both directions:
         # high-footprint work starts alone and keeps the wave until drained.
         while (( scheduled < ${#race_packages[@]} && active < parallel )); do
+            if prebuilt_race_cancel_requested; then cancel_prebuilt_race_commands; fi
             candidate=-1
             for (( index=0; index<${#race_packages[@]}; index++ )); do
                 [[ "${started[index]:-0}" == 0 ]] || continue
@@ -2153,8 +2183,6 @@ function run_prebuilt_race_commands(){
             fi
             checkpoint_ut_event start "${stage}" "${race_packages[index]}" "" \
                 "package_index=${index} prebuilt=true parallel=${parallel}"
-            term_pending=0
-            trap 'term_pending=1' TERM
             set -m
             (
                 cd "${race_dirs[index]}" || exit 2
@@ -2168,11 +2196,8 @@ function run_prebuilt_race_commands(){
      
```

**File**: `optools/ut_embedded_schedule_test.go` (modified, +141/-19)
```diff
@@ -73,23 +73,23 @@ if [[ "$1" == tool && "$2" == test2json ]]; then
   trap 'touch "$CASE_DIR/stopped-execute-a"; exit 143' TERM
   printf '%s\n' "$$" > "$CASE_DIR/pid-execute-a"
   printf 'ready\n' >&8
-  while :; do read -r -t 0.01 _ <&9 || true; done
+  while :; do read -r _ <&9 || true; done
  fi
  if [[ "$MODE" == execute-timeout && "$leaf" == a ]]; then
   ps -o pgid= -p $$ | tr -d ' ' > "$CASE_DIR/pgid-execute-timeout-a"
   trap '' TERM
-  while :; do read -r -t 0.01 _ <&9 || true; done
+  while :; do read -r _ <&9 || true; done
  fi
  if [[ "$MODE" == execute-timeout-zero && "$leaf" == a ]]; then
   ps -o pgid= -p $$ | tr -d ' ' > "$CASE_DIR/pgid-execute-timeout-zero-a"
   trap 'printf "{\"Action\":\"pass\",\"Package\":\"%s\"}\\n" "$package"; exit 0' TERM
-  while :; do read -r -t 0.01 _ <&9 || true; done
+  while :; do read -r _ <&9 || true; done
  fi
  if [[ "$MODE" == execute-cancel-resistant && "$leaf" == a ]]; then
   ps -o pgid= -p $$ | tr -d ' ' > "$CASE_DIR/pgid-execute-resistant-a"
   printf 'ready\n' >&8
   trap '' TERM
-  while :; do read -r -t 0.01 _ <&9 || true; done
+  while :; do read -r _ <&9 || true; done
  fi
  if [[ "$MODE" == test-failure && "$leaf" == b ]]; then
   printf '{"Action":"fail","Package":"%s"}\n' "$package"
@@ -118,7 +118,7 @@ if [[ " $* " == *' -c '* ]]; then
     if [[ -e "$CASE_DIR/join-waiting" ]]; then
      if mkdir "$CASE_DIR/term-sent" 2>/dev/null; then kill -TERM "$RUNNER_PID"; fi
     fi
-    read -r -t 0.01 _ <&9 || true
+    read -r -t 1 _ <&9 || true
    done
   else
    read -r _ <&9
@@ -648,15 +648,7 @@ run_embedded_tests "$scope" 2
 			var transform func(string) string
 			mock := embeddedGoMock
 			switch phase {
-			case "active-publication":
-				transform = func(text string) string {
-					const anchor = "            test_pids[index]=$!\n"
-					if strings.Count(text, anchor) != 1 {
-						t.Fatal("missing active pid publication")
-					}
-					return strings.Replace(text, anchor, "        ut_test_execution_spawned\n"+anchor, 1)
-				}
-			case "watchdog-publication", "cleanup":
+			case "active-publication", "watchdog-publication", "cleanup":
 				mock = strings.Replace(mock, `trap 'touch "$CASE_DIR/stopped-execute-a"; exit 143' TERM`, `trap 'fixture_self_pid fixture_pid; printf "MOCK_TERM shell=%s\n" "$fixture_pid" >&16; touch "$CASE_DIR/stopped-execute-a"; printf "MOCK_STOPPED shell=%s\n" "$fixture_pid" >&16; exit 143' TERM`, 1)
 				script = strings.Replace(script, " printf 'EXECUTE_CANCELLED %s\\n' \"$status\"", " cat \"$CASE_DIR/ut-signal-trace.log\"\n printf 'EXECUTE_CANCELLED %s\\n' \"$status\"", 1)
 				script = strings.Replace(script, "function ut_test_execution_spawned() {", `exec 16>"$CASE_DIR/ut-signal-trace.log"
@@ -687,7 +679,10 @@ function ut_test_execution_spawned() {`, 1)
   printf 'OBSERVER_RELEASE shell=%s\n' "$observer_pid" >&16) &`, 1)
 				}
 				transform = func(text string) string {
-					const anchor = "            watchdog_pids[index]=$!\n"
+					anchor := "            watchdog_pids[index]=$!\n"
+					if phase == "active-publication" {
+						anchor = "            test_pids[index]=$!\n"
+					}
 					if strings.Count(text, anchor) != 1 {
 						t.Fatal("missing watchdog pid publication")
 					}
@@ -705,19 +700,23 @@ function ut_test_execution_spawned() {`, 1)
 					text = strings.Replace(text, `            child_pids[index*2]=${test_pids[index]}`, `            child_pids[index*2]=${test_pids[index]}
             fixture_self_pid fixture_pid
             printf 'TEST_PUBLISHED shell=%s test=%s\n' "$fixture_pid" "${test_pids[index]}" >&16`, 1)
-					text = strings.Replace(text, "    function cancel_prebuilt_race_commands(){\n", "    function cancel_prebuilt_race_commands(){\n        fixture_self_pid fixture_pid\n        printf 'CANCEL shell=%s test=%s watchdog=%s\\n' \"$fixture_pid\" \"${test_pids[*]}\" \"${watchdog_pids[*]}\" >&16\n", 1)
+					text = strings.Replace(text, "    function cancel_prebuilt_race_commands(){\n", "    function cancel_prebuilt_race_commands(){\n        fixture_self_pid fixture_pid\n        printf 'CANCEL shell=%s test=%s watchdog=%s\\n' \"$fixture_pid\" \"${test_pids[*]-}\" \"${watchdog_pids[*]-}\" >&16\n", 1)
 					text = strings.Replace(text, `        if ! terminate_ut_process_groups 20 ${child_pids[@]+"${child_pids[@]}"} >&2; then exit 125; fi`, `        local sweep_status=0
         fixture_self_pid fixture_pid
-        printf 'SWEEP_START shell=%s owners=%s\n' "$fixture_pid" "${child_pids[*]}" >&16
+        printf 'SWEEP_START shell=%s owners=%s\n' "$fixture_pid" "${child_pids[*]-}" >&16
         terminate_ut_process_groups 20 ${child_pids[@]+"${child_pids[@]}"} >&2 || sweep_status=$?
         printf 'SWEEP_RESULT shell=%s status=%s\n' "$fixture_pid" "$sweep_status" >&16
         (( sweep_status == 0 )) || exit 125`, 1)
 					text = strings.Replace(text, "        wait 2>/dev/null || true\n", "        fixture_self_pid fixture_pid\n        printf 'DRAINED shell=%s\\n' \"$fixture_pid\" >&16\n 
```

**File**: `optools/ut_schedule_test.go` (modified, +13/-1)
```diff
@@ -998,7 +998,17 @@ func TestHeavyPlanCancellationStopsWritersBeforeMerge(t *testing.T) {
 	script := `source ./run_ut.sh UT
 function logger() { :; }
 trap handle_ut_termination TERM
-trap 'printf "\nCANCEL_REPORT\n"; cat "$UT_REPORT"' EXIT
+function check_cancellation() {
+ status=$?
+ if [[ "$status" == 143 ]]; then
+  [[ -z "$CURRENT_UT_PID$PLAN_RACE_JOB_PID" ]] || status=94
+  if ut_process_group_alive "$writer_pid" || ut_process_group_alive "$plan_pid"; then status=95; fi
+ fi
+ printf '\nCANCEL_REPORT\n'
+ cat "$UT_REPORT"
+ exit "$status"
+}
+trap check_cancellation EXIT
 ENGINE_RACE_REPORT="$CASE_DIR/engine-report"
 printf 'engine\n' > "$ENGINE_RACE_REPORT"
 mkfifo "$CASE_DIR/writer-ready" "$CASE_DIR/writer-wait"
@@ -1009,13 +1019,15 @@ start_ut_command heavy 'heavy writer' bash -c '
  printf "heavy\n" >&9
  IFS= read -r _ <&8
 '
+writer_pid=$CURRENT_UT_PID
 function run_plan_race_shards() {
  trap 'printf "plan-stopped\n" >> "$PLAN_RACE_REPORT"; ut_test_publish_completion; exit 143' TERM
  printf 'plan-start\n' > "$PLAN_RACE_REPORT"
  printf 'plan\n' >&9
  IFS= read -r _ <&8
 }
 start_plan_race example/plan
+plan_pid=$PLAN_RACE_JOB_PID
 IFS= read -r -t 10 first <&9 || exit 91
 IFS= read -r -t 10 second <&9 || exit 92
 [[ "$first:$second" == heavy:plan || "$first:$second" == plan:heavy ]] || exit 93
```

**File**: `pkg/common/moerr/error.go` (modified, +39/-29)
```diff
@@ -151,6 +151,9 @@ const (
 	// contract without reusing main's codes or the digest dependency's 20338/20339.
 	ErrInvalidJSONPathWildcard  uint16 = 20340
 	ErrCollationCharsetMismatch uint16 = 20341
+	// ErrDuplicateCheckConstraintName reports a CHECK constraint name already
+	// used by another table in the same schema (MySQL 3822).
+	ErrDuplicateCheckConstraintName uint16 = 20342
 
 	// Group 4: unexpected state and io errors
 	ErrInvalidState                             uint16 = 20400
@@ -478,35 +481,36 @@ var errorMsgRefer = map[uint16]moErrorMsgItem{
 	ErrGroupConcatCut:              {ER_CUT_VALUE_GROUP_CONCAT, []string{"HY000"}, "%s"},
 
 	// Group 3: invalid input
-	ErrBadConfig:               {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "invalid configuration: %s"},
-	ErrInvalidInput:            {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "invalid input: %s"},
-	ErrSyntaxError:             {ER_SYNTAX_ERROR, []string{"42000"}, "SQL syntax error: %s"},
-	ErrParseError:              {ER_PARSE_ERROR, []string{"42000"}, "SQL parser error: %s"},
-	ErrConstraintViolation:     {ER_CHECK_CONSTRAINT_VIOLATED, []string{MySQLDefaultSqlState}, "constraint violation: %s"},
-	ErrDuplicate:               {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "tae data: duplicate"},
-	ErrRoleGrantedToSelf:       {ER_ROLE_GRANTED_TO_ITSELF, []string{MySQLDefaultSqlState}, "cannot grant role %s to %s"},
-	ErrDuplicateEntry:          {ER_DUP_ENTRY, []string{"23000"}, "Duplicate entry '%s' for key '%s'"},
-	ErrWrongValueCountOnRow:    {ER_WRONG_VALUE_COUNT_ON_ROW, []string{"21S01"}, "Column count doesn't match value count at row %d"},
-	ErrBadFieldError:           {ER_BAD_FIELD_ERROR, []string{"42S22"}, "Unknown column '%s' in '%s'"},
-	ErrWrongDatetimeSpec:       {ER_WRONG_DATETIME_SPEC, []string{MySQLDefaultSqlState}, "wrong date/time format specifier: %s"},
-	ErrUpgrateError:            {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "CN upgrade table or view '%s.%s' under tenant '%s:%d' reports error: %s"},
-	ErrUnsupportedDML:          {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "unsupported DML: %s"},
-	ErrOperandColumns:          {ER_OPERAND_COLUMNS, []string{"21000"}, "Operand should contain %d column(s)"},
-	ErrSubqueryNo1Row:          {ER_SUBQUERY_NO_1_ROW, []string{"21000"}, "Subquery returns more than 1 row"},
-	ErrInvalidTypeForJSON:      {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "Invalid data type for JSON data in argument %d to function %s; a JSON string or JSON type is required."},
-	ErrInvalidJSONCharset:      {ER_INVALID_JSON_CHARSET, []string{"22032"}, "Cannot create a JSON value from a string with CHARACTER SET '%s'."},
-	ErrUnknownStmtHandler:      {ER_UNKNOWN_STMT_HANDLER, []string{MySQLDefaultSqlState}, "Unknown prepared statement handler (%s) given to %s"},
-	ErrViewWrongList:           {ER_VIEW_WRONG_LIST, []string{MySQLDefaultSqlState}, "In definition of view, derived table or common table expression, SELECT list and column names list have different column counts"},
-	ErrWrongArguments:          {ER_WRONG_ARGUMENTS, []string{MySQLDefaultSqlState}, "Incorrect arguments to %s"},
-	ErrDerivedMustHaveAlias:    {ER_DERIVED_MUST_HAVE_ALIAS, []string{"42000"}, "Every derived table must have its own alias"},
-	ErrWrongUsage:              {ER_WRONG_USAGE, []string{MySQLDefaultSqlState}, "Incorrect usage of %s and %s"},
-	ErrUpdateTableUsed:         {ER_UPDATE_TABLE_USED, []string{MySQLDefaultSqlState}, "You can't specify target table '%-.192s' for update in FROM clause"},
-	ErrWindowInvalidUse:        {ER_WINDOW_INVALID_WINDOW_FUNC_USE, []string{"HY000"}, "You cannot use the window function '%s' in this context"},
-	ErrViewSelectTmpTable:      {ER_VIEW_SELECT_TMPTABLE, []string{MySQLDefaultSqlState}, "View's SELECT refers to a temporary table '%-.192s'"},
-	ErrTooManyRows:             {ER_TOO_MANY_ROWS, []string{"42000"}, "Result consisted of more than one row"},
-	ErrCantChangeTxn:           {ER_CANT_CHANGE_TX_CHARACTERISTICS, []string{"25001"}, "Transaction characteristics can't be changed while a transaction is in progress"},
-	ErrInvalidGroupFuncUse:     {ER_INVALID_GROUP_FUNC_USE, []string{MySQLDefaultSqlState}, "Invalid use of group function"},
-	ErrInvalidJSONPathWildcard: {ER_INVALID_JSON_PATH_WILDCARD, []string{"42000"}, "In this situation, path expressions may not contain the * and ** tokens or an array range."},
+	ErrBadConfig:                    {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "invalid configuration: %s"},
+	ErrInvalidInput:                 {ER_UNKNOWN_ERROR, []string{MySQLDefaultSqlState}, "invalid input: %s"},
+	ErrSyntaxError:                  {ER_SYNTAX_ERROR, []string{"42000"}, "SQL syntax error: %s"},
+	ErrParseError:                   {ER_PARSE_ERROR, []string{"42000"}, "SQL parser error: %s"},
+	ErrConstraintViolation:          {ER_CHECK_CONSTRAINT_VIOLATED, []string{MySQLDefaultSqlState}, "constraint violation: %s"},
+	ErrDuplicateChe
```

**File**: `pkg/defines/type.go` (modified, +6/-0)
```diff
@@ -280,6 +280,12 @@ type IsMoLogger struct{}
 
 type IgnoreForeignKey struct{}
 
+// TrustedCheckConstraintNames bridges StatementOption.WithTrustedCheckConstraintNames
+// to Scope.createTable: the statement intentionally keeps CHECK names inherited
+// from an owned source (ALTER ... COPY replica, partition backing table, TRUNCATE
+// recreate), so the schema-wide duplicate-name scan is skipped.
+type TrustedCheckConstraintNames struct{}
+
 type AlterCopyOpt struct{}
 
 // OptimizerHints carries a per-statement optimizer_hints string (same key=value
```

**File**: `pkg/embed/check_constraint_namespace_test.go` (added, +534/-0)
```diff
@@ -0,0 +1,534 @@
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
+	"bytes"
+	"context"
+	"database/sql"
+	"errors"
+	"fmt"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/go-sql-driver/mysql"
+	"github.com/google/uuid"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/cnservice"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/lockservice"
+	"github.com/matrixorigin/matrixone/pkg/pb/api"
+	"github.com/matrixorigin/matrixone/pkg/pb/lock"
+	"github.com/matrixorigin/matrixone/pkg/queryservice"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
+	"github.com/stretchr/testify/require"
+)
+
+func TestCheckConstraintNamespace(t *testing.T) {
+	defer func() { require.NoError(t, CloseBaseClusterTests()) }()
+	RunBaseClusterTests(t, func(cluster Cluster) {
+		cn, err := cluster.GetCNService(0)
+		require.NoError(t, err)
+		db, err := sql.Open("mysql", fmt.Sprintf("dump:111@tcp(127.0.0.1:%d)/", cn.GetServiceConfig().CN.Frontend.Port))
+		require.NoError(t, err)
+		defer db.Close()
+		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Minute)
+		defer cancel()
+		conn, err := db.Conn(ctx)
+		require.NoError(t, err)
+		defer conn.Close()
+		exec := func(t *testing.T, statement string) {
+			t.Helper()
+			_, err := conn.ExecContext(ctx, statement)
+			require.NoError(t, err, statement)
+		}
+		expectError := func(t *testing.T, statement string, code uint16) {
+			t.Helper()
+			_, err := conn.ExecContext(ctx, statement)
+			var serverError *mysql.MySQLError
+			require.True(t, errors.As(err, &serverError), "%s: %v", statement, err)
+			require.Equal(t, code, serverError.Number, "%s: %v", statement, err)
+		}
+		count := func(t *testing.T, query string, want int) {
+			t.Helper()
+			var actual int
+			require.NoError(t, conn.QueryRowContext(ctx, query).Scan(&actual), query)
+			require.Equal(t, want, actual, query)
+		}
+		const database = "check_namespace_review"
+		exec(t, "create database "+database)
+		exec(t, "use "+database)
+		defer func() {
+			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), time.Minute)
+			defer cleanupCancel()
+			_, err := conn.ExecContext(cleanupCtx, "drop snapshot if exists check_namespace_legacy")
+			require.NoError(t, err)
+			_, err = conn.ExecContext(cleanupCtx, "drop database if exists "+database)
+			require.NoError(t, err)
+		}()
+
+		t.Run("legacy SQL-only owners reject new claims", func(t *testing.T) {
+			defer func() {
+				// The artificial old-format rows must not affect later restore
+				// scenarios, including when an admission assertion fails.
+				for _, table := range []string{"legacy_duplicate", "structured_duplicate", "renamed_legacy", "sql_only_owner", "legacy_add_target", "rename_legacy_source", "structured_owner"} {
+					exec(t, "drop table if exists "+table)
+				}
+			}()
+			svc := cn.RawService().(cnservice.Service)
+			res, err := svc.GetSQLExecutor().Exec(defines.AttachAccountId(ctx, 0),
+				"create table "+database+".sql_only_owner(x int, constraint legacy_create check(x>0), constraint legacy_add check(x<10), constraint renamed_legacy_chk_1 check(x<>5))",
+				executor.Options{}.WithWaitCommittedLogApplied().WithAdjustTableExtraFunc(func(extra *api.SchemaExtra) error {
+					extra.Checks = nil
+					return nil
+				}))
+			require.NoError(t, err)
+			res.Close()
+			var encoded []byte
+			var createSQL string
+			require.NoError(t, conn.QueryRowContext(ctx,
+				"select extra_info, rel_createsql from mo_catalog.mo_tables where reldatabase=? and relname='sql_only_owner'", database).Scan(&encoded, &createSQL))
+			var extra api.SchemaExtra
+			require.NoError(t, extra.Unmarshal(encoded))
+			require.Empty(t, extra.Checks)
+			require.Contains(t, createSQL, "legacy_create")
+			count(t, "select count(*) from information_schema.table_constraints where table_schema='"+database+"' and table_name='sql_only_owner' and constraint_type='CHECK'", 3)
+			expectError(t, "create table legacy_duplicate(x int, constraint LEGACY_CREATE check(x<0))", 3822)
+			exec(t, "create table legacy_add_target(x int)")
+			expectError(t, "alter table legacy_add_target add constraint legacy_add check(x>0)", 3822)
+			exec(t, "create table rename_legacy_source(x int check(x>0))")
+			expe
```

**File**: `pkg/fileservice/disk_cache_lifecycle_test.go` (modified, +4/-0)
```diff
@@ -1174,6 +1174,10 @@ func TestDiskCacheCloseCancelsActiveFileFinalizeBeforePublish(t *testing.T) {
 
 func TestDiskCacheCloseWinsAtFilePublicationBoundary(t *testing.T) {
 	cache := newLifecycleTestDiskCache(t)
+	// Exercise publication/Close ordering without waiting for real fsync.
+	// Persistence errors and Close during an active sync have separate tests;
+	// this test must reach the publication gate before initiating Close.
+	cache.fileSync = func(*os.File) error { return nil }
 	publicationReached := make(chan struct{})
 	releasePublication := make(chan struct{})
 	unblock := sync.OnceFunc(func() { close(releasePublication) })
```

**File**: `pkg/partitionservice/storage.go` (modified, +12/-4)
```diff
@@ -356,11 +356,13 @@ func (s *storage) Redefine(
 				tree.WithSingleQuoteString(),
 			)
 
-			// 1. create a temporary table
+			// 1. create a temporary table. The staged definition carries the
+			// parent's CHECK names and replaces the parent below, so it is an
+			// owned recreate, not an unrelated sibling.
 			txn.Use(def.DbName)
 			rs, err := txn.Exec(
 				sql,
-				executor.StatementOption{},
+				executor.StatementOption{}.WithTrustedCheckConstraintNames(),
 			)
 			if err != nil {
 				return err
@@ -443,7 +445,8 @@ func (s *storage) Rename(
 					),
 					executor.StatementOption{}.
 						WithIgnoreForeignKey().
-						WithIgnorePublish(),
+						WithIgnorePublish().
+						WithTrustedCheckConstraintNames(),
 				)
 				if err != nil {
 					return err
@@ -834,7 +837,12 @@ func (s *storage) createPartitionTable(
 			executor.StatementOption{}.
 				WithDisableLock().
 				WithIgnoreForeignKey().
-				WithIgnorePublish(),
+				WithIgnorePublish().
+				// Backing tables copy the parent's CHECK names verbatim. They
+				// share ownership with the parent and never appear in
+				// information_schema, so the 3822 sibling scan must not treat
+				// them as unrelated tables.
+				WithTrustedCheckConstraintNames(),
 		)
 		if err != nil {
 			return err
```

---

### Incident Patch 3: `27131f38` (2026-10-19)
**Commit Message**: fix(sql): preserve LOAD locality during primary-key validation (#30527)

## What type of PR is this?

- [x] BUG
- [ ] API-change
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #30520

## What this PR does / why we need it:

Ordinary LOAD's primary-key DEDUP sends its hash-partitioned output
directly to bulk writers. An ordered import consequently produces
overlapping key ranges, increasing the blocks read by subsequent OLTP
range queries. This affects transactions after LOAD, independently of
the COS boundary-reader Close cost tracked in #30511.

Share the prepared, locked row image once. An independent, key-only
DEDUP step retains exact input/snapshot conflict checks, while
base/index writers consume the original image. All steps must complete
before statement commit; duplicate errors still cancel and roll back
writes. This preserves #30411 correctness, generated/autoincrement
values, and existing LOAD exemptions without adding a global sort or
disabling shuffle/spill.

Validation on macOS arm64 / Go 1.27.1:

- A bounded real-MySQL reproduction at the PR base uses 400,000 ordered
composite-PK ro

**File**: `pkg/sql/compile/load_unique_index_promotion.go` (modified, +125/-5)
```diff
@@ -226,7 +226,7 @@ func analyzeLoadUniqueIndexPromotionPlan(
 	}
 
 	reachable, ok := reachableLoadPlanNodes(qry)
-	if !ok || len(qry.Steps) != 1 {
+	if !ok {
 		return nil, false
 	}
 	var lockNode, updateNode *plan.Node
@@ -255,9 +255,7 @@ func analyzeLoadUniqueIndexPromotionPlan(
 		}
 	}
 	if lockNode == nil || updateNode == nil || externalScans != 1 ||
-		qry.Steps[0] != updateNodeID ||
-		!planNodeDescendsFrom(qry.Nodes, updateNodeID, lockNodeID) ||
-		!planNodeDescendsFrom(qry.Nodes, lockNodeID, externalNodeID) {
+		!loadUniqueIndexPromotionTopology(qry, updateNodeID, lockNodeID, externalNodeID) {
 		return nil, false
 	}
 
@@ -373,6 +371,111 @@ func analyzeLoadUniqueIndexPromotionPlan(
 	return promoted, true
 }
 
+// Admit only the original single writer or the shared prepared-image LOAD.
+// SourceStep is a step index, not a node ID. The extra executable branch must
+// only validate the base PK; it must never supply the writer's partitions.
+// reachableLoadPlanNodes has already validated all references and cycles.
+func loadUniqueIndexPromotionTopology(qry *plan.Query, writer, lock, external int32) bool {
+	if !planNodeDescendsFrom(qry.Nodes, lock, external) {
+		return false
+	}
+	if len(qry.Steps) == 1 {
+		return qry.Steps[0] == writer && planNodeDescendsFrom(qry.Nodes, writer, lock)
+	}
+	if len(qry.Steps) != 3 {
+		return false
+	}
+	var source, validation int32 = -1, -1
+	writerSteps := 0
+	for step, root := range qry.Steps {
+		switch qry.Nodes[root].NodeType {
+		case plan.Node_SINK:
+			if source >= 0 {
+				return false
+			}
+			source = int32(step)
+		case plan.Node_PROJECT:
+			if validation >= 0 {
+				return false
+			}
+			validation = root
+		case plan.Node_MULTI_UPDATE:
+			if root != writer {
+				return false
+			}
+			writerSteps++
+		default:
+			return false
+		}
+	}
+	if source < 0 || validation < 0 || writerSteps != 1 ||
+		!planNodeDescendsFrom(qry.Nodes, qry.Steps[source], lock) {
+		return false
+	}
+	// The shared image is prepared and locked once, from one external input.
+	for id := qry.Steps[source]; ; {
+		n := qry.Nodes[id]
+		if id == external {
+			if len(n.Children) != 0 {
+				return false
+			}
+			break
+		}
+		switch n.NodeType {
+		case plan.Node_SINK, plan.Node_PROJECT, plan.Node_PRE_INSERT, plan.Node_LOCK_OP:
+		default:
+			return false
+		}
+		if len(n.Children) != 1 {
+			return false
+		}
+		id = n.Children[0]
+	}
+	sharedScan := func(n *plan.Node) bool {
+		return n.NodeType == plan.Node_SINK_SCAN && n.SourceStep[0] == source
+	}
+	update := qry.Nodes[writer]
+	if len(update.Children) != 1 {
+		return false
+	}
+	writeInput := loadPromotionSkipProjects(qry.Nodes, update.Children[0])
+	// Ordinary LOAD checks constraints after the shared image. ASSERT preserves
+	// successful rows and has no alternate source or partitioning of its own.
+	for writeInput.NodeType == plan.Node_ASSERT && len(writeInput.Children) == 1 {
+		writeInput = loadPromotionSkipProjects(qry.Nodes, writeInput.Children[0])
+	}
+	if !sharedScan(writeInput) {
+		return false
+	}
+	check := loadPromotionSkipProjects(qry.Nodes, validation)
+	if check.NodeType != plan.Node_JOIN || check.JoinType != plan.Node_DEDUP ||
+		check.OnDuplicateAction != plan.Node_FAIL || len(check.Children) != 2 {
+		return false
+	}
+	// swapJoinChildren exchanges the physical inputs for RIGHT DEDUP while
+	// retaining IsRightJoin. Resolve the logical roles before checking sources.
+	target, input := check.Children[0], check.Children[1]
+	if check.IsRightJoin {
+		target, input = input, target
+	}
+	if !sharedScan(loadPromotionSkipProjects(qry.Nodes, input)) {
+		return false
+	}
+	scan := loadPromotionSkipProjects(qry.Nodes, target)
+	base := qry.Nodes[lock].TableDef
+	return scan.NodeType == plan.Node_TABLE_SCAN && len(scan.Children) == 0 &&
+		base != nil && scan.TableDef != nil && scan.TableDef.TblId == base.TblId &&
+		objectRefMatchesTable(scan.ObjRef, base)
+}
+
+func loadPromotionSkipProjects(nodes []*plan.Node, id int32) *plan.Node {
+	n := nodes[id]
+	for n.NodeType == plan.Node_PROJECT && len(n.Children) == 1 {
+		n = nodes[n.Children[0]]
+	}
+	return n
+}
+
 func reachableLoadPlanNodes(qry *plan.Query) (map[int32]struct{}, bool) {
 	reachable := make(map[int32]struct{}, len(qry.Nodes))
 	visiting := make(map[int32]struct{}, len(qry.Nodes))
@@ -389,7 +492,24 @@ func reachableLoadPlanNodes(qry *plan.Query) (map[int32]struct{}, bool) {
 		}
 		visiting[nodeID] = struct{}{}
 		defer delete(visiting, nodeID)
-		for _, child := range qry.Nodes[nodeID].Children {
+		n := qry.Nodes[nodeID]
+		if n.NodeType == plan.Node_SINK_SCAN {
+			if len(n.Children) != 0 || len(n.SourceStep) != 1 {
+				return false
+			}
+			step := n.SourceStep[0]
+			if step < 0 || int(step) >= len(qry.Steps) {
+				return false
+			}
+			root := qry.Steps[step]
+			if root < 0 || int(root) >= len(qry.Nodes) || qry.Nodes[root] == nil ||
+				qry.Nodes[root].NodeType != plan.Node_SINK || !visit(root) {
+				return false
+			}
+	
```

**File**: `pkg/sql/compile/load_unique_index_promotion_test.go` (modified, +134/-0)
```diff
@@ -456,6 +456,7 @@ func TestAnalyzeLoadUniqueIndexPromotionMatchesPlannerShape(t *testing.T) {
 	qry, err := plan2.NewMockOptimizer(true, newPlanTestProcess(t)).Optimize(stmt)
 	require.NoError(t, err)
 	pn := &plan.Plan{Plan: &plan.Plan_Query{Query: qry}}
+	require.Len(t, qry.Steps, 3, "exercise the shared image, independent validation, and writer")
 	require.False(t, qry.LoadWriteS3,
 		"the modern LOAD binder does not use the legacy write-path marker")
 	var external, lockNode, updateNode *plan.Node
@@ -510,6 +511,139 @@ func TestAnalyzeLoadUniqueIndexPromotionMatchesPlannerShape(t *testing.T) {
 	require.NotEmpty(t, targets)
 }
 
+func TestAnalyzeLoadUniqueIndexPromotionSharedImage(t *testing.T) {
+	newPlan := func() *plan.Plan {
+		pn := newLoadUniqueIndexPromotionPlan()
+		q := pn.GetQuery()
+		q.Nodes = append(q.Nodes,
+			&plan.Node{NodeType: plan.Node_SINK, Children: []int32{1}},
+			&plan.Node{NodeType: plan.Node_SINK_SCAN, SourceStep: []int32{0}},
+			&plan.Node{NodeType: plan.Node_SINK_SCAN, SourceStep: []int32{0}},
+			&plan.Node{NodeType: plan.Node_TABLE_SCAN, TableDef: q.Nodes[1].TableDef, ObjRef: q.Nodes[1].LockTargets[0].ObjRef},
+			&plan.Node{NodeType: plan.Node_JOIN, JoinType: plan.Node_DEDUP, OnDuplicateAction: plan.Node_FAIL, Children: []int32{6, 5}},
+			&plan.Node{NodeType: plan.Node_PROJECT, Children: []int32{7}},
+		)
+		q.Nodes[2].Children = []int32{4}
+		q.Steps = []int32{3, 8, 2} // Source step 0 resolves node 3, not node 0.
+		return pn
+	}
+	assertAdmission := func(t *testing.T, pn *plan.Plan, want bool) {
+		t.Helper()
+		for _, right := range []bool{false, true} {
+			if right {
+				check := pn.GetQuery().Nodes[7]
+				if len(check.Children) == 2 {
+					check.Children[0], check.Children[1] = check.Children[1], check.Children[0]
+				}
+				check.IsRightJoin = !check.IsRightJoin
+			}
+			targets, ok := analyzeLoadUniqueIndexPromotionPlan(pn, testLoadUniqueIndexMaxRowLocks)
+			require.Equal(t, want, ok, "swapped orientation: %t", right)
+			if want {
+				require.Len(t, targets, 1)
+				original := pn.GetQuery().Nodes[1].LockTargets[1]
+				require.Equal(t, original, targets[0].rowTarget)
+				require.NotSame(t, original, targets[0].rowTarget)
+			}
+		}
+	}
+	for _, tc := range []struct {
+		name   string
+		mutate func(*plan.Query)
+	}{
+		{"shared image", func(*plan.Query) {}},
+		{"reordered steps", func(q *plan.Query) {
+			q.Steps = []int32{2, 3, 8}
+			q.Nodes[4].SourceStep[0], q.Nodes[5].SourceStep[0] = 1, 1
+		}},
+		{"validation projection wrappers", func(q *plan.Query) {
+			q.Nodes = append(q.Nodes,
+				&plan.Node{NodeType: plan.Node_PROJECT, Children: []int32{6}},
+				&plan.Node{NodeType: plan.Node_PROJECT, Children: []int32{5}},
+			)
+			q.Nodes[7].Children = []int32{9, 10}
+		}},
+		{"projection wrappers", func(q *plan.Query) {
+			q.Nodes = append(q.Nodes, &plan.Node{NodeType: plan.Node_PROJECT, Children: []int32{4}})
+			q.Nodes[2].Children[0] = 9
+		}},
+		{"writer CHECK assertions", func(q *plan.Query) {
+			q.Nodes = append(q.Nodes,
+				&plan.Node{NodeType: plan.Node_ASSERT, Children: []int32{4}},
+				&plan.Node{NodeType: plan.Node_PROJECT, Children: []int32{9}},
+			)
+			q.Nodes[2].Children[0] = 10
+		}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			pn := newPlan()
+			tc.mutate(pn.GetQuery())
+			assertAdmission(t, pn, true)
+		})
+	}
+	for _, tc := range []struct {
+		name   string
+		mutate func(*plan.Query)
+	}{
+		{"missing source", func(q *plan.Query) { q.Nodes[4].SourceStep = nil }},
+		{"multiple sources", func(q *plan.Query) { q.Nodes[4].SourceStep = []int32{0, 0} }},
+		{"negative source", func(q *plan.Query) { q.Nodes[4].SourceStep[0] = -1 }},
+		{"out of range source", func(q *plan.Query) { q.Nodes[4].SourceStep[0] = 3 }},
+		{"source is not sink", func(q *plan.Query) { q.Nodes[4].SourceStep[0] = 1 }},
+		{"scan with child", func(q *plan.Query) { q.Nodes[4].Children = []int32{0} }},
+		{"recursive scan", func(q *plan.Query) { q.Nodes[4].NodeType = plan.Node_RECURSIVE_SCAN }},
+		{"source on project", func(q *plan.Query) { q.Nodes[8].SourceStep = []int32{0} }},
+		{"source cycle", func(q *plan.Query) { q.Nodes[3].Children[0] = 4 }},
+		{"child cycle", func(q *plan.Query) { q.Nodes[1].Children[0] = 3 }},
+		{"nil source", func(q *plan.Query) { q.Nodes[3] = nil }},
+		{"invalid source root", func(q *plan.Query) { q.Steps[0] = 99 }},
+		{"nil child", func(q *plan.Query) { q.Nodes[6] = nil }},
+		{"invalid child", func(q *plan.Query) { q.Nodes[7].Children[0] = -1 }},
+		{"extra root", func(q *plan.Query) { q.Steps = append(q.Steps, 0) }},
+		{"duplicate root", func(q *plan.Query) { q.Steps[1] = 2 }},
+		{"second writer", func(q *plan.Query) { q.Nodes[8].NodeType = plan.Node_MULTI_UPDATE }},
+		{"second lock", func(q *plan.Query) { q.Nodes[8].NodeType = plan.Node_LOCK_OP }},
+		{"second external", func(q *plan.Query) { q.Nodes[6] = plan2.DeepCopyNode(q.Nodes[0]) }},
+		{"disconnected lock", func(q *plan.Query) { q.Nodes[3].Children[0] 
```

**File**: `pkg/sql/plan/bind_insert.go` (modified, +35/-0)
```diff
@@ -3474,6 +3474,22 @@ func (builder *QueryBuilder) appendDedupAndMultiUpdateNodesForBindInsert(
 		}
 
 		if !skipPkDedup && (!isFakePK || pkRoleIdxPos >= 0 || useTargetPk) {
+			// FAIL validation does not transform successful LOAD rows. Share the
+			// prepared, locked image so its hash/shuffle/spill partitions cannot
+			// become the bulk writer's partitions and destroy source locality.
+			loadSourceStep := int32(-1)
+			if builder.qry.LoadTag && builder.checkLoadPrimaryKey && onDupAction == plan.Node_FAIL && !isFakePK {
+				imageTag := builder.genNewBindTag()
+				imageID := builder.appendNode(&plan.Node{
+					NodeType:    plan.Node_PROJECT,
+					Children:    []int32{lastNodeID},
+					ProjectList: getProjectionByLastNodeWithTag(builder, selectNode.NodeId, imageTag),
+					BindingTags: []int32{imageTag},
+				}, bindCtx)
+				sinkID := appendSinkNodeWithTag(builder, bindCtx, imageID, builder.genNewBindTag())
+				loadSourceStep = builder.appendStep(sinkID)
+				lastNodeID = builder.appendTaggedSinkScan(bindCtx, loadSourceStep, selectTag)
+			}
 			builder.addNameByColRef(scanTag, tableDef)
 
 			scanNodeID := builder.appendNode(&plan.Node{
@@ -3657,6 +3673,25 @@ func (builder *QueryBuilder) appendDedupAndMultiUpdateNodesForBindInsert(
 			}
 
 			lastNodeID = builder.appendNode(dedupJoinNode, bindCtx)
+			if loadSourceStep >= 0 {
+				pkPos := colName2Idx[tableDef.Name+"."+pkName]
+				validationID := builder.appendNode(&plan.Node{
+					NodeType: plan.Node_PROJECT,
+					Children: []int32{lastNodeID},
+					ProjectList: []*plan.Expr{{
+						Typ: selectNode.ProjectList[pkPos].Typ,
+						Expr: &plan.Expr_Col{Col: &plan.ColRef{
+							RelPos: selectTag, ColPos: pkPos,
+						}},
+					}},
+					BindingTags: []int32{builder.genNewBindTag()},
+				}, bindCtx)
+				// A normal DML step drains the exact check to EOF. All steps must
+				// succeed before commit; a duplicate cancels/rolls back the writes.
+				builder.appendStep(validationID)
+				lastNodeID = builder.appendTaggedSinkScan(bindCtx, loadSourceStep, selectTag)
+				selectNode = builder.qry.Nodes[lastNodeID]
+			}
 			if emitODKUActionRows {
 				if len(odkuActionConstraintDef.Checks) > 0 {
 					lastNodeID, err = appendCheckConstraintPlan(
```

**File**: `pkg/sql/plan/load_primary_key_test.go` (modified, +105/-0)
```diff
@@ -50,6 +50,9 @@ func TestLoadPrimaryKeyValidationPlan(t *testing.T) {
 				}
 			}
 			require.Equal(t, tc.want, dedups)
+			if tc.want > 0 {
+				requireLoadValidationIndependentOfWrites(t, pn.GetQuery())
+			}
 			if tc.table == "dept" {
 				maintained := 0
 				for _, n := range pn.GetQuery().Nodes {
@@ -63,6 +66,62 @@ func TestLoadPrimaryKeyValidationPlan(t *testing.T) {
 	}
 }
 
+func TestLoadPrimaryKeyValidationJoinOrientation(t *testing.T) {
+	for _, tc := range []struct {
+		name     string
+		spillMem int64
+		right    bool
+	}{
+		{"right map fits", 512 << 20, true},
+		{"left spill fallback", 1 << 20, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			proc := newPlanTestProcess(t)
+			proc.Base.Lim.Size = 2 << 30 // Budget the estimated keys, without allocating rows.
+			mock := NewMockOptimizer(true, proc)
+			pn, err := runOneStmt(mock, t, "load data inline format='csv', data='1,d,l' into table dept fields terminated by ','")
+			require.NoError(t, err)
+			qry := pn.GetQuery()
+			var check *planpb.Node
+			for _, n := range qry.Nodes {
+				if n.NodeType == planpb.Node_JOIN && n.JoinType == planpb.Node_DEDUP {
+					require.Nil(t, check)
+					check = n
+				}
+			}
+			require.NotNil(t, check)
+			// Restore logical roles before rerunning the real orientation passes.
+			if check.IsRightJoin {
+				check.Children[0], check.Children[1] = check.Children[1], check.Children[0]
+				check.IsRightJoin = false
+			}
+			// Runtime filters are generated after these passes. Remove that later
+			// physical dependency before changing the costing inputs and replaying.
+			check.RuntimeFilterBuildList = nil
+			check.RuntimeFilterProbeList = nil
+			target, input := check.Children[0], check.Children[1]
+			require.Equal(t, planpb.Node_TABLE_SCAN, qry.Nodes[target].NodeType)
+			require.Equal(t, planpb.Node_SINK_SCAN, qry.Nodes[input].NodeType)
+			qry.Nodes[target].Stats = &planpb.Stats{Outcnt: 100, Rowsize: 8}
+			qry.Nodes[input].Stats = &planpb.Stats{Outcnt: 1 << 20, Rowsize: 1 << 10}
+			builder := NewQueryBuilder(planpb.Query_INSERT, &mock.ctxt, false, true)
+			builder.qry = qry
+			builder.joinSpillMem = tc.spillMem
+			builder.determineBuildAndProbeSide(check.NodeId, false)
+			require.True(t, check.IsRightJoin, "costing chooses the smaller existing target")
+			builder.disableMemoryUnsafeRightDedup(check.NodeId)
+			require.Equal(t, tc.right, check.IsRightJoin)
+			builder.swapJoinChildren(check.NodeId)
+			want := []int32{target, input}
+			if tc.right {
+				want = []int32{input, target}
+			}
+			require.Equal(t, want, check.Children)
+			requireLoadValidationIndependentOfWrites(t, qry)
+		})
+	}
+}
+
 func TestLoadPrimaryKeyValidationFallback(t *testing.T) {
 	old := config.CNPrimaryCheck.Load()
 	t.Cleanup(func() { config.CNPrimaryCheck.Store(old) })
@@ -142,4 +201,50 @@ func TestLoadCompositePrimaryKeyValidationPlan(t *testing.T) {
 		}
 	}
 	require.True(t, found)
+	requireLoadValidationIndependentOfWrites(t, pn.GetQuery())
+}
+
+// A successful FAIL check preserves the input row set, but its hash partitions
+// must not become the bulk writer's partitions. Check both sides of the shared
+// source so retaining an unreachable DEDUP node cannot satisfy this contract.
+func requireLoadValidationIndependentOfWrites(t *testing.T, qry *planpb.Query) {
+	t.Helper()
+	var validationSources, writeSources []int32
+	var visit func(int32, bool)
+	visit = func(id int32, writing bool) {
+		n := qry.Nodes[id]
+		if writing {
+			require.False(t, n.NodeType == planpb.Node_JOIN && n.JoinType == planpb.Node_DEDUP,
+				"bulk writers must read the prepared input, independently of validation partitioning")
+		}
+		if n.NodeType == planpb.Node_SINK_SCAN {
+			if writing {
+				writeSources = append(writeSources, n.SourceStep...)
+			} else {
+				validationSources = append(validationSources, n.SourceStep...)
+			}
+		}
+		for _, child := range n.Children {
+			visit(child, writing)
+		}
+	}
+	for _, n := range qry.Nodes {
+		if n.NodeType == planpb.Node_MULTI_UPDATE {
+			visit(n.NodeId, true)
+		}
+	}
+	for _, root := range qry.Steps {
+		n := qry.Nodes[root]
+		if n.NodeType == planpb.Node_PROJECT && len(n.Children) == 1 {
+			child := qry.Nodes[n.Children[0]]
+			if child.NodeType == planpb.Node_JOIN && child.JoinType == planpb.Node_DEDUP {
+				require.Equal(t, planpb.Node_FAIL, child.OnDuplicateAction)
+				require.Len(t, n.ProjectList, 1, "validation retains only the primary-key identity")
+				visit(root, false)
+			}
+		}
+	}
+	require.NotEmpty(t, validationSources, "the independent validation must be an executable step")
+	require.NotEmpty(t, writeSources)
+	require.Equal(t, validationSources, writeSources, "both branches consume one prepared image")
 }
```

**File**: `pkg/tests/issues/issue_30411_test.go` (modified, +18/-0)
```diff
@@ -106,6 +106,24 @@ func TestLoadRejectsDuplicatePrimaryKeys(t *testing.T) {
 			exec(t, load(writeInput(t, "composite_valid.csv", "1,1\n1,2\n"), "composite"))
 			require.Equal(t, 2, count(t, "composite"))
 		})
+		t.Run("shared prepared image and index rollback", func(t *testing.T) {
+			exec(t, "create table indexed(id int auto_increment primary key, u int unique key, v int, key idx_v(v))")
+			path := writeInput(t, "indexed.csv", "10,100\n20,200\n")
+			exec(t, load(path, "indexed")+" (u,v)")
+			var image string
+			require.NoError(t, conn.QueryRowContext(ctx,
+				"select group_concat(concat(id,':',u,':',v) order by id) from indexed").Scan(&image))
+			require.Equal(t, "1:10:100,2:20:200", image, "auto-increment image is evaluated once for validation and writes")
+			requireDuplicate(t, load(writeInput(t, "indexed_conflict.csv", "3,30,300\n1,40,400\n"), "indexed"))
+			require.Equal(t, 2, count(t, "indexed"))
+			var visible int
+			require.NoError(t, conn.QueryRowContext(ctx, "select count(*) from indexed force index(idx_v) where v>=300").Scan(&visible))
+			require.Zero(t, visible, "rejected LOAD leaves no secondary-index rows")
+			require.NoError(t, conn.QueryRowContext(ctx, "select count(*) from indexed where u in (30,40)").Scan(&visible))
+			require.Zero(t, visible, "rejected LOAD leaves no unique-index rows")
+			exec(t, load(writeInput(t, "indexed_reuse.csv", "3,30,300\n"), "indexed"))
+			require.Equal(t, 3, count(t, "indexed"))
+		})
 		t.Run("foreign key fallback", func(t *testing.T) {
 			exec(t, "create table parent(id int primary key)")
 			exec(t, "insert into parent values(1)")
```

#### Recent Merged Pull Requests:
- **PR #30606** (2026-10-19): fix(fulltext2): evict idle search cache after CDC flush so incremental DML is visible (#30401) (@cpegeric)
- **PR #30602** (2026-10-19): test(disttae): guard catalog replacement across lineage snapshot advance (@XuPeng-SH)
- **PR #30594** (2026-10-19): fix(plan): allow zero temporal column defaults by SQL mode (@jiangxinmeng1)
- **PR #30593** (2026-10-19): fix(shardservice): count only local replicas in HasAllLocalReplicas (#25874) (@daviszhen)
- **PR #30592** (2026-10-19): fix(build): ignore thirdparties scratch trees in native provenance checks (#30235) (@daviszhen)
- **PR #30589** (2026-10-19): fix(plan): report errno 1452 for INSERT foreign-key violations (#30540) (@daviszhen)

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

## X. preserve prepared temporal result types and values (#30224)

**RULE**:
When implementing operations in `docs/design/unary_timestamp_result_contract_v1.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d82e828b`: preserve prepared temporal result types and values (#30224). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/unary_timestamp_result_contract_v1.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Unary TIMESTAMP result contract, revision 1

Status: implemented compatibility design; independent review pending.
PR: https://github.com/matrixorigin/matrixone/pull/30224
Review addressed: https://github.com/matrixorigin/matrixone/pull/30224#pullrequestreview-5525155127

## Invariant

A serialized function identity has one physical result-vector type. Unary
`TIMESTAMP` now binds a DATETIME result, preserving civil time and source FSP;
reusing its released TIMESTAMP identities lets an older worker allocate the
wrong result wrapper and panic during a rolling upgrade.

## Identities and admission

| Encoded identity (function 250) | Physical result | Binding | Required protocol |
| --- | --- | --- | --- |
| 0–4 (DATE, DATETIME, TIMESTAMP, VARCHAR, CHAR) | TIMESTAMP | Execution of released expressions only | Existing temporal floor 98 |
| 5 (two arguments) | DATETIME | Unchanged | Existing temporal floor 98 |
| 6–10 (corresponding unary signatures) | DATETIME | All new unary binding, including PREPARE/rebind | 122 |

Official main `873282742714436bff407dfcdbbe879147162bd3` advertises protocol 121;
this single capability uses the next value, 122. A later rebase must allocate
again fr
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d82e828b` are properly handled with clean fallback behavior.
