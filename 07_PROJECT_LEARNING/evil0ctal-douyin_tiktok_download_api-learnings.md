# Forensic Learning Record (Deep Inspection): Evil0ctal/Douyin_TikTok_Download_API

> **Canonical Artifact**: `07_PROJECT_LEARNING/evil0ctal-douyin_tiktok_download_api-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:15:44.417Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Evil0ctal/Douyin_TikTok_Download_API`
- **Description**: 🚀 抖音、TikTok 数据采集与无水印视频下载 API，自托管，支持 MCP 调用与 Docker 一键部署。| Self-hosted TikTok & Douyin scraper and no-watermark video downloader — async REST API, MCP server, CLI and web console for posts, profiles, comments and playlists. Self-healing identity pool, PostgreSQL archive, one docker compose up. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 20473 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/downloader/queue.go`
```
package main

// The job queue: bounded, in memory, and deliberately forgetful.
//
// Durability lives in Postgres on the main service's side, which is the only
// place that knows what a download means. This process keeps just enough state
// to answer "how is job X going" while it is going, plus a short history so a
// poller that blinked can still collect the result. A restart loses the queue,
// and that is the correct trade: the main service re-submits, and the files
// already on disk are the part that had to survive.
//
// Bounded on purpose. An unbounded queue converts a burst of submissions into
// memory growth in the one container that also holds large buffers, and the
// whole reason this service is separate is that its overload must not become
// everyone else's.

import (
	"context"
	"errors"
	"log/slog"
	"sort"
	"sync"
	"time"
)

type jobState string

const (
	stateQueued    jobState = "queued"
	stateRunning   jobState = "running"
	stateDone      jobState = "done"
	statePartial   jobState = "partial"
	stateFailed    jobState = "failed"
	stateCancelled jobState = "cancelled"
)

func (s jobState) terminal() bool {
	return s == stateDone || s == statePartial || s == stateFailed || s == stateCancelled
}

// item is one file inside a job.
type item struct {
	Name        string   `json:"name"`
	Kind        string   `json:"kind"`
	Mirrors     []string `json:"mirrors"`
	Accept      []string `json:"accept"`
	MaxBytes    int64    `json:"max_bytes"`
	State       string   `json:"state"`
	Bytes       int64    `json:"bytes"`
	SHA256      string   `json:"sha256,omitempty"`
	ContentType string   `json:"content_type,omitempty"`
	Error       string   `json:"error,omitempty"`
}

// job is one content key's media, as submitted by the main service.
type job struct {
	ID         string     `json:"id"`
	Platform   string     `json:"platform"`
	AuthorUID  string     `json:"author_uid"`
	ContentID  string     `json:"content_id"`
	Directory  string     `json:"directory"`
	State      jobState   `json:"state"`
	Items      []*item    `json:"items"`
	Domains    []string   `json:"-"`
	UserAgent  string     `json:"-"`
	Referer    string     `json:"-"`
	BytesTotal int64      `json:"bytes_total"`
	Error      string     `json:"error,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`

	cancel context.CancelFunc
}

// snapshot copies a job for serialization while the manager lock is held.
//
// Handing the live pointer to a JSON encoder would race a worker writing item
// results into it, which is the kind of bug that shows up as a corrupt
// response once a week and never in a test.
func (j *job) snapshot() *job {
	clone := *j
	clone.cancel = nil
	clone.Items = make([]*item, 0, len(j.Items))
	for _, source := range j.Items {
		copied := *source
		clone.Items = append(clone.Items, &copied)
	}
	return &clone
}

var (
	errQueueFull = errors.New("the download queue is full")
	errNotFound  = errors.New("no such job")
)

type manager struct {
	mu      sync.Mutex
	jobs    map[string]*job
	order   []string
	queue   chan *job
	history int

	fetcher     *fetcher
	root        string
	itemWorkers int
	log         *slog.Logger
	wg          sync.WaitGroup
}

func newManager(root string, f *fetcher, queueSize, itemWorkers, history int, logger *slog.Logger) *manager {
	return &manager{
		jobs:        make(map[string]*job),
		queue:       make(chan *job, queueSize),
		history:     history,
		fetcher:     f,
		root:        root,
		itemWorkers: itemWorkers,
		log:         logger,
	}
}

func (m *manager) start(ctx context.Context, workers int) {
	for i := 0; i < workers; i++ {
		m.wg.Add(1)
		go func() {
			defer m.wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case queued, ok := <-m.queue:
					if !ok {
						return
					}
					m.run(ctx, queued)
				}
			}
		}()
	}
}

func (m *manager) wait() {
	m.wg.Wait()
}

// submit accepts a job, or refuses it because the queue is full.
//
// Refusing is the point. Accepting work this service cannot get to is how a
// caller learns nothing is wrong until the disk is full and every job is an
// hour old; a 429 lets the main service back off while it still can.
func (m *manager) submit(candidate *job) error {
	m.mu.Lock()
	if _, exists := m.jobs[candidate.ID]; exists {
		m.mu.Unlock()
		// Idempotent by id: the main service retries a submission it never saw
		// an answer to, and a retry must not download the same file twice.
		return nil
	}
	m.jobs[candidate.ID] = candidate
	m.order = append(m.order, candidate.ID)
	m.evictLocked()
	m.mu.Unlock()

	select {
	case m.queue <- candidate:
		return nil
	default:
		m.mu.Lock()
		delete(m.jobs, candidate.ID)
		m.dropOrderLocked(candidate.ID)
		m.mu.Unlock()
		return errQueueFull
	}
}

func (m *manager) get(id string) (*job, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	found, ok := m.jobs[id]
	if !ok {
		return nil, errNotFound
	}
	return found.snapshot(), nil
}

func (m *manager) list(limit int) []*job {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]*job, 0, len(m.order))
	for i := len(m.order) - 1; i >= 0; i-- {
		found, ok := m.jobs[m.order[i]]
		if !ok {
			continue
		}
		out = append(out, found.snapshot())
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].CreatedAt.After(out[b].CreatedAt) })
	return out
}

// cancel stops a job that is queued or running.
//
// A queued job is marked cancelled and skipped when a worker reaches it,
// rather than being pulled out of the channel: removing an element from the
// middle of a Go channel is not a thing, and a flag read at the moment of
// execution is both simpler and correct.
func (m *manager) cancel(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	found, ok := m.jobs[id]
	if !ok {
		return errNotFound
	}
	if found.State.terminal() {
		return nil
	}
	found.State = stateCancelled
	now := time.Now().UTC()
	found.FinishedAt = &now
	if found.cancel != nil {
		found.cancel()
	}
	return nil
}

func (m *manager) stats() (queued, running int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, found := range m.jobs {
		switch found.State {
		case stateQueued:
			queued++
		case stateRunning:
			running++
		}
	}
	return queued, running
}

func (m *manager) evictLocked() {
	if m.history <= 0 {
		return
	}
	for len(m.order) > m.history {
		oldest := m.order[0]
		if found, ok := m.jobs[oldest]; ok && !found.State.terminal() {
			// Never forget work still in flight; the cap is on history, not on
			// the queue, and dropping a running job would strand its poller.
			break
		}
		delete(m.jobs, oldest)
		m.order = m.order[1:]
	}
}

func (m *manager) dropOrderLocked(id string) {
	for index, candidate := range m.order {
		if candidate == id {
			m.order = append(m.order[:index], m.order[index+1:]...)
			return
		}
	}
}

// run executes one job: every item, concurrently, bounded.
func (m *manager) run(parent context.Context, current *job) {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	m.mu.Lock()
	if current.State == stateCancelled {
		m.mu.Unlock()
		return
	}
	now := time.Now().UTC()
	current.State = stateRunning
	current.StartedAt = &now
	current.cancel = cancel
	items := current.Items
	domains := current.Domains
	userAgent := current.UserAgent
	referer := current.Referer
	m.mu.Unlock()

	directory, err := safeJoin(m.root, current.Platform, current.AuthorUID, current.ContentID)
	if err != nil {
		m.finish(current, stateFailed, err.Error())
		return
	}

	slots := make(chan struct{}, max(1, m.itemWorkers))
	var group sync.WaitGroup
	for _, target := range items {
		group.Add(1)
		go func(current *item) {
			defer group.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			m.fetchItem(ctx, current, directory, domains, userAgent, referer)
		}(target)
	}
	group.Wait()

	if ctx.Err() != nil {
		m.finish(current, stateCancelled, "")
		return
	}
	m.settle(current)
}

func (m *manager) fetchItem(ctx context.Context, target *item, directory string, domains []string, userAgent, referer string) {
	destination, err := safeJoin(directory, target.Name)
	if err != nil {
		m.recordItem(target, "failed", 0, "", "", err.Error())
		return
	}
	result, err := m.fetcher.fetch(ctx, transferSpec{
		Mirrors:   target.Mirrors,
		Domains:   domains,
		Accept:    target.Accept,
		MaxBytes:  target.MaxBytes,
		Dest:      destination,
		UserAgent: userAgent,
		Referer:   referer,
	})
	if err != nil {
		m.log.Warn("item failed",
			"name", target.Name, "kind", target.Kind,
			"hosts", hostsOf(target.Mirrors), "error", err.Error())
		m.recordItem(target, "failed", 0, "", "", err.Error())
		return
	}
	m.log.Info("item stored",
		"name", target.Name, "kind", target.Kind,
		"host", result.Host, "bytes", result.Bytes)
	m.recordItem(target, "done", result.Bytes, result.SHA256, result.ContentType, "")
}

func (m *manager) recordItem(target *item, state string, bytes int64, sum, contentType, failure string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	target.State = state
	target.Bytes = bytes
	target.SHA256 = sum
	target.ContentType = contentType
	target.Error = failure
}

// settle decides the job's outcome from its items.
//
// "partial" is its own state rather than a success or a failure. A post whose
// video landed and whose third image 404'd is neither: reporting it as done
// hides a gap, and reporting it as failed hides a video that is on the disk.
func (m *manager) settle(current *job) {
	m.mu.Lock()
	var done, failed int
	var total int64
	for _, target := range current.Items {
		switch target.State {
		case "done":
			done++
			total += target.Bytes
		default:
			failed++
		}
	}
	current.BytesTotal = total
	m.mu.Unlock()

	switch {
	case failed == 0:
		m.finish(current, stateDone, "")
	case done == 0:
		m.finish(current, stateFailed, "every item failed")
	default:
		m.finish(current, statePartial, "")
	}
}

