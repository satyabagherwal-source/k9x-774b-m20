# Forensic Learning Record (Deep Inspection): sfu-db/connector-x

> **Canonical Artifact**: `07_PROJECT_LEARNING/sfu-db-connector-x-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sfu-db/connector-x](https://github.com/sfu-db/connector-x))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:20:04.833Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sfu-db/connector-x`
- **Description**: Fastest library to load data from DB to DataFrames in Rust and Python
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2654 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/ddos-cx.py`
```
"""
Usage:
  tpch-cx.py [--protocol=<protocol>] [--conn=<conn>] [--ret=<ret>] <num>

Options:
  --protocol=<protocol>  The protocol to use [default: binary].
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --ret=<ret>            The return type [default: pandas].
  -h --help              Show this screen.
  --version              Show version.
"""
import os

import connectorx as cx
from contexttimer import Timer
from docopt import docopt
import pandas as pd
import modin.pandas as mpd
import dask.dataframe as dd
import polars as pl
import pyarrow as pa


if __name__ == "__main__":
    args = docopt(__doc__, version="Naval Fate 2.0")
    conn = os.environ[args["--conn"]]
    table = "DDOS"
    part_num = int(args["<num>"])

    with Timer() as timer:
        if part_num > 1:
            df = cx.read_sql(
                conn,
                f"""SELECT * FROM {table}""",
                partition_on="ID",
                partition_num=int(args["<num>"]),
                protocol=args["--protocol"],
                return_type=args["--ret"],
            )
        else:
            df = cx.read_sql(
                conn,
                f"""SELECT * FROM {table}""",
                protocol=args["--protocol"],
                return_type=args["--ret"],
            )
    print("time in total:", timer.elapsed)

    print(df)
    print([(c, df[c].dtype) for c in df.columns])
    print(df.info(memory_usage='deep'))

```

### Core Architecture Module: `benchmarks/ddos-dask.py`
```
"""
Usage:
  tpch-dask.py <num> [--conn=<conn>] [--table=<table>] [--index=<idx>] [--driver=<driver>]

Options:
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --table=<table>          The connection url to use [default: DDOS].
  --index=<idx>          The connection url to use [default: id].
  --driver=<driver>         The driver to use using sqlalchemy: https://docs.sqlalchemy.org/en/14/core/engines.html.
  -h --help     Show this screen.
  --version     Show version.

Drivers:
  PostgreSQL: postgresql, postgresql+psycopg2
  MySQL: mysql, mysql+mysqldb, mysql+pymysql
  Redshift: postgresql, redshift, redshift+psycopg2
"""

import os

import dask.dataframe as dd
from contexttimer import Timer
from docopt import docopt
from dask.distributed import Client, LocalCluster
from sqlalchemy.engine.url import make_url

if __name__ == "__main__":
    args = docopt(__doc__, version="Naval Fate 2.0")
    index_col = args["--index"]
    conn = os.environ[args["--conn"]]
    conn = make_url(conn)
    table = args["--table"]
    driver = args.get("--driver", None)
    npartition = int(args["<num>"])

    cluster = LocalCluster(n_workers=npartition, scheduler_port=0, memory_limit="230G")
    client = Client(cluster)

    # https://docs.sqlalchemy.org/en/13/core/engines.html#sqlite
    # 4 initial slashes is needed for Unix/Mac
    if conn.drivername == "sqlite":
        conn = f"sqlite:///{str(conn)[9:]}"
    elif driver is not None:
        conn = str(conn.set(drivername=driver))
    print(f"conn url: {conn}")

    with Timer() as timer:
        df = dd.read_sql_table(
            table,
            str(conn),
            index_col,
            npartitions=npartition,
            limits=(0, 7902474),
        ).compute()

    print(f"[Total] {timer.elapsed:.2f}s")

    print(df)
    print([(c, df[c].dtype) for c in df.columns])

```

### Core Architecture Module: `benchmarks/ddos-modin.py`
```
"""
Usage:
  tpch-modin.py <num> [--conn=<conn>] [--driver=<driver>]

Options:
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --driver=<driver>         The driver to use using sqlalchemy: https://docs.sqlalchemy.org/en/14/core/engines.html.
  -h --help     Show this screen.
  --version     Show version.

Drivers:
  PostgreSQL: postgresql, postgresql+psycopg2
  MySQL: mysql, mysql+mysqldb, mysql+pymysql
  Redshift: postgresql, redshift, redshift+psycopg2
"""

import os

import modin.config as config
import modin.pandas as pd
from contexttimer import Timer
from docopt import docopt
from dask.distributed import Client, LocalCluster
from sqlalchemy.engine.url import make_url

# modin adopts the fastest mysqlclient connector for mysql

if __name__ == "__main__":
    args = docopt(__doc__, version="1.0")
    conn = os.environ[args["--conn"]]
    conn = make_url(conn)
    table = "DDOS"
    driver = args.get("--driver", None)

    partitions = int(args["<num>"])
    config.NPartitions.put(partitions)

    cluster = LocalCluster(n_workers=partitions, scheduler_port=0, memory_limit="230G")
    client = Client(cluster)

    # https://docs.sqlalchemy.org/en/13/core/engines.html#sqlite
    # 4 initial slashes is needed for Unix/Mac
    if conn.drivername == "sqlite":
        conn = f"sqlite:///{str(conn)[9:]}"
    elif driver is not None:
        conn = str(conn.set(drivername=driver))
    print(f"conn url: {conn}")

    with Timer() as timer:
        df = pd.read_sql(
            f"SELECT * FROM {table}",
            str(conn),
        )
    print(f"[Total] {timer.elapsed:.2f}s")

    print(df)
    print([(c, df[c].dtype) for c in df.columns])

```

### Core Architecture Module: `benchmarks/ddos-pandas-chunk.py`
```
"""
Usage:
    tpch-pandas-chunk.py [--conn=<conn>] [--csize=<csize>] [--driver=<driver>]

Options:
    --conn=<conn>             The connection url to use [default: POSTGRES].
    --csize=<csize>           Chunk size [default: 1000].
    --driver=<driver>         The driver to use using sqlalchemy: https://docs.sqlalchemy.org/en/14/core/engines.html.
    -h --help                 Show this screen.
    --version                 Show version.
"""

import os
from contexttimer import Timer
from docopt import docopt
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
import time

if __name__ == "__main__":
    args = docopt(__doc__, version="1.0")
    conn = os.environ[args["--conn"]]
    chunksize = int(args["--csize"])
    driver = args.get("--driver", None)
    conn = make_url(conn)
    if driver is not None:
        conn = conn.set(drivername=driver)
    if conn.drivername == "sqlite":
        conn = conn.set(database="/" + conn.database)

    print(f"chunksize: {chunksize}, conn url: {str(conn)}")

    with Timer() as timer:
        engine = create_engine(conn)
        conn = engine.connect().execution_options(
            stream_results=True, max_row_buffer=chunksize)
        dfs = []
        with Timer() as stream_timer:
            for df in pd.read_sql("SELECT * FROM DDOS", conn, chunksize=chunksize):
                dfs.append(df)
        print(f"time iterate batches: {stream_timer.elapsed}")
        df = pd.concat(dfs)
    print(f"time in total: {timer.elapsed}s")
    time.sleep(3) # capture peak memory

    conn.close()
    print(df)
    print(df.info(memory_usage="deep"))
    #  print(df._data.blocks)

    #  print("======")
    #  print(len(dfs))
    #  for d in dfs:
    #      print(d.info(memory_usage="deep"))
    #      print(d._data.blocks)
    #      break

```

### Core Architecture Module: `benchmarks/ddos-pandas.py`
```
"""
Usage:
  tpch-pandas.py [--conn=<conn>] [--driver=<driver>]

Options:
  --conn=<conn>             The connection url to use [default: POSTGRES_URL].
  --driver=<driver>         The driver to use using sqlalchemy: https://docs.sqlalchemy.org/en/14/core/engines.html.
  -h --help                 Show this screen.
  --version                 Show version.

Drivers:
  PostgreSQL: postgresql, postgresql+psycopg2
  MySQL: mysql, mysql+mysqldb, mysql+pymysql
  Redshift: postgresql, redshift, redshift+psycopg2

"""

import os

from contexttimer import Timer
from sqlalchemy import create_engine
from docopt import docopt
import pandas as pd
import sqlite3
from clickhouse_driver import connect
from sqlalchemy.engine.url import make_url

if __name__ == "__main__":
    args = docopt(__doc__, version="1.0")
    table = "DDOS"
    driver = args.get("--driver", None)
    conn = os.environ[args["--conn"]]
    conn = make_url(conn)

    if conn.drivername == "sqlite":
        conn = sqlite3.connect(str(conn)[9:])
    elif driver == "clickhouse":
        # clickhouse-driver uses native protocol: 9000
        conn = conn.set(drivername=driver, port=9000)
        conn = connect(str(conn))
    else:  # go with sqlalchemy
        if driver is not None:
            conn = conn.set(drivername=driver)
        print(f"conn url: {str(conn)}")
        engine = create_engine(conn)
        conn = engine.connect()

    with Timer() as timer:
        df = pd.read_sql(
            f"SELECT * FROM {table}",
            conn,
        )
    print(f"[Total] {timer.elapsed:.2f}s")
    conn.close()

    print(df)
    print([(c, df[c].dtype) for c in df.columns])

