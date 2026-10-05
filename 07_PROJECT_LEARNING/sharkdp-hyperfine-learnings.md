# Forensic Learning Record (Deep Inspection): sharkdp/hyperfine

> **Canonical Artifact**: `07_PROJECT_LEARNING/sharkdp-hyperfine-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sharkdp/hyperfine](https://github.com/sharkdp/hyperfine))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:04.467Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sharkdp/hyperfine`
- **Description**: A command-line benchmarking tool
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 28946 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util/exit_code.rs`
```
use std::process::ExitStatus;

#[cfg(unix)]
pub fn extract_exit_code(status: ExitStatus) -> Option<i32> {
    use std::os::unix::process::ExitStatusExt;

    // From the ExitStatus::code documentation:
    //
    //   "On Unix, this will return None if the process was terminated by a signal."
    //
    // In that case, ExitStatusExt::signal should never return None.
    //
    // To differentiate between "normal" exit codes and signals, we are using a technique
    // similar to bash (https://tldp.org/LDP/abs/html/exitcodes.html) and add 128 to the
    // signal value.
    status.code().or_else(|| status.signal().map(|s| s + 128))
}

#[cfg(not(unix))]
pub fn extract_exit_code(status: ExitStatus) -> Option<i32> {
    status.code()
}

```

### Core Architecture Module: `src/util/mod.rs`
```
pub mod exit_code;
pub mod number;
pub mod randomized_environment_offset;

```

### Core Architecture Module: `src/util/number.rs`
```
use std::convert::TryFrom;
use std::fmt;

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Copy, PartialEq, Eq)]
#[serde(untagged)]
pub enum Number {
    Int(i32),
    Decimal(Decimal),
}

impl fmt::Display for Number {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Number::Int(i) => fmt::Display::fmt(&i, f),
            Number::Decimal(i) => fmt::Display::fmt(&i, f),
        }
    }
}

impl From<i32> for Number {
    fn from(x: i32) -> Number {
        Number::Int(x)
    }
}

impl From<Decimal> for Number {
    fn from(x: Decimal) -> Number {
        Number::Decimal(x)
    }
}

impl TryFrom<Number> for usize {
    type Error = ();

    fn try_from(numeric: Number) -> Result<Self, Self::Error> {
        match numeric {
            Number::Int(i) => usize::try_from(i).map_err(|_| ()),
            Number::Decimal(d) => match d.to_u64() {
                Some(u) => usize::try_from(u).map_err(|_| ()),
                None => Err(()),
            },
        }
    }
}

```

### Core Architecture Module: `src/util/randomized_environment_offset.rs`
```
/// Returns a string with a random length. This value will be set as an environment
/// variable to account for offset effects. See [1] for more details.
///
/// [1] Mytkowicz, 2009. Producing Wrong Data Without Doing Anything Obviously Wrong!.
///     Sigplan Notices - SIGPLAN. 44. 265-276. 10.1145/1508284.1508275.
pub fn value() -> String {
    "X".repeat(rand::random_range(0..4096))
}

```

### Core Architecture Module: `scripts/advanced_statistics.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy",
# ]
# ///

import argparse
import json
from enum import Enum

import numpy as np


class Unit(Enum):
    SECOND = 1
    MILLISECOND = 2

    def factor(self):
        match self:
            case Unit.SECOND:
                return 1
            case Unit.MILLISECOND:
                return 1e3

    def __str__(self):
        match self:
            case Unit.SECOND:
                return "s"
            case Unit.MILLISECOND:
                return "ms"


parser = argparse.ArgumentParser()
parser.add_argument("file", help="JSON file with benchmark results")
parser.add_argument(
    "--time-unit",
    help="The unit of time.",
    default="second",
    action="store",
    choices=["second", "millisecond"],
    dest="unit",
)
args = parser.parse_args()

unit = Unit.MILLISECOND if args.unit == "millisecond" else Unit.SECOND
unit_str = str(unit)

with open(args.file) as f:
    results = json.load(f)["results"]

commands = [b["command"] for b in results]
times = [b["times"] for b in results]

for command, ts in zip(commands, times):
    ts = [t * unit.factor() for t in ts]

    p05 = np.percentile(ts, 5)
    p25 = np.percentile(ts, 25)
    p75 = np.percentile(ts, 75)
    p95 = np.percentile(ts, 95)

    iqr = p75 - p25

    print(f"Command '{command}'")
    print(f"  runs:   {len(ts):8d}")
    print(f"  mean:   {np.mean(ts):8.3f} {unit_str}")
    print(f"  stddev: {np.std(ts, ddof=1):8.3f} {unit_str}")
    print(f"  median: {np.median(ts):8.3f} {unit_str}")
    print(f"  min:    {np.min(ts):8.3f} {unit_str}")
    print(f"  max:    {np.max(ts):8.3f} {unit_str}")
    print()
    print("  percentiles:")
    print(f"     P_05 .. P_95:    {p05:.3f} {unit_str} .. {p95:.3f} {unit_str}")
    print(
        f"     P_25 .. P_75:    {p25:.3f} {unit_str} .. {p75:.3f} {unit_str}  (IQR = {iqr:.3f} {unit_str})"
    )
    print()

```

### Core Architecture Module: `scripts/plot_benchmark_comparison.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
#     "pyqt6",
#     "numpy",
# ]
# ///

"""
This script shows `hyperfine` benchmark results as a bar plot grouped by command.
Note all the input files must contain results for all commands.
"""

import argparse
import json
import pathlib

import matplotlib.pyplot as plt
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "files", nargs="+", type=pathlib.Path, help="JSON files with benchmark results"
)
parser.add_argument("--title", help="Plot Title")
parser.add_argument(
    "--benchmark-names", nargs="+", help="Names of the benchmark groups"
)
parser.add_argument("-o", "--output", help="Save image to the given filename")

args = parser.parse_args()

commands = None
data = []
inputs = []

if args.benchmark_names:
    assert len(args.files) == len(
        args.benchmark_names
    ), "Number of benchmark names must match the number of input files."

for i, filename in enumerate(args.files):
    with open(filename) as f:
        results = json.load(f)["results"]
    benchmark_commands = [b["command"] for b in results]
    if commands is None:
        commands = benchmark_commands
    else:
        assert (
            commands == benchmark_commands
        ), f"Unexpected commands in {filename}: {benchmark_commands}, expected: {commands}"
    data.append([round(b["mean"], 2) for b in results])
    if args.benchmark_names:
        inputs.append(args.benchmark_names[i])
    else:
        inputs.append(filename.stem)

data = np.transpose(data)
x = np.arange(len(inputs))  # the label locations
width = 0.25  # the width of the bars

fig, ax = plt.subplots(layout="constrained")
fig.set_figheight(5)
fig.set_figwidth(10)
for i, command in enumerate(commands):
    offset = width * (i + 1)
    rects = ax.bar(x + offset, data[i], width, label=command)

ax.set_xticks(x + 0.5, inputs)
ax.grid(visible=True, axis="y")

if args.title:
    plt.title(args.title)
plt.xlabel("Benchmark")
plt.ylabel("Time [s]")
plt.legend(title="Command")

if args.output:
    plt.savefig(args.output)
else:
    plt.show()

```

### Core Architecture Module: `scripts/plot_histogram.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
#     "pyqt6",
#     "numpy",
# ]
# ///

"""This program shows `hyperfine` benchmark results as a histogram."""

import argparse
import json

import matplotlib.pyplot as plt
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", help="JSON file with benchmark results")
parser.add_argument("--title", help="Plot title")
parser.add_argument(
    "--labels", help="Comma-separated list of entries for the plot legend"
)
parser.add_argument("--bins", help="Number of bins (default: auto)")
parser.add_argument(
    "--legend-location",
    help="Location of the legend on plot (default: upper center)",
    choices=[
        "upper center",
        "lower center",
        "right",
        "left",
        "best",
        "upper left",
        "upper right",
        "lower left",
        "lower right",
        "center left",
        "center right",
        "center",
    ],
    default="upper center",
)
parser.add_argument(
    "--type", help="Type of histogram (*bar*, barstacked, step, stepfilled)"
)
parser.add_argument("-o", "--output", help="Save image to the given filename.")
parser.add_argument(
    "--t-min", metavar="T", help="Minimum time to be displayed (seconds)"
)
parser.add_argument(
    "--t-max", metavar="T", help="Maximum time to be displayed (seconds)"
)
parser.add_argument(
    "--log-count",
    help="Use a logarithmic y-axis for the event count",
    action="store_true",
)

args = parser.parse_args()

with open(args.file) as f:
    results = json.load(f)["results"]

if args.labels:
    labels = args.labels.split(",")
else:
    labels = [b["command"] for b in results]
