# Forensic Learning Record (Deep Inspection): aome510/spotify-player

> **Canonical Artifact**: `07_PROJECT_LEARNING/aome510-spotify-player-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aome510/spotify-player](https://github.com/aome510/spotify-player))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:30.093Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aome510/spotify-player`
- **Description**: A Spotify player in the terminal with full feature parity
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 7266 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `spotify_player/src/state/constant.rs`
```
pub use super::*;
use std::sync::LazyLock;

pub const USER_TOP_TRACKS_URI: &str = "tracks:user-top-tracks";
pub const USER_RECENTLY_PLAYED_TRACKS_URI: &str = "tracks:user-recently-played-tracks";
pub const USER_LIKED_TRACKS_URI: &str = "tracks:user-liked-tracks";

pub static USER_TOP_TRACKS_ID: LazyLock<TracksId> =
    LazyLock::new(|| TracksId::new(USER_TOP_TRACKS_URI, "Top Tracks"));

pub static USER_RECENTLY_PLAYED_TRACKS_ID: LazyLock<TracksId> =
    LazyLock::new(|| TracksId::new(USER_RECENTLY_PLAYED_TRACKS_URI, "Recently Played Tracks"));

pub static USER_LIKED_TRACKS_ID: LazyLock<TracksId> =
    LazyLock::new(|| TracksId::new(USER_LIKED_TRACKS_URI, "Liked Tracks"));

```

### Core Architecture Module: `spotify_player/src/state/data.rs`
```
use std::io::{BufReader, BufWriter};
use std::{collections::HashMap, path::Path};

use serde::{de::DeserializeOwned, Serialize};
use std::sync::LazyLock;

use super::model::{
    Album, Artist, Category, Context, ContextId, Id, Playlist, PlaylistFolderItem,
    PlaylistFolderNode, SearchResults, Show, Track,
};
use super::Lyrics;

pub type DataReadGuard<'a> = parking_lot::RwLockReadGuard<'a, AppData>;

#[derive(Debug, Copy, Clone)]
pub enum FileCacheKey {
    Playlists,
    PlaylistFolders,
    FollowedArtists,
    SavedShows,
    SavedAlbums,
    SavedTracks,
}

/// default time-to-live cache duration
pub static TTL_CACHE_DURATION: LazyLock<std::time::Duration> =
    LazyLock::new(|| std::time::Duration::from_hours(1));

/// the application's data
pub struct AppData {
    pub user_data: UserData,
    pub caches: MemoryCaches,
    pub browse: BrowseData,
}

#[derive(Debug)]
/// current user's data
pub struct UserData {
    pub user: Option<rspotify::model::PrivateUser>,
    pub playlists: Vec<PlaylistFolderItem>,
    pub playlist_folder_node: Option<PlaylistFolderNode>,
    pub followed_artists: Vec<Artist>,
    pub saved_shows: Vec<Show>,
    pub saved_albums: Vec<Album>,
    pub saved_tracks: HashMap<String, Track>,
}

#[derive(Debug)]
pub enum SearchCacheEntry {
    Loading,
    Ready(SearchResults),
    Failed,
}

/// the application's in-memory caches
pub struct MemoryCaches {
    pub context: ttl_cache::TtlCache<String, Context>,
    pub search: ttl_cache::TtlCache<String, SearchCacheEntry>,
    pub lyrics: ttl_cache::TtlCache<String, Option<Lyrics>>,
    pub genres: ttl_cache::TtlCache<String, Vec<String>>,
    #[cfg(feature = "image")]
    pub images: ttl_cache::TtlCache<String, image::DynamicImage>,
}

#[derive(Default, Debug)]
/// Spotify browse data
pub struct BrowseData {
    pub categories: Option<Vec<Category>>,
    pub category_playlists: HashMap<String, Vec<Playlist>>,
}

impl MemoryCaches {
    pub fn new() -> Self {
        Self {
            context: ttl_cache::TtlCache::new(64),
            search: ttl_cache::TtlCache::new(64),
            lyrics: ttl_cache::TtlCache::new(64),
            genres: ttl_cache::TtlCache::new(64),
            #[cfg(feature = "image")]
            images: ttl_cache::TtlCache::new(64),
        }
    }

    pub fn begin_search(&mut self, query: &str) -> bool {
        let should_begin = matches!(
            self.search.get(query),
            None | Some(SearchCacheEntry::Failed)
        );

        if should_begin {
            self.search.insert(
                query.to_string(),
                SearchCacheEntry::Loading,
                *TTL_CACHE_DURATION,
            );
        }

        should_begin
    }

    pub fn complete_search(&mut self, query: String, results: SearchResults) {
        self.search
            .insert(query, SearchCacheEntry::Ready(results), *TTL_CACHE_DURATION);
    }

    pub fn fail_search(&mut self, query: String) {
        if matches!(self.search.get(&query), Some(SearchCacheEntry::Loading)) {
            self.search
                .insert(query, SearchCacheEntry::Failed, *TTL_CACHE_DURATION);
        }
    }

    pub fn search_results(&self, query: &str) -> Option<&SearchResults> {
        match self.search.get(query) {
            Some(SearchCacheEntry::Ready(results)) => Some(results),
            _ => None,
        }
    }
}

impl AppData {
    pub fn new(cache_folder: &Path) -> Self {
        Self {
            user_data: UserData::new_from_file_caches(cache_folder),
            caches: MemoryCaches::new(),
            browse: BrowseData::default(),
        }
    }

    /// Get a list of tracks inside a given context
    pub fn context_tracks_mut(&mut self, id: &ContextId) -> Option<&mut Vec<Track>> {
        let c = self.caches.context.get_mut(&id.uri())?;

        Some(match c {
            Context::Album { tracks, .. }
            | Context::Playlist { tracks, .. }
            | Context::Tracks { tracks, .. }
            | Context::Artist {
                top_tracks: tracks, ..
            } => tracks,
            Context::Show { .. } => {
                return None;
            }
        })
    }

    pub fn context_tracks(&self, id: &ContextId) -> Option<&Vec<Track>> {
        let c = self.caches.context.get(&id.uri())?;
        Some(match c {
            Context::Album { tracks, .. }
            | Context::Playlist { tracks, .. }
            | Context::Tracks { tracks, .. }
            | Context::Artist {
                top_tracks: tracks, ..
            } => tracks,
            Context::Show { .. } => {
                return None;
            }
        })
    }
}

impl UserData {
    /// Construct a new user data based on file caches
    pub fn new_from_file_caches(cache_folder: &Path) -> Self {
        Self {
            user: None,
            playlists: load_data_from_file_cache(FileCacheKey::Playlists, cache_folder)
                .unwrap_or_default(),
            playlist_folder_node: load_data_from_file_cache(
                FileCacheKey::PlaylistFolders,
                cache_folder,
            ),
            followed_artists: load_data_from_file_cache(
                FileCacheKey::FollowedArtists,
                cache_folder,
            )
            .unwrap_or_default(),
            saved_shows: load_data_from_file_cache(FileCacheKey::SavedShows, cache_folder)
                .unwrap_or_default(),
            saved_albums: load_data_from_file_cache(FileCacheKey::SavedAlbums, cache_folder)
                .unwrap_or_default(),
            saved_tracks: load_data_from_file_cache(FileCacheKey::SavedTracks, cache_folder)
                .unwrap_or_default(),
        }
    }

    /// Get a list of playlist items that are **possibly** modifiable by user
    ///
    /// If `folder_id` is provided, returns items in the given folder id.
    /// Otherwise, returns the all items.
    pub fn modifiable_playlist_items(&self, folder_id: Option<usize>) -> Vec<&PlaylistFolderItem> {
        match self.user {
            None => vec![],
            Some(ref u) => self
                .playlists
                .iter()
                // filter items in a folder (if specified)
                .filter(|item| {
                    if let Some(folder_id) = folder_id {
                        match item {
                            PlaylistFolderItem::Playlist(p) => p.current_folder_id == folder_id,
                            PlaylistFolderItem::Folder(f) => f.current_id == folder_id,
                        }
                    } else {
                        true
                    }
                })
                // filter modifiable items
                .filter(|item| match item {
                    PlaylistFolderItem::Playlist(p) => p.owner.1 == u.id || p.collaborative,
                    PlaylistFolderItem::Folder(_) => true,
                })
                .collect(),
        }
    }

    /// Get playlists items for the given folder id
    pub fn folder_playlists_items(&self, folder_id: usize) -> Vec<&PlaylistFolderItem> {
        self.playlists
            .iter()
            .filter(|item| match item {
                PlaylistFolderItem::Playlist(p) => p.current_folder_id == folder_id,
                PlaylistFolderItem::Folder(f) => f.current_id == folder_id,
            })
            .collect()
    }

    /// Check if a track is a liked track
    pub fn is_liked_track(&self, track: &Track) -> bool {
        self.saved_tracks.contains_key(&track.id.uri())
    }

    /// Get the user's liked tracks by the given artist, sorted by liked date (newest first)
    pub fn liked_tracks_by_artist(&self, artist: &Artist) -> Vec<Track> {
        let mut tracks: Vec<Track> = self
            .saved_tracks
            .values()
            .filter(|t| t.artists.iter().any(|a| a.id == artist.id))
            .cloned()
            .collect();
        tracks.sort_by_key(|t| std::cmp::Reverse(t.added_at));
        tracks
    }

    /// Check if a playlist is followed
    pub fn is_followed_playlist(&self, playlist: &Playlist) -> bool {
        self.playlists.iter().any(|x| match x {
            PlaylistFolderItem::Playlist(p) => p.id == playlist.id,
            PlaylistFolderItem::Folder(_) => false,
        })
    }
}

pub fn store_data_into_file_cache<T: Serialize>(
    key: FileCacheKey,
    cache_folder: &Path,
    data: &T,
) -> std::io::Result<()> {
    let path = cache_folder.join(format!("{key:?}_cache.json"));
    let f = BufWriter::new(std::fs::File::create(path)?);
    serde_json::to_writer(f, data)?;
    Ok(())
}

pub fn load_data_from_file_cache<T>(key: FileCacheKey, cache_folder: &Path) -> Option<T>
where
    T: DeserializeOwned,
{
    let path = cache_folder.join(format!("{key:?}_cache.json"));
    if path.exists() {
        tracing::info!("Loading {key:?} data from {}...", path.display());
        let f = BufReader::new(std::fs::File::open(path).expect("path exists"));
        match serde_json::from_reader(f) {
            Ok(data) => {
                tracing::info!("Successfully loaded {key:?} data!");
                Some(data)
            }
            Err(err) => {
                tracing::error!("Failed to load {key:?} data: {err:#}");
                None
            }
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{MemoryCaches, SearchCacheEntry, SearchResults};

    #[test]
    fn search_lifecycle_suppresses_duplicate_requests() {
        let mut caches = MemoryCaches::new();

        assert!(caches.begin_search("query"));
        assert!(matches!(
            caches.search.get("query"),
            Some(SearchCacheEntry::Loading)
        ));
        assert!(!caches.begin_search("query"));

        caches.complete_search("query".to_string(), SearchResults::default());

        assert!(caches.search_results("query").is_some());
        assert!(!caches.begin_search("query"));
    }

    #[test]
    fn failed_search_can_be_retried() {
        let mut c
```

### Core Architecture Module: `spotify_player/src/state/mod.rs`
```
mod constant;
mod data;
mod model;
mod player;
mod queue;
mod ui;

use std::{collections::VecDeque, sync::Arc};

pub use constant::*;
pub use data::*;
pub use model::*;
pub use player::*;
#[allow(unused_imports)]
pub use queue::*;
pub use ui::*;

use crate::config;

pub use parking_lot::{Mutex, RwLock};

/// Application's shared state
pub type SharedState = Arc<State>;

/// Application's state
pub struct State {
    pub ui: Mutex<UIState>,
    pub player: RwLock<PlayerState>,
    pub data: RwLock<AppData>,

    pub is_daemon: bool,

    /// Shared FFT frequency-band data written by the audio sink and read by the UI.
    /// `Some` only when `enable_audio_visualization` is `true`; avoids allocating
    /// the mutex/state entirely when the feature is not in use.
    #[cfg(feature = "streaming")]
    pub vis_bands: Option<Arc<Mutex<crate::ui::streaming::VisBands>>>,

    pub logs: Arc<Mutex<VecDeque<String>>>,
}

impl State {
    pub fn new(is_daemon: bool, log_buffer: Arc<Mutex<VecDeque<String>>>) -> Self {
        let mut ui = UIState::default();
        let configs = config::get_config();

        if let Some(theme) = configs.theme_config.find_theme(&configs.app_config.theme) {
            // update the UI's theme based on the `theme` config option
            ui.theme = theme;
        }

        let app_data = AppData::new(&configs.cache_folder);

        Self {
            ui: Mutex::new(ui),
            player: RwLock::new(PlayerState::default()),
            data: RwLock::new(app_data),
            is_daemon,
            #[cfg(feature = "streaming")]
            vis_bands: if configs.app_config.enable_audio_visualization {
                Some(Arc::new(Mutex::new(
                    crate::ui::streaming::VisBands::default(),
                )))
            } else {
                None
            },

            logs: log_buffer,
        }
    }

    #[cfg(feature = "streaming")]
    pub fn is_streaming_enabled(&self) -> bool {
        let configs = config::get_config();
        configs.app_config.enable_streaming == config::StreamingType::Always
            || (configs.app_config.enable_streaming == config::StreamingType::DaemonOnly
                && self.is_daemon)
    }

    /// Returns `true` when the custom queue system should be used for new playback.
    ///
    /// Requires streaming to be enabled and the `custom_queue` config option
    /// to be `true`.
    #[cfg(feature = "streaming")]
    #[allow(dead_code)]
    pub fn should_use_custom_queue(&self) -> bool {
        self.is_streaming_enabled() && config::get_config().app_config.custom_queue
    }

    /// Returns `true` when the local librespot player is actively streaming
    /// audio (i.e. a `Playing` event has been received and no `Paused` / `stop`
    /// has occurred since).  Used by the UI to decide whether to allocate and
    /// render the audio-visualization area.
    #[cfg(feature = "streaming")]
    pub fn is_local_streaming_active(&self) -> bool {
        self.vis_bands.as_ref().is_some_and(|b| b.lock().is_active)
    }
}

```

### Core Architecture Module: `spotify_player/src/state/model.rs`
```
use crate::config;
use crate::ui::utils::to_bidi_string;
use crate::utils::map_join;
use html_escape::decode_html_entities;
pub use rspotify::model::{
    AlbumId, ArtistId, EpisodeId, Id, PlayableId, PlaylistId, ShowId, TrackId, UserId,
};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::fmt::{Display, Write};

/// A trait similar to Display but with bidirectional text support
pub trait BidiDisplay: Display {
    fn to_bidi_string(&self) -> String {
        let disp_str = self.to_string();
        to_bidi_string(&disp_str)
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(untagged)]
/// A Spotify context (playlist, album, artist)
pub enum Context {
    Playlist {
        playlist: Playlist,
        tracks: Vec<Track>,
    },
    Album {
        album: Album,
        tracks: Vec<Track>,
    },
    Artist {
        artist: Artist,
        top_tracks: Vec<Track>,
        albums: Vec<Album>,
        related_artists: Vec<Artist>,
    },
    Tracks {
        tracks: Vec<Track>,
        desc: String,
    },
    Show {
        show: Show,
        episodes: Vec<Episode>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TracksId {
    pub uri: String,
    pub kind: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
/// A context Id
pub enum ContextId {
    Playlist(PlaylistId<'static>),
    Album(AlbumId<'static>),
    Artist(ArtistId<'static>),
    Tracks(TracksId),
    Show(ShowId<'static>),
}

/// Data used to start a new playback.
/// There are two ways to start a new playback:
/// - Specify the playing context ID with an offset
/// - Specify the list of track IDs with an offset
///
/// An offset can be either a track's URI or its absolute offset in the context
#[derive(Clone, Debug)]
pub enum Playback {
    Context(ContextId, Option<rspotify::model::Offset>),
    URIs(Vec<PlayableId<'static>>, Option<rspotify::model::Offset>),
}

#[derive(Default, Clone, Debug, Deserialize, Serialize)]
/// Data returned when searching a query using Spotify APIs.
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub artists: Vec<Artist>,
    pub albums: Vec<Album>,
    pub playlists: Vec<Playlist>,
    pub shows: Vec<Show>,
    pub episodes: Vec<Episode>,
}

#[derive(Debug)]
/// A track order
pub enum TrackOrder {
    AddedAt,
    TrackName,
    Album,
    Artists,
    Duration,
}

#[derive(Debug, Clone)]
/// A Spotify item (track, album, artist, playlist)
pub enum Item {
    Track(Track),
    Album(Album),
    Artist(Artist),
    Playlist(Playlist),
    Show(Show),
}

#[derive(Debug, Clone)]
pub enum ItemId {
    Track(TrackId<'static>),
    Album(AlbumId<'static>),
    Artist(ArtistId<'static>),
    Playlist(PlaylistId<'static>),
    Show(ShowId<'static>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlaybackMetadata {
    pub device_name: String,
    pub device_id: Option<String>,
    pub volume: Option<u32>,
    pub is_playing: bool,
    pub repeat_state: rspotify::model::RepeatState,
    pub shuffle_state: bool,
    pub mute_state: Option<u32>,
}

#[derive(Debug, Clone)]
/// A Spotify device
pub struct Device {
    pub id: String,
    pub name: String,
    /// Whether this device is the integrated librespot player of *this* running instance.
    ///
    /// Used to distinguish the current app's integrated device from other `spotify-player`
    /// instances (which may share the same device name) running elsewhere.
    pub is_integrated: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify track
pub struct Track {
    pub id: TrackId<'static>,
    pub name: String,
    pub artists: Vec<Artist>,
    pub album: Option<Album>,
    pub duration: std::time::Duration,
    pub explicit: bool,
    #[serde(skip)]
    pub added_at: u64,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify album
pub struct Album {
    pub id: AlbumId<'static>,
    pub release_date: String,
    pub name: String,
    pub artists: Vec<Artist>,
    pub typ: Option<rspotify::model::AlbumType>,
    pub added_at: u64,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify artist
pub struct Artist {
    pub id: ArtistId<'static>,
    pub name: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify playlist
pub struct Playlist {
    pub id: PlaylistId<'static>,
    pub collaborative: bool,
    pub name: String,
    pub owner: (String, UserId<'static>),
    pub desc: String,
    /// which folder id the playlist refers to
    #[serde(default)]
    pub current_folder_id: usize,
    pub snapshot_id: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify show (podcast)
pub struct Show {
    pub id: ShowId<'static>,
    pub name: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A Spotify episode (podcast episode)
pub struct Episode {
    pub id: EpisodeId<'static>,
    pub name: String,
    pub description: String,
    pub duration: std::time::Duration,
    pub show: Option<Show>,
    pub release_date: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
/// A playlist folder, not related to Spotify API yet
pub struct PlaylistFolder {
    pub name: String,
    /// current folder id in the folders tree
    pub current_id: usize,
    /// target folder id it refers to
    pub target_id: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
/// A playlist folder item
pub enum PlaylistFolderItem {
    Playlist(Playlist),
    Folder(PlaylistFolder),
}

#[derive(Deserialize, Debug, Clone)]
/// A reference node retrieved by running <https://github.com/mikez/spotify-folders>
/// Helps building a playlist folder hierarchy
pub struct PlaylistFolderNode {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default)]
    pub uri: String,
    #[serde(default = "Vec::new")]
    pub children: Vec<PlaylistFolderNode>,
}

#[derive(Clone, Debug, PartialEq)]
/// A Spotify category
pub struct Category {
    pub id: String,
    pub name: String,
}

impl Context {
    /// gets the context's description
    pub fn description(&self) -> String {
        match self {
            Context::Album {
                ref album,
                ref tracks,
            } => format!(
                "{} | {} | {} songs | {}",
                album.name,
                album.release_date,
                tracks.len(),
                play_time(tracks),
            ),
            Context::Playlist {
                ref playlist,
                tracks,
            } => format!(
                "{} | {} | {} songs | {}",
                playlist.name,
                playlist.owner.0,
                tracks.len(),
                play_time(tracks),
            ),
            Context::Artist { ref artist, .. } => artist.name.clone(),
            Context::Tracks { desc, tracks } => {
                format!("{} | {} songs | {}", desc, tracks.len(), play_time(tracks))
            }
            Context::Show {
                ref show,
                ref episodes,
            } => format!("{} | {} episodes", show.name, episodes.len()),
        }
    }
}

fn play_time(tracks: &[Track]) -> String {
    let duration = tracks
        .iter()
        .map(|t| t.duration)
        .sum::<std::time::Duration>();

    let mut output = String::new();

    let seconds = duration.as_secs() % 60;
    let minutes = (duration.as_secs() / 60) % 60;
    let hours = duration.as_secs() / 3600;

    if hours > 0 {
        write!(output, "{hours}h ").unwrap();
    }

    if minutes > 0 {
        write!(output, "{minutes}m ").unwrap();
    }

    write!(output, "{seconds}s").unwrap();

    output
}

impl ContextId {
    pub fn uri(&self) -> String {
        match self {
            Self::Album(id) => id.uri(),
            Self::Artist(id) => id.uri(),
            Self::Playlist(id) => id.uri(),
            Self::Tracks(id) => id.uri.clone(),
            Self::Show(id) => id.uri(),
        }
    }
}

impl TrackOrder {
    pub fn compare(&self, x: &Track, y: &Track) -> std::cmp::Ordering {
        match *self {
            Self::AddedAt => x.added_at.cmp(&y.added_at),
            Self::TrackName => x.name.cmp(&y.name),
            Self::Album => x.album_info().cmp(&y.album_info()),
            Self::Duration => x.duration.cmp(&y.duration),
            Self::Artists => x.artists_info().cmp(&y.artists_info()),
        }
    }
}

impl Device {
    /// tries to convert from a `rspotify::model::Device` into `Device`
    pub fn try_from_device(device: rspotify::model::Device) -> Option<Self> {
        Some(Self {
            id: device.id?,
            name: device.name,
            is_integrated: false,
        })
    }
}

impl Track {
    /// gets the track's artists information
    pub fn artists_info(&self) -> String {
        map_join(&self.artists, |a| &a.name, ", ")
    }

    /// gets the track's album information
    pub fn album_info(&self) -> String {
        self.album
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_default()
    }

    /// gets the track's name, including an explicit label
    pub fn display_name(&self) -> Cow<'_, str> {
        if self.explicit {
            Cow::Owned(format!(
                "{} {}",
                self.name,
                config::get_config().app_config.explicit_icon
            ))
        } else {
            Cow::Borrowed(self.name.as_str())
        }
    }

    /// tries to convert from a `rspotify::model::SimplifiedTrack` into `Track`
    pub fn try_from_simplified_track(track: rspotify::model::SimplifiedTrack) -> Option<Self> {
        if track.is_playable.unwrap_or(true) {
            #[allow(deprecated)]
            let id = match track.linked_from {
                Some(d) => d.id?,
                None => track.id?,
            };
            Some(Self {
                id,
                name: track.name,
                artists: from_simplified_artists_to_artists(track.artists),
                album: None,
                duration: track.duration.
```

