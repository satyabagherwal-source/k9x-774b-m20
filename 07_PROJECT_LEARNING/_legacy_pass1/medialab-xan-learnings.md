# Forensic Learning Record (Deep Inspection): medialab/xan

> **Canonical Artifact**: `07_PROJECT_LEARNING/medialab-xan-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/medialab/xan](https://github.com/medialab/xan))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:21:43.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `medialab/xan`
- **Description**: The CSV magician
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4531 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/cmd/agg.rs`
```
use std::num::NonZeroUsize;

use crate::CliResult;
use crate::cmd::parallel::Args as ParallelArgs;
use crate::config::{Config, Delimiter};
use crate::moonblade::AggregationProgram;
use crate::select::SelectedColumns;
use crate::util;

// NOTE: what was tried for parallelization:
//   1. Horizontal parallelization (by execution unit of the aggregation planner)
//   2. Vertical parallelization by broadcasting lines to multiple threads
//   3. Chunking vertical parallelization
//   4. Aggregator finalization parallelization (sorting for median, for instance)

static USAGE: &str = "
Aggregate CSV data using custom aggregation expressions.

For typical statistics, check out the `xan stats` command that is usually
simpler to use.

For grouped aggregation, check out the `xan groupby` command instead.

# Custom aggregation

When running a custom aggregation, the result will be a single row of CSV
containing the result of aggregating the whole file.

For instance, given the following CSV file:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

Running the following command:

    $ xan agg 'sum(count1) as sum1, sum(count2) as sum2'

Will produce the following output:

| sum1 | sum2 |
| ---- | ---- |
| 13   | 13   |

Check out the following example to learn how to compose your expressions. Note
that a complete list of aggregation functions can be found using `xan help aggs`.

Computing the sum of a column:

    $ xan agg 'sum(retweet_count)' file.csv

Using dynamic expressions to mangle the data before aggregation:

    $ xan agg 'sum(retweet_count + replies_count)' file.csv

Multiple aggregations at once:

    $ xan agg 'sum(retweet_count), mean(retweet_count), max(replies_count)' file.csv

Renaming the output columns using the 'as' syntax:

    $ xan agg 'sum(n) as sum, max(replies_count) as \"Max Replies\"' file.csv

# Aggregating along rows

This command can be used to aggregate a selection of columns per row,
instead of aggregating the whole file, when using the --along-rows flag. In
which case aggregation functions will accept the anonymous `_` placeholder value
representing the currently processed column's value.

In a way, it is a variant of `xan map`, able to leverage aggregation
functions and generic over target columns.

Note that when using --along-rows, the `col_index()` function will return the
index of currently processed column, not the row index. This can be useful
when used with `argmin/argmax` etc.

For instance, given the following CSV file:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

Running the following command (notice the `_` in expression):

    $ xan agg --along-rows count1,count2 'sum(_) as sum'

Will produce the following output:

| name | count1 | count2 | sum |
| ---- | ------ | ------ | --- |
| john | 3      | 6      | 9   |
| lucy | 10     | 7      | 17  |

Typical use-cases include getting the variance of the dimensions of
dense vectors:

    $ xan agg -R 'dim_*' 'var(_) as variance' vectors.csv

Finding the column maximizing a score:

    $ xan agg -R '*_score' 'argmax(_, header(col_index()) as best' results.csv

# Aggregating along columns

This command can also be used to run a same aggregation over a selection of commands
using the -C/--along-columns flag. In which case aggregation functions will accept
the anonymous `_` placeholder value representing the currently processed column's value.

For instance, given the following file:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

Running the following command (notice the `_` in expression):

    $ xan agg --along-cols count1,count2 'sum(_)'

Will produce the following output:

| count1 | count2 |
| ------ | ------ |
| 13     | 13     |

# Aggregating along matrix

This command can also be used to run a custom aggregation over all values of
a selection of columns thus representing a 2-dimensional matrix, using
the -M/--along-matrix flag. In which case aggregation functions will accept
the anonymous `_` placeholder value representing the currently processed column's value.

For instance, given the following file:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

Running the following command (notice the `_` in expression):

    $ xan agg --along-matrix count1,count2 'sum(_) as total'

Will produce the following output:

| total |
| ----- |
| 26    |

---

For a quick review of the capabilities of the expression language,
check out the `xan help cheatsheet` command.

For a list of available aggregation functions use `xan help aggs`.

For a list of available functions, use `xan help functions`.

Aggregations can be computed in parallel using the -p/--parallel or -t/--threads flags.
But this cannot work on streams or gzipped files, unless a `.gzi` index (as created
by `bgzip -i`) can be found beside it. Parallelization is not compatible
with the -R/--along-rows, -M/--along-matrix nor -C/--along-cols options.

Usage:
    xan agg [options] <expression> [<input>]
    xan agg --help

agg options:
    -R, --along-rows <cols>    Aggregate a selection of columns for each row
                               instead of the whole file.
    -C, --along-cols <cols>    Aggregate a selection of columns the same way and
                               return an aggregated column with same name in the
                               output.
    -M, --along-matrix <cols>  Aggregate all values found in the given selection
                               of columns.
    -p, --parallel             Whether to use parallelization to speed up computation.
                               Will automatically select a suitable number of threads to use
                               based on your number of cores. Use -t, --threads if you want to
                               indicate the number of threads yourself.
    -t, --threads <threads>    Parellize computations using this many threads. Use -p, --parallel
                               if you want the number of threads to be automatically chosen instead.

Common options:
    -h, --help               Display this message
    -o, --output <file>      Write output to <file> instead of stdout.
    -n, --no-headers         When set, the first row will not be evaled
                             as headers.
    -d, --delimiter <arg>    The field delimiter for reading CSV data.
                             Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    arg_expression: String,
    arg_input: Option<String>,
    flag_no_headers: bool,
    flag_output: Option<String>,
    flag_delimiter: Option<Delimiter>,
    flag_along_rows: Option<SelectedColumns>,
    flag_along_cols: Option<SelectedColumns>,
    flag_along_matrix: Option<SelectedColumns>,
    flag_parallel: bool,
    flag_threads: Option<NonZeroUsize>,
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;

    let agg_modes = args.flag_along_cols.is_some() as u8
        + args.flag_along_rows.is_some() as u8
        + args.flag_along_matrix.is_some() as u8;

    if agg_modes > 1 {
        Err("must select only one of -C/--along-cols & -R/--along-rows!")?;
    }

    if args.flag_parallel || args.flag_threads.is_some() {
        if args.flag_along_rows.is_some() {
            Err("-p/--parallel or -t/--threads cannot be used with -C/--along-cols!")?;
        }

        if args.flag_along_cols.is_some() {
            Err("-p/--parallel or -t/--threads cannot be used with -R/--along-rows!")?;
        }

        if args.flag_along_matrix.is_some() {
            Err("-p/--parallel or -t/--threads cannot be used with -M/--along-matrix!")?;
        }

        let mut parallel_args = ParallelArgs::single_file(&args.arg_input, args.flag_threads)?;

        parallel_args.cmd_agg = true;
        parallel_args.
```

### Core Architecture Module: `src/cmd/behead.rs`
```
use std::fs::OpenOptions;
use std::io::{self, Write};

use crate::CliResult;
use crate::config::{Config, Delimiter};
use crate::util;

static USAGE: &str = "
Drop a CSV file's header.

Note that to be as performant as possible, this command does not try
to be clever and only parses the first CSV row to drop it. The rest of
the file will be flushed to the output as-is without any kind of normalization.

Usage:
    xan behead [options] [<input>]
    xan guillotine [options] [<input>]

behead options:
    -A, --append  Only drop headers if output already exists and
                  is not empty. Requires -o/--output to be set.

Common options:
    -h, --help             Display this message
    -o, --output <file>    Write output to <file> instead of stdout.
    -d, --delimiter <arg>  The field delimiter for reading CSV data.
                           Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    arg_input: Option<String>,
    flag_append: bool,
    flag_delimiter: Option<Delimiter>,
    flag_output: Option<String>,
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;

    if args.flag_append && args.flag_output.is_none() {
        Err(
            "-A/--append needs to know where the output will be written!\nPlease provide -o/--output.",
        )?;
    }

    let wconf = Config::new(&args.flag_output);

    let mut actually_behead = true;

    if args.flag_append {
        let output_path = wconf.path.as_ref().unwrap();

        if !output_path.is_file() || output_path.metadata()?.len() == 0 {
            actually_behead = false;
        }
    }

    let rconf = Config::new(&args.arg_input)
        .delimiter(args.flag_delimiter)
        .no_headers(!actually_behead);

    let mut peeker = rconf.simd_peeker()?;
    peeker.peek()?;

    let mut wtr = wconf.buf_io_writer_with_options(
        OpenOptions::new()
            .write(true)
            .create(true)
            .append(args.flag_append),
    )?;

    io::copy(&mut peeker.into_reader(), &mut wtr)?;

    Ok(wtr.flush()?)
}

```

