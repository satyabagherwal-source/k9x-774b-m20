# Forensic Learning Record (Deep Inspection): gotham-rs/gotham

> **Canonical Artifact**: `07_PROJECT_LEARNING/gotham-rs-gotham-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gotham-rs/gotham](https://github.com/gotham-rs/gotham))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:14.198Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gotham-rs/gotham`
- **Description**: A flexible web framework that promotes stability, safety, security and speed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2315 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `examples/diesel/src/main.rs`
```
//! An example application working with the diesel middleware.

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use futures_util::FutureExt;
use gotham::handler::{HandlerError, HandlerFuture};
use gotham::helpers::http::response::create_response;
use gotham::http::StatusCode;
use gotham::http_body_util::combinators::UnsyncBoxBody;
use gotham::http_body_util::BodyExt as _;
use gotham::mime::APPLICATION_JSON;
use gotham::pipeline::{new_pipeline, single_pipeline};
use gotham::prelude::*;
use gotham::router::{build_router, Router};
use gotham::state::State;
use gotham_middleware_diesel::DieselMiddleware;
use serde::Serialize;
use std::pin::Pin;

mod models;
mod schema;

use models::{NewProduct, Product};
use schema::products;

// For this example, we'll use a static database URL,
// although one might commonly pass this in via
// environment variables instead.
static DATABASE_URL: &str = "products.db";

// We'll use a file based Sqlite database to keep things simple.
// Don't forget to run the step in the README to create the database
// first using the diesel cli.
// For convenience, we define a type for our app's database "Repo",
// with `SqliteConnection` as it's connection type.
pub type Repo = gotham_middleware_diesel::Repo<SqliteConnection>;

#[derive(Serialize)]
struct RowsUpdated {
    rows: usize,
}

fn create_product_handler(mut state: State) -> Pin<Box<HandlerFuture>> {
    let repo = Repo::borrow_from(&state).clone();
    async move {
        let product = match extract_json::<NewProduct>(&mut state).await {
            Ok(product) => product,
            Err(e) => return Err((state, e)),
        };

        let query_result = repo
            .run(move |mut conn| {
                diesel::insert_into(products::table)
                    .values(&product)
                    .execute(&mut conn)
            })
            .await;

        let rows = match query_result {
            Ok(rows) => rows,
            Err(e) => return Err((state, e.into())),
        };

        let body =
            serde_json::to_string(&RowsUpdated { rows }).expect("Failed to serialise to json");
        let res = create_response(&state, StatusCode::CREATED, APPLICATION_JSON, body);
        Ok((state, res))
    }
    .boxed()
}

fn get_products_handler(state: State) -> Pin<Box<HandlerFuture>> {
    use crate::schema::products::dsl::*;

    let repo = Repo::borrow_from(&state).clone();
    async move {
        let result = repo
            .run(move |mut conn| products.load::<Product>(&mut conn))
            .await;
        match result {
            Ok(users) => {
                let body = serde_json::to_string(&users).expect("Failed to serialize users.");
                let res = create_response(&state, StatusCode::OK, APPLICATION_JSON, body);
                Ok((state, res))
            }
            Err(e) => Err((state, e.into())),
        }
    }
    .boxed()
}

fn router(repo: Repo) -> Router {
    // Add the diesel middleware to a new pipeline
    let (chain, pipeline) =
        single_pipeline(new_pipeline().add(DieselMiddleware::new(repo)).build());

    // Build the router
    build_router(chain, pipeline, |route| {
        route.get("/").to(get_products_handler);
        route.post("/").to(create_product_handler);
    })
}

async fn extract_json<T>(state: &mut State) -> Result<T, HandlerError>
where
    T: serde::de::DeserializeOwned,
{
    let body = UnsyncBoxBody::take_from(state)
        .collect()
        .map_err_with_status(StatusCode::BAD_REQUEST)
        .await?;
    let b = body.to_bytes();
    str::from_utf8(&b)
        .map_err_with_status(StatusCode::BAD_REQUEST)
        .and_then(|s| serde_json::from_str::<T>(s).map_err_with_status(StatusCode::BAD_REQUEST))
}

/// Start a server and use a `Router` to dispatch requests
fn main() {
    let addr = "127.0.0.1:7878";

    println!("Listening for requests at http://{}", addr);
    gotham::start(addr, router(Repo::new(DATABASE_URL))).unwrap();
}

// In tests `Repo::with_test_transactions` allows queries to run
// within an isolated test transaction. This means multiple tests
// can run in parallel without trampling on each other's data.
// This isn't necessary when using an SQLite in-memory only database
// as is used here, but is demonstrated here anyway to show how it
// might be used agaist a real database.
#[cfg(test)]
mod tests {
    use super::*;
    use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness as _};
    use gotham::http::StatusCode;
    use gotham::test::TestServer;
    use gotham_middleware_diesel::Repo;
    use std::str;

    static DATABASE_URL: &str = ":memory:";

    // For this example, we run migrations automatically in each test.
    // You could also choose to do this separately using something like
    // `cargo-make` (https://sagiegurari.github.io/cargo-make/) to run
    // migrations before the test suite.
    const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

    #[test]
    fn get_empty_products() {
        let repo: Repo<SqliteConnection> = Repo::with_test_transactions(DATABASE_URL);
        let runtime = tokio::runtime::Runtime::new().unwrap();
        _ = runtime
            .block_on(repo.run(|mut conn| conn.run_pending_migrations(MIGRATIONS).map(|_| ())));
        let test_server = TestServer::new(router(repo)).unwrap();
        let response = test_server
            .client()
            .get("http://localhost")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response.read_body().unwrap();
        let str_body = str::from_utf8(&body).unwrap();
        let index = "[]";
        assert_eq!(str_body, index);
    }

    #[test]
    fn create_and_retrieve_product() {
        let repo: Repo<SqliteConnection> = Repo::with_test_transactions(DATABASE_URL);
        let runtime = tokio::runtime::Runtime::new().unwrap();
        _ = runtime
            .block_on(repo.run(|mut conn| conn.run_pending_migrations(MIGRATIONS).map(|_| ())));
        let test_server = TestServer::new(router(repo)).unwrap();

        //  First we'll insert something into the DB with a post
        let body = r#"{"title":"test","price":1.0,"link":"http://localhost"}"#;
        let response = test_server
            .client()
            .post("http://localhost", body, APPLICATION_JSON)
            .perform()
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);

        // Then we'll query it and test that it is returned
        // As long as we're hitting a `test_server` created with the same
        // `Repo` instance, we're in the same test transaction, and our
        // data will be there across queries.
        let response = test_server
            .client()
            .get("http://localhost")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response.read_body().unwrap();
        let str_body = str::from_utf8(&body).unwrap();
        let index = r#"[{"id":1,"title":"test","price":1.0,"link":"http://localhost"}]"#;
        assert_eq!(str_body, index);
    }
}

```

