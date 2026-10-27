> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `935811ca`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T19:06:55.667Z  
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
> **Harvest Timestamp**: 2026-10-27T19:06:55.655Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2061 stars

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

from typing import Optional, Union, Type

try:
    from sqlalchemy import Table
    from sqlalchemy.orm import DeclarativeMeta as _unused  # noqa: F401

    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


def get_table_name(table: Union[str, Type]) -> str:
    """Extract table name from string or ORM model.

    Supports:
    - "table_name"
    - "db.table_name"
    - ORM model's resolved table name and schema for db.table
    """
    if isinstance(table, str):
        return table
    if SQLALCHEMY_AVAILABLE:
        mapped_table = getattr(table, '__table__', None)
        if isinstance(mapped_table, Table):
            return mapped_table.fullname
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
from typing import Callable, List, Optional, Union

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine

_initializing_clients = ContextVar('matrixone_initializing_clients', default=())


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
                else:
                    client.logger.warning(f"Unknown connection action: {action}")

            # Execute custom hook if provided
            if self.custom_hook:
                if hasattr(self.custom_hook, '__call__'):
                    # Check if it's an async function
                    if (
                        hasattr(self.custom_hook, '__code__') and self.custom_hook.__code__.co_flags & 0x80
                    ):  # Check if async
                        await self.custom_hook(client)
                    else:
                        # Try to call it as sync, but handle potential async functions
                        try:
                            result = self.custom_hook(client)
   
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

### Core Architecture Module: `optools/tpch_compare/worker_stream.go`
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
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

type workerControl struct{ gate, events *os.File }

func (c *workerControl) close() { _ = c.gate.Close(); _ = c.events.Close() }
func (c *workerControl) barrier(event string) error {
	if c == nil {
		return nil
	}
	if _, err := fmt.Fprintln(c.events, event); err != nil {
		return err
	}
	var b [1]byte
	_, err := io.ReadFull(c.gate, b[:])
	if err != nil {
		return err
	}
	if b[0] != 'g' {
		return errors.New("invalid controller gate")
	}
	return nil
}

func (c *workerControl) step(start bool, stream, query int, deadline int64) error {
	if c == nil {
		return nil
	}
	state := "end"
	if start {
		state = "start"
	}
	_, err := fmt.Fprintf(c.events, "%s %d %d %d\n", state, stream, query, deadline)
	return err
}

type waveClock struct {
	mu          sync.Mutex
	first, last time.Time
}

func (w *waveClock) start(t time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.first.IsZero() || t.Before(w.first) {
		w.first = t
	}
}
func (w *waveClock) finish(t time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if t.After(w.last) {
		w.last = t
	}
}
func (w *waveClock) elapsed() int64 {
	if w.first.IsZero() || w.last.IsZero() {
		return 0
	}
	return w.last.Sub(w.first).Nanoseconds()
}

func queryPermutation(queries []int, stream int, seed uint64) []int {
	out := slices.Clone(queries)
	if stream > 0 {
		rng := rand.New(rand.NewPCG(seed, uint64(stream)))
		rng.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	}
	return out
}

