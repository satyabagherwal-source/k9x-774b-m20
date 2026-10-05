# Forensic Learning Record (Deep Inspection): keybase/client

> **Canonical Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:42:49.048Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keybase/client`
- **Description**: Keybase Go Library, Client, Service, OS X, iOS, Android, Electron
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9253 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `go/auth/credential_authority.go`
```
package auth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	userTimeout  = 3 * time.Hour
	cacheTimeout = 8 * time.Hour
)

// CredentialAuthority should be allocated as a singleton object. It validates UID<->Username<->ActiveKey
// triples for all users across a service. It keeps a cache and subscribes for updates,
// so you can call into it as much as you'd like without fear of spamming the network.
type CredentialAuthority struct {
	log           logger.Logger
	api           UserKeyAPIer
	invalidateCh  chan keybase1.UID
	checkCh       chan checkArg
	shutdownCh    chan struct{}
	cleanItemCh   chan cleanItem
	users         map[keybase1.UID](*userWrapper)
	cleanSchedule []cleanItem
	eng           engine
}

// checkArgs are sent over the checkCh to the core loop of a CredentialAuthority
type checkArg struct {
	uid         keybase1.UID
	username    *libkb.NormalizedUsername
	kid         *keybase1.KID
	sibkeys     []keybase1.KID
	subkeys     []keybase1.KID
	loadDeleted bool
	retCh       chan error
}

// String implements the Stringer interface for checkArg.
func (ca checkArg) String() string {
	return fmt.Sprintf("{uid: %s, username: %s, kid: %s, sibkeys: %v, subkeys: %v}",
		ca.uid, ca.username, ca.kid, ca.sibkeys, ca.subkeys)
}

// userWrapper contains two fields -- one is the user object itself, which will
// spawn a go-routine that is largely off-limits to the main thread aside from
// over channels. the second field is the `atime`, or *access* time, which the main
// thread can touch to compute eviction mechanics.
type userWrapper struct {
	u     *user
	atime time.Time
}

// String implements the Stringer interface for userWrapper.
func (uw userWrapper) String() string {
	return fmt.Sprintf("{user: %s, atime: %s}", uw.u, uw.atime)
}

// cleanItems are items to consider cleaning out of the cache. they sit in a queue
// until they are up for review. When the review happens, the user object they
// refer to can still persist in the cache, if it's been accessed recently.
type cleanItem struct {
	uid   keybase1.UID
	ctime time.Time
}

// String implements the Stringer interface for cleanItem.
func (ci cleanItem) String() string {
	return fmt.Sprintf("{uid: %s, ctime: %s}", ci.uid, ci.ctime)
}

// user wraps a user who is currently active in the system. Each user has a run
// method that runs its own goRoutine, so many items, aside from the two channels,
// are off-limits to the main thread.
type user struct {
	lock      sync.RWMutex
	uid       keybase1.UID
	username  libkb.NormalizedUsername
	sibkeys   map[keybase1.KID]struct{}
	subkeys   map[keybase1.KID]struct{}
	isOK      bool
	isDeleted bool
	ctime     time.Time
	ca        *CredentialAuthority
}

// String implements the stringer interface for user.
func (u *user) String() string {
	u.lock.RLock()
	defer u.lock.RUnlock()
	return fmt.Sprintf("{uid: %s, username: %s, sibkeys: %v, subkeys: %v, isOK: %v, ctime: %s, isDeleted: %v}",
		u.uid, u.username, u.sibkeys, u.subkeys, u.isOK, u.ctime, u.isDeleted)
}

// newUser makes a new user with the given UID for use in the given
// CredentialAuthority. This constructor sets up the necessary maps and
// channels to make the user work as expected.
func newUser(uid keybase1.UID, ca *CredentialAuthority) *user {
	ca.log.Debug("newUser, uid %s", uid)
	ret := &user{
		uid:     uid,
		sibkeys: make(map[keybase1.KID]struct{}),
		subkeys: make(map[keybase1.KID]struct{}),
		ca:      ca,
	}
	return ret
}

// UserKeyAPIer is an interface that specifies the UserKeyAPI that
// will eventually be used to get information about the users from the trusted
// server authority.
type UserKeyAPIer interface {
	// GetUser looks up the username and KIDS active for the given user.
	// Deleted users are loaded by default.
	GetUser(context.Context, keybase1.UID) (
		un libkb.NormalizedUsername, sibkeys, subkeys []keybase1.KID, deleted bool, err error)
	// PollForChanges returns the UIDs that have recently changed on the server
	// side. It will be called in a poll loop. This call should function as
	// a *long poll*, meaning, it should not return unless there is a change
	// to report, or a sufficient amount of time has passed. If an error occurred,
	// then PollForChanges should delay before return, so we don't wind up
	// busy-waiting.
	PollForChanges(context.Context) ([]keybase1.UID, error)
}

// engine specifies the internal mechanics of how this CredentialAuthority
// works. It's only really useful for testing, since tests will want to change
// the definition of time, poke the main loop into action at certain points,
// and get callback hooks when items are evicted.
type engine interface {
	Now() time.Time             // we can overload this for debugging
	Evicted(uid keybase1.UID)   // called when this uid is evicted
	GetPokeCh() <-chan struct{} // Return a channel that can poke the main loop
}

// standardEngine is the engine that's used in production when the CredentailAuthority
// actually runs. It does very little.
type standardEngine struct {
	pokeCh <-chan struct{}
}

// Now returns time.Now
func (se *standardEngine) Now() time.Time { return time.Now() }

// Evicted is a Noop, called whenever a user object for the given UID is evicted.
func (se *standardEngine) Evicted(uid keybase1.UID) {}

// GetPokeCh returns a dummy channel that's never sent to
func (se *standardEngine) GetPokeCh() <-chan struct{} { return se.pokeCh }

// newStandardEngine creates and initializes a standardEngine for use in the
// production run of a CredentialAuthority.
func newStandardEngine() engine {
	return &standardEngine{
		pokeCh: make(chan struct{}),
	}
}

// NewCredentialAuthority makes a new signleton CredentialAuthority an start it running. It takes as input
// a logger and an API for making keybase API calls
func NewCredentialAuthority(log logger.Logger, api UserKeyAPIer) *CredentialAuthority {
	return newCredentialAuthorityWithEngine(log, api, newStandardEngine())
}

// newCredentialAuthoirutyWithEngine is an internal call that can specify the non-standard
// engine. We'd only need to call this directly from testing to specify a testingEngine.
func newCredentialAuthorityWithEngine(log logger.Logger, api UserKeyAPIer, eng engine) *CredentialAuthority {
	ret := &CredentialAuthority{
		log:          log,
		api:          api,
		invalidateCh: make(chan keybase1.UID, 100),
		checkCh:      make(chan checkArg),
		shutdownCh:   make(chan struct{}),
		users:        make(map[keybase1.UID](*userWrapper)),
		cleanItemCh:  make(chan cleanItem),
		eng:          eng,
	}
	ret.run()
	return ret
}

// run two loops in goroutines: one to poll for updates from the server, and
// another to poll for incoming requests and maintenance events.
func (v *CredentialAuthority) run() {
	go v.pollLoop()
	go v.runLoop()
}

// pollOnce polls the API server once for which users have changed.
func (v *CredentialAuthority) pollOnce() error {
	var err error
	var uids []keybase1.UID
	err = v.runWithCancel(func(ctx context.Context) error {
		var err error
		uids, err = v.api.PollForChanges(ctx)
		return err
	})
	if err == nil {
		for _, uid := range uids {
			v.invalidateCh <- uid
		}
	}
	return err
}

// runWithCancel runs an API call while listening for a shutdown of the CredentialAuthority.
// If it gets one, it uses context-based cancellation to cancel the outstanding API call
// (or sleep in the case of Poll()'ing).
func (v *CredentialAuthority) runWithCancel(body func(ctx context.Context) error) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	doneCh := make(chan error)
	var err error

	go func() {
		doneCh <- body(ctx)
	}()

	select {
	case err = <-doneCh:
	case <-v.shutdownCh:
		cancel()
		err = ErrShutdown
	}
	return err
}

// pollLoop() keeps running until the CA is shut down via Shutdown(). It calls Poll()
// on the Us
```

### Core Architecture Module: `go/auth/errors.go`
```
package auth

import (
	"errors"
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// ErrShutdown is raised when an operation is pending but the CA is shutting down
var ErrShutdown = errors.New("shutting down")

// ErrUserDeleted is raised when a user is deleted, but was loaded without the loadDeleted flag
var ErrUserDeleted = errors.New("user was deleted")

// BadUsernameError is raised when the given username disagrees with the expected
// username
type BadUsernameError struct {
	expected libkb.NormalizedUsername
	received libkb.NormalizedUsername
}

func (e BadUsernameError) Error() string {
	return fmt.Sprintf("bad username; wanted %s but got %s", e.expected, e.received)
}

// BadKeyError is raised when the given KID is not valid for the given UID.
type BadKeyError struct {
	uid keybase1.UID
	kid keybase1.KID
}

func (e BadKeyError) Error() string {
	return fmt.Sprintf("Bad key error: %s not active for %s", e.kid, e.uid)
}

// ErrKeysNotEqual is raised when compared keys sets aren't equal.
var ErrKeysNotEqual = errors.New("keys not equal")

// InvalidTokenTypeError is raised when the given token is not of the expected type.
type InvalidTokenTypeError struct {
	expected string
	received string
}

func (e InvalidTokenTypeError) Error() string {
	return fmt.Sprintf("Invalid token type, expected: %s, received: %s",
		e.expected, e.received)
}

// MaxTokenExpiresError is raised when the given token expires too far in the future.
type MaxTokenExpiresError struct {
	creationTime int64
	expireIn     int
	now          int64
	maxExpireIn  int
	remaining    int
}

func (e MaxTokenExpiresError) Error() string {
	return fmt.Sprintf("Max token expiration exceeded, ctime/expire_in: %d/%d, "+
		"now/max: %d/%d, remaining: %d", e.creationTime, e.expireIn,
		e.now, e.maxExpireIn, e.remaining)
}

// TokenExpiredError is raised when the given token is expired.
type TokenExpiredError struct {
	creationTime int64
	expireIn     int
	now          int64
}

func (e TokenExpiredError) Error() string {
	return fmt.Sprintf("Token expired, ctime/expire_in: %d/%d, now: %d",
		e.creationTime, e.expireIn, e.now)
}

// InvalidTokenKeyError is raised when the public key presented in the token does not
// correspond to the private key used to sign the token.
type InvalidTokenKeyError struct {
	expected string
	received string
}

func (e InvalidTokenKeyError) Error() string {
	return fmt.Sprintf("Invalid token key, expected: %s, received: %s",
		e.expected, e.received)
}

// InvalidTokenServerError is raised when the server presented in the token does not
// correspond to the server being asked to verify the token.
type InvalidTokenServerError struct {
	expected string
	received string
}

func (e InvalidTokenServerError) Error() string {
	return fmt.Sprintf("Invalid server in token, expected: %s, received: %s",
		e.expected, e.received)
}

// InvalidTokenChallengeError is raised when the challenge presented in the token does not
// correspond to the challenge of the verifier.
type InvalidTokenChallengeError struct {
	expected string
	received string
}

func (e InvalidTokenChallengeError) Error() string {
	return fmt.Sprintf("Invalid challenge in token, expected: %s, received: %s",
		e.expected, e.received)
}

```

### Core Architecture Module: `go/auth/token.go`
```
// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Code used to support authentication tokens for arbitrary purposes.
package auth

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"math"
	"time"

	"github.com/keybase/client/go/kbcrypto"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	TokenType             = "auth"
	CurrentTokenVersion   = 2
	ChallengeLengthBytes  = 32
	ChallengeLengthString = ChallengeLengthBytes * 2 // we use hex encoding
)

type TokenAuth struct {
	Server    string `json:"server"`
	Challenge string `json:"session"`
}

type TokenKey struct {
	UID      keybase1.UID             `json:"uid"`
	Username libkb.NormalizedUsername `json:"username"`
	KID      keybase1.KID             `json:"kid"`
}

type TokenBody struct {
	Auth    TokenAuth `json:"auth"`
	Key     TokenKey  `json:"key"`
	Type    string    `json:"type"`
	Version int       `json:"version"`
}

type TokenClient struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Token struct {
	Body         TokenBody   `json:"body"`
	Client       TokenClient `json:"client"`
	CreationTime int64       `json:"ctime"`
	ExpireIn     int         `json:"expire_in"`
	Tag          string      `json:"tag"`
}

func NewToken(uid keybase1.UID, username libkb.NormalizedUsername, kid keybase1.KID,
	server, challenge string, now int64, expireIn int,
	clientName, clientVersion string,
) *Token {
	return &Token{
		Body: TokenBody{
			Auth: TokenAuth{
				Server:    server,
				Challenge: challenge,
			},
			Key: TokenKey{
				UID:      uid,
				Username: username,
				KID:      kid,
			},
			Type:    TokenType,
			Version: CurrentTokenVersion,
		},
		Client: TokenClient{
			Name:    clientName,
			Version: clientVersion,
		},
		CreationTime: now,
		ExpireIn:     expireIn,
		Tag:          "signature",
	}
}

func (t Token) Bytes() []byte {
	bytes, err := json.Marshal(&t)
	if err != nil {
		return []byte{}
	}
	return bytes
}

func (t Token) String() string {
	return string(t.Bytes())
}

