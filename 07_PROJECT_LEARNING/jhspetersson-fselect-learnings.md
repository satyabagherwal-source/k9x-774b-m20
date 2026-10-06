# Forensic Learning Record (Deep Inspection): jhspetersson/fselect

> **Canonical Artifact**: `07_PROJECT_LEARNING/jhspetersson-fselect-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jhspetersson/fselect](https://github.com/jhspetersson/fselect))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:47:26.434Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jhspetersson/fselect`
- **Description**: Find files with SQL-like queries
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4469 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util/acl.rs`
```
/// POSIX ACL parsing from extended attributes.
///
/// Parses the binary format stored in `system.posix_acl_access` and
/// `system.posix_acl_default` extended attributes on Linux.
///
/// Binary format (POSIX ACL version 2):
/// - Header: 4 bytes (version u32 LE = 0x0002)
/// - Each entry: 8 bytes
///   - tag:  u16 LE
///   - perm: u16 LE
///   - id:   u32 LE (uid or gid, 0xFFFFFFFF for owner/group/mask/other)

const ACL_VERSION: u32 = 0x0002;
const ACL_ENTRY_SIZE: usize = 8;
const ACL_HEADER_SIZE: usize = 4;

const ACL_TAG_USER_OBJ: u16 = 0x0001;
const ACL_TAG_USER: u16 = 0x0002;
const ACL_TAG_GROUP_OBJ: u16 = 0x0004;
const ACL_TAG_GROUP: u16 = 0x0008;
const ACL_TAG_MASK: u16 = 0x0010;
const ACL_TAG_OTHER: u16 = 0x0020;

const ACL_PERM_READ: u16 = 0x04;
const ACL_PERM_WRITE: u16 = 0x02;
const ACL_PERM_EXEC: u16 = 0x01;

#[cfg(test)]
const ACL_UNDEFINED_ID: u32 = 0xFFFFFFFF;

#[derive(Debug, Clone, PartialEq)]
pub enum AclTag {
    UserObj,
    User(u32),
    GroupObj,
    Group(u32),
    Mask,
    Other,
}

#[derive(Debug, Clone)]
pub struct AclEntry {
    pub tag: AclTag,
    pub permissions: u16,
}

fn format_permissions(perm: u16) -> String {
    let r = if perm & ACL_PERM_READ != 0 { 'r' } else { '-' };
    let w = if perm & ACL_PERM_WRITE != 0 { 'w' } else { '-' };
    let x = if perm & ACL_PERM_EXEC != 0 { 'x' } else { '-' };
    format!("{}{}{}", r, w, x)
}

fn resolve_uid(uid: u32) -> String {
    #[cfg(all(unix, feature = "users"))]
    {
        use uzers::Users;
        let cache = uzers::UsersCache::new();
        if let Some(user) = cache.get_user_by_uid(uid) {
            return user.name().to_string_lossy().to_string();
        }
    }
    #[allow(unreachable_code)]
    uid.to_string()
}

fn resolve_gid(gid: u32) -> String {
    #[cfg(all(unix, feature = "users"))]
    {
        use uzers::Groups;
        let cache = uzers::UsersCache::new();
        if let Some(group) = cache.get_group_by_gid(gid) {
            return group.name().to_string_lossy().to_string();
        }
    }
    #[allow(unreachable_code)]
    gid.to_string()
}

pub fn parse_acl(data: &[u8]) -> Option<Vec<AclEntry>> {
    if data.len() < ACL_HEADER_SIZE {
        return None;
    }

    let version = u32::from_le_bytes(data[0..4].try_into().ok()?);
    if version != ACL_VERSION {
        return None;
    }

    let body = &data[ACL_HEADER_SIZE..];
    if body.len() % ACL_ENTRY_SIZE != 0 {
        return None;
    }

    let mut entries = Vec::new();

    for chunk in body.chunks_exact(ACL_ENTRY_SIZE) {
        let tag_raw = u16::from_le_bytes(chunk[0..2].try_into().ok()?);
        let perm = u16::from_le_bytes(chunk[2..4].try_into().ok()?);
        let id = u32::from_le_bytes(chunk[4..8].try_into().ok()?);

        let tag = match tag_raw {
            ACL_TAG_USER_OBJ => AclTag::UserObj,
            ACL_TAG_USER => AclTag::User(id),
            ACL_TAG_GROUP_OBJ => AclTag::GroupObj,
            ACL_TAG_GROUP => AclTag::Group(id),
            ACL_TAG_MASK => AclTag::Mask,
            ACL_TAG_OTHER => AclTag::Other,
            _ => continue,
        };

        entries.push(AclEntry { tag, permissions: perm });
    }

    Some(entries)
}

#[cfg(test)]
pub fn has_extended_acl(entries: &[AclEntry]) -> bool {
    entries.iter().any(|e| matches!(e.tag, AclTag::User(_) | AclTag::Group(_) | AclTag::Mask))
}

pub fn format_entry(entry: &AclEntry) -> String {
    let perms = format_permissions(entry.permissions);
    match &entry.tag {
        AclTag::UserObj => format!("user::{}", perms),
        AclTag::User(uid) => format!("user:{}:{}", resolve_uid(*uid), perms),
        AclTag::GroupObj => format!("group::{}", perms),
        AclTag::Group(gid) => format!("group:{}:{}", resolve_gid(*gid), perms),
        AclTag::Mask => format!("mask::{}", perms),
        AclTag::Other => format!("other::{}", perms),
    }
}

pub fn format_acl(entries: &[AclEntry]) -> String {
    entries.iter().map(format_entry).collect::<Vec<_>>().join(",")
}

pub fn find_entry<'a>(entries: &'a [AclEntry], spec: &str) -> Option<&'a AclEntry> {
    let parts: Vec<&str> = spec.splitn(2, ':').collect();
    let tag_type = parts[0];
    let qualifier = if parts.len() > 1 { parts[1] } else { "" };

    match tag_type {
        "user" | "u" => {
            if qualifier.is_empty() {
                entries.iter().find(|e| e.tag == AclTag::UserObj)
            } else {
                entries.iter().find(|e| match &e.tag {
                    AclTag::User(uid) => {
                        resolve_uid(*uid) == qualifier
                            || uid.to_string() == qualifier
                    }
                    _ => false,
                })
            }
        }
        "group" | "g" => {
            if qualifier.is_empty() {
                entries.iter().find(|e| e.tag == AclTag::GroupObj)
            } else {
                entries.iter().find(|e| match &e.tag {
                    AclTag::Group(gid) => {
                        resolve_gid(*gid) == qualifier
                            || gid.to_string() == qualifier
                    }
                    _ => false,
                })
            }
        }
        "mask" | "m" => entries.iter().find(|e| e.tag == AclTag::Mask),
        "other" | "o" => entries.iter().find(|e| e.tag == AclTag::Other),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_acl_data(entries: &[(u16, u16, u32)]) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&ACL_VERSION.to_le_bytes());
        for &(tag, perm, id) in entries {
            data.extend_from_slice(&tag.to_le_bytes());
            data.extend_from_slice(&perm.to_le_bytes());
            data.extend_from_slice(&id.to_le_bytes());
        }
        data
    }

    #[test]
    fn test_parse_basic_acl() {
        let data = make_acl_data(&[
            (ACL_TAG_USER_OBJ, 0x07, ACL_UNDEFINED_ID),
            (ACL_TAG_GROUP_OBJ, 0x05, ACL_UNDEFINED_ID),
            (ACL_TAG_OTHER, 0x04, ACL_UNDEFINED_ID),
        ]);
        let entries = parse_acl(&data).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].tag, AclTag::UserObj);
        assert_eq!(entries[0].permissions, 0x07);
    }

    #[test]
    fn test_parse_extended_acl() {
        let data = make_acl_data(&[
            (ACL_TAG_USER_OBJ, 0x07, ACL_UNDEFINED_ID),
            (ACL_TAG_USER, 0x06, 1000),
            (ACL_TAG_GROUP_OBJ, 0x05, ACL_UNDEFINED_ID),
            (ACL_TAG_GROUP, 0x04, 100),
            (ACL_TAG_MASK, 0x07, ACL_UNDEFINED_ID),
            (ACL_TAG_OTHER, 0x04, ACL_UNDEFINED_ID),
        ]);
        let entries = parse_acl(&data).unwrap();
        assert_eq!(entries.len(), 6);
        assert!(has_extended_acl(&entries));
    }

    #[test]
    fn test_no_extended_acl() {
        let data = make_acl_data(&[
            (ACL_TAG_USER_OBJ, 0x07, ACL_UNDEFINED_ID),
            (ACL_TAG_GROUP_OBJ, 0x05, ACL_UNDEFINED_ID),
            (ACL_TAG_OTHER, 0x04, ACL_UNDEFINED_ID),
        ]);
        let entries = parse_acl(&data).unwrap();
        assert!(!has_extended_acl(&entries));
    }

    #[test]
    fn test_format_permissions() {
        assert_eq!(format_permissions(0x07), "rwx");
        assert_eq!(format_permissions(0x06), "rw-");
        assert_eq!(format_permissions(0x05), "r-x");
        assert_eq!(format_permissions(0x04), "r--");
        assert_eq!(format_permissions(0x00), "---");
        assert_eq!(format_permissions(0x01), "--x");
        assert_eq!(format_permissions(0x02), "-w-");
        assert_eq!(format_permissions(0x03), "-wx");
    }

    #[test]
    fn test_format_entry_owner() {
        let entry = AclEntry { tag: AclTag::UserObj, permissions: 0x07 };
        assert_eq!(format_entry(&entry), "user::rwx");
    }

    #[test]
    fn test_format_entry_other() {
        let entry = AclEntry { tag: AclTag::Other, permissions: 0x04 };
        assert_eq!(format_entry(&entry), "other::r--");
    }

    #[test]
    fn test_format_entry_mask() {
        let entry = AclEntry { tag: AclTag::Mask, permissions: 0x07 };
        assert_eq!(format_entry(&entry), "mask::rwx");
    }

    #[test]
    fn test_format_acl() {
        let entries = vec![
            AclEntry { tag: AclTag::UserObj, permissions: 0x07 },
            AclEntry { tag: AclTag::GroupObj, permissions: 0x05 },
            AclEntry { tag: AclTag::Other, permissions: 0x04 },
        ];
        assert_eq!(format_acl(&entries), "user::rwx,group::r-x,other::r--");
    }

    #[test]
    fn test_find_entry_by_tag() {
        let entries = vec![
            AclEntry { tag: AclTag::UserObj, permissions: 0x07 },
            AclEntry { tag: AclTag::User(1000), permissions: 0x06 },
            AclEntry { tag: AclTag::GroupObj, permissions: 0x05 },
            AclEntry { tag: AclTag::Group(100), permissions: 0x04 },
            AclEntry { tag: AclTag::Mask, permissions: 0x07 },
            AclEntry { tag: AclTag::Other, permissions: 0x04 },
        ];

        let e = find_entry(&entries, "user:").unwrap();
        assert_eq!(e.tag, AclTag::UserObj);

        let e = find_entry(&entries, "user:1000").unwrap();
        assert_eq!(e.tag, AclTag::User(1000));

        let e = find_entry(&entries, "group:").unwrap();
        assert_eq!(e.tag, AclTag::GroupObj);

        let e = find_entry(&entries, "group:100").unwrap();
        assert_eq!(e.tag, AclTag::Group(100));

        let e = find_entry(&entries, "mask").unwrap();
        assert_eq!(e.tag, AclTag::Mask);

        let e = find_entry(&entries, "other").unwrap();
        assert_eq!(e.tag, AclTag::Other);

        assert!(find_entry(&entries, "user:9999").is_none());
    }

    #[test]
    fn test_parse_invalid_data() {
        assert!(parse_acl(&[]).is_none());
        assert!(parse_acl(&[0, 0]).is_none());

        let mut data = vec![0u8; 4];
        data[0] = 0x01;
        assert!(parse_acl(&data).is_none());

        let mut data = ACL_VERSION.to_le_bytes().to_vec();
        data.p
```

### Core Architecture Module: `src/util/app_dirs.rs`
```
use std::path::PathBuf;
#[cfg(feature = "interactive")]
use directories::ProjectDirs;

#[cfg(feature = "interactive")]
const ORGANIZATION: &str = "jhspetersson";
#[cfg(feature = "interactive")]
const APPLICATION: &str = "fselect";

#[cfg(all(not(windows), feature = "interactive"))]
pub(crate) fn get_project_dir() -> Option<PathBuf> {
    ProjectDirs::from("", ORGANIZATION, APPLICATION).map(|pd| pd.config_dir().to_path_buf())
}

#[cfg(all(windows, feature = "interactive"))]
pub(crate) fn get_project_dir() -> Option<PathBuf> {
    ProjectDirs::from("", ORGANIZATION, APPLICATION)
        .and_then(|pd| pd.config_dir().parent().map(|p| p.to_path_buf()))
}

#[cfg(not(feature = "interactive"))]
pub(crate) fn get_project_dir() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_project_dir_does_not_panic() {
        // Should return Some on most systems, but must never panic
        let _ = get_project_dir();
    }
}

