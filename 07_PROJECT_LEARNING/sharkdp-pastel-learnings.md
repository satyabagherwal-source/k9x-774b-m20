# Forensic Learning Record (Deep Inspection): sharkdp/pastel

> **Canonical Artifact**: `07_PROJECT_LEARNING/sharkdp-pastel-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sharkdp/pastel](https://github.com/sharkdp/pastel))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:56.745Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sharkdp/pastel`
- **Description**: A command-line tool to generate, analyze, convert and manipulate colors
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6512 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/parse_color.rs`
```
use criterion::{criterion_group, criterion_main, Criterion};
use pastel::parser::parse_color;

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("parse_hex", |b| {
        b.iter(|| {
            parse_color("#ff0077");
        })
    });
    c.bench_function("parse_hex_short", |b| {
        b.iter(|| {
            parse_color("#f07");
        })
    });
    c.bench_function("parse_rgb", |b| {
        b.iter(|| {
            parse_color("rgb(255, 125, 0)");
        })
    });
    c.bench_function("parse_hsl", |b| b.iter(|| parse_color("hsl(280,20%,50%)")));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `src/ansi.rs`
```
use std::borrow::Borrow;
use std::io::IsTerminal;

use once_cell::sync::Lazy;

use crate::delta_e::ciede2000;
use crate::{Color, Lab};

static ANSI_LAB_REPRESENTATIONS: Lazy<Vec<(u8, Lab)>> = Lazy::new(|| {
    (16..=255)
        .map(|code| (code, Color::from_ansi_8bit(code).to_lab()))
        .collect()
});

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Mode {
    Ansi8Bit,
    TrueColor,
}

#[derive(Debug)]
pub struct UnknownColorModeError(pub String);

impl Mode {
    pub fn from_mode_str(mode_str: &str) -> Result<Option<Self>, UnknownColorModeError> {
        match mode_str {
            "24bit" | "truecolor" => Ok(Some(Mode::TrueColor)),
            "8bit" => Ok(Some(Mode::Ansi8Bit)),
            "off" => Ok(None),
            value => Err(UnknownColorModeError(value.into())),
        }
    }
}

fn cube_to_8bit(code: u8) -> u8 {
    assert!(code < 6);
    match code {
        0 => 0,
        _ => 55 + 40 * code,
    }
}

pub trait AnsiColor {
    fn from_ansi_8bit(code: u8) -> Self;
    fn to_ansi_8bit(&self) -> u8;

    fn to_ansi_sequence(&self, mode: Mode) -> String;
}

impl AnsiColor for Color {
    /// Create a color from an 8-bit ANSI escape code
    ///
    /// See: <https://en.wikipedia.org/wiki/ANSI_escape_code>
    fn from_ansi_8bit(code: u8) -> Color {
        match code {
            0 => Color::black(),
            1 => Color::maroon(),
            2 => Color::green(),
            3 => Color::olive(),
            4 => Color::navy(),
            5 => Color::purple(),
            6 => Color::teal(),
            7 => Color::silver(),
            8 => Color::gray(),
            9 => Color::red(),
            10 => Color::lime(),
            11 => Color::yellow(),
            12 => Color::blue(),
            13 => Color::fuchsia(),
            14 => Color::aqua(),
            15 => Color::white(),
            16..=231 => {
                // 6 x 6 x 6 cube of 216 colors. We need to decode from
                //
                //    code = 16 + 36 × r + 6 × g + b

                let code_rgb = code - 16;
                let blue = code_rgb % 6;

                let code_rg = (code_rgb - blue) / 6;
                let green = code_rg % 6;

                let red = (code_rg - green) / 6;

                Color::from_rgb(cube_to_8bit(red), cube_to_8bit(green), cube_to_8bit(blue))
            }
            232..=255 => {
                // grayscale from (almost) black to (almost) white in 24 steps

                let gray_value = 10 * (code - 232) + 8;
                Color::from_rgb(gray_value, gray_value, gray_value)
            }
        }
    }

    /// Approximate a color by its closest 8-bit ANSI color (as measured by the perceived
    /// color distance).
    ///
    /// See: <https://en.wikipedia.org/wiki/ANSI_escape_code>
    fn to_ansi_8bit(&self) -> u8 {
        let self_lab = self.to_lab();
        ANSI_LAB_REPRESENTATIONS
            .iter()
            .min_by_key(|(_, lab)| ciede2000(&self_lab, lab) as i32)
            .expect("list of codes can not be empty")
            .0
    }

    /// Return an ANSI escape sequence in 8-bit or 24-bit representation:
    /// * 8-bit: `ESC[38;5;CODEm`, where CODE represents the color.
    /// * 24-bit: `ESC[38;2;R;G;Bm`, where R, G, B represent 8-bit RGB values
    fn to_ansi_sequence(&self, mode: Mode) -> String {
        match mode {
            Mode::Ansi8Bit => format!("\x1b[38;5;{}m", self.to_ansi_8bit()),
            Mode::TrueColor => {
                let rgba = self.to_rgba();
                format!("\x1b[38;2;{r};{g};{b}m", r = rgba.r, g = rgba.g, b = rgba.b)
            }
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Style {
    foreground: Option<Color>,
    background: Option<Color>,
    bold: bool,
    italic: bool,
    underline: bool,
}

impl Style {
    pub fn foreground(&mut self, color: &Color) -> &mut Self {
        self.foreground = Some(color.clone());
        self
    }

    pub fn on<C: Borrow<Color>>(&mut self, color: C) -> &mut Self {
        self.background = Some(color.borrow().clone());
        self
    }

    pub fn bold(&mut self, on: bool) -> &mut Self {
        self.bold = on;
        self
    }

    pub fn italic(&mut self, on: bool) -> &mut Self {
        self.italic = on;
        self
    }

    pub fn underline(&mut self, on: bool) -> &mut Self {
        self.underline = on;
        self
    }

    pub fn escape_sequence(&self, mode: Mode) -> String {
        let mut codes: Vec<u8> = vec![];

        if let Some(ref fg) = self.foreground {
            match mode {
                Mode::Ansi8Bit => codes.extend_from_slice(&[38, 5, fg.to_ansi_8bit()]),
                Mode::TrueColor => {
                    let rgb = fg.to_rgba();
                    codes.extend_from_slice(&[38, 2, rgb.r, rgb.g, rgb.b]);
                }
            }
        }
        if let Some(ref bg) = self.background {
            match mode {
                Mode::Ansi8Bit => codes.extend_from_slice(&[48, 5, bg.to_ansi_8bit()]),
                Mode::TrueColor => {
                    let rgb = bg.to_rgba();
                    codes.extend_from_slice(&[48, 2, rgb.r, rgb.g, rgb.b]);
                }
            }
        }

        if self.bold {
            codes.push(1);
        }

        if self.italic {
            codes.push(3);
        }

        if self.underline {
            codes.push(4);
        }

        if codes.is_empty() {
            codes.push(0);
        }

        format!(
            "\x1b[{codes}m",
            codes = codes
                .iter()
                .map(|c| c.to_string())
                .collect::<Vec<_>>()
                .join(";")
        )
    }
}

impl From<Color> for Style {
    fn from(color: Color) -> Style {
        Style {
            foreground: Some(color),
            background: None,
            bold: false,
            italic: false,
            underline: false,
        }
    }
}

impl From<&Color> for Style {
    fn from(color: &Color) -> Style {
        color.clone().into()
    }
}

impl From<&Style> for Style {
    fn from(style: &Style) -> Style {
        style.clone()
    }
}

impl From<&mut Style> for Style {
    fn from(style: &mut Style) -> Style {
        style.clone()
    }
}

pub trait ToAnsiStyle {
    fn ansi_style(&self) -> Style;
}

impl ToAnsiStyle for Color {
    fn ansi_style(&self) -> Style {
        self.clone().into()
    }
}

#[cfg(not(windows))]
pub fn get_colormode() -> Option<Mode> {
    use std::env;
    let env_nocolor = env::var_os("NO_COLOR");
    if env_nocolor.is_some() {
        return None;
    }

    let env_colorterm = env::var("COLORTERM").ok();
    match env_colorterm.as_deref() {
        Some("truecolor") | Some("24bit") => Some(Mode::TrueColor),
        _ => Some(Mode::Ansi8Bit),
    }
}

#[cfg(windows)]
pub fn get_colormode() -> Option<Mode> {
    use std::env;
    let env_nocolor = env::var_os("NO_COLOR");
    match env_nocolor {
        Some(_) => None,
        // Assume 24bit support on Windows
        None => Some(Mode::TrueColor),
    }
}

#[derive(Default, Debug, Clone, Copy)]
pub struct Brush {
    mode: Option<Mode>,
}

impl Brush {
    pub fn from_mode(mode: Option<Mode>) -> Self {
        Brush { mode }
    }

    pub fn from_environment<T: IsTerminal>(stream: &T) -> Result<Self, UnknownColorModeError> {
        let mode = if stream.is_terminal() {
            let env_color_mode = std::env::var("PASTEL_COLOR_MODE").ok();
            match env_color_mode.as_deref() {
                Some(mode_str) => Mode::from_mode_str(mode_str)?,
                None => get_colormode(),
            }
        } else {
            None
        };
        Ok(Brush { mode })
    }

    pub fn paint<S>(self, text: S, style: impl Into<Style>) -> String
    where
        S: AsRef<str>,
    {
        if let Some(ansi_mode) = self.mode {
            format!(
                "{begin}{text}{end}",
                begin = style.into().escape_sequence(ansi_mode)
```

### Core Architecture Module: `src/cli/cli.rs`
```
use clap::{crate_description, crate_name, crate_version, Arg, ArgAction, Command};

// Only include `colorpicker_tools` for normal builds (not when compiling `build.rs` where
// the module machinery does not work)
#[cfg(pastel_normal_build)]
use crate::colorpicker_tools::COLOR_PICKER_TOOL_NAMES;

const SORT_OPTIONS: &[&str] = &["brightness", "luminance", "hue", "chroma", "random"];
const DEFAULT_SORT_ORDER: &str = "hue";

pub fn build_cli() -> Command {
    let color_arg = Arg::new("color")
        .help(
            "Colors can be specified in many different formats, such as #RRGGBB, RRGGBB, \
             #RGB, 'rgb(…, …, …)', 'hsl(…, …, …)', 'gray(…)' or simply by the name of the \
             color. The identifier '-' can be used to read a single color from standard input. \
             Also, the special identifier 'pick' can be used to run an external color picker \
             to choose a color. If no color argument is specified, colors will be read from \
             standard input.\n\
             Examples (all of these specify the same color):\
             \n  - lightslategray\
             \n  - '#778899'\
             \n  - 778899\
             \n  - 789\
             \n  - 'rgb(119, 136, 153)'\
             \n  - '119,136,153'\
             \n  - 'hsl(210, 14.3%, 53.3%)'\n\
             Alpha transparency is also supported:\
             \n  - '#77889980'\
             \n  - 'rgba(119, 136, 153, 0.5)'\
             \n  - 'hsla(210, 14.3%, 53.3%, 50%)'",
        )
        .required(false)
        .action(ArgAction::Append);

    let colorspace_arg = Arg::new("colorspace")
        .long("colorspace")
        .short('s')
        .value_name("name")
        .help("The colorspace in which to interpolate")
        .value_parser(["Lab", "LCh", "RGB", "HSL", "OkLab"])
        .ignore_case(true)
        .default_value("Lab");

    Command::new(crate_name!())
        .version(crate_version!())
        .about(crate_description!())
        .next_display_order(None)
        .color(clap::ColorChoice::Auto)
        .allow_negative_numbers(true)
        .dont_collapse_args_in_usage(true)
        .max_term_width(100)
        .subcommand_required(true)
        .arg_required_else_help(true)
        .subcommand(
            Command::new("color")
                .alias("colour")
                .alias("take")
                .alias("show")
                .alias("display")
                .about("Display information about the given color")
                .long_about("Show and display some information about the given color(s).\n\n\
                Example:\n  \
                  pastel color 556270 4ecdc4 c7f484 ff6b6b c44d58")
                .arg(color_arg.clone()),
        )
        .subcommand(
            Command::new("list")
                .about("Show a list of available color names")
                .arg(
                    Arg::new("sort-order")
                        .short('s')
                        .long("sort")
                        .help("Sort order")
                        .value_parser(SORT_OPTIONS.to_vec())
                        .default_value(DEFAULT_SORT_ORDER),
                ),
        )
        .subcommand(
            Command::new("random")
                .about("Generate a list of random colors")
                .long_about("Generate a list of random colors.\n\n\
                Example:\n  \
                  pastel random -n 20 --strategy lch_hue")
                .arg(
                    Arg::new("strategy")
                        .long("strategy")
                        .short('s')
                        .help(
                            "Randomization strategy:\n   \
                             vivid:    random hue, limited saturation and lightness values\n   \
                             rgb:      samples uniformly in RGB space\n   \
                             gray:     random gray tone (uniform)\n   \
                             lch_hue:  random hue, fixed lightness and chroma\n\
                             \n\
                             Default strategy: 'vivid'\n ",
                        )
                        .value_parser(["vivid", "rgb", "gray", "lch_hue"])
                        .hide_default_value(true)
                        .hide_possible_values(true)
                        .default_value("vivid"),
                )
                .arg(
                    Arg::new("number")
                        .long("number")
                        .short('n')
                        .help("Number of colors to generate")
                        .action(ArgAction::Set)
                        .default_value("10")
                        .value_name("count"),
                ),
        )
        .subcommand(
            Command::new("distinct")
                .about("Generate a set of visually distinct colors")
                .long_about("Generate a set of visually distinct colors by maximizing \
                             the perceived color difference between pairs of colors.\n\n\
                             The default parameters for the optimization procedure \
                             (simulated annealing) should work fine for up to 10-20 colors.")
                .arg(
                    Arg::new("number")
                        .help("Number of distinct colors in the set")
                        .action(ArgAction::Set)
                        .default_value("10")
                        .value_name("count"),
                )
                .arg(
                    Arg::new("metric")
                        .long("metric")
                        .short('m')
                        .help("Distance metric to compute mutual color distances. The CIEDE2000 is \
                               more accurate, but also much slower.")
                        .action(ArgAction::Set)
                        .value_parser(["CIEDE2000", "CIE76"])
                        .value_name("name")
                        .default_value("CIE76")
                )
                .arg(
                    Arg::new("print-minimal-distance")
                        .long("print-minimal-distance")
                        .action(ArgAction::SetTrue)
                        .help("Only show the optimized minimal distance")
                        .hide(true)
                )
                .arg(
                    Arg::new("verbose")
                        .long("verbose")
                        .short('v')
                        .action(ArgAction::SetTrue)
                        .help("Print simulation output to STDERR")
                ).
                arg(color_arg.clone()),
        )
        .subcommand(
            Command::new("sort-by")
                .about("Sort colors by the given property")
                .long_about("Sort a list of colors by the given property.\n\n\
                Example:\n  \
                  pastel random -n 20 | pastel sort-by hue | pastel format hex")
                .alias("sort")
                .arg(
                    Arg::new("sort-order")
                        .help("Sort order")
                        .value_parser(SORT_OPTIONS.to_vec())
                        .default_value(DEFAULT_SORT_ORDER)
                )
                .arg(
                    Arg::new("reverse")
                        .long("reverse")
                        .short('r')
                        .action(ArgAction::SetTrue)
                        .help("Reverse the sort order"),
                )
                .arg(
                    Arg::new("unique")
                        .long("unique")
                        .short('u')
                        .action(ArgAction::SetTrue)
                        .help("Remove duplicate colors (equality is determined via RGB values)"),
                )
                .arg(color_arg.clone()),
        )
        .subcommand(
            Command::new("pick")
                .about("Interactively pick a color from the screen 
```

### Core Architecture Module: `src/cli/colorpicker.rs`
```
use std::io::{self, Write};
use std::process::Command;

use crate::colorpicker_tools::COLOR_PICKER_TOOLS;
use crate::config::Config;
use crate::error::{PastelError, Result};
use crate::hdcanvas::Canvas;

use pastel::ansi::Brush;
use pastel::Color;

/// Print a color spectrum to STDERR.
pub fn print_colorspectrum(config: &Config) -> Result<()> {
    let width = config.colorpicker_width;

    let mut canvas = Canvas::new(
        width + 2 * config.padding,
        width + 2 * config.padding,
        Brush::from_environment(&io::stderr())?,
    );
    canvas.draw_rect(
        config.padding,
        config.padding,
        width + 2,
        width + 2,
        &Color::white(),
    );

    for y in 0..width {
        for x in 0..width {
            let rx = (x as f64) / (width as f64);
            let ry = (y as f64) / (width as f64);

            let h = 360.0 * rx;
            let s = 0.6;
            let l = 0.95 * ry;

            // Start with HSL
            let color = Color::from_hsl(h, s, l);

            // But (slightly) normalize the luminance
            let mut lch = color.to_lch();
            lch.l = (lch.l + ry * 100.0) / 2.0;
            let color = Color::from_lch(lch.l, lch.c, lch.h, 1.0);

            canvas.draw_rect(config.padding + y + 1, config.padding + x + 1, 1, 1, &color);
        }
    }

    let stderr_handle = io::stderr();
    let mut stderr = stderr_handle.lock();

    canvas.print(&mut stderr)?;
    writeln!(&mut stderr)?;
    Ok(())
}

/// Run an external color picker tool (e.g. gpick or xcolor) and get the output as a string.
pub fn run_external_colorpicker(picker: Option<&str>) -> Result<String> {
    for tool in COLOR_PICKER_TOOLS
        .iter()
        .filter(|t| picker.is_none_or(|p| t.command.eq_ignore_ascii_case(p)))
    {
        let result = Command::new(tool.command).args(tool.version_args).output();

        let tool_is_available = match result {
            Ok(ref output) => {
                output.stdout.starts_with(tool.version_output_starts_with)
                    || output.stderr.starts_with(tool.version_output_starts_with)
            }
            _ => false,
        };

        if tool_is_available {
            let result = Command::new(tool.command).args(tool.args).output()?;
            if !result.status.success() {
                return Err(PastelError::ColorPickerExecutionError(
                    tool.command.to_string(),
                ));
            }

            let color =
                String::from_utf8(result.stdout).map_err(|_| PastelError::ColorInvalidUTF8)?;
            let color = color.trim().to_string();

            // Check if tool requires some post processing of the output
            if let Some(post_process) = tool.post_process {
                return post_process(color)
                    .map_err(|error| PastelError::ColorParseError(error.to_string()));
            } else {
                return Ok(color);
            }
        }
    }

    Err(PastelError::NoColorPickerFound)
}

```

### Core Architecture Module: `src/cli/colorpicker_tools.rs`
```
use once_cell::sync::Lazy;

pub struct ColorPickerTool {
    pub command: &'static str,
    pub args: &'static [&'static str],
    pub version_args: &'static [&'static str],
    pub version_output_starts_with: &'static [u8],
    #[allow(clippy::type_complexity)]
    /// Post-Process the output of the color picker tool
    pub post_process: Option<fn(String) -> Result<String, &'static str>>,
}

pub static COLOR_PICKER_TOOLS: Lazy<Vec<ColorPickerTool>> = Lazy::new(|| {
    vec![
        #[cfg(target_os = "macos")]
        ColorPickerTool {
            command: "osascript",
            // NOTE: This does not use `console.log` to print the value as you might expect,
            // because that gets written to stderr instead of stdout regardless of the `-s o` flag.
            // (This is accurate as of macOS Mojave/10.14.6).
            // See related: https://apple.stackexchange.com/a/278395
            args: &[
                "-l",
                "JavaScript",
                "-s",
                "o",
                "-e",
                "
                const app = Application.currentApplication();\n
                app.includeStandardAdditions = true;\n
                const rgb = app.chooseColor({defaultColor: [0.5, 0.5, 0.5]})\n
                  .map(n => Math.round(n * 255))\n
                  .join(', ');\n
                `rgb(${rgb})`;\n
            ",
            ],
            version_args: &["-l", "JavaScript", "-s", "o", "-e", "'ok';"],
            version_output_starts_with: b"ok",
            post_process: None,
        },
        ColorPickerTool {
            command: "gpick",
            args: &["--pick", "--single", "--output"],
            version_args: &["--version"],
            version_output_starts_with: b"Gpick",
            post_process: None,
        },
        ColorPickerTool {
            command: "xcolor",
            args: &["--format", "hex"],
            version_args: &["--version"],
            version_output_starts_with: b"xcolor",
            post_process: None,
        },
        ColorPickerTool {
            command: "wcolor",
            args: &["--format", "hex"],
            version_args: &["--version"],
            version_output_starts_with: b"wcolor",
            post_process: None,
        },
        ColorPickerTool {
            command: "grabc",
            args: &["-hex"],
            version_args: &["-v"],
            version_output_starts_with: b"grabc",
            post_process: None,
        },
        ColorPickerTool {
            command: "colorpicker",
            args: &["--one-shot", "--short"],
            version_args: &["--help"],
            version_output_starts_with: b"",
            post_process: None,
        },
        ColorPickerTool {
            command: "chameleon",
            args: &[],
            version_args: &["-h"],
            version_output_starts_with: b"",
            post_process: None,
        },
        ColorPickerTool {
            command: "kcolorchooser",
            args: &["--print"],
            version_args: &["-v"],
            version_output_starts_with: b"kcolorchooser",
            post_process: None,
        },
        ColorPickerTool {
            command: "zenity",
            args: &["--color-selection"],
            version_args: &["--version"],
            version_output_starts_with: b"",
            post_process: None,
        },
        ColorPickerTool {
            command: "yad",
            args: &["--color"],
            version_args: &["--version"],
            version_output_starts_with: b"",
            post_process: None,
        },
        ColorPickerTool {
            command: "hyprpicker",
            args: &[],
            version_args: &["-h"],
            version_output_starts_with: b"",
            post_process: None,
        },
        #[cfg(target_os = "linux")]
        ColorPickerTool {
            command: "gdbus",
            args: &[
                "call",
                "--session",
                "--dest",
                "org.gnome.Shell.Screenshot",
                "--object-path",
                "/org/gnome/Shell/Screenshot",
                "--method",
                "org.gnome.Shell.Screenshot.PickColor",
            ],
            version_args: &[
                "introspect",
                "--session",
                "--dest",
                "org.gnome.Shell.Screenshot",
                "--object-path",
                "/org/gnome/Shell/Screenshot",
            ],
            version_output_starts_with: b"node /org/gnome/Shell/Screenshot",
            post_process: Some(gdbus_parse_color),
        },
    ]
});

pub static COLOR_PICKER_TOOL_NAMES: Lazy<Vec<&'static str>> =
    Lazy::new(|| COLOR_PICKER_TOOLS.iter().map(|t| t.command).collect());

#[cfg(target_os = "linux")]
pub fn gdbus_parse_color(raw: String) -> Result<String, &'static str> {
    const PARSE_ERROR: &str = "Unexpected gdbus output format";
    let rgb = raw
        .split('(')
        .nth(2)
        .ok_or(PARSE_ERROR)?
        .split(')')
        .next()
        .ok_or(PARSE_ERROR)?;
    let rgb = rgb
        .split(',')
        .map(|v| v.trim().parse::<f64>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| PARSE_ERROR)?;
    if rgb.len() != 3 {
        return Err(PARSE_ERROR);
    }
    Ok(format!(
        "rgb({}%,{}%,{}%)",
        rgb[0] * 100.,
        rgb[1] * 100.,
        rgb[2] * 100.
    ))
}

```

### Core Architecture Module: `src/cli/colorspace.rs`
```
use pastel::Color;
use pastel::{Fraction, LCh, Lab, OkLCh, OkLab, HSLA, RGBA};

#[allow(clippy::type_complexity)]
pub fn get_mixing_function(
    colorspace_name: &str,
) -> Box<dyn Fn(&Color, &Color, Fraction) -> Color> {
    match colorspace_name.to_lowercase().as_ref() {
        "rgb" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<RGBA<f64>>(c2, f)),
        "hsl" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<HSLA>(c2, f)),
        "lab" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<Lab>(c2, f)),
        "lch" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<LCh>(c2, f)),
        "oklab" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<OkLab>(c2, f)),
        "oklch" => Box::new(|c1: &Color, c2: &Color, f: Fraction| c1.mix::<OkLCh>(c2, f)),
        _ => unreachable!("Unknown color space"),
    }
}

```

### Core Architecture Module: `src/cli/commands/color_commands.rs`
```
use crate::colorspace::get_mixing_function;
use crate::commands::prelude::*;

use pastel::ColorblindnessType;
use pastel::Fraction;

fn clamp(lower: f64, upper: f64, x: f64) -> f64 {
    f64::max(f64::min(upper, x), lower)
}

macro_rules! color_command {
    ($cmd_name:ident, $config:ident, $matches:ident, $color:ident, $body:block) => {
        pub struct $cmd_name;

        impl ColorCommand for $cmd_name {
            fn run(
                &self,
                out: &mut Output,
                $matches: &ArgMatches,
                $config: &Config,
                $color: &Color,
            ) -> Result<()> {
                let output = $body;
                out.show_color($config, &output)
            }
        }
    };
}

color_command!(SaturateCommand, _config, matches, color, {
    let amount = number_arg(matches, "amount")?;
    color.saturate(amount)
});

color_command!(DesaturateCommand, _config, matches, color, {
    let amount = number_arg(matches, "amount")?;
    color.desaturate(amount)
});

color_command!(LightenCommand, _config, matches, color, {
    let amount = number_arg(matches, "amount")?;
    color.lighten(amount)
});

color_command!(DarkenCommand, _config, matches, color, {
    let amount = number_arg(matches, "amount")?;
    color.darken(amount)
});

color_command!(RotateCommand, _config, matches, color, {
    let degrees = number_arg(matches, "degrees")?;
    color.rotate_hue(degrees)
});

color_command!(ComplementCommand, _config, _matches, color, {
    color.complementary()
});

color_command!(ToGrayCommand, _config, _matches, color, { color.to_gray() });

color_command!(TextColorCommand, _config, _matches, color, {
    color.text_color()
});

color_command!(MixCommand, config, matches, color, {
    let mut print_spectrum = PrintSpectrum::Yes;

    let base = ColorArgIterator::from_color_arg(
        config,
        matches
            .get_one::<String>("base")
            .expect("required argument"),
        &mut print_spectrum,
    )?;
    let fraction = Fraction::from(1.0 - number_arg(matches, "fraction")?);

    let mix = get_mixing_function(
        matches
            .get_one::<String>("colorspace")
            .expect("required argument"),
    );

    mix(&base, color, fraction)
});

color_command!(ColorblindCommand, config, matches, color, {
    // The type of colorblindness selected (protanopia, deuteranopia, tritanopia)
    let cb_ty = matches
        .get_one::<String>("type")
        .expect("required argument");
    let cb_ty = cb_ty.to_lowercase();

    // Convert the string to the corresponding enum variant
    let cb_ty = match cb_ty.as_ref() {
        "prot" => ColorblindnessType::Protanopia,
        "deuter" => ColorblindnessType::Deuteranopia,
        "trit" => ColorblindnessType::Tritanopia,
        &_ => {
            unreachable!("Unknown property");
        }
    };

    color.simulate_colorblindness(cb_ty)
});

color_command!(SetCommand, config, matches, color, {
    let property = matches
        .get_one::<String>("property")
        .expect("required argument");
    let property = property.to_lowercase();
    let property = property.as_ref();

    let value = number_arg(matches, "value")?;

    match property {
        "red" | "green" | "blue" => {
            let mut rgba = color.to_rgba();
            let value = clamp(0.0, 255.0, value) as u8;
            match property {
                "red" => {
                    rgba.r = value;
                }
                "green" => {
                    rgba.g = value;
                }
                "blue" => {
                    rgba.b = value;
                }
                _ => unreachable!(),
            }
            Color::from_rgba(rgba.r, rgba.g, rgba.b, rgba.alpha)
        }
        "hsl-hue" | "hsl-saturation" | "hsl-lightness" => {
            let mut hsla = color.to_hsla();
            match property {
                "hsl-hue" => {
                    hsla.h = value;
                }
                "hsl-saturation" => {
                    hsla.s = value;
                }
                "hsl-lightness" => {
                    hsla.l = value;
                }
                _ => unreachable!(),
            }
            Color::from_hsla(hsla.h, hsla.s, hsla.l, hsla.alpha)
        }
        "oklab-l" | "oklab-a" | "oklab-b" => {
            let mut oklab = color.to_oklab();
            match property {
                "oklab-l" => {
                    oklab.l = value;
                }
                "oklab-a" => {
                    oklab.a = value;
                }
                "oklab-b" => {
                    oklab.b = value;
                }
                _ => unreachable!(),
            }
            Color::from_oklab(oklab.l, oklab.a, oklab.b, oklab.alpha)
        }
        "lightness" | "lab-a" | "lab-b" => {
            let mut lab = color.to_lab();
            match property {
                "lightness" => {
                    lab.l = value;
                }
                "lab-a" => {
                    lab.a = value;
                }
                "lab-b" => {
                    lab.b = value;
                }
                _ => unreachable!(),
            }
            Color::from_lab(lab.l, lab.a, lab.b, lab.alpha)
        }
        "hue" | "chroma" => {
            let mut lch = color.to_lch();
            match property {
                "hue" => {
                    lch.h = value;
                }
                "chroma" => {
                    lch.c = value;
                }
                _ => unreachable!(),
            }
            Color::from_lch(lch.l, lch.c, lch.h, lch.alpha)
        }
        "alpha" => {
            let mut hsla = color.to_hsla();
            hsla.alpha = value;
            Color::from_hsla(hsla.h, hsla.s, hsla.l, hsla.alpha)
        }
        &_ => {
            unreachable!("Unknown property");
        }
    }
});

```

### Core Architecture Module: `src/cli/commands/colorcheck.rs`
```
use crate::commands::prelude::*;
use crate::hdcanvas::Canvas;

use pastel::ansi::{Brush, Mode};

pub struct ColorCheckCommand;

fn print_board(out: &mut Output, config: &Config, mode: Mode) -> Result<()> {
    // These colors have been chosen/computed such that the perceived color difference (CIE delta-E
    // 2000) to the closest ANSI 8-bit color is maximal.
    let c1 = Color::from_rgb(73, 39, 50);
    let c2 = Color::from_rgb(16, 51, 30);
    let c3 = Color::from_rgb(29, 54, 90);

    let width = config.colorcheck_width;

    let mut canvas = Canvas::new(
        width + 2 * config.padding,
        3 * width + 3 * config.padding,
        Brush::from_mode(Some(mode)),
    );

    canvas.draw_rect(config.padding, config.padding, width, width, &c1);

    canvas.draw_rect(
        config.padding,
        2 * config.padding + width,
        width,
        width,
        &c2,
    );

    canvas.draw_rect(
        config.padding,
        3 * config.padding + 2 * width,
        width,
        width,
        &c3,
    );

    canvas.print(out.handle)
}

impl GenericCommand for ColorCheckCommand {
    fn run(&self, out: &mut Output, _: &ArgMatches, config: &Config) -> Result<()> {
        writeln!(out.handle, "\n8-bit mode:")?;
        print_board(out, config, Mode::Ansi8Bit)?;

        writeln!(out.handle, "24-bit mode:")?;
        print_board(out, config, Mode::TrueColor)?;

        writeln!(
            out.handle,
            "If your terminal emulator supports 24-bit colors, you should see three square color \
             panels in the lower row and the colors should look similar (but slightly different \
             from) the colors in the top row panels.\nThe panels in the lower row should look \
             like squares that are filled with a uniform color (no stripes or other artifacts).\n\
             \n\
             You can also open https://github.com/sharkdp/pastel/blob/master/doc/colorcheck.md in \
             a browser to compare how the output should look like."
        )?;

        Ok(())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #234** (2024-10-02): **pastel list -s random panics**
  *Symptoms*: Environment: Arch Linux x86_64 zsh 5.9 pastel 0.10.0  Error message: ``` thread 'main' panicked at library/core/src/slice/sort/shared/smallsort.rs:862:5: user-provided comparison function does not correctly implement a total order note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ``` I think the cause is line 13 of `src/cli/commands/sort.rs` returning different number every time it is called. (I am not sure with this, so I'll try to find it out and fix it if I can.)
  **Post-Mortem & Fix Analysis**:
  > Oh interesting, thank you for reporting this! This used to work with previous versions of Rust, but fails with 1.81, indeed.  This is most certainly due to this change in 1.81: https://blog.rust-lang.org/2024/09/05/Rust-1.81.0.html#new-sort-implementations  

- **Issue #121** (2022-08-09): **pastel pick doesn't display all colors**
  *Symptoms*: When I run `pastel pick` in st or urxvt, i get a output like ![output_image](https://user-images.githubusercontent.com/24685286/78463921-30680a80-76e3-11ea-8936-a3c700bb5f0f.png) even though when running this: ```sh awk 'BEGIN{     s="/\\/\\/\\/\\/\\"; s=s s s s s s s s;     for (colnum = 0; colnum<77; colnum++) {         r = 255-(colnum*255/76);         g = (colnum*510/76);         b = (colnum*255/76);         if (g>255) g = 510-g;         printf "\033[48;2;%d;%d;%dm", r,g,b;         printf "\033[38;2;%d;%d;%dm", 255-r,255-g,255-b;         printf "%s\033[0m", substr(s,colnum+1,1);     }     printf "\n"; }' ``` from https://gist.github.com/XVilka/8346728, I get a smooth gradient: ![gradient_image](https://user-images.githubusercontent.com/24685286/78463968-dca9f100-76e3-11ea-9de0-c91350367a23.png) In alacritty, it seems to work though: ![alacritty_output_image](https://user-images.githubusercontent.com/24685286/78463977-04995480-76e4-11ea-8422-e01ad938f32d.png)   
  **Post-Mortem & Fix Analysis**:
  > It appears that `urxvt` does not set the `COLORTERM` variable to `truecolor`, which is the only way how we can detect that a terminal emulator supports 24bit colors.  If you run `pastel colorcheck`, you should be able to clearly determine whether or 24bit is supported.
  > Don't you see a warning in the top output of `pastel pick`?  ![image](https://user-images.githubusercontent.com/4209276/78473586-17427680-7742-11ea-8cae-6f7724bc391d.png) 
  > Well, I saw the warning and set the environment variable `PASTEL_COLOR_MODE=24bit`. With this enabled, I get the output in st and urxvt I showed earlier. But now that I tried, when I set `COLORTERM=24bit` or `COLORTERM=truecolor`, then it shows correctly all the colors like in alacritty. Maybe there is a problem with the check for `PASTEL_COLOR_MODE`  Edit: Btw it just works for st, I just looked into it and urxvt doesn't even support truecolor to my surprise.

- **Issue #69** (2019-08-25): **"pastel distinct N" panics for N < 2**
  *Symptoms*: 

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

### Incident Patch 1: `74a0fc8d` (2026-02-14)
**Commit Message**: Fix #289

**File**: `src/ansi.rs` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@ use crate::delta_e::ciede2000;
 use crate::{Color, Lab};
 
 static ANSI_LAB_REPRESENTATIONS: Lazy<Vec<(u8, Lab)>> = Lazy::new(|| {
-    (16..255)
+    (16..=255)
         .map(|code| (code, Color::from_ansi_8bit(code).to_lab()))
         .collect()
 });
@@ -365,6 +365,7 @@ mod tests {
     fn to_ansi_8bit_grays() {
         assert_eq!(232, Color::from_rgb(8, 8, 8).to_ansi_8bit());
         assert_eq!(242, Color::from_rgb(108, 108, 108).to_ansi_8bit());
+        assert_eq!(255, Color::from_rgb(238, 238, 238).to_ansi_8bit());
     }
 
     #[test]
```

---

### Incident Patch 2: `c2079c8c` (2025-09-16)
**Commit Message**: Fix RGBA format in from_u32 documentation

The documentation says `0xRRGGBBAA` but the implementation is for `0xAARRGGBB`

**File**: `src/lib.rs` (modified, +1/-1)
```diff
@@ -348,7 +348,7 @@ impl Color {
         u32::from(rgba.r).wrapping_shl(16) + u32::from(rgba.g).wrapping_shl(8) + u32::from(rgba.b)
     }
 
-    /// Parse the RGBA representation (`0xRRGGBBAA`) of an u32 into a Color.
+    /// Parse the RGBA representation (`0xAARRGGBB`) of an u32 into a Color.
     pub fn from_u32(n: u32) -> Color {
         let a = n >> 24;
         let r = (n >> 16) & 0xff;
```

---

### Incident Patch 3: `7ee906de` (2025-08-31)
**Commit Message**: Fix typo, closes #264

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 ## Other
 
 - Optimization for eliminating redundant memory operations, see #165 (@yyzdtccjdtc)
-- Add colour as an alias for the colour command, see #173 (@BuyMyMojo)
+- Add colour as an alias for the color command, see #173 (@BuyMyMojo)
 - Suggest to use pastel pick --help instead of -h, see #181 (@sharkdp)
 
 
```

---

### Incident Patch 4: `9b684b33` (2024-10-02)
**Commit Message**: fixed bug

**File**: `src/cli/commands/list.rs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ impl GenericCommand for ListCommand {
         let sort_order = matches.value_of("sort-order").expect("required argument");
 
         let mut colors: Vec<&NamedColor> = NAMED_COLORS.iter().collect();
-        colors.sort_by_key(|nc| key_function(sort_order, &nc.color));
+        colors.sort_by_cached_key(|nc| key_function(sort_order, &nc.color));
         colors.dedup_by(|n1, n2| n1.color == n2.color);
 
         if config.interactive_mode {
```

**File**: `src/cli/commands/sort.rs` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ impl GenericCommand for SortCommand {
             colors.dedup_by_key(|c| c.to_u32());
         }
 
-        colors.sort_by_key(|c| key_function(sort_order, c));
+        colors.sort_by_cached_key(|c| key_function(sort_order, c));
 
         if matches.is_present("reverse") {
             colors.reverse();
```

---

### Incident Patch 5: `7da44d47` (2024-09-06)
**Commit Message**: Fix warnings

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -53,3 +53,6 @@ harness = false
 lto = true
 strip = true
 codegen-units = 1
+
+[lints.rust]
+unexpected_cfgs = { level = "warn", check-cfg = ['cfg(pastel_normal_build)'] }
```

---

### Incident Patch 6: `970111ec` (2024-02-12)
**Commit Message**: Fix a typo

**File**: `src/cli/hdcanvas.rs` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ impl Canvas {
     // luminosity difference percentage is below the specified threshold.
     // Using block characters for graphics display can trigger this, causing
     // black or white lines or blocks, if the color is the same or too close.
-    // The checkerboard should be ok unless the theshold is set fairly high.
+    // The checkerboard should be ok unless the threshold is set fairly high.
     pub fn print(&self, out: &mut dyn Write) -> Result<()> {
         for i_div_2 in 0..self.height / 2 {
             for j in 0..self.width {
```

---

### Incident Patch 7: `a7fcb499` (2024-01-16)
**Commit Message**: Fix CI

**File**: `.github/workflows/CICD.yml` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ jobs:
 
         DPKG_BASENAME=${{ needs.crate_metadata.outputs.name }}
         DPKG_CONFLICTS=${{ needs.crate_metadata.outputs.name }}-musl
-        case ${{ matrix.job.target }} in *-musl) DPKG_BASENAME=${{ needs.crate_metadata.outputs.name }}-musl ; DPKG_CONFLICTS=${{ needs.crate_metadata.outputs.name }} ;; esac;
+        case ${{ matrix.job.target }} in *-musl*) DPKG_BASENAME=${{ needs.crate_metadata.outputs.name }}-musl ; DPKG_CONFLICTS=${{ needs.crate_metadata.outputs.name }} ;; esac;
         DPKG_VERSION=${{ needs.crate_metadata.outputs.version }}
 
         unset DPKG_ARCH
```

---

### Incident Patch 8: `f08cc80d` (2023-10-30)
**Commit Message**: Fix lines in kitty terminal with text_fg_override_threshold set

The kitty terminal has a new setting text_fg_override_threshold that checks
the luminosity difference between the text and background and if it is above
the set percentage turns the text black or white to get the best possible
visibility.  pastel currently uses a unicode half block character and sets
both forground and background to the same color in the color patch.  This
patch changes this to be a space with both forground and background colors set
to the same color (only becuase I don't know enough rust to figure out how to
just set background color :/).

Possibly this could cause trouble with some background transparency settings,
although if so the current situation might as well to a lesser extent.  I'm
not sure how to make using text color work reliably with
text_fg_override_threshold so I think a command line option to use one or the
other would be needed there unless another drawing option is used.

There are two other ways to draw on kitty that could be considered.  The
graphics protocol allow arbitrary images to be displayed and is supported by a
few other terminals.  kitty also supports using colors with D

**File**: `src/cli/hdcanvas.rs` (modified, +14/-5)
```diff
@@ -85,11 +85,20 @@ impl Canvas {
                     let p_bottom = self.pixel(2 * i_div_2 + 1, j);
 
                     match (p_top, p_bottom) {
-                        (Some(top), Some(bottom)) => write!(
-                            out,
-                            "{}",
-                            self.brush.paint("▀", top.ansi_style().on(bottom))
-                        )?,
+                        (Some(top), Some(bottom)) =>
+                            if top == bottom {
+                                write!(
+                                    out,
+                                    "{}",
+                                    self.brush.paint(" ", top.ansi_style().on(bottom))
+                                )?
+                            } else {
+                                write!(
+                                    out,
+                                    "{}",
+                                    self.brush.paint("▀", top.ansi_style().on(bottom))
+                                )?
+                            },
                         (Some(top), None) => write!(out, "{}", self.brush.paint("▀", top))?,
                         (None, Some(bottom)) => write!(out, "{}", self.brush.paint("▄", bottom))?,
                         (None, None) => write!(out, " ")?,
```

---

### Incident Patch 9: `736fdf25` (2023-07-13)
**Commit Message**: Fix Arch Linux package link in README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ sudo dpkg -i pastel_0.8.1_amd64.deb
 
 ### On Arch Linux
 
-You can install `pastel` from the [Community](https://archlinux.org/packages/community/x86_64/pastel/) repositories:
+You can install `pastel` from the [Extra](https://archlinux.org/packages/extra/x86_64/pastel/) repositories:
 ```
 sudo pacman -S pastel
 ```
```

---

### Incident Patch 10: `3517f455` (2022-09-25)
**Commit Message**: Fix typos

Found via `codespell -L crate,ist`

**File**: `src/lib.rs` (modified, +3/-3)
```diff
@@ -585,7 +585,7 @@ impl Color {
         gray
     }
 
-    /// The percieved brightness of the color (A number between 0.0 and 1.0).
+    /// The perceived brightness of the color (A number between 0.0 and 1.0).
     ///
     /// See: <https://www.w3.org/TR/AERT#color-contrast>
     pub fn brightness(&self) -> Scalar {
@@ -654,7 +654,7 @@ impl Color {
     }
 
     /// Compute the perceived 'distance' between two colors according to the CIE76 delta-E
-    /// standard. A distance below ~2.3 is not noticable.
+    /// standard. A distance below ~2.3 is not noticeable.
     ///
     /// See: <https://en.wikipedia.org/wiki/Color_difference>
     pub fn distance_delta_e_cie76(&self, other: &Color) -> Scalar {
@@ -708,7 +708,7 @@ impl Color {
     }
 }
 
-// by default Colors will be printed into HSLA fromat
+// by default Colors will be printed into HSLA format
 impl fmt::Display for Color {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         write!(f, "{}", HSLA::from(self))
```

#### Recent Merged Pull Requests:
- **PR #307** (closed): Bump rand_xoshiro from 0.7.0 to 0.8.0 (@dependabot[bot])
- **PR #306** (2026-03-13): Bump clap from 4.5.56 to 4.5.60 (@dependabot[bot])
- **PR #305** (closed): Bump criterion from 0.7.0 to 0.8.2 (@dependabot[bot])
- **PR #304** (2026-03-13): Bump clap_complete from 4.5.65 to 4.5.66 (@dependabot[bot])
- **PR #303** (2026-03-13): Bump regex from 1.12.2 to 1.12.3 (@dependabot[bot])
- **PR #302** (2026-03-13): Bump actions/upload-artifact from 6 to 7 (@dependabot[bot])
- **PR #299** (2026-02-14): Add ANSI 8-bit parsing (@sharkdp)
- **PR #298** (2026-02-14): Replace atty dependency with std::io::IsTerminal (breaking) (@musicinmybrain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