### Core Architecture Module: `src/cmd/bins.rs`
```
use std::cmp::Ordering;

use bstr::ByteSlice;
use rayon::slice::ParallelSliceMut;

use crate::CliResult;
use crate::config::{Config, Delimiter};
use crate::scales::LinearScale;
use crate::select::SelectedColumns;
use crate::util;

static USAGE: &str = "
Discretize selection of columns containing continuous data into bins.

The resulting bins table will be formatted thusly:

field       - Name of the column
value       - Bin's label (depends on what was given to -l/--label)
lower_bound - Lower bound of the bin
upper_bound - Upper bound of the bin
count       - Number of rows falling into this bin

The number of bins can be chosen with the -b/--bins flag. Note that,
by default, this number is an approximate goal since the command
attempts to find readble boundaries for the bins and this make it
hard to respect a precise number of bins. Use the -e/--exact flag
if you want to force the command to respect -b/--bins exactly.

Combined with `xan hist`, this command can be very useful to visualize
distributions of continous columns:

    $ xan bins -s count data.csv | xan hist

Using a log scale:

    $ xan bins -s count data.csv | xan hist --scale log

Usage:
    xan bins [options] [<input>]
    xan bins --help

bins options:
    -s, --select <arg>      Select a subset of columns to compute bins for. See
                            'xan select --help' for more detail.
    -b, --bins <number>     Number of bins to generate. Note that without -e/--exact,
                            this number should be considered as an approximate goal.
                            The command by default attempts to find nice & readable boundaries
                            for the bins and this means a precise number of bins is not
                            always achievable.
                            [default: 10]
    -H, --heuristic <name>  Heuristic to use to automatically find an adequate number
                            of bins. Must be one of `freedman-diaconis`, `sqrt` or `sturges`.
    --max-bins <number>     Maximum number of bins to generate. Only useful when using
                            the -H/--heuristic flag.
    -e, --exact             Whether to make sure to return the exact number of bins
                            provided to -b/--bins, which means the readability of the
                            bins boundaries might suffer.
    -l, --label <mode>      Label to choose for the bins (that will be placed in the
                            `value` column). Mostly useful to tweak representation when
                            piping to `xan hist`. Can be one of \"full\", \"lower\" or \"upper\".
                            [default: full]
    -m, --min <min>         Override min value. Values lower that this min will be counted
                            as out of bounds.
    -M, --max <max>         Override max value. Values greater that this max will be counted
                            as out of bounds.
    -N, --no-extra          Don't include, empty cells, nans and out of bounds counts.

Common options:
    -h, --help             Display this message
    -o, --output <file>    Write output to <file> instead of stdout.
    -n, --no-headers       When set, the file will be considered as having no
                           headers.
    -d, --delimiter <arg>  The field delimiter for reading CSV data.
                           Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    arg_input: Option<String>,
    flag_select: SelectedColumns,
    flag_no_headers: bool,
    flag_delimiter: Option<Delimiter>,
    flag_output: Option<String>,
    flag_no_extra: bool,
    flag_bins: usize,
    flag_max_bins: Option<usize>,
    flag_heuristic: Option<Heuristic>,
    flag_label: LabelOption,
    flag_exact: bool,
    flag_min: Option<f64>,
    flag_max: Option<f64>,
}

impl Args {
    fn bins_count(&self) -> BinsCount {
        match self.flag_heuristic {
            Some(heuristic) => BinsCount::WithHeuristic(heuristic),
            None => BinsCount::Some(self.flag_bins),
        }
    }
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;
    let conf = Config::new(&args.arg_input)
        .delimiter(args.flag_delimiter)
        .no_headers(args.flag_no_headers)
        .select(args.flag_select.clone());

    let mut rdr = conf.simd_reader()?;
    let mut wtr = Config::new(&args.flag_output).simd_writer()?;

    let headers = rdr.byte_headers()?.clone();
    let sel = conf.selection(&headers)?;

    let mut all_series: Vec<Series> = sel.iter().map(|i| Series::new(*i)).collect();

    let mut record = simd_csv::ByteRecord::new();

    while rdr.read_byte_record(&mut record)? {
        for (cell, series) in sel.select(&record).zip(all_series.iter_mut()) {
            series.add(cell, &args.flag_min, &args.flag_max);
        }
    }

    wtr.write_record(["field", "value", "lower_bound", "upper_bound", "count"])?;

    for series in all_series.iter_mut() {
        match series.bins(
            args.bins_count(),
            args.flag_max_bins,
            args.flag_min,
            args.flag_max,
            args.flag_exact,
        ) {
            None => continue,
            Some(bins) => {
                let max_lower_bound_width = bins
                    .iter()
                    .map(|bin| util::format_number(bin.lower_bound).len())
                    .max()
                    .unwrap();
                let max_upper_bound_width = bins
                    .iter()
                    .map(|bin| util::format_number(bin.upper_bound).len())
                    .max()
                    .unwrap();

                let mut bins_iter = bins.iter().peekable();

                while let Some(bin) = bins_iter.next() {
                    let (lower_bound, upper_bound) = match series.data_type {
                        DataType::Float => (bin.lower_bound, bin.upper_bound),
                        DataType::Integer => (bin.lower_bound.ceil(), bin.upper_bound.ceil()),
                    };

                    let lower_bound = util::format_number(lower_bound);
                    let upper_bound = util::format_number(upper_bound);

                    let label_format = if bin.is_constant() {
                        lower_bound
                    } else {
                        match args.flag_label {
                            LabelOption::Full => match bins_iter.peek() {
                                None => format!(
                                    ">= {lower_bound:max_lower_bound_width$} <= {upper_bound:max_upper_bound_width$}"
                                ),
                                Some(_) => format!(
                                    ">= {lower_bound:max_lower_bound_width$} <  {upper_bound:max_upper_bound_width$}"
                                ),
                            },
                            LabelOption::Upper => upper_bound,
                            LabelOption::Lower => lower_bound,
                        }
                    };

                    wtr.write_record([
                        &headers[series.column],
                        label_format.as_bytes(),
                        bin.lower_bound.to_string().as_bytes(),
                        bin.upper_bound.to_string().as_bytes(),
                        bin.count.to_string().as_bytes(),
                    ])?;
                }
            }
        }

        if !args.flag_no_extra && series.nans > 0 {
            wtr.write_record([
                &headers[series.column],
                b"<NaN>",
                b"",
                b"",
                series.nans.to_string().as_bytes(),
            ])?;
        }

        if !args.flag_no_extra && series.nulls > 0 {
            wtr.write_record([
                &headers[series.column],
                b"<empty>",
                b"",
                b"",
                series.nulls.to_string().as_bytes(),
          
```

