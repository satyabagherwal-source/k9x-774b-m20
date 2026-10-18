> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `2508ce70`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:48:14.409Z  
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
> **Harvest Timestamp**: 2026-10-18T22:48:14.402Z  
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
- **Issue #30536** (2026-10-18): **fix(morpc): retain writer buffers until write loop exits**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #30532  ## What this PR does / why we need it:  Public MORPC client-session close could release the transport reference owned by an active writer. When the application read owner also closed, Goetty freed the buffers while Encode/Flush still used them, explaining the zero-capacity ByteBuf panic during restart shutdown.  Separate socket interruption from final buffer release using existing Goetty ownership: public close disconnects and cancels writes; only the writer finalizer or rejected-start rollback releases the writer reference. Keep generation-aware session retirement unchanged. This adds no lock, copy, allocation, or per-message work to the normal path and changes no wire/storage format or dependency.  Deterministic regression coverage uses real Goetty sessions and explicit barriers to check borrowed-buffer lifetime, rejected writer startup, blocked flush/payload writes, message release, and final buffer reclamation. The active-Encode test fails on the unchanged production base (two buffers freed prematurely) and passes with this fix. This reproduces the lifetime defect; it does not claim to reproduce the exact original CI instruction interleaving.  Validation (Linux/amd64, Go 1.27.1, canonical isolated native build):  - Full MORPC normal and race suites pass. - Three new regression 

- **Issue #30535** (2026-10-18): **test(ut): stabilize cooperative helper cancellation fixtures**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #30281.  ## What this PR does / why we need it:  Cooperative cancellation fixtures shortened the helper grace period to one second, below the runner's supported minimum. Under delayed completion, the parent KILLs the helper before its acknowledgement, retains the private report, and returns 125; the engine fixture's missing-report check then reports 92. This matches the failure boundary in [the PR #30513 Ubuntu UT job](https://github.com/matrixorigin/matrixone/actions/runs/39136968810/job/117703366829?pr=30513).  Remove the three artificial grace overrides and use the existing 60-tick default. Strengthen the engine-registration and heavy/plan cases using their existing FIFOs: hold completion publication until the fifth real grace tick, verify the report is still unconsumed, then release and verify acknowledgement 143. Preserve the original cancellation entry points, real liveness/KILL/drain logic, exact report assertions and forced-stop controls. Production scripts and the outer test deadline stay unchanged. No retries, new sleeps or extra fixture processes are added.  Validation on Go 1.27.1:  - A controlled short-grace mutation of the final tests fails both roots through actual KILL/empty acknowledgement/retained report, reproducing 125 and 92. The default-grace tests pass. This iso

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

