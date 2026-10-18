> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/taubyte-tau-learnings.md`  
> **Source**: github ([https://github.com/taubyte/tau](https://github.com/taubyte/tau))  
> **Source Version**: `d9841668`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:41:54.506Z  
> **Learning ID**: `learn-github-taubyte-tau`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): taubyte/tau

> **Canonical Artifact**: `07_PROJECT_LEARNING/taubyte-tau-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taubyte/tau](https://github.com/taubyte/tau))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T22:41:54.496Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taubyte/tau`
- **Description**: Fullstack Workspace for Humans & Machines
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5184 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/p2p/auth/hooks.go`
```
package auth

import (
	"errors"
	"fmt"

	iface "github.com/taubyte/tau/core/services/auth"
	"github.com/taubyte/tau/p2p/streams/command"
	"github.com/taubyte/tau/utils/maps"
)

func (c *Client) Hooks() iface.Hooks {
	return (*Hooks)(c)
}

func (h *Hooks) New(obj map[string]interface{}) (iface.Hook, error) {
	id, err := maps.String(obj, "id")
	if err != nil {
		return nil, errors.New("Creating hook: " + err.Error())
	}

	provider, err := maps.String(obj, "provider")
	if err != nil {
		return nil, errors.New("Creating hook: " + err.Error())
	}

	switch provider {
	case "github":
		github_id, err := maps.Int(obj, "github_id")
		if err != nil {
			return nil, errors.New("Creating hook: " + err.Error())
		}

		secret, err := maps.String(obj, "secret")
		if err != nil {
			return nil, errors.New("Creating hook: " + err.Error())
		}

		return &iface.GithubHook{
			Id:       id,
			GithubId: github_id,
			Secret:   secret,
		}, nil
	default:
		return nil, err
	}
}

func (h *Hooks) Get(hook_id string) (iface.Hook, error) {
	logger.Debugf("Getting hook `%s`", hook_id)
	defer logger.Debugf("Getting hook `%s` done", hook_id)

	response, err := h.client.Send("hooks", command.Body{"action": "get", "id": hook_id}, h.peers...)
	if err != nil {
		logger.Error(err)
		return nil, err
	}

	return h.New(response)
}

func (h *Hooks) List() ([]string, error) {
	response, err := h.client.Send("hooks", command.Body{"action": "list"}, h.peers...)
	if err != nil {
		return nil, err
	}
	ids, err := maps.StringArray(response, "hooks")
	if err != nil {
		return nil, fmt.Errorf("failed map string array on list error: %v", err)
	}
	return ids, nil
}

```

### Core Architecture Module: `core/common/client.go`
```
package common

type Client interface {
	// TODO add close here and remove from sub-interfaces when q-node is fixed
}

```

### Core Architecture Module: `core/common/config.go`
```
package common

import (
	"context"

	"github.com/taubyte/tau/core/kvdb"
	seerIface "github.com/taubyte/tau/core/services/seer"
)

type CommonConfig struct {
	Disabled bool
	Port     int
	Root     string
}

type ServiceConfig struct {
	CommonConfig
	Ctx        context.Context
	Cluster    string // cluster name, defaults to "main"
	Others     map[string]int
	PublicKey  []byte
	PrivateKey []byte
	SwarmKey   []byte
	Databases  kvdb.Factory
	Location   seerIface.Location
	// Hosts binds custom domains to services (domains.hosts) for this config;
	// applied via config.WithHosts. Mainly for Dream tests of host routing.
	Hosts map[string]string
}

type SimpleConfig struct {
	CommonConfig
	Clients map[string]ClientConfig
}

func (c *ServiceConfig) Clone() *ServiceConfig {
	clone := &ServiceConfig{
		CommonConfig: c.CommonConfig,
		Ctx:          c.Ctx,
		Cluster:      c.Cluster,
		Others:       make(map[string]int, 0),
		PrivateKey:   c.PrivateKey,
		PublicKey:    c.PublicKey,
		SwarmKey:     c.SwarmKey,
		Location:     c.Location,
		Hosts:        c.Hosts,
	}

	for key, value := range c.Others {
		clone.Others[key] = value
	}

	return clone
}

type ClientConfig struct {
	CommonConfig
}

```

### Core Architecture Module: `core/common/repositorytype/repositorytype.go`
```
// Package repositorytype defines the repository-kind enum shared between the
// config compiler, the tcc pipeline, and monkey. It lives in its own leaf
// package (importing nothing) so the tcc compile path can use it without
// dragging in core/common's libp2p/seer dependencies — which matters for the
// GOOS=js wasm build.
package repositorytype

type Type int

const (
	UnknownRepository Type = iota
	ConfigRepository
	CodeRepository
	LibraryRepository
	WebsiteRepository
)

```

### Core Architecture Module: `core/common/service.go`
```
package common

import peer "github.com/taubyte/tau/p2p/peer"

type Service interface {
	Node() peer.Node
	Close() error
}

```

### Core Architecture Module: `core/kvdb/ifaces.go`
```
package kvdb

import (
	"context"

	"github.com/ipfs/go-log/v2"

	cid "github.com/ipfs/go-cid"
)

type Factory interface {
	New(logger log.StandardLogger, path string, rebroadcastIntervalSec int) (s KVDB, err error)
	Close()
}

type KVDB interface {
	// Get will retrieve the key indexed data
	Get(ctx context.Context, key string) ([]byte, error)

	// Put will insert the data, indexed by key
	Put(ctx context.Context, key string, v []byte) error

	// Delete deletes the key and index data
	Delete(ctx context.Context, key string) error

	// List will list all keys with the given prefix
	List(ctx context.Context, prefix string) ([]string, error)

	// ListAsync returns a channel to list to listed keys
	ListAsync(ctx context.Context, prefix string) (chan string, error)

	// ListRegex will list all keys matching the given prefix, and regexs
	ListRegEx(ctx context.Context, prefix string, regexs ...string) ([]string, error)

	// ListRegexAsync will return a channel to list all regex matched keys
	ListRegExAsync(ctx context.Context, prefix string, regexs ...string) (chan string, error)

	// Batch creates a Batch interface of the current KVDB
	Batch(ctx context.Context) (Batch, error)

	// Sync syncs the KVDB key values
	Sync(ctx context.Context, key string) error

	Factory() Factory

	Stats(ctx context.Context) Stats

	// Closes the KVDB
	Close()
}

type Batch interface {
	Put(key string, value []byte) error
	Delete(key string) error
	Commit() error
}

type Type uint

const (
	TypeCRDT Type = iota
)

type Stats interface {
	Type() Type
	Heads() []cid.Cid
	Encode() []byte // CBOR encoding
	Decode(data []byte) error
}

```

### Core Architecture Module: `core/p2p/keypair/keypair.go`
```
package keypair

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"os"

	mrand "math/rand"

	crypto "github.com/libp2p/go-libp2p/core/crypto"
)

func New() crypto.PrivKey {
	priv, _, err := crypto.GenerateKeyPair(crypto.Ed25519, 1)
	if err != nil {
		return nil
	}
	return priv
}

func NewPersistant(path string) ([]byte, error) {
	rk, err := LoadRaw(path)
	if err == nil {
		return rk, nil
	}

	k := New()
	err = Save(k, path)
	if err != nil {
		return nil, err
	}

	rk, err = crypto.MarshalPrivateKey(New())
	if err != nil {
		return nil, err
	}

	return rk, nil
}

func NewRaw() []byte {
	data, _ := crypto.MarshalPrivateKey(New())
	return data
}

func LoadRaw(keyPath string) ([]byte, error) {
	if _, err := os.Stat(keyPath); err != nil {
		return nil, err
	}

	return os.ReadFile(keyPath)
}

func Save(priv crypto.PrivKey, keyPath string) error {
	data, err := crypto.MarshalPrivateKey(priv)
	if err == nil {
		err = os.WriteFile(keyPath, data, 0400)
	}

	return err
}

func Load(keyPath string) (crypto.PrivKey, error) {
	_, err := os.Stat(keyPath)
	if err == nil {
		key, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, err
		} else {
			priv, err := crypto.UnmarshalPrivateKey(key)
			if err != nil {
				return nil, err
			} else {
				return priv, nil
			}
		}
	}

	return nil, err
}

