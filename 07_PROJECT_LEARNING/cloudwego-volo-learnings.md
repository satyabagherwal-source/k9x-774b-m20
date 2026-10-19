> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cloudwego-volo-learnings.md`  
> **Source**: github ([https://github.com/cloudwego/volo](https://github.com/cloudwego/volo))  
> **Source Version**: `26ea87de`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:40:19.054Z  
> **Learning ID**: `learn-github-cloudwego-volo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cloudwego/volo

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloudwego-volo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cloudwego/volo](https://github.com/cloudwego/volo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T04:40:19.047Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cloudwego/volo`
- **Description**: Rust RPC framework with high-performance and strong-extensibility for building micro-services.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2633 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #675** (2026-10-16): **feat(volo-http): track matched route patterns**
  *Symptoms*: <!-- Thank you for your Pull Request. Please provide a description above and review the requirements below.  Bug fixes and new features should include tests.  Contributors guide: https://github.com/cloudwego/volo/blob/main/CONTRIBUTING.md -->  ## Motivation Currently, requests use the raw URL path for logging and metrics, which can lead to high cardinality when paths contain dynamic parameters.  For example, requests to /users/123 and /users/456 should be associated with the same route pattern, /users/{id}. <!-- Explain the context and why you're making that change. What is the problem you're trying to solve? If a new feature is being added, describe the intended use case that feature fulfills. -->  ## Solution This change adds MatchedPath to identify requests by their registered route patterns instead. <!-- Summarize the solution and provide any necessary context needed to understand the code change. --> 

- **Issue #674** (2026-09-28): **fix(volo-thrift): create spans before constructing futures**
  *Symptoms*: ## Motivation  The ping-pong server can perform avoidable large memory copies while constructing the future for each decoded request. This becomes expensive when the concrete service/middleware stack produces a large future and the span hook remains a potentially unwinding call after optimization.  The relevant code is in `volo-thrift/src/transport/pingpong/server.rs`:  ```rust // Before, simplified: tracing_cx was obtained through an unsafe transmute. let result = async {     // Handle the request, await the service, and encode the response. } .instrument(span_provider.on_serve(tracing_cx)) .await; ```  ### How the copies arise  1. The method-call receiver is evaluated before its argument. Therefore, the `async { ... }` future is constructed before `on_serve(...)` is called. Its captured values are already part of that future, even though its body has not been polled yet. See the Rust Reference on [operand evaluation order](https://doc.rust-lang.org/reference/expressions.html#evaluation-order-of-operands) and [async blocks](https://doc.rust-lang.org/reference/expressions/block-expr.html#async-blocks). 2. The request future needs storage for the states it can enter later, including the service future held across `service.call(...).await`. A large nested service future can consequently make the enclosing request future large, even though those later states are not active during construction. 3. If `on_serve` unwinds, the already-constructed temporary request future must be dro

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

### Incident Patch 1: `6220d5ba` (2026-03-03)
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

### Incident Patch 2: `37cf3ed1` (2026-03-03)
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

### Incident Patch 3: `21bb99fc` (2025-11-12)
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

#### Recent Merged Pull Requests:
- **PR #675** (2026-10-16): feat(volo-http): track matched route patterns (@Joshuahoky)
- **PR #674** (2026-09-28): fix(volo-thrift): create spans before constructing futures (@shenyj3)
- **PR #671** (2026-09-30): fix(volo-build): gate multiservice binary codec behind unsafe-codec (@shenyj3)
- **PR #666** (2026-08-18): chore(volo-http): release 0.5.6 (@junliurs)
- **PR #664** (2026-08-13): fix(volo-build): use parentheses for format! macros (@junliurs)
- **PR #663** (2026-08-17): fix(volo-http): return reusable HTTP/1 connections from the driver (@junliurs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