### Core Architecture Module: `src/cmd/bisect.rs`
```
use std::cmp::Ordering;
use std::io::{SeekFrom, Write, stderr};

use simd_csv::ByteRecord;

use crate::CliResult;
use crate::cmd::sort::{Number, compare_num, parse_num};
use crate::config::{Config, Delimiter};
use crate::select::SelectedColumns;
use crate::util;

#[derive(Clone, PartialEq, Debug)]
enum Value {
    Number(Number),
    String(Vec<u8>),
}

impl Eq for Value {}

impl PartialOrd for Value {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Value {
    #[inline]
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Self::Number(n1), Self::Number(n2)) => compare_num(*n1, *n2),
            (Self::String(s1), Self::String(s2)) => s1.cmp(s2),
            _ => panic!("Cannot compare different value types"),
        }
    }
}

impl std::fmt::Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Number(n) => match n {
                Number::Int(i) => write!(f, "{i}"),
                Number::Float(fl) => write!(f, "{fl}"),
            },
            Self::String(s) => write!(f, "{}", std::str::from_utf8(s).unwrap()),
        }
    }
}

impl Value {
    fn new_string(s: &[u8]) -> Self {
        Self::String(s.to_vec())
    }

    fn new_number(s: &[u8]) -> Result<Self, String> {
        match parse_num(s) {
            Some(n) => Ok(Self::Number(n)),
            None => Err(format!(
                "Failed to parse {} as a number!",
                std::str::from_utf8(s).unwrap()
            )),
        }
    }
}

static USAGE: &str = r#"
Perform binary search on sorted CSV data.

This command is one order of magnitude faster than relying on `xan filter` or
`xan search` but only works if target file is sorted on searched column, exists
on disk and is not compressed (unless the compressed file remains seekable,
typically if some `.gzi` index can be found beside it).

If CSV data is not properly sorted, result will be incorrect!

By default this command executes the so-called "lower bound" operation: it
positions itself in the file where one would insert the searched value and then
proceeds to flush the file from this point. This can be useful when piping
into other commands to perform range queries, for instance, or enumerate values
starting with some prefix.

Use the -S/--search flag if you only want to return rows matching your query
exactly.

Finally, use the -R/--reverse flag if data is sorted in descending order and
the -N/--numeric flag if data is sorted numerically rather than lexicographically.

Examples:

Searching for rows matching exactly "Anna" in a "name" column:

    $ xan bisect -S name Anna people.csv

Finding all names starting with letter A:

    $ xan bisect name A people.csv | xan slice -E '!name.startswith("A")'

Usage:
    xan bisect [options] [--] <column> <value> <input>
    xan bisect --help

bisect options:
    -S, --search   Perform an exact search and only emit rows matching the
                   query, instead of flushing all rows from found position.
    -R, --reverse  Indicate that the file is sorted on <column> in descending
                   order, instead of the default ascending order.
    -N, --numeric  Indicate that searched values are numbers and that the order
                   of the file is numerical instead of default lexicographic
                   order.
    -E, --exclude  When set, rows matching query exactly will be filtered out.
                   It is equivalent to performing the "upper bound" operation
                   but it does not come with the same performance guarantees
                   in case there are many rows containing the searched values.
                   Does not work with -S/--search.
    -v, --verbose  Print some log detailing the search process in stderr, mostly
                   for debugging purposes.

Common options:
    -h, --help               Display this message
    -o, --output <file>      Write output to <file> instead of stdout.
    -n, --no-headers         When set, the first row will not be evaled
                             as headers.
    -d, --delimiter <arg>    The field delimiter for reading CSV data.
                             Must be a single character.
"#;

#[derive(Deserialize, Debug)]
struct Args {
    arg_column: SelectedColumns,
    arg_value: String,
    arg_input: String,
    flag_exclude: bool,
    flag_numeric: bool,
    flag_reverse: bool,
    flag_search: bool,
    flag_output: Option<String>,
    flag_no_headers: bool,
    flag_delimiter: Option<Delimiter>,
    flag_verbose: bool,
}

impl Args {
    #[inline]
    fn get_value_from_bytes(&self, bytes: &[u8]) -> Result<Value, String> {
        if self.flag_numeric {
            Value::new_number(bytes)
        } else {
            Ok(Value::new_string(bytes))
        }
    }

    #[inline]
    fn cmp(&self, v1: &Value, v2: &Value) -> Ordering {
        let ordering = v1.cmp(v2);

        if self.flag_reverse {
            ordering.reverse()
        } else {
            ordering
        }
    }
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;

    if args.flag_exclude && args.flag_search {
        Err("The -E/--exclude and -S/--search flags cannot be used together")?;
    }

    let mut verbose_out = stderr();

    macro_rules! log {
        ($($arg:tt)*) => {
            if args.flag_verbose {
                writeln!(&mut verbose_out, $($arg)*)?;
            }
        };
    }

    let searched_value = args.get_value_from_bytes(args.arg_value.as_bytes())?;

    let rconf = Config::new(&Some(args.arg_input.clone()))
        .no_headers(args.flag_no_headers)
        .select(args.arg_column.clone())
        .delimiter(args.flag_delimiter);

    let mut seeker = rconf.simd_seeker()?.ok_or("File cannot be seeked!")?;
    let column_index = rconf.single_selection(seeker.byte_headers())?;

    let mut wtr = Config::new(&args.flag_output).simd_writer()?;

    if !rconf.no_headers {
        wtr.write_byte_record(seeker.byte_headers())?;
    }

    let first_record = match seeker.first_byte_record()? {
        Some(r) => r,
        None => {
            // NOTE: file is empty!
            return Ok(());
        }
    };

    let last_record = seeker.last_byte_record()?.unwrap();

    let first_value = args.get_value_from_bytes(&first_record[column_index])?;
    let last_value = args.get_value_from_bytes(&last_record[column_index])?;

    let mut lo = seeker.first_record_position();
    let mut hi = seeker.stream_len();

    log!("lo byte: {}", lo);
    log!("hi byte: {}", hi);

    // File does not seem to be correctly sorted
    if args.cmp(&first_value, &last_value).is_gt() {
        Err(format!(
            "input is not sorted in specified order!\nSee first and last values: {first_value} and {last_value}"
        ))?;
    }

    // Searched value is more than last value: we can stop right now
    if args.cmp(&searched_value, &last_value).is_gt() {
        log!("early exit: search value is after last value!");
        return Ok(());
    }

    // Searched value is less than first value or equal
    let mut skip_search = false;

    if args.cmp(&searched_value, &first_value).is_le() {
        log!("skipping search: search value is before first value!");
        skip_search = true;
    }

    // `bisect_left`
    // while lo < hi:
    //     mid = (lo+hi)//2
    //     if a[mid] < x: lo = mid+1
    //     else: hi = mid
    // return lo

    let mut jumps: usize = 0;

    if !skip_search {
        while lo < hi {
            let mid = (lo + hi) / 2;
            log!("\nmid byte: {}", mid);

            jumps += 1;

            match seeker.find_record_after(mid)? {
                Some((pos, record)) => {
                    log!("successful jump n°{} to: {} (+{})", jumps, pos, pos - mid);

                    let value = args.get_value_from_bytes(&record[col
```

### Core Architecture Module: `src/cmd/blank.rs`
```
use simd_csv::ByteRecord;

use crate::CliResult;
use crate::config::{Config, Delimiter};
use crate::select::SelectedColumns;
use crate::util;

// TODO: some --pivot option, that blanks hierarchically

static USAGE: &str = "
Blank down selected columns of a CSV file. That is to say, this
command will redact any consecutive identical cells as per column selection.

This can be useful as a presentation trick or a compression scheme.

The \"blank\" term comes from OpenRefine and does the same thing.

Usage:
    xan blank [options] [<input>]
    xan blank --help

blank options:
    -s, --select <cols>    Selection of columns to blank down.
    -r, --redact <value>   Redact the blanked down values using the provided
                           replacement string. Will default to an empty string.

Common options:
    -h, --help             Display this message
    -o, --output <file>    Write output to <file> instead of stdout.
    -n, --no-headers       When set, the file will be considered as having no
                           headers.
    -d, --delimiter <arg>  The field delimiter for reading CSV data.
                           Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    arg_input: Option<String>,
    flag_select: SelectedColumns,
    flag_no_headers: bool,
    flag_delimiter: Option<Delimiter>,
    flag_output: Option<String>,
    flag_redact: Option<String>,
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;
    let rconf = Config::new(&args.arg_input)
        .delimiter(args.flag_delimiter)
        .no_headers(args.flag_no_headers)
        .select(args.flag_select);

    let redacted_string = args.flag_redact.unwrap_or("".to_string());

    let mut rdr = rconf.simd_reader()?;
    let mut wtr = Config::new(&args.flag_output).simd_writer()?;

    let headers = rdr.byte_headers()?;

    let sel = rconf.selection(headers)?;
    let mask = sel.mask(headers.len());

    if !rconf.no_headers {
        wtr.write_byte_record(headers)?;
    }

    let mut record = ByteRecord::new();
    let mut current: Option<ByteRecord> = None;

    while rdr.read_byte_record(&mut record)? {
        let key = sel.select(&record).collect::<ByteRecord>();

        match current.as_ref() {
            Some(current_key) if current_key == &key => {
                wtr.write_record(mask.iter().copied().zip(record.iter()).map(
                    |(should_redact, cell)| {
                        if should_redact {
                            redacted_string.as_bytes()
                        } else {
                            cell
                        }
                    },
                ))?;
            }
            _ => {
                current = Some(key);
                wtr.write_byte_record(&record)?;
            }
        }
    }

    Ok(wtr.flush()?)
}

```

