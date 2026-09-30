# Forensic Learning Record (Deep Inspection): Xudong-Huang/may

> **Canonical Artifact**: `07_PROJECT_LEARNING/xudong-huang-may-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Xudong-Huang/may](https://github.com/Xudong-Huang/may))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:50.782Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Xudong-Huang/may`
- **Description**: rust stackful coroutine library
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2437 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/lib.rs`
```
#![cfg(nightly)]
#![feature(test)]

#[macro_use]
extern crate may;
extern crate test;

use may::coroutine::*;
use test::Bencher;

#[bench]
fn yield_bench(b: &mut Bencher) {
    b.iter(|| {
        scope(|s| {
            for _ in 0..1000 {
                go!(s, || for _i in 0..10000 {
                    yield_now();
                });
            }
        });
    });
}

#[bench]
fn spawn_bench(b: &mut Bencher) {
    b.iter(|| {
        let total_work = 1000;
        let threads = 2;
        std::thread::scope(|s| {
            for _t in 0..threads {
                s.spawn(move || {
                    scope(|scope| {
                        for _i in 0..total_work / threads {
                            go!(scope, || {
                                // yield_now();
                            });
                        }
                    });
                });
            }
        });
    });
}

#[bench]
fn spawn_bench_1(b: &mut Bencher) {
    may::config().set_pool_capacity(10000);
    b.iter(|| {
        let total_work = 1000;
        let threads = 2;
        std::thread::scope(|s| {
            for _t in 0..threads {
                let work = total_work / threads;
                s.spawn(move || {
                    let v = (0..work).map(|_| go!(|| {})).collect::<Vec<_>>();
                    for h in v {
                        h.join().unwrap();
                    }
                });
            }
        });
    });
}

#[bench]
fn smoke_bench(b: &mut Bencher) {
    may::config().set_pool_capacity(10000);
    b.iter(|| {
        let threads = 5;
        std::thread::scope(|s| {
            for _t in 0..threads {
                s.spawn(|| {
                    scope(|scope| {
                        for _i in 0..200 {
                            go!(scope, || for _j in 0..1000 {
                                yield_now();
                            });
                        }
                    });
                });
            }
        });
    });
}

#[bench]
fn smoke_bench_1(b: &mut Bencher) {
    may::config().set_pool_capacity(10000);
    b.iter(|| {
        let threads = 5;
        std::thread::scope(|s| {
            for _t in 0..threads {
                s.spawn(|| {
                    scope(|scope| {
                        for _i in 0..2000 {
                            go!(scope, || for _j in 0..4 {
                                yield_now();
                            });
                        }
                    });
                });
            }
        });
    });
}

#[bench]
fn smoke_bench_2(b: &mut Bencher) {
    may::config().set_pool_capacity(10000);
    b.iter(|| {
        scope(|s| {
            // create a main coroutine, let it spawn 100 sub coroutine
            for _ in 0..100 {
                go!(s, || {
                    scope(|ss| {
                        for _ in 0..100 {
                            go!(ss, || {
                                // each task yield 4 times
                                for _ in 0..4 {
                                    yield_now();
                                }
                            });
                        }
                    });
                });
            }
        });
    });
}

#[bench]
fn smoke_bench_3(b: &mut Bencher) {
    b.iter(|| {
        let mut vec = Vec::with_capacity(100);
        // create a main coroutine, let it spawn 10 sub coroutine
        for _ in 0..100 {
            let j = go!(|| {
                let mut _vec = Vec::with_capacity(100);
                for _ in 0..100 {
                    let _j = go!(|| {
                        // each task yield 10 times
                        for _ in 0..4 {
                            yield_now();
                        }
                    });
                    _vec.push(_j);
                }
                for _j in _vec {
                    _j.join().ok();
                }
            });
            vec.push(j);
        }
        for j in vec {
            j.join().ok();
        }
    });
}

```

### Core Architecture Module: `examples/cqueue.rs`
```
extern crate generator;
#[macro_use]
extern crate may;

use std::cell::UnsafeCell;
use std::time::Duration;

use may::{coroutine, cqueue};

// this is wrapper to work around the compile error
// we are safe to share the data in bottom half since we run them orderly
struct SyncCell<T>(UnsafeCell<T>);
impl<T> SyncCell<T> {
    fn new(data: T) -> Self {
        Self(UnsafeCell::new(data))
    }

    unsafe fn get_mut(&mut self) -> &mut T {
        self.0.get_mut()
    }
}

// sum ten data resources
fn main() {
    let mut gv = vec![];
    let mut total = SyncCell::new(0);

    // create the event producers
    for i in 0..10 {
        let g = generator::Gn::new_scoped(move |mut s| {
            let mut data = 10;
            loop {
                coroutine::sleep(Duration::from_millis(500 * (i + 1)));
                // println!("coroutine{}: data = {:?}", i, data);
                s.yield_with(data);
                data += 10;
            }
        });

        gv.push(g);
    }

    // the select body that monitor the rx event and recalc the new total
    cqueue::scope(|cqueue| {
        // register select coroutines
        for t in 0..10 {
            go!(cqueue, t, |es| {
                let mut last = 0;
                let token = es.get_token();
                for data in gv[token].by_ref() {
                    // =====================================================
                    es.send(0);
                    // =====================================================

                    let delta = data - last;
                    let total = unsafe { total.get_mut() };
                    // bottom half that will run sequentially in the poller
                    println!("in selector: update from {token}, delta={delta}, last_total={total}");

                    *total += delta;
                    last = data;
                }
            });
        }

        // register timer for poller
        cqueue_add_oneshot!(cqueue, 9999, _ = coroutine::sleep(Duration::from_secs(10)) => {
            println!("poll time over!");
        });

        let total = unsafe { total.get_mut() };
        // poll the event
        while let Ok(ev) = cqueue.poll(None) {
            if ev.token == 9999 {
                break;
            }
            // print the new total
            println!("in poller: total={total}");
        }
    });

    println!("done");
}

```

### Core Architecture Module: `examples/echo.rs`
```
extern crate docopt;
#[macro_use]
extern crate may;
#[macro_use]
extern crate serde_derive;

// use std::time::Duration;
use std::io::{Read, Write};

use docopt::Docopt;
use may::net::{TcpListener, TcpStream};

const VERSION: &str = "0.1.0";

const USAGE: &str = "
Tcp echo server.

Usage:
  echo [-t <threads>] [-p <port>]
  echo (-h | --help)
  echo (-v | --version)

Options:
  -h --help         Show this screen.
  -v --version      Show version.
  -t <threads>      number of threads to use [default: 1].
  -p <address>      port of the server [default: 8080].
";

#[derive(Debug, Deserialize)]
struct Args {
    flag_p: u16,
    flag_t: usize,
    flag_v: bool,
}

macro_rules! t {
    ($e:expr) => {
        match $e {
            Ok(val) => val,
            Err(err) => return println!("err = {:?}", err),
        }
    };
}

#[inline]
fn handle_client(mut stream: TcpStream) {
    // t!(stream.set_read_timeout(Some(Duration::from_secs(10))));
    // t!(stream.set_write_timeout(Some(Duration::from_secs(10))));
    let mut read = vec![0; 1024 * 16]; // alloc in heap!
    loop {
        let n = t!(stream.read(&mut read));
        if n > 0 {
            t!(stream.write_all(&read[0..n]));
        } else {
            break;
        }
    }
}

