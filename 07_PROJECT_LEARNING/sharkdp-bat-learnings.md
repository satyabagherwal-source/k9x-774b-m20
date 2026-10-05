# Forensic Learning Record (Deep Inspection): sharkdp/bat

> **Canonical Artifact**: `07_PROJECT_LEARNING/sharkdp-bat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sharkdp/bat](https://github.com/sharkdp/bat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:57.638Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sharkdp/bat`
- **Description**: A cat(1) clone with wings.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 60679 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `assets/theme_preview.rs`
```
  // Output the square of a number.
  fn print_square(num: f64) {
      let result = f64::powf(num, 2.0);
      println!("The square of {num:.2} is {result:.2}.");
  }

```

### Core Architecture Module: `examples/advanced.rs`
```
/// A program that prints its own source code using the bat library
use bat::{PagingMode, PrettyPrinter, WrappingMode};

fn main() {
    PrettyPrinter::new()
        .header(true)
        .grid(true)
        .line_numbers(true)
        .use_italics(true)
        // The following line will be highlighted in the output:
        .highlight(line!() as usize)
        .theme("1337")
        .wrapping_mode(WrappingMode::Character)
        .paging_mode(PagingMode::QuitIfOneScreen)
        .input_file(file!())
        .print()
        .unwrap();
}

```

### Core Architecture Module: `examples/buffer.rs`
```
use bat::{
    assets::HighlightingAssets, config::Config, controller::Controller, output::OutputHandle, Input,
};

fn main() {
    let mut buffer = String::new();
    let config = Config {
        colored_output: true,
        ..Default::default()
    };
    let assets = HighlightingAssets::from_binary();
    let controller = Controller::new(&config, &assets);
    let input = Input::from_file(file!());
    controller
        .run(
            vec![input.into()],
            Some(&mut OutputHandle::FmtWrite(&mut buffer)),
        )
        .unwrap();

    println!("{buffer}");
}

```

### Core Architecture Module: `examples/cat.rs`
```
/// A very simple colorized `cat` clone, using `bat` as a library.
/// See `src/bin/bat` for the full `bat` application.
use bat::PrettyPrinter;

fn main() {
    PrettyPrinter::new()
        .header(true)
        .grid(true)
        .line_numbers(true)
        .input_files(std::env::args_os().skip(1))
        .print()
        .unwrap();
}

```

### Core Architecture Module: `examples/inputs.rs`
```
/// A small demonstration of the Input API.
/// This prints embedded bytes with a custom header and then reads from STDIN.
use bat::{Input, PrettyPrinter};

fn main() {
    PrettyPrinter::new()
        .header(true)
        .grid(true)
        .line_numbers(true)
        .inputs(vec![
            Input::from_bytes(b"echo 'Hello World!'")
                .name("embedded.sh") // Dummy name provided to detect the syntax.
                .kind("Embedded")
                .title("An embedded shell script."),
            Input::from_stdin().title("Standard Input").kind("FD"),
        ])
        .print()
        .unwrap();
}

```

### Core Architecture Module: `examples/list_syntaxes_and_themes.rs`
```
/// A simple program that lists all supported syntaxes and themes.
use bat::PrettyPrinter;

fn main() {
    let printer = PrettyPrinter::new();

    println!("Syntaxes:");
    for syntax in printer.syntaxes() {
        println!("- {} ({})", syntax.name, syntax.file_extensions.join(", "));
    }

    println!();

    println!("Themes:");
    for theme in printer.themes() {
        println!("- {theme}");
    }
}

```

### Core Architecture Module: `examples/simple.rs`
```
/// A simple program that prints its own source code using the bat library
use bat::PrettyPrinter;

fn main() {
    PrettyPrinter::new().input_file(file!()).print().unwrap();
}

```

### Core Architecture Module: `examples/yaml.rs`
```
/// A program that serializes a Rust structure to YAML and pretty-prints the result
use bat::{Input, PrettyPrinter};
use serde::Serialize;

#[derive(Serialize)]
struct Person {
    name: String,
    height: f64,
    adult: bool,
    children: Vec<Person>,
}

fn main() {
    let person = Person {
        name: String::from("Anne Mustermann"),
        height: 1.76f64,
        adult: true,
        children: vec![Person {
            name: String::from("Max Mustermann"),
            height: 1.32f64,
            adult: false,
            children: vec![],
        }],
    };

    let mut bytes = Vec::with_capacity(128);
    serde_yaml::to_writer(&mut bytes, &person).unwrap();
    PrettyPrinter::new()
        .language("yaml")
        .line_numbers(true)
        .grid(true)
        .header(true)
        .input(Input::from_bytes(&bytes).name("person.yaml").kind("File"))
        .print()
        .unwrap();
}

```

### Core Architecture Module: `src/assets.rs`
```
use std::ffi::OsStr;
use std::fs;
use std::path::Path;

use once_cell::unsync::OnceCell;

use syntect::highlighting::Theme;
use syntect::parsing::{SyntaxReference, SyntaxSet};

use path_abs::PathAbs;

use crate::error::*;
use crate::input::{InputReader, OpenedInput};
use crate::syntax_mapping::ignored_suffixes::IgnoredSuffixes;
use crate::syntax_mapping::MappingTarget;
use crate::theme::{default_theme, ColorScheme};
use crate::{bat_warning, SyntaxMapping};

use lazy_theme_set::LazyThemeSet;

use serialized_syntax_set::*;

#[cfg(feature = "build-assets")]
pub use crate::assets::build_assets::*;

pub(crate) mod assets_metadata;
#[cfg(feature = "build-assets")]
mod build_assets;
mod lazy_theme_set;
mod serialized_syntax_set;

#[derive(Debug)]
pub struct HighlightingAssets {
    syntax_set_cell: OnceCell<SyntaxSet>,
    serialized_syntax_set: SerializedSyntaxSet,

    theme_set: LazyThemeSet,
    fallback_theme: Option<&'static str>,
}

#[derive(Debug)]
pub struct SyntaxReferenceInSet<'a> {
    pub syntax: &'a SyntaxReference,
    pub syntax_set: &'a SyntaxSet,
}

/// Lazy-loaded syntaxes are already compressed, and we don't want to compress
/// already compressed data.
pub(crate) const COMPRESS_SYNTAXES: bool = false;

/// We don't want to compress our [LazyThemeSet] since the lazy-loaded themes
/// within it are already compressed, and compressing another time just makes
/// performance suffer
pub(crate) const COMPRESS_THEMES: bool = false;

/// Compress for size of ~40 kB instead of ~200 kB without much difference in
/// performance due to lazy-loading
pub(crate) const COMPRESS_LAZY_THEMES: bool = true;

/// Compress for size of ~10 kB instead of ~120 kB
pub(crate) const COMPRESS_ACKNOWLEDGEMENTS: bool = true;

impl HighlightingAssets {
    fn new(serialized_syntax_set: SerializedSyntaxSet, theme_set: LazyThemeSet) -> Self {
        HighlightingAssets {
            syntax_set_cell: OnceCell::new(),
            serialized_syntax_set,
            theme_set,
            fallback_theme: None,
        }
    }

    pub fn from_cache(cache_path: &Path) -> Result<Self> {
        Ok(HighlightingAssets::new(
            SerializedSyntaxSet::FromFile(cache_path.join("syntaxes.bin")),
            asset_from_cache(&cache_path.join("themes.bin"), "theme set", COMPRESS_THEMES)?,
        ))
    }

    pub fn from_binary() -> Self {
        HighlightingAssets::new(
            SerializedSyntaxSet::FromBinary(get_serialized_integrated_syntaxset()),
            get_integrated_themeset(),
        )
    }

    pub fn set_fallback_theme(&mut self, theme: &'static str) {
        self.fallback_theme = Some(theme);
    }

    /// Return the collection of syntect syntax definitions.
    pub fn get_syntax_set(&self) -> Result<&SyntaxSet> {
        self.syntax_set_cell
            .get_or_try_init(|| self.serialized_syntax_set.deserialize())
    }

    /// Use [Self::get_syntaxes] instead
    #[deprecated]
    pub fn syntaxes(&self) -> &[SyntaxReference] {
        self.get_syntax_set()
            .expect(".syntaxes() is deprecated, use .get_syntaxes() instead")
            .syntaxes()
    }

    pub fn get_syntaxes(&self) -> Result<&[SyntaxReference]> {
        Ok(self.get_syntax_set()?.syntaxes())
    }

    fn get_theme_set(&self) -> &LazyThemeSet {
        &self.theme_set
    }

    pub fn themes(&self) -> impl Iterator<Item = &str> {
        self.get_theme_set().themes()
    }

    /// Use [Self::get_syntax_for_path] instead
    #[deprecated]
    pub fn syntax_for_file_name(
        &self,
        file_name: impl AsRef<Path>,
        mapping: &SyntaxMapping,
    ) -> Option<&SyntaxReference> {
        self.get_syntax_for_path(file_name, mapping)
            .ok()
            .map(|syntax_in_set| syntax_in_set.syntax)
    }

    /// Detect the syntax based on, in order:
    ///  1. Syntax mappings with [MappingTarget::MapTo] and [MappingTarget::MapToUnknown]
    ///     (e.g. `/etc/profile` -> `Bourne Again Shell (bash)`)
    ///  2. The file name (e.g. `Dockerfile`)
    ///  3. Syntax mappings with [MappingTarget::MapExtensionToUnknown]
    ///     (e.g. `*.conf`)
    ///  4. The file name extension (e.g. `.rs`)
    ///
    /// When detecting syntax based on syntax mappings, the full path is taken
    /// into account. When detecting syntax based on file name, no regard is
    /// taken to the path of the file. Only the file name itself matters. When
    /// detecting syntax based on file name extension, only the file name
    /// extension itself matters.
    ///
    /// Returns [Error::UndetectedSyntax] if it was not possible detect syntax
    /// based on path/file name/extension (or if the path was mapped to
    /// [MappingTarget::MapToUnknown] or [MappingTarget::MapExtensionToUnknown]).
    /// In this case it is appropriate to fall back to other methods to detect
    /// syntax. Such as using the contents of the first line of the file.
    ///
    /// Returns [Error::UnknownSyntax] if a syntax mapping exist, but the mapped
    /// syntax does not exist.
    pub fn get_syntax_for_path(
        &self,
        path: impl AsRef<Path>,
        mapping: &SyntaxMapping,
    ) -> Result<SyntaxReferenceInSet<'_>> {
        let path = path.as_ref();

        let syntax_match = mapping.get_syntax_for(path);

        if let Some(MappingTarget::MapToUnknown) = syntax_match {
            return Err(Error::UndetectedSyntax(
                crate::preprocessor::sanitize_for_terminal(&path.to_string_lossy()),
            ));
        }

        if let Some(MappingTarget::MapTo(syntax_name)) = syntax_match {
            return self
                .find_syntax_by_token(syntax_name)?
                .ok_or_else(|| Error::UnknownSyntax(syntax_name.to_owned()));
        }

        let file_name = path.file_name().unwrap_or_default();

        match (
            self.get_syntax_for_file_name(file_name, &mapping.ignored_suffixes)?,
            syntax_match,
        ) {
            (Some(syntax), _) => Ok(syntax),

            (_, Some(MappingTarget::MapExtensionToUnknown)) => Err(Error::UndetectedSyntax(
                crate::preprocessor::sanitize_for_terminal(&path.to_string_lossy()),
            )),

            _ => self
                .get_syntax_for_file_extension(file_name, &mapping.ignored_suffixes)?
                .ok_or_else(|| {
                    Error::UndetectedSyntax(crate::preprocessor::sanitize_for_terminal(
                        &path.to_string_lossy(),
                    ))
                }),
        }
    }

    /// Look up a syntect theme by name.
    pub fn get_theme(&self, theme: &str) -> &Theme {
        match self.get_theme_set().get(theme) {
            Some(theme) => theme,
            None => {
                if theme == "ansi-light" || theme == "ansi-dark" {
                    bat_warning!("Theme '{theme}' is deprecated, using 'ansi' instead.");
                    return self.get_theme("ansi");
                }
                if !theme.is_empty() {
                    bat_warning!("Unknown theme '{theme}', using default.")
                }
                self.get_theme_set()
                    .get(
                        self.fallback_theme
                            .unwrap_or_else(|| default_theme(ColorScheme::Dark)),
                    )
                    .expect("something is very wrong if the default theme is missing")
            }
        }
    }

    pub(crate) fn get_syntax(
        &self,
        language: Option<&str>,
        fallback_syntax: Option<&str>,
        input: &mut OpenedInput,
        mapping: &SyntaxMapping,
    ) -> Result<SyntaxReferenceInSet<'_>> {
        if let Some(language) = language {
            let syntax_set = self.get_syntax_set()?;
            return syntax_set
                .find_syntax_by_token(language)
                .map(|syntax| SyntaxReferenceInSet { syntax, syntax_set })
                .ok_or_else(|| Error::UnknownSyntax(language.to_owned()));
        }

        let path = input.path();
        let absolute_path = path.and_then(|p| {
            PathAbs::new(p)
                .ok()
                .map(|abs| abs.as_path().to_path_buf())
                .or_else(|| Some(p.to_owned()))
        });

        let path_syntax = if let Some(ref path) = absolute_path {
            self.get_syntax_for_path(path, mapping).or_else(|e| {
                // If syntax detection failed on the given path, retry with the
                // canonicalized path (which resolves symlinks). This handles
                // cases like `Aliases/0install -> ../Formula/zero-install.rb`
                // where the symlink name has no extension but the target does.
                // See #1001.
                if matches!(e, Error::UndetectedSyntax(_)) {
                    if let Ok(resolved) = fs::canonicalize(path) {
                        if resolved != *path {
                            return match self.get_syntax_for_path(&resolved, mapping) {
                                Ok(syntax) => Ok(syntax),
                                Err(Error::UndetectedSyntax(_)) => Err(e),
                                Err(err) => Err(err),
                            };
                        }
                    }
                }
                Err(e)
            })
        } else {
            Err(Error::UndetectedSyntax("[unknown]".into()))
        };

        // If a path wasn't provided, or if path based syntax detection
        // above failed, we fall back to first-line syntax detection.
        match path_syntax {
            Err(Error::UndetectedSyntax(path)) => {
                if let Some(syntax_in_set) = self.get_first_line_syntax(&mut input.reader)? {
                    Ok(syntax_in_set)
                } else if let Some(language) = fallback_syntax {
                    self.find_syntax_by_token(language)?
                        .ok_or_else(|| Error::UnknownSyntax(language.to_owned()))
                } else {
                    Err(Error::UndetectedSyntax(
```

