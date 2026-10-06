# Forensic Learning Record (Deep Inspection): gotham-rs/gotham

> **Canonical Artifact**: `07_PROJECT_LEARNING/gotham-rs-gotham-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gotham-rs/gotham](https://github.com/gotham-rs/gotham))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:00:53.135Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gotham-rs/gotham`
- **Description**: A flexible web framework that promotes stability, safety, security and speed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2314 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/handlers/stateful/src/main.rs`
```
//! An example of using stateful handlers with the Gotahm web framework.

#![allow(clippy::mutex_atomic)]

use futures_util::future::{self, FutureExt};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use gotham::anyhow;
use gotham::handler::{Handler, HandlerFuture, NewHandler};
use gotham::prelude::*;
use gotham::router::{build_simple_router, Router};
use gotham::state::State;

// A struct which can store the state which it needs.
#[derive(Clone)]
struct CountingHandler {
    // Record what time the server started.
    // started_at will never change, so we can just store its value.
    started_at: SystemTime,
    // Count how many visits have been made to the server.
    // visits will change each time the handler is called, so we need to wrap it an an Arc of a
    // Mutex so that we can control concurrent access to it.
    visits: Arc<Mutex<usize>>,
}

impl CountingHandler {
    fn new() -> CountingHandler {
        CountingHandler {
            started_at: SystemTime::now(),
            visits: Arc::new(Mutex::new(0)),
        }
    }
}

impl Handler for CountingHandler {
    fn handle(self, state: State) -> Pin<Box<HandlerFuture>> {
        let uptime = SystemTime::now().duration_since(self.started_at).unwrap();

        // Create a short scope so that self.visits will only be locked for long enough to
        // increment it, so that other calls to the handler can be processed in parallel.
        let visits = {
            let mut v = self.visits.lock().unwrap();
            *v += 1;
            *v
        };

        let response_text = format!(
            "This server has been up for {} second(s). This is visit number {}.\n",
            uptime.as_secs(),
            visits
        );

        let response = response_text.into_response(&state);

        future::ok((state, response)).boxed()
    }
}

impl NewHandler for CountingHandler {
    type Instance = Self;

    fn new_handler(&self) -> anyhow::Result<Self::Instance> {
        Ok(self.clone())
    }
}

/// Create a `Router`
fn router() -> Router {
    build_simple_router(|route| route.get("/").to_new_handler(CountingHandler::new()))
}

/// Start a server and use a `Router` to dispatch requests
pub fn main() {
    let addr = "127.0.0.1:7878";
    println!("Listening for requests at http://{}", addr);
    gotham::start(addr, router()).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use gotham::http::StatusCode;
    use gotham::test::TestServer;

    #[test]
    fn counter_increments_per_request() {
        let test_server = TestServer::new(router()).unwrap();
        let response = test_server
            .client()
            .get("http://localhost/")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response.read_utf8_body().unwrap();
        assert!(
            body.ends_with("This is visit number 1.\n"),
            "Wrong number of visits in first response string: {}",
            body
        );

        let response = test_server
            .client()
            .get("http://localhost/")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response.read_utf8_body().unwrap();
        assert!(
            body.ends_with("This is visit number 2.\n"),
            "Wrong number of visits in second response string: {}",
            body
        );
    }
}

```

### Core Architecture Module: `examples/shared_state/src/main.rs`
```
//! An introduction to sharing state across handlers in a safe way.
//!
//! This example demonstrates a basic request counter which can be
//! used across server threads, and be used to track the number of
//! requests sent to the backend.

#![allow(clippy::mutex_atomic)]

use gotham::middleware::state::StateMiddleware;
use gotham::pipeline::{single_middleware, single_pipeline};
use gotham::prelude::*;
use gotham::router::{build_router, Router};
use gotham::state::State;

use std::sync::{Arc, Mutex};

/// Request counting struct, used to track the number of requests made.
///
/// Due to being shared across many worker threads, the internal counter
/// is bound inside an `Arc` (to enable sharing) and a `Mutex` (to enable
/// modification from multiple threads safely).
///
/// This struct must implement `Clone` and `StateData` to be applicable
/// for use with the `StateMiddleware`, and be shared via `Middleware`.
#[derive(Clone, StateData)]
struct RequestCounter {
    inner: Arc<Mutex<usize>>,
}

/// Counter implementation.
impl RequestCounter {
    /// Creates a new request counter, setting the base state to `0`.
    fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(0)),
        }
    }

    /// Increments the internal counter state by `1`, and returns the
    /// new request counter as an atomic operation.
    fn incr(&self) -> usize {
        let mut w = self.inner.lock().unwrap();
        *w += 1;
        *w
    }
}

/// Basic `Handler` to say hello and return the current request count.
///
/// The request counter is shared via the state, so we can safely
/// borrow one from the provided state. As the counter uses locks
/// internally, we don't have to borrow a mutable reference either!
fn say_hello(state: State) -> (State, String) {
    let message = {
        // borrow a reference of the counter from the state
        let counter = RequestCounter::borrow_from(&state);

        // create our message, incrementing our request counter
        format!("Hello from request #{}!\n", counter.incr())
    };

    // return message
    (state, message)
}

/// Constructs a simple router on `/` to say hello, along with
/// the current request count.
fn router() -> Router {
    // create the counter to share across handlers
    let counter = RequestCounter::new();

    // create our state middleware to share the counter
    let middleware = StateMiddleware::new(counter);

    // create a middleware pipeline from our middleware
    let pipeline = single_middleware(middleware);

    // construct a basic chain from our pipeline
    let (chain, pipelines) = single_pipeline(pipeline);

    // build a router with the chain & pipeline
    build_router(chain, pipelines, |route| {
        route.get("/").to(say_hello);
    })
}

/// Start a server and call the `Handler` we've defined above
/// for each `Request` we receive.
pub fn main() {
    let addr = "127.0.0.1:7878";
    println!("Listening for requests at http://{}", addr);
    gotham::start(addr, router()).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use gotham::http::StatusCode;
    use gotham::test::TestServer;

    #[test]
    fn receive_incrementing_hello_response() {
        let test_server = TestServer::new(router()).unwrap();

        for i in 1..6 {
            let response = test_server
                .client()
                .get("http://localhost")
                .perform()
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);

            let body = response.read_body().unwrap();
            let expc = format!("Hello from request #{}!\n", i);

            assert_eq!(&body[..], expc.as_bytes());
        }
    }
}

```

### Core Architecture Module: `gotham/src/middleware/state.rs`
```
//! State driven middleware to enable attachment of values to request state.
//!
//! This module provides generics to enable attaching (appropriate) values to
//! the state of a request, through the use of `Middleware`. Middleware can
//! be created via `StateMiddleware::with`, with the provided value being the
//! value to attach to the request state.
use crate::handler::HandlerFuture;
use crate::middleware::{Middleware, NewMiddleware};
use crate::state::{State, StateData};
use std::panic::RefUnwindSafe;
use std::pin::Pin;

/// Middleware binding for generic types to enable easy shared state.
///
/// This acts as nothing more than a `Middleware` instance which will
/// attach a generic type to a request `State`, however it removes a
/// barrier for users to Gotham who might not know the internals.
///
/// The generic types inside this struct can (and will) be cloned
/// often, so wrap your expensive types in reference counts as needed.
#[derive(Clone)]
pub struct StateMiddleware<T>
where
    T: Clone + RefUnwindSafe + StateData + Sync,
{
    t: T,
}

/// Main implementation.
impl<T> StateMiddleware<T>
where
    T: Clone + RefUnwindSafe + StateData + Sync,
{
    /// Creates a new middleware binding, taking ownership of the state data.
    pub fn new(t: T) -> Self {
        Self { t }
    }
}

/// `Middleware` trait implementation.
impl<T> Middleware for StateMiddleware<T>
where
    T: Clone + RefUnwindSafe + StateData + Sync,
{
    /// Attaches the inner generic value to the request state.
    ///
    /// This will enable the `Handler` to borrow the value directly from the state.
    fn call<Chain>(self, mut state: State, chain: Chain) -> Pin<Box<HandlerFuture>>
    where
        Chain: FnOnce(State) -> Pin<Box<HandlerFuture>>,
    {
        state.put(self.t);
        chain(state)
    }
}

/// `NewMiddleware` trait implementation.
impl<T> NewMiddleware for StateMiddleware<T>
where
    T: Clone + RefUnwindSafe + StateData + Sync,
{
    type Instance = Self;

    /// Clones the current middleware to a new instance.
    fn new_middleware(&self) -> anyhow::Result<Self::Instance> {
        Ok(self.clone())
    }
}