/// simple test: echo hello | nc 127.0.0.1 8080
fn main() {
    let args: Args = Docopt::new(USAGE)
        .and_then(|d| d.deserialize())
        .unwrap_or_else(|e| e.exit());

    if args.flag_v {
        return println!("echo: {VERSION}");
    }

    let port = args.flag_p;
    let threads = args.flag_t;
    may::config().set_workers(threads);

    may::coroutine::scope(|s| {
        for i in 0..threads {
            go!(s, move || {
                // let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
                let listener = TcpListener::bind(("0.0.0.0", port)).unwrap();

                println!(
                    "Starting tcp echo server on {:?}",
                    listener.local_addr().unwrap(),
                );
                println!("running on thread id {i}");

                for stream in listener.incoming() {
                    match stream {
                        Ok(s) => {
                            go!(move || handle_client(s));
                        }
                        Err(e) => println!("err = {e:?}"),
                    }
                }
            });
        }
    });
}

```

### Core Architecture Module: `examples/echo_client.rs`
```
// extern crate rustc_serialize;
extern crate docopt;
#[macro_use]
extern crate may;
#[macro_use]
extern crate serde_derive;

use std::io::{self, Read, Write};
use std::net::ToSocketAddrs;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use may::coroutine;
use may::net::TcpStream;

use docopt::Docopt;

const VERSION: &str = "0.1.0";

const USAGE: &str = "
Tcp echo client.

Usage:
  echo_client [-t <threads>] [-c <connections>] [-d <time>] [-l <length>] -a <address>
  echo_client (-h | --help)
  echo_client (-v | --version)

Options:
  -h --help         Show this screen.
  -v --version      Show version.
  -t <threads>      number of threads to use [default: 1].
  -l <length>       packet length in bytes [default: 100].
  -c <connections>  concurrent connections  [default: 100].
  -d <time>         time to run in seconds [default: 10].
  -a <address>      target address (e.g. 127.0.0.1:8080).
";

#[derive(Debug, Deserialize)]
struct Args {
    flag_a: String,
    flag_c: usize,
    flag_d: usize,
    flag_l: usize,
    flag_t: usize,
    flag_v: bool,
}

macro_rules! t {
    ($e:expr) => {
        match $e {
            Ok(val) => val,
            Err(err) => return println!("call = {:?}\nerr = {:?}", stringify!($e), err),
        }
    };
}

fn main() {
    let args: Args = Docopt::new(USAGE)
        .and_then(|d| d.deserialize())
        .unwrap_or_else(|e| e.exit());

    if args.flag_v {
        return println!("echo_client: {VERSION}");
    }

    let target_addr: &str = &args.flag_a;
    let test_msg_len = args.flag_l;
    let test_conn_num = args.flag_c;
    let test_seconds = args.flag_d;
    // let io_timeout = 2;

    may::config().set_workers(args.flag_t);

    let stop = AtomicBool::new(false);
    let in_num = AtomicUsize::new(0);
    let out_num = AtomicUsize::new(0);

    let msg = vec![0; test_msg_len];

    let err = io::Error::other("can't resolve socket addresses");
    let addr = t!(target_addr.to_socket_addrs())
        .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
        .unwrap();

    coroutine::scope(|scope| {
        go!(scope, || {
            coroutine::sleep(Duration::from_secs(test_seconds as u64));
            stop.store(true, Ordering::Release);
        });

        // print the result every one second
        go!(scope, || {
            let mut time = 0;
            let mut last_num = 0;
            while !stop.load(Ordering::Relaxed) {
                coroutine::sleep(Duration::from_secs(1));
                time += 1;

                let out_num = out_num.load(Ordering::Relaxed);
                let packets = out_num - last_num;
                last_num = out_num;

                print!(
                    "\r{} Secs, Speed: {} packets/sec,  {} kb/sec\r",
                    time,
                    packets,
                    packets * test_msg_len / 1024
                );
                std::io::stdout().flush().ok();
            }
        });

        for _ in 0..test_conn_num {
            go!(scope, || {
                let mut conn = t!(TcpStream::connect(addr));
                // t!(conn.set_read_timeout(Some(Duration::from_secs(io_timeout))));
                // t!(conn.set_write_timeout(Some(Duration::from_secs(io_timeout))));
                t!(conn.set_nodelay(true));

                let l = msg.len();
                let mut recv = vec![0; l];
                loop {
                    t!(conn.write_all(&msg));
                    out_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }

                    t!(conn.read_exact(&mut recv));
                    in_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                }
            });
        }
    });

    let in_num = in_num.load(Ordering::Relaxed);
    let out_num = out_num.load(Ordering::Relaxed);

    println!("==================Benchmarking: {target_addr}==================");
    println!("{test_conn_num} clients, running {test_msg_len} bytes, {test_seconds} sec.\n");
    println!(
        "Speed: {} request/sec,  {} response/sec, {} kb/sec",
        out_num / test_seconds,
        in_num / test_seconds,
        out_num * test_msg_len / test_seconds / 1024
    );
    println!("Requests: {out_num}");
    println!("Responses: {in_num}");
}

```

### Core Architecture Module: `examples/echo_udp.rs`
```
extern crate docopt;
#[macro_use]
extern crate may;
#[macro_use]
extern crate serde_derive;

// use std::time::Duration;
// use std::io::ErrorKind;

use may::coroutine;
use may::net::UdpSocket;

use docopt::Docopt;

const VERSION: &str = "0.1.0";

const USAGE: &str = "
Udp echo server.

Usage:
  echo_udp [-t <threads>] [-p <port>]
  echo_udp (-h | --help)
  echo_udp (-v | --version)

Options:
  -h --help         Show this screen.
  -v --version      Show version.
  -t <threads>      number of threads to use [default: 1].
  -p <address>      port of the server [default: 30000].
";

#[derive(Debug, Deserialize)]
struct Args {
    flag_p: u16,
    flag_t: usize,
    flag_v: bool,
}

macro_rules! t {
    ($e:expr) => {
        match $e {
            Ok(val) => val,
            Err(err) => {
                println!("call = {:?}\nerr = {:?}", stringify!($e), err);
                continue;
            }
        }
    };
}

/// simple test: echo hello | nc -u 127.0.0.1 30000
fn main() {
    let args: Args = Docopt::new(USAGE)
        .and_then(|d| d.deserialize())
        .unwrap_or_else(|e| e.exit());

    if args.flag_v {
        return println!("echo_udp: {VERSION}");
    }

    let port = args.flag_p;
    let threads = args.flag_t;
    may::config().set_workers(threads);

    let sock = UdpSocket::bind(("0.0.0.0", port)).unwrap();
    println!(
        "Starting udp echo server on {:?}\nRunning on {} threads",
        sock.local_addr().unwrap(),
        threads
    );

    let mut handlers = Vec::new();
    for _ in 0..threads {
        let sock = t!(sock.try_clone());
        let h: coroutine::JoinHandle<()> = go!(move || {
            let mut buf = vec![0u8; 1024 * 16];
            loop {
                let (len, addr) = t!(sock.recv_from(&mut buf));
                // println!("recv_from: len={:?} addr={:?}", len, addr);
                let mut rest = len;
                while rest > 0 {
                    let i = t!(sock.send_to(&buf[(len - rest)..len], addr));
                    rest -= i;
                }
            }
        });
        handlers.push(h);
    }

    for j in handlers {
        j.join().unwrap();
    }
}