### Core Architecture Module: `src/assets/assets_metadata.rs`
```
use std::fs::File;
use std::path::Path;
use std::time::SystemTime;

use semver::Version;
use serde_derive::{Deserialize, Serialize};

use crate::error::*;

#[derive(Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AssetsMetadata {
    bat_version: Option<String>,
    creation_time: Option<SystemTime>,
}

const FILENAME: &str = "metadata.yaml";

impl AssetsMetadata {
    #[cfg(feature = "build-assets")]
    pub(crate) fn new(current_version: &str) -> AssetsMetadata {
        AssetsMetadata {
            bat_version: Some(current_version.to_owned()),
            creation_time: Some(SystemTime::now()),
        }
    }

    #[cfg(feature = "build-assets")]
    pub(crate) fn save_to_folder(&self, path: &Path) -> Result<()> {
        let file = File::create(path.join(FILENAME))?;
        serde_yaml::to_writer(file, self)?;

        Ok(())
    }

    fn try_load_from_folder(path: &Path) -> Result<Self> {
        let file = File::open(path.join(FILENAME))?;
        Ok(serde_yaml::from_reader(file)?)
    }

    /// Load metadata about the stored cache file from the given folder.
    ///
    /// There are several possibilities:
    ///   - We find a `metadata.yaml` file and are able to parse it
    ///     - return the contained information
    ///   - We find a `metadata.yaml` file, but are not able to parse it
    ///     - return a [`Error::SerdeYamlError`]
    ///   - We do not find a `metadata.yaml` file but a `syntaxes.bin` or `themes.bin` file
    ///     - assume that these were created by an old version of bat and return
    ///       [`AssetsMetadata::default()`] without version information
    ///   - We do not find a `metadata.yaml` file and no cached assets
    ///     - no user provided assets are available, return `None`
    pub fn load_from_folder(path: &Path) -> Result<Option<Self>> {
        match Self::try_load_from_folder(path) {
            Ok(metadata) => Ok(Some(metadata)),
            Err(e) => {
                if let Error::SerdeYamlError(_) = e {
                    Err(e)
                } else if path.join("syntaxes.bin").exists() || path.join("themes.bin").exists() {
                    Ok(Some(Self::default()))
                } else {
                    Ok(None)
                }
            }
        }
    }

    pub fn is_compatible_with(&self, current_version: &str) -> bool {
        let current_version =
            Version::parse(current_version).expect("bat follows semantic versioning");
        let stored_version = self
            .bat_version
            .as_ref()
            .and_then(|ver| Version::parse(ver).ok());

        if let Some(stored_version) = stored_version {
            current_version.major == stored_version.major
                && current_version.minor == stored_version.minor
        } else {
            false
        }
    }
}

```

### Core Architecture Module: `src/assets/lazy_theme_set.rs`
```
use super::*;

use std::collections::BTreeMap;
use std::convert::TryFrom;

use serde_derive::{Deserialize, Serialize};

use once_cell::unsync::OnceCell;

use syntect::highlighting::{Theme, ThemeSet};

/// Same structure as a [`syntect::highlighting::ThemeSet`] but with themes
/// stored in raw serialized form, and deserialized on demand.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct LazyThemeSet {
    /// This is a [`BTreeMap`] because that's what [`syntect::highlighting::ThemeSet`] uses
    themes: BTreeMap<String, LazyTheme>,
}

/// Stores raw serialized data for a theme with methods to lazily deserialize
/// (load) the theme.
#[derive(Debug, Serialize, Deserialize)]
struct LazyTheme {
    serialized: Vec<u8>,

    #[serde(skip, default = "OnceCell::new")]
    deserialized: OnceCell<syntect::highlighting::Theme>,
}

impl LazyThemeSet {
    /// Lazily load the given theme
    pub fn get(&self, name: &str) -> Option<&Theme> {
        self.themes.get(name).and_then(|lazy_theme| {
            lazy_theme
                .deserialized
                .get_or_try_init(|| lazy_theme.deserialize())
                .ok()
        })
    }

    /// Returns the name of all themes.
    pub fn themes(&self) -> impl Iterator<Item = &str> {
        self.themes.keys().map(|name| name.as_ref())
    }
}

impl LazyTheme {
    fn deserialize(&self) -> Result<Theme> {
        asset_from_contents(
            &self.serialized[..],
            "lazy-loaded theme",
            COMPRESS_LAZY_THEMES,
        )
    }
}

impl TryFrom<LazyThemeSet> for ThemeSet {
    type Error = Error;

    /// Since the user might want to add custom themes to bat, we need a way to
    /// convert from a `LazyThemeSet` to a regular [`ThemeSet`] so that more
    /// themes can be added. This function does that pretty straight-forward
    /// conversion.
    fn try_from(lazy_theme_set: LazyThemeSet) -> Result<Self> {
        let mut theme_set = ThemeSet::default();

        for (name, lazy_theme) in lazy_theme_set.themes {
            theme_set.themes.insert(name, lazy_theme.deserialize()?);
        }

        Ok(theme_set)
    }
}

#[cfg(feature = "build-assets")]
impl TryFrom<ThemeSet> for LazyThemeSet {
    type Error = Error;

    /// To collect themes, a [`ThemeSet`] is needed. Once all desired themes
    /// have been added, we need a way to convert that into [`LazyThemeSet`] so
    /// that themes can be lazy-loaded later. This function does that
    /// conversion.
    fn try_from(theme_set: ThemeSet) -> Result<Self> {
        let mut lazy_theme_set = LazyThemeSet::default();

        for (name, theme) in theme_set.themes {
            // All we have to do is to serialize the theme
            let lazy_theme = LazyTheme {
                serialized: crate::assets::build_assets::asset_to_contents(
                    &theme,
                    &format!("theme {name}"),
                    COMPRESS_LAZY_THEMES,
                )?,
                deserialized: OnceCell::new(),
            };

            // Ok done, now we can add it
            lazy_theme_set.themes.insert(name, lazy_theme);
        }

        Ok(lazy_theme_set)
    }
}

```

