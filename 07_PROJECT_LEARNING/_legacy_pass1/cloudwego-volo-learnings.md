# Forensic Learning Record (Deep Inspection): cloudwego/volo

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloudwego-volo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cloudwego/volo](https://github.com/cloudwego/volo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:40.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cloudwego/volo`
- **Description**: Rust RPC framework with high-performance and strong-extensibility for building micro-services.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2627 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/scripts/reports/diff.py`
```
import csv

import sys

'''CSV Format Example
Kind,Concurrency,Data Size,TPS,P99,P999,Server_CPU,Client_CPU
[GRPC],100,1024,101152.29,3.36,5.30,188.04,423.07
'''


class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def diff(from_csv, to_csv):
    from_reader = list(csv.reader(open(from_csv)))
    to_reader = csv.reader(open(to_csv))
    title = ['Kind', 'Concurrency', 'Data Size', 'QPS', 'P99', 'P999', 'Server CPU', 'Client CPU']
    results = []

    for line_num, line in enumerate(to_reader):
        result = []
        result.append(line[0])  # kind
        result.append(line[1])  # concurrency
        result.append(line[2])  # data size

        result.append(diff_cell(from_reader[line_num][3], line[3]))  # tps
        result.append(diff_cell(from_reader[line_num][4], line[4]))  # p99
        result.append(diff_cell(from_reader[line_num][5], line[5]))  # p999
        result.append(diff_cell(from_reader[line_num][6], line[6]))  # Server CPU
        result.append(diff_cell(from_reader[line_num][7], line[7]))  # Client CPU

        results.append(result)

    results.sort(key=lambda result: result[0])
    results.insert(0, title)
    print_csv(results)


def diff_cell(old, now):
    old, now = float(old), float(now)
    percent = (now - old) / old * 100
    flag = '+' if percent >= 0 else ''
    return '{}{}({}{:.1f}%){}'.format(now, bcolors.WARNING, flag, percent, bcolors.ENDC)


def print_csv(results):
    cell_size = 15
    for line in results:
        result = []
        for cell in line:
            padding = cell_size - len(cell)
            if padding <= 0:
                padding = 5
            cell += ' ' * padding
            result.append(cell)
        print(''.join(result))


def main():
    if len(sys.argv) < 3:
        print('''Usage:
diff.py {baseline.csv} {current.csv} 
''')
        return
    from_csv = sys.argv[1]
    to_csv = sys.argv[2]
    diff(from_csv, to_csv)


if __name__ == '__main__':
    main()

```

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

### Core Architecture Module: `benchmark/src/bin/client.rs`
```
use std::net::SocketAddr;

use benchmark::{
    benchmark::echo::{EchoServerClientBuilder, Request},
    perf::Recoder,
    runner::{
        Runner,
        processor::{BEGIN_ACTION, ECHO_ACTION, END_ACTION, SLEEP_ACTION, process_response},
    },
};
use clap::Parser;
use volo_thrift::codec::DefaultMakeCodec;

#[derive(Parser, Debug)] // requires `derive` feature
#[command(term_width = 0)] // Just to make testing across clap features easier
struct Args {
    #[arg(short = 'a', long, default_value = "127.0.0.1:8001")]
    /// client call address
    address: String,

    /// echo size
    #[arg(short = 'b', long, default_value_t = 1024)]
    echo_size: usize,

    /// call concurrent
    #[arg(short = 'c', long, default_value_t = 100)]
    concurrent: usize,

    /// call qps
    #[arg(short = 'q', long, default_value_t = 0)]
    qps: usize,

    /// call total nums
    #[arg(short = 'n', long, default_value_t = 1024 * 100)]
    total: usize,

    /// sleep time for every request handler
    #[arg(short = 's', long, default_value_t = 0)]
    sleep_time: usize,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let addr = args.address.parse::<SocketAddr>().unwrap();
    let client = EchoServerClientBuilder::new("test.echo.volo")
        .make_codec(DefaultMakeCodec::framed())
        .address(addr)
        .build();
    let mut payload = unsafe { String::from_utf8_unchecked(vec![0u8; args.echo_size]) };
    let mut action = ECHO_ACTION.into();
    if args.sleep_time > 0 {
        action = SLEEP_ACTION.into();
        let st = args.sleep_time.to_string();
        payload = format!("{},{}", st, &payload[st.len() + 1..]);
    }
    let req = Request {
        action,
        msg: payload.into(),
    };
    let r = Runner::new(args.qps);
    r.warmup(client.clone(), req.clone(), args.concurrent, 100 * 1000)
        .await;

    let _ = client
        .echo(Request {
            action: BEGIN_ACTION.into(),
            msg: "empty".into(),
        })
        .await
        .expect("beginning server failed");

    let recoder = Recoder::new("VOLO@Client");
    recoder.begin().await;
    r.run(
        client.clone(),
        req,
        args.concurrent,
        args.total,
        args.qps,
        args.sleep_time,
        args.echo_size,
        "volo",
    )
    .await;
    recoder.end();

    let resp = client
        .echo(Request {
            action: END_ACTION.into(),
            msg: "empty".into(),
        })
        .await
        .expect("ending server failed");
    process_response(&resp.action, &resp.msg);

    recoder.report();
}

```

### Core Architecture Module: `benchmark/src/bin/server.rs`
```
use std::{net::SocketAddr, sync::LazyLock};

use anyhow::anyhow;
use benchmark::{
    benchmark::echo::{EchoServer, ObjReq, ObjResp, Request, Response},
    perf::Recoder,
    runner::processor::process_request,
};
use volo_thrift::ServerError;

static RECODER: LazyLock<Recoder> = LazyLock::new(|| Recoder::new("VOLO@Server"));

pub struct S;

impl EchoServer for S {
    async fn echo(&self, req: Request) -> Result<Response, ServerError> {
        let resp = process_request(&RECODER, req).await;
        Ok(resp)
    }

    async fn test_obj(&self, _req: ObjReq) -> Result<ObjResp, ServerError> {
        Err(anyhow!("not implemented").into())
    }
}

#[volo::main]
async fn main() {
    let addr: SocketAddr = "[::]:8001".parse().unwrap();
    let addr = volo::net::Address::from(addr);

    benchmark::benchmark::echo::EchoServerServer::new(S)
        .run(addr)
        .await
        .unwrap();
}

```

### Core Architecture Module: `benchmark/src/lib.rs`
```
pub mod perf;
pub mod runner;

mod r#gen {
    include!(concat!(env!("OUT_DIR"), "/benchmark.rs"));
}

