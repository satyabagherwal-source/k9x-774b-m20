# Forensic Learning Record (Deep Inspection): orf/gping

> **Canonical Artifact**: `07_PROJECT_LEARNING/orf-gping-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/orf/gping](https://github.com/orf/gping))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:27:33.469Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `orf/gping`
- **Description**: Ping, but with a graph
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, Dockerfile
- **Stars / Engagement**: 12697 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gping/src/colors.rs`
```
use std::{iter::Iterator, ops::RangeFrom, str::FromStr};

use anyhow::{anyhow, Result};
use tui::style::Color;

pub struct Colors<T> {
    already_used: Vec<Color>,
    color_names: T,
    indices: RangeFrom<u8>,
}

impl<T> From<T> for Colors<T> {
    fn from(color_names: T) -> Self {
        Self {
            already_used: Vec::new(),
            color_names,
            indices: 2..,
        }
    }
}

impl<'a, T> Iterator for Colors<T>
where
    T: Iterator<Item = &'a String>,
{
    type Item = Result<Color>;

    fn next(&mut self) -> Option<Self::Item> {
        match self.color_names.next() {
            Some(name) => match Color::from_str(name) {
                Ok(color) => {
                    if !self.already_used.contains(&color) {
                        self.already_used.push(color);
                    }
                    Some(Ok(color))
                }
                error => Some(error.map_err(|err| {
                    anyhow!(err).context(format!("Invalid color code: `{}`", name))
                })),
            },
            None => loop {
                let index = unsafe { self.indices.next().unwrap_unchecked() };
                let color = Color::Indexed(index);
                if !self.already_used.contains(&color) {
                    self.already_used.push(color);
                    break Some(Ok(color));
                }
            },
        }
    }
}

```

