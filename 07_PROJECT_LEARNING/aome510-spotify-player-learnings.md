# Forensic Learning Record (Deep Inspection): aome510/spotify-player

> **Canonical Artifact**: `07_PROJECT_LEARNING/aome510-spotify-player-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aome510/spotify-player](https://github.com/aome510/spotify-player))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:44:39.211Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aome510/spotify-player`
- **Description**: A Spotify player in the terminal with full feature parity
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 7244 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `lyric_finder/src/lib.rs`
```
//! # `lyric_finder`
//!
//! This crate provides a [`Client`] struct for retrieving a song's lyric.
//!
//! It ultilizes the [Genius](https://genius.com) website and its APIs to get lyric data.
//!
//! ## Example
//!
//! ```rust
//! # use anyhow::Result;
//! #
//! # async fn run() -> Result<()> {
//! let client =  lyric_finder::Client::new();
//! let result = client.get_lyric("shape of you").await?;
//! match result {
//!     lyric_finder::LyricResult::Some {
//!         track,
//!         artists,
//!         lyric,
//!     } => {
//!         println!("{} by {}'s lyric:\n{}", track, artists, lyric);
//!     }
//!     lyric_finder::LyricResult::None => {
//!         println!("lyric not found!");
//!     }
//! }
//! # Ok(())
//! # }
//! ```

const SEARCH_BASE_URL: &str = "https://genius.com/api/search";

pub struct Client {
    http: reqwest::Client,
}

#[derive(Debug)]
pub enum LyricResult {
    Some {
        track: String,
        artists: String,
        lyric: String,
    },
    None,
}

