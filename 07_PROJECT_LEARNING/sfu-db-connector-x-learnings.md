> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sfu-db-connector-x-learnings.md`  
> **Source**: github ([https://github.com/sfu-db/connector-x](https://github.com/sfu-db/connector-x))  
> **Source Version**: `c52b20c0`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T07:06:26.783Z  
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
> **Harvest Timestamp**: 2026-11-17T07:06:26.778Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sfu-db/connector-x`
- **Description**: Fastest library to load data from DB to DataFrames in Rust and Python
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2664 stars

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

### Incident Patch 1: `c7824460` (2026-11-17)
**Commit Message**: Merge pull request #1045 from tschm/fix/python-drop-tpch-examples

**File**: `Justfile` (modified, +0/-9)
```diff
@@ -131,15 +131,6 @@ seed-db-more:
     clickhouse-client -h $CLICKHOUSE_HOST --port $CLICKHOUSE_PORT -u $CLICKHOUSE_USER --password $CLICKHOUSE_PASSWORD -d $CLICKHOUSE_DB < scripts/clickhouse.sql
 
 # benches 
-flame-tpch conn="POSTGRES_URL":
-    cd connectorx-python && PYO3_PYTHON=$HOME/.pyenv/versions/3.8.6/bin/python3.8 PYTHONPATH=$HOME/.pyenv/versions/conn/lib/python3.8/site-packages LD_LIBRARY_PATH=$HOME/.pyenv/versions/3.8.6/lib/ cargo run --no-default-features --features executable --features fptr --features nbstr --features dsts --features srcs --release --example flame_tpch {{conn}}
-
-build-tpch:
-    cd connectorx-python && cargo build --no-default-features --features executable --features fptr --release --example tpch
-
-cachegrind-tpch: build-tpch
-    valgrind --tool=cachegrind target/release/examples/tpch
-
 python-tpch name +ARGS="": setup-python
     #!/bin/bash
     export PYTHONPATH=$PWD/connectorx-python
```