```

### Core Architecture Module: `gotham/src/state/client_addr.rs`
```
//! Defines storage for the remote address of the client

use crate::state::{FromState, State, StateData};
use std::net::SocketAddr;

struct ClientAddr {
    addr: SocketAddr,
}

impl StateData for ClientAddr {}

pub(crate) fn put_client_addr(state: &mut State, addr: SocketAddr) {
    state.put(ClientAddr { addr })
}

/// Returns the client `SocketAddr` as reported by hyper, if one was present. Certain connections
/// do not report a client address, in which case this will return `None`.
///
/// # Examples
///
/// ```rust
/// # extern crate gotham;
/// # extern crate hyper;
/// # extern crate mime;
/// #
/// # use http::{Response, StatusCode};
/// # use gotham::helpers::http::Body;
/// # use gotham::helpers::http::response::create_response;
/// # use gotham::state::{State, client_addr};
/// # use gotham::test::TestServer;
/// #
/// fn my_handler(state: State) -> (State, Response<Body>) {
///     let addr = client_addr(&state).expect("no client address");
///
///     let body = format!("{}", addr);
///     let response = create_response(
///         &state,
///         StatusCode::OK,
///         mime::TEXT_PLAIN,
///         body,
///     );
///
///     (state, response)
/// }
/// #
/// # fn main() {
/// #   let test_server = TestServer::new(|| Ok(my_handler)).unwrap();
/// #   let response = test_server
/// #       .client()
/// #       .get("http://localhost/")
/// #       .perform()
/// #       .unwrap();
/// #
/// #   assert_eq!(response.status(), StatusCode::OK);
/// #
/// #   let buf = response.read_body().unwrap();
/// #   // at the moment, can't actually force the client address
/// #   assert!(buf.starts_with(b"127.0.0.1"));
/// # }
pub fn client_addr(state: &State) -> Option<SocketAddr> {
    ClientAddr::try_borrow_from(state).map(|c| c.addr)
}

```

### Core Architecture Module: `gotham/src/state/data.rs`
```
use std::any::Any;
use std::io;

use bytes::Bytes;
use cookie::CookieJar;
use http::{HeaderMap, Method, Uri, Version};
use http_body_util::combinators::UnsyncBoxBody;
use hyper::upgrade::OnUpgrade;

use crate::helpers::http::request::path::RequestPathSegments;
use crate::state::request_id::RequestId;

#[cfg(feature = "derive")]
pub use gotham_derive::StateData;

/// A marker trait for types that can be stored in `State`.
///
/// This is typically implemented using `#[derive(StateData)]`.
///
/// ```rust
/// # use gotham::state::{FromState, State};
/// use gotham::state::StateData;
///
/// #[derive(StateData)]
/// struct MyStateData {
///     x: u32,
/// }
/// # fn main() {
/// #   State::with_new(|state| {
/// #       state.put(MyStateData { x: 1 });
/// #       assert_eq!(MyStateData::borrow_from(state).x, 1);
/// #   });
/// # }
/// ```
pub trait StateData: Any + Send {}

impl StateData for UnsyncBoxBody<Bytes, io::Error> {}
impl StateData for Method {}
impl StateData for Uri {}
impl StateData for Version {}
impl StateData for HeaderMap {}
impl StateData for CookieJar {}
impl StateData for OnUpgrade {}

impl StateData for RequestPathSegments {}
impl StateData for RequestId {}

```

### Core Architecture Module: `gotham/src/state/from_state.rs`
```
use crate::state::{State, StateData};

/// A trait for accessing data that is stored in `State`.
///
/// This provides the easier `T::try_borrow_from(&state)` API (for example), as an alternative to
/// `state.try_borrow::<T>()`.
pub trait FromState: StateData + Sized {
    /// Tries to borrow a value from the `State` storage.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// match MyStruct::try_borrow_from(&state) {
    ///     Some(&MyStruct { val }) => assert_eq!(val, "This is the value!"),
    ///     _ => panic!("expected `MyStruct` to be present"),
    /// }
    /// # });
    /// # }
    /// ```
    fn try_borrow_from(state: &State) -> Option<&Self>;

    /// Borrows a value from the `State` storage.
    ///
    /// # Panics
    ///
    /// If `Self` is not present in `State`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// let my_struct = MyStruct::borrow_from(&state);
    /// assert_eq!(my_struct.val, "This is the value!");
    /// # });
    /// # }
    /// ```
    fn borrow_from(state: &State) -> &Self;

    /// Tries to mutably borrow a value from the `State` storage.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|mut state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// match MyStruct::try_borrow_mut_from(&mut state) {
    ///     Some(&mut MyStruct { ref mut val }) => *val = "This is the new value!",
    ///     _ => panic!("expected `MyStruct` to be present"),
    /// }
    /// #
    /// # assert_eq!(MyStruct::borrow_from(&state).val, "This is the new value!");
    /// # });
    /// # }
    /// ```
    fn try_borrow_mut_from(state: &mut State) -> Option<&mut Self>;

    /// Mutably borrows a value from the `State` storage.
    ///
    /// # Panics
    ///
    /// If `Self` is not present in `State`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|mut state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// # {
    /// let my_struct = MyStruct::borrow_mut_from(&mut state);
    /// my_struct.val = "This is the new value!";
    /// # }
    /// # assert_eq!(MyStruct::borrow_from(&state).val, "This is the new value!");
    /// # });
    /// # }
    /// ```
    fn borrow_mut_from(state: &mut State) -> &mut Self;

    /// Tries to move a value out of the `State` storage and return ownership.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|mut state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// match MyStruct::try_take_from(&mut state) {
    ///     Some(MyStruct { val }) => assert_eq!(val, "This is the value!"),
    ///     _ => panic!("expected `MyStruct` to be present"),
    /// }
    /// # });
    /// # }
    /// ```
    fn try_take_from(state: &mut State) -> Option<Self>;

    /// Moves a value out of the `State` storage and returns ownership.
    ///
    /// # Panics
    ///
    /// If `Self` is not present in `State`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::{FromState, State};
    /// #
    /// # fn main() {
    /// #[derive(StateData, Eq, PartialEq, Debug)]
    /// struct MyStruct {
    ///     val: &'static str,
    /// }
    ///
    /// # State::with_new(|mut state| {
    /// state.put(MyStruct {
    ///     val: "This is the value!",
    /// });
    ///
    /// let my_struct = MyStruct::take_from(&mut state);
    /// assert_eq!(my_struct.val, "This is the value!");
    /// # });
    /// # }
    /// ```
    fn take_from(state: &mut State) -> Self;
}

impl<T> FromState for T
where
    T: StateData,
{
    fn try_borrow_from(state: &State) -> Option<&Self> {
        state.try_borrow()
    }

    fn borrow_from(state: &State) -> &Self {
        state.borrow()
    }

    fn try_borrow_mut_from(state: &mut State) -> Option<&mut Self> {
        state.try_borrow_mut()
    }

    fn borrow_mut_from(state: &mut State) -> &mut Self {
        state.borrow_mut()
    }

    fn try_take_from(state: &mut State) -> Option<Self> {
        state.try_take()
    }

    fn take_from(state: &mut State) -> Self {
        state.take()
    }
}

```

### Core Architecture Module: `gotham/src/state/mod.rs`
```
//! Defines types for passing request state through `Middleware` and `Handler` implementations

pub(crate) mod client_addr;
mod data;
mod from_state;
mod request_id;

use bytes::Bytes;
use http::{request, Request};
use http_body::Body as HttpBody;
use http_body_util::combinators::UnsyncBoxBody;
use http_body_util::BodyExt as _;
use hyper::upgrade::OnUpgrade;
use log::{debug, trace};
use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};
use std::io;
use std::net::SocketAddr;

pub use crate::state::client_addr::client_addr;
pub use crate::state::data::StateData;
pub use crate::state::from_state::FromState;
pub use crate::state::request_id::request_id;

use crate::helpers::http::request::path::RequestPathSegments;
use crate::state::client_addr::put_client_addr;
pub(crate) use crate::state::request_id::set_request_id;

// https://docs.rs/http/0.2.5/src/http/extensions.rs.html#8-28
// With TypeIds as keys, there's no need to hash them. They are already hashes
// themselves, coming from the compiler. The IdHasher just holds the u64 of
// the TypeId, and then returns it, instead of doing any bit fiddling.
#[derive(Default)]
struct IdHasher(u64);