### Core Architecture Module: `examples/diesel/src/models.rs`
```
//! Holds the two possible structs that are `Queryable` and
//! `Insertable` in the DB

use diesel::{Insertable, Queryable};
use serde::{Deserialize, Serialize};

use crate::schema::products;

/// Represents a product in the DB.
/// It is `Queryable`
#[derive(Queryable, Serialize, Debug)]
pub struct Product {
    pub id: i32,
    pub title: String,
    pub price: f32,
    pub link: String,
}

/// Represents a new product to insert in the DB.
#[derive(Insertable, Deserialize)]
#[diesel(table_name = products)]
pub struct NewProduct {
    pub title: String,
    pub price: f32,
    pub link: String,
}

```

### Core Architecture Module: `examples/diesel/src/schema.rs`
```
// @generated automatically by Diesel CLI.

diesel::table! {
    products (id) {
        id -> Integer,
        title -> Text,
        price -> Float,
        link -> Text,
    }
}

```

### Core Architecture Module: `examples/example_contribution_template/name/src/main.rs`
```
//! Module level comment describing the example ...
//!
//! Delete the comments below from final versions.
//!
//! Please ensure that concepts which a previous example have not introduced are
//! well commented inline. Have a look at other examples to get a feeling for what we mean here.
//!
//! The goal is that someone who has not come across the functionality you're providing an example
//! for previously comes away with a solid understanding which they can directly implement or
//! further enhance by reading through specific Gotham web framework API docs.
//!
//! Minimal examples necessary to describe a specific piece of functionality work out better. There
//! is no need to create a collection of 10 items for example where 1 will do perfectly well.
//!
//! Many examples use the theme of a "web store" to help explain concepts which is something we'd
//! like to continue encouraging for unity purposes.
//!
//! Finally please ships tests for the specific functionality your example is exploring, there is no
//! need however to show tests for Gotham web framework functionality that is outside of the scope
//! of your specific example i.e. That a 404 is correctly returned for a missing endpoint when
//! you're writing an example for setting Cookies.
use gotham::helpers::http::response::create_empty_response;
use gotham::helpers::http::Body;
use gotham::http::{Response, StatusCode};
use gotham::prelude::*;
use gotham::router::{build_simple_router, Router};
use gotham::state::State;

/// Create a `Handler` that ...
pub fn well_named_function(state: State) -> (State, Response<Body>) {
    let res = create_empty_response(&state, StatusCode::OK);
    (state, res)
}

/// Create a `Router`
fn router() -> Router {
    build_simple_router(|route| {
        route.get("/").to(well_named_function);
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
    use gotham::test::TestServer;

    #[test]
    fn well_named_test() {
        let test_server = TestServer::new(router()).unwrap();
        let response = test_server
            .client()
            .get("http://localhost/")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}

```