**File**: `connectorx-python/Cargo.lock` (modified, +30/-314)
```diff
@@ -2,15 +2,6 @@
 # It is not intended for manual editing.
 version = 4
 
-[[package]]
-name = "addr2line"
-version = "0.24.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dfbe277e56a376000877090da837660b4427aad530e3028d44e0bffe4f89a1c1"
-dependencies = [
- "gimli",
-]
-
 [[package]]
 name = "adler2"
 version = "2.0.1"
@@ -254,7 +245,7 @@ dependencies = [
  "arrow-schema",
  "chrono",
  "half 2.7.1",
- "indexmap 2.14.1",
+ "indexmap",
  "lexical-core",
  "memchr",
  "num",
@@ -877,21 +868,6 @@ dependencies = [
  "tracing",
 ]
 
-[[package]]
-name = "backtrace"
-version = "0.3.75"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6806a6321ec58106fea15becdad98371e28d92ccbc7c8f1b3b6dd724fe8f1002"
-dependencies = [
- "addr2line",
- "cfg-if",
- "libc",
- "miniz_oxide",
- "object",
- "rustc-demangle",
- "windows-targets 0.52.6",
-]
-
 [[package]]
 name = "base64"
 version = "0.21.7"
@@ -1198,12 +1174,6 @@ dependencies = [
  "syn 1.0.109",
 ]
 
-[[package]]
-name = "bytemuck"
-version = "1.23.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5c76a5792e44e4abe34d3abf15636779261d45a7450612059293d1d2cfc63422"
-
 [[package]]
 name = "byteorder"
 version = "1.5.0"
@@ -1576,7 +1546,6 @@ dependencies = [
  "postgres",
  "postgres-native-tls",
  "postgres-openssl",
- "pprof",
  "pyo3",
  "pyo3-build-config",
  "pyo3-built",
@@ -1678,15 +1647,6 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
-[[package]]
-name = "cpp_demangle"
-version = "0.3.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "eeaa953eaad386a53111e47172c2fedba671e5684c8dd601a5f474f4f118710f"
-dependencies = [
- "cfg-if",
-]
-
 [[package]]
 name = "cpufeatures"
 version = "0.2.17"
@@ -2083,7 +2043,7 @@ dependencies = [
  "chrono",
  "half 2.7.1",
  "hashbrown 0.14.5",
- "indexmap 2.14.1",
+ "indexmap",
  "libc",
  "log",
  "object_store",
@@ -2267,7 +2227,7 @@ dependencies = [
  "datafusion-functions-aggregate-common",
  "datafusion-functions-window-common",
  "datafusion-physical-expr-common",
- "indexmap 2.14.1",
+ "indexmap",
  "paste",
  "recursive",
  "serde_json",
@@ -2282,7 +2242,7 @@ checksum = "6d155ccbda29591ca71a1344dd6bed26c65a4438072b400df9db59447f590bb6"
 dependencies = [
  "arrow",
  "datafusion-common",
- "indexmap 2.14.1",
+ "indexmap",
  "itertools 0.14.0",
  "paste",
 ]
@@ -2439,7 +2399,7 @@ dependencies = [
  "datafusion-expr",
  "datafusion-expr-common",
  "datafusion-physical-expr",
- "indexmap 2.14.1",
+ "indexmap",
  "itertools 0.14.0",
  "log",
  "recursive",
@@ -2462,12 +2422,12 @@ dependencies = [
  "datafusion-physical-expr-common",
  "half 2.7.1",
  "hashbrown 0.14.5",
- "indexmap 2.14.1",
+ "indexmap",
  "itertools 0.14.0",
  "log",
  "parking_lot 0.12.4",
  "paste",
- "petgraph 0.8.3",
+ "petgraph",
 ]
 
 [[package]]
@@ -2542,7 +2502,7 @@ dependencies = [
  "futures",
  "half 2.7.1",
  "hashbrown 0.14.5",
- "indexmap 2.14.1",
+ "indexmap",
  "itertools 0.14.0",
  "log",
  "parking_lot 0.12.4",
@@ -2602,7 +2562,7 @@ dependencies = [
  "bigdecimal 0.4.10",
  "datafusion-common",
  "datafusion-expr",
- "indexmap 2.14.1",
+ "indexmap",
  "log",
  "recursive",
  "regex",
@@ -2627,15 +2587,6 @@ version = "0.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "092966b41edc516079bdf31ec78a2e0588d1d0c08f78b91d8307215928642b2b"
 
-[[package]]
-name = "debugid"
-version = "0.7.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d6ee87af31d84ef885378aebca32be3d682b0e0dc119d5b4860a2c5bb5046730"
-dependencies = [
- "uuid 0.8.2",
-]
-
 [[package]]
 name = "der-parser"
 version = "10.0.0"
@@ -2952,12 +2903,6 @@ dependencies = [
  "syn 1.0.109",
 ]
 
-[[package]]
-name = "fixedbitset"
-version = "0.2.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "37ab347416e802de484e4d03c7316c48f1ecb56574dfd4a46a80f173ce1de04d"
-
 [[package]]
 name = "fixedbitset"
 version = "0.5.7"
@@ -3200,9 +3145,9 @@ dependencies = [
  "hyper-util",
  "log",
  "pin-project",
- "prost 0.14.4",
- "prost-build 0.14.4",
- "prost-types 0.14.4",
+ "prost",
+ "prost-build",
+ "prost-types",
  "reqwest 0.12.28",
  "serde",
  "serde_json",
@@ -3287,12 +3232,6 @@ dependencies = [
  "rand_core 0.10.1",
 ]
 
-[[package]]
-name = "gimli"
-version = "0.31.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "07e28edb80900c19c28f1072f2e8aeca7fa06b23cd4169cefe1af5aa3260783f"
-
 [[package]]
 name = "glob"
 version = "0.3.2"
@@ -3311,7 +3250,7 @@ dependencies = [
  "futures-sink",
  "futures-util",
  "http 0.2.12",
- "indexmap 2.14.1",
+ "indexmap",
  "slab",
  "tokio",
  "tokio-util 0.7.19",
@@ -3330,7 +3269,7 @@ dependencies = [
  "futures-core",
  "futures-sink",
  "http 1.3.1",
- "indexmap 2.14.1",
+ "indexmap",
  "slab",
  
```