func VerifyToken(signature, server, challenge string, maxExpireIn int) (*Token, error) {
	var t *Token
	key, token, _, err := kbcrypto.NaclVerifyAndExtract(signature)
	if err != nil {
		return nil, err
	}
	if t, err = parseToken(token); err != nil {
		return nil, err
	}
	if key.GetKID() != t.KID() {
		return nil, InvalidTokenKeyError{
			expected: key.GetKID().String(),
			received: t.KID().String(),
		}
	}
	if TokenType != t.Type() {
		return nil, InvalidTokenTypeError{
			expected: TokenType,
			received: t.Type(),
		}
	}
	if server != t.Server() {
		return nil, InvalidTokenServerError{
			expected: server,
			received: t.Server(),
		}
	}
	if challenge != t.Challenge() {
		return nil, InvalidTokenChallengeError{
			expected: challenge,
			received: t.Challenge(),
		}
	}
	remaining := t.TimeRemaining()
	if remaining > maxExpireIn {
		return nil, MaxTokenExpiresError{
			creationTime: t.CreationTime,
			expireIn:     t.ExpireIn,
			now:          time.Now().Unix(),
			maxExpireIn:  maxExpireIn,
			remaining:    remaining,
		}
	}
	if remaining <= 0 {
		return nil, TokenExpiredError{
			creationTime: t.CreationTime,
			expireIn:     t.ExpireIn,
			now:          time.Now().Unix(),
		}
	}
	return t, nil
}

func (t Token) TimeRemaining() int {
	ctime := time.Unix(t.CreationTime, 0)
	expires := ctime.Add(time.Duration(t.ExpireIn) * time.Second)
	return int(math.Ceil(time.Until(expires).Seconds()))
}

func (t Token) Server() string {
	return t.Body.Auth.Server
}

func (t Token) Challenge() string {
	return t.Body.Auth.Challenge
}

func (t Token) UID() keybase1.UID {
	return t.Body.Key.UID
}

func (t Token) KID() keybase1.KID {
	return t.Body.Key.KID
}

func (t Token) Username() libkb.NormalizedUsername {
	return t.Body.Key.Username
}

func (t Token) Type() string {
	return t.Body.Type
}

func (t Token) Version() int {
	return t.Body.Version
}

func (t Token) ClientName() string {
	return t.Client.Name
}

func (t Token) ClientVersion() string {
	return t.Client.Version
}

func parseToken(token []byte) (*Token, error) {
	decoder := json.NewDecoder(bytes.NewReader(token))
	decoder.UseNumber()
	var t Token
	if err := decoder.Decode(&t); err != nil {
		return nil, err
	}
	return &t, nil
}