### Core Architecture Module: `gping/src/main.rs`
```
use crate::plot_data::PlotData;
use anyhow::{anyhow, bail, Context, Result};
use chrono::prelude::*;
use clap::{CommandFactory, Parser};
use itertools::{Itertools, MinMaxResult};
use pinger::{ping, PingMode, PingOptions, PingResult};
use std::io;
use std::io::BufWriter;
use std::iter;
use std::net::{IpAddr, ToSocketAddrs};
use std::path::Path;
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{mpsc, Arc};
use std::thread;
use std::thread::{sleep, JoinHandle};
use std::time::{Duration, Instant};
#[cfg(windows)]
use tui::backend::Backend;
use tui::backend::CrosstermBackend;
use tui::crossterm::event::KeyModifiers;
#[cfg(windows)]
use tui::crossterm::terminal::SetSize;
use tui::crossterm::terminal::{Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen};
use tui::crossterm::{
    event::{self, Event as CEvent, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode},
};
use tui::layout::{Constraint, Direction, Flex, Layout};
use tui::style::{Color, Style};
use tui::text::Span;
use tui::widgets::{Axis, Block, Borders, Chart, Dataset};
use tui::Terminal;

mod colors;
mod plot_data;
mod region_map;

use colors::Colors;
use tui::prelude::Position;

#[cfg(target_os = "openbsd")]
const DEFAULT_PING_INTERVAL_SECONDS: f32 = 1.0;
#[cfg(not(target_os = "openbsd"))]
const DEFAULT_PING_INTERVAL_SECONDS: f32 = 0.2;
const DEFAULT_CMD_INTERVAL_SECONDS: f32 = 0.5;

#[derive(Parser, Debug)]
#[command(author, version, name = "gping", about = "Ping, but with a graph.", styles = clap_cargo::style::CLAP_STYLING)]
struct Args {
    /// Graph the execution time for a list of commands rather than pinging hosts
    #[arg(long)]
    cmd: bool,

    /// Watch interval seconds (provide partial seconds like '0.5'). Default for ping is 0.2 (1.0 on OpenBSD), default for cmd is 0.5.
    #[arg(short = 'n', long)]
    watch_interval: Option<f32>,

    /// Hosts or IPs to ping, or commands to run if --cmd is provided. Can use cloud shorthands like aws:eu-west-1.
    #[arg(allow_hyphen_values = false)]
    hosts_or_commands: Vec<String>,

    /// Determines the number of seconds to display in the graph.
    #[arg(short, long, default_value = "30")]
    buffer: u64,
    /// Resolve ping targets to IPv4 address
    #[arg(short = '4', conflicts_with = "ipv6")]
    ipv4: bool,
    /// Resolve ping targets to IPv6 address
    #[arg(short = '6', conflicts_with = "ipv4")]
    ipv6: bool,

    #[cfg(not(target_os = "windows"))]
    /// Interface to use when pinging.
    #[arg(short = 'i', long)]
    interface: Option<String>,

    /// Uses dot characters instead of braille
    #[arg(short = 's', long, help = "")]
    simple_graphics: bool,

    /// Vertical margin around the graph (top and bottom)
    #[arg(long, default_value = "1")]
    vertical_margin: u16,

    /// Horizontal margin around the graph (left and right)
    #[arg(long, default_value = "0")]
    horizontal_margin: u16,

    /// set y-axis minimum
    #[arg(long, help = "Set vertical axis min (ms)")]
    ymin: Option<u64>,

    /// set y-axis maximum
    #[arg(long, help = "Set vertical axis max (ms)")]
    ymax: Option<u64>,

    /// set y-axis minimum to zero
    #[arg(short = '0', help = "Equivalent to --ymin=0", conflicts_with = "ymin")]
    ymin_zero: bool,

    /// Use TCP pings instead of ICMP
    #[arg(long, default_value_t = false)]
    tcp: bool,

    /// How to treat a connection refused (RST) when TCP pinging
    #[arg(long, value_enum, default_value_t = RstBehaviour::Pong, requires = "tcp")]
    tcp_rst: RstBehaviour,

    /// Port to connect to (only used for TCP pings)
    #[arg(long, default_value_t = 80, requires = "tcp")]
    tcp_port: u16,

    #[arg(
        name = "color",
        short = 'c',
        long = "color",
        use_value_delimiter = true,
        value_delimiter = ',',
        help = r#"Assign color to a graph entry.

This option can be defined more than once as a comma separated string, and the
order which the colors are provided will be matched against the hosts or
commands passed to gping.

Hexadecimal RGB color codes are accepted in the form of '#RRGGBB' or the
following color names: 'black', 'red', 'green', 'yellow', 'blue', 'magenta',
'cyan', 'gray', 'dark-gray', 'light-red', 'light-green', 'light-yellow',
'light-blue', 'light-magenta', 'light-cyan', and 'white'"#
    )]
    color_codes_or_names: Vec<String>,

    /// Clear the graph from the terminal after closing the program
    #[arg(name = "clear", long = "clear", action)]
    clear: bool,

    #[cfg(not(target_os = "windows"))]
    /// Extra arguments to pass to `ping`. These are platform dependent.
    #[arg(long, allow_hyphen_values = true, num_args = 0.., conflicts_with="cmd")]
    ping_args: Option<Vec<String>>,
}

/// Mirrors [`pinger::RstBehaviour`] so the choice can be parsed by clap without the
/// pinger crate having to depend on it.
#[derive(Copy, Clone, Debug, PartialEq, Eq, clap::ValueEnum)]
enum RstBehaviour {
    /// Count it as a successful ping: the host answered, it just isn't listening
    Pong,
    /// Count it as a failed ping
    Drop,
}

impl From<RstBehaviour> for pinger::RstBehaviour {
    fn from(value: RstBehaviour) -> Self {
        match value {
            RstBehaviour::Pong => pinger::RstBehaviour::Pong,
            RstBehaviour::Drop => pinger::RstBehaviour::Drop,
        }
    }
}

struct App {
    data: Vec<PlotData>,
    display_interval: chrono::Duration,
    started: chrono::DateTime<Local>,
    yrange: (Option<f64>, Option<f64>),
}

impl App {
    fn new(data: Vec<PlotData>, buffer: u64, yrange: (Option<f64>, Option<f64>)) -> Self {
        App {
            data,
            display_interval: chrono::Duration::from_std(Duration::from_secs(buffer)).unwrap(),
            started: Local::now(),
            yrange,
        }
    }

    fn update(&mut self, host_idx: usize, item: Option<Duration>) {
        let host = &mut self.data[host_idx];
        host.update(item);
    }

    fn y_axis_bounds(&self) -> [f64; 2] {
        // Find the Y axis bounds for our chart.
        // This is trickier than the x-axis. We iterate through all our PlotData structs
        // and find the min/max of all the values, then add a 10% buffer to each end so
        // the data doesn't sit right on the edge of the graph.
        let (ymin, ymax) = self.yrange;
        let (data_min, data_max) = match self
            .data
            .iter()
            .flat_map(|b| b.data.as_slice())
            .map(|v| v.1)
            .filter(|v| !v.is_nan())
            .minmax()
        {
            // Nothing has come back yet, so there is nothing to scale to.
            MinMaxResult::NoElements => (0_f64, 0_f64),
            MinMaxResult::OneElement(elm) => (elm, elm),
            MinMaxResult::MinMax(min, max) => (min, max),
        };

        // A bound the user pinned with --ymin/--ymax is used verbatim. The buffer only
        // makes sense for a bound we derived from the data: an explicit bound is a
        // request for the axis to end exactly there, so padding it past the requested
        // value would be wrong.
        let mut min = ymin.unwrap_or(data_min - (data_min * 10_f64) / 100_f64);
        let mut max = ymax.unwrap_or(data_max + (data_max * 10_f64) / 100_f64);

        // Reject negative bounds, and never let the axis collapse to zero height (no
        // data yet, or --ymin pinned above everything we have measured so far).
        min = min.max(0_f64);
        if max <= min {
            max = min + 1000_f64;
        }

        [min, max]
    }

    fn x_axis_bounds(&self) -> [f64; 2] {
        let now = Local::now();
        let now_idx;
        let before_idx;
        if (now - self.started) < self.display_interval {
            now_idx = (self.started + self.display_interval).timestamp_millis() as f64 / 1_000f64;
            before_idx = self.started.timestamp_millis() as f64 / 1_000f64;
  
```

