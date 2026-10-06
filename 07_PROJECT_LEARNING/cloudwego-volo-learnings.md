# Forensic Learning Record (Deep Inspection): cloudwego/volo

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloudwego-volo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cloudwego/volo](https://github.com/cloudwego/volo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:34.789Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cloudwego/volo`
- **Description**: Rust RPC framework with high-performance and strong-extensibility for building micro-services.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2629 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/scripts/reports/render_images.py`
```
import matplotlib.pyplot as plt
import sys

kind = "thrift"


# 0-name, 1-concurrency, 2-size, 3-qps, 6-p99, 7-p999
def parse_data(file):
    import csv
    csv_reader = csv.reader(open(file))
    lines = []
    for line in csv_reader:
        lines.append(line)
    x_label, x_ticks = parse_x(lines=lines)
    print(x_label, x_ticks)

    y_qps = parse_y(lines=lines, idx=3)
    print(y_qps)
    plot_data(title="QPS (higher is better)", xlabel=x_label, ylabel="qps", x_ticks=x_ticks, ys=y_qps)

    y_p99 = parse_y(lines=lines, idx=4, times=1000)
    print(y_p99)
    plot_data(title="TP99 (lower is better)", xlabel=x_label, ylabel="latency(us)", x_ticks=x_ticks, ys=y_p99)

    y_p999 = parse_y(lines=lines, idx=5, times=1000)
    print(y_p999)
    plot_data(title="TP999 (lower is better)", xlabel=x_label, ylabel="latency(us)", x_ticks=x_ticks, ys=y_p999)


# 并发相同比 size; size 相同比并发
def parse_x(lines):
    l = len(lines)
    idx = 1
    x_label = "concurrency"
    if lines[0][1] == lines[l - 1][1]:
        idx = 2
        x_label = "echo size(Byte)"
    x_list = []
    x_key = lines[0][0]
    for line in lines:
        if line[0] == x_key:
            x_list.append(int(line[idx]))
    return x_label, x_list


def parse_y(lines, idx, times=1):
    y_dict = {}
    for line in lines:
        name = line[0]
        y_line = y_dict.get(name, [])
        n = float(line[idx]) * times
        y_line.append(int(n))
        # y_line.append(int(line[idx]))
        y_dict[name] = y_line
    return y_dict


# TODO
color_dict = {
    "[thrift]": "royalblue",
}


# ys={"$net":[]number}
def plot_data(title, xlabel, ylabel, x_ticks, ys):
    plt.figure(figsize=(8, 5))
    # bmh、ggplot、dark_background、fivethirtyeight 和 grayscale
    plt.style.use('grayscale')
    plt.title(title)

    plt.xlabel(xlabel)
    plt.ylabel(ylabel)

    # x 轴示数
    plt.xticks(range(len(x_ticks)), x_ticks)

    for k, v in ys.items():
        color = color_dict.get(k)
        if color != "":
            plt.plot(v, label=k, linewidth=2, color=color)
        else:
            plt.plot(v, label=k, linewidth=2)

    # y 轴从 0 开始
    bottom, top = plt.ylim()
    plt.ylim(bottom=0, top=1.2 * top)

    plt.legend(prop={'size': 12})
    plt.savefig("{0}_{1}.png".format(kind, title.split(" ")[0].lower()))
    # plt.show()


if __name__ == '__main__':
    if len(sys.argv) > 1:
        kind = sys.argv[1]
    parse_data(file="{0}.csv".format(kind))

```

### Core Architecture Module: `volo-http/src/client/layer/utils.rs`
```
use std::borrow::Cow;

use faststr::FastStr;
use http::{header, uri::Uri};
use motore::{layer::Layer, service::Service};
use volo::{client::Apply, context::Context, net::Address};

use crate::{
    client::Target,
    context::ClientContext,
    error::{ClientError, client::Result},
    request::Request,
};

/// Set a [`Target`] as the destination forcely.
///
/// The layer only sets destination address, including target address, target domain name (for DNS)
/// and SNI of target host (if using HTTPS).
///
/// Note that this layer MUST be set as an outer layer because outer layers runs before service
/// discover (DNS).
pub struct TargetLayer {
    target: Target,
    service_name: FastStr,
}

impl TargetLayer {
    /// Create a [`TargetLayer`] via a [`Target`].
    ///
    /// This layer will set the [`Target`] as request destination.
    pub const fn new(target: Target) -> Self {
        Self {
            target,
            service_name: FastStr::empty(),
        }
    }

    /// Create a [`TargetLayer`] via an address.
    pub fn new_address<A>(addr: A) -> Self
    where
        A: Into<Address>,
    {
        let addr = addr.into();
        let target = Target::from(addr);
        Self {
            target,
            service_name: FastStr::empty(),
        }
    }

    /// Create a [`TargetLayer`] via a host name.
    pub fn new_host<S>(host: S) -> Self
    where
        S: Into<Cow<'static, str>>,
    {
        let target = Target::from_host(host);
        Self {
            target,
            service_name: FastStr::empty(),
        }
    }

    /// Create a [`Target`] from a [`Uri`].
    ///
    /// ## Panics
    ///
    /// This function will panic if the given [`Uri`] cannot be parsed to a [`Target`].
    pub fn from_uri(uri: &Uri) -> Self {
        let target = Target::from_uri(uri).expect("invalid uri for building target");
        Self {
            target,
            service_name: FastStr::empty(),
        }
    }

    /// Set a service name for current [`TargetLayer`].
    ///
    /// When this layer sets [`Target`] as the destination, the service name is also set, and if the
    /// request uses HTTPS, the service name will be used as the SNI.
    pub fn with_service_name<S>(mut self, service_name: S) -> Self
    where
        S: Into<FastStr>,
    {
        self.service_name = service_name.into();
        self
    }
}

impl<S> Layer<S> for TargetLayer {
    type Service = TargetService<S>;

    fn layer(self, inner: S) -> Self::Service {
        TargetService {
            inner,
            target: self.target,
            service_name: self.service_name,
        }
    }
}

/// [`Service`] generated by [`TargetLayer`].
///
/// For more details, please refer to [`TargetLayer`].
pub struct TargetService<S> {
    inner: S,
    target: Target,
    service_name: FastStr,
}

impl<B, S> Service<ClientContext, Request<B>> for TargetService<S>
where
    B: Send,
    S: Service<ClientContext, Request<B>, Error = ClientError> + Send + Sync,
{
    type Response = S::Response;
    type Error = S::Error;

    async fn call(
        &self,
        cx: &mut ClientContext,
        mut req: Request<B>,
    ) -> Result<Self::Response, Self::Error> {
        self.target.clone().apply(cx)?;
        update_request_extension(req.extensions_mut(), &self.target);
        if !self.service_name.is_empty() {
            cx.rpc_info_mut()
                .callee_mut()
                .set_service_name(self.service_name.clone());
        }
        // Since `Host` is one of the outermost layers, it cannot know that `Target` has been
        // modified here, so we need to manually update `Host` here.
        if !req.headers().contains_key(header::HOST) {
            if let Some(host) = super::header::gen_host(&self.target) {
                req.headers_mut().insert(header::HOST, host);
            }
        }
        self.inner.call(cx, req).await
    }
}

pub(in crate::client) fn update_request_extension(ext: &mut http::Extensions, target: &Target) {
    ext.remove::<http::uri::Scheme>();
    if let Some(scheme) = target.scheme().cloned() {
        ext.insert(scheme);
    };
}

```

### Core Architecture Module: `volo-http/src/client/utils.rs`
```
use http::uri::Scheme;

use crate::utils::consts;

pub fn get_default_port(scheme: &Scheme) -> u16 {
    #[cfg(feature = "__tls")]
    if scheme == &Scheme::HTTPS {
        return consts::HTTPS_DEFAULT_PORT;
    }
    if scheme == &Scheme::HTTP {
        return consts::HTTP_DEFAULT_PORT;
    }
    unreachable!("[Volo-HTTP] https is not allowed when feature `tls` is not enabled")
}

pub fn is_default_port(scheme: &Scheme, port: u16) -> bool {
    get_default_port(scheme) == port
}

```

### Core Architecture Module: `volo-http/src/server/route/utils.rs`
```
use std::{
    collections::{HashMap, hash_map::Drain},
    error::Error,
    fmt,
    future::Future,
    str::FromStr,
};

use http::uri::Uri;
use motore::{layer::Layer, service::Service};

use crate::{context::ServerContext, request::Request, response::Response};

// The `matchit::Router` cannot be converted to `Iterator`, so using
// `matchit::Router<MethodRouter>` is not convenient enough.
//
// To solve the problem, we refer to the implementation of `axum` and introduce a `RouteId` as a
// bridge, the `matchit::Router` only handles some IDs and each ID corresponds to a `MethodRouter`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(super) struct RouteId(u32);

impl RouteId {
    fn next() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        // `AtomicU64` isn't supported on all platforms
        static ID: AtomicU32 = AtomicU32::new(0);
        let id = ID.fetch_add(1, Ordering::Relaxed);
        if id == u32::MAX {
            panic!("Over `u32::MAX` routes created. If you need this, please file an issue.");
        }
        Self(id)
    }
}

#[derive(Default)]
pub(super) struct Matcher {
    matches: HashMap<String, RouteId>,
    router: matchit::Router<RouteId>,
}

impl Matcher {
    pub fn insert<R>(&mut self, uri: R) -> Result<RouteId, MatcherError>
    where
        R: Into<String>,
    {
        let route_id = RouteId::next();
        self.insert_with_id(uri, route_id)?;
        Ok(route_id)
    }

    pub fn insert_with_id<R>(&mut self, uri: R, route_id: RouteId) -> Result<(), MatcherError>
    where
        R: Into<String>,
    {
        let uri = uri.into();
        if self.matches.insert(uri.clone(), route_id).is_some() {
            return Err(MatcherError::UriConflict(uri));
        }
        self.router
            .insert(uri, route_id)
            .map_err(MatcherError::RouterInsertError)?;
        Ok(())
    }

    pub fn at<'a>(
        &'a self,
        path: &'a str,
    ) -> Result<matchit::Match<'a, 'a, &'a RouteId>, MatcherError> {
        self.router.at(path).map_err(MatcherError::RouterMatchError)
    }

    pub fn drain(&mut self) -> Drain<'_, String, RouteId> {
        self.matches.drain()
    }
}

#[derive(Debug)]
pub(super) enum MatcherError {
    UriConflict(String),
    RouterInsertError(matchit::InsertError),
    RouterMatchError(matchit::MatchError),
}

impl fmt::Display for MatcherError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UriConflict(uri) => write!(f, "URI conflict: {uri}"),
            Self::RouterInsertError(err) => write!(f, "router insert error: {err}"),
            Self::RouterMatchError(err) => write!(f, "router match error: {err}"),
        }
    }
}

impl Error for MatcherError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::UriConflict(_) => None,
            Self::RouterInsertError(e) => Some(e),
            Self::RouterMatchError(e) => Some(e),
        }
    }
}

pub(super) struct StripPrefixLayer;

impl<S> Layer<S> for StripPrefixLayer {
    type Service = StripPrefix<S>;

    fn layer(self, inner: S) -> Self::Service {
        StripPrefix { inner }
    }
}

pub(super) const NEST_CATCH_PARAM: &str = "{*__priv_nest_catch_param}";
pub(super) const NEST_CATCH_PARAM_NAME: &str = "__priv_nest_catch_param";

pub(super) struct StripPrefix<S> {
    inner: S,
}

impl<S, B, E> Service<ServerContext, Request<B>> for StripPrefix<S>
where
    S: Service<ServerContext, Request<B>, Response = Response, Error = E>,
{
    type Response = Response;
    type Error = E;

    fn call(
        &self,
        cx: &mut ServerContext,
        mut req: Request<B>,
    ) -> impl Future<Output = Result<Self::Response, Self::Error>> + Send {
        let mut uri = String::from("/");
        if cx
            .params()
            .last()
            .is_some_and(|(k, _)| k == NEST_CATCH_PARAM_NAME)
        {
            uri += cx.params_mut().pop().unwrap().1.as_str();
        };
        if let Some(query) = req.uri().query() {
            uri.push('?');
            uri.push_str(query);
        }

        // SAFETY: The value is from a valid uri, so it can also be converted into
        // a valid uri safely.
        *req.uri_mut() = Uri::from_str(&uri).expect("infallible: stripped uri is invalid");
        self.inner.call(cx, req)
    }
}

```

### Core Architecture Module: `volo-http/src/server/utils/client_ip.rs`
```
//! Utilities for extracting original client ip
//!
//! See [`ClientIp`] for more details.
use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    str::FromStr,
};

use http::{HeaderMap, HeaderName};
use ipnet::{IpNet, Ipv4Net, Ipv6Net};
use motore::{Service, layer::Layer};
use volo::{context::Context, net::Address};

use crate::{context::ServerContext, request::Request};

/// [`Layer`] for extracting client ip
///
/// See [`ClientIp`] for more details.
#[derive(Clone, Debug, Default)]
pub struct ClientIpLayer {
    config: ClientIpConfig,
}

impl ClientIpLayer {
    /// Create a new [`ClientIpLayer`] with default config
    pub fn new() -> Self {
        Default::default()
    }

    /// Create a new [`ClientIpLayer`] with the given [`ClientIpConfig`]
    pub fn with_config(self, config: ClientIpConfig) -> Self {
        Self { config }
    }
}

impl<S> Layer<S> for ClientIpLayer
where
    S: Send + Sync + 'static,
{
    type Service = ClientIpService<S>;

    fn layer(self, inner: S) -> Self::Service {
        ClientIpService {
            service: inner,
            config: self.config,
        }
    }
}

/// Config for extract client ip
#[derive(Clone, Debug)]
pub struct ClientIpConfig {
    remote_ip_headers: Vec<HeaderName>,
    trusted_cidrs: Vec<IpNet>,
}

impl Default for ClientIpConfig {
    fn default() -> Self {
        Self {
            remote_ip_headers: vec![
                HeaderName::from_static("x-real-ip"),
                HeaderName::from_static("x-forwarded-for"),
            ],
            trusted_cidrs: vec![
                IpNet::V4(Ipv4Net::new_assert(Ipv4Addr::new(0, 0, 0, 0), 0)),
                IpNet::V6(Ipv6Net::new_assert(
                    Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0),
                    0,
                )),
            ],
        }
    }
}

impl ClientIpConfig {
    /// Create a new [`ClientIpConfig`] with default values
    ///
    /// default remote ip headers: `["X-Real-IP", "X-Forwarded-For"]`
    ///
    /// default trusted cidrs: `["0.0.0.0/0", "::/0"]`
    pub fn new() -> Self {
        Default::default()
    }

    /// Get Real Client IP by parsing the given headers.
    ///
    /// See [`ClientIp`] for more details.
    ///
    /// # Example
    ///
    /// ```rust
    /// use volo_http::server::utils::client_ip::ClientIpConfig;
    ///
    /// let client_ip_config =
    ///     ClientIpConfig::new().with_remote_ip_headers(vec!["X-Real-IP", "X-Forwarded-For"]);
    /// ```
    pub fn with_remote_ip_headers<I>(
        self,
        headers: I,
    ) -> Result<Self, http::header::InvalidHeaderName>
    where
        I: IntoIterator,
        I::Item: AsRef<str>,
    {
        let headers = headers.into_iter().collect::<Vec<_>>();
        let mut remote_ip_headers = Vec::with_capacity(headers.len());
        for header_str in headers {
            let header_value = HeaderName::from_str(header_str.as_ref())?;
            remote_ip_headers.push(header_value);
        }

        Ok(Self {
            remote_ip_headers,
            trusted_cidrs: self.trusted_cidrs,
        })
    }

    /// Get Real Client IP if it is trusted, otherwise it will just return caller ip.
    ///
    /// See [`ClientIp`] for more details.
    ///
    /// # Example
    ///
    /// ```rust
    /// use volo_http::server::utils::client_ip::ClientIpConfig;
    ///
    /// let client_ip_config = ClientIpConfig::new()
    ///     .with_trusted_cidrs(vec!["0.0.0.0/0".parse().unwrap(), "::/0".parse().unwrap()]);
    /// ```
    pub fn with_trusted_cidrs<H>(self, cidrs: H) -> Self
    where
        H: IntoIterator<Item = IpNet>,
    {
        Self {
            remote_ip_headers: self.remote_ip_headers,
            trusted_cidrs: cidrs.into_iter().collect(),
        }
    }
}

/// Return original client IP Address
///
/// If you want to get client IP by retrieving specific headers, you can use
/// [`with_remote_ip_headers`](ClientIpConfig::with_remote_ip_headers) to set the
/// headers.
///
/// If you want to get client IP that is trusted with specific cidrs, you can use
/// [`with_trusted_cidrs`](ClientIpConfig::with_trusted_cidrs) to set the cidrs.
///
/// # Example
///
/// ## Default config
///
/// default remote ip headers: `["X-Real-IP", "X-Forwarded-For"]`
///
/// default trusted cidrs: `["0.0.0.0/0", "::/0"]`
///
/// ```rust
/// ///
/// use volo_http::server::utils::client_ip::ClientIp;
/// use volo_http::server::{
///     Server,
///     route::{Router, get},
///     utils::client_ip::{ClientIpConfig, ClientIpLayer},
/// };
///
/// async fn handler(ClientIp(client_ip): ClientIp) -> String {
///     client_ip.unwrap().to_string()
/// }
///
/// let router: Router = Router::new()
///     .route("/", get(handler))
///     .layer(ClientIpLayer::new());
/// ```
///
/// ## With custom config
///
/// ```rust
/// use http::HeaderMap;
/// use volo_http::{
///     context::ServerContext,
///     server::{
///         Server,
///         route::{Router, get},
///         utils::client_ip::{ClientIp, ClientIpConfig, ClientIpLayer},
///     },
/// };
///
/// async fn handler(ClientIp(client_ip): ClientIp) -> String {
///     client_ip.unwrap().to_string()
/// }
///
/// let router: Router = Router::new().route("/", get(handler)).layer(
///     ClientIpLayer::new().with_config(
///         ClientIpConfig::new()
///             .with_remote_ip_headers(vec!["x-real-ip", "x-forwarded-for"])
///             .unwrap()
///             .with_trusted_cidrs(vec!["0.0.0.0/0".parse().unwrap(), "::/0".parse().unwrap()]),
///     ),
/// );
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ClientIp(pub Option<IpAddr>);

/// [`ClientIpLayer`] generated [`Service`]
///
/// See [`ClientIp`] for more details.
#[derive(Clone, Debug)]
pub struct ClientIpService<S> {
    service: S,
    config: ClientIpConfig,
}

impl<S> ClientIpService<S> {
    fn get_client_ip(&self, cx: &ServerContext, headers: &HeaderMap) -> ClientIp {
        let remote_ip = match &cx.rpc_info().caller().address {
            Some(Address::Ip(socket_addr)) => Some(socket_addr.ip()),
            #[cfg(target_family = "unix")]
            Some(Address::Unix(_)) => None,
            #[allow(unreachable_patterns)]
            Some(_) => unimplemented!("unsupported type of address"),
            None => return ClientIp(None),
        };

        if let Some(remote_ip) = &remote_ip {
            if !self
                .config
                .trusted_cidrs
                .iter()
                .any(|cidr| cidr.contains(remote_ip))
            {
                return ClientIp(None);
            }
        }

        for remote_ip_header in self.config.remote_ip_headers.iter() {
            let Some(remote_ips) = headers.get(remote_ip_header).and_then(|v| v.to_str().ok())
            else {
                continue;
            };
            for remote_ip in remote_ips.split(',').map(str::trim) {
                if let Ok(remote_ip_addr) = IpAddr::from_str(remote_ip) {
                    if self
                        .config
                        .trusted_cidrs
                        .iter()
                        .any(|cidr| cidr.contains(&remote_ip_addr))
                    {
                        return ClientIp(Some(remote_ip_addr));
                    }
                }
            }
        }

        ClientIp(remote_ip)
    }
}

impl<S, B> Service<ServerContext, Request<B>> for ClientIpService<S>
where
    S: Service<ServerContext, Request<B>> + Send + Sync + 'static,
    B: Send,
{
    type Response = S::Response;
    type Error = S::Error;

    async fn call(
        &self,
        cx: &mut ServerContext,
        req: Request<B>,
    ) -> Result<Self::Response, Self::Error> {
        let client_ip = self.get_client_ip(cx, req.headers());
        cx.extensions_mut().insert(client_ip);

        self.service.call(cx, req).await
    }
}

#[cfg(test)]
mod client_ip_tests {
    use std::{net::SocketAddr, str::FromStr};

    use http::{HeaderValue, Method};
    use motore::{Service, layer::Layer};
    use volo::net::Address;

    use crate::{
        body::BodyConversion,
        context::ServerContext,
        server::{
            route::{Route, get},
            utils::client_ip::{ClientIp, ClientIpConfig, ClientIpLayer},
        },
        utils::test_helpers::simple_req,
    };

