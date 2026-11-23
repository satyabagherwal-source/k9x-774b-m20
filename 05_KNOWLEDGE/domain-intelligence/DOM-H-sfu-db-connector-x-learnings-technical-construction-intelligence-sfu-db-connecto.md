# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: sfu-db-connector-x-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db-connector-x-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T16:45:22.197Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sfu-db-connector-x-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db-connector-x-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T16:45:22.197Z`  
> **Learning ID**: `LEARN-EVO-sfu-db-connector-x-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 52%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sfu-db-connector-x-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sfu-db-connector-x-learnings.md`  
> **Source**: github ([https://github.com/sfu-db/connector-x](https://github.com/sfu-db/connector-x))  
> **Source Version**: `580a386f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T16:44:54.668Z  
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
> **Harvest Timestamp**: 2026-11-23T16:44:54.436Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sfu-db/connector-x`
- **Description**: Fastest library to load data from DB to DataFrames in Rust and Python
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2665 stars

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

// Only the SQLite, Oracle and Tiberius MSSQL sources need `OwningHandle`.
#[cfg(any(
    feature = "src_sqlite",
    feature = "src_oracle",
    feature = "src_mssql_tiberius"
))]
pub(crate) use owning_handle::OwningHandle;

#[cfg(any(
    feature = "src_sqlite",
    feature = "src_oracle",
    feature = "src_mssql_tiberius"
))]
mod owning_handle {
    use std::mem::ManuallyDrop;
    use std::ops::{Deref, DerefMut};
    use std::ptr::NonNull;

    /// A heap-allocated owner together with a handle that borrows from it, such as a
    /// prepared statement and the row stream reading from it.
    ///
    /// Replaces `owning_ref::OwningHandle` (RUSTSEC-2022-0040). That type keeps the
    /// owner in a `Box` while the handle borrows from it, which violates Rust's
    /// aliasing rules whenever the `Box` is moved. Here the owner is turned into a
    /// raw pointer with `Box::leak` for as long as the handle exists, so no
    /// `Box` claims unique access to it, and `Drop` frees the handle before the owner.
    ///
    /// Like the original, it dereferences through the handle (`H::Target`).
    pub(crate) struct OwningHandle<O, H> {
        handle: ManuallyDrop<H>,
        owner: NonNull<O>,
    }

    impl<O, H> OwningHandle<O, H> {
        /// Move `owner` to a stable heap address and build the handle from a pointer to it.
        ///
        /// `f` may turn the pointer into `&O` or `&mut O`; the owner stays alive, and
        /// at the same address, until the returned value is dropped. If `f` panics, the
        /// owner is leaked rather than freed.
        pub(crate) fn new_with_fn<F>(owner: Box<O>, f: F) -> Self
        where
            F: FnOnce(*const O) -> H,
        {
            // Give up the `Box` so nothing claims unique access while `H` borrows the
            // owner; `Drop` turns the pointer back into a `Box` to free it.
            let owner = NonNull::from(Box::leak(owner));
            let handle = f(owner.as_ptr());
            Self {
                handle: ManuallyDrop::new(handle),
                owner,
            }
        }
    }

    impl<O, H: Deref> Deref for OwningHandle<O, H> {
        type Target = H::Target;

        fn deref(&self) -> &Self::Target {
            &self.handle
        }
    }

