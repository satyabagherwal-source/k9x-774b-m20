# Forensic Learning Record (Deep Inspection): postgresml/postgresml

> **Canonical Artifact**: `07_PROJECT_LEARNING/postgresml-postgresml-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/postgresml/postgresml](https://github.com/postgresml/postgresml))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:49:35.482Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `postgresml/postgresml`
- **Description**: Postgres with GPUs for ML/AI apps.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6822 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cargo-pgml-components/src/util.rs`
```
use owo_colors::OwoColorize;
use std::fs::{read_to_string, File};
use std::io::{ErrorKind, Write};
use std::path::Path;
use std::process::Command;

macro_rules! unwrap_or_exit {
    ($i:expr) => {
        match $i {
            Ok(v) => v,
            Err(e) => {
                error!("{}:{}:{} {e}", file!(), line!(), column!());

                std::process::exit(1);
            }
        }
    };
}

macro_rules! debug1 {
    ($e:expr) => {
        debug!("{}:{}:{} {}", file!(), line!(), column!(), $e);
    };
}

pub(crate) use debug1;
pub(crate) use unwrap_or_exit;

pub fn info(value: &str) {
    println!("{}", value.green());
}

pub fn error(value: &str) {
    println!("{}", value.red());
}

pub fn warn(value: &str) {
    println!("{}", value.yellow());
}

pub fn execute_command(command: &mut Command) -> std::io::Result<String> {
    debug!("Executing {:?}", command);

    let output = match command.output() {
        Ok(output) => output,
        Err(err) => {
            return Err(err);
        }
    };

    let stderr = unwrap_or_exit!(String::from_utf8(output.stderr)).to_string();
    let stdout = unwrap_or_exit!(String::from_utf8(output.stdout)).to_string();

    if !output.status.success() {
        debug!(
            "{} failed: {}",
            command.get_program().to_str().unwrap(),
            stderr,
        );

        return Err(std::io::Error::new(ErrorKind::Other, stderr));
    }

    if !stderr.is_empty() {
        warn!("{}", stderr);
    }

    if !stdout.is_empty() {
        info!("{}", stdout);
    }

    Ok(stdout.clone() + &stderr)
}

pub fn write_to_file(path: &Path, content: &str) -> std::io::Result<()> {
    debug!("writing to file: {}", path.display());

    let mut file = File::create(path)?;

    file.write_all(content.as_bytes())?;

    Ok(())
}

#[allow(dead_code)]
pub fn compare_files(path1: &Path, path2: &Path) -> std::io::Result<bool> {
    let content1 = read_to_string(path1)?;
    let content2 = read_to_string(path2)?;

    Ok(compare_strings(&content1, &content2))
}

pub fn compare_strings(string1: &str, string2: &str) -> bool {
    // TODO: faster string comparison method needed.
    string1.trim() == string2.trim()
}

pub fn psql_output(query: &str) -> std::io::Result<String> {
    let mut cmd = Command::new("psql");
    cmd.arg("-c").arg(query).arg("-t").arg("-d").arg("postgres");

    let output = execute_command(&mut cmd)?;
    Ok(output.trim().to_string())
}

pub fn print(s: &str) {
    print!("{}", s);
    let _ = std::io::stdout().flush();
}

macro_rules! ok_or_error {
    ($what:expr, $expr:block, $howto:expr) => {{
        use std::io::Write;
        print!("{}...", $what);
        let _ = std::io::stdout().flush();

        if $expr {
            crate::util::info("ok");
        } else {
            crate::util::error("error");
            println!("{}", $howto);
            std::process::exit(1);
        }
    }};
}

pub(crate) use ok_or_error;

```