### Core Architecture Module: `examples/finalizers/src/main.rs`
```
//! An finalizer example
use gotham::handler::IntoBody;
use gotham::helpers::http::Body;
use gotham::http::{Response, StatusCode};
use gotham::prelude::*;
use gotham::router::response::ResponseExtender;
use gotham::router::{build_simple_router, Router};
use gotham::state::State;

const HELLO_ROUTER: &str = "Hello Router!";

/// Create a `Handler` that is invoked for requests to the path "/"
pub fn say_hello(state: State) -> (State, &'static str) {
    (state, HELLO_ROUTER)
}

struct ErrorExtender;

///Define an `ResponseExtender`.
///
///Provides a callback after all other processing has  happend
impl ResponseExtender<Body> for ErrorExtender {
    fn extend(&self, _state: &mut State, response: &mut Response<Body>) {
        let body = format!("The status code is {}", response.status());
        *response.body_mut() = body.into_body();
    }
}

/// Create a `Router`
///
/// Provides tree of routes with only a single top level entry that looks like:
///
/// /                     --> GET
///
/// If no match for a request is found a 404 will be returned. Both the HTTP verb and the request
/// path are considered when determining if the request matches a defined route.
///
/// Also includes a 404 response as an ErrorExtender
fn router() -> Router {
    build_simple_router(|route| {
        // For the path "/" invoke the handler "say_hello"
        route.get("/").to(say_hello);
        route.add_response_extender(StatusCode::NOT_FOUND, ErrorExtender);
    })
}

/// Start a server and use a `Router` to dispatch requests
pub fn main() {
    let addr = "127.0.0.1:7878";
    println!("Listening for requests at http://{}", addr);

    // All incoming requests are delegated to the router for further analysis and dispatch
    gotham::start(addr, router()).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use gotham::http::StatusCode;
    use gotham::test::TestServer;

    #[test]
    fn receive_hello_router_response() {
        let test_server = TestServer::new(router()).unwrap();
        let response = test_server
            .client()
            .get("http://localhost")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response.read_body().unwrap();
        assert_eq!(&body[..], b"Hello Router!");
    }

    #[test]
    fn receive_404_response() {
        let test_server = TestServer::new(router()).unwrap();
        let response = test_server
            .client()
            .get("http://localhost/no_such_path")
            .perform()
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let body = response.read_body().unwrap();
        assert_eq!(&body[..], b"The status code is 404 Not Found");
    }
}

```

