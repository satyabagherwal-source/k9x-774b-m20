# Forensic Learning Record (Deep Inspection): sharkdp/hyperfine

> **Canonical Artifact**: `07_PROJECT_LEARNING/sharkdp-hyperfine-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sharkdp/hyperfine](https://github.com/sharkdp/hyperfine))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:22:01.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sharkdp/hyperfine`
- **Description**: A command-line benchmarking tool
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 28931 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

use serde::Serialize;

use crate::util::units::Second;

/// Set of values that will be exported.
// NOTE: `serde` is used for JSON serialization, but not for CSV serialization due to the
// `parameters` map. Update `src/hyperfine/export/csv.rs` with new fields, as appropriate.
#[derive(Debug, Default, Clone, Serialize, PartialEq)]
pub struct BenchmarkResult {
    /// The full command line of the program that is being benchmarked
    pub command: String,

    /// The full command line of the program that is being benchmarked, possibly including a list of
    /// parameters that were not used in the command line template.
    #[serde(skip_serializing)]
    pub command_with_unused_parameters: String,

    /// The average run time
    pub mean: Second,

    /// The standard deviation of all run times. Not available if only one run has been performed
    pub stddev: Option<Second>,

    /// The median run time
    pub median: Second,

    /// Time spent in user mode
    pub user: Second,

    /// Time spent in kernel mode
    pub system: Second,

    /// Minimum of all measured times
    pub min: Second,

    /// Maximum of all measured times
    pub max: Second,

    /// All run time measurements
    #[serde(skip_serializing_if = "Option::is_none")]
    pub times: Option<Vec<Second>>,

    /// Maximum memory usage of the process, in bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_usage_byte: Option<Vec<u64>>,

    /// Exit codes of all command invocations
    pub exit_codes: Vec<Option<i32>>,

    /// Parameter values for this benchmark
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub parameters: BTreeMap<String, String>,
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
use crate::timer::{execute_and_measure, TimerResult};
use crate::util::randomized_environment_offset;
use crate::util::units::Second;

use super::timing_result::TimingResult;

use anyhow::{bail, Context, Result};
use statistical::mean;

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
    ) -> Result<(TimingResult, ExitStatus)>;

    /// Perform a calibration of this executor. For example,
    /// when running commands through a shell, we need to
    /// measure the shell spawning time separately in order
    /// to subtract it from the full runtime later.
    fn calibrate(&mut self) -> Result<()>;

    /// Return the time overhead for this executor when
    /// performing a measurement. This should return the time
    /// that is being used in addition to the actual runtime
    /// of the command.
    fn time_overhead(&self) -> Second;
}