```

### Core Architecture Module: `src/util/audio.rs`
```
use std::path::Path;

use lofty::prelude::*;
use lofty::read_from_path;

/// Audio metadata and properties extracted in a single read via `lofty`.
///
/// Covers every format `lofty` understands as audio — MP3, FLAC, Ogg Vorbis,
/// Opus, M4A/AAC/ALAC, WAV, AIFF, APE, WavPack, Musepack, and Speex — so the
/// audio fields are no longer limited to MP3.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct AudioInfo {
    /// Duration in whole seconds.
    pub duration: Option<usize>,
    /// Audio bitrate in kbps.
    pub bitrate: Option<u32>,
    /// Sampling frequency in Hz.
    pub sample_rate: Option<u32>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub year: Option<u32>,
    /// Track number, formatted as `n` or `n/total`.
    pub track: Option<String>,
    /// Disc number ("part of a set"), formatted as `n` or `n/total`.
    pub disc: Option<String>,
}

/// Whether `lofty` should read this file's audio metadata. The video MP4
/// container extensions (`mp4`, `m4v`, `3gp`) are intentionally excluded so
/// their duration keeps coming from the dedicated video extractor, while the
/// audio-only MP4 variants (`m4a`, `m4b`, ...) are handled here.
pub fn is_audio_ext(ext_lowercase: &str) -> bool {
    matches!(
        ext_lowercase,
        "mp3" | "mp2" | "mp1"
            | "flac"
            | "ogg" | "oga"
            | "opus"
            | "m4a" | "m4b" | "m4p" | "m4r"
            | "aac"
            | "aiff" | "aif" | "afc" | "aifc"
            | "wav" | "wave"
            | "wv"
            | "ape"
            | "mpc" | "mp+" | "mpp"
            | "spx"
    )
}

/// Extract a year from a tag value: either a leading 4-digit year (possibly
/// followed by the rest of a date, e.g. `2023-05-01`) or a value that is
/// nothing but a shorter year (e.g. `800`). Longer digit runs are not years.
fn parse_year(value: &str) -> Option<u32> {
    let value = value.trim();
    let digit_count = value.chars().take_while(|c| c.is_ascii_digit()).count();
    match digit_count {
        4 => value[..4].parse().ok(),
        1..=3 if digit_count == value.len() => value.parse().ok(),
        _ => None,
    }
}

/// Format a number paired with an optional total as `n/total`, or just `n`
/// when no total is present.
fn format_numbered(value: Option<u32>, total: Option<u32>) -> Option<String> {
    value.map(|v| match total {
        Some(t) => format!("{}/{}", v, t),
        None => v.to_string(),
    })
}

/// Read audio metadata and properties for a supported audio file, or `None`
/// when the extension is not a recognized audio format or the file cannot be
/// parsed.
pub fn get_audio_info(path: &Path) -> Option<AudioInfo> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if !is_audio_ext(&ext) {
        return None;
    }

    let tagged_file = read_from_path(path).ok()?;

    let properties = tagged_file.properties();
    let duration = properties.duration();

    let mut info = AudioInfo {
        // An exactly-zero duration means lofty could not determine it;
        // surface that as an absent value rather than a misleading 0. A
        // sub-second clip still reports 0 whole seconds.
        duration: (!duration.is_zero()).then_some(duration.as_secs() as usize),
        bitrate: properties.audio_bitrate().or_else(|| properties.overall_bitrate()),
        sample_rate: properties.sample_rate(),
        ..Default::default()
    };

    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
        info.title = tag.title().map(|c| c.to_string());
        info.artist = tag.artist().map(|c| c.to_string());
        info.album = tag.album().map(|c| c.to_string());
        info.genre = tag.genre().map(|c| c.to_string());
        info.comment = tag.comment().map(|c| c.to_string());
        info.year = tag
            .get_string(ItemKey::Year)
            .or_else(|| tag.get_string(ItemKey::RecordingDate))
            .and_then(parse_year);
        info.track = format_numbered(tag.track(), tag.track_total());
        info.disc = format_numbered(tag.disk(), tag.disk_total());
    }

    Some(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/test/audio")
            .join(name)
    }

    #[test]
    fn test_is_audio_ext_excludes_video_mp4() {
        assert!(is_audio_ext("flac"));
        assert!(is_audio_ext("m4a"));
        assert!(is_audio_ext("mp3"));
        assert!(!is_audio_ext("mp4"));
        assert!(!is_audio_ext("m4v"));
        assert!(!is_audio_ext("mkv"));
        assert!(!is_audio_ext("txt"));
    }

    #[test]
    fn test_parse_year() {
        assert_eq!(parse_year("2023"), Some(2023));
        assert_eq!(parse_year("2023-05-01"), Some(2023));
        assert_eq!(parse_year(" 2023 "), Some(2023));
        assert_eq!(parse_year("800"), Some(800));
        assert_eq!(parse_year("20231"), None);
        assert_eq!(parse_year("05/01/2023"), None);
        assert_eq!(parse_year("unknown"), None);
        assert_eq!(parse_year(""), None);
    }

    #[test]
    fn test_format_numbered() {
        assert_eq!(format_numbered(Some(4), Some(9)), Some(String::from("4/9")));
        assert_eq!(format_numbered(Some(4), None), Some(String::from("4")));
        assert_eq!(format_numbered(None, Some(9)), None);
    }

    #[test]
    fn test_get_audio_info_mp3_duration() {
        let info = get_audio_info(&fixture("silent-35s.mp3")).expect("mp3 should parse");
        assert_eq!(info.duration, Some(35));
    }

    #[test]
    fn test_get_audio_info_wav_duration() {
        let info = get_audio_info(&fixture("silent.wav")).expect("wav should parse");
        assert_eq!(info.duration, Some(15));
    }

    #[test]
    fn test_get_audio_info_rejects_non_audio() {
        assert!(get_audio_info(Path::new("nonexistent.txt")).is_none());
    }
}

```

### Core Architecture Module: `src/util/capabilities.rs`
```
macro_rules! check_cap {
    ($cap_name: ident, $code: expr, $permitted: ident, $inherited: ident, $effective: ident, $result: ident) => {
        if let Some(str_result) = check_capability($permitted, $inherited, 1 << $code) {
            $result.push(stringify!($cap_name).to_owned() + "=" + &$effective + &str_result);
        }
    };
}

macro_rules! check_caps_word_0 {
    ($permitted: ident, $inherited: ident, $effective: ident, $result: ident) => {
        check_cap!(cap_chown, 0, $permitted, $inherited, $effective, $result);
        check_cap!(cap_dac_override, 1, $permitted, $inherited, $effective, $result);
        check_cap!(cap_dac_read_search, 2, $permitted, $inherited, $effective, $result);
        check_cap!(cap_fowner, 3, $permitted, $inherited, $effective, $result);
        check_cap!(cap_fsetid, 4, $permitted, $inherited, $effective, $result);
        check_cap!(cap_kill, 5, $permitted, $inherited, $effective, $result);
        check_cap!(cap_setgid, 6, $permitted, $inherited, $effective, $result);
        check_cap!(cap_setuid, 7, $permitted, $inherited, $effective, $result);
        check_cap!(cap_setpcap, 8, $permitted, $inherited, $effective, $result);
        check_cap!(cap_linux_immutable, 9, $permitted, $inherited, $effective, $result);
        check_cap!(cap_net_bind_service, 10, $permitted, $inherited, $effective, $result);
        check_cap!(cap_net_broadcast, 11, $permitted, $inherited, $effective, $result);
        check_cap!(cap_net_admin, 12, $permitted, $inherited, $effective, $result);
        check_cap!(cap_net_raw, 13, $permitted, $inherited, $effective, $result);
        check_cap!(cap_ipc_lock, 14, $permitted, $inherited, $effective, $result);
        check_cap!(cap_ipc_owner, 15, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_module, 16, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_rawio, 17, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_chroot, 18, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_ptrace, 19, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_pacct, 20, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_admin, 21, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_boot, 22, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_nice, 23, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_resource, 24, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_time, 25, $permitted, $inherited, $effective, $result);
        check_cap!(cap_sys_tty_config, 26, $permitted, $inherited, $effective, $result);
        check_cap!(cap_mknod, 27, $permitted, $inherited, $effective, $result);
        check_cap!(cap_lease, 28, $permitted, $inherited, $effective, $result);
        check_cap!(cap_audit_write, 29, $permitted, $inherited, $effective, $result);
        check_cap!(cap_audit_control, 30, $permitted, $inherited, $effective, $result);
        check_cap!(cap_setfcap, 31, $permitted, $inherited, $effective, $result);
    };
}

