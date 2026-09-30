# Forensic Learning Record (Deep Inspection): sindresorhus/Gifski

> **Canonical Artifact**: `07_PROJECT_LEARNING/sindresorhus-gifski-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sindresorhus/Gifski](https://github.com/sindresorhus/Gifski))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:03:08.375Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sindresorhus/Gifski`
- **Description**: 🌈 Convert videos to high-quality GIFs on your Mac
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 8569 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Gifski/Gifski-Bridging-Header.h`
```
#import "gifski.h"
#include "CompositePreviewShared.h"

```

### Core Architecture Module: `Gifski/Preview/CompositePreviewShared.h`
```
#pragma once
#ifdef __METAL_VERSION__
// Metal types
#include <metal_stdlib>
using namespace metal;
typedef float2 shared_float2;
typedef float3 shared_float3;
typedef float4 shared_float4;
typedef uint shared_uint;

#define SHARED_CONSTANT constant
#else
// Swift/C types
#include <simd/simd.h>
typedef simd_float2 shared_float2;
typedef simd_float3 shared_float3;
typedef simd_float4 shared_float4;
typedef uint32_t shared_uint;

#define SHARED_CONSTANT
#endif

SHARED_CONSTANT const shared_uint VERTICES_PER_QUAD = 6;
typedef struct {
	/**
	Must be >= 0.
	*/
	shared_float2 videoOrigin;

	/**
	Must be >= 0
	*/
	shared_float2 videoSize;
	shared_float4 firstColor;
	shared_float4 secondColor;

	/**
	Must be >= 1;
	*/
	int gridSize;
} CompositePreviewFragmentUniforms;

typedef struct {
	shared_float2 scale;
} CompositePreviewVertexUniforms;

```

### Core Architecture Module: `gifski-api/gifski.h`
```
#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>


#ifdef __cplusplus
extern "C" {
#endif

struct gifski;
typedef struct gifski gifski;

/**
How to use from C

```c
gifski *g = gifski_new(&(GifskiSettings){
  .quality = 90,
});
gifski_set_file_output(g, "file.gif");

for(int i=0; i < frames; i++) {
     int res = gifski_add_frame_rgba(g, i, width, height, buffer, 5);
     if (res != GIFSKI_OK) break;
}
int res = gifski_finish(g);
if (res != GIFSKI_OK) return;
```

It's safe and efficient to call `gifski_add_frame_*` in a loop as fast as you can get frames,
because it blocks and waits until previous frames are written.

To cancel processing, make progress callback return 0 and call `gifski_finish()`. The write callback
may still be called between the cancellation and `gifski_finish()` returning.

To build as a library:

```bash
cargo build --release --lib
```

it will create `target/release/libgifski.a` (static library)
and `target/release/libgifski.so`/`dylib` or `gifski.dll` (dynamic library)

Static is recommended.

To build for iOS:

```bash
rustup target add aarch64-apple-ios
cargo build --release --lib --target aarch64-apple-ios
```

it will build `target/aarch64-apple-ios/release/libgifski.a` (ignore the warning about cdylib).

*/

/**
 * Settings for creating a new encoder instance. See `gifski_new`
 */
typedef struct GifskiSettings {
  /**
   * Resize to max this width if non-0.
   */
  uint32_t width;
  /**
   * Resize to max this height if width is non-0. Note that aspect ratio is not preserved.
   */
  uint32_t height;
  /**
   * 1-100, but useful range is 50-100. Recommended to set to 90.
   */
  uint8_t quality;
  /**
   * Lower quality, but faster encode.
   */
  bool fast;
  /**
   * If negative, looping is disabled. The number of times the sequence is repeated. 0 to loop forever.
   */
  int16_t repeat;
} GifskiSettings;

enum GifskiError {
  GIFSKI_OK = 0,
  /** one of input arguments was NULL */
  GIFSKI_NULL_ARG,
  /** a one-time function was called twice, or functions were called in wrong order */
  GIFSKI_INVALID_STATE,
  /** internal error related to palette quantization */
  GIFSKI_QUANT,
  /** internal error related to gif composing */
  GIFSKI_GIF,
  /** internal error - unexpectedly aborted */
  GIFSKI_THREAD_LOST,
  /** I/O error: file or directory not found */
  GIFSKI_NOT_FOUND,
  /** I/O error: permission denied */
  GIFSKI_PERMISSION_DENIED,
  /** I/O error: file already exists */
  GIFSKI_ALREADY_EXISTS,
  /** invalid arguments passed to function */
  GIFSKI_INVALID_INPUT,
  /** misc I/O error */
  GIFSKI_TIMED_OUT,
  /** misc I/O error */
  GIFSKI_WRITE_ZERO,
  /** misc I/O error */
  GIFSKI_INTERRUPTED,
  /** misc I/O error */
  GIFSKI_UNEXPECTED_EOF,
  /** progress callback returned 0, writing aborted */
  GIFSKI_ABORTED,
  /** should not happen, file a bug */
  GIFSKI_OTHER,
};

/* workaround for a wrong definition in an older version of this header. Please use GIFSKI_ABORTED directly */
#ifndef ABORTED
#define ABORTED GIFSKI_ABORTED
#endif

typedef enum GifskiError GifskiError;

/**
 * Call to start the process
 *
 * See `gifski_add_frame_png_file` and `gifski_end_adding_frames`
 *
 * Returns a handle for the other functions, or `NULL` on error (if the settings are invalid).
 */
gifski *gifski_new(const GifskiSettings *settings);


/** Quality 1-100 of temporal denoising. Lower values reduce motion. Defaults to `settings.quality`.
 *
 * Only valid immediately after calling `gifski_new`, before any frames are added. */
GifskiError gifski_set_motion_quality(gifski *handle, uint8_t quality);

/** Quality 1-100 of gifsicle compression. Lower values add noise. Defaults to `settings.quality`.
 * Has no effect if the `gifsicle` feature hasn't been enabled.
 * Only valid immediately after calling `gifski_new`, before any frames are added. */
GifskiError gifski_set_lossy_quality(gifski *handle, uint8_t quality);

/** If `true`, encoding will be significantly slower, but may look a bit better.
 *
 * Only valid immediately after calling `gifski_new`, before any frames are added. */
GifskiError gifski_set_extra_effort(gifski *handle, bool extra);

/**
 * Adds a frame to the animation. This function is asynchronous.
 *
 * File path must be valid UTF-8.
 *
 * `frame_number` orders frames (consecutive numbers starting from 0).
 * You can add frames in any order, and they will be sorted by their `frame_number`.
 *
 * Presentation timestamp (PTS) is time in seconds, since start of the file, when this frame is to be displayed.
 * For a 20fps video it could be `frame_number/20.0`.
 * Frames with duplicate or out-of-order PTS will be skipped.
 *
 * The first frame should have PTS=0. If the first frame has PTS > 0, it'll be used as a delay after the last frame.
 *
 * This function may block and wait until the frame is processed. Make sure to call `gifski_set_write_callback` or `gifski_set_file_output` first to avoid a deadlock.
 *
 * Returns 0 (`GIFSKI_OK`) on success, and non-0 `GIFSKI_*` constant on error.
 */
GifskiError gifski_add_frame_png_file(gifski *handle,
                                      uint32_t frame_number,
                                      const char *file_path,
                                      double presentation_timestamp);

/**
 * Adds a frame to the animation. This function is asynchronous.
 *
 * `pixels` is an array width×height×4 bytes large.
 * The array is copied, so you can free/reuse it immediately after this function returns.
 *
 * `frame_number` orders frames (consecutive numbers starting from 0).
 * You can add frames in any order, and they will be sorted by their `frame_number`.
 * However, out-of-order frames are buffered in RAM, and will cause high memory usage
 * if there are gaps in the frame numbers.
 *
 * Presentation timestamp (PTS) is time in seconds, since start of the file, when this frame is to be displayed.
 * For a 20fps video it could be `frame_number/20.0`. First frame must have PTS=0.
 * Frames with duplicate or out-of-order PTS will be skipped.
 *
 * The first frame should have PTS=0. If the first frame has PTS > 0, it'll be used as a delay after the last frame.
 *
 * Colors are in sRGB, uncorrelated RGBA, with alpha byte last.
 *
 * This function may block and wait until the frame is processed. Make sure to call `gifski_set_write_callback` or `gifski_set_file_output` first to avoid a deadlock.
 *
 * Returns 0 (`GIFSKI_OK`) on success, and non-0 `GIFSKI_*` constant on error.
 */
GifskiError gifski_add_frame_rgba(gifski *handle,
                                  uint32_t frame_number,
                                  uint32_t width,
                                  uint32_t height,
                                  const unsigned char *pixels,
                                  double presentation_timestamp);

/** Same as `gifski_add_frame_rgba`, but with bytes per row arg */
GifskiError gifski_add_frame_rgba_stride(gifski *handle,
                                  uint32_t frame_number,
                                  uint32_t width,
                                  uint32_t height,
                                  uint32_t bytes_per_row,
                                  const unsigned char *pixels,
                                  double presentation_timestamp);

/** Same as `gifski_add_frame_rgba_stride`, except it expects components in ARGB order.

Bytes per row must be multiple of 4, and greater or equal width×4.
If the bytes per row value is invalid (e.g. an odd number), frames may look sheared/skewed.

Colors are in sRGB, uncorrelated ARGB, with alpha byte first.

`gifski_add_frame_rgba` is preferred over this function.
*/
GifskiError gifski_add_frame_argb(gifski *handle,
                                  uint32_t frame_number,
                                  uint32_t width,
                                  uint32_t bytes_per_row,
                                  uint32_t height,
                                  const unsigne
```

### Core Architecture Module: `gifski-api/src/bin/ffmpeg_source.rs`
```
use crate::source::{Fps, Source};
use crate::{BinResult, SrcPath};
use gifski::{Collector, Settings};
use imgref::*;
use rgb::*;

pub struct FfmpegDecoder {
    input_context: ffmpeg::format::context::Input,
    frames: u64,
    rate: Fps,
    settings: Settings,
}

impl Source for FfmpegDecoder {
    fn total_frames(&self) -> Option<u64> {
        Some(self.frames)
    }

    fn collect(&mut self, dest: &mut Collector) -> BinResult<()> {
        self.collect_frames(dest)
    }
}

impl FfmpegDecoder {
    pub fn new(src: SrcPath, rate: Fps, settings: Settings) -> BinResult<Self> {
        ffmpeg::init().map_err(|e| format!("Unable to initialize ffmpeg: {}", e))?;
        let input_context = match src {
            SrcPath::Path(path) => ffmpeg::format::input(&path)
                .map_err(|e| format!("Unable to open video file {}: {}", path.display(), e))?,
            SrcPath::Stdin(_) => return Err("Video files must be specified as a path on disk. Input via stdin is not supported".into()),
        };

        // take fps override into account
        let filter_fps = rate.fps / rate.speed;
        let stream = input_context.streams().best(ffmpeg::media::Type::Video).ok_or("The file has no video tracks")?;
        let time_base = stream.time_base().numerator() as f64 / stream.time_base().denominator() as f64;
        let frames = (stream.duration() as f64 * time_base * filter_fps as f64).ceil() as u64;
        Ok(Self { input_context, frames, rate, settings })
    }

    #[inline(never)]
    pub fn collect_frames(&mut self, dest: &mut Collector) -> BinResult<()> {
        let (stream_index, mut decoder, mut filter) = {
            let filter_fps = self.rate.fps / self.rate.speed;
            let stream = self.input_context.streams().best(ffmpeg::media::Type::Video).ok_or("The file has no video tracks")?;

            let mut codec_context = ffmpeg::codec::context::Context::new();
            codec_context.set_parameters(stream.parameters())?;
            let decoder = codec_context.decoder().video().map_err(|e| format!("Unable to decode the codec used in the video: {}", e))?;

            let (dest_width, dest_height) = self.settings.dimensions_for_image(decoder.width() as _, decoder.height() as _);

            let buffer_args = format!("width={}:height={}:video_size={}x{}:pix_fmt={}:time_base={}:sar={}",
                dest_width,
                dest_height,
                decoder.width(),
                decoder.height(),
                decoder.format().descriptor().ok_or("ffmpeg format error")?.name(),
                stream.time_base(),
                (|sar: ffmpeg::util::rational::Rational| match sar.numerator() {
                    0 => "1".to_string(),
                    _ => format!("{}/{}", sar.numerator(), sar.denominator()),
                })(decoder.aspect_ratio()),
            );
            let mut filter = ffmpeg::filter::Graph::new();
            filter.add(&ffmpeg::filter::find("buffer").ok_or("ffmpeg format error")?, "in", &buffer_args)?;
            filter.add(&ffmpeg::filter::find("buffersink").ok_or("ffmpeg format error")?, "out", "")?;
            filter.output("in", 0)?.input("out", 0)?.parse(&format!("fps=fps={},format=rgba", filter_fps))?;
            filter.validate()?;
            (stream.index(), decoder, filter)
        };

        let add_frame = |rgba_frame: &ffmpeg::util::frame::Video, pts: f64, pos: i64| -> BinResult<()> {
            let stride = rgba_frame.stride(0) as usize;
            if stride % 4 != 0 {
                Err("incompatible video")?;
            }
            let rgba_frame = ImgVec::new_stride(
                rgba_frame.data(0).as_rgba().to_owned(),
                rgba_frame.width() as usize,
                rgba_frame.height() as usize,
                stride / 4,
            );
            Ok(dest.add_frame_rgba(pos as usize, rgba_frame, pts)?)
        };

        let mut vid_frame = ffmpeg::util::frame::Video::empty();
        let mut filt_frame = ffmpeg::util::frame::Video::empty();
        let mut i = 0;
        let mut pts_last_packet = 0;
        let pts_frame_step = 1.0 / self.rate.fps as f64;

        let packets = self.input_context.packets().filter_map(|(s, packet)| {
            if s.index() != stream_index {
                // ignore irrelevant streams
                None
            } else {
                pts_last_packet = packet.pts()? + packet.duration();
                Some(packet)
            }
        })
        // extra packet to flush remaining frames
        .chain(std::iter::once(ffmpeg::Packet::empty()));

        for packet in packets {
            decoder.send_packet(&packet)?;
            loop {
                match decoder.receive_frame(&mut vid_frame) {
                    Ok(()) => (),
                    Err(ffmpeg::Error::Other { errno: ffmpeg::error::EAGAIN }) | Err(ffmpeg::Error::Eof) => break,
                    Err(e) => return Err(Box::new(e)),
                }
                filter.get("in").ok_or("ffmpeg format error")?.source().add(&vid_frame)?;
                let mut out = filter.get("out").ok_or("ffmpeg format error")?;
                let mut out = out.sink();
                while let Ok(..) = out.frame(&mut filt_frame) {
                    add_frame(&filt_frame, pts_frame_step * i as f64, i)?;
                    i += 1;
                }
            }
        }

        // now flush filter's buffer
        filter.get("in").ok_or("ffmpeg format error")?.source().close(pts_last_packet)?;
        let mut out = filter.get("out").ok_or("ffmpeg format error")?;
        let mut out = out.sink();
        while let Ok(..) = out.frame(&mut filt_frame) {
            add_frame(&filt_frame, pts_frame_step * i as f64, i)?;
            i += 1;
        }
        Ok(())
    }
}

```

### Core Architecture Module: `gifski-api/src/bin/gif_source.rs`
```
//! This is for reading GIFs as an input for re-encoding as another GIF

use crate::source::{Fps, Source};
use crate::{BinResult, SrcPath};
use gif::Decoder;
use gifski::Collector;
use std::io::Read;

pub struct GifDecoder {
    speed: f32,
    decoder: Decoder<Box<dyn Read>>,
    screen: gif_dispose::Screen,
}

impl GifDecoder {
    pub fn new(src: SrcPath, fps: Fps) -> BinResult<Self> {
        let input = match src {
            SrcPath::Path(path) => Box::new(std::fs::File::open(path)?) as Box<dyn Read>,
            SrcPath::Stdin(buf) => Box::new(buf),
        };

        let mut gif_opts = gif::DecodeOptions::new();
        // Important:
        gif_opts.set_color_output(gif::ColorOutput::Indexed);

        let decoder = gif_opts.read_info(input)?;
        let screen = gif_dispose::Screen::new_decoder(&decoder);

        Ok(Self {
            speed: fps.speed,
            decoder,
            screen,
        })
    }
}

impl Source for GifDecoder {
    fn total_frames(&self) -> Option<u64> { None }
    fn collect(&mut self, c: &mut Collector) -> BinResult<()> {
        let mut idx = 0;
        let mut delay_ts = 0;
        while let Some(frame) = self.decoder.read_next_frame()? {
            self.screen.blit_frame(frame)?;
            let pixels = self.screen.pixels_rgba().map_buf(|b| b.to_owned());
            let presentation_timestamp = f64::from(delay_ts) * (1. / (100. * f64::from(self.speed)));
            c.add_frame_rgba(idx, pixels, presentation_timestamp)?;
            idx += 1;
            delay_ts += u32::from(frame.delay);
        }
        Ok(())
    }
}

```

### Core Architecture Module: `gifski-api/src/bin/gifski.rs`
```
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::enum_glob_use)]
#![allow(clippy::match_same_arms)]
#![allow(clippy::missing_errors_doc)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::needless_pass_by_value)]
#![allow(clippy::redundant_closure_for_method_calls)]
#![allow(clippy::wildcard_imports)]