func runQueryStreams(ctx context.Context, db *sql.DB, first *sql.Conn, r WorkerRequest, d Dataset, control *workerControl, evidence *runtimeEvidence) (out []QueryReceipt, waveNS int64, retErr error) {
	seen := map[int]bool{}
	for _, n := range r.Queries {
		if n < 1 || n > 22 || seen[n] {
			return nil, 0, errors.New("invalid or duplicate query selection")
		}
		seen[n] = true
	}
	conns := []*sql.Conn{first}
	for i := 1; i < r.Clients; i++ {
		conn, err := configureConn(ctx, db, r.Engine)
		if err != nil {
			return nil, 0, err
		}
		defer func() { retErr = errors.Join(retErr, conn.Close()) }()
		conns = append(conns, conn)
	}
	if r.Warmup {
		warmQueries := allQueries()
		if r.WarmupSelected {
			warmQueries = r.Queries
		}
		for _, n := range warmQueries {
			q := d.Queries[n-1].rendered(fmt.Sprintf("warm_%d_%d", os.Getpid(), n))
			path := filepath.Join(r.OutputRoot, fmt.Sprintf("warm-q%02d.rows", n))
			deadline := r.QueryDeadlineNS
			if value := r.DeadlinesNS[n]; value > 0 {
				deadline = value
			}
			qctx, cancel := context.WithTimeoutCause(ctx, time.Duration(deadline), errors.New("warmup deadline"))
			if err := control.step(true, 0, n, deadline); err != nil {
				cancel()
				return nil, 0, err
			}
			_, err := executeUnit(qctx, first, q, path, captureDisk)
			cancel()
			err = errors.Join(err, control.step(false, 0, n, 0))
			if err != nil {
				return nil, 0, fmt.Errorf("warmup: %w", err)
			}
			if err := os.Remove(path); err != nil {
				return nil, 0, err
			}
		}
	}
	if err := configureNativeProfile(ctx, first, r); err != nil {
		return nil, 0, err
	}
	finishProfile, err := workerProfileStart(r)
	if err != nil {
		return nil, 0, err
	}
	defer func() { retErr = errors.Join(retErr, finishProfile()) }()
	if r.Profile != nil && (r.Profile.Kind == "alloc" || r.Profile.Kind == "wait") {
		if err := goProfileSnapshot(r.OutputRoot, "before", r.Profile.Kind); err != nil {
			return nil, 0, err
		}
	}
	if evidence != nil {
		evidence.before = runtimeSnapshot()
	}
	if err := control.barrier("ready"); err != nil {
		return nil, 0, err
	}
	streamsCtx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	type streamResult struct {
		stream  int
		queries []QueryReceipt
		err     error
	}
	results := make(chan streamResult, r.Clients)
	start := make(chan struct{})
	clock := &waveClock{}
	for stream, conn := range conns {
		go func() {
			result := streamResult{stream: stream}
			defer func() { results <- result }()
			<-start
			for rep := 0; rep < r.Repetitions; rep++ {
				for _, n := range queryPermutation(r.Queries, stream, r.Seed) {
					q := d.Queries[n-1].rendered(fmt.Sprintf("%d_%d_%d_%d", os.Getpid(), stream, rep, n))
					var native *nativeProfile
					if r.Profile != nil && r.Profile.Kind == "operator" {
						native = &nativeProfile{engine: r.Engine.Name, root: r.OutputRoot, prefix: fmt.Sprintf("native-q%02d-s%d-r%d", n, stream, rep), selectIndex: q.ResultStatement, plainSelect: q.Statements[q.ResultStatement]}
						if r.Engine.Name == "mo" {
							q.Statements[q.ResultStatement] = "EXPLAIN ANALYZE " + q.Statements[q.ResultStatement]
							q.Columns = []Column{{Kind: "text"}}
						}
					}
					if r.Unlimited && q.Limit > 0 {
						q.Statements[q.ResultStatement] = strings.TrimSuffix(q.Statements[q.ResultStatement], fmt.Sprintf(" LIMIT %d", q.Limit))
						q.Limit = 0
					}
					deadline := r.QueryDeadlineNS
					if limit := r.DeadlinesNS[n]; limit > 0 {
						deadline = limit
					}
					qctx, qcancel := context.WithTimeoutCause(streamsCtx, time.Duration(deadline), fmt.Errorf("query Q%d deadline", n))
					if err := control.step(true, stream, n, deadline); err != nil {
						qcancel()
						result.err = err
						cancel(err)
						return
					}
					cap, err := executeUnitClock(qctx, conn, q, filepath.Join(r.OutputRoot, fmt.Sprintf("q%02d-s%02d-%04d.rows", n, stream, rep)), captureDisk, clock, native)
					qcancel()
					err = errors.Join(err, control.step(false, stream, n, 0))
					receipt := QueryReceipt{Query: n, Repetition: rep, Stream: stream, Capture: cap}
					if err == nil && r.Reference {
						err = qualifyReference(r.DatasetRoot, d, q, r.OutputRoot, cap)
						receipt.Reference = "pass"
						if err != nil {
							receipt.Reference = "failed"
						}
					}
					if err != nil {
						receipt.Error = err.Error()
					}
					result.queries = append(result.queries, receipt)
					if err != nil {
						result.err = err
						cancel(err)
						return
					}
				}
			}
		}()
	}
	close(start)
	ordered := make([]streamResult, r.Clients)
	for range r.Clients {
		res := <-results
		ordered[res.stream] = res
		retErr = errors.Join(retErr, res.err)
	}
	waveNS = clock.elapsed()
	for _, res := range ordered {
		out = append(out, res.queries...)
	}
	if evidence != nil {
		evidence.after = runtimeSnapshot()
	}
	retErr = errors.Join(retErr, control.barrier("done"))
	if r.Profile != nil && (r.Profile.Kind == "alloc" || r.Profile.Kind == "wait") {
		retErr = errors.Join(retErr, goProfileSnapshot(r.OutputRoot, "after", r.Profile.Kind))
	}
	return out, waveNS, retErr
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #31470** (2026-10-27): **test: make HNSW polling use read committed**
  *Symptoms*: ## What type of PR is this?  - [x] Test and CI  ## Which issue(s) this PR relates to:  Refs #31449  ## What this PR does / why we need it:  #31457 already shortened the cross-CN freshness interval that caused the original CI timeout. This follow-up makes the BVT's explicit transaction use READ COMMITTED while polling for an asynchronously published HNSW generation, then restores the previous session isolation. With REPEATABLE READ the fixed transaction snapshot cannot see a publication committed after the transaction begins.  This hardens the test for sessions configured with REPEATABLE READ; it is not a claim that the original CI failure was caused by transaction isolation. The default pessimistic configuration uses READ COMMITTED.  ## Validation  - On a fresh local two-CN cluster, exact BVT: 61/61 passed, 9.39s. Both HNSW updates ran on CN1 and CN2 performed both stale-cache sweeps. - With the session initially set to REPEATABLE READ, the BVT plus an assertion that the original isolation was restored passed 63/63, 8.32s. - Negative control on main forced to REPEATABLE READ: asynchronous publication completed, but transaction polling failed (54/59); waits were shortened to 10s for this experiment. - `git diff --check` passed. The changes are SQL/result only; no Go behavior or production hot path changed.  The topology and session placement are not guaranteed by the SQL case on every run. These are macOS local results; Linux/proxy CI is pending. The pre-existing test-wide fre

- **Issue #31469** (2026-10-27): **[Bug]: shared CI assumes newer native outputs on 4.0-dev**
  *Symptoms*: ### Is there an existing issue for the same bug?  - [x] I have checked the existing issues.  ### Branch Name  4.0-dev  ### Commit ID  0b598e37c494f3f8447bf46cf50cc1f24daec3c9 (base da7ad6be78eb48ee81b8b6c33c5a7651c9364587)  ### Other Environment Information  MatrixOne PR #31465 changes only the pinned molint installation version. Shared workflows are resolved from matrixorigin/CI main. Observed in [run 40493419821](https://github.com/matrixorigin/matrixone/actions/runs/40493419821).  ### Actual Behavior  Current reusable CI assumes newer MatrixOne native and packaging artifacts that 4.0-dev does not produce:  - [Shared build](https://github.com/matrixorigin/matrixone/actions/runs/40493419821/job/122152831584) builds the binary but fails packaging at `cp cgo/*.so lib/`; the checked-out 4.0 cgo Makefile builds `libmo.a` only. Its source also does not include the newer `dict` build output, which the packaging command unconditionally expects. - [SCA](https://github.com/matrixorigin/matrixone/actions/runs/40493419821/job/122152831546) fails immediately after `make cgo` in Prepare ENV, where CI requires `libroaring.a` and `cgo/libmo.so`; the 4.0 Makefiles do not build either. The silent failing `test` does not identify which check fired first. - [UT Coverage](https://github.com/matrixorigin/matrixone/actions/runs/40493419821/job/122152928086) fails native preparation before tests. Its uploaded `ut-coverage-phase-failure.txt` says `missing required CGO header: thirdparties/install/i

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

### Incident Patch 1: `9cf8743e` (2026-10-27)
**Commit Message**: fix(sql): separate ODKU OK insert ID from session baseline (#28444)

### Current verified conflict-maintenance update — 2026-10-23

Published ordinary merge 8030407a39878935365e866b8d27beaa12ced2da, exact validated tree 2b5a190467752e49fa654037c38b8244a2a88120, fixed merge target d4c37f4d8722dd91b80f5f5547940004bf1b293f, parent source 47254e28e441e6cfb3a8b5263f45963a21e1bfcb. This completes the previously prepared real conflict composition; no history rewrite or additional main synchronization. Both main's explicit ELT lazy guard and this branch's recursive JSON capability admission remain before eager folding in both constant-fold owners.

Independent root verification:245 focused named PASS events,5 full normal owning packages35789 named PASS events with2 retained existing skips (not passes), incremental29-Go-file/9-directory plus direct-consumer formatting/vet/lint PASS. Supported Go1.27.1 darwin/arm64 CPU CGo/native provenance verified. Normal canonical comparison of6 exact cases twice on the same SQL+ISCP-ready owned instance: ODKU128, hidden-key28, JSON consumer60, MAX_BY22, NTH_VALUE31 and HAVING91 per round, totaling720/720, zero failed/ignored/abnormal. Every run verifies 

**File**: `docs/design/20261016-odku-distributed-result-protocol-r2-addendum.md` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+# Distributed ODKU Result Protocol: r2 alignment addendum
+
+Status: approved by independent scoped design review r2; see
+`20261016-odku-distributed-result-protocol-review-v2.md`.
+No build, regression, BVT, deployment, performance, or implementation acceptance
+is claimed by this document. Root owns reviewer and lifecycle decisions.
+
+- Revision: r2, 2026-10-16, owner VioletQwQ-0, PR #28444 / issue #28162.
+- Accepted source before this repair: `0c2090984b2aebef9cf10fba304465b14e3f5c77`.
+- Necessary normal-merge target: `b3d6b21fe9d260c91e1777529a48a9d93061af33`.
+- Original r1 inspected implementation: `286b60837041d819573a260f7ab6e346125c6d3a`.
+- Original reviewed r1 content: Git blob `914d5ddd19635d07924ebbe22cbb5eaa6f192fa2`
+  at head `038207ff2e5fd84d79d7d6c851c467b68b05a4e8`, SHA256
+  `ddff85b82ca7775ce492d68fb904a3bd5952c59e4f6390a8733ddf347953e756`.
+- The immutable [v1 approval record](20261016-odku-distributed-result-protocol-review-v1.md)
+  remains an approval of that exact r1 content. It is not approval of this r2
+  addendum or of the repaired implementation.
+
+## Subsequent candidate allocation overlay (not part of r2 approval)
+
+For the current conflict-repair candidate, actual main is
+`861a2c4cb68961d8b6b01f18e0aa6ac52a3a505f`, whose capability prefix reaches
+MORPC132. The candidate preserves every main allocation, including MORPC129
+JSON ELT/opaque text, MORPC130 incomplete temporal strings and MORPC131 exact
+weighted percentile dispatch and MORPC132 decimal/float conversions. The already
+shared JSON expression contract stays at MORPC129; typed JSON MIN/MAX is
+provisionally appended at MORPC133 and the complete ODKU/session-LAST_INSERT_ID
+contract at MORPC134. Independent unpublished candidates do not implement each
+other's features merely by assigning the same number; this is not a coordinated
+allocation or cross-branch deployment guarantee. Revalidate it at authoritative
+main admission.
+This supersedes only the r2 allocation for the current candidate; it does not
+claim design approval or implementation acceptance. The r2 review record and
+allocation below remain historical and bound to their stated source and target.
+
+The maintenance merge is bound to source
+`946ef84b38f259200aba81b2e5ad82e887e3780f` and the frozen main above.
+Main's `pipeline.DedupJoin.dedup_key_exprs` retains tag30; the candidate's
+unmerged ODKU suffix follows it:
+
+| Pipeline DedupJoin field | Current tag |
+| --- | --- |
+| `odku_target_auto_increment_col` | 31 |
+| `odku_generated_col` | 32 |
+| `odku_ordinal_col` | 33 |
+| `odku_result_tracking` | 34 |
+| `odku_generated_auto_increment_col` | 35 |
+
+Main's `plan.Node.dedup_key_exprs` tag95 and
+`plan.PreInsertUkCtx.key_diagnostic_exprs` tag19 also remain intact. The current
+source/cached/destination/receiver/actual-stream ODKU floor is134; JSON129,
+main's temporal130/weighted-percentile131/decimal-float132 and typed MIN/MAX133 do not imply
+ODKU support. This is append safety relative to actual main, not compatibility
+with the earlier133 ODKU executable whose ProcessInfo ordinal used tag18,
+earlier unmerged131 ODKU executables, or unmerged127 executables using
+ODKU tags30..34. Do not mix those pre-resolution binaries based on the shared
+numeric floor. Such interoperability is not certified by this merge or the
+historical approvals. The approved ownership, coordinator ordering, reduction,
+result policy, retry/quiescence and resource-budget choices are unchanged;
+measured performance, real mixed binaries and deployment acceptance remain
+separate gates.
+
+Main's `ProcessInfo.statement_runtime_select` retains tag17 and
+`statement_runtime_dml` retains tag18. The candidate's `odku_ordinal_base`
+moves to unused tag19, guarded by the complete ODKU134 contract. An ordinal
+must never be interpreted as the main DML boolean, nor a main DML boolean as
+an ODKU range. Schema, generated struct/marshal/size/unmarshal/descriptor and
+the wire regression must agree. This maintenance overlay is not approval of
+these new numbers or tags; both immutable approval records remain unchanged.
+
+The approved r2 addendum below supersedes only the allocation and compatibility
+boundaries in the [retained r1 specification](20261016-odku-distributed-result-protocol.md).
+The existing coordinator ordering, provenance, bounded reduction, transaction
+publication, generation/retry ownership and performance budgets remain the
+implementation's intended design. Their existing evidence keeps its original
+revision binding; it is not automatically upgraded to r2 acceptance.
+
+## Approved historical r2 cumulative allocation
+
+| Capability | Current floor | Allocation owner |
+| --- | --- | --- |
+| Collation-aware LEAST/GREATEST overload 4 | MORPC117 | Authoritative merged target b3d6b21f |
+| Selected JSON ELT and canonical opaque visible text | MORPC118 | Inherited JSON capability, moved after the target prefix |
+| Typed JSON MIN/MAX a
```

**File**: `docs/design/20261016-odku-distributed-result-protocol-review-v1.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# Independent Design Review Record v1
+
+## Decision
+
+- Reviewed artifact: `docs/design/20261016-odku-distributed-result-protocol.md`
+- Source head examined: `038207ff2e5fd84d79d7d6c851c467b68b05a4e8` (PR #28444)
+- Document Git blob: `914d5ddd19635d07924ebbe22cbb5eaa6f192fa2`
+- Document SHA256: `ddff85b82ca7775ce492d68fb904a3bd5952c59e4f6390a8733ddf347953e756`
+- Review date: 2026-10-16
+- Reviewer: independent review session (`gpt-6.1-sol`, reasoning `high`), separate from design authorship and implementation work
+- Conclusion: **PASS**, no design-approval conditions
+
+## Risk Decisions
+
+| Required gate | Decision |
+| --- | --- |
+| State ownership, transfer, boundaries, and cleanup | PASS |
+| Coordinator ordering, ordinal reduction, and tie-breaking | PASS |
+| Failure, retry, reset, generation, and leak semantics | PASS |
+| Mixed-version behavior, MORPC gate, upgrade, and rollback | PASS |
+| Alternatives and explicit tradeoffs | PASS |
+| Performance acceptance metrics and budgets | PASS |
+
+## Scope and Limitations
+
+This record approves the design only. Implementation correctness, measured
+performance, real mixed-version deployment, and QA acceptance were not executed
+and remain separate gates. The review statically inspected the frozen document
+and its cited implementation anchors; it ran no build, UT, BVT, benchmark,
+service, or CI workload.
+
+The source checkout contained an untouched untracked `thirdparties/install`
+symlink and the PR is Ready; neither affects the reviewed tracked document
+content, whose Git blob and SHA256 match the values above. The design status
+update from DRAFT to approved is record metadata and changes no design
+decision.
```

**File**: `docs/design/20261016-odku-distributed-result-protocol-review-v2.md` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# Distributed ODKU result protocol: independent r2 design decision
+
+Decision: **PASS**. Blocking design findings: **none**. Design approval conditions:
+**none**. This is an independent approval of the r2 decisions and their integration
+with r1, not inherited v1 approval or implementation/runtime acceptance.
+
+- Issue: #28162; implementation PR: #28444.
+- Reviewer: independent Codex agent Popper, dispatch ID
+  `01a14406-78af-7420-a83b-aabc68e36324`; not the r2 author.
+- Review date: 2026-10-16; final binding check: `2026-10-16T09:28:26Z`.
+- Reviewed source: `0c2090984b2aebef9cf10fba304465b14e3f5c77`.
+- Integration target: `b3d6b21fe9d260c91e1777529a48a9d93061af33`.
+- Reviewed staged candidate tree: `f07e9a39d185e6afa270a8464995cc839f411eef`.
+- Reviewed r2: `20261016-odku-distributed-result-protocol-r2-addendum.md`,
+  blob `f59e2d8da15c8be6407f939b8eb6854f5f8e1b41`, SHA256
+  `3c7824f054e20328e46c7d6e818ea7b8425765124d1faadc734e7cc18f4d6a0a`.
+- Retained r1 with its historical-scope preface: blob
+  `0f41de5514cdfc38a5ae26e9d65898d24b54d7a6`, SHA256
+  `7382036c352faacc0d5fbe711927fe5007d92ae8b9368e2cf49d70e2700f2735`.
+- The immutable v1 approval record is unchanged. Its approval still applies only
+  to original r1 blob `914d5ddd19635d07924ebbe22cbb5eaa6f192fa2`.
+
+After review, only r2's status metadata was changed to link this decision and to
+keep implementation/runtime acceptance explicitly unclaimed. All substantive r2
+decisions below the revision header retain their reviewed content. The original
+PENDING status is superseded by this record; no old approval or runtime result
+has been relabelled.
+
+| Reviewed decision | Result and rationale |
+| --- | --- |
+| Actual successful plan owns the result | PASS: select legacy scalar versus tracked summary from the final plan, including retry rebuild; empty summary never selects stale legacy state. |
+| Multiple visible AUTO_INCREMENT columns | PASS: preserve accepted DML and allocate later columns normally; first visible column consistently owns provenance and fallback references. Later-only generation intentionally does not publish a modern ODKU session ID. This is a documented MatrixOne policy, not portable MySQL behavior. |
+| Visible internal-looking SQL name | PASS: visibility/internal catalog ownership distinguishes user IDs from hidden allocator columns without weakening constraints or tenancy. |
+| Cumulative protocol requirements | PASS: upstream117, JSON118, typed MINMAX119 and ODKU/baseline120 remain distinct; every admission/send/decode/stream owner composes their maximum. |
+| Retry, rollback, ownership and resource bounds | PASS: r1 coordinator publication, quiescence, explicit-zero baseline, generation reset, reducer bounds and performance budgets are retained. No per-column result vectors or new unbounded state are introduced. |
+| Alternatives and validation | PASS: AST/empty-summary dispatch, broad statement rejection, cross-column reduction, name-based ownership and old-floor reuse were considered; deterministic tests, real-client results, canonical BVT, binary/fault and performance obligations can falsify the selected design. |
+
+Implementation acceptance still requires executed owner/column/floor regressions,
+raw OK/session/row assertions and normal comparisons of `on_duplicate_key_edge.sql`
+and `last_insert_id_hidden_pk.sql`. Actual mixed binaries, ordered producer and
+fault/retry qualification, r1's full measured capacity/performance matrix, CI and
+deployment QA retain their separate owners and gates. None was executed by this
+design review, and the complete candidate implementation was not approved.
+
+Root retained the full independent `REVIEW.md` and `REVIEW.json` in task evidence
+`heartbeat-20261016-0834.qUtx67/design-review-28444-r2/`, independently checked the
+document/candidate binding, and confirmed the reviewer stopped before this record
+was added. This repository record makes the design decision reviewable without
+requiring access to that private evidence directory. It does not resolve GitHub
+threads, request another review, or change `CHANGES_REQUESTED`.
```

**File**: `docs/design/20261016-odku-distributed-result-protocol.md` (added, +405/-0)
```diff
@@ -0,0 +1,405 @@
+# Distributed ODKU Result Protocol
+
+Current implementation alignment: [r2 addendum](20261016-odku-distributed-result-protocol-r2-addendum.md), with the subsequent candidate-allocation overlay recorded there.
+Against frozen main `861a2c4cb68961d8b6b01f18e0aa6ac52a3a505f` (capability prefix
+through MORPC132), the isolated candidate retains all main contracts, including
+MORPC129 JSON ELT/opaque text, MORPC130 incomplete temporal strings and MORPC131
+exact weighted percentile dispatch and MORPC132 decimal/float conversions.
+The same JSON expression contract keeps main's MORPC129; typed JSON MIN/MAX is
+provisionally appended at MORPC133 and the complete ODKU/session-baseline
+contract at MORPC134. ProcessInfo preserves main's DML classification tag18 and
+moves the candidate's ODKU ordinal to tag19. Independent unpublished candidates do not implement each other's
+features merely by assigning the same number; these assignments do not establish
+cross-branch deployment compatibility and must be revalidated at authoritative
+main admission.
+The r2 approval remains scoped to its earlier reviewed allocation; this overlay
+does not claim new design approval.
+
+The r1 specification below is retained as historical design text. Its normative
+references to MORPC119 describe the original inspected/reviewed revision, not
+the current allocation. Use the r2 addendum for the changed boundaries. The
+original reviewed content remains addressable by its immutable blob and head
+below. The v1 approval record is unchanged and applies only to that reviewed r1
+content. The [v2 approval record](20261016-odku-distributed-result-protocol-review-v2.md)
+approves its stated historical r2 revision; neither approval automatically covers
+the subsequent numeric allocation overlay. Pending/DRAFT statements in the
+retained specification below describe that original publication, not the latest
+approval status.
+
+## Retained r1 specification
+
+Status: r1 approved by independent design review v1; see `20261016-odku-distributed-result-protocol-review-v1.md`
+
+- Design revision: r1, 2026-10-16.
+- Owner: VioletQwQ-0.
+- Owning issue: [#28162](https://github.com/matrixorigin/matrixone/issues/28162).
+- Implementation: [PR #28444](https://github.com/matrixorigin/matrixone/pull/28444).
+- Inspected implementation revision: `286b60837041d819573a260f7ab6e346125c6d3a`.
+- Design gate: [mo-bot assessment at the inspected revision](https://github.com/matrixorigin/matrixone/pull/28444#pullrequestreview-5543546119).
+- Reviewed design revision: document blob `914d5ddd19635d07924ebbe22cbb5eaa6f192fa2`
+  at head `038207ff2e5fd84d79d7d6c851c467b68b05a4e8`.
+- Approval record: PASS with no conditions in
+  `20261016-odku-distributed-result-protocol-review-v1.md`, bound to document
+  SHA256 `ddff85b82ca7775ce492d68fb904a3bd5952c59e4f6390a8733ddf347953e756`.
+
+## Background / Problem
+
+An ODKU statement can allocate an AUTO_INCREMENT candidate, resolve a duplicate
+against a different stored row, perform a changed update or a no-op, and finish
+on a different CN from its input producer. Allocation order, numerical ID order,
+RPC completion order, and logical input order are different orders. Taking a
+minimum generated ID or the last remote reply cannot reliably identify the
+client-visible result.
+
+The contract has two consumers: the insert ID in the successful MySQL OK packet,
+and the session value read by a subsequent `LAST_INSERT_ID()`. An update fallback
+may populate the packet without changing that session value. A failed attempt
+must not populate the next attempt's result. Generated candidates consumed by
+duplicate updates and hidden fake-primary-key allocation are not successful
+user-column inserts.
+
+The existing [ordered ODKU design](20260906-ordered-odku-semantics.md) describes
+action ordering, affected rows, constraints, and physical writes. This document
+adds the distinct placement, provenance, reduction, and version contract. It is
+a design proposal informed by existing code, not retrospective approval of that
+code. Implementation acceptance remains blocked on independent design approval.
+
+## Non-goals
+
+- Change ODKU target arbitration, left-to-right assignments, affected-row rules,
+  constraint enforcement, index maintenance, storage commit, or transaction retry policy.
+- Make AUTO_INCREMENT allocation transactional or reclaim gaps after rollback.
+- Define a deterministic SQL order for an unordered INSERT SELECT or tied ORDER
+  BY keys. Require a total ORDER BY when applications need repeatable order.
+- Add a durable result service, a new catalog format, a per-row result RPC, a
+  new background worker, or a general distributed sequence allocator.
+- Redesign side effects of `LAST_INSERT_ID(expr)`, multi-table INSERT, ordinary
+  INSERT/REPLACE reporting, or unrelated expression protocols.
+
+## Current behavior and source binding
+
+All source references below are `file:line` at the in
```

**File**: `pkg/defines/const.go` (modified, +3/-1)
```diff
@@ -168,7 +168,9 @@ const (
 	MORPCVersion130    int64 = 130 // incomplete temporal string overloads and rejection diagnostics
 	MORPCVersion131    int64 = 131 // exact weighted percentile aggregate remote dispatch
 	MORPCVersion132    int64 = 132 // decimal float rounding and strict textual float conversions
-	MORPCLatestVersion       = MORPCVersion132
+	MORPCVersion133    int64 = 133 // typed JSON MIN/MAX aggregate comparison
+	MORPCVersion134    int64 = 134 // ordered ODKU result summary and captured session LAST_INSERT_ID baseline
+	MORPCLatestVersion       = MORPCVersion134
 )
 
 // DefaultLockWaitTimeoutSeconds is shared by the frontend default and by
```

**File**: `pkg/frontend/multi_insert_last_insert_id_test.go` (modified, +107/-0)
```diff
@@ -55,6 +55,8 @@ func newLastInsertIDHarness(t *testing.T, targets int) (
 	proc := &process.Process{Base: &process.BaseProcess{
 		LastInsertID:          new(uint64),
 		StatementLastInsertID: new(uint64),
+		ODKUResult:            &process.ODKUResultState{},
+		ODKUInputOrdinal:      new(uint64),
 	}}
 	proc.InitSeq()
 	writer := &countingMysqlWriter{
@@ -71,6 +73,81 @@ func newLastInsertIDHarness(t *testing.T, targets int) (
 	return ses, proc, writer, NewMysqlResp(writer), execCtx
 }
 
+func newODKUInsertStatusHarness(t *testing.T) (
+	*Session, *process.Process, *countingMysqlWriter, *MysqlResp, *ExecCtx,
+) {
+	ses, proc, writer, resper, execCtx := newLastInsertIDHarness(t, 0)
+	execCtx.stmt = &tree.Insert{Rows: &tree.Select{Select: &tree.ValuesClause{}}, OnDuplicateUpdate: tree.UpdateExprs{&tree.UpdateExpr{}}}
+	p := autoIncrPreInsertPlan(1)
+	p.GetQuery().Nodes[0].PreInsertCtx.TrackOdkuResult = true
+	execCtx.cw = &TxnComputationWrapper{plan: p}
+	return ses, proc, writer, resper, execCtx
+}
+
+func TestODKUStatusLegacyNoKeyPublishesStatementID(t *testing.T) {
+	for _, generated := range []bool{false, true} {
+		t.Run(map[bool]string{false: "explicit", true: "generated"}[generated], func(t *testing.T) {
+			ses, proc, writer, resper, execCtx := newODKUInsertStatusHarness(t)
+			execCtx.cw = &TxnComputationWrapper{plan: autoIncrPreInsertPlan(1)}
+			ses.SetLastInsertID(700)
+			proc.SetLastInsertID(700)
+			want, session := uint64(0), uint64(700)
+			if generated {
+				proc.SetStatementLastInsertIDIfEarlier(1)
+				want, session = 1, 1
+			}
+			require.NoError(t, resper.respStatus(ses, execCtx))
+			require.Len(t, writer.responses, 1)
+			require.Equal(t, want, writer.responses[0].lastInsertId)
+			require.Equal(t, session, ses.GetLastInsertID())
+			// The next statement is seeded from this durable session value.
+			proc.SetLastInsertID(ses.GetLastInsertID())
+			proc.SetStatementLastInsertID(0)
+			require.Equal(t, session, proc.GetLastInsertID())
+		})
+	}
+}
+
+func TestODKUStatusKeepsSessionValueForUpdateFallback(t *testing.T) {
+	ses, proc, writer, resper, execCtx := newODKUInsertStatusHarness(t)
+	ses.SetLastInsertID(500)
+	proc.SetLastInsertID(500)
+	proc.RecordODKUAction(0, 1, true)
+
+	require.NoError(t, resper.respStatus(ses, execCtx))
+	require.Len(t, writer.responses, 1)
+	require.Equal(t, uint64(1), writer.responses[0].lastInsertId)
+	require.Equal(t, uint64(500), ses.GetLastInsertID())
+	require.Equal(t, uint64(500), proc.GetLastInsertID())
+}
+
+func TestODKUStatusNoopReturnsZeroAndKeepsSessionValue(t *testing.T) {
+	ses, proc, writer, resper, execCtx := newODKUInsertStatusHarness(t)
+	ses.SetLastInsertID(500)
+	proc.SetLastInsertID(500)
+	proc.RecordODKUAction(0, 1, false)
+
+	require.NoError(t, resper.respStatus(ses, execCtx))
+	require.Len(t, writer.responses, 1)
+	require.Zero(t, writer.responses[0].lastInsertId)
+	require.Equal(t, uint64(500), ses.GetLastInsertID())
+}
+
+func TestODKUStatusPublishesFirstGeneratedValue(t *testing.T) {
+	ses, proc, writer, resper, execCtx := newODKUInsertStatusHarness(t)
+	ses.SetLastInsertID(500)
+	proc.SetLastInsertID(500)
+	proc.RecordODKUGenerated(2, 3)
+
+	require.NoError(t, resper.respStatus(ses, execCtx))
+	require.Len(t, writer.responses, 1)
+	require.Equal(t, uint64(3), writer.responses[0].lastInsertId)
+	require.Equal(t, uint64(3), ses.GetLastInsertID())
+	// The process is normally discarded or refreshed after status emission;
+	// the session object is the durable value used by the next statement.
+	require.Equal(t, uint64(500), proc.GetLastInsertID())
+}
+
 // TestMultiInsertAmbiguousInsertIDLeavesNoProcessState is the regression for
 // the leak: with several AUTO_INCREMENT targets the statement reports no
 // insert id, and it must not leave the suppressed value on the process either.
@@ -136,3 +213,33 @@ func TestMultiInsertNoAutoIncrTargetKeepsPreviousValue(t *testing.T) {
 	require.Equal(t, uint64(51), ses.GetLastInsertID())
 	require.Equal(t, uint64(51), proc.GetLastInsertID())
 }
+
+func TestODKUStatusDistinguishesValuesAndSelectFallback(t *testing.T) {
+	for _, values := range []bool{true, false} {
+		for _, generated := range []bool{false, true} {
+			ses, proc, writer, resper, execCtx := newODKUInsertStatusHarness(t)
+			ses.SetLastInsertID(700)
+			proc.SetLastInsertID(700)
+			if !values {
+				execCtx.stmt.(*tree.Insert).Rows.Select = &tree.SelectClause{}
+			}
+			proc.RecordODKUAction(0, 90, true)
+			proc.RecordODKUAction(1, 2, false) // final no-op, not ID magnitude/success ordinal
+			want, session := uint64(2), uint64(700)
+			if !values {
+				want = 0
+			}
+			if generated {
+				// Deliberately non-monotonic IDs distinguish input ordinal from
+				// the legacy smallest-ID reduction and remote delivery order.
+				proc.RecordODKUGenerated(8, 3)
+				proc.RecordODKUGenerated(2, 91)
+				want, session = 91, 91
+			}
+			require.NoError(t, resper.respStatus(ses, execCtx))
+			require.Len(t, writer.responses, 1)
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +13/-0)
```diff
@@ -6423,6 +6423,7 @@ func doComQuery(ses *Session, execCtx *ExecCtx, input *UserInput) (retErr error)
 		TimeZone:               ses.GetTimeZone(),
 		StorageEngine:          pu.StorageEngine,
 		LastInsertID:           ses.GetLastInsertID(),
+		LastInsertIDSet:        true,
 		SqlHelper:              ses.GetSqlHelper(),
 		CompilerContext:        ses.txnCompileCtx,
 		Buf:                    ses.GetBuffer(),
@@ -6710,6 +6711,18 @@ func doComQuery(ses *Session, execCtx *ExecCtx, input *UserInput) (retErr error)
 		// packet, so clear it before executing each statement while leaving the
 		// session-visible LAST_INSERT_ID state in LastInsertID untouched.
 		proc.SetStatementLastInsertID(0)
+		// A COM_QUERY may contain multiple statements.  The previous statement
+		// can have published a generated ODKU value to the session after the
+		// process was initialized, so reseed the expression-visible process
+		// value before planning this statement.
+		lastInsertID := ses.GetLastInsertID()
+		proc.SetLastInsertID(lastInsertID)
+		// Retry restoration uses the session snapshot carried by SessionInfo. Keep
+		// that attempt baseline aligned when COM_QUERY reuses the process across
+		// statements.
+		proc.Base.SessionInfo.LastInsertID = lastInsertID
+		proc.Base.SessionInfo.LastInsertIDSet = true
+		proc.ResetODKUResult()
 		if isTopLevelClientStatement(ses, execCtx, currentInput) {
 			execCtx.captureDiagnosticCountsSnapshot(ses)
 		}
```

**File**: `pkg/frontend/result_row_stmt_test.go` (modified, +37/-0)
```diff
@@ -420,3 +420,40 @@ func BenchmarkGetSelectColumns(b *testing.B) {
 		}
 	})
 }