### Core Architecture Module: `spotify_player/src/state/player.rs`
```
use super::model::{
    AlbumId, ArtistId, ContextId, Device, PlaybackMetadata, PlaylistId, ShowId, TracksId,
};
use super::queue::CustomQueue;

/// Player state
#[derive(Default, Debug)]
pub struct PlayerState {
    pub devices: Vec<Device>,

    pub playback: Option<rspotify::model::CurrentPlaybackContext>,
    pub playback_last_updated_time: Option<std::time::Instant>,
    /// A buffered state to speedup the feedback of playback metadata update to user
    // Related issue: https://github.com/aome510/spotify-player/issues/109
    pub buffered_playback: Option<PlaybackMetadata>,

    pub queue: Option<rspotify::model::CurrentUserQueue>,

    /// The currently playing Tracks context (for contexts not tracked by Spotify's playback, e.g. liked/top tracks)
    pub currently_playing_tracks_id: Option<TracksId>,

    /// App-managed custom queue for full playlist/album playback.
    /// Active when the integrated librespot player is streaming and the user
    /// started playback from a track-table context.
    pub custom_queue: Option<CustomQueue>,
}

impl PlayerState {
    /// Get the current playback
    ///
    /// # Note
    /// Because playback metadata stored inside the player state is buffered,
    /// the returned playback is estimated based on the available data.
    pub fn current_playback(&self) -> Option<rspotify::model::CurrentPlaybackContext> {
        let mut playback = self.playback.clone()?;

        // update the playback's progress based on the `playback_last_updated_time`
        playback.progress = playback.progress.map(|d| {
            d + if playback.is_playing {
                chrono::Duration::from_std(self.playback_last_updated_time.unwrap().elapsed())
                    .unwrap()
            } else {
                chrono::Duration::zero()
            }
        });

        // update the playback's metadata based on the `buffered_playback` metadata
        if let Some(ref p) = self.buffered_playback {
            playback.device.name.clone_from(&p.device_name);
            playback.device.id.clone_from(&p.device_id);
            playback.is_playing = p.is_playing;
            playback.device.volume_percent = p.volume;
            playback.repeat_state = p.repeat_state;
            playback.shuffle_state = p.shuffle_state;
        }

        Some(playback)
    }

    pub fn currently_playing(&self) -> Option<&rspotify::model::PlayableItem> {
        self.playback.as_ref().and_then(|p| p.item.as_ref())
    }

    pub fn playback_progress(&self) -> Option<chrono::Duration> {
        match self.playback {
            None => None,
            Some(ref playback) => {
                let progress = playback.progress.unwrap()
                    + if playback.is_playing {
                        chrono::Duration::from_std(
                            self.playback_last_updated_time.unwrap().elapsed(),
                        )
                        .ok()?
                    } else {
                        chrono::Duration::zero()
                    };
                Some(progress)
            }
        }
    }

    pub fn playing_context_id(&self) -> Option<ContextId> {
        match self.playback {
            Some(ref playback) => match playback.context {
                Some(ref context) => {
                    let uri = crate::utils::parse_uri(&context.uri);
                    match context._type {
                        rspotify::model::Type::Playlist => Some(ContextId::Playlist(
                            PlaylistId::from_uri(&uri).ok()?.into_static(),
                        )),
                        rspotify::model::Type::Album => Some(ContextId::Album(
                            AlbumId::from_uri(&uri).ok()?.into_static(),
                        )),
                        rspotify::model::Type::Artist => Some(ContextId::Artist(
                            ArtistId::from_uri(&uri).ok()?.into_static(),
                        )),
                        rspotify::model::Type::Show => {
                            Some(ContextId::Show(ShowId::from_uri(&uri).ok()?.into_static()))
                        }
                        _ => None,
                    }
                }
                None => self
                    .custom_queue
                    .as_ref()
                    .and_then(|q| q.source_context().cloned())
                    .or_else(|| {
                        self.currently_playing_tracks_id
                            .clone()
                            .map(ContextId::Tracks)
                    }),
            },
            None => None,
        }
    }
}

```

### Core Architecture Module: `spotify_player/src/state/queue.rs`
```
use rand::seq::SliceRandom;
use std::time::Instant;

use super::model::{ContextId, PlayableId};

/// Result of advancing the queue by one track.
#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum AdvanceResult {
    /// The next track is still within the current batch — librespot handles it.
    SameBatch,
    /// The current batch is exhausted; here is the next batch of track URIs to
    /// send via `StartPlayback`.
    NewBatch(Vec<PlayableId<'static>>),
    /// The queue has reached the end and `autoplay` is enabled — the caller
    /// should fetch radio tracks and append them before continuing.
    NeedsRadioTracks,
    /// The queue is fully exhausted and autoplay is not enabled.
    EndOfQueue,
}

/// Result of retreating the queue by one track.
#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum RetreatResult {
    /// The previous track is still within the current batch.
    SameBatch,
    /// Need to load the previous batch to reach the previous track.
    PreviousBatch(Vec<PlayableId<'static>>),
    /// Already at the very beginning of the queue.
    BeginningOfQueue,
}

/// Shuffle mode for the custom queue.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ShuffleMode {
    #[default]
    Off,
    /// Standard shuffle — randomize the full track order.
    Shuffle,
    /// Smart shuffle — shuffle + interleave radio recommendations.
    /// Carries the radio tracks used for interleaving.
    SmartShuffle(Vec<PlayableId<'static>>),
}

/// App-managed playback queue that replaces spirc-managed queueing.
///
/// The custom queue stores the **full** ordered track list for a context
/// (playlist, album, etc.) and sends batches of URIs to Spotify. It only
/// intervenes at batch boundaries — within a batch, librespot handles
/// next/previous natively.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct CustomQueue {
    /// Original ordered track list (from the context, respecting client-side sort).
    original_tracks: Vec<PlayableId<'static>>,
    /// The effective play order.
    /// When shuffle is off this is a clone of `original_tracks`; when on it's a
    /// permutation. When smart-shuffle is on, extra recommendation track IDs are
    /// interleaved.
    play_order: Vec<PlayableId<'static>>,
    /// Current position within `play_order`.
    position: usize,
    /// Start index (inclusive) of the current batch within `play_order`.
    batch_start: usize,
    /// End index (exclusive) of the current batch within `play_order`.
    /// Tracks `play_order[batch_start..batch_end]` are the current batch.
    /// Normally `batch_end = min(batch_start + max_batch_size, play_order.len())`,
    /// but `truncate_batch_to_current()` can shrink it to `position + 1`.
    batch_end: usize,
    /// Maximum number of tracks per Spotify API batch (= `tracks_playback_limit`).
    max_batch_size: usize,
    /// Original context (for "playing from" display and radio seed).
    source_context: Option<ContextId>,
    /// Local repeat state mirroring the player's repeat.
    repeat: rspotify::model::RepeatState,
    /// Current shuffle mode (Off / Shuffle / `SmartShuffle`).
    shuffle_mode: ShuffleMode,
    /// Whether to fetch and append radio tracks when the queue is exhausted.
    /// Sourced from `DeviceConfig.autoplay`.
    autoplay: bool,
    /// Timestamp of last batch transition, used for consistency-check cooldown.
    last_batch_transition: Option<Instant>,
}

#[allow(dead_code)]
impl CustomQueue {
    /// Create a new custom queue.
    ///
    /// - `tracks`: the full ordered track list (respecting any client-side sort).
    /// - `start_position`: index of the track the user selected to play first.
    /// - `max_batch_size`: maximum tracks per Spotify batch (typically `tracks_playback_limit`).
    /// - `source_context`: the originating context (playlist, album, etc.) for
    ///   "playing from" display and radio seed.
    /// - `autoplay`: whether to fetch radio tracks when the queue is exhausted
    ///   (sourced from device config).
    pub fn new(
        tracks: Vec<PlayableId<'static>>,
        start_position: usize,
        max_batch_size: usize,
        source_context: Option<ContextId>,
        autoplay: bool,
    ) -> Self {
        let play_order = tracks.clone();
        let batch_start = start_position;
        let batch_end = (batch_start + max_batch_size).min(play_order.len());

        Self {
            original_tracks: tracks,
            play_order,
            position: start_position,
            batch_start,
            batch_end,
            max_batch_size,
            source_context,
            repeat: rspotify::model::RepeatState::Off,
            shuffle_mode: ShuffleMode::Off,
            autoplay,
            last_batch_transition: None,
        }
    }

    // ── Accessors ──────────────────────────────────────────────────────

    /// The track URIs that make up the current batch sent to Spotify.
    pub fn current_batch(&self) -> &[PlayableId<'static>] {
        &self.play_order[self.batch_start..self.batch_end]
    }

    /// The currently playing track.
    pub fn current_track(&self) -> &PlayableId<'static> {
        &self.play_order[self.position]
    }

    /// All tracks after the current position (for queue UI display).
    pub fn remaining_tracks(&self) -> &[PlayableId<'static>] {
        if self.position + 1 >= self.play_order.len() {
            &[]
        } else {
            &self.play_order[self.position + 1..]
        }
    }

    /// The source context this queue was built from.
    pub fn source_context(&self) -> Option<&ContextId> {
        self.source_context.as_ref()
    }

    /// Current shuffle mode.
    pub fn shuffle_mode(&self) -> &ShuffleMode {
        &self.shuffle_mode
    }

    /// Current repeat state.
    pub fn repeat(&self) -> rspotify::model::RepeatState {
        self.repeat
    }

    /// Current position within the play order.
    pub fn position(&self) -> usize {
        self.position
    }

    /// Batch start index.
    pub fn batch_start(&self) -> usize {
        self.batch_start
    }

    /// Batch end index (exclusive).
    pub fn batch_end(&self) -> usize {
        self.batch_end
    }

    /// Total number of tracks in the queue.
    pub fn len(&self) -> usize {
        self.play_order.len()
    }

    /// Whether the queue is empty.
    pub fn is_empty(&self) -> bool {
        self.play_order.is_empty()
    }

    /// Timestamp of last batch transition (for consistency-check cooldown).
    pub fn last_batch_transition(&self) -> Option<Instant> {
        self.last_batch_transition
    }

    /// The expected next track in the play order (if any and within the batch).
    /// Used for queue consistency checking.
    pub fn expected_next_track(&self) -> Option<&PlayableId<'static>> {
        let next = self.position + 1;
        if next < self.batch_end {
            Some(&self.play_order[next])
        } else {
            None
        }
    }

    /// Whether the current track is the last in the current batch.
    pub fn is_at_batch_end(&self) -> bool {
        self.position + 1 >= self.batch_end
    }

    /// Whether the current track is the first in the current batch.
    pub fn is_at_batch_start(&self) -> bool {
        self.position == self.batch_start
    }

    // ── Mutations ──────────────────────────────────────────────────────

    /// Advance to the next track. Returns what action the caller should take.
    ///
    /// This is called from the `EndOfTrack` handler — it is the **sole**
    /// mechanism for advancing position.
    pub fn advance(&mut self) -> AdvanceResult {
        let next = self.position + 1;

        // RepeatState::Track — don't advance; librespot loops the track.
        if self.repeat == rspotify::model::RepeatState::Track {
            return AdvanceResult::SameBatch;
        }

        if next < self.batch_end {
            // Still within the current batch.
            self.position = next;
            AdvanceResult::SameBatch
        } else if next < self.play_order.len() {
            // Current batch exhausted but more tracks remain — start next batch.
            self.position = next;
            self.batch_start = next;
            self.batch_end = (self.batch_start + self.max_batch_size).min(self.play_order.len());
            self.mark_batch_transition();
            AdvanceResult::NewBatch(self.current_batch().to_vec())
        } else if self.repeat == rspotify::model::RepeatState::Context {
            // End of queue with repeat-context — wrap to beginning.
            self.position = 0;
            self.batch_start = 0;
            self.batch_end = self.max_batch_size.min(self.play_order.len());
            self.mark_batch_transition();
            AdvanceResult::NewBatch(self.current_batch().to_vec())
        } else if self.autoplay {
            // End of queue, no repeat — autoplay is enabled, ask caller to
            // fetch radio tracks and append them.
            AdvanceResult::NeedsRadioTracks
        } else {
            AdvanceResult::EndOfQueue
        }
    }

    /// Retreat to the previous track. Returns what action the caller should take.
    pub fn retreat(&mut self) -> RetreatResult {
        if self.position == 0 {
            if self.repeat == rspotify::model::RepeatState::Context {
                // Wrap to end of queue.
                self.position = self.play_order.len().saturating_sub(1);
                self.batch_end = self.play_order.len();
                self.batch_start = self.batch_end.saturating_sub(self.max_batch_size);
                self.mark_batch_transition();
                RetreatResult::PreviousBatch(self.current_batch().to_vec())
            } else {
                RetreatResult::BeginningOfQueue
            }
        } else {
            let prev = self.position - 1;
            if prev >= self.batch_start {
                self.position = prev;
                Ret
```

### Core Architecture Module: `spotify_player/src/state/ui/mod.rs`
```
use crate::{
    config::{self, Theme},
    key,
    ui::{self, Orientation},
    utils::filtered_items_from_query,
};

#[cfg(feature = "image")]
use crate::ui::cover_image::CoverImage;
#[cfg(feature = "image")]
use ratatui_image::picker::Picker;

pub type UIStateGuard<'a> = parking_lot::MutexGuard<'a, UIState>;

mod page;
mod popup;

pub use page::*;
pub use popup::*;

#[cfg(feature = "image")]
#[derive(Default)]
pub struct ImageRenderInfo {
    pub url: String,
    pub render_area: ratatui::layout::Rect,
    pub state: Option<CoverImage>,
}

#[cfg(feature = "image")]
impl std::fmt::Debug for ImageRenderInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ImageRenderInfo")
            .field("url", &self.url)
            .field("render_area", &self.render_area)
            .field("state", &self.state.is_some())
            .finish()
    }
}

/// Application's UI state
#[derive(Debug)]
pub struct UIState {
    pub is_running: bool,
    pub theme: config::Theme,
    pub input_key_sequence: key::KeySequence,
    pub orientation: ui::Orientation,

    pub history: Vec<PageState>,
    pub popup: Option<PopupState>,

    /// The rectangle representing the playback progress bar,
    /// which is mainly used to handle mouse click events (for seeking command)
    pub playback_progress_bar_rect: ratatui::layout::Rect,

    /// Count prefix for vim-style navigation (e.g., 5j, 10k)
    pub count_prefix: Option<usize>,

    #[cfg(feature = "image")]
    pub last_cover_image_render_info: ImageRenderInfo,

    #[cfg(feature = "image")]
    pub picker: Picker,
}

impl UIState {
    pub fn current_page(&self) -> &PageState {
        self.history.last().expect("non-empty history")
    }

    pub fn current_page_mut(&mut self) -> &mut PageState {
        self.history.last_mut().expect("non-empty history")
    }

    pub fn new_search_popup(&mut self) {
        self.current_page_mut().select(0);
        self.popup = Some(PopupState::Search {
            query: String::new(),
        });
    }

    pub fn new_page(&mut self, page: PageState) {
        self.popup = None;
        if let Some(current_page) = self.history.last() {
            if &page == current_page {
                return;
            }
        }
        self.history.push(page);
    }

    /// Return whether there exists a focused popup.
    ///
    /// Currently, only search popup is not focused when it's opened.
    pub fn has_focused_popup(&self) -> bool {
        match self.popup.as_ref() {
            None => false,
            Some(popup) => !matches!(popup, PopupState::Search { .. }),
        }
    }

    /// Get a list of items possibly filtered by a search query if exists a search popup
    pub fn search_filtered_items<'a, T: std::fmt::Display>(&self, items: &'a [T]) -> Vec<&'a T> {
        match self.popup {
            Some(PopupState::Search { ref query }) => filtered_items_from_query(query, items),
            _ => items.iter().collect::<Vec<_>>(),
        }
    }
}

use ratatui::layout::Rect;

impl Default for UIState {
    fn default() -> Self {
        Self {
            is_running: true,
            theme: Theme::default(),
            input_key_sequence: key::KeySequence { keys: vec![] },
            orientation: match crossterm::terminal::size() {
                Ok((columns, rows)) => ui::Orientation::from_size(columns, rows),
                Err(err) => {
                    tracing::warn!("Unable to get terminal size, error: {err:#}");
                    Orientation::default()
                }
            },

            history: vec![PageState::Library {
                state: LibraryPageUIState::new(),
            }],
            popup: None,

            playback_progress_bar_rect: Rect::default(),

            count_prefix: None,

            #[cfg(feature = "image")]
            last_cover_image_render_info: ImageRenderInfo::default(),

            // Will be reinitialize later in ui/mod.rs after init_ui()
            #[cfg(feature = "image")]
            picker: Picker::halfblocks(),
        }
    }
}

```

### Core Architecture Module: `spotify_player/src/state/ui/page.rs`
```
use crate::{
    state::model::{Category, ContextId},
    ui::single_line_input::LineInput,
};
use ratatui::widgets::{ListState, TableState};

#[derive(Clone, Debug, PartialEq)]
pub enum PageState {
    Library {
        state: LibraryPageUIState,
    },
    Context {
        id: Option<ContextId>,
        context_page_type: ContextPageType,
        state: Option<ContextPageUIState>,
    },
    Search {
        line_input: LineInput,
        current_query: String,
        state: SearchPageUIState,
    },
    Lyrics {
        track_uri: String,
        track: String,
        artists: String,
    },
    Browse {
        state: BrowsePageUIState,
    },
    Queue {
        scroll_offset: usize,
    },
    CommandHelp {
        scroll_offset: usize,
    },
    Logs {
        scroll_offset: usize,
    },
}

#[derive(PartialEq, Eq, Clone, Copy)]
pub enum PageType {
    Library,
    Context,
    Search,
    Browse,
    Lyrics,
    Queue,
    CommandHelp,
    Logs,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LibraryPageUIState {
    pub playlist_list: ListState,
    pub saved_album_list: ListState,
    pub followed_artist_list: ListState,
    pub focus: LibraryFocusState,
    pub playlist_folder_id: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SearchPageUIState {
    pub track_list: ListState,
    pub album_list: ListState,
    pub artist_list: ListState,
    pub playlist_list: ListState,
    pub show_list: ListState,
    pub episode_list: ListState,
    pub focus: SearchFocusState,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ContextPageType {
    CurrentPlaying,
    Browsing(ContextId),
}

#[derive(Clone, Debug, PartialEq)]
pub enum ContextPageUIState {
    Playlist {
        track_table: TableState,
    },
    Album {
        track_table: TableState,
    },
    Artist {
        top_track_table: TableState,
        album_table: TableState,
        related_artist_list: ListState,
        liked_track_table: TableState,
        focus: ArtistFocusState,
    },
    Tracks {
        track_table: TableState,
    },
    Show {
        episode_table: TableState,
    },
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum LibraryFocusState {
    Playlists,
    SavedAlbums,
    FollowedArtists,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum ArtistFocusState {
    TopTracks,
    Albums,
    RelatedArtists,
    LikedSongs,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum SearchFocusState {
    Input,
    Tracks,
    Albums,
    Artists,
    Playlists,
    Shows,
    Episodes,
}

#[derive(Clone, Debug, PartialEq)]
pub enum BrowsePageUIState {
    CategoryList {
        state: ListState,
    },
    CategoryPlaylistList {
        category: Category,
        state: ListState,
    },
}

pub enum MutableWindowState<'a> {
    Table(&'a mut TableState),
    List(&'a mut ListState),
    Scroll(&'a mut usize),
}

impl PageState {
    /// The type of the page.
    pub fn page_type(&self) -> PageType {
        match self {
            PageState::Library { .. } => PageType::Library,
            PageState::Context { .. } => PageType::Context,
            PageState::Search { .. } => PageType::Search,
            PageState::Browse { .. } => PageType::Browse,
            PageState::Lyrics { .. } => PageType::Lyrics,
            PageState::Queue { .. } => PageType::Queue,
            PageState::CommandHelp { .. } => PageType::CommandHelp,
            PageState::Logs { .. } => PageType::Logs,
        }
    }

    /// Select a `id`-th item in the currently focused window of the page.
    pub fn select(&mut self, id: usize) {
        if let Some(mut state) = self.focus_window_state_mut() {
            state.select(id);
        }
    }

    /// The selected item's position in the currently focused window of the page.
    pub fn selected(&mut self) -> Option<usize> {
        self.focus_window_state_mut()
            .map(|state| state.selected())?
    }

    /// The currently focused window state of the page.
    pub fn focus_window_state_mut(&mut self) -> Option<MutableWindowState<'_>> {
        match self {
            Self::Library {
                state:
                    LibraryPageUIState {
                        playlist_list,
                        saved_album_list,
                        followed_artist_list,
                        focus,
                        ..
                    },
            } => Some(match focus {
                LibraryFocusState::Playlists => MutableWindowState::List(playlist_list),
                LibraryFocusState::SavedAlbums => MutableWindowState::List(saved_album_list),
                LibraryFocusState::FollowedArtists => {
                    MutableWindowState::List(followed_artist_list)
                }
            }),
            Self::Search {
                state:
                    SearchPageUIState {
                        track_list,
                        album_list,
                        artist_list,
                        playlist_list,
                        show_list,
                        episode_list,
                        focus,
                    },
                ..
            } => match focus {
                SearchFocusState::Input => None,
                SearchFocusState::Tracks => Some(MutableWindowState::List(track_list)),
                SearchFocusState::Albums => Some(MutableWindowState::List(album_list)),
                SearchFocusState::Artists => Some(MutableWindowState::List(artist_list)),
                SearchFocusState::Playlists => Some(MutableWindowState::List(playlist_list)),
                SearchFocusState::Shows => Some(MutableWindowState::List(show_list)),
                SearchFocusState::Episodes => Some(MutableWindowState::List(episode_list)),
            },
            Self::Context { state, .. } => state.as_mut().map(|state| match state {
                ContextPageUIState::Tracks { track_table }
                | ContextPageUIState::Playlist { track_table } => {
                    MutableWindowState::Table(track_table)
                }
                ContextPageUIState::Album { track_table } => MutableWindowState::Table(track_table),
                ContextPageUIState::Artist {
                    top_track_table,
                    album_table,
                    related_artist_list,
                    liked_track_table,
                    focus,
                } => match focus {
                    ArtistFocusState::TopTracks => MutableWindowState::Table(top_track_table),
                    ArtistFocusState::Albums => MutableWindowState::Table(album_table),
                    ArtistFocusState::RelatedArtists => {
                        MutableWindowState::List(related_artist_list)
                    }
                    ArtistFocusState::LikedSongs => MutableWindowState::Table(liked_track_table),
                },
                ContextPageUIState::Show { episode_table } => {
                    MutableWindowState::Table(episode_table)
                }
            }),
            Self::Browse { state } => match state {
                BrowsePageUIState::CategoryList { state } => Some(MutableWindowState::List(state)),
                BrowsePageUIState::CategoryPlaylistList { state, .. } => {
                    Some(MutableWindowState::List(state))
                }
            },
            Self::Lyrics { .. } => None,
            Self::CommandHelp { scroll_offset }
            | Self::Queue { scroll_offset }
            | Self::Logs { scroll_offset } => Some(MutableWindowState::Scroll(scroll_offset)),
        }
    }
}

impl LibraryPageUIState {
    pub fn new() -> Self {
        Self {
            playlist_list: ListState::default(),
            saved_album_list: ListState::default(),
            followed_artist_list: ListState::default(),
            focus: LibraryFocusState::Playlists,
            playlist_folder_id: 0,
        }
    }
}

impl SearchPageUIState {
    pub fn new() -> Self {
        Self {
            track_list: ListState::default(),
            album_list: ListState::default(),
            artist_list: ListState::default(),
            playlist_list: ListState::default(),
            show_list: ListState::default(),
            episode_list: ListState::default(),
            focus: SearchFocusState::Input,
        }
    }
}

impl ContextPageType {
    pub fn title(&self) -> String {
        match self {
            ContextPageType::CurrentPlaying => String::from("Current Playing"),
            ContextPageType::Browsing(id) => match id {
                ContextId::Playlist(_) => String::from("Playlist"),
                ContextId::Album(_) => String::from("Album"),
                ContextId::Artist(_) => String::from("Artist"),
                ContextId::Tracks(id) => id.kind.clone(),
                ContextId::Show(_) => String::from("Show"),
            },
        }
    }
}

impl ContextPageUIState {
    pub fn new_playlist() -> Self {
        Self::Playlist {
            track_table: TableState::default(),
        }
    }

    pub fn new_album() -> Self {
        Self::Album {
            track_table: TableState::default(),
        }
    }

    pub fn new_artist() -> Self {
        Self::Artist {
            top_track_table: TableState::default(),
            album_table: TableState::default(),
            related_artist_list: ListState::default(),
            liked_track_table: TableState::default(),
            focus: ArtistFocusState::TopTracks,
        }
    }

    pub fn new_tracks() -> Self {
        Self::Tracks {
            track_table: TableState::default(),
        }
    }

    pub fn new_show() -> Self {
        Self::Show {
            episode_table: TableState::default(),
        }
    }
}

impl MutableWindowState<'_> {
    pub fn select(&mut self, id: usize) {
        match self {
            Self::List(state) => state.select(Some(id)),
            Self::Table(state) => state.select(Some(id)),
            Self::Scroll(scroll_offset) => {
   
```