use clap::builder::NonEmptyStringValueParser;
use clap::error::ErrorKind::MissingRequiredArgument;
use clap::value_parser;
use yuv::color::MatrixCoefficients;
use gifski::{Repeat, Settings};
use std::io::stdin;
use std::io::BufRead;
use std::io::BufReader;
use std::io::IsTerminal;
use std::io::Read;
use std::io::StdinLock;
use std::io::Stdout;

#[cfg(feature = "video")]
mod ffmpeg_source;
mod gif_source;
mod png;
mod source;
mod y4m_source;
use crate::source::Source;

use gifski::progress::{NoProgress, ProgressReporter};

pub type BinResult<T, E = Box<dyn std::error::Error + Send + Sync>> = Result<T, E>;

use clap::{Arg, ArgAction, Command};

use std::env;
use std::fmt;
use std::fs::File;
use std::io;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

#[cfg(feature = "video")]
const VIDEO_FRAMES_ARG_HELP: &str = "one video file supported by FFmpeg, or multiple PNG image files";
#[cfg(not(feature = "video"))]
const VIDEO_FRAMES_ARG_HELP: &str = "PNG image files for the animation frames, or a .y4m file";

fn main() {
    if let Err(e) = bin_main() {
        eprintln!("error: {e}");
        if let Some(e) = e.source() {
            eprintln!("error: {e}");
        }
        std::process::exit(1);
    }
}