all_times = [b["times"] for b in results]

t_min = float(args.t_min) if args.t_min else np.min(list(map(np.min, all_times)))
t_max = float(args.t_max) if args.t_max else np.max(list(map(np.max, all_times)))

bins = int(args.bins) if args.bins else "auto"
histtype = args.type if args.type else "bar"

plt.figure(figsize=(10, 5))
plt.hist(
    all_times,
    label=labels,
    bins=bins,
    histtype=histtype,
    range=(t_min, t_max),
)
plt.legend(
    loc=args.legend_location,
    fancybox=True,
    shadow=True,
    prop={"size": 10, "family": ["Source Code Pro", "Fira Mono", "Courier New"]},
)

plt.xlabel("Time [s]")
if args.title:
    plt.title(args.title)

if args.log_count:
    plt.yscale("log")
else:
    plt.ylim(0, None)

if args.output:
    plt.savefig(args.output, dpi=600)
else:
    plt.show()

```

### Core Architecture Module: `scripts/plot_parametrized.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
#     "pyqt6",
# ]
# ///

"""This program shows parametrized `hyperfine` benchmark results as an
errorbar plot."""

import argparse
import json
import sys

import matplotlib.pyplot as plt

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", help="JSON file with benchmark results", nargs="+")
parser.add_argument(
    "--parameter-name",
    metavar="name",
    type=str,
    help="Deprecated; parameter names are now inferred from benchmark files",
)
parser.add_argument(
    "--log-x", help="Use a logarithmic x (parameter) axis", action="store_true"
)
parser.add_argument(
    "--log-time", help="Use a logarithmic time axis", action="store_true"
)
parser.add_argument(
    "--titles", help="Comma-separated list of titles for the plot legend"
)
parser.add_argument("-o", "--output", help="Save image to the given filename.")

args = parser.parse_args()
if args.parameter_name is not None:
    sys.stderr.write(
        "warning: --parameter-name is deprecated; names are inferred from "
        "benchmark results\n"
    )


def die(msg):
    sys.stderr.write(f"fatal: {msg}\n")
    sys.exit(1)


def extract_parameters(results):
    """Return `(parameter_name: str, parameter_values: List[float])`."""
    if not results:
        die("no benchmark data to plot")
    (names, values) = zip(*(unique_parameter(b) for b in results))
    names = frozenset(names)
    if len(names) != 1:
        die(
            f"benchmarks must all have the same parameter name, but found: {sorted(names)}"
        )
    return (next(iter(names)), list(values))


def unique_parameter(benchmark):
    """Return the unique parameter `(name: str, value: float)`, or die."""
    params_dict = benchmark.get("parameters", {})
    if not params_dict:
        die("benchmarks must have exactly one parameter, but found none")
    if len(params_dict) > 1:
        die(
            f"benchmarks must have exactly one parameter, but found multiple: {sorted(params_dict)}"
        )
    [(name, value)] = params_dict.items()
    return (name, float(value))


parameter_name = None

for filename in args.file:
    with open(filename) as f:
        results = json.load(f)["results"]

    (this_parameter_name, parameter_values) = extract_parameters(results)
    if parameter_name is not None and this_parameter_name != parameter_name:
        die(
            f"files must all have the same parameter name, but found {parameter_name!r} vs. {this_parameter_name!r}"
        )
    parameter_name = this_parameter_name

    times_mean = [b["mean"] for b in results]
    times_stddev = [b["stddev"] for b in results]

    plt.errorbar(x=parameter_values, y=times_mean, yerr=times_stddev, capsize=2)

plt.xlabel(parameter_name)
plt.ylabel("Time [s]")

if args.log_time:
    plt.yscale("log")
else:
    plt.ylim(0, None)

if args.log_x:
    plt.xscale("log")

if args.titles:
    plt.legend(args.titles.split(","))

if args.output:
    plt.savefig(args.output)
else:
    plt.show()

```

### Core Architecture Module: `scripts/plot_progression.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pyqt6",
#     "matplotlib",
#     "numpy",
# ]
# ///

"""This program shows `hyperfine` benchmark results in a sequential way
in order to debug possible background interference, caching effects,
thermal throttling and similar effects.
"""

import argparse
import json

import matplotlib.pyplot as plt
import numpy as np


def moving_average(times, num_runs):
    times_padded = np.pad(
        times, (num_runs // 2, num_runs - 1 - num_runs // 2), mode="edge"
    )
    kernel = np.ones(num_runs) / num_runs
    return np.convolve(times_padded, kernel, mode="valid")


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", help="JSON file with benchmark results")
parser.add_argument("--title", help="Plot Title")
parser.add_argument("-o", "--output", help="Save image to the given filename.")
parser.add_argument(
    "-w",
    "--moving-average-width",
    type=int,
    metavar="num_runs",
    help="Width of the moving-average window (default: N/5)",
)
parser.add_argument(
    "--no-moving-average",
    action="store_true",
    help="Do not show moving average curve",
)


args = parser.parse_args()

with open(args.file) as f:
    results = json.load(f)["results"]

for result in results:
    label = result["command"]
    times = result["times"]
    num = len(times)
    nums = range(num)

    plt.scatter(x=nums, y=times, marker=".")
    plt.ylim([0, None])
    plt.xlim([-1, num])

    if not args.no_moving_average:
        moving_average_width = (
            num // 5 if args.moving_average_width is None else args.moving_average_width
        )

        average = moving_average(times, moving_average_width)
        plt.plot(nums, average, "-")

if args.title:
    plt.title(args.title)

legend = []
for result in results:
    legend.append(result["command"])
    if not args.no_moving_average:
        legend.append("moving average")
plt.legend(legend)

plt.ylabel("Time [s]")

if args.output:
    plt.savefig(args.output)
else:
    plt.show()

```

### Core Architecture Module: `scripts/plot_whisker.py`
```
#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
#     "pyqt6",
# ]
# ///

"""This program shows `hyperfine` benchmark results as a box and whisker plot.

Quoting from the matplotlib documentation:
    The box extends from the lower to upper quartile values of the data, with
    a line at the median. The whiskers extend from the box to show the range
    of the data. Flier points are those past the end of the whiskers.
"""

import argparse
import json

import matplotlib.pyplot as plt

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file", help="JSON file with benchmark results")
parser.add_argument("--title", help="Plot Title")
parser.add_argument("--sort-by", choices=["median"], help="Sort method")
parser.add_argument(
    "--labels", help="Comma-separated list of entries for the plot legend"
)
parser.add_argument("-o", "--output", help="Save image to the given filename.")

args = parser.parse_args()

with open(args.file, encoding="utf-8") as f:
    results = json.load(f)["results"]

if args.labels:
    labels = args.labels.split(",")
else:
    labels = [b["command"] for b in results]
times = [b["times"] for b in results]

if args.sort_by == "median":
    medians = [b["median"] for b in results]
    indices = sorted(range(len(labels)), key=lambda k: medians[k])
    labels = [labels[i] for i in indices]
    times = [times[i] for i in indices]

plt.figure(figsize=(10, 6), constrained_layout=True)
boxplot = plt.boxplot(times, vert=True, patch_artist=True)
cmap = plt.get_cmap("rainbow")
colors = [cmap(val / len(times)) for val in range(len(times))]

for patch, color in zip(boxplot["boxes"], colors):
    patch.set_facecolor(color)

if args.title:
    plt.title(args.title)
plt.legend(handles=boxplot["boxes"], labels=labels, loc="best", fontsize="medium")
plt.ylabel("Time [s]")
plt.ylim(0, None)
plt.xticks(list(range(1, len(labels) + 1)), labels, rotation=45)
if args.output:
    plt.savefig(args.output)
else:
    plt.show()

```

### Core Architecture Module: `src/benchmark/benchmark_result.rs`
```
use std::collections::BTreeMap;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use crate::benchmark::measurement::Measurements;
use crate::quantity::{byte, second, Time};
use crate::util::exit_code::extract_exit_code;

/// Parameter value and whether it was used in the command line template
#[derive(Debug, Default, Clone, Serialize, PartialEq)]
#[serde(transparent)]
pub struct Parameter {
    pub value: String,
    #[serde(skip)]
    pub is_unused: bool,
}

/// Meta data and performance metrics for a single benchmark
#[derive(Debug, Default, Clone, PartialEq)]
pub struct BenchmarkResult {
    /// The full command line of the program that is being benchmarked
    pub command: String,

    /// The full command line, including parameters not used in the command template.
    pub command_with_unused_parameters: String,

    /// Performance measurements and exit statuses for each run
    pub measurements: Measurements,

    /// Parameter values for this benchmark
    pub parameters: BTreeMap<String, Parameter>,
}

impl BenchmarkResult {
    /// The average wall clock time
    pub fn mean_wall_clock_time(&self) -> Time {
        self.measurements.time_wall_clock_mean()
    }
}

// Preserve the existing export format while storing typed measurements internally.
impl Serialize for BenchmarkResult {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct(
            "BenchmarkResult",
            if self.parameters.is_empty() { 11 } else { 12 },
        )?;
        state.serialize_field("command", &self.command)?;
        state.serialize_field("mean", &self.mean_wall_clock_time().get::<second>())?;
        state.serialize_field(
            "stddev",
            &self.measurements.stddev().map(|time| time.get::<second>()),
        )?;
        state.serialize_field("median", &self.measurements.median().get::<second>())?;
        state.serialize_field("user", &self.measurements.time_user_mean().get::<second>())?;
        state.serialize_field(
            "system",
            &self.measurements.time_system_mean().get::<second>(),
        )?;
        state.serialize_field("min", &self.measurements.min().get::<second>())?;
        state.serialize_field("max", &self.measurements.max().get::<second>())?;
        state.serialize_field(
            "times",
            &self
                .measurements
                .wall_clock_times()
                .map(|time| time.get::<second>())
                .collect::<Vec<_>>(),
        )?;
        state.serialize_field(
            "memory_usage_byte",
            &self
                .measurements
                .measurements
                .iter()
                .map(|measurement| measurement.peak_memory_usage.get::<byte>() as u64)
                .collect::<Vec<_>>(),
        )?;
        state.serialize_field(
            "exit_codes",
            &self
                .measurements
                .measurements
                .iter()
                .map(|measurement| extract_exit_code(measurement.exit_status))
                .collect::<Vec<_>>(),
        )?;
        if !self.parameters.is_empty() {
            state.serialize_field("parameters", &self.parameters)?;
        }
        state.end()
    }
}

