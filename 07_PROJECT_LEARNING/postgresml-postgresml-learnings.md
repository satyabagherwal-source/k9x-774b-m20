# Forensic Learning Record (Deep Inspection): postgresml/postgresml

> **Canonical Artifact**: `07_PROJECT_LEARNING/postgresml-postgresml-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/postgresml/postgresml](https://github.com/postgresml/postgresml))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:34.430Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `postgresml/postgresml`
- **Description**: Postgres with GPUs for ML/AI apps.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6823 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cargo-pgml-components/src/backend/mod.rs`
```


```

### Core Architecture Module: `packages/cargo-pgml-components/src/config.rs`
```
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Javascript {
    #[serde(default = "Javascript::default_additional_paths")]
    pub additional_paths: Vec<String>,
}

impl Javascript {
    fn default_additional_paths() -> Vec<String> {
        vec![]
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Config {
    pub javascript: Javascript,
}

impl Config {
    pub fn from_path(path: &str) -> anyhow::Result<Config> {
        let config_str = std::fs::read_to_string(path)?;
        let config: Config = toml::from_str(&config_str)?;
        Ok(config)
    }

    pub fn load() -> Config {
        match Self::from_path("pgml-components.toml") {
            Ok(config) => config,
            Err(_) => Config::default(),
        }
    }
}

```

### Core Architecture Module: `packages/cargo-pgml-components/src/frontend/components.rs`
```
use convert_case::{Case, Casing};
use regex::Regex;
use sailfish::TemplateOnce;
use std::fs::{create_dir_all, read_dir, read_to_string};
use std::path::{Path, PathBuf};
use std::process::exit;

use crate::frontend::templates;
use crate::util::{compare_strings, error, info, unwrap_or_exit, write_to_file};

static COMPONENT_DIRECTORY: &'static str = "src/components";
static COMPONENT_NAME_REGEX: &'static str = "^[a-zA-Z]+[a-zA-Z0-9_/-]*$";

#[derive(Clone)]
pub struct Component {
    name: String,
    path: PathBuf,
    is_node: bool,
}

impl Component {
    /// Create a new component.
    ///
    /// # Arguments
    ///
    /// * `name` - The name of the component.
    /// * `path` - The path of the component, relative to `src/components`.
    ///
    pub fn new(name: &str, path: &Path) -> Component {
        let full_path = Path::new(COMPONENT_DIRECTORY).join(path);

        Component {
            name: name.to_owned(),
            path: path.to_owned(),
            is_node: has_more_modules(&full_path),
        }
    }

    pub fn path(&self) -> String {
        self.path.display().to_string()
    }

    pub fn name(&self) -> String {
        self.name.to_case(Case::Snake).to_string()
    }

    pub fn is_node(&self) -> bool {
        self.is_node
    }

    pub fn rust_name(&self) -> String {
        self.name.to_case(Case::UpperCamel).to_string()
    }

    pub fn full_path(&self) -> PathBuf {
        Path::new(COMPONENT_DIRECTORY).join(&self.path).to_owned()
    }

    pub fn controller_name(&self) -> String {
        self.path
            .components()
            .map(|c| c.as_os_str().to_str().expect("os path valid utf-8"))
            .collect::<Vec<&str>>()
            .join("-")
            .replace("_", "-")
            .to_string()
    }

    pub fn controller_path(&self) -> String {
        format!("{}_controller.js", self.name().to_case(Case::Snake))
    }
}

impl From<&Path> for Component {
    fn from(path: &Path) -> Self {
        let components = path.components();
        let name = components
            .clone()
            .last()
            .unwrap()
            .as_os_str()
            .to_str()
            .unwrap();
        Component::new(name, path)
    }
}

/// Add a new component.
pub fn add(path: &Path, overwrite: bool, template_only: bool) {
    if let Some(_extension) = path.extension() {
        error("component name should not contain an extension");
        exit(1);
    }

    if !path_rust_safe(path) {
        error("component name contains Rust keywords");
        exit(1);
    }

    let regex = Regex::new(COMPONENT_NAME_REGEX).unwrap();

    if !regex.is_match(&path.to_str().unwrap()) {
        error("component name is not valid");
        exit(1);
    }

    let path = path
        .components()
        .map(|c| {
            c.as_os_str()
                .to_str()
                .expect("utf-8 component")
                .replace("-", "_")
                .to_case(Case::Snake)
        })
        .collect::<PathBuf>();

    let mut parent = path.parent().expect("paths should have parents");
    let mut full_path = Path::new(COMPONENT_DIRECTORY).join(parent);

    while full_path != Path::new(COMPONENT_DIRECTORY) {
        debug!("testing full path: {}", full_path.display());

        if full_path.exists()
            && full_path != Path::new(COMPONENT_DIRECTORY) // Not a top-level compoment
            && !has_more_modules(&full_path)
        // Directory contains a module already.
        {
            error("component cannot be placed into a directory that has a component already");
            exit(1);
        }

        parent = parent.parent().expect("paths should have parents");
        full_path = Path::new(COMPONENT_DIRECTORY).join(parent);
    }

    let component = Component::from(path.as_path());
    let path = component.full_path();

    if path.exists() && !overwrite {
        error(&format!("component {} already exists", component.path()));
        exit(1);
    } else {
        unwrap_or_exit!(create_dir_all(&path));
        info(&format!("created directory {}", path.display()));
    }

    let rust = unwrap_or_exit!(templates::Component::new(&component).render_once());
    let stimulus = unwrap_or_exit!(templates::Stimulus::new(&component).render_once());
    let html = unwrap_or_exit!(templates::Html::new(&component).render_once());
    let scss = unwrap_or_exit!(templates::Sass::new(&component).render_once());

    let html_path = path.join("template.html");
    unwrap_or_exit!(write_to_file(&html_path, &html));
    info(&format!("written {}", html_path.display()));

    if !template_only {
        let stimulus_path = path.join(&component.controller_path());
        unwrap_or_exit!(write_to_file(&stimulus_path, &stimulus));
        info(&format!("written {}", stimulus_path.display()));
    }

    let rust_path = path.join("mod.rs");
    unwrap_or_exit!(write_to_file(&rust_path, &rust));
    info(&format!("written {}", rust_path.display()));

    if !template_only {
        let scss_path = path.join(&format!("{}.scss", component.name()));
        unwrap_or_exit!(write_to_file(&scss_path, &scss));
        info(&format!("written {}", scss_path.display()));
    }

    update_modules();
}

/// Update `mod.rs` with all the components in `src/components`.
pub fn update_modules() {
    update_module(Path::new(COMPONENT_DIRECTORY));
}

/// Recusively write `mod.rs` in every Rust module directory
/// that has other modules in it.
fn update_module(path: &Path) {
    debug!("updating {} module", path.display());
    let mut modules = Vec::new();
    let mut paths: Vec<_> = unwrap_or_exit!(read_dir(path))
        .map(|p| p.unwrap())
        .collect();
    paths.sort_by_key(|dir| dir.path());

    for path in paths {
        let path = path.path();
        if path.is_file() {
            continue;
        }

        if has_more_modules(&path) {
            update_module(&path);
        }

        let component_path = path.components().skip(2).collect::<PathBuf>();
        let component = Component::from(Path::new(&component_path));
        modules.push(component);
    }

    debug!("writing {} modules to mod.rs", modules.len());

    let components_mod = path.join("mod.rs");
    let modules = unwrap_or_exit!(templates::Mod { modules }.render_once()).replace("\n\n", "\n");

    let existing_modules = if components_mod.is_file() {
        unwrap_or_exit!(read_to_string(&components_mod))
    } else {
        String::new()
    };

    if !compare_strings(&modules, &existing_modules) {
        debug!("{}/mod.rs is different", components_mod.display());
        unwrap_or_exit!(write_to_file(&components_mod, &modules));
        info(&format!("written {}", components_mod.display().to_string()));
    }

    debug!("{}/mod.rs is different", components_mod.display());
}

/// Check that the path has more Rust modules.
fn has_more_modules(path: &Path) -> bool {
    debug!("checking if {} has more modules", path.display());

    if !path.exists() {
        debug!("path {} does not exist", path.display());
        return false;
    }

    assert!(path.is_dir());

    for path in unwrap_or_exit!(read_dir(path)) {
        let dir_entry = unwrap_or_exit!(path);
        let path = dir_entry.path();

        if path.is_dir() {
            continue;
        }

        if let Some(file_name) = path.file_name() {
            if file_name != "mod.rs" {
                debug!("{} has another file that's not mod.rs", path.display());
                return false;
            }
        }
    }

    true
}

fn path_rust_safe(path: &Path) -> bool {
    let components = path.components();

    for component in components {
        let name = component
            .as_os_str()
            .to_str()
            .expect("os string to be valid utf-8");
        if KEYWORDS.contains(&name) {
            return false;
        }
    }

    true
}

static KEYWORDS: &[&str] = &[
    // STRICT, 2015
    "as",
    "break",
    "const",
    "c
```