func (m *manager) finish(current *job, state 
```

### Core Architecture Module: `src/dtk/cli/worker.py`
```
"""``dtk worker`` - run the task worker process.

The loop itself, the pool filler, the proxy prober and the retention job all
live in :mod:`dtk.worker`; this is only the terminal entry point to the same
process the worker container runs as ``python -m dtk.worker``. Having one
implementation means a worker started by hand during an incident behaves
exactly like the one in the compose file, which is the entire point of being
able to start one by hand.

Deliberately without tuning flags. Concurrency, claim timeouts and the
background intervals belong to the process configuration, not to the invocation
- two workers on one machine disagreeing about their limits is a problem nobody
can see from the outside.
"""

from __future__ import annotations

import typer

from dtk.cli import output, runtime


def worker() -> None:
    """Run the task worker until it is stopped."""
    from dtk.worker.main import run

    settings = runtime.load_settings()
    try:
        runtime.run(lambda: run(settings))
    except KeyboardInterrupt:  # pragma: no cover - interactive only
        output.info("stopped")
        raise typer.Exit(output.EXIT_OK) from None


__all__ = ["worker"]

```

### Core Architecture Module: `src/dtk/core/config.py`
```
"""Two-layer configuration.

Bootstrap settings come from the environment because they are needed before the
database is reachable. Everything else is seeded from the environment once at
init, then lives in the ``settings`` table where it can be changed at runtime.

The master key is the reason two layers are unavoidable: it decrypts the
database, so it can never live inside it.

See docs/design/10-configuration.md.
"""

from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum
from typing import Any, Final, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from dtk.core.crypto import MIN_SECRET_LEN, SecretKeyMissing
from dtk.core.types import Platform


class Scope(StrEnum):
    """Where a setting may live and whether it can change without a restart."""

    BOOTSTRAP = "bootstrap"  # env only; needed before the DB exists
    ENV_ONLY = "env_only"  # env only; never persisted, never shown in the UI
    RUNTIME = "runtime"  # seeded from env, then DB-authoritative, hot reloadable
    SENSITIVE = "sensitive"  # runtime, but widening it enlarges the attack surface


class BootstrapSettings(BaseSettings):
    """Read once at process start. Changing any of these requires a restart."""

    model_config = SettingsConfigDict(
        env_prefix="DTK_", env_file=".env", extra="ignore", case_sensitive=False
    )

    secret_key: str = Field(default="", description="Master key for credential encryption")
    database_url: str = Field(default="postgresql+asyncpg://dtk:dtk@postgres:5432/dtk")
    redis_url: str = Field(default="redis://redis:6379/0")
    bind_host: str = "127.0.0.1"
    bind_port: int = 8000
    log_level: str = "info"
    log_json: bool = True
    #: Empty disables automatic minting; the pool then relies on manual imports.
    browser_rpc_url: str = ""
    #: Where backup archives are written and listed from. Both processes must
    #: agree: the worker writes them and the API serves them. The default is
    #: relative, which suits a checkout and the CLI; the container image is
    #: read-only, so it sets this to a mounted volume instead.
    backup_dir: str = "backups"
    #: Where the Go media downloader listens. Empty disables media downloads
    #: entirely, which is the correct state for a deployment that never starts
    #: the `downloader` compose profile - the archive is unaffected.
    downloader_url: str = ""
    #: Optional shared secret for that sidecar. It listens on an internal
    #: network no other container is on, so this is defence in depth rather
    #: than the boundary; empty means the sidecar checks nothing.
    downloader_token: str = ""

    @field_validator("secret_key")
    @classmethod
    def _require_secret(cls, v: str) -> str:
        if not v or len(v) < MIN_SECRET_LEN:
            raise SecretKeyMissing(
                f"DTK_SECRET_KEY must be set and at least {MIN_SECRET_LEN} characters. "
                "Generate one with: openssl rand -base64 48"
            )
        return v


class SettingSpec:
    """Declaration of one runtime setting."""

    __slots__ = ("choices", "default", "description", "key", "scope", "type_", "validate")

    def __init__(
        self,
        key: str,
        default: Any,
        scope: Scope,
        type_: type,
        description: str,
        choices: tuple[str, ...] | None = None,
        validate: Callable[[Any], Any] | None = None,
    ) -> None:
        self.key = key
        self.default = default
        self.scope = scope
        self.type_ = type_
        #: A note for whoever reads this file. The text a user reads comes from
        #: the catalogue key settings.description.<key> in both languages, so
        #: that adding a setting and translating it are one habit rather than
        #: two; this stays as the fallback for a setting nobody has written a
        #: catalogue entry for yet. tests/unit/test_i18n.py asserts the coverage.
        self.description = description
        #: Permitted values for a string setting, or None if it is free-form.
        #: Enforced on write, because a rejected value naming the valid ones is
        #: far more useful than a stored typo that silently falls back to the
        #: default every time it is read.
        self.choices = choices
        #: Checking the declared type cannot express, run after coercion. It
        #: returns the value to store, so it may canonicalize as well as refuse:
        #: a setting whose entries feed a security decision has to be pinned
        #: down at the boundary rather than re-guessed by every reader.
        self.validate = validate


def _url_allowlist(value: Any) -> list[str]:
    """Canonicalize security.url_allowlist, refusing anything it cannot mean.

    This list is the one setting that can widen an SSRF boundary, so it is
    pinned down here rather than interpreted by each reader: entries come back
    lowercased, deduplicated and sorted, and a hostname that names this machine
    or a private network is refused by name instead of stored and ignored.

    The import is local because :mod:`dtk.urls` is layered above
    :mod:`dtk.core`, and a settings write is far too rare to pay for the
    package at import time.
    """
    from dtk.urls.parse import sanitize_extra_hosts

    return sorted(sanitize_extra_hosts(value))


#: The runtime setting registry. Anything not listed here cannot be stored in
#: the settings table, which keeps a typo from silently becoming a config key.
def _percent(value: Any) -> int:
    """A percentage that is actually a percentage.

    Out of range is not a typo to normalise away: 0 would pause an instance the
    moment it starts, and 150 would mean the guard never fires at all - silently,
    which is the failure the capacity guard exists to prevent.
    """
    number = int(value)
    if not 1 <= number <= 99:
        raise ValueError("must be between 1 and 99")
    return number


def _byte_ceiling(value: Any) -> int:
    """A byte limit that is either off or big enough to be a limit.

    0 means "no ceiling" and is a deliberate choice an operator may make. A
    small positive number is not: 1000 bytes would refuse every real transfer,
    and it would do it as a per-file error rather than as anything resembling
    "your setting is wrong". One mebibyte is the floor.
    """
    number = int(value)
    if number < 0:
        raise ValueError("must not be negative")
    if 0 < number < 1024 * 1024:
        raise ValueError("must be 0 (unlimited) or at least 1 MiB")
    return number


#: What an unattended instance may fill by itself, chosen by the maintainer:
#: a self-hoster who leaves this running overnight would rather lose a few old
#: videos than a partition.
DEFAULT_MEDIA_CEILING: Final = 2 * 1024**3
#: One file. A long Douyin video measured 246 MB on 2026-09-08, so this is
#: roughly twice the largest thing normally encountered.
DEFAULT_MEDIA_FILE_CEILING: Final = 512 * 1024**2


def _pool_override(value: Any) -> int:
    """A per-platform pool mark: -1 to inherit the global one, else a count.

    -1 is spelled out rather than "any negative" so that a typo like -3 is
    refused instead of quietly meaning "inherit" - the operator who typed it
    meant something, and it was not that.
    """
    number = int(value)
    if number < -1:
        raise ValueError("must be -1 (use the global value) or a count of 0 or more")
    return number


def _pool_platform_settings() -> list[SettingSpec]:
    """``pool.<platform>.min_size`` / ``target_size`` for every platform.

    Generated from :class:`Platform` so a new platform gets its own marks the
    day it is added - and, because tests/unit/test_i18n.py wants a description
    for every key, cannot get them without someone writing what they mean.
    """
    return [
        SettingSpec(
            f"pool.{platform.value}.{field}",
            -1,
            Scope.RUNTIME,
            int,
            f"{platform.value} override of pool.{field}; -1 inherits it, "
            "min_size 0 turns automatic minting off for this platform",
            validate=_pool_override,
        )
        for platform in Platform
        for field in ("min_size", "target_size")
    ]


def _watch_floor(value: Any) -> int:
    """A collection interval floor that is actually a floor.

    Below a minute this stops being a schedule and becomes a loop: the entry
    would be re-queued before its previous run had finished, and the pool would
    spend itself on one target. Sixty seconds is already far more often than
    any real watch needs.
    """
    number = int(value)
    if number < 60:
        raise ValueError("must be at least 60 seconds")
    return number


#: Six hours. Often enough that a day's posts arrive in a few observations,
#: rare enough that a watchlist of a hundred authors is 400 requests a day.
DEFAULT_WATCH_INTERVAL: Final = 6 * 3600
#: Fifteen minutes. Nothing on either platform moves fast enough to need more,
#: and the floor is what stops a watchlist becoming a scraper.
DEFAULT_WATCH_FLOOR: Final = 900


RUNTIME_SETTINGS: dict[str, SettingSpec] = {
    s.key: s
    for s in [
        # --- scheduler -----------------------------------------------------
        SettingSpec(
            "sched.max_wait_seconds",
            10,
            Scope.RUNTIME,
            int,
            "How long a request waits for an identity before degrading to a task",
        ),
        SettingSpec("sched.queue_max", 500, Scope.RUNTIME, int, "Maximum queued requests"),
        SettingSpec(
            "sched.cooldown_base_seconds",
            60,
            Scope.RUNTIME,
            int,
            "First cooldown after a risk-control hit",
        ),
        SettingSpec(
            "sched.cooldown_max_seconds",
            21600,
            Scope.RUNTIME,
            int,
            "Cooldown ceiling before an identity is degraded",
        ),

```

### Core Architecture Module: `src/dtk/core/crypto.py`
```
"""Credential encryption at rest.

Cookies and proxy URLs are stored as AES-256-GCM ciphertext. The master key
never reaches the database: it decrypts the database, so storing it there would
be circular. See docs/design/08-security.md and docs/design/10-configuration.md.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NONCE_BYTES = 12
KEY_BYTES = 32
MIN_SECRET_LEN = 32


class SecretKeyMissing(RuntimeError):
    """Raised at startup when DTK_SECRET_KEY is absent or too short.

    The process must refuse to start rather than fall back to a default: an
    image that ships with a shared key is an image with no encryption at all.
    """


def derive_key(secret: str) -> bytes:
    if not secret or len(secret) < MIN_SECRET_LEN:
        raise SecretKeyMissing(
            f"DTK_SECRET_KEY must be at least {MIN_SECRET_LEN} characters; "
            "generate one with: openssl rand -base64 48"
        )
    return hashlib.sha256(secret.encode("utf-8")).digest()


class Cipher:
    """AES-256-GCM with the record id bound in as additional authenticated data.

    Binding the id prevents a ciphertext being moved between rows: a blob
    encrypted for identity A will not decrypt under identity B's id.
    """

    def __init__(self, secret: str) -> None:
        self._aead = AESGCM(derive_key(secret))

    def encrypt(self, plaintext: str, *, aad: str = "") -> bytes:
        nonce = os.urandom(NONCE_BYTES)
        blob = self._aead.encrypt(nonce, plaintext.encode("utf-8"), aad.encode("utf-8"))
        return nonce + blob

    def decrypt(self, payload: bytes, *, aad: str = "") -> str:
        if len(payload) <= NONCE_BYTES:
            raise ValueError("ciphertext too short")
        nonce, blob = payload[:NONCE_BYTES], payload[NONCE_BYTES:]
        return self._aead.decrypt(nonce, blob, aad.encode("utf-8")).decode("utf-8")


def new_api_key(prefix_bytes: int = 6, secret_bytes: int = 24) -> tuple[str, str, str]:
    """Return ``(full_key, prefix, sha256_hash)``.

    The full key is shown to the user exactly once. Only the prefix (for display)
    and the hash (for verification) are persisted.
    """
    prefix = secrets.token_hex(prefix_bytes)
    body = base64.urlsafe_b64encode(secrets.token_bytes(secret_bytes)).decode().rstrip("=")
    full = f"dtk_{prefix}_{body}"
    return full, prefix, hash_api_key(full)


def hash_api_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode("utf-8")).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def new_setup_token() -> str:
    return secrets.token_urlsafe(32)


__all__ = [
    "Cipher",
    "SecretKeyMissing",
    "constant_time_equals",
    "derive_key",
    "hash_api_key",
    "new_api_key",
    "new_setup_token",
]

```

### Core Architecture Module: `src/dtk/core/db.py`
```
"""Async SQLAlchemy engine and session management."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for every ORM model."""


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def init_engine(url: str, *, echo: bool = False, pool_size: int = 10) -> AsyncEngine:
    global _engine, _sessionmaker
    _engine = create_async_engine(
        url,
        echo=echo,
        pool_size=pool_size,
        max_overflow=pool_size * 2,
        pool_pre_ping=True,
        pool_recycle=1800,
    )
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _engine


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("engine not initialised; call init_engine() first")
    return _engine


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Transactional session. Commits on success, rolls back on any exception."""
    if _sessionmaker is None:
        raise RuntimeError("engine not initialised; call init_engine() first")
    async with _sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None


__all__ = ["Base", "dispose_engine", "get_engine", "init_engine", "session_scope"]

```

### Core Architecture Module: `src/dtk/core/errors.py`
```
"""Error codes and the exception hierarchy.

Error codes are a stable, machine-readable contract: append only, never rename.
Messages are localized at the boundary; codes never are.
See docs/design/11-data-contracts.md and docs/design/14-i18n.md.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    INVALID_URL = "INVALID_URL"
    UNSUPPORTED_CONTENT = "UNSUPPORTED_CONTENT"
    INVALID_PARAM = "INVALID_PARAM"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    FORBIDDEN_SCOPE = "FORBIDDEN_SCOPE"
    NOT_FOUND = "NOT_FOUND"
    CONTENT_PRIVATE = "CONTENT_PRIVATE"
    RATE_LIMITED = "RATE_LIMITED"
    IDENTITY_POOL_EXHAUSTED = "IDENTITY_POOL_EXHAUSTED"
    ENDPOINT_CIRCUIT_OPEN = "ENDPOINT_CIRCUIT_OPEN"
    UPSTREAM_RISK_CONTROL = "UPSTREAM_RISK_CONTROL"
    UPSTREAM_CHANGED = "UPSTREAM_CHANGED"
    SIGNING_FAILED = "SIGNING_FAILED"
    TASK_NOT_FOUND = "TASK_NOT_FOUND"
    SETUP_ALREADY_DONE = "SETUP_ALREADY_DONE"
    SETUP_TOKEN_INVALID = "SETUP_TOKEN_INVALID"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    QUEUE_FULL = "QUEUE_FULL"
    #: The media sidecar is running somewhere and did not answer. Distinct from
    #: NOT_CONFIGURED, which means this deployment never had one: that is a
    #: permanent property of the install and this is a service that is down, and
    #: the two want opposite things from the caller.
    DOWNLOADER_UNAVAILABLE = "DOWNLOADER_UNAVAILABLE"
    #: The work was given up on deliberately - a task cancelled by its caller.
    #: Its own code because it used to be reported as INVALID_PARAM, which told
    #: the caller their perfectly valid request was malformed, and which is in
    #: NON_RETRYABLE - so an agent reading the result learned never to try that
    #: URL again.
    CANCELLED = "CANCELLED"
    #: The method is not allowed on this path. Answered by the framework, and
    #: previously laundered into INTERNAL, whose own contract tells the caller
    #: to file a bug quoting a request id that is never logged.
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
    #: The request body arrived in a media type this endpoint does not read.
    UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE"
    INTERNAL = "INTERNAL"


#: HTTP status for each code. Kept beside the enum so the API layer never
#: invents its own mapping.
HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.INVALID_URL: 400,
    ErrorCode.UNSUPPORTED_CONTENT: 400,
    ErrorCode.INVALID_PARAM: 400,
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.FORBIDDEN_SCOPE: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.CONTENT_PRIVATE: 403,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.IDENTITY_POOL_EXHAUSTED: 503,
    ErrorCode.ENDPOINT_CIRCUIT_OPEN: 503,
    ErrorCode.UPSTREAM_RISK_CONTROL: 502,
    ErrorCode.UPSTREAM_CHANGED: 502,
    ErrorCode.SIGNING_FAILED: 502,
    ErrorCode.TASK_NOT_FOUND: 404,
    ErrorCode.SETUP_ALREADY_DONE: 409,
    ErrorCode.SETUP_TOKEN_INVALID: 403,
    ErrorCode.NOT_CONFIGURED: 501,
    ErrorCode.QUEUE_FULL: 503,
    ErrorCode.DOWNLOADER_UNAVAILABLE: 503,
    ErrorCode.CANCELLED: 409,
    ErrorCode.METHOD_NOT_ALLOWED: 405,
    ErrorCode.UNSUPPORTED_MEDIA_TYPE: 415,
    ErrorCode.INTERNAL: 500,
}

#: Codes a caller should never retry. Surfaced in docs and in MCP tool errors so
#: an agent does not burn its budget looping on a permanent failure.
NON_RETRYABLE: frozenset[ErrorCode] = frozenset(
    {
        ErrorCode.INVALID_URL,
        ErrorCode.UNSUPPORTED_CONTENT,
        ErrorCode.INVALID_PARAM,
        ErrorCode.UNAUTHENTICATED,
        ErrorCode.FORBIDDEN_SCOPE,
        ErrorCode.NOT_FOUND,
        ErrorCode.CONTENT_PRIVATE,
        ErrorCode.UPSTREAM_CHANGED,
        ErrorCode.SETUP_ALREADY_DONE,
        ErrorCode.SETUP_TOKEN_INVALID,
        # Somebody decided to stop this. Retrying is not a fix, it is ignoring
        # them.
        ErrorCode.CANCELLED,
        # A different method might work; this one never will.
        ErrorCode.METHOD_NOT_ALLOWED,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
        # A capability this deployment simply does not have. Retrying is
        # never the answer: no amount of waiting installs a browser
        # container or writes an alert channel into the settings.
        ErrorCode.NOT_CONFIGURED,
    }
)


class DtkError(Exception):
    """Base for every error that maps onto the API envelope."""

    code: ErrorCode = ErrorCode.INTERNAL

    def __init__(
        self,
        message: str | None = None,
        *,
        retry_after: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.code.value)
        self.raw_message = message
        self.retry_after = retry_after
        self.details = details or {}

    @property
    def http_status(self) -> int:
        return HTTP_STATUS[self.code]

    @property
    def retryable(self) -> bool:
        return self.code not in NON_RETRYABLE

    def format_args(self) -> dict[str, Any]:
        """Values interpolated into the localized message template."""
        args: dict[str, Any] = dict(self.details)
        if self.retry_after is not None:
            args["retry_after"] = self.retry_after
        return args


def _err(name: str, code: ErrorCode) -> type[DtkError]:
    return type(name, (DtkError,), {"code": code})


InvalidUrl = _err("InvalidUrl", ErrorCode.INVALID_URL)
UnsupportedContent = _err("UnsupportedContent", ErrorCode.UNSUPPORTED_CONTENT)
InvalidParam = _err("InvalidParam", ErrorCode.INVALID_PARAM)
Unauthenticated = _err("Unauthenticated", ErrorCode.UNAUTHENTICATED)
ForbiddenScope = _err("ForbiddenScope", ErrorCode.FORBIDDEN_SCOPE)
NotFound = _err("NotFound", ErrorCode.NOT_FOUND)
ContentPrivate = _err("ContentPrivate", ErrorCode.CONTENT_PRIVATE)
RateLimited = _err("RateLimited", ErrorCode.RATE_LIMITED)
IdentityPoolExhausted = _err("IdentityPoolExhausted", ErrorCode.IDENTITY_POOL_EXHAUSTED)
EndpointCircuitOpen = _err("EndpointCircuitOpen", ErrorCode.ENDPOINT_CIRCUIT_OPEN)
UpstreamRiskControl = _err("UpstreamRiskControl", ErrorCode.UPSTREAM_RISK_CONTROL)
SigningFailed = _err("SigningFailed", ErrorCode.SIGNING_FAILED)
TaskNotFound = _err("TaskNotFound", ErrorCode.TASK_NOT_FOUND)
SetupAlreadyDone = _err("SetupAlreadyDone", ErrorCode.SETUP_ALREADY_DONE)
SetupTokenInvalid = _err("SetupTokenInvalid", ErrorCode.SETUP_TOKEN_INVALID)
Internal = _err("Internal", ErrorCode.INTERNAL)
#: An optional component was never set up. Distinct from Internal, which
#: promises the caller that trying again might work.
NotConfigured = _err("NotConfigured", ErrorCode.NOT_CONFIGURED)
#: The task queue is at its configured ceiling. Retryable by design: the
#: caller is told when to come back rather than being queued behind work
#: that will not finish in time to matter.
QueueFull = _err("QueueFull", ErrorCode.QUEUE_FULL)
DownloaderDown = _err("DownloaderDown", ErrorCode.DOWNLOADER_UNAVAILABLE)
#: Given up on deliberately, by whoever asked for it.
Cancelled = _err("Cancelled", ErrorCode.CANCELLED)


class UpstreamChanged(DtkError):
    """The platform response no longer matches what the parser expects.

    Carries the field path that went missing so the bug report is actionable.
    Parsers must raise this instead of silently returning a half-filled model.
    """

    code = ErrorCode.UPSTREAM_CHANGED

    def __init__(self, path: str, *, platform: str | None = None) -> None:
        super().__init__(f"missing or unexpected field: {path}", details={"path": path})
        self.path = path
        self.platform = platform


__all__ = [
    "HTTP_STATUS",
    "NON_RETRYABLE",
    "Cancelled",
    "ContentPrivate",
    "DtkError",
    "EndpointCircuitOpen",
    "ErrorCode",
    "ForbiddenScope",
    "IdentityPoolExhausted",
    "Internal",
    "InvalidParam",
    "InvalidUrl",
    "NotConfigured",
    "NotFound",
    "QueueFull",
    "RateLimited",
    "SetupAlreadyDone",
    "SetupTokenInvalid",
    "SigningFailed",
    "TaskNotFound",
    "Unauthenticated",
    "UnsupportedContent",
    "UpstreamChanged",
    "UpstreamRiskControl",
]

```

### Core Architecture Module: `src/dtk/core/logging.py`
```
"""Structured logging with mandatory redaction.

Log messages are English only and event names are dotted identifiers, never
sentences: that keeps grep stable, keeps aggregation by event type possible, and
sidesteps the question of translating logs entirely. See docs/design/14-i18n.md.

Redaction happens in the processor chain rather than at call sites, because a
call site that forgets is exactly how V4 leaked a live session cookie.
"""

from __future__ import annotations

import logging
import re
import sys
from collections.abc import MutableMapping
from typing import Any, Final

import structlog

#: Keys whose values are replaced wholesale.
SENSITIVE_KEYS = frozenset(
    {
        "cookie",
        "cookies",
        "set-cookie",
        "set_cookie",
        "authorization",
        "x-api-key",
        "api_key",
        "apikey",
        "password",
        "secret",
        "token",
        "setup_token",
        "proxy_url",
        "dtk_secret_key",
    }
)

#: Signature and session parameters truncated inside URLs and free text.
_PARAM_RE = re.compile(
    r"\b(msToken|a_bogus|X-Bogus|X-Dynosaur|X-Gnarly|_signature|sessionid|sid_guard|odin_tt"
    r"|uid_tt|ttwid)"
    r"=([^&\s;\"']{6,})",
    re.IGNORECASE,
)
_MASK = "[REDACTED]"


def _truncate_params(text: str) -> str:
    return _PARAM_RE.sub(lambda m: f"{m.group(1)}={m.group(2)[:6]}...", text)


def redact(_logger: Any, _name: str, event: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    for key in list(event.keys()):
        if key.lower() in SENSITIVE_KEYS:
            event[key] = _MASK
        elif isinstance(event[key], str):
            event[key] = _truncate_params(event[key])
    return event


#: Third-party loggers pinned quieter than the application's own level.
#:
#: httpx logs every request line at INFO, URL and all. That is a leak, not just
#: noise: a caller-supplied ``callback_url`` routinely carries a token in its
#: query string, and a signed CDN link carries a signature - neither belongs in
#: an operator's log or in whatever aggregates it. Everything those lines say is
#: already in this project's own `transport.request.done`, with the URL masked.
QUIET_LOGGERS: Final[tuple[str, ...]] = ("httpx", "httpcore", "hpack")


def configure(level: str = "info", json_output: bool = True) -> None:
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=getattr(logging, level.upper(), 20)
    )
    for name in QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    renderer: Any = (
        structlog.processors.JSONRenderer()
        if json_output
        else structlog.dev.ConsoleRenderer(colors=True)
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level.upper(), 20)),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    return structlog.get_logger(name)


__all__ = ["QUIET_LOGGERS", "SENSITIVE_KEYS", "configure", "get_logger", "redact"]

```

### Core Architecture Module: `src/dtk/core/redis.py`
```
"""Redis connection and Lua script registry.

Redis carries three kinds of state: the task queue, scheduler token buckets and
inflight locks, and the response cache. Scheduler state is manipulated through
registered Lua scripts so that check-and-take is atomic; see
docs/design/03-scheduler.md.
"""

from __future__ import annotations

from typing import Any

from redis.asyncio import BlockingConnectionPool, Redis
from redis.commands.core import AsyncScript

_client: Redis | None = None
_scripts: dict[str, AsyncScript] = {}


#: Longest a blocking Redis command in this codebase waits, plus room.
#:
#: redis-py 8 changed the default socket_timeout from None to 5 seconds, which
#: is exactly what ``tasks.claim`` passes to BLPOP. The read then times out at
#: the same instant the command is due to return empty, so every idle poll
#: raised instead of returning None: the worker logged "Timeout reading from
#: redis" every few seconds and picked tasks up late. The socket has to be
#: allowed to outlast the command it is carrying, and the value is set here
#: rather than inherited so the next library default cannot move it back.
SOCKET_TIMEOUT_SECONDS: float = 30.0


def init_redis(
    url: str,
    *,
    max_connections: int = 64,
    pool_timeout: float = 10.0,
    socket_timeout: float = SOCKET_TIMEOUT_SECONDS,
) -> Redis:
    """Create the shared client.

    A blocking pool is used deliberately. The default pool raises
    ``MaxConnectionsError`` the moment it is exhausted, which turns a burst of
    concurrent scheduling into hard failures rather than brief waits - the
    opposite of what backpressure should do.
    """
    global _client
    pool: BlockingConnectionPool = BlockingConnectionPool.from_url(
        url,
        max_connections=max_connections,
        timeout=pool_timeout,
        socket_timeout=socket_timeout,
        decode_responses=True,
        health_check_interval=30,
    )
    _client = Redis(connection_pool=pool)
    _scripts.clear()
    return _client


def get_redis() -> Redis:
    if _client is None:
        raise RuntimeError("redis not initialised; call init_redis() first")
    return _client


def register_script(name: str, source: str) -> AsyncScript:
    """Register a Lua script once and reuse its SHA on later calls."""
    if name not in _scripts:
        _scripts[name] = get_redis().register_script(source)
    return _scripts[name]


async def run_script(name: str, source: str, keys: list[str], args: list[Any]) -> Any:
    return await register_script(name, source)(keys=keys, args=args)


async def close_redis() -> None:
    global _client
    if _client is not None:
        # redis-py renamed close() to aclose() in 5.x; the bundled type stubs
        # still describe the old name, so this is resolved at runtime.
        await _client.aclose()  # type: ignore[attr-defined]
    _client = None
    _scripts.clear()


__all__ = [
    "SOCKET_TIMEOUT_SECONDS",
    "close_redis",
    "get_redis",
    "init_redis",
    "register_script",
    "run_script",
]

```

### Core Architecture Module: `src/dtk/core/types.py`
```
"""Shared enumerations.

These values are machine-readable identifiers. They are never translated and
never renamed once released; see docs/design/14-i18n.md.
"""

from __future__ import annotations

from enum import StrEnum


class Platform(StrEnum):
    DOUYIN = "douyin"
    TIKTOK = "tiktok"


class ContentKind(StrEnum):
    VIDEO = "video"
    IMAGE_ALBUM = "image_album"
    LIVE = "live"


class DownloadState(StrEnum):
    """Where one media download stands.

    Wider than :class:`TaskState`: a download of a post with several files can
    land some and lose others, which is neither done nor failed.
    """

    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Availability(StrEnum):
    """Whether the archived post is still reachable upstream.

    ``UNKNOWN`` is what a failed check leaves behind. It is deliberately not
    ``DELETED``: an archive that quietly reclassifies posts on a network blip
    would be worse than one that admits it does not know.
    """

    LIVE = "live"
    DELETED = "deleted"
    PRIVATE = "private"
    UNKNOWN = "unknown"


class DurationBucket(StrEnum):
    """Coarse length classes, from ``archive.duration_bucket``."""

    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"
    UNKNOWN = "unknown"


class WatchKind(StrEnum):
    """What a watchlist entry follows."""

    AUTHOR = "author"
    CONTENT = "content"


class Outcome(StrEnum):
    """Classification of a single upstream request.

    The split between BUSINESS_ERROR and RISK_CONTROL is load bearing: a deleted
    video must never be counted against an identity's health.
    """

    OK = "ok"
    BUSINESS_ERROR = "business_error"
    RISK_CONTROL = "risk_control"
    NETWORK_ERROR = "network_error"


class IdentityState(StrEnum):
    MINTING = "minting"
    ACTIVE = "active"
    COOLING = "cooling"
    DEGRADED = "degraded"
    RETIRED = "retired"


class IdentitySource(StrEnum):
    MINTED = "minted"
    IMPORTED = "imported"


class BrowserFamily(StrEnum):
    CHROME = "chrome"
    FIREFOX = "firefox"
    SAFARI = "safari"


class TaskState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class UserRole(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"
    #: The public account on a demo deployment, and the lowest rank there is.
    #:
    #: It exists because "let strangers look at the console" and "let a colleague
    #: read the console" are different asks that VIEWER cannot both serve: a
    #: viewer reads the identity pool, the proxies, the API keys and the
    #: settings, which on a machine anybody can log into is the whole instance.
    #:
    #: Ranking it *below* viewer rather than beside it is what makes that safe.
    #: Every existing gate is written as "viewer or better", so a role added
    #: underneath is refused by all of them without a single call site being
    #: touched, and reaching a page becomes something a route has to opt into
    #: rather than something it has to remember to forbid. See
    #: :data:`dtk.api.routes.support.ROLE_RANK`.
    #:
    #: The role is inert unless ``demo.enabled`` is on: both the login and the
    #: credential lookup refuse it otherwise, so turning the setting off is
    #: enough to end public access without deleting anything.
    DEMO = "demo"


class RejectReason(StrEnum):
    """Why the scheduler refused to issue a lease. Recorded in request_log."""

    CIRCUIT_OPEN = "circuit_open"
    NO_IDENTITY = "no_identity"
    NO_TOKEN = "no_token"
    ALL_INFLIGHT = "all_inflight"
    #: A caller named an identity that cannot serve the request at all - it is
    #: retired, still minting, or belongs to another platform. Distinct from
    #: NO_IDENTITY because the pool is fine and only this request is refused.
    PINNED_UNAVAILABLE = "pinned_unavailable"
    QUEUE_FULL = "queue_full"
    WAIT_TIMEOUT = "wait_timeout"


class Scope(StrEnum):
    """API key scopes."""

    DOUYIN_READ = "douyin:read"
    TIKTOK_READ = "tiktok:read"
    IDENTITY_MANAGE = "identity:manage"
    #: Read what this instance has already stored. Separate from the platform
    #: read scopes on purpose: an operator may open a platform endpoint to
    #: unauthenticated callers, and "read douyin" must not thereby become "read
    #: everything this instance has ever collected".
    ARCHIVE_READ = "archive:read"
    #: Walk the whole archive in one request. Its own scope because a bulk
    #: export is the single call that turns a read key into a copy of the
    #: database.
    ARCHIVE_EXPORT = "archive:export"
    #: See what media this instance has stored on its own disk.
    MEDIA_READ = "media:read"
    #: Start a download, and pin or cancel one. Separate from `media:read`
    #: because starting one spends an identity, fills a disk and is the only
    #: read-shaped call in this API with a lasting side effect on the host.
    MEDIA_WRITE = "media:write"
    ADMIN = "admin"


class Language(StrEnum):
    EN = "en"
    ZH = "zh"


DEFAULT_LANGUAGE = Language.EN

```

### Core Architecture Module: `src/dtk/ops/webhooks.py`
```
"""Delivering the task callback this API has been accepting and dropping.

``callback_url`` was declared in the request schema, validated carefully by
:func:`dtk.api.routes.support.validate_callback_url` - https only, private
ranges refused, gated behind a setting - and stored on the task. Then nothing
ever sent anything to it. Doc 06 promises webhooks; the repository contained no
line that made an outbound request to that address. An endpoint that accepts a
parameter and silently ignores it is the hardest kind of API defect to
diagnose, because everything the caller can see says it worked.

Two properties shape what is here.

**It is an outbound request to an address the caller chose**, which is an SSRF
primitive by construction. The URL is vetted at submission and vetted again
here - the setting can be turned off, and a stored task can outlive the moment
it was accepted - and the resolved address is checked at dial time, because a
hostname that passed validation an hour ago may resolve somewhere else now.

**Delivery must never affect the task.** The caller asked for data and got it;
a webhook endpoint that is down, slow or hostile cannot be allowed to turn a
successful fetch into a failure, or to hold a worker while it times out. So
every failure here is logged and swallowed, and the whole thing is bounded by a
short timeout and a small number of attempts.

The payload is deliberately small: what happened, not what was found. A result
can be megabytes, the receiving end usually wants to know it can now collect
it, and posting the whole thing to a third party is a data-flow decision no
caller made explicitly by writing a URL in a query string.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final
from urllib.parse import urlsplit

import httpx

from dtk.core.logging import get_logger
from dtk.urls.parse import is_private_host

log = get_logger(__name__)

#: One delivery attempt. Short: nobody is waiting on it, but a worker slot is.
TIMEOUT_SECONDS: Final = 10.0

#: Attempts, including the first. Three is enough to ride out a restart on the
#: receiving end and few enough that a black hole costs half a minute, not more.
MAX_ATTEMPTS: Final = 3

#: Backoff between attempts.
RETRY_DELAYS: Final[tuple[float, ...]] = (2.0, 8.0)

#: Header carrying the HMAC of the body, when a signing secret is configured.
SIGNATURE_HEADER: Final = "X-Dtk-Signature"
#: Header naming the event, so a receiver can route without parsing the body.
EVENT_HEADER: Final = "X-Dtk-Event"


@dataclass(frozen=True, slots=True)
class Delivery:
    """What one attempt at delivery came to. Never raised, only logged."""

    delivered: bool
    attempts: int = 0
    status: int | None = None
    detail: str = ""


def payload_for(
    task_id: str,
    *,
    endpoint: str,
    state: str,
    error: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The notification body.

    What happened, not what was found. A result can be megabytes; the receiver
    almost always wants to know it can now collect it, and posting the whole
    payload to a third party is a data-flow decision nobody made by writing a
    URL into a query string. The error is included because it is small, and
    because "it failed" without a reason means another round trip.
    """
    body: dict[str, Any] = {
        "event": "task.completed" if not error else "task.failed",
        "task_id": task_id,
        "endpoint": endpoint,
        "state": state,
        "sent_at": datetime.now(UTC).isoformat(),
    }
    if error:
        body["error"] = {
            "code": str(error.get("code") or "INTERNAL"),
            "message": str(error.get("message") or "")[:500],
        }
    return body


def sign(body: bytes, secret: str) -> str:
    """``sha256=<hex>`` over the exact bytes sent.

    Over the bytes rather than over a re-serialization of the object, because
    a receiver can only verify what actually arrived - any difference in key
    order or separators would make an otherwise correct check fail.
    """
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _client() -> httpx.AsyncClient:
    """A client that verifies certificates and does not follow redirects.

    Both matter here. Redirects are off because a 302 is an instruction from
    the destination to visit somewhere else, and this request already goes to
    an address the caller chose - following one would hand that choice to the
    receiver as well.

    Certificate verification is the answer to DNS rebinding, and it is a better
    one than a dial-time address check would be. `recheck` resolves the name and
    refuses any private answer, but a name can resolve differently a moment
    later; what a rebinding attacker cannot do is present a valid certificate
    for the hostname they told us to visit. Callbacks are https-only for exactly
    this reason, and that is enforced at submission and again below.
    """
    return httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False, verify=True)


async def recheck(url: str) -> str | None:
    """Re-validate a stored callback URL. Returns a refusal, or ``None``.

    Checked again at delivery rather than trusted from submission: the setting
    can be turned off between the two, and a queued task can outlive the moment
    it was accepted.

    The resolution check narrows the rebinding window rather than closing it -
    the name is resolved again by the HTTP client a moment later. What closes
    it is that callbacks are https and certificates are verified: an address
    that answers on loopback cannot produce a valid certificate for the
    caller's hostname.
    """
    try:
        parts = urlsplit(url)
    except ValueError:
        return "unparseable callback_url"
    if parts.scheme != "https":
        return "callback_url must be https"
    if not parts.hostname:
        return "callback_url has no host"
    if is_private_host(parts.hostname):
        return "callback_url points at a private or loopback address"
    try:
        # The loop's own resolver, not socket.getaddrinfo: that one blocks, and
        # a worker running four tasks concurrently would stall all of them on
        # one slow lookup for a webhook nobody is waiting on.
        infos = await asyncio.get_running_loop().getaddrinfo(parts.hostname, None)
    except OSError as exc:
        return f"callback_url does not resolve: {exc}"
    for info in infos:
        if is_private_host(str(info[4][0])):
            # Rebinding, or simply a name that points inside. Either way it is
            # not somewhere this service may be made to post.
            return "callback_url resolves to a private address"
    return None


async def deliver(
    url: str,
    body: dict[str, Any],
    *,
    secret: str = "",
    client: httpx.AsyncClient | None = None,
) -> Delivery:
    """POST one notification, retrying a few times. Never raises.

    Never raising is the contract, not an implementation detail: the caller
    already has its data, and a webhook endpoint that is down must not be able
    to turn a successful fetch into a failed task.
    """
    refusal = await recheck(url)
    if refusal:
        log.warning("webhook.refused", reason=refusal)
        return Delivery(delivered=False, detail=refusal)

    encoded = json.dumps(body, ensure_ascii=False).encode()
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        EVENT_HEADER: str(body.get("event") or "task.completed"),
        "User-Agent": "dtk-webhook/1",
    }
    if secret:
        headers[SIGNATURE_HEADER] = sign(encoded, secret)

    owned = client is None
    http = client or _client()
    last = ""
    try:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = await http.post(url, content=encoded, headers=headers)
            except httpx.HTTPError as exc:
                last = f"{type(exc).__name__}: {exc}"[:200]
            else:
                if 200 <= response.status_code < 300:
                    log.info(
                        "webhook.delivered",
                        # The host, never the full URL: a callback URL commonly
                        # carries a token in its path or query.
                        host=urlsplit(url).hostname,
                        status=response.status_code,
                        attempts=attempt,
                    )
                    return Delivery(delivered=True, attempts=attempt, status=response.status_code)
                last = f"HTTP {response.status_code}"
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    # The receiver understood and refused. Retrying a 404 or a
                    # 401 just repeats the same rejection.
                    break
            if attempt <= len(RETRY_DELAYS):
                await asyncio.sleep(RETRY_DELAYS[attempt - 1])
    finally:
        if owned:
            await http.aclose()

    log.warning("webhook.undelivered", host=urlsplit(url).hostname, detail=last)
    return Delivery(delivered=False, attempts=MAX_ATTEMPTS, detail=last)


