# Forensic Learning Record (Deep Inspection): taubyte/tau

> **Canonical Artifact**: `07_PROJECT_LEARNING/taubyte-tau-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taubyte/tau](https://github.com/taubyte/tau))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:34.842Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taubyte/tau`
- **Description**: Fullstack Workspace for Humans & Machines
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5173 stars

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

### Core Architecture Module: `core/services/gateway/service.go`
```
package gateway

import (
	services "github.com/taubyte/tau/core/services"
)

type Service interface {
	services.HttpService
}

```

### Core Architecture Module: `core/services/hoarder/client.go`
```
package hoarder

import (
	"context"
	"io"

	peerCore "github.com/libp2p/go-libp2p/core/peer"
	"github.com/taubyte/tau/core/kvdb"
)

type Client interface {
	Rare() ([]string, error)
	// Stash pushes the CID's bytes to a hoarder, which verifies, pins, claims,
	// and fans out to co-claimants. data is streamed after a small header.
	Stash(cid string, data io.Reader, opts ...StashOption) error
	List() ([]string, error)
	// ReplicasOf resolves the live holder peers of a database/storage instance.
	ReplicasOf(kind ResourceKind, project, application, match string) ([]peerCore.ID, error)
	// KVDB returns a remote-backed kvdb.KVDB for a database/storage instance —
	// operations are p2p calls to the hoarders holding it.
	KVDB(kind ResourceKind, project, application, match, branch string) (kvdb.KVDB, error)
	// Metas resolves instance hashes to their placement identity records; hashes
	// with no record are omitted. Lets a node that knows only a data-path hash
	// recover the instance's identity.
	Metas(hashes ...string) ([]InstanceInfo, error)
	// StashStatus reports the live stash claim count per CID (0 = unknown) and
	// the current fleet-clamped stash replica target — the check a byte holder
	// runs before dropping its local copy.
	StashStatus(cids ...string) (claims map[string]int, target int, err error)
	Peers(...peerCore.ID) Client
	Close()
}

// InstanceInfo is a placement identity record as returned by Metas.
type InstanceInfo struct {
	Hash string
	Kind ResourceKind
	Meta MetaData
}

// NxKVDB is a KVDB handle that also supports conditional writes. The remote
// hoarder-backed handle implements it; PutNx returns existed=true when the key
// was already present on the serving replica and nothing was written.
type NxKVDB interface {
	kvdb.KVDB
	PutNx(ctx context.Context, key string, value []byte) (existed bool, err error)
}

// StashConfig carries push options. Target is the desired replica count; Owner
// is the storage instance hash the blocks belong to; Fanout is whether the
// receiving hoarder re-pushes to co-claimants (false for hoarder→hoarder
// re-replication to avoid a storm).
type StashConfig struct {
	Target int
	Owner  string
	Fanout bool
}

type StashOption func(*StashConfig)

func WithTarget(n int) StashOption {
	return func(c *StashConfig) { c.Target = n }
}

func WithOwner(hash string) StashOption {
	return func(c *StashConfig) { c.Owner = hash }
}

// WithoutFanout marks a hoarder→hoarder re-push so the receiver does not fan
// out again.
func WithoutFanout() StashOption {
	return func(c *StashConfig) { c.Fanout = false }
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

- **Issue #66** (2023-08-24): **Fix Monkey Config failure logs **
  *Symptoms*: 

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

### Incident Patch 1: `a7b427bb` (2026-08-16)
**Commit Message**: fix(taucorder): drop the stale accounts stubs, let the client be extended (#512)

* fix(taucorder): drop the stale accounts stubs, let the client be extended

The accounts proto left this tree in #507; its generated TypeScript did not.
Two files stayed behind describing a service nothing here serves, in a package
that ships to npm. Nothing regenerates them — `buf generate` here produces no
change — so they were residue, not output.

Taucorder's transport and node become protected. A client built on this one
needs both to attach its own wrappers to the connection and node this class
already set up; without that it would have to open a second connection and
initialise a second node to reach the same peer.

* fix(auth): make the randomness tests check randomness at every length

Both tests generated two values and asserted they differ. Their length lists
start at 1, where that is not a check but a coin flip: one byte repeats once
every 256 draws and one character once every 62. Measured on main, the string
test fails 5 runs in 200 — 2.5% against the 1.61% the alphabet predicts.

The generators were never wrong. Both use crypto/rand.

Draws are now sampled instead of paired: 256 of the

**File**: `ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit b0b81710b2aec4f5a1bac19eaedab9bcbb011d6d
+Subproject commit da23b19dfd91edf4645f1c089cbfa18528186445
```

**File**: `pkg/taucorder/clients/js/gen/taucorder/v1/accounts_connect.ts` (removed, +0/-56)
```diff
@@ -1,56 +0,0 @@
-// @generated by protoc-gen-connect-es v1.4.0 with parameter "target=ts"
-// @generated from file taucorder/v1/accounts.proto (package taucorder.v1, syntax proto3)
-/* eslint-disable */
-// @ts-nocheck
-
-import { Account, AssignUserRequest, CreateAccountRequest, ListUsersRequest, User } from "./accounts_pb.js";
-import { MethodKind } from "@bufbuild/protobuf";
-import { Node } from "./common_pb.js";
-
-/**
- * AccountsService: create accounts, assign (link) git users to them, and list.
- *
- * @generated from service taucorder.v1.AccountsService
- */
-export const AccountsService = {
-  typeName: "taucorder.v1.AccountsService",
-  methods: {
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.CreateAccount
-     */
-    createAccount: {
-      name: "CreateAccount",
-      I: CreateAccountRequest,
-      O: Account,
-      kind: MethodKind.Unary,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.AssignUser
-     */
-    assignUser: {
-      name: "AssignUser",
-      I: AssignUserRequest,
-      O: User,
-      kind: MethodKind.Unary,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.ListAccounts
-     */
-    listAccounts: {
-      name: "ListAccounts",
-      I: Node,
-      O: Account,
-      kind: MethodKind.ServerStreaming,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.ListUsers
-     */
-    listUsers: {
-      name: "ListUsers",
-      I: ListUsersRequest,
-      O: User,
-      kind: MethodKind.ServerStreaming,
-    },
-  }
-} as const;
-
```

**File**: `pkg/taucorder/clients/js/gen/taucorder/v1/accounts_pb.ts` (removed, +0/-310)
```diff
@@ -1,310 +0,0 @@
-// @generated by protoc-gen-es v1.4.0 with parameter "target=ts"
-// @generated from file taucorder/v1/accounts.proto (package taucorder.v1, syntax proto3)
-/* eslint-disable */
-// @ts-nocheck
-
-import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
-import { Message, proto3 } from "@bufbuild/protobuf";
-import { Node } from "./common_pb.js";
-
-/**
- * Account mirrors core/services/accounts.Account.
- *
- * @generated from message taucorder.v1.Account
- */
-export class Account extends Message<Account> {
-  /**
-   * @generated from field: string id = 1;
-   */
-  id = "";
-
-  /**
-   * @generated from field: string slug = 2;
-   */
-  slug = "";
-
-  /**
-   * @generated from field: string name = 3;
-   */
-  name = "";
-
-  /**
-   * @generated from field: string kind = 4;
-   */
-  kind = "";
-
-  /**
-   * @generated from field: string status = 5;
-   */
-  status = "";
-
-  /**
-   * @generated from field: string auth_mode = 6;
-   */
-  authMode = "";
-
-  constructor(data?: PartialMessage<Account>) {
-    super();
-    proto3.util.initPartial(data, this);
-  }
-
-  static readonly runtime: typeof proto3 = proto3;
-  static readonly typeName = "taucorder.v1.Account";
-  static readonly fields: FieldList = proto3.util.newFieldList(() => [
-    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 2, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 3, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 4, name: "kind", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 5, name: "status", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 6, name: "auth_mode", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-  ]);
-
-  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Account {
-    return new Account().fromBinary(bytes, options);
-  }
-
-  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Account {
-    return new Account().fromJson(jsonValue, options);
-  }
-
-  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Account {
-    return new Account().fromJsonString(jsonString, options);
-  }
-
-  static equals(a: Account | PlainMessage<Account> | undefined, b: Account | PlainMessage<Account> | undefined): boolean {
-    return proto3.util.equals(Account, a, b);
-  }
-}
-
-/**
- * User is a git provider account linked to an Account (the access grant).
- *
- * @generated from message taucorder.v1.User
- */
-export class User extends Message<User> {
-  /**
-   * @generated from field: string id = 1;
-   */
-  id = "";
-
-  /**
-   * @generated from field: string account_id = 2;
-   */
-  accountId = "";
-
-  /**
-   * @generated from field: string provider = 3;
-   */
-  provider = "";
-
-  /**
-   * @generated from field: string external_id = 4;
-   */
-  externalId = "";
-
-  /**
-   * @generated from field: string display_name = 5;
-   */
-  displayName = "";
-
-  constructor(data?: PartialMessage<User>) {
-    super();
-    proto3.util.initPartial(data, this);
-  }
-
-  static readonly runtime: typeof proto3 = proto3;
-  static readonly typeName = "taucorder.v1.User";
-  static readonly fields: FieldList = proto3.util.newFieldList(() => [
-    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 2, name: "account_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 3, name: "provider", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 4, name: "external_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 5, name: "display_name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-  ]);
-
-  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): User {
-    return new User().fromBinary(bytes, options);
-  }
-
-  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): User {
-    return new User().fromJson(jsonValue, options);
-  }
-
-  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): User {
-    return new User().fromJsonString(jsonString, options);
-  }
-
-  static equals(a: User | PlainMessage<User> | undefined, b: User | PlainMessage<User> | undefined): boolean {
-    return proto3.util.equals(User, a, b);
-  }
-}
-
-/**
- * @generated from message taucorder.v1.CreateAccountRequest
- */
-export class CreateAccountRequest extends Message<CreateAccountRequest> {
-  /**
-   * @generated from field: taucorder.v1.Node node = 1;
-   */
-  node?: Node;
-
-  /**
-   * @generated from field: string slug = 2;
-   */
-  slug = "";
-
-  /**
-   * @generated from field: string name = 3;
-   */
-  name = "";
-
-  /**
-   * optional; defaults server-side
-   *
-   * @generated from field: string kind = 4;
-   */
-  kind = "";
-
-  /**
-   * optional; defaults to managed
-   *
-   * @generated from field: string auth_mode = 5;
-   */
-
```

**File**: `pkg/taucorder/clients/js/src/Taucorder.ts` (modified, +5/-2)
```diff
@@ -62,8 +62,11 @@ class ExtendedAuth extends Auth {
 }
 
 export class Taucorder {
-  private transport: Transport;
-  private node?: Node;
+  // Reachable by subclasses so a client built on this one can attach its own
+  // service wrappers to the same transport and node, rather than opening a
+  // second connection and initialising a second node.
+  protected transport: Transport;
+  protected node?: Node;
   private config: Config;
   private nodeClient?: NodeRPCClient;
   private wrappers: {
```

**File**: `services/auth/crypto/helpers_test.go` (modified, +30/-27)
```diff
@@ -37,13 +37,14 @@ func TestGenerateRandomBytes(t *testing.T) {
 		assert.NilError(t, err)
 		assert.Equal(t, len(bytes), length)
 
-		// Generate another set to ensure randomness
-		bytes2, err := GenerateRandomBytes(length)
-		assert.NilError(t, err)
-		assert.Equal(t, len(bytes2), length)
-
-		// The bytes should be different (very unlikely to be the same)
-		assert.Assert(t, !bytesEqual(bytes, bytes2))
+		// Randomness is checked over many draws rather than by comparing one
+		// pair. A pair says nothing at small sizes — one byte repeats once
+		// every 256 draws — and sampling is correct at every size, so the
+		// short case needs no exception.
+		assert.Assert(t, distinctDraws(t, length, func() (string, error) {
+			b, err := GenerateRandomBytes(length)
+			return string(b), err
+		}) > 1, "every draw of %d byte(s) returned the same value", length)
 	}
 }
 
@@ -56,13 +57,11 @@ func TestGenerateRandomString(t *testing.T) {
 		assert.NilError(t, err)
 		assert.Equal(t, len(str), length)
 
-		// Generate another string to ensure randomness
-		str2, err := GenerateRandomString(length)
-		assert.NilError(t, err)
-		assert.Equal(t, len(str2), length)
-
-		// The strings should be different (very unlikely to be the same)
-		assert.Assert(t, str != str2)
+		// See TestGenerateRandomBytes: one character out of 62 repeats often
+		// enough that a single comparison is a coin flip, not a check.
+		assert.Assert(t, distinctDraws(t, length, func() (string, error) {
+			return GenerateRandomString(length)
+		}) > 1, "every draw of %d character(s) returned the same value", length)
 
 		// Verify all characters are valid
 		for _, char := range str {
@@ -71,6 +70,23 @@ func TestGenerateRandomString(t *testing.T) {
 	}
 }
 
+// distinctDraws counts how many distinct values draw produces over enough
+// samples that a working generator cannot return one value by chance: the
+// smallest space here is 62 symbols, and 256 draws make an all-identical run
+// impossible in practice while a stuck generator fails every time.
+func distinctDraws(t *testing.T, length int, draw func() (string, error)) int {
+	t.Helper()
+
+	seen := make(map[string]struct{})
+	for range 256 {
+		v, err := draw()
+		assert.NilError(t, err)
+		assert.Equal(t, len(v), length)
+		seen[v] = struct{}{}
+	}
+	return len(seen)
+}
+
 func TestGenerateSecretString(t *testing.T) {
 	secret, err := GenerateSecretString()
 	assert.NilError(t, err)
@@ -95,19 +111,6 @@ func TestSecretStringLength(t *testing.T) {
 	assert.Equal(t, SecretStringLength, 32)
 }
 
-// Helper functions for testing
-func bytesEqual(a, b []byte) bool {
-	if len(a) != len(b) {
-		return false
-	}
-	for i := range a {
-		if a[i] != b[i] {
-			return false
-		}
-	}
-	return true
-}
-
 func isValidRandomChar(char rune) bool {
 	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
 	for _, validChar := range letters {
```

---

### Incident Patch 2: `f65f9a4f` (2026-08-08)
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

---

### Incident Patch 4: `9f8e9e4f` (2026-08-07)
**Commit Message**: feat(containers): build images on containerd, by running BuildKit as a container (#517)

* feat(containers): build images on containerd, by running BuildKit as a container

containerd cannot build images, so a project shipping its own Dockerfile could
only be built on a docker node. It can now: BuildKit runs as one ordinary
container on this very backend, writes an image tarball, and that gets imported.
Nothing has to be installed on the host and no daemon has to be kept alive —
the builder is a container that exits when it is done, which also means it works
the same rootful and rootless.

Three flags make BuildKit work inside a container that is itself unprivileged,
and each was found the hard way:

  --oci-worker-no-process-sandbox  BuildKit would nest a user namespace inside
                                   the one it already runs in, and newuidmap
                                   refuses.
  --oci-worker-rootless            its per-step runc must not expect a cgroup
                                   of its own.
  --oci-worker-snapshotter=native  overlayfs cannot be mounted from a userns.

The :rootless image is the wrong one here, counterintuitively: it runs
rootlesskit, wh

**File**: `pkg/containers/README.md` (modified, +23/-7)
```diff
@@ -12,8 +12,8 @@ Runs containers from Go, over docker or containerd.
 | --- | --- |
 | `containers` | The client: images, containers, run, logs. What callers use. |
 | `core` | The `Backend` and `Image` interfaces, the config types, the backend registry. |
-| `backends/docker` | Docker backend. Can build images. |
-| `backends/containerd` | containerd backend, Linux only. Cannot build images. |
+| `backends/docker` | Docker backend. Builds natively. |
+| `backends/containerd` | containerd backend, Linux only. Builds by running BuildKit. |
 | `backends/conformance` | The behaviour both backends are held to. |
 | `gc` | Periodic image cleanup. |
 
@@ -68,21 +68,37 @@ tar cvf image.tar -C <dir>/ .
 client.Image(ctx, "org/name:version", containers.Build(tarball))
 ```
 
-Image names must be lowercase. Building needs a backend that supports it —
-check `Capabilities().SupportsBuild`; containerd does not, having no BuildKit
-wired up.
+Image names must be lowercase. Both backends build: docker hands the context to
+its daemon, and containerd runs BuildKit as a one-shot container and imports
+what it produces, so nothing extra has to be installed or kept running. Check
+`Capabilities().SupportsBuild` before building anyway — it is what routes a
+build, and a backend added later may not.
 
 ## Backend differences
 
 Docker and containerd are interchangeable for running containers: same exit
 codes, same log framing, same environment, working directory and bind mounts,
 all enforced by the conformance suite. They still differ where the runtimes do:
 
-- **Building.** Docker only.
 - **Networking.** Docker bridges by default. containerd runs without CNI, so it
   shares the host's network instead; `none` isolates, and a bridged mode is
-  refused rather than silently downgraded.
+  refused rather than silently downgraded. containerd containers use the host's
+  resolver, so custom DNS servers are refused there.
 - **Port mappings and named volumes.** Docker only. containerd refuses both.
+- **What a build needs.** containerd's BuildKit container needs the host's
+  cgroup hierarchy either way, because BuildKit runs a runc of its own per step.
+  Beyond that it differs by mode, and the difference is not cosmetic — asking
+  for the wrong one stops buildkitd from starting at all:
+
+  | | rootless containerd | rootful containerd |
+  | --- | --- | --- |
+  | buildkitd flags | no-process-sandbox, rootless worker, native snapshotter | none: its defaults are right |
+  | privileges | `CAP_SYS_ADMIN` + `/dev/fuse` | privileged |
+
+  Privileged is asked for only where the runtime is already real root, so it
+  relaxes the container and grants nothing the process did not have. Under a
+  rootless runtime the user namespace is the boundary and the narrow set stays
+  inside it. Docker builds need none of this — its daemon builds natively.
 - **Resource limits.** Not available on *rootless* containerd, which cannot
   create the cgroup that would enforce them; asking for them there is an error
   rather than a limit that quietly does nothing.
```

**File**: `pkg/containers/backends/conformance/conformance.go` (modified, +55/-0)
```diff
@@ -9,6 +9,7 @@
 package conformance
 
 import (
+	"archive/tar"
 	"bytes"
 	"context"
 	"fmt"
@@ -56,6 +57,7 @@ func Run(t *testing.T, b Backend) {
 	t.Run("LargeOutput", func(t *testing.T) { testLargeOutput(t, b) })
 	t.Run("RemoveIsFinal", func(t *testing.T) { testRemoveIsFinal(t, b) })
 	t.Run("CleanKeepsRecentImages", func(t *testing.T) { testCleanKeepsRecentImages(t, b) })
+	t.Run("BuildFromDockerfile", func(t *testing.T) { testBuildFromDockerfile(t, b) })
 	t.Run("HealthCheck", func(t *testing.T) {
 		assert.NoError(t, b.Backend.HealthCheck(context.Background()))
 	})
@@ -240,6 +242,59 @@ func testCleanKeepsRecentImages(t *testing.T, b Backend) {
 	assert.True(t, image.Exists(ctx), "an image younger than the cutoff must survive the sweep")
 }
 
+func testBuildFromDockerfile(t *testing.T, b Backend) {
+	if !b.Backend.Capabilities().SupportsBuild {
+		t.Skip("backend does not build images")
+	}
+
+	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
+	defer cancel()
+
+	// A distinct name per run: a build must not be satisfied by something an
+	// earlier one left behind.
+	name := fmt.Sprintf("tau-conformance-build:%d", time.Now().UnixNano())
+
+	dockerfile := fmt.Sprintf("FROM %s\nRUN echo built-by-tau > /marker\n", b.Image)
+
+	image := b.Backend.Image(name)
+	require.NoError(t, image.Build(ctx, &core.DockerfileBuild{
+		Context: tarOfDockerfile(t, dockerfile),
+	}), "building a Dockerfile must succeed")
+
+	t.Cleanup(func() {
+		removeCtx, removeCancel := context.WithTimeout(context.Background(), time.Minute)
+		defer removeCancel()
+		b.Backend.Image(name).Remove(removeCtx)
+	})
+
+	assert.True(t, image.Exists(ctx), "a built image must exist locally")
+
+	// The point of building is running what was built, under the name asked for.
+	got := run(t, Backend{Backend: b.Backend, Image: name}, sh("cat /marker"))
+
+	assert.Equal(t, 0, got.exitCode, "the built image must run, stderr: %s", got.stderr)
+	assert.Contains(t, got.stdout, "built-by-tau", "the built layer must be present")
+}
+
+// tarOfDockerfile packs a one-file build context.
+func tarOfDockerfile(t *testing.T, dockerfile string) io.Reader {
+	t.Helper()
+
+	var buf bytes.Buffer
+	writer := tar.NewWriter(&buf)
+
+	require.NoError(t, writer.WriteHeader(&tar.Header{
+		Name: "Dockerfile",
+		Mode: 0o644,
+		Size: int64(len(dockerfile)),
+	}))
+	_, err := io.WriteString(writer, dockerfile)
+	require.NoError(t, err)
+	require.NoError(t, writer.Close())
+
+	return &buf
+}
+
 // RunStopsRunningContainer checks that a container still running can be stopped
 // and removed, which is how a build is cancelled. It is separate from Run
 // because it is the only case that leaves a container running.
```

**File**: `pkg/containers/backends/containerd/build.go` (added, +387/-0)
```diff
@@ -0,0 +1,387 @@
+//go:build linux
+
+package containerd
+
+import (
+	"archive/tar"
+	"bytes"
+	"context"
+	"fmt"
+	"io"
+	"os"
+	"path"
+	"path/filepath"
+	"strings"
+
+	"github.com/containerd/containerd/images"
+	"github.com/containerd/containerd/namespaces"
+	"github.com/containerd/errdefs"
+	"github.com/moby/moby/api/pkg/stdcopy"
+	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
+	"github.com/taubyte/tau/pkg/containers/core"
+)
+
+// containerd cannot build images itself, so BuildKit is run as an ordinary
+// container on this very backend and its output imported. Nothing has to be
+// installed on the host and no daemon has to be kept alive for it: the build
+// is one container that exits when it is done.
+//
+// Pinned rather than tracking latest — a builder that changes underneath you
+// changes everyone's builds.
+const buildkitImage = "docker.io/moby/buildkit:v0.32.2"
+
+// Where the build's inputs and outputs are mounted inside that container.
+const (
+	buildContextPath = "/tau/context"
+	buildOutputPath  = "/tau/out"
+	buildOutputFile  = "image.tar"
+	cgroupPath       = "/sys/fs/cgroup"
+)
+
+// buildkitFlags configures the buildkitd that buildctl-daemonless.sh starts.
+//
+// The flags depend on how containerd itself runs, because they exist purely to
+// cope with being unprivileged. Asking for them as real root does not merely
+// waste them: buildkitd refuses to start at all, with "rootless mode requires
+// to be executed as the mapped root in a user namespace".
+//
+// Under a rootful containerd the build container is real root, with cgroups and
+// overlayfs available, and BuildKit's own defaults are the right ones.
+//
+// Under a rootless one it needs all three:
+//
+//   - no-process-sandbox: BuildKit would otherwise create a user namespace of
+//     its own. We are already in one, and nesting fails with
+//     "newuidmap: Operation not permitted".
+//   - rootless worker: the runc BuildKit runs for each step must not expect a
+//     cgroup of its own, or every RUN fails with "no cgroup mount found in
+//     mountinfo".
+//   - native snapshotter: overlayfs cannot be mounted from within a user
+//     namespace, so the slower snapshotter that only copies is the one that works.
+func buildkitFlags(rootless bool) []string {
+	if !rootless {
+		return nil
+	}
+
+	return []string{"BUILDKITD_FLAGS=" +
+		"--oci-worker-no-process-sandbox " +
+		"--oci-worker-rootless " +
+		"--oci-worker-snapshotter=native"}
+}
+
+// buildPrivileges is what the builder needs loosened, and it differs by mode
+// for the same reason the flags do.
+//
+// Rootless: the user namespace is the real boundary, so the narrow set is
+// enough and stays inside it. SYS_ADMIN to mount layers, /dev/fuse for the
+// snapshotter a rootless build falls back to.
+//
+// Rootful: the runc BuildKit runs per step attaches a BPF device filter to its
+// cgroup, which SYS_ADMIN alone does not permit — "bpf_prog_query
+// (BPF_CGROUP_DEVICE) failed: operation not permitted". The process is already
+// real root on the host there, so dropping the container's confinement grants
+// it nothing it did not already have.
+func buildPrivileges(rootless bool) *core.Privileges {
+	if !rootless {
+		return &core.Privileges{Unconfined: true, Privileged: true}
+	}
+
+	return &core.Privileges{
+		Capabilities: []string{"SYS_ADMIN"},
+		Devices:      []string{"/dev/fuse"},
+		Unconfined:   true,
+	}
+}
+
+// Build builds the image from a Dockerfile by running BuildKit in a container
+// and importing what it produces.
+func (i *containerdImage) Build(ctx context.Context, input *core.DockerfileBuild) error {
+	if i.backend.client == nil {
+		return fmt.Errorf("containerd client not initialized")
+	}
+
+	if input == nil || input.Context == nil {
+		return fmt.Errorf("build requires a context")
+	}
+
+	workDir, err := os.MkdirTemp("", "tau-build-*")
+	if err != nil {
+		return fmt.Errorf("failed to create build directory: %w", err)
+	}
+	defer os.RemoveAll(workDir)
+
+	contextDir := filepath.Join(workDir, "context")
+	outputDir := filepath.Join(workDir, "out")
+
+	for _, dir := range []string{contextDir, outputDir} {
+		if err := os.MkdirAll(dir, 0o777); err != nil {
+			return fmt.Errorf("failed to create %s: %w", dir, err)
+		}
+		// Explicitly, because MkdirAll applies the umask: under a rootful
+		// containerd the build runs as real root and writes its result back here.
+		if err := os.Chmod(dir, 0o777); err != nil {
+			return fmt.Errorf("failed to open up %s: %w", dir, err)
+		}
+	}
+
+	if err := extractContext(input.Context, contextDir); err != nil {
+		return fmt.Errorf("failed to unpack build context: %w", err)
+	}
+
+	if err := i.runBuildKit(ctx, contextDir, outputDir, input.DockerfileName()); err != nil {
+		return err
+	}
+
+	return i.importBuilt(ctx, filepath.Join(outputDir, buildOutputFile))
+}
+
+// runBuildKit runs one build and returns the builder's own output on failure —
+// that output is the compiler error,
```

**File**: `pkg/containers/backends/containerd/build_test.go` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+//go:build linux
+
+package containerd
+
+import (
+	"archive/tar"
+	"bytes"
+	"io"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/taubyte/tau/pkg/containers/core"
+)
+
+// tarOf builds a context tarball from a list of entries.
+func tarOf(t *testing.T, entries ...*tar.Header) io.Reader {
+	t.Helper()
+
+	var buf bytes.Buffer
+	writer := tar.NewWriter(&buf)
+
+	for _, header := range entries {
+		body := ""
+		if header.Typeflag == tar.TypeReg {
+			body = "content of " + header.Name
+			header.Size = int64(len(body))
+		}
+		require.NoError(t, writer.WriteHeader(header))
+		if body != "" {
+			_, err := io.WriteString(writer, body)
+			require.NoError(t, err)
+		}
+	}
+
+	require.NoError(t, writer.Close())
+
+	return &buf
+}
+
+func file(name string) *tar.Header {
+	return &tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0o644}
+}
+
+func TestExtractContext(t *testing.T) {
+	t.Run("files and directories", func(t *testing.T) {
+		dir := t.TempDir()
+
+		require.NoError(t, extractContext(tarOf(t,
+			&tar.Header{Name: "sub", Typeflag: tar.TypeDir, Mode: 0o755},
+			file("Dockerfile"),
+			file("sub/app.go"),
+		), dir))
+
+		content, err := os.ReadFile(filepath.Join(dir, "Dockerfile"))
+		require.NoError(t, err)
+		assert.Equal(t, "content of Dockerfile", string(content))
+
+		_, err = os.Stat(filepath.Join(dir, "sub", "app.go"))
+		assert.NoError(t, err, "nested files must be extracted")
+	})
+
+	t.Run("a file with no directory entry still lands", func(t *testing.T) {
+		// Not every tar writer emits directory headers.
+		dir := t.TempDir()
+
+		require.NoError(t, extractContext(tarOf(t, file("deep/nested/app.go")), dir))
+
+		_, err := os.Stat(filepath.Join(dir, "deep", "nested", "app.go"))
+		assert.NoError(t, err)
+	})
+
+	// The context comes from a user's repository. These are the entries a
+	// malicious one would use to write outside the build or read the host.
+	t.Run("a path escaping the build directory is refused", func(t *testing.T) {
+		dir := t.TempDir()
+
+		for _, name := range []string{
+			"../escaped.txt",
+			"sub/../../escaped.txt",
+			"/etc/cron.d/escaped",
+		} {
+			err := extractContext(tarOf(t, file(name)), dir)
+			if name == "/etc/cron.d/escaped" {
+				// An absolute path is rooted into the build directory rather
+				// than refused: it cannot escape, so it is harmless.
+				require.NoError(t, err, "%s", name)
+				continue
+			}
+			require.Error(t, err, "%q must be refused", name)
+			assert.Contains(t, err.Error(), "escapes")
+		}
+
+		// Nothing may exist above the build directory.
+		_, err := os.Stat(filepath.Join(filepath.Dir(dir), "escaped.txt"))
+		assert.True(t, os.IsNotExist(err), "an escaping entry must not be written")
+	})
+
+	t.Run("a link pointing outside the context is refused", func(t *testing.T) {
+		for _, link := range []string{"/etc/shadow", "../../../etc/shadow"} {
+			dir := t.TempDir()
+
+			err := extractContext(tarOf(t, &tar.Header{
+				Name:     "secret",
+				Typeflag: tar.TypeSymlink,
+				Linkname: link,
+			}), dir)
+
+			require.Error(t, err, "a link to %q must be refused", link)
+			assert.Contains(t, err.Error(), "outside")
+		}
+	})
+
+	t.Run("a link inside the context is kept", func(t *testing.T) {
+		dir := t.TempDir()
+
+		require.NoError(t, extractContext(tarOf(t,
+			file("real.txt"),
+			&tar.Header{Name: "link.txt", Typeflag: tar.TypeSymlink, Linkname: "real.txt"},
+		), dir))
+
+		target, err := os.Readlink(filepath.Join(dir, "link.txt"))
+		require.NoError(t, err)
+		assert.Equal(t, "real.txt", target)
+	})
+
+	t.Run("device entries are skipped rather than created", func(t *testing.T) {
+		dir := t.TempDir()
+
+		require.NoError(t, extractContext(tarOf(t,
+			&tar.Header{Name: "dev/null", Typeflag: tar.TypeChar, Mode: 0o666},
+			file("Dockerfile"),
+		), dir))
+
+		_, err := os.Stat(filepath.Join(dir, "dev", "null"))
+		assert.True(t, os.IsNotExist(err), "a device node has no place in a build context")
+
+		_, err = os.Stat(filepath.Join(dir, "Dockerfile"))
+		assert.NoError(t, err, "entries after a skipped one must still be extracted")
+	})
+
+	t.Run("a truncated tar is an error", func(t *testing.T) {
+		err := extractContext(strings.NewReader("this is not a tar"), t.TempDir())
+		assert.Error(t, err)
+	})
+}
+
+func TestConfine(t *testing.T) {
+	dir := "/build"
+
+	for _, name := range []string{"Dockerfile", "sub/app.go", "/rooted", "./x"} {
+		target, err := confine(dir, name)
+		require.NoError(t, err, "%q", name)
+		assert.True(t, strings.HasPrefix(target, dir+"/"), "%q -> %q", name, target)
+	}
+
+	for _, name := range []string{"../x", "sub/../../x", "../../../etc/passwd"} {
+		_, err := confine(dir, name)
+		assert.Error(t, err, "%q must be refused", name)
+	}
+}
+
+func TestBuildRequiresContext(t *testing.T) {
+	image := (&ContainerdBackend{client: &Client{}}).Image("x:latest")
+
+	assert.Error(t, image.Bu
```

**File**: `pkg/containers/backends/containerd/containerd.go` (modified, +80/-4)
```diff
@@ -480,7 +480,56 @@ func specOpts(config *core.ContainerConfig) ([]oci.SpecOpts, error) {
 	}
 	opts = append(opts, networkOpts...)
 
-	return append(opts, resourceSpecOpts(config.Resources)...), nil
+	opts = append(opts, resourceSpecOpts(config.Resources)...)
+
+	return append(opts, privilegeSpecOpts(config.Privileges)...), nil
+}
+
+// privilegeSpecOpts widens the container's confinement. The OCI spec names
+// capabilities with the CAP_ prefix, and a device needs a cgroup rule next to
+// the node or the container may not open it.
+func privilegeSpecOpts(privileges *core.Privileges) []oci.SpecOpts {
+	if privileges == nil {
+		return nil
+	}
+
+	var opts []oci.SpecOpts
+
+	if len(privileges.Capabilities) > 0 {
+		prefixed := make([]string, 0, len(privileges.Capabilities))
+		for _, capability := range privileges.Capabilities {
+			prefixed = append(prefixed, "CAP_"+capability)
+		}
+		opts = append(opts, oci.WithAddedCapabilities(prefixed))
+	}
+
+	for _, device := range privileges.Devices {
+		opts = append(opts, oci.WithDevices(device, device, "rwm"))
+	}
+
+	if privileges.Unconfined {
+		// AppArmor needs nothing here: unlike docker, containerd applies no
+		// profile of its own unless one is asked for.
+		opts = append(opts, oci.WithSeccompUnconfined)
+	}
+
+	if privileges.Privileged {
+		// Deliberately not oci.WithPrivileged: it composes
+		// WithAllCurrentCapabilities, which copies the capabilities of *this*
+		// process. A tau talking to a system containerd is typically an
+		// unprivileged client of a root daemon, and there that grants the
+		// container nothing at all — the mounts then fail with "operation not
+		// permitted" while the spec still claims to be privileged. What the
+		// daemon may grant does not depend on the caller's own capabilities.
+		opts = append(opts,
+			oci.WithAllKnownCapabilities,
+			oci.WithMaskedPaths(nil),
+			oci.WithReadonlyPaths(nil),
+			oci.WithAllDevicesAllowed,
+		)
+	}
+
+	return opts
 }
 
 // volumeMounts turns the unified volume mounts into OCI bind mounts.
@@ -523,12 +572,16 @@ func networkSpecOpts(network *core.NetworkConfig) ([]oci.SpecOpts, error) {
 		mode = network.Mode
 	}
 
+	if network != nil && len(network.DNS) > 0 {
+		return nil, fmt.Errorf("custom DNS servers not supported by containerd: the container uses the host's resolver")
+	}
+
 	switch mode {
 	case "host":
 		if network != nil && len(network.PortMappings) > 0 {
 			return nil, fmt.Errorf("port mappings not supported by containerd host networking: the container already shares the host's ports")
 		}
-		return []oci.SpecOpts{oci.WithHostNamespace(specs.NetworkNamespace)}, nil
+		return append(resolverMount(), oci.WithHostNamespace(specs.NetworkNamespace)), nil
 	case "none":
 		// The default spec already unshares the network namespace.
 		return nil, nil
@@ -550,6 +603,28 @@ func withoutCgroups() oci.SpecOpts {
 	}
 }
 
+// resolverMount hands the container the host's DNS configuration.
+//
+// containerd, unlike docker, injects nothing: a container's /etc/resolv.conf is
+// whatever its image shipped, which is usually nothing, and every lookup then
+// falls back to localhost and fails. Any build that fetches dependencies needs
+// this. The container shares the host's network namespace, so a resolver the
+// host reaches on loopback works here too.
+func resolverMount() []oci.SpecOpts {
+	const resolvConf = "/etc/resolv.conf"
+
+	if _, err := os.Stat(resolvConf); err != nil {
+		return nil
+	}
+
+	return []oci.SpecOpts{oci.WithMounts([]specs.Mount{{
+		Destination: resolvConf,
+		Type:        "bind",
+		Source:      resolvConf,
+		Options:     []string{"rbind", "ro"},
+	}})}
+}
+
 func resourceSpecOpts(resources *core.ResourceLimits) []oci.SpecOpts {
 	if resources == nil {
 		return nil
@@ -992,8 +1067,9 @@ func (b *ContainerdBackend) HealthCheck(ctx context.Context) error {
 
 // Capabilities returns the backend capabilities
 func (b *ContainerdBackend) Capabilities() core.BackendCapabilities {
-	// No BuildKit is wired up, so this backend runs images but cannot build them.
-	return core.BackendCapabilities{SupportsBuild: false}
+	// Builds run BuildKit in a container (see build.go), so this backend can
+	// build wherever it can run.
+	return core.BackendCapabilities{SupportsBuild: true}
 }
 
 // testSocketConnection checks if we can connect to the containerd socket.
```

**File**: `pkg/containers/backends/containerd/containerd_test.go` (modified, +3/-9)
```diff
@@ -92,9 +92,9 @@ func TestGetSocketPath(t *testing.T) {
 }
 
 func TestCapabilities(t *testing.T) {
-	// No BuildKit is wired up, and callers pick a backend by this flag: saying
-	// otherwise sends Dockerfile builds to a backend that cannot run them.
-	assert.False(t, (&ContainerdBackend{}).Capabilities().SupportsBuild)
+	// Builds run BuildKit in a container, so this backend can build wherever it
+	// can run. Callers route Dockerfile builds by this flag.
+	assert.True(t, (&ContainerdBackend{}).Capabilities().SupportsBuild)
 }
 
 func TestEnsureContainerdRunningWithoutSocket(t *testing.T) {
@@ -450,12 +450,6 @@ func TestImageWithoutClient(t *testing.T) {
 	assert.Error(t, err)
 }
 
-func TestImageBuildUnsupported(t *testing.T) {
-	// The backend advertises SupportsBuild=false; Build must agree with it.
-	err := (&ContainerdBackend{}).Image("test:latest").Build(context.Background(), nil)
-	assert.ErrorIs(t, err, core.ErrBuildNotSupported)
-}
-
 func TestTaskIOCloseIsIdempotent(t *testing.T) {
 	// close runs on error paths, on Stop and on Remove; a double close must not
 	// panic and must still remove the FIFO directory.
```

**File**: `pkg/containers/backends/containerd/image.go` (modified, +0/-6)
```diff
@@ -9,7 +9,6 @@ import (
 
 	"github.com/containerd/containerd"
 	"github.com/containerd/containerd/namespaces"
-	"github.com/taubyte/tau/pkg/containers/core"
 )
 
 // containerdImage implements the core.Image interface for containerd
@@ -34,11 +33,6 @@ func (i *containerdImage) Pull(ctx context.Context) error {
 	return nil
 }
 
-// Build builds an image from backend-specific inputs
-func (i *containerdImage) Build(ctx context.Context, input core.BuildInput) error {
-	return core.ErrBuildNotSupported
-}
-
 // Exists checks if the image exists locally
 func (i *containerdImage) Exists(ctx context.Context) bool {
 	if i.backend.client == nil {
```

**File**: `pkg/containers/backends/containerd/vagrant/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Built on the host and dropped here for the guest to run.
+*.test
```

---

### Incident Patch 5: `ad5ab13e` (2026-08-07)
**Commit Message**: fix(containers): make containerd a real peer of docker, and the tests hermetic (#516)

* fix(containers): make containerd a real peer of docker, and the tests hermetic

The containerd backend could not run a build. Its logs came back unframed
while every caller demultiplexes them with stdcopy, so output decoded to
garbage; volumes were dropped on the floor, so nothing was ever mounted; and
because nothing drained the task FIFOs until Logs was called, any container
writing more than a pipe buffer — every real build — blocked forever.

Both backends now answer to one conformance suite (exit codes, log content and
framing, environment, working directory, bind mounts, large output, cleanup),
run from each backend's integration tests. Divergences that remain are the ones
the runtimes impose, and are refused loudly rather than downgraded silently:
containerd has no CNI, so bridged networking and port mappings are errors, and
it shares the host network instead; rootless containerd cannot create cgroups,
so resource limits are an error there.

containerd also now takes the image's own environment, working directory and
entrypoint, read from the config blob rather than through oci.WithImage

**File**: `.github/workflows/pre-commit.yml` (modified, +9/-16)
```diff
@@ -146,44 +146,37 @@ jobs:
   containerd-integration:
     runs-on: ubuntu-latest
     needs: pre-commit
-    services:
-      docker:
-        image: docker:19.03.12
-        options: --privileged
-        ports:
-          - 2375:2375
-        volumes:
-          - /var/lib/docker
     steps:
       - uses: actions/checkout@v3
       - uses: actions/setup-go@v4
         with:
           go-version: '1.26.0'
-      - name: Set up Docker environment
-        run: docker info
 
-      # --- Rootful: install + start system containerd ---
+      # The tests talk to this containerd directly. They used to start one
+      # inside a privileged docker container instead, which is why this job
+      # needed a docker service; it no longer does.
       - name: Install and start containerd
         run: |
           sudo apt-get update
           sudo apt-get install -y containerd.io
           sudo systemctl start containerd
           sudo chmod 666 /run/containerd/containerd.sock
 
-      # --- Rootless: install deps + subuid/subgid ---
+      # Prerequisites for the rootless path, which the backend falls back to
+      # when the system socket is not reachable.
       - name: Install rootless prerequisites
         run: |
           sudo apt-get install -y rootlesskit slirp4netns uidmap
           u="$(whoami)"
           grep -q "^${u}:" /etc/subuid || echo "${u}:100000:65536" | sudo tee -a /etc/subuid
           grep -q "^${u}:" /etc/subgid || echo "${u}:100000:65536" | sudo tee -a /etc/subgid
 
-      # Run all containerd tests (unit + integration); integration tests require -tags=containerd_integration
-      # Use runner's Docker (default socket); do not set DOCKER_HOST so NestedDocker tests can connect
+      # Unit tests and integration tests both: the unit tests need no daemon,
+      # the integration ones drive the shared conformance suite.
       - name: Run containerd tests (unit + integration)
         run: |
-          go test -tags=containerd_integration ./pkg/containers/backends/containerd \
-            -count=1 -timeout 15m -v -p 1
+          go test -tags=containerd_integration ./pkg/containers/... \
+            -count=1 -timeout 20m -v -p 1
 
   docker-integration:
     runs-on: ubuntu-latest
```

**File**: `Makefile` (modified, +16/-2)
```diff
@@ -18,7 +18,7 @@ DREAM_P ?= 4
 # it fails the package outright rather than skipping it.
 DREAM_PKGS = $(shell grep -rl --include='*_test.go' '//go:build dreaming' . | xargs grep -L '//go:build dreaming && ee' | sed 's|^\./||' | grep -vE '^(ee/|\.)' | xargs -n1 dirname | sort -u | sed 's|^|./|')
 
-.PHONY: test test-dreaming test-raft test-docker test-all bench-dreaming vm-fixtures test-cli test-cli-cover
+.PHONY: test test-dreaming test-raft test-docker test-containerd test-containers test-all bench-dreaming vm-fixtures test-cli test-cli-cover
 
 test:
 	go test $(FLAGS) ./...
@@ -57,8 +57,22 @@ test-dreaming:
 test-raft:
 	GOMEMLIMIT=$(GOMEMLIMIT) go test -tags raft_integration -p 1 -timeout 20m $(FLAGS) ./pkg/raft/...
 
+# Container backend integration suites. Both drive the same conformance suite
+# (pkg/containers/backends/conformance), which is what keeps docker and
+# containerd interchangeable. They are kept out of `test`/`test-all` because
+# they need a live runtime; the untagged tests under ./pkg/containers/... run
+# with no daemon at all.
+#
+# test-docker needs a running docker daemon.
+# test-containerd needs either a reachable /run/containerd/containerd.sock or
+# containerd + rootlesskit on PATH (plus subuid/subgid entries) for rootless.
 test-docker:
-	go test -tags docker_integration -run '_Integration$$' -p 1 $(FLAGS) ./pkg/containers/...
+	go test -tags docker_integration -run '_Integration$$' -p 1 -timeout 15m $(FLAGS) ./pkg/containers/...
+
+test-containerd:
+	go test -tags containerd_integration -run '_Integration$$' -p 1 -timeout 20m $(FLAGS) ./pkg/containers/...
+
+test-containers: test-docker test-containerd
 
 test-all: test test-dreaming test-raft
 
```

**File**: `pkg/containers/README.md` (modified, +71/-112)
```diff
@@ -1,148 +1,107 @@
-# taubyte/go-simple-container 
+# containers
 
-[![Release](https://img.shields.io/github/release/taubyte/go-simple-container.svg)](https://github.com/taubyte/tau/pkg/containers/releases)
-[![License](https://img.shields.io/github/license/taubyte/go-simple-container)](LICENSE)
-[![Go Report Card](https://goreportcard.com/badge/taubyte/go-simple-container)](https://goreportcard.com/report/taubyte/go-simple-container)
+[![License](https://img.shields.io/github/license/taubyte/tau)](../../LICENSE)
 [![GoDoc](https://godoc.org/github.com/taubyte/tau/pkg/containers?status.svg)](https://pkg.go.dev/github.com/taubyte/tau/pkg/containers)
 [![Discord](https://img.shields.io/discord/973677117722202152?color=%235865f2&label=discord)](https://tau.link/discord)
 
-An abstraction layer over the docker api client. Goal: make it simple to use containers from go.
+Runs containers from Go, over docker or containerd.
 
-## Installation 
-The import path for the package is *github.com/taubyte/tau/pkg/containers*.
+## Layout
 
-To install it, run:
-```bash 
-go get github.com/taubyte/tau/pkg/containers
-```
+| Package | What it is |
+| --- | --- |
+| `containers` | The client: images, containers, run, logs. What callers use. |
+| `core` | The `Backend` and `Image` interfaces, the config types, the backend registry. |
+| `backends/docker` | Docker backend. Can build images. |
+| `backends/containerd` | containerd backend, Linux only. Cannot build images. |
+| `backends/conformance` | The behaviour both backends are held to. |
+| `gc` | Periodic image cleanup. |
 
+`New()` picks a backend at construction: docker if its daemon answers, otherwise
+containerd. Callers do not choose.
 
 ## Usage
 
-### Basic Example
 ```go
-import (
-    ci "github.com/taubyte/tau/pkg/containers"
-    "context"
-)
-
-ctx := context.Background()
-
-// Create an new client
-client, err := ci.New()
-if err != nil{
+client, err := containers.New()
+if err != nil {
     return err
 }
 
-// Using `node` image for our container
-dockerImage := "node"
-
-// Initialize docker image with our given image name
-image, err := client.Image(ctx, dockerImage)
-if err != nil{
+image, err := client.Image(ctx, "alpine:latest")
+if err != nil {
     return err
 }
 
-// Commands we will be running
-commands := []string{"echo","Hello World!"}
-
-// Mount Volume Option 
-volume := ci.Volume("/sourcePath","/containerPath")
-
-// Add Environment Variable Option
-variable := ci.Variable("KEY","value")
-
-// Instantiate the container with commands we will run
-container, err := image.Instantiate(
-    ctx,
-    ci.Command(commands),
-    // options
-    volume, 
-    variable
+container, err := image.Instantiate(ctx,
+    containers.Command([]string{"echo", "Hello World!"}),
+    containers.Volume("/host/path", "/container/path"),
+    containers.Variable("KEY", "value"),
 )
-if err != nil{
+if err != nil {
     return err
 }
 
-// Run container 
 logs, err := container.Run(ctx)
-if err != nil{
-    return err
+// logs are readable even when err wraps ErrorExitCode: that is where a failed
+// build's compiler output lives.
+if logs != nil {
+    io.Copy(os.Stdout, logs.Combined())
 }
+```
 
-// Create new byte buffer 
-var buf bytes.Buffer
-
-// Read logs 
-buf.ReadFrom(logs.Combined())
+`Run` starts the container, waits for it, collects its output and removes it. A
+non-zero exit comes back as an error wrapping `ErrorExitCode`; a runtime that
+broke comes back as one of the other sentinels in `errors.go`. Both match with
+`errors.Is`.
 
-// Set output to the string value of the buffer 
-output := buf.String()
+### Building an image from a Dockerfile
 
-// Close the log Reader
-logs.Close()
+The Dockerfile and anything it needs go in a tarball, which becomes an
+`ImageOption`:
 
+```bash
+tar cvf image.tar -C <dir>/ .
 ```
 
-### Using Your Own Dockerfile
-- Create a Dockerfile in a directory with any dependencies that you may need for the Dockerfile, the file must be named Dockerfile. This is case sensitive.
-- run: `$ tar cvf <docker_tarball_name>.tar -C <directory>/ .`
-- Docker expects Dockerfile and any files you need to build the container image inside a tar file.
-    - Using embed: 
-    ```go
-    //go:embed <docker_tarball_name>.tar
-    var tarballData []byte 
-    
-    imageOption := containers.Build(bytes.NewBuffer(tarballData))
-    ```
-    - Using a file:
-    ```go 
-    tarball, err := os.Open("<path_to>/<docker_tarball_name.tar>")
-    if err != nil{
-        return err
-    }
-    defer tarball.Close()
-
-    imageOption := containers.Build(tarball)
-    ```
-
-- Create the image with a custom image name, and the the ImageOption
-    - The image name must follow the convention `<Organization>/<Repo_Name>:Version`
-    - All characters must be lower case 
 ```go
-client.Image(context.Background(),"taubyte/testrepo:version1",imageOption)
+client.Image(ctx, "org/name:version", containers.Build(tarball))
 ```
 
+Image names must be lowerca
```

**File**: `pkg/containers/all_test.go` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ func TestContainerCleanUpInterval_Integration(t *testing.T) {
 		ctx,
 		gc.Interval(20*time.Second),
 		gc.MaxAge(10*time.Second),
-		gc.Filter("reference", testGCImage),
+		gc.Reference(testGCImage),
 	)
 	if err != nil {
 		t.Error(err)
```

**File**: `pkg/containers/backends/conformance/conformance.go` (added, +286/-0)
```diff
@@ -0,0 +1,286 @@
+// Package conformance holds the behaviour every container backend must
+// exhibit. Docker and containerd are interchangeable only if they agree on
+// what a run does — exit codes, log content and framing, environment, working
+// directory, bind mounts, cleanup — so both backends run this one suite
+// instead of each carrying its own hand-written and quietly divergent set.
+//
+// The suite is driven from each backend's integration tests, which already
+// gate on their runtime being present.
+package conformance
+
+import (
+	"bytes"
+	"context"
+	"fmt"
+	"io"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/moby/moby/api/pkg/stdcopy"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/taubyte/tau/pkg/containers/core"
+)
+
+// Backend is what a suite runs against: a live backend and the name of a
+// shell-carrying image it can run, spelled the way that backend expects
+// (containerd needs a fully qualified reference, docker does not).
+type Backend struct {
+	Backend core.Backend
+	Image   string
+}
+
+// Run executes the whole suite. Each case is a subtest, so a backend that
+// fails one still reports the rest.
+func Run(t *testing.T, b Backend) {
+	t.Helper()
+
+	require.NotNil(t, b.Backend, "backend is required")
+	require.NotEmpty(t, b.Image, "image is required")
+
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
+	defer cancel()
+
+	require.NoError(t, b.Backend.Image(b.Image).Pull(ctx), "pulling %s must succeed", b.Image)
+
+	t.Run("Stdout", func(t *testing.T) { testStdout(t, b) })
+	t.Run("Stderr", func(t *testing.T) { testStderr(t, b) })
+	t.Run("ExitCode", func(t *testing.T) { testExitCode(t, b) })
+	t.Run("Env", func(t *testing.T) { testEnv(t, b) })
+	t.Run("WorkDir", func(t *testing.T) { testWorkDir(t, b) })
+	t.Run("BindMount", func(t *testing.T) { testBindMount(t, b) })
+	t.Run("ImageDefaults", func(t *testing.T) { testImageDefaults(t, b) })
+	t.Run("LargeOutput", func(t *testing.T) { testLargeOutput(t, b) })
+	t.Run("RemoveIsFinal", func(t *testing.T) { testRemoveIsFinal(t, b) })
+	t.Run("CleanKeepsRecentImages", func(t *testing.T) { testCleanKeepsRecentImages(t, b) })
+	t.Run("HealthCheck", func(t *testing.T) {
+		assert.NoError(t, b.Backend.HealthCheck(context.Background()))
+	})
+}
+
+// result is what one container run produced.
+type result struct {
+	stdout   string
+	stderr   string
+	exitCode int
+}
+
+// run creates, starts and waits for a container, collects its output and
+// removes it. It mirrors what containers.Container.Run does, including reading
+// the logs before removal.
+func run(t *testing.T, b Backend, config *core.ContainerConfig) result {
+	t.Helper()
+
+	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
+	defer cancel()
+
+	config.Image = b.Image
+
+	id, err := b.Backend.Create(ctx, config)
+	require.NoError(t, err, "create must succeed")
+
+	// Removal is registered before start so a failing assertion cannot leak
+	// the container onto the host.
+	t.Cleanup(func() {
+		removeCtx, removeCancel := context.WithTimeout(context.Background(), time.Minute)
+		defer removeCancel()
+		b.Backend.Remove(removeCtx, id)
+	})
+
+	require.NoError(t, b.Backend.Start(ctx, id), "start must succeed")
+
+	// A non-zero exit is the container's result, not a wait failure.
+	require.NoError(t, b.Backend.Wait(ctx, id), "wait must succeed whatever the container exits with")
+
+	info, err := b.Backend.Inspect(ctx, id)
+	require.NoError(t, err, "inspect must succeed")
+
+	logs, err := b.Backend.Logs(ctx, id)
+	require.NoError(t, err, "logs must succeed")
+	defer logs.Close()
+
+	var stdout, stderr bytes.Buffer
+	_, err = stdcopy.StdCopy(&stdout, &stderr, logs)
+	require.NoError(t, err, "backend logs must be a docker-multiplexed stream")
+
+	require.NoError(t, b.Backend.Remove(ctx, id), "remove must succeed")
+
+	return result{stdout: stdout.String(), stderr: stderr.String(), exitCode: info.ExitCode}
+}
+
+// sh runs a shell snippet in the container.
+func sh(script string) *core.ContainerConfig {
+	return &core.ContainerConfig{Command: []string{"/bin/sh", "-c", script}}
+}
+
+func testStdout(t *testing.T, b Backend) {
+	got := run(t, b, sh("echo hello stdout"))
+
+	assert.Contains(t, got.stdout, "hello stdout", "stdout must reach the caller")
+	assert.NotContains(t, got.stderr, "hello stdout", "stdout must not be reported as stderr")
+	assert.Equal(t, 0, got.exitCode)
+}
+
+func testStderr(t *testing.T, b Backend) {
+	got := run(t, b, sh("echo hello stderr >&2"))
+
+	assert.Contains(t, got.stderr, "hello stderr", "stderr must reach the caller on the stderr stream")
+	assert.NotContains(t, got.stdout, "hello stderr", "stderr must not be reported as stdout")
+}
+
+func testExitCode(t *testing.T, b Backend) {
+	// A build step that fails must surface its status and its output: the
+	// output is the compiler error the user needs to see.
+	got := run(t, b, sh(
```

**File**: `pkg/containers/backends/containerd/containerd.go` (modified, +556/-303)
```diff
@@ -3,20 +3,31 @@
 package containerd
 
 import (
+	"bytes"
 	"context"
+	"encoding/binary"
+	"encoding/json"
+	"errors"
 	"fmt"
 	"io"
 	"net"
 	"os"
 	"os/user"
 	"path/filepath"
-	"strings"
+	"slices"
+	"sync"
 	"syscall"
 	"time"
 
 	"github.com/containerd/containerd"
 	"github.com/containerd/containerd/cio"
+	"github.com/containerd/containerd/containers"
+	"github.com/containerd/containerd/content"
+	"github.com/containerd/containerd/images"
 	"github.com/containerd/containerd/namespaces"
+	"github.com/containerd/containerd/oci"
+	"github.com/containerd/errdefs"
+	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
 	"github.com/opencontainers/runtime-spec/specs-go"
 	"github.com/taubyte/tau/pkg/containers/core"
 )
@@ -28,7 +39,8 @@ type Client struct {
 	daemon *Daemon
 }
 
-// taskIO holds the IO streams for a container task
+// taskIO holds the IO streams for a container task, and the output collected
+// from them.
 type taskIO struct {
 	stdout   io.ReadCloser
 	stderr   io.ReadCloser
@@ -37,18 +49,150 @@ type taskIO struct {
 	fifoDir  string        // Directory where FIFOs are created
 	directIO *cio.DirectIO // DirectIO instance for cleanup
 	io       cio.IO        // IO instance for cleanup
+
+	// logs holds the container's output, docker-framed, collected as it is
+	// produced. drained closes once both streams have hit EOF.
+	//
+	// ponytail: whole output in memory; spill to fifoDir if a workload ever
+	// outgrows that.
+	logsMu  sync.Mutex
+	logs    []byte
+	drained sync.WaitGroup
+}
+
+// drain starts copying the task's output the moment it starts running.
+//
+// containerd keeps no log store: these FIFOs are the only sink, and a container
+// that fills their pipe buffer — roughly 64KiB — blocks on write until someone
+// reads. Collecting only when Logs is called therefore wedges any container
+// that says more than that, which is every real build.
+func (t *taskIO) drain() {
+	for _, s := range []struct {
+		reader io.Reader
+		stream byte
+	}{
+		{t.stdout, streamStdout},
+		{t.stderr, streamStderr},
+	} {
+		if s.reader == nil {
+			continue
+		}
+		t.drained.Add(1)
+		go func(reader io.Reader, stream byte) {
+			defer t.drained.Done()
+			// A read error ends this stream; whatever arrived is kept, since
+			// partial build output is still worth showing.
+			io.Copy(&streamFramer{mu: &t.logsMu, w: (*logSink)(t), stream: stream}, reader)
+		}(s.reader, s.stream)
+	}
+}
+
+// logSink appends to a taskIO's collected output. The framer already holds
+// logsMu when it writes.
+type logSink taskIO
+
+func (s *logSink) Write(p []byte) (int, error) {
+	s.logs = append(s.logs, p...)
+	return len(p), nil
+}
+
+// collected returns the output gathered so far, once both streams have ended.
+func (t *taskIO) collected(ctx context.Context) ([]byte, error) {
+	done := make(chan struct{})
+	go func() {
+		t.drained.Wait()
+		close(done)
+	}()
+
+	select {
+	case <-done:
+	case <-ctx.Done():
+		return nil, ctx.Err()
+	}
+
+	t.logsMu.Lock()
+	defer t.logsMu.Unlock()
+
+	return slices.Clone(t.logs), nil
 }
 
 // ContainerdBackend implements the core.Backend interface for containerd
 type ContainerdBackend struct {
-	config     core.ContainerdConfig
-	client     *Client                                   // containerd client (to be implemented)
-	daemon     *Daemon                                   // daemon manager (to be implemented)
-	rootless   *RootlessManager                          // rootless manager (to be implemented)
+	config core.ContainerdConfig
+	client *Client // containerd client (to be implemented)
+	daemon *Daemon // daemon manager (to be implemented)
+
+	// mu guards tasks and containers: a backend is shared across goroutines
+	// (one per build step), and Create/Start/Stop/Remove all mutate both.
+	mu         sync.Mutex
 	tasks      map[core.ContainerID]*taskIO              // Store tasks and their IO for log access
 	containers map[core.ContainerID]containerd.Container // Store containers for cleanup
 }
 
+func (b *ContainerdBackend) putTask(id core.ContainerID, t *taskIO) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	b.tasks[id] = t
+}
+
+func (b *ContainerdBackend) takeTask(id core.ContainerID) (*taskIO, bool) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	t, ok := b.tasks[id]
+	if ok {
+		delete(b.tasks, id)
+	}
+	return t, ok
+}
+
+func (b *ContainerdBackend) getTask(id core.ContainerID) (*taskIO, bool) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	t, ok := b.tasks[id]
+	return t, ok
+}
+
+func (b *ContainerdBackend) putContainer(id core.ContainerID, c containerd.Container) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	b.containers[id] = c
+}
+
+func (b *ContainerdBackend) takeContainer(id core.ContainerID) (containerd.Container, bool) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	c, ok := b.containers[id]
+	if ok {
+		delete(b.containers, id)
+	}
+	return c, ok
+}
+
+// close releases the task's IO: the FIFO readers, the DirectIO/cio pair and the
+// temp directory holding the FIFOs. Safe to call
```

**File**: `pkg/containers/backends/containerd/containerd_integration_test.go` (modified, +130/-487)
```diff
@@ -1,552 +1,195 @@
 //go:build linux && containerd_integration
 
+// Integration tests for the containerd backend. These need a real containerd —
+// either a system daemon at /run/containerd/containerd.sock, or containerd plus
+// rootlesskit on PATH so a rootless one can be started. Run them with
+// `make test-containerd`.
+
 package containerd
 
 import (
 	"context"
-	"io"
 	"net"
+	"os"
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"github.com/taubyte/tau/pkg/containers/backends/conformance"
 	"github.com/taubyte/tau/pkg/containers/core"
 )
 
-func TestContainerdBackend_FullIntegration_Integration(t *testing.T) {
-	testDaemon := &Daemon{}
-	_, err := testDaemon.findContainerdBinary()
-	require.NoError(t, err, "Containerd binary must be available for this test")
-
-	backend, err := New(core.ContainerdConfig{
-		RootlessMode: core.RootlessModeAuto,
-		AutoStart:    true,
-		Namespace:    "tau-test",
-	})
-	require.NoError(t, err, "Backend creation must succeed (rootless environment with containerd and rootlesskit required): %v", err)
-
-	defer func() {
-		if backend != nil && backend.client != nil && backend.client.Client != nil {
-			backend.client.Close()
-		}
-		if backend != nil && backend.daemon != nil {
-			backend.daemon.Stop(context.Background())
-		}
-	}()
-
-	assert.NotNil(t, backend.client, "Client should be initialized")
-	assert.NotNil(t, backend.daemon, "Daemon should be initialized")
+// containerd resolves image names in full, unlike docker's shorthand.
+const testImage = "docker.io/library/alpine:latest"
 
-	err = backend.testSocketConnection()
-	assert.NoError(t, err, "Socket connection should work after successful init")
+// newTestBackend connects to whatever containerd this machine has: the system
+// daemon when it is reachable, otherwise a rootless one started for the test.
+func newTestBackend(t *testing.T) *ContainerdBackend {
+	t.Helper()
 
-	version, err := backend.client.Version(backend.client.ctx)
-	assert.NoError(t, err, "Should be able to get containerd version")
-	assert.NotEmpty(t, version.Version, "Version should not be empty")
+	config := core.ContainerdConfig{Namespace: "tau-test"}
 
-	t.Logf("Successfully connected to containerd version: %s", version.Version)
-}
+	if systemContainerdReachable() {
+		config.RootlessMode = core.RootlessModeDisabled
+	} else {
+		requireBinary(t, "containerd")
+		requireBinary(t, "rootlesskit")
+		config.RootlessMode = core.RootlessModeEnabled
+		config.AutoStart = true
+	}
 
-func TestContainerdBackend_SimpleContainerOutput_Integration(t *testing.T) {
-	testDaemon := &Daemon{}
-	_, err := testDaemon.findContainerdBinary()
-	require.NoError(t, err, "Containerd binary must be available for this test")
-	_, err = testDaemon.findRootlesskitBinary()
-	require.NoError(t, err, "Rootlesskit must be available for this test")
-
-	backend, err := New(core.ContainerdConfig{
-		RootlessMode: core.RootlessModeEnabled,
-		AutoStart:    true,
-		Namespace:    "tau-test",
-	})
-	require.NoError(t, err, "Backend creation must succeed: %v", err)
+	backend, err := New(config)
+	require.NoError(t, err, "containerd must be available: start it system-wide, or install containerd+rootlesskit for the rootless path")
 
-	defer func() {
-		if backend != nil && backend.client != nil && backend.client.Client != nil {
+	t.Cleanup(func() {
+		if backend.client != nil && backend.client.Client != nil {
 			backend.client.Close()
 		}
-		if backend != nil && backend.daemon != nil {
+		if backend.daemon != nil {
 			backend.daemon.Stop(context.Background())
 		}
-	}()
-
-	containerConfig := &core.ContainerConfig{
-		Image:   "quay.io/libpod/alpine:latest",
-		Command: []string{"echo", "hello world"},
-	}
-
-	containerID, err := backend.Create(context.Background(), containerConfig)
-	assert.NoError(t, err, "Container creation should succeed")
-	assert.NotEmpty(t, containerID, "Container ID should not be empty")
-
-	err = backend.Start(context.Background(), containerID)
-	assert.NoError(t, err, "Container start should succeed")
-
-	err = backend.Wait(context.Background(), containerID)
-	assert.NoError(t, err, "Container should exit successfully")
-
-	logs, err := backend.Logs(context.Background(), containerID)
-	assert.NoError(t, err, "Getting logs should succeed")
-	assert.NotNil(t, logs, "Logs reader should not be nil")
-
-	logData, err := io.ReadAll(logs)
-	assert.NoError(t, err, "Reading logs should succeed")
-	logs.Close()
-
-	assert.Contains(t, string(logData), "hello world", "Logs should contain 'hello world'")
-	t.Logf("Container output: %q", string(logData))
-
-	info, err := backend.Inspect(context.Background(), containerID)
-	assert.NoError(t, err, "Container inspection should succeed")
-	assert.Equal(t, 0, info.ExitCode, "Container should exit with code 0")
-
-	err = backend.Remove(context.Background(), containerID)
-	assert.NoError(t, err, "Container removal should succeed")
-}
-
-func TestContainerdBac
```

**File**: `pkg/containers/backends/containerd/containerd_test.go` (modified, +367/-529)
```diff
@@ -1,634 +1,472 @@
 //go:build linux
 
+// Unit tests for the containerd backend. Everything here runs without a
+// containerd daemon, without docker and without the network: the tests that
+// need a live runtime live in containerd_integration_test.go behind the
+// containerd_integration tag.
+
 package containerd
 
 import (
+	"bytes"
 	"context"
 	"fmt"
 	"io"
 	"net"
 	"os"
-	"os/user"
 	"path/filepath"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
-	"github.com/moby/moby/api/types/container"
-	"github.com/moby/moby/api/types/mount"
-	"github.com/moby/moby/client"
+	"github.com/containerd/containerd/containers"
+	"github.com/containerd/containerd/namespaces"
+	"github.com/containerd/containerd/oci"
+	"github.com/moby/moby/api/pkg/stdcopy"
+	"github.com/opencontainers/runtime-spec/specs-go"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/taubyte/tau/pkg/containers/core"
 )
 
-func skipIfSystemContainerdUnavailable(t *testing.T, socketPath string, dialErr error) {
-	if dialErr == nil {
-		return
-	}
-	errStr := dialErr.Error()
-	if strings.Contains(errStr, "permission denied") ||
-		strings.Contains(errStr, "connection refused") ||
-		strings.Contains(errStr, "no such file") {
-		t.Skipf("System containerd at %s not accessible (run as root or in containerd group): %v", socketPath, dialErr)
-	}
-	require.NoError(t, dialErr, "System containerd must be running at %s for this test", socketPath)
-}
+func TestDetectRootlessMode(t *testing.T) {
+	t.Run("explicit modes are preserved", func(t *testing.T) {
+		for _, mode := range []core.RootlessMode{core.RootlessModeEnabled, core.RootlessModeDisabled} {
+			backend := &ContainerdBackend{config: core.ContainerdConfig{RootlessMode: mode}}
 
-func waitForExecCompletion(t *testing.T, ctx context.Context, dockerClient *client.Client, execID string, timeout time.Duration) {
-	t.Helper()
-	deadline := time.Now().Add(timeout)
-	ticker := time.NewTicker(50 * time.Millisecond)
-	defer ticker.Stop()
-	for time.Now().Before(deadline) {
-		select {
-		case <-ticker.C:
-			insp, err := dockerClient.ExecInspect(ctx, execID, client.ExecInspectOptions{})
-			if err != nil {
+			// Enabling rootless mode as root is a conflict, and this suite is
+			// not run as root; every other combination must be left alone.
+			if mode == core.RootlessModeEnabled && os.Geteuid() == 0 {
+				assert.Error(t, backend.detectRootlessMode(), "rootless mode as root must be refused")
 				continue
 			}
-			if !insp.Running {
-				return
-			}
-		case <-ctx.Done():
-			return
-		}
-	}
-}
 
-func TestContainerdBackend_detectRootlessMode(t *testing.T) {
-	config := core.ContainerdConfig{}
+			require.NoError(t, backend.detectRootlessMode())
+			assert.Equal(t, mode, backend.config.RootlessMode, "explicit mode %v must survive detection", mode)
+		}
+	})
 
-	backend := &ContainerdBackend{
-		config: config,
-	}
+	t.Run("auto resolves by euid", func(t *testing.T) {
+		backend := &ContainerdBackend{config: core.ContainerdConfig{RootlessMode: core.RootlessModeAuto}}
 
-	err := backend.detectRootlessMode()
-	if err != nil {
-		t.Fatalf("detectRootlessMode failed: %v", err)
-	}
+		require.NoError(t, backend.detectRootlessMode())
 
-	currentUser, err := user.Current()
-	if err != nil {
-		t.Fatalf("user.Current() failed: %v", err)
-	}
+		want := core.RootlessModeEnabled
+		if os.Geteuid() == 0 {
+			want = core.RootlessModeDisabled
+		}
+		assert.Equal(t, want, backend.config.RootlessMode)
+		assert.Equal(t, want == core.RootlessModeEnabled, backend.isRootlessMode())
+	})
+}
 
-	isRoot := currentUser.Uid == "0"
-	var expectedRootless core.RootlessMode
-	if isRoot {
-		expectedRootless = core.RootlessModeDisabled
-	} else {
-		expectedRootless = core.RootlessModeEnabled
-	}
+func TestGetSocketPath(t *testing.T) {
+	t.Run("explicit path wins", func(t *testing.T) {
+		backend := &ContainerdBackend{config: core.ContainerdConfig{
+			SocketPath:   "/tmp/explicit.sock",
+			RootlessMode: core.RootlessModeEnabled,
+		}}
 
-	if backend.config.RootlessMode != expectedRootless {
-		t.Errorf("Expected rootless mode %v, got %v", expectedRootless, backend.config.RootlessMode)
-	}
+		path, err := backend.getSocketPath()
+		require.NoError(t, err)
+		assert.Equal(t, "/tmp/explicit.sock", path)
+	})
 
-	t.Logf("Auto-detected rootless mode: %v (current user: %s, uid: %s)",
-		backend.config.RootlessMode, currentUser.Username, currentUser.Uid)
-}
+	t.Run("rootful uses the system socket", func(t *testing.T) {
+		backend := &ContainerdBackend{config: core.ContainerdConfig{RootlessMode: core.RootlessModeDisabled}}
 
-func TestContainerdBackend_detectRootlessMode_Explicit(t *testing.T) {
-	config := core.ContainerdConfig{
-		RootlessMode: core.RootlessModeEnabled,
-	}
+		path, err := backend.getSocketPath()
+		require.NoError(t, err)
+		assert.Equal(t, "/run/containerd/containerd.sock", path)
+	})
 
-	backend := &ContainerdBackend{
-		config: config,
-	}
+	t.Run("rootless uses a per-user 
```

---

### Incident Patch 6: `6e9af37e` (2026-08-06)
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

### Incident Patch 7: `f5c9c9c3` (2026-08-05)
**Commit Message**: fix(auth): bind project and repository routes to the caller's repo access (#514)

Every route in this service was gated on one question: does the caller hold
a valid provider token this cloud admits. Nothing then asked whether that
caller had anything to do with the id in the path, so any admitted identity
that learned a project id could read it, delete it, or import over it, and
any identity that could merely *read* a repository could unregister it.

getGitHubUserProjects already had the answer: it scopes the listing to
repositories the caller actually has. The by-id routes now apply the same
rule, so a project is reachable by id by exactly the people who already see
it in their own list.

Access means write access. GetByID already fetches the repository under the
caller's own token and GitHub returns that caller's permissions with it, so
the check costs no extra API call. Read is not enough: a public repository
reads to everyone, which is what left these routes open.

Import is the one that could take a project over rather than just read or
break it. It supplies the project id, and registration overwrites the four
project keys and both repository back-references, so it could repo

**File**: `services/auth/api_domain_repository_test.go` (modified, +3/-2)
```diff
@@ -362,8 +362,9 @@ func TestActualHTTPHandlers(t *testing.T) {
 		// Create mock HTTP context
 		mockCtx := &mockHTTPContextWithClient{
 			variables: map[string]interface{}{
-				"provider": "github",
-				"id":       "33333",
+				"provider":     "github",
+				"id":           "33333",
+				"GithubClient": mockGitHubClient,
 			},
 		}
 
```

**File**: `services/auth/github.go` (modified, +79/-6)
```diff
@@ -8,6 +8,7 @@ import (
 	"crypto/rand"
 	"crypto/x509"
 	"encoding/pem"
+	"errors"
 	"fmt"
 	"strconv"
 
@@ -111,12 +112,49 @@ func generateKey() (string, string, string, error) {
 	return deployKeyName, string(ssh.MarshalAuthorizedKey(pub)), private.String(), nil
 }
 
+// repoAccess reports whether the caller may act on a repository. GetByID already
+// fetches it under the caller's own token and GitHub returns that caller's
+// permissions with it, so this costs no extra API call. Read access is not
+// enough: a public repository reads to everyone, which is what let an unrelated
+// caller reach another project's repositories.
+func repoAccess(client GitHubClient, repoID string) bool {
+	if client.GetByID(repoID) != nil {
+		return false
+	}
+
+	repo := client.Cur()
+	if repo == nil {
+		return false
+	}
+
+	perms := repo.GetPermissions()
+	return perms["admin"] || perms["maintain"] || perms["push"]
+}
+
+// authorizeProject refuses a caller who can write to neither of the project's
+// linked repositories. That is the same scoping getGitHubUserProjects applies
+// when it lists projects, so a project is reachable by id to exactly the people
+// who already see it in their own list.
+func (srv *AuthService) authorizeProject(client GitHubClient, project projects.Project) error {
+	if srv.devMode {
+		return nil
+	}
+
+	if repoAccess(client, project.Config()) || repoAccess(client, project.Code()) {
+		return nil
+	}
+
+	// Worded like a missing project on purpose. Telling the caller a project
+	// exists but isn't theirs turns the route back into the id oracle this
+	// check exists to close.
+	return errors.New("project not found")
+}
+
 func (srv *AuthService) registerGitHubRepository(ctx context.Context, client GitHubClient, repoID string) (*RepositoryRegistrationResponse, error) {
 	// If client is nil (P2P calls), skip GitHub API verification
 	if client != nil {
-		err := client.GetByID(repoID)
-		if err != nil {
-			return nil, fmt.Errorf("fetch repository failed with %w", err)
+		if !repoAccess(client, repoID) {
+			return nil, fmt.Errorf("no access to repository `%s`", repoID)
 		}
 
 		if err := srv.authorizeRepository(client); err != nil {
@@ -236,9 +274,16 @@ func (srv *AuthService) registerGitHubRepository(ctx context.Context, client Git
 func (srv *AuthService) unregisterGitHubRepository(ctx context.Context, client GitHubClient, repoID string) error {
 	// If client is nil (P2P calls), skip GitHub API verification
 	if client != nil {
-		err := client.GetByID(repoID)
-		if err != nil {
-			return fmt.Errorf("fetch repository failed with %w", err)
+		// Registering already required write access and tenancy ownership;
+		// unregistering tears down the deploy key and hooks, so it requires
+		// the same. Read access alone would let anyone drop a public
+		// repository's build wiring.
+		if !repoAccess(client, repoID) {
+			return fmt.Errorf("no access to repository `%s`", repoID)
+		}
+
+		if err := srv.authorizeRepository(client); err != nil {
+			return err
 		}
 	}
 
@@ -283,6 +328,26 @@ func (srv *AuthService) newGitHubProject(ctx context.Context, client GitHubClien
 
 	logger.Debug("Project ID=" + projectID)
 
+	if !srv.devMode {
+		// The caller is claiming these two repositories for a project, so they
+		// have to be able to write to both. Without this, any id could be
+		// pointed at repositories the caller has nothing to do with.
+		for _, repoID := range []string{configID, codeID} {
+			if !repoAccess(client, repoID) {
+				return nil, fmt.Errorf("no access to repository `%s`", repoID)
+			}
+		}
+
+		// Import supplies the project id, so this call can land on a project
+		// that already exists and would otherwise overwrite it — including its
+		// repository links — and add the caller as an owner.
+		if existing, err := projects.Fetch(ctx, srv.KV(), projectID); err == nil {
+			if err := srv.authorizeProject(client, existing); err != nil {
+				return nil, err
+			}
+		}
+	}
+
 	gituser := client.Me()
 
 	project, err := projects.New(srv.KV(), projects.Data{
@@ -386,6 +451,10 @@ func (srv *AuthService) getGitHubProjectInfo(ctx context.Context, client GitHubC
 		return nil, fmt.Errorf("retrieving project error: %w", err)
 	}
 
+	if err := srv.authorizeProject(client, project); err != nil {
+		return nil, err
+	}
+
 	return &ProjectInfoResponse{
 		Project: ProjectDetails{
 			ID:   projectid,
@@ -405,6 +474,10 @@ func (srv *AuthService) deleteGitHubUserProject(ctx context.Context, client GitH
 		return nil, fmt.Errorf("failed to fetch project: %w", err)
 	}
 
+	if err := srv.authorizeProject(client, project); err != nil {
+		return nil, err
+	}
+
 	err = project.Delete()
 	if err != nil {
 		return nil, fmt.Errorf("failed to delete project: %w", err)
```

**File**: `services/auth/github_http_endpoints.go` (modified, +8/-0)
```diff
@@ -111,6 +111,10 @@ func (srv *AuthService) registerGitHubUserRepositoryHTTPHandler(ctx http.Context
 
 func (srv *AuthService) getGitHubUserRepositoryHTTPHandler(ctx http.Context) (interface{}, error) {
 	ctxVars := ctx.Variables()
+	client, err := getGithubClientFromContext(ctx)
+	if err != nil {
+		return nil, err
+	}
 	provider, err := maps.String(ctxVars, "provider")
 	if err != nil {
 		return nil, err
@@ -121,6 +125,10 @@ func (srv *AuthService) getGitHubUserRepositoryHTTPHandler(ctx http.Context) (in
 		return nil, fmt.Errorf("parsing github repository ID failed with %w", err)
 	}
 
+	if !srv.devMode && !repoAccess(client, repoId) {
+		return nil, fmt.Errorf("repository %s not found", repoId)
+	}
+
 	requestCtx := ctx.Request().Context()
 	if !repositories.ExistOn(requestCtx, srv.db, provider, repoId) {
 		return nil, fmt.Errorf("repository %s not found", repoId)
```

**File**: `services/auth/github_project_authz_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package auth
+
+import (
+	"context"
+	"testing"
+
+	"github.com/google/go-github/v71/github"
+	"gotest.tools/v3/assert"
+)
+
+// authzClient is a GitHubClient for one identity, holding the repositories that
+// identity can write to. Repositories outside `writable` still resolve — that is
+// what a public repository does — but carry no write permission.
+type authzClient struct {
+	GitHubClient
+	id       int64
+	login    string
+	writable map[string]bool
+	cur      *github.Repository
+}
+
+func (c *authzClient) Me() *github.User {
+	return &github.User{ID: &c.id, Login: &c.login}
+}
+
+func (c *authzClient) GetByID(id string) error {
+	c.cur = &github.Repository{
+		ID:          &c.id,
+		FullName:    github.Ptr("someone/" + id),
+		Permissions: map[string]bool{"pull": true, "push": c.writable[id], "admin": c.writable[id]},
+	}
+	return nil
+}
+
+func (c *authzClient) Cur() *github.Repository { return c.cur }
+
+func (c *authzClient) ShortRepositoryInfo(id string) RepositoryShortInfo {
+	return RepositoryShortInfo{ID: id}
+}
+
+func newAuthzService(t *testing.T, port int) *AuthService {
+	t.Helper()
+	svc, err := New(context.Background(), newTestConfig(t, port))
+	assert.NilError(t, err)
+	t.Cleanup(func() { svc.Close() })
+	// The authorization checks are skipped in dev mode, as every other check in
+	// this service is; these tests are about the production path.
+	svc.devMode = false
+	return svc
+}
+
+// TestProjectAccessByID covers taubyte/tau#513: GET and DELETE by project id
+// must refuse a caller who cannot write to either linked repository.
+func TestProjectAccessByID(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13513)
+
+	victim := &authzClient{id: 1, login: "victim", writable: map[string]bool{"1001": true, "1002": true}}
+	attacker := &authzClient{id: 2, login: "attacker", writable: map[string]bool{"9001": true}}
+
+	_, err := svc.newGitHubProject(ctx, victim, "PROJECT_ID_513", "victims-project", "1001", "1002")
+	assert.NilError(t, err)
+
+	_, err = svc.getGitHubProjectInfo(ctx, attacker, "PROJECT_ID_513")
+	assert.Error(t, err, "project not found")
+
+	_, err = svc.deleteGitHubUserProject(ctx, attacker, "PROJECT_ID_513")
+	assert.Error(t, err, "project not found")
+
+	// The owner still gets through, and the project survived the attempts.
+	info, err := svc.getGitHubProjectInfo(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+	assert.Equal(t, info.Project.Name, "victims-project")
+
+	_, err = svc.deleteGitHubUserProject(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+}
+
+// TestProjectImportOverExisting covers the takeover path: import supplies the
+// project id, so it must not overwrite a project the caller has no access to.
+func TestProjectImportOverExisting(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13514)
+
+	victim := &authzClient{id: 1, login: "victim", writable: map[string]bool{"1001": true, "1002": true}}
+	attacker := &authzClient{id: 2, login: "attacker", writable: map[string]bool{"9001": true, "9002": true}}
+
+	_, err := svc.newGitHubProject(ctx, victim, "PROJECT_ID_513", "victims-project", "1001", "1002")
+	assert.NilError(t, err)
+
+	// Attacker's own repositories, victim's project id.
+	_, err = svc.newGitHubProject(ctx, attacker, "PROJECT_ID_513", "attackers-project", "9001", "9002")
+	assert.Error(t, err, "project not found")
+
+	info, err := svc.getGitHubProjectInfo(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+	assert.Equal(t, info.Project.Name, "victims-project")
+	assert.Equal(t, info.Project.Repositories.Configuration.ID, "1001")
+
+	_, err = svc.db.Get(ctx, "/projects/PROJECT_ID_513/owners/2")
+	assert.Assert(t, err != nil, "attacker recorded itself as an owner")
+
+	// The victim's repository still points at the victim's project.
+	linked, err := svc.db.Get(ctx, "/repositories/github/1001/project")
+	assert.NilError(t, err)
+	assert.Equal(t, string(linked), "PROJECT_ID_513")
+}
+
+// TestNewProjectRequiresRepoAccess: a project may only be created against
+// repositories the caller can write to.
+func TestNewProjectRequiresRepoAccess(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13515)
+
+	attacker := &authzClient{id: 2, login: "attacker", writable: map[string]bool{"9001": true}}
+
+	// 1002 is readable (public) but not writable by the caller.
+	_, err := svc.newGitHubProject(ctx, attacker, "PROJECT_ID_NEW", "grab", "9001", "1002")
+	assert.Error(t, err, "no access to repository `1002`")
+
+	_, err = svc.db.Get(ctx, "/repositories/github/1002/project")
+	assert.Assert(t, err != nil, "back-reference written despite refusal")
+}
+
+// TestUnregisterRepositoryRequiresAccess: read access to a public repository is
+// not enough to tear down its deploy key and hooks.
+func TestUnregisterRepositoryRequiresAccess(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13516)
+
+	attacker := &authzClient{id: 2, login: 
```

**File**: `services/auth/mock_types_test.go` (modified, +5/-4)
```diff
@@ -225,7 +225,7 @@ type mockGitHubClient struct {
 }
 
 func (m *mockGitHubClient) Cur() *github.Repository {
-	return nil
+	return m.currentRepo
 }
 
 func (m *mockGitHubClient) Me() *github.User {
@@ -242,9 +242,10 @@ func (m *mockGitHubClient) Me() *github.User {
 func (m *mockGitHubClient) GetByID(id string) error {
 	// Create a mock repository when GetByID is called
 	m.currentRepo = &github.Repository{
-		ID:       github.Int64(12345),
-		SSHURL:   github.Ptr("git@github.com:test/test-repo.git"),
-		FullName: github.Ptr("test/test-repo"),
+		ID:          github.Int64(12345),
+		SSHURL:      github.Ptr("git@github.com:test/test-repo.git"),
+		FullName:    github.Ptr("test/test-repo"),
+		Permissions: map[string]bool{"admin": true, "push": true, "pull": true},
 	}
 	return nil
 }
```

---

### Incident Patch 8: `4aefdf42` (2026-08-02)
**Commit Message**: feat(tcc): a session API its consumers don't have to reimplement, and required fields (#510)

* feat(tcc): own the session concerns its consumers each reimplement

The web console carries a 279-line wrapper reimplementing tcc concerns in
TypeScript, and tau-cli independently carries the same wrapper in Go. Two
unrelated consumers writing the same code is the proof it belongs in Session.

Canonical addressing. A container instance is addressed by its DSL-group form
(["applications","x"]); a new Layout binding maps it to the document inside its
directory. Before, that address wrote applications/x.yaml — a SIBLING of the real
applications/x/config.yaml — so editing an existing application split it into two
files, while validation and completion wanted the very same address. The
config-suffixed form stays accepted as a legacy alias. Malformed addresses now
error instead of silently creating a stray document.

New session surface, each replacing a consumer-side copy:

  ValidateResource -> []FieldIssue   issues attributed to their field, one call
                                     per resource instead of one per leaf
  Serialize        one resource's repo-relative path + exact YAML, s

**File**: `pkg/tcc/clients/js/README.md` (modified, +105/-0)
```diff
@@ -95,6 +95,111 @@ config key (`memory` → `execution.memory`, `type` → `trigger.type`), `InSet`
 typed as unions, and legacy keys read as a fallback. `makeSyncFs` / `hydrate` /
 `flush` are also exported for lower-level filesystem control.
 
+Applications and the project root are documents too, addressed the same way:
+
+```ts
+const app = session.application("web");       // the container's own config
+await app.setDescription("the web app");
+await session.project().setName("my_project"); // the project root document
+```
+
+### When the kind is a string
+
+The accessors above are statically named. A UI that renders whatever kind its
+route names holds the kind as a *string*, so it goes through the generic entry
+points instead — and never rebuilds an address, pluralizes a kind, or
+special-cases the container:
+
+```ts
+await session.kinds();
+// [{ name: "function", group: "functions", container: false },
+//  { name: "application", group: "applications", container: true }, …]
+
+const r = await session.resource(kind, name, app);  // same surface, untyped
+await r.doc(); await r.setDoc(next); await r.serialize(); await r.validate();
+
+await session.address(kind, name, app);  // ["applications", app, "functions", name]
+await session.names(kind, app);          // instances in scope
+await session.exists(r.res);             // is it in the config, or being created?
+```
+
+`kind` accepts a kind's group key (`"functions"`) or its declared singular
+(`"function"`); an unknown one throws rather than address nothing.
+
+**`container` is not cosmetic.** An application is a container, and the DSL
+deliberately does *not* declare it a resource: it has no compiled resource type
+and never appears in the compiled object as one. What's uniform is everything
+about *editing* it — address, document, file, local validation. What isn't is
+whether it belongs in a list of resources:
+
+```ts
+const resourceKinds = (await session.kinds()).filter((k) => !k.container);
+```
+
+So `if (kind === "application")` should become `if (k.container)`, not disappear.
+Branching on the capability is right; branching on the name is what this removes.
+
+Groups the DSL never names are not kinds at all — `clouds` is a leaf map of
+settings inside the root document, so it isn't reported and you don't filter it.
+
+### Whole-document editing
+
+An editor holds a plain object, not a field at a time. Hand tcc the object and it
+works out the minimal set/delete ops — so comments on untouched lines survive —
+then hand back the one file that changed:
+
+```ts
+const fn = session.function("api");
+
+const doc = await fn.doc();                   // the resource's whole document
+await fn.setDoc({ ...doc, description: "edited" }); // minimal diff; missing keys delete
+
+const { path, yaml } = await fn.serialize();  // "functions/api.yaml" + its exact YAML
+await session.resourceAt(path);               // ["functions", "api"] — the inverse
+```
+
+Never build these paths yourself: where a resource's document lives is the DSL's
+to decide (an application is `applications/web/config.yaml`, a function is
+`functions/api.yaml`), and asserting a layout is how you end up reading a path
+tcc never wrote.
+
+Values the DSL declares as generated — a resource `id`, which is a CID — are
+minted by tcc, not by the caller:
+
+```ts
+await fn.generate(["id"]);   // a fresh CID, seeded with the project and resource
+```
+
+### Validation
+
+`validate()` on a resource is compile-free and per-field: one call returns every
+local failure attributed to the field that caused it.
+
+```ts
+for (const { field, message } of await fn.validate()) {
+  markField(field, message);                  // field: ["trigger", "domains"]
+}
+```
+
+Whole-project checks still need `session.validate()`, which throws a `TccError`
+carrying `file` / `line` / `column` — so "is this error in the file I'm editing?"
+is a field comparison, not a substring match on the message.
+
+```ts
+try {
+  await session.validate({ branch: "main" });
+} catch (e) {
+  if (e instanceof TccError && e.file !== myPath) { /* someone else's problem */ }
+}
+```
+
+`session.resourceRepo(res)` returns the git repository backing a resource
+(`{ provider, fullname, branch? }`) or `null`. The provider key is dynamic, so it
+is read by shape — no provider is named.
+
+`hydrate` skips dot-entries, so staging a git checkout never copies `.git` into
+wasm, and a pruning `save` leaves them alone.
+
 ### Outside Node
 
 In the browser, fetch the assets and pass them explicitly (Node auto-loads them
```

**File**: `pkg/tcc/clients/js/bun.lock` (added, +888/-0)
```diff
@@ -0,0 +1,888 @@
+{
+  "lockfileVersion": 1,
+  "configVersion": 0,
+  "workspaces": {
+    "": {
+      "name": "@taubyte/tcc",
+      "dependencies": {
+        "@taubyte/tcc": "link:@taubyte/tcc",
+      },
+      "devDependencies": {
+        "@esm-bundle/chai": "^4.3.4",
+        "@types/node": "^22.5.2",
+        "@web/dev-server-esbuild": "^1.0.2",
+        "@web/test-runner": "^0.19.0",
+        "@web/test-runner-chrome": "^0.18.0",
+        "tsx": "^4.19.1",
+        "typescript": "^5.6.0",
+      },
+    },
+  },
+  "packages": {
+    "@babel/code-frame": ["@babel/code-frame@7.29.7", "", { "dependencies": { "@babel/helper-validator-identifier": "^7.29.7", "js-tokens": "^4.0.0", "picocolors": "^1.1.1" } }, "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw=="],
+
+    "@babel/helper-validator-identifier": ["@babel/helper-validator-identifier@7.29.7", "", {}, "sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg=="],
+
+    "@esbuild/aix-ppc64": ["@esbuild/aix-ppc64@0.27.7", "", { "os": "aix", "cpu": "ppc64" }, "sha512-EKX3Qwmhz1eMdEJokhALr0YiD0lhQNwDqkPYyPhiSwKrh7/4KRjQc04sZ8db+5DVVnZ1LmbNDI1uAMPEUBnQPg=="],
+
+    "@esbuild/android-arm": ["@esbuild/android-arm@0.27.7", "", { "os": "android", "cpu": "arm" }, "sha512-jbPXvB4Yj2yBV7HUfE2KHe4GJX51QplCN1pGbYjvsyCZbQmies29EoJbkEc+vYuU5o45AfQn37vZlyXy4YJ8RQ=="],
+
+    "@esbuild/android-arm64": ["@esbuild/android-arm64@0.27.7", "", { "os": "android", "cpu": "arm64" }, "sha512-62dPZHpIXzvChfvfLJow3q5dDtiNMkwiRzPylSCfriLvZeq0a1bWChrGx/BbUbPwOrsWKMn8idSllklzBy+dgQ=="],
+
+    "@esbuild/android-x64": ["@esbuild/android-x64@0.27.7", "", { "os": "android", "cpu": "x64" }, "sha512-x5VpMODneVDb70PYV2VQOmIUUiBtY3D3mPBG8NxVk5CogneYhkR7MmM3yR/uMdITLrC1ml/NV1rj4bMJuy9MCg=="],
+
+    "@esbuild/darwin-arm64": ["@esbuild/darwin-arm64@0.27.7", "", { "os": "darwin", "cpu": "arm64" }, "sha512-5lckdqeuBPlKUwvoCXIgI2D9/ABmPq3Rdp7IfL70393YgaASt7tbju3Ac+ePVi3KDH6N2RqePfHnXkaDtY9fkw=="],
+
+    "@esbuild/darwin-x64": ["@esbuild/darwin-x64@0.27.7", "", { "os": "darwin", "cpu": "x64" }, "sha512-rYnXrKcXuT7Z+WL5K980jVFdvVKhCHhUwid+dDYQpH+qu+TefcomiMAJpIiC2EM3Rjtq0sO3StMV/+3w3MyyqQ=="],
+
+    "@esbuild/freebsd-arm64": ["@esbuild/freebsd-arm64@0.27.7", "", { "os": "freebsd", "cpu": "arm64" }, "sha512-B48PqeCsEgOtzME2GbNM2roU29AMTuOIN91dsMO30t+Ydis3z/3Ngoj5hhnsOSSwNzS+6JppqWsuhTp6E82l2w=="],
+
+    "@esbuild/freebsd-x64": ["@esbuild/freebsd-x64@0.27.7", "", { "os": "freebsd", "cpu": "x64" }, "sha512-jOBDK5XEjA4m5IJK3bpAQF9/Lelu/Z9ZcdhTRLf4cajlB+8VEhFFRjWgfy3M1O4rO2GQ/b2dLwCUGpiF/eATNQ=="],
+
+    "@esbuild/linux-arm": ["@esbuild/linux-arm@0.27.7", "", { "os": "linux", "cpu": "arm" }, "sha512-RkT/YXYBTSULo3+af8Ib0ykH8u2MBh57o7q/DAs3lTJlyVQkgQvlrPTnjIzzRPQyavxtPtfg0EopvDyIt0j1rA=="],
+
+    "@esbuild/linux-arm64": ["@esbuild/linux-arm64@0.27.7", "", { "os": "linux", "cpu": "arm64" }, "sha512-RZPHBoxXuNnPQO9rvjh5jdkRmVizktkT7TCDkDmQ0W2SwHInKCAV95GRuvdSvA7w4VMwfCjUiPwDi0ZO6Nfe9A=="],
+
+    "@esbuild/linux-ia32": ["@esbuild/linux-ia32@0.27.7", "", { "os": "linux", "cpu": "ia32" }, "sha512-GA48aKNkyQDbd3KtkplYWT102C5sn/EZTY4XROkxONgruHPU72l+gW+FfF8tf2cFjeHaRbWpOYa/uRBz/Xq1Pg=="],
+
+    "@esbuild/linux-loong64": ["@esbuild/linux-loong64@0.27.7", "", { "os": "linux", "cpu": "none" }, "sha512-a4POruNM2oWsD4WKvBSEKGIiWQF8fZOAsycHOt6JBpZ+JN2n2JH9WAv56SOyu9X5IqAjqSIPTaJkqN8F7XOQ5Q=="],
+
+    "@esbuild/linux-mips64el": ["@esbuild/linux-mips64el@0.27.7", "", { "os": "linux", "cpu": "none" }, "sha512-KabT5I6StirGfIz0FMgl1I+R1H73Gp0ofL9A3nG3i/cYFJzKHhouBV5VWK1CSgKvVaG4q1RNpCTR2LuTVB3fIw=="],
+
+    "@esbuild/linux-ppc64": ["@esbuild/linux-ppc64@0.27.7", "", { "os": "linux", "cpu": "ppc64" }, "sha512-gRsL4x6wsGHGRqhtI+ifpN/vpOFTQtnbsupUF5R5YTAg+y/lKelYR1hXbnBdzDjGbMYjVJLJTd2OFmMewAgwlQ=="],
+
+    "@esbuild/linux-riscv64": ["@esbuild/linux-riscv64@0.27.7", "", { "os": "linux", "cpu": "none" }, "sha512-hL25LbxO1QOngGzu2U5xeXtxXcW+/GvMN3ejANqXkxZ/opySAZMrc+9LY/WyjAan41unrR3YrmtTsUpwT66InQ=="],
+
+    "@esbuild/linux-s390x": ["@esbuild/linux-s390x@0.27.7", "", { "os": "linux", "cpu": "s390x" }, "sha512-2k8go8Ycu1Kb46vEelhu1vqEP+UeRVj2zY1pSuPdgvbd5ykAw82Lrro28vXUrRmzEsUV0NzCf54yARIK8r0fdw=="],
+
+    "@esbuild/linux-x64": ["@esbuild/linux-x64@0.27.7", "", { "os": "linux", "cpu": "x64" }, "sha512-hzznmADPt+OmsYzw1EE33ccA+HPdIqiCRq7cQeL1Jlq2gb1+OyWBkMCrYGBJ+sxVzve2ZJEVeePbLM2iEIZSxA=="],
+
+    "@esbuild/netbsd-arm64": ["@esbuild/netbsd-arm64@0.27.7", "", { "os": "none", "cpu": "arm64" }, "sha512-b6pqtrQdigZBwZxAn1UpazEisvwaIDvdbMbmrly7cDTMFnw/+3lVxxCTGOrkPVnsYIosJJXAsILG9XcQS+Yu6w=="],
+
+    "@esbuild/netbsd-x64": ["@esbuild/netbsd-x64@0.27.7", "", { "os": "none", "cpu": "x64" }, "sha512-OfatkLojr6U+WN5EDYuoQhtM+1xco+/6FSzJJnuWiUw5eVcicbyK3dq5EeV/QHT1uy6GoDhGbFpprUiHUYggrw=="],
+
+    "@esbuild/openbsd-arm64": ["@esbuild/openbsd-arm64@0.27.7", "", { "os": "openbsd", "cpu": "arm64" }, "sha512-AFuojMQTxAz75Fo8idVcqoQ
```

**File**: `pkg/tcc/clients/js/src/fs.ts` (modified, +10/-1)
```diff
@@ -97,11 +97,16 @@ export interface AsyncFs {
 const joinPath = (a: string, b: string) =>
   (a.endsWith("/") ? a + b : a + "/" + b).replace(/\/{2,}/g, "/");
 
-/** Read every file under `dir` in an async fs into a compiler-rooted ("/") Map. */
+/** Read every file under `dir` in an async fs into a compiler-rooted ("/") Map.
+ *
+ *  Dot-entries are skipped: a DSL group name never starts with a dot, and every
+ *  consumer staging a git checkout would otherwise pay to copy `.git`'s whole
+ *  object store into wasm. */
 export async function hydrate(fs: AsyncFs, dir: string): Promise<Map<string, Uint8Array>> {
   const map = new Map<string, Uint8Array>();
   const walk = async (abs: string, rooted: string) => {
     for (const name of await fs.promises.readdir(abs)) {
+      if (name.startsWith(".")) continue;
       const childAbs = joinPath(abs, name);
       const childRooted = joinPath(rooted, name);
       const st = await fs.promises.stat(childAbs);
@@ -121,6 +126,9 @@ export async function hydrate(fs: AsyncFs, dir: string): Promise<Map<string, Uin
  * Write a compiler-rooted Map back under `dir` in an async fs, creating dirs.
  * With `prune`, files under `dir` not in the map are removed (so a saved session
  * reflects deletions), if the fs supports `unlink`.
+ *
+ * Prune skips dot-entries. It MUST: hydrate never staged them, so a pruning
+ * save would see all of `.git` as "not in the map" and delete the repository.
  */
 export async function flush(
   fs: AsyncFs,
@@ -155,6 +163,7 @@ export async function flush(
         return;
       }
       for (const name of names) {
+        if (name.startsWith(".")) continue;
         const childAbs = joinPath(abs, name);
         const childRooted = joinPath(rooted, name);
         if ((await fs.promises.stat(childAbs)).isDirectory()) {
```

**File**: `pkg/tcc/clients/js/src/gen/schema.ts` (modified, +276/-143)
```diff
@@ -2,14 +2,32 @@
 // Typed accessors over a wasm-resident editable config session. Getters/setters
 // read/write fields by path across the wasm boundary; YAML lives in wasm.
 
-import type { SessionBinding, CompileOptions, CompileResult, Validation } from "../loader.js";
+import type {
+  SessionBinding,
+  CompileOptions,
+  CompileResult,
+  Validation,
+  Kind,
+  FieldIssue,
+  SerializedResource,
+} from "../loader.js";
 import type { AsyncFs } from "../fs.js";
 
 export type DatabaseNetwork = "all" | "subnet" | "host";
 export type DomainCertType = "inline" | "auto";
 export type FunctionType = "http" | "https" | "pubsub" | "p2p";
 export type FunctionMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH";
+export type LibraryProvider = "github";
+export type StorageType = "object" | "streaming";
 export type StorageNetwork = "all" | "subnet" | "host";
+export type WebsiteProvider = "github";
+
+/** The git repository backing a resource. */
+export interface RepoRef {
+  provider: string;
+  fullname: string;
+  branch?: string;
+}
 
 /** An editable, wasm-resident project config session. */
 export class Session {
@@ -70,9 +88,58 @@ export class Session {
     return this.binding.list(this.handle, app ? ["applications", app, "websites"] : ["websites"]);
   }
 
+  application(name: string): ApplicationConfig {
+    return new ApplicationConfig(this, name);
+  }
+  project(): ProjectConfig {
+    return new ProjectConfig(this);
+  }
   applications(): Promise<string[]> {
     return this.binding.list(this.handle, ["applications"]);
   }
+  resourceAt(path: string): Promise<string[] | null> {
+    return this.binding.resourceAt(this.handle, path);
+  }
+  /** Every resource kind this DSL defines, with its group key and whether
+   *  its instances contain resources of their own. */
+  kinds(): Promise<Kind[]> {
+    return this.binding.kinds(this.handle);
+  }
+  /** The canonical address of one resource, by kind. Accepts a kind's group key
+   *  or its declared singular; unknown kinds throw rather than address nothing. */
+  address(kind: string, name: string, app?: string): Promise<string[]> {
+    return this.binding.address(this.handle, kind, name, app);
+  }
+  /** The instances of a kind in scope — the project, or one application's own. */
+  names(kind: string, app?: string): Promise<string[]> {
+    return this.binding.names(this.handle, kind, app);
+  }
+  /** Is this resource already in the config, or is it being created? */
+  exists(res: string[]): Promise<boolean> {
+    return this.binding.exists(this.handle, res);
+  }
+  /** An accessor for a resource named only by kind — the untyped sibling of the
+   *  generated per-kind factories, with the identical document surface. */
+  async resource(kind: string, name: string, app?: string): Promise<ResourceConfig> {
+    return new ResourceConfig(this, await this.address(kind, name, app));
+  }
+  /** The git repository backing a resource, or null if it isn't repo-backed.
+   * The provider key is dynamic, so this takes whichever sub-object of "source"
+   * carries the repo name — no provider is named here or in the DSL walk. */
+  async resourceRepo(res: string[]): Promise<RepoRef | null> {
+    const src = await this.binding.get(this.handle, res, ["source"]).catch(() => null);
+    if (!src || typeof src !== "object" || Array.isArray(src)) return null;
+    const block = src as Record<string, unknown>;
+    const branch = typeof block["branch"] === "string" ? (block["branch"] as string) : undefined;
+    for (const [provider, v] of Object.entries(block)) {
+      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
+      const fullname = (v as Record<string, unknown>)["fullname"];
+      if (typeof fullname === "string" && fullname) {
+        return { provider, fullname, ...(branch ? { branch } : {}) };
+      }
+    }
+    return null;
+  }
   compile(opts?: CompileOptions): Promise<CompileResult> {
     return this.binding.compile(this.handle, opts);
   }
@@ -93,25 +160,64 @@ export class Session {
   }
 }
 
-/** Typed accessors for a database's config. */
-export class DatabaseConfig {
-  private res: string[];
-  constructor(private s: Session, name: string, app?: string) {
-    this.res = app ? ["applications", app, "databases", name] : ["databases", name];
-  }
+/** The surface every resource has, whatever its kind. */
+export class ResourceConfig {
+  constructor(
+    protected s: Session,
+    readonly res: string[],
+  ) {}
 
   delete(): Promise<void> {
     return this.s.binding.delete(this.s.handle, this.res);
   }
-  validate(): Promise<string[]> {
+  /** Is this resource already in the config, or is it being created? */
+  exists(): Promise<boolean> {
+    return this.s.binding.exists(this.s.handle, this.res);
+  }
+  /** The whole document, as an editor holds it. */
+  async doc(): Promise<Record<string, unknown>> {
+    const v = await this.s.binding.get(this.s.handle, 
```

**File**: `pkg/tcc/clients/js/src/index.ts` (modified, +14/-0)
```diff
@@ -10,6 +10,7 @@ import {
   type CompileOptions,
   type CompileResult,
   type WasmAssets,
+  type Kind,
 } from "./loader.js";
 import { Session } from "./gen/schema.js";
 
@@ -45,6 +46,19 @@ export async function schema(assets?: WasmAssets): Promise<Record<string, unknow
   return res;
 }
 
+/**
+ * return the resource kinds this DSL defines — each kind's group key, the
+ * singular it is named by, and whether its instances contain resources of their
+ * own. Stateless, like {@link schema}: the vocabulary is a property of the
+ * schema, so asking what kinds exist needs no project and no session.
+ */
+export async function kinds(assets?: WasmAssets): Promise<Kind[]> {
+  const tcc = await loadWasm(assets);
+  const res = tcc.kinds();
+  if ("error" in res) throw new Error((res as { error: string }).error);
+  return res as Kind[];
+}
+
 /**
  * open an editable {@link Session} over a project's YAML under `dir` (parsed into
  * a wasm-resident representation). Edit typed fields via `session.function(name)`
```

**File**: `pkg/tcc/clients/js/src/loader.ts` (modified, +93/-4)
```diff
@@ -25,11 +25,52 @@ export interface CompileResult {
   validations: Validation[];
 }
 
+/** One failed check on a resource, attributed to the field that failed it.
+ *  `field` is the authored path (`["trigger","domains"]`); empty means the issue
+ *  is about the resource as a whole. */
+export interface FieldIssue {
+  field: string[];
+  message: string;
+}
+
+/** One resource kind the DSL defines. `group` is the canonical key (the config
+ *  directory); `name` is the declared singular, lowercased, accepted as an alias
+ *  wherever a kind is named. `container` marks a kind whose instances hold
+ *  resources of their own — read it rather than special-casing a kind by name. */
+export interface Kind {
+  name: string;
+  group: string;
+  container: boolean;
+}
+
+/** One resource's document as tcc serializes it: where it lives and its exact
+ *  YAML. The path is the DSL's to decide — never assert one. */
+export interface SerializedResource {
+  path: string;
+  yaml: string;
+}
+
+/** A repo-relative wasm error carrying the source position it was found at, so
+ *  a caller attributes it to a file without substring-matching the message. */
+export class TccError extends Error {
+  constructor(
+    message: string,
+    readonly file?: string,
+    readonly line?: number,
+    readonly column?: number,
+  ) {
+    super(message);
+    this.name = "TccError";
+  }
+}
+
 export interface TccGlobal {
   compile(fs: SyncFs, opts?: CompileOptions): CompileResult | { error: string };
   decompile(obj: unknown, fs: SyncFs): null | { error: string };
   /** The config JSON Schema (Draft 2020-12), generated from this wasm's own DSL. */
   schema(): Record<string, unknown> | { error: string };
+  /** The kinds this DSL defines. Stateless, like schema(). */
+  kinds(): Kind[] | { error: string };
   // Editable sessions (config lives in wasm; getters/setters address it by path).
   openSession(fs: SyncFs): number | { error: string };
   decompileSession(obj: unknown): number | { error: string };
@@ -38,7 +79,16 @@ export interface TccGlobal {
   sessionCompile(handle: number, opts?: CompileOptions): CompileResult | { error: string };
   sessionValidate(handle: number, opts?: CompileOptions): { validations: Validation[] } | { error: string };
   sessionValidateField(handle: number, resource: string[], field: string[], value: unknown): null | { error: string };
-  sessionValidateResource(handle: number, resource: string[]): { errors: string[] } | { error: string };
+  sessionValidateResource(handle: number, resource: string[]): { issues: FieldIssue[] } | { error: string };
+  sessionSerialize(handle: number, resource: string[]): SerializedResource | { error: string };
+  sessionLocation(handle: number, resource: string[]): string | { error: string };
+  sessionSetResource(handle: number, resource: string[], doc: Record<string, unknown>): null | { error: string };
+  sessionResourceAt(handle: number, path: string): string[] | null | { error: string };
+  sessionKinds(handle: number): Kind[] | { error: string };
+  sessionAddress(handle: number, kind: string, name: string, app?: string): string[] | { error: string };
+  sessionNames(handle: number, kind: string, app?: string): string[] | { error: string };
+  sessionExists(handle: number, resource: string[]): boolean | { error: string };
+  sessionGenerate(handle: number, resource: string[], field: string[]): string | { error: string };
   sessionComplete(handle: number, resource: string[], field: string[], partial?: string): string[] | { error: string };
   sessionSave(handle: number, fs: SyncFs): null | { error: string };
   // field omitted -> delete the whole resource; field given -> unset that one field.
@@ -62,7 +112,16 @@ export interface SessionBinding {
   compile(handle: number, opts?: CompileOptions): Promise<CompileResult>;
   validate(handle: number, opts?: CompileOptions): Promise<Validation[]>;
   validateField(handle: number, resource: string[], field: string[], value: unknown): Promise<void>;
-  validateResource(handle: number, resource: string[]): Promise<string[]>;
+  validateResource(handle: number, resource: string[]): Promise<FieldIssue[]>;
+  serialize(handle: number, resource: string[]): Promise<SerializedResource>;
+  location(handle: number, resource: string[]): Promise<string>;
+  setResource(handle: number, resource: string[], doc: Record<string, unknown>): Promise<void>;
+  resourceAt(handle: number, path: string): Promise<string[] | null>;
+  kinds(handle: number): Promise<Kind[]>;
+  address(handle: number, kind: string, name: string, app?: string): Promise<string[]>;
+  names(handle: number, kind: string, app?: string): Promise<string[]>;
+  exists(handle: number, resource: string[]): Promise<boolean>;
+  generate(handle: number, resource: string[], field: string[]): Promise<string>;
   complete(handle: number, resource: string[], field: string[], partial?: string): Promise<string[]>;
   save(handle: number, fs: AsyncFs, dir: string)
```

**File**: `pkg/tcc/clients/js/src/tcc.test.ts` (modified, +244/-1)
```diff
@@ -2,7 +2,7 @@ import { test } from "node:test";
 import assert from "node:assert/strict";
 import { readdirSync, statSync, readFileSync } from "node:fs";
 import { resolve, join } from "node:path";
-import { compile, open, decompile, type AsyncFs } from "./index.js";
+import { compile, open, decompile, kinds, type AsyncFs } from "./index.js";
 
 // The golden fixture the Go compile/decompile tests use. TCC_FIXTURE lets the
 // e2e harness point at it from a tmp package; otherwise resolve it in-tree.
@@ -125,6 +125,249 @@ test("session: list, application-scoped access, and delete", async () => {
   await reopened.close();
 });
 
+test("session: an application is one address, mapped to its own document", async () => {
+  const session = await open(fixtureFs(), "/");
+  const app = session.application("test_app1");
+
+  await app.setDescription("edited");
+  const { path, yaml } = await app.serialize();
+  assert.equal(path, "applications/test_app1/config.yaml", "the container's own document");
+  assert.ok(yaml.includes("edited"));
+
+  // the whole point: no sibling applications/test_app1.yaml is ever written
+  const out = memFs();
+  await session.save(out, "/");
+  assert.ok(!out.files.has("/applications/test_app1.yaml"), "no sibling document");
+  assert.ok(out.files.has("/applications/test_app1/config.yaml"));
+
+  assert.deepEqual(await app.validate(), [], "an application validates as a container");
+  await session.close();
+});
+
+test("session: whole-document diff, serialize, and path->address", async () => {
+  const session = await open(fixtureFs(), "/");
+  const fn = session.function(FN_NAME);
+
+  const doc = await fn.doc();
+  assert.equal(doc.id, FN_ID);
+
+  // replace the document: nested edit + a removed key, comments untouched
+  await fn.setDoc({ ...doc, description: "diffed", trigger: { type: "https" } });
+  assert.equal(await fn.description(), "diffed");
+  // NB: the wasm reports an absent field as null while the generated getters are
+  // typed `| undefined` — pre-existing, so accept either rather than pin it.
+  const method = await fn.method();
+  assert.ok(method === undefined || method === null, "a key absent from the doc is deleted");
+
+  const { path, yaml } = await fn.serialize();
+  assert.equal(path, `functions/${FN_NAME}.yaml`);
+  // The deletion must reach the FILE, not just the in-memory view. Asserting
+  // through get() is what let a "deleted" key survive in the YAML: reads saw it
+  // gone while save() wrote it straight back.
+  assert.ok(!yaml.includes("method:"), `removed key still in the serialized YAML:\n${yaml}`);
+  const saved = memFs();
+  await session.save(saved, "/");
+  const onDisk = new TextDecoder().decode(saved.files.get(`/functions/${FN_NAME}.yaml`)!);
+  assert.ok(!onDisk.includes("method:"), `removed key still in the saved file:\n${onDisk}`);
+  assert.ok(onDisk.includes("diffed"), "the edit itself must be saved");
+
+  // ...and a diff that ONLY removes must reach the file too. This is the case
+  // that isolates the bug: a deletion updated the in-memory tree but never
+  // marked the document dirty, so it was written only as a side effect of some
+  // OTHER edit to the same document. A removal on its own vanished silently.
+  const cur = await fn.doc();
+  delete (cur as Record<string, unknown>).description;
+  await fn.setDoc(cur);
+  const { yaml: afterRemoveOnly } = await fn.serialize();
+  assert.ok(
+    !afterRemoveOnly.includes("description:"),
+    `a removal with no other change must reach the file:\n${afterRemoveOnly}`,
+  );
+  assert.deepEqual(await session.resourceAt(path), ["functions", FN_NAME], "path -> address");
+  assert.equal(await session.resourceAt(".git/config.yaml"), null, "not a resource document");
+  assert.deepEqual(
+    await session.resourceAt("applications/test_app1/config.yaml"),
+    ["applications", "test_app1"],
+    "a container's document addresses the container",
+  );
+  await session.close();
+});
+
+test("session: generate mints a DSL-declared id, and validation is field-attributed", async () => {
+  const session = await open(fixtureFs(), "/");
+  const fn = session.function(FN_NAME);
+
+  const id = await fn.generate(["id"]);
+  assert.notEqual(id, FN_ID, "a fresh id, not the current one");
+  await fn.validateField(["id"], id); // throws if it isn't a valid CID
+
+  await fn.setType("nope" as never);
+  const issues = await fn.validate();
+  assert.equal(issues.length, 1);
+  assert.deepEqual(issues[0]!.field, ["trigger", "type"], "the issue names the field");
+  assert.ok(issues[0]!.message.includes("invalid value"));
+  await session.close();
+});
+
+test("session: resourceRepo reads the backing repo without naming a provider", async () => {
+  // A non-github provider block: if the extraction hardcoded "github" anywhere,
+  // this returns null instead of naming gitlab.
+  const files = new Map<string, Uint8Array>();
+  loadDir(FIXTURE, "", files);
+  files.set(
+    "/libraries/gitlab_lib.
```

**File**: `pkg/tcc/engine/annotate.go` (modified, +48/-0)
```diff
@@ -57,6 +57,16 @@ func GroupDoc(text string) NodeOption {
 	return GroupAnnotate("doc", text)
 }
 
+// Icon is a SEMANTIC icon hint for a resource group — "bolt", "database",
+// "globe" — surfaced on its schema object so a UI/CLI picks a glyph from the
+// DSL instead of keeping its own kind->icon table (three of them, in the web
+// console's case). Deliberately a neutral key, not an asset path or an icon-set
+// class: which library draws it stays the consumer's business, and a consumer
+// that doesn't know the key just falls back to its default. Presentation-only.
+func Icon(name string) NodeOption {
+	return GroupAnnotate("icon", name)
+}
+
 // ConditionSpec is a simple static visibility condition: show the field or section
 // only when a sibling attribute (Field) holds one of In. Presentation-only — a
 // UI/CLI evaluates it; it never affects parsing or the compiled output. (For
@@ -73,6 +83,32 @@ func ShowWhen(field string, in ...string) Option {
 	return Annotate("showWhen", ConditionSpec{Field: field, In: in})
 }
 
+// RequiredWhen makes a field required only when a sibling attribute holds one of
+// the given values — a function's pubsub channel matters when its trigger type
+// is pubsub and is meaningless otherwise, so requiring it unconditionally would
+// reject every http function. Unlike ShowWhen this is NOT presentation: it is
+// enforced at load exactly like Required(), and reported by partial validation.
+//
+// Deliberately separate from ShowWhen. A field can be shown and optional (a
+// timeout), so "required" cannot be inferred from "visible".
+func RequiredWhen(field string, in ...string) Option {
+	return Annotate("requiredWhen", ConditionSpec{Field: field, In: in})
+}
+
+// RequiredUnless makes a field required UNLESS a sibling boolean attribute is
+// true — a database's match is a literal key and must be there, unless useRegex
+// turns it into a regular expression, where empty is a valid catch-all.
+//
+// Deliberately not RequiredWhen with a negation. Two things differ, and the
+// second is the one that bites: an ABSENT discriminator here means required (an
+// unset bool is false), whereas RequiredWhen treats an absent discriminator as
+// "condition cannot hold, so not required". Encoding it as a value list would
+// also break silently, because the value is read as a bool on one side and
+// compared as a string on the other.
+func RequiredUnless(field string) Option {
+	return Annotate("requiredUnless", field)
+}
+
 // SectionSpec declares a human-facing section for a resource's fields — how a UI
 // or CLI groups them for display. It is presentation-only (no compile effect) and
 // does NOT have to align with the authored nesting: a field under one Path can sit
@@ -117,6 +153,18 @@ func InSection(id string) Option {
 	return Annotate("section", id)
 }
 
+// RepoName marks the attribute holding a repository's full name (owner/repo)
+// INSIDE its provider block — the value that says which repository backs the
+// resource. It is what lets a tool extract the backing repo generically: the
+// provider key is dynamic, so "the sub-object carrying the repo name" is the
+// only stable handle, and this says which leaf that is instead of every consumer
+// hardcoding "fullname". Introspection-only; no compile or runtime effect.
+func RepoName() Option { return Annotate("repoName", true) }
+
+// RepoBranch marks the attribute holding the git branch a repo-backed resource
+// builds from (a sibling of the provider block). Introspection-only.
+func RepoBranch() Option { return Annotate("repoBranch", true) }
+
 // Field overrides the Go struct field name a generator emits for this attribute,
 // for cases where the config-key-derived name differs from the struct field
 // (e.g. github-id -> RepoID). Generation-only; no runtime effect.
```

---

### Incident Patch 9: `6f04e148` (2026-07-28)
**Commit Message**: feat(node): the community build no longer ships the accounts service (#506)

* feat(node): the community build no longer ships the accounts service

Deregisters accounts from the node registry and drops it from the four
service vocabularies. `go list -deps ./cli/...` no longer reaches
services/accounts in the untagged build: the binary does not contain it,
rather than containing it unused.

Two places assumed those vocabularies were the whole world, which is what
made this more than a one-line change:

- Universe.createService indexed u.service[name] directly, and that map is
  seeded from commonSpecs.Services. A name outside the list was a nil map
  entry and the deref panicked. It now creates the slot on demand, the same
  way handlerRegistry.Set already did for the registry beneath it.
- CreateSimpleNode filtered requested clients against commonSpecs.Clients, so
  a client the caller explicitly asked for was silently dropped and surfaced
  much later as "client for protocol `x` does not exist". It now asks whether
  a creator is registered, which is the question it meant to ask.

Both are general: any service registered from an init() rather than listed in
the vocabulary hit the

**File**: `cli/node/node.go` (modified, +0/-2)
```diff
@@ -4,7 +4,6 @@ import (
 	"errors"
 	"fmt"
 
-	accountsService "github.com/taubyte/tau/services/accounts"
 	authService "github.com/taubyte/tau/services/auth"
 	"github.com/taubyte/tau/services/gateway"
 	hoarderService "github.com/taubyte/tau/services/hoarder"
@@ -19,7 +18,6 @@ import (
 
 var available = map[string]config.ProtoCommandIface{
 	"auth":      authService.Package(),
-	"accounts":  accountsService.Package(),
 	"hoarder":   hoarderService.Package(),
 	"monkey":    monkeyService.Package(),
 	"substrate": nodeService.Package(),
```

**File**: `dream/service.go` (modified, +11/-1)
```diff
@@ -25,7 +25,17 @@ func (u *Universe) createService(name string, config *commonIface.ServiceConfig)
 		config.Root = u.root
 	}
 
-	serviceCount := len(u.service[name].nodes)
+	// Create the slot on demand, for the same reason handlerRegistry.Set does:
+	// the map is pre-seeded from commonSpecs.Services, and a build-tag-gated
+	// service registered from an init() is not in that list. Without this the
+	// lookup is a nil map entry and the deref below panics.
+	si, ok := u.service[name]
+	if !ok {
+		si = &serviceInfo{nodes: make(map[string]commonIface.Service)}
+		u.service[name] = si
+	}
+
+	serviceCount := len(si.nodes)
 	config.Root = path.Join(config.Root, fmt.Sprintf("%s-%d", name, serviceCount))
 	// Ignoring error in case of opening
 	os.MkdirAll(config.Root, 0750)
```

**File**: `dream/simple.go` (modified, +11/-6)
```diff
@@ -16,7 +16,6 @@ import (
 	tnsIface "github.com/taubyte/tau/core/services/tns"
 	"github.com/taubyte/tau/p2p/keypair"
 	commonSpecs "github.com/taubyte/tau/pkg/specs/common"
-	"golang.org/x/exp/slices"
 
 	peerCore "github.com/libp2p/go-libp2p/core/peer"
 
@@ -203,11 +202,17 @@ func (u *Universe) CreateSimpleNode(name string, config *SimpleConfig) (peer.Nod
 
 	simple := &Simple{Node: simpleNode, clients: make(map[string]commonIface.Client)}
 	for name, clientCfg := range config.Clients {
-		// make sure the client asked for is a valid client
-		if slices.Contains(commonSpecs.Clients, name) {
-			if err = simple.startClient(name, clientCfg); err != nil {
-				return nil, fmt.Errorf("starting client `%s` failed with: %w", name, err)
-			}
+		// A client is valid when something registered a creator for it, which
+		// is not the same as being in commonSpecs.Clients: that list is
+		// pre-seeded and cannot know about a build-tag-gated service whose
+		// client registers from an init(). Checking the list instead would
+		// silently drop a client the caller explicitly asked for, and surface
+		// far away as "client for protocol `x` does not exist".
+		if _, err := Registry.client(name); err != nil {
+			continue
+		}
+		if err = simple.startClient(name, clientCfg); err != nil {
+			return nil, fmt.Errorf("starting client `%s` failed with: %w", name, err)
 		}
 	}
 
```

**File**: `ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit e117198e3d3ed319e801d358c312f12f97118d54
+Subproject commit 8c557ea67fc421b637b68a41b57803257e939683
```

**File**: `pkg/specs/common/vars.go` (modified, +4/-4)
```diff
@@ -29,8 +29,8 @@ const (
 )
 
 var (
-	Services          = []string{Auth, Patrick, Monkey, TNS, Hoarder, Substrate, Seer, Gateway, Accounts}
-	Clients           = []string{Auth, Patrick, Monkey, TNS, Hoarder, Substrate, Seer, Accounts}
-	HTTPServices      = []string{Patrick, Substrate, Seer, Auth, Gateway, Accounts}
-	P2PStreamServices = []string{Seer, Auth, Patrick, TNS, Monkey, Hoarder, Substrate, Accounts}
+	Services          = []string{Auth, Patrick, Monkey, TNS, Hoarder, Substrate, Seer, Gateway}
+	Clients           = []string{Auth, Patrick, Monkey, TNS, Hoarder, Substrate, Seer}
+	HTTPServices      = []string{Patrick, Substrate, Seer, Auth, Gateway}
+	P2PStreamServices = []string{Seer, Auth, Patrick, TNS, Monkey, Hoarder, Substrate}
 )
```

---

### Incident Patch 10: `d293b255` (2026-07-27)
**Commit Message**: fix(auth): relay membership errors, drop the ownership-only fallback (#504)

Two changes to how a configured tenancy behaves.

A provider error during the membership check is relayed as-is instead of
being rewrapped. The check either answered or it did not; when it did not,
the provider's own message is the only thing that says what to fix, and
restating it as a membership problem points at the wrong thing.

A configured tenancy now requires a usable app credential. Previously a
missing one degraded to an ownership-only gate, which let a cloud run in a
weaker mode than its config implied without saying so. tenancyVerifier now
returns an error for that case and the service refuses to start, so the
missing credential surfaces at boot rather than at whichever registration
first needs it. Extracting it also makes the decision testable on its own.

An unconfigured tenancy still needs no credential: that cloud refuses
registration outright, so there is nothing to verify against.

**File**: `services/auth/http_auth_tenancy.go` (modified, +7/-6)
```diff
@@ -39,10 +39,11 @@ func (srv *AuthService) authorizeRegistrant(ctx http.Context) error {
 		return ErrNoTenancy
 	}
 
-	// No app credential means membership is unanswerable. Repository ownership
-	// still applies at registration, so this is a narrower gate, not an open one.
+	// Startup refuses a configured tenancy without one, so this is unreachable.
+	// It stays because the alternative on an authorization path is a nil-deref
+	// panic rather than a refusal.
 	if srv.membership == nil {
-		return nil
+		return errors.New("membership verifier unavailable")
 	}
 
 	client, err := getGithubClientFromContext(ctx)
@@ -57,9 +58,9 @@ func (srv *AuthService) authorizeRegistrant(ctx http.Context) error {
 
 	member, err := srv.membership.IsActiveMember(ctx.Request().Context(), srv.tenancy.Owner, me.GetLogin())
 	if err != nil {
-		// Distinct from a refusal on purpose: a caller told "not a member" when
-		// the check never ran has nothing to act on.
-		return fmt.Errorf("could not verify your membership in `%s`: %w", srv.tenancy.Owner, err)
+		// Relayed as-is. A check that never ran is not a refusal, and the
+		// provider's own message is the only thing that says what to fix.
+		return err
 	}
 	if !member {
 		return fmt.Errorf("`%s` is not a member of `%s`", me.GetLogin(), srv.tenancy.Owner)
```

**File**: `services/auth/service.go` (modified, +6/-4)
```diff
@@ -83,11 +83,13 @@ func New(ctx context.Context, cfg tauConfig.Config) (*AuthService, error) {
 		}
 	}
 
+	// A configured tenancy requires a usable app credential. Without one,
+	// membership is unanswerable, and there is no narrower gate to fall back to:
+	// refusing at startup surfaces the missing credential now rather than at
+	// whichever registration first needs it.
 	srv.tenancy = cfg.Tenancy()
-	if srv.tenancy.Configured() && srv.tenancy.App.Key != "" {
-		if srv.membership, err = newGitHubAppVerifier(srv.tenancy.App.ClientId, srv.tenancy.App.Key); err != nil {
-			return nil, fmt.Errorf("tenancy app credential unusable: %w", err)
-		}
+	if srv.membership, err = tenancyVerifier(srv.tenancy); err != nil {
+		return nil, err
 	}
 
 	srv.setupStreamRoutes()
```

**File**: `services/auth/tenancy.go` (modified, +19/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/golang-jwt/jwt/v5"
 	"github.com/google/go-github/v71/github"
 	"github.com/jellydator/ttlcache/v3"
+	tauConfig "github.com/taubyte/tau/pkg/config"
 	"golang.org/x/oauth2"
 )
 
@@ -67,6 +68,24 @@ type tokenEntry struct {
 	expires time.Time
 }
 
+// tenancyVerifier returns the verifier a tenancy requires: none when no
+// namespace is configured, and otherwise one built from the app credential.
+//
+// A configured tenancy has no ownership-only fallback. Membership is
+// unanswerable without the credential, so a missing or unusable one is an error
+// here — at startup — rather than a quietly narrower gate discovered at
+// whichever registration first needs it.
+func tenancyVerifier(t tauConfig.Tenancy) (MembershipVerifier, error) {
+	if !t.Configured() {
+		return nil, nil
+	}
+	v, err := newGitHubAppVerifier(t.App.ClientId, t.App.Key)
+	if err != nil {
+		return nil, fmt.Errorf("tenancy `%s` needs a usable app credential: %w", t.Owner, err)
+	}
+	return v, nil
+}
+
 // newGitHubAppVerifier builds a verifier from a PEM private key. It fails on a
 // malformed key rather than deferring the error to the first registration.
 func newGitHubAppVerifier(clientID, pem string) (*githubAppVerifier, error) {
```

**File**: `services/auth/tenancy_test.go` (modified, +52/-5)
```diff
@@ -122,12 +122,59 @@ func TestMembership_ForbiddenIsAnErrorNotARefusal(t *testing.T) {
 	assert.Equal(t, atomic.LoadInt64(&calls), int64(2), "errors must not be cached")
 }
 
-func TestMembership_RejectsMalformedKey(t *testing.T) {
-	_, err := newGitHubAppVerifier("Iv1.test", "not a pem")
-	assert.Assert(t, err != nil)
+// No namespace configured means no verifier and no error — the cloud refuses
+// registration outright, so there is nothing to verify against.
+func TestTenancyVerifier_UnconfiguredNeedsNoCredential(t *testing.T) {
+	v, err := tenancyVerifier(tauConfig.Tenancy{})
+	assert.NilError(t, err)
+	assert.Assert(t, v == nil)
+}
 
-	_, err = newGitHubAppVerifier("", testAppKey(t))
-	assert.Assert(t, err != nil, "an empty client id cannot sign a usable jwt")
+// The other half of "no fallback": once an owner is set, startup fails unless
+// the credential is usable. Without this, a tenancy with no app would silently
+// degrade to an ownership-only gate.
+func TestTenancyVerifier_ConfiguredRequiresCredential(t *testing.T) {
+	for _, tc := range []struct {
+		name string
+		app  tauConfig.TenancyApp
+	}{
+		{"no app at all", tauConfig.TenancyApp{}},
+		{"client id but no key", tauConfig.TenancyApp{ClientId: "Iv1.test"}},
+		{"key but no client id", tauConfig.TenancyApp{Key: testAppKey(t)}},
+		{"malformed key", tauConfig.TenancyApp{ClientId: "Iv1.test", Key: "not a pem"}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			v, err := tenancyVerifier(tauConfig.Tenancy{Owner: "acme", App: tc.app})
+			assert.Assert(t, err != nil, "%s must refuse startup", tc.name)
+			assert.Assert(t, v == nil)
+		})
+	}
+
+	v, err := tenancyVerifier(tauConfig.Tenancy{
+		Owner: "acme",
+		App:   tauConfig.TenancyApp{ClientId: "Iv1.test", Key: testAppKey(t)},
+	})
+	assert.NilError(t, err)
+	assert.Assert(t, v != nil)
+}
+
+// A configured tenancy has no ownership-only fallback, so every way of not
+// supplying a usable credential has to be an error the service refuses to start
+// on, not a quietly narrower gate.
+func TestMembership_RejectsUnusableCredential(t *testing.T) {
+	for _, tc := range []struct {
+		name, clientID, key string
+	}{
+		{"malformed key", "Iv1.test", "not a pem"},
+		{"empty key", "Iv1.test", ""},
+		{"empty client id", "", testAppKey(t)},
+		{"nothing at all", "", ""},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			_, err := newGitHubAppVerifier(tc.clientID, tc.key)
+			assert.Assert(t, err != nil, "%s must not yield a usable verifier", tc.name)
+		})
+	}
 }
 
 // --- repository ownership ------------------------------------------------
```

---

### Incident Patch 11: `566f974c` (2026-07-26)
**Commit Message**: fix(accounts): key the slug index per claimant, and document kvdb design rules (#500)

A single key per slug holding the owning account id is contended: two nodes
creating accounts with the same slug both write it, last-write-wins discards
one, and the losing account keeps existing with a slug that resolves to
somebody else. Nothing can detect that afterwards, because the losing index
entry is gone.

Per claimant both claims survive, and lookupIDBySlug settles them
deterministically — earliest created-at, account id breaking ties — so every
node resolves identically from the same replicated state. The guard in Create
stays for a clear error in the uncontended case, but correctness no longer
rests on it.

Also renames account_slug/ to account/slug/ and git_user/ to git/user/.
Compound words are invisible to the prefix scanner and foreclose scanning the
intermediate level.

AGENTS.md writes down the rules this class of bug keeps violating. The
convention existed in a comment in one file, which is why it was easy to not
apply.

**File**: `AGENTS.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# AGENTS.md
+
+Working notes for anyone — human or agent — changing this codebase. Rules here exist
+because getting them wrong produced a real bug, not because they sound tidy.
+
+## Designing around kvdb
+
+`core/kvdb` is a **CRDT key-value store** (go-ds-crdt), not a database. It replicates
+between nodes and merges concurrent writes with **last-write-wins per key**. There are no
+transactions, no compare-and-swap, and no cross-key atomicity. Design for that or lose
+data.
+
+### 1. One key per entry. Never a contended key.
+
+The single most important rule. If two nodes can write the same key with different
+content, one write is silently discarded.
+
+```
+BAD   /lookup/org/{provider}/{owner}          → account_id
+GOOD  /lookup/org/{provider}/{owner}/{account_id} → linked-at
+```
+
+In the bad layout two nodes claiming the same namespace both write one key and LWW picks a
+winner — the loser vanishes with no error. In the good layout they write **different**
+keys, so nothing is lost.
+
+Same rule kills read-modify-write on a collection. Never store a CBOR slice or map that
+callers append to: reader A and reader B both read `[x]`, write `[x,y]` and `[x,z]`, and
+one entry disappears. Split the collection into one key per element.
+
+`services/accounts/paths.go` states this convention and the layouts follow it — lookup
+indexes, passkey sub-collections, all one key per entry.
+
+### 2. Put the discriminator in the key path.
+
+If an entry belongs to a `(provider, owner, account)` tuple, all three go in the path. Any
+part you leave out of the key is a part two writers can collide on.
+
+Corollary: keys are also your index. `List(ctx, prefix)` is the only query mechanism, so
+lay paths out so the prefix scans you need are cheap and the ones you don't need are
+impossible.
+
+### 3. Make conflict visible, then resolve it deterministically.
+
+Rule 1 means a genuine conflict — two accounts legitimately claiming one namespace — shows
+up as two entries rather than one silently winning. That is the point. Do not try to
+prevent it with a lock you do not have; resolve it on read:
+
+- scan the prefix
+- order by a stable value carried **in the entry** (a timestamp), with a second key
+  (the id) breaking ties for a total order
+- take the first
+
+Every node then computes the same answer from the same replicated state, with no
+coordination and no dependence on write ordering or clock skew between nodes mattering to
+correctness. `services/accounts/account.go`'s `lookupIDBySlug` does exactly this.
+
+### 4. Read-then-write guards are UX, not correctness.
+
+Checking "is this already claimed?" before writing is worth doing — it gives a clear error
+in the overwhelmingly common uncontended case. It guarantees nothing under concurrency,
+because another node can write between your read and your write. Never let correctness
+depend on one. Rule 3 is what makes the outcome safe.
+
+### 5. Deletes are writes too.
+
+A delete is LWW against a concurrent write to the same key. A delete racing a re-create can
+lose. If ordering matters, carry it in the value and resolve on read.
+
+### 6. Only subscribed instances replicate.
+
+A kvdb replicates to instances that are **open and subscribed**. A write acknowledged by a
+single node can die with that node if no other holder had the database open. Anything doing
+load/unload must keep claimants co-loaded during active writes and barrier on acknowledgement
+from more than one holder. See `pkg/kvdb` and the hoarder replication path.
+
+### 7. Byte order is your only sort order.
+
+`List` returns keys in byte order. To scan chronologically, zero-pad the numeric segment to
+fixed width so lexicographic order matches numeric order — `pkg/raft/storage.go:40` and
+`pkg/raft/queue.go:60` pad indices to 20 digits for this reason. Unpadded numbers sort
+`1, 10, 2`.
+
+### 8. Key naming: path segments, not compound words.
+
+Use `/lookup/account/slug/{slug}`, not `/lookup/account_slug/{slug}`. Segments are what the
+prefix scanner understands; an underscore is invisible to it and forecloses scanning the
+intermediate level later.
+
+### 9. Normalise before keying.
+
+Anything case-insensitive in the real world (email, provider namespaces) must be
+canonicalised before it becomes part of a key, or `Acme` and `acme` become two entries for
+one thing and every uniqueness property built on that key quietly fails. The store
+lowercases emails in several places; do the same for any new identifier.
+
+### Checklist
+
+- [ ] Can two nodes write this exact key with different content? If yes, redesign.
+- [ ] Am I appending to a stored collection? If yes, split it into keys.
+- [ ] Is every part of the entry's identity in the key path?
+- [ ] If a conflict happens anyway, does every node resolve it the same way?
+- [ ] Does correctness rest on a read-then-write guard? It must not.
+- [ ] Are numeric key segments zero-padded to fixed width?
+- [ ] Are case-insensitive iden
```

**File**: `services/accounts/account.go` (modified, +39/-4)
```diff
@@ -2,8 +2,10 @@ package accounts
 
 import (
 	"context"
+	"encoding/binary"
 	"errors"
 	"fmt"
+	"strings"
 	"time"
 
 	"github.com/taubyte/tau/core/kvdb"
@@ -53,7 +55,7 @@ func (s *accountStore) Create(ctx context.Context, in accountsIface.CreateAccoun
 	if err := putKV(ctx, s.db, AccountProfilePath(acc.ID), acc); err != nil {
 		return nil, err
 	}
-	if err := s.db.Put(ctx, LookupAccountSlugPath(in.Slug), []byte(acc.ID)); err != nil {
+	if err := s.db.Put(ctx, LookupAccountSlugEntryPath(in.Slug, acc.ID), unixNanoBytes(now)); err != nil {
 		_ = s.db.Delete(ctx, AccountProfilePath(acc.ID))
 		return nil, fmt.Errorf("accounts: index slug: %w", err)
 	}
@@ -130,7 +132,7 @@ func (s *accountStore) Delete(ctx context.Context, accountID string) error {
 	if err := batch.Delete(AccountProfilePath(accountID)); err != nil {
 		return fmt.Errorf("accounts: batch delete profile: %w", err)
 	}
-	if err := batch.Delete(LookupAccountSlugPath(acc.Slug)); err != nil {
+	if err := batch.Delete(LookupAccountSlugEntryPath(acc.Slug, accountID)); err != nil {
 		return fmt.Errorf("accounts: batch delete slug index: %w", err)
 	}
 	if err := batch.Commit(); err != nil {
@@ -140,15 +142,48 @@ func (s *accountStore) Delete(ctx context.Context, accountID string) error {
 }
 
 // lookupIDBySlug returns "" (not ErrNotFound) when the slug is missing.
+//
+// The index is one key per claimant, so a slug claimed concurrently by two
+// accounts yields two entries rather than one being lost. Earliest created-at
+// wins, account id breaking ties for a total order, so every node resolves the
+// same way from the same replicated state.
 func (s *accountStore) lookupIDBySlug(ctx context.Context, slug string) (string, error) {
-	raw, err := s.db.Get(ctx, LookupAccountSlugPath(slug))
+	prefix := LookupAccountSlugPrefix(slug)
+	keys, err := s.db.List(ctx, prefix)
 	if err != nil {
 		if isMissing(err) {
 			return "", nil
 		}
 		return "", fmt.Errorf("accounts: lookup slug: %w", err)
 	}
-	return string(raw), nil
+
+	best, bestAt := "", int64(0)
+	for _, k := range keys {
+		accountID := strings.TrimPrefix(k, prefix)
+		if accountID == "" || strings.Contains(accountID, "/") {
+			continue
+		}
+		raw, err := s.db.Get(ctx, k)
+		if err != nil {
+			if isMissing(err) {
+				continue
+			}
+			return "", fmt.Errorf("accounts: lookup slug: %w", err)
+		}
+		at := int64(binary.BigEndian.Uint64(raw))
+		if best == "" || at < bestAt || (at == bestAt && accountID < best) {
+			best, bestAt = accountID, at
+		}
+	}
+	return best, nil
+}
+
+// unixNanoBytes encodes a timestamp as 8 big-endian bytes, matching the other
+// lookup indexes in this package.
+func unixNanoBytes(t time.Time) []byte {
+	var b [8]byte
+	binary.BigEndian.PutUint64(b[:], uint64(t.UnixNano()))
+	return b[:]
 }
 
 // validateAccountSlug is case-sensitive — "Pro" and "pro" are distinct.
```

**File**: `services/accounts/paths.go` (modified, +16/-5)
```diff
@@ -16,10 +16,10 @@ import (
 //   /accounts/{id}/users/{user_id}/profile                        → User
 //   /accounts/{id}/signing_key                                    → 32 raw random bytes
 //
-//   /lookup/account_slug/{slug}                                       → account_id (raw bytes)
+//   /lookup/account/slug/{slug}/{account_id}                          → 8-byte unixnano created-at
 //   /lookup/email/{sha256(lower(email))}/{account_id}/{member_id}     → 8-byte unixnano added-at
 //   /lookup/external/{provider}/{subject}/{account_id}/{member_id}    → 8-byte unixnano added-at
-//   /lookup/git_user/{provider}/{external_id}/{account_id}/{user_id}  → 8-byte unixnano added-at
+//   /lookup/git/user/{provider}/{external_id}/{account_id}/{user_id} → 8-byte unixnano added-at
 //
 // Lookup indexes are one KV key per entry (not a single CBOR slice) so
 // concurrent writes from different nodes for distinct (account, member|user)
@@ -59,8 +59,19 @@ func UserProfilePath(accountID, userID string) string {
 	return AccountUsersPrefix(accountID) + userID + "/profile"
 }
 
-func LookupAccountSlugPath(slug string) string {
-	return prefixLookup + "account_slug/" + slug
+// LookupAccountSlugPrefix / LookupAccountSlugEntryPath: one key per claimant
+// rather than a single key per slug holding the owning account id. A contended
+// key would let two nodes creating accounts with the same slug both write it,
+// last-write-wins discard one, and leave the losing account existing with a
+// slug that resolves to somebody else — an orphan nothing can detect. Per
+// claimant, both claims survive and lookupIDBySlug settles them
+// deterministically. See AGENTS.md, "Designing around kvdb".
+func LookupAccountSlugPrefix(slug string) string {
+	return prefixLookup + "account/slug/" + slug + "/"
+}
+
+func LookupAccountSlugEntryPath(slug, accountID string) string {
+	return LookupAccountSlugPrefix(slug) + accountID
 }
 
 func LookupEmailPrefix(email string) string {
@@ -80,7 +91,7 @@ func LookupExternalEntryPath(provider, subject, accountID, memberID string) stri
 }
 
 func LookupGitUserPrefix(provider, externalID string) string {
-	return prefixLookup + "git_user/" + provider + "/" + externalID + "/"
+	return prefixLookup + "git/user/" + provider + "/" + externalID + "/"
 }
 
 func LookupGitUserEntryPath(provider, externalID, accountID, userID string) string {
```

**File**: `services/accounts/store_test.go` (modified, +58/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"errors"
 	"testing"
+	"time"
 
 	"github.com/ipfs/go-log/v2"
 	"github.com/taubyte/tau/core/kvdb"
@@ -187,3 +188,60 @@ func TestMemberStore_InviteAndIndex(t *testing.T) {
 		t.Fatalf("index after Remove: idx=%+v err=%v", idx, err)
 	}
 }
+
+// TestAccountStore_ConcurrentSlugClaim covers what the per-claimant slug index
+// is for: two nodes creating accounts with the same slug, neither having seen
+// the other's write. A single contended key would lose one claim to
+// last-write-wins and leave that account existing with a slug resolving to
+// somebody else. Both claims must survive and every reader must agree.
+func TestAccountStore_ConcurrentSlugClaim(t *testing.T) {
+	srv := newTestService(t)
+	store := newAccountStore(srv.db)
+	ctx := context.Background()
+
+	// Write both index entries directly: Create's guard cannot see a
+	// concurrent write on another node, so this is the state that replicates.
+	early := time.Now().UTC().Add(-time.Hour)
+	late := time.Now().UTC()
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("acme", "accZ"), unixNanoBytes(early)); err != nil {
+		t.Fatal(err)
+	}
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("acme", "accA"), unixNanoBytes(late)); err != nil {
+		t.Fatal(err)
+	}
+
+	keys, err := srv.db.List(ctx, LookupAccountSlugPrefix("acme"))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(keys) != 2 {
+		t.Fatalf("both claims must survive, got %d", len(keys))
+	}
+
+	// Earliest created-at wins, not write order and not lexicographic id.
+	for range 5 {
+		got, err := store.lookupIDBySlug(ctx, "acme")
+		if err != nil {
+			t.Fatalf("lookup: %v", err)
+		}
+		if got != "accZ" {
+			t.Fatalf("expected the earliest claim to win, got %q", got)
+		}
+	}
+
+	// Equal timestamps fall back to account id, so nodes still converge.
+	same := time.Now().UTC()
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("tie", "accB"), unixNanoBytes(same)); err != nil {
+		t.Fatal(err)
+	}
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("tie", "accA"), unixNanoBytes(same)); err != nil {
+		t.Fatal(err)
+	}
+	got, err := store.lookupIDBySlug(ctx, "tie")
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != "accA" {
+		t.Fatalf("tie must break on account id, got %q", got)
+	}
+}
```

---

### Incident Patch 12: `080d93d8` (2026-07-26)
**Commit Message**: refactor(monkey): remove the build-time account-binding check (#497)

* refactor(monkey): remove the build-time account-binding check

Tau's control-plane surface (project creation, repository registration)
already gates access through the auth routes; git itself enforces push
access to a registered repository. Re-checking a binding at build time
was redundant and, since it looked up a repository ID in a table keyed
by git user, always resolved wrong.

Drops the check, monkey's now-unneeded accounts client, and the
Validate seam on the accounts Client interface (and its only
implementations/wire plumbing) down to the last reference. Verify and
its auth caller are untouched — that gate covers API access, which git
does not enforce. The clouds.<fqdn>.account project field stays in the
schema/DSL; it is declarative only now.

* chore: update pinned submodule

Picks up the companion removal of the Validate implementations.

**File**: `clients/p2p/accounts/client_base.go` (modified, +0/-31)
```diff
@@ -84,20 +84,6 @@ func (c *Client) LookupAccountsByEmail(ctx context.Context, email string) ([]str
 	return ids, nil
 }
 
-// sendLinkageResolve issues the community linkage check over the wire (verb
-// "resolve"). Used by Validate in both builds' fallback path.
-func (c *Client) sendLinkageResolve(accountSlug, provider, externalID string) (*accountsIface.ResolveResponse, error) {
-	resp, err := c.client.Send(verbResolve, command.Body{
-		"account_slug": accountSlug,
-		"provider":     provider,
-		"external_id":  externalID,
-	}, c.peers...)
-	if err != nil {
-		return nil, fmt.Errorf("accounts.Validate: %w", err)
-	}
-	return decodeResolveResponse(resp)
-}
-
 func (c *Client) Accounts() accountsIface.Accounts { return &accountsImpl{c: c} }
 func (c *Client) Members(accountID string) accountsIface.Members {
 	return &membersImpl{c: c, accountID: accountID}
@@ -109,7 +95,6 @@ func (c *Client) Login() accountsIface.Login { return &loginImpl{c: c} }
 
 const (
 	verbVerify                = "verify"
-	verbResolve               = "resolve"
 	verbLookupAccountsByEmail = "lookup_accounts_by_email"
 )
 
@@ -129,13 +114,6 @@ func decodeVerifyResponse(resp map[string]any) (*accountsIface.VerifyResponse, e
 	return out, nil
 }
 
-func decodeResolveResponse(resp map[string]any) (*accountsIface.ResolveResponse, error) {
-	return &accountsIface.ResolveResponse{
-		Valid:  tryBool(resp, "valid"),
-		Reason: tryString(resp, "reason"),
-	}, nil
-}
-
 func tryBool(m map[string]interface{}, key string) bool {
 	if v, ok := m[key]; ok {
 		if b, ok := v.(bool); ok {
@@ -144,12 +122,3 @@ func tryBool(m map[string]interface{}, key string) bool {
 	}
 	return false
 }
-
-func tryString(m map[string]interface{}, key string) string {
-	if v, ok := m[key]; ok {
-		if s, ok := v.(string); ok {
-			return s
-		}
-	}
-	return ""
-}
```

**File**: `clients/p2p/accounts/validate.go` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-//go:build !ee
-
-package accounts
-
-import (
-	"context"
-
-	accountsIface "github.com/taubyte/tau/core/services/accounts"
-	project "github.com/taubyte/tau/pkg/schema/project"
-)
-
-// Validate (community build) checks linkage only against the account the
-// binding names.
-func (c *Client) Validate(ctx context.Context, provider, externalID string, binding project.CloudBinding) (*accountsIface.ResolveResponse, error) {
-	return c.sendLinkageResolve(binding.Account, provider, externalID)
-}
```

**File**: `core/services/accounts/client_base.go` (modified, +0/-7)
```diff
@@ -4,7 +4,6 @@ import (
 	"context"
 
 	peerCore "github.com/libp2p/go-libp2p/core/peer"
-	project "github.com/taubyte/tau/pkg/schema/project"
 )
 
 // Client is the consumer-side interface for the Accounts subsystem.
@@ -16,12 +15,6 @@ type Client interface {
 	// Integration surface — methods the rest of tau actually calls.
 	Verify(ctx context.Context, provider, externalID string) (*VerifyResponse, error)
 
-	// Validate is the compile-time check the project compiler calls: may this
-	// git user build against the given cloud binding? The community build
-	// checks linkage (account active + git user linked); a -tags ee build reads
-	// whatever extra the binding carries. Returns Valid with a typed Reason.
-	Validate(ctx context.Context, provider, externalID string, binding project.CloudBinding) (*ResolveResponse, error)
-
 	// LookupAccountsByEmail returns the IDs of every Account on the cluster
 	// that has a Member with this primary_email (case-insensitive, trimmed).
 	// Empty input → error. No matches → (empty slice, nil). Result is
```

**File**: `core/services/accounts/types.go` (modified, +0/-9)
```diff
@@ -147,12 +147,3 @@ type VerifyAccountSummary struct {
 	Slug string `json:"slug" cbor:"slug"`
 	Name string `json:"name" cbor:"name"`
 }
-
-// ResolveResponse is the result of resolving a git user against an account,
-// called by the project compiler at compile time. In the community build this is a
-// pure linkage check: Valid is true iff the account is active and the git user
-// is linked to it.
-type ResolveResponse struct {
-	Valid  bool   `json:"valid"            cbor:"valid"`
-	Reason string `json:"reason,omitempty" cbor:"reason,omitempty"` // typed: account not found | account not active | git user not linked to account
-}
```

**File**: `ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 629d58b06e9b3bf2c179dd1105f7315ea9d95657
+Subproject commit 39562417c308046960630ed432bc7b295a87152e
```

**File**: `pkg/taucorder/service/accounts_test.go` (modified, +2/-12)
```diff
@@ -13,7 +13,6 @@ import (
 	"github.com/taubyte/tau/core/common"
 	"github.com/taubyte/tau/dream"
 	"github.com/taubyte/tau/dream/api"
-	project "github.com/taubyte/tau/pkg/schema/project"
 	pb "github.com/taubyte/tau/pkg/taucorder/proto/gen/taucorder/v1"
 	pbconnect "github.com/taubyte/tau/pkg/taucorder/proto/gen/taucorder/v1/taucorderv1connect"
 	"golang.org/x/net/http2"
@@ -110,19 +109,10 @@ func TestAccounts_Dreaming(t *testing.T) {
 	assert.NilError(t, ustream.Err())
 	assert.Assert(t, slices.Contains(userIDs, usr.Msg.GetId()))
 
-	// Linkage is the access grant: Verify + Resolve succeed for the assigned
-	// identity, straight against the universe's accounts client.
+	// Linkage is the access grant: Verify succeeds for the assigned identity,
+	// straight against the universe's accounts client.
 	cli := u.Accounts().Client()
 	vr, err := cli.Verify(ctx, "github", "42")
 	assert.NilError(t, err)
 	assert.Equal(t, vr.Linked, true)
-
-	rr, err := cli.Validate(ctx, "github", "42", project.CloudBinding{Account: "acme"})
-	assert.NilError(t, err)
-	assert.Equal(t, rr.Valid, true)
-
-	// An unlinked identity resolves invalid.
-	rr2, err := cli.Validate(ctx, "github", "999", project.CloudBinding{Account: "acme"})
-	assert.NilError(t, err)
-	assert.Equal(t, rr2.Valid, false)
 }
```

**File**: `pkg/tcc/interp/clouds_compile_test.go` (modified, +2/-2)
```diff
@@ -140,8 +140,8 @@ func TestCompile_CloudsBindings_PartialOnOtherCloud(t *testing.T) {
 
 // TestCompile_CloudsBindings_UnknownCloud — compiler points at a cloud the
 // project doesn't pin. Drop without promotion; no error. The project is
-// "valid for this cloud, just not bound to a plan here." The plan-presence
-// gate is policy in `services/monkey/jobs/checkAccountPlan`, not in TCC.
+// "valid for this cloud, just not bound to a plan here." Nothing validates
+// account/plan presence; the field is declarative only.
 func TestCompile_CloudsBindings_UnknownCloud(t *testing.T) {
 	compiler, err := schema.New(
 		schema.WithLocal("../taubyte/v1/fixtures/clouds"),
```

**File**: `services/accounts/api_hooks.go` (modified, +0/-34)
```diff
@@ -13,7 +13,6 @@ import (
 
 const (
 	StreamVerbVerify                = "verify"
-	StreamVerbResolve               = "resolve"
 	StreamVerbLookupAccountsByEmail = "lookup_accounts_by_email"
 )
 
@@ -45,28 +44,6 @@ func (srv *AccountsService) apiLookupAccountsByEmailHandler(ctx context.Context,
 	return cr.Response{"account_ids": ids}, nil
 }
 
-// apiResolveHandler is the linkage resolve: account active + git user linked →
-// valid. Some builds add a separate resolve verb.
-func (srv *AccountsService) apiResolveHandler(ctx context.Context, _ streams.Connection, body command.Body) (cr.Response, error) {
-	accountSlug, err := maps.String(body, "account_slug")
-	if err != nil {
-		return nil, fmt.Errorf("resolve: %w", err)
-	}
-	provider, err := maps.String(body, "provider")
-	if err != nil {
-		return nil, fmt.Errorf("resolve: %w", err)
-	}
-	externalID, err := maps.String(body, "external_id")
-	if err != nil {
-		return nil, fmt.Errorf("resolve: %w", err)
-	}
-	resp, err := resolveLinkage(ctx, srv.db, accountSlug, provider, externalID)
-	if err != nil {
-		return nil, err
-	}
-	return resolveResponseToWire(resp), nil
-}
-
 func verifyResponseToWire(r *accountsIface.VerifyResponse) cr.Response {
 	if r == nil {
 		return cr.Response{"linked": false}
@@ -77,14 +54,3 @@ func verifyResponseToWire(r *accountsIface.VerifyResponse) cr.Response {
 	}
 	return out
 }
-
-func resolveResponseToWire(r *accountsIface.ResolveResponse) cr.Response {
-	if r == nil {
-		return cr.Response{"valid": false, "reason": "nil response"}
-	}
-	out := cr.Response{"valid": r.Valid}
-	if r.Reason != "" {
-		out["reason"] = r.Reason
-	}
-	return out
-}
```

---

### Incident Patch 13: `021627c1` (2026-07-26)
**Commit Message**: fix(hoarder): make the at-rest encryption posture visible instead of silent (#496)

This build stores hoarder values as plaintext at rest and gave no signal that
it does. cipherInit now logs a one-time warning at startup; the
encrypt/decrypt hot path is untouched, and TestCipher_PlaintextWarning pins
that by asserting the warning count stays at one across repeated round trips.

A warning rather than a refusal: refusing to store would break the hoarder
entirely, which fixes nothing. For the same reason a missing cipher never
blocks startup in any build variant.

cipherInit also moves above recoverClaims, membership, reconcile and the asset
sweep. It depends on neither those loops nor the state they read, and they all
write through cipherEncrypt, so it belongs before them. Note service.go carries
no build tag, so the reorder applies to every variant.

Every no-encryption path shares the substring "hoarder values unencrypted at
rest" so one grep identifies such a node.

TestCipherNone_Dreaming boots a seer + hoarder universe with no cipher, asserts
the service starts, round-trips a kv put/get, and asserts the warning fired.

**File**: `services/hoarder/cipher.go` (modified, +7/-2)
```diff
@@ -12,8 +12,13 @@ import (
 // an implementation can transform values without a data-layout change. This
 // build stores values as-is.
 
-// cipherInit is called once at startup. This build holds no key.
-func (srv *Service) cipherInit(context.Context, peer.Node) error { return nil }
+// cipherInit is called once at startup. This build holds no key, so it warns
+// once, here, that values will be stored unencrypted — never in the
+// encrypt/decrypt path below, which runs on every put/get.
+func (srv *Service) cipherInit(context.Context, peer.Node) error {
+	logger.Warn("at-rest cipher: this build stores hoarder values unencrypted at rest; Enterprise Edition encrypts values at rest")
+	return nil
+}
 
 func (srv *Service) cipherEncrypt(value []byte) ([]byte, error) { return value, nil }
 func (srv *Service) cipherDecrypt(value []byte) ([]byte, error) { return value, nil }
```

**File**: `services/hoarder/cipher_ee.go` (modified, +12/-9)
```diff
@@ -10,20 +10,23 @@ import (
 )
 
 // cipherInit obtains the fleet key from the ee secrets stack and holds it on the
-// Service. Production (DevMode=false) fails closed — the hoarder never serves
-// values it cannot encrypt. In dev/test (DevMode=true) the secrets stack is
-// often absent (auth-less fleets), so rather than refuse to start it degrades to
-// pass-through: values are stored as-is, exactly like the community (!ee) cipher stub.
-// It never stores plaintext when DevMode is false.
+// Service. The hoarder must never fail to start for lack of an at-rest cipher —
+// an operator may legitimately run without one configured — so a BootstrapKey
+// failure never aborts startup, in any mode: it warns and degrades to
+// pass-through, storing values as-is, exactly like the community (!ee) cipher
+// stub. Dev/test and production emit distinguishable warnings, since an
+// unencrypted production node is a much bigger deal than an unencrypted dev
+// one.
 func (srv *Service) cipherInit(ctx context.Context, node peer.Node) error {
 	key, err := cipher.BootstrapKey(ctx, node)
 	if err != nil {
 		if srv.devMode {
-			logger.Warnf("at-rest cipher: secrets stack unreachable in dev mode; storing values unencrypted like the community build (dev/test only, never in production): %s", err)
-			srv.atRestKey = nil
-			return nil
+			logger.Warnf("at-rest cipher: secrets stack unreachable in dev mode; hoarder values unencrypted at rest (dev/test only, never in production): %s", err)
+		} else {
+			logger.Warnf("at-rest cipher: secrets stack unreachable; hoarder values unencrypted at rest in production, Enterprise Edition normally encrypts values at rest: %s", err)
 		}
-		return err
+		srv.atRestKey = nil
+		return nil
 	}
 	srv.atRestKey = key
 	return nil
```

**File**: `services/hoarder/cipher_test.go` (modified, +46/-1)
```diff
@@ -2,7 +2,14 @@
 
 package hoarder
 
-import "testing"
+import (
+	"strings"
+	"testing"
+
+	golog "github.com/ipfs/go-log/v2"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+)
 
 func TestCipher_Identity(t *testing.T) {
 	srv := newTestService(t)
@@ -18,3 +25,41 @@ func TestCipher_Identity(t *testing.T) {
 		t.Fatalf("community admission must accept: %v", err)
 	}
 }
+
+// TestCipher_PlaintextWarning proves the at-rest-plaintext warning fires once,
+// at cipherInit, and never again from cipherEncrypt/cipherDecrypt — a warning
+// in the storage hot path would be a serious regression.
+func TestCipher_PlaintextWarning(t *testing.T) {
+	core, logs := observer.New(zapcore.WarnLevel)
+	prev := golog.GetConfig()
+	golog.SetPrimaryCore(core)
+	if err := golog.SetLogLevel("tau.hoarder.service", "warn"); err != nil {
+		t.Fatalf("setting log level failed: %v", err)
+	}
+	t.Cleanup(func() { golog.SetupLogging(prev) })
+
+	srv := newTestService(t)
+	if err := srv.cipherInit(t.Context(), nil); err != nil {
+		t.Fatalf("cipherInit failed: %v", err)
+	}
+
+	// Storage hot path: must not add any further warnings.
+	for range 5 {
+		if _, err := srv.cipherEncrypt([]byte("v")); err != nil {
+			t.Fatalf("cipherEncrypt failed: %v", err)
+		}
+		if _, err := srv.cipherDecrypt([]byte("v")); err != nil {
+			t.Fatalf("cipherDecrypt failed: %v", err)
+		}
+	}
+
+	var matches int
+	for _, entry := range logs.All() {
+		if strings.Contains(entry.Message, "unencrypted") {
+			matches++
+		}
+	}
+	if matches != 1 {
+		t.Fatalf("expected exactly 1 plaintext-at-rest warning, got %d", matches)
+	}
+}
```

**File**: `services/hoarder/service.go` (modified, +8/-5)
```diff
@@ -70,6 +70,14 @@ func New(ctx context.Context, cfg tauConfig.Config) (service hoarderIface.Servic
 		return nil, fmt.Errorf("creating hoarder kvdb replication client failed with: %w", err)
 	}
 
+	// Cipher bootstrap (see cipher.go / cipher_ee.go). MUST stay above every loop
+	// below: recover/reconcile/asset-sweep all write through cipherEncrypt, and a
+	// build holding no key yet stores values as-is rather than refusing. Running
+	// this last leaves a startup window where those writes land unencrypted.
+	if err = s.cipherInit(ctx, clientNode); err != nil {
+		return nil, fmt.Errorf("initializing at-rest cipher failed with: %w", err)
+	}
+
 	// Recover what this node already holds, then start membership + reconcile.
 	// They share a cancelable context so Close stops them before tearing down the
 	// state they read.
@@ -88,11 +96,6 @@ func New(ctx context.Context, cfg tauConfig.Config) (service hoarderIface.Servic
 	s.loopsWG.Add(1)
 	go func() { defer s.loopsWG.Done(); s.assetSweepLoop(loopCtx) }()
 
-	// Cipher bootstrap (see cipher.go / cipher_ee.go).
-	if err = s.cipherInit(ctx, clientNode); err != nil {
-		return nil, fmt.Errorf("initializing at-rest cipher failed with: %w", err)
-	}
-
 	service = s
 	return
 }
```

**File**: `services/hoarder/tests/cipher_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+//go:build dreaming
+
+package tests
+
+import (
+	"strings"
+	"testing"
+
+	golog "github.com/ipfs/go-log/v2"
+	commonIface "github.com/taubyte/tau/core/common"
+	hoarderIface "github.com/taubyte/tau/core/services/hoarder"
+	"github.com/taubyte/tau/dream"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+	"gotest.tools/v3/assert"
+
+	_ "github.com/taubyte/tau/clients/p2p/hoarder/dream"
+	_ "github.com/taubyte/tau/clients/p2p/seer/dream"
+	_ "github.com/taubyte/tau/services/hoarder/dream"
+	_ "github.com/taubyte/tau/services/seer/dream"
+)
+
+// TestCipherNone_Dreaming proves the invariant that matters most about the
+// at-rest cipher seam: a hoarder with no cipher configured must still boot and
+// serve normally, loudly warning rather than refusing to start. It stands up a
+// universe with hoarder + seer, confirms the service came up (no error out of
+// hoarder.New via StartWithConfig), round-trips a kv put/get, and asserts the
+// unencrypted-at-rest warning fired.
+func TestCipherNone_Dreaming(t *testing.T) {
+	fastConvergence(t)
+
+	core, logs := observer.New(zapcore.WarnLevel)
+	prev := golog.GetConfig()
+	golog.SetPrimaryCore(core)
+	if err := golog.SetLogLevel("tau.hoarder.service", "warn"); err != nil {
+		t.Fatalf("setting log level failed: %v", err)
+	}
+	t.Cleanup(func() { golog.SetupLogging(prev) })
+
+	m, err := dream.New(t.Context())
+	assert.NilError(t, err)
+	defer m.Close()
+
+	u, err := m.New(dream.UniverseConfig{Name: t.Name()})
+	assert.NilError(t, err)
+
+	// No cipher is configured anywhere here; StartWithConfig must still succeed.
+	err = u.StartWithConfig(&dream.Config{
+		Services: map[string]commonIface.ServiceConfig{
+			"seer":    {},
+			"hoarder": {},
+		},
+		Simples: map[string]dream.SimpleConfig{
+			"client": {
+				Clients: dream.SimpleConfigClients{
+					Seer:    &commonIface.ClientConfig{},
+					Hoarder: &commonIface.ClientConfig{},
+				}.Compat(),
+			},
+		},
+	})
+	assert.NilError(t, err)
+
+	simple, err := u.Simple("client")
+	assert.NilError(t, err)
+	hoarderClient, err := simple.Hoarder()
+	assert.NilError(t, err)
+
+	kv, err := hoarderClient.KVDB(hoarderIface.Global, "nocipherproj", "", "/nocipher/instance", "main")
+	assert.NilError(t, err)
+
+	ctx := u.Context()
+	assert.NilError(t, kv.Put(ctx, "k1", []byte("v1")))
+
+	got, err := kv.Get(ctx, "k1")
+	assert.NilError(t, err)
+	assert.Equal(t, string(got), "v1")
+
+	var found bool
+	for _, entry := range logs.All() {
+		if strings.Contains(entry.Message, "hoarder values unencrypted at rest") {
+			found = true
+			break
+		}
+	}
+	assert.Assert(t, found, "expected the unencrypted-at-rest warning to fire")
+}
```

---

### Incident Patch 14: `d92fd081` (2026-07-13)
**Commit Message**: fix(monkey): name website cache asset .zip, not .zwasm (#476)

A website build produces a static-site zip, not a zipped wasm, so the
compile-fixture cache mislabeled it. stashCached now takes the asset
extension: "zwasm" for code (function/smartops/library), "zip" for a
website bundle. Renames the committed substrate website asset accordingly.

**File**: `services/monkey/fixtures/compile/cache.go` (modified, +12/-11)
```diff
@@ -11,18 +11,19 @@ import (
 	"github.com/pterm/pterm"
 )
 
-// stashCached serves a committed <base>.zwasm sitting next to the source when it
+// stashCached serves a committed <base>.<ext> sitting next to the source when it
 // is at least as new as the source, otherwise runs build() and writes the result
-// back so the next run skips the (slow) container build. The asset is rebuilt
-// only when the source is touched (mtime), and the stable name means git sees a
-// clean modify rather than a churn of hash-named files. Callers that exist to
-// test the build toolchain set ForceBuild to bypass the cache.
+// back so the next run skips the (slow) container build. ext names the asset
+// format: "zwasm" (zipped wasm) for code, "zip" for a website bundle. The asset
+// is rebuilt only when the source is touched (mtime), and the stable name means
+// git sees a clean modify rather than a churn of hash-named files. Callers that
+// exist to test the build toolchain set ForceBuild to bypass the cache.
 //
 // ponytail: mtime, not a content hash — keeps the committed asset name stable and
 // git clean. Caveat: git doesn't preserve mtimes, so commit source and asset
 // together; a fresh clone can't detect an asset that was committed stale.
-func (ctx resourceContext) stashCached(id string, build func() (io.ReadSeekCloser, error)) error {
-	cachePath := ctx.cachePath()
+func (ctx resourceContext) stashCached(id, ext string, build func() (io.ReadSeekCloser, error)) error {
+	cachePath := ctx.cachePath(ext)
 
 	if !ctx.forceBuild && cacheFresh(cachePath, ctx.paths) {
 		if f, err := os.Open(cachePath); err == nil {
@@ -52,12 +53,12 @@ func (ctx resourceContext) stashCached(id string, build func() (io.ReadSeekClose
 	return ctx.stashAndPush(id, readSeekNopCloser{bytes.NewReader(buf)})
 }
 
-// cachePath is the stable asset name for a source: <base>.zwasm next to it.
-func (ctx resourceContext) cachePath() string {
+// cachePath is the stable asset name for a source: <base>.<ext> next to it.
+func (ctx resourceContext) cachePath(ext string) string {
 	first := ctx.paths[0]
 	base := filepath.Base(first)
 	base = base[:len(base)-len(filepath.Ext(base))]
-	return filepath.Join(filepath.Dir(first), base+".zwasm")
+	return filepath.Join(filepath.Dir(first), base+"."+ext)
 }
 
 // cacheFresh reports whether cachePath exists and is no older than every source
@@ -104,7 +105,7 @@ func newestMod(p string) (time.Time, error) {
 
 // writeCache atomically overwrites the asset in place (stable name → clean git).
 func writeCache(cachePath string, buf []byte) {
-	tmp, err := os.CreateTemp(filepath.Dir(cachePath), ".zwasm-*")
+	tmp, err := os.CreateTemp(filepath.Dir(cachePath), ".asset-*")
 	if err != nil {
 		return
 	}
```

**File**: `services/monkey/fixtures/compile/cache_test.go` (modified, +6/-2)
```diff
@@ -19,7 +19,7 @@ func TestCachePathAndFreshness(t *testing.T) {
 
 	ctx := resourceContext{paths: []string{src}}
 
-	got := ctx.cachePath()
+	got := ctx.cachePath("zwasm")
 	want := filepath.Join(dir, "echo.zwasm")
 	if got != want {
 		t.Fatalf("cachePath = %q, want %q", got, want)
@@ -65,10 +65,14 @@ func TestCacheFreshnessDirectory(t *testing.T) {
 	}
 
 	ctx := resourceContext{paths: []string{srcDir}}
-	asset := ctx.cachePath()
+	asset := ctx.cachePath("zwasm")
 	if asset != filepath.Join(dir, "lib.zwasm") {
 		t.Fatalf("cachePath = %q, want lib.zwasm next to the dir", asset)
 	}
+	// A website bundle is a zip, not a zipped wasm.
+	if got := ctx.cachePath("zip"); got != filepath.Join(dir, "lib.zip") {
+		t.Fatalf("cachePath(zip) = %q, want lib.zip", got)
+	}
 
 	writeCache(asset, []byte("built"))
 	if err := os.Chtimes(srcDir, time.Now().Add(-time.Hour), time.Now().Add(-time.Hour)); err != nil {
```

**File**: `services/monkey/fixtures/compile/function.go` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ func (f functionContext) zWasmFile() error {
 }
 
 func (f functionContext) codeFile(language wasmSpec.SupportedLanguage) error {
-	return f.ctx.stashCached(f.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return f.ctx.stashCached(f.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp("", fmt.Sprintf("%s-*", f.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

**File**: `services/monkey/fixtures/compile/library.go` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ func (ctx resourceContext) library(config *structureSpec.Library) (err error) {
 }
 
 func (l libraryContext) directory() error {
-	return l.ctx.stashCached(l.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return l.ctx.stashCached(l.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", l.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

**File**: `services/monkey/fixtures/compile/smartops.go` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ func (f smartopsContext) zWasmFile() error {
 }
 
 func (f smartopsContext) codeFile(language wasmSpec.SupportedLanguage) error {
-	return f.ctx.stashCached(f.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return f.ctx.stashCached(f.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", f.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

**File**: `services/monkey/fixtures/compile/website.go` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ func (w websiteContext) zip() error {
 }
 
 func (w websiteContext) directory() error {
-	return w.ctx.stashCached(w.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return w.ctx.stashCached(w.ctx.resourceId, "zip", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", w.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

---

### Incident Patch 15: `735cfc28` (2026-07-13)
**Commit Message**: perf(monkey): vendor build scaffold, drop tb_templates network pull (#475)

CompileFor pulled taubyte-test/tb_templates from github on every call —
even cache hits and prebuilt-.zwasm paths that never build — so a github
blip failed unrelated tests (e.g. gateway's prebuilt ping.zwasm).

The per-language build scaffold (.taubyte/{build.sh,config.yaml} + go.mod)
is tiny and test-only (production functions carry their own from
`tau new`). Vendor the three `common` dirs into the fixture and copy them
locally instead of cloning, so the compile fixture is fully offline.

go.mod is vendored as go.mod.tmpl so it isn't seen as a nested module in
the tree; it's renamed back in the build dir.

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Assembly_Script/common/.taubyte/build.sh` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+#!/bin/bash
+
+. /utils/wasm.sh
+
+build "${FILENAME}"
+ret=$?
+echo -n $ret > /out/ret-code
+exit $ret
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Assembly_Script/common/.taubyte/config.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+version: 1.00
+environment:
+  image: taubyte/assembly-script-wasi:latest
+  variables:
+workflow:
+  - build
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Go/common/.taubyte/build.sh` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+#!/bin/bash
+
+. /utils/wasm.sh
+
+build "${FILENAME}"
+ret=$?
+echo -n $ret > /out/ret-code
+exit $ret
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Go/common/.taubyte/config.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+version: 1.00
+environment:
+  image: taubyte/go-wasi:latest
+  variables:
+workflow:
+  - build
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Go/common/go.mod.tmpl` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+module function 
+
+go 1.19
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Rust/common/.taubyte/build.sh` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+#!/bin/bash
+
+. /utils/wasm.sh
+
+build "${FILENAME}"
+ret=$?
+echo -n $ret > /out/ret-code
+exit $ret
```

**File**: `services/monkey/fixtures/compile/assets/templates/code/functions/Rust/common/.taubyte/config.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+version: 1.00
+environment:
+  image: taubyte/rust-wasi:latest
+  variables:
+workflow:
+  - build
```

**File**: `services/monkey/fixtures/compile/fixture_compile_for.go` (modified, +0/-2)
```diff
@@ -7,7 +7,6 @@ import (
 	"strings"
 
 	"github.com/taubyte/tau/dream"
-	tauTemplates "github.com/taubyte/tau/pkg/cli/singletons/templates"
 	spec "github.com/taubyte/tau/pkg/specs/common"
 	structureSpec "github.com/taubyte/tau/pkg/specs/structure"
 )
@@ -142,7 +141,6 @@ func CompileFor(u *dream.Universe, params ...interface{}) error {
 		paths:         b.Paths,
 		call:          b.Call,
 		forceBuild:    b.ForceBuild,
-		templateRepo:  tauTemplates.Repository(),
 		hoarderClient: hoarder,
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #520** (2026-08-16): feat(netguard): confine untrusted code egress to the public internet (@samyfodil)
- **PR #519** (2026-08-08): fix(vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (@samyfodil)
- **PR #518** (2026-08-08): fix(vm): harden WASM host-ABI boundary and read into guest memory in place (@samyfodil)
- **PR #517** (2026-08-07): feat(containers): build images on containerd, by running BuildKit as a container (@samyfodil)
- **PR #516** (2026-08-07): fix(containers): make containerd a real peer of docker, and the tests hermetic (@samyfodil)
- **PR #515** (2026-08-06): fix(p2p): bounds-check frame length; stop allocating a buffer per frame (@samyfodil)
- **PR #514** (2026-08-05): fix(auth): bind project and repository routes to the caller's repo access (@samyfodil)
- **PR #512** (2026-08-16): fix(taucorder): drop the stale accounts stubs, let the client be extended (@samyfodil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