impl Client {
    #[must_use]
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
        }
    }

    /// Construct a client reusing an existing http client
    #[must_use]
    pub fn from_http_client(http: &reqwest::Client) -> Self {
        Self { http: http.clone() }
    }

    /// Search songs satisfying a given `query`.
    pub async fn search_songs(&self, query: &str) -> anyhow::Result<Vec<search::Result>> {
        let query = improve_query(query);

        log::debug!("search songs: query={query}");

        let body = self
            .http
            .get(format!("{SEARCH_BASE_URL}?q={query}"))
            .send()
            .await?
            .json::<search::Body>()
            .await?;

        if body.meta.status != 200 {
            let message = if let Some(m) = body.meta.message {
                m
            } else {
                format!("request failed with status code: {}", body.meta.status)
            };
            anyhow::bail!(message);
        }

        Ok(body
            .response
            .map(|r| {
                r.hits
                    .into_iter()
                    .filter(|hit| hit.ty == "song")
                    .map(|hit| hit.result)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default())
    }

    /// Retrieve a song's lyric from a "genius.com" `url`.
    pub async fn retrieve_lyric(&self, url: &str) -> anyhow::Result<String> {
        let html = self.http.get(url).send().await?.text().await?;
        log::debug!("retrieve lyric from url={url}: html={html}");
        let lyric = parse::parse(&html)?;
        Ok(lyric.trim().to_string())
    }

    /// Process a lyric obtained by crawling the [Genius](https://genius.com) website.
    ///
    /// The lyric received this way may have weird newline spacings between sections (*).
    /// The below function tries an ad-hoc method to fix this issue.
    ///
    /// (*): A section often starts with `[`.
    fn process_lyric(lyric: &str) -> String {
        // the below code modifies the `lyric` to make the newline between sections consistent
        lyric.replace("\n\n[", "\n[").replace("\n[", "\n\n[")
    }

    /// Get the lyric of a song satisfying a given `query`.
    pub async fn get_lyric(&self, query: &str) -> anyhow::Result<LyricResult> {
        // Perform the search for songs
        let results = self.search_songs(query).await?;

        // Filter to find the first result where the artist names do not contain 'Genius'
        let result = results
            .into_iter()
            .find(|result| !result.artist_names.contains("Genius"));

        // If no valid result is found, return LyricResult::None
        let Some(result) = result else {
            return Ok(LyricResult::None);
        };

        // Retrieve the song lyrics from the URL of the result
        let lyric = self.retrieve_lyric(&result.url).await?;

        // Return a LyricResult::Some with the song information
        Ok(LyricResult::Some {
            track: result.title,
            artists: result.artist_names,
            lyric: Self::process_lyric(&lyric),
        })
    }
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

/// Returns `query` without `remaster` & `remix` information from track/artist query.
/// Returned value is lowercase.
/// These caused wildly invalid lyrics to be found.
/// (try yourself adding remastered 2011 to a song's name when searching in Genius!)
fn improve_query(query: &str) -> String {
    // flag for doing something wrong if the song name (after removing remix metadata) is too short.
    const SONG_MIN_LENGTH_WO_REMIX_METADATA: usize = 3;

    let is_dash = |c: char| c == '-';

    // reverse finder for non-filler (space, dashes) chars before an index.
    // Acts like a trim to remove undesired spaces and dashes.
    let rfind_non_filler = |s: &str, idx: usize| {
        let Some(s) = s.get(..idx) else { return idx };
        s.char_indices()
            .rfind(|(_, c)| !(is_dash(*c) || c.is_whitespace()))
            .map_or(idx, |(idx, c)| idx + c.len_utf8())
    };
    // used to handle longer variants of words: `remixed`, `remastered`, etc.
    let end_of_word = |s: &str, idx: usize| {
        let Some(s) = s.get(idx..) else { return idx };
        s.find(|c: char| !c.is_alphanumeric())
            .map_or(idx, |found| found + idx)
    };

    let mut query = query.to_lowercase();
    // remove "xxxx Remaster" from the query
    // For example, `{song} xxxx Remastered {artists}` becomes `{song} {artists}`.
    if let Some(remaster_start) = query.find("remaster") {
        let end = remaster_start + "remaster".len();
        let end = end_of_word(&query, end);

        let mut start = remaster_start.saturating_sub(1);
        let prev = query.get(..remaster_start.saturating_sub(2)).unwrap_or("");
        let end_of_prev_word = prev.rfind(' ').unwrap_or(0);

        if let Some(year) = query.get(end_of_prev_word + 1..remaster_start.saturating_sub(1)) {
            if year.chars().all(|c| c.is_whitespace() || c.is_numeric()) {
                start = end_of_prev_word;
            }
        }
        start = rfind_non_filler(&query, start);
        query.drain(start..end);
    }
    // remove "- xxxx yyy remix" from the query
    // For example, `{song} - xxxx yyy remix {artists}` becomes `{song} {artists}`.
    if let Some(remix_start) = query.find("remix") {
        let end = remix_start + "remix".len();
        let end = end_of_word(&query, end);

        if let Some(metadata_start) = query.rfind(is_dash) {
            if metadata_start >= SONG_MIN_LENGTH_WO_REMIX_METADATA {
                let start = rfind_non_filler(&query, metadata_start);
                query.drain(start..end);
            }
        }
    }
    query
}

mod parse {
    use html5ever::tendril::TendrilSink;
    use html5ever::{expanded_name, local_name, namespace_url, ns, parse_document, ParseOpts};
    use markup5ever_rcdom::{Handle, NodeData, RcDom};

    const LYRIC_CONTAINER_ATTR: &str = "data-lyrics-container";

    /// Parse the HTML content of a "genius.com" lyric page to retrieve the corresponding lyric.
    pub fn parse(html: &str) -> anyhow::Result<String> {
        // parse HTML content into DOM node(s)
        let dom = parse_document(RcDom::default(), ParseOpts::default())
            .from_utf8()
            .read_from(&mut (html.as_bytes()))?;

        let filter = |data: &NodeData| match data {
            NodeData::Element { ref attrs, .. } => attrs
                .borrow()
                .iter()
                .any(|attr| attr.name.local.to_string() == LYRIC_CONTAINER_ATTR),
            _ => false,
        };

        Ok(parse_dom_node(&dom.document, Some(&filter), false))
    }

    /// Parse a dom node and extract the text of children nodes satisfying a requirement.
    ///
    /// The requirement is represented by a `filter` function and a `should_pa
```

### Core Architecture Module: `spotify_player/src/auth.rs`
```
use std::{
    io::{BufRead, BufReader, Write},
    net::{SocketAddr, TcpListener, TcpStream},
};

use crate::config;
use anyhow::{Context as _, Result};
use base64::Engine as _;
use librespot_core::{authentication::Credentials, cache::Cache, Session};
use reqwest::Url;
use rspotify::clients::{BaseClient as _, OAuthClient as _};
use sha2::{Digest as _, Sha256};

pub const SPOTIFY_CLIENT_ID: &str = "65b708073fc0480ea92a077233ca87bd";
pub const NCSPOT_CLIENT_ID: &str = "d420a117a32841c2b3474932e49fb54b";
pub const NCSPOT_REDIRECT_URI: &str = "http://127.0.0.1:8989/login";

const SPOTIFY_AUTHORIZE_URL: &str = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL: &str = "https://accounts.spotify.com/api/token";

// based on https://developer.spotify.com/documentation/web-api/concepts/scopes#list-of-scopes
pub const OAUTH_SCOPES: &[&str] = &[
    // Spotify Connect
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    // Playback
    "app-remote-control",
    "streaming",
    // Playlists
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
    // Follow
    "user-follow-modify",
    "user-follow-read",
    // Listening History
    "user-read-playback-position",
    "user-top-read",
    "user-read-recently-played",
    // Library
    "user-library-modify",
    "user-library-read",
    // Users
    "user-personalized",
];

#[derive(Clone)]
pub struct AuthConfig {
    pub cache: Cache,
    pub login_redirect_uri: String,
}

impl Default for AuthConfig {
    fn default() -> Self {
        AuthConfig {
            cache: Cache::new(None::<String>, None, None, None).unwrap(),
            login_redirect_uri: "http://127.0.0.1:8989/login".to_string(),
        }
    }
}

impl AuthConfig {
    /// Create a `librespot::Session` from authentication configs
    pub fn session(&self) -> Session {
        let session_config = config::get_config().app_config.session_config();
        Session::new(session_config, Some(self.cache.clone()))
    }

    pub fn new(configs: &config::Configs) -> Result<AuthConfig> {
        let audio_cache_folder = if configs.app_config.device.audio_cache {
            Some(configs.cache_folder.join("audio"))
        } else {
            None
        };

        let cache = Cache::new(
            Some(configs.cache_folder.clone()),
            None,
            audio_cache_folder,
            None,
        )?;

        Ok(AuthConfig {
            cache,
            login_redirect_uri: configs.app_config.login_redirect_uri.clone(),
        })
    }
}

/// Get Spotify credentials to authenticate the application
///
/// # Args
/// - `auth_config`: authentication configuration
/// - `reauth`: whether to re-authenticate the application if no cached credentials are found
// - `use_cached`: whether to use cached credentials if available
pub fn get_creds(auth_config: &AuthConfig, reauth: bool, use_cached: bool) -> Result<Credentials> {
    let creds = if use_cached {
        auth_config.cache.credentials()
    } else {
        None
    };

    Ok(match creds {
        None => {
            let msg = "No cached credentials found, please authenticate the application first.";
            if reauth {
                eprintln!("{msg}");
                println!("Authenticating the librespot streaming client...");

                let access_token = get_oauth_access_token(
                    SPOTIFY_CLIENT_ID,
                    &auth_config.login_redirect_uri,
                    OAUTH_SCOPES,
                )?;
                Credentials::with_access_token(access_token)
            } else {
                anyhow::bail!(msg);
            }
        }
        Some(creds) => {
            tracing::info!("Using cached credentials");
            creds
        }
    })
}

/// Authenticate the configured Web API client and its optional fallback using PKCE.
///
/// This mirrors `rspotify`'s `prompt_for_token` (reusing/refreshing a cached token when possible),
/// but replaces its callback listener with [`obtain_auth_code`], which is robust against stray
/// browser requests on the callback port (see [`listen_for_auth_code`]).
///
/// When `force` is set, cached tokens are ignored and fresh interactive authorization flows are
/// run. This is used by the `authenticate` CLI command to re-authenticate on demand.
pub async fn prompt_for_user_token(
    client: &mut crate::client::WebApiClient,
    force: bool,
) -> Result<()> {
    prompt_for_web_api_token(client.primary_mut(), force, "configured client").await?;
    if let Some(fallback) = client.fallback_mut() {
        prompt_for_web_api_token(fallback, force, "ncspot fallback client").await?;
    }
    Ok(())
}

async fn prompt_for_web_api_token(
    client: &mut crate::client::PkceWebApiClient,
    force: bool,
    client_name: &str,
) -> Result<()> {
    // Reuse a cached token when possible, refreshing it if it has expired.
    if !force {
        if let Ok(Some(token)) = client.read_token_cache(true).await {
            let expired = token.is_expired();
            // A token without a refresh token cannot be renewed once it expires and
            // gets wiped by the next refresh (e.g. caches nulled by Spotify's
            // refresh-token change). Treat it as unusable so we re-authenticate and
            // obtain a fresh refresh token instead of serving a dead-end token.
            let renewable = token.refresh_token.is_some();
            *client.get_token().lock().await.unwrap() = Some(token);

            if !expired && renewable {
                return Ok(());
            }

            // A refresh may fail because the refresh token expired (Spotify expires
            // refresh tokens 6 months after the original authorization, returning
            // `invalid_grant`) or because no refresh token is available. In either
            // case, fall through to the interactive flow below rather than failing.
            match client.refetch_token().await {
                Ok(Some(refreshed)) => {
                    *client.get_token().lock().await.unwrap() = Some(refreshed);
                    client
                        .write_token_cache()
                        .await
                        .context("write refreshed token to cache")?;
                    return Ok(());
                }
                Ok(None) => {
                    tracing::warn!(
                        "Cached token could not be refreshed (no refresh token available); \
                         falling back to interactive re-authentication."
                    );
                }
                Err(err) => {
                    tracing::warn!(
                        "Failed to refresh the cached token (the refresh token may have expired \
                         per Spotify's 6-month refresh-token expiration policy); \
                         falling back to interactive re-authentication: {err:#}"
                    );
                }
            }
        }
    }

    // No usable cached token: run the interactive authorization code flow.
    // `get_authorize_url` also generates and stores the PKCE verifier used by `request_token`.
    println!("Authenticating the {client_name} for Spotify Web API access...");
    let url = client
        .get_authorize_url(None)
        .with_context(|| format!("get authorize URL for {client_name}"))?;
    let code = obtain_auth_code(&url, &client.get_oauth().redirect_uri)?;
    client
        .request_token(&code)
        .await
        .with_context(|| format!("exchange auth code for token ({client_name})"))?;

    Ok(())
}

/// Run the authorization code with PKCE flow for `librespot` and return an access token.
fn get_oauth_access_token(client_id: &str, redirect_uri: &str, scopes: &[&str]) -> Result<String> {
    let pkce = Pkce::new_random();
    let state = random_url_safe(16);
    let auth_url = build_authorize_url(client_id,
```

### Core Architecture Module: `spotify_player/src/cli/client.rs`
```
use std::{
    collections::HashSet,
    fmt::Write as _,
    fs::{create_dir_all, remove_dir_all},
    io::Write,
    net::SocketAddr,
};

use anyhow::{Context as _, Result};
use rand::seq::SliceRandom;
use tokio::net::UdpSocket;
use tracing::Instrument;

use crate::{
    cli::Request,
    client::{AppClient, PlayerRequest},
    config::{self, get_cache_folder_path},
    state::{
        AlbumId, ArtistId, Context, ContextId, Id, PlayableId, Playback, PlaybackMetadata,
        PlaylistId, SharedState, TrackId,
    },
};
use rspotify::{
    model::LibraryId,
    prelude::{BaseClient, OAuthClient},
};

use super::{
    Command, Deserialize, EditAction, GetRequest, IdOrName, ItemId, ItemType, Key, PlaylistCommand,
    Response, Serialize, MAX_REQUEST_SIZE,
};

pub async fn start_socket(
    client: &AppClient,
    state: Option<&SharedState>,
    socket: Option<tokio::net::UdpSocket>,
) {
    let socket = if let Some(s) = socket {
        s
    } else {
        let configs = config::get_config();
        let port = configs.app_config.client_port;
        tracing::info!("Starting a client socket at 127.0.0.1:{port}");

        match tokio::net::UdpSocket::bind(("127.0.0.1", port)).await {
            Ok(socket) => socket,
            Err(err) => {
                tracing::warn!(
                    "Failed to create a client socket for handling CLI commands: {err:#}"
                );
                return;
            }
        }
    };

    let mut buf = [0; MAX_REQUEST_SIZE];

    loop {
        match socket.recv_from(&mut buf).await {
            Err(err) => tracing::warn!("Failed to receive from the socket: {err:#}"),
            Ok((n_bytes, dest_addr)) => {
                if n_bytes == 0 {
                    // received a connection request from the destination address
                    socket.send_to(&[], dest_addr).await.unwrap_or_default();
                    continue;
                }

                let req_buf = &buf[0..n_bytes];
                let request: Request = match serde_json::from_slice(req_buf) {
                    Ok(v) => v,
                    Err(err) => {
                        tracing::error!("Cannot deserialize the socket request: {err:#}");
                        continue;
                    }
                };

                let span = tracing::info_span!("socket_request", request = ?request, dest_addr = ?dest_addr);

                async {
                    let response = match handle_socket_request(client, state, request).await {
                        Err(err) => {
                            tracing::error!("Failed to handle socket request: {err:#}");
                            let msg = format!("Bad request: {err:#}");
                            Response::Err(msg.into_bytes())
                        }
                        Ok(data) => Response::Ok(data),
                    };
                    send_response(response, &socket, dest_addr)
                        .await
                        .unwrap_or_default();

                    tracing::info!("Successfully handled the socket request.",);
                }
                .instrument(span)
                .await;
            }
        }
    }
}

async fn send_response(
    response: Response,
    socket: &UdpSocket,
    dest_addr: SocketAddr,
) -> Result<()> {
    let data = serde_json::to_vec(&response)?;

    // as the result data can be large and may not be sent in a single UDP datagram,
    // split it into smaller chunks
    for chunk in data.chunks(4096) {
        socket.send_to(chunk, dest_addr).await?;
    }
    // send an empty buffer to indicate end of chunk
    socket.send_to(&[], dest_addr).await?;
    Ok(())
}

async fn current_playback(
    client: &AppClient,
    state: Option<&SharedState>,
) -> Result<Option<rspotify::model::CurrentPlaybackContext>> {
    // get current playback from the application's state, if exists, or by making an API request
    match state {
        Some(state) => Ok(state.player.read().current_playback()),
        None => client
            .current_playback2()
            .await
            .context("get current playback"),
    }
}

async fn handle_socket_request(
    client: &AppClient,
    state: Option<&SharedState>,
    request: super::Request,
) -> Result<Vec<u8>> {
    match request {
        Request::Get(GetRequest::Key(key)) => handle_get_key_request(client, state, key).await,
        Request::Get(GetRequest::Item(item_type, id_or_name)) => {
            handle_get_item_request(client, item_type, id_or_name).await
        }
        Request::Playback(command) => {
            handle_playback_request(client, state, command).await?;
            Ok(Vec::new())
        }
        Request::Connect(data) => {
            let id = match data {
                IdOrName::Id(id) => id,
                IdOrName::Name(name) => {
                    let devices = client.available_devices().await?;
                    match devices
                        .into_iter()
                        .find(|d| d.name == name)
                        .and_then(|d| d.id)
                    {
                        Some(id) => id,
                        None => {
                            anyhow::bail!("No device with name={name} found");
                        }
                    }
                }
            };

            client.transfer_playback(&id, None).await?;
            Ok(Vec::new())
        }
        Request::Like { unlike } => {
            let playback = current_playback(client, state).await?;

            // get currently playing track from the playback
            let track = match playback {
                None => None,
                Some(ref playback) => match playback.item {
                    Some(rspotify::model::PlayableItem::Track(ref track)) => Some(track),
                    _ => None,
                },
            };

            if let Some(id) = track.and_then(|t| t.id.clone()) {
                if unlike {
                    client.library_remove([LibraryId::Track(id)]).await?;
                } else {
                    client.library_add([LibraryId::Track(id)]).await?;
                }
            }

            Ok(Vec::new())
        }
        Request::Playlist(command) => {
            let resp = handle_playlist_request(client, command).await?;
            Ok(resp.into_bytes())
        }
        Request::Search { query } => {
            let resp = handle_search_request(client, query).await?;
            Ok(resp)
        }
        Request::Lyrics { id_or_name } => handle_lyrics_request(client, state, id_or_name).await,
    }
}

async fn handle_get_key_request(
    client: &AppClient,
    state: Option<&SharedState>,
    key: Key,
) -> Result<Vec<u8>> {
    Ok(match key {
        Key::Playback => {
            let playback = current_playback(client, state).await?;
            serde_json::to_vec(&playback)?
        }
        Key::Devices => {
            let devices = client.available_devices().await?;
            serde_json::to_vec(&devices)?
        }
        Key::UserPlaylists => {
            let playlists = client.current_user_playlists().await?;
            serde_json::to_vec(&playlists)?
        }
        Key::UserLikedTracks => {
            let tracks = client.current_user_saved_tracks().await?;
            serde_json::to_vec(&tracks)?
        }
        Key::UserTopTracks => {
            let tracks = client.current_user_top_tracks().await?;
            serde_json::to_vec(&tracks)?
        }
        Key::UserSavedAlbums => {
            let albums = client.current_user_saved_albums().await?;
            serde_json::to_vec(&albums)?
        }
        Key::UserFollowedArtists => {
            let artists = client.current_user_followed_artists().await?;
            serde_json::to_vec(&artists)?
        }
        Key::Queue => {
            let queue = client.current_user_queue().await?;
            serde_json::to_vec(&queue)?
        }
    })
}

/// Get a
```

### Core Architecture Module: `spotify_player/src/cli/commands.rs`
```
use clap::{builder::EnumValueParser, value_parser, Arg, ArgAction, ArgGroup, Command};
use clap_complete::Shell;

use crate::cli::EditAction;

use super::{ContextType, ItemType, Key};

pub fn init_connect_subcommand() -> Command {
    add_id_or_name_group(Command::new("connect").about("Connect to a Spotify device"))
}

pub fn init_get_subcommand() -> Command {
    Command::new("get")
        .about("Get Spotify data")
        .subcommand_required(true)
        .subcommand(
            Command::new("key").about("Get data by key").arg(
                Arg::new("key")
                    .value_parser(EnumValueParser::<Key>::new())
                    .required(true),
            ),
        )
        .subcommand(add_id_or_name_group(
            Command::new("item").about("Get a Spotify item's data").arg(
                Arg::new("item_type")
                    .value_parser(EnumValueParser::<ItemType>::new())
                    .required(true),
            ),
        ))
}

fn init_playback_start_subcommand() -> Command {
    Command::new("start")
        .about("Start a new playback")
        .subcommand_required(true)
        .subcommand(add_id_or_name_group(
            Command::new("context")
                .about("Start a context playback")
                .arg(
                    Arg::new("context_type")
                        .value_parser(EnumValueParser::<ContextType>::new())
                        .required(true),
                )
                .arg(
                    Arg::new("shuffle")
                        .short('s')
                        .long("shuffle")
                        .action(ArgAction::SetTrue)
                        .help("Shuffle tracks within the launched playback"),
                ),
        ))
        .subcommand(add_id_or_name_group(
            Command::new("track").about("Start playback for a track"),
        ))
        .subcommand(
            Command::new("liked")
                .about("Start a liked tracks playback")
                .arg(
                    Arg::new("limit")
                        .short('l')
                        .long("limit")
                        .default_value("200")
                        .value_parser(value_parser!(usize))
                        .help("The limit for number of tracks to play"),
                )
                .arg(
                    Arg::new("random")
                        .short('r')
                        .long("random")
                        .action(ArgAction::SetTrue)
                        .help(
                            "Randomly pick the tracks instead of picking tracks from the beginning",
                        ),
                ),
        )
        .subcommand(add_id_or_name_group(
            Command::new("radio")
                .about("Start a radio playback")
                .arg(Arg::new("item_type").value_parser(EnumValueParser::<ItemType>::new())),
        ))
}

fn add_id_or_name_group(cmd: Command) -> Command {
    add_id_or_name_group_optional(cmd, true)
}

fn add_id_or_name_group_optional(cmd: Command, required: bool) -> Command {
    cmd.arg(Arg::new("id").long("id").short('i'))
        .arg(Arg::new("name").long("name").short('n'))
        .group(
            ArgGroup::new("id_or_name")
                .args(["id", "name"])
                .required(required),
        )
}

pub fn init_playback_subcommand() -> Command {
    Command::new("playback")
        .about("Interact with the playback")
        .subcommand_required(true)
        .subcommand(init_playback_start_subcommand())
        .subcommand(Command::new("play-pause").about("Toggle between play and pause"))
        .subcommand(Command::new("play").about("Resume the current playback if stopped"))
        .subcommand(Command::new("pause").about("Pause the current playback if playing"))
        .subcommand(Command::new("next").about("Skip to the next track"))
        .subcommand(Command::new("previous").about("Skip to the previous track"))
        .subcommand(Command::new("shuffle").about("Toggle the shuffle mode"))
        .subcommand(Command::new("repeat").about("Cycle the repeat mode"))
        .subcommand(
            Command::new("volume")
                .about("Set the volume percentage")
                .arg(
                    Arg::new("percent")
                        .value_parser(value_parser!(i8).range(-100..=100))
                        .required(true),
                )
                .arg(
                    Arg::new("offset")
                        .long("offset")
                        .action(clap::ArgAction::SetTrue)
                        .help("Increase the volume percent by an offset"),
                ),
        )
        .subcommand(
            Command::new("seek")
                .about("Seek by an offset milliseconds")
                .arg(
                    Arg::new("position_offset_ms")
                        .value_parser(value_parser!(i64))
                        .required(true),
                ),
        )
}

pub fn init_search_command() -> Command {
    Command::new("search")
        .about("Search spotify")
        .arg(Arg::new("query").help("Search query").required(true))
}

pub fn init_like_command() -> Command {
    Command::new("like")
        .about("Like currently playing track")
        .arg(
            Arg::new("unlike")
                .long("unlike")
                .short('u')
                .action(ArgAction::SetTrue)
                .help("Unlike the currently playing track"),
        )
}

pub fn init_authenticate_command() -> Command {
    Command::new("authenticate").about("Authenticate the application")
}

pub fn init_generate_command() -> Command {
    Command::new("generate")
        .about("Generate shell completion for the application CLI")
        .arg(
            Arg::new("shell")
                .action(ArgAction::Set)
                .value_parser(value_parser!(Shell))
                .required(true),
        )
}

pub fn init_playlist_subcommand() -> Command {
    Command::new("playlist")
        .about("Playlist editing")
        .subcommand_required(true)
        .subcommand(Command::new("new").about("Create a new playlist")
            .arg(Arg::new("name")
                .value_parser(clap::builder::NonEmptyStringValueParser::new()))
            .arg(Arg::new("description")
                .value_parser(clap::builder::NonEmptyStringValueParser::new())
                .required(false))
            .arg(Arg::new("public")
                .short('p')
                .long("public")
                .action(clap::ArgAction::SetTrue)
                .help("Sets the playlist to public"))
            .arg(Arg::new("collab")
                .short('c')
                .long("collab")
                .action(clap::ArgAction::SetTrue)
                .help("Sets the playlist to collaborative"))
            )
        .subcommand(Command::new("delete").about("Delete a playlist")
            .arg(Arg::new("id")
                .value_parser(clap::builder::NonEmptyStringValueParser::new())))
        .subcommand(Command::new("import").about("Imports all songs from a playlist into another playlist.")
            .arg(Arg::new("from")
                .value_parser(clap::builder::NonEmptyStringValueParser::new()))
            .arg(Arg::new("to")
                .value_parser(clap::builder::NonEmptyStringValueParser::new()))
            .arg(Arg::new("delete")
                .short('d')
                .long("delete")
                .action(clap::ArgAction::SetTrue)
                .help("Deletes any previously imported tracks that are no longer in the imported playlist since last import."))
            .after_help("Import data for each playlist is stored inside the application's cache folder. If imported again, the command only imports new tracks since last import."))
        .subcommand(Command::new("list").about("Lists all user playlists."))
        .subcommand(Command::new("fork").about("Create
```

### Core Architecture Module: `spotify_player/src/cli/handlers.rs`
```
use crate::{auth::AuthConfig, client};

use super::{
    config, init_cli, start_socket, AlbumId, Command, ContextType, EditAction, GetRequest,
    IdOrName, ItemType, Key, PlaylistCommand, PlaylistId, Request, Response, TrackId,
    MAX_REQUEST_SIZE,
};
use anyhow::{Context, Result};
use clap::{ArgMatches, Id};
use clap_complete::{generate, Shell};
use std::net::UdpSocket;

fn receive_response(socket: &UdpSocket) -> Result<Response> {
    // read response from the server's socket, which can be split into
    // smaller chunks of data
    let mut data = Vec::new();
    let mut buf = [0; 4096];
    loop {
        let (n_bytes, _) = socket.recv_from(&mut buf)?;
        if n_bytes == 0 {
            // end of chunk
            break;
        }
        data.extend_from_slice(&buf[..n_bytes]);
    }

    Ok(serde_json::from_slice(&data)?)
}

fn get_id_or_name(args: &ArgMatches) -> IdOrName {
    try_get_id_or_name(args).expect("id_or_name group is required")
}

fn try_get_id_or_name(args: &ArgMatches) -> Option<IdOrName> {
    match args.get_one::<Id>("id_or_name")?.as_str() {
        "name" => Some(IdOrName::Name(
            args.get_one::<String>("name")
                .expect("name should be specified")
                .to_owned(),
        )),
        "id" => Some(IdOrName::Id(
            args.get_one::<String>("id")
                .expect("id should be specified")
                .to_owned(),
        )),
        id => panic!("unknown id: {id}"),
    }
}

fn handle_get_subcommand(args: &ArgMatches) -> Request {
    let (cmd, args) = args.subcommand().expect("playback subcommand is required");

    let request = match cmd {
        "key" => {
            let key = args
                .get_one::<Key>("key")
                .expect("key is required")
                .to_owned();
            Request::Get(GetRequest::Key(key))
        }
        "item" => {
            let item_type = args
                .get_one::<ItemType>("item_type")
                .expect("context_type is required")
                .to_owned();
            let id_or_name = get_id_or_name(args);
            Request::Get(GetRequest::Item(item_type, id_or_name))
        }
        _ => unreachable!(),
    };

    request
}

fn handle_playback_subcommand(args: &ArgMatches) -> Result<Request> {
    let (cmd, args) = args.subcommand().expect("playback subcommand is required");
    let command = match cmd {
        "start" => match args.subcommand() {
            Some(("track", args)) => Command::StartTrack(get_id_or_name(args)),
            Some(("context", args)) => {
                let context_type = args
                    .get_one::<ContextType>("context_type")
                    .expect("context_type is required")
                    .to_owned();
                let shuffle = args.get_flag("shuffle");

                let id_or_name = get_id_or_name(args);
                Command::StartContext {
                    context_type,
                    id_or_name,
                    shuffle,
                }
            }
            Some(("liked", args)) => {
                let limit = *args
                    .get_one::<usize>("limit")
                    .expect("limit should have a default value");
                let random = args.get_flag("random");
                Command::StartLikedTracks { limit, random }
            }
            Some(("radio", args)) => {
                let item_type = args
                    .get_one::<ItemType>("item_type")
                    .expect("item_type is required")
                    .to_owned();
                let id_or_name = get_id_or_name(args);
                Command::StartRadio(item_type, id_or_name)
            }
            _ => {
                anyhow::bail!("invalid command!");
            }
        },
        "play-pause" => Command::PlayPause,
        "play" => Command::Play,
        "pause" => Command::Pause,
        "next" => Command::Next,
        "previous" => Command::Previous,
        "shuffle" => Command::Shuffle,
        "repeat" => Command::Repeat,
        "volume" => {
            let percent = args
                .get_one::<i8>("percent")
                .expect("percent arg is required");
            let offset = args.get_flag("offset");
            Command::Volume {
                percent: *percent,
                is_offset: offset,
            }
        }
        "seek" => {
            let position_offset_ms = args
                .get_one::<i64>("position_offset_ms")
                .expect("position_offset_ms is required");
            Command::Seek(*position_offset_ms)
        }
        _ => unreachable!(),
    };

    Ok(Request::Playback(command))
}

/// Tries to connect to a running client, if exists, by sending a connection request
/// to the client via a UDP socket.
/// If no running client found, create a new client running in a separate thread to
/// handle the socket request.
fn try_connect_to_client(socket: &UdpSocket, configs: &config::Configs) -> Result<()> {
    let port = configs.app_config.client_port;
    socket.connect(("127.0.0.1", port))?;

    // send an empty buffer as a connection request to the client
    socket.send(&[])?;
    if let Err(err) = socket.recv(&mut [0; 1]) {
        if let std::io::ErrorKind::ConnectionRefused = err.kind() {
            // no running `spotify_player` instance found,
            // initialize a new client to handle the current CLI command

            let rt = tokio::runtime::Runtime::new()?;

            // create a Spotify API client
            let client = rt
                .block_on(client::AppClient::new())
                .context("construct app client")?;
            rt.block_on(client.new_session(None, false))
                .context("new session")?;

            // create a client socket for handling CLI commands
            // NOTE: the socket must be bound *before* spawning the thread to avoid a
            // race condition where the caller sends a request before the socket is ready.
            let client_socket = rt.block_on(tokio::net::UdpSocket::bind(("127.0.0.1", port)))?;

            // spawn a thread to handle the CLI request
            std::thread::spawn(move || {
                rt.block_on(start_socket(&client, None, Some(client_socket)));
            });
        } else {
            return Err(err.into());
        }
    }

    Ok(())
}

pub fn handle_cli_subcommand(cmd: &str, args: &ArgMatches) -> Result<()> {
    let configs = config::get_config();

    // handle commands that don't require a client separately
    match cmd {
        "authenticate" => {
            // Force re-authentication of every Web API identity, followed by librespot.
            let mut api_client = client::new_api_client()?;
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(crate::auth::prompt_for_user_token(&mut api_client, true))
                .context("authenticate Spotify Web API client")?;

            let auth_config = AuthConfig::new(configs)?;
            crate::auth::get_creds(&auth_config, true, false)?;
            std::process::exit(0);
        }
        "generate" => {
            let gen = *args
                .get_one::<Shell>("shell")
                .expect("shell argument is required");
            let mut cmd = init_cli()?;
            let name = cmd.get_name().to_string();
            generate(gen, &mut cmd, name, &mut std::io::stdout());
            std::process::exit(0);
        }
        "features" => {
            print_features();
            std::process::exit(0);
        }
        _ => {}
    }

    let socket = UdpSocket::bind("127.0.0.1:0")?;
    try_connect_to_client(&socket, configs).context("try to connect to a client")?;

    // construct a socket request based on the CLI command and its arguments
    let request = match cmd {
        "get" => handle_get_subcommand(args),
        "playback" => handle_playback_subcommand(args)?,
        "playlist" => handle_playlist_subcommand(args)
```

### Core Architecture Module: `spotify_player/src/cli/mod.rs`
```
mod client;
mod commands;
mod handlers;

use crate::config;
use rspotify::model::{AlbumId, ArtistId, Id, PlaylistId, TrackId};
use serde::{Deserialize, Serialize};

const MAX_REQUEST_SIZE: usize = 4096;

pub use client::start_socket;
pub use handlers::handle_cli_subcommand;

#[derive(Debug, Serialize, Deserialize, clap::ValueEnum, Clone)]
pub enum Key {
    Playback,
    Devices,
    UserPlaylists,
    UserLikedTracks,
    UserSavedAlbums,
    UserFollowedArtists,
    UserTopTracks,
    Queue,
}

#[derive(Debug, Serialize, Deserialize, clap::ValueEnum, Clone)]
pub enum ContextType {
    Playlist,
    Album,
    Artist,
}

#[derive(Debug, Serialize, Deserialize, clap::ValueEnum, Clone)]
pub enum ItemType {
    Playlist,
    Album,
    Artist,
    Track,
}

/// Spotify item's ID
enum ItemId {
    Playlist(PlaylistId<'static>),
    Artist(ArtistId<'static>),
    Album(AlbumId<'static>),
    Track(TrackId<'static>),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum GetRequest {
    Key(Key),
    Item(ItemType, IdOrName),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum IdOrName {
    Id(String),
    Name(String),
}

#[derive(Debug, Serialize, Deserialize, clap::ValueEnum, Clone, Copy)]
pub enum EditAction {
    Add,
    Delete,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PlaylistCommand {
    New {
        name: String,
        public: bool,
        collab: bool,
        description: String,
    },
    Delete {
        id: PlaylistId<'static>,
    },
    List,
    Import {
        from: PlaylistId<'static>,
        to: PlaylistId<'static>,
        delete: bool,
    },
    Fork {
        id: PlaylistId<'static>,
    },
    Sync {
        id: Option<PlaylistId<'static>>,
        delete: bool,
    },
    Edit {
        action: EditAction,
        playlist_id: PlaylistId<'static>,
        track_id: Option<TrackId<'static>>,
        album_id: Option<AlbumId<'static>>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Command {
    StartContext {
        context_type: ContextType,
        id_or_name: IdOrName,
        shuffle: bool,
    },
    StartTrack(IdOrName),
    StartLikedTracks {
        limit: usize,
        random: bool,
    },
    StartRadio(ItemType, IdOrName),
    PlayPause,
    Play,
    Pause,
    Next,
    Previous,
    Shuffle,
    Repeat,
    Volume {
        percent: i8,
        is_offset: bool,
    },
    Seek(i64),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    Get(GetRequest),
    Playback(Command),
    Connect(IdOrName),
    Like { unlike: bool },
    Playlist(PlaylistCommand),
    Search { query: String },
    Lyrics { id_or_name: Option<IdOrName> },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Ok(Vec<u8>),
    Err(Vec<u8>),
}

impl From<ContextType> for ItemType {
    fn from(value: ContextType) -> Self {
        match value {
            ContextType::Playlist => Self::Playlist,
            ContextType::Album => Self::Album,
            ContextType::Artist => Self::Artist,
        }
    }
}

impl ItemId {
    pub fn uri(&self) -> String {
        match self {
            ItemId::Playlist(id) => id.uri(),
            ItemId::Artist(id) => id.uri(),
            ItemId::Album(id) => id.uri(),
            ItemId::Track(id) => id.uri(),
        }
    }
}

pub fn init_cli() -> anyhow::Result<clap::Command> {
    let default_cache_folder = config::get_cache_folder_path()?;
    let default_config_folder = config::get_config_folder_path()?;

    let cmd = clap::Command::new(env!("CARGO_PKG_NAME"))
        .version(env!("CARGO_PKG_VERSION"))
        .about(env!("CARGO_PKG_DESCRIPTION"))
        .author(env!("CARGO_PKG_AUTHORS"))
        .subcommand(commands::init_get_subcommand())
        .subcommand(commands::init_playback_subcommand())
        .subcommand(commands::init_connect_subcommand())
        .subcommand(commands::init_like_command())
        .subcommand(commands::init_authenticate_command())
        .subcommand(commands::init_playlist_subcommand())
        .subcommand(commands::init_generate_command())
        .subcommand(commands::init_search_command())
        .subcommand(commands::init_print_features_command())
        .subcommand(commands::init_lyrics_command())
        .arg(
            clap::Arg::new("theme")
                .short('t')
                .long("theme")
                .value_name("THEME")
                .help("Application theme"),
        )
        .arg(
            clap::Arg::new("config-folder")
                .short('c')
                .long("config-folder")
                .value_name("FOLDER")
                .default_value(default_config_folder.into_os_string())
                .help("Path to the application's config folder"),
        )
        .arg(
            clap::Arg::new("cache-folder")
                .short('C')
                .long("cache-folder")
                .value_name("FOLDER")
                .default_value(default_cache_folder.into_os_string())
                .help("Path to the application's cache folder"),
        )
        .arg(
            clap::Arg::new("config-override")
                .short('o')
                .long("config-override")
                .value_name("KEY=VALUE")
                .action(clap::ArgAction::Append)
                .help("Override a config option (e.g. -o device.volume=80 -o theme=dracula)"),
        );

    #[cfg(feature = "daemon")]
    let cmd = cmd.arg(
        clap::Arg::new("daemon")
            .short('d')
            .long("daemon")
            .action(clap::ArgAction::SetTrue)
            .help("Running the application as a daemon"),
    );

    Ok(cmd)
}

```

### Core Architecture Module: `spotify_player/src/client/handlers.rs`
```
use std::time::{Duration, Instant};

use anyhow::Context;
use rspotify::model::Id;
use tracing::Instrument;

use crate::{
    config,
    state::{ContextId, ContextPageType, ContextPageUIState, PageState, PlayableId, SharedState},
};

use crate::utils::map_join;

use super::ClientRequest;

struct PlayerEventHandlerState {
    ended_playable_uri: Option<String>,
    last_get_context: Instant,
    last_playback_refresh: Instant,
    last_queue_refresh: Option<(String, Instant)>,
}

/// starts the client's request handler
pub async fn start_client_handler(
    state: &SharedState,
    client: &super::AppClient,
    client_sub: &flume::Receiver<ClientRequest>,
) {
    while let Ok(request) = client_sub.recv_async().await {
        let state = state.clone();
        let client = client.clone();
        let span = tracing::info_span!("client_request", request = ?request);

        tokio::task::spawn(
            async move {
                if let Err(err) = client.handle_request(&state, request).await {
                    tracing::error!("Failed to handle client request: {err:#}");
                }
            }
            .instrument(span),
        );
    }
}

/// Interval between background session-validity checks.
const SESSION_CHECK_INTERVAL: Duration = Duration::from_secs(1);
const CONTEXT_REFRESH_THROTTLE: Duration = Duration::from_secs(5);
const QUEUE_REFRESH_THROTTLE: Duration = Duration::from_secs(5);

pub async fn start_session_watcher(state: SharedState, client: super::AppClient) {
    let mut interval = tokio::time::interval(SESSION_CHECK_INTERVAL);
    // If a check ever runs long (e.g. a slow reconnect), skip missed ticks
    // rather than firing them back-to-back.
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        if let Err(err) = client.check_valid_session(&state).await {
            tracing::error!("Failed to check/reconnect the client's session: {err:#}");
        }
    }
}

fn handle_playback_change_event(
    state: &SharedState,
    client_pub: &flume::Sender<ClientRequest>,
    handler_state: &mut PlayerEventHandlerState,
) -> anyhow::Result<()> {
    let player = state.player.read();
    let (playback, id, duration) = match (
        player.buffered_playback.as_ref(),
        player.currently_playing(),
    ) {
        (Some(playback), Some(rspotify::model::PlayableItem::Track(track))) => (
            playback,
            PlayableId::Track(track.id.clone().expect("null track_id")),
            track.duration,
        ),
        (Some(playback), Some(rspotify::model::PlayableItem::Episode(episode))) => (
            playback,
            PlayableId::Episode(episode.id.clone()),
            episode.duration,
        ),
        _ => return Ok(()),
    };
    let playable_uri = id.uri();

    let playback_ended = player
        .playback_progress()
        .is_some_and(|progress| progress >= duration && playback.is_playing);
    if playback_ended && handler_state.ended_playable_uri.as_deref() != Some(&playable_uri) {
        client_pub.send(ClientRequest::GetCurrentPlayback)?;
        handler_state.ended_playable_uri = Some(playable_uri.clone());
    } else if !playback_ended {
        handler_state.ended_playable_uri = None;
    }

    let queue_needs_refresh = player.queue.as_ref().is_none_or(|queue| {
        queue
            .currently_playing
            .as_ref()
            .is_none_or(|queue_item| queue_item.id().expect("null track_id") != id)
    });
    if queue_needs_refresh {
        let should_refresh =
            handler_state
                .last_queue_refresh
                .as_ref()
                .is_none_or(|(last_uri, timer)| {
                    last_uri != &playable_uri || timer.elapsed() >= QUEUE_REFRESH_THROTTLE
                });
        if should_refresh {
            handler_state.last_queue_refresh = Some((playable_uri, Instant::now()));
            client_pub.send(ClientRequest::GetCurrentUserQueue)?;
        }
    } else if !queue_needs_refresh {
        handler_state.last_queue_refresh = None;
    }

    Ok(())
}

fn handle_page_change_event(
    state: &SharedState,
    client_pub: &flume::Sender<ClientRequest>,
    handler_state: &mut PlayerEventHandlerState,
) -> anyhow::Result<()> {
    match state.ui.lock().current_page_mut() {
        PageState::Context {
            id,
            context_page_type,
            state: page_state,
        } => {
            let expected_id = match context_page_type {
                ContextPageType::Browsing(context_id) => Some(context_id.clone()),
                ContextPageType::CurrentPlaying => state.player.read().playing_context_id(),
            };

            let new_id = if *id == expected_id {
                false
            } else {
                // update the context state and request new data when moving to a new context page
                tracing::info!("Current context ID ({:?}) is different from the expected ID ({:?}), update the context state", id, expected_id);

                *id = expected_id;

                // update the UI page state based on the context's type
                match id {
                    Some(id) => {
                        *page_state = Some(match id {
                            ContextId::Album(_) => ContextPageUIState::new_album(),
                            ContextId::Artist(_) => ContextPageUIState::new_artist(),
                            ContextId::Playlist(_) => ContextPageUIState::new_playlist(),
                            ContextId::Tracks(_) => ContextPageUIState::new_tracks(),
                            ContextId::Show(_) => ContextPageUIState::new_show(),
                        });
                    }
                    None => {
                        *page_state = None;
                    }
                }
                true
            };

            // request new context's data if not found in memory
            // To avoid making too many requests, only request if context id is changed
            // or it's been a while since the last request.
            if let Some(id) = id {
                if !matches!(id, ContextId::Tracks(_))
                    && !state.data.read().caches.context.contains_key(&id.uri())
                    && (new_id
                        || handler_state.last_get_context.elapsed() > CONTEXT_REFRESH_THROTTLE)
                {
                    client_pub.send(ClientRequest::GetContext(id.clone()))?;
                    handler_state.last_get_context = Instant::now();
                }
            }
        }

        PageState::Lyrics {
            track_uri,
            track,
            artists,
        } => {
            if let Some(rspotify::model::PlayableItem::Track(current_track)) =
                state.player.read().currently_playing()
            {
                if current_track.name != *track {
                    if let Some(id) = &current_track.id {
                        tracing::info!("Currently playing track \"{}\" is different from the track \"{track}\" shown up in the lyrics page. Fetching new track's lyrics...", current_track.name);
                        track.clone_from(&current_track.name);
                        *artists = map_join(&current_track.artists, |a| &a.name, ", ");
                        *track_uri = id.uri();
                        client_pub.send(ClientRequest::GetLyrics {
                            track_id: id.clone_static(),
                        })?;
                    }
                }
            }
        }
        _ => {}
    }

    Ok(())
}

fn handle_player_event(
    state: &SharedState,
    client_pub: &flume::Sender<ClientRequest>,
    handler_state: &mut PlayerEventHandlerState,
) -> anyhow::Result<()> {
    handle_page_change_event(state, client_pub, handler_state)
        .context("handle page change event")?;
    handle_playback_change_event(state, client_pub, handler_state)
        .context(
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

### Incident Patch 4: `755a3c84` (2026-09-07)
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

### Incident Patch 5: `8a1985c4` (2026-09-07)
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

### Incident Patch 6: `ef525dad` (2026-07-20)
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

### Incident Patch 7: `04684303` (2026-06-30)
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

---

### Incident Patch 8: `1a674bef` (2026-06-29)
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
+        || std::e
```

---

### Incident Patch 9: `ace3ccc9` (2026-06-28)
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

### Incident Patch 10: `37ec54b9` (2026-05-14)
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