### Core Architecture Module: `spotify_player/src/state/ui/popup.rs`
```
use crate::{
    command,
    state::{
        model::{Album, Artist, Episode, EpisodeId, Playlist, Show, Track, TrackId},
        ItemId,
    },
    ui::single_line_input::LineInput,
};
use ratatui::widgets::ListState;
use rspotify::model::PlaylistId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlaylistCreateCurrentField {
    Name,
    Desc,
}

#[derive(Debug)]
pub enum PopupState {
    Search {
        query: String,
    },
    UserPlaylistList(PlaylistPopupAction, ListState),
    UserFollowedArtistList(ListState),
    UserSavedAlbumList(ListState),
    DeviceList(ListState),
    ArtistList(ArtistPopupAction, Vec<Artist>, ListState),
    ThemeList(Vec<crate::config::Theme>, ListState),
    ActionList(Box<ActionListItem>, ListState),
    PlaylistCreate {
        name: LineInput,
        desc: LineInput,
        current_field: PlaylistCreateCurrentField,
    },
    ConfirmAction {
        message: String,
        action: ConfirmableAction,
    },
}

#[derive(Debug, Clone)]
pub enum ConfirmableAction {
    DeleteTrackFromPlaylist {
        playlist_id: PlaylistId<'static>,
        track_id: TrackId<'static>,
    },
    DeleteFromLibrary(ItemId),
}

#[derive(Debug, Clone)]
pub enum ActionListItem {
    Track(Track, Vec<command::Action>),
    Artist(Artist, Vec<command::Action>),
    Album(Album, Vec<command::Action>),
    Playlist(Playlist, Vec<command::Action>),
    Show(Show, Vec<command::Action>),
    Episode(Episode, Vec<command::Action>),
}

/// An action on an item in a playlist popup list
#[derive(Debug)]
pub enum PlaylistPopupAction {
    Browse {
        folder_id: usize,
        search_query: String,
    },
    AddTrack {
        folder_id: usize,
        track_id: TrackId<'static>,
        search_query: String,
    },
    AddEpisode {
        folder_id: usize,
        episode_id: EpisodeId<'static>,
        search_query: String,
    },
}

/// An action on an item in an artist popup list
#[derive(Copy, Clone, Debug)]
pub enum ArtistPopupAction {
    Browse,
    ShowActions,
}

impl PopupState {
    /// gets the (immutable) list state of a (list) popup
    pub fn list_state(&self) -> Option<&ListState> {
        match self {
            Self::DeviceList(list_state)
            | Self::UserPlaylistList(.., list_state)
            | Self::UserFollowedArtistList(list_state)
            | Self::UserSavedAlbumList(list_state)
            | Self::ArtistList(.., list_state)
            | Self::ThemeList(.., list_state)
            | Self::ActionList(.., list_state) => Some(list_state),
            Self::Search { .. } | Self::PlaylistCreate { .. } | Self::ConfirmAction { .. } => None,
        }
    }

    /// gets the (mutable) list state of a (list) popup
    pub fn list_state_mut(&mut self) -> Option<&mut ListState> {
        match self {
            Self::DeviceList(list_state)
            | Self::UserPlaylistList(.., list_state)
            | Self::UserFollowedArtistList(list_state)
            | Self::UserSavedAlbumList(list_state)
            | Self::ArtistList(.., list_state)
            | Self::ThemeList(.., list_state)
            | Self::ActionList(.., list_state) => Some(list_state),
            Self::Search { .. } | Self::PlaylistCreate { .. } | Self::ConfirmAction { .. } => None,
        }
    }

    /// gets the selected position of a (list) popup
    pub fn list_selected(&self) -> Option<usize> {
        match self.list_state() {
            None => None,
            Some(state) => state.selected(),
        }
    }

    /// selects a position in a (list) popup
    pub fn list_select(&mut self, id: Option<usize>) {
        match self.list_state_mut() {
            None => {}
            Some(state) => state.select(id),
        }
    }
}

impl ActionListItem {
    pub fn n_actions(&self) -> usize {
        match self {
            ActionListItem::Track(.., actions)
            | ActionListItem::Artist(.., actions)
            | ActionListItem::Album(.., actions)
            | ActionListItem::Playlist(.., actions)
            | ActionListItem::Show(.., actions)
            | ActionListItem::Episode(.., actions) => actions.len(),
        }
    }

    pub fn name(&self) -> &str {
        match self {
            ActionListItem::Track(track, ..) => &track.name,
            ActionListItem::Artist(artist, ..) => &artist.name,
            ActionListItem::Album(album, ..) => &album.name,
            ActionListItem::Playlist(playlist, ..) => &playlist.name,
            ActionListItem::Show(show, ..) => &show.name,
            ActionListItem::Episode(episode, ..) => &episode.name,
        }
    }

    pub fn actions_desc(&self) -> Vec<String> {
        match self {
            ActionListItem::Track(.., actions)
            | ActionListItem::Artist(.., actions)
            | ActionListItem::Album(.., actions)
            | ActionListItem::Playlist(.., actions)
            | ActionListItem::Show(.., actions)
            | ActionListItem::Episode(.., actions) => {
                actions.iter().map(|a| format!("{a:?}")).collect::<Vec<_>>()
            }
        }
    }
}

```

### Core Architecture Module: `spotify_player/src/ui/utils.rs`
```
use super::{
    config, Block, BorderType, Borders, Frame, List, ListItem, ListState, Rect, Span, Style, Table,
    TableState,
};
use unicode_bidi::BidiInfo;

/// Construct and render a block.
///
/// This function should only be used to render a window's borders and its title.
/// It returns the rectangle to render the inner widgets inside the block.
pub fn construct_and_render_block(
    title: &str,
    theme: &config::Theme,
    borders: Borders,
    frame: &mut Frame,
    rect: Rect,
) -> Rect {
    let mut title = title.to_string();

    let configs = config::get_config();

    let (borders, border_type) = match configs.app_config.border_type {
        config::BorderType::Hidden | config::BorderType::Plain => (borders, BorderType::Plain),
        config::BorderType::Rounded => (borders, BorderType::Rounded),
        config::BorderType::Double => (borders, BorderType::Double),
        config::BorderType::Thick => (borders, BorderType::Thick),
    };

    let mut block = Block::default()
        .borders(borders)
        .border_style(theme.border())
        .border_type(border_type);

    let inner_rect = block.inner(rect);

    // Handle `BorderType::Hidden` after determining the inner rectangle
    // `Hidden` border can be done by setting the borders to be `NONE`.
    // NOTE: we want to handle the border after the inner rectangle computation,
    // so that paddings between windows are properly determined.
    if configs.app_config.border_type == config::BorderType::Hidden {
        block = block.borders(Borders::NONE);
        // add padding to the title to ensure the inner text is aligned with the title
        title = format!(" {title}");
    }

    // Set `title` for the block
    block = block.title(Span::styled(title, theme.block_title()));

    frame.render_widget(block, rect);
    inner_rect
}

/// Construct a generic list widget
pub fn construct_list_widget<'a>(
    theme: &config::Theme,
    items: Vec<(String, bool)>,
    is_active: bool,
    selected_index: Option<usize>,
) -> (List<'a>, usize) {
    let configs = config::get_config();
    let n_items = items.len();

    (
        List::new(
            items
                .into_iter()
                .enumerate()
                .map(|(i, (s, is_playing))| {
                    let text = if is_active && configs.app_config.enable_relative_line_number {
                        if let Some(selected_index) = selected_index {
                            let diff = (i as isize - selected_index as isize).abs();
                            let width = std::cmp::min(n_items.to_string().len(), 2);
                            format!("{diff:>width$}  {s}")
                        } else {
                            s
                        }
                    } else {
                        s
                    };
                    ListItem::new(text).style(if is_playing {
                        theme.current_playing()
                    } else {
                        Style::default()
                    })
                })
                .collect::<Vec<_>>(),
        )
        .highlight_style(theme.selection(is_active)),
        n_items,
    )
}

/// adjust the `selected` position of a `ListState` if that position is invalid
fn adjust_list_state(state: &mut ListState, len: usize) {
    if let Some(p) = state.selected() {
        if p >= len {
            state.select(if len > 0 { Some(len - 1) } else { Some(0) });
        }
    } else if len > 0 {
        state.select(Some(0));
    }
}

pub fn render_list_window(
    frame: &mut Frame,
    widget: List,
    rect: Rect,
    len: usize,
    state: &mut ListState,
) {
    adjust_list_state(state, len);
    frame.render_stateful_widget(widget, rect, state);
}

/// adjust the `selected` position of a `TableState` if that position is invalid
fn adjust_table_state(state: &mut TableState, len: usize) {
    if let Some(p) = state.selected() {
        if p >= len {
            state.select(if len > 0 { Some(len - 1) } else { Some(0) });
        }
    } else if len > 0 {
        state.select(Some(0));
    }
}

pub fn render_table_window(
    frame: &mut Frame,
    widget: Table,
    rect: Rect,
    len: usize,
    state: &mut TableState,
) {
    adjust_table_state(state, len);
    frame.render_stateful_widget(widget, rect, state);
}

/// Convert a string to a bidirectional string.
/// Used to handle RTL text properly in the UI.
pub fn to_bidi_string(s: &str) -> String {
    let bidi_info = BidiInfo::new(s, None);

    let bidi_string = if bidi_info.has_rtl() && !bidi_info.paragraphs.is_empty() {
        bidi_info
            .reorder_line(&bidi_info.paragraphs[0], 0..s.len())
            .into_owned()
    } else {
        s.to_string()
    };

    bidi_string
}

/// formats genres depending on the number of genres and `genre_num`
///
/// Examples for `genre_num = 2`
/// - 1 genre: "genre1"
/// - 2 genres: "genre1, genre2"
/// - \>= 3 genres: "genre1, genre2, ..."
pub fn format_genres(genres: &[String], genre_num: u8) -> String {
    let mut genre_str = String::with_capacity(64);

    if genre_num > 0 {
        for i in 0..genres.len() {
            genre_str.push_str(&genres[i]);

            if i + 1 != genres.len() {
                genre_str.push_str(", ");

                if i + 1 >= genre_num as usize {
                    genre_str.push_str("...");
                    break;
                }
            }
        }
    }

    genre_str
}

```

### Core Architecture Module: `spotify_player/src/utils.rs`
```
use std::borrow::Cow;

/// formats a time duration into a "{minutes}:{seconds}" format
pub fn format_duration(duration: &chrono::Duration) -> String {
    let secs = duration.num_seconds();
    format!("{}:{:02}", secs / 60, secs % 60)
}

pub fn map_join<T, F>(v: &[T], f: F, sep: &str) -> String
where
    F: Fn(&T) -> &str,
{
    v.iter().map(f).fold(String::new(), |x, y| {
        if x.is_empty() {
            x + y
        } else {
            x + sep + y
        }
    })
}

#[allow(dead_code)]
pub fn get_track_album_image_url(track: &rspotify::model::FullTrack) -> Option<&str> {
    if track.album.images.is_empty() {
        None
    } else {
        Some(&track.album.images[0].url)
    }
}

#[allow(dead_code)]
pub fn get_episode_show_image_url(episode: &rspotify::model::FullEpisode) -> Option<&str> {
    if episode.show.images.is_empty() {
        None
    } else {
        Some(&episode.show.images[0].url)
    }
}

pub fn parse_uri(uri: &str) -> Cow<'_, str> {
    let parts = uri.split(':').collect::<Vec<_>>();
    // The below URI probably has a format of `spotify:user:{user_id}:{type}:{id}`,
    // but `rspotify` library expects to receive an URI of format `spotify:{type}:{id}`.
    // We have to modify the URI to a corresponding format.
    // See: https://github.com/aome510/spotify-player/issues/57#issuecomment-1160868626
    if parts.len() == 5 {
        Cow::Owned([parts[0], parts[3], parts[4]].join(":"))
    } else {
        Cow::Borrowed(uri)
    }
}

#[cfg(feature = "fzf")]
use fuzzy_matcher::skim::SkimMatcherV2;

#[cfg(feature = "fzf")]
pub fn fuzzy_search_items<'a, T: std::fmt::Display>(items: &'a [T], query: &str) -> Vec<&'a T> {
    let matcher = SkimMatcherV2::default();
    let mut result = items
        .iter()
        .filter_map(|t| {
            matcher
                .fuzzy(&t.to_string(), query, false)
                .map(|(score, _)| (t, score))
        })
        .collect::<Vec<_>>();

    result.sort_by(|(_, a), (_, b)| b.cmp(a));
    result.into_iter().map(|(t, _)| t).collect::<Vec<_>>()
}

/// Get a list of items filtered by a search query.
pub fn filtered_items_from_query<'a, T: std::fmt::Display>(
    query: &str,
    items: &'a [T],
) -> Vec<&'a T> {
    let query = query.to_lowercase();

    #[cfg(feature = "fzf")]
    return fuzzy_search_items(items, &query);

    #[cfg(not(feature = "fzf"))]
    items
        .iter()
        .filter(|t| {
            if query.is_empty() {
                true
            } else {
                let t = t.to_string().to_lowercase();
                query
                    .split(' ')
                    .filter(|q| !q.is_empty())
                    .all(|q| t.contains(q))
            }
        })
        .collect::<Vec<_>>()
}

```

### Core Architecture Module: `lyric_finder/examples/lyric-finder.rs`
```
extern crate lyric_finder;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::init();

    let args = std::env::args().collect::<Vec<_>>();

    if args.len() < 2 {
        println!("Please specify the first argument to be the search query");
        std::process::exit(1);
    }

    let client = lyric_finder::Client::new();
    let result = client.get_lyric(&args[1]).await?;
    match result {
        lyric_finder::LyricResult::Some {
            track,
            artists,
            lyric,
        } => {
            println!("{track} by {artists}'s lyric:\n{lyric}");
        }
        lyric_finder::LyricResult::None => {
            println!("lyric not found!");
        }
    }

    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1075** (2026-09-07): **cli commands not working**
  *Symptoms*: First, the client ID was receiving errors which has recently been reported. To resolve this i change to a spotify app client ID i made manually, this resolved that issue. However, when testing I realised these commands dont appear to function anymore:  arch-dell% spotify_player get key user-playlists Bad request: missing field `tracks` at line 1 column 1544 arch-dell% spotify_player get key user-followed-artists Bad request: json parse error: missing field `followers` at line 1 column 726: missing field `followers` at line 1 column 726 arch-dell% cargo install --list | grep -A2 spotify spotify_player v0.24.1:     spotify_player
  **Post-Mortem & Fix Analysis**:
  > Should be resolved with https://github.com/aome510/spotify-player/pull/973

- **Issue #1073** (2026-09-07): **429 API rate limit exceeded**
  *Symptoms*: **Log and backtrace** ``` } 2026-09-03T08:50:06.632707Z ERROR spotify_player::client::handlers: Failed to handle client request: failed to send a Spotify API request https://api.spotify.com/v1/me/albums: {   "error": {     "status": 429,     "message": "API rate limit exceeded"   } } ```   **Environment**  - OS: Macos  - Application version: spotify_player 0.24.1 - Application features: --features image,daemon,rodio-backend,streaming,fzf,notify  
  **Post-Mortem & Fix Analysis**:
  > I think I have the same errors after upgrading to version `0.24.1` on ArchLinux. This is the relevant section of the log obtained at startup  ``` log 11:38:50  INFO spotify_player::auth: Using cached credentials 11:38:50  INFO spotify_player::streaming: Application's connect configurations: ConnectConfig { name: "spotify-player", device_type: Speaker, is_group: false, initial_volume: 45875, disable_volume: false, volume_steps: 64 11:38:50  INFO log: Mixing with softvol and volume control: Log(60.0) 11:38:50  INFO spotify_player::streaming: Initializing a new integrated player with device_id=be3d1316-3db1-47de-88f3-142e068c5d69 11:38:50  INFO spotify_player::streaming: Starting an integrated Spotify player using librespot's spirc protocol 11:38:50  INFO log: Converting with ditherer: tpdf 11:38:50  INFO log: Using PulseAudioSink with format: S16 11:38:50  INFO log: Connecting to AP "ap-gew4.spotify.com:4070" 11:38:51  INFO spotify_player::streaming: New streaming connection has been est
  > Same here: ``` 2026-09-03T11:40:06.020343Z  INFO spotify_player::streaming: New streaming connection has been established! 2026-09-03T11:40:06.020381Z  INFO spotify_player::client: Used a new session for Spotify client. 2026-09-03T11:40:06.216807Z  INFO spotify_player::cli::client: Starting a client socket at 127.0.0.1:8080 2026-09-03T11:40:06.220787Z  INFO spotify_player::media_control: Initializing application's media control event watcher... 2026-09-03T11:40:06.342443Z  INFO librespot_core::spclient: Resolved "gue1-spclient.spotify.com:443" as spclient access point 2026-09-03T11:40:06.491250Z ERROR client_request{request=GetUserSavedAlbums}: spotify_player::client::handlers: Failed to handle client request: failed to send a Spotify API request https://api.spotify.com/v1/me/albums: {   "error": {     "status": 429,     "message": "API rate limit exceeded"   } } 2026-09-03T11:40:06.494420Z ERROR client_request{request=GetUserSavedShows}: spotify_player::client::handlers: Failed to han
  > I also noticed the same thing this morning. Not sure if there is any recent change from Spotify side. I will take a closer look this weekend 👀 

- **Issue #1064** (2026-09-07): **Fix/Workaround: Stuck on loading screen with "missing field" JSON parse errors when using a custom Client ID**
  *Symptoms*: ### Describe the Issue  If you use a custom `client_id` in `app.toml` and find that the player gets permanently stuck on the **"loading"** screen, this is likely caused by Spotify's API schema restrictions on newly created developer apps.  In the logs (`~/.cache/spotify-player/spotify-player-*.log`), you will see repeating JSON deserialization errors like: - `Failed to handle client request: missing field tracks at line 1 column ...` - `Failed to handle client request: missing field popularity at line 1 column ...` - Endless warnings saying `WARN spotify_player::ui::playback: Unknown playback item`  ---  ### Why this happens  When you create a new application in the Spotify Developer Dashboard, it is automatically put in **"Development Mode"**.  In this mode, Spotify's API intentionally restricts or strips metadata fields (such as `tracks`, `popularity`, `followers`, and `available_markets`) from the response payload for any Spotify account that is **not explicitly whitelisted** in the app's settings.   Because `spotify-player` expects these fields to be present, the JSON parser fails and the UI gets stuck in an infinite rendering and retry loop.  ---  ### How to Resolve This (Workaround / Solution)  There are two ways to resolve this issue:  #### Option A: Use the robust default Client ID (Recommended) The built-in default Client ID in newer versions (v0.22.0+) has been updated and completely bypasses rate limits. You don't need a custom Client ID anymore.  1. Open your conf

- **Issue #1055** (2026-09-08): **Compile error: use of unstable library feature `duration_constructors_lite`**
  *Symptoms*: **Describe the bug** Trying to compile/install spotify_player after a long while with the flake in the repo through home manager doesn't compile.  **To Reproduce** Add the repo to flake and compile on nix-unstable  **Expected behaviour** It compiles/installs  **Log and backtrace** ```        >    Compiling spotify_player v0.24.1 (/build/0ai1hasf6pnrqalkr3kwg2n5fzl986nn-source/spotify_player) ┃        > error[E0658]: use of unstable library feature `duration_constructors_lite` ┃        >   --> spotify_player/src/state/data.rs:27:22 ┃        >    | ┃        > 27 |     LazyLock::new(|| std::time::Duration::from_hours(1)); ┃        >    |                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ┃        >    | ┃        >    = note: see issue #140881 <https://github.com/rust-lang/rust/issues/140881> for more information ┃        > ┃        > For more information about this error, try `rustc --explain E0658`. ┃        > error: could not compile `spotify_player` (bin "spotify_player") due to 1 previous error ┃        For full logs, run: ┃          nix log /nix/store/93ykx69nwnxhxwqq5zjrvgzxs52758kz-spotify-player-0.24.1.drv ```  **Environment**  - OS: - Application version: NixOS Unstable