**File**: `connectorx-python/Cargo.toml` (modified, +0/-2)
```diff
@@ -50,7 +50,6 @@ pyo3-build-config = {version = "0.29", features = ["resolve-config"]}
 criterion = "0.3"
 criterion-macro = "0.3"
 iai = "0.1"
-pprof = {version = "0.5", features = ["flamegraph", "criterion", "protobuf"]}
 rayon = "1"
 
 [lints.rust]
@@ -64,7 +63,6 @@ name = "connectorx"
 branch = ["connectorx/branch"]
 default = ["extension", "fptr", "nbstr", "dsts", "srcs", "federation", "fed_exec"]
 dsts = ["connectorx/dst_arrow"]
-executable = ["pyo3/auto-initialize"]
 extension = ["pyo3/extension-module"]
 fptr = ["connectorx/fptr"]
 federation = ["connectorx/federation"]
```

**File**: `connectorx-python/examples/flame_tpch.rs` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-mod tpch;
-
-use pprof::protos::Message;
-use std::env;
-use std::fs::File;
-use std::io::Write;
-
-fn main() {
-    let args: Vec<String> = env::args().collect();
-    let guard = pprof::ProfilerGuard::new(10).unwrap();
-
-    tpch::run(10, &args[1]);
-
-    if let Ok(report) = guard.report().build() {
-        let file = File::create("flamegraph.svg").unwrap();
-        report.flamegraph(file).unwrap();
-
-        let mut file = File::create("profile.pb").unwrap();
-        let profile = report.pprof().unwrap();
-
-        let mut content = Vec::new();
-        profile.encode(&mut content).unwrap();
-        file.write_all(&content).unwrap();
-    };
-}
```

**File**: `connectorx-python/examples/tpch.rs` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-use connectorx_python::cx_read_sql::{read_sql, PyPartitionQuery};
-use pyo3::Python;
-use std::env;
-
-const QUERY: &'static str = r#"
-SELECT 
-    *
-FROM LINEITEM"#;
-
-pub fn run(nq: usize, conn: &str) {
-    let conn = env::var(conn).unwrap();
-
-    Python::with_gil(|py| {
-        read_sql(
-            py,
-            &conn,
-            "pandas",
-            None,
-            None,
-            Some(PyPartitionQuery {
-                query: QUERY.to_string(),
-                column: "L_ORDERKEY".to_string(),
-                min: None,
-                max: None,
-                num: nq,
-            }),
-        )
-        .unwrap();
-    });
-}
-
-#[allow(dead_code)]
-fn main() {
-    run(1, "POSTGRES_URL");
-}
```

---

### Incident Patch 2: `e0a9492d` (2026-11-16)
**Commit Message**: Merge branch 'main' into fix/python-drop-tpch-examples