// Read key from ENV. key must be encoded in base64
func LoadRawFromEnv() []byte {
	key64, ok := os.LookupEnv("TAUBYTE_KEY")
	if ok {
		key, err := base64.StdEncoding.DecodeString(key64)
		if err == nil {
			return key
		}
	}

	return nil
}

// Read key from ENV. key must be encoded in base64
func LoadRawFromString(key64 string) []byte {
	key, err := base64.StdEncoding.DecodeString(key64)
	if err == nil && key != nil {
		return key
	}

	return nil
}

func GenerateDeterministicKey(name string) ([]byte, []byte, error) {
	// Create deterministic seed from name string
	hash := sha256.Sum256([]byte(name))
	seed := hash[:]

	// Create deterministic random source
	randSource := mrand.New(mrand.NewSource(int64(binary.BigEndian.Uint64(seed[:8]))))

	priv, pub, err := crypto.GenerateKeyPairWithReader(crypto.Ed25519, 1, randSource)
	if err != nil {
		return nil, nil, err
	}

	privBytes, err := crypto.MarshalPrivateKey(priv)
	if err != nil {
		return nil, nil, err
	}

	pubBytes, err := crypto.MarshalPublicKey(pub)
	if err != nil {
		return nil, nil, err
	}

	return privBytes, pubBytes, nil
}

```

### Core Architecture Module: `core/services/auth/client.go`
```
package auth

import (
	"crypto/tls"
	"errors"

	peerCore "github.com/libp2p/go-libp2p/core/peer"
	"github.com/taubyte/tau/core/kvdb"
)

type Client interface {
	InjectStaticCertificate(domain string, data []byte) error
	GetCertificate(domain string) (*tls.Certificate, error)
	GetStaticCertificate(domain string) (*tls.Certificate, error)
	GetRawCertificate(domain string) ([]byte, error)
	GetRawStaticCertificate(domain string) ([]byte, error)
	RegisterDomain(fqdn, projectID string) (*DomainRegistration, error)
	Hooks() Hooks
	Projects() Projects
	Repositories() Repositories
	Stats() Stats // TODO: rename State
	Peers(...peerCore.ID) Client
	Close()
}

type DomainRegistration struct {
	Token string `json:"token"`
	Entry string `json:"entry"`
	Type  string `json:"type"`
}

type Stats interface {
	Database() (kvdb.Stats, error)
}

type Hook interface {
	Github() (*GithubHook, error)
	Bitbucket() (*BitbucketHook, error)
}

type Hooks interface {
	Get(hook_id string) (Hook, error)
	New(obj map[string]interface{}) (Hook, error)
	List() ([]string, error)
}

type Projects interface {
	New(obj map[string]interface{}) *Project
	Get(project_id string) *Project
	List() ([]string, error)
	Create(name, configRepoID, codeRepoID string) error
}

type Project struct {
	Client
	Id       string
	Name     string
	Provider string
	Git      struct {
		Config Repository
		Code   Repository
	}
}
type Repositories interface {
	Github() GithubRepositories
}

type GithubRepositories interface {
	New(obj map[string]interface{}) (GithubRepository, error)
	Get(id int) (GithubRepository, error)
	List() ([]string, error)
	Register(repoID string) (string, error)
}

type Repository interface {
	PrivateKey() string
	Id() int
}

type BitbucketHook struct {
	Id string
}
type GithubHook struct {
	Id       string
	GithubId int
	Secret   string
}

type GithubRepository interface {
	Repository
	PrivateKey() string
	Project() string
}

func (h *GithubHook) Github() (*GithubHook, error) {
	return h, nil
}

func (h *GithubHook) Bitbucket() (*BitbucketHook, error) {
	return nil, errors.New("not a Bitbucket hook")
}

```

### Core Architecture Module: `core/services/auth/identity.go`
```
package auth

import "github.com/google/go-github/v71/github"

// Caller is the part of a git client that says who is asking. It is the whole
// input an identity provider gets: enough to identify the caller, and nothing
// with which to act on their behalf.
type Caller interface {
	Me() *github.User
}

```

### Core Architecture Module: `core/services/auth/service.go`
```
package auth

import "github.com/taubyte/tau/core/services"