```

### Core Architecture Module: `benchmarks/ddos-turbodbc.py`
```
"""
Usage:
  tpch-turbodbc.py [--driver=<driver>] [--ret=<ret>]

Options:
  --driver=<driver>         ODBC driver to use [default: PostgreSQL].
  --ret=<ret>               The return type [default: pandas-numpy].
  -h --help                 Show this screen.
  --version                 Show version.

"""

import os

from docopt import docopt
from turbodbc import connect, make_options
import pandas as pd
from contexttimer import Timer

if __name__ == "__main__":
    args = docopt(__doc__, version="Naval Fate 2.0")
    table = "DDOS"
    driver = args["--driver"]
    ret = args["--ret"]
    query = f"SELECT * FROM {table}"

    with Timer() as gtimer:
        with Timer() as timer:
            if driver == "MSSQL":
                options = make_options(prefer_unicode=True)
                connection = connect(
                    dsn=driver, uid=os.environ["MSSQL_USER"], pwd=os.environ["MSSQL_PASSWORD"], turbodbc_options=options)
            else:
                connection = connect(dsn=driver)
            cursor = connection.cursor()
        print(f"connect: {timer.elapsed}")
        with Timer() as timer:
            cursor.execute(query)
        print(f"execute: {timer.elapsed}")
        if ret == "pandas-numpy":
            with Timer() as timer:
                data = cursor.fetchallnumpy()
            print(f"fetchallnumpy: {timer.elapsed}")
            with Timer() as timer:
                df = pd.DataFrame(data=data)
            print(f"convert to pandas: {timer.elapsed}")
        elif ret == "pandas-arrow":
            with Timer() as timer:
                data = cursor.fetchallarrow()
            print(f"fetchallarrow: {timer.elapsed}")
            with Timer() as timer:
                # to be fair with other benchmarks, generate consolidate blocks and convert date
                df = data.to_pandas(split_blocks=False, date_as_object=False)
            print(f"convert to pandas: {timer.elapsed}")
        else:
            assert ret == "arrow"
            with Timer() as timer:
                df = cursor.fetchallarrow()
            print(f"fetchallarrow: {timer.elapsed}")

    print(f"time in total: {gtimer.elapsed}")
    print(df)
    print([(c, df[c].dtype) for c in df.columns])

```

### Core Architecture Module: `benchmarks/tpch-cx-aw.py`
```
"""
Usage:
  tpch-cx-aw.py [--protocol=<protocol>] [--conn=<conn>] [--ret=<ret>] <num>

Options:
  --protocol=<protocol>  The protocol to use [default: binary].
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --ret=<ret>            The return type [default: pandas].
  -h --help              Show this screen.
  --version              Show version.
"""
import os

import connectorx as cx
from contexttimer import Timer
from docopt import docopt


if __name__ == "__main__":
    args = docopt(__doc__, version="Naval Fate 2.0")
    conn = os.environ[args["--conn"]]
    table = os.environ["TPCH_TABLE"]
    part_num = int(args["<num>"])
    ret = args["--ret"]

    print(f"[CX-AW] conn: {conn}, part_num: {part_num}, return: {ret}")

    with Timer() as gtimer:
        with Timer() as timer:
            if part_num > 1:
                data = cx.read_sql(
                    conn,
                    f"""SELECT * FROM {table}""",
                    partition_on="L_ORDERKEY",
                    partition_num=int(args["<num>"]),
                    protocol=args["--protocol"],
                    return_type="arrow",
                )
            else:
                data = cx.read_sql(
                    conn,
                    f"""SELECT * FROM {table}""",
                    protocol=args["--protocol"],
                    return_type="arrow",
                )
        print("got arrow:", timer.elapsed)
        if ret == "pandas":
            with Timer() as timer:
                df = data.to_pandas(split_blocks=False, date_as_object=False)
            print("convert to pandas:", timer.elapsed)

    print(f"time in total: {gtimer.elapsed}")
    print(df)

```

### Core Architecture Module: `benchmarks/tpch-cx.py`
```
"""
Usage:
  tpch-cx.py [--protocol=<protocol>] [--conn=<conn>] [--ret=<ret>] <num>

Options:
  --protocol=<protocol>  The protocol to use [default: binary].
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --ret=<ret>            The return type [default: pandas].
  -h --help              Show this screen.
  --version              Show version.
"""
import os

import connectorx as cx
from contexttimer import Timer
from docopt import docopt
import pandas as pd
import modin.pandas as mpd
import dask.dataframe as dd
import polars as pl
import pyarrow as pa


def describe(df):
    if isinstance(df, pd.DataFrame):
        print(df.head())
    elif isinstance(df, mpd.DataFrame):
        print(df.head())
    elif isinstance(df, pl.DataFrame):
        print(df.head())
    elif isinstance(df, dd.DataFrame):
        print(df.head())
    elif isinstance(df, pa.Table):
        print(df.slice(0, 10).to_pandas())
    else:
        raise ValueError("unknown type")


if __name__ == "__main__":
    args = docopt(__doc__, version="Naval Fate 2.0")
    conn = os.environ[args["--conn"]]
    table = os.environ["TPCH_TABLE"]
    part_num = int(args["<num>"])

    with Timer() as timer:
        if part_num > 1:
            df = cx.read_sql(
                conn,
                f"""SELECT * FROM {table}""",
                partition_on="L_ORDERKEY",
                partition_num=int(args["<num>"]),
                protocol=args["--protocol"],
                return_type=args["--ret"],
            )
        else:
            df = cx.read_sql(
                conn,
                f"""SELECT * FROM {table}""",
                protocol=args["--protocol"],
                return_type=args["--ret"],
            )
    print("time in total:", timer.elapsed)
    
    print(type(df), len(df))
    describe(df)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #927** (2026-08-28): **Trino: partition queries ignore verify=false and connection URL parameters are not forwarded to client**
  *Symptoms*: #### What language are you using?  Rust and Python (via `polars.read_database_uri`)  #### What version are you using?  ConnectorX 0.4.6 (current main branch)  #### What database are you using?  Trino  #### What dataframe are you using?  Arrow / Polars  #### Can you describe your bug?  The Trino source does not propagate URL query parameters to the `prusto` ClientBuilder. Specifically:  1. **`verify=false` is ignored in partition queries** — `trino_get_partition_range()` in `partition.rs` creates its own client without passing `no_verify`, causing TLS certificate errors on self-signed clusters when using `partition_on`.  2. **Session properties, extra credentials, and other Trino protocol headers are silently dropped** — the `prusto` ClientBuilder supports `.properties()`, `.extra_credentials()`, `.source()`, `.schema()`, `.client_tags()`, `.trace_token()`, and `.client_info()`, but ConnectorX never reads these from the connection URL.  This makes it impossible to set query timeouts, pass connector credentials (e.g. S3 tokens via `extra_credential`), route queries to resource groups (via `client_tags`), or set a default schema without qualifying every table name.  #### What are the steps to reproduce the behavior?  ##### Example query / code  ```python import polars as pl  # Bug 1: verify=false ignored on partition query (TLS error on self-signed cluster) df = pl.read_database_uri(     "SELECT * FROM schema.table",     "trino+https://user:pass@trino-selfsigned:443/hive?verify=