**File**: `benchmarks/tpch-rust-arrow.py` (removed, +0/-155)
```diff
@@ -1,155 +0,0 @@
-"""
-Usage:
-  tpch-rust-arrow.py <num>
-
-Options:
-  -h --help     Show this screen.
-  --version     Show version.
-"""
-import json
-import os
-import time
-from typing import List
-
-import numpy as np
-import pyarrow as pa
-from connectorx import read_pg
-from docopt import docopt
-
-
-def get_sqls(table: str, count: int) -> List[str]:
-    sqls = []
-    split = np.linspace(0, 60000000, num=count + 1, endpoint=True, dtype=int)
-    for i in range(len(split) - 1):
-
-        sqls.append(
-            f"""select  l_orderkey,
-                l_partkey,
-                l_suppkey,
-                l_linenumber,
-                l_quantity::float8,
-                l_extendedprice::float8,
-                l_discount::float8,
-                l_tax::float8,
-                l_returnflag,
-                l_linestatus,
-                l_shipdate,
-                l_commitdate,
-                l_receiptdate,                
-                l_shipinstruct,
-                l_shipmode,
-                l_comment from {table} where l_orderkey > {split[i]} and l_orderkey <= {split[i+1]}"""
-        )
-    return sqls
-
-
-def field_to_json(field):
-    json = {
-        "name": field.name,
-        "nullable": field.nullable,
-    }
-    if isinstance(field.type, pa.ListType):
-        json = {
-            **json,
-            "type": {"name": "list"},
-            "children": [field_to_json(field.type.value_field)],
-        }
-    elif field.type == pa.float64():
-        json = {
-            **json,
-            "type": {"name": "floatingpoint", "precision": "DOUBLE"},
-            "children": [],
-        }
-    elif field.type == pa.uint64():
-        json = {
-            **json,
-            "type": {"name": "int", "bitWidth": 64, "isSigned": False},
-            "children": [],
-        }
-    elif field.type == pa.string():
-        json = {
-            **json,
-            "type": {"name": "utf8"},
-            "children": [],
-        }
-    elif field.type == pa.date32():
-        json = {
-            **json,
-            "type": {"name": "date", "unit": "DAY"},
-            "children": [],
-        }
-    elif isinstance(field.type, pa.StructType):
-        json = {
-            **json,
-            "type": {"name": "struct"},
-            "children": [
-                field_to_json(field.type[i]) for i in range(field.type.num_fields)
-            ],
-        }
-    else:
-        raise NotImplementedError(field.type)
-
-    return json
-
-
-def schema_to_json(schema):
-    return {
-        "fields": [field_to_json(schema.field(name)) for name in schema.names],
-        "metadata": {},
-    }
-
-
-SCHEMA = pa.schema(
-    [
-        pa.field("l_orderkey", pa.uint64(), False),
-        pa.field("l_partkey", pa.uint64(), False),
-        pa.field("l_suppkey", pa.uint64(), False),
-        pa.field("l_linenumber", pa.uint64(), False),
-        pa.field("l_quantity", pa.float64(), False),
-        pa.field("l_extendedprice", pa.float64(), False),
-        pa.field("l_discount", pa.float64(), False),
-        pa.field("l_tax", pa.float64(), False),
-        pa.field("l_returnflag", pa.string(), False),
-        pa.field("l_linestatus", pa.string(), False),
-        # pa.field("l_shipdate", pa.date32(), False),
-        # pa.field("l_commitdate", pa.date32(), False),
-        # pa.field("l_receiptdate", pa.date32(), False),
-        pa.field("l_shipdate", pa.string(), False),
-        pa.field("l_commitdate", pa.string(), False),
-        pa.field("l_receiptdate", pa.string(), False),
-        pa.field("l_shipinstruct", pa.string(), False),
-        pa.field("l_shipmode", pa.string(), False),
-        pa.field("l_comment", pa.string(), False),
-    ]
-)
-
-
-if __name__ == "__main__":
-    args = docopt(__doc__, version="1.0")
-    conn = os.environ["POSTGRES_URL"]
-    table = os.environ["POSTGRES_TABLE"]
-
-    queries = get_sqls(table, int(args["<num>"]))
-
-    print(f"numer of threads: {int(args['<num>'])}\nsqls: {queries}")
-
-    then = time.time()
-    table = read_pg(
-        conn,
-        queries,
-        json.dumps(schema_to_json(SCHEMA)),
-    )
-    print(f"finish read_pg:", time.time() - then)
-
-    tb = pa.Table.from_arrays(
-        [
-            pa.chunked_array([pa.Array._import_from_c(*ptr) for ptr in ptrs])
-            for ptrs in table.values()
-        ],
-        names=list(table.keys()),
-    )
-    print("finish concat:", time.time() - then)
-
-    df = tb.to_pandas()
-    print("finish to_pandas:", time.time() - then)
-    print(df)
```

---

### Incident Patch 3: `261393ae` (2026-11-16)
**Commit Message**: Merge pull request #1047 from tschm/fix/benchmarks-drop-read-pg