// GenerateChallenge returns a cryptographically secure random challenge string.
func GenerateChallenge() (string, error) {
	buf := make([]byte, ChallengeLengthBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// IsValidChallenge returns true if the passed challenge is validly formed.
func IsValidChallenge(challenge string) bool {
	if len(challenge) != ChallengeLengthString {
		return false
	}
	if _, err := hex.DecodeString(challenge); err != nil {
		return false
	}
	return true
}

```

### Core Architecture Module: `go/auth/user_keys_api.go`
```
package auth

import (
	"context"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	pollWait = 5 * time.Second
)

type pubsubMessageInner struct {
	UID keybase1.UID `json:"uid"`
}

type pubsubMessageOuter struct {
	SyncStamp int                `json:"sync_stamp"`
	Message   pubsubMessageInner `json:"message"`
}

type serverState struct {
	InstanceID      string `json:"instance_id"`
	LatestSyncStamp int    `json:"latest_sync_stamp"`
}

type pubsubResponse struct {
	Status      libkb.AppStatus      `json:"status"`
	ServerState serverState          `json:"server_state"`
	Messages    []pubsubMessageOuter `json:"messages"`
}

func (p *pubsubResponse) GetAppStatus() *libkb.AppStatus {
	return &p.Status
}

var _ UserKeyAPIer = (*userKeyAPI)(nil)

type userKeysResPublicKeys struct {
	Sibkeys []keybase1.KID `json:"sibkeys"`
	Subkeys []keybase1.KID `json:"subkeys"`
}

type userKeyRes struct {
	Status     libkb.AppStatus       `json:"status"`
	Username   string                `json:"username"`
	PublicKeys userKeysResPublicKeys `json:"public_keys"`
	Deleted    bool                  `json:"deleted"`
}

func (k *userKeyRes) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

type userKeyAPI struct {
	log           logger.Logger
	api           libkb.API
	lastSyncPoint int
	instanceID    string
}

func (u *userKeyAPI) GetUser(ctx context.Context, uid keybase1.UID) (
	un libkb.NormalizedUsername, sibkeys, subkeys []keybase1.KID, isDeleted bool, err error,
) {
	u.log.Debug("+ GetUser")
	defer func() {
		u.log.Debug("- GetUser -> %v", err)
	}()
	var ukr userKeyRes
	err = u.api.GetDecodeCtx(ctx, libkb.APIArg{
		Endpoint: "user/keys",
		Args: libkb.HTTPArgs{
			"uid":          libkb.S{Val: uid.String()},
			"load_deleted": libkb.B{Val: true},
		},
	}, &ukr)
	if err != nil {
		return "", nil, nil, false, err
	}
	un = libkb.NewNormalizedUsername(ukr.Username)
	return un, ukr.PublicKeys.Sibkeys, ukr.PublicKeys.Subkeys, ukr.Deleted, nil
}

func (u *userKeyAPI) PollForChanges(ctx context.Context) (uids []keybase1.UID, err error) {
	defer func() {
		if err != nil {
			u.log.Error("- poll -> %v", err)
		}
	}()

	var psb pubsubResponse
	args := libkb.HTTPArgs{
		"feed":            libkb.S{Val: "user.key_change"},
		"last_sync_stamp": libkb.I{Val: u.lastSyncPoint},
		"instance_id":     libkb.S{Val: u.instanceID},
		"wait_for_msec":   libkb.I{Val: int(pollWait / time.Millisecond)},
	}
	err = u.api.GetDecodeCtx(ctx, libkb.APIArg{
		Endpoint: "pubsub/poll",
		Args:     args,
	}, &psb)
	// If there was an error (say if the API server was down), then don't busy
	// loop, wait the pollWait amount of time before exiting.
	if err != nil {
		u.log.Debug("Error in poll; waiting for pollWait=%s time", pollWait)
		select {
		case <-time.After(pollWait):
		case <-ctx.Done():
			u.log.Debug("Wait short-circuited due to context cancellation")
		}
		return uids, err
	}

	for _, message := range psb.Messages {
		uids = append(uids, message.Message.UID)
	}
	u.lastSyncPoint = psb.ServerState.LatestSyncStamp
	u.instanceID = psb.ServerState.InstanceID

	return uids, err
}

// NewUserKeyAPIer returns a UserKeyAPIer implementation.
func NewUserKeyAPIer(log logger.Logger, api libkb.API) UserKeyAPIer {
	return &userKeyAPI{log: log, api: api}
}

```

### Core Architecture Module: `go/avatars/fileurilze_nix.go`
```
//go:build !windows

package avatars

func fileUrlize(path string) string {
	return path
}

```

### Core Architecture Module: `go/avatars/fileurlize_windows.go`
```
//go:build windows

package avatars

import (
	"strings"
)

func fileUrlize(path string) string {
	return `/` + strings.Replace(path, `\`, `/`, -1)
}

```

### Core Architecture Module: `go/avatars/fullcaching.go`
```
package avatars

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/keybase1"
)

type avatarLoadPair struct {
	name      string
	format    keybase1.AvatarFormat
	path      string
	remoteURL *string
}

type avatarLoadSpec struct {
	hits   []avatarLoadPair
	misses []avatarLoadPair
	stales []avatarLoadPair
}

func (a avatarLoadSpec) details(l []avatarLoadPair) (names []string, formats []keybase1.AvatarFormat) {
	fmap := make(map[keybase1.AvatarFormat]bool)
	umap := make(map[string]bool)
	for _, m := range l {
		umap[m.name] = true
		fmap[m.format] = true
	}
	for u := range umap {
		names = append(names, u)
	}
	for f := range fmap {
		formats = append(formats, f)
	}
	return names, formats
}

func (a avatarLoadSpec) missDetails() ([]string, []keybase1.AvatarFormat) {
	return a.details(a.misses)
}

func (a avatarLoadSpec) staleDetails() ([]string, []keybase1.AvatarFormat) {
	return a.details(a.stales)
}

func (a avatarLoadSpec) staleKnownURL(name string, format keybase1.AvatarFormat) *string {
	for _, stale := range a.stales {
		if stale.name == name && stale.format == format {
			return stale.remoteURL
		}
	}
	return nil
}

type populateArg struct {
	name   string
	format keybase1.AvatarFormat
	url    keybase1.AvatarUrl
}

type remoteFetchArg struct {
	names   []string
	formats []keybase1.AvatarFormat
	cb      chan keybase1.LoadAvatarsRes
	errCb   chan error
}

type lruEntry struct {
	Path string
	URL  *string
}

func (l lruEntry) GetPath() string {
	return l.Path
}

type FullCachingSource struct {
	libkb.Contextified
	sync.Mutex
	started              bool
	diskLRU              *lru.DiskLRU
	diskLRUCleanerCancel context.CancelFunc
	staleThreshold       time.Duration
	simpleSource         libkb.AvatarLoaderSource

	populateCacheCh chan populateArg

	prepareDirs sync.Once

	usersMissBatch  func(any)
	teamsMissBatch  func(any)
	usersStaleBatch func(any)
	teamsStaleBatch func(any)

	// testing
	populateSuccessCh chan struct{}
	tempDir           string
}

var _ libkb.AvatarLoaderSource = (*FullCachingSource)(nil)

func NewFullCachingSource(g *libkb.GlobalContext, staleThreshold time.Duration, size int) *FullCachingSource {
	s := &FullCachingSource{
		Contextified:   libkb.NewContextified(g),
		diskLRU:        lru.NewDiskLRU("avatars", 1, size),
		staleThreshold: staleThreshold,
		simpleSource:   NewSimpleSource(),
	}
	batcher := func(intBatched any, intSingle any) any {
		reqs, _ := intBatched.([]remoteFetchArg)
		single, _ := intSingle.(remoteFetchArg)
		return append(reqs, single)
	}
	reset := func() any {
		return []remoteFetchArg{}
	}
	actor := func(loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) func(any) {
		return func(intBatched any) {
			reqs, _ := intBatched.([]remoteFetchArg)
			s.makeRemoteFetchRequests(reqs, loadFn)
		}
	}
	usersMissBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadUsers), batcher, reset, 100*time.Millisecond, false,
	)
	teamsMissBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadTeams), batcher, reset, 100*time.Millisecond, false,
	)
	usersStaleBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadUsers), batcher, reset, 5000*time.Millisecond, false,
	)
	teamsStaleBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadTeams), batcher, reset, 5000*time.Millisecond, false,
	)
	s.usersMissBatch = usersMissBatch
	s.teamsMissBatch = teamsMissBatch
	s.usersStaleBatch = usersStaleBatch
	s.teamsStaleBatch = teamsStaleBatch
	return s
}

func (c *FullCachingSource) makeRemoteFetchRequests(reqs []remoteFetchArg,
	loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error),
) {
	mctx := libkb.NewMetaContextBackground(c.G())
	namesSet := make(map[string]bool)
	formatsSet := make(map[keybase1.AvatarFormat]bool)
	for _, req := range reqs {
		for _, name := range req.names {
			namesSet[name] = true
		}
		for _, format := range req.formats {
			formatsSet[format] = true
		}
	}
	genErrors := func(err error) {
		for _, req := range reqs {
			req.errCb <- err
		}
	}
	extractRes := func(req remoteFetchArg, ires keybase1.LoadAvatarsRes) (res keybase1.LoadAvatarsRes) {
		res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
		for _, name := range req.names {
			iformats, ok := ires.Picmap[name]
			if !ok {
				continue
			}
			if _, ok := res.Picmap[name]; !ok {
				res.Picmap[name] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
			}
			for _, format := range req.formats {
				res.Picmap[name][format] = iformats[format]
			}
		}
		return res
	}
	names := make([]string, 0, len(namesSet))
	formats := make([]keybase1.AvatarFormat, 0, len(formatsSet))
	for name := range namesSet {
		names = append(names, name)
	}
	for format := range formatsSet {
		formats = append(formats, format)
	}
	c.debug(mctx, "makeRemoteFetchRequests: names: %d formats: %d", len(names), len(formats))
	res, err := loadFn(mctx, names, formats)
	if err != nil {
		genErrors(err)
		return
	}
	for _, req := range reqs {
		req.cb <- extractRes(req, res)
	}
}

func (c *FullCachingSource) StartBackgroundTasks(mctx libkb.MetaContext) {
	defer mctx.Trace("FullCachingSource.StartBackgroundTasks", nil)()
	c.Lock()
	defer c.Unlock()
	if c.started {
		return
	}
	c.started = true
	go c.monitorAppState(mctx)
	c.populateCacheCh = make(chan populateArg, 100)
	for range 10 {
		go c.populateCacheWorker(mctx)
	}
	mctx, cancel := mctx.WithContextCancel()
	c.diskLRUCleanerCancel = cancel
	go lru.CleanOutOfSyncWithDelay(mctx, c.diskLRU, c.getCacheDir(mctx), 10*time.Second)
}

func (c *FullCachingSource) StopBackgroundTasks(mctx libkb.MetaContext) {
	defer mctx.Trace("FullCachingSource.StopBackgroundTasks", nil)()
	c.Lock()
	defer c.Unlock()
	if !c.started {
		return
	}
	c.started = false
	close(c.populateCacheCh)
	if c.diskLRUCleanerCancel != nil {
		c.diskLRUCleanerCancel()
	}
	if err := c.diskLRU.Flush(mctx.Ctx(), mctx.G()); err != nil {
		c.debug(mctx, "StopBackgroundTasks: unable to flush diskLRU %v", err)
	}
}

func (c *FullCachingSource) debug(m libkb.MetaContext, msg string, args ...any) {
	m.Debug("Avatars.FullCachingSource: %s", fmt.Sprintf(msg, args...))
}

func (c *FullCachingSource) avatarKey(name string, format keybase1.AvatarFormat) string {
	return fmt.Sprintf("%s:%s", name, format.String())
}

func (c *FullCachingSource) isStale(m libkb.MetaContext, item lru.DiskLRUEntry) bool {
	return m.G().GetClock().Now().Sub(item.Ctime) > c.staleThreshold
}

func (c *FullCachingSource) monitorAppState(m libkb.MetaContext) {
	c.debug(m, "monitorAppState: starting up")
	state := keybase1.MobileAppState_FOREGROUND
	for {
		<-m.G().MobileAppState.NextUpdate(state)
		state = m.G().MobileAppState.State()
		if state == keybase1.MobileAppState_BACKGROUND {
			c.debug(m, "monitorAppState: backgrounded")
			if err := c.diskLRU.Flush(m.Ctx(), m.G()); err != nil {
				c.debug(m, "monitorAppState: unable to flush diskLRU %v", err)
			}
		}
	}
}

func (c *FullCachingSource) processLRUHit(entry lru.DiskLRUEntry) (res lruEntry) {
	var ok bool
	if _, ok = entry.Value.(map[string]any); ok {
		jstr, _ := json.Marshal(entry.Value)
		_ = json.Unmarshal(jstr, &res)
		return res
	}
	path, _ := entry.Value.(string)
	res.Path = path
	return res
}

func (c *FullCachingSource) specLoad(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat) (res avatarLoadSpec, err error) {
	for _, name := range names {
		for _, format := range formats {
			key := c.avatarKey(name, format)
			found, ientry, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
			if err != nil {
				return res, err
			}
			lp := avatarLoadPair{
				name:   name,
				format: format,
			}

			// If we found something in the index, let's make sure we have it on the disk as well.
			entry := c.processLRUHit(ientry)
			if found {
				lp.path = c.nor
```

### Core Architecture Module: `go/avatars/interfaces.go`
```
package avatars

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// When changing staleThreshold here, serverside avatar
	// `client_avatar_stale_threshold` should be adjusted to match.
	staleThreshold = 24 * time.Hour
)

func CreateSourceFromEnvAndInstall(g *libkb.GlobalContext) {
	var s libkb.AvatarLoaderSource
	typ := g.Env.GetAvatarSource()
	switch typ {
	case "simple":
		s = NewSimpleSource()
	case "url":
		s = NewURLCachingSource(staleThreshold, 20000)
	case "full":
		maxSize := 10000
		if g.IsMobileAppType() {
			maxSize = 2000
		}
		s = NewFullCachingSource(g, staleThreshold, maxSize)
	}
	g.AddDbNukeHook(s, fmt.Sprintf("AvatarLoader[%s]", typ))
	g.SetAvatarLoader(s)
}

func ServiceInit(g *libkb.GlobalContext, httpSrv *manager.Srv, source libkb.AvatarLoaderSource) *Srv {
	m := libkb.NewMetaContextBackground(g)
	source.StartBackgroundTasks(m)
	s := NewSrv(g, httpSrv, source) // start the http srv up
	g.PushShutdownHook(func(mctx libkb.MetaContext) error {
		source.StopBackgroundTasks(mctx)
		return nil
	})
	return s
}

func allocRes(res *keybase1.LoadAvatarsRes, usernames []string) {
	res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	for _, u := range usernames {
		res.Picmap[u] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1083** (2015-10-26): **Investigate stage0 endpoint timeouts**
  *Symptoms*: Some KBFS writes are failing with:  ```     "Error": "API network error: Get https://stage0.keybase.io/_/api/1.0/sesscheck.json: net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers) (error 1601)" ```  KBFS should probably be retrying after a short timeout.  But we should also try to work out what's up with stage0.  (Could it be rate-limiting?) 

- **Issue #1026** (2015-10-26): **can't seem to clear local state, using either logout or reset**
  *Symptoms*: if I both `logout` and `reset`, and then login, it still knows who I am.  ``` > kbstage logout > kbstage reset Really delete all local cached state? (type 'YES' to confirm): YES ```  Then if I login without a username:  ``` > kbstage login ```  I get a pinentry and it knows the username I had previously been using.  ![image](https://cloud.githubusercontent.com/assets/614943/10148144/ec704b06-65ff-11e5-9783-8dd4dd6b62f0.png) 
  **Post-Mortem & Fix Analysis**:
  > This might be related to keychain stuff #1027 #1002. I am working on those right now. 
  > I don't think any of those commands clear out the config file, which is what would be required to get with @malgorithms wants.  Do we really want to clear out the config file?  And/or the secret keyrings?  It would really F over the user.  One fix might be to clear out the `current_user` field of the `config.json` file, which would address the immediate concern here. 
  > `keybase reset` should definitely be nuking the keychain entry. 

- **Issue #1006** (2015-09-25): **Separate services by build flag on Linux**
  *Symptoms*: On OS X, you can run a `keybase service` and a `kbstage service` at the same time and the sockets will live in different directories and everything works as you'd expect.  On Linux, if you run `keybase service` in one window and `kbstage id cjb` in another, the `keybase` service will answer the kbstage client's request.  But a kbstage service should be doing so instead.  It's because the socket filename doesn't change based on build tags.  It's currently `$XDG_RUNTIME_DIR/keybased.sock`, I suggest `$XDG_RUNTIME_DIR/keybased-{RunMode}.sock`.  @oconnor663, @patrickxb? 
  **Post-Mortem & Fix Analysis**:
  > Note: We should add "run `killall keybase` after installing this" to the Linux changelog, because this change will disconnect the new client (looking for `keybased-staging.*`) from the old service (running at `keybased.*` and with an open lock on the DB). 
  > Do the linux packages stop existing service already on install? 

- **Issue #997** (2015-09-25): **GpgCLI caching failures in daemon**
  *Symptoms*: Configure() caches failures in the daemon.  They last until the daemon restarts.  So if it can't find gpg, it saves that information.  And if the user subsequently installs gpg, it won't look for it.  At the very least, don't cache failures.  But since gpg used infrequently, how about not caching the configuration at all?  cc @cjb @oconnor663 @maxtaco  
  **Post-Mortem & Fix Analysis**:
  > +1 for not having any caching in gpg_cli's Configure() 
  > Ok with me!  On Thursday, September 24, 2015, Chris Ball notifications@github.com wrote:  > +1 for not having any caching in gpg_cli's Configure() >  > — > Reply to this email directly or view it on GitHub > https://github.com/keybase/client/issues/997#issuecomment-143054031. 

- **Issue #945** (2015-09-22): **Panic on PGP verify**
  *Symptoms*: Steps to reproduce:  cat > foo.signed  ``` -----BEGIN PGP MESSAGE----- Comment: https://keybase.io/download Version: Keybase Go 1.0.0 (linux)  xA0DAAoBhxfw9BtMXbgBy+F0AOIAAAAA4mhlbGzhbG/gCgDCwVwEAAEKABAFAlX5 xocJEIcX8PQbTF24AAClshAAUf7rreA8g0OAuCQO9ayGnB83fRj3Hybye3j6u6S3 FEOhqDycfgi6lZbvBPQ/etZp4W7Ci/7w/TJi+7WtrDrZrCA/P1J2b6HGwFYpXU1H BT3DM4vMQ9+UZO8MVH1HcXFzH0fJ6JKt8oJDg4r2W1yqvsP9tjlRt1EKaRWYsNX0 WKFIXpASYVdBteZkUsDXmSSO3FQI786Ly2xXFitqzQNUVOAakZv60Vc6BrNg8bJI vcWInEXR8jTBow8xiSBNeYITdM49dXJCwkxn5zQKuQaYcODg3JpiTK037huo8XHP tiNv4F2rAWWEM3PehL0Tw/BSgoIF6OeagTpeD3ht+vX684f64wfebXzBeeVet3h2 KXyzlc1/wok/kdQuh1W8gTJ7rDECnoKuu3ju0QAmYbg/gSCjyrvsBFYRLu58lSj+ 5nUI9vyphU+gcEkg6JW+lFx8gkkwy9yhSukpQHLgWMwSr4o6usi5g8p1cMJeCNA5 hT7Y4nSuv2XG5+0xAfOnKgus5jDJhhgkNzc0SotaV4XGwhog8l7EBISyxZkoDEMt Kuj/1v6BXLng3HudfZyDrdwpB7NVWZY+YMojKPKqE8dD4QB95cR+LRNiVHAqK3FL dva5k0lEzptli+jj7D2mBnU9/5BDchISng0aWN0SaTx8gSkRk/ldM26t99ISkhD5 wn4= =GY62 -----END PGP MESSAGE----- ```  keybase pgp verify < foo.signed  Client output:  ``` ▶ WARNING Running in devel mode ▶ WARNING key id 9734514050805292472 (8717f0f41b4c5db8) => ,  ▶ ERROR EOF from server ```  Server output:  ``` keybase --local-rpc-debug-unsafe=csv -d service 10:33:06.959768 ▶ [DEBU keybase json.go:30] 001 + loading config file: /home/cjb/.config/keybase.devel/config.json 10:33:06.959975 ▶ [DEBU keybase json.go:60] 002 - successfully loaded config file 10:33:06.960057 ▶ [DEBU keybase config.go:111] 003 Config: mapping server ->  10:33:06.960233 

- **Issue #935** (2015-10-26): **seqno after retrack**
  *Symptoms*: When running `while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done`, I'm getting crashes about 10% of the test runs with:  ```     track_test.go:228: seqno after retrack: 6, expected 5 ```  Seems like it could be an artifact of running this test on its own, I guess? 

- **Issue #927** (2015-09-21): **Autofork making a new daemon each time the client runs**
  *Symptoms*: ``` cjb@caius:~$ killall keybase cjb@caius:~$ ps awfux | grep "keybase " cjb      30688  0.0  0.0  13688  2196 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb@caius:~$ keybase list-trackers chris ▶ WARNING Running in devel mode ▶ INFO | Setting run directory for keybase service to /run/user/1000 ▶ INFO Forking background server with pid=30695 ▶ WARNING Error closing pid file: invalid argument  ▶ ERROR chris: user not found (error 205) cjb@caius:~$ ps awfux | grep "keybase " cjb      30706  0.0  0.0  13688  2256 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb      30695  0.0  0.0 153900 15992 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb@caius:~$ keybase list-trackers chris ▶ WARNING Running in devel mode ▶ INFO | Setting run directory for keybase service to /run/user/1000 ▶ INFO Forking background server with pid=30713 ▶ WARNING Error closing pid file: invalid argument  ▶ ERROR chris: user not found (error 205) cjb@caius:~$ ps awfux | grep "keybase " cjb      30721  0.0  0.0  13688  2148 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb      30695  0.0  0.0 153900 15992 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb      30713  0.0  0.0 136196 16200 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb@caius:~$  ``` 

- **Issue #914** (2015-09-21): **list-trackers t_alice returns "no trackers"**
  *Symptoms*: On localhost:3000/t_alice, she has 323. 
  **Post-Mortem & Fix Analysis**:
  > Update:  Each test run adds one track.  The specific test is TestTrackRetrack.  I couldn't reproduce the bug at first, but I only had a few trackers and wanted to get up to Patrick's 323.  So I ran:  ``` while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done ```  and I saw:  48 49 50 1  (The "1" is the line "no trackers".)  So we have a 50 tracker limit on the go client!  Weird, I wonder where it comes from, will try to figure it out, Patrick's giving me a hand. 
  > might come from the server-side?  On Mon, Sep 21, 2015 at 12:17 PM, Chris Ball notifications@github.com wrote:  > Update: >  > Each test run adds one track. The specific test is TestTrackRetrack. I > couldn't reproduce the bug at first, but I only had a few trackers and > wanted to get up to Patrick's 323. So I ran: >  > while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done >  > and I saw: >  > 48 > 49 > 50 > 1 >  > (The "1" is the line "no trackers".) >  > So we have a 50 tracker limit on the go client! Weird, I wonder where it > comes from, will try to figure it out, Patrick's giving me a hand. >  > — > Reply to this email directly or view it on GitHub > https://github.com/keybase/client/issues/914#issuecomment-142031877. 
  > (as a result of pagination?)  On Mon, Sep 21, 2015 at 12:57 PM, Maxwell Krohn themax@gmail.com wrote:  > might come from the server-side? >  > On Mon, Sep 21, 2015 at 12:17 PM, Chris Ball notifications@github.com > wrote: >  > > Update: > >  > > Each test run adds one track. The specific test is TestTrackRetrack. I > > couldn't reproduce the bug at first, but I only had a few trackers and > > wanted to get up to Patrick's 323. So I ran: > >  > > while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done > >  > > and I saw: > >  > > 48 > > 49 > > 50 > > 1 > >  > > (The "1" is the line "no trackers".) > >  > > So we have a 50 tracker limit on the go client! Weird, I wonder where it > > comes from, will try to figure it out, Patrick's giving me a hand. > >  > > — > > Reply to this email directly or view it on GitHub > > https://github.com/keybase/client/issues/914#issuecomment-142031877. 

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

### Incident Patch 1: `8f694ce2` (2026-09-28)
**Commit Message**: Move more mobile deps to Expo modules, drop dead Android code, fix dark cold-start flash (#29691)

* chore(android): remove dead native code and the Fresco GIF decoder

DeviceLockType, CustomBitmapMemoryCacheParamsSupplier, StorybookConstants and
KillableModule had no references anywhere in the repo. animated-gif only let
RN's Fresco-backed Image animate GIFs; no GIF renders through RN Image.

* feat(mobile): swap deps to Expo equivalents, fix dark cold-start flash

- netinfo -> expo-network. The connection type is lowercased so Go gets the
  same strings as before; the listener also fetches once on subscribe since
  expo-network doesn't always emit the current state.
- react-native StatusBar -> expo-status-bar, @callstack/liquid-glass ->
  expo-glass-effect.
- Drop unused expo-mail-composer and @react-native-masked-view/masked-view
  (react-navigation 8 no longer needs it), and the empty KBReactPackage.
- Android dark mode: remove androidAppColorSchemeChanged. MainApplication
  applies the persisted pref as AppCompat night mode before any activity, and
  MainActivity paints the window background from the current configuration,
  so Appearance.setColorScheme is the only runtime mec

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/DarkModePrefHelper.kt` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-package com.reactnativekb
-
-object DarkModePrefHelper {
-    fun fromString(prefString: String): DarkModePreference {
-        return when (prefString) {
-            "alwaysDark" -> DarkModePreference.AlwaysDark
-            "alwaysLight" -> DarkModePreference.AlwaysLight
-            else -> DarkModePreference.System
-        }
-    }
-}
```

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/GuiConfig.kt` (modified, +5/-2)
```diff
@@ -15,8 +15,11 @@ class GuiConfig private constructor(private val filesDir: File?) {
         return try {
             val jsonObject = JSONObject(asString() ?: return DarkModePreference.System)
             val jsonObjectUI: JSONObject = jsonObject.getJSONObject("ui")
-            val darkModeString: String = jsonObjectUI.getString("darkMode")
-            DarkModePrefHelper.fromString(darkModeString)
+            when (jsonObjectUI.getString("darkMode")) {
+                "alwaysDark" -> DarkModePreference.AlwaysDark
+                "alwaysLight" -> DarkModePreference.AlwaysLight
+                else -> DarkModePreference.System
+            }
         } catch (e: JSONException) {
             DarkModePreference.System
         }
```

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (modified, +0/-16)
```diff
@@ -376,22 +376,6 @@ class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext), T
         }
     }
 
-    // Dark mode
-    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
-    @ReactMethod
-    override fun androidAppColorSchemeChanged(prefString: String) {
-        try {
-            val activity: Activity? = reactContext.currentActivity
-            if (activity != null) {
-                val m: Method = activity.javaClass.getMethod("setBackgroundColor", DarkModePreference::class.java)
-                val pref: DarkModePreference = DarkModePrefHelper.fromString(prefString)
-                m.invoke(activity, pref)
-            }
-        } catch (ex: Exception) {
-            NativeLogger.warn("Error calling androidAppColorSchemeChanged", ex)
-        }
-    }
-
     @ReactMethod
     override fun setApplicationIconBadgeNumber(badge: Double) {
         // Android manages badge counts automatically via notification channels.
```

**File**: `rnmodules/react-native-kb/ios/Kb.mm` (modified, +0/-1)
```diff
@@ -984,7 +984,6 @@ - (void)handleHardwareKeyPressed:(NSNotification *)notification {
 
 // Android-only spec methods; stubs satisfy the NativeKbSpec protocol
 - (void)androidAddCompleteDownload:(JS::NativeKb::SpecAndroidAddCompleteDownloadO &)o resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
-- (void)androidAppColorSchemeChanged:(NSString *)mode {}
 - (void)androidShare:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
 - (void)androidShareText:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
 @end
```

**File**: `rnmodules/react-native-kb/src/NativeKb.ts` (modified, +0/-1)
```diff
@@ -60,7 +60,6 @@ export interface Spec extends TurboModule {
     showNotification: boolean
     title: string
   }): Promise<void>
-  androidAppColorSchemeChanged(mode: string /*'system' | 'alwaysDark' | 'alwaysLight' | ''*/): void
   checkPushPermissions(): Promise<boolean>
   requestPushPermissions(): Promise<boolean>
   getRegistrationToken(): Promise<string>
```

---

### Incident Patch 2: `b84dfe4a` (2026-09-28)
**Commit Message**: fix(chat): audio messages play on first tap and share with an extension (#29690)

- The audio player mounts on the first tap with paused=false, but only
  called play() on a later change of paused, so the first tap never played.
  Drive play/pause from the paused state on mobile and desktop.
- Audio uploads pass a caller preview, and PreprocessAsset returned early on
  that path without setting Filename, so recordings were stored as "." and
  downloaded/shared with no extension. Keep the filename on that path, and
  don't let a stale pending preview blank it out.
- Name already-sent nameless assets on download and archive export
  (audio.m4a for recordings, otherwise an extension from the MIME type).

**File**: `go/chat/archive.go` (modified, +1/-1)
```diff
@@ -528,7 +528,7 @@ func (c *ChatArchiver) attachmentName(msg chat1.MessageUnboxedValid) string {
 	}
 	if typ == chat1.MessageType_ATTACHMENT {
 		att := body.Attachment()
-		safeFilename := libkb.GetSafeFilename(att.Object.Filename)
+		safeFilename := attachments.DownloadBasename(att.Object)
 		return fmt.Sprintf("%s (%d) - %s", gregor1.FromTime(msg.ServerHeader.Ctime).Format("2006-01-02 15.04.05"), msg.ServerHeader.MessageID, safeFilename)
 	}
 	return ""
```

**File**: `go/chat/attachments/downloader.go` (modified, +33/-2)
```diff
@@ -5,6 +5,7 @@ import (
 	"errors"
 	"fmt"
 	"io"
+	"mime"
 	"os"
 
 	"github.com/keybase/client/go/chat/globals"
@@ -39,8 +40,7 @@ func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	if err != nil || typ != chat1.MessageType_ATTACHMENT {
 		return "", nil, fmt.Errorf("invalid message type for download: %v", typ)
 	}
-	unsafeBasename := body.Attachment().Object.Filename
-	safeBasename := libkb.GetSafeFilename(unsafeBasename)
+	safeBasename := DownloadBasename(body.Attachment().Object)
 
 	filePath, err := libkb.FindFilePathWithNumberSuffix(parentDir, safeBasename, useArbitraryName)
 	if err != nil {
@@ -52,6 +52,37 @@ func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	return filePath, sink, nil
 }
 
+// extensionsByMIMEType inverts mimeTypes, keeping the lexically first extension
+// when several share a type (.jpeg over .jpg).
+var extensionsByMIMEType = func() map[string]string {
+	res := make(map[string]string, len(mimeTypes))
+	for ext, typ := range mimeTypes {
+		if cur, ok := res[typ]; !ok || ext < cur {
+			res[typ] = ext
+		}
+	}
+	return res
+}()
+
+// DownloadBasename names the file an asset is saved as. Audio recordings sent
+// before their filename was kept on upload were stored as "." (the Base of an
+// empty path), which would otherwise save with no extension.
+func DownloadBasename(asset chat1.Asset) string {
+	if safe := libkb.GetSafeFilename(asset.Filename); safe != "." && safe != "/" {
+		return safe
+	}
+	if typ, err := asset.Metadata.AssetType(); err == nil && typ == chat1.AssetMetadataType_VIDEO &&
+		asset.Metadata.Video().IsAudio {
+		return "audio.m4a"
+	}
+	if mediaType, _, err := mime.ParseMediaType(asset.MimeType); err == nil {
+		if ext, ok := extensionsByMIMEType[mediaType]; ok {
+			return "attachment" + ext
+		}
+	}
+	return "attachment"
+}
+
 func Download(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	convID chat1.ConversationID, messageID chat1.MessageID, sink io.WriteCloser, showPreview bool,
 	progress func(int64, int64), ri func() chat1.RemoteInterface,
```

**File**: `go/chat/attachments/filename_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package attachments
+
+import (
+	"context"
+	"testing"
+
+	"github.com/keybase/client/go/chat/utils"
+	"github.com/keybase/client/go/libkb"
+	"github.com/keybase/client/go/protocol/chat1"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPreprocessCallerPreviewKeepsFilename(t *testing.T) {
+	tc := libkb.SetupTest(t, "preprocess", 1)
+	defer tc.Cleanup()
+	ctx := context.Background()
+	log := utils.NewDebugLabeler(tc.G, "preprocess", false)
+	callerPreview, err := (&Sender{DebugLabeler: log}).MakeAudioPreview(ctx, []float64{-10, -20, -30}, 1500)
+	require.NoError(t, err)
+	pre, err := PreprocessAsset(ctx, nil, log, nil, "/tmp/recording-ABC.m4a", nil, &callerPreview)
+	require.NoError(t, err)
+	require.Equal(t, "/tmp/recording-ABC.m4a", pre.Filename)
+}
+
+func TestDownloadBasename(t *testing.T) {
+	audioMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{IsAudio: true})
+	videoMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{})
+	cases := []struct {
+		asset chat1.Asset
+		want  string
+	}{
+		{chat1.Asset{Filename: "/tmp/recording-ABC.m4a", MimeType: "video/mp4", Metadata: audioMd}, "recording-ABC.m4a"},
+		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
+		{chat1.Asset{Filename: ".", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
+		{chat1.Asset{Filename: ".", MimeType: "text/plain; charset=utf-8"}, "attachment.txt"},
+		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: videoMd}, "attachment.mp4"},
+		{chat1.Asset{Filename: "", MimeType: "image/jpeg"}, "attachment.jpeg"},
+		{chat1.Asset{Filename: "", MimeType: ""}, "attachment"},
+	}
+	for _, c := range cases {
+		require.Equal(t, c.want, DownloadBasename(c.asset), "%+v", c.asset)
+	}
+}
```

**File**: `go/chat/attachments/preprocess.go` (modified, +1/-0)
```diff
@@ -225,6 +225,7 @@ func PreprocessAsset(ctx context.Context, g *globals.Context, log utils.DebugLab
 		if p, err = processCallerPreview(ctx, g, *callerPreview); err != nil {
 			log.Debug(ctx, "preprocessAsset: failed to process caller preview, making fresh one: %s", err)
 		} else {
+			p.Filename = filename
 			return p, nil
 		}
 	}
```

**File**: `go/chat/attachments/uploader.go` (modified, +4/-1)
```diff
@@ -537,7 +537,10 @@ func (u *Uploader) upload(ctx context.Context, uid gregor1.UID, convID chat1.Con
 		}
 	}
 
-	filename = pre.Filename
+	// a preview persisted by an older build can carry an empty filename
+	if pre.Filename != "" {
+		filename = pre.Filename
+	}
 	// Use our converted input, if available
 	if pre.SrcDat != nil {
 		fileSize = int64(len(pre.SrcDat))
```

---

### Incident Patch 3: `409c3770` (2026-09-28)
**Commit Message**: fix(chat): share a KBFS file to chat through one conversation-picker flow (#29689)

Mobile turned /keybase/... paths into file:// URLs before the attach
screen, so its kbfs check missed them and iOS handed them to the media
processor as missing local files. Keep kbfs paths as-is.

Desktop drops its own "Attach in conversation" modal and uses the same
conversation list -> attach screen as mobile. The attach screen now
previews kbfs images and videos through the service's file URL and shows
the file icon until it resolves, instead of trying the raw kbfs path.

**File**: `shared/chat/conversation/attachment-get-titles.test.tsx` (modified, +1/-9)
```diff
@@ -1,6 +1,6 @@
 /** @jest-environment jsdom */
 /// <reference types="jest" />
-import {isKbfsPath, pathToAttachmentType} from './attachment-get-titles'
+import {pathToAttachmentType} from './attachment-get-titles'
 
 describe('pathToAttachmentType', () => {
   test('common image extensions preview as images, case insensitively', () => {
@@ -25,11 +25,3 @@ describe('pathToAttachmentType', () => {
     expect(pathToAttachmentType('/tmp/a.png/notanimage')).toBe('file')
   })
 })
-
-describe('isKbfsPath', () => {
-  test('only /keybase/ paths count', () => {
-    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
-    expect(isKbfsPath('/tmp/a.png')).toBe(false)
-    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
-  })
-})
```

**File**: `shared/chat/conversation/attachment-get-titles.tsx` (modified, +22/-15)
```diff
@@ -11,6 +11,7 @@ import {
 } from './attachment-actions'
 import {getConversationClientPrev, useConversationExplodingMode, useConversationMeta} from './data-hooks'
 import AttachmentTrim from './attachment-trim'
+import {isKbfsPath} from './attachment-path'
 import {canEdit, canProcess, isEditNoop, isVideoPath, processPaths, type VideoEdit} from '@/util/media-process'
 
 type OwnProps = {
@@ -48,8 +49,6 @@ export const pathToAttachmentType = (path: string) => {
   return 'file'
 }
 
-export const isKbfsPath = (path: string) => path.startsWith('/keybase/')
-
 const ContainerInner = (ownProps: OwnProps) => {
   const styles = useStyles()
   const {titles: _titles, tlfName, pathAndOutboxIDs} = ownProps
@@ -264,7 +263,7 @@ const ContainerInner = (ownProps: OwnProps) => {
   >()
   const kbfsPreviewURL = kbfsPreview && kbfsPreview.path === path ? kbfsPreview.url : undefined
   React.useEffect(() => {
-    if (info?.type !== 'image' || info.url || !path || !isKbfsPath(path)) {
+    if ((info?.type !== 'image' && info?.type !== 'video') || info.url || !path || !isKbfsPath(path)) {
       return
     }
     let canceled = false
@@ -287,18 +286,28 @@ const ContainerInner = (ownProps: OwnProps) => {
   const titleHint = 'Add a caption...'
   if (!info) return null
 
+  const isKbfs = !!path && isKbfsPath(path)
   // kbfs paths aren't real files, so there's nothing to export from them.
-  const showTrim = !!path && !isKbfsPath(path) && canEdit(path)
+  const showTrim = !!path && !isKbfs && canEdit(path)
+  // A kbfs path isn't loadable as a src; it previews through the service's URL
+  // once that resolves, and as a file until then (or for good if it fails).
+  const mediaSrc = info.url ?? (isKbfs ? kbfsPreviewURL : path)
+  const filePreview = (
+    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
+      <Kb.ImageIcon type="icon-file-uploading-48" />
+    </Kb.Box2>
+  )
 
   let preview: React.ReactNode
   switch (info.type) {
     case 'image':
-      preview = path ? (
-        <Kb.ZoomableImage src={info.url ?? kbfsPreviewURL ?? path} style={styles.image} boxCacheKey="getTitlesImg" />
-      ) : null
+      preview = mediaSrc ? (
+        <Kb.ZoomableImage src={mediaSrc} style={styles.image} boxCacheKey="getTitlesImg" />
+      ) : (
+        filePreview
+      )
       break
     case 'video':
-      // kbfs paths aren't real files, so nothing can be exported from them.
       preview = !path ? null : showTrim ? (
         <AttachmentTrim
           // remount per slot AND per clip: duration and handle positions are
@@ -310,19 +319,17 @@ const ContainerInner = (ownProps: OwnProps) => {
             setEdits(s => ({...s, [index]: edit}))
           }}
         />
+      ) : mediaSrc ? (
+        <Kb.Video autoPlay={false} allowFile={!isKbfs} muted={true} url={mediaSrc} />
       ) : (
-        <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} />
+        filePreview
       )
       break
     default: {
-      if (isIOS && path && Chat.isPathHEIC(path)) {
+      if (isIOS && path && !isKbfs && Chat.isPathHEIC(path)) {
         preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
       } else {
-        preview = (
-          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
-            <Kb.ImageIcon type="icon-file-uploading-48" />
-          </Kb.Box2>
-        )
+        preview = filePreview
       }
     }
   }
```

**File**: `shared/chat/conversation/attachment-path.test.tsx` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/// <reference types="jest" />
+import {isKbfsPath, toAttachmentPath} from './attachment-path'
+
+describe('isKbfsPath', () => {
+  test('only /keybase/ paths count', () => {
+    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
+    expect(isKbfsPath('/tmp/a.png')).toBe(false)
+    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
+  })
+})
+
+describe('toAttachmentPath on mobile', () => {
+  const originalIsMobile = global.isMobile
+  beforeAll(() => {
+    global.isMobile = true
+  })
+  afterAll(() => {
+    global.isMobile = originalIsMobile
+  })
+
+  test('local paths get the file scheme', () => {
+    expect(toAttachmentPath('/tmp/a.png')).toBe('file:///tmp/a.png')
+  })
+
+  // A file:// kbfs path no longer reads as kbfs, so it would be handed to the
+  // native media processor as a local file that doesn't exist.
+  test('kbfs paths stay kbfs paths', () => {
+    const p = '/keybase/private/testuser,testuser-mac/a.jpeg'
+    expect(toAttachmentPath(p)).toBe(p)
+    expect(isKbfsPath(toAttachmentPath(p))).toBe(true)
+  })
+})
```

**File**: `shared/chat/conversation/attachment-path.tsx` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+import {normalizePath} from '@/styles'
+
+export const isKbfsPath = (path: string) => path.startsWith('/keybase/')
+
+// Local files need the file:// scheme on mobile, but kbfs paths aren't on disk:
+// the service reads them through SimpleFS and they must stay recognizable as kbfs.
+export const toAttachmentPath = (path: string) => (isKbfsPath(path) ? path : normalizePath(path))
```

**File**: `shared/chat/routes.tsx` (modified, +7/-14)
```diff
@@ -125,16 +125,8 @@ const AddToChannelHeaderRight = () => {
   )
 }
 
-const SendToChatHeaderLeft = ({canBack}: {canBack?: boolean}) => {
+const SendToChatHeaderLeft = () => {
   const clearModals = C.Router2.clearModals
-  const navigateUp = C.Router2.navigateUp
-  if (canBack) {
-    return (
-      <Kb.Text type="BodyBigLink" onClick={navigateUp}>
-        Back
-      </Kb.Text>
-    )
-  }
   return (
     <Kb.Text type="BodyBigLink" onClick={clearModals}>
       Cancel
@@ -315,12 +307,13 @@ export const newModalRoutes = defineRouteMap({
       getOptions: ({route}) => ({
         ...(isIOS
           ? {
-              unstable_headerLeftItems: () =>
-                route.params.canBack
-                  ? [Kb.nativeBackHeaderItem()]
-                  : [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
+              unstable_headerLeftItems: () => [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
             }
-          : {headerLeft: () => <SendToChatHeaderLeft canBack={route.params.canBack} />}),
+          : isMobile
+            ? {headerLeft: () => <SendToChatHeaderLeft />}
+            : {}),
+        // sized like chatAttachmentGetTitles, which it pushes, so the modal doesn't jump
+        modalSize: 'wide',
         title: FS.getSharePathArrayDescription(route.params.sendPaths || []),
       }),
       skipProvider: true,
```

---

### Incident Patch 4: `10af1e5d` (2026-09-28)
**Commit Message**: CLAUDE.md: add debugging rules (evidence before diagnosis, base-branch check, whole-repo dead-code search) (#29688)

**File**: `CLAUDE.md` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@
 - Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
+## Debugging
+- Evidence before diagnosis: when the user reports seeing something, never answer "that can't happen" from reading code. Reproduce it or add logging first, and only then name a cause.
+- For a user-reported runtime bug, check whether it reproduces on the base branch before blaming the current branch. (Lint, tsc and test failures after our changes are still ours.)
+- Before calling code dead, search the whole repo (desktop, native, Go callers, string-built names), not one directory.
+- Prefer fixes that keep underlying state truthful (e.g. a UI-level hold) over changing state semantics, unless asked.
+
 ## Working Directory
 Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.
 
```

---

### Incident Patch 5: `434e2d1d` (2026-09-28)
**Commit Message**: docs(skills): fix stale facts and conflicting rules in agent instructions (#29687)

Point prod-bundles and update-dependencies at the Vite build, drop the
removed morgan resolution, validate with yarn lint:all everywhere, keep
plan files uncommitted, move screenshot skills to playwright-cli, and
remove the stale merge log, grep claim, and hardcoded home path.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -19,4 +19,4 @@
 - During refactors, do not delete existing guards, conditionals, or platform/test-specific behavior unless you have proven they are dead and the user asked for that behavior change. Port checks like `androidIsTestDevice` forward into the new code path instead of silently dropping them.
 - When addressing PR or review feedback, including bot or lint-style suggestions, do not apply it mechanically. Verify that the reported issue is real in this codebase and that the proposed fix is consistent with repo rules and improves correctness, behavior, or maintainability before making changes.
 - When a repo plan starts with a test or regression-coverage chunk, do that chunk before implementation chunks. Do not skip the first coverage phase; if local toolchain constraints prevent adding or running the planned tests, stop and tell the user before moving on.
-- When working from a repo plan or checklist such as `PLAN.md`, update the checklist in the same change and mark implemented items done before you finish.
+- When working from a plan or checklist under `plans/`, mark implemented items done as you go. Plan files are scratch and stay uncommitted.
```

**File**: `plans/flow-test.md` (removed, +0/-327)
```diff
@@ -1,327 +0,0 @@
-# E2E Flow Test Coverage — Page Checklist
-
-**Skill:** Use the `keybase-e2e-tests` skill for testID conventions, Playwright gotchas, Appium/WebdriverIO patterns, and iOS navigation structure.
-
-Each bucket is a logical group for one or more PRs. Items are ordered easiest-first within each bucket. Validate after each bucket before moving on.
-
-**Pairing rule:** Buckets 1–15: do Electron and iOS together. Buckets 16+ (visual-coverage expansion): Electron first; iOS gets a follow-up pass once the desktop suite is stable.
-
-**Branch scripts:** `yarn test:e2e:desktop:branch` and `yarn test:e2e:ios:branch` run only the new flows being developed. When a flow is verified working on both platforms, remove it from the branch scripts. When adding a new bucket's test files, add them to both scripts.
-
-**Goal:** 100% visual coverage of the app. Every test's final screenshot is a visual-regression baseline (playwright `screenshot: 'on'` + `yarn test:e2e:desktop:save-baseline`), and the dark-mode project doubles every shot for free. So coverage = one test per distinct visual state: routes, modals, popups, scroll positions, filled inputs.
-
-**Mutations are now IN SCOPE** when the flow is reproducible:
-- **Create → cleanup in the same test.** A test that creates something must delete it before it ends (git repo, channel, email address, paper key). Use fixed `e2e-vis-*` names and delete any leftover at test start so a crashed run self-heals.
-- **Open → cancel is always fine.** Any modal/wizard can be opened and screenshotted as long as the test cancels before the final submit when the mutation isn't cleanly reversible.
-- **Never touch:** account deletion/reset, revoking a real device (paper keys created by the test are OK), logging out, changing the password, verifying a phone number, creating/revoking real proofs, leaving or deleting real teams, blocking real users. See the Forbidden list at the bottom.
-- Avoid visual nondeterminism: created objects use fixed names, message sends go to a dedicated e2e conversation (accept that its history grows — screenshot the input/modal states, not the message list).
-
-**testID rule:** Never wrap existing component content in a new `Kb.Box2` (or any container) just to attach a `testID`. Instead, add the `testID` prop directly to an element that already exists in the component — an input, a scroll view, a pre-existing wrapper, etc.
-
----
-
-## Bucket 1 — Crypto sub-tabs (inputs)
-
-Navigate to each sub-tab in the Crypto section.
-
-- [x] Encrypt input renders
-- [x] Decrypt input renders
-- [x] Sign input renders
-- [x] Verify input renders
-
----
-
-## Bucket 2 — Crypto outputs
-
-Type something in each sub-tab and run it to see the output screen. Local-only operation, no server mutation.
-
-- [x] Encrypt → output screen renders (Electron ✓, iOS written)
-- [x] Decrypt → output screen renders — encrypt first, feed ciphertext to decrypt (Electron ✓, iOS: needs clipboard support, skipped)
-- [x] Sign → output screen renders (Electron ✓, iOS written)
-- [x] Verify → output screen renders — sign first, feed signed text to verify (Electron ✓, iOS: needs clipboard support, skipped)
-
----
-
-## Bucket 3 — Chat: conversation view
-
-Open an existing conversation. No sending.
-
-- [x] Open first inbox row → message list renders (Electron ✓, iOS written)
-- [x] Chat input visible in open conversation (Electron ✓, iOS: chat-send-message.yaml already covers this)
-- [x] Return to inbox from conversation (Electron ✓, iOS written)
-
----
-
-## Bucket 4 — Chat: in-conversation modals
-
-From an open conversation, open each of these. Dismiss/cancel without submitting.
-
-- [x] Info panel (the ⓘ / conversation info button) (Electron ✓ chat-modals.test.ts, iOS ✓ visual-states.test.ts via native More→Info menu)
-- [x] Message popup / context menu (long-press or right-click a message) (Electron ✓)
-- [x] Emoji picker (tap emoji button in input area) (Electron ✓)
-- [x] Search bots modal (info pa
```

**File**: `skill/electron-screenshot/SKILL.md` (modified, +16/-11)
```diff
@@ -3,37 +3,42 @@ name: electron-screenshot
 description: This skill should be used when the user asks to "take a desktop screenshot", "screenshot the electron app", "show me the desktop app", "what does the app look like", or mentions checking the Electron/desktop UI visually.
 ---
 
-Take a screenshot of the running Electron app via Playwright MCP and display it.
+Take a screenshot of the running Electron app with `playwright-cli` and display it. The playwright-cli skill's "Connecting to the Electron App" section has the details on attaching and tab selection.
 
 ## Prerequisites
 
 The Electron app must be running with remote debugging enabled:
 ```
-KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot
+cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot
 ```
 This launches Electron with `--remote-debugging-port=9222`.
 
 ## Steps
 
-1. Close the DevTools tab first to avoid stale data. Use `browser_tabs` with action=list, then action=close on the DevTools tab (usually index 0).
+1. Attach (once per session; `--persistent` is required for Electron):
+   ```
+   PLAYWRIGHT_MCP_CDP_ENDPOINT=http://localhost:9222 playwright-cli open --persistent
+   ```
 
-2. Select the main app window tab (the one titled "Keybase: ..." — usually index 1 after DevTools is closed it becomes index 0). Use `browser_tabs` with action=list then action=select.
+2. Select the main app window. Tab order is not stable, so never reuse a remembered index: run `playwright-cli tab-list`, `playwright-cli tab-select <index>` on the row whose URL contains `main.html`, and confirm with `playwright-cli eval "location.href"`.
 
-3. Take a screenshot with `browser_take_screenshot`.
+3. Take the screenshot:
+   ```
+   playwright-cli screenshot --filename=/tmp/electron-screenshot-full.png
+   ```
 
-4. The screenshot is saved to a temp file. Resize it for token efficiency:
+4. Resize it for token efficiency:
    ```
-   sips -Z 800 <screenshot_path> --out /tmp/electron-screenshot.png
+   sips -Z 800 /tmp/electron-screenshot-full.png --out /tmp/electron-screenshot.png
    ```
 
-5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user.
+5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user. If it shows the menubar or DevTools instead of the main window, go back to step 2.
 
 ## Error Handling
 
-- If Playwright MCP cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`.
-- If `sips` fails, fall back to displaying the original screenshot directly.
+- If playwright-cli cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`.
+- If `sips` fails, fall back to displaying the full-size screenshot directly.
 
 ## Notes
 
-- Tab 0 is typically DevTools, Tab 1 is the main app, Tab 2 is the menubar. Always close DevTools first — when it's open, `browser_evaluate` and `browser_snapshot` run against DevTools instead of the app.
 - 800px max dimension gives good legibility with ~90% token savings.
```

**File**: `skill/keybase-e2e-tests/SKILL.md` (modified, +2/-6)
```diff
@@ -7,7 +7,7 @@ description: Use when writing, fixing, or adding e2e flow tests for the Keybase
 
 ## Overview
 
-Two harnesses, one shared testID registry. Always implement Electron + iOS for each bucket together (pairing rule in `plans/flow-test.md`).
+Two harnesses, one shared testID registry. Implement each flow on Electron and iOS together.
 
 ## Shared testID Registry
 
@@ -52,15 +52,11 @@ Drives the **already-installed** app black-box (no rebuild). Selectors: `~<testI
 **Gotchas (hard-won — read before adding flows):**
 - **Native tab bar:** tap tabs by **label** (`tab('People')` → `~People`), NOT `nav-tab-*` testIDs — those don't reach the native `UITabBar`.
 - **Container testIDs** (a flex `Kb.Box2` wrapping a list) report `visible="false"` to XCUITest even when on screen → use `waitForTestID` (it uses `waitForExist`, presence), never `toBeDisplayed`.
-- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS (see [[project_e2e_testid_mobile_branch]]). Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
+- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS, so a flow that waits on it passes on desktop while testing nothing on iOS. Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
 - **`byText` uses CONTAINS** — tappable rows have merged accessibility labels (e.g. `", Crypto"`), so exact match fails.
 - **`Kb.Tabs`** supports a per-tab `testID` (needed for icon-only tabs like the team Settings gear). The app remembers the last-selected team tab → select tabs by testID, don't assume the default.
 - **Modals:** dismiss via Done/Close/Cancel (`escapeToTabs` does this first, before back buttons — a modal's back button is a no-op that loops).
 - **HMR applies testID/component changes** to the running sim app — no manual reload needed when adding testIDs.
 - Wait for a **real data row** (not just the list container) before asserting/screenshotting, so shots show loaded content.
 
 **iOS tab structure:** People & Teams are direct tabs; Chat & Files have their own nav helpers; Crypto/Devices/Git/Settings live under the **More** tab (`navigateToMore`).
-
-## Plan
-
-`plans/flow-test.md` — bucket checklist ordered easiest-first. Work one bucket at a time, both platforms together.
```

**File**: `skill/keybase-rpc-log-analysis/SKILL.md` (modified, +0/-2)
```diff
@@ -175,8 +175,6 @@ not `getMessagesRemote`. The script says so when it finds no counts.
   for it. Check whether it recurs on a timer before spending time on it.
 - **Reporting a burst as same-subject when it is not.** See the BURSTS caveat
   above. If it matters, prove the subject repeats before claiming it.
-- **Using plain `grep`.** It is wrapped in this environment and truncates. Use
-  python, as the scripts do.
 - **Comparing unlike runs.** `rpc-diff.py` is only meaningful if both runs did
   the same thing — same tests, same order, same project, renderer reloaded
   between them. See "Prove a fix".
```

---

### Incident Patch 6: `a293644b` (2026-09-25)
**Commit Message**: fix(router): keep the logged-in screens mounted through an account switch (#29622)

* fix(mobile): keep the logged-in screens mounted through an account switch

A switch flaps config.loggedIn false and back to true. The mobile root stack
followed it, so every switch swapped to the logged-out stack, back, and then
remounted the navigator, three native rebuilds in about 130 ms. RNS logged
unbalanced appearance transitions, and could leave the torn-down navigator's
screens on top. Every touch was then dropped and the app looked frozen. It
also sometimes logged an unhandled POP for the root 'loggedIn' screen.

Hold the mobile logged-in screens through a switch that started logged in
(showLoggedInScreens). A switch that starts logged out, e.g. a notification
tap on the login screen, keeps the logged-out screens until it lands.
Desktop keeps its loggedIn || userSwitching gate.

Holding the logged-in screens means userSwitching must clear whenever a
switch ends without the remount:
- login() now clears it when it cancels one of its own prompts, and when it
  fails without an RPCError. Otherwise the app stayed on the old account's
  screens with reset stores.
- The provisioning hand-off cl

**File**: `CLAUDE.md` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@
 - After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
 - Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
 - When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
+- Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
 ## Working Directory
@@ -29,4 +30,4 @@ Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths
 ## Validation
 After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
 
-Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
+Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, first get both `yarn lint:all` and `yarn test:unit` passing — never review, push, or open a PR with either failing. Then, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
```

**File**: `shared/chat/conversation/input-area/input-state.test.tsx` (modified, +82/-0)
```diff
@@ -962,3 +962,85 @@ test('a commandStatus written while the provider is frozen is applied on thaw',
 
   expect(inputState?.commandStatus).toEqual(commandStatusInfo)
 })
+
+describe('a pending draft save', () => {
+  const typeThenWait = (switchAccount: boolean) => {
+    jest.useFakeTimers()
+    try {
+      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
+      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
+      renderComposer()
+      act(() => {
+        mockPlatformInputProps?.onChangeText('a')
+      })
+      // inside the 200ms throttle, so this save waits for its trailing edge
+      act(() => {
+        mockPlatformInputProps?.onChangeText('ab')
+      })
+      if (switchAccount) {
+        act(() => {
+          useCurrentUserState.getState().dispatch.setBootstrap({
+            deviceID: 'device-id-2',
+            deviceName: 'test-device-2',
+            uid: 'uid-2',
+            username: 'testuser-mac',
+          })
+        })
+      }
+      act(() => {
+        jest.advanceTimersByTime(250)
+      })
+      return saveDraft.mock.calls.map(c => c[0].text)
+    } finally {
+      jest.useRealTimers()
+    }
+  }
+
+  test('is saved for the account that typed it', () => {
+    expect(typeThenWait(false)).toContain('ab')
+  })
+
+  test('is not saved for the next account when a switch lands first', () => {
+    expect(typeThenWait(true)).not.toContain('ab')
+  })
+})
+
+describe('a draft typed just before leaving the conversation', () => {
+  const typeThenUnmount = (switchAccount: boolean) => {
+    jest.useFakeTimers()
+    try {
+      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
+      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
+      const {unmount} = renderComposer()
+      act(() => {
+        mockPlatformInputProps?.onChangeText('a')
+      })
+      // inside the 200ms throttle, so this save is still pending at unmount
+      act(() => {
+        mockPlatformInputProps?.onChangeText('ab')
+      })
+      if (switchAccount) {
+        act(() => {
+          useCurrentUserState.getState().dispatch.setBootstrap({
+            deviceID: 'device-id-2',
+            deviceName: 'test-device-2',
+            uid: 'uid-2',
+            username: 'testuser-mac',
+          })
+        })
+      }
+      unmount()
+      return saveDraft.mock.calls.map(c => c[0].text)
+    } finally {
+      jest.useRealTimers()
+    }
+  }
+
+  test('is saved when the composer unmounts', () => {
+    expect(typeThenUnmount(false)).toContain('ab')
+  })
+
+  test('is not saved for the next account when the unmount comes from a switch', () => {
+    expect(typeThenUnmount(true)).not.toContain('ab')
+  })
+})
```

**File**: `shared/chat/conversation/input-area/normal/index.tsx` (modified, +8/-7)
```diff
@@ -241,7 +241,13 @@ const ConnectedPlatformInput = function ConnectedPlatformInput() {
   // throttled draft-save path rather than from onChangeText, so the composer does not
   // re-render on every keystroke. The preview debounces another 500ms downstream anyway.
   const [previewText, setPreviewText] = React.useState('')
+  // The account this composer was mounted for. After an account switch the service saves drafts
+  // for the next account, so the unmount flush of a draft typed here must not save it there.
+  const [composerUid] = React.useState(() => useCurrentUserState.getState().uid)
   const updateDraftRaw = (text: string) => {
+    if (useCurrentUserState.getState().uid !== composerUid) {
+      return
+    }
     // Immediately update local meta.draft so switching back to this thread
     // before the async unbox completes won't re-inject the old stale draft.
     // Merges from the current meta (same inbox version), so force past gating.
@@ -259,13 +265,8 @@ const ConnectedPlatformInput = function ConnectedPlatformInput() {
     }
     C.ignorePromise(f())
   }
-  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {trailing: true})
-  // Flush any pending draft save before cancel fires on unmount (hooks cleanup runs in reverse order)
-  React.useLayoutEffect(() => {
-    return () => {
-      updateDraft.flush()
-    }
-  }, [updateDraft])
+  // flushOnUnmount: leaving the conversation must still save what was typed in the last 200ms
+  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {flushOnUnmount: true, trailing: true})
 
   const textValueRef = React.useRef('')
   const onChangeText = (text: string) => {
```

**File**: `shared/chat/conversation/thread-context.test.tsx` (modified, +43/-0)
```diff
@@ -246,6 +246,7 @@ const separatePlainThreadWrapper = ({children}: {children: React.ReactNode}) =>
 )
 
 beforeEach(() => {
+  useConfigState.setState({loggedIn: true})
   useCurrentUserState.getState().dispatch.setBootstrap({
     deviceID: 'device-id',
     deviceName: 'test-device',
@@ -844,6 +845,48 @@ test('active change marks read after an eligible mounted thread load', async ()
   })
 })
 
+test('a thread still on screen after an account switch does not mark read for the next account', async () => {
+  useConfigState.setState({loggedIn: true})
+  useShellState.getState().dispatch.setActive(false)
+  jest
+    .spyOn(Common, 'isUserActivelyLookingAtThisThread')
+    .mockImplementation(() => useShellState.getState().active)
+  const markAsRead = jest
+    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
+    .mockResolvedValue({offline: false})
+  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
+    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
+      thread: JSON.stringify({
+        messages: [makeValidTextUIMessage(T.Chat.numberToMessageID(603), 'loaded inactive')],
+        pagination: {last: true, next: '', num: 100, previous: ''},
+      }),
+    })
+    await Promise.resolve()
+    return {offline: false}
+  })
+  const {result} = renderHook(() => useConversationThreadLoadMoreMessages(), {wrapper})
+  act(() => {
+    result.current({reason: 'tab selected'})
+  })
+  await act(async () => {
+    await flushPromises()
+  })
+
+  act(() => {
+    useCurrentUserState.getState().dispatch.setBootstrap({
+      deviceID: 'device-id-2',
+      deviceName: 'test-device-2',
+      uid: 'uid-2',
+      username: 'testuser-mac',
+    })
+    useShellState.getState().dispatch.setActive(true)
+  })
+  await act(async () => {
+    await flushPromises()
+  })
+  expect(markAsRead).not.toHaveBeenCalled()
+})
+
 test('active change does not mark read after a centered thread load', async () => {
   useConfigState.setState({loggedIn: true})
   useShellState.getState().dispatch.setActive(false)
```

**File**: `shared/chat/conversation/thread-context.tsx` (modified, +7/-0)
```diff
@@ -403,6 +403,9 @@ const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) =>
   const lookingAtThread = active && appFocused && routeFocused
   const previousLookingAtThreadRef = React.useRef(lookingAtThread)
   const activeMarkReadEnabledRef = React.useRef(false)
+  // The account this thread was loaded for. Its screen outlives an account switch by a few renders,
+  // and a mark-read sent then would mark the next account's read position.
+  const [threadUid] = React.useState(() => useCurrentUserState.getState().uid)
   const markReadBlockedRef = React.useRef(false)
 
   const getSnapshot = React.useEffectEvent(() => threadStore.getState())
@@ -422,6 +425,10 @@ const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) =>
         logger.info('mark read bail on not logged in')
         return
       }
+      if (useCurrentUserState.getState().uid !== threadUid) {
+        logger.info('mark read bail on thread loaded for another account')
+        return
+      }
       if (!T.Chat.isValidConversationIDKey(id)) {
         logger.info('mark read bail on no selected conversation')
         return
```

---

### Incident Patch 7: `558c60e6` (2026-09-24)
**Commit Message**: fix(protocol): regen rpc-gen.tsx after dropping reachabilityChanged (#29684)

* chore(protocol): regen rpc-gen.tsx after dropping reachabilityChanged

* docs(claude): regen rpc-gen.tsx after protocol/enabled-calls edits

* docs(claude): never hand-edit generated code

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@
 - Keep `react`, `react-dom`, `react-native`, `@react-native/*` in sync with Expo SDK.
 - When updating deps: edit `package.json` → `yarn` → `yarn ios:pod:install`.
 - After editing `rnmodules/react-native-kb/`: run `yarn sync:kb-modules` before building. `shared/node_modules/react-native-kb` is a copy, not a symlink, and Xcode compiles the copy — skipping this builds stale sources and reports errors against code you already fixed. `rnmodules/kb-common/` needs no sync (the Podfile references it by path).
+- After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
+- Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
 - When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
```

**File**: `shared/constants/rpc/rpc-gen.tsx` (modified, +2/-5)
```diff
@@ -963,10 +963,6 @@ export type MessageTypes = {
     inParam: undefined,
     outParam: Reachability,
   },
-  'keybase.1.reachability.reachabilityChanged': {
-    inParam: {readonly reachability: Reachability},
-    outParam: void,
-  },
   'keybase.1.reachability.startReachability': {
     inParam: undefined,
     outParam: Reachability,
@@ -3125,7 +3121,7 @@ export type WalletAccountInfo = {readonly accountID: string,readonly numUnread:
 export type WebProof = {readonly hostname: string,readonly protocols?: ReadonlyArray<string> | null,}
 export type WriteArgs = {readonly opID: OpID,readonly path: Path,readonly offset: number,}
 
-type IncomingMethod = 'keybase.1.NotifyAudit.boxAuditError' | 'keybase.1.NotifyAudit.rootAuditError' | 'keybase.1.NotifyBadges.badgeState' | 'keybase.1.NotifyDeviceHistory.deviceHistoryChanged' | 'keybase.1.NotifyFS.FSActivity' | 'keybase.1.NotifySession.loggedOut' | 'keybase.1.NotifyTracking.trackingChanged' | 'keybase.1.NotifyUsers.userChanged' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.pgpUi.finished' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.reachability.reachabilityChanged' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent'
+type IncomingMethod = 'keybase.1.NotifyAudit.boxAuditError' | 'keybase.1.NotifyAudit.rootAuditError' | 'keybase.1.NotifyBadges.badgeState' | 'keybase.1.NotifyDeviceHistory.deviceHistoryChanged' | 'keybase.1.NotifyFS.FSActivity' | 'keybase.1.NotifySession.loggedOut' | 'keybase.1.NotifyTracking.trackingChanged' | 'keybase.1.NotifyUsers.userChanged' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.pgpUi.finished' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent'
 export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>
 
 type CustomIncomingMethod = 'keybase.1.NotifyApp.exit' | 'keybase.1.NotifyEmailAddress.emailAddressVerified' | 'keybase.1.NotifyEmailAddress.emailsChanged' | 'keybase.1.NotifyFS.FSOverallSyncStatusChanged' | 'keybase.1.NotifyFS.FSSubscriptionNotify' | 'keybase.1.NotifyFS.FSSubscriptionNotifyPath' | 'keybase.1.NotifyFeaturedBots.featuredBotsUpdate' | 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile' | 'keybase.1.NotifyPhoneNumber.phoneNumbersChanged' | 'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate' | 'keybase.1.NotifyService.HTTPSrvInfoUpdate' | 'keybase.1.NotifyService.handleKeybaseLink' | 'keybase.1.NotifyService.shutdown' | 'keybase.1.NotifySession.clientOutOfDate' | 'keybase.1.NotifySession.loggedIn' | 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged' | 'keybase.1.NotifyTeam.avatarUpdated' | 'keybase.1.NotifyTeam.teamChangedByID' | 'keybase.1.NotifyTeam.teamDeleted' | 'keybase.1.NotifyTeam.teamExit' | 'keybase.1.NotifyTeam.teamMetadataUpdate' | 'keybase.1.NotifyTeam.teamRoleMapChanged' | 'keybase.1.NotifyTeam.teamTreeMembershipsDone' | 'keybase.1.NotifyTeam.teamTreeMembershipsPartial' | 'keybase.1.NotifyTracking.notifyUserBlocked' | 'keybase.1.NotifyTracking.trackingInfo' | 'keybase.1.NotifyUsers.identifyUpdate' | 'keybase.1.NotifyUsers.passwordChanged' | 'keybase.1.gpgUi.selectKey' | 'keybase.1.gpgUi.wantToAddGPGKey' | 'keybase.1.gregorUI.pushState' | 'keybase.1.homeUI.homeUIRefresh' | 'keybase.1.identify3Ui.identify3Result' | 'keybase.1.identify3Ui.identify3ShowTracker' | 'keybase.1.identif
```

---

### Incident Patch 8: `b4f11702` (2026-09-24)
**Commit Message**: fix(protocol): drop reachabilityChanged from enabled incoming calls (#29683)

* fix(protocol): drop reachabilityChanged from enabled incoming calls

The JS side stopped handling it in #29675, but only the generated
index.tsx was edited, so CI's regen put the union member back.

* docs(claude): skip /code-review for trivial diffs

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -27,4 +27,4 @@ Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths
 ## Validation
 After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
 
-Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it.
+Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
```

**File**: `protocol/bin/enabled-calls.json` (modified, +0/-1)
```diff
@@ -390,7 +390,6 @@
   "keybase.1.provisionUi.chooseGPGMethod": {"custom":true},
   "keybase.1.provisionUi.switchToGPGSignOK": {"custom":true},
   "keybase.1.reachability.checkReachability": {"promise":true},
-  "keybase.1.reachability.reachabilityChanged": {"incoming":true},
   "keybase.1.reachability.startReachability": {"promise":true},
   "keybase.1.rekey.getRevokeWarning": {"promise":true},
   "keybase.1.rekey.rekeyStatusFinish": {"promise":true},
```

---

### Incident Patch 9: `e4b47fad` (2026-09-23)
**Commit Message**: fix(android): process lifecycle, foreground pushes and quick replies (#29676)

* fix(android): process lifecycle, foreground pushes, quick reply off the main thread

One lifecycle reporter: AppLifecycleReporter (ProcessLifecycleOwner) talks to
Go and JS through a LifecycleBind seam so the mapping runs in JVM tests.
MainActivity resume/finishing-destroy go through it too.

Pushes always reach Go. In the foreground master returned before calling
handleBackgroundNotification, so a foreground push was never unboxed or
acked; now Go handles it with a notifier that does not display while the app
is in the foreground. In the background Go is held in BACKGROUNDACTIVE around
the work, then appDidEnterBackground decides whether to keep running.

Quick reply runs on a worker thread under goAsync with a status
notification, is not sent when logged out or for a negative message id (Go
sends before it checks either and swallows the send's error), and is sent in
the foreground too (master skipped it).

Also: one unique periodic background sync job (legacy duplicates cancelled
once), share intents handed over when JS registers instead of polling, and
the Kotlin seen-set capped at 100.

Flush audit

**File**: `shared/android/app/build.gradle` (modified, +2/-0)
```diff
@@ -171,6 +171,8 @@ dependencies {
     implementation 'com.android.installreferrer:installreferrer:2.2'
     implementation "androidx.lifecycle:lifecycle-common-java8:2.10.0"
     implementation "androidx.lifecycle:lifecycle-process:2.10.0"
+
+    testImplementation "junit:junit:4.13.2"
 }
 
 // This requires a google-services.json file locally.  Drop it in
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/AppLifecycleForwarder.kt` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-package io.keybase.ossifrage
-
-import android.content.Context
-import android.os.Bundle
-import androidx.lifecycle.DefaultLifecycleObserver
-import androidx.lifecycle.LifecycleOwner
-import com.reactnativekb.KbModule
-import io.keybase.ossifrage.modules.NativeLogger
-import keybase.Keybase
-
-// Reports the whole process's visibility, not one activity's, to Go and JS
-// together, so both see the same state. Process ON_STOP only fires once no
-// activity is started, so moving between our own activities never looks like a
-// trip to the background.
-internal class AppLifecycleForwarder(private val context: Context) : DefaultLifecycleObserver {
-    override fun onStart(owner: LifecycleOwner) = foreground("onStart")
-
-    override fun onResume(owner: LifecycleOwner) = foreground("onResume")
-
-    override fun onStop(owner: LifecycleOwner) {
-        NativeLogger.info("AppLifecycleForwarder: process onStop")
-        // appDidEnterBackground already reports BACKGROUND (and flushes) when it
-        // returns false; calling setAppStateBackground too would flush twice.
-        if (Keybase.appDidEnterBackground()) {
-            Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
-        }
-        KbModule.emitAppLifecycle("background")
-    }
-
-    private fun foreground(event: String) {
-        NativeLogger.info("AppLifecycleForwarder: process $event")
-        Keybase.setAppStateForeground()
-        KbModule.emitAppLifecycle("active")
-    }
-}
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/AppLifecycleReporter.kt` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+package io.keybase.ossifrage
+
+import androidx.lifecycle.DefaultLifecycleObserver
+import androidx.lifecycle.LifecycleOwner
+import java.util.concurrent.CountDownLatch
+import java.util.concurrent.TimeUnit
+
+// Go's lifecycle entry points and the JS app-state event. Kept free of Android
+// and gomobile calls so the event mapping and the push window run in JVM tests.
+internal interface LifecycleBind {
+    fun setAppStateForeground()
+    fun setAppStateBackgroundActive()
+    fun isAppStateForeground(): Boolean
+    fun appDidEnterBackground(): Boolean
+    fun appBeginBackgroundTaskNonblock()
+    fun appWillExit()
+    fun emitAppLifecycle(state: String)
+}
+
+// Reports the whole process's visibility, not one activity's, to Go and JS
+// together, so both see the same state. Process ON_STOP only fires once no
+// activity is started, so moving between our own activities, dialogs and
+// permission prompts never looks like a trip to the background.
+//
+// Calls reach Go on the calling thread, before the callback returns.
+internal class AppLifecycleReporter(
+    private val bind: LifecycleBind,
+    private val log: (String) -> Unit,
+) : DefaultLifecycleObserver {
+    override fun onStart(owner: LifecycleOwner) = foreground("process onStart")
+
+    override fun onResume(owner: LifecycleOwner) = foreground("process onResume")
+
+    override fun onStop(owner: LifecycleOwner) {
+        report("process onStop") {
+            // appDidEnterBackground already reports BACKGROUND (and flushes) when
+            // it returns false; calling setAppStateBackground too would flush twice.
+            if (bind.appDidEnterBackground()) {
+                bind.appBeginBackgroundTaskNonblock()
+            }
+        }
+        bind.emitAppLifecycle("background")
+    }
+
+    fun onMainActivityResume() = foreground("MainActivity onResume")
+
+    // Activity recreation and a task moved to the back are not an exit.
+    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
+        if (!isFinishing || isChangingConfigurations) {
+            return
+        }
+        report("MainActivity finishing") { bind.appWillExit() }
+        bind.emitAppLifecycle("background")
+    }
+
+    private fun foreground(event: String) {
+        report(event) { bind.setAppStateForeground() }
+        bind.emitAppLifecycle("active")
+    }
+
+    private fun report(event: String, call: () -> Unit) {
+        log("AppLifecycleReporter: $event")
+        try {
+            call()
+        } catch (e: Exception) {
+            log("AppLifecycleReporter: $event failed: $e")
+        }
+    }
+}
+
+// Sends a notification quick reply. Returns the text for the replied
+// notification. notificationUID is the account the notification was shown for;
+// Go posts as whichever account is current, so a reply from another account's
+// notification is refused.
+internal fun sendQuickReply(
+    currentUID: () -> String,
+    notificationUID: String,
+    msgId: Long,
+    error: (String, Throwable?) -> Unit,
+    send: () -> Unit,
+): String {
+    val uid = try {
+        currentUID()
+    } catch (e: Exception) {
+        error("Quick reply couldn't read the current uid", e)
+        return QUICK_REPLY_FAILED
+    }
+    // Go sends before it checks either, and swallows the send's error.
+    if (uid.isEmpty()) {
+        error("Quick reply while logged out", null)
+        return QUICK_REPLY_FAILED
+    }
+    if (uid != notificationUID) {
+        error("Quick reply from another account's notification", null)
+        return QUICK_REPLY_FAILED
+    }
+    if (msgId < 0) {
+        error("Quick reply to invalid message id $msgId", null)
+        return QUICK_REPLY_FAILED
+    }
+    return try {
+        send()
+        QUICK_REPLY_SENT
+    } catch (e: Exception) {
+        error("Failed to send quick reply", e)
+        QUICK_REPLY_FAILED
+    }
+}
+
+// Runs a receiver's work off the main thread and cal
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/ChatBroadcastReceiver.kt` (modified, +25/-21)
```diff
@@ -19,50 +19,53 @@ class ChatBroadcastReceiver : BroadcastReceiver() {
     }
 
     override fun onReceive(context: Context, intent: Intent) {
-        setupKBRuntime(context, false)
         val convData = ConvData.fromIntent(intent)
         val openConv = intent.getParcelableExtra<PendingIntent>("openConvPendingIntent")
-        val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
-                .setContentIntent(openConv)
-                .setTimeoutAfter(1000)
-                .setSmallIcon(R.drawable.ic_notif)
-        val notificationManager = NotificationManagerCompat.from(context)
         val messageBody = getMessageText(intent)
-        if (messageBody != null) {
-            try {
-                val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
-                    override fun task() {
+        val pendingResult = goAsync()
+        runReceiverWork(RECEIVER_BUDGET_MS, { Thread(it).start() }, { NativeLogger.warn(it) }, { msg, e -> NativeLogger.error(msg, e) },
+                { pendingResult.finish() }) {
+            val status = if (messageBody == null) {
+                NativeLogger.error("Message Body in quick reply was null")
+                "Couldn't send reply - Failed to read input."
+            } else {
+                setupKBRuntime(context, false)
+                sendQuickReply({ Keybase.currentUID() }, convData.uid, convData.lastMsgId, { msg, e -> NativeLogger.error(msg, e) }) {
+                    withBackgroundActive(KeybaseLifecycleBind(context), null, { NativeLogger.info(it) }) {
                         Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody)
                     }
                 }
-                withBackgroundActive.whileActive(context)
-                repliedNotification.setContentText("Replied")
-            } catch (e: Exception) {
-                repliedNotification.setContentText("Couldn't send reply")
-                NativeLogger.error("Failed to send quick reply", e)
             }
-        } else {
-            repliedNotification.setContentText("Couldn't send reply - Failed to read input.")
-            NativeLogger.error("Message Body in quick reply was null")
+            val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
+                    .setContentIntent(openConv)
+                    .setTimeoutAfter(1000)
+                    .setSmallIcon(R.drawable.ic_notif)
+                    .setContentText(status)
+            NotificationManagerCompat.from(context).notify(convData.convID, 0, repliedNotification.build())
         }
-        notificationManager.notify(convData.convID, 0, repliedNotification.build())
     }
 
     companion object {
         const val KEY_TEXT_REPLY = "key_text_reply"
+
+        // goAsync gives a broadcast 10s; leave margin.
+        private const val RECEIVER_BUDGET_MS = 9_000L
     }
 }
 
 internal data class ConvData(
     @JvmField val convID: String?,
     val tlfName: String?,
-    val lastMsgId: Long
+    val lastMsgId: Long,
+    // The account the notification belongs to.
+    val uid: String,
 ) {
     fun intoIntent(context: Context?): Intent {
         val data = Bundle()
         data.putString("convID", convID)
         data.putString("tlfName", tlfName)
         data.putLong("lastMsgId", lastMsgId)
+        data.putString("uid", uid)
         val intent = Intent(context, ChatBroadcastReceiver::class.java)
         intent.putExtra("ConvData", data)
         return intent
@@ -74,7 +77,8 @@ internal data class ConvData(
             return ConvData(
                 convID = data.getString("convID"),
                 tlfName = data.getString("tlfName"),
-                lastMsgId = data.getLong("lastMsgId")
+                lastMsgId = data.getLong("lastMsgId"),
+                uid = data.getString("uid") ?: 
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/KBPushNotifier.kt` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ class KBPushNotifier internal constructor(private val context: Context, private
                 bundle.putString("uid", chatNotification.uid)
             }
             val pending_intent = buildPendingIntent(bundle)
-            val convData = ConvData(chatNotification.convID, chatNotification.tlfName ?: "", chatNotification.message.id)
+            val convData = ConvData(chatNotification.convID, chatNotification.tlfName ?: "", chatNotification.message.id, chatNotification.uid ?: "")
             val builder = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
                 .setSmallIcon(R.drawable.ic_notif)
                 .setContentTitle(chatNotification.title ?: "")
```

---

### Incident Patch 10: `2f544862` (2026-09-23)
**Commit Message**: fix(js): treat session notifications as hints, read the daemon's state (#29675)

* fix(js): treat session notifications as hints and read the daemon's state

loggedIn, loggedOut and HTTPSrvInfoUpdate are sent from separate goroutines
and can reach the GUI out of order, so none of them sets the session any
more. Each starts a fresh bootstrap-status read, and only the latest read's
reply applies; a superseded read settles with the newer one. The session is
also re-read after login RPCs return and when the network comes back.

A reply for a different user while logged in logs out first, clearing the
old account's stores. A logged-out reply during an account switch is still
ignored, and is applied once the switch ends.

Reachability tracking is dropped: the service is no longer asked to start
it or send its notifications; a network change still nudges gregor through
checkReachability. The http server address survives a logout.

* fix(js): end a cancelled account switch so its logged-out status applies

A cancelled login (the PromptNewDeviceName hand-off, or a non-RPC error) left
userSwitching set, which withholds the logged-out session forever. Also drop
the bootstrap re-read on logged

**File**: `shared/constants/init/shared.test.ts` (modified, +241/-1)
```diff
@@ -1,9 +1,11 @@
 /// <reference types="jest" />
 import * as T from '@/constants/types'
 import {resetAllStores} from '@/util/zustand'
+import {RPCError} from '@/util/errors'
 import {useConfigState} from '@/stores/config'
+import {useCurrentUserState} from '@/stores/current-user'
 import {useDaemonState} from '@/stores/daemon'
-import {loadAccountsStep} from './shared'
+import {_onEngineIncoming, initSharedSubscriptions, loadAccountsStep, onNetworkOnlineChanged} from './shared'
 
 describe('loadAccountsStep', () => {
   const originalDispatch = useConfigState.getState().dispatch
@@ -65,3 +67,241 @@ describe('loadAccountsStep', () => {
     expect(useConfigState.getState().configuredAccounts.map(a => a.username)).toEqual(['testuser'])
   })
 })
+
+describe('onNetworkOnlineChanged', () => {
+  const originalDaemonDispatch = useDaemonState.getState().dispatch
+  afterEach(() => {
+    jest.restoreAllMocks()
+    useDaemonState.setState({dispatch: originalDaemonDispatch})
+    resetAllStores()
+  })
+
+  const spyOnReRead = () => {
+    // userSwitching survives resetAllStores on purpose, and an earlier test in this file sets it
+    useConfigState.getState().dispatch.setUserSwitching(false)
+    const reRead = jest.fn()
+    useDaemonState.setState({
+      dispatch: {...originalDaemonDispatch, refreshSessionFromDaemon: reRead},
+      handshakeState: 'done',
+    })
+    return reRead
+  }
+
+  test('re-reads the session when the network comes back', () => {
+    const reRead = spyOnReRead()
+    onNetworkOnlineChanged(true, false)
+    expect(reRead).toHaveBeenCalledTimes(1)
+  })
+
+  test('does not re-read on the first reading of the network at startup', () => {
+    const reRead = spyOnReRead()
+    onNetworkOnlineChanged(true, undefined)
+    expect(reRead).not.toHaveBeenCalled()
+  })
+
+  test('does not re-read when going offline', () => {
+    const reRead = spyOnReRead()
+    onNetworkOnlineChanged(false, true)
+    expect(reRead).not.toHaveBeenCalled()
+  })
+
+  test('does not re-read during an account switch', () => {
+    const reRead = spyOnReRead()
+    useConfigState.getState().dispatch.setUserSwitching(true)
+    onNetworkOnlineChanged(true, false)
+    expect(reRead).not.toHaveBeenCalled()
+  })
+
+  test('does not re-read before the handshake is done', () => {
+    const reRead = spyOnReRead()
+    useDaemonState.setState({handshakeState: 'loading'})
+    onNetworkOnlineChanged(true, false)
+    expect(reRead).not.toHaveBeenCalled()
+  })
+})
+
+describe('the session comes from the daemon; notifications only say to read it', () => {
+  const status = (over: Partial<T.RPCGen.BootstrapStatus> = {}) =>
+    ({
+      deviceID: 'd1',
+      deviceName: 'testuser-mac',
+      fullname: '',
+      loggedIn: true,
+      registered: true,
+      uid: 'u1',
+      username: 'testuser',
+      ...over,
+    }) as unknown as T.RPCGen.BootstrapStatus
+  const userA = status()
+  const userB = status({deviceID: 'd2', uid: 'u2', username: 'testuser2'})
+  const loggedOut = status({deviceID: '', deviceName: '', loggedIn: false, uid: '', username: ''})
+
+  let replies: Array<(bs: T.RPCGen.BootstrapStatus) => void> = []
+  const flush = async () => jest.advanceTimersByTimeAsync(0)
+  const notify = (type: string, params: unknown) => _onEngineIncoming({payload: {params}, type} as never)
+  const readReplying = async (bs: T.RPCGen.BootstrapStatus) => {
+    useDaemonState.getState().dispatch.refreshSessionFromDaemon('test')
+    await flush()
+    replies[replies.length - 1]?.(bs)
+    await flush()
+  }
+
+  // what resetAllStores clears, standing in for the previous account's state
+  const markAccountState = () => useConfigState.setState({justDeletedSelf: 'testuser'})
+  const accountStateCleared = () => useConfigState.getState().justDeletedSelf === ''
+  const loginChanges = () => {
+    const changes: Array<boolean> = []
+    const unsub = useConfigState.subscribe((st, prev) => {
+      if (st.loggedIn !== prev.loggedIn
```

**File**: `shared/constants/init/shared.tsx` (modified, +46/-19)
```diff
@@ -176,22 +176,20 @@ const onGregorPushStateChanged = (
   )
 }
 
-const onGregorReachableChanged = (gregorReachable: ConfigState['gregorReachable']) => {
-  // Re-get info about our account if you log in/we're done handshaking/became reachable
-  if (
-    gregorReachable === T.RPCGen.Reachable.yes &&
-    useDaemonState.getState().handshakeState === 'done' &&
-    !useConfigState.getState().userSwitching
-  ) {
-    ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
+// After an offline stretch, reread the session to pick up what the service learned while we could
+// not reach it. `previous === undefined` is the first reading of the network at startup, which the
+// handshake's own read already covers.
+export const onNetworkOnlineChanged = (online?: boolean, previous?: boolean) => {
+  if (!online || previous !== false) {
+    return
+  }
+  if (useDaemonState.getState().handshakeState === 'done' && !useConfigState.getState().userSwitching) {
+    useDaemonState.getState().dispatch.refreshSessionFromDaemon('back online')
   }
 }
 
 const onLoggedInChanged = (loggedIn: ConfigState['loggedIn']) => {
   if (loggedIn) {
-    // runtime login: refresh bootstrap status. During the handshake this is already in
-    // flight, and the store dedupes it.
-    ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
     scheduleStartupOrReloginWork()
   } else {
     clearSignupEmail()
@@ -221,23 +219,45 @@ const onBootstrapStatusChanged = (bootstrap: DaemonState['bootstrapStatus']) =>
   }
 
   const {deviceID, deviceName, loggedIn, uid, username} = bootstrap
-  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
-
   const configDispatch = useConfigState.getState().dispatch
-  if (username) {
-    configDispatch.setDefaultUsername(username)
-  }
+
+  // Before the identity: the user we hold is what tells the new account's session from the old.
+  // onUserSwitchingChanged applies the status once the switch ends.
   if (!loggedIn && useConfigState.getState().userSwitching) {
     logger.info('[Bootstrap] ignoring loggedIn=false result during account switch')
     return
   }
+
+  // Logged in as someone else than the user we hold is a logout and then a login, however the
+  // notifications in between reached us. Logging out clears the previous account's stores, the
+  // daemon's status among them, so put this status back and let that change apply it.
+  const currentUid = useCurrentUserState.getState().uid
+  if (loggedIn && useConfigState.getState().loggedIn && currentUid && uid !== currentUid) {
+    logger.info('[Bootstrap] the session is another user now, logging out the previous one')
+    configDispatch.setLoggedIn(false)
+    useDaemonState.getState().dispatch.setBootstrapStatus(bootstrap)
+    return
+  }
+
+  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
+  if (username) {
+    configDispatch.setDefaultUsername(username)
+  }
   configDispatch.setLoggedIn(loggedIn)
 
   if (bootstrap.httpSrvInfo) {
     configDispatch.setHTTPSrvInfo(bootstrap.httpSrvInfo.address, bootstrap.httpSrvInfo.token)
   }
 }
 
+// A switch that failed after the service logged out has a logged-out status nothing applied, and
+// a read after the switch returns the same status, which does not count as a change.
+const onUserSwitchingChanged = (userSwitching: ConfigState['userSwitching']) => {
+  if (!userSwitching) {
+    onBootstrapStatusChanged(useDaemonState.getState().bootstrapStatus)
+  }
+}
+
 // Native reports the app state from the same callbacks that report it to Go, and this is the only
 // writer of mobileAppState. Desktop has no lifecycle; its window focus goes straight to appFocused.
 export const applyMobileAppState = (state: AppLifecycleState) => {
@@ -325,7 +345,7 @@ export const onEngineConnected = () => {
             chatattachments: true, chatdev: false, chatemoji: false, chatemojicross: false, c
```

**File**: `shared/constants/rpc/index.tsx` (modified, +1/-2)
```diff
@@ -78,8 +78,7 @@ type Keybase1IncomingAction =
   'keybase.1.NotifyFS.FSActivity' |
   'keybase.1.NotifySession.loggedOut' |
   'keybase.1.NotifyTracking.trackingChanged' |
-  'keybase.1.NotifyUsers.userChanged' |
-  'keybase.1.reachability.reachabilityChanged'
+  'keybase.1.NotifyUsers.userChanged'
 
 type Keybase1IncomingActionMap<K extends keybase1Types.MessageKey> = {
   [P in K]: {readonly params: keybase1Types.RpcIn<P>}
```

**File**: `shared/engine/index.platform.tsx` (modified, +2/-1)
```diff
@@ -257,7 +257,8 @@ function createClient(
             // from a session cancel handler inside disconnectCallback must
             // not strand the UI on the disconnect banner by skipping
             // connectCallback (which synchronously clears the daemon error
-            // via startHandshake()).
+            // via startHandshake(), so nothing here may be moved behind an
+            // await).
             client.transport.reset()
             try {
               disconnectCallback()
```

**File**: `shared/login/loading.tsx` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ const SplashContainer = () => {
         C.Router2.navigateAppend({name: 'feedback', params: {}})
       }
     : undefined
-  const onRetry = handshakeFailed ? startHandshake : undefined
+  const onRetry = handshakeFailed ? () => startHandshake() : undefined
 
   return <Splash failed={failed} status={status} onRetry={onRetry} onFeedback={onFeedback} />
 }
```

#### Recent Merged Pull Requests:
- **PR #29691** (2026-09-28): Move more mobile deps to Expo modules, drop dead Android code, fix dark cold-start flash (@chrisnojima)
- **PR #29690** (2026-09-28): fix(chat): audio messages play on first tap and share with an extension (@chrisnojima)
- **PR #29689** (2026-09-28): fix(chat): share a KBFS file to chat through one conversation-picker flow (@chrisnojima)
- **PR #29688** (2026-09-28): CLAUDE.md: add debugging rules (@chrisnojima)
- **PR #29687** (2026-09-28): docs(skills): fix stale facts and conflicting rules in agent instructions (@chrisnojima)
- **PR #29685** (2026-09-25): update deps: expo 57.0.25, appium 3.8, vite 8.3.1; cap version checks at latest dist-tag (@chrisnojima)
- **PR #29684** (2026-09-24): fix(protocol): regen rpc-gen.tsx after dropping reachabilityChanged (@chrisnojima)
- **PR #29683** (2026-09-24): fix(protocol): drop reachabilityChanged from enabled incoming calls (@chrisnojima)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