### Core Architecture Module: `pgml-dashboard/src/utils/config.rs`
```
use std::{
    borrow::Cow,
    env::var,
    path::{Path, PathBuf},
};

use lazy_static::lazy_static;

lazy_static! {
    static ref CONFIG: Config = Config::new();
}

struct Config {
    cms_dir: PathBuf,
    deployment: String,
    dev_mode: bool,
    database_url: String,
    git_sha: String,
    github_stars: String,
    sentry_dsn: Option<String>,
    signup_url: String,
    standalone_dashboard: bool,
    static_dir: PathBuf,
    search_index_dir: PathBuf,
    render_errors: bool,
    css_extension: String,
    js_extension: String,
    assets_domain: Option<String>,
}

impl Config {
    fn new() -> Config {
        let dev_mode = env_is_set("DEV_MODE");

        let signup_url = if dev_mode {
            "/signup"
        } else {
            "https://postgresml.org/signup"
        }
        .to_string();

        let cargo_manifest_dir = env!("CARGO_MANIFEST_DIR");

        let github_stars = match var("GITHUB_STARS") {
            Ok(stars) => match stars.parse::<f32>() {
                Ok(stars) => format!("{:.1}K", (stars / 1000.0)),
                _ => "1.0K".to_string(),
            },
            _ => "2.0K".to_string(),
        };

        let css_version = env!("CSS_VERSION");
        let js_version = env!("JS_VERSION");

        let css_extension = if dev_mode {
            "css".to_string()
        } else {
            format!("{css_version}.css")
        };
        let js_extension = if dev_mode {
            "js".to_string()
        } else {
            format!("{js_version}.js")
        };

        Config {
            dev_mode,
            database_url: env_string_default("DATABASE_URL", "postgres:///pgml"),
            git_sha: env!("GIT_SHA").to_string(),
            sentry_dsn: env_string_optional("SENTRY_DSN"),
            static_dir: env_path_default("DASHBOARD_STATIC_DIRECTORY", "static"),
            cms_dir: env_path_default("DASHBOARD_CMS_DIRECTORY", "../pgml-cms"),
            search_index_dir: env_path_default("SEARCH_INDEX_DIRECTORY", "search_index"),
            render_errors: env_is_set("RENDER_ERRORS") || dev_mode,
            deployment: env_string_default("DEPLOYMENT", "localhost"),
            signup_url,
            standalone_dashboard: !cargo_manifest_dir.contains("deps") && !cargo_manifest_dir.contains("cloud2"),
            github_stars,
            css_extension,
            js_extension,
            assets_domain: env_string_optional("ASSETS_DOMAIN"),
        }
    }
}

pub fn dev_mode() -> bool {
    CONFIG.dev_mode
}

pub fn database_url<'a>() -> &'a str {
    &CONFIG.database_url
}

pub fn git_sha<'a>() -> &'a String {
    &CONFIG.git_sha
}

pub fn sentry_dsn<'a>() -> &'a Option<String> {
    &CONFIG.sentry_dsn
}
pub fn static_dir<'a>() -> &'a Path {
    &CONFIG.static_dir
}

pub fn cms_dir<'a>() -> &'a Path {
    &CONFIG.cms_dir
}
pub fn search_index_dir<'a>() -> &'a Path {
    &CONFIG.search_index_dir
}
pub fn render_errors() -> bool {
    CONFIG.render_errors
}

pub fn deployment<'a>() -> &'a str {
    &CONFIG.deployment
}
pub fn signup_url<'a>() -> &'a str {
    &CONFIG.signup_url
}
pub fn standalone_dashboard() -> bool {
    CONFIG.standalone_dashboard
}

pub fn github_stars<'a>() -> &'a str {
    &CONFIG.github_stars
}

pub fn css_url(name: &str) -> String {
    let path = PathBuf::from(format!("/dashboard/static/css/{name}"));
    let path = path.with_extension(&CONFIG.css_extension);
    asset_url(path.to_string_lossy())
}

pub fn js_url(name: &str) -> String {
    let path = PathBuf::from(format!("/dashboard/static/js/{name}"));
    let path = path.with_extension(&CONFIG.js_extension);
    asset_url(path.to_string_lossy())
}

pub fn asset_url(path: Cow<str>) -> String {
    match &CONFIG.assets_domain {
        Some(domain) => format!("https://{domain}{path}"),
        None => path.to_string(),
    }
}

pub fn site_domain() -> String {
    String::from("https://postgresml.org")
}

fn env_is_set(name: &str) -> bool {
    var(name).is_ok()
}

fn env_string_default(name: &str, default: &str) -> String {
    match var(name) {
        Ok(value) => value,
        Err(_) => default.to_string(),
    }
}

fn env_string_optional(name: &str) -> Option<String> {
    match var(name) {
        Ok(value) => Some(value),
        Err(_) => None,
    }
}

fn env_path_default(name: &str, default: &str) -> PathBuf {
    match var(name) {
        Ok(value) => PathBuf::from(value),
        Err(_) => PathBuf::from(default),
    }
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/cookies.rs`
```
use chrono;
use rocket::http::{Cookie, CookieJar};
use rocket::serde::{Deserialize, Serialize};
use time::Duration;

/// Session data.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Notifications {
    /// App-wide notifications.
    notifications: Vec<NotificationCookie>,
}

/// App-wide notifications.
#[derive(Debug, Clone, Deserialize, Serialize, Default, PartialEq)]
pub struct NotificationCookie {
    /// Unique ID of the notification.
    pub id: String,
    /// Time the notification was viewed. Used for reshowing the notification.
    pub time_viewed: Option<chrono::DateTime<chrono::Utc>>,
    /// Time the notification modal was viewed. Used for reshowing the notification modal.
    pub time_modal_viewed: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotificationsCookieOld {
    pub notifications: Vec<String>,
}

impl From<NotificationsCookieOld> for NotificationCookie {
    fn from(old: NotificationsCookieOld) -> Self {
        NotificationCookie {
            id: old.notifications[0].clone(),
            time_viewed: None,
            time_modal_viewed: None,
        }
    }
}

impl Notifications {
    /// Update the viewed notifications in the session.
    pub fn update_viewed(notifications: &[NotificationCookie], cookies: &CookieJar<'_>) {
        let session = Notifications::safe_serialize_session(notifications);

        let mut cookie = Cookie::new("session", session);
        cookie.set_max_age(Duration::weeks(52 * 100)); // Keep the cookie "forever"
        cookies.add_private(cookie);
    }

    /// Get viewed notifications from the session.
    pub fn get_viewed(cookies: &CookieJar<'_>) -> Vec<NotificationCookie> {
        match cookies.get_private("session") {
            Some(session) => Notifications::safe_deserialize_session(session.value()),
            None => vec![],
        }
    }

    pub fn safe_deserialize_session(session: &str) -> Vec<NotificationCookie> {
        match serde_json::from_str::<Notifications>(session) {
            Ok(notifications) => notifications.notifications,
            Err(_) => match serde_json::from_str::<NotificationsCookieOld>(session) {
                Ok(notifications) => vec![NotificationCookie::from(notifications)],
                Err(_) => vec![],
            },
        }
    }

    pub fn safe_serialize_session(notifications: &[NotificationCookie]) -> String {
        let notifications = Notifications {
            notifications: notifications.to_vec(),
        };

        serde_json::to_string(&notifications).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;

    // Test that we can safely deserialize expected session data.
    #[test]
    fn test_safe_deserialize_session() {
        let session = r#"{"notifications": [{"id": "1", "time_viewed": null, "time_modal_viewed": null}, {"id": "1234567891234", "time_viewed": "2021-08-01T00:00:00Z"}]}"#;
        let expected = vec![
            NotificationCookie {
                id: "1".to_string(),
                time_viewed: None,
                time_modal_viewed: None,
            },
            NotificationCookie {
                id: "1234567891234".to_string(),
                time_viewed: Some(
                    chrono::DateTime::parse_from_rfc3339("2021-08-01T00:00:00Z")
                        .unwrap()
                        .into(),
                ),
                time_modal_viewed: None,
            },
        ];
        assert_eq!(Notifications::safe_deserialize_session(session), expected);
    }

    // Test that new notification system is backwards compatible.
    #[test]
    fn test_safe_deserialize_session_old_form() {
        let session = r#"{"notifications": ["123456789"]}"#;
        let expected = vec![NotificationCookie {
            id: "123456789".to_string(),
            time_viewed: None,
            time_modal_viewed: None,
        }];
        assert_eq!(Notifications::safe_deserialize_session(session), expected);
    }

    #[test]
    fn test_safe_deserialize_session_empty() {
        let session = r#"{}"#;
        let expected: Vec<NotificationCookie> = vec![];
        assert_eq!(Notifications::safe_deserialize_session(session), expected);
    }

    #[test]
    fn test_safe_serialize_session() {
        let cookies = vec![NotificationCookie {
            id: "1".to_string(),
            time_viewed: None,
            time_modal_viewed: None,
        }];
        let expected = r#"{"notifications":[{"id":"1","time_viewed":null,"time_modal_viewed":null}]}"#;
        assert_eq!(Notifications::safe_serialize_session(&cookies), expected);
    }
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/datadog.rs`
```
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::io::Result;
use std::string::ToString;
use std::time::Instant;
use tokio::sync::OnceCell;
use zoomies::DatagramFormat;
use zoomies::{Metric, UdsClient};

static CLIENT: OnceCell<Result<UdsClient>> = OnceCell::const_new();
static DEFAULT_TAGS: Lazy<HashMap<String, String>> =
    Lazy::new(|| HashMap::from([("app".to_string(), "pgml".to_string())]));

pub async fn client() -> &'static Result<UdsClient> {
    CLIENT
        .get_or_init(|| async { UdsClient::with_filepath("/var/run/datadog/dsd.socket").await })
        .await
}

async fn send<'a, T: std::fmt::Display + num_traits::Num>(
    metric: Metric<'a, T>,
    tags: Option<&HashMap<String, String>>,
) {
    let mut merged_tags = DEFAULT_TAGS.clone();
    if let Some(tags) = tags {
        merged_tags.extend(tags.clone());
    }

    match client().await {
        Ok(client) => match client.send_with_tags(&metric, &merged_tags).await {
            Ok(_) => (),
            Err(err) => error!("datadog: {err}"),
        },
        Err(_) => info!("datadog: {}{}", metric.format(), merged_tags.format()),
    };
}

pub async fn increment(metric: &str, tags: Option<&HashMap<String, String>>) {
    send(Metric::Inc::<u32>(metric), tags).await;
}

#[allow(dead_code)]
pub async fn decrement(metric: &str, tags: Option<&HashMap<String, String>>) {
    send(Metric::Dec::<u32>(metric), tags).await;
}

#[allow(dead_code)]
pub async fn count(metric: &str, value: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Arb::<f32>(metric, value), tags).await;
}

#[allow(dead_code)]
pub async fn gauge(metric: &str, value: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Gauge::<f32>(metric, value), tags).await;
}

#[allow(dead_code)]
pub async fn histogram(metric: &str, value: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Histogram::<f32>(metric, value), tags).await;
}

#[allow(dead_code)]
pub async fn distribution(metric: &str, value: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Distribution::<f32>(metric, value), tags).await;
}

#[allow(dead_code)]
pub async fn set(metric: &str, value: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Set::<f32>(metric, value), tags).await;
}

pub async fn timing(metric: &str, millis: f32, tags: Option<&HashMap<String, String>>) {
    send(Metric::Time::<f32>(metric, millis), tags).await;
}

#[allow(dead_code)]
pub async fn time<T>(metric: &str, tags: Option<&HashMap<String, String>>, f: impl FnOnce() -> T) -> T {
    let start = Instant::now();
    let result = f();
    send(
        Metric::Time::<f32>(metric, start.elapsed().as_micros() as f32 / 1000.0),
        tags,
    )
    .await;
    result
}

pub async fn time_async<F, Fut, R>(metric: &str, tags: Option<&HashMap<String, String>>, f: F) -> R
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = R>,
{
    let start = Instant::now();
    let result = f().await;
    send(
        Metric::Time::<f32>(metric, start.elapsed().as_micros() as f32 / 1000.0),
        tags,
    )
    .await;
    result
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/markdown.rs`
```
use crate::api::cms::{DocType, Document};
use crate::{templates::docs::TocLink, utils::config};
use anyhow::Context;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use comrak::{
    adapters::{HeadingAdapter, HeadingMeta, SyntaxHighlighterAdapter},
    arena_tree::Node,
    nodes::{Ast, AstNode, NodeValue},
    Arena, ComrakExtensionOptions, ComrakOptions, ComrakRenderOptions,
};
use convert_case;
use itertools::Itertools;
use regex::Regex;
use std::fmt;
use std::sync::Mutex;
use url::Url;

// Excluded paths in the pgml-cms directory
const EXCLUDED_DOCUMENT_PATHS: [&str; 2] = ["blog/README.md", "blog/SUMMARY.md"];

pub struct MarkdownHeadings {
    header_map: Arc<Mutex<HashMap<String, usize>>>,
}

impl Default for MarkdownHeadings {
    fn default() -> Self {
        Self {
            header_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl MarkdownHeadings {
    pub fn new() -> Self {
        Self::default()
    }
}

/// Sets the document headers
///
/// uses toclink to ensure header id matches what the TOC expects
///
impl HeadingAdapter for MarkdownHeadings {
    fn enter(&self, meta: &HeadingMeta) -> String {
        let conv = convert_case::Converter::new().to_case(convert_case::Case::Kebab);
        let id = conv.convert(meta.content.to_string());

        let index = match self.header_map.lock().unwrap().get(&id) {
            Some(value) => value + 1,
            _ => 0,
        };
        self.header_map.lock().unwrap().insert(id.clone(), index);

        let id = TocLink::new(&id, index).id;

        match meta.level {
            1 => format!(r##"<h1 class="h1 mb-5" id="{id}"><a href="#{id}">"##),
            2 => format!(r##"<h2 class="h2 mb-4 mt-5" id="{id}"><a href="#{id}">"##),
            3 => format!(r##"<h3 class="h3 mb-4 mt-5" id="{id}"><a href="#{id}">"##),
            4 => format!(r##"<h4 class="h5 mb-3 mt-3" id="{id}"><a href="#{id}">"##),
            5 => format!(r##"<h5 class="h6 mb-2 mt-4" id="{id}"><a href="#{id}">"##),
            6 => format!(r##"<h6 class="h6 mb-1 mt-1" id="{id}"><a href="#{id}">"##),
            _ => unreachable!(),
        }
    }

    fn exit(&self, meta: &HeadingMeta) -> String {
        match meta.level {
            1 => r#"</a></h1>"#,
            2 => r#"</a></h2>"#,
            3 => r#"</a></h3>"#,
            4 => r#"</a></h4>"#,
            5 => r#"</a></h5>"#,
            6 => r#"</a></h6>"#,
            _ => unreachable!(),
        }
        .into()
    }
}

fn parser(utf8: &str, item: &str) -> Option<String> {
    let title_index = utf8.find(item);
    let (start, end) = match title_index {
        Some(index) => {
            let start = index + item.len();
            let title_length = utf8.to_string()[start..].find('\"');
            match title_length {
                Some(title_length) => (start, start + title_length),
                None => (0, 0),
            }
        }
        None => (0, 0),
    };

    if end - start > 0 {
        Some(utf8[start..end].to_string())
    } else {
        None
    }
}

enum HighlightColors {
    Green,
    GreenSoft,
    Red,
    RedSoft,
    Teal,
    TealSoft,
    Blue,
    BlueSoft,
    Yellow,
    YellowSoft,
    Orange,
    OrangeSoft,
}

impl HighlightColors {
    fn all() -> [HighlightColors; 12] {
        [
            HighlightColors::Green,
            HighlightColors::GreenSoft,
            HighlightColors::Red,
            HighlightColors::RedSoft,
            HighlightColors::Teal,
            HighlightColors::TealSoft,
            HighlightColors::Blue,
            HighlightColors::BlueSoft,
            HighlightColors::Yellow,
            HighlightColors::YellowSoft,
            HighlightColors::Orange,
            HighlightColors::OrangeSoft,
        ]
    }
}

impl fmt::Display for HighlightColors {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HighlightColors::Green => write!(f, "green"),
            HighlightColors::GreenSoft => write!(f, "green-soft"),
            HighlightColors::Red => write!(f, "red"),
            HighlightColors::RedSoft => write!(f, "red-soft"),
            HighlightColors::Teal => write!(f, "teal"),
            HighlightColors::TealSoft => write!(f, "teal-soft"),
            HighlightColors::Blue => write!(f, "blue"),
            HighlightColors::BlueSoft => write!(f, "blue-soft"),
            HighlightColors::Yellow => write!(f, "yellow"),
            HighlightColors::YellowSoft => write!(f, "yellow-soft"),
            HighlightColors::Orange => write!(f, "orange"),
            HighlightColors::OrangeSoft => write!(f, "orange-soft"),
        }
    }
}

struct HighlightLines {}

impl HighlightLines {
    fn get_color(options: &str, color: HighlightColors, hash: &mut HashMap<String, String>) {
        let parse_string = match color {
            HighlightColors::Green => "highlightGreen=\"",
            HighlightColors::GreenSoft => "highlightGreenSoft=\"",
            HighlightColors::Red => "highlightRed=\"",
            HighlightColors::RedSoft => "highlightRedSoft=\"",
            HighlightColors::Teal => "highlightTeal=\"",
            HighlightColors::TealSoft => "highlightTealSoft=\"",
            HighlightColors::Blue => "highlightBlue=\"",
            HighlightColors::BlueSoft => "highlightBlueSoft=\"",
            HighlightColors::Yellow => "highlightYellow=\"",
            HighlightColors::YellowSoft => "highlightYellowSoft=\"",
            HighlightColors::Orange => "highlightOrange=\"",
            HighlightColors::OrangeSoft => "highlightOrangeSoft=\"",
        };

        if let Some(lines) = parser(options, parse_string) {
            let parts = lines.split(',').map(|s| s.to_string());
            for line in parts {
                hash.insert(line, format!("{}", color));
            }
        }
    }
}

#[derive(Debug)]
struct CodeFence<'a> {
    lang: &'a str,
    highlight: HashMap<String, String>,
    line_numbers: bool,
}

impl<'a> From<&str> for CodeFence<'a> {
    fn from(options: &str) -> CodeFence<'a> {
        let lang = if options.starts_with("sql") {
            "sql"
        } else if options.starts_with("bash") {
            "bash"
        } else if options.starts_with("python") {
            "python"
        } else if options.starts_with("javascript") || options.eq_ignore_ascii_case("js") {
            "javascript"
        } else if options.starts_with("postgresql") {
            "postgresql"
        } else if options.starts_with("postgresql-line-nums") {
            "postgresql-line-nums"
        } else if options.starts_with("rust") {
            "rust"
        } else if options.starts_with("cpp") {
            "cpp"
        } else if options.starts_with("json") {
            "json"
        } else {
            "code"
        };

        let mut highlight = HashMap::new();
        for color in HighlightColors::all() {
            HighlightLines::get_color(options, color, &mut highlight);
        }

        CodeFence {
            lang,
            highlight,
            line_numbers: options.contains("lineNumbers"),
        }
    }
}

pub struct SyntaxHighlighter {}

impl SyntaxHighlighterAdapter for SyntaxHighlighter {
    fn highlight(&self, options: Option<&str>, code: &str) -> String {
        let code = if let Some(options) = options {
            let code = code.to_string();
            let options = CodeFence::from(options);

            // Add line highlighting
            let code = code
                .split('\n')
                .enumerate()
                .map(|(index, code)| {
                    format!(
                        r#"<div class="highlight code-line-highlight-{}">{}</div>"#,
                        match options.highlight.get(&(index + 1).to_string()) {
                            Some(color) => color,
                            _ => "none",
                        },
                        code
                    )
                })
                .join("\n");

            code
        } else {
            code.to_string()
        };

        code
    }

    fn build_pre_tag(&self, _attributes: &HashMap<String, String>) -> String {
        String::from("<pre data-controller=\"copy\"><div class=\"code-toolbar\">
                <span data-action=\"click->copy#codeCopy\" class=\"material-symbols-outlined btn-code-toolbar\">content_copy</span>
            </div>")
    }

    fn build_code_tag(&self, attributes: &HashMap<String, String>) -> String {
        let data = match attributes.get("class") {
            Some(lang) => lang.replace("language-", ""),
            _ => "".to_string(),
        };

        let parsed_data = CodeFence::from(data.as_str());

        // code-block web component uses codemirror to add syntax highlighting
        format!(
            "<code {} language='{}' data-controller=\"code-block\">",
            if parsed_data.line_numbers {
                "class='line-numbers'"
            } else {
                ""
            },
            parsed_data.lang,
        )
    }
}

pub fn options() -> ComrakOptions {
    let mut options = ComrakOptions::default();

    let render_options = ComrakRenderOptions {
        unsafe_: true,
        ..Default::default()
    };

    options.extension = ComrakExtensionOptions {
        strikethrough: true,
        tagfilter: false,
        table: true,
        autolink: true,
        tasklist: true,
        superscript: true,
        header_ids: Some("pgml-".to_string()),
        footnotes: true,
        description_lists: true,
        front_matter_delimiter: None,
    };
    options.render = render_options;

    options
}

/// Iterate through the document tree and call function F on all nodes.
fn iter_nodes<'a, F>(node: &'a AstNode<'a>, f: &mut F) -> Result<()>
where
    F: FnMut(&'a AstNode<'a>) -> anyhow::Result<bool>,
{
    let continue_ = f(node)?;

    if continue_ {
        for c in node.
```

