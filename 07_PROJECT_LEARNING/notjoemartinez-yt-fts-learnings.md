# Forensic Learning Record (Deep Inspection): NotJoeMartinez/yt-fts

> **Canonical Artifact**: `07_PROJECT_LEARNING/notjoemartinez-yt-fts-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NotJoeMartinez/yt-fts](https://github.com/NotJoeMartinez/yt-fts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:20:55.969Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NotJoeMartinez/yt-fts`
- **Description**: YouTube Full Text Search - Search all of YouTube from the command line
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1811 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/yt_fts/db_utils.py`
```
import sqlite3
import sys
import re

from sqlite_utils import Database
from rich.console import Console
from rich.table import Table

from .utils import show_message, get_date
from .config import get_db_path, get_chroma_client


def make_db(db_path: str) -> None:
    db = Database(db_path)

    db["Channels"].create({
        "channel_id": str,
        "channel_name": str,
        "channel_url": str,
    },
        pk="channel_id",
        not_null={"channel_name", "channel_url"},
        if_not_exists=True
    )

    db["Videos"].create({
        "video_id": str,
        "video_title": str,
        "video_url": str,
        "channel_id": str,
        "video_date": str,
    },
        pk="video_id",
        not_null={"video_title", "video_url"},
        if_not_exists=True,
        foreign_keys=[
            ("channel_id", "Channels")
        ]
    )

    db["Subtitles"].create(
        {
            "subtitle_id": int,
            "video_id": str,
            "start_time": str,
            "stop_time": str,
            "text": str
        },
        pk="subtitle_id",
        not_null={"start_time", "text"},
        if_not_exists=True,
        foreign_keys=[
            ("video_id", "Videos")
        ]
    ).enable_fts(
        ["text"],
        create_triggers=True,
        replace=True
    )

    db["SemanticSearchEnabled"].create(
        {
            "channel_id": str,
        },
        if_not_exists=True,
        foreign_keys=[
            ("channel_id", "Channels")
        ]

    )


def add_channel_info(channel_id: str, channel_name: str, channel_url: str) -> None:
    db = Database(get_db_path())

    db["Channels"].insert({
        "channel_id": channel_id,
        "channel_name": channel_name,
        "channel_url": channel_url
    })


def add_video(channel_id: str, video_id: str, video_title: str, video_url: str, video_date: str) -> None:
    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()
    existing_video = cur.execute("SELECT * FROM Videos WHERE video_id = ?",
                                 (video_id,)).fetchone()

    if existing_video is None:
        cur.execute("""
                    INSERT INTO Videos (video_id, video_title, video_url, video_date, channel_id)
                    VALUES (?, ?, ?, ?, ?)
                    """,(video_id, video_title, video_url, video_date, channel_id))
        conn.commit()

    else:
        print(f"{video_id} Video already exists in the database.")
    conn.close()


def add_subtitle(video_id: str, start_time: str, text: str) -> None:
    db = Database(get_db_path())

    db["Subtitles"].insert({
        "video_id": video_id,
        "timestamp": start_time,
        "text": text
    })


def get_channels() -> list[tuple[int, str, str, str]]:
    db = Database(get_db_path())

    return db.execute("SELECT ROWID, channel_id, channel_name, channel_url FROM Channels").fetchall()


def escape_fts5_query(query: str) -> str:
    special_chars = ['"', '*', '(', ')', '-', '+']
    for char in special_chars:
        query = query.replace(char, f'"{char}"')
    return query


def escape_fts5_term(term: str) -> str:
    special_chars = ['"', '*', '(', ')', '+', '-']
    for char in special_chars:
        term = term.replace(char, f'"{char}"')
    return f'"{term}"'


def parse_query(query: str) -> str:
    terms = re.findall(r'"[^"]*"|\S+', query)
    parsed_query = []
    for term in terms:
        if term in ('AND', 'OR'):
            parsed_query.append(term.upper())
        else:
            parsed_query.append(escape_fts5_term(term.strip('"')))
    return ' '.join(parsed_query)


def search_channel(channel_id: str, text: str, limit: int | None = None) -> list[dict[str, int | str]]:
    conn = sqlite3.connect(get_db_path())
    curr = conn.cursor()
    
    fts5_query = parse_query(text)

    query = """
        SELECT 
            s.rowid,
            s.subtitle_id,
            s.video_id,
            s.start_time,
            s.stop_time,
            s.text
        FROM 
            Subtitles_fts fts
        JOIN 
            Subtitles s ON fts.rowid = s.rowid
        JOIN 
            Videos v ON s.video_id = v.video_id
        WHERE 
            fts.text MATCH ?
            AND v.channel_id = ? 
        ORDER BY 
            rank
    """
    
    if limit is not None:
        query += " LIMIT ?"
        curr.execute(query, (fts5_query, channel_id, limit))
    else:
        curr.execute(query, (fts5_query, channel_id))

    res = curr.fetchall()
    formatted_res = []
    for row in res:
        formatted_res.append({
            "rowid": row[0],
            "subtitle_id": row[1],
            "video_id": row[2],
            "start_time": row[3],
            "stop_time": row[4],
            "text": row[5]
        })
    conn.close()

    return formatted_res


def search_video(video_id: str, text: str, limit: int | None = None) -> list[dict[str, int | str]]:
    try:
        conn = sqlite3.connect(get_db_path())
        curr = conn.cursor()

        fts5_query = parse_query(text)
        sql = """
        SELECT 
            s.rowid,
            s.subtitle_id,
            s.video_id,
            s.start_time,
            s.stop_time,
            s.text 
        FROM
            Subtitles_fts fts
        JOIN
            Subtitles s ON fts.rowid = s.rowid 
        WHERE
            s.video_id = ?
        AND
            fts.text MATCH ?
        """

        if limit is not None:
            sql += " LIMIT ?"
            curr.execute(sql, (video_id, fts5_query, limit))
        else:
            curr.execute(sql, (video_id, fts5_query))
        
        res = curr.fetchall()

        formatted_res = []

        for row in res:
            formatted_res.append({
                "rowid": row[0],
                "subtitle_id": row[1],
                "video_id": row[2],
                "start_time": row[3],
                "stop_time": row[4],
                "text": row[5]
            })
        
        conn.close()
        return formatted_res 

    except Exception as e:
        print(e)
        sys.exit(1)
    finally:
        conn.close()


def search_all(text: str, limit: int | None = None) -> list[dict[str, int | str]]:
    try:
        conn = sqlite3.connect(get_db_path())
        curr = conn.cursor()
        fts5_query = parse_query(text)

        sql = """
            SELECT 
                s.rowid,
                s.subtitle_id,
                s.video_id,
                s.start_time,
                s.stop_time,
                s.text
            FROM
                Subtitles_fts fts
            JOIN
                Subtitles s ON fts.rowid = s.rowid
            WHERE
                fts.text MATCH ?
            ORDER BY
                rank
        """

        if limit is not None:
            sql += " LIMIT ?"
            curr.execute(sql, (fts5_query, limit))
        else:
            curr.execute(sql, (fts5_query,))


        res = curr.fetchall()

        formatted_res = []

        for row in res:
            formatted_res.append({
                "rowid": row[0],
                "subtitle_id": row[1],
                "video_id": row[2],
                "start_time": row[3],
                "stop_time": row[4],
                "text": row[5]
            })

        conn.close()
        return formatted_res

    except Exception as e:
        print(e)
        sys.exit(1)
    
    finally:
        conn.close()


def get_title_from_db(video_id: str) -> str:
    db = Database(get_db_path())

    return db.execute(f"SELECT video_title FROM Videos WHERE video_id = ?", [video_id]).fetchone()[0]


def get_metadata_from_db(video_id: str) -> dict[str, any]:
    db = Database(get_db_path())

    metadata = db.execute_returning_dicts(f"SELECT * FROM Videos WHERE video_id = ?", [video_id])[0]
    metadata["video_date"] = get_date(metadata["video_date"])
    return metadata


def get_channel_name_from_id(channel_id: str) -> str:
    db = Database(get_db_path())

    return db.execute(f"SELECT channel_name FROM Channels WHERE channel_id = ?", [channel_id]).fetchone()[0]


def get_channel_name_from_video_id(video_id: str) -> str:
    db = Database(get_db_path())

    return db.execute(
        f"SELECT channel_name FROM Channels WHERE channel_id = (SELECT channel_id FROM Videos WHERE video_id = ?)",
        [video_id]).fetchone()[0]


# delete all videos, subtitles, and embeddings associated with channel
def delete_channel(channel_id: str) -> None:
    from .utils import check_ss_enabled

    if check_ss_enabled(channel_id):
        delete_channel_from_chroma(channel_id)

    conn = sqlite3.connect(get_db_path())
    cur = conn.cursor()

    cur.execute("DELETE FROM Channels WHERE channel_id = ?", (channel_id,))

    # make sure to delete all subtitles and embeddings before videos  
    cur.execute("DELETE FROM Subtitles WHERE video_id IN (SELECT video_id FROM Videos WHERE channel_id = ?)",
                (channel_id,))

    cur.execute("DELETE FROM Videos WHERE channel_id = ?", (channel_id,))

    cur.execute("DELETE FROM SemanticSearchEnabled WHERE channel_id = ?", (channel_id,))

    conn.commit()
    conn.close()


def delete_channel_from_chroma(channel_id: str) -> None:
    chroma_client = get_chroma_client()
    collection = chroma_client.get_collection(name="subEmbeddings")

    print(f"deleting channel {channel_id} from chroma")
    collection.delete(
        where={"channel_id": channel_id}
    )


def get_channel_id_from_rowid(rowid: str | int) -> str | None:
    db = Database(get_db_path())

    res = db.execute(f"SELECT channel_id FROM Channels WHERE ROWID = ?", [rowid]).fetchone()

    if res is None:
        return None
    else:
        return res[0]