- **Issue #1054** (2026-09-06): **Constant login/auth prompts**
  *Symptoms*: is it normal to get constant redirect to spotify for giving the player permission? I feel recently I get one like every 40-60 mins where the player will freeze and I have to close reopen and accept another prompt and sometimes it will just then revert to loading forever/the UI doesn't load until I delete the cache directory and try again. 
  **Post-Mortem & Fix Analysis**:
  > :( it seems even worse today can't listen for more than 10-15 minutes without seeing a ton of 429 codes in the logs and then I'm basically locked out for a period of time... I guess there isn't much to be done sucks what Spotify did to the API
  > Should be resolved by https://github.com/aome510/spotify-player/pull/1041?
  > Not for me I'm on version 0.24.1 but the app still seems unusable for me. Whenever I delete my `.cache/spotify_player` and go through the auth flow the app will open then just have the loading spinner and hang. When I look at the logs I just see multiple 429 errors.  ```bash 2026-09-06T23:59:51.510093Z ERROR client_request{request=GetUserSavedAlbums}: spotify_player::client::handlers: Failed to handle client request: failed to send a Spotify API request https://api.spotify.com/v1/me/albums: {   "error": {     "status": 429,     "message": "API rate limit exceeded"   } } 2026-09-06T23:59:51.510787Z ERROR client_request{request=GetUserPlaylists}: spotify_player::client::handlers: Failed to handle client request: failed to send a Spotify API request https://api.spotify.com/v1/me/playlists: {   "error": {     "status": 429,     "message": "API rate limit exceeded"   } } 2026-09-06T23:59:51.516987Z ERROR client_request{request=GetUserSavedShows}: spotify_player::client::handlers: Failed to 

- **Issue #1044** (2026-09-07): **401 status code error when track starts to play**
  *Symptoms*: **Describe the bug** 401 and 500 status when a track starts and during playback.  **To Reproduce** Play a track  **Expected behaviour** No errors and no lags in playback  **Log and backtrace** ``` 2026-07-22T02:14:45.352319Z ERROR spotify_player::client: Encountered an error when updating the playback state: http error: status code 401 Unauthorized 2026-07-22T02:14:45.638050Z ERROR client_request{request=GetCurrentUserQueue}: spotify_player::client::handlers: Failed to handle client request: http error: status code 500 Internal Server Error 2026-07-22T02:14:45.986845Z  INFO client_request{request=GetCurrentUserQueue}: spotify_player::client: Successfully handled the client request, took: 412ms 2026-07-22T02:14:46.017544Z  INFO client_request{request=GetCurrentUserQueue}: spotify_player::client: Successfully handled the client request, took: 338ms 2026-07-22T02:14:46.195876Z ERROR spotify_player::client: Encountered an error when updating the playback state: http error: status code 401 Unauthorized 2026-07-22T02:14:46.220802Z  INFO client_request{request=GetCurrentUserQueue}: spotify_player::client: Successfully handled the client request, took: 436ms 2026-07-22T02:14:46.285527Z  INFO client_request{request=GetCurrentUserQueue}: spotify_player::client: Successfully handled the client request, took: 400ms 2026-07-22T02:14:46.443729Z ERROR spotify_player::client: Encountered an error when updating the playback state: http error: status code 401 Unauthorized 2026-07-22T02:14:47.5
  **Post-Mortem & Fix Analysis**:
  > It's also losing the login credentials every other login, when I start the application it immediately takes me to spotify login page for my App ID that I specified.  <img width="4096" height="714" alt="Image" src="https://github.com/user-attachments/assets/edcfff15-35cb-4ca8-8a4c-1781a54b36e4" />  Doing `rm -rf ~/.cache/spotify-player/*.json` and logging back in doesn't really do anything, issue still persists.   Doing `rm -rf ~/.cache/spotify-player/*.json && spotify_player` works for the first time only, when you q->spotify_player again error in the image above happens.  Also randomly playback stops, sometimes it resumes immediately, other times token is apparently expired  <img width="4096" height="1486" alt="Image" src="https://github.com/user-attachments/assets/64c8dac3-9f5c-4b87-8dbb-d5bba46d6ef8" />
  > @sw0ok please ensure you're on the latest release: https://github.com/aome510/spotify-player/releases/tag/v0.24.1 that has fix for invalid token
  > @aome510 my bad, homebrew lags a little behind the development, on 0.24.1 okay so far. 

- **Issue #1040** (2026-07-20): **Token is not valid**
  *Symptoms*: **Describe the bug** - I start the spotify-player and get an error: Token is not valid - After that run spotify-player authenticate.  - Auth success. - Start spotify-player. it's working. In the user_client_token.json modified. The refresh_token changed to null. - quit spotify-player - restart spotify-player. In the log Token is not valid   **Log and backtrace** 2026-07-20T10:59:31.246558Z ERROR spotify_player::client::handlers: Failed to handle client request: Token is not valid 2026-07-20T10:59:31.246847Z ERROR spotify_player::client::handlers: Failed to handle client request: get token: no access token 2026-07-20T10:59:31.246629Z ERROR spotify_player::client::handlers: Failed to handle client request: get token: no access token 2026-07-20T10:59:31.246720Z ERROR spotify_player::client::handlers: Failed to handle client request: get token: no access token 2026-07-20T10:59:31.246775Z ERROR spotify_player::client::handlers: Failed to handle client request: get token: no access token 2026-07-20T10:59:31.246595Z ERROR spotify_player::client::handlers: Failed to handle client request: Token is not valid 2026-07-20T10:59:32.247208Z ERROR spotify_player::client: Failed to retrieve current playback: Token is not valid  I try the token: ``` curl -s -X GET https://api.spotify.com/v1/tracks/7egnccALp7VGYAKjqhipMa -H Accept: application/json -H Content-Type: application/json -H 'Authorization:Bearer xxxxxxxxx' ```  The request success  **Environment**  - OS: MacOS - Application version:
  **Post-Mortem & Fix Analysis**:
  > Seems like Spotify introduced some changes: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration
  > > Seems like Spotify introduced some changes: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration  Oh! I see!  Can I do something to spotify_player working again or need to wait to fix that.
  > For temporary workaround I set System Immutable flag (sudo chflags schg ~/.cache/spotify-player/user_client_token.json) on user_client_token.json. In this case spotify_player cannot rewrite the file and don't need to re-authenticate before every start.

- **Issue #1010** (2026-06-28): **command ToggleFakeTrackRepeatMode not found**
  *Symptoms*: **Describe the bug**  ToggleFakeTrackRepeatMode is no longer available? I really liked this feature, but it seems to have been removed. (works on 0.21.3)  **To Reproduce**  put a keymap in keymap.toml like: ```toml [[keymaps]] command = "ToggleFakeTrackRepeatMode" key_sequence = "r" ```  run spotify_player, get error: ``` Error: TOML parse error at line 6, column 11   | 6 | command = "ToggleFakeTrackRepeatMode"   |           ^^^^^^^^^^^^^^^^^^^^^^^^^^^ unknown variant `ToggleFakeTrackRepeatMode`, expected one of `None`, ... ```  **Expected behaviour**  sp should run and upon pressing r, it should toggle the fake track repeat mode  **Log and backtrace**  not applicable, no log generated, aplication did not run  **Environment**  - OS: Linux archlinux 7.0.11-arch1-1 - Application version: spotify_player 0.23.0 - Application features: pulseaudio-backend,media-control,notify,fzf  **Additional context**  works on 0.21.3 on ubuntu
  **Post-Mortem & Fix Analysis**:
  > `ToggleFakeTrackRepeatMode` is removed. Please remove that from `keymap.toml`. Librespot now supports track repeat natively so we no longer need that workaround mode

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

### Incident Patch 1: `7dc9d17a` (2026-09-19)
**Commit Message**: Add TLS backend features (rustls-tls / native-tls) — fixes auth panic on Termux (#1060)

* Add TLS backend features (rustls-tls / native-tls) to fix auth on Termux

reqwest 0.13's default TLS backend (rustls + rustls-platform-verifier) panics
on aarch64-linux-android targets without a JVM context, which makes every
authentication attempt in Termux die in the token-exchange thread
(rustls/rustls-platform-verifier#219). Gate the backend behind two features:
rustls-tls (in the default set — default builds unchanged) and native-tls
(system TLS via openssl, resolves CAs through standard paths including
Termux's $PREFIX/etc/tls/cert.pem).

Also documents the Termux build (native-tls + pulseaudio backend, since
rodio/cpal's AAudio host hits the same no-JVM panic) in the README.

**File**: `README.md` (modified, +19/-0)
```diff
@@ -88,6 +88,25 @@ A Spotify Premium account is **required**.
     sudo yum install openssl-devel alsa-lib-devel dbus-devel
     ```
 
+##### Termux (Android)
+
+- Two default components require a JVM context that Termux processes don't have:
+  the default TLS backend (`rustls-platform-verifier`, panics during the auth
+  token exchange) and the rodio audio backend (cpal's AAudio host, panics when
+  streaming starts). Build with the `native-tls` feature and the pulseaudio
+  backend instead:
+
+  ```shell
+  pkg install rust openssl pulseaudio
+  cargo install spotify_player --no-default-features --features pulseaudio-backend,media-control,native-tls
+  ```
+
+  This makes authentication, the Web API, and remote device control work. Integrated
+  streaming additionally requires patching librespot's compile-time OS identity
+  (`librespot-core`'s `config::OS`) to `"linux"` via `[patch.crates-io]`, because
+  librespot built for `target_os = "android"` presents the Android-app identity, which
+  Spotify rejects for keymaster-minted credentials.
+
 ### Binaries
 
 Application's prebuilt binaries can be found in the [Releases Page](https://github.com/aome510/spotify-player/releases).
```

**File**: `spotify_player/Cargo.toml` (modified, +10/-2)
```diff
@@ -22,7 +22,7 @@ librespot-metadata = { version = "0.8.0" }
 log = "0.4.34"
 chrono = "0.4.45"
 chrono-humanize = "0.2.3"
-reqwest = { version = "0.12.28", features = ["json", "blocking"] }
+reqwest = { version = "0.12.28", default-features = false, features = ["charset", "http2", "system-proxy", "json", "blocking"] }
 reqwest-middleware = "0.4.2"
 rspotify = {version = "0.16.1", features = ["cli", "reqwest-middleware"] }
 http = "1.5.0"
@@ -107,7 +107,15 @@ notify = ["notify-rust"]
 daemon = ["daemonize", "streaming"]
 fzf = ["fuzzy-matcher"]
 
-default = ["rodio-backend", "media-control"]
+# TLS backend used by the application's HTTP client (auth/token exchange).
+# `rustls-tls` keeps reqwest's default backend (rustls + rustls-platform-verifier).
+# `native-tls` uses the system TLS library (e.g. openssl) instead — needed on
+# platforms where rustls-platform-verifier cannot run, such as Termux (Android
+# target without a JVM, see rustls/rustls-platform-verifier#219).
+rustls-tls = ["reqwest/default-tls"]
+native-tls = ["reqwest/native-tls"]
+
+default = ["rodio-backend", "media-control", "rustls-tls"]
 
 [package.metadata.binstall]
 pkg-url = "{ repo }/releases/download/v{ version }/{ name }-{ target }{ archive-suffix }"
```

---

### Incident Patch 2: `56694558` (2026-09-12)
**Commit Message**: fix selected item handling in filtered lists (#1084)

**File**: `spotify_player/src/event/page.rs` (modified, +1/-0)
```diff
@@ -452,6 +452,7 @@ fn handle_action_for_browse_page(
                 let Some(playlists) = data.browse.category_playlists.get(&category.id) else {
                     return Ok(false);
                 };
+                let playlists = ui.search_filtered_items(playlists);
 
                 let page_state = ui.current_page_mut();
                 let selected = page_state.selected().unwrap_or_default();
```

**File**: `spotify_player/src/event/window.rs` (modified, +39/-26)
```diff
@@ -218,47 +218,57 @@ pub fn handle_command_for_focused_context_window(
 }
 
 /// Handle commands that may modify a playlist
+struct PlaylistTrackSelection<'a> {
+    visible_index: usize,
+    source_index: usize,
+    source_len: usize,
+    track: &'a Track,
+}
+
 fn handle_playlist_modify_command(
-    id: usize,
+    selection: &PlaylistTrackSelection<'_>,
     playlist_id: &PlaylistId<'static>,
     command: Command,
     client_pub: &flume::Sender<ClientRequest>,
-    tracks: &[&Track],
     data: &DataReadGuard,
     ui: &mut UIStateGuard,
 ) -> Result<bool> {
     match command {
         Command::MovePlaylistItemUp => {
-            if id > 0 {
+            if selection.source_index > 0 {
                 client_pub.send(ClientRequest::ReorderPlaylistItems {
                     playlist_id: playlist_id.clone_static(),
-                    insert_index: id - 1,
-                    range_start: id,
+                    insert_index: selection.source_index - 1,
+                    range_start: selection.source_index,
                     range_length: None,
                     snapshot_id: None,
                 })?;
-                ui.current_page_mut().select(id - 1);
+                if !matches!(ui.popup, Some(PopupState::Search { .. })) {
+                    ui.current_page_mut().select(selection.visible_index - 1);
+                }
             }
             return Ok(true);
         }
         Command::MovePlaylistItemDown => {
-            if id + 1 < tracks.len() {
+            if selection.source_index + 1 < selection.source_len {
                 client_pub.send(ClientRequest::ReorderPlaylistItems {
                     playlist_id: playlist_id.clone_static(),
-                    insert_index: id + 1,
-                    range_start: id,
+                    insert_index: selection.source_index + 1,
+                    range_start: selection.source_index,
                     range_length: None,
                     snapshot_id: None,
                 })?;
-                ui.current_page_mut().select(id + 1);
+                if !matches!(ui.popup, Some(PopupState::Search { .. })) {
+                    ui.current_page_mut().select(selection.visible_index + 1);
+                }
             }
             return Ok(true);
         }
         Command::ShowActionsOnSelectedItem => {
-            let mut actions = command::construct_track_actions(tracks[id], data);
+            let mut actions = command::construct_track_actions(selection.track, data);
             actions.push(Action::DeleteFromPlaylist);
             ui.popup = Some(PopupState::ActionList(
-                Box::new(ActionListItem::Track(tracks[id].clone(), actions)),
+                Box::new(ActionListItem::Track(selection.track.clone(), actions)),
                 ListState::default(),
             ));
             return Ok(true);
@@ -283,6 +293,11 @@ fn handle_command_for_track_table_window(
     if id >= filtered_tracks.len() {
         return Ok(false);
     }
+    let selected_track = filtered_tracks[id];
+    let source_index = tracks
+        .iter()
+        .position(|track| std::ptr::eq(track, selected_track))
+        .expect("filtered track should reference the source list");
 
     if let Some(ContextId::Playlist(ref playlist_id)) = context_id {
         let modifiable =
@@ -291,11 +306,15 @@ fn handle_command_for_track_table_window(
             );
         if modifiable
             && handle_playlist_modify_command(
-                id,
+                &PlaylistTrackSelection {
+                    visible_index: id,
+                    source_index,
+                    source_len: tracks.len(),
+                    track: selected_track,
+                },
                 playlist_id,
                 command,
                 client_pub,
-                &filtered_tracks,
                 data,
                 ui,
             )?
@@ -320,7 +339,7 @@ fn handle_command_for_track_table_window(
             let uri = if command == Command::PlayRandom {
                 tracks[rand::rng().random_range(0..tracks.len())].id.uri()
             } else {
-                filtered_tracks[id].id.uri()
+                selected_track.id.uri()
             };
 
             // Update currently_playing_tracks_id based on the context
@@ -350,30 +369,24 @@ fn handle_command_for_track_table_window(
             )))?;
         }
         Command::ShowActionsOnSelectedItem => {
-            let actions = command::construct_track_actions(filtered_tracks[id], data);
+            let actions = command::construct_track_actions(selected_track, data);
             ui.popup = Some(PopupState::ActionList(
-                Box::new(ActionListItem::Track(tracks[id].clone(), actions)),
+                Box::new(ActionListItem::Track(selected_track.clone(), actions)),
                 ListState::default(),
             ));
         }
         Command::AddSelectedItemToQueue => {
             client_pub.send(ClientRe
```

---

### Incident Patch 3: `d7978f60` (2026-09-12)
**Commit Message**: fix playback not transferred correctly upon re-connection

**File**: `spotify_player/src/client/mod.rs` (modified, +3/-2)
```diff
@@ -198,13 +198,16 @@ impl AppClient {
                 // a retry logic is implemented to ensure the application's state is properly initialized
                 let max_retries = 3;
                 for i in 0..max_retries {
+                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
+
                     if let Err(err) = client.retrieve_current_playback(&state, false).await {
                         tracing::error!("Failed to retrieve current playback: {err:#}");
                         return;
                     }
 
                     // if playback exists, don't connect to a new device
                     if state.player.read().playback.is_some() {
+                        tracing::info!("Playback already exists, skipping device connection.");
                         continue;
                     }
 
@@ -244,8 +247,6 @@ impl AppClient {
                             break;
                         }
                     }
-
-                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                 }
             }
         });
```

---

### Incident Patch 4: `c7c88d39` (2026-09-09)
**Commit Message**: render loading UI for search page (#1082)

This PR also removes `search` from default `ncspot_only_get_endpoints`

**File**: `README.md` (modified, +5/-3)
```diff
@@ -222,17 +222,19 @@ The `spotify_player authenticate` command runs every required flow in one go, fo
 
 Every request to the Spotify Web API is attributed to a Spotify _application_, identified by a **client ID**. The client ID — not your account — determines the [API quota](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) you are subject to.
 
-By default, `spotify_player` uses [ncspot](https://github.com/hrkfdn/ncspot)'s client ID. This is intentional: that client ID is registered in [extended quota mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) and predates Spotify's [November 2024 Web API changes](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api). As a result it has a much higher rate limit and access to endpoints (browse, personalized content, generated playlists, …) that newly-registered applications can no longer use.
+By default, `spotify_player` uses [ncspot](https://github.com/hrkfdn/ncspot)'s client ID. This client ID is shared by many users, so its API quota can be exhausted by aggregate usage and cause `429 Too Many Requests` responses. **Registering and configuring your own client ID is strongly recommended** so routine requests use a quota dedicated to your Spotify application.
+
+The ncspot client ID remains available as a fallback because it is registered in [extended quota mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) and predates Spotify's [November 2024 Web API changes](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api). It can access endpoints (browse, personalized content, generated playlists, …) that newly-registered applications can no longer use.
 
 When a custom `client_id` is configured, `spotify-player` sends most Web API requests through that client first. If Spotify rejects custom-client request with any `4xx` response, the request is attempted once through ncspot. Successful requests and failures outside the `4xx` range do not trigger fallback.
 
 The custom client uses no request middleware. The ncspot client stores `Retry-After` durations and retries rate-limited GET requests up to two times by default; mutation requests are never delayed or retried by the middleware. Configure the ncspot retry count with `api_rate_limit_retries`; see the [configuration documentation](https://github.com/aome510/spotify-player/blob/master/docs/config.md) for details.
 
 ### Using a custom client ID
 
-A custom client ID can be used when you prefer requests to be attributed to your own Spotify application. Newly registered applications use restricted default quota mode, so endpoints unavailable to the custom client transparently fall back to ncspot.
+Use a custom client ID to avoid competing for the shared ncspot client's rate limit. Most requests will be attributed to your own Spotify application instead. Newly registered applications use restricted default quota mode, so endpoints unavailable to the custom client transparently fall back to ncspot.
 
-If you do need one, [register an application](https://developer.spotify.com/dashboard) on the Spotify developer dashboard, add your `login_redirect_uri` (default `http://127.0.0.1:8989/login`) to the app's allowed redirect URIs, then set `client_id` (or `client_id_command`) in `app.toml`. See the [Client id command](https://github.com/aome510/spotify-player/blob/master/docs/config.md#client-id-command) section of the configuration docs for details.
+To configure one, [register an application](https://developer.spotify.com/dashboard) on the Spotify developer dashboard, add your `login_redirect_uri` (default `http://127.0.0.1:8989/login`) to the app's allowed redirect URIs, then set `client_id` (or `client_id_command`) in `app.toml`. See the [Client id command](https://github.com/aome510/spotify-player/blob/master/docs/config.md#client-id-command) section of the configuration docs for details.
 
 After changing the client ID, re-run `spotify_player authenticate` to refresh the custom and fallback tokens.
 
```

**File**: `docs/config.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ spotify_player -o device.volume=80 -o theme=dracula
 | --------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
 | `client_id`                       | Primary Spotify client ID for API access; rejected requests can fall back to ncspot (see notes).    | See code (default: ncspot's client ID)                                 |
 | `client_id_command`               | Shell command that outputs client ID to stdout (overrides `client_id`).                             | `None`                                                                 |
-| `ncspot_only_get_endpoints`       | Endpoint prefixes for GET requests that should always use the ncspot client.                        | `["me/playlists", "search", "playlists/"]`                             |
+| `ncspot_only_get_endpoints`       | Endpoint prefixes for GET requests that should always use the ncspot client.                        | `["me/playlists", "playlists/"]`                                       |
 | `login_redirect_uri`              | Redirect URI for authentication.                                                                    | `http://127.0.0.1:8989/login`                                          |
 | `client_port`                     | Port for the application's client to handle CLI commands.                                           | `8080`                                                                 |
 | `log_folder`                      | Path to store log files.                                                                            | `None`                                                                 |
```

**File**: `spotify_player/src/client/mod.rs` (modified, +7/-12)
```diff
@@ -638,18 +638,13 @@ impl AppClient {
                         .insert(uri, ctx, *TTL_CACHE_DURATION);
                 }
             }
-            ClientRequest::Search(query) => {
-                if !state.data.read().caches.search.contains_key(&query) {
-                    let results = self.search(&query).await?;
-
-                    state
-                        .data
-                        .write()
-                        .caches
-                        .search
-                        .insert(query, results, *TTL_CACHE_DURATION);
+            ClientRequest::Search(query) => match self.search(&query).await {
+                Ok(results) => state.data.write().caches.complete_search(query, results),
+                Err(err) => {
+                    state.data.write().caches.fail_search(query);
+                    return Err(err);
                 }
-            }
+            },
 
             ClientRequest::AddPlayableToQueue(playable_id) => {
                 self.add_item_to_queue(playable_id, None).await?;
@@ -1152,7 +1147,7 @@ impl AppClient {
                 ],
                 None,
                 None,
-                None,
+                Some(10),
                 None,
             )
             .await?;
```

**File**: `spotify_player/src/client/spotify.rs` (modified, +0/-29)
```diff
@@ -570,35 +570,6 @@ mod tests {
         );
     }
 
-    #[tokio::test]
-    async fn search_uses_ncspot_without_calling_primary() {
-        let server = MockServer::start().await;
-        Mock::given(method("GET"))
-            .and(path("/v1/search"))
-            .and(header("authorization", "Bearer primary-token"))
-            .respond_with(ResponseTemplate::new(200).set_body_string("primary"))
-            .expect(0)
-            .mount(&server)
-            .await;
-        Mock::given(method("GET"))
-            .and(path("/v1/search"))
-            .and(header("authorization", "Bearer fallback-token"))
-            .respond_with(ResponseTemplate::new(200).set_body_string("ncspot"))
-            .expect(1)
-            .mount(&server)
-            .await;
-
-        let client = WebApiClient::new(
-            client_with_token(&server, false, "primary-token").await,
-            Some(client_with_token(&server, true, "fallback-token").await),
-        );
-
-        assert_eq!(
-            client.api_get("search", &Query::new()).await.unwrap(),
-            "ncspot"
-        );
-    }
-
     #[tokio::test]
     async fn configured_endpoint_prefix_uses_ncspot_without_calling_primary() {
         let server = MockServer::start().await;
```

**File**: `spotify_player/src/config/mod.rs` (modified, +1/-2)
```diff
@@ -6,8 +6,7 @@ const DEFAULT_CACHE_FOLDER: &str = ".cache/spotify-player";
 const APP_CONFIG_FILE: &str = "app.toml";
 const THEME_CONFIG_FILE: &str = "theme.toml";
 const KEYMAP_CONFIG_FILE: &str = "keymap.toml";
-pub(crate) const DEFAULT_NCSPOT_ONLY_GET_ENDPOINTS: &[&str] =
-    &["me/playlists", "search", "playlists/"];
+pub(crate) const DEFAULT_NCSPOT_ONLY_GET_ENDPOINTS: &[&str] = &["me/playlists", "playlists/"];
 
 use anyhow::{anyhow, Result};
 use config_parser2::{config_parser_impl, ConfigParse, ConfigParser};
```

**File**: `spotify_player/src/event/page.rs` (modified, +11/-3)
```diff
@@ -215,8 +215,16 @@ fn handle_key_sequence_for_search_page(
             return match &key_sequence.keys[0] {
                 Key::None(crossterm::event::KeyCode::Enter) => {
                     if !line_input.is_empty() {
-                        *current_query = line_input.get_text();
-                        client_pub.send(ClientRequest::Search(line_input.get_text()))?;
+                        let query = line_input.get_text();
+                        current_query.clone_from(&query);
+
+                        if state.data.write().caches.begin_search(&query) {
+                            if let Err(err) = client_pub.send(ClientRequest::Search(query.clone()))
+                            {
+                                state.data.write().caches.fail_search(query);
+                                return Err(err.into());
+                            }
+                        }
                     }
                     Ok(true)
                 }
@@ -247,7 +255,7 @@ fn handle_key_sequence_for_search_page(
     };
 
     let data = state.data.read();
-    let search_results = data.caches.search.get(current_query);
+    let search_results = data.caches.search_results(current_query);
 
     match focus_state {
         SearchFocusState::Input => anyhow::bail!("user's search input should be handled before"),
```

**File**: `spotify_player/src/state/data.rs` (modified, +84/-1)
```diff
@@ -45,10 +45,17 @@ pub struct UserData {
     pub saved_tracks: HashMap<String, Track>,
 }
 
+#[derive(Debug)]
+pub enum SearchCacheEntry {
+    Loading,
+    Ready(SearchResults),
+    Failed,
+}
+
 /// the application's in-memory caches
 pub struct MemoryCaches {
     pub context: ttl_cache::TtlCache<String, Context>,
-    pub search: ttl_cache::TtlCache<String, SearchResults>,
+    pub search: ttl_cache::TtlCache<String, SearchCacheEntry>,
     pub lyrics: ttl_cache::TtlCache<String, Option<Lyrics>>,
     pub genres: ttl_cache::TtlCache<String, Vec<String>>,
     #[cfg(feature = "image")]
@@ -73,6 +80,42 @@ impl MemoryCaches {
             images: ttl_cache::TtlCache::new(64),
         }
     }
+
+    pub fn begin_search(&mut self, query: &str) -> bool {
+        let should_begin = matches!(
+            self.search.get(query),
+            None | Some(SearchCacheEntry::Failed)
+        );
+
+        if should_begin {
+            self.search.insert(
+                query.to_string(),
+                SearchCacheEntry::Loading,
+                *TTL_CACHE_DURATION,
+            );
+        }
+
+        should_begin
+    }
+
+    pub fn complete_search(&mut self, query: String, results: SearchResults) {
+        self.search
+            .insert(query, SearchCacheEntry::Ready(results), *TTL_CACHE_DURATION);
+    }
+
+    pub fn fail_search(&mut self, query: String) {
+        if matches!(self.search.get(&query), Some(SearchCacheEntry::Loading)) {
+            self.search
+                .insert(query, SearchCacheEntry::Failed, *TTL_CACHE_DURATION);
+        }
+    }
+
+    pub fn search_results(&self, query: &str) -> Option<&SearchResults> {
+        match self.search.get(query) {
+            Some(SearchCacheEntry::Ready(results)) => Some(results),
+            _ => None,
+        }
+    }
 }
 
 impl AppData {
@@ -242,3 +285,43 @@ where
         None
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::{MemoryCaches, SearchCacheEntry, SearchResults};
+
+    #[test]
+    fn search_lifecycle_suppresses_duplicate_requests() {
+        let mut caches = MemoryCaches::new();
+
+        assert!(caches.begin_search("query"));
+        assert!(matches!(
+            caches.search.get("query"),
+            Some(SearchCacheEntry::Loading)
+        ));
+        assert!(!caches.begin_search("query"));
+
+        caches.complete_search("query".to_string(), SearchResults::default());
+
+        assert!(caches.search_results("query").is_some());
+        assert!(!caches.begin_search("query"));
+    }
+
+    #[test]
+    fn failed_search_can_be_retried() {
+        let mut caches = MemoryCaches::new();
+
+        assert!(caches.begin_search("query"));
+        caches.fail_search("query".to_string());
+
+        assert!(matches!(
+            caches.search.get("query"),
+            Some(SearchCacheEntry::Failed)
+        ));
+        assert!(caches.begin_search("query"));
+        assert!(matches!(
+            caches.search.get("query"),
+            Some(SearchCacheEntry::Loading)
+        ));
+    }
+}
```

**File**: `spotify_player/src/ui/page.rs` (modified, +43/-13)
```diff
@@ -6,7 +6,10 @@ use std::{
 use chrono_humanize::HumanTime;
 use ratatui::text::Line;
 
-use crate::{state::Episode, utils::format_duration};
+use crate::{
+    state::{Episode, SearchCacheEntry},
+    utils::format_duration,
+};
 
 use super::{
     config, utils, utils::construct_and_render_block, Album, Alignment, Artist, ArtistFocusState,
@@ -57,16 +60,51 @@ pub fn render_search_page(
         _ => return,
     };
 
-    let search_results = data.caches.search.get(current_query);
+    let search_entry = data.caches.search.get(current_query);
+    let search_results = data.caches.search_results(current_query);
 
     // 2. Construct the page's layout
     let rect = construct_and_render_block("Search", &ui.theme, Borders::ALL, frame, rect);
 
+    let status = match search_entry {
+        Some(SearchCacheEntry::Loading) => Some("Loading..."),
+        Some(SearchCacheEntry::Failed) => Some("Search failed"),
+        _ => None,
+    };
+
     // search input's layout
-    let chunks = Layout::vertical([Constraint::Length(1), Constraint::Fill(0)]).split(rect);
-    let search_input_rect = chunks[0];
+    let input_height = if status.is_some() { 2 } else { 1 };
+    let chunks =
+        Layout::vertical([Constraint::Length(input_height), Constraint::Fill(0)]).split(rect);
+    let search_input_rect = if status.is_some() {
+        construct_and_render_block("", &ui.theme, Borders::BOTTOM, frame, chunks[0])
+    } else {
+        chunks[0]
+    };
     let rect = chunks[1];
 
+    let PageState::Search { line_input, .. } = ui.current_page_mut() else {
+        return;
+    };
+    frame.render_widget(
+        line_input.widget(is_active && focus_state == SearchFocusState::Input),
+        search_input_rect,
+    );
+
+    if let Some(status) = status {
+        let status_rect = Layout::vertical([
+            Constraint::Fill(1),
+            Constraint::Length(1),
+            Constraint::Fill(1),
+        ])
+        .split(rect)[1];
+        frame.render_widget(
+            Paragraph::new(status).alignment(Alignment::Center),
+            status_rect,
+        );
+        return;
+    }
+
     // track/album/artist/playlist/show/episode search results layout
     let chunks = match ui.orientation {
         // 1x6
@@ -226,19 +264,11 @@ pub fn render_search_page(
     // 4. Render the page's widgets
     // Need mutable access to the list/table states stored inside the page state for rendering.
     let PageState::Search {
-        state: page_state,
-        line_input,
-        ..
+        state: page_state, ..
     } = ui.current_page_mut()
     else {
         return;
     };
-
-    // Render the query input box
-    frame.render_widget(
-        line_input.widget(is_active && focus_state == SearchFocusState::Input),
-        search_input_rect,
-    );
     utils::render_list_window(
         frame,
         track_list,
```

---

### Incident Patch 5: `6454f7df` (2026-09-07)
**Commit Message**: feat(ui): themeable audio visualization colors (#1063)

### Summary

The audio visualization bars used a hardcoded blue → green → red
amplitude gradient, so users had no way to match the visualization to
their theme. This adds a `visualization` component style with three
optional color stops (`low`/`mid`/`high`) that are interpolated by bar
amplitude, falling back to the existing blue/green/red gradient when
unset.

### Changes

- **Theme config** (`config/theme.rs`): add `VisualizationStyle` and
  `VisualizationColors` types and a `Theme::visualization()` accessor,
  all gated behind `feature = "streaming"`. `VisualizationStyle::resolve`
  maps each stop through the existing `StyleColor::color()` palette
  resolution, with defaults that preserve the original RGB gradient
  (`#1e64ff`/`#32ff80`/`#ff0000`).
- **Render path** (`ui/streaming.rs`, `ui/playback.rs`): `bar_color` now
  takes the three resolved colors and lerps between adjacent stops; adds
  `lerp_color` for RGB interpolation (non-RGB colors pass through `a`
  unchanged). `render_audio_visualization` takes `&config::Theme`,
  resolves the colors once per frame, and passes them to `bar_color`.
- **Docs** (`README.md`, `doc

**File**: `README.md` (modified, +1/-1)
```diff
@@ -282,7 +282,7 @@ cargo install spotify_player --no-default-features
 
 Real-time audio visualization is displayed in the playback window as a frequency-band bar chart (64 log-scale bands from bass (left) to treble (right)) while music is streamed locally via the integrated [librespot](https://github.com/librespot-org/librespot) player. The visualization area is hidden when playback is on an external Spotify Connect device or when the playback is not playing.
 
-Set `enable_audio_visualization` to `true` in your config to enable this feature. See [config docs](https://github.com/aome510/spotify-player/blob/master/docs/config.md).
+Set `enable_audio_visualization` to `true` in your config to enable this feature. The bars are colored by amplitude using the active theme's `visualization` component style (`low`/`mid`/`high` colors); see [config docs](https://github.com/aome510/spotify-player/blob/master/docs/config.md).
 
 ![Audio Visualization](https://github.com/user-attachments/assets/8c21c1b0-5276-4a9e-b719-e0c2bd555537)
 
```

**File**: `docs/config.md` (modified, +5/-0)
```diff
@@ -213,6 +213,9 @@ The `component_style` table customizes UI component appearance. All fields are o
 | `like`                           | Style for the like indicator                              |
 | `lyrics_played`                  | Style for played lyrics lines                             |
 | `lyrics_playing`                 | Style for the currently playing lyrics line               |
+| `visualization`                  | Colors for the audio visualization bars (see below)       |
+
+The `visualization` style uses three optional colors (`low`, `mid`, `high`), interpolated by bar amplitude: quiet bars use `low`, medium bars use `mid`, and loud bars use `high`. When omitted, a blue → green → red gradient is used.
 
 Each style accepts optional fields:
 
@@ -231,6 +234,7 @@ name = "my_theme"
 block_title = { fg = "Magenta", modifiers = ["Bold"] }
 border = { fg = "White" }
 selection = { modifiers = ["Reversed", "Bold"] }
+visualization = { low = "#00d7ff", mid = "#00ff87", high = "#ff004d" }
 ```
 
 #### Default Component Styles
@@ -255,6 +259,7 @@ secondary_row = {}
 like = {}
 lyrics_played = { modifiers = ["Dim"] }
 lyrics_playing = { fg = "Green", modifiers = ["Bold"] }
+visualization = { low = "#1e64ff", mid = "#32ff80", high = "#ff0000" }
 ```
 
 #### Accepted Colors
```

**File**: `examples/theme.toml` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ bright_white = "#ffffff"
 like = { fg = "Red", modifiers = ["Bold"] }
 selection = { bg = "Black", fg = "White", modifiers = ["Bold"] }
 secondary_row = { bg = "#677075" }
+visualization = { low = "#1e64ff", mid = "#32ff80", high = "#ff0000" }
 
 [[themes]]
 name = "gruvbox_dark"
```

**File**: `spotify_player/src/config/theme.rs` (modified, +59/-0)
```diff
@@ -60,6 +60,23 @@ struct Palette {
     bright_yellow: Color,
 }
 
+#[cfg(feature = "streaming")]
+#[derive(Clone, Debug, Default, Deserialize)]
+struct VisualizationStyle {
+    low: Option<StyleColor>,
+    mid: Option<StyleColor>,
+    high: Option<StyleColor>,
+}
+
+/// Amplitude-keyed colors resolved from a theme's `visualization` style.
+#[cfg(feature = "streaming")]
+#[derive(Clone, Debug)]
+pub struct VisualizationColors {
+    pub low: style::Color,
+    pub mid: style::Color,
+    pub high: style::Color,
+}
+
 #[derive(Clone, Debug, Default, Deserialize)]
 struct ComponentStyle {
     block_title: Option<Style>,
@@ -81,6 +98,8 @@ struct ComponentStyle {
     like: Option<Style>,
     lyrics_played: Option<Style>,
     lyrics_playing: Option<Style>,
+    #[cfg(feature = "streaming")]
+    visualization: Option<VisualizationStyle>,
 }
 
 #[derive(Default, Clone, Debug, Deserialize)]
@@ -373,6 +392,46 @@ impl Theme {
             )
             .style(&self.palette)
     }
+
+    /// Colors used by the audio visualization bars, keyed by amplitude.
+    /// Quiet bars use `low`, medium bars use `mid`, loud bars use `high`,
+    /// with a gradient between adjacent stops.
+    #[cfg(feature = "streaming")]
+    pub fn visualization(&self) -> VisualizationColors {
+        self.component_style
+            .visualization
+            .as_ref()
+            .unwrap_or(&VisualizationStyle::default())
+            .resolve(&self.palette)
+    }
+}
+
+#[cfg(feature = "streaming")]
+impl VisualizationStyle {
+    fn resolve(&self, palette: &Palette) -> VisualizationColors {
+        VisualizationColors {
+            low: self
+                .low
+                .unwrap_or(StyleColor::Rgb {
+                    r: 30,
+                    g: 100,
+                    b: 255,
+                })
+                .color(palette),
+            mid: self
+                .mid
+                .unwrap_or(StyleColor::Rgb {
+                    r: 50,
+                    g: 255,
+                    b: 128,
+                })
+                .color(palette),
+            high: self
+                .high
+                .unwrap_or(StyleColor::Rgb { r: 255, g: 0, b: 0 })
+                .color(palette),
+        }
+    }
 }
 
 impl Style {
```

**File**: `spotify_player/src/ui/playback.rs` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ pub fn render_playback_window(
             render_playback_progress_bar(frame, ui, progress, duration, progress_bar_rect);
             #[cfg(feature = "streaming")]
             if let Some(vis_r) = vis_rect {
-                super::streaming::render_audio_visualization(frame, state, vis_r);
+                super::streaming::render_audio_visualization(frame, state, &ui.theme, vis_r);
             }
             return other_rect;
         }
```

**File**: `spotify_player/src/ui/streaming.rs` (modified, +36/-21)
```diff
@@ -1,3 +1,4 @@
+use super::config;
 use crate::state::SharedState;
 use librespot_playback::{
     audio_backend::{Sink, SinkResult},
@@ -332,33 +333,41 @@ fn smooth_bands(bands: &mut [f32], scratch: &mut [f32]) {
     }
 }
 
-/// Maps a normalised amplitude [0, 1] to an RGB colour.
-/// Quiet (0.0) → cool blue, medium → green, loud (1.0) → hot red.
-fn bar_color(t: f32) -> Color {
-    let (r, g, b) = if t < 0.5 {
-        let s = t * 2.0;
-        (
-            (30.0 + 20.0 * s) as u8,
-            (100.0 + 155.0 * s) as u8,
-            (255.0 * (1.0 - s * 0.5)) as u8,
-        )
+/// Linearly interpolates between two RGB colors; returns `a` when either color
+/// is not an RGB color (e.g. an ANSI palette color).
+fn lerp_color(a: Color, b: Color, t: f32) -> Color {
+    match (a, b) {
+        (Color::Rgb(r1, g1, b1), Color::Rgb(r2, g2, b2)) => Color::Rgb(
+            (f32::from(r1) + (f32::from(r2) - f32::from(r1)) * t) as u8,
+            (f32::from(g1) + (f32::from(g2) - f32::from(g1)) * t) as u8,
+            (f32::from(b1) + (f32::from(b2) - f32::from(b1)) * t) as u8,
+        ),
+        (a, _) => a,
+    }
+}
+
+/// Maps a normalised amplitude `t` in [0, 1] to a color between the theme's
+/// `low` (quiet), `mid` (medium) and `high` (loud) visualization stops.
+fn bar_color(t: f32, low: Color, mid: Color, high: Color) -> Color {
+    if t < 0.5 {
+        lerp_color(low, mid, t * 2.0)
     } else {
-        let s = (t - 0.5) * 2.0;
-        (
-            (50.0 + 205.0 * s) as u8,
-            (255.0 * (1.0 - s)) as u8,
-            (128.0 * (1.0 - s)) as u8,
-        )
-    };
-    Color::Rgb(r, g, b)
+        lerp_color(mid, high, (t - 0.5) * 2.0)
+    }
 }
 
 /// Render a frequency-band bar chart using live FFT data from the audio sink.
 ///
 /// Bars are subsampled to the available rect width so they always fill the area
 /// cleanly. Heights use a sqrt (perceptual) curve so quiet signals stay visible.
-/// Each bar is coloured by its amplitude: cool blue (quiet) → green → hot red (loud).
-pub fn render_audio_visualization(frame: &mut Frame, state: &SharedState, rect: Rect) {
+/// Each bar is coloured by its amplitude using the theme's visualization colors:
+/// `low` (quiet) → `mid` → `high` (loud).
+pub fn render_audio_visualization(
+    frame: &mut Frame,
+    state: &SharedState,
+    theme: &config::Theme,
+    rect: Rect,
+) {
     // display_decay interpolates bar heights smoothly between write() calls.
     // We normalise against peak_envelope (NOT the per-frame peak), so display_decay
     // no longer cancels out and bars genuinely fade between audio packets.
@@ -377,6 +386,7 @@ pub fn render_audio_visualization(frame: &mut Frame, state: &SharedState, rect:
     // Copy the fixed-size array by value — no heap allocation.
     let values = guard.values;
     drop(guard);
+    let vis_colors = theme.visualization();
     let num_bars = (rect.width as usize).min(values.len()).max(1);
     // Multiply by 8 to use ratatui's eighth-block characters (▁▂▃▄▅▆▇█),
     // giving 8× the resolution of whole terminal rows.
@@ -395,7 +405,12 @@ pub fn render_audio_visualization(frame: &mut Frame, state: &SharedState, rect:
             Bar::default()
                 .value(val)
                 .text_value("")
-                .style(Style::default().fg(bar_color(norm)))
+                .style(Style::default().fg(bar_color(
+                    norm,
+                    vis_colors.low,
+                    vis_colors.mid,
+                    vis_colors.high,
+                )))
         })
         .collect();
 
```

---

### Incident Patch 6: `755a3c84` (2026-09-07)
**Commit Message**: fix(device): do not advertise integrated device when streaming is off (#1052)

ensure_integrated_device() was gated only on #[cfg(feature = "'streaming"')], a
compile-time check that is true for every build shipping streaming. Whether
this instance actually runs an integrated player is a runtime question,
answered by SharedState::is_streaming_enabled().

With enable_streaming = "'DaemonOnly"', a non-daemon instance therefore inserted a
device row for a player it never started. new_session() already pairs the cfg
gate with the runtime check; the device-list call sites did not.

This is not only cosmetic: find_available_device() prioritizes the integrated
device, so once no device is active it selects the phantom and playback fails
with 404 Not Found.

find_available_device() now takes &SharedState; its single caller already has
one in scope.

**File**: `spotify_player/src/client/mod.rs` (modified, +14/-4)
```diff
@@ -205,7 +205,7 @@ impl AppClient {
                         continue;
                     }
 
-                    let id = match client.find_available_device().await {
+                    let id = match client.find_available_device(&state).await {
                         Ok(Some(id)) => Some(Cow::Owned(id)),
                         Ok(None) => None,
                         Err(err) => {
@@ -523,7 +523,9 @@ impl AppClient {
                     .collect();
 
                 #[cfg(feature = "streaming")]
-                self.ensure_integrated_device(&mut devices).await;
+                if state.is_streaming_enabled() {
+                    self.ensure_integrated_device(&mut devices).await;
+                }
 
                 state.player.write().devices = devices;
             }
@@ -820,7 +822,8 @@ impl AppClient {
     }
 
     /// Find an available device. If found, return the device's ID.
-    async fn find_available_device(&self) -> Result<Option<String>> {
+    #[cfg_attr(not(feature = "streaming"), allow(unused_variables))]
+    async fn find_available_device(&self, state: &SharedState) -> Result<Option<String>> {
         let devices = self.available_devices().await?;
 
         // if there is an active device, return it
@@ -835,7 +838,9 @@ impl AppClient {
             .collect::<Vec<_>>();
 
         #[cfg(feature = "streaming")]
-        self.ensure_integrated_device(&mut devices).await;
+        if state.is_streaming_enabled() {
+            self.ensure_integrated_device(&mut devices).await;
+        }
 
         tracing::info!("no active device found, available devices: {devices:?}");
 
@@ -860,6 +865,11 @@ impl AppClient {
     /// 2. The device list is empty. This might be because user doesn't specify their own client ID.
     ///    By default, the application uses Spotify web app's client ID, which doesn't have
     ///    access to user's active devices.
+    ///
+    /// Callers must check [`SharedState::is_streaming_enabled`] first. The `streaming` feature
+    /// being compiled in does not mean *this* instance runs an integrated player: with
+    /// `enable_streaming = "DaemonOnly"` only the daemon does, so a non-daemon instance would
+    /// otherwise advertise a device that does not exist.
     #[cfg(feature = "streaming")]
     async fn ensure_integrated_device(&self, devices: &mut Vec<Device>) {
         let session = self.spotify.session().await;
```

---

### Incident Patch 7: `8a1985c4` (2026-09-07)
**Commit Message**: fix: backspace on empty search input navigates to previous page (#1062)

When the search input is empty, pressing Backspace now triggers
PreviousPage navigation instead of being silently consumed.

Closes: https://github.com/aome510/spotify-player/issues/1061

**File**: `spotify_player/src/event/page.rs` (modified, +11/-0)
```diff
@@ -220,6 +220,17 @@ fn handle_key_sequence_for_search_page(
                     }
                     Ok(true)
                 }
+                Key::None(crossterm::event::KeyCode::Backspace) => {
+                    if line_input.is_empty() {
+                        if ui.history.len() > 1 {
+                            ui.history.pop();
+                            ui.popup = None;
+                        }
+                    } else {
+                        line_input.input(&Key::None(crossterm::event::KeyCode::Backspace));
+                    }
+                    Ok(true)
+                }
                 k => match line_input.input(k) {
                     None => Ok(false),
                     _ => Ok(true),
```

---

### Incident Patch 8: `ef525dad` (2026-07-20)
**Commit Message**: fix invalid token with Spotify's new token expiration policy (#1041)

### Summary

Resolves #1040

As of 2026-07-20 Spotify [stopped rotating and now expires refresh tokens](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration), so the Authorization-Code-with-PKCE refresh grant no longer returns a `refresh_token`. The Web API client is a stock `rspotify::AuthCodePkceSpotify`, whose `refetch_token` stores the refresh response verbatim — so `refresh_token` got nulled in `user_client_token.json`, and the next forced refresh then had nothing to refresh with and wiped the token entirely, leaving every request failing with `Token is not valid` / `get token: no access token`. This change wraps the Web API client so refreshes preserve the existing refresh token, and re-authenticates instead of crashing (or serving a dead-end token) when a refresh token is missing or expired.

### Changes

- **Preserve the refresh token across refreshes** (`client/spotify.rs`): add `WebApiClient`, a thin wrapper over `rspotify::AuthCodePkceSpotify` that overrides `refetch_token` to carry the previously stored refresh token forward when Spotify's refresh response omits one. All other behavi

**File**: `spotify_player/src/auth.rs` (modified, +33/-13)
```diff
@@ -133,30 +133,50 @@ pub fn get_creds(auth_config: &AuthConfig, reauth: bool, use_cached: bool) -> Re
 /// When `force` is set, any cached token is ignored and a fresh interactive authorization flow is
 /// always run. This is used by the `authenticate` CLI command to re-authenticate on demand.
 pub async fn prompt_for_user_token(
-    client: &mut rspotify::AuthCodePkceSpotify,
+    client: &mut crate::client::WebApiClient,
     force: bool,
 ) -> Result<()> {
     // Reuse a cached token when possible, refreshing it if it has expired.
     if !force {
         if let Ok(Some(token)) = client.read_token_cache(true).await {
             let expired = token.is_expired();
+            // A token without a refresh token cannot be renewed once it expires and
+            // gets wiped by the next refresh (e.g. caches nulled by Spotify's
+            // refresh-token change). Treat it as unusable so we re-authenticate and
+            // obtain a fresh refresh token instead of serving a dead-end token.
+            let renewable = token.refresh_token.is_some();
             *client.get_token().lock().await.unwrap() = Some(token);
 
-            if !expired {
+            if !expired && renewable {
                 return Ok(());
             }
 
-            if let Some(refreshed) = client
-                .refetch_token()
-                .await
-                .context("refresh expired token from cache")?
-            {
-                *client.get_token().lock().await.unwrap() = Some(refreshed);
-                client
-                    .write_token_cache()
-                    .await
-                    .context("write refreshed token to cache")?;
-                return Ok(());
+            // A refresh may fail because the refresh token expired (Spotify expires
+            // refresh tokens 6 months after the original authorization, returning
+            // `invalid_grant`) or because no refresh token is available. In either
+            // case, fall through to the interactive flow below rather than failing.
+            match client.refetch_token().await {
+                Ok(Some(refreshed)) => {
+                    *client.get_token().lock().await.unwrap() = Some(refreshed);
+                    client
+                        .write_token_cache()
+                        .await
+                        .context("write refreshed token to cache")?;
+                    return Ok(());
+                }
+                Ok(None) => {
+                    tracing::warn!(
+                        "Cached token could not be refreshed (no refresh token available); \
+                         falling back to interactive re-authentication."
+                    );
+                }
+                Err(err) => {
+                    tracing::warn!(
+                        "Failed to refresh the cached token (the refresh token may have expired \
+                         per Spotify's 6-month refresh-token expiration policy); \
+                         falling back to interactive re-authentication: {err:#}"
+                    );
+                }
             }
         }
     }
```

**File**: `spotify_player/src/client/mod.rs` (modified, +6/-5)
```diff
@@ -34,6 +34,7 @@ mod spotify;
 pub use handlers::*;
 pub use request::*;
 use serde::Deserialize;
+pub(crate) use spotify::WebApiClient;
 
 const SPOTIFY_API_ENDPOINT: &str = "https://api.spotify.com/v1";
 const PLAYBACK_TYPES: [&rspotify::model::AdditionalType; 2] = [
@@ -49,13 +50,13 @@ pub struct AppClient {
     spotify: Arc<spotify::Spotify>,
     auth_config: AuthConfig,
     /// The Spotify Web API client, used for interacting with Spotify Web APIs
-    api_client: rspotify::AuthCodePkceSpotify,
+    api_client: WebApiClient,
     #[cfg(feature = "streaming")]
     stream_conn: Arc<Mutex<Option<librespot_connect::Spirc>>>,
 }
 
 impl Deref for AppClient {
-    type Target = rspotify::AuthCodePkceSpotify;
+    type Target = WebApiClient;
     fn deref(&self) -> &Self::Target {
         &self.api_client
     }
@@ -65,7 +66,7 @@ impl Deref for AppClient {
 ///
 /// The returned client is unauthenticated; call [`auth::prompt_for_user_token`] to obtain an
 /// access token.
-pub fn new_api_client() -> Result<rspotify::AuthCodePkceSpotify> {
+pub fn new_api_client() -> Result<WebApiClient> {
     let configs = config::get_config();
 
     let id = configs.app_config.get_client_id()?;
@@ -102,8 +103,8 @@ pub fn new_api_client() -> Result<rspotify::AuthCodePkceSpotify> {
         cache_path: configs.cache_folder.join("user_client_token.json"),
         ..Default::default()
     };
-    Ok(rspotify::AuthCodePkceSpotify::with_config(
-        creds, oauth, config,
+    Ok(WebApiClient::new(
+        rspotify::AuthCodePkceSpotify::with_config(creds, oauth, config),
     ))
 }
 
```

**File**: `spotify_player/src/client/spotify.rs` (modified, +77/-1)
```diff
@@ -4,7 +4,7 @@ use rspotify::{
     clients::{BaseClient, OAuthClient},
     http::HttpClient,
     sync::Mutex,
-    ClientResult, Config, Credentials, OAuth, Token,
+    AuthCodePkceSpotify, ClientResult, Config, Credentials, OAuth, Token,
 };
 use std::{fmt, sync::Arc};
 
@@ -120,3 +120,79 @@ impl OAuthClient for Spotify {
         panic!("`OAuthClient::request_token` should never be called!")
     }
 }
+
+/// Thin wrapper over [`rspotify::AuthCodePkceSpotify`] for the Spotify Web API.
+///
+/// It exists solely to override `refetch_token` so that a refresh grant which
+/// omits `refresh_token` preserves the previously stored refresh token instead
+/// of overwriting it with `None`. Spotify stopped rotating (and now expires)
+/// refresh tokens, so the refresh response no longer echoes one back.
+///
+/// See:
+/// - <https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration>
+/// - <https://github.com/aome510/spotify-player/issues/1040>
+#[derive(Clone, Debug, Default)]
+pub struct WebApiClient(AuthCodePkceSpotify);
+
+impl WebApiClient {
+    pub fn new(inner: AuthCodePkceSpotify) -> Self {
+        Self(inner)
+    }
+
+    pub fn get_authorize_url(&mut self, verifier_bytes: Option<usize>) -> ClientResult<String> {
+        self.0.get_authorize_url(verifier_bytes)
+    }
+}
+
+#[maybe_async]
+impl BaseClient for WebApiClient {
+    fn get_http(&self) -> &HttpClient {
+        self.0.get_http()
+    }
+
+    fn get_token(&self) -> Arc<Mutex<Option<Token>>> {
+        self.0.get_token()
+    }
+
+    fn get_creds(&self) -> &Credentials {
+        self.0.get_creds()
+    }
+
+    fn get_config(&self) -> &Config {
+        self.0.get_config()
+    }
+
+    async fn refetch_token(&self) -> ClientResult<Option<Token>> {
+        // Capture the current refresh token before refreshing
+        let previous_refresh_token = self
+            .0
+            .get_token()
+            .lock()
+            .await
+            .unwrap()
+            .as_ref()
+            .and_then(|token| token.refresh_token.clone());
+
+        // Spotify's refresh response no longer includes `refresh_token`; carry the
+        // previous one forward so it is not lost on the round-trip and nulled in the
+        // token cache.
+        let refreshed = self.0.refetch_token().await?;
+        Ok(refreshed.map(|mut token| {
+            if token.refresh_token.is_none() {
+                token.refresh_token = previous_refresh_token;
+            }
+            token
+        }))
+    }
+}
+
+#[maybe_async]
+impl OAuthClient for WebApiClient {
+    fn get_oauth(&self) -> &OAuth {
+        self.0.get_oauth()
+    }
+
+    async fn request_token(&self, code: &str) -> ClientResult<()> {
+        self.0.request_token(code).await
+    }
+}
```

---

### Incident Patch 9: `04684303` (2026-06-30)
**Commit Message**: Workaround a black screen issue when rendering `iTerm2` inline images with `ratatui-image` (#1017)

## Summary

Workaround for https://github.com/ratatui/ratatui-image/issues/184

## Changes

- **iTerm2 cover-image workaround** (`ui/cover_image.rs`, new): add a `CoverImage` abstraction over the terminal's image protocol — kitty/sixel/halfblocks render as a `ratatui-image` widget, iTerm2 gets a cursor-anchored inline-image escape written to stdout with its cells reserved via `CellDiffOption::Skip`.
- **Render path** (`ui/playback.rs`, `state/ui/mod.rs`, `ui/mod.rs`): `ImageRenderInfo.state` holds a `CoverImage` instead of a raw `Protocol`; the playback window builds it once per `(url, area)` and calls `cover.render(frame, area)`.
- **Auto-derived cover width** (`ui/playback.rs`, `config/mod.rs`): `cover_img_length` now defaults to `0` ("auto"), deriving the column count from the terminal's cell aspect ratio; a non-zero value still sizes the box manually.

**File**: `CLAUDE.md` (modified, +2/-3)
```diff
@@ -104,10 +104,9 @@ tracing::debug!("{value:?}");
 
 ### Comments and doc comments
 
-- Comment the _why_, not the _what_ — skip comments that restate the code.
 - Reserve comments for non-obvious intent: invariants, ordering constraints, workarounds, edge cases.
-- Keep comments concise and clear; avoid long paragraphs.
-- Try to keep comments up to date with code changes.
+- Do not narrate the implementation. A doc comment states a type/function's purpose and contract (what callers need to know); leave the mechanics — which branch does what, field-by-field behaviour, control flow — to the code itself. Implementation rationale belongs in a focused inline comment at the relevant line, not in the doc comment.
+- Keep comments concise and clear, avoid long paragraphs and try to keep comments up to date with code changes.
 
 ## Keeping docs up to date
 
```

**File**: `docs/config.md` (modified, +3/-2)
```diff
@@ -64,8 +64,8 @@ spotify_player -o device.volume=80 -o theme=dracula
 | `progress_bar_position`           | Progress bar position: `Bottom` or `Right`.                                                          | `Bottom`                                                               |
 | `layout`                          | Layout configuration (see below).                                                                    | See below                                                              |
 | `genre_num`                       | Max number of genres to display in playback text.                                                    | `2`                                                                    |
-| `cover_img_length`                | Cover image length (requires `image` feature).                                                       | `9`                                                                    |
-| `cover_img_width`                 | Cover image width (requires `image` feature).                                                        | `5`                                                                    |
+| `cover_img_length`                | Cover image length in terminal columns (requires `image` feature).                                   | `0` (auto, see notes)                                                  |
+| `cover_img_width`                 | Cover image width in terminal rows (requires `image` feature).                                       | `5`                                                                    |
 | `cover_img_pixels`                | Pixels per side for cover image (requires `pixelate` feature).                                       | `16`                                                                   |
 | `seek_duration_secs`              | Seek duration in seconds for seek commands.                                                          | `5`                                                                    |
 | `sort_artist_albums_by_type`      | Sort albums by type on artist pages.                                                                 | `false`                                                                |
@@ -84,6 +84,7 @@ spotify_player -o device.volume=80 -o theme=dracula
 - `enable_streaming` accepts `Always`, `Never`, or `DaemonOnly`. For backward compatibility, `true`/`false` are also accepted.
 - `border_type`, `progress_bar_type`, and `progress_bar_position` accept only the values listed in the table above.
 - `explicit_icon` can be set to any Unicode character or an empty string to disable explicit markers.
+- `cover_img_length = 0` (the default) auto-derives the cover's column count from the terminal's cell aspect ratio. Set a non-zero `cover_img_length` to size the box manually.
 
 #### Media control
 
```

**File**: `examples/app.toml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ play_icon = "▶"
 pause_icon = "▌▌"
 liked_icon = "♥"
 genre_num = 2
-cover_img_length = 9
+cover_img_length = 0
 cover_img_width = 5
 cover_img_pixels = 16
 seek_duration_secs = 5
```

**File**: `spotify_player/src/config/mod.rs` (modified, +2/-1)
```diff
@@ -354,8 +354,9 @@ impl Default for AppConfig {
 
             genre_num: 2,
 
+            // `0` means "auto": derive the cover's column count from the terminal's cell aspect ratio
             #[cfg(feature = "image")]
-            cover_img_length: 9,
+            cover_img_length: 0,
             #[cfg(feature = "image")]
             cover_img_width: 5,
             #[cfg(feature = "pixelate")]
```

**File**: `spotify_player/src/state/ui/mod.rs` (modified, +4/-2)
```diff
@@ -6,7 +6,9 @@ use crate::{
 };
 
 #[cfg(feature = "image")]
-use ratatui_image::{picker::Picker, protocol::Protocol};
+use crate::ui::cover_image::CoverImage;
+#[cfg(feature = "image")]
+use ratatui_image::picker::Picker;
 
 pub type UIStateGuard<'a> = parking_lot::MutexGuard<'a, UIState>;
 
@@ -21,7 +23,7 @@ pub use popup::*;
 pub struct ImageRenderInfo {
     pub url: String,
     pub render_area: ratatui::layout::Rect,
-    pub state: Option<Protocol>,
+    pub state: Option<CoverImage>,
 }
 
 #[cfg(feature = "image")]
```

**File**: `spotify_player/src/ui/cover_image.rs` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+use std::io::Write;
+
+use anyhow::{Context, Result};
+use base64::Engine;
+use image::DynamicImage;
+use ratatui::{buffer::CellDiffOption, layout::Rect, Frame};
+use ratatui_image::{
+    picker::{Picker, ProtocolType},
+    protocol::Protocol,
+    Image, Resize,
+};
+
+/// A cover image prepared for a fixed render area. Construct it once per `(url, area)` and reuse
+/// it across frames.
+pub enum CoverImage {
+    /// Rendered through `ratatui-image` as a widget (kitty / sixel / halfblocks).
+    Widget(Box<Protocol>),
+    /// A cursor-anchored iTerm2 inline-image escape, written directly to the terminal.
+    /// `drawn` tracks whether it has been emitted yet — being grid-anchored, it only needs
+    /// to be emitted once.
+    Iterm2 { escape: String, drawn: bool },
+}
+
+impl CoverImage {
+    /// Prepare `img` for rendering into `area` using the protocol selected by `picker`.
+    pub fn new(picker: &Picker, img: &DynamicImage, area: Rect) -> Result<Self> {
+        if picker.protocol_type() == ProtocolType::Iterm2 {
+            Ok(Self::Iterm2 {
+                escape: encode_iterm2(img, area)?,
+                drawn: false,
+            })
+        } else {
+            let protocol = picker
+                .new_protocol(img.clone(), area.into(), Resize::Fit(None))
+                .context("encode cover image protocol")?;
+            Ok(Self::Widget(Box::new(protocol)))
+        }
+    }
+
+    /// Render the cover image into `area`.
+    pub fn render(&mut self, frame: &mut Frame, area: Rect) {
+        match self {
+            Self::Widget(protocol) => frame.render_widget(Image::new(protocol.as_ref()), area),
+            Self::Iterm2 { escape, drawn } => {
+                reserve_area(frame, area);
+                if !*drawn {
+                    if let Err(err) = write_iterm2(escape, area) {
+                        tracing::error!("Failed to draw iTerm2 cover image: {err:#}");
+                    } else {
+                        *drawn = true;
+                    }
+                }
+            }
+        }
+    }
+}
+
+/// Mark every cell in `area` as skipped so `ratatui`'s renderer leaves it untouched.
+fn reserve_area(frame: &mut Frame, area: Rect) {
+    for y in area.top()..area.bottom() {
+        for x in area.left()..area.right() {
+            if let Some(cell) = frame.buffer_mut().cell_mut((x, y)) {
+                cell.set_diff_option(CellDiffOption::Skip);
+            }
+        }
+    }
+}
+
+/// Encode `img` as a cursor-anchored, cell-sized iTerm2 inline-image escape sequence.
+fn encode_iterm2(img: &DynamicImage, area: Rect) -> Result<String> {
+    let mut png = Vec::new();
+    img.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
+        .context("encode cover image to PNG")?;
+    let data = base64::engine::general_purpose::STANDARD.encode(&png);
+    Ok(format!(
+        "\x1b]1337;File=inline=1;preserveAspectRatio=1;size={};width={};height={}:{data}\x07",
+        png.len(),
+        area.width,
+        area.height,
+    ))
+}
+
+/// Write a prepared iTerm2 image escape at `area`'s top-left, erasing the cell box first (so
+/// letterboxing doesn't reveal stale content) and restoring the cursor afterwards so
+/// `ratatui`'s own rendering is unaffected.
+fn write_iterm2(escape: &str, area: Rect) -> std::io::Result<()> {
+    // `area` is always a sub-rectangle of the screen, so the cursor-anchored image fits and
+    // does not scroll the alternate screen.
+    let mut out = std::io::stdout().lock();
+    out.write_all(b"\x1b7")?; // DEC save cursor
+    for row in area.top()..area.bottom() {
+        // move to the start of the row (1-based) and erase `width` cells
+        write!(out, "\x1b[{};{}H\x1b[{}X", row + 1, area.x + 1, area.width)?;
+    }
+    // position at the image origin and draw it
+    write!(out, "\x1b[{};{}H{escape}", area.y + 1, area.x + 1)?;
+    out.write_all(b"\x1b8")?; // DEC restore cursor
+    out.flush()
+}
```

**File**: `spotify_player/src/ui/mod.rs` (modified, +2/-0)
```diff
@@ -24,6 +24,8 @@ use crate::state::ImageRenderInfo;
 
 type Terminal = ratatui::Terminal<ratatui::backend::CrosstermBackend<std::io::Stdout>>;
 
+#[cfg(feature = "image")]
+pub mod cover_image;
 mod page;
 mod playback;
 mod popup;
```

**File**: `spotify_player/src/ui/playback.rs` (modified, +26/-14)
```diff
@@ -57,11 +57,11 @@ pub fn render_playback_window(
                         match configs.app_config.progress_bar_position {
                             config::ProgressBarPosition::Bottom => {
                                 let ver_chunks = split_rect_for_progress_bar(rect); // rect, progress_bar_rect
-                                let hor_chunks = split_rect_for_cover_img(ver_chunks.0); // cover_img_rect, metadata_rect
+                                let hor_chunks = split_rect_for_cover_img(ver_chunks.0, &ui.picker); // cover_img_rect, metadata_rect
                                 (hor_chunks.1, hor_chunks.0, ver_chunks.1)
                             }
                             config::ProgressBarPosition::Right => {
-                                let hor_chunks = split_rect_for_cover_img(rect); // cover_img_rect, rect
+                                let hor_chunks = split_rect_for_cover_img(rect, &ui.picker); // cover_img_rect, rect
                                 let ver_chunks = split_rect_for_progress_bar(hor_chunks.1); // metadata_rect, progress_bar_rect
                                 (ver_chunks.0, hor_chunks.0, ver_chunks.1)
                             }
@@ -82,12 +82,12 @@ pub fn render_playback_window(
                             if ui.last_cover_image_render_info.url != url
                                 || ui.last_cover_image_render_info.render_area != cover_img_rect
                             {
-                                let state = match ui.picker.new_protocol(
-                                    img.clone(),
-                                    cover_img_rect.into(),
-                                    ratatui_image::Resize::Fit(None),
+                                let state = match crate::ui::cover_image::CoverImage::new(
+                                    &ui.picker,
+                                    img,
+                                    cover_img_rect,
                                 ) {
-                                    Ok(protocol) => Some(protocol),
+                                    Ok(cover) => Some(cover),
                                     Err(err) => {
                                         tracing::error!("Failed to encode cover image: {err:#}");
                                         None
@@ -99,11 +99,9 @@ pub fn render_playback_window(
                                     state,
                                 };
                             }
-                            if let Some(ref protocol) = ui.last_cover_image_render_info.state {
-                                frame.render_widget(
-                                    ratatui_image::Image::new(protocol),
-                                    ui.last_cover_image_render_info.render_area,
-                                );
+                            let area = ui.last_cover_image_render_info.render_area;
+                            if let Some(cover) = ui.last_cover_image_render_info.state.as_mut() {
+                                cover.render(frame, area);
                             }
                         }
                     }
@@ -193,10 +191,10 @@ fn split_rect_for_progress_bar(rect: Rect) -> (Rect, Rect) {
 }
 
 #[cfg(feature = "image")]
-fn split_rect_for_cover_img(rect: Rect) -> (Rect, Rect) {
+fn split_rect_for_cover_img(rect: Rect, picker: &ratatui_image::picker::Picker) -> (Rect, Rect) {
     let configs = config::get_config();
     let hor_chunks = Layout::horizontal([
-        Constraint::Length(configs.app_config.cover_img_length as u16),
+        Constraint::Length(cover_img_length(configs, picker)),
         Constraint::Fill(0), // metadata_rect
     ])
     .spacing(1)
@@ -209,6 +207,20 @@ fn split_rect_for_cover_img(rect: Rect) -> (Rect, Rect) {
     (ver_chunks[0], hor_chunks[1])
 }
 
+/// Determine the cover image box's width in columns.
+#[cfg(feature = "image")]
+fn cover_img_length(configs: &config::Configs, picker: &ratatui_image::picker::Picker) -> u16 {
+    match configs.app_config.cover_img_length {
+        // When `cover_img_length` is `0` (the default), derive it from the terminal's cell aspect ratio
+        0 => {
+            let font_size = picker.font_size();
+            let rows = configs.app_config.cover_img_width as u16;
+            rows * font_size.height / font_size.width
+        }
+        length => length as u16,
+    }
+}
+
 fn construct_playback_text(
     ui: &UIStateGuard,
     state: &SharedState,
```

---

### Incident Patch 10: `77500411` (2026-06-29)
**Commit Message**: feat(ui): add Vim-style relative line numbers for lists and popups (#997)

- Added `enable_relative_line_number` configuration option to `AppConfig`.
- Implemented right-aligned relative line numbers capped at 2 digits for all list panels and popups.
<img width="3420" height="2032" alt="preview-tracks" src="https://github.com/user-attachments/assets/89c61144-2a35-49a3-8cbf-6f5e8fe2a4c2" />
<img width="3412" height="2030" alt="preview-albums" src="https://github.com/user-attachments/assets/8ee0095d-5bd1-4caf-b6a3-4d0e06d4aebe" />

- Implemented a hybrid relative line number style for track and episode tables, where the selected item shows its original absolute index, and others show their relative offset.
<img width="3416" height="2034" alt="preview-album" src="https://github.com/user-attachments/assets/837e545e-4995-4ca5-9334-c43fcbe67358" />

- Added `ui.count_prefix` support for popup lists to enable count prefix movements (e.g., 3j/2k) in popups.
<img width="3412" height="2032" alt="preview-popup" src="https://github.com/user-attachments/assets/d9275e24-ed7b-465e-b26a-ef87fa0de852" />

- Resolved multiple borrow checker conflicts in search page and popup event handlers.
- Update

**File**: `docs/config.md` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ spotify_player -o device.volume=80 -o theme=dracula
 | `enable_mouse_scroll_volume`      | Enable volume control via mouse scroll.                                                              | `true`                                                                 |
 | `custom_queue`                    | Enable app-managed queue for custom playback integration (requires `streaming` feature).             | `true`                                                                 |
 | `pause_on_startup`                | Start with playback paused instead of resuming the previous session (requires `streaming` feature).  | `false`                                                                |
+| `enable_relative_line_number`     | Enable Vim-style relative line numbers for lists and popups.                                         | `false`                                                                |
 | `device`                          | Device configuration (see below).                                                                    | See below                                                              |
 
 ### Notes
```

**File**: `examples/app.toml` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ cover_img_width = 5
 cover_img_pixels = 16
 seek_duration_secs = 5
 custom_queue = true
+enable_relative_line_number = false
 
 [device]
 name = "spotify-player"
```

**File**: `spotify_player/src/config/mod.rs` (modified, +4/-0)
```diff
@@ -138,6 +138,8 @@ pub struct AppConfig {
     /// management.
     pub custom_queue: bool,
 
+    pub enable_relative_line_number: bool,
+
     /// Start the application with playback paused instead of resuming the
     /// previous session. Requires streaming. When the integrated client
     /// connects on startup, Spotify may restore and auto-resume the last
@@ -396,6 +398,8 @@ impl Default for AppConfig {
 
             custom_queue: true,
 
+            enable_relative_line_number: false,
+
             #[cfg(feature = "streaming")]
             pause_on_startup: false,
         }
```

**File**: `spotify_player/src/event/popup.rs` (modified, +11/-8)
```diff
@@ -464,21 +464,24 @@ fn handle_command_for_list_popup(
     on_choose_func: impl FnOnce(&mut UIStateGuard, usize) -> anyhow::Result<()>,
     on_close_func: impl FnOnce(&mut UIStateGuard),
 ) -> anyhow::Result<bool> {
+    let offset = ui.count_prefix.unwrap_or(1);
     let popup = ui.popup.as_mut().with_context(|| "expect a popup")?;
     let current_id = popup.list_selected().unwrap_or_default();
 
+    if n_items == 0 {
+        return Ok(false);
+    }
+
     match command {
         Command::SelectPreviousOrScrollUp => {
-            if current_id > 0 {
-                popup.list_select(Some(current_id - 1));
-                on_select_func(ui, current_id - 1);
-            }
+            let next_id = current_id.saturating_sub(offset);
+            popup.list_select(Some(next_id));
+            on_select_func(ui, next_id);
         }
         Command::SelectNextOrScrollDown => {
-            if current_id + 1 < n_items {
-                popup.list_select(Some(current_id + 1));
-                on_select_func(ui, current_id + 1);
-            }
+            let next_id = std::cmp::min(current_id + offset, n_items - 1);
+            popup.list_select(Some(next_id));
+            on_select_func(ui, next_id);
         }
         Command::ChooseSelected => {
             if current_id < n_items {
```

**File**: `spotify_player/src/ui/page.rs` (modified, +124/-35)
```diff
@@ -48,12 +48,12 @@ pub fn render_search_page(
     // 1. Get data
     let data = state.data.read();
 
-    let (focus_state, current_query, line_input) = match ui.current_page() {
+    let (focus_state, current_query) = match ui.current_page() {
         PageState::Search {
             state,
             current_query,
-            line_input,
-        } => (state.focus, current_query, line_input),
+            ..
+        } => (state.focus, current_query),
         _ => return,
     };
 
@@ -140,8 +140,13 @@ pub fn render_search_page(
             .unwrap_or_default();
 
         let is_active = is_active && focus_state == SearchFocusState::Tracks;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, track_items, is_active)
+        utils::construct_list_widget(&ui.theme, track_items, is_active, selected_index)
     };
 
     let (album_list, n_albums) = {
@@ -150,8 +155,13 @@ pub fn render_search_page(
             .unwrap_or_default();
 
         let is_active = is_active && focus_state == SearchFocusState::Albums;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, album_items, is_active)
+        utils::construct_list_widget(&ui.theme, album_items, is_active, selected_index)
     };
 
     let (artist_list, n_artists) = {
@@ -160,8 +170,13 @@ pub fn render_search_page(
             .unwrap_or_default();
 
         let is_active = is_active && focus_state == SearchFocusState::Artists;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, artist_items, is_active)
+        utils::construct_list_widget(&ui.theme, artist_items, is_active, selected_index)
     };
 
     let (playlist_list, n_playlists) = {
@@ -170,17 +185,27 @@ pub fn render_search_page(
             .unwrap_or_default();
 
         let is_active = is_active && focus_state == SearchFocusState::Playlists;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, playlist_items, is_active)
+        utils::construct_list_widget(&ui.theme, playlist_items, is_active, selected_index)
     };
 
     let (show_list, n_shows) = {
         let show_items = search_results
             .map(|s| search_items(&s.shows))
             .unwrap_or_default();
         let is_active = is_active && focus_state == SearchFocusState::Shows;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, show_items, is_active)
+        utils::construct_list_widget(&ui.theme, show_items, is_active, selected_index)
     };
 
     let (episode_list, n_episodes) = {
@@ -189,25 +214,31 @@ pub fn render_search_page(
             .unwrap_or_default();
 
         let is_active = is_active && focus_state == SearchFocusState::Episodes;
+        let selected_index = if is_active {
+            ui.current_page_mut().selected()
+        } else {
+            None
+        };
 
-        utils::construct_list_widget(&ui.theme, episode_items, is_active)
+        utils::construct_list_widget(&ui.theme, episode_items, is_active, selected_index)
     };
 
     // 4. Render the page's widgets
-    // Render the query input box
-    frame.render_widget(
-        line_input.widget(is_active && focus_state == SearchFocusState::Input),
-        search_input_rect,
-    );
-
-    // Render the search result windows.
     // Need mutable access to the list/table states stored inside the page state for rendering.
     let PageState::Search {
-        state: page_state, ..
+        state: page_state,
+        line_input,
+        ..
     } = ui.current_page_mut()
     else {
         return;
     };
+
+    // Render the query input box
+    frame.render_widget(
+        line_input.widget(is_active && focus_state == SearchFocusState::Input),
+        search_input_rect,
+    );
     utils::render_list_window(
         frame,
         track_list,
@@ -455,30 +486,47 @@ pub fn render_library_page(
         })
         .collect::<Vec<_>>();
 
-    let (playlist_list, n_playlists) = utils::construct_list_widget(
-        &ui.theme,
-        items,
-        is_active
-            && focus_state != LibraryFocusState::SavedAlbums
-            && focus_state != LibraryFocusState::FollowedArtists,
-    );
+    let is_playlist_active = is_active
+        && focus_state != LibraryFocusState::SavedAlbums
+        && focus_state != LibraryFocusState::FollowedArtists;
+    let playlist_selected = if is_playlist_active {
+        ui.current_page_mut().
```

**File**: `spotify_player/src/ui/popup.rs` (modified, +2/-1)
```diff
@@ -228,7 +228,8 @@ fn render_list_popup(
     let chunks = Layout::vertical([Constraint::Fill(0), Constraint::Length(length)]).split(rect);
 
     let rect = construct_and_render_block(title, &ui.theme, Borders::ALL, frame, chunks[1]);
-    let (list, len) = utils::construct_list_widget(&ui.theme, items, true);
+    let selected_index = ui.popup.as_ref().and_then(PopupState::list_selected);
+    let (list, len) = utils::construct_list_widget(&ui.theme, items, true, selected_index);
 
     utils::render_list_window(
         frame,
```

**File**: `spotify_player/src/ui/utils.rs` (modified, +16/-2)
```diff
@@ -55,15 +55,29 @@ pub fn construct_list_widget<'a>(
     theme: &config::Theme,
     items: Vec<(String, bool)>,
     is_active: bool,
+    selected_index: Option<usize>,
 ) -> (List<'a>, usize) {
+    let configs = config::get_config();
     let n_items = items.len();
 
     (
         List::new(
             items
                 .into_iter()
-                .map(|(s, is_active)| {
-                    ListItem::new(s).style(if is_active {
+                .enumerate()
+                .map(|(i, (s, is_playing))| {
+                    let text = if is_active && configs.app_config.enable_relative_line_number {
+                        if let Some(selected_index) = selected_index {
+                            let diff = (i as isize - selected_index as isize).abs();
+                            let width = std::cmp::min(n_items.to_string().len(), 2);
+                            format!("{diff:>width$}  {s}")
+                        } else {
+                            s
+                        }
+                    } else {
+                        s
+                    };
+                    ListItem::new(text).style(if is_playing {
                         theme.current_playing()
                     } else {
                         Style::default()
```

---

### Incident Patch 11: `1a674bef` (2026-06-29)
**Commit Message**: Fix image rendering issues (#1012)

Also fix a deadlock issue when initializing the app's terminal

**File**: `Cargo.lock` (modified, +10/-3)
```diff
@@ -2317,7 +2317,7 @@ dependencies = [
  "js-sys",
  "log",
  "wasm-bindgen",
- "windows-core 0.58.0",
+ "windows-core 0.61.2",
 ]
 
 [[package]]
@@ -4715,16 +4715,17 @@ dependencies = [
 
 [[package]]
 name = "ratatui-image"
-version = "10.0.6"
+version = "11.0.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c57add959ab80c9a92be620fa6f8e4a64f7c014829250ba78862e8d81a903cb5"
+checksum = "e000b7a22eae639460bc6ec8bb1cc689ecae5b0ed21935cd7d7dd52d38270c86"
 dependencies = [
  "base64-simd",
  "icy_sixel",
  "image",
  "rand 0.8.6",
  "ratatui",
  "rustix 0.38.44",
+ "self_cell",
  "thiserror 1.0.69",
  "windows 0.58.0",
 ]
@@ -5379,6 +5380,12 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "self_cell"
+version = "1.2.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b12e76d157a900eb52e81bc6e9f3069344290341720e9178cde2407113ac8d89"
+
 [[package]]
 name = "semver"
 version = "1.0.28"
```

**File**: `spotify_player/Cargo.toml` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ unicode-bidi = "0.3.18"
 futures = "0.3.32"
 # fix for https://github.com/aome510/spotify-player/issues/914
 vergen = "=9.0.6"
-ratatui-image = { version = "10.0.6", optional = true, default-features = false, features = ["crossterm"] }
+ratatui-image = { version = "11.0.6", optional = true, default-features = false, features = ["crossterm"] }
 
 [target.'cfg(any(target_os = "windows", target_os = "macos"))'.dependencies.winit]
 version = "0.30.13"
```

**File**: `spotify_player/src/main.rs` (modified, +5/-1)
```diff
@@ -168,6 +168,10 @@ async fn start_app(state: &state::SharedState) -> Result<()> {
         })?;
 
     if !state.is_daemon {
+        #[cfg(feature = "image")]
+        ui::init_image_picker(state).context("initialize image picker")?;
+        let terminal = ui::init_terminal().context("initialize terminal")?;
+
         // terminal event handler task
         std::thread::Builder::new()
             .name("terminal-event-handler".to_string())
@@ -182,7 +186,7 @@ async fn start_app(state: &state::SharedState) -> Result<()> {
         // application UI task
         std::thread::Builder::new().name("ui".to_string()).spawn({
             let state = state.clone();
-            move || ui::run(&state)
+            move || ui::run(&state, terminal)
         })?;
     }
 
```

**File**: `spotify_player/src/state/ui/mod.rs` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ use crate::{
 };
 
 #[cfg(feature = "image")]
-use ratatui_image::{picker::Picker, protocol::StatefulProtocol};
+use ratatui_image::{picker::Picker, protocol::Protocol};
 
 pub type UIStateGuard<'a> = parking_lot::MutexGuard<'a, UIState>;
 
@@ -21,7 +21,7 @@ pub use popup::*;
 pub struct ImageRenderInfo {
     pub url: String,
     pub render_area: ratatui::layout::Rect,
-    pub state: Option<StatefulProtocol>,
+    pub state: Option<Protocol>,
 }
 
 #[cfg(feature = "image")]
```

**File**: `spotify_player/src/ui/mod.rs` (modified, +36/-41)
```diff
@@ -32,46 +32,8 @@ pub mod single_line_input;
 pub mod streaming;
 pub mod utils;
 
-/// Whether the application is running inside iTerm2.
-///
-/// iTerm2 sets `TERM_PROGRAM=iTerm.app` locally and forwards `LC_TERMINAL=iTerm2`
-/// over SSH, so checking both covers the common cases.
-#[cfg(feature = "image")]
-fn is_iterm2() -> bool {
-    std::env::var("TERM_PROGRAM").is_ok_and(|v| v == "iTerm.app")
-        || std::env::var("LC_TERMINAL").is_ok_and(|v| v.eq_ignore_ascii_case("iTerm2"))
-}
-
 /// Run the application UI
-pub fn run(state: &SharedState) -> Result<()> {
-    #[cfg(feature = "image")]
-    {
-        crossterm::terminal::enable_raw_mode()?;
-        let mut ui = state.ui.lock();
-        ui.picker = match ratatui_image::picker::Picker::from_query_stdio() {
-            Ok(p) => p,
-            Err(err) => {
-                tracing::warn!("Failed to initialize query_stdio picker, error: {err:#}");
-                ratatui_image::picker::Picker::halfblocks()
-            }
-        };
-        crossterm::terminal::disable_raw_mode()?;
-
-        // `from_query_stdio` selects a protocol from the terminal's capability query
-        // (`CSI c`), which prioritizes Kitty/Sixel over iTerm2's native protocol.
-        // Modern iTerm2 advertises Sixel support in that response, so it gets detected
-        // as a Sixel terminal even though its native inline-image protocol renders far
-        // more reliably. Prefer the native protocol when we know we're running in iTerm2.
-        if is_iterm2() && ui.picker.protocol_type() == ratatui_image::picker::ProtocolType::Sixel {
-            ui.picker
-                .set_protocol_type(ratatui_image::picker::ProtocolType::Iterm2);
-            tracing::info!("Detected iTerm2; overriding image protocol to native iTerm2");
-        }
-        tracing::info!("Image protocol: {:?}", ui.picker.protocol_type());
-    }
-
-    let mut terminal = init_ui().context("failed to initialize the application's UI")?;
-
+pub fn run(state: &SharedState, mut terminal: Terminal) -> Result<()> {
     let ui_refresh_duration = std::time::Duration::from_millis(
         config::get_config().app_config.app_refresh_duration_in_ms,
     );
@@ -111,8 +73,7 @@ pub fn run(state: &SharedState) -> Result<()> {
     }
 }
 
-// initialize the application's UI
-fn init_ui() -> Result<Terminal> {
+pub fn init_terminal() -> Result<Terminal> {
     let mut stdout = std::io::stdout();
     crossterm::terminal::enable_raw_mode()?;
     crossterm::execute!(
@@ -126,6 +87,40 @@ fn init_ui() -> Result<Terminal> {
     Ok(terminal)
 }
 
+#[cfg(feature = "image")]
+pub fn init_image_picker(state: &SharedState) -> Result<()> {
+    let mut ui = state.ui.lock();
+    crossterm::terminal::enable_raw_mode()?;
+    ui.picker = match ratatui_image::picker::Picker::from_query_stdio() {
+        Ok(p) => p,
+        Err(err) => {
+            tracing::warn!("Failed to initialize query_stdio picker, error: {err:#}");
+            ratatui_image::picker::Picker::halfblocks()
+        }
+    };
+    crossterm::terminal::disable_raw_mode()?;
+
+    // ratatui_image might detect the wrong protocol for iTerm2, so override it to the native iTerm2 protocol if detected
+    // https://github.com/ratatui/ratatui-image/issues/158
+    if is_iterm2() && ui.picker.protocol_type() != ratatui_image::picker::ProtocolType::Iterm2 {
+        ui.picker
+            .set_protocol_type(ratatui_image::picker::ProtocolType::Iterm2);
+        tracing::info!("Detected iTerm2; overriding image protocol to native iTerm2");
+    }
+    tracing::info!("Image protocol: {:?}", ui.picker.protocol_type());
+    Ok(())
+}
+
+/// Whether the application is running inside iTerm2.
+///
+/// iTerm2 sets `TERM_PROGRAM=iTerm.app` locally and forwards `LC_TERMINAL=iTerm2`
+/// over SSH, so checking both covers the common cases.
+#[cfg(feature = "image")]
+fn is_iterm2() -> bool {
+    std::env::var("TERM_PROGRAM").is_ok_and(|v| v == "iTerm.app")
+        || std::env::var("LC_TERMINAL").is_ok_and(|v| v.eq_ignore_ascii_case("iTerm2"))
+}
+
 /// Clean up UI resources before quitting the application
 fn clean_up(mut terminal: Terminal) -> Result<()> {
     crossterm::terminal::disable_raw_mode()?;
```

**File**: `spotify_player/src/ui/playback.rs` (modified, +17/-15)
```diff
@@ -82,26 +82,28 @@ pub fn render_playback_window(
                             if ui.last_cover_image_render_info.url != url
                                 || ui.last_cover_image_render_info.render_area != cover_img_rect
                             {
-                                let protocol = ui.picker.new_resize_protocol(img.clone());
+                                let state = match ui.picker.new_protocol(
+                                    img.clone(),
+                                    cover_img_rect.into(),
+                                    ratatui_image::Resize::Fit(None),
+                                ) {
+                                    Ok(protocol) => Some(protocol),
+                                    Err(err) => {
+                                        tracing::error!("Failed to encode cover image: {err:#}");
+                                        None
+                                    }
+                                };
                                 ui.last_cover_image_render_info = ImageRenderInfo {
                                     url,
                                     render_area: cover_img_rect,
-                                    state: Some(protocol),
+                                    state,
                                 };
                             }
-
-                            // set the `skip` state of cells in the cover image area
-                            // to prevent buffer from overwriting the image's rendered area
-                            // NOTE: `skip` should not be set when clearing the render area.
-                            // Otherwise, nothing will be clear as the buffer doesn't handle cells with `skip=true`.
-                            for x in cover_img_rect.left()..cover_img_rect.right() {
-                                for y in cover_img_rect.top()..cover_img_rect.bottom() {
-                                    frame
-                                        .buffer_mut()
-                                        .cell_mut((x, y))
-                                        .expect("invalid cell")
-                                        .set_diff_option(ratatui::buffer::CellDiffOption::Skip);
-                                }
+                            if let Some(ref protocol) = ui.last_cover_image_render_info.state {
+                                frame.render_widget(
+                                    ratatui_image::Image::new(protocol),
+                                    ui.last_cover_image_render_info.render_area,
+                                );
                             }
                         }
                     }
```

---

### Incident Patch 12: `ace3ccc9` (2026-06-28)
**Commit Message**: fix: deduplicate history (#988)

Now the page history isn't updated when you go to the page you're
currently at.

Before, when you pressed e.g. 'l' multiple times to go to the lyrics
page, you needed to press 'Backspace' the same number of times to go
back to where you came from.

**File**: `spotify_player/src/state/model.rs` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ pub struct PlaylistFolderNode {
     pub children: Vec<PlaylistFolderNode>,
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 /// A Spotify category
 pub struct Category {
     pub id: String,
```

**File**: `spotify_player/src/state/ui/mod.rs` (modified, +6/-1)
```diff
@@ -77,8 +77,13 @@ impl UIState {
     }
 
     pub fn new_page(&mut self, page: PageState) {
-        self.history.push(page);
         self.popup = None;
+        if let Some(current_page) = self.history.last() {
+            if &page == current_page {
+                return;
+            }
+        }
+        self.history.push(page);
     }
 
     /// Return whether there exists a focused popup.
```

**File**: `spotify_player/src/state/ui/page.rs` (modified, +6/-6)
```diff
@@ -4,7 +4,7 @@ use crate::{
 };
 use ratatui::widgets::{ListState, TableState};
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub enum PageState {
     Library {
         state: LibraryPageUIState,
@@ -50,7 +50,7 @@ pub enum PageType {
     Logs,
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub struct LibraryPageUIState {
     pub playlist_list: ListState,
     pub saved_album_list: ListState,
@@ -59,7 +59,7 @@ pub struct LibraryPageUIState {
     pub playlist_folder_id: usize,
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub struct SearchPageUIState {
     pub track_list: ListState,
     pub album_list: ListState,
@@ -70,13 +70,13 @@ pub struct SearchPageUIState {
     pub focus: SearchFocusState,
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub enum ContextPageType {
     CurrentPlaying,
     Browsing(ContextId),
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub enum ContextPageUIState {
     Playlist {
         track_table: TableState,
@@ -123,7 +123,7 @@ pub enum SearchFocusState {
     Episodes,
 }
 
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq)]
 pub enum BrowsePageUIState {
     CategoryList {
         state: ListState,
```

**File**: `spotify_player/src/ui/single_line_input.rs` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ use ratatui::widgets::Widget;
 use super::{Line, Modifier, Paragraph, Span, Style};
 use crate::key::Key;
 
-#[derive(Debug, Clone)]
+#[derive(Debug, Clone, PartialEq)]
 pub struct LineInput {
     // This is less space-efficient than String, but it's easier to work with text manipulation at the
     // cursor. Otherwise, you have to shuffle back and forth between String and String::chars().
```

---

### Incident Patch 13: `f7cf915a` (2026-06-28)
**Commit Message**: Migration to ratatui_image instead of viuer (#969)

Resolves #963 
Resolves #1003
Resolves #1001

Screenshot:
<img width="1668" height="1398" alt="image" src="https://github.com/user-attachments/assets/3e462e59-5e7f-4023-8341-64b95583765b" />

## Summary
- Replace `viuer` with `ratatui-image` for rendering cover images
- Remove manual `set_skip` / `clear_area` hacks — `ratatui-image` renders as a native ratatui widget
- Remove `viuer` initialization in `main.rs`, use `Picker::from_query_stdio()` for protocol auto-detection
- Remove `cover_img_scale` usage (no longer needed — scaling is handled by `ratatui-image`)

## Notes
`Picker::from_query_stdio()` must run after `enable_raw_mode()` but before `EnterAlternateScreen` for correct protocol detection.

In nested terminals (e.g. neovim floating terminal), stdio queries don't reach the actual terminal emulator, so the protocol falls back to Halfblocks. This is a known limitation of `ratatui-image`'s detection approach. Regular terminals (foot, kitty, iTerm2, etc.) work correctly

---------

Co-authored-by: yokko <[REDACTED_EMAIL]>
Co-authored-by: Thang Pham <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +181/-95)
```diff
@@ -158,15 +158,6 @@ dependencies = [
  "libc",
 ]
 
-[[package]]
-name = "ansi_colours"
-version = "1.2.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "14eec43e0298190790f41679fe69ef7a829d2a2ddd78c8c00339e84710e435fe"
-dependencies = [
- "rgb",
-]
-
 [[package]]
 name = "anstream"
 version = "1.0.0"
@@ -422,6 +413,16 @@ version = "0.22.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
+[[package]]
+name = "base64-simd"
+version = "0.8.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "339abbe78e73178762e23bea9dfd08e697eb3f3301cd4be981c0f78ba5859195"
+dependencies = [
+ "outref",
+ "vsimd",
+]
+
 [[package]]
 name = "base64ct"
 version = "1.8.3"
@@ -470,6 +471,18 @@ dependencies = [
  "no_std_io2",
 ]
 
+[[package]]
+name = "bitvec"
+version = "1.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1bc2832c24239b0141d5674bb9174f9d68a8b5b3f2753311927c172ca46f7e9c"
+dependencies = [
+ "funty",
+ "radium",
+ "tap",
+ "wyz",
+]
+
 [[package]]
 name = "block"
 version = "0.1.6"
@@ -526,6 +539,20 @@ name = "bytemuck"
 version = "1.25.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
+dependencies = [
+ "bytemuck_derive",
+]
+
+[[package]]
+name = "bytemuck_derive"
+version = "1.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f9abbd1bc6865053c427f7198e6af43bfdedc55ab791faed4fbd361d789575ff"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 2.0.118",
+]
 
 [[package]]
 name = "byteorder"
@@ -829,18 +856,6 @@ dependencies = [
  "syn 2.0.118",
 ]
 
-[[package]]
-name = "console"
-version = "0.15.11"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "054ccb5b10f9f2cbf51eb355ca1d05c2d279ce1804688d0db74b4733a5aeafd8"
-dependencies = [
- "encode_unicode",
- "libc",
- "once_cell",
- "windows-sys 0.59.0",
-]
-
 [[package]]
 name = "const-oid"
 version = "0.9.6"
@@ -1018,19 +1033,6 @@ version = "0.8.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d0a5c400df2834b80a4c3327b3aad3a4c4cd4de0629063962b03235697506a28"
 
-[[package]]
-name = "crossterm"
-version = "0.28.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "829d955a0bb380ef178a640b91779e3987da38c9aea133b20614cfed8cdea9c6"
-dependencies = [
- "bitflags 2.13.0",
- "crossterm_winapi",
- "parking_lot",
- "rustix 0.38.44",
- "winapi",
-]
-
 [[package]]
 name = "crossterm"
 version = "0.29.0"
@@ -1387,12 +1389,6 @@ version = "1.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "91622ff5e7162018101f2fea40d6ebf4a78bbe5a49736a2020649edf9693679e"
 
-[[package]]
-name = "encode_unicode"
-version = "1.0.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "34aa73646ffb006b8f5147f3dc182bd4bcb190227ce861fc4a4844bf8e3cb2c0"
-
 [[package]]
 name = "encoding_rs"
 version = "0.8.35"
@@ -1640,6 +1636,12 @@ version = "1.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "42703706b716c37f96a77aea830392ad231f44c9e9a67872fa5548707e11b11c"
 
+[[package]]
+name = "funty"
+version = "2.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e6d5a32815ae3f33302d95fdcb2ce17862f8c65363dcfd29360480ba1001fc9c"
+
 [[package]]
 name = "futures"
 version = "0.3.32"
@@ -2409,6 +2411,16 @@ dependencies = [
  "zerovec",
 ]
 
+[[package]]
+name = "icy_sixel"
+version = "0.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "85518b9086bf01117761b90e7691c0ef3236fa8adfb1fb44dd248fe5f87215d5"
+dependencies = [
+ "quantette",
+ "thiserror 2.0.18",
+]
+
 [[package]]
 name = "ident_case"
 version = "1.0.1"
@@ -3131,12 +3143,6 @@ dependencies = [
  "libc",
 ]
 
-[[package]]
-name = "make-cmd"
-version = "0.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a8ca8afbe8af1785e09636acb5a41e08a765f5f0340568716c18a8700ba3c0d3"
-
 [[package]]
 name = "malloc_buf"
 version = "0.0.6"
@@ -3932,6 +3938,21 @@ dependencies = [
  "num-traits",
 ]
 
+[[package]]
+name = "ordered-float"
+version = "5.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b7d950ca161dc355eaf28f82b11345ed76c6e1f6eb1f4f4479e0323b9e2fbd0e"
+dependencies = [
+ "num-traits",
+]
+
+[[package]]
+name = "outref"
+version = "0.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1a80800c0488c3a21695ea981a54918fbb37abf04f4d0720c453632255e2ff0e"
+
 [[package]]
 name = "owned_ttf_parser"
 version = "0.25.1"
@@ -3948,6 +3969,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4cbf71184cc5ecc2e4e1baccdb21026c20e5fc3dcf63028a086131b3ab00b6e6"
 dependencies = [
  "approx"
```

**File**: `README.md` (modified, +3/-10)
```diff
@@ -245,18 +245,11 @@ To enable image rendering, build with the `image` feature (disabled by default):
 cargo install spotify_player --features image
 ```
 
-Full-resolution images are supported in [Kitty](https://sw.kovidgoyal.net/kitty/graphics-protocol/) and [iTerm2](https://iterm2.com/documentation-images.html). Other terminals display images as [block characters](https://en.wikipedia.org/wiki/Block_Elements).
-
-To use sixel graphics, build with the `sixel` feature (also enables `image`):
-
-```shell
-cargo install spotify_player --features sixel
-```
+Image rendering is powered by [`ratatui-image`](https://github.com/benjajaja/ratatui-image), which auto-detects the terminal's graphics protocol (Kitty, iTerm2, Sixel) on startup. Terminals without any graphics protocol support fall back to [block characters](https://en.wikipedia.org/wiki/Block_Elements).
 
 **Notes**:
 
-- Not all terminals supported by [libsixel](https://github.com/saitoha/libsixel) are supported by `spotify_player` (see [viuer supported terminals](https://github.com/atanunq/viuer/blob/dc81f44a97727e04be0b000712e9233c92116ff8/src/printer/sixel.rs#L83-L95)).
-- Sixel images may scale oddly; adjust `cover_img_scale` for best results.
+- Protocol detection queries the terminal via stdio. In nested terminals (e.g. Neovim's floating terminal), the query does not reach the outer terminal emulator, so the protocol falls back to block characters.
 
 Image rendering examples:
 
@@ -268,7 +261,7 @@ Image rendering examples:
 
 ![kitty](https://user-images.githubusercontent.com/40011582/172967028-8cfb2daa-1642-499a-a5bf-8ed77f2b3fac.png)
 
-- Sixel (`foot` terminal, `cover_img_scale=1.8`):
+- Sixel (`foot` terminal):
 
 ![sixel](https://user-images.githubusercontent.com/40011582/219880331-58ac1c30-bbb0-4c99-a6cc-e5b7c9c81455.png)
 
```

**File**: `docs/config.md` (modified, +0/-1)
```diff
@@ -66,7 +66,6 @@ spotify_player -o device.volume=80 -o theme=dracula
 | `genre_num`                       | Max number of genres to display in playback text.                                              | `2`                                                                    |
 | `cover_img_length`                | Cover image length (requires `image` feature).                                                 | `9`                                                                    |
 | `cover_img_width`                 | Cover image width (requires `image` feature).                                                  | `5`                                                                    |
-| `cover_img_scale`                 | Cover image scale (requires `image` feature).                                                  | `1.0`                                                                  |
 | `cover_img_pixels`                | Pixels per side for cover image (requires `pixelate` feature).                                 | `16`                                                                   |
 | `seek_duration_secs`              | Seek duration in seconds for seek commands.                                                    | `5`                                                                    |
 | `sort_artist_albums_by_type`      | Sort albums by type on artist pages.                                                           | `false`                                                                |
```

**File**: `spotify_player/Cargo.toml` (modified, +3/-4)
```diff
@@ -42,8 +42,6 @@ tracing = "0.1.44"
 tracing-subscriber = { version = "0.3.23", features = ["env-filter"] }
 backtrace = "0.3.76"
 souvlaki = { version = "0.8.3", optional = true }
-# Upgrade viuer to the latest version. Need to resolve the freezing issue in https://github.com/aome510/spotify-player/issues/899 beforehand
-viuer = { version = "=0.9.2", optional = true }
 image = { version = "0.25.10", optional = true }
 notify-rust = { version = "4.18.0", optional = true, default-features = false, features = [
 	"d",
@@ -63,6 +61,7 @@ unicode-bidi = "0.3.18"
 futures = "0.3.32"
 # fix for https://github.com/aome510/spotify-player/issues/914
 vergen = "=9.0.6"
+ratatui-image = { version = "10.0.6", optional = true, default-features = false, features = ["crossterm"] }
 
 [target.'cfg(any(target_os = "windows", target_os = "macos"))'.dependencies.winit]
 version = "0.30.13"
@@ -92,8 +91,8 @@ sdl-backend = ["streaming", "librespot-playback/sdl-backend"]
 gstreamer-backend = ["streaming", "librespot-playback/gstreamer-backend"]
 streaming = ["librespot-playback", "librespot-connect", "rustfft"]
 media-control = ["souvlaki", "winit", "windows"]
-image = ["viuer", "dep:image"]
-sixel = ["image", "viuer/sixel"]
+image = ["ratatui-image", "dep:image"]
+sixel = ["image"]
 pixelate = ["image"]
 notify = ["notify-rust"]
 daemon = ["daemonize", "streaming"]
```

**File**: `spotify_player/src/cli/handlers.rs` (modified, +1/-1)
```diff
@@ -377,7 +377,7 @@ fn print_features() {
     print_feature!("streaming");
     print_feature!("media-control");
     print_feature!("image");
-    print_feature!("viuer");
+    print_feature!("ratatui-image");
     print_feature!("sixel");
     print_feature!("pixelate");
     print_feature!("notify");
```

**File**: `spotify_player/src/config/mod.rs` (modified, +0/-4)
```diff
@@ -103,8 +103,6 @@ pub struct AppConfig {
     pub cover_img_length: usize,
     #[cfg(feature = "image")]
     pub cover_img_width: usize,
-    #[cfg(feature = "image")]
-    pub cover_img_scale: f32,
     #[cfg(feature = "pixelate")]
     pub cover_img_pixels: u32,
 
@@ -351,8 +349,6 @@ impl Default for AppConfig {
             cover_img_length: 9,
             #[cfg(feature = "image")]
             cover_img_width: 5,
-            #[cfg(feature = "image")]
-            cover_img_scale: 1.0,
             #[cfg(feature = "pixelate")]
             cover_img_pixels: 16,
 
```

**File**: `spotify_player/src/main.rs` (modified, +0/-11)
```diff
@@ -97,17 +97,6 @@ fn init_logging(
 
 #[tokio::main]
 async fn start_app(state: &state::SharedState) -> Result<()> {
-    if !state.is_daemon {
-        #[cfg(feature = "image")]
-        {
-            // initialize `viuer` supports for kitty, iterm2, and sixel
-            viuer::get_kitty_support();
-            viuer::is_iterm_supported();
-            #[cfg(feature = "sixel")]
-            viuer::is_sixel_supported();
-        }
-    }
-
     // client channels
     let (client_pub, client_sub) = flume::unbounded::<client::ClientRequest>();
 
```

**File**: `spotify_player/src/state/ui/mod.rs` (modified, +23/-3)
```diff
@@ -5,6 +5,9 @@ use crate::{
     utils::filtered_items_from_query,
 };
 
+#[cfg(feature = "image")]
+use ratatui_image::{picker::Picker, protocol::StatefulProtocol};
+
 pub type UIStateGuard<'a> = parking_lot::MutexGuard<'a, UIState>;
 
 mod page;
@@ -13,13 +16,23 @@ mod popup;
 pub use page::*;
 pub use popup::*;
 
-#[derive(Default, Debug)]
 #[cfg(feature = "image")]
+#[derive(Default)]
 pub struct ImageRenderInfo {
     pub url: String,
     pub render_area: ratatui::layout::Rect,
-    /// indicates if the image is rendered
-    pub rendered: bool,
+    pub state: Option<StatefulProtocol>,
+}
+
+#[cfg(feature = "image")]
+impl std::fmt::Debug for ImageRenderInfo {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.debug_struct("ImageRenderInfo")
+            .field("url", &self.url)
+            .field("render_area", &self.render_area)
+            .field("state", &self.state.is_some())
+            .finish()
+    }
 }
 
 /// Application's UI state
@@ -42,6 +55,9 @@ pub struct UIState {
 
     #[cfg(feature = "image")]
     pub last_cover_image_render_info: ImageRenderInfo,
+
+    #[cfg(feature = "image")]
+    pub picker: Picker,
 }
 
 impl UIState {
@@ -111,6 +127,10 @@ impl Default for UIState {
 
             #[cfg(feature = "image")]
             last_cover_image_render_info: ImageRenderInfo::default(),
+
+            // Will be reinitialize later in ui/mod.rs after init_ui()
+            #[cfg(feature = "image")]
+            picker: Picker::halfblocks(),
         }
     }
 }
```

---

### Incident Patch 14: `37ec54b9` (2026-05-14)
**Commit Message**: Fix clippy collapsible match warning (#989)

**File**: `lyric_finder/src/lib.rs` (modified, +2/-4)
```diff
@@ -249,10 +249,8 @@ mod parse {
         }
 
         match &node.data {
-            NodeData::Text { contents } => {
-                if should_parse {
-                    s.push_str(&contents.borrow().to_string());
-                }
+            NodeData::Text { contents } if should_parse => {
+                s.push_str(&contents.borrow().to_string());
             }
             NodeData::Element { ref name, .. } => {
                 if let expanded_name!(html "br") = name.expanded() {
```

**File**: `spotify_player/src/event/page.rs` (modified, +3/-3)
```diff
@@ -121,12 +121,12 @@ fn handle_command_for_library_page(
         // Sort albums alphabetically
         data.user_data
             .saved_albums
-            .sort_by(|x, y| x.name.to_lowercase().cmp(&y.name.to_lowercase()));
+            .sort_by_key(|x| x.name.to_lowercase());
 
         // Sort artists alphabetically
         data.user_data
             .followed_artists
-            .sort_by(|x, y| x.name.to_lowercase().cmp(&y.name.to_lowercase()));
+            .sort_by_key(|x| x.name.to_lowercase());
     }
 
     if command == Command::SortLibraryByRecent {
@@ -155,7 +155,7 @@ fn handle_command_for_library_page(
         // Sort albums by recent addition
         data.user_data
             .saved_albums
-            .sort_by(|a, b| b.added_at.cmp(&a.added_at));
+            .sort_by_key(|a| std::cmp::Reverse(a.added_at));
     }
 
     match focus_state {
```

**File**: `spotify_player/src/event/popup.rs` (modified, +2/-0)
```diff
@@ -27,6 +27,8 @@ pub fn handle_key_sequence_for_popup(
                 ui,
             );
         }
+        // can't use match guard: the match holds an immutable borrow of ui
+        #[allow(clippy::collapsible_match)]
         PopupState::UserPlaylistList(..) => {
             if handle_key_sequence_for_playlist_search_popup(key_sequence, ui) {
                 return Ok(true);
```

**File**: `spotify_player/src/media_control.rs` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ pub fn start_event_watcher(
     // The below refresh duration should be no less than 1s to avoid **overloading** linux dbus
     // handler provided by the souvlaki library, which only handles an event every 1s.
     // [1]: https://github.com/Sinono3/souvlaki/blob/b4d47bb2797ffdd625c17192df640510466762e1/src/platform/linux/mod.rs#L450
-    let refresh_duration = std::time::Duration::from_millis(1000);
+    let refresh_duration = std::time::Duration::from_secs(1);
     let mut info = String::new();
     loop {
         update_control_metadata(state, &mut controls, &mut info)?;
```

**File**: `spotify_player/src/state/data.rs` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ pub enum FileCacheKey {
 
 /// default time-to-live cache duration
 pub static TTL_CACHE_DURATION: LazyLock<std::time::Duration> =
-    LazyLock::new(|| std::time::Duration::from_secs(60 * 60));
+    LazyLock::new(|| std::time::Duration::from_hours(1));
 
 /// the application's data
 pub struct AppData {
```

---

### Incident Patch 15: `9c4a5952` (2026-04-03)
**Commit Message**: Add logs page to see application's logs directly in UI (#957)

Closes #954

Adds an in-app log viewer accessible via g o keybind.

Changes:

Added BufferLayer tracing layer that writes logs to a shared ring buffer (1000 lines max) alongside the existing file writer
Added PageState::Logs and Command::OpenLogs
Added render_logs_page with scroll support (j/k)
Default keybind: g o

Screenshot:
<img width="1668" height="1398" alt="image" src="https://github.com/user-attachments/assets/408e6f29-cb6c-425a-8469-514aa69cd43c" />

---------

Co-authored-by: yokko <[REDACTED_EMAIL]>
Co-authored-by: Thang Pham <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-0)
```diff
@@ -419,6 +419,7 @@ List of supported commands:
 | `Queue`                         | go to the queue page                                                                               | `z`                |
 | `OpenCommandHelp`               | go to the command help page                                                                        | `?`, `C-h`         |
 | `PreviousPage`                  | go to the previous page                                                                            | `backspace`, `C-q` |
+| `OpenLogs`                      | go the the application logs page                                                                   | `g o`              |
 | `OpenSpotifyLinkFromClipboard`  | open a Spotify link from clipboard                                                                 | `O`                |
 | `SortTrackByTitle`              | sort the track table (if any) by track's title                                                     | `s t`              |
 | `SortTrackByArtists`            | sort the track table (if any) by track's artists                                                   | `s a`              |
```

**File**: `spotify_player/src/command.rs` (modified, +2/-0)
```diff
@@ -89,6 +89,7 @@ pub enum Command {
     MovePlaylistItemDown,
 
     CreatePlaylist,
+    OpenLogs,
 }
 
 #[derive(Clone, Copy, Debug, Deserialize)]
@@ -372,6 +373,7 @@ impl Command {
             Self::MovePlaylistItemDown => "move playlist item down one position",
             Self::CreatePlaylist => "create a new playlist",
             Self::VolumeChange { offset: _ } => unreachable!(),
+            Self::OpenLogs => "go to the application logs page",
         }
         .to_string()
     }
```

**File**: `spotify_player/src/config/keymap.rs` (modified, +4/-0)
```diff
@@ -328,6 +328,10 @@ impl Default for KeymapConfig {
                     key_sequence: "g c".into(),
                     command: Command::JumpToCurrentTrackInContext,
                 },
+                Keymap {
+                    key_sequence: "g o".into(),
+                    command: Command::OpenLogs,
+                },
             ],
         }
     }
```

**File**: `spotify_player/src/event/mod.rs` (modified, +3/-0)
```diff
@@ -626,6 +626,9 @@ fn handle_global_command(
         Command::OpenCommandHelp => {
             ui.new_page(PageState::CommandHelp { scroll_offset: 0 });
         }
+        Command::OpenLogs => {
+            ui.new_page(PageState::Logs { scroll_offset: 0 });
+        }
         Command::RefreshPlayback => {
             client_pub.send(ClientRequest::GetCurrentPlayback)?;
         }
```

**File**: `spotify_player/src/event/page.rs` (modified, +10/-0)
```diff
@@ -31,6 +31,7 @@ pub fn handle_key_sequence_for_page(
             PageType::Lyrics => Ok(false),
             PageType::Queue => Ok(handle_command_for_queue_page(command, ui)),
             PageType::CommandHelp => Ok(handle_command_for_command_help_page(command, ui)),
+            PageType::Logs => Ok(handle_command_for_logs_page(command, ui)),
         },
         Some(CommandOrAction::Action(action, ActionTarget::SelectedItem)) => match page_type {
             PageType::Search => anyhow::bail!("page search type should already be handled!"),
@@ -554,6 +555,15 @@ fn handle_command_for_command_help_page(command: Command, ui: &mut UIStateGuard)
     handle_navigation_command(command, ui.current_page_mut(), scroll_offset, 10000, count)
 }
 
+fn handle_command_for_logs_page(command: Command, ui: &mut UIStateGuard) -> bool {
+    let scroll_offset = match ui.current_page() {
+        PageState::Logs { scroll_offset } => *scroll_offset,
+        _ => return false,
+    };
+    let count = ui.count_prefix;
+    handle_navigation_command(command, ui.current_page_mut(), scroll_offset, 10000, count)
+}
+
 pub fn handle_navigation_command(
     command: Command,
     page: &mut PageState,
```

**File**: `spotify_player/src/log_layer.rs` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+use std::{collections::VecDeque, sync::Arc};
+
+use parking_lot::Mutex;
+use tracing::Subscriber;
+use tracing_subscriber::Layer;
+
+pub struct BufferLayer {
+    buffer: Arc<Mutex<VecDeque<String>>>,
+    max_lines: usize,
+}
+
+impl BufferLayer {
+    pub fn new(buffer: Arc<Mutex<VecDeque<String>>>, max_lines: usize) -> Self {
+        Self { buffer, max_lines }
+    }
+}
+
+impl<S: Subscriber> Layer<S> for BufferLayer {
+    fn on_event(
+        &self,
+        event: &tracing::Event<'_>,
+        _ctx: tracing_subscriber::layer::Context<'_, S>,
+    ) {
+        let mut visitor = MessageVisitor::default();
+        event.record(&mut visitor);
+
+        let level = event.metadata().level();
+        let target = event.metadata().target();
+        let line = format!(
+            "{} {:>5} {}: {}",
+            chrono::Local::now().format("%H:%M:%S"),
+            level,
+            target,
+            visitor.message
+        );
+
+        let mut buf = self.buffer.lock();
+        buf.push_back(line);
+        while buf.len() > self.max_lines {
+            buf.pop_front();
+        }
+    }
+}
+
+#[derive(Default)]
+struct MessageVisitor {
+    message: String,
+}
+
+impl tracing::field::Visit for MessageVisitor {
+    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn core::fmt::Debug) {
+        if field.name() == "message" {
+            self.message = format!("{value:?}");
+        }
+    }
+}
```

**File**: `spotify_player/src/main.rs` (modified, +25/-7)
```diff
@@ -5,6 +5,7 @@ mod command;
 mod config;
 mod event;
 mod key;
+mod log_layer;
 #[cfg(feature = "media-control")]
 mod media_control;
 mod playlist_folders;
@@ -16,7 +17,10 @@ mod ui;
 mod utils;
 
 use anyhow::{Context, Result};
-use std::io::Write;
+use parking_lot::Mutex;
+use std::{collections::VecDeque, io::Write, sync::Arc};
+use tracing_subscriber::layer::SubscriberExt;
+use tracing_subscriber::util::SubscriberInitExt;
 
 fn init_spotify(
     client_pub: &flume::Sender<client::ClientRequest>,
@@ -38,7 +42,10 @@ fn init_spotify(
     Ok(())
 }
 
-fn init_logging(log_folder: &std::path::Path) -> Result<()> {
+fn init_logging(
+    log_folder: &std::path::Path,
+    log_buffer: Arc<Mutex<VecDeque<String>>>,
+) -> Result<()> {
     if std::env::var_os("RUST_LOG").is_some_and(|x| x == "off") {
         // Don't create log files if logging is disabled.
         return Ok(());
@@ -59,10 +66,17 @@ fn init_logging(log_folder: &std::path::Path) -> Result<()> {
     }
     let log_file = std::fs::File::create(log_folder.join(format!("{log_prefix}.log")))
         .context("failed to create log file")?;
-    tracing_subscriber::fmt::fmt()
-        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
+
+    let fmt_layer = tracing_subscriber::fmt::layer()
         .with_ansi(false)
-        .with_writer(std::sync::Mutex::new(log_file))
+        .with_writer(std::sync::Mutex::new(log_file));
+
+    let buffer_layer = crate::log_layer::BufferLayer::new(log_buffer, 1000);
+
+    tracing_subscriber::registry()
+        .with(tracing_subscriber::EnvFilter::from_default_env())
+        .with(fmt_layer)
+        .with(buffer_layer)
         .init();
 
     // initialize the application's panic backtrace
@@ -272,7 +286,11 @@ fn main() -> Result<()> {
                 .as_deref()
                 .expect("log_folder is set");
 
-            init_logging(log_folder).context("failed to initialize application's logging")?;
+            let log_buffer: Arc<Mutex<VecDeque<String>>> =
+                Arc::new(Mutex::new(VecDeque::with_capacity(1000)));
+
+            init_logging(log_folder, log_buffer.clone())
+                .context("failed to initialize application's logging")?;
 
             // log the application's configurations
             tracing::info!("Configurations: {:?}", config::get_config());
@@ -301,7 +319,7 @@ fn main() -> Result<()> {
                 is_daemon = false;
             }
 
-            let state = std::sync::Arc::new(state::State::new(is_daemon));
+            let state = std::sync::Arc::new(state::State::new(is_daemon, log_buffer));
             start_app(&state)
         }
         Some((cmd, args)) => cli::handle_cli_subcommand(cmd, args),
```

**File**: `spotify_player/src/state/mod.rs` (modified, +6/-2)
```diff
@@ -4,7 +4,7 @@ mod model;
 mod player;
 mod ui;
 
-use std::sync::Arc;
+use std::{collections::VecDeque, sync::Arc};
 
 pub use constant::*;
 pub use data::*;
@@ -32,10 +32,12 @@ pub struct State {
     /// the mutex/state entirely when the feature is not in use.
     #[cfg(feature = "streaming")]
     pub vis_bands: Option<Arc<Mutex<crate::ui::streaming::VisBands>>>,
+
+    pub logs: Arc<Mutex<VecDeque<String>>>,
 }
 
 impl State {
-    pub fn new(is_daemon: bool) -> Self {
+    pub fn new(is_daemon: bool, log_buffer: Arc<Mutex<VecDeque<String>>>) -> Self {
         let mut ui = UIState::default();
         let configs = config::get_config();
 
@@ -59,6 +61,8 @@ impl State {
             } else {
                 None
             },
+
+            logs: log_buffer,
         }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #1088** (closed): Add offline downloads with artwork and fallback playback (@CormAlan)
- **PR #1084** (2026-09-12): fix selected item handling in filtered lists (@aome510)
- **PR #1082** (2026-09-09): render loading UI for search page (@aome510)
- **PR #1081** (2026-09-09): update audio vis default to use theme palette's color instead of hard-coded rgb (@aome510)
- **PR #1080** (2026-09-09): Update `get-playlist-items` and `get-user-top-tracks` API handling (@aome510)
- **PR #1079** (2026-09-08): add a config option for configuring ncspot-only GET endpoints (@aome510)
- **PR #1078** (2026-09-07): pre-release `v0.25.0` (@aome510)
- **PR #1077** (2026-09-07): implement custom web API client support with fallback (@aome510)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