### Core Architecture Module: `gping/src/plot_data.rs`
```
use anyhow::Context;
use chrono::prelude::*;
use core::option::Option;
use core::option::Option::{None, Some};
use core::time::Duration;
use itertools::Itertools;
use tui::style::Style;
use tui::symbols;
use tui::widgets::{Dataset, GraphType, Paragraph};

pub struct PlotData {
    pub display: String,
    pub data: Vec<(f64, f64)>,
    pub style: Style,
    buffer: chrono::Duration,
    simple_graphics: bool,
}

impl PlotData {
    pub fn new(display: String, buffer: u64, style: Style, simple_graphics: bool) -> PlotData {
        PlotData {
            display,
            data: Vec::with_capacity(150),
            style,
            buffer: chrono::Duration::try_seconds(buffer as i64)
                .with_context(|| format!("Error converting {buffer} to seconds"))
                .unwrap(),
            simple_graphics,
        }
    }
    pub fn update(&mut self, item: Option<Duration>) {
        let now = Local::now();
        let idx = now.timestamp_millis() as f64 / 1_000f64;
        match item {
            Some(dur) => self.data.push((idx, dur.as_micros() as f64)),
            None => self.data.push((idx, f64::NAN)),
        }
        // Find the last index that we should remove.
        let earliest_timestamp = (now - self.buffer).timestamp_millis() as f64 / 1_000f64;
        let last_idx = self
            .data
            .iter()
            .enumerate()
            .filter(|(_, (timestamp, _))| *timestamp < earliest_timestamp)
            .map(|(idx, _)| idx)
            .next_back();
        if let Some(idx) = last_idx {
            // `idx` itself is still stale (it matched the filter above), so it must be
            // included in the drained range too, otherwise one out-of-window point is
            // always left behind.
            self.data.drain(0..=idx).for_each(drop)
        }
    }

    pub fn header_stats(&self) -> Vec<Paragraph<'_>> {
        let ping_header = Paragraph::new(self.display.clone()).style(self.style);
        // Chronologically-ordered (i.e. not sorted) latencies, used for the jitter
        // calculation which needs to compare consecutive samples in the order they
        // actually occurred.
        let chronological: Vec<f64> = self
            .data
            .iter()
            .filter(|(_, x)| !x.is_nan())
            .map(|(_, v)| *v)
            .collect();
        let items: Vec<&f64> = self
            .data
            .iter()
            .filter(|(_, x)| !x.is_nan())
            .map(|(_, v)| v)
            .sorted_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .collect();
        if items.is_empty() {
            return vec![ping_header];
        }

        let min = **items.first().unwrap();
        let max = **items.last().unwrap();
        let avg = items.iter().copied().sum::<f64>() / items.len() as f64;
        let jtr = jitter(&chronological);

        let percentile_position = 0.95 * items.len() as f32;
        let rounded_position = percentile_position.round() as usize;
        let p95 = items.get(rounded_position).map(|i| **i).unwrap_or(0f64);

        // count timeouts
        let to = self.data.iter().filter(|(_, x)| x.is_nan()).count();

        let last = self.data.last().unwrap_or(&(0f64, 0f64)).1;

        vec![
            ping_header,
            Paragraph::new(format!("last {:?}", Duration::from_micros(last as u64)))
                .style(self.style),
            Paragraph::new(format!("min {:?}", Duration::from_micros(min as u64)))
                .style(self.style),
            Paragraph::new(format!("max {:?}", Duration::from_micros(max as u64)))
                .style(self.style),
            Paragraph::new(format!("avg {:?}", Duration::from_micros(avg as u64)))
                .style(self.style),
            Paragraph::new(format!("jtr {:?}", Duration::from_micros(jtr as u64)))
                .style(self.style),
            Paragraph::new(format!("p95 {:?}", Duration::from_micros(p95 as u64)))
                .style(self.style),
            Paragraph::new(format!("t/o {to:?}")).style(self.style),
        ]
    }
}

/// Average absolute difference between consecutive values, taken in the order
/// they are given (i.e. the caller is responsible for passing them in
/// chronological order, not sorted). With fewer than two values there is no
/// consecutive pair to compare, so jitter is reported as 0.
fn jitter(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    values
        .iter()
        .zip(values.iter().skip(1))
        .map(|(prev, curr)| (curr - prev).abs())
        .sum::<f64>()
        / (values.len() - 1) as f64
}

impl<'a> From<&'a PlotData> for Dataset<'a> {
    fn from(plot: &'a PlotData) -> Self {
        let slice = plot.data.as_slice();
        Dataset::default()
            .marker(if plot.simple_graphics {
                symbols::Marker::Dot
            } else {
                symbols::Marker::Braille
            })
            .style(plot.style)
            .graph_type(GraphType::Line)
            .data(slice)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Regression test for the buffer trim in `PlotData::update`: every point older than
    // `buffer` seconds should be dropped, including the single oldest stale point, which
    // used to survive because `drain(0..idx)` excluded the boundary index itself.
    #[test]
    fn update_drops_all_points_outside_the_buffer_window() {
        let buffer_secs = 5u64;
        let mut plot = PlotData::new("host".to_string(), buffer_secs, Style::default(), false);

        let now = Local::now().timestamp_millis() as f64 / 1_000f64;

        // Seed with a mix of stale (older than the buffer window) and fresh points,
        // pushed in ascending timestamp order like the real update loop would.
        plot.data.push((now - 10.0, 100.0)); // stale
        plot.data.push((now - 8.0, 200.0)); // stale
        plot.data.push((now - 6.0, 300.0)); // stale, closest to the boundary
        plot.data.push((now - 2.0, 400.0)); // fresh
        plot.data.push((now - 1.0, 500.0)); // fresh

        // Triggers the trim logic; also appends one brand-new point.
        plot.update(Some(Duration::from_millis(42)));

        let earliest_allowed = now - buffer_secs as f64;
        for &(timestamp, _) in &plot.data {
            assert!(
                timestamp >= earliest_allowed,
                "found a point at {timestamp}, which is older than the buffer window start {earliest_allowed}; data: {:?}",
                plot.data
            );
        }
    }

    #[test]
    fn test_jitter_uses_chronological_order() {
        // Oscillating latencies: sorted-order "jitter" would telescope down to
        // (max - min) / (n - 1) = (90 - 10) / 5 = 16, which is really a range
        // statistic, not jitter. In chronological order every consecutive pair
        // differs by 80, so the real jitter should be 80.
        let values = vec![10.0, 90.0, 10.0, 90.0, 10.0, 90.0];

        let sorted_order_value = (90.0 - 10.0) / (values.len() - 1) as f64;
        let result = jitter(&values);

        assert_eq!(result, 80.0);
        assert_ne!(result, sorted_order_value);
    }

    #[test]
    fn test_jitter_single_sample_is_zero() {
        assert_eq!(jitter(&[42.0]), 0.0);
    }

    #[test]
    fn test_jitter_empty_is_zero() {
        assert_eq!(jitter(&[]), 0.0);
    }
}

```

