# Forensic Learning Record (Deep Inspection): mlua-rs/mlua

> **Canonical Artifact**: `07_PROJECT_LEARNING/mlua-rs-mlua-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mlua-rs/mlua](https://github.com/mlua-rs/mlua))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:19.937Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mlua-rs/mlua`
- **Description**: High level Lua 5.5/5.4/5.3/5.2/5.1 (including LuaJIT) and Luau bindings to Rust with async/await support
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2887 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/benchmark.rs`
```
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use criterion::{BatchSize, Criterion, criterion_group, criterion_main};
use tokio::runtime::Runtime;
use tokio::task;

use mlua::prelude::*;

fn collect_gc_twice(lua: &Lua) {
    lua.gc_collect().unwrap();
    lua.gc_collect().unwrap();
}

fn table_create_empty(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create empty]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_table().unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_create_array(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create array]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_sequence_from(1..=10).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_create_hash(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [create hash]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_table_from(
                    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
                        .into_iter()
                        .map(|s| (s, s)),
                )
                .unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_get_set(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [get and set]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                lua.create_table().unwrap()
            },
            |table| {
                for (i, s) in ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
                    .into_iter()
                    .enumerate()
                {
                    table.raw_set(s, i).unwrap();
                    assert_eq!(table.raw_get::<usize>(s).unwrap(), i);
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_pairs(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [traversal pairs]", |b| {
        b.iter_batched(
            || lua.globals(),
            |globals| {
                for kv in globals.pairs::<String, LuaValue>() {
                    let (_k, _v) = kv.unwrap();
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_for_each(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("table [traversal for_each]", |b| {
        b.iter_batched(
            || lua.globals(),
            |globals| globals.for_each::<String, LuaValue>(|_k, _v| Ok(())),
            BatchSize::SmallInput,
        );
    });
}

fn table_traversal_sequence(c: &mut Criterion) {
    let lua = Lua::new();

    let table = lua.create_sequence_from(1..1000).unwrap();

    c.bench_function("table [traversal sequence]", |b| {
        b.iter_batched(
            || table.clone(),
            |table| {
                for v in table.sequence_values::<i32>() {
                    let _i = v.unwrap();
                }
            },
            BatchSize::SmallInput,
        );
    });
}

fn table_ref_clone(c: &mut Criterion) {
    let lua = Lua::new();

    let t = lua.create_table().unwrap();

    c.bench_function("table [ref clone]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                let _t2 = t.clone();
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_create(c: &mut Criterion) {
    let lua = Lua::new();

    c.bench_function("function [create Rust]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.create_function(|_, ()| Ok(123)).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_sum(c: &mut Criterion) {
    let lua = Lua::new();

    let sum = lua
        .create_function(|_, (a, b, c): (i64, i64, i64)| Ok(a + b - c))
        .unwrap();

    c.bench_function("function [call Rust sum]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(sum.call::<i64>((10, 20, 30)).unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_lua_sum(c: &mut Criterion) {
    let lua = Lua::new();

    let sum = lua
        .load("function(a, b, c) return a + b - c end")
        .eval::<LuaFunction>()
        .unwrap();

    c.bench_function("function [call Lua sum]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(sum.call::<i64>((10, 20, 30)).unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_concat(c: &mut Criterion) {
    let lua = Lua::new();

    let concat = lua
        .create_function(|_, (a, b): (LuaString, LuaString)| Ok(format!("{}{}", a.to_str()?, b.to_str()?)))
        .unwrap();
    let i = AtomicUsize::new(0);

    c.bench_function("function [call Rust concat string]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                i.fetch_add(1, Ordering::Relaxed)
            },
            |i| {
                assert_eq!(concat.call::<LuaString>(("num:", i)).unwrap(), format!("num:{i}"));
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_call_lua_concat(c: &mut Criterion) {
    let lua = Lua::new();

    let concat = lua
        .load("function(a, b) return a..b end")
        .eval::<LuaFunction>()
        .unwrap();
    let i = AtomicUsize::new(0);

    c.bench_function("function [call Lua concat string]", |b| {
        b.iter_batched(
            || {
                collect_gc_twice(&lua);
                i.fetch_add(1, Ordering::Relaxed)
            },
            |i| {
                assert_eq!(concat.call::<LuaString>(("num:", i)).unwrap(), format!("num:{i}"));
            },
            BatchSize::SmallInput,
        );
    });
}

fn function_async_call_sum(c: &mut Criterion) {
    let options = LuaOptions::new().thread_pool_size(1024);
    let lua = Lua::new_with(LuaStdLib::ALL_SAFE, options).unwrap();

    let sum = lua
        .create_async_function(|_, (a, b, c): (i64, i64, i64)| async move {
            task::yield_now().await;
            Ok(a + b - c)
        })
        .unwrap();

    c.bench_function("function [async call Rust sum]", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(rt).iter_batched(
            || collect_gc_twice(&lua),
            |_| async {
                assert_eq!(sum.call_async::<i64>((10, 20, 30)).await.unwrap(), 0);
            },
            BatchSize::SmallInput,
        );
    });
}

fn registry_value_create(c: &mut Criterion) {
    let lua = Lua::new();
    lua.gc_stop();

    c.bench_function("registry value [create]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| lua.create_registry_value("hello").unwrap(),
            BatchSize::SmallInput,
        );
    });
}

fn registry_value_get(c: &mut Criterion) {
    let lua = Lua::new();
    lua.gc_stop();

    let value = lua.create_registry_value("hello").unwrap();

    c.bench_function("registry value [get]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                assert_eq!(lua.registry_value::<LuaString>(&value).unwrap(), "hello");
            },
            BatchSize::SmallInput,
        );
    });
}

fn userdata_create(c: &mut Criterion) {
    struct UserData(#[allow(unused)] i64);
    impl LuaUserData for UserData {}

    let lua = Lua::new();

    c.bench_function("userdata [create]", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                lua.creat
```

### Core Architecture Module: `benches/serde.rs`
```
use std::collections::BTreeMap;
use std::time::Duration;

use criterion::{BatchSize, BenchmarkId, Criterion, criterion_group, criterion_main};

use mlua::prelude::*;

fn collect_gc_twice(lua: &Lua) {
    lua.gc_collect().unwrap();
    lua.gc_collect().unwrap();
}

fn encode_json(c: &mut Criterion) {
    let lua = Lua::new();

    let encode = lua
        .create_function(|_, t: LuaValue| Ok(serde_json::to_string(&t).unwrap()))
        .unwrap();
    let table = lua
        .load(
            r#"{
        name = "Clark Kent",
        address = {
            city = "Smallville",
            state = "Kansas",
            country = "USA",
        },
        age = 22,
        parents = {"Jonathan Kent", "Martha Kent"},
        superman = true,
        interests = {"flying", "saving the world", "kryptonite"},
    }"#,
        )
        .eval::<LuaTable>()
        .unwrap();

    c.bench_function("serialize json", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                encode.call::<LuaString>(&table).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn decode_json(c: &mut Criterion) {
    let lua = Lua::new();

    let decode = lua
        .create_function(|lua, s: String| {
            lua.to_value(&serde_json::from_str::<serde_json::Value>(&s).unwrap())
        })
        .unwrap();
    let json = r#"{
        "name": "Clark Kent",
        "address": {
            "city": "Smallville",
            "state": "Kansas",
            "country": "USA"
        },
        "age": 22,
        "parents": ["Jonathan Kent", "Martha Kent"],
        "superman": true,
        "interests": ["flying", "saving the world", "kryptonite"]
    }"#;

    c.bench_function("deserialize json", |b| {
        b.iter_batched(
            || collect_gc_twice(&lua),
            |_| {
                decode.call::<LuaTable>(json).unwrap();
            },
            BatchSize::SmallInput,
        );
    });
}

fn sorted_map_traversal(c: &mut Criterion) {
    let lua = Lua::new();
    let mut group = c.benchmark_group("sorted map traversal");
    for size in [0, 1, 2, 3, 4, 7, 8, 64, 4096] {
        let table = lua
            .create_table_from((0..size).map(|i| (format!("key_{i:08}"), i)))
            .unwrap();
        let value = LuaValue::Table(table);
        group.bench_function(BenchmarkId::new("serialize", size), |b| {
            b.iter(|| serde_json::to_string(&value.to_serializable().sort_keys(true)).unwrap());
        });
        group.bench_function(BenchmarkId::new("from_value", size), |b| {
            b.iter(|| {
                lua.from_value_with::<BTreeMap<String, i64>>(
                    value.clone(),
                    LuaDeserializeOptions::new().sort_keys(true),
                )
                .unwrap()
            });
        });
    }
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(500)
        .measurement_time(Duration::from_secs(10))
        .noise_threshold(0.02);
    targets =
        encode_json,
        decode_json,
        sorted_map_traversal,
}

criterion_main!(benches);

```

### Core Architecture Module: `examples/async_http_client.rs`
```
use std::collections::HashMap;

use http_body_util::BodyExt as _;
use hyper::body::Incoming;
use hyper_util::client::legacy::Client as HyperClient;
use hyper_util::rt::TokioExecutor;

use mlua::{ExternalResult, Lua, Result, UserData, UserDataMethods, chunk};

struct BodyReader(Incoming);

impl UserData for BodyReader {
    fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
        // Every call returns a next chunk
        methods.add_async_method_mut("read", |lua, mut reader, ()| async move {
            if let Some(bytes) = reader.0.frame().await
                && let Some(bytes) = bytes.into_lua_err()?.data_ref()
            {
                return Some(lua.create_string(bytes)).transpose();
            }
            Ok(None)
        });
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let lua = Lua::new();

    let fetch_url = lua.create_async_function(|lua, uri: String| async move {
        let client = HyperClient::builder(TokioExecutor::new()).build_http::<String>();
        let uri = uri.parse().into_lua_err()?;
        let resp = client.get(uri).await.into_lua_err()?;

        let lua_resp = lua.create_table()?;
        lua_resp.set("status", resp.status().as_u16())?;

        let mut headers = HashMap::new();
        for (key, value) in resp.headers() {
            headers
                .entry(key.as_str())
                .or_insert(Vec::new())
                .push(value.to_str().into_lua_err()?);
        }

        lua_resp.set("headers", headers)?;
        lua_resp.set("body", BodyReader(resp.into_body()))?;

        Ok(lua_resp)
    })?;

    let f = lua
        .load(chunk! {
            local res = $fetch_url(...)
            print("status: "..res.status)
            for key, vals in pairs(res.headers) do
                for _, val in ipairs(vals) do
                    print(key..": "..val)
                end
            end
            repeat
                local chunk = res.body:read()
                if chunk then
                    print(chunk)
                end
            until not chunk
        })
        .into_function()?;

    f.call_async("http://httpbin.org/ip").await
}

```

### Core Architecture Module: `examples/async_http_reqwest.rs`
```
use mlua::{ExternalResult, Lua, LuaSerdeExt, Result, Value, chunk};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let lua = Lua::new();

    let fetch_json = lua.create_async_function(|lua, uri: String| async move {
        let resp = reqwest::get(&uri)
            .await
            .and_then(|resp| resp.error_for_status())
            .into_lua_err()?;
        let json = resp.json::<serde_json::Value>().await.into_lua_err()?;
        lua.to_value(&json)
    })?;

    let dbg = lua.create_function(|_, value: Value| {
        println!("{value:#?}");
        Ok(())
    })?;

    let f = lua
        .load(chunk! {
            local res = $fetch_json(...)
            $dbg(res)
        })
        .into_function()?;

    f.call_async("https://httpbin.org/anything?arg0=val0").await
}

```

### Core Architecture Module: `examples/async_http_server.rs`
```
use std::convert::Infallible;
use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;

use http_body_util::combinators::BoxBody;
use http_body_util::{BodyExt as _, Empty, Full};
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;

use mlua::{Error as LuaError, Function, Lua, LuaString, Table, UserData, UserDataMethods, chunk};

/// Wrapper around incoming request that implements UserData
struct LuaRequest(SocketAddr, Request<Incoming>);

impl UserData for LuaRequest {
    fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
        methods.add_method("remote_addr", |_, req, ()| Ok((req.0).to_string()));
        methods.add_method("method", |_, req, ()| Ok((req.1).method().to_string()));
        methods.add_method("path", |_, req, ()| Ok(req.1.uri().path().to_string()));
    }
}

/// Service that handles incoming requests
#[derive(Clone)]
pub struct Svc {
    handler: Function,
    peer_addr: SocketAddr,
}

impl Svc {
    pub fn new(handler: Function, peer_addr: SocketAddr) -> Self {
        Self { handler, peer_addr }
    }
}

impl hyper::service::Service<Request<Incoming>> for Svc {
    type Response = Response<BoxBody<Bytes, Infallible>>;
    type Error = LuaError;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn call(&self, req: Request<Incoming>) -> Self::Future {
        // If handler returns an error then generate 5xx response
        let handler = self.handler.clone();
        let lua_req = LuaRequest(self.peer_addr, req);
        Box::pin(async move {
            match handler.call_async::<Table>(lua_req).await {
                Ok(lua_resp) => {
                    let status = lua_resp.get::<Option<u16>>("status")?.unwrap_or(200);
                    let mut resp = Response::builder().status(status);

                    // Set headers
                    if let Some(headers) = lua_resp.get::<Option<Table>>("headers")? {
                        for pair in headers.pairs::<String, LuaString>() {
                            let (h, v) = pair?;
                            resp = resp.header(&h, &*v.as_bytes());
                        }
                    }

                    // Set body
                    let body = lua_resp
                        .get::<Option<LuaString>>("body")?
                        .map(|b| Full::new(Bytes::copy_from_slice(&b.as_bytes())).boxed())
                        .unwrap_or_else(|| Empty::<Bytes>::new().boxed());

                    Ok(resp.body(body).unwrap())
                }
                Err(err) => {
                    eprintln!("{}", err);
                    Ok(Response::builder()
                        .status(500)
                        .body(Full::new(Bytes::from("Internal Server Error")).boxed())
                        .unwrap())
                }
            }
        })
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let lua = Lua::new();

    // Create Lua handler function
    let handler = lua
        .load(chunk! {
            function(req)
                return {
                    status = 200,
                    headers = {
                        ["X-Req-Method"] = req:method(),
                        ["X-Req-Path"] = req:path(),
                        ["X-Remote-Addr"] = req:remote_addr(),
                    },
                    body = "Hello from Lua!\n"
                }
            end
        })
        .eval::<Function>()
        .expect("Failed to create Lua handler");

    let listen_addr = "127.0.0.1:3000";
    let listener = TcpListener::bind(listen_addr).await.unwrap();
    println!("Listening on http://{listen_addr}");

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(x) => x,
            Err(err) => {
                eprintln!("Failed to accept connection: {err}");
                continue;
            }
        };

        let svc = Svc::new(handler.clone(), peer_addr);
        tokio::task::spawn(async move {
            if let Err(err) = http1::Builder::new()
                .serve_connection(TokioIo::new(stream), svc)
                .await
            {
                eprintln!("Error serving connection: {:?}", err);
            }
        });
    }
}

```

### Core Architecture Module: `examples/async_tcp_server.rs`
```
use std::io;
use std::net::SocketAddr;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use mlua::{BString, Function, Lua, UserData, UserDataMethods, chunk};

struct LuaTcpStream(TcpStream);

impl UserData for LuaTcpStream {
    fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
        methods.add_method("peer_addr", |_, this, ()| Ok(this.0.peer_addr()?.to_string()));

        methods.add_async_method_mut("read", |lua, mut this, size| async move {
            let mut buf = vec![0; size];
            let n = this.0.read(&mut buf).await?;
            buf.truncate(n);
            lua.create_string(&buf)
        });

        methods.add_async_method_mut("write", |_, mut this, data: BString| async move {
            let n = this.0.write(&data).await?;
            Ok(n)
        });

        methods.add_async_method_mut("close", |_, mut this, ()| async move {
            this.0.shutdown().await?;
            Ok(())
        });
    }
}

async fn run_server(handler: Function) -> io::Result<()> {
    let addr: SocketAddr = ([127, 0, 0, 1], 3000).into();
    let listener = TcpListener::bind(addr).await.expect("cannot bind addr");

    println!("Listening on {}", addr);

    loop {
        let (stream, _) = match listener.accept().await {
            Ok(res) => res,
            Err(err) if is_transient_error(&err) => continue,
            Err(err) => return Err(err),
        };

        let handler = handler.clone();
        tokio::task::spawn(async move {
            let stream = LuaTcpStream(stream);
            if let Err(err) = handler.call_async::<()>(stream).await {
                eprintln!("{}", err);
            }
        });
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let lua = Lua::new();

    // Create Lua handler function
    let handler = lua
        .load(chunk! {
            function(stream)
                local peer_addr = stream:peer_addr()
                print("connected from "..peer_addr)

                while true do
                    local data = stream:read(100)
                    data = data:match("^%s*(.-)%s*$") // trim
                    print("["..peer_addr.."] "..data)
                    if data == "bye" then
                        stream:write("bye bye\n")
                        stream:close()
                        return
                    end
                    stream:write("echo: "..data.."\n")
                end
            end
        })
        .eval::<Function>()
        .expect("cannot create Lua handler");

    run_server(handler).await.expect("cannot run server")
}

fn is_transient_error(e: &io::Error) -> bool {
    e.kind() == io::ErrorKind::ConnectionRefused
        || e.kind() == io::ErrorKind::ConnectionAborted
        || e.kind() == io::ErrorKind::ConnectionReset
}

```

### Core Architecture Module: `examples/guided_tour.rs`
```
use std::iter::FromIterator;

use mlua::{FromLua, Function, Lua, MetaMethod, Result, UserData, UserDataMethods, Value, Variadic, chunk};

fn main() -> Result<()> {
    // You can create a new Lua state with `Lua::new()`. This loads the default Lua std library
    // *without* the debug library.
    let lua = Lua::new();

    // You can get and set global variables. Notice that the globals table here is a permanent
    // reference to _G, and it is mutated behind the scenes as Lua code is loaded. This API is
    // based heavily around sharing and internal mutation (just like Lua itself).

    let globals = lua.globals();

    globals.set("string_var", "hello")?;
    globals.set("int_var", 42)?;

    assert_eq!(globals.get::<String>("string_var")?, "hello");
    assert_eq!(globals.get::<i64>("int_var")?, 42);

    // You can load and evaluate Lua code. The returned type of `Lua::load` is a builder
    // that allows you to change settings before running Lua code. Here, we are using it to set
    // the name of the loaded chunk to "example code", which will be used when Lua error
    // messages are printed.

    lua.load(
        r#"
            global = 'foo'..'bar'
        "#,
    )
    .set_name("example code")
    .exec()?;
    assert_eq!(globals.get::<String>("global")?, "foobar");

    assert_eq!(lua.load("1 + 1").eval::<i32>()?, 2);
    assert!(lua.load("false == false").eval::<bool>()?);
    assert_eq!(lua.load("return 1 + 2").eval::<i32>()?, 3);

    // Use can use special `chunk!` macro to use Rust tokenizer and automatically capture variables

    let a = 1;
    let b = 2;
    let name = "world";
    lua.load(chunk! {
        print($a + $b)
        print("hello, " .. $name)
    })
    .exec()?;

    // You can create and manage Lua tables

    let array_table = lua.create_table()?;
    array_table.set(1, "one")?;
    array_table.set(2, "two")?;
    array_table.set(3, "three")?;
    assert_eq!(array_table.len()?, 3);

    let map_table = lua.create_table()?;
    map_table.set("one", 1)?;
    map_table.set("two", 2)?;
    map_table.set("three", 3)?;
    let v: i64 = map_table.get("two")?;
    assert_eq!(v, 2);

    // You can pass values like `Table` back into Lua

    globals.set("array_table", array_table)?;
    globals.set("map_table", map_table)?;

    lua.load(
        r#"
            for k, v in pairs(array_table) do
                print(k, v)
            end

            for k, v in pairs(map_table) do
                print(k, v)
            end
        "#,
    )
    .exec()?;

    // You can load Lua functions

    let print: Function = globals.get("print")?;
    print.call::<()>("hello from rust")?;

    // This API generally handles variadic using tuples. This is one way to call a function with
    // multiple parameters:

    print.call::<()>(("hello", "again", "from", "rust"))?;

    // But, you can also pass variadic arguments with the `Variadic` type.

    print.call::<()>(Variadic::from_iter(
        ["hello", "yet", "again", "from", "rust"].iter().cloned(),
    ))?;

    // You can bind rust functions to Lua as well. Callbacks receive the Lua state itself as their
    // first parameter, and the arguments given to the function as the second parameter. The type
    // of the arguments can be anything that is convertible from the parameters given by Lua, in
    // this case, the function expects two string sequences.

    let check_equal = lua.create_function(|_, (list1, list2): (Vec<String>, Vec<String>)| {
        // This function just checks whether two string lists are equal, and in an inefficient way.
        // Lua callbacks return `mlua::Result`, an Ok value is a normal return, and an Err return
        // turns into a Lua 'error'. Again, any type that is convertible to Lua may be returned.
        Ok(list1 == list2)
    })?;
    globals.set("check_equal", check_equal)?;

    // You can also accept runtime variadic arguments to rust callbacks.

    let join = lua.create_function(|_, strings: Variadic<String>| {
        // (This is quadratic!, it's just an example!)
        Ok(strings.iter().fold("".to_owned(), |a, b| a + b))
    })?;
    globals.set("join", join)?;

    assert!(
        lua.load(r#"check_equal({"a", "b", "c"}, {"a", "b", "c"})"#)
            .eval::<bool>()?
    );
    assert!(
        !lua.load(r#"check_equal({"a", "b", "c"}, {"d", "e", "f"})"#)
            .eval::<bool>()?
    );
    assert_eq!(lua.load(r#"join("a", "b", "c")"#).eval::<String>()?, "abc");

    // Callbacks receive a Lua state as their first parameter so that they can use it to
    // create new Lua values, if necessary.

    let create_table = lua.create_function(|lua, ()| {
        let t = lua.create_table()?;
        t.set(1, 1)?;
        t.set(2, 2)?;
        Ok(t)
    })?;
    globals.set("create_table", create_table)?;

    assert_eq!(lua.load(r#"create_table()[2]"#).eval::<i32>()?, 2);

    // You can create userdata with methods and metamethods defined on them.
    // Here's a worked example that shows many of the features of this API
    // together

    #[derive(Copy, Clone)]
    struct Vec2(f32, f32);

    // We can implement `FromLua` trait for our `Vec2` to return a copy
    impl FromLua for Vec2 {
        fn from_lua(value: Value, _: &Lua) -> Result<Self> {
            match value {
                Value::UserData(ud) => Ok(*ud.borrow::<Self>()?),
                _ => unreachable!(),
            }
        }
    }

    impl UserData for Vec2 {
        fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
            methods.add_method("magnitude", |_, vec, ()| {
                let mag_squared = vec.0 * vec.0 + vec.1 * vec.1;
                Ok(mag_squared.sqrt())
            });

            methods.add_meta_function(MetaMethod::Add, |_, (vec1, vec2): (Vec2, Vec2)| {
                Ok(Vec2(vec1.0 + vec2.0, vec1.1 + vec2.1))
            });
        }
    }

    let vec2_constructor = lua.create_function(|_, (x, y): (f32, f32)| Ok(Vec2(x, y)))?;
    globals.set("vec2", vec2_constructor)?;

    assert!((lua.load("(vec2(1, 2) + vec2(2, 2)):magnitude()").eval::<f32>()? - 5.0).abs() < f32::EPSILON);

    // Normally, Rust types passed to `Lua` must be `'static`, because there is no way to be
    // sure of their lifetime inside the Lua state. There is, however, a limited way to lift this
    // requirement. You can call `Lua::scope` to create userdata and callbacks types that only live
    // for as long as the call to scope, but do not have to be `'static` (and `Send`).

    // TODO: Re-enable this
    /*
    {
        let mut rust_val = 0;

        lua.scope(|scope| {
            // We create a 'sketchy' Lua callback that holds a mutable reference to the variable
            // `rust_val`. Outside of a `Lua::scope` call, this would not be allowed
            // because it could be unsafe.

            lua.globals().set(
                "sketchy",
                scope.create_function_mut(|_, ()| {
                    rust_val = 42;
                    Ok(())
                })?,
            )?;

            lua.load("sketchy()").exec()
        })?;

        assert_eq!(rust_val, 42);
    }
    */

    // We were able to run our 'sketchy' function inside the scope just fine. However, if we
    // try to run our 'sketchy' function outside of the scope, the function we created will have
    // been invalidated and we will generate an error. If our function wasn't invalidated, we
    // might be able to improperly access the freed `rust_val` which would be unsafe.
    assert!(lua.load("sketchy()").exec().is_err());

    Ok(())
}

```

### Core Architecture Module: `examples/module/src/lib.rs`
```
use mlua::prelude::*;

fn sum(_: &Lua, (a, b): (i64, i64)) -> LuaResult<i64> {
    Ok(a + b)
}

fn used_memory(lua: &Lua, _: ()) -> LuaResult<usize> {
    Ok(lua.used_memory())
}

#[mlua::lua_module]
fn rust_module(lua: &Lua) -> LuaResult<LuaTable> {
    let exports = lua.create_table()?;
    exports.set("sum", lua.create_function(sum)?)?;
    exports.set("used_memory", lua.create_function(used_memory)?)?;
    Ok(exports)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #416** (2024-06-13): **Limiting script execution time (a question and a bug report)**
  *Symptoms*: First off, thank you for creating and maintaining this wonderful crate!  I'm trying to limit the time a script executes, and what I found to be potentially the most effective way was to set a hook that will reset the thread if the execution time is too long (I would be more than happy to hear about better ways to achieve that).  While experimenting with that, I hit an internal bug that needed to be reported.  Here's hopefully the shortest repro for it:  ```toml [dependencies] mlua = { version = "0.9.8", features = ["lua54", "vendored"] } ```  ```rust use mlua::*;  fn main() {     limit_function_execution_time(); }  fn limit_function_execution_time() {     let lua = Lua::new();     let run_forever: Function = lua         .load(             r#"             function ()                 while true do                     x = 10                 end             end             "#,         )         .eval()         .unwrap();      let thread = lua.create_thread(run_forever).unwrap();     let start = std::time::SystemTime::now();      thread.set_hook(         HookTriggers::default().every_nth_instruction(100000),         move |lua, _debug| {             let do_nothing: Function = lua                 .load(                     r#"                     function ()                         print("doing nothing")                     end                 "#,                 )                 .eval()                 .unwrap();              let
  **Post-Mortem & Fix Analysis**:
  > Thank you for the bug report! It was a bug in mlua and users are not allowed to reset running coroutines (it's not supported by Lua itself).  Answering your question. To stop executing Lua script you can simply return a error from the hook and coroutine will finish immediately with the returned error. 
  > Thanks. This is working perfectly.

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

### Incident Patch 1: `90ae20e0` (2026-09-27)
**Commit Message**: Fix tests

**File**: `tests/memory.rs` (modified, +1/-4)
```diff
@@ -37,10 +37,7 @@ fn test_memory_limit() -> Result<()> {
 
     // Test memory limit during chunk loading
     lua.set_memory_limit(1024)?;
-    match lua
-        .load("local t = {}; for i = 1,10000 do t[i] = i end")
-        .into_function()
-    {
+    match lua.load(format!("return '{}'", "x".repeat(4096))).into_function() {
         Err(Error::MemoryError(_)) => {}
         _ => panic!("did not trigger memory error"),
     };
```

---

### Incident Patch 2: `d5d82352` (2026-09-27)
**Commit Message**: mlua-sys: Fix luau-codegen feature flag usage

**File**: `mlua-sys/src/luau/mod.rs` (modified, +3/-0)
```diff
@@ -4,6 +4,7 @@ pub use compat::*;
 pub use lauxlib::*;
 pub use lua::*;
 pub use luacode::*;
+#[cfg(any(feature = "luau-codegen", doc))]
 pub use luacodegen::*;
 pub use lualib::*;
 pub use luarequire::*;
@@ -12,6 +13,8 @@ pub mod compat;
 pub mod lauxlib;
 pub mod lua;
 pub mod luacode;
+#[cfg(any(feature = "luau-codegen", doc))]
+#[cfg_attr(docsrs, doc(cfg(feature = "luau-codegen")))]
 pub mod luacodegen;
 pub mod lualib;
 pub mod luarequire;
```

---

### Incident Patch 3: `0225a351` (2026-09-27)
**Commit Message**: Fix stale userdata metatable registration on re-registration

**File**: `src/state.rs` (modified, +10/-2)
```diff
@@ -1680,16 +1680,24 @@ impl Lua {
     /// Registers a custom Rust type in Lua to use in userdata objects.
     ///
     /// This methods provides a way to add fields or methods to userdata objects of a type `T`.
+    /// Re-registering a type invalidates existing userdata instances of that type.
     pub fn register_userdata_type<T: 'static>(&self, f: impl FnOnce(&mut UserDataRegistry<T>)) -> Result<()> {
         let type_id = TypeId::of::<T>();
         let mut registry = UserDataRegistry::new(self);
         f(&mut registry);
 
         let lua = self.lock();
         unsafe {
-            // Deregister the type if it already registered
+            let state = lua.state();
+            let _sg = StackGuard::new(state);
+            check_stack(state, 1)?;
+
+            // Deregister the old metatable before releasing its registry reference.
             if let Some(table_id) = (*lua.extra.get()).registered_userdata_t.remove(&type_id) {
-                ffi::luaL_unref(lua.state(), ffi::LUA_REGISTRYINDEX, table_id);
+                ffi::lua_rawgeti(state, ffi::LUA_REGISTRYINDEX, table_id as _);
+                lua.deregister_userdata_metatable(ffi::lua_topointer(state, -1));
+                ffi::lua_pop(state, 1);
+                ffi::luaL_unref(state, ffi::LUA_REGISTRYINDEX, table_id);
             }
 
             // Add to "pending" registration map
```

**File**: `tests/userdata.rs` (modified, +9/-1)
```diff
@@ -930,8 +930,16 @@ fn test_any_userdata() -> Result<()> {
 #[test]
 fn test_userdata_reregister_type() -> Result<()> {
     let lua = Lua::new();
-    assert!(lua.create_any_userdata(0u32)?.is::<u32>());
+    let old = lua.create_any_userdata(0u32)?;
+    assert!(old.is::<u32>());
     lua.register_userdata_type::<u32>(|_| {})?;
+    assert!(!old.is::<u32>());
+    assert!(matches!(old.borrow::<u32>(), Err(Error::UserDataTypeMismatch)));
+
+    let new = lua.create_any_userdata(1u32)?;
+    assert_eq!(*new.borrow::<u32>()?, 1);
+    assert!(!old.is::<u32>());
+    drop(old);
     lua.gc_collect()?;
     lua.gc_collect()?;
     // Metatable address of `u32` can be reused for `i32`
```

---

### Incident Patch 4: `60a4d504` (2026-09-27)
**Commit Message**: Fix `__call` in examples/userdata.rs

Close #737

**File**: `examples/userdata.rs` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-use mlua::{Lua, Result, UserData, chunk};
+use mlua::{AnyUserData, Lua, Result, UserData, chunk};
 
 #[derive(Default, UserData)]
 struct Rectangle {
@@ -26,7 +26,7 @@ impl Rectangle {
 
     // Constructor via `__call` metamethod
     #[lua(meta, infallible)]
-    fn __call(length: u32, width: u32) -> Self {
+    fn __call(_: AnyUserData, length: u32, width: u32) -> Self {
         Rectangle::new(length, width)
     }
 }
```

---

### Incident Patch 5: `ae3cfaa5` (2026-09-27)
**Commit Message**: mlua-sys: Fix Lua 5.2 `luaL_len` declaration

**File**: `mlua-sys/src/lua52/lauxlib.rs` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ unsafe extern "C-unwind" {
 
     pub fn luaL_newstate() -> *mut lua_State;
 
-    pub fn luaL_len(L: *mut lua_State, idx: c_int) -> lua_Integer;
+    pub fn luaL_len(L: *mut lua_State, idx: c_int) -> c_int;
 
     pub fn luaL_gsub(
         L: *mut lua_State,
```

**File**: `src/table.rs` (modified, +1/-1)
```diff
@@ -658,7 +658,7 @@ impl Table {
             check_stack(state, 4)?;
 
             lua.push_ref(&self.0);
-            protect_lua!(state, 1, 0, |state| ffi::luaL_len(state, -1))
+            protect_lua!(state, 1, 0, |state| ffi::luaL_len(state, -1) as Integer)
         }
     }
 
```

---

### Incident Patch 6: `b2bdc456` (2026-09-27)
**Commit Message**: Fix HashSet/BTreeSet integer round trip conversion

**File**: `src/conversion.rs` (modified, +10/-2)
```diff
@@ -1034,7 +1034,11 @@ impl<T: Eq + Hash + FromLua, S: BuildHasher + Default> FromLua for HashSet<T, S>
     #[inline]
     fn from_lua(value: Value, _: &Lua) -> Result<Self> {
         match value {
-            Value::Table(table) if table.raw_len() > 0 => table.sequence_values().collect(),
+            Value::Table(table)
+                if table.raw_len() > 0 && !matches!(table.raw_get(1)?, Value::Boolean(true)) =>
+            {
+                table.sequence_values().collect()
+            }
             Value::Table(table) => table.pairs::<T, Value>().map(|res| res.map(|(k, _)| k)).collect(),
             _ => Err(Error::from_lua_conversion(
                 value.type_name(),
@@ -1058,7 +1062,11 @@ impl<T: Ord + FromLua> FromLua for BTreeSet<T> {
     #[inline]
     fn from_lua(value: Value, _: &Lua) -> Result<Self> {
         match value {
-            Value::Table(table) if table.raw_len() > 0 => table.sequence_values().collect(),
+            Value::Table(table)
+                if table.raw_len() > 0 && !matches!(table.raw_get(1)?, Value::Boolean(true)) =>
+            {
+                table.sequence_values().collect()
+            }
             Value::Table(table) => table.pairs::<T, Value>().map(|res| res.map(|(k, _)| k)).collect(),
             _ => Err(Error::from_lua_conversion(
                 value.type_name(),
```

**File**: `tests/conversion.rs` (modified, +8/-0)
```diff
@@ -439,6 +439,10 @@ fn test_conv_hashset() -> Result<()> {
     let set3 = lua.load(r#"{"a", "b", "c"}"#).eval::<HashSet<String>>()?;
     assert_eq!(set3, hashset! { "a".into(), "b".into(), "c".into() });
 
+    let set = hashset! {1, 2, 3};
+    assert_eq!(lua.unpack::<HashSet<i32>>(set.clone().into_lua(&lua)?)?, set);
+    assert_eq!(lua.load("{1, 2, 3}").eval::<HashSet<i32>>()?, set);
+
     Ok(())
 }
 
@@ -466,6 +470,10 @@ fn test_conv_btreeset() -> Result<()> {
     let set3 = lua.load(r#"{"a", "b", "c"}"#).eval::<BTreeSet<String>>()?;
     assert_eq!(set3, btreeset! { "a".into(), "b".into(), "c".into() });
 
+    let set = btreeset! {1, 2, 3};
+    assert_eq!(lua.unpack::<BTreeSet<i32>>(set.clone().into_lua(&lua)?)?, set);
+    assert_eq!(lua.load("{1, 2, 3}").eval::<BTreeSet<i32>>()?, set);
+
     Ok(())
 }
 
```

---

### Incident Patch 7: `0adc5387` (2026-09-20)
**Commit Message**: Fix Luau require from chunks loaded by path

Fixes #735

**File**: `src/luau/require/fs.rs` (modified, +12/-12)
```diff
@@ -137,20 +137,20 @@ impl Require for FsRequirer {
             return Ok(());
         }
 
-        if chunk_path.is_absolute() {
-            let resolved_path = Self::resolve_module(&chunk_path)?;
-            self.abs_path = chunk_path.clone();
-            self.rel_path = chunk_path;
-            self.resolved_path = resolved_path;
+        let abs_path = if chunk_path.is_absolute() {
+            chunk_path.clone()
         } else {
-            // Relative path
             let cwd = env::current_dir().map_err(|_| NavigateError::NotFound)?;
-            let abs_path = Self::normalize_path(&cwd.join(&chunk_path));
-            let resolved_path = Self::resolve_module(&abs_path)?;
-            self.abs_path = abs_path;
-            self.rel_path = chunk_path;
-            self.resolved_path = resolved_path;
-        }
+            Self::normalize_path(&cwd.join(&chunk_path))
+        };
+        // Chunks loaded by path include the file extension, unlike module names.
+        let resolved_path = match Self::resolve_module(&abs_path) {
+            Err(NavigateError::NotFound) if abs_path.is_file() => Some(abs_path.clone()),
+            result => result?,
+        };
+        self.abs_path = abs_path;
+        self.rel_path = chunk_path;
+        self.resolved_path = resolved_path;
 
         Ok(())
     }
```

**File**: `tests/luau/require.rs` (modified, +23/-0)
```diff
@@ -1,4 +1,6 @@
+use std::fs;
 use std::io::Result as IoResult;
+use std::path::Path;
 use std::result::Result as StdResult;
 use std::sync::Arc;
 
@@ -144,6 +146,27 @@ fn test_require_errors() {
     assert_eq!(Arc::strong_count(&alive), 1);
 }
 
+#[test]
+fn test_require_from_path() -> Result<()> {
+    let dir = tempfile::tempdir_in(".").unwrap();
+    // Resetting a required module must not pick an unrelated extensionless file.
+    fs::write(dir.path().join("dependency"), "return 99").unwrap();
+    fs::write(
+        dir.path().join("dependency.luau"),
+        "if not loaded then loaded = true; return require('@self') end; return 42",
+    )
+    .unwrap();
+    for name in ["main.luau", "main.lua", "init.luau"] {
+        let path = Path::new(dir.path().file_name().unwrap()).join(name);
+        fs::write(&path, "return require('./dependency')").unwrap();
+        for path in [path.clone(), path.canonicalize().unwrap()] {
+            let lua = Lua::new();
+            assert_eq!(lua.load(path.as_path()).eval::<i32>()?, 42);
+        }
+    }
+    Ok(())
+}
+
 #[test]
 fn test_require_without_config() {
     let lua = Lua::new();
```

---

### Incident Patch 8: `ed93064a` (2026-09-19)
**Commit Message**: Fix tests

**File**: `tests/luau.rs` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ fn test_sandbox() -> Result<()> {
         let err = collectgarbage.call::<()>(arg).err().unwrap().to_string();
         assert!(err.contains("collectgarbage called with invalid option"));
     }
-    assert!(collectgarbage.call::<u64>("count").unwrap() > 0);
+    assert!(collectgarbage.call::<f64>("count").unwrap() > 0.0);
 
     lua.sandbox(false)?;
 
```

---

### Incident Patch 9: `3c46015d` (2026-09-14)
**Commit Message**: Fix raw identifiers and callback types in derive macros

**File**: `mlua_derive/src/module.rs` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 use proc_macro::TokenStream;
-use proc_macro2::{Ident, Span};
-use quote::quote;
+use proc_macro2::Ident;
+use quote::{format_ident, quote};
 use syn::meta::ParseNestedMeta;
 use syn::{ItemFn, LitStr, Result, parse_macro_input};
 
@@ -43,7 +43,7 @@ pub fn lua_module(attr: TokenStream, item: TokenStream) -> TokenStream {
     let func = parse_macro_input!(item as ItemFn);
     let func_name = &func.sig.ident;
     let module_name = args.name.unwrap_or_else(|| func_name.clone());
-    let ext_entrypoint_name = Ident::new(&format!("luaopen_{module_name}"), Span::call_site());
+    let ext_entrypoint_name = format_ident!("luaopen_{}", module_name);
     let skip_memory_check = if args.skip_memory_check {
         quote! { lua.skip_memory_check(true); }
     } else {
```

**File**: `mlua_derive/src/userdata/mod.rs` (modified, +2/-2)
```diff
@@ -131,9 +131,9 @@ pub fn userdata_type(item: TokenStream) -> TokenStream {
         }
     }
 
-    let registration_type_name = format_ident!("__MluaUserDataRegistration_{type_name}");
+    let registration_type_name = format_ident!("__MluaUserDataRegistration_{}", type_name);
     let registration_fn_name = format_ident!("__mlua_userdata_registration");
-    let register_fields_fn_name = format_ident!("__mlua_register_{type_name}_fields");
+    let register_fields_fn_name = format_ident!("__mlua_register_{}_fields", type_name);
 
     let output = quote! {
         #[doc(hidden)]
```

**File**: `mlua_derive/src/userdata/userdata_impl.rs` (modified, +21/-22)
```diff
@@ -143,6 +143,12 @@ fn try_unwrap_option(ty: &Type) -> Option<&Type> {
 /// Determine `self` kind and collect the callback arguments.
 /// Auto-detects `Lua` (owned or reference) as the first non-self parameter.
 fn analyze_self_and_args(sig: &Signature) -> syn::Result<MethodInfo> {
+    if !sig.generics.params.is_empty() {
+        return Err(syn::Error::new_spanned(
+            &sig.generics,
+            "`#[mlua::userdata_impl]` does not support generic methods.",
+        ));
+    }
     let mut self_kind = SelfKind::None;
     let mut lua = None;
     let mut args = Vec::new();
@@ -322,7 +328,7 @@ pub fn userdata_impl(attr: TokenStream, item: TokenStream) -> TokenStream {
 
     static COUNTER: AtomicUsize = AtomicUsize::new(0);
     let unique_suffix = COUNTER.fetch_add(1, Ordering::Relaxed);
-    let register_fn_name = format_ident!("__mlua_register_{type_name}_{unique_suffix}");
+    let register_fn_name = format_ident!("__mlua_register_{}_{unique_suffix}", type_name);
     let registration_fn_name = format_ident!("__mlua_userdata_registration");
 
     let mut registration_calls = Vec::new();
@@ -515,14 +521,16 @@ pub fn userdata_impl(attr: TokenStream, item: TokenStream) -> TokenStream {
     input.attrs = strip_item_attrs(&input.attrs);
 
     let output = quote! {
-        #[allow(non_snake_case)]
-        fn #register_fn_name(registry: &mut ::mlua::userdata::UserDataRegistry<#type_path>) {
-            use ::mlua::userdata::{UserDataFields as _, UserDataMethods as _};
-            #(#registration_calls)*
+        impl #type_path {
+            #[allow(non_snake_case)]
+            fn #register_fn_name(registry: &mut ::mlua::userdata::UserDataRegistry<Self>) {
+                use ::mlua::userdata::{UserDataFields as _, UserDataMethods as _};
+                #(#registration_calls)*
+            }
         }
 
         ::mlua::__inventory::submit! {
-            #type_path::#registration_fn_name(#register_fn_name)
+            #type_path::#registration_fn_name(#type_path::#register_fn_name)
         }
 
         #input
@@ -672,25 +680,16 @@ fn gen_field_setter(
 ) -> TokenStream2 {
     let lua_name = lua_attr.name(fn_name);
     let call_args = gen_call_args(info);
-    let this = Ident::new("this", Span2::mixed_site());
-    let lua = Ident::new("lua", Span2::mixed_site());
+    let closure_params = gen_closure_params(info);
 
-    if lua_attr.infallible {
-        let val_ident = info.args.first().map(|a| &a.ident);
-        return quote! {
-            registry.add_field_method_set(#lua_name, |#lua, #this, #val_ident| {
-                let _ = #lua; // silence unused variable warning
-                Ok(#type_path::#fn_name(#call_args))
-            });
-        };
-    }
+    let body = if lua_attr.infallible {
+        quote! { Ok(#type_path::#fn_name(#call_args)) }
+    } else {
+        quote! { #type_path::#fn_name(#call_args) }
+    };
 
-    let val_ident = info.args.first().map(|a| &a.ident);
     quote! {
-        registry.add_field_method_set(#lua_name, |#lua, #this, #val_ident| {
-            let _ = #lua; // silence unused variable warning
-            #type_path::#fn_name(#call_args)
-        });
+        registry.add_field_method_set(#lua_name, #closure_params { #body });
     }
 }
 
```

**File**: `tests/compile/userdata_generic_impl.rs` (modified, +7/-0)
```diff
@@ -11,4 +11,11 @@ impl<T> Foo<T> {
     }
 }
 
+#[mlua::userdata_impl]
+impl Foo {
+    fn generic<T>(&self, value: T) -> mlua::Result<T> {
+        Ok(value)
+    }
+}
+
 fn main() {}
```

**File**: `tests/compile/userdata_generic_impl.stderr` (modified, +6/-0)
```diff
@@ -3,3 +3,9 @@ error: `#[mlua::userdata_impl]` does not support generic impl blocks.
   |
 7 | impl<T> Foo<T> {
   |     ^^^
+
+error: `#[mlua::userdata_impl]` does not support generic methods.
+  --> tests/compile/userdata_generic_impl.rs:16:15
+   |
+16 |     fn generic<T>(&self, value: T) -> mlua::Result<T> {
+   |               ^^^
```

---

### Incident Patch 10: `f69fda72` (2026-09-14)
**Commit Message**: Fix numeric ordering and compatibility integer conversions

**File**: `mlua-sys/src/lua51/compat.rs` (modified, +5/-1)
```diff
@@ -212,7 +212,11 @@ pub unsafe fn lua_tointegerx(L: *mut lua_State, i: c_int, isnum: *mut c_int) ->
     let mut ok = 0;
     let n = lua_tonumberx(L, i, &mut ok);
     let n_int = n as lua_Integer;
-    if ok != 0 && (n - n_int as lua_Number).abs() < lua_Number::EPSILON {
+    if ok != 0
+        && n >= lua_Integer::MIN as lua_Number
+        && n < -(lua_Integer::MIN as lua_Number)
+        && n == n_int as lua_Number
+    {
         if !isnum.is_null() {
             *isnum = 1;
         }
```

**File**: `mlua-sys/src/lua52/compat.rs` (modified, +5/-1)
```diff
@@ -71,7 +71,11 @@ pub unsafe fn lua_tointegerx(L: *mut lua_State, i: c_int, isnum: *mut c_int) ->
     let mut ok = 0;
     let n = lua_tonumberx(L, i, &mut ok);
     let n_int = n as lua_Integer;
-    if ok != 0 && (n - n_int as lua_Number).abs() < lua_Number::EPSILON {
+    if ok != 0
+        && n >= lua_Integer::MIN as lua_Number
+        && n < -(lua_Integer::MIN as lua_Number)
+        && n == n_int as lua_Number
+    {
         if !isnum.is_null() {
             *isnum = 1;
         }
```

**File**: `mlua-sys/src/luau/compat.rs` (modified, +5/-1)
```diff
@@ -160,7 +160,11 @@ pub unsafe fn lua_tointegerx(L: *mut lua_State, i: c_int, isnum: *mut c_int) ->
     let mut ok = 0;
     let n = lua_tonumberx(L, i, &mut ok);
     let n_int = n as lua_Integer;
-    if ok != 0 && (n - n_int as lua_Number).abs() < lua_Number::EPSILON {
+    if ok != 0
+        && n >= lua_Integer::MIN as lua_Number
+        && n < -(lua_Integer::MIN as lua_Number)
+        && n == n_int as lua_Number
+    {
         if !isnum.is_null() {
             *isnum = 1;
         }
```

**File**: `src/value.rs` (modified, +10/-4)
```diff
@@ -493,6 +493,14 @@ impl Value {
     // Compares two values.
     // Used to sort values for Debug printing.
     pub(crate) fn sort_cmp(&self, other: &Self) -> Ordering {
+        fn cmp_integer_number(a: Integer, b: Number) -> Ordering {
+            match (a as Number).partial_cmp(&b) {
+                // Integer::MAX can round up to a float outside the integer ranges
+                Some(Ordering::Equal) => Integer::from_f64(b).map_or(Ordering::Less, |b| a.cmp(&b)),
+                ordering => ordering.unwrap_or(Ordering::Equal),
+            }
+        }
+
         match (self, other) {
             // Nil
             (Value::Nil, Value::Nil) => Ordering::Equal,
@@ -508,10 +516,8 @@ impl Value {
             (_, Value::Boolean(_)) => Ordering::Greater,
             // Integer && Number
             (Value::Integer(a), Value::Integer(b)) => a.cmp(b),
-            (Value::Integer(a), Value::Number(b)) => (*a as Number).partial_cmp(b).unwrap_or(Ordering::Equal),
-            (Value::Number(a), Value::Integer(b)) => {
-                a.partial_cmp(&(*b as Number)).unwrap_or(Ordering::Equal)
-            }
+            (Value::Integer(a), Value::Number(b)) => cmp_integer_number(*a, *b),
+            (Value::Number(a), Value::Integer(b)) => cmp_integer_number(*b, *a).reverse(),
             (Value::Number(a), Value::Number(b)) => a.partial_cmp(b).unwrap_or(Ordering::Equal),
             (Value::Integer(_) | Value::Number(_), _) => Ordering::Less,
             (_, Value::Integer(_) | Value::Number(_)) => Ordering::Greater,
```

**File**: `tests/serde.rs` (modified, +7/-2)
```diff
@@ -947,10 +947,15 @@ fn test_arbitrary_precision() {
     let num = lua.to_value_with(&num, opts).unwrap();
     assert_eq!(num, Value::Integer(123));
 
-    // Max u64
+    // Max i64
     let num = serde_json::Value::Number(serde_json::Number::from(i64::MAX));
     let num = lua.to_value_with(&num, opts).unwrap();
-    assert_eq!(num, Value::Number(i64::MAX as f64));
+    assert_eq!(num, i64::MAX.into_lua(&lua).unwrap());
+
+    // Max u64
+    let num = serde_json::Value::Number(serde_json::Number::from(u64::MAX));
+    let num = lua.to_value_with(&num, opts).unwrap();
+    assert_eq!(num, Value::Number(u64::MAX as f64));
 
     // Check that the option is disabled by default
     let num = serde_json::Value::Number(serde_json::Number::from_f64(1.244e2).unwrap());
```

#### Recent Merged Pull Requests:
- **PR #732** (closed): Clippy fixes (@notpeter)
- **PR #727** (closed): Allow `#[mlua::userdata_impl]` in a different module than the type (@teddytennant)
- **PR #712** (2026-07-05): mlua-sys: separate compile error when no Lua feature is enabled (@mrcjkb)
- **PR #707** (2026-06-09): Remove unmaintained proc-macro-error2 dependency (RUSTSEC-2026-0173) (@thomasqueirozb)
- **PR #701** (closed): Add hooks for coroutine yield and resume (@johalun)
- **PR #699** (2026-04-30): feat: implement `Not` for `StdLib` (@mokurin000)
- **PR #697** (closed): Fix module mode linking on macOS (@ChrisJefferson)
- **PR #692** (2026-04-09): feat: support external strings for `Cow<str>` and `Cow<CStr>` (@sxyazi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
