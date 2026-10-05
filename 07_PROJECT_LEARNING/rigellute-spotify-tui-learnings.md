# Forensic Learning Record (Deep Inspection): Rigellute/spotify-tui

> **Canonical Artifact**: `07_PROJECT_LEARNING/rigellute-spotify-tui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Rigellute/spotify-tui](https://github.com/Rigellute/spotify-tui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:27.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Rigellute/spotify-tui`
- **Description**: Spotify for the terminal written in Rust 🚀
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 19363 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/cli/util.rs`
```
use clap::ArgMatches;
use rspotify::{
  model::{
    album::SimplifiedAlbum, artist::FullArtist, artist::SimplifiedArtist,
    playlist::SimplifiedPlaylist, show::FullEpisode, show::SimplifiedShow, track::FullTrack,
  },
  senum::RepeatState,
};

use crate::user_config::UserConfig;

// Possible types to list or search
#[derive(Debug)]
pub enum Type {
  Playlist,
  Track,
  Artist,
  Album,
  Show,
  Device,
  Liked,
}

impl Type {
  pub fn play_from_matches(m: &ArgMatches<'_>) -> Self {
    if m.is_present("playlist") {
      Self::Playlist
    } else if m.is_present("track") {
      Self::Track
    } else if m.is_present("artist") {
      Self::Artist
    } else if m.is_present("album") {
      Self::Album
    } else if m.is_present("show") {
      Self::Show
    }
    // Enforced by clap
    else {
      unreachable!()
    }
  }

  pub fn search_from_matches(m: &ArgMatches<'_>) -> Self {
    if m.is_present("playlists") {
      Self::Playlist
    } else if m.is_present("tracks") {
      Self::Track
    } else if m.is_present("artists") {
      Self::Artist
    } else if m.is_present("albums") {
      Self::Album
    } else if m.is_present("shows") {
      Self::Show
    }
    // Enforced by clap
    else {
      unreachable!()
    }
  }

  pub fn list_from_matches(m: &ArgMatches<'_>) -> Self {
    if m.is_present("playlists") {
      Self::Playlist
    } else if m.is_present("devices") {
      Self::Device
    } else if m.is_present("liked") {
      Self::Liked
    }
    // Enforced by clap
    else {
      unreachable!()
    }
  }
}

//
// Possible flags to set
//

pub enum Flag {
  // Does not get toggled
  // * User chooses like -> Flag::Like(true)
  // * User chooses dislike -> Flag::Like(false)
  Like(bool),
  Shuffle,
  Repeat,
}

impl Flag {
  pub fn from_matches(m: &ArgMatches<'_>) -> Vec<Self> {
    // Multiple flags are possible
    let mut flags = Vec::new();

    // Only one of these two
    if m.is_present("like") {
      flags.push(Self::Like(true));
    } else if m.is_present("dislike") {
      flags.push(Self::Like(false));
    }

    if m.is_present("shuffle") {
      flags.push(Self::Shuffle);
    }
    if m.is_present("repeat") {
      flags.push(Self::Repeat);
    }
    flags
  }
}

// Possible directions to jump to
pub enum JumpDirection {
  Next,
  Previous,
}

impl JumpDirection {
  pub fn from_matches(m: &ArgMatches<'_>) -> (Self, u64) {
    if m.is_present("next") {
      (Self::Next, m.occurrences_of("next"))
    } else if m.is_present("previous") {
      (Self::Previous, m.occurrences_of("previous"))
    // Enforced by clap
    } else {
      unreachable!()
    }
  }
}

// For fomatting (-f / --format flag)

// Types to create a Format enum from
// Boxing was proposed by cargo clippy
// to reduce the size of this enum
pub enum FormatType {
  Album(Box<SimplifiedAlbum>),
  Artist(Box<FullArtist>),
  Playlist(Box<SimplifiedPlaylist>),
  Track(Box<FullTrack>),
  Episode(Box<FullEpisode>),
  Show(Box<SimplifiedShow>),
}

// Types that can be formatted
#[derive(Clone)]
pub enum Format {
  Album(String),
  Artist(String),
  Playlist(String),
  Track(String),
  Show(String),
  Uri(String),
  Device(String),
  Volume(u32),
  // Current position, duration
  Position((u32, u32)),
  // This is a bit long, should it be splitted up?
  Flags((RepeatState, bool, bool)),
  Playing(bool),
}

pub fn join_artists(a: Vec<SimplifiedArtist>) -> String {
  a.iter()
    .map(|l| l.name.clone())
    .collect::<Vec<String>>()
    .join(", ")
}

impl Format {
  // Extract important information from types
  pub fn from_type(t: FormatType) -> Vec<Self> {
    match t {
      FormatType::Album(a) => {
        let joined_artists = join_artists(a.artists.clone());
        let mut vec = vec![Self::Album(a.name), Self::Artist(joined_artists)];
        if let Some(uri) = a.uri {
          vec.push(Self::Uri(uri));
        }
        vec
      }
      FormatType::Artist(a) => vec![Self::Artist(a.name), Self::Uri(a.uri)],
      FormatType::Playlist(p) => vec![Self::Playlist(p.name), Self::Uri(p.uri)],
      FormatType::Track(t) => {
        let joined_artists = join_artists(t.artists.clone());
        vec![
          Self::Album(t.album.name),
          Self::Artist(joined_artists),
          Self::Track(t.name),
          Self::Uri(t.uri),
        ]
      }
      FormatType::Show(r) => vec![
        Self::Artist(r.publisher),
        Self::Show(r.name),
        Self::Uri(r.uri),
      ],
      FormatType::Episode(e) => vec![
        Self::Show(e.show.name),
        Self::Artist(e.show.publisher),
        Self::Track(e.name),
        Self::Uri(e.uri),
      ],
    }
  }

  // Is there a better way?
  pub fn inner(&self, conf: UserConfig) -> String {
    match self {
      Self::Album(s) => s.clone(),
      Self::Artist(s) => s.clone(),
      Self::Playlist(s) => s.clone(),
      Self::Track(s) => s.clone(),
      Self::Show(s) => s.clone(),
      Self::Uri(s) => s.clone(),
      Self::Device(s) => s.clone(),
      // Because this match statements
      // needs to return a &String, I have to do it this way
      Self::Volume(s) => s.to_string(),
      Self::Position((curr, duration)) => {
        crate::ui::util::display_track_progress(*curr as u128, *duration)
      }
      Self::Flags((r, s, l)) => {
        let like = if *l {
          conf.behavior.liked_icon
        } else {
          String::new()
        };
        let shuffle = if *s {
          conf.behavior.shuffle_icon
        } else {
          String::new()
        };
        let repeat = match r {
          RepeatState::Off => String::new(),
          RepeatState::Track => conf.behavior.repeat_track_icon,
          RepeatState::Context => conf.behavior.repeat_context_icon,
        };

        // Add them together (only those that aren't empty)
        [shuffle, repeat, like]
          .iter()
          .filter(|a| !a.is_empty())
          // Convert &String to String to join them
          .map(|s| s.to_string())
          .collect::<Vec<String>>()
          .join(" ")
      }
      Self::Playing(s) => {
        if *s {
          conf.behavior.playing_icon
        } else {
          conf.behavior.paused_icon
        }
      }
    }
  }

  pub fn get_placeholder(&self) -> &str {
    match self {
      Self::Album(_) => "%b",
      Self::Artist(_) => "%a",
      Self::Playlist(_) => "%p",
      Self::Track(_) => "%t",
      Self::Show(_) => "%h",
      Self::Uri(_) => "%u",
      Self::Device(_) => "%d",
      Self::Volume(_) => "%v",
      Self::Position(_) => "%r",
      Self::Flags(_) => "%f",
      Self::Playing(_) => "%s",
    }
  }
}

```

### Core Architecture Module: `src/ui/util.rs`
```
use super::super::app::{ActiveBlock, App, ArtistBlock, SearchResultBlock};
use crate::user_config::Theme;
use rspotify::model::artist::SimplifiedArtist;
use tui::style::Style;

pub const BASIC_VIEW_HEIGHT: u16 = 6;
pub const SMALL_TERMINAL_WIDTH: u16 = 150;
pub const SMALL_TERMINAL_HEIGHT: u16 = 45;

pub fn get_search_results_highlight_state(
  app: &App,
  block_to_match: SearchResultBlock,
) -> (bool, bool) {
  let current_route = app.get_current_route();
  (
    app.search_results.selected_block == block_to_match,
    current_route.hovered_block == ActiveBlock::SearchResultBlock
      && app.search_results.hovered_block == block_to_match,
  )
}

pub fn get_artist_highlight_state(app: &App, block_to_match: ArtistBlock) -> (bool, bool) {
  let current_route = app.get_current_route();
  if let Some(artist) = &app.artist {
    let is_hovered = artist.artist_selected_block == block_to_match;
    let is_selected = current_route.hovered_block == ActiveBlock::ArtistBlock
      && artist.artist_hovered_block == block_to_match;
    (is_hovered, is_selected)
  } else {
    (false, false)
  }
}

pub fn get_color((is_active, is_hovered): (bool, bool), theme: Theme) -> Style {
  match (is_active, is_hovered) {
    (true, _) => Style::default().fg(theme.selected),
    (false, true) => Style::default().fg(theme.hovered),
    _ => Style::default().fg(theme.inactive),
  }
}

pub fn create_artist_string(artists: &[SimplifiedArtist]) -> String {
  artists
    .iter()
    .map(|artist| artist.name.to_string())
    .collect::<Vec<String>>()
    .join(", ")
}

pub fn millis_to_minutes(millis: u128) -> String {
  let minutes = millis / 60000;
  let seconds = (millis % 60000) / 1000;
  let seconds_display = if seconds < 10 {
    format!("0{}", seconds)
  } else {
    format!("{}", seconds)
  };

  if seconds == 60 {
    format!("{}:00", minutes + 1)
  } else {
    format!("{}:{}", minutes, seconds_display)
  }
}

pub fn display_track_progress(progress: u128, track_duration: u32) -> String {
  let duration = millis_to_minutes(u128::from(track_duration));
  let progress_display = millis_to_minutes(progress);
  let remaining = millis_to_minutes(u128::from(track_duration).saturating_sub(progress));

  format!("{}/{} (-{})", progress_display, duration, remaining,)
}

// `percentage` param needs to be between 0 and 1
pub fn get_percentage_width(width: u16, percentage: f32) -> u16 {
  let padding = 3;
  let width = width - padding;
  (f32::from(width) * percentage) as u16
}

// Ensure track progress percentage is between 0 and 100 inclusive
pub fn get_track_progress_percentage(song_progress_ms: u128, track_duration_ms: u32) -> u16 {
  let min_perc = 0_f64;
  let track_progress = std::cmp::min(song_progress_ms, track_duration_ms.into());
  let track_perc = (track_progress as f64 / f64::from(track_duration_ms)) * 100_f64;
  min_perc.max(track_perc) as u16
}

// Make better use of space on small terminals
pub fn get_main_layout_margin(app: &App) -> u16 {
  if app.size.height > SMALL_TERMINAL_HEIGHT {
    1
  } else {
    0
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn millis_to_minutes_test() {
    assert_eq!(millis_to_minutes(0), "0:00");
    assert_eq!(millis_to_minutes(1000), "0:01");
    assert_eq!(millis_to_minutes(1500), "0:01");
    assert_eq!(millis_to_minutes(1900), "0:01");
    assert_eq!(millis_to_minutes(60 * 1000), "1:00");
    assert_eq!(millis_to_minutes(60 * 1500), "1:30");
  }

  #[test]
  fn display_track_progress_test() {
    assert_eq!(
      display_track_progress(0, 2 * 60 * 1000),
      "0:00/2:00 (-2:00)"
    );

    assert_eq!(
      display_track_progress(60 * 1000, 2 * 60 * 1000),
      "1:00/2:00 (-1:00)"
    );
  }

  #[test]
  fn get_track_progress_percentage_test() {
    let track_length = 60 * 1000;
    assert_eq!(get_track_progress_percentage(0, track_length), 0);
    assert_eq!(
      get_track_progress_percentage((60 * 1000) / 2, track_length),
      50
    );

    // If progress is somehow higher than total duration, 100 should be max
    assert_eq!(
      get_track_progress_percentage(60 * 1000 * 2, track_length),
      100
    );
  }
}

```

### Core Architecture Module: `src/util.rs`
```
use std::{io::stdin, sync::mpsc, thread, time::Duration};
use termion::{event::Key, input::TermRead};

pub enum Event<I> {
    Input(I),
    Tick,
}

/// A small event handler that wrap termion input and tick events. Each event
/// type is handled in its own thread and returned to a common `Receiver`
pub struct Events {
    rx: mpsc::Receiver<Event<Key>>,
}

#[derive(Debug, Clone, Copy)]
pub struct Config {
    pub exit_key: Key,
    pub tick_rate: Duration,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            exit_key: Key::Ctrl('c'),
            tick_rate: Duration::from_millis(250),
        }
    }
}