### Core Architecture Module: `src/cmd/cat.rs`
```
use std::io;
use std::num::NonZeroUsize;

use simd_csv::ByteRecord;

use crate::CliResult;
use crate::cmd::parallel::Args as ParallelArgs;
use crate::collections::new_index_set;
use crate::config::{Config, Delimiter};
use crate::select::SelectedColumns;
use crate::util;

static USAGE: &str = "
Concatenates CSV data by column or by row.

When concatenating by column, the columns will be written in the same order as
the inputs given. The number of rows in the result is always equivalent to to
the minimum number of rows across all given CSV data. (This behavior can be
reversed with the '--pad' flag.)

When concatenating by row, all CSV data must have the same number of columns.
If you need to rearrange the columns or fix the lengths of records, use the
'select' or 'fixlengths' commands. Also, only the headers of the *first* CSV
data given are used. Headers in subsequent inputs are ignored. (This behavior
can be disabled with --no-headers.)

Alternatively, you can reorder columns and pad rows using -I/--intersection
or -U/-union. This can be useful when dealing with multiple files having similar
but not exactly identical schemas.

When concatenating a large number of CSV files exceeding your shell's
command arguments limit, prefer using the --paths flag to read the list of CSV
files to concatenate from input lines or from a CSV file containing paths in a
column given to the --path-column flag.

Feeding --paths lines:

    $ xan cat rows --paths paths.txt > concatenated.csv

Feeding --paths CSV file:

    $ xan cat rows --paths files.csv --path-column path > concatenated.csv

Feeding stdin (\"-\") to --paths:

    $ find . -name '*.csv' | xan cat rows --paths - > concatenated.csv

Feeding CSV as stdin (\"-\") to --paths:

    $ cat filelist.csv | xan cat rows --paths - --path-column path > concatenated.csv

You can also use the --glob flag to feed the command a glob pattern (for instance
if your shell does not support it natively or if the number of files exceeds the
arguments limit):

    $ xan cat rows --glob '*.csv' > concatenated.csv

Usage:
    xan cat rows [options] [<inputs>...]
    xan cat (cols|columns) [options] [<inputs>...]
    xan cat --help

cat cols/columns options:
    -p, --pad                   When concatenating columns, this flag will cause
                                all records to appear. It will pad each row if
                                other CSV data isn't long enough.

cat rows options:
    -I, --intersection           Compute the intersection of headers of all concatenated files
                                 and reorder columns of concatenated files accordingly. This is incompatible
                                 with -U/--union, preprocessing and -n/--no-headers.
    -U, --union                  Compute the union of headers of all concatenated files
                                 and reorder columns of concatenated files accordingly. This is incompatible
                                 with -I/--intersection, preprocessing and -n/--no-headers.
    --paths <input>              When concatenating rows, give a text file (use \"-\" for stdin)
                                 containing one path of CSV file to concatenate per line.
    --path-column <name>         When given a column name, --paths will be considered as CSV, and paths
                                 to CSV files to concatenate will be extracted from the selected column.
    --glob <pattern>             Use given glob <pattern> to collect files to concatenate.
    -S, --source-column <name>   Name of a column to prepend in the output of \"cat rows\"
                                 indicating the path to source file.
    -P, --preprocess <op>        Preprocessing using only `xan` subcommands.
                                 See `xan parallel -h` for more information about preprocessing.
    --run <path>                 Run xan script at given <path> as preprocessing.
                                 See `xan run -h` for more information.
    -H, --shell-preprocess <op>  Preprocessing commands that will run directly in your
                                 own shell using the -c flag.
                                 See `xan parallel -h` for more information about preprocessing.
    --raw                        Concatenate files as fast as possible, while skipping subsequent
                                 files' headers. Will not normalize the CSV stream at all while doing
                                 so, nor verify columns alignment. Only use for performance, and
                                 if you know what you are doing.

Common options:
    -h, --help             Display this message
    -o, --output <file>    Write output to <file> instead of stdout.
    -n, --no-headers       When set, the first row will NOT be interpreted
                           as column names. Note that this has no effect when
                           concatenating columns.
    -d, --delimiter <arg>  The field delimiter for reading CSV data.
                           Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    cmd_rows: bool,
    cmd_columns: bool,
    cmd_cols: bool,
    arg_inputs: Vec<String>,
    flag_paths: Option<String>,
    flag_path_column: Option<SelectedColumns>,
    flag_glob: Option<String>,
    flag_pad: bool,
    flag_output: Option<String>,
    flag_no_headers: bool,
    flag_delimiter: Option<Delimiter>,
    flag_source_column: Option<String>,
    flag_raw: bool,
    flag_preprocess: Option<String>,
    flag_shell_preprocess: Option<String>,
    flag_run: Option<String>,
    flag_intersection: bool,
    flag_union: bool,
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;

    if args.flag_paths.is_some() && !args.arg_inputs.is_empty() {
        Err("--paths cannot be used with other positional arguments!")?;
    }

    if args.flag_intersection && args.flag_union {
        Err("only one of -I/--intersection or -U/--union must be selected!")?;
    }

    if (args.flag_intersection || args.flag_union) && args.flag_no_headers {
        Err("-I/--intersection or -U/--union cannot work with -n/--no-headers!")?;
    }

    if args.flag_preprocess.is_some()
        || args.flag_shell_preprocess.is_some()
        || args.flag_run.is_some()
    {
        if args.flag_intersection || args.flag_union {
            Err("preprocessing is incompatible with -I/--intersection or -U/--union!")?;
        }

        let mut parallel_args = ParallelArgs::default();
        parallel_args.cmd_cat = true;
        parallel_args.arg_inputs = args.paths()?.collect::<Result<Vec<_>, _>>()?;
        parallel_args.flag_source_column = args.flag_source_column;
        parallel_args.flag_preprocess = args.flag_preprocess;
        parallel_args.flag_run = args.flag_run;
        parallel_args.flag_shell_preprocess = args.flag_shell_preprocess;
        parallel_args.flag_no_headers = args.flag_no_headers;
        parallel_args.flag_delimiter = args.flag_delimiter;
        parallel_args.flag_threads = Some(NonZeroUsize::new(1).unwrap());

        return parallel_args.run();
    }

    if args.cmd_rows {
        if args.flag_raw {
            args.cat_rows_raw()
        } else if args.flag_intersection || args.flag_union {
            args.cat_rows_recombobulated()
        } else {
            args.cat_rows()
        }
    } else if args.cmd_columns || args.cmd_cols {
        if args.flag_raw {
            Err("--raw only works with `xan cat rows`!")?;
        }

        args.cat_columns()
    } else {
        unreachable!();
    }
}

impl Args {
    fn paths(&self) -> CliResult<Box<dyn Iterator<Item = CliResult<String>>>> {
        let modes = self.flag_paths.is_some() as u8
            + !self.arg_inputs.is_empty() as u8
            + self.flag_glob.is_some() as u8;

        if modes > 1 {
            Err(
                "this command either accepts arguments or --paths or --glob but not a combina
```

