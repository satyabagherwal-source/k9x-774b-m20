# Forensic Learning Record (Deep Inspection): grpc/grpc-rust

> **Canonical Artifact**: `07_PROJECT_LEARNING/grpc-grpc-rust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/grpc/grpc-rust](https://github.com/grpc/grpc-rust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:07.753Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `grpc/grpc-rust`
- **Description**: A native gRPC client & server implementation with async/await support.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12485 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `codegen/src/main.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

use std::{
    fs::File,
    io::{BufWriter, Write as _},
    path::{Path, PathBuf},
    time::Instant,
};

use protox::prost::Message as _;
use quote::quote;
use tonic_prost_build::FileDescriptorSet;

fn main() {
    println!("Running codegen...");

    let start = Instant::now();

    // tonic-health
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-health"),
        &["proto/health.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/grpc_health_v1_fds.rs"),
        true,
        true,
    );

    // tonic-reflection
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-reflection"),
        &["proto/reflection_v1.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/reflection_v1_fds.rs"),
        true,
        true,
    );
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-reflection"),
        &["proto/reflection_v1alpha.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/reflection_v1alpha1_fds.rs"),
        true,
        true,
    );

    // tonic-types
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tonic-types"),
        &["proto/status.proto", "proto/error_details.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/types_fds.rs"),
        false,
        false,
    );

    // grpc
    codegen(
        &PathBuf::from(std::env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("grpc"),
        &["proto/echo/echo.proto"],
        &["proto"],
        &PathBuf::from("src/generated"),
        &PathBuf::from("src/generated/echo_fds.rs"),
        true,
        true,
    );

    println!("Codgen completed: {}ms", start.elapsed().as_millis());
}

fn codegen(
    root_dir: &Path,
    iface_files: &[&str],
    include_dirs: &[&str],
    out_dir: &Path,
    file_descriptor_set_path: &Path,
    build_client: bool,
    build_server: bool,
) {
    let tempdir = tempfile::Builder::new()
        .prefix("tonic-codegen-")
        .tempdir()
        .unwrap();

    let iface_files = iface_files.iter().map(|&path| root_dir.join(path));
    let include_dirs = include_dirs.iter().map(|&path| root_dir.join(path));
    let out_dir = root_dir.join(out_dir);
    let file_descriptor_set_path = root_dir.join(file_descriptor_set_path);

    let fds = protox::compile(iface_files, include_dirs).unwrap();

    write_fds(&fds, &file_descriptor_set_path);

    tonic_prost_build::configure()
        .build_client(build_client)
        .build_server(build_server)
        .build_transport(false)
        .out_dir(&tempdir)
        .compile_fds(fds)
        .unwrap();

    for path in std::fs::read_dir(tempdir.path()).unwrap() {
        let path = path.unwrap().path();
        let to = out_dir.join(
            path.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .strip_suffix(".rs")
                .unwrap()
                .replace('.', "_")
                + ".rs",
        );
        std::fs::copy(&path, &to).unwrap();
    }
}

fn write_fds(fds: &FileDescriptorSet, path: &Path) {
    const GENERATED_COMMENT: &str = "// This file is @generated by codegen.";

    let mut file_header = String::new();

    let mut fds = fds.clone();

    for fd in fds.file.iter() {
        let Some(source_code_info) = &fd.source_code_info else {
            continue;
        };

        for location in &source_code_info.location {
            for comment in &location.leading_detached_comments {
                file_header += comment;
            }
        }
    }

    for fd in fds.file.iter_mut() {
        fd.source_code_info = None;
    }

    let fds_raw = fds.encode_to_vec();
    let tokens = quote! {
        /// Byte encoded FILE_DESCRIPTOR_SET.
        pub const FILE_DESCRIPTOR_SET: &[u8] = &[#(#fds_raw),*];
    };
    let ast = syn::parse2(tokens).unwrap();
    let formatted = prettyplease::unparse(&ast);

    let mut writer = BufWriter::new(File::create(path).unwrap());

    writer.write_all(GENERATED_COMMENT.as_bytes()).unwrap();
    writer.write_all(b"\n").unwrap();

    if !file_header.is_empty() {
        let file_header = comment_out(&file_header);
        writer.write_all(file_header.as_bytes()).unwrap();
        writer.write_all(b"\n").unwrap();
    }

    writer.write_all(formatted.as_bytes()).unwrap()
}

fn comment_out(s: &str) -> String {
    s.split('\n')
        .map(|line| format!("// {line}"))
        .collect::<Vec<String>>()
        .join("\n")
}

```

### Core Architecture Module: `examples/generated/helloworld/generated.rs`
```
#[path = "helloworld.u.pb.rs"]
#[allow(nonstandard_style, unused, unreachable_pub)]
#[doc(hidden)]
mod internal_do_not_use_helloworld;
#[allow(nonstandard_style, unused)]
#[doc(inline)]
pub use internal_do_not_use_helloworld::*;
#[allow(nonstandard_style, unused)]
pub mod __unstable {
    pub static HELLOWORLD_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
        descriptor: b"\n\x10helloworld.proto\x12\nhelloworld\"\x1c\n\x0cHelloRequest\x12\x0c\n\x04name\x18\x01 \x01(\t\"\x1d\n\nHelloReply\x12\x0f\n\x07message\x18\x01 \x01(\t2I\n\x07Greeter\x12>\n\x08SayHello\x12\x18.helloworld.HelloRequest\x1a\x16.helloworld.HelloReply\"\x00\x42\x30\n\x1bio.grpc.examples.helloworldB\x0fHelloWorldProtoP\x01\x62\x06proto3",
        deps: &[],
    };
}

```

### Core Architecture Module: `examples/generated/helloworld/helloworld.u.pb.rs`
```
const _: () = ::protobuf::__internal::assert_compatible_gencode_version(
    "4.35.1-release",
);
pub(crate) static mut helloworld__HelloRequest_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr = ::protobuf::__internal::runtime::MiniTableInitPtr(
    ::protobuf::__internal::runtime::MiniTablePtr::dangling(),
);
#[allow(non_camel_case_types)]
pub struct HelloRequest {
    inner: ::protobuf::__internal::runtime::OwnedMessageInner<HelloRequest>,
}
impl ::protobuf::Message for HelloRequest {
    type MessageView<'msg> = HelloRequestView<'msg>;
    type MessageMut<'msg> = HelloRequestMut<'msg>;
}
impl ::std::default::Default for HelloRequest {
    fn default() -> Self {
        Self::new()
    }
}
impl ::std::fmt::Debug for HelloRequest {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
unsafe impl ::std::marker::Sync for HelloRequest {}
unsafe impl ::std::marker::Send for HelloRequest {}
impl ::protobuf::Proxied for HelloRequest {
    type View<'msg> = HelloRequestView<'msg>;
}
impl ::protobuf::__internal::SealedInternal for HelloRequest {}
impl ::protobuf::MutProxied for HelloRequest {
    type Mut<'msg> = HelloRequestMut<'msg>;
}
#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct HelloRequestView<'msg> {
    inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for HelloRequestView<'msg> {}
impl<'msg> ::protobuf::MessageView<'msg> for HelloRequestView<'msg> {
    type Message = HelloRequest;
}
impl ::std::fmt::Debug for HelloRequestView<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl ::std::default::Default for HelloRequestView<'_> {
    fn default() -> HelloRequestView<'static> {
        ::protobuf::__internal::runtime::MessageViewInner::default().into()
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>>
for HelloRequestView<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, HelloRequest>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> HelloRequestView<'msg> {
    pub fn to_owned(&self) -> HelloRequest {
        ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
    }
    pub fn name(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_unchecked(unsafe { str_view.as_ref() })
    }
}
unsafe impl ::std::marker::Sync for HelloRequestView<'_> {}
unsafe impl ::std::marker::Send for HelloRequestView<'_> {}
impl<'msg> ::protobuf::AsView for HelloRequestView<'msg> {
    type Proxied = HelloRequest;
    fn as_view(&self) -> ::protobuf::View<'msg, HelloRequest> {
        *self
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for HelloRequestView<'msg> {
    fn into_view<'shorter>(self) -> HelloRequestView<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
impl<'msg> ::protobuf::IntoProxied<HelloRequest> for HelloRequestView<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> HelloRequest {
        let mut dst = HelloRequest::new();
        assert!(
            unsafe { dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena()) }
        );
        dst
    }
}
impl<'msg> ::protobuf::IntoProxied<HelloRequest> for HelloRequestMut<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> HelloRequest {
        ::protobuf::IntoProxied::into_proxied(
            ::protobuf::IntoView::into_view(self),
            _private,
        )
    }
}
impl ::protobuf::__internal::EntityType for HelloRequest {
    type Tag = ::protobuf::__internal::entity_tag::MessageTag;
}
impl<'msg> ::protobuf::__internal::EntityType for HelloRequestView<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::ViewProxyTag;
}
impl<'msg> ::protobuf::__internal::EntityType for HelloRequestMut<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::MutProxyTag;
}
#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct HelloRequestMut<'msg> {
    inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for HelloRequestMut<'msg> {}