```

### Core Architecture Module: `src/benchmark/executor.rs`
```
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::ExitStatus;

use crate::command::Command;
use crate::options::{
    CmdFailureAction, CommandInputPolicy, CommandOutputPolicy, Options, OutputStyleOption, Shell,
};
use crate::output::progress_bar::get_progress_bar;
use crate::quantity::{second, Information, Time, Zero};
use crate::timer::execute_and_measure;
use crate::util::randomized_environment_offset;

use super::measurement::{Measurement, Measurements};

use anyhow::{bail, Context, Result};

#[derive(Clone, Copy)]
pub enum BenchmarkIteration {
    NonBenchmarkRun,
    Warmup(u64),
    Benchmark(u64),
}

impl BenchmarkIteration {
    pub fn to_env_var_value(&self) -> Option<String> {
        match self {
            BenchmarkIteration::NonBenchmarkRun => None,
            BenchmarkIteration::Warmup(i) => Some(format!("warmup-{}", i)),
            BenchmarkIteration::Benchmark(i) => Some(format!("{}", i)),
        }
    }
}

pub trait Executor {
    /// Run the given command and measure the execution time
    fn run_command_and_measure(
        &self,
        command: &Command<'_>,
        iteration: BenchmarkIteration,
        command_failure_action: Option<CmdFailureAction>,
        output_policy: &CommandOutputPolicy,
    ) -> Result<Measurement>;

    /// Perform a calibration of this executor. For example,
    /// when running commands through a shell, we need to
    /// measure the shell spawning time separately in order
    /// to subtract it from the full runtime later.
    fn calibrate(&mut self) -> Result<()>;

    /// Return the time overhead for this executor when
    /// performing a measurement. This should return the time
    /// that is being used in addition to the actual runtime
    /// of the command.
    fn time_overhead(&self) -> Time;
}

fn run_command_and_measure_common(
    mut command: std::process::Command,
    iteration: BenchmarkIteration,
    command_failure_action: CmdFailureAction,
    command_input_policy: &CommandInputPolicy,
    command_output_policy: &CommandOutputPolicy,
    command_name: &str,
) -> Result<Measurement> {
    let stdin = command_input_policy.get_stdin()?;
    let (stdout, stderr) = command_output_policy.get_stdout_stderr()?;
    command.stdin(stdin).stdout(stdout).stderr(stderr);

    command.env(
        "HYPERFINE_RANDOMIZED_ENVIRONMENT_OFFSET",
        randomized_environment_offset::value(),
    );

    if let Some(value) = iteration.to_env_var_value() {
        command.env("HYPERFINE_ITERATION", value);
    }

    let result = execute_and_measure(command)
        .with_context(|| format!("Failed to run command '{command_name}'"))?;

    if !result.exit_status.success() {
        use crate::util::exit_code::extract_exit_code;

        let should_fail = match command_failure_action {
            CmdFailureAction::RaiseError => true,
            CmdFailureAction::IgnoreAllFailures => false,
            CmdFailureAction::IgnoreSpecificFailures(ref codes) => {
                // Only fail if the exit code is not in the list of codes to ignore
                if let Some(exit_code) = extract_exit_code(result.exit_status) {
                    !codes.contains(&exit_code)
                } else {
                    // If we can't extract an exit code, treat it as a failure
                    true
                }
            }
        };

        if should_fail {
            let when = match iteration {
                BenchmarkIteration::NonBenchmarkRun => "a non-benchmark run".to_string(),
                BenchmarkIteration::Warmup(0) => "the first warmup run".to_string(),
                BenchmarkIteration::Warmup(i) => format!("warmup iteration {i}"),
                BenchmarkIteration::Benchmark(0) => "the first benchmark run".to_string(),
                BenchmarkIteration::Benchmark(i) => format!("benchmark iteration {i}"),
            };
            bail!(
                "{cause} in {when}. Use the '-i'/'--ignore-failure' option if you want to ignore this. \
                Alternatively, use the '--show-output' option to debug what went wrong.",
                cause=result.exit_status.code().map_or(
                    "The process has been terminated by a signal".into(),
                    |c| format!("Command terminated with non-zero exit code {c}")

                ),
            );
        }
    }

    Ok(result)
}

pub struct RawExecutor<'a> {
    options: &'a Options,
}

impl<'a> RawExecutor<'a> {
    pub fn new(options: &'a Options) -> Self {
        RawExecutor { options }
    }
}

impl Executor for RawExecutor<'_> {
    fn run_command_and_measure(
        &self,
        command: &Command<'_>,
        iteration: BenchmarkIteration,
        command_failure_action: Option<CmdFailureAction>,
        output_policy: &CommandOutputPolicy,
    ) -> Result<Measurement> {
        run_command_and_measure_common(
            command.get_command()?,
            iteration,
            command_failure_action.unwrap_or_else(|| self.options.command_failure_action.clone()),
            &self.options.command_input_policy,
            output_policy,
            &command.get_command_line(),
        )
    }

    fn calibrate(&mut self) -> Result<()> {
        Ok(())
    }

    fn time_overhead(&self) -> Time {
        Time::zero()
    }
}

pub struct ShellExecutor<'a> {
    options: &'a Options,
    shell: &'a Shell,
    shell_spawning_time: Option<Measurement>,
}

impl<'a> ShellExecutor<'a> {
    pub fn new(shell: &'a Shell, options: &'a Options) -> Self {
        ShellExecutor {
            shell,
            options,
            shell_spawning_time: None,
        }
    }
}