### Core Architecture Module: `examples/handlers/async_handlers/src/main.rs`
```
//! A basic example showing the request components

use futures_util::future::{self, FutureExt, TryFutureExt};
use futures_util::stream::{self, StreamExt, TryStreamExt};
use serde::Deserialize;
use std::future::Future;
use std::pin::Pin;

use gotham::bytes::{BufMut as _, Bytes, BytesMut};
use gotham::handler::HandlerFuture;
use gotham::helpers::http::response::create_response;
use gotham::http::StatusCode;
#[cfg(not(test))]
use gotham::http::Uri;
#[cfg(not(test))]
use gotham::http_body_util::{BodyExt as _, Collected, Full};
#[cfg(not(test))]
use gotham::hyper_util::client::legacy::Client;
#[cfg(not(test))]
use gotham::hyper_util::rt::TokioExecutor;
use gotham::mime::TEXT_PLAIN;
use gotham::prelude::*;
use gotham::router::builder::build_simple_router;
use gotham::router::Router;
use gotham::state::State;

type ResponseContentFuture = Pin<Box<dyn Future<Output = anyhow::Result<Bytes>> + Send>>;

#[derive(Deserialize, StateData, StaticResponseExtender)]
struct QueryStringExtractor {
    length: i8,
}

/// This helper function does an HTTP GET, and returns the body as a `Bytes`, so that it can be passed
/// into `create_response` easily, and the example handlers can focus on the business logic.
/// You may notice that the body collecting looks very similar to the POST example in
/// `examples/handlers/request_data`.
#[cfg(not(test))]
fn http_get(url_str: &str) -> ResponseContentFuture {
    let client = Client::builder(TokioExecutor::new()).build_http::<Full<Bytes>>();
    let url: Uri = url_str.parse().unwrap();
    let f = client
        .get(url)
        .map_err(anyhow::Error::from)
        .and_then(|response| {
            response
                .into_body()
                .collect()
                .map_ok(Collected::to_bytes)
                .map_err(anyhow::Error::from)
        });

    f.boxed()
}

/// The other advantage of using a helper function is that you can easily patch it out for testing.
/// You typically don't want to rely on external http services for your unit tests, because they
/// will fail unexpectedly, and cause you to stop believing your unit tests when they fail.
/// The subject of patching/mocking things out for test purposes is a big one, and this is just a
/// toy example, so we just return success.
#[cfg(test)]
fn http_get(_url_str: &str) -> ResponseContentFuture {
    // We make the test version return something different from what a real view would, to make
    // it easier to spot in the tests.
    future::ok(Bytes::from_static(b"y")).boxed()
}

/// Now we come to the business end of the example.
///
/// This is a contrived example, that calls itself recursively over http, to produce a string of
/// 'z's of length `length`. This is not something that you would want to do in real life.
/// That said, the techniques used should be transferrable to any code that makes calls
/// to external services, and wants to do so without blocking other Handlers from running on the
/// same thread while it's waiting for a response.
///
/// Something to note about this example is that because we're accumulating results from one future
/// to the next, our code drifts to the right. If you are using nightly, you can avoid this by
/// using something like:
/// https://github.com/alexcrichton/futures-await
fn series_handler(mut state: State) -> Pin<Box<HandlerFuture>> {
    let length = QueryStringExtractor::take_from(&mut state).length;
    println!("series length: {} starting", length);

    // We have two base cases (`n = 0` and `n = 1`) and a block that recurses.
    // Note that we pick a signature for our future that makes lives easier for our business logic,
    // and then convert it into a `Box<HandlerFuture>` in the end.
    let data_future: ResponseContentFuture = if length == 0 {
        future::ok(Bytes::new()).boxed()
    } else if length == 1 {
        future::ok(Bytes::from_static(b"z")).boxed()
    } else {
        // These are the two URLs we're going to request. We're just splitting the length into
        // two roughly equal parts and calling ourselves. In a real application, these might
        // be external web apis or internal microservices.
        let url_a = format!("http://127.0.0.1:7878/series?length={}", length / 2);
        let url_b = format!(
            "http://127.0.0.1:7878/series?length={}",
            length / 2 + length % 2
        );

        // Here, we get the first URL, and then get the second URL, and then concatenate the
        // two together. Notice that we have to move body_a into the second closure, and so our
        // code drifts to the right.
        let f = http_get(&url_a).and_then(move |body_a| {
            http_get(&url_b).and_then(move |body_b| {
                let mut body_a = BytesMut::from(body_a);
                body_a.extend(body_b);
                future::ok(Bytes::from(body_a))
            })
        });

        f.boxed()
    };

    // Here, we convert the future from our handler into the form that Gotham expects.
    // All we do is move `state` in, to return it, and convert any errors that we have.
    data_future
        .then(move |result| match result {
            Ok(data) => {
                let res = create_response(&state, StatusCode::OK, TEXT_PLAIN, data);
                println!("series length: {} finished", length);
                future::ok((state, res))
            }
            Err(err) => future::err((state, err.into())),
        })
        .boxed()
}

/// This example uses a `future::Stream` to implement a `for` loop. This example only has two urls
/// to call `http_get` on, but you can hopefully see how it is a useful pattern.
///
/// If any `http_get` call returns an error, then processing will stop, and the error will be
/// returned.
///
/// https://github.com/alexcrichton/futures-await has a more readable syntax for this as
/// well, if you are using nightly Rust.
fn loop_handler(mut state: State) -> Pin<Box<HandlerFuture>> {
    let length = QueryStringExtractor::take_from(&mut state).length;
    println!("loop length: {} starting", length);

    // The structure is the same as `series_handler`, above.
    let data_future: ResponseContentFuture = if length == 0 {
        future::ok(Bytes::new()).boxed()
    } else if length == 1 {
        future::ok(Bytes::from_static(b"z")).boxed()
    } else {
        let url_a = format!("http://127.0.0.1:7878/loop?length={}", length / 2);
        let url_b = format!(
            "http://127.0.0.1:7878/loop?length={}",
            length / 2 + length % 2
        );

        // Here, we create a stream that contains our two URLs, and call fold to loop over all URLs
        // and get the urls, concatenating the results into the accumulator (which starts off as the
        // empty `Vec`).
        let f = stream::iter(vec![url_a, url_b])
            .map(Ok)
            .try_fold(BytesMut::new(), move |mut accumulator, url| {
                // Do the http_get(), and append the result to the accumulator so that it can
                // be returned.
                http_get(&url).and_then(move |body| {
                    accumulator.put(body);
                    future::ok(accumulator)
                })
            })
            .map_ok(Bytes::from);

        f.boxed()
    };

    data_future
        .then(move |result| match result {
            Ok(data) => {
                let res = create_response(&state, StatusCode::OK, TEXT_PLAIN, data);
                println!("loop length: {} finished", length);
                future::ok((state, res))
            }
            Err(err) => future::err((state, err.into())),
        })
        .boxed()
}

/// This example does the same thing as `series_handler`, but doesn't wait for the first request
/// to return before starting the second. This approach is very tempting, but it is not recommended.
///
/// Problems with this approach include:
/// * If both requests fail then you will get the error from whichever one happened to fail first,
///   and the othe
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

### Incident Patch 1: `ba5ab39b` (2026-07-25)
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

### Incident Patch 2: `3bb8c387` (2025-05-16)
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

### Incident Patch 3: `059b4419` (2024-04-17)
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

### Incident Patch 4: `8e42df6c` (2024-04-12)
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

### Incident Patch 5: `6a2b527e` (2024-03-05)
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

### Incident Patch 6: `446279d0` (2023-10-25)
**Commit Message**: assets: Fix range request status code (#633)

Should return partial content (206) rather than (200)
RFC 9110, section 14.2: "the server SHOULD send a 206 (Partial Content)
response with content containing one or more partial representations"

Signed-off-by: Janne Pelkonen <jpelkonen@ideanovatech.com>

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

### Incident Patch 7: `c433082f` (2023-09-12)
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

---

### Incident Patch 8: `b33a6e44` (2023-05-20)
**Commit Message**: Use clippy 1.69 in CI and fix lints (#616)

**File**: `.github/workflows/rust.yml` (modified, +9/-21)
```diff
@@ -19,18 +19,15 @@ jobs:
     steps:
       - uses: actions/checkout@v2
       - uses: dtolnay/rust-toolchain@stable