### Core Architecture Module: `packages/cargo-pgml-components/src/frontend/javascript.rs`
```
//! Javascript bundling.

use glob::glob;
use std::collections::{HashMap, HashSet};
use std::fs::{copy, read_to_string, remove_file, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{exit, Command};

use convert_case::{Case, Casing};
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::frontend::tools::execute_with_nvm;
use crate::util::{error, info, unwrap_or_exit, warn};

/// The name of the JS file that imports all other JS files
/// created in the modules.
static MODULES_FILE: &'static str = "static/js/modules.js";

/// The JS bundle.
static JS_FILE: &'static str = "static/js/bundle.js";
static JS_FILE_HASHED: &'static str = "static/js/bundle.{}.js";
static JS_HASH_FILE: &'static str = "static/js/.pgml-bundle";

/// Finds all the JS files we have generated or the user has created.
static MODULES_GLOB: &'static str = "src/components/**/*.js";
static STATIC_JS_GLOB: &'static str = "static/js/*.js";

/// Finds old JS bundles we created.
static OLD_BUNLDES_GLOB: &'static str = "static/js/*.*.js";

/// JS compiler
static JS_COMPILER: &'static str = "rollup";

#[derive(Serialize, Deserialize, Debug)]
struct Packages {
    dependencies: HashMap<String, String>,
}

/// Delete old bundles we may have created.
fn cleanup_old_bundles() {
    // Clean up old bundles
    for file in unwrap_or_exit!(glob(OLD_BUNLDES_GLOB)) {
        let file = unwrap_or_exit!(file);
        debug!("removing {}", file.display());
        unwrap_or_exit!(remove_file(file.clone()));
        warn(&format!("deleted {}", file.display()));
    }
}

fn assemble_modules(config: Config) {
    let js = unwrap_or_exit!(glob(MODULES_GLOB));
    let mut js = js
        .chain(unwrap_or_exit!(glob(STATIC_JS_GLOB)))
        .collect::<Vec<_>>();

    for path in &config.javascript.additional_paths {
        debug!("adding additional path to javascript bundle: {}", path);
        js = js
            .into_iter()
            .chain(unwrap_or_exit!(glob(path)))
            .collect::<Vec<_>>();
    }

    // Don't bundle artifacts we produce.
    let js = js.iter().filter(|path| {
        let path = path.as_ref().unwrap();
        let path = path.display().to_string();

        !path.contains("main.") && !path.contains("bundle.") && !path.contains("modules.")
    });

    let mut modules = unwrap_or_exit!(File::create(MODULES_FILE));

    unwrap_or_exit!(writeln!(&mut modules, "// Build with --bin components"));
    unwrap_or_exit!(writeln!(
        &mut modules,
        "import {{ Application }} from '@hotwired/stimulus'"
    ));
    unwrap_or_exit!(writeln!(
        &mut modules,
        "const application = Application.start()"
    ));

    let mut dup_check = HashSet::new();

    // You can have controllers in static/js
    // or in their respective components folders.
    for source in js {
        let source = unwrap_or_exit!(source);

        let full_path = source.display().to_string();

        let path = source.components().collect::<Vec<_>>();

        assert!(!path.is_empty());

        let path = path.iter().collect::<PathBuf>();
        let components = path.components();
        let file_stem = path.file_stem().unwrap().to_str().unwrap().to_string();
        let controller_name = if file_stem.ends_with("controller") {
            let mut parts = vec![];

            let pp = components
                .map(|c| c.as_os_str().to_str().expect("component to be valid utf-8"))
                .filter(|c| !c.ends_with(".js"))
                .collect::<Vec<&str>>();
            let mut saw_src = false;
            let mut saw_components = false;
            for p in pp {
                if p == "src" {
                    saw_src = true;
                } else if p == "components" {
                    saw_components = true;
                } else if saw_src && saw_components {
                    parts.push(p);
                }
            }

            assert!(!parts.is_empty());

            parts.join("_")
        } else {
            file_stem
        };
        let upper_camel = controller_name.to_case(Case::UpperCamel).to_string();
        let controller_name = controller_name.replace("_", "-");

        if !dup_check.insert(controller_name.clone()) {
            error(&format!("duplicate controller name: {}", controller_name));
            exit(1);
        }

        unwrap_or_exit!(writeln!(
            &mut modules,
            "import {{ default as {} }} from '../../{}'",
            upper_camel, full_path
        ));

        unwrap_or_exit!(writeln!(
            &mut modules,
            "application.register('{}', {})",
            controller_name, upper_camel
        ));
    }

    info(&format!("written {}", MODULES_FILE));
}

pub fn bundle(config: Config, minify: bool) {
    cleanup_old_bundles();
    assemble_modules(config.clone());

    let package_json = Path::new("package.json");

    let packages: Packages = if package_json.is_file() {
        let packages = unwrap_or_exit!(read_to_string(package_json));
        unwrap_or_exit!(serde_json::from_str(&packages))
    } else {
        warn("package.json not found, can't validate rollup output");
        serde_json::from_str(r#"{"dependencies": {}}"#).unwrap()
    };

    let mut command = Command::new(JS_COMPILER);

    command
        .arg(MODULES_FILE)
        .arg("--file")
        .arg(JS_FILE)
        .arg("--format")
        .arg("es")
        .arg("-p")
        .arg("@rollup/plugin-node-resolve");

    if minify {
        command.arg("-p").arg("@rollup/plugin-terser");
    }

    // Bundle JavaScript.
    info("bundling javascript with rollup");
    let output = unwrap_or_exit!(execute_with_nvm(&mut command));

    let lines = output.split("\n");
    for line in lines {
        for (package, _version) in &packages.dependencies {
            if line.contains(package) {
                error(&format!("unresolved import: {}", package));
                exit(1);
            }
        }
    }

    info(&format!("written {}", JS_FILE));

    // Hash the bundle.
    let bundle = unwrap_or_exit!(read_to_string(JS_FILE));
    let hash = format!("{:x}", md5::compute(bundle))
        .chars()
        .take(8)
        .collect::<String>();

    unwrap_or_exit!(copy(JS_FILE, &JS_FILE_HASHED.replace("{}", &hash)));
    info(&format!("written {}", JS_FILE_HASHED.replace("{}", &hash)));

    // Legacy, remove code from main.js into respective modules.
    unwrap_or_exit!(copy(
        "static/js/main.js",
        &format!("static/js/main.{}.js", &hash)
    ));
    info(&format!(
        "written {}",
        format!("static/js/main.{}.js", &hash)
    ));

    let mut hash_file = unwrap_or_exit!(File::create(JS_HASH_FILE));
    unwrap_or_exit!(writeln!(&mut hash_file, "{}", hash));

    info(&format!("written {}", JS_HASH_FILE));
}

```