type Service interface {
	services.DBService
	services.GitHubAuth
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #107** (2024-01-11): **Fix Tests/ Create common tests fixtures**
  *Symptoms*: Currently many tests are using outdated projects/or tokens, thus for the sake of time these projects have been skipped rather than being addressed.   Goal:  Create common test fixtures to reduce repeated code, as well as ensure that if a (non-go-package) dependency were to be outdated; tokens, project config, etc.; minimal changes would be required, and preferably no changes linked to another github repository as it becomes a time wasting hassle. 

- **Issue #92** (2023-09-18): **Fix Hoarder **
  *Symptoms*: Currently deployed hoarder protocol is not functioning as intended, apparently (I have not tested) it works locally.   I also believe that there are flaws with the p2p client, and bad code practices within the client and protocol  

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

### Incident Patch 1: `f65f9a4f` (2026-08-08)
**Commit Message**: fix(vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (#519)

net/http's WriteHeader panics for a status code < 100 or > 999. For a
gateway-fronted substrate function, that panic runs on the gateway's
response-forwarding goroutine (p2p/streams/tunnels/http Frontend), which has no
net/http recover — so an out-of-range code crashes the shared gateway process.
It is reachable two ways: a tenant's WASM function via the event ABI, and any
peer speaking the http-tunnel protocol.

- eventHttpRetCode / eventHttpRedirect: reject a code outside 100..999 with
  errno.ErrorHttpWrite before it reaches WriteHeader / http.Redirect.
- tunnel headersOp: clamp an out-of-range wire code to 500 before WriteHeader —
  the single choke point for any code arriving over the tunnel.
- Frontend goroutine: recover a residual panic on that untrusted-frame path into
  an error instead of taking down the process (defense in depth).

Regression tests for each, verified to fail on the pre-fix code with the exact
WriteHeader panic. The default no-retcode flow and valid 100..999 codes are
unchanged (existing wazy harness still green).

**File**: `p2p/streams/tunnels/http/handler.go` (modified, +16/-1)
```diff
@@ -52,6 +52,12 @@ func Frontend(w http.ResponseWriter, r *http.Request, stream io.ReadWriter) erro
 		var exitError error
 
 		defer func() {
+			// This goroutine processes untrusted peer frames outside net/http's
+			// per-request recover, so a panic here would take down the process.
+			// Convert it to an error the caller can surface instead.
+			if rec := recover(); rec != nil {
+				exitError = fmt.Errorf("panic while forwarding http response: %v", rec)
+			}
 			done <- exitError
 		}()
 
@@ -149,7 +155,16 @@ func headersOp(w http.ResponseWriter, r io.Reader) error {
 		}
 	}
 
-	w.WriteHeader(int(obj.Code))
+	// obj.Code is attacker-controlled: a substrate forwarding a guest's return
+	// code, or any peer speaking this protocol. net/http's WriteHeader panics
+	// for a code < 100 or > 999, and this runs on the Frontend goroutine below
+	// with no net/http recover to catch it, so clamp an out-of-range code to 500
+	// rather than crash the process.
+	code := int(obj.Code)
+	if code < 100 || code > 999 {
+		code = http.StatusInternalServerError
+	}
+	w.WriteHeader(code)
 
 	return nil
 }
```

**File**: `p2p/streams/tunnels/http/status_test.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+package httptun
+
+import (
+	"bytes"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/fxamacker/cbor/v2"
+)
+
+func encodeHeaders(t *testing.T, code int32) []byte {
+	t.Helper()
+	b, err := cbor.Marshal(headersOpPayload{Headers: http.Header{}, Code: code})
+	if err != nil {
+		t.Fatal(err)
+	}
+	return b
+}
+
+// The response code in a headers frame is attacker-controlled (a peer, or a
+// substrate forwarding a guest's code). net/http's WriteHeader panics for a
+// code outside 100..999, and this runs on the Frontend goroutine with no
+// net/http recover — so headersOp must clamp it rather than crash the process.
+func TestHeadersOpClampsOutOfRangeCode(t *testing.T) {
+	for _, code := range []int32{0, 99, 1000, -1, 2000000} {
+		rec := httptest.NewRecorder()
+		if err := headersOp(rec, bytes.NewReader(encodeHeaders(t, code))); err != nil {
+			t.Fatalf("headersOp(code=%d) errored: %v", code, err)
+		}
+		if rec.Code != http.StatusInternalServerError {
+			t.Errorf("headersOp(code=%d) wrote status %d; want it clamped to 500", code, rec.Code)
+		}
+	}
+}
+
+func TestHeadersOpPassesValidCode(t *testing.T) {
+	rec := httptest.NewRecorder()
+	if err := headersOp(rec, bytes.NewReader(encodeHeaders(t, 404))); err != nil {
+		t.Fatalf("headersOp(404) errored: %v", err)
+	}
+	if rec.Code != http.StatusNotFound {
+		t.Fatalf("status = %d, want 404", rec.Code)
+	}
+}
```

**File**: `pkg/vm-low-orbit/event/code.go` (modified, +9/-0)
```diff
@@ -3,10 +3,19 @@ package event
 import (
 	"context"
 
+	"github.com/taubyte/go-sdk/errno"
 	common "github.com/taubyte/tau/core/vm"
 )
 
 func (f *Factory) eventHttpRetCode(ctx context.Context, module common.Module, eventId uint32, code uint32) uint32 {
+	// net/http's WriteHeader panics for a status code < 100 or > 999. For a
+	// gateway-fronted function that panic runs on the response-forwarding
+	// goroutine with no recover, so an out-of-range guest code would crash the
+	// shared gateway. Reject it here instead.
+	if code < 100 || code > 999 {
+		return uint32(errno.ErrorHttpWrite)
+	}
+
 	w, err := f.getEventWriter(eventId)
 	if err != 0 {
 		return uint32(err)
```

**File**: `pkg/vm-low-orbit/event/redirect.go` (modified, +8/-0)
```diff
@@ -4,10 +4,18 @@ import (
 	"context"
 	"net/http"
 
+	"github.com/taubyte/go-sdk/errno"
 	common "github.com/taubyte/tau/core/vm"
 )
 
 func (f *Factory) eventHttpRedirect(ctx context.Context, module common.Module, eventId uint32, urlPtr uint32, urlLen uint32, code uint32) uint32 {
+	// http.Redirect calls w.WriteHeader(code), which panics for a code < 100 or
+	// > 999 on the gateway's forwarding goroutine (see eventHttpRetCode). Reject
+	// an out-of-range code before touching the writer.
+	if code < 100 || code > 999 {
+		return uint32(errno.ErrorHttpWrite)
+	}
+
 	url, err := f.ReadString(module, urlPtr, urlLen)
 	if err != 0 {
 		return uint32(err)
```

**File**: `pkg/vm-low-orbit/event/status_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package event
+
+import (
+	"context"
+	"net/http/httptest"
+	"testing"
+)
+
+// newHTTPEvent registers an HTTP event backed by a recording ResponseWriter.
+// httptest's WriteHeader panics on an out-of-range code (like a real server),
+// so an unclamped code reaching it fails these tests loudly.
+func newHTTPEvent() (*Factory, uint32, *httptest.ResponseRecorder) {
+	f := &Factory{events: make(map[uint32]*Event)}
+	rec := httptest.NewRecorder()
+	req := httptest.NewRequest("GET", "/", nil)
+	e := f.CreateHttpEvent(rec, req)
+	return f, e.Id, rec
+}
+
+// A guest status code outside net/http's valid 100..999 range must be rejected
+// before it reaches WriteHeader — otherwise it panics the gateway's response
+// goroutine. (module is unused by retcode; the code check runs first.)
+func TestEventHttpRetCodeRejectsOutOfRange(t *testing.T) {
+	for _, code := range []uint32{0, 99, 1000, 0xFFFFFFFF} {
+		f, id, rec := newHTTPEvent()
+		rc := f.eventHttpRetCode(context.Background(), nil, id, code)
+		if rc == 0 {
+			t.Errorf("eventHttpRetCode(code=%d) accepted an out-of-range code", code)
+		}
+		if rec.Code != 200 {
+			t.Errorf("eventHttpRetCode(code=%d) wrote status %d; the writer should be untouched", code, rec.Code)
+		}
+	}
+}
+
+func TestEventHttpRetCodeAcceptsValid(t *testing.T) {
+	f, id, rec := newHTTPEvent()
+	if rc := f.eventHttpRetCode(context.Background(), nil, id, 418); rc != 0 {
+		t.Fatalf("eventHttpRetCode(418) = errno %d, want 0", rc)
+	}
+	if rec.Code != 418 {
+		t.Fatalf("status = %d, want 418", rec.Code)
+	}
+}
+
+// http.Redirect calls WriteHeader(code) too; the code is validated before the
+// url is read, so a nil module is fine here.
+func TestEventHttpRedirectRejectsOutOfRange(t *testing.T) {
+	f, id, rec := newHTTPEvent()
+	rc := f.eventHttpRedirect(context.Background(), nil, id, 0, 0, 0)
+	if rc == 0 {
+		t.Fatalf("eventHttpRedirect(code=0) accepted an out-of-range code")
+	}
+	if rec.Code != 200 {
+		t.Fatalf("eventHttpRedirect(code=0) wrote status %d; the writer should be untouched", rec.Code)
+	}
+}
```

---

### Incident Patch 2: `6e9af37e` (2026-08-06)
**Commit Message**: fix(p2p): bounds-check frame length; stop allocating a buffer per frame (#515)

* fix(p2p): bounds-check the frame length before allocating on it

Every frame carries its payload length as a signed 64-bit integer read
straight off the wire, and nothing checked it. On the close path that
value reaches make([]byte, length): a negative one panics with
"makeslice: len out of range", and a large positive one reserves the
memory before the peer sends a single byte.

There is no recover() on the stream-handler path, and go-libp2p does not
install one either, so the panic takes the process down rather than the
connection. Any peer able to open a stream could stop a node with a
fourteen-byte frame, and every service that registers a command stream
listens on one.

Recv and Next each parsed the header themselves, so each carried the bug
separately. They now share one reader that rejects a negative length
before anything consumes it, and one close path that bounds the message
before allocating. A close frame only ever carries err.Error(), so a
message beyond the cap is malformed rather than merely long.

The regression test drives hostile frames through both entry points and
fails with the or

**File**: `p2p/streams/packer/hostile_frame_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package packer
+
+import (
+	"bytes"
+	"encoding/binary"
+	"io"
+	"testing"
+)
+
+var testMagic = Magic{0x01, 0xec}
+
+const testVersion Version = 1
+
+// frame builds a header with an arbitrary length field, which is what a remote
+// peer controls. The declared length deliberately need not match the payload.
+func frame(_type Type, length int64, payload []byte) []byte {
+	var b bytes.Buffer
+	b.Write(testMagic[:])
+	binary.Write(&b, binary.LittleEndian, testVersion)
+	binary.Write(&b, binary.LittleEndian, _type)
+	binary.Write(&b, binary.LittleEndian, length)
+	binary.Write(&b, binary.LittleEndian, Channel(0))
+	b.Write(payload)
+	return b.Bytes()
+}
+
+// TestHostileFrameLength: the length field is read off the wire as a signed
+// int64. A negative one used to reach make([]byte, length) and panic the
+// process — there is no recover() on the libp2p stream handler path, so any
+// peer able to open a stream could kill a node with a 14-byte frame.
+func TestHostileFrameLength(t *testing.T) {
+	for _, tc := range []struct {
+		name   string
+		_type  Type
+		length int64
+	}{
+		{"negative close", TypeClose, -1},
+		{"negative data", TypeData, -1},
+		{"min int64 close", TypeClose, -1 << 63},
+		{"oversized close", TypeClose, 1 << 40},
+		// No oversized-data case: the data path streams through
+		// io.Copy(w, io.LimitReader(r, length)) and never allocates on the
+		// claimed length, so a large one costs nothing until the bytes
+		// actually arrive. Only the close path buffers.
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			p := New(testMagic, testVersion)
+			raw := frame(tc._type, tc.length, nil)
+
+			// Both entry points parse a header; both must survive.
+			if _, _, err := p.Recv(bytes.NewReader(raw), io.Discard); err == nil {
+				t.Error("Recv accepted a hostile length")
+			}
+			if _, _, err := p.Next(bytes.NewReader(raw)); err == nil {
+				t.Error("Next accepted a hostile length")
+			}
+		})
+	}
+}
+
+// A well-formed frame still round-trips.
+func TestFrameRoundTrip(t *testing.T) {
+	p := New(testMagic, testVersion)
+
+	var sent bytes.Buffer
+	payload := []byte("hello")
+	if err := p.Send(3, &sent, bytes.NewReader(payload), int64(len(payload))); err != nil {
+		t.Fatal(err)
+	}
+
+	var got bytes.Buffer
+	channel, n, err := p.Recv(bytes.NewReader(sent.Bytes()), &got)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if channel != 3 || n != int64(len(payload)) || got.String() != string(payload) {
+		t.Fatalf("round trip: channel=%d n=%d body=%q", channel, n, got.String())
+	}
+
+	// A close frame carrying a real error still surfaces it.
+	msg := []byte("upstream went away")
+	closed := frame(TypeClose, int64(len(msg)), msg)
+	if _, _, err = p.Recv(bytes.NewReader(closed), io.Discard); err == nil {
+		t.Fatal("expected the close error to surface")
+	}
+	if _, _, err = p.Next(bytes.NewReader(closed)); err == nil {
+		t.Fatal("expected the close error to surface via Next")
+	}
+
+	// An empty close is still EOF, not an error.
+	if _, _, err := p.Recv(bytes.NewReader(frame(TypeClose, 0, nil)), io.Discard); err != io.EOF {
+		t.Fatalf("empty close: got %v, want io.EOF", err)
+	}
+
+	// A close message at the cap is accepted; one byte over is refused before
+	// anything is allocated.
+	atCap := frame(TypeClose, MaxCloseMessageSize, bytes.Repeat([]byte("x"), MaxCloseMessageSize))
+	if _, _, err := p.Recv(bytes.NewReader(atCap), io.Discard); err == nil {
+		t.Fatal("expected the close error to surface at the cap")
+	}
+	if _, _, err := p.Recv(bytes.NewReader(frame(TypeClose, MaxCloseMessageSize+1, nil)), io.Discard); err == nil {
+		t.Fatal("accepted a close message over the cap")
+	}
+}
```

**File**: `p2p/streams/packer/packer.go` (modified, +122/-101)
```diff
@@ -1,7 +1,6 @@
 package packer
 
 import (
-	"bytes"
 	"encoding/binary"
 	"fmt"
 	"io"
@@ -49,35 +48,76 @@ func New(magic Magic, version Version) Packer {
 	return p
 }
 
-func (p packer) send(channel Channel, _type Type, w io.Writer, r io.Reader, length int64) error {
-	_, err := w.Write(p.magic[:])
-	if err != nil {
-		return fmt.Errorf("writing magic bytes failed: %w", err)
-	}
+// headerSize is magic(2) + version(2) + type(1) + length(8) + channel(1).
+// The layout is the wire format and cannot change.
+const headerSize = 14
+
+// encodeHeader lays the header into a caller-owned array. Writing the fields
+// one at a time cost five binary.Write calls — five heap allocations and,
+// worse, five separate Writes to the stream, so every frame hit the transport
+// six times instead of twice.
+func (p packer) encodeHeader(hdr *[headerSize]byte, channel Channel, _type Type, length int64) {
+	hdr[0], hdr[1] = p.magic[0], p.magic[1]
+	binary.LittleEndian.PutUint16(hdr[2:4], uint16(p.version))
+	hdr[4] = byte(_type)
+	binary.LittleEndian.PutUint64(hdr[5:13], uint64(length))
+	hdr[13] = byte(channel)
+}
 
-	err = binary.Write(w, binary.LittleEndian, p.version)
-	if err != nil {
-		return fmt.Errorf("writing version failed: %w", err)
+// copyPayload moves exactly length bytes from r to w. io.Copy would allocate
+// its own buffer here — sized min(32KiB, length), since io.LimitReader tells
+// it how much is coming — on every single frame. The pool makes that nothing.
+// A zero length is not short-circuited: the copy still consults the
+// destination's ReadFrom, and for a *bytes.Buffer that is what leaves an empty
+// (rather than nil) result behind. Callers compare against []byte{}.
+func copyPayload(w io.Writer, r io.Reader, length int64) (int64, error) {
+	src := io.LimitReader(r, length)
+
+	// A destination that can read for itself does its own buffering, and
+	// io.CopyBuffer would ignore the buffer we handed it — taking one from the
+	// pool just to put it back is pure churn. Recv is always this case in
+	// practice: both callers in this repo receive into a *bytes.Buffer.
+	if _, ok := w.(io.ReaderFrom); ok {
+		return io.Copy(w, src)
 	}
 
-	err = binary.Write(w, binary.LittleEndian, _type)
-	if err != nil {
-		return fmt.Errorf("writing type failed: %w", err)
-	}
+	// Send's destination is the raw stream, which cannot, so the pool earns
+	// its keep there: io.Copy would otherwise allocate min(32KiB, length) per
+	// frame, because io.LimitReader tells it exactly how much is coming.
+	bufPtr := bufPool.Get().(*[]byte)
+	defer bufPool.Put(bufPtr)
 
-	err = binary.Write(w, binary.LittleEndian, length)
-	if err != nil {
-		return fmt.Errorf("writing length failed: %w", err)
+	return io.CopyBuffer(w, src, *bufPtr)
+}
+
+// sendBytes is send for a payload already in memory: no intermediate reader,
+// no copy buffer, no pool round trip — just the header and the bytes.
+func (p packer) sendBytes(channel Channel, _type Type, w io.Writer, payload []byte) error {
+	var hdr [headerSize]byte
+	p.encodeHeader(&hdr, channel, _type, int64(len(payload)))
+
+	if _, err := w.Write(hdr[:]); err != nil {
+		return fmt.Errorf("writing header failed: %w", err)
 	}
 
-	err = binary.Write(w, binary.LittleEndian, channel)
-	if err != nil {
-		return fmt.Errorf("writing channel failed: %w", err)
+	if len(payload) > 0 {
+		if _, err := w.Write(payload); err != nil {
+			return fmt.Errorf("writing payload failed: %w", err)
+		}
 	}
 
-	lr := io.LimitReader(r, length)
+	return nil
+}
 
-	n, err := io.Copy(w, lr)
+func (p packer) send(channel Channel, _type Type, w io.Writer, r io.Reader, length int64) error {
+	var hdr [headerSize]byte
+	p.encodeHeader(&hdr, channel, _type, length)
+
+	if _, err := w.Write(hdr[:]); err != nil {
+		return fmt.Errorf("writing header failed: %w", err)
+	}
+
+	n, err := copyPayload(w, r, length)
 	if n != length {
 		return fmt.Errorf("short write: expected %d bytes, wrote %d: %w", length, n, io.ErrShortWrite)
 	}
@@ -118,8 +158,10 @@ func (p packer) Stream(channel Channel, w io.Writer, r io.Reader, bufSize int) (
 		n, err = r.Read(buf)
 		l += int64(n)
 		if n > 0 {
-			err := p.Send(channel, w, bytes.NewBuffer(buf[:n]), int64(n))
-			if err != nil {
+			// The chunk is already a []byte. Wrapping it in a fresh
+			// bytes.Buffer per iteration only to copy it back out again was
+			// an allocation and a memcpy per chunk.
+			if err := p.sendBytes(channel, TypeData, w, buf[:n]); err != nil {
 				return l, fmt.Errorf("failed to send body payload with %w", err)
 			}
 		}
@@ -133,122 +175,101 @@ func (p packer) Stream(channel Channel, w io.Writer, r io.Reader, bufSize int) (
 }
 
 func (p packer) SendClose(channel Channel, w io.Writer, err error) error {
-	var buf bytes.Buffer
+	var msg []byte
 	if err != nil && err != io.EOF {
-		buf.WriteString(err.Error())
+		msg = []byte(err.Error())
 	}
 
-	return p.send(channel, TypeClose, w, &buf, int64(buf.Len()))
+	return p.sendBytes(channel, TypeClose
```

**File**: `p2p/streams/packer/packer_bench_test.go` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+package packer
+
+import (
+	"bytes"
+	"fmt"
+	"io"
+	"testing"
+)
+
+// netWriter models a libp2p stream: it implements io.Writer and nothing else.
+// That matters — *bytes.Buffer implements io.ReaderFrom, so benchmarking
+// against one takes a fast path the real transport never offers, and hides
+// both the copy buffer and the per-field write count.
+type netWriter struct {
+	n      int64
+	writes int
+}
+
+func (w *netWriter) Write(p []byte) (int, error) {
+	w.n += int64(len(p))
+	w.writes++
+	return len(p), nil
+}
+
+func (w *netWriter) reset() { w.n, w.writes = 0, 0 }
+
+// netReader is the same idea on the read side: no WriteTo to shortcut through.
+type netReader struct {
+	data []byte
+	off  int
+	// reads counts Read calls, which is what the header parsing costs in
+	// round trips on a real stream.
+	reads int
+}
+
+func (r *netReader) Read(p []byte) (int, error) {
+	if r.off >= len(r.data) {
+		return 0, io.EOF
+	}
+	n := copy(p, r.data[r.off:])
+	r.off += n
+	r.reads++
+	return n, nil
+}
+
+func (r *netReader) reset() { r.off, r.reads = 0, 0 }
+
+var benchSizes = []int{64, 4 << 10, 64 << 10}
+
+func BenchmarkSend(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			payload := make([]byte, size)
+			src := &netReader{data: payload}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				dst.reset()
+				if err := p.Send(1, dst, src, int64(size)); err != nil {
+					b.Fatal(err)
+				}
+			}
+			b.ReportMetric(float64(dst.writes), "writes/op")
+		})
+	}
+}
+
+func BenchmarkRecv(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			frameBytes := frame(TypeData, int64(size), make([]byte, size))
+			src := &netReader{data: frameBytes}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				dst.reset()
+				if _, _, err := p.Recv(src, dst); err != nil {
+					b.Fatal(err)
+				}
+			}
+			b.ReportMetric(float64(src.reads), "reads/op")
+		})
+	}
+}
+
+// BenchmarkRecvIntoBuffer is Recv as this repo actually calls it. Both real
+// callers (command/framer and tunnels/http) receive into a fresh
+// *bytes.Buffer, which implements io.ReaderFrom — so the copy runs through
+// bytes.Buffer.ReadFrom and the packer's own buffer never enters it. The gain
+// here is header parsing only; BenchmarkRecv's payload-buffer saving is real
+// but applies to a destination no caller in this tree passes.
+func BenchmarkRecvIntoBuffer(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			frameBytes := frame(TypeData, int64(size), make([]byte, size))
+			src := &netReader{data: frameBytes}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				// Fresh buffer per call, exactly as framer.Read does.
+				var out bytes.Buffer
+				if _, _, err := p.Recv(src, &out); err != nil {
+					b.Fatal(err)
+				}
+			}
+		})
+	}
+}
+
+// BenchmarkNext isolates header parsing — the path every frame pays, and the
+// one the command router hits per request.
+func BenchmarkNext(b *testing.B) {
+	p := New(testMagic, testVersion)
+	frameBytes := frame(TypeData, 0, nil)
+	src := &netReader{data: frameBytes}
+
+	b.ReportAllocs()
+	for b.Loop() {
+		src.reset()
+		if _, _, err := p.Next(src); err != nil {
+			b.Fatal(err)
+		}
+	}
+	b.ReportMetric(float64(src.reads), "reads/op")
+}
+
+func BenchmarkStream(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			payload := make([]byte, size)
+			src := &netReader{data: payload}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				dst.reset()
+				if _, err := p.Stream(1, dst, src, DefaultBufferSize); err != io.EOF {
+					b.Fatal(err)
+				}
+			}
+			b.ReportMetric(float64(dst.writes), "writes/op")
+		})
+	}
+}
```

**File**: `p2p/streams/packer/wireformat_test.go` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+package packer
+
+import (
+	"bytes"
+	"encoding/hex"
+	"errors"
+	"io"
+	"strings"
+	"testing"
+)
+
+// The wire format is spoken by every node in a cloud, so a frame this build
+// emits must stay byte-identical to one an older build emits — a node cannot
+// tell who it is talking to. These vectors were captured from the original
+// field-at-a-time implementation; they are the compatibility contract, not a
+// snapshot of current behaviour to be re-recorded when it changes.
+//
+// Layout, confirmed against the bytes below:
+//
+//	magic[0:2] version[2:4] type[4] length[5:13] channel[13] payload...
+var goldenFrames = []struct {
+	name  string
+	build func(p *packer, w io.Writer) error
+	hex   string
+	// Decoded expectations. Asserting the bytes back out is the point: a
+	// decoder that consumed the right number of wire bytes and dropped the
+	// payload would satisfy a test that only checked for the absence of an
+	// error, and would still be broken.
+	wantCh      Channel
+	wantPayload []byte
+	wantClose   string
+}{
+	{
+		"data/empty",
+		func(p *packer, w io.Writer) error { return p.Send(0, w, bytes.NewReader(nil), 0) },
+		"abcd070000000000000000000000",
+		0, nil, "",
+	},
+	{
+		"data/hello/ch0",
+		func(p *packer, w io.Writer) error { return p.Send(0, w, bytes.NewReader([]byte("hello")), 5) },
+		"abcd07000005000000000000000068656c6c6f",
+		0, []byte("hello"), "",
+	},
+	{
+		"data/hello/ch255",
+		func(p *packer, w io.Writer) error { return p.Send(255, w, bytes.NewReader([]byte("hello")), 5) },
+		"abcd0700000500000000000000ff68656c6c6f",
+		255, []byte("hello"), "",
+	},
+	{
+		"data/binary/ch5",
+		func(p *packer, w io.Writer) error {
+			return p.Send(5, w, bytes.NewReader([]byte{0x00, 0xff, 0x7f, 0x80}), 4)
+		},
+		"abcd07000004000000000000000500ff7f80",
+		5, []byte{0x00, 0xff, 0x7f, 0x80}, "",
+	},
+	{
+		"close/nil",
+		func(p *packer, w io.Writer) error { return p.SendClose(3, w, nil) },
+		"abcd070001000000000000000003",
+		3, nil, "",
+	},
+	{
+		"close/eof",
+		func(p *packer, w io.Writer) error { return p.SendClose(3, w, io.EOF) },
+		"abcd070001000000000000000003",
+		3, nil, "",
+	},
+	{
+		"close/err",
+		func(p *packer, w io.Writer) error { return p.SendClose(9, w, errors.New("boom")) },
+		"abcd070001040000000000000009626f6f6d",
+		9, nil, "boom",
+	},
+	{
+		// Three data frames plus the trailing close, all in one stream.
+		"stream/3chunks",
+		func(p *packer, w io.Writer) error {
+			if _, err := p.Stream(2, w, bytes.NewReader([]byte("abcdefgh")), 3); err != io.EOF {
+				return err
+			}
+			return nil
+		},
+		"abcd070000030000000000000002616263" +
+			"abcd070000030000000000000002646566" +
+			"abcd0700000200000000000000026768" +
+			"abcd070001000000000000000002",
+		2, []byte("abcdefgh"), "",
+	},
+}
+
+func goldenPacker() *packer { return New(Magic{0xAB, 0xCD}, Version(7)).(*packer) }
+
+// TestWireFormatEncode: what we emit is what older nodes expect.
+func TestWireFormatEncode(t *testing.T) {
+	for _, tc := range goldenFrames {
+		t.Run(tc.name, func(t *testing.T) {
+			var buf bytes.Buffer
+			if err := tc.build(goldenPacker(), &buf); err != nil {
+				t.Fatal(err)
+			}
+			if got := hex.EncodeToString(buf.Bytes()); got != tc.hex {
+				t.Errorf("wire format changed\n got: %s\nwant: %s", got, tc.hex)
+			}
+		})
+	}
+}
+
+// TestWireFormatDecode: what older nodes emit, we still read — and read
+// correctly. Every vector is checked for channel, byte count and payload
+// content, not merely for the absence of an error.
+func TestWireFormatDecode(t *testing.T) {
+	for _, tc := range goldenFrames {
+		t.Run(tc.name, func(t *testing.T) {
+			raw, err := hex.DecodeString(tc.hex)
+			if err != nil {
+				t.Fatal(err)
+			}
+
+			p := goldenPacker()
+			r := bytes.NewReader(raw)
+			var out bytes.Buffer
+			var total int64
+			var gotClose string
+			sawClose := false
+
+			// Drain every frame in the vector; the stream case holds four.
+			for r.Len() > 0 {
+				ch, n, err := p.Recv(r, &out)
+
+				if ch != tc.wantCh {
+					t.Fatalf("channel: got %d, want %d", ch, tc.wantCh)
+				}
+
+				switch {
+				case err == io.EOF:
+					// An empty close frame. End of this vector.
+					sawClose = true
+				case err != nil:
+					// A close frame carrying a message surfaces it as an
+					// error; that is the signal, not a decode failure.
+					sawClose = true
+					gotClose = err.Error()
+				default:
+					total += n
+				}
+			}
+
+			if got := out.Bytes(); !bytes.Equal(got, tc.wantPayload) {
+				t.Errorf("payload: got %q, want %q", got, tc.wantPayload)
+			}
+
+			if total != int64(len(tc.wantPayload)) {
+				t.Errorf("reported length: got %d, want %d", total, len(tc.wantPayload))
+			}
+
+			if tc.wantClose != "" {
+				if !sawClose {
+					t.Fatal("expected a close frame, saw none")
+				}
+				if !strings.Contains(gotClose, tc.wantClose) {
+					t.Errorf("close message: got %q, want it to contain %q", gotClose, tc.wantClose)
+				}
+			} else if 
```