+
+func TestODKUCommitFailureDoesNotPublishSessionOrOK(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	ctx := defines.AttachAccountId(context.Background(), sysAccountID)
+	ses := newTestSession(t, ctrl)
+	defer ses.Close()
+	writer := &countingMysqlWriter{testMysqlWriter: &testMysqlWriter{}, responses: make([]*Response, 0, 1)}
+	resper := NewMysqlResp(writer)
+	ses.respr = resper
+	ses.SetLastInsertID(700)
+	proc := ses.GetProc()
+	proc.RecordODKUGenerated(0, 17)
+	eng := mock_frontend.NewMockEngine(ctrl)
+	eng.EXPECT().Hints().Return(engine.Hints{CommitOrRollbackTimeout: time.Second}).AnyTimes()
+	ses.txnHandler.storage = eng
+	txnOp := newTestTxnOp()
+	txnOp.meta = txn.TxnMeta{ID: []byte{1, 2, 3, 4}, Status: txn.TxnStatus_Active}
+	txnOp.commitErr = fmt.Errorf("ODKU commit failed")
+	txnOp.wp.readonly = false
+	ses.txnHandler.txnOp = txnOp
+	ses.txnHandler.txnCtx = ctx
+	ses.txnHandler.shareTxn = false
+	stmt := &tree.Insert{OnDuplicateUpdate: tree.UpdateExprs{&tree.UpdateExpr{}}}
+	execCtx := &ExecCtx{reqCtx: ctx, ses: ses, proc: proc, stmt: stmt,
+		cw:     &TxnComputationWrapper{stmt: stmt, plan: autoIncrPreInsertPlan(1)},
+		runner: &performTestRunner{result: &util.RunResult{AffectRows: 1}},
+		resper: resper, txnOpt: FeTxnOption{autoCommit: true}}
+	// Exercise the real statement runner and transaction finalizer. The caller
+	// publishes status only after both return success; pipeline success alone
+	// must leave the old session baseline and writer untouched.
+	require.NoError(t, executeStatusStmt(ses, execCtx))
+	require.Empty(t, writer.responses)
+	require.Equal(t, uint64(700), ses.GetLastInsertID())
+	require.ErrorContains(t, finishTxnFunc(ses, nil, execCtx), "ODKU commit failed")
+	require.Empty(t, writer.responses)
+	require.Equal(t, uint64(700), ses.GetLastInsertID())
+}
```

---

### Incident Patch 2: `baa83f4b` (2026-10-27)
**Commit Message**: fix(python): unify SDK execution contracts across 4.1.x and 4.2.x (#31322)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [x] Improvement
- [x] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Closes #30963
Closes #31023
Closes #31312
Closes #31314
Related to #30067, #30068, #30069 and #31262.

## What this PR does / why we need it:

Unify Python SDK execution and SQL construction across MatrixOne 4.1.x
and 4.2.x. Immutable snapshot Selects remain cache-keyed through Client,
Session and export compilation, including caller caches warmed before
engine adoption. Preserve the caller's driver, dialect, pool and typed
results. Shared-engine adoption preserves supported SQLAlchemy 1.4
string execution. Compiler-owned late snapshot literals preserve
percent/placeholder-like names, avoid caller parameter collisions, and
prevent execution arguments from replacing snapshot identity. Raw/export
compilation preserves escaped parameter names and their type processors
across SQLAlchemy versions.

Explicit configuration overrides take precedence over invalid
lower-priority environment values. Buffered fetch sizes cannot rewind
cur

**File**: `.github/workflows/python-sdk.yml` (modified, +1/-0)
```diff
@@ -156,6 +156,7 @@ jobs:
       MO_SDK_EXPECT_REVISION: ${{ vars.MO_SDK_EXPECT_REVISION }}
       MO_SDK_EXPORT_DIR: ${{ vars.MO_SDK_EXPORT_DIR }}
       MO_SDK_EXPORT_LOCAL_DIR: ${{ vars.MO_SDK_EXPORT_LOCAL_DIR }}
