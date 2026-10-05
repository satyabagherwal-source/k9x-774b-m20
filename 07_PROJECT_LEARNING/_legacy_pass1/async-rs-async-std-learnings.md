# Forensic Learning Record (Deep Inspection): async-rs/async-std

> **Canonical Artifact**: `07_PROJECT_LEARNING/async-rs-async-std-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/async-rs/async-std](https://github.com/async-rs/async-std))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:10.997Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `async-rs/async-std`
- **Description**: Async version of the Rust standard library
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4063 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/mutex.rs`
```
#![feature(test)]

extern crate test;

use async_std::sync::{Arc, Mutex};
use async_std::task;
use test::Bencher;

#[bench]
fn create(b: &mut Bencher) {
    b.iter(|| Mutex::new(()));
}

#[bench]
fn contention(b: &mut Bencher) {
    b.iter(|| task::block_on(run(10, 1000)));
}

#[bench]
fn no_contention(b: &mut Bencher) {
    b.iter(|| task::block_on(run(1, 10000)));
}

async fn run(task: usize, iter: usize) {
    let m = Arc::new(Mutex::new(()));
    let mut tasks = Vec::new();

    for _ in 0..task {
        let m = m.clone();
        tasks.push(task::spawn(async move {
            for _ in 0..iter {
                let _ = m.lock().await;
            }
        }));
    }

    for t in tasks {
        t.await;
    }
}

```

### Core Architecture Module: `benches/task.rs`
```
#![feature(test)]

extern crate test;

use async_std::task;
use test::Bencher;

#[bench]
fn block_on(b: &mut Bencher) {
    b.iter(|| task::block_on(async {}));
}

```

### Core Architecture Module: `benches/task_local.rs`
```
#![feature(test)]

extern crate test;

use async_std::task;
use async_std::task_local;
use test::{black_box, Bencher};

#[bench]
fn get(b: &mut Bencher) {
    task_local! {
        static VAL: u64 = 1;
    }

    let mut sum = 0;
    task::block_on(async {
        b.iter(|| VAL.with(|v| sum += v));
    });
    black_box(sum);
}

```

### Core Architecture Module: `examples/a-chat/client.rs`
```
use futures::select;
use futures::FutureExt;

use async_std::{
    io::{stdin, BufReader},
    net::{TcpStream, ToSocketAddrs},
    prelude::*,
    task,
};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub(crate) fn main() -> Result<()> {
    task::block_on(try_main("127.0.0.1:8080"))
}

async fn try_main(addr: impl ToSocketAddrs) -> Result<()> {
    let stream = TcpStream::connect(addr).await?;
    let (reader, mut writer) = (&stream, &stream);
    let reader = BufReader::new(reader);
    let mut lines_from_server = futures::StreamExt::fuse(reader.lines());

    let stdin = BufReader::new(stdin());
    let mut lines_from_stdin = futures::StreamExt::fuse(stdin.lines());
    loop {
        select! {
            line = lines_from_server.next().fuse() => match line {
                Some(line) => {
                    let line = line?;
                    println!("{}", line);
                },
                None => break,
            },
            line = lines_from_stdin.next().fuse() => match line {
                Some(line) => {
                    let line = line?;
                    writer.write_all(line.as_bytes()).await?;
                    writer.write_all(b"\n").await?;
                }
                None => break,
            }
        }
    }
    Ok(())
}

```

### Core Architecture Module: `examples/a-chat/main.rs`
```
mod client;
mod server;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

fn main() -> Result<()> {
    let mut args = std::env::args();
    match (args.nth(1).as_ref().map(String::as_str), args.next()) {
        (Some("client"), None) => client::main(),
        (Some("server"), None) => server::main(),
        _ => Err("Usage: a-chat [client|server]".into()),
    }
}

```