---

### Incident Patch 3: `a2d903e8` (2026-08-08)
**Commit Message**: fix(vm): harden WASM host-ABI boundary and read into guest memory in place (#518)

Three tenant-isolation / DoS fixes on the vm-low-orbit host functions, plus a
read-path change that also removes the unbounded-allocation vector:

- Storage content files were created at a fixed relative path
  ("tempFile"+counter) in the shared process CWD, with the counter reset per
  instance, so concurrent functions (even within one project) aliased the same
  file — a cross-tenant read/corrupt, and the files were never removed. Use
  os.CreateTemp, namespaced by project, and remove on close and factory close.

- memoryViewRead clamped its count with `size < offset+count`, which overflows
  uint32 for a large guest-supplied count and slips into an out-of-range
  data[offset:offset+count] slice. Clamp against the remaining bytes instead.

- The guest-read host functions (contentReadFile, storageReadFile,
  readHttpResponseBody, readHttpEventBody, cryptoRead) did make([]byte,
  guestLen) before any bound — a multi-GiB host allocation per call, outside
  the wasm page limit. Read directly into the guest's linear memory instead:
  Memory().Read returns an aliasing slice, so the reader fills guest mem

**File**: `pkg/vm-low-orbit/crypto/rand/rand.go` (modified, +10/-6)
```diff
@@ -15,15 +15,19 @@ func (f *Factory) cryptoRead(
 	bufLen,
 	readPtr uint32,
 ) uint32 {
-	buf := make([]byte, bufLen)
+	// Fill the guest's buffer in place. Memory().Read returns a slice aliasing
+	// guest memory, so rand.Read writes straight into it: no host allocation
+	// sized from the guest's bufLen (which rand.Read would otherwise commit page
+	// by page) and no extra copy. Read bounds-checks bufPtr/bufLen for us.
+	buf, ok := module.Memory().Read(bufPtr, bufLen)
+	if !ok {
+		return uint32(errno.ErrorAddressOutOfMemory)
+	}
+
 	n, err := rand.Read(buf)
 	if err != nil {
 		return uint32(errno.ErrorRandRead)
 	}
 
-	if err := f.WriteUint64Le(module, readPtr, uint64(n)); err != 0 {
-		return uint32(err)
-	}
-
-	return uint32(f.WriteBytes(module, bufPtr, buf))
+	return uint32(f.WriteUint64Le(module, readPtr, uint64(n)))
 }
```

**File**: `pkg/vm-low-orbit/crypto/rand/rand_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+package rand
+
+import (
+	"context"
+	"encoding/binary"
+	"runtime"
+	"testing"
+
+	"github.com/taubyte/go-sdk/errno"
+	"github.com/taubyte/tau/core/vm"
+	"github.com/taubyte/tau/pkg/vm-low-orbit/helpers"
+)
+
+// --- minimal mock: cryptoRead needs Read (an aliasing view, like wazy) and
+// WriteUint64Le. ---
+
+type mockMemory struct {
+	vm.Memory
+	buf []byte
+}
+
+// Read returns a slice aliasing the backing buffer, matching wazy's real
+// Memory.Read, so a caller that fills it writes into guest memory in place.
+func (m *mockMemory) Read(offset, count uint32) ([]byte, bool) {
+	if uint64(offset)+uint64(count) > uint64(len(m.buf)) {
+		return nil, false
+	}
+	return m.buf[offset : offset+count : offset+count], true
+}
+
+func (m *mockMemory) WriteUint64Le(offset uint32, v uint64) bool {
+	if uint64(offset)+8 > uint64(len(m.buf)) {
+		return false
+	}
+	binary.LittleEndian.PutUint64(m.buf[offset:], v)
+	return true
+}
+
+type mockModule struct {
+	vm.Module
+	mem *mockMemory
+}
+
+func (m *mockModule) Memory() vm.Memory { return m.mem }
+
+// cryptoRead is the worst allocate-on-guest-length case: make([]byte, bufLen)
+// followed by rand.Read, which touches every page and forces real RSS. A guest
+// with a tiny memory must not be able to drive a multi-GiB host allocation; the
+// cap must reject before make(). The regression signal is bytes allocated — the
+// old code returned the same errno, just after committing ~4 GiB.
+func TestCryptoReadRejectsOversizedLength(t *testing.T) {
+	f := &Factory{Methods: helpers.New(context.Background())}
+	mod := &mockModule{mem: &mockMemory{buf: make([]byte, 4096)}}
+	const hugeLen = uint32(0xFFFFFFFF)
+
+	var before, after runtime.MemStats
+	runtime.ReadMemStats(&before)
+	rc := f.cryptoRead(context.Background(), mod, 0 /*bufPtr*/, hugeLen, 8 /*readPtr*/)
+	runtime.ReadMemStats(&after)
+
+	if rc != uint32(errno.ErrorAddressOutOfMemory) {
+		t.Fatalf("cryptoRead(bufLen=%#x) = errno %d, want ErrorAddressOutOfMemory (%d)",
+			hugeLen, rc, uint32(errno.ErrorAddressOutOfMemory))
+	}
+	if delta := after.TotalAlloc - before.TotalAlloc; delta > 64<<20 {
+		t.Fatalf("cryptoRead allocated %d bytes for an oversized request; the cap did not run before make()", delta)
+	}
+}
```

**File**: `pkg/vm-low-orbit/event/body.go` (modified, +8/-8)
```diff
@@ -15,20 +15,20 @@ func (f *Factory) readHttpEventBody(ctx context.Context, module common.Module, e
 		return uint32(err)
 	}
 
-	buf := make([]byte, bufSize)
+	// Read straight into the guest's linear memory (aliasing slice): the body
+	// lands at bufPtr in place, with no host allocation and no extra copy. Read
+	// bounds-checks bufSize, rejecting an oversized request without allocating.
+	buf, ok := module.Memory().Read(bufPtr, bufSize)
+	if !ok {
+		return uint32(errno.ErrorAddressOutOfMemory)
+	}
 
 	n, err0 := r.Body.Read(buf)
 	if err0 != nil && err0 != io.EOF {
 		return uint32(errno.ErrorHttpReadBody)
 	}
 
-	err = f.WriteUint32Le(module, countPtr, uint32(n))
-	if err != 0 {
-		return uint32(err)
-	}
-
-	err = f.WriteBytes(module, bufPtr, buf)
-	if err != 0 {
+	if err = f.WriteUint32Le(module, countPtr, uint32(n)); err != 0 {
 		return uint32(err)
 	}
 
```

**File**: `pkg/vm-low-orbit/helpers/methods.go` (modified, +10/-8)
```diff
@@ -13,20 +13,22 @@ func (m *methods) Read(module common.Module,
 	bufPtr, bufSize, // reader
 	countPtr uint32, // reader size
 ) errno.Error {
-	buf := make([]byte, bufSize)
+	// Read straight into the guest's linear memory. wazy's Memory().Read returns
+	// a slice aliasing that memory, so readMethod fills it in place: no host
+	// allocation sized from the guest's bufSize and no extra buf->guest copy.
+	// Read also bounds-checks bufPtr/bufSize, so an oversized guest length is
+	// rejected here instead of driving a multi-GiB allocation.
+	buf, ok := module.Memory().Read(bufPtr, bufSize)
+	if !ok {
+		return errno.ErrorAddressOutOfMemory
+	}
 
 	n, err0 := readMethod(buf)
 	if err0 != nil && err0 != io.EOF {
 		return errno.ErrorHttpReadBody
 	}
 
-	ok := module.Memory().WriteUint32Le(countPtr, uint32(n))
-	if !ok {
-		return errno.ErrorAddressOutOfMemory
-	}
-
-	ok = module.Memory().Write(bufPtr, buf)
-	if !ok {
+	if !module.Memory().WriteUint32Le(countPtr, uint32(n)) {
 		return errno.ErrorAddressOutOfMemory
 	}
 
```

**File**: `pkg/vm-low-orbit/i2mv/memoryView/memview.go` (modified, +6/-3)
```diff
@@ -93,9 +93,12 @@ func (f *Factory) memoryViewRead(
 		return uint32(err0)
 	}
 
-	size := mv.size
-	if size < offset+count {
-		count = size - offset
+	// Clamp against the remaining bytes without computing offset+count, which
+	// overflows uint32 for a large guest-supplied count (e.g. 0xFFFFFFF8) and
+	// would slip past a `size < offset+count` check into an out-of-range
+	// data[offset:offset+count] slice. offset < mv.size here, so remaining > 0.
+	if remaining := mv.size - offset; count > remaining {
+		count = remaining
 	}
 
 	if err0 = f.WriteBytes(module, bufPtr, data[offset:offset+count]); err0 != 0 {
```

**File**: `pkg/vm-low-orbit/i2mv/memoryView/memview_test.go` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+package memoryView
+
+import (
+	"context"
+	"encoding/binary"
+	"testing"
+
+	"github.com/taubyte/tau/core/vm"
+	"github.com/taubyte/tau/pkg/vm-low-orbit/helpers"
+)
+
+// --- minimal mock: only Read / Write / WriteUint32Le are exercised ---
+
+type mockMemory struct {
+	vm.Memory
+	buf []byte
+}
+
+func (m *mockMemory) Read(offset, count uint32) ([]byte, bool) {
+	if uint64(offset)+uint64(count) > uint64(len(m.buf)) {
+		return nil, false
+	}
+	out := make([]byte, count)
+	copy(out, m.buf[offset:offset+count])
+	return out, true
+}
+
+func (m *mockMemory) Write(offset uint32, v []byte) bool {
+	if uint64(offset)+uint64(len(v)) > uint64(len(m.buf)) {
+		return false
+	}
+	copy(m.buf[offset:], v)
+	return true
+}
+
+func (m *mockMemory) WriteUint32Le(offset, v uint32) bool {
+	if uint64(offset)+4 > uint64(len(m.buf)) {
+		return false
+	}
+	binary.LittleEndian.PutUint32(m.buf[offset:], v)
+	return true
+}
+
+type mockModule struct {
+	vm.Module
+	mem *mockMemory
+}
+
+func (m *mockModule) Memory() vm.Memory { return m.mem }
+
+func newFactory() *Factory {
+	return &Factory{
+		Methods:     helpers.New(context.Background()),
+		memoryViews: make(map[uint32]*MemoryView),
+	}
+}
+
+// A guest-supplied count near UINT32_MAX must not wrap offset+count and slip
+// past the clamp into an out-of-range slice. Before the clamp fix,
+// memoryViewRead(id, offset=16, count=0xFFFFFFF8, …) panicked on data[16:8].
+func TestMemoryViewReadCountOverflowIsClamped(t *testing.T) {
+	const viewSize = 1024
+	const srcPtr = 0
+	const dstPtr = 4096
+	const nPtr = 8192
+
+	mod := &mockModule{mem: &mockMemory{buf: make([]byte, 16384)}}
+	for i := 0; i < viewSize; i++ { // recognizable source bytes
+		mod.mem.buf[srcPtr+i] = byte(i)
+	}
+
+	f := newFactory()
+
+	// Create a view over [srcPtr, srcPtr+viewSize).
+	idOut := uint32(12000)
+	if rc := f.memoryViewNew(context.Background(), mod, srcPtr, viewSize, 0 /*isCloser*/, idOut); rc != 0 {
+		t.Fatalf("memoryViewNew failed: errno %d", rc)
+	}
+	id := binary.LittleEndian.Uint32(mod.mem.buf[idOut : idOut+4])
+
+	const offset = 16
+	const count = uint32(0xFFFFFFF8) // == int32(-8); offset+count wraps to 8
+
+	rc := f.memoryViewRead(context.Background(), mod, id, offset, count, dstPtr, nPtr)
+	if rc != 0 {
+		t.Fatalf("memoryViewRead returned errno %d", rc)
+	}
+
+	// It must clamp to the bytes remaining after offset, not wrap.
+	got := binary.LittleEndian.Uint32(mod.mem.buf[nPtr : nPtr+4])
+	if want := uint32(viewSize - offset); got != want {
+		t.Fatalf("clamped count = %d, want %d", got, want)
+	}
+
+	// And the copied-out bytes must be the real source region [offset, viewSize).
+	for i := 0; i < viewSize-offset; i++ {
+		if mod.mem.buf[dstPtr+i] != byte(offset+i) {
+			t.Fatalf("byte %d = %d, want %d", i, mod.mem.buf[dstPtr+i], byte(offset+i))
+		}
+	}
+}
```

**File**: `pkg/vm-low-orbit/storage/content.go` (modified, +12/-5)
```diff
@@ -2,7 +2,6 @@ package storage
 
 import (
 	"context"
-	"fmt"
 	"io"
 	"os"
 
@@ -20,12 +19,12 @@ func (f *Factory) storageNewContent(ctx context.Context, module common.Module,
 		f.contentLock.Unlock()
 	}()
 
-	newFile, err := os.Create("tempFile" + fmt.Sprint("", f.contentIdToGrab))
+	newFile, err := os.CreateTemp("", "tau-content-"+f.parent.Context().Project()+"-*")
 	if err != nil {
 		return uint32(errno.ErrorCreatingNewFile)
 	}
 
-	f.contents[f.contentIdToGrab] = &content{id: f.contentIdToGrab, cid: cid.Cid{}, file: newFile}
+	f.contents[f.contentIdToGrab] = &content{id: f.contentIdToGrab, cid: cid.Cid{}, file: newFile, path: newFile.Name()}
 	return uint32(f.WriteUint32Le(module, contentIdPtr, f.contentIdToGrab))
 }
 
@@ -43,7 +42,7 @@ func (f *Factory) storageOpenCid(ctx context.Context, module common.Module,
 		return uint32(errno.ErrorCidNotFound)
 	}
 
-	newFile, err := os.Create(cid.String())
+	newFile, err := os.CreateTemp("", "tau-content-"+f.parent.Context().Project()+"-*")
 	if err != nil {
 		return uint32(errno.ErrorCreatingNewFile)
 	}
@@ -59,7 +58,7 @@ func (f *Factory) storageOpenCid(ctx context.Context, module common.Module,
 		f.contentLock.Unlock()
 	}()
 
-	f.contents[f.contentIdToGrab] = &content{id: f.contentIdToGrab, cid: cid, file: newFile}
+	f.contents[f.contentIdToGrab] = &content{id: f.contentIdToGrab, cid: cid, file: newFile, path: newFile.Name()}
 	return uint32(f.WriteUint32Le(module, contentIdPtr, f.contentIdToGrab))
 }
 
