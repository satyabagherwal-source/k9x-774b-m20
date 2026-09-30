# Forensic Learning Record (Deep Inspection): jhspetersson/fselect

> **Canonical Artifact**: `07_PROJECT_LEARNING/jhspetersson-fselect-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jhspetersson/fselect](https://github.com/jhspetersson/fselect))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:23:00.413Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jhspetersson/fselect`
- **Description**: Find files with SQL-like queries
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4468 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/config.rs`
```
//! Handles configuration loading and saving

use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

const CONFIG_FILE: &str = "config.toml";

macro_rules! vec_of_strings {
    ($($str:literal),*) => {
        Some(vec![
            $(String::from($str)),*
        ])
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Config {
    pub no_color: Option<bool>,
    pub gitignore: Option<bool>,
    pub hgignore: Option<bool>,
    pub dockerignore: Option<bool>,
    pub is_zip_archive: Option<Vec<String>>,
    pub is_archive: Option<Vec<String>>,
    pub is_audio: Option<Vec<String>>,
    pub is_book: Option<Vec<String>>,
    pub is_doc: Option<Vec<String>>,
    pub is_font: Option<Vec<String>>,
    pub is_image: Option<Vec<String>>,
    pub is_source: Option<Vec<String>>,
    pub is_video: Option<Vec<String>>,
    pub default_file_size_format: Option<String>,
    pub us_dates: Option<bool>,
    pub check_for_updates: Option<bool>,
    #[serde(default)]
    pub everything: Option<bool>,
    #[serde(default)]
    pub plocate: Option<bool>,
    #[serde(skip_serializing, default = "get_false")]
    pub debug: bool,
    #[serde(skip)]
    save: bool,
}

fn get_false() -> bool {
    false
}

impl Config {
    pub fn new() -> Result<Config, String> {
        let mut config_file;

        if let Some(cf) = Self::get_current_dir_config() {
            config_file = cf;
        } else {
            let config_dir = crate::util::app_dirs::get_project_dir();

            if config_dir.is_none() {
                return Ok(Config::default());
            }

            config_file = config_dir.unwrap();
            config_file.push(CONFIG_FILE);

            if !config_file.exists() {
                return Ok(Config::default());
            }
        }

        Config::from(config_file)
    }

    pub fn from(config_file: PathBuf) -> Result<Config, String> {
        if let Ok(mut file) = fs::File::open(config_file) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                toml::from_str(&contents).map_err(|err| err.to_string())
            } else {
                Err("Could not read config file. Using default settings.".to_string())
            }
        } else {
            Err("Could not open config file. Using default settings.".to_string())
        }
    }

    fn get_current_dir_config() -> Option<PathBuf> {
        if let Ok(mut pb) = std::env::current_exe() {
            pb.pop();
            pb.push(CONFIG_FILE);
            if pb.exists() {
                return Some(pb);
            }
        }

        None
    }

    pub fn save(&self) {
        if !self.save {
            return;
        }

        let config_dir = crate::util::app_dirs::get_project_dir();

        if config_dir.is_none() {
            return;
        }

        let mut config_file = config_dir.unwrap();
        let _ = fs::create_dir_all(&config_file);
        config_file.push(CONFIG_FILE);

        if config_file.exists() {
            return;
        }

        let toml = toml::to_string_pretty(&self).unwrap();

        if let Ok(mut file) = fs::File::create(&config_file) {
            let _ = file.write_all(toml.as_bytes());
        }
    }

    pub fn default() -> Config {
        Config {
            no_color: Some(false),
            gitignore: Some(false),
            hgignore: Some(false),
            dockerignore: Some(false),
            is_zip_archive: vec_of_strings![".zip", ".jar", ".war", ".ear"],
            is_archive: vec_of_strings![
                ".7z", ".bz2", ".bzip2", ".gz", ".gzip", ".lz", ".rar", ".tar", ".xz", ".zip"
            ],
            is_audio: vec_of_strings![
                ".aac", ".aiff", ".amr", ".flac", ".gsm", ".m4a", ".m4b", ".m4p", ".mp3", ".ogg",
                ".wav", ".wma"
            ],
            is_book: vec_of_strings![
                ".azw3", ".chm", ".djv", ".djvu", ".epub", ".fb2", ".mobi", ".pdf"
            ],
            is_doc: vec_of_strings![
                ".accdb", ".doc", ".docm", ".docx", ".dot", ".dotm", ".dotx", ".mdb", ".odp",
                ".ods", ".odt", ".pdf", ".potm", ".potx", ".ppt", ".pptm", ".pptx", ".rtf", ".xlm",
                ".xls", ".xlsm", ".xlsx", ".xlt", ".xltm", ".xltx", ".xps"
            ],
            is_font: vec_of_strings![
                ".eot", ".fon", ".otc", ".otf", ".ttc", ".ttf", ".woff", ".woff2"
            ],
            is_image: vec_of_strings![
                ".bmp", ".exr", ".gif", ".heic", ".jpeg", ".jpg", ".jxl", ".png", ".psb", ".psd",
                ".svg", ".tga", ".tiff", ".webp"
            ],
            is_source: vec_of_strings![
                ".asm", ".awk", ".bas", ".c", ".cc", ".ceylon", ".clj", ".coffee", ".cpp", ".cs", ".d",
                ".dart", ".elm", ".erl", ".go", ".gradle", ".groovy", ".h", ".hh", ".hpp", ".java",
                ".jl", ".js", ".jsp", ".jsx", ".kt", ".kts", ".lua", ".nim", ".pas", ".php", ".pl",
                ".pm", ".py", ".qml", ".rb", ".rs", ".scala", ".sol", ".swift", ".tcl", ".ts", ".tsx",
                ".vala", ".vb", ".zig"
            ],
            is_video: vec_of_strings![
                ".3gp", ".avi", ".flv", ".m4p", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg",
                ".webm", ".wmv"
            ],
            default_file_size_format: Some(String::new()),
            us_dates: Some(false),
            check_for_updates: Some(false),
            everything: Some(false),
            plocate: Some(false),
            debug: false,
            save: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config() {
        let config = Config::default();

        assert!(config.is_source.unwrap().contains(&String::from(".rs")));
    }
}

```

### Core Architecture Module: `src/expr.rs`
```
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fmt::Display;
use std::fmt::Formatter;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::ops::{Deref, DerefMut};
use crate::field::Field;
use crate::function::Function;
use crate::operators::ArithmeticOp;
use crate::operators::LogicalOp;
use crate::operators::Op;
use crate::query::Query;
use crate::util::{str_to_bool, Variant};

pub const IS_FILE: &str = "is_file";
pub const IS_DIR: &str = "is_dir";
pub const IS_PIPE: &str = "is_pipe";
pub const IS_CHAR: &str = "is_char";
pub const IS_BLOCK: &str = "is_block";
pub const IS_SOCKET: &str = "is_socket";
pub const FILE_TYPE_PROPS: [&str; 6] = [IS_FILE, IS_DIR, IS_PIPE, IS_CHAR, IS_BLOCK, IS_SOCKET];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Expr {
    pub left: Option<Box<Expr>>,
    pub arithmetic_op: Option<ArithmeticOp>,
    pub logical_op: Option<LogicalOp>,
    pub op: Option<Op>,
    pub right: Option<Box<Expr>>,
    pub minus: bool,
    pub field: Option<Field>,
    pub function: Option<Function>,
    pub args: Option<Vec<Expr>>,
    pub val: Option<String>,
    pub subquery: Option<Box<Query>>,
    pub root_alias: Option<String>,
    pub alias: Option<String>,
    pub weight: i32,
    #[serde(skip)]
    pub props: ExprProps,
}

#[derive(Debug, Clone, Default)]
pub struct ExprProps(HashMap<String, Variant>);

impl ExprProps {
    fn set_file_type(&mut self, key: &'static str, value: bool) {
        self.insert(key.to_string(), Variant::from_bool(value));
        if value {
            for other in FILE_TYPE_PROPS.iter().filter(|other| **other != key) {
                self.insert(other.to_string(), Variant::from_bool(false));
            }
        }
    }
}

impl Deref for ExprProps {
    type Target = HashMap<String, Variant>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for ExprProps {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl PartialEq for ExprProps {
    fn eq(&self, _other: &Self) -> bool {
        true
    }
}

impl Eq for ExprProps {}


impl Expr {
    pub fn new() -> Expr {
        Expr {
            left: None,
            arithmetic_op: None,
            logical_op: None,
            op: None,
            right: None,
            minus: false,
            field: None,
            function: None,
            args: None,
            val: None,
            subquery: None,
            root_alias: None,
            alias: None,
            weight: 0,
            props: ExprProps::default(),
        }
    }
    
    pub fn op(left: Expr, op: Op, right: Expr) -> Expr {
        let left_weight = left.weight;
        let right_weight = right.weight;
        let props = Self::comparison_props(&left, op, &right);

        Expr {
            left: Some(Box::new(left)),
            arithmetic_op: None,
            logical_op: None,
            op: Some(op),
            right: Some(Box::new(right)),
            minus: false,
            field: None,
            function: None,
            args: None,
            val: None,
            subquery: None,
            root_alias: None,
            alias: None,
            weight: left_weight + right_weight,
            props,
        }
    }

    fn comparison_props(left: &Expr, op: Op, right: &Expr) -> ExprProps {
        let mut props = ExprProps::default();
        if let Some((field, value)) = Self::bool_field_comparison(left, op, right)
            && let Some(key) = Self::file_type_key(&field) {
            props.set_file_type(key, value);
        }

        props
    }

    fn field_props(field: &Field) -> ExprProps {
        let mut props = ExprProps::default();
        if let Some(key) = Self::file_type_key(field) {
            props.set_file_type(key, true);
        }

        props
    }

    fn bool_field_comparison(left: &Expr, op: Op, right: &Expr) -> Option<(Field, bool)> {
        let negated = match op {
            Op::Eq | Op::Eeq => false,
            Op::Ne | Op::Ene => true,
            _ => return None,
        };
        let (field, literal_expr) = match (left.field, right.field) {
            (Some(field), None) => (field, right),
            (None, Some(field)) => (field, left),
            _ => return None,
        };
        let literal = literal_expr.bool_literal()?;

        Some((field, literal != negated))
    }

    fn file_type_key(field: &Field) -> Option<&'static str> {
        match field {
            Field::IsFile => Some(IS_FILE),
            Field::IsDir => Some(IS_DIR),
            Field::IsPipe => Some(IS_PIPE),
            Field::IsCharacterDevice => Some(IS_CHAR),
            Field::IsBlockDevice => Some(IS_BLOCK),
            Field::IsSocket => Some(IS_SOCKET),
            _ => None,
        }
    }

    fn bool_literal(&self) -> Option<bool> {
        if self.field.is_some() || self.function.is_some() || self.subquery.is_some()
            || self.left.is_some() || self.right.is_some() || self.minus {
            return None;
        }
        self.val.as_deref().and_then(str_to_bool)
    }

    #[allow(unused)]
    pub fn bool_prop(&self, key: &str) -> Option<bool> {
        self.get_prop(key).map(|v| v.to_bool())
    }


    pub fn logical_op(left: Expr, logical_op: LogicalOp, right: Expr) -> Result<Expr, String> {
        let left_weight = left.weight;
        let right_weight = right.weight;
        let props = Self::merge_props(&left, &logical_op, &right)?;

        let expr = Expr {
            left: Some(Box::new(left)),
            arithmetic_op: None,
            logical_op: Some(logical_op),
            op: None,
            right: Some(Box::new(right)),
            minus: false,
            field: None,
            function: None,
            args: None,
            val: None,
            subquery: None,
            root_alias: None,
            alias: None,
            weight: left_weight + right_weight,
            props,
        };

        Ok(expr)
    }

    fn merge_props(left: &Expr, logical_op: &LogicalOp, right: &Expr) -> Result<ExprProps, String> {
        let mut props = ExprProps::default();

        let mut left_keys: Vec<&String> = left.props.keys().collect();
        left_keys.sort();

        for key in left_keys {
            let left_value = &left.props[key];
            match right.props.get(key) {
                Some(right_value) if right_value != left_value => {
                    if *logical_op == LogicalOp::And {
                        return Err(format!(
                            "Conflicting conditions: '{}' requires {} = {}, but '{}' requires {} = {}",
                            left, key, left_value, right, key, right_value
                        ));
                    }
                }
                Some(_) => {
                    props.insert(key.clone(), left_value.clone());
                }
                None if *logical_op == LogicalOp::And => {
                    props.insert(key.clone(), left_value.clone());
                }
                None => {}
            }
        }

        if *logical_op == LogicalOp::And {
            for (key, right_value) in right.props.iter() {
                if !left.props.contains_key(key) {
                    props.insert(key.clone(), right_value.clone());
                }
            }
        }

        Ok(props)
    }

    pub fn arithmetic_op(left: Expr, arithmetic_op: ArithmeticOp, right: Expr) -> Expr {
        let left_weight = left.weight;
        let right_weight = right.weight;

        Expr {
            left: Some(Box::new(left)),
            arithmetic_op: Some(arithmetic_op),
            logical_op: None,
            op: None,
            right: Some(Box::new(right)),
            minus: false,
            field: None,
            function: None,
            args: None,
            val: None,
            subquery: None,
            root_alias: None,
            alias: None,
            weight: left_weight + right_weight,
            
```

### Core Architecture Module: `src/field/content_handlers.rs`
```
use crate::field::Field;
use crate::field::context::FieldContext;
use crate::util::*;
use crate::util::error::SearchError;

pub fn handle_line_count(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_line_count(ctx.entry);
    if let Some(line_count) = ctx.fms.get_line_count() {
        return Ok(Variant::from_int(line_count as i64));
    }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_word_count(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_content_stats(ctx.entry);
    if let Some(stats) = ctx.fms.get_content_stats()
        && stats.is_text {
            return Ok(Variant::from_int(stats.word_count as i64));
        }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_char_count(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_content_stats(ctx.entry);
    if let Some(stats) = ctx.fms.get_content_stats()
        && stats.is_text {
            return Ok(Variant::from_int(stats.char_count as i64));
        }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_encoding(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_content_stats(ctx.entry);
    if let Some(stats) = ctx.fms.get_content_stats()
        && stats.is_text {
            return Ok(Variant::from_string(&stats.encoding));
        }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_has_bom(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    if let Some(stats) = ctx.fms.get_content_stats() {
        return Ok(Variant::from_bool(stats.has_bom));
    }
    Ok(Variant::from_bool(has_bom(ctx.entry)))
}

pub fn handle_line_ending(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_content_stats(ctx.entry);
    if let Some(stats) = ctx.fms.get_content_stats()
        && stats.is_text {
            return Ok(Variant::from_string(&stats.line_ending));
        }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_mime(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_mime_type(ctx.entry);
    if let Some(mime) = ctx.fms.get_mime_type() {
        return Ok(Variant::from_string(&String::from(mime)));
    }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_is_binary_or_text(ctx: &mut FieldContext, field: &Field) -> Result<Variant, SearchError> {
    ctx.fms.update_file_metadata(ctx.entry, ctx.follow_symlinks);
    if let Some(meta) = ctx.fms.get_file_metadata()
        && meta.is_dir() {
            return Ok(Variant::from_bool(false));
        }

    ctx.fms.update_mime_type(ctx.entry);
    if let Some(mime) = ctx.fms.get_mime_type() {
        let is_text = is_text_mime(mime);
        let result = matches!(field, Field::IsText) == is_text;
        return Ok(Variant::from_bool(result));
    }

    Ok(Variant::from_bool(false))
}

pub fn handle_is_type(ctx: &mut FieldContext, field: &Field) -> Result<Variant, SearchError> {
    let os_name = ctx.entry.file_name();
    let name = match ctx.file_info {
        Some(fi) => fi.name.as_str(),
        None => &os_name.to_string_lossy(),
    };
    let result = match field {
        Field::IsArchive => check_extension(name, &ctx.config.is_archive, &ctx.default_config.is_archive),
        Field::IsAudio => check_extension(name, &ctx.config.is_audio, &ctx.default_config.is_audio),
        Field::IsBook => check_extension(name, &ctx.config.is_book, &ctx.default_config.is_book),
        Field::IsDoc => check_extension(name, &ctx.config.is_doc, &ctx.default_config.is_doc),
        Field::IsFont => check_extension(name, &ctx.config.is_font, &ctx.default_config.is_font),
        Field::IsImage => check_extension(name, &ctx.config.is_image, &ctx.default_config.is_image),
        Field::IsSource => check_extension(name, &ctx.config.is_source, &ctx.default_config.is_source),
        Field::IsVideo => check_extension(name, &ctx.config.is_video, &ctx.default_config.is_video),
        _ => return Err(SearchError::fatal(format!("Unexpected field in handle_is_type: {:?}", field))),
    };
    Ok(Variant::from_bool(result))
}

fn check_extension(
    file_name: &str,
    config_ext: &Option<Vec<String>>,
    default_ext: &Option<Vec<String>>,
) -> bool {
    match config_ext.as_ref().or(default_ext.as_ref()) {
        Some(extensions) => has_extension(file_name, extensions),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use crate::config::Config;

    use super::*;

    fn test_field(entry: &fs::DirEntry, root_path: &Path, field: &Field) -> Variant {
        let config = Config::default();
        let default_config = Config::default();
        let mut fms = crate::field::context::FileMetadataState::new();
        #[cfg(feature = "git")]
        let mut git_cache = crate::util::git::GitCache::new();
        #[cfg(all(unix, feature = "users"))]
        let user_cache = uzers::UsersCache::new();
        let none_file_info = None;
        let mut ctx = FieldContext {
            entry,
            file_info: &none_file_info,
            root_path,
            fms: &mut fms,
            #[cfg(feature = "git")]
            git_cache: &mut git_cache,
            follow_symlinks: true,
            config: &config,
            default_config: &default_config,
            #[cfg(all(unix, feature = "users"))]
            user_cache: &user_cache,
        };
        crate::field::dispatch::get_field_value(&mut ctx, field).unwrap()
    }

    fn entry_for(dir: &Path, name: &str) -> fs::DirEntry {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .find(|e| e.file_name() == name)
            .unwrap()
    }

    #[test]
    fn test_content_fields_on_text_file() {
        let tmp = std::env::temp_dir().join("fselect_test_content_fields_text_h");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("a.txt"), "hello world\nsecond line\n").unwrap();

        let entry = entry_for(&tmp, "a.txt");

        assert_eq!(test_field(&entry, &tmp, &Field::WordCount).to_string(), "4");
        assert_eq!(test_field(&entry, &tmp, &Field::CharCount).to_string(), "24");
        assert_eq!(test_field(&entry, &tmp, &Field::Encoding).to_string(), "ASCII");
        assert_eq!(test_field(&entry, &tmp, &Field::HasBom).to_string(), "false");
        assert_eq!(test_field(&entry, &tmp, &Field::LineEnding).to_string(), "LF");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_content_fields_on_binary_file() {
        let tmp = std::env::temp_dir().join("fselect_test_content_fields_binary_h");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("a.bin"), [0x00u8, 0x01, 0x02, b'x']).unwrap();

        let entry = entry_for(&tmp, "a.bin");

        // Text-only fields surface an empty value for binary content.
        assert_eq!(test_field(&entry, &tmp, &Field::WordCount).to_string(), "");
        assert_eq!(test_field(&entry, &tmp, &Field::CharCount).to_string(), "");
        assert_eq!(test_field(&entry, &tmp, &Field::Encoding).to_string(), "");
        assert_eq!(test_field(&entry, &tmp, &Field::LineEnding).to_string(), "");
        // has_bom is still a definite boolean.
        assert_eq!(test_field(&entry, &tmp, &Field::HasBom).to_string(), "false");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_has_bom_true_for_utf8_bom_file() {
        let tmp = std::env::temp_dir().join("fselect_test_content_fields_bom_h");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let mut content = vec![0xEFu8, 0xBB, 0xBF];
        content.extend_from_slice(b"data");
        fs::write(tmp.join("bom.txt"), content).unwrap();

        let entry = entry_for(&tmp, "bom.txt");

        assert_eq!(test_field(&entry, &tmp, &Field::HasBom).to_string(), "true");
        assert_eq!(test_field(&ent
```

### Core Architecture Module: `src/field/context.rs`
```
use std::collections::HashMap;
use std::fs::{DirEntry, FileType, Metadata};
use std::path::Path;

#[cfg(all(unix, feature = "users"))]
use uzers::UsersCache;

use crate::config::Config;
use crate::fileinfo::FileInfo;
use crate::util::*;
#[cfg(feature = "git")]
use crate::util::git::GitCache;
use crate::util::audio::{AudioInfo, get_audio_info};
use crate::util::dimensions::get_dimensions;
use crate::util::duration::get_duration;

pub struct FileMetadataState {
    pub(crate) file_metadata: Option<Option<Metadata>>,
    pub(crate) entry_file_type: Option<Option<FileType>>,
    pub(crate) content_stats: Option<Option<ContentStats>>,
    pub(crate) dimensions: Option<Option<Dimensions>>,
    pub(crate) duration: Option<Option<Duration>>,
    pub(crate) audio_info: Option<Option<AudioInfo>>,
    pub(crate) exif_metadata: Option<Option<HashMap<String, String>>>,
    pub(crate) mime_type: Option<Option<String>>,
    pub(crate) sha1_hash: Option<String>,
    pub(crate) sha256_hash: Option<String>,
    pub(crate) sha512_hash: Option<String>,
    pub(crate) sha3_hash: Option<String>,
}

impl FileMetadataState {
    pub fn new() -> FileMetadataState {
        FileMetadataState {
            file_metadata: None,
            entry_file_type: None,
            content_stats: None,
            dimensions: None,
            duration: None,
            audio_info: None,
            exif_metadata: None,
            mime_type: None,
            sha1_hash: None,
            sha256_hash: None,
            sha512_hash: None,
            sha3_hash: None,
        }
    }

    pub fn clear(&mut self) {
        *self = Self::new();
    }

    pub fn update_file_metadata(&mut self, entry: &DirEntry, follow_symlinks: bool) {
        if self.file_metadata.is_none() {
            self.file_metadata = Some(get_metadata(entry, follow_symlinks));
        }
    }

    pub fn get_file_metadata(&self) -> Option<&Metadata> {
        self.file_metadata.as_ref().and_then(|o| o.as_ref())
    }

    pub fn get_file_metadata_as_option(&self) -> &Option<Metadata> {
        static NONE: Option<Metadata> = None;
        self.file_metadata.as_ref().unwrap_or(&NONE)
    }

    /// Whether a metadata load has already been attempted for the current file
    /// (regardless of whether it succeeded). Lets type predicates reuse it
    /// instead of issuing a fresh stat.
    pub fn file_metadata_loaded(&self) -> bool {
        self.file_metadata.is_some()
    }

    /// Seed the entry's file type from a value the caller already resolved
    /// (e.g. the directory traversal's descent check), so type predicates can
    /// reuse it. A `None` hint is ignored, leaving the slot to be filled lazily
    /// on first use.
    pub fn seed_file_type(&mut self, file_type: Option<FileType>) {
        if file_type.is_some() {
            self.entry_file_type = Some(file_type);
        }
    }

    /// The entry's file type, computed once and memoised. Reflects the entry
    /// itself (symlinks are not followed), so it answers is_symlink directly
    /// and is_dir/is_file only when not following symlinks.
    pub fn get_or_compute_file_type(&mut self, entry: &DirEntry) -> Option<FileType> {
        if self.entry_file_type.is_none() {
            self.entry_file_type = Some(entry.file_type().ok());
        }
        self.entry_file_type.flatten()
    }

    pub fn update_line_count(&mut self, entry: &DirEntry) {
        // Always derived from the content-stats pass: a raw newline-byte scan
        // disagrees with the decoded text for UTF-16/32 files (0x0A occurs
        // inside multibyte code units), which made the reported count depend
        // on which content field happened to be evaluated first.
        self.update_content_stats(entry);
    }

    pub fn get_line_count(&self) -> Option<usize> {
        self.get_content_stats().map(|stats| stats.line_count)
    }

    pub fn update_content_stats(&mut self, entry: &DirEntry) {
        if self.content_stats.is_none() {
            self.content_stats = Some(get_content_stats(entry));
        }
    }

    pub fn get_content_stats(&self) -> Option<&ContentStats> {
        self.content_stats.as_ref().and_then(|o| o.as_ref())
    }

    pub fn update_audio_info(&mut self, entry: &DirEntry) {
        if self.audio_info.is_none() {
            self.audio_info = Some(get_audio_info(&entry.path()));
        }
    }

    pub fn get_audio_info(&self) -> Option<&AudioInfo> {
        self.audio_info.as_ref().and_then(|o| o.as_ref())
    }

    pub fn update_exif_metadata(&mut self, entry: &DirEntry) {
        if self.exif_metadata.is_none() {
            self.exif_metadata = Some(get_exif_metadata(entry));
        }
    }

    pub fn get_exif_metadata(&self) -> Option<&HashMap<String, String>> {
        self.exif_metadata.as_ref().and_then(|o| o.as_ref())
    }

    pub fn get_exif_string(&mut self, entry: &DirEntry, key: &str) -> Option<Variant> {
        self.update_exif_metadata(entry);
        self.get_exif_metadata()
            .and_then(|info| info.get(key))
            .map(Variant::from_string)
    }

    pub fn update_mime_type(&mut self, entry: &DirEntry) {
        if self.mime_type.is_none() {
            self.mime_type = Some(
                tree_magic_mini::from_filepath(&entry.path()).map(String::from)
            );
        }
    }

    pub fn get_mime_type(&self) -> Option<&str> {
        self.mime_type.as_ref().and_then(|o| o.as_deref())
    }

    pub fn get_or_compute_sha1(&mut self, entry: &DirEntry) -> &str {
        if self.sha1_hash.is_none() {
            self.sha1_hash = Some(get_sha1_file_hash(entry));
        }
        self.sha1_hash.as_deref().unwrap()
    }

    pub fn get_or_compute_sha256(&mut self, entry: &DirEntry) -> &str {
        if self.sha256_hash.is_none() {
            self.sha256_hash = Some(get_sha256_file_hash(entry));
        }
        self.sha256_hash.as_deref().unwrap()
    }

    pub fn get_or_compute_sha512(&mut self, entry: &DirEntry) -> &str {
        if self.sha512_hash.is_none() {
            self.sha512_hash = Some(get_sha512_file_hash(entry));
        }
        self.sha512_hash.as_deref().unwrap()
    }

    pub fn get_or_compute_sha3(&mut self, entry: &DirEntry) -> &str {
        if self.sha3_hash.is_none() {
            self.sha3_hash = Some(get_sha3_512_file_hash(entry));
        }
        self.sha3_hash.as_deref().unwrap()
    }

    pub fn update_dimensions(&mut self, entry: &DirEntry) {
        if self.dimensions.is_none() {
            self.dimensions = Some(get_dimensions(entry.path()));
        }
    }

    pub fn get_dimensions(&self) -> Option<&Dimensions> {
        self.dimensions.as_ref().and_then(|o| o.as_ref())
    }

    pub fn update_duration(&mut self, entry: &DirEntry) {
        if self.duration.is_none() {
            // Audio durations come from lofty (via the cached audio info);
            // anything it doesn't handle falls back to the video extractors.
            self.update_audio_info(entry);
            let duration = self
                .get_audio_info()
                .and_then(|info| info.duration)
                .map(|length| Duration { length })
                .or_else(|| get_duration(entry.path()));
            self.duration = Some(duration);
        }
    }

    pub fn get_duration(&self) -> Option<&Duration> {
        self.duration.as_ref().and_then(|o| o.as_ref())
    }
}

pub struct FieldContext<'a> {
    pub entry: &'a DirEntry,
    pub file_info: &'a Option<FileInfo>,
    pub root_path: &'a Path,
    pub fms: &'a mut FileMetadataState,
    #[cfg(feature = "git")]
    pub git_cache: &'a mut GitCache,
    pub follow_symlinks: bool,
    pub config: &'a Config,
    pub default_config: &'a Config,
    #[cfg(all(unix, feature = "users"))]
    pub user_cache: &'a UsersCache,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_metadata_state_new() {
        let state = FileMetadataState::new();

        assert!(state.file_metadata.is_none());
        as
```

### Core Architecture Module: `src/field/dispatch.rs`
```
use crate::field::Field;
use crate::field::context::FieldContext;
use crate::field::{
    content_handlers, exif_handlers, git_handlers, hash_handlers, media_handlers,
    metadata_handlers, mode_handlers, path_handlers,
};
use crate::util::*;
use crate::util::error::SearchError;

pub fn get_field_value(ctx: &mut FieldContext, field: &Field) -> Result<Variant, SearchError> {
    if ctx.file_info.is_some() && !field.is_available_for_archived_files() {
        return Ok(Variant::empty(VariantType::String));
    }

    match field {
        // Path fields
        Field::Name => path_handlers::handle_name(ctx),
        Field::Filename => path_handlers::handle_filename(ctx),
        Field::Extension => path_handlers::handle_extension(ctx),
        Field::Path => path_handlers::handle_path(ctx),
        Field::AbsPath => path_handlers::handle_abspath(ctx),
        Field::Directory => path_handlers::handle_directory(ctx),
        Field::AbsDir => path_handlers::handle_absdir(ctx),

        // Size / type metadata
        Field::Size => metadata_handlers::handle_size(ctx),
        Field::FormattedSize => metadata_handlers::handle_formatted_size(ctx),
        Field::IsDir => metadata_handlers::handle_is_dir(ctx),
        Field::IsFile => metadata_handlers::handle_is_file(ctx),
        Field::IsSymlink => metadata_handlers::handle_is_symlink(ctx),
        Field::LinkTarget => metadata_handlers::handle_link_target(ctx),
        Field::IsBrokenSymlink => metadata_handlers::handle_is_broken_symlink(ctx),
        Field::IsPipe => metadata_handlers::handle_is_pipe(ctx),
        Field::IsCharacterDevice => metadata_handlers::handle_is_char_device(ctx),
        Field::IsBlockDevice => metadata_handlers::handle_is_block_device(ctx),
        Field::IsSocket => metadata_handlers::handle_is_socket(ctx),
        Field::Device => metadata_handlers::handle_device(ctx),
        Field::Rdev => metadata_handlers::handle_rdev(ctx),
        Field::Inode => metadata_handlers::handle_inode(ctx),
        Field::Blocks => metadata_handlers::handle_blocks(ctx),
        Field::BlockSize => metadata_handlers::handle_blksize(ctx),
        Field::Hardlinks => metadata_handlers::handle_hardlinks(ctx),
        Field::Atime => metadata_handlers::handle_atime(ctx),
        Field::AtimeNsec => metadata_handlers::handle_atime_nsec(ctx),
        Field::Mtime => metadata_handlers::handle_mtime(ctx),
        Field::MtimeNsec => metadata_handlers::handle_mtime_nsec(ctx),
        Field::Ctime => metadata_handlers::handle_ctime(ctx),
        Field::CtimeNsec => metadata_handlers::handle_ctime_nsec(ctx),
        Field::Created => metadata_handlers::handle_created(ctx),
        Field::Accessed => metadata_handlers::handle_accessed(ctx),
        Field::Modified => metadata_handlers::handle_modified(ctx),
        Field::IsHidden => metadata_handlers::handle_is_hidden(ctx),
        Field::IsEmpty => metadata_handlers::handle_is_empty(ctx),
        Field::HasXattrs => metadata_handlers::handle_has_xattrs(ctx),
        Field::XattrCount => metadata_handlers::handle_xattr_count(ctx),
        Field::Extattrs => metadata_handlers::handle_extattrs(ctx),
        Field::HasExtattrs => metadata_handlers::handle_has_extattrs(ctx),
        Field::Acl => metadata_handlers::handle_acl(ctx),
        Field::HasAcl => metadata_handlers::handle_has_acl(ctx),
        Field::DefaultAcl => metadata_handlers::handle_default_acl(ctx),
        Field::HasDefaultAcl => metadata_handlers::handle_has_default_acl(ctx),
        Field::HasCapabilities => metadata_handlers::handle_has_capabilities(ctx),
        Field::Capabilities => metadata_handlers::handle_capabilities(ctx),
        Field::IsShebang => metadata_handlers::handle_is_shebang(ctx),

        // Git
        Field::IsGitRepo => git_handlers::handle_is_git_repo(ctx),
        #[cfg(feature = "git")]
        Field::IsGitTracked => git_handlers::handle_is_git_tracked(ctx),
        #[cfg(feature = "git")]
        Field::IsGitignored => git_handlers::handle_is_gitignored(ctx),
        #[cfg(feature = "git")]
        Field::GitStatus => git_handlers::handle_git_status(ctx),
        #[cfg(feature = "git")]
        Field::GitBranch => git_handlers::handle_git_branch(ctx),
        #[cfg(feature = "git")]
        Field::GitLastCommitHash => git_handlers::handle_git_last_commit_hash(ctx),
        #[cfg(feature = "git")]
        Field::GitLastCommitDate => git_handlers::handle_git_last_commit_date(ctx),
        #[cfg(feature = "git")]
        Field::GitLastCommitAuthor => git_handlers::handle_git_last_commit_author(ctx),

        // Mode / permissions
        Field::Mode => mode_handlers::handle_mode(ctx),
        Field::UserRead => mode_handlers::handle_user_read(ctx),
        Field::UserWrite => mode_handlers::handle_user_write(ctx),
        Field::UserExec => mode_handlers::handle_user_exec(ctx),
        Field::UserAll => mode_handlers::handle_user_all(ctx),
        Field::GroupRead => mode_handlers::handle_group_read(ctx),
        Field::GroupWrite => mode_handlers::handle_group_write(ctx),
        Field::GroupExec => mode_handlers::handle_group_exec(ctx),
        Field::GroupAll => mode_handlers::handle_group_all(ctx),
        Field::OtherRead => mode_handlers::handle_other_read(ctx),
        Field::OtherWrite => mode_handlers::handle_other_write(ctx),
        Field::OtherExec => mode_handlers::handle_other_exec(ctx),
        Field::OtherAll => mode_handlers::handle_other_all(ctx),
        Field::Suid => mode_handlers::handle_suid(ctx),
        Field::Sgid => mode_handlers::handle_sgid(ctx),
        Field::IsSticky => mode_handlers::handle_is_sticky(ctx),
        Field::Uid => mode_handlers::handle_uid(ctx),
        Field::Gid => mode_handlers::handle_gid(ctx),
        #[cfg(all(unix, feature = "users"))]
        Field::User => mode_handlers::handle_user(ctx),
        #[cfg(all(unix, feature = "users"))]
        Field::Group => mode_handlers::handle_group(ctx),

        // Media (dimensions, audio)
        Field::Width => media_handlers::handle_width(ctx),
        Field::Height => media_handlers::handle_height(ctx),
        Field::Duration => media_handlers::handle_duration(ctx),
        Field::Bitrate => media_handlers::handle_bitrate(ctx),
        Field::Freq => media_handlers::handle_freq(ctx),
        Field::Title => media_handlers::handle_title(ctx),
        Field::Artist => media_handlers::handle_artist(ctx),
        Field::Album => media_handlers::handle_album(ctx),
        Field::Year => media_handlers::handle_year(ctx),
        Field::Genre => media_handlers::handle_genre(ctx),
        Field::Comment => media_handlers::handle_comment(ctx),
        Field::Track => media_handlers::handle_track(ctx),
        Field::Disc => media_handlers::handle_disc(ctx),

        // EXIF
        Field::ExifDateTime | Field::ExifDateTimeOriginal => {
            exif_handlers::handle_exif_datetime(ctx, field)
        }
        Field::ExifGpsAltitude => exif_handlers::handle_exif_gps_altitude(ctx),
        Field::ExifGpsLatitude => exif_handlers::handle_exif_gps_latitude(ctx),
        Field::ExifGpsLongitude => exif_handlers::handle_exif_gps_longitude(ctx),
        Field::ExifMake
        | Field::ExifModel
        | Field::ExifSoftware
        | Field::ExifVersion
        | Field::ExifExposureTime
        | Field::ExifAperture
        | Field::ExifShutterSpeed
        | Field::ExifFNumber
        | Field::ExifIsoSpeed
        | Field::ExifPhotographicSensitivity
        | Field::ExifFocalLength
        | Field::ExifLensMake
        | Field::ExifLensModel
        | Field::ExifDescription
        | Field::ExifArtist
        | Field::ExifCopyright
        | Field::ExifOrientation
        | Field::ExifFlash
        | Field::ExifColorSpace
        | Field::ExifExposureProgram
        | Field::ExifExposureBias
        | Field::ExifWhiteBalance
        | Field::ExifMeteringMode
        | Field::ExifSceneType
        | Field::ExifContrast
        | Field::ExifSaturation
        | Field::ExifShar
```

### Core Architecture Module: `src/field/exif_handlers.rs`
```
use crate::field::Field;
use crate::field::context::FieldContext;
use crate::util::*;
use crate::util::datetime::parse_datetime;
use crate::util::error::SearchError;

pub fn handle_exif_datetime(ctx: &mut FieldContext, field: &Field) -> Result<Variant, SearchError> {
    ctx.fms.update_exif_metadata(ctx.entry);
    let key = match field {
        Field::ExifDateTime => "DateTime",
        Field::ExifDateTimeOriginal => "DateTimeOriginal",
        _ => return Err(SearchError::fatal(format!("Unexpected field in handle_exif_datetime: {:?}", field))),
    };

    if let Some(exif_info) = ctx.fms.get_exif_metadata()
        && let Some(exif_value) = exif_info.get(key)
            && let Ok(exif_datetime) = parse_datetime(exif_value) {
                return Ok(Variant::from_datetime(exif_datetime.0));
            }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_exif_gps_altitude(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_exif_metadata(ctx.entry);
    if let Some(exif_info) = ctx.fms.get_exif_metadata()
        && let Some(exif_value) = exif_info.get("__Alt")
            && let Ok(value) = exif_value.parse() {
                return Ok(Variant::from_float(value));
            }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_exif_gps_latitude(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_exif_metadata(ctx.entry);
    if let Some(exif_info) = ctx.fms.get_exif_metadata()
        && let Some(exif_value) = exif_info.get("__Lat")
            && let Ok(value) = exif_value.parse() {
                return Ok(Variant::from_float(value));
            }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_exif_gps_longitude(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    ctx.fms.update_exif_metadata(ctx.entry);
    if let Some(exif_info) = ctx.fms.get_exif_metadata()
        && let Some(exif_value) = exif_info.get("__Lng")
            && let Ok(value) = exif_value.parse() {
                return Ok(Variant::from_float(value));
            }
    Ok(Variant::empty(VariantType::String))
}

pub fn handle_exif_string(ctx: &mut FieldContext, field: &Field) -> Result<Variant, SearchError> {
    let key = match field {
        Field::ExifMake => "Make",
        Field::ExifModel => "Model",
        Field::ExifSoftware => "Software",
        Field::ExifVersion => "ExifVersion",
        Field::ExifExposureTime => "ExposureTime",
        Field::ExifAperture => "ApertureValue",
        Field::ExifShutterSpeed => "ShutterSpeedValue",
        Field::ExifFNumber => "FNumber",
        Field::ExifIsoSpeed => "ISOSpeed",
        Field::ExifPhotographicSensitivity => "PhotographicSensitivity",
        Field::ExifFocalLength => "FocalLength",
        Field::ExifLensMake => "LensMake",
        Field::ExifLensModel => "LensModel",
        Field::ExifDescription => "ImageDescription",
        Field::ExifArtist => "Artist",
        Field::ExifCopyright => "Copyright",
        Field::ExifOrientation => "Orientation",
        Field::ExifFlash => "Flash",
        Field::ExifColorSpace => "ColorSpace",
        Field::ExifExposureProgram => "ExposureProgram",
        Field::ExifExposureBias => "ExposureBiasValue",
        Field::ExifWhiteBalance => "WhiteBalance",
        Field::ExifMeteringMode => "MeteringMode",
        Field::ExifSceneType => "SceneCaptureType",
        Field::ExifContrast => "Contrast",
        Field::ExifSaturation => "Saturation",
        Field::ExifSharpness => "Sharpness",
        Field::ExifBodySerial => "BodySerialNumber",
        Field::ExifLensSerial => "LensSerialNumber",
        Field::ExifUserComment => "UserComment",
        Field::ExifImageWidth => "PixelXDimension",
        Field::ExifImageHeight => "PixelYDimension",
        Field::ExifMaxAperture => "MaxApertureValue",
        Field::ExifDigitalZoom => "DigitalZoomRatio",
        _ => return Err(SearchError::fatal(format!("Unexpected field in handle_exif_string: {:?}", field))),
    };
    if let Some(val) = ctx.fms.get_exif_string(ctx.entry, key) {
        return Ok(val);
    }
    Ok(Variant::empty(VariantType::String))
}

```

### Core Architecture Module: `src/field/git_handlers.rs`
```
//! Handlers for git-related fields.

use crate::field::context::FieldContext;
use crate::util::*;
use crate::util::error::SearchError;

#[cfg(feature = "git")]
use crate::util::git::status_to_string;

pub fn handle_is_git_repo(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    Ok(Variant::from_bool(ctx.entry.path().join(".git").exists()))
}

#[cfg(feature = "git")]
pub fn handle_is_git_tracked(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    Ok(Variant::from_bool(
        ctx.git_cache.is_tracked(&path).unwrap_or(false),
    ))
}

#[cfg(feature = "git")]
pub fn handle_is_gitignored(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    Ok(Variant::from_bool(
        ctx.git_cache.is_ignored(&path).unwrap_or(false),
    ))
}

#[cfg(feature = "git")]
pub fn handle_git_status(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    match ctx.git_cache.status(&path) {
        Some(status) => Ok(Variant::from_string(&status_to_string(status).to_string())),
        None => Ok(Variant::empty(VariantType::String)),
    }
}

#[cfg(feature = "git")]
pub fn handle_git_branch(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    match ctx.git_cache.branch(&path) {
        Some(branch) => Ok(Variant::from_string(&branch)),
        None => Ok(Variant::empty(VariantType::String)),
    }
}

#[cfg(feature = "git")]
pub fn handle_git_last_commit_hash(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    match ctx.git_cache.last_commit(&path) {
        Some(commit) => Ok(Variant::from_string(&commit.hash)),
        None => Ok(Variant::empty(VariantType::String)),
    }
}

#[cfg(feature = "git")]
pub fn handle_git_last_commit_date(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    if let Some(commit) = ctx.git_cache.last_commit(&path)
        && commit.time >= 0
        && let Some(naive) = system_time_to_naive_local(
            std::time::UNIX_EPOCH + std::time::Duration::from_secs(commit.time as u64),
        ) {
            return Ok(Variant::from_datetime(naive));
        }
    Ok(Variant::empty(VariantType::String))
}

#[cfg(feature = "git")]
pub fn handle_git_last_commit_author(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let path = ctx.entry.path();
    match ctx.git_cache.last_commit(&path) {
        Some(commit) => Ok(Variant::from_string(&commit.author)),
        None => Ok(Variant::empty(VariantType::String)),
    }
}

```

### Core Architecture Module: `src/field/hash_handlers.rs`
```
use crate::field::context::FieldContext;
use crate::util::error::SearchError;
use crate::util::Variant;

pub fn handle_sha1(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let hash = ctx.fms.get_or_compute_sha1(ctx.entry).to_string();
    Ok(Variant::from_string(&hash))
}

pub fn handle_sha256(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let hash = ctx.fms.get_or_compute_sha256(ctx.entry).to_string();
    Ok(Variant::from_string(&hash))
}

pub fn handle_sha512(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let hash = ctx.fms.get_or_compute_sha512(ctx.entry).to_string();
    Ok(Variant::from_string(&hash))
}

pub fn handle_sha3(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
    let hash = ctx.fms.get_or_compute_sha3(ctx.entry).to_string();
    Ok(Variant::from_string(&hash))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #185** (2026-06-10): **fix mobile input**
  *Symptoms*: 

- **Issue #184** (2026-05-11): **Crash/panic in some queries with time/date**
  *Symptoms*: Crash when created/modified/accessed mentioned in query  thread 'main' (487628) panicked at /home/user/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/chrono-0.4.44/src/datetime/mod.rs:1931:38: No such local time stack backtrace:    0:     0x6524d9987d02 - <unknown>    1:     0x6524d96d75ea - <unknown>    2:     0x6524d9987175 - <unknown>    3:     0x6524d9986de8 - <unknown>    4:     0x6524d99afaf8 - <unknown>    5:     0x6524d99afa79 - <unknown>    6:     0x6524d99afa6c - <unknown>    7:     0x6524d96d85bb - <unknown>    8:     0x6524d96d0300 - <unknown>    9:     0x6524d96846f1 - <unknown>   10:     0x6524d97aa0ac - <unknown>   11:     0x6524d97b1d1a - <unknown>   12:     0x6524d97ad3ee - <unknown>   13:     0x6524d97ad034 - <unknown>   14:     0x6524d97a19f1 - <unknown>   15:     0x6524d967ea9d - <unknown>   16:     0x6524d9681ca4 - <unknown>   17:     0x6524d97c0653 - <unknown>   18:     0x6524d96925c6 - <unknown>   19:     0x7721f7c2a1ca - __libc_start_call_main                                at ./csu/../sysdeps/nptl/libc_start_call_main.h:58:16   20:     0x7721f7c2a28b - __libc_start_main_impl                                at ./csu/../csu/libc-start.c:360:3   21:     0x6524d9676565 - <unknown>   22:                0x0 - <unknown> [ble: exit 101]  Shell: bash Distro: Ubuntu 24.04 (Kde Neon) Deb package of fselect
  **Post-Mortem & Fix Analysis**:
  > Blank column in binary + Musl version if 'created' column queried
  > Thank you for the bugreport!   I tried to fix a panic when parsing some invalid datetimes. If you can build from `master`, please check if the fix works for you. Otherwise, it will be available after the next release.
  > Built with Rust Podman/Docker container in .deb, fixed crash but cannot find files with invalid datetimes(((

- **Issue #183** (2026-04-15): **Add codegen-units = 1 to the current Release profile in Cargo.toml**
  *Symptoms*: Hi!  Fselect already enables FatLTO for the default Cargo Release profile. However, we can improve current defaults a bit further into the aggressive optimizations side, and add `codegen-units = 1` (CU1) option too. This change pushes optimizations even more, and allows to achieve a bit better binary sizes for the binary and possibly a bit better CPU performance. All of these without an impact to compilation times since FatLTO is already enabled.  I've done quick tests on the latest `fselect` with Rust 1.94.1, Macbook M1 Pro, macOS Tahoe 24.1, `cargo build -r` command, and measured the following improvements:  * Current Release profile: 5.6 Mib, clean build time: 56s * Current Release profile + CU1: 5.2 Mib, clean build time: 60s  Definitely not a huge win but the required change is literally one-liner in the root Cargo.toml file - so it seems reasonable to enable it in the upstream to optimize the CLI binary a bit more by default.  Thank you.
  **Post-Mortem & Fix Analysis**:
  > Indeed, I was able to cut off 300 KB from the release build size on my machine 👍  Thanks a lot!

- **Issue #182** (2025-11-13): **Syntax errors are printed without final newline**
  *Symptoms*: When `fselect` reports a syntax error, it does so without printing a newline after the end of the output. This messes up the next shell prompt:  ``` mathrick@lcelt:~$ fselect 'select name, path, size from /data as data' query: could not parse tokens at the end of the querymathrick@lcelt:~$ ``` It is especially bad with a coloured prompt (which is the default in recent Ubuntu and derivatives), as the terminal escapes confuse bash's facilities for previous line editing (i.e. up and down arrow keys <kbd>↑</kbd><kbd>↓</kbd>)
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! Fixed in `master`.

- **Issue #181** (2025-11-14): **Aliases (`FROM x AS y`) don't work as documented**
  *Symptoms*: https://fselect.rocks/ gives the following example of using aliases:  ``` select name, path, size from /data as data ```  However, this syntax is not actually accepted by `fselect`:  ``` $ fselect name, path, size from /tmp as tmp query: could not parse tokens at the end of the query  # No luck with extra "select" either $ fselect select name, path, size from /tmp as tmp query: could not parse tokens at the end of the query ``` I also tried using the full query in the example (`select name, path, size from /data as data where exists (select * from /backup as backup where backup.name = data.name)`), but that didn't make any difference.   Tested with `fselect` 0.8.12 and 0.9.0 on Ubuntu, same result.
  **Post-Mortem & Fix Analysis**:
  > My bad! I should have mentioned that all that is relevant for the upcoming version (`0.9.1`) only. Please wait a few days, the goodies are on their way 😄 

- **Issue #179** (2025-07-16): **Missing build for linux**
  *Symptoms*: The release 0.9.0 is missing compiled binaries for Linux!  Thanks
  **Post-Mortem & Fix Analysis**:
  > Thanks for the reminder! Totally forgot about them, sorry 😄 

- **Issue #178** (2025-07-14): **"Path relative to search root" column?**
  *Symptoms*: Hi, I've been looking at the docs and examples, but to my surprise, I can't find anything that allows matching against path relative to the root given to `FROM`. I.e. something like:  ```bash fselect from /home/mathrick/dotfiles where relpath = "*/mathrick/*" ```  In current fselect, this will match *every* file, but I'm interested in matching only things like `someapp/profiles/mathrick/history`. I would expect `path` to be that, and `abspath` to be, well, the absolute path, but from what I understand, `path` is actually the same as `abspath`  if the root is absolute. This doesn't seem very useful, to be honest. Could it be changed to be always relative to `FROM`?
  **Post-Mortem & Fix Analysis**:
  > Thanks for raising the issue! Indeed, relative behavior of `path` makes so much more sense. Fixed in `master`, will be available with the next release soon.
  > Thank you!

- **Issue #177** (2025-05-31): **Add some fields from EXIF**
  *Symptoms*: Can the following fields be added to the EXIF section?  Field names are from exiftool from http://exiftool.org  Field name                        Example of value Shutter Speed                  : 1/400 F Number                         : 10.0 ISO                                   : 100 Focal Length                     : 58.0 mm Lens ID                              : AF-S Nikkor 24-70mm f/2.8E ED VR  Thanks.
  **Post-Mortem & Fix Analysis**:
  > I added a few more EXIF tags. However, there is still a room for improvements in their parsing. Feel free to send examples of incorrect tag detection.

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

### Incident Patch 1: `7165eb14` (2026-07-06)
**Commit Message**: fix unary minus handling

**File**: `src/expr.rs` (modified, +24/-0)
```diff
@@ -563,6 +563,14 @@ impl Display for Expr {
             fmt.write_char('-')?;
         }
 
+        // A negated composite must keep its grouping: -(1 Add 2) and
+        // (-1) Add 2 would otherwise render identically and share a cache key.
+        let negated_composite = self.minus
+            && (self.arithmetic_op.is_some() || self.logical_op.is_some() || self.op.is_some());
+        if negated_composite {
+            fmt.write_char('(')?;
+        }
+
         if let Some(ref function) = self.function {
             if let Some(ref alias) = self.alias {
                 fmt.write_str(alias)?;
@@ -618,6 +626,10 @@ impl Display for Expr {
             write_operand(fmt, right)?;
         }
 
+        if negated_composite {
+            fmt.write_char(')')?;
+        }
+
         Ok(())
     }
 }
@@ -665,6 +677,18 @@ mod tests {
         assert_ne!(query.fields[0].to_string(), query.fields[1].to_string());
     }
 
+    #[test]
+    fn display_distinguishes_negated_composite() {
+        // -(1+2) is -3 while -1+2 is 1; without parentheses around the negated
+        // composite both would render identically and share a cache key.
+        let query = "select -(1+2), -1+2 from /test";
+        let mut lexer = Lexer::new(vec![query.to_string()]);
+        let mut parser = Parser::new(&mut lexer);
+        let query = parser.parse(false).unwrap();
+
+        assert_ne!(query.fields[0].to_string(), query.fields[1].to_string());
+    }
+
     #[test]
     fn test_weight() {
         let expr = Expr::field(Field::Name);
```

**File**: `src/parser.rs` (modified, +70/-0)
```diff
@@ -1018,6 +1018,19 @@ impl <'a> Parser<'a> {
             }
         }
 
+        // Unary minus before a parenthesized expression: -(1+2). The toggle
+        // makes -(-1) cancel out instead of silently staying negative.
+        if minus && matches!(lexeme, Some(Lexeme::Open) | Some(Lexeme::CurlyOpen)) {
+            self.drop_lexeme();
+            return match self.parse_paren()? {
+                Some(mut expr) => {
+                    expr.minus = !expr.minus;
+                    Ok(Some(expr))
+                }
+                None => Err("Error parsing expression, expecting string".to_string()),
+            };
+        }
+
         match lexeme {
             Some(Lexeme::Error(ref msg)) => {
                 Err(msg.clone())
@@ -1045,6 +1058,27 @@ impl <'a> Parser<'a> {
                         return Ok(Some(expr));
                     }
 
+                // After a comparison operator the lexer emits a bare "-" as a
+                // RawString (start of a negative literal), so `size gt -(1+2)`
+                // arrives here rather than as an arithmetic operator.
+                if s == "-" {
+                    let next = self.next_lexeme();
+                    if matches!(next, Some(Lexeme::Open) | Some(Lexeme::CurlyOpen)) {
+                        self.drop_lexeme();
+                        return match self.parse_paren()? {
+                            Some(mut expr) => {
+                                expr.minus = !expr.minus;
+                                if minus {
+                                    expr.minus = !expr.minus;
+                                }
+                                Ok(Some(expr))
+                            }
+                            None => Err("Error parsing expression, expecting string".to_string()),
+                        };
+                    }
+                    self.drop_lexeme();
+                }
+
                 let mut expr = Expr::value(s.to_string());
                 expr.minus = minus;
 
@@ -2396,6 +2430,42 @@ mod tests {
         assert_eq!(query.roots[0].path, "/test");
     }
 
+    #[test]
+    fn unary_minus_on_parenthesized_expression_parses() {
+        let query = "select -(1+2) from /test";
+        let mut lexer = Lexer::new(vec![query.to_string()]);
+        let mut p = Parser::new(&mut lexer);
+        let query = p.parse(false).unwrap();
+        assert!(!p.there_are_remaining_lexemes());
+
+        assert_eq!(query.fields.len(), 1);
+        assert!(query.fields[0].minus);
+        assert!(query.fields[0].arithmetic_op.is_some());
+    }
+
+    #[test]
+    fn unary_minus_on_parenthesized_expression_in_where_parses() {
+        let query = "select name from /test where size gt -(1+2)";
+        let mut lexer = Lexer::new(vec![query.to_string()]);
+        let mut p = Parser::new(&mut lexer);
+        let query = p.parse(false).unwrap();
+        assert!(!p.there_are_remaining_lexemes());
+
+        let expr = query.expr.unwrap();
+        let right = expr.right.unwrap();
+        assert!(right.minus);
+    }
+
+    #[test]
+    fn double_unary_minus_cancels() {
+        let query = "select -(-1) from /test";
+        let mut lexer = Lexer::new(vec![query.to_string()]);
+        let mut p = Parser::new(&mut lexer);
+        let query = p.parse(false).unwrap();
+
+        assert!(!query.fields[0].minus);
+    }
+
     #[test]
     fn order_by_non_boolean_function_without_parens_should_not_panic() {
         let query = "select name, size from /test order by upper desc";
```

**File**: `src/searcher.rs` (modified, +40/-7)
```diff
@@ -98,6 +98,19 @@ macro_rules! try_output {
 /// its expressions references a `root_alias` that is not declared on one of
 /// the subquery's own roots — that's the correlated-subquery case, where the
 /// result depends on outer-row state propagated via `record_context`.
+/// Applies a leading unary minus to an evaluated expression value, with
+/// MySQL-style numeric coercion (0 - x). Empty values stay empty, like
+/// negating SQL NULL. Literal values are excluded: they carry their sign in
+/// the string itself (`Variant::from_signed_string`).
+fn apply_minus(column_expr: &Expr, value: Variant) -> Variant {
+    if !column_expr.minus || value.to_string().is_empty() {
+        return value;
+    }
+    crate::operators::ArithmeticOp::Subtract
+        .calc(&Variant::from_int(0), &value)
+        .unwrap_or(value)
+}
+
 fn is_subquery_cacheable(query: &Query) -> bool {
     let own_aliases: HashSet<String> = query
         .roots
@@ -1262,29 +1275,33 @@ impl<'a> Searcher<'a> {
             let list = self.get_list_from_subquery(*subquery);
             if !list.is_empty() {
                 let result = list.first().unwrap().to_string();
-                return Ok(Variant::from_string(&result));
+                return Ok(apply_minus(column_expr, Variant::from_string(&result)));
             }
         }
 
         if let Some(ref _function) = column_expr.function {
             let result =
                 self.get_function_value(entry, file_info, root_path, file_map, accumulator, column_expr)?;
+            let result = apply_minus(column_expr, result);
             file_map.insert(column_expr_str, result.to_string());
             return Ok(result);
         }
 
         if let Some(ref field) = column_expr.field {
             if let Some(entry) = entry {
-                let result = self.get_field_value(entry, file_info, root_path, field).unwrap_or(Variant::empty(VariantType::String));
+                let raw = self.get_field_value(entry, file_info, root_path, field).unwrap_or(Variant::empty(VariantType::String));
+                // The record context feeds correlated subqueries and must hold
+                // the raw field value; only the returned value is negated.
+                let result = apply_minus(column_expr, raw.clone());
                 file_map.insert(column_expr_str, result.to_string());
                 let mut context = self.record_context.borrow_mut();
                 let context_key = self.current_alias.clone().unwrap_or_else(|| String::from(""));
                 let context_entry = context.entry(context_key).or_default();
                 let entry_key = if let Some(alias) = column_expr.alias.clone() { alias } else { field.to_string() };
-                context_entry.insert(entry_key, result.to_string());
+                context_entry.insert(entry_key, raw.to_string());
                 return Ok(result);
             } else if let Some(val) = file_map.get(&field.to_string()) {
-                return Ok(Variant::from_string(val));
+                return Ok(apply_minus(column_expr, Variant::from_string(val)));
             } else {
                 return Ok(Variant::empty(VariantType::String));
             }
@@ -1304,13 +1321,13 @@ impl<'a> Searcher<'a> {
                 if let Some(ref right) = column_expr.right {
                     let right_result =
                         self.get_column_expr_value(entry, file_info, root_path, file_map, accumulator, right)?;
-                        result = op.calc(&left_result, &right_result);
+                        result = op.calc(&left_result, &right_result).map(|v| apply_minus(column_expr, v));
                         file_map.insert(column_expr_str, result.clone()?.to_string());
                 } else {
-                    result = Ok(left_result);
+                    result = Ok(apply_minus(column_expr, left_result));
                 }
             } else {
-                result = Ok(left_result);
+                result = Ok(
```

---

### Incident Patch 2: `91b07d3b` (2026-07-05)
**Commit Message**: fix epoch, date_diff, substring semantics

**File**: `src/function.rs` (modified, +109/-11)
```diff
@@ -13,6 +13,7 @@ use std::time::Duration;
 
 use chrono::Datelike;
 use chrono::Local;
+use chrono::LocalResult;
 use chrono::DateTime;
 use chrono::NaiveDate;
 use chrono::NaiveDateTime;
@@ -298,16 +299,18 @@ pub fn get_value(
                 },
             };
 
-            let len: Option<usize> = match &function_args.get(1) {
-                Some(len) => match len.parse::<usize>() {
+            let len: Option<i64> = match &function_args.get(1) {
+                Some(len) => match len.parse::<i64>() {
                     Ok(l) => Some(l),
                     Err(_) => return Err(format!("Could not parse length argument of SUBSTRING function: {}", len)),
                 },
                 _ => None,
             };
 
             let result: String = match len {
-                Some(l) => string.chars().skip(pos as usize).take(l).collect(),
+                // MySQL returns an empty string for a non-positive length
+                Some(l) if l <= 0 => String::new(),
+                Some(l) => string.chars().skip(pos as usize).take(l as usize).collect(),
                 None => string.chars().skip(pos as usize).collect(),
             };
 
@@ -611,7 +614,8 @@ pub fn get_value(
             let date2 = parse_datetime(&function_args[0]);
             match (date1, date2) {
                 (Ok(d1), Ok(d2)) => {
-                    let diff = d1.0.signed_duration_since(d2.0).num_days();
+                    // MySQL DATEDIFF ignores the time parts and diffs calendar dates
+                    let diff = d1.0.date().signed_duration_since(d2.0.date()).num_days();
                     Ok(Variant::from_int(diff))
                 }
                 _ => Ok(Variant::empty(VariantType::Int)),
@@ -623,7 +627,8 @@ pub fn get_value(
                 Err(_) => return Ok(Variant::empty(VariantType::String)),
             };
             match DateTime::from_timestamp(timestamp, 0) {
-                Some(dt) => Ok(Variant::from_string(&format_datetime(&dt.naive_utc()))),
+                // Render as local time: every other datetime in the tool is local-naive
+                Some(dt) => Ok(Variant::from_string(&format_datetime(&dt.with_timezone(&Local).naive_local()))),
                 None => Ok(Variant::empty(VariantType::String)),
             }
         }
@@ -667,7 +672,17 @@ pub fn get_value(
                 "dow" | "dayofweek" => Ok(Variant::from_int(dt.weekday().number_from_sunday() as i64)),
                 "isodow" => Ok(Variant::from_int(dt.weekday().number_from_monday() as i64)),
                 "doy" | "dayofyear" => Ok(Variant::from_int(dt.ordinal() as i64)),
-                "epoch" | "unixtime" => Ok(Variant::from_int(dt.and_utc().timestamp())),
+                "epoch" | "unixtime" => {
+                    // Naive datetimes in the tool are local time, so interpret them
+                    // as local when computing the Unix timestamp
+                    let timestamp = match dt.and_local_timezone(Local) {
+                        LocalResult::Single(local) => local.timestamp(),
+                        LocalResult::Ambiguous(earliest, _) => earliest.timestamp(),
+                        // DST gap: no local mapping exists, fall back to UTC
+                        LocalResult::None => dt.and_utc().timestamp(),
+                    };
+                    Ok(Variant::from_int(timestamp))
+                }
                 _ => Err(format!("Unsupported EXTRACT unit: {}", function_arg)),
             }
         }
@@ -1710,7 +1725,32 @@ mod tests {
         let result = get_value(&function, function_arg, function_args, entry, &file_info);
         assert_eq!(result.unwrap().to_string(), "world");
     }
-    
+
+    #[test]
+    fn function_substring_negative_length() {
+        let function = Function::Substring;
+        let function_arg = String::from("hello world");
+        let function_args = vec![String::from("7"), String::from("-1")];
+        let entry = None;
+        let file_info = None;
+

```

---

### Incident Patch 3: `5eb8894e` (2026-07-05)
**Commit Message**: fix vfs cap revisions

**File**: `src/util/capabilities.rs` (modified, +45/-4)
```diff
@@ -57,8 +57,10 @@ macro_rules! check_caps_word_1 {
     };
 }
 
+const VFS_CAP_REVISION_MASK: u32 = 0xFF000000;
 const VFS_CAP_REVISION_1: u32 = 0x01000000;
-const VFS_CAP_REVISION_2: u32 = 0x02000002;
+const VFS_CAP_REVISION_2: u32 = 0x02000000;
+const VFS_CAP_REVISION_3: u32 = 0x03000000;
 const VFS_CAP_FLAGS_EFFECTIVE: u32 = 0x000001;
 const XATTR_CAPS_SZ_1: usize = 12; // 4 (magic) + 4 (permitted) + 4 (inherited)
 const XATTR_CAPS_SZ_2: usize = 20; // 4 (magic) + 2 * (4 (permitted) + 4 (inherited))
@@ -70,7 +72,7 @@ pub fn parse_capabilities(caps: Vec<u8>) -> String {
     }
 
     let magic_etc = u32::from_le_bytes(caps[0..4].try_into().unwrap());
-    let revision = magic_etc & !VFS_CAP_FLAGS_EFFECTIVE;
+    let revision = magic_etc & VFS_CAP_REVISION_MASK;
 
     let effective = if magic_etc & VFS_CAP_FLAGS_EFFECTIVE != 0 {
         String::from("e")
@@ -91,8 +93,8 @@ pub fn parse_capabilities(caps: Vec<u8>) -> String {
 
             check_caps_word_0!(permitted, inherited, effective, result);
         }
-        VFS_CAP_REVISION_2 => {
-            // v2 (20 bytes) and v3 (24 bytes with rootid) share the same revision
+        VFS_CAP_REVISION_2 | VFS_CAP_REVISION_3 => {
+            // v2 (20 bytes) and v3 (24 bytes with rootid) share the data layout
             if caps.len() < XATTR_CAPS_SZ_2 {
                 return String::new();
             }
@@ -148,6 +150,45 @@ pub fn has_capability(caps_string: &str, cap_name: &str) -> bool {
 mod tests {
     use super::*;
 
+    fn v2_blob(magic_flags: u32, permitted0: u32, inherited0: u32) -> Vec<u8> {
+        let mut blob = Vec::new();
+        blob.extend_from_slice(&(VFS_CAP_REVISION_2 | magic_flags).to_le_bytes());
+        blob.extend_from_slice(&permitted0.to_le_bytes());
+        blob.extend_from_slice(&inherited0.to_le_bytes());
+        blob.extend_from_slice(&0u32.to_le_bytes());
+        blob.extend_from_slice(&0u32.to_le_bytes());
+        blob
+    }
+
+    #[test]
+    fn test_parse_v2_blob_as_written_by_setcap() {
+        // `setcap cap_net_bind_service=ep` writes a v2 blob whose magic is
+        // 0x02000000 | effective flag; parsing must not come back empty.
+        let blob = v2_blob(VFS_CAP_FLAGS_EFFECTIVE, 1 << 10, 0);
+        assert_eq!(parse_capabilities(blob), "cap_net_bind_service=ep");
+    }
+
+    #[test]
+    fn test_parse_v3_blob_with_rootid() {
+        let mut blob = Vec::new();
+        blob.extend_from_slice(&(VFS_CAP_REVISION_3 | VFS_CAP_FLAGS_EFFECTIVE).to_le_bytes());
+        blob.extend_from_slice(&(1u32 << 10).to_le_bytes());
+        blob.extend_from_slice(&0u32.to_le_bytes());
+        blob.extend_from_slice(&0u32.to_le_bytes());
+        blob.extend_from_slice(&0u32.to_le_bytes());
+        blob.extend_from_slice(&1000u32.to_le_bytes());
+        assert_eq!(
+            parse_capabilities(blob),
+            "cap_net_bind_service=ep [rootid=1000]"
+        );
+    }
+
+    #[test]
+    fn test_parse_v2_blob_without_effective_flag() {
+        let blob = v2_blob(0, 1 << 21, 0);
+        assert_eq!(parse_capabilities(blob), "cap_sys_admin=p");
+    }
+
     #[test]
     fn test_has_capability_exact_match() {
         let caps = "cap_net_bind_service=ep cap_net_admin=ep";
```

---

### Incident Patch 4: `bffcfb22` (2026-07-05)
**Commit Message**: fix line count, unc paths, exif altitude

**File**: `src/field/context.rs` (modified, +6/-15)
```diff
@@ -17,7 +17,6 @@ use crate::util::duration::get_duration;
 pub struct FileMetadataState {
     pub(crate) file_metadata: Option<Option<Metadata>>,
     pub(crate) entry_file_type: Option<Option<FileType>>,
-    pub(crate) line_count: Option<Option<usize>>,
     pub(crate) content_stats: Option<Option<ContentStats>>,
     pub(crate) dimensions: Option<Option<Dimensions>>,
     pub(crate) duration: Option<Option<Duration>>,
@@ -35,7 +34,6 @@ impl FileMetadataState {
         FileMetadataState {
             file_metadata: None,
             entry_file_type: None,
-            line_count: None,
             content_stats: None,
             dimensions: None,
             duration: None,
@@ -96,19 +94,15 @@ impl FileMetadataState {
     }
 
     pub fn update_line_count(&mut self, entry: &DirEntry) {
-        if self.line_count.is_none() {
-            // A content-stats pass already streamed the whole file and counted
-            // newlines; reuse it instead of reading the file a second time.
-            if let Some(Some(stats)) = &self.content_stats {
-                self.line_count = Some(Some(stats.line_count));
-            } else {
-                self.line_count = Some(get_line_count(entry));
-            }
-        }
+        // Always derived from the content-stats pass: a raw newline-byte scan
+        // disagrees with the decoded text for UTF-16/32 files (0x0A occurs
+        // inside multibyte code units), which made the reported count depend
+        // on which content field happened to be evaluated first.
+        self.update_content_stats(entry);
     }
 
     pub fn get_line_count(&self) -> Option<usize> {
-        self.line_count.flatten()
+        self.get_content_stats().map(|stats| stats.line_count)
     }
 
     pub fn update_content_stats(&mut self, entry: &DirEntry) {
@@ -241,7 +235,6 @@ mod tests {
 
         assert!(state.file_metadata.is_none());
         assert!(state.entry_file_type.is_none());
-        assert!(state.line_count.is_none());
         assert!(state.content_stats.is_none());
         assert!(state.dimensions.is_none());
         assert!(state.duration.is_none());
@@ -260,7 +253,6 @@ mod tests {
 
         state.file_metadata = Some(None);
         state.entry_file_type = Some(None);
-        state.line_count = Some(None);
         state.content_stats = Some(None);
         state.dimensions = Some(None);
         state.duration = Some(None);
@@ -276,7 +268,6 @@ mod tests {
 
         assert!(state.file_metadata.is_none());
         assert!(state.entry_file_type.is_none());
-        assert!(state.line_count.is_none());
         assert!(state.content_stats.is_none());
         assert!(state.dimensions.is_none());
         assert!(state.duration.is_none());
```

**File**: `src/util/mod.rs` (modified, +12/-34)
```diff
@@ -39,7 +39,7 @@ use std::fs::DirEntry;
 use std::fs::File;
 use std::fs::Metadata;
 use std::io::Read;
-use std::io::{BufRead, BufReader};
+use std::io::BufReader;
 use std::path::Path;
 use std::path::PathBuf;
 use std::rc::Rc;
@@ -602,8 +602,14 @@ pub fn canonical_path(path_buf: &PathBuf) -> Result<String, String> {
 pub fn format_absolute_path(path_buf: &Path) -> String {
     let path = format!("{}", path_buf.to_string_lossy());
 
+    // canonicalize returns verbatim paths: `\\?\C:\...` for drives but
+    // `\\?\UNC\server\share\...` for network paths, which must map back to
+    // `\\server\share\...`, not to the invalid `UNC\server\share\...`.
     #[cfg(windows)]
-    let path = path.replace("\\\\?\\", "");
+    let path = match path.strip_prefix("\\\\?\\UNC\\") {
+        Some(rest) => format!("\\\\{}", rest),
+        None => path.replace("\\\\?\\", ""),
+    };
 
     path
 }
@@ -667,13 +673,13 @@ pub fn get_exif_metadata(entry: &DirEntry) -> Option<HashMap<String, String>> {
                     exif_info.insert(String::from("__Lat"), coord.to_string());
                 }
 
+            // Unparseable altitude data is omitted rather than masked as a
+            // valid-looking 0.0.
             if let (Some(altitude_str), Some(altitude_ref)) =
                 (exif_info.get("GPSAltitude").cloned(), exif_info.get("GPSAltitudeRef").cloned())
+                && let Ok(altitude) = altitude_str.parse::<f32>()
             {
-                let mut altitude = altitude_str.parse::<f32>().unwrap_or(0.0);
-                if altitude_ref.eq("1") {
-                    altitude = -altitude;
-                }
+                let altitude = if altitude_ref.eq("1") { -altitude } else { altitude };
                 exif_info.insert(String::from("__Alt"), altitude.to_string());
             }
 
@@ -740,34 +746,6 @@ pub fn is_hidden(file_name: &str, metadata: &Option<Metadata>, archive_mode: boo
     }
 }
 
-pub fn get_line_count(entry: &DirEntry) -> Option<usize> {
-    if let Ok(file) = File::open(entry.path()) {
-        let mut reader = BufReader::with_capacity(1024 * 32, file);
-        let mut count = 0;
-
-        loop {
-            let len = {
-                if let Ok(buf) = reader.fill_buf() {
-                    if buf.is_empty() {
-                        break;
-                    }
-
-                    count += bytecount::count(buf, b'\n');
-                    buf.len()
-                } else {
-                    return None;
-                }
-            };
-
-            reader.consume(len);
-        }
-
-        return Some(count);
-    }
-
-    None
-}
-
 #[derive(Clone, Debug, PartialEq, Eq)]
 pub struct ContentStats {
     pub is_text: bool,
```

---

### Incident Patch 5: `17ce46b6` (2026-07-05)
**Commit Message**: fix csv output of split utf-8

**File**: `src/output/csv.rs` (modified, +29/-7)
```diff
@@ -1,7 +1,6 @@
 //! Handles export of results in CSV format
 
 use crate::output::ResultsFormatter;
-use crate::util::WritableBuffer;
 
 #[derive(Default)]
 pub struct CsvFormatter {
@@ -23,13 +22,20 @@ impl ResultsFormatter for CsvFormatter {
     }
 
     fn row_ended(&mut self) -> Option<String> {
-        let mut csv_output = WritableBuffer::new();
-        {
-            let mut csv_writer = csv::Writer::from_writer(&mut csv_output);
-            let _ = csv_writer.write_record(&self.records);
-            self.records.clear();
+        // Write into a plain byte buffer: the csv writer flushes its internal
+        // 8KB buffer at arbitrary byte offsets, which a UTF-8-validating sink
+        // would reject mid-character, silently dropping the whole row.
+        let mut csv_writer = csv::Writer::from_writer(Vec::new());
+        let write_result = csv_writer.write_record(&self.records);
+        self.records.clear();
+        if write_result.is_err() {
+            return None;
+        }
+
+        match csv_writer.into_inner() {
+            Ok(bytes) => Some(String::from_utf8_lossy(&bytes).into_owned()),
+            Err(_) => None,
         }
-        Some(csv_output.into())
     }
 
     fn footer(&mut self) -> Option<String> {
@@ -47,4 +53,20 @@ mod test {
         let result = write_test_items(&mut CsvFormatter::default());
         assert_eq!("foo_value,BAR value\n123,\n", result);
     }
+
+    #[test]
+    fn multibyte_row_larger_than_internal_buffer_is_not_dropped() {
+        use crate::output::ResultsFormatter;
+
+        // A row larger than the csv writer's 8KB internal buffer used to be
+        // flushed at a non-character byte boundary and silently discarded.
+        let mut formatter = CsvFormatter::default();
+        let big_value = "é".repeat(6000); // 12000 bytes
+        formatter.format_element("col1", &big_value, false);
+        formatter.format_element("col2", "x", true);
+
+        let row = formatter.row_ended().expect("row must be produced");
+        assert!(row.contains(&big_value));
+        assert!(row.ends_with("x\n"));
+    }
 }
```

**File**: `src/util/wbuf.rs` (modified, +64/-5)
```diff
@@ -4,29 +4,62 @@ use std::io::Write;
 #[derive(Debug)]
 pub struct WritableBuffer {
     buf: String,
+    // Incomplete UTF-8 tail carried between writes: buffered writers (e.g.
+    // csv::Writer) flush at arbitrary byte offsets, so a chunk may end in the
+    // middle of a multibyte sequence that the next chunk completes.
+    pending: Vec<u8>,
 }
 
 impl WritableBuffer {
     pub fn new() -> WritableBuffer {
-        WritableBuffer { buf: String::new() }
+        WritableBuffer {
+            buf: String::new(),
+            pending: Vec::new(),
+        }
     }
 }
 
 impl From<WritableBuffer> for String {
-    fn from(wb: WritableBuffer) -> Self {
+    fn from(mut wb: WritableBuffer) -> Self {
+        if !wb.pending.is_empty() {
+            // A truncated final sequence: surface it as replacement chars
+            // rather than silently dropping bytes.
+            wb.buf.push_str(&String::from_utf8_lossy(&wb.pending));
+        }
         wb.buf
     }
 }
 
 impl Write for WritableBuffer {
     fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
-        match std::str::from_utf8(buf) {
+        let mut owned: Vec<u8>;
+        let bytes: &[u8] = if self.pending.is_empty() {
+            buf
+        } else {
+            owned = std::mem::take(&mut self.pending);
+            owned.extend_from_slice(buf);
+            &owned
+        };
+
+        match std::str::from_utf8(bytes) {
             Ok(s) => {
                 self.buf.push_str(s);
-                Ok(buf.len())
             }
-            Err(_) => Err(io::ErrorKind::InvalidInput.into()),
+            Err(err) => {
+                if err.error_len().is_some() {
+                    // Genuinely invalid bytes, not a sequence split by
+                    // chunking.
+                    return Err(io::ErrorKind::InvalidInput.into());
+                }
+                let valid_up_to = err.valid_up_to();
+                let valid = std::str::from_utf8(&bytes[..valid_up_to])
+                    .expect("prefix up to valid_up_to is valid UTF-8");
+                self.buf.push_str(valid);
+                self.pending = bytes[valid_up_to..].to_vec();
+            }
         }
+
+        Ok(buf.len())
     }
 
     fn flush(&mut self) -> io::Result<()> {
@@ -60,4 +93,30 @@ mod tests {
         let err = wb.write(&[0xff, 0xfe, 0xfd]).unwrap_err();
         assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
     }
+
+    #[test]
+    fn accepts_multibyte_sequence_split_across_writes() {
+        // "é" is [0xC3, 0xA9]; a buffered writer may split it anywhere.
+        let mut wb = WritableBuffer::new();
+        assert_eq!(wb.write(&[b'a', 0xC3]).unwrap(), 2);
+        assert_eq!(wb.write(&[0xA9, b'b']).unwrap(), 2);
+        assert_eq!(String::from(wb), "aéb");
+    }
+
+    #[test]
+    fn accepts_four_byte_sequence_split_byte_by_byte() {
+        let mut wb = WritableBuffer::new();
+        for &b in "🌍".as_bytes() {
+            assert_eq!(wb.write(&[b]).unwrap(), 1);
+        }
+        assert_eq!(String::from(wb), "🌍");
+    }
+
+    #[test]
+    fn rejects_invalid_continuation_after_split() {
+        let mut wb = WritableBuffer::new();
+        assert_eq!(wb.write(&[0xC3]).unwrap(), 1);
+        let err = wb.write(&[b'x']).unwrap_err();
+        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
+    }
 }
```

---

### Incident Patch 6: `9a59d602` (2026-07-05)
**Commit Message**: fix subquery caching, trim, sym gates

**File**: `src/searcher.rs` (modified, +52/-14)
```diff
@@ -104,17 +104,29 @@ fn is_subquery_cacheable(query: &Query) -> bool {
         .iter()
         .filter_map(|r| r.options.alias.clone())
         .collect();
-    !expr_references_external_alias(&query.expr, &own_aliases)
-        && query.fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
-        && query.ordering_fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
-        && query.grouping_fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
+    !query_walk_external_alias(query, &own_aliases)
 }
 
-fn expr_references_external_alias(expr: &Option<Expr>, own: &HashSet<String>) -> bool {
-    match expr {
-        Some(e) => expr_walk_external_alias(e, own),
-        None => false,
-    }
+/// Walk every clause of a query — WHERE, SELECT list, ORDER BY, GROUP BY, and
+/// FROM-subselects — looking for a root_alias not declared by the query (or an
+/// enclosing level). Any hit means the query depends on outer-row state.
+fn query_walk_external_alias(query: &Query, own: &HashSet<String>) -> bool {
+    if let Some(ref expr) = query.expr
+        && expr_walk_external_alias(expr, own) { return true; }
+    if query.fields.iter().any(|e| expr_walk_external_alias(e, own)) { return true; }
+    if query.ordering_fields.iter().any(|e| expr_walk_external_alias(e, own)) { return true; }
+    if query.grouping_fields.iter().any(|e| expr_walk_external_alias(e, own)) { return true; }
+    query.roots.iter().any(|root| {
+        root.subquery.as_ref().is_some_and(|sub| {
+            let nested_own: HashSet<String> = sub
+                .roots
+                .iter()
+                .filter_map(|r| r.options.alias.clone())
+                .chain(own.iter().cloned())
+                .collect();
+            query_walk_external_alias(sub, &nested_own)
+        })
+    })
 }
 
 fn expr_walk_external_alias(expr: &Expr, own: &HashSet<String>) -> bool {
@@ -128,17 +140,18 @@ fn expr_walk_external_alias(expr: &Expr, own: &HashSet<String>) -> bool {
         && expr_walk_external_alias(right, own) { return true; }
     if let Some(ref args) = expr.args
         && args.iter().any(|a| expr_walk_external_alias(a, own)) { return true; }
-    // Nested subqueries: descend so a doubly-nested correlated reference is
-    // also detected.
+    // Nested subqueries: descend through every clause so a doubly-nested
+    // correlated reference (including one via a FROM-subselect) is detected.
     if let Some(ref sub) = expr.subquery {
         let nested_own: HashSet<String> = sub
             .roots
             .iter()
             .filter_map(|r| r.options.alias.clone())
             .chain(own.iter().cloned())
             .collect();
-        if let Some(ref sub_expr) = sub.expr
-            && expr_walk_external_alias(sub_expr, &nested_own) { return true; }
+        if query_walk_external_alias(sub, &nested_own) {
+            return true;
+        }
     }
     false
 }
@@ -443,13 +456,17 @@ impl<'a> Searcher<'a> {
                 search_upstream_dockerignore(&mut self.dockerignore_filters, &self.current_root_dir);
             }
 
+            // The external indexes only know physical descendants of the root,
+            // so a root declared with `sym` (follow symlinks) must fall back
+            // to real traversal or symlinked subtrees would be silently missed.
             #[cfg(all(windows, feature = "everything"))]
             {
                 if self.config.everything.unwrap_or(false)
                     && !self.current_search_archives
                     && !self.current_apply_gitignore
                     && !self.current_apply_hgignore
                     && !self.current_apply_dockerignore
+                    && !self.current_follow_symlinks
                     && self.try_visit_with_everything(&self.current_root_dir.clone())?
                 {
                     continue;
@@ -463,6 +480,7 @@ impl<'a> Searcher<'a> {
                     && !self.current_apply_gitigno
```

---

### Incident Patch 7: `6805b875` (2026-07-05)
**Commit Message**: fix multiple issues

**File**: `src/expr.rs` (modified, +37/-2)
```diff
@@ -583,7 +583,7 @@ impl Display for Expr {
                 fmt.write_char(')')?;
             }
         } else if let Some(ref left) = self.left {
-            fmt.write_str(&left.to_string())?;
+            write_operand(fmt, left)?;
         }
 
         if let Some(ref op) = self.arithmetic_op {
@@ -615,13 +615,35 @@ impl Display for Expr {
         }
 
         if let Some(ref right) = self.right {
-            fmt.write_str(&right.to_string())?;
+            write_operand(fmt, right)?;
         }
 
         Ok(())
     }
 }
 
+/// Write a child operand, parenthesized when it is itself a composite
+/// expression. Without this, `(1 + 2) * 3` and `1 + (2 * 3)` render to the
+/// same string, and the rendered form is used as the per-file evaluation
+/// cache key — colliding columns would silently reuse each other's values.
+fn write_operand(fmt: &mut Formatter, operand: &Expr) -> fmt::Result {
+    use std::fmt::Write;
+
+    let composite = operand.arithmetic_op.is_some()
+        || operand.logical_op.is_some()
+        || operand.op.is_some();
+
+    if composite {
+        fmt.write_char('(')?;
+    }
+    Display::fmt(operand, fmt)?;
+    if composite {
+        fmt.write_char(')')?;
+    }
+
+    Ok(())
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -630,6 +652,19 @@ mod tests {
     use crate::lexer::Lexer;
     use crate::parser::Parser;
 
+    #[test]
+    fn display_distinguishes_operand_grouping() {
+        // The rendered form is the per-file evaluation cache key: without
+        // parentheses, (1+2)*3 and 1+(2*3) collide and reuse each other's
+        // cached values.
+        let query = "select (1+2)*3, 1+(2*3) from /test";
+        let mut lexer = Lexer::new(vec![query.to_string()]);
+        let mut parser = Parser::new(&mut lexer);
+        let query = parser.parse(false).unwrap();
+
+        assert_ne!(query.fields[0].to_string(), query.fields[1].to_string());
+    }
+
     #[test]
     fn test_weight() {
         let expr = Expr::field(Field::Name);
```

**File**: `src/lexer.rs` (modified, +11/-1)
```diff
@@ -62,6 +62,7 @@ struct LexerState {
     in_order_by: bool,
     in_value_set: bool,
     roots_finished: bool,
+    paren_depth: u32,
 }
 
 impl LexerState {
@@ -80,6 +81,7 @@ impl LexerState {
             in_order_by: false,
             in_value_set: false,
             roots_finished: false,
+            paren_depth: 0,
         }
     }
 
@@ -335,9 +337,17 @@ impl Lexer {
         self.state.in_value_set = matches!(lexeme, Some(Lexeme::CurlyOpen))
                 || (matches!(lexeme, Some(Lexeme::Open)) && self.state.after_operator);
         self.state.after_operator = matches!(lexeme, Some(Lexeme::Operator(_)));
+        // A comma in the SELECT list suppresses keywords only inside parens
+        // (function args like `upper(foo, from)`); at depth 0 the next `from`
+        // must still be the FROM keyword, or a trailing comma would swallow it.
         self.state.after_logical = matches!(lexeme, Some(Lexeme::Where) | Some(Lexeme::And) | Some(Lexeme::Or) | Some(Lexeme::Open) | Some(Lexeme::CurlyOpen))
                 || (matches!(lexeme, Some(Lexeme::Comma)) && self.state.after_where)
-                || (matches!(lexeme, Some(Lexeme::Comma)) && self.state.before_from);
+                || (matches!(lexeme, Some(Lexeme::Comma)) && self.state.before_from && self.state.paren_depth > 0);
+        self.state.paren_depth = match lexeme {
+            Some(Lexeme::Open) | Some(Lexeme::CurlyOpen) => self.state.paren_depth + 1,
+            Some(Lexeme::Close) | Some(Lexeme::CurlyClose) => self.state.paren_depth.saturating_sub(1),
+            _ => self.state.paren_depth,
+        };
         self.state.after_value_start = matches!(lexeme, Some(Lexeme::Comma)) && self.state.after_where;
         self.state.after_not = matches!(lexeme, Some(Lexeme::Not));
         self.state.after_arithmetic = matches!(lexeme, Some(Lexeme::ArithmeticOperator(_)));
```

**File**: `src/parser.rs` (modified, +153/-22)
```diff
@@ -1023,12 +1023,9 @@ impl <'a> Parser<'a> {
                 Err(msg.clone())
             }
             Some(Lexeme::String(ref s)) => {
-                if let Ok((field, root_alias)) = Field::parse_field(s) {
-                    let mut expr = Expr::field_with_root_alias(field, root_alias);
-                    expr.minus = minus;
-                    return Ok(Some(expr));
-                }
-
+                // Quoted strings are always literals, never column references:
+                // `where name = 'size'` must compare against the string "size",
+                // not against the size field.
                 let mut expr = Expr::value(s.to_string());
                 expr.minus = minus;
 
@@ -1108,6 +1105,25 @@ impl <'a> Parser<'a> {
         }
     }
 
+    /// Resolve a bare ORDER BY / GROUP BY identifier against SELECT-list
+    /// aliases: `select size + 1 as s ... order by s` must use the aliased
+    /// expression, not a constant string "s" (which would silently not sort).
+    fn resolve_select_alias(&mut self, fields: &[Expr], name: &str) -> Option<Expr> {
+        let aliased = fields
+            .iter()
+            .find(|f| f.alias.as_deref().is_some_and(|a| a.eq_ignore_ascii_case(name)))?;
+
+        // Only a bare alias is substituted; if the identifier is part of a
+        // larger expression, leave it to the regular expression parser.
+        let next = self.next_lexeme();
+        self.drop_lexeme();
+        if matches!(next, Some(Lexeme::ArithmeticOperator(_))) {
+            return None;
+        }
+
+        Some(aliased.clone())
+    }
+
     fn parse_group_by(&mut self, fields: &[Expr]) -> Result<Vec<Expr>, String> {
         let mut group_by_fields: Vec<Expr> = vec![];
 
@@ -1120,18 +1136,36 @@ impl <'a> Parser<'a> {
                             let actual_field = match grouping_field.parse::<usize>() {
                                 Ok(idx) if idx >= 1 && idx <= fields.len() => fields[idx - 1].clone(),
                                 Ok(_) => return Err(String::from("Group by field index is out of range")),
-                                _ => {
-                                    self.drop_lexeme();
-                                    match self.parse_expr()? {
-                                        Some(expr) => expr,
-                                        None => break,
+                                _ => match self.resolve_select_alias(fields, grouping_field) {
+                                    Some(expr) => expr,
+                                    None => {
+                                        self.drop_lexeme();
+                                        match self.parse_expr()? {
+                                            Some(expr) => expr,
+                                            None => break,
+                                        }
                                     }
-                                }
+                                },
                             };
                             group_by_fields.push(actual_field);
                         }
-                        Some(Lexeme::String(_))
-                        | Some(Lexeme::Open) | Some(Lexeme::CurlyOpen) => {
+                        Some(Lexeme::String(ref grouping_field)) => {
+                            // Grouping by a string literal is meaningless, so a
+                            // quoted string here keeps its historical meaning
+                            // as a field name (or a SELECT-list alias).
+                            if let Ok((field, root_alias)) = Field::parse_field(grouping_field) {
+                                group_by_fields.push(Expr::field_with_root_alias(field, root_alias));
+                            } else if let Some(expr) = self.resolve_select_alias(fields, grouping_field) {
+                                group_by_fields.push(expr);
+                            } else {
+                                self.drop_lexeme();
+ 
```

**File**: `src/searcher.rs` (modified, +65/-3)
```diff
@@ -627,7 +627,9 @@ impl<'a> Searcher<'a> {
                     rendered.clone(),
                 );
 
-                if !self.silent_mode {
+                // An ungrouped aggregate produces a single row; any OFFSET
+                // skips past it (the buffered row is offset-skipped by readers).
+                if !self.silent_mode && self.query.offset == 0 {
                     try_output!(write!(std::io::stdout(), "{}", rendered), Ok(()));
                 }
             }
@@ -737,13 +739,18 @@ impl<'a> Searcher<'a> {
             self.default_config,
             self.use_colors
         );
-        sub_searcher.silent_mode = !self.config.debug;
+        // Always run silent: is_buffered() must hold so results land in
+        // output_buffer instead of leaking to stdout (debug mode included).
+        sub_searcher.silent_mode = true;
         if let Err(err) = sub_searcher.list_search_results() {
             err.print();
             return vec![];
         }
 
+        // The buffer holds limit + offset rows; the offset rows are skipped
+        // only in the print path, so they must be skipped here as well.
         let result_values = sub_searcher.output_buffer.iter_values()
+            .skip(query.offset as usize)
             .map(|s| s.trim_end().to_string())
             .collect::<Vec<String>>();
 
@@ -2799,6 +2806,14 @@ mod tests {
     /// a temp directory. Returns the rendered rows the outer query produced so
     /// we can assert against them as a flat set of strings.
     fn run_query_against_dir(query_template: &str, dir: &Path) -> Vec<String> {
+        run_query_against_dir_with_config(query_template, dir, Config::default())
+    }
+
+    fn run_query_against_dir_with_config(
+        query_template: &str,
+        dir: &Path,
+        config: Config,
+    ) -> Vec<String> {
         use crate::lexer::Lexer;
         use crate::parser::Parser;
 
@@ -2807,7 +2822,7 @@ mod tests {
         let mut parser = Parser::new(&mut lexer);
         let parsed = parser.parse(false).expect("parse failed");
         let parsed = Box::leak(Box::new(parsed));
-        let config = Box::leak(Box::new(Config::default()));
+        let config = Box::leak(Box::new(config));
         let default_config = Box::leak(Box::new(Config::default()));
 
         let mut searcher = Searcher::new(parsed, config, default_config, false);
@@ -2842,6 +2857,53 @@ mod tests {
         assert!(names.contains("two.txt"));
     }
 
+    #[test]
+    fn subquery_in_list_applies_offset() {
+        // The subquery buffer holds limit + offset rows; the offset rows must
+        // be skipped when handing values to the outer query, or `limit 1
+        // offset 1` would feed two values into the IN list.
+        let tmp = std::env::temp_dir().join("fselect_test_subquery_offset");
+        let _ = fs::remove_dir_all(&tmp);
+        fs::create_dir_all(&tmp).unwrap();
+        fs::write(tmp.join("small.txt"), "1").unwrap();
+        fs::write(tmp.join("medium.txt"), "22").unwrap();
+        fs::write(tmp.join("large.txt"), "333").unwrap();
+
+        let rows = run_query_against_dir(
+            "select name from __DIR__ depth 1 where name in (select name from __DIR__ depth 1 order by size desc limit 1 offset 1)",
+            &tmp,
+        );
+
+        let _ = fs::remove_dir_all(&tmp);
+        assert_eq!(rows, vec![String::from("medium.txt")]);
+    }
+
+    #[test]
+    fn subquery_results_are_buffered_with_debug_config() {
+        // Subqueries must run silent regardless of config.debug: with debug on
+        // they used to print their rows instead of buffering them, so EXISTS
+        // inverted and IN/scalar subqueries came back empty.
+        let tmp = std::env::temp_dir().join("fselect_test_subquery_debug_config");
+        let _ = fs::remove_dir_all(&tmp);
+        fs::create_dir_all(&tmp).unwrap();
+        fs::write(tmp.join("one.txt"), "x").unwrap();
+        fs::write(tmp.join("two.txt"), "y").unwrap();
+
+        le
```

---

### Incident Patch 8: `218a6efc` (2026-07-02)
**Commit Message**: fix year parsing in audio tags

**File**: `src/util/audio.rs` (modified, +21/-10)
```diff
@@ -50,17 +50,16 @@ pub fn is_audio_ext(ext_lowercase: &str) -> bool {
     )
 }
 
+/// Extract a year from a tag value: either a leading 4-digit year (possibly
+/// followed by the rest of a date, e.g. `2023-05-01`) or a value that is
+/// nothing but a shorter year (e.g. `800`). Longer digit runs are not years.
 fn parse_year(value: &str) -> Option<u32> {
-    let digits: String = value
-        .trim_start()
-        .chars()
-        .take_while(|c| c.is_ascii_digit())
-        .take(4)
-        .collect();
-    if digits.len() == 4 {
-        digits.parse().ok()
-    } else {
-        None
+    let value = value.trim();
+    let digit_count = value.chars().take_while(|c| c.is_ascii_digit()).count();
+    match digit_count {
+        4 => value[..4].parse().ok(),
+        1..=3 if digit_count == value.len() => value.parse().ok(),
+        _ => None,
     }
 }
 
@@ -134,6 +133,18 @@ mod tests {
         assert!(!is_audio_ext("txt"));
     }
 
+    #[test]
+    fn test_parse_year() {
+        assert_eq!(parse_year("2023"), Some(2023));
+        assert_eq!(parse_year("2023-05-01"), Some(2023));
+        assert_eq!(parse_year(" 2023 "), Some(2023));
+        assert_eq!(parse_year("800"), Some(800));
+        assert_eq!(parse_year("20231"), None);
+        assert_eq!(parse_year("05/01/2023"), None);
+        assert_eq!(parse_year("unknown"), None);
+        assert_eq!(parse_year(""), None);
+    }
+
     #[test]
     fn test_format_numbered() {
         assert_eq!(format_numbered(Some(4), Some(9)), Some(String::from("4/9")));
```

---

### Incident Patch 9: `8402461e` (2026-07-02)
**Commit Message**: fix relative day syntax for 4+ digit values

**File**: `src/util/datetime.rs` (modified, +13/-12)
```diff
@@ -102,7 +102,19 @@ pub fn parse_datetime(s: &str) -> Result<(NaiveDateTime, NaiveDateTime), String>
             }
         }
         None => {
-            if s.len() >= 5 {
+            // Simplified relative-day syntax: any length of `+N`/`-N` counts
+            // as days from today; longer non-numeric strings fall through to
+            // the natural-language parser.
+            if s.len() >= 2
+                && (s.starts_with("+") || s.starts_with("-"))
+                && let Ok(days) = s.parse::<i64>()
+            {
+                let date = Local::now().date_naive() + Duration::days(days);
+                let start = date.and_hms_opt(0, 0, 0).unwrap();
+                let finish = date.and_hms_opt(23, 59, 59).unwrap();
+
+                Ok((start, finish))
+            } else if s.len() >= 5 {
                 let dialect = match *US_DATES.lock().unwrap() {
                     true => Dialect::Us,
                     false => Dialect::Uk,
@@ -129,17 +141,6 @@ pub fn parse_datetime(s: &str) -> Result<(NaiveDateTime, NaiveDateTime), String>
                     }
                     _ => Err("Error parsing date/time value: ".to_string() + s),
                 }
-            } else if s.len() >= 2 && (s.starts_with("+") || s.starts_with("-")) {
-                match s.parse::<i64>() {
-                    Ok(days) => {
-                        let date = Local::now().date_naive() + Duration::days(days);
-                        let start = date.and_hms_opt(0, 0, 0).unwrap();
-                        let finish = date.and_hms_opt(23, 59, 59).unwrap();
-
-                        Ok((start, finish))
-                    }
-                    Err(_) => Err("Error parsing date/time value: ".to_string() + s),
-                }
             } else {
                 Err("Error parsing date/time value: ".to_string() + s)
             }
```

---

### Incident Patch 10: `ef6a73e0` (2026-07-02)
**Commit Message**: fix hgignore glob conversion

**File**: `src/ignore/hg.rs` (modified, +62/-1)
```diff
@@ -155,7 +155,7 @@ fn convert_hgignore_pattern(
 }
 
 static HG_CONVERT_REPLACE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
-    Regex::new("(\\*\\*|\\?|\\.|\\[|\\]|\\(|\\)|\\^|\\$|\\*)").unwrap()
+    Regex::new("(\\*\\*|\\?|\\.|\\[|\\]|\\(|\\)|\\^|\\$|\\*|\\+|\\{|\\}|\\||\\\\|/)").unwrap()
 });
 
 fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String> {
@@ -174,6 +174,12 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
                     ")" => "\\)",
                     "^" => "\\^",
                     "$" => "\\$",
+                    "+" => "\\+",
+                    "{" => "\\{",
+                    "}" => "\\}",
+                    "|" => "\\|",
+                    "\\" => "\\\\",
+                    "/" => "/",
                     _ => "",
                 }
                 .to_string()
@@ -184,6 +190,10 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
             return Err("Error parsing .hgignore pattern: ".to_string() + glob);
         }
 
+        // `**/` matches any number of leading directories, including none
+        // (the `.*` token can only originate from `**`).
+        pattern = pattern.replace(".*/", "(?:.*/)?");
+
         // Glob patterns are unrooted (they match at any directory level), but
         // must cover whole path components: like Mercurial itself, a match
         // ends at a separator or the end of the path, so `foo` matches `foo`
@@ -212,6 +222,14 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
                     ")" => "\\)",
                     "^" => "\\^",
                     "$" => "\\$",
+                    "+" => "\\+",
+                    "{" => "\\{",
+                    "}" => "\\}",
+                    "|" => "\\|",
+                    "\\" => "\\\\",
+                    // Mercurial patterns always use forward slashes; paths
+                    // are matched with native separators on Windows.
+                    "/" => "\\\\",
                     _ => "",
                 }
                 .to_string()
@@ -222,6 +240,10 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
             return Err("Error parsing .hgignore pattern: ".to_string() + glob);
         }
 
+        // `**/` matches any number of leading directories, including none
+        // (the `.*` token can only originate from `**`).
+        pattern = pattern.replace(".*\\\\", "(?:.*\\\\)?");
+
         // See the Unix branch: unrooted, but matches whole path components.
         pattern = String::from("^")
             .add(&regex::escape(&file_path.to_string_lossy()))
@@ -373,6 +395,45 @@ mod tests {
         );
     }
 
+    #[cfg(not(windows))]
+    #[test]
+    fn glob_plus_and_pipe_are_escaped() {
+        let regex = convert_hgignore_glob("c++", Path::new("/repo")).unwrap();
+        assert!(regex.is_match("/repo/c++"), "+ should be literal");
+        assert!(!regex.is_match("/repo/ccc"), "+ should not repeat");
+
+        let regex = convert_hgignore_glob("a|b*", Path::new("/repo")).unwrap();
+        assert!(regex.is_match("/repo/a|bc"), "| should be literal");
+        assert!(!regex.is_match("/repo/ab.txt"), "| should not alternate");
+    }
+
+    #[cfg(not(windows))]
+    #[test]
+    fn glob_double_star_slash_matches_zero_dirs() {
+        let regex = convert_hgignore_glob("**/foo", Path::new("/repo")).unwrap();
+        assert!(regex.is_match("/repo/foo"), "**/ should match zero dirs");
+        assert!(regex.is_match("/repo/a/b/foo"), "**/ should match many dirs");
+    }
+
+    #[cfg(windows)]
+    #[test]
+    fn glob_plus_and_pipe_are_escaped_windows() {
+        let regex = convert_hgignore_glob("c++", Path::new("C:\\repo")).unwrap();
+        assert!(regex.is_match("C:\\repo\\c++"), "+ should be literal");
+        assert!(!regex.is_match("C:\\repo\\ccc"), "+ should not repeat");
+
+        let regex = c
```

#### Recent Merged Pull Requests:
- **PR #185** (2026-06-10): fix mobile input (@jhspetersson)
- **PR #167** (2025-01-13): Make license metadata SPDX compliant (@paolobarbolini)
- **PR #149** (2024-05-12): Code formatting and documentation (@Matthieu-LAURENT39)
- **PR #147** (2024-02-25): replace usage of users with uzers (@QaidVoid)
- **PR #144** (2023-11-27): Add 'duration' test cases (@4censord)
- **PR #143** (2023-11-27): Add format_time function (@4censord)
- **PR #141** (2023-11-27): Make duration consistent across file types (@4censord)
- **PR #140** (2023-11-27): Add mkv duration extractor (@4censord)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
