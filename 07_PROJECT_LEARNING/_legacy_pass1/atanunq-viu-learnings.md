# Forensic Learning Record (Deep Inspection): atanunq/viu

> **Canonical Artifact**: `07_PROJECT_LEARNING/atanunq-viu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/atanunq/viu](https://github.com/atanunq/viu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:28:56.300Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `atanunq/viu`
- **Description**: Terminal image viewer with native support for iTerm and Kitty
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3286 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app.rs`
```
use crate::config::Config;
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, execute};
use image::{codecs::gif::GifDecoder, AnimationDecoder, DynamicImage};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, Cursor, Error, ErrorKind, Read, Seek};
use std::sync::mpsc;
use std::{thread, time::Duration};
use viuer::ViuResult;

type TxRx<'a> = (&'a mpsc::Sender<bool>, &'a mpsc::Receiver<bool>);

// TODO: Create a viu-specific result and error types, do not reuse viuer's
pub fn run(mut conf: Config) -> ViuResult {
    //create two channels so that ctrlc-handler and the main thread can pass messages in order to
    // communicate when printing must be stopped without distorting the current frame
    let (tx_ctrlc, rx_print) = mpsc::channel();
    let (tx_print, rx_ctrlc) = mpsc::channel();

    //handle Ctrl-C in order to clean up after ourselves
    ctrlc::set_handler(move || {
        //if ctrlc is received tell the infinite gif loop to stop drawing
        // or stop the next file from being drawn
        tx_ctrlc
            .send(true)
            .expect("Could not send signal to stop drawing.");
        //a message will be received when that has happened so we can clear leftover symbols
        let _ = rx_ctrlc
            .recv()
            .expect("Could not receive signal to clean up terminal.");

        if let Err(e) = execute!(stdout(), Clear(ClearType::FromCursorDown)) {
            if e.kind() == ErrorKind::BrokenPipe {
                //Do nothing. Output is probably piped to `head` or a similar tool
            } else {
                panic!("{}", e);
            }
        }
        std::process::exit(0);
    })
    .map_err(|_| Error::other("Could not setup Ctrl-C handler."))?;

    //TODO: handle multiple files
    //read stdin if only one parameter is passed and it is "-"
    if conf.files.len() == 1 && conf.files[0] == "-" {
        let stdin = stdin();
        let mut handle = stdin.lock();

        let mut buf: Vec<u8> = Vec::new();
        let _ = handle.read_to_end(&mut buf)?;
        let cursor = Cursor::new(&buf);

        //TODO: print_from_file if data is a gif and terminal is iTerm
        if try_print_gif(&conf, cursor, (&tx_print, &rx_print)).is_err() {
            //If stdin data is not a gif, treat it as a regular image

            let img = image::load_from_memory(&buf)?;
            viuer::print(&img, &conf.viuer_config)?;
        };

        Ok(())
    } else {
        view_passed_files(&mut conf, (&tx_print, &rx_print))
    }
}

fn view_passed_files(conf: &mut Config, (tx, rx): TxRx) -> ViuResult {
    //loop throught all files passed
    for filename in &conf.files {
        //check if Ctrl-C has been received. If yes, stop iterating
        if rx.try_recv().is_ok() {
            return tx
                .send(true)
                .map_err(|_| Error::other("Could not send signal to clean up.").into());
        };
        //if it's a directory, stop gif looping because there will probably be more files
        if fs::metadata(filename)?.is_dir() {
            conf.loop_gif = false;
            view_directory(conf, filename, (tx, rx))?;
        }
        //if a file has been passed individually and fails, propagate the error
        else {
            view_file(conf, filename, (tx, rx))?;
        }
    }
    Ok(())
}

fn view_directory(conf: &Config, dirname: &str, (tx, rx): TxRx) -> ViuResult {
    for dir_entry_result in fs::read_dir(dirname)? {
        //check if Ctrl-C has been received. If yes, stop iterating
        if rx.try_recv().is_ok() {
            return tx
                .send(true)
                .map_err(|_| Error::other("Could not send signal to clean up.").into());
        };
        let dir_entry = dir_entry_result?;

        //check if the given file is a directory
        if let Some(path_name) = dir_entry.path().to_str() {
            //if -r is passed, continue down
            if conf.recursive && dir_entry.metadata()?.is_dir() {
                view_directory(conf, path_name, (tx, rx))?;
            }
            //if it is a regular file, viu it, but do not exit on error
            else {
                let _ = view_file(conf, path_name, (tx, rx));
            }
        } else {
            eprintln!("Could not get path name, skipping...");
            continue;
        }
    }

    Ok(())
}

fn view_file(conf: &Config, filename: &str, (tx, rx): TxRx) -> ViuResult {
    if conf.name {
        println!("{}:", filename);
    }
    let mut file_in = fs::File::open(filename)?;

    // Read some of the first bytes to guess the image format
    let mut format_guess_buf: [u8; 20] = [0; 20];
    let _ = file_in.read(&mut format_guess_buf)?;
    // Reset the cursor
    file_in.seek(std::io::SeekFrom::Start(0))?;

    // If the file is a gif, let iTerm handle it natively
    if conf.viuer_config.use_iterm
        && viuer::is_iterm_supported()
        && (image::guess_format(&format_guess_buf[..])?) == image::ImageFormat::Gif
    {
        viuer::print_from_file(filename, &conf.viuer_config)?;
    } else {
        let result = try_print_gif(conf, BufReader::new(file_in), (tx, rx));
        //the provided image is not a gif so try to view it
        if result.is_err() {
            viuer::print_from_file(filename, &conf.viuer_config)?;
        }
    }
    if conf.caption {
        println!("{}", filename);
    }

    Ok(())
}

fn try_print_gif<R>(conf: &Config, input_stream: R, (tx, rx): TxRx) -> ViuResult
where
    R: Read + BufRead + Seek,
{
    //read all frames of the gif and resize them all at once before starting to print them
    let resized_frames: Vec<(Duration, DynamicImage)> = GifDecoder::new(input_stream)?
        .into_frames()
        .collect_frames()?
        .into_iter()
        .map(|f| {
            let delay = Duration::from(f.delay());
            // Keep the image as it is for Kitty and iTerm, it will be printed in full resolution there
            if (conf.viuer_config.use_iterm && viuer::is_iterm_supported())
                || (conf.viuer_config.use_kitty
                    && viuer::get_kitty_support() != viuer::KittySupport::None)
            {
                (delay, DynamicImage::ImageRgba8(f.into_buffer()))
            } else {
                (
                    delay,
                    viuer::resize(
                        &DynamicImage::ImageRgba8(f.into_buffer()),
                        conf.viuer_config.width,
                        conf.viuer_config.height,
                    ),
                )
            }
        })
        .collect();

    'infinite: loop {
        let mut iter = resized_frames.iter().peekable();
        while let Some((delay, frame)) = iter.next() {
            let (_print_width, print_height) = viuer::print(frame, &conf.viuer_config)?;

            if conf.static_gif {
                break 'infinite;
            }

            thread::sleep(match conf.frame_duration {
                None => *delay,
                Some(duration) => duration,
            });

            //if ctrlc is received then respond so the handler can clear the
            // terminal from leftover colors
            if rx.try_recv().is_ok() {
                return tx
                    .send(true)
                    .map_err(|_| Error::other("Could not send signal to clean up.").into());
            };

            //keep replacing old pixels as the gif goes on so that scrollback
            // buffer is not filled (do not do that if it is the last frame of the gif
            // or a couple of files are being processed)
            if iter.peek().is_some() || conf.loop_gif {
                //since picture height is in pixel, we divide by 2 to get the height in
                // terminal cells
                if let Err(e) = execute!(stdout(), cursor::MoveUp(print_height as u16)) {
                    if e.kind() == ErrorKind::BrokenPipe {
                        //Stop printing. Output is probably piped to `head` o
```

