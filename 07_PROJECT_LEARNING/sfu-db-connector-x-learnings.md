> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sfu-db-connector-x-learnings.md`  
> **Source**: github ([https://github.com/sfu-db/connector-x](https://github.com/sfu-db/connector-x))  
> **Source Version**: `c8ae2517`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:49:26.907Z  
> **Learning ID**: `learn-github-sfu-db-connector-x`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sfu-db/connector-x

> **Canonical Artifact**: `07_PROJECT_LEARNING/sfu-db-connector-x-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sfu-db/connector-x](https://github.com/sfu-db/connector-x))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:49:26.900Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sfu-db/connector-x`
- **Description**: Fastest library to load data from DB to DataFrames in Rust and Python
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2659 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `connectorx/src/utils.rs`
```
use std::ops::{Deref, DerefMut};
use url::{form_urlencoded, Url};

/// Remove the given parameters from a URL query, leaving every other parameter
/// byte-for-byte as the caller wrote it.
///
/// `Url::query_pairs_mut` cannot be used for this: it serializes the query as
/// `application/x-www-form-urlencoded`, which encodes a space as `+`. Drivers that
/// percent-decode the query (rust-postgres, for one) then read that `+` literally,
/// so `?options=-c statement_timeout=1s` reaches the server as `-c+statement_timeout=1s`.
pub(crate) fn remove_query_params(url: &Url, params: &[&str]) -> Url {
    let mut stripped = url.clone();
    match url.query() {
        None => stripped,
        Some(query) => {
            let kept: Vec<&str> = query
                .split('&')
                .filter(|segment| !segment.is_empty())
                .filter(|segment| {
                    let raw_key = segment.split('=').next().unwrap_or_default();
                    // compare decoded keys, as `query_pairs` would
                    let key = form_urlencoded::parse(raw_key.as_bytes())
                        .next()
                        .map(|(key, _)| key)
                        .unwrap_or_default();
                    !params.contains(&&*key)
                })
                .collect();

            let query = kept.join("&");
            stripped.set_query(match query.is_empty() {
                true => None,
                false => Some(&query),
            });
            stripped
        }
    }
}

pub struct DummyBox<T>(pub T);

impl<T> Deref for DummyBox<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> DerefMut for DummyBox<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[cfg(feature = "dst_arrow")]
pub fn decimal_to_i128(mut v: rust_decimal::Decimal, scale: u32) -> anyhow::Result<i128> {
    v.rescale(scale);

    let v_scale = v.scale();
    if v_scale != scale {
        return Err(anyhow::anyhow!(
            "decimal scale is not equal to expected scale, got: {} expected: {}",
            v_scale,
            scale
        ));
    }

    Ok(v.mantissa())
}

#[cfg(test)]
mod tests {
    use super::remove_query_params;
    use url::Url;

    fn strip(uri: &str, params: &[&str]) -> String {
        remove_query_params(&Url::parse(uri).unwrap(), params).to_string()
    }

    #[test]
    fn preserves_spaces_in_values() {
        assert_eq!(
            strip(
                "postgresql://u:p@host/db?options=-c%20statement_timeout%3D1s&cxprotocol=binary",
                &["cxprotocol"]
            ),
            "postgresql://u:p@host/db?options=-c%20statement_timeout%3D1s"
        );
    }

    #[test]
    fn does_not_reencode_remaining_params() {
        assert_eq!(
            strip("mysql://host/db?a=x+y&b=%2Fz&flag", &["nothing"]),
            "mysql://host/db?a=x+y&b=%2Fz&flag"
        );
    }

    #[test]
    fn removes_every_requested_param() {
        assert_eq!(
            strip(
                "postgresql://host/db?sslcert=a&keep=1&sslkey=b&sslrootcert=c",
                &["sslcert", "sslkey", "sslrootcert"]
            ),
            "postgresql://host/db?keep=1"
        );
    }

    #[test]
    fn drops_the_query_when_nothing_is_left() {
        assert_eq!(
            strip("postgresql://host/db?cxprotocol=binary", &["cxprotocol"]),
            "postgresql://host/db"
        );
    }

    #[test]
    fn handles_a_missing_query() {
        assert_eq!(
            strip("postgresql://host/db", &["cxprotocol"]),
            "postgresql://host/db"
        );
    }

    #[test]
    fn matches_percent_encoded_keys() {
        assert_eq!(
            strip(
                "postgresql://host/db?cx%70rotocol=binary&a=1",
                &["cxprotocol"]
            ),
            "postgresql://host/db?a=1"
        );
    }

    #[test]
    fn keeps_duplicate_keys_that_are_not_removed() {
        assert_eq!(
            strip("mysql://host/db?a=1&a=2&cxprotocol=text", &["cxprotocol"]),
            "mysql://host/db?a=1&a=2"
        );
    }
}

```

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

### Core Architecture Module: `benchmarks/tpch-dask.py`
```
"""
Usage:
  tpch-dask.py <num> [--conn=<conn>] [--index=<idx>] [--driver=<driver>]

Options:
  --conn=<conn>          The connection url to use [default: POSTGRES_URL].
  --index=<idx>          The connection url to use [default: l_orderkey].
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
    table = os.environ["TPCH_TABLE"]
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
            conn,
            index_col,
            npartitions=npartition,
            limits=(0, 60000000),
            parse_dates=[
                "l_shipdate",
                "l_commitdate",
                "l_receiptdate",
                "L_SHIPDATE",
                "L_COMMITDATE",
                "L_RECEIPTDATE",
            ],
        ).compute()

    print(f"[Total] {timer.elapsed:.2f}s")

    print(df.head())
    print(len(df))
    print(df.dtypes)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #927** (2026-08-28): **Trino: partition queries ignore verify=false and connection URL parameters are not forwarded to client**
  *Symptoms*: #### What language are you using?  Rust and Python (via `polars.read_database_uri`)  #### What version are you using?  ConnectorX 0.4.6 (current main branch)  #### What database are you using?  Trino  #### What dataframe are you using?  Arrow / Polars  #### Can you describe your bug?  The Trino source does not propagate URL query parameters to the `prusto` ClientBuilder. Specifically:  1. **`verify=false` is ignored in partition queries** — `trino_get_partition_range()` in `partition.rs` creates its own client without passing `no_verify`, causing TLS certificate errors on self-signed clusters when using `partition_on`.  2. **Session properties, extra credentials, and other Trino protocol headers are silently dropped** — the `prusto` ClientBuilder supports `.properties()`, `.extra_credentials()`, `.source()`, `.schema()`, `.client_tags()`, `.trace_token()`, and `.client_info()`, but ConnectorX never reads these from the connection URL.  This makes it impossible to set query timeouts, pass connector credentials (e.g. S3 tokens via `extra_credential`), route queries to resource groups (via `client_tags`), or set a default schema without qualifying every table name.  #### What are the steps to reproduce the behavior?  ##### Example query / code  ```python import polars as pl  # Bug 1: verify=false ignored on partition query (TLS error on self-signed cluster) df = pl.read_database_uri(     "SELECT * FROM schema.table",     "trino+https://user:pass@trino-selfsigned:443/hive?verify=

- **Issue #913** (2026-08-28): **Rust panic in arrow_stream is not propagated to Python**
  *Symptoms*: #### What language are you using?  **Python**  #### What version are you using?  0.4.5  #### What database are you using?  MySQL  #### What dataframe are you using?  Arrow Stream  #### Can you describe your bug?  I encountered an issue when using `return_type="arrow_stream"` to read data from a MySQL table containing a DATETIME(6) column.  ConnectorX prints the following panic:  ``` thread '<unnamed>' panicked at .../arrow_assoc.rs:290:28: out of range DateTime ```  However, the panic is not propagated back to Python. Instead:  - No exception is raised. - The process continues running normally. - The panic message is only printed to stderr.  There are some odd DATETIME(6) values in the table (for example, 0001-04-17 21:12:06.000000). However, the same query succeeds when using `return_type="arrow"`. My main concern is that the error is not propagated as a Python exception when using `arrow_stream`; instead, the stream silently returns no batches while the Rust panic is only printed to stderr.  My expectation is that either:  `arrow_stream` should successfully read the column, as `arrow` does, or the Rust panic should be converted into a Python exception instead of silently returning an empty stream.  #### What are the steps to reproduce the behavior?  ##### Database setup if the error only happens on specific data or data type  | Field | Type | |--------|--------| | updated_at | datetime(6) |  ``` 0001-04-17 21:12:06.000000 2026-04-17 21:12:07.000000 ```  ##### Example query 

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

### Incident Patch 1: `e444342c` (2026-10-18)
**Commit Message**: Merge pull request #1012 from oystersuki/fix/mysql-value-conversion-error

fix(mysql): report value conversion failures as errors instead of panicking

**File**: `connectorx-python/connectorx/tests/test_mysql.py` (modified, +25/-0)
```diff
@@ -781,3 +781,28 @@ def test_mysql_schema_fallback_without_server_side_prepare(mysql_url: str) -> No
         empty = read_sql(mysql_url, empty_query, protocol="text", return_type="arrow")
         assert empty.schema == expected_empty.schema
         assert empty.num_rows == 0
+
+
+@pytest.mark.parametrize("protocol", ["binary", "text"])
+@pytest.mark.parametrize(
+    "column",
+    [
+        "test_date",  # 0000-00-00
+        "test_datetime",  # 0000-00-00 00:00:00
+        "test_time_negative",  # -01:00:00, outside chrono NaiveTime
+        "test_time_over_24h",  # 838:59:59, outside chrono NaiveTime
+        "test_decimal_wide",  # 50 digits, beyond rust_decimal precision
+    ],
+)
+def test_mysql_unconvertible_value_raises(mysql_url: str, protocol: str, column: str) -> None:
+    # See test_unconvertible in scripts/mysql.sql. A value the column's Rust
+    # type cannot hold must raise an ordinary RuntimeError naming the column,
+    # not a PanicException, which `except Exception` cannot catch (#476, #268).
+    with pytest.raises(RuntimeError, match=rf"Cannot produce a .*column `{column}`") as excinfo:
+        read_sql(
+            mysql_url,
+            f"SELECT {column} FROM test_unconvertible",
+            protocol=protocol,
+        )
+    # The error names the column's type, not the Option wrapping nullable columns.
+    assert "Option<" not in str(excinfo.value)
```

**File**: `connectorx/src/sources/mysql/mod.rs` (modified, +35/-9)
```diff
@@ -19,7 +19,10 @@ use fehler::{throw, throws};
 use log::{debug, warn};
 use r2d2::{Pool, PooledConnection};
 use r2d2_mysql::{
-    mysql::{prelude::Queryable, Binary, Column, QueryResult, Row, Text},
+    mysql::{
+        prelude::{FromValue, Queryable},
+        Binary, Column, QueryResult, Row, Text,
+    },
     MySqlConnectionManager,
 };
 use rust_decimal::Decimal;
@@ -274,6 +277,33 @@ impl SourcePartition for MySQLSourcePartition<TextProtocol> {
     }
 }
 
+/// Takes the cell at `cidx` out of `row` and converts it to `T`.
+///
+/// `Row::take` panics inside mysql_common when the value has no representation
+/// in `T` (zero dates, TIME values outside a chrono `NaiveTime`, DECIMALs wider
+/// than rust_decimal, ...). Use `take_opt` instead and report the failure as an
+/// error naming the column (#476, #268).
+///
+/// `Produced` is the type named in that error: the column's Rust type, without
+/// the `Option` of nullable columns, as in the other sources.
+fn take_cell<T: FromValue, Produced>(
+    row: &mut Row,
+    ridx: usize,
+    cidx: usize,
+) -> Result<T, MySQLSourceError> {
+    match row.take_opt::<T, _>(cidx) {
+        Some(Ok(value)) => Ok(value),
+        Some(Err(e)) => Err(ConnectorXError::cannot_produce::<Produced>(Some(format!(
+            "column `{}` (index {}): {}",
+            row.columns_ref()[cidx].name_str(),
+            cidx,
+            e
+        )))
+        .into()),
+        None => Err(anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx).into()),
+    }
+}
+
 pub struct MySQLBinarySourceParser<'a> {
     iter: QueryResult<'a, 'a, 'a, Binary>,
     rowbuf: Vec<Row>,
@@ -346,8 +376,7 @@ macro_rules! impl_produce_binary {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> $t {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<$t, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
 
@@ -357,8 +386,7 @@ macro_rules! impl_produce_binary {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> Option<$t> {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<Option<$t>, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
         )+
@@ -455,8 +483,7 @@ macro_rules! impl_produce_text {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> $t {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<$t, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
 
@@ -466,8 +493,7 @@ macro_rules! impl_produce_text {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> Option<$t> {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<Option<$t>, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
         )+
```

**File**: `connectorx/tests/test_mysql.rs` (modified, +43/-7)
```diff
@@ -15,7 +15,7 @@ use connectorx::{
     prelude::*,
     sources::mysql::{BinaryProtocol, MySQLSource, TextProtocol},
     sql::CXQuery,
-    transports::MySQLArrowTransport,
+    transports::{MySQLArrowTransport, MySQLArrowTransportError},
 };
 
 #[test]
@@ -428,7 +428,10 @@ fn assert_str_collation_schema(result: &[RecordBatch]) {
 
 /// Run a single naked query through the Arrow transport using either the
 /// binary or text protocol.
-fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
+fn try_run_mysql_query(
+    query: &str,
+    binary: bool,
+) -> Result<Vec<RecordBatch>, MySQLArrowTransportError> {
     let _ = env_logger::builder().is_test(true).try_init();
     let dburl = test_db::mysql_url();
     let queries = [CXQuery::naked(query)];
@@ -442,8 +445,7 @@ fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
             &queries,
             None,
         )
-        .run()
-        .unwrap();
+        .run()?;
     } else {
         let builder = MySQLSource::<TextProtocol>::new(&dburl, 1).unwrap();
         Dispatcher::<_, _, MySQLArrowTransport<TextProtocol>>::new(
@@ -452,11 +454,14 @@ fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
             &queries,
             None,
         )
-        .run()
-        .unwrap();
+        .run()?;
     }
 
-    destination.arrow().unwrap()
+    Ok(destination.arrow()?)
+}
+
+fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
+    try_run_mysql_query(query, binary).unwrap()
 }
 
 #[test]
@@ -698,3 +703,34 @@ fn test_mysql_long_unsigned() {
             .eq(&UInt32Array::from(vec![0u32, 4294967295])));
     }
 }
+
+/// Values in `test_unconvertible` are valid in MySQL but cannot be represented
+/// by the Rust type the column maps to (see `scripts/mysql.sql`). The
+/// conversion must surface as an error, not as a panic inside the driver
+/// (#476, #268).
+const UNCONVERTIBLE_COLUMNS: [&str; 5] = [
+    "test_date",
+    "test_datetime",
+    "test_time_negative",
+    "test_time_over_24h",
+    "test_decimal_wide",
+];
+
+#[test]
+fn test_mysql_unconvertible_value_is_error() {
+    for binary in [true, false] {
+        for col in UNCONVERTIBLE_COLUMNS {
+            let query = format!("select {} from test_unconvertible", col);
+            let msg = try_run_mysql_query(&query, binary).unwrap_err().to_string();
+            assert!(
+                msg.contains("Cannot produce a")
+                    && msg.contains(&format!("column `{}`", col))
+                    && !msg.contains("Option<"),
+                "{} (binary={}): unexpected error message: {}",
+                query,
+                binary,
+                msg
+            );
+        }
+    }
+}
```

**File**: `scripts/mysql.sql` (modified, +26/-0)
```diff
@@ -90,3 +90,29 @@ CREATE TABLE IF NOT EXISTS test_str_collation (
 );
 
 INSERT INTO test_str_collation VALUES (1, 'general', 'bin', 'ascii', 'text', 'textbin', 0x4442, 0x00010203, 'blob'), (2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
+
+DROP TABLE IF EXISTS test_unconvertible;
+
+-- Values that are valid in MySQL but cannot be represented by the Rust types
+-- connector-x maps the columns to (#476, #268): zero dates, negative or
+-- over-24h TIME values (chrono NaiveTime), and DECIMALs beyond the 28-digit
+-- precision of rust_decimal. Row 1 holds ordinary values, row 2 the bad ones.
+-- MySQL 8 refuses '0000-00-00' under its default sql_mode (NO_ZERO_DATE,
+-- NO_ZERO_IN_DATE), so relax it around the insert and restore it afterwards.
+SET @cx_saved_sql_mode = @@SESSION.sql_mode;
+SET SESSION sql_mode = '';
+
+CREATE TABLE IF NOT EXISTS test_unconvertible (
+    test_int INT,
+    test_date DATE,
+    test_datetime DATETIME,
+    test_time_negative TIME,
+    test_time_over_24h TIME,
+    test_decimal_wide DECIMAL(65, 0)
+);
+
+INSERT INTO test_unconvertible VALUES
+    (1, '2020-01-01', '2020-01-01 00:00:00', '01:00:00', '01:00:00', 1),
+    (2, '0000-00-00', '0000-00-00 00:00:00', '-01:00:00', '838:59:59', 12345678901234567890123456789012345678901234567890);
+
+SET SESSION sql_mode = @cx_saved_sql_mode;
```

---

### Incident Patch 2: `bff52d3e` (2026-09-15)
**Commit Message**: fix(mysql): report value conversion failures as errors instead of panicking

**File**: `connectorx-python/connectorx/tests/test_mysql.py` (modified, +25/-0)
```diff
@@ -781,3 +781,28 @@ def test_mysql_schema_fallback_without_server_side_prepare(mysql_url: str) -> No
         empty = read_sql(mysql_url, empty_query, protocol="text", return_type="arrow")
         assert empty.schema == expected_empty.schema
         assert empty.num_rows == 0
+
+
+@pytest.mark.parametrize("protocol", ["binary", "text"])
+@pytest.mark.parametrize(
+    "column",
+    [
+        "test_date",  # 0000-00-00
+        "test_datetime",  # 0000-00-00 00:00:00
+        "test_time_negative",  # -01:00:00, outside chrono NaiveTime
+        "test_time_over_24h",  # 838:59:59, outside chrono NaiveTime
+        "test_decimal_wide",  # 50 digits, beyond rust_decimal precision
+    ],
+)
+def test_mysql_unconvertible_value_raises(mysql_url: str, protocol: str, column: str) -> None:
+    # See test_unconvertible in scripts/mysql.sql. A value the column's Rust
+    # type cannot hold must raise an ordinary RuntimeError naming the column,
+    # not a PanicException, which `except Exception` cannot catch (#476, #268).
+    with pytest.raises(RuntimeError, match=rf"Cannot produce a .*column `{column}`") as excinfo:
+        read_sql(
+            mysql_url,
+            f"SELECT {column} FROM test_unconvertible",
+            protocol=protocol,
+        )
+    # The error names the column's type, not the Option wrapping nullable columns.
+    assert "Option<" not in str(excinfo.value)
```

**File**: `connectorx/src/sources/mysql/mod.rs` (modified, +35/-9)
```diff
@@ -19,7 +19,10 @@ use fehler::{throw, throws};
 use log::{debug, warn};
 use r2d2::{Pool, PooledConnection};
 use r2d2_mysql::{
-    mysql::{prelude::Queryable, Binary, Column, QueryResult, Row, Text},
+    mysql::{
+        prelude::{FromValue, Queryable},
+        Binary, Column, QueryResult, Row, Text,
+    },
     MySqlConnectionManager,
 };
 use rust_decimal::Decimal;
@@ -274,6 +277,33 @@ impl SourcePartition for MySQLSourcePartition<TextProtocol> {
     }
 }
 
+/// Takes the cell at `cidx` out of `row` and converts it to `T`.
+///
+/// `Row::take` panics inside mysql_common when the value has no representation
+/// in `T` (zero dates, TIME values outside a chrono `NaiveTime`, DECIMALs wider
+/// than rust_decimal, ...). Use `take_opt` instead and report the failure as an
+/// error naming the column (#476, #268).
+///
+/// `Produced` is the type named in that error: the column's Rust type, without
+/// the `Option` of nullable columns, as in the other sources.
+fn take_cell<T: FromValue, Produced>(
+    row: &mut Row,
+    ridx: usize,
+    cidx: usize,
+) -> Result<T, MySQLSourceError> {
+    match row.take_opt::<T, _>(cidx) {
+        Some(Ok(value)) => Ok(value),
+        Some(Err(e)) => Err(ConnectorXError::cannot_produce::<Produced>(Some(format!(
+            "column `{}` (index {}): {}",
+            row.columns_ref()[cidx].name_str(),
+            cidx,
+            e
+        )))
+        .into()),
+        None => Err(anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx).into()),
+    }
+}
+
 pub struct MySQLBinarySourceParser<'a> {
     iter: QueryResult<'a, 'a, 'a, Binary>,
     rowbuf: Vec<Row>,
@@ -346,8 +376,7 @@ macro_rules! impl_produce_binary {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> $t {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<$t, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
 
@@ -357,8 +386,7 @@ macro_rules! impl_produce_binary {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> Option<$t> {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<Option<$t>, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
         )+
@@ -455,8 +483,7 @@ macro_rules! impl_produce_text {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> $t {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<$t, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
 
@@ -466,8 +493,7 @@ macro_rules! impl_produce_text {
                 #[throws(MySQLSourceError)]
                 fn produce(&'r mut self) -> Option<$t> {
                     let (ridx, cidx) = self.next_loc()?;
-                    let res = self.rowbuf[ridx].take(cidx).ok_or_else(|| anyhow!("mysql cannot parse at position: ({}, {})", ridx, cidx))?;
-                    res
+                    take_cell::<Option<$t>, $t>(&mut self.rowbuf[ridx], ridx, cidx)?
                 }
             }
         )+
```

**File**: `connectorx/tests/test_mysql.rs` (modified, +43/-7)
```diff
@@ -15,7 +15,7 @@ use connectorx::{
     prelude::*,
     sources::mysql::{BinaryProtocol, MySQLSource, TextProtocol},
     sql::CXQuery,
-    transports::MySQLArrowTransport,
+    transports::{MySQLArrowTransport, MySQLArrowTransportError},
 };
 
 #[test]
@@ -428,7 +428,10 @@ fn assert_str_collation_schema(result: &[RecordBatch]) {
 
 /// Run a single naked query through the Arrow transport using either the
 /// binary or text protocol.
-fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
+fn try_run_mysql_query(
+    query: &str,
+    binary: bool,
+) -> Result<Vec<RecordBatch>, MySQLArrowTransportError> {
     let _ = env_logger::builder().is_test(true).try_init();
     let dburl = test_db::mysql_url();
     let queries = [CXQuery::naked(query)];
@@ -442,8 +445,7 @@ fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
             &queries,
             None,
         )
-        .run()
-        .unwrap();
+        .run()?;
     } else {
         let builder = MySQLSource::<TextProtocol>::new(&dburl, 1).unwrap();
         Dispatcher::<_, _, MySQLArrowTransport<TextProtocol>>::new(
@@ -452,11 +454,14 @@ fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
             &queries,
             None,
         )
-        .run()
-        .unwrap();
+        .run()?;
     }
 
-    destination.arrow().unwrap()
+    Ok(destination.arrow()?)
+}
+
+fn run_mysql_query(query: &str, binary: bool) -> Vec<RecordBatch> {
+    try_run_mysql_query(query, binary).unwrap()
 }
 
 #[test]
@@ -698,3 +703,34 @@ fn test_mysql_long_unsigned() {
             .eq(&UInt32Array::from(vec![0u32, 4294967295])));
     }
 }
+
+/// Values in `test_unconvertible` are valid in MySQL but cannot be represented
+/// by the Rust type the column maps to (see `scripts/mysql.sql`). The
+/// conversion must surface as an error, not as a panic inside the driver
+/// (#476, #268).
+const UNCONVERTIBLE_COLUMNS: [&str; 5] = [
+    "test_date",
+    "test_datetime",
+    "test_time_negative",
+    "test_time_over_24h",
+    "test_decimal_wide",
+];
+
+#[test]
+fn test_mysql_unconvertible_value_is_error() {
+    for binary in [true, false] {
+        for col in UNCONVERTIBLE_COLUMNS {
+            let query = format!("select {} from test_unconvertible", col);
+            let msg = try_run_mysql_query(&query, binary).unwrap_err().to_string();
+            assert!(
+                msg.contains("Cannot produce a")
+                    && msg.contains(&format!("column `{}`", col))
+                    && !msg.contains("Option<"),
+                "{} (binary={}): unexpected error message: {}",
+                query,
+                binary,
+                msg
+            );
+        }
+    }
+}
```

**File**: `scripts/mysql.sql` (modified, +26/-0)
```diff
@@ -90,3 +90,29 @@ CREATE TABLE IF NOT EXISTS test_str_collation (
 );
 
 INSERT INTO test_str_collation VALUES (1, 'general', 'bin', 'ascii', 'text', 'textbin', 0x4442, 0x00010203, 'blob'), (2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
+
+DROP TABLE IF EXISTS test_unconvertible;
+
+-- Values that are valid in MySQL but cannot be represented by the Rust types
+-- connector-x maps the columns to (#476, #268): zero dates, negative or
+-- over-24h TIME values (chrono NaiveTime), and DECIMALs beyond the 28-digit
+-- precision of rust_decimal. Row 1 holds ordinary values, row 2 the bad ones.
+-- MySQL 8 refuses '0000-00-00' under its default sql_mode (NO_ZERO_DATE,
+-- NO_ZERO_IN_DATE), so relax it around the insert and restore it afterwards.
+SET @cx_saved_sql_mode = @@SESSION.sql_mode;
+SET SESSION sql_mode = '';
+
+CREATE TABLE IF NOT EXISTS test_unconvertible (
+    test_int INT,
+    test_date DATE,
+    test_datetime DATETIME,
+    test_time_negative TIME,
+    test_time_over_24h TIME,
+    test_decimal_wide DECIMAL(65, 0)
+);
+
+INSERT INTO test_unconvertible VALUES
+    (1, '2020-01-01', '2020-01-01 00:00:00', '01:00:00', '01:00:00', 1),
+    (2, '0000-00-00', '0000-00-00 00:00:00', '-01:00:00', '838:59:59', 12345678901234567890123456789012345678901234567890);
+
+SET SESSION sql_mode = @cx_saved_sql_mode;
```

---

### Incident Patch 3: `01fbd606` (2026-10-12)
**Commit Message**: fix(mssql): build against bb8 0.9

bb8 0.9 replaced the async_trait-based ManageConnection with native
async fns, and is_valid now takes &mut Self::Connection. Port the
mssql-tds ConnectionManager accordingly and drop the async-trait dep.

bb8-tiberius 0.8 is built on bb8 0.7, and the only bb8-tiberius release
on bb8 0.9 needs tiberius 0.12. Rather than upgrade a driver that is
being removed (#962), keep bb8 0.7 under the `bb8_07` alias for the
Tiberius path only.

Also update connectorx-python/Cargo.lock, which dependabot left on
bb8 0.7 only.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -1778,7 +1778,7 @@ version = "0.4.6"
 dependencies = [
  "anyhow",
  "arrow",
- "async-trait",
+ "bb8 0.7.1",
  "bb8 0.9.1",
  "bb8-tiberius",
  "chrono",
```

**File**: `connectorx-python/Cargo.lock` (modified, +16/-4)
```diff
@@ -927,14 +927,26 @@ dependencies = [
  "tokio",
 ]
 
+[[package]]
+name = "bb8"
+version = "0.9.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "457d7ed3f888dfd2c7af56d4975cade43c622f74bdcddfed6d4352f57acc6310"
+dependencies = [
+ "futures-util",
+ "parking_lot 0.12.4",
+ "portable-atomic",
+ "tokio",
+]
+
 [[package]]
 name = "bb8-tiberius"
 version = "0.8.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d8a33c87124c1938413e45ab6a6655e49d9e4cd015e05db61d6ab5a4f96b2c83"
 dependencies = [
  "async-trait",
- "bb8",
+ "bb8 0.7.1",
  "futures",
  "thiserror 1.0.69",
  "tiberius",
@@ -1454,8 +1466,8 @@ version = "0.4.6"
 dependencies = [
  "anyhow",
  "arrow",
- "async-trait",
- "bb8",
+ "bb8 0.7.1",
+ "bb8 0.9.1",
  "bb8-tiberius",
  "chrono",
  "chrono-tz 0.10.4",
@@ -6666,7 +6678,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c3d1e2c7f27f8d4cb10542a02c49005dbd6e93095799d6f3be745fae9f8fedd4"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
```

**File**: `connectorx/Cargo.toml` (modified, +4/-3)
```diff
@@ -30,7 +30,9 @@ polars = { workspace = true, optional = true, features = [
 ] }
 polars-arrow = { workspace = true, optional = true }
 bb8 = { version = "0.9", optional = true }
-async-trait = { version = "0.1", optional = true }
+# bb8-tiberius 0.8 is built on bb8 0.7; keep it for the legacy Tiberius driver
+# until that driver is removed (#962).
+bb8_07 = { package = "bb8", version = "0.7", optional = true }
 bb8-tiberius = { version = "0.8", optional = true }
 csv = { version = "1", optional = true }
 fallible-streaming-iterator = { version = "0.1", optional = true }
@@ -144,14 +146,13 @@ src_mssql_tiberius = [
   "src_mssql_common",
   "tiberius",
   "bb8-tiberius",
-  "bb8",
+  "bb8_07",
 ]
 src_mssql_tds = [
   "src_mssql_common",
   "mssql-tds",
   "uuid",
   "bb8",
-  "async-trait",
 ]
 src_mysql = ["r2d2_mysql", "mysql_common", "rust_decimal", "num-traits", "r2d2"]
 src_oracle = ["oracle", "r2d2-oracle", "r2d2", "urlencoding", "rust_decimal"]
```

**File**: `connectorx/src/sources/mssql/errors.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ pub enum MsSQLSourceError {
 
     #[cfg(feature = "src_mssql_tiberius")]
     #[error(transparent)]
-    MsSQLRuntimeError(#[from] bb8::RunError<bb8_tiberius::Error>),
+    MsSQLRuntimeError(#[from] bb8_07::RunError<bb8_tiberius::Error>),
 
     #[cfg(feature = "src_mssql_tiberius")]
     #[error(transparent)]
```

**File**: `connectorx/src/sources/mssql/tds_impl.rs` (modified, +1/-2)
```diff
@@ -309,7 +309,6 @@ struct ConnectionManager {
     url: Url,
 }
 
-#[async_trait::async_trait]
 impl ManageConnection for ConnectionManager {
     type Connection = TdsClient;
     type Error = MsSQLSourceError;
@@ -321,7 +320,7 @@ impl ManageConnection for ConnectionManager {
             .await?)
     }
 
-    async fn is_valid(&self, client: &mut PooledConnection<'_, Self>) -> Result<(), Self::Error> {
+    async fn is_valid(&self, client: &mut TdsClient) -> Result<(), Self::Error> {
         if client.is_connection_dead() {
             return Err(anyhow!("MsSQL pooled connection is closed").into());
         }
```

**File**: `connectorx/src/sources/mssql/tiberius_impl.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ use crate::{
     utils::DummyBox,
 };
 use anyhow::anyhow;
-use bb8::{Pool, PooledConnection};
+use bb8_07::{Pool, PooledConnection};
 use bb8_tiberius::ConnectionManager;
 use chrono::{DateTime, Utc};
 use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
```

#### Recent Merged Pull Requests:
- **PR #1012** (2026-10-18): fix(mysql): report value conversion failures as errors instead of panicking (@oystersuki)
- **PR #1010** (2026-10-15): fix(oracle): refuse native BOOLEAN columns on Instant Client 23.4 (@oystersuki)
- **PR #1009** (2026-10-14): ci: skip docs deploy and contrib-readme on forks (@tschm)
- **PR #1007** (2026-10-18): build(rust): bump libc from 0.2.189 to 0.2.190 (@dependabot[bot])
- **PR #1003** (2026-10-15): ci: bump actions/setup-python to v6 (Node 24) (@tschm)
- **PR #998** (2026-10-10): Upgrade mssql-tds to 0.2.0 (@saurabh500)

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

## X. Merge pull request #1012 from oystersuki/fix/mysql-value-conversion-error

**RULE**:
When implementing operations in `connectorx-python/connectorx/tests/test_mysql.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sfu-db/connector-x. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e444342c`: Merge pull request #1012 from oystersuki/fix/mysql-value-conversion-error. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `connectorx-python/connectorx/tests/test_mysql.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:


@pytest.mark.parametrize("protocol", ["binary", "text"])
@pytest.mark.parametrize(
    "column",
    [
        "test_date",  # 0000-00-00
        "test_datetime",  # 0000-00-00 00:00:00
        "test_time_negative",  # -01:00:00, outside chrono NaiveTime
        "test_time_over_24h",  # 838:59:59, outside chrono NaiveTime
        "test_decimal_wide",  # 50 digits, beyond rust_decimal precision
    ],
)
def test_mysql_unconvertible_value_raises(mysql_url: str, protocol: str, column: str) -> None:
    # See test_unconvertible in scripts/mysql.sql. A value the column's Rust
    # type cannot hold must raise an ordinary RuntimeError naming the column,
    # not a PanicException, which `except Exception` cannot catch (#476, #268).
    with pytest.raises(RuntimeError, match=rf"Cannot produce a .*column `{column}`") as excinfo:
        read_sql(
            mysql_url,
            f"SELECT {column} FROM test_unconvertible",
            protocol=protocol,
        )
    # The error names the column's type, not the Option wrapping nullable columns.
    assert "Option<" not in str(excinfo.value)
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e444342c` are properly handled with clean fallback behavior.