fn run_command_and_measure_common(
    mut command: std::process::Command,
    iteration: BenchmarkIteration,
    command_failure_action: CmdFailureAction,
    command_input_policy: &CommandInputPolicy,
    command_output_policy: &CommandOutputPolicy,
    command_name: &str,
) -> Result<TimerResult> {
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

    if !result.status.success() {
        use crate::util::exit_code::extract_exit_code;

        let should_fail = match command_failure_action {
            CmdFailureAction::RaiseError => true,
            CmdFailureAction::IgnoreAllFailures => false,
            CmdFailureAction::IgnoreSpecificFailures(ref codes) => {
                // Only fail if the exit code is not in the list of codes to ignore
                if let Some(exit_code) = extract_exit_code(result.status) {
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
                cause=result.status.code().map_or(
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
    ) -> Result<(TimingResult, ExitStatus)> {
        let result = run_command_and_measure_common(
            command.get_command()?,
            iteration,
            command_failure_action.unwrap_or_else(|| self.options.command_failure_action.clone()),
            &self.options.command_input_policy,
            output_policy,
            &command.get_command_line(),
        )?;

        Ok((
            TimingResult {
                time_real: result.time_real,
                time_user: result.time_user,
                time_system: result.time_system,
                memory_usage_byte: result.memory_usage_byte,
            },
            result.status,
        ))
    }

    fn calibrate(&mut self) -> Result<()> {
        Ok(())
    }

    fn time_overhead(&self) -> Second {
        0.0
    }
}

pub struct ShellExecutor<'a> {
    options: &'a Options,
    shell: &'a Shell,
    shell_spawning_time: Option<TimingResult>,
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
    ) -> Result<(TimingResult, ExitStatus)> {
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
            result.time_real = (result.time_real - spawning_time.time_real).max(0.0);
            result.time_user = (result.time_user - spawning_time.time_user).max(0.0);
            result.time_system = (result.time_system - spawning_time.time_system).max(0.0);
        }

        Ok((
            TimingResult {
                time_real: result.time_real,
                time_user: result.time_user,
                time_system: result.time_system,
                memory_usage_byte: result.memory_usage_byte,
            },
            result.status,
        ))
    }

    /// Measure the average shell spawning time
    fn calibrate(&mut self) -> Result<()> {
        const COUNT: u64 = 50;
        let progress_bar = if self.options.output_style != OutputStyleOption::Disabled
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

### Incident Patch 1: `8b622405` (2025-10-14)
**Commit Message**: fix typo in docs

**File**: `doc/hyperfine.1` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ Execute \fICMD\fP after the completion of all benchmarking runs for each individ
 command to be benchmarked. This is useful if the commands to be benchmarked
 produce artifacts that need to be cleaned up. It only runs once a series of
 benchmark runs, as opposed to \fB\-\-conclude\fR option which runs after
-ever run.
+every run.
 .HP
 \fB\-P\fR, \fB\-\-parameter\-scan\fR \fIVAR\fP \fIMIN\fP \fIMAX\fP
 .IP
```

---

### Incident Patch 2: `98d262c4` (2025-09-03)
**Commit Message**: Fix warnings

**File**: `src/benchmark/relative_speed.rs` (modified, +2/-2)
```diff
@@ -98,7 +98,7 @@ pub fn compute_with_check_from_reference<'a>(
 pub fn compute_with_check(
     results: &[BenchmarkResult],
     sort_order: SortOrder,
-) -> Option<Vec<BenchmarkResultWithRelativeSpeed>> {
+) -> Option<Vec<BenchmarkResultWithRelativeSpeed<'_>>> {
     let fastest = fastest_of(results);
 
     if fastest.mean == 0.0 {
@@ -112,7 +112,7 @@ pub fn compute_with_check(
 pub fn compute(
     results: &[BenchmarkResult],
     sort_order: SortOrder,
-) -> Vec<BenchmarkResultWithRelativeSpeed> {
+) -> Vec<BenchmarkResultWithRelativeSpeed<'_>> {
     let fastest = fastest_of(results);
 
     compute_relative_speeds(results, fastest, sort_order)
```

---

### Incident Patch 3: `835fc43e` (2025-01-05)
**Commit Message**: Fixed bug on naming individual commands with parameter scan

**File**: `src/command.rs` (modified, +45/-10)
```diff
@@ -277,18 +277,8 @@ impl<'a> Commands<'a> {
         command_strings: Vec<&'b str>,
     ) -> Result<Vec<Command<'b>>, ParameterScanError> {
         let param_range = RangeStep::new(param_min, param_max, step)?;
-        let param_count = param_range.size_hint().1.unwrap();
         let command_name_count = command_names.len();
 
-        // `--command-name` should appear exactly once or exactly B times,
-        // where B is the total number of benchmarks.
-        if command_name_count > 1 && command_name_count != param_count {
-            return Err(ParameterScanError::UnexpectedCommandNameCount(
-                command_name_count,
-                param_count,
-            ));
-        }
-
         let mut i = 0;
         let mut commands = vec![];
         for value in param_range {
@@ -305,6 +295,17 @@ impl<'a> Commands<'a> {
                 i += 1;
             }
         }
+
+        // `--command-name` should appear exactly once or exactly B times,
+        // where B is the total number of benchmarks.
+        let command_count = commands.len();
+        if command_name_count > 1 && command_name_count != command_count {
+            return Err(ParameterScanError::UnexpectedCommandNameCount(
+                command_name_count,
+                command_count,
+            ));
+        }
+
         Ok(commands)
     }
 
@@ -471,6 +472,40 @@ fn test_build_parameter_scan_commands() {
     assert_eq!(commands[1].get_command_line(), "echo 2");
 }
 
+#[test]
+fn test_build_parameter_scan_commands_named() {
+    use crate::cli::get_cli_arguments;
+    let matches = get_cli_arguments(vec![
+        "hyperfine",
+        "echo {val}",
+        "sleep {val}",
+        "--parameter-scan",
+        "val",
+        "1",
+        "2",
+        "--parameter-step-size",
+        "1",
+        "--command-name",
+        "echo-1",
+        "--command-name",
+        "sleep-1",
+        "--command-name",
+        "echo-2",
+        "--command-name",
+        "sleep-2",
+    ]);
+    let commands = Commands::from_cli_arguments(&matches).unwrap().0;
+    assert_eq!(commands.len(), 4);
+    assert_eq!(commands[0].get_name(), "echo-1");
+    assert_eq!(commands[0].get_command_line(), "echo 1");
+    assert_eq!(commands[1].get_name(), "sleep-1");
+    assert_eq!(commands[1].get_command_line(), "sleep 1");
+    assert_eq!(commands[2].get_name(), "echo-2");
+    assert_eq!(commands[2].get_command_line(), "echo 2");
+    assert_eq!(commands[3].get_name(), "sleep-2");
+    assert_eq!(commands[3].get_command_line(), "sleep 2");
+}
+
 #[test]
 fn test_parameter_scan_commands_int() {
     let commands = Commands::build_parameter_scan_commands(
```

---

### Incident Patch 4: `f8db9786` (2025-09-03)
**Commit Message**: Fix CI

**File**: `.github/workflows/CICD.yml` (modified, +14/-14)
```diff
@@ -44,7 +44,7 @@ jobs:
 
   ensure_cargo_fmt:
     name: Ensure 'cargo fmt' has been run
-    runs-on: ubuntu-20.04
+    runs-on: ubuntu-24.04
     steps:
     - uses: dtolnay/rust-toolchain@stable
       with:
@@ -54,7 +54,7 @@ jobs:
 
   min_version:
     name: Minimum supported rust version
-    runs-on: ubuntu-20.04
+    runs-on: ubuntu-24.04
     needs: crate_metadata
     steps:
     - name: Checkout source code
@@ -78,18 +78,18 @@ jobs:
       fail-fast: false
       matrix:
         job:
-          - { target: aarch64-unknown-linux-gnu   , os: ubuntu-20.04, use-cross: true }
-          - { target: arm-unknown-linux-gnueabihf , os: ubuntu-20.04, use-cross: true }
-          - { target: arm-unknown-linux-musleabihf, os: ubuntu-20.04, use-cross: true }
-          - { target: i686-pc-windows-msvc        , os: windows-2019                  }
-          - { target: i686-unknown-linux-gnu      , os: ubuntu-20.04, use-cross: true }
-          - { target: i686-unknown-linux-musl     , os: ubuntu-20.04, use-cross: true }
-          - { target: x86_64-apple-darwin         , os: macos-13                      }
-          - { target: aarch64-apple-darwin        , os: macos-14                      }
-          # - { target: x86_64-pc-windows-gnu       , os: windows-2019                  }
-          - { target: x86_64-pc-windows-msvc      , os: windows-2019                  }
-          - { target: x86_64-unknown-linux-gnu    , os: ubuntu-20.04, use-cross: true }
-          - { target: x86_64-unknown-linux-musl   , os: ubuntu-20.04, use-cross: true }
+          - { target: aarch64-unknown-linux-gnu   , os: ubuntu-24.04, use-cross: true }
+          - { target: arm-unknown-linux-gnueabihf , os: ubuntu-24.04, use-cross: true }
+          - { target: arm-unknown-linux-musleabihf, os: ubuntu-24.04, use-cross: true }
+          - { target: i686-pc-windows-msvc        , os: windows-2022                  }
+          - { target: i686-unknown-linux-gnu      , os: ubuntu-24.04, use-cross: true }
+          - { target: i686-unknown-linux-musl     , os: ubuntu-24.04, use-cross: true }
+          - { target: x86_64-apple-darwin         , os: macos-15                      }
+          - { target: aarch64-apple-darwin        , os: macos-15                      }
+          # - { target: x86_64-pc-windows-gnu       , os: windows-2022                  }
+          - { target: x86_64-pc-windows-msvc      , os: windows-2022                  }
+          - { target: x86_64-unknown-linux-gnu    , os: ubuntu-24.04, use-cross: true }
+          - { target: x86_64-unknown-linux-musl   , os: ubuntu-24.04, use-cross: true }
     env:
       BUILD_CMD: cargo
     steps:
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ repository = "https://github.com/sharkdp/hyperfine"
 version = "1.19.0"
 edition = "2018"
 build = "build.rs"
-rust-version = "1.76.0"
+rust-version = "1.88.0"
 
 [features]
 # Use the nightly feature windows_process_extensions_main_thread_handle
```

---

### Incident Patch 5: `3bd38f27` (2025-01-04)
**Commit Message**: fix(tests): restrict 'cat' tests to unix environments. Fixes #776 (#777)

Tests using the 'cat' command are specific
to unix-like environments and
fail on unsupported platforms.

**File**: `tests/integration_tests.rs` (modified, +8/-2)
```diff
@@ -3,6 +3,12 @@ use common::hyperfine;
 
 use predicates::prelude::*;
 
+/// Platform-specific I/O utility.
+/// - On Unix-like systems, defaults to `cat`.
+/// - On Windows, uses `findstr` as an alternative.
+///   See: <https://superuser.com/questions/853580/real-windows-equivalent-to-cat-stdin>
+const STDIN_READ_COMMAND: &str = if cfg!(windows) { "findstr x*" } else { "cat" };
+
 pub fn hyperfine_debug() -> assert_cmd::Command {
     let mut cmd = hyperfine();
     cmd.arg("--debug-mode");
@@ -306,7 +312,7 @@ fn can_pass_input_to_command_from_a_file() {
         .arg("--runs=1")
         .arg("--input=example_input_file.txt")
         .arg("--show-output")
-        .arg("cat")
+        .arg(STDIN_READ_COMMAND)
         .assert()
         .success()
         .stdout(predicate::str::contains("This text is part of a file"));
@@ -318,7 +324,7 @@ fn fails_if_invalid_stdin_data_file_provided() {
         .arg("--runs=1")
         .arg("--input=example_non_existent_file.txt")
         .arg("--show-output")
-        .arg("cat")
+        .arg(STDIN_READ_COMMAND)
         .assert()
         .failure()
         .stderr(predicate::str::contains(
```

---

### Incident Patch 6: `6556b2bd` (2024-06-23)
**Commit Message**: Initial work on tracking memory usage

**File**: `src/benchmark/benchmark_result.rs` (modified, +4/-0)
```diff
@@ -42,6 +42,10 @@ pub struct BenchmarkResult {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub times: Option<Vec<Second>>,
 
+    /// Maximum memory usage of the process, in bytes
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub memory_usage_byte: Option<Vec<u64>>,
+
     /// Exit codes of all command invocations
     pub exit_codes: Vec<Option<i32>>,
 
```

**File**: `src/benchmark/executor.rs` (modified, +4/-0)
```diff
@@ -133,6 +133,7 @@ impl Executor for RawExecutor<'_> {
                 time_real: result.time_real,
                 time_user: result.time_user,
                 time_system: result.time_system,
+                memory_usage_byte: result.memory_usage_byte,
             },
             result.status,
         ))
@@ -204,6 +205,7 @@ impl Executor for ShellExecutor<'_> {
                 time_real: result.time_real,
                 time_user: result.time_user,
                 time_system: result.time_system,
+                memory_usage_byte: result.memory_usage_byte,
             },
             result.status,
         ))
@@ -268,6 +270,7 @@ impl Executor for ShellExecutor<'_> {
             time_real: mean(&times_real),
             time_user: mean(&times_user),
             time_system: mean(&times_system),
+            memory_usage_byte: 0,
         });
 
         Ok(())
@@ -323,6 +326,7 @@ impl Executor for MockExecutor {
                 time_real: Self::extract_time(command.get_command_line()),
                 time_user: 0.0,
                 time_system: 0.0,
+                memory_usage_byte: 0,
             },
             status,
         ))
```

**File**: `src/benchmark/mod.rs` (modified, +4/-0)
```diff
@@ -151,6 +151,7 @@ impl<'a> Benchmark<'a> {
         let mut times_real: Vec<Second> = vec![];
         let mut times_user: Vec<Second> = vec![];
         let mut times_system: Vec<Second> = vec![];
+        let mut memory_usage_byte: Vec<u64> = vec![];
         let mut exit_codes: Vec<Option<i32>> = vec![];
         let mut all_succeeded = true;
 
@@ -279,6 +280,7 @@ impl<'a> Benchmark<'a> {
         times_real.push(res.time_real);
         times_user.push(res.time_user);
         times_system.push(res.time_system);
+        memory_usage_byte.push(res.memory_usage_byte);
         exit_codes.push(extract_exit_code(status));
 
         all_succeeded = all_succeeded && success;
@@ -315,6 +317,7 @@ impl<'a> Benchmark<'a> {
             times_real.push(res.time_real);
             times_user.push(res.time_user);
             times_system.push(res.time_system);
+            memory_usage_byte.push(res.memory_usage_byte);
             exit_codes.push(extract_exit_code(status));
 
             all_succeeded = all_succeeded && success;
@@ -451,6 +454,7 @@ impl<'a> Benchmark<'a> {
             min: t_min,
             max: t_max,
             times: Some(times_real),
+            memory_usage_byte: Some(memory_usage_byte),
             exit_codes,
             parameters: self
                 .command
```

**File**: `src/benchmark/relative_speed.rs` (modified, +1/-0)
```diff
@@ -133,6 +133,7 @@ fn create_result(name: &str, mean: Scalar) -> BenchmarkResult {
         min: mean,
         max: mean,
         times: None,
+        memory_usage_byte: None,
         exit_codes: Vec::new(),
         parameters: BTreeMap::new(),
     }
```

**File**: `src/benchmark/timing_result.rs` (modified, +3/-0)
```diff
@@ -11,4 +11,7 @@ pub struct TimingResult {
 
     /// Time spent in kernel mode
     pub time_system: Second,
+
+    /// Maximum amount of memory used, in bytes
+    pub memory_usage_byte: u64,
 }
```

---

### Incident Patch 7: `87d77c86` (2024-11-13)
**Commit Message**: Fix version in README

**File**: `README.md` (modified, +2/-2)
```diff
@@ -170,8 +170,8 @@ like `--warmup`, `--prepare <cmd>`, `--setup <cmd>` or `--cleanup <cmd>`:
 Download the appropriate `.deb` package from the [Release page](https://github.com/sharkdp/hyperfine/releases)
 and install it via `dpkg`:
 ```
-wget https://github.com/sharkdp/hyperfine/releases/download/v1.16.1/hyperfine_1.16.1_amd64.deb
-sudo dpkg -i hyperfine_1.16.1_amd64.deb
+wget https://github.com/sharkdp/hyperfine/releases/download/v1.19.0/hyperfine_1.19.0_amd64.deb
+sudo dpkg -i hyperfine_1.19.0_amd64.deb
 ```
 
 ### On Fedora
```

---

### Incident Patch 8: `f096c266` (2024-10-26)
**Commit Message**: fix build warning proposal

```rust
warning: elided lifetime has a name
   --> src/command.rs:137:66
    |
136 | impl<'a> Commands<'a> {
    |      -- lifetime `'a` declared here
137 |     pub fn from_cli_arguments(matches: &'a ArgMatches) -> Result<Commands> {
    |                                                                  ^^^^^^^^ this elided lifetime gets resolved as `'
```

**File**: `src/command.rs` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ impl<'a> Command<'a> {
 pub struct Commands<'a>(Vec<Command<'a>>);
 
 impl<'a> Commands<'a> {
-    pub fn from_cli_arguments(matches: &'a ArgMatches) -> Result<Commands> {
+    pub fn from_cli_arguments(matches: &'a ArgMatches) -> Result<Commands<'a>> {
         let command_names = matches.get_many::<String>("command-name");
         let command_strings = matches
             .get_many::<String>("command")
```

---

### Incident Patch 9: `eeaa6bdb` (2024-08-28)
**Commit Message**: Fix multiple strings in one line

**File**: `scripts/advanced_statistics.py` (modified, +1/-1)
```diff
@@ -39,5 +39,5 @@
     print()
     print("  percentiles:")
     print(f"     P_05 .. P_95:    {p05:.3f} s .. {p95:.3f} s")
-    print(f"     P_25 .. P_75:    {p25:.3f} s .. {p75:.3f} s  " f"(IQR = {iqr:.3f} s)")
+    print(f"     P_25 .. P_75:    {p25:.3f} s .. {p75:.3f} s  (IQR = {iqr:.3f} s)")
     print()
```

**File**: `scripts/ruff.toml` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 [lint]
-extend-select = ["I"]
+extend-select = ["I", "UP", "RUF"]
```

---

### Incident Patch 10: `824aafbd` (2024-07-09)
**Commit Message**: Fix typos README.md

**File**: `README.md` (modified, +2/-2)
```diff
@@ -213,14 +213,14 @@ pacman -S hyperfine
 
 ### On Debian Linux
 
-On Debian Linux, hyperfine can be installed [from the testing repositories](https://packages.debian.org/testing/main/hyperfine)
+On Debian Linux, hyperfine can be installed [from the testing repositories](https://packages.debian.org/testing/main/hyperfine):
 ```
 apt install hyperfine
 ```
 
 ### On Exherbo Linux
 
-On Exherbo Linux, hyperfine can be installed [from the rust repositories]([https://packages.debian.org/testing/main/hyperfine](https://gitlab.exherbo.org/exherbo/rust/-/tree/master/packages/sys-apps/hyperfine)
+On Exherbo Linux, hyperfine can be installed [from the rust repositories](https://gitlab.exherbo.org/exherbo/rust/-/tree/master/packages/sys-apps/hyperfine):
 ```
 cave resolve -x repository/rust
 cave resolve -x hyperfine
```

#### Recent Merged Pull Requests:
- **PR #914** (closed): Neutralize spreadsheet formula characters in CSV export (@carfeii)
- **PR #911** (closed): docs: explain --reference with --prepare and parameters (@Solaris-star)
- **PR #905** (closed): Fix overflow when a parameter range ends at the numeric type's maximum (@santhreal)
- **PR #904** (closed): [codex] Truncate export files when rewriting (@kmg0308)
- **PR #903** (closed): docs: fix invalid `\fi` font escape in man page (should be `\fI`) (@mahirhir)
- **PR #896** (closed): fix: complete executables in fish for benchmark commands (@wyf027)
- **PR #895** (closed): feat: allow --shell on a per-command basis (@wyf027)
- **PR #894** (closed): Add --import-json to combine results from separate runs (fixes #830) (@wyf027)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