### Core Architecture Module: `src/config.rs`
```
use clap::ArgMatches;
use std::time::Duration;
use viuer::Config as ViuerConfig;

pub struct Config<'a> {
    pub files: Vec<&'a str>,
    pub loop_gif: bool,
    pub name: bool,
    pub caption: bool,
    pub recursive: bool,
    pub static_gif: bool,
    pub viuer_config: ViuerConfig,
    pub frame_duration: Option<Duration>,
}

impl<'a> Config<'a> {
    pub fn new(matches: &'a ArgMatches) -> Config<'a> {
        let width = matches.get_one("width").cloned();
        let height = matches.get_one("height").cloned();

        let files: Vec<&str> = matches
            .get_many::<String>("file")
            .unwrap_or_default()
            .map(|s| s.as_str())
            .collect();

        let absolute_offset = matches.get_flag("absolute-offset");
        let x: u16 = matches
            .get_one("x")
            .cloned()
            .expect("X offset must be present");
        let y: i16 = matches
            .get_one("y")
            .cloned()
            .expect("Y offset must be present");

        let use_blocks = matches.get_flag("blocks");
        let transparent = matches.get_flag("transparent");

        let viuer_config = ViuerConfig {
            width,
            height,
            x,
            y,
            transparent,
            absolute_offset,
            use_kitty: !use_blocks,
            use_iterm: !use_blocks,
            #[cfg(any(feature = "sixel", feature = "icy_sixel"))]
            use_sixel: !use_blocks,
            ..Default::default()
        };

        let frame_duration: Option<Duration> = matches
            .get_one::<u8>("frames-per-second")
            .cloned()
            .map(|f| Duration::from_secs_f32(1.0 / f as f32));

        let once = matches.get_flag("once");
        let static_gif = matches.get_flag("static");
        let loop_gif = files.len() <= 1 && !once;

        Config {
            files,
            loop_gif,
            name: matches.get_flag("name"),
            caption: matches.get_flag("caption"),
            recursive: matches.get_flag("recursive"),
            static_gif,
            viuer_config,
            frame_duration,
        }
    }
    #[cfg(test)]
    pub fn test_config() -> Config<'a> {
        Config {
            files: vec![],
            loop_gif: true,
            name: false,
            caption: false,
            recursive: false,
            static_gif: false,
            viuer_config: ViuerConfig {
                absolute_offset: false,
                use_kitty: false,
                ..Default::default()
            },
            frame_duration: None,
        }
    }
}

```