+      MO_SDK_DISPOSABLE_SERVER: ${{ vars.MO_SDK_DISPOSABLE_SERVER }}
       MO_ANALYTICS_ONLINE: '1'
       MO_SDK_ONLINE: '1'
       MO_SECOND_CN_PORT: ${{ vars.MO_SECOND_CN_PORT }}
```

**File**: `clients/python/TESTING.md` (modified, +21/-4)
```diff
@@ -25,17 +25,22 @@ checks exclude Arrow; analytics requires its separate optional dependency and
 supported Python version. Installing the core SDK must not require PyArrow.
 
 Server contracts are explicitly configured; an offline green run does not prove
-server compatibility. Required online jobs select MatrixOne 4.2.5 or a built
-current-source server. Set these variables for an isolated disposable database:
+server compatibility. Release qualification selects an exact MatrixOne 4.1.x or 4.2.x patch, or a built
+current-source server. Use full contracts on 4.1.0, 4.1.6, 4.2.0 and 4.2.6,
+and core contracts on every intermediate stable patch. Set these variables for an isolated disposable target:
 
 - `MO_HOST`, `MO_PORT`, `MO_USER`, `MO_PASSWORD`.
-- `MO_SDK_EXPECT_VERSION`: `4.2.5` for that release, or the source server banner.
+- `MO_SDK_EXPECT_VERSION`: the exact selected release, or the source server banner.
 - `MO_SDK_EXPECT_REVISION`: required for `current-source`, matching `git_version()`.
 - `MO_SDK_EXPORT_DIR`: directory visible to the server.
 - `MO_SDK_EXPORT_LOCAL_DIR`: the same directory visible to the test process.
+- `MO_SDK_DISPOSABLE_SERVER=1`: required for full contracts, only when the server or tenant is disposable and
+  exclusively owned by this test run. Case-mode tests change a tenant-global setting and must run serially; they
+  restore it afterwards, but concurrent sessions could observe the temporary setting.
 
 ```sh
-python scripts/run_contracts.py --server 4.2.5 --output release-contracts
+python scripts/run_contracts.py --server 4.1.0 --suite full --output release-contracts
+python scripts/run_contracts.py --server 4.2.3 --suite core --output core-contracts
 python scripts/run_contracts.py --server current-source --output source-contracts
 ```
 
@@ -171,3 +176,15 @@ tokens from triggering floating-point comparisons. Non-finite values and
 fixed-point representations exceeding 4096 characters are rejected before
 formatting; the expansion budget includes the sign and decimal point. This
 budget also conservatively rejects excessive positive-exponent zero inputs.
+
+
+Release boundaries and deliberate compatibility restrictions are described in
+[the release compatibility design](docs/design/release-quality.md). Core server
+contracts do not require the export mount variables. Full contracts do. Neither
+suite substitutes for optional TLS, S3, HNSW or multi-CN qualification.
+
+CLONE managers verify target existence after acknowledgement. Manager
+`if_not_exists=True` uses a read-only catalog observation and never the native
+flag, which can duplicate existing data. Raw clone builders reject that flag;
+use `client.clone` or `session.clone` for the safe operation. Concurrent creation
+can still produce a native error. Async clone steps share one query timeout.
```

**File**: `clients/python/docs/design/release-quality.md` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+# Python SDK release compatibility boundaries
+
+The SDK supports the 4.1.x and 4.2.x release families through common execution
+and SQL construction contracts. Version banners identify test targets; they do
+not establish that a server supports a feature. Explicit native operations stay
+authoritative. Related issues: #30963, #31023, #30067, #30068, #30069.
+
+## SQL construction
+
+Administrative SQL distinguishes identifiers, grammar STRING tokens and SQL
+expressions. One identifier decoder accepts complete legacy quoted components,
+rejects trailing SQL and re-emits valid identifiers. One grammar token renderer
+doubles apostrophes and rejects NUL/backslash where SQL mode would change their
+meaning. Expression values retain the existing expression-literal renderer.
+Managers and statement builders share these authorities. Unsupported server
+catalog serialization remains an error; the SDK never changes SQL mode or
+silently removes user input.
+
+## Typed queries and engine ownership
+
+Snapshot Selects are immutable annotations participating in SQLAlchemy structural
+cache keys. The MatrixOne compiler handles the root query and all qualified JOIN
+sources. Nested snapshot SELECTs and CTEs reject explicitly instead of returning
+live rows. Compilation for export uses the same compiler. Bind and result
+processors, including exact Decimal values, remain owned by the driver dialect.
+
+Engine adoption preserves the original dialect object, driver, pool and hooks.
+A before_execute listener stamps typed statements with a compiler-contract
+namespace so a caller cache warmed before adoption cannot reuse MySQL SQL without
+snapshot hints. Caller cache entries remain intact. Engine-created and adopted
+sync/async engines share the listener; raw driver SQL is unaffected.
+Legacy SQLAlchemy 1.4 string execution passes through the listener unchanged.
+Snapshot tokens inserted during typed compilation follow the active compiler's
+percent-escaping policy; raw/export SQL retains the original snapshot name.
+Compiler-local snapshot bindings avoid caller and expanded parameter names, and
+execution parameters cannot replace the immutable snapshot annotation.
+
+Each live immutable statement retains at most one prepared annotation memo,
+guarded by exact original identity and compiler-contract version. Generative
+copies cannot reuse their parent's prepared SQL. The prepared copy drops any
+inherited memo. Reused statements perform constant-time preparation and retain
+their generated cache key; no global statement registry or per-execution growth
+is introduced. Concurrent initial preparation can duplicate equivalent work but
+never publishes partially constructed state.
+
+Buffered results use the driver's returns_rows flag, with an ORM row-result
+fallback where that flag is absent. Both clients and Session owners preserve
+rows, empty SELECTs and DML affected counts. QueryError retains the original
+exception and native errno; existing QueryError instances are not rewrapped.
+Cancellation remains cancellation rather than a query failure.
+
+## CLONE completion and no-op semantics
+
+Ordinary clone managers execute plain CLONE followed by SHOW CREATE on the same
+executor. A missing target after acknowledgement is an explicit CloneError with
+its original source. The SDK does not claim row identity from this existence
+check, issue compensating DROP, or take transaction ownership from Session.
+
+Native CLONE IF NOT EXISTS can append data to an existing target in supported
+releases. Safe manager if_not_exists therefore observes the target using bounded,
+read-only information_schema queries on the same executor. Existing targets
+return immediately. Missing targets use plain CLONE and verification. Names
+are decoded and compared as binary catalog values, preserving exact spelling
+when `lower_case_table_names=0` and using server LOWER for the other modes.
+The operation introduces one query for an existing target, or three for a missing
+target. Ordinary CLONE uses two queries.
+
+In tested 4.1 and 4.2 releases, the server's internal CLONE executor can still
+lowercase a new target in mode 0. A conflicting lowercase sibling can therefore
+cause a native error; the SDK propagates the error instead of reporting a no-op
+for an absent exact target. In mode 2, native CLONE can create a lowercase name
+while SHOW CREATE uses the requested spelling, causing verification to fail even
+after creation. The SDK reports that failure rather than claiming success.
+
+This observation is not a race-free creation lock. A concurrent creator can win;
+any native failure propagates, while an acknowledgement still requires target
+existence verification. No duplicate-error recovery or automatic retry occurs.
+Raw table/database builders cannot implement this multi-statement contract and
+reject their if_not_exists flag at compilation, directing callers to managers.
+
+Snapshot convenience APIs delegate directl
```