### Core Architecture Module: `pgml-dashboard/src/utils/mod.rs`
```
pub mod config;
pub mod cookies;
pub mod datadog;
pub mod markdown;
pub mod tabs;
pub mod time;
pub mod urls;

use rand::{distributions::Alphanumeric, Rng};

/// Generate a random string of any length.
pub fn random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/tabs.rs`
```
use anyhow::anyhow;

pub struct Tab<'a> {
    pub name: &'a str,
    pub content: String,
}

pub struct Tabs<'a> {
    pub tabs: Vec<Tab<'a>>,
    pub default: &'a str,
    pub active: &'a str,
}

impl<'a> Tabs<'a> {
    pub fn new(tabs: Vec<Tab<'a>>, default: Option<&'a str>, active: Option<&'a str>) -> anyhow::Result<Self> {
        let default = match default {
            Some(default) => default,
            _ => tabs.get(0).ok_or(anyhow!("There must be at least one tab."))?.name,
        };

        let active = active
            .and_then(|name| {
                let found = tabs.iter().find(|tab| tab.name == name);

                found.map(|tab| tab.name)
            })
            .unwrap_or(default);

        Ok(Tabs { tabs, default, active })
    }
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/time.rs`
```
pub fn format_microseconds(microseconds: f64) -> String {
    if microseconds >= 1000000. {
        format!("{}s", microseconds / 1000000.)
    } else if microseconds >= 1000. {
        format!("{}ms", microseconds / 1000.)
    } else {
        format!("{}μs", microseconds)
    }
}

```

### Core Architecture Module: `pgml-dashboard/src/utils/urls.rs`
```
// Url to the deployments notebooks page.
pub fn deployment_notebooks() -> String {
    "/engine/notebooks".to_string()
}

// Url to a deployments specific notebook page.
pub fn deployment_notebook_by_id(notebook_id: i64) -> String {
    format!("/engine/notebooks/{}", notebook_id)
}

// Root of notebooks turboframes.
pub fn deployment_notebooks_turboframe() -> String {
    "/engine/notebooks_turboframe".to_string()
}

// Url to the deployments projects page.
pub fn deployment_projects() -> String {
    "/engine/projects".to_string()
}

// Url to a deployments specific project page.
pub fn deployment_project_by_id(project_id: i64) -> String {
    format!("/engine/projects/{}", project_id)
}

// Root of projects turboframes.
pub fn deployment_projects_turboframe() -> String {
    "/engine/projects_turboframe".to_string()
}

// Url to the deployments models page.
pub fn deployment_models() -> String {
    "/engine/models".to_string()
}

// Url to a deployments specific model page.
pub fn deployment_model_by_id(model_id: i64) -> String {
    format!("/engine/models/{}", model_id)
}

// Root of models turboframes.
pub fn deployment_models_turboframe() -> String {
    "/engine/models_turboframe".to_string()
}

// Url to the deployments snapshots page.
pub fn deployment_snapshots() -> String {
    "/engine/snapshots".to_string()
}

// Url to a deployments specific snapshot page.
pub fn deployment_snapshot_by_id(snapshot_id: i64) -> String {
    format!("/engine/snapshots/{}", snapshot_id)
}

// Root of snapshots turboframes.
pub fn deployment_snapshots_turboframe() -> String {
    "/engine/snapshots_turboframe".to_string()
}

// Url to the deployments uploader page.
pub fn deployment_uploader() -> String {
    "/engine/uploader".to_string()
}

// Root of uploader turboframes.
pub fn deployment_uploader_turboframe() -> String {
    "/engine/uploader_turboframe".to_string()
}

```