### Core Architecture Module: `src/main.rs`
```
use clap::{
    crate_description, crate_name, crate_version, value_parser, Arg,
    ArgAction::{Append, Help, SetTrue},
    Command,
};

mod app;
mod config;

use config::Config;

fn main() {
    let matches = Command::new(crate_name!())
        .version(crate_version!())
        .about(crate_description!())
        .arg_required_else_help(true)
        .arg(
            Arg::new("file")
                .help("The images to be displayed. Set to - for standard input.")
                .action(Append),
        )
        .arg(
            Arg::new("width")
                .short('w')
                .long("width")
                .value_parser(value_parser!(u32))
                .help("Resize the image to a provided width"),
        )
        .arg(
            Arg::new("height")
                .short('h')
                .long("height")
                .value_parser(value_parser!(u32))
                .help("Resize the image to a provided height"),
        )
        .arg(
            Arg::new("x")
                .short('x')
                .default_value("0")
                .value_parser(value_parser!(u16))
                .help("X offset"),
        )
        .arg(
            Arg::new("y")
                .short('y')
                .default_value("0")
                .value_parser(value_parser!(i16))
                .help("Y offset"),
        )
        .arg(
            Arg::new("absolute-offset")
                .short('a')
                .long("absolute-offset")
                .action(SetTrue)
                .help("Make the x and y offset be relative to the top left terminal corner. If not set, they are relative to the cursor's position."),
        )
        .arg(
            Arg::new("recursive")
                .short('r')
                .long("recursive")
                .action(SetTrue)
                .help("Recurse down directories if passed one"),
        )
        .arg(
            Arg::new("blocks")
                .short('b')
                .long("blocks")
                .action(SetTrue)
                .help("Force block output"),
        )
        .arg(
            Arg::new("name")
                .short('n')
                .long("name")
                .action(SetTrue)
                .help("Output the name of the file before displaying"),
        )
        .arg(
            Arg::new("caption")
                .short('c')
                .long("caption")
                .action(SetTrue)
                .help("Output the name of the file after displaying"),
        )
        .arg(
            Arg::new("transparent")
                .short('t')
                .long("transparent")
                .action(SetTrue)
                .help("Display transparent images with transparent background"),
        )
        .arg(
            Arg::new("frames-per-second")
                .short('f')
                .long("frame-rate")
                .value_parser(value_parser!(u8))
                .help("Play the gif at a given frame rate"),
        )
        .arg(
            Arg::new("once")
                .short('1')
                .long("once")
                .action(SetTrue)
                .help("Loop only once through the gif"),
        )
        .arg(
            Arg::new("static")
                .short('s')
                .long("static")
                .action(SetTrue)
                .help("Show only the first frame of the gif"),
        )
        .disable_help_flag(true)
        .arg(
            Arg::new("help")
                .short('H')
                .long("help")
                .action(Help)
                .help("Print help information"),
        )
        .get_matches();

    let conf = Config::new(&matches);

    if let Err(e) = app::run(conf) {
        eprintln!("{:?}", e);
        std::process::exit(1);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #146** (2026-09-01): **chore(cli): Add flag `--sixel` for force sixel output**
  *Symptoms*: Fixes #125
  **Post-Mortem & Fix Analysis**:
  > @atanunq can you Reviewers this

- **Issue #142** (2025-12-15): **Add macos aarch build**
  *Symptoms*: Fixes #141 

- **Issue #141** (2025-12-15): **Pre-built standalone binary for Mac aarch64?**
  *Symptoms*: Is it possible to provide a pre-built standalone binary for Mac aarch64 platform as the homebrew repo has a restriction on macos version to get the latest version of viu.
  **Post-Mortem & Fix Analysis**:
  > Thanks for raising this! Let me know if something else is needed
  > @atanunq thanks for the quick response!

- **Issue #140** (2025-12-18): **1.6.0 does not work in tmux**
  *Symptoms*: 1.5.1 does.  Alpinelinux edge, `tmux` in `alacritty`, for example I get ``` SIXEL IMAGE (34x9)++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ++++++++++++++++++++++++++++++++++ ``` instead of the image. In `alacritty` without `tmux` works as previously.  here are the build logs for the two versions, in case that would help, - https://build.alpinelinux.org/buildlogs/build-edge-x86_64/community/viu/viu-1.5.1-r0.log - https://build.alpinelinux.org/buildlogs/build-edge-x86_64/community/viu/viu-1.6.0-r0.log
  **Post-Mortem & Fix Analysis**:
  > For me it does work with `tmux` in `xterm`, as both support sixel.  Also the *block output* in a `vte3` based terminal (which does not support sixel) works.  What broke here is automatic fallback to *block output* with `tmux` inside a `vte3` based terminal. Would be nice to have *block output* back there.
  > BTW, forcing the *block output* with `viu --blocks` gives the expected result.
  > I also saw this https://github.com/atanunq/viuer/issues/29

- **Issue #139** (2025-12-09): **Bump dependencies and add icy_sixel feature**
  *Symptoms*: 

- **Issue #138** (2025-12-09): **Add -c/--caption option**
  *Symptoms*: In addition to the `-n`/`--name` option that displays `NAME:` above the image, `-c`/`--caption` will display the name below the image, which can be more desirable.
  **Post-Mortem & Fix Analysis**:
  > And also fix the warnings on `Error::new(ErrorKind::Other, ` -> `Error::other(`
  > Thank you for the fast response and contributing :)  
  > Thank you for including this, it is useful to me and hopefully to others as well. Love `viu`!!

- **Issue #134** (2025-04-02): **closed**
  *Symptoms*: closed

- **Issue #133** (2025-01-15): **Add support for `ghostty`**
  *Symptoms*: On `kitty` it just works, but ghostty allows the Kitty graphics protocol too.  In theory it could be detected by using `xterm-ghostty`.  Cheers! 🎉
  **Post-Mortem & Fix Analysis**:
  > Apparently this is a false positive caused by some temporary `[ "$TERM" = "xterm-ghostty" ] && export TERM=xterm-256color` hackfix until ghostty populates `terminfo` across all distributions.  Closing, keep up being awesome!

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

### Incident Patch 1: `df5d58f5` (2025-12-09)
**Commit Message**: User Error::other to fix warnings

**File**: `src/app.rs` (modified, +4/-4)
```diff
@@ -38,7 +38,7 @@ pub fn run(mut conf: Config) -> ViuResult {
         }
         std::process::exit(0);
     })