impl<'msg> ::protobuf::MessageMut<'msg> for HelloRequestMut<'msg> {
    type Message = HelloRequest;
}
impl ::std::fmt::Debug for HelloRequestMut<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>>
for HelloRequestMut<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> HelloRequestMut<'msg> {
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'msg, HelloRequest> {
        self.inner.reborrow()
    }
    pub fn to_owned(&self) -> HelloRequest {
        ::protobuf::AsView::as_view(self).to_owned()
    }
    pub fn name(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_unchecked(unsafe { str_view.as_ref() })
    }
    pub fn set_name(
        &mut self,
        val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>,
    ) {
        unsafe {
            ::protobuf::__internal::runtime::message_set_string_field(
                ::protobuf::AsMut::as_mut(self).inner,
                0,
                val,
            );
        }
    }
}
unsafe impl ::std::marker::Send for HelloRequestMut<'_> {}
unsafe impl ::std::marker::Sync for HelloRequestMut<'_> {}
impl<'msg> ::protobuf::AsView for HelloRequestMut<'msg> {
    type Proxied = HelloRequest;
    fn as_view(&self) -> ::protobuf::View<'_, HelloRequest> {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for HelloRequestMut<'msg> {
    fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, HelloRequest>
    where
        'msg: 'shorter,
    {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::AsMut for HelloRequestMut<'msg> {
    type MutProxied = HelloRequest;
    fn as_mut(&mut self) -> HelloRequestMut<'msg> {
        self.inner.reborrow().into()
    }
}
impl<'msg> ::protobuf::IntoMut<'msg> for HelloRequestMut<'msg> {
    fn into_mut<'shorter>(self) -> HelloRequestMut<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
#[allow(dead_code)]
impl HelloRequest {
    pub fn new() -> Self {
        Self {
            inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new(),
        }
    }
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'_, HelloRequest> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
    }
    pub fn as_view(&self) -> HelloRequestView<'_> {
        ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner)
            .into()
    }
    pub fn as_mut(&mut self) -> HelloRequestMut<'_> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
            .into()
    }
    pub fn name(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
        let str_view = unsafe { self.inner.ptr().get_string_at_index(0, (b"").into()) };
        ::protobuf::ProtoStr::from_utf8_u
```

### Core Architecture Module: `examples/generated/helloworld/helloworld_grpc.pb.rs`
```
/// Generated client implementations.
pub mod greeter_client {
    #![allow(unused_imports, dead_code, missing_docs, clippy::wildcard_imports)]
    use grpc::client::*;
    use grpc_protobuf::*;
    use grpc_protobuf::client::*;
    /// The greeting service definition.
    #[derive(Debug, Clone)]
    pub struct GreeterClient<T> {
        channel: T,
    }
    impl<T> GreeterClient<T>
    where
        T: grpc::client::Invoke,
    {
        pub fn new(channel: T) -> Self {
            Self { channel }
        }
        /// Sends a greeting
        pub fn say_hello<ReqMsgView>(
            &self,
            request: ReqMsgView,
        ) -> UnaryCallBuilder<'_, &T, ReqMsgView, super::HelloReply>
        where
            ReqMsgView: protobuf::AsView<Proxied = super::HelloRequest> + Send + Sync,
        {
            UnaryCallBuilder::new(&self.channel, "/helloworld.Greeter/SayHello", request)
        }
    }
}

```

### Core Architecture Module: `examples/generated/routeguide/generated.rs`
```
#[path = "route_guide.u.pb.rs"]
#[allow(nonstandard_style, unused, unreachable_pub)]
#[doc(hidden)]
mod internal_do_not_use_route__guide;
#[allow(nonstandard_style, unused)]
#[doc(inline)]
pub use internal_do_not_use_route__guide::*;
#[allow(nonstandard_style, unused)]
pub mod __unstable {
    pub static ROUTE_GUIDE_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
        descriptor: b"\n\x11route_guide.proto\x12\nrouteguide\",\n\x05Point\x12\x10\n\x08latitude\x18\x01 \x01(\x05\x12\x11\n\tlongitude\x18\x02 \x01(\x05\"I\n\tRectangle\x12\x1d\n\x02lo\x18\x01 \x01(\x0b\x32\x11.routeguide.Point\x12\x1d\n\x02hi\x18\x02 \x01(\x0b\x32\x11.routeguide.Point\"<\n\x07\x46\x65\x61ture\x12\x0c\n\x04name\x18\x01 \x01(\t\x12#\n\x08location\x18\x02 \x01(\x0b\x32\x11.routeguide.Point\"A\n\tRouteNote\x12#\n\x08location\x18\x01 \x01(\x0b\x32\x11.routeguide.Point\x12\x0f\n\x07message\x18\x02 \x01(\t\"b\n\x0cRouteSummary\x12\x13\n\x0bpoint_count\x18\x01 \x01(\x05\x12\x15\n\rfeature_count\x18\x02 \x01(\x05\x12\x10\n\x08\x64istance\x18\x03 \x01(\x05\x12\x14\n\x0c\x65lapsed_time\x18\x04 \x01(\x05\x32\x85\x02\n\nRouteGuide\x12\x36\n\nGetFeature\x12\x11.routeguide.Point\x1a\x13.routeguide.Feature\"\x00\x12>\n\x0cListFeatures\x12\x15.routeguide.Rectangle\x1a\x13.routeguide.Feature\"\x00\x30\x01\x12>\n\x0bRecordRoute\x12\x11.routeguide.Point\x1a\x18.routeguide.RouteSummary\"\x00(\x01\x12?\n\tRouteChat\x12\x15.routeguide.RouteNote\x1a\x15.routeguide.RouteNote\"\x00(\x01\x30\x01\x42\x30\n\x1bio.grpc.examples.routeguideB\x0fRouteGuideProtoP\x01\x62\x06proto3",
        deps: &[],
    };
}