impl Hasher for IdHasher {
    fn write(&mut self, _: &[u8]) {
        unreachable!("TypeId calls write_u64");
    }

    #[inline]
    fn write_u64(&mut self, id: u64) {
        self.0 = id;
    }

    #[inline]
    fn finish(&self) -> u64 {
        self.0
    }
}

/// Provides storage for request state, and stores one item of each type. The types used for
/// storage must implement the [`StateData`] trait to allow its storage, which is usually done
/// by adding `#[derive(StateData)]` on the type in question.
///
/// # Examples
///
/// ```rust
/// use gotham::state::{State, StateData};
///
/// #[derive(StateData)]
/// struct MyStruct {
///     value: i32,
/// }
/// # fn main() {
/// #   State::with_new(|state| {
/// #
/// state.put(MyStruct { value: 1 });
/// assert_eq!(state.borrow::<MyStruct>().value, 1);
/// #
/// #   });
/// # }
/// ```
pub struct State {
    data: HashMap<TypeId, Box<dyn Any + Send>, BuildHasherDefault<IdHasher>>,
}

impl State {
    /// Creates a new, empty `State` container. This is for internal Gotham use, because the
    /// ability to create a new `State` container would allow for libraries and applications to
    /// incorrectly discard important internal data.
    pub(crate) fn new() -> State {
        State {
            data: HashMap::default(),
        }
    }

    /// Creates a new, empty `State` and yields it mutably into the provided closure. This is
    /// intended only for use in the documentation tests for `State`, since the `State` container
    /// cannot be constructed otherwise.
    #[doc(hidden)]
    pub fn with_new<F>(f: F)
    where
        F: FnOnce(&mut State),
    {
        f(&mut State::new())
    }

    /// Instantiate a new `State` for a given `Request`. This is primarily useful if you're calling
    /// Gotham from your own Hyper service.
    pub fn from_request<B>(req: Request<B>, client_addr: SocketAddr) -> Self
    where
        B: HttpBody<Data = Bytes> + Send + 'static,
        B::Error: std::error::Error + Send + Sync,
    {
        let mut state = Self::new();

        put_client_addr(&mut state, client_addr);

        let (
            request::Parts {
                method,
                uri,
                version,
                headers,
                mut extensions,
                ..
            },
            body,
        ) = req.into_parts();

        state.put(RequestPathSegments::new(uri.path()));
        state.put(method);
        state.put(uri);
        state.put(version);
        state.put(headers);
        state.put(UnsyncBoxBody::new(body.map_err(io::Error::other)));

        if let Some(on_upgrade) = extensions.remove::<OnUpgrade>() {
            state.put(on_upgrade);
        }

        {
            let request_id = set_request_id(&mut state);
            debug!(
                "[DEBUG][{}][Thread][{:?}]",
                request_id,
                std::thread::current().id(),
            );
        };

        state
    }

    /// Puts a value into the `State` storage. One value of each type is retained. Successive calls
    /// to `put` will overwrite the existing value of the same type.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # #[derive(StateData)]
    /// # struct AnotherStruct {
    /// #     value: &'static str
    /// # }
    /// #
    /// # fn main() {
    /// #   State::with_new(|state| {
    /// #
    /// state.put(MyStruct { value: 1 });
    /// assert_eq!(state.borrow::<MyStruct>().value, 1);
    ///
    /// state.put(AnotherStruct { value: "a string" });
    /// state.put(MyStruct { value: 100 });
    ///
    /// assert_eq!(state.borrow::<AnotherStruct>().value, "a string");
    /// assert_eq!(state.borrow::<MyStruct>().value, 100);
    /// #
    /// #   });
    /// # }
    /// ```
    pub fn put<T>(&mut self, t: T)
    where
        T: StateData,
    {
        let type_id = TypeId::of::<T>();
        trace!(" inserting record to state for type_id `{:?}`", type_id);
        self.data.insert(type_id, Box::new(t));
    }

    /// Determines if the current value exists in `State` storage.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # #[derive(StateData)]
    /// # struct AnotherStruct {
    /// # }
    /// #
    /// # fn main() {
    /// #   State::with_new(|state| {
    /// #
    /// state.put(MyStruct { value: 1 });
    /// assert!(state.has::<MyStruct>());
    /// assert_eq!(state.borrow::<MyStruct>().value, 1);
    ///
    /// assert!(!state.has::<AnotherStruct>());
    /// #
    /// #   });
    /// # }
    /// ```
    pub fn has<T>(&self) -> bool
    where
        T: StateData,
    {
        let type_id = TypeId::of::<T>();
        self.data.contains_key(&type_id)
    }

    /// Tries to borrow a value from the `State` storage.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # #[derive(StateData)]
    /// # struct AnotherStruct {
    /// # }
    /// #
    /// # fn main() {
    /// #   State::with_new(|state| {
    /// #
    /// state.put(MyStruct { value: 1 });
    /// assert!(state.try_borrow::<MyStruct>().is_some());
    /// assert_eq!(state.try_borrow::<MyStruct>().unwrap().value, 1);
    ///
    /// assert!(state.try_borrow::<AnotherStruct>().is_none());
    /// #
    /// #   });
    /// # }
    /// ```
    pub fn try_borrow<T>(&self) -> Option<&T>
    where
        T: StateData,
    {
        let type_id = TypeId::of::<T>();
        trace!(" borrowing state data for type_id `{:?}`", type_id);
        self.data.get(&type_id).and_then(|b| b.downcast_ref::<T>())
    }

    /// Borrows a value from the `State` storage.
    ///
    /// # Panics
    ///
    /// If a value of type `T` is not present in `State`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # fn main() {
    /// #   State::with_new(|state| {
    /// #
    /// state.put(MyStruct { value: 1 });
    /// assert_eq!(state.borrow::<MyStruct>().value, 1);
    /// #
    /// #   });
    /// # }
    /// ```
    pub fn borrow<T>(&self) -> &T
    where
        T: StateData,
    {
        self.try_borrow()
            .expect("required type is not present in State container")
    }

    /// Tries to mutably borrow a value from the `State` storage.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # #[derive(StateData)]
    /// # struct AnotherStruct {
    /// # }
    /// #
    /// # fn main() {
    /// #   State::with_new(|state| {
    /// #
    /// state.put(MyStruct { value: 100 });
    ///
    /// if let Some(a) = state.try_borrow_mut::<MyStruct>() {
    ///     a.value += 10;
    /// }
    ///
    /// assert_eq!(state.borrow::<MyStruct>().value, 110);
    ///
    /// assert!(state.try_borrow_mut::<AnotherStruct>().is_none());
    /// #   });
    /// # }
    pub fn try_borrow_mut<T>(&mut self) -> Option<&mut T>
    where
        T: StateData,
    {
        let type_id = TypeId::of::<T>();
        trace!(" mutably borrowing state data for type_id `{:?}`", type_id);
        self.data
            .get_mut(&type_id)
            .and_then(|b| b.downcast_mut::<T>())
    }

    /// Mutably borrows a value from the `State` storage.
    ///
    /// # Panics
    ///
    /// If a value of type `T` is not present in `State`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// # extern crate gotham;
    /// # #[macro_use]
    /// # extern crate gotham_derive;
    /// #
    /// # use gotham::state::State;
    /// #
    /// # #[derive(StateData)]
    /// # struct MyStruct {
    /// #     value: i32
    /// # }
    /// #
    /// # #[derive(StateData)]
    /// # str
```

### Core Architecture Module: `gotham/src/state/request_id.rs`
```
//! Defines a unique id per `Request` that should be output with all logging.

use http::header::HeaderMap;
use log::trace;
use uuid::Uuid;

use crate::state::{FromState, State};

/// A container type for the value returned by `request_id`.
pub(super) struct RequestId {
    val: String,
}

/// Sets a unique identifier for the request if it has not already been stored.
///
/// The unique identifier chosen depends on the the request headers:
///
/// 1. If the header `X-Request-ID` is provided this value is used as-is;
/// 2. Alternatively creates and stores a UUID v4 value.
///
/// This function is invoked by `GothamService` before handing control to its `Router`, to ensure
/// that a value for `RequestId` is always available.
pub(crate) fn set_request_id<'a>(state: &'a mut State) -> &'a str {
    if !state.has::<RequestId>() {
        let request_id = match HeaderMap::borrow_from(state).get("X-Request-ID") {
            Some(ex_req_id) => {
                let id = String::from_utf8(ex_req_id.as_bytes().into()).unwrap();
                trace!(
                    "[{}] RequestId set from external source via X-Request-ID header",
                    id
                );
                RequestId { val: id }
            }
            None => {
                let val = Uuid::new_v4().hyphenated().to_string();
                trace!("[{}] RequestId generated internally", val);
                RequestId { val }
            }
        };
        state.put(request_id);
    };

    request_id(state)
}