### Incident Patch 1: `68e642fd` (2026-10-18)
**Commit Message**: fix: avoid global lineage gate during ALTER COPY preparation (#29798)

### Design record

- Added versioned design: `docs/design/20261010-alter-copy-pre-publication.md`.
- The design records the speculative-preparation/publication split, authoritative after-copy source-frontier revalidation, persisted-delete coverage, actual nested lock state, terminal retry and whole-transaction rollback ownership, transaction-local relation and workspace-write handling, alternatives, compatibility, source-state cost model, and validation map.
- Independent design approval of that exact revision is still required before implementation approval.

### Root cause

`ALTER TABLE ... COPY` acquired the transaction-scoped global SNAPSHOT lineage-owner gate before temporary-table creation, physical row copy, auto-increment reconciliation, and unaffected-index cloning. Every independent branch ALTER therefore held the stable `mo_catalog.mo_feature_registry` row for `SNAPSHOT` until commit. Under the reported 500-worker workload, unrelated ALTERs serialized behind each other and eventually returned MySQL 1205 lock-wait timeouts or MySQL 2013 connection losses.

Moving physical work before that gate also exp

**File**: `docs/design/20261010-alter-copy-pre-publication.md` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# ALTER COPY pre-publication design
+
+- Status: proposed; independent design approval required before implementation approval.
+- Issue: #29208.
+- Implementation PR: #29798.
+- Design trigger: materially changes the COPY ALTER concurrency, retry, and lifecycle model.
+- Supersedes: none; extends the RC lifecycle contract in [20260929-rc-lifecycle-protocol.md](20260929-rc-lifecycle-protocol.md).
+
+## Problem
+
+`ALTER TABLE ... COPY` currently acquires the global SNAPSHOT lineage gate before physical preparation. The gate is transaction-scoped and intentionally broad, so unrelated branch ALTERs serialize behind each other and can eventually return lock-wait timeouts or connection losses under high concurrency.
+
+The correctness invariant is unchanged: publication must not expose a stale or inconsistent source snapshot, and every source or lineage mutation that could invalidate the copy must be detected before publication.
+
+## Goals
+
+- Let independent ALTER COPY operations prepare physical work without waiting on each other’s global lineage gate.
+- Preserve atomic publication and global ordering for genuinely conflicting lifecycle owners.
+- Keep speculative preparation from retaining source database or source catalog locks.
+- Use an existing authoritative source-commit frontier instead of constructing a full CDC replay pipeline.
+- Make post-physical source races terminal so RC statement retry cannot repeat a full copy while retaining publication locks.
+- Bound the redesign to ALTER COPY and existing lifecycle protocols.
+
+## Non-goals
+
+- Remove or weaken the global SNAPSHOT lineage gate.
+- Change DATA BRANCH, Snapshot, PITR, restore, or GC ownership.
+- Introduce a new distributed protocol or persistence format.
+- Change unrelated DDL paths.
+
+## Selected design
+
+### Transaction and mode coverage
+
+For a non-temporary relation, all transaction modes use the same ordering: physical preparation first, then publication admission and validation. Mode-specific admission is:
+
+- pessimistic RC uses broad-table lifecycle admission;
+- other pessimistic modes use the pessimistic lineage-owner gate;
+- optimistic transactions perform no prepublication source locks and still validate the resolved source before publication.
+
+`ErrTxnWriteConflict` is transaction-fatal in the frontend rollback policy. Autocommit and explicit transactions therefore roll back through the frontend transaction owner; the ALTER statement never silently retries the conflict.
+
+### Pre-publication phase
+
+The transaction resolves the source and records the copy timestamp, then performs transaction-local preparation:
+
+1. create the temporary target relation;
+2. copy source rows at the recorded timestamp;
+3. reconcile auto-increment state;
+4. clone unaffected indexes, including lock-disabled cleanup of transaction-created replacement hidden tables.
+
+The temporary CREATE, row copy, and nested replacement-index cleanup use `WithDisableLock`, so nested execution acquires neither pre-pipeline metadata/table locks nor row-lock operators. The lock-free policy is a property of the whole statement tree, not only the statements the compiler itself issues: the internal SQL executor carries it on the nested statement context, so service-owned catalog SQL triggered by the same statement — partition-service metadata writes and auto-increment allocator column writes, both of which run on service executors with fresh statement options — inherits `WithDisableLock` too. Without that inheritance a partitioned or AUTO_INCREMENT preparation would retain public catalog locks that publication admission cannot certify as private, reintroducing FastFail failures for unrelated publishers; the rows those services write address keys unique to the in-flight private preparation, so the same isolation argument as the private CREATE applies. The temporary CREATE also skips transient index CDC and idxcron task registration; because no tasks are registered, ALTER skips their catalog cleanup deletes, while post-rename publication retains the existing final task-registration path. The registration opt-out is a property of that one nested compiler generation only: `Compile.clear` resets the flag with the other per-statement flags before the object returns to the global reuse pool, and `NewCompile` re-initializes it, so the suppression cannot reach an unrelated later `CREATE TABLE`. Row copy, allocator reconciliation, and index cloning operate through the current transaction and can consume engine/workspace resources; they may retain table locks on transaction-created replacement or index tables, but not source database/catalog/name locks. No global lineage gate is held.
+
+In pessimistic RC the copy timestamp is recorded by advancing the transaction snapshot through `databranchutils.AdvanceLineageSnapshot` before preparation begins. The workspace owns that advancement — `Workspace.AdvanceSnapshot` relocates transaction-local tombs
```

**File**: `pkg/common/moerr/txn.go` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ var wholeTxnRollbackCodes = [...]uint16{
 	ErrLockTableNotFound, ErrDeadlockCheckBusy, ErrLockConflict,
 	ErrRemoteLockWaitTimeout, ErrLockWaitTimeout, ErrTxnUnknown,
 	ErrBackendClosed, ErrNoAvailableBackend, ErrBackendCannotConnect,
+	ErrTxnWriteConflict,
 }
 
 // WholeTxnRollbackCodes returns a copy for diagnostics/tests without exposing
```

**File**: `pkg/frontend/rollback_on_error_test.go` (modified, +5/-0)
```diff
@@ -119,6 +119,9 @@ func TestStaticRollbackSetIsInfrastructureOnly(t *testing.T) {
 	// a genuine infrastructure failure still ends the transaction, with or
 	// without the session variable
 	require.True(t, isErrorRollbackWholeTxn(moerr.NewDeadLockDetectedNoCtx()))
+	require.True(t, isErrorRollbackWholeTxn(
+		moerr.NewTxnWriteConflict(context.Background(), "concurrent source change"),
+	))
 }
 
 // unknownVarSession is a FeSession whose system-variable lookup fails, which
@@ -264,6 +267,8 @@ func newErrorRollbackWholeTxn(code uint16) error {
 		return moerr.NewNoAvailableBackendNoCtx()
 	case moerr.ErrBackendCannotConnect:
 		return moerr.NewBackendCannotConnectNoCtx("test")
+	case moerr.ErrTxnWriteConflict:
+		return moerr.NewTxnWriteConflictNoCtx("test")
 	default:
 		panic(fmt.Sprintf("unsupported error code %d", code))
 	}
```

**File**: `pkg/frontend/util_test.go` (modified, +1/-0)
```diff
@@ -1457,6 +1457,7 @@ func Test_isErrorRollbackWholeTxn(t *testing.T) {
 	assert.Equal(t, true, isErrorRollbackWholeTxn(moerr.NewBackendClosedNoCtx()))
 	assert.Equal(t, true, isErrorRollbackWholeTxn(moerr.NewNoAvailableBackendNoCtx()))
 	assert.Equal(t, true, isErrorRollbackWholeTxn(moerr.NewBackendCannotConnectNoCtx("test")))
+	assert.Equal(t, true, isErrorRollbackWholeTxn(moerr.NewTxnWriteConflictNoCtx("test")))
 }
 
 func TestNewErrorRollbackWholeTxnCoversEveryCode(t *testing.T) {
```

**File**: `pkg/sql/compile/alter.go` (modified, +403/-197)
```diff
@@ -89,6 +89,11 @@ type alterDataBranchLineagePlan struct {
 	fixedCopyTS              bool
 }
 
+type alterDataBranchLineageInspection struct {
+	participates bool
+	plan         alterDataBranchLineagePlan
+}
+
 func alterCopySQLAtLineageSnapshot(sql string, plan alterDataBranchLineagePlan) string {
 	if !plan.enabled || !plan.fixedCopyTS {
 		return sql
@@ -228,17 +233,20 @@ func (c *Compile) alterTableParticipatesInDataBranch(oldTableID uint64) (bool, e
 func (c *Compile) alterTableHasHistoricalBranchSource(
 	oldTableID uint64,
 	databaseName, tableName string,
+	lockHistoricalSource bool,
 ) (bool, error) {
 	return alterDataBranchHistoricalSourceExists(
 		func(sql string) (executor.Result, error) {
 			return c.runSqlWithResult(sql, int32(catalog.System_Account))
 		},
 		[]string{
-			alterDataBranchHistoricalSnapshotSourceSQL(
+			alterDataBranchHistoricalSnapshotSourceProbeSQL(
 				c.proc.GetSessionInfo().Account, databaseName, tableName, oldTableID,
+				lockHistoricalSource, 0,
 			),
-			alterDataBranchHistoricalPitrSourceSQL(
+			alterDataBranchHistoricalPitrSourceProbeSQL(
 				c.proc.GetSessionInfo().Account, databaseName, tableName, oldTableID,
+				lockHistoricalSource, 0,
 			),
 		},
 	)
@@ -301,26 +309,47 @@ func (c *Compile) lockDataBranchLineageOwnerLifecyclePessimistic() error {
 	)
 }
 
-func (c *Compile) prepareAlterDataBranchLineage(
+func (c *Compile) inspectAlterDataBranchLineage(
 	oldTableID uint64,
 	databaseName, tableName string,
 	statement string,
-) (alterDataBranchLineagePlan, error) {
+	lockHistoricalSource bool,
+) (alterDataBranchLineageInspection, error) {
 	participates, err := c.alterTableParticipatesInDataBranch(oldTableID)
 	if err != nil {
-		return alterDataBranchLineagePlan{}, err
+		return alterDataBranchLineageInspection{}, err
+	}
+	lineagePlan, err := c.inspectAlterDataBranchLineageState(
+		participates, oldTableID, databaseName, tableName, statement, lockHistoricalSource,
+	)
+	if err != nil {
+		return alterDataBranchLineageInspection{}, err
 	}
+	return alterDataBranchLineageInspection{
+		participates: participates,
+		plan:         lineagePlan,
+	}, nil
+}
+
+func (c *Compile) inspectAlterDataBranchLineageState(
+	participates bool,
+	oldTableID uint64,
+	databaseName, tableName string,
+	statement string,
+	lockHistoricalSource bool,
+) (alterDataBranchLineagePlan, error) {
 	hasLiveLineage := false
+	var err error
 	if participates {
 		// ALTER-only rows preserve physical history for a snapshot or PITR but
 		// are not logical data branches. Inspect the complete connected
 		// component so an ALTER generation neither triggers a false transaction
 		// restriction nor hides a live logical sibling behind an ancestor.
-		ownershipDAG, dagErr := c.loadAlterDataBranchDAG(false)
+		dag, dagErr := c.loadAlterDataBranchDAG(false)
 		if dagErr != nil {
 			return alterDataBranchLineagePlan{}, dagErr
 		}
-		if ownershipDAG.ComponentHasLiveLogicalBranch(oldTableID) {
+		if dag.ComponentHasLiveLogicalBranch(oldTableID) {
 			op := c.proc.GetTxnOperator()
 			opts := op.TxnOptions()
 			// TRUNCATE commits the transaction that preceded the statement and
@@ -343,19 +372,12 @@ func (c *Compile) prepareAlterDataBranchLineage(
 				return alterDataBranchLineagePlan{}, err
 			}
 		}
-		if err = c.compactExpiredAlterDataBranchLineage(time.Time{}); err != nil {
-			return alterDataBranchLineagePlan{}, err
-		}
-		dag, dagErr := c.loadAlterDataBranchDAG(false)
-		if dagErr != nil {
-			return alterDataBranchLineagePlan{}, dagErr
-		}
 		hasLiveLineage = dag.SubtreeHasLiveNode(oldTableID)
 	}
 	preserveHistoricalSource := false
 	if !hasLiveLineage {
 		if preserveHistoricalSource, err = c.alterTableHasHistoricalBranchSource(
-			oldTableID, databaseName, tableName,
+			oldTableID, databaseName, tableName, lockHistoricalSource,
 		); err != nil {
 			return alterDataBranchLineagePlan{}, err
 		}
@@ -370,6 +392,64 @@ func (c *Compile) prepareAlterDataBranchLineage(
 	}, nil
 }
 
+func (c *Compile) prepareAlterDataBranchLineage(
+	oldTableID uint64,
+	databaseName, tableName string,
+	statement string,
+) (alterDataBranchLineagePlan, error) {
+	inspection, err := c.inspectAlterDataBranchLineage(
+		oldTableID, databaseName, tableName, statement, true,
+	)
+	if err != nil || !inspection.participates {
+		return inspection.plan, err
+	}
+	if err = c.compactExpiredAlterDataBranchLineage(time.Time{}); err != nil {
+		return alterDataBranchLineagePlan{}, err
+	}
+	lineagePlan, err := c.inspectAlterDataBranchLineageState(
+		true, oldTableID, databaseName, tableName, statement, true,
+	)
+	return lineagePlan, err
+}
+
+func (c *Compile) completeAlterDataBranchLineagePlan(
+	lineagePlan alterDataBranchLineagePlan,
+	oldTableID uint64,
+	databaseName, tableName string,
+) (alterDataBranchLineagePlan, error) {
+	if lineagePlan.enabled {
+		return lineagePlan, nil
+	}
+	hasLatestHistory, err := c.alterTableHasLatestHistoricalBranchSource(
+		oldTableID, databaseName, tableNa
```

**File**: `pkg/sql/compile/alter_test.go` (modified, +1272/-20)
```diff
@@ -20,6 +20,8 @@ import (
 	"fmt"
 	"slices"
 	"strings"
+	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -644,6 +646,62 @@ func TestPrepareAlterDataBranchLineageAllowsHistoricalSourceTxn(t *testing.T) {
 	}
 }
 
+func TestInspectAlterDataBranchLineageSeesBranchCreatedAfterPreflight(t *testing.T) {
+	const (
+		oldTableID    = uint64(42)
+		parentTableID = uint64(41)
+		database      = "test"
+		table         = "dept"
+	)
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+	spyExec := &alterCopyInsertSpyExecutor{
+		resultSequences: make(map[string][]executor.Result),
+		results:         make(map[string]executor.Result),
+	}
+	c := newAlterCopyPrecheckCompile(t, ctrl, spyExec)
+	txnOperator := mock_frontend.NewMockTxnOperator(ctrl)
+	txnOperator.EXPECT().TxnOptions().Return(txn.TxnOptions{Autocommit: true}).AnyTimes()
+	txnOperator.EXPECT().Txn().Return(txn.TxnMeta{}).AnyTimes()
+	c.proc.Base.TxnOperator = txnOperator
+	participationSQL := alterDataBranchParticipationSQL(oldTableID)
+	metadataSQL := "select table_id, p_table_id, clone_ts, creator, level, table_deleted from mo_catalog.mo_branch_metadata"
+	emptyParticipation := newAlterCopyFixedResult(
+		t, c.proc.Mp(), types.T_int32.ToType(), []int32{},
+	)
+	liveParticipation := newAlterCopyFixedResult(
+		t, c.proc.Mp(), types.T_int32.ToType(), []int32{1},
+	)
+	spyExec.resultSequences[participationSQL] = []executor.Result{
+		emptyParticipation, liveParticipation,
+	}
+	spyExec.results[metadataSQL] = newAlterLineageMetadataResult(
+		t, c.proc.Mp(), []uint64{oldTableID}, []uint64{parentTableID}, []int64{100},
+		[]uint64{uint64(catalog.System_Account)}, []string{"table"}, []bool{false},
+	)
+
+	preflight, err := c.inspectAlterDataBranchLineage(
+		oldTableID, database, table, "ALTER", false,
+	)
+	require.NoError(t, err)
+	require.False(t, preflight.participates)
+	require.False(t, preflight.plan.enabled)
+
+	afterGate, err := c.inspectAlterDataBranchLineage(
+		oldTableID, database, table, "ALTER", true,
+	)
+	require.NoError(t, err)
+	require.True(t, afterGate.participates)
+	require.True(t, afterGate.plan.enabled)
+	require.Equal(t, []string{
+		participationSQL,
+		alterDataBranchHistoricalSnapshotSourceProbeSQL("", database, table, oldTableID, false, 0),
+		alterDataBranchHistoricalPitrSourceProbeSQL("", database, table, oldTableID, false, 0),
+		participationSQL,
+		metadataSQL,
+	}, spyExec.executedSQLs)
+}
+
 func TestPrepareAlterDataBranchLineageAllowsHistoricalOnlyGenerationInExplicitTxn(t *testing.T) {
 	const (
 		oldTableID    = uint64(42)
@@ -732,6 +790,95 @@ func TestAdvanceAlterDataBranchLineageSnapshotUsesWorkspace(t *testing.T) {
 	require.Equal(t, int64(2000), cloneTS)
 }
 
+// TestAlterCopyRetainsWorkspaceAdvancedSnapshotOnEveryReturn pins the ownership
+// contract of databranchutils.AdvanceLineageSnapshot inside ALTER COPY: once
+// the workspace has advanced (relocating transaction-local tombstones to their
+// post-flush row locations), every ALTER COPY return path must retain that
+// workspace-owned snapshot. Rewinding only the transaction timestamp leaves the
+// workspace and the snapshot in different generations and resurrects relocated
+// deletes, the defect removed from main by #29539.
+func TestAlterCopyRetainsWorkspaceAdvancedSnapshotOnEveryReturn(t *testing.T) {
+	const initialSnapshot = int64(1000)
+	advanceErr := errors.New("workspace advance failed")
+	copyErr := errors.New("stop after physical ALTER COPY")
+	for _, tc := range []struct {
+		name string
+		// advanceFails returns before any physical work; otherwise the physical
+		// row copy fails, exercising the post-advancement error return.
+		advanceFails bool
+	}{
+		{name: "advance failure", advanceFails: true},
+		{name: "physical copy failure"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			defer ctrl.Finish()
+
+			exec := &alterCopyInsertSpyExecutor{
+				createSQL: "create table dept_copy",
+				insertSQL: "insert into dept_copy select * from dept",
+				insertErr: copyErr,
+			}
+			stubAlterCopySourceLocks(t, nil)
+			scope, compile := newAlterCopyGateConcurrencyFixture(
+				t, ctrl, exec, "rc-snapshot-retain", initialSnapshot,
+			)
+
+			current := timestamp.Timestamp{PhysicalTime: initialSnapshot}
+			advances := 0
+			ws := &Ws{advanceSnapshot: func(_ context.Context, ts timestamp.Timestamp) error {
+				if tc.advanceFails {
+					return advanceErr
+				}
+				// The workspace owns the transfer: relocated tombstones and the
+				// operator snapshot move to the advanced generation together.
+				current = timestamp.Timestamp{PhysicalTime: ts.PhysicalTime + 1}
+				advances++
+				return nil
+			}}
+			txnOperator := mock_frontend.NewMockTxnOperator(ctrl)
+			txnOperator.EXPECT().GetWorkspace().Return(ws).AnyTimes()
+			txnOperator.EXPECT().Txn().Return(txn.TxnMeta{
+				Mode:      txn.TxnMode_Pessimistic,
+				Isolation: txn.TxnIsolation_RC,
+			}).AnyTimes()
+			txnOperator.EXPECT().TxnOptions().Retu
```

**File**: `pkg/sql/compile/compile.go` (modified, +26/-5)
```diff
@@ -156,6 +156,10 @@ func NewCompile(
 	c.startAt = startAt
 	c.disableRetry = false
 	c.retryTimes = 0
+	// Start every new compilation with the ordinary index-registration policy.
+	// The ALTER COPY private preparation opts out through its executor options;
+	// that opt-out must not survive into this object's next pool generation.
+	c.skipIndexTaskRegistration = false
 	c.ncpu = system.GoMaxProcs()
 	c.lockMeta = NewLockMeta()
 	// TODO: The action of updating the WriteOffset logic should be executed in the `func (c *Compile) Run(_ uint64)` method.
@@ -566,6 +570,7 @@ func (c *Compile) clear() {
 	c.keepAutoIncrement = 0
 	c.lastInsertIDBaseline = 0
 	c.disableLock = false
+	c.skipIndexTaskRegistration = false
 	c.prePipelineLockTableID = 0
 	c.icebergScanPlanner = nil
 
@@ -839,15 +844,19 @@ func (c *Compile) printPipeline() {
 // 1. lock table.
 // 2. init data source.
 func (c *Compile) prePipelineInitializer() (startedSources []*materialized.Source, err error) {
-	// do table lock.
-	if err = c.lockMeta.doLock(c.e, c.proc); err != nil {
-		return nil, err
+	if !c.disableLock {
+		// do table lock.
+		if err = c.lockMeta.doLock(c.e, c.proc); err != nil {
+			return nil, err
+		}
 	}
 	if err = c.unresolvedIndexHintError(); err != nil {
 		return nil, err
 	}
-	if err = c.lockTable(); err != nil {
-		return nil, err
+	if !c.disableLock {
+		if err = c.lockTable(); err != nil {
+			return nil, err
+		}
 	}
 	if err = c.maybePromoteLoadUniqueIndexes(); err != nil {
 		return nil, err
@@ -9516,6 +9525,9 @@ func (c *Compile) compileDelete(node *plan.Node, ss []*Scope) ([]*Scope, error)
 }
 
 func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
+	if c.disableLock {
+		return ss, nil
+	}
 	lockRows := make([]*plan.LockTarget, 0, len(node.LockTargets))
 	localizeLockPlan := c.loadUniqueIndexPromotion != nil || c.prePipelineLockTableID != 0
 	promotedNewTable := false
@@ -11143,6 +11155,8 @@ func (c *Compile) runSqlWithResultAndOptions(
 
 	lower := c.getLower()
 
+	options = c.internalStatementOption(options)
+
 	if c.pn != nil {
 		if qry, ok := c.pn.Plan.(*plan.Plan_Ddl); ok {
 			if qry.Ddl.DdlType == plan.DataDefinition_DROP_DATABASE {
@@ -11206,6 +11220,13 @@ func (c *Compile) runSqlWithResultAndOptions(
 	return exec.Exec(ctx, sql, opts)
 }
 
+func (c *Compile) internalStatementOption(options executor.StatementOption) executor.StatementOption {
+	if c.disableLock {
+		return options.WithDisableLock()
+	}
+	return options
+}
+
 func (c *Compile) fatalLog(retry int, err error) {
 	if err == nil {
 		return
```

**File**: `pkg/sql/compile/compile_test.go` (modified, +82/-0)
```diff
@@ -18,6 +18,8 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	goruntime "runtime"
+	godebug "runtime/debug"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -160,6 +162,71 @@ func TestCompileClearResetsExecutionType(t *testing.T) {
 	require.Zero(t, c.prePipelineLockTableID, "pooled compiles must not retain a backfill lock request")
 }
 
+func TestCompileClearResetsSkipIndexTaskRegistration(t *testing.T) {
+	// The ALTER COPY private replica create opts out of index task
+	// registration on its executor Compile. Exercise the pool reset directly,
+	// independent of which object sync.Pool would choose for the next
+	// allocation: a released Compile must not hand that suppression to an
+	// unrelated frontend statement.
+	c := &Compile{
+		proc:                      testutil.NewProcess(t),
+		MessageBoard:              message.NewMessageBoard(),
+		affectRows:                new(atomic.Uint64),
+		skipIndexTaskRegistration: true,
+	}
+	c.clear()
+	require.False(t, c.skipIndexTaskRegistration,
+		"a pooled compile must not retain the private index-registration policy")
+}
+
+func TestCompilePoolHandoffClearsPrivateIndexRegistrationPolicy(t *testing.T) {
+	// Reproduce the frontend ownership boundary: the private ALTER COPY
+	// executor releases its Compile, then an ordinary frontend statement
+	// allocates the next generation from the global reuse pool. Two layers
+	// hold that boundary: Release runs clear() before sync.Pool.Put, and
+	// NewCompile re-initializes the flag after sync.Pool.Get.
+	//
+	// sync.Pool's documented contract permits Put to discard values and Get
+	// to return an unrelated object, and the race runtime drops Put values
+	// deliberately (runtime_randn(4) in sync/pool.go), so pointer identity
+	// between the released and the reallocated compile cannot be required.
+	// The oracle is the policy of every object the public constructor
+	// returns: each round seeds the pool with the exact leak payload and
+	// asserts the ordinary registration policy on the constructed frontend
+	// compile. A leak can only travel through a Put that the pool kept, and
+	// every kept Put is a round whose frontend object is unconditionally
+	// checked, so drops never mask a leaked policy. The deterministic
+	// clear() reset layer stays covered, pool-free, by
+	// TestCompileClearResetsSkipIndexTaskRegistration.
+	oldProcs := goruntime.GOMAXPROCS(1)
+	defer goruntime.GOMAXPROCS(oldProcs)
+	oldPercent := godebug.SetGCPercent(-1)
+	defer godebug.SetGCPercent(oldPercent)
+
+	const handoffs = 16
+	sameObject := 0
+	for round := 0; round < handoffs; round++ {
+		private := NewCompile("test", "test", "create table __mo_alter_copy_replica", "", "",
+			nil, testutil.NewProcess(t), nil, false, nil, time.Now())
+		// txnExecutor.Exec sets this for the private replica create's nested
+		// compiler (sql_executor.go), which Release returns to the pool.
+		private.skipIndexTaskRegistration = true
+		private.Release()
+
+		frontend := NewCompile("test", "test", "create table ordinary", "", "",
+			nil, testutil.NewProcess(t), nil, false, nil, time.Now())
+		require.False(t, frontend.skipIndexTaskRegistration,
+			"round %d: a frontend compile must not inherit the private preparation policy", round)
+		frontend.Release()
+		if frontend == private {
+			sameObject++
+		}
+	}
+	// Informational only: the race runtime drops Put values purposefully, so
+	// zero reuse observations is a legitimate outcome, never a failure.
+	t.Logf("pool handed back the released compile in %d/%d rounds", sameObject, handoffs)
+}
+
 func TestCompileMongoDBQueryDiagnosticsAreRedacted(t *testing.T) {
 	for _, sql := range []string{
 		`select * from mongo_events where __mo_query = '{"filter":{"password":"super-secret-value"}}'`,
@@ -1148,6 +1215,21 @@ func TestCompileLockNonCandidatePreservesExactMainMutation(t *testing.T) {
 	require.Same(t, target, c.lockTables[target.TableId])
 }
 
+func TestCompileLockDisabledSkipsAllStatementLocks(t *testing.T) {
+	c := NewMockCompile(t)
+	c.disableLock = true
+	target := &plan.LockTarget{TableId: 42, LockTable: true}
+	node := &plan.Node{LockTargets: []*plan.LockTarget{target}}
+	scope := &Scope{}
+
+	got, err := c.compileLock(node, []*Scope{scope})
+	require.NoError(t, err)
+	require.Equal(t, []*Scope{scope}, got)
+	require.Nil(t, scope.RootOp)
+	require.Empty(t, c.lockTables)
+	require.Equal(t, []*plan.LockTarget{target}, node.LockTargets)
+}
+
 func TestCompileLockPrePipelineTargetAdmission(t *testing.T) {
 	for _, tc := range []struct {
 		name      string
```

---

### Incident Patch 2: `ff7f0183` (2026-10-18)
**Commit Message**: test: set a finite spill budget for shared SQL fixtures (#30488)

## What type of PR is this?

- [ ] API-change
- [ ] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

- #30480

## What this PR does / why we need it:

The shared embedded SQL fixture inherited the production automatic spill
policy. When the LOCAL filesystem had at most 16 GiB free, that policy
allowed only one byte of spill, so all four conversion-warning RETURNING
cases failed before reaching their result and diagnostic assertions.

Give each shared feature-test CN an explicit 64 MiB process spill
allowance before startup. Reuse the existing fixture and retain every
SQL statement and assertion. Production emergency headroom and dedicated
admission-rejection fixtures retain their configuration. The allowance
does not preallocate disk space; it is a per-process cap and an explicit
floor for the shared CN ledger, whose automatic capacity can be larger.

Validation on Go 1.27.1 / macOS arm64 using the repository CGo wrapper:

- With an unchanged Go overlay injecting a 4 GiB available-disk sample
at the actual sampler boundary, the origina

**File**: `pkg/embed/testing.go` (modified, +3/-0)
```diff
@@ -564,6 +564,9 @@ func adjustBasicClusterService(svc ServiceOperator) {
 				config.CN.LockService.MaxFixedSliceSize = 10001
 				config.CN.LockService.MaxLockRowCount = 10000
 				config.CN.Frontend.SkipCheckUser = false
+				// Bounded success-path tests own their spill allowance instead of
+				// depending on the production policy's 16 GiB free-disk headroom.
+				config.CN.Frontend.ProcessLimitationSpillSize = 64 << 20
 				// The shared feature-test fixture is a fully upgraded cluster.
 				config.CN.AutoIncrement.EnableAutoIDCache = true
 				config.CN.Frontend.Iceberg.Enable = true
```

---

### Incident Patch 3: `adbdd5c7` (2026-10-18)
**Commit Message**: fix(tests): renew view query context after cluster restart (#30517)

由 LW 授权的 ChatGPT Personal 智能体提交。

`TestViewDescriptionTwoCN` reused its initial three-minute SQL context after releasing and reacquiring the cluster lifecycle lease. A competing package can hold admission beyond that context's deadline: the restart succeeds but the following metadata query fails immediately.

Cancel the first generation's context before restart, then create and defer cancellation of a fresh three-minute query context after `cluster.Start()` succeeds. Existing SQL, view metadata, persistence, identity and cleanup assertions remain intact. No timeout is extended and admission is unchanged.

**Scope:** 1 file, +4/-0. No validation workflow or injection helper is included.
Product commit: `1c5bc4a36d0362b5a0ffe6c257ec9031fe81b028`, parent/tested main `3c07fac240311d6f2b706674614ed6034e97ff79`.
Independent review agent: **Approve**, including exact remote file/hash, actual test evidence and final delivery object.

### Actual verification

[Successful fork validation 39098117472](https://github.com/MatrixAdventurer/matrixone/actions/runs/39098117472), fixed verification commit `83ed8484f8ac69e90620860ea

**File**: `pkg/tests/sqlintegration/multicn/view_description_test.go` (modified, +4/-0)
```diff
@@ -164,7 +164,11 @@ func TestViewDescriptionTwoCN(t *testing.T) {
 	require.NoError(t, second.Close())
 	second = nil
 	require.NoError(t, cluster.Close())
+	cancel()
 	require.NoError(t, cluster.Start())
+	// Lifecycle admission must not consume the restarted generation's query budget.
+	ctx, restartCancel := context.WithTimeout(context.Background(), 3*time.Minute)
+	defer restartCancel()
 	require.Equal(t, firstID, cn0.ServiceID())
 	require.Equal(t, secondID, cn1.ServiceID())
 	require.NotSame(t, oldFirst, cn0.RawService())
```

#### Recent Merged Pull Requests:
- **PR #30536** (2026-10-18): fix(morpc): retain writer buffers until write loop exits (@XuPeng-SH)
- **PR #30535** (2026-10-18): test(ut): stabilize cooperative helper cancellation fixtures (@XuPeng-SH)
- **PR #30533** (2026-10-18): [Bug]: Preserve region fallback for SQL dynamic S3 (@Ariznawlll)
- **PR #30526** (2026-10-18): fix(sql): preserve UTF-8 boundaries in scalar warning echoes (@aptend)
- **PR #30525** (2026-10-18): fix(ci): keep Iceberg adapter checksums synchronized (@XuPeng-SH)
- **PR #30519** (2026-10-18): fix(fileservice): avoid draining COS responses on close (@iamlinjunhong)

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

## X. avoid global lineage gate during ALTER COPY preparation (#29798)

**RULE**:
When implementing operations in `docs/design/20261010-alter-copy-pre-publication.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `68e642fd`: avoid global lineage gate during ALTER COPY preparation (#29798). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261010-alter-copy-pre-publication.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# ALTER COPY pre-publication design

- Status: proposed; independent design approval required before implementation approval.
- Issue: #29208.
- Implementation PR: #29798.
- Design trigger: materially changes the COPY ALTER concurrency, retry, and lifecycle model.
- Supersedes: none; extends the RC lifecycle contract in [20260929-rc-lifecycle-protocol.md](20260929-rc-lifecycle-protocol.md).

## Problem

`ALTER TABLE ... COPY` currently acquires the global SNAPSHOT lineage gate before physical preparation. The gate is transaction-scoped and intentionally broad, so unrelated branch ALTERs serialize behind each other and can eventually return lock-wait timeouts or connection losses under high concurrency.

The correctness invariant is unchanged: publication must not expose a stale or inconsistent source snapshot, and every source or lineage mutation that could invalidate the copy must be detected before publication.

## Goals

- Let independent ALTER COPY operations prepare physical work without waiting on each other’s global lineage gate.
- Preserve atomic publication and global ordering for genuinely conflicting lifecycle owners.
- Keep speculative preparation from retaining source 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `68e642fd` are properly handled with clean fallback behavior.