macro_rules! check_caps_word_1 {
    ($permitted: ident, $inherited: ident, $effective: ident, $result: ident) => {
        check_cap!(cap_mac_override, 0, $permitted, $inherited, $effective, $result);
        check_cap!(cap_mac_admin, 1, $permitted, $inherited, $effective, $result);
        check_cap!(cap_syslog, 2, $permitted, $inherited, $effective, $result);
        check_cap!(cap_wake_alarm, 3, $permitted, $inherited, $effective, $result);
        check_cap!(cap_block_suspend, 4, $permitted, $inherited, $effective, $result);
        check_cap!(cap_audit_read, 5, $permitted, $inherited, $effective, $result);
        check_cap!(cap_perfmon, 6, $permitted, $inherited, $effective, $result);
        check_cap!(cap_bpf, 7, $permitted, $inherited, $effective, $result);
        check_cap!(cap_checkpoint_restore, 8, $permitted, $inherited, $effective, $result);
    };
}

const VFS_CAP_REVISION_MASK: u32 = 0xFF000000;
const VFS_CAP_REVISION_1: u32 = 0x01000000;
const VFS_CAP_REVISION_2: u32 = 0x02000000;
const VFS_CAP_REVISION_3: u32 = 0x03000000;
const VFS_CAP_FLAGS_EFFECTIVE: u32 = 0x000001;
const XATTR_CAPS_SZ_1: usize = 12; // 4 (magic) + 4 (permitted) + 4 (inherited)
const XATTR_CAPS_SZ_2: usize = 20; // 4 (magic) + 2 * (4 (permitted) + 4 (inherited))
const XATTR_CAPS_SZ_3: usize = 24; // v2 + 4 (rootid)

pub fn parse_capabilities(caps: Vec<u8>) -> String {
    if caps.len() < 4 {
        return String::new();
    }

    let magic_etc = u32::from_le_bytes(caps[0..4].try_into().unwrap());
    let revision = magic_etc & VFS_CAP_REVISION_MASK;

    let effective = if magic_etc & VFS_CAP_FLAGS_EFFECTIVE != 0 {
        String::from("e")
    } else {
        String::new()
    };

    let mut result: Vec<String> = vec![];

    match revision {
        VFS_CAP_REVISION_1 => {
            if caps.len() < XATTR_CAPS_SZ_1 {
                return String::new();
            }

            let permitted = u32::from_le_bytes(caps[4..8].try_into().unwrap());
            let inherited = u32::from_le_bytes(caps[8..12].try_into().unwrap());

            check_caps_word_0!(permitted, inherited, effective, result);
        }
        VFS_CAP_REVISION_2 | VFS_CAP_REVISION_3 => {
            // v2 (20 bytes) and v3 (24 bytes with rootid) share the data layout
            if caps.len() < XATTR_CAPS_SZ_2 {
                return String::new();
            }

            let permitted = u32::from_le_bytes(caps[4..8].try_into().unwrap());
            let inherited = u32::from_le_bytes(caps[8..12].try_into().unwrap());

            check_caps_word_0!(permitted, inherited, effective, result);

            let permitted = u32::from_le_bytes(caps[12..16].try_into().unwrap());
            let inherited = u32::from_le_bytes(caps[16..20].try_into().unwrap());

            check_caps_word_1!(permitted, inherited, effective, result);

            // v3 has a rootid (namespace owner UID) appended
            if caps.len() >= XATTR_CAPS_SZ_3 {
                let rootid = u32::from_le_bytes(caps[20..24].try_into().unwrap());
                if rootid != 0 {
                    result.push(format!("[rootid={}]", rootid));
                }
            }
        }
        _ => return String::new(),
    }

    result.join(" ")
}

fn check_capability(perm: u32, inh: u32, cap: u32) -> Option<String> {
    if inh & cap == cap && perm & cap == cap {
        Some(String::from("ip"))
    } else if perm & cap == cap {
        Some(String::from("p"))
    } else if inh & cap == cap {
        Some(String::from("i"))
    } else {
        None
    }
}

/// Check if a capabilities string contains a specific capability by exact name match.
/// The capabilities string is space-separated entries like "cap_net_bind_service=ep cap_net_admin=ep".
pub fn has_capability(caps_string: &str, cap_name: &str) -> bool {
    caps_string.split_whitespace().any(|entry| {
        match entry.find('=') {
            Some(idx) => &entry[..idx] == cap_name,
            None => entry == cap_name,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v2_blob(magic_flags: u32, permitted0: u32, inherited0: u32) -> Vec<u8> {
        let mut blob = Vec::new();
        blob.extend_from_slice(&(VFS_CAP_REVISION_2 | magic_flags).to_le_bytes());
        blob.extend_from_slice(&permitted0.to_le_bytes());
        blob.extend_from_slice(&inherited0.to_le_bytes());
        blob.extend_from_slice(&0u32.to_le_bytes());
        blob.extend_from_slice(&0u32.to_le_bytes());
        blob
    }

    #[test]
    fn test_parse_v2_blob_as_written_by_setcap() {
        // `setcap cap_net_bind_service=ep` writes a v2 blob whose magic is
        // 0x02000000 | effective flag; parsing must not come back empty.
        let blob = v2_blob(VFS_CAP_FLAGS_EFFECTIVE, 1 << 10, 0);
        assert_eq!(parse_capabilities(blob), "cap_net_bind_service=ep");
    }

    #[test]
    fn test_parse_v3_blob_with_rootid() {
        let mut blob = Vec::new();
        blob.extend_from_slice(&(VFS_CAP_REVISION_3 | VFS_CAP_FLAGS_EFFECTIVE).to_le_bytes());
        blob.extend_from_slice(&(1u32 << 10).to_le_bytes());
        blob.extend_from_slice(&0u32.to_le_bytes());
        blob.extend_from_slice(&0u32.to_le_bytes());
        blob.extend_from_slice(&0u32.to_le_bytes());
        blob.extend_from_slice(&1000u32.to_le_bytes());
        assert_eq!(
            parse_capabilities(blob),
            "cap_net_bind_service=ep [rootid=1000]"
        );
    }

    #[test]
    fn test_parse_v2_blob_without_effective_flag() {
        let blob = v2_blob(0, 1 << 21, 0);
        assert_eq!(parse_capabilities(blob), "cap_sys_admin=p");
    }

    #[test]
    fn test_has_capability_exact_match() {
        let caps = "cap_net_bind_service=ep cap_net_admin=ep";
        assert!(has_capability(caps, "cap_net_bind_service"));
        assert!(has_capability(caps, "cap_net_admin"));
    }

    #[test]
    fn test_has_capability_no_substring_match() {
        let caps = "cap_net_bind_service=ep cap_net_admin=ep";
        // Should NOT match via substring
        assert!(!has_capability(caps, "cap_net"));
        assert!(!has_capability(caps, "cap_net_bind"));
    }

    #[test]
    fn test_has_capability_empty() {
        assert!(!has_capability("", "cap_net_admin"));
    }

    #[test]
    fn test_has_capability_single() {
        assert!(has_capability("cap_sys_admin=ep", "cap_sys_admin"));
        assert!(!has_capability("cap_sys_admin=ep", "cap_sys"));
    }
}

```

### Core Architecture Module: `src/util/datetime.rs`
```
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use chrono_english::{parse_date_string, Dialect};
use regex::Regex;

static DATE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new("^(\\d{4})(-|:)(\\d{1,2})(-|:)(\\d{1,2})(?: (\\d{1,2})(?::(\\d{1,2})(?::(\\d{1,2}))?)?)?$").unwrap()
});

static US_DATES: Mutex<bool> = Mutex::new(false);

pub fn set_us_dates(us: bool) {
    *US_DATES.lock().unwrap() = us;
}

pub fn parse_datetime(s: &str) -> Result<(NaiveDateTime, NaiveDateTime), String> {
    if s == "today" {
        let date = Local::now().date_naive();
        let start = date.and_hms_opt(0, 0, 0).unwrap();
        let finish = date.and_hms_opt(23, 59, 59).unwrap();

        return Ok((start, finish));
    }

    if s == "yesterday" {
        let date = Local::now().date_naive() - Duration::try_days(1).unwrap();
        let start = date.and_hms_opt(0, 0, 0).unwrap();
        let finish = date.and_hms_opt(23, 59, 59).unwrap();

        return Ok((start, finish));
    }

    match DATE_REGEX.captures(s) {
        Some(cap) => {
            // Ensure consistent separator (both dashes or both colons)
            if cap[2] != cap[4] {
                return Err("Error parsing date/time value: ".to_string() + s);
            }
            let year: i32 = cap[1].parse().unwrap();
            let month: u32 = cap[3].parse().unwrap();
            let day: u32 = cap[5].parse().unwrap();

            let hour_start: u32;
            let hour_finish: u32;
            match cap.get(6) {
                Some(val) => {
                    hour_start = val.as_str().parse().unwrap();
                    hour_finish = hour_start;
                }
                None => {
                    hour_start = 0;
                    hour_finish = 23;
                }
            }

            let min_start: u32;
            let min_finish: u32;
            match cap.get(7) {
                Some(val) => {
                    min_start = val.as_str().parse().unwrap();
                    min_finish = min_start;
                }
                None => {
                    min_start = 0;
                    min_finish = 59;
                }
            }

            let sec_start: u32;
            let sec_finish: u32;
            match cap.get(8) {
                Some(val) => {
                    sec_start = val.as_str().parse().unwrap();
                    sec_finish = sec_start;
                }
                None => {
                    sec_start = 0;
                    sec_finish = 59;
                }
            }

            // Build the naive datetime directly: a Local round-trip would fail on
            // DST-skipped or ambiguous midnights while adding nothing to the result
            match NaiveDate::from_ymd_opt(year, month, day) {
                Some(date) => {
                    let start = date.and_hms_opt(hour_start, min_start, sec_start);
                    let finish = date.and_hms_opt(hour_finish, min_finish, sec_finish);

                    match (start, finish) {
                        (Some(s), Some(f)) => Ok((s, f)),
                        _ => Err("Error parsing date/time value: ".to_string() + s),
                    }
                }
                None => Err("Error parsing date/time value: ".to_string() + s),
            }
        }
        None => {
            // Simplified relative-day syntax: any length of `+N`/`-N` counts
            // as days from today; longer non-numeric strings fall through to
            // the natural-language parser.
            if s.len() >= 2
                && (s.starts_with("+") || s.starts_with("-"))
                && let Ok(days) = s.parse::<i64>()
            {
                let date = Local::now().date_naive() + Duration::days(days);
                let start = date.and_hms_opt(0, 0, 0).unwrap();
                let finish = date.and_hms_opt(23, 59, 59).unwrap();

                Ok((start, finish))
            } else if s.len() >= 5 {
                let dialect = match *US_DATES.lock().unwrap() {
                    true => Dialect::Us,
                    false => Dialect::Uk,
                };
                match parse_date_string(s, Local::now(), dialect) {
                    Ok(date_time) => {
                        let date_time = date_time.naive_local();
                        let finish = if date_time.hour() == 0
                            && date_time.minute() == 0
                            && date_time.second() == 0
                        {
                            date_time
                                .with_hour(23)
                                .unwrap()
                                .with_minute(59)
                                .unwrap()
                                .with_second(59)
                                .unwrap()
                        } else {
                            date_time
                        };

                        Ok((date_time, finish))
                    }
                    _ => Err("Error parsing date/time value: ".to_string() + s),
                }
            } else {
                Err("Error parsing date/time value: ".to_string() + s)
            }
        }
    }
}

pub fn system_time_to_naive_local(sdt: SystemTime) -> Option<NaiveDateTime> {
    let (sec, nsec) = match sdt.duration_since(UNIX_EPOCH) {
        Ok(dur) => (i64::try_from(dur.as_secs()).ok()?, dur.subsec_nanos()),
        Err(e) => {
            let dur = e.duration();
            let secs = i64::try_from(dur.as_secs()).ok()?;
            if dur.subsec_nanos() == 0 {
                (secs.checked_neg()?, 0)
            } else {
                (secs.checked_neg()?.checked_sub(1)?, 1_000_000_000 - dur.subsec_nanos())
            }
        }
    };

    DateTime::<Utc>::from_timestamp(sec, nsec)
        .map(|dt_utc| dt_utc.with_timezone(&Local).naive_local())
}

pub fn to_local_datetime(dt: &zip::DateTime) -> NaiveDateTime {
    let date = NaiveDate::from_ymd_opt(dt.year() as i32, dt.month() as u32, dt.day() as u32)
        .or_else(|| NaiveDate::from_ymd_opt(dt.year() as i32, 1, 1))
        .unwrap_or_default();
    let time = NaiveTime::from_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32)
        .unwrap_or_default();
    NaiveDateTime::new(date, time)
}