__all__ = [
    "EVENT_HEADER",
    "MAX_ATTEMPTS",
    "SIGNATURE_HEADER",
    "TIMEOUT_SECONDS",
    "Delivery",
    "deliver",
    "payload_for",
    "recheck",
    "sign",
]

```

### Core Architecture Module: `src/dtk/worker/__init__.py`
```
"""The worker process: the task loop and the background loops around it.

``main`` runs queued tasks; ``pool_filler``, ``proxy_prober`` and
``maintenance`` keep the identity pool, the egresses and the stored data in
shape while it does. ``registry`` is the shared endpoint table - the one
definition of what ``douyin.content_detail`` means, used by the worker, the REST
layer, MCP and the CLI alike.

See docs/design/01-architecture.md.
"""

from dtk.worker.loop import PeriodicLoop
from dtk.worker.main import (
    DatabaseTaskStore,
    TaskRun,
    TaskStore,
    TaskWorker,
    WorkerOptions,
    serialize_error,
)
from dtk.worker.maintenance import Maintenance, MaintenanceConfig, MaintenanceReport
from dtk.worker.pool_filler import FillerConfig, FillResult, PoolFiller
from dtk.worker.proxy_prober import (
    ProbeClient,
    ProberConfig,
    ProbeResult,
    ProxyProber,
    SweepReport,
)
from dtk.worker.registry import (
    ENDPOINTS,
    Capability,
    EndpointDefinition,
    ResolvedCall,
    definition_for,
    resolve,
)
from dtk.worker.runtime import WorkerRuntime, build_runtime, run