/// Returns the request ID associated with the current request.
///
/// This is typically used for logging and correlating events that occurred within a request.
///
/// # Panics
///
/// Will panic if `State` does not contain a request ID, which is an invalid state. The request ID
/// should always be populated by Gotham before a `Router` is invoked.
pub fn request_id(state: &State) -> &str {
    match RequestId::try_borrow_from(state) {
        Some(request_id) => &request_id.val,
        None => panic!("RequestId must be populated before application code is invoked"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic(expected = "RequestId must be populated before application code is invoked")]
    fn panics_before_request_id_set() {
        let state = State::new();
        request_id(&state);
    }

    #[test]
    fn uses_an_external_request_id() {
        let mut state = State::new();

        let mut headers = HeaderMap::new();
        headers.insert("X-Request-ID", "1-2-3-4".to_owned().parse().unwrap());
        state.put(headers);

        {
            let r = set_request_id(&mut state);
            assert_eq!("1-2-3-4", r);
        };
        assert_eq!("1-2-3-4", request_id(&state));
    }

    #[test]
    fn sets_a_unique_request_id() {
        let mut state = State::new();
        state.put(HeaderMap::new());

        {
            let r = set_request_id(&mut state);
            assert_eq!(4, Uuid::parse_str(r).unwrap().get_version_num());
        };
        assert_eq!(
            4,
            Uuid::parse_str(request_id(&state))
                .unwrap()
                .get_version_num()
        );
    }

    #[test]
    fn does_not_overwrite_existant_request_id() {
        let mut state = State::new();
        state.put(RequestId {
            val: "1-2-3-4".to_string(),
        });

        {
            set_request_id(&mut state);
        }
        assert_eq!("1-2-3-4", request_id(&state));
    }
}

```

### Core Architecture Module: `gotham_derive/src/state.rs`
```
use quote::quote;

pub(crate) fn state_data(ast: &syn::DeriveInput) -> proc_macro::TokenStream {
    let name = &ast.ident;
    let (impl_generics, ty_generics, where_clause) = ast.generics.split_for_impl();

    let expanded = quote! {
        impl #impl_generics ::gotham::state::StateData for #name #ty_generics #where_clause {}
    };

    expanded.into()
}

```

### Core Architecture Module: `middleware/jwt/src/state_data.rs`
```
use gotham::prelude::*;
use jsonwebtoken::TokenData;

/// Struct to contain the JSON Web Token on a per-request basis.
#[derive(StateData, Debug)]
pub struct AuthorizationToken<T: Send + 'static>(pub TokenData<T>);

```

### Core Architecture Module: `examples/cookies/introduction/src/main.rs`
```
//! An introduction to storing and retrieving cookie data, with the Gotham
//! web framework.
use gotham::cookie::{Cookie, CookieJar};
use gotham::helpers::http::response::create_response;
use gotham::helpers::http::Body;
use gotham::http::header::SET_COOKIE;
use gotham::http::{Response, StatusCode};
use gotham::middleware::cookie::CookieParser;
use gotham::mime::TEXT_PLAIN;
use gotham::pipeline::{new_pipeline, single_pipeline};
use gotham::prelude::*;
use gotham::router::{build_router, Router};
use gotham::state::State;

/// The first request will set a cookie, and subsequent requests will echo it back.
fn handler(state: State) -> (State, Response<Body>) {
    // Define a narrow scope so that state can be borrowed/moved later in the function.
    let adjective = {
        // Retrieve the cookie from the jar stored on the state.
        CookieJar::borrow_from(&state)
            .get("adjective")
            .map(|adj_cookie| adj_cookie.value().to_owned())
            .unwrap_or_else(|| "first time".to_string())
    };

    let mut response = create_response(
        &state,
        StatusCode::OK,
        TEXT_PLAIN,
        format!("Hello {} visitor\n", adjective),
    );

    {
        let cookie = Cookie::build(("adjective", "repeat"))
            .http_only(true)
            .build();
        response
            .headers_mut()
            .append(SET_COOKIE, cookie.to_string().parse().unwrap());
    }

    (state, response)
}

/// Create a `Router`
fn router() -> Router {
    let (chain, pipelines) = single_pipeline(new_pipeline().add(CookieParser).build());
    build_router(chain, pipelines, |route| {
        route.get("/").to(handler);
    })
}

/// Start a server and use a `Router` to dispatch requests
pub fn main() {
    let addr = "127.0.0.1:7878";
    println!("Listening for requests at http://{}", addr);
    gotham::start(addr, router()).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use gotham::cookie::Cookie;
    use gotham::http::header::COOKIE;
    use gotham::test::TestServer;

    #[test]
    fn cookie_is_set_and_counter_increments() {
        let test_server = TestServer::new(router()).unwrap();
        let response = test_server
            .client()
            .get("http://localhost/")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        assert_eq!(response.headers().get_all(SET_COOKIE).iter().count(), 1);

        assert_eq!(
            response
                .headers()
                .get(SET_COOKIE)
                .map(|hv| hv.to_str().unwrap()),
            Some("adjective=repeat; HttpOnly")
        );

        let body = response.read_body().unwrap();
        assert_eq!(&body[..], "Hello first time visitor\n".as_bytes());

        let cookie = Cookie::new("adjective", "repeat");

        let response = test_server
            .client()
            .get("http://localhost/")
            .with_header(COOKIE, cookie.to_string().parse().unwrap())
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = response.read_body().unwrap();
        assert_eq!(&body[..], "Hello repeat visitor\n".as_bytes());
    }
}

```

### Core Architecture Module: `examples/custom_service/src/main.rs`
```
//! An example usage of Gotham from another service.

use anyhow::{Context as _, Error};
use futures_util::future::{BoxFuture, FutureExt};
use gotham::helpers::http::Body;
use gotham::http::{Request, Response};
use gotham::hyper::body::Incoming;
use gotham::hyper::service::Service;
use gotham::hyper_util::rt::{TokioExecutor, TokioIo};
use gotham::hyper_util::server::conn::auto::Builder as ServerBuilder;
use gotham::prelude::*;
use gotham::router::{build_simple_router, Router};
use gotham::service::call_handler;
use gotham::state::State;
use std::net::SocketAddr;
use std::panic::AssertUnwindSafe;
use tokio::net::TcpListener;

#[derive(Clone)]
struct MyService {
    router: Router,
    addr: SocketAddr,
}

impl Service<Request<Incoming>> for MyService {
    type Response = Response<Body>;
    type Error = Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn call(&self, req: Request<Incoming>) -> Self::Future {
        // NOTE: You don't *have* to use call_handler for this (you could use `router.handle`), but
        // call_handler will catch panics and return en error response.
        let state = State::from_request(req, self.addr);
        call_handler(self.router.clone(), AssertUnwindSafe(state)).boxed()
    }
}

pub fn say_hello(state: State) -> (State, &'static str) {
    (state, "hello world")
}

#[tokio::main]
pub async fn main() -> Result<(), Error> {
    let router = build_simple_router(|route| {
        // For the path "/" invoke the handler "say_hello"
        route.get("/").to(say_hello);
    });

    let addr = "127.0.0.1:7878";
    let listener = TcpListener::bind(&addr).await?;

    println!("Listening for requests at http://{}", addr);

    loop {
        let (socket, addr) = listener
            .accept()
            .await
            .context("Error accepting connection")?;

        let service = MyService {
            router: router.clone(),
            addr,
        };

        let task = async move {
            ServerBuilder::new(TokioExecutor::new())
                .serve_connection(TokioIo::new(socket), service)
                .await
                .map_err(anyhow::Error::from_boxed)
                .context("Error serving connection")?;

            Result::<_, Error>::Ok(())
        };

        tokio::spawn(task);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #580** (2021-11-18): **Missing `Send` in `SessionData::discard`'s `Future`**
  *Symptoms*: Hey there!  I stumbled on a following error. Consider the handler code:  ```rust pub async fn logout_handler(mut state: State) -> HandlerResult {     let session = SessionData::<UserSession>::take_from(&mut state);     session.discard(&mut state).await.unwrap();      let response = create_empty_response(&state, StatusCode::OK);     Ok((state, response)) } ```  attached to router using `to_async`. Nothing really fancy - just dropping the user state on logout. Before v0.6.1, the handler was synchronous, as `discard` returned plain `Result`. From 0.6.1 onward, `discard` returns a `Pin<Box<dyn Future<Output = Result<(), SessionError>>>>`. This is problematic, because the `Future` is not `Send`, so the future returned by `logout_handler` is also `!Send` and cannot be used in `to_async`.  Changing the signature of `discard` to ```rust pub fn discard(     self,     state: &mut State, ) -> Pin<Box<dyn Future<Output = Result<(), SessionError>> + Send>> { ```  i.e. making the `Future` also `Send` works and solves the problem. I am not sure whether this is the correct approach - do I miss something here? I'm only starting with async Rust and I don't really feel like I know how it works, so sorry in advance if I missed something obvious. :)
  **Post-Mortem & Fix Analysis**:
  > This looks like a problem in Gotham, likely introduced in #468 
  > Yep, it also looks like a simple omission (since other `Futures` are aliased, and the alias has `Send`). Do you want a PR from me maybe (I can also write some tests for `discard`, as noted in the comment), or do you want to tackle it yourself?
  > I just created a PR myself, but thanks for the offer

- **Issue #461** (2020-11-11): **Transport endpoint is not connected, peer_addr() unwrap panics**
  *Symptoms*: I received this error while letting a server run overnight while being requested by 3 clients every 60 seconds. I noticed the errors for `peer_addr()` are interestingly undocumented in the std lib and I'm not exactly sure what causes it in this scenario (Maybe the connection drops out really fast before it's handled? I'd like to hear more about this error if anyone knows), I thought I would report it in case you guys wanted to reconsider this unwrap call to handle this instead of panicking.  I'm going to try poking around with it myself and see if I can get it to recreate itself and continue on with it's life without crashing as that's important for my use case. I will give any further details if I get it to happen again. This is using gotham pulled from this repo some time near the beginning of August 2020.  ``` thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: Os { code: 107, kind: NotConnected, message: "Transport endpoint is not connected" }', /home/user/rustwww/test/gotham/gotham/src/lib.rs:118:24 stack backtrace:    0: backtrace::backtrace::libunwind::trace              at /cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.44/src/backtrace/libunwind.rs:86    1: backtrace::backtrace::trace_unsynchronized              at /cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.44/src/backtrace/mod.rs:66    2: std::sys_common::backtrace::_print_fmt              at src/libstd/sys_common/backtrace.rs:78    3: <std::sys_commo
  **Post-Mortem & Fix Analysis**:
  > It has occurred again. I replaced the unwrap with a match which does nothing upon this specific error, which for my use case is fine and doesn't need further consideration. Server seems to continue on like it never happened. I did not see any of my client processes return anything other than 200 statuses, so I'm unsure where this error is coming from or why it doesn't seem to affect the clients at all. I'd think one of them should have been left unhandled or something. I didn't expect to see the error happen again so soon.
  > It looks like whatever errors are rising up from the `mio` stack are unwrapped in gotham. There are a few things that could be going wrong but they are all arising from either `tokio`, `mio`, or `std::net`, so the best I think we can do is to just bubble up the error instead of unwrapping. 
  > Hi @Zennii, sorry for the delay. Can you test #497 and see if that fixes this issue?

- **Issue #447** (2020-08-28): **Improve status code and allow headers returned by RouteNonMatch based responses**
  *Symptoms*: This pull request improves the status code and `Allow`-headers return by gotham when no route was successful due to route matchers.   - When two route matchers are combined with a logical AND and one of them returned 405, this error is preserved throughout this route. This change does not change those combined with a logical OR.  - Routes combined with a logical OR now prefer 404 over 405 responses. This should fix the status-code part of #434.  - The default `RouteNonMatch` includes no allowed methods, which prevents non-declared methods appearing as seen in #434. Therefore, the intersection logic was changed to preserve a method set if the other one is empty. I expect there to be no impact for well-written route matchers in user code. Overall, this change should make the behaviour clearer and more straight-forward, avoiding suprises when writing route matchers or even just using the ones provided with gotham.
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/gotham-rs/gotham/pull/447?src=pr&el=h1) Report > Merging [#447](https://codecov.io/gh/gotham-rs/gotham/pull/447?src=pr&el=desc) into [master](https://codecov.io/gh/gotham-rs/gotham/commit/2364179647c38c34b4582b827659e01cd17ae158&el=desc) will **increase** coverage by `0.30%`. > The diff coverage is `99.23%`.  [![Impacted file tree graph](https://codecov.io/gh/gotham-rs/gotham/pull/447/graphs/tree.svg?width=650&height=150&src=pr&token=XjpwQ54q1L)](https://codecov.io/gh/gotham-rs/gotham/pull/447?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master     #447      +/-   ## ========================================== + Coverage   84.57%   84.87%   +0.30%      ==========================================   Files         110      110                 Lines        5503     5574      +71      ========================================== + Hits         4654     4731      +77      + Misses        849      843       -6      ```   | [Imp

- **Issue #434** (2020-08-28): **Gotham's 405 response contradicts itself**
  *Symptoms*: I have several routes on the `/users` endpoint, including several `OPTIONS` handlers, each with a matcher looking for the `Access-Control-Request-Method` header, and each returning a 404 on route non match.  However, gotham decides to return a _405 Method Not Allowed_ response when all those matchers failed, saying that `OPTIONS` is not allowed, while listing `OPTIONS` in the `Allow` header:  ![Screenshot_2020-05-19-14-12-15](https://user-images.githubusercontent.com/7853372/82325256-3851e480-99db-11ea-91fd-cd5c52c04969.png)  I don't know what is the appropriate return in this case, but I'd assume a _204 No Content_ with the `Allow` header set makes more sense.  Also, even more confusing, the `PATCH` method is included in the `Allow` header, although I do not have any handler registered to the router that would accept this method (and also don't have an option handler looking for `Access-Control-Request-Method: Patch`). So I don't think that `Allow: PATCH` should've been returned from gotham.
  **Post-Mortem & Fix Analysis**:
  > This should've been fixed by #447 

- **Issue #330** (2019-07-19): **Unable to receive multiple cookies**
  *Symptoms*: Using gotham `0.4.0` on crates.io  When doing the [cookie example](https://github.com/gotham-rs/gotham/tree/master/examples/cookies/introduction), the `CookieParser` seems unable to separate out multiple cookies?  E.g. ``` let temp = CookieJar::borrow_from(&state); dbg!(&temp); ```  when given multiple cookies will output   ``` [src\main.rs:19] &temp = CookieJar {     original_cookies: {         DeltaCookie {             cookie: Cookie {                 cookie_string: Some(                     "othercookie=foobar; adjective=repeat;",                 ),                 name: Indexed(                     0,                     6,                 ),                 value: Indexed(                     7,                     13,                 ),                 expires: None,                 max_age: None,                 domain: None,                 path: None,                 secure: None,                 http_only: None,                 same_site: None,             },             removed: false,         },     },     delta_cookies: {}, } ```  it seems like cookie parser doesn't separate out the cookies, leading it to only recognize the first cookie?  I just started with gotham, so I might be missing something here.
  **Post-Mortem & Fix Analysis**:
  > @8176135 that's purely the debug information, because the cookies are lazily fetched. Once you have the `CookieJar`, you can then call `jar.get("adjective")` (shown [here](https://github.com/gotham-rs/gotham/blob/master/examples/cookies/introduction/src/main.rs#L28)) to get a specific value back.
  > I only started reading the debug information because get didn't work when there are multiple cookies (only worked for the first cookie). Try calling `jar.iter().collect()` and then debugging that output. You can see that only one cookie is in the output array. 
  > @8176135 you're right! I'll have a patch in shortly.

- **Issue #269** (2018-09-29): **Default headers are not being correctly attached**
  *Symptoms*: This broke during the Hyper 0.12 adoption; the default headers (via `set_headers`) in the response module are no longer being set on responses. This should be fixed prior to v0.3 to avoid breaking the headers contract.
  **Post-Mortem & Fix Analysis**:
  > Should be an easy fix, I noticed that in `helpers/http/response/mod.rs` there is a comment that says   > `extend_response` delegates to `set_headers` for setting security headers.  Yet, `set_headers` is never called. Should be trivial to add a call back in.
  > Is this by chance the same thing stopping the "Hello world" example (taken from website) from working?  I see the following when attempting to run it: ``` error[E0243]: wrong number of type arguments: expected 1, found 0   --> src/main.rs:17:43    | 17 | pub fn say_hello(state: State) -> (State, Response) {    |                                           ^^^^^^^^ expected 1 type argument  error: aborting due to previous error ```
  > @smvoss - this is a different issue - but it is a good point that the website is out of date. `master` is currently working towards the 0.3 release, which will have breaking changes due to the hyper upgrade. 0.2 is still the latest "release" until then. If you're looking for examples that work with master - all examples in the "examples" directory compile and work - so this is a better place to look until 0.3 is released.

- **Issue #219** (2018-05-07): **gotham.rs - NXDOMAIN**
  *Symptoms*: ``` $ nslookup gotham.rs 8.8.8.8 Server:		8.8.8.8 Address:	8.8.8.8#53  ** server can't find gotham.rs: NXDOMAIN ```  It seems that your domain name is expired or something.  Site is still working, it is possible to access it by adding the last known IP into `/etc/hosts`:  ``` 104.27.172.247 gotham.rs ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for this alert.  The domain had expired in the last 24h due to reminders going to a defunct mail address.  Have sorted that payment out, should come back up in the next hour or two.
  > Confirmed it's back up and running now 👍 
  > Corrected  ``` ;; ANSWER SECTION: gotham.rs.		299	IN	A	104.27.172.247 gotham.rs.		299	IN	A	104.27.173.247  ;; Query time: 171 msec ;; SERVER: 8.8.8.8#53(8.8.8.8) ;; WHEN: Mon May 07 21:02:41 AEST 2018 ;; MSG SIZE  rcvd: 70 ```

- **Issue #208** (2018-04-17): **Remove skeptic from borrow_bag**
  *Symptoms*: This seems to be root cause of our TravisCI failures currently, we can achieve what it provides with module level doc tests.

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

### Incident Patch 1: `53fe844b` (2026-09-26)
**Commit Message**: Update jsonwebtoken requirement from 10.3 to 11.1 (#688)

Updates the requirements on [jsonwebtoken](https://github.com/Keats/jsonwebtoken) to permit the latest version.
- [Changelog](https://github.com/Keats/jsonwebtoken/blob/master/CHANGELOG.md)
- [Commits](https://github.com/Keats/jsonwebtoken/compare/v10.3.0...v11.1.0)

---
updated-dependencies:
- dependency-name: jsonwebtoken
  dependency-version: 11.1.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `middleware/jwt/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ edition = "2018"
 [dependencies]
 futures-util = "0.3.14"
 gotham = { workspace = true, default-features = false, features = ["derive"] }
-jsonwebtoken = { version = "10.3", default-features = false }
+jsonwebtoken = { version = "11.1", default-features = false }
 log = "0.4"
 serde = { version = "1.0", features = ["derive"] }
 
```

---

### Incident Patch 2: `cf4e6f63` (2026-09-26)
**Commit Message**: Update base64 requirement from 0.22 to 0.23 (#682)

Updates the requirements on [base64](https://github.com/marshallpierce/rust-base64) to permit the latest version.
- [Changelog](https://github.com/marshallpierce/rust-base64/blob/master/RELEASE-NOTES.md)
- [Commits](https://github.com/marshallpierce/rust-base64/compare/v0.22.0...v0.23.1)

---
updated-dependencies:
- dependency-name: base64
  dependency-version: 0.23.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/websocket/Cargo.toml` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ tokio-tungstenite = "0.21"
 tokio = { version = "1.11.0", features = ["macros"] }
 pretty_env_logger = "0.5"
 sha1 = "0.11"
-base64 = "0.22"
+base64 = "0.23"
```

**File**: `gotham/Cargo.toml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ borrow-bag.workspace = true
 gotham_derive = { workspace = true, optional = true }
 
 anyhow = "1.0.5"
-base64 = "0.22"
+base64 = "0.23"
 bincode = { version = "1.0", optional = true }
 bytes = "1.0"
 cookie = "0.18"
```

---

### Incident Patch 3: `1c91ff6d` (2026-09-20)
**Commit Message**: Update sha1 requirement from 0.10 to 0.11 (#676)

Updates the requirements on [sha1](https://github.com/RustCrypto/hashes) to permit the latest version.
- [Commits](https://github.com/RustCrypto/hashes/compare/groestl-v0.10.0...sha1-v0.11.0)

---
updated-dependencies:
- dependency-name: sha1
  dependency-version: 0.11.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/websocket/Cargo.toml` (modified, +1/-1)
```diff
@@ -12,5 +12,5 @@ futures-util = "0.3.14"
 tokio-tungstenite = "0.21"
 tokio = { version = "1.11.0", features = ["macros"] }
 pretty_env_logger = "0.5"
-sha1 = "0.10"
+sha1 = "0.11"
 base64 = "0.22"
```

---

### Incident Patch 4: `ba5ab39b` (2026-07-25)
**Commit Message**: fix ci

**File**: `.github/workflows/rust.yml` (modified, +4/-3)
```diff
@@ -100,7 +100,8 @@ jobs:
       
       - name: Get Tarpaulin Version
         id: tarpaulin-version
-        run: echo "::set-output name=VERSION::$(wget -qO- 'https://crates.io/api/v1/crates/cargo-tarpaulin' | jq -r '.crate.max_stable_version')"
+        run: |
+          echo "version=$(wget -qO- --header 'User-Agent: https://github.com/gotham-rs/gotham' 'https://crates.io/api/v1/crates/cargo-tarpaulin' | jq -r '.crate.max_stable_version')" >>$GITHUB_OUTPUT
       
       - uses: actions/cache@v5
         with:
@@ -109,10 +110,10 @@ jobs:
             ~/.cargo/git
             ~/.cargo/registry
             target
-          key: ${{ runner.os }}-rust-${{ steps.rust-toolchain.outputs.cachekey }}-tarpaulin-${{ steps.tarpaulin-version.outputs.VERSION }}
+          key: ${{ runner.os }}-rust-${{ steps.rust-toolchain.outputs.cachekey }}-tarpaulin-${{ steps.tarpaulin-version.outputs.version }}
       
       - name: Install Tarpaulin
-        run: test -e ~/.cargo/bin/cargo-tarpaulin || cargo install cargo-tarpaulin --version ${{ steps.tarpaulin-version.outputs.VERSION }}
+        run: test -e ~/.cargo/bin/cargo-tarpaulin || cargo install cargo-tarpaulin --version ${{ steps.tarpaulin-version.outputs.version }}
       
       - run: cargo tarpaulin --workspace --forward --out Xml
       
```

---

### Incident Patch 5: `a91c944b` (2026-03-03)
**Commit Message**: Update nix requirement from 0.28 to 0.31 (#666)

Updates the requirements on [nix](https://github.com/nix-rust/nix) to permit the latest version.
- [Changelog](https://github.com/nix-rust/nix/blob/master/CHANGELOG.md)
- [Commits](https://github.com/nix-rust/nix/compare/v0.28.0...v0.31.2)

---
updated-dependencies:
- dependency-name: nix
  dependency-version: 0.31.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/hello_world_until/Cargo.toml` (modified, +1/-1)
```diff
@@ -12,4 +12,4 @@ futures-util = "0.3.14"
 tokio = { version = "1.11.0", features = ["full"] }
 
 [target.'cfg(unix)'.dev-dependencies]
-nix = { version = "0.28", features = ["process", "signal"] }
+nix = { version = "0.31", features = ["process", "signal"] }
```

---

### Incident Patch 6: `3bb8c387` (2025-05-16)
**Commit Message**: fix broken mime type test

This upstream change broke it: https://github.com/abonander/mime_guess/pull/86

**File**: `gotham/Cargo.toml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ hyper = { version = "0.14.12", features = ["http1", "runtime", "server", "stream
 linked-hash-map = { version = "0.5.6", optional = true }
 log = "0.4"
 mime = "0.3.15"
-mime_guess = "2.0.1"
+mime_guess = "2.0.5"
 num_cpus = "1.8"
 percent-encoding = "2.1"
 pin-project = "1.0.0"
```

**File**: `gotham/src/handler/assets/mod.rs` (modified, +1/-1)
```diff
@@ -554,7 +554,7 @@ mod tests {
             ),
             (
                 "scripts/script.js",
-                HeaderValue::from_static("application/javascript"),
+                HeaderValue::from_static("text/javascript"),
                 "console.log('I am javascript!');",
             ),
         ];
```

---

### Incident Patch 7: `059b4419` (2024-04-17)
**Commit Message**: fix more nightly warnings

**File**: `middleware/diesel/src/lib.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 //! # use gotham::state::{FromState, State};
 //! # use gotham::helpers::http::response::create_response;
 //! # use gotham::handler::HandlerFuture;
-//! # use gotham_middleware_diesel::{self, DieselMiddleware};
+//! # use gotham_middleware_diesel::DieselMiddleware;
 //! # use gotham::hyper::StatusCode;
 //! # use gotham::test::TestServer;
 //! # use gotham::mime::TEXT_PLAIN;
```

**File**: `middleware/diesel/src/repo.rs` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ use tokio::task;
 /// # }
 ///
 /// #[derive(Queryable, Debug)]
+/// # #[allow(dead_code)]
 /// pub struct User {
 ///     pub id: i32,
 ///     pub name: String,
```

---

### Incident Patch 8: `8e42df6c` (2024-04-12)
**Commit Message**: Fix warnings introduced in beta/nightly

**File**: `gotham/src/extractor/path.rs` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ use crate::state::{State, StateData};
 ///
 /// ```rust
 /// # use hyper::{Body, Response, StatusCode};
-/// # use gotham::state::{FromState, State};
+/// # use gotham::state::State;
 /// # use gotham::helpers::http::response::create_response;
 /// # use gotham::router::{build_simple_router, Router};
 /// # use gotham::prelude::*;
```

**File**: `gotham/src/extractor/query_string.rs` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ use crate::state::{State, StateData};
 ///
 /// ```rust
 /// # use hyper::{Body, Response, StatusCode};
-/// # use gotham::state::{FromState, State};
+/// # use gotham::state::State;
 /// # use gotham::helpers::http::response::create_response;
 /// # use gotham::router::{build_simple_router, Router};
 /// # use gotham::prelude::*;
```

**File**: `gotham/src/handler/mod.rs` (modified, +0/-3)
```diff
@@ -133,7 +133,6 @@ pub type HandlerFuture = dyn Future<Output = HandlerResult> + Send;
 /// #
 /// # use gotham::handler::{Handler, HandlerFuture, NewHandler};
 /// # use gotham::state::State;
-/// # use gotham::anyhow;
 /// #
 /// # fn main() {
 /// #[derive(Copy, Clone)]
@@ -191,7 +190,6 @@ where
 /// #
 /// # use gotham::handler::{Handler, HandlerFuture, NewHandler};
 /// # use gotham::state::State;
-/// # use gotham::anyhow;
 /// #
 /// # fn main() {
 /// #[derive(Copy, Clone)]
@@ -227,7 +225,6 @@ where
 /// #
 /// # use gotham::handler::{Handler, HandlerFuture, NewHandler};
 /// # use gotham::state::State;
-/// # use gotham::anyhow;
 /// #
 /// # fn main() {
 /// #[derive(Copy, Clone)]
```

**File**: `gotham/src/router/builder/single.rs` (modified, +2/-3)
```diff
@@ -261,7 +261,6 @@ pub trait DefineSingleRoute {
     /// # use gotham::pipeline::*;
     /// # use gotham::middleware::session::NewSessionMiddleware;
     /// # use gotham::test::TestServer;
-    /// # use gotham::anyhow;
     /// #
     /// struct MyNewHandler;
     /// struct MyHandler;
@@ -396,7 +395,7 @@ pub trait DefineSingleRoute {
     ///
     /// ```rust
     /// # use hyper::{Body, Response, StatusCode};
-    /// # use gotham::state::{State, FromState};
+    /// # use gotham::state::State;
     /// # use gotham::router::{build_router, Router};
     /// # use gotham::prelude::*;
     /// # use gotham::pipeline::*;
@@ -458,7 +457,7 @@ pub trait DefineSingleRoute {
     ///
     /// ```rust
     /// # use hyper::{Body, Response, StatusCode};
-    /// # use gotham::state::{State, FromState};
+    /// # use gotham::state::State;
     /// # use gotham::router::{build_router, Router};
     /// # use gotham::prelude::*;
     /// # use gotham::pipeline::*;
```

---

### Incident Patch 9: `ae19b010` (2024-03-05)
**Commit Message**: Update rustls-pemfile requirement from 1.0 to 2.1 (#643)

* Update rustls-pemfile requirement from 1.0 to 2.1

Updates the requirements on [rustls-pemfile](https://github.com/rustls/pemfile) to permit the latest version.
- [Release notes](https://github.com/rustls/pemfile/releases)
- [Commits](https://github.com/rustls/pemfile/compare/v/1.0.0...v/2.1.0)

---
updated-dependencies:
- dependency-name: rustls-pemfile
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* update code

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Dominic <[REDACTED_EMAIL]>

**File**: `examples/hello_world_tls/Cargo.toml` (modified, +1/-1)
```diff
@@ -7,4 +7,4 @@ edition = "2018"
 
 [dependencies]
 gotham = { path = "../../gotham", features = ["rustls"] }
-rustls-pemfile = "1.0"
+rustls-pemfile = "2.1"
```

**File**: `examples/hello_world_tls/src/main.rs` (modified, +8/-8)
```diff
@@ -1,6 +1,6 @@
 //! A Hello World example application for working with Gotham.
 use gotham::anyhow;
-use gotham::rustls::{self, Certificate, PrivateKey, ServerConfig};
+use gotham::rustls::{Certificate, PrivateKey, ServerConfig};
 use gotham::state::State;
 use rustls_pemfile::{certs, pkcs8_private_keys};
 use std::io::BufReader;
@@ -24,19 +24,19 @@ pub fn main() -> anyhow::Result<()> {
     Ok(())
 }
 
-fn build_config() -> Result<ServerConfig, rustls::Error> {
+fn build_config() -> anyhow::Result<ServerConfig> {
     let mut cert_file = BufReader::new(&include_bytes!("cert.pem")[..]);
     let mut key_file = BufReader::new(&include_bytes!("key.pem")[..]);
     let certs = certs(&mut cert_file)
-        .unwrap()
-        .into_iter()
-        .map(Certificate)
-        .collect();
-    let mut keys = pkcs8_private_keys(&mut key_file).unwrap();
+        .map(|result| result.map(|der| Certificate(der.to_vec())))
+        .collect::<Result<_, _>>()?;
+    let mut keys = pkcs8_private_keys(&mut key_file);
+    let key = PrivateKey(keys.next().unwrap()?.secret_pkcs8_der().to_vec());
     ServerConfig::builder()
         .with_safe_defaults()
         .with_no_client_auth()
-        .with_single_cert(certs, PrivateKey(keys.remove(0)))
+        .with_single_cert(certs, key)
+        .map_err(Into::into)
 }
 
 #[cfg(test)]
```

---

### Incident Patch 10: `6a2b527e` (2024-03-05)
**Commit Message**: Fix feature = "cargo-clippy" deprecation (#645)

**File**: `examples/handlers/stateful/src/main.rs` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 //! An example of using stateful handlers with the Gotahm web framework.
 
-#![cfg_attr(feature = "cargo-clippy", allow(clippy::mutex_atomic))]
+#![allow(clippy::mutex_atomic)]
 
 use futures_util::future::{self, FutureExt};
 use std::pin::Pin;
```

**File**: `examples/shared_state/src/main.rs` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 //! used across server threads, and be used to track the number of
 //! requests sent to the backend.
 
-#![cfg_attr(feature = "cargo-clippy", allow(clippy::mutex_atomic))]
+#![allow(clippy::mutex_atomic)]
 
 use gotham::middleware::state::StateMiddleware;
 use gotham::pipeline::{single_middleware, single_pipeline};
```

**File**: `gotham/src/lib.rs` (modified, +10/-13)
```diff
@@ -7,19 +7,16 @@
 #![warn(deprecated, missing_docs, unreachable_pub)]
 // Stricter requirements once we get to pull request stage, all warnings must be resolved.
 #![cfg_attr(feature = "ci", deny(warnings))]
-#![cfg_attr(
-    feature = "cargo-clippy",
-    allow(
-        clippy::needless_lifetimes,
-        clippy::should_implement_trait,
-        clippy::unit_arg,
-        clippy::match_wild_err_arm,
-        clippy::new_without_default,
-        clippy::wrong_self_convention,
-        clippy::mutex_atomic,
-        clippy::borrowed_box,
-        clippy::get_unwrap,
-    )
+#![allow(
+    clippy::needless_lifetimes,
+    clippy::should_implement_trait,
+    clippy::unit_arg,
+    clippy::match_wild_err_arm,
+    clippy::new_without_default,
+    clippy::wrong_self_convention,
+    clippy::mutex_atomic,
+    clippy::borrowed_box,
+    clippy::get_unwrap
 )]
 #![doc(test(no_crate_inject, attr(deny(warnings))))]
 // TODO: Remove this when it's a hard error by default (error E0446).
```

**File**: `middleware/jwt/src/middleware.rs` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ mod tests {
         exp: usize,
     }
 
-    #[cfg_attr(feature = "cargo-clippy", allow(clippy::match_wild_err_arm))]
+    #[allow(clippy::match_wild_err_arm)]
     fn token(alg: Algorithm) -> String {
         let claims = &Claims {
             sub: "test@example.net".to_owned(),
```

**File**: `misc/borrow_bag/src/lib.rs` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 #![warn(missing_docs, deprecated)]
 // Stricter requirements once we get to pull request stage, all warnings must be resolved.
 #![cfg_attr(feature = "ci", deny(warnings))]
-#![cfg_attr(feature = "cargo-clippy", allow(clippy::should_implement_trait))]
+#![allow(clippy::should_implement_trait)]
 #![doc(test(attr(deny(warnings))))]
 // TODO: Remove this when it's a hard error by default (error E0446).
 // See Rust issue #34537 <https://github.com/rust-lang/rust/issues/34537>
```

---

### Incident Patch 11: `4c4ccbc6` (2024-03-05)
**Commit Message**: Update base64 requirement from 0.21 to 0.22 (#646)

Updates the requirements on [base64](https://github.com/marshallpierce/rust-base64) to permit the latest version.
- [Changelog](https://github.com/marshallpierce/rust-base64/blob/master/RELEASE-NOTES.md)
- [Commits](https://github.com/marshallpierce/rust-base64/compare/v0.21.0...v0.22.0)

---
updated-dependencies:
- dependency-name: base64
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/websocket/Cargo.toml` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ tokio-tungstenite = "0.21"
 tokio = "1.11.0"
 pretty_env_logger = "0.5"
 sha1 = "0.10"
-base64 = "0.21"
+base64 = "0.22"
```

**File**: `gotham/Cargo.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ borrow-bag = { path = "../misc/borrow_bag", version = "1.1.1" }
 gotham_derive = { path = "../gotham_derive", version = "0.7.1", optional = true }
 
 anyhow = "1.0.5"
-base64 = "0.21"
+base64 = "0.22"
 bincode = { version = "1.0", optional = true }
 bytes = "1.0"
 cookie = "0.15"
```

---

### Incident Patch 12: `2b2aed21` (2024-02-28)
**Commit Message**: Update nix requirement from 0.27 to 0.28 (#644)

Updates the requirements on [nix](https://github.com/nix-rust/nix) to permit the latest version.
- [Changelog](https://github.com/nix-rust/nix/blob/master/CHANGELOG.md)
- [Commits](https://github.com/nix-rust/nix/compare/v0.27.0...v0.28.0)

---
updated-dependencies:
- dependency-name: nix
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/hello_world_until/Cargo.toml` (modified, +1/-1)
```diff
@@ -12,4 +12,4 @@ futures-util = "0.3.14"
 tokio = { version = "1.11.0", features = ["full"] }
 
 [target.'cfg(unix)'.dev-dependencies]
-nix = { version = "0.27", features = ["process", "signal"] }
+nix = { version = "0.28", features = ["process", "signal"] }
```

---

### Incident Patch 13: `0083a8d6` (2023-12-28)
**Commit Message**: Update tokio-tungstenite requirement from 0.20 to 0.21 (#639)

Updates the requirements on [tokio-tungstenite](https://github.com/snapview/tokio-tungstenite) to permit the latest version.
- [Changelog](https://github.com/snapview/tokio-tungstenite/blob/master/CHANGELOG.md)
- [Commits](https://github.com/snapview/tokio-tungstenite/compare/v0.20.0...v0.21.0)

---
updated-dependencies:
- dependency-name: tokio-tungstenite
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/websocket/Cargo.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ edition = "2018"
 [dependencies]
 gotham = { path = "../../gotham" }
 futures-util = "0.3.14"
-tokio-tungstenite = "0.20"
+tokio-tungstenite = "0.21"
 tokio = "1.11.0"
 pretty_env_logger = "0.5"
 sha1 = "0.10"
```

---

### Incident Patch 14: `446279d0` (2023-10-25)
**Commit Message**: assets: Fix range request status code (#633)

Should return partial content (206) rather than (200)
RFC 9110, section 14.2: "the server SHOULD send a 206 (Partial Content)
response with content containing one or more partial representations"

Signed-off-by: Janne Pelkonen <[REDACTED_EMAIL]>

**File**: `gotham/src/handler/assets/mod.rs` (modified, +2/-1)
```diff
@@ -251,7 +251,7 @@ fn create_file_response(options: FileOptions, state: State) -> Pin<Box<HandlerFu
                 (range_start + len).saturating_sub(1),
                 meta.len()
             );
-            response = response.header(
+            response = response.status(StatusCode::PARTIAL_CONTENT).header(
                 CONTENT_RANGE,
                 HeaderValue::from_str(&val).map_err(|e| io::Error::new(ErrorKind::Other, e))?,
             );
@@ -949,6 +949,7 @@ mod tests {
                 assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
                 break;
             }
+            assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
             file.seek(SeekFrom::Start(range_start)).unwrap();
 
             let expected_content_range = format!(
```

---

### Incident Patch 15: `c433082f` (2023-09-12)
**Commit Message**: Use clippy 1.72 in CI and fix lints (#624)

**File**: `.github/workflows/rust.yml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ jobs:
       - uses: dtolnay/rust-toolchain@master
         id: rust-toolchain
         with:
-          toolchain: "1.69"
+          toolchain: "1.72"
           components: clippy
       
       - uses: actions/cache@v3
```

**File**: `examples/path/globs/src/main.rs` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ fn multi_parts_handler(state: State) -> (State, String) {
             bottom.push_str(part);
         }
 
-        vec![top, bottom].join("\n\n")
+        [top, bottom].join("\n\n")
     };
 
     (state, res)
```

**File**: `gotham/src/middleware/session/rng.rs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ use rand_chacha::ChaChaCore;
 pub(super) type SessionIdentifierRng = ReseedingRng<ChaChaCore, OsRng>;
 
 pub(super) fn session_identifier_rng() -> SessionIdentifierRng {
-    let os_rng = OsRng::default();
+    let os_rng = OsRng;
     let rng = ChaChaCore::from_entropy();
 
     // Reseed every 32KiB.
```

**File**: `gotham/src/router/non_match.rs` (modified, +1/-1)
```diff
@@ -284,7 +284,7 @@ impl From<MethodSet> for Vec<Method> {
         let mut result = methods_with_flags
             .iter()
             .filter_map(|&(ref method, flag)| if flag { Some(method.clone()) } else { None })
-            .chain(method_set.other.into_iter())
+            .chain(method_set.other)
             .collect::<Vec<Method>>();
 
         result.sort_unstable_by(|a, b| a.as_ref().cmp(b.as_ref()));
```

**File**: `gotham/src/service/trap.rs` (modified, +1/-0)
```diff
@@ -141,6 +141,7 @@ mod tests {
 
     #[test]
     fn panic() {
+        #[allow(clippy::unnecessary_literal_unwrap)] // false positive? or bad description?
         let new_handler = || {
             Ok(|_| {
                 let val: Option<Pin<Box<HandlerFuture>>> = None;
```

**File**: `misc/borrow_bag/src/handle.rs` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ pub(crate) fn new_handle<T, N>() -> Handle<T, N> {
 
 impl<T, N> Clone for Handle<T, N> {
     fn clone(&self) -> Handle<T, N> {
-        new_handle()
+        *self
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #689** (closed): Add example for routing on the Accept header (@chiliec)
- **PR #688** (2026-09-26): Update jsonwebtoken requirement from 10.3 to 11.1 (@dependabot[bot])
- **PR #682** (2026-09-26): Update base64 requirement from 0.22 to 0.23 (@dependabot[bot])
- **PR #681** (2026-07-25): Update `syn` to 3.0 (@msrd0)
- **PR #680** (closed): fix: correct typos in comments and documentation (@maxtaran2010)
- **PR #677** (closed): Update askama requirement from 0.12.0 to 0.16.0 (@dependabot[bot])
- **PR #676** (2026-09-20): Update sha1 requirement from 0.10 to 0.11 (@dependabot[bot])
- **PR #675** (closed): Bump codecov/codecov-action from 5 to 6 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