### Core Architecture Module: `examples/a-chat/server.rs`
```
use std::{
    collections::hash_map::{Entry, HashMap},
    sync::Arc,
};

use futures::{channel::mpsc, select, FutureExt, SinkExt};

use async_std::{
    io::BufReader,
    net::{TcpListener, TcpStream, ToSocketAddrs},
    prelude::*,
    task,
};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
type Sender<T> = mpsc::UnboundedSender<T>;
type Receiver<T> = mpsc::UnboundedReceiver<T>;

#[derive(Debug)]
enum Void {}

pub(crate) fn main() -> Result<()> {
    task::block_on(accept_loop("127.0.0.1:8080"))
}

async fn accept_loop(addr: impl ToSocketAddrs) -> Result<()> {
    let listener = TcpListener::bind(addr).await?;

    let (broker_sender, broker_receiver) = mpsc::unbounded();
    let broker = task::spawn(broker_loop(broker_receiver));
    let mut incoming = listener.incoming();
    while let Some(stream) = incoming.next().await {
        let stream = stream?;
        println!("Accepting from: {}", stream.peer_addr()?);
        spawn_and_log_error(connection_loop(broker_sender.clone(), stream));
    }
    drop(broker_sender);
    broker.await;
    Ok(())
}

async fn connection_loop(mut broker: Sender<Event>, stream: TcpStream) -> Result<()> {
    let stream = Arc::new(stream);
    let reader = BufReader::new(&*stream);
    let mut lines = reader.lines();

    let name = match lines.next().await {
        None => return Err("peer disconnected immediately".into()),
        Some(line) => line?,
    };
    let (_shutdown_sender, shutdown_receiver) = mpsc::unbounded::<Void>();
    broker
        .send(Event::NewPeer {
            name: name.clone(),
            stream: Arc::clone(&stream),
            shutdown: shutdown_receiver,
        })
        .await
        .unwrap();

    while let Some(line) = lines.next().await {
        let line = line?;
        let (dest, msg) = match line.find(':') {
            None => continue,
            Some(idx) => (&line[..idx], line[idx + 1..].trim()),
        };
        let dest: Vec<String> = dest
            .split(',')
            .map(|name| name.trim().to_string())
            .collect();
        let msg: String = msg.trim().to_string();

        broker
            .send(Event::Message {
                from: name.clone(),
                to: dest,
                msg,
            })
            .await
            .unwrap();
    }

    Ok(())
}

async fn connection_writer_loop(
    messages: &mut Receiver<String>,
    stream: Arc<TcpStream>,
    mut shutdown: Receiver<Void>,
) -> Result<()> {
    let mut stream = &*stream;
    loop {
        select! {
            msg = messages.next().fuse() => match msg {
                Some(msg) => stream.write_all(msg.as_bytes()).await?,
                None => break,
            },
            void = shutdown.next().fuse() => match void {
                #[allow(unreachable_patterns)]
                Some(void) => match void {},
                None => break,
            }
        }
    }
    Ok(())
}

#[derive(Debug)]
enum Event {
    NewPeer {
        name: String,
        stream: Arc<TcpStream>,
        shutdown: Receiver<Void>,
    },
    Message {
        from: String,
        to: Vec<String>,
        msg: String,
    },
}

async fn broker_loop(mut events: Receiver<Event>) {
    let (disconnect_sender, mut disconnect_receiver) =
        mpsc::unbounded::<(String, Receiver<String>)>();
    let mut peers: HashMap<String, Sender<String>> = HashMap::new();

    loop {
        let event = select! {
            event = events.next().fuse() => match event {
                None => break,
                Some(event) => event,
            },
            disconnect = disconnect_receiver.next().fuse() => {
                let (name, _pending_messages) = disconnect.unwrap();
                assert!(peers.remove(&name).is_some());
                continue;
            },
        };
        match event {
            Event::Message { from, to, msg } => {
                for addr in to {
                    if let Some(peer) = peers.get_mut(&addr) {
                        let msg = format!("from {}: {}\n", from, msg);
                        peer.send(msg).await.unwrap();
                    }
                }
            }
            Event::NewPeer {
                name,
                stream,
                shutdown,
            } => match peers.entry(name.clone()) {
                Entry::Occupied(..) => (),
                Entry::Vacant(entry) => {
                    let (client_sender, mut client_receiver) = mpsc::unbounded();
                    entry.insert(client_sender);
                    let mut disconnect_sender = disconnect_sender.clone();
                    spawn_and_log_error(async move {
                        let res =
                            connection_writer_loop(&mut client_receiver, stream, shutdown).await;
                        disconnect_sender
                            .send((name, client_receiver))
                            .await
                            .unwrap();
                        res
                    });
                }
            },
        }
    }
    drop(peers);
    drop(disconnect_sender);
    while let Some((_name, _pending_messages)) = disconnect_receiver.next().await {}
}

fn spawn_and_log_error<F>(fut: F) -> task::JoinHandle<()>
where
    F: Future<Output = Result<()>> + Send + 'static,
{
    task::spawn(async move {
        if let Err(e) = fut.await {
            eprintln!("{}", e)
        }
    })
}

```

### Core Architecture Module: `examples/hello-world.rs`
```
//! Spawns a task that says hello.

use async_std::task;

async fn say_hi() {
    println!("Hello, world!");
}

fn main() {
    task::block_on(say_hi())
}

```