- **Issue #913** (2026-08-28): **Rust panic in arrow_stream is not propagated to Python**
  *Symptoms*: #### What language are you using?  **Python**  #### What version are you using?  0.4.5  #### What database are you using?  MySQL  #### What dataframe are you using?  Arrow Stream  #### Can you describe your bug?  I encountered an issue when using `return_type="arrow_stream"` to read data from a MySQL table containing a DATETIME(6) column.  ConnectorX prints the following panic:  ``` thread '<unnamed>' panicked at .../arrow_assoc.rs:290:28: out of range DateTime ```  However, the panic is not propagated back to Python. Instead:  - No exception is raised. - The process continues running normally. - The panic message is only printed to stderr.  There are some odd DATETIME(6) values in the table (for example, 0001-04-17 21:12:06.000000). However, the same query succeeds when using `return_type="arrow"`. My main concern is that the error is not propagated as a Python exception when using `arrow_stream`; instead, the stream silently returns no batches while the Rust panic is only printed to stderr.  My expectation is that either:  `arrow_stream` should successfully read the column, as `arrow` does, or the Rust panic should be converted into a Python exception instead of silently returning an empty stream.  #### What are the steps to reproduce the behavior?  ##### Database setup if the error only happens on specific data or data type  | Field | Type | |--------|--------| | updated_at | datetime(6) |  ``` 0001-04-17 21:12:06.000000 2026-04-17 21:12:07.000000 ```  ##### Example query 
  **Post-Mortem & Fix Analysis**:
  > @maurigamg Confirming on SQL Server too.  Trigger: a datetime column with a far-future sentinel, 9999-12-31 ("never expires").  Cause: 0.4.5 remapped NaiveDateTime from Date64 (ms) to Timestamp(Nanosecond), routing through: ``` nd.and_utc().timestamp_nanos_opt().unwrap_or_else(|| panic!("out of range DateTime"))  // line 290 ```   i64 nanoseconds only span 1677-09-21 … 2262-04-11, so anything outside — year 0001 (original report) or year 9999 (ours) — hits this same panic.  This bug is quite dangerous as it doesn't propagate to Python and make our data pipeline ingest empty data.
  > > [@maurigamg](https://github.com/maurigamg) Confirming on SQL Server too. >  > Trigger: a datetime column with a far-future sentinel, 9999-12-31 ("never expires"). >  > Cause: 0.4.5 remapped NaiveDateTime from Date64 (ms) to Timestamp(Nanosecond), routing through: >  > ``` > nd.and_utc().timestamp_nanos_opt().unwrap_or_else(|| panic!("out of range DateTime"))  // line 290 > ``` >  > i64 nanoseconds only span 1677-09-21 … 2262-04-11, so anything outside — year 0001 (original report) or year 9999 (ours) — hits this same panic. >  > This bug is quite dangerous as it doesn't propagate to Python and make our data pipeline ingest empty data.  Thanks @thangnv2212, I noticed that remapping, but I didn't think the failure was related to it.  **Note:** I'm still unsure why `arrow_stream` behaves differently from `arrow`. As you pointed out, `arrow` reads the column as `datetime[μs]` (microseconds), while `arrow_stream` reads it as `datetime[ns]` (nanoseconds). This difference explains why `arro

- **Issue #880** (2026-09-18): **Failure to read tsvector data type**
  *Symptoms*: #### What language are you using?  Python  #### What version are you using?  0.4.4  #### What database are you using?  PostgreSQL  #### What dataframe are you using?  Pandas, Polars, Arrow  #### Can you describe your bug?  Attempting to read a table with a tsvector column fails.  #### What are the steps to reproduce the behavior?  1. Create a table with a tsvector column type 2. Attempt to read this table with cx.read_sql  ##### Database setup if the error only happens on specific data or data type  tsvector data type  ##### Example query / code  ``` cx.read_sql(query="SELECT * FROM account LIMIT 2", conn) ```  #### What is the error?  ``` PanicException                            Traceback (most recent call last) Cell In[17], line 1 ----> 1 real_accounts = dm.read_sql("SELECT searchable_english FROM account", db)       2 real_accounts.head()      393 if return_type in {"modin", "dask", "pandas"}:     394     try_import_module("pandas") --> 396     result = _read_sql(     397         conn,     398         "pandas",     399         queries=queries,     400         protocol=protocol,     401         partition_query=partition_query,     402         pre_execution_queries=pre_execution_queries,     403     )     404     df = reconstruct_pandas(result)     406     if index_col is not None:  PanicException: not implemented: tsvector ```

- **Issue #864** (2025-12-13): **Different type mapping from postgres arrow and arrow_stream**
  *Symptoms*: #### What language are you using?  **Python**  #### What version are you using?  0.4.4  #### What database are you using?  PostgreSQL  #### What dataframe are you using?  Arrow / Arrow Streaming  #### Can you describe your bug?  When I query postgres using "arrow" the postgres `integer[]` type is mapped to ids: large_list<item: int32> but when I switch to "arrow_stream" I get:  ``` `Result::unwrap()` on an `Err` value: ConnectorX(NoConversionRule("Int4Array(true)", "connectorx::destinations::arrowstream::typesystem::ArrowTypeSystem"))` ```  #### What are the steps to reproduce the behavior?  ```         reader: pyarrow.lib.RecordBatchReader = cx.read_sql(             credentials,             query=query,             return_type="arrow",             protocol="binary",         ) ```  Works  ```         reader: pyarrow.lib.RecordBatchReader = cx.read_sql(             credentials,             query=query,             return_type="arrow_stream",             protocol="binary",             batch_size=BATCH_SIZE,         ) ```  Fails  If possible, please include a **minimal simple** example including:  ##### Database setup if the error only happens on specific data or data type      CREATE TABLE test (         id integer,         values integer[]         PRIMARY KEY (id)     );  ##### Example query / code  ``` select * from test ```  #### What is the error?  ConnectorX(NoConversionRule("Int4Array(true)", "connectorx::destinations::arrowstream::typesystem::ArrowTypeSystem")) 
  **Post-Mortem & Fix Analysis**:
  > Many array types are not implemented
  > @surister yeah I didn't realise "arrow_stream" was only added in 0.4.4 - and looking closer at the error message looks like there are different "typesystem" implementations for arrow and arrowstream

- **Issue #861** (2025-12-13): **`rust_decimal` missing from `src_oracle` feature dependencies**
  *Symptoms*: #### What language are you using?  **Rust**  #### What version are you using?  0.4.4  #### What database are you using?  Oracle  #### What dataframe are you using?  Polars  #### Can you describe your bug?  Compile-time missing `rust_decimal` dependency error with `src_oracle` cargo feature option.  #### What are the steps to reproduce the behavior?  Compiling a project with just the `src_oracle` feature causes this bug. Adding the `rust_decimal` feature seems to resolve it.  #### What is the error?  ``` Compiling connectorx v0.4.4 error[E0432]: unresolved import `rust_decimal`  --> ~\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\connectorx-0.4.4\src\utils.rs:2:5   | 2 | use rust_decimal::Decimal;   |     ^^^^^^^^^^^^ use of unresolved module or unlinked crate `rust_decimal`   |   = help: if you wanted to use a crate named `rust_decimal`, use `cargo add rust_decimal` to add it to your `Cargo.toml`  For more information about this error, try `rustc --explain E0432`. error: could not compile `connectorx` (lib) due to 1 previous error ```

- **Issue #851** (2025-12-13): **Python: Add wheels for Python 3.14**
  *Symptoms*: #### What language are you using? Python  #### What version are you using? 3.14  #### What database are you using? PostgreSQL  #### What dataframe are you using? Arrow  #### Can you describe your bug? Add support for Python 3.14  #### What are the steps to reproduce the behavior? `uv init test_connectorx -p 3.14; cd test_connetorx; uv add connectorx`  ##### Database setup if the error only happens on specific data or data type None  ##### Example query / code No example  #### What is the error? Package doesn't have wheels  You're using CPython 3.14 (`cp314`), but `connectorx` (v0.4.4) only has wheels with the following Python implementation tags: `cp312`, `cp313`
  **Post-Mortem & Fix Analysis**:
  > Is this issue just a matter of building a new release against Python 3.14 or does the project need some extra work?
  > No extra work, it's just about the release. If possible for both 3.14 with GIL and No GIL
  > After numba release this Monday, this is the only issue holding me from upgrading to python3.14.

- **Issue #847** (2025-09-09): **Cargo build error**
  *Symptoms*: #### What language are you using?  **Rust**  #### What version are you using?  0.4.4  #### What database are you using?  Oracle  #### What dataframe are you using?  Arrow  #### Can you describe your bug?  I just created a new cargo project and added connectorx as dependency to my project. Did a cargo build and getting the errors.  #### What are the steps to reproduce the behavior?  cargo new main  In Cargo.toml  add connectorx = { version = "0.4", features = ["src_oracle", "dst_arrow"]}  ##### Database setup if the error only happens on specific data or data type    ##### Example query / code   #### What is the error?     Updating crates.io index      Locking 1 package to latest Rust 1.89.0 compatible version       Adding connectorx v0.4.4    Compiling connectorx v0.4.4 error[E0432]: unresolved import `rust_decimal`  --> /home/kesav/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/connectorx-0.4.4/src/utils.rs:2:5   | 2 | use rust_decimal::Decimal;   |     ^^^^^^^^^^^^ use of unresolved module or unlinked crate `rust_decimal`   |   = help: if you wanted to use a crate named `rust_decimal`, use `cargo add rust_decimal` to add it to your `Cargo.toml`  error[E0432]: unresolved import `rust_decimal`   --> /home/kesav/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/connectorx-0.4.4/src/destinations/arrow/arrow_assoc.rs:19:5    | 19 | use rust_decimal::Decimal;    |     ^^^^^^^^^^^^ use of unresolved module or unlinked crate `rust_decimal`    |    = help: if you wanted to 
  **Post-Mortem & Fix Analysis**:
  > Hi @kesavkolla , thanks for opening the issue. I just pushed [a fix](https://github.com/sfu-db/connector-x/commit/de9e1fd720dd04968fb3e4671e20c55589a6c8dd) to the `main` branch for this. Can you try to set your dependency to the github repo before the next release?  I just close this issue for now. Feel free to reopen it if you still find any issue.

- **Issue #831** (2026-09-14): **cant import library due to FIPS issue in databricks container**
  *Symptoms*: #### What language are you using?  **Python**.  #### What version are you using?  3.12.11, connectorx 0.4.3  #### What database are you using?  PostgreSQL, but irrelevant  #### What dataframe are you using?  Polars, but irrelevant  #### Can you describe your bug?  Importing connectorx in a docker image built from databricksruntime/minimal:16.4-LTS (dockerfile here: https://github.com/databricks/containers/blob/master/ubuntu/minimal/Dockerfile) gives a FIPS SSL error:  ``` import connectorx crypto/fips/fips.c:154: OpenSSL internal error: FATAL FIPS SELFTEST FAILURE ```  This causes the program to abort.  #### What are the steps to reproduce the behavior?  Just trying to build this image shows the error for me: ``` # minimal.Dockerfile FROM databricksruntime/minimal:16.4-LTS  RUN apt-get update && apt-get install -y git wget curl ADD https://astral.sh/uv/install.sh /uv-installer.sh RUN sh /uv-installer.sh  # Ensure the installed binary is on the `PATH` ENV PATH="/root/.local/bin/:$PATH"  RUN uv venv RUN uv pip install connectorx RUN uv run python -c "import connectorx" ```  ``` docker build -t myimage:latest -f minimal.Dockerfile . [+] Building 13.5s (11/11) FINISHED                                                                                                                                                     docker:default  => [internal] load build definition from minimal.Dockerfile                                                                                             
  **Post-Mortem & Fix Analysis**:
  > I am getting the same error too. Any workarounds?

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

### Incident Patch 1: `54b9b1ab` (2026-09-23)
**Commit Message**: fix(clickhouse): request LZ4 compression explicitly (#983)

Keep compressed HTTP responses compatible with clickhouse 0.13 when newer servers default to ZSTD. Cover compression settings, partition ranges, counts, and pandas/Arrow/Arrow stream reads.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `connectorx-python/connectorx/tests/test_clickhouse.py` (modified, +22/-0)
```diff
@@ -9,6 +9,28 @@
 # clickhouse_url fixture is now defined in conftest.py
 # It uses testcontainers if available, otherwise the CLICKHOUSE_URL environment variable
 
+@pytest.mark.parametrize("return_type", ["pandas", "arrow", "arrow_stream"])
+@pytest.mark.parametrize("partition_num", [None, 3])
+def test_clickhouse_lz4_compression(
+    clickhouse_url: str, return_type: str, partition_num: int | None
+) -> None:
+    result = read_sql(
+        clickhouse_url,
+        "SELECT id, upper(getSetting('network_compression_method')) AS compression "
+        "FROM test_basic_types",
+        return_type=return_type,
+        partition_on="id" if partition_num else None,
+        partition_num=partition_num,
+        batch_size=2,
+    )
+    if return_type == "arrow_stream":
+        result = result.read_all()
+    if return_type != "pandas":
+        result = result.to_pandas()
+    assert sorted(result["id"].tolist()) == [1, 2, 3, 4, 5]
+    assert result["compression"].tolist() == ["LZ4"] * 5
+
+
 def test_clickhouse_without_partition(clickhouse_url: str) -> None:
     query = "select * from test_table limit 3"
     # clickhouse does not support binary protocol
```

**File**: `connectorx/src/sources/clickhouse/mod.rs` (modified, +4/-1)
```diff
@@ -57,7 +57,10 @@ impl ClickHouseSource {
             url.port().unwrap_or(8123)
         );
 
-        let mut client = Client::default().with_url(&base_url);
+        // clickhouse 0.13 decodes LZ4 only; newer servers default to ZSTD.
+        let mut client = Client::default()
+            .with_url(&base_url)
+            .with_option("network_compression_method", "lz4");
 
         let database = url.path().trim_start_matches('/');
         if !database.is_empty() {
```

**File**: `connectorx/tests/test_clickhouse.rs` (modified, +61/-2)
```diff
@@ -3,8 +3,13 @@
 use arrow::array::*;
 use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
 use connectorx::{
-    destinations::arrow::ArrowDestination, prelude::*, sources::clickhouse::ClickHouseSource,
-    sql::CXQuery, transports::ClickHouseArrowTransport,
+    destinations::arrow::ArrowDestination,
+    partition::{partition, PartitionQuery},
+    prelude::*,
+    source_router::parse_source,
+    sources::clickhouse::ClickHouseSource,
+    sql::CXQuery,
+    transports::ClickHouseArrowTransport,
 };
 use rust_decimal::Decimal;
 use std::str::FromStr;
@@ -160,6 +165,60 @@ fn run_clickhouse_query(query: &str) -> Vec<RecordBatch> {
     destination.arrow().unwrap()
 }
 
+#[test]
+fn test_clickhouse_lz4_compression() {
+    let batches = run_clickhouse_query(
+        "SELECT upper(getSetting('network_compression_method')) AS compression",
+    );
+    assert_strings!(&batches[0], 0, StringArray, &["LZ4"]);
+}
+
+#[test]
+fn test_clickhouse_partitioned_reads_and_counts() {
+    let dburl = test_db::clickhouse_url();
+    let conn = parse_source(&dburl, None).unwrap();
+    let query = "SELECT id FROM test_basic_types";
+    let queries = partition(&PartitionQuery::new(query, "id", None, None, 3), &conn).unwrap();
+    assert_eq!(queries.len(), 3);
+
+    let rt = Arc::new(Runtime::new().unwrap());
+    let mut source = ClickHouseSource::new(rt.clone(), &dburl).unwrap();
+    source.set_queries(&queries);
+    source.set_origin_query(Some(query.to_string()));
+    source.fetch_metadata().unwrap();
+    assert_eq!(source.names(), vec!["id"]);
+    assert_eq!(source.result_rows().unwrap(), Some(5));
+
+    let mut partitions = source.partition().unwrap();
+    let counts: Vec<_> = partitions
+        .iter_mut()
+        .map(|part| {
+            part.result_rows().unwrap();
+            part.nrows()
+        })
+        .collect();
+    assert_eq!(counts, vec![1, 1, 3]);
+
+    let source = ClickHouseSource::new(rt, &dburl).unwrap();
+    let mut destination = ArrowDestination::new();
+    Dispatcher::<_, _, ClickHouseArrowTransport>::new(
+        source,
+        &mut destination,
+        &queries,
+        Some(query.to_string()),
+    )
+    .run()
+    .unwrap();
+    let mut ids: Vec<_> = destination
+        .arrow()
+        .unwrap()
+        .iter()
+        .flat_map(|batch| col!(batch, 0, UInt32Array).values().to_vec())
+        .collect();
+    ids.sort_unstable();
+    assert_eq!(ids, vec![1, 2, 3, 4, 5]);
+}
+
 #[test]
 fn test_clickhouse_basic_types() {
     let _ = env_logger::builder().is_test(true).try_init();
```

---

### Incident Patch 2: `28b6aeef` (2026-09-21)
**Commit Message**: fix: prevent division-by-zero and integer overflow in partition() (#899)

* fix: prevent division-by-zero and integer overflow in partition()

- Guard against division by zero (num <= 0) and throw descriptive error
- Return explicit error on (max - min + 1) range overflow
- Remove clamping logic to avoid duplicate partition ranges; return explicit error on lower/upper bound overflow
- Guard against upper bound overflow when max is i64::MAX
- Guard against empty or inverted range (max < min) safely
- Add and update unit tests for error cases and boundary conditions
- Target-gate pprof dev-dependency to non-windows targets

* chore: remove unrelated Cargo.toml change

* fix: reject invalid partition bounds safely

* fix: preserve small-range partition behavior

---------

Co-authored-by: Hieu <hieunguyen@gmail.com>

**File**: `connectorx/src/partition.rs` (modified, +155/-24)
```diff
@@ -1,3 +1,4 @@
+use std::convert::TryFrom;
 use std::sync::Arc;
 
 use crate::errors::{ConnectorXOutError, OutResult};
@@ -75,7 +76,18 @@ impl PartitionQuery {
 
 pub fn partition(part: &PartitionQuery, source_conn: &SourceConn) -> OutResult<Vec<CXQuery>> {
     let mut queries = vec![];
-    let num = part.num as i64;
+
+    if part.num == 0 {
+        throw!(anyhow!("partition count (num) must be greater than zero"));
+    }
+
+    let num = i64::try_from(part.num).map_err(|_| {
+        anyhow!(
+            "partition count (num) is too large to represent safely: {}",
+            part.num
+        )
+    })?;
+
     let (min, max) = match (part.min, part.max) {
         (None, None) => get_col_range(source_conn, &part.query, &part.column)?,
         (Some(min), Some(max)) => (min, max),
@@ -84,13 +96,60 @@ pub fn partition(part: &PartitionQuery, source_conn: &SourceConn) -> OutResult<V
         )),
     };
 
-    let partition_size = (max - min + 1) / num;
+    if max < min {
+        throw!(anyhow!(
+            "partition range is invalid: max ({}) must be greater than or equal to min ({})",
+            max,
+            min
+        ));
+    }
+
+    let range_len = max
+        .checked_sub(min)
+        .and_then(|value| value.checked_add(1))
+        .ok_or_else(|| {
+            anyhow!(
+                "partition range overflow: min={}, max={} is too large",
+                min,
+                max
+            )
+        })?;
+
+    let partition_size = range_len / num;
+
+    let final_upper = max.checked_add(1).ok_or_else(|| {
+        anyhow!(
+            "partition upper bound overflow: max={} cannot be incremented safely",
+            max
+        )
+    })?;
 
-    for i in 0..num {
-        let lower = min + i * partition_size;
-        let upper = match i == num - 1 {
-            true => max + 1,
-            false => min + (i + 1) * partition_size,
+    for i in 0i64..num {
+        let lower = i
+            .checked_mul(partition_size)
+            .and_then(|offset| min.checked_add(offset))
+            .ok_or_else(|| {
+                anyhow!(
+                    "partition lower bound overflow: min={}, step={}, partition_size={}",
+                    min,
+                    i,
+                    partition_size
+                )
+            })?;
+        let upper = if i == num - 1 {
+            final_upper
+        } else {
+            (i + 1)
+                .checked_mul(partition_size)
+                .and_then(|offset| min.checked_add(offset))
+                .ok_or_else(|| {
+                    anyhow!(
+                        "partition upper bound overflow: min={}, step={}, partition_size={}",
+                        min,
+                        i + 1,
+                        partition_size
+                    )
+                })?
         };
         let partition_query = get_part_query(source_conn, &part.query, &part.column, lower, upper)?;
         queries.push(partition_query);
@@ -677,33 +736,41 @@ mod tests {
     }
 
     #[test]
-    #[should_panic(expected = "attempt to divide by zero")]
-    fn zero_partitions_panics_on_division_by_zero() {
-        // Documents current (pre-fix) behavior: num == 0 causes an integer
-        // division-by-zero panic. This baseline test locks in the behavior on
-        // `main` so a follow-up fix (guarding against num == 0) can be
-        // validated for backward compatibility of the non-panicking paths.
+    fn zero_partitions_returns_error_on_division_by_zero() {
         let part = PartitionQuery::new("SELECT * FROM test", "id", Some(0), Some(9), 0);
         let source_conn = sqlite_source_conn();
-        let _ = partition(&part, &source_conn);
+        let result = partition(&part, &source_conn);
+        assert!(result.is_err());
+        let err = result.unwrap_err().to_string();
+        assert!(err.contains("partition count (num) must be greater than zero"));
     }
 
     #[test]
-    fn inverted_range_pro
```

---

### Incident Patch 3: `6182371c` (2026-09-21)
**Commit Message**: Merge pull request #954 from npennequin/fix/trino-bigint

fix(trino): decode BIGINT values as i64

**File**: `connectorx-python/connectorx/tests/test_trino.py` (modified, +19/-1)
```diff
@@ -253,7 +253,9 @@ def test_trino_types_binary(trino_url: str) -> None:
         data={
             "test_boolean": pd.Series([True, False, None], dtype="boolean"),
             "test_int": pd.Series([123, 321, None], dtype="Int64"),
-            "test_bigint": pd.Series([1000, 2000, None], dtype="Int64"),
+            "test_bigint": pd.Series(
+                [-9223372036854775808, 9223372036854775807, None], dtype="Int64"
+            ),
             "test_real": pd.Series([123.456, 123.456, None], dtype="float64"),
             "test_double": pd.Series([123.4567890123, 123.4567890123, None], dtype="float64"),
             "test_decimal": pd.Series([1234567890.12, 1234567890.12, None], dtype="float64"),
@@ -267,6 +269,22 @@ def test_trino_types_binary(trino_url: str) -> None:
     assert_frame_equal(df, expected, check_names=True)
 
 
+def test_trino_bigint_arrow(trino_url: str) -> None:
+    import pyarrow as pa
+
+    query = (
+        "select test_bigint from test.test_types "
+        "where test_bigint is not null order by test_int"
+    )
+    table = read_sql(trino_url, query, return_type="arrow")
+
+    assert table.schema.field("test_bigint").type == pa.int64()
+    assert table.to_pandas()["test_bigint"].tolist() == [
+        -9223372036854775808,
+        9223372036854775807,
+    ]
+
+
 def test_empty_result(trino_url: str) -> None:
     query = "SELECT * FROM test.test_table where test_int < -100"
     df = read_sql(trino_url, query)
```

**File**: `connectorx-python/src/pandas/transports/trino.rs` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ impl_transport!(
         { Time[NaiveTime]            => String[String]          | conversion option }
         { Timestamp[NaiveDateTime]   => DateTimeMicro[DateTimeWrapperMicro] | conversion option }
         { Boolean[bool]              => Bool[bool]              | conversion auto }
-        { Bigint[i32]                => I64[i64]                | conversion auto }
-        { Integer[i32]               => I64[i64]                | conversion none }
+        { Bigint[i64]                => I64[i64]                | conversion auto }
+        { Integer[i32]               => I64[i64]                | conversion auto }
         { Smallint[i16]              => I64[i64]                | conversion auto }
         { Tinyint[i8]                => I64[i64]                | conversion auto }
         { Double[f64]                => F64[f64]                | conversion auto }
```

**File**: `connectorx/src/transports/trino_arrow.rs` (modified, +23/-2)
```diff
@@ -39,8 +39,8 @@ impl_transport!(
         { Time[NaiveTime]            => Time64Micro[NaiveTimeWrapperMicro]       | conversion option }
         { Timestamp[NaiveDateTime]   => Date64Micro[NaiveDateTimeWrapperMicro]   | conversion option }
         { Boolean[bool]              => Boolean[bool]           | conversion auto }
-        { Bigint[i32]                => Int64[i64]              | conversion auto }
-        { Integer[i32]               => Int64[i64]              | conversion none }
+        { Bigint[i64]                => Int64[i64]              | conversion auto }
+        { Integer[i32]               => Int64[i64]              | conversion auto }
         { Smallint[i16]              => Int64[i64]              | conversion auto }
         { Tinyint[i8]                => Int64[i64]              | conversion auto }
         { Double[f64]                => Float64[f64]            | conversion auto }
@@ -74,3 +74,24 @@ impl TypeConversion<NaiveDateTime, NaiveDateTimeWrapperMicro> for TrinoArrowTran
         NaiveDateTimeWrapperMicro(val)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn bigint_conversion_preserves_full_i64_range() {
+        for value in [
+            i64::MIN,
+            -(1_i64 << 53) - 1,
+            (1_i64 << 53) + 1,
+            2_518_422_941_645_303_032,
+            i64::MAX,
+        ] {
+            assert_eq!(
+                <TrinoArrowTransport as TypeConversion<i64, i64>>::convert(value),
+                value
+            );
+        }
+    }
+}
```

**File**: `connectorx/src/transports/trino_arrowstream.rs` (modified, +23/-2)
```diff
@@ -39,8 +39,8 @@ impl_transport!(
         { Time[NaiveTime]            => Time64Micro[NaiveTimeWrapperMicro]       | conversion option }
         { Timestamp[NaiveDateTime]   => Date64Micro[NaiveDateTimeWrapperMicro]   | conversion option }
         { Boolean[bool]              => Boolean[bool]           | conversion auto }
-        { Bigint[i32]                => Int64[i64]              | conversion auto }
-        { Integer[i32]               => Int64[i64]              | conversion none }
+        { Bigint[i64]                => Int64[i64]              | conversion auto }
+        { Integer[i32]               => Int64[i64]              | conversion auto }
         { Smallint[i16]              => Int64[i64]              | conversion auto }
         { Tinyint[i8]                => Int64[i64]              | conversion auto }
         { Double[f64]                => Float64[f64]            | conversion auto }
@@ -74,3 +74,24 @@ impl TypeConversion<NaiveDateTime, NaiveDateTimeWrapperMicro> for TrinoArrowTran
         NaiveDateTimeWrapperMicro(val)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn bigint_conversion_preserves_full_i64_range() {
+        for value in [
+            i64::MIN,
+            -(1_i64 << 53) - 1,
+            (1_i64 << 53) + 1,
+            2_518_422_941_645_303_032,
+            i64::MAX,
+        ] {
+            assert_eq!(
+                <TrinoArrowTransport as TypeConversion<i64, i64>>::convert(value),
+                value
+            );
+        }
+    }
+}
```

**File**: `scripts/trino.sql` (modified, +2/-2)
```diff
@@ -44,8 +44,8 @@ CREATE TABLE IF NOT EXISTS test.test_types(
 
 DELETE FROM test.test_types;
 INSERT INTO test.test_types (test_boolean, test_int, test_bigint, test_real, test_double, test_decimal, test_date, test_time, test_timestamp, test_varchar, test_uuid) VALUES
-(TRUE, 123, 1000, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('f4967dbb-33e9-4242-a13a-45b56ce60dba' AS UUID)),
-(FALSE, 321, 2000, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('1c8b79d0-4508-4974-b728-7651bce4a5a5' AS UUID)),
+(TRUE, 123, -9223372036854775808, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('f4967dbb-33e9-4242-a13a-45b56ce60dba' AS UUID)),
+(FALSE, 321, 9223372036854775807, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('1c8b79d0-4508-4974-b728-7651bce4a5a5' AS UUID)),
 (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
 
 DROP TABLE IF EXISTS test.test_complex_types;
```

---

### Incident Patch 4: `6937873d` (2026-09-21)
**Commit Message**: Merge pull request #953 from npennequin/fix/trino-url-credentials

fix(trino): decode URL credentials before authentication

**File**: `connectorx/src/sources/trino/mod.rs` (modified, +115/-35)
```diff
@@ -75,28 +75,60 @@ pub struct TrinoSource {
     schema: Vec<TrinoTypeSystem>,
 }
 
+/// Extract the credentials from a Trino connection URL.
+///
+/// `Url::username` and `Url::password` hand back the components still
+/// percent-encoded, so they have to be decoded before they go into an
+/// `Authorization` header: a password of `p@ss` reaches the server as
+/// `p%40ss` otherwise, and Trino answers `401 Invalid credentials`.
+#[throws(TrinoSourceError)]
+fn credentials_from_url(url: &url::Url) -> (String, Option<String>) {
+    let username = match url.username() {
+        "" => "connectorx".to_owned(),
+        username => decode(username)?.into_owned(),
+    };
+
+    let password = match url.password() {
+        None => None,
+        Some(password) => Some(decode(password)?.into_owned()),
+    };
+
+    (username, password)
+}
+
+#[throws(TrinoSourceError)]
+fn catalog_from_url(url: &url::Url) -> String {
+    match url.path_segments().and_then(|mut s| s.next_back()) {
+        Some(segment) => decode(segment)?.into_owned(),
+        None => "hive".to_owned(),
+    }
+}
+
+fn host_from_url(url: &url::Url) -> &str {
+    url.host_str().unwrap_or("localhost")
+}
+
 /// Build a prusto Client from a Trino connection URL, parsing all supported query parameters.
 ///
 /// Supported URL params:
 ///   source, schema, client_tags (comma-separated), client_info, trace_token,
 ///   session.<key>=<value>, extra_credential.<key>=<value>, verify=false
 #[throws(TrinoSourceError)]
 pub fn build_client_from_url(url: &url::Url) -> Client {
-    let username = match url.username() {
-        "" => "connectorx",
-        username => username,
-    };
+    let (username, password) = credentials_from_url(url)?;
 
     let no_verify = url
         .query_pairs()
         .any(|(k, v)| k == "verify" && v == "false");
 
-    let mut builder = ClientBuilder::new(username, url.host().unwrap().to_owned())
+    let catalog = catalog_from_url(url)?;
+
+    let mut builder = ClientBuilder::new(&username, host_from_url(url).to_owned())
         .port(url.port().unwrap_or(8080))
         .ssl(prusto::ssl::Ssl { root_cert: None })
         .no_verify(no_verify)
         .secure(url.scheme() == "trino+https")
-        .catalog(url.path_segments().unwrap().next_back().unwrap_or("hive"));
+        .catalog(&catalog);
 
     let mut session_props: HashMap<String, String> = HashMap::new();
     let mut extra_creds: HashMap<String, String> = HashMap::new();
@@ -139,9 +171,9 @@ pub fn build_client_from_url(url: &url::Url) -> Client {
         builder = builder.extra_credentials(extra_creds);
     }
 
-    let builder = match url.password() {
+    let builder = match password {
         None => builder,
-        Some(password) => builder.auth(Auth::Basic(username.to_owned(), Some(password.to_owned()))),
+        Some(password) => builder.auth(Auth::Basic(username, Some(password))),
     };
 
     builder.build().map_err(TrinoSourceError::PrustoError)?
@@ -150,36 +182,15 @@ pub fn build_client_from_url(url: &url::Url) -> Client {
 impl TrinoSource {
     #[throws(TrinoSourceError)]
     pub fn new(rt: Arc<Runtime>, conn: &str) -> Self {
-        let decoded_conn = decode(conn)?.into_owned();
-
-        let url = decoded_conn
+        // The connection string must be parsed as-is: percent-decoding it first
+        // would feed reserved characters from the password back into the URL
+        // grammar, so `p@ss` would either re-encode to `p%40ss` or, for `/`,
+        // `#` and `?`, silently truncate the authority.
+        let url = conn
             .parse::<url::Url>()
             .map_err(TrinoSourceError::UrlParseError)?;
 
-        let username = match url.username() {
-            "" => "connectorx",
-            username => username,
-        };
-
-        let no_verify = url
-            .query_pairs()
-            .any(|(k, v)| k == "verify" && v == "false");
-
-        let builder = ClientBuilder::new(username, url.host().unwrap().to_owned()
```

---

### Incident Patch 5: `381148db` (2026-09-21)
**Commit Message**: fix(trino): decode catalog and default missing host

Decode the final URL path segment before using it as the Trino catalog,
preserving behavior for percent-encoded catalog names.

Use host_str with a localhost fallback to match the other hand-parsed
sources and avoid panicking for host-less URLs. Add focused regression
tests for both cases.

**File**: `connectorx/src/sources/trino/mod.rs` (modified, +39/-2)
```diff
@@ -96,6 +96,18 @@ fn credentials_from_url(url: &url::Url) -> (String, Option<String>) {
     (username, password)
 }
 
+#[throws(TrinoSourceError)]
+fn catalog_from_url(url: &url::Url) -> String {
+    match url.path_segments().and_then(|mut s| s.next_back()) {
+        Some(segment) => decode(segment)?.into_owned(),
+        None => "hive".to_owned(),
+    }
+}
+
+fn host_from_url(url: &url::Url) -> &str {
+    url.host_str().unwrap_or("localhost")
+}
+
 /// Build a prusto Client from a Trino connection URL, parsing all supported query parameters.
 ///
 /// Supported URL params:
@@ -109,12 +121,14 @@ pub fn build_client_from_url(url: &url::Url) -> Client {
         .query_pairs()
         .any(|(k, v)| k == "verify" && v == "false");
 
-    let mut builder = ClientBuilder::new(&username, url.host().unwrap().to_owned())
+    let catalog = catalog_from_url(url)?;
+
+    let mut builder = ClientBuilder::new(&username, host_from_url(url).to_owned())
         .port(url.port().unwrap_or(8080))
         .ssl(prusto::ssl::Ssl { root_cert: None })
         .no_verify(no_verify)
         .secure(url.scheme() == "trino+https")
-        .catalog(url.path_segments().unwrap().next_back().unwrap_or("hive"));
+        .catalog(&catalog);
 
     let mut session_props: HashMap<String, String> = HashMap::new();
     let mut extra_creds: HashMap<String, String> = HashMap::new();
@@ -770,6 +784,29 @@ mod tests {
         assert!(TrinoSource::new(rt, "trino://test@localhost:8080/memory").is_ok());
     }
 
+    #[test]
+    fn catalog_is_percent_decoded() {
+        let url = "trino://test@localhost:8080/my%5Fcatalog"
+            .parse::<url::Url>()
+            .unwrap();
+
+        assert_eq!(catalog_from_url(&url).unwrap(), "my_catalog");
+    }
+
+    #[test]
+    fn catalog_defaults_to_hive_without_path_segments() {
+        let url = "trino:memory".parse::<url::Url>().unwrap();
+
+        assert_eq!(catalog_from_url(&url).unwrap(), "hive");
+    }
+
+    #[test]
+    fn hostless_url_defaults_to_localhost() {
+        let url = "trino:///memory".parse::<url::Url>().unwrap();
+
+        assert_eq!(host_from_url(&url), "localhost");
+    }
+
     #[test]
     fn test_new_ignores_empty_keys() {
         let rt = Arc::new(Runtime::new().unwrap());
```

---

### Incident Patch 6: `94ac491b` (2026-09-18)
**Commit Message**: fix(trino): decode URL credentials before authentication

Parsing a fully decoded connection URL causes reserved characters in
credentials to be re-encoded and sent literally in the Basic
Authorization header, resulting in 401 responses.

Parse the URL as-is and decode only its userinfo components. Reuse the
shared client builder so the read_sql path also honors supported Trino
connection parameters.

Add regression tests for encoded credentials and default user handling.

**File**: `connectorx/src/sources/trino/mod.rs` (modified, +77/-34)
```diff
@@ -75,23 +75,41 @@ pub struct TrinoSource {
     schema: Vec<TrinoTypeSystem>,
 }
 
+/// Extract the credentials from a Trino connection URL.
+///
+/// `Url::username` and `Url::password` hand back the components still
+/// percent-encoded, so they have to be decoded before they go into an
+/// `Authorization` header: a password of `p@ss` reaches the server as
+/// `p%40ss` otherwise, and Trino answers `401 Invalid credentials`.
+#[throws(TrinoSourceError)]
+fn credentials_from_url(url: &url::Url) -> (String, Option<String>) {
+    let username = match url.username() {
+        "" => "connectorx".to_owned(),
+        username => decode(username)?.into_owned(),
+    };
+
+    let password = match url.password() {
+        None => None,
+        Some(password) => Some(decode(password)?.into_owned()),
+    };
+
+    (username, password)
+}
+
 /// Build a prusto Client from a Trino connection URL, parsing all supported query parameters.
 ///
 /// Supported URL params:
 ///   source, schema, client_tags (comma-separated), client_info, trace_token,
 ///   session.<key>=<value>, extra_credential.<key>=<value>, verify=false
 #[throws(TrinoSourceError)]
 pub fn build_client_from_url(url: &url::Url) -> Client {
-    let username = match url.username() {
-        "" => "connectorx",
-        username => username,
-    };
+    let (username, password) = credentials_from_url(url)?;
 
     let no_verify = url
         .query_pairs()
         .any(|(k, v)| k == "verify" && v == "false");
 
-    let mut builder = ClientBuilder::new(username, url.host().unwrap().to_owned())
+    let mut builder = ClientBuilder::new(&username, url.host().unwrap().to_owned())
         .port(url.port().unwrap_or(8080))
         .ssl(prusto::ssl::Ssl { root_cert: None })
         .no_verify(no_verify)
@@ -139,9 +157,9 @@ pub fn build_client_from_url(url: &url::Url) -> Client {
         builder = builder.extra_credentials(extra_creds);
     }
 
-    let builder = match url.password() {
+    let builder = match password {
         None => builder,
-        Some(password) => builder.auth(Auth::Basic(username.to_owned(), Some(password.to_owned()))),
+        Some(password) => builder.auth(Auth::Basic(username, Some(password))),
     };
 
     builder.build().map_err(TrinoSourceError::PrustoError)?
@@ -150,36 +168,15 @@ pub fn build_client_from_url(url: &url::Url) -> Client {
 impl TrinoSource {
     #[throws(TrinoSourceError)]
     pub fn new(rt: Arc<Runtime>, conn: &str) -> Self {
-        let decoded_conn = decode(conn)?.into_owned();
-
-        let url = decoded_conn
+        // The connection string must be parsed as-is: percent-decoding it first
+        // would feed reserved characters from the password back into the URL
+        // grammar, so `p@ss` would either re-encode to `p%40ss` or, for `/`,
+        // `#` and `?`, silently truncate the authority.
+        let url = conn
             .parse::<url::Url>()
             .map_err(TrinoSourceError::UrlParseError)?;
 
-        let username = match url.username() {
-            "" => "connectorx",
-            username => username,
-        };
-
-        let no_verify = url
-            .query_pairs()
-            .any(|(k, v)| k == "verify" && v == "false");
-
-        let builder = ClientBuilder::new(username, url.host().unwrap().to_owned())
-            .port(url.port().unwrap_or(8080))
-            .ssl(prusto::ssl::Ssl { root_cert: None })
-            .no_verify(no_verify)
-            .secure(url.scheme() == "trino+https")
-            .catalog(url.path_segments().unwrap().next_back().unwrap_or("hive"));
-
-        let builder = match url.password() {
-            None => builder,
-            Some(password) => {
-                builder.auth(Auth::Basic(username.to_owned(), Some(password.to_owned())))
-            }
-        };
-
-        let client = builder.build().map_err(TrinoSourceError::PrustoError)?;
+        let client = build_client_from_url(&url)?;
 
         Self {
             client: Arc:
```

---

### Incident Patch 7: `fad33afa` (2026-09-21)
**Commit Message**: fix(trino): cover bigint bounds in Python transports

**File**: `connectorx-python/connectorx/tests/test_trino.py` (modified, +19/-1)
```diff
@@ -253,7 +253,9 @@ def test_trino_types_binary(trino_url: str) -> None:
         data={
             "test_boolean": pd.Series([True, False, None], dtype="boolean"),
             "test_int": pd.Series([123, 321, None], dtype="Int64"),
-            "test_bigint": pd.Series([1000, 2000, None], dtype="Int64"),
+            "test_bigint": pd.Series(
+                [-9223372036854775808, 9223372036854775807, None], dtype="Int64"
+            ),
             "test_real": pd.Series([123.456, 123.456, None], dtype="float64"),
             "test_double": pd.Series([123.4567890123, 123.4567890123, None], dtype="float64"),
             "test_decimal": pd.Series([1234567890.12, 1234567890.12, None], dtype="float64"),
@@ -267,6 +269,22 @@ def test_trino_types_binary(trino_url: str) -> None:
     assert_frame_equal(df, expected, check_names=True)
 
 
+def test_trino_bigint_arrow(trino_url: str) -> None:
+    import pyarrow as pa
+
+    query = (
+        "select test_bigint from test.test_types "
+        "where test_bigint is not null order by test_int"
+    )
+    table = read_sql(trino_url, query, return_type="arrow")
+
+    assert table.schema.field("test_bigint").type == pa.int64()
+    assert table.to_pandas()["test_bigint"].tolist() == [
+        -9223372036854775808,
+        9223372036854775807,
+    ]
+
+
 def test_empty_result(trino_url: str) -> None:
     query = "SELECT * FROM test.test_table where test_int < -100"
     df = read_sql(trino_url, query)
```

**File**: `connectorx-python/src/pandas/transports/trino.rs` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ impl_transport!(
         { Time[NaiveTime]            => String[String]          | conversion option }
         { Timestamp[NaiveDateTime]   => DateTimeMicro[DateTimeWrapperMicro] | conversion option }
         { Boolean[bool]              => Bool[bool]              | conversion auto }
-        { Bigint[i32]                => I64[i64]                | conversion auto }
-        { Integer[i32]               => I64[i64]                | conversion none }
+        { Bigint[i64]                => I64[i64]                | conversion auto }
+        { Integer[i32]               => I64[i64]                | conversion auto }
         { Smallint[i16]              => I64[i64]                | conversion auto }
         { Tinyint[i8]                => I64[i64]                | conversion auto }
         { Double[f64]                => F64[f64]                | conversion auto }
```

**File**: `connectorx/src/sources/trino/mod.rs` (modified, +0/-45)
```diff
@@ -755,51 +755,6 @@ impl<'r, 'a> Produce<'r, Option<NaiveDate>> for TrinoSourcePartitionParser<'a> {
 mod tests {
     use super::*;
 
-    #[test]
-    fn mocked_bigint_response_preserves_full_i64_range() {
-        let response = r#"{
-            "columns": [{
-                "name": "user_id_fast",
-                "type": "bigint",
-                "typeSignature": {"rawType": "bigint", "arguments": []}
-            }],
-            "data": [
-                [-9223372036854775808],
-                [-9007199254740993],
-                [9007199254740993],
-                [2518422941645303032],
-                [9223372036854775807]
-            ]
-        }"#;
-        let dataset: DataSet<Row> = serde_json::from_str(response).unwrap();
-        let (schema, rows) = dataset.split();
-
-        assert_eq!(
-            schema,
-            vec![(
-                "user_id_fast".to_owned(),
-                prusto::PrestoTy::PrestoInt(prusto::PrestoInt::I64)
-            )]
-        );
-        for (row, expected) in rows.iter().zip([
-            i64::MIN,
-            -(1_i64 << 53) - 1,
-            (1_i64 << 53) + 1,
-            2_518_422_941_645_303_032,
-            i64::MAX,
-        ]) {
-            assert_eq!(row.value()[0].as_i64(), Some(expected));
-        }
-    }
-
-    #[test]
-    fn observed_bigint_reproduces_the_old_i32_narrowing_failure() {
-        let value: Value = serde_json::from_str("2518422941645303032").unwrap();
-        let decoded = value.as_i64().unwrap();
-
-        assert!(i32::try_from(decoded).is_err());
-    }
-
     #[test]
     fn test_new_with_all_params() {
         let rt = Arc::new(Runtime::new().unwrap());
```

**File**: `scripts/trino.sql` (modified, +2/-2)
```diff
@@ -44,8 +44,8 @@ CREATE TABLE IF NOT EXISTS test.test_types(
 
 DELETE FROM test.test_types;
 INSERT INTO test.test_types (test_boolean, test_int, test_bigint, test_real, test_double, test_decimal, test_date, test_time, test_timestamp, test_varchar, test_uuid) VALUES
-(TRUE, 123, 1000, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('f4967dbb-33e9-4242-a13a-45b56ce60dba' AS UUID)),
-(FALSE, 321, 2000, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('1c8b79d0-4508-4974-b728-7651bce4a5a5' AS UUID)),
+(TRUE, 123, -9223372036854775808, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('f4967dbb-33e9-4242-a13a-45b56ce60dba' AS UUID)),
+(FALSE, 321, 9223372036854775807, CAST(123.456 AS REAL), CAST(123.4567890123 AS DOUBLE), 1234567890.12, date('9999-12-31'), time '12:00:00', cast(timestamp '9999-12-31 12:00:00.123456' AS timestamp(6)), 'Sample text', CAST('1c8b79d0-4508-4974-b728-7651bce4a5a5' AS UUID)),
 (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
 
 DROP TABLE IF EXISTS test.test_complex_types;
```

---

### Incident Patch 8: `dc0d3578` (2026-09-18)
**Commit Message**: fix(trino): decode BIGINT values as i64

Trino BIGINT values were requested from the source parser as i32,
causing values outside the i32 range to fail even though JSON decoding
preserved them correctly as signed 64-bit integers.

Use i64 for BIGINT in both Arrow transports and make INTEGER's
i32-to-i64 conversion explicit. Add regression coverage for the
observed value, values beyond 2^53, and the signed i64 boundaries.

**File**: `connectorx/src/sources/trino/mod.rs` (modified, +45/-0)
```diff
@@ -755,6 +755,51 @@ impl<'r, 'a> Produce<'r, Option<NaiveDate>> for TrinoSourcePartitionParser<'a> {
 mod tests {
     use super::*;
 
+    #[test]
+    fn mocked_bigint_response_preserves_full_i64_range() {
+        let response = r#"{
+            "columns": [{
+                "name": "user_id_fast",
+                "type": "bigint",
+                "typeSignature": {"rawType": "bigint", "arguments": []}
+            }],
+            "data": [
+                [-9223372036854775808],
+                [-9007199254740993],
+                [9007199254740993],
+                [2518422941645303032],
+                [9223372036854775807]
+            ]
+        }"#;
+        let dataset: DataSet<Row> = serde_json::from_str(response).unwrap();
+        let (schema, rows) = dataset.split();
+
+        assert_eq!(
+            schema,
+            vec![(
+                "user_id_fast".to_owned(),
+                prusto::PrestoTy::PrestoInt(prusto::PrestoInt::I64)
+            )]
+        );
+        for (row, expected) in rows.iter().zip([
+            i64::MIN,
+            -(1_i64 << 53) - 1,
+            (1_i64 << 53) + 1,
+            2_518_422_941_645_303_032,
+            i64::MAX,
+        ]) {
+            assert_eq!(row.value()[0].as_i64(), Some(expected));
+        }
+    }
+
+    #[test]
+    fn observed_bigint_reproduces_the_old_i32_narrowing_failure() {
+        let value: Value = serde_json::from_str("2518422941645303032").unwrap();
+        let decoded = value.as_i64().unwrap();
+
+        assert!(i32::try_from(decoded).is_err());
+    }
+
     #[test]
     fn test_new_with_all_params() {
         let rt = Arc::new(Runtime::new().unwrap());
```

**File**: `connectorx/src/transports/trino_arrow.rs` (modified, +23/-2)
```diff
@@ -39,8 +39,8 @@ impl_transport!(
         { Time[NaiveTime]            => Time64Micro[NaiveTimeWrapperMicro]       | conversion option }
         { Timestamp[NaiveDateTime]   => Date64Micro[NaiveDateTimeWrapperMicro]   | conversion option }
         { Boolean[bool]              => Boolean[bool]           | conversion auto }
-        { Bigint[i32]                => Int64[i64]              | conversion auto }
-        { Integer[i32]               => Int64[i64]              | conversion none }
+        { Bigint[i64]                => Int64[i64]              | conversion auto }
+        { Integer[i32]               => Int64[i64]              | conversion auto }
         { Smallint[i16]              => Int64[i64]              | conversion auto }
         { Tinyint[i8]                => Int64[i64]              | conversion auto }
         { Double[f64]                => Float64[f64]            | conversion auto }
@@ -74,3 +74,24 @@ impl TypeConversion<NaiveDateTime, NaiveDateTimeWrapperMicro> for TrinoArrowTran
         NaiveDateTimeWrapperMicro(val)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn bigint_conversion_preserves_full_i64_range() {
+        for value in [
+            i64::MIN,
+            -(1_i64 << 53) - 1,
+            (1_i64 << 53) + 1,
+            2_518_422_941_645_303_032,
+            i64::MAX,
+        ] {
+            assert_eq!(
+                <TrinoArrowTransport as TypeConversion<i64, i64>>::convert(value),
+                value
+            );
+        }
+    }
+}
```

**File**: `connectorx/src/transports/trino_arrowstream.rs` (modified, +23/-2)
```diff
@@ -39,8 +39,8 @@ impl_transport!(
         { Time[NaiveTime]            => Time64Micro[NaiveTimeWrapperMicro]       | conversion option }
         { Timestamp[NaiveDateTime]   => Date64Micro[NaiveDateTimeWrapperMicro]   | conversion option }
         { Boolean[bool]              => Boolean[bool]           | conversion auto }
-        { Bigint[i32]                => Int64[i64]              | conversion auto }
-        { Integer[i32]               => Int64[i64]              | conversion none }
+        { Bigint[i64]                => Int64[i64]              | conversion auto }
+        { Integer[i32]               => Int64[i64]              | conversion auto }
         { Smallint[i16]              => Int64[i64]              | conversion auto }
         { Tinyint[i8]                => Int64[i64]              | conversion auto }
         { Double[f64]                => Float64[f64]            | conversion auto }
@@ -74,3 +74,24 @@ impl TypeConversion<NaiveDateTime, NaiveDateTimeWrapperMicro> for TrinoArrowTran
         NaiveDateTimeWrapperMicro(val)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn bigint_conversion_preserves_full_i64_range() {
+        for value in [
+            i64::MIN,
+            -(1_i64 << 53) - 1,
+            (1_i64 << 53) + 1,
+            2_518_422_941_645_303_032,
+            i64::MAX,
+        ] {
+            assert_eq!(
+                <TrinoArrowTransport as TypeConversion<i64, i64>>::convert(value),
+                value
+            );
+        }
+    }
+}
```

---

### Incident Patch 9: `53d7ca29` (2026-09-19)
**Commit Message**: Apply Clippy auto-fixes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `connectorx/src/fed_dispatcher.rs` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ pub fn run(
 
                     let provider = MemTable::try_new(rbs[0].schema(), vec![rbs])?;
                     s.send((p.db_alias, Some(Arc::new(provider))))
-                        .expect(&format!("send error {}", i));
+                        .unwrap_or_else(|_| panic!("send error {}", i));
                     debug!("query {} finished", i);
                 }
             }
```

**File**: `connectorx/src/sources/bigquery/mod.rs` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ where
     fn fetch_metadata(&mut self) {
         assert!(!self.queries.is_empty());
         let job = self.client.job();
-        for (_, query) in self.queries.iter().enumerate() {
+        for query in self.queries.iter() {
             let l1query = limit0_query(query, &BigQueryDialect {})?;
             let rs = self.rt.block_on(job.query(
                 self.project_id.as_str(),
```

**File**: `connectorx/src/sources/clickhouse/typesystem.rs` (modified, +2/-2)
```diff
@@ -307,10 +307,10 @@ impl ClickHouseTypeSystem {
     fn parse_decimal_precision_scale(params: Option<&str>) -> (u8, u8) {
         let params = params.and_then(|p| p.split(',').map(|i| i.trim()).collect::<Vec<_>>().into());
         params
-            .and_then(|p| {
+            .map(|p| {
                 let precision = p.first().and_then(|s| s.parse::<u8>().ok());
                 let scale = p.get(1).and_then(|s| s.parse::<u8>().ok());
-                Some((precision.unwrap_or(0), scale.unwrap_or(0)))
+                (precision.unwrap_or(0), scale.unwrap_or(0))
             })
             .unwrap_or((0, 0))
     }
```

**File**: `connectorx/src/sources/csv/mod.rs` (modified, +5/-10)
```diff
@@ -111,16 +111,11 @@ impl CSVSource {
                         }
                     }
                 }
-                2 => {
-                    if possibilities.contains(&CSVTypeSystem::I64(false))
-                        && possibilities.contains(&CSVTypeSystem::F64(false))
-                    {
-                        // Integer && Float -> Float
-                        schema.push(CSVTypeSystem::F64(has_nulls));
-                    } else {
-                        // Conflicting CSVTypeSystems -> String
-                        schema.push(CSVTypeSystem::String(has_nulls));
-                    }
+                2 if possibilities.contains(&CSVTypeSystem::I64(false))
+                    && possibilities.contains(&CSVTypeSystem::F64(false)) =>
+                {
+                    // Integer && Float -> Float
+                    schema.push(CSVTypeSystem::F64(has_nulls));
                 }
                 _ => {
                     // Conflicting CSVTypeSystems -> String
```

**File**: `connectorx/src/sources/dummy/mod.rs` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ impl<'r, 'a> Produce<'r, bool> for DummySourcePartitionParser<'a> {
     type Error = ConnectorXError;
 
     fn produce(&mut self) -> Result<bool> {
-        let ret = self.next_val() % 2 == 0;
+        let ret = self.next_val().is_multiple_of(2);
         Ok(ret)
     }
 }
```

---

### Incident Patch 10: `f0c25d10` (2026-09-18)
**Commit Message**: Merge pull request #952 from saurabh500/dev/saurabh/fix-get-first-warning

Fix clippy::get_first warning in partition.rs

**File**: `connectorx/src/destinations/arrowstream/mod.rs` (modified, +2/-5)
```diff
@@ -136,11 +136,8 @@ impl ArrowDestination {
             std::mem::drop(self.sender);
         }
         let mut data = vec![];
-        loop {
-            match self.receiver.recv() {
-                Ok(rb) => data.push(rb),
-                Err(_) => break,
-            }
+        while let Ok(rb) = self.receiver.recv() {
+            data.push(rb);
         }
         data
     }
```

**File**: `connectorx/src/partition.rs` (modified, +1/-1)
```diff
@@ -575,7 +575,7 @@ fn clickhouse_get_partition_range(conn: &Url, query: &str, col: &str) -> (i64, i
         .map_err(|e| anyhow!("Failed to parse min max response: {}", e))?;
 
     let (min_v, max_v) = if let Some(row) = parsed.data.first() {
-        let min_v = row.get(0).and_then(|v| v.as_i64()).unwrap_or(0);
+        let min_v = row.first().and_then(|v| v.as_i64()).unwrap_or(0);
         let max_v = row.get(1).and_then(|v| v.as_i64()).unwrap_or(0);
 
         (min_v, max_v)
```

#### Recent Merged Pull Requests:
- **PR #987** (2026-09-26): ci: replace archived actions-rs actions (#980) (@tschm)
- **PR #983** (2026-09-23): fix(clickhouse): request LZ4 compression for ClickHouse 26.9 compatibility (@saurabh500)
- **PR #971** (2026-09-28): build(rust): bump rust_decimal_macros from 1.37.1 to 1.40.0 (@dependabot[bot])
- **PR #970** (2026-09-21): build(deps): bump codecov/codecov-action from 5 to 7 (@dependabot[bot])
- **PR #969** (closed): build(rust): bump url from 2.5.7 to 2.5.8 (@dependabot[bot])
- **PR #968** (2026-09-20): test: cover Rust source type systems (@saurabh500)
- **PR #967** (2026-09-20): test: expand Rust unit coverage (@saurabh500)
- **PR #966** (2026-09-19): test(mssql): enable Rust MSSQL integration tests in CI (@saurabh500)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