    #[tokio::test]
    async fn test_client_ip() {
        async fn handler(ClientIp(client_ip): ClientIp) -> String {
            client_ip.unwrap().to_string()
        }

        let route: Route<&str> = Route::new(get(handler));
        let service = ClientIpLayer::new()
            .with_config(
                ClientIpConfig::default().with_trusted_cidrs(vec!["10.0.0.0/8".parse().unwrap()]),
            )
            .layer(route);

        let mut cx = ServerContext::new(Address::from(
            SocketAddr::from_str("10.0.0.1:8080").unwrap(),
        ));

        // Test case 1: no remote ip header
        let req = simple_req(Method::GET, "/", "");
        let resp = service.call(&mut cx, req).await.unwrap();
        assert_eq!("10.0.0.1", resp.into_string().await.unwrap());

        // Test case 2: with remote ip header
        let mut req = simple_req(Method::GET, "/", "");
        req.headers_mut()
            .insert("X-Real-IP", HeaderValue::from_static("10.0.0.2"));
        let resp = service.call(&mut cx, req).await.unwrap();
        assert_eq!("10.0.0.2", resp.into_string().await.unwrap());

        let mut req = simple_req(Method::GET, "/", "");
        req.headers_mut()
            .insert("X-Forwarded-For", HeaderValue::from_static("10.0.1.0"));
        let resp = service.call(&mut cx, req).await.unwrap();
        assert_eq!("10.0.1.0", resp.into_string().await.unwrap());

        // Test case 3: with untrusted remote ip
        let mut req = simple_req(Method::GET, "/", "");
        req.headers_mut()
            .insert("X-Real-IP", HeaderValue::from_static("11.0.0.1"));
        let resp = service.call(&mut cx, req).await.unwra
```

### Core Architecture Module: `volo-http/src/server/utils/file_response.rs`
```
use std::{
    fs::File,
    io,
    path::Path,
    pin::Pin,
    task::{Context, Poll, ready},
};

use bytes::Bytes;
use futures::Stream;
use http::header::{self, HeaderValue};
use http_body::{Frame, SizeHint};
use pin_project::pin_project;
use tokio::io::AsyncRead;
use tokio_util::io::ReaderStream;

use crate::{body::Body, response::Response, server::IntoResponse};

const BUF_SIZE: usize = 4096;

/// Response for sending a file.
pub struct FileResponse {
    file: File,
    size: u64,
    content_type: HeaderValue,
}

impl FileResponse {
    /// Create a new [`FileResponse`] with given path and `Content-Type`
    pub fn new<P>(path: P, content_type: HeaderValue) -> io::Result<Self>
    where
        P: AsRef<Path>,
    {
        let file = File::open(path)?;
        let metadata = file.metadata()?;

        Ok(Self {
            file,
            size: metadata.len(),
            content_type,
        })
    }

    /// Create a new [`FileResponse`] with guessing `Content-Type` through file name
    pub fn new_with_guess_type<P>(path: P) -> io::Result<Self>
    where
        P: AsRef<Path>,
    {
        let path = path.as_ref();
        Self::new(path, super::serve_dir::guess_mime(path))
    }
}

impl IntoResponse for FileResponse {
    fn into_response(self) -> Response {
        let file = tokio::fs::File::from_std(self.file);
        Response::builder()
            .header(header::CONTENT_TYPE, self.content_type)
            .body(Body::from_body(FileBody {
                reader: ReaderStream::with_capacity(file, BUF_SIZE),
                size: self.size,
            }))
            .unwrap()
    }
}

#[pin_project]
struct FileBody<R> {
    #[pin]
    reader: ReaderStream<R>,
    size: u64,
}

impl<R> http_body::Body for FileBody<R>
where
    R: AsyncRead,
{
    type Data = Bytes;
    type Error = io::Error;

    fn poll_frame(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        match ready!(self.project().reader.poll_next(cx)) {
            Some(Ok(chunk)) => Poll::Ready(Some(Ok(Frame::data(chunk)))),
            Some(Err(err)) => Poll::Ready(Some(Err(err))),
            None => Poll::Ready(None),
        }
    }

    fn size_hint(&self) -> SizeHint {
        SizeHint::with_exact(self.size)
    }
}

```

### Core Architecture Module: `volo-http/src/server/utils/mod.rs`
```
//! Utilities at server-side.

mod file_response;
mod serve_dir;

pub use file_response::FileResponse;
pub use serve_dir::ServeDir;

pub mod client_ip;
#[cfg(feature = "multipart")]
pub mod multipart;
#[cfg(feature = "ws")]
pub mod ws;

```

### Core Architecture Module: `volo-http/src/server/utils/multipart.rs`
```
//! Multipart implementation for server.
//!
//! This module provides utilities for extracting `multipart/form-data` formatted data from HTTP
//! requests.
//!
//! # Example
//!
//! ```rust
//! use http::StatusCode;
//! use volo_http::{
//!     Router,
//!     response::Response,
//!     server::{
//!         route::post,
//!         utils::multipart::{Multipart, MultipartRejectionError},
//!     },
//! };
//!
//! async fn upload(mut multipart: Multipart) -> Result<StatusCode, MultipartRejectionError> {
//!     while let Some(field) = multipart.next_field().await? {
//!         let name = field.name().unwrap().to_string();
//!         let value = field.bytes().await?;
//!
//!         println!("The field {} has {} bytes", name, value.len());
//!     }
//!
//!     Ok(StatusCode::OK)
//! }
//!
//! let app: Router = Router::new().route("/upload", post(upload));
//! ```
//!
//! See [`Multipart`] for more details.

use std::{error::Error, fmt};

use http::{StatusCode, request::Parts};
use http_body_util::BodyExt;
use multer::Field;

use crate::{
    context::ServerContext,
    server::{IntoResponse, extract::FromRequest},
};

/// Extract a type from `multipart/form-data` HTTP requests.
///
/// [`Multipart`] can be passed as an argument to a handler, which can be used to extract each
/// `multipart/form-data` field by calling [`Multipart::next_field`].
///
/// **Notice**
///
/// Extracting `multipart/form-data` data will consume the body, hence [`Multipart`] must be the
/// last argument from the handler.
///
/// # Example
///
/// ```rust
/// use http::StatusCode;
/// use volo_http::{
///     response::Response,
///     server::utils::multipart::{Multipart, MultipartRejectionError},
/// };
///
/// async fn upload(mut multipart: Multipart) -> Result<StatusCode, MultipartRejectionError> {
///     while let Some(field) = multipart.next_field().await? {
///         todo!()
///     }
///
///     Ok(StatusCode::OK)
/// }
/// ```
///
/// # Body Limitation
///
/// Since the body is unlimited, so it is recommended to use
/// [`BodyLimitLayer`](crate::server::layer::BodyLimitLayer) to limit the size of the body.
///
/// ```rust
/// use http::StatusCode;
/// use volo_http::{
///     Router,
///     server::{
///         layer::BodyLimitLayer,
///         route::post,
///         utils::multipart::{Multipart, MultipartRejectionError},
///     },
/// };
///
/// async fn upload_handler(
///     mut multipart: Multipart,
/// ) -> Result<StatusCode, MultipartRejectionError> {
///     Ok(StatusCode::OK)
/// }
///
/// let app: Router<_> = Router::new()
///     .route("/", post(upload_handler))
///     .layer(BodyLimitLayer::new(1024));
/// ```
#[must_use]
pub struct Multipart {
    inner: multer::Multipart<'static>,
}

impl Multipart {
    /// Iterate over all [`Field`] in [`Multipart`]
    ///
    /// # Example
    ///
    /// ```rust
    /// # use volo_http::server::utils::multipart::Multipart;
    /// # let mut multipart: Multipart;
    /// // Extract each field from multipart by using while loop
    /// # async fn upload(mut multipart: Multipart) {
    /// while let Some(field) = multipart.next_field().await.unwrap() {
    ///     let name = field.name().unwrap().to_string(); // Get field name
    ///     let data = field.bytes().await.unwrap(); // Get field data
    /// }
    /// # }
    /// ```
    pub async fn next_field(&mut self) -> Result<Option<Field<'static>>, MultipartRejectionError> {
        Ok(self.inner.next_field().await?)
    }
}

impl FromRequest<crate::body::Body> for Multipart {
    type Rejection = MultipartRejectionError;
    async fn from_request(
        _: &mut ServerContext,
        parts: Parts,
        body: crate::body::Body,
    ) -> Result<Self, Self::Rejection> {
        let boundary = multer::parse_boundary(
            parts
                .headers
                .get(http::header::CONTENT_TYPE)
                .ok_or(multer::Error::NoMultipart)?
                .to_str()
                .map_err(|_| multer::Error::NoBoundary)?,
        )?;

        let multipart = multer::Multipart::new(body.into_data_stream(), boundary);

        Ok(Self { inner: multipart })
    }
}

/// [`Error`]s while extracting [`Multipart`].
///
/// [`Error`]: Error
#[derive(Debug)]
pub struct MultipartRejectionError {
    inner: multer::Error,
}

impl From<multer::Error> for MultipartRejectionError {
    fn from(err: multer::Error) -> Self {
        Self { inner: err }
    }
}

fn status_code_from_multer_error(err: &multer::Error) -> StatusCode {
    match err {
        multer::Error::UnknownField { .. }
        | multer::Error::IncompleteFieldData { .. }
        | multer::Error::IncompleteHeaders
        | multer::Error::ReadHeaderFailed(..)
        | multer::Error::DecodeHeaderName { .. }
        | multer::Error::DecodeContentType(..)
        | multer::Error::NoBoundary
        | multer::Error::DecodeHeaderValue { .. }
        | multer::Error::NoMultipart
        | multer::Error::IncompleteStream => StatusCode::BAD_REQUEST,
        multer::Error::FieldSizeExceeded { .. } | multer::Error::StreamSizeExceeded { .. } => {
            StatusCode::PAYLOAD_TOO_LARGE
        }
        multer::Error::StreamReadFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

impl MultipartRejectionError {
    /// Convert the [`MultipartRejectionError`] into a [`http::StatusCode`].
    pub fn to_status_code(&self) -> http::StatusCode {
        status_code_from_multer_error(&self.inner)
    }
}

impl Error for MultipartRejectionError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(&self.inner)
    }
}

impl fmt::Display for MultipartRejectionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        std::fmt::Display::fmt(&self.inner, f)
    }
}

impl IntoResponse for MultipartRejectionError {
    fn into_response(self) -> http::Response<crate::body::Body> {
        self.to_status_code().into_response()
    }
}

#[cfg(test)]
mod multipart_tests {
    use std::{
        convert::Infallible,
        net::{IpAddr, Ipv4Addr, SocketAddr},
    };

    use motore::Service;
    use reqwest::multipart::Form;
    use volo::net::Address;

    use crate::{
        Server,
        context::ServerContext,
        request::Request,
        response::Response,
        server::{
            IntoResponse, test_helpers,
            utils::multipart::{Multipart, MultipartRejectionError},
        },
    };