impl Events {
    pub fn new() -> Events {
        Events::with_config(Config::default())
    }

    pub fn with_config(config: Config) -> Events {
        let (tx, rx) = mpsc::channel();
        let _input_handle = {
            let tx = tx.clone();
            thread::spawn(move || {
                let stdin_result = stdin();
                for evt in stdin_result.keys() {
                    if let Ok(key) = evt {
                        if tx.send(Event::Input(key)).is_err() {
                            return;
                        }
                        if key == config.exit_key {
                            return;
                        }
                    }
                }
            })
        };

        let _tick_handle = {
            let tx = tx;
            thread::spawn(move || {
                let tx = tx.clone();
                loop {
                    tx.send(Event::Tick).unwrap();
                    thread::sleep(config.tick_rate);
                }
            })
        };

        Events { rx }
    }

    pub fn next(&self) -> Result<Event<Key>, mpsc::RecvError> {
        self.rx.recv()
    }
}

```

### Core Architecture Module: `src/app.rs`
```
use super::user_config::UserConfig;
use crate::network::IoEvent;
use anyhow::anyhow;
use rspotify::{
  model::{
    album::{FullAlbum, SavedAlbum, SimplifiedAlbum},
    artist::FullArtist,
    audio::AudioAnalysis,
    context::CurrentlyPlaybackContext,
    device::DevicePayload,
    page::{CursorBasedPage, Page},
    playing::PlayHistory,
    playlist::{PlaylistTrack, SimplifiedPlaylist},
    show::{FullShow, Show, SimplifiedEpisode, SimplifiedShow},
    track::{FullTrack, SavedTrack, SimplifiedTrack},
    user::PrivateUser,
    PlayingItem,
  },
  senum::Country,
};
use std::str::FromStr;
use std::sync::mpsc::Sender;
use std::{
  cmp::{max, min},
  collections::HashSet,
  time::{Instant, SystemTime},
};
use tui::layout::Rect;

use arboard::Clipboard;

pub const LIBRARY_OPTIONS: [&str; 6] = [
  "Made For You",
  "Recently Played",
  "Liked Songs",
  "Albums",
  "Artists",
  "Podcasts",
];

const DEFAULT_ROUTE: Route = Route {
  id: RouteId::Home,
  active_block: ActiveBlock::Empty,
  hovered_block: ActiveBlock::Library,
};

#[derive(Clone)]
pub struct ScrollableResultPages<T> {
  index: usize,
  pub pages: Vec<T>,
}

impl<T> ScrollableResultPages<T> {
  pub fn new() -> ScrollableResultPages<T> {
    ScrollableResultPages {
      index: 0,
      pages: vec![],
    }
  }

  pub fn get_results(&self, at_index: Option<usize>) -> Option<&T> {
    self.pages.get(at_index.unwrap_or(self.index))
  }

  pub fn get_mut_results(&mut self, at_index: Option<usize>) -> Option<&mut T> {
    self.pages.get_mut(at_index.unwrap_or(self.index))
  }

  pub fn add_pages(&mut self, new_pages: T) {
    self.pages.push(new_pages);
    // Whenever a new page is added, set the active index to the end of the vector
    self.index = self.pages.len() - 1;
  }
}

#[derive(Default)]
pub struct SpotifyResultAndSelectedIndex<T> {
  pub index: usize,
  pub result: T,
}

#[derive(Clone)]
pub struct Library {
  pub selected_index: usize,
  pub saved_tracks: ScrollableResultPages<Page<SavedTrack>>,
  pub made_for_you_playlists: ScrollableResultPages<Page<SimplifiedPlaylist>>,
  pub saved_albums: ScrollableResultPages<Page<SavedAlbum>>,
  pub saved_shows: ScrollableResultPages<Page<Show>>,
  pub saved_artists: ScrollableResultPages<CursorBasedPage<FullArtist>>,
  pub show_episodes: ScrollableResultPages<Page<SimplifiedEpisode>>,
}

#[derive(PartialEq, Debug)]
pub enum SearchResultBlock {
  AlbumSearch,
  SongSearch,
  ArtistSearch,
  PlaylistSearch,
  ShowSearch,
  Empty,
}