### Core Architecture Module: `src/cmd/cluster.rs`
```
use std::io::{self, Write};

use serde::ser::{Serialize, SerializeStruct, Serializer};

use crate::CliResult;
use crate::collections::{HashMap, hash_map::Entry};
use crate::config::{Config, Delimiter};
use crate::moonblade::Program;
use crate::select::SelectedColumns;
use crate::util;

static USAGE: &str = "
TODO...

Usage:
    xan cluster <column> [options] [<input>]
    xan cluster --help

cluster options:
    -k, --key <expr>  An expression to evaluate to generate a key
                      for each row by transforming the selected cell.

Common options:
    -h, --help               Display this message
    -o, --output <file>      Write output to <file> instead of stdout.
    -n, --no-headers         When set, the first row will not be evaled
                             as headers.
    -d, --delimiter <arg>    The field delimiter for reading CSV data.
                             Must be a single character.
";

#[derive(Deserialize)]
struct Args {
    arg_column: SelectedColumns,
    arg_input: Option<String>,
    flag_key: Option<String>,
    flag_no_headers: bool,
    flag_output: Option<String>,
    flag_delimiter: Option<Delimiter>,
}

pub fn run(argv: &[&str]) -> CliResult<()> {
    let args: Args = util::get_args(USAGE, argv)?;

    let rconf = Config::new(&args.arg_input)
        .delimiter(args.flag_delimiter)
        .no_headers(args.flag_no_headers)
        .select(args.arg_column);

    let mut rdr = rconf.simd_reader()?;
    let headers = rdr.byte_headers()?;

    let sel_index = rconf.single_selection(headers)?;

    let key_expr = match &args.flag_key {
        Some(expr) => format!("col({sel_index}) | {expr}"),
        None => format!("col({sel_index})"),
    };

    let program = Program::parse(&key_expr, headers, rconf.no_headers)?;
    let mut clustering: Box<dyn ClusteringAlgorithm> = Box::<KeyCollision>::default();

    let mut record = simd_csv::ByteRecord::new();
    let mut index: usize = 0;

    while rdr.read_byte_record(&mut record)? {
        let value = String::from_utf8(record[sel_index].to_vec()).unwrap();
        let key = program.generate_key(index, &record)?;

        clustering.process(index, key, value);

        index += 1;
    }

    let mut clusters = clustering.into_clusters();

    clusters.sort_by(|a, b| {
        b.values
            .len()
            .cmp(&a.values.len())
            .then_with(|| b.rows.len().cmp(&a.rows.len()))
            .then_with(|| a.best().cmp(b.best()))
    });

    let mut writer = Config::new(&args.flag_output).io_writer()?;

    for cluster in clusters {
        cluster.write_toml(&mut writer)?;
    }

    Ok(())
}

#[derive(Debug)]
struct Cluster {
    id: usize,
    key: String,
    rows: Vec<usize>,
    values: Vec<(String, usize)>,
}

impl Cluster {
    fn write_toml<W: Write>(&self, mut writer: W) -> io::Result<()> {
        writeln!(&mut writer, "[[cluster]]")?;
        writeln!(&mut writer, "id = {}", self.id)?;
        writeln!(&mut writer, "key = \"{}\"", self.key)?;
        writeln!(&mut writer, "nb_values = {}", self.values.len())?;
        writeln!(&mut writer, "nb_rows = {}", self.rows.len())?;
        writeln!(
            &mut writer,
            "rows = \"{}\"",
            self.rows
                .iter()
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join(",")
        )?;
        writeln!(&mut writer, "replace_with = {:?}", self.best())?;
        writeln!(&mut writer, "values = [")?;

        for (value, count) in self.values.iter() {
            writeln!(&mut writer, "  {{ value = {value:?}, count = {count} }},")?;
        }

        writeln!(&mut writer, "]")?;
        writeln!(&mut writer, "harmonize = false")?;
        writeln!(&mut writer)?;

        Ok(())
    }
}

impl Serialize for Cluster {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Cluster", 8)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("key", &self.key)?;
        state.serialize_field("nb_values", &self.values.len())?;
        state.serialize_field("nb_rows", &self.rows.len())?;
        state.serialize_field(
            "rows",
            &self
                .rows
                .iter()
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join(","),
        )?;
        state.serialize_field("replace_with", self.best())?;
        state.serialize_field("values", &self.values)?;
        state.serialize_field("harmonize", &false)?;
        state.end()
    }
}

impl Cluster {
    fn from_entries(id: usize, key: String, entries: Vec<(usize, String)>) -> Self {
        let mut rows = Vec::new();
        let mut values = HashMap::new();

        for (row_index, row_value) in entries {
            rows.push(row_index);
            values
                .entry(row_value)
                .and_modify(|count| *count += 1)
                .or_insert(1);
        }

        let mut values = values.into_iter().collect::<Vec<_>>();
        values.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));

        Cluster {
            id,
            key,
            rows,
            values,
        }
    }

    fn best(&self) -> &String {
        &self.values[0].0
    }
}

trait ClusteringAlgorithm {
    fn process(&mut self, index: usize, key: String, value: String);
    fn into_clusters(self: Box<Self>) -> Vec<Cluster>;
}

#[derive(Default)]
struct KeyCollision {
    collisions: HashMap<String, Vec<(usize, String)>>,
}

impl ClusteringAlgorithm for KeyCollision {
    fn process(&mut self, index: usize, key: String, value: String) {
        match self.collisions.entry(key) {
            Entry::Occupied(mut entry) => {
                entry.get_mut().push((index, value));
            }
            Entry::Vacant(entry) => {
                entry.insert(vec![(index, value)]);
            }
        };
    }

    fn into_clusters(self: Box<Self>) -> Vec<Cluster> {
        self.collisions
            .into_iter()
            .enumerate()
            .map(|(id, (key, entries))| Cluster::from_entries(id, key, entries))
            .filter(|cluster| cluster.values.len() > 1)
            .collect()
    }
}

```

### Core Architecture Module: `src/cmd/compgen.rs`
```
use std::env;
use std::fs::File;
use std::path::PathBuf;

use glob::glob;

static COMMANDS: [&str; 60] = [
    "agg",
    "behead",
    "bins",
    "blank",
    "cat",
    "cluster",
    "count",
    "dedup",
    "enum",
    "eval",
    "explode",
    "foreach",
    "fill",
    "filter",
    "fixlengths",
    "flatten",
    "fmt",
    "frequency",
    "from",
    "groupby",
    "guillotine",
    "headers",
    "help",
    "heatmap",
    "hist",
    "implode",
    "index",
    "input",
    "join",
    "map",
    "matrix",
    "merge",
    "network",
    "parallel",
    "partition",
    "pivot",
    "plot",
    "progress",
    "range",
    "rename",
    "reverse",
    "sample",
    "scrape",
    "search",
    "select",
    "shuffle",
    "slice",
    "sort",
    "spark",
    "split",
    "stats",
    "run",
    "tokenize",
    "top",
    "transform",
    "transpose",
    "unpivot",
    "view",
    "vocab",
    "window",
];

static HELP_SUBCOMMANDS: [&str; 5] = ["cheatsheet", "functions", "aggs", "scraping", "window"];
static CAT_SUBCOMMANDS: [&str; 2] = ["rows", "columns"];
static MATRIX_SUBCOMMANDS: [&str; 4] = ["adj", "count", "corr", "bivar"];
static NETWORK_SUBCOMMANDS: [&str; 2] = ["edgelist", "bipartite"];
static PARALLEL_SUBCOMMANDS: [&str; 7] = ["count", "cat", "freq", "stats", "agg", "groupby", "map"];
static SCRAPE_SUBCOMMANDS: [&str; 5] = ["title", "canonical", "links", "urls", "images"];
static TOKENIZE_SUBCOMMANDS: [&str; 3] = ["words", "sentences", "paragraphs"];
static VOCAB_SUBCOMMANDS: [&str; 5] = ["corpus", "doc", "doc-token", "token", "cooc"];

fn find_csv_files_in_prompt() -> Vec<String> {
    let words = shlex::split(&env::var("COMP_LINE").unwrap_or("".to_string())).unwrap_or_default();

    words
        .into_iter()
        .filter(|p| {
            p.ends_with(".csv")
                || p.ends_with(".tsv")
                || p.ends_with(".csv.gz")
                || p.ends_with(".tsv.gz")
        })
        .take(15)
        .collect()
}

fn most_likely_csv_files_by_glob() -> impl Iterator<Item = PathBuf> {
    glob("*.csv")
        .unwrap()
        .chain(glob("*.csv.gz").unwrap())
        .chain(glob("*.tsv").unwrap())
        .chain(glob("*.tsv.gz").unwrap())
        .chain(glob("*/*.csv").unwrap())
        .chain(glob("*/*.csv.gz").unwrap())
        .chain(glob("*/*.tsv").unwrap())
        .chain(glob("*/*.tsv.gz").unwrap())
        .take(15)
        .map(|p| p.unwrap())
}

fn find_csv_files_to_test() -> Vec<PathBuf> {
    let in_prompt = find_csv_files_in_prompt();

    if !in_prompt.is_empty() {
        return in_prompt.into_iter().map(PathBuf::from).collect();
    }

    most_likely_csv_files_by_glob().collect()
}

pub fn run() {
    let args = env::args().collect::<Vec<_>>();

    let mut to_complete = args[3].as_str();
    let word_before = &args[4];

    if to_complete == "--" {
        to_complete = "";
    }

    // Completing commands
    if word_before == "xan" {
        if !to_complete.starts_with('-') {
            for command in COMMANDS {
                if command.starts_with(to_complete) {
                    println!("{command}");
                }
            }
        }
    } else if word_before == "help" && !to_complete.starts_with('-') {
        for subcommand in HELP_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "cat" && !to_complete.starts_with('-') {
        for subcommand in CAT_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "matrix" && !to_complete.starts_with('-') {
        for subcommand in MATRIX_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "network" && !to_complete.starts_with('-') {
        for subcommand in NETWORK_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "parallel" && !to_complete.starts_with('-') {
        for subcommand in PARALLEL_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "vocab" && !to_complete.starts_with('-') {
        for subcommand in VOCAB_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "scrape" && !to_complete.starts_with('-') {
        for subcommand in SCRAPE_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    } else if word_before == "tokenize" && !to_complete.starts_with('-') {
        for subcommand in TOKENIZE_SUBCOMMANDS {
            if subcommand.starts_with(to_complete) {
                println!("{subcommand}");
            }
        }
    }
    // Completing column selectors
    else if word_before == "-s"
        || word_before == "--select"
        || word_before == "-g"
        || word_before == "--groupby"
        || word_before == "select"
        || word_before == "scrape"
        || word_before == "transform"
        || word_before == "explode"
        || word_before == "implode"
        || word_before == "groupby"
        || word_before == "partition"
        || word_before == "plot"
        || word_before == "top"
    {
        let mut all_headers = Vec::<String>::new();

        let to_complete_item = to_complete
            .trim_matches(['\'', '"'])
            .split([',', ':'])
            .next_back()
            .unwrap();

        for path in find_csv_files_to_test() {
            let file = match File::open(path) {
                Ok(f) => f,
                _ => continue,
            };
            let mut reader = csv::Reader::from_reader(file);

            if let Ok(headers) = reader.headers() {
                for name in headers {
                    if name.starts_with(to_complete_item) && !all_headers.iter().any(|h| h == name)
                    {
                        all_headers.push(name.to_string());
                    }
                }
            }
        }

        for name in all_headers {
            println!(
                "{}",
                to_complete
                    .strip_suffix(&name[..to_complete_item.len()])
                    .unwrap()
                    .to_string()
                    + &name
            );
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1164** (2026-09-11): **xan rename mixes tabs and commas in tsv input**
  *Symptoms*: It seems to me `xan rename` has awkward behavior with tab-separated input. The output has header converted to comma separated but the records stay tab:   ``` echo -e "col1\tcol2\tcol3\n1\t2\t3" \ | xan rename -d '\t' -s 'col2' 'COL2' col1,COL2,col3 1	2	3 ```  I would expect either the header to use the same separator as the input (best) or convert everything to comma separated. This is with xan 0.60.0.
  **Post-Mortem & Fix Analysis**:
  > I think this has already been fixed in master. v0.61.0 has not been released yet but will be in a near future. For now you should be able to install the fix thusly:  ```bash cargo install --git https://github.com/medialab/xan --locked ```
  > EDIT: for now the `rename` command is a bit special (like behead), because it does not normalize the output for performance reason. But I see this is confusing people, so I might change this and hide the performance route behind a flag.
  > v0.61.0 has been published