### Core Architecture Module: `packages/cargo-pgml-components/src/frontend/mod.rs`
```
pub mod components;
pub mod javascript;
pub mod sass;
pub mod templates;
pub mod tools;

```

### Core Architecture Module: `packages/cargo-pgml-components/src/frontend/sass.rs`
```
//! Collect and compile SASS files to produce CSS stylesheets.

use glob::glob;
use std::fs::{copy, read_to_string, remove_file, File};
use std::io::Write;
use std::process::Command;

use crate::frontend::tools::execute_with_nvm;
use crate::util::{info, unwrap_or_exit, warn};

/// The name of the SASS file that imports all other SASS files
/// created in the modules.
static MODULES_FILE: &'static str = "static/css/modules.scss";

/// The SASS file assembling all other files.
static SASS_FILE: &'static str = "static/css/bootstrap-theme.scss";

/// The CSS bundle.
static CSS_FILE: &'static str = "static/css/style.css";
static CSS_FILE_HASHED: &'static str = "static/css/style.{}.css";
static CSS_HASH_FILE: &'static str = "static/css/.pgml-bundle";

/// Finds all the SASS files we have generated or the user has created.
static MODULES_GLOB: &'static str = "src/components/**/*.scss";

/// Finds old CSS bundles we created.
static OLD_BUNLDES_GLOB: &'static str = "static/css/style.*.css";

/// Sass compiler
static SASS_COMPILER: &'static str = "sass";

/// Find Sass files and register them with modules.scss.
fn assemble_modules() {
    // Assemble SCSS.
    let scss = unwrap_or_exit!(glob(MODULES_GLOB));

    let mut modules = unwrap_or_exit!(File::create(MODULES_FILE));

    unwrap_or_exit!(writeln!(
        &mut modules,
        "// This file is automatically generated."
    ));
    unwrap_or_exit!(writeln!(
        &mut modules,
        "// There is no need to edit it manually."
    ));
    unwrap_or_exit!(writeln!(&mut modules, ""));

    for stylesheet in scss {
        let stylesheet = unwrap_or_exit!(stylesheet);

        debug!("Adding '{}' to SCSS bundle", stylesheet.display());

        let line = format!(r#"@import "../../{}";"#, stylesheet.display());

        unwrap_or_exit!(writeln!(&mut modules, "{}", line));
    }

    info(&format!("written {}", MODULES_FILE));
}

/// Delete old bundles we may have created.
fn cleanup_old_bundles() {
    // Clean up old bundles
    for file in unwrap_or_exit!(glob(OLD_BUNLDES_GLOB)) {
        let file = unwrap_or_exit!(file);
        debug!("removing {}", file.display());
        unwrap_or_exit!(remove_file(file.clone()));
        warn(&format!("deleted {}", file.display()));
    }
}

/// Entrypoint.
pub fn bundle() {
    assemble_modules();
    cleanup_old_bundles();

    // Build Sass.
    info("bundling css with sass");
    unwrap_or_exit!(execute_with_nvm(
        Command::new(SASS_COMPILER).arg(SASS_FILE).arg(CSS_FILE),
    ));

    info(&format!("written {}", CSS_FILE));

    // Hash the bundle to bust all caches.
    let bundle = read_to_string(CSS_FILE).expect("failed to read bundle.css");
    let hash = format!("{:x}", md5::compute(bundle))
        .chars()
        .take(8)
        .collect::<String>();

    let hash_file = CSS_FILE_HASHED.replace("{}", &hash);

    unwrap_or_exit!(copy(CSS_FILE, &hash_file));
    info(&format!("written {}", hash_file));

    let mut hash_file = unwrap_or_exit!(File::create(CSS_HASH_FILE));
    unwrap_or_exit!(writeln!(&mut hash_file, "{}", hash));

    info(&format!("written {}", CSS_HASH_FILE));
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1595** (2024-07-31): **Docker: pgml-dashboard not starting**
  *Symptoms*: Following the issues described in [the issue 1593](https://github.com/postgresml/postgresml/issues/1593). Following the instructing in the docker-quickstart, the pgml-dashboard is not running. Issues looks to be a missing variable: `SITE_SEARCH_DATABASE_URL` modifying the `dashboard.sh` by adding: `export SITE_SEARCH_DATABASE_URL=postgres://postgresml:postgresml@127.0.0.1:5432/postgresml` will do the trick.
  **Post-Mortem & Fix Analysis**:
  > I had to make this same change to get the dashboard running locally. Glad to hear that this fix also works for the Docker image.
  > @SilasMarvin  We may need to copy `.env.development` to `.env` as part of the docker build.
  > > @SilasMarvin We may need to copy `.env.development` to `.env` as part of the docker build.  This should be an easy fix. Need to add it here: https://github.com/postgresml/postgresml/blob/fd1e3f87633f863b210ea28bed9e1ecc6f3deae4/docker/dashboard.sh#L4  I can get this fixed today.