### Core Architecture Module: `gping/src/region_map.rs`
```
type Host = String;

pub fn try_host_from_cloud_region(query: &str) -> Option<Host> {
    match query.split_once(':') {
        Some(("aws", region)) => Some(format!("ec2.{region}.amazonaws.com")),
        Some(("gcp", "")) => Some("cloud.google.com".to_string()),
        Some(("gcp", region)) => Some(format!("storage.{region}.rep.googleapis.com")),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_host_from_aws() {
        assert_eq!(
            try_host_from_cloud_region("aws:eu-west-1"),
            Some("ec2.eu-west-1.amazonaws.com".to_string())
        );
    }

    #[test]
    fn test_host_from_gcp() {
        assert_eq!(
            try_host_from_cloud_region("gcp:me-central2"),
            Some("storage.me-central2.rep.googleapis.com".to_string())
        );
        assert_eq!(
            try_host_from_cloud_region("gcp:"),
            Some("cloud.google.com".to_string())
        );
    }

    #[test]
    fn test_host_from_foo() {
        assert_eq!(try_host_from_cloud_region("foo:bar"), None);
    }

    #[test]
    fn test_invalid_input() {
        assert_eq!(try_host_from_cloud_region("foo"), None);
    }
}

```

### Core Architecture Module: `pinger/examples/simple-ping.rs`
```
use pinger::{ping, PingOptions};

const LIMIT: usize = 3;

pub fn main() {
    let target = "tomforb.es".to_string();
    let interval = std::time::Duration::from_millis(500);
    let options = PingOptions::new(target, interval, None);
    let stream = ping(options).expect("Error pinging");
    for message in stream.into_iter().take(LIMIT) {
        match message {
            pinger::PingResult::Pong(duration, line) => {
                println!("Duration: {:?}\t\t(raw: {:?})", duration, line)
            }
            pinger::PingResult::Timeout(line) => println!("Timeout! (raw: {line:?})"),
            pinger::PingResult::Unknown(line) => println!("Unknown line: {:?}", line),
            pinger::PingResult::PingExited(code, stderr) => {
                panic!("Ping exited! Code: {:?}. Stderr: {:?}", code, stderr)
            }
        }
    }
}

```

### Core Architecture Module: `pinger/examples/tcp_ping.rs`
```
use pinger::{ping, PingMode, PingOptions, RstBehaviour};
use std::env;
use std::time::Duration;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: tcp_ping <host> [port]");
        return;
    }

    let host = &args[1];
    let port: u16 = if args.len() >= 3 {
        args[2].parse().expect("Port must be a number")
    } else {
        80 // default port
    };

    let opts = PingOptions::new(host, Duration::from_secs(1), None).with_mode(PingMode::TCP {
        rst: RstBehaviour::Pong,
        port: Some(port),
    });

    let rx = ping(opts).expect("Failed to start TCP ping");

    for result in rx {
        match result {
            pinger::PingResult::Pong(dur, target) => {
                println!("PONG {} in {:?}", target, dur);
            }
            pinger::PingResult::Timeout(target) => {
                println!("TIMEOUT {}", target);
            }
            pinger::PingResult::Unknown(target) => {
                println!("UNKNOWN {}", target);
            }
            pinger::PingResult::PingExited(_, _) => {}
        }
    }
}

```

### Core Architecture Module: `pinger/src/bsd.rs`
```
use crate::{extract_regex, PingCreationError, PingOptions, PingResult, Pinger};
use lazy_regex::*;

pub static RE: Lazy<Regex> = lazy_regex!(r"time=(?:(?P<ms>[0-9]+).(?P<ns>[0-9]+)\s+ms)");

pub struct BSDPinger {
    options: PingOptions,
}

pub(crate) fn parse_bsd(line: String) -> Option<PingResult> {
    if line.starts_with("PING ") {
        return None;
    }
    if line.starts_with("Request timeout") {
        return Some(PingResult::Timeout(line));
    }
    extract_regex(&RE, line)
}

impl Pinger for BSDPinger {
    fn from_options(options: PingOptions) -> Result<Self, PingCreationError>
    where
        Self: Sized,
    {
        Ok(Self { options })
    }

    fn parse_fn(&self) -> fn(String) -> Option<PingResult> {
        parse_bsd
    }

    fn ping_args(&self) -> (&str, Vec<String>) {
        let mut args = vec![format!(
            "-i{:.1}",
            self.options.interval.as_millis() as f32 / 1_000_f32
        )];
        if let Some(interface) = &self.options.interface {
            args.push("-I".into());
            args.push(interface.clone());
        }
        if let Some(raw_args) = &self.options.raw_arguments {
            args.extend(raw_args.iter().cloned());
        }
        args.push(self.options.target.to_string());
        ("ping", args)
    }
}

```