#[allow(clippy::float_cmp)]
fn bin_main() -> BinResult<()> {
    let matches = Command::new(clap::crate_name!())
                        .version(clap::crate_version!())
                        .about("https://gif.ski by Kornel Lesiński")
                        .arg_required_else_help(true)
                        .allow_negative_numbers(true)
                        .arg(Arg::new("output")
                            .long("output")
                            .short('o')
                            .help("Destination file to write to; \"-\" means stdout")
                            .num_args(1)
                            .value_name("a.gif")
                            .value_parser(value_parser!(PathBuf))
                            .required(true))
                        .arg(Arg::new("fps")
                            .long("fps")
                            .short('r')
                            .help("Frame rate of animation. If using PNG files as \
                                   input, this means the speed, as all frames are \
                                   kept.\nIf video is used, it will be resampled to \
                                   this constant rate by dropping and/or duplicating \
                                   frames")
                            .value_parser(value_parser!(f32))
                            .value_name("num")
                            .default_value("20"))
                        .arg(Arg::new("fast-forward")
                            .long("fast-forward")
                            .help("Multiply speed of video by a factor")
                            .value_parser(value_parser!(f32))
                            .value_name("x")
                            .default_value("1"))
                        .arg(Arg::new("fast")
                            .num_args(0)
                            .action(ArgAction::SetTrue)
                            .long("fast")
                            .help("50% faster encoding, but 10% worse quality and larger file size"))
                        .arg(Arg::new("extra")
                            .long("extra")
                            .conflicts_with("fast")
                            .num_args(0)
                            .action(ArgAction::SetTrue)
                            .help("50% slower encoding, but 1% better quality and usually larger file size"))
                        .arg(Arg::new("quality")
                            .long("quality")
                            .short('Q')
                            .value_name("1-100")
                            .value_parser(value_parser!(u8).range(1..=100))
                            .num_args(1)
                            .default_value("90")
                            .help("Lower quality may give smaller file"))
                        .arg(Arg::new("motion-quality")
                            .long("motion-quality")
                            .value_name("1-100")
                            .value_parser(value_parser!(u8).range(1..=100))
                            .num_args(1)
                            .help("Lower values reduce motion"))
                        .arg(Arg::new("lossy-quality")
                            .long("lossy-quality")
                            .value_name("1-100")
                            .value_parser(value_parser!(u8).range(1..=100))
                            .num_args(1)
                            .help("Lower values introduce noise and streaks"))
                        .arg(Arg::new("width")
                            .long("width")
                            .short('W')
                            .num_args(1)
                            .value_parser(value_parser!(u32))
                            .value_name("px")
                            .help("Maximum width.\nBy default anims are limited to about 800x600"))
                        .arg(Arg::new("height")
                            .long("height")
                            .short('H')
                            .num_args(1)
                            .value_parser(value_parser!(u32))
                            .value_name("px")
                            .help("Maximum height (stretches if the width is also set)"))
                        .arg(Arg::new("nosort")
                            .alias("nosort")
                            .long("no-sort")
                            .num_args(0)
                            .action(ArgAction::SetTrue)
                            .hide_short_help(true)
                            .help("Use files exactly in the order given, rather than sorted"))
                        .arg(Arg::new("quiet")
                            .long("quiet")
                            .short('q')
                            .num_args(0)
                            .action(ArgAction::SetTrue)
                            .help("Do not display anything on standard output/console"))
                        .arg(Arg::new("FILES")
                            .help(VIDEO_FRAMES_ARG_HELP)
                            .num_args(1..)
                            .value_parser(NonEmptyStringValueParser::new())
                            .use_value_delimiter(false)
                            .required(true))
                        .arg(Arg::new("repeat")
                            .long("repeat")
                            .help("Number of times the animation is repeated (-1 none, 0 forever or <value> repetitions")
                            .num_args(1)
                            .value_parser(value_parser!(i16))
                            .value_name("num"))
                        .arg(Arg::new("bounce")
                            .long("bounce")
                            .num_args(0)
                            .action(ArgAction::SetTrue)
                            .hide_short_help(true)
                            .help("Make animation play forwards then backwards"))
                        .arg(Arg::new("fixed-color")
                            .long("fixed-color")
                            .help("Always include this color in the palette")
                            .hide_short_help(true)
                            .num_args(1)
                            .action(ArgAction::Append)
                            .value_parser(parse_colors)
                            .v
```

### Core Architecture Module: `gifski-api/src/bin/png.rs`
```
use crate::source::{Fps, Source};
use crate::BinResult;
use gifski::Collector;
use std::path::PathBuf;

pub struct Lodecoder {
    frames: Vec<PathBuf>,
    fps: f64,
}

impl Lodecoder {
    pub fn new(frames: Vec<PathBuf>, params: Fps) -> Self {
        Self {
            frames,
            fps: f64::from(params.fps) * f64::from(params.speed),
        }
    }
}

impl Source for Lodecoder {
    fn total_frames(&self) -> Option<u64> {
        Some(self.frames.len() as u64)
    }

    #[inline(never)]
    fn collect(&mut self, dest: &mut Collector) -> BinResult<()> {
        let dest = &*dest;
        let f = std::mem::take(&mut self.frames);
        for (i, frame) in f.into_iter().enumerate() {
            dest.add_frame_png_file(i, frame, i as f64 / self.fps)?;
        }
        Ok(())
    }
}

```

### Core Architecture Module: `gifski-api/src/bin/source.rs`
```
use crate::BinResult;
use gifski::Collector;

pub trait Source {
    fn total_frames(&self) -> Option<u64>;
    fn collect(&mut self, dest: &mut Collector) -> BinResult<()>;
}

#[derive(Debug, Copy, Clone)]
pub struct Fps {
    /// output rate
    pub fps: f32,
    /// skip frames
    pub speed: f32,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #332** (2025-07-08): **Bounce causes frame flash**
  *Symptoms*: https://github.com/sindresorhus/Gifski/pull/329#issuecomment-2811893937
  **Post-Mortem & Fix Analysis**:
  > @mmulet This has the bounty from:  - https://issuehunt.io/r/sindresorhus/react-router-util/issues/1 $40 - https://issuehunt.io/r/sindresorhus/strict-import/issues/2 $40 - https://issuehunt.io/r/sindresorhus/detect-indent/issues/7 $40

- **Issue #261** (2022-01-10): **Artifacts on 0-20% quality with screen recording**
  *Symptoms*: GIF: https://user-images.githubusercontent.com/170270/148274421-a1d41304-e418-45ea-b21c-69a45289afaf.gif  Source video: https://user-images.githubusercontent.com/170270/148274565-5ec81390-60fc-4eab-ad18-b2839deca842.mov  @kornelski Is there anything the gifski library can do about this?
  **Post-Mortem & Fix Analysis**:
  > I don't think it's a bug per se — it is working as designed. When you ask for low quality, you get frames limited to very few colors. MPEG compression adds changes all over the place, which requires redraw of a large area, which then is a mess, because it isn't allowed to use enough colors to redraw it nicely.  This case could have been handled better if I optimized specifically for it, but I never did. The quality option is documented as: "1-100, but useful range is 50-100" 
  > As a temporary fix, what do you think of making the "Quality" slider range be constrained to `0.2...1`?
  > Yes.

- **Issue #247** (2021-09-11): **End frames dropped if they're the same**
  *Symptoms*: Hi,  I have a video that shows an animation that comes to rest in a final state and the video shows that final state for 2-3 seconds. However, when this video is converted to a .gif, the final state is only shown for a single frame. I'd like the gif to be as long as the video without it truncating duplicate frames at the end.  Or at least give me a checkbox to allow me to preserve all the frames if this behaviour is an optimisation in the app.  Here is the source and output showing what I mean.  https://user-images.githubusercontent.com/2559953/124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mp4 https://user-images.githubusercontent.com/2559953/124855971-1a837c80-dfed-11eb-8f56-ead0898ec449.gif 
  **Post-Mortem & Fix Analysis**:
  > There's unfortunately a bug in macOS 11 where videos with few key frames fail to decode many frames. This is completely out of our control. We plan to move to a different way to generate the frames, but it's a lot of work, so will take some time: https://github.com/sindresorhus/Gifski/issues/229  A quick workaround is to export with a higher frame rate and use ProRes. If you cannot re-export, you could convert the video with a video converter app like [Permute](https://apps.apple.com/us/app/permute-3/id1444998321?mt=12).  I just tried converting the video you shared to ProRes and it then worked just fine with Gifski:  ![124855986-23744e00-dfed-11eb-8479-a275ef0da2e3 2](https://user-images.githubusercontent.com/170270/125160852-6aa73e00-e1a9-11eb-91ea-903b601f6646.gif)  [124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mov.zip](https://github.com/sindresorhus/Gifski/files/6795112/124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mov.zip)  ---  Apple bug report: https://github.com
  > This was fixed in Gifski v2.17.0: https://apps.apple.com/app/id1351639930

- **Issue #231** (2021-06-12): **Produces empty GIF for very short video**
  *Symptoms*: @kornelski https://github.com/sindresorhus/Gifski/pull/222 introduced an issue where this video produces an empty invalid file: [Short.mp4.zip](https://github.com/sindresorhus/Gifski/files/5950638/Short.mp4.zip)  Before this change:  ![Short](https://user-images.githubusercontent.com/170270/107351122-d30bc980-6afc-11eb-960f-a85488ab0673.gif)  After:  [Short.gif.zip](https://github.com/sindresorhus/Gifski/files/5950674/Short.gif.zip)  ---  I realize the video is way too short and weird, but we should never produce an invalid GIF. According to logging, it successfully generated 2 frames and passed them to libgifski.
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/ImageOptim/gifski/commit/2f62fbecf57430d3d5b88c817378b570be2c9740

- **Issue #202** (2021-01-22): **Failed to generate frame: Cannot Decode**
  *Symptoms*: macOS v.11.0 Beta (20A5364e) Gifski v.2.9.0 (39)  **Screenshot:** <img width="476" alt="Bildschirmfoto 2020-09-10 um 16 26 45" src="https://user-images.githubusercontent.com/62497891/92745237-7906ac80-f382-11ea-806b-99d2954212a0.png">  **Video recording:** [Bildschirmaufnahme 2020-09-10 um 16.18.34.zip](https://github.com/sindresorhus/Gifski/files/5202315/Bildschirmaufnahme.2020-09-10.um.16.18.34.zip) 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Are you able to reproduce it again if you convert with the exact same file and settings? What settings did you convert with (can you take a screenshot)? I was not able to reproduce this myself.
  > I've got the same error on a screen recording from Big Sur. I fails on a specific frame, every time. I can trim the problematic frame out of the animation, and it won't fail then.  (I didn't report, since I was going to investigate myself, but needed to update Xcode, and that took so long that I forgot about the original issue :D) 
  > @sindresorhus  This is a problem only on Big Sur.  Sometimes it freezes, i have to kill the process forcibly. But this rarely happens. [Test 1.zip](https://github.com/sindresorhus/Gifski/files/5214090/Test.1.zip) [Test 2.zip](https://github.com/sindresorhus/Gifski/files/5214091/Test.2.zip) 

- **Issue #186** (2020-04-06): **"Couldn't open file" when started recording & progress isn't reported correctly.**
  *Symptoms*: This is my workflow: 1. Run simulator recording ``` xcrun simctl io booted recordVideo "$1" ``` 1. Stop & open the file with Gifski 1. Tap convert  What happens is that most of the time I tap convert it says "Couldn't open file", I have to wait (or tap on buttons, not sure which one works) and it converts eventually. Also when it finally starts converting, the progress reported isn't entirely accurate since it finishes at about 50%.  There is no particular video that triggers that as it is consistently reproducible. I'm thinking if this has something to do with APFS?
  **Post-Mortem & Fix Analysis**:
  > > Also when it finally starts converting, the progress reported isn't entirely accurate since it finishes at about 50%.  This is caused by #187.
  > Fixture that reproduces the issue: [simulator-recording.mp4.zip](https://github.com/sindresorhus/Gifski/files/4435996/simulator-recording.mp4.zip)  I have looked into the problem and it turns out the problem is that the recording contains blank frames at the start. If you open the video in QuickTime and go to the start, you'll see that it's blank (black) for some milliseconds. This is IMHO a bug in `simctl`, but we should still work around it as there could be valid videos with blank frames at the start too.

- **Issue #170** (2026-04-30): **Improve time estimate accuracy**
  *Symptoms*: Moving issue from #111 as requested.  > The remaining time estimate is a bit off. Looking at the progress circle it looks like the remaining time should be pretty predictable as it seems like each percentage point takes roughly a constant amount of time to process. I think perhaps the time estimate should be recalculated after each percentage point with the following formula: ( ( 100 / number_of_percentage_points_so_far ) - 1 ) * time_elapsed_so_far.  > I've timed it and converting a video took ~40s for me over a ~60s estimate, nothing particularly off but for me the countdown seems to be counting down a little faster than it should.  > I've just tried converting a video with Gifski and at the point where the app said there were 40s left, after about ~60% of the video had been processed already, I started a stopwatch and when the app finished the stopwatch was at ~32s.  
  **Post-Mortem & Fix Analysis**:
  > // @allewun In case you have time and interest in looking into this. No worries if not though.
  > Seems to be the same formula?   ``` Old: (timeElapsed / percentComplete) * (1 - percentComplete) New: ((100 / percentagePointsComplete) - 1) * timeElapsed      timeElapsed => t     percentComplete => p     percentagePointsComplete => p*100  Old: (t/p) * (1-p)   = t/p - t New: ((100/(100*p)) - 1) * t   = t/p - t ``` 
  > > New: ((100/(100*p)) - 1) * t  There's an extra 100 there, I think it should instead be:  ``` New: ((100/p) - 1) * t   = 100t/p - t ```  But I'm not sure in both expressions `p` is the same number, like in mine I'm expecting it to be a number in the 0~100 range, while in the old formula it's probably a number in the 0~1 range or it wouldn't make a lot of sense, and I think this makes the two expressions effectively equivalent.  Given how the expressions are equivalent, and they seem rational, maybe the problem is somewhere else.  I don't have many ideas on how to tackle this, mainly because I'm not sure how the video -> gif conversion actually works, but maybe the issue is that different portions of the video get converted at different rates, and/or that the computer stars converting slower/faster at some point (maybe another CPU-heavy process gets spawned, maybe it hits thermal throttling or whatever), to which a possible improvement could be to extrapolate a conversion 

- **Issue #164** (2019-12-02): **Crashes when almost complete**
  *Symptoms*:  <!-- I got your error message "We have been trying to track down this issue for a long time, but we have been unable to reproduce it. It would be awesome if you could send an email to sindresorhus@gmail.com with the video or some information about the video file you tried to convert so we can fix this issue. Error Domain=AVFoundationErrorDomain Code=-11832 "Cannot Open" UserInfo={NSLocalizedFailureReason=This media cannot be used., NSLocalizedDescription=Cannot Open, NSUnderlyingError=0x600000454250 {Error Domain=NSOSStatusErrorDomain Code=-12431 "(null)"}}" --> So here is the video I'm trying to convert.  The video was taken with a Samsung phone running Android 4.4,; I have no idea if it matters?  Action taken was reduce to 25%, lowered the quality, FPS was 15.  The conversion stopped at 96% displayed.  My first video that failed was to large to email , so, I have made a shorter video that also failed with the same error message, for your reference the filename is Gifski.mp4: [Gifski.mp4.zip](https://github.com/sindresorhus/Gifski/files/3909493/Gifski.mp4.zip)   --- Gifski 2.3.0 (26) - com.sindresorhus.Gifski macOS 10.13.6 iMac10,1
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #119 
  > Thank you so much for sharing a video that reproduces the issue. I have been able to track down the issue and I'll fix it soon.

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

### Incident Patch 1: `b519c8ce` (2026-07-01)
**Commit Message**: Fix blank preview for screen recordings

Fixes #353

**File**: `Gifski.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +4/-4)
```diff
@@ -6,8 +6,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/sindresorhus/Defaults",
       "state" : {
-        "revision" : "5bfac4928f000fabdbef7e4ed0251399bb0841c9",
-        "version" : "9.0.8"
+        "revision" : "00a7465a0668a87fa159e779b9d80f1f9652357e",
+        "version" : "9.0.9"
       }
     },
     {
@@ -33,8 +33,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "2c420d31d0c31b525fa9e7c552ef0fc9d924befc",
-        "version" : "9.17.1"
+        "revision" : "d3562ee73e56a7b0b8319ec613db3c529924f07a",
+        "version" : "9.19.1"
       }
     },
     {
```

**File**: `Gifski/Components/TrimmingAVPlayer.swift` (modified, +29/-8)
```diff
@@ -388,6 +388,7 @@ final class TrimmingAVPlayerView: AVPlayerView {
 	private var timeRangeCancellable: AnyCancellable?
 	private var trimmingCancellable: AnyCancellable?
 	private var readyForDisplayCancellable: AnyCancellable?
+	private var checkerboardVideoBounds: CGRect?
 
 	/**
 	The minimum duration the trimmer can be set to.
@@ -398,6 +399,12 @@ final class TrimmingAVPlayerView: AVPlayerView {
 		print("TrimmingAVPlayerView - DEINIT")
 	}
 
+	override func layout() {
+		super.layout()
+
+		updateCheckerboardViewIfNeeded()
+	}
+
 	// TODO: This should be an AsyncSequence.
 	fileprivate func observeTrimmedTimeRange(_ updateClosure: @escaping (ClosedRange<Double>) -> Void) {
 		var skipNextUpdate = false
@@ -448,13 +455,11 @@ final class TrimmingAVPlayerView: AVPlayerView {
 	}
 
 	private func observeReadyForDisplay() {
-		// Wait for the video to be ready for display before adding the checkerboard,
-		// ensuring videoBounds is valid.
 		readyForDisplayCancellable = publisher(for: \.isReadyForDisplay)
 			.first(where: \.self)
 			.receive(on: DispatchQueue.main)
 			.sink { [weak self] _ in
-				self?.addCheckerboardView()
+				self?.updateCheckerboardViewIfNeeded()
 			}
 	}
 
@@ -523,16 +528,32 @@ final class TrimmingAVPlayerView: AVPlayerView {
 			}
 	}
 
-	fileprivate func addCheckerboardView() {
-		// Remove any existing checkerboard view to prevent stacking multiple on top of each other.
-		for subview in contentOverlayView?.subviews ?? [] where subview.identifier == Self.checkerboardViewIdentifier {
+	private func updateCheckerboardViewIfNeeded() {
+		guard let contentOverlayView else {
+			return
+		}
+
+		// Large videos can become ready before AVPlayer has computed `videoBounds`. Wait for a real rect so the checkerboard does not cover the whole player.
+		let clearRect = videoBounds
+		guard !clearRect.isEmpty else {
+			return
+		}
+
+		let existingCheckerboardViews = contentOverlayView.subviews.filter { $0.identifier == Self.checkerboardViewIdentifier }
+		let needsNewCheckerboardView = clearRect != checkerboardVideoBounds || existingCheckerboardViews.isEmpty
+		guard needsNewCheckerboardView else {
+			return
+		}
+
+		for subview in existingCheckerboardViews {
 			subview.removeFromSuperview()
 		}
 
-		let overlayView = NSHostingView(rootView: CheckerboardView(clearRect: videoBounds))
+		let overlayView = NSHostingView(rootView: CheckerboardView(clearRect: clearRect))
 		overlayView.identifier = Self.checkerboardViewIdentifier
-		contentOverlayView?.addSubview(overlayView)
+		contentOverlayView.addSubview(overlayView)
 		overlayView.constrainEdgesToSuperview()
+		checkerboardVideoBounds = clearRect
 	}
 
 	private static let checkerboardViewIdentifier = NSUserInterfaceItemIdentifier("CheckerboardView")
```

---

### Incident Patch 2: `a1ce47f4` (2026-06-13)
**Commit Message**: Fix window drop not triggering the file-access permission prompt

**File**: `Gifski/MainScreen.swift` (modified, +21/-3)
```diff
@@ -49,12 +49,30 @@ struct MainScreen: View {
 					$0.hasFileURLs
 				},
 				onPerform: {
-					// Validate that the dropped file is a movie before `AppState.start(_:)` resets navigation for the new import.
-					guard let url = $0.firstMovieFileURL else {
+					// Validate synchronously that the dropped file is a movie before `AppState.start(_:)` resets navigation for the new import.
+					guard $0.firstMovieFileURL != nil else {
 						return false
 					}
 
-					appState.start(url)
+					/*
+					IMPORTANT: Open the URL from the item provider, not from `firstMovieFileURL`/the drag pasteboard.
+
+					`NSItemProvider.getURL()` goes through the sandbox broker (Powerbox), which vends a security-scoped URL and shows the macOS file-access permission prompt (e.g. for the Downloads/Desktop folder) when needed. Reading the URL directly from the drag pasteboard returns a plain `file://` URL that bypasses the broker, so the app is never granted access, the prompt never appears, and the open silently fails. We use the pasteboard read above only for synchronous movie-type validation, never to actually open the file.
+
+					Do not "simplify" this back to opening `firstMovieFileURL` directly. That regressed window drops in 3.0.x.
+					*/
+					guard let itemProvider = $0.itemProviders(for: [.fileURL]).first else {
+						return false
+					}
+
+					Task {
+						guard let url = await itemProvider.getURL() else {
+							return
+						}
+
+						appState.start(url)
+					}
+
 					return true
 				}
 			)
```

**File**: `Gifski/Utilities.swift` (modified, +2/-0)
```diff
@@ -5379,6 +5379,8 @@ extension DropInfo {
 
 	/**
 	The first file URL in the current drag operation that looks like a movie.
+
+	- Important: This reads directly from the drag pasteboard, which returns a plain `file://` URL that bypasses the sandbox broker. Use it only for synchronous validation, never to actually open the file. Opening it would skip the file-access permission prompt and silently fail. To open a dropped file, resolve the URL via `NSItemProvider.getURL()` instead.
 	*/
 	var firstMovieFileURL: URL? {
 		fileURLs().first {
```

---

### Incident Patch 3: `55e9a26d` (2026-06-11)
**Commit Message**: Fix alpha channel being lost when converting transparent videos

The sequential frame reader introduced for performance drove frames through AVFoundation's built-in video compositor, which flattens the alpha channel to opaque. This lost transparency from alpha-capable sources like ProRes 4444. Replace it with a Core Image based compositor that crops, scales, and orients while preserving alpha.

**File**: `Gifski/ExportModifiedVideo.swift` (modified, +45/-26)
```diff
@@ -16,7 +16,7 @@ struct ExportModifiedVideoView: View {
 			}
 			.fileExporter(
 				isPresented: isFileExporterPresented,
-				item: exportableMP4,
+				item: exportableModifiedVideo,
 				defaultFilename: defaultExportModifiedFileName
 			) {
 				do {
@@ -36,15 +36,13 @@ struct ExportModifiedVideoView: View {
 			)
 	}
 
-	private var exportableMP4: ExportableMP4? {
-		guard case let .finished(url) = state else {
-			return nil
-		}
-		return ExportableMP4(url: url)
+	private var exportableModifiedVideo: ExportableModifiedVideo? {
+		state.finishedURL.map(ExportableModifiedVideo.init)
 	}
 
 	private var defaultExportModifiedFileName: String {
-		"\(sourceURL.filenameWithoutExtension) modified.mp4"
+		let fileExtension = state.finishedURL?.pathExtension ?? "mp4"
+		return "\(sourceURL.filenameWithoutExtension) modified.\(fileExtension)"
 	}
 
 	private var isProgressSheetPresented: Binding<Bool> {
@@ -75,7 +73,7 @@ struct ExportModifiedVideoView: View {
 			set: {
 				guard
 					!$0,
-					case let .finished(url) = state else {
+					let url = state.finishedURL else {
 					return
 				}
 				try? url.delete()
@@ -143,6 +141,14 @@ extension ExportModifiedVideoState {
 		}
 	}
 
+	var finishedURL: URL? {
+		guard case let .finished(url) = self else {
+			return nil
+		}
+
+		return url
+	}
+
 	/**
 	Update progress sheet visibility if the state is currently exporting.
 	- Returns: Whether the state is still exporting.
@@ -162,34 +168,43 @@ extension ExportModifiedVideoState {
 }
 
 /**
-Convert a source video to an `.mp4` using the same scale, speed, and crop as the exported `.gif`.
+Convert a source video using the same scale, speed, and crop as the exported `.gif`.
+
+Alpha-capable sources (for example, ProRes 4444) are exported as HEVC with alpha in a `.mov` to preserve transparency. Everything else is exported as an `.mp4`.
 - Returns: Temporary URL of the exported video.
 */
 func exportModifiedVideo(conversion: GIFGenerator.Conversion) async throws -> URL {
 	let (composition, compositionVideoTrack, sourceVideoTrack) = try await createComposition(
 		conversion: conversion
 	)
+
+	let hasAlpha = try await sourceVideoTrack.hasAlphaChannel
+	let preset = hasAlpha ? AVAssetExportPresetHEVCHighestQualityWithAlpha : AVAssetExportPresetHighestQuality
+	let fileType: AVFileType = hasAlpha ? .mov : .mp4
+	let fileExtension = hasAlpha ? "mov" : "mp4"
+
 	let videoComposition = try await createVideoComposition(
 		compositionVideoTrack: compositionVideoTrack,
 		sourceVideoTrack: sourceVideoTrack,
-		conversion: conversion
+		conversion: conversion,
+		preservingAlpha: hasAlpha
 	)
-	let outputURL = URL.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
+	let outputURL = URL.temporaryDirectory.appending(path: "\(UUID().uuidString).\(fileExtension)")
 
 	let presets = AVAssetExportSession.allExportPresets()
-	guard presets.contains(AVAssetExportPresetHighestQuality) else {
+	guard presets.contains(preset) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
-	guard await AVAssetExportSession.compatibility(ofExportPreset: AVAssetExportPresetHighestQuality, with: composition, outputFileType: .mp4) else {
+	guard await AVAssetExportSession.compatibility(ofExportPreset: preset, with: composition, outputFileType: fileType) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
 
-	guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
+	guard let exportSession = AVAssetExportSession(asset: composition, presetName: preset) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
 	exportSession.shouldOptimizeForNetworkUse = true
 	exportSession.videoComposition = videoComposition
-	try await exportSession.export(to: outputURL, as: .mp4)
+	try await exportSession.export(to: outputURL, as: fileType)
 	return outputURL
 }
 
@@ -213,27 +228,30 @@ private func createComposition(
 		of: videoT
```

**File**: `Gifski/GIFGenerator.swift` (modified, +151/-14)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import CoreImage
 import VideoToolbox
 @preconcurrency import AVFoundation
 
@@ -301,7 +302,6 @@ actor GIFGenerator {
 		let output = try await makeFrameReaderOutput(
 			conversion: conversion,
 			videoTrack: firstVideoTrack,
-			videoTrackRange: videoTrackRange,
 			frameDuration: frameDuration
 		)
 
@@ -317,19 +317,15 @@ actor GIFGenerator {
 	private func makeFrameReaderOutput(
 		conversion: Conversion,
 		videoTrack: AVAssetTrack,
-		videoTrackRange: ClosedRange<Double>,
 		frameDuration: CMTime
 	) async throws -> AVAssetReaderVideoCompositionOutput {
 		let output = AVAssetReaderVideoCompositionOutput(
 			videoTracks: [videoTrack],
-			videoSettings: [
-				kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-			]
+			videoSettings: CVPixelBuffer.bgra32Attributes
 		)
 		output.alwaysCopiesSampleData = false
-		output.videoComposition = try await conversion.videoComposition(
+		output.videoComposition = try await conversion.alphaPreservingVideoComposition(
 			for: videoTrack,
-			timeRange: videoTrackRange.cmTimeRange,
 			frameDuration: frameDuration
 		)
 
@@ -669,12 +665,19 @@ extension GIFGenerator.Conversion {
 		)
 	}
 
+	/**
+	The crop to apply, falling back to the full frame when none is set.
+	*/
+	var resolvedCrop: CropRect {
+		crop ?? .initial
+	}
+
 	/**
 	- Returns: Crop rect in pixels, if there is no crop rect then it returns the full render size.
 	*/
 	var cropRectInPixels: CGRect {
 		get async throws {
-			(crop ?? .initial).unnormalize(forDimensions: try await renderSize)
+			resolvedCrop.unnormalize(forDimensions: try await renderSize)
 		}
 	}
 
@@ -701,14 +704,59 @@ extension GIFGenerator.Conversion {
 		naturalSize: CGSize,
 		preferredTransform: CGAffineTransform
 	) -> CGRect {
-		let rotatedSize = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform).size
-		let rotatedDimensions = CGSize(width: abs(rotatedSize.width), height: abs(rotatedSize.height))
+		let rotatedDimensions = naturalSize.applyingAbsolute(preferredTransform)
 
-		let cropRectInRotatedSpace = (crop ?? .initial).unnormalize(forDimensions: rotatedDimensions)
+		let cropRectInRotatedSpace = resolvedCrop.unnormalize(forDimensions: rotatedDimensions)
 
 		return cropRectInRotatedSpace.applying(preferredTransform.inverted())
 	}
 
+	/**
+	Loads `videoTrack`'s natural size together with the effective preferred transform — the `trackPreferredTransform` override when set, otherwise the track's own.
+	*/
+	func geometry(for videoTrack: AVAssetTrack) async throws -> (naturalSize: CGSize, preferredTransform: CGAffineTransform) {
+		let (naturalSize, loadedPreferredTransform) = try await videoTrack.load(.naturalSize, .preferredTransform)
+		return (naturalSize, trackPreferredTransform ?? loadedPreferredTransform)
+	}
+
+	/**
+	Creates an `AVVideoComposition` that crops, scales, and orients the source to this conversion's output settings while preserving the source's alpha channel. `geometryTrack` lets export apply the source track's natural size and orientation while reading frames from an `AVMutableCompositionTrack`.
+
+	The built-in `AVVideoComposition` compositor (used by `videoComposition(for:…)`) flattens the alpha channel to opaque, which loses transparency from alpha-capable sources like ProRes 4444. The Core Image based `AlphaPreservingCompositor` preserves it.
+	*/
+	func alphaPreservingVideoComposition(
+		for videoTrack: AVAssetTrack,
+		usingGeometryOf geometryTrack: AVAssetTrack? = nil,
+		frameDuration: CMTime
+	) async throws -> AVVideoComposition {
+		let (naturalSize, preferredTransform) = try await geometry(for: geometryTrack ?? videoTrack)
+		// Pad the instruction's range by one frame so a final frame landing on the track boundary is still covered.
+		let loadedTimeRange = try await videoTrack.load(.timeRange)
+		let timeRange = CMTimeRange(start: loadedTimeRange.start, duration: loadedTimeRange.duration + frameDuration)
+
+		let displaySize = na
```

**File**: `Gifski/Preview/PreviewVideoCompositor.swift` (modified, +2/-6)
```diff
@@ -96,13 +96,9 @@ final class PreviewVideoCompositor: NSObject, AVVideoCompositing {
 	}
 
 	// swiftlint:disable:next discouraged_optional_collection
-	let sourcePixelBufferAttributes: [String: any Sendable]? = [
-		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-	]
+	let sourcePixelBufferAttributes: [String: any Sendable]? = CVPixelBuffer.bgra32Attributes
 
-	let requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = [
-		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-	]
+	let requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = CVPixelBuffer.bgra32Attributes
 
 	func cancelAllPendingVideoCompositionRequests() {
 		pendingRequestTaskStore.cancelAll()
```

**File**: `Gifski/Utilities.swift` (modified, +32/-2)
```diff
@@ -661,8 +661,7 @@ extension AVAssetTrack {
 				return nil
 			}
 
-			let size = naturalSize.applying(preferredTransform)
-			let preferredSize = CGSize(width: abs(size.width), height: abs(size.height))
+			let preferredSize = naturalSize.applyingAbsolute(preferredTransform)
 
 			// Workaround for https://github.com/sindresorhus/gifski-app/issues/76
 			guard preferredSize != .zero else {
@@ -731,6 +730,20 @@ extension AVAssetTrack {
 		}
 	}
 
+	/**
+	Whether the track's video format declares an alpha channel (for example, ProRes 4444 or HEVC with alpha).
+	*/
+	var hasAlphaChannel: Bool {
+		get async throws {
+			guard let formatDescription = try await load(.formatDescriptions).first else {
+				return false
+			}
+
+			let value = CMFormatDescriptionGetExtension(formatDescription, extensionKey: kCMFormatDescriptionExtension_ContainsAlphaChannel)
+			return (value as? NSNumber)?.boolValue ?? false
+		}
+	}
+
 	/**
 	Returns a debug string with the media format.
 
@@ -2042,6 +2055,16 @@ extension CGSize {
 
 	var cgRect: CGRect { .init(origin: .zero, size: self) }
 
+	/**
+	Returns the size after applying `transform`, with negative dimensions from rotations or flips normalized to positive.
+
+	For example, applying a video track's `preferredTransform` to its natural size yields the display (oriented) size.
+	*/
+	func applyingAbsolute(_ transform: CGAffineTransform) -> Self {
+		let transformed = applying(transform)
+		return Self(width: abs(transformed.width), height: abs(transformed.height))
+	}
+
 	var longestSide: Double { max(width, height) }
 
 	var aspectRatio: Double { width / height }
@@ -5721,6 +5744,13 @@ extension Color {
 
 
 extension CVPixelBuffer {
+	/**
+	Pixel buffer attributes requesting the 32-bit BGRA format used by our video compositors and readers.
+	*/
+	static let bgra32Attributes: [String: any Sendable] = [
+		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
+	]
+
 	var planeCount: Int {
 		CVPixelBufferGetPlaneCount(self)
 	}
```

**File**: `Tests/Tests.swift` (modified, +132/-1)
```diff
@@ -95,6 +95,7 @@ struct Tests {
 
 	private func makeTestVideo(
 		frameCount: Int,
+		codec: AVVideoCodecType = .h264,
 		pixelBufferForFrame: (Int) throws -> CVPixelBuffer
 	) async throws -> URL {
 		let directory = try URL.uniqueTemporaryDirectory()
@@ -103,7 +104,7 @@ struct Tests {
 		let input = AVAssetWriterInput(
 			mediaType: .video,
 			outputSettings: [
-				AVVideoCodecKey: AVVideoCodecType.h264,
+				AVVideoCodecKey: codec,
 				AVVideoWidthKey: 16,
 				AVVideoHeightKey: 16
 			]
@@ -210,6 +211,76 @@ struct Tests {
 		return pixelBuffer
 	}
 
+	/**
+	Left half opaque red, right half fully transparent.
+	*/
+	private func makeTransparentPixelBuffer() throws -> CVPixelBuffer {
+		var newPixelBuffer: CVPixelBuffer?
+		let status = CVPixelBufferCreate(
+			nil,
+			16,
+			16,
+			kCVPixelFormatType_32BGRA,
+			nil,
+			&newPixelBuffer
+		)
+		try #require(status == kCVReturnSuccess)
+		let pixelBuffer = try #require(newPixelBuffer)
+
+		CVPixelBufferLockBaseAddress(pixelBuffer, [])
+		defer {
+			CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
+		}
+
+		guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
+			throw "Could not access pixel buffer storage.".toError
+		}
+
+		let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
+		let height = CVPixelBufferGetHeight(pixelBuffer)
+		let width = CVPixelBufferGetWidth(pixelBuffer)
+		let buffer = baseAddress.bindMemory(to: UInt8.self, capacity: bytesPerRow * height)
+
+		for y in 0..<height {
+			for x in 0..<width {
+				let offset = (y * bytesPerRow) + (x * 4)
+				let isOpaque = x < width / 2
+				buffer[offset] = 0 // Blue
+				buffer[offset + 1] = 0 // Green
+				buffer[offset + 2] = isOpaque ? 255 : 0 // Red
+				buffer[offset + 3] = isOpaque ? 255 : 0 // Alpha
+			}
+		}
+
+		return pixelBuffer
+	}
+
+	private func transparentPixelCount(gifData: Data, frameIndex: Int) throws -> Int {
+		let imageSource = try #require(CGImageSourceCreateWithData(gifData as CFData, nil))
+		let image = try #require(CGImageSourceCreateImageAtIndex(imageSource, frameIndex, nil))
+		let width = image.width
+		let height = image.height
+		var pixels = [UInt8](repeating: 0, count: width * height * 4)
+		let context = try #require(CGContext(
+			data: &pixels,
+			width: width,
+			height: height,
+			bitsPerComponent: 8,
+			bytesPerRow: width * 4,
+			space: CGColorSpaceCreateDeviceRGB(),
+			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+		))
+
+		context.draw(image, in: .init(x: 0, y: 0, width: Double(width), height: Double(height)))
+
+		var count = 0
+		for offset in stride(from: 3, to: pixels.count, by: 4) where pixels[offset] == 0 {
+			count += 1
+		}
+
+		return count
+	}
+
 	private func makeHorizontalSplitCGImage() throws -> CGImage {
 		let pixelBuffer = try makeHorizontalSplitPixelBuffer()
 		var cgImage: CGImage?
@@ -641,6 +712,36 @@ struct Tests {
 		#expect(try averageRedValue(gifData: rightCropData, frameIndex: 0) < 50)
 	}
 
+	@Test
+	func gifGenerationPreservesAlphaFromProRes4444Source() async throws {
+		let videoURL = try await makeTestVideo(frameCount: 3, codec: .proRes4444) { _ in
+			try makeTransparentPixelBuffer()
+		}
+		defer {
+			try? videoURL.deletingLastPathComponent().delete()
+		}
+
+		let data = try await GIFGenerator.run(
+			.init(
+				asset: AVURLAsset(url: videoURL),
+				sourceURL: videoURL,
+				timeRange: 0...1,
+				quality: 0.8,
+				dimensions: (width: 16, height: 16),
+				frameRate: 2,
+				loop: .never,
+				bounce: false
+			)
+		) { _ in }
+
+		#expect(data.starts(with: Data("GIF".utf8)))
+
+		// The transparent right half of the ProRes 4444 source (128 of the 256 pixels) must survive as transparency in the GIF. The built-in video compositor flattened it to opaque, which is the bug this guards against. The bounds bracket the expected ~128 while allowing slight quantization slack.
+		let transparentCount = try transparentPixelCount(gifData: data, frameIndex: 0)
+		#expect(transparentCount > 96)
+		#exp
```

---

### Incident Patch 4: `93177b0f` (2026-01-07)
**Commit Message**: Clean up and fix video rotation handling

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -102,6 +102,7 @@
 		E3908B7326754568000723A7 /* EstimatedFileSize.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EstimatedFileSize.swift; sourceTree = "<group>"; };
 		E3961F7F2AC9F2A700708EB7 /* Intents.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Intents.swift; sourceTree = "<group>"; };
 		E3A6BD102245345C00F62256 /* Constants.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; lineEnding = 0; path = Constants.swift; sourceTree = "<group>"; usesTabs = 1; };
+		E3ACE84E2F0EC74C004F95CC /* maintaining.md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = maintaining.md; sourceTree = "<group>"; };
 		E3AE62831E5CD2F300035A2F /* Gifski.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Gifski.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		E3AE62861E5CD2F300035A2F /* App.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; lineEnding = 0; path = App.swift; sourceTree = "<group>"; usesTabs = 1; };
 		E3AE62881E5CD2F300035A2F /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
@@ -200,6 +201,7 @@
 		E3AE627A1E5CD2F300035A2F = {
 			isa = PBXGroup;
 			children = (
+				E3ACE84E2F0EC74C004F95CC /* maintaining.md */,
 				E3805F542466E68900489E6C /* Config.xcconfig */,
 				E3AE62851E5CD2F300035A2F /* Gifski */,
 				0E79251C2329BDBE00058B94 /* Share Extension */,
```

**File**: `Gifski/Components/TrimmingAVPlayer.swift` (modified, +14/-5)
```diff
@@ -34,9 +34,10 @@ struct TrimmingAVPlayer: NSViewControllerRepresentable {
 			nsViewController.currentItem = item
 		}
 
-		if updatePreviewState(nsViewController) {
-			forceAVPlayerToRedraw(item: nsViewController.currentItem)
-		}
+		// Always update video composition based on preview state.
+		// When preview is ON, use custom compositor. When OFF, clear it so AVPlayer handles rotation.
+		forceAVPlayerToRedraw(item: nsViewController.currentItem)
+		_ = updatePreviewState(nsViewController)
 
 		nsViewController.loopPlayback = loopPlayback
 		nsViewController.bouncePlayback = bouncePlayback
@@ -76,14 +77,22 @@ struct TrimmingAVPlayer: NSViewControllerRepresentable {
 	}
 
 	/**
-	Resets the item's video composition, forcing a redraw.
+	Sets or clears the video composition based on preview state.
+
+	When preview is OFF, we don't use the custom compositor so AVPlayer handles rotation via `preferredTransform` normally.
+	When preview is ON, we use the custom compositor which renders the preview overlay.
 	*/
 	func forceAVPlayerToRedraw(item: AVPlayerItem) {
 		guard let assetVideoComposition = (asset as? PreviewableComposition)?.videoComposition else {
 			return
 		}
 
-		item.videoComposition = assetVideoComposition.mutableCopy() as? AVMutableVideoComposition
+		if shouldShowPreview {
+			item.videoComposition = assetVideoComposition.mutableCopy() as? AVMutableVideoComposition
+		} else {
+			// Clear video composition so AVPlayer handles rotation normally.
+			item.videoComposition = nil
+		}
 	}
 }
 
```

**File**: `Gifski/Crop/CropSettings.swift` (modified, +7/-12)
```diff
@@ -23,21 +23,16 @@ extension CropSettings {
 		return image.cropping(to: transformedCrop)
 	}
 
-	func unnormalizedCropRect(sizeInPreferredTransformationSpace preferredSize: CGSize) -> CGRect {
-		guard let trackPreferredTransform else {
-			guard let cropRect = crop else {
-				return .init(origin: .zero, size: preferredSize)
-			}
-			return cropRect.unnormalize(forDimensions: preferredSize)
-		}
+	/**
+	Returns the unnormalized crop rect for an image that is already in the preferred transform space (i.e., already rotated).
 
-		let originalSize = CGRect(origin: .zero, size: preferredSize)
-			.applying(trackPreferredTransform.inverted()).size
+	Since `AVAssetImageGenerator.appliesPreferredTrackTransform = true` and the preview manually applies the transform, images are always pre-rotated. The crop rect (which is defined in rotated space via the UI) can be applied directly.
+	*/
+	func unnormalizedCropRect(sizeInPreferredTransformationSpace preferredSize: CGSize) -> CGRect {
 		guard let cropRect = crop else {
-			return .init(origin: .zero, size: originalSize).applying(trackPreferredTransform)
+			return .init(origin: .zero, size: preferredSize)
 		}
-		let originalCropSize = cropRect.unnormalize(forDimensions: originalSize)
-		return originalCropSize.applying(trackPreferredTransform)
+		return cropRect.unnormalize(forDimensions: preferredSize)
 	}
 
 	var croppedOutputDimensions: (width: Int, height: Int)? {
```

**File**: `Gifski/EditScreen.swift` (modified, +2/-9)
```diff
@@ -377,8 +377,7 @@ private struct _EditScreen: View {
 	}
 
 	private var conversionSettings: GIFGenerator.Conversion {
-		print("resizableDimensions:", resizableDimensions.pixels, resizableDimensions.percent)
-		return .init(
+		.init(
 			asset: modifiedAsset,
 			sourceURL: url,
 			timeRange: timeRange,
@@ -571,7 +570,6 @@ private struct DimensionsSetting: View {
 			.labelsHidden()
 		}
 		.onAppear {
-			print("EDIT SCREEN - onappear")
 			setUpDimensions()
 			updateTextFieldsForCurrentDimensions()
 			showArrowKeyTipIfNeeded()
@@ -653,10 +651,8 @@ private struct DimensionsSetting: View {
 	}
 
 	private func applyWidth() {
-		print("widthMinMax", resizableDimensions.widthMinMax)
 		resizableDimensions = resizableDimensions.aspectResized(usingWidth: width.toDouble)
 		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
-		print("widthMinMax2", resizableDimensions.widthMinMax)
 	}
 
 	private func applyHeight() {
@@ -667,18 +663,15 @@ private struct DimensionsSetting: View {
 
 	private func applyPercent() {
 		resizableDimensions = .percent(percent.toDouble / 100, originalSize: videoDimensions)
-		print("GGG", resizableDimensions)
 		width = resizableDimensions.pixels.width.toDouble.clamped(to: resizableDimensions.widthMinMax).toIntAndClampingIfNeeded
 		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
-		print("GGG2", percent, width, height)
 		selectPredefinedSizeBasedOnCurrentDimensions(forceCustom: true)
 	}
 
 	private func updateTextFieldsForCurrentDimensions() {
 		width = resizableDimensions.pixels.width.toDouble.clamped(to: resizableDimensions.widthMinMax).toIntAndClampingIfNeeded
-				height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
+		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
 		percent = (resizableDimensions.percent * 100).rounded().toIntAndClampingIfNeeded
-		print("FF", resizableDimensions.percent.toIntAndClampingIfNeeded)
 		selectPredefinedSizeBasedOnCurrentDimensions()
 	}
 
```

**File**: `Gifski/ExportModifiedVideo.swift` (modified, +6/-2)
```diff
@@ -74,7 +74,7 @@ struct ExportModifiedVideoView: View {
 			get: { state.isFinished && !isAudioWarningPresented },
 			set: {
 				guard
-					$0,
+					!$0,
 					case let .finished(url) = state else {
 					return
 				}
@@ -220,12 +220,16 @@ private func createVideoComposition(
 	instruction.timeRange = CMTimeRange(start: .zero, duration: .init(seconds: try await conversion.videoWithoutBounceDuration.toTimeInterval + 1.0, preferredTimescale: .video))
 
 	let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideoTrack)
+
+	// Layer instructions operate in natural space (unrotated). The crop rect from UI is in
+	// preferred space, so `cropRectAppliedToNaturalSize` transforms it back to natural space.
 	let cropRectAppliedToNaturalSize = try await conversion.cropRectAppliedToNaturalSize
 	let preferredTransform = conversion.trackPreferredTransform ?? .identity
 	let scaleTransform = CGAffineTransform(scaledBy: try await conversion.scale)
 	let scaledCropRect = cropRectAppliedToNaturalSize.applying(scaleTransform)
 	let cropRectAfterPreferred = scaledCropRect.applying(preferredTransform)
-	// now let's place the crop rect in the top left corner
+
+	// Place the crop rect in the top left corner.
 	let translateTransform = CGAffineTransform(translationX: -cropRectAfterPreferred.minX, y: -cropRectAfterPreferred.minY)
 	layerInstruction.setCropRectangle(cropRectAppliedToNaturalSize, at: .zero)
 	layerInstruction.setTransform(scaleTransform.concatenating(preferredTransform).concatenating(translateTransform), at: .zero)
```

---

### Incident Patch 5: `f298f53b` (2025-07-08)
**Commit Message**: Fix frame flash on bounce (#341)

**File**: `Gifski/GIFGenerator.swift` (modified, +8/-5)
```diff
@@ -180,11 +180,14 @@ actor GIFGenerator {
 					let timestampSlippage = actualTime - requestedTime
 					let actualReverseTimestamp = max(0, expectedReverseTimestamp + timestampSlippage.seconds)
 
-					try gifski?.addFrame(
-						image,
-						frameNumber: reverseFrameNumber,
-						presentationTimestamp: actualReverseTimestamp
-					)
+					// Prevent duplicate frame with the same frame number causing an unwanted frame at the end of the GIF.
+					if frameNumber != reverseFrameNumber {
+						try gifski?.addFrame(
+							image,
+							frameNumber: reverseFrameNumber,
+							presentationTimestamp: actualReverseTimestamp
+						)
+					}
 				}
 
 				index += 1
```

---

### Incident Patch 6: `dafe075e` (2025-05-27)
**Commit Message**: Fix App Groups identifier

**File**: `Gifski/AppState.swift` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ final class AppState {
 
 		guard
 			let path = url.queryDictionary["path"],
-			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.videoShareGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
+			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.appGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
 		else {
 			NSAlert.showModal(
 				for: SSApp.swiftUIMainWindow,
```

**File**: `Gifski/Gifski.entitlements` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 	<true/>
 	<key>com.apple.security.application-groups</key>
 	<array>
-		<string>$(TeamIdentifierPrefix)gifski_video_share_group</string>
+		<string>group.com.sindresorhus.Gifski</string>
 	</array>
 	<key>com.apple.security.files.user-selected.read-write</key>
 	<true/>
```

**File**: `Gifski/Info.plist` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>AppIdentifierPrefix</key>
-	<string>$(AppIdentifierPrefix)</string>
 	<key>CFBundleDocumentTypes</key>
 	<array>
 		<dict>
```

**File**: `Gifski/Shared.swift` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 import Foundation
 
 enum Shared {
-	static let appIdentifierPrefix = Bundle.main.infoDictionary!["AppIdentifierPrefix"] as! String
-	static let videoShareGroupIdentifier = "\(appIdentifierPrefix)gifski_video_share_group"
+	static let appGroupIdentifier = "group.com.sindresorhus.Gifski"
 }
```

**File**: `Share Extension/Info.plist` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>AppIdentifierPrefix</key>
-	<string>$(AppIdentifierPrefix)</string>
 	<key>ITSAppUsesNonExemptEncryption</key>
 	<false/>
 	<key>NSExtension</key>
```

---

### Incident Patch 7: `db66ef11` (2023-02-21)
**Commit Message**: Log Rust crash error output to Crashlytics

**File**: `Gifski/Gifski.swift` (modified, +5/-0)
```diff
@@ -1,4 +1,5 @@
 import Cocoa
+import FirebaseCrashlytics
 
 final class Gifski {
 	enum Loop {
@@ -49,6 +50,10 @@ final class Gifski {
 
 		self.wrapper = wrapper
 
+		wrapper.setErrorMessageCallback {
+			Crashlytics.crashlytics().log($0)
+		}
+
 		wrapper.setProgressCallback { [weak self] in
 			guard let self else {
 				return 0
```

**File**: `Gifski/GifskiWrapper.swift` (modified, +26/-0)
```diff
@@ -8,12 +8,14 @@ final class GifskiWrapper {
 		case rgb
 	}
 
+	typealias ErrorMessageCallback = (String) -> Void
 	typealias ProgressCallback = () -> Int
 	typealias WriteCallback = (Int, UnsafePointer<UInt8>) -> Int
 
 	private let pointer: OpaquePointer
 	private var unmanagedSelf: Unmanaged<GifskiWrapper>!
 	private var hasFinished = false
+	private var errorMessageCallback: ErrorMessageCallback!
 	private var progressCallback: ProgressCallback!
 	private var writeCallback: WriteCallback!
 
@@ -38,6 +40,30 @@ final class GifskiWrapper {
 		}
 	}
 
+	func setErrorMessageCallback(_ callback: @escaping ErrorMessageCallback) {
+		guard !hasFinished else {
+			return
+		}
+
+		errorMessageCallback = callback
+
+		gifski_set_error_message_callback(
+			pointer,
+			{ message, context in // swiftlint:disable:this opening_brace
+				guard
+					let message,
+					let context
+				else {
+					return
+				}
+
+				let this = Unmanaged<GifskiWrapper>.fromOpaque(context).takeUnretainedValue()
+				this.errorMessageCallback(String(cString: message))
+			},
+			unmanagedSelf.toOpaque()
+		)
+	}
+
 	func setProgressCallback(_ callback: @escaping ProgressCallback) {
 		guard !hasFinished else {
 			return
```

---

### Incident Patch 8: `204b7602` (2022-12-01)
**Commit Message**: Fix running SwiftLint when installed from Homebrew (#283)

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +1/-2)
```diff
@@ -438,8 +438,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "swiftlint\n";
-			showEnvVarsInLog = 0;
+			shellScript = "PATH=\"/opt/homebrew/bin/:${PATH}\"\nswiftlint\n";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 9: `6479e7c3` (2022-08-08)
**Commit Message**: Fix green line sometimes occurring on the GIF (#278)

**File**: `Gifski/Gifski.swift` (modified, +1/-4)
```diff
@@ -295,10 +295,7 @@ final class Gifski {
 		generator.requestedTimeToleranceBefore = .zero
 		generator.requestedTimeToleranceAfter = .zero
 
-		// This improves the performance a little bit.
-		if let dimensions = conversion.dimensions {
-			generator.maximumSize = CGSize(widthHeight: dimensions.longestSide)
-		}
+		// We are intentionally not setting a `generator.maximumSize` as it's buggy: https://github.com/sindresorhus/Gifski/pull/278
 
 		// Even though we enforce a minimum of 3 FPS in the GUI, a source video could have lower FPS, and we should allow that.
 		var fps = (conversion.frameRate.map(Double.init) ?? assetFrameRate).clamped(to: 0.1...Constants.allowedFrameRate.upperBound)
```

---

### Incident Patch 10: `eeaa53c9` (2022-01-19)
**Commit Message**: Fix encoding of transparency

**File**: `gifski-api/Cargo.lock` (modified, +8/-7)
```diff
@@ -297,7 +297,7 @@ dependencies = [
 
 [[package]]
 name = "gifski"
-version = "1.6.3"
+version = "1.6.4"
 dependencies = [
  "clap",
  "crossbeam-channel",
@@ -343,13 +343,14 @@ dependencies = [
 
 [[package]]
 name = "imagequant"
-version = "4.0.0-beta.6"
+version = "4.0.0-beta.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a19e402b08669aee84b5df80b754856aad91d1301e72435c767eab689b289121"
+checksum = "6fbd720ffd79390df8aaf8d83d290d461f3e31f9b42f3eb49b156e05bc1e6d6e"
 dependencies = [
  "arrayvec",
  "fallible_collections",
  "noisy_float",
+ "once_cell",
  "rayon",
  "rgb",
  "thread_local",
@@ -391,9 +392,9 @@ dependencies = [
 
 [[package]]
 name = "lodepng"
-version = "3.4.7"
+version = "3.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "24844d5c0b922ddd52fb5bf0964a4c7f8e799a946ec01bb463771eb04fc1a323"
+checksum = "ee9bfa86cc28550f1e0f6a23ae4f4811aaec527be710b313f78cf33982cefdc3"
 dependencies = [
  "fallible_collections",
  "flate2",
@@ -667,9 +668,9 @@ checksum = "49874b5167b65d7193b8aba1567f5c7d93d001cafc34600cee003eda787e483f"
 
 [[package]]
 name = "wasi"
-version = "0.10.2+wasi-snapshot-preview1"
+version = "0.10.3+wasi-snapshot-preview1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fd6fbd9a79829dd1ad0cc20627bf1ed606756a7f77edff7b66b7064f9cb327c6"
+checksum = "46a2e384a3f170b0c7543787a91411175b71afd56ba4d3a0ae5678d4e2243c0e"
 
 [[package]]
 name = "weezl"
```

**File**: `gifski-api/Cargo.toml` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@ license = "AGPL-3.0+"
 name = "gifski"
 readme = "README.md"
 repository = "https://github.com/ImageOptim/gifski"
-version = "1.6.3"
+version = "1.6.4"
 autobins = false
 edition = "2018"
 
@@ -23,9 +23,9 @@ gifsicle = { version = "1.92.5", optional = true }
 clap = "2.34.0"
 gif = "0.11.3"
 gif-dispose = "3.1.1"
-imagequant = "4.0.0-beta.6"
+imagequant = "4.0.0-beta.7"
 imgref = "1.9.1"
-lodepng = "3.4.7"
+lodepng = "3.5.0"
 pbr = "1.0.4"
 resize = "0.7.2"
 rgb = "0.8.31"
```

**File**: `gifski-api/src/lib.rs` (modified, +25/-15)
```diff
@@ -140,6 +140,7 @@ struct DiffMessage {
     dispose: gif::DisposalMethod,
     image: ImgVec<RGBA8>,
     importance_map: Vec<u8>,
+    needs_transparency: bool,
 }
 
 /// Frame post quantization, before remap
@@ -299,32 +300,41 @@ impl Writer {
     /// Avoids wasting palette on pixels identical to the background.
     ///
     /// `background` is the previous frame.
-    fn quantize(image: ImgRef<'_, RGBA8>, importance_map: &[u8], has_prev_frame: bool, settings: &Settings) -> CatResult<(Attributes, QuantizationResult, Image<'static>)> {
+    fn quantize(image: ImgVec<RGBA8>, importance_map: &[u8], first_frame: bool, needs_transparency: bool, prev_frame_keeps: bool, settings: &Settings) -> CatResult<(Attributes, QuantizationResult, Image<'static>)> {
         let mut liq = Attributes::new();
         if settings.fast {
-            liq.set_speed(10);
+            liq.set_speed(10)?;
         }
-        let quality = if has_prev_frame {
+        let quality = if !first_frame {
             settings.color_quality().into()
         } else {
             100 // the first frame is too important to ruin it
         };
-        liq.set_quality(0, quality);
-        let mut img = liq.new_image_stride(image.buf(), image.width(), image.height(), image.stride(), 0.)?;
-        img.set_importance_map(importance_map)?;
-        if has_prev_frame {
-            img.add_fixed_color(RGBA8::new(0, 0, 0, 0));
+        liq.set_quality(0, quality)?;
+        let (buf, width, height) = image.into_contiguous_buf();
+        let mut img = liq.new_image(buf, width, height, 0.)?;
+        // only later remapping tracks which area has been damanged by transparency
+        // so for previous-transparent background frame the importance map may be invalid
+        // because there's a transparent hole in the background not taken into account,
+        // and palette may lack colors to fill that hole
+        if first_frame || prev_frame_keeps {
+            img.set_importance_map(importance_map)?;
+        }
+        // first frame may be transparent too, so it's not just for diffs
+        if needs_transparency {
+            img.add_fixed_color(RGBA8::new(0, 0, 0, 0))?;
         }
         let res = liq.quantize(&mut img)?;
         Ok((liq, res, img))
     }
 
     fn remap(liq: Attributes, mut res: QuantizationResult, mut img: Image<'static>, background: Option<ImgRef<'_, RGBA8>>, settings: &Settings) -> CatResult<(ImgVec<u8>, Vec<RGBA8>)> {
         if let Some(bg) = background {
-            img.set_background(liq.new_image_stride(bg.buf(), bg.width(), bg.height(), bg.stride(), 0.)?)?;
+            let (buf, width, height) = bg.to_contiguous_buf();
+            img.set_background(liq.new_image(buf, width, height, 0.)?)?;
         }
 
-        res.set_dithering_level((settings.quality as f32 / 50.0 - 1.).max(0.));
+        res.set_dithering_level((settings.quality as f32 / 50.0 - 1.).max(0.))?;
 
         let (pal, pal_img) = res.remapped(&mut img)?;
         debug_assert_eq!(img.width() * img.height(), pal_img.len());
@@ -407,7 +417,7 @@ impl Writer {
 
     fn make_diffs(mut inputs: OrdQueueIter<DecodedImage>, quant_queue: Sender<DiffMessage>, settings: &Settings) -> CatResult<()> {
         let (first_frame, first_frame_pts) = inputs.next().transpose()?.ok_or(Error::NoFrames)?;
-        let mut prev_frame_pts = f64::NAN;
+        let mut prev_frame_pts = 0.;
 
         let mut denoiser = Denoiser::new(first_frame.width(), first_frame.height(), settings.quality);
 
@@ -469,9 +479,8 @@ impl Writer {
                     // shifts the whole anim and is the delay of the last frame
                     pts + first_frame_pts
                 } else {
-                    debug_assert!(prev_frame_pts.is_finite());
                     // otherwise assume steady framerate
-                    pts + (pts - prev_frame_pts)
+                    (pts + (pts - prev_frame_pts)).max(1./100.)
                 };
                 debug_assert!(end_pts > 0.);
 
```

#### Recent Merged Pull Requests:
- **PR #349** (closed): Update "Estimated Size" when cropping (@VoxelAgentSimon)
- **PR #348** (closed): Use crop size for export dimensions (@VoxelAgentSimon)
- **PR #346** (closed): Show warning when frame count would be too low (@william-laverty)
- **PR #345** (closed): Show warning when frame count is too low (@william-laverty)
- **PR #341** (2025-07-08): fix frame flash on bounce #332 (@mmulet)
- **PR #340** (2025-07-06): Quick action tip (@mmulet)
- **PR #339** (2026-01-07): implemented export modified video issue #337 (@mmulet)
- **PR #338** (closed): Export video issue #337 (@mmulet)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