### Core Architecture Module: `pgml-dashboard/static/js/libs/lodash-4.17.15-core.js`
```
/**
 * @license
 * Lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash core -o ./dist/lodash.core.js`
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre-ES5 environments. */
  var undefined;

  /** Used as the semantic version number. */
  var VERSION = '4.17.15';

  /** Error message constants. */
  var FUNC_ERROR_TEXT = 'Expected a function';

  /** Used to compose bitmasks for value comparisons. */
  var COMPARE_PARTIAL_FLAG = 1,
      COMPARE_UNORDERED_FLAG = 2;

  /** Used to compose bitmasks for function metadata. */
  var WRAP_BIND_FLAG = 1,
      WRAP_PARTIAL_FLAG = 32;

  /** Used as references for various `Number` constants. */
  var INFINITY = 1 / 0,
      MAX_SAFE_INTEGER = 9007199254740991;

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      asyncTag = '[object AsyncFunction]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      genTag = '[object GeneratorFunction]',
      numberTag = '[object Number]',
      objectTag = '[object Object]',
      proxyTag = '[object Proxy]',
      regexpTag = '[object RegExp]',
      stringTag = '[object String]';

  /** Used to match HTML entities and HTML characters. */
  var reUnescapedHtml = /[&<>"']/g,
      reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

  /** Used to detect unsigned integer values. */
  var reIsUint = /^(?:0|[1-9]\d*)$/;

  /** Used to map characters to HTML entities. */
  var htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root = freeGlobal || freeSelf || Function('return this')();

  /** Detect free variable `exports`. */
  var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

  /*--------------------------------------------------------------------------*/

  /**
   * Appends the elements of `values` to `array`.
   *
   * @private
   * @param {Array} array The array to modify.
   * @param {Array} values The values to append.
   * @returns {Array} Returns `array`.
   */
  function arrayPush(array, values) {
    array.push.apply(array, values);
    return array;
  }

  /**
   * The base implementation of `_.findIndex` and `_.findLastIndex` without
   * support for iteratee shorthands.
   *
   * @private
   * @param {Array} array The array to inspect.
   * @param {Function} predicate The function invoked per iteration.
   * @param {number} fromIndex The index to search from.
   * @param {boolean} [fromRight] Specify iterating from right to left.
   * @returns {number} Returns the index of the matched value, else `-1`.
   */
  function baseFindIndex(array, predicate, fromIndex, fromRight) {
    var length = array.length,
        index = fromIndex + (fromRight ? 1 : -1);

    while ((fromRight ? index-- : ++index < length)) {
      if (predicate(array[index], index, array)) {
        return index;
      }
    }
    return -1;
  }

  /**
   * The base implementation of `_.property` without support for deep paths.
   *
   * @private
   * @param {string} key The key of the property to get.
   * @returns {Function} Returns the new accessor function.
   */
  function baseProperty(key) {
    return function(object) {
      return object == null ? undefined : object[key];
    };
  }

  /**
   * The base implementation of `_.propertyOf` without support for deep paths.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Function} Returns the new accessor function.
   */
  function basePropertyOf(object) {
    return function(key) {
      return object == null ? undefined : object[key];
    };
  }

  /**
   * The base implementation of `_.reduce` and `_.reduceRight`, without support
   * for iteratee shorthands, which iterates over `collection` using `eachFunc`.
   *
   * @private
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @param {*} accumulator The initial value.
   * @param {boolean} initAccum Specify using the first or last element of
   *  `collection` as the initial value.
   * @param {Function} eachFunc The function to iterate over `collection`.
   * @returns {*} Returns the accumulated value.
   */
  function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
    eachFunc(collection, function(value, index, collection) {
      accumulator = initAccum
        ? (initAccum = false, value)
        : iteratee(accumulator, value, index, collection);
    });
    return accumulator;
  }

  /**
   * The base implementation of `_.values` and `_.valuesIn` which creates an
   * array of `object` property values corresponding to the property names
   * of `props`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Array} props The property names to get values for.
   * @returns {Object} Returns the array of property values.
   */
  function baseValues(object, props) {
    return baseMap(props, function(key) {
      return object[key];
    });
  }

  /**
   * Used by `_.escape` to convert characters to HTML entities.
   *
   * @private
   * @param {string} chr The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  var escapeHtmlChar = basePropertyOf(htmlEscapes);

  /**
   * Creates a unary function that invokes `func` with its argument transformed.
   *
   * @private
   * @param {Function} func The function to wrap.
   * @param {Function} transform The argument transform.
   * @returns {Function} Returns the new function.
   */
  function overArg(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }

  /*--------------------------------------------------------------------------*/

  /** Used for built-in method references. */
  var arrayProto = Array.prototype,
      objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /** Used to generate unique IDs. */
  var idCounter = 0;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString = objectProto.toString;

  /** Used to restore the original `_` reference in `_.noConflict`. */
  var oldDash = root._;

  /** Built-in value references. */
  var objectCreate = Object.create,
      propertyIsEnumerable = objectProto.propertyIsEnumerable;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeIsFinite = root.isFinite,
      nativeKeys = overArg(Object.keys, Object),
      nativeMax = Math.max;

  /*------------------------------------------------------------------------*/

  /**
   * Creates a `lodash` object which wraps `value` to enable implicit method
   * chain sequences. Methods that operate on and return arrays, collections,
   * and functions can be chained together. Methods that retrieve a single value
   * or may return a primitive value will automatically end the chain sequence
   * and return the unwrapped value. Otherwise, the value must be unwrapped
   * with `_#value`.
   *
   * Explicit chain sequences, which must be unwrapped with `_#value`, may be
   * enabled using `_.chain`.
   *
   * The execution of chained methods is lazy, that is, it's deferred until
   * `_#value` is implicitly or explicitly called.
   *
   * Lazy evaluation allows several methods to support shortcut fusion.
   * Shortcut fusion is an optimization to merge iteratee calls; this avoids
   * the creation of intermediate arrays and can greatly reduce the number of
   * iteratee executions. Sections of a chain sequence qualify for shortcut
   * fusion if the section is applied to an array and iteratees accept only
   * one argument. The heuristic for whether a section qualifies for shortcut
   * fusion is subject to change.
   *
   * Chaining is supported in custom builds as long as the `_#value` method is
   * directly or indirectly included in the build.
   *
   * In addition to lodash methods, wrappers have `Array` and `String` methods.
   *
   * The wrapper `Array` methods are:
   * `concat`, `join`, `pop`, `push`, `shift`, `sort`, `splice`, and `unshift`
   *
   * The wrapper `String` methods are:
   * `replace` and `split`
   *
   * The wrapper methods that support shortcut fusion are:
   * `at`, `compact`, `drop`, `dropRight`, `dropWhile`, `filter`, `find`,
   * `findLast`, `head`, `initial`, `last`, `map`, `reject`, `reverse`, `slice`,
   * `tail`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, and `toArray`
   *
   * The chainable wrapper methods are:
   * `after`, `ary`, `assign`, `assignIn`, `assignInWith`, `assignWith`, `at`,
   * `before`, `bind`, `bindAll`, `bindKey`, `castArray`, `chain`, `chunk`,
   * `commit`, `compact`, `concat`, `conforms`, `constant`, `countBy`, `create`,
   * `curry`, `debounce`, `defaults`, `defaultsDeep`, `defer`, `delay`,
   * `difference`, `differenceBy`, `differenceWith`, `drop`, `dropRight`,
   * `dropRightWhile`, `dropWhile`, `extend`, `exte
```

### Core Architecture Module: `pgml-dashboard/static/js/utilities/code_mirror_theme.js`
```
import { tags as t } from "@lezer/highlight";

// Theme builder is taken from: https://github.com/codemirror/theme-one-dark#readme

const chalky = "#FF0"; // Set
const coral = "#F5708B"; // Set
const salmon = "#e9467a";
const blue = "#00e0ff";
const cyan = "#56b6c2";
const invalid = "#ffffff";
const ivory = "#abb2bf";
const stone = "#7d8799";
const malibu = "#61afef";
const sage = "#0F0"; // Set
const whiskey = "#ffb500";
const violet = "#F3F"; // Set
const darkBackground = "#17181A"; // Set
const highlightBackground = "#2c313a";
const background = "#17181A"; // Set
const tooltipBackground = "#353a42";
const selection = "#3E4451";
const cursor = "#528bff";

const editorTheme = {
  "&": {
    color: ivory,
    backgroundColor: background,
  },

  ".cm-content": {
    caretColor: cursor,
    paddingBottom: '1rem',
  },

  ".cm-cursor, .cm-dropCursor": { borderLeftColor: cursor },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: selection },

  ".cm-panels": { backgroundColor: darkBackground, color: ivory },
  ".cm-panels.cm-panels-top": { borderBottom: "2px solid black" },
  ".cm-panels.cm-panels-bottom": { borderTop: "2px solid black" },

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f",
  },

  ".cm-activeLine": { backgroundColor: "#6699ff0b" },
  ".cm-selectionMatch": { backgroundColor: "#aafe661a" },

  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847",
  },

  ".cm-gutters": {
    backgroundColor: background,
    color: stone,
    border: "none",
  },

  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground,
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd",
  },

  ".cm-tooltip": {
    border: "none",
    backgroundColor: tooltipBackground,
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground,
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground,
      color: ivory,
    },
  },
}

const highlightStyle = [
  { tag: [
      t.keyword,
      t.annotation,
      t.modifier,
      t.special(t.string),
      t.operatorKeyword,
    ],
    color: violet
  },
  {
    tag: [t.name, t.propertyName, t.deleted, t.character, t.macroName, t.function(t.variableName)],
    color: blue,
  },
  {
    tag: [],
    color: cyan,
  },
  { tag: [t.labelName], color: whiskey },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: whiskey },
  { tag: [t.definition(t.name), t.separator], color: ivory },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.self,
      t.namespace,
      t.bool,
    ],
    color: chalky,
  },
  { tag: [t.operator], color: whiskey },
  { tag: [
      t.processingInstruction,
      t.string,
      t.inserted,
      t.url,
      t.escape,
      t.regexp,
      t.link,
    ],
    color: sage
  },
  { tag: [t.meta, t.comment], color: stone },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: stone, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: salmon },
  { tag: [t.atom, t.special(t.variableName)], color: whiskey },
  { tag: t.invalid, color: invalid },
]


export  {highlightStyle, editorTheme};

```

### Core Architecture Module: `pgml-dashboard/static/js/utilities/compact_number.js`
```

export const numberToCompact = (num)  => {
  if (num >= 1e12) {
      return (num / 1e12).toFixed(1) + 'T'; // Trillion
  } else if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B'; // Billion
  } else if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M'; // Million
  } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K'; // Thousand
  } else {
      return num.toString(); // Less than a thousand
  }
};

export const compactToNumber = (compact) => {
  const suffixes = { 'K': 1e3, 'M': 1e6, 'B': 1e9, 'T': 1e12 };
  const regex = /^(\d+(\.\d+)?)([KMBT])$/;

  const match = compact.match(regex);
  if (match) {
      const number = parseFloat(match[1]);
      const suffix = match[3].toUpperCase();
      return number * suffixes[suffix];
  } else {
      return parseFloat(compact); // For numbers without suffixes
  }
};

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

### Incident Patch 2: `8563bd46` (2025-04-15)
**Commit Message**: Standardize on Python 3.11 and clarify architecture-specific requirements

- Renames requirements.linux.txt to requirements.amd64.txt
- Renames requirements.macos.txt to requirements.arm64.txt
- Updates build scripts to use Python 3.11 for all Ubuntu versions
- Updates documentation to clarify architecture-specific requirements
- Simplifies Python version configuration in build scripts

**File**: `.github/workflows/ubuntu-postgresml-python-package.yaml` (modified, +2/-8)
```diff
@@ -36,14 +36,8 @@ jobs:
         sudo add-apt-repository -y ppa:deadsnakes/ppa
         sudo apt update
         
-        # Install specific Python versions based on Ubuntu target
-        if [[ "$UBUNTU_VERSION" == "20.04" ]]; then
-          sudo apt install -y python3.8 python3.8-dev python3.8-venv
-        elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
-          sudo apt install -y python3.10 python3.10-dev python3.10-venv
-        elif [[ "$UBUNTU_VERSION" == "24.04" ]]; then
-          sudo apt install -y python3.12 python3.12-dev python3.12-venv
-        fi
+        # Install Python 3.11 for all Ubuntu versions for better dependency compatibility
+        sudo apt install -y python3.11 python3.11-dev python3.11-venv
         
         # Ensure pip is updated
         python3 -m pip install --upgrade pip setuptools wheel
```

**File**: `packages/postgresml-python/build.sh` (modified, +9/-16)
```diff
@@ -7,7 +7,7 @@ deb_dir="/tmp/postgresml-python/deb-build"
 # Parse arguments with defaults
 export PACKAGE_VERSION=${1:-"2.10.0"}
 export UBUNTU_VERSION=${2:-"22.04"}
-export PYTHON_VERSION=${3:-"3.10"}
+export PYTHON_VERSION=${3:-"3.11"}
 
 # Handle architecture
 if [[ $(arch) == "x86_64" ]]; then
@@ -16,16 +16,9 @@ else
   export ARCH=arm64
 fi
 
-# Map Ubuntu versions to Python versions if needed
-# For example: Ubuntu 20.04 uses Python 3.8 by default
-declare -A ubuntu_python_versions=(
-  ["20.04"]="3.8"
-  ["22.04"]="3.10"
-  ["24.04"]="3.12"
-)
-
+# We use Python 3.11 for all Ubuntu versions for better dependency compatibility
 if [[ -z "$3" ]]; then
-  PYTHON_VERSION=${ubuntu_python_versions[$UBUNTU_VERSION]:-"3.10"}
+  PYTHON_VERSION="3.11"
 fi
 
 rm -rf "$deb_dir"
@@ -41,18 +34,18 @@ rm "$deb_dir/release.sh"
 (cat ${SCRIPT_DIR}/DEBIAN/postrm | envsubst '${PGVERSION} ${PYTHON_VERSION}') > "$deb_dir/DEBIAN/postrm"
 
 if [[ "$ARCH" == "amd64" ]]; then
-  cp ${SCRIPT_DIR}/../../pgml-extension/requirements.linux.txt "$deb_dir/etc/postgresml-python/requirements.txt"
+  # Use AMD64-specific requirements (x86_64)
+  cp ${SCRIPT_DIR}/../../pgml-extension/requirements.amd64.txt "$deb_dir/etc/postgresml-python/requirements.txt"
 else
-  cp ${SCRIPT_DIR}/../../pgml-extension/requirements.macos.txt "$deb_dir/etc/postgresml-python/requirements.txt"
+  # Use ARM64-specific requirements (aarch64)
+  cp ${SCRIPT_DIR}/../../pgml-extension/requirements.arm64.txt "$deb_dir/etc/postgresml-python/requirements.txt"
 fi
 
 virtualenv --python="python${PYTHON_VERSION}" "$deb_dir/var/lib/postgresml-python/pgml-venv"
 source "$deb_dir/var/lib/postgresml-python/pgml-venv/bin/activate"
 
-# For Python 3.12, ensure PyTorch is installed first
-if [[ "${PYTHON_VERSION}" == "3.12" ]]; then
-  python -m pip install torch
-fi
+# Install PyTorch first to help with dependency resolution
+python -m pip install torch
 
 python -m pip install -r "${deb_dir}/etc/postgresml-python/requirements.txt"
 
```

**File**: `pgml-cms/docs/open-source/pgml/developers/installation.md` (modified, +23/-1)
```diff
@@ -71,14 +71,36 @@ virtualenv pgml-venv && \
 source pgml-venv/bin/activate && \
 pip install -r requirements.txt
 ```
+
+PostgresML has architecture-specific requirements files:
+- `requirements.amd64.txt` - For x86_64/AMD64 architectures
+- `requirements.arm64.txt` - For ARM64/aarch64 architectures
+
+When building from source, use the appropriate file for your architecture:
+
+```bash
+# For AMD64/x86_64 systems
+pip install -r requirements.amd64.txt
+
+# For ARM64/aarch64 systems
+pip install -r requirements.arm64.txt
+```
+
+These files contain frozen dependencies that have been tested with PostgresML. We recommend using Python 3.11 for optimal compatibility with all dependencies.
 {% endtab %}
 
 {% tab title="Globally" %}
 Installing Python packages globally can cause issues with your system. If you wish to proceed nonetheless, you can do so:
 
 ```bash
-pip3 install -r requirements.txt
+# For AMD64/x86_64 systems
+pip3 install -r requirements.amd64.txt
+
+# For ARM64/aarch64 systems
+pip3 install -r requirements.arm64.txt
 ```
+
+We recommend using Python 3.11 for optimal compatibility with all dependencies.
 {% endtab %}
 {% endtabs %}
 
```

**File**: `pgml-extension/requirements.amd64.txt` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+accelerate==1.2.1
+aiohappyeyeballs==2.4.4
+aiohttp==3.11.11
+aiohttp-cors==0.7.0
+aiosignal==1.3.2
+airportsdata==20241001
+annotated-types==0.7.0
+anyio==4.8.0
+astor==0.8.1
+attrs==24.3.0
+auto_gptq==0.7.1
+bitsandbytes==0.45.0
+blake3==1.0.2
+cachetools==5.5.0
+catboost==1.2.7
+certifi==2024.12.14
+charset-normalizer==3.4.1
+click==8.1.8
+cloudpickle==3.1.1
+colorama==0.4.6
+coloredlogs==15.0.1
+colorful==0.5.6
+compressed-tensors==0.8.1
+contourpy==1.3.1
+ctransformers==0.2.27
+cycler==0.12.1
+datasets==3.2.0
+deepspeed==0.16.2
+depyf==0.18.0
+dill==0.3.8
+diskcache==5.6.3
+distlib==0.3.9
+distro==1.9.0
+einops==0.8.0
+evaluate==0.4.3
+fastapi==0.115.6
+filelock==3.16.1
+fonttools==4.55.3
+frozenlist==1.5.0
+fsspec==2024.9.0
+gekko==1.2.1
+gguf==0.10.0
+google-api-core==2.24.0
+google-auth==2.37.0
+googleapis-common-protos==1.66.0
+graphviz==0.20.3
+greenlet==3.1.1
+grpcio==1.69.0
+h11==0.14.0
+hjson==3.1.0
+httpcore==1.0.7
+httptools==0.6.4
+httpx==0.28.1
+huggingface-hub==0.27.1
+humanfriendly==10.0
+idna==3.10
+importlib_metadata==8.5.0
+iniconfig==2.0.0
+interegular==0.3.3
+Jinja2==3.1.5
+jiter==0.8.2
+joblib==1.4.2
+jsonpatch==1.33
+jsonpointer==3.0.0
+jsonschema==4.23.0
+jsonschema-specifications==2024.10.1
+kiwisolver==1.4.8
+langchain==0.3.14
+langchain-core==0.3.29
+langchain-text-splitters==0.3.5
+langsmith==0.2.10
+lark==1.2.2
+lightgbm==4.5.0
+linkify-it-py==2.0.3
+lm-format-enforcer==0.10.9
+lxml==5.3.0
+markdown-it-py==3.0.0
+MarkupSafe==3.0.2
+matplotlib==3.10.0
+mdit-py-plugins==0.4.2
+mdurl==0.1.2
+memray==1.15.0
+mistral_common==1.5.1
+mpmath==1.3.0
+msgpack==1.1.0
+msgspec==0.19.0
+multidict==6.1.0
+multiprocess==0.70.16
+nest-asyncio==1.6.0
+networkx==3.4.2
+ninja==1.11.1.3
+numpy==1.26.4
+nvidia-cublas-cu12==12.4.5.8
+nvidia-cuda-cupti-cu12==12.4.127
+nvidia-cuda-nvrtc-cu12==12.4.127
+nvidia-cuda-runtime-cu12==12.4.127
+nvidia-cudnn-cu12==9.1.0.70
+nvidia-cufft-cu12==11.2.1.3
+nvidia-curand-cu12==10.3.5.147
+nvidia-cusolver-cu12==11.6.1.9
+nvidia-cusparse-cu12==12.3.1.170
+nvidia-ml-py==12.560.30
+nvidia-nccl-cu12==2.21.5
+nvidia-nvjitlink-cu12==12.4.127
+nvidia-nvtx-cu12==12.4.127
+openai==1.59.7
+opencensus==0.11.4
+opencensus-context==0.1.3
+opencv-python-headless==4.10.0.84
+optimum==1.23.3
+orjson==3.10.14
+outlines==0.1.11
+outlines_core==0.1.26
+packaging==24.2
+pandas==2.2.3
+partial-json-parser==0.2.1.1.post5
+peft==0.14.0
+pillow==10.4.0
+platformdirs==4.3.6
+plotly==5.24.1
+pluggy==1.5.0
+portalocker==3.1.1
+prometheus-fastapi-instrumentator==7.0.2
+prometheus_client==0.21.1
+propcache==0.2.1
+proto-plus==1.25.0
+protobuf==5.29.3
+psutil==6.1.1
+py-cpuinfo==9.0.0
+py-spy==0.4.0
+pyarrow==18.1.0
+pyasn1==0.6.1
+pyasn1_modules==0.4.1
+pybind11==2.13.6
+pycountry==24.6.1
+pydantic==2.10.5
+pydantic_core==2.27.2
+Pygments==2.19.1
+pyparsing==3.2.1
+pytest==8.3.4
+python-dateutil==2.9.0.post0
+python-dotenv==1.0.1
+pytz==2024.2
+PyYAML==6.0.2
+pyzmq==26.2.0
+ray==2.40.0
+referencing==0.35.1
+regex==2024.11.6
+requests==2.32.3
+requests-toolbelt==1.0.0
+rich==13.9.4
+rouge==1.0.1
+rpds-py==0.22.3
+rsa==4.9
+sacrebleu==2.5.1
+sacremoses==0.1.1
+safetensors==0.5.2
+scikit-learn==1.6.1
+scipy==1.15.1
+sentence-transformers==3.3.1
+sentencepiece==0.2.0
+six==1.17.0
+smart-open==7.1.0
+sniffio==1.3.1
+SQLAlchemy==2.0.37
+starlette==0.41.3
+sympy==1.13.1
+tabulate==0.9.0
+tenacity==9.0.0
+textual==1.0.0
+threadpoolctl==3.5.0
+tiktoken==0.7.0
+tokenizers==0.21.0
+torch==2.5.1
+torchaudio==2.5.1
+torchvision==0.20.1
+tqdm==4.67.1
+transformers==4.48.0
+transformers-stream-generator==0.0.5
+triton==3.1.0
+trl==0.13.0
+typing_extensions==4.12.2
+tzdata==2024.2
+uc-micro-py==1.0.3
+urllib3==2.3.0
+uvicorn==0.34.0
+uvloop==0.21.0
+virtualenv==20.28.1
+vllm==0.6.6.post1
+watchfiles==1.0.4
+websockets==14.1
+wrapt==1.17.2
+xformers==0.0.28.post3
+xgboost==2.1.3
+xgrammar==0.1.9
+xxhash==3.5.0
+yarl==1.18.3
+zipp==3.21.0
```

**File**: `pgml-extension/requirements.arm64.txt` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+accelerate==0.30.1
+aiohttp==3.9.5
+aiosignal==1.3.1
+annotated-types==0.6.0
+attrs==23.2.0
+bitsandbytes==0.42.0
+catboost==1.2.5
+certifi==2024.2.2
+charset-normalizer==3.3.2
+click==8.1.7
+colorama==0.4.6
+coloredlogs==15.0.1
+contourpy==1.2.1
+ctransformers==0.2.27
+cycler==0.12.1
+dataclasses-json==0.6.6
+datasets==2.16.1
+deepspeed==0.14.2
+dill==0.3.7
+docstring_parser==0.16
+einops==0.8.0
+evaluate==0.4.2
+filelock==3.14.0
+fonttools==4.51.0
+frozenlist==1.4.1
+fsspec==2023.10.0
+graphviz==0.20.3
+hjson==3.1.0
+huggingface-hub==0.23.0
+humanfriendly==10.0
+idna==3.7
+Jinja2==3.1.4
+joblib==1.4.2
+jsonpatch==1.33
+jsonpointer==2.4
+kiwisolver==1.4.5
+langchain==0.1.20
+langchain-community==0.0.38
+langchain-core==0.1.52
+langchain-text-splitters==0.0.1
+langsmith==0.1.57
+lightgbm==4.3.0
+lxml==5.2.2
+markdown-it-py==3.0.0
+MarkupSafe==2.1.5
+marshmallow==3.21.2
+matplotlib==3.8.4
+mdurl==0.1.2
+mpmath==1.3.0
+multidict==6.0.5
+multiprocess==0.70.15
+mypy-extensions==1.0.0
+networkx==3.3
+ninja==1.11.1.1
+numpy==1.26.4
+optimum==1.19.2
+orjson==3.10.3
+packaging==23.2
+pandas==2.2.2
+peft==0.10.0
+pillow==10.3.0
+plotly==5.22.0
+portalocker==2.8.2
+protobuf==5.26.1
+psutil==5.9.8
+py-cpuinfo==9.0.0
+pyarrow==11.0.0
+pyarrow-hotfix==0.6
+pydantic==2.7.1
+pydantic_core==2.18.2
+Pygments==2.18.0
+pynvml==11.5.0
+pyparsing==3.1.2
+python-dateutil==2.9.0.post0
+pytz==2024.1
+PyYAML==6.0.1
+regex==2024.5.10
+requests==2.31.0
+rich==13.7.1
+rouge==1.0.1
+sacrebleu==2.4.2
+sacremoses==0.1.1
+safetensors==0.4.3
+scikit-learn==1.4.2
+scipy==1.13.0
+sentence-transformers==2.7.0
+sentencepiece==0.2.0
+shtab==1.7.1
+six==1.16.0
+SQLAlchemy==2.0.30
+sympy==1.12
+tabulate==0.9.0
+tenacity==8.3.0
+threadpoolctl==3.5.0
+tokenizers==0.19.1
+torch==2.3.0
+torchaudio==2.3.0
+torchvision==0.18.0
+tqdm==4.66.4
+transformers==4.40.2
+transformers-stream-generator==0.0.5
+trl==0.8.6
+typing-inspect==0.9.0
+typing_extensions==4.11.0
+tyro==0.8.4
+tzdata==2024.1
+urllib3==2.2.1
+xgboost==2.0.3
+xxhash==3.4.1
+yarl==1.9.4
```

---

### Incident Patch 3: `686942a0` (2025-04-15)
**Commit Message**: Improve Python package build process

- Update ubuntu-postgresml-python-package workflow with better Python setup
- Add workflow_call support to make it callable from main workflow
- Change main workflow to use reusable workflow for Python package build
- Addresses dependency issues with Python build for Ubuntu 24.04

**File**: `.github/workflows/ubuntu-packages-and-docker-image.yml` (modified, +4/-35)
```diff
@@ -10,41 +10,10 @@ jobs:
   # PostgresML Python package.
   #
   postgresml-python:
-    strategy:
-      fail-fast: false
-      matrix:
-        os: ["ubuntu-22.04", "buildjet-4vcpu-ubuntu-2204-arm"]
-        ubuntu_version: ["20.04", "22.04", "24.04"]
-    runs-on: ${{ matrix.os }}
-    steps:
-    - uses: actions/checkout@v3
-    - name: Build and release Python package
-      env:
-        AWS_ACCESS_KEY_ID: ${{ vars.AWS_ACCESS_KEY_ID }}
-        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
-        AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
-        UBUNTU_VERSION: ${{ matrix.ubuntu_version }}
-      run: |
-        sudo apt update
-        sudo apt install -y python3-dev python3-pip python3-virtualenv software-properties-common python3-wheel-whl python3-pip-whl python3-setuptools-whl
-        
-        # Add deadsnakes PPA for all Python versions
-        sudo add-apt-repository -y ppa:deadsnakes/ppa
-        sudo apt update
-        
-        # Install specific Python versions based on Ubuntu target
-        if [[ "$UBUNTU_VERSION" == "20.04" ]]; then
-          sudo apt install -y python3.8 python3.8-dev python3.8-venv
-        elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
-          sudo apt install -y python3.10 python3.10-dev python3.10-venv
-        elif [[ "$UBUNTU_VERSION" == "24.04" ]]; then
-          sudo apt install -y python3.12 python3.12-dev python3.12-venv
-        fi
-        
-        # Install PyTorch before running the build script to satisfy auto_gptq's requirements
-        pip install torch --user
-        
-        bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
+    uses: ./.github/workflows/ubuntu-postgresml-python-package.yaml
+    with:
+      packageVersion: ${{ inputs.packageVersion }}
+    secrets: inherit
 
   #
   # PostgresML extension.
```

**File**: `.github/workflows/ubuntu-postgresml-python-package.yaml` (modified, +30/-1)
```diff
@@ -4,7 +4,13 @@ on:
   workflow_dispatch:
     inputs:
       packageVersion:
-        default: "2.8.4"
+        default: "2.10.0"
+  workflow_call:
+    inputs:
+      packageVersion:
+        type: string
+        required: true
+        default: "2.10.0"
 
 jobs:
   postgresml-python:
@@ -21,5 +27,28 @@ jobs:
         AWS_ACCESS_KEY_ID: ${{ vars.AWS_ACCESS_KEY_ID }}
         AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
         AWS_DEFAULT_REGION: ${{ vars.AWS_DEFAULT_REGION }}
+        UBUNTU_VERSION: ${{ matrix.ubuntu_version }}
       run: |
+        sudo apt update
+        sudo apt install -y python3-dev python3-pip python3-virtualenv software-properties-common python3-wheel-whl python3-pip-whl python3-setuptools-whl
+        
+        # Add deadsnakes PPA for all Python versions
+        sudo add-apt-repository -y ppa:deadsnakes/ppa
+        sudo apt update
+        
+        # Install specific Python versions based on Ubuntu target
+        if [[ "$UBUNTU_VERSION" == "20.04" ]]; then
+          sudo apt install -y python3.8 python3.8-dev python3.8-venv
+        elif [[ "$UBUNTU_VERSION" == "22.04" ]]; then
+          sudo apt install -y python3.10 python3.10-dev python3.10-venv
+        elif [[ "$UBUNTU_VERSION" == "24.04" ]]; then
+          sudo apt install -y python3.12 python3.12-dev python3.12-venv
+        fi
+        
+        # Ensure pip is updated
+        python3 -m pip install --upgrade pip setuptools wheel
+        
+        # Install PyTorch globally before running the build script
+        sudo python3 -m pip install torch
+        
         bash packages/postgresml-python/release.sh ${{ inputs.packageVersion }} ${{ matrix.ubuntu_version }}
```

---

### Incident Patch 4: `8ced585a` (2025-04-15)
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

### Incident Patch 5: `507aaeb2` (2025-04-15)
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

### Incident Patch 6: `31c68e4e` (2025-04-15)
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

### Incident Patch 7: `caed6293` (2025-04-15)
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

### Incident Patch 8: `270a8e17` (2025-04-15)
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

### Incident Patch 9: `e24df87f` (2025-04-14)
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

### Incident Patch 10: `b4b337f8` (2025-04-14)
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

### Incident Patch 11: `49babb66` (2025-01-22)
**Commit Message**: Update brewfile and build docs for macos (#1673)

**File**: `pgml-cms/docs/open-source/pgml/developers/installation.md` (modified, +6/-0)
```diff
@@ -40,6 +40,12 @@ cargo install cargo-pgrx --version 0.12.9 && \
 cargo pgrx init
 ```
 
+**NOTE: You may need to set the `PGK_CONFIG_PATH` env variable:**
+
+```bash
+export PKG_CONFIG_PATH="/opt/homebrew/opt/icu4c/lib/pkgconfig"
+```
+
 This step will take a few minutes. Perfect opportunity to get a coffee while you wait.
 
 ### Compile and install
```

**File**: `pgml-extension/Brewfile` (modified, +1/-0)
```diff
@@ -7,3 +7,4 @@ brew "cmake"
 brew "pkg-config"
 brew "openssl"
 brew "virtualenv"
+brew "icu4c"
```

---

### Incident Patch 12: `a6a60f9a` (2024-10-24)
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

### Incident Patch 13: `9303cb4b` (2024-10-11)
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

**File**: `pgml-extension/src/bindings/xgboost.rs` (modified, +20/-3)
```diff
@@ -288,10 +288,18 @@ fn fit(dataset: &Dataset, hyperparams: &Hyperparams, objective: learning::Object
         Err(e) => error!("Failed to train model:\n\n{}", e),
     };
 
-    Ok(Box::new(Estimator { estimator: booster }))
+    let softmax_objective = match hyperparams.get("objective") {
+        Some(value) => match value.as_str().unwrap() {
+            "multi:softmax" => true,
+            _ => false,
+        },
+        None => false,
+    };
+    Ok(Box::new(Estimator { softmax_objective, estimator: booster }))
 }
 
 pub struct Estimator {
+    softmax_objective: bool,
     estimator: xgboost::Booster,
 }
 
@@ -308,6 +316,9 @@ impl Bindings for Estimator {
     fn predict(&self, features: &[f32], num_features: usize, num_classes: usize) -> Result<Vec<f32>> {
         let x = DMatrix::from_dense(features, features.len() / num_features)?;
         let y = self.estimator.predict(&x)?;
+        if self.softmax_objective {
+            return Ok(y);
+        }
         Ok(match num_classes {
             0 => y,
             _ => y
@@ -340,7 +351,7 @@ impl Bindings for Estimator {
     }
 
     /// Deserialize self from bytes, with additional context
-    fn from_bytes(bytes: &[u8]) -> Result<Box<dyn Bindings>>
+    fn from_bytes(bytes: &[u8], hyperparams: &JsonB) -> Result<Box<dyn Bindings>>
     where
         Self: Sized,
     {
@@ -366,6 +377,12 @@ impl Bindings for Estimator {
             .set_param("nthread", &concurrency.to_string())
             .map_err(|e| anyhow!("could not set nthread XGBoost parameter: {e}"))?;
 
-        Ok(Box::new(Estimator { estimator }))
+        let objective_opt = hyperparams.0.get("objective").and_then(|v| v.as_str());
+        let softmax_objective = match objective_opt {
+            Some("multi:softmax") => true,
+            _ => false,
+        };
+
+        Ok(Box::new(Estimator { softmax_objective, estimator }))
     }
 }
```

**File**: `pgml-extension/src/orm/file.rs` (modified, +11/-7)
```diff
@@ -31,6 +31,7 @@ pub fn find_deployed_estimator_by_model_id(model_id: i64) -> Result<Arc<Box<dyn
     let mut runtime: Option<String> = None;
     let mut algorithm: Option<String> = None;
     let mut task: Option<String> = None;
+    let mut hyperparams: Option<JsonB> = None;
 
     Spi::connect(|client| {
         let result = client
@@ -39,7 +40,8 @@ pub fn find_deployed_estimator_by_model_id(model_id: i64) -> Result<Arc<Box<dyn
                     data,
                     runtime::TEXT,
                     algorithm::TEXT,
-                    task::TEXT
+                    task::TEXT,
+                    hyperparams
                 FROM pgml.models
                     INNER JOIN pgml.files
                         ON models.id = files.model_id 
@@ -66,6 +68,7 @@ pub fn find_deployed_estimator_by_model_id(model_id: i64) -> Result<Arc<Box<dyn
             runtime = result.get(2).expect("Runtime for model is corrupted.");
             algorithm = result.get(3).expect("Algorithm for model is corrupted.");
             task = result.get(4).expect("Task for project is corrupted.");
+            hyperparams = result.get(5).expect("Hyperparams for model is corrupted.");
         }
     });
 
@@ -83,6 +86,7 @@ pub fn find_deployed_estimator_by_model_id(model_id: i64) -> Result<Arc<Box<dyn
     let runtime = Runtime::from_str(&runtime.unwrap()).unwrap();
     let algorithm = Algorithm::from_str(&algorithm.unwrap()).unwrap();
     let task = Task::from_str(&task.unwrap()).unwrap();
+    let hyperparams = hyperparams.unwrap();
 
     debug1!(
         "runtime = {:?}, algorithm = {:?}, task = {:?}",
@@ -94,22 +98,22 @@ pub fn find_deployed_estimator_by_model_id(model_id: i64) -> Result<Arc<Box<dyn
     let bindings: Box<dyn Bindings> = match runtime {
         Runtime::rust => {
             match algorithm {
-                Algorithm::xgboost => crate::bindings::xgboost::Estimator::from_bytes(&data)?,
-                Algorithm::lightgbm => crate::bindings::lightgbm::Estimator::from_bytes(&data)?,
+                Algorithm::xgboost => crate::bindings::xgboost::Estimator::from_bytes(&data, &hyperparams)?,
+                Algorithm::lightgbm => crate::bindings::lightgbm::Estimator::from_bytes(&data, &hyperparams)?,
                 Algorithm::linear => match task {
-                    Task::regression => crate::bindings::linfa::LinearRegression::from_bytes(&data)?,
+                    Task::regression => crate::bindings::linfa::LinearRegression::from_bytes(&data, &hyperparams)?,
                     Task::classification => {
-                        crate::bindings::linfa::LogisticRegression::from_bytes(&data)?
+                        crate::bindings::linfa::LogisticRegression::from_bytes(&data, &hyperparams)?
                     }
                     _ => error!("Rust runtime only supports `classification` and `regression` task types for linear algorithms."),
                 },
-                Algorithm::svm => crate::bindings::linfa::Svm::from_bytes(&data)?,
+                Algorithm::svm => crate::bindings::linfa::Svm::from_bytes(&data, &hyperparams)?,
                 _ => todo!(), //smartcore_load(&data, task, algorithm, &hyperparams),
             }
         }
 
         #[cfg(feature = "python")]
-        Runtime::python => crate::bindings::sklearn::Estimator::from_bytes(&data)?,
+        Runtime::python => crate::bindings::sklearn::Estimator::from_bytes(&data, &hyperparams)?,
 
         #[cfg(not(feature = "python"))]
         Runtime::python => {
```

**File**: `pgml-extension/src/orm/model.rs` (modified, +8/-7)
```diff
@@ -360,6 +360,7 @@ impl Model {
                 )
                 .unwrap()
                 .unwrap();
+                let hyperparams = result.get(11).unwrap().unwrap();
 
                 let bindings: Box<dyn Bindings> = match runtime {
                     Runtime::openai => {
@@ -369,27 +370,27 @@ impl Model {
                     Runtime::rust => {
                         match algorithm {
                             Algorithm::xgboost => {
-                                xgboost::Estimator::from_bytes(&data)?
+                                xgboost::Estimator::from_bytes(&data, &hyperparams)?
                             }
                             Algorithm::lightgbm => {
-                                lightgbm::Estimator::from_bytes(&data)?
+                                lightgbm::Estimator::from_bytes(&data, &hyperparams)?
                             }
                             Algorithm::linear => match project.task {
                                 Task::regression => {
-                                    linfa::LinearRegression::from_bytes(&data)?
+                                    linfa::LinearRegression::from_bytes(&data, &hyperparams)?
                                 }
                                 Task::classification => {
-                                    linfa::LogisticRegression::from_bytes(&data)?
+                                    linfa::LogisticRegression::from_bytes(&data, &hyperparams)?
                                 }
                                 _ => bail!("No default runtime available for tasks other than `classification` and `regression` when using a linear algorithm."),
                             },
-                            Algorithm::svm => linfa::Svm::from_bytes(&data)?,
+                            Algorithm::svm => linfa::Svm::from_bytes(&data, &hyperparams)?,
                             _ => todo!(), //smartcore_load(&data, task, algorithm, &hyperparams),
                         }
                     }
 
                     #[cfg(feature = "python")]
-                    Runtime::python => sklearn::Estimator::from_bytes(&data)?,
+                    Runtime::python => sklearn::Estimator::from_bytes(&data, &hyperparams)?,
 
                     #[cfg(not(feature = "python"))]
                     Runtime::python => {
@@ -409,7 +410,7 @@ impl Model {
                     snapshot_id,
                     algorithm,
                     runtime,
-                    hyperparams: result.get(6).unwrap().unwrap(),
+                    hyperparams: hyperparams,
                     status: Status::from_str(result.get(7).unwrap().unwrap()).unwrap(),
                     metrics: result.get(8).unwrap(),
                     search: result.get(9).unwrap().map(|search| Search::from_str(search).unwrap()),
```

---

### Incident Patch 14: `ebb4fa7a` (2024-09-10)
**Commit Message**: Fix grammar (#1619)

**File**: `pgml-cms/blog/announcing-postgresml-django.md` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ With postgresml-django, you can:
 
 Whether you're building a recommendation system, a semantic search engine, or any application requiring text similarity comparisons, postgresml-django streamlines your workflow and enhances your Django projects with the power of PostgresML.
 
-## Quick Start
+## Quick start
 
 Here's a simple example of how to use postgresml-django with a Django model:
 
@@ -48,7 +48,7 @@ results = Document.vector_search("text_embedding", "query to search against")
 
 In this example, we define a `Document` model with a `text` field and a `text_embedding` VectorField. The VectorField automatically generates embeddings for the `text` field using the specified transformer. The `vector_search` method allows for easy similarity searches based on these embeddings.
 
-## Why We are Excited About this
+## Why we are excited about this
 
 There are ton of reasons we are excited for this release but they can all be summarized by two main points:
 
```

---

### Incident Patch 15: `45e8a4e7` (2024-08-12)
**Commit Message**: Organize guides, and prevent wrapping in docs nav (#1604)

**File**: `README.md` (modified, +4/-4)
```diff
@@ -97,10 +97,10 @@ SELECT pgml.transform(
 ```
 
 ## Tabular data
-- [47+ classification and regression algorithms](https://postgresml.org/docs/api/sql-extension/pgml.train/)
+- [47+ classification and regression algorithms](https://postgresml.org/docs/open-source/pgml/api/pgml.train)
 - [8 - 40X faster inference than HTTP based model serving](https://postgresml.org/blog/postgresml-is-8x-faster-than-python-http-microservices)
 - [Millions of transactions per second](https://postgresml.org/blog/scaling-postgresml-to-one-million-requests-per-second)
-- [Horizontal scalability](https://github.com/postgresml/pgcat)
+- [Horizontal scalability](https://postgresml.org/docs/open-source/pgcat/)
 
 **Training a classification model**
 
@@ -142,7 +142,7 @@ docker run \
     sudo -u postgresml psql -d postgresml
 ```
 
-For more details, take a look at our [Quick Start with Docker](https://postgresml.org/docs/resources/developer-docs/quick-start-with-docker) documentation.
+For more details, take a look at our [Quick Start with Docker](https://postgresml.org/docs/open-source/pgml/developers/quick-start-with-docker) documentation.
 
 # Getting Started
 
@@ -1105,7 +1105,7 @@ pgml: SELECT logs->>'epoch' AS epoch, logs->>'step' AS step, logs->>'loss' AS lo
 During training, model is periodically uploaded to Hugging Face Hub. You will find the model at `https://huggingface.co/<username>/<project_name>`. An example model that was automatically pushed to Hugging Face Hub is [here](https://huggingface.co/santiadavani/imdb_review_sentiement).
 
 ### 6. Inference using fine-tuned model
-Now, that we have fine-tuned model on Hugging Face Hub, we can use [`pgml.transform`](https://postgresml.org/docs/introduction/apis/sql-extensions/pgml.transform/text-classification) to perform real-time predictions as well as batch predictions. 
+Now, that we have fine-tuned model on Hugging Face Hub, we can use [`pgml.transform`](/docs/open-source/pgml/api/pgml.transform) to perform real-time predictions as well as batch predictions. 
 
 **Real-time predictions**
 
```

**File**: `pgml-cms/blog/semantic-search-in-postgres-in-15-minutes.md` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ SELECT pgml.embed('mixedbread-ai/mxbai-embed-large-v1', 'Generating embeddings i
 
 !!!
 
-We used the [pgml.embed](/docs/api/sql-extension/pgml.embed) PostresML function to generate an embedding of the sentence "Generating embeddings in Postgres is fun!" using the [mixedbread-ai/mxbai-embed-large-v1](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1) model from mixedbread.ai.
+We used the [pgml.embed](/docs/open-source/pgml/api/pgml.embed) PostresML function to generate an embedding of the sentence "Generating embeddings in Postgres is fun!" using the [mixedbread-ai/mxbai-embed-large-v1](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1) model from mixedbread.ai.
 
 The output size of the vector varies per model, and in `mxbai-embed-large-v1` outputs vectors with 1024 dimensions: each vector contains 1024 floating point numbers. 
 
```

**File**: `pgml-cms/blog/sentiment-analysis-using-express-js-and-postgresml.md` (modified, +6/-6)
```diff
@@ -24,7 +24,7 @@ Express is a mature JS backend framework touted as being fast and flexible. It i
 
 Sentiment analysis is a valuable tool for understanding the emotional polarity of text. You can determine if the text is positive, negative, or neutral. Common use cases include understanding product reviews, survey questions, and social media posts.
 
-In this application, we'll be applying sentiment analysis to note taking. Note taking and journaling can be an excellent practice for work efficiency and self improvement. However, if you are like me, it quickly becomes impossible to find and make use of anything I've written down. Notes that are useful must be easy to navigate. With this motivation, let's create a demo that can record notes throughout the day. Each day will have a summary and sentiment score. That way, if I'm looking for that time a few weeks ago when we were frustrated with our old MLOps platform — it will be easy to find.&#x20;
+In this application, we'll be applying sentiment analysis to note taking. Note taking and journaling can be an excellent practice for work efficiency and self improvement. However, if you are like me, it quickly becomes impossible to find and make use of anything I've written down. Notes that are useful must be easy to navigate. With this motivation, let's create a demo that can record notes throughout the day. Each day will have a summary and sentiment score. That way, if I'm looking for that time a few weeks ago when we were frustrated with our old MLOps platform — it will be easy to find.
 
 We will perform all the Machine Learning heavy lifting with the pgml extension function `pgml.transform()`. This brings Hugging Face Transformers into our data layer.
 
@@ -36,7 +36,7 @@ You can see the full code on [GitHub](https://github.com/postgresml/example-expr
 
 This app is composed of three main parts, reading and writing to a database, performing sentiment analysis on entries, and creating a summary.
 
-We are going to use [postgresql-client](https://www.npmjs.com/package/postgresql-client) to connect to our DB.&#x20;
+We are going to use [postgresql-client](https://www.npmjs.com/package/postgresql-client) to connect to our DB.
 
 When the application builds we ensure we have two tables, one for notes and one for the the daily summary and sentiment score.
 
@@ -62,7 +62,7 @@ const day = await connection.execute(`
 
 We also have three endpoints to hit:
 
-* `app.get(“/", async (req, res, next)` which returns all the notes for that day and the daily summary.&#x20;
+* `app.get(“/", async (req, res, next)` which returns all the notes for that day and the daily summary.
 * `app.post(“/add", async (req, res, next)` which accepts a new note entry and performs a sentiment analysis. We simplify the score by converting it to 1, 0, -1 for positive, neutral, negative and save it in our notes table.
 
 ```postgresql
@@ -146,8 +146,8 @@ not bad for less than an hour of coding.
 
 ### Final Thoughts
 
-This app is far from complete but does show an easy and scalable way to get started with ML in Express. From here I encourage you to head over to our [docs](https://postgresml.org/docs/api/sql-extension/) and see what other features could be added.
+This app is far from complete but does show an easy and scalable way to get started with ML in Express. From here I encourage you to head over to our [docs](https://postgresml.org/docs) and see what other features could be added.
 
-If SQL is not your thing, no worries. Check out or [JS SDK](https://postgresml.org/docs/api/client-sdk/getting-started) to streamline all our best practices with simple JavaScript.&#x20;
+If SQL is not your thing, no worries. Check out or [JS SDK](https://postgresml.org/docs/open-source/korvus/) to streamline all our best practices with simple JavaScript.
 
-We love hearing from you — please reach out to us on [Discord ](https://discord.gg/DmyJP3qJ7U)or simply [Contact Us](https://postgresml.org/contact) here if you have any questions or feedback.&#x20;
+We love hearing from you — please reach out to us on [Discord ](https://discord.gg/DmyJP3qJ7U)or simply [Contact Us](https://postgresml.org/contact) here if you have any questions or feedback.
```

**File**: `pgml-cms/blog/using-postgresml-with-django-and-embedding-search.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ PostgresML allows anyone to integrate advanced AI capabilities into their applic
 
 Advanced search engines like Google use this technique to extract the meaning of search queries and rank the results based on what the user actually _wants_, unlike simple keyword matches which can easily give irrelevant results.
 
-To accomplish this, for each document in our app, we include an embedding column stored as a vector. A vector is just an array of floating point numbers. For each item in our to-do list, we automatically generate the embedding using the PostgresML [`pgml.embed()`](https://postgresml.org/docs/introduction/apis/sql-extensions/pgml.embed) function. This function runs inside the database and doesn't require the Django app to install the model locally.
+To accomplish this, for each document in our app, we include an embedding column stored as a vector. A vector is just an array of floating point numbers. For each item in our to-do list, we automatically generate the embedding using the PostgresML [`pgml.embed()`](/docs/open-source/pgml/api/pgml.embed) function. This function runs inside the database and doesn't require the Django app to install the model locally.
 
 An embedding model running inside PostgresML is able to extract the meaning of search queries & compare it to the meaning of the documents it stores, just like a human being would if they were able to search millions of documents in just a few milliseconds.
 
```

**File**: `pgml-cms/docs/README.md` (modified, +3/-5)
```diff
@@ -23,16 +23,14 @@ PostgresML allows you to take advantage of the fundamental relationship between
 
 These capabilities are primarily provided by two open-source software projects, that may be used independently, but are designed to be used together with the rest of the Postgres ecosystem:
 
-* [**pgml**](/docs/api/sql-extension/) - an open source extension for PostgreSQL. It adds support for GPUs and the latest ML & AI algorithms _inside_ the database with a SQL API and no additional infrastructure, networking latency, or reliability costs.
-* [**PgCat**](/docs/product/pgcat/) - an open source connection pooler for PostgreSQL. It abstracts the scalability and reliability concerns of managing a distributed cluster of Postgres databases. Client applications connect only to the pooler, which handles load balancing, sharding, and failover, outside of any single database server.
+* [**pgml**](/docs/open-source/pgml/) - an open source extension for PostgreSQL. It adds support for GPUs and the latest ML & AI algorithms _inside_ the database with a SQL API and no additional infrastructure, networking latency, or reliability costs.
+* [**PgCat**](/docs/open-source/pgcat/) - an open source connection pooler for PostgreSQL. It abstracts the scalability and reliability concerns of managing a distributed cluster of Postgres databases. Client applications connect only to the pooler, which handles load balancing, sharding, and failover, outside of any single database server.
 
 <figure><img src=".gitbook/assets/architecture.png" alt="PostgresML architectural diagram"><figcaption></figcaption></figure>
 
-To learn more about how we designed PostgresML, take a look at our [architecture overview](/docs/resources/architecture/).
-
 ## Client SDK
 
-The PostgresML team also provides [native language SDKs](/docs/api/client-sdk/) which implement best practices for common ML & AI applications. The JavaScript and Python SDKs are generated from the a core Rust library, which provides a uniform API, correctness and efficiency across all environments.
+The PostgresML team also provides [native language SDKs](/docs/open-source/korvus/) which implement best practices for common ML & AI applications. The JavaScript and Python SDKs are generated from the a core Rust library, which provides a uniform API, correctness and efficiency across all environments.
 
 While using the SDK is completely optional, SDK clients can perform advanced machine learning tasks in a single SQL request, without having to transfer additional data, models, hardware or dependencies to the client application.
 
```

**File**: `pgml-cms/docs/SUMMARY.md` (modified, +20/-20)
```diff
@@ -23,31 +23,15 @@
 * [PGML](open-source/pgml/README.md)
   * [API](open-source/pgml/api/README.md)
     * [pgml.embed()](open-source/pgml/api/pgml.embed.md)
-    * [pgml.transform()](open-source/pgml/api/pgml.transform/README.md)
-      * [Fill-Mask](open-source/pgml/api/pgml.transform/fill-mask.md)
-      * [Question answering](open-source/pgml/api/pgml.transform/question-answering.md)
-      * [Summarization](open-source/pgml/api/pgml.transform/summarization.md)
-      * [Text classification](open-source/pgml/api/pgml.transform/text-classification.md)
-      * [Text Generation](open-source/pgml/api/pgml.transform/text-generation.md)
-      * [Text-to-Text Generation](open-source/pgml/api/pgml.transform/text-to-text-generation.md)
-      * [Token Classification](open-source/pgml/api/pgml.transform/token-classification.md)
-      * [Translation](open-source/pgml/api/pgml.transform/translation.md)
-      * [Zero-shot Classification](open-source/pgml/api/pgml.transform/zero-shot-classification.md)
+    * [pgml.transform()](open-source/pgml/api/pgml.transform.md)
     * [pgml.transform_stream()](open-source/pgml/api/pgml.transform_stream.md)
     * [pgml.deploy()](open-source/pgml/api/pgml.deploy.md)
     * [pgml.decompose()](open-source/pgml/api/pgml.decompose.md)
     * [pgml.chunk()](open-source/pgml/api/pgml.chunk.md)
     * [pgml.generate()](open-source/pgml/api/pgml.generate.md)
     * [pgml.predict()](open-source/pgml/api/pgml.predict/README.md)
       * [Batch Predictions](open-source/pgml/api/pgml.predict/batch-predictions.md)
-    * [pgml.train()](open-source/pgml/api/pgml.train/README.md)
-      * [Regression](open-source/pgml/api/pgml.train/regression.md)
-      * [Classification](open-source/pgml/api/pgml.train/classification.md)
-      * [Clustering](open-source/pgml/api/pgml.train/clustering.md)
-      * [Decomposition](open-source/pgml/api/pgml.train/decomposition.md)
-      * [Data Pre-processing](open-source/pgml/api/pgml.train/data-pre-processing.md)
-      * [Hyperparameter Search](open-source/pgml/api/pgml.train/hyperparameter-search.md)
-      * [Joint Optimization](open-source/pgml/api/pgml.train/joint-optimization.md)
+    * [pgml.train()](open-source/pgml/api/pgml.train.md)
     * [pgml.tune()](open-source/pgml/api/pgml.tune.md)
   * [Guides](open-source/pgml/guides/README.md)
     * [Embeddings](open-source/pgml/guides/embeddings/README.md)
@@ -56,11 +40,27 @@
       * [Aggregation](open-source/pgml/guides/embeddings/vector-aggregation.md)
       * [Similarity](open-source/pgml/guides/embeddings/vector-similarity.md)
       * [Normalization](open-source/pgml/guides/embeddings/vector-normalization.md)
+    * [LLMs](open-source/pgml/guides/llms/README.md)
+      * [Fill-Mask](open-source/pgml/guides/llms/fill-mask.md)
+      * [Question answering](open-source/pgml/guides/llms/question-answering.md)
+      * [Summarization](open-source/pgml/guides/llms/summarization.md)
+      * [Text classification](open-source/pgml/guides/llms/text-classification.md)
+      * [Text Generation](open-source/pgml/guides/llms/text-generation.md)
+      * [Text-to-Text Generation](open-source/pgml/guides/llms/text-to-text-generation.md)
+      * [Token Classification](open-source/pgml/guides/llms/token-classification.md)
+      * [Translation](open-source/pgml/guides/llms/translation.md)
+      * [Zero-shot Classification](open-source/pgml/guides/llms/zero-shot-classification.md)
+    * [Supervised Learning](open-source/pgml/guides/supervised-learning/README.md)
+      * [Regression](open-source/pgml/guides/supervised-learning/regression.md)
+      * [Classification](open-source/pgml/guides/supervised-learning/classification.md)
+      * [Clustering](open-source/pgml/guides/supervised-learning/clustering.md)
+      * [Decomposition](open-source/pgml/guides/supervised-learning/decomposition.md)
+      * [Data Pre-processing](open-source/pgml/guides/supervised-learning/data-pre-processing.md)
+      * [Hyperparameter Search](open-source/pgml/guides/supervised-learning/hyperparameter-search.md)
+      * [Joint Optimization](open-source/pgml/guides/supervised-learning/joint-optimization.md)
     * [Search](open-source/pgml/guides/improve-search-results-with-machine-learning.md)
     * [Chatbots](open-source/pgml/guides/chatbots/README.md)
-    * [Supervised Learning](open-source/pgml/guides/supervised-learning.md)
     * [Unified RAG](open-source/pgml/guides/unified-rag.md)
-    * [Natural Language Processing](open-source/pgml/guides/natural-language-processing.md)
     * [Vector database](open-source/pgml/guides/vector-database.md)
     <!--
     * [Search]()
```

**File**: `pgml-cms/docs/introduction/getting-started/README.md` (modified, +4/-4)
```diff
@@ -6,14 +6,14 @@ description: Getting starting with PostgresML, a GPU powered machine learning da
 
 A PostgresML deployment consists of multiple components working in concert to provide a complete Machine Learning platform:
 
-* PostgreSQL database, with [_pgml_](/docs/api/sql-extension/), _pgvector_ and many other extensions that add features useful in day-to-day and machine learning use cases
-* [PgCat pooler](/docs/product/pgcat/) to load balance thousands of concurrenct client requests across several database instances
+* PostgreSQL database, with `pgml`, `pgvector` and many other extensions that add features useful in day-to-day and machine learning use cases
+* [PgCat pooler](/docs/open-source/pgcat/) to load balance thousands of concurrenct client requests across several database instances
 * A web application to manage deployed models and share experiments analysis with SQL notebooks
 
-We provide a fully managed solution in [our cloud](create-your-database), and document a self-hosted installation in the [Developer Docs](/docs/resources/developer-docs/quick-start-with-docker).
+We provide a fully managed solution in [our cloud](/docs/cloud/overview), and document a self-hosted installation in the [Developer Docs](/docs/open-source/pgml/developers/quick-start-with-docker).
 
 <figure class="my-4"><img src="../../.gitbook/assets/architecture.png" alt="PostgresML architecture"><figcaption></figcaption></figure>
 
 By building PostgresML on top of a mature database, we get reliable backups for model inputs and proven scalability without reinventing the wheel, so that we can focus on providing access to the latest developments in open source machine learning and artificial intelligence.
 
-This guide will help you get started with [$100 credits](create-your-database), which includes access to GPU accelerated models and 5 GB of storage, or you can skip to our [Developer Docs](/docs/resources/developer-docs/quick-start-with-docker) to see how to run PostgresML locally with our Docker image.
+This guide will help you get started with [$100 credits](create-your-database), which includes access to GPU accelerated models and 5 GB of storage, or you can skip to our [Developer Docs](/docs/open-source/pgml/developers/quick-start-with-docker) to see how to run PostgresML locally with our Docker image.
```

**File**: `pgml-cms/docs/open-source/pgml/README.md` (modified, +9/-9)
```diff
@@ -18,7 +18,7 @@ See the [API](api/) for a full list of all functions provided by `pgml`.
 Common tasks include:
 - [Splitting text - pgml.chunk()](api/pgml.chunk)
 - [Generating embeddings - pgml.embed()](api/pgml.embed)
-- [Generating text - pgml.transform()](api/pgml.transform/text-generation)
+- [Generating text - pgml.transform()](api/pgml.transform)
 - [Streaming generated text - pgml.transform_stream()](api/pgml.transform_stream)
 
 ## Open-source LLMs
@@ -28,17 +28,17 @@ PostgresML defines four SQL functions which use [🤗 Hugging Face](https://hugg
 | Function | Description |
 |---------------|-------------|
 | [pgml.embed()](api/pgml.embed) | Generate embeddings using latest sentence transformers from Hugging Face. |
-| [pgml.transform()](api/pgml.transform/) | Text generation using LLMs like Llama, Mixtral, and many more, with models downloaded from Hugging Face. |
-| [pgml.transform_stream()](api/pgml.transform_stream) | Streaming version of [pgml.transform()](api/pgml.transform/), which fetches partial responses as they are being generated by the model, substantially decreasing time to first token. |
+| [pgml.transform()](api/pgml.transform) | Text generation using LLMs like Llama, Mixtral, and many more, with models downloaded from Hugging Face. |
+| [pgml.transform_stream()](api/pgml.transform_stream) | Streaming version of [pgml.transform()](api/pgml.transform), which fetches partial responses as they are being generated by the model, substantially decreasing time to first token. |
 | [pgml.tune()](api/pgml.tune) | Perform fine tuning tasks on Hugging Face models, using data stored in the database. | 
 
 ## Classical machine learning
 
 PostgresML defines four SQL functions which allow training regression, classification, and clustering models on tabular data:
 
-| Function | Description |
-|---------------|-------------|
-| [pgml.train()](api/pgml.train/) | Train a model on PostgreSQL tables or views using any algorithm from Scikit-learn, with the additional support for XGBoost, LightGBM and Catboost. |
-| [pgml.predict()](api/pgml.predict/) | Run inference on live application data using a model trained with [pgml.train()](pgml.train/). |
-| [pgml.deploy()](api/pgml.deploy) | Deploy a specific version of a model trained with pgml.train(), using your own accuracy metrics. |
-| [pgml.load_dataset()](api/pgml.load_dataset) | Load any of the toy datasets from Scikit-learn or any dataset from Hugging Face. |
+| Function | Description                                                                                                                                        |
+|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
+| [pgml.train()](api/pgml.train) | Train a model on PostgreSQL tables or views using any algorithm from Scikit-learn, with the additional support for XGBoost, LightGBM and Catboost. |
+| [pgml.predict()](api/pgml.predict/) | Run inference on live application data using a model trained with [pgml.train()](api/pgml.train).                                                  |
+| [pgml.deploy()](api/pgml.deploy) | Deploy a specific version of a model trained with pgml.train(), using your own accuracy metrics.                                                   |
+| [pgml.load_dataset()](api/pgml.load_dataset) | Load any of the toy datasets from Scikit-learn or any dataset from Hugging Face.                                                                   |
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