- **Issue #1163** (2026-09-11): **cat rows --source-column ignored if -I used**
  *Symptoms*: The first `xan cat`  below works as expected but the second ignore the `--source-column`  ``` > xan range -c a 3 > a.csv > xan range -c a 2 > b.csv  > xan cat rows --source-column file a.csv b.csv file,a a.csv,0 a.csv,1 a.csv,2 b.csv,0 b.csv,1  > xan cat rows --source-column file -I a.csv b.csv a 0 1 2 0 1 ```
  **Post-Mortem & Fix Analysis**:
  > Good catch @ggrothendieck. Fixed as per last commit.

- **Issue #1161** (2026-09-08): **Slicing [5:] seems incorrect**
  *Symptoms*: 

- **Issue #1160** (2026-09-08): **xan p map does not allow -R**
  *Symptoms*: 

- **Issue #1159** (2026-09-08): **xan p map does not accept flags before template**
  *Symptoms*: 

- **Issue #1132** (2026-07-04): **xan select multi-clause has issue when inner value is a list**
  *Symptoms*: The SelectionProgram should not be using `flat_iter`.

- **Issue #1125** (2026-07-01): **xan flatten fails when column names are absurdly long**
  *Symptoms*: 

- **Issue #1115** (2026-06-15): **xan spark does not discretize properly with column-wise -c**
  *Symptoms*: ```bash xan spark x,y -c cluster docs/cookbook/resources/clusters.csv.gz --hide-legend && xan shuffle docs/cookbook/resources/clusters.csv.gz | xan spark x,y -c cluster --hide-legend ```

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

### Incident Patch 1: `df202453` (2026-09-11)
**Commit Message**: Fixing xan cat rows (-I|-U) -S/--source-column
Fix #1163

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 * Fixing open-ended moonblade slicing.
 * Fixing `xan parallel (cat|map)` not working with `-R/--run`.
 * Fixing `xan parallel -R/--run` not spawning checker thread.
+* Fixing `xan cat rows (-I|-U) -S/--source-column`.
 
 *Performance*
 