    impl<O, H: DerefMut> DerefMut for OwningHandle<O, H> {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.handle
        }
    }

    impl<O, H> Drop for OwningHandle<O, H> {
        fn drop(&mut self) {
            // SAFETY: the handle may borrow from the owner, so drop it first. `owner`
            // came from `Box::leak` in `new_with_fn` and is freed exactly once, here.
            unsafe {
                ManuallyDrop::drop(&mut self.handle);
                drop(Box::from_raw(self.owner.as_ptr()));
            }
        }
    }

    // SAFETY: the value owns both the owner and the handle outright, as
    // `(Box<O>, H)` would; `NonNull` only opts out of these impls by default.
    unsafe impl<O: Send, H: Send> Send for OwningHandle<O, H> {}
    unsafe impl<O: Sync, H: Sync> Sync for OwningHandle<O, H> {}

    #[cfg(test)]
    mod tests {
        use super::OwningHandle;
        use crate::utils::DummyBox;
        use std::cell::RefCell;
        use std::rc::Rc;

        /// Records its name in `log` when dropped.
        struct Noisy {
            name: &'static str,
            log: Rc<RefCell<Vec<&'static str>>>,
        }

        impl Drop for Noisy {
            fn drop(&mut self) {
                self.log.borrow_mut().push(self.name);
            }
        }

        #[test]
        fn owning_handle_borrows_owner_across_moves() {
            let owner = Box::new(vec![1, 2, 3]);
            let handle = OwningHandle::new_with_fn(owner, |v: *const Vec<i32>| unsafe {
                DummyBox((*v).iter())
            });
            // Moving the handle must not invalidate the borrow of the owner.
            let mut moved = handle;
            assert_eq!(moved.next(), Some(&1));
            let mut moved_again = moved;
            assert_eq!(moved_again.next(), Some(&2));
        }

        #[test]
        fn owning_handle_drops_handle_before_owner() {
            let log = Rc::new(RefCell::new(Vec::new()));
            let owner = Box::new(Noisy {
                name: "owner",
                log: log.clone(),
            });
            let handle_log = log.clone();
            let handle = OwningHandle::new_with_fn(owner, move |_| {
                DummyBox(Noisy {
                    name: "handle",
                    log: handle_log,
                })
            });
            drop(handle);
            assert_eq!(*log.borrow(), ["handle", "owner"]);
        }
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

### Incident Patch 1: `03ac5a84` (2026-11-22)
**Commit Message**: fix(rust): replace owning_ref with an internal OwningHandle

owning_ref has unfixed soundness issues (RUSTSEC-2022-0040) and no
patched release, which leaves a Dependabot alert open on both
lockfiles. The SQLite, Oracle and MSSQL sources only used its
OwningHandle to keep a statement or connection alive next to the row
stream that borrows from it.

Add a small crate-private OwningHandle in utils.rs with the same
new_with_fn/Deref API. It holds the owner through Box::into_raw rather
than a Box, so moving the handle doesn't assert unique access to
memory that is still borrowed, and Drop frees the handle before the
owner. Call sites only change their import and the owner type
parameter. DummyBox stays, as utils is a public module.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +0/-10)
```diff
@@ -1926,7 +1926,6 @@ dependencies = [
  "num-traits",
  "openssl",
  "oracle",
- "owning_ref",
  "pgvector",
  "polars",
  "polars-arrow",
@@ -5821,15 +5820,6 @@ version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1a80800c0488c3a21695ea981a54918fbb37abf04f4d0720c453632255e2ff0e"
 
-[[package]]
-name = "owning_ref"
-version = "0.4.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6ff55baddef9e4ad00f88b6c743a2a8062d4c6ade126c2a528644b8e444d52ce"
-dependencies = [
- "stable_deref_trait",
-]
-
 [[package]]
 name = "p256"
 version = "0.13.2"
```

**File**: `connectorx-python/Cargo.lock` (modified, +0/-10)
```diff
@@ -1577,7 +1577,6 @@ dependencies = [
  "num-traits",
  "openssl",
  "oracle",
- "owning_ref",
  "pgvector",
  "postgres",
  "postgres-native-tls",
@@ -4822,15 +4821,6 @@ version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1a80800c0488c3a21695ea981a54918fbb37abf04f4d0720c453632255e2ff0e"
 
-[[package]]
-name = "owning_ref"
-version = "0.4.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6ff55baddef9e4ad00f88b6c743a2a8062d4c6ade126c2a528644b8e444d52ce"
-dependencies = [
- "stable_deref_trait",
-]
-
 [[package]]
 name = "page_size"
 version = "0.6.0"
```

**File**: `connectorx/Cargo.toml` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ rayon = "1"
 sqlparser = "0.64"
 thiserror = "2"
 url = "2"
-owning_ref = "0.4"
 serde_json = "1"
 chrono = "0.4"
 
```

**File**: `connectorx/src/sources/mssql/tiberius_impl.rs` (modified, +4/-4)
```diff
@@ -8,6 +8,7 @@ use super::driver;
 use super::errors::MsSQLSourceError;
 use super::typesystem::{FloatN, IntN, MsSQLTypeSystem};
 use crate::constants::DB_BUFFER_SIZE;