pub fn format_datetime(dt: &NaiveDateTime) -> String {
    format!("{}", dt.format("%Y-%m-%d %H:%M:%S"))
}

pub fn format_date(date: &NaiveDate) -> String {
    format!("{}", date.format("%Y-%m-%d"))
}

pub fn format_time(time: &NaiveTime) -> String {
    format!("{}", time.format("%H:%M:%S"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration as StdDuration;
    use chrono::{Datelike, Local, NaiveDate};

    #[test]
    fn test_parse_today() {
        let result = parse_datetime("today").unwrap();
        let now = Local::now().date_naive();
        let start = now.and_hms_opt(0, 0, 0).unwrap();
        let finish = now.and_hms_opt(23, 59, 59).unwrap();

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_parse_yesterday() {
        let result = parse_datetime("yesterday").unwrap();
        let yesterday = Local::now().date_naive() - chrono::Duration::days(1);
        let start = yesterday.and_hms_opt(0, 0, 0).unwrap();
        let finish = yesterday.and_hms_opt(23, 59, 59).unwrap();

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_parse_two_days_ago() {
        let result = parse_datetime("2 days ago 00:00").unwrap();
        let two_days_ago = Local::now().date_naive() - chrono::Duration::days(2);
        let start = two_days_ago.and_hms_opt(0, 0, 0).unwrap();
        let finish = two_days_ago.and_hms_opt(23, 59, 59).unwrap();

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_parse_two_days_ago_simplified() {
        let result = parse_datetime("-2").unwrap();
        let two_days_ago = Local::now().date_naive() - chrono::Duration::days(2);
        let start = two_days_ago.and_hms_opt(0, 0, 0).unwrap();
        let finish = two_days_ago.and_hms_opt(23, 59, 59).unwrap();

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_parse_specific_date() {
        let result = parse_datetime("2023-12-11").unwrap();
        let date = NaiveDate::from_ymd_opt(2023, 12, 11).unwrap();
        let start = date.and_hms_opt(0, 0, 0).unwrap();
        let finish = date.and_hms_opt(23, 59, 59).unwrap();

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_parse_specific_datetime() {
        let result = parse_datetime("2023-12-11 14:30:45").unwrap();
        let date = NaiveDate::from_ymd_opt(2023, 12, 11).unwrap();
        let start = date.and_hms_opt(14, 30, 45).unwrap();
        let finish = start;

        assert_eq!(result.0, start);
        assert_eq!(result.1, finish);
    }

    #[test]
    fn test_invalid_format() {
        let result = parse_datetime("invalid-date");

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Error parsing date/time value: invalid-date");
    }

    #[test]
    fn test_parse_invalid_calendar_date() {
        // Genuinely invalid dates must still error after dropping the Local round-trip
        assert!(parse_datetime("2023-02-30").is_err());
        assert!(parse_datetime("2023-13-01").is_err());
        assert!(parse_datetime("2023-04-31").is_err());
    }

    #[test]
    fn test_parse_out_of_range_time() {
        assert!(parse_datetime("2024-01-01 25:00:00").is_err());
        assert!(parse_datetime("2024-01-01 12:61:00").is_err());
        assert!(parse_datetime("2024-01-01 12:00:99").is_err());
    }

    #[test]
    fn test_parse_non_numeric_plus_minus(
```

### Core Architecture Module: `src/util/dimensions/image.rs`
```
use std::io;
use std::path::Path;

use imagesize::ImageError;

use crate::util::dimensions::DimensionsExtractor;
use crate::util::Dimensions;

pub struct ImageDimensionsExtractor;

impl ImageDimensionsExtractor {
    const EXTENSIONS: [&'static str; 13] = [
        "bmp", "gif", "heic", "heif", "jpeg", "jpg", "jxl", "png", "psb", "psd", "tga", "tiff",
        "webp",
    ];
}

impl DimensionsExtractor for ImageDimensionsExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool {
        ImageDimensionsExtractor::EXTENSIONS.contains(&ext_lowercase)
    }

    fn try_read_dimensions(&self, path: &Path) -> io::Result<Option<Dimensions>> {
        let dimensions = imagesize::size(path).map_err(|err| match err {
            ImageError::NotSupported => {
                io::Error::new(io::ErrorKind::InvalidInput, ImageError::NotSupported)
            }
            ImageError::CorruptedImage => {
                io::Error::new(io::ErrorKind::InvalidData, ImageError::CorruptedImage)
            }
            ImageError::IoError(e) => e,
        })?;
        Ok(Some(Dimensions {
            width: dimensions.width,
            height: dimensions.height,
        }))
    }
}

#[cfg(test)]
mod test {
    use super::ImageDimensionsExtractor;
    use crate::util::dimensions::{test::test_successful, Dimensions};
    use std::error::Error;

    fn do_test_success(ext: &str, w: usize, h: usize) -> Result<(), Box<dyn Error>> {
        let res_path = String::from("image/rust-logo-blk.") + ext;
        test_successful(
            ImageDimensionsExtractor,
            &res_path,
            Some(Dimensions {
                width: w,
                height: h,
            }),
        )
    }

    #[test]
    pub fn test_bmp() -> Result<(), Box<dyn Error>> {
        do_test_success("bmp", 144, 144)
    }

    #[test]
    pub fn test_gif() -> Result<(), Box<dyn Error>> {
        do_test_success("gif", 144, 144)
    }

    #[test]
    pub fn test_jpeg() -> Result<(), Box<dyn Error>> {
        do_test_success("jpeg", 144, 144)
    }

    #[test]
    pub fn test_jpg() -> Result<(), Box<dyn Error>> {
        do_test_success("jpg", 144, 144)
    }

    #[test]
    pub fn test_png() -> Result<(), Box<dyn Error>> {
        do_test_success("png", 144, 144)
    }

    #[test]
    pub fn test_tiff() -> Result<(), Box<dyn Error>> {
        do_test_success("tiff", 144, 144)
    }

    #[test]
    pub fn test_webp() -> Result<(), Box<dyn Error>> {
        do_test_success("webp", 144, 144)
    }
}

```

### Core Architecture Module: `src/util/dimensions/mkv.rs`
```
use std::fs::File;
use std::io;
use std::path::Path;

use matroska::MatroskaError;

use crate::util::dimensions::DimensionsExtractor;
use crate::util::Dimensions;

pub struct MkvDimensionsExtractor;

impl DimensionsExtractor for MkvDimensionsExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool {
        "mkv" == ext_lowercase || "webm" == ext_lowercase
    }

    fn try_read_dimensions(&self, path: &Path) -> io::Result<Option<Dimensions>> {
        let fd = File::open(path)?;
        let matroska = matroska::Matroska::open(fd).map_err(|err| match err {
            MatroskaError::Io(io) => io,
            MatroskaError::UTF8(utf8) => io::Error::new(io::ErrorKind::InvalidData, utf8),
            e => io::Error::new(io::ErrorKind::InvalidData, e),
        })?;
        Ok(matroska
            .tracks
            .iter()
            .find(|&track| track.tracktype == matroska::Tracktype::Video)
            .and_then(|track| {
                if let matroska::Settings::Video(settings) = &track.settings {
                    Some(Dimensions {
                        width: settings.pixel_width as usize,
                        height: settings.pixel_height as usize,
                    })
                } else {
                    None
                }
            }))
    }
}

#[cfg(test)]
mod test {
    use super::MkvDimensionsExtractor;
    use crate::util::dimensions::{test::test_successful, Dimensions};
    use std::error::Error;

    #[test]
    fn test_success() -> Result<(), Box<dyn Error>> {
        test_successful(
            MkvDimensionsExtractor,
            "video/rust-logo-blk.mkv",
            Some(Dimensions {
                width: 144,
                height: 144,
            }),
        )
    }
}

```

### Core Architecture Module: `src/util/dimensions/mod.rs`
```
use std::io;

mod image;
mod mkv;
mod mp4;
mod svg;

use self::svg::SvgDimensionsExtractor;
use image::ImageDimensionsExtractor;
use mkv::MkvDimensionsExtractor;
use mp4::Mp4DimensionsExtractor;
use std::path::Path;

#[derive(PartialEq, Eq, Clone, Debug)]
pub struct Dimensions {
    pub width: usize,
    pub height: usize,
}

pub trait DimensionsExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool;
    fn try_read_dimensions(&self, path: &Path) -> io::Result<Option<Dimensions>>;
}

const EXTRACTORS: [&dyn DimensionsExtractor; 4] = [
    &MkvDimensionsExtractor,
    &Mp4DimensionsExtractor,
    &SvgDimensionsExtractor,
    &ImageDimensionsExtractor,
];

pub fn get_dimensions<T: AsRef<Path>>(path: T) -> Option<Dimensions> {
    let path_ref = path.as_ref();
    let extension = path_ref.extension()?.to_str()?;

    EXTRACTORS
        .iter()
        .find(|extractor| extractor.supports_ext(&extension.to_lowercase()))
        .and_then(|extractor| extractor.try_read_dimensions(path_ref).unwrap_or_default())
}

#[cfg(test)]
mod test {
    use crate::util::dimensions::DimensionsExtractor;
    use crate::util::Dimensions;
    use std::error::Error;
    use std::ffi::OsStr;
    use std::path::PathBuf;

    pub(crate) fn test_successful<T: DimensionsExtractor>(
        under_test: T,
        test_res_path: &str,
        expected: Option<Dimensions>,
    ) -> Result<(), Box<dyn Error>> {
        let path_string = std::env::var("CARGO_MANIFEST_DIR")? + "/resources/test/" + test_res_path;
        let path = PathBuf::from(path_string);
        assert!(under_test.supports_ext(path.extension().and_then(OsStr::to_str).unwrap()));
        assert_eq!(under_test.try_read_dimensions(&path)?, expected);

        Ok(())
    }

    pub(crate) fn test_fail<T: DimensionsExtractor>(
        under_test: T,
        test_res_path: &str,
        expected: std::io::ErrorKind,
    ) -> Result<(), Box<dyn Error>> {
        let path_string = std::env::var("CARGO_MANIFEST_DIR")? + "/resources/test/" + test_res_path;
        let path = PathBuf::from(path_string);
        assert!(under_test.supports_ext(path.extension().and_then(OsStr::to_str).unwrap()));
        let result = under_test.try_read_dimensions(&path);
        assert_eq!(result.map_err(|err| err.kind()), Err(expected));

        Ok(())
    }
}

```

### Core Architecture Module: `src/util/dimensions/mp4.rs`
```
use std::fs::File;
use std::io;
use std::io::BufReader;
use std::path::Path;

use crate::util::dimensions::DimensionsExtractor;
use crate::util::Dimensions;

pub struct Mp4DimensionsExtractor;

impl DimensionsExtractor for Mp4DimensionsExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool {
        // All ISO-BMFF containers mp4parse reads.
        matches!(ext_lowercase, "mp4" | "m4v" | "mov" | "3gp")
    }

    fn try_read_dimensions(&self, path: &Path) -> io::Result<Option<Dimensions>> {
        let fd = File::open(path)?;
        let mut reader = BufReader::new(fd);
        let context = mp4parse::read_mp4(&mut reader)?;
        Ok(context
            .tracks
            .iter()
            .find(|track| track.track_type == mp4parse::TrackType::Video)
            .and_then(|track| {
                track.tkhd.as_ref().map(|tkhd| Dimensions {
                    width: (tkhd.width / 65536) as usize,
                    height: (tkhd.height / 65536) as usize,
                })
            }))
    }
}

#[cfg(test)]
mod test {
    use super::Mp4DimensionsExtractor;
    use crate::util::dimensions::{test::test_successful, Dimensions};
    use std::error::Error;

    #[test]
    fn test_success() -> Result<(), Box<dyn Error>> {
        test_successful(
            Mp4DimensionsExtractor,
            "video/rust-logo-blk.mp4",
            Some(Dimensions {
                width: 144,
                height: 144,
            }),
        )
    }
}

```

### Core Architecture Module: `src/util/dimensions/svg.rs`
```
use std::io;
use std::path::Path;

use svg::node::element::tag::SVG;
use svg::parser::Event;

use crate::util::dimensions::DimensionsExtractor;
use crate::util::Dimensions;

pub struct SvgDimensionsExtractor;

impl SvgDimensionsExtractor {}

/// Parse an SVG length attribute: a number with an optional unit suffix
/// (`144`, `144.5`, `144px`, `10cm`). Percentages are relative and have no
/// absolute pixel value, so they yield `Ok(None)`; a value without a leading
/// number is invalid data.
fn parse_svg_length(value: &str) -> io::Result<Option<usize>> {
    let value = value.trim();
    let numeric_len = value
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(value.len());
    let (number, unit) = value.split_at(numeric_len);

    if unit.trim() == "%" {
        return Ok(None);
    }

    match number.parse::<f64>() {
        Ok(v) if v.is_finite() => Ok(Some(v.round() as usize)),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid SVG length: {}", value),
        )),
    }
}

/// Parse a `viewBox` attribute (`min-x min-y width height`, separated by
/// whitespace and/or commas) into its width/height part.
fn parse_view_box(value: &str) -> Option<Dimensions> {
    let mut parts = value
        .split(|c: char| c.is_ascii_whitespace() || c == ',')
        .filter(|p| !p.is_empty());
    let _min_x = parts.next()?;
    let _min_y = parts.next()?;
    let width = parts.next()?.parse::<f64>().ok()?;
    let height = parts.next()?.parse::<f64>().ok()?;

    if width.is_finite() && height.is_finite() && width >= 0.0 && height >= 0.0 {
        Some(Dimensions {
            width: width.round() as usize,
            height: height.round() as usize,
        })
    } else {
        None
    }
}

impl DimensionsExtractor for SvgDimensionsExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool {
        "svg" == ext_lowercase
    }

    fn try_read_dimensions(&self, path: &Path) -> io::Result<Option<Dimensions>> {
        let mut content = String::new();
        for event in svg::open(path, &mut content)? {
            if let Event::Tag(SVG, _, attributes) = event {
                if let (Some(width_value), Some(height_value)) =
                    (attributes.get("width"), attributes.get("height"))
                    && let (Some(width), Some(height)) =
                        (parse_svg_length(width_value)?, parse_svg_length(height_value)?)
                {
                    return Ok(Some(Dimensions { width, height }));
                }

                // No absolute width/height (the standard shape of viewBox-only
                // exports from Figma/Illustrator/icon sets, or percentage
                // sizes): fall back to the viewBox dimensions.
                return Ok(attributes.get("viewBox").and_then(|v| parse_view_box(v)));
            }
        }

        Ok(None)
    }
}

#[cfg(test)]
mod test {
    use super::SvgDimensionsExtractor;
    use crate::util::dimensions::{test::test_fail, test::test_successful, Dimensions};
    use std::error::Error;
    use std::io;

    #[test]
    fn test_success() -> Result<(), Box<dyn Error>> {
        test_successful(
            SvgDimensionsExtractor,
            "image/rust-logo-blk.svg",
            Some(Dimensions {
                width: 144,
                height: 144,
            }),
        )
    }

    #[test]
    fn test_non_square() -> Result<(), Box<dyn Error>> {
        test_successful(
            SvgDimensionsExtractor,
            "image/rect.svg",
            Some(Dimensions {
                width: 200,
                height: 100,
            }),
        )
    }

    #[test]
    fn test_nonexistent_returns_error_not_panic() {
        use crate::util::dimensions::DimensionsExtractor;
        let extractor = SvgDimensionsExtractor;
        let result = extractor.try_read_dimensions(std::path::Path::new("/nonexistent/file.svg"));
        assert!(result.is_err());
    }

    #[test]
    fn test_length_units_and_floats() {
        use super::parse_svg_length;
        assert_eq!(parse_svg_length("144").unwrap(), Some(144));
        assert_eq!(parse_svg_length("144px").unwrap(), Some(144));
        assert_eq!(parse_svg_length("144.4").unwrap(), Some(144));
        assert_eq!(parse_svg_length(" 10cm ").unwrap(), Some(10));
        assert_eq!(parse_svg_length("100%").unwrap(), None);
        assert!(parse_svg_length("bar").is_err());
        assert!(parse_svg_length("").is_err());
    }

    #[test]
    fn test_view_box_parsing() {
        use super::parse_view_box;
        use crate::util::Dimensions;
        assert_eq!(
            parse_view_box("0 0 100 50"),
            Some(Dimensions { width: 100, height: 50 })
        );
        assert_eq!(
            parse_view_box("0, 0, 24, 24"),
            Some(Dimensions { width: 24, height: 24 })
        );
        assert_eq!(
            parse_view_box("-10 -10 36.5 20"),
            Some(Dimensions { width: 37, height: 20 })
        );
        assert_eq!(parse_view_box("0 0 100"), None);
        assert_eq!(parse_view_box("0 0 -1 5"), None);
    }

    #[test]
    fn test_view_box_only_svg_falls_back() -> Result<(), Box<dyn Error>> {
        use crate::util::dimensions::DimensionsExtractor;

        let tmp = std::env::temp_dir().join("fselect_test_viewbox_only.svg");
        std::fs::write(
            &tmp,
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect/></svg>"#,
        )?;
        let result = SvgDimensionsExtractor.try_read_dimensions(&tmp);
        let _ = std::fs::remove_file(&tmp);
        assert_eq!(
            result?,
            Some(Dimensions {
                width: 100,
                height: 50
            })
        );
        Ok(())
    }

    #[test]
    fn test_corrupted() -> Result<(), Box<dyn Error>> {
        test_fail(
            SvgDimensionsExtractor,
            "image/rust-logo-blk_corrupted.svg",
            io::ErrorKind::InvalidData,
        )
    }
}

```

### Core Architecture Module: `src/util/duration/mkv.rs`
```
use std::fs::File;
use std::io;
use std::path::Path;

use matroska::MatroskaError;

use crate::util::duration::DurationExtractor;
use crate::util::Duration;

pub struct MkvDurationExtractor;

impl DurationExtractor for MkvDurationExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool {
        "mkv" == ext_lowercase || "webm" == ext_lowercase
    }

    fn try_read_duration(&self, path: &Path) -> io::Result<Option<Duration>> {
        let fd = File::open(path)?;
        let matroska = matroska::Matroska::open(fd).map_err(|err| match err {
            MatroskaError::Io(io) => io,
            MatroskaError::UTF8(utf8) => io::Error::new(io::ErrorKind::InvalidData, utf8),
            e => io::Error::new(io::ErrorKind::InvalidData, e),
        })?;

        match matroska.info.duration {
            Some(duration) => {
                Ok(Some(Duration {
                    length: duration.as_secs() as usize,
                }))
            }
            None => Ok(None),
        }
    }
}

#[cfg(test)]
mod test {
    use super::MkvDurationExtractor;
    use crate::util::duration::DurationExtractor;
    use crate::util::Duration;
    use std::error::Error;
    use std::path::PathBuf;

    #[test]
    fn test_success() -> Result<(), Box<dyn Error>> {
        let path_string =
            std::env::var("CARGO_MANIFEST_DIR")? + "/resources/test/" + "video/rust-logo-blk.mkv";
        let path = PathBuf::from(path_string);
        assert_eq!(
            MkvDurationExtractor.try_read_duration(&path)?,
            Some(Duration { length: 1 }),
        );
        Ok(())
    }
}

```

### Core Architecture Module: `src/util/duration/mod.rs`
```
mod mkv;
mod mp4;

use std::io;
use std::path::Path;

use mkv::MkvDurationExtractor;
use mp4::Mp4DurationExtractor;

#[derive(PartialEq, Eq, Clone, Debug)]
pub struct Duration {
    pub length: usize,
}

/// Extracts the duration of a video container. Audio formats are handled
/// separately by [`crate::util::audio`] via `lofty`, so the remaining
/// extractors only cover the video containers `lofty` does not read (MP4,
/// Matroska).
pub trait DurationExtractor {
    fn supports_ext(&self, ext_lowercase: &str) -> bool;
    fn try_read_duration(&self, path: &Path) -> io::Result<Option<Duration>>;
}

const EXTRACTORS: [&dyn DurationExtractor; 2] = [
    &Mp4DurationExtractor,
    &MkvDurationExtractor,
];

pub fn get_duration<T: AsRef<Path>>(path: T) -> Option<Duration> {
    let path_ref = path.as_ref();
    let extension = path_ref.extension()?.to_str()?;

    EXTRACTORS
        .iter()
        .find(|extractor| extractor.supports_ext(&extension.to_lowercase()))
        .and_then(|extractor| {
            extractor
                .try_read_duration(path_ref)
                .unwrap_or_default()
        })
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
+                result = Ok(apply_minus(column_expr, left_result));
             }
         } else {
             result = Ok(Variant::empty(VariantType::Int));
@@ -2822,6 +2839,22 @@ mod tests {
         );
     }
 