```

**File**: `src/cmd/cat.rs` (modified, +29/-10)
```diff
@@ -327,18 +327,23 @@ impl Args {
         let mut readers = self
             .paths()?
             .map(
-                |p| -> CliResult<simd_csv::Reader<Box<dyn io::Read + Send>>> {
-                    Config::new(&Some(p?))
-                        .delimiter(self.flag_delimiter)
-                        .no_headers(self.flag_no_headers)
-                        .simd_reader()
+                |r| -> CliResult<(String, simd_csv::Reader<Box<dyn io::Read + Send>>)> {
+                    let path = r?;
+
+                    Ok((
+                        path.clone(),
+                        Config::new(&Some(path))
+                            .delimiter(self.flag_delimiter)
+                            .no_headers(self.flag_no_headers)
+                            .simd_reader()?,
+                    ))
                 },
             )
             .collect::<Result<Vec<_>, _>>()?;
 
         let all_headers = readers
             .iter_mut()
-            .map(|reader| reader.byte_headers().cloned())
+            .map(|(_, reader)| reader.byte_headers().cloned())
             .collect::<Result<Vec<_>, _>>()?;
 
         let mut headers_index = new_index_set::<Vec<u8>>();
@@ -373,14 +378,28 @@ impl Args {
             })
             .collect::<Vec<_>>();
 
-        wtr.write_record(headers_index.iter())?;
+        if let Some(source_column_name) = &self.flag_source_column {
+            wtr.write_record(
+                [source_column_name.as_bytes()]
+                    .into_iter()
+                    .chain(headers_index.iter().map(|name| name.as_slice())),
+            )?;
+        } else {
+            wtr.write_record(headers_index.iter())?;
+        }
 
-        for (mask, reader) in masks.into_iter().zip(readers.iter_mut()) {
+        for (mask, (path, reader)) in masks.into_iter().zip(readers.iter_mut()) {
             while reader.read_byte_record(&mut record)? {
-                wtr.write_record(mask.iter().map(|i_opt| match i_opt {
+                let cells = mask.iter().map(|i_opt| match i_opt {
                     None => b"",
                     Some(i) => &record[*i],
-                }))?;
+                });
+
+                if self.flag_source_column.is_some() {
+                    wtr.write_record([path.as_bytes()].into_iter().chain(cells))?;
+                } else {
+                    wtr.write_record(cells)?;
+                }
             }
         }
 
```

---

### Incident Patch 2: `9af06d08` (2026-09-08)
**Commit Message**: Fixing xan p (cat|map) -R/--run
Fix #1160

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@
 * Fixing `xan rename` with non-comma delimiters.
 * Fixing `xan from -f=parquet` not converting timestamp columns.
 * Fixing open-ended moonblade slicing.
+* Fixing `xan parallel (cat|map)` not working with `-R/--run`.
+* Fixing `xan parallel -R/--run` not spawning checker thread.
 
 *Performance*
 
```

**File**: `src/cmd/parallel.rs` (modified, +5/-3)
```diff
@@ -744,7 +744,9 @@ impl Args {
     }
 
     fn has_preprocessing(&self) -> bool {
-        self.flag_preprocess.is_some() || self.flag_shell_preprocess.is_some()
+        self.flag_preprocess.is_some()
+            || self.flag_shell_preprocess.is_some()
+            || self.flag_run.is_some()
     }
 
     pub fn single_file(path: &Option<String>, threads: Option<NonZeroUsize>) -> CliResult<Self> {
@@ -1175,7 +1177,7 @@ impl Args {
     fn cat(self, inputs: Vec<Input>) -> CliResult<()> {
         if !self.has_preprocessing() {
             Err(
-                "`xan parallel cat` without -P/--preprocess or -H/--shell-preprocess is counterproductive!\n`xan cat rows` will be faster.",
+                "`xan parallel cat` without -P/--preprocess, -H/--shell-preprocess or -R/--run is counterproductive!\n`xan cat rows` will be faster.",
             )?
         }
 
@@ -1606,7 +1608,7 @@ impl Args {
     fn map(self, inputs: Vec<Input>) -> CliResult<()> {
         if !self.has_preprocessing() {
             Err(
-                "`xan parallel map` without -P/--preprocess or -H/--shell-preprocess is pointless ;).",
+                "`xan parallel map` without -P/--preprocess, -H/--shell-preprocess or -R/--run is pointless ;).",
             )?;
         }
 
```

---

### Incident Patch 3: `31bb2068` (2026-09-08)
**Commit Message**: Fixing moonblade slicing
Fix #1161

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
 
 * Fixing `xan rename` with non-comma delimiters.
 * Fixing `xan from -f=parquet` not converting timestamp columns.
+* Fixing open-ended moonblade slicing.
 
 *Performance*
 
```

**File**: `src/moonblade/functions/sequences.rs` (modified, +27/-86)
```diff
@@ -1,4 +1,4 @@
-use std::cmp::{Ordering, max};
+use std::cmp::Ordering;
 use std::sync::Arc;
 
 use crate::moonblade::error::EvaluationError;
@@ -132,104 +132,45 @@ pub fn last(mut args: BoundArguments) -> FunctionResult {
 
 pub fn slice(args: BoundArguments) -> FunctionResult {
     let target = args.get(0).unwrap();
+    let start = args.get(1).unwrap().try_as_i64()?;
+    let end = args.get(2).map(|v| v.try_as_i64()).transpose()?;
 
-    if let Some(list) = target.as_list() {
-        let mut lo = args.get(1).unwrap().try_as_i64()?;
-        let opt_hi = args.get(2);
-
-        let sublist: Vec<DynamicValue> = match opt_hi {
-            None => {
-                if lo < 0 {
-                    let l = list.len();
-                    lo = max(0, l as i64 + lo);
-
-                    list[..lo as usize].to_vec()
-                } else if lo >= list.len() as i64 {
-                    Vec::new()
-                } else {
-                    list[..lo as usize].to_vec()
-                }
-            }
-            Some(hi_value) => {
-                let mut hi = hi_value.try_as_i64()?;
-
-                if lo >= list.len() as i64 {
-                    Vec::new()
-                } else if lo < 0 {
-                    let l = list.len();
+    fn normalize_index(index: i64, len: usize) -> usize {
+        let len = len as i64;
 
-                    lo = max(0, l as i64 + lo);
+        if index < 0 {
+            (len + index).max(0) as usize
+        } else {
+            index.min(len) as usize
+        }
+    }
 
-                    if hi < 0 {
-                        hi = max(0, l as i64 + hi);
-                    }
+    if let Some(list) = target.as_list() {
+        let len = list.len();
 
-                    if hi <= lo {
-                        Vec::new()
-                    } else {
-                        list[lo as usize..hi.min(list.len() as i64) as usize].to_vec()
-                    }
-                } else {
-                    if hi < 0 {
-                        let l = list.len();
-                        hi = max(0, l as i64 + hi);
-                    }
+        let start = normalize_index(start, len);
+        let end = end.map(|index| normalize_index(index, len)).unwrap_or(len);
 
-                    if hi <= lo {
-                        Vec::new()
-                    } else {
-                        list[lo as usize..hi.min(list.len() as i64) as usize].to_vec()
-                    }
-                }
-            }
+        let sublist = if end <= start {
+            Vec::new()
+        } else {
+            list[start..end].to_vec()
         };
 
         return Ok(DynamicValue::from(sublist));
     }
 
     let string = target.try_as_str()?;
+    let chars: Vec<char> = string.chars().collect();
+    let len = chars.len();
 
-    let mut lo = args.get(1).unwrap().try_as_i64()?;
-    let opt_hi = args.get(2);
-
-    let chars = string.chars();
-
-    let substring: String = match opt_hi {
-        None => {
-            if lo < 0 {
-                let l = string.chars().count();
-                lo = max(0, l as i64 + lo);
-
-                chars.skip(lo as usize).collect()
-            } else {
-                chars.skip(lo as usize).collect()
-            }
-        }
-        Some(hi_value) => {
-            let mut hi = hi_value.try_as_i64()?;
+    let start = normalize_index(start, len);
+    let end = end.map(|index| normalize_index(index, len)).unwrap_or(len);
 
-            if lo < 0 {
-                let l = string.chars().count();
-                lo = max(0, l as i64 + lo);
-
-                if hi < 0 {
-                    hi = max(0, l as i64 + hi);
-                }
-
-                if hi <= lo {
-                    "".to_string()
-                } else {
-                    chars.skip(lo as usize).take((hi - lo) as usize).collect()
-                }
-            } else {
-                if hi < 0 {
-                    let l = string.chars().count(
```

**File**: `src/moonblade/interpreter.rs` (modified, +10/-0)
```diff
@@ -1087,6 +1087,16 @@ mod tests {
             eval_code("slice('abcde', 10, -20)"),
             Ok(DynamicValue::from(""))
         );
+        assert_eq!(
+            eval_code("range(10)[5:]"),
+            Ok(DynamicValue::from(vec![
+                DynamicValue::Integer(5),
+                DynamicValue::Integer(6),
+                DynamicValue::Integer(7),
+                DynamicValue::Integer(8),
+                DynamicValue::Integer(9)
+            ]))
+        )
     }
 
     #[test]
```

**File**: `src/moonblade/types/bound_arguments.rs` (modified, +1/-0)
```diff
@@ -377,6 +377,7 @@ impl BoundArgument<'_> {
 
 pub const BOUND_ARGUMENTS_CAPACITY: usize = 8;
 
+#[derive(Debug)]
 pub struct BoundArguments<'a> {
     stack: ArrayVec<BoundArgument<'a>, BOUND_ARGUMENTS_CAPACITY>,
 }
```

---

### Incident Patch 4: `f59b8feb` (2026-09-04)
**Commit Message**: Fixing condition selecting full sort or heap in Counter
Should improve performance of freq commands

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -12,6 +12,10 @@
 * Fixing `xan rename` with non-comma delimiters.
 * Fixing `xan from -f=parquet` not converting timestamp columns.
 
+*Performance*
+
+* Improving performance of `xan freq` & `xan p freq`.
+
 *Quality of Life*
 
 * Better moonblade error messages when values are not yet materialized.
```

**File**: `src/collections/counter.rs` (modified, +3/-1)
```diff
@@ -56,13 +56,15 @@ impl<K: Eq + Hash + Send + Ord> ExactCounter<K> {
     }
 
     pub fn into_total_and_top(self, k: usize, parallel: bool) -> (u64, Vec<(K, u64)>) {
-        if k < (self.map.len() as f64 / 2.0).floor() as usize {
+        // If k represents more than half of the values, we sort
+        if k > (self.map.len() as f64 / 2.0).floor() as usize {
             let (total, mut items) = self.into_total_and_sorted_vec(parallel);
             items.truncate(k);
 
             return (total, items);
         }
 
+        // Else, we use a heap
         let mut heap: TopKHeap<(u64, Reverse<K>)> = TopKHeap::with_capacity(k);
         let mut total: u64 = 0;
 
```

---

### Incident Patch 5: `c30377ce` (2026-07-28)
**Commit Message**: Better BoundArgument Debug implementation
Fix #1141

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -6,6 +6,10 @@
 
 * Fixing `xan rename` with non-comma delimiters.
 
+*Quality of Life*
+
+* Better moonblade error messages when values are not yet materialized.
+
 ## 0.60.0
 
 *Breaking*
```

**File**: `src/moonblade/types/bound_arguments.rs` (modified, +11/-1)
```diff
@@ -1,4 +1,5 @@
 use std::borrow::Cow;
+use std::fmt;
 
 use arrayvec::ArrayVec;
 use url::Url;
@@ -22,13 +23,22 @@ pub enum BoundStringLike<'a> {
     Bytes(&'a [u8]),
 }
 
-#[derive(Debug)]
 pub enum BoundArgument<'a> {
     Owned(DynamicValue),
     Borrowed(&'a DynamicValue),
     Cell(&'a [u8]),
 }
 
+impl fmt::Debug for BoundArgument<'_> {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        match self {
+            Self::Owned(v) => v.fmt(f),
+            Self::Borrowed(v) => v.fmt(f),
+            Self::Cell(c) => bstr::BStr::new(c).fmt(f),
+        }
+    }
+}
+
 impl BoundArgument<'_> {
     #[inline]
     pub fn type_of(&self) -> &str {
```

---

### Incident Patch 6: `4126334c` (2026-07-21)
**Commit Message**: Fixing xan rename with non-comma delimiters
Related to #1110

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Changelog
 
+## 0.60.1 (provisional)
+
+*Fixes*
+
+* Fixing `xan rename` with non-comma delimiters.
+
 ## 0.60.0
 
 *Breaking*
```

**File**: `src/cmd/rename.rs` (modified, +1/-0)
```diff
@@ -119,6 +119,7 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
     let mut peeker = rconfig.simd_peeker()?;
     let mut wtr_builder = wconfig.simd_csv_writer_builder();
     wtr_builder.crlf_newlines(peeker.has_crlf_newlines()?);
+    wtr_builder.delimiter(rconfig.delimiter);
     let mut wtr = wtr_builder.from_writer(wconfig.io_writer()?);
 
     if args.flag_no_headers {
```

---

### Incident Patch 7: `7b6c2f08` (2026-07-07)
**Commit Message**: Fixing xan from -f=parquet column names for lists & maps

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 
 * Fixing text wrapping across tool, especially `xan flatten -w` & `xan flatten -F`.
 * Fixing `xan select -e` & `xan map` plural clause flattening given list.
+* Fixing `xan from -f=parquet` not emitting correct column names for list & map columns.
 
 *Performance*
 
```

**File**: `src/cmd/from.rs` (modified, +3/-1)
```diff
@@ -665,7 +665,9 @@ impl Args {
         let schema = reader.metadata().file_metadata().schema_descr();
 
         for column in schema.columns() {
-            output_record.push_field(column.name().as_bytes());
+            let path = column.path();
+            let logical_name = &path.parts()[0];
+            output_record.push_field(logical_name.as_bytes());
         }
 
         wtr.write_byte_record(&output_record)?;
```

---

### Incident Patch 8: `ea312b21` (2026-07-04)
**Commit Message**: Fixing moonblade plural clause flattening
Fix #1132

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
 *Fixes*
 
 * Fixing text wrapping across tool, especially `xan flatten -w` & `xan flatten -F`.
+* Fixing `xan select -e` & `xan map` plural clause flattening given list.
 
 *Performance*
 
```

**File**: `src/moonblade/select.rs` (modified, +20/-6)
```diff
@@ -125,9 +125,16 @@ impl SelectionProgram {
                 ExprName::Plural(names) => {
                     let mut count: usize = 0;
 
-                    for sub_value in value.flat_iter() {
-                        sub_value.push_field_to_record(output_record);
-                        count += 1;
+                    if let DynamicValue::List(items) = value {
+                        for sub_value in items.iter() {
+                            sub_value.push_field_to_record(output_record);
+                            count += 1;
+                        }
+                    } else {
+                        return Err(EvaluationError::Custom(
+                            "plural clause expects returned value to be a list".to_string(),
+                        )
+                        .anonymous());
                     }
 
                     if names.len() != count {
@@ -161,9 +168,16 @@ impl SelectionProgram {
                 ExprName::Plural(names) => {
                     let mut count: usize = 0;
 
-                    for sub_value in value.flat_iter() {
-                        sub_value.push_field_to_record(record);
-                        count += 1;
+                    if let DynamicValue::List(items) = value {
+                        for sub_value in items.iter() {
+                            sub_value.push_field_to_record(record);
+                            count += 1;
+                        }
+                    } else {
+                        return Err(EvaluationError::Custom(
+                            "plural clause expects returned value to be a list".to_string(),
+                        )
+                        .anonymous());
                     }
 
                     if names.len() != count {
```

**File**: `tests/test_map.rs` (modified, +24/-0)
```diff
@@ -158,6 +158,30 @@ fn map_plural_clause() {
     assert_eq!(got, expected);
 }
 
+#[test]
+fn map_plural_clause_no_flat_iter() {
+    let wrk = Workdir::new("map_plural_clause_no_flat_iter");
+    wrk.create(
+        "data.csv",
+        vec![
+            svec!["full_name"],
+            svec!["john landis"],
+            svec!["béatrice babka"],
+        ],
+    );
+    let mut cmd = wrk.command("map");
+
+    cmd.arg("[[1, 2], 3] as (one_two, three)").arg("data.csv");
+
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        ["full_name", "one_two", "three"],
+        ["john landis", "[1,2]", "3"],
+        ["béatrice babka", "[1,2]", "3"],
+    ];
+    assert_eq!(got, expected);
+}
+
 #[test]
 fn map_along_columns() {
     let wrk = Workdir::new("map_along_columns");
```

---

### Incident Patch 9: `c250efa6` (2026-07-02)
**Commit Message**: Fixing error messages in xan from

**File**: `src/cmd/from.rs` (modified, +6/-6)
```diff
@@ -303,7 +303,7 @@ impl Args {
     fn convert_ndjson(&self) -> CliResult<()> {
         use simd_json::Buffers;
 
-        let path_opt = self.root()?;
+        let root_opt = self.root()?;
 
         let mut buffers = Buffers::default();
 
@@ -329,10 +329,10 @@ impl Args {
                 let mut value: Value =
                     simd_json::serde::from_slice_with_buffers(line_mut, &mut buffers)?;
 
-                if let Some(path) = &path_opt {
+                if let Some(path) = &root_opt {
                     value = value
                         .get_path_owned(path)
-                        .ok_or("could not extract value given to --path!")?;
+                        .ok_or("could not extract at --root!")?;
                 }
 
                 tabularizer.process(value)?;
@@ -351,10 +351,10 @@ impl Args {
 
             let mut nested = value;
 
-            if let Some(path) = &path_opt {
+            if let Some(path) = &root_opt {
                 nested = nested
                     .get_path_owned(path)
-                    .ok_or("could not extract value given to --path!")?;
+                    .ok_or("could not extract at --root!")?;
             }
 
             tabularizer.process_tape_no_sampling(nested)?;
@@ -382,7 +382,7 @@ impl Args {
         if let Some(path) = self.root()? {
             value = value
                 .get_path_owned(&path)
-                .ok_or("could not extract value given to --path!")?;
+                .ok_or("could not extract at --root!")?;
         }
 
         // NOTE: recombobulating objects as collections
```

---

### Incident Patch 10: `c1d5ef4a` (2026-07-01)
**Commit Message**: Fixing xan flatten with absurdly long header names
Also fixing wrapping across tool
Fix #1125

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -6,6 +6,10 @@
 
 * Adding `xan count -c/--check-alignment`.
 
+*Fixes*
+
+* Fixing text wrapping across tool, especially `xan flatten -w` & `xan flatten -F`.
+
 *Quality of Life*
 
 * Better record size estimation for `xan sort -e`.
```

**File**: `src/cmd/flatten.rs` (modified, +13/-12)
```diff
@@ -206,11 +206,8 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
         .iter()
         .map(|h| h.width())
         .max()
-        .ok_or("file is empty")?;
-
-    if cols < max_header_width + 2 {
-        Err("not enough cols provided to safely print data!")?;
-    }
+        .ok_or("file is empty")?
+        .min(cols / 2);
 
     let mut record = StringRecord::new();
 
@@ -270,13 +267,17 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
     let display_headers = headers
         .iter()
         .map(|header| {
-            util::unicode_aware_highlighted_pad_with_ellipsis(
-                false,
-                header,
-                max_header_width + 1,
-                " ",
-                true,
-            )
+            if args.flag_flatter {
+                util::highlight_problematic_string_features(header)
+            } else {
+                util::unicode_aware_highlighted_pad_with_ellipsis(
+                    false,
+                    header,
+                    max_header_width + 1,
+                    " ",
+                    true,
+                )
+            }
         })
         .collect::<Vec<_>>();
 
```

**File**: `src/util.rs` (modified, +21/-4)
```diff
@@ -690,7 +690,7 @@ pub fn unicode_aware_highlighted_pad_with_ellipsis(
         &(if highlight {
             highlight_problematic_string_features(&with_ellipsis)
         } else {
-            unicode_aware_ellipsis(string, width)
+            with_ellipsis
         }),
         width,
         padding,
@@ -716,10 +716,27 @@ pub fn unicode_aware_lpad_with_ellipsis(string: &str, width: usize, padding: &st
 }
 
 pub fn wrap(string: &str, max_width: usize, indent: usize) -> String {
-    let indent = " ".repeat(indent);
-    let options = textwrap::Options::new(max_width).subsequent_indent(&indent);
+    let options = textwrap::Options::new(max_width);
 
-    textwrap::fill(string, &options)
+    let wrapped = textwrap::fill(string, &options);
+
+    // NOTE: it seems `textwrap` subsequent_indent is not properly implemented
+    let mut lines = String::with_capacity(wrapped.len());
+
+    for (i, line) in wrapped.lines().enumerate() {
+        if i > 0 {
+            for _ in 0..indent {
+                lines.push(' ');
+            }
+        }
+
+        lines.push_str(line);
+        lines.push('\n');
+    }
+
+    lines.pop();
+
+    lines
 }
 
 pub struct EmojiSanitizer {
```

#### Recent Merged Pull Requests:
- **PR #1172** (2026-09-23): Embossed 'xan matrix' command with bivariate distribution matrix (e. g. discretized scatterplot) (@clothilde-ml)
- **PR #1149** (2026-09-04): Add geomean and harmean aggregations (@ChrisJr404)
- **PR #1088** (2026-06-11): Fix spark -P to compute percentages over sum, not domain (@mvanhorn)
- **PR #1059** (2026-05-22): fix(moonblade): replace top/argtop/most_common panic with arity error (@SAY-5)
- **PR #1058** (2026-05-22): fix(headers): keep trailing space when column index hits 4+ digits (@SAY-5)
- **PR #1011** (2026-04-30): Add native zsh completions (@apcamargo)
- **PR #978** (2026-04-17): Adding grep --patterns and --add-pattern (@bmaz)
- **PR #959** (closed): xan: baseline command (@okuvshynov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