impl Executor for ShellExecutor<'_> {
    fn run_command_and_measure(
        &self,
        command: &Command<'_>,
        iteration: BenchmarkIteration,
        command_failure_action: Option<CmdFailureAction>,
        output_policy: &CommandOutputPolicy,
    ) -> Result<Measurement> {
        let on_windows_cmd = cfg!(windows) && *self.shell == Shell::Default("cmd.exe");
        let mut command_builder = self.shell.command();
        command_builder.arg(if on_windows_cmd { "/C" } else { "-c" });

        // Windows needs special treatment for its behavior on parsing cmd arguments
        if on_windows_cmd {
            #[cfg(windows)]
            command_builder.raw_arg(command.get_command_line());
        } else {
            command_builder.arg(command.get_command_line());
        }

        let mut result = run_command_and_measure_common(
            command_builder,
            iteration,
            command_failure_action.unwrap_or_else(|| self.options.command_failure_action.clone()),
            &self.options.command_input_policy,
            output_policy,
            &command.get_command_line(),
        )?;

        // Subtract shell spawning time
        if let Some(spawning_time) = self.shell_spawning_time {
            result.time_wall_clock =
                (result.time_wall_clock - spawning_time.time_wall_clock).max(Time::zero());
            result.time_user = (result.time_user - spawning_time.time_user).max(Time::zero());
            result.time_system = (result.time_system - spawning_time.time_system).max(Time::zero());
        }

        Ok(result)
    }

    /// Measure the average shell spawning time
    fn calibrate(&mut self) -> Result<()> {
        const COUNT: u64 = 50;
        let progress_bar = if self.options.output_style != OutputStyleOption::Disabled {
            Some(get_progress_bar(
                COUNT,
                "Measuring shell spawning time",
                self.options.output_style,
            ))
        } else {
            None
        };

        let mut measurements = Measurements::default();

        for _ in 0..COUNT {
            // Just run the shell without any command
            let res = self.run_command_and_measure(
                &Command::new(None, ""),
                BenchmarkIteration::NonBenchmarkRun,
                None,
                &CommandOutputPolicy::Null,
            );

            match res {
                Err(_) => {
                    let shell_cmd = if cfg!(windows) {
                        format!("{} /C \"\"", self.shell)
                    } else {
                        format!("{} -c \"\"", self.shell)
                    };

                    bail!(
                        "Could not measure shell execution time. Make sure you can run '{}'.",
                        shell_cmd
                    );
                }
                Ok(r) => {
                    measurements.push(r);
                }
            }

            if let Some(bar) = progress_bar.as_ref() {
                bar.inc(1)
            }
        }

        if let Some(bar) = progress_bar.as_ref() {
            bar.finish_and_clear()
        }

        self.shell_spawning_time = Some(Measurement {
            time_wall_clock: measurements.time_wall_clock_mean(),
            time_user: measurements.time_user_mean(),
            time_system: measurements.time_system_mean(),
            peak_memory_usage: measurements.peak_memory_usage_mean(),
            exit_status: ExitStatus::default(),
        });

        Ok(())
    }

    fn time_overhead(&self) -> Time {
        self.shell_spawning_time.unwrap().time_wall_clock
    }
}

#[derive(Clone)]
pub struct MockExecutor {
    shell: Option<String>,
}

impl MockExecutor {
    pub fn new(shell: Option<String>) -> Self {
        MockExecutor { shell }
    }

    fn extract_time<S: AsRef<str>>(sleep_command: S) -> Time {
        assert!(sleep_command.as_ref().starts_with("sleep "));
        Time::new::<second>(
            sleep_command
                .as_ref()
                .trim_start_matches("sleep ")
                .parse::<f64>()
                .unwrap(),
        )
    }
}