### Core Architecture Module: `src/assets/serialized_syntax_set.rs`
```
use std::path::PathBuf;

use syntect::parsing::SyntaxSet;

use super::*;

/// A SyntaxSet in serialized form, i.e. bincoded and flate2 compressed.
/// We keep it in this format since we want to load it lazily.
#[derive(Debug)]
pub enum SerializedSyntaxSet {
    /// The data comes from a user-generated cache file.
    FromFile(PathBuf),

    /// The data to use is embedded into the bat binary.
    FromBinary(&'static [u8]),
}

impl SerializedSyntaxSet {
    pub fn deserialize(&self) -> Result<SyntaxSet> {
        match self {
            SerializedSyntaxSet::FromBinary(data) => Ok(from_binary(data, COMPRESS_SYNTAXES)),
            SerializedSyntaxSet::FromFile(ref path) => {
                asset_from_cache(path, "syntax set", COMPRESS_SYNTAXES)
            }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4023** (2026-09-29): **builtin pager: some words are not searchable in man pages**
  *Symptoms*: **What steps will reproduce the bug?**  1. `MANPAGER="bat -plman" man setlocale` or `MANPAGER="bat -plman" man setlocale` 2. do `/LC_CTYPE` or `/CTYPE`  **What happens?** No search results found.  **What did you expect to happen instead?** multiple matches for `LC_CTYPE` is found.  **How did you install `bat`?** `xbps-install`, void linux.  ---  **bat version and environment**  #### Software version  bat 0.26.1  #### Operating system  - OS: Linux (Void) - Kernel: 6.18.53_1  #### Command-line  ```bash bat --diagnostic  ```  #### Environment variables  ```bash BAT_CACHE_PATH=<not set> BAT_CONFIG_PATH=<not set> BAT_OPTS=<not set> BAT_PAGER=<not set> BAT_PAGING=<not set> BAT_STYLE=<not set> BAT_TABS=<not set> BAT_THEME=<not set> COLORTERM=truecolor LANG=en_US.UTF-8 LC_ALL=<not set> LESS=<not set> MANPAGER='bat -plman --pager=builtin' NO_COLOR=<not set> PAGER=<not set> SHELL=/bin/fish TERM=xterm-kitty XDG_CACHE_HOME=<not set> XDG_CONFIG_HOME=<not set> ```  #### System Config file  Could not read contents of '/etc/bat/config': No such file or directory (os error 2).  #### Config file  ``` # This is `bat`s configuration file. Each line either contains a comment or # a command-line option that you want to pass to `bat` by default. You can # run `bat --help` to get a list of all possible configuration options.  # Specify desired highlighting theme (e.g. "TwoDark"). Run `bat --list-themes` # for a list of all available themes #--theme="TwoDark"  # Enable this to use italic text on the 
  **Post-Mortem & Fix Analysis**:
  > On deeper searching, this looks like a duplicate of https://github.com/sharkdp/bat/issues/1145  I used the following snippet from https://github.com/sharkdp/bat/issues/1145#issuecomment-3590705756 saved as a shell script and pointed MANPAGER at it to workaround this. And as a side effect, my man pages have better syntax highlighting now. I didn't realise it was broken.  ``` #/bin/sh exec cat "$@" | sed -e 's/.\x08//g' -e 's/\t/    /g' | bat --language man --style plain ```

- **Issue #4005** (2026-09-25): **Font color not readable in light mode**
  *Symptoms*: **What steps will reproduce the bug?**  1. Open the MacOS Terminal app during light mode on the OS 2. Run bat on any file. I did it on my /etc/fstab  **What happens?** Notice how the font color of the the first words on some lines are white on the white background. <img width="888" height="432" alt="Image" src="https://github.com/user-attachments/assets/0fdda316-ace7-4aee-963f-9c960e9b0cf5" /> **What did you expect to happen instead?** To have a readable font color.    **How did you install `bat`?**  With apt install bat I think.   **bat version and environment** bat 0.24.0  
  **Post-Mortem & Fix Analysis**:
  > bat 0.24.0 always uses the same default theme, and that theme is designed for dark backgrounds. Starting with v0.25.0, bat picks a theme based on the terminal's background color (#2896), so a light Terminal.app should get a light theme automatically. The latest release is v0.26.1, which also fixes `BAT_THEME_LIGHT`/`BAT_THEME_DARK` being ignored. If you upgrade, you can set a specific light theme with `--theme-light` or `BAT_THEME_LIGHT`. If you'd rather stay on the apt 0.24.0 package, setting `BAT_THEME` to a light theme (for example `export BAT_THEME=GitHub`; `bat --list-themes` shows the options) should make the text readable. 
  > You are right. My ubuntu version didn't suggest me installing the later version by default. But via override install to the latest bat it worked! Theme issue resolved. 

- **Issue #3866** (2026-08-10): **log syntax exhibits catastrophic performance on bash xtrace logs**
  *Symptoms*: **What steps will reproduce the bug?**  1. download log file 2. print it with bat --no-pager and autodetected syntax  **What happens?** i save my logs at log-"tool"-"time".log files, for now i save bash xtrace log of one program  size of file: 564K cat time: 0.009s bat: 37s max line size: 7095  I ran a few tests and found that if a filename contains "log" it is automatically parsed using the "log" syntax, which incredible reduces performance, -l sh or -l bash works fast  also i remove pluses from log it still running slow  https://streamable.com/1f2bsa  **How did you install `bat`?** nixpkgs  **bat version and environment** bat 0.26.1  #### Software version  bat 0.26.1  #### Operating system  - OS: Linux (NixOS 26.05) - Kernel: 6.18.40  #### Command-line  ```bash /run/current-system/sw/bin/bat --diagnostic --no-pager log-bash-20260801-032836.log  ```  #### Environment variables  ```bash BAT_CACHE_PATH=<not set> BAT_CONFIG_PATH=<not set> BAT_OPTS=<not set> BAT_PAGER=<not set> BAT_PAGING=<not set> BAT_STYLE=<not set> BAT_TABS=<not set> BAT_THEME=<not set> COLORTERM=truecolor LANG=en_US.UTF-8 LC_ALL=<not set> LESS=<not set> MANPAGER='sh -c '\''col -bx | bat -l man -p'\''' NO_COLOR=<not set> PAGER=less SHELL=/run/current-system/sw/bin/zsh TERM=xterm-ghostty XDG_CACHE_HOME=/home/ozumr/.cache XDG_CONFIG_HOME=/home/ozumr/.config ```  #### System Config file  Could not read contents of '/etc/bat/config': No such file or directory (os error 2).  #### Config file  Could not read conten

- **Issue #3803** (2026-06-16): **bat panics (capacity overflow) on `--terminal-width 1` with multiple line ranges**
  *Symptoms*:   **What steps will reproduce the bug?**  ```console $ printf 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\n' > t.txt  # explicit snip style: $ bat --no-config --paging=never --color=always --style=snip \       --terminal-width 1 --line-range 1:2 --line-range 7:8 t.txt thread 'main' panicked at library/alloc/src/slice.rs:523:50: capacity overflow $ echo $? 101  # also without any --style (the default style includes snip): $ bat --no-config --paging=never --color=always \       --terminal-width 1 --line-range 1:2 --line-range 7:8 t.txt ... capacity overflow ... (exit 101) ```  **What happens?**  `bat --terminal-width 1` panics with `capacity overflow` (exit 101) when the output contains a "snip" separator — i.e. two or more disjoint `--line-range`s (or a diff gap) with a style that includes `snip` (the default).  **What did you expect to happen instead?**  A tiny terminal width should clamp the separator to empty (as the code already does for the panel when `term_width` is too small), not underflow and abort.  **Root Cause**  `InteractivePrinter::print_snip` (`src/printer.rs:606-610`):  ```rust let snip_left = "─ ".repeat((self.config.term_width - panel_count - (title_count / 2)) / 4); let snip_left_count = snip_left.chars().count();  let snip_right =     " ─".repeat((self.config.term_width - panel_count - snip_left_count - title_count) / 2); ```  At `term_width == 1` the panel is disabled (`panel_count == 0`, `snip_left_count == 0`) and `title_count == 2` (`"8<"`), so the `snip_right` ope