```

### Core Architecture Module: `examples/generated/routeguide/route_guide.u.pb.rs`
```
const _: () = ::protobuf::__internal::assert_compatible_gencode_version(
    "4.35.1-release",
);
pub(crate) static mut routeguide__Point_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr = ::protobuf::__internal::runtime::MiniTableInitPtr(
    ::protobuf::__internal::runtime::MiniTablePtr::dangling(),
);
#[allow(non_camel_case_types)]
pub struct Point {
    inner: ::protobuf::__internal::runtime::OwnedMessageInner<Point>,
}
impl ::protobuf::Message for Point {
    type MessageView<'msg> = PointView<'msg>;
    type MessageMut<'msg> = PointMut<'msg>;
}
impl ::std::default::Default for Point {
    fn default() -> Self {
        Self::new()
    }
}
impl ::std::fmt::Debug for Point {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
unsafe impl ::std::marker::Sync for Point {}
unsafe impl ::std::marker::Send for Point {}
impl ::protobuf::Proxied for Point {
    type View<'msg> = PointView<'msg>;
}
impl ::protobuf::__internal::SealedInternal for Point {}
impl ::protobuf::MutProxied for Point {
    type Mut<'msg> = PointMut<'msg>;
}
#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct PointView<'msg> {
    inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, Point>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for PointView<'msg> {}
impl<'msg> ::protobuf::MessageView<'msg> for PointView<'msg> {
    type Message = Point;
}
impl ::std::fmt::Debug for PointView<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl ::std::default::Default for PointView<'_> {
    fn default() -> PointView<'static> {
        ::protobuf::__internal::runtime::MessageViewInner::default().into()
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, Point>>
for PointView<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, Point>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> PointView<'msg> {
    pub fn to_owned(&self) -> Point {
        ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
    }
    pub fn latitude(self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(0, (0i32).into()).try_into().unwrap()
        }
    }
    pub fn longitude(self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(1, (0i32).into()).try_into().unwrap()
        }
    }
}
unsafe impl ::std::marker::Sync for PointView<'_> {}
unsafe impl ::std::marker::Send for PointView<'_> {}
impl<'msg> ::protobuf::AsView for PointView<'msg> {
    type Proxied = Point;
    fn as_view(&self) -> ::protobuf::View<'msg, Point> {
        *self
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for PointView<'msg> {
    fn into_view<'shorter>(self) -> PointView<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
impl<'msg> ::protobuf::IntoProxied<Point> for PointView<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> Point {
        let mut dst = Point::new();
        assert!(
            unsafe { dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena()) }
        );
        dst
    }
}
impl<'msg> ::protobuf::IntoProxied<Point> for PointMut<'msg> {
    fn into_proxied(self, _private: ::protobuf::__internal::Private) -> Point {
        ::protobuf::IntoProxied::into_proxied(
            ::protobuf::IntoView::into_view(self),
            _private,
        )
    }
}
impl ::protobuf::__internal::EntityType for Point {
    type Tag = ::protobuf::__internal::entity_tag::MessageTag;
}
impl<'msg> ::protobuf::__internal::EntityType for PointView<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::ViewProxyTag;
}
impl<'msg> ::protobuf::__internal::EntityType for PointMut<'msg> {
    type Tag = ::protobuf::__internal::entity_tag::MutProxyTag;
}
#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct PointMut<'msg> {
    inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, Point>,
}
impl<'msg> ::protobuf::__internal::SealedInternal for PointMut<'msg> {}
impl<'msg> ::protobuf::MessageMut<'msg> for PointMut<'msg> {
    type Message = Point;
}
impl ::std::fmt::Debug for PointMut<'_> {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
    }
}
impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, Point>>
for PointMut<'msg> {
    fn from(
        inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, Point>,
    ) -> Self {
        Self { inner }
    }
}
#[allow(dead_code)]
impl<'msg> PointMut<'msg> {
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'msg, Point> {
        self.inner.reborrow()
    }
    pub fn to_owned(&self) -> Point {
        ::protobuf::AsView::as_view(self).to_owned()
    }
    pub fn latitude(&self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(0, (0i32).into()).try_into().unwrap()
        }
    }
    pub fn set_latitude(&mut self, val: i32) {
        unsafe { self.inner.ptr_mut().set_base_field_i32_at_index(0, val.into()) }
    }
    pub fn longitude(&self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(1, (0i32).into()).try_into().unwrap()
        }
    }
    pub fn set_longitude(&mut self, val: i32) {
        unsafe { self.inner.ptr_mut().set_base_field_i32_at_index(1, val.into()) }
    }
}
unsafe impl ::std::marker::Send for PointMut<'_> {}
unsafe impl ::std::marker::Sync for PointMut<'_> {}
impl<'msg> ::protobuf::AsView for PointMut<'msg> {
    type Proxied = Point;
    fn as_view(&self) -> ::protobuf::View<'_, Point> {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::IntoView<'msg> for PointMut<'msg> {
    fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, Point>
    where
        'msg: 'shorter,
    {
        self.inner.as_view().into()
    }
}
impl<'msg> ::protobuf::AsMut for PointMut<'msg> {
    type MutProxied = Point;
    fn as_mut(&mut self) -> PointMut<'msg> {
        self.inner.reborrow().into()
    }
}
impl<'msg> ::protobuf::IntoMut<'msg> for PointMut<'msg> {
    fn into_mut<'shorter>(self) -> PointMut<'shorter>
    where
        'msg: 'shorter,
    {
        self
    }
}
#[allow(dead_code)]
impl Point {
    pub fn new() -> Self {
        Self {
            inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new(),
        }
    }
    #[doc(hidden)]
    pub fn as_message_mut_inner(
        &mut self,
        _private: ::protobuf::__internal::Private,
    ) -> ::protobuf::__internal::runtime::MessageMutInner<'_, Point> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
    }
    pub fn as_view(&self) -> PointView<'_> {
        ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner)
            .into()
    }
    pub fn as_mut(&mut self) -> PointMut<'_> {
        ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
            .into()
    }
    pub fn latitude(&self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(0, (0i32).into()).try_into().unwrap()
        }
    }
    pub fn set_latitude(&mut self, val: i32) {
        unsafe { self.inner.ptr_mut().set_base_field_i32_at_index(0, val.into()) }
    }
    pub fn longitude(&self) -> i32 {
        unsafe {
            self.inner.ptr().get_i32_at_index(1, (0i32).into()).try_into().unwrap()
        }
    }
    pub fn set_longitude(&mut self, val: i32) {
        unsafe { self.inner.ptr_mut().set_base_field_i32_at_index(1, val.into()) }
    }
}
impl ::std::ops::Drop for Point {
    #[inline]
    fn drop(&mut self) {}
}
i
```

### Core Architecture Module: `examples/generated/routeguide/route_guide_grpc.pb.rs`
```
/// Generated client implementations.
pub mod route_guide_client {
    #![allow(unused_imports, dead_code, missing_docs, clippy::wildcard_imports)]
    use grpc::client::*;
    use grpc_protobuf::*;
    use grpc_protobuf::client::*;
    /// Interface exported by the server.
    #[derive(Debug, Clone)]
    pub struct RouteGuideClient<T> {
        channel: T,
    }
    impl<T> RouteGuideClient<T>
    where
        T: grpc::client::Invoke,
    {
        pub fn new(channel: T) -> Self {
            Self { channel }
        }
        /// A simple RPC.
        ///
        /// Obtains the feature at a given position.
        ///
        /// A feature with an empty name is returned if there's no feature at the given
        /// position.
        pub fn get_feature<ReqMsgView>(
            &self,
            request: ReqMsgView,
        ) -> UnaryCallBuilder<'_, &T, ReqMsgView, super::Feature>
        where
            ReqMsgView: protobuf::AsView<Proxied = super::Point> + Send + Sync,
        {
            UnaryCallBuilder::new(
                &self.channel,
                "/routeguide.RouteGuide/GetFeature",
                request,
            )
        }
        /// A server-to-client streaming RPC.
        ///
        /// Obtains the Features available within the given Rectangle.  Results are
        /// streamed rather than returned at once (e.g. in a response message with a
        /// repeated field), as the rectangle may cover a large area and contain a
        /// huge number of features.
        pub fn list_features<ReqMsgView>(
            &self,
            request: ReqMsgView,
        ) -> ServerStreamingCallBuilder<'_, &T, ReqMsgView, super::Feature>
        where
            ReqMsgView: protobuf::AsView<Proxied = super::Rectangle> + Send + Sync,
        {
            ServerStreamingCallBuilder::new(
                &self.channel,
                "/routeguide.RouteGuide/ListFeatures",
                request,
            )
        }
        /// A client-to-server streaming RPC.
        ///
        /// Accepts a stream of Points on a route being traversed, returning a
        /// RouteSummary when traversal is completed.
        pub fn record_route(
            &self,
        ) -> ClientStreamingCallBuilder<'_, &T, super::Point, super::RouteSummary> {
            ClientStreamingCallBuilder::new(
                &self.channel,
                "/routeguide.RouteGuide/RecordRoute",
            )
        }
        /// A Bidirectional streaming RPC.
        ///
        /// Accepts a stream of RouteNotes sent while a route is being traversed,
        /// while receiving other RouteNotes (e.g. from other users).
        pub fn route_chat(
            &self,
        ) -> BidiCallBuilder<'_, &T, super::RouteNote, super::RouteNote> {
            BidiCallBuilder::new(&self.channel, "/routeguide.RouteGuide/RouteChat")
        }
    }
}
/// Generated server implementations.
pub mod route_guide_server {
    #![allow(unused_variables, dead_code, missing_docs, clippy::wildcard_imports)]
    mod method_wrappers {
        pub(super) struct GetFeature<T> {
            pub(super) service: std::sync::Arc<T>,
        }
        impl<T: super::RouteGuide> grpc_protobuf::server::UnaryMethod for GetFeature<T> {
            type Request = super::super::Point;
            type Response = super::super::Feature;
            async fn call(
                &self,
                request: <Self::Request as protobuf::Proxied>::View<'_>,
                response: <Self::Response as protobuf::MutProxied>::Mut<'_>,
            ) -> grpc_protobuf::ServerStatus {
                self.service.get_feature(request, response).await
            }
        }
        pub(super) struct ListFeatures<T> {
            pub(super) service: std::sync::Arc<T>,
        }
        impl<T: super::RouteGuide> grpc_protobuf::server::ServerStreamingMethod
        for ListFeatures<T> {
            type Request = super::super::Rectangle;
            type Response = super::super::Feature;
            async fn call(
                &self,
                request: <Self::Request as protobuf::Proxied>::View<'_>,
                responses: grpc_protobuf::server::GrpcStreamingResponse<
                    '_,
                    super::super::Feature,
                >,
            ) -> grpc_protobuf::ServerStatus {
                self.service.list_features(request, responses).await
            }
        }
        pub(super) struct RecordRoute<T> {
            pub(super) service: std::sync::Arc<T>,
        }
        impl<T: super::RouteGuide> grpc_protobuf::server::ClientStreamingMethod
        for RecordRoute<T> {
            type Request = super::super::Point;
            type Response = super::super::RouteSummary;
            async fn call(
                &self,
                requests: grpc_protobuf::server::GrpcStreamingRequest<
                    super::super::Point,
                >,
                response: <Self::Response as protobuf::MutProxied>::Mut<'_>,
            ) -> grpc_protobuf::ServerStatus {
                self.service.record_route(requests, response).await
            }
        }
        pub(super) struct RouteChat<T> {
            pub(super) service: std::sync::Arc<T>,
        }
        impl<T: super::RouteGuide> grpc_protobuf::server::BidiStreamingMethod
        for RouteChat<T> {
            type Request = super::super::RouteNote;
            type Response = super::super::RouteNote;
            async fn call(
                &self,
                requests: grpc_protobuf::server::GrpcStreamingRequest<
                    super::super::RouteNote,
                >,
                responses: grpc_protobuf::server::GrpcStreamingResponse<
                    '_,
                    super::super::RouteNote,
                >,
            ) -> grpc_protobuf::ServerStatus {
                self.service.route_chat(requests, responses).await
            }
        }
    }
    /// Generated trait containing gRPC methods that should be implemented for use with RouteGuideServer.
    #[grpc::async_trait]
    pub trait RouteGuide: std::marker::Send + std::marker::Sync + 'static {
        /// A simple RPC.
        ///
        /// Obtains the feature at a given position.
        ///
        /// A feature with an empty name is returned if there's no feature at the given
        /// position.
        async fn get_feature(
            &self,
            request: super::PointView<'_>,
            response: super::FeatureMut<'_>,
        ) -> grpc_protobuf::ServerStatus {
            Err(
                grpc_protobuf::ServerStatusError::new(
                    grpc_protobuf::StatusCodeError::Unimplemented,
                    "Not yet implemented",
                ),
            )
        }
        /// A server-to-client streaming RPC.
        ///
        /// Obtains the Features available within the given Rectangle.  Results are
        /// streamed rather than returned at once (e.g. in a response message with a
        /// repeated field), as the rectangle may cover a large area and contain a
        /// huge number of features.
        async fn list_features(
            &self,
            request: super::RectangleView<'_>,
            responses: grpc_protobuf::server::GrpcStreamingResponse<'_, super::Feature>,
        ) -> grpc_protobuf::ServerStatus {
            Err(
                grpc_protobuf::ServerStatusError::new(
                    grpc_protobuf::StatusCodeError::Unimplemented,
                    "Not yet implemented",
                ),
            )
        }
        /// A client-to-server streaming RPC.
        ///
        /// Accepts a stream of Points on a route being traversed, returning a
        /// RouteSummary when traversal is completed.
        async fn record_route(
            &self,
            request: grpc_protobuf::server::GrpcStreamingRequest<super::Point>,
            response: super::RouteSummaryMut<'_>,
        ) -> grpc_protobuf::ServerStatus {
            Err
```

### Core Architecture Module: `examples/src/authentication/client.rs`
```
/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */

pub mod pb {
    tonic::include_proto!("grpc.examples.unaryecho");
}

use pb::{EchoRequest, echo_client::EchoClient};
use tonic::{Request, metadata::MetadataValue, transport::Channel};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let channel = Channel::from_static("http://[::1]:50051").connect().await?;

    let token: MetadataValue<_> = "Bearer some-auth-token".parse()?;

    let mut client = EchoClient::with_interceptor(channel, move |mut req: Request<()>| {
        req.metadata_mut().insert("authorization", token.clone());
        Ok(req)
    });

    let request = tonic::Request::new(EchoRequest {
        message: "hello".into(),
    });

    let response = client.unary_echo(request).await?;

    println!("RESPONSE={response:?}");

    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2900** (2026-09-29): **grpc/lb: simplify and unify tests via new TestEnv**
  *Symptoms*: This change is pretty huge, but I'm not really sure how to break it up.  It unifies all the existing LB policy tests so they use the new `TestEnv`.  Maybe you can also use this for your priority policy tests?  Review-wise: it's probably best to start at test_utils.rs and look at the new stuff, then hopefully the tests themselves are pretty easy to skim since the transformations are mostly mechanical.

- **Issue #2898** (2026-09-30): **xds-client: Correct grpc.xds_client.connected metric lifecycle**
  *Symptoms*: As defined by gRFC A78: - Set grpc.xds_client.connected to 1 initially for the configured server. - When an ADS stream reconnects after failure, transition connected back to 1 upon receiving the first response on the new stream. - When the worker event loop exits, clear the connected gauge to 0 if it was currently marked healthy.  The tests needed parts of flow_control_tests, so it was integrated with the rest of the unit tests; there didn't seem to be a need for it to be a separate mod. The tests found a bug where command_tx was being held by AdsWorker::run(), and thus AdsWorker::run() would not exit.  ----  CC @W4lspirit 

- **Issue #2892** (2026-09-25): **grpc/service_config: fix flaky service_config tests caused by a test LB policy name collision**
  *Symptoms*: ## Problem  About 1 run in 8, a test in `client::service_config` fails. It can be `test_valid_service_config_parsing`, `test_lb_config_resolution` or `test_load_balancing_config_serde`, whichever loses the race:  >     thread 'client::service_config::serde_bindings::test::test_load_balancing_config_serde'     panicked at grpc/src/client/service_config/serde_bindings.rs:473:14:     called `Option::unwrap()` on a `None` value  Both tests define their own test LB policy and register it in `GLOBAL_LB_REGISTRY` under the same name, so the last test to register wins. The tests run in parallel, so one test can end up parsing its config with the other file's builder. The `builder.name()` assertion still passes because both names are the same. The test then panics on `downcast_ref::<TestPolicyConfig>().unwrap()`, because the parsed config is the other file's `TestPolicyConfig` type.  ## Fix  Give each test policy a name unique to its file.  While here, fix the "Invalid config for supported policy" case in `test_load_balancing_config_serde`. It used `"testPolicy"`, a name that was never registered, so it only ever failed as an unsupported policy and never tested an invalid config. It now uses the registered name, and the invalid config is what makes it fail.  ## Testing  - Before: `cargo test --lib service_config` in a loop failed within 2 runs. - After: 40 runs in a row passed, 12/12 tests each time. 

- **Issue #2891** (2026-09-28): **grpc/attributes: add remove API and inline persistent list**
  *Symptoms*: ## Why  An [upcoming PR](https://github.com/grpc/grpc-rust/compare/master...arjan-bal:config-selector?expand=1) will introduce a config selector that resolvers can send as an attribute in resolver updates. Because these config selectors can subscribe to resources (such as CDS in xDS channels), they must also unsubscribe to them when dropped.   However, because resolver updates are forwarded to the LB policy, which may retain a reference to the attributes, the config selector is prevented from being dropped. To prevent this lifetime extension, the channel must strip the config selector from the attributes before passing them to the LB policy.  ## Solution  This change  Introduces an API to remove a type from `Attributes`. The removal path partially reconstructs the internal linked list to clear references to shadowed items, allowing them to be safely dropped.  This change also merges the internal linked-list struct directly into the `Attributes` struct to simplify the implementation. 

- **Issue #2889** (2026-09-26): **Add a way to specify custom generated types**
  *Symptoms*: ## Feature Request  There should be a way to specify custom generated types like a custom `map` type or a custom `repeated` type.  ### Motivation  This allows way more flexible code generation and usage. Also, the built-in std hasher isn't that efficient and could be replaced with a custom one (like `rapidhash` or `ahash`).  ### Proposal  Add a function to the `Config` struct in `tonic-prost-build` like `custom_type(type_to_replace, custom_path)`.  ### Alternatives  A custom hasher function to specify a custom hasher.
  **Post-Mortem & Fix Analysis**:
  > It sounds like you are wanting to change the code generation for messages. That is not handled by this repo. This sounds like a feature request for `prost`.
  > Oh I'm sorry. I didn't even know there was a prost repo. Moving the issue then...

- **Issue #2888** (2026-09-25): **xds-client: Move stream worker to its own task**
  *Symptoms*: Move reading and writing on the ADS stream to a dedicated background task (run_stream_task), communicating with AdsWorker via an unbounded write channel and a bounded read channel. Because ADS flow control (ProcessingDone) in run_stream_task limits the number of notifications, handle_response() can send watcher notifications directly inline without PendingDispatch.  -----  This is part 3 of 3 of the series. (See #2881 for part 1, #2882 for part 2). This should help simplify #2836  CC @W4lspirit
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot for the refactor 🙇 

- **Issue #2887** (2026-09-25): **Make ParsedLbConfig available to load balancers, include child selection mechanism.**
  *Symptoms*: ## Motivation  Every LB Policy is currently needing to do it's own deserialization and selection. To do this, LBs also have to reach into the service config bindings, which breaks encapsulation. Further, this functionality is not available to downstream crates (i.e. `grpc-xds`).  ## Solution  Moves this to the following architecture: * `LbConfigJson` is a wrapper around `serde_json::Value`. This should allow us to change the underlying implementation in the future. This is made public so that LBs can use it in their child policy parsing. * `ParsedLbConfig` carries the mechanics to handle parsing the lb configurations. This includes both the case for the `ServiceConfig`, where it can evaluate to empty, and for the load balancers, where the child configurations must be present.   These are both public in the load balancing mod so that they can be utilized by load balancers in this or downstream crates. (Currently requires `__unstable`.)  ### Notes * This still leaks `serde` symbols, so downstream crates must take that as a dependency, which we had previously [wanted to avoid](https://github.com/grpc/grpc-rust/pull/2731#discussion_r3598470565) this. It should still allow us to change things in a non-breaking manner in the future, though, if we wanted to remove this leakage. 

- **Issue #2886** (2026-09-23): **chore(xds): bump crates to 0.1.0-alpha.4**
  *Symptoms*: ## Motivation  Ref: #2444  We are testing the `tonic-xds` and `xds-client` in a corporate environment. Needing to release a new alpha version first to be able to leverage the recently added A65 support.  ## Solution  Bump all xDS crates manifests to `0.1.0-alpha.4`. For now `crates.io` release is manual and will be done after this PR is merged.  

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

### Incident Patch 1: `46622e93` (2026-09-29)
**Commit Message**: fix(codec): eliminate uninitialized memory in encode_item on unwind (#2847)

## Motivation

Fixes https://github.com/grpc/grpc-rust/issues/2720.

In `tonic/src/codec/encode.rs`, `encode_item` previously advanced the
buffer's logical length by 5 bytes using `unsafe {
buf.advance_mut(HEADER_SIZE); }` before invoking the user-provided
`Encoder::encode`. If the encoder panicked or unwound, `buf` was left
with 5 uninitialized bytes exposed to callers catching unwinds.

## Solution

* Replace `unsafe { buf.advance_mut(HEADER_SIZE); }` with safe
zero-filled initialization via `buf.put_slice(&[0u8; HEADER_SIZE])`,
eliminating the `unsafe` block entirely.
* Writing 5 zero bytes into the cache line that is immediately
overwritten by `finish_encoding` incurs minimal performance impact (a
single store instruction).
* The alternative RAII drop guard approach was deliberately avoided
because it preserves `unsafe` code and could resurface the soundness
vulnerability if `std::mem::forget` (or a similar leak) were ever
introduced.
* Add unit test `encode_item_exception_safety_on_panic` verifying that
unwinding panics leave only initialized zero bytes in the buffer.

## Test Plan

- Ran `cargo test 

**File**: `tonic/src/codec/encode.rs` (modified, +54/-3)
```diff
@@ -172,9 +172,7 @@ where
     let offset = buf.len();
 
     buf.reserve(HEADER_SIZE);
-    unsafe {
-        buf.advance_mut(HEADER_SIZE);
-    }
+    buf.put_slice(&[0u8; HEADER_SIZE]);
 
     if let Some(encoding) = compression_encoding {
         uncompression_buf.clear();
@@ -399,3 +397,56 @@ where
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::panic::catch_unwind;
+
+    struct PanickingEncoder;
+
+    impl Encoder for PanickingEncoder {
+        type Item = String;
+        type Error = Status;
+
+        fn encode(
+            &mut self,
+            _item: Self::Item,
+            _dst: &mut EncodeBuf<'_>,
+        ) -> Result<(), Self::Error> {
+            panic!("encoder deliberate panic for testing exception safety");
+        }
+    }
+
+    #[test]
+    fn encode_item_exception_safety_on_panic() {
+        let mut encoder = PanickingEncoder;
+        let mut buf = BytesMut::new();
+        let mut uncompression_buf = BytesMut::new();
+
+        let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
+            encode_item(
+                &mut encoder,
+                &mut buf,
+                &mut uncompression_buf,
+                None,
+                None,
+                BufferSettings::default(),
+                "test".to_string(),
+            )
+        }));
+
+        assert!(result.is_err(), "Encoder panic should unwind correctly.");
+        // Buffer must only contain initialized bytes (5 zero bytes written by put_slice).
+        assert_eq!(
+            buf.len(),
+            HEADER_SIZE,
+            "Buffer length should reflect reserved header bytes."
+        );
+        assert_eq!(
+            &buf[..],
+            &[0u8; HEADER_SIZE],
+            "Buffer must contain only initialized zero bytes."
+        );
+    }
+}
```

---

### Incident Patch 2: `194f07e6` (2026-09-25)
**Commit Message**: grpc/service_config: fix flaky service_config tests caused by a test LB policy name collision (#2892)

## Problem

About 1 run in 8, a test in `client::service_config` fails. It can be
`test_valid_service_config_parsing`, `test_lb_config_resolution` or
`test_load_balancing_config_serde`, whichever loses the race:

>
thread
'client::service_config::serde_bindings::test::test_load_balancing_config_serde'
    panicked at grpc/src/client/service_config/serde_bindings.rs:473:14:
    called `Option::unwrap()` on a `None` value

Both tests define their own test LB policy and register it in
`GLOBAL_LB_REGISTRY` under the same name, so the last test to register
wins. The tests run in parallel, so one test can end up parsing its
config with the other file's builder. The `builder.name()` assertion
still passes because both names are the same. The test then panics on
`downcast_ref::<TestPolicyConfig>().unwrap()`, because the parsed config
is the other file's `TestPolicyConfig` type.

## Fix

Give each test policy a name unique to its file.

While here, fix the "Invalid config for supported policy" case in
`test_load_balancing_config_serde`. It used `"testPolicy"`, a name that
was never registe

**File**: `grpc/src/client/service_config/mod.rs` (modified, +5/-5)
```diff
@@ -123,7 +123,7 @@ mod test {
         }
 
         fn name(&self) -> &'static str {
-            "test_policy"
+            "service_config_test_policy"
         }
 
         fn parse_config(
@@ -170,7 +170,7 @@ mod test {
 
         let json_data = json!({
             "loadBalancingConfig": [
-                { "test_policy": { "testField": true } },
+                { "service_config_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ],
             "methodConfig": [
@@ -206,7 +206,7 @@ mod test {
 
         // Verify Load Balancing Config.
         let (builder, config) = sc.lb_config();
-        assert_eq!(builder.name(), "test_policy");
+        assert_eq!(builder.name(), "service_config_test_policy");
         let pf_config = config.downcast_ref::<TestPolicyConfig>().unwrap().clone();
         assert!(pf_config.test_field);
 
@@ -379,13 +379,13 @@ mod test {
         let json_data = json!({
             "loadBalancingConfig": [
                 { "unsupported_lb_policy": { "foo": "bar" } },
-                { "test_policy": { "testField": true } },
+                { "service_config_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ]
         });
         let sc = ServiceConfig::parse(&json_data.to_string()).unwrap();
         let (builder, config) = sc.lb_config();
-        assert_eq!(builder.name(), "test_policy");
+        assert_eq!(builder.name(), "service_config_test_policy");
         let pf_config = config.downcast_ref::<TestPolicyConfig>().unwrap().clone();
         assert!(pf_config.test_field);
 
```

**File**: `grpc/src/client/service_config/serde_bindings.rs` (modified, +7/-7)
```diff
@@ -357,7 +357,7 @@ mod test {
             }
 
             fn name(&self) -> &'static str {
-                "test_policy"
+                "serde_bindings_test_policy"
             }
 
             fn parse_config(
@@ -417,17 +417,17 @@ mod test {
         let selected = val.load_balancing_config.as_ref().unwrap();
         assert_eq!(selected.builder.name(), "round_robin");
 
-        // Multiple policies; picks first supported with parsed config (test_policy)
+        // Multiple policies; picks first supported with parsed config (serde_bindings_test_policy)
         let val: TestConfig = serde_json::from_value(json!({
             "loadBalancingConfig": [
                 { "unsupported_lb_1": { "key": "val" } },
-                { "test_policy": { "testField": true } },
+                { "serde_bindings_test_policy": { "testField": true } },
                 { "round_robin": {} }
             ]
         }))
         .unwrap();
         let selected = val.load_balancing_config.as_ref().unwrap();
-        assert_eq!(selected.builder.name(), "test_policy");
+        assert_eq!(selected.builder.name(), "serde_bindings_test_policy");
         let pf_cfg = selected
             .config
             .as_ref()
@@ -437,7 +437,7 @@ mod test {
 
         // Invalid config for supported policy fails deserialization
         let res: Result<TestConfig, _> = serde_json::from_value(json!({
-            "loadBalancingConfig": [{ "testPolicy": { "testField": "not_a_bool" } }]
+            "loadBalancingConfig": [{ "serde_bindings_test_policy": { "testField": "not_a_bool" } }]
         }));
         assert!(res.is_err());
 
@@ -470,14 +470,14 @@ mod test {
         // Multiple policies; trailing entries after first supported are ignored
         let val: TestConfig = serde_json::from_value(json!({
             "loadBalancingConfig": [
-                { "test_policy": { "testField": true } },
+                { "serde_bindings_test_policy": { "testField": true } },
                 { "unsupported": { "invalid": 123 }, "other": {} },
                 {}
             ]
         }))
         .unwrap();
         let selected = val.load_balancing_config.as_ref().unwrap();
-        assert_eq!(selected.builder.name(), "test_policy");
+        assert_eq!(selected.builder.name(), "serde_bindings_test_policy");
 
         // Invalid entry with multiple keys in single object -> Error
         let res: Result<TestConfig, _> = serde_json::from_value(json!({
```

---

### Incident Patch 3: `3a60b544` (2026-09-22)
**Commit Message**: tonic-xds: expose gRFC A29 cluster security parsing (#2876)

## Motivation

`ClusterTlsConfig` lets a custom connector reuse the crate's gRFC A29
handling instead of re-implementing SAN matching and chain validation.
The only way to get one is from `MakeConnector::make_connector`, since
it borrows the channel's cert-provider registry and has no public
constructor.

Code that runs its own ADS stream already holds the `Cluster` and the
certificate providers, but it never calls `make_connector`, so it cannot
get a `ClusterTlsConfig`. That leaves copying the A29 parsing, which is
about 1300 lines across `security.rs`, `san_matcher.rs` and
`string_matcher.rs`, all private to the crate.

## Solution

Make `ClusterSecurityConfig` public, with private fields and accessors.

`from_cluster_bytes` parses the `transport_socket` of a serialized
`Cluster`. It returns `Ok(None)` when the cluster has no transport
socket, and otherwise fails with the same NACK errors as before. It
takes the encoded resource rather than a decoded `Cluster` so that the
envoy protobuf types stay out of this crate's public API, which
`check-external-types` enforces. A caller driving its own ADS stream has
those bytes a

**File**: `tonic-xds/src/client/endpoint.rs` (modified, +7/-13)
```diff
@@ -24,8 +24,6 @@
 
 use crate::common::async_util::BoxFuture;
 #[cfg(feature = "_tls-any")]
-use crate::xds::cert_provider::verifier::XdsServerCertVerifier;
-#[cfg(feature = "_tls-any")]
 use crate::xds::cert_provider::{CertProviderRegistry, CertificateProvider};
 use crate::xds::resource::cluster::ClusterResource;
 use crate::xds::resource::security::ClusterSecurityConfig;
@@ -301,13 +299,13 @@ impl ClusterTlsConfig<'_> {
     /// Bootstrap instance name of the CA trust bundle used to validate the
     /// peer's certificate chain.
     pub fn ca_instance_name(&self) -> &str {
-        &self.security.ca_instance_name
+        self.security.ca_instance_name()
     }
 
     /// Bootstrap instance name of the local identity (client certificate).
     /// `Some` implies mTLS is requested for this cluster.
     pub fn identity_instance_name(&self) -> Option<&str> {
-        self.security.identity_instance_name.as_deref()
+        self.security.identity_instance_name()
     }
 
     /// Build the gRFC-A29 server-certificate verifier for this cluster.
@@ -325,15 +323,12 @@ impl ClusterTlsConfig<'_> {
     ) -> Result<Arc<dyn rustls::client::danger::ServerCertVerifier>, ClusterTlsError> {
         let ca_provider = self
             .registry
-            .get(&self.security.ca_instance_name)
+            .get(self.security.ca_instance_name())
             .ok_or_else(|| {
-                ClusterTlsError::UnknownCaInstance(self.security.ca_instance_name.clone())
+                ClusterTlsError::UnknownCaInstance(self.security.ca_instance_name().to_owned())
             })?
             .clone();
-        Ok(Arc::new(XdsServerCertVerifier::new(
-            ca_provider,
-            self.security.san_matchers.clone(),
-        )))
+        Ok(self.security.build_verifier(ca_provider))
     }
 
     /// Resolve the optional mTLS identity provider for this cluster.
@@ -345,13 +340,12 @@ impl ClusterTlsConfig<'_> {
         &self,
     ) -> Result<Option<Arc<dyn CertificateProvider>>, ClusterTlsError> {
         self.security
-            .identity_instance_name
-            .as_ref()
+            .identity_instance_name()
             .map(|name| {
                 self.registry
                     .get(name)
                     .cloned()
-                    .ok_or_else(|| ClusterTlsError::UnknownIdentityInstance(name.clone()))
+                    .ok_or_else(|| ClusterTlsError::UnknownIdentityInstance(name.to_owned()))
             })
             .transpose()
     }
```

**File**: `tonic-xds/src/lib.rs` (modified, +5/-0)
```diff
@@ -253,6 +253,10 @@ pub use xds::bootstrap::{
 pub use xds::cert_provider_config::TlsChannelCredentials;
 pub use xds::resource::route_config::{RouteConfigMetadata, TypedMetadata};
 pub use xds::uri::{XdsUri, XdsUriError};
+/// Re-export of the error type returned by
+/// [`ClusterSecurityConfig::from_cluster_bytes`], so callers can name it
+/// without a direct `xds-client` dependency.
+pub use xds_client::Error as XdsError;
 pub use xds_client::TonicCallCredentials;
 
 #[cfg(feature = "_tls-any")]
@@ -263,6 +267,7 @@ pub use client::endpoint::{ClusterTlsConfig, ClusterTlsError};
 pub use rustls::client::danger::ServerCertVerifier;
 #[cfg(feature = "_tls-any")]
 pub use xds::cert_provider::{CertProviderError, CertificateData, CertificateProvider, Identity};
+pub use xds::resource::security::ClusterSecurityConfig;
 
 pub use xds_client::{Instrument, InstrumentKind, KeyValue, MetricsRecorder, StringValue, Value};
 
```

**File**: `tonic-xds/src/xds/cluster_discovery.rs` (modified, +1/-5)
```diff
@@ -393,11 +393,7 @@ mod tests {
 
     #[cfg(feature = "_tls-any")]
     fn security(ca: &str, identity: Option<&str>) -> ClusterSecurityConfig {
-        ClusterSecurityConfig {
-            ca_instance_name: ca.into(),
-            identity_instance_name: identity.map(Into::into),
-            san_matchers: vec![],
-        }
+        ClusterSecurityConfig::for_test(ca, identity)
     }
 
     #[cfg(feature = "_tls-any")]
```

**File**: `tonic-xds/src/xds/resource/security.rs` (modified, +110/-8)
```diff
@@ -45,19 +45,81 @@ const TLS_TRANSPORT_SOCKET_NAME: &str = "envoy.transport_sockets.tls";
 /// Cluster-level TLS security config.
 ///
 /// Holds the instance names referenced by the cluster, not resolved
-/// providers. Resolution against [`CertProviderRegistry`] happens later, at
+/// providers. Resolving a name to a provider happens later, at
 /// connection-building time, so that this type can be derived during CDS
-/// resource validation (where the registry is not available).
-///
-/// [`CertProviderRegistry`]: crate::xds::cert_provider::CertProviderRegistry
+/// resource validation.
 #[derive(Debug, Clone)]
-pub(crate) struct ClusterSecurityConfig {
+pub struct ClusterSecurityConfig {
     /// Bootstrap instance name for the CA trust bundle. Required.
-    pub ca_instance_name: String,
+    ca_instance_name: String,
     /// Bootstrap instance name for client identity. `Some` implies mTLS.
-    pub identity_instance_name: Option<String>,
+    identity_instance_name: Option<String>,
     /// SAN matchers for server authorization. May be empty.
-    pub san_matchers: Vec<SanMatcher>,
+    san_matchers: Vec<SanMatcher>,
+}
+
+impl ClusterSecurityConfig {
+    /// Parse the `transport_socket` of a serialized CDS `Cluster`.
+    ///
+    /// Takes the encoded resource rather than a decoded `Cluster` so that the
+    /// envoy protobuf types stay out of this crate's public API. A caller
+    /// driving its own ADS stream has these bytes already: they are what the
+    /// management server sent.
+    ///
+    /// Returns `Ok(None)` when the cluster declares no transport socket and so
+    /// connects in plaintext, and an error for any A29 NACK condition.
+    ///
+    /// [`XdsChannel`](crate::XdsChannel) parses clusters itself and hands the
+    /// result to a connector, so this is for a caller outside that flow, which
+    /// holds the resource and its own providers.
+    pub fn from_cluster_bytes(cluster: &[u8]) -> Result<Option<Self>, Error> {
+        let cluster = envoy_types::pb::envoy::config::cluster::v3::Cluster::decode(cluster)?;
+        parse_transport_socket(cluster.transport_socket)
+    }
+
+    /// Bootstrap instance name of the CA trust bundle used to validate the
+    /// peer's certificate chain.
+    pub fn ca_instance_name(&self) -> &str {
+        &self.ca_instance_name
+    }
+
+    /// Bootstrap instance name of the local identity (client certificate).
+    /// `Some` implies mTLS is requested for this cluster.
+    pub fn identity_instance_name(&self) -> Option<&str> {
+        self.identity_instance_name.as_deref()
+    }
+
+    /// Build a config directly, for tests that need a cluster's security
+    /// settings without a `Cluster` to parse.
+    #[cfg(test)]
+    pub(crate) fn for_test(ca_instance_name: &str, identity_instance_name: Option<&str>) -> Self {
+        Self {
+            ca_instance_name: ca_instance_name.to_owned(),
+            identity_instance_name: identity_instance_name.map(str::to_owned),
+            san_matchers: Vec::new(),
+        }
+    }
+
+    /// Build the gRFC A29 server-certificate verifier for this cluster.
+    ///
+    /// `ca_provider` supplies the trust bundle named by
+    /// [`ca_instance_name`](Self::ca_instance_name). The bundle is re-read on
+    /// each handshake, so CA rotation is picked up.
+    ///
+    /// Build once per CDS update and clone the returned `Arc` per connection;
+    /// this is not for the per-request hot path.
+    #[cfg(feature = "_tls-any")]
+    pub fn build_verifier(
+        &self,
+        ca_provider: std::sync::Arc<dyn crate::xds::cert_provider::CertificateProvider>,
+    ) -> std::sync::Arc<dyn rustls::client::danger::ServerCertVerifier> {
+        std::sync::Arc::new(
+            crate::xds::cert_provider::verifier::XdsServerCertVerifier::new(
+                ca_provider,
+                self.san_matchers.clone(),
+            ),
+        )
+    }
 }
 
 /// Parse a cluster's `transport_socket` into a [`ClusterSecu
```

---

### Incident Patch 4: `bdd3f147` (2026-09-16)
**Commit Message**: fix(types): Serialize `BadRequest::FieldViolation` `reason` and `localized_message` (#2461)

## Motivation

fix #2460

Fields `reason` and `localized_message` from
`BadRequest::FieldViolation` are not serialized into the underlying
protobuf message and therefore never make it onto the wire.

## Solution

Fix the conversion from `FieldViolation` to the prost-generated
`pb::bad_request::FieldViolation` by explicitly forwarding both the
`reason` and `localized_message` fields instead of leaving them at their
default values.

A new test is added to ensure that behavior.

**File**: `tonic-types/src/richer_error/std_messages/bad_request.rs` (modified, +16/-10)
```diff
@@ -77,7 +77,8 @@ impl From<FieldViolation> for pb::bad_request::FieldViolation {
         pb::bad_request::FieldViolation {
             field: value.field,
             description: value.description,
-            ..Default::default()
+            reason: value.reason,
+            localized_message: value.localized_message.map(Into::into),
         }
     }
 }
@@ -183,12 +184,12 @@ impl From<BadRequest> for pb::BadRequest {
 #[cfg(test)]
 mod tests {
     use super::super::super::{FromAny, IntoAny};
-    use super::BadRequest;
+    use super::{BadRequest, FieldViolation, LocalizedMessage};
 
     #[test]
     fn gen_bad_request() {
-        let mut br_details = BadRequest::new(Vec::new());
-        let formatted = format!("{br_details:?}");
+        let empty_br_details = BadRequest::new(Vec::new());
+        let formatted = format!("{empty_br_details:?}");
 
         let expected = "BadRequest { field_violations: [] }";
 
@@ -198,17 +199,22 @@ mod tests {
         );
 
         assert!(
-            br_details.is_empty(),
+            empty_br_details.is_empty(),
             "empty BadRequest returns 'false' from .is_empty()"
         );
 
-        br_details
-            .add_violation("field_a", "description_a")
-            .add_violation("field_b", "description_b");
+        let mut br_details = BadRequest::new(vec![FieldViolation {
+            field: "field_a".to_string(),
+            description: "description_a".to_string(),
+            reason: "REASON".to_string(),
+            localized_message: Some(LocalizedMessage::new("en-US", "localized error")),
+        }]);
+
+        br_details.add_violation("field_b", "description_b");
 
         let formatted = format!("{br_details:?}");
 
-        let expected_filled = "BadRequest { field_violations: [FieldViolation { field: \"field_a\", description: \"description_a\", reason: \"\", localized_message: None }, FieldViolation { field: \"field_b\", description: \"description_b\", reason: \"\", localized_message: None }] }";
+        let expected_filled = "BadRequest { field_violations: [FieldViolation { field: \"field_a\", description: \"description_a\", reason: \"REASON\", localized_message: Some(LocalizedMessage { locale: \"en-US\", message: \"localized error\" }) }, FieldViolation { field: \"field_b\", description: \"description_b\", reason: \"\", localized_message: None }] }";
 
         assert!(
             formatted.eq(expected_filled),
@@ -223,7 +229,7 @@ mod tests {
         let gen_any = br_details.into_any();
         let formatted = format!("{gen_any:?}");
 
-        let expected = "Any { type_url: \"type.googleapis.com/google.rpc.BadRequest\", value: [10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 97, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 97, 10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 98, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 98] }";
+        let expected = "Any { type_url: \"type.googleapis.com/google.rpc.BadRequest\", value: [10, 58, 10, 7, 102, 105, 101, 108, 100, 95, 97, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 97, 26, 6, 82, 69, 65, 83, 79, 78, 34, 24, 10, 5, 101, 110, 45, 85, 83, 18, 15, 108, 111, 99, 97, 108, 105, 122, 101, 100, 32, 101, 114, 114, 111, 114, 10, 24, 10, 7, 102, 105, 101, 108, 100, 95, 98, 18, 13, 100, 101, 115, 99, 114, 105, 112, 116, 105, 111, 110, 95, 98] }";
 
         assert!(
             formatted.eq(expected),
```

---

### Incident Patch 5: `ce328eb0` (2026-09-16)
**Commit Message**: Fix Code-QL breakage with CI configuration. (#2870)

## Motivation

The repo has a `Security and Quality` error flag (see below) that is
being caused by Code-QL being broken. This was broken when we migrated
from the hyperium organization to the grpc organization.

<img width="3282" height="1542" alt="image"
src="https://github.com/user-attachments/assets/fdf97471-ad7b-4410-98f2-92329ec3c817"
/>


## Solution

Add configuration to run Code QL over the github Actions and the rust
code. This is parity with what the Tonic library had before the org
move. There is an alternative method to fix this in a 'basic' form, but
requires an organization admin.

**File**: `.github/workflows/CI.yml` (modified, +24/-0)
```diff
@@ -34,6 +34,30 @@ jobs:
     - uses: actions/checkout@v6
     - run: python3 tools/check_license.py
 
+  codeql:
+    name: CodeQL
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      security-events: write
+    strategy:
+      fail-fast: false
+      matrix:
+        language: [actions, rust]
+    steps:
+      - uses: actions/checkout@v6
+
+      - name: Initialize CodeQL
+        uses: github/codeql-action/init@v3
+        with:
+          languages: ${{ matrix.language }}
+          build-mode: none
+
+      - name: Perform CodeQL Analysis
+        uses: github/codeql-action/analyze@v3
+        with:
+          category: "/language:${{ matrix.language }}"
+
   build-protoc-plugin:
     runs-on: ${{ matrix.os }}
     strategy:
```

---

### Incident Patch 6: `079db1a8` (2026-09-11)
**Commit Message**: grpc: fix broken rustdoc links in the server module (#2865)

Fix reference to private interceptor and remove now deleted call. 

We may need to revisit making `Identity` and `Interceptor` public at
some point, since we expose a private symbol `Identity` via
`ServerBuilder` public. Ideally, this may require making interceptors
pub instead of pub crate

**File**: `grpc/src/server/mod.rs` (modified, +1/-2)
```diff
@@ -37,7 +37,6 @@
 //!
 //! # Additional Types
 //!
-//! - **[`Call`]:** Represents an incoming RPC accepted by a [`Listener`].
 //! - **[`SendStream`] / [`RecvStream`]:** Represent the sending and receiving
 //!   sides of a server-side RPC.
 //! - **[`RequestHeaders`]:** Represents gRPC headers sent by the client to
@@ -196,7 +195,7 @@ impl GracefulCoordinator {
 }
 
 impl Server {
-    /// Creates a new [`ServerBuilder`] with an [`Identity`] (no-op) interceptor.
+    /// Creates a new [`ServerBuilder`] with a no-op interceptor.
     pub fn builder() -> ServerBuilder<Identity> {
         ServerBuilder::new()
     }
```

---

### Incident Patch 7: `a850ef1f` (2026-09-10)
**Commit Message**: fix(grpc): remove reference to private RouterBuilder in Identity doc (#2861)

Remove reference to private RouteBuilder altogether from Identity , treating it like an independent entity.
Update the Server::Builder docs pointing out to some details of the Identity interceptor.

**File**: `grpc/src/server/interceptor.rs` (modified, +0/-3)
```diff
@@ -89,9 +89,6 @@ pub trait HandleExt: Handle + Sized {
 impl<T: Handle + Sized> HandleExt for T {}
 
 /// A no-op interceptor that simply delegates to the next handler.
-///
-/// This is the default interceptor used by `RouterBuilder` when no interceptor
-/// has been added.
 #[derive(Clone, Copy)]
 pub struct Identity;
 
```

**File**: `grpc/src/server/mod.rs` (modified, +9/-5)
```diff
@@ -49,6 +49,7 @@ use std::future::Future;
 use std::pin::Pin;
 use std::sync::Arc;
 
+use tokio::sync::watch;
 use tonic::async_trait;
 
 use crate::core::ConnectionInfo;
@@ -63,6 +64,9 @@ pub(crate) mod interceptor;
 pub(crate) mod router;
 pub mod service;
 
+use builder::ServerBuilder;
+use interceptor::Identity;
+
 /// Settings to configure RPCs sent using the [`Handle`] trait.
 ///
 /// Most applications will not need this type, and will set options via the
@@ -153,12 +157,12 @@ pub trait Transport: Send + 'static {
 /// Each connection is watched via `watch()`. When `shutdown()` is called,
 /// all watched connections receive a `graceful_shutdown()` signal.
 struct GracefulCoordinator {
-    tx: tokio::sync::watch::Sender<()>,
+    tx: watch::Sender<()>,
 }
 
 impl GracefulCoordinator {
     fn new() -> Self {
-        let (tx, _) = tokio::sync::watch::channel(());
+        let (tx, _) = watch::channel(());
         Self { tx }
     }
 
@@ -192,9 +196,9 @@ impl GracefulCoordinator {
 }
 
 impl Server {
-    /// Creates a [`ServerBuilder`](builder::ServerBuilder) with no interceptors.
-    pub fn builder() -> builder::ServerBuilder<interceptor::Identity> {
-        builder::ServerBuilder::new()
+    /// Creates a new [`ServerBuilder`] with an [`Identity`] (no-op) interceptor.
+    pub fn builder() -> ServerBuilder<Identity> {
+        ServerBuilder::new()
     }
 
     /// Creates a new server with the given handler and runtime.
```

---

### Incident Patch 8: `900ff055` (2026-09-10)
**Commit Message**: grpc-google: fix cargo toml for publishing (#2854)

This change also unexports the `TokenProvider` trait, which was only
used to mock credential-fetching logic in tests.

**File**: `grpc-google/Cargo.toml` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "grpc-google"
-version = "0.0.0-alpha"
+version = "0.10.0"
 edition = "2024"
 authors = ["gRPC authors"]
 license = "MIT"
@@ -14,9 +14,9 @@ allowed_external_types = ["grpc::*"]
 
 [dependencies]
 google-cloud-auth = { version = "1.9", default-features = false }
-grpc = { path = "../grpc", default-features = false }
+grpc = { version = "0.10.0", path = "../grpc", default-features = false }
 tonic = { version = "0.14.6", path = "../tonic", default-features = false }
-trait-variant = "0.1"
+trait-variant = { version = "0.1", default-features = false }
 
 [dev-dependencies]
 tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

**File**: `grpc-google/src/lib.rs` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ const DEFAULT_CLOUD_PLATFORM_SCOPE: &str = "https://www.googleapis.com/auth/clou
 
 /// An abstraction for fetching authentication tokens.
 #[trait_variant::make(Send)]
-pub trait TokenProvider: Sync + Debug + 'static {
+trait TokenProvider: Sync + Debug + 'static {
     /// Returns an authentication token.
     async fn get_token(&self) -> Result<String, String>;
 }
```

---

### Incident Patch 9: `f58169b3` (2026-08-20)
**Commit Message**: fix(ci): exclude grpc crates from automated releases (#2828)

## Motivation

The tonic release PR currently includes the publishable gRPC crates
because release-plz manages publishable workspace members by default.
These crates need to remain manually publishable without being included
in automated tonic releases.

## Solution

Configure `grpc`, `grpc-protobuf`, `grpc-protobuf-build`, and
`protoc-gen-rust-grpc` with `release = false`. This disables release-plz
processing while preserving Cargo's default manual publishing behavior.

## Test plan

- [x] Run `git diff --check`
- [x] Verify every publishable gRPC-family crate has an explicit
release-plz exclusion
- [ ] Confirm the next release-plz refresh removes the gRPC crates from
the release PR

Made with [Cursor](https://cursor.com)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `release-plz.toml` (modified, +16/-3)
```diff
@@ -54,6 +54,19 @@ release = false
 name = "xds-client-opentelemetry"
 release = false
 
-# grpc group (single crate)
-#[[package]]
-#name = "grpc"
+# grpc crates: published manually for now
+[[package]]
+name = "grpc"
+release = false
+
+[[package]]
+name = "grpc-protobuf"
+release = false
+
+[[package]]
+name = "grpc-protobuf-build"
+release = false
+
+[[package]]
+name = "protoc-gen-rust-grpc"
+release = false
```

---

### Incident Patch 10: `ccadfd8a` (2026-08-20)
**Commit Message**: fix(transport): drop listener before draining connections (#2824)

## Motivation

`Server::serve_with_incoming_shutdown` stops polling the accept stream
when the shutdown signal completes. It then waits for already-accepted
connections to drain. The incoming stream itself was not dropped until
that drain finished.

For `TcpIncoming`, keeping the stream alive keeps the listen socket
open. The kernel continues to accept TCP handshakes into the backlog.
Those connections are never passed to the HTTP/2 or TLS stack. A new
client completes TCP, then waits until its own request deadline.

`shutdown_closes_listener_before_drain` fails on current `master` with:

```
new connect must fail promptly after shutdown, while drain is still in progress: Elapsed(())
```

A new `TcpStream::connect` still succeeds for the full 500 ms after
shutdown while an in-flight RPC is held. grpc-go `GracefulStop` closes
every listener first, then drains transports. `net/http.Server.Shutdown`
does the same.

## Solution

Scope the accept loop so `incoming` is dropped as soon as the shutdown
signal fires. `TcpIncoming`'s `Drop` closes the listen socket.
Already-accepted connections are then drained as before.

`s

**File**: `tests/integration_tests/tests/connection.rs` (modified, +111/-1)
```diff
@@ -23,9 +23,13 @@
  */
 
 use integration_tests::pb::{test_client::TestClient, test_server, Input, Output};
+use std::io;
+use std::pin::Pin;
 use std::sync::{Arc, Mutex};
+use std::task::{Context, Poll};
 use std::time::Duration;
-use tokio::{net::TcpListener, sync::oneshot};
+use tokio::{net::TcpListener, net::TcpStream, sync::oneshot};
+use tokio_stream::Stream;
 use tonic::{
     transport::{server::TcpIncoming, Endpoint, Server},
     Code, Request, Response, Status,
@@ -137,3 +141,109 @@ async fn connect_lazy_reconnects_after_first_failure() {
 
     jh.await.unwrap();
 }
+
+/// A unary handler. The call waits until `hold` is received.
+struct HoldSvc {
+    started: Mutex<Option<oneshot::Sender<()>>>,
+    hold: Mutex<Option<oneshot::Receiver<()>>>,
+}
+
+#[tonic::async_trait]
+impl test_server::Test for HoldSvc {
+    async fn unary_call(&self, _: Request<Input>) -> Result<Response<Output>, Status> {
+        let started = self.started.lock().unwrap().take();
+        if let Some(tx) = started {
+            let _ = tx.send(());
+        }
+        let hold = self.hold.lock().unwrap().take();
+        if let Some(rx) = hold {
+            let _ = rx.await;
+        }
+        Ok(Response::new(Output {}))
+    }
+}
+
+/// Forwards polls to `inner`. Sends on `on_drop` when this value is dropped.
+struct NotifyOnDrop<S> {
+    inner: S,
+    on_drop: Option<oneshot::Sender<()>>,
+}
+
+impl<S> Drop for NotifyOnDrop<S> {
+    fn drop(&mut self) {
+        if let Some(tx) = self.on_drop.take() {
+            let _ = tx.send(());
+        }
+    }
+}
+
+impl<S: Stream + Unpin> Stream for NotifyOnDrop<S> {
+    type Item = S::Item;
+
+    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
+        Pin::new(&mut self.inner).poll_next(cx)
+    }
+}
+
+/// Shutdown must drop `incoming` before in-flight RPCs complete.
+/// If `incoming` is a `TcpIncoming`, drop closes the listen socket.
+#[tokio::test]
+async fn shutdown_closes_listener_before_drain() {
+    let (started_tx, started_rx) = oneshot::channel();
+    let (hold_tx, hold_rx) = oneshot::channel();
+    let (shutdown_tx, shutdown_rx) = oneshot::channel();
+    let (dropped_tx, dropped_rx) = oneshot::channel();
+
+    let svc = test_server::TestServer::new(HoldSvc {
+        started: Mutex::new(Some(started_tx)),
+        hold: Mutex::new(Some(hold_rx)),
+    });
+
+    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let addr = listener.local_addr().unwrap();
+    let incoming = NotifyOnDrop {
+        inner: TcpIncoming::from(listener).with_nodelay(Some(true)),
+        on_drop: Some(dropped_tx),
+    };
+
+    let jh = tokio::spawn(async move {
+        Server::builder()
+            .add_service(svc)
+            .serve_with_incoming_shutdown(incoming, async { drop(shutdown_rx.await) })
+            .await
+            .unwrap();
+    });
+
+    let mut client = TestClient::connect(format!("http://{addr}")).await.unwrap();
+    let call = tokio::spawn(async move { client.unary_call(Request::new(Input {})).await });
+    started_rx.await.unwrap();
+
+    shutdown_tx.send(()).unwrap();
+
+    // Wait until `incoming` is dropped.
+    // Do not call connect in a loop before that.
+    // A connect loop can make `incoming.next()` ready.
+    // Then `select!` can accept the connection and ignore shutdown.
+    // The timeout is only a hang guard. On an unfixed server, drop
+    // waits for drain, and drain waits for `hold`.
+    tokio::time::timeout(Duration::from_secs(1), dropped_rx)
+        .await
+        .expect("incoming was not dropped before drain")
+        .unwrap();
+
+    let err = TcpStream::connect(addr)
+        .await
+        .expect_err("connect succeeded after incoming drop");
+    assert!(
+        matches!(
+            err.kind(),
+            io::ErrorKind::ConnectionRefused | io::ErrorKind::ConnectionReset
+        ),
+        "connect error was {:?}, not refused or reset",
+        err.k
```

**File**: `tonic/src/transport/server/mod.rs` (modified, +45/-31)
```diff
@@ -745,6 +745,10 @@ impl<L> Server<L> {
     }
 
     /// Serve the service with the signal on the provided incoming stream.
+    ///
+    /// When `signal` completes, this function drops `incoming`.
+    /// If `incoming` is a [`TcpIncoming`], drop closes the listen socket.
+    /// The function then waits for accepted connections to close.
     pub async fn serve_with_incoming_shutdown<S, I, F, IO, IE, ResBody>(
         self,
         svc: S,
@@ -853,37 +857,44 @@ impl<L> Server<L> {
 
         let graceful = signal.is_some();
         let mut sig = pin!(Fuse { inner: signal });
-        let mut incoming = pin!(incoming);
-
-        loop {
-            tokio::select! {
-                _ = &mut sig => {
-                    trace!("signal received, shutting down");
-                    break;
-                },
-                io = incoming.next() => {
-                    let io = match io {
-                        Some(Ok(io)) => io,
-                        Some(Err(e)) => {
-                            trace!("error accepting connection: {}", DisplayErrorStack(&*e));
-                            continue;
-                        },
-                        None => {
-                            break
-                        },
-                    };
-
-                    trace!("connection accepted");
-
-                    let req_svc = svc
-                        .call(&io)
-                        .await
-                        .map_err(super::Error::from_source)?;
-
-                    let hyper_io = TokioIo::new(io);
-                    let hyper_svc = TowerToHyperService::new(req_svc.map_request(|req: Request<Incoming>| req.map(Body::new)));
-
-                    serve_connection(hyper_io, hyper_svc, server.clone(), graceful.then(|| signal_rx.clone()), max_connection_age, max_connection_age_grace);
+
+        // Scope the accept loop so `incoming` is dropped as soon as we stop
+        // accepting. For `TcpIncoming` that closes the listen socket immediately
+        // (kernel stops SYN-ACKing). Holding it until after drain leaves the
+        // port bound: new clients complete TCP, then hang until their deadline.
+        {
+            let mut incoming = pin!(incoming);
+
+            loop {
+                tokio::select! {
+                    _ = &mut sig => {
+                        trace!("signal received, shutting down");
+                        break;
+                    },
+                    io = incoming.next() => {
+                        let io = match io {
+                            Some(Ok(io)) => io,
+                            Some(Err(e)) => {
+                                trace!("error accepting connection: {}", DisplayErrorStack(&*e));
+                                continue;
+                            },
+                            None => {
+                                break
+                            },
+                        };
+
+                        trace!("connection accepted");
+
+                        let req_svc = svc
+                            .call(&io)
+                            .await
+                            .map_err(super::Error::from_source)?;
+
+                        let hyper_io = TokioIo::new(io);
+                        let hyper_svc = TowerToHyperService::new(req_svc.map_request(|req: Request<Incoming>| req.map(Body::new)));
+
+                        serve_connection(hyper_io, hyper_svc, server.clone(), graceful.then(|| signal_rx.clone()), max_connection_age, max_connection_age_grace);
+                    }
                 }
             }
         }
@@ -1114,6 +1125,9 @@ impl<L> Router<L> {
     /// `serve_with_shutdown` this method will also take a signal future to
     /// gracefully shutdown the server.
     ///
+    /// When `signal` completes, `incoming` is dropped immediately (closing a
+    /// TCP listener) and already-accepted connections are then drained.
+    ///
     /// This method discards any provid
```

#### Recent Merged Pull Requests:
- **PR #2900** (2026-09-29): grpc/lb: simplify and unify tests via new TestEnv (@dfawley)
- **PR #2898** (2026-09-30): xds-client: Correct grpc.xds_client.connected metric lifecycle (@ejona86)
- **PR #2892** (2026-09-25): grpc/service_config: fix flaky service_config tests caused by a test LB policy name collision (@arjan-bal)
- **PR #2891** (2026-09-28): grpc/attributes: add remove API and inline persistent list (@arjan-bal)
- **PR #2888** (2026-09-25): xds-client: Move stream worker to its own task (@ejona86)
- **PR #2887** (2026-09-25): Make ParsedLbConfig available to load balancers, include child selection mechanism. (@nathanielford)
- **PR #2886** (2026-09-23): chore(xds): bump crates to 0.1.0-alpha.4 (@YutaoMa)
- **PR #2885** (closed): tonic-xds: let endpoint discovery run outside the xDS client (@ankurmittal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