__all__ = [
    "ENDPOINTS",
    "Capability",
    "DatabaseTaskStore",
    "EndpointDefinition",
    "FillResult",
    "FillerConfig",
    "Maintenance",
    "MaintenanceConfig",
    "MaintenanceReport",
    "PeriodicLoop",
    "PoolFiller",
    "ProbeClient",
    "ProbeResult",
    "ProberConfig",
    "ProxyProber",
    "ResolvedCall",
    "SweepReport",
    "TaskRun",
    "TaskStore",
    "TaskWorker",
    "WorkerOptions",
    "WorkerRuntime",
    "build_runtime",
    "definition_for",
    "resolve",
    "run",
    "serialize_error",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #739** (2026-09-10): **[BUG] 用户主页视频数据接口报400**
  *Symptoms*: ***发生错误的平台？*** 抖音  ***发生错误的端点？***  Web APP  ***提交的输入值？***  用户主页链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。 {   "detail": {     "code": 400,     "message": "An error occurred.",     "support": "Please contact us on Github: https://github.com/Evil0ctal/Douyin_TikTok_Download_API",     "time": "2026-09-04 12:01:45",     "router": "/api/douyin/web/fetch_user_post_videos",     "params": {       "sec_user_id": "MS4wLjABAAAAW5ALxswnX8MrEjrKHQTU3YmNfhVRTwvCnJtCVxfMBVDaHkYhdKGTFCXEUC7SUmAG",       "max_cursor": "0",       "count": "20"     }   } }
  **Post-Mortem & Fix Analysis**:
  > 我也遇到了，怎么解决呢
  > 应该是旧的v1接口上风控了，现在是一会正常，一会403的，应该只能等作者更新新接口了。
  > 晚点更新一下

- **Issue #736** (2026-09-10): **[BUG] Brief and clear description of the problem**
  *Symptoms*: (HTTP 400): {'code': 400, 'message': 'An error occurred.', 'support': 'Please contact us on Github
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #734** (2026-09-10): **[BUG] 简短明了的描述问题**
  *Symptoms*: ***发生错误的平台？*** 抖音  ***发生错误的端点？*** Web APP  ***提交的输入值？*** 短视频链接  ***是否有再次尝试？*** 是  今天抖音解析视频失效了 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #729** (2026-09-10): **[Security] Unauthenticated full-read Server-Side Request Forgery in /api/download and /api/hybrid/video_data (url parameter)**
  *Symptoms*: Hi. Is there a place I can disclose a potential security vulnerability please?
  **Post-Mortem & Fix Analysis**:
  > ### Summary The public, unauthenticated parsing endpoints accept a user-supplied `url` query parameter and fetch it server-side with no host or IP restriction. An attacker can make the server issue requests to arbitrary internal addresses (including the cloud metadata endpoint `http://169.254.169.254/`). When the targeted internal service responds with a status code outside a small allowed set, the response body is returned verbatim to the attacker in the API error message, making this a full-read SSRF.  ### Details The endpoints take `url` directly and pass it to the crawler:  `app/api/endpoints/download.py` ```python @router.get("/download") async def download_file_hybrid(request: Request, url: str = Query(...), ...):     ...     if not config["API"]["Download_Switch"]:           # shipped as true         ...     try:         data = await HybridCrawler.hybrid_parsing_single_video(url, minimal=True)     except Exception as e:         return ErrorResponseModel(code=400, message=str(e),
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #724** (2026-09-10): **[BUG] 刚刚docker部署cookie也修改了 GET /api/hybrid/video_data?url=https://v.douyin.com/BeK6SA9T96E/&minimal=false，服务器返回了 400 Bad Request**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：  ***提交的输入值？***  如：短视频链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  <img width="935" height="778" alt="Image" src="https://github.com/user-attachments/assets/4067202c-cefe-4f15-ac04-720a040e22f7" /> 
  **Post-Mortem & Fix Analysis**:
  > INFO:     Started reloader process [7] using StatReload ERROR    请求Douyin msToken API时发生错误：Server error '503 Service                      Unavailable' for url 'https://mssdk.bytedance.com/web/report'                    For more information check:                                                      https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503            INFO     将使用本地生成的虚假msToken参数，以继续请求。 
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #720** (2026-09-10): **[BUG]抖音 解析成功后获取回来的视频无法播放，提示403 Forbidden**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：Web APP  短视频链接：  https://v.douyin.com/LxPGNRIZBiA/    ***是否有再次尝试？***  是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  问题是：能够正常解析分享链接，获取到返回得短视频信息，其中有返回video_addr里有3个视频链接，第一个url打开会显示403，后面两个是正常的。目前 web app应该取的是第一个；  另外/api/download 接口返回： <html> <body> <!--StartFragment--> Response bodyDownload{   "code": 400,   "message": "'NoneType' object has no attribute 'get'",   "support": "Please contact us on Github: https://github.com/Evil0ctal/Douyin_TikTok_Download_API",   "time": "2026-04-27 11:02:43",   "router": "/api/download",   "params": {     "url": "https://v.douyin.com/e4J8Q7A/ ",     "prefix": "true",     "with_watermark": "false"   } } --   <!--EndFragment--> </body> </html>  <img width="2486" height="1322" alt="Image" src="https://github.com/user-attachments/assets/6df9a138-bb73-4dd0-bd2e-6e755b357148" /> 
  **Post-Mortem & Fix Analysis**:
  > 403都不知道什么原因还是趁早去打游戏吧
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #719** (2026-09-10): **[BUG]抖音 解析成功后获取回来的视频无法播放，提示403 Forbidden**
  *Symptoms*: ***发生错误的平台？***  如：抖音  ***发生错误的端点？***  如：Web APP  短视频链接：  https://v.douyin.com/LxPGNRIZBiA/    ***是否有再次尝试？***  是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。  <img width="2486" height="1322" alt="Image" src="https://github.com/user-attachments/assets/6df9a138-bb73-4dd0-bd2e-6e755b357148" /> 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

- **Issue #718** (2026-09-10): **[BUG] 简短明了的描述问题**
  *Symptoms*: ***发生错误的平台？***  抖音/  ***发生错误的端点？***  利用你的release的pyton  ***提交的输入值？***  如：短视频链接  ***是否有再次尝试？***  如：是，发生错误后X时间后错误依旧存在。  ***你有查看本项目的自述文件或接口文档吗？***  如：有，并且很确定该问题是程序导致的。   D:\tools\Douyin_TikTok_Download_API-4.1.2>python start.py Traceback (most recent call last):   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\start.py", line 37, in <module>     from app.main import Host_IP, Host_Port   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\main.py", line 39, in <module>     from app.api.router import router as api_router   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\api\router.py", line 2, in <module>     from app.api.endpoints import (   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\app\api\endpoints\tiktok_web.py", line 7, in <module>     from crawlers.tiktok.web.web_crawler import TikTokWebCrawler  # 导入TikTokWebCrawler类     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\web_crawler.py", line 55, in <module>     from crawlers.tiktok.web.models import (   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\models.py", line 10, in <module>     class BaseRequestModel(BaseModel):   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\models.py", line 44, in BaseRequestModel     msToken: str = TokenManager.gen_real_msToken()                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "D:\tools\Douyin_TikTok_Download_API-4.1.2\crawlers\tiktok\web\utils.py", line 
  **Post-Mortem & Fix Analysis**:
  > Closing as part of a cleanup for **v5.0.0**, released today.  v5 is a rewrite from an empty branch: different endpoints, different configuration, its own database schema, and none of v4's code. That means this issue was filed against a codebase that is no longer the one being developed, and leaving it open would imply someone is going to fix it there. Nobody is — v4 is frozen.  **If this still affects you:**  - **On v5** — please open a new issue. It will get a real answer, and it starts from a codebase where a lot of the old failure modes are gone: authentication on every endpoint, encrypted credentials, an identity pool that maintains itself, and a request log that shows what actually happened. The [Troubleshooting guide](https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/documents/en/14-troubleshooting.md) and `dtk diagnose` will answer most of what a maintainer would otherwise have to ask you. - **Staying on v4** — it still works. The code is on the [`v4` branch](htt

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

### Incident Patch 1: `4f0bed84` (2026-10-02)
**Commit Message**: docs: pin the real build sha in the 5.1.3 release notes

**File**: `.github/RELEASE_v5.1.3.md` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ bash install/install.sh --manage
 |---|---|
 | Git tag / Git 标签 | `v5.1.3` |
 | `DTK_IMAGE_TAG` — this release / 这个版本 | `5.1.3` |
-| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-<40-char commit>` |
+| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-31d56df1462e99f24621eb2c6f060af183bf24fd` |
 
 The Docker tag drops the `v`: `docker/metadata-action` strips it when publishing,
 so `:v5.1.3` was never pushed. One value names both published images. `latest`
```

---

### Incident Patch 2: `3f9fe650` (2026-10-02)
**Commit Message**: Merge branch 'fix/issue-767-short-link'

**File**: `src/dtk/worker/main.py` (modified, +19/-13)
```diff
@@ -304,9 +304,10 @@ def __init__(
         self._config: Callable[[], Config] = config if callable(config) else (lambda: config)
         self._options = options or WorkerOptions()
         self._session_factory = session_factory
-        # Where the "parse" endpoint's short-link hop leaves from. Only that hop
-        # uses it, and a worker built without one refuses to expand rather than
-        # falling back to this host's own address - see dtk.worker.parsing.
+        # Where a short-link hop leaves from, whether the link came in through
+        # "parse" or as the url= of an endpoint that names itself. Only those
+        # hops use it, and a worker built without one refuses to expand rather
+        # than falling back to this host's own address - see dtk.worker.parsing.
         self._egress: parsing.ProxySource = egress or parsing.no_egress
         self._stop = asyncio.Event()
         self._gate = asyncio.Semaphore(self._options.concurrency)
@@ -558,25 +559,30 @@ async def _finish_failed(
     async def _resolve_endpoint(self, run: TaskRun) -> tuple[str, dict[str, Any]]:
         """Bind a submitted task to a concrete platform endpoint.
 
-        Everything except ``parse`` already names its endpoint. ``parse`` names
-        only a URL, so the link is expanded and identified first; that expansion
-        is a network call, which is why it happens here in the worker rather
-        than at submission time, where it would block the API.
+        ``parse`` names only a URL, so the link is expanded and identified
+        first. Every other endpoint names itself, but may still arrive holding
+        a link in place of the id it keys on (``/douyin/video?url=<short
+        link>``), and gets that id filled in here. Both are network calls,
+        which is why they happen in the worker rather than at submission time,
+        where they would block the API.
         """
-        if run.endpoint != self.PARSE_ENDPOINT:
-            return run.endpoint, dict(run.params)
-
+        named = run.endpoint != self.PARSE_ENDPOINT
         url = str(run.params.get("url") or "").strip()
         if not url:
+            if named:
+                return run.endpoint, dict(run.params)
             raise InvalidParam("parse requires a url", details={"endpoint": run.endpoint})
 
         # One list for both halves: the fetcher re-checks each hop it is handed,
         # and a fetcher that had not heard of the operator's hosts would refuse
         # the hop expansion had just allowed.
         hosts = extra_url_hosts(self._config())
-        endpoint, resolved = await parsing.plan(
-            url, parsing.egress_fetcher(self._egress, extra_hosts=hosts), extra_hosts=hosts
-        )
+        fetcher = parsing.egress_fetcher(self._egress, extra_hosts=hosts)
+        if named:
+            completed = await parsing.complete(run.endpoint, run.params, fetcher, extra_hosts=hosts)
+            return run.endpoint, completed
+
+        endpoint, resolved = await parsing.plan(url, fetcher, extra_hosts=hosts)
         # Pass through anything the caller also set, such as include_raw.
         extra = {k: v for k, v in run.params.items() if k != "url"}
         return endpoint, {**extra, **resolved}
```

**File**: `src/dtk/worker/parsing.py` (modified, +89/-1)
```diff
@@ -20,7 +20,7 @@
 from __future__ import annotations
 
 import random
-from collections.abc import Awaitable, Callable
+from collections.abc import Awaitable, Callable, Mapping
 from typing import Any, Final
 
 import httpx
@@ -30,6 +30,7 @@
 from dtk.core.errors import (
     IdentityPoolExhausted,
     Internal,
+    InvalidParam,
     InvalidUrl,
     NotConfigured,
     UnsupportedContent,
@@ -45,6 +46,7 @@
     is_allowed_host,
     resolve,
 )
+from dtk.worker import registry
 
 log = get_logger(__name__)
 
@@ -309,12 +311,98 @@ async def plan(
     return endpoint, params
 
 
+#: The ids a link can stand in for on an endpoint that already names itself,
+#: and what the link has to turn out to be. A comment reply takes a post and a
+#: comment; only the post has a link, so only the post is here.
+_RESOURCE_BY_PARAM: Final[dict[str, ResourceKind]] = {
+    registry.CONTENT_ID: ResourceKind.VIDEO,
+    registry.AUTHOR_ID: ResourceKind.USER,
+}
+
+
+def _holds(params: Mapping[str, Any], canonical: str) -> bool:
+    """Whether ``params`` already carries ``canonical``, under any alias."""
+    return any(
+        value not in (None, "") and registry.ALIASES.get(key, key) == canonical
+        for key, value in params.items()
+    )
+
+
+async def complete(
+    endpoint: str,
+    params: Mapping[str, Any],
+    fetcher: RedirectFetcher,
+    *,
+    extra_hosts: frozenset[str] = frozenset(),
+) -> dict[str, Any]:
+    """Fill in the id ``endpoint`` keys on from the link it was handed instead.
+
+    The content routes accept ``url`` in place of an id, and a short link gives
+    up its id only by being followed - a network call the API does not make. So
+    the route forwards the link with the id left empty, and the expansion
+    happens here, through the same pool egress as :func:`plan`.
+
+    Only ``parse`` used to do this. Every other endpoint reached the registry
+    holding a ``url`` it drops as an envelope parameter, and
+    ``/douyin/video?url=https://v.douyin.com/...`` - the link the docstring
+    named as working - failed on "missing content_id" (issue #767).
+
+    A caller's own id wins over the link, as it does at the route. A full link
+    is identified without a request; only a short link costs one.
+    """
+    definition = registry.definition_for(endpoint)
+    url = str(params.get("url") or "").strip()
+    wanted = next((name for name in _RESOURCE_BY_PARAM if name in definition.accepts), None)
+    if not url or wanted is None or _holds(params, wanted):
+        return dict(params)
+
+    identified = await resolve(url, fetcher, max_hops=MAX_REDIRECTS, extra_hosts=extra_hosts)
+    if identified.platform is not definition.platform:
+        raise InvalidUrl(
+            "this URL belongs to a different platform than the endpoint addressed",
+            details={
+                "reason": "platform_mismatch",
+                "url_platform": identified.platform.value if identified.platform else None,
+                "endpoint_platform": definition.platform.value,
+            },
+        )
+    expected = _RESOURCE_BY_PARAM[wanted]
+    if identified.resource is not expected:
+        # Used to surface as the same "missing content_id", which told the
+        # caller their id was wrong when it was the link that was.
+        raise InvalidParam(
+            f"the link points at a {identified.resource.value}; "
+            f"{endpoint} takes a link to a {expected.value}",
+            details={
+                "field": "url",
+                "reason": "wrong_resource",
+                "resource": identified.resource.value,
+                "expected": expected.value,
+            },
+        )
+    if not identified.resource_id:
+        raise InvalidUrl(
+            "the link is recognized but carries no identifier",
+            details={"url": url, "resource": identified.resource.value},
+        )
+
+    filled = {
+        key: value
+        for key, value in params.items()
+        if key != "url" and registry.ALIASES.get(key, key) != wanted
+    }
+    filled[wanted] = identified.resource_id
+    log.info("parse.completed", endpoint=endpoint, resource=identified.resource.value)
+    return filled
+
+
 __all__ = [
     "EXPAND_HEADERS",
     "EXPAND_RETRY_AFTER_SECONDS",
     "EXPAND_TIMEOUT_SECONDS",
     "PoolEgress",
     "ProxySource",
+    "complete",
     "egress_fetcher",
     "no_egress",
     "pick_egress",
```

**File**: `tests/unit/test_worker_parsing.py` (modified, +146/-1)
```diff
@@ -25,13 +25,14 @@
 from dtk.core.errors import (
     IdentityPoolExhausted,
     Internal,
+    InvalidParam,
     InvalidUrl,
     NotConfigured,
     UnsupportedContent,
 )
 from dtk.db.models import Proxy
 from dtk.urls import identify
-from dtk.worker import parsing
+from dtk.worker import parsing, registry
 from dtk.worker.main import TaskRun, TaskWorker
 from dtk.worker.parsing import plan, to_call
 
@@ -313,6 +314,150 @@ async def test_a_worker_without_an_egress_still_parses_a_full_url(self, monkeypa
         assert built == []
 
 
+# --------------------------------------------------------------------------
+# a link sent to an endpoint that names itself
+# --------------------------------------------------------------------------
+
+
+def a_run(endpoint: str, **params: Any) -> TaskRun:
+    return TaskRun(id=uuid.uuid4(), endpoint=endpoint, params=params)
+
+
+class TestLinkOnANamedEndpoint:
+    """Issue #767: ``/douyin/video?url=https://v.douyin.com/...`` never worked.
+
+    The route cannot see through a short link without a network call, so it
+    forwards the link and leaves the id empty, and promises the worker will
+    expand it. Only ``parse`` ever did. Every other endpoint reached the
+    registry holding a ``url`` it drops as an envelope parameter, and the
+    caller got "missing required parameter(s) ...: content_id" for a link the
+    docs said was fine.
+    """
+
+    async def test_a_post_endpoint_gets_the_id_behind_a_short_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run(
+            "douyin.content_detail",
+            aweme_id=None,
+            url="https://v.douyin.com/abc123",
+            include_raw=True,
+        )
+
+        endpoint, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert endpoint == "douyin.content_detail"
+        assert params == {"content_id": "7372484719365098803", "include_raw": True}
+        # The step that used to fail.
+        registry.resolve(endpoint, params, Config.defaults())
+
+    async def test_comments_take_the_same_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.comments", aweme_id=None, url="https://v.douyin.com/abc123", count=20)
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"content_id": "7372484719365098803", "count": 20}
+
+    async def test_an_author_endpoint_gets_the_author_behind_a_short_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_USER})
+        run = a_run("douyin.author_posts", sec_user_id=None, url="https://v.douyin.com/abc123")
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"author_id": "MS4wLjABAAAA_synthetic_sec_uid"}
+
+    async def test_a_tiktok_profile_link_hands_on_its_handle(self, monkeypatch):
+        """TikTok profile links carry only ``/@handle``; turning that into the
+        stable id is ``_resolve_author_handle``'s job, which runs next."""
+        fake_client(monkeypatch, {"ZSabc": "https://www.tiktok.com/@some.one"})
+        run = a_run("tiktok.author_posts", sec_user_id=None, url="https://vm.tiktok.com/ZSabc")
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"author_id": "some.one"}
+
+    async def test_the_expansion_leaves_through_the_pool(self, monkeypatch):
+        """Same egress rule as parse: the hop never leaves from this host."""
+        built = fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert built
+        assert [call["proxy"] for call in built] == [PROXY_URL] * len(built)
+
+    async def test_without_an_egress_it_fails_closed(self, monkeypatch):
+        built = fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        with pytest.raises(NotConfigured):
+            await a_worker()._resolve_endpoint(run)
+
+        assert built == []
+
+    async def test_a_link_to_an_author_sent_for_a_post_is_named(self, monkeypatch):
+        """Was the same "missing content_id", which blamed the caller's id."""
+        fake_client(monkeypatch, {"abc123": DOUYIN_USER})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        with pytest.raises(InvalidParam) as raised:
+            await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert raised.value.details == {
+            "field": "url",
+            "reason": "wrong_resource",
+            "resource": "user",
+            "expected": "video",
+        }
+
+    async def test_a_full_link_of_the_wrong_kind_costs_no_request(self, monkeypatch):
+        built = fake_client(monkeypatch)
+        
```

---

### Incident Patch 3: `2f3073c3` (2026-10-02)
**Commit Message**: fix(worker): expand a link sent to an endpoint that names itself

/douyin/video?url=https://v.douyin.com/... was accepted, queued, and then
failed on "missing required parameter(s) for douyin.content_detail:
content_id". The route cannot see through a short link without a network
call, so it forwards the link with the id left empty and says the worker
expands it - but only the parse endpoint ever did. Every other endpoint
dropped url as an envelope parameter and reached the registry with no id.
The same held for comments, replies and every author endpoint.

The worker now fills the id in from the link for any endpoint that keys on
a post or an author, through the same pool egress and per-hop allowlist as
parse. A link to the wrong kind of thing, or one that lands on the other
platform, is named as such instead of surfacing as a missing id.

Closes #767

**File**: `src/dtk/worker/main.py` (modified, +19/-13)
```diff
@@ -304,9 +304,10 @@ def __init__(
         self._config: Callable[[], Config] = config if callable(config) else (lambda: config)
         self._options = options or WorkerOptions()
         self._session_factory = session_factory
-        # Where the "parse" endpoint's short-link hop leaves from. Only that hop
-        # uses it, and a worker built without one refuses to expand rather than
-        # falling back to this host's own address - see dtk.worker.parsing.
+        # Where a short-link hop leaves from, whether the link came in through
+        # "parse" or as the url= of an endpoint that names itself. Only those
+        # hops use it, and a worker built without one refuses to expand rather
+        # than falling back to this host's own address - see dtk.worker.parsing.
         self._egress: parsing.ProxySource = egress or parsing.no_egress
         self._stop = asyncio.Event()
         self._gate = asyncio.Semaphore(self._options.concurrency)
@@ -558,25 +559,30 @@ async def _finish_failed(
     async def _resolve_endpoint(self, run: TaskRun) -> tuple[str, dict[str, Any]]:
         """Bind a submitted task to a concrete platform endpoint.
 
-        Everything except ``parse`` already names its endpoint. ``parse`` names
-        only a URL, so the link is expanded and identified first; that expansion
-        is a network call, which is why it happens here in the worker rather
-        than at submission time, where it would block the API.
+        ``parse`` names only a URL, so the link is expanded and identified
+        first. Every other endpoint names itself, but may still arrive holding
+        a link in place of the id it keys on (``/douyin/video?url=<short
+        link>``), and gets that id filled in here. Both are network calls,
+        which is why they happen in the worker rather than at submission time,
+        where they would block the API.
         """
-        if run.endpoint != self.PARSE_ENDPOINT:
-            return run.endpoint, dict(run.params)
-
+        named = run.endpoint != self.PARSE_ENDPOINT
         url = str(run.params.get("url") or "").strip()
         if not url:
+            if named:
+                return run.endpoint, dict(run.params)
             raise InvalidParam("parse requires a url", details={"endpoint": run.endpoint})
 
         # One list for both halves: the fetcher re-checks each hop it is handed,
         # and a fetcher that had not heard of the operator's hosts would refuse
         # the hop expansion had just allowed.
         hosts = extra_url_hosts(self._config())
-        endpoint, resolved = await parsing.plan(
-            url, parsing.egress_fetcher(self._egress, extra_hosts=hosts), extra_hosts=hosts
-        )
+        fetcher = parsing.egress_fetcher(self._egress, extra_hosts=hosts)
+        if named:
+            completed = await parsing.complete(run.endpoint, run.params, fetcher, extra_hosts=hosts)
+            return run.endpoint, completed
+
+        endpoint, resolved = await parsing.plan(url, fetcher, extra_hosts=hosts)
         # Pass through anything the caller also set, such as include_raw.
         extra = {k: v for k, v in run.params.items() if k != "url"}
         return endpoint, {**extra, **resolved}
```

**File**: `src/dtk/worker/parsing.py` (modified, +89/-1)
```diff
@@ -20,7 +20,7 @@
 from __future__ import annotations
 
 import random
-from collections.abc import Awaitable, Callable
+from collections.abc import Awaitable, Callable, Mapping
 from typing import Any, Final
 
 import httpx
@@ -30,6 +30,7 @@
 from dtk.core.errors import (
     IdentityPoolExhausted,
     Internal,
+    InvalidParam,
     InvalidUrl,
     NotConfigured,
     UnsupportedContent,
@@ -45,6 +46,7 @@
     is_allowed_host,
     resolve,
 )
+from dtk.worker import registry
 
 log = get_logger(__name__)
 
@@ -309,12 +311,98 @@ async def plan(
     return endpoint, params
 
 
+#: The ids a link can stand in for on an endpoint that already names itself,
+#: and what the link has to turn out to be. A comment reply takes a post and a
+#: comment; only the post has a link, so only the post is here.
+_RESOURCE_BY_PARAM: Final[dict[str, ResourceKind]] = {
+    registry.CONTENT_ID: ResourceKind.VIDEO,
+    registry.AUTHOR_ID: ResourceKind.USER,
+}
+
+
+def _holds(params: Mapping[str, Any], canonical: str) -> bool:
+    """Whether ``params`` already carries ``canonical``, under any alias."""
+    return any(
+        value not in (None, "") and registry.ALIASES.get(key, key) == canonical
+        for key, value in params.items()
+    )
+
+
+async def complete(
+    endpoint: str,
+    params: Mapping[str, Any],
+    fetcher: RedirectFetcher,
+    *,
+    extra_hosts: frozenset[str] = frozenset(),
+) -> dict[str, Any]:
+    """Fill in the id ``endpoint`` keys on from the link it was handed instead.
+
+    The content routes accept ``url`` in place of an id, and a short link gives
+    up its id only by being followed - a network call the API does not make. So
+    the route forwards the link with the id left empty, and the expansion
+    happens here, through the same pool egress as :func:`plan`.
+
+    Only ``parse`` used to do this. Every other endpoint reached the registry
+    holding a ``url`` it drops as an envelope parameter, and
+    ``/douyin/video?url=https://v.douyin.com/...`` - the link the docstring
+    named as working - failed on "missing content_id" (issue #767).
+
+    A caller's own id wins over the link, as it does at the route. A full link
+    is identified without a request; only a short link costs one.
+    """
+    definition = registry.definition_for(endpoint)
+    url = str(params.get("url") or "").strip()
+    wanted = next((name for name in _RESOURCE_BY_PARAM if name in definition.accepts), None)
+    if not url or wanted is None or _holds(params, wanted):
+        return dict(params)
+
+    identified = await resolve(url, fetcher, max_hops=MAX_REDIRECTS, extra_hosts=extra_hosts)
+    if identified.platform is not definition.platform:
+        raise InvalidUrl(
+            "this URL belongs to a different platform than the endpoint addressed",
+            details={
+                "reason": "platform_mismatch",
+                "url_platform": identified.platform.value if identified.platform else None,
+                "endpoint_platform": definition.platform.value,
+            },
+        )
+    expected = _RESOURCE_BY_PARAM[wanted]
+    if identified.resource is not expected:
+        # Used to surface as the same "missing content_id", which told the
+        # caller their id was wrong when it was the link that was.
+        raise InvalidParam(
+            f"the link points at a {identified.resource.value}; "
+            f"{endpoint} takes a link to a {expected.value}",
+            details={
+                "field": "url",
+                "reason": "wrong_resource",
+                "resource": identified.resource.value,
+                "expected": expected.value,
+            },
+        )
+    if not identified.resource_id:
+        raise InvalidUrl(
+            "the link is recognized but carries no identifier",
+            details={"url": url, "resource": identified.resource.value},
+        )
+
+    filled = {
+        key: value
+        for key, value in params.items()
+        if key != "url" and registry.ALIASES.get(key, key) != wanted
+    }
+    filled[wanted] = identified.resource_id
+    log.info("parse.completed", endpoint=endpoint, resource=identified.resource.value)
+    return filled
+
+
 __all__ = [
     "EXPAND_HEADERS",
     "EXPAND_RETRY_AFTER_SECONDS",
     "EXPAND_TIMEOUT_SECONDS",
     "PoolEgress",
     "ProxySource",
+    "complete",
     "egress_fetcher",
     "no_egress",
     "pick_egress",
```

**File**: `tests/unit/test_worker_parsing.py` (modified, +146/-1)
```diff
@@ -25,13 +25,14 @@
 from dtk.core.errors import (
     IdentityPoolExhausted,
     Internal,
+    InvalidParam,
     InvalidUrl,
     NotConfigured,
     UnsupportedContent,
 )
 from dtk.db.models import Proxy
 from dtk.urls import identify
-from dtk.worker import parsing
+from dtk.worker import parsing, registry
 from dtk.worker.main import TaskRun, TaskWorker
 from dtk.worker.parsing import plan, to_call
 
@@ -313,6 +314,150 @@ async def test_a_worker_without_an_egress_still_parses_a_full_url(self, monkeypa
         assert built == []
 
 
+# --------------------------------------------------------------------------
+# a link sent to an endpoint that names itself
+# --------------------------------------------------------------------------
+
+
+def a_run(endpoint: str, **params: Any) -> TaskRun:
+    return TaskRun(id=uuid.uuid4(), endpoint=endpoint, params=params)
+
+
+class TestLinkOnANamedEndpoint:
+    """Issue #767: ``/douyin/video?url=https://v.douyin.com/...`` never worked.
+
+    The route cannot see through a short link without a network call, so it
+    forwards the link and leaves the id empty, and promises the worker will
+    expand it. Only ``parse`` ever did. Every other endpoint reached the
+    registry holding a ``url`` it drops as an envelope parameter, and the
+    caller got "missing required parameter(s) ...: content_id" for a link the
+    docs said was fine.
+    """
+
+    async def test_a_post_endpoint_gets_the_id_behind_a_short_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run(
+            "douyin.content_detail",
+            aweme_id=None,
+            url="https://v.douyin.com/abc123",
+            include_raw=True,
+        )
+
+        endpoint, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert endpoint == "douyin.content_detail"
+        assert params == {"content_id": "7372484719365098803", "include_raw": True}
+        # The step that used to fail.
+        registry.resolve(endpoint, params, Config.defaults())
+
+    async def test_comments_take_the_same_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.comments", aweme_id=None, url="https://v.douyin.com/abc123", count=20)
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"content_id": "7372484719365098803", "count": 20}
+
+    async def test_an_author_endpoint_gets_the_author_behind_a_short_link(self, monkeypatch):
+        fake_client(monkeypatch, {"abc123": DOUYIN_USER})
+        run = a_run("douyin.author_posts", sec_user_id=None, url="https://v.douyin.com/abc123")
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"author_id": "MS4wLjABAAAA_synthetic_sec_uid"}
+
+    async def test_a_tiktok_profile_link_hands_on_its_handle(self, monkeypatch):
+        """TikTok profile links carry only ``/@handle``; turning that into the
+        stable id is ``_resolve_author_handle``'s job, which runs next."""
+        fake_client(monkeypatch, {"ZSabc": "https://www.tiktok.com/@some.one"})
+        run = a_run("tiktok.author_posts", sec_user_id=None, url="https://vm.tiktok.com/ZSabc")
+
+        _, params = await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert params == {"author_id": "some.one"}
+
+    async def test_the_expansion_leaves_through_the_pool(self, monkeypatch):
+        """Same egress rule as parse: the hop never leaves from this host."""
+        built = fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert built
+        assert [call["proxy"] for call in built] == [PROXY_URL] * len(built)
+
+    async def test_without_an_egress_it_fails_closed(self, monkeypatch):
+        built = fake_client(monkeypatch, {"abc123": DOUYIN_VIDEO})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        with pytest.raises(NotConfigured):
+            await a_worker()._resolve_endpoint(run)
+
+        assert built == []
+
+    async def test_a_link_to_an_author_sent_for_a_post_is_named(self, monkeypatch):
+        """Was the same "missing content_id", which blamed the caller's id."""
+        fake_client(monkeypatch, {"abc123": DOUYIN_USER})
+        run = a_run("douyin.content_detail", aweme_id=None, url=SHORT_LINK)
+
+        with pytest.raises(InvalidParam) as raised:
+            await a_worker(CountingEgress())._resolve_endpoint(run)
+
+        assert raised.value.details == {
+            "field": "url",
+            "reason": "wrong_resource",
+            "resource": "user",
+            "expected": "video",
+        }
+
+    async def test_a_full_link_of_the_wrong_kind_costs_no_request(self, monkeypatch):
+        built = fake_client(monkeypatch)
+        
```

---

### Incident Patch 4: `46bc03cf` (2026-10-02)
**Commit Message**: fix(types): keep mypy clean under SQLAlchemy 2.1

2.1 made Row variadic, so Row[Any] now means a one-column row and every
tuple unpack over safe_execute() failed to type-check. The two paged
queries go through _apply(), which returns Any, and the new execute()
overloads cannot infer through that; annotate them instead.

**File**: `src/dtk/ops/_sql.py` (modified, +6/-2)
```diff
@@ -31,7 +31,7 @@ async def safe_execute(
     params: Mapping[str, Any] | None = None,
     *,
     event: str = "ops.sql.failed",
-) -> Sequence[Row[Any]] | None:
+) -> Sequence[Row[*tuple[Any, ...]]] | None:
     """Run one statement in a savepoint. Returns None when it failed."""
     try:
         async with session.begin_nested():
@@ -40,7 +40,11 @@ async def safe_execute(
             # declared return type; a DDL-style call has none.
             if not getattr(result, "returns_rows", False):
                 return []
-            return cast("Sequence[Row[Any]]", result.all())
+            # ``Row[*tuple[Any, ...]]``, not ``Row[Any]``: SQLAlchemy 2.1 made
+            # Row variadic, so ``Row[Any]`` came to mean exactly one column and
+            # every ``for state, count in rows`` among the callers stopped
+            # type-checking.
+            return cast("Sequence[Row[*tuple[Any, ...]]]", result.all())
     except Exception as exc:
         log.debug(event, statement=statement[:120], error=str(exc)[:200])
         return None
```

**File**: `src/dtk/services/downloads.py` (modified, +7/-5)
```diff
@@ -405,7 +405,7 @@ async def search(
     total and lets someone jump around. The archive's table is the one that
     grows without bound while a client walks it.
     """
-    rows = (
+    rows: Sequence[MediaDownload] = (
         (
             await session.execute(
                 _apply(select(MediaDownload), spec)
@@ -613,9 +613,11 @@ async def stats(session: AsyncSession) -> dict[str, Any]:
         .group_by(MediaDownload.directory)
         .subquery()
     )
-    stored_bytes = (
-        await session.execute(select(func.coalesce(func.sum(per_directory.c.bytes), 0)))
-    ).scalar_one()
+    stored_bytes = int(
+        (
+            await session.execute(select(func.coalesce(func.sum(per_directory.c.bytes), 0)))
+        ).scalar_one()
+    )
     totals = (
         await session.execute(
             select(
@@ -633,7 +635,7 @@ async def stats(session: AsyncSession) -> dict[str, Any]:
     ).all()
     return {
         "downloads": int(totals[0]),
-        "bytes_total": int(stored_bytes),
+        "bytes_total": stored_bytes,
         "pinned": int(totals[1]),
         "evicted": int(totals[2]),
         "in_flight": int(totals[3]),
```

**File**: `src/dtk/services/watchlist.py` (modified, +2/-1)
```diff
@@ -23,6 +23,7 @@
 from __future__ import annotations
 
 import uuid
+from collections.abc import Sequence
 from dataclasses import dataclass
 from datetime import UTC, datetime, timedelta
 from typing import Any, Final
@@ -404,7 +405,7 @@ def _apply(statement: Any, spec: WatchFilter) -> Any:
 async def search(
     session: AsyncSession, spec: WatchFilter, *, limit: int = 200, offset: int = 0
 ) -> tuple[list[WatchlistEntry], int]:
-    rows = (
+    rows: Sequence[WatchlistEntry] = (
         (
             await session.execute(
                 _apply(select(WatchlistEntry), spec)
```

---

### Incident Patch 5: `38ffa85e` (2026-10-01)
**Commit Message**: fix(console): drop the dead assignments eslint 10 flags

@eslint/js 10 adds no-useless-assignment to the recommended set. Two of
the three were initial values every branch overwrites; the third was a
post-increment on the last key the function hands out.

**File**: `web/src/components/CodeBlock.tsx` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ function highlight(source: string): ReactNode[] {
   }
 
   if (lastIndex < source.length) {
-    nodes.push(<span key={key++}>{source.slice(lastIndex)}</span>)
+    nodes.push(<span key={key}>{source.slice(lastIndex)}</span>)
   }
   return nodes
 }
```

**File**: `web/src/components/DataTable.tsx` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ export function DataTable<T>({
     </div>
   )
 
-  let body: ReactNode = null
+  let body: ReactNode
 
   if (error) {
     body = <ErrorState error={error} onRetry={onRetry} />
```

**File**: `web/src/components/SplitPane.tsx` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ export function SplitPane({
 
   const onGutterKeyDown = (index: number, event: KeyboardEvent<HTMLDivElement>): void => {
     const step = usableWidth > 0 ? (KEY_STEP_PX / usableWidth) * 100 : 0
-    let next: number[] | null = null
+    let next: number[] | null
     switch (event.key) {
       case 'ArrowLeft':
         next = withDelta(sizes, index, -step, usableWidth)
```

---

### Incident Patch 6: `27df074d` (2026-10-01)
**Commit Message**: chore: update sqlalchemy[asyncio] requirement from >=2.0.52 to >=2.1.1

Updates the requirements on [sqlalchemy[asyncio]](https://github.com/sqlalchemy/sqlalchemy) to permit the latest version.
- [Release notes](https://github.com/sqlalchemy/sqlalchemy/releases)
- [Changelog](https://github.com/sqlalchemy/sqlalchemy/blob/main/CHANGES.rst)
- [Commits](https://github.com/sqlalchemy/sqlalchemy/commits)

---
updated-dependencies:
- dependency-name: sqlalchemy[asyncio]
  dependency-version: 2.1.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ dependencies = [
     "uvicorn[standard]>=0.54.0",
     "pydantic>=2.9",
     "pydantic-settings>=2.6",
-    "sqlalchemy[asyncio]>=2.0.52",
+    "sqlalchemy[asyncio]>=2.1.1",
     "asyncpg>=0.30",
     "alembic>=1.20.0",
     "redis[hiredis]>=8.1.0",
```

**File**: `uv.lock` (modified, +25/-20)
```diff
@@ -351,7 +351,7 @@ requires-dist = [
     { name = "redis", extras = ["hiredis"], specifier = ">=8.1.0" },
     { name = "rich", specifier = ">=13.7" },
     { name = "ruff", marker = "extra == 'dev'", specifier = ">=0.16.9" },
-    { name = "sqlalchemy", extras = ["asyncio"], specifier = ">=2.0.52" },
+    { name = "sqlalchemy", extras = ["asyncio"], specifier = ">=2.1.1" },
     { name = "structlog", specifier = ">=24.4" },
     { name = "typer", specifier = ">=0.12" },
     { name = "types-redis", marker = "extra == 'dev'" },
@@ -1133,29 +1133,34 @@ wheels = [
 
 [[package]]
 name = "sqlalchemy"
-version = "2.0.52"
+version = "2.1.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "greenlet", marker = "platform_machine == 'AMD64' or platform_machine == 'WIN32' or platform_machine == 'aarch64' or platform_machine == 'amd64' or platform_machine == 'ppc64le' or platform_machine == 'win32' or platform_machine == 'x86_64'" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/21/77b4c147963073040dc3c3a5cb7a8c3001a1893c0209432cb77f9df836aa/sqlalchemy-2.0.52.tar.gz", hash = "sha256:5e2d46356ac2ccb7d268ab6c2319ac6a2b42f1b8d5fd8bd3d46855cd82abee97", size = 9945637, upload-time = "2026-08-11T19:07:09.829Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/e0/d5/1b77a026d161f98a08f11af1a5f6c47b98ee7c7e2648af525a1004826c78/sqlalchemy-2.0.52-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:be8c49131665dfe2cc74c498aa1240ffb548d0fd901325dd11c2c7a18956f727", size = 2170940, upload-time = "2026-08-11T20:58:11.25Z" },
-    { url = "https://files.pythonhosted.org/packages/54/bd/f444444adb37b5d53753fb1730ee7a421628e2e3b756c4da461af7e6394a/sqlalchemy-2.0.52-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:1b2d9e507a458832adcfbd8af6e2036ddf069b7710b799448542ebccae2dceee", size = 3383415, upload-time = "2026-08-11T21:02:38.534Z" },
-    { url = "https://files.pythonhosted.org/packages/be/57/2eadf93a552568c57e8680b7e58bb5e9770d80942a1bdbaf4f2f63f0d7c8/sqlalchemy-2.0.52-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:8738008376d22f30f411ea3efecf39b51110b6996d80bb73786f30bcfdd5fd3b", size = 3398577, upload-time = "2026-08-11T21:16:59.092Z" },
-    { url = "https://files.pythonhosted.org/packages/15/c3/2887cf9dd111d1fbf05d22165b404c221ef43e029f7a2695e7302f27a7cc/sqlalchemy-2.0.52-cp312-cp312-musllinux_1_2_aarch64.whl", hash = "sha256:37a4d548327b6cab9c7d8cdb4e0e82feabee0110c4d150059068e2d1cfbd99ee", size = 3328225, upload-time = "2026-08-11T21:02:40.183Z" },
-    { url = "https://files.pythonhosted.org/packages/02/0f/466bdf9e1feeeef5587f868c187d8687e21ff8c85b1775e9041130181132/sqlalchemy-2.0.52-cp312-cp312-musllinux_1_2_x86_64.whl", hash = "sha256:e49f51a5d59857a7a0dcaf9469febf7197d9394bd88f00d69c2c4e848112cdbf", size = 3357374, upload-time = "2026-08-11T21:17:01.076Z" },
-    { url = "https://files.pythonhosted.org/packages/22/20/5c2b4583904af4173076dda1c9e53c9e2ffc7a702d2efde0216bbacbf7cb/sqlalchemy-2.0.52-cp312-cp312-win32.whl", hash = "sha256:afda3ec521d0517d0de783fc70030775841900896d832de5bbd066549290470e", size = 2129366, upload-time = "2026-08-11T21:14:50.991Z" },
-    { url = "https://files.pythonhosted.org/packages/ed/06/543dab8ef62d4e9fb96fb31a30c2b8b14a8763bccf48d428294d6b3041c0/sqlalchemy-2.0.52-cp312-cp312-win_amd64.whl", hash = "sha256:2d5e53e36e37129fe0be8b9d08b6e4052c10a963ee6cda56c8c10dcc194b99ca", size = 2157344, upload-time = "2026-08-11T21:14:52.453Z" },
-    { url = "https://files.pythonhosted.org/packages/7f/18/e30c6fe1eca1bf34a39fbdd6066121cc9974c850faf6f349eac563697a26/sqlalchemy-2.0.52-cp313-cp313-macosx_11_0_arm64.whl", hash = "sha256:2eb3c6a64b1bfe6704777cfd504e7b8ad093a5f3e03ce67663a5e6742f294e43", size = 2167724, upload-time = "2026-08-11T20:58:12.679Z" },
-    { url = "https://files.pythonhosted.org/packages/d0/56/2e17d161a4f7ecc1c2ffb93e607b4e1898bb551b451b283235acb8f6ce47/sqlalchemy-2.0.52-cp313-cp313-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:923bb183c1dc64fdf7b717965e3d59938ec4f8b8710b419a21ce403e5da9a9e1", size = 3321189, upload-time = "2026-08-11T21:02:41.932Z" },
-    { url = "https://files.pythonhosted.org/packages/cf/b8/8490916e893f3f8d74dc9cc54c078619364999dee37047a188e73abbc852/sqlalchemy-2.0.52-cp313-cp313-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:651d6d8782e80679e6151707c7b490834d46ada526328895abf567f25e63d29c", size = 3338185, upload-time = "2026-08-11T21:17:02.597Z" },
-    { url = "https://files.pythonhosted.org/packages/8b/f7/752cc8ee453da222829b3f5c4613614bf750d97429363b70414fa10478e4/sqlalchemy-2.0.52-cp313-cp313-musllinux_1_2_aarch64.whl", hash = "sha256:b08cddb8989775e3c88799d86704bdfc3ee6e9846118201aa5997f16f27e3a15", size = 3271698, upload-time = "2026-08-11T21:02:43.963Z" },
-    { url
```

---

### Incident Patch 7: `2a08550a` (2026-10-01)
**Commit Message**: chore: update uvicorn[standard] requirement from >=0.52.4 to >=0.54.0

Updates the requirements on [uvicorn[standard]](https://github.com/Kludex/uvicorn) to permit the latest version.
- [Release notes](https://github.com/Kludex/uvicorn/releases)
- [Changelog](https://github.com/Kludex/uvicorn/blob/main/docs/release-notes.md)
- [Commits](https://github.com/Kludex/uvicorn/compare/0.52.4...0.54.0)

---
updated-dependencies:
- dependency-name: uvicorn[standard]
  dependency-version: 0.54.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ authors = [{ name = "Evil0ctal" }]
 
 dependencies = [
     "fastapi>=0.115",
-    "uvicorn[standard]>=0.52.4",
+    "uvicorn[standard]>=0.54.0",
     "pydantic>=2.9",
     "pydantic-settings>=2.6",
     "sqlalchemy[asyncio]>=2.0.52",
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -355,7 +355,7 @@ requires-dist = [
     { name = "structlog", specifier = ">=24.4" },
     { name = "typer", specifier = ">=0.12" },
     { name = "types-redis", marker = "extra == 'dev'" },
-    { name = "uvicorn", extras = ["standard"], specifier = ">=0.52.4" },
+    { name = "uvicorn", extras = ["standard"], specifier = ">=0.54.0" },
     { name = "wreq", specifier = ">=0.12.3,<1.0" },
 ]
 provides-extras = ["dev"]
@@ -1292,15 +1292,15 @@ wheels = [
 
 [[package]]
 name = "uvicorn"
-version = "0.52.4"
+version = "0.54.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "click" },
     { name = "h11" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/f2/0f/3f86e61397dd33bf2ccf28188c40db6a740658aeebbbf6e7dbc101a1f487/uvicorn-0.52.4.tar.gz", hash = "sha256:73acfee47a0b133c5de13d219492d62d8a31e935f4fe6e41a232451a15379f86", size = 100627, upload-time = "2026-08-19T06:27:41.821Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/da/34/30e9280707135d2cfc589dfff3cb796bd07a3aeb1a3e415ba09dd89d7bb4/uvicorn-0.54.0.tar.gz", hash = "sha256:a2e33cbfaa0306f8e6b0c13e0cb89d7d7a2da3e62b90c66e18c33d9807b28620", size = 112283, upload-time = "2026-09-25T06:52:37.601Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/f1/79/4a20b54ab0491485ccd8c077db2d39187c7f12b3e15485d38a7be37c81b4/uvicorn-0.52.4-py3-none-any.whl", hash = "sha256:f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1", size = 79871, upload-time = "2026-08-19T06:27:40.36Z" },
+    { url = "https://files.pythonhosted.org/packages/38/0c/b54a4fdd7f90a3af8b02ebc9ce6712c2c208b7926a2f7bad95c33ebbe943/uvicorn-0.54.0-py3-none-any.whl", hash = "sha256:505bdb0f318731d45f1f712071fc781a8981f6847a31c902c9f5e652d4f67faf", size = 87427, upload-time = "2026-09-25T06:52:35.829Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 8: `eb1f24a5` (2026-10-01)
**Commit Message**: Merge pull request #778 from Evil0ctal/dependabot/npm_and_yarn/web/brace-expansion-5.0.12

chore: bump brace-expansion from 5.0.9 to 5.0.12 in /web

**File**: `web/package-lock.json` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "dtk-console",
-  "version": "5.0.0",
+  "version": "5.1.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "dtk-console",
-      "version": "5.0.0",
+      "version": "5.1.2",
       "dependencies": {
         "@tanstack/react-query": "^5.62.7",
         "i18next": "^26.4.2",
@@ -1301,9 +1301,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 9: `9475f5a5` (2026-10-01)
**Commit Message**: chore: bump brace-expansion from 5.0.9 to 5.0.12 in /web

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.9 to 5.0.12.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.9...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `web/package-lock.json` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "dtk-console",
-  "version": "5.0.0",
+  "version": "5.1.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "dtk-console",
-      "version": "5.0.0",
+      "version": "5.1.2",
       "dependencies": {
         "@tanstack/react-query": "^5.62.7",
         "i18next": "^26.4.2",
@@ -1301,9 +1301,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 10: `d8f874cd` (2026-09-28)
**Commit Message**: docs: pin the real build sha in the 5.1.2 release notes

**File**: `.github/RELEASE_v5.1.2.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ bash install/install.sh --manage
 |---|---|
 | Git tag / Git 标签 | `v5.1.2` |
 | `DTK_IMAGE_TAG` — this release / 这个版本 | `5.1.2` |
-| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-<40-char commit>` |
+| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-81cabb5c6f0f9420857b85076508c2be03259e9c` |
 
 The Docker tag drops the `v`: `docker/metadata-action` strips it when publishing,
 so `:v5.1.2` was never pushed. One value names both published images. `latest`
```

---

### Incident Patch 11: `f4f938b6` (2026-09-28)
**Commit Message**: Merge branch 'fix/issue-766-notice'

**File**: `NOTICE` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Douyin_TikTok_Download_API
+Copyright 2021-2026 Evil0ctal and contributors
+
+Licensed under the Apache License, Version 2.0. The full text is in the
+LICENSE file next to this one.
+
+https://github.com/Evil0ctal/Douyin_TikTok_Download_API
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -538,7 +538,8 @@ would otherwise have to ask you.
 You may use, modify and distribute this project, **including commercially and inside
 closed-source products**. The grant is irrevocable. In return the licence asks you to:
 
-- Keep the copyright notice and the licence text with any copy you distribute
+- Keep the licence text and the [NOTICE](./NOTICE) file, which carries the copyright
+  notice, with any copy you distribute
 - State what you changed, in files you modified
 - Accept that it comes with no warranty
 
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -495,7 +495,7 @@ English documentation: [`documents/README.md`](./documents/README.md)
 你可以使用、修改、分发本项目，**包括商业用途，也包括放进闭源产品**。这项授权不可撤销。
 作为交换，协议要求你：
 
-- 分发副本时保留版权声明和协议全文
+- 分发副本时保留协议全文和 [NOTICE](./NOTICE) 文件（版权声明就在里面）
 - 在你改动过的文件里说明改了什么
 - 接受它不提供任何担保
 
```

---

### Incident Patch 12: `2b74f33b` (2026-09-28)
**Commit Message**: fix(security): resolve and pin a caller-supplied proxy in public mode

GHSA-q3h8-73xx-gwqx. In security.request_proxy=public the proxy host was
judged by its text alone, so any name pointing at an internal address was
accepted - 127-0-0-1.sslip.io as reported, or any domain with such an A
record.

- vet() resolves the host, refuses the proxy if any answer is non-global,
  and hands on the address it checked so nothing downstream resolves the
  name again. https proxies keep their name; certificate verification
  covers them. An unresolvable or slow name is refused (host_unresolvable).
- normalize() refuses an authority with characters outside RFC 3986
  (authority_invalid), so the host checked is the host the client dials.
- is_private_host() also recognises hyphen-spelled non-global addresses,
  giving an early, honest refusal to every caller of it.

**File**: `documents/en/11-api.md` (modified, +2/-2)
```diff
@@ -481,9 +481,9 @@ See [Identities and proxies](./06-identities-and-proxies.md).
 Sends the upstream request through an egress **you** supply, replacing the identity's own exit.
 
 - Refused unless an administrator sets `security.request_proxy` to `public` or `any`. The default is `deny`, and an unrecognised value is treated as `deny` — a typo in configuration must not be the thing that opens a network.
-- `public` accepts only publicly routable destinations; `any` accepts loopback and private ranges too and is only coherent when every API key holder is already trusted with the network the instance runs in.
+- `public` accepts only publicly routable destinations. A proxy given by name is resolved, every address it answers with must be public, and the request is dialled at the address that was checked rather than at the name — so `http://proxy.example.com:8080` is sent on as `http://<its address>:8080`. An `https` proxy keeps its name, because its certificate is verified against it. `any` accepts loopback and private ranges too and is only coherent when every API key holder is already trusted with the network the instance runs in.
 - Schemes: `http`, `https`, `socks5`, `socks5h`. Maximum 512 characters. Give it as a full URL, e.g. `http://host:port`.
-- A refusal is `INVALID_PARAM` with `details.reason` — one of `request_proxy_disabled`, `too_long`, `scheme_missing`, `scheme_not_supported`, `host_missing`, `port_invalid`, `host_not_public`. The value you sent is never echoed back or logged, because a rejected proxy URL is exactly when someone has pasted a real credential.
+- A refusal is `INVALID_PARAM` with `details.reason` — one of `request_proxy_disabled`, `too_long`, `scheme_missing`, `scheme_not_supported`, `authority_invalid`, `host_missing`, `port_invalid`, `host_not_public`, `host_unresolvable`. The value you sent is never echoed back or logged, because a rejected proxy URL is exactly when someone has pasted a real credential.
 - A disabled feature **refuses** rather than ignores. Silently dropping the parameter would send the request from the instance's own address while you believed it went through your proxy.
 
 The cost is real and is not a free option: the identity's cookies were minted behind one address and would now be presented from another, which is an incoherence the platforms can see. Two callers asking for the same post through different proxies are not asking the same question and are never coalesced.
```

**File**: `documents/en/15-security.md` (modified, +10/-1)
```diff
@@ -357,7 +357,7 @@ forgery in its plainest form.
 would already trust with the network the instance runs in. It is the largest
 single widening available in the settings table.
 
-Three details of the implementation are deliberate:
+Four details of the implementation are deliberate:
 
 - **A disabled feature refuses rather than ignores.** Silently dropping the
   parameter would send the request from the instance's own address while the
@@ -368,6 +368,15 @@ Three details of the implementation are deliberate:
 - **The value is never echoed back or logged.** A proxy URL carries
   credentials, and a rejected request is exactly when somebody is most likely to
   have pasted a real one. Only the scheme and the mode are logged.
+- **In `public` mode the name is resolved and the address pinned.** The text of
+  a hostname proves nothing about where it leads: `127-0-0-1.sslip.io`, or any
+  domain whose owner points it at `127.0.0.1`, is a public-looking name for
+  loopback. So every address the name resolves to must be public, and the
+  request is dialled at the address that was checked rather than at the name —
+  a second lookup never happens, so it cannot answer differently. An `https`
+  proxy keeps its name, because its TLS certificate is verified against it and
+  an address the name was rebound to cannot produce one. A name that does not
+  resolve within five seconds is refused with `host_unresolvable`.
 
 Accepted values are at most 512 characters and must use `http`, `https`,
 `socks5` or `socks5h`.
```

**File**: `documents/zh/11-api.md` (modified, +2/-2)
```diff
@@ -480,9 +480,9 @@ curl -sS "$DTK_BASE_URL/api/v1/parse?lang=zh" -X POST \
 让上游请求走**你**提供的出口，替换掉该身份自己的出口。
 
 - 除非管理员把 `security.request_proxy` 设为 `public` 或 `any`，否则一律拒绝。默认是 `deny`，而且无法识别的值也按 `deny` 处理——配置里的一个笔误不该成为打开网络的那件事。
-- `public` 只接受公网可路由的目的地；`any` 连回环和私有网段也接受，只有在每一个持有 API key 的人都已经被信任可以访问该实例所在网络时才说得通。
+- `public` 只接受公网可路由的目的地。以域名给出的代理会先被解析，解析出的每一个地址都必须是公网地址，之后请求拨向的是通过检查的那个地址而不是域名——所以 `http://proxy.example.com:8080` 往下传时会变成 `http://<它的地址>:8080`。`https` 代理保留域名，因为它的证书要按域名校验。`any` 连回环和私有网段也接受，只有在每一个持有 API key 的人都已经被信任可以访问该实例所在网络时才说得通。
 - 协议：`http`、`https`、`socks5`、`socks5h`。最长 512 字符。请写成完整 URL，例如 `http://host:port`。
-- 拒绝时返回 `INVALID_PARAM`，`details.reason` 是 `request_proxy_disabled`、`too_long`、`scheme_missing`、`scheme_not_supported`、`host_missing`、`port_invalid`、`host_not_public` 之一。你发的值永远不会被回显或写日志，因为一个被拒的代理 URL 恰恰是最可能刚粘贴了真实凭据的时刻。
+- 拒绝时返回 `INVALID_PARAM`，`details.reason` 是 `request_proxy_disabled`、`too_long`、`scheme_missing`、`scheme_not_supported`、`authority_invalid`、`host_missing`、`port_invalid`、`host_not_public`、`host_unresolvable` 之一。你发的值永远不会被回显或写日志，因为一个被拒的代理 URL 恰恰是最可能刚粘贴了真实凭据的时刻。
 - 功能被关闭时是**拒绝**而不是忽略。悄悄丢掉这个参数，会让请求从实例自己的地址发出去，而你以为它走了你的代理。
 
 代价是真实存在的，不是白送的选项：这个身份的 cookie 是在某个地址后面签发的，现在却从另一个地址出示，这正是平台看得见的那种自相矛盾。两个通过不同代理请求同一条作品的调用方，问的不是同一个问题，所以永远不会被合并。
```

**File**: `documents/zh/15-security.md` (modified, +2/-1)
```diff
@@ -253,11 +253,12 @@ curl -s -D - -o /dev/null http://127.0.0.1:8000/healthz
 
 只有当实例上的每一把 API 密钥都握在“你本来就愿意让他接触这台机器所在网络”的人手里时，`any` 才是自洽的。它是整张配置表里能做出的最大一次放宽。
 
-实现上有三个细节是刻意的：
+实现上有四个细节是刻意的：
 
 - **被禁用的功能是拒绝，而不是忽略。** 悄悄丢掉这个参数，会让请求从实例自己的地址发出去，而调用方以为它走了自己的代理——这比报错更糟，因为他只能从对端才发现。
 - **无法识别的配置值按 `deny` 处理。** 运维配置里的一个笔误，绝不能成为打开他们内网的那个东西。
 - **这个值从不回显，也从不写日志。** 代理 URL 里带着凭据，而请求被拒的那一刻，恰恰是人最可能刚粘了一个真值的时候。只有 scheme 和当前模式会被记录。
+- **`public` 模式下会解析域名并钉住地址。** 主机名的字面内容说明不了它指向哪里：`127-0-0-1.sslip.io`，或者任何被主人指向 `127.0.0.1` 的域名，都是一个看起来像公网的回环地址。所以域名解析出的每一个地址都必须是公网地址，而请求拨向的是通过检查的那个地址而不是域名——第二次解析根本不会发生，也就不可能得到不同的答案。`https` 代理保留域名，因为它的 TLS 证书按域名校验，被重绑定到的地址拿不出这张证书。五秒内解析不出来的域名以 `host_unresolvable` 拒绝。
 
 被接受的值最长 512 个字符，scheme 必须是 `http`、`https`、`socks5` 或 `socks5h`。
 
```

**File**: `src/dtk/api/request_proxy.py` (modified, +150/-15)
```diff
@@ -18,21 +18,30 @@
 feature opts in with ``security.request_proxy``, and the middle setting - the
 one to actually use - keeps the caller on publicly routable addresses.
 
-What this module does NOT do is resolve DNS. A name that resolves to a private
-address today can resolve elsewhere between this check and the connection, so a
-lookup here would buy a false sense of safety at the cost of a network call in a
-request path; :func:`dtk.urls.is_private_host` takes the same position for the
-same reason. The literal forms that exist only to evade string matching -
-decimal, hex, IPv4-mapped IPv6, trailing dots - are what it does catch, and it
-catches them by refusing anything that is not globally routable rather than by
-listing what is bad.
+In that mode the host is resolved, every answer is checked, and the URL handed
+on names the address that passed rather than the name. This module used to
+refuse to resolve at all, on the grounds that a name can point elsewhere between
+the check and the connection. The conclusion did not follow from the reason:
+checking only the text left every name that simply points inside wide open, and
+GHSA-q3h8-73xx-gwqx walked through with ``127-0-0-1.sslip.io`` - no race, just
+a public DNS service that answers with the address the name spells. The race is
+real, and pinning is what closes it: the worker, the browser service and anything
+else downstream dial the literal that was checked and never look the name up
+again. The literal forms that exist only to evade string matching - decimal,
+hex, IPv4-mapped IPv6, trailing dots - are still refused before any lookup, by
+refusing anything not globally routable rather than by listing what is bad.
 """
 
 from __future__ import annotations
 
+import asyncio
+import ipaddress
+import re
+import socket
+from collections.abc import Awaitable, Callable, Sequence
 from enum import StrEnum
 from typing import Final
-from urllib.parse import urlsplit
+from urllib.parse import SplitResult, urlsplit, urlunsplit
 
 from dtk.core.errors import DtkError, InvalidParam
 from dtk.core.logging import get_logger
@@ -49,6 +58,19 @@
 #: is someone probing the parser.
 MAX_LENGTH: Final = 512
 
+#: What RFC 3986 allows in an authority: unreserved, sub-delims, percent
+#: escapes, and the ":", "@" and brackets that give it structure.
+AUTHORITY_RE: Final = re.compile(r"[A-Za-z0-9\-._~!$&'()*+,;=%:@\[\]]+")
+
+#: How long the proxy's name gets to resolve. The lookup holds an API request
+#: open, and a proxy whose own name does not answer is not going to carry
+#: traffic either, so a slow one is refused rather than waited on.
+RESOLVE_TIMEOUT_SECONDS: Final = 5.0
+
+#: Looks a host up and returns every address it answers with. Injected so the
+#: tests decide what a name resolves to without touching the network.
+Resolver = Callable[[str], Awaitable[Sequence[str]]]
+
 
 class RequestProxyMode(StrEnum):
     """What ``security.request_proxy`` may be set to.
@@ -82,10 +104,12 @@ def _reject(reason: str, detail: str) -> DtkError:
 
 
 def normalize(value: str | None, *, mode: RequestProxyMode) -> str | None:
-    """Validate a caller-supplied proxy, or explain why it cannot be used.
+    """Judge the text of a caller-supplied proxy, or explain why it cannot be used.
 
-    Returns the URL to dial, or None when the caller supplied nothing. Never
-    returns a value the current mode does not permit.
+    Returns the URL as given, or None when the caller supplied nothing. This
+    is the offline half: it cannot tell where a name leads, so in ``public``
+    mode its answer is not yet safe to dial. Routes call :func:`vet`, which
+    finishes the job.
 
     A disabled feature REFUSES rather than ignores. Silently dropping the
     parameter would send the request from the instance's own address while the
@@ -120,6 +144,18 @@ def normalize(value: str | None, *, mode: RequestProxyMode) -> str | None:
             f"proxy scheme must be one of {', '.join(sorted(ALLOWED_SCHEMES))}",
         )
 
+    # Checked before asking urlsplit for the host, because the host it names
+    # is only worth checking if the client that dials agrees with it. wreq and
+    # the browser parse by WHATWG rules, which end the authority at a backslash
+    # where Python reads on to the last "@"; any character RFC 3986 does not
+    # allow in an authority is a place the two can disagree.
+    if not AUTHORITY_RE.fullmatch(parts.netloc):
+        raise _reject(
+            "authority_invalid",
+            "the proxy host, port or credentials contain characters that are "
+            "not allowed there; percent-encode them",
+        )
+
     try:
         host, port = parts.hostname, parts.port
     except ValueError as exc:  # a port that is not a number at all
@@ -137,16 +173,115 @@ def normalize(value: str | None, *, mode: RequestProxyMode) -> str | None:
             "link-local and intranet names are refused",
         )
 
-    # Host and scheme only. The value can car
```

**File**: `src/dtk/api/routes/content.py` (modified, +16/-16)
```diff
@@ -316,7 +316,7 @@ async def parse(
             "callback_url": callback,
         },
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         # The platform comes from the link rather than from the path here, and
@@ -360,7 +360,7 @@ async def batch(
     # differ between items, and checking N times would log N acceptances. The
     # pin is checked without a platform for the same reason it is on /parse -
     # each item names its own link, and they need not agree.
-    egress = resolve_request_proxy(request, proxy)
+    egress = await resolve_request_proxy(request, proxy)
     pinned = await resolve_request_identity(request, principal, identity)
 
     results: list[dict[str, Any]] = []
@@ -470,7 +470,7 @@ async def video(
         endpoint=endpoint_name(platform, Operation.CONTENT_DETAIL),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -542,7 +542,7 @@ async def comments(
         endpoint=endpoint_name(platform, Operation.COMMENTS),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -618,7 +618,7 @@ async def comment_replies(
         endpoint=endpoint_name(platform, Operation.COMMENT_REPLIES),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -678,7 +678,7 @@ async def user(
         endpoint=endpoint_name(platform, Operation.AUTHOR_PROFILE),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -751,7 +751,7 @@ async def user_posts(
         endpoint=endpoint_name(platform, Operation.AUTHOR_POSTS),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -828,7 +828,7 @@ async def user_likes(
         endpoint=supported(platform, Operation.AUTHOR_LIKES),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -903,7 +903,7 @@ async def user_reposts(
         endpoint=supported(platform, Operation.AUTHOR_REPOSTS),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -987,7 +987,7 @@ async def user_collections(
         endpoint=endpoint,
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_request_proxy(request, proxy),
         refresh=refresh,
         explain=await resolve_explain(request, principal, explain),
         identity=await resolve_request_identity(request, principal, identity, platform=platform),
@@ -1062,7 +1062,7 @@ async def user_bookmarks(
         endpoint=supported(platform, Operation.AUTHOR_BOOKMARKS),
         params=params,
         wait=resolve_wait(request, wait),
-        proxy=resolve_request_proxy(request, proxy),
+        proxy=await resolve_r
```

**File**: `src/dtk/api/routes/support.py` (modified, +4/-2)
```diff
@@ -305,11 +305,13 @@ def resolve_count(
     return value
 
 
-def resolve_request_proxy(request: Request, value: str | None) -> str | None:
+async def resolve_request_proxy(request: Request, value: str | None) -> str | None:
     """Vet a caller-supplied egress against this instance's setting.
 
     The mode lives in ``security.request_proxy`` and defaults to refusing the
     parameter; :mod:`dtk.api.request_proxy` explains why, and does the checking.
+    Async because ``public`` mode resolves the proxy's name and hands back the
+    address it checked, not the name.
     An unrecognised setting value is treated as ``deny`` rather than as a
     permissive default - a typo in an operator's configuration must not be the
     thing that opens their network.
@@ -322,7 +324,7 @@ def resolve_request_proxy(request: Request, value: str | None) -> str | None:
     except ValueError:
         log.warning("api.request_proxy.unknown_mode", configured=raw)
         mode = request_proxy.RequestProxyMode.DENY
-    return request_proxy.normalize(value, mode=mode)
+    return await request_proxy.vet(value, mode=mode)
 
 
 #: The scopes and role a caller needs before they may name an identity. They
```

**File**: `src/dtk/api/routes/tools.py` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@
 
 from dtk.api.deps import Principal, enforce_rate_limit
 from dtk.api.request_proxy import RequestProxyMode
-from dtk.api.request_proxy import normalize as normalize_proxy
+from dtk.api.request_proxy import vet as vet_proxy
 from dtk.api.routes.openapi import I18N_KEY
 from dtk.api.routes.support import ok
 from dtk.core.errors import InvalidParam, NotConfigured, UpstreamRiskControl
@@ -888,7 +888,7 @@ async def mint_identity(
         mode = RequestProxyMode(raw_mode)
     except ValueError:
         mode = RequestProxyMode.DENY
-    egress = normalize_proxy(body.proxy, mode=mode)
+    egress = await vet_proxy(body.proxy, mode=mode)
 
     client = BrowserRpcClient(base_url)
     try:
```

---

### Incident Patch 13: `737bf3df` (2026-09-23)
**Commit Message**: docs: pin the real build sha in the 5.1.1 release notes

**File**: `.github/RELEASE_v5.1.1.md` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ bash install/install.sh --manage
 |---|---|
 | Git tag / Git 标签 | `v5.1.1` |
 | `DTK_IMAGE_TAG` — this release / 这个版本 | `5.1.1` |
-| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-SHA_PLACEHOLDER` |
+| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-d21b92ec28e481795f4c8530ee6dc0f7d40da69d` |
 
 The Docker tag drops the `v`: `docker/metadata-action` strips it when publishing,
 so `:v5.1.1` was never pushed. One value names both published images. `latest`
```

---

### Incident Patch 14: `b62543d9` (2026-09-23)
**Commit Message**: fix(setup): only one request may claim the setup token

setup_init read the token, compared it, and deleted it later, with
awaits in between. Two concurrent requests holding the real token could
both read it before either deleted it, and each went on to create an
administrator. The docstring claimed the opposite.

Deleting the token is now the claim: DEL reports whether it removed the
key, so only one caller proceeds and the other gets SETUP_ALREADY_DONE.

GETDEL on the read (as proposed in #761) would also close the race, but
it consumes the token on a wrong guess too, which lets anyone who can
reach the port stop the owner from ever finishing setup. A test pins
that down, and the race test holds both requests at a barrier after the
read, because left to the event loop they rarely overlap and the test
passed against the racy code.

Exploiting the race needs the token from the container log, so it never
let an outsider in; it let the token holder mint a second admin.

**File**: `src/dtk/api/routes/setup.py` (modified, +13/-4)
```diff
@@ -161,7 +161,8 @@ async def setup_init(request: Request, body: SetupInit) -> Any:
 
     Ordering matters. The account check comes first so an initialized instance
     answers 409 without ever looking at the token; the token is deleted the
-    moment it verifies, so two racing requests cannot both succeed.
+    moment it verifies, and whichever request's DELETE actually removed it is
+    the one that goes on, so two racing requests cannot both succeed.
     """
     session = request.state.db
     users = UserRepository(session)
@@ -187,9 +188,17 @@ async def setup_init(request: Request, body: SetupInit) -> Any:
             details={"attempts_remaining": remaining},
         )
 
-    # Single use: burn it before the account is written, so a second request
-    # holding the same token finds nothing to match against.
-    await redis.delete(SETUP_TOKEN_KEY, SETUP_ATTEMPTS_KEY)
+    # Single use, and deleting it is the claim. Two requests holding the real
+    # token can both get past the read above before either reaches this line,
+    # and both used to go on to create an administrator. DEL reports whether it
+    # removed the key, and only one caller can be the one that did.
+    #
+    # Not GETDEL on the read: that would close the race too, but it burns the
+    # token on a wrong guess as well, which lets anyone who can reach the port
+    # keep the owner from ever finishing setup.
+    if not await redis.delete(SETUP_TOKEN_KEY):
+        raise SetupAlreadyDone("this instance already has an administrator account")
+    await redis.delete(SETUP_ATTEMPTS_KEY)
 
     user = await users.create(
         username=body.username,
```

**File**: `tests/integration/test_api_setup.py` (modified, +77/-0)
```diff
@@ -7,12 +7,15 @@
 
 from __future__ import annotations
 
+import asyncio
 from typing import Any
 
 import pytest
 
 from dtk.api.routes import setup
+from dtk.core.db import session_scope
 from dtk.core.redis import get_redis
+from dtk.db.repositories import UserRepository
 from tests.integration import test_api_support as support
 from tests.integration.test_api_support import (
     envelope,
@@ -91,6 +94,80 @@ async def test_wrong_token_is_rejected_and_leaves_the_instance_open(client: Any)
     assert envelope(status)["data"] == {"initialized": False}
 
 
+class BothReadFirst:
+    """Redis, except that no GET returns until two of them have been issued.
+
+    Left to the event loop the two requests usually do not overlap at all - the
+    first has deleted the token before the second reads it - so a test without
+    this passes against the racy code too. This holds both at the one point
+    where the race lives: after the read, before anything is written.
+    """
+
+    def __init__(self, redis: Any) -> None:
+        self._redis = redis
+        self._barrier = asyncio.Barrier(2)
+
+    async def get(self, key: str) -> Any:
+        value = await self._redis.get(key)
+        await self._barrier.wait()
+        return value
+
+    def __getattr__(self, name: str) -> Any:
+        return getattr(self._redis, name)
+
+
+async def test_racing_requests_with_the_real_token_create_one_administrator(
+    client: Any, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """Only one of two concurrent requests holding the token may win.
+
+    The token used to be read, compared, and only then deleted, with awaits in
+    between, so two requests could both read it before either deleted it and
+    both create an administrator. Deleting it is now the claim: DEL reports
+    whether it removed the key, and only one caller can be the one that did.
+    """
+    token = await issue_token()
+    racing = BothReadFirst(get_redis())
+    monkeypatch.setattr(setup, "get_redis", lambda: racing)
+
+    responses = await asyncio.gather(
+        *(
+            client.post(
+                "/api/setup/init",
+                json={"token": token, "username": name, "password": "a-good-password"},
+            )
+            for name in ("first", "second")
+        )
+    )
+
+    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]
+    loser = next(r for r in responses if r.status_code == 409)
+    assert error_code(loser) == "SETUP_ALREADY_DONE"
+    async with session_scope() as session:
+        assert await UserRepository(session).count() == 1
+
+
+async def test_a_wrong_token_does_not_burn_the_real_one(client: Any) -> None:
+    """A wrong guess costs an attempt, never the token itself.
+
+    Consuming the token on every read (GETDEL) would close the race above too,
+    but it would let anyone who can reach the port stop the owner from ever
+    finishing setup, one bad request per restart.
+    """
+    token = await issue_token()
+    wrong = await client.post(
+        "/api/setup/init",
+        json={"token": "not-the-token", "username": "owner", "password": "a-good-password"},
+    )
+    assert wrong.status_code == 403
+
+    right = await client.post(
+        "/api/setup/init",
+        json={"token": token, "username": "owner", "password": "a-good-password"},
+    )
+    assert right.status_code == 201, right.text
+
+
 async def test_five_failures_invalidate_the_token(client: Any) -> None:
     token = await issue_token()
     for _ in range(setup.MAX_SETUP_ATTEMPTS):
```

---

### Incident Patch 15: `71c3ec01` (2026-09-15)
**Commit Message**: docs: pin the real build sha in the 5.1.0 release notes

**File**: `.github/RELEASE_v5.1.0.md` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ bash install/install.sh --manage
 |---|---|
 | Git tag / Git 标签 | `v5.1.0` |
 | `DTK_IMAGE_TAG` — this release / 这个版本 | `5.1.0` |
-| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-SHA_PLACEHOLDER` |
+| `DTK_IMAGE_TAG` — this exact build / 钉死这次构建 | `sha-8a3feca26683778d8c6c885803cb0e11374f3d5e` |
 
 The Docker tag drops the `v`: `docker/metadata-action` strips it when publishing,
 so `:v5.1.0` was never pushed. One value names both published images. `latest`
```

#### Recent Merged Pull Requests:
- **PR #780** (2026-10-02): chore: bump typescript-eslint from 8.70.1 to 8.71.0 in /web in the console group across 1 directory (@dependabot[bot])
- **PR #779** (2026-10-01): chore: bump pyjwt from 2.13.0 to 2.15.0 (@dependabot[bot])
- **PR #778** (2026-10-01): chore: bump brace-expansion from 5.0.9 to 5.0.12 in /web (@dependabot[bot])
- **PR #777** (2026-10-01): ci: bump github/codeql-action from 3 to 4 in the actions group (@dependabot[bot])
- **PR #776** (2026-10-01): chore: update uvicorn[standard] requirement from >=0.52.4 to >=0.54.0 (@dependabot[bot])
- **PR #775** (2026-10-02): chore: bump @eslint/js from 9.39.5 to 10.0.1 in /web (@dependabot[bot])
- **PR #774** (2026-10-01): chore: bump globals from 15.15.0 to 17.12.0 in /web (@dependabot[bot])
- **PR #773** (2026-10-02): chore: update sqlalchemy[asyncio] requirement from >=2.0.52 to >=2.1.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