### Core Architecture Module: `pinger/src/fake.rs`
```
use crate::{PingCreationError, PingOptions, PingResult, Pinger};
use rand::prelude::*;
use rand::rng;
use std::sync::mpsc;
use std::sync::mpsc::Receiver;
use std::thread;
use std::time::Duration;

pub struct FakePinger {
    options: PingOptions,
}

impl Pinger for FakePinger {
    fn from_options(options: PingOptions) -> Result<Self, PingCreationError>
    where
        Self: Sized,
    {
        Ok(Self { options })
    }

    fn parse_fn(&self) -> fn(String) -> Option<PingResult> {
        unimplemented!("parse for FakeParser not implemented")
    }

    fn ping_args(&self) -> (&str, Vec<String>) {
        unimplemented!("ping_args not implemented for FakePinger")
    }

    fn start(&self) -> Result<Receiver<PingResult>, PingCreationError> {
        let (tx, rx) = mpsc::channel();
        let sleep_time = self.options.interval;

        thread::spawn(move || {
            let mut random = rng();
            loop {
                let fake_seconds = random.random_range(50..150);
                let ping_result = PingResult::Pong(
                    Duration::from_millis(fake_seconds),
                    format!("Fake ping line: {fake_seconds} ms"),
                );
                if tx.send(ping_result).is_err() {
                    break;
                }

                std::thread::sleep(sleep_time);
            }
        });

        Ok(rx)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #490** (2025-01-31): **some issues if ip unreachable**
  *Symptoms*: - press `q` can not exit - `—clear` option not working( press `ctrl-c` to exit)
  **Post-Mortem & Fix Analysis**:
  > What version of `gping` are you running, and on what operating system?
  > > What version of `gping` are you running, and on what operating system?  It might be latest version on Oct, looks an error before  pinging.  `gping 1.18.0` looks good 
  >  ~ > ping 2409:8a55:8631:4490:5a47:caff:fe74:7196 PING(56=40+8+8 bytes)  --> 2409:8a55:8631:4490:5a47:caff:fe74:7196 ^C --- 2409:8a55:8631:4490:5a47:caff:fe74:7196 ping statistics --- 26 packets transmitted, 0 packets received, 100.0% packet loss   <img width="1208" alt="Image" src="https://github.com/user-attachments/assets/87b6efe2-2d5f-4516-b883-bf9aac3eabd2" />  press ```q``` cannot exit on Mac and freebad , linux is can exit when press ```q```

- **Issue #450** (2024-12-16): **-4 is using ICMPv6**
  *Symptoms*: If you provide the '-4' flag the IPv4 address will be shown. But if you look into the packages IPv6 package are send.
  **Post-Mortem & Fix Analysis**:
  > Can you be more clear? What OS are you using, and what specific command are you running?
  > I'm using Manjaro. - make sure you have a internet connection with IPv4 and IPv6 working. - start `tcpdump -i <interface> -n 'icmp or icmp6'` in the background - watch the difference between `gping google.com` and `gping google.com -4`  gping shows different IPs(4/6), but tcpdump shows only IPv6.
  > Thank you for this information, it is really helpful. I’ll take a look.   Could you also give me the version of ping you’re using? That should be all I need to fix this.

- **Issue #440** (2024-12-16): **Interface Switch does not work in Windows**
  *Symptoms*: It appears that regardless of what you provide with -i or --interface, windows ignores that and does not send out the traffic out of the specified interface.  I tested by putting in a fake interface name and it still sent out pings.  Verified in wireshark that no traffic was going out the interface I did specify during initial testing.  gping 1.16.1 commit_hash: a46bd72d build_time: 2024-02-17 11:50:08 +00:00 build_env: rustc 1.76.0 (07dca489a 2024-02-04),stable-x86_64-pc-windows-msvc
  **Post-Mortem & Fix Analysis**:
  > This isn't easy to fix, especially as the crate we are using (https://docs.rs/winping/) is pretty old and doesn't support it. For now I've disabled the interface flag on Windows so that this is less confusing.

- **Issue #412** (2024-12-16): **Hope to increase support for Chinese domain names**
  *Symptoms*: ![73E4E071-4A48-4eb6-811F-37508A87359E](https://github.com/orf/gping/assets/68273012/3b2ba022-d732-4014-b2ce-70ba9e9ad200) 
  **Post-Mortem & Fix Analysis**:
  > Thanks! I've fixed this 👍 

- **Issue #392** (2026-08-31): **Choose a more sensible default interval on OpenBSD.**
  *Symptoms*: ``` $ gping google.com there was an error running ping: exit status: 1 Stderr: ping: only root may use an interval smaller than one second ```  Perhaps set the default interval to `1` for OpenBSD then?  Thanks 
  **Post-Mortem & Fix Analysis**:
  > Related: https://github.com/orf/gping/issues/236
  > Just a very late follow up: I posted about this on the freebsd hackers list: https://mail-archive.freebsd.org/cgi/getmsg.cgi?fetch=232859+0+archive/2024/freebsd-hackers/20240325.freebsd-hackers  The minimum of 1 second is a very stupid legacy default and I feel quite annoyed by it. I guess I’ll begrudgingly add this,  it not too happy about it  

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

### Incident Patch 1: `75084000` (2026-08-31)
**Commit Message**: Fix graph axis

**File**: `gping/src/main.rs` (modified, +123/-22)
```diff
@@ -8,7 +8,6 @@ use std::io;
 use std::io::BufWriter;
 use std::iter;
 use std::net::{IpAddr, ToSocketAddrs};
-use std::ops::Add;
 use std::path::Path;
 use std::process::{Command, ExitStatus, Stdio};
 use std::sync::atomic::{AtomicBool, Ordering};