pub use r#gen::*;

```

### Core Architecture Module: `benchmark/src/perf/cpu.rs`
```
use std::{fmt::Display, time::Duration};

use sysinfo::{ProcessRefreshKind, RefreshKind};
use tokio_util::sync::CancellationToken;

const DEFAULT_INTERVAL: Duration = Duration::from_secs(1);
const DEFAULT_USAGE_THRESHOLD: f32 = 10.0;

#[derive(Default)]
pub struct Usage {
    min: f32,
    max: f32,
    avg: f32,
    p50: f32,
    p90: f32,
    p99: f32,
}

impl Usage {
    pub fn new(stats: &mut [f32]) -> Self {
        if stats.is_empty() {
            return Self::default();
        }

        let mut stats = stats;
        stats.sort_by(|a, b| a.total_cmp(b));
        let mut length = stats.len();
        if length > 3 {
            stats = &mut stats[1..length - 1];
            length -= 2;
        }
        let f_len = stats.len() as f32;
        let tp50_index = (f_len * 0.5) as usize;
        let tp90_index = (f_len * 0.9) as usize;
        let tp99_index = (f_len * 0.99) as usize;

        let mut usage = Self::default();
        if tp50_index > 0 {
            usage.p50 = stats[tp50_index - 1];
        }
        if tp90_index > tp50_index {
            usage.p90 = stats[tp90_index - 1];
        } else {
            usage.p90 = usage.p50;
        }
        if tp99_index > tp90_index {
            usage.p99 = stats[tp99_index - 1];
        } else {
            usage.p99 = usage.p90;
        }

        let sum: f32 = stats.iter().sum();
        usage.avg = sum / f_len;

        usage.min = stats[0];
        usage.max = stats[length - 1];

        usage
    }
}

impl Display for Usage {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "MIN: {:.2}%, TP50: {:.2}%, TP90: {:.2}%, TP99: {:.2}%, MAX: {:.2}%, AVG:{:.2}%",
            self.min, self.p50, self.p90, self.p99, self.max, self.avg
        )
    }
}

pub async fn record_usage(cpu_usage_list: &mut Vec<f32>, cancel: CancellationToken) {
    let pid = sysinfo::Pid::from_u32(std::process::id());
    let mut system =
        sysinfo::System::new_with_specifics(RefreshKind::everything().without_memory());

    if system.process(pid).is_none() {
        panic!("process not found");
    }

    loop {
        tokio::select! {
            _ = tokio::time::sleep(DEFAULT_INTERVAL) => {
                system.refresh_processes_specifics(sysinfo::ProcessesToUpdate::Some(&[pid]), true, ProcessRefreshKind::nothing().with_cpu());
                let cpu_usage = system
                    .process(pid)
                    .unwrap()
                    .cpu_usage();
                if cpu_usage > DEFAULT_USAGE_THRESHOLD {
                    cpu_usage_list.push(cpu_usage);
                }
            }
            _ = cancel.cancelled() => break,
        }
    }
}