**File**: `benchmarks/tpch-rust-arrow.py` (removed, +0/-155)
```diff
@@ -1,155 +0,0 @@
-"""
-Usage:
-  tpch-rust-arrow.py <num>
-
-Options:
-  -h --help     Show this screen.
-  --version     Show version.
-"""
-import json
-import os
-import time
-from typing import List
-
-import numpy as np
-import pyarrow as pa
-from connectorx import read_pg
-from docopt import docopt
-
-
-def get_sqls(table: str, count: int) -> List[str]:
-    sqls = []
-    split = np.linspace(0, 60000000, num=count + 1, endpoint=True, dtype=int)
-    for i in range(len(split) - 1):
-
-        sqls.append(
-            f"""select  l_orderkey,
-                l_partkey,
-                l_suppkey,
-                l_linenumber,
-                l_quantity::float8,
-                l_extendedprice::float8,
-                l_discount::float8,
-                l_tax::float8,
-                l_returnflag,
-                l_linestatus,
-                l_shipdate,
-                l_commitdate,
-                l_receiptdate,                
-                l_shipinstruct,
-                l_shipmode,
-                l_comment from {table} where l_orderkey > {split[i]} and l_orderkey <= {split[i+1]}"""
-        )
-    return sqls
-
-
-def field_to_json(field):
-    json = {
-        "name": field.name,
-        "nullable": field.nullable,
-    }
-    if isinstance(field.type, pa.ListType):
-        json = {
-            **json,
-            "type": {"name": "list"},
-            "children": [field_to_json(field.type.value_field)],
-        }
-    elif field.type == pa.float64():
-        json = {
-            **json,
-            "type": {"name": "floatingpoint", "precision": "DOUBLE"},
-            "children": [],
-        }
-    elif field.type == pa.uint64():
-        json = {
-            **json,
-            "type": {"name": "int", "bitWidth": 64, "isSigned": False},
-            "children": [],
-        }
-    elif field.type == pa.string():
-        json = {
-            **json,
-            "type": {"name": "utf8"},
-            "children": [],
-        }
-    elif field.type == pa.date32():
-        json = {
-            **json,
-            "type": {"name": "date", "unit": "DAY"},
-            "children": [],
-        }
-    elif isinstance(field.type, pa.StructType):
-        json = {
-            **json,
-            "type": {"name": "struct"},
-            "children": [
-                field_to_json(field.type[i]) for i in range(field.type.num_fields)
-            ],
-        }
-    else:
-        raise NotImplementedError(field.type)
-
-    return json
-
-
-def schema_to_json(schema):
-    return {
-        "fields": [field_to_json(schema.field(name)) for name in schema.names],
-        "metadata": {},
-    }
-
-
-SCHEMA = pa.schema(
-    [
-        pa.field("l_orderkey", pa.uint64(), False),
-        pa.field("l_partkey", pa.uint64(), False),
-        pa.field("l_suppkey", pa.uint64(), False),
-        pa.field("l_linenumber", pa.uint64(), False),
-        pa.field("l_quantity", pa.float64(), False),
-        pa.field("l_extendedprice", pa.float64(), False),
-        pa.field("l_discount", pa.float64(), False),
-        pa.field("l_tax", pa.float64(), False),
-        pa.field("l_returnflag", pa.string(), False),
-        pa.field("l_linestatus", pa.string(), False),
-        # pa.field("l_shipdate", pa.date32(), False),
-        # pa.field("l_commitdate", pa.date32(), False),
-        # pa.field("l_receiptdate", pa.date32(), False),
-        pa.field("l_shipdate", pa.string(), False),
-        pa.field("l_commitdate", pa.string(), False),
-        pa.field("l_receiptdate", pa.string(), False),
-        pa.field("l_shipinstruct", pa.string(), False),
-        pa.field("l_shipmode", pa.string(), False),
-        pa.field("l_comment", pa.string(), False),
-    ]
-)
-
-
-if __name__ == "__main__":
-    args = docopt(__doc__, version="1.0")
-    conn = os.environ["POSTGRES_URL"]
-    table = os.environ["POSTGRES_TABLE"]
-
-    queries = get_sqls(table, int(args["<num>"]))
-
-    print(f"numer of threads: {int(args['<num>'])}\nsqls: {queries}")
-
-    then = time.time()
-    table = read_pg(
-        conn,
-        queries,
-        json.dumps(schema_to_json(SCHEMA)),
-    )
-    print(f"finish read_pg:", time.time() - then)
-
-    tb = pa.Table.from_arrays(
-        [
-            pa.chunked_array([pa.Array._import_from_c(*ptr) for ptr in ptrs])
-            for ptrs in table.values()
-        ],
-        names=list(table.keys()),
-    )
-    print("finish concat:", time.time() - then)
-
-    df = tb.to_pandas()
-    print("finish to_pandas:", time.time() - then)
-    print(df)
```

#### Recent Merged Pull Requests:
- **PR #1067** (2026-11-16): ci: drop python 3.15/3.15t from test matrix (@tschm)
- **PR #1066** (2026-11-16): docs: fix typos in documentation (@hamidzr)
- **PR #1064** (2026-11-16): build(rust): bump j4rs from 0.25.2 to 0.25.3 (@dependabot[bot])
- **PR #1063** (2026-11-15): build(rust): bump sqlparser from 0.63.0 to 0.64.0 (@dependabot[bot])
- **PR #1062** (2026-11-15): build(rust): bump tokio from 1.53.3 to 1.54.1 (@dependabot[bot])
- **PR #1061** (2026-11-17): ci: install just with taiki-e/install-action instead of setup-just (@tschm)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