-      
-      - name: Get Rust Version
-        id: rust-version
-        run: echo "::set-output name=VERSION::$(cargo -V | head -n1 | awk '{print $2}')"
+        id: rust-toolchain
       
       - uses: actions/cache@v2
         with:
           path: |
             ~/.cargo/git
             ~/.cargo/registry
             target
-          key: ${{ runner.os }}-rust-gotham${{ matrix.flag }}-${{ steps.rust-version.outputs.VERSION }}
+          key: ${{ runner.os }}-rust-gotham${{ matrix.flag }}-${{ steps.rust-toolchain.outputs.cachekey }}
       
       - run: cargo ${{ matrix.command }} -p gotham ${{ matrix.flag }}
   
@@ -50,20 +47,17 @@ jobs:
     steps:
       - uses: actions/checkout@v2
       - uses: dtolnay/rust-toolchain@master
+        id: rust-toolchain
         with:
           toolchain: ${{ matrix.toolchain }}
       
-      - name: Get Rust Version
-        id: rust-version
-        run: echo "::set-output name=VERSION::$(cargo -V | head -n1 | awk '{print $2}')"
-      
       - uses: actions/cache@v2
         with:
           path: |
             ~/.cargo/git
             ~/.cargo/registry
             target
-          key: ${{ runner.os }}-rust-${{ steps.rust-version.outputs.VERSION }}
+          key: ${{ runner.os }}-rust-${{ steps.rust-toolchain.outputs.cache-key }}
       
       - run: cargo test --workspace
   