```

### Core Architecture Module: `examples/echo_udp_client.rs`
```
extern crate docopt;
#[macro_use]
extern crate may;
#[macro_use]
extern crate serde_derive;

use std::io::{self, Write};
use std::net::ToSocketAddrs;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use docopt::Docopt;
use may::coroutine;
use may::net::UdpSocket;

const VERSION: &str = "0.1.0";

const USAGE: &str = "
Udp echo client.

Usage:
  echo_upd_client [-d <time>] [-c <connections>] [-t <threads>] [-l <length>] -a <address>
  echo_upd_client (-h | --help)
  echo_upd_client (-v | --version)

Options:
  -h --help         Show this screen.
  -v --version      Show version.
  -t <threads>      number of threads to use [default: 1].
  -l <length>       packet length in bytes [default: 100].
  -c <connections>  concurrent connections  [default: 100].
  -d <time>         time to run in seconds [default: 10].
  -a <address>      target address (e.g. 127.0.0.1:8080).
";

#[derive(Debug, Deserialize)]
struct Args {
    flag_c: usize,
    flag_l: usize,
    flag_t: usize,
    flag_d: usize,
    flag_v: bool,
    flag_a: String,
}

macro_rules! t {
    ($e:expr) => {
        match $e {
            Ok(val) => val,
            Err(err) => {
                println!("call = {:?}", stringify!($e));
                println!("err = {:?}", err);
                return;
            }
        }
    };
}

fn main() {
    let args: Args = Docopt::new(USAGE)
        .and_then(|d| d.deserialize())
        .unwrap_or_else(|e| e.exit());

    if args.flag_v {
        return println!("echo_udp_client: {VERSION}");
    }

    let target_addr: &str = &args.flag_a;
    let test_msg_len = args.flag_l;
    let test_conn_num = args.flag_c;
    let test_seconds = args.flag_d;

    let err = io::Error::other("can't resolve socket addresses");
    let addr = t!(target_addr.to_socket_addrs())
        .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
        .unwrap();

    may::config().set_workers(args.flag_t);

    // let io_timeout = 5;
    let base_port = AtomicUsize::new(addr.port() as usize + 100);

    let stop = AtomicBool::new(false);
    let in_num = AtomicUsize::new(0);
    let out_num = AtomicUsize::new(0);

    let msg = vec![0; test_msg_len];

    coroutine::scope(|scope| {
        go!(scope, || {
            coroutine::sleep(Duration::from_secs(test_seconds as u64));
            stop.store(true, Ordering::Release);
        });

        // print the result every one second
        go!(scope, || {
            let mut time = 0;
            let mut last_num = 0;
            while !stop.load(Ordering::Relaxed) {
                coroutine::sleep(Duration::from_secs(1));
                time += 1;

                let out_num = out_num.load(Ordering::Relaxed);
                let packets = out_num - last_num;
                last_num = out_num;

                print!(
                    "\r{} Secs, Speed: {} packets/sec,  {} kb/sec\r",
                    time,
                    packets,
                    packets * test_msg_len / 1024
                );
                std::io::stdout().flush().ok();
            }
        });

        for _ in 0..test_conn_num {
            go!(scope, || {
                let local_port = base_port.fetch_add(1, Ordering::Relaxed);
                let s = t!(UdpSocket::bind(("0.0.0.0", local_port as u16)));
                // t!(s.set_write_timeout(Some(Duration::from_secs(io_timeout))));
                // t!(s.set_read_timeout(Some(Duration::from_secs(io_timeout))));

                let l = msg.len();
                let mut recv = vec![0; l];
                loop {
                    let mut rest = l;
                    while rest > 0 {
                        let i = t!(s.send_to(&msg[(l - rest)..l], addr));
                        rest -= i;
                    }

                    out_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }

                    let mut rest = l;
                    while rest > 0 {
                        let (i, _) = t!(s.recv_from(&mut recv[(l - rest)..l]));
                        rest -= i;
                    }

                    in_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                }
            });
        }
    });

    let in_num = in_num.load(Ordering::Relaxed);
    let out_num = out_num.load(Ordering::Relaxed);

    println!("==================Benchmarking: {target_addr}==================");
    println!("{test_conn_num} clients, running {test_msg_len} bytes, {test_seconds} sec.\n");
    println!(
        "Speed: {} request/sec,  {} response/sec, {} kb/sec",
        out_num / test_seconds,
        in_num / test_seconds,
        out_num * test_msg_len / test_seconds / 1024
    );
    println!("Requests: {out_num}");
    println!("Responses: {in_num}");
}

```

### Core Architecture Module: `examples/echo_udp_client1.rs`
```
extern crate docopt;
#[macro_use]
extern crate may;
#[macro_use]
extern crate serde_derive;

use std::io::{self, Write};
use std::net::ToSocketAddrs;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use docopt::Docopt;
use may::coroutine;
use may::net::UdpSocket;

const VERSION: &str = "0.1.0";

const USAGE: &str = "
Udp echo client.

Usage:
  echo_upd_client [-d <time>] [-c <connections>] [-t <threads>] [-l <length>] -a <address>
  echo_upd_client (-h | --help)
  echo_upd_client (-v | --version)

Options:
  -h --help         Show this screen.
  -v --version      Show version.
  -t <threads>      number of threads to use [default: 1].
  -l <length>       packet length in bytes [default: 100].
  -c <connections>  concurrent connections  [default: 100].
  -d <time>         time to run in seconds [default: 10].
  -a <address>      target address (e.g. 127.0.0.1:8080).
";

#[derive(Debug, Deserialize)]
struct Args {
    flag_c: usize,
    flag_l: usize,
    flag_t: usize,
    flag_d: usize,
    flag_v: bool,
    flag_a: String,
}

macro_rules! t {
    ($e:expr) => {
        match $e {
            Ok(val) => val,
            Err(err) => {
                println!("call = {:?}", stringify!($e));
                println!("err = {:?}", err);
                return;
            }
        }
    };
}