@@ -152,32 +151,38 @@ impl App {
     fn y_axis_bounds(&self) -> [f64; 2] {
         // Find the Y axis bounds for our chart.
         // This is trickier than the x-axis. We iterate through all our PlotData structs
-        // and find the min/max of all the values. Then we add a 10% buffer to them.
+        // and find the min/max of all the values, then add a 10% buffer to each end so
+        // the data doesn't sit right on the edge of the graph.
         let (ymin, ymax) = self.yrange;
-        let (mut min, mut max) = match self
+        let (data_min, data_max) = match self
             .data
             .iter()
             .flat_map(|b| b.data.as_slice())
             .map(|v| v.1)
             .filter(|v| !v.is_nan())
             .minmax()
         {
-            MinMaxResult::NoElements => (f64::INFINITY, 0_f64),
-            MinMaxResult::OneElement(elm) => (ymin.unwrap_or(elm), elm),
-            MinMaxResult::MinMax(min, max) => (ymin.unwrap_or(min), ymax.unwrap_or(max)),
+            // Nothing has come back yet, so there is nothing to scale to.
+            MinMaxResult::NoElements => (0_f64, 0_f64),
+            MinMaxResult::OneElement(elm) => (elm, elm),
+            MinMaxResult::MinMax(min, max) => (min, max),
         };
 
-        // Reject negative bounds
-        // Show at least 1 ms of y-axis
-        if ymin.is_some() {
-            min = min.clamp(0.0, f64::INFINITY);
-            max = max.clamp(min + 1000.0, f64::INFINITY);
+        // A bound the user pinned with --ymin/--ymax is used verbatim. The buffer only
+        // makes sense for a bound we derived from the data: an explicit bound is a
+        // request for the axis to end exactly there, so padding it past the requested
+        // value would be wrong.
+        let mut min = ymin.unwrap_or(data_min - (data_min * 10_f64) / 100_f64);
+        let mut max = ymax.unwrap_or(data_max + (data_max * 10_f64) / 100_f64);
+
+        // Reject negative bounds, and never let the axis collapse to zero height (no
+        // data yet, or --ymin and --ymax given the same value).
+        min = min.max(0_f64);
+        if max <= min {
+            max = min + 1000_f64;
         }
 
-        // Add a 10% buffer to the top and bottom
-        let pos_margin = (max * 10_f64) / 100_f64;
-        let neg_margin = (min * 10_f64) / 100_f64;
-        [min - neg_margin, max + pos_margin]
+        [min, max]
     }
 
     fn x_axis_bounds(&self) -> [f64; 2] {
@@ -214,17 +219,19 @@ impl App {
 
     fn y_axis_labels(&self, bounds: [f64; 2]) -> Vec<Span<'_>> {
         // Create 7 labels for our y axis, based on the y-axis bounds we computed above.
-        let min = bounds[0];
-        let max = bounds[1];
-
+        // They are drawn evenly from the bottom row of the graph up to the top one, so
+        // the last label lands on the upper bound itself: the range is split into 6
+        // gaps, not 7. Splitting it into 7 puts every label below the value it is
+        // labelling, and makes the top of the axis read as 6/7ths of the real maximum.
+        let [min, max] = bounds;
         let difference = max - min;
         let num_labels = 7;
-        // Split difference into one chunk for each of the 7 labels
-        let increment = Duration::from_micros((difference / num_labels as f64) as u64);
-        let duration = Duration::from_micros(min as u64);
 
         (0..num_labels)
-            .map(|i| Span::raw(format!("{:?}", duration.add(increment * i))))
+            .map(|i| {
+                let value = min + (difference * i as f64) / (num_labels - 1) as f64;
+                Span::raw(format!("{:?}", Duration::from_micros(value as u64)))
+            })
             .collect()
     }
 }
@@ -635,3 +642
```

---

### Incident Patch 2: `2b9da232` (2026-08-31)
**Commit Message**: Fix off-by-one that leaves one stale point in the graph buffer (#580)

drain(0..idx) skips the element at idx, but idx is the index of the last
point that's actually older than the buffer window (it matched the filter
right above). So every update() call quietly leaves exactly one out-of-window
sample sitting in the data, forever. Switched it to drain(0..=idx) and added
a test that seeds a few stale/fresh points and checks nothing older than the
window survives after update().

**File**: `gping/src/plot_data.rs` (modified, +35/-1)
```diff
@@ -45,7 +45,10 @@ impl PlotData {
             .map(|(idx, _)| idx)
             .next_back();
         if let Some(idx) = last_idx {
-            self.data.drain(0..idx).for_each(drop)
+            // `idx` itself is still stale (it matched the filter above), so it must be
+            // included in the drained range too, otherwise one out-of-window point is
+            // always left behind.
+            self.data.drain(0..=idx).for_each(drop)
         }
     }
 
@@ -139,6 +142,37 @@ impl<'a> From<&'a PlotData> for Dataset<'a> {
 mod tests {
     use super::*;
 
+    // Regression test for the buffer trim in `PlotData::update`: every point older than
+    // `buffer` seconds should be dropped, including the single oldest stale point, which
+    // used to survive because `drain(0..idx)` excluded the boundary index itself.
+    #[test]
+    fn update_drops_all_points_outside_the_buffer_window() {
+        let buffer_secs = 5u64;
+        let mut plot = PlotData::new("host".to_string(), buffer_secs, Style::default(), false);
+
+        let now = Local::now().timestamp_millis() as f64 / 1_000f64;
+
+        // Seed with a mix of stale (older than the buffer window) and fresh points,
+        // pushed in ascending timestamp order like the real update loop would.
+        plot.data.push((now - 10.0, 100.0)); // stale
+        plot.data.push((now - 8.0, 200.0)); // stale
+        plot.data.push((now - 6.0, 300.0)); // stale, closest to the boundary
+        plot.data.push((now - 2.0, 400.0)); // fresh
+        plot.data.push((now - 1.0, 500.0)); // fresh
+
+        // Triggers the trim logic; also appends one brand-new point.
+        plot.update(Some(Duration::from_millis(42)));
+
+        let earliest_allowed = now - buffer_secs as f64;
+        for &(timestamp, _) in &plot.data {
+            assert!(
+                timestamp >= earliest_allowed,
+                "found a point at {timestamp}, which is older than the buffer window start {earliest_allowed}; data: {:?}",
+                plot.data
+            );
+        }
+    }
+
     #[test]
     fn test_jitter_uses_chronological_order() {
         // Oscillating latencies: sorted-order "jitter" would telescope down to
```

---

### Incident Patch 3: `e3dcaf29` (2026-08-31)
**Commit Message**: fix: use one second default ping interval on OpenBSD (#574)

Co-authored-by: xfocus3 <xfocus3@users.noreply.github.com>

**File**: `gping.1` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Ping, but with a graph.
 Graph the execution time for a list of commands rather than pinging hosts
 .TP
 \fB\-n\fR, \fB\-\-watch\-interval\fR \fI<WATCH_INTERVAL>\fR
-Watch interval seconds (provide partial seconds like \*(Aq0.5\*(Aq). Default for ping is 0.2, default for cmd is 0.5
+Watch interval seconds (provide partial seconds like \*(Aq0.5\*(Aq). Default for ping is 0.2 (1.0 on OpenBSD), default for cmd is 0.5
 .TP
 \fB\-b\fR, \fB\-\-buffer\fR \fI<BUFFER>\fR [default: 30]
 Determines the number of seconds to display in the graph
```

**File**: `gping/src/main.rs` (modified, +13/-4)
```diff
@@ -38,14 +38,20 @@ mod region_map;
 use colors::Colors;
 use tui::prelude::Position;
 
+#[cfg(target_os = "openbsd")]
+const DEFAULT_PING_INTERVAL_SECONDS: f32 = 1.0;
+#[cfg(not(target_os = "openbsd"))]
+const DEFAULT_PING_INTERVAL_SECONDS: f32 = 0.2;
+const DEFAULT_CMD_INTERVAL_SECONDS: f32 = 0.5;
+
 #[derive(Parser, Debug)]
 #[command(author, version, name = "gping", about = "Ping, but with a graph.", styles = clap_cargo::style::CLAP_STYLING)]
 struct Args {
     /// Graph the execution time for a list of commands rather than pinging hosts
     #[arg(long)]
     cmd: bool,
 
-    /// Watch interval seconds (provide partial seconds like '0.5'). Default for ping is 0.2, default for cmd is 0.5.
+    /// Watch interval seconds (provide partial seconds like '0.5'). Default for ping is 0.2 (1.0 on OpenBSD), default for cmd is 0.5.
     #[arg(short = 'n', long)]
     watch_interval: Option<f32>,
 
@@ -254,7 +260,9 @@ fn start_cmd_thread(
         .to_string();
     let cmd_args = words.map(|w| w.to_string()).collect::<Vec<String>>();
 
-    let interval = Duration::from_millis((watch_interval.unwrap_or(0.5) * 1000.0) as u64);
+    let interval = Duration::from_millis(
+        (watch_interval.unwrap_or(DEFAULT_CMD_INTERVAL_SECONDS) * 1000.0) as u64,
+    );
 
     // Pump cmd watches into the queue
     thread::spawn(move || -> Result<()> {
@@ -414,8 +422,9 @@ fn main() -> Result<()> {
             );
             threads.push(cmd_thread);
         } else {
-            let interval =
-                Duration::from_millis((args.watch_interval.unwrap_or(0.2) * 1000.0) as u64);
+            let interval = Duration::from_millis(
+                (args.watch_interval.unwrap_or(DEFAULT_PING_INTERVAL_SECONDS) * 1000.0) as u64,
+            );
 
             let mut ping_opts = if args.ipv4 {
                 PingOptions::new_ipv4(host_or_cmd, interval, interface.clone())
```

---

### Incident Patch 4: `d5a248f5` (2026-08-31)
**Commit Message**: Fix clippy

**File**: `pinger/src/test.rs` (modified, +2/-2)
```diff
@@ -95,8 +95,8 @@ mod tests {
             parsed.len(),
             expected.len(),
             "Parsed: {:?}, Expected: {:?}",
-            &parsed,
-            &expected
+            parsed,
+            expected
         );
 
         for (idx, (output, expected)) in parsed.into_iter().zip(expected).enumerate() {
```

---

### Incident Patch 5: `0dd7a048` (2026-08-30)
**Commit Message**: Merge pull request #590 from VXNCXNX/fix/jitter-chronological

Compute jitter in chronological order, not sorted order

**File**: `gping/src/plot_data.rs` (modified, +56/-6)
```diff
@@ -51,6 +51,15 @@ impl PlotData {
 
     pub fn header_stats(&self) -> Vec<Paragraph<'_>> {
         let ping_header = Paragraph::new(self.display.clone()).style(self.style);
+        // Chronologically-ordered (i.e. not sorted) latencies, used for the jitter
+        // calculation which needs to compare consecutive samples in the order they
+        // actually occurred.
+        let chronological: Vec<f64> = self
+            .data
+            .iter()
+            .filter(|(_, x)| !x.is_nan())
+            .map(|(_, v)| *v)
+            .collect();
         let items: Vec<&f64> = self
             .data
             .iter()
@@ -65,12 +74,7 @@ impl PlotData {
         let min = **items.first().unwrap();
         let max = **items.last().unwrap();
         let avg = items.iter().copied().sum::<f64>() / items.len() as f64;
-        let jtr = items
-            .iter()
-            .zip(items.iter().skip(1))
-            .map(|(&prev, &curr)| (curr - prev).abs())
-            .sum::<f64>()
-            / (items.len() - 1) as f64;
+        let jtr = jitter(&chronological);
 
         let percentile_position = 0.95 * items.len() as f32;
         let rounded_position = percentile_position.round() as usize;
@@ -100,6 +104,22 @@ impl PlotData {
     }
 }
 
+/// Average absolute difference between consecutive values, taken in the order
+/// they are given (i.e. the caller is responsible for passing them in
+/// chronological order, not sorted). With fewer than two values there is no
+/// consecutive pair to compare, so jitter is reported as 0.
+fn jitter(values: &[f64]) -> f64 {
+    if values.len() < 2 {
+        return 0.0;
+    }
+    values
+        .iter()
+        .zip(values.iter().skip(1))
+        .map(|(prev, curr)| (curr - prev).abs())
+        .sum::<f64>()
+        / (values.len() - 1) as f64
+}
+
 impl<'a> From<&'a PlotData> for Dataset<'a> {
     fn from(plot: &'a PlotData) -> Self {
         let slice = plot.data.as_slice();
@@ -114,3 +134,33 @@ impl<'a> From<&'a PlotData> for Dataset<'a> {
             .data(slice)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_jitter_uses_chronological_order() {
+        // Oscillating latencies: sorted-order "jitter" would telescope down to
+        // (max - min) / (n - 1) = (90 - 10) / 5 = 16, which is really a range
+        // statistic, not jitter. In chronological order every consecutive pair
+        // differs by 80, so the real jitter should be 80.
+        let values = vec![10.0, 90.0, 10.0, 90.0, 10.0, 90.0];
+
+        let sorted_order_value = (90.0 - 10.0) / (values.len() - 1) as f64;
+        let result = jitter(&values);
+
+        assert_eq!(result, 80.0);
+        assert_ne!(result, sorted_order_value);
+    }
+
+    #[test]
+    fn test_jitter_single_sample_is_zero() {
+        assert_eq!(jitter(&[42.0]), 0.0);
+    }
+
+    #[test]
+    fn test_jitter_empty_is_zero() {
+        assert_eq!(jitter(&[]), 0.0);
+    }
+}
```

---

### Incident Patch 6: `5dda0e4f` (2026-06-24)
**Commit Message**: Fix docker build and push

**File**: `.github/workflows/docker.yml` (modified, +2/-2)
```diff
@@ -41,7 +41,7 @@ jobs:
         uses: docker/setup-buildx-action@v4
 
       - name: Log in to the Container registry
-        if: github.event_name == 'tag' || github.ref_name == 'master'
+        if: startsWith(github.ref, 'refs/tags/') || github.ref_name == 'master'
         uses: docker/login-action@v4
         with:
           registry: ${{ env.REGISTRY }}
@@ -58,7 +58,7 @@ jobs:
         uses: docker/build-push-action@v7
         with:
           context: .
-          push: ${{ github.event_name == 'tag' || github.ref_name == 'master' }}
+          push: ${{ startsWith(github.ref, 'refs/tags/') || github.ref_name == 'master' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
           platforms: |
```

---

### Incident Patch 7: `22052cf8` (2026-06-14)
**Commit Message**: fix: don't hard code expected bytes

Hard coding the expected returned bytes prevents the user from specifying the size argument via --ping_args, which is useful for troubleshooting.

**File**: `pinger/src/linux.rs` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ impl Pinger for LinuxPinger {
         |line| {
             #[cfg(test)]
             eprintln!("Got line {line}");
-            if line.starts_with("64 bytes from") {
+            if line.contains("bytes from") {
                 return extract_regex(&UBUNTU_RE, line);
             } else if line.starts_with("no answer yet") {
                 return Some(PingResult::Timeout(line));
```

---

### Incident Patch 8: `0f1c7683` (2025-08-15)
**Commit Message**: Fix runs-on

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ jobs:
 
   checks:
     name: Checks
-    runs-on: ubuntu-20.04
+    runs-on: ubuntu-latest
     steps:
       - name: Checkout sources
         uses: actions/checkout@v4
```

---

### Incident Patch 9: `3981e943` (2025-08-15)
**Commit Message**: Fix windows dead code

**File**: `pinger/src/test.rs` (modified, +12/-0)
```diff
@@ -1,7 +1,10 @@
 #[cfg(test)]
 mod tests {
+    #[cfg(unix)]
     use crate::bsd::BSDPinger;
+    #[cfg(unix)]
     use crate::linux::LinuxPinger;
+    #[cfg(unix)]
     use crate::macos::MacOSPinger;
     #[cfg(windows)]
     use crate::windows::WindowsPinger;
@@ -109,31 +112,37 @@ mod tests {
         }
     }
 
+    #[cfg(unix)]
     #[test]
     fn macos() {
         test_parser::<MacOSPinger>(include_str!("tests/macos.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn freebsd() {
         test_parser::<BSDPinger>(include_str!("tests/bsd.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn dragonfly() {
         test_parser::<BSDPinger>(include_str!("tests/bsd.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn openbsd() {
         test_parser::<BSDPinger>(include_str!("tests/bsd.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn netbsd() {
         test_parser::<BSDPinger>(include_str!("tests/bsd.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn ubuntu() {
         run_parser_test(
@@ -142,6 +151,7 @@ mod tests {
         );
     }
 
+    #[cfg(unix)]
     #[test]
     fn debian() {
         run_parser_test(
@@ -156,6 +166,7 @@ mod tests {
         test_parser::<WindowsPinger>(include_str!("tests/windows.txt"));
     }
 
+    #[cfg(unix)]
     #[test]
     fn android() {
         run_parser_test(
@@ -164,6 +175,7 @@ mod tests {
         );
     }
 
+    #[cfg(unix)]
     #[test]
     fn alpine() {
         run_parser_test(
```

---

### Incident Patch 10: `03fa1e20` (2025-08-15)
**Commit Message**: Fix windows dead code

**File**: `pinger/src/lib.rs` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ use thiserror::Error;
 
 #[cfg(unix)]
 pub mod linux;
-#[cfg(target_os = "macos")]
+#[cfg(unix)]
 pub mod macos;
 #[cfg(windows)]
 pub mod windows;
```

#### Recent Merged Pull Requests:
- **PR #599** (closed): chore(deps): bump the dependencies group across 1 directory with 2 updates (@dependabot[bot])
- **PR #597** (2026-09-22): Add WinGet installation instructions (@gschizas)
- **PR #596** (closed): chore(deps): bump clap from 4.6.6 to 4.6.7 in the dependencies group across 1 directory (@dependabot[bot])
- **PR #592** (2026-08-31): chore(deps): bump the dependencies group across 1 directory with 7 updates (@dependabot[bot])
- **PR #590** (2026-08-30): Compute jitter in chronological order, not sorted order (@VXNCXNX)
- **PR #589** (closed): chore(deps): bump the dependencies group across 1 directory with 6 updates (@dependabot[bot])
- **PR #588** (2026-08-31): chore(deps): bump actions/setup-python from 6 to 7 in the dependencies group across 1 directory (@dependabot[bot])
- **PR #587** (closed): chore(deps): bump the dependencies group across 1 directory with 5 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