@@ -77,6 +76,14 @@ func (f *Factory) contentCloseFile(ctx context.Context,
 		return uint32(errno.ErrorCloseFileFailed)
 	}
 
+	if content.path != "" {
+		os.Remove(content.path)
+	}
+
+	f.contentLock.Lock()
+	delete(f.contents, contentId)
+	f.contentLock.Unlock()
+
 	return 0
 }
 
```

**File**: `pkg/vm-low-orbit/storage/content_test.go` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+package storage
+
+import (
+	"context"
+	"encoding/binary"
+	"os"
+	"path/filepath"
+	"runtime"
+	"strings"
+	"testing"
+
+	"github.com/taubyte/go-sdk/errno"
+	"github.com/taubyte/tau/core/vm"
+	"github.com/taubyte/tau/pkg/vm-low-orbit/helpers"
+)
+
+// --- minimal mocks: only what the content host functions actually touch ---
+
+type mockMemory struct {
+	vm.Memory
+	buf []byte
+}
+
+// Read returns a slice aliasing the backing buffer, matching wazy's real
+// Memory.Read, so a caller that fills it writes into guest memory in place.
+func (m *mockMemory) Read(offset, count uint32) ([]byte, bool) {
+	if uint64(offset)+uint64(count) > uint64(len(m.buf)) {
+		return nil, false
+	}
+	return m.buf[offset : offset+count : offset+count], true
+}
+
+func (m *mockMemory) Write(offset uint32, v []byte) bool {
+	if uint64(offset)+uint64(len(v)) > uint64(len(m.buf)) {
+		return false
+	}
+	copy(m.buf[offset:], v)
+	return true
+}
+
+func (m *mockMemory) WriteUint32Le(offset, v uint32) bool {
+	if uint64(offset)+4 > uint64(len(m.buf)) {
+		return false
+	}
+	binary.LittleEndian.PutUint32(m.buf[offset:], v)
+	return true
+}
+
+func (m *mockMemory) Size() uint32 { return uint32(len(m.buf)) }
+
+type mockModule struct {
+	vm.Module
+	mem *mockMemory
+}
+
+func (m *mockModule) Memory() vm.Memory { return m.mem }
+
+type mockContext struct {
+	project string
+}
+
+func (c *mockContext) Context() context.Context         { return context.Background() }
+func (c *mockContext) Project() string                  { return c.project }
+func (c *mockContext) Application() string              { return "" }
+func (c *mockContext) Resource() string                 { return "" }
+func (c *mockContext) Branches() []string               { return nil }
+func (c *mockContext) Commit() string                   { return "" }
+func (c *mockContext) Clone(context.Context) vm.Context { return c }
+
+type mockInstance struct {
+	vm.Instance
+	ctx vm.Context
+}
+
+func (i *mockInstance) Context() vm.Context { return i.ctx }
+
+func newTestFactory(project string) *Factory {
+	inst := &mockInstance{ctx: &mockContext{project: project}}
+	return New(inst, nil, helpers.New(context.Background()))
+}
+
+func newModule() *mockModule { return &mockModule{mem: &mockMemory{buf: make([]byte, 4096)}} }
+
+// newContent drives storageNewContent and returns the guest-visible id and the
+// on-disk path the factory chose for it.
+func newContent(t *testing.T, f *Factory) (uint32, string) {
+	t.Helper()
+	mod := newModule()
+	if rc := f.storageNewContent(context.Background(), mod, 0); rc != 0 {
+		t.Fatalf("storageNewContent failed: errno %d", rc)
+	}
+	id := binary.LittleEndian.Uint32(mod.mem.buf[0:4])
+	c, errno := f.getContent(id)
+	if errno != 0 {
+		t.Fatalf("getContent(%d) failed: errno %d", id, errno)
+	}
+	return id, c.path
+}
+
+// Regression for the shared-CWD content-file collision: two concurrent
+// instances of the *same* project each reset their content counter to 0, so the
+// old `os.Create("tempFile" + counter)` scheme handed both the identical
+// relative path "tempFile0" — a cross-tenant/cross-call alias where one guest's
+// write clobbered or leaked another's staged content. Project id in the name
+// alone would not fix this (same project), so the fix uses os.CreateTemp.
+func TestContentTempFilesDoNotCollideAcrossInstances(t *testing.T) {
+	const project = "PROJECTX"
+	a := newTestFactory(project)
+	b := newTestFactory(project)
+	t.Cleanup(func() { a.Close(); b.Close() })
+
+	idA, pathA := newContent(t, a)
+	idB, pathB := newContent(t, b)
+
+	// Both counters start at 0 — this is precisely the case the old scheme collided on.
+	if idA != 0 || idB != 0 {
+		t.Fatalf("expected both content ids 0 (fresh per-instance counters), got %d and %d", idA, idB)
+	}
+
+	if pathA == pathB {
+		t.Fatalf("content files collide across instances: both %q", pathA)
+	}
+
+	for _, p := range []string{pathA, pathB} {
+		if _, err := os.Stat(p); err != nil {
+			t.Fatalf("temp file %q not created: %v", p, err)
+		}
+		if !strings.HasPrefix(filepath.Base(p), "tau-content-"+project+"-") {
+			t.Errorf("temp file %q is not namespaced by project", p)
+		}
+		if filepath.Dir(p) == "." {
+			t.Errorf("temp file %q is a relative path in the process CWD", p)
+		}
+	}
+}
+
+// A guest-supplied read length larger than the guest's own memory must be
+// rejected before the host allocation — not make([]byte, hugeLen) first. This
+// exercises the shared helpers.Read path that backs contentReadFile,
+// storageReadFile and readHttpResponseBody. The regression signal is bytes
+// allocated: the old code allocated the full ~4 GiB before failing the
+// write-back, so a return-code check alone would not catch it.
+func TestContentReadRejectsOversizedLength(t *testing.T) {
+	f := newTestFactory("P")
+	t.Cleanup(func() { f.Close() })
+
+	id, _ := newContent(t, f)
+	mod := newModule() // 4096-byte guest memory
+	const hugeLen = uint32(0xFFFFFFFF)
+
+	var before
```