-    .map_err(|_| Error::new(ErrorKind::Other, "Could not setup Ctrl-C handler."))?;
+    .map_err(|_| Error::other("Could not setup Ctrl-C handler."))?;
 
     //TODO: handle multiple files
     //read stdin if only one parameter is passed and it is "-"
@@ -70,7 +70,7 @@ fn view_passed_files(conf: &mut Config, (tx, rx): TxRx) -> ViuResult {
         //check if Ctrl-C has been received. If yes, stop iterating
         if rx.try_recv().is_ok() {
             return tx.send(true).map_err(|_| {
-                Error::new(ErrorKind::Other, "Could not send signal to clean up.").into()
+                Error::other("Could not send signal to clean up.").into()
             });
         };
         //if it's a directory, stop gif looping because there will probably be more files
@@ -91,7 +91,7 @@ fn view_directory(conf: &Config, dirname: &str, (tx, rx): TxRx) -> ViuResult {
         //check if Ctrl-C has been received. If yes, stop iterating
         if rx.try_recv().is_ok() {
             return tx.send(true).map_err(|_| {
-                Error::new(ErrorKind::Other, "Could not send signal to clean up.").into()
+                Error::other("Could not send signal to clean up.").into()
             });
         };
         let dir_entry = dir_entry_result?;
@@ -195,7 +195,7 @@ where
             // terminal from leftover colors
             if rx.try_recv().is_ok() {
                 return tx.send(true).map_err(|_| {
-                    Error::new(ErrorKind::Other, "Could not send signal to clean up.").into()
+                    Error::other("Could not send signal to clean up.").into()
                 });
             };
 
```

---

### Incident Patch 2: `281a002d` (2021-12-18)
**Commit Message**: Fix clippy warning

**File**: `src/app.rs` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ fn try_print_gif<R: Read>(conf: &Config, input_stream: R, (tx, rx): TxRx) -> Viu
     'infinite: loop {
         let mut iter = resized_frames.iter().peekable();
         while let Some((delay, frame)) = iter.next() {
-            let (_print_width, print_height) = viuer::print(&frame, &conf.viuer_config)?;
+            let (_print_width, print_height) = viuer::print(frame, &conf.viuer_config)?;
 
             if conf.static_gif {
                 break 'infinite;
```

---

### Incident Patch 3: `4a29bfb5` (2021-06-22)
**Commit Message**: Fix block-only gif printing in Kitty & iTerm

**File**: `src/app.rs` (modified, +5/-3)
```diff
@@ -130,7 +130,8 @@ fn view_file(conf: &Config, filename: &str, (tx, rx): TxRx) -> ViuResult {
     file_in.seek(std::io::SeekFrom::Start(0))?;
 
     // If the file is a gif, let iTerm handle it natively
-    if viuer::is_iterm_supported()
+    if conf.viuer_config.use_iterm
+        && viuer::is_iterm_supported()
         && (image::guess_format(&format_guess_buf[..])?) == image::ImageFormat::Gif
     {
         viuer::print_from_file(filename, &conf.viuer_config)?;
@@ -154,8 +155,9 @@ fn try_print_gif<R: Read>(conf: &Config, input_stream: R, (tx, rx): TxRx) -> Viu
         .map(|f| {
             let delay = Duration::from(f.delay());
             // Keep the image as it is for Kitty and iTerm, it will be printed in full resolution there
-            if viuer::is_iterm_supported()
-                || viuer::get_kitty_support() != viuer::KittySupport::None
+            if (conf.viuer_config.use_iterm && viuer::is_iterm_supported())
+                || (conf.viuer_config.use_kitty
+                    && viuer::get_kitty_support() != viuer::KittySupport::None)
             {
                 (delay, DynamicImage::ImageRgba8(f.into_buffer()))
             } else {
```

---

### Incident Patch 4: `9d623ac0` (2021-06-21)
**Commit Message**: Merge pull request #76 from aymanbagabas/aymanbagabas/fix/sixel

Fix build when sixel is enabled

**File**: `src/config.rs` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ impl<'a> Config<'a> {
             use_kitty: !use_blocks,
             use_iterm: !use_blocks,
             #[cfg(feature = "sixel")]
-            sixel: !use_blocks,
+            use_sixel: !use_blocks,
             ..Default::default()
         };
 
```

---

### Incident Patch 5: `f1f72ff3` (2021-06-21)
**Commit Message**: Use read instead of read_exact during image format guessing. Fixes #77

**File**: `src/app.rs` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ fn view_file(conf: &Config, filename: &str, (tx, rx): TxRx) -> ViuResult {
 
     // Read some of the first bytes to guess the image format
     let mut format_guess_buf: [u8; 20] = [0; 20];
-    file_in.read_exact(&mut format_guess_buf)?;
+    file_in.read(&mut format_guess_buf)?;
     // Reset the cursor
     file_in.seek(std::io::SeekFrom::Start(0))?;
 
```

---

### Incident Patch 6: `4bb58d02` (2021-06-15)
**Commit Message**: Fixes: d47d33d3f3a1 ("Added --blocks flag to force block output")

**File**: `src/config.rs` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ impl<'a> Config<'a> {
             use_kitty: !use_blocks,
             use_iterm: !use_blocks,
             #[cfg(feature = "sixel")]
-            sixel: !use_blocks,
+            use_sixel: !use_blocks,
             ..Default::default()
         };
 
```

---

### Incident Patch 7: `72f15d46` (2021-04-17)
**Commit Message**: Fix warning

**File**: `src/app.rs` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ pub fn run(mut conf: Config) -> ViuResult {
                 if e.kind() == ErrorKind::BrokenPipe {
                     //Do nothing. Output is probably piped to `head` or a similar tool
                 } else {
-                    panic!(e);
+                    panic!("{}", e);
                 }
             }
             std::process::exit(0);
```

---

### Incident Patch 8: `59634135` (2020-12-25)
**Commit Message**: Small path fix

**File**: `src/app.rs` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ pub fn run(mut conf: Config) -> ViuResult {
             if let Err(crossterm::ErrorKind::IoError(e)) =
                 execute!(stdout(), Clear(ClearType::FromCursorDown))
             {
-                if e.kind() == std::io::ErrorKind::BrokenPipe {
+                if e.kind() == ErrorKind::BrokenPipe {
                     //Do nothing. Output is probably piped to `head` or a similar tool
                 } else {
                     panic!(e);
@@ -210,7 +210,7 @@ fn try_print_gif<R: Read>(conf: &Config, input_stream: R, (tx, rx): TxRx) -> Viu
                 if let Err(crossterm::ErrorKind::IoError(e)) =
                     execute!(stdout(), cursor::MoveUp(print_height as u16))
                 {
-                    if e.kind() == std::io::ErrorKind::BrokenPipe {
+                    if e.kind() == ErrorKind::BrokenPipe {
                         //Stop printing. Output is probably piped to `head` or a similar tool
                         break 'infinite;
                     } else {
```

---

### Incident Patch 9: `b444da7e` (2020-12-22)
**Commit Message**: Fix the comprehensive test suite

**File**: `src/app.rs` (modified, +1/-1)
```diff
@@ -231,6 +231,6 @@ mod test {
     fn test_view_without_extension() {
         let conf = Config::test_config();
         let (tx, rx) = mpsc::channel();
-        view_file(&conf, "img/bfa", false, (&tx, &rx)).unwrap();
+        view_file(&conf, "img/bfa", (&tx, &rx)).unwrap();
     }
 }
```

---

### Incident Patch 10: `7874acab` (2020-11-04)
**Commit Message**: Fixed linter warnings.

**File**: `src/config.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ impl<'a> Config<'a> {
             recursive: matches.is_present("recursive"),
             static_gif,
             viuer_config,
-            frame_duration: frame_duration,
+            frame_duration,
         }
     }
     #[cfg(test)]
```

#### Recent Merged Pull Requests:
- **PR #146** (closed): chore(cli): Add flag `--sixel` for force sixel output (@Paul-16098)
- **PR #142** (2025-12-15): Add macos aarch build (@atanunq)
- **PR #139** (2025-12-09): Bump dependencies and add icy_sixel feature (@atanunq)
- **PR #138** (2025-12-09): Add -c/--caption option (@pepa65)
- **PR #119** (closed): Fix RUSTSEC-2024-0019 (@rex4539)
- **PR #117** (2023-11-21): Update Arch Linux package URL in README.md (@felixonmars)
- **PR #115** (closed): Bump rustix from 0.38.17 to 0.38.19 (@dependabot[bot])
- **PR #112** (closed): Bump spin from 0.9.4 to 0.9.8 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