@@ -81,21 +75,18 @@ jobs:
     steps:
       - uses: actions/checkout@v2
       - uses: dtolnay/rust-toolchain@master
+        id: rust-toolchain
         with:
-          toolchain: "1.63"
+          toolchain: "1.69"
           components: clippy
       
-      - name: Get Rust Version
-        id: rust-version
-        run: echo "::set-output name=VERSION::$(cargo -V | head -n1 | awk '{print $2}')"
-      
       - uses: actions/cache@v2
         with:
           path: |
             ~/.cargo/git
             ~/.cargo/registry
             target
-          key: ${{ runner.os }}-rust-${{ steps.rust-version.outputs.VERSION }}-clippy
+          key: ${{ runner.os }}-rust-${{ steps.rust-toolchain.outputs.cachekey }}-clippy
       
       - run: cargo clippy --workspace --profile test -- -Dclippy::all
   
@@ -105,10 +96,7 @@ jobs:
     steps:
       - uses: actions/checkout@v2
       - uses: dtolnay/rust-toolchain@stable
-      
-      - name: Get Rust Version
-        id: rust-version
-        run: echo "::set-output name=VERSION::$(cargo -V | head -n1 | awk '{print $2}')"
+        id: rust-toolchain
       
       - name: Get Tarpaulin Version
         id: tarpaulin-version
@@ -121,7 +109,7 @@ jobs:
             ~/.cargo/git
             ~/.cargo/registry
             target
-          key: ${{ runner.os }}-rust-${{ steps.rust-version.outputs.VERSION }}-tarpaulin-${{ steps.tarpaulin-version.outputs.VERSION }}
+          key: ${{ runner.os }}-rust-${{ steps.rust-toolchain.outputs.cachekey }}-tarpaulin-${{ steps.tarpaulin-version.outputs.VERSION }}
       
       - name: Install Tarpaulin
         run: test -e ~/.cargo/bin/cargo-tarpaulin || cargo install cargo-tarpaulin --version ${{ steps.tarpaulin-version.outputs.VERSION }}
```

**File**: `examples/sessions/introduction/src/main.rs` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ mod tests {
         let response = test_server
             .client()
             .get("http://localhost/")
-            .with_header(COOKIE, (&cookie.to_string()).parse().unwrap())
+            .with_header(COOKIE, cookie.to_string().parse().unwrap())
             .perform()
             .unwrap();
 
```

**File**: `examples/websocket/src/ws.rs` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ fn accept_key(key: &[u8]) -> String {
     let mut sha1 = Sha1::default();
     sha1.update(key);
     sha1.update(WS_GUID);
-    BASE64_STANDARD.encode(&sha1.finalize())
+    BASE64_STANDARD.encode(sha1.finalize())
 }
 
 #[cfg(test)]