### Core Architecture Module: `examples/line-count.rs`
```
//! Counts the number of lines in a file given as an argument.

use std::env::args;

use async_std::fs::File;
use async_std::io::{self, BufReader};
use async_std::prelude::*;
use async_std::task;

fn main() -> io::Result<()> {
    let path = args().nth(1).expect("missing path argument");

    task::block_on(async {
        let file = File::open(&path).await?;
        let mut lines = BufReader::new(file).lines();
        let mut count = 0u64;

        while let Some(line) = lines.next().await {
            line?;
            count += 1;
        }

        println!("The file contains {} lines.", count);
        Ok(())
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #993** (2022-03-22): **Error information from fs operations not displayed when printing errors**
  *Symptoms*: With this code:  ``` 	let file_name = Path::new("/tmp/does_not_exist/test");  	match fs::File::create(file_name) { 		Ok(_) => (), 		Err(e) => { 			println!("Sync: Error opening file {}: {}", file_name.display(), e); 		} 	};  	async_std::task::block_on(async { 		match async_std::fs::File::create(file_name).await { 			Ok(_) => (), 			Err(e) => { 				println!("Async: Error opening file {}: {}", file_name.display(), e); 			} 		}; 	}); ```  We get this output:  ``` Sync: Error opening file /tmp/does_not_exist/test: No such file or directory (os error 2) Async: Error opening file /tmp/does_not_exist/test: could not create `/tmp/does_not_exist/test` ```  There are two problems with this: - The async version doesn't output the actual reason that the operation failed - The async version adds the filename as context. While arguably the std version should do that as well - it doesn't, meaning that if you use the async API in the same way as the sync API, it prints the filename twice.   The first point is the most important. Although more error information is available by inspecting `kind` or `source`, I think the `Display` implementation should include the actual cause of the error.  I don't view the second point as critical, as long as async_std supplies the context for every relevant API and also documents that divergance from `std::fs` on the doc page for `async_std::fs` (although I guess a major selling point of async-std is that the API mirrors st
  **Post-Mortem & Fix Analysis**:
  > Seems like `context!()` has a little bit more invocations. Maybe it's possible to remove them and wait for stdlib to provide additional context to the errors? Not knowing why my CLI or daemon cannot open a file or send data to the socket is pretty bad UX.
  > I just got bitten by this again.  I can see two options for a fix:  1. Remove all calls to `context` so that the errors from async-std align with std. Personally I prefer this, but it does mean that people's existing code will suddenly lose whatever context they had. (Similar to @jaztec's PR but applied throughout).  2. Improve the implementation of `Display` for `VerboseError` (the wrapping struct used by `context` so that it displays the content of the source error as well as the context.  I'm happy to put together a PR for whichever of these two is going to be accepted. 
  > Well, I think it would be really handy to just implement option 1 and hope for the `std` library to implement its own version of `context`. Removing all calls to `context` would remove complexity from this library and move it back to the standard library as a neat feature. I'm not strong on Rust but having a context decoration doesn't need to be really complex I would say (coming from Go in this matter).   However this PR didn't get much feedback, so either the community isn't really affected by it or the maintainers don't really consider it a problem; probably both. I'm interested though in looking into option 2 since I still need more hands-on experience in Rust development and am willing to submit a PR, although I would like to get some feedback from the maintainers on the requirements to get it approved. 

- **Issue #818** (2020-06-18): **[partial regression] Do not require a runtime in order to use `net` sockets**
  *Symptoms*: Some details and background https://github.com/libp2p/rust-libp2p/pull/1612#issuecomment-645886423
  **Post-Mortem & Fix Analysis**:
  > As far as I can tell, the issue is that resolving socketaddrs can block at the moment, meaning we need some kind of blocking executor.   To fully resolve this `getaddrinfo` needs to be async.   - on unix systems I believe we can do this using https://man7.org/linux/man-pages/man3/getaddrinfo_a.3.html - for osx there seems to be some ideas here:    - https://lists.gnu.org/archive/html/emacs-devel/2016-05/msg00526.html   - https://eggerapps.at/blog/2014/hostname-lookups.html - on windows we can use `GetAddrInfoEx` for newer (Vista and later) https://stackoverflow.com/questions/6998309/is-there-a-non-blocking-method-for-host-resolution-in-winapi  https://github.com/c-ares/c-ares has likely some good details under the hood as well   
  > there seems to be sth at least in android: https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/host/x86_64-linux-glibc2.7-4.6/+/refs/heads/jb-dev/sysroot/usr/include/netdb.h#661
  > After talking to @stjepang the dns resolution is not the actual issue, we need to ensure the reactor is actually running.

- **Issue #652** (2020-01-15): **docs for UdpSocket::send have same example as send_to**
  *Symptoms*: cf. https://docs.rs/async-std/1.4.0/async_std/net/struct.UdpSocket.html#method.send
  **Post-Mortem & Fix Analysis**:
  > Heh, looks like this is similar to https://github.com/async-rs/async-std/pull/603 where we missed another PR.
  > If no one else is working on it, I think I might have a go at this one.
  > Fix should be ready for review.

- **Issue #644** (2020-09-21): **Deadlock with recursive task::block_on**
  *Symptoms*: When calling `task::block_on` recursively, the executor seems to dead-lock even when the recursion depth is much smaller than num cpus.  Sample code (deadlocks on a 8-cpu machine):  ``` rust #[async_std::test] async fn test_async_deadlock() {     use std::future::Future;     use futures::FutureExt;     fn nth(n: usize) -> impl Future<Output=usize> + Send {         async move {             async_std::task::block_on(async move {                  if n == 0 {                     0                 } else {                     let fut = async_std::task::spawn(nth(n-1)).boxed();                     fut.await + 1                 }              })         }     }     let input = 2;     assert_eq!(nth(input).await, input); } ```  It seems that the test should deadlock when input >= num_cpus, but even when input=2, on a 8-cpu machine this seems to deadlock.  Is this expected behaviour?  Interestingly, input = 1 (which does involve a recursive call) does not deadlock.  If the `block_on` is removed, the test indeed passes for large input values.  Aside:  it would be great if the executor could detect `block_on` called within the pool processor threads, and spawn more threads.  The `block_on` could be considered an explicit hint that the particular worker is probably going to block.
  **Post-Mortem & Fix Analysis**:
  > I believe this should work with the new scheduler: https://github.com/async-rs/async-std/pull/631  Can you try running the test again with `async-std` from the `new-scheduler` branch?
  > @stjepang Absolutely!  Works in the `new-scheduler` branch.
  > Still there is some problem with recursive block_on.  It says in the documentation that   > Calling this function is similar to spawning a thread and immediately joining it, except an asynchronous task will be spawned.  But it is not true.  ```rust use async_std::{stream, sync, task};  use futures::select; use futures::{FutureExt, StreamExt};  use std::time::Duration;  fn main() {     let (close_tx, close_rx) = sync::channel::<()>(1);     task::spawn(async move {         task::sleep(Duration::from_secs(1)).await;         let _tx = close_tx;         println!("close_tx should be dropped");     });     task::block_on(async move {         let mut close_rx = close_rx.fuse();         select! {             _ = work().fuse() => (),             _ = close_rx.next() => (),         }     }); }  async fn work() {     let interval1 = stream::interval(Duration::from_millis(3000));     let interval2 = stream::interval(Duration::from_millis(2000));     // task::block_

- **Issue #620** (2019-12-16): **tests on master failing**
  *Symptoms*: Looks like #562 broke the tests; the double ended `from_iter` function was removed, and now tests on master are broken. https://github.com/async-rs/async-std/runs/347468653  cc/ @felipesere would you mind taking a look? Ideally `stream::FromIter` would implement:   ```rust impl <T: DoubleEndedStream> DoubleEndedStream for FromIter<T>; ```  so that things just work.
  **Post-Mortem & Fix Analysis**:
  > @yoshuawuyts this can be closed now? 😄  Thanks for fixing it.
  > Should be. Reopen if not true.

- **Issue #599** (2019-12-13): **`<TcpStream as Write>::poll_close` does nothing**
  *Symptoms*: It seems that `<TcpStream as Write>::poll_close` [calls](https://github.com/async-rs/async-std/blob/bf9ee8881542cc4b8e06e07145f3fd5ae2807216/src/net/tcp/stream.rs#L340) `<&TcpStream as Write>::poll_close` which is a no-op. Would it not be more appropriate to shutdown the write direction of the socket, i.e. call `TcpStream::shutdown` with `std::net::Shutdown::Write`? Otherwise two processes that wait on each others EOF will wait forever.
  **Post-Mortem & Fix Analysis**:
  > @twittner what you're suggesting seems reasonable; if you have the time, a patch for this would be greatly appreciated!

- **Issue #584** (2019-11-27): **fix Stream::throttle hot loop**
  *Symptoms*: Thanks to @matthias247 for identifying the issue, and @tekjar for reporting. Fixes #583. Updates the tests too to remove parts that are already well-covered by other tests. Thanks!

- **Issue #583** (2019-11-27): **Throttle results in 100% cpu**
  *Symptoms*: ```rust use async_std::stream::StreamExt; use async_std::sync::channel; use async_std::task;  use std::thread; use std::time::Duration;  #[async_std::main] async fn main() {     let (requests_tx, requests_rx) = channel::<i32>(10);     let mut requests_rx = requests_rx.throttle(Duration::from_secs(1));      thread::spawn(move || {         task::block_on( async {             for i in 0..5 {                 requests_tx.send(i).await;             }         });          thread::sleep(Duration::from_secs(100));     });      while let Some(item) = requests_rx.next().await {         println!("{:?}", item);     } } ```  ![Screenshot from 2019-11-24 16-25-27](https://user-images.githubusercontent.com/6826529/69493704-fdfa0580-0ed7-11ea-9408-d7c666de58e0.png) 
  **Post-Mortem & Fix Analysis**:
  > I was able to reproduce this locally in debug mode, uploaded a repro here: https://github.com/yoshuawuyts/repro-async-std-583.  __edit:__ seems the cause is `block_on` + the use of `thread::*`: https://github.com/async-rs/async-std/issues/583#issuecomment-557904492
  > Confirmed that this happens in release mode too.  ![2019-11-24-164539_1920x1080](https://user-images.githubusercontent.com/2467194/69497126-c4c29500-0ed9-11ea-8cbc-f922327a75dc.png)  I now suspect this is caused because `thread::sleep` is called, and our scheduler doesn't know how to handle that so it bounces the task around indefinitely. The spikes *seem* to be happening only once `thread::sleep` is hit.
  > When applying this patch:  ```diff diff --git a/src/main.rs b/src/main.rs index fa8dfed..b2d8e8a 100644 --- a/src/main.rs +++ b/src/main.rs @@ -8,7 +8,7 @@ use std::time::Duration;  #[async_std::main]  async fn main() {      let (requests_tx, requests_rx) = channel::<i32>(10); -    let mut requests_rx = requests_rx.throttle(Duration::from_secs(1)); +    let mut requests_rx = requests_rx.throttle(Duration::from_secs(10));        thread::spawn(move || {          task::block_on( async { ```  The output doesn't seem to spike, further corroborating the theory that this is caused by `thread::sleep` confusing the scheduler.  ![2019-11-24-164752_1920x1080](https://user-images.githubusercontent.com/2467194/69497160-3864a200-0eda-11ea-9bfb-a242c26786b9.png) 

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

### Incident Patch 1: `317c7ea6` (2024-09-10)
**Commit Message**: Merge pull request #1086 from jayvdb/fix-changelog

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ and this project adheres to [Semantic Versioning](https://book.async.rs/overview
 # [1.12.0] - 2022-06-18
 
 ## Added
-- `std::task::spawn_blocking` is now stabilized. We consider it a fundamental API for bridging between blocking code and async code, and we widely use it within async-std's own implementation.
+- `async_std::task::spawn_blocking` is now stabilized. We consider it a fundamental API for bridging between blocking code and async code, and we widely use it within async-std's own implementation.
 - Add `TryFrom` implementations to convert `TcpListener`, `TcpStream`, `UdpSocket`, `UnixDatagram`, `UnixListener`, and `UnixStream` to their synchronous equivalents, including putting them back into blocking mode.
 
 ## Changed
@@ -307,7 +307,7 @@ Including improved performance, stability, and the addition of various
 - Fixed documentation for `UdpSocket::send` ([#671](https://github.com/async-rs/async-std/pull/671))
 - Fixed typo in stream documentation ([#650](https://github.com/async-rs/async-std/pull/650))
 - Fixed typo on `sync::JoinHandle` documentation ([#659](https://github.com/async-rs/async-std/pull/659))
-- Removed use of `std::error::Error::description` which failed CI ([#661](https://github.com/async-rs/async-std/pull/662))
+- Removed use of `std::error::Error::description` which failed CI ([#661](https://github.com/async-rs/async-std/pull/661))
 - Removed the use of rustfmt's unstable `format_code_in_doc_comments` option which failed CI ([#685](https://github.com/async-rs/async-std/pull/685))
 - Fixed a code typo in the `task::sleep` example ([#688](https://github.com/async-rs/async-std/pull/688))
 
```

---

### Incident Patch 2: `340933b7` (2024-09-10)
**Commit Message**: Merge pull request #1088 from jayvdb/fix-rustdoc-lints

**File**: `src/lib.rs` (modified, +3/-2)
```diff
@@ -1,3 +1,4 @@
+#![allow(rustdoc::invalid_html_tags)]
 //! # Async version of the Rust standard library
 //!
 //! `async-std` is a foundation of portable Rust software, a set of minimal and battle-tested
@@ -191,7 +192,7 @@
 //! <span
 //!   class="module-item stab portability"
 //!   style="display: inline; border-radius: 3px; padding: 2px; font-size: 80%; line-height: 1.2;"
-//! ><code>unstable</code></span>
+//! > <code>unstable</code> </span>
 //! are available only when the `unstable` Cargo feature is enabled:
 //!
 //! ```toml
@@ -204,7 +205,7 @@
 //! <span
 //!   class="module-item stab portability"
 //!   style="display: inline; border-radius: 3px; padding: 2px; font-size: 80%; line-height: 1.2;"
-//! ><code>attributes</code></span>
+//! > <code>attributes</code> </span>
 //! are available only when the `attributes` Cargo feature is enabled:
 //!
 //! ```toml
```

**File**: `src/sync/mod.rs` (modified, +2/-2)
```diff
@@ -95,9 +95,9 @@
 //!   at the same time: In multi-threaded scenarios, you can use two
 //!   kinds of primitives to deal with synchronization:
 //!   - [memory fences] to ensure memory accesses are made visible to
-//!   other CPUs in the right order.
+//!     other CPUs in the right order.
 //!   - [atomic operations] to ensure simultaneous access to the same
-//!   memory location doesn't lead to undefined behavior.
+//!     memory location doesn't lead to undefined behavior.
 //!
 //! [prefetching]: https://en.wikipedia.org/wiki/Cache_prefetching
 //! [compiler fences]: https://doc.rust-lang.org/std/sync/atomic/fn.compiler_fence.html
```

**File**: `src/task/block_on.rs` (modified, +3/-5)
```diff
@@ -19,11 +19,9 @@ use crate::task::Builder;
 /// ```no_run
 /// use async_std::task;
 ///
-/// fn main() {
-///     task::block_on(async {
-///         println!("Hello, world!");
-///     })
-/// }
+/// task::block_on(async {
+///     println!("Hello, world!");
+/// })
 /// ```
 #[cfg(not(target_os = "unknown"))]
 pub fn block_on<F, T>(future: F) -> T
```

---

### Incident Patch 3: `6fd12780` (2024-09-08)
**Commit Message**: chore: Fix rustdoc lints

**File**: `src/lib.rs` (modified, +3/-2)
```diff
@@ -1,3 +1,4 @@
+#![allow(rustdoc::invalid_html_tags)]
 //! # Async version of the Rust standard library
 //!
 //! `async-std` is a foundation of portable Rust software, a set of minimal and battle-tested
@@ -191,7 +192,7 @@
 //! <span
 //!   class="module-item stab portability"
 //!   style="display: inline; border-radius: 3px; padding: 2px; font-size: 80%; line-height: 1.2;"
-//! ><code>unstable</code></span>
+//! > <code>unstable</code> </span>
 //! are available only when the `unstable` Cargo feature is enabled:
 //!
 //! ```toml
@@ -204,7 +205,7 @@
 //! <span
 //!   class="module-item stab portability"
 //!   style="display: inline; border-radius: 3px; padding: 2px; font-size: 80%; line-height: 1.2;"
-//! ><code>attributes</code></span>
+//! > <code>attributes</code> </span>
 //! are available only when the `attributes` Cargo feature is enabled:
 //!
 //! ```toml
```

**File**: `src/sync/mod.rs` (modified, +2/-2)
```diff
@@ -95,9 +95,9 @@
 //!   at the same time: In multi-threaded scenarios, you can use two
 //!   kinds of primitives to deal with synchronization:
 //!   - [memory fences] to ensure memory accesses are made visible to
-//!   other CPUs in the right order.
+//!     other CPUs in the right order.
 //!   - [atomic operations] to ensure simultaneous access to the same
-//!   memory location doesn't lead to undefined behavior.
+//!     memory location doesn't lead to undefined behavior.
 //!
 //! [prefetching]: https://en.wikipedia.org/wiki/Cache_prefetching
 //! [compiler fences]: https://doc.rust-lang.org/std/sync/atomic/fn.compiler_fence.html
```

**File**: `src/task/block_on.rs` (modified, +3/-5)
```diff
@@ -19,11 +19,9 @@ use crate::task::Builder;
 /// ```no_run
 /// use async_std::task;
 ///
-/// fn main() {
-///     task::block_on(async {
-///         println!("Hello, world!");
-///     })
-/// }
+/// task::block_on(async {
+///     println!("Hello, world!");
+/// })
 /// ```
 #[cfg(not(target_os = "unknown"))]
 pub fn block_on<F, T>(future: F) -> T
```

---

### Incident Patch 4: `355ce266` (2024-09-08)
**Commit Message**: docs: Minor fixes to CHANGELOG.md

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ and this project adheres to [Semantic Versioning](https://book.async.rs/overview
 # [1.12.0] - 2022-06-18
 
 ## Added
-- `std::task::spawn_blocking` is now stabilized. We consider it a fundamental API for bridging between blocking code and async code, and we widely use it within async-std's own implementation.
+- `async_std::task::spawn_blocking` is now stabilized. We consider it a fundamental API for bridging between blocking code and async code, and we widely use it within async-std's own implementation.
 - Add `TryFrom` implementations to convert `TcpListener`, `TcpStream`, `UdpSocket`, `UnixDatagram`, `UnixListener`, and `UnixStream` to their synchronous equivalents, including putting them back into blocking mode.
 
 ## Changed
@@ -307,7 +307,7 @@ Including improved performance, stability, and the addition of various
 - Fixed documentation for `UdpSocket::send` ([#671](https://github.com/async-rs/async-std/pull/671))
 - Fixed typo in stream documentation ([#650](https://github.com/async-rs/async-std/pull/650))
 - Fixed typo on `sync::JoinHandle` documentation ([#659](https://github.com/async-rs/async-std/pull/659))
-- Removed use of `std::error::Error::description` which failed CI ([#661](https://github.com/async-rs/async-std/pull/662))
+- Removed use of `std::error::Error::description` which failed CI ([#661](https://github.com/async-rs/async-std/pull/661))
 - Removed the use of rustfmt's unstable `format_code_in_doc_comments` option which failed CI ([#685](https://github.com/async-rs/async-std/pull/685))
 - Fixed a code typo in the `task::sleep` example ([#688](https://github.com/async-rs/async-std/pull/688))
 
```

---

### Incident Patch 5: `590386a3` (2024-08-21)
**Commit Message**: Fix compilation errors with `feature = io_safety`.

Fix a typo of "io-safety" in place of "io_safety", and fix various
compilation errors exposed by this fix.

**File**: `src/fs/file.rs` (modified, +1/-1)
```diff
@@ -461,7 +461,7 @@ cfg_unix! {
 
         impl From<File> for OwnedFd {
             fn from(val: File) -> OwnedFd {
-                self.into_std_file().into()
+                val.into_std_file().into()
             }
         }
     }
```

**File**: `src/io/stderr.rs` (modified, +3/-1)
```diff
@@ -186,7 +186,9 @@ cfg_unix! {
 
         impl AsFd for Stderr {
             fn as_fd(&self) -> BorrowedFd<'_> {
-                std::io::stderr().as_fd()
+                unsafe {
+                    BorrowedFd::borrow_raw(std::io::stderr().as_raw_fd())
+                }
             }
         }
     }
```

**File**: `src/io/stdin.rs` (modified, +4/-2)
```diff
@@ -210,9 +210,11 @@ cfg_unix! {
     cfg_io_safety! {
         use crate::os::unix::io::{AsFd, BorrowedFd};
 
-        impl AsFd for Stderr {
+        impl AsFd for Stdin {
             fn as_fd(&self) -> BorrowedFd<'_> {
-                std::io::stdin().as_fd()
+                unsafe {
+                    BorrowedFd::borrow_raw(std::io::stdin().as_raw_fd())
+                }
             }
         }
     }
```

**File**: `src/io/stdout.rs` (modified, +3/-1)
```diff
@@ -186,7 +186,9 @@ cfg_unix! {
 
         impl AsFd for Stdout {
             fn as_fd(&self) -> BorrowedFd<'_> {
-                std::io::stdout().as_fd()
+                unsafe {
+                    BorrowedFd::borrow_raw(std::io::stdout().as_raw_fd())
+                }
             }
         }
     }
```

**File**: `src/net/tcp/stream.rs` (modified, +1/-1)
```diff
@@ -434,7 +434,7 @@ cfg_unix! {
 
         impl From<TcpStream> for OwnedFd {
             fn from(stream: TcpStream) -> OwnedFd {
-                stream.watcher.into_inner().unwrap().into()
+                stream.watcher.get_ref().try_clone().unwrap().into()
             }
         }
     }
```

---

### Incident Patch 6: `0633c94c` (2024-08-20)
**Commit Message**: Fix typos

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -686,9 +686,9 @@ use async_std::prelude::*;
 use async_std::task;
 
 task::spawn(async {
-    let x = fibonnacci(1000); // Do expensive work
+    let x = fibonacci(1000); // Do expensive work
     task::yield_now().await;  // Allow other tasks to run
-    x + fibonnacci(100)       // Do more work
+    x + fibonacci(100)       // Do more work
 })
 ```
 
```

**File**: `src/stream/successors.rs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ pin_project! {
     ///
     /// This stream is constructed by [`successors`] function
     ///
-    /// [`successors`]: fn.succssors.html
+    /// [`successors`]: fn.successors.html
     #[cfg(feature = "unstable")]
     #[cfg_attr(feature = "docs", doc(cfg(unstable)))]
     #[derive(Debug)]
```

---

### Incident Patch 7: `2e8c5792` (2023-11-26)
**Commit Message**: Fix typo: at a time instead of at time

**File**: `docs/src/tutorial/receiving_messages.md` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ handle.await?
 The `.await` waits until the client finishes, and `?` propagates the result.
 
 There are two problems with this solution however!
-*First*, because we immediately await the client, we can only handle one client at time, and that completely defeats the purpose of async!
+*First*, because we immediately await the client, we can only handle one client at a time, and that completely defeats the purpose of async!
 *Second*, if a client encounters an IO error, the whole server immediately exits.
 That is, a flaky internet connection of one peer brings down the whole chat room!
 
```

---

### Incident Patch 8: `bbde18ff` (2023-11-23)
**Commit Message**: fix CI for recent rustc

Allow for unused `pub use` in experimental API which doesn't have its mods public for noiw.
MIPS CI is fully broken (doesn't find the MIPS toolchain) so disable it for now.
Reenable powerpc64 which is no longer broken

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -132,8 +132,8 @@ jobs:
         target:
           - i686-unknown-linux-gnu
           - powerpc-unknown-linux-gnu
-#          - powerpc64-unknown-linux-gnu
-          - mips-unknown-linux-gnu
+          - powerpc64-unknown-linux-gnu
+#          - mips-unknown-linux-gnu
           - arm-linux-androideabi
 
     steps:
```

**File**: `src/collections/mod.rs` (modified, +7/-0)
```diff
@@ -11,10 +11,17 @@ pub mod hash_set;
 pub mod linked_list;
 pub mod vec_deque;
 
+#[allow(unused)]
 pub use binary_heap::BinaryHeap;
+#[allow(unused)]
 pub use btree_map::BTreeMap;
+#[allow(unused)]
 pub use btree_set::BTreeSet;
+#[allow(unused)]
 pub use hash_map::HashMap;
+#[allow(unused)]
 pub use hash_set::HashSet;
+#[allow(unused)]
 pub use linked_list::LinkedList;
+#[allow(unused)]
 pub use vec_deque::VecDeque;
```

**File**: `src/option/mod.rs` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 
 mod from_stream;
 
+#[allow(unused)]
 #[doc(inline)]
 pub use std::option::Option;
 
```

**File**: `src/result/mod.rs` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 
 mod from_stream;
 
+#[allow(unused)]
 #[doc(inline)]
 pub use std::result::Result;
 
```

**File**: `src/string/mod.rs` (modified, +1/-0)
```diff
@@ -5,5 +5,6 @@
 mod extend;
 mod from_stream;
 
+#[allow(unused)]
 #[doc(inline)]
 pub use std::string::String;
```

---

### Incident Patch 9: `dc7bb8e9` (2023-04-30)
**Commit Message**: Fix minor issues

**File**: `src/fs/file.rs` (modified, +12/-11)
```diff
@@ -415,7 +415,16 @@ impl From<std::fs::File> for File {
 }
 
 cfg_unix! {
-    use crate::os::unix::io::{AsRawFd, FromRawFd, IntoRawFd, RawFd};    
+    use crate::os::unix::io::{AsRawFd, FromRawFd, IntoRawFd, RawFd};
+
+    impl File {
+        fn into_std_file(self) -> std::fs::File {
+            let file = self.file.clone();
+            drop(self);
+            Arc::try_unwrap(file)
+                .expect(ARC_TRY_UNWRAP_EXPECT)
+        }
+    }
 
     impl AsRawFd for File {
         fn as_raw_fd(&self) -> RawFd {
@@ -431,11 +440,7 @@ cfg_unix! {
 
     impl IntoRawFd for File {
         fn into_raw_fd(self) -> RawFd {
-            let file = self.file.clone();
-            drop(self);
-            Arc::try_unwrap(file)
-                .expect(ARC_TRY_UNWRAP_EXPECT)
-                .into_raw_fd()
+            self.into_std_file().into_raw_fd()
         }
     }
 
@@ -456,11 +461,7 @@ cfg_unix! {
 
         impl From<File> for OwnedFd {
             fn from(val: File) -> OwnedFd {
-                let file = val.file.clone();
-                drop(val);
-                Arc::try_unwrap(file)
-                    .expect(ARC_TRY_UNWRAP_EXPECT)
-                    .into()
+                self.into_std_file()
             }
         }
     }
```

---

### Incident Patch 10: `707fd534` (2023-04-07)
**Commit Message**: Merge pull request #1056 from Enselic/prevent-lock-guard-races

Prevent races between dropping File LockGuard and waking its tasks

**File**: `src/fs/file.rs` (modified, +26/-7)
```diff
@@ -517,14 +517,16 @@ impl<T> Lock<T> {
         }
 
         // The lock was successfully acquired.
-        Poll::Ready(LockGuard(self.0.clone()))
+        Poll::Ready(LockGuard(Some(self.0.clone())))
     }
 }
 
 /// A lock guard.
 ///
 /// When dropped, ownership of the inner value is returned back to the lock.
-struct LockGuard<T>(Arc<LockState<T>>);
+/// The inner value is always Some, except when the lock is dropped, where we
+/// set it to None. See comment in drop().
+struct LockGuard<T>(Option<Arc<LockState<T>>>);
 
 unsafe impl<T: Send> Send for LockGuard<T> {}
 unsafe impl<T: Sync> Sync for LockGuard<T> {}
@@ -534,7 +536,7 @@ impl<T> LockGuard<T> {
     ///
     /// When this lock guard gets dropped, all registered tasks will be woken up.
     fn register(&self, cx: &Context<'_>) {
-        let mut list = self.0.wakers.lock().unwrap();
+        let mut list = self.0.as_ref().unwrap().wakers.lock().unwrap();
 
         if list.iter().all(|w| !w.will_wake(cx.waker())) {
             list.push(cx.waker().clone());
@@ -544,11 +546,22 @@ impl<T> LockGuard<T> {
 
 impl<T> Drop for LockGuard<T> {
     fn drop(&mut self) {
+        // Set the Option to None and take its value so we can drop the Arc
+        // before we wake up the tasks.
+        let lock = self.0.take().unwrap();
+
+        // Prepare to wake up all registered tasks interested in acquiring the lock.
+        let wakers: Vec<_> = lock.wakers.lock().unwrap().drain(..).collect();
+
         // Release the lock.
-        self.0.locked.store(false, Ordering::Release);
+        lock.locked.store(false, Ordering::Release);
+
+        // Drop the Arc _before_ waking up the tasks, to avoid races. See
+        // reproducer and discussion in https://github.com/async-rs/async-std/issues/1001.
+        drop(lock);
 
         // Wake up all registered tasks interested in acquiring the lock.
-        for w in self.0.wakers.lock().unwrap().drain(..) {
+        for w in wakers {
             w.wake();
         }
     }
@@ -558,13 +571,19 @@ impl<T> Deref for LockGuard<T> {
     type Target = T;
 
     fn deref(&self) -> &T {
-        unsafe { &*self.0.value.get() }
+        // SAFETY: Safe because the lock is held when this method is called. And
+        // the inner value is always Some since it is only set to None in
+        // drop().
+        unsafe { &*self.0.as_ref().unwrap().value.get() }
     }
 }
 
 impl<T> DerefMut for LockGuard<T> {
     fn deref_mut(&mut self) -> &mut T {
-        unsafe { &mut *self.0.value.get() }
+        // SAFETY: Safe because the lock is held when this method is called. And
+        // the inner value is always Some since it is only set to None in
+        // drop().
+        unsafe { &mut *self.0.as_ref().unwrap().value.get() }
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #1099** (2025-03-15): Officially sunset async-std (@joshtriplett)
- **PR #1091** (2024-09-11): Add MSRV 1.63 to CI (@jayvdb)
- **PR #1088** (2024-09-10): chore: Fix rustdoc lints (@jayvdb)
- **PR #1087** (2024-09-10): Add rust-version 1.63 (@jayvdb)
- **PR #1086** (2024-09-10): docs: Minor fixes to CHANGELOG.md (@jayvdb)
- **PR #1085** (2024-08-21): Fix the CI (@Keruspe)
- **PR #1084** (2024-08-21): Fix compilation errors with `feature = io_safety`. (@sunfishcode)
- **PR #1083** (2024-09-06): Prepare 1.13.0 release (@Keruspe)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