def get_channel_id_from_name(channel_name: str) -> str | None:
    db = Database(get_db_path())

    res = db.execute(f"SELECT channel_id FROM Channels WHERE channel_name = ?", [channel_name]).fetchall()

    console = Console()
    if len(res) > 1:
        table = Table(header_
```

### Core Architecture Module: `src/yt_fts/utils.py`
```
"""
This is where I'm putting all the functions that don't belong anywhere else
"""
import datetime
import re
import sqlite3
from typing import TypedDict
import webvtt


def show_message(code: str) -> None:
    error_dict = {
        "search_too_long": "Error: Search text must be less than 40 characters",
        "no_matches_found": "No matches found.\n- Try shortening the search text or use wildcards to match partial "
                            "words.",
        "channel_not_found": "channel not found.\n- Try using channel id",
        "multiple_channels_found": "Multiple channels found.\n- Try using id",
        "channel_url_not_correct": "The given channel URL is not correct, expected pattern : "
                                   "https://www.youtube.com/@TimDillonShow/videos",
    }

    print(error_dict[code])


def time_to_secs(time_str: str) -> int:
    """
    converts timestamp to seconds youtube urls. Subtracts 3 seconds to give a buffer. 
    """
    time_rex = re.search(r"^(\d\d):(\d\d):(\d\d)", time_str)
    hours = int(time_rex.group(1)) * 3600
    mins = int(time_rex.group(2)) * 60
    secs = int(time_rex.group(3))
    total_secs = hours + mins + secs

    return total_secs - 3


def parse_vtt(vtt_path: str) -> list[dict[str, str]]:

    result = word_level_vtt_parser(vtt_path)

    if len(result) == 0:
        result = normal_vtt_parser(vtt_path)
    
    if len(result) == 0:
        print(f"Error: Failed to parse subtitles for: {vtt_path}")

    return result


def normal_vtt_parser(vtt_path: str) -> list[dict[str, str]]:

    result = []

    for caption in webvtt.read(vtt_path):
        start_time = caption.start
        stop_time = caption.end
        text = caption.text
        result.append({
            'start_time': start_time,
            'stop_time': stop_time,
            'text': text,
        })

    return result


def word_level_vtt_parser(vtt_path: str) -> list[dict[str, str]]:
    """
    extracts start time and text from vtt file and return a list of dicts
    """
    result = []

    time_pattern = "^(.*) align:start position:0%"

    with open(vtt_path, "r") as f:
        lines = f.readlines()

    for count, line in enumerate(lines):
        time_match = re.match(time_pattern, line)

        if time_match:
            start = re.search("^(.*) -->", time_match.group(1))
            start_time = start.group(1)

            stop = re.search("--> (.*)", time_match.group(1))
            stop_time = stop.group(1)

            sub_titles = lines[count + 1]

            # prevent duplicate entries
            if result and result[-1]['text'] == sub_titles.strip('\n'):
                # replace the previous entry with the new one
                result[-1] = {
                    'start_time': start_time,
                    'stop_time': stop_time,
                    'text': sub_titles.strip('\n'),
                }
            else:
                result.append({
                    'start_time': start_time,
                    'stop_time': stop_time,
                    'text': sub_titles.strip('\n'),
                })

    return result


class Model(TypedDict):
    name: str
    api_key: str
    base_url: str
    embedding_model: str
    chat_model: str

def get_model_config(api_key: str | None = None) -> Model:
    import os

    models: list[Model] = [
        {"name": "OPENAI", "embedding_model": "text-embedding-ada-002", "chat_model": "gpt-4o", "api_key": "", "base_url": "https://api.openai.com/v1"},
        {"name": "GEMINI", "embedding_model": "text-embedding-004", "chat_model": "gemini-2.5-flash", "api_key": "", "base_url": "https://generativelanguage.googleapis.com/v1beta"},
    ]

    if api_key is not None:
        # Gemini API keys start with "AIza"
        # OpenAI API keys start with "sk-"
        if api_key.startswith("sk-"):
            models[0]['api_key'] = api_key
            return models[0]
        elif api_key.startswith("AIza"):
            models[1]['api_key'] = api_key
            return models[1]
    else:
      for model in models:
          api_key = os.environ.get(f"{model['name']}_API_KEY")
          if api_key is not None:
              model['api_key'] = api_key
              return model
    
    raise ValueError("No model configuration found. Please set the environment variable for the model API key.")

def get_time_delta(timestamp1: str, timestamp2: str) -> str:
    from datetime import datetime
    format_string = "%H:%M:%S.%f"
    dt1 = datetime.strptime(timestamp1, format_string)
    dt2 = datetime.strptime(timestamp2, format_string)
    diff = dt2 - dt1
    # convert to string "HH:MM:SS"
    diff = str(diff).split(".")[0]

    return diff


def get_date(date_string: str) -> datetime.date:
    # Python 3.11 would support datimetime.date.fromisoformat('YYYYMMDD') directly
    if '-' in date_string:
        return datetime.date.fromisoformat(date_string)
    return datetime.datetime.strptime(date_string, '%Y%m%d').date()


# check if semantic search has been enabled for channel
def check_ss_enabled(channel_id: str | None = None) -> bool:
    from yt_fts.config import get_db_path

    con = sqlite3.connect(get_db_path())
    cur = con.cursor()

    if channel_id is None:
        cur.execute(""" 
            SELECT channel_id FROM SemanticSearchEnabled 
            """)
    else:
        cur.execute(""" 
            SELECT channel_id FROM SemanticSearchEnabled 
            WHERE channel_id = ?
            """, [channel_id])

    res = cur.fetchone()
    if res is None:
        return False
    else:
        return True

    # enable semantic search for channel


def enable_ss(channel_id: str) -> None:
    from yt_fts.config import get_db_path

    con = sqlite3.connect(get_db_path())
    cur = con.cursor()

    cur.execute(""" 
        INSERT INTO SemanticSearchEnabled (channel_id)
        VALUES (?)
        """, [channel_id])
    con.commit()
    con.close()


def bold_query_matches(text: str, query: str) -> str:
    """
    Bold the query in the text, keeping the case the same
    """
    query_words = query.lower().split()
    result_words = []

    for word in text.split():
        if word.lower() in query_words:
            result_words.append(f"[bold][bright_magenta]{word}[/bright_magenta][/bold]")
        else:
            result_words.append(word)

    return ' '.join(result_words)


def handle_reject_consent_cookie(channel_url: str, s) -> None:
    """
    Auto rejects the consent cookie if request is redirected to the consent page
    """
    r = s.get(channel_url)
    if "https://consent.youtube.com" in r.url:
        m = re.search(r"<input type=\"hidden\" name=\"bl\" value=\"([^\"]*)\"", r.text)
        if m:
            data = {
                "gl": "DE",
                "pc": "yt",
                "continue": channel_url,
                "x": "6",
                "bl": m.group(1),
                "hl": "de",
                "set_eom": "true"
            }
            s.post("https://consent.youtube.com/save", data=data)

```

### Core Architecture Module: `src/yt_fts/__init__.py`
```
__version__ = "0.1.62"
```

### Core Architecture Module: `src/yt_fts/config.py`
```
import sys 
import os

import chromadb
from chromadb.config import Settings
from chromadb.api import ClientAPI

def get_config_path() -> str | None:

    platform = sys.platform

    if platform == 'win32':
        config_path = os.path.join(os.getenv('APPDATA'), 'yt-fts')
        if not os.path.exists(config_path):
            return None
        else:
            return config_path 

    if platform == 'darwin' or platform == 'linux':
        config_path = os.path.join(os.getenv('HOME'), '.config', 'yt-fts')
        if not os.path.exists(config_path):
            return None
        else:
            return config_path
    
    return None


def make_config_dir() -> str | None:
    platform = sys.platform

    try:
        if platform == 'win32':
            config_path = os.path.join(os.getenv('APPDATA'), 'yt-fts')
            # check if config dir exists
            if not os.path.exists(config_path):
                os.mkdir(config_path)
                return config_path
        
        if platform == 'darwin' or platform == 'linux':
            config_path = os.path.join(os.getenv('HOME'), '.config', 'yt-fts')
            # check if config dir exists
            if not os.path.exists(config_path):
                os.mkdir(config_path)
                return config_path
    except Exception as e:
        print(e)
        return None


def get_db_path() -> str:
    from .db_utils import make_db
    # make sure config path exists
    # if config path is none, make config path
    # this also means the db doesn't exist
    # make db in new config path

    config_path = get_config_path()
    if config_path is None:

        config_path = make_config_dir()

        # if config path is still none, that means we can't make a config path
        # use current directory
        if config_path is None:
            print("unable to make config path, using current directory")
            return "subtitles.db"
        
    platform = sys.platform

    if platform == 'win32':
        db_path = f"{config_path}/subtitles.db"

        if not os.path.exists(db_path):
            print("db path not found, making new db")
            make_db(db_path)
            return db_path
        else:
            return db_path 

    if platform == 'darwin' or platform == 'linux':
        db_path = f"{config_path}/subtitles.db"
        if not os.path.exists(db_path):
            print("db path not found, making new db")
            make_db(db_path)
            return db_path 
        else:
            return db_path 
    
    print("db path not found, using current directory")
    return "subtitles.db" 


def get_or_make_chroma_path() -> str:

    config_path = get_config_path()

    if config_path is None:
        config_path = make_config_dir()

        if config_path is None:
            print("unable to make config path, using current directory")
            return os.path.join(os.getcwd(), "chroma")
    
    chroma_path = os.path.join(config_path, "chroma")

    if not os.path.exists(chroma_path):
        os.mkdir(chroma_path)
        return chroma_path
    else:
        return chroma_path


def get_chroma_client() -> ClientAPI:
    chroma_path = get_or_make_chroma_path()
    return chromadb.PersistentClient(path=chroma_path, 
                                     settings=Settings(anonymized_telemetry=False))

```

### Core Architecture Module: `src/yt_fts/download/download_handler.py`
```

import os
import sys
import json
import random
import sqlite3
import tempfile

import requests
import yt_dlp

from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from xml.etree import ElementTree

from ..config import get_db_path
from ..db_utils import (
    add_video,
    add_channel_info,
    check_if_channel_exists,
    get_channel_id_from_input,
    get_num_vids,
    get_vid_ids_by_channel_id,
    get_channels
)

from ..utils import parse_vtt, get_date, handle_reject_consent_cookie

from rich.progress import track
from rich.console import Console


class DownloadHandler:
    def __init__(self, number_of_jobs: int = 8, language: str = 'en', cookies_from_browser: str | None = None) -> None:

        self.console = Console()

        self.cookies_from_browser = cookies_from_browser
        self.number_of_jobs = number_of_jobs
        self.language = language

        self.session: requests.Session | None = None
        self.channel_id: str | None = None
        self.channel_name: str | None = None
        self.video_ids: list[str] | None = None
        self.tmp_dir: str | None = None

    def download_channel(self, url: str) -> None:

        self.validate_channel_url(url)
        self.session = self.init_session(url)
        self.channel_id = self.get_channel_id(url)
        self.channel_name = self.get_channel_name(self.channel_id)

        if check_if_channel_exists(self.channel_id):
            self.console.print(f"[yellow]Channel '{self.channel_name}' already exists in database. Updating instead...[/yellow]")
            self.update_channel(self.channel_id)
            return

        with tempfile.TemporaryDirectory() as tmp_dir:
            self.tmp_dir = tmp_dir
            channel_url = f"https://www.youtube.com/channel/{self.channel_id}/videos"
            self.video_ids = self.get_videos_list(channel_url)

            self.console.print(
                f"[green]Downloading [red]{len(self.video_ids)}[/red] "
                "vtt files[/green]"
            )

            self.download_vtts()
            add_channel_info(self.channel_id, self.channel_name, channel_url)
            self.vtt_to_db()

        self.console.print(f"[green]Finished downloading subtitles for {self.channel_name}[/green]")

    def download_playlist(self, playlist_url: str, language: str, number_of_jobs: int) -> None:
        self.language = language
        self.number_of_jobs = number_of_jobs

        playlist_data = self.get_playlist_data(playlist_url)

        for video in playlist_data:
            channel_name = video["channel_name"]
            channel_id = video["channel_id"]
            channel_url = video["channel_url"]
            if not check_if_channel_exists(channel_id):
                add_channel_info(channel_id, channel_name, channel_url)

        self.video_ids = list(set(video["video_id"] for video in playlist_data))

        with tempfile.TemporaryDirectory() as tmp_dir:
            self.console.print(f"[green][bold]Downloading [red]{len(playlist_data)}[/red] "
                               "vtt files[/bold][/green]\n")
            self.tmp_dir = tmp_dir
            self.download_vtts()
            self.vtt_to_db()

    def update_channel(self, target_channel: str | int) -> None:

        with tempfile.TemporaryDirectory() as tmp_dir:
            self.tmp_dir = tmp_dir
            
            # Handle both channel_id and target_channel (rowid/name)
            if isinstance(target_channel, str) and len(target_channel) == 24:  # YouTube channel IDs are 24 chars
                self.channel_id = target_channel
            else:
                self.channel_id = get_channel_id_from_input(target_channel)
                
            channel_url = f"https://www.youtube.com/channel/{self.channel_id}/videos"
            self.session = self.init_session(channel_url)
            self.channel_name = self.get_channel_name(self.channel_id)
            self.console.print(f"Updating channel: {self.channel_name}")
            public_video_ids = self.get_videos_list(channel_url)
            num_public_vids = len(public_video_ids)
            num_local_vids = get_num_vids(self.channel_id)

            if num_public_vids == num_local_vids:
                self.console.print("[yellow]No new videos to download[/yellow]")
                return

            local_vid_ids = get_vid_ids_by_channel_id(self.channel_id)
            local_vid_ids = [i[0] for i in local_vid_ids]

            fresh_videos = [i for i in public_video_ids if i not in local_vid_ids]
            self.video_ids = fresh_videos

            self.console.print(f"Found {len(fresh_videos)} videos on \"{self.channel_name}\" not in the database")
            self.console.print(f"Downloading {len(fresh_videos)} new videos from \"{self.channel_name}\"")

            self.download_vtts()

            vtt_to_parse = os.listdir(self.tmp_dir)

            if len(vtt_to_parse) == 0:
                self.console.print("No new videos saved")
                self.console.print(f"{len(fresh_videos)} videos on \"{self.channel_name}\" do not have subtitles")
                return

            self.vtt_to_db()

            self.console.print(f"Added {len(vtt_to_parse)} new videos from \"{self.channel_name}\" to the database")

    def update_all_channels(self) -> None:

        self.console.print("Updating all channels in the database")
        all_channels = get_channels()
        all_channel_row_ids = [i[0] for i in all_channels]

        for channel_row_id in all_channel_row_ids:
            self.update_channel(channel_row_id)

        self.console.print("[green]Finished updating all channels[/green]")

    def init_session(self, url: str) -> requests.Session:
        s = requests.session()
        handle_reject_consent_cookie(url, s)
        return s

    def get_channel_id(self, url: str) -> str | None:

        try:
            session = self.session
            res = session.get(url)
            if res.status_code == 200:
                html = res.text
                soup = BeautifulSoup(html, 'html.parser')
                meta_tag = soup.find('meta', property='og:url')
                if meta_tag:
                    content_url = meta_tag['content']
                else:
                    self.console.print('Error: Could not find channel url')
                    return None

                channel_id = content_url.split('/')[-1]
                return channel_id

        except Exception as e:
            self.console.print(f'Error: {e}')
            sys.exit(1)

    def get_channel_name(self, channel_id: str) -> str:

        session = self.session
        res = session.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")

        if res.status_code == 200:
            with self.console.status("[bold green]Parsing Feed...") as status:
                tree = ElementTree.fromstring(res.content)
                channel_name = tree.find('./{*}author/{*}name').text
                return channel_name
        else:
            self.console.print("[red]Error:[/red] "
                               "couldn't get the channel name or channel doesn't exist")
            sys.exit(1)

    def get_videos_list(self, channel_url: str) -> list[str]:
        with self.console.status("[bold green]Scraping video urls ...") as status:
            ydl_opts = {
                'http_headers': {
                    'User-Agent': random.choice(self._user_agents)
                },
                'extract_flat': True,
                'quiet': True,
                'nocheckcertificate': True,
                'sleep_interval': 1,
                'max_sleep_interval': 3,
                'retries': 3,
            }

            if self.cookies_from_browser is not None:
                ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(channel_url, download=False)
                    if info and 'entries' in info:
                        list_of_videos_urls = [entry['id'] for entry in info['entries'] if entry]
                    else:
                        self.console.print("[red]Error: Could not extract video list from channel[/red]")
                        return []
            except Exception as e:
                error_msg = str(e)
                if "403" in error_msg or "Forbidden" in error_msg:
                    self.console.print("[red]403 Forbidden error when scraping channel videos[/red]")
                    self.console.print("[yellow]This might be due to:[/yellow]")
                    self.console.print("  - Channel is private or restricted")
                    self.console.print("  - YouTube is blocking automated access")
                    self.console.print("  - Missing cookies (try --cookies-from-browser)")
                    self.console.print("  - Rate limiting")
                else:
                    self.console.print(f"[red]Error scraping videos: {error_msg}[/red]")
                return []

            # Try to get streams as well
            streams_url = channel_url.replace("/videos", "/streams")
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    streams_info = ydl.extract_info(streams_url, download=False)
                    if streams_info and 'entries' in streams_info:
                        live_stream_urls = [entry['id'] for entry in streams_info['entries'] if entry]
                        if len(live_stream_urls) > 0:
                            list_of_videos_urls.extend(live_stream_urls)
            except Exception:
                self.console.print("[yellow]No streams found[/yellow]")

        return list_of_videos_urls

    def get_playlist_data(self, playlist_url: str) -> list[dict[str, str]]:
        with self.console.status("[bold green]Scraping video urls
```

### Core Architecture Module: `src/yt_fts/export.py`
```
import csv
import datetime
import os

from rich.console import Console

from .utils import time_to_secs, show_message
from .db_utils import (
    search_channel,
    search_video,
    search_all,
    get_channel_name_from_video_id,
    get_metadata_from_db,
    get_channel_id_from_input,
    get_vid_ids_by_channel_id,
    get_subs_by_video_id,
    get_channel_name_from_id
)


class ExportHandler:
    def __init__(self, scope: str ="channel", format: str ="txt", channel: str | None = None) -> None:
        self.console = Console()
        self.format = format
        self.scope = scope

        if channel is not None:
            self.channel_id = get_channel_id_from_input(channel)
            self.channel_name = get_channel_name_from_id(self.channel_id)
        else:
            self.channel_id = None
            self.channel_name = None

        
    def export(self) -> None:
        console = self.console
        output_dir = None

        with console.status(f"[bold green]Exporting {self.channel_name}...") as status:

            if self.format == "txt":
                output_dir = self.export_channel_to_txt(self.channel_id)
            if self.format == "vtt":
                output_dir = self.export_channel_to_vtt(self.channel_id)

        if output_dir is not None:
            console.print(f"Exported to [green][bold]{output_dir}[/bold][/green]")



    def export_fts(self, text: str, scope: str, channel_id: str | None = None, video_id: str | None = None) -> None:
        """
        Calls search functions and exports the results to a csv file
        """
        console = self.console

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        if scope == "all":
            file_name = f"all_{timestamp}.csv"
            res = search_all(text)
        if scope == "video":
            file_name = f"video_{video_id}_{timestamp}.csv"
            res = search_video(video_id, text)
        if scope == "channel":
            channel_id = get_channel_id_from_input(channel_id)
            file_name = f"channel_{channel_id}_{timestamp}.csv"
            res = search_channel(channel_id, text)

        if len(res) == 0:
            show_message("no_matches_found")
            return None

        with open(file_name, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Channel Name', 'Video Title', 'Date', 'Quote', 'Time Stamp', 'Link'])

            for quote in res:
                video_id = quote["video_id"]
                channel_name = get_channel_name_from_video_id(video_id)
                metadata = get_metadata_from_db(video_id)
                time_stamp = quote["start_time"]
                subs = quote["text"]
                time = time_to_secs(time_stamp)

                writer.writerow([
                    channel_name,
                    metadata['video_title'],
                    metadata['video_date'],
                    subs.strip(),
                    time_stamp,
                    f"https://youtu.be/{video_id}?t={time}"
                ])


        console.print(f"[bold]{len(res)}[/bold] matches found for text: \"[italic]{text}[/italic]\"")
        console.print(f"Exported to [green][bold]{file_name}[/bold][/green]")


    def export_vector_search(self, res: list, search: str, scope: str) -> None:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        # run semantic search based on scope
        if scope == "all":
            file_name = f"all_{timestamp}.csv"
        if scope == "video":
            file_name = f"video_{timestamp}.csv"
        if scope == "channel":
            channel_id = res[0]["channel_id"]
            file_name = f"channel_{channel_id}_{timestamp}.csv"

        with open(file_name, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Channel Name', 'Video Title', 'Quote', 'Time Stamp', 'Link'])

            for quote in res:
                channel_name = quote["channel_name"]
                video_title = quote["video_title"]
                time_stamp = quote["start_time"]
                subs = quote["subs"]
                link = quote["link"]

                writer.writerow([channel_name, video_title, subs.strip(), time_stamp, link])

        console = Console()

        console.print(f"[bold]{len(res)}[/bold] matches found for text: \"[italic]{search}[/italic]\"")
        console.print(f"Exported to [green][bold]{file_name}[/bold][/green]")


    def export_channel_to_txt(self, channel_id: str) -> str | None:
        console = self.console

        output_dir = f"{channel_id}_txt"

        if not os.path.exists(output_dir):
            os.mkdir(output_dir)
        else:
            console.print(f"[red]Erorr:[/red] Directory [yellow]{output_dir}[/yellow] already exists")
            return None

        vid_ids = get_vid_ids_by_channel_id(channel_id)

        for vid_id in vid_ids:
            vid_id = vid_id[0]
            subs = get_subs_by_video_id(vid_id)
            str_subs = ""
            for sub in subs:
                str_subs += sub[2] + "\n"
            with open(f"{output_dir}/{vid_id}.txt", "w") as f:
                f.write(str_subs)

        return output_dir


    def export_channel_to_vtt(self, channel_id: str) -> str | None:
        console = self.console

        output_dir = f"{channel_id}_vtt"
        if not os.path.exists(output_dir):
            os.mkdir(output_dir)
        else:
            console.print(f"[red]Erorr:[/red] Directory [yellow]{output_dir}[/yellow] already exists")
            return None

        vid_ids = get_vid_ids_by_channel_id(channel_id)

        for vid_id in vid_ids:
            vid_id = vid_id[0]
            subs = get_subs_by_video_id(vid_id)

            with open(f"{output_dir}/{vid_id}.vtt", "w") as f:
                f.write("WEBVTT\n\n")

            for sub in subs:
                start_time = sub[0]
                end_time = sub[1]
                text = sub[2]

                with open(f"{output_dir}/{vid_id}.vtt", "a") as f:
                    f.write(f"{start_time} --> {end_time}\n{text}\n\n")

        return output_dir

```

### Core Architecture Module: `src/yt_fts/list.py`
```
import sqlite3

from rich.console import Console
from rich.table import Table

from .db_utils import get_title_from_db
from .utils import time_to_secs, get_time_delta
from .config import get_db_path


def show_video_transcript(video_id: str) -> None:
    con = sqlite3.connect(get_db_path())
    cur = con.cursor()
    cur.execute("SELECT * FROM subtitles WHERE video_id=?", (video_id,))
    rows = cur.fetchall()

    console = Console()
    word_count = 0
    for row in rows:
        timestamp = row[2]
        time = time_to_secs(timestamp)
        url = f"https://www.youtube.com/watch?v={video_id}&t={time}s"
        text = row[4]
        word_count += len(text.split())
        console.print(f"[link={url}]{timestamp[:-4]}[/link] - {text}")

    video_length = get_time_delta(rows[0][2], rows[-1][2])
    video_title = get_title_from_db(video_id)
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    console.print(f"")
    console.print(f"Title: [bold][link={video_url}]{video_title}[/link][/bold]")
    console.print(f"Video Length: {video_length}")
    console.print(f"Word Count: {word_count}")

    con.close()


def show_video_list(channel_id: str) -> None:
    con = sqlite3.connect(get_db_path())
    cur = con.cursor()
    cur.execute("SELECT * FROM videos WHERE channel_id=?", (channel_id,))

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Link", style="cyan")
    table.add_column("Video ID")
    table.add_column("Title")

    rows = cur.fetchall()
    for i, row in enumerate(rows):
        video_id = row[0]
        link = f"https://www.youtube.com/watch?v={video_id}"
        link_str = f"[link={link}]Link[/link]"
        title = get_title_from_db(video_id)

        table.add_row(link_str, video_id, title)

        if i != len(rows) - 1:
            table.add_row("----", "-" * len(video_id), "-" * len(title), style="dim")

    console = Console()
    console.print(table)

    console.print(f"\n[bold]Total videos: {len(rows)}[/bold]")


def list_channels(channel_id: str | None = None) -> None:
    from yt_fts.db_utils import get_channels, get_num_vids, get_channel_list_by_id

    table = Table(header_style="bold")
    table.add_column("ID", style="cyan")
    table.add_column("Name", justify="left")
    table.add_column("Count")
    table.add_column("Channel ID", justify="left")

    if channel_id is not None:
        channel = list(get_channel_list_by_id(channel_id)[0])
        channel_url = f"https://youtube.com/channel/{channel_id}"
        count = get_num_vids(channel_id)
        channel.insert(1, count)

        id_link = f"[link={channel_url}]{channel_id}[/link]"
        table.add_row(str(channel[0]), channel[2], str(channel[1]), id_link)

        console = Console()
        console.print("")
        console.print(table, justify="left")
        console.print("")
        return

    raw_channels = get_channels()
    for i in raw_channels:
        row_id = i[0]
        channel_id = i[1]
        channel_name = i[2]

        if check_ss_enabled(channel_id):
            channel_name += " (ss)"

        channel_url = f"https://youtube.com/channel/{channel_id}"
        count = get_num_vids(channel_id)
        id_link = f"[link={channel_url}]{channel_id}[/link]"

        table.add_row(str(row_id), channel_name, str(count), id_link)

    console = Console()
    console.print("")
    console.print(table, justify="left")
    console.print("")


#  not dry but for some reason importing from get_embeddings.py causes slow down
def check_ss_enabled(channel_id: str | None = None) -> bool:
    from yt_fts.config import get_db_path

    db_path = get_db_path()
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    if channel_id is None:
        cur.execute(""" 
            SELECT channel_id FROM SemanticSearchEnabled 
            """)
    else:
        cur.execute(""" 
            SELECT channel_id FROM SemanticSearchEnabled 
            WHERE channel_id = ?
            """, [channel_id])

    res = cur.fetchone()
    if res is None:
        return False
    else:
        return True

```

### Core Architecture Module: `src/yt_fts/llm/chatbot.py`
```
import sys
import textwrap
import traceback

from openai import NotGiven, OpenAI
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.text import Text

from .get_embeddings import EmbeddingsHandler
from ..utils import get_model_config, time_to_secs
from ..config import get_chroma_client
from ..db_utils import (
    get_channel_id_from_input,
    get_channel_name_from_video_id,
    get_title_from_db
)


class LLMHandler:
    def __init__(self, api_key: str, channel: str) -> None:
        self.model_config = get_model_config(api_key)
        self.openai_client = OpenAI(api_key=api_key, base_url=self.model_config['base_url'])
        self.channel_id = get_channel_id_from_input(channel)
        self.chroma_client = get_chroma_client()
        self.console = Console()
        self.max_width = 80

    def init_llm(self, prompt: str) -> None:
        messages = self.start_llm(prompt)
        self.display_message(messages[-1]["content"], "assistant")

        while True:
            user_input = Prompt.ask("> ")
            if user_input.lower() == "exit":
                self.console.print("Bye!", style="bold red")
                sys.exit(0)
            messages.append({"role": "user", "content": user_input})
            messages = self.continue_llm(messages)
            self.display_message(messages[-1]["content"], "assistant")

    def display_message(self, content: str, role: str) -> None:
        if role == "assistant":
            wrapped_content = self.wrap_text(content)
            md = Markdown(wrapped_content)
            self.console.print(md)
        else:
            wrapped_content = self.wrap_text(content)
            self.console.print(Text(wrapped_content, style="bold blue"))

    def wrap_text(self, text: str) -> str:
        lines = text.split('\n')
        wrapped_lines = []

        for line in lines:
            # If the line is a code block, don't wrap it
            if line.strip().startswith('```') or line.strip().startswith('`'):
                wrapped_lines.append(line)
            else:
                # Wrap the line
                wrapped = textwrap.wrap(line, width=self.max_width, break_long_words=False, replace_whitespace=False)
                wrapped_lines.extend(wrapped)

        # Join the wrapped lines back together
        return "  \n".join(wrapped_lines)

    def start_llm(self, prompt: str) -> list:
        try:
            context = self.create_context(prompt)
            user_str = f"Context: {context}\n\n---\n\nQuestion: {prompt}\nAnswer:"
            system_prompt = """
                            Answer the question based on the context below, and if the question can't be answered based on the context, 
                            say \"I don't know\"\n\n
                            """
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_str},
            ]

            response_text = self.get_completion(messages)


            if response_text.lower().startswith("i don't know"):
                expanded_query = self.get_expand_context_query(messages)
                self.console.print(f"Expanding context with query: [italic]{expanded_query}[/italic]")
                expanded_context = self.create_context(expanded_query)
                messages.append({
                    "role": "user",
                    "content": f"Okay here is some more context:\n---\n\n{expanded_context}\n\n---"
                })
                response_text = self.get_completion(messages)

            messages.append({
                "role": "assistant",
                "content": response_text
            })
            return messages

        except Exception as e:
            self.display_error(e)

    def continue_llm(self, messages: list) -> list:
        try:
            response_text = self.get_completion(messages)

            if response_text.lower().startswith("i don't know"): 
                expanded_query = self.get_expand_context_query(messages)
                self.console.print(f"Expanding context with query: [italic]{expanded_query}[/italic]")
                expanded_context = self.create_context(expanded_query)
                messages.append({
                    "role": "user",
                    "content": f"Okay here is some more context:\n---\n\n{expanded_context}\n\n---"
                })
                response_text = self.get_completion(messages)

            messages.append({
                "role": "assistant",
                "content": response_text
            })
            return messages

        except Exception as e:
            self.display_error(e)

    def display_error(self, error: Exception) -> None:
        self.console.print(Panel(str(error), title="Error", border_style="red"))
        traceback.print_exc()
        sys.exit(1)

    def create_context(self, text: str) -> str:
        collection = self.chroma_client.get_collection(name="subEmbeddings")

        embeddings_handler = EmbeddingsHandler()
        search_embedding = next(embeddings_handler.get_embedding(
            [text], self.model_config['embedding_model'], self.openai_client)
        )
        scope_options = {"channel_id": self.channel_id}

        chroma_res = collection.query(
            query_embeddings=[search_embedding],
            n_results=10,
            where=scope_options,
        )

        documents = chroma_res["documents"][0]
        metadata = chroma_res["metadatas"][0]
        distances = chroma_res["distances"][0]

        res = []
        for i in range(len(documents)):
            text = documents[i]
            video_id = metadata[i]["video_id"]
            start_time = metadata[i]["start_time"]
            link = f"https://youtu.be/{video_id}?t={time_to_secs(start_time)}"
            channel_name = get_channel_name_from_video_id(video_id)
            channel_id = metadata[i]["channel_id"]
            date_posted = metadata[i]["video_date"]
            title = get_title_from_db(video_id)

            match = {
                "date_posted": date_posted,
                "distance": distances[i],
                "channel_name": channel_name,
                "channel_id": channel_id,
                "video_title": title,
                "subs": text,
                "start_time": start_time,
                "video_id": video_id,
                "link": link,
            }
            res.append(match)

        return self.format_context(res)

    def get_expand_context_query(self, messages: list) -> str:
        try:
            system_prompt = """
                            Your task is to generate a question to input into a vector search 
                            engine of youtube subtitles to find strings that can answer the question
                            asked in the previous message. Just respond with the question you would
                            ask to find the answer.
                            """
            formatted_context = self.format_message_history_context(messages)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": formatted_context},
            ]

            return self.get_completion(messages)

        except Exception as e:
            self.display_error(e)

    def get_completion(self, messages: list) -> str:
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model_config['chat_model'],
                messages=messages,
                temperature=0.5,
                max_tokens=2000,
                top_p=1,
                frequency_penalty=0 if self.model_config['name'] == "OPENAI" else NotGiven(),
                presence_penalty=0,
                stop=None if self.model_config['name'] == "OPENAI" else NotGiven(),
            )
            return response.choices[0].message.content

        except Exception as e:
            self.display_error(e)

    @staticmethod
    def format_message_history_context(messages: list) -> str:
        formatted_context = ""
        for message in messages:
            if message["role"] == "system":
                continue
            role = message["role"]
            content = message["content"]
            formatted_context += f"{role}: {content}\n"
        return formatted_context

    @staticmethod
    def format_context(chroma_res: list) -> str:
        formatted_context = ""
        for obj in chroma_res:
            tmp = f"""
                ---
                Video Title: {obj["video_title"]}
                Date Posted: {obj["date_posted"]}
                Link: {obj["link"]}
                ---

                {obj["subs"]}

                ----------------------------------------
            """

            formatted_context += tmp
        return formatted_context