impl Executor for MockExecutor {
    fn run_command_and_measure(
        &self,
        command: &Command<'_>,
        _iteration: BenchmarkIteration,
        _comman
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #656** (2023-06-05): **Winget workflow failed**
  *Symptoms*: Well, that didn't take long: https://github.com/sharkdp/hyperfine/actions/runs/5165728774/jobs/9305463989  FYI @sitiom: this is turning out exactly like I feared. If these winget pipeline continue to take up my time, I will remove them from my projects. I'm not bitter or anything, but I really have better things to do.
  **Post-Mortem & Fix Analysis**:
  > Please take a closer look. The workflow failed, but the PR was successfully created: https://github.com/microsoft/winget-pkgs/pull/108841. An issue is already open for this: https://github.com/vedantmgoyal2009/winget-releaser/issues/167. You don't need to take your time to do anything 🙂
  > Wait, am I seeing this right? The version tag went from https://github.com/sharkdp/hyperfine/releases/tag/v1.16.1 to https://github.com/sharkdp/hyperfine/releases/tag/v0.17.0  - https://github.com/sharkdp/hyperfine/issues/657
  > > Wait, am I seeing this right? The version tag went from https://github.com/sharkdp/hyperfine/releases/tag/v1.16.1 to https://github.com/sharkdp/hyperfine/releases/tag/v0.17.0 >  >     *  Yeah, that's my bad - sorry. Should be fixed now.  But it looks like this is not related to the pipeline failure, as that failed again here: https://github.com/sharkdp/hyperfine/actions/runs/5167650725/jobs/9308703493  > You don't need to take your time to do anything slightly_smiling_face  Well, but I have failing pipelines in my repo.  ![image](https://github.com/sharkdp/hyperfine/assets/4209276/9a2dd301-9f96-4d85-903f-c0bfe066d5e3)  Naturally, I get notifications. I look into what went wrong. I have to create a ticket like this. Write responses to posts, etc. Sure, it doesn't take a lot of my time, but I'd rather not have to do anything.

- **Issue #642** (2023-04-20): **Exporting can fail with "Relative speed comparison is not available" for fast-running commands**
  *Symptoms*: This happens when the mean is zero:  ``` ▶ hyperfine --runs=1 'true' --export-markdown - Benchmark 1: true   Time (abs ≡):          0.0 ms               [User: 0.2 ms, System: 0.0 ms]     Warning: Command took less than 5 ms to complete. Note that the results might be inaccurate because hyperfine can not calibrate the shell startup time much more precise than this limit. You can try to use the `-N`/`--shell=none` option to disable the shell completely.   Error: Relative speed comparison is not available for markup exporter. ```

- **Issue #640** (2023-04-20): **Using '-' as filename for --export-* should not print intermediate results**
  *Symptoms*: When using `-` to export to standard out, we get intermediate outputs that clutter the output.   How to reproduce? ```bash hyperfine --runs 2 --export-markdown - 'sleep 0.1' 'sleep 0.2' ```  ![image](https://user-images.githubusercontent.com/4209276/232596866-15d1c2c8-bcae-4c0c-bdf1-479174e77706.png)   Expected result: the exported content should only be shown once at the end. Ideally, after the *Summary* section.  FYI @humblepenguinn

- **Issue #630** (2024-11-10): **output over multiple lines**
  *Symptoms*: I've used hyperfine for a long time. Excellent tool. Recently it started to behave incorrectly visually. Instead of the output animating a single line, it prints several lines:  <img width="1007" alt="image" src="https://user-images.githubusercontent.com/1785727/226062310-9960a7d2-ae8f-4b40-9aa8-5fc81ea065ed.png">  This is the only program that I've noticed this sort of behaviour in.  I'm running on a Macbook with macOS Ventura 13.2.1 and zsh 5.9 (arm-apple-darwin22.1.0) 
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. Which version of hyperfine do you have? The latest 1.16?
  > Yes, 1.16.0, I upgrade my tools often, so the behavior could have started with the upgrade.
  > Here is a recording of the behavior:  https://user-images.githubusercontent.com/1785727/226097700-b5995b26-8db5-4bf0-9582-591d719e812e.mov  

- **Issue #568** (2022-10-29): **hyperfine not working with nushell**
  *Symptoms*: Using hyperfine on Windows with nushell doesn't work properly.  Trying to benchmark ls gives me an unrecognized command error: ![image](https://user-images.githubusercontent.com/4028423/190511751-275593de-ddb2-462c-8b0e-c275d8192988.png) This makes sense because ls is not a command on Windows with cmd.exe.  Setting the shell manually with `hyperfine -S nu 'ls' --show-output` gives me another error: ![image](https://user-images.githubusercontent.com/4028423/190512121-de413f28-dc41-4169-b0e6-70c4bb0cce6d.png)  nushell only supports running commands using `nu -c`.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. That is unfortunate. Do you have any ideas on how to resolve this?
  > fixed in #582, looked like it always defaulted to cmd.exe style of shell on windows, now the default should be `-c` when not in cmd.exe

- **Issue #453** (2021-12-03): **[BUG] `hyperfine -h` panics when stdout is closed**
  *Symptoms*: ```console $ RUST_BACKTRACE=1 hyperfine -h | false thread 'main' panicked at 'Error writing Error to stdout: Os { code: 32, kind: BrokenPipe, message: "Broken pipe" }', /Users/brew/Library/Caches/Homebrew/cargo_cache/registry/src/github.com-1ecc6299db9ec823/clap-2.33.3/src/errors.rs:401:55 stack backtrace:    0: _rust_begin_unwind    1: core::panicking::panic_fmt    2: core::result::unwrap_failed    3: core::result::Result<T,E>::expect    4: clap::errors::Error::exit    5: clap::app::App::get_matches_from::{{closure}}    6: hyperfine::app::get_arg_matches    7: hyperfine::main note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace. ```  Clap provides a `get_matches_from_safe` API that returns a `Result` rather than panicking when failing to write to stdout.  Here's some MIT-licensed code I use in one of my projects that does this dance in a panic-free way:  https://github.com/artichoke/artichoke/blob/d527412f9438aeba4cadb1f4303237f6f9e0cd4d/src/bin/artichoke.rs#L138-L173
  **Post-Mortem & Fix Analysis**:
  > (I tried to file this bug on `fd` as well which has the same panicking behavior, but the GitHub Issues UI kept erroring for me)
  > Thank you for reporting this.  > (I tried to file this bug on `fd` as well which has the same panicking behavior, but the GitHub Issues UI kept erroring for me)  Oh, fantastic. Does this work https://github.com/sharkdp/fd/issues/new?
  > That did the trick:  - https://github.com/sharkdp/fd/issues/897  This appears to be a productive source of bugs across the Rust CLI ecosystem:  - https://twitter.com/artichokeruby/status/1464996910511452165 - https://www.reddit.com/r/rust/comments/r48hem/claps_defaults_cause_rust_clis_to_panic_on_help/

- **Issue #408** (2021-07-26): **User and system time should be in consistent time units**
  *Symptoms*: The "user" and "system" time should be reported in the same unit as mean, stddev, min and max. They should also follow `--time-unit`, if specified.  Example 1: ``` ▶ hyperfine --runs 2 'stress --cpu 1 --timeout 1' Benchmark 1: stress --cpu 1 --timeout 1   Time (mean ± σ):      1.002 s ±  0.002 s    [User: 993.7 ms, System: 1.0 ms]   Range (min … max):    1.000 s …  1.003 s    2 runs ```  Example 2: ``` ▶ hyperfine --runs 2 'stress --cpu 1 --timeout 2' --time-unit millisecond Benchmark 1: stress --cpu 1 --timeout 2   Time (mean ± σ):     2000.4 ms ±   0.5 ms    [User: 1.983 s, System: 0.003 s]   Range (min … max):   2000.0 ms … 2000.8 ms    2 runs ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/sharkdp/hyperfine/releases/tag/v1.12.0

- **Issue #368** (2022-09-02): **Windows user & system times incorrect**
  *Symptoms*: Looks like user and kernel time on Windows is calculated for the shell process only, which is only used for spawning other processes and waiting for them, resulting in zero times.  I tried running processes directly instead of using the shell by using this and this way I do get relevant results:  ```rust /// Run a Windows shell command using `cmd.exe /C` #[cfg(windows)] fn run_shell_command(     stdout: Stdio,     stderr: Stdio,     command: &str,     shell: &str, ) -> io::Result<std::process::Child> {     if command.is_empty() {         Command::new(shell)             .arg("/C")             .arg(command)             .stdin(Stdio::null())             .stdout(stdout)             .stderr(stderr)             .spawn()     } else {         let mut parts = command.split_whitespace();         Command::new(parts.next().unwrap())             .args(parts)             .stdin(Stdio::null())             .stdout(stdout)             .stderr(stderr)             .spawn()     } } ```
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this! That should be fixed.  Related: https://stackoverflow.com/questions/36011572/how-to-obtain-handles-for-all-children-process-of-current-process-in-windows
  > Also related: https://github.com/sharkdp/hyperfine/issues/336
  > Hi! I'm a student using hyperfine for the research for my Master's thesis. I'm not quite sure my issue is related, since you said this problem should already be solved and my user and system times are actually above zero, but maybe this issue wasn't properly fixed? Or maybe I just have a very wrong understanding of what exactly do the user and system time show.  I'm currently benchmarking C++,C# and Java implementations of one of the problems from the Computer Language Benchmarks game. The user and system times are always very small compared to the wall clock time. One of the example results that confuse me is: ``` Time (mean ± σ):     49.903 s ±  0.082 s    [User: 6.9 ms, System: 16.3 ms] Range (min … max):   49.815 s … 50.043 s    10 runs ``` which is for a sequential C++ program which should be spending most of its time dynamically allocating and deallocating memory. I've even done some profiling (using a sampling profiler) which confirms that this program spends at least 75%

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

### Incident Patch 1: `46e1f9f2` (2026-10-05)
**Commit Message**: Merge pull request #979 from sharkdp/fix/parameterized-reference

Use parameterized benchmarks as references

**File**: `doc/hyperfine.1` (modified, +6/-2)
```diff
@@ -116,13 +116,17 @@ not every time as would happen with the \fB\-\-prepare\fR option.
 .HP
 \fB\-\-reference\fR \fICMD\fP
 .IP
-Benchmark \fICMD\fP as the reference for the relative comparison of results.
-If this option is not specified, the fastest command is used as the reference.
+Use \fICMD\fP as the reference for the relative comparison of results. Without
+parameters, benchmark \fICMD\fP as a separate reference command. If this option
+is not specified, the fastest command is used as the reference.
+With \fB\-\-parameter\-scan\fR or \fB\-\-parameter\-list\fR, select an existing
+benchmark by its exact printed name. The name must match exactly one benchmark.
 .HP
 \fB\-\-reference\-name\fR \fINAME\fP
 .IP
 Give a meaningful \fINAME\fP to the reference command.
 Requires \fB\-\-reference\fR.
+Cannot be used with parameterized benchmarks; use \fB\-\-command\-name\fR instead.
 .HP
 \fB\-p\fR, \fB\-\-prepare\fR \fICMD...\fP
 .IP
```

**File**: `src/benchmark/relative_speed.rs` (modified, +53/-11)
```diff
@@ -16,6 +16,20 @@ pub struct BenchmarkResultWithRelativeSpeed<'a> {
     pub relative_ordering: Ordering,
 }
 
+impl BenchmarkResultWithRelativeSpeed<'_> {
+    pub fn reference_label(&self) -> &'static str {
+        if self.is_reference {
+            " (reference)"
+        } else {
+            match self.relative_ordering {
+                Ordering::Less => " (faster)",
+                Ordering::Equal => " (same speed)",
+                Ordering::Greater => " (slower)",
+            }
+        }
+    }
+}
+
 pub fn compare_mean_time(l: &BenchmarkResult, r: &BenchmarkResult) -> Ordering {
     l.mean_wall_clock_time()
         .partial_cmp(&r.mean_wall_clock_time())
@@ -37,10 +51,13 @@ fn compute_relative_speeds<'a>(
     let mut results: Vec<_> = results
         .iter()
         .map(|result| {
-            let is_reference = result == reference;
+            // Separate benchmarks can have identical names and measurements.
+            let is_reference = std::ptr::eq(result, reference);
             let relative_ordering = compare_mean_time(result, reference);
 
-            if result.mean_wall_clock_time() == Time::zero() {
+            if result.mean_wall_clock_time() == Time::zero()
+                || reference.mean_wall_clock_time() == Time::zero()
+            {
                 return BenchmarkResultWithRelativeSpeed {
                     result,
                     relative_speed: if is_reference { 1.0 } else { f64::INFINITY },
@@ -64,11 +81,11 @@ fn compute_relative_speeds<'a>(
                 result.measurements.stddev(),
                 reference.measurements.stddev(),
             ) {
-                (Some(result_stddev), Some(fastest_stddev)) => Some(
+                (Some(result_stddev), Some(reference_stddev)) => Some(
                     ratio
                         * ((result_stddev / result.mean_wall_clock_time())
                             .powi(uom::typenum::P2::new())
-                            + (fastest_stddev / reference.mean_wall_clock_time())
+                            + (reference_stddev / reference.mean_wall_clock_time())
                                 .powi(uom::typenum::P2::new()))
                         .sqrt(),
                 ),
@@ -122,14 +139,14 @@ pub fn compute_with_check(
     Some(compute_relative_speeds(results, fastest, sort_order))
 }
 
-/// Same as compute_with_check, potentially resulting in relative speeds of infinity
-pub fn compute(
-    results: &[BenchmarkResult],
+/// Compute relative speeds against the given reference, or the fastest result.
+pub fn compute<'a>(
+    results: &'a [BenchmarkResult],
     sort_order: SortOrder,
-) -> Vec<BenchmarkResultWithRelativeSpeed<'_>> {
-    let fastest = fastest_of(results);
-
-    compute_relative_speeds(results, fastest, sort_order)
+    reference: Option<&'a BenchmarkResult>,
+) -> Vec<BenchmarkResultWithRelativeSpeed<'a>> {
+    let reference = reference.unwrap_or_else(|| fastest_of(results));
+    compute_relative_speeds(results, reference, sort_order)
 }
 
 #[cfg(test)]
@@ -192,3 +209,28 @@ fn test_compute_relative_speed_for_zero_times() {
 
     assert!(annotated_results.is_none());
 }
+
+#[test]
+fn reference_identity_distinguishes_equal_results() {
+    let results = vec![create_result("same", 1.0), create_result("same", 1.0)];
+    let entries = compute_relative_speeds(&results, &results[0], SortOrder::Command);
+
+    assert!(entries[0].is_reference);
+    assert!(!entries[1].is_reference);
+}
+
+#[test]
+fn reference_ratios_handle_zero_times() {
+    let mut results = vec![create_result("reference", 2.0), create_result("zero", 0.0)];
+    for result in &mut results {
+        let measurement = result.measurements.measurements[0];
+        result.measurements.measurements.push(measurement);
+    }
+    let entries = compute_relative_speeds(&results, &results[0], SortOrder::Command);
+    assert_eq!(entries[1].relative_speed, f64::INFINITY);
+
+    let entries = compute_relative_speeds(&results, &results[1], SortOrder::Command);
+    assert_eq!(entries[0].relative_speed, f64::INFINITY);
+    assert_eq!(entries[0].relative_speed_stddev, None);
+    assert_eq!(entries[1].relative_speed, 1.0);
+}
```

**File**: `src/benchmark/scheduler.rs` (modified, +13/-6)
```diff
@@ -54,7 +54,8 @@ impl<'a> Scheduler<'a> {
 
             // We export results after each individual benchmark, because
             // we would risk losing them if a later benchmark fails.
-            self.export_manager.write_results(&self.results, true)?;
+            self.export_manager
+                .write_results(&self.results, true, self.options.reference_index)?;
         }
 
         Ok(())
@@ -71,9 +72,8 @@ impl<'a> Scheduler<'a> {
 
         let reference = self
             .options
-            .reference_command
-            .as_ref()
-            .map(|_| &self.results[0])
+            .reference_index
+            .map(|index| &self.results[index])
             .unwrap_or_else(|| relative_speed::fastest_of(&self.results));
 
         if let Some(annotated_results) = relative_speed::compute_with_check_from_reference(
@@ -130,9 +130,14 @@ impl<'a> Scheduler<'a> {
                     console_writeln!(stdout, "{}", "Relative speed comparison".bold())?;
 
                     for item in annotated_results {
+                        let relationship = if self.options.reference_index.is_some() {
+                            item.reference_label()
+                        } else {
+                            ""
+                        };
                         console_writeln!(
                             stdout,
-                            "  {}{}  {}",
+                            "  {}{}  {}{}",
                             format!("{:10.2}", item.relative_speed).bold().green(),
                             if item.is_reference {
                                 "        ".into()
@@ -142,6 +147,7 @@ impl<'a> Scheduler<'a> {
                                 "        ".into()
                             },
                             item.result.command_with_unused_parameters,
+                            relationship,
                         )?;
                     }
                 }
@@ -163,7 +169,8 @@ impl<'a> Scheduler<'a> {
     }
 
     pub fn final_export(&self) -> Result<()> {
-        self.export_manager.write_results(&self.results, false)
+        self.export_manager
+            .write_results(&self.results, false, self.options.reference_index)
     }
 }
 
```

**File**: `src/cli.rs` (modified, +7/-3)
```diff
@@ -105,16 +105,20 @@ fn build_command() -> Command {
                 .action(ArgAction::Set)
                 .value_name("CMD")
                 .help(
-                    "The reference command for the relative comparison of results. \
-                    If this is unset, results are compared with the fastest command as reference."
+                    "The reference for the relative comparison of results. Without parameters, \
+                    CMD is run as a separate reference command. With --parameter-scan or \
+                    --parameter-list, CMD must exactly match one unique benchmark name as \
+                    shown in the output. If this is unset, results are compared with the \
+                    fastest command as reference."
                 )
         )
         .arg(
             Arg::new("reference-name")
                 .long("reference-name")
                 .action(ArgAction::Set)
                 .value_name("CMD")
-                .help("Give a meaningful name to the reference command.")
+                .help("Give a meaningful name to the reference command. This cannot be used \
+                       with parameterized benchmarks; use --command-name instead.")
                 .requires("reference")
         )
         .arg(
```

**File**: `src/export/csv.rs` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@ impl Exporter for CsvExporter {
         results: &[BenchmarkResult],
         _unit: Option<TimeUnit>,
         _sort_order: SortOrder,
+        _reference_index: Option<usize>,
     ) -> Result<Vec<u8>> {
         const CSV_UNIT: TimeUnit = TimeUnit::Second;
         const CSV_PRECISION: usize = 6;
@@ -172,7 +173,7 @@ fn test_csv() {
 
     let actual = String::from_utf8(
         exporter
-            .serialize(&results, Some(TimeUnit::Second), SortOrder::Command)
+            .serialize(&results, Some(TimeUnit::Second), SortOrder::Command, None)
             .unwrap(),
     )
     .unwrap();
```

**File**: `src/export/json.rs` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ impl Exporter for JsonExporter {
         results: &[BenchmarkResult],
         _unit: Option<TimeUnit>,
         _sort_order: SortOrder,
+        _reference_index: Option<usize>,
     ) -> Result<Vec<u8>> {
         let mut output = to_vec_pretty(&HyperfineSummary { results });
         if let Ok(ref mut content) = output {
```

**File**: `src/export/markup.rs` (modified, +35/-11)
```diff
@@ -1,10 +1,11 @@
 use crate::benchmark::relative_speed::BenchmarkResultWithRelativeSpeed;
 use crate::benchmark::{benchmark_result::BenchmarkResult, relative_speed};
 use crate::options::SortOrder;
-use crate::quantity::{FormatQuantity, IsUnit, TimeUnit};
+use crate::quantity::{FormatQuantity, IsUnit, Time, TimeUnit, Zero};
 
 use super::Exporter;
 use anyhow::Result;
+use std::cmp::Ordering;
 
 pub enum Alignment {
     Left,
@@ -16,6 +17,8 @@ pub trait MarkupExporter {
         &self,
         entries: &[BenchmarkResultWithRelativeSpeed],
         unit: TimeUnit,
+        reference_pending: bool,
+        explicit_reference: bool,
     ) -> String {
         // prepare table header strings
         let notation = format!("[{}]", unit.short_name());
@@ -58,13 +61,25 @@ pub trait MarkupExporter {
             };
             let min_str = measurement.measurements.min().format_value(unit);
             let max_str = measurement.measurements.max().format_value(unit);
-            let rel_str = format!("{:.2}", entry.relative_speed);
-            let rel_stddev_str = if entry.is_reference {
-                "".into()
-            } else if let Some(stddev) = entry.relative_speed_stddev {
-                format!(" ± {stddev:.2}")
+            // The ratio of two zero times is undefined, even if they compare equal.
+            let relative_unavailable = reference_pending
+                || (explicit_reference
+                    && !entry.is_reference
+                    && entry.relative_ordering == Ordering::Equal
+                    && measurement.mean_wall_clock_time() == Time::zero());
+            let relative = if relative_unavailable {
+                "N/A".to_string()
             } else {
-                "".into()
+                let stddev = match (entry.is_reference, entry.relative_speed_stddev) {
+                    (false, Some(stddev)) => format!(" ± {stddev:.2}"),
+                    _ => String::new(),
+                };
+                let label = if explicit_reference {
+                    entry.reference_label()
+                } else {
+                    ""
+                };
+                format!("{:.2}{stddev}{label}", entry.relative_speed)
             };
 
             // prepare table row entries
@@ -73,7 +88,7 @@ pub trait MarkupExporter {
                 &format!("{mean_str}{stddev_str}"),
                 &min_str,
                 &max_str,
-                &format!("{rel_str}{rel_stddev_str}"),
+                &relative,
             ]))
         }
 
@@ -114,11 +129,20 @@ impl<T: MarkupExporter> Exporter for T {
         results: &[BenchmarkResult],
         unit: Option<TimeUnit>,
         sort_order: SortOrder,
+        reference_index: Option<usize>,
     ) -> Result<Vec<u8>> {
         let unit = unit.unwrap_or_else(|| determine_unit_from_results(results));
-        let entries = relative_speed::compute(results, sort_order);
-
-        let table = self.table_results(&entries, unit);
+        // Do not report ratios against another benchmark while the selected
+        // reference is still pending in an intermediate export.
+        let reference_pending = reference_index.is_some_and(|i| i >= results.len());
+        let entries = relative_speed::compute(
+            results,
+            sort_order,
+            reference_index.and_then(|i| results.get(i)),
+        );
+
+        let table =
+            self.table_results(&entries, unit, reference_pending, reference_index.is_some());
         Ok(table.as_bytes().to_vec())
     }
 }
```

**File**: `src/export/mod.rs` (modified, +10/-2)
```diff
@@ -51,6 +51,7 @@ trait Exporter {
         results: &[BenchmarkResult],
         unit: Option<TimeUnit>,
         sort_order: SortOrder,
+        reference_index: Option<usize>,
     ) -> Result<Vec<u8>>;
 }
 
@@ -130,11 +131,18 @@ impl ExportManager {
     /// results are written to all file targets (to always have them up to date, even
     /// if a benchmark fails). In the latter case, we only print to stdout targets (in
     /// order not to clutter the output of hyperfine with intermediate results).
-    pub fn write_results(&self, results: &[BenchmarkResult], intermediate: bool) -> Result<()> {
+    /// `reference_index` refers to the complete benchmark sequence, so it can
+    /// point past `results` while that benchmark is still pending.
+    pub fn write_results(
+        &self,
+        results: &[BenchmarkResult],
+        intermediate: bool,
+        reference_index: Option<usize>,
+    ) -> Result<()> {
         for e in &self.exporters {
             let content = || {
                 e.exporter
-                    .serialize(results, self.time_unit, self.sort_order)
+                    .serialize(results, self.time_unit, self.sort_order, reference_index)
             };
 
             match e.target {
```

---

### Incident Patch 2: `79aea887` (2026-10-05)
**Commit Message**: Merge pull request #977 from sharkdp/codex/fix-clippy-warnings

Fix Windows Clippy warnings

**File**: `src/timer/windows_timer.rs` (modified, +3/-6)
```diff
@@ -34,11 +34,11 @@ use crate::quantity::{nanosecond, Information, Time, Zero};
 
 #[cfg(not(feature = "windows_process_extensions_main_thread_handle"))]
 #[allow(non_upper_case_globals)]
-static NtResumeProcess: Lazy<unsafe extern "system" fn(ProcessHandle: HANDLE) -> NTSTATUS> =
+static NtResumeProcess: Lazy<unsafe extern "system" fn(process_handle: HANDLE) -> NTSTATUS> =
     Lazy::new(|| {
         // SAFETY: Getting the module handle for ntdll.dll is safe
         let ntdll = unsafe { GetModuleHandleW(w!("ntdll.dll")) };
-        assert!(ntdll != std::ptr::null_mut(), "GetModuleHandleW failed");
+        assert!(!ntdll.is_null(), "GetModuleHandleW failed");
 
         // SAFETY: The ntdll handle is valid
         let nt_resume_process = unsafe { GetProcAddress(ntdll, s!("NtResumeProcess")) };
@@ -57,10 +57,7 @@ impl CPUTimer {
 
         // SAFETY: Creating a new job object is safe
         let job_object = unsafe { CreateJobObjectW(ptr::null_mut(), ptr::null_mut()) };
-        assert!(
-            job_object != std::ptr::null_mut(),
-            "CreateJobObjectW failed"
-        );
+        assert!(!job_object.is_null(), "CreateJobObjectW failed");
 
         // SAFETY: The job object handle is valid
         let ret = unsafe { AssignProcessToJobObject(job_object, child_handle) };
```

---

### Incident Patch 3: `ebb3182a` (2026-10-05)
**Commit Message**: Fix Windows Clippy warnings

**File**: `src/timer/windows_timer.rs` (modified, +3/-6)
```diff
@@ -34,11 +34,11 @@ use crate::quantity::{nanosecond, Information, Time, Zero};
 
 #[cfg(not(feature = "windows_process_extensions_main_thread_handle"))]
 #[allow(non_upper_case_globals)]
-static NtResumeProcess: Lazy<unsafe extern "system" fn(ProcessHandle: HANDLE) -> NTSTATUS> =
+static NtResumeProcess: Lazy<unsafe extern "system" fn(process_handle: HANDLE) -> NTSTATUS> =
     Lazy::new(|| {
         // SAFETY: Getting the module handle for ntdll.dll is safe
         let ntdll = unsafe { GetModuleHandleW(w!("ntdll.dll")) };
-        assert!(ntdll != std::ptr::null_mut(), "GetModuleHandleW failed");
+        assert!(!ntdll.is_null(), "GetModuleHandleW failed");
 
         // SAFETY: The ntdll handle is valid
         let nt_resume_process = unsafe { GetProcAddress(ntdll, s!("NtResumeProcess")) };
@@ -57,10 +57,7 @@ impl CPUTimer {
 
         // SAFETY: Creating a new job object is safe
         let job_object = unsafe { CreateJobObjectW(ptr::null_mut(), ptr::null_mut()) };
-        assert!(
-            job_object != std::ptr::null_mut(),
-            "CreateJobObjectW failed"
-        );
+        assert!(!job_object.is_null(), "CreateJobObjectW failed");
 
         // SAFETY: The job object handle is valid
         let ret = unsafe { AssignProcessToJobObject(job_object, child_handle) };
```

---

### Incident Patch 4: `0a61e330` (2026-10-05)
**Commit Message**: Merge pull request #947 from Likio3000/codex/fix-markdown-backticks

Preserve backticks in Markdown command names

**File**: `src/export/markdown.rs` (modified, +29/-1)
```diff
@@ -24,7 +24,19 @@ impl MarkupExporter for MarkdownExporter {
     }
 
     fn command(&self, cmd: &str) -> String {
-        format!("`{cmd}`")
+        let longest_backtick_run = cmd
+            .split(|character| character != '`')
+            .map(str::len)
+            .max()
+            .unwrap_or(0);
+
+        if longest_backtick_run == 0 {
+            format!("`{cmd}`")
+        } else {
+            // Use a longer delimiter and keep command backticks separate from it.
+            let delimiter = "`".repeat(longest_backtick_run + 1);
+            format!("{delimiter} {cmd} {delimiter}")
+        }
     }
 }
 
@@ -44,3 +56,19 @@ fn test_markdown_formatter_table_divider() {
     let divider = formatter.table_divider(&[Alignment::Left, Alignment::Right, Alignment::Left]);
     assert_eq!(divider, "|:---|---:|:---|\n");
 }
+
+#[test]
+fn test_markdown_formatter_command_with_backticks() {
+    let formatter = MarkdownExporter::default();
+
+    for (command, expected) in [
+        ("echo `uname`", "`` echo `uname` ``"),
+        ("echo ``quoted``", "``` echo ``quoted`` ```"),
+        ("`` `quoted` ``", "``` `` `quoted` `` ```"),
+        ("`", "`` ` ``"),
+        ("echo ```", "```` echo ``` ````"),
+        (" echo `uname` ", "``  echo `uname`  ``"),
+    ] {
+        assert_eq!(formatter.command(command), expected, "{command:?}");
+    }
+}
```

**File**: `tests/integration_tests.rs` (modified, +21/-0)
```diff
@@ -929,6 +929,27 @@ fn invalid_command_options_preserve_export_files() {
     }
 }
 
+#[test]
+fn markdown_export_preserves_backticks_and_pipes_in_command_names() {
+    let _settings = snapshot_settings().bind_to_scope();
+    assert_cmd_snapshot!(hyperfine_debug()
+        .arg("--style=none")
+        .arg("--export-markdown=-")
+        .arg("--command-name=echo `uname` | cat")
+        .arg("sleep 1"), @r"
+    success: true
+    exit_code: 0
+    ----- stdout -----
+
+    | Command | Mean [s] | Min [s] | Max [s] | Relative |
+    |:---|---:|---:|---:|---:|
+    | `` echo `uname` \| cat `` | 1.000 ± 0.000 | 1.000 | 1.000 | 1.00 |
+
+
+    ----- stderr -----
+    ");
+}
+
 #[test]
 fn unused_parameters_are_shown_in_benchmark_name() {
     hyperfine()
```

---

### Incident Patch 5: `4917c557` (2026-05-24)
**Commit Message**: Fix "modifized" typo on modified_zscores docstring

Signed-off-by: Charlie Tonneslan <[REDACTED_EMAIL]>

**File**: `src/quantity/statistics.rs` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ pub fn standard_deviation<Q: UnsafeRawValue>(values: &[Q], mean: Q) -> Q {
     Q::unsafe_from_raw_value((sum / (values.len() as f64 - 1.0)).sqrt())
 }
 
-/// Compute modifized Z-scores for a given sample. A (unmodified) Z-score is defined by
+/// Compute modified Z-scores for a given sample. A (unmodified) Z-score is defined by
 /// `(x_i - x_mean)/x_stddev` whereas the modified Z-score is defined by `(x_i - x_median)/MAD`
 /// where MAD is the median absolute deviation.
 ///
```

---

### Incident Patch 6: `258af076` (2026-10-05)
**Commit Message**: Merge pull request #854 from Rohan5commit/docs/fix-arithmetic-wording

docs: fix arithmetic wording in help text

**File**: `src/cli.rs` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ fn build_command() -> Command {
                      string '{VAR}' in each command by the current parameter value.\n\n  \
                      Example:  hyperfine --prepare 'make clean' -P threads 1 8 'make -j {threads}'\n\n\
                      This performs benchmarks for 'make -j 1', 'make -j 2', …, 'make -j 8'.\n\n\
-                     To have the value increase following different patterns, use shell arithmetics.\n\n  \
+                     To have the value increase following different patterns, use shell arithmetic.\n\n  \
                      Example: hyperfine -P size 0 3 'sleep $((2**{size}))'\n\n\
                      This performs benchmarks with power of 2 increases: 'sleep 1', 'sleep 2', 'sleep 4', …\n\
                      The exact syntax may vary depending on your shell and OS."
```

---

### Incident Patch 7: `fe75d1cb` (2026-10-05)
**Commit Message**: Merge pull request #853 from Rohan5commit/docs/fix-comment-typo

docs: fix typo in relative speed comment

**File**: `src/benchmark/relative_speed.rs` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ fn compute_relative_speeds<'a>(
             };
 
             // https://en.wikipedia.org/wiki/Propagation_of_uncertainty#Example_formulas
-            // Covariance asssumed to be 0, i.e. variables are assumed to be independent
+            // Covariance assumed to be 0, i.e. variables are assumed to be independent
             let ratio_stddev = match (result.stddev, reference.stddev) {
                 (Some(result_stddev), Some(fastest_stddev)) => Some(
                     ratio
```

---

### Incident Patch 8: `907de263` (2026-10-02)
**Commit Message**: Fix panic on --runs 0 (#923)

* fix: reject --runs/--max-runs 0, clamp --min-runs to 1

* Validate positive run counts with clap

---------

Co-authored-by: VXNCXNX <[REDACTED_EMAIL]>
Co-authored-by: David Peter <[REDACTED_EMAIL]>

**File**: `src/cli.rs` (modified, +4/-0)
```diff
@@ -41,6 +41,7 @@ fn build_command() -> Command {
                 .short('w')
                 .value_name("NUM")
                 .action(ArgAction::Set)
+                .value_parser(clap::value_parser!(u64))
                 .help(
                     "Perform NUM warmup runs before the actual benchmark. This can be used \
                      to fill (disk) caches for I/O-heavy programs.",
@@ -52,6 +53,7 @@ fn build_command() -> Command {
                 .short('m')
                 .action(ArgAction::Set)
                 .value_name("NUM")
+                .value_parser(clap::value_parser!(u64).range(1..))
                 .help("Perform at least NUM runs for each command (default: 10)."),
         )
         .arg(
@@ -60,6 +62,7 @@ fn build_command() -> Command {
                 .short('M')
                 .action(ArgAction::Set)
                 .value_name("NUM")
+                .value_parser(clap::value_parser!(u64).range(1..))
                 .help("Perform at most NUM runs for each command. By default, there is no limit."),
         )
         .arg(
@@ -69,6 +72,7 @@ fn build_command() -> Command {
                 .short('r')
                 .action(ArgAction::Set)
                 .value_name("NUM")
+                .value_parser(clap::value_parser!(u64).range(1..))
                 .help("Perform exactly NUM runs for each command. If this option is not specified, \
                        hyperfine automatically determines the number of runs."),
         )
```

**File**: `src/options.rs` (modified, +7/-14)
```diff
@@ -275,22 +275,15 @@ impl Default for Options {
 impl Options {
     pub fn from_cli_arguments<'a>(matches: &ArgMatches) -> Result<Self, OptionsError<'a>> {
         let mut options = Self::default();
-        let param_to_u64 = |param| {
-            matches
-                .get_one::<String>(param)
-                .map(|n| {
-                    n.parse::<u64>()
-                        .map_err(|e| OptionsError::IntParsingError(param, e))
-                })
-                .transpose()
-        };
-
-        options.warmup_count = param_to_u64("warmup")?.unwrap_or(options.warmup_count);
+        options.warmup_count = matches
+            .get_one::<u64>("warmup")
+            .copied()
+            .unwrap_or(options.warmup_count);
 
-        let mut min_runs = param_to_u64("min-runs")?;
-        let mut max_runs = param_to_u64("max-runs")?;
+        let mut min_runs = matches.get_one::<u64>("min-runs").copied();
+        let mut max_runs = matches.get_one::<u64>("max-runs").copied();
 
-        if let Some(runs) = param_to_u64("runs")? {
+        if let Some(&runs) = matches.get_one::<u64>("runs") {
             min_runs = Some(runs);
             max_runs = Some(runs);
         }
```

**File**: `tests/integration_tests.rs` (modified, +26/-0)
```diff
@@ -74,6 +74,32 @@ fn exits_quietly_when_stdout_is_closed() {
     }
 }
 
+#[test]
+fn fails_with_zero_runs() {
+    for option in ["--runs", "--min-runs", "--max-runs"] {
+        hyperfine()
+            .arg(option)
+            .arg("0")
+            .arg("echo dummy benchmark")
+            .assert()
+            .code(2)
+            .stderr(predicate::str::contains(format!(
+                "invalid value '0' for '{option} <NUM>'"
+            )));
+    }
+}
+
+#[test]
+fn min_runs_of_one_still_performs_one_run() {
+    hyperfine_debug()
+        .arg("--min-runs=1")
+        .arg("--warmup=0")
+        .arg("sleep 4")
+        .assert()
+        .success()
+        .stdout(predicate::str::contains("Time (abs ≡)"));
+}
+
 #[test]
 fn can_run_commands_without_a_shell() {
     hyperfine()
```

---

### Incident Patch 9: `8d908b07` (2026-10-02)
**Commit Message**: Document the Python version required by the analysis scripts (#944)

* Document the Python version required by the analysis scripts

* Recommend uv for running the analysis scripts

**File**: `scripts/README.md` (modified, +6/-15)
```diff
@@ -4,23 +4,14 @@ This folder contains scripts that can be used in combination with hyperfine's `-
 
 ```bash
 hyperfine 'sleep 0.020' 'sleep 0.021' 'sleep 0.022' --export-json sleep.json
-./plot_whisker.py sleep.json
+uv run plot_whisker.py sleep.json
 ```
 
 ### Prerequisites
 
-To make these scripts work, you will need `numpy`, `matplotlib` and `scipy`.
-
-If you have a Python package manager that understands [PEP-723](https://peps.python.org/pep-0723/)
-inline script requirements like [`uv`](https://github.com/astral-sh/uv) or [`pipx`](https://github.com/pypa/pipx),
-you can directly run the scripts using
+Install [`uv`](https://docs.astral.sh/uv/getting-started/installation/) and run the
+commands above from this directory.
 
-```bash
-uv run plot_whisker.py sleep.json
-```
-
-Otherwise, install the dependencies via your system package manager or using `pip`:
-
-```bash
-pip install numpy matplotlib scipy  # pip3, if you are using python3
-```
+The scripts declare their dependencies using [PEP 723](https://peps.python.org/pep-0723/)
+inline script metadata. `uv run` automatically installs these dependencies in an
+isolated environment before running the script.
```

---

### Incident Patch 10: `8e121352` (2026-10-02)
**Commit Message**: Remove installation instructions for discontinued Funtoo Linux (#946)

**File**: `README.md` (modified, +0/-7)
```diff
@@ -212,13 +212,6 @@ cave resolve -x repository/rust
 cave resolve -x hyperfine
 ```
 
-### On Funtoo Linux
-
-On Funtoo Linux, hyperfine can be installed [from core-kit](https://github.com/funtoo/core-kit/tree/1.4-release/app-benchmarks/hyperfine):
-```
-emerge app-benchmarks/hyperfine
-```
-
 ### On NixOS
 
 On NixOS, hyperfine can be installed [from the official repositories](https://nixos.org/nixos/packages.html?query=hyperfine):
```

---

### Incident Patch 11: `0c5701ba` (2026-10-02)
**Commit Message**: Describe the Linux cache-clearing example accurately (#945)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -56,8 +56,8 @@ hyperfine --warmup 3 'grep -R TODO *'
 ```
 
 Conversely, if you want to run the benchmark for a cold cache, you can use the `-p`/`--prepare`
-option to run a special command before *each* timing run. For example, to clear harddisk caches
-on Linux, you can run
+option to run a special command before *each* timing run. For example, to clear Linux filesystem caches,
+you can run
 ```sh
 sync; echo 3 | sudo tee /proc/sys/vm/drop_caches
 ```
```

#### Recent Merged Pull Requests:
- **PR #980** (2026-10-05): Document reference changes in changelog (@sharkdp)
- **PR #979** (2026-10-05): Use parameterized benchmarks as references (@sharkdp)
- **PR #978** (2026-10-05): Prepare release v1.21.0 (@sharkdp)
- **PR #977** (2026-10-05): Fix Windows Clippy warnings (@sharkdp)
- **PR #976** (2026-10-05): Compute standard deviation directly from samples (@sharkdp)
- **PR #975** (2026-10-05): Unify the Windows CPU timer stop interface (@sharkdp)
- **PR #974** (2026-10-05): Bump actions/checkout from 6 to 7 (@dependabot[bot])
- **PR #973** (2026-10-05): Bump softprops/action-gh-release from 2 to 3 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