#### Recent Merged Pull Requests:
- **PR #520** (2026-08-16): feat(netguard): confine untrusted code egress to the public internet (@samyfodil)
- **PR #519** (2026-08-08): fix(vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (@samyfodil)
- **PR #518** (2026-08-08): fix(vm): harden WASM host-ABI boundary and read into guest memory in place (@samyfodil)
- **PR #517** (2026-08-07): feat(containers): build images on containerd, by running BuildKit as a container (@samyfodil)
- **PR #516** (2026-08-07): fix(containers): make containerd a real peer of docker, and the tests hermetic (@samyfodil)
- **PR #515** (2026-08-06): fix(p2p): bounds-check frame length; stop allocating a buffer per frame (@samyfodil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (#519)

**RULE**:
When implementing operations in `p2p/streams/tunnels/http/handler.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in taubyte/tau. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f65f9a4f`: vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (#519). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `p2p/streams/tunnels/http/handler.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			// This goroutine processes untrusted peer frames outside net/http's
			// per-request recover, so a panic here would take down the process.
			// Convert it to an error the caller can surface instead.
			if rec := recover(); rec != nil {
				exitError = fmt.Errorf("panic while forwarding http response: %v", rec)
			}
	// obj.Code is attacker-controlled: a substrate forwarding a guest's return
	// code, or any peer speaking this protocol. net/http's WriteHeader panics
	// for a code < 100 or > 999, and this runs on the Frontend goroutine below
	// with no net/http recover to catch it, so clamp an out-of-range code to 500
	// rather than crash the process.
	code := int(obj.Code)
	if code < 100 || code > 999 {
		code = http.StatusInternalServerError
	}
	w.WriteHeader(code)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	w.WriteHeader(int(obj.Code))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f65f9a4f` are properly handled with clean fallback behavior.