```

### Core Architecture Module: `src/yt_fts/llm/get_embeddings.py`
```
from typing import Generator
import uuid
from openai import OpenAI
from datetime import datetime
from rich.progress import track
from rich.console import Console
from ..config import get_chroma_client
from ..utils import Model, get_model_config, time_to_secs

from ..db_utils import (
    get_subs_by_video_id,
    get_metadata_from_db,
    get_vid_ids_by_channel_id,
    get_channel_name_from_id
)


class EmbeddingsHandler:

    def __init__(self, interval: int = 10) -> None:

        self.interval = interval
        self.console = Console()

    def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
        channel_name = get_channel_name_from_id(channel_id)
        channel_video_ids = [video_id[0] for video_id
                             in get_vid_ids_by_channel_id(channel_id)]

        formatted_segments = []
        for video_id in channel_video_ids:

            split_subs = self.split_subtitles(video_id)
            video_meta_data = get_metadata_from_db(video_id)

            if split_subs is None:
                continue

            for segment in split_subs:
                if segment['text'] == '':
                    continue

                text_with_meta_data = self.add_meta_data_to_text(
                    channel_name,
                    video_meta_data['video_title'],
                    video_meta_data['video_date'],
                    segment
                )
                formatted_segments.append({
                    'channel_name': channel_name,
                    'channel_id': channel_id,
                    'video_title': video_meta_data['video_title'],
                    'video_date': video_meta_data['video_date'].strftime('%Y-%m-%d'),
                    'video_id': video_id,
                    'start_time': segment['start_time'],
                    'text': segment['text'],
                    'text_with_meta_data': text_with_meta_data,
                })

        chroma_client = get_chroma_client()
        collection = chroma_client.get_or_create_collection(name="subEmbeddings")
        
        embedding_gen = self.get_embedding(
            text_list=[segment['text_with_meta_data'] for segment in formatted_segments],
            model=model['embedding_model'],
            client=OpenAI(api_key=model['api_key'], base_url=model['base_url'])
        )

        embeddings = list(track(embedding_gen, description="Getting embeddings"))
        meta_data = []
        uuids = []
        documents = []
        for segment_object in formatted_segments:
            documents.append(segment_object['text'])
            meta_data.append({
                "channel_id": segment_object['channel_id'],
                "channel_name": segment_object['channel_name'],
                "video_id": segment_object['video_id'],
                "start_time": segment_object['start_time'],
                "video_title": segment_object['video_title'],
                "video_date": segment_object['video_date'],
            })
            uuids.append(str(uuid.uuid4()))
        
        # Add embeddings in batches to avoid ChromaDB batch size limit
        chroma_batch_size = chroma_client.get_max_batch_size() // 5
        for i in range(0, len(embeddings), chroma_batch_size):
            j = i + chroma_batch_size

            collection.add(
                documents=documents[i:j],
                embeddings=embeddings[i:j],
                metadatas=meta_data[i:j],
                ids=uuids[i:j]
            )

    def add_meta_data_to_text(self,
                              channel_name: str,
                              video_title: str,
                              video_date: datetime.date,
                              segment: dict[str, str]) -> str:
        metadata = {
            "video_title": video_title,
            "channel_name": channel_name,
            "video_date": video_date,
            "segment_start_time": segment['start_time']
        }

        text_with_metadata = "---\n"
        text_with_metadata += "\n".join([f"{key}: {value}" for key, value in metadata.items()])
        text_with_metadata += f"\n---\n\nContent:\n\n{segment['text']}"

        return text_with_metadata

    def split_subtitles(self, video_id: str) -> list[dict[str, str]] | None:

        raw_subtitles = get_subs_by_video_id(video_id)

        if len(raw_subtitles) == 0:
            print(f"Error: No subtitles found for video: {video_id}")
            return None

        total_seconds = time_to_secs(raw_subtitles[-1][1])

        if total_seconds < self.interval:
            self.console.print(f"https://youtu.be/{video_id} is too short to split with the given interval.")
            return None

        # Convert timestamps to seconds and store texts
        segments_with_seconds = []
        for start_timestamp, stop_timestamp, text in raw_subtitles:
            segments_with_seconds.append({
                'start_timestamp': start_timestamp,
                'start_seconds': self.time_to_seconds(start_timestamp),
                'text': text
            })

        # Split texts into intervals based on self.interval
        segment_intervals = {}
        for sub_obj in segments_with_seconds:

            split_interval = int(sub_obj['start_seconds'] // self.interval) * self.interval

            if split_interval not in segment_intervals:
                segment_intervals[split_interval] = {
                    'start_time': sub_obj['start_timestamp'],
                    'texts': []
                }

            segment_intervals[split_interval]['texts'].append(sub_obj['text'])

        # Combine texts within each interval
        combined_intervals = []
        for interval_obj in segment_intervals.values():
            combined_text = ' '.join(interval_obj['texts']).strip()

            combined_intervals.append({
                'start_time': interval_obj['start_time'],
                'text': combined_text
            })

        return combined_intervals

    def get_embedding(self, text_list: list[str], model: str, client: OpenAI | None = None, batch_size: int = 100) -> Generator[list[float], None, None]:
        if client is None:
            model_config = get_model_config()
            client = OpenAI(
                api_key=model_config['api_key'],
                base_url=model_config['base_url']
            )

        text_list = [text.replace("\n", " ") for text in text_list]

        for i in range(0, len(text_list), batch_size):
            batch = text_list[i:i + batch_size]
            response = client.embeddings.create(input=batch, model=model).data
            embeddings = [data.embedding for data in response]
            yield from embeddings

    def time_to_seconds(self, time_str: str) -> float:
        """ Convert time string to total seconds """
        time_obj = datetime.strptime(time_str, '%H:%M:%S.%f').time()
        return (time_obj.hour * 3600 +
                time_obj.minute * 60 +
                time_obj.second +
                time_obj.microsecond / 1e6)

```

### Core Architecture Module: `src/yt_fts/llm/summarize.py`
```
import os
import json
import sys
import sqlite3
import tempfile
import textwrap

import yt_dlp
from rich.console import Console
from rich.markdown import Markdown
from urllib.parse import urlparse, parse_qs
from openai import NotGiven, OpenAI

from ..config import get_db_path
from ..utils import Model, parse_vtt
from ..db_utils import get_title_from_db, get_channel_name_from_video_id

class SummarizeHandler:
    def __init__(self, openai_client: OpenAI, model: Model, input_video: str) -> None:

        self.console = Console()
        self.model = model
        self.openai_client = openai_client
        self.input_video = input_video
        self.max_width = 80

        self.video_title = ''
        self.channel_name = ''

        if "https" in input_video:
            self.video_id = self.get_video_id_from_url(input_video)
        else:
            self.video_id = input_video
        
        if not self.video_in_database(self.video_id):
            self.transcript_text = self.download_transcript()
        else:
            self.video_title = get_title_from_db(self.video_id)
            self.channel_name = get_channel_name_from_video_id(self.video_id)
            self.transcript_text = self.get_transcript_from_database(self.video_id)
 
    def summarize_video(self) -> None:
        console = self.console
        video_id = self.video_id


        system_prompt = f"""
        Summarize the transcript of the YouTube video given below.
        - Provide valid youtube timestamped urls for key points in the video 
            using the format: [timestamp](https://youtu.be/{video_id}?t=[seconds])


        Video Title: {self.video_title}
        Channel Name: {self.channel_name}
        Transcript:
        """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self.transcript_text},
        ]


        with console.status("[green]Generating summary..."):
            summary_text = self.get_completion(messages)
            md = Markdown(summary_text)
            console.print("")
            console.print(md)
    

    def get_completion(self, messages: list[dict[str, str]]) -> str:
        console = self.console
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model['chat_model'],
                messages=messages,
                temperature=0.5,
                max_tokens=2000,
                top_p=1,
                frequency_penalty=0 if self.model['name'] == "OPENAI" else NotGiven(),
                presence_penalty=0,
                stop=None if self.model['name'] == "OPENAI" else NotGiven(),
            )

            response_text = response.choices[0].message.content
            wrapped_text = self.wrap_text(response_text)
            return wrapped_text

        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)
        
    def download_transcript(self) -> str:
        console = self.console
        video_id = self.video_id
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        try:
            console.print(f"Downloading subtitles for: {video_url}")
            with tempfile.TemporaryDirectory() as tmp_dir:
                ydl_opts = {
                    'outtmpl': f'{tmp_dir}/%(id)s',
                    'writeinfojson': True,
                    'writeautomaticsub': True,
                    'subtitlesformat': 'vtt',
                    'skip_download': True,
                    'subtitleslangs': ['en', '-live_chat'],
                    'quiet': True,
                    'no_warnings': True,
                    'progress_hook': [self.quiet_progress_hook],
                }

                # if self.cookies_from_browser is not None:
                #     ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url])
                

                items = os.listdir(tmp_dir)
                vtt_files = [os.path.join(tmp_dir, item) for item in items if item.endswith('.vtt')]
                json_files = [os.path.join(tmp_dir, item) for item in items if item.endswith('.info.json')]

                if len(vtt_files) == 0:
                    console.print("[red]Error:[/red] "
                                  "Failed to download subtitles.")
                    sys.exit(1)

                try:
                    with open(json_files[0], 'r') as f:
                        data = json.load(f)
                        title = data['title']
                        channel = data['uploader']
                        self.video_title = title
                        self.channel_name = channel
                except Exception as e:
                    console.print(f"[yellow]Warning:[/yellow] {e}")
                    pass

                
                vtt_file_path = vtt_files[0]
                vtt_json = parse_vtt(vtt_file_path)
                transcript = ""
                for subtitle in vtt_json:
                    start_time = subtitle['start_time'][:-4]
                    text = subtitle['text'].strip()
                    if len(text) == 0:
                        continue
                    transcript += f"{start_time}: {text}\n"

                return transcript

        except Exception as e:
            console.print(f"Failed to get: {video_id}\n{e}")
            sys.exit(1)


    def get_transcript_from_database(self, video_id: str) -> str:

        console = self.console
        try:
            conn = sqlite3.connect(get_db_path())
            curr = conn.cursor()
            curr.execute(
                """
                SELECT 
                    start_time, text
                FROM
                    Subtitles
                WHERE
                    video_id = ?
                """, (video_id,)
            )
            res = curr.fetchall()
            transcript = ""
            for row in res:
                start_time, text = row
                text = text.strip()
                if len(text) == 0:
                    continue
                transcript += f"{start_time[:-4]}: {text}\n"
            conn.close()
            return transcript
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)
        finally:
            conn.close()

    def video_in_database(self, video_id: str) -> bool:
        console = self.console
        try:
            conn = sqlite3.connect(get_db_path())
            curr = conn.cursor()
            curr.execute(
                """
                SELECT 
                    count(*)
                FROM
                    Videos
                WHERE
                    video_id = ?
                """, (video_id,)
            )
            count = curr.fetchone()[0]
            conn.close()
            if count > 0:
                return True
            return False
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)
        finally:
            conn.close()
        

    def get_video_id_from_url(self, video_url: str) -> str:
        console = self.console
        video_url = video_url.strip('/')
        parsed = urlparse(video_url)
        domain = parsed.netloc
        path = parsed.path.split('/')
        query = parse_qs(parsed.query)

        valid_domains = ["youtube.com", "youtu.be", "www.youtube.com"]

        if domain not in valid_domains:
            console.print("[red]Error:[/red] "
                          f"Invalid URL, domain \"{domain}\" not supported.")
            sys.exit(1)

        
        if domain in ["youtube.com", "www.youtube.com"] and "watch" in path:
            video_id = query.get('v', [None])[0]
        elif domain == "youtu.be":
            video_id = path[-1]
        else:
            console.print("[red]Error:[/red] "
                          "Invalid URL, please provide a valid YouTube video URL.")
            sys.exit(1)

        if video_id:
            return video_id
        
        console.print("[red]Error:[/red] "
                      "Invalid URL, please provide a valid YouTube video URL.")
        sys.exit(1)

   
    def quiet_progress_hook(self, d: dict) -> None:
        console = self.console
        if d['status'] == 'finished':
            console.print(f" -> \"{d['filename']}\"")

    def wrap_text(self, text: str) -> str:
        lines = text.split('\n')
        wrapped_lines = []

        for line in lines:
            # If the line is a code block, don't wrap it
            if line.strip().startswith('```') or line.strip().startswith('`'):
                wrapped_lines.append(line)
            else:
                # Wrap the line
                wrapped = textwrap.wrap(line, width=self.max_width, break_long_words=False, replace_whitespace=False)
                wrapped_lines.extend(wrapped)

        # Join the wrapped lines back together
        return "  \n".join(wrapped_lines)


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #186** (2025-07-04): **Fix download format errors, bump yt-dlp version, set default jobs to 8**
  *Symptoms*: This pull request introduces changes to improve the functionality and usability of the YouTube channel downloader. Key updates include modifying the behavior for handling duplicate channels, increasing the default number of parallel jobs, fixing a typo in a variable name, and adding a new test case for channel updates. These changes enhance user experience and improve code reliability.  ### Enhancements to duplicate channel handling: * [`yt_fts/download.py`](diffhunk://#diff-e33c32d6d9355bccfa49d5b2317425da129b78039e78d52811f43726836fcfbbL55-R57): Updated the `download_channel` method to allow updating existing channels instead of exiting with an error. Removed the `handle_channel_exists` method, which previously handled duplicates by displaying an error message. [[1]](diffhunk://#diff-e33c32d6d9355bccfa49d5b2317425da129b78039e78d52811f43726836fcfbbL55-R57) [[2]](diffhunk://#diff-e33c32d6d9355bccfa49d5b2317425da129b78039e78d52811f43726836fcfbbL350-R357) * [`yt_fts/download.py`](diffhunk://#diff-e33c32d6d9355bccfa49d5b2317425da129b78039e78d52811f43726836fcfbbR101-R107): Modified the `update_channel` method to handle both `channel_id` and alternative identifiers (e.g., `rowid` or `channel name`) for updating channels.  ### Default parallelization improvement: * [`yt_fts/download.py`](diffhunk://#diff-e33c32d6d9355bccfa49d5b2317425da129b78039e78d52811f43726836fcfbbL25-R33): Increased the default number of jobs for parallel downloads from 1 to 8 in the `DownloadHandler` cl