```

**File**: `gotham/src/helpers/http/request/query_string.rs` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ mod tests {
             })
             .collect();
 
-        pairs.sort_by(|&(ref a, ref _a_val), &(ref b, ref _b_val)| a.cmp(b));
+        pairs.sort_by(|(a, _), (b, _)| a.cmp(b));
         pairs
     }
 
```

**File**: `gotham/src/pipeline/single.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ pub type SinglePipelineChain<C> = (SinglePipelineHandle<C>, ());
 ///
 /// build_router(chain, pipelines, |route| {
 ///     // Implementation elided
-/// #   drop(route);
+/// #   _ = route;
 /// });
 /// # }
 /// ```
```

---

### Incident Patch 9: `878e7b5e` (2021-11-18)
**Commit Message**: Fix session discard future not being Send (#581)

**File**: `gotham/src/middleware/session/mod.rs` (modified, +37/-3)
```diff
@@ -284,11 +284,10 @@ where
 {
     /// Discards the session, invalidating it for future use and removing the data from the
     /// `Backend`.
-    // TODO: Add test case that covers this.
     pub fn discard(
         self,
         state: &mut State,
-    ) -> Pin<Box<dyn Future<Output = Result<(), SessionError>>>> {
+    ) -> Pin<Box<dyn Future<Output = Result<(), SessionError>> + Send>> {
         state.put(SessionDropData {
             cookie_config: self.cookie_config,
         });
@@ -1207,11 +1206,46 @@ mod tests {
 
         let state = State::new();
         let m = nm.new_middleware().unwrap();
-        let bytes = futures_executor::block_on(m.backend.read_session(&state, identifier))
+        let bytes = futures_executor::block_on(m.backend.read_session(&state, identifier.clone()))
             .unwrap()
             .unwrap();
         let updated = bincode::deserialize::<TestSession>(&bytes[..]).unwrap();
 
         assert_eq!(updated.val, session.val + 1);
+
+        let handler = move |mut state: State| {
+            async move {
+                {
+                    let session_data = state.take::<SessionData<TestSession>>();
+                    session_data.discard(&mut state).await.unwrap();
+                }
+
+                Ok((
+                    state,
+                    Response::builder()
+                        .status(StatusCode::NO_CONTENT)
+                        .body(Body::empty())
+                        .unwrap(),
+                ))
+            }
+            .boxed()
+        };
+
+        let mut state = State::new();
+        let mut headers = HeaderMap::new();
+        let cookie = Cookie::build("_gotham_session", identifier.value.clone()).finish();
+        headers.insert(COOKIE, cookie.to_string().parse().unwrap());
+        state.put(headers);
+
+        let m = nm.new_middleware().unwrap();
+        let r = m.call(state, handler);
+        if let Err((_, e)) = futures_executor::block_on(r) {
+            panic!("error: {:?}", e);
+        }
+
+        let state = State::new();
+        let m = nm.new_middleware().unwrap();
+        let data = futures_executor::block_on(m.backend.read_session(&state, identifier)).unwrap();
+        assert_eq!(data, None);
     }
 }
```

---

### Incident Patch 10: `82d9e68f` (2021-08-15)
**Commit Message**: Fix tarpaulin not compiling our askama example (#554)

This is due to bitvec not compiling when tarpaulin-specific cfg! are set
by simply removing nom's optional-but-cargo-doesn't-know depedency to it

**File**: `Cargo.toml` (modified, +5/-0)
```diff
@@ -85,3 +85,8 @@ members = [
     "examples/custom_service/",
 
 ]
+
+[patch.crates-io]
+# bitvec doesn't compile when tarpaulin-specific cfg is set
+# however, bitvec isn't required by nom, so we patch it out
+nom = { git = "https://github.com/djc/nom", rev = "9e999b1e110b26a275ecd8e17f7d091400836599" } # branch = "bitvec-not-default"
```

**File**: `examples/templating/askama/Cargo.toml` (modified, +3/-0)
```diff
@@ -7,3 +7,6 @@ edition = "2018"
 [dependencies]
 gotham = { path = "../../../gotham" }
 askama = "0.10.3"
+
+# see comment in the workspace root
+nom = "=6.2.0"
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