#[derive(PartialEq, Debug, Clone)]
pub enum ArtistBlock {
  TopTracks,
  Albums,
  RelatedArtists,
  Empty,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum DialogContext {
  PlaylistWindow,
  PlaylistSearch,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ActiveBlock {
  Analysis,
  PlayBar,
  AlbumTracks,
  AlbumList,
  ArtistBlock,
  Empty,
  Error,
  HelpMenu,
  Home,
  Input,
  Library,
  MyPlaylists,
  Podcasts,
  EpisodeTable,
  RecentlyPlayed,
  SearchResultBlock,
  SelectDevice,
  TrackTable,
  MadeForYou,
  Artists,
  BasicView,
  Dialog(DialogContext),
}

#[derive(Clone, PartialEq, Debug)]
pub enum RouteId {
  Analysis,
  AlbumTracks,
  AlbumList,
  Artist,
  BasicView,
  Error,
  Home,
  RecentlyPlayed,
  Search,
  SelectedDevice,
  TrackTable,
  MadeForYou,
  Artists,
  Podcasts,
  PodcastEpisodes,
  Recommendations,
  Dialog,
}

#[derive(Debug)]
pub struct Route {
  pub id: RouteId,
  pub active_block: ActiveBlock,
  pub hovered_block: ActiveBlock,
}

// Is it possible to compose enums?
#[derive(PartialEq, Debug)]
pub enum TrackTableContext {
  MyPlaylists,
  AlbumSearch,
  PlaylistSearch,
  SavedTracks,
  RecommendedTracks,
  MadeForYou,
}

// Is it possible to compose enums?
#[derive(Clone, PartialEq, Debug, Copy)]
pub enum AlbumTableContext {
  Simplified,
  Full,
}

#[derive(Clone, PartialEq, Debug, Copy)]
pub enum EpisodeTableContext {
  Simplified,
  Full,
}

#[derive(Clone, PartialEq, Debug)]
pub enum RecommendationsContext {
  Artist,
  Song,
}

pub struct SearchResult {
  pub albums: Option<Page<SimplifiedAlbum>>,
  pub artists: Option<Page<FullArtist>>,
  pub playlists: Option<Page<SimplifiedPlaylist>>,
  pub tracks: Option<Page<FullTrack>>,
  pub shows: Option<Page<SimplifiedShow>>,
  pub selected_album_index: Option<usize>,
  pub selected_artists_index: Option<usize>,
  pub selected_playlists_index: Option<usize>,
  pub selected_tracks_index: Option<usize>,
  pub selected_shows_index: Option<usize>,
  pub hovered_block: SearchResultBlock,
  pub selected_block: SearchResultBlock,
}

#[derive(Default)]
pub struct TrackTable {
  pub tracks: Vec<FullTrack>,
  pub selected_index: usize,
  pub context: Option<TrackTableContext>,
}

#[derive(Clone)]
pub struct SelectedShow {
  pub show: SimplifiedShow,
}

#[derive(Clone)]
pub struct SelectedFullShow {
  pub show: FullShow,
}

#[derive(Clone)]
pub struct SelectedAlbum {
  pub album: SimplifiedAlbum,
  pub tracks: Page<SimplifiedTrack>,
  pub selected_index: usize,
}

#[derive(Clone)]
pub struct SelectedFullAlbum {
  pub album: FullAlbum,
  pub selected_index: usize,
}

#[derive(Clone)]
pub struct Artist {
  pub artist_name: String,
  pub albums: Page<SimplifiedAlbum>,
  pub related_artists: Vec<FullArtist>,
  pub top_tracks: Vec<FullTrack>,
  pub selected_album_index: usize,
  pub selected_related_artist_index: usize,
  pub selected_top_track_index: usize,
  pub artist_hovered_block: ArtistBlock,
  pub artist_selected_block: ArtistBlock,
}

pub struct App {
  pub instant_since_last_current_playback_poll: Instant,
  navigation_stack: Vec<Route>,
  pub audio_analysis: Option<AudioAnalysis>,
  pub home_scroll: u16,
  pub user_config: UserConfig,
  pub artists: Vec<FullArtist>,
  pub artist: Option<Artist>,
  pub album_table_context: AlbumTableContext,
  pub saved_album_tracks_index: usize,
  pub api_error: String,
  pub current_playback_context: Option<CurrentlyPlaybackContext>,
  pub devices: Option<DevicePayload>,
  // Inputs:
  // input is the string for input;
  // input_idx is the index of the cursor in terms of character;
  // input_cursor_position is the sum of the width of characters preceding the cursor.
  // Reason for this complication is due to non-ASCII characters, they may
  // take more than 1 bytes to store and more than 1 character width to display.
  pub input: Vec<char>,
  pub input_idx: usize,
  pub input_cursor_position: u16,
  pub liked_song_ids_set: HashSet<String>,
  pub followed_artist_ids_set: HashSet<String>,
  pub saved_album_ids_set: HashSet<String>,
  pub saved_show_ids_set: HashSet<String>,
  pub large_search_limit: u32,
  pub library: Library,
  pub playlist_offset: u32,
  pub made_for_you_offset: u32,
  pub playlist_tracks: Option<Page<PlaylistTrack>>,
  pub made_for_you_tracks: Option<Page<PlaylistTrack>>,
  pub playlists: Option<Page<SimplifiedPlaylist>>,
  pub recently_played: SpotifyResultAndSelectedIndex<Option<CursorBasedPage<PlayHistory>>>,
  pub recommended_tracks: Vec<FullTrack>,
  pub recommendations_seed: String,
  pub recommendations_context: Option<RecommendationsContext>,
  pub search_results: SearchResult,
  pub selected_album_simplified: Option<SelectedAlbum>,
  pub selected_album_full: Option<SelectedFullAlbum>,
  pub selected_device_index: Option<usize>,
  pub selected_playlist_index: Option<usize>,
  pub active_playlist_index: Option<usize>,
  pub size: Rect,
  pub small_search_limit: u32,
  pub song_progress_ms: u128,
  pub seek_ms: Option<u128>,
  pub track_table: TrackTable,
  pub episode_table_context: EpisodeTableContext,
  pub selected_show_simplified: Option<SelectedShow>,
  pub selected_show_full: Option<SelectedFullShow>,
  pub user: Option<PrivateUser>,
  pub album_list_index: usize,
  pub made_for_you_index: usize,
  pub artists_list_index: usize,
  pub clipboard: Option<Clipboard>,
  pub shows_list_index: usize,
  pub episode_list_index: usize,
  pub help_docs_size: u32,
  pub help_menu_page: u32,
  pub help_menu_max_lines: u32,
  pub help_menu_offset: u32,
  pub is_loading: bool,
  io_tx: Option<Sender<IoEvent>>,
  pub is_fetching_current_playback: bool,
  pub spotify_token_expiry: SystemTime,
  pub dialog: Option<String>,
  pub confirm: bool,
}

impl Default for App {
  fn default() -> Self {
    App {
      audio_analysis: None,
      album_table_context: AlbumTableContext::Full,
      album_list_index: 0,
      made_for_you_index: 0,
      artists_list_index: 0,
      shows_list_index: 0,
      episode_list_index: 0,
      artists: vec![],
      artist: None,
      user_config: UserConfig::new(),
      saved_album_tracks_index: 0,
      recently_played: Default::default(),
      size: Rect::default(),
      selected_album_simplified: None,
      selected_album_full: None,
      home_scroll: 0,
      library: Library {
        saved_tracks: ScrollableResultPages::new(),
        made_for_you_playlists: ScrollableResultPages::new(),
        saved_albums: ScrollableResultPages::new(),
        saved_shows: ScrollableResultPages::new(),
        saved_artists: ScrollableResultPages::new(),
        show_episodes: ScrollableResultPages::new(),
        selected_index: 0,
      },
      liked_song_ids_set: HashSet::new(),
      followed_artist_ids_set: HashSet::new(),
      saved_album_ids_set: HashSet::new(),
      saved_show_ids_set: HashSet::new(),
      navigation_stack: vec![DEFAULT_ROUTE],
      large_search_limit: 20,
      small_search_limit: 4,
      api_error: String::new(),
      current_playback_context: None,
      devices: None,
      input: vec![],
      input_idx: 0,
      input_cursor_position: 0,
      playlist_offset: 0,
      made_for_you_offset: 0,
      playlist_tracks: None,
      made_for_you_tracks: None,
      playlists: None,
      recommended_tracks: vec![],
      recommendations_context: None,
      recommendations_seed: "".to_string(),
      search_results: SearchResult {
        hovered_block: SearchResultBlock::SongSearch,
        selected_block: SearchResultBlock::Empty,
        albums: None,
        artists: Non
```

### Core Architecture Module: `src/banner.rs`
```
pub const BANNER: &str = "
   _________  ____  / /_(_) __/_  __      / /___  __(_)
  / ___/ __ \\/ __ \\/ __/ / /_/ / / /_____/ __/ / / / / 
 (__  ) /_/ / /_/ / /_/ / __/ /_/ /_____/ /_/ /_/ / /  
/____/ .___/\\____/\\__/_/_/  \\__, /      \\__/\\__,_/_/   
    /_/                    /____/                      
";

```

### Core Architecture Module: `src/cli/clap.rs`
```
use clap::{App, Arg, ArgGroup, SubCommand};

fn device_arg() -> Arg<'static, 'static> {
  Arg::with_name("device")
    .short("d")
    .long("device")
    .takes_value(true)
    .value_name("DEVICE")
    .help("Specifies the spotify device to use")
}

fn format_arg() -> Arg<'static, 'static> {
  Arg::with_name("format")
    .short("f")
    .long("format")
    .takes_value(true)
    .value_name("FORMAT")
    .help("Specifies the output format")
    .long_help(
      "There are multiple format specifiers you can use: %a: artist, %b: album, %p: playlist, \
%t: track, %h: show, %f: flags (shuffle, repeat, like), %s: playback status, %v: volume, %d: current device. \
Example: spt pb -s -f 'playing on %d at %v%'",
    )
}

pub fn playback_subcommand() -> App<'static, 'static> {
  SubCommand::with_name("playback")
    .version(env!("CARGO_PKG_VERSION"))
    .author(env!("CARGO_PKG_AUTHORS"))
    .about("Interacts with the playback of a device")
    .long_about(
      "Use `playback` to interact with the playback of the current or any other device. \
You can specify another device with `--device`. If no options were provided, spt \
will default to just displaying the current playback. Actually, after every action \
spt will display the updated playback. The output format is configurable with the \
`--format` flag. Some options can be used together, other options have to be alone.

Here's a list:

* `--next` and `--previous` cannot be used with other options
* `--status`, `--toggle`, `--transfer`, `--volume`, `--like`, `--repeat` and `--shuffle` \
can be used together
* `--share-track` and `--share-album` cannot be used with other options",
    )
    .visible_alias("pb")
    .arg(device_arg())
    .arg(
      format_arg()
        .default_value("%f %s %t - %a")
        .default_value_ifs(&[
          ("seek", None, "%f %s %t - %a %r"),
          ("volume", None, "%v% %f %s %t - %a"),
          ("transfer", None, "%f %s %t - %a on %d"),
        ]),
    )
    .arg(
      Arg::with_name("toggle")
        .short("t")
        .long("toggle")
        .help("Pauses/resumes the playback of a device"),
    )
    .arg(
      Arg::with_name("status")
        .short("s")
        .long("status")
        .help("Prints out the current status of a device (default)"),
    )
    .arg(
      Arg::with_name("share-track")
        .long("share-track")
        .help("Returns the url to the current track"),
    )
    .arg(
      Arg::with_name("share-album")
        .long("share-album")
        .help("Returns the url to the album of the current track"),
    )
    .arg(
      Arg::with_name("transfer")
        .long("transfer")
        .takes_value(true)
        .value_name("DEVICE")
        .help("Transfers the playback to new DEVICE"),
    )
    .arg(
      Arg::with_name("like")
        .long("like")
        .help("Likes the current song if possible"),
    )
    .arg(
      Arg::with_name("dislike")
        .long("dislike")
        .help("Dislikes the current song if possible"),
    )
    .arg(
      Arg::with_name("shuffle")
        .long("shuffle")
        .help("Toggles shuffle mode"),
    )
    .arg(
      Arg::with_name("repeat")
        .long("repeat")
        .help("Switches between repeat modes"),
    )
    .arg(
      Arg::with_name("next")
        .short("n")
        .long("next")
        .multiple(true)
        .help("Jumps to the next song")
        .long_help(
          "This jumps to the next song if specied once. If you want to jump, let's say 3 songs \
forward, you can use `--next` 3 times: `spt pb -nnn`.",
        ),
    )
    .arg(
      Arg::with_name("previous")
        .short("p")
        .long("previous")
        .multiple(true)
        .help("Jumps to the previous song")
        .long_help(
          "This jumps to the beginning of the current song if specied once. You probably want to \
jump to the previous song though, so you can use the previous flag twice: `spt pb -pp`. To jump \
two songs back, you can use `spt pb -ppp` and so on.",
        ),
    )
    .arg(
      Arg::with_name("seek")
        .long("seek")
        .takes_value(true)
        .value_name("±SECONDS")
        .allow_hyphen_values(true)
        .help("Jumps SECONDS forwards (+) or backwards (-)")
        .long_help(
          "For example: `spt pb --seek +10` jumps ten second forwards, `spt pb --seek -10` ten \
seconds backwards and `spt pb --seek 10` to the tenth second of the track.",
        ),
    )
    .arg(
      Arg::with_name("volume")
        .short("v")
        .long("volume")
        .takes_value(true)
        .value_name("VOLUME")
        .help("Sets the volume of a device to VOLUME (1 - 100)"),
    )
    .group(
      ArgGroup::with_name("jumps")
        .args(&["next", "previous"])
        .multiple(false)
        .conflicts_with_all(&["single", "flags", "actions"]),
    )
    .group(
      ArgGroup::with_name("likes")
        .args(&["like", "dislike"])
        .multiple(false),
    )
    .group(
      ArgGroup::with_name("flags")
        .args(&["like", "dislike", "shuffle", "repeat"])
        .multiple(true)
        .conflicts_with_all(&["single", "jumps"]),
    )
    .group(
      ArgGroup::with_name("actions")
        .args(&["toggle", "status", "transfer", "volume"])
        .multiple(true)
        .conflicts_with_all(&["single", "jumps"]),
    )
    .group(
      ArgGroup::with_name("single")
        .args(&["share-track", "share-album"])
        .multiple(false)
        .conflicts_with_all(&["actions", "flags", "jumps"]),
    )
}

pub fn play_subcommand() -> App<'static, 'static> {
  SubCommand::with_name("play")
    .version(env!("CARGO_PKG_VERSION"))
    .author(env!("CARGO_PKG_AUTHORS"))
    .about("Plays a uri or another spotify item by name")
    .long_about(
      "If you specify a uri, the type can be inferred. If you want to play something by \
name, you have to specify the type: `--track`, `--album`, `--artist`, `--playlist` \
or `--show`. The first item which was found will be played without confirmation. \
To add a track to the queue, use `--queue`. To play a random song from a playlist, \
use `--random`. Again, with `--format` you can specify how the output will look. \
The same function as found in `playback` will be called.",
    )
    .visible_alias("p")
    .arg(device_arg())
    .arg(format_arg().default_value("%f %s %t - %a"))
    .arg(
      Arg::with_name("uri")
        .short("u")
        .long("uri")
        .takes_value(true)
        .value_name("URI")
        .help("Plays the URI"),
    )
    .arg(
      Arg::with_name("name")
        .short("n")
        .long("name")
        .takes_value(true)
        .value_name("NAME")
        .requires("contexts")
        .help("Plays the first match with NAME from the specified category"),
    )
    .arg(
      Arg::with_name("queue")
        .short("q")
        .long("queue")
        // Only works with tracks
        .conflicts_with_all(&["album", "artist", "playlist", "show"])
        .help("Adds track to queue instead of playing it directly"),
    )
    .arg(
      Arg::with_name("random")
        .short("r")
        .long("random")
        // Only works with playlists
        .conflicts_with_all(&["track", "album", "artist", "show"])
        .help("Plays a random track (only works with playlists)"),
    )
    .arg(
      Arg::with_name("album")
        .short("b")
        .long("album")
        .help("Looks for an album"),
    )
    .arg(
      Arg::with_name("artist")
        .short("a")
        .long("artist")
        .help("Looks for an artist"),
    )
    .arg(
      Arg::with_name("track")
        .short("t")
        .long("track")
        .help("Looks for a track"),
    )
    .arg(
      Arg::with_name("show")
        .short("w")
        .long("show")
        .help("Looks for a show"),
    )
    .arg(
      Arg::with_name("playlist")
        .short("p")
        .long("playlist")
        .help("Looks for a playlist"),
    )
    .group(
      ArgGroup::with_name("contexts")
        .args(&["track", "artist", "playlist", "album", "show"])
        .multiple(false),
    )
    .group(
      ArgGroup::with_name("actions")
        .args(&["uri", "name"])
        .multiple(false)
        .required(true),
    )
}

pub fn list_subcommand() -> App<'static, 'static> {
  SubCommand::with_name("list")
    .version(env!("CARGO_PKG_VERSION"))
    .author(env!("CARGO_PKG_AUTHORS"))
    .about("Lists devices, liked songs and playlists")
    .long_about(
      "This will list devices, liked songs or playlists. With the `--limit` flag you are \
able to specify the amount of results (between 1 and 50). Here, the `--format` is \
even more awesome, get your output exactly the way you want. The format option will \
be applied to every item found.",
    )
    .visible_alias("l")
    .arg(format_arg().default_value_ifs(&[
      ("devices", None, "%v% %d"),
      ("liked", None, "%t - %a (%u)"),
      ("playlists", None, "%p (%u)"),
    ]))
    .arg(
      Arg::with_name("devices")
        .short("d")
        .long("devices")
        .help("Lists devices"),
    )
    .arg(
      Arg::with_name("playlists")
        .short("p")
        .long("playlists")
        .help("Lists playlists"),
    )
    .arg(
      Arg::with_name("liked")
        .long("liked")
        .help("Lists liked songs"),
    )
    .arg(
      Arg::with_name("limit")
        .long("limit")
        .takes_value(true)
        .help("Specifies the maximum number of results (1 - 50)"),
    )
    .group(
      ArgGroup::with_name("listable")
        .args(&["devices", "playlists", "liked"])
        .required(true)
        .multiple(false),
    )
}

pub fn search_subcommand() -> App<'static, 'static> {
  SubCommand::with_name("search")
    .version(env!("CARGO_PKG_VERSION"))
    .author(env!("CARGO_PKG_AUTHORS"))
    .about("Searches for tracks, albums and more")
    .long_about(
      "This will search for something on spotify and displays you the items. The output \
format can be changed with the `--format` flag and t
```

### Core Architecture Module: `src/cli/cli_app.rs`
```
use crate::network::{IoEvent, Network};
use crate::user_config::UserConfig;

use super::util::{Flag, Format, FormatType, JumpDirection, Type};

use anyhow::{anyhow, Result};
use rand::{thread_rng, Rng};
use rspotify::model::{context::CurrentlyPlaybackContext, PlayingItem};

pub struct CliApp<'a> {
  pub net: Network<'a>,
  pub config: UserConfig,
}

// Non-concurrent functions
// I feel that async in a cli is not working
// I just .await all processes and directly interact
// by calling network.handle_network_event
impl<'a> CliApp<'a> {
  pub fn new(net: Network<'a>, config: UserConfig) -> Self {
    Self { net, config }
  }

  async fn is_a_saved_track(&mut self, id: &str) -> bool {
    // Update the liked_song_ids_set
    self
      .net
      .handle_network_event(IoEvent::CurrentUserSavedTracksContains(
        vec![id.to_string()],
      ))
      .await;
    self.net.app.lock().await.liked_song_ids_set.contains(id)
  }

  pub fn format_output(&self, mut format: String, values: Vec<Format>) -> String {
    for val in values {
      format = format.replace(val.get_placeholder(), &val.inner(self.config.clone()));
    }
    // Replace unsupported flags with 'None'
    for p in &["%a", "%b", "%t", "%p", "%h", "%u", "%d", "%v", "%f", "%s"] {
      format = format.replace(p, "None");
    }
    format.trim().to_string()
  }

  // spt playback -t
  pub async fn toggle_playback(&mut self) {
    let context = self.net.app.lock().await.current_playback_context.clone();
    if let Some(c) = context {
      if c.is_playing {
        self.net.handle_network_event(IoEvent::PausePlayback).await;
        return;
      }
    }
    self
      .net
      .handle_network_event(IoEvent::StartPlayback(None, None, None))
      .await;
  }

  // spt pb --share-track (share the current playing song)
  // Basically copy-pasted the 'copy_song_url' function
  pub async fn share_track_or_episode(&mut self) -> Result<String> {
    let app = self.net.app.lock().await;
    if let Some(CurrentlyPlaybackContext {
      item: Some(item), ..
    }) = &app.current_playback_context
    {
      match item {
        PlayingItem::Track(track) => Ok(format!(
          "https://open.spotify.com/track/{}",
          track.id.to_owned().unwrap_or_default()
        )),
        PlayingItem::Episode(episode) => Ok(format!(
          "https://open.spotify.com/episode/{}",
          episode.id.to_owned()
        )),
      }
    } else {
      Err(anyhow!(
        "failed to generate a shareable url for the current song"
      ))
    }
  }

  // spt pb --share-album (share the current album)
  // Basically copy-pasted the 'copy_album_url' function
  pub async fn share_album_or_show(&mut self) -> Result<String> {
    let app = self.net.app.lock().await;
    if let Some(CurrentlyPlaybackContext {
      item: Some(item), ..
    }) = &app.current_playback_context
    {
      match item {
        PlayingItem::Track(track) => Ok(format!(
          "https://open.spotify.com/album/{}",
          track.album.id.to_owned().unwrap_or_default()
        )),
        PlayingItem::Episode(episode) => Ok(format!(
          "https://open.spotify.com/show/{}",
          episode.show.id.to_owned()
        )),
      }
    } else {
      Err(anyhow!(
        "failed to generate a shareable url for the current song"
      ))
    }
  }

  // spt ... -d ... (specify device to control)
  pub async fn set_device(&mut self, name: String) -> Result<()> {
    // Change the device if specified by user
    let mut app = self.net.app.lock().await;
    let mut device_index = 0;
    if let Some(dp) = &app.devices {
      for (i, d) in dp.devices.iter().enumerate() {
        if d.name == name {
          device_index = i;
          // Save the id of the device
          self
            .net
            .client_config
            .set_device_id(d.id.clone())
            .map_err(|_e| anyhow!("failed to use device with name '{}'", d.name))?;
        }
      }
    } else {
      // Error out if no device is available
      return Err(anyhow!("no device available"));
    }
    app.selected_device_index = Some(device_index);
    Ok(())
  }

  // spt query ... --limit LIMIT (set max search limit)
  pub async fn update_query_limits(&mut self, max: String) -> Result<()> {
    let num = max
      .parse::<u32>()
      .map_err(|_e| anyhow!("limit must be between 1 and 50"))?;

    // 50 seems to be the maximum limit
    if num > 50 || num == 0 {
      return Err(anyhow!("limit must be between 1 and 50"));
    };

    self
      .net
      .handle_network_event(IoEvent::UpdateSearchLimits(num, num))
      .await;
    Ok(())
  }

  pub async fn volume(&mut self, vol: String) -> Result<()> {
    let num = vol
      .parse::<u32>()
      .map_err(|_e| anyhow!("volume must be between 0 and 100"))?;

    // Check if it's in range
    if num > 100 {
      return Err(anyhow!("volume must be between 0 and 100"));
    };

    self
      .net
      .handle_network_event(IoEvent::ChangeVolume(num as u8))
      .await;
    Ok(())
  }

  // spt playback --next / --previous
  pub async fn jump(&mut self, d: &JumpDirection) {
    match d {
      JumpDirection::Next => self.net.handle_network_event(IoEvent::NextTrack).await,
      JumpDirection::Previous => self.net.handle_network_event(IoEvent::PreviousTrack).await,
    }
  }

  // spt query -l ...
  pub async fn list(&mut self, item: Type, format: &str) -> String {
    match item {
      Type::Device => {
        if let Some(devices) = &self.net.app.lock().await.devices {
          devices
            .devices
            .iter()
            .map(|d| {
              self.format_output(
                format.to_string(),
                vec![
                  Format::Device(d.name.clone()),
                  Format::Volume(d.volume_percent),
                ],
              )
            })
            .collect::<Vec<String>>()
            .join("\n")
        } else {
          "No devices available".to_string()
        }
      }
      Type::Playlist => {
        self.net.handle_network_event(IoEvent::GetPlaylists).await;
        if let Some(playlists) = &self.net.app.lock().await.playlists {
          playlists
            .items
            .iter()
            .map(|p| {
              self.format_output(
                format.to_string(),
                Format::from_type(FormatType::Playlist(Box::new(p.clone()))),
              )
            })
            .collect::<Vec<String>>()
            .join("\n")
        } else {
          "No playlists found".to_string()
        }
      }
      Type::Liked => {
        self
          .net
          .handle_network_event(IoEvent::GetCurrentSavedTracks(None))
          .await;
        let liked_songs = self
          .net
          .app
          .lock()
          .await
          .track_table
          .tracks
          .iter()
          .map(|t| {
            self.format_output(
              format.to_string(),
              Format::from_type(FormatType::Track(Box::new(t.clone()))),
            )
          })
          .collect::<Vec<String>>();
        // Check if there are any liked songs
        if liked_songs.is_empty() {
          "No liked songs found".to_string()
        } else {
          liked_songs.join("\n")
        }
      }
      // Enforced by clap
      _ => unreachable!(),
    }
  }

  // spt playback --transfer DEVICE
  pub async fn transfer_playback(&mut self, device: &str) -> Result<()> {
    // Get the device id by name
    let mut id = String::new();
    if let Some(devices) = &self.net.app.lock().await.devices {
      for d in &devices.devices {
        if d.name == device {
          id.push_str(d.id.as_str());
          break;
        }
      }
    };

    if id.is_empty() {
      Err(anyhow!("no device with name '{}'", device))
    } else {
      self
        .net
        .handle_network_event(IoEvent::TransferPlaybackToDevice(id.to_string()))
        .await;
      Ok(())
    }
  }

  pub async fn seek(&mut self, seconds_str: String) -> Result<()> {
    let seconds = match seconds_str.parse::<i32>() {
      Ok(s) => s.abs() as u32,
      Err(_) => return Err(anyhow!("failed to convert seconds to i32")),
    };

    let (current_pos, duration) = {
      self
        .net
        .handle_network_event(IoEvent::GetCurrentPlayback)
        .await;
      let app = self.net.app.lock().await;
      if let Some(CurrentlyPlaybackContext {
        progress_ms: Some(ms),
        item: Some(item),
        ..
      }) = &app.current_playback_context
      {
        let duration = match item {
          PlayingItem::Track(track) => track.duration_ms,
          PlayingItem::Episode(episode) => episode.duration_ms,
        };

        (*ms as u32, duration)
      } else {
        return Err(anyhow!("no context available"));
      }
    };

    // Convert secs to ms
    let ms = seconds * 1000;
    // Calculate new positon
    let position_to_seek = if seconds_str.starts_with('+') {
      current_pos + ms
    } else if seconds_str.starts_with('-') {
      // Jump to the beginning if the position_to_seek would be
      // negative, must be checked before the calculation to avoid
      // an 'underflow'
      if ms > current_pos {
        0u32
      } else {
        current_pos - ms
      }
    } else {
      // Absolute value of the track
      seconds * 1000
    };

    // Check if position_to_seek is greater than duration (next track)
    if position_to_seek > duration {
      self.jump(&JumpDirection::Next).await;
    } else {
      // This seeks to a position in the current song
      self
        .net
        .handle_network_event(IoEvent::Seek(position_to_seek))
        .await;
    }

    Ok(())
  }

  // spt playback --like / --dislike / --shuffle / --repeat
  pub async fn mark(&mut self, flag: Flag) -> Result<()> {
    let c = {
      let app = self.net.app.lock().await;
      app
        .current_playback_context
        .clone()
        .ok_or_else(|| anyhow!("no context available"))?
    };

    m
```

### Core Architecture Module: `src/cli/handle.rs`
```
use crate::network::{IoEvent, Network};
use crate::user_config::UserConfig;

use super::{
  util::{Flag, JumpDirection, Type},
  CliApp,
};

use anyhow::{anyhow, Result};
use clap::ArgMatches;

// Handle the different subcommands
pub async fn handle_matches(
  matches: &ArgMatches<'_>,
  cmd: String,
  net: Network<'_>,
  config: UserConfig,
) -> Result<String> {
  let mut cli = CliApp::new(net, config);

  cli.net.handle_network_event(IoEvent::GetDevices).await;
  cli
    .net
    .handle_network_event(IoEvent::GetCurrentPlayback)
    .await;

  let devices_list = match &cli.net.app.lock().await.devices {
    Some(p) => p
      .devices
      .iter()
      .map(|d| d.id.clone())
      .collect::<Vec<String>>(),
    None => Vec::new(),
  };

  // If the device_id is not specified, select the first available device
  let device_id = cli.net.client_config.device_id.clone();
  if device_id.is_none() || !devices_list.contains(&device_id.unwrap()) {
    // Select the first device available
    if let Some(d) = devices_list.get(0) {
      cli.net.client_config.set_device_id(d.clone())?;
    }
  }

  if let Some(d) = matches.value_of("device") {
    cli.set_device(d.to_string()).await?;
  }

  // Evalute the subcommand
  let output = match cmd.as_str() {
    "playback" => {
      let format = matches.value_of("format").unwrap();

      // Commands that are 'single'
      if matches.is_present("share-track") {
        return cli.share_track_or_episode().await;
      } else if matches.is_present("share-album") {
        return cli.share_album_or_show().await;
      }

      // Run the action, and print out the status
      // No 'else if's because multiple different commands are possible
      if matches.is_present("toggle") {
        cli.toggle_playback().await;
      }
      if let Some(d) = matches.value_of("transfer") {
        cli.transfer_playback(d).await?;
      }
      // Multiple flags are possible
      if matches.is_present("flags") {
        let flags = Flag::from_matches(matches);
        for f in flags {
          cli.mark(f).await?;
        }
      }
      if matches.is_present("jumps") {
        let (direction, amount) = JumpDirection::from_matches(matches);
        for _ in 0..amount {
          cli.jump(&direction).await;
        }
      }
      if let Some(vol) = matches.value_of("volume") {
        cli.volume(vol.to_string()).await?;
      }
      if let Some(secs) = matches.value_of("seek") {
        cli.seek(secs.to_string()).await?;
      }

      // Print out the status if no errors were found
      cli.get_status(format.to_string()).await
    }
    "play" => {
      let queue = matches.is_present("queue");
      let random = matches.is_present("random");
      let format = matches.value_of("format").unwrap();

      if let Some(uri) = matches.value_of("uri") {
        cli.play_uri(uri.to_string(), queue, random).await;
      } else if let Some(name) = matches.value_of("name") {
        let category = Type::play_from_matches(matches);
        cli.play(name.to_string(), category, queue, random).await?;
      }

      cli.get_status(format.to_string()).await
    }
    "list" => {
      let format = matches.value_of("format").unwrap().to_string();

      // Update the limits for the list and search functions
      // I think the small and big search limits are very confusing
      // so I just set them both to max, is this okay?
      if let Some(max) = matches.value_of("limit") {
        cli.update_query_limits(max.to_string()).await?;
      }

      let category = Type::list_from_matches(matches);
      Ok(cli.list(category, &format).await)
    }
    "search" => {
      let format = matches.value_of("format").unwrap().to_string();

      // Update the limits for the list and search functions
      // I think the small and big search limits are very confusing
      // so I just set them both to max, is this okay?
      if let Some(max) = matches.value_of("limit") {
        cli.update_query_limits(max.to_string()).await?;
      }

      let category = Type::search_from_matches(matches);
      Ok(
        cli
          .query(
            matches.value_of("search").unwrap().to_string(),
            format,
            category,
          )
          .await,
      )
    }
    // Clap enforces that one of the things above is specified
    _ => unreachable!(),
  };

  // Check if there was an error
  let api_error = cli.net.app.lock().await.api_error.clone();
  if api_error.is_empty() {
    output
  } else {
    Err(anyhow!("{}", api_error))
  }
}

```

### Core Architecture Module: `src/cli/mod.rs`
```
mod clap;
mod cli_app;
mod handle;
mod util;

pub use self::clap::{list_subcommand, play_subcommand, playback_subcommand, search_subcommand};
use cli_app::CliApp;
pub use handle::handle_matches;

```

### Core Architecture Module: `src/config.rs`
```
use super::banner::BANNER;
use anyhow::{anyhow, Error, Result};
use serde::{Deserialize, Serialize};
use std::{
  fs,
  io::{stdin, Write},
  path::{Path, PathBuf},
};

const DEFAULT_PORT: u16 = 8888;
const FILE_NAME: &str = "client.yml";
const CONFIG_DIR: &str = ".config";
const APP_CONFIG_DIR: &str = "spotify-tui";
const TOKEN_CACHE_FILE: &str = ".spotify_token_cache.json";

#[derive(Default, Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ClientConfig {
  pub client_id: String,
  pub client_secret: String,
  pub device_id: Option<String>,
  // FIXME: port should be defined in `user_config` not in here
  pub port: Option<u16>,
}

pub struct ConfigPaths {
  pub config_file_path: PathBuf,
  pub token_cache_path: PathBuf,
}

impl ClientConfig {
  pub fn new() -> ClientConfig {
    ClientConfig {
      client_id: "".to_string(),
      client_secret: "".to_string(),
      device_id: None,
      port: None,
    }
  }

  pub fn get_redirect_uri(&self) -> String {
    format!("http://localhost:{}/callback", self.get_port())
  }

  pub fn get_port(&self) -> u16 {
    self.port.unwrap_or(DEFAULT_PORT)
  }

  pub fn get_or_build_paths(&self) -> Result<ConfigPaths> {
    match dirs::home_dir() {
      Some(home) => {
        let path = Path::new(&home);
        let home_config_dir = path.join(CONFIG_DIR);
        let app_config_dir = home_config_dir.join(APP_CONFIG_DIR);

        if !home_config_dir.exists() {
          fs::create_dir(&home_config_dir)?;
        }

        if !app_config_dir.exists() {
          fs::create_dir(&app_config_dir)?;
        }

        let config_file_path = &app_config_dir.join(FILE_NAME);
        let token_cache_path = &app_config_dir.join(TOKEN_CACHE_FILE);

        let paths = ConfigPaths {
          config_file_path: config_file_path.to_path_buf(),
          token_cache_path: token_cache_path.to_path_buf(),
        };

        Ok(paths)
      }
      None => Err(anyhow!("No $HOME directory found for client config")),
    }
  }

  pub fn set_device_id(&mut self, device_id: String) -> Result<()> {
    let paths = self.get_or_build_paths()?;
    let config_string = fs::read_to_string(&paths.config_file_path)?;
    let mut config_yml: ClientConfig = serde_yaml::from_str(&config_string)?;

    self.device_id = Some(device_id.clone());
    config_yml.device_id = Some(device_id);

    let new_config = serde_yaml::to_string(&config_yml)?;
    let mut config_file = fs::File::create(&paths.config_file_path)?;
    write!(config_file, "{}", new_config)?;
    Ok(())
  }

  pub fn load_config(&mut self) -> Result<()> {
    let paths = self.get_or_build_paths()?;
    if paths.config_file_path.exists() {
      let config_string = fs::read_to_string(&paths.config_file_path)?;
      let config_yml: ClientConfig = serde_yaml::from_str(&config_string)?;

      self.client_id = config_yml.client_id;
      self.client_secret = config_yml.client_secret;
      self.device_id = config_yml.device_id;
      self.port = config_yml.port;

      Ok(())
    } else {
      println!("{}", BANNER);

      println!(
        "Config will be saved to {}",
        paths.config_file_path.display()
      );

      println!("\nHow to get setup:\n");

      let instructions = [
        "Go to the Spotify dashboard - https://developer.spotify.com/dashboard/applications",
        "Click `Create a Client ID` and create an app",
        "Now click `Edit Settings`",
        &format!(
          "Add `http://localhost:{}/callback` to the Redirect URIs",
          DEFAULT_PORT
        ),
        "You are now ready to authenticate with Spotify!",
      ];

      let mut number = 1;
      for item in instructions.iter() {
        println!("  {}. {}", number, item);
        number += 1;
      }

      let client_id = ClientConfig::get_client_key_from_input("Client ID")?;
      let client_secret = ClientConfig::get_client_key_from_input("Client Secret")?;

      let mut port = String::new();
      println!("\nEnter port of redirect uri (default {}): ", DEFAULT_PORT);
      stdin().read_line(&mut port)?;
      let port = port.trim().parse::<u16>().unwrap_or(DEFAULT_PORT);

      let config_yml = ClientConfig {
        client_id,
        client_secret,
        device_id: None,
        port: Some(port),
      };

      let content_yml = serde_yaml::to_string(&config_yml)?;

      let mut new_config = fs::File::create(&paths.config_file_path)?;
      write!(new_config, "{}", content_yml)?;

      self.client_id = config_yml.client_id;
      self.client_secret = config_yml.client_secret;
      self.device_id = config_yml.device_id;
      self.port = config_yml.port;

      Ok(())
    }
  }

  fn get_client_key_from_input(type_label: &'static str) -> Result<String> {
    let mut client_key = String::new();
    const MAX_RETRIES: u8 = 5;
    let mut num_retries = 0;
    loop {
      println!("\nEnter your {}: ", type_label);
      stdin().read_line(&mut client_key)?;
      client_key = client_key.trim().to_string();
      match ClientConfig::validate_client_key(&client_key) {
        Ok(_) => return Ok(client_key),
        Err(error_string) => {
          println!("{}", error_string);
          client_key.clear();
          num_retries += 1;
          if num_retries == MAX_RETRIES {
            return Err(Error::from(std::io::Error::new(
              std::io::ErrorKind::Other,
              format!("Maximum retries ({}) exceeded.", MAX_RETRIES),
            )));
          }
        }
      };
    }
  }

  fn validate_client_key(key: &str) -> Result<()> {
    const EXPECTED_LEN: usize = 32;
    if key.len() != EXPECTED_LEN {
      Err(Error::from(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        format!("invalid length: {} (must be {})", key.len(), EXPECTED_LEN,),
      )))
    } else if !key.chars().all(|c| c.is_digit(16)) {
      Err(Error::from(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        "invalid character found (must be hex digits)",
      )))
    } else {
      Ok(())
    }
  }
}

```

### Core Architecture Module: `src/event/events.rs`
```
use crate::event::Key;
use crossterm::event;
use std::{sync::mpsc, thread, time::Duration};

#[derive(Debug, Clone, Copy)]
/// Configuration for event handling.
pub struct EventConfig {
  /// The key that is used to exit the application.
  pub exit_key: Key,
  /// The tick rate at which the application will sent an tick event.
  pub tick_rate: Duration,
}

impl Default for EventConfig {
  fn default() -> EventConfig {
    EventConfig {
      exit_key: Key::Ctrl('c'),
      tick_rate: Duration::from_millis(250),
    }
  }
}

/// An occurred event.
pub enum Event<I> {
  /// An input event occurred.
  Input(I),
  /// An tick event occurred.
  Tick,
}

/// A small event handler that wrap crossterm input and tick event. Each event
/// type is handled in its own thread and returned to a common `Receiver`
pub struct Events {
  rx: mpsc::Receiver<Event<Key>>,
  // Need to be kept around to prevent disposing the sender side.
  _tx: mpsc::Sender<Event<Key>>,
}

impl Events {
  /// Constructs an new instance of `Events` with the default config.
  pub fn new(tick_rate: u64) -> Events {
    Events::with_config(EventConfig {
      tick_rate: Duration::from_millis(tick_rate),
      ..Default::default()
    })
  }

  /// Constructs an new instance of `Events` from given config.
  pub fn with_config(config: EventConfig) -> Events {
    let (tx, rx) = mpsc::channel();

    let event_tx = tx.clone();
    thread::spawn(move || {
      loop {
        // poll for tick rate duration, if no event, sent tick event.
        if event::poll(config.tick_rate).unwrap() {
          if let event::Event::Key(key) = event::read().unwrap() {
            let key = Key::from(key);

            event_tx.send(Event::Input(key)).unwrap();
          }
        }

        event_tx.send(Event::Tick).unwrap();
      }
    });

    Events { rx, _tx: tx }
  }

  /// Attempts to read an event.
  /// This function will block the current thread.
  pub fn next(&self) -> Result<Event<Key>, mpsc::RecvError> {
    self.rx.recv()
  }
}

```

### Core Architecture Module: `src/event/key.rs`
```
use crossterm::event;
use std::fmt;

/// Represents an key.
#[derive(PartialEq, Eq, Clone, Copy, Hash, Debug)]
pub enum Key {
  /// Both Enter (or Return) and numpad Enter
  Enter,
  /// Tabulation key
  Tab,
  /// Backspace key
  Backspace,
  /// Escape key
  Esc,

  /// Left arrow
  Left,
  /// Right arrow
  Right,
  /// Up arrow
  Up,
  /// Down arrow
  Down,

  /// Insert key
  Ins,
  /// Delete key
  Delete,
  /// Home key
  Home,
  /// End key
  End,
  /// Page Up key
  PageUp,
  /// Page Down key
  PageDown,

  /// F0 key
  F0,
  /// F1 key
  F1,
  /// F2 key
  F2,
  /// F3 key
  F3,
  /// F4 key
  F4,
  /// F5 key
  F5,
  /// F6 key
  F6,
  /// F7 key
  F7,
  /// F8 key
  F8,
  /// F9 key
  F9,
  /// F10 key
  F10,
  /// F11 key
  F11,
  /// F12 key
  F12,
  Char(char),
  Ctrl(char),
  Alt(char),
  Unknown,
}

impl Key {
  /// Returns the function key corresponding to the given number
  ///
  /// 1 -> F1, etc...
  ///
  /// # Panics
  ///
  /// If `n == 0 || n > 12`
  pub fn from_f(n: u8) -> Key {
    match n {
      0 => Key::F0,
      1 => Key::F1,
      2 => Key::F2,
      3 => Key::F3,
      4 => Key::F4,
      5 => Key::F5,
      6 => Key::F6,
      7 => Key::F7,
      8 => Key::F8,
      9 => Key::F9,
      10 => Key::F10,
      11 => Key::F11,
      12 => Key::F12,
      _ => panic!("unknown function key: F{}", n),
    }
  }
}

impl fmt::Display for Key {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match *self {
      Key::Alt(' ') => write!(f, "<Alt+Space>"),
      Key::Ctrl(' ') => write!(f, "<Ctrl+Space>"),
      Key::Char(' ') => write!(f, "<Space>"),
      Key::Alt(c) => write!(f, "<Alt+{}>", c),
      Key::Ctrl(c) => write!(f, "<Ctrl+{}>", c),
      Key::Char(c) => write!(f, "{}", c),
      Key::Left | Key::Right | Key::Up | Key::Down => write!(f, "<{:?} Arrow Key>", self),
      Key::Enter
      | Key::Tab
      | Key::Backspace
      | Key::Esc
      | Key::Ins
      | Key::Delete
      | Key::Home
      | Key::End
      | Key::PageUp
      | Key::PageDown => write!(f, "<{:?}>", self),
      _ => write!(f, "{:?}", self),
    }
  }
}

impl From<event::KeyEvent> for Key {
  fn from(key_event: event::KeyEvent) -> Self {
    match key_event {
      event::KeyEvent {
        code: event::KeyCode::Esc,
        ..
      } => Key::Esc,
      event::KeyEvent {
        code: event::KeyCode::Backspace,
        ..
      } => Key::Backspace,
      event::KeyEvent {
        code: event::KeyCode::Left,
        ..
      } => Key::Left,
      event::KeyEvent {
        code: event::KeyCode::Right,
        ..
      } => Key::Right,
      event::KeyEvent {
        code: event::KeyCode::Up,
        ..
      } => Key::Up,
      event::KeyEvent {
        code: event::KeyCode::Down,
        ..
      } => Key::Down,
      event::KeyEvent {
        code: event::KeyCode::Home,
        ..
      } => Key::Home,
      event::KeyEvent {
        code: event::KeyCode::End,
        ..
      } => Key::End,
      event::KeyEvent {
        code: event::KeyCode::PageUp,
        ..
      } => Key::PageUp,
      event::KeyEvent {
        code: event::KeyCode::PageDown,
        ..
      } => Key::PageDown,
      event::KeyEvent {
        code: event::KeyCode::Delete,
        ..
      } => Key::Delete,
      event::KeyEvent {
        code: event::KeyCode::Insert,
        ..
      } => Key::Ins,
      event::KeyEvent {
        code: event::KeyCode::F(n),
        ..
      } => Key::from_f(n),
      event::KeyEvent {
        code: event::KeyCode::Enter,
        ..
      } => Key::Enter,
      event::KeyEvent {
        code: event::KeyCode::Tab,
        ..
      } => Key::Tab,

      // First check for char + modifier
      event::KeyEvent {
        code: event::KeyCode::Char(c),
        modifiers: event::KeyModifiers::ALT,
      } => Key::Alt(c),
      event::KeyEvent {
        code: event::KeyCode::Char(c),
        modifiers: event::KeyModifiers::CONTROL,
      } => Key::Ctrl(c),

      event::KeyEvent {
        code: event::KeyCode::Char(c),
        ..
      } => Key::Char(c),

      _ => Key::Unknown,
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #821** (2021-08-23): **Pressing `d` twice requires `q` twice to exit**
  *Symptoms*: The device selector popup can be opened multiple times by pressing `d` more than once. To get back to the main menu, each of these needs to be closed separately by pressing `q` the same number of times.  It would be nicer if pressing `q` only once always goes back to the main menu.  E.g, actual behavior: - press `d` - press `d` - press `q` - You're seeing the device selector  expected behavior: - press `d` - press `d` - press `q` - You're seeing the main menu

- **Issue #661** (2021-02-27): **Repeat: Track setting seems to be arbitraily reverted **
  *Symptoms*: I like to have a particular white noise track playing and being able to loop just one track is important to me. I'm noticing that the Repeat setting is simply discarded 
  **Post-Mortem & Fix Analysis**:
  > I'm cycling the repeat settings using Ctrl+R. It looks like the repeat setting falls back to Repeat: All after just a few seconds
  > I have same problem while playing brown noice. spotify-tui 0.22.0  It changes automatically from Repeat: All to Repeat: Off and another case is from Repeat: Track to Repeat: All
  > Seeing the same issue, repeating a single track seems to not work at all atm.

- **Issue #192** (2020-01-26): **Disallow scrolling past the end of a playlist**
  *Symptoms*: If you hammer on `Ctrl-D` for a while, you'll see that you can scroll past the end of a playlist. You need to press `Ctrl-U` as many times as you pressed `Ctrl-D` after the playlist had already been scrolled past in order to get back to the bottom.  I'd expect scrolling down to bottom out at the end of a playlist.
  **Post-Mortem & Fix Analysis**:
  > You're right. Needs fixing 👍 
  > Took a swing at this in #216
  > #216 closes this

- **Issue #174** (2020-01-16): **Typing 'q' to exit focuses search bar**
  *Symptoms*: After playing some tracks, typing q to get back to the main screen and then q to quit the application puts the cursor in the search bar. Hitting 'esc' and then 'q' typically then exits the application.
  **Post-Mortem & Fix Analysis**:
  > Hi @stevensonmt, you are right. I had originally intended this to be that way, however I myself don't like it.  If anyone want to have a crack at fixing, we could possibly do this: when we are `pop`ing the navigation stack via `q` we can check if the `pop`ed route is `Search` and then immediately `pop` again - essentially bypassing the search route.
  > I can have a go at that this evening. Seems pretty straightforward to match on the pop result of Some(Search) and pop again.
  > @Rigellute I think this issue can be closed as fixed.

- **Issue #119** (2019-10-28): **Fix save in album view**
  *Symptoms*: Toggle saving tracks did not work in the album tracks view. This change also fixes displaying saved track status instantly.

- **Issue #109** (2019-10-25): **Fix app crash when pressing `q` then `down`**
  *Symptoms*: This closes #105

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

### Incident Patch 1: `7550d6eb` (2021-11-17)
**Commit Message**: Fix confirmation dialog handling on playlist delete. (#910)

* Fix playlist deletion handling.

* Refactor get_current_user_saved_artists_next.

**File**: `src/app.rs` (modified, +3/-7)
```diff
@@ -158,6 +158,7 @@ pub enum RouteId {
   Podcasts,
   PodcastEpisodes,
   Recommendations,
+  Dialog,
 }
 
 #[derive(Debug)]
@@ -767,13 +768,8 @@ impl App {
       }
       None => {
         if let Some(saved_artists) = &self.library.saved_artists.clone().get_results(None) {
-          match saved_artists.items.last() {
-            Some(last_artist) => {
-              self.dispatch(IoEvent::GetFollowedArtists(Some(last_artist.id.clone())));
-            }
-            None => {
-              return;
-            }
+          if let Some(last_artist) = saved_artists.items.last() {
+            self.dispatch(IoEvent::GetFollowedArtists(Some(last_artist.id.clone())));
           }
         }
       }
```

**File**: `src/handlers/common_key_events.rs` (modified, +1/-0)
```diff
@@ -134,6 +134,7 @@ pub fn handle_right_event(app: &mut App) {
       RouteId::Error => {}
       RouteId::Analysis => {}
       RouteId::BasicView => {}
+      RouteId::Dialog => {}
     },
     _ => {}
   };
```

**File**: `src/handlers/playlist.rs` (modified, +5/-3)
```diff
@@ -2,7 +2,7 @@ use super::{
   super::app::{App, DialogContext, TrackTableContext},
   common_key_events,
 };
-use crate::app::ActiveBlock;
+use crate::app::{ActiveBlock, RouteId};
 use crate::event::Key;
 use crate::network::IoEvent;
 
@@ -78,8 +78,10 @@ pub fn handler(key: Key, app: &mut App) {
         app.dialog = Some(selected_playlist.clone());
         app.confirm = false;
 
-        let route = app.get_current_route().id.clone();
-        app.push_navigation_stack(route, ActiveBlock::Dialog(DialogContext::PlaylistWindow));
+        app.push_navigation_stack(
+          RouteId::Dialog,
+          ActiveBlock::Dialog(DialogContext::PlaylistWindow),
+        );
       }
     }
     _ => {}
```

**File**: `src/handlers/search_results.rs` (modified, +4/-2)
```diff
@@ -527,8 +527,10 @@ pub fn handler(key: Key, app: &mut App) {
           app.dialog = Some(selected_playlist.clone());
           app.confirm = false;
 
-          let route = app.get_current_route().id.clone();
-          app.push_navigation_stack(route, ActiveBlock::Dialog(DialogContext::PlaylistSearch));
+          app.push_navigation_stack(
+            RouteId::Dialog,
+            ActiveBlock::Dialog(DialogContext::PlaylistSearch),
+          );
         }
       }
       SearchResultBlock::ShowSearch => app.user_unfollow_show(ActiveBlock::SearchResultBlock),
```

**File**: `src/ui/mod.rs` (modified, +1/-0)
```diff
@@ -276,6 +276,7 @@ where
     RouteId::SelectedDevice => {} // This is handled as a "full screen" route in main.rs
     RouteId::Analysis => {} // This is handled as a "full screen" route in main.rs
     RouteId::BasicView => {} // This is handled as a "full screen" route in main.rs
+    RouteId::Dialog => {} // This is handled in the draw_dialog function in mod.rs
   };
 }
 
```

---

### Incident Patch 2: `054b248c` (2021-10-01)
**Commit Message**: Bump backtrace from 0.3.56 to 0.3.57 (#879)

Bumps [backtrace](https://github.com/rust-lang/backtrace-rs) from 0.3.56 to 0.3.57.
- [Release notes](https://github.com/rust-lang/backtrace-rs/releases)
- [Commits](https://github.com/rust-lang/backtrace-rs/compare/0.3.56...0.3.57)

---
updated-dependencies:
- dependency-name: backtrace
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -92,9 +92,9 @@ checksum = "f8aac770f1885fd7e387acedd76065302551364496e46b3dd00860b2f8359b9d"
 
 [[package]]
 name = "backtrace"
-version = "0.3.56"
+version = "0.3.57"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9d117600f438b1707d4e4ae15d3595657288f8235a0eb593e80ecc98ab34e1bc"
+checksum = "78ed203b9ba68b242c62b3fb7480f589dd49829be1edb3fe8fc8b4ffda2dcb8d"
 dependencies = [
  "addr2line",
  "cfg-if 1.0.0",
@@ -906,9 +906,9 @@ checksum = "e2abad23fbc42b3700f2f279844dc832adb2b2eb069b2df918f455c4e18cc646"
 
 [[package]]
 name = "libc"
-version = "0.2.82"
+version = "0.2.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "89203f3fba0a3795506acaad8ebce3c80c0af93f994d5a1d7a0b1eeb23271929"
+checksum = "dd8f7255a17a627354f321ef0055d63b898c6fb27eff628af4d1b66b7331edf6"
 
 [[package]]
 name = "linked-hash-map"
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ serde_yaml = "0.8"
 dirs = "3.0.2"
 clap = "2.33.3"
 unicode-width = "0.1.8"
-backtrace = "0.3.56"
+backtrace = "0.3.57"
 arboard = "1.2.0"
 crossterm = "0.20"
 tokio = { version = "0.2", features = ["full"] }
```

---

### Incident Patch 3: `93fd30fa` (2021-10-01)
**Commit Message**: Add option to set window title to "spt - Spotify TUI" on startup (#844)

**File**: `README.md` (modified, +2/-0)
```diff
@@ -254,6 +254,8 @@ behavior:
   repeat_context_icon: 🔁
   playing_icon: ▶
   paused_icon: ⏸
+  # Sets the window title to "spt - Spotify TUI" via ANSI escape code.
+  set_window_title: true
 
 keybindings:
   # Key stroke can be used if it only uses two keys:
```

**File**: `src/main.rs` (modified, +9/-2)
```diff
@@ -22,7 +22,9 @@ use crossterm::{
   event::{DisableMouseCapture, EnableMouseCapture},
   execute,
   style::Print,
-  terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
+  terminal::{
+    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen, SetTitle,
+  },
   ExecutableCommand,
 };
 use network::{get_spotify, IoEvent, Network};
@@ -268,7 +270,12 @@ async fn start_ui(user_config: UserConfig, app: &Arc<Mutex<App>>) -> Result<()>
   execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
   enable_raw_mode()?;
 
-  let backend = CrosstermBackend::new(stdout);
+  let mut backend = CrosstermBackend::new(stdout);
+
+  if user_config.behavior.set_window_title {
+    backend.execute(SetTitle("spt - Spotify TUI"))?;
+  }
+
   let mut terminal = Terminal::new(backend)?;
   terminal.hide_cursor()?;
 
```

**File**: `src/user_config.rs` (modified, +7/-0)
```diff
@@ -219,6 +219,7 @@ pub struct BehaviorConfigString {
   pub repeat_context_icon: Option<String>,
   pub playing_icon: Option<String>,
   pub paused_icon: Option<String>,
+  pub set_window_title: Option<bool>,
 }
 
 #[derive(Clone)]
@@ -235,6 +236,7 @@ pub struct BehaviorConfig {
   pub repeat_context_icon: String,
   pub playing_icon: String,
   pub paused_icon: String,
+  pub set_window_title: bool,
 }
 
 #[derive(Default, Clone, Debug, PartialEq, Serialize, Deserialize)]
@@ -297,6 +299,7 @@ impl UserConfig {
         repeat_context_icon: "🔁".to_string(),
         playing_icon: "▶".to_string(),
         paused_icon: "⏸".to_string(),
+        set_window_title: true,
       },
       path_to_config: None,
     }
@@ -454,6 +457,10 @@ impl UserConfig {
       self.behavior.repeat_context_icon = repeat_context_icon;
     }
 
+    if let Some(set_window_title) = behavior_config.set_window_title {
+      self.behavior.set_window_title = set_window_title;
+    }
+
     Ok(())
   }
 
```

---

### Incident Patch 4: `cb70ea13` (2021-08-24)
**Commit Message**: Fix help table

The upgrade to `tui` seems to have changed the way constraints work
slightly.

**File**: `src/ui/mod.rs` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ where
         .border_style(help_menu_style),
     )
     .style(help_menu_style)
-    .widths(&[Constraint::Max(110)]);
+    .widths(&[Constraint::Percentage(100)]);
   f.render_widget(help_menu, chunks[0]);
 }
 
```

---

### Incident Patch 5: `1ef37e75` (2021-08-23)
**Commit Message**: Upgrade tui and crossterm deps (#867)

**File**: `Cargo.lock` (modified, +27/-47)
```diff
@@ -1,5 +1,7 @@
 # This file is automatically @generated by Cargo.
 # It is not intended for manual editing.
+version = 3
+
 [[package]]
 name = "addr2line"
 version = "0.14.1"
@@ -65,12 +67,6 @@ dependencies = [
  "x11rb",
 ]
 
-[[package]]
-name = "arc-swap"
-version = "0.4.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4d25d88fd6b8041580a654f9d0c581a047baee2b3efee13275f2fc392fc75034"
-
 [[package]]
 name = "arrayref"
 version = "0.3.6"
@@ -357,50 +353,25 @@ dependencies = [
 
 [[package]]
 name = "crossterm"
-version = "0.18.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e86d73f2a0b407b5768d10a8c720cf5d2df49a9efc10ca09176d201ead4b7fb"
-dependencies = [
- "bitflags",
- "crossterm_winapi 0.6.2",
- "lazy_static",
- "libc",
- "mio 0.7.0",
- "parking_lot",
- "signal-hook",
- "winapi 0.3.9",
-]
-
-[[package]]
-name = "crossterm"
-version = "0.19.0"
+version = "0.20.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7c36c10130df424b2f3552fcc2ddcd9b28a27b1e54b358b45874f88d1ca6888c"
+checksum = "c0ebde6a9dd5e331cd6c6f48253254d117642c31653baa475e394657c59c1f7d"
 dependencies = [
  "bitflags",
- "crossterm_winapi 0.7.0",
- "lazy_static",
+ "crossterm_winapi",
  "libc",
  "mio 0.7.0",
  "parking_lot",
  "signal-hook",
+ "signal-hook-mio",
  "winapi 0.3.9",
 ]
 
 [[package]]
 name = "crossterm_winapi"
-version = "0.6.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c2265c3f8e080075d9b6417aa72293fc71662f34b4af2612d8d1b074d29510db"
-dependencies = [
- "winapi 0.3.9",
-]
-
-[[package]]
-name = "crossterm_winapi"
-version = "0.7.0"
+version = "0.8.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0da8964ace4d3e4a044fd027919b2237000b24315a37c916f61809f1ff2140b9"
+checksum = "3a6966607622438301997d3dac0d2f6e9a90c68bb6bc1785ea98456ab93c0507"
 dependencies = [
  "winapi 0.3.9",
 ]
@@ -1900,22 +1871,31 @@ dependencies = [
 
 [[package]]
 name = "signal-hook"
-version = "0.1.16"
+version = "0.3.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "604508c1418b99dfe1925ca9224829bb2a8a9a04dda655cc01fcad46f4ab05ed"
+checksum = "470c5a6397076fae0094aaf06a08e6ba6f37acb77d3b1b91ea92b4d6c8650c39"
 dependencies = [
  "libc",
- "mio 0.7.0",
  "signal-hook-registry",
 ]
 
+[[package]]
+name = "signal-hook-mio"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "29fd5867f1c4f2c5be079aee7a2adf1152ebb04a4bc4d341f504b7dece607ed4"
+dependencies = [
+ "libc",
+ "mio 0.7.0",
+ "signal-hook",
+]
+
 [[package]]
 name = "signal-hook-registry"
-version = "1.2.0"
+version = "1.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "94f478ede9f64724c5d173d7bb56099ec3e2d9fc2774aac65d34b8b890405f41"
+checksum = "e51e73328dc4ac0c7ccbda3a494dfa03df1de2f46018127f60c693f2648455b0"
 dependencies = [
- "arc-swap",
  "libc",
 ]
 
@@ -1951,7 +1931,7 @@ dependencies = [
  "arboard",
  "backtrace",
  "clap",
- "crossterm 0.19.0",
+ "crossterm",
  "dirs",
  "rand 0.8.3",
  "rspotify",
@@ -2209,13 +2189,13 @@ checksum = "59547bce71d9c38b83d9c0e92b6066c4253371f15005def0c30d9657f50c7642"
 
 [[package]]
 name = "tui"
-version = "0.14.0"
+version = "0.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9ced152a8e9295a5b168adc254074525c17ac4a83c90b2716274cc38118bddc9"
+checksum = "39c8ce4e27049eed97cfa363a5048b09d995e209994634a0efc26a14ab6c0c23"
 dependencies = [
  "bitflags",
  "cassowary",
- "crossterm 0.18.2",
+ "crossterm",
  "unicode-segmentation",
  "unicode-width",
 ]
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@ license = "MIT OR Apache-2.0"
 
 [dependencies]
 rspotify = "0.10.0"
-tui = { version = "0.14.0", features = ["crossterm"], default-features = false }
+tui = { version = "0.16.0", features = ["crossterm"], default-features = false }
 serde = { version = "1.0", features = ["derive"] }
 serde_json = "1.0"
 serde_yaml = "0.8"
@@ -24,7 +24,7 @@ clap = "2.33.3"
 unicode-width = "0.1.8"
 backtrace = "0.3.56"
 arboard = "1.2.0"
-crossterm = "0.19"
+crossterm = "0.20"
 tokio = { version = "0.2", features = ["full"] }
 rand = "0.8.3"
 anyhow = "1.0.43"
```

---

### Incident Patch 6: `eba6390e` (2021-08-23)
**Commit Message**: Pressing `d` twice requires `q` twice to exit (#826)

* dedup selected device routes from nav stack

* dedup any matching routes from nav stack

* catch duplicate route id on push

* remove return

* remove id from variable name

**File**: `src/app.rs` (modified, +12/-5)
```diff
@@ -626,11 +626,18 @@ impl App {
   // The navigation_stack actually only controls the large block to the right of `library` and
   // `playlists`
   pub fn push_navigation_stack(&mut self, next_route_id: RouteId, next_active_block: ActiveBlock) {
-    self.navigation_stack.push(Route {
-      id: next_route_id,
-      active_block: next_active_block,
-      hovered_block: next_active_block,
-    });
+    if !self
+      .navigation_stack
+      .last()
+      .map(|last_route| last_route.id == next_route_id)
+      .unwrap_or(false)
+    {
+      self.navigation_stack.push(Route {
+        id: next_route_id,
+        active_block: next_active_block,
+        hovered_block: next_active_block,
+      });
+    }
   }
 
   pub fn pop_navigation_stack(&mut self) -> Option<Route> {
```

---

### Incident Patch 7: `ddb2525a` (2021-08-23)
**Commit Message**: Fix typo (#834)

**File**: `src/main.rs` (modified, +1/-1)
```diff
@@ -302,7 +302,7 @@ async fn start_ui(user_config: UserConfig, app: &Arc<Mutex<App>>) -> Result<()>
         ));
 
         // Based on the size of the terminal, adjust how many lines are
-        // dislayed in the help menu
+        // displayed in the help menu
         if app.size.height > 8 {
           app.help_menu_max_lines = (app.size.height as u32) - 8;
         } else {
```

---

### Incident Patch 8: `f77049a1` (2021-08-23)
**Commit Message**: Fix bad all-contributors JSON

**File**: `.all-contributorsrc` (modified, +1/-1)
```diff
@@ -804,7 +804,7 @@
       "profile": "https://alejandr0angul0.dev/",
       "contributions": [
         "code"
-      ],
+      ]
     },
     {
       "login": "masguit42",
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## [Unreleased]
 
+- Fixed rate limiting issue [#852](https://github.com/Rigellute/spotify-tui/pull/852)
+
 ## [0.24.0] - 2021-04-26
 
 ### Fixed
```

---

### Incident Patch 9: `84b29bb9` (2021-08-23)
**Commit Message**: Fixed typo (#850)

Overriding due to new clippy rules that are fixed in the upstream. These changes do not break the new rules.

**File**: `src/event/key.rs` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ pub enum Key {
   Char(char),
   Ctrl(char),
   Alt(char),
-  Unkown,
+  Unknown,
 }
 
 impl Key {
@@ -199,7 +199,7 @@ impl From<event::KeyEvent> for Key {
         ..
       } => Key::Char(c),
 
-      _ => Key::Unkown,
+      _ => Key::Unknown,
     }
   }
 }
```

---

### Incident Patch 10: `c356a98c` (2021-08-23)
**Commit Message**: docs: add masguit42 as a contributor for doc (#859)

* docs: update README.md [skip ci]

* docs: update .all-contributorsrc [skip ci]

Co-authored-by: allcontributors[bot] <46447321+allcontributors[bot]@users.noreply.github.com>

**File**: `.all-contributorsrc` (modified, +9/-0)
```diff
@@ -796,6 +796,15 @@
       "contributions": [
         "doc"
       ]
+    },
+    {
+      "login": "masguit42",
+      "name": "Anton Kostin",
+      "avatar_url": "https://avatars.githubusercontent.com/u/11005780?v=4",
+      "profile": "http://t.me/lego1as",
+      "contributions": [
+        "doc"
+      ]
     }
   ],
   "contributorsPerLine": 7,
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@
 ![](https://img.shields.io/github/v/release/Rigellute/spotify-tui?color=%23c694ff)
 
 <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
-[![All Contributors](https://img.shields.io/badge/all_contributors-86-orange.svg?style=flat-square)](#contributors-)
+[![All Contributors](https://img.shields.io/badge/all_contributors-87-orange.svg?style=flat-square)](#contributors-)
 <!-- ALL-CONTRIBUTORS-BADGE:END -->
 
 [![Follow Alexander Keliris (Rigellute)](https://img.shields.io/twitter/follow/AlexKeliris?label=Follow%20Alexander%20Keliris%20%28Rigellute%29&style=social)](https://twitter.com/intent/follow?screen_name=AlexKeliris)
@@ -443,6 +443,7 @@ Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/d
   <tr>
     <td align="center"><a href="https://github.com/hantatsang"><img src="https://avatars.githubusercontent.com/u/11912225?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Sang</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=hantatsang" title="Documentation">📖</a></td>
     <td align="center"><a href="https://yktakaha4.github.io/"><img src="https://avatars.githubusercontent.com/u/20282867?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yuuki Takahashi</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=yktakaha4" title="Documentation">📖</a></td>
+    <td align="center"><a href="http://t.me/lego1as"><img src="https://avatars.githubusercontent.com/u/11005780?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Anton Kostin</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=masguit42" title="Documentation">📖</a></td>
   </tr>
 </table>
 
```

---

### Incident Patch 11: `100feac9` (2021-08-23)
**Commit Message**: Fixed instant not being updated on empty responses (#852)

Merging due to upstream clippy fixes

**File**: `src/network.rs` (modified, +23/-14)
```diff
@@ -346,21 +346,30 @@ impl<'a> Network<'a> {
       )
       .await;
 
-    if let Ok(Some(c)) = context {
-      let mut app = self.app.lock().await;
-      app.current_playback_context = Some(c.clone());
-      app.instant_since_last_current_playback_poll = Instant::now();
-
-      if let Some(item) = c.item {
-        match item {
-          PlayingItem::Track(track) => {
-            if let Some(track_id) = track.id {
-              app.dispatch(IoEvent::CurrentUserSavedTracksContains(vec![track_id]));
-            };
+    match context {
+      Ok(Some(c)) => {
+        let mut app = self.app.lock().await;
+        app.current_playback_context = Some(c.clone());
+        app.instant_since_last_current_playback_poll = Instant::now();
+
+        if let Some(item) = c.item {
+          match item {
+            PlayingItem::Track(track) => {
+              if let Some(track_id) = track.id {
+                app.dispatch(IoEvent::CurrentUserSavedTracksContains(vec![track_id]));
+              };
+            }
+            PlayingItem::Episode(_episode) => { /*should map this to following the podcast show*/ }
           }
-          PlayingItem::Episode(_episode) => { /*should map this to following the podcast show*/ }
-        }
-      };
+        };
+      }
+      Ok(None) => {
+        let mut app = self.app.lock().await;
+        app.instant_since_last_current_playback_poll = Instant::now();
+      }
+      Err(e) => {
+        self.handle_error(anyhow!(e)).await;
+      }
     }
 
     let mut app = self.app.lock().await;
```

---

### Incident Patch 12: `5884dd69` (2021-08-23)
**Commit Message**: Fix clippy warnings after Rust upgrade (#858)

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -15,3 +15,5 @@ secrets.tar
 
 *.swp
 tags
+
+.idea
\ No newline at end of file
```

**File**: `src/app.rs` (modified, +2/-2)
```diff
@@ -779,7 +779,7 @@ impl App {
     }
 
     if let Some(saved_artists) = &self.library.saved_artists.get_results(None).cloned() {
-      self.set_saved_artists_to_table(&saved_artists);
+      self.set_saved_artists_to_table(saved_artists);
     }
   }
 
@@ -810,7 +810,7 @@ impl App {
     }
 
     if let Some(saved_tracks) = &self.library.saved_tracks.get_results(None).cloned() {
-      self.set_saved_tracks_to_table(&saved_tracks);
+      self.set_saved_tracks_to_table(saved_tracks);
     }
   }
 
```

**File**: `src/handlers/search_results.rs` (modified, +3/-4)
```diff
@@ -389,10 +389,9 @@ fn handle_recommended_tracks(app: &mut App) {
       if let Some(index) = &app.search_results.selected_tracks_index {
         if let Some(result) = app.search_results.tracks.clone() {
           if let Some(track) = result.items.get(index.to_owned()) {
-            let track_id_list: Option<Vec<String>> = match &track.id {
-              Some(id) => Some(vec![id.to_string()]),
-              None => None,
-            };
+            let track_id_list: Option<Vec<String>> =
+              track.id.as_ref().map(|id| vec![id.to_string()]);
+
             app.recommendations_context = Some(RecommendationsContext::Song);
             app.recommendations_seed = track.name.clone();
             app.get_recommendations_for_seed(None, track_id_list, Some(track.clone()));
```

**File**: `src/handlers/track_table.rs` (modified, +10/-22)
```diff
@@ -267,10 +267,8 @@ fn handle_recommended_tracks(app: &mut App) {
   let (selected_index, tracks) = (&app.track_table.selected_index, &app.track_table.tracks);
   if let Some(track) = tracks.get(*selected_index) {
     let first_track = track.clone();
-    let track_id_list: Option<Vec<String>> = match &track.id {
-      Some(id) => Some(vec![id.to_string()]),
-      None => None,
-    };
+    let track_id_list = track.id.as_ref().map(|id| vec![id.to_string()]);
+
     app.recommendations_context = Some(RecommendationsContext::Song);
     app.recommendations_seed = first_track.name.clone();
     app.get_recommendations_for_seed(None, track_id_list, Some(first_track));
@@ -321,14 +319,10 @@ fn on_enter(app: &mut App) {
       TrackTableContext::MyPlaylists => {
         if let Some(_track) = tracks.get(*selected_index) {
           let context_uri = match (&app.active_playlist_index, &app.playlists) {
-            (Some(active_playlist_index), Some(playlists)) => {
-              if let Some(selected_playlist) = playlists.items.get(active_playlist_index.to_owned())
-              {
-                Some(selected_playlist.uri.to_owned())
-              } else {
-                None
-              }
-            }
+            (Some(active_playlist_index), Some(playlists)) => playlists
+              .items
+              .get(active_playlist_index.to_owned())
+              .map(|selected_playlist| selected_playlist.uri.to_owned()),
             _ => None,
           };
 
@@ -379,16 +373,10 @@ fn on_enter(app: &mut App) {
             &app.search_results.selected_playlists_index,
             &app.search_results.playlists,
           ) {
-            (Some(selected_playlist_index), Some(playlist_result)) => {
-              if let Some(selected_playlist) = playlist_result
-                .items
-                .get(selected_playlist_index.to_owned())
-              {
-                Some(selected_playlist.uri.to_owned())
-              } else {
-                None
-              }
-            }
+            (Some(selected_playlist_index), Some(playlist_result)) => playlist_result
+              .items
+              .get(selected_playlist_index.to_owned())
+              .map(|selected_playlist| selected_playlist.uri.to_owned()),
             _ => None,
           };
 
```

**File**: `src/network.rs` (modified, +1/-4)
```diff
@@ -1035,10 +1035,7 @@ impl<'a> Network<'a> {
 
   async fn get_recommendations_for_track_id(&mut self, id: String, country: Option<Country>) {
     if let Ok(track) = self.spotify.track(&id).await {
-      let track_id_list: Option<Vec<String>> = match &track.id {
-        Some(id) => Some(vec![id.to_string()]),
-        None => None,
-      };
+      let track_id_list = track.id.as_ref().map(|id| vec![id.to_string()]);
       self
         .get_recommendations_for_seed(None, track_id_list, Box::new(Some(track)), country)
         .await;
```

**File**: `src/ui/mod.rs` (modified, +28/-26)
```diff
@@ -680,32 +680,34 @@ where
   );
 
   let album_ui = match &app.album_table_context {
-    AlbumTableContext::Simplified => match &app.selected_album_simplified {
-      Some(selected_album_simplified) => Some(AlbumUi {
-        items: selected_album_simplified
-          .tracks
-          .items
-          .iter()
-          .map(|item| TableItem {
-            id: item.id.clone().unwrap_or_else(|| "".to_string()),
-            format: vec![
-              "".to_string(),
-              item.track_number.to_string(),
-              item.name.to_owned(),
-              create_artist_string(&item.artists),
-              millis_to_minutes(u128::from(item.duration_ms)),
-            ],
-          })
-          .collect::<Vec<TableItem>>(),
-        title: format!(
-          "{} by {}",
-          selected_album_simplified.album.name,
-          create_artist_string(&selected_album_simplified.album.artists)
-        ),
-        selected_index: selected_album_simplified.selected_index,
-      }),
-      None => None,
-    },
+    AlbumTableContext::Simplified => {
+      app
+        .selected_album_simplified
+        .as_ref()
+        .map(|selected_album_simplified| AlbumUi {
+          items: selected_album_simplified
+            .tracks
+            .items
+            .iter()
+            .map(|item| TableItem {
+              id: item.id.clone().unwrap_or_else(|| "".to_string()),
+              format: vec![
+                "".to_string(),
+                item.track_number.to_string(),
+                item.name.to_owned(),
+                create_artist_string(&item.artists),
+                millis_to_minutes(u128::from(item.duration_ms)),
+              ],
+            })
+            .collect::<Vec<TableItem>>(),
+          title: format!(
+            "{} by {}",
+            selected_album_simplified.album.name,
+            create_artist_string(&selected_album_simplified.album.artists)
+          ),
+          selected_index: selected_album_simplified.selected_index,
+        })
+    }
     AlbumTableContext::Full => match app.selected_album_full.clone() {
       Some(selected_album) => Some(AlbumUi {
         items: selected_album
```

---

### Incident Patch 13: `d1f1c67a` (2021-03-30)
**Commit Message**: Fix clippy warnings

**File**: `src/handlers/help_menu.rs` (modified, +8/-8)
```diff
@@ -3,34 +3,34 @@ use crate::{app::App, event::Key};
 
 #[derive(PartialEq)]
 enum Direction {
-  UP,
-  DOWN,
+  Up,
+  Down,
 }
 
 pub fn handler(key: Key, app: &mut App) {
   match key {
     k if common_key_events::down_event(k) => {
-      move_page(Direction::DOWN, app);
+      move_page(Direction::Down, app);
     }
     k if common_key_events::up_event(k) => {
-      move_page(Direction::UP, app);
+      move_page(Direction::Up, app);
     }
     Key::Ctrl('d') => {
-      move_page(Direction::DOWN, app);
+      move_page(Direction::Down, app);
     }
     Key::Ctrl('u') => {
-      move_page(Direction::UP, app);
+      move_page(Direction::Up, app);
     }
     _ => {}
   };
 }
 
 fn move_page(direction: Direction, app: &mut App) {
-  if direction == Direction::UP {
+  if direction == Direction::Up {
     if app.help_menu_page > 0 {
       app.help_menu_page -= 1;
     }
-  } else if direction == Direction::DOWN {
+  } else if direction == Direction::Down {
     app.help_menu_page += 1;
   }
   app.calculate_help_menu_offset();
```

**File**: `src/ui/mod.rs` (modified, +3/-3)
```diff
@@ -542,7 +542,7 @@ where
   }
 }
 
-struct AlbumUI {
+struct AlbumUi {
   selected_index: usize,
   items: Vec<TableItem>,
   title: String,
@@ -681,7 +681,7 @@ where
 
   let album_ui = match &app.album_table_context {
     AlbumTableContext::Simplified => match &app.selected_album_simplified {
-      Some(selected_album_simplified) => Some(AlbumUI {
+      Some(selected_album_simplified) => Some(AlbumUi {
         items: selected_album_simplified
           .tracks
           .items
@@ -707,7 +707,7 @@ where
       None => None,
     },
     AlbumTableContext::Full => match app.selected_album_full.clone() {
-      Some(selected_album) => Some(AlbumUI {
+      Some(selected_album) => Some(AlbumUi {
         items: selected_album
           .album
           .tracks
```

**File**: `src/user_config.rs` (modified, +2/-2)
```diff
@@ -337,7 +337,7 @@ impl UserConfig {
           check_reserved_keys(self.keys.$name)?;
         }
       };
-    };
+    }
 
     to_keys!(back);
     to_keys!(next_page);
@@ -376,7 +376,7 @@ impl UserConfig {
           self.theme.$name = parse_theme_item(&theme_item)?;
         }
       };
-    };
+    }
 
     to_theme_item!(active);
     to_theme_item!(banner);
```

---

### Incident Patch 14: `e77060c5` (2021-03-14)
**Commit Message**: docs(README): fix default shortcut for shuffle config (#759)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ keybindings:
   copy_song_url: "c"
   copy_album_url: "C"
   help: "?"
-  shuffle: "s"
+  shuffle: "ctrl-s"
   repeat: "r"
   search: "/"
   audio_analysis: "v"
```

---

### Incident Patch 15: `915e43d5` (2021-02-27)
**Commit Message**: Merge branch 'master' of github.com:Rigellute/spotify-tui

**File**: `.all-contributorsrc` (modified, +9/-0)
```diff
@@ -769,6 +769,15 @@
       "contributions": [
         "code"
       ]
+    },
+    {
+      "login": "Jesse-Bakker",
+      "name": "Jesse",
+      "avatar_url": "https://avatars.githubusercontent.com/u/22473248?v=4",
+      "profile": "https://github.com/Jesse-Bakker",
+      "contributions": [
+        "code"
+      ]
     }
   ],
   "contributorsPerLine": 7,
```

**File**: `Cargo.lock` (modified, +28/-3)
```diff
@@ -362,7 +362,23 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4e86d73f2a0b407b5768d10a8c720cf5d2df49a9efc10ca09176d201ead4b7fb"
 dependencies = [
  "bitflags",
- "crossterm_winapi",
+ "crossterm_winapi 0.6.2",
+ "lazy_static",
+ "libc",
+ "mio 0.7.0",
+ "parking_lot",
+ "signal-hook",
+ "winapi 0.3.9",
+]
+
+[[package]]
+name = "crossterm"
+version = "0.19.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7c36c10130df424b2f3552fcc2ddcd9b28a27b1e54b358b45874f88d1ca6888c"
+dependencies = [
+ "bitflags",
+ "crossterm_winapi 0.7.0",
  "lazy_static",
  "libc",
  "mio 0.7.0",
@@ -380,6 +396,15 @@ dependencies = [
  "winapi 0.3.9",
 ]
 
+[[package]]
+name = "crossterm_winapi"
+version = "0.7.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0da8964ace4d3e4a044fd027919b2237000b24315a37c916f61809f1ff2140b9"
+dependencies = [
+ "winapi 0.3.9",
+]
+
 [[package]]
 name = "darling"
 version = "0.9.0"
@@ -1904,7 +1929,7 @@ dependencies = [
  "arboard",
  "backtrace",
  "clap",
- "crossterm",
+ "crossterm 0.19.0",
  "dirs",
  "rand 0.8.3",
  "rspotify",
@@ -2168,7 +2193,7 @@ checksum = "9ced152a8e9295a5b168adc254074525c17ac4a83c90b2716274cc38118bddc9"
 dependencies = [
  "bitflags",
  "cassowary",
- "crossterm",
+ "crossterm 0.18.2",
  "unicode-segmentation",
  "unicode-width",
 ]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ clap = "2.33.3"
 unicode-width = "0.1.8"
 backtrace = "0.3.56"
 arboard = "1.1.0"
-crossterm = "0.18"
+crossterm = "0.19"
 tokio = { version = "0.2", features = ["full"] }
 rand = "0.8.3"
 anyhow = "1.0.38"
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@
 ![](https://img.shields.io/github/v/release/Rigellute/spotify-tui?color=%23c694ff)
 
 <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
-[![All Contributors](https://img.shields.io/badge/all_contributors-83-orange.svg?style=flat-square)](#contributors-)
+[![All Contributors](https://img.shields.io/badge/all_contributors-84-orange.svg?style=flat-square)](#contributors-)
 <!-- ALL-CONTRIBUTORS-BADGE:END -->
 
 [![Follow Alexander Keliris (Rigellute)](https://img.shields.io/twitter/follow/AlexKeliris?label=Follow%20Alexander%20Keliris%20%28Rigellute%29&style=social)](https://twitter.com/intent/follow?screen_name=AlexKeliris)
@@ -438,6 +438,7 @@ Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/d
     <td align="center"><a href="https://davidbailey.codes/"><img src="https://avatars.githubusercontent.com/u/4248177?v=4?s=100" width="100px;" alt=""/><br /><sub><b>David Bailey</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=davidbailey00" title="Documentation">📖</a></td>
     <td align="center"><a href="https://github.com/sheepwall"><img src="https://avatars.githubusercontent.com/u/22132993?v=4?s=100" width="100px;" alt=""/><br /><sub><b>sheepwall</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=sheepwall" title="Code">💻</a></td>
     <td align="center"><a href="https://github.com/Hwatwasthat"><img src="https://avatars.githubusercontent.com/u/29790143?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Hwatwasthat</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=Hwatwasthat" title="Code">💻</a></td>
+    <td align="center"><a href="https://github.com/Jesse-Bakker"><img src="https://avatars.githubusercontent.com/u/22473248?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jesse</b></sub></a><br /><a href="https://github.com/Rigellute/spotify-tui/commits?author=Jesse-Bakker" title="Code">💻</a></td>
   </tr>
 </table>
 
```

**File**: `src/main.rs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ use rspotify::{
 };
 use std::{
   cmp::{max, min},
-  io::{self, stdout, Write},
+  io::{self, stdout},
   panic::{self, PanicInfo},
   path::PathBuf,
   sync::Arc,
```

**File**: `src/user_config.rs` (modified, +4/-4)
```diff
@@ -53,7 +53,7 @@ impl Default for Theme {
   fn default() -> Self {
     Theme {
       analysis_bar: Color::LightCyan,
-      analysis_bar_text: Color::Black,
+      analysis_bar_text: Color::Reset,
       active: Color::Cyan,
       banner: Color::LightCyan,
       error_border: Color::Red,
@@ -64,10 +64,10 @@ impl Default for Theme {
       playbar_background: Color::Black,
       playbar_progress: Color::LightCyan,
       playbar_progress_text: Color::LightCyan,
-      playbar_text: Color::White,
+      playbar_text: Color::Reset,
       selected: Color::LightCyan,
-      text: Color::White,
-      header: Color::White,
+      text: Color::Reset,
+      header: Color::Reset,
     }
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #1167** (closed): Fix OAuth callback redirect URI (@Qw1nti)
- **PR #1164** (closed): CN.2455622716770729:ac0dcdf86d46efbc8546ba8f2ca831d3_6909cc09af78d2a212fab136.6909cc48af78d2a212fab16c.6909cc48181021d21693c17f:Trae CN.T(2025/11/4 17:50:00) (@d-moco)
- **PR #1139** (closed): docs: add new section explaining how to change the used account (@Letder40)
- **PR #1126** (closed): bump serge (@0ofta)
- **PR #1120** (closed): test 2 (@godine-png)
- **PR #1119** (closed): test (@godine-png)
- **PR #1095** (closed): Remove unused mut (@Sanceilaks)
- **PR #1091** (closed): Playlist Editing - Import,Fork,Update,New,Delete (@justjokiing)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