- **Issue #3800** (2026-08-12): **missing help language**
  *Symptoms*: The README says that there is a `help` language, but that appears to be incorrect.  ``` ❱  cp --help | batcat -plhelp [bat error]: unknown syntax: 'help'  ❱  cp --help | batcat --plain --language=help [bat error]: unknown syntax: 'help'  ❱  sudo ln -s /usr/bin/batcat /usr/bin/bat  ❱  cp --help | bat -plhelp [bat error]: unknown syntax: 'help'  ❱  cp --help | bat --plain --language=help [bat error]: unknown syntax: 'help'  ```  ---  **How did you install `bat`?** apt-get  ---  **bat version** ``` ❱  batcat --version bat 0.19.0 ```  **environment** ``` ❱  cat /etc/os-release  PRETTY_NAME="Ubuntu 22.04.5 LTS" NAME="Ubuntu" VERSION_ID="22.04" VERSION="22.04.5 LTS (Jammy Jellyfish)" VERSION_CODENAME=jammy ID=ubuntu ID_LIKE=debian HOME_URL="https://www.ubuntu.com/" SUPPORT_URL="https://help.ubuntu.com/" BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/" PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy" UBUNTU_CODENAME=jammy ``` 
  **Post-Mortem & Fix Analysis**:
  > Version 0.19 is indeed old enough not to have the help language - the readme reflects the latest state after all. You can look at the 0.19.0 tag and go to the readme there for an accurate document for your installed version. In general I would suggest to upgrade 🙂

- **Issue #3760** (2026-05-20): **Skip pager forcefully in completion files**
  *Symptoms*: **What steps will reproduce the bug?**  1. `export LESSOPEN='|-bat -f -pp %s' ` 2. `unset BAT_PAGER` 3. `unset PAGER` 4. Open Zsh, enable completion, type `bat -l Per<Ctrl-D>`  **What happens?**  It completes to `bat -l $'\033'\[38\;2\;248\;248\;242mPerl`  **What did you expect to happen instead?**  It should have completed to `bat -l Perl`  **How did you install `bat`?**  pacman (on Arch).  ---  **bat version and environment**  `bat 0.26.1 (v0.25.0-402-g979ba226)`
  **Post-Mortem & Fix Analysis**:
  > The issue is that the completion scripts seem to call bat (e.g. `bat --list-languages`), and then `bat` tries to send output to the pager (`less`). Because of `LESSOPEN`, the pager sends the output back to `bat` and because of the `-f` we now get garbled output...  A simple workaround is to set `BAT_PAGER="less -RFXL"` (or just something that includes `-L`).  But a better solution would be to ensure bat never tries to open a pager in the completion scripts. (E.g. call `bat` with `BAT_PAGER= bat` everytime, or `bat -P` / `bat --paging=never`)