- **Issue #1469** (2025-01-15): **Math does not render correctly on the website**
  *Symptoms*: There are equations that do not render correctly on the [website](https://postgresml.org/docs/api/sql-extension/pgml.transform/text-generation#beam-search ). They do, however, appear to render correctly on [Github](https://github.com/postgresml/postgresml/blob/master/pgml-cms/docs/api/sql-extension/pgml.transform/text-generation.md). (cc: @chillenberger)
  **Post-Mortem & Fix Analysis**:
  > I'm on Brave browser version 1.65.133 on macOS FWIW
  > Seems to be resolved now

- **Issue #1401** (2024-05-20): **Transaction leak in transform_stream**
  *Symptoms*: I'm seeing this in Postgres logs when using `transform_stream`:  ``` WARNING:  there is no transaction in progress ```  which tells me there is a synchronization issue between the SQLx client and the server. It attempts to solve that by issuing a rollback and that's the warning that pops up. I'm guessing this has something to do with the `Stream` implementation for the `Transaction`, but I haven't been able to trace it. The transaction is probably getting dropped (or leaked).  Imo if we can we should simplify that implementation a bit, maybe by defining less standard-compliant iterators and more custom ones that we manually iterate on using `while let Some(v) = stream_iterator.next().await`.

- **Issue #1326** (2024-02-23): **pgml.train does not properly escape relation_name**
  *Symptoms*: It appears pgml.train does not properly escape the relation_name.  Relations can start with numbers and contain all kinds of crazy characters. Postgres allows these relations by using the syntax "schema"."relation_name" to escape such as:  ```SQL postgres=# select count(*) from "public"."08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml";  count  -------  10000 (1 row) ```  However, pgml.trian fails to find the relation when escaping the relation_name as follows: ```SQL postgres=# SELECT * FROM pgml.train('my_project', 'classification', '"public"."08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml"', 'failure', 'xgboost'); INFO:  Snapshotting table ""public"."08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml"", this may take a little while... ERROR:  Relation ""public"".""08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml"" doesn't exist (snapshot.rs:747) ```  Or if you prefer without quotes: ```SQL postgres=# SELECT * FROM pgml.train('my_project', 'classification', 'public.08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml', 'failure', 'xgboost'); INFO:  Snapshotting table "public.08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml", this may take a little while... ERROR:  syntax error at or near ".08e56" LINE 1: ... "tool_wear_time", "torque", "failure" FROM public.08e56f36-...                                                              ^ QUERY:  SELECT "process_temp", "tool_wear_time", "torque", "failure" FROM public.08e56f36-7c89-4eea-9b17-0ab9785e6b2b_pgml ```  
  **Post-Mortem & Fix Analysis**:
  > Pushed a PR with a fix. To make this work, remove the double quotes (as you did in your second example) when passing the table name into `pgml.train()`.  We could remove the quotes there internally, but ideally we move to use [`regclass`](https://www.postgresql.org/docs/14/datatype-oid.html) instead of `text` for this column.
  > Great thank you!

- **Issue #1309** (2024-04-29): **rust-xgboost doesn't build on Mac OS**
  *Symptoms*: rust-xgboost from our fork in postgresml/rust-xgboost doesn't build on Mac OS since the migration to v2.0.  To reproduce on a Mac:  1. Checkout the repo `postgresml/rust-xgboost` 2. `git submodule update --init --recursive` 3. `cargo build`  An error similar to:  ```     | 365 |     pub static std_value: _Tp;     |                           ^^^ not found in this scope ```  will appear.  Reverting to commit `3d4bd10b70117b94367d3c300d233252a204061d` fixes the compilation issue.
  **Post-Mortem & Fix Analysis**:
  > I went into the bindgen-generated file in `postgresml/pgml-extension/target/debug/build/xgboost-sys-00829db49cff0fdf/out/bindings.rs:365:27` (your path will differ, but it'll be in the error message) and manually removed:  ```rust extern "C" {     #[link_name = "\u{1}value"]     pub static std_value: _Tp; } ```  This worked and compiled and ran fine.

- **Issue #1070** (2025-01-15): **ImportError: \nDebertaV2Converter requires the protobuf library but it was not found in your environment**
  *Symptoms*: Trying to use "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli" for zero-shot-classification and am getting this error: ``` {"error":"error returned from database: worker error: Traceback (most recent call last):\n File \"\", line 227, in  transform\n File \"\", line 201, in create_pipeline\n File \"\", line 167, in __init__\n File \"/var/lib/postgresml-python/pgml- venv/lib/python3.10/site-packages/transformers/pipelines/__init__.py\", line 885, in pipeline\n tokenizer =  AutoTokenizer.from_pretrained(\n File \"/var/lib/postgresml-python/pgml-venv/lib/python3.10/site- packages/transformers/models/auto/tokenization_auto.py\", line 702, in from_pretrained\n return  tokenizer_class.from_pretrained(pretrained_model_name_or_path, *inputs, **kwargs)\n File \"/var/lib/postgresml- python/pgml-venv/lib/python3.10/site-packages/transformers/tokenization_utils_base.py\", line 1841, in  from_pretrained\n return cls._from_pretrained(\n File \"/var/lib/postgresml-python/pgml-venv/lib/python3.10/site- packages/transformers/tokenization_utils_base.py\", line 2004, in _from_pretrained\n tokenizer = cls(*init_inputs,  **init_kwargs)\n File \"/var/lib/postgresml-python/pgml-venv/lib/python3.10/site- packages/transformers/models/deberta_v2/tokenization_deberta_v2_fast.py\", line 133, in __init__\n super().__init__(\n  File \"/var/lib/postgresml-python/pgml-venv/lib/python3.10/site-packages/transformers/tokenization_utils_fast.py\", line  114, in __init__\n fast_tokenizer = convert_slow_to
  **Post-Mortem & Fix Analysis**:
  > I got this error too:   using this docker image image: ghcr.io/postgresml/postgresml:2.7.9
  > `protobuf` is listed as a requirement for Python in both Linux and Macos now. This should now be resolved.

- **Issue #1038** (2024-01-03): **preprocessing uses last column as target, rather than specified column**
  *Symptoms*: https://github.com/dumip/solar-production-forecast/tree/main  cc @dumip
  **Post-Mortem & Fix Analysis**:
  > fixed

- **Issue #906** (2023-08-15): **Any crash in pgml.train poisons global**
  *Symptoms*: Any error in `pgml.train()` poisons the `Lazy` instance of global state, e.g.  ``` select pgml.train('test user', 'classification', 'pgml.digits', 'target');  [...]  ERROR:  Lazy instance has previously been poisoned ```
  **Post-Mortem & Fix Analysis**:
  > Do you have an example for testing?
  > Yeah, in the latest version, remove `catboost` from the venv (`pip uninstall catboost`), and run:  ```postgresql SELECT pgml.load_dataset('digits'); SELECT pgml.train('test', 'classification', 'pgml.digits', 'target'); -- run this line twice ```  Make sure to restart the server (or close connection) after removing the dependency and before running queries.

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

### Incident Patch 1: `2d2352d4` (2025-04-16)
**Commit Message**: Fix Docker image build for Python 3.11 dependencies

- Add deadsnakes PPA to Docker image to install Python 3.11
- Install Python 3.11 and required development packages
- Remove Python 3.12 which isn't compatible with current PostgresML packages

**File**: `docker/Dockerfile` (modified, +8/-3)
```diff
@@ -9,9 +9,14 @@ RUN apt update && \
 		coreutils \
 		sudo \
 		openssl \
-		python3.12 \
-		python3.12-dev \
-		python3-pip
+		python3-pip \
+		software-properties-common
+
+# Add deadsnakes PPA for Python 3.11
+RUN add-apt-repository -y ppa:deadsnakes/ppa && \
+    apt update && \
+    apt install -y python3.11 python3.11-dev python3.11-venv python3.11-distutils
+
 RUN echo "deb [trusted=yes] https://apt.postgresml.org $(lsb_release -cs) main" > /etc/apt/sources.list.d/postgresml.list
 RUN echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
 RUN curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null
```

---

### Incident Patch 2: `8ced585a` (2025-04-15)
**Commit Message**: Fix Python 3.12 build issues

- Add wheel package dependencies for Python 3.12 virtualenv creation
- Install PyTorch before other packages to satisfy auto_gptq dependencies
- Add special handling for Python 3.12 in build script

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +8/-4)
```diff
@@ -26,20 +26,24 @@ jobs:
         UBUNTU_VERSION: ${{ matrix.ubuntu_version }}
       run: |
         sudo apt update
-        sudo apt install -y python3-dev python3-pip python3-virtualenv
+        sudo apt install -y python3-dev python3-pip python3-virtualenv software-properties-common python3-wheel-whl python3-pip-whl python3-setuptools-whl
+        
+        # Add deadsnakes PPA for all Python versions
+        sudo add-apt-repository -y ppa:deadsnakes/ppa
+        sudo apt update
         
         # Install specific Python versions based on Ubuntu target
         if [[ "$UBUNTU_VERSION" == "20.04" ]]; then
           sudo apt install -y python3.8 python3.8-dev python3.8-venv
         elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
           sudo apt install -y python3.10 python3.10-dev python3.10-venv
         elif [[ "$UBUNTU_VERSION" == "24.04" ]]; then
-          # Add deadsnakes PPA for Python 3.12 on Ubuntu 22.04
-          sudo add-apt-repository -y ppa:deadsnakes/ppa
-          sudo apt update
           sudo apt install -y python3.12 python3.12-dev python3.12-venv
         fi
         
+        # Install PyTorch before running the build script to satisfy auto_gptq's requirements
+        pip install torch --user
+        
         bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
 
   #
```

**File**: `packages/postgresml-python/build.sh` (modified, +5/-0)
```diff
@@ -49,6 +49,11 @@ fi
 virtualenv --python="python${PYTHON_VERSION}" "$deb_dir/var/lib/postgresml-python/pgml-venv"
 source "$deb_dir/var/lib/postgresml-python/pgml-venv/bin/activate"
 
+# For Python 3.12, ensure PyTorch is installed first
+if [[ "${PYTHON_VERSION}" == "3.12" ]]; then
+  python -m pip install torch
+fi
+
 python -m pip install -r "${deb_dir}/etc/postgresml-python/requirements.txt"
 
 deactivate
```

---

### Incident Patch 3: `507aaeb2` (2025-04-15)
**Commit Message**: Fix Python dependencies in GitHub workflow

Install the correct Python version for each target Ubuntu version:
- Python 3.8 for Ubuntu 20.04
- Python 3.10 for Ubuntu 22.04
- Python 3.12 for Ubuntu 24.04 (via deadsnakes PPA)

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +14/-0)
```diff
@@ -23,9 +23,23 @@ jobs:
         AWS_ACCESS_KEY_ID: ${{ vars.AWS_ACCESS_KEY_ID }}
         AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
         AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
+        UBUNTU_VERSION: ${{ matrix.ubuntu_version }}
       run: |
         sudo apt update
         sudo apt install -y python3-dev python3-pip python3-virtualenv
+        
+        # Install specific Python versions based on Ubuntu target
+        if [[ "$UBUNTU_VERSION" == "20.04" ]]; then
+          sudo apt install -y python3.8 python3.8-dev python3.8-venv
+        elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
+          sudo apt install -y python3.10 python3.10-dev python3.10-venv
+        elif [[ "$UBUNTU_VERSION" == "24.04" ]]; then
+          # Add deadsnakes PPA for Python 3.12 on Ubuntu 22.04
+          sudo add-apt-repository -y ppa:deadsnakes/ppa
+          sudo apt update
+          sudo apt install -y python3.12 python3.12-dev python3.12-venv
+        fi
+        
         bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
 
   #
```

---

### Incident Patch 4: `31c68e4e` (2025-04-15)
**Commit Message**: Fix Docker build workflow for Ubuntu 24.04

- Add postgresml-python job to workflow to build Python package first
- Update Docker build to install postgresml-python package separately
- Ensures Python 3.12 is properly used for Ubuntu 24.04

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +23/-0)
```diff
@@ -6,10 +6,33 @@ on:
       packageVersion:
         default: "2.10.0"
 jobs:
+  #
+  # PostgresML Python package.
+  #
+  postgresml-python:
+    strategy:
+      fail-fast: false
+      matrix:
+        os: ["ubuntu-22.04", "buildjet-4vcpu-ubuntu-2204-arm"]
+        ubuntu_version: ["20.04", "22.04", "24.04"]
+    runs-on: ${{ matrix.os }}
+    steps:
+    - uses: actions/checkout@v3
+    - name: Build and release Python package
+      env:
+        AWS_ACCESS_KEY_ID: ${{ vars.AWS_ACCESS_KEY_ID }}
+        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
+        AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
+      run: |
+        sudo apt update
+        sudo apt install -y python3-dev python3-pip python3-virtualenv
+        bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
+
   #
   # PostgresML extension.
   #
   postgresml-pgml:
+    needs: postgresml-python
     strategy:
       fail-fast: false # Let the other job finish
       matrix:
```

**File**: `docker/Dockerfile` (modified, +3/-1)
```diff
@@ -18,7 +18,9 @@ RUN curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | te
 
 ENV TZ=UTC
 ENV DEBIAN_FRONTEND=noninteractive
-RUN apt update -y && apt install git postgresml-17 postgresml-dashboard -y
+RUN apt update -y && \
+    apt install -y git postgresml-python && \
+    apt install -y postgresml-17 postgresml-dashboard
 RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector && \
 cd pgvector && \
 echo "trusted = true" >> vector.control && \
```

---

### Incident Patch 5: `caed6293` (2025-04-15)
**Commit Message**: Fix Python version for Ubuntu 24.04 and Docker build

- Updates Ubuntu 24.04 Python version from 3.11 to 3.12
- Adds Python 3.12 to Docker image prerequisites
- Removes deb-s3 lock in postgresml-python release script

**File**: `docker/Dockerfile` (modified, +4/-1)
```diff
@@ -8,7 +8,10 @@ RUN apt update && \
 		gnupg \
 		coreutils \
 		sudo \
-		openssl
+		openssl \
+		python3.12 \
+		python3.12-dev \
+		python3-pip
 RUN echo "deb [trusted=yes] https://apt.postgresml.org $(lsb_release -cs) main" > /etc/apt/sources.list.d/postgresml.list
 RUN echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
 RUN curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null
```

**File**: `packages/postgresml-python/build.sh` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ fi
 declare -A ubuntu_python_versions=(
   ["20.04"]="3.8"
   ["22.04"]="3.10"
-  ["24.04"]="3.11"
+  ["24.04"]="3.12"
 )
 
 if [[ -z "$3" ]]; then
```

**File**: `packages/postgresml-python/release.sh` (modified, +2/-4)
```diff
@@ -60,14 +60,12 @@ build_package() {
     exit 1
   fi
 
-  # Upload to S3 with a unique ID to avoid lock contention
+  # Upload to S3
   deb-s3 upload \
-    --lock \
     --visibility=public \
     --bucket apt.postgresml.org \
     $(package_name ${ubuntu_version} ${ARCH}) \
-    --codename ${codename} \
-    --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
+    --codename ${codename}
 
   # Clean up the package file
   rm $(package_name ${ubuntu_version} ${ARCH})
```

---

### Incident Patch 6: `270a8e17` (2025-04-15)
**Commit Message**: Fix deb-s3 locking issues in package build scripts

Removes the --lock flag and --lock-name parameter from deb-s3 upload commands across all package release scripts. This addresses the lock file errors in GitHub workflow builds.

**File**: `packages/postgresml-dashboard/release.sh` (modified, +2/-4)
```diff
@@ -57,14 +57,12 @@ build_package() {
     exit 1
   fi
 
-  # Upload to S3 with a unique ID to avoid lock contention
+  # Upload to S3
   deb-s3 upload \
-    --lock \
     --visibility=public \
     --bucket apt.postgresml.org \
     $(package_name ${ubuntu_version} ${ARCH}) \
-    --codename ${codename} \
-    --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
+    --codename ${codename}
 
   # Clean up the package file
   rm $(package_name ${ubuntu_version} ${ARCH})
```

**File**: `packages/postgresml/release.sh` (modified, +1/-3)
```diff
@@ -47,12 +47,10 @@ build_package() {
     fi
 
     deb-s3 upload \
-      --lock \
       --visibility=public \
       --bucket apt.postgresml.org \
       $(package_name ${pg} ${ubuntu_version}) \
-      --codename ${codename} \
-      --lock-name="all-${ubuntu_version}-$(date +%s)"
+      --codename ${codename}
 
     rm $(package_name ${pg} ${ubuntu_version})
   done
```

**File**: `packages/postgresql-pgml/release.sh` (modified, +2/-4)
```diff
@@ -71,14 +71,12 @@ build_packages() {
       --build "$release_dir" \
       $(package_name ${pg} ${ubuntu_version} ${ARCH})
 
-    # Upload to S3 with a unique ID to avoid lock contention
+    # Upload to S3
     deb-s3 upload \
-      --lock \
       --visibility=public \
       --bucket apt.postgresml.org \
       $(package_name ${pg} ${ubuntu_version} ${ARCH}) \
-      --codename ${codename} \
-      --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
+      --codename ${codename}
 
     # Clean up the package file
     rm $(package_name ${pg} ${ubuntu_version} ${ARCH})
```

---

### Incident Patch 7: `e24df87f` (2025-04-14)
**Commit Message**: Fix package build scripts for multi-architecture and Ubuntu version support

- Update postgresml-dashboard/release.sh to match the pattern of other release scripts
- Fix S3 upload locks by adding unique lock names with timestamps
- Add proper Ubuntu version handling to all release scripts
- Ensure sequential execution of jobs that access the S3 repository

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +2/-0)
```diff
@@ -165,6 +165,7 @@ jobs:
       fail-fast: false # Let the other job finish
       matrix:
         os: ["ubuntu-22.04"]
+        ubuntu_version: ["20.04", "22.04", "24.04"]
     runs-on: ${{ matrix.os }}
     steps:
     - uses: actions/checkout@v3
@@ -180,6 +181,7 @@ jobs:
   # PostgresML dashboard.
   #
   postgresml-dashboard:
+    needs: postgresml
     strategy:
       fail-fast: false # Let the other job finish
       matrix:
```

**File**: `packages/postgresml-dashboard/release.sh` (modified, +48/-25)
```diff
@@ -3,10 +3,11 @@ set -e
 
 SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
 package_version="$1"
+target_ubuntu_version="$2"
 
 if [[ -z "$package_version" ]]; then
   echo "postgresml dashboard package build and release script"
-  echo "Usage: $0 <package version, e.g. 2.10.0>"
+  echo "Usage: $0 <package version, e.g. 2.10.0> [ubuntu version, e.g. 22.04]"
   exit 1
 fi
 
@@ -17,8 +18,17 @@ declare -A ubuntu_versions=(
   ["24.04"]="noble"
 )
 
-# Supported architectures
-declare -a architectures=("amd64" "arm64")
+# Detect current architecture
+if [[ $(arch) == "x86_64" ]]; then
+  export ARCH=amd64
+elif [[ $(arch) == "aarch64" ]]; then
+  export ARCH=arm64
+else
+  echo "Unsupported architecture: $(arch)"
+  exit 1
+fi
+
+echo "Building for architecture: ${ARCH}"
 
 # Install deb-s3 if not present
 if ! which deb-s3; then
@@ -33,32 +43,45 @@ function package_name() {
   echo "postgresml-dashboard-${package_version}-ubuntu${ubuntu_version}-${arch}.deb"
 }
 
-# Loop through Ubuntu versions
-for ubuntu_version in "${!ubuntu_versions[@]}"; do
-  codename=${ubuntu_versions[$ubuntu_version]}
+build_package() {
+  local ubuntu_version=$1
+  local codename=$2
+  
   echo "Building packages for Ubuntu ${ubuntu_version} (${codename})"
 
-  # Loop through architectures
-  for arch in "${architectures[@]}"; do
-    echo "Building for architecture: ${arch}"
-    export ARCH=${arch}
+  # Build the dashboard package
+  bash ${SCRIPT_DIR}/build.sh "$package_version" "$ubuntu_version"
 
-    # Build the dashboard package
-    bash ${SCRIPT_DIR}/build.sh "$package_version" "$ubuntu_version"
+  if [[ ! -f $(package_name ${ubuntu_version} ${ARCH}) ]]; then
+    echo "File $(package_name ${ubuntu_version} ${ARCH}) doesn't exist"
+    exit 1
+  fi
 
-    if [[ ! -f $(package_name ${ubuntu_version} ${arch}) ]]; then
-      echo "File $(package_name ${ubuntu_version} ${arch}) doesn't exist"
-      exit 1
-    fi
+  # Upload to S3 with a unique ID to avoid lock contention
+  deb-s3 upload \
+    --lock \
+    --visibility=public \
+    --bucket apt.postgresml.org \
+    $(package_name ${ubuntu_version} ${ARCH}) \
+    --codename ${codename} \
+    --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
 
-    # Upload to S3
-    deb-s3 upload \
-      --lock \
-      --bucket apt.postgresml.org \
-      $(package_name ${ubuntu_version} ${arch}) \
-      --codename ${codename}
+  # Clean up the package file
+  rm $(package_name ${ubuntu_version} ${ARCH})
+}
 
-    # Clean up the package file
-    rm $(package_name ${ubuntu_version} ${arch})
+# If a specific Ubuntu version is provided, only build for that version
+if [[ ! -z "$target_ubuntu_version" ]]; then
+  if [[ -z "${ubuntu_versions[$target_ubuntu_version]}" ]]; then
+    echo "Error: Ubuntu version $target_ubuntu_version is not supported."
+    echo "Supported versions: ${!ubuntu_versions[@]}"
+    exit 1
+  fi
+  
+  build_package "$target_ubuntu_version" "${ubuntu_versions[$target_ubuntu_version]}"
+else
+  # If no version specified, loop through all supported Ubuntu versions
+  for ubuntu_version in "${!ubuntu_versions[@]}"; do
+    build_package "$ubuntu_version" "${ubuntu_versions[$ubuntu_version]}"
   done
-done
+fi
\ No newline at end of file
```

**File**: `packages/postgresml-python/release.sh` (modified, +4/-2)
```diff
@@ -60,12 +60,14 @@ build_package() {
     exit 1
   fi
 
-  # Upload to S3
+  # Upload to S3 with a unique ID to avoid lock contention
   deb-s3 upload \
     --lock \
+    --visibility=public \
     --bucket apt.postgresml.org \
     $(package_name ${ubuntu_version} ${ARCH}) \
-    --codename ${codename}
+    --codename ${codename} \
+    --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
 
   # Clean up the package file
   rm $(package_name ${ubuntu_version} ${ARCH})
```

**File**: `packages/postgresml/release.sh` (modified, +34/-15)
```diff
@@ -3,13 +3,22 @@ set -e
 
 SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
 package_version="$1"
+target_ubuntu_version="$2"
 
 if [[ -z "$package_version" ]]; then
   echo "postgresml package build and release script"
-  echo "usage: $0 <package version, e.g. 2.10.0>"
+  echo "usage: $0 <package version, e.g. 2.10.0> [ubuntu version, e.g. 22.04]"
   exit 1
 fi
 
+# Active LTS Ubuntu versions and their codenames
+declare -A ubuntu_codenames=(
+  ["20.04"]="focal"
+  ["22.04"]="jammy"
+  ["24.04"]="noble"
+)
+
+# Install deb-s3 if not present
 if ! which deb-s3; then
   curl -sLO https://github.com/deb-s3/deb-s3/releases/download/0.11.4/deb-s3-0.11.4.gem
   sudo gem install deb-s3-0.11.4.gem
@@ -22,18 +31,10 @@ function package_name() {
   echo "postgresml-${pg_version}-${package_version}-ubuntu${ubuntu_version}-all.deb"
 }
 
-# Active LTS Ubuntu versions
-ubuntu_versions=("20.04" "22.04" "24.04")
-
-# Map Ubuntu versions to codenames
-declare -A ubuntu_codenames=(
-  ["20.04"]="focal"
-  ["22.04"]="jammy"
-  ["24.04"]="noble"
-)
-
-for ubuntu_version in "${ubuntu_versions[@]}"; do
-  codename=${ubuntu_codenames[$ubuntu_version]}
+build_package() {
+  local ubuntu_version=$1
+  local codename=$2
+  
   echo "Building packages for Ubuntu ${ubuntu_version} (${codename})"
 
   for pg in {11..17}; do
@@ -47,10 +48,28 @@ for ubuntu_version in "${ubuntu_versions[@]}"; do
 
     deb-s3 upload \
       --lock \
+      --visibility=public \
       --bucket apt.postgresml.org \
       $(package_name ${pg} ${ubuntu_version}) \
-      --codename ${codename}
+      --codename ${codename} \
+      --lock-name="all-${ubuntu_version}-$(date +%s)"
 
     rm $(package_name ${pg} ${ubuntu_version})
   done
-done
+}
+
+# If a specific Ubuntu version is provided, only build for that version
+if [[ ! -z "$target_ubuntu_version" ]]; then
+  if [[ -z "${ubuntu_codenames[$target_ubuntu_version]}" ]]; then
+    echo "Error: Ubuntu version $target_ubuntu_version is not supported."
+    echo "Supported versions: ${!ubuntu_codenames[@]}"
+    exit 1
+  fi
+  
+  build_package "$target_ubuntu_version" "${ubuntu_codenames[$target_ubuntu_version]}"
+else
+  # If no version specified, loop through all supported Ubuntu versions
+  for ubuntu_version in "${!ubuntu_codenames[@]}"; do
+    build_package "$ubuntu_version" "${ubuntu_codenames[$ubuntu_version]}"
+  done
+fi
\ No newline at end of file
```

**File**: `packages/postgresql-pgml/release.sh` (modified, +4/-2)
```diff
@@ -71,12 +71,14 @@ build_packages() {
       --build "$release_dir" \
       $(package_name ${pg} ${ubuntu_version} ${ARCH})
 
-    # Upload to S3
+    # Upload to S3 with a unique ID to avoid lock contention
     deb-s3 upload \
       --lock \
+      --visibility=public \
       --bucket apt.postgresml.org \
       $(package_name ${pg} ${ubuntu_version} ${ARCH}) \
-      --codename ${codename}
+      --codename ${codename} \
+      --lock-name="${ARCH}-${ubuntu_version}-$(date +%s)"
 
     # Clean up the package file
     rm $(package_name ${pg} ${ubuntu_version} ${ARCH})
```

---

### Incident Patch 8: `b4b337f8` (2025-04-14)
**Commit Message**: Fix architecture-specific builds in GitHub workflows

- Modify release scripts to detect and use current architecture instead of looping through architectures
- Update GitHub workflows to use matrix for Ubuntu versions (20.04, 22.04, 24.04)
- Pass Ubuntu version from matrix to release scripts
- Fix incorrect architecture builds by ensuring binaries are compiled on the proper architecture

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +5/-3)
```diff
@@ -14,6 +14,7 @@ jobs:
       fail-fast: false # Let the other job finish
       matrix:
         os: ["buildjet-4vcpu-ubuntu-2204", "buildjet-8vcpu-ubuntu-2204-arm"]
+        ubuntu_version: ["20.04", "22.04", "24.04"]
     runs-on: ${{ matrix.os }}
     steps:
     - uses: actions/checkout@v3
@@ -152,7 +153,7 @@ jobs:
         # Always build using latest scripts
         git checkout master
 
-        bash packages/postgresql-pgml/release.sh ${{ inputs.packageVersion }}
+        bash packages/postgresql-pgml/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
 
   #
   # PostgresML meta package which installs
@@ -173,7 +174,7 @@ jobs:
         AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
         AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
       run: |
-        bash packages/postgresml/release.sh ${{ inputs.packageVersion }}
+        bash packages/postgresml/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
 
   #
   # PostgresML dashboard.
@@ -183,6 +184,7 @@ jobs:
       fail-fast: false # Let the other job finish
       matrix:
         os: ["ubuntu-22.04", "buildjet-4vcpu-ubuntu-2204-arm"]
+        ubuntu_version: ["20.04", "22.04", "24.04"]
     runs-on: ${{ matrix.os }}
     steps:
     - uses: actions/checkout@v3
@@ -196,7 +198,7 @@ jobs:
         AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
       run: |
         cargo install cargo-pgml-components
-        bash packages/postgresml-dashboard/release.sh ${{ inputs.packageVersion }}
+        bash packages/postgresml-dashboard/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
 
   #
   # PostgresML Docker image.
```

**File**: `.github/workflows/ubuntu-postgresml-python-package.yaml` (modified, +3/-2)
```diff
@@ -11,7 +11,8 @@ jobs:
     strategy:
       fail-fast: false # Let the other job finish
       matrix:
-        os: ["buildjet-4vcpu-ubuntu-2204", "buildjet-4vcpu-ubuntu-2204-arm", "ubuntu-24.04"]
+        os: ["buildjet-4vcpu-ubuntu-2204", "buildjet-4vcpu-ubuntu-2204-arm"]
+        ubuntu_version: ["20.04", "22.04", "24.04"]
     runs-on: ${{ matrix.os }}
     steps:
     - uses: actions/checkout@v3
@@ -21,4 +22,4 @@ jobs:
         AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
         AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
       run: |
-        bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }}
+        bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
```

**File**: `packages/postgresml-python/release.sh` (modified, +46/-25)
```diff
@@ -3,10 +3,11 @@ set -e
 
 SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
 package_version="$1"
+target_ubuntu_version="$2"
 
 if [[ -z "$package_version" ]]; then
   echo "postgresml-python package build and release script"
-  echo "Usage: $0 <package version, e.g. 2.10.0>"
+  echo "Usage: $0 <package version, e.g. 2.10.0> [ubuntu version, e.g. 22.04]"
   exit 1
 fi
 
@@ -17,8 +18,17 @@ declare -A ubuntu_versions=(
   ["24.04"]="noble"
 )
 
-# Supported architectures
-declare -a architectures=("amd64" "arm64")
+# Detect current architecture
+if [[ $(arch) == "x86_64" ]]; then
+  export ARCH=amd64
+elif [[ $(arch) == "aarch64" ]]; then
+  export ARCH=arm64
+else
+  echo "Unsupported architecture: $(arch)"
+  exit 1
+fi
+
+echo "Building for architecture: ${ARCH}"
 
 # Install deb-s3 if not present
 if ! which deb-s3; then
@@ -36,32 +46,43 @@ function package_name() {
   echo "postgresml-python-${package_version}-ubuntu${ubuntu_version}-${arch}.deb"
 }
 
-# Loop through Ubuntu versions
-for ubuntu_version in "${!ubuntu_versions[@]}"; do
-  codename=${ubuntu_versions[$ubuntu_version]}
+build_package() {
+  local ubuntu_version=$1
+  local codename=$2
+  
   echo "Building packages for Ubuntu ${ubuntu_version} (${codename})"
 
-  # Loop through architectures
-  for arch in "${architectures[@]}"; do
-    echo "Building for architecture: ${arch}"
-    export ARCH=${arch}
+  # Build the Python package
+  bash ${SCRIPT_DIR}/build.sh "$package_version" "$ubuntu_version"
 
-    # Build the Python package
-    bash ${SCRIPT_DIR}/build.sh "$package_version" "$ubuntu_version"
+  if [[ ! -f $(package_name ${ubuntu_version} ${ARCH}) ]]; then
+    echo "File $(package_name ${ubuntu_version} ${ARCH}) doesn't exist"
+    exit 1
+  fi
 
-    if [[ ! -f $(package_name ${ubuntu_version} ${arch}) ]]; then
-      echo "File $(package_name ${ubuntu_version} ${arch}) doesn't exist"
-      exit 1
-    fi
+  # Upload to S3
+  deb-s3 upload \
+    --lock \
+    --bucket apt.postgresml.org \
+    $(package_name ${ubuntu_version} ${ARCH}) \
+    --codename ${codename}
 
-    # Upload to S3
-    deb-s3 upload \
-      --lock \
-      --bucket apt.postgresml.org \
-      $(package_name ${ubuntu_version} ${arch}) \
-      --codename ${codename}
+  # Clean up the package file
+  rm $(package_name ${ubuntu_version} ${ARCH})
+}
 
-    # Clean up the package file
-    rm $(package_name ${ubuntu_version} ${arch})
+# If a specific Ubuntu version is provided, only build for that version
+if [[ ! -z "$target_ubuntu_version" ]]; then
+  if [[ -z "${ubuntu_versions[$target_ubuntu_version]}" ]]; then
+    echo "Error: Ubuntu version $target_ubuntu_version is not supported."
+    echo "Supported versions: ${!ubuntu_versions[@]}"
+    exit 1
+  fi
+  
+  build_package "$target_ubuntu_version" "${ubuntu_versions[$target_ubuntu_version]}"
+else
+  # If no version specified, loop through all supported Ubuntu versions
+  for ubuntu_version in "${!ubuntu_versions[@]}"; do
+    build_package "$ubuntu_version" "${ubuntu_versions[$ubuntu_version]}"
   done
-done
+fi
\ No newline at end of file
```

**File**: `packages/postgresql-pgml/release.sh` (modified, +62/-41)
```diff
@@ -4,11 +4,12 @@ set -e
 SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
 
 if [[ -z "${1}" ]]; then
-  echo "Usage: $0 <package version, e.g. 2.10.0>"
+  echo "Usage: $0 <package version, e.g. 2.10.0> [ubuntu version, e.g. 22.04]"
   exit 1
 fi
 
 export PACKAGE_VERSION=${1}
+export TARGET_UBUNTU_VERSION=${2}
 
 # Active LTS Ubuntu versions and their codenames
 declare -A ubuntu_versions=(
@@ -17,8 +18,17 @@ declare -A ubuntu_versions=(
   ["24.04"]="noble"
 )
 
-# Supported architectures
-declare -a architectures=("amd64" "arm64")
+# Detect current architecture
+if [[ $(arch) == "x86_64" ]]; then
+  export ARCH=amd64
+elif [[ $(arch) == "aarch64" ]]; then
+  export ARCH=arm64
+else
+  echo "Unsupported architecture: $(arch)"
+  exit 1
+fi
+
+echo "Building for architecture: ${ARCH}"
 
 # Install deb-s3 if not present
 if ! which deb-s3; then
@@ -36,44 +46,55 @@ function package_name() {
   echo "postgresql-pgml-${pg_version}_${PACKAGE_VERSION}-ubuntu${ubuntu_version}-${arch}.deb"
 }
 
-# Loop through Ubuntu versions
-for ubuntu_version in "${!ubuntu_versions[@]}"; do
-  codename=${ubuntu_versions[$ubuntu_version]}
+build_packages() {
+  local ubuntu_version=$1
+  local codename=$2
+  
   echo "Building packages for Ubuntu ${ubuntu_version} (${codename})"
 
-  # Loop through architectures
-  for arch in "${architectures[@]}"; do
-    echo "Building for architecture: ${arch}"
-    export ARCH=${arch}
-
-    # Loop through PostgreSQL versions
-    for pg in {11..17}; do
-      echo "Building PostgreSQL ${pg} package..."
-
-      release_dir="$extension_dir/target/release/pgml-pg${pg}"
-      mkdir -p "$release_dir/DEBIAN"
-
-      export PGVERSION=${pg}
-      # Update control file with Ubuntu version
-      (cat ${SCRIPT_DIR}/DEBIAN/control |
-       envsubst '${PGVERSION} ${PACKAGE_VERSION} ${ARCH}') > "$release_dir/DEBIAN/control"
-
-      # Build the package
-      dpkg-deb \
-        --root-owner-group \
-        -z1 \
-        --build "$release_dir" \
-        $(package_name ${pg} ${ubuntu_version} ${arch})
-
-      # Upload to S3
-      deb-s3 upload \
-        --lock \
-        --bucket apt.postgresml.org \
-        $(package_name ${pg} ${ubuntu_version} ${arch}) \
-        --codename ${codename}
-
-      # Clean up the package file
-      rm $(package_name ${pg} ${ubuntu_version} ${arch})
-    done
+  # Loop through PostgreSQL versions
+  for pg in {11..17}; do
+    echo "Building PostgreSQL ${pg} package..."
+
+    release_dir="$extension_dir/target/release/pgml-pg${pg}"
+    mkdir -p "$release_dir/DEBIAN"
+
+    export PGVERSION=${pg}
+    # Update control file with Ubuntu version
+    (cat ${SCRIPT_DIR}/DEBIAN/control |
+     envsubst '${PGVERSION} ${PACKAGE_VERSION} ${ARCH}') > "$release_dir/DEBIAN/control"
+
+    # Build the package
+    dpkg-deb \
+      --root-owner-group \
+      -z1 \
+      --build "$release_dir" \
+      $(package_name ${pg} ${ubuntu_version} ${ARCH})
+
+    # Upload to S3
+    deb-s3 upload \
+      --lock \
+      --bucket apt.postgresml.org \
+      $(package_name ${pg} ${ubuntu_version} ${ARCH}) \
+      --codename ${codename}
+
+    # Clean up the package file
+    rm $(package_name ${pg} ${ubuntu_version} ${ARCH})
+  done
+}
+
+# If a specific Ubuntu version is provided, only build for that version
+if [[ ! -z "$TARGET_UBUNTU_VERSION" ]]; then
+  if [[ -z "${ubuntu_versions[$TARGET_UBUNTU_VERSION]}" ]]; then
+    echo "Error: Ubuntu version $TARGET_UBUNTU_VERSION is not supported."
+    echo "Supported versions: ${!ubuntu_versions[@]}"
+    exit 1
+  fi
+  
+  build_packages "$TARGET_UBUNTU_VERSION" "${ubuntu_versions[$TARGET_UBUNTU_VERSION]}"
+else
+  # If no version specified, loop through all supported Ubuntu versions
+  for ubuntu_version in "${!ubuntu_versions[@]}"; do
+    build_packages "$ubuntu_version" "${ubuntu_versions[$ubuntu_version]}"
   done
-done
+fi
\ No newline at end of file
```

---

### Incident Patch 9: `a6a60f9a` (2024-10-24)
**Commit Message**: Added delete security group (#1651)

**File**: `pgml-cms/docs/cloud/enterprise/vpc.md` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ To launch a VPC in AWS you must have a user with the correct permissions.
            "ec2:ModifyInstanceAttribute",
            "ec2:DescribeSecurityGroups",
            "ec2:CreateSecurityGroup",
+           "ec2:DeleteSecurityGroup",
            "ec2:AuthorizeSecurityGroupIngress",
            "ec2:AuthorizeSecurityGroupEgress",
            "ec2:DescribeInstances",
```

---

### Incident Patch 10: `9303cb4b` (2024-10-11)
**Commit Message**: Fix bug that shape mismatch error in predict when changing objective to softmax and update rust-xgboost commit (#1636)

**File**: `pgml-extension/Cargo.lock` (modified, +2/-2)
```diff
@@ -3389,7 +3389,7 @@ dependencies = [
 [[package]]
 name = "xgboost"
 version = "0.2.0"
-source = "git+https://github.com/postgresml/rust-xgboost?branch=master#a11d05d486395dcc059abf9106af84f70b2f5291"
+source = "git+https://github.com/postgresml/rust-xgboost?branch=master#747631d5e50dcc9553f2a66988627f4ddec5b180"
 dependencies = [
  "derive_builder 0.12.0",
  "indexmap 2.1.0",
@@ -3402,7 +3402,7 @@ dependencies = [
 [[package]]
 name = "xgboost-sys"
 version = "0.2.0"
-source = "git+https://github.com/postgresml/rust-xgboost?branch=master#a11d05d486395dcc059abf9106af84f70b2f5291"
+source = "git+https://github.com/postgresml/rust-xgboost?branch=master#747631d5e50dcc9553f2a66988627f4ddec5b180"
 dependencies = [
  "bindgen",
  "cmake",
```

**File**: `pgml-extension/src/bindings/lightgbm.rs` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ impl Bindings for Estimator {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
```

**File**: `pgml-extension/src/bindings/linfa.rs` (modified, +4/-3)
```diff
@@ -8,6 +8,7 @@ use serde::{Deserialize, Serialize};
 
 use super::Bindings;
 use crate::orm::*;
+use pgrx::*;
 
 #[derive(Debug, Serialize, Deserialize)]
 pub struct LinearRegression {
@@ -58,7 +59,7 @@ impl Bindings for LinearRegression {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
@@ -187,7 +188,7 @@ impl Bindings for LogisticRegression {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
@@ -261,7 +262,7 @@ impl Bindings for Svm {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
```

**File**: `pgml-extension/src/bindings/mod.rs` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ pub trait Bindings: Send + Sync + Debug + AToAny {
     fn to_bytes(&self) -> Result<Vec<u8>>;
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized;
 }
```

**File**: `pgml-extension/src/bindings/sklearn/mod.rs` (modified, +1/-1)
```diff
@@ -197,7 +197,7 @@ impl Bindings for Estimator {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], _hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
```

#### Recent Merged Pull Requests:
- **PR #1689** (2025-07-01): summarization task with a model (@fractalliter)
- **PR #1679** (closed): Update ubuntu-packages-and-docker-image.yml (@kczimm)
- **PR #1678** (closed): Update build.sh (@kczimm)
- **PR #1677** (closed): Update build.sh (@kczimm)
- **PR #1676** (closed): Update ubuntu-packages-and-docker-image.yml (@kczimm)
- **PR #1673** (2025-01-22): Update brewfile and build docs for macos (@SilasMarvin)
- **PR #1671** (2025-01-17): Montana/package (@montanalow)
- **PR #1670** (2025-01-17): update docker container (@montanalow)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