**File**: `clients/python/matrixone/_query_compilation.py` (modified, +18/-6)
```diff
@@ -2,10 +2,10 @@
 # Licensed under the Apache License, Version 2.0.
 """Pure compilation shared by buffered sync/async queries and exports."""
 
+import copy
 import re
 from typing import Any, cast
 
-from sqlalchemy.dialects.mysql import dialect
 from sqlalchemy.sql import visitors
 from sqlalchemy.sql.elements import ClauseElement
 from sqlalchemy.sql.compiler import SQLCompiler
@@ -20,7 +20,7 @@ def render_fragment(sql, params=()):
     return substitute_parameters(sql, params)
 
 
-def compile_expression(expression, model=None, alias=None, projection=False):
+def compile_expression(expression, model=None, alias=None, projection=False, compiler_dialect=None):
     if not isinstance(expression, ClauseElement) and hasattr(expression, '__clause_element__'):
         expression = expression.__clause_element__()
     if not isinstance(expression, ClauseElement):
@@ -35,23 +35,35 @@ def replace(element, **kw):
             return None
 
         expression = visitors.replacement_traverse(cast(Any, expression), {}, replace)
+    from .sqlalchemy_ext.dialect import MatrixOneDialect
+
+    if compiler_dialect is None:
+        compiler_dialect = MatrixOneDialect(paramstyle='qmark')
+    else:
+        # A string-producing API owns literal substitution, not DBAPI percent
+        # expansion. Preserve the supplied dialect's types without mutating it.
+        compiler_dialect = copy.copy(compiler_dialect)
+        compiler_dialect.paramstyle = 'qmark'
+        compiler_dialect.positional = True
+        compiler_dialect.identifier_preparer = compiler_dialect.preparer(compiler_dialect)
     compiled = cast(
         SQLCompiler,
         ClauseElement.compile(
             expression,
-            dialect=dialect(paramstyle='qmark'),
+            dialect=compiler_dialect,
             compile_kwargs={'render_postcompile': True, 'within_columns_clause': projection},
         ),
     )
     # SQLAlchemy owns expression syntax; our shared renderer owns value quoting.
-    parameters = compiled.params
-    processors = dict(compiled._bind_processors)
     expanded = getattr(compiled, '_post_compile_expanded_state', None)
+    parameters = expanded.parameters if expanded is not None else compiled.params
+    processors = dict(compiled._bind_processors)
     if expanded is not None:
         processors.update(expanded.processors)
     values = []
     for key in compiled.positiontup or ():
-        value = parameters[key]
+        parameter_key = key if expanded is not None else compiled.escaped_bind_names.get(key, key)
+        value = parameters[parameter_key]
         processor = processors.get(key)
         if processor is not None:
             if not callable(processor):
```

**File**: `clients/python/matrixone/_snapshot_sql.py` (modified, +6/-3)
```diff
@@ -9,7 +9,7 @@
 import re
 from typing import List, NamedTuple
 
-from ._sql_literals import sql_literal
+from ._sql_literals import sql_string_token
 
 
 class _Token(NamedTuple):
@@ -89,7 +89,7 @@ def _tokens(sql):
         raise ValueError('Unbalanced SQL parentheses')
 
 
-def rewrite_snapshot(sql, snapshot):
+def rewrite_snapshot(sql, snapshot, *, snapshot_token=None):
     if not isinstance(sql, str) or not isinstance(snapshot, str) or not snapshot:
         raise ValueError('Snapshot queries require SQL text and a nonempty snapshot name')
     tokens = list(_tokens(sql))
@@ -141,7 +141,10 @@ def rewrite_snapshot(sql, snapshot):
             if not (suffix.kind == 'word' and suffix.text.upper() in _BOUNDARIES) and suffix.text != ';':
                 raise ValueError('Unsupported snapshot table-source suffix')
         inserts.append(end)
-    hint = '{snapshot = ' + sql_literal(snapshot) + '}'
+    # Raw SQL owns its literal token; typed SQL may supply a compiler-owned bind.
+    # Validate the original name in both paths before accepting that token.
+    literal_token = sql_string_token(snapshot, context='Snapshot')
+    hint = '{snapshot = ' + (literal_token if snapshot_token is None else snapshot_token) + '}'
     parts: List[str] = []
     previous = 0
     for end in inserts:
```

**File**: `clients/python/matrixone/_sql_literals.py` (modified, +43/-4)
```diff
@@ -63,21 +63,59 @@ def connection_sql_mode(connection):
 _RESERVED = MySQLIdentifierPreparer.reserved_words
 
 
-def sql_identifier(name, qualified=False):
+def sql_identifier(name, qualified=False, *, force=False) -> str:
     if not isinstance(name, str):
         raise TypeError('SQL identifier must be a string')
     parts = name.split('.') if qualified else [name]
     quoted = []
     for part in parts:
         if not part or len(part) > 64 or '\x00' in part:
             raise ValueError('SQL identifiers require 1..64 characters and no NUL')
-        if _SIMPLE_IDENTIFIER.fullmatch(part) and part.casefold() not in _RESERVED:
+        if not force and _SIMPLE_IDENTIFIER.fullmatch(part) and part.casefold() not in _RESERVED:
             quoted.append(part)  # Preserve ordinary legacy SQL rendering.
         else:
             quoted.append('`' + part.replace('`', '``') + '`')
     return '.'.join(quoted)
 
 
+def identifier_parts(name, qualified=False):
+    """Normalize complete legacy quoted names, never trailing SQL fragments."""
+    if not isinstance(name, str):
+        raise TypeError('SQL identifier must be a string')
+    if not name or len(name) > (261 if qualified else 130):
+        raise ValueError('Invalid SQL object name')
+    parts = []
+    offset = 0
+    while offset < len(name):
+        if name[offset] in ('`', '"'):
+            quote = name[offset]
+            match = re.match(quote + r'((?:' + quote * 2 + '|[^' + quote + r'])*)' + quote, name[offset:])
+            if match is None:
+                raise ValueError('Unterminated quoted SQL identifier')
+            part = match[1].replace(quote * 2, quote)
+            offset += match.end()
+            if offset < len(name) and name[offset] != '.':
+                raise ValueError('Unexpected SQL after quoted identifier')
+        else:
+            end = name.find('.', offset) if qualified else -1
+            if end < 0:
+                end = len(name)
+            part = name[offset:end]
+            offset = end
+        sql_identifier(part)  # Apply the same length/NUL contract to decoded parts.
+        parts.append(part)
+        if offset < len(name):
+            if not qualified or len(parts) >= 2 or offset + 1 == len(name):
+                raise ValueError('Expected an atomic name or database.table reference')
+            offset += 1
+    return tuple(parts)
+
+
+def sql_object_name(name, qualified=False):
+    """Render a manager name, including complete legacy backtick quoting."""
+    return '.'.join(sql_identifier(part) for part in identifier_parts(name, qualified))
+
+
 def sql_literal(value):
     if value is None:
         return 'NULL'
@@ -245,15 +283,16 @@ def substitute_parameters(sql, params, *, sql_mode=''):
     return ''.join(output)
 
 
-def sql_string_token(value):
+def sql_string_token(value, *, context='LOAD') -> str:
     """Render a grammar STRING, rejecting SQL-mode-dependent escapes.
 
     LOAD's STRING positions cannot use CAST/hex or dollar-quoted expressions.
     Inline data containing backslashes must use a caller-owned input file;
     paths/options themselves must not contain backslashes or NUL bytes.
     """
     if not isinstance(value, str) or '\x00' in value or '\\' in value:
-        raise ValueError('LOAD string tokens require text without NUL or backslashes; use a file for such inline data')
+        advice = '; use a file for such inline data' if context == 'LOAD' else ''
+        raise ValueError(context + ' string tokens require text without NUL or backslashes' + advice)
     return "'" + value.replace("'", "''") + "'"
 
 
```

**File**: `clients/python/matrixone/_utils.py` (modified, +8/-0)
```diff
@@ -161,3 +161,11 @@ def discard_unrestored_connection(conn):
             conn.dialect.do_terminate(raw)
         finally:
             conn.invalidate()
+
+
+def result_returns_rows(result):
+    """CursorResult declares its shape; ORM row results expose keys/fetchall."""
+    declared = getattr(result, 'returns_rows', None)
+    if declared is not None:
+        return bool(declared)
+    return callable(getattr(result, 'keys', None)) and callable(getattr(result, 'fetchall', None))
```

**File**: `clients/python/matrixone/account.py` (modified, +36/-22)
```diff
@@ -167,7 +167,9 @@ def _build_drop_user_sql(self, user_name: str, if_exists: bool = False) -> str:
         sql += self._client._escape_identifier(user_name)
         return sql
 
-    def _build_alter_user_sql(self, user_name: str, password: Optional[str] = None, comment: Optional[str] = None) -> str:
+    def _build_alter_user_sql(
+        self, user_name: str, password: Optional[str] = None, comment: Optional[str] = None
+    ) -> str:
         """Build ALTER USER SQL statement"""
         sql_parts = [f"ALTER USER {self._client._escape_identifier(user_name)}"]
         if password:
@@ -325,7 +327,9 @@ def _get_executor(self):
         return self.executor if self.executor else self._client
 
     # Account Management
-    def create_account(self, account_name: str, admin_name: str, password: str, comment: Optional[str] = None) -> Account:
+    def create_account(
+        self, account_name: str, admin_name: str, password: str, comment: Optional[str] = None
+    ) -> Account:
         """
         Create a new account in MatrixOne
 
@@ -350,7 +354,7 @@ def create_account(self, account_name: str, admin_name: str, password: str, comm
             return self.get_account(account_name)
 
         except Exception as e:
-            raise AccountError(f"Failed to create account '{account_name}': {e}") from None
+            raise AccountError(f"Failed to create account '{account_name}': {e}") from e
 
     def drop_account(self, account_name: str, if_exists: bool = False) -> None:
         """