```

### Core Architecture Module: `benchmark/src/perf/mem.rs`
```
use std::{fmt::Display, time::Duration};

use sysinfo::{ProcessRefreshKind, RefreshKind};
use tokio_util::sync::CancellationToken;

const DEFAULT_INTERVAL: Duration = Duration::from_secs(3);
const DEFAULT_RSS_THRESHOLD: u64 = 1024 * 1024; // bytes

#[derive(Debug, Default)]
pub struct Usage {
    max_rss: u64,
    avg_rss: u64,
}

impl Usage {
    pub fn new(rss_list: &[u64]) -> Self {
        if rss_list.is_empty() {
            return Self::default();
        }
        let mut total_rss = 0;
        let mut max_rss = 0;
        for rss in rss_list {
            total_rss += *rss;
            if *rss > max_rss {
                max_rss = *rss;
            }
        }
        Self {
            max_rss,
            avg_rss: total_rss / rss_list.len() as u64,
        }
    }
}

impl Display for Usage {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "AVG: {} MB, MAX: {} MB",
            self.avg_rss / 1024 / 1024,
            self.max_rss / 1024 / 1024
        )
    }
}

pub async fn record_usage(mem_usage_list: &mut Vec<u64>, cancel: CancellationToken) {
    let pid = sysinfo::Pid::from_u32(std::process::id());
    let mut system = sysinfo::System::new_with_specifics(RefreshKind::everything().without_cpu());
    if system.process(pid).is_none() {
        panic!("process not found");
    }

    loop {
        tokio::select! {
            _ = tokio::time::sleep(DEFAULT_INTERVAL) => {
                system.refresh_processes_specifics(sysinfo::ProcessesToUpdate::Some(&[pid]), true, ProcessRefreshKind::nothing().with_memory());
                let mem_usage = system
                    .process(pid)
                    .unwrap()
                    .memory();
                if mem_usage > DEFAULT_RSS_THRESHOLD {
                    mem_usage_list.push(mem_usage);
                }
            }
            _ = cancel.cancelled() => break,
        }
    }
}

```

### Core Architecture Module: `benchmark/src/perf/mod.rs`
```
use std::{cell::UnsafeCell, sync::Arc};

use tokio_util::sync::CancellationToken;
use volo::FastStr;

pub mod cpu;
pub mod mem;

pub struct Recoder {
    name: FastStr,
    cancel: CancellationToken,
    cpu: Arc<UnsafeCell<Vec<f32>>>,
    mem: Arc<UnsafeCell<Vec<u64>>>,
}

unsafe impl Send for Recoder {}
unsafe impl Sync for Recoder {}

impl Recoder {
    pub fn new(name: impl Into<FastStr>) -> Self {
        Self {
            name: name.into(),
            cancel: CancellationToken::new(),
            cpu: Default::default(),
            mem: Default::default(),
        }
    }

    pub async fn begin(&self) {
        let cpu_cancel = self.cancel.clone();
        let cpu_vec = self.cpu.clone();
        tokio::spawn(cpu::record_usage(
            unsafe { &mut *cpu_vec.get() },
            cpu_cancel,
        ));
        let mem_cancel = self.cancel.clone();
        let mem_vec = self.mem.clone();
        tokio::spawn(mem::record_usage(
            unsafe { &mut *mem_vec.get() },
            mem_cancel,
        ));
    }

    pub fn end(&self) {
        self.cancel.cancel();
    }

    pub fn report_string(&self) -> String {
        let cpu_usage = cpu::Usage::new(unsafe { &mut *self.cpu.get() });
        let mem_usage = mem::Usage::new(unsafe { &mut *self.mem.get() });
        format!(
            "[{}] CPU Usage: {}\n[{}] Mem Usage: {}\n",
            self.name, cpu_usage, self.name, mem_usage
        )
    }

    pub fn report(&self) {
        print!("{}", self.report_string());
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
+        assert!(cx.stats.process_start_at()
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
+            // The recei
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
+        let resp_enu
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
 
-            l
```

---

### Incident Patch 5: `d9e6751c` (2026-03-19)
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
+   
```

---

### Incident Patch 6: `6220d5ba` (2026-03-03)
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

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

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

### Incident Patch 7: `37cf3ed1` (2026-03-03)
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

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

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

### Incident Patch 8: `21bb99fc` (2025-11-12)
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

### Incident Patch 9: `10e73ea4` (2025-11-03)
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

---

### Incident Patch 10: `83f989cb` (2025-09-26)
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