+    #[test]
+    fn unary_minus_negates_parens_fields_and_functions() {
+        let tmp = std::env::temp_dir().join("fselect_test_unary_minus");
+        let _ = fs::remove_dir_all(&tmp);
+        fs::create_dir_all(&tmp).unwrap();
+        fs::write(tmp.join("x.txt"), "12345").unwrap();
+
+        let rows = run_query_against_dir(
+            "select -(1+2), -abs(3), size, -size, -(-1) from __DIR__ where name = 'x.txt'",
+            &tmp,
+        );
+
+        let _ = fs::remove_dir_all(&tmp);
+        assert_eq!(rows, vec![String::from("-3\t-3\t5\t-5\t1")]);
+    }
+
     #[test]
     fn subquery_with_correlated_from_subselect_is_not_cacheable() {
         use crate::lexer::Lexer;
```

---

### Incident Patch 2: `f17384d2` (2026-07-05)
**Commit Message**: build date literals without local round-trip

**File**: `src/util/datetime.rs` (modified, +16/-13)
```diff
@@ -1,7 +1,7 @@
 use std::sync::{LazyLock, Mutex};
 use std::time::{SystemTime, UNIX_EPOCH};
 
-use chrono::{DateTime, Duration, Local, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Timelike, Utc};
+use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
 use chrono_english::{parse_date_string, Dialect};
 use regex::Regex;
 
@@ -81,24 +81,19 @@ pub fn parse_datetime(s: &str) -> Result<(NaiveDateTime, NaiveDateTime), String>
                 }
             }
 