@@ -365,7 +369,7 @@ def drop_account(self, account_name: str, if_exists: bool = False) -> None:
             sql = self._build_drop_account_sql(account_name, if_exists)
             self._get_executor().execute(sql)
         except Exception as e:
-            raise AccountError(f"Failed to drop account '{account_name}': {e}") from None
+            raise AccountError(f"Failed to drop account '{account_name}': {e}") from e
 
     def alter_account(
         self,
@@ -396,7 +400,7 @@ def alter_account(
             return self.get_account(account_name)
 
         except Exception as e:
-            raise AccountError(f"Failed to alter account '{account_name}': {e}") from None
+            raise AccountError(f"Failed to alter account '{account_name}': {e}") from e
 
     def get_account(self, account_name: str) -> Account:
         """Get account by name"""
@@ -414,7 +418,7 @@ def get_account(self, account_name: str) -> Account:
             raise AccountError(f"Account '{account_name}' not found") from None
 
         except Exception as e:
-            raise AccountError(f"Failed to get account '{account_name}': {e}") from None
+            raise AccountError(f"Failed to get account '{account_name}': {e}") from e
 
     def list_accounts(self) -> List[Account]:
         """List all accounts"""
@@ -428,7 +432,7 @@ def list_accounts(self) -> List[Account]:
             return [self._row_to_account(row) for row in result.rows]
 
         except Exception as e:
-            raise AccountError(f"Failed to list accounts: {e}") from None
+            raise AccountError(f"Failed to list accounts: {e}") from e
 
     # User Management
     def create_user(self, user_name: str, password: str, comment: Optional[str] = None) -> User:
@@ -472,7 +476,7 @@ def create_user(self, user_name: str, password: str, comment: Optional[str] = No
             )
 
         except Exception as e:
-            raise AccountError(f"Failed to create user '{user_name}': {e}") from None
+            raise AccountError(f"Failed to create user '{user_name}': {e}") from e
 
     def drop_user(self, user_name: str, if_exists: bool = False) -> None:
         """
@@ -489,7 +493,7 @@ def drop_user(self, user_name: str, if_exists: bool = False) -> None:
             self._get_executor().execute(sql)
 
         except Exception as e:
-            raise AccountError(f"Failed to drop user '{user_name}': {e}") from None
+            raise AccountError(f"Failed to drop user '{user_name}': {e}") from e
 
     def alter_user(
         self,
@@ -551,7 +555,7 @@ def alter_user(
             )
 
         except Exception as e:
-            raise AccountError(f"Failed to alter user '{user_name}': {e}") from None
+            raise AccountError(f"Failed to alter user '{user_name}': {e}") from e
 
     def get_current_user(self) -> User:
         """Get current user information"""
@@ -584,7 +588,7 @@ def get_current_user(self) -> User:
             )
 
         except Exception as e:
-            raise AccountError(f"Failed to get current user: {e}") from None
+            raise AccountError(f"Failed to get current user: {e}") from e
 
     def list_users(self) -> List[User]:
         """
@@ -611,7 +615,7 @@ def list_users(self) -> List[User]:
             return [User(name=current_user_name, host="%", account=current_account, status="OPEN")]
 
         except Exception as e:
-            raise AccountError(f"Failed to list users: {e}") from None
+            raise Acco
```

---

### Incident Patch 3: `24c1ac89` (2026-10-26)
**Commit Message**: fix: close proxy handoff and CI fixture ownership gaps (#31288)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #31144
Fixes #31281

Related #29249 and #30584.

## What this PR does / why we need it:

Close the proxy response/publication race: a backend can finish FETCH
before the forwarding Write returns, leaving a pending transfer without
a later wakeup. At the existing response boundary, flush, reserve the
transfer gate, drain publication through the existing condition
variable, and recheck admission. Failed forwarding and closed pipes
become terminal before waiters wake. Preserve the transfer deadline and
earlier caller deadlines.

Share embed's existing range/flock port-reservation authority with
standalone test listeners through `pkg/testutil/portlease`. Both use the
same bounded per-UID pool; legacy allocations retain leases across
rollover and listener restarts. Keep explicit exhaustion and acquisition
errors, without fallback or waiting. Cooperating processes must share
the coordination filesystem.

Share task backing-storage readin

**File**: `pkg/embed/cluster.go` (modified, +21/-30)
```diff
@@ -31,6 +31,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
 	"github.com/matrixorigin/matrixone/pkg/testutil/clusteradmission"
+	"github.com/matrixorigin/matrixone/pkg/testutil/portlease"
 	"github.com/matrixorigin/matrixone/pkg/util/fault"
 )
 
@@ -42,11 +43,10 @@ const (
 )
 
 var (
-	minPort = uint64(10000)
-	maxPort = uint64(60000)
+	clusterPortAllocator = portlease.Allocator{}
 
 	basePortStep  = uint64(20)
-	portLeaseSpan = uint64(1000)
+	portLeaseSpan = portlease.Span
 
 	clusterID = getInitValue("mo-test.cluster")
 )
@@ -66,7 +66,7 @@ const (
 type clusterPortLease struct {
 	base uint64
 	next atomic.Uint64
-	lock *flock.Flock
+	lock *portlease.Lease
 }
 
 type cluster struct {
@@ -669,34 +669,25 @@ func (c *cluster) initTNServiceConfig() error {
 }
 
 func acquireClusterPortLease() (*clusterPortLease, error) {
-	for base := minPort; base+portLeaseSpan <= maxPort; base += portLeaseSpan {
-		lease, locked, err := tryAcquireClusterPortLease(base)
-		if err != nil {
-			return nil, err
-		}
-		if locked {
-			return lease, nil
-		}
+	lease, err := clusterPortAllocator.Acquire()
+	if err != nil {
+		return nil, err
 	}
-	return nil, moerr.NewInternalErrorNoCtx("no embedded-test port range is available")
+	return wrapClusterPortLease(lease), nil
 }
 
 func tryAcquireClusterPortLease(base uint64) (*clusterPortLease, bool, error) {
-	dir := filepath.Join(os.TempDir(), "mo-test-port-leases")
-	if err := os.MkdirAll(dir, 0755); err != nil {
-		return nil, false, err
+	lease, locked, err := clusterPortAllocator.TryAcquire(base)
+	if err != nil || !locked {
+		return nil, locked, err
 	}
-	fl := flock.New(filepath.Join(dir, fmt.Sprintf("%d.lock", base)))
-	locked, err := fl.TryLock()
-	if err != nil {
-		return nil, false, err
-	}
-	if !locked {
-		return nil, false, fl.Close()
-	}
-	lease := &clusterPortLease{base: base, lock: fl}
-	lease.next.Store(base)
-	return lease, true, nil
+	return wrapClusterPortLease(lease), true, nil
+}
+
+func wrapClusterPortLease(lease *portlease.Lease) *clusterPortLease {
+	result := &clusterPortLease{base: lease.Base(), lock: lease}
+	result.next.Store(lease.Base())
+	return result
 }
 
 func portBaseCapacity() (uint64, error) {
@@ -935,12 +926,12 @@ func getInitValue(name string) uint64 {
 	if err != nil && err != io.EOF {
 		panic(err)
 	}
-	value := minPort
+	value := portlease.MinPort
 	if n > 0 {
 		value = binary.BigEndian.Uint64(data)
 	}
-	if value > maxPort {
-		value = minPort
+	if value > portlease.MaxPort {
+		value = portlease.MinPort
 	}
 	binary.BigEndian.PutUint64(data, value+1000)
 
```

**File**: `pkg/embed/cluster_test.go` (modified, +34/-6)
```diff
@@ -25,6 +25,7 @@ import (
 	"os/exec"
 	"path/filepath"
 	"sort"
+	"strconv"
 	"sync"
 	"sync/atomic"
 	"testing"
@@ -37,7 +38,9 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/stopper"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/tests"
 	"github.com/matrixorigin/matrixone/pkg/testutil/clusteradmission"
+	"github.com/matrixorigin/matrixone/pkg/testutil/portlease"
 	"github.com/matrixorigin/matrixone/pkg/tnservice"
 	"github.com/matrixorigin/matrixone/pkg/txn/rpc"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
@@ -755,7 +758,7 @@ func TestGetInitValueWithEmptyNameMustPanic(t *testing.T) {
 func TestClusterPortLeasesAreExclusive(t *testing.T) {
 	// This lock-only test must own its namespace: other cluster processes may
 	// legitimately acquire a released range before this test reacquires it.
-	t.Setenv("TMPDIR", t.TempDir())
+	isolateClusterPortLeases(t)
 	first, err := acquireClusterPortLease()
 	require.NoError(t, err)
 	firstCluster := &cluster{
@@ -800,7 +803,7 @@ func TestClusterPortLeasesAreExclusive(t *testing.T) {
 }
 
 func TestClusterStopRetainsPortLease(t *testing.T) {
-	t.Setenv("TMPDIR", t.TempDir())
+	isolateClusterPortLeases(t)
 	ports, err := acquireClusterPortLease()
 	require.NoError(t, err)
 	c := &cluster{portLease: ports, portLeaseBase: ports.base, portLeaseNext: ports.base,
@@ -898,7 +901,7 @@ func TestNewClusterRejectsPortRangeExhaustion(t *testing.T) {
 }
 
 func TestNextBasePortExhaustionDoesNotConsumeCapacity(t *testing.T) {
-	lease := &clusterPortLease{base: minPort}
+	lease := &clusterPortLease{base: portlease.MinPort}
 	lastValid := lease.base + portLeaseSpan - basePortStep
 	lease.next.Store(lastValid)
 	c := &cluster{id: 1, portLease: lease, portLeaseNext: lastValid}
@@ -910,7 +913,7 @@ func TestNextBasePortExhaustionDoesNotConsumeCapacity(t *testing.T) {
 }
 
 func TestStartNewCNServiceRejectsCapacityWithoutMutatingTopology(t *testing.T) {
-	lease := &clusterPortLease{base: minPort}
+	lease := &clusterPortLease{base: portlease.MinPort}
 	lastValid := lease.base + portLeaseSpan - basePortStep
 	lease.next.Store(lastValid)
 	c := &cluster{
@@ -938,8 +941,8 @@ func TestClusterRejectsNegativeCNCounts(t *testing.T) {
 	require.Nil(t, value)
 	require.ErrorContains(t, err, "CN count cannot be negative")
 
-	c := &cluster{state: started, portLease: &clusterPortLease{base: minPort}}
-	c.portLease.next.Store(minPort)
+	c := &cluster{state: started, portLease: &clusterPortLease{base: portlease.MinPort}}
+	c.portLease.next.Store(portlease.MinPort)
 	err = c.StartNewCNService(-1)
 	require.ErrorContains(t, err, "additional CN count cannot be negative")
 	require.Zero(t, c.options.cn)
@@ -1751,3 +1754,28 @@ load-to-mo = true
 	require.NoError(t, c.Start())
 	check(false)
 }
+
+func isolateClusterPortLeases(t *testing.T) {
+	previous := clusterPortAllocator
+	clusterPortAllocator = portlease.Allocator{Directory: t.TempDir()}
+	t.Cleanup(func() { clusterPortAllocator = previous })
+}
+
+func TestClusterAndLegacyPortAllocatorsShareLeases(t *testing.T) {
+	clusterLease, err := acquireClusterPortLease()
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, clusterLease.lock.Close()) })
+	port, err := tests.GetAvailablePort("127.0.0.1")
+	require.NoError(t, err)
+	value, err := strconv.ParseUint(port, 10, 64)
+	require.NoError(t, err)
+	require.True(t, value < clusterLease.base || value >= clusterLease.base+portLeaseSpan)
+	// The legacy allocation remains reserved even though no listener was started.
+	base := portlease.MinPort + (value-portlease.MinPort)/portlease.Span*portlease.Span
+	contender, locked, err := tryAcquireClusterPortLease(base)
+	require.NoError(t, err)
+	if contender != nil {
+		require.NoError(t, contender.lock.Close())
+	}
+	require.False(t, locked)
+}
```

**File**: `pkg/embed/daemon_claim_test.go` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/pb/task"
 	"github.com/matrixorigin/matrixone/pkg/taskservice"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/stretchr/testify/require"
 )
 
@@ -31,7 +32,7 @@ func TestDaemonClaimSQLRoundTrip(t *testing.T) {
 	RunSingleCNBaseClusterTests(t, func(c Cluster) {
 		cn, err := c.GetCNService(0)
 		require.NoError(t, err)
-		service, ok := cn.RawService().(taskServiceGetter).GetTaskService()
+		service, ok := cn.RawService().(testutil.TaskServiceGetter).GetTaskService()
 		require.True(t, ok)
 		storage := service.GetStorage()
 		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
```

**File**: `pkg/embed/testing.go` (modified, +3/-34)
```diff
@@ -24,7 +24,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
-	"github.com/matrixorigin/matrixone/pkg/taskservice"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/util/metric/stats"
 )
 
@@ -648,56 +648,25 @@ func adjustTestingClusterTiming(svc ServiceOperator) {
 	}
 }
 
-type taskServiceGetter interface {
-	GetTaskService() (taskservice.TaskService, bool)
-}
-
 func waitBasicClusterTaskServices(ctx context.Context, c Cluster, cnCount int) error {
 	for index := 0; index < cnCount; index++ {
 		svc, err := c.GetCNService(index)
 		if err != nil {
 			return err
 		}
-		getter, ok := svc.RawService().(taskServiceGetter)
+		getter, ok := svc.RawService().(testutil.TaskServiceGetter)
 		if !ok {
 			return moerr.NewInternalErrorNoCtxf(
 				"CN %s does not expose its task service", svc.ServiceID())
 		}
-		if err := waitTaskServiceReady(ctx, getter, basicClusterServiceStartupRetryInterval); err != nil {
+		if err := testutil.WaitTaskServiceReady(ctx, getter, basicClusterServiceStartupRetryInterval); err != nil {
 			return errors.Join(moerr.NewInternalErrorNoCtxf(
 				"CN %s task service did not become ready", svc.ServiceID()), err)
 		}
 	}
 	return nil
 }
 
-func waitTaskServiceReady(
-	ctx context.Context,
-	getter taskServiceGetter,
-	retryInterval time.Duration,
-) error {
-	for {
-		if err := ctx.Err(); err != nil {
-			return err
-		}
-		if service, ok := getter.GetTaskService(); ok && service != nil {
-			// Holder publication does not imply backing storage availability.
-			// Ping also succeeds with no store; a bounded read observes the real
-			// boundary and requests refresh without retrying any business write.
-			_, err := service.QueryDaemonTask(ctx, taskservice.WithTaskIDCond(taskservice.EQ, 0))
-			if ctx.Err() != nil {
-				return ctx.Err()
-			}
-			if err == nil || !errors.Is(err, taskservice.ErrNotReady) {
-				return err
-			}
-		}
-		if err := waitStartupRetry(ctx, retryInterval); err != nil {
-			return err
-		}
-	}
-}
-
 func basicClusterSetupTracer(t testReporter, cnCount int) func(string, time.Duration, error) {
 	return func(phase string, duration time.Duration, err error) {
 		status := "ready"
```

**File**: `pkg/embed/testing_test.go` (modified, +11/-164)
```diff
@@ -20,188 +20,27 @@ import (
 	"fmt"
 	"runtime"
 	"strings"
-	"sync"
 	"testing"
 	"time"
 
 	mruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
-	"github.com/matrixorigin/matrixone/pkg/pb/task"
 	"github.com/matrixorigin/matrixone/pkg/taskservice"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
 
-type delayedTaskServiceGetter struct {
-	mu      sync.RWMutex
-	service taskservice.TaskService
-	called  chan struct{}
-	once    sync.Once
-}
-
-func newDelayedTaskServiceGetter() *delayedTaskServiceGetter {
-	return &delayedTaskServiceGetter{called: make(chan struct{})}
-}
-
-func (g *delayedTaskServiceGetter) GetTaskService() (taskservice.TaskService, bool) {
-	g.once.Do(func() { close(g.called) })
-	g.mu.RLock()
-	defer g.mu.RUnlock()
-	return g.service, g.service != nil
-}
-
-func (g *delayedTaskServiceGetter) set(service taskservice.TaskService) {
-	g.mu.Lock()
-	g.service = service
-	g.mu.Unlock()
-}
-
-func (g *delayedTaskServiceGetter) Start() error { return nil }
-func (g *delayedTaskServiceGetter) Close() error { return nil }
-
-func TestWaitTaskServiceReadyObservesOwnedService(t *testing.T) {
-	getter := newDelayedTaskServiceGetter()
-	service := taskservice.NewTaskService(
-		mruntime.DefaultRuntime(), taskservice.NewMemTaskStorage())
-	defer func() { require.NoError(t, service.Close()) }()
-	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
-	defer cancel()
-
-	done := make(chan error, 1)
-	go func() {
-		done <- waitTaskServiceReady(ctx, getter, time.Millisecond)
-	}()
-	<-getter.called
-	getter.set(service)
-	require.NoError(t, <-done)
-}
-
-func TestWaitTaskServiceReadyHonorsCancellation(t *testing.T) {
-	getter := newDelayedTaskServiceGetter()
-	ctx, cancel := context.WithCancel(context.Background())
-	done := make(chan error, 1)
-	go func() {
-		done <- waitTaskServiceReady(ctx, getter, time.Hour)
-	}()
-	<-getter.called
-	cancel()
-	require.ErrorIs(t, <-done, context.Canceled)
-}
-
-type readinessTaskStorage struct {
-	taskservice.TaskStorage
-	query func(context.Context) error
-}
-
-func (s *readinessTaskStorage) QueryDaemonTask(ctx context.Context, _ ...taskservice.Condition) ([]task.DaemonTask, error) {
-	return nil, s.query(ctx)
-}
-
-func TestWaitTaskServiceReadyObservesStorage(t *testing.T) {
-	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
-	defer cancel()
-	queried, release := make(chan struct{}), make(chan struct{})
-	store := taskservice.NewMemTaskStorage()
-	calls := 0
-	service := taskservice.NewTaskService(mruntime.DefaultRuntime(), &readinessTaskStorage{
-		TaskStorage: store,
-		query: func(ctx context.Context) error {
-			calls++
-			if calls == 1 {
-				return fmt.Errorf("initial refresh: %w", taskservice.ErrNotReady)
-			}
-			close(queried)
-			select {
-			case <-release:
-				return nil
-			case <-ctx.Done():
-				return ctx.Err()
-			}
-		},
-	})
-	defer func() { require.NoError(t, service.Close()) }()
-	getter := newDelayedTaskServiceGetter()
-	getter.set(service)
-	done := make(chan error, 1)
-	go func() {
-		err := waitTaskServiceReady(ctx, getter, 0)
-		if err == nil {
-			_, err = store.AddDaemonTask(ctx, task.DaemonTask{Metadata: task.TaskMetadata{ID: "once"}})
-		}
-		done <- err
-	}()
-	joined := false
-	defer func() {
-		cancel()
-		if !joined {
-			<-done
-		}
-	}()
-	select {
-	case <-queried:
-	case err := <-done:
-		joined = true
-		t.Fatalf("fixture admitted before storage observation: %v", err)
-	case <-ctx.Done():
-		t.Fatal("storage observation did not start")
-	}
-	rows, err := store.QueryDaemonTask(ctx)
-	require.NoError(t, err)
-	require.Empty(t, rows, "no business write before readiness")
-	close(release)
-	err = <-done
-	joined = true
-	require.NoError(t, err)
-	require.Equal(t, 2, calls)
-	rows, err = store.QueryDaemonTask(ctx)
-	require.NoError(t, err)
-	require.Len(t, rows, 1, "one business write after readiness")
-}
-
-func TestWaitTaskServiceReadyStorageErrors(t *testing.T) {
-	for _, name := range []string{"fatal", "cancel during read", "cancel while not ready"} {
-		t.Run(name, func(t *testing.T) {
-			ctx, cancel := context.WithCancel(t.Context())
-			defer cancel()
-			want := errors.New("storage failure")
-			calls := 0
-			service := taskservice.NewTaskService(mruntime.DefaultRuntime(), &readinessTaskStorage{
-				TaskStorage: taskservice.NewMemTaskStorage(),
-				query: func(context.Context) error {
-					calls++
-					if name == "fatal" {
-						return want
-					}
-					cancel()
-					if name == "cancel while not ready" {
-						return taskservice.ErrNotReady
-					}
-					return nil
-				},
-			})
-			defer func() { require.NoError(t, service.Close()) }()
-			getter := newDelayedTaskServiceGetter()
-			getter.set(service)
-			if name != "fatal" {
-				want = context.Canceled
-			}
-			require.ErrorIs(t, waitTaskServiceReady(ctx, getter, time.Hour), want)
-			require.Equal(t, 1, calls, "fatal error
```

**File**: `pkg/iscp/iteration_consumer_context_test.go` (modified, +31/-18)
```diff
@@ -21,6 +21,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
@@ -341,24 +342,36 @@ func TestRunInitSQLTransactionRollsBackStatementsWhenStageWriteFails(t *testing.
 }
 
 func TestRunInitSQLTransactionDoesNotWriteStageAfterStatementFailure(t *testing.T) {
-	txn := &iscpTxnForTest{}
-	wantErr := errors.New("init statement failed")
-	stageWritten := false
-
-	err := runInitSQLTransaction(
-		context.Background(),
-		txn,
-		func(context.Context, client.TxnOperator) error { return wantErr },
-		func(context.Context, client.TxnOperator) error {
-			stageWritten = true
-			return nil
-		},
-	)
-
-	require.ErrorIs(t, err, wantErr)
-	require.False(t, stageWritten)
-	require.False(t, txn.committed)
-	require.True(t, txn.rolledBack)
+	for _, tc := range []struct {
+		name string
+		err  error
+	}{
+		{"fatal", errors.New("init statement failed")},
+		{"rc_retry", moerr.NewTxnNeedRetryNoCtx()},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			txn := &iscpTxnForTest{}
+			stageWritten := false
+			attempts := 0
+			err := runInitSQLTransaction(
+				context.Background(),
+				txn,
+				func(context.Context, client.TxnOperator) error {
+					attempts++
+					return tc.err
+				},
+				func(context.Context, client.TxnOperator) error {
+					stageWritten = true
+					return nil
+				},
+			)
+			require.ErrorIs(t, err, tc.err)
+			require.Equal(t, 1, attempts, "the caller retries with a new transaction")
+			require.False(t, stageWritten)
+			require.False(t, txn.committed)
+			require.True(t, txn.rolledBack)
+		})
+	}
 }
 
 func TestRunInitSQLTransactionRollsBackCancellationBeforeStageWrite(t *testing.T) {
```

**File**: `pkg/iscp/watermark_contention_test.go` (modified, +25/-3)
```diff
@@ -49,7 +49,7 @@ func (p *watermarkSQLProbe) Exec(ctx context.Context, statement string, opts exe
 	// still use the real service executor and the production statement options.
 	statement = strings.ReplaceAll(statement, "mo_catalog.mo_iscp_log", "watermark_contention.jobs")
 	result, err := p.SQLExecutor.Exec(ctx, statement, opts)
-	if err == nil && strings.Contains(statement, "AND table_id = 3 ") {
+	if err == nil && result.AffectedRows == 1 && strings.Contains(statement, "AND table_id = 3 ") {
 		p.once.Do(func() {
 			close(p.held)
 			select {
@@ -87,6 +87,18 @@ func TestWatermarkBatchYieldsToRetirement(t *testing.T) {
 		require.NoError(t, err, statement)
 	}
 	service := cn.RawService().(cnservice.Service)
+	peerService := peer.RawService().(cnservice.Service)
+	// Cross-CN sessions do not share a commit frontier. Fence each handoff
+	// before creating the reader's transaction, using this test's own budget.
+	syncCommit := func(reader, writer cnservice.Service) {
+		t.Helper()
+		commitTS := writer.GetTxnClient().GetLatestCommitTS()
+		require.False(t, commitTS.IsEmpty())
+		snapshot, err := reader.GetTxnClient().WaitLogTailAppliedAt(ctx, commitTS)
+		require.NoError(t, err)
+		require.True(t, snapshot.Greater(commitTS))
+	}
+	syncCommit(service, peerService)
 	rt := moruntime.ServiceRuntime(cn.ServiceID())
 	original, ok := rt.GetGlobalVariables(moruntime.InternalSQLExecutor)
 	require.True(t, ok)
@@ -103,17 +115,25 @@ func TestWatermarkBatchYieldsToRetirement(t *testing.T) {
 	defer func() { cancel(); resume(); <-flushed }()
 	select {
 	case <-probe.held:
+	case <-flushed:
+		t.Fatalf("publisher exited before acquiring its first row: %v", flushErr)
 	case <-ctx.Done():
 		t.Fatal("publisher did not acquire its first row", ctx.Err())
 	}
 	retirement, err := db.BeginTx(ctx, nil)
 	require.NoError(t, err)
 	defer retirement.Rollback()
-	_, err = retirement.ExecContext(ctx, "update watermark_contention.jobs set drop_at=now() where account_id=1 and table_id=4 and job_name='second' and job_id=1")
+	result, err := retirement.ExecContext(ctx, "update watermark_contention.jobs set drop_at=now() where account_id=1 and table_id=4 and job_name='second' and job_id=1")
+	require.NoError(t, err)
+	affected, err := result.RowsAffected()
 	require.NoError(t, err)
+	require.Equal(t, int64(1), affected)
 	resume()
-	_, err = retirement.ExecContext(ctx, "update watermark_contention.jobs set drop_at=now() where account_id=1 and table_id=3 and job_name='first' and job_id=1")
+	result, err = retirement.ExecContext(ctx, "update watermark_contention.jobs set drop_at=now() where account_id=1 and table_id=3 and job_name='first' and job_id=1")
 	require.NoError(t, err, "retirement must acquire the row released by the publisher")
+	affected, err = result.RowsAffected()
+	require.NoError(t, err)
+	require.Equal(t, int64(1), affected)
 	require.NoError(t, retirement.Commit())
 	<-flushed
 	require.ErrorContains(t, flushErr, "wait policy is fast fail")
@@ -122,7 +142,9 @@ func TestWatermarkBatchYieldsToRetirement(t *testing.T) {
 	require.NoError(t, db.QueryRowContext(ctx, "select count(*) from watermark_contention.jobs where watermark='1-0' and cast(json_extract(job_status,'$.LSN') as unsigned)=5 and drop_at is not null").Scan(&rows))
 	require.Equal(t, 2, rows, "no prefix of the failed batch may become durable")
 	// A subsequent normal flush commits both rows through the same owner.
+	syncCommit(service, peerService)
 	require.NoError(t, flush())
+	syncCommit(peerService, service)
 	require.NoError(t, db.QueryRowContext(ctx, "select count(*) from watermark_contention.jobs where watermark='2-0' and cast(json_extract(job_status,'$.LSN') as unsigned)=6").Scan(&rows))
 	require.Equal(t, 2, rows)
 	_, err = db.ExecContext(ctx, "drop database watermark_contention")
```

**File**: `pkg/proxy/tunnel.go` (modified, +65/-9)
```diff
@@ -1063,7 +1063,7 @@ func (t *tunnel) admitTransferWithGate(sync bool, prearmed *pipe) (*pipe, bool)
 	if prearmed != nil && !gateOwned {
 		return nil, false
 	}
-	if csp.mu.paused || scp.mu.paused {
+	if csp.mu.closed || scp.mu.closed || csp.mu.paused || scp.mu.paused {
 		return nil, false
 	}
 	if csp.clientMessageActive.Load() ||
@@ -1230,6 +1230,14 @@ func (t *tunnel) transferSyncWithGate(ctx context.Context, gate *pipe) error {
 		t.logger.Info("tunnel is already in transfer, skip sync transfer")
 		return nil
 	}
+	ctx, cancel := context.WithTimeoutCause(ctx, defaultTransferTimeout, moerr.CauseTransferSync)
+	defer cancel()
+	if gate != nil {
+		if err := gate.waitClientMessageClaim(ctx); err != nil {
+			t.finishTransferAttempt()
+			return moerr.AttachCause(ctx, err)
+		}
+	}
 	// Must check if it is safe to start the transfer.
 	csp, ok := t.admitTransferWithGate(true, gate)
 	if !ok {
@@ -1242,8 +1250,6 @@ func (t *tunnel) transferSyncWithGate(ctx context.Context, gate *pipe) error {
 	start := time.Now()
 	defer t.finishTransfer(start)
 	t.logger.Info("transfer begin")
-	ctx, cancel := context.WithTimeoutCause(ctx, defaultTransferTimeout, moerr.CauseTransferSync)
-	defer cancel()
 	if err := t.doReplaceConnection(ctx, true); err != nil {
 		v2.ProxyTransferFailCounter.Inc()
 		return moerr.AttachCause(ctx, err)
@@ -1424,6 +1430,7 @@ func (p *pipe) kickoff(ctx context.Context, peer *pipe) (e error) {
 		if e != nil {
 			p.mu.closed = true
 		}
+		p.clientMessageActive.Store(false)
 		p.mu.started = false
 		p.mu.cond.Broadcast()
 	}
@@ -1574,7 +1581,7 @@ func (p *pipe) kickoff(ctx context.Context, peer *pipe) (e error) {
 			return err
 		}
 		if p.name == pipeServerToClient && armSyncTransfer {
-			p.syncTransferArmed = peer.tryArmSyncTransfer()
+			p.syncTransferArmed = peer.tryArmSyncTransfer(false)
 		}
 		if p.testHelper.beforeSend != nil {
 			p.testHelper.beforeSend()
@@ -1596,11 +1603,19 @@ func (p *pipe) kickoff(ctx context.Context, peer *pipe) (e error) {
 
 		handled, err := p.src.sendTo(p.dst)
 		if err != nil {
-			if p.name == pipeClientToServer {
-				p.finishClientMessageClaim()
-			}
+			// finish publishes the terminal pipe state before waking a waiter.
+			// A failed write must not look like a successfully drained claim.
 			return wrapPipeSendError(p.name, err)
 		}
+		if p.name == pipeServerToClient && armSyncTransfer && !p.syncTransferArmed {
+			// A response can finish before the request's Write returns. Flush
+			// the response before reserving the publication gate and waiting;
+			// otherwise the client and request writer could wait on each other.
+			if err := p.src.flushBufDst(); err != nil {
+				return wrapPipeSendError(p.name, err)
+			}
+			p.syncTransferArmed = peer.tryArmSyncTransfer(true)
+		}
 		if p.name == pipeClientToServer {
 			if handled {
 				if !stopAfterSend {
@@ -1668,7 +1683,43 @@ func (p *pipe) claimClientMessage(
 }
 
 func (p *pipe) finishClientMessageClaim() {
+	p.mu.Lock()
+	defer p.mu.Unlock()
 	p.clientMessageActive.Store(false)
+	p.mu.cond.Broadcast()
+}
+
+// The existing gate prevents a following request from publishing while the
+// preceding request drains. Cancellation and pipe termination both wake cond.
+func (p *pipe) waitClientMessageClaim(ctx context.Context) error {
+	p.mu.Lock()
+	defer p.mu.Unlock()
+	if err := context.Cause(ctx); err != nil {
+		return err
+	}
+	if p.clientMessageActive.Load() {
+		stop := context.AfterFunc(ctx, func() {
+			p.mu.Lock()
+			p.mu.cond.Broadcast()
+			p.mu.Unlock()
+		})
+		defer stop()
+		if onWait := p.testHelper.onSyncTransferWait; onWait != nil {
+			p.mu.Unlock()
+			onWait()
+			p.mu.Lock()
+		}
+		for p.clientMessageActive.Load() && !p.mu.closed && !p.mu.paused && ctx.Err() == nil {
+			p.mu.cond.Wait()
+		}
+	}
+	if err := context.Cause(ctx); err != nil {
+		return err
+	}
+	if p.mu.closed {
+		return errPipeClosed
+	}
+	return nil
 }
 
 func (p *pipe) finishSyncTransfer() {
@@ -1680,11 +1731,16 @@ func (p *pipe) finishSyncTransfer() {
 	p.mu.Unlock()
 }
 
-func (p *pipe) tryArmSyncTransfer() bool {
+// Only the post-forwarding boundary may reserve the gate while an earlier
+// request still owns publication. The transfer owner then joins that claim.
+func (p *pipe) tryArmSyncTransfer(afterResponse bool) bool {
 	p.mu.Lock()
 	defer p.mu.Unlock()
 	if p.mu.closed || p.mu.paused || p.mu.syncTransferDone != nil ||
-		p.clientMessageActive.Load() {
+		(!afterResponse && p.clientMessageActive.Load()) {
+		return false
+	}
+	if afterResponse && p.tun.hasUntransferableClientState() {
 		return false
 	}
 	p.mu.syncTransferDone = make(chan struct{})
```

#### Recent Merged Pull Requests:
- **PR #31470** (closed): test: make HNSW polling use read committed (@XuPeng-SH)
- **PR #31465** (closed): [4.0] ci: pin molint version (@XuPeng-SH)
- **PR #31464** (closed): [4.1] ci: pin molint version (@XuPeng-SH)
- **PR #31461** (2026-10-27): fix(sysview): NULL charset/collation for binary-family columns and NULL UPDATE/CHECK time for fresh tables in information_schema (@aptend)
- **PR #31457** (2026-10-27): test(hnsw): shorten the cross-CN freshness sweep in vector_hnsw_delete_insert (#31456) (@cpegeric)
- **PR #31435** (2026-10-27): fix: refresh ALTER COPY after concurrent source writes (@iamlinjunhong)

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

## X. sql): separate ODKU OK insert ID from session baseline (#28444)

**RULE**:
When implementing operations in `docs/design/20261016-odku-distributed-result-protocol-r2-addendum.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9cf8743e`: sql): separate ODKU OK insert ID from session baseline (#28444). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/20261016-odku-distributed-result-protocol-r2-addendum.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Distributed ODKU Result Protocol: r2 alignment addendum

Status: approved by independent scoped design review r2; see
`20261016-odku-distributed-result-protocol-review-v2.md`.
No build, regression, BVT, deployment, performance, or implementation acceptance
is claimed by this document. Root owns reviewer and lifecycle decisions.

- Revision: r2, 2026-10-16, owner VioletQwQ-0, PR #28444 / issue #28162.
- Accepted source before this repair: `0c2090984b2aebef9cf10fba304465b14e3f5c77`.
- Necessary normal-merge target: `b3d6b21fe9d260c91e1777529a48a9d93061af33`.
- Original r1 inspected implementation: `286b60837041d819573a260f7ab6e346125c6d3a`.
- Original reviewed r1 content: Git blob `914d5ddd19635d07924ebbe22cbb5eaa6f192fa2`
  at head `038207ff2e5fd84d79d7d6c851c467b68b05a4e8`, SHA256
  `ddff85b82ca7775ce492d68fb904a3bd5952c59e4f6390a8733ddf347953e756`.
- The immutable [v1 approval record](20261016-odku-distributed-result-protocol-review-v1.md)
  remains an approval of that exact r1 content. It is not approval of this r2
  addendum or of the repaired implementation.

## Subsequent candidate allocation overlay (not part of r2 approval)

For the current conflict-repair candidate, actua
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9cf8743e` are properly handled with clean fallback behavior.