- **Issue #3735** (2026-05-11): **Invalid values listed in `--list-languages` that fail with `-l`**
  *Symptoms*: **What steps will reproduce the bug?**  1. Enable zsh completion for bat: `autoload -Uz compinit && compinit` 2. Type `bat -l` and press <kbd>⇥ Tab</kbd> to trigger completion 3. Try to select any of these **exact** values from the completion list:    - `.clang-format`, ..., `zshrc` (see full list below)  4. Observe the error: `[bat error]: unknown syntax: '...'` when using it with a file or stdin  **What happens?**  65 out of 832 values from `--list-languages` fail with `-l` flag.  POSIX script below to verify:  ```bash #!/bin/sh set -e  : "${BAT_EXECUTABLE:=/opt/homebrew/bin/bat}"  count=0 total_count=0 while IFS= read -r val; do   total_count=$((total_count + 1))   ext=$(printf '%s' "$val" | cut -d':' -f1)   echo "" | "${BAT_EXECUTABLE}" --color=always --language="${ext}" >/dev/null || count=$((count + 1)) done <<EOF $("${BAT_EXECUTABLE}" --color=never --decorations=never --list-languages | awk -F':|,' '{ for (i = 1; i <= NF; ++i) printf("%s:%s\n", $i, $1) }' | sort -u) EOF  printf "\nTotal failed: %s/%s\n" "${count}" "${total_count}" ```  ```bash ./check_bat_languages.sh [bat error]: unknown syntax: '.clang-format' [bat error]: unknown syntax: '*.bash_login' [bat error]: unknown syntax: '*.bash_logout' [bat error]: unknown syntax: '*.bash_profile' [bat error]: unknown syntax: '*.bashrc' [bat error]: unknown syntax: '*.csproj' [bat error]: unknown syntax: '*.debdiff' [bat error]: unknown syntax: '*.fs' [bat error]: unknown syntax: '*.geojson' [bat error]: unknown syntax: '
  **Post-Mortem & Fix Analysis**:
  > Commit 48b4a6a9064b seems to be the culprit as `config.syntax_mapping.mappings()` returns all mappings: - User's custom `--map-syntax config` ✅ (intended) - Built-in mappings from `src/syntax_mapping/builtins/` ❌ (unintended)  These unintended patterns work for file auto-detection but not for explicit `-l` flag

- **Issue #3733** (2026-05-09): **Forced colors/decorations config will corrupt zsh -l/--theme completions**
  *Symptoms*: **What steps will reproduce the bug?**  1. Configure `bat` so that colors and decorations are always enabled, e.g.    `export BAT_OPTS='--color=always --decorations=always'` 2. Try to autocomplete `bat -l <TAB>` in `zsh` with completion enabled:    `autoload -Uz compinit && compinit` 3. The output is mangled by ANSI escape codes  Minimal reproducible **podman/docker** setup:  - run it - press <kbd>⇥ Tab</kbd> twice - make selection (<kbd>⏎ Enter</kbd>) - notice described issue  ```bash podman run --rm -qit -e BAT_OPTS='--color=always --decorations=always' alpine sh -uec ' apk add -q bat zsh {   echo "export LISTMAX=100000"   echo "zmodload zsh/complist zsh/zutil"   echo "zstyle \":completion:*\" list-prompt ''"   echo "zstyle \":completion:*\" menu select"   echo "autoload -Uz compinit && compinit"   echo "print -z -- \"bat -l \"" } > ~/.zshrc zsh' ```  **What happens?**  Config options like `--color=always` and `--decorations=always` affect `--list-languages` output.  Instead of proper completion matches, zsh inserts garbage like `$'\033'[32m...` into the prompt.  <img width="500" alt="Image" src="https://github.com/user-attachments/assets/40484fc2-62bf-4b5e-b501-ec21c083533f" />  **What did you expect to happen instead?**  `--list-languages/--list-themes` option should always output plain text, regardless of the user's config  **How did you install `bat`?**  - Homebrew and - also tested the latest commit f57c1b6b1d73f3d  ---  **bat version and environment**  ```bash /opt/ho

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

### Incident Patch 1: `dcd725dc` (2026-10-01)
**Commit Message**: build(deps): bump vedantmgoyal9/winget-releaser

Bumps [vedantmgoyal9/winget-releaser](https://github.com/vedantmgoyal9/winget-releaser) from 19e706d4c9121098010096f9c495a70a7518b30f to a8fff44b123f115ce4c21543edf8b677376fc7e0.
- [Release notes](https://github.com/vedantmgoyal9/winget-releaser/releases)
- [Commits](https://github.com/vedantmgoyal9/winget-releaser/compare/19e706d4c9121098010096f9c495a70a7518b30f...a8fff44b123f115ce4c21543edf8b677376fc7e0)

---
updated-dependencies:
- dependency-name: vedantmgoyal9/winget-releaser
  dependency-version: a8fff44b123f115ce4c21543edf8b677376fc7e0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/CICD.yml` (modified, +1/-1)
```diff
@@ -457,7 +457,7 @@ jobs:
     needs: build
     if: startsWith(github.ref, 'refs/tags/v')
     steps:
-      - uses: vedantmgoyal9/winget-releaser@19e706d4c9121098010096f9c495a70a7518b30f
+      - uses: vedantmgoyal9/winget-releaser@a8fff44b123f115ce4c21543edf8b677376fc7e0
         with:
           identifier: sharkdp.bat
           installers-regex: '-pc-windows-msvc\.zip$'
```

---

### Incident Patch 2: `4987f767` (2026-09-22)
**Commit Message**: Merge pull request #4015 from mikehasa/fix/track-strikethrough-sgr9

Track strikethrough (SGR 9) so it is not dropped across highlighted tokens

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Track strikethrough (SGR 9 / 29) in the ANSI style tracker so it is re-emitted like bold, dim, italic, and underline, and is no longer dropped after the first highlighted token when displaying ANSI input with syntax highlighting, see #4015 (@mikehasa)
 - Allow boolean flags to be given more than once, so that a flag set in the config file can also be passed on the command line without erroring, see #3912 (@logarithmone1128)
 - Use parsed CLI arguments to detect number flags, see #3908 (@cuishuang)
 - Detect binary content beyond the first line, preventing encrypted files with early line breaks from being treated as text. Closes #3554, see #3877 (@Matei02355)
```

**File**: `src/vscreen.rs` (modified, +29/-3)
```diff
@@ -173,8 +173,10 @@ impl Attributes {
                 2 => self.dim = "\x1B[2m".to_owned(),
                 3 => self.italic = "\x1B[3m".to_owned(),
                 4 => self.underline = "\x1B[4m".to_owned(),
+                9 => self.strike = "\x1B[9m".to_owned(),
                 23 => self.italic.clear(),
                 24 => self.underline.clear(),
+                29 => self.strike.clear(),
                 22 => {
                     self.bold.clear();
                     self.dim.clear();
@@ -1112,10 +1114,10 @@ mod tests {
     fn test_sgr_attributes_do_not_leak_into_wrong_field() {
         let mut attrs = crate::vscreen::Attributes::new();
 
-        // Bold, Dim, Italic, Underline, Foreground, Background
+        // Bold, Dim, Italic, Underline, Strike, Foreground, Background
         attrs.update(EscapeSequence::CSI {
-            raw_sequence: "\x1B[1;2;3;4;31;41m",
-            parameters: "1;2;3;4;31;41",
+            raw_sequence: "\x1B[1;2;3;4;9;31;41m",
+            parameters: "1;2;3;4;9;31;41",
             intermediates: "",
             final_byte: "m",
         });
@@ -1124,6 +1126,7 @@ mod tests {
         assert_eq!(attrs.dim, "\x1B[2m");
         assert_eq!(attrs.italic, "\x1B[3m");
         assert_eq!(attrs.underline, "\x1B[4m");
+        assert_eq!(attrs.strike, "\x1B[9m");
         assert_eq!(attrs.foreground, "\x1B[31m");
         assert_eq!(attrs.background, "\x1B[41m");
 
@@ -1140,4 +1143,27 @@ mod tests {
         assert_eq!(attrs.foreground, "\x1B[94m");
         assert_eq!(attrs.background, "\x1B[103m");
     }
+
+    #[test]
+    fn test_sgr_strike_is_tracked_and_cleared() {
+        let mut attrs = crate::vscreen::Attributes::new();
+
+        // Strikethrough on (SGR 9) must be tracked so it can be re-emitted.
+        attrs.update(EscapeSequence::CSI {
+            raw_sequence: "\x1B[9m",
+            parameters: "9",
+            intermediates: "",
+            final_byte: "m",
+        });
+        assert_eq!(attrs.strike, "\x1B[9m");
+
+        // Strikethrough off (SGR 29) must clear it, just like italic (23) and underline (24).
+        attrs.update(EscapeSequence::CSI {
+            raw_sequence: "\x1B[29m",
+            parameters: "29",
+            intermediates: "",
+            final_byte: "m",
+        });
+        assert_eq!(attrs.strike, "");
+    }
 }
```

**File**: `tests/integration_tests.rs` (modified, +19/-0)
```diff
@@ -3355,6 +3355,25 @@ fn ansi_sgr_joins_attributes_when_wrapped() {
             .stderr("");
 }
 
+// Ensure that strikethrough (SGR 9) is tracked like the other attributes, so it is
+// re-emitted (and therefore preserved) across a wrap boundary instead of being dropped.
+#[test]
+fn ansi_sgr_strike_joins_attributes_when_wrapped() {
+    bat()
+            .arg("--paging=never")
+            .arg("--color=never")
+            .arg("--terminal-width=20")
+            .arg("--wrap=character")
+            .arg("--decorations=always")
+            .arg("--style=plain")
+            .write_stdin("\x1B[33mColor. \x1B[9mStrike.......Struck+color.\n")
+            .assert()
+            .success()
+            .stdout("\x1B[33m\x1B[33mColor. \x1B[9m\x1B[33m\x1B[9mStrike.......\n\x1B[33m\x1B[9mStruck+color.\n")
+            // FIXME:              ~~~~~~~~       ~~~~~~~~~~~~~~~ should not be emitted twice.
+            .stderr("");
+}
+
 #[test]
 fn ignored_suffix_arg() {
     bat()
```

---

### Incident Patch 3: `16b5f99d` (2026-09-04)
**Commit Message**: Merge pull request #3908 from cuishuang/master

Use parsed CLI arguments to detect number flags

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Use parsed CLI arguments to detect number flags, see #3908 (@cuishuang)
 - Detect binary content beyond the first line, preventing encrypted files with early line breaks from being treated as text. Closes #3554, see #3877 (@Matei02355)
 - Use the last occurrence of numbering and plain flags in combined short arguments, see #3897 (@cuishuang)
 - Avoid a spurious Cargo manifest error during installation from Git, see #3899 (@rootsec1)
```

**File**: `src/bin/bat/app.rs` (modified, +10/-53)
```diff
@@ -72,59 +72,12 @@ impl App {
 
         let interactive_output = std::io::stdout().is_terminal();
 
-        // Check if the -n / --number option was passed on the command line
-        // (before merging with config file and environment variables).
-        // This is needed to honor the -n flag when piping output, similar to `cat -n`.
-        // We need to handle both standalone (-n, --number) and combined short flags (-pn, -An, etc.)
-        // Note: We only check if -n appears and is not overridden by -p in the same combined flag.
-        // For combined flags like -np, -p comes after -n and overrides it, so we don't count it.
-        // For combined flags like -pn, -n comes after -p and takes effect.
-        let number_from_cli = wild::args_os().any(|arg| {
-            let arg_str = arg.to_string_lossy();
-            if arg_str == "-n" || arg_str == "--number" {
-                return true;
-            }
-            // Handle combined short flags
-            // Only count -n if its last occurrence comes after the last -p,
-            // or if -p is not present in the combined form.
-            if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
-                let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let n_pos = chars.iter().rposition(|&c| c == 'n');
-                let p_pos = chars.iter().rposition(|&c| c == 'p');
-                // -n is in the combined flag and either:
-                // - -p is not present, OR
-                // - -n comes after -p (so -n takes effect)
-                if let Some(n) = n_pos {
-                    if p_pos.is_none() || n > p_pos.unwrap() {
-                        return true;
-                    }
-                }
-            }
-            false
-        });
-
-        // Check if the -b / --number-nonblank option was passed on the command line
-        // (before merging with config file and environment variables).
-        // This is needed to honor the -b flag when piping output, similar to `cat -b`.
-        // The same combined-flag logic applies as for -n above.
-        let number_nonblank_from_cli = wild::args_os().any(|arg| {
-            let arg_str = arg.to_string_lossy();
-            if arg_str == "-b" || arg_str == "--number-nonblank" {
-                return true;
-            }
-            // Handle combined short flags by comparing the last -b and -p occurrences.
-            if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
-                let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let b_pos = chars.iter().rposition(|&c| c == 'b');
-                let p_pos = chars.iter().rposition(|&c| c == 'p');
-                if let Some(b) = b_pos {
-                    if p_pos.is_none() || b > p_pos.unwrap() {
-                        return true;
-                    }
-                }
-            }
-            false
-        });
+        // Parse the original command line separately from config and environment arguments.
+        // Using clap here keeps CLI-only detection consistent with the final parser, including
+        // option terminators, combined short flags, and options that take values.
+        let cli_matches = Self::cli_matches(interactive_output);
+        let number_from_cli = cli_matches.get_flag("number");
+        let number_nonblank_from_cli = cli_matches.get_flag("number-nonblank");
 
         let matches = Self::matches(interactive_output)?;
 
@@ -238,6 +191,10 @@ impl App {
         args
     }
 
+    fn cli_matches(interactive_output: bool) -> ArgMatches {
+        clap_app::build_app(interactive_output).get_matches_from(wild::args_os())
+    }
+
     fn matches(interactive_output: bool) -> Result<ArgMatches> {
         // Check if we should skip config file processing for special arguments
         // that don't require full application setup (version, diagnostic)
```

**File**: `tests/integration_tests.rs` (modified, +27/-0)
```diff
@@ -250,6 +250,33 @@ fn repeated_combined_flags_use_last_number_or_plain_flag() {
         .stdout("   1 line 1\n     \n     \n     \n   2 line 5\n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n   3 line 20\n   4 line 21\n     \n     \n   5 line 24\n     \n   6 line 26\n     \n     \n     \n   7 line 30\n");
 }
 
+#[test]
+fn option_terminator_keeps_filename_from_number_flags() {
+    let tmp_dir = tempdir().expect("can create temporary directory");
+    std::fs::write(tmp_dir.path().join("-b"), "hello\nworld\n").expect("can write temporary file");
+
+    bat()
+        .current_dir(tmp_dir.path())
+        .args(["--", "-b"])
+        .assert()
+        .success()
+        .stdout("hello\nworld\n");
+}
+
+#[test]
+fn attached_short_option_values_are_not_treated_as_flags() {
+    let tmp_dir = tempdir().expect("can create temporary directory");
+    std::fs::write(tmp_dir.path().join("input.txt"), "hello\nworld\n")
+        .expect("can write temporary file");
+
+    bat()
+        .current_dir(tmp_dir.path())
+        .args(["-lbn", "input.txt"])
+        .assert()
+        .success()
+        .stdout("hello\nworld\n");
+}
+
 #[test]
 fn number_nonblank_style() {
     bat()
```

---

### Incident Patch 4: `2ed8b010` (2026-09-03)
**Commit Message**: Merge pull request #3877 from Matei02355/fix-binary-detection-across-lines-3554

Detect binary content beyond the first line

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Detect binary content beyond the first line, preventing encrypted files with early line breaks from being treated as text. Closes #3554, see #3877 (@Matei02355)
 - Use the last occurrence of numbering and plain flags in combined short arguments, see #3897 (@cuishuang)
 - Avoid a spurious Cargo manifest error during installation from Git, see #3899 (@rootsec1)
 - Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
```

**File**: `src/input.rs` (modified, +70/-2)
```diff
@@ -9,6 +9,8 @@ use content_inspector::{self, ContentType};
 
 use crate::error::*;
 
+const CONTENT_INSPECTION_LIMIT: usize = 1024;
+
 /// A description of an Input source.
 /// This tells bat how to refer to the input.
 #[derive(Clone)]
@@ -263,10 +265,29 @@ impl<'a> InputReader<'a> {
     }
 
     pub(crate) fn try_new<R: BufRead + 'a>(mut reader: R) -> io::Result<InputReader<'a>> {
+        // content_inspector scans at most 1024 bytes. Capture the already-buffered
+        // prefix before splitting out the first line so an early newline in binary
+        // data does not shorten the inspected content. This does not consume input
+        // or perform an additional read beyond the one read_until needs anyway.
+        let mut inspection_prefix = {
+            let buffered = reader.fill_buf()?;
+            buffered[..buffered.len().min(CONTENT_INSPECTION_LIMIT)].to_vec()
+        };
+
         let mut first_line = vec![];
-        reader.read_until(b'\n', &mut first_line)?;
+        if !inspection_prefix.is_empty() {
+            reader.read_until(b'\n', &mut first_line)?;
+        }
+
+        // A custom BufRead implementation may expose less than 1024 bytes at a
+        // time. Keep the old behavior for long first lines in that case.
+        let first_line_prefix_len = first_line.len().min(CONTENT_INSPECTION_LIMIT);
+        if first_line_prefix_len > inspection_prefix.len() {
+            inspection_prefix.clear();
+            inspection_prefix.extend_from_slice(&first_line[..first_line_prefix_len]);
+        }
 
-        let content_type = inspect_content_type(&first_line);
+        let content_type = inspect_content_type(&inspection_prefix);
 
         if content_type == Some(ContentType::UTF_16LE) {
             read_utf16_line(&mut reader, &mut first_line, 0x00, 0x0A)?;
@@ -410,6 +431,53 @@ fn non_zip_pk_prefix_is_not_treated_as_binary() {
     );
 }
 
+#[test]
+fn binary_detection_scans_beyond_first_line_and_preserves_input() {
+    let mut content = vec![b'a'; CONTENT_INSPECTION_LIMIT + 1];
+    content[1] = b'\n';
+    content[CONTENT_INSPECTION_LIMIT - 1] = 0;
+
+    let mut reader = InputReader::new(&content[..]);
+    assert_eq!(Some(ContentType::BINARY), reader.content_type);
+
+    let mut replayed = Vec::new();
+    while reader.read_line(&mut replayed).unwrap() {}
+    assert_eq!(content, replayed);
+
+    drop(reader);
+
+    content[CONTENT_INSPECTION_LIMIT - 1] = b'a';
+    content[CONTENT_INSPECTION_LIMIT] = 0;
+
+    let reader = InputReader::new(&content[..]);
+    assert_eq!(Some(ContentType::UTF_8), reader.content_type);
+}
+
+#[test]
+fn input_detection_does_not_read_twice() {
+    struct OneRead(Option<&'static [u8]>);
+
+    impl Read for OneRead {
+        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
+            match self.0.take() {
+                None => Err(io::Error::new(
+                    io::ErrorKind::WouldBlock,
+                    "no more data is available yet",
+                )),
+                Some(content) => {
+                    buf[..content.len()].copy_from_slice(content);
+                    Ok(content.len())
+                }
+            }
+        }
+    }
+
+    for (content, expected) in [(&b"text\n"[..], Some(ContentType::UTF_8)), (&b""[..], None)] {
+        let input = InputReader::try_new(BufReader::new(OneRead(Some(content)))).unwrap();
+        assert_eq!(expected, input.content_type);
+    }
+}
+
 #[test]
 fn input_open_returns_initial_read_errors() {
     struct FailingRead;
```

**File**: `tests/integration_tests.rs` (modified, +20/-0)
```diff
@@ -2264,6 +2264,26 @@ fn header_binary() {
         .stderr("");
 }
 
+// Regression test for https://github.com/sharkdp/bat/issues/3554
+#[test]
+fn header_binary_with_null_after_first_line() {
+    let tmp_dir = tempdir().expect("can create temporary directory");
+    let tmp_path = tmp_dir.path().join("encrypted.gpg");
+    std::fs::write(&tmp_path, b"packet-header\npayload\0bytes\n")
+        .expect("can write temporary file");
+
+    bat()
+        .arg(&tmp_path)
+        .arg("--decorations=always")
+        .arg("--style=header")
+        .arg("--line-range=0:0")
+        .arg("--file-name=encrypted.gpg")
+        .assert()
+        .success()
+        .stdout("File: encrypted.gpg   <BINARY>\n")
+        .stderr("");
+}
+
 #[test]
 fn header_zip_file_is_binary() {
     let tmp_dir = tempdir().expect("can create temporary directory");
```

---

### Incident Patch 5: `5fee86b9` (2026-09-03)
**Commit Message**: Merge branch 'master' into fix-binary-detection-across-lines-3554

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -9,6 +9,7 @@
 
 ## Features
 
+- Add `-b` / `--number-nonblank` flag to only number non-blank lines, for `cat -b` compatibility. Closes #3856, see #3857 (@MeGaurav4)
 - Add a `--sanitize=<auto|always|never>` flag for safe display of untrusted input. It implies `--strip-ansi` at the same value and additionally substitutes terminal-active control bytes (cursor moves, charset switches, beep, etc.) and Unicode bidi / zero-width formatting characters with the Unicode replacement character (U+FFFD). Mitigates Trojan-Source-style spoofing (CVE-2021-42574). See #3729 (@curious-rabbit)
 - Map justfile, Justfile, .justfile, and *.justfile to Makefile syntax highlighting, see #3623 (@zachvalenta)
 - Preserve `--diff` change markers and snip separators when `--plain` is set. Closes #3630, see #3643 (@mvanhorn)
@@ -25,6 +26,9 @@
 
 ## Bugfixes
 - Detect binary content beyond the first line, preventing encrypted files with early line breaks from being treated as text. Closes #3554, see #3877 (@Matei02355)
+- Use the last occurrence of numbering and plain flags in combined short arguments, see #3897 (@cuishuang)
+- Avoid a spurious Cargo manifest error during installation from Git, see #3899 (@rootsec1)
+- Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
 - Fix `--sanitize` passing through the bidi control characters U+200E, U+200F and U+061C, see #3862 (@lenamonj)
 - `--strip-ansi`: also strip 8-bit C1 introducers (U+0090, U+0098, U+009B, U+009D, U+009E, U+009F) and DCS/SOS/PM/APC sequence bodies, which previously passed through. See #3729 (@curious-rabbit)
```

**File**: `Cargo.lock` (modified, +10/-10)
```diff
@@ -281,9 +281,9 @@ checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
 
 [[package]]
 name = "bytesize"
-version = "2.4.2"
+version = "2.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3d7c8918969267b2932ffd5655509bbbea0833823058c378876953217f5fc50e"
+checksum = "7354288c522e7e980fafd2075d63d1285794c3a6a16cdd492f189ea406e5f18b"
 
 [[package]]
 name = "cc"
@@ -362,9 +362,9 @@ checksum = "1d07550c9036bf2ae0c684c4297d503f838287c83c53686d05370d0e139ae570"
 
 [[package]]
 name = "console"
-version = "0.16.3"
+version = "0.16.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d64e8af5551369d19cf50138de61f1c42074ab970f74e99be916646777f8fc87"
+checksum = "4fe5f465a4f6fee88fad41b85d990f84c835335e85b5d9e6e63e0d06d28cba7c"
 dependencies = [
  "encode_unicode",
  "libc",
@@ -1604,9 +1604,9 @@ checksum = "0cc23270f6e1808e30a928bdc84dea0b9b4136a8bc82338574f23baf47bbd280"
 
 [[package]]
 name = "globset"
-version = "0.4.18"
+version = "0.4.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "52dfc19153a48bde0cbd630453615c8151bce3a5adfac7a0aebfbf0a1e1f57e3"
+checksum = "07c34a9410465b45bd9787443bc7370f37735bad04b0f0cd57ff1a3186c98988"
 dependencies = [
  "aho-corasick",
  "bstr",
@@ -1705,9 +1705,9 @@ checksum = "b9e0384b61958566e926dc50660321d12159025e767c18e043daf26b70104c39"
 
 [[package]]
 name = "indexmap"
-version = "2.14.0"
+version = "2.14.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d466e9454f08e4a911e14806c24e16fba1b4c121d1ea474396f396069cf949d9"
+checksum = "07aa2048142242915a31d35844fb311e0e53fcca590c3a0a40dcf1b841fa09eb"
 dependencies = [
  "equivalent",
  "hashbrown 0.17.1",
@@ -2196,9 +2196,9 @@ dependencies = [
 
 [[package]]
 name = "regex-automata"
-version = "0.4.16"
+version = "0.4.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8fcfdb36bda0c880c5931cdc7a2bcdc8ba4556847b9d912bca70bc94708711ad"
+checksum = "ad8553b9b26413251cbf30e620595c7a41b3887f03da04579c0e6b0d6a06b4b2"
 dependencies = [
  "aho-corasick",
  "memchr",
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ cargo install --path . --locked --force
 ```
 
 If you want to build an application that uses `bat`'s pretty-printing
-features as a library, check out the [the API documentation](https://docs.rs/bat/).
+features as a library, check out the [API documentation](https://docs.rs/bat/).
 Note that you have to use either `regex-onig` or `regex-fancy` as a feature
 when you depend on `bat` as a library.
 
```

**File**: `assets/syntaxes/02_Extra/log.sublime-syntax` (modified, +23/-4)
```diff
@@ -38,22 +38,41 @@ contexts:
       scope: markup.underline.link.scheme.log
       push: url-host
   log_level_lines:
-    - match: (?=.*{{error}})
+    # Prevent retrying each lookahead at every position.
+    - match: ^(?=.*{{error}})
       push:
         - error_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{warning}})
+    - match: ^(?=.*{{warning}})
       push:
         - warning_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{info}})
+    - match: ^(?=.*{{info}})
       push:
         - info_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{debug}})
+    - match: ^(?=.*{{debug}})
       push:
         - debug_line_meta
         - main_pop_at_eol
+  # For syntaxes that embed Log after consuming a prefix. Call this context once.
+  log_level_lines_at_current_position:
+    - match: (?=.*{{error}})
+      set:
+        - error_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{warning}})
+      set:
+        - warning_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{info}})
+      set:
+        - info_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{debug}})
+      set:
+        - debug_line_meta
+        - main_pop_at_eol
   log_levels:
     - match: '{{error}}'
       scope: markup.error.log
```

**File**: `assets/syntaxes/02_Extra/syslog.sublime-syntax` (modified, +11/-1)
```diff
@@ -50,6 +50,17 @@ contexts:
     - match: (?=\])
       pop: true
   text:
+    - include: text_special
+    - match: ''
+      set: classify_log_text
+  classify_log_text:
+    - include: scope:text.log#log_level_lines_at_current_position
+    - match: ''
+      set: text_body
+  text_body:
+    - include: text_special
+    - include: scope:text.log
+  text_special:
     - match: $
       pop: true
     - match: '<\w+>'
@@ -62,4 +73,3 @@ contexts:
       escape: \)$
       escape_captures:
         0: punctuation.section.block.end.syslog
-    - include: scope:text.log
```

**File**: `doc/long-help.txt` (modified, +10/-0)
```diff
@@ -83,6 +83,16 @@ Options:
   -n, --number
           Only show line numbers, no other decorations. This is an alias for '--style=numbers'
 
+  -b, --number-nonblank
+          Only show line numbers for non-blank lines, no other decorations. This is an alias for
+          '--style=numbers'. Non-blank lines are lines that contain any character before the line
+          ending, including spaces and tabs. When used together with --number (-n),
+          --number-nonblank (-b) takes precedence.
+          
+          Example:
+            printf 'alpha\n\nbeta\n' | bat -b
+            numbers 'alpha' and 'beta', but skips the empty line.
+
       --color <when>
           Specify when to use colored output. The automatic mode only enables colors if an
           interactive terminal is detected - colors are automatically disabled if the output goes to
```

**File**: `doc/short-help.txt` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ Options:
           Truncate all lines longer than screen width. Alias for '--wrap=never'.
   -n, --number
           Show line numbers (alias for '--style=numbers').
+  -b, --number-nonblank
+          Show line numbers for non-blank lines only (alias for '--style=numbers').
       --color <when>
           When to use colors (*auto*, never, always).
       --italic-text <when>
```

**File**: `src/assets.rs` (modified, +2/-2)
```diff
@@ -363,11 +363,11 @@ impl HighlightingAssets {
         reader: &mut InputReader,
     ) -> Result<Option<SyntaxReferenceInSet<'_>>> {
         let syntax_set = self.get_syntax_set()?;
-        Ok(String::from_utf8(reader.first_line.clone())
+        Ok(std::str::from_utf8(&reader.first_line)
             .ok()
             .and_then(|l| {
                 // Strip UTF-8 BOM if present
-                let line = l.strip_prefix('\u{feff}').unwrap_or(&l);
+                let line = l.strip_prefix('\u{feff}').unwrap_or(l);
                 syntax_set.find_syntax_by_first_line(line)
             })
             .map(|syntax| SyntaxReferenceInSet { syntax, syntax_set }))
```

---

### Incident Patch 6: `66ad54c2` (2026-09-03)
**Commit Message**: Merge pull request #3897 from cuishuang/master

fix: use last occurrence in combined short flags

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Use the last occurrence of numbering and plain flags in combined short arguments, see #3897 (@cuishuang)
 - Avoid a spurious Cargo manifest error during installation from Git, see #3899 (@rootsec1)
 - Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
```

**File**: `src/bin/bat/app.rs` (modified, +7/-7)
```diff
@@ -85,12 +85,12 @@ impl App {
                 return true;
             }
             // Handle combined short flags
-            // Only count -n if it's the LAST flag in the combined form (so -p doesn't override it)
-            // or if -p is not present in the combined form
+            // Only count -n if its last occurrence comes after the last -p,
+            // or if -p is not present in the combined form.
             if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
                 let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let n_pos = chars.iter().position(|&c| c == 'n');
-                let p_pos = chars.iter().position(|&c| c == 'p');
+                let n_pos = chars.iter().rposition(|&c| c == 'n');
+                let p_pos = chars.iter().rposition(|&c| c == 'p');
                 // -n is in the combined flag and either:
                 // - -p is not present, OR
                 // - -n comes after -p (so -n takes effect)
@@ -112,11 +112,11 @@ impl App {
             if arg_str == "-b" || arg_str == "--number-nonblank" {
                 return true;
             }
-            // Handle combined short flags
+            // Handle combined short flags by comparing the last -b and -p occurrences.
             if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
                 let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let b_pos = chars.iter().position(|&c| c == 'b');
-                let p_pos = chars.iter().position(|&c| c == 'p');
+                let b_pos = chars.iter().rposition(|&c| c == 'b');
+                let p_pos = chars.iter().rposition(|&c| c == 'p');
                 if let Some(b) = b_pos {
                     if p_pos.is_none() || b > p_pos.unwrap() {
                         return true;
```

**File**: `tests/integration_tests.rs` (modified, +37/-0)
```diff
@@ -213,6 +213,43 @@ fn numbers_honored_from_cli_when_preceeded_by_plain_in_loop_through_mode() {
         .stdout("   1 line 1\n   2 line 2\n   3 line 3\n   4 line 4\n   5 line 5\n   6 line 6\n   7 line 7\n   8 line 8\n   9 line 9\n  10 line 10\n");
 }
 
+#[test]
+fn repeated_combined_flags_use_last_number_or_plain_flag() {
+    bat()
+        .arg("multiline.txt")
+        .arg("-npn")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("   1 line 1\n   2 line 2\n   3 line 3\n   4 line 4\n   5 line 5\n   6 line 6\n   7 line 7\n   8 line 8\n   9 line 9\n  10 line 10\n");
+
+    bat()
+        .arg("multiline.txt")
+        .arg("-pnp")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout(
+            "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n",
+        );
+
+    bat()
+        .arg("empty_lines.txt")
+        .arg("-pbp")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("line 1\n\n\n\nline 5\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nline 20\nline 21\n\n\nline 24\n\nline 26\n\n\n\nline 30\n");
+
+    bat()
+        .arg("empty_lines.txt")
+        .arg("-bpb")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("   1 line 1\n     \n     \n     \n   2 line 5\n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n   3 line 20\n   4 line 21\n     \n     \n   5 line 24\n     \n   6 line 26\n     \n     \n     \n   7 line 30\n");
+}
+
 #[test]
 fn number_nonblank_style() {
     bat()
```

---

### Incident Patch 7: `b5c8e101` (2026-09-01)
**Commit Message**: build(deps): bump console from 0.16.3 to 0.16.4

Bumps [console](https://github.com/console-rs/console) from 0.16.3 to 0.16.4.
- [Release notes](https://github.com/console-rs/console/releases)
- [Changelog](https://github.com/console-rs/console/blob/main/CHANGELOG.md)
- [Commits](https://github.com/console-rs/console/compare/0.16.3...0.16.4)

---
updated-dependencies:
- dependency-name: console
  dependency-version: 0.16.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -362,9 +362,9 @@ checksum = "1d07550c9036bf2ae0c684c4297d503f838287c83c53686d05370d0e139ae570"
 
 [[package]]
 name = "console"
-version = "0.16.3"
+version = "0.16.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d64e8af5551369d19cf50138de61f1c42074ab970f74e99be916646777f8fc87"
+checksum = "4fe5f465a4f6fee88fad41b85d990f84c835335e85b5d9e6e63e0d06d28cba7c"
 dependencies = [
  "encode_unicode",
  "libc",
```

---

### Incident Patch 8: `7928b4be` (2026-09-01)
**Commit Message**: build(deps): bump bytesize from 2.4.2 to 2.7.0

Bumps [bytesize](https://github.com/bytesize-rs/bytesize) from 2.4.2 to 2.7.0.
- [Release notes](https://github.com/bytesize-rs/bytesize/releases)
- [Changelog](https://github.com/bytesize-rs/bytesize/blob/master/CHANGELOG.md)
- [Commits](https://github.com/bytesize-rs/bytesize/compare/bytesize-v2.4.2...bytesize-v2.7.0)

---
updated-dependencies:
- dependency-name: bytesize
  dependency-version: 2.7.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -281,9 +281,9 @@ checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
 
 [[package]]
 name = "bytesize"
-version = "2.4.2"
+version = "2.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3d7c8918969267b2932ffd5655509bbbea0833823058c378876953217f5fc50e"
+checksum = "7354288c522e7e980fafd2075d63d1285794c3a6a16cdd492f189ea406e5f18b"
 
 [[package]]
 name = "cc"
```

---

### Incident Patch 9: `2da852dc` (2026-09-01)
**Commit Message**: build(deps): bump indexmap from 2.14.0 to 2.14.1

Bumps [indexmap](https://github.com/indexmap-rs/indexmap) from 2.14.0 to 2.14.1.
- [Changelog](https://github.com/indexmap-rs/indexmap/blob/main/RELEASES.md)
- [Commits](https://github.com/indexmap-rs/indexmap/compare/2.14.0...2.14.1)

---
updated-dependencies:
- dependency-name: indexmap
  dependency-version: 2.14.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1705,9 +1705,9 @@ checksum = "b9e0384b61958566e926dc50660321d12159025e767c18e043daf26b70104c39"
 
 [[package]]
 name = "indexmap"
-version = "2.14.0"
+version = "2.14.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d466e9454f08e4a911e14806c24e16fba1b4c121d1ea474396f396069cf949d9"
+checksum = "07aa2048142242915a31d35844fb311e0e53fcca590c3a0a40dcf1b841fa09eb"
 dependencies = [
  "equivalent",
  "hashbrown 0.17.1",
```

---

### Incident Patch 10: `b3c9516a` (2026-09-01)
**Commit Message**: build(deps): bump globset from 0.4.18 to 0.4.20

Bumps [globset](https://github.com/BurntSushi/ripgrep) from 0.4.18 to 0.4.20.
- [Release notes](https://github.com/BurntSushi/ripgrep/releases)
- [Changelog](https://github.com/BurntSushi/ripgrep/blob/master/CHANGELOG.md)
- [Commits](https://github.com/BurntSushi/ripgrep/compare/globset-0.4.18...globset-0.4.20)

---
updated-dependencies:
- dependency-name: globset
  dependency-version: 0.4.20
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -1604,9 +1604,9 @@ checksum = "0cc23270f6e1808e30a928bdc84dea0b9b4136a8bc82338574f23baf47bbd280"
 
 [[package]]
 name = "globset"
-version = "0.4.18"
+version = "0.4.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "52dfc19153a48bde0cbd630453615c8151bce3a5adfac7a0aebfbf0a1e1f57e3"
+checksum = "07c34a9410465b45bd9787443bc7370f37735bad04b0f0cd57ff1a3186c98988"
 dependencies = [
  "aho-corasick",
  "bstr",
@@ -2196,9 +2196,9 @@ dependencies = [
 
 [[package]]
 name = "regex-automata"
-version = "0.4.16"
+version = "0.4.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8fcfdb36bda0c880c5931cdc7a2bcdc8ba4556847b9d912bca70bc94708711ad"
+checksum = "ad8553b9b26413251cbf30e620595c7a41b3887f03da04579c0e6b0d6a06b4b2"
 dependencies = [
  "aho-corasick",
  "memchr",
```

---

### Incident Patch 11: `5f12c62b` (2026-08-31)
**Commit Message**: Merge pull request #3899 from rootsec1/fix/cargo-install-manifest-diagnostic

fix: avoid Cargo parsing syntax fixture as a manifest

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Avoid a spurious Cargo manifest error during installation from Git, see #3899 (@rootsec1)
 - Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
 - Fix `--sanitize` passing through the bidi control characters U+200E, U+200F and U+061C, see #3862 (@lenamonj)
```

---

### Incident Patch 12: `400c5dc6` (2026-08-31)
**Commit Message**: fix: avoid parsing syntax fixture as Cargo manifest

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Avoid a spurious Cargo manifest error during installation from Git, see #PR_NUMBER (@rootsec1)
 - Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
 - Fix `--sanitize` passing through the bidi control characters U+200E, U+200F and U+061C, see #3862 (@lenamonj)
```

---

### Incident Patch 13: `1cedc1b4` (2026-08-28)
**Commit Message**: fix: use last occurrence in combined short flags

Signed-off-by: cuishuang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Use the last occurrence of numbering and plain flags in combined short arguments, see #3897 (@cuishuang)
 - Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
 - Fix `--sanitize` passing through the bidi control characters U+200E, U+200F and U+061C, see #3862 (@lenamonj)
```

---

### Incident Patch 14: `b8430080` (2026-08-28)
**Commit Message**: fix: use last occurrence in combined short flags

Signed-off-by: cuishuang <[REDACTED_EMAIL]>

**File**: `src/bin/bat/app.rs` (modified, +7/-7)
```diff
@@ -85,12 +85,12 @@ impl App {
                 return true;
             }
             // Handle combined short flags
-            // Only count -n if it's the LAST flag in the combined form (so -p doesn't override it)
-            // or if -p is not present in the combined form
+            // Only count -n if its last occurrence comes after the last -p,
+            // or if -p is not present in the combined form.
             if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
                 let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let n_pos = chars.iter().position(|&c| c == 'n');
-                let p_pos = chars.iter().position(|&c| c == 'p');
+                let n_pos = chars.iter().rposition(|&c| c == 'n');
+                let p_pos = chars.iter().rposition(|&c| c == 'p');
                 // -n is in the combined flag and either:
                 // - -p is not present, OR
                 // - -n comes after -p (so -n takes effect)
@@ -112,11 +112,11 @@ impl App {
             if arg_str == "-b" || arg_str == "--number-nonblank" {
                 return true;
             }
-            // Handle combined short flags
+            // Handle combined short flags by comparing the last -b and -p occurrences.
             if arg_str.starts_with('-') && !arg_str.starts_with("--") && arg_str.len() > 2 {
                 let chars: Vec<char> = arg_str.chars().skip(1).collect();
-                let b_pos = chars.iter().position(|&c| c == 'b');
-                let p_pos = chars.iter().position(|&c| c == 'p');
+                let b_pos = chars.iter().rposition(|&c| c == 'b');
+                let p_pos = chars.iter().rposition(|&c| c == 'p');
                 if let Some(b) = b_pos {
                     if p_pos.is_none() || b > p_pos.unwrap() {
                         return true;
```

**File**: `tests/integration_tests.rs` (modified, +37/-0)
```diff
@@ -213,6 +213,43 @@ fn numbers_honored_from_cli_when_preceeded_by_plain_in_loop_through_mode() {
         .stdout("   1 line 1\n   2 line 2\n   3 line 3\n   4 line 4\n   5 line 5\n   6 line 6\n   7 line 7\n   8 line 8\n   9 line 9\n  10 line 10\n");
 }
 
+#[test]
+fn repeated_combined_flags_use_last_number_or_plain_flag() {
+    bat()
+        .arg("multiline.txt")
+        .arg("-npn")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("   1 line 1\n   2 line 2\n   3 line 3\n   4 line 4\n   5 line 5\n   6 line 6\n   7 line 7\n   8 line 8\n   9 line 9\n  10 line 10\n");
+
+    bat()
+        .arg("multiline.txt")
+        .arg("-pnp")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout(
+            "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n",
+        );
+
+    bat()
+        .arg("empty_lines.txt")
+        .arg("-pbp")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("line 1\n\n\n\nline 5\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nline 20\nline 21\n\n\nline 24\n\nline 26\n\n\n\nline 30\n");
+
+    bat()
+        .arg("empty_lines.txt")
+        .arg("-bpb")
+        .arg("--decorations=auto")
+        .assert()
+        .success()
+        .stdout("   1 line 1\n     \n     \n     \n   2 line 5\n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n     \n   3 line 20\n   4 line 21\n     \n     \n   5 line 24\n     \n   6 line 26\n     \n     \n     \n   7 line 30\n");
+}
+
 #[test]
 fn number_nonblank_style() {
     bat()
```

---

### Incident Patch 15: `af59a321` (2026-08-10)
**Commit Message**: Merge pull request #3876 from Matei02355/fix-log-syntax-performance-3866

fix(syntax): avoid repeated log level scans

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
 - Syntax highlighting for Python files using uv as script runner in shebang #3689 (@janlarres)
 
 ## Bugfixes
+- Avoid repeated scans of long lines in Log syntax highlighting, see #3876 (@Matei02355)
 - Fix `--list-languages` respecting `--paging=never`, see #3828 (@cyphercodes)
 - Fix `--sanitize` passing through the bidi control characters U+200E, U+200F and U+061C, see #3862 (@lenamonj)
 - `--strip-ansi`: also strip 8-bit C1 introducers (U+0090, U+0098, U+009B, U+009D, U+009E, U+009F) and DCS/SOS/PM/APC sequence bodies, which previously passed through. See #3729 (@curious-rabbit)
```

**File**: `assets/syntaxes/02_Extra/log.sublime-syntax` (modified, +23/-4)
```diff
@@ -38,22 +38,41 @@ contexts:
       scope: markup.underline.link.scheme.log
       push: url-host
   log_level_lines:
-    - match: (?=.*{{error}})
+    # Prevent retrying each lookahead at every position.
+    - match: ^(?=.*{{error}})
       push:
         - error_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{warning}})
+    - match: ^(?=.*{{warning}})
       push:
         - warning_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{info}})
+    - match: ^(?=.*{{info}})
       push:
         - info_line_meta
         - main_pop_at_eol
-    - match: (?=.*{{debug}})
+    - match: ^(?=.*{{debug}})
       push:
         - debug_line_meta
         - main_pop_at_eol
+  # For syntaxes that embed Log after consuming a prefix. Call this context once.
+  log_level_lines_at_current_position:
+    - match: (?=.*{{error}})
+      set:
+        - error_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{warning}})
+      set:
+        - warning_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{info}})
+      set:
+        - info_line_meta
+        - main_pop_at_eol
+    - match: (?=.*{{debug}})
+      set:
+        - debug_line_meta
+        - main_pop_at_eol
   log_levels:
     - match: '{{error}}'
       scope: markup.error.log
```

**File**: `assets/syntaxes/02_Extra/syslog.sublime-syntax` (modified, +11/-1)
```diff
@@ -50,6 +50,17 @@ contexts:
     - match: (?=\])
       pop: true
   text:
+    - include: text_special
+    - match: ''
+      set: classify_log_text
+  classify_log_text:
+    - include: scope:text.log#log_level_lines_at_current_position
+    - match: ''
+      set: text_body
+  text_body:
+    - include: text_special
+    - include: scope:text.log
+  text_special:
     - match: $
       pop: true
     - match: '<\w+>'
@@ -62,4 +73,3 @@ contexts:
       escape: \)$
       escape_captures:
         0: punctuation.section.block.end.syslog
-    - include: scope:text.log
```

#### Recent Merged Pull Requests:
- **PR #4027** (2026-10-01): build(deps): bump vedantmgoyal9/winget-releaser from 19e706d4c9121098010096f9c495a70a7518b30f to a8fff44b123f115ce4c21543edf8b677376fc7e0 (@dependabot[bot])
- **PR #4015** (2026-09-22): Track strikethrough (SGR 9) so it is not dropped across highlighted tokens (@mikehasa)
- **PR #4011** (closed): docs: clarify supported custom theme format in the man page (@Jorge-Polanco-Roque)
- **PR #4008** (closed): Add --markdown-tables to lay out Markdown tables (@Arya-Programmer)
- **PR #4006** (closed): Fix fish completions breaking under subshell-based evaluation (@voidstackloop)
- **PR #4002** (closed): fix: --list-themes ignores BAT_OPTS --paging=always (@yunaremaia)
- **PR #3936** (closed): docs: update MSRV in README from 1.79 to 1.88 (@yunaremaia)
- **PR #3912** (2026-09-04): Allow boolean flags to be repeated (@logarithmone1128)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