fn main() {
    let args: Args = Docopt::new(USAGE)
        .and_then(|d| d.deserialize())
        .unwrap_or_else(|e| e.exit());

    if args.flag_v {
        return println!("echo_udp_client: {VERSION}");
    }

    let target_addr: &str = &args.flag_a;
    let test_msg_len = args.flag_l;
    let test_conn_num = args.flag_c;
    let test_seconds = args.flag_d;

    let err = io::Error::other("can't resolve socket addresses");
    let addr = t!(target_addr.to_socket_addrs())
        .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
        .unwrap();

    may::config().set_workers(args.flag_t);

    // let io_timeout = 5;
    let base_port = AtomicUsize::new(addr.port() as usize + 100);

    let stop = AtomicBool::new(false);
    let in_num = AtomicUsize::new(0);
    let out_num = AtomicUsize::new(0);

    let msg = vec![0; test_msg_len];

    coroutine::scope(|scope| {
        go!(scope, || {
            coroutine::sleep(Duration::from_secs(test_seconds as u64));
            stop.store(true, Ordering::Release);
        });

        // print the result every one second
        go!(scope, || {
            let mut time = 0;
            let mut last_num = 0;
            while !stop.load(Ordering::Relaxed) {
                coroutine::sleep(Duration::from_secs(1));
                time += 1;

                let out_num = out_num.load(Ordering::Relaxed);
                let packets = out_num - last_num;
                last_num = out_num;

                print!(
                    "\r{} Secs, Speed: {} packets/sec,  {} kb/sec\r",
                    time,
                    packets,
                    packets * test_msg_len / 1024
                );
                std::io::stdout().flush().ok();
            }
        });

        for _ in 0..test_conn_num {
            go!(scope, || {
                let local_port = base_port.fetch_add(1, Ordering::Relaxed);
                let s = t!(UdpSocket::bind(("0.0.0.0", local_port as u16)));
                // t!(s.set_write_timeout(Some(Duration::from_secs(io_timeout))));
                // t!(s.set_read_timeout(Some(Duration::from_secs(io_timeout))));

                t!(s.connect(target_addr));

                let l = msg.len();
                let mut recv = vec![0; l];
                loop {
                    let mut rest = l;
                    while rest > 0 {
                        let i = t!(s.send(&msg[(l - rest)..l]));
                        rest -= i;
                    }

                    out_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }

                    let mut rest = l;
                    while rest > 0 {
                        let i = t!(s.recv(&mut recv[(l - rest)..l]));
                        rest -= i;
                    }

                    in_num.fetch_add(1, Ordering::Relaxed);

                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                }
            });
        }
    });

    let in_num = in_num.load(Ordering::Relaxed);
    let out_num = out_num.load(Ordering::Relaxed);

    println!("==================Benchmarking: {target_addr}==================");
    println!("{test_conn_num} clients, running {test_msg_len} bytes, {test_seconds} sec.\n");
    println!(
        "Speed: {} request/sec,  {} response/sec, {} kb/sec",
        out_num / test_seconds,
        in_num / test_seconds,
        out_num * test_msg_len / test_seconds / 1024
    );
    println!("Requests: {out_num}");
    println!("Responses: {in_num}");
}

```

### Core Architecture Module: `examples/gen.rs`
```
extern crate generator;
#[macro_use]
extern crate may;

use crate::coroutine::yield_now;
use generator::Gn;
use may::coroutine;