-            match Local.with_ymd_and_hms(year, month, day, 0, 0, 0) {
-                LocalResult::Single(date) => {
-                    let base = date.naive_local();
-                    let start = base
-                        .with_hour(hour_start)
-                        .and_then(|d| d.with_minute(min_start))
-                        .and_then(|d| d.with_second(sec_start));
-                    let finish = base
-                        .with_hour(hour_finish)
-                        .and_then(|d| d.with_minute(min_finish))
-                        .and_then(|d| d.with_second(sec_finish));
+            // Build the naive datetime directly: a Local round-trip would fail on
+            // DST-skipped or ambiguous midnights while adding nothing to the result
+            match NaiveDate::from_ymd_opt(year, month, day) {
+                Some(date) => {
+                    let start = date.and_hms_opt(hour_start, min_start, sec_start);
+                    let finish = date.and_hms_opt(hour_finish, min_finish, sec_finish);
 
                     match (start, finish) {
                         (Some(s), Some(f)) => Ok((s, f)),
                         _ => Err("Error parsing date/time value: ".to_string() + s),
                     }
                 }
-                _ => Err("Error converting date/time to local: ".to_string() + s),
+                None => Err("Error parsing date/time value: ".to_string() + s),
             }
         }
         None => {
@@ -267,6 +262,14 @@ mod tests {
         assert_eq!(result.unwrap_err(), "Error parsing date/time value: invalid-date");
     }
 
+    #[test]
+    fn test_parse_invalid_calendar_date() {
+        // Genuinely invalid dates must still error after dropping the Local round-trip
+        assert!(parse_datetime("2023-02-30").is_err());
+        assert!(parse_datetime("2023-13-01").is_err());
+        assert!(parse_datetime("2023-04-31").is_err());
+    }
+
     #[test]
     fn test_parse_out_of_range_time() {
         assert!(parse_datetime("2024-01-01 25:00:00").is_err());
```

---

### Incident Patch 3: `91b07d3b` (2026-07-05)
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
+        // MySQL returns an empty string for a non-positive length, not an error
+        let result = get_value(&function, function_arg, function_args, entry, &file_info);
+        assert_eq!(result.unwrap().to_string(), "");
+    }
+
+    #[test]
+    fn function_substring_zero_length() {
+        let function = Function::Substring;
+        let function_arg = String::from("hello world");
+        let function_args = vec![String::from("7"), String::from("0")];
+        let entry = None;
+        let file_info = None;
+
+        let result = get_value(&function, function_arg, function_args, entry, &file_info);
+        assert_eq!(result.unwrap().to_string(), "");
+    }
+
     #[test]
     fn function_replace() {
         let function = Function::Replace;
@@ -2259,6 +2299,19 @@ mod tests {
         assert_eq!(result.unwrap().to_int(), 0);
     }
 
+    #[test]
+    fn function_date_diff_ignores_time_parts() {
+        let function = Function::DateDiff;
+        let function_arg = Str
```

---

### Incident Patch 4: `5eb8894e` (2026-07-05)
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

### Incident Patch 5: `bffcfb22` (2026-07-05)
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

### Incident Patch 6: `17ce46b6` (2026-07-05)
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

### Incident Patch 7: `9a59d602` (2026-07-05)
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
                     && !self.current_apply_gitignore
                     && !self.current_apply_hgignore
                     && !self.current_apply_dockerignore
+                    && !self.current_follow_symlinks
                     && self.try_visit_with_plocate(&self.current_root_dir.clone())?
                 {
                     continue;
@@ -749,9 +767,11 @@ impl<'a> Searcher<'a> {
 
         // The buffer holds limit + offset rows; the offset rows are skipped
         // only in the print path, so they must be skipped here as well.
+        // Strip only the row terminator: file names may legally end in spaces
+        // or tabs, and a mangled name would silently drop the row later.
         let result_values = sub_searcher.output_buffer.iter_values()
             .skip(query.offset as usize)
-            .map(|s| s.trim_end().to_string())
+            .map(|s| s.trim_end_matches(['\r', '\n']).to_string())
             .collect::<Vec<String>>();
 
         if ok_to_cache {
@@ -2802,6 +2822,24 @@ mod tests {
         );
 
```

---

### Incident Patch 8: `6805b875` (2026-07-05)
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
+                                match self.parse_expr()? {
+                                    Some(group_field) => group_by_fields.push(group_field),
+                                    None => break,
+                                }
+                            }
+                        }
+                        Some(Lexeme::Open) | Some(Lexeme::CurlyOpen) => {
                             self.drop_lexeme();
                             match self.parse_expr()? {
                                 Some(group_field) => group_by_fields.push(group_field),
@@ -1167,19 +1201,42 @@ impl <'a> Parser<'a> {
                             let actual_field = match ordering_field.parse::<usize>() {
                                 Ok(idx) if idx >= 1 && idx <= fields.len() => fields[idx - 1].clone(),
                                 Ok(_) => return Err(String::from("Order by field index is out of range")),
-                                _ => {
-                                    self.drop_l
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
+        let mut config = Config::default();
+        config.debug = true;
+
+        let rows = run_query_against_dir_with_config(
+            "select name from __DIR__ depth 1 where exists (select name from __DIR__ depth 1 where name eq 'one.txt')",
+            &tmp,
+            config,
+        );
+
+        let _ = fs::remove_dir_all(&tmp);
+        let names: HashSet<String> = rows.into_iter().collect();
+        assert!(names.contains("one.txt"), "names was {:?}", names);
+        assert!(names.contains("two.txt"), "names was {:?}", names);
+    }
+
     #[test]
     fn from_subselect_returns_inner_paths_as_input_rows() {
         let tmp = std::env::temp_dir().join("fselect_test_from_subselect_basic");
```

---

### Incident Patch 9: `6db09c15` (2026-07-02)
**Commit Message**: avoid slice panic in everything index path

**File**: `src/searcher.rs` (modified, +5/-1)
```diff
@@ -147,7 +147,11 @@ fn expr_walk_external_alias(expr: &Expr, own: &HashSet<String>) -> bool {
 fn external_index_depth(path: &Path, root_prefix: &str) -> Option<u32> {
     let s = path.to_string_lossy();
     let under = if cfg!(windows) {
-        s.len() >= root_prefix.len() && s[..root_prefix.len()].eq_ignore_ascii_case(root_prefix)
+        // Compare bytes: a string slice could panic if the paths diverge in
+        // the middle of a multibyte character. A byte-wise ASCII-case match
+        // also guarantees the prefix ends on a char boundary in `s`.
+        s.len() >= root_prefix.len()
+            && s.as_bytes()[..root_prefix.len()].eq_ignore_ascii_case(root_prefix.as_bytes())
     } else {
         s.starts_with(root_prefix)
     };
```

---

### Incident Patch 10: `03b20fae` (2026-07-02)
**Commit Message**: distinguish sub-second audio from unknown duration

**File**: `src/util/audio.rs` (modified, +5/-4)
```diff
@@ -84,12 +84,13 @@ pub fn get_audio_info(path: &Path) -> Option<AudioInfo> {
     let tagged_file = read_from_path(path).ok()?;
 
     let properties = tagged_file.properties();
-    let duration = properties.duration().as_secs();
+    let duration = properties.duration();
 
     let mut info = AudioInfo {
-        // A zero duration means lofty could not determine it; surface that as
-        // an absent value rather than a misleading 0.
-        duration: (duration > 0).then_some(duration as usize),
+        // An exactly-zero duration means lofty could not determine it;
+        // surface that as an absent value rather than a misleading 0. A
+        // sub-second clip still reports 0 whole seconds.
+        duration: (!duration.is_zero()).then(|| duration.as_secs() as usize),
         bitrate: properties.audio_bitrate().or_else(|| properties.overall_bitrate()),
         sample_rate: properties.sample_rate(),
         ..Default::default()
```

---

### Incident Patch 11: `218a6efc` (2026-07-02)
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

### Incident Patch 12: `8402461e` (2026-07-02)
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

### Incident Patch 13: `ef6a73e0` (2026-07-02)
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
+        let regex = convert_hgignore_glob("a|b*", Path::new("C:\\repo")).unwrap();
+        assert!(!regex.is_match("C:\\repo\\ab.txt"), "| should not alternate");
+    }
+
+    #[cfg(windows)]
+    #[test]
+    fn glob_double_star_slash_matches_zero_dirs_windows() {
+        let regex = convert_hgignore_glob("**/foo", Path::new("C:\\repo")).unwrap();
+        assert!(regex.is_match("C:\\repo\\foo"), "**/ should match zero dirs");
+        assert!(regex.is_match("C:\\repo\\a\\b\\foo"), "**/ should match many dirs");
+    }
+
     #[cfg(not(windows))]
     #[test]
     fn regexp_caret_anchored_includes_separator() {
```

---

### Incident Patch 14: `49508d73` (2026-06-26)
**Commit Message**: fix correlated subquery dependency collection

**File**: `src/expr.rs` (modified, +45/-3)
```diff
@@ -316,11 +316,22 @@ impl Expr {
     pub fn get_fields_required_in_subqueries(&self, alias: &str, parent_subquery: bool) -> HashMap<Field, String> {
         let mut result = HashMap::new();
 
-        if let Some(ref subquery) = self.subquery
-            && let Some(ref expr) = subquery.expr {
+        if let Some(ref subquery) = self.subquery {
+            // A correlated subquery can reference an outer field from any of its
+            // clauses, not just WHERE: ORDER BY and GROUP BY exprs are evaluated
+            // per inner row too, so their outer-alias references must also be
+            // propagated via record_context.
+            if let Some(ref expr) = subquery.expr {
                 result.extend(expr.get_fields_required_in_subqueries(alias, true));
             }
-        
+            for ordering_expr in &subquery.ordering_fields {
+                result.extend(ordering_expr.get_fields_required_in_subqueries(alias, true));
+            }
+            for grouping_expr in &subquery.grouping_fields {
+                result.extend(grouping_expr.get_fields_required_in_subqueries(alias, true));
+            }
+        }
+
         if let Some(ref left) = self.left {
             result.extend(left.get_fields_required_in_subqueries(alias, parent_subquery));
         }
@@ -982,4 +993,35 @@ mod tests {
         let map = expr.right.unwrap().subquery.unwrap().expr.unwrap().left.unwrap().right.unwrap().subquery.unwrap().expr.unwrap().get_fields_required_in_subqueries("t1", false);
         assert!(map.is_empty(), "Expected no required fields for t1 in correlated subquery");
     }
+
+    #[test]
+    fn correlated_order_by_in_subquery_collects_parent_fields() {
+        // The subquery's ONLY reference to the outer alias `t1` lives in its
+        // ORDER BY clause. The dependency walk must still surface `t1.size` so
+        // the outer row's value is propagated to the subquery via
+        // record_context; otherwise the ordering reads an empty value.
+        let expr = parse_where_expr(
+            "select t1.name from /t1 as t1 where t1.size = (select t2.size from /t2 as t2 order by abs(t2.size - t1.size) limit 1)"
+        );
+        let map = expr.get_fields_required_in_subqueries("t1", false);
+        assert_eq!(
+            map,
+            HashMap::from([(Field::Size, String::from("Size"))]),
+            "ORDER BY correlation on t1.size must be collected, got: {:?}", map
+        );
+    }
+
+    #[test]
+    fn correlated_group_by_in_subquery_collects_parent_fields() {
+        // Same as above, but the outer-alias reference lives in GROUP BY.
+        let expr = parse_where_expr(
+            "select t1.name from /t1 as t1 where t1.size = (select max(t2.size) from /t2 as t2 group by abs(t2.size - t1.size) limit 1)"
+        );
+        let map = expr.get_fields_required_in_subqueries("t1", false);
+        assert_eq!(
+            map,
+            HashMap::from([(Field::Size, String::from("Size"))]),
+            "GROUP BY correlation on t1.size must be collected, got: {:?}", map
+        );
+    }
 }
\ No newline at end of file
```

**File**: `src/searcher.rs` (modified, +236/-4)
```diff
@@ -106,6 +106,8 @@ fn is_subquery_cacheable(query: &Query) -> bool {
         .collect();
     !expr_references_external_alias(&query.expr, &own_aliases)
         && query.fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
+        && query.ordering_fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
+        && query.grouping_fields.iter().all(|e| !expr_walk_external_alias(e, &own_aliases))
 }
 
 fn expr_references_external_alias(expr: &Option<Expr>, own: &HashSet<String>) -> bool {
@@ -348,12 +350,30 @@ impl<'a> Searcher<'a> {
         for root in roots {
             self.current_follow_symlinks = root.options.symlinks;
             self.current_alias = root.options.alias.clone();
-            self.subquery_required_fields = match (&self.current_alias, &self.query.expr) {
-                (Some(alias), Some(expr)) => {
-                    let fields = expr.get_fields_required_in_subqueries(alias, false);
+            self.subquery_required_fields = match &self.current_alias {
+                Some(alias) => {
+                    // A correlated subquery can sit in any outer clause — the
+                    // SELECT list, WHERE, ORDER BY, or GROUP BY — so snapshot the
+                    // outer fields it consumes from all of them. Mirrors the
+                    // coverage of is_subquery_cacheable, which inspects the same
+                    // clauses; otherwise a SELECT-list (or ORDER BY) correlation
+                    // would never reach record_context.
+                    let mut fields = HashMap::new();
+                    for column_expr in &self.query.fields {
+                        fields.extend(column_expr.get_fields_required_in_subqueries(alias, false));
+                    }
+                    if let Some(ref expr) = self.query.expr {
+                        fields.extend(expr.get_fields_required_in_subqueries(alias, false));
+                    }
+                    for ordering_expr in &self.query.ordering_fields {
+                        fields.extend(ordering_expr.get_fields_required_in_subqueries(alias, false));
+                    }
+                    for grouping_expr in &self.query.grouping_fields {
+                        fields.extend(grouping_expr.get_fields_required_in_subqueries(alias, false));
+                    }
                     if fields.is_empty() { None } else { Some(fields) }
                 }
-                _ => None,
+                None => None,
             };
 
             if let Some(ref inner) = root.subquery {
@@ -2706,6 +2726,68 @@ mod tests {
         assert!(is_subquery_cacheable(&subquery));
     }
 
+    #[test]
+    fn subquery_correlated_via_order_by_is_not_cacheable() {
+        // The subquery's WHERE and SELECT are independent of the outer row, but
+        // its ORDER BY references `t1.size`. Memoising it would reuse the first
+        // outer row's ordering for every subsequent row.
+        let mut t1_size = Expr::field(Field::Size);
+        t1_size.root_alias = Some(String::from("t1"));
+        let ordering = Expr::arithmetic_op(
+            Expr::field(Field::Size),
+            crate::operators::ArithmeticOp::Subtract,
+            t1_size,
+        );
+
+        let subquery = Query {
+            fields: vec![Expr::field(Field::Name)],
+            roots: vec![Root::new(String::from("/t2"), RootOptions::new())],
+            expr: None,
+            grouping_fields: Vec::new(),
+            ordering_fields: vec![ordering],
+            ordering_asc: vec![true],
+            limit: 0,
+            offset: 0,
+            output_format: OutputFormat::Tabs,
+            raw_query: String::new(),
+        };
+
+        assert!(
+            !is_subquery_cacheable(&subquery),
+            "subquery whose ORDER BY references outer alias t1 must not be cached"
+        );
+    }
+
+    #[test]
+    fn subquery_correlated_via_group_by_is_not_cacheable() {
+        // Same, but the outer-alias reference lives in GROUP BY.
+        let mut t1_size = Expr::field(Field::Size);
+        t1_size.root_alias = Some(String::from("t1"));
+        let grouping = Expr::arithmetic_op(
+            Expr::field(Field::Size),
+            crate::operators::ArithmeticOp::Subtract,
+            t1_size,
+        );
+
+        let subquery = Query {
+            fields: vec![Expr::function(Function::Max)],
+            roots: vec![Root::new(String::from("/t2"), RootOptions::new())],
+            expr: None,
+            grouping_fields: vec![grouping],
+            ordering_fields: Vec::new(),
+            ordering_asc: Vec::new(),
+            limit: 0,
+            offset: 0,
+            output_format: OutputFormat::Tabs,
+            raw_query: String::new(),
+        };
+
+        assert!(
+            !is_subquery_cacheable(&subquery),
+            "subquery whose GROUP BY references outer alias t1 must not be cached"
+        );
+    }
+
     /// Build a real Query via the parser+lexer and execut
```

---

### Incident Patch 15: `413ec4de` (2026-06-11)
**Commit Message**: fix dockerignore and hgignore syntax

**File**: `src/ignore/docker.rs` (modified, +71/-5)
```diff
@@ -170,15 +170,21 @@ fn convert_dockerignore_glob(glob: &str, file_path: &Path) -> Result<Regex, Stri
         return Err("Error parsing .dockerignore pattern: ".to_string() + glob);
     }
 
-    let trimmed = pattern.trim_start_matches(['/', '\\']);
-    if trimmed.len() != pattern.len() {
-        pattern = trimmed.to_string();
-    }
+    // Patterns are relative to the context root; leading and trailing
+    // separators carry no meaning.
+    pattern = pattern
+        .trim_start_matches(['/', '\\'])
+        .trim_end_matches('/')
+        .to_string();
 
     if pattern.is_empty() {
         return Err("Error parsing .dockerignore pattern: ".to_string() + glob);
     }
 
+    // `**/` matches any number of leading directories, including none
+    // (the `.*` token can only originate from `**`).
+    pattern = pattern.replace(".*/", "(?:.*/)?");
+
     #[cfg(windows)]
     let path = file_path
         .to_string_lossy()
@@ -189,7 +195,14 @@ fn convert_dockerignore_glob(glob: &str, file_path: &Path) -> Result<Regex, Stri
     #[cfg(not(windows))]
     let path = file_path.to_string_lossy().to_string();
 
-    pattern = regex::escape(&path).add("/([^/]+/)*").add(&pattern);
+    // Docker patterns are anchored at the context root (the directory holding
+    // the .dockerignore) rather than floating to any depth, and a pattern that
+    // matches a directory also excludes everything beneath it.
+    let pattern = String::from("^")
+        .add(&regex::escape(&path))
+        .add("/")
+        .add(&pattern)
+        .add("(?:/.*)?$");
 
     Regex::new(&pattern).map_err(|_| "Error creating regex pattern: ".to_string() + pattern.as_str())
 }
@@ -261,6 +274,59 @@ mod tests {
         );
     }
 
+    #[test]
+    fn pattern_matches_whole_component_not_prefix() {
+        let filter = convert_dockerignore_pattern("foo", Path::new("/ctx")).unwrap();
+        assert!(filter.regex.is_match("/ctx/foo"));
+        assert!(
+            filter.regex.is_match("/ctx/foo/sub/file.txt"),
+            "a matched directory excludes its subtree"
+        );
+        assert!(
+            !filter.regex.is_match("/ctx/foobar"),
+            "pattern must not match by prefix"
+        );
+    }
+
+    #[test]
+    fn pattern_is_anchored_to_context_root() {
+        let filter = convert_dockerignore_pattern("foo", Path::new("/ctx")).unwrap();
+        assert!(
+            !filter.regex.is_match("/ctx/a/foo"),
+            "plain patterns are root-relative in Docker, not any-depth"
+        );
+        assert!(
+            !filter.regex.is_match("/other/ctx/foo"),
+            "pattern must not match under a different root"
+        );
+    }
+
+    #[test]
+    fn doublestar_matches_any_depth_including_root() {
+        let filter = convert_dockerignore_pattern("**/foo", Path::new("/ctx")).unwrap();
+        assert!(filter.regex.is_match("/ctx/foo"), "`**/` includes zero directories");
+        assert!(filter.regex.is_match("/ctx/a/b/foo"));
+        assert!(!filter.regex.is_match("/ctx/a/foobar"));
+    }
+
+    #[test]
+    fn star_does_not_cross_separators() {
+        let filter = convert_dockerignore_pattern("*.md", Path::new("/ctx")).unwrap();
+        assert!(filter.regex.is_match("/ctx/readme.md"));
+        assert!(
+            !filter.regex.is_match("/ctx/sub/readme.md"),
+            "`*.md` matches only at the context root in Docker"
+        );
+    }
+
+    #[test]
+    fn trailing_slash_matches_directory_and_contents() {
+        let filter = convert_dockerignore_pattern("build/", Path::new("/ctx")).unwrap();
+        assert!(filter.regex.is_match("/ctx/build"));
+        assert!(filter.regex.is_match("/ctx/build/out/app.bin"));
+        assert!(!filter.regex.is_match("/ctx/builder"));
+    }
+
     #[test]
     fn test_all_slashes_pattern_rejected() {
         let result = convert_dockerignore_glob("///", Path::new("/tmp"));
```

**File**: `src/ignore/hg.rs` (modified, +81/-6)
```diff
@@ -184,9 +184,15 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
             return Err("Error parsing .hgignore pattern: ".to_string() + glob);
         }
 
-        pattern = regex::escape(&file_path.to_string_lossy())
+        // Glob patterns are unrooted (they match at any directory level), but
+        // must cover whole path components: like Mercurial itself, a match
+        // ends at a separator or the end of the path, so `foo` matches `foo`
+        // and `foo/bar` but not `foobar`.
+        pattern = String::from("^")
+            .add(&regex::escape(&file_path.to_string_lossy()))
             .add("/([^/]+/)*")
-            .add(&pattern);
+            .add(&pattern)
+            .add("(?:/|$)");
 
         Regex::new(&pattern).map_err(|_| "Error creating regex pattern: ".to_string() + pattern.as_str())
     }
@@ -216,18 +222,25 @@ fn convert_hgignore_glob(glob: &str, file_path: &Path) -> Result<Regex, String>
             return Err("Error parsing .hgignore pattern: ".to_string() + glob);
         }
 
-        pattern = regex::escape(&file_path.to_string_lossy())
+        // See the Unix branch: unrooted, but matches whole path components.
+        pattern = String::from("^")
+            .add(&regex::escape(&file_path.to_string_lossy()))
             .add("\\\\([^\\\\]+\\\\)*")
-            .add(&pattern);
+            .add(&pattern)
+            .add("(?:\\\\|$)");
 
         Regex::new(&pattern).map_err(|_| "Error creating regex pattern: ".to_string() + pattern.as_str())
     }
 }
 
 fn convert_hgignore_regexp(regexp: &str, file_path: &Path) -> Result<Regex, String> {
+    // Mercurial matches regexp patterns with `re.search` against the
+    // repo-relative path: unanchored unless the pattern starts with `^`.
+    // Only the repository-root prefix is anchored here; no end anchor is
+    // added so the user's regex keeps full control.
     #[cfg(not(windows))]
     {
-        let mut pattern = regex::escape(&file_path.to_string_lossy());
+        let mut pattern = String::from("^") + &regex::escape(&file_path.to_string_lossy());
         if !regexp.starts_with("^") {
             pattern = pattern.add("/([^/]+/)*");
             pattern = pattern.add(".*");
@@ -242,7 +255,7 @@ fn convert_hgignore_regexp(regexp: &str, file_path: &Path) -> Result<Regex, Stri
 
     #[cfg(windows)]
     {
-        let mut pattern = regex::escape(&file_path.to_string_lossy());
+        let mut pattern = String::from("^") + &regex::escape(&file_path.to_string_lossy());
         if !regexp.starts_with("^") {
             pattern = pattern.add("\\\\([^\\\\]+\\\\)*");
             pattern = pattern.add(".*");
@@ -375,6 +388,68 @@ mod tests {
         assert!(regex.is_match("C:\\repo\\src/main.rs"), "^-anchored pattern should match");
     }
 
+    #[cfg(not(windows))]
+    #[test]
+    fn glob_matches_whole_component_not_prefix() {
+        let regex = convert_hgignore_glob("foo", Path::new("/repo")).unwrap();
+        assert!(regex.is_match("/repo/foo"));
+        assert!(regex.is_match("/repo/sub/foo"), "hg globs are unrooted");
+        assert!(
+            regex.is_match("/repo/foo/inner.txt"),
+            "a matched directory covers its contents"
+        );
+        assert!(!regex.is_match("/repo/foobar"), "must not match by prefix");
+    }
+
+    #[cfg(not(windows))]
+    #[test]
+    fn glob_repo_prefix_is_start_anchored() {
+        let regex = convert_hgignore_glob("foo", Path::new("/repo")).unwrap();
+        assert!(
+            !regex.is_match("/elsewhere/repo/foo"),
+            "repo prefix must match from the start of the path"
+        );
+    }
+
+    #[cfg(not(windows))]
+    #[test]
+    fn regexp_repo_prefix_is_start_anchored() {
+        let regex = convert_hgignore_regexp("foo", Path::new("/repo")).unwrap();
+        assert!(regex.is_match("/repo/x/myfoo.txt"), "re.search semantics within the repo");
+        assert!(!regex.is_match("/elsewhere/repo/x/foo"));
+    }
+
+    #[cfg(windows)]
+    #[test]
+    fn glob_matches_whole_component_not_prefix_windows() {
+        let regex = convert_hgignore_glob("foo", Path::new("C:\\repo")).unwrap();
+        assert!(regex.is_match("C:\\repo\\foo"));
+        assert!(regex.is_match("C:\\repo\\sub\\foo"), "hg globs are unrooted");
+        assert!(
+            regex.is_match("C:\\repo\\foo\\inner.txt"),
+            "a matched directory covers its contents"
+        );
+        assert!(!regex.is_match("C:\\repo\\foobar"), "must not match by prefix");
+    }
+
+    #[cfg(windows)]
+    #[test]
+    fn glob_repo_prefix_is_start_anchored_windows() {
+        let regex = convert_hgignore_glob("foo", Path::new("C:\\repo")).unwrap();
+        assert!(
+            !regex.is_match("X:\\zzzC:\\repo\\foo"),
+            "repo prefix must match from the start of the path"
+        );
+    }
+
+    #[cfg(windows)]
+    #[test]
+    fn regexp_repo_prefix_is_start_anchored_windows() {
+        let regex = convert_hgign
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