- **Issue #182** (2025-07-04): **I got messge to sign in**
  *Symptoms*: I got a message to sign in to my YouTube account. Using `cookies-from-browser` does not help me. Any Idea?
  **Post-Mortem & Fix Analysis**:
  > Seeing the same thing on my end, looking into this.
  > @Nevermetyou65 fixed with user agent randomization and retry methods in https://github.com/NotJoeMartinez/yt-fts/releases/tag/v0.1.62

- **Issue #168** (2025-07-04): **User Agent Randomization, Proxies and Youtube API**
  *Symptoms*: Direct Scraping via yt-dlp is causing [rate limiting errors](https://github.com/NotJoeMartinez/yt-fts/issues/166), implement User Agent Randomization and Proxy support to bypass this issue. Add option to use youtube api as suggested in https://github.com/NotJoeMartinez/yt-fts/issues/86
  **Post-Mortem & Fix Analysis**:
  > YouTube API requires oauth2 and doesn't let you download other people captions, added UA randomization in https://github.com/NotJoeMartinez/yt-fts/releases/tag/v0.1.62

- **Issue #166** (2024-08-21): **Getting "Sign in to confirm you’re not a bot. This helps protect our community."**
  *Symptoms*: ``` WARNING: [youtube] API returned broken formats (poToken experiment detected). Retrying (3/3)... WARNING: [youtube] API returned broken formats (poToken experiment detected). Giving up after 3 retries ERROR: [youtube] bDdGUFZg1YQ: Sign in to confirm you’re not a bot. This helps protect our community. Learn more Failed to get: https://www.youtube.com/watch?v=bDdGUFZg1YQ [0;31mERROR:[0m  bDdGUFZg1YQ: Sign in to confirm you’re not a bot. This helps protect our community. Learn more WARNING: [youtube] Webpage contains broken formats (poToken experiment detected). Ignoring initial player response WARNING: [youtube] API returned broken formats (poToken experiment detected). Retrying (1/3)... WARNING: [youtube] API returned broken formats (poToken experiment detected). Retrying (2/3)... WARNING: [youtube] API returned broken formats (poToken experiment detected). Retrying (3/3)... WARNING: [youtube] API returned broken formats (poToken experiment detected). Giving up after 3 retries ERROR: [youtube] eb9Q_Gz9hwM: Sign in to confirm you’re not a bot. This helps protect our community. Learn more  ```  Can you please allow us to add a cookie or something to solve this issue?
  **Post-Mortem & Fix Analysis**:
  > I've seen increasing reports of rate limiting errors and I'm working on a solution in https://github.com/NotJoeMartinez/yt-fts/issues/168. For now the best solution is to do the initial download then run the update command a couple times on the channel until you get all available videos into the database.   For example the initial transcript count of this channel was 386 ```sh yt-fts download -j 8 "https://www.youtube.com/@TwoMinutePapers" ``` After running update once it is 502 ```sh yt-fts update --number-of-jobs 8 -c 19 ```  Edit:  It's also a good idea to run script from different ips with a vpn
  > @NotJoeMartinez alright got you, thank you so much!

- **Issue #164** (2024-09-05): **OR doesn't seem to work**
  *Symptoms*: It seems like `OR` doesn't get parsed properly :thinking:   ``` $ yt-fts search -c 2 "foo OR bar" - Try shortening the search to specific words - Try using the wildcard operator * to search for partial words - Try using the OR operator to search for multiple words     - EX: "foo OR OR OR bar" ```
  **Post-Mortem & Fix Analysis**:
  > fixed in `0.1.56` https://github.com/NotJoeMartinez/yt-fts/pull/170

- **Issue #150** (2024-07-05): **'NoneType' object has no attribute 'group'**
  *Symptoms*: I get the following error when I try to yt-fts download URL  `Traceback (most recent call last):   File "/Users/joseph/.pyenv/versions/3.12.3/bin/yt-fts", line 8, in <module>     sys.exit(cli())              ^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/click/core.py", line 1157, in __call__     return self.main(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/click/core.py", line 1078, in main     rv = self.invoke(ctx)          ^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/click/core.py", line 1688, in invoke     return _process_result(sub_ctx.command.invoke(sub_ctx))                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/click/core.py", line 1434, in invoke     return ctx.invoke(self.callback, **ctx.params)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/click/core.py", line 783, in invoke     return __callback(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/yt_fts/yt_fts.py", line 52, in download     channel_id = get_channel_id(url, s)                  ^^^^^^^^^^^^^^^^^^^^^^   File "/Users/joseph/.pyenv/versions/3.12.3/lib/python3.12/site-packages/yt_fts/downlo
  **Post-Mortem & Fix Analysis**:
  > @sharpsteelsoftware thanks for reporting this, the issue was cause by YouTube changing the html of channel pages.  Just fixed in [v0.1.51](https://github.com/NotJoeMartinez/yt-fts/releases/tag/v0.1.51) by searching for `<meta property="og:url" content="https://www.youtube.com/channel/UC3S8vxwRfqLBdIhgRlDRVzw"> ` in the HTML. 

- **Issue #145** (2024-06-26): **AttributeError: `np.float_` was removed in the NumPy 2.0 release. Use `np.float64` instead.. Did you mean: 'float16'?**
  *Symptoms*: ``` (playground) root@ubuntu-4gb-nbg1-1:~/playground# pip install yt-fts Collecting yt-fts   Downloading yt_fts-0.1.48-py3-none-any.whl.metadata (8.4 kB) Collecting click==8.1.7 (from yt-fts)   Downloading click-8.1.7-py3-none-any.whl.metadata (3.0 kB) Collecting openai==1.16.2 (from yt-fts)   Downloading openai-1.16.2-py3-none-any.whl.metadata (21 kB) Collecting chromadb==0.4.24 (from yt-fts)   Downloading chromadb-0.4.24-py3-none-any.whl.metadata (7.3 kB) Collecting requests==2.31.0 (from yt-fts)   Downloading requests-2.31.0-py3-none-any.whl.metadata (4.6 kB) Collecting rich==13.7.1 (from yt-fts)   Downloading rich-13.7.1-py3-none-any.whl.metadata (18 kB) Collecting sqlite-utils==3.36 (from yt-fts)   Downloading sqlite_utils-3.36-py3-none-any.whl.metadata (7.6 kB) Collecting beautifulsoup4==4.12.3 (from yt-fts)   Downloading beautifulsoup4-4.12.3-py3-none-any.whl.metadata (3.8 kB) Collecting soupsieve>1.2 (from beautifulsoup4==4.12.3->yt-fts)   Downloading soupsieve-2.5-py3-none-any.whl.metadata (4.7 kB) Collecting build>=1.0.3 (from chromadb==0.4.24->yt-fts)   Downloading build-1.2.1-py3-none-any.whl.metadata (4.3 kB) Collecting pydantic>=1.9 (from chromadb==0.4.24->yt-fts)   Downloading pydantic-2.7.4-py3-none-any.whl.metadata (109 kB)      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 109.4/109.4 kB 13.7 MB/s eta 0:00:00 Collecting chroma-hnswlib==0.7.3 (from chromadb==0.4.24->yt-fts)   Downloading chroma-hnswlib-0.7.3.tar.gz (31 kB)   Installing b
  **Post-Mortem & Fix Analysis**:
  > @akwaaad thanks for catching this. This seems be caused by the `chromadb 0.4.24` dependency being incompatible with with numpy2.0. I  will publish a new release with the updated chromadb dependency, in the mean time you can fix it by reinstalling chromadb with pip `pip uninstall chromadb` `pip install chromadb`.
  > fixed in latest release https://github.com/NotJoeMartinez/yt-fts/releases/tag/v0.1.49

- **Issue #138** (2024-04-10): **Crash due to unicode decode error while getting video title from vtt**
  *Symptoms*: Might be a malformed character in a video title. Would it be possible to let yt-fts skip undefined characters and throw a warning instead of a crash?  Adding subtitles to database... ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   0% -:--:-- Traceback (most recent call last):   File "c:\users\derja\appdata\local\programs\python\python39\lib\runpy.py", line 197, in _run_module_as_main     return _run_code(code, main_globals, None,   File "c:\users\derja\appdata\local\programs\python\python39\lib\runpy.py", line 87, in _run_code     exec(code, run_globals)   File "C:\Users\derja\AppData\Local\Programs\Python\Python39\Scripts\yt-fts.exe\__main__.py", line 7, in <module>   File "c:\users\derja\appdata\local\programs\python\python39\lib\site-packages\click\core.py", line 1157, in __call__     return self.main(*args, **kwargs)   File "c:\users\derja\appdata\local\programs\python\python39\lib\site-packages\click\core.py", line 1078, in main     rv = self.invoke(ctx)   File "c:\users\derja\appdata\local\programs\python\python39\lib\site-packages\click\core.py", line 1688, in invoke     return _process_result(sub_ctx.command.invoke(sub_ctx))   File "c:\users\derja\appdata\local\programs\python\python39\lib\site-packages\click\core.py", line 1434, in invoke     return ctx.invoke(self.callback, **ctx.params)   File "c:\users\derja\appdata\local\programs\python\python39\lib\site-packages\click\core.py", line 783, in invoke     return __callback(*args, **kwargs)   File "c:\u
  **Post-Mortem & Fix Analysis**:
  > `UnicodeDecodeError: 'charmap' codec can't decode byte 0x81` seems to be related to a Windows-1252 encoding error.  The `get_vid_title()` function could be wrapped in a try/except but we'd still run into problems with not returning a name from the function.   gpt & [stack overflow](https://stackoverflow.com/questions/9233027/unicodedecodeerror-charmap-codec-cant-decode-byte-x-in-position-y-character) recommend setting a default encoding of `utf-8`  ```python with open(info_file, 'r', encoding='utf-8', errors='ignore') as f:     return json.load(f)['title'] ```  Would you mind providing a channel url to reproduce this on?  The `yt-fts` &`yt-dlp` version numbers would be helpful as well.  Thanks.  
  > I have downloaded via pip today, and had the same issue. Made your suggested change:  ``` def get_vid_title(info_json_path):     """     Retrieves video title from the info json file.     """     with open(info_json_path, 'r', encoding='utf-8', errors='ignore') as f:         return json.load(f)['title'] ```  and after that it worked.
  > Fixed in [v0.1.44](https://github.com/NotJoeMartinez/yt-fts/releases/tag/v0.1.44). Bug was introduced on [896f8fd](https://github.com/NotJoeMartinez/yt-fts/blame/58b538b7eeabcfc2ef400db9e154d1812f91a566/yt_fts/download.py#L176) by writing json to file system which will be encoded differently on Windows. Should be solved/prevented by specifying the `utf-8` encoding when using `json.load`, I don't have a Windows environment to test this in so feel free to make another issue if it persists. 

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

### Incident Patch 1: `7d5d24fe` (2025-07-24)
**Commit Message**: Fix max batch size of ChromaDB

**File**: `src/yt_fts/llm/get_embeddings.py` (modified, +14/-8)
```diff
@@ -22,7 +22,7 @@ def __init__(self, interval: int = 10) -> None:
         self.interval = interval
         self.console = Console()
 
-    def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
+    def add_embeddings_to_chroma(self, channel_id: str, model: Model, chroma_batch_size: int = 1000) -> None:
         channel_name = get_channel_name_from_id(channel_id)
         channel_video_ids = [video_id[0] for video_id
                              in get_vid_ids_by_channel_id(channel_id)]
@@ -69,7 +69,9 @@ def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
         embeddings = list(track(embedding_gen, description="Getting embeddings"))
         meta_data = []
         uuids = []
+        documents = []
         for segment_object in formatted_segments:
+            documents.append(segment_object['text'])
             meta_data.append({
                 "channel_id": segment_object['channel_id'],
                 "channel_name": segment_object['channel_name'],
@@ -79,13 +81,17 @@ def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
                 "video_date": segment_object['video_date'],
             })
             uuids.append(str(uuid.uuid4()))
-
-        collection.add(
-            documents=[segment_object['text'] for segment_object in formatted_segments],
-            embeddings=embeddings,
-            metadatas=meta_data,
-            ids=uuids
-        )
+        
+        # Add embeddings in batches to avoid ChromaDB batch size limit
+        for i in range(0, len(embeddings), chroma_batch_size):
+            j = i + chroma_batch_size
+
+            collection.add(
+                documents=documents[i:j],
+                embeddings=embeddings[i:j],
+                metadatas=meta_data[i:j],
+                ids=uuids[i:j]
+            )
 
     def add_meta_data_to_text(self,
                               channel_name: str,
```

---

### Incident Patch 2: `f513bd55` (2025-07-23)
**Commit Message**: Fix slow insertion into vector database and Fix progress bar

**File**: `src/yt_fts/llm/chatbot.py` (modified, +3/-1)
```diff
@@ -133,7 +133,9 @@ def create_context(self, text: str) -> str:
         collection = self.chroma_client.get_collection(name="subEmbeddings")
 
         embeddings_handler = EmbeddingsHandler()
-        search_embedding = embeddings_handler.get_embedding([text], self.model_config['embedding_model'], self.openai_client)[0]
+        search_embedding = next(embeddings_handler.get_embedding(
+            [text], self.model_config['embedding_model'], self.openai_client)
+        )
         scope_options = {"channel_id": self.channel_id}
 
         chroma_res = collection.query(
```

**File**: `src/yt_fts/llm/get_embeddings.py` (modified, +21/-20)
```diff
@@ -1,3 +1,4 @@
+from typing import Generator
 import uuid
 from openai import OpenAI
 from datetime import datetime
@@ -36,6 +37,9 @@ def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
                 continue
 
             for segment in split_subs:
+                if segment['text'] == '':
+                    continue
+
                 text_with_meta_data = self.add_meta_data_to_text(
                     channel_name,
                     video_meta_data['video_title'],
@@ -56,31 +60,32 @@ def add_embeddings_to_chroma(self, channel_id: str, model: Model) -> None:
         chroma_client = get_chroma_client()
         collection = chroma_client.get_or_create_collection(name="subEmbeddings")
         
-        embeddings = self.get_embedding(
+        embedding_gen = self.get_embedding(
             text_list=[segment['text_with_meta_data'] for segment in formatted_segments],
             model=model['embedding_model'],
             client=OpenAI(api_key=model['api_key'], base_url=model['base_url'])
         )
 
-        for segment_object, embedding in track(zip(formatted_segments, embeddings), description="Getting embeddings"):
-            if segment_object['text'] == '':
-                continue
-
-            meta_data = {
+        embeddings = list(track(embedding_gen, description="Getting embeddings"))
+        meta_data = []
+        uuids = []
+        for segment_object in formatted_segments:
+            meta_data.append({
                 "channel_id": segment_object['channel_id'],
                 "channel_name": segment_object['channel_name'],
                 "video_id": segment_object['video_id'],
                 "start_time": segment_object['start_time'],
                 "video_title": segment_object['video_title'],
                 "video_date": segment_object['video_date'],
-            }
+            })
+            uuids.append(str(uuid.uuid4()))
 
-            collection.add(
-                documents=[segment_object['text']],
-                embeddings=[embedding],
-                metadatas=[meta_data],
-                ids=[f"{uuid.uuid4()}"],
-            )
+        collection.add(
+            documents=[segment_object['text'] for segment_object in formatted_segments],
+            embeddings=embeddings,
+            metadatas=meta_data,
+            ids=uuids
+        )
 
     def add_meta_data_to_text(self,
                               channel_name: str,
@@ -149,8 +154,7 @@ def split_subtitles(self, video_id: str) -> list[dict[str, str]] | None:
 
         return combined_intervals
 
-    def get_embedding(self, text_list: list[str], model: str, client: OpenAI | None = None) -> list[list[float]]:
-
+    def get_embedding(self, text_list: list[str], model: str, client: OpenAI | None = None, batch_size: int = 100) -> Generator[list[float], None, None]:
         if client is None:
             model_config = get_model_config()
             client = OpenAI(
@@ -160,14 +164,11 @@ def get_embedding(self, text_list: list[str], model: str, client: OpenAI | None
 
         text_list = [text.replace("\n", " ") for text in text_list]
 
-        batch_size = 100
-        embeddings: list[list[float]] = []
         for i in range(0, len(text_list), batch_size):
             batch = text_list[i:i + batch_size]
             response = client.embeddings.create(input=batch, model=model).data
-            embeddings.extend([data.embedding for data in response])
-
-        return embeddings
+            embeddings = [data.embedding for data in response]
+            yield from embeddings
 
     def time_to_seconds(self, time_str: str) -> float:
         """ Convert time string to total seconds """
```

**File**: `src/yt_fts/search.py` (modified, +3/-1)
```diff
@@ -88,7 +88,9 @@ def vector_search(self, query: str, model: Model) -> None:
 
         embeddings_handler = EmbeddingsHandler()
         openai_client = OpenAI(api_key=model['api_key'], base_url=model['base_url'])
-        search_embedding = embeddings_handler.get_embedding([query], model['embedding_model'], openai_client)[0]
+        search_embedding = next(embeddings_handler.get_embedding(
+            [query], model['embedding_model'], openai_client)
+        )
         chroma_res = collection.query(
             query_embeddings=[search_embedding],
             n_results=self.limit,
```

**File**: `tests/view_chromadb.py` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ def search_collections(chroma_path, text):
 
     model = get_model_config()
     openai_client = OpenAI(api_key=model['api_key'], base_url=model['base_url'])
-    search_embedding = get_embedding(text, model['embedding_model'], openai_client)
+    search_embedding = next(get_embedding([text], model['embedding_model'], openai_client))
 
 
     chroma_res = collection.query(
```

---

### Incident Patch 3: `820d1392` (2025-07-22)
**Commit Message**: Fix scope "all" in "vsearch" command

empty dict is not a valid `where` parameter because `len(where)` should equal 1

**File**: `src/yt_fts/config.py` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@
 
 import chromadb
 from chromadb.config import Settings
-
+from chromadb.api import ClientAPI
 
 def get_config_path() -> str | None:
 
@@ -111,7 +111,7 @@ def get_or_make_chroma_path() -> str:
         return chroma_path
 
 
-def get_chroma_client() -> chromadb.PersistentClient:
+def get_chroma_client() -> ClientAPI:
     chroma_path = get_or_make_chroma_path()
     return chromadb.PersistentClient(path=chroma_path, 
                                      settings=Settings(anonymized_telemetry=False))
```

**File**: `src/yt_fts/search.py` (modified, +2/-2)
```diff
@@ -75,9 +75,9 @@ def full_text_search(self, query: str) -> None:
     def vector_search(self, query: str, model: Model) -> None:
         console = self.console
         self.query = query
-        scope_options = {}
+        scope_options = None
         if self.scope == "all":
-            scope_options = {}
+            scope_options = None
         if self.scope == "channel":
             scope_options = {"channel_id": get_channel_id_from_input(self.channel)}
         if self.scope == "video":
```

**File**: `tests/view_chromadb.py` (modified, +1/-2)
```diff
@@ -64,8 +64,7 @@ def search_collections(chroma_path, text):
     chroma_res = collection.query(
         query_embeddings=[search_embedding],
         n_results=5,
-        where={},
-        )
+    )
 
     pprint(chroma_res)
     documents = chroma_res["documents"][0]
```

---

### Incident Patch 4: `573f48b2` (2025-07-21)
**Commit Message**: Fix small bug

**File**: `src/yt_fts/llm/summarize.py` (modified, +5/-6)
```diff
@@ -12,11 +12,11 @@
 from openai import NotGiven, OpenAI
 
 from ..config import get_db_path
-from ..utils import get_model_config, parse_vtt
+from ..utils import Model, parse_vtt
 from ..db_utils import get_title_from_db, get_channel_name_from_video_id
 
 class SummarizeHandler:
-    def __init__(self, openai_client: OpenAI, model: str, input_video: str) -> None:
+    def __init__(self, openai_client: OpenAI, model: Model, input_video: str) -> None:
 
         self.console = Console()
         self.model = model
@@ -70,17 +70,16 @@ def summarize_video(self) -> None:
 
     def get_completion(self, messages: list[dict[str, str]]) -> str:
         console = self.console
-        model_config = get_model_config()
         try:
             response = self.openai_client.chat.completions.create(
-                model=self.model,
+                model=self.model['chat_model'],
                 messages=messages,
                 temperature=0.5,
                 max_tokens=2000,
                 top_p=1,
-                frequency_penalty=0 if model_config['name'] == "OPENAI" else NotGiven(),
+                frequency_penalty=0 if self.model['name'] == "OPENAI" else NotGiven(),
                 presence_penalty=0,
-                stop=None if model_config['name'] == "OPENAI" else NotGiven(),
+                stop=None if self.model['name'] == "OPENAI" else NotGiven(),
             )
 
             response_text = response.choices[0].message.content
```

**File**: `src/yt_fts/yt_fts.py` (modified, +3/-3)
```diff
@@ -387,8 +387,8 @@ def summarize(video: str, model: str | None, api_key: str | None) -> None:
     try:
         model_config = get_model_config(api_key)
         api_key = model_config['api_key']
-        if model is None:
-            model = model_config['chat_model']
+        if model:
+            model_config['chat_model'] = model
     except ValueError:
         console.print("[red]Error:[/red] OPENAI_API_KEY and GEMINI_API_KEY environment variables not set\n"
                       "To set the key run: export \"OPENAI_API_KEY=<your_key>\" or "
@@ -400,7 +400,7 @@ def summarize(video: str, model: str | None, api_key: str | None) -> None:
 
     summarize_handler = SummarizeHandler(
         openai_client,
-        model=model,
+        model=model_config,
         input_video=video
         )
     summarize_handler.summarize_video()
```

---

### Incident Patch 5: `f0e6cc4a` (2025-07-21)
**Commit Message**: Fix tests and add pytest to dev dependencies

**File**: `pyproject.toml` (modified, +6/-1)
```diff
@@ -35,4 +35,9 @@ dependencies = [
 yt-fts = "yt_fts.yt_fts:cli"
 
 [project.urls]
-Homepage = "https://github.com/NotJoeMartinez/yt-fts"
\ No newline at end of file
+Homepage = "https://github.com/NotJoeMartinez/yt-fts"
+
+[dependency-groups]
+dev = [
+    "pytest>=8.4.1",
+]
```

**File**: `tests/test_download.py` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ def test_channel_update_on_duplicate(runner, capsys):
     
     # Check that we get the "already exists, updating instead" message
     output = results.output
-    assert "already exists in database. Updating instead" in output
+    assert "already exists in database." in output
     
     # Get final video count
     res = curr.execute(f"""
```

**File**: `tests/test_search.py` (modified, +7/-3)
```diff
@@ -26,7 +26,9 @@ def reset_testing_env():
 def test_global_search(runner, capsys):
     result = runner.invoke(cli, [
         'search',
-        'guilt'
+        'guilt',
+        '-l',
+        '99'
     ])
 
     assert result.exit_code == 0
@@ -35,7 +37,7 @@ def test_global_search(runner, capsys):
     captured = capsys.readouterr()
     output = captured.out
 
-    assert "Y Combinator: The Vault" in output
+    assert "YC Root Access" in output
     assert "JCS - Criminal Psychology" in output
     # assert "Found 16 matches in 9 videos from 2 channels" in output
 
@@ -45,7 +47,9 @@ def test_channel_search(runner, capsys):
         'search',
         '-c',
         '1',
-        'criminal'
+        'criminal',
+        '-l',
+        '99'
     ])
 
     assert result.exit_code == 0
```

**File**: `tests/testing_utils.py` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 CONFIG_DIR = os.path.expanduser('~/.config/yt-fts')
 
 def fetch_and_unzip_test_db():
+    # This database doesn't work with Gemini implementation because the ChromaDB dimension is set to 1536 when the Gemini implementation expects 768
     url = "https://yt-fts-testdb-server.notjoemartinez.workers.dev/yt-fts/test_dbs/2024-07-04.zip"
 
     # Create a temporary directory
```

---

### Incident Patch 6: `a1f28ded` (2025-07-04)
**Commit Message**: Merge pull request #188 from NotJoeMartinez/fix-download-only-one

Fix download only one, randomize user agents

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "yt-fts"
-version = "0.1.61"
+version = "0.1.62"
 description = "Search all of a YouTube channel from the command line"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/yt_fts/__init__.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-__version__ = "0.1.61"
\ No newline at end of file
+__version__ = "0.1.62"
\ No newline at end of file
```

**File**: `src/yt_fts/download/download_handler.py` (modified, +44/-13)
```diff
@@ -1,10 +1,13 @@
-import yt_dlp
-import tempfile
-import sys
+
 import os
-import sqlite3
+import sys
 import json
+import random
+import sqlite3
+import tempfile
+
 import requests
+import yt_dlp
 
 from pathlib import Path
 from concurrent.futures import ThreadPoolExecutor
@@ -195,10 +198,12 @@ def get_channel_name(self, channel_id: str) -> str:
     def get_videos_list(self, channel_url: str) -> list[str]:
         with self.console.status("[bold green]Scraping video urls ...") as status:
             ydl_opts = {
+                'http_headers': {
+                    'User-Agent': random.choice(self._user_agents)
+                },
                 'extract_flat': True,
                 'quiet': True,
                 'nocheckcertificate': True,
-                'user_agent': 'random',
                 'sleep_interval': 1,
                 'max_sleep_interval': 3,
                 'retries': 3,
@@ -238,13 +243,16 @@ def get_videos_list(self, channel_url: str) -> list[str]:
                         if len(live_stream_urls) > 0:
                             list_of_videos_urls.extend(live_stream_urls)
             except Exception:
-                self.console.print("No streams found")
+                self.console.print("[yellow]No streams found[/yellow]")
 
         return list_of_videos_urls
 
     def get_playlist_data(self, playlist_url: str) -> list[dict[str, str]]:
         with self.console.status("[bold green]Scraping video urls...") as status:
             ydl_opts = {
+                'http_headers': {   
+                    'User-Agent': random.choice(self._user_agents)
+                },
                 'quiet': True,
                 'extract_flat': True,
             }
@@ -254,7 +262,6 @@ def get_playlist_data(self, playlist_url: str) -> list[dict[str, str]]:
                 playlist_data = []
                 for entry in info['entries']:
                     vid_obj = {
-                        'user_agent': 'random',
                         'channel_name': entry['channel'],
                         'channel_id': entry['channel_id'],
                         'video_id': entry['id'],
@@ -290,24 +297,23 @@ def get_vtt(self, tmp_dir: str, video_url: str, language: str) -> None:
         for attempt in range(max_retries):
             try:
                 ydl_opts = {
-                    'user_agent': 'random',
+                    'http_headers': {
+                        'User-Agent': random.choice(self._user_agents)
+                    },
                     'outtmpl': f'{tmp_dir}/%(id)s',
                     'writeinfojson': True,
                     'writeautomaticsub': True,
                     'subtitlesformat': 'vtt',
                     'skip_download': True,
-                    'subtitleslangs': [language, '-live_chat'],
+                    'subtitleslangs': ['en', '-live_chat'],  # Only English, prefer auto-generated
                     'quiet': True,
                     'no_warnings': True,
                     'progress_hooks': [self.quiet_progress_hook],
-                    # Additional options to help bypass restrictions
                     'nocheckcertificate': True,
                     'ignoreerrors': False,
                     'no_color': True,
-                    # Add rate limiting
                     'sleep_interval': 1,
                     'max_sleep_interval': 5,
-                    # Add retry logic
                     'retries': 3,
                     'fragment_retries': 3,
                     'skip_unavailable_fragments': True,
@@ -317,14 +323,23 @@ def get_vtt(self, tmp_dir: str, video_url: str, language: str) -> None:
                     ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)
 
                 with yt_dlp.YoutubeDL(ydl_opts) as ydl:
+                    # First, let's check what subtitles are available
+                    info = ydl.extract_info(video_url, download=False)
+                    if info:
+                        available_subs = info.get('subtitles', {}).keys()
+                        auto_subs = info.get('automatic_captions', {}).keys()
+                        if not available_subs and not auto_subs:
+                            self.console.print(f"[yellow]No subtitles available for {video_url}[/yellow]")
+                            return
+                   
                     ydl.download([video_url])
                 
                 return
 
             except Exception as e:
                 error_msg = str(e)
                 self.console.print(f"[yellow]Attempt {attempt + 1}/{max_retries} failed for: {video_url}[/yellow]")
-                self.console.print(f"[red]Error: {error_msg}[/red]")
+                self.console.print(f"[red]Warning: {error_msg}[/red]")
                 
                 # Check if it's a 403 error specifically
                 if "403" in error_msg or "Forbidden" in error_msg:
@@ -543,3 +558,19 @@ def validate_channel_url(self, channel_url: str) -> s
```

---

### Incident Patch 7: `74093246` (2025-07-04)
**Commit Message**: fixed download

**File**: `src/yt_fts/download/download_handler.py` (modified, +12/-9)
```diff
@@ -198,7 +198,6 @@ def get_videos_list(self, channel_url: str) -> list[str]:
                 'extract_flat': True,
                 'quiet': True,
                 'nocheckcertificate': True,
-                'user_agent': 'random',
                 'sleep_interval': 1,
                 'max_sleep_interval': 3,
                 'retries': 3,
@@ -238,7 +237,7 @@ def get_videos_list(self, channel_url: str) -> list[str]:
                         if len(live_stream_urls) > 0:
                             list_of_videos_urls.extend(live_stream_urls)
             except Exception:
-                self.console.print("No streams found")
+                self.console.print("[yellow]Warning: No streams found[/yellow]")
 
         return list_of_videos_urls
 
@@ -254,7 +253,6 @@ def get_playlist_data(self, playlist_url: str) -> list[dict[str, str]]:
                 playlist_data = []
                 for entry in info['entries']:
                     vid_obj = {
-                        'user_agent': 'random',
                         'channel_name': entry['channel'],
                         'channel_id': entry['channel_id'],
                         'video_id': entry['id'],
@@ -290,24 +288,20 @@ def get_vtt(self, tmp_dir: str, video_url: str, language: str) -> None:
         for attempt in range(max_retries):
             try:
                 ydl_opts = {
-                    'user_agent': 'random',
                     'outtmpl': f'{tmp_dir}/%(id)s',
                     'writeinfojson': True,
                     'writeautomaticsub': True,
                     'subtitlesformat': 'vtt',
                     'skip_download': True,
-                    'subtitleslangs': [language, '-live_chat'],
+                    'subtitleslangs': ['en', '-live_chat'],  # Only English, prefer auto-generated
                     'quiet': True,
                     'no_warnings': True,
                     'progress_hooks': [self.quiet_progress_hook],
-                    # Additional options to help bypass restrictions
                     'nocheckcertificate': True,
                     'ignoreerrors': False,
                     'no_color': True,
-                    # Add rate limiting
                     'sleep_interval': 1,
                     'max_sleep_interval': 5,
-                    # Add retry logic
                     'retries': 3,
                     'fragment_retries': 3,
                     'skip_unavailable_fragments': True,
@@ -317,14 +311,23 @@ def get_vtt(self, tmp_dir: str, video_url: str, language: str) -> None:
                     ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)
 
                 with yt_dlp.YoutubeDL(ydl_opts) as ydl:
+                    # First, let's check what subtitles are available
+                    info = ydl.extract_info(video_url, download=False)
+                    if info:
+                        available_subs = info.get('subtitles', {}).keys()
+                        auto_subs = info.get('automatic_captions', {}).keys()
+                        if not available_subs and not auto_subs:
+                            self.console.print(f"[yellow]No subtitles available for {video_url}[/yellow]")
+                            return
+                   
                     ydl.download([video_url])
                 
                 return
 
             except Exception as e:
                 error_msg = str(e)
                 self.console.print(f"[yellow]Attempt {attempt + 1}/{max_retries} failed for: {video_url}[/yellow]")
-                self.console.print(f"[red]Error: {error_msg}[/red]")
+                self.console.print(f"[red]Warning: {error_msg}[/red]")
                 
                 # Check if it's a 403 error specifically
                 if "403" in error_msg or "Forbidden" in error_msg:
```

---

### Incident Patch 8: `9e9c482c` (2025-07-04)
**Commit Message**: Update Python version requirement and add type hints to database utility functions

- Changed the minimum required Python version from 3.8 to 3.10 in `pyproject.toml`.
- Added type hints to various functions in `db_utils.py` for improved code clarity and type checking.

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -7,14 +7,14 @@ name = "yt-fts"
 version = "0.1.60"
 description = "Search all of a YouTube channel from the command line"
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 license = { file = "LICENSE" }
 authors = [
     { name = "NotJoeMartinez", email = "notjoemartinez@protonmail.com" }
 ]
 keywords = ["youtube", "subtitles", "search"]
 classifiers = [
-    "Programming Language :: Python :: 3",
+    "Programming Language :: Python :: 3.10",
     "License :: OSI Approved :: The Unlicense (Unlicense)", 
     "Operating System :: OS Independent",
 ]
```

**File**: `yt_fts/db_utils.py` (modified, +29/-29)
```diff
@@ -10,7 +10,7 @@
 from .config import get_db_path, get_chroma_client
 
 
-def make_db(db_path):
+def make_db(db_path: str) -> None:
     db = Database(db_path)
 
     db["Channels"].create({
@@ -70,7 +70,7 @@ def make_db(db_path):
     )
 
 
-def add_channel_info(channel_id, channel_name, channel_url):
+def add_channel_info(channel_id: str, channel_name: str, channel_url: str) -> None:
     db = Database(get_db_path())
 
     db["Channels"].insert({
@@ -80,7 +80,7 @@ def add_channel_info(channel_id, channel_name, channel_url):
     })
 
 
-def add_video(channel_id, video_id, video_title, video_url, video_date):
+def add_video(channel_id: str, video_id: str, video_title: str, video_url: str, video_date: str) -> None:
     conn = sqlite3.connect(get_db_path())
     cur = conn.cursor()
     existing_video = cur.execute("SELECT * FROM Videos WHERE video_id = ?",
@@ -98,7 +98,7 @@ def add_video(channel_id, video_id, video_title, video_url, video_date):
     conn.close()
 
 
-def add_subtitle(video_id, start_time, text):
+def add_subtitle(video_id: str, start_time: str, text: str) -> None:
     db = Database(get_db_path())
 
     db["Subtitles"].insert({
@@ -108,27 +108,27 @@ def add_subtitle(video_id, start_time, text):
     })
 
 
-def get_channels():
+def get_channels() -> list[tuple[int, str, str, str]]:
     db = Database(get_db_path())
 
     return db.execute("SELECT ROWID, channel_id, channel_name, channel_url FROM Channels").fetchall()
 
 
-def escape_fts5_query(query):
+def escape_fts5_query(query: str) -> str:
     special_chars = ['"', '*', '(', ')', '-', '+']
     for char in special_chars:
         query = query.replace(char, f'"{char}"')
     return query
 
 
-def escape_fts5_term(term):
+def escape_fts5_term(term: str) -> str:
     special_chars = ['"', '*', '(', ')', '+', '-']
     for char in special_chars:
         term = term.replace(char, f'"{char}"')
     return f'"{term}"'
 
 
-def parse_query(query):
+def parse_query(query: str) -> str:
     terms = re.findall(r'"[^"]*"|\S+', query)
     parsed_query = []
     for term in terms:
@@ -139,7 +139,7 @@ def parse_query(query):
     return ' '.join(parsed_query)
 
 
-def search_channel(channel_id, text, limit=None):
+def search_channel(channel_id: str, text: str, limit: int | None = None) -> list[dict[str, int | str]]:
     conn = sqlite3.connect(get_db_path())
     curr = conn.cursor()
     
@@ -188,7 +188,7 @@ def search_channel(channel_id, text, limit=None):
     return formatted_res
 
 
-def search_video(video_id, text, limit=None):
+def search_video(video_id: str, text: str, limit: int | None = None) -> list[dict[str, int | str]]:
     try:
         conn = sqlite3.connect(get_db_path())
         curr = conn.cursor()
@@ -242,7 +242,7 @@ def search_video(video_id, text, limit=None):
         conn.close()
 
 
-def search_all(text, limit=None):
+def search_all(text: str, limit: int | None = None) -> list[dict[str, int | str]]:
     try:
         conn = sqlite3.connect(get_db_path())
         curr = conn.cursor()
@@ -298,27 +298,27 @@ def search_all(text, limit=None):
         conn.close()
 
 
-def get_title_from_db(video_id):
+def get_title_from_db(video_id: str) -> str:
     db = Database(get_db_path())
 
     return db.execute(f"SELECT video_title FROM Videos WHERE video_id = ?", [video_id]).fetchone()[0]
 
 
-def get_metadata_from_db(video_id):
+def get_metadata_from_db(video_id: str) -> dict[str, any]:
     db = Database(get_db_path())
 
     metadata = db.execute_returning_dicts(f"SELECT * FROM Videos WHERE video_id = ?", [video_id])[0]
     metadata["video_date"] = get_date(metadata["video_date"])
     return metadata
 
 
-def get_channel_name_from_id(channel_id):
+def get_channel_name_from_id(channel_id: str) -> str:
     db = Database(get_db_path())
 
     return db.execute(f"SELECT channel_name FROM Channels WHERE channel_id = ?", [channel_id]).fetchone()[0]
 
 
-def get_channel_name_from_video_id(video_id):
+def get_channel_name_from_video_id(video_id: str) -> str:
     db = Database(get_db_path())
 
     return db.execute(
@@ -327,7 +327,7 @@ def get_channel_name_from_video_id(video_id):
 
 
 # delete all videos, subtitles, and embeddings associated with channel
-def delete_channel(channel_id):
+def delete_channel(channel_id: str) -> None:
     from .utils import check_ss_enabled
 
     if check_ss_enabled(channel_id):
@@ -350,7 +350,7 @@ def delete_channel(channel_id):
     conn.close()
 
 
-def delete_channel_from_chroma(channel_id):
+def delete_channel_from_chroma(channel_id: str) -> None:
     chroma_client = get_chroma_client()
     collection = chroma_client.get_collection(name="subEmbeddings")
 
@@ -360,7 +360,7 @@ def delete_channel_from_chroma(channel_id):
     )
 
 
-def get_channel_id_from_rowid(rowid):
+def get_channel_id_from_rowid(rowid: str | int) -> str | None:
     db = Database(get_db_path())
 
     res = db.execute(f"SELECT channel_id FROM Channels WHERE ROWID = ?", [rowid]).fetchone()
@@ -371,7 +371,7 @@ def get_
```

---

### Incident Patch 9: `12338b41` (2025-07-04)
**Commit Message**: Add troubleshooting guide for 403 errors and enhance download diagnostics

- Introduced a new `diagnose` command to identify and troubleshoot 403 errors when accessing YouTube.
- Added detailed troubleshooting steps and recommendations in a new documentation file.
- Updated the download handler to improve error handling and retry logic for 403 and rate limiting issues.
- Enhanced the `.gitignore` file to include additional custom entries.

**File**: `.gitignore` (modified, +6/-1)
```diff
@@ -174,4 +174,9 @@ UCYO_jab_esuFRV4b17AJtAw
 .ignore/
 tests/test_data/
 .idea
-*.sh
\ No newline at end of file
+*.sh
+
+# custom
+
+scratch/
+.env
\ No newline at end of file
```

**File**: `docs/TROUBLESHOOTING_403.md` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+# Troubleshooting 403 Errors
+
+## What are 403 Errors?
+
+403 Forbidden errors occur when YouTube blocks requests from your application. This typically happens due to:
+
+- **Rate limiting**: Too many requests in a short time period
+- **Missing authentication**: No cookies or session data
+- **Bot detection**: YouTube identifying automated requests
+- **IP blocking**: Your IP address has been temporarily blocked
+- **Geographic restrictions**: Content not available in your region
+
+## Quick Diagnosis
+
+Run the built-in diagnosis tool to identify the issue:
+
+```bash
+# Basic diagnosis
+yt-fts diagnose
+
+# Diagnosis with browser cookies
+yt-fts diagnose --cookies-from-browser chrome
+
+# Diagnosis with specific job count
+yt-fts diagnose -j 4
+```
+
+## Common Solutions
+
+### 1. Use Browser Cookies
+
+The most effective solution is to use cookies from your browser:
+
+```bash
+# Use Chrome cookies
+yt-fts download --cookies-from-browser chrome <channel_url>
+
+# Use Firefox cookies
+yt-fts download --cookies-from-browser firefox <channel_url>
+```
+
+**How to set up cookies:**
+1. Log into YouTube in your browser (Chrome or Firefox)
+2. Make sure you're logged in and can access the channel
+3. Run the download command with `--cookies-from-browser`
+
+### 2. Reduce Parallel Jobs
+
+High parallel job counts can trigger rate limiting:
+
+```bash
+# Use fewer parallel jobs
+yt-fts download -j 2 <channel_url>
+yt-fts download -j 4 <channel_url>
+
+# For very problematic channels, use just 1 job
+yt-fts download -j 1 <channel_url>
+```
+
+### 3. Wait Between Attempts
+
+If you're getting rate limited, wait a few minutes before trying again:
+
+```bash
+# Wait 5-10 minutes between attempts
+# Then try again with reduced jobs
+yt-fts download -j 2 --cookies-from-browser chrome <channel_url>
+```
+
+### 4. Check Channel Accessibility
+
+Some channels may be:
+- **Private**: Only accessible to subscribers
+- **Age-restricted**: Requires login and age verification
+- **Region-blocked**: Not available in your country
+
+Try accessing the channel in your browser first to verify it's publicly accessible.
+
+## Advanced Troubleshooting
+
+### Test Network Connectivity
+
+```bash
+# Test basic connectivity
+curl -I https://www.youtube.com
+
+# Test with custom user agent
+curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" https://www.youtube.com
+```
+
+### Update yt-dlp
+
+Ensure you have the latest version of yt-dlp:
+
+```bash
+pip install --upgrade yt-dlp
+```
+
+### Check for VPN/Proxy Issues
+
+If you're using a VPN or proxy:
+1. Try disabling it temporarily
+2. Switch to a different server/location
+3. Use a residential IP if possible
+
+### Monitor Rate Limits
+
+Watch for these error patterns:
+- **429 Too Many Requests**: Immediate rate limit
+- **403 Forbidden**: General blocking
+- **503 Service Unavailable**: Temporary server issues
+
+## Error Message Reference
+
+| Error | Cause | Solution |
+|-------|-------|----------|
+| `403 Forbidden` | General blocking | Use cookies, reduce jobs |
+| `429 Too Many Requests` | Rate limiting | Wait, reduce jobs |
+| `Video unavailable` | Private/restricted | Check channel access |
+| `Sign in to confirm your age` | Age restriction | Use logged-in cookies |
+
+## Prevention Tips
+
+1. **Always use browser cookies** for consistent access
+2. **Start with low job counts** (2-4) and increase gradually
+3. **Monitor for errors** and adjust accordingly
+4. **Don't run multiple instances** simultaneously
+5. **Respect rate limits** - wait between large downloads
+
+## Getting Help
+
+If you're still experiencing issues:
+
+1. Run the diagnosis tool: `yt-fts diagnose`
+2. Check the error messages for specific details
+3. Try the test script: `python test_403_diagnosis.py`
+4. Report issues with:
+   - Error messages
+   - Channel URL (if public)
+   - Your configuration (jobs, cookies, etc.)
+   - Diagnosis output
+
+## Example Workflow
+
+```bash
+# 1. Diagnose the issue
+yt-fts diagnose --cookies-from-browser chrome
+
+# 2. Try with cookies and low job count
+yt-fts download --cookies-from-browser chrome -j 2 <channel_url>
+
+# 3. If successful, gradually increase jobs
+yt-fts download --cookies-from-browser chrome -j 4 <channel_url>
+
+# 4. For large channels, consider breaking into smaller batches
+# Download in chunks with breaks between them
+``` 
\ No newline at end of file
```

**File**: `yt_fts/download/download_handler.py` (modified, +212/-25)
```diff
@@ -197,19 +197,46 @@ def get_videos_list(self, channel_url: str) -> list[str]:
             ydl_opts = {
                 'extract_flat': True,
                 'quiet': True,
+                'nocheckcertificate': True,
+                'user_agent': 'random',
+                'sleep_interval': 1,
+                'max_sleep_interval': 3,
+                'retries': 3,
             }
 
-            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
-                info = ydl.extract_info(channel_url, download=False)
-                list_of_videos_urls = [entry['id'] for entry in info['entries']]
+            if self.cookies_from_browser is not None:
+                ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)
+
+            try:
+                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
+                    info = ydl.extract_info(channel_url, download=False)
+                    if info and 'entries' in info:
+                        list_of_videos_urls = [entry['id'] for entry in info['entries'] if entry]
+                    else:
+                        self.console.print("[red]Error: Could not extract video list from channel[/red]")
+                        return []
+            except Exception as e:
+                error_msg = str(e)
+                if "403" in error_msg or "Forbidden" in error_msg:
+                    self.console.print("[red]403 Forbidden error when scraping channel videos[/red]")
+                    self.console.print("[yellow]This might be due to:[/yellow]")
+                    self.console.print("  - Channel is private or restricted")
+                    self.console.print("  - YouTube is blocking automated access")
+                    self.console.print("  - Missing cookies (try --cookies-from-browser)")
+                    self.console.print("  - Rate limiting")
+                else:
+                    self.console.print(f"[red]Error scraping videos: {error_msg}[/red]")
+                return []
 
+            # Try to get streams as well
             streams_url = channel_url.replace("/videos", "/streams")
             try:
                 with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                     streams_info = ydl.extract_info(streams_url, download=False)
-                    live_stream_urls = [entry['id'] for entry in streams_info['entries']]
-                    if len(live_stream_urls) > 0:
-                        list_of_videos_urls.extend(live_stream_urls)
+                    if streams_info and 'entries' in streams_info:
+                        live_stream_urls = [entry['id'] for entry in streams_info['entries'] if entry]
+                        if len(live_stream_urls) > 0:
+                            list_of_videos_urls.extend(live_stream_urls)
             except Exception:
                 self.console.print("No streams found")
 
@@ -257,27 +284,92 @@ def quiet_progress_hook(self, d: dict) -> None:
             console.print(f" -> \"{file_name}\"")
 
     def get_vtt(self, tmp_dir: str, video_url: str, language: str) -> None:
-        try:
-            ydl_opts = {
-                'outtmpl': f'{tmp_dir}/%(id)s',
-                'writeinfojson': True,
-                'writeautomaticsub': True,
-                'subtitlesformat': 'vtt',
-                'skip_download': True,
-                'subtitleslangs': [language, '-live_chat'],
-                'quiet': True,
-                'no_warnings': True,
-                'progress_hooks': [self.quiet_progress_hook],
-            }
-
-            if self.cookies_from_browser is not None:
-                ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)
+        max_retries = 3
+        retry_delay = 2  # seconds
+        
+        for attempt in range(max_retries):
+            try:
+                ydl_opts = {
+                    'user_agent': 'random',
+                    'outtmpl': f'{tmp_dir}/%(id)s',
+                    'writeinfojson': True,
+                    'writeautomaticsub': True,
+                    'subtitlesformat': 'vtt',
+                    'skip_download': True,
+                    'subtitleslangs': [language, '-live_chat'],
+                    'quiet': True,
+                    'no_warnings': True,
+                    'progress_hooks': [self.quiet_progress_hook],
+                    # Additional options to help bypass restrictions
+                    'nocheckcertificate': True,
+                    'ignoreerrors': False,
+                    'no_color': True,
+                    # Add rate limiting
+                    'sleep_interval': 1,
+                    'max_sleep_interval': 5,
+                    # Add retry logic
+                    'retries': 3,
+                    'fragment_retries': 3,
+                    'skip_unavailable_fragments': True,
+                }
+
+                if self.cookies_from_browser is not None:
+                    ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser,)
 
-            with 
```

**File**: `yt_fts/yt_fts.py` (modified, +26/-0)
```diff
@@ -70,6 +70,32 @@ def download(url, playlist, language, jobs, cookies_from_browser):
     sys.exit(0)
 
 
+@cli.command(
+    name="diagnose",
+    help="""
+    Diagnose 403 errors and other download issues.
+    
+    This command will test various aspects of the connection to YouTube
+    and provide recommendations for fixing common issues.
+    """
+)
+@click.option("-u", "--test-url", default="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
+@click.option("--cookies-from-browser", default=None,
+              help="Browser to extract cookies from. Ex: chrome, firefox")
+@click.option("-j", "--jobs", type=int, default=8,
+              help="Number of parallel download jobs to test with")
+def diagnose(test_url, cookies_from_browser, jobs):
+    from yt_fts.download.download_handler import DownloadHandler
+    
+    download_handler = DownloadHandler(
+        number_of_jobs=jobs,
+        cookies_from_browser=cookies_from_browser
+    )
+    
+    download_handler.diagnose_403_errors(test_url)
+    sys.exit(0)
+
+
 @cli.command(
     name="list",
     help="""
```

---

### Incident Patch 10: `90756ce0` (2025-07-04)
**Commit Message**: Merge pull request #186 from NotJoeMartinez/fix_download_format_errors

- Fix download format errors
- bump yt-dlp version
- set default jobs to 8
- run update on existing channels instead of exiting with error
- new test to test update functionality

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ dependencies = [
     "rich==13.7.1",
     "sqlite-utils==3.36",
     "beautifulsoup4==4.12.3",
-    "yt-dlp==2024.7.16",
+    "yt-dlp==2025.6.30",
     "webvtt-py==0.5.1",
 ]
 
```

**File**: `tests/test_download.py` (modified, +45/-0)
```diff
@@ -121,6 +121,51 @@ def test_playlist_download(runner, capsys):
     assert subtitle_count >= min_sub_count, f"Expected >= {min_sub_count} subtitles, but got {subtitle_count}"
 
 
+def test_channel_update_on_duplicate(runner, capsys):
+    reset_testing_env()
+    
+    # Use the testing utility to fetch an outdated database
+    from testing_utils import fetch_and_unzip_test_db
+    fetch_and_unzip_test_db()
+    
+    # Get initial video count for a specific channel
+    curr = get_test_db()
+    channel_id = 'UCYwVxWpjeKFWwu8TML-Te9A'  # JCS channel
+    
+    res = curr.execute(f"""
+            select count(*) from
+            Videos where channel_id = '{channel_id}'
+    """)
+    initial_video_count = res.fetchone()[0]
+    
+    print(f"Initial video count: {initial_video_count}")
+    
+    # Try to download the same channel - should update instead of failing
+    results = runner.invoke(cli, [
+        'download',
+        '-j',
+        '8',
+        'https://www.youtube.com/@JCS'
+    ])
+    
+    assert results.exit_code == 0
+    
+    # Check that we get the "already exists, updating instead" message
+    output = results.output
+    assert "already exists in database. Updating instead" in output
+    
+    # Get final video count
+    res = curr.execute(f"""
+            select count(*) from
+            Videos where channel_id = '{channel_id}'
+    """)
+    final_video_count = res.fetchone()[0]
+    
+    print(f"Final video count: {final_video_count}")
+    
+    # The final count should be greater than or equal to the initial count
+    # (greater if new videos were found, equal if no new videos)
+    assert final_video_count >= initial_video_count, f"Expected final count ({final_video_count}) >= initial count ({initial_video_count})"
 
 
 if __name__ == "__main__":
```

**File**: `yt_fts/download.py` (modified, +14/-12)
```diff
@@ -22,15 +22,15 @@
     get_vid_ids_by_channel_id,
     get_channels
 )
-from .list import list_channels
+
 from .utils import parse_vtt, get_date, handle_reject_consent_cookie
 
 from rich.progress import track
 from rich.console import Console
 
 
 class DownloadHandler:
-    def __init__(self, number_of_jobs=1, language='en', cookies_from_browser=None):
+    def __init__(self, number_of_jobs=8, language='en', cookies_from_browser=None):
 
         self.console = Console()
 
@@ -39,7 +39,7 @@ def __init__(self, number_of_jobs=1, language='en', cookies_from_browser=None):
         self.language = language
 
         self.session = None
-        self.channl_id = None
+        self.channel_id = None
         self.channel_name = None
         self.video_ids = None
         self.tmp_dir = None
@@ -52,8 +52,9 @@ def download_channel(self, url):
         self.channel_name = self.get_channel_name(self.channel_id)
 
         if check_if_channel_exists(self.channel_id):
-            self.handle_channel_exists()
-            sys.exit(1)
+            self.console.print(f"[yellow]Channel '{self.channel_name}' already exists in database. Updating instead...[/yellow]")
+            self.update_channel(self.channel_id)
+            return
 
         with tempfile.TemporaryDirectory() as tmp_dir:
             self.tmp_dir = tmp_dir
@@ -97,7 +98,13 @@ def update_channel(self, target_channel):
 
         with tempfile.TemporaryDirectory() as tmp_dir:
             self.tmp_dir = tmp_dir
-            self.channel_id = get_channel_id_from_input(target_channel)
+            
+            # Handle both channel_id and target_channel (rowid/name)
+            if isinstance(target_channel, str) and len(target_channel) == 24:  # YouTube channel IDs are 24 chars
+                self.channel_id = target_channel
+            else:
+                self.channel_id = get_channel_id_from_input(target_channel)
+                
             channel_url = f"https://www.youtube.com/channel/{self.channel_id}/videos"
             self.session = self.init_session(channel_url)
             self.channel_name = self.get_channel_name(self.channel_id)
@@ -347,9 +354,4 @@ def validate_channel_url(self, channel_url):
         self.console.print("")
         sys.exit(1)
 
-    def handle_channel_exists(self):
-        list_channels(self.channel_id)
-        error = "[bold red]Error:[/bold red] Channel already exists in database."
-        error += " Use the \"update\" command to update the channel\n"
-        self.console.print(error)
-        sys.exit(1)
+
```

**File**: `yt_fts/yt_fts.py` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ def cli():
               help="Download all videos from a playlist")
 @click.option("-l", "--language", default="en",
               help="Language of the subtitles to download")
-@click.option("-j", "--jobs", type=int, default=1,
+@click.option("-j", "--jobs", type=int, default=8,
               help="Optional number of jobs to parallelize the run")
 @click.option("--cookies-from-browser", default=None,
               help="Browser to extract cookies from. Ex: chrome, firefox")
```

---

### Incident Patch 11: `6ef45a7d` (2025-07-04)
**Commit Message**: revert toml version check

**File**: `pyproject.toml` (modified, +0/-1)
```diff
@@ -29,7 +29,6 @@ dependencies = [
     "beautifulsoup4==4.12.3",
     "yt-dlp==2024.7.16",
     "webvtt-py==0.5.1",
-    "tomli>=2.0.0; python_version < '3.11'"
 ]
 
 [project.scripts]
```

**File**: `yt_fts/__init__.py` (modified, +1/-0)
```diff
@@ -0,0 +1 @@
+__version__ = "0.1.58"
\ No newline at end of file
```

**File**: `yt_fts/yt_fts.py` (modified, +1/-28)
```diff
@@ -22,37 +22,10 @@
     get_channel_name_from_id,
     delete_channel
 )
+from yt_fts import __version__ as YT_FTS_VERSION
 
-def get_version():
-    """Get version from pyproject.toml"""
-    try:
-        # Try tomllib first (Python 3.11+)
-        import tomllib
-    except ImportError:
-        # Fallback to tomli for older Python versions
-        try:
-            import tomli as tomllib
-        except ImportError:
-            # If neither is available, return a fallback version
-            return "0.1.57"
-    
-    try:
-        # Get the path to pyproject.toml (relative to this file)
-        current_dir = os.path.dirname(os.path.abspath(__file__))
-        project_root = os.path.dirname(current_dir)
-        pyproject_path = os.path.join(project_root, "pyproject.toml")
-        
-        with open(pyproject_path, "rb") as f:
-            data = tomllib.load(f)
-            return data["project"]["version"]
-    except (KeyError, FileNotFoundError, OSError):
-        # Fallback version if anything goes wrong
-        return "0.1.57"
-
-YT_FTS_VERSION = get_version()
 console = Console()
 
-
 @click.group(context_settings={"help_option_names": ["-h", "--help"]})
 @click.version_option(YT_FTS_VERSION, message='yt_fts version: %(version)s')
 def cli():
```

---

### Incident Patch 12: `5fbf3864` (2025-07-04)
**Commit Message**: fix deprecated github actions versions

**File**: `.github/workflows/publish.yml` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ jobs:
     - name: Build a binary wheel and a source tarball
       run: python3 -m build
     - name: Store the distribution packages
-      uses: actions/upload-artifact@v3
+      uses: actions/upload-artifact@v4
       with:
         name: python-package-distributions
         path: dist/
@@ -40,7 +40,7 @@ jobs:
       id-token: write  
     steps:
     - name: Download all the dists
-      uses: actions/download-artifact@v3
+      uses: actions/download-artifact@v4
       with:
         name: python-package-distributions
         path: dist/
@@ -60,7 +60,7 @@ jobs:
 
     steps:
     - name: Download all the dists
-      uses: actions/download-artifact@v3
+      uses: actions/download-artifact@v4
       with:
         name: python-package-distributions
         path: dist/
```

---

### Incident Patch 13: `bea7a0a7` (2025-07-04)
**Commit Message**: Merge pull request #185 from TobiX/fix-channel-name-extraction

Take channel name from RSS feed

**File**: `yt_fts/download.py` (modified, +6/-15)
```diff
@@ -10,6 +10,7 @@
 from concurrent.futures import ThreadPoolExecutor
 from bs4 import BeautifulSoup
 from urllib.parse import urlparse
+from xml.etree import ElementTree
 
 from .config import get_db_path
 from .db_utils import (
@@ -172,23 +173,13 @@ def get_channel_id(self, url):
     def get_channel_name(self, channel_id):
 
         session = self.session
-        res = session.get(f"https://www.youtube.com/channel/{channel_id}/videos")
+        res = session.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
 
         if res.status_code == 200:
-            html = res.text
-            soup = BeautifulSoup(html, 'html.parser')
-            script = soup.find('script', type='application/ld+json')
-
-            try:
-                with self.console.status("[bold green]Parsing JSON...") as status:
-                    data = json.loads(script.string)
-            except:
-                print("json parse failed retrying with escaped backslashes")
-                script = script.string.replace('\\', '\\\\')
-                data = json.loads(script)
-
-            channel_name = data['itemListElement'][0]['item']['name']
-            return channel_name
+            with self.console.status("[bold green]Parsing Feed...") as status:
+                tree = ElementTree.fromstring(res.content)
+                channel_name = tree.find('./{*}author/{*}name').text
+                return channel_name
         else:
             self.console.print("[red]Error:[/red] "
                                "couldn't get the channel name or channel doesn't exist")
```

---

### Incident Patch 14: `13cf5324` (2024-09-06)
**Commit Message**: fixed --cookies-from-browser example

**File**: `README.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ that request you to sign in. You can also run the `update` command several times
 
 ```bash
 yt-fts download --jobs 5 "https://www.youtube.com/@3blue1brown"
-yt-fts download --cookies-from-browser "https://www.youtube.com/@3blue1brown"
+yt-fts download --cookies-from-browser firefox "https://www.youtube.com/@3blue1brown"
 ```
 
 ## `list`
```

---

### Incident Patch 15: `0df6ced8` (2024-09-06)
**Commit Message**: quiet errors on download, update readme

**File**: `README.md` (modified, +29/-3)
```diff
@@ -8,6 +8,7 @@ It also supports semantic search via the [OpenAI embeddings API](https://beta.op
 
 - [Blog Post](https://notjoemartinez.com/blog/youtube_full_text_search/)
 - [LLM/RAG Chat Bot](#llm-chat-bot)
+- [Video Summaries](#summarize)
 - [Semantic Search](#vsearch-semantic-search)
 - [CHANGELOG](CHANGELOG.md)
 
@@ -24,8 +25,9 @@ pip install yt-fts
 ## `download`
 Download subtitles for a channel. 
 
-Takes a channel url as an argument. Specify the number of jobs to parallelize the download with the `--jobs` option. Use the `--cookies-from-browser` to use cookies from your browser in the requests, will help if you're 
-getting errors that request you to sign in.
+Takes a channel url as an argument. Specify the number of jobs to parallelize the download with the `--jobs` flag. 
+Use the `--cookies-from-browser` to use cookies from your browser in the requests, will help if you're getting errors 
+that request you to sign in. You can also run the `update` command several times to gradually get more videos into the database. 
 
 ```bash
 yt-fts download --jobs 5 "https://www.youtube.com/@3blue1brown"
@@ -124,10 +126,34 @@ to answer questions. If it can't answer your question, it has a
 mechanism to update the context by running targeted query based 
 off the conversation. The channel must have semantic search enabled.
 
-```sh
+```bash
 yt-fts llm --channel "3Blue1Brown" "How does back propagation work?"
 ```
 
+## `summarize`
+Summarizes a YouTube video transcript, providing time stamped URLS. 
+Requires a valid YouTube video URL or video ID as argument. If the 
+trancript is not in the database it will try to scrape it.
+
+```bash
+yt-fts summarize "https://www.youtube.com/watch?v=9-Jl0dxWQs8"
+# or
+yt-fts summarize "9-Jl0dxWQs8"
+```
+output:
+```
+In this video, 3Blue1Brown explores how large language models (LLMs) like GPT-3 
+might store facts within their vast...                                                         
+
+ 1 Introduction to Fact Storage in LLMs:                                                                                     
+    • The video starts by questioning how LLMs store specific facts and                                                      
+      introduces the idea that these facts might be stored in a particular part of the                                       
+      network known as multi-layer perceptrons (MLPs).                                                                       
+    • 0:00                                                                                                                   
+ 2 Overview of Transformers and MLPs:                                                                                        
+    • Provides a refresher on transformers and explains that the video will focus                                            
+```
+
 ## `vsearch` (Semantic Search)
 `vsearch` is for "Vector search". This requires that you enable semantic 
 search for a channel with `embeddings`. It has the same options as 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "yt-fts"
-version = "0.1.56"
+version = "0.1.57"
 description = "Search all of a YouTube channel from the command line"
 readme = "README.md"
 requires-python = ">=3.8"
```

**File**: `yt_fts/download.py` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@
 import json
 import requests
 
+from pathlib import Path
 from concurrent.futures import ThreadPoolExecutor
 from bs4 import BeautifulSoup
 from urllib.parse import urlparse
@@ -251,8 +252,10 @@ def download_vtts(self):
             futures[i].result()
 
     def quiet_progress_hook(self, d):
+        console = self.console
         if d['status'] == 'finished':
-            print(f" -> {d['filename']}")
+            file_name = Path(d['filename']).name
+            console.print(f" -> \"{file_name}\"")
 
     def get_vtt(self, tmp_dir, video_url, language):
         try:
@@ -264,6 +267,7 @@ def get_vtt(self, tmp_dir, video_url, language):
                 'skip_download': True,
                 'subtitleslangs': [language, '-live_chat'],
                 'quiet': True,
+                'no_warnings': True,
                 'progress_hooks': [self.quiet_progress_hook],
             }
 
```

**File**: `yt_fts/yt_fts.py` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     delete_channel
 )
 
-YT_FTS_VERSION = "0.1.56"
+YT_FTS_VERSION = "0.1.57"
 console = Console()
 
 
```

#### Recent Merged Pull Requests:
- **PR #191** (closed): Enable time window control on queries, add support for uv package manager and General Code Improvements (Human) (@abdurehmanasif)
- **PR #190** (2025-08-11): Add support for free Gemini embedding and chat models  (@ayoubdya)
- **PR #188** (2025-07-04): Fix download only one, randomize user agents (@NotJoeMartinez)
- **PR #187** (2025-07-04): Handle 403 errors with youtube (@NotJoeMartinez)
- **PR #186** (2025-07-04): Fix download format errors, bump yt-dlp version, set default jobs to 8 (@NotJoeMartinez)
- **PR #185** (2025-07-04): Take channel name from RSS feed (@TobiX)
- **PR #178** (2024-09-13): update changelog (@JonathanJdeKoning)
- **PR #176** (2024-09-06): V0.1.57 feature branch (@NotJoeMartinez)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