+use crate::utils::OwningHandle;
 use crate::{
     data_order::DataOrder,
     errors::ConnectorXError,
@@ -23,7 +24,6 @@ use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
 use fehler::{throw, throws};
 use futures::StreamExt;
 use log::debug;
-use owning_ref::OwningHandle;
 use rust_decimal::Decimal;
 use sqlparser::dialect::MsSqlDialect;
 use std::collections::HashMap;
@@ -292,7 +292,7 @@ impl SourcePartition for MsSQLSourcePartition {
     #[throws(MsSQLSourceError)]
     fn parser<'a>(&'a mut self) -> Self::Parser<'a> {
         let conn = self.rt.block_on(self.pool.get())?;
-        let rows: OwningHandle<Box<Conn<'a>>, DummyBox<QueryStream<'a>>> =
+        let rows: OwningHandle<Conn<'a>, DummyBox<QueryStream<'a>>> =
             OwningHandle::new_with_fn(Box::new(conn), |conn: *const Conn<'a>| unsafe {
                 let conn = &mut *(conn as *mut Conn<'a>);
 
@@ -317,7 +317,7 @@ impl SourcePartition for MsSQLSourcePartition {
 
 pub struct MsSQLSourceParser<'a> {
     rt: &'a Handle,
-    iter: OwningHandle<Box<Conn<'a>>, DummyBox<QueryStream<'a>>>,
+    iter: OwningHandle<Conn<'a>, DummyBox<QueryStream<'a>>>,
     rowbuf: Vec<Row>,
     ncols: usize,
     current_col: usize,
@@ -328,7 +328,7 @@ pub struct MsSQLSourceParser<'a> {
 impl<'a> MsSQLSourceParser<'a> {
     fn new(
         rt: &'a Handle,
-        iter: OwningHandle<Box<Conn<'a>>, DummyBox<QueryStream<'a>>>,
+        iter: OwningHandle<Conn<'a>, DummyBox<QueryStream<'a>>>,
         schema: &[MsSQLTypeSystem],
     ) -> Self {
         Self {
```

**File**: `connectorx/src/sources/oracle/mod.rs` (modified, +3/-3)
```diff
@@ -6,6 +6,7 @@ use std::collections::HashMap;
 pub use self::errors::OracleSourceError;
 pub use self::typesystem::OracleTypeSystem;
 use crate::constants::{DB_BUFFER_SIZE, ORACLE_ARRAY_SIZE};
+use crate::utils::OwningHandle;
 use crate::{
     data_order::DataOrder,
     errors::ConnectorXError,
@@ -16,7 +17,6 @@ use crate::{
 use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
 use fehler::{throw, throws};
 use log::debug;
-use owning_ref::OwningHandle;
 use r2d2::{Pool, PooledConnection};
 use r2d2_oracle::oracle::ResultSet;
 use r2d2_oracle::{
@@ -302,7 +302,7 @@ unsafe impl<'a> Send for OracleTextSourceParser<'a> {}
 
 /// Row parser for an Oracle partition.
 pub struct OracleTextSourceParser<'a> {
-    rows: OwningHandle<Box<Statement>, DummyBox<ResultSet<'a, Row>>>,
+    rows: OwningHandle<Statement, DummyBox<ResultSet<'a, Row>>>,
     rowbuf: Vec<Row>,
     ncols: usize,
     current_col: usize,
@@ -319,7 +319,7 @@ impl<'a> OracleTextSourceParser<'a> {
             .prefetch_rows(ORACLE_ARRAY_SIZE)
             .fetch_array_size(ORACLE_ARRAY_SIZE)
             .build()?;
-        let rows: OwningHandle<Box<Statement>, DummyBox<ResultSet<'a, Row>>> =
+        let rows: OwningHandle<Statement, DummyBox<ResultSet<'a, Row>>> =
             OwningHandle::new_with_fn(Box::new(stmt), |stmt: *const Statement| unsafe {
                 DummyBox((*(stmt as *mut Statement)).query(&[]).unwrap())
             });
```

**File**: `connectorx/src/sources/sqlite/mod.rs` (modified, +3/-3)
```diff
@@ -4,6 +4,7 @@ mod errors;
 mod typesystem;
 
 pub use self::errors::SQLiteSourceError;
+use crate::utils::OwningHandle;
 use crate::{
     data_order::DataOrder,
     errors::ConnectorXError,
@@ -16,7 +17,6 @@ use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
 use fallible_streaming_iterator::FallibleStreamingIterator;
 use fehler::{throw, throws};
 use log::debug;
-use owning_ref::OwningHandle;
 use r2d2::{Pool, PooledConnection};
 use r2d2_sqlite::SqliteConnectionManager;
 use rusqlite::{Row, Rows, Statement};
@@ -260,7 +260,7 @@ unsafe impl<'a> Send for SQLiteSourcePartitionParser<'a> {}
 
 /// Row parser for a SQLite partition.
 pub struct SQLiteSourcePartitionParser<'a> {
-    rows: OwningHandle<Box<Statement<'a>>, DummyBox<Rows<'a>>>,
+    rows: OwningHandle<Statement<'a>, DummyBox<Rows<'a>>>,
     ncols: usize,
     current_col: usize,
     current_consumed: bool,
@@ -280,7 +280,7 @@ impl<'a> SQLiteSourcePartitionParser<'a> {
         // Safety: DummyBox borrows the on-heap stmt, which is owned by the OwningHandle.
         // No matter how we move the owning handle (thus the Box<Statment>), the Statement
         // keeps its address static on the heap, thus the borrow of MyRows keeps valid.
-        let rows: OwningHandle<Box<Statement<'a>>, DummyBox<Rows<'a>>> =
+        let rows: OwningHandle<Statement<'a>, DummyBox<Rows<'a>>> =
             OwningHandle::new_with_fn(Box::new(stmt), |stmt: *const Statement<'a>| unsafe {
                 DummyBox((*(stmt as *mut Statement<'_>)).query([]).unwrap())
             });
```

**File**: `connectorx/src/utils.rs` (modified, +112/-1)
```diff
@@ -1,4 +1,6 @@
+use std::mem::ManuallyDrop;
 use std::ops::{Deref, DerefMut};
+use std::ptr::NonNull;
 use url::{form_urlencoded, Url};
 
 /// Remove the given parameters from a URL query, leaving every other parameter
@@ -53,6 +55,71 @@ impl<T> DerefMut for DummyBox<T> {
     }
 }
 
+/// A heap-allocated owner together with a handle that borrows from it, such as a
+/// prepared statement and the row stream reading from it.
+///
+/// Replaces `owning_ref::OwningHandle` (RUSTSEC-2022-0040). That type keeps the
+/// owner in a `Box` while the handle borrows from it, which violates Rust's
+/// aliasing rules whenever the `Box` is moved. Here the owner is turned into a
+/// raw pointer with `Box::into_raw` for as long as the handle exists, so no
+/// `Box` claims unique access to it, and `Drop` frees the handle before the owner.
+///
+/// Like the original, it dereferences through the handle (`H::Target`).
+pub(crate) struct OwningHandle<O, H> {
+    handle: ManuallyDrop<H>,
+    owner: NonNull<O>,
+}
+
+impl<O, H> OwningHandle<O, H> {
+    /// Move `owner` to a stable heap address and build the handle from a pointer to it.
+    ///
+    /// `f` may turn the pointer into `&O` or `&mut O`; the owner stays alive, and
+    /// at the same address, until the returned value is dropped. If `f` panics, the
+    /// owner is leaked rather than freed.
+    pub(crate) fn new_with_fn<F>(owner: Box<O>, f: F) -> Self
+    where
+        F: FnOnce(*const O) -> H,
+    {
+        // SAFETY: `Box::into_raw` never returns null.
+        let owner = unsafe { NonNull::new_unchecked(Box::into_raw(owner)) };
+        let handle = f(owner.as_ptr());
+        Self {
+            handle: ManuallyDrop::new(handle),
+            owner,
+        }
+    }
+}
+
+impl<O, H: Deref> Deref for OwningHandle<O, H> {
+    type Target = H::Target;
+
+    fn deref(&self) -> &Self::Target {
+        &self.handle
+    }
+}
+
+impl<O, H: DerefMut> DerefMut for OwningHandle<O, H> {
+    fn deref_mut(&mut self) -> &mut Self::Target {
+        &mut self.handle
+    }
+}
+
+impl<O, H> Drop for OwningHandle<O, H> {
+    fn drop(&mut self) {
+        // SAFETY: the handle may borrow from the owner, so drop it first. `owner`
+        // came from `Box::into_raw` in `new_with_fn` and is freed exactly once, here.
+        unsafe {
+            ManuallyDrop::drop(&mut self.handle);
+            drop(Box::from_raw(self.owner.as_ptr()));
+        }
+    }
+}
+
+// SAFETY: the value owns both the owner and the handle outright, as
+// `(Box<O>, H)` would; `NonNull` only opts out of these impls by default.
+unsafe impl<O: Send, H: Send> Send for OwningHandle<O, H> {}
+unsafe impl<O: Sync, H: Sync> Sync for OwningHandle<O, H> {}
+
 #[cfg(feature = "dst_arrow")]
 pub fn decimal_to_i128(mut v: rust_decimal::Decimal, scale: u32) -> anyhow::Result<i128> {
     v.rescale(scale);
@@ -71,9 +138,53 @@ pub fn decimal_to_i128(mut v: rust_decimal::Decimal, scale: u32) -> anyhow::Resu
 
 #[cfg(test)]
 mod tests {
-    use super::remove_query_params;
+    use super::{remove_query_params, DummyBox, OwningHandle};
+    use std::cell::RefCell;
+    use std::rc::Rc;
     use url::Url;
 
+    /// Records its name in `log` when dropped.
+    struct Noisy {
+        name: &'static str,
+        log: Rc<RefCell<Vec<&'static str>>>,
+    }
+
+    impl Drop for Noisy {
+        fn drop(&mut self) {
+            self.log.borrow_mut().push(self.name);
+        }
+    }
+
+    #[test]
+    fn owning_handle_borrows_owner_across_moves() {
+        let owner = Box::new(vec![1, 2, 3]);
+        let handle =
+            OwningHandle::new_with_fn(owner, |v: *const Vec<i32>| unsafe { DummyBox((*v).iter()) });
+        // Moving the handle must not invalidate the borrow of the owner.
+        let mut moved = handle;
+        assert_eq!(moved.next(), Some(&1));
+        let mut moved_again = moved;
+        assert_eq!(moved_again.next(), Some(&2));
+    }
+
+    #[test]
+    fn owning_handle_drops_handle_before_owner() {
+        let log = Rc::new(RefCell::new(Vec::new()));
+        let owner = Box::new(Noisy {
+            name: "owner",
+            log: log.clone(),
+        });
+        let handle_log = log.clone();
+        let handle = OwningHandle::new_with_fn(owner, move |_| {
+            DummyBox(Noisy {
+                name: "handle",
+                log: handle_log,
+            })
+        });
+        drop(handle);
+        assert_eq!(*log.borrow(), ["handle", "owner"]);
+    }
+
     fn strip(uri: &str, params: &[&str]) -> String {
         remove_query_params(&Url::parse(uri).unwrap(), params).to_string()
     }
```

---

### Incident Patch 2: `afeac9ef` (2026-11-22)
**Commit Message**: build(python): bump mssql-tds to 0.4.0 in connectorx-python/Cargo.lock

connectorx-python has its own lockfile, so it has to follow the
connectorx bump.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `connectorx-python/Cargo.lock` (modified, +30/-5)
```diff
@@ -1129,6 +1129,15 @@ dependencies = [
  "hybrid-array",
 ]
 
+[[package]]
+name = "block2"
+version = "0.6.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cdeb9d870516001442e364c5220d3574d2da8dc765554b4a617230d33fa58ef5"
+dependencies = [
+ "objc2",
+]
+
 [[package]]
 name = "bnum"
 version = "0.13.0"
@@ -4516,13 +4525,14 @@ dependencies = [
 
 [[package]]
 name = "mssql-tds"
-version = "0.3.0"
+version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c7a53513324677e601ca5b91e477840329ec6c244875fd55b155e5a8e8af7805"
+checksum = "812c3993a5f6d98e14da9d8ab0bf9f9f536e49c18240f34af9bae301e4d35ae8"
 dependencies = [
  "async-trait",
  "bigdecimal 0.4.11",
  "bitflags 2.13.2",
+ "block2",
  "byteorder",
  "bytes",
  "core-foundation 0.10.1",
@@ -4792,6 +4802,15 @@ dependencies = [
  "rustc-hash 2.1.3",
 ]
 
+[[package]]
+name = "objc2"
+version = "0.6.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "08849bbd4767dfae9457696856ae1c84fe4e0281bbe4a7abff2d0e06fb7981f8"
+dependencies = [
+ "objc2-encode",
+]
+
 [[package]]
 name = "objc2-core-foundation"
 version = "0.3.2"
@@ -4801,6 +4820,12 @@ dependencies = [
  "bitflags 2.13.2",
 ]
 
+[[package]]
+name = "objc2-encode"
+version = "4.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ef25abbcd74fb2609453eb695bd2f860d389e457f67dc17cafc8b8cbc89d0c33"
+
 [[package]]
 name = "objc2-system-configuration"
 version = "0.3.2"
@@ -7114,7 +7139,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.4.3",
+ "getrandom 0.3.4",
  "once_cell",
  "rustix 1.1.6",
  "windows-sys 0.61.2",
@@ -7641,7 +7666,7 @@ version = "2.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "86a801b3cea342a06d468c8710662aa29e5e05e4f5c0d62f00bbb7f2ad7941c2"
 dependencies = [
- "rand 0.10.4",
+ "rand 0.9.5",
 ]
 
 [[package]]
@@ -7991,7 +8016,7 @@ version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.48.0",
 ]
 
 [[package]]
```

---

### Incident Patch 3: `1fc2ced4` (2026-11-22)
**Commit Message**: Merge remote-tracking branch 'upstream/main' into fix/remove-owning-ref

# Conflicts:
#	connectorx-python/Cargo.lock

**File**: `connectorx-python/Cargo.toml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ itertools = "0.15"
 lazy_static = "1.4"
 libc = "0.2"
 log = "0.4"
-ndarray = "0.16"
+ndarray = "0.17"
 numpy = {version = "0.29"}
 openssl = {version = "0.10", features = ["vendored"]}
 postgres = {version = "0.19", features = ["with-chrono-0_4", "with-uuid-1", "with-serde_json-1"]}
```

**File**: `connectorx-python/connectorx/tests/test_postgres.py` (modified, +3/-1)
```diff
@@ -1022,8 +1022,10 @@ def test_postgres_arrow_stream_invalid_url_raises() -> None:
     # An invalid sslmode fails while parsing the connection string, before any
     # network access, so this exercises the error path of new_record_batch_iter
     # without a database. Before the fix this surfaced as a PanicException.
+    # tokio-postgres >= 0.7.18 reports "invalid connection string" without
+    # naming the parameter, so accept either wording.
     bad_url = "postgresql://user:pass@127.0.0.1:1/db?sslmode=bogus"
-    with pytest.raises(RuntimeError, match="sslmode"):
+    with pytest.raises(RuntimeError, match="sslmode|invalid connection string"):
         read_sql(bad_url, "SELECT 1", return_type="arrow_stream")
 
 
```

**File**: `connectorx/src/partition.rs` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 use std::convert::TryFrom;
+#[cfg(feature = "src_clickhouse")]
 use std::sync::Arc;
 
 use crate::errors::{ConnectorXOutError, OutResult};
```

**File**: `connectorx/tests/test_db.rs` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+// Shared by every integration test binary via `mod test_db;`. Each binary only
+// uses the helpers for its own database, so the rest look unused per binary.
+#![allow(dead_code, unused_imports)]
+
 use std::{
     env, fs,
     net::{SocketAddr, TcpStream, ToSocketAddrs},
```

#### Recent Merged Pull Requests:
- **PR #1122** (2026-11-22): fix(build): target macOS 10.15 so mssql-tds 0.4 builds on Intel Macs (@tschm)
- **PR #1121** (2026-11-22): fix(rust): silence warnings in single-source connectorx builds (@tschm)
- **PR #1119** (2026-11-22): fix(rust): replace owning_ref with an internal OwningHandle (@tschm)
- **PR #1118** (2026-11-22): fix(rust): silence unused-code warnings in connectorx builds (@tschm)
- **PR #1115** (2026-11-22): build(rust): bump ndarray to 0.17 in connectorx-python (@tschm)
- **PR #1114** (closed): build(rust): update connectorx-python Cargo.lock (@tschm)

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