    fn _test_compile() {
        async fn handler(_: Multipart) {}
        let app = test_helpers::to_service(handler);
        let addr = Address::Ip(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
            25241,
        ));
        let _server = Server::new(app).run(addr);
    }

    async fn run_handler<S>(service: S, port: u16)
    where
        S: Service<ServerContext, Request, Response = Response, Error = Infallible>
            + Send
            + Sync
            + 'static,
    {
        let addr = Address::Ip(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
            port,
        ));

        tokio::spawn(Server::new(service).run(addr));

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    #[tokio::test]
    async fn test_single_field_upload() {
        const BYTES: &[u8] = "<!doctype html><title>🦀</title>".as_bytes();
        const FILE_NAME: &str = "index.html";
        const CONTENT_TYPE: &str = "text/html; charset=utf-8";

        async fn handler(mut multipart: Multipart) -> impl IntoResponse {
            let field = multipart.next_field().await.unwrap().unwrap();

            assert_eq!(field.file_name().unwrap(), FILE_NAME);
            assert_eq!(field.content_type().unwrap().as_ref(), CONTENT_TYPE);
            assert_eq!(field.headers()["foo"], "bar");
            assert_eq!(field.bytes().await.unwrap(), BYTES);

            assert!(multipart.next_field().await.unwrap().is_none());
        }

        let form = Form::new().part(
            "file",
            reqwest::multipart::Part::bytes(BYTES)
                .file_name(FILE_NAME)
                .mime_str(CONTENT_TYPE)
                .unwrap()
                .headers(reqwest::header::HeaderMap::from_iter([(
                    reqwest::header::HeaderName::from_static("foo"),
                    reqwest::header::HeaderValue::from_static("bar"),
                )])),
        );

        run_handler(test_helpers::to_service(handler), 25241).await;

        let url_str = format!("http://127.0.0.1:{}", 25241);
        let url = url::Url::parse(url_str.as_str()).unwrap();

        reqwest::Client::new()
            .post(url)
            .multipart(form)
            .send()
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_multiple_field_upload() {
        const BYTES: &[u8] = "<!doctype html><title>🦀</title>".as_bytes();
        const CONTENT_TYPE: &str = "text/html; charset=utf-8";

        const FIELD_NAME1: &str = "file1";
        const FIELD_NAME2: &str = "file2";
        const FILE_NAME1: &str = "index1.html";
        const FILE_NAME2: &str = "index2.html";

        async fn handler(mut multipart: Multipart) -> Result<(), MultipartRejectionError> {
            while let Some(field) = multipart.next_field().await? {
                match field.name() {
                    Some(FIELD_NAME1) => {
                        assert_eq!(field.file_name().unwrap(), FILE_NAME1);
                        assert_eq!(field.headers()["foo1"], "bar1");
                    }
                    Some(FIELD_NAME2) => {
                        assert_eq!(field.file_name().unwrap(), FILE_NAME2);
                        assert_eq!(field.headers()["foo2"], "bar2");
                    }
                    _ => unreachable!(),
                }
                assert_eq!(field.content_type().unwrap().as_ref(), CONTENT_TYPE);
                assert_eq!(field.bytes().await?, BYTES);
            }


```

### Core Architecture Module: `volo-http/src/server/utils/serve_dir.rs`
```
//! Service for serving a directory.
//!
//! This module includes [`ServeDir`], which can be used for serving a directory through a
//! catch-all uri like `/static/{*path}` or `Router::nest_service`.
//!
//! # Examples
//!
//! ```
//! use volo_http::server::{
//!     route::{Router, get},
//!     utils::ServeDir,
//! };
//!
//! let router: Router = Router::new()
//!     .route("/", get(|| async { "Hello, World" }))
//!     .nest_service("/static/", ServeDir::new("."));
//! ```
//!
//! The `"."` means `ServeDir` will serve the CWD (current working directory) and then you can
//! access any file in the directory.

use std::{
    fs,
    marker::PhantomData,
    path::{Path, PathBuf},
};

use http::{header::HeaderValue, status::StatusCode};
use motore::service::Service;

use super::FileResponse;
use crate::{context::ServerContext, request::Request, response::Response, server::IntoResponse};

/// [`ServeDir`] is a service for sending files from a given directory.
pub struct ServeDir<E, F> {
    path: PathBuf,
    mime_getter: F,
    _marker: PhantomData<fn(E)>,
}

impl<E> ServeDir<E, fn(&Path) -> HeaderValue> {
    /// Create a new [`ServeDir`] service with the given path.
    ///
    /// # Panics
    ///
    /// - Panics if the path is invalid
    /// - Panics if the path is not a directory
    pub fn new<P>(path: P) -> Self
    where
        P: AsRef<Path>,
    {
        let path = fs::canonicalize(path).expect("ServeDir: failed to canonicalize path");
        assert!(path.is_dir());
        Self {
            path,
            mime_getter: guess_mime,
            _marker: PhantomData,
        }
    }

    /// Set a function for getting mime from file path.
    ///
    /// By default, [`ServeDir`] will use `mime_guess` crate for guessing a mime through the file
    /// extension name.
    pub fn mime_getter<F>(self, mime_getter: F) -> ServeDir<E, F>
    where
        F: Fn(&Path) -> HeaderValue,
    {
        ServeDir {
            path: self.path,
            mime_getter,
            _marker: self._marker,
        }
    }
}

impl<B, E, F> Service<ServerContext, Request<B>> for ServeDir<E, F>
where
    B: Send,
    F: Fn(&Path) -> HeaderValue + Sync,
{
    type Response = Response;
    type Error = E;

    async fn call(
        &self,
        _: &mut ServerContext,
        req: Request<B>,
    ) -> Result<Self::Response, Self::Error> {
        // Get relative path from uri
        let path = req.uri().path();
        let path = path.strip_prefix('/').unwrap_or(path);

        tracing::trace!("[Volo-HTTP] ServeDir: path: {path}");

        // Join to the serving directory and canonicalize it
        let path = self.path.join(path);
        let Ok(path) = fs::canonicalize(path) else {
            return Ok(StatusCode::NOT_FOUND.into_response());
        };

        // Reject file which is out of the serving directory
        if path.strip_prefix(self.path.as_path()).is_err() {
            tracing::debug!("[Volo-HTTP] ServeDir: illegal path: {}", path.display());
            return Ok(StatusCode::FORBIDDEN.into_response());
        }

        // Check metadata and permission
        if !path.is_file() {
            return Ok(StatusCode::NOT_FOUND.into_response());
        }

        // Get mime and return it!
        let content_type = (self.mime_getter)(&path);
        let Ok(resp) = FileResponse::new(path, content_type) else {
            return Ok(StatusCode::INTERNAL_SERVER_ERROR.into_response());
        };
        Ok(resp.into_response())
    }
}

pub fn guess_mime(path: &Path) -> HeaderValue {
    mime_guess::from_path(path)
        .first_raw()
        .map(HeaderValue::from_static)
        .unwrap_or_else(|| HeaderValue::from_str(mime::APPLICATION_OCTET_STREAM.as_ref()).unwrap())
}

#[cfg(test)]
mod serve_dir_tests {
    use http::{StatusCode, method::Method};

    use super::ServeDir;
    use crate::{
        body::Body,
        server::{Router, Server},
    };

    #[tokio::test]
    async fn read_file() {
        // volo/volo-http
        let router: Router<Option<Body>> =
            Router::new().nest_service("/static/", ServeDir::new("."));
        let server = Server::new(router).into_test_server();
        // volo/volo-http/Cargo.toml
        assert!(
            server
                .call_route(Method::GET, "/static/Cargo.toml", None)
                .await
                .status()
                .is_success()
        );
        // volo/volo-http/src/lib.rs
        assert!(
            server
                .call_route(Method::GET, "/static/src/lib.rs", None)
                .await
                .status()
                .is_success()
        );
        // volo/volo-http/Cargo.lock, this file does not exist
        assert_eq!(
            server
                .call_route(Method::GET, "/static/Cargo.lock", None)
                .await
                .status(),
            StatusCode::NOT_FOUND
        );
        // volo/Cargo.toml, this file should be rejected
        assert_eq!(
            server
                .call_route(Method::GET, "/static/../Cargo.toml", None)
                .await
                .status(),
            StatusCode::FORBIDDEN
        );
    }
}

```

### Core Architecture Module: `volo-http/src/server/utils/ws.rs`
```
//! WebSocket implementation for server.
//!
//! This module provides utilities for setting up and handling WebSocket connections, including
//! configuring WebSocket options, setting protocols and upgrading connections.
//!
//! # Example
//!
//! ```
//! use std::convert::Infallible;
//!
//! use futures_util::{sink::SinkExt, stream::StreamExt};
//! use volo_http::{
//!     response::Response,
//!     server::{
//!         route::{Router, get},
//!         utils::ws::{Message, WebSocket, WebSocketUpgrade},
//!     },
//! };
//!
//! async fn handle_socket(mut socket: WebSocket) {
//!     while let Some(Ok(msg)) = socket.next().await {
//!         match msg {
//!             Message::Text(_) => {
//!                 socket.send(msg).await.unwrap();
//!             }
//!             _ => {}
//!         }
//!     }
//! }
//!
//! async fn ws_handler(ws: WebSocketUpgrade) -> Response {
//!     ws.on_upgrade(handle_socket)
//! }
//!
//! let app: Router = Router::new().route("/ws", get(ws_handler));
//! ```
//!
//! See [`WebSocketUpgrade`] and [`WebSocket`] for more details.

use std::{
    borrow::Cow,
    error::Error,
    fmt,
    future::Future,
    ops::{Deref, DerefMut},
};

use ahash::AHashSet;
use http::{
    header,
    header::{HeaderMap, HeaderName, HeaderValue},
    method::Method,
    request::Parts,
    status::StatusCode,
    version::Version,
};
use hyper_util::rt::TokioIo;
use tokio_tungstenite::WebSocketStream;
pub use tungstenite::Message;
use tungstenite::{
    handshake::derive_accept_key,
    protocol::{self, WebSocketConfig},
};

use crate::{
    body::Body,
    context::ServerContext,
    response::Response,
    server::{IntoResponse, extract::FromContext},
};

const HEADERVALUE_UPGRADE: HeaderValue = HeaderValue::from_static("upgrade");
const HEADERVALUE_WEBSOCKET: HeaderValue = HeaderValue::from_static("websocket");

/// Handle request for establishing WebSocket connection.
///
/// [`WebSocketUpgrade`] can be passed as an argument to a handler, which will be called if the
/// http connection making the request can be upgraded to a websocket connection.
///
/// [`WebSocketUpgrade`] must be used with [`WebSocketUpgrade::on_upgrade`] and a websocket
/// handler, [`WebSocketUpgrade::on_upgrade`] will return a [`Response`] for the client and
/// the connection will then be upgraded later.
///
/// # Example
///
/// ```
/// use volo_http::{response::Response, server::utils::ws::WebSocketUpgrade};
///
/// fn ws_handler(ws: WebSocketUpgrade) -> Response {
///     ws.on_upgrade(|socket| async { todo!() })
/// }
/// ```
#[must_use]
pub struct WebSocketUpgrade<F = DefaultOnFailedUpgrade> {
    config: WebSocketConfig,
    protocol: Option<HeaderValue>,
    sec_websocket_key: HeaderValue,
    sec_websocket_protocol: Option<HeaderValue>,
    on_upgrade: hyper::upgrade::OnUpgrade,
    on_failed_upgrade: F,
}

impl<F> WebSocketUpgrade<F> {
    /// The target minimum size of the write buffer to reach before writing the data to the
    /// underlying stream.
    ///
    /// The default value is 128 KiB.
    ///
    /// If set to `0` each message will be eagerly written to the underlying stream. It is often
    /// more optimal to allow them to buffer a little, hence the default value.
    ///
    /// Note: [`flush`] will always fully write the buffer regardless.
    ///
    /// [`flush`]: futures_util::sink::SinkExt::flush
    pub fn write_buffer_size(mut self, size: usize) -> Self {
        self.config.write_buffer_size = size;
        self
    }

    /// The max size of the write buffer in bytes. Setting this can provide backpressure
    /// in the case the write buffer is filling up due to write errors.
    ///
    /// The default value is unlimited.
    ///
    /// Note: The write buffer only builds up past [`write_buffer_size`](Self::write_buffer_size)
    /// when writes to the underlying stream are failing. So the **write buffer can not
    /// fill up if you are not observing write errors even if not flushing**.
    ///
    /// Note: Should always be at least [`write_buffer_size + 1 message`](Self::write_buffer_size)
    /// and probably a little more depending on error handling strategy.
    pub fn max_write_buffer_size(mut self, max: usize) -> Self {
        self.config.max_write_buffer_size = max;
        self
    }

    /// The maximum size of an incoming message.
    ///
    /// `None` means no size limit.
    ///
    /// The default value is 64 MiB, which should be reasonably big for all normal use-cases but
    /// small enough to prevent memory eating by a malicious user.
    pub fn max_message_size(mut self, max: Option<usize>) -> Self {
        self.config.max_message_size = max;
        self
    }

    /// The maximum size of a single incoming message frame.
    ///
    /// `None` means no size limit.
    ///
    /// The limit is for frame payload NOT including the frame header.
    ///
    /// The default value is 16 MiB, which should be reasonably big for all normal use-cases but
    /// small enough to prevent memory eating by a malicious user.
    pub fn max_frame_size(mut self, max: Option<usize>) -> Self {
        self.config.max_frame_size = max;
        self
    }

    /// If server to accept unmasked frames.
    ///
    /// When set to `true`, the server will accept and handle unmasked frames from the client.
    ///
    /// According to the RFC 6455, the server must close the connection to the client in such
    /// cases, however it seems like there are some popular libraries that are sending unmasked
    /// frames, ignoring the RFC.
    ///
    /// By default this option is set to `false`, i.e. according to RFC 6455.
    pub fn accept_unmasked_frames(mut self, accept: bool) -> Self {
        self.config.accept_unmasked_frames = accept;
        self
    }

    fn get_protocol<I>(&mut self, protocols: I) -> Option<HeaderValue>
    where
        I: IntoIterator,
        I::Item: Into<Cow<'static, str>>,
    {
        let req_protocols = self
            .sec_websocket_protocol
            .as_ref()?
            .to_str()
            .ok()?
            .split(',')
            .map(str::trim)
            .collect::<AHashSet<_>>();
        for protocol in protocols.into_iter().map(Into::into) {
            if req_protocols.contains(protocol.as_ref()) {
                let protocol = match protocol {
                    Cow::Owned(s) => HeaderValue::from_str(&s).ok()?,
                    Cow::Borrowed(s) => HeaderValue::from_static(s),
                };
                return Some(protocol);
            }
        }

        None
    }

    /// Set available protocols for [`Sec-WebSocket-Protocol`][mdn].
    ///
    /// If the protocol in [`Sec-WebSocket-Protocol`][mdn] matches any protocol, the upgrade
    /// response will insert [`Sec-WebSocket-Protocol`][mdn] and [`WebSocket`] will contain the
    /// protocol name.
    ///
    /// Note that if the client offers multiple protocols that the server supports, the server will
    /// pick the first one in the list.
    ///
    /// [mdn]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-WebSocket-Protocol
    pub fn protocols<I>(mut self, protocols: I) -> Self
    where
        I: IntoIterator,
        I::Item: Into<Cow<'static, str>>,
    {
        self.protocol = self.get_protocol(protocols);
        self
    }

    /// Provide a callback to call if upgrading the connection fails.
    ///
    /// The connection upgrade is performed in a background task. If that fails this callback will
    /// be called.
    ///
    /// By default, any errors will be silently ignored.
    ///
    /// # Example
    ///
    /// ```
    /// use volo_http::{
    ///     response::Response,
    ///     server::{
    ///         route::{Router, get},
    ///         utils::ws::{WebSocket, WebSocketUpgrade},
    ///     },
    /// };
    ///
    /// async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ///     ws.on_failed_upgrade(|err| eprintln!("Failed to upgrade connection, err: {err}"))
    ///         .on_upgrade(|socket| async { todo!() })
    /// }
    ///
    /// let router: Router = Router::new().route("/ws", get(ws_handler));
    /// ```
    pub fn on_failed_upgrade<F2>(self, callback: F2) -> WebSocketUpgrade<F2>
    where
        F2: OnFailedUpgrade,
    {
        WebSocketUpgrade {
            config: self.config,
            protocol: self.protocol,
            sec_websocket_key: self.sec_websocket_key,
            sec_websocket_protocol: self.sec_websocket_protocol,
            on_upgrade: self.on_upgrade,
            on_failed_upgrade: callback,
        }
    }

    /// Finalize upgrading the connection and call the provided callback
    ///
    /// If request protocol is matched, it will use `callback` to handle the connection stream
    /// data.
    ///
    /// The callback function should be an async function with [`WebSocket`] as parameter.
    ///
    /// # Example
    ///
    /// ```
    /// use futures_util::{sink::SinkExt, stream::StreamExt};
    /// use volo_http::{
    ///     response::Response,
    ///     server::{
    ///         route::{Router, get},
    ///         utils::ws::{WebSocket, WebSocketUpgrade},
    ///     },
    /// };
    ///
    /// async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ///     ws.on_upgrade(|mut socket| async move {
    ///         while let Some(Ok(msg)) = socket.next().await {
    ///             if msg.is_ping() || msg.is_pong() {
    ///                 continue;
    ///             }
    ///             if socket.send(msg).await.is_err() {
    ///                 break;
    ///             }
    ///         }
    ///     })
    /// }
    ///
    /// let router: Router = Router::new().route("/ws", get(ws_handler));
    /// ```
    pub fn on_upgrade<C, Fut>(self, callback: C) -> Response
    where
        C: FnOnce(WebSocket) -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
        F: OnFailedUpgrade + Send + 'static,
    {
        let protocol = sel
```

### Core Architecture Module: `volo-http/src/utils/consts.rs`
```
//! Constants of HTTP(S) protocol.

use http::header::HeaderValue;

/// Default port of HTTP server.
pub const HTTP_DEFAULT_PORT: u16 = 80;
/// Default port of HTTPS server.
pub const HTTPS_DEFAULT_PORT: u16 = 443;

/// `application/json`
pub const APPLICATION_JSON: HeaderValue = HeaderValue::from_static("application/json");
/// `application/x-www-form-urlencoded`
pub const APPLICATION_WWW_FORM_URLENCODED: HeaderValue =
    HeaderValue::from_static("application/x-www-form-urlencoded");

```

### Core Architecture Module: `volo-http/src/utils/cookie/jar.rs`
```
//! Cookie utilities of Volo-HTTP.
//!
//! [`CookieJar`] currently only supports the server side.

use std::{convert::Infallible, ops::Deref};

use cookie::Cookie;
use http::{HeaderMap, header, request::Parts};

use crate::context::ServerContext;
#[cfg(feature = "server")]
use crate::server::extract::FromContext;

/// A cooke jar that can be extracted from a handler.
pub struct CookieJar {
    inner: cookie::CookieJar,
}

impl CookieJar {
    /// Create a [`CookieJar`] from given [`HeaderMap`]
    pub fn from_header(headers: &HeaderMap) -> Self {
        let mut jar = cookie::CookieJar::new();
        for cookie in headers
            .get_all(header::COOKIE)
            .into_iter()
            .filter_map(|val| val.to_str().ok())
            .flat_map(|val| val.split(';'))
            .filter_map(|cookie| Cookie::parse_encoded(cookie.to_owned()).ok())
        {
            jar.add_original(cookie);
        }

        Self { inner: jar }
    }
}

impl Deref for CookieJar {
    type Target = cookie::CookieJar;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

#[cfg(feature = "server")]
impl FromContext for CookieJar {
    type Rejection = Infallible;

    async fn from_context(
        _cx: &mut ServerContext,
        parts: &mut Parts,
    ) -> Result<Self, Self::Rejection> {
        Ok(Self::from_header(&parts.headers))
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #674** (2026-09-28): **fix(volo-thrift): create spans before constructing futures**
  *Symptoms*: ## Motivation  The ping-pong server can perform avoidable large memory copies while constructing the future for each decoded request. This becomes expensive when the concrete service/middleware stack produces a large future and the span hook remains a potentially unwinding call after optimization.  The relevant code is in `volo-thrift/src/transport/pingpong/server.rs`:  ```rust // Before, simplified: tracing_cx was obtained through an unsafe transmute. let result = async {     // Handle the request, await the service, and encode the response. } .instrument(span_provider.on_serve(tracing_cx)) .await; ```  ### How the copies arise  1. The method-call receiver is evaluated before its argument. Therefore, the `async { ... }` future is constructed before `on_serve(...)` is called. Its captured values are already part of that future, even though its body has not been polled yet. See the Rust Reference on [operand evaluation order](https://doc.rust-lang.org/reference/expressions.html#evaluation-order-of-operands) and [async blocks](https://doc.rust-lang.org/reference/expressions/block-expr.html#async-blocks). 2. The request future needs storage for the states it can enter later, including the service future held across `service.call(...).await`. A large nested service future can consequently make the enclosing request future large, even though those later states are not active during construction. 3. If `on_serve` unwinds, the already-constructed temporary request future must be dro
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/674?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 56.91%. Comparing base ([`90aa52b`](https://app.codecov.io/gh/cloudwego/volo/commit/90aa52b0449dc2ec27c5cdfd3d36c5c459a8142b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`f5465e8`](https://app.codecov.io/gh/cloudwego/volo/commit/f5465e85372ec9d64ee9955c8718015cf70de6e7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main     #674      +/-   ## =======================

- **Issue #671** (2026-09-30): **fix(volo-build): gate multiservice binary codec behind unsafe-codec**
  *Symptoms*: ## Summary  - The raw-bytes service impl generated by volo-build for Router-based multi-service servers unconditionally decoded requests with `TBinaryUnsafeInputProtocol`, whose read primitives use `get_unchecked` without bounds checks. - A truncated/malformed thrift binary frame from any unauthenticated peer could trigger an out-of-bounds heap read (debug: abort; release: silent OOB), bypassing the `unsafe-codec` feature that guards the single-service codec in `codec/default/thrift.rs`. - Move encode/decode into new `volo_thrift::codec::default::multiservice` helpers that use the safe `TBinaryProtocol` by default and the unsafe variants only behind `unsafe-codec`; the compact path is unchanged.  ## Test plan  - [x] `cargo check -p volo-thrift` with default features and `--features unsafe-codec` - [x] `cargo check --workspace --offline` - [x] New regression test `thrift_multi_service_malformed`: truncated framed binary frame against a Router server; the default safe codec survives (debug + release) and a subsequent normal request succeeds - [x] Same binary built with `--features volo-thrift/unsafe-codec` aborts at pilota `binary_unsafe.rs` precondition, confirming the test hits the fix point - [x] Existing `thrift_multi_service` tests pass; fmt + clippy clean
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/671?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `83.33333%` with `7 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 61.68%. Comparing base ([`3eb5348`](https://app.codecov.io/gh/cloudwego/volo/commit/3eb534822f2f0a03835e75090395385716392614?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`8949fa1`](https://app.codecov.io/gh/cloudwego/volo/commit/8949fa103f57114d656de41197615a740c840bd6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/671?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=

- **Issue #666** (2026-08-18): **chore(volo-http): release 0.5.6**
  *Symptoms*: <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/666?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 54.11%. Comparing base ([`9bb5ffd`](https://app.codecov.io/gh/cloudwego/volo/commit/9bb5ffd4ab1dc2da8c907bd6bb650c3f27059af5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`a268a47`](https://app.codecov.io/gh/cloudwego/volo/commit/a268a476ee9c6c245569c56572ad13bc22c4174a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main     #666   +/-   ## =============================

- **Issue #664** (2026-08-13): **fix(volo-build): use parentheses for format! macros**
  *Symptoms*: <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/664?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `99.43503%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 50.23%. Comparing base ([`43dd124`](https://app.codecov.io/gh/cloudwego/volo/commit/43dd1243d1ad4df30f08c7e694def48339ef0242?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`c0e9ecd`](https://app.codecov.io/gh/cloudwego/volo/commit/c0e9ecd2846c198099ef88c0385d91d766db70d1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/664?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=c

- **Issue #663** (2026-08-17): **fix(volo-http): return reusable HTTP/1 connections from the driver**
  *Symptoms*: Move the HTTP/1 sender between the pool, request future, and connection driver through a return channel. Reinsert the connection only after Hyper reports it ready, while preserving cancellation safety and the existing response body fast path.  <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/663?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `97.61337%` with `10 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 51.21%. Comparing base ([`faf5d99`](https://app.codecov.io/gh/cloudwego/volo/commit/faf5d990bb0d93252c3e188e20192e668076fe04?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`7d5b1fc`](https://app.codecov.io/gh/cloudwego/volo/commit/7d5b1fc7e88d8151506b044986c1796e84db6cb7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/663?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

- **Issue #661** (2026-08-18): **fix(volo-http): wait for HTTP/1 readiness to enable connection reuse**
  *Symptoms*: <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/661?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `38.88889%` with `11 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 46.92%. Comparing base ([`43dd124`](https://app.codecov.io/gh/cloudwego/volo/commit/43dd1243d1ad4df30f08c7e694def48339ef0242?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`6c39115`](https://app.codecov.io/gh/cloudwego/volo/commit/6c39115de8edf43243e654b6822170548e8f3554?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/661?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

- **Issue #660** (2026-07-30): **perf(volo-thrift): reset encode buffer right after flush**
  *Symptoms*: Document why LinkedBytes is reset in two places in DefaultEncoder::encode: - On entry: guarantees a clean buffer even when the previous encode on a (possibly multiplexed, cross-request reused) encoder returned early before the post-write reset (e.g. via `size(..)?`), leaving stale nodes. - After flush: drops the zero-copy Bytes/FastStr references inserted for large fields as soon as the write completes, so their memory is released without waiting for the next request on this connection.  <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation  <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/660?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `74.82993%` with `37 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 46.93%. Comparing base ([`ce5c0b6`](https://app.codecov.io/gh/cloudwego/volo/commit/ce5c0b66b6726ea6db902d2bc51b67d89f82b94f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`368c071`](https://app.codecov.io/gh/cloudwego/volo/commit/368c071373faacd861df6265cfd9cfc9401ad687?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/660?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

- **Issue #659** (2026-07-17): **feat(volo-build): add option to preserve idl field names**
  *Symptoms*: <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation See https://github.com/cloudwego/pilota/pull/366 <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution Adds an opt-in `preserve_idl_field_names` option that keeps the original IDL spelling. The option is off by default.  <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cloudwego/volo/pull/659?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego) Report :x: Patch coverage is `80.58824%` with `33 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 46.55%. Comparing base ([`ce5c0b6`](https://app.codecov.io/gh/cloudwego/volo/commit/ce5c0b66b6726ea6db902d2bc51b67d89f82b94f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)) to head ([`0777df4`](https://app.codecov.io/gh/cloudwego/volo/commit/0777df464bdcd1d4298377c51373502797b31fbb?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cloudwego)).  | [Files with missing lines](https://app.codecov.io/gh/cloudwego/volo/pull/659?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

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

### Incident Patch 1: `58cfc6b4` (2026-09-30)
**Commit Message**: fix(volo-build): gate multiservice binary codec behind unsafe-codec (#671)

The raw-bytes service impl generated by volo-build for Router-based
multi-service servers unconditionally decoded requests with
TBinaryUnsafeInputProtocol, whose read primitives use get_unchecked
without bounds checks. A truncated binary frame from any peer could
trigger an out-of-bounds heap read (debug: abort; release: silent OOB),
bypassing the unsafe-codec feature that guards the single-service path.

Move encode/decode into volo-thrift helpers that select the safe
TBinaryProtocol by default and the unsafe variants only when the
unsafe-codec feature is enabled, matching the hand-written codec. Add a
regression test that sends a truncated frame and verifies the server
survives and keeps serving.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4394,6 +4394,7 @@ dependencies = [
  "tracing",
  "tracing-subscriber",
  "volo",
+ "volo-gen",
 ]
 
 [[package]]
```

**File**: `volo-build/src/thrift_backend.rs` (modified, +10/-56)
```diff
@@ -695,9 +695,7 @@ impl pilota_build::CodegenBackend for VoloThriftBackend {
                 type Error = ::volo_thrift::ServerError;
 
                 async fn call<'s, 'cx>(&'s self, cx: &'cx mut ::volo_thrift::context::ServerContext, payload: ::volo_thrift::Bytes) -> ::std::result::Result<Self::Response, Self::Error> {{
-                    use ::pilota::{{Buf, BufMut}};
                     use ::volo::context::Context;
-                    use ::pilota::thrift::{{TInputProtocol, TLengthProtocol, TOutputProtocol}};
 
                     // Reconstruct TMessageIdentifier from context (zero-copy, message header already parsed)
                     let msg_ident = ::pilota::thrift::TMessageIdentifier::new(
@@ -706,67 +704,23 @@ impl pilota_build::CodegenBackend for VoloThriftBackend {
                         cx.seq_id.unwrap_or(0),
                     );
 
-                    // Check protocol from context extensions (set by ThriftCodec during decode)
+                    // Protocol detected by ThriftCodec and recorded in context extensions.
                     let use_compact = cx.extensions().contains::<::volo_thrift::ProtocolApacheCompact>();
 
-                    // Decode the payload using the detected protocol
                     let mut payload = payload;
-                    let req = if use_compact {{
-                        let mut protocol = ::pilota::thrift::compact::TCompactInputProtocol::new(&mut payload);
-                        <{req_recv_name} as ::volo_thrift::EntryMessage>::decode(&mut protocol, &msg_ident)?
-                    }} else {{
-                        // Use unsafe binary protocol for better performance
-                        let mut protocol = unsafe {{
-                            ::pilota::thrift::binary_unsafe::TBinaryUnsafeInputProtocol::new(&mut payload)
-                        }};
-                        let req = <{req_recv_name} as ::volo_thrift::EntryMessage>::decode(&mut protocol, &msg_ident)?;
-                        let index = protocol.index();
-                        protocol.buf().advance(index);
-                        req
-                    }};
+                    let req = ::volo_thrift::codec::default::multiservice::decode_entry::<{req_recv_name}>(
+                        &mut payload,
+                        &msg_ident,
+                        use_compact,
+                    )?;
 
                     // Call the typed service
                     let resp = <Self as ::volo::service::Service<_, {req_recv_name}>>::call(self, cx, req).await?;
 
-                    // Encode the response using the same protocol with LinkedBytes for better performance
-                    let mut linked_bytes = ::volo_thrift::LinkedBytes::new();
-                    if use_compact {{
-                        let mut size_protocol = ::pilota::thrift::compact::TCompactOutputProtocol::new((), true);
-                        let real_size = <{res_send_name} as ::volo_thrift::EntryMessage>::size(&resp, &mut size_protocol);
-                        let malloc_size = real_size - size_protocol.zero_copy_len();
-                        linked_bytes.reserve(malloc_size);
-                        let mut protocol = ::pilota::thrift::compact::TCompactOutputProtocol::new(&mut linked_bytes, true);
-                        <{res_send_name} as ::volo_thrift::EntryMessage>::encode(&resp, &mut protocol)?;
-                    }} else {{
-                        // Calculate size first
-                        let mut size_protocol = ::pilota::thrift::binary::TBinaryProtocol::new((), true);
-                        let real_size = <{res_send_name} as ::volo_thrift::EntryMessage>::size(&resp, &mut size_protocol);
-                        let malloc_size = real_size - size_protocol.zero_copy_len();
-                        linked_bytes.reserve(malloc_size);
-
-                        // Use unsafe binary protocol for encoding
-                        let buf = unsafe {{
-                            let l = linked_bytes.bytes_mut().len();
-                            ::std::slice::from_raw_parts_mut(
-                                linked_bytes.bytes_mut().as_mut_ptr().add(l),
-                                linked_bytes.bytes_mut().capacity() - l,
-                            )
-                        }};
-                        let mut protocol = unsafe {{
-                            ::pilota::thrift::binary_unsafe::TBinaryUnsafeOutputProtocol::new(
-                                &mut linked_bytes,
-                                buf,
-                                true,
-                            )
-                        }};
-                        <{res_send_name} as ::volo_thrift::EntryMessage>::encode(&resp, &mut protocol)?;
-                        let index = protocol.index();
-                        unsafe {{
-                            protocol.buf_mut().bytes_mut().advance_mut(index);
-                        }}
-                    }};
-
-
```

**File**: `volo-thrift/Cargo.toml` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ tracing.workspace = true
 
 [dev-dependencies]
 tracing-subscriber.workspace = true
+volo-gen = { path = "../examples/volo-gen" }
 
 [features]
 default = []
```

**File**: `volo-thrift/src/codec/default/mod.rs` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ use super::{Decoder, Encoder, MakeCodec};
 use crate::{EntryMessage, ThriftMessage, context::ThriftContext};
 
 pub mod framed;
+pub mod multiservice;
 pub mod thrift;
 pub mod ttheader;
 
```

**File**: `volo-thrift/src/codec/default/multiservice.rs` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+//! Encode/decode helpers for the raw-bytes service implementations generated by
+//! volo-build when a service is served through [`crate::server::Router`].
+//!
+//! The generated code must not construct the unsafe protocols itself: whether the
+//! unchecked binary codec is used is decided here by volo-thrift's own
+//! `unsafe-codec` feature, which is off by default.
+
+use bytes::Bytes;
+use linkedbytes::LinkedBytes;
+use pilota::thrift::{
+    TLengthProtocol, TMessageIdentifier, ThriftException,
+    binary::TBinaryProtocol,
+    compact::{TCompactInputProtocol, TCompactOutputProtocol},
+};
+
+use crate::EntryMessage;
+
+pub fn decode_entry<Msg: EntryMessage>(
+    payload: &mut Bytes,
+    msg_ident: &TMessageIdentifier,
+    use_compact: bool,
+) -> Result<Msg, ThriftException> {
+    if use_compact {
+        let mut protocol = TCompactInputProtocol::new(payload);
+        return Msg::decode(&mut protocol, msg_ident);
+    }
+    decode_binary(payload, msg_ident)
+}
+
+#[cfg(not(feature = "unsafe-codec"))]
+fn decode_binary<Msg: EntryMessage>(
+    payload: &mut Bytes,
+    msg_ident: &TMessageIdentifier,
+) -> Result<Msg, ThriftException> {
+    let mut protocol = TBinaryProtocol::new(payload, true);
+    Msg::decode(&mut protocol, msg_ident)
+}
+
+#[cfg(feature = "unsafe-codec")]
+fn decode_binary<Msg: EntryMessage>(
+    payload: &mut Bytes,
+    msg_ident: &TMessageIdentifier,
+) -> Result<Msg, ThriftException> {
+    let mut protocol =
+        unsafe { pilota::thrift::binary_unsafe::TBinaryUnsafeInputProtocol::new(payload) };
+    Msg::decode(&mut protocol, msg_ident)
+}
+
+pub fn encode_entry<Msg: EntryMessage>(
+    msg: &Msg,
+    use_compact: bool,
+) -> Result<Bytes, ThriftException> {
+    let mut linked_bytes = LinkedBytes::new();
+    if use_compact {
+        let mut size_protocol = TCompactOutputProtocol::new((), true);
+        let real_size = Msg::size(msg, &mut size_protocol);
+        linked_bytes.reserve(real_size - size_protocol.zero_copy_len());
+        let mut protocol = TCompactOutputProtocol::new(&mut linked_bytes, true);
+        Msg::encode(msg, &mut protocol)?;
+    } else {
+        encode_binary(msg, &mut linked_bytes)?;
+    }
+    Ok(linked_bytes.into_bytes_mut().freeze())
+}
+
+#[cfg(not(feature = "unsafe-codec"))]
+fn encode_binary<Msg: EntryMessage>(
+    msg: &Msg,
+    linked_bytes: &mut LinkedBytes,
+) -> Result<(), ThriftException> {
+    let mut size_protocol = TBinaryProtocol::new((), true);
+    let real_size = Msg::size(msg, &mut size_protocol);
+    linked_bytes.reserve(real_size - size_protocol.zero_copy_len());
+    let mut protocol = TBinaryProtocol::new(linked_bytes, true);
+    Msg::encode(msg, &mut protocol)
+}
+
+#[cfg(feature = "unsafe-codec")]
+fn encode_binary<Msg: EntryMessage>(
+    msg: &Msg,
+    linked_bytes: &mut LinkedBytes,
+) -> Result<(), ThriftException> {
+    use bytes::BufMut;
+    use pilota::thrift::TOutputProtocol;
+
+    let mut size_protocol = TBinaryProtocol::new((), true);
+    let real_size = Msg::size(msg, &mut size_protocol);
+    linked_bytes.reserve(real_size - size_protocol.zero_copy_len());
+
+    let buf = unsafe {
+        let l = linked_bytes.bytes_mut().len();
+        std::slice::from_raw_parts_mut(
+            linked_bytes.bytes_mut().as_mut_ptr().add(l),
+            linked_bytes.bytes_mut().capacity() - l,
+        )
+    };
+    let mut protocol = unsafe {
+        pilota::thrift::binary_unsafe::TBinaryUnsafeOutputProtocol::new(linked_bytes, buf, true)
+    };
+    Msg::encode(msg, &mut protocol)?;
+    let index = protocol.index();
+    unsafe {
+        protocol.buf_mut().bytes_mut().advance_mut(index);
+    }
+    Ok(())
+}
```

**File**: `volo-thrift/tests/thrift_multi_service_malformed.rs` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+//! Security regression test: a malformed/truncated thrift binary frame sent to a
+//! multi-service Router server must not abort the process (OOB read); the default
+//! safe codec returns a protocol error and the server keeps serving.
+
+// Keep this test in volo-thrift so the gate follows the runtime's actual feature
+// selection, including features enabled through other workspace dependencies.
+#![cfg(not(feature = "unsafe-codec"))]
+
+use std::{net::SocketAddr, time::Duration};
+
+use tokio::{
+    io::{AsyncReadExt, AsyncWriteExt},
+    net::TcpStream,
+    sync::oneshot,
+};
+use volo_thrift::server::{Router, Server};
+
+#[derive(Clone)]
+struct HelloServiceImpl;
+
+impl volo_gen::thrift_gen::hello::HelloService for HelloServiceImpl {
+    async fn hello(
+        &self,
+        req: volo_gen::thrift_gen::hello::HelloRequest,
+    ) -> Result<volo_gen::thrift_gen::hello::HelloResponse, volo_thrift::ServerError> {
+        Ok(volo_gen::thrift_gen::hello::HelloResponse {
+            message: format!("Hello, {}!", req.name).into(),
+            _field_mask: None,
+        })
+    }
+}
+
+fn malformed_frame() -> Vec<u8> {
+    // strict binary message: name "Hello", type Call(1), seqid 1
+    let name = b"Hello";
+    let mut inner = Vec::new();
+    inner.extend_from_slice(&0x80010001u32.to_be_bytes()); // strict | CALL
+    inner.extend_from_slice(&(name.len() as i32).to_be_bytes());
+    inner.extend_from_slice(name);
+    inner.extend_from_slice(&1i32.to_be_bytes()); // seqid
+    // args struct: field type I64 (10), field id 1, then only 3 of 8 value bytes
+    inner.push(0x0a);
+    inner.extend_from_slice(&1i16.to_be_bytes());
+    inner.extend_from_slice(&[0u8; 3]); // truncated i64 -> OOB read in unsafe decoder
+
+    let mut frame = (inner.len() as i32).to_be_bytes().to_vec();
+    frame.extend_from_slice(&inner);
+    frame
+}
+
+#[tokio::test]
+async fn malformed_frame_does_not_abort_router_server() {
+    let (tx, rx) = oneshot::channel::<()>();
+    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let port = listener.local_addr().unwrap().port();
+    drop(listener);
+    tokio::time::sleep(Duration::from_millis(10)).await;
+
+    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
+    let addr = volo::net::Address::from(addr);
+
+    let hello_service =
+        volo_gen::thrift_gen::hello::HelloServiceServer::from_handler(HelloServiceImpl);
+    let router = Router::new().with_default_service(hello_service);
+
+    tokio::spawn(async move {
+        let server = Server::with_router(router);
+        tokio::select! {
+            r = server.run(addr) => { let _ = r; }
+            _ = rx => {}
+        }
+    });
+    tokio::time::sleep(Duration::from_millis(150)).await;
+
+    // 1. send malformed frame: server must answer with an exception frame or close, but the process
+    //    must stay alive
+    let mut sock = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
+    sock.write_all(&malformed_frame()).await.unwrap();
+    let mut buf = vec![0u8; 64];
+    // either an exception reply, an EOF, or just silence: all are fine as long
+    // as the process keeps running
+    let _ = tokio::time::timeout(Duration::from_secs(2), sock.read(&mut buf)).await;
+    drop(sock);
+
+    // 2. the server process is still alive: a normal request through the generated client must
+    //    succeed
+    let saddr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
+    let client = volo_gen::thrift_gen::hello::HelloServiceClientBuilder::new("hello")
+        .address(saddr)
+        .build();
+    let resp = client
+        .hello(volo_gen::thrift_gen::hello::HelloRequest {
+            name: "World".into(),
+            hello: None,
+            _field_mask: None,
+        })
+        .await
+        .expect("server must still serve after malformed frame");
+    assert_eq!(resp.message.as_str(), "Hello, World!");
+
+    let _ = tx.send(());
+}
```

---

### Incident Patch 2: `3eb53482` (2026-09-28)
**Commit Message**: fix(volo-thrift): create spans before constructing futures (#674)

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4392,6 +4392,7 @@ dependencies = [
  "thiserror 2.0.17",
  "tokio",
  "tracing",
+ "tracing-subscriber",
  "volo",
 ]
 
```

**File**: `volo-thrift/Cargo.toml` (modified, +3/-0)
```diff
@@ -49,6 +49,9 @@ tokio = { workspace = true, features = [
 ] }
 tracing.workspace = true
 
+[dev-dependencies]
+tracing-subscriber.workspace = true
+
 [features]
 default = []
 # multiplex is unstable and we don't provide backward compatibility
```

**File**: `volo-thrift/src/transport/pingpong/server.rs` (modified, +9/-9)
```diff
@@ -74,13 +74,9 @@ pub async fn serve<Svc, Req, Resp, E, D, SP>(
                 #[cfg(feature = "shmipc")]
                 helper.release_read_and_reuse();
 
-                // it is promised safe here, because span only reads cx before handling polling
-                let tracing_cx = unsafe {
-                    std::mem::transmute::<
-                        &crate::context::ServerContext,
-                        &crate::context::ServerContext,
-                    >(&cx)
-                };
+                // Create the span before constructing the future. Keeping a large future live
+                // across on_serve's unwind edge can prevent the compiler from eliminating copies.
+                let serve_span = span_provider.on_serve(&cx);
 
                 let result = async {
                     match msg {
@@ -105,12 +101,13 @@ pub async fn serve<Svc, Req, Resp, E, D, SP>(
                                     &cx,
                                     resp.map_err(server_error_to_application_exception),
                                 );
+                                let encode_span = span_provider.on_encode(&cx);
                                 if let Err(e) = async {
                                     let result = encoder.encode(&mut cx, msg).await;
                                     span_provider.leave_encode(&cx);
                                     result
                                 }
-                                .instrument(span_provider.on_encode(tracing_cx))
+                                .instrument(encode_span)
                                 .await
                                 {
                                     if should_log(&e) {
@@ -186,7 +183,7 @@ pub async fn serve<Svc, Req, Resp, E, D, SP>(
                     });
                     Ok(())
                 }
-                .instrument(span_provider.on_serve(tracing_cx))
+                .instrument(serve_span)
                 .await;
                 if result.is_err() {
                     break;
@@ -195,3 +192,6 @@ pub async fn serve<Svc, Req, Resp, E, D, SP>(
         })
         .await;
 }
+
+#[cfg(test)]
+mod tests;
```

**File**: `volo-thrift/src/transport/pingpong/server/tests.rs` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+use std::{
+    io,
+    sync::{Arc, Mutex, atomic::AtomicBool},
+};
+
+use bytes::Bytes;
+use motore::service::Service;
+use pilota::thrift::{
+    ApplicationException, ApplicationExceptionKind, TMessageIdentifier, TMessageType,
+    ThriftException, binary::TBinaryProtocol,
+};
+use tokio::sync::Notify;
+use tracing::{Span, instrument::WithSubscriber};
+use volo::context::Context;
+
+use super::serve;
+use crate::{
+    EntryMessage, MessageMeta, ServerError, ThriftMessage,
+    codec::{Decoder, Encoder},
+    context::{ServerContext, ThriftContext},
+    tracing::SpanProvider,
+};
+
+#[derive(Clone, Default)]
+struct Events(Arc<Mutex<Vec<&'static str>>>);
+
+impl Events {
+    fn push(&self, event: &'static str) {
+        self.0.lock().unwrap().push(event);
+    }
+}
+
+fn assert_span(name: &str) {
+    assert_eq!(Span::current().metadata().map(|m| m.name()), Some(name));
+}
+
+struct OneRequestDecoder(Option<TMessageType>);
+
+impl Decoder for OneRequestDecoder {
+    async fn decode<Msg: Send + EntryMessage, Cx: ThriftContext>(
+        &mut self,
+        cx: &mut Cx,
+    ) -> Result<Option<ThriftMessage<Msg>>, ThriftException> {
+        let Some(msg_type) = self.0.take() else {
+            return Ok(None);
+        };
+        let ident = TMessageIdentifier::new("trace_test".into(), msg_type, 42);
+        cx.handle_decoded_msg_ident(&ident);
+        let mut payload = Bytes::from_static(b"request");
+        let data = Msg::decode(&mut TBinaryProtocol::new(&mut payload, true), &ident)?;
+        Ok(Some(ThriftMessage {
+            data: Ok(data),
+            meta: MessageMeta {
+                msg_type,
+                method: ident.name,
+                seq_id: ident.sequence_number,
+            },
+        }))
+    }
+}
+
+struct TestService {
+    events: Events,
+    fail: bool,
+}
+
+impl Service<ServerContext, Bytes> for TestService {
+    type Response = Bytes;
+    type Error = ServerError;
+
+    async fn call(&self, cx: &mut ServerContext, req: Bytes) -> Result<Bytes, ServerError> {
+        assert_span("request");
+        assert_eq!(cx.rpc_info().method().as_str(), "trace_test");
+        assert_eq!(req, Bytes::from_static(b"request"));
+        self.events.push("service");
+        tokio::task::yield_now().await;
+        assert_span("request");
+        if self.fail {
+            Err(ServerError::Application(ApplicationException::new(
+                ApplicationExceptionKind::INTERNAL_ERROR,
+                "injected service error",
+            )))
+        } else {
+            Ok(req)
+        }
+    }
+}
+
+struct TestEncoder {
+    events: Events,
+    fail: bool,
+    response_type: TMessageType,
+}
+
+impl Encoder for TestEncoder {
+    async fn encode<Msg: Send + EntryMessage, Cx: ThriftContext>(
+        &mut self,
+        cx: &mut Cx,
+        msg: ThriftMessage<Msg>,
+    ) -> Result<(), ThriftException> {
+        assert_span("response");
+        assert_eq!(cx.msg_type(), self.response_type);
+        assert_eq!(msg.meta.msg_type, self.response_type);
+        assert_eq!(msg.meta.seq_id, 42);
+        self.events.push("encode");
+        tokio::task::yield_now().await;
+        assert_span("response");
+        if self.fail {
+            Err(io::Error::other("injected encode error").into())
+        } else {
+            Ok(())
+        }
+    }
+}
+
+#[derive(Clone)]
+struct TestSpanProvider {
+    events: Events,
+    request_type: TMessageType,
+    response_type: TMessageType,
+}
+
+impl SpanProvider for TestSpanProvider {
+    fn on_serve(&self, cx: &ServerContext) -> Span {
+        // The loop also constructs a future for EOF after the request completes.
+        if cx.req_msg_type.is_none() {
+            return Span::none();
+        }
+        assert_eq!(cx.req_msg_type, Some(self.request_type));
+        assert_eq!(cx.seq_id, Some(42));
+        assert_eq!(cx.rpc_info().method().as_str(), "trace_test");
+        assert!(cx.stats.process_start_at().is_none());
+        self.events.push("on_serve");
+        tracing::info_span!("request")
+    }
+
+    fn on_encode(&self, cx: &ServerContext) -> Span {
+        assert_span("request");
+        assert_eq!(cx.msg_type, Some(self.response_type));
+        assert!(cx.stats.process_end_at().is_some());
+        self.events.push("on_encode");
+        tracing::info_span!("response")
+    }
+
+    fn leave_encode(&self, _cx: &ServerContext) {
+        assert_span("response");
+        self.events.push("leave_encode");
+    }
+
+    fn leave_serve(&self, _cx: &ServerContext) {
+        assert_span("request");
+        self.events.push("leave_serve");
+    }
+}
+
+async fn run_request(
+    request_type: TMessageType,
+    service_error: bool,
+    encode_error: bool,
+) -> Vec<&'static str> {
+    let events = Events::default();
+    let response_type = if service_error {
+        TMessageType::Exception
+    } else {
+        TMessageType::Reply
+    };
+    let service = TestService {
+
```

---

### Incident Patch 3: `52da49dc` (2026-08-17)
**Commit Message**: fix(volo-http): return reusable HTTP/1 connections from the driver (#663)

Move the HTTP/1 sender between the pool, request future, and connection
driver through a return channel. Reinsert the connection only after
Hyper reports it ready, while preserving cancellation safety and the
existing response body fast path.

**File**: `volo-http/Cargo.toml` (modified, +27/-13)
```diff
@@ -42,6 +42,7 @@ pin-project.workspace = true
 simdutf8.workspace = true
 thiserror.workspace = true
 tokio = { workspace = true, features = [
+    "sync",
     "fs",
     "time",
     "macros",
@@ -56,14 +57,14 @@ url.workspace = true
 # =====optional=====
 
 # server optional
-ipnet = { workspace = true, optional = true } # client ip
-matchit = { workspace = true, optional = true } # route matching
-memchr = { workspace = true, optional = true } # sse
+ipnet = { workspace = true, optional = true }      # client ip
+matchit = { workspace = true, optional = true }    # route matching
+memchr = { workspace = true, optional = true }     # sse
 scopeguard = { workspace = true, optional = true } # defer
 
 # client optional
-async-broadcast = { workspace = true, optional = true } # service discover
-chrono = { workspace = true, optional = true } # stat
+async-broadcast = { workspace = true, optional = true }  # service discover
+chrono = { workspace = true, optional = true }           # stat
 hickory-resolver = { workspace = true, optional = true } # dns resolver
 mime_guess = { workspace = true, optional = true }
 
@@ -101,26 +102,39 @@ default-client = ["client", "http1", "json"]
 default-server = ["server", "http1", "query", "form", "json", "multipart"]
 
 full = [
-    "client", "server", # core
-    "http1", "http2", # protocol
-    "query", "form", "json", # serde
-    "tls", # https
-    "cookie", "multipart", "ws", # exts
+    "client",
+    "server",    # core
+    "http1",
+    "http2",     # protocol
+    "query",
+    "form",
+    "json",      # serde
+    "tls",       # https
+    "cookie",
+    "multipart",
+    "ws",        # exts
 ]
 
 http1 = ["hyper/http1", "hyper-util/http1"]
 http2 = ["hyper/http2", "hyper-util/http2"]
 
 client = [
     "hyper/client",
-    "dep:async-broadcast", "dep:chrono", "dep:hickory-resolver",
+    "dep:async-broadcast",
+    "dep:chrono",
+    "dep:hickory-resolver",
 ] # client core
 server = [
     "hyper-util/server",
-    "dep:ipnet", "dep:matchit", "dep:memchr", "dep:scopeguard", "dep:mime_guess", "dep:chrono",
+    "dep:ipnet",
+    "dep:matchit",
+    "dep:memchr",
+    "dep:scopeguard",
+    "dep:mime_guess",
+    "dep:chrono",
 ] # server core
 
-__serde = ["dep:serde"] # a private feature for enabling `serde` by `serde_xxx`
+__serde = ["dep:serde"]                           # a private feature for enabling `serde` by `serde_xxx`
 query = ["__serde", "dep:serde_urlencoded"]
 form = ["__serde", "dep:serde_urlencoded"]
 json = ["__serde", "dep:sonic-rs"]
```

**File**: `volo-http/src/client/transport/pool.rs` (modified, +59/-0)
```diff
@@ -25,6 +25,32 @@ pub struct Pool<K: Key, T> {
     inner: Arc<Mutex<PoolInner<K, T>>>,
 }
 
+#[cfg(feature = "http1")]
+impl<K: Key, T: Poolable> Pool<K, T> {
+    pub(crate) fn return_handle(&self) -> PoolReturn<K, T> {
+        PoolReturn {
+            inner: Arc::downgrade(&self.inner),
+        }
+    }
+}
+
+#[cfg(feature = "http1")]
+pub(crate) struct PoolReturn<K: Key, T: Poolable> {
+    inner: Weak<Mutex<PoolInner<K, T>>>,
+}
+
+#[cfg(feature = "http1")]
+impl<K: Key, T: Poolable> PoolReturn<K, T> {
+    pub(crate) fn put_ready(&self, key: K, value: T) -> Result<(), T> {
+        let Some(inner) = self.inner.upgrade() else {
+            return Err(value);
+        };
+
+        inner.lock().put(key, value, &inner);
+        Ok(())
+    }
+}
+
 // Before using a pooled connection, make sure the sender is not dead.
 //
 // This is a trait to allow the `client::pool::tests` to work for `i32`.
@@ -1000,4 +1026,37 @@ mod tests {
 
         assert!(!pool.locked().idle.contains_key(&key));
     }
+
+    #[tokio::test]
+    async fn return_handle_put_ready_unparks_checkout() {
+        let pool = pool_no_timer();
+        let key = host_key("foo");
+        let returner = pool.return_handle();
+        let mut checkout = pool.checkout(key.clone());
+
+        // Register the checkout as a waiter before returning the connection.
+        assert!(PollOnce(&mut checkout).await.is_none());
+
+        returner
+            .put_ready(key, Uniq(41))
+            .expect("the pool should still exist");
+
+        let pooled = checkout.await.expect("the waiter should be notified");
+        assert_eq!(*pooled, Uniq(41));
+    }
+
+    #[test]
+    fn return_handle_returns_value_after_pool_drop() {
+        let key = host_key("foo");
+        let returner = {
+            let pool = pool_no_timer::<KeyImpl, Uniq<i32>>();
+            pool.return_handle()
+        };
+
+        let value = returner
+            .put_ready(key, Uniq(41))
+            .expect_err("the weak pool reference should no longer upgrade");
+
+        assert_eq!(value, Uniq(41));
+    }
 }
```

**File**: `volo-http/src/client/transport/protocol.rs` (modified, +621/-6)
```diff
@@ -83,6 +83,10 @@ pub struct ClientTransport<B = Body> {
     pool: Pool<PoolKey, HttpConnection<B>>,
 }
 
+#[cfg(feature = "__tls")]
+type PoolKey = (Scheme, Address, Option<faststr::FastStr>);
+
+#[cfg(not(feature = "__tls"))]
 type PoolKey = (Scheme, Address);
 
 impl<B> ClientTransport<B> {
@@ -126,7 +130,7 @@ impl<B> ClientTransport<B> {
         B::Data: Send,
         B::Error: Into<BoxError> + 'static,
     {
-        let key = (peer.scheme.clone(), peer.address.clone());
+        let key = pool_key(&peer);
         let connector = self.connector.clone();
         let pool = self.pool.clone();
         #[cfg(feature = "http1")]
@@ -163,7 +167,7 @@ impl<B> ClientTransport<B> {
         B::Data: Send,
         B::Error: Into<BoxError> + 'static,
     {
-        let key = (peer.scheme.clone(), peer.address.clone());
+        let key = pool_key(&peer);
 
         let checkout = self.pool.checkout(key);
         let connect = self.connect_to(ver.into(), peer);
@@ -210,6 +214,15 @@ impl<B> ClientTransport<B> {
     }
 }
 
+fn pool_key(peer: &PeerInfo) -> PoolKey {
+    (
+        peer.scheme.clone(),
+        peer.address.clone(),
+        #[cfg(feature = "__tls")]
+        (peer.scheme == Scheme::HTTPS).then(|| peer.name.clone()),
+    )
+}
+
 async fn connect_impl<B>(
     _ver: pool::Ver,
     peer: PeerInfo,
@@ -224,6 +237,9 @@ where
     B::Data: Send,
     B::Error: Into<BoxError> + 'static,
 {
+    #[cfg(feature = "http1")]
+    let key = pool_key(&peer);
+
     let conn = match connector.make_connection(peer).await {
         Ok(conn) => conn,
         Err(err) => {
@@ -258,10 +274,28 @@ where
         #[cfg(feature = "http1")]
         {
             let (mut sender, conn) = tri!(h1_client.handshake(conn).await.map_err(connect_error));
-            tokio::spawn(conn);
-            // Wait for `conn` to ready up before we declare self sender as usable.
+
+            // This channel only returns the sender from the request future to the
+            // connection task.
+            let (return_tx, return_rx) = tokio::sync::mpsc::unbounded_channel();
+
+            // Replace `tokio::spawn(connection)` with a managed wrapper.
+            let driver = ManagedH1Connection {
+                connection: conn,
+                return_rx,
+                waiting: None,
+                returner: pool.return_handle(),
+                key,
+            };
+
+            tokio::spawn(driver);
+
+            // The connect future still owns return_tx, so return_rx cannot close
+            // before the initial readiness check completes.
             tri!(sender.ready().await.map_err(connect_error));
-            Ok(pool.pooled(connecting, HttpConnection::H1(sender)))
+
+            let lease = H1Lease::new(sender, return_tx);
+            Ok(pool.pooled(connecting, HttpConnection::H1(lease)))
         }
         #[cfg(not(feature = "http1"))]
         Err(crate::error::client::bad_version())
@@ -337,9 +371,227 @@ where
     }
 }
 
+#[cfg(feature = "http1")]
+struct H1Returned<B> {
+    http_sender: conn::http1::SendRequest<B>,
+    return_tx: tokio::sync::mpsc::UnboundedSender<H1Returned<B>>,
+}
+
+#[cfg(feature = "http1")]
+struct H1Lease<B> {
+    returned: Option<H1Returned<B>>,
+}
+
+#[cfg(feature = "http1")]
+struct H1ReturnGuard<B> {
+    returned: Option<H1Returned<B>>,
+}
+
+#[cfg(feature = "http1")]
+impl<B> H1ReturnGuard<B> {
+    fn http_sender_mut(&mut self) -> &mut conn::http1::SendRequest<B> {
+        &mut self
+            .returned
+            .as_mut()
+            .expect("HTTP/1 sender already returned")
+            .http_sender
+    }
+
+    fn return_to_driver(&mut self) {
+        let Some(returned) = self.returned.take() else {
+            return;
+        };
+
+        // The original tx must keep moving with the message. Use a temporary
+        // clone to perform this send.
+        let tx = returned.return_tx.clone();
+        if let Err(_err) = tx.send(returned) {
+            // The receiver is gone, so the driver for this physical connection
+            // has already stopped. There is no receiver to retry, and a sender
+            // whose readiness is unknown must not be returned directly to the
+            // pool. Dropping SendError also drops the sender and return_tx,
+            // explicitly giving up reuse of this connection.
+            tracing::trace!("HTTP/1 connection driver already closed");
+        };
+    }
+}
+
+#[cfg(feature = "http1")]
+impl<B> Drop for H1ReturnGuard<B> {
+    fn drop(&mut self) {
+        // Cancellation of the send_request future uses the same return path.
+        self.return_to_driver();
+    }
+}
+
+#[cfg(feature = "http1")]
+impl<B> H1Lease<B> {
+    fn new(
+        http_sender: conn::http1::SendRequest<B>,
+        return_tx: tokio::sync::mpsc::UnboundedSender<H1Returned<B>>,
+    ) -> Self {
+        Self {
+            returned: Some(H1Returned {
+                http_sender,
+                return_tx,
+            }
```

---

### Incident Patch 4: `faf5d990` (2026-08-13)
**Commit Message**: fix(volo-build): use parentheses for format! macros (#664)

**File**: `volo-build/src/grpc_backend.rs` (modified, +175/-28)
```diff
@@ -181,12 +181,12 @@ impl VoloGrpcBackend {
         );
 
         if streaming {
-            format! {
+            format!(
                 r#"{resp_stream}
                 ::std::result::Result::Ok(::volo_grpc::Response::from_parts(metadata, extensions, message_stream))"#
-            }
+            )
         } else {
-            format! {
+            format!(
                 r#"{resp_stream}
                 let message = ::volo_grpc::codegen::StreamExt::try_next(&mut message_stream)
                     .await
@@ -199,7 +199,7 @@ impl VoloGrpcBackend {
                     metadata.merge(trailers);
                 }}
                 ::std::result::Result::Ok(::volo_grpc::Response::from_parts(metadata, extensions, message))"#
-            }
+            )
         }.into()
     }
 
@@ -219,12 +219,12 @@ impl VoloGrpcBackend {
             }};"#
         );
         if streaming {
-            format! {
+            format!(
                 r#"{req_stream}
                 let req = ::volo_grpc::Request::from_parts(metadata, extensions, message_stream);"#
-            }
+            )
         } else {
-            format! {
+            format!(
                 r#"{req_stream}
                 ::volo_grpc::codegen::futures::pin_mut!(message_stream);
                 let message = ::volo_grpc::codegen::StreamExt::try_next(&mut message_stream)
@@ -234,7 +234,7 @@ impl VoloGrpcBackend {
                     metadata.merge(trailers);
                 }}
                 let req = ::volo_grpc::Request::from_parts(metadata, extensions, message);"#
-            }
+            )
         }.into()
     }
 
@@ -339,13 +339,13 @@ impl CodegenBackend for VoloGrpcBackend {
                     server_streaming,
                 );
 
-                format! {
+                format!(
                     r#""{path}" => {{
                     {req}
                     {call}
                     {resp}
                 }},"#
-                }
+                )
             })
             .join("");
 
@@ -402,7 +402,7 @@ impl CodegenBackend for VoloGrpcBackend {
             let resp = self.build_client_resp(&resp_enum_name_recv.clone().into(), &variant_name.clone().into(), output_ty.clone(), server_streaming);
 
             client_methods.push(
-                format! {
+                format!(
                     r#"pub async fn {method_name}(
                         &self,
                         requests: {req_ty},
@@ -413,11 +413,11 @@ impl CodegenBackend for VoloGrpcBackend {
                         let resp = ::volo::Service::call(&self.0, &mut cx, req).await?;
                         {resp}
                     }}"#
-                }
+                )
             );
 
             oneshot_client_methods.push(
-                format! {
+                format!(
                     r#"pub async fn {method_name}(
                         self,
                         requests: {req_ty},
@@ -429,7 +429,7 @@ impl CodegenBackend for VoloGrpcBackend {
 
                         {resp}
                     }}"#
-                }
+                )
             );
         });
 
@@ -486,7 +486,7 @@ impl CodegenBackend for VoloGrpcBackend {
             }}"
         );
 
-        let req_enum_send_impl = format! {
+        let req_enum_send_impl = format!(
             r#"
             pub enum {req_enum_name_send} {{
                 {req_enum_send_variants}
@@ -499,9 +499,9 @@ impl CodegenBackend for VoloGrpcBackend {
                     }}
                 }}
             }}"#
-        };
+        );
 
-        let req_enum_recv_impl = format! {
+        let req_enum_recv_impl = format!(
             r#"
             pub enum {req_enum_name_recv} {{
                 {req_enum_recv_variants}
@@ -515,9 +515,9 @@ impl CodegenBackend for VoloGrpcBackend {
                     }}
                 }}
             }}"#
-        };
+        );
 
-        let resp_enum_send_impl = format! {
+        let resp_enum_send_impl = format!(
             r#"
             pub enum {resp_enum_name_send} {{
                 {resp_enum_send_variants}
@@ -530,9 +530,9 @@ impl CodegenBackend for VoloGrpcBackend {
                     }}
                 }}
             }}"#
-        };
+        );
 
-        let resp_enum_recv_impl = format! {
+        let resp_enum_recv_impl = format!(
             r#"
             pub enum {resp_enum_name_recv} {{
                 {resp_enum_recv_variants}
@@ -549,9 +549,9 @@ impl CodegenBackend for VoloGrpcBackend {
                     }}
                 }}
             }}"#
-        };
+        );
 
-        let client_impl = format! {
+        let client_impl = format!(
             r#"
             pub struct {client_builder_name} {{}}
             impl {client_builder_name} {{
@@ -596,9 +596,9 @@ impl CodegenBackend for VoloGrpcBackend {
             impl<S: ::volo::client::OneShotService<::volo_grpc::context::ClientContext,::volo_grpc::Request<{req_enum_name_send
```

**File**: `volo-build/src/thrift_backend.rs` (modified, +133/-45)
```diff
@@ -78,14 +78,14 @@ impl VoloThriftBackend {
                 // let match_methods = crate::join_multi_strs!("", |methods_names, variant_names| ->
                 // "\"{methods_names}\" => {{ Self::{variant_names}({decode_variants}) }},");
 
-                format! {
+                format!(
                     r#"::std::result::Result::Ok(match &*msg_ident.name {{
                         {match_methods}
                         _ => {{
                             return ::std::result::Result::Err(::pilota::thrift::new_application_exception(::pilota::thrift::ApplicationExceptionKind::UNKNOWN_METHOD,  format!("unknown method {{}}", msg_ident.name)));
                         }},
                     }})"#
-                }
+                )
             };
 
             let send_decode = mk_decode(false, true);
@@ -101,7 +101,7 @@ impl VoloThriftBackend {
                 match_size = "_ => unreachable!(),".to_string();
             }
 
-            let recv_impl = format! {
+            let recv_impl = format!(
                 r#"impl ::volo_thrift::EntryMessage for {req_recv_name} {{
                     fn encode<T: ::pilota::thrift::TOutputProtocol>(&self, __protocol: &mut T) -> ::core::result::Result<(), ::pilota::thrift::ThriftException> {{
                         match self {{
@@ -127,9 +127,9 @@ impl VoloThriftBackend {
                         }}
                     }}
                 }}"#
-            };
+            );
 
-            let send_impl = format! {
+            let send_impl = format!(
                 r#"impl ::volo_thrift::EntryMessage for {req_send_name} {{
                     fn encode<T: ::pilota::thrift::TOutputProtocol>(&self, __protocol: &mut T) -> ::core::result::Result<(), ::pilota::thrift::ThriftException> {{
                         match self {{
@@ -155,7 +155,7 @@ impl VoloThriftBackend {
                         }}
                     }}
                 }}"#
-            };
+            );
 
             (recv_impl, send_impl)
         };
@@ -207,7 +207,7 @@ impl VoloThriftBackend {
             let recv_decode = mk_decode(false, false);
             let recv_decode_async = mk_decode(true, false);
 
-            let recv_impl = format! {
+            let recv_impl = format!(
                 r#"impl ::volo_thrift::EntryMessage for {res_recv_name} {{
                     fn encode<T: ::pilota::thrift::TOutputProtocol>(&self, __protocol: &mut T) -> ::core::result::Result<(), ::pilota::thrift::ThriftException> {{
                         match self {{
@@ -233,9 +233,9 @@ impl VoloThriftBackend {
                         }}
                     }}
                 }}"#
-            };
+            );
 
-            let send_impl = format! {
+            let send_impl = format!(
                 r#"impl ::volo_thrift::EntryMessage for {res_send_name} {{
                     fn encode<T: ::pilota::thrift::TOutputProtocol>(&self, __protocol: &mut T) -> ::core::result::Result<(), ::pilota::thrift::ThriftException> {{
                         match self {{
@@ -261,7 +261,7 @@ impl VoloThriftBackend {
                         }}
                     }}
                 }}"#
-            };
+            );
 
             (recv_impl, send_impl)
         };
@@ -285,44 +285,44 @@ impl VoloThriftBackend {
         );
 
         if self.cx().config.split {
-            let req_recv_stream = format! {
+            let req_recv_stream = format!(
                 r#"#[derive(Debug, Clone)]
                 pub enum {req_recv_name} {{
                     {req_recv_variants}
                 }}
 
                 {req_recv_impl}
             "#
-            };
+            );
 
-            let req_send_stream = format! {
+            let req_send_stream = format!(
                 r#"#[derive(Debug, Clone)]
             pub enum {req_send_name} {{
                 {req_send_variants}
             }}
 
             {req_send_impl}
             "#
-            };
+            );
 
-            let res_recv_stream = format! {
+            let res_recv_stream = format!(
                 r#"#[derive(Debug, Clone)]
             pub enum {res_recv_name} {{
                 {res_recv_variants}
             }}
             {res_recv_impl}
             "#
-            };
+            );
 
-            let res_send_stream = format! {
+            let res_send_stream = format!(
                 r#"#[derive(Debug, Clone)]
             pub enum {res_send_name} {{
                 {res_send_variants}
             }}
 
             {res_send_impl}
             "#
-            };
+            );
 
             write_item(
                 stream,
@@ -349,7 +349,7 @@ impl VoloThriftBackend {
                 res_send_stream,
             );
         } else {
-            stream.push_str(&format! {
+            stream.push_str(&format!(
                 r#"#[derive(Debug, Clone)]
             pub enum {req_recv_name} {{
                 {req_recv_variants}
@@ -375,7 +375,7 @@ impl VoloThriftB
```

---

### Incident Patch 5: `92740bad` (2026-05-19)
**Commit Message**: Feat/no service config builder out dir (#650)

feat(build): support per-IDL no_service config and explicit out_dir handling

**File**: `Cargo.lock` (modified, +12/-12)
```diff
@@ -458,7 +458,7 @@ version = "3.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fde0e0ec90c9dfb3b4b1a0891a7dcd0e2bffde2f7efed5fe7c9bb00e5bfb915e"
 dependencies = [
- "windows-sys 0.59.0",
+ "windows-sys 0.48.0",
 ]
 
 [[package]]
@@ -670,7 +670,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -758,7 +758,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -1573,7 +1573,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -2002,7 +2002,7 @@ version = "0.50.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7957b9740744892f114936ab4a57b3f487491bbeafaf8083688b16841a4240e5"
 dependencies = [
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -2294,9 +2294,9 @@ dependencies = [
 
 [[package]]
 name = "pilota-build"
-version = "0.13.5"
+version = "0.13.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c25569294e2338a732b0eda3ec027aa3240f05df1aa1d26b27bfbb9c570d72d5"
+checksum = "9009e333edaac3698d6da157cb3eafa38777ec77d7954ce7f93026be048323a1"
 dependencies = [
  "ahash",
  "anyhow",
@@ -2650,7 +2650,7 @@ dependencies = [
  "once_cell",
  "socket2 0.5.10",
  "tracing",
- "windows-sys 0.52.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -3002,7 +3002,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.11.0",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -3167,7 +3167,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5b55fb86dfd3a2f5f76ea78310a88f96c4ea21a3031f8d212443d56123fd0521"
 dependencies = [
  "libc",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -3527,7 +3527,7 @@ dependencies = [
  "getrandom 0.3.4",
  "once_cell",
  "rustix 1.1.3",
- "windows-sys 0.52.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -4195,7 +4195,7 @@ dependencies = [
 
 [[package]]
 name = "volo-build"
-version = "0.12.2"
+version = "0.12.3"
 dependencies = [
  "ahash",
  "anyhow",
```

**File**: `examples/thrift/no_service.thrift` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+namespace rs no_service_target
+
+struct NoServiceRecord {
+    1: required string name,
+    2: optional i64 version,
+}
```

**File**: `examples/thrift/no_service_ignored.thrift` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+namespace rs no_service_ignored
+
+struct IgnoredRecord {
+    1: required string name,
+    2: optional i64 version,
+}
```

**File**: `examples/volo-gen/src/lib.rs` (modified, +14/-0)
```diff
@@ -1,5 +1,19 @@
+//! Positive doctest: the target file's types are generated and usable.
+//!
+//! ```
+//! let _ = volo_gen::thrift_no_service_gen::no_service_target::NoServiceRecord::default();
+//! ```
+//!
+//! Negative doctest: the file that did NOT enable `no_service` must not
+//! contribute any types to the generated module tree.
+//!
+//! ```compile_fail
+//! let _ = volo_gen::thrift_no_service_gen::no_service_ignored::IgnoredRecord::default();
+//! ```
+
 mod r#gen {
     include!(concat!(env!("OUT_DIR"), "/thrift_gen.rs"));
+    include!(concat!(env!("OUT_DIR"), "/thrift_no_service_gen.rs"));
     include!(concat!(env!("OUT_DIR"), "/proto_gen.rs"));
 }
 
```

**File**: `examples/volo-gen/volo.yml` (modified, +18/-0)
```diff
@@ -46,3 +46,21 @@ entries:
           path: ../thrift/echo_unknown.thrift
         codegen_option:
           keep_unknown_fields: true
+  # Regression scenario for service-level `no_service`.
+  # The first IDL enables `codegen_option.config.no_service`, so its types appear
+  # in the generated module. The second IDL is intentionally listed without
+  # `touch_all` to prove that service-level `no_service` only affects the
+  # files it is attached to, instead of whitelisting the whole entry.
+  thrift_no_service:
+    filename: thrift_no_service_gen.rs
+    protocol: thrift
+    services:
+      - idl:
+          source: local
+          path: ../thrift/no_service.thrift
+        codegen_option:
+          config:
+            no_service: true
+      - idl:
+          source: local
+          path: ../thrift/no_service_ignored.thrift
```

**File**: `volo-build/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-build"
-version = "0.12.2"
+version = "0.12.3"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

**File**: `volo-build/src/config_builder.rs` (modified, +131/-10)
```diff
@@ -7,14 +7,16 @@ use volo::FastStr;
 use crate::{
     model::{self, Entry},
     util::{
-        DEFAULT_CONFIG_FILE, DEFAULT_DIR, ServiceBuilder, download_repos_to_target,
-        get_service_builders_from_services, open_config_file, read_config_from_file,
+        DEFAULT_CONFIG_FILE, DEFAULT_DIR, ServiceBuilder, collect_no_service_paths,
+        download_repos_to_target, get_service_builders_from_services, open_config_file,
+        read_config_from_file,
     },
 };
 
 pub struct ConfigBuilder {
     filename: PathBuf,
     plugins: Vec<BoxClonePlugin>,
+    out_dir: Option<PathBuf>,
 }
 
 #[allow(clippy::large_enum_variant)]
@@ -71,6 +73,13 @@ impl InnerBuilder {
         }
     }
 
+    fn out_dir<P: AsRef<Path>>(self, out_dir: P) -> Self {
+        match self {
+            InnerBuilder::Protobuf(inner) => InnerBuilder::Protobuf(inner.out_dir(&out_dir)),
+            InnerBuilder::Thrift(inner) => InnerBuilder::Thrift(inner.out_dir(&out_dir)),
+        }
+    }
+
     pub fn add_service<P>(self, path: P) -> Self
     where
         P: AsRef<Path>,
@@ -89,12 +98,12 @@ impl InnerBuilder {
             keep_unknown_fields,
         } in service_builders
         {
-            self = self
-                .add_service(path.clone())
-                .includes(includes)
-                .touch([(path.clone(), touch)]);
+            self = self.add_service(path.clone()).includes(includes);
+            if !touch.is_empty() {
+                self = self.touch([(path.clone(), touch)]);
+            }
             if keep_unknown_fields {
-                self = self.keep_unknown_fields([path])
+                self = self.keep_unknown_fields([path]);
             }
         }
         self
@@ -116,6 +125,13 @@ impl InnerBuilder {
         }
     }
 
+    pub fn touch_files(self, paths: impl IntoIterator<Item = PathBuf>) -> Self {
+        match self {
+            InnerBuilder::Protobuf(inner) => InnerBuilder::Protobuf(inner.touch_files(paths)),
+            InnerBuilder::Thrift(inner) => InnerBuilder::Thrift(inner.touch_files(paths)),
+        }
+    }
+
     pub fn keep_unknown_fields(self, keep: impl IntoIterator<Item = PathBuf>) -> Self {
         match self {
             InnerBuilder::Protobuf(inner) => {
@@ -194,6 +210,7 @@ impl ConfigBuilder {
         ConfigBuilder {
             filename,
             plugins: Vec::new(),
+            out_dir: None,
         }
     }
 
@@ -203,10 +220,32 @@ impl ConfigBuilder {
         self
     }
 
+    /// Overrides the output directory used by the underlying code generator.
+    /// This also relocates downloaded IDL repos from `${OUT_DIR}/idl` to `<out_dir>/idl`.
+    pub fn out_dir<P: AsRef<Path>>(mut self, out_dir: P) -> Self {
+        self.out_dir = Some(out_dir.as_ref().to_path_buf());
+        self
+    }
+
+    fn get_out_dir(&self) -> anyhow::Result<PathBuf> {
+        if let Some(out_dir) = &self.out_dir {
+            return Ok(out_dir.clone());
+        }
+
+        // Default to OUT_DIR derived from `DEFAULT_DIR` (which is `${OUT_DIR}/idl`).
+        // We intentionally don't check `OUT_DIR` here, because `DEFAULT_DIR` already
+        // provides a clear panic message when used outside build.rs.
+        Ok(PathBuf::from(DEFAULT_DIR.parent().expect(
+            "DEFAULT_DIR should always have a parent directory",
+        )))
+    }
+
     pub fn write(self) -> anyhow::Result<()> {
         println!("cargo:rerun-if-changed={}", self.filename.display());
         let mut f = open_config_file(self.filename.clone())?;
         let config = read_config_from_file(&mut f)?;
+        let out_dir = self.get_out_dir()?;
+        let idl_dir = out_dir.join("idl");
         config
             .entries
             .into_iter()
@@ -215,23 +254,30 @@ impl ConfigBuilder {
                     model::IdlProtocol::Thrift => InnerBuilder::thrift(),
                     model::IdlProtocol::Protobuf => InnerBuilder::protobuf(),
                 }
-                .filename(entry.filename.clone());
+                .filename(entry.filename.clone())
+                .out_dir(&out_dir);
 
                 for p in self.plugins.iter() {
                     builder = builder.plugin(p.clone());
                 }
 
                 // download repos and get the repo paths
-                let target_dir = PathBuf::from(&*DEFAULT_DIR).join(entry_name);
+                let target_dir = idl_dir.join(&entry_name);
                 let repo_dir_map = download_repos_to_target(&entry.repos, target_dir)?;
 
+                // collect per-IDL no_service flags from `codegen_option.config.no_service`
+                let no_service_paths = collect_no_service_paths(&entry.services, &repo_dir_map);
+
                 // get idl builders from services
                 let service_builders =
                     get_service_builders_from_services(&entry.services, &repo_dir_map);
 
                 // add build options to the builder and build
+                let mut builder 
```

**File**: `volo-build/src/lib.rs` (modified, +5/-0)
```diff
@@ -103,6 +103,11 @@ impl<MkB, Parser> Builder<MkB, Parser> {
         self
     }
 
+    pub fn touch_files(mut self, items: impl IntoIterator<Item = PathBuf>) -> Self {
+        self.pilota_builder = self.pilota_builder.touch_files(items);
+        self
+    }
+
     pub fn keep_unknown_fields(
         mut self,
         keep_unknown_fields: impl IntoIterator<Item = PathBuf>,
```

---

### Incident Patch 6: `d9e6751c` (2026-03-19)
**Commit Message**: fix(volo-thrift): unexpected UnexpectedEof Err returned by DefaultDec… (#647)

fix(volo-thrift): unexpected UnexpectedEof Err returned by DefaultDecoder::decode caused by non-standard behavior of shmipc sdk if a connection is closed normally

**File**: `.github/workflows/ci.yaml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ jobs:
           cargo +nightly rustdoc -p volo-thrift --all-features --config 'build.rustdocflags=["--cfg", "docsrs"]' -- --deny warnings
 
   test-linux:
-    runs-on: [self-hosted, Linux, amd64]
+    runs-on: ubuntu-latest
 
     strategy:
       matrix:
```

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -2,4 +2,5 @@
 .idea
 target
 /benchmark/output
-.DS_Store
\ No newline at end of file
+.DS_Store
+.trae
```

**File**: `scripts/clippy-and-test.sh` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ run_clippy() {
 
 run_test() {
 	echo_command cargo test -p volo-thrift
+	echo_command cargo test -p volo-thrift --features shmipc
 	echo_command cargo test -p volo-grpc --features rustls
 	echo_command cargo test -p volo-http --features client,server,http1,query,form,json,tls,cookie,multipart,ws
 	echo_command cargo test -p volo-http --features client,server,http2,query,form,json,tls,cookie,multipart,ws
```

**File**: `volo-thrift/src/codec/default/mod.rs` (modified, +259/-3)
```diff
@@ -216,8 +216,26 @@ impl<D: ZeroCopyDecoder, R: AsyncRead + AsyncExt + Unpin + Send + Sync + 'static
         &mut self,
         cx: &mut Cx,
     ) -> Result<Option<ThriftMessage<Msg>>, ThriftException> {
-        // just to check if we have reached EOF
-        if self.reader.fill_buf().await?.is_empty() {
+        let buf = match self.reader.fill_buf().await {
+            Ok(buf) => buf,
+            Err(e) => {
+                #[cfg(feature = "shmipc")]
+                {
+                    if e.kind() == std::io::ErrorKind::UnexpectedEof
+                        && self.shmipc_helper().available()
+                    {
+                        tracing::trace!(
+                            "[VOLO] thrift codec decode message EOF (shmipc), rpcinfo: {:?}",
+                            cx.rpc_info()
+                        );
+                        return Ok(None);
+                    }
+                }
+                return Err(e.into());
+            }
+        };
+
+        if buf.is_empty() {
             tracing::trace!(
                 "[VOLO] thrift codec decode message EOF, rpcinfo: {:?}",
                 cx.rpc_info()
@@ -325,12 +343,250 @@ where
 
 #[cfg(test)]
 mod tests {
-    use super::DefaultMakeCodec;
+    use std::{
+        io,
+        pin::Pin,
+        task::{Context, Poll},
+    };
+
+    use bytes::Bytes;
+    use tokio::io::{AsyncBufRead, AsyncRead, ReadBuf};
+    use volo::context::RpcInfo;
+
+    use super::*;
+    use crate::ThriftMessage;
 
     #[test]
     fn test_mk_codec() {
         let _framed = DefaultMakeCodec::framed();
         let _ttheader_framed = DefaultMakeCodec::ttheader_framed();
         let _buffered = DefaultMakeCodec::buffered();
     }
+
+    struct MockReader {
+        eof_behavior: EofBehavior,
+        #[cfg(feature = "shmipc")]
+        shmipc_stream: Option<volo::net::shmipc::Stream>,
+    }
+
+    enum EofBehavior {
+        EmptyBuffer,
+        UnexpectedEof,
+        OtherError,
+    }
+
+    impl AsyncRead for MockReader {
+        fn poll_read(
+            self: Pin<&mut Self>,
+            _cx: &mut Context<'_>,
+            _buf: &mut ReadBuf<'_>,
+        ) -> Poll<io::Result<()>> {
+            match self.eof_behavior {
+                EofBehavior::EmptyBuffer => Poll::Ready(Ok(())),
+                EofBehavior::UnexpectedEof => Poll::Ready(Err(io::Error::new(
+                    io::ErrorKind::UnexpectedEof,
+                    "unexpected eof",
+                ))),
+                EofBehavior::OtherError => Poll::Ready(Err(io::Error::new(
+                    io::ErrorKind::ConnectionReset,
+                    "connection reset",
+                ))),
+            }
+        }
+    }
+
+    impl AsyncBufRead for MockReader {
+        fn poll_fill_buf(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<&[u8]>> {
+            match self.eof_behavior {
+                EofBehavior::EmptyBuffer => Poll::Ready(Ok(&[])),
+                EofBehavior::UnexpectedEof => Poll::Ready(Err(io::Error::new(
+                    io::ErrorKind::UnexpectedEof,
+                    "unexpected eof",
+                ))),
+                EofBehavior::OtherError => Poll::Ready(Err(io::Error::new(
+                    io::ErrorKind::ConnectionReset,
+                    "connection reset",
+                ))),
+            }
+        }
+
+        fn consume(self: Pin<&mut Self>, _amt: usize) {}
+    }
+
+    impl volo::net::ext::AsyncExt for MockReader {
+        async fn ready(&self, _interest: tokio::io::Interest) -> io::Result<tokio::io::Ready> {
+            Ok(tokio::io::Ready::READABLE | tokio::io::Ready::WRITABLE)
+        }
+
+        #[cfg(feature = "shmipc")]
+        fn shmipc_helper(&self) -> volo::net::shmipc::ShmipcHelper {
+            if let Some(stream) = &self.shmipc_stream {
+                stream.helper()
+            } else {
+                volo::net::shmipc::ShmipcHelper::none()
+            }
+        }
+    }
+
+    #[tokio::test]
+    async fn test_decode_empty_buffer_returns_none() {
+        let reader = MockReader {
+            eof_behavior: EofBehavior::EmptyBuffer,
+            #[cfg(feature = "shmipc")]
+            shmipc_stream: None,
+        };
+        let mut decoder = DefaultDecoder {
+            decoder: thrift::MakeThriftCodec::default().make_codec().1,
+            reader: BufReader::new(reader),
+        };
+
+        let mut cx = crate::context::ClientContext::new(
+            1,
+            RpcInfo::with_role(volo::context::Role::Client),
+            pilota::thrift::TMessageType::Call,
+        );
+
+        let result: Result<Option<ThriftMessage<Bytes>>, _> = decoder.decode(&mut cx).await;
+        assert!(result.is_ok());
+        assert!(result.unwrap().is_none());
+    }
+
+    #[tokio::test]
+    async fn test_decode_unexpected_eof_returns_error() {
+        let reader = MockReader {
+            eof_behavior: EofBehavior::UnexpectedEof,
+            #[cfg(feature =
```

---

### Incident Patch 7: `6220d5ba` (2026-03-03)
**Commit Message**: fix(volo-thrift): remove dirty check from try_checkout

The dirty flag is true during every normal in-flight write, which is
the common state under high QPS. Checking it in try_checkout() caused
the fast path to return None and fall through to the slow path — which
pops the connection, releases the lock, and re-exposes the race window
this fix is designed to eliminate.

The broken-write case (timeout/cancel leaves dirty=true permanently) is
already handled downstream: the next send() sees dirty=true, sets
write_error=true, and write_error is caught by both try_checkout() and
reusable().

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `volo-thrift/src/transport/multiplex/thrift_transport.rs` (modified, +0/-1)
```diff
@@ -382,7 +382,6 @@ impl<TTEncoder: Send, Resp: Send> Poolable for ThriftTransport<TTEncoder, Resp>
         if !self.write_error.load(std::sync::atomic::Ordering::Relaxed)
             && !self.read_error.load(std::sync::atomic::Ordering::Relaxed)
             && !self.read_closed.load(std::sync::atomic::Ordering::Relaxed)
-            && !self.dirty.load(std::sync::atomic::Ordering::Relaxed)
         {
             Some(self.clone())
         } else {
```

---

### Incident Patch 8: `37cf3ed1` (2026-03-03)
**Commit Message**: fix(volo-thrift): eliminate multiplex pool race causing ghost connections

In high-concurrency multiplex scenarios, Pool::get() had a race window
where shared connections were popped from idle, lock released for
reusable() check, then cloned and reinserted. During the unlock window,
concurrent callers saw the idle pool as empty and triggered new TCP
connections that became "ghosts" (alive but unused), leading to
TIME_WAIT buildup.

Add Poolable::try_checkout() for synchronous, non-consuming checkout of
shared connections while holding the pool lock. The multiplex
ThriftTransport implementation checks write_error, read_error,
read_closed, and dirty flags, then returns a cheap clone. Pool::get()
uses this as a fast path before the existing pop-check-reinsert loop,
so the idle pool never appears empty to concurrent callers.

When try_checkout() returns None (not implemented or connection broken),
the code falls through to the existing slow path for full async
reusable() checking, preserving backward compatibility for external
Poolable implementations.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `volo-thrift/src/transport/multiplex/thrift_transport.rs` (modified, +12/-0)
```diff
@@ -377,4 +377,16 @@ impl<TTEncoder: Send, Resp: Send> Poolable for ThriftTransport<TTEncoder, Resp>
     fn can_share(&self) -> bool {
         true
     }
+
+    fn try_checkout(&self) -> Option<Self> {
+        if !self.write_error.load(std::sync::atomic::Ordering::Relaxed)
+            && !self.read_error.load(std::sync::atomic::Ordering::Relaxed)
+            && !self.read_closed.load(std::sync::atomic::Ordering::Relaxed)
+            && !self.dirty.load(std::sync::atomic::Ordering::Relaxed)
+        {
+            Some(self.clone())
+        } else {
+            None
+        }
+    }
 }
```

**File**: `volo-thrift/src/transport/pool/mod.rs` (modified, +30/-0)
```diff
@@ -57,6 +57,16 @@ pub trait Poolable: Sized {
     fn can_share(&self) -> bool {
         false
     }
+
+    /// Synchronous, non-consuming checkout for shared connections.
+    ///
+    /// Returns `Some(clone)` if the connection is reusable; `None` otherwise.
+    /// This allows shared (multiplex) connections to be checked out while
+    /// holding the pool lock, eliminating the race window where the idle pool
+    /// appears empty to concurrent callers.
+    fn try_checkout(&self) -> Option<Self> {
+        None
+    }
 }
 
 /// When checking out a pooled connection, it might be that the connection
@@ -239,6 +249,26 @@ impl<K: Key, T: Poolable + Send + 'static> Pool<K, T> {
 
                     if let Some(list) = inner.idle.get_mut(&key) {
                         tracing::trace!("[VOLO] take? {:?}: expiration = {:?}", key, expiration.0);
+
+                        // Fast path: shared (multiplex) connections can be checked out
+                        // synchronously while holding the lock. This avoids the race where
+                        // the idle pool appears empty after pop, causing spurious new
+                        // connections.
+                        while list.front().is_some_and(|e| e.inner.can_share()) {
+                            if expiration.expires(list[0].idle_at) {
+                                list.pop_front();
+                                continue;
+                            }
+                            if let Some(conn) = list[0].inner.try_checkout() {
+                                list[0].idle_at = Instant::now();
+                                return Ok(self.reuse(&key, conn));
+                            }
+                            // try_checkout returned None: either not implemented or
+                            // connection is broken. Fall through to the slow path
+                            // which will do the full async reusable() check.
+                            break;
+                        }
+
                         while let Some(entry) = list.pop_front() {
                             // TODO: Actually, since the `idle` list is pushed to the end always,
                             // that would imply that if *this* entry is expired, then anything
```

---

### Incident Patch 9: `d5352de0` (2026-01-08)
**Commit Message**: feat(volo-http): add `layer` for `RequestBuilder` (#633)

* feat(volo-http): add `layer` for `RequestBuilder`

Note that the layer should generate a `OneShotService`

* chore(volo-http): bump volo-http to 0.5.1

---------

Signed-off-by: Yu Li <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -4256,7 +4256,7 @@ dependencies = [
 
 [[package]]
 name = "volo-http"
-version = "0.5.0"
+version = "0.5.1"
 dependencies = [
  "ahash",
  "async-broadcast",
```

**File**: `volo-http/Cargo.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-http"
-version = "0.5.0"
+version = "0.5.1"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
@@ -138,4 +138,4 @@ native-tls-vendored = ["native-tls", "volo/native-tls-vendored"]
 
 [package.metadata.docs.rs]
 all-features = true
-rustdoc-args = ["--cfg", "docsrs"]
\ No newline at end of file
+rustdoc-args = ["--cfg", "docsrs"]
```

**File**: `volo-http/src/client/request_builder.rs` (modified, +32/-3)
```diff
@@ -11,6 +11,7 @@ use http::{
     uri::{PathAndQuery, Scheme, Uri},
     version::Version,
 };
+use motore::layer::Layer;
 use volo::{
     client::{Apply, OneShotService, WithOptService},
     net::Address,
@@ -345,17 +346,27 @@ impl<S, B> RequestBuilder<S, B> {
         self.request.body()
     }
 
-    /// Apply a [`CallOpt`] to the request.
-    pub fn with_callopt(self, callopt: CallOpt) -> RequestBuilder<WithOptService<S, CallOpt>, B> {
+    /// Add a new [`Layer`] to the front of request builder.
+    ///
+    /// Note that the [`Layer`] generated `Service` should be a [`OneShotService`].
+    pub fn layer<L>(self, layer: L) -> RequestBuilder<L::Service, B>
+    where
+        L: Layer<S>,
+    {
         RequestBuilder {
-            inner: WithOptService::new(self.inner, callopt),
+            inner: layer.layer(self.inner),
             target: self.target,
             version: self.version,
             request: self.request,
             status: self.status,
         }
     }
 
+    /// Apply a [`CallOpt`] to the request.
+    pub fn with_callopt(self, callopt: CallOpt) -> RequestBuilder<WithOptService<S, CallOpt>, B> {
+        self.layer(WithOptLayer::new(callopt))
+    }
+
     fn set_version(&mut self) {
         let ver = match self.version {
             Some(ver) => ver,
@@ -392,3 +403,21 @@ impl<S, B> RequestBuilder<S, B> {
         self.inner.call(&mut cx, self.request).await
     }
 }
+
+struct WithOptLayer {
+    opt: CallOpt,
+}
+
+impl WithOptLayer {
+    const fn new(opt: CallOpt) -> Self {
+        Self { opt }
+    }
+}
+
+impl<S> Layer<S> for WithOptLayer {
+    type Service = WithOptService<S, CallOpt>;
+
+    fn layer(self, inner: S) -> Self::Service {
+        WithOptService::new(inner, self.opt)
+    }
+}
```

---

### Incident Patch 10: `4613056d` (2025-12-29)
**Commit Message**: feat(volo-build): add with_comments option for codegen builder (#631)

* feat(volo-build): add with_comments option for codegen builder

* chore(volo-grpc): allow large result to avoid breaking change

**File**: `Cargo.lock` (modified, +145/-241)
```diff
@@ -192,21 +192,20 @@ checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "aws-lc-rs"
-version = "1.15.0"
+version = "1.15.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5932a7d9d28b0d2ea34c6b3779d35e3dd6f6345317c34e73438c4f1f29144151"
+checksum = "6a88aab2464f1f25453baa7a07c84c5b7684e274054ba06817f382357f77a288"
 dependencies = [
  "aws-lc-sys",
  "zeroize",
 ]
 
 [[package]]
 name = "aws-lc-sys"
-version = "0.33.0"
+version = "0.35.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1826f2e4cfc2cd19ee53c42fbf68e2f81ec21108e0b7ecf6a71cf062137360fc"
+checksum = "b45afffdee1e7c9126814751f88dddc747f41d91da16c9551a0f1e8a11e788a1"
 dependencies = [
- "bindgen",
  "cc",
  "cmake",
  "dunce",
@@ -215,9 +214,9 @@ dependencies = [
 
 [[package]]
 name = "axum"
-version = "0.8.7"
+version = "0.8.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5b098575ebe77cb6d14fc7f32749631a6e44edbef6b796f89b020e99ba20d425"
+checksum = "8b52af3cb4058c895d37317bb27508dccc8e5f2d39454016b297bf4a400597b8"
 dependencies = [
  "axum-core",
  "bytes",
@@ -240,9 +239,9 @@ dependencies = [
 
 [[package]]
 name = "axum-core"
-version = "0.5.5"
+version = "0.5.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "59446ce19cd142f8833f856eb31f3eb097812d1479ab224f54d72428ca21ea22"
+checksum = "08c78f31d7b1291f7ee735c1c6780ccde7785daae9a9206026862dab7d8792d1"
 dependencies = [
  "bytes",
  "futures-core",
@@ -286,26 +285,6 @@ dependencies = [
  "volo-thrift",
 ]
 
-[[package]]
-name = "bindgen"
-version = "0.72.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "993776b509cfb49c750f11b8f07a46fa23e0a1386ffc01fb1e7d343efc387895"
-dependencies = [
- "bitflags 2.10.0",
- "cexpr",
- "clang-sys",
- "itertools 0.13.0",
- "log",
- "prettyplease",
- "proc-macro2",
- "quote",
- "regex",
- "rustc-hash 2.1.1",
- "shlex",
- "syn",
-]
-
 [[package]]
 name = "bitflags"
 version = "1.3.2"
@@ -335,9 +314,9 @@ checksum = "36f64beae40a84da1b4b26ff2761a5b895c12adc41dc25aaee1c4f2bbfe97a6e"
 
 [[package]]
 name = "bumpalo"
-version = "3.19.0"
+version = "3.19.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
+checksum = "5dd9dc738b7a8311c7ade152424974d8115f2cdad61e8dab8dac9f2362298510"
 
 [[package]]
 name = "bytes"
@@ -350,25 +329,16 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.2.46"
+version = "1.2.51"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b97463e1064cb1b1c1384ad0a0b9c8abd0988e2a91f52606c80ef14aadb63e36"
+checksum = "7a0aeaff4ff1a90589618835a598e545176939b97874f7abc7851caa0618f203"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
  "libc",
  "shlex",
 ]
 
-[[package]]
-name = "cexpr"
-version = "0.6.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6fac387a98bb7c37292057cffc56d62ecb629900026402633ae9160df93a8766"
-dependencies = [
- "nom",
-]
-
 [[package]]
 name = "cfg-if"
 version = "1.0.4"
@@ -406,32 +376,21 @@ dependencies = [
  "unicode-segmentation",
 ]
 
-[[package]]
-name = "clang-sys"
-version = "1.8.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0b023947811758c97c59bf9d1c188fd619ad4718dcaa767947df1cadb14f39f4"
-dependencies = [
- "glob",
- "libc",
- "libloading",
-]
-
 [[package]]
 name = "clap"
-version = "4.5.51"
+version = "4.5.53"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c26d721170e0295f191a69bd9a1f93efcdb0aff38684b61ab5750468972e5f5"
+checksum = "c9e340e012a1bf4935f5282ed1436d1489548e8f72308207ea5df0e23d2d03f8"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.5.51"
+version = "4.5.53"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "75835f0c7bf681bfd05abe44e965760fea999a5286c6eb2d59883634fd02011a"
+checksum = "d76b5d13eaa18c901fd2f7fca939fefe3a0727a953561fefdf3b2922b8569d00"
 dependencies = [
  "anstream",
  "anstyle",
@@ -460,9 +419,9 @@ checksum = "a1d728cc89cf3aee9ff92b05e62b19ee65a02b5702cff7d5a377e32c6ae29d8d"
 
 [[package]]
 name = "cmake"
-version = "0.1.54"
+version = "0.1.57"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e7caa3f9de89ddbe2c607f4101924c5abec803763ae9534e4f4d7d8f84aa81f0"
+checksum = "75443c44cd6b379beb8c5b45d85d0773baf31cce901fe7bb252f4eff3008ef7d"
 dependencies = [
  "cc",
 ]
@@ -893,9 +852,9 @@ dependencies = [
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.5"
+version = "0.1.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3a3076410a55c90011c298b04d0cfa770b00fa04e1e3c97d3f6c9de105a03844"
+checksum = "645cbb3a84e60b7531617d5ae4e57f7e27308f6445f5abf653209ea76dec8dff"
 
 [[package]]
 name = "fixedbitset
```

**File**: `volo-build/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-build"
-version = "0.12.0"
+version = "0.12.1"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

**File**: `volo-build/src/config_builder.rs` (modified, +10/-0)
```diff
@@ -178,6 +178,15 @@ impl InnerBuilder {
             }
         }
     }
+
+    pub fn with_comments(self, with_comments: bool) -> Self {
+        match self {
+            InnerBuilder::Protobuf(inner) => {
+                InnerBuilder::Protobuf(inner.with_comments(with_comments))
+            }
+            InnerBuilder::Thrift(inner) => InnerBuilder::Thrift(inner.with_comments(with_comments)),
+        }
+    }
 }
 
 impl ConfigBuilder {
@@ -229,6 +238,7 @@ impl ConfigBuilder {
                     .dedup(entry.common_option.dedups)
                     .with_descriptor(entry.common_option.with_descriptor)
                     .with_field_mask(entry.common_option.with_field_mask)
+                    .with_comments(entry.common_option.with_comments)
                     .write()?;
 
                 Ok(())
```

**File**: `volo-build/src/lib.rs` (modified, +5/-0)
```diff
@@ -153,6 +153,11 @@ impl<MkB, Parser> Builder<MkB, Parser> {
         self.pilota_builder = self.pilota_builder.with_field_mask(with_field_mask);
         self
     }
+
+    pub fn with_comments(mut self, with_comments: bool) -> Self {
+        self.pilota_builder = self.pilota_builder.with_comments(with_comments);
+        self
+    }
 }
 
 impl<MkB, P> Builder<MkB, P>
```

**File**: `volo-build/src/model.rs` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ pub struct CommonOption {
     pub with_descriptor: bool,
     #[serde(default, skip_serializing_if = "is_false")]
     pub with_field_mask: bool,
+    #[serde(default, skip_serializing_if = "is_false")]
+    pub with_comments: bool,
 }
 
 #[derive(Serialize, Deserialize, Debug, Clone)]
```

**File**: `volo-build/src/thrift_backend.rs` (modified, +1/-0)
```diff
@@ -939,6 +939,7 @@ mod tests {
             false,
             false,
             false,
+            false,
         )
     }
 
```

**File**: `volo-build/src/workspace.rs` (modified, +6/-0)
```diff
@@ -109,6 +109,7 @@ where
             .split_generated_files(config.common_option.split_generated_files)
             .with_descriptor(config.common_option.with_descriptor)
             .with_field_mask(config.common_option.with_field_mask)
+            .with_comments(config.common_option.with_comments)
             .pilota_builder
             .compile_with_config(idl_services, pilota_build::Output::Workspace(work_dir));
     }
@@ -175,4 +176,9 @@ where
         self.pilota_builder = self.pilota_builder.with_field_mask(with_field_mask);
         self
     }
+
+    pub fn with_comments(mut self, with_comments: bool) -> Self {
+        self.pilota_builder = self.pilota_builder.with_comments(with_comments);
+        self
+    }
 }
```

**File**: `volo-cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-cli"
-version = "0.12.0"
+version = "0.12.1"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

---

### Incident Patch 11: `a7febd1b` (2025-11-17)
**Commit Message**: refactor(volo-build): adapt to the codegen backend new trait and new codegen context defined in pilota-build (#626)

**File**: `Cargo.toml` (modified, +6/-7)
```diff
@@ -24,11 +24,11 @@ license = "MIT OR Apache-2.0"
 rust-version = "1.85.0"
 
 [workspace.dependencies]
-pilota = "0.12"
-pilota-build = "0.12.2"
-pilota-thrift-parser = "0.12"
-pilota-thrift-reflect = "0.1"
-pilota-thrift-fieldmask = "0.1"
+pilota = "0.13"
+pilota-build = "0.13"
+pilota-thrift-parser = "0.13"
+pilota-thrift-reflect = "0.2"
+pilota-thrift-fieldmask = "0.2"
 motore = "0.4.1"
 metainfo = "0.7.14"
 
@@ -80,7 +80,6 @@ mockall_double = "0.3"
 multer = "3"
 mur3 = "0.1"
 nix = "0.30"
-nom = "8"
 normpath = "1"
 num_enum = "0.7"
 once_cell = "1"
@@ -152,7 +151,7 @@ panic = 'unwind'
 incremental = false
 overflow-checks = false
 
-[patch.crates-io]
+# [patch.crates-io]
 # pilota = { git = "https://github.com/cloudwego/pilota.git", branch = "main" }
 # pilota-build = { git = "https://github.com/cloudwego/pilota.git", branch = "main" }
 # pilota-thrift-parser = { git = "https://github.com/cloudwego/pilota.git", branch = "main" }
```

**File**: `examples/proto/nested.proto` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+syntax = "proto3";
+
+package nested;
+
+service Greeter {
+    rpc SayHello (HelloRequest) returns (HelloReply) {}
+}
+
+message HelloRequest {
+    string name = 1;
+    message User {
+        string username = 1;
+    }
+    oneof contact_info {
+        string email = 2;
+        string phone = 3;
+    }
+    enum Gender {
+        UNKNOWN = 0;
+        MALE = 1;
+        FEMALE = 2;
+    }
+}
+
+message HelloReply {
+    string message = 1;
+}
\ No newline at end of file
```

**File**: `examples/src/thrift/hello/client.rs` (modified, +3/-1)
```diff
@@ -11,7 +11,9 @@ static CLIENT: LazyLock<volo_gen::thrift_gen::hello::HelloServiceClient> = LazyL
 
 #[volo::main]
 async fn main() {
-    let desc = volo_gen::thrift_gen::hello::HelloRequest::get_descriptor().type_descriptor();
+    let desc = volo_gen::thrift_gen::hello::HelloRequest::get_descriptor()
+        .unwrap()
+        .type_descriptor();
     println!("{desc:?}");
 
     let fm = pilota_thrift_fieldmask::FieldMaskBuilder::new(&desc, &["$.hello"])
```

**File**: `examples/volo-gen/volo.yml` (modified, +7/-1)
```diff
@@ -3,7 +3,8 @@ entries:
   proto:
     filename: proto_gen.rs
     protocol: protobuf
-    with_descriptor: true
+    # with_descriptor: true
+    touch_all: true
     services:
       - idl:
           source: local
@@ -22,6 +23,11 @@ entries:
           path: ../proto/helloworld.proto
           includes:
             - ../proto
+      - idl:
+          source: local
+          path: ../proto/nested.proto
+          includes:
+            - ../proto
   thrift:
     filename: thrift_gen.rs
     protocol: thrift
```

**File**: `scripts/volo-cli-test.sh` (modified, +19/-1)
```diff
@@ -37,14 +37,32 @@ init() {
 	export VOLO_DIR="$PWD"
 	echo_command cargo build -p volo-cli
 	export VOLO_CLI="$PWD/target/debug/volo"
+	detect_pilota_branch
+}
+
+detect_pilota_branch() {
+	local cargo_toml="$VOLO_DIR/Cargo.toml"
+
+	if grep -q '^\[patch\.crates-io\]' "$cargo_toml"; then
+		local pilota_line=$(sed -n '/^\[patch\.crates-io\]/,/^\[/p' "$cargo_toml" | grep '^pilota[[:space:]]*=' | grep 'branch[[:space:]]*=' | head -n 1)
+		
+		if [ -n "$pilota_line" ]; then
+			export PILOTA_BRANCH=$(echo "$pilota_line" | sed -n 's/.*branch[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p')
+			echo "Detected pilota patch: branch = $PILOTA_BRANCH"
+			return
+		fi
+	fi
+	
+	export PILOTA_BRANCH="main"
+	echo "No pilota patch detected, using default: branch = main"
 }
 
 append_volo_dep_item() {
 	echo "$1 = { path = \"$VOLO_DIR/$1\" }" >> Cargo.toml
 }
 
 append_pilota_dep_item() {
-	echo "$1 = { git = \"https://github.com/cloudwego/pilota.git\", branch = \"main\" }" >> Cargo.toml
+	echo "$1 = { git = \"https://github.com/cloudwego/pilota.git\", branch = \"$PILOTA_BRANCH\" }" >> Cargo.toml
 }
 
 patch_cargo_toml() {
```

**File**: `tests/code-generation/proto/descriptor.proto` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+syntax = "proto3";
+
+package descriptor;
+
+import "google/protobuf/timestamp.proto";
+import "google/protobuf/any.proto";
+import "google/protobuf/descriptor.proto";
+
+option java_package = "com.example.codegen";
+option go_package = "github.com/cloudwego/volo/tests/codegen;codegen";
+
+// Define custom options to test descriptor options retrieval
+extend google.protobuf.MessageOptions {
+  // Custom message-level option
+  string my_msg_option = 51234;
+}
+
+extend google.protobuf.FieldOptions {
+  // Custom field-level option to mark sensitive fields
+  bool redacted = 51235;
+}
+
+// Top-level message containing nested messages, enums, map, oneof, reserved, etc.
+message Outer {
+  // Nested message
+  message Inner {
+    // Nested enum
+    enum State {
+      UNKNOWN = 0;
+      STARTED = 1;
+      FINISHED = 2;
+    }
+
+    State state = 1;
+    repeated string labels = 2;
+    map<string, int32> counts = 3;
+
+    // oneof example: only one field can be set at a time
+    oneof payload {
+      bytes raw = 4;
+      Nested nested = 5;
+    }
+
+    // Further nesting
+    message Nested {
+      string name = 1 [(redacted) = true];
+      google.protobuf.Timestamp created = 2;
+    }
+  }
+
+  repeated Inner inners = 1;
+  OuterAlt alt = 2;
+
+  // Reserved field number range for testing descriptor reserved field info
+  reserved 100 to 199;
+}
+
+// Message with deprecated option
+message OuterAlt {
+  option deprecated = true;
+  int32 id = 1;
+  google.protobuf.Any meta = 2;
+  repeated ServiceReference services = 3;
+}
+
+message ServiceReference {
+  string name = 1;
+  string endpoint = 2;
+  map<string, string> labels = 3;
+}
+
+// Top-level enum
+enum GlobalEnum {
+  GE_UNKNOWN = 0;
+  GE_ALPHA = 1;
+  GE_BETA = 2;
+  GE_GAMMA = 3;
+}
+
+// Service with multiple RPC types to test service descriptor (including streaming)
+service ComplexService {
+  // Standard Unary rpc
+  rpc UnaryGet (Request) returns (Response);
+
+  // Server streaming
+  rpc ServerStream (Request) returns (stream Response);
+
+  // Client streaming
+  rpc ClientStream (stream Request) returns (Response);
+}
+
+// Request/Response messages combining various field types
+message Request {
+  string query = 1;
+  GlobalEnum filter = 2;
+  repeated int64 ids = 3;
+  map<string, Outer.Inner> by_name = 4;
+
+  oneof payload {
+    bytes raw = 10;
+    google.protobuf.Any any = 11;
+  }
+}
+
+message Response {
+  int32 code = 1;
+  string message = 2;
+  repeated google.protobuf.Timestamp events = 3;
+}
+
+// Example message using defined options to test extension descriptor visibility
+message OptionedMessage {
+  option (my_msg_option) = "optioned";
+  string note = 1 [(redacted) = false];
+}
+
+// File-level comments to test SourceCodeInfo extraction (comments become part of descriptor)
+// End of descriptor.proto
```

**File**: `tests/code-generation/proto/service_a.proto` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+syntax = "proto3";
+
+package service_a;
+
+message FullRequest {
+  string request_id = 1;
+  string user_id = 2;
+  string field_a = 3;
+  string field_b = 4;
+  string field_c = 5;
+  int64 timestamp = 6;
+
+  message NotNeeded {
+    string nested_field = 1;
+  }
+
+  oneof nested_oneof {
+    string nested_oneof_field = 7;
+    string nested_oneof_field_2 = 8;
+  }
+}
+
+message FullResponse {
+  string request_id = 1;
+  string result = 2;
+  string response_a = 3;
+  string response_b = 4;
+  string response_c = 5;
+}
+
+service ServiceA {
+  rpc ProcessA(FullRequest) returns (FullResponse);
+}
```

**File**: `tests/code-generation/proto/service_b.proto` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+// Service B - 调用链中间节点
+// A -> B -> C 的调用链中，B 是中间节点
+// B 只知道部分字段，需要透传 field_c 给 C
+syntax = "proto3";
+
+package service_b;
+
+message PartialRequest {
+  string request_id = 1;
+  string user_id = 2;
+  string field_b = 4;
+  int64 timestamp = 6;
+}
+
+message PartialResponse {
+  string request_id = 1;
+  string result = 2;
+  string response_b = 4;
+}
+
+service ServiceB {
+  rpc ProcessB(PartialRequest) returns (PartialResponse);
+}
```

---

### Incident Patch 12: `21bb99fc` (2025-11-12)
**Commit Message**: fix(volo-build): use the global path for exception item when generate… (#630)

fix(volo-build): use the global path for exception item when generate the thrift server template

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -4227,7 +4227,7 @@ dependencies = [
 
 [[package]]
 name = "volo-build"
-version = "0.11.5"
+version = "0.11.6"
 dependencies = [
  "ahash",
  "anyhow",
@@ -4257,7 +4257,7 @@ dependencies = [
 
 [[package]]
 name = "volo-cli"
-version = "0.11.3"
+version = "0.11.4"
 dependencies = [
  "anyhow",
  "clap",
```

**File**: `volo-build/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-build"
-version = "0.11.5"
+version = "0.11.6"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

**File**: `volo-build/src/thrift_backend.rs` (modified, +101/-1)
```diff
@@ -835,7 +835,7 @@ impl pilota_build::CodegenBackend for VoloThriftBackend {
             .join(",");
 
         if let Some(p) = &method.exceptions {
-            let exception = self.inner.cur_related_item_path(p.did);
+            let exception = self.inner.codegen_ty(p.did).global_path("volo_gen");
             ret_ty = format!("::volo_thrift::MaybeException<{ret_ty}, {exception}>");
         }
 
@@ -900,3 +900,103 @@ impl pilota_build::MakeBackend for MkThriftBackend {
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use std::fs;
+
+    use pilota_build::{
+        Builder, DefId, IdlService, SourceType,
+        middle::context::tls::CONTEXT,
+        parser::ThriftParser,
+        rir::{self, Item},
+    };
+    use tempfile::tempdir;
+
+    use super::*;
+
+    fn build_test_context(thrift_content: &str) -> Context {
+        let dir = tempdir().expect("create temp dir");
+        let file_path = dir.path().join("test.thrift");
+        fs::write(&file_path, thrift_content).expect("write thrift");
+
+        Builder::<pilota_build::MkThriftBackend, ThriftParser>::build_cx(
+            vec![IdlService::from_path(file_path)],
+            None,
+            ThriftParser::default(),
+            Vec::new(),
+            true,
+            SourceType::Thrift,
+            true,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            "common".into(),
+            false,
+            false,
+            false,
+        )
+    }
+
+    fn find_first_service(cx: &Context) -> DefId {
+        for (def_id, node) in cx.nodes().iter() {
+            if let rir::NodeKind::Item(item) = &node.kind {
+                if let Item::Service(svc) = &**item {
+                    let _ = svc; // only need def_id
+                    return *def_id;
+                }
+            }
+        }
+        panic!("no service found in parsed thrift");
+    }
+
+    #[test]
+    fn test_codegen_service_method_with_global_path_exception() {
+        let cx = build_test_context(
+            r#"
+            exception Exception1 {
+                1: string message;
+            }
+            exception Exception2 {
+                1: string message;
+            }
+            service S3 {
+                i32 DoThing(1: i64 type, 2: string Name) throws (1: Exception1 e1, 2: Exception2 e2);
+            }
+            "#,
+        );
+
+        let svc_def_id = find_first_service(&cx);
+        let methods = cx.service_methods(svc_def_id);
+        assert!(!methods.is_empty());
+        let m = &methods[0];
+
+        let backend = VoloThriftBackend {
+            inner: ThriftBackend::new(cx.clone()),
+        };
+
+        let sig = CONTEXT.set(&cx, || {
+            <VoloThriftBackend as pilota_build::CodegenBackend>::codegen_service_method_with_global_path(
+                &backend,
+                svc_def_id,
+                m,
+            )
+        });
+
+        // 期望为 Result<MaybeException<i32, <exception_enum_global_path>>, ServerError>
+        let p = m.exceptions.as_ref().expect("exceptions must exist");
+        let exc_path = cx
+            .item_path(p.did)
+            .iter()
+            .map(|s| s.to_string())
+            .collect::<Vec<_>>()
+            .join("::");
+        let exc_global = format!("volo_gen::{exc_path}");
+        let expected = format!(
+            "-> ::core::result::Result<::volo_thrift::MaybeException<i32, {}>, \
+             ::volo_thrift::ServerError>",
+            exc_global
+        );
+        assert!(sig.contains(&expected), "signature: {sig}");
+    }
+}
```

**File**: `volo-cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-cli"
-version = "0.11.3"
+version = "0.11.4"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

---

### Incident Patch 13: `10e73ea4` (2025-11-03)
**Commit Message**: fix(volo-grpc): use concat to get the entire encoded result from linkedbytes (#628)

* chore(volo): add test coverage workflow

* fix(volo-grpc): use linkedbytes concat to get the full encoded results

* perf(volo-grpc): yield each node as a separate frame to avoid copy

* chore(volo-grpc): update version and cargo clippy

* fix(volo-grpc): the start of prefix is always 0 because we use new buffer for each item

* chore(volo): calculate the coverage of multiple features for each crate

* chore: remove unused files

**File**: `.github/codecov.yaml` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+coverage:
+  status:
+    project:               
+      default:
+        informational: true  
+    patch:
+      default:
+        target: 70%  
+        threshold: 0%
+        informational: false
```

**File**: `.github/workflows/ci.yaml` (modified, +39/-0)
```diff
@@ -144,3 +144,42 @@ jobs:
       - name: Cli tests
         run: |
           bash scripts/volo-cli-test.sh
+  coverage:
+    runs-on: [self-hosted, Linux, amd64]
+    timeout-minutes: 40
+    permissions:
+      contents: read
+      checks: write
+      pull-requests: write
+    steps:
+      - uses: actions/checkout@v4
+      - uses: dtolnay/rust-toolchain@nightly
+
+        with:
+          components: rustfmt, clippy
+      - uses: taiki-e/install-action@v2
+
+        with:
+          tool: cargo-llvm-cov
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: cargo-nextest
+
+
+      - name: Generate coverage (LCOV + HTML)
+        run: |
+          bash scripts/coverage.sh
+
+      - uses: actions/upload-artifact@v4
+        with:
+          name: coverage-html
+          path: target/llvm-cov/html
+
+
+      - name: Upload to Codecov
+        uses: codecov/codecov-action@v4
+
+        with:
+          files: lcov.info
+          fail_ci_if_error: true
+          verbose: true
\ No newline at end of file
```

**File**: `Cargo.lock` (modified, +2/-1)
```diff
@@ -4295,7 +4295,7 @@ dependencies = [
 
 [[package]]
 name = "volo-grpc"
-version = "0.11.7"
+version = "0.11.8"
 dependencies = [
  "anyhow",
  "async-broadcast",
@@ -4316,6 +4316,7 @@ dependencies = [
  "hyper",
  "hyper-timeout",
  "hyper-util",
+ "linkedbytes",
  "matchit",
  "metainfo",
  "motore",
```

**File**: `examples/Cargo.toml` (modified, +6/-2)
```diff
@@ -153,8 +153,12 @@ volo = { path = "../volo" }
 volo-grpc = { path = "../volo-grpc", features = ["grpc-web"] }
 volo-thrift = { path = "../volo-thrift", features = ["multiplex"] }
 volo-http = { path = "../volo-http", features = [
-    "client", "server",
-    "json", "query", "form", "cookie",
+    "client",
+    "server",
+    "json",
+    "query",
+    "form",
+    "cookie",
     "http1",
 ] }
 
```

**File**: `scripts/coverage.sh` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+#!/bin/bash
+
+set -o errexit
+set -o nounset
+set -o pipefail
+
+IGNORE_REGEX='(^|[\\/])(benches|tests?|examples|target|gen|test_data)([\\/])|(^|[\\/])build\\.rs$|(^|[\\/])\\.cargo[\\/]registry'
+
+run_nextest() {
+  local package="$1"
+  local features="${2:-}"
+  local no_tests_behavior="${NO_TESTS_BEHAVIOR:-pass}"
+  if [ -n "$features" ]; then
+    cargo llvm-cov nextest -p "$package" --features "$features" --all-targets --no-report \
+      --no-tests="$no_tests_behavior" \
+      --ignore-filename-regex "$IGNORE_REGEX"
+  else
+    cargo llvm-cov nextest -p "$package" --all-targets --no-report \
+      --no-tests="$no_tests_behavior" \
+      --ignore-filename-regex "$IGNORE_REGEX"
+  fi
+}
+
+report_all() {
+  cargo llvm-cov report --lcov --output-path lcov.info \
+    --ignore-filename-regex "$IGNORE_REGEX"
+  cargo llvm-cov report --html \
+    --ignore-filename-regex "$IGNORE_REGEX"
+}
+
+main() {
+  # 1. clean up previous coverage data
+  cargo llvm-cov clean --workspace || true
+
+  # 2.run tests with coverage, align with scripts/clippy-and-test.sh
+  run_nextest volo-thrift
+  run_nextest volo-grpc 'rustls'
+  run_nextest volo-http 'client,server,http1,query,form,json,tls,cookie,multipart,ws'
+  run_nextest volo-http 'client,server,http2,query,form,json,tls,cookie,multipart,ws'
+  run_nextest volo-http 'full'
+  run_nextest volo 'rustls'
+  run_nextest volo-build
+  run_nextest volo-cli
+
+  # 3.generate coverage report
+  report_all
+}
+
+main "$@"
+
+
```

**File**: `volo-grpc/Cargo.toml` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-grpc"
-version = "0.11.7"
+version = "0.11.8"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
@@ -53,6 +53,7 @@ hyper-util = { workspace = true, features = [
   "server",
   "http2",
 ] }
+linkedbytes.workspace = true
 matchit.workspace = true
 paste.workspace = true
 percent-encoding.workspace = true
```

**File**: `volo-grpc/src/codec/compression.rs` (modified, +15/-18)
```diff
@@ -12,7 +12,6 @@ use flate2::bufread::{GzDecoder, GzEncoder};
 #[cfg(feature = "zlib")]
 use flate2::bufread::{ZlibDecoder, ZlibEncoder};
 use http::HeaderValue;
-use pilota::LinkedBytes;
 
 use super::BUFFER_SIZE;
 #[cfg(feature = "compress")]
@@ -274,23 +273,23 @@ impl CompressionEncoding {
 /// Compress `len` bytes from `src_buf` into `dest_buf`.
 pub(crate) fn compress(
     encoding: CompressionEncoding,
-    src_buf: &mut LinkedBytes,
-    dest_buf: &mut LinkedBytes,
+    src_buf: &mut BytesMut,
+    dest_buf: &mut BytesMut,
 ) -> Result<(), io::Error> {
-    let len = src_buf.bytes().len();
+    let len = src_buf.len();
     let capacity = ((len / BUFFER_SIZE) + 1) * BUFFER_SIZE;
 
     dest_buf.reserve(capacity);
 
     match encoding {
         #[cfg(feature = "gzip")]
         CompressionEncoding::Gzip(Some(config)) => {
-            let mut gz_encoder = GzEncoder::new(&src_buf.bytes()[0..len], config.level);
+            let mut gz_encoder = GzEncoder::new(&src_buf[0..len], config.level);
             io::copy(&mut gz_encoder, &mut dest_buf.writer())?;
         }
         #[cfg(feature = "zlib")]
         CompressionEncoding::Zlib(Some(config)) => {
-            let mut zlib_encoder = ZlibEncoder::new(&src_buf.bytes()[0..len], config.level);
+            let mut zlib_encoder = ZlibEncoder::new(&src_buf[0..len], config.level);
             io::copy(&mut zlib_encoder, &mut dest_buf.writer())?;
         }
         #[cfg(feature = "zstd")]
@@ -302,13 +301,13 @@ pub(crate) fn compress(
                 level as i32
             };
             let mut zstd_encoder = zstd::Encoder::new(dest_buf.writer(), zstd_level)?;
-            io::copy(&mut &src_buf.bytes()[0..len], &mut zstd_encoder)?;
+            io::copy(&mut &src_buf[0..len], &mut zstd_encoder)?;
             zstd_encoder.finish()?;
         }
         _ => {}
     };
 
-    src_buf.bytes_mut().advance(len);
+    src_buf.advance(len);
     Ok(())
 }
 
@@ -349,8 +348,7 @@ pub(crate) fn decompress(
 
 #[cfg(test)]
 mod tests {
-    use bytes::BufMut;
-    use pilota::LinkedBytes;
+    use bytes::BytesMut;
 
     #[cfg(feature = "gzip")]
     use crate::codec::compression::GzipConfig;
@@ -367,11 +365,11 @@ mod tests {
 
     #[test]
     fn test_consistency_for_compression() {
-        let mut src = LinkedBytes::with_capacity(BUFFER_SIZE);
-        let mut compress_buf = LinkedBytes::new();
-        let mut de_data = LinkedBytes::with_capacity(BUFFER_SIZE);
+        let mut src = BytesMut::with_capacity(BUFFER_SIZE);
+        let mut compress_buf = BytesMut::new();
+        let mut de_data = BytesMut::with_capacity(BUFFER_SIZE);
         let test_data = &b"test compression"[..];
-        src.put(test_data);
+        src.extend_from_slice(test_data);
 
         let encodings = [
             #[cfg(feature = "gzip")]
@@ -390,11 +388,10 @@ mod tests {
         ];
 
         for encoding in encodings {
-            compress_buf.reset();
+            compress_buf.clear();
             compress(encoding, &mut src, &mut compress_buf).expect("compress failed:");
-            decompress(encoding, compress_buf.bytes_mut(), de_data.bytes_mut())
-                .expect("decompress failed:");
-            assert_eq!(test_data, de_data.bytes());
+            decompress(encoding, &mut compress_buf, &mut de_data).expect("decompress failed:");
+            assert_eq!(test_data, de_data.as_ref());
         }
     }
 }
```

**File**: `volo-grpc/src/codec/encode.rs` (modified, +201/-15)
```diff
@@ -1,6 +1,7 @@
 use bytes::{BufMut, Bytes};
 use futures::{Stream, StreamExt};
 use http_body::Frame;
+use linkedbytes::Node;
 use pilota::{LinkedBytes, pb::Message};
 
 use super::{DefaultEncoder, PREFIX_LEN};
@@ -21,47 +22,232 @@ where
     T: Message + 'static,
 {
     Box::pin(async_stream::stream! {
-        let mut buf = LinkedBytes::with_capacity(BUFFER_SIZE);
-        let mut compressed_buf= if compression_encoding.is_some() {
-            LinkedBytes::with_capacity(BUFFER_SIZE)
-        } else {
-           LinkedBytes::new()
-        };
-
         futures_util::pin_mut!(source);
 
         loop {
             match source.next().await {
                 Some(Ok(item)) => {
+                    let mut buf = LinkedBytes::with_capacity(BUFFER_SIZE);
+                    let mut compressed_buf = if compression_encoding.is_some() {
+                        LinkedBytes::with_capacity(BUFFER_SIZE)
+                    } else {
+                        LinkedBytes::new()
+                    };
+
                     buf.reserve(PREFIX_LEN);
                     unsafe {
                         buf.advance_mut(PREFIX_LEN);
                     }
+
                     let mut encoder=DefaultEncoder::default();
 
                     if let Some(config)=compression_encoding{
-                        compressed_buf.reset();
                         encoder.encode(item, &mut compressed_buf)
                             .map_err(|err| Status::internal(format!("Error encoding: {err}")))?;
-                        compress(config,&mut compressed_buf,&mut buf)
+                        compress(config,&mut compressed_buf.concat(), buf.bytes_mut())
                             .map_err(|err| Status::internal(format!("Error compressing: {err}")))?;
-                    }else{
+                    } else {
+                        buf.reserve(item.encoded_len());
                         encoder.encode(item, &mut buf)
                             .map_err(|err| Status::internal(format!("Error encoding: {err}")))?;
                     }
-                    let len = buf.bytes().len() - PREFIX_LEN;
+
+                    let len = buf.len() - PREFIX_LEN;
                     assert!(len <= u32::MAX as usize);
                     {
-                        let mut buf = &mut buf.bytes_mut()[..PREFIX_LEN];
-                        buf.put_u8(compression_encoding.is_some() as u8);
-                        buf.put_u32(len as u32);
+                        if let Some(node) = buf.get_list_mut(0) {
+                            match node {
+                                linkedbytes::Node::BytesMut(bytes_mut) => {
+                                    let mut dest = &mut bytes_mut[..PREFIX_LEN];
+                                    dest.put_u8(compression_encoding.is_some() as u8);
+                                    dest.put_u32(len as u32);
+                                }
+                                _ => unreachable!("reserve_node_idx is not a bytesmut"),
+                            };
+                        } else {
+                            let mut dest = &mut buf.bytes_mut()[..PREFIX_LEN];
+                            dest.put_u8(compression_encoding.is_some() as u8);
+                            dest.put_u32(len as u32);
+                        }
                     }
 
-                    yield Ok(Frame::data(buf.bytes_mut().split_to(len + PREFIX_LEN).freeze()));
+                    // send each node in linked bytes as a separate frame
+                    for node in buf.into_iter_list() {
+                        let bytes = match node {
+                            Node::Bytes(bytes) => bytes,
+                            Node::BytesMut(bytesmut) => bytesmut.freeze(),
+                            Node::FastStr(faststr) => faststr.into_bytes(),
+                        };
+                        if !bytes.is_empty() {
+                            yield Ok(Frame::data(bytes));
+                        }
+                    }
                 },
                 Some(Err(status)) => yield Err(status),
                 None => break,
             }
         }
     })
 }
+
+pub mod tests {
+
+    #[derive(Debug, Default, Clone, PartialEq)]
+    pub struct EchoRequest {
+        pub message: ::pilota::FastStr,
+    }
+    impl ::pilota::pb::Message for EchoRequest {
+        #[inline]
+        fn encoded_len(&self) -> usize {
+            ::pilota::pb::encoding::faststr::encoded_len(1, &self.message)
+        }
+
+        #[allow(unused_variables)]
+        fn encode_raw(&self, buf: &mut ::pilota::LinkedBytes) {
+            ::pilota::pb::encoding::faststr::encode(1, &self.message, buf);
+        }
+
+        #[allow(unused_variables)]
+        fn merge_field(
+            &mut self,
+            tag: u32,
+            wire_type: ::pilota::pb::encoding::WireType,
+            buf: &mut ::pilota::Bytes,
+            ctx: &mut ::pilota::pb::encoding::DecodeContext,
+        ) -> ::core::result::
```

---

### Incident Patch 14: `83f989cb` (2025-09-26)
**Commit Message**: fix(volo-grpc): don't need sync for BoxStream and encode

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -4295,7 +4295,7 @@ dependencies = [
 
 [[package]]
 name = "volo-grpc"
-version = "0.11.6"
+version = "0.11.7"
 dependencies = [
  "anyhow",
  "async-broadcast",
```

**File**: `volo-grpc/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-grpc"
-version = "0.11.6"
+version = "0.11.7"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

**File**: `volo-grpc/src/codec/encode.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ pub fn encode<T, S>(
     compression_encoding: Option<CompressionEncoding>,
 ) -> BoxStream<'static, Result<Frame<Bytes>, Status>>
 where
-    S: Stream<Item = Result<T, Status>> + Send + Sync + 'static,
+    S: Stream<Item = Result<T, Status>> + Send + 'static,
     T: Message + 'static,
 {
     Box::pin(async_stream::stream! {
```

**File**: `volo-grpc/src/lib.rs` (modified, +1/-2)
```diff
@@ -22,10 +22,9 @@ pub mod tracing;
 pub mod transport;
 
 pub type BoxError = Box<dyn std::error::Error + Send + Sync>;
-pub type BoxStream<'l, T> = std::pin::Pin<Box<dyn futures::Stream<Item = T> + Send + Sync + 'l>>;
-
 pub use client::Client;
 pub use codec::decode::RecvStream;
+pub use futures::stream::BoxStream;
 pub use message::{RecvEntryMessage, SendEntryMessage};
 pub use request::{IntoRequest, IntoStreamingRequest, Request};
 pub use response::Response;
```

---

### Incident Patch 15: `eecfc6e5` (2025-09-08)
**Commit Message**: Fix/custom options (#623)

* fix(volo-build): process the pilota.rust_wrapper_arc annotation for thrift server lib init codegen

* fix(volo-build): adapt to pilota-build for pb custom options

* chore: update pilota

**File**: `Cargo.lock` (modified, +92/-75)
```diff
@@ -359,9 +359,9 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.2.35"
+version = "1.2.36"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "590f9024a68a8c40351881787f1934dc11afd69090f5edb6831464694d836ea3"
+checksum = "5252b3d2648e5eedbc1a6f501e3c795e07025c1e93bbf8bbdd6eef7f447a6d54"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
@@ -399,7 +399,7 @@ dependencies = [
  "android-tzdata",
  "iana-time-zone",
  "num-traits",
- "windows-link",
+ "windows-link 0.1.3",
 ]
 
 [[package]]
@@ -415,19 +415,19 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.5.46"
+version = "4.5.47"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2c5e4fcf9c21d2e544ca1ee9d8552de13019a42aa7dbf32747fa7aaf1df76e57"
+checksum = "7eac00902d9d136acd712710d71823fb8ac8004ca445a89e73a41d45aa712931"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.5.46"
+version = "4.5.47"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fecb53a0e6fcfb055f686001bc2e2592fa527efaf38dbe81a6a9563562e57d41"
+checksum = "2ad9bbf750e73b5884fb8a211a9424a1906c1e156724260fdae972f31d70e1d6"
 dependencies = [
  "anstream",
  "anstyle",
@@ -438,9 +438,9 @@ dependencies = [
 
 [[package]]
 name = "clap_derive"
-version = "4.5.45"
+version = "4.5.47"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "14cb31bb0a7d536caef2639baa7fad459e15c3144efefa6dbd1c84562c4739f6"
+checksum = "bbfd7eae0b0f1a6e63d4b13c9c478de77c2eb546fba158ad50b4203dc24b9f9c"
 dependencies = [
  "heck",
  "proc-macro2",
@@ -695,7 +695,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.0",
 ]
 
 [[package]]
@@ -869,9 +869,9 @@ dependencies = [
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e178e4fba8a2726903f6ba98a6d221e76f9c12c650d5dc0e6afdc50677b49650"
+checksum = "7fd99930f64d146689264c637b5af2f0233a933bef0d8570e2526bf9e083192d"
 
 [[package]]
 name = "fixedbitset"
@@ -1089,7 +1089,7 @@ dependencies = [
  "js-sys",
  "libc",
  "r-efi",
- "wasi 0.14.3+wasi-0.2.4",
+ "wasi 0.14.4+wasi-0.2.4",
  "wasm-bindgen",
 ]
 
@@ -1658,9 +1658,9 @@ dependencies = [
 
 [[package]]
 name = "js-sys"
-version = "0.3.77"
+version = "0.3.78"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1cfaf33c695fc6e08064efbc1f72ec937429614f25eef83af942d0e227c3a28f"
+checksum = "0c0b063578492ceec17683ef2f8c5e89121fbd0b172cbc280635ab7567db2738"
 dependencies = [
  "once_cell",
  "wasm-bindgen",
@@ -1781,9 +1781,9 @@ dependencies = [
 
 [[package]]
 name = "log"
-version = "0.4.27"
+version = "0.4.28"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "13dc2df351e3202783a1fe0d44375f7295ffb4049267b0f3018346dc122a1d94"
+checksum = "34080505efa8e45a4b816c349525ebe327ceaa8559756f0356cba97ef3bf7432"
 
 [[package]]
 name = "loom"
@@ -2361,9 +2361,9 @@ dependencies = [
 
 [[package]]
 name = "pilota"
-version = "0.12.2"
+version = "0.12.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5e235d8bd36b9c1846bd9f944faee3060d53519abe555b5b64155e87886b3fe2"
+checksum = "9a89d1987392f07bf54b6851a9693a44288a950ba08f46939e1fda0577d0b88d"
 dependencies = [
  "ahash",
  "anyhow",
@@ -2384,9 +2384,9 @@ dependencies = [
 
 [[package]]
 name = "pilota-build"
-version = "0.12.13"
+version = "0.12.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e2b11e0e6013cd06488ef0e48a6d334b3ba4ffa9fc09692e897a68898f8cb5cc"
+checksum = "a8df9fefd426a915841d575394cc32710c17133acca5a0179d90006fb9c32e9f"
 dependencies = [
  "ahash",
  "anyhow",
@@ -2422,16 +2422,17 @@ dependencies = [
 
 [[package]]
 name = "pilota-thrift-fieldmask"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6308306be67d4bff638618873a70918bbf1383c1bff13acc530795ded89cdacc"
+checksum = "5e33211f367fe0d29ef7df90782fb0f2c459a0d8e560230280de199954aa1c41"
 dependencies = [
  "ahash",
  "faststr",
  "nom 7.1.3",
  "pilota",
  "pilota-thrift-parser",
  "pilota-thrift-reflect",
+ "serde",
  "thiserror 2.0.16",
 ]
 
@@ -2831,9 +2832,9 @@ dependencies = [
 
 [[package]]
 name = "raw-cpuid"
-version = "11.5.0"
+version = "11.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c6df7ab838ed27997ba19a4664507e6f82b41fe6e20be42929332156e5e85146"
+checksum = "498cd0dc59d73224351ee52a95fee0f1a617a2eae0e7d9d720cc622c73a54186"
 dependencies = [
  "bitflags",
 ]
@@ -3241,9 +3242,9 @@ dependencies = [
 
 [[package]]
 name = "security-framework-sys"
-version = "2.14.0"
+version = "2.15.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "49db231d56a190491cb4aeda9527f1ad45345af50b0851622a7adb8c03b01c32"
+check
```

**File**: `volo-build/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-build"
-version = "0.11.4"
+version = "0.11.5"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

**File**: `volo-build/src/grpc_backend.rs` (modified, +12/-2)
```diff
@@ -809,7 +809,17 @@ impl CodegenBackend for VoloGrpcBackend {
             .codegen_file_descriptor_at_mod(stream, f, mod_path, has_direct)
     }
 
-    fn codegen_exts(&self, stream: &mut String, extensions: &[rir::Extension]) {
-        self.inner.codegen_exts(stream, extensions)
+    fn codegen_exts(
+        &self,
+        stream: &mut String,
+        suffix: &str,
+        cur_pkg: &[Symbol],
+        extensions: &[rir::Extension],
+    ) {
+        self.inner.codegen_exts(stream, suffix, cur_pkg, extensions)
+    }
+
+    fn codegen_impl_enum_message(&self, name: &str) -> String {
+        self.inner.codegen_impl_enum_message(name)
     }
 }
```

**File**: `volo-build/src/thrift_backend.rs` (modified, +10/-0)
```diff
@@ -819,6 +819,16 @@ impl pilota_build::CodegenBackend for VoloThriftBackend {
                     .inner
                     .codegen_item_ty(a.ty.kind.clone())
                     .global_path("volo_gen");
+                let ty = if let Some(RustWrapperArc(true)) = self
+                    .cx()
+                    .tags(a.tags_id)
+                    .as_ref()
+                    .and_then(|tags| tags.get::<RustWrapperArc>())
+                {
+                    format!("::std::sync::Arc<{ty}>")
+                } else {
+                    ty.to_string()
+                };
                 let ident = self.cx().rust_name(a.def_id).0.field_ident(); // use the _{rust-style fieldname} without keyword escaping
                 format!("_{ident}: {ty}")
             })
```

**File**: `volo-cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "volo-cli"
-version = "0.11.2"
+version = "0.11.3"
 edition.workspace = true
 homepage.workspace = true
 repository.workspace = true
```

#### Recent Merged Pull Requests:
- **PR #674** (2026-09-28): fix(volo-thrift): create spans before constructing futures (@shenyj3)
- **PR #671** (2026-09-30): fix(volo-build): gate multiservice binary codec behind unsafe-codec (@shenyj3)
- **PR #666** (2026-08-18): chore(volo-http): release 0.5.6 (@junliurs)
- **PR #664** (2026-08-13): fix(volo-build): use parentheses for format! macros (@junliurs)
- **PR #663** (2026-08-17): fix(volo-http): return reusable HTTP/1 connections from the driver (@junliurs)
- **PR #661** (closed): fix(volo-http): wait for HTTP/1 readiness to enable connection reuse (@junliurs)
- **PR #660** (2026-07-30): perf(volo-thrift): reset encode buffer right after flush (@junliurs)
- **PR #659** (closed): feat(volo-build): add option to preserve idl field names (@Joshuahoky)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