fn main() {
    coroutine::scope(|scope| {
        go!(scope, || {
            let g = Gn::<()>::new_scoped(|mut scope| {
                let (mut a, mut b) = (0, 1);
                while b < 200 {
                    std::mem::swap(&mut a, &mut b);
                    // this is yield from the generator context!
                    yield_now();
                    b += a;
                    scope.yield_(b);
                }
                a + b
            });
            g.fold((), |_, i| {
                println!("got {i}");
                // yield_now();
            });
        });
    });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39** (2018-03-04): **support send io ojbect to thread context that was created in coroutine context**
  *Symptoms*: currently if send an io object that initialized in coroutine context to a thread context, it will trigger a core dump. This was caused by wrongly assuming the context when initialize the io object. however detect run time context every time call read/write would hurt the performance a little.

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

### Incident Patch 1: `93314756` (2026-07-11)
**Commit Message**: fix(io): map WSAECONNREFUSED (10061) to ConnectionRefused on Windows

On Windows, TCP connection attempts that receive WSAECONNREFUSED (10061)
return an io::Error with ErrorKind::Uncategorized instead of
ErrorKind::ConnectionRefused. This causes may_minihttp integration tests
to fail on Windows.

Remap 10061 explicitly in connect_complete().

**File**: `AI_USAGE_GUIDE.md` (removed, +0/-755)
```diff
@@ -1,755 +0,0 @@
-# May Rust Coroutine Library - AI Usage Guide
-
-## Overview
-
-**May** is a high-performance Rust library for stackful coroutines, providing Go-style goroutines for Rust. This guide provides comprehensive information for AI systems to properly understand, use, and contribute to the May codebase.
-
-## 🎯 Core Concepts
-
-### 1. Stackful Coroutines
-- **Definition**: Each coroutine has its own stack (default 32KB on 64-bit systems)
-- **Implementation**: Built on the `generator` library
-- **Scheduling**: Cooperative scheduling across configurable worker threads
-- **Memory**: Fixed stack size per coroutine (no automatic growth)
-
-### 2. Go-style Concurrency
-- **Philosophy**: Similar to Go's goroutines but with Rust safety guarantees
-- **Spawning**: Use `go!` macro instead of direct `spawn` calls
-- **Communication**: Channels (MPSC, MPMC, SPSC) and synchronization primitives
-
-## 🚀 Getting Started
-
-### Basic Coroutine Spawning
-
-```rust
-#[macro_use]
-extern crate may;
-
-// Simple coroutine
-let handle = go!(|| {
-    println!("Hello from coroutine!");
-});
-handle.join().unwrap();
-
-// With custom stack size
-let handle = go_with!(8192, || {
-    println!("Coroutine with 8KB stack");
-});
-
-// Named coroutine with custom stack
-let handle = go_with!("my_task", 16384, || {
-    println!("Named coroutine with 16KB stack");
-});
-```
-
-### Configuration
-
-```rust
-use may::config;
-
-fn setup_runtime() {
-    config()
-        .set_workers(4)           // 4 worker threads
-        .set_stack_size(0x2000)   // 8KB default stack
-        .set_pool_capacity(1000)  // Coroutine pool size
-        .set_worker_pin(true);    // Pin workers to CPU cores
-}
-```
-
-## 📚 API Reference
-
-### 1. Coroutine Management
-
-#### Spawning Coroutines
-```rust
-// Preferred: Use go! macro (safe)
-let handle = go!(|| {
-    // coroutine code
-});
-
-// Advanced: Use Builder for custom configuration
-let handle = go!(
-    coroutine::Builder::new()
-        .name("worker".to_string())
-        .stack_size(0x4000),
-    || {
-        // coroutine code
-    }
-);
-
-// Scoped coroutines (wait for all to complete)
-coroutine::scope(|scope| {
-    for i in 0..10 {
-        go!(scope, move || {
-            println!("Worker {}", i);
-        });
-    }
-    // All coroutines complete before scope exits
-});
-```
-
-#### Join Handles
-```rust
-let handle = go!(|| {
-    42
-});
-
-// Wait for completion and get result
-let result = handle.join().unwrap();
-assert_eq!(result, 42);
-
-// Check if done without blocking
-if handle.is_done() {
-    println!("Coroutine finished");
-}
-
-// Get coroutine handle for cancellation
-let co = handle.coroutine();
-unsafe { co.cancel(); } // Cancel the coroutine
-```
-
-### 2. Network I/O
-
-#### TCP Server
-```rust
-use may::net::TcpListener;
-use std::io::{Read, Write};
-
-let listener = TcpListener::bind("127.0.0.1:8080")?;
-for stream in listener.incoming() {
-    let mut stream = stream?;
-    go!(move || {
-        let mut buf = [0; 1024];
-        while let Ok(n) = stream.read(&mut buf) {
-            if n == 0 { break; }
-            stream.write_all(&buf[0..n])?;
-        }
-        Ok::<_, std::io::Error>(())
-    });
-}
-```
-
-#### UDP Socket
-```rust
-use may::net::UdpSocket;
-
-let socket = UdpSocket::bind("127.0.0.1:8080")?;
-let mut buf = [0; 1024];
-
-loop {
-    let (len, addr) = socket.recv_from(&mut buf)?;
-    socket.send_to(&buf[0..len], addr)?;
-}
-```
-
-#### Generic I/O Wrapper
-```rust
-use may::io::CoIo;
-use std::fs::File;
-
-// Wrap any I/O object for coroutine use
-let file = File::open("example.txt")?;
-let mut co_file = CoIo::new(file)?;
-
-// Now can be used in coroutine context without blocking
-let mut contents = String::new();
-co_file.read_to_string(&mut contents)?;
-```
-
-### 3. Synchronization Primitives
-
-#### Channels
-```rust
-use may::sync::mpsc;
-
-// MPSC Channel
-let (tx, rx) = mpsc::channel();
-go!(move || {
-    tx.send(42).unwrap();
-}
```

**File**: `MAY_IMPROVEMENT_ANALYSIS.md` (removed, +0/-574)
```diff
@@ -1,574 +0,0 @@
-# May Rust Coroutine Library - Safety Improvement Analysis
-
-## Executive Summary
-
-This analysis examines the May Rust coroutine library to identify potential improvements that could eliminate the need for `unsafe` spawn functions and enhance overall safety. The current `unsafe` requirements stem from two primary concerns: **Thread Local Storage (TLS) access** and **stack overflow risks**. This document proposes concrete solutions to address these safety issues.
-
-## 🚨 Current Safety Issues
-
-### 1. Thread Local Storage (TLS) Safety
-**Problem**: Coroutines can migrate between threads, making TLS access undefined behavior.
-**Current Impact**: Requires `unsafe` spawn functions and careful developer discipline.
-
-### 2. Stack Overflow Risk  
-**Problem**: Fixed-size stacks with no automatic growth can cause segmentation faults.
-**Current Impact**: Requires `unsafe` spawn functions and manual stack size management.
-
-### 3. Blocking API Detection
-**Problem**: No compile-time or runtime detection of thread-blocking API usage.
-**Current Impact**: Performance degradation when developers accidentally use blocking APIs.
-
-## 🎯 Proposed Improvements
-
-## Improvement 1: Safe TLS Detection and Prevention
-
-### 1.1 Compile-Time TLS Detection
-```rust
-// New proc macro to detect TLS usage
-#[may_coroutine_safe]
-fn my_coroutine_function() {
-    // This would cause a compile error:
-    // thread_local! { static FOO: i32 = 42; }
-    
-    // This would be allowed:
-    coroutine_local! { static FOO: i32 = 42; }
-}
-
-// Implementation using syn/quote
-pub fn may_coroutine_safe(input: TokenStream) -> TokenStream {
-    // Parse function and scan for thread_local! usage
-    // Generate compile errors for unsafe patterns
-}
-```
-
-### 1.2 Runtime TLS Access Guard
-```rust
-// Enhanced coroutine spawn with TLS monitoring
-pub fn spawn_safe<F, T>(f: F) -> JoinHandle<T>
-where
-    F: FnOnce() -> T + Send + 'static + TlsSafe,
-    T: Send + 'static,
-{
-    // TlsSafe trait ensures no TLS access
-    spawn_impl_safe(f)
-}
-
-// Trait to mark TLS-safe functions
-pub unsafe auto trait TlsSafe {}
-
-// Explicitly opt-out functions that use TLS
-impl !TlsSafe for fn() {
-    // Functions using thread_local! would not implement TlsSafe
-}
-```
-
-### 1.3 TLS Access Runtime Detection
-```rust
-// Thread-local flag to detect TLS access in coroutines
-thread_local! {
-    static IN_COROUTINE: Cell<bool> = Cell::new(false);
-}
-
-// Modified coroutine execution wrapper
-fn run_coroutine_safe(mut co: CoroutineImpl) {
-    IN_COROUTINE.with(|flag| flag.set(true));
-    
-    // Install panic hook to catch TLS access
-    let old_hook = std::panic::take_hook();
-    std::panic::set_hook(Box::new(|info| {
-        if info.payload().downcast_ref::<TlsAccessError>().is_some() {
-            eprintln!("❌ FATAL: TLS access detected in coroutine context!");
-            std::process::abort();
-        }
-    }));
-    
-    match co.resume() {
-        Some(ev) => ev.subscribe(co),
-        None => Done::drop_coroutine(co),
-    }
-    
-    std::panic::set_hook(old_hook);
-    IN_COROUTINE.with(|flag| flag.set(false));
-}
-
-// TLS access detector (would need to be injected into std)
-struct TlsAccessError;
-
-fn check_tls_access() {
-    if IN_COROUTINE.with(|flag| flag.get()) {
-        panic!(TlsAccessError);
-    }
-}
-```
-
-## Improvement 2: Stack Safety Enhancements
-
-### 2.1 Stack Guard Pages
-```rust
-use std::alloc::{alloc, dealloc, Layout};
-use libc::{mprotect, PROT_NONE, PROT_READ, PROT_WRITE};
-
-pub struct SafeStack {
-    base: *mut u8,
-    size: usize,
-    guard_size: usize,
-}
-
-impl SafeStack {
-    pub fn new(size: usize) -> io::Result<Self> {
-        let page_size = page_size();
-        let guard_size = page_size;
-        let total_size = size + guard_size * 2; // Guard pages at both ends
-        
-        // Allocate memory
-        let layout = Layout::from_size_align(total_size, page_size)
- 
```

**File**: `MAY_MESSAGE_PASSING_IMPROVEMENTS.md` (removed, +0/-668)
```diff
@@ -1,668 +0,0 @@
-# May Rust Coroutine Library - Message Passing Improvement Analysis
-
-## Executive Summary
-
-This analysis examines the current message passing implementations in May and identifies opportunities for significant performance and usability improvements. The current channel implementations (MPSC, MPMC, SPSC) are functional but have several optimization opportunities and missing features that could enhance the developer experience and system performance.
-
-## 🔍 Current State Analysis
-
-### Existing Channel Types
-
-#### 1. SPSC (Single Producer Single Consumer)
-**Location**: `src/sync/spsc.rs`, `may_queue/src/spsc.rs`
-**Performance**: Highest performance, lock-free with block-based queue
-**Strengths**:
-- Lock-free implementation
-- Block-based storage reduces allocation overhead
-- Bulk operations support (`bulk_pop`)
-- Cache-friendly design with padding
-
-**Weaknesses**:
-- Limited to single producer/consumer
-- Complex wake-up mechanism with dual thread/coroutine support
-- No backpressure control
-- Missing timeout operations for some methods
-
-#### 2. MPSC (Multi Producer Single Consumer)  
-**Location**: `src/sync/mpsc.rs`, `may_queue/src/mpsc.rs`
-**Performance**: Good performance for many-to-one scenarios
-**Strengths**:
-- Lock-free queue implementation
-- Supports timeout operations
-- Compatible with both threads and coroutines
-
-**Weaknesses**:
-- Single atomic blocker registration (contention under high load)
-- No priority message support
-- No batching operations
-- Limited flow control
-
-#### 3. MPMC (Multi Producer Multi Consumer)
-**Location**: `src/sync/mpmc.rs`
-**Performance**: Lower performance due to semaphore usage
-**Strengths**:
-- True multi-consumer support
-- Pressure monitoring (`pressure()` method)
-- Timeout support
-
-**Weaknesses**:
-- Uses semaphore which can be expensive
-- No work-stealing between consumers
-- No message prioritization
-- Limited scalability under high contention
-
-### Current Usage Patterns
-
-```rust
-// Basic usage - from examples/select.rs
-let (tx1, rx1) = mpsc::channel();
-let (tx2, rx2) = mpsc::channel();
-
-go!(move || {
-    tx2.send("hello").unwrap();
-    tx1.send(42).unwrap();
-});
-
-// Selection between channels
-let id = select!(
-    _ = rx1.recv() => println!("rx1 received"),
-    a = rx2.recv() => println!("rx2 received, a={a:?}")
-);
-```
-
-## 🚀 Proposed Improvements
-
-## Improvement 1: High-Performance Channel Variants
-
-### 1.1 Lock-Free MPMC with Work Stealing
-```rust
-pub mod sync {
-    pub mod mpmc_ws {
-        pub struct Channel<T> {
-            queues: Vec<WorkStealingQueue<T>>,
-            workers: AtomicUsize,
-            round_robin: AtomicUsize,
-        }
-        
-        impl<T> Channel<T> {
-            pub fn with_workers(worker_count: usize) -> (Sender<T>, Receiver<T>) {
-                // Each worker gets its own queue to reduce contention
-                // Receivers can steal work from other queues when empty
-            }
-            
-            pub fn send_to_worker(&self, worker_id: usize, item: T) -> Result<(), SendError<T>> {
-                // Direct worker targeting for CPU-bound task distribution
-            }
-        }
-    }
-}
-```
-
-### 1.2 Priority Channel Implementation
-```rust
-pub mod sync {
-    pub mod priority {
-        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
-        pub enum Priority {
-            Low = 0,
-            Normal = 1,
-            High = 2,
-            Critical = 3,
-        }
-        
-        pub struct PriorityChannel<T> {
-            queues: [Queue<T>; 4], // One queue per priority level
-            waiters: AtomicOption<Arc<Blocker>>,
-            priority_mask: AtomicU8, // Bitmask of non-empty priorities
-        }
-        
-        impl<T> PriorityChannel<T> {
-            pub fn send_priority(&self, item: T, priority: Priority) -> Result<(), SendError<T>> {
-                let queue_idx = priority as usize;
-     
```

**File**: `src/io/sys/windows/miow.rs` (modified, +8/-1)
```diff
@@ -589,7 +589,14 @@ pub fn connect_complete(socket: RawSocket) -> io::Result<()> {
     if result == 0 {
         Ok(())
     } else {
-        Err(io::Error::last_os_error())
+        let err = io::Error::last_os_error();
+        // WSAECONNREFUSED (10061) is not mapped to ConnectionRefused by
+        // Rust's std::io::ErrorKind on Windows — remap it explicitly.
+        if err.raw_os_error() == Some(10061) {
+            Err(io::Error::new(io::ErrorKind::ConnectionRefused, err))
+        } else {
+            Err(err)
+        }
     }
 }
 
```

**File**: `tasks/tasks.md` (removed, +0/-634)
```diff
@@ -1,634 +0,0 @@
-# May Rust Coroutine Library - Implementation PRD
-
-## Executive Summary
-
-This Product Requirements Document (PRD) outlines the comprehensive implementation plan for enhancing the May Rust coroutine library based on three key analysis documents:
-
-1. **AI Usage Guide** - Comprehensive documentation and API reference
-2. **Safety Improvement Analysis** - Eliminating unsafe spawn requirements
-3. **Message Passing Improvements** - Enhanced channel implementations and patterns
-
-The implementation spans **24 months** across **6 major phases**, delivering significant performance improvements (10-50% throughput gains), enhanced safety (90%+ safe API coverage), and superior developer experience through modern patterns and comprehensive tooling.
-
-## 🎯 Project Objectives
-
-### Primary Goals
-- **Eliminate unsafe spawn requirements** through compile-time and runtime safety mechanisms
-- **Improve performance by 10-50%** via advanced channel designs and optimizations
-- **Enhance developer experience** with modern APIs, reactive patterns, and comprehensive tooling
-- **Maintain 100% backward compatibility** throughout the transition
-- **Position May as the leading Rust coroutine library** for high-performance applications
-
-### Success Metrics
-- **Safety**: 90%+ of coroutine spawning operations use safe APIs
-- **Performance**: 10-50% throughput improvement in benchmark scenarios
-- **Adoption**: 25% increase in GitHub stars and crate downloads
-- **Developer Satisfaction**: >4.5/5 rating in community surveys
-- **Ecosystem Integration**: 10+ major projects adopt enhanced May APIs
-
-## 📋 Feature Requirements
-
-## Phase 1: Foundation and Safety Infrastructure (Months 1-4)
-
-### 1.1 Safe Coroutine Spawning APIs
-
-**Priority: Critical**
-**Effort: 8 weeks**
-
-#### Requirements
-- **Compile-time TLS Detection**
-  - Implement proc macro `#[may_coroutine_safe]` to detect `thread_local!` usage
-  - Generate compile errors for unsafe TLS patterns
-  - Provide migration suggestions in error messages
-
-- **Runtime TLS Guards**
-  - Implement `TlsSafe` trait for spawn function parameters
-  - Add runtime TLS access monitoring with thread migration detection
-  - Create `CoroutineSafeSpawner` for verified safe spawning
-
-- **Type-Safe Spawn APIs**
-  - Implement `spawn_safe<F, T>()` function requiring `TlsSafe` bounds
-  - Add `CoroutineSafe` trait for automatic safety verification
-  - Create `SafeBuilder` pattern for coroutine configuration
-
-#### Acceptance Criteria
-- [ ] Compile-time macro detects 95%+ of TLS usage patterns
-- [ ] Runtime guards catch TLS violations with <1% performance overhead
-- [ ] All existing examples compile and run with new safe APIs
-- [ ] Comprehensive test suite covering safety edge cases
-
-### 1.2 Stack Safety Mechanisms
-
-**Priority: Critical**
-**Effort: 6 weeks**
-
-#### Requirements
-- **Stack Guard Pages**
-  - Implement memory protection for stack overflow detection
-  - Add configurable guard page sizes (4KB-16KB)
-  - Provide graceful error handling for stack overflow events
-
-- **Stack Monitoring**
-  - Add runtime stack usage tracking
-  - Implement stack watermark detection
-  - Create stack usage reporting and analytics
-
-- **Enhanced Stack Configuration**
-  - Extend builder pattern with stack safety options
-  - Add automatic stack size estimation based on function complexity
-  - Implement stack size recommendations
-
-#### Acceptance Criteria
-- [ ] Stack guard pages prevent 100% of overflow-related crashes
-- [ ] Stack monitoring adds <2% performance overhead
-- [ ] Automatic stack sizing reduces manual configuration by 80%
-- [ ] Stack safety works across all supported platforms
-
-### 1.3 Enhanced Builder Patterns
-
-**Priority: High**
-**Effort: 4 weeks**
-
-#### Requirements
-- **Safe Coroutine Builder**
-  - Implement fluent API for coroutine configuration
-  - Add compile-time validation of configuration combinations
-  - Provide sensible defaults 
```

---

### Incident Patch 2: `51d17e00` (2025-11-26)
**Commit Message**: :pencil: fix test warnings

**File**: `tests/lib.rs` (modified, +1/-0)
```diff
@@ -260,6 +260,7 @@ fn park_timeout() {
             coroutine::park_timeout(Duration::from_millis(100));
             // this test may fail if the scheduler is a little bit slow
             // assert!(now.elapsed() < Duration::from_millis(100));
+            assert_eq!(a, 5);
             a = 10;
         });
 
```

---

### Incident Patch 3: `827ec065` (2025-08-21)
**Commit Message**: :bug: temp fix

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ log = "0.4"
 cfg-if = "1"
 num_cpus = "1"
 smallvec = "1"
-generator = "0.8"
+# generator = "0.8"
+generator = { git = "https://github.com/Xudong-Huang/generator-rs.git" }
 crossbeam = "0.8"
 parking_lot = "0.12"
 core_affinity = "0.8"
```

---

### Incident Patch 4: `8cc314b7` (2025-08-12)
**Commit Message**: :pencil: fix clippy warnings

**File**: `src/os/unix/net.rs` (modified, +1/-1)
```diff
@@ -531,7 +531,7 @@ impl UnixListener {
     ///     }
     /// }
     /// ```
-    pub fn incoming(&self) -> Incoming {
+    pub fn incoming(&self) -> Incoming<'_> {
         Incoming { listener: self }
     }
 }
```

---

### Incident Patch 5: `af5ba992` (2025-08-12)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/windows/miow.rs` (modified, +1/-1)
```diff
@@ -632,7 +632,7 @@ impl AcceptAddrsBuf {
     ///
     /// This function can be called after a call to `accept_overlapped` has
     /// succeeded to parse out the data that was written in.
-    pub fn parse(&self, socket: &TcpListener) -> io::Result<AcceptAddrs> {
+    pub fn parse(&self, socket: &TcpListener) -> io::Result<AcceptAddrs<'_>> {
         let mut ret = AcceptAddrs {
             local: std::ptr::null_mut(),
             local_len: 0,
```

**File**: `src/net/tcp.rs` (modified, +1/-1)
```diff
@@ -412,7 +412,7 @@ impl TcpListener {
         a.done()
     }
 
-    pub fn incoming(&self) -> Incoming {
+    pub fn incoming(&self) -> Incoming<'_> {
         Incoming { listener: self }
     }
 
```

**File**: `src/park.rs` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ impl Park {
         Ok(())
     }
 
-    fn delay_drop(&self) -> DropGuard {
+    fn delay_drop(&self) -> DropGuard<'_> {
         self.wait_kernel.store(true, Ordering::Release);
         DropGuard(self)
     }
```

**File**: `src/sync/delay_drop.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ impl DelayDrop {
         }
     }
 
-    pub fn delay_drop(&self) -> DropGuard {
+    pub fn delay_drop(&self) -> DropGuard<'_> {
         self.can_drop.store(2, Ordering::Release);
         DropGuard(self)
     }
```

**File**: `src/sync/mpmc.rs` (modified, +2/-2)
```diff
@@ -224,11 +224,11 @@ impl<T> Receiver<T> {
         self.inner.recv(Some(timeout))
     }
 
-    pub fn iter(&self) -> Iter<T> {
+    pub fn iter(&self) -> Iter<'_, T> {
         Iter { rx: self }
     }
 
-    pub fn try_iter(&self) -> TryIter<T> {
+    pub fn try_iter(&self) -> TryIter<'_, T> {
         TryIter { rx: self }
     }
 }
```

---

### Incident Patch 6: `b3b67a39` (2025-05-14)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/unix/epoll.rs` (modified, +4/-4)
```diff
@@ -153,7 +153,7 @@ impl Selector {
     pub fn wakeup(&self, id: usize) {
         let buf = 1u64.to_le_bytes();
         let ret = write(&self.vec[id].evfd, &buf);
-        trace!("wakeup id={:?}, ret={:?}", id, ret);
+        trace!("wakeup id={id:?}, ret={ret:?}");
     }
 
     // register io event to the selector
@@ -171,7 +171,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("add fd to epoll select, fd={:?}", fd);
+        info!("add fd to epoll select, fd={fd:?}");
         epoll
             .add(unsafe { BorrowedFd::borrow_raw(fd) }, info)
             .map_err(from_nix_error)
@@ -196,7 +196,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("mod fd to epoll select, fd={:?}, is_read={}", fd, is_read);
+        info!("mod fd to epoll select, fd={fd:?}, is_read={is_read}");
         epoll
             .modify(unsafe { BorrowedFd::borrow_raw(fd) }, &mut info)
             .map_err(from_nix_error)
@@ -219,7 +219,7 @@ impl Selector {
         let id = fd as usize % self.vec.len();
         let single_selector = &self.vec[id];
         let epoll = &single_selector.epoll;
-        info!("del fd from epoll select, fd={:?}", fd);
+        info!("del fd from epoll select, fd={fd:?}");
         epoll.delete(unsafe { BorrowedFd::borrow_raw(fd) }).ok();
 
         // after EpollCtlDel push the unused event data
```

---

### Incident Patch 7: `ba004942` (2025-05-13)
**Commit Message**: :pencil: fix nix read

**File**: `src/io/sys/unix/epoll.rs` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 use std::io;
 use std::os::fd::AsFd;
-use std::os::fd::AsRawFd;
 use std::os::fd::BorrowedFd;
 use std::sync::atomic::Ordering;
 use std::sync::Arc;
@@ -100,7 +99,7 @@ impl Selector {
                 // this is just a wakeup event, ignore it
                 let mut buf = [0u8; 8];
                 // clear the eventfd, ignore the result
-                read(single_selector.evfd.as_raw_fd(), &mut buf).ok();
+                read(single_selector.evfd.as_fd(), &mut buf).ok();
                 // info!("got wakeup event in select, id={}", id);
                 scheduler.collect_global(id);
                 continue;
```

**File**: `src/io/sys/unix/net/socket_read.rs` (modified, +3/-1)
```diff
@@ -1,4 +1,5 @@
 use std::io;
+use std::os::fd::BorrowedFd;
 use std::sync::atomic::Ordering;
 #[cfg(feature = "io_timeout")]
 use std::time::Duration;
@@ -35,14 +36,15 @@ impl<'a> SocketRead<'a> {
     }
 
     pub fn done(&mut self) -> io::Result<usize> {
+        let fd = unsafe { BorrowedFd::borrow_raw(self.io_data.fd) };
         loop {
             co_io_result(self.is_coroutine)?;
 
             // clear the io_flag
             self.io_data.io_flag.store(0, Ordering::Relaxed);
 
             // finish the read operation
-            match read(self.io_data.fd, self.buf) {
+            match read(fd, self.buf) {
                 Ok(n) => return Ok(n),
                 Err(e) => {
                     if e == nix::errno::Errno::EAGAIN {
```

---

### Incident Patch 8: `05dfb349` (2025-05-13)
**Commit Message**: :pencil: fix clippy warnings

**File**: `src/config.rs` (modified, +3/-3)
```diff
@@ -39,7 +39,7 @@ impl Config {
     ///
     /// the minimum worker thread is 1, if you pass 0 to it, will use internal default
     pub fn set_workers(&self, workers: usize) -> &Self {
-        info!("set workers={:?}", workers);
+        info!("set workers={workers:?}");
         WORKERS.store(workers, Ordering::Relaxed);
         self
     }
@@ -66,7 +66,7 @@ impl Config {
     ///
     /// if you pass 0 to it, will use internal default
     pub fn set_pool_capacity(&self, capacity: usize) -> &Self {
-        info!("set pool capacity={:?}", capacity);
+        info!("set pool capacity={capacity:?}");
         POOL_CAPACITY.store(capacity, Ordering::Release);
         self
     }
@@ -85,7 +85,7 @@ impl Config {
     ///
     /// if you pass 0 to it, will use internal default
     pub fn set_stack_size(&self, size: usize) -> &Self {
-        info!("set stack size={:?}", size);
+        info!("set stack size={size:?}");
         STACK_SIZE.store(size, Ordering::Release);
         self
     }
```

**File**: `src/io/event_loop.rs` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ impl EventLoop {
             next_expire = match selector.select(scheduler, id, &mut events_buf, next_expire) {
                 Ok(t) => t.or(Some(timeout_ns)),
                 Err(e) => {
-                    error!("select error = {:?}", e);
+                    error!("select error = {e:?}");
                     Some(timeout_ns)
                 }
             }
```

**File**: `src/io/sys/windows/cancel.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ impl CancelIoData {
         let ret = CancelIoEx(handle, overlapped);
         if ret == 0 {
             let err = io::Error::last_os_error();
-            error!("cancel err={:?}", err);
+            error!("cancel err={err:?}");
             // ev.co.take().map(|co| get_scheduler().schedule(co));
             Err(err)
         } else {
```

**File**: `src/io/sys/windows/iocp.rs` (modified, +2/-2)
```diff
@@ -165,7 +165,7 @@ impl Selector {
                     // the timeout function would remove the timer handle
                 }
                 err => {
-                    error!("iocp err=0x{:08x}", err);
+                    error!("iocp err=0x{err:08x}");
                     unsafe {
                         // convert the ntstatus to winerr
                         let mut size: u32 = 0;
@@ -248,6 +248,6 @@ pub fn timeout_handler(data: TimerData) {
         event_data.timer.take();
         // ignore the error, the select may grab the data first!
         cancel_io(event_data.handle, event_data.get_overlapped())
-            .unwrap_or_else(|e| error!("CancelIoEx failed! e = {}", e));
+            .unwrap_or_else(|e| error!("CancelIoEx failed! e = {e}"));
     }
 }
```

---

### Incident Patch 9: `3ff1a096` (2025-03-24)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `src/io/sys/windows/net/tcp_listener_accept.rs` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ impl<'a> TcpListenerAccept<'a> {
 
         let addr = self.addr.parse(self.socket).and_then(|a| {
             a.remote().ok_or_else(|| {
-                io::Error::new(io::ErrorKind::Other, "could not obtain remote address")
+                io::Error::other("could not obtain remote address")
             })
         })?;
 
```

**File**: `src/io/sys/windows/net/tcp_stream_connect.rs` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ impl TcpStreamConnect {
         // here we should use a thread to finish the resolve?
         addr.to_socket_addrs()?
             .next()
-            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no socket addresses resolved"))
+            .ok_or_else(|| io::Error::other("no socket addresses resolved"))
             .and_then(|addr| {
                 let socket = match addr {
                     SocketAddr::V4(..) => Socket::new(Domain::IPV4, Type::STREAM, None)?,
```

**File**: `src/io/sys/windows/net/udp_recv_from.rs` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ impl<'a> UdpRecvFrom<'a> {
     pub fn done(&mut self) -> io::Result<(usize, SocketAddr)> {
         let size = co_io_result(&self.io_data, self.is_coroutine)?;
         let addr = self.addr.get_socket_addr().ok_or_else(|| {
-            io::Error::new(io::ErrorKind::Other, "could not obtain remote address")
+            io::Error::other("could not obtain remote address")
         })?;
         Ok((size, addr))
     }
```

**File**: `src/io/sys/windows/net/udp_send_to.rs` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ impl<'a> UdpSendTo<'a> {
     ) -> io::Result<Self> {
         addr.to_socket_addrs()?
             .next()
-            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no socket addresses resolved"))
+            .ok_or_else(|| io::Error::other("no socket addresses resolved"))
             .map(|addr| UdpSendTo {
                 io_data: EventData::new(socket.as_raw_socket() as HANDLE),
                 buf,
```

---

### Incident Patch 10: `dda84cb1` (2025-03-24)
**Commit Message**: :pencil: fix cargo clippy warnings

**File**: `examples/echo_client.rs` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ fn main() {
 
     let msg = vec![0; test_msg_len];
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `examples/echo_udp_client.rs` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ fn main() {
     let test_conn_num = args.flag_c;
     let test_seconds = args.flag_d;
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `examples/echo_udp_client1.rs` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ fn main() {
     let test_conn_num = args.flag_c;
     let test_seconds = args.flag_d;
 
-    let err = io::Error::new(io::ErrorKind::Other, "can't resolve socket addresses");
+    let err = io::Error::other("can't resolve socket addresses");
     let addr = t!(target_addr.to_socket_addrs())
         .fold(Err(err), |prev, addr| prev.or(Ok(addr)))
         .unwrap();
```

**File**: `may_queue/src/mpsc_list.rs` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ impl<T> Queue<T> {
     pub fn is_empty(&self) -> bool {
         let tail = unsafe { *self.tail.get() };
         // the list is empty
-        self.head.load(Ordering::Acquire) == tail
+        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
     }
 
     /// Pops some data from this queue.
@@ -62,7 +62,7 @@ impl<T> Queue<T> {
             let tail = *self.tail.get();
 
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
```

**File**: `may_queue/src/mpsc_list_v1.rs` (modified, +5/-5)
```diff
@@ -172,7 +172,7 @@ impl<T> Queue<T> {
             (*node).prev = prev;
             (*prev).next.store(node, Ordering::Release);
             let tail = *self.tail.get();
-            let is_head = tail == prev;
+            let is_head = std::ptr::eq(tail, prev);
             (Entry(ptr::NonNull::new_unchecked(node)), is_head)
         }
     }
@@ -182,7 +182,7 @@ impl<T> Queue<T> {
     pub fn is_empty(&self) -> bool {
         let tail = unsafe { *self.tail.get() };
         // the list is empty
-        self.head.load(Ordering::Acquire) == tail
+        std::ptr::eq(self.head.load(Ordering::Acquire), tail)
     }
 
     /// get the head ref
@@ -192,7 +192,7 @@ impl<T> Queue<T> {
     pub unsafe fn peek(&self) -> Option<&T> {
         let tail = *self.tail.get();
         // the list is empty
-        if self.head.load(Ordering::Acquire) == tail {
+        if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
             return None;
         }
         // spin until tail next become non-null
@@ -219,7 +219,7 @@ impl<T> Queue<T> {
         unsafe {
             let tail = *self.tail.get();
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
@@ -270,7 +270,7 @@ impl<T> Queue<T> {
             let tail = *self.tail.get();
 
             // the list is empty
-            if self.head.load(Ordering::Acquire) == tail {
+            if std::ptr::eq(self.head.load(Ordering::Acquire), tail) {
                 return None;
             }
 
```

#### Recent Merged Pull Requests:
- **PR #127** (2026-08-03): Update the generator-rs Version (@BersisSe)
- **PR #125** (2026-07-17): Fix/wsa connrefused mapping (@casibbald)
- **PR #123** (closed): Refs/heads/fix/wsa connrefused mapping (@casibbald)
- **PR #118** (closed): safe coroutine spawning (@casibbald)
- **PR #116** (closed): 2025-05-12 @weix2025 (@ghost)
- **PR #113** (2025-03-15): Remove object lifetime cast (@BoxyUwU)
- **PR #108** (2024-09-01): A variety of changes (@pyprogrammer)
- **PR #104** (2023-06-09): add aarch64 macOS support to README (@Leandros)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
